const {ApolloServer} = require('@apollo/server');
const {ApolloServerPluginDrainHttpServer} = require('@apollo/server/plugin/drainHttpServer');
const { expressMiddleware } = require('@apollo/server/express4');
const {typeDefs} = require('./schema/TypeDefs');
const {resolvers} = require('./schema/Resolvers');
const passport = require('passport');
const express = require('express');
const http = require('http');
const {permissions} = require('./schema/authorization');
const {graphqlUploadExpress} = require("graphql-upload");
const {startDBs} = require("./db/connect");
const {router} = require("./routes/authentication");
const {applyMiddleware} = require("graphql-middleware");
const {makeExecutableSchema} = require("@graphql-tools/schema");
const cors = require("cors");
const { redisClient, connectToRedis } = require('./cache/client');
const { useServer } = require('graphql-ws/lib/use/ws');
const { WebSocketServer } = require('ws');
const { verifyToken } = require('./utils/jwt');
const { syncModels } = require('./db/model-sync');

require('ws');
require('./config/passport')(passport);

require('dotenv').config();

passport.serializeUser(function (user, done) {
    if (user) done(null, user);
});

passport.deserializeUser(function (id, done) {
    done(null, id);
});

const getDynamicContext = async (ctx, msg, args) => {
  const authHeader = ctx.connectionParams.Authorization;
  const token = authHeader.split(' ')[1];
  let user = await verifyToken(token);
  return { user };
};

async function startServer() {
  const schema = applyMiddleware(
    makeExecutableSchema({ typeDefs, resolvers }),
    permissions
  );

  const app = express();
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });
  const serverCleanup = useServer(
    {
      schema: schema,
      context: async (ctx, msg, args) => getDynamicContext(ctx, msg, args),
      onConnect: async (ctx, msg, args) => getDynamicContext(ctx, msg, args),
    },
    wsServer
  );

  const server = new ApolloServer({
    schema: schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(express.json());
  app.use(router);
  app.use(passport.initialize());

  app.use(graphqlUploadExpress());
  app.use(
    '/graphql',
    cors(),
    (req, res, next) => {
      passport.authenticate('jwt', { session: false }, (err, user, info) => {
        if (user) {
          req.user = user;
        }
        next();
      })(req, res, next);
    },
    expressMiddleware(server, {
      context: ({ req }) => {
        const user = req.user || null;
        return { user };
      },
    })
  );

  const PORT = process.env.SERVER_PORT;
  httpServer.listen({ port: PORT }, () => {
    console.log(`🚀 Query endpoint ready at http://localhost:${PORT}/graphql`);
    console.log(
      `🚀 Subscription endpoint ready at ws://localhost:${PORT}/graphql`
    );
  });

  await startDBs();
  await syncModels();
  await connectToRedis(redisClient);
}

startServer();