const {ApolloServer} = require('@apollo/server');
const {ApolloServerPluginDrainHttpServer} = require('@apollo/server/plugin/drainHttpServer');
const { expressMiddleware } = require('@apollo/server/express4');
const {typeDefs} = require('./schema/TypeDefs');
const {resolvers} = require('./schema/Resolvers');
const passport = require('passport');
const express = require('express');
const http = require('http');
const {permissions} = require('./authorization');
const {graphqlUploadExpress} = require("graphql-upload");
const {startDBs} = require("./db/connect");
const {router} = require("./routes/authentication");
const {applyMiddleware} = require("graphql-middleware");
const {makeExecutableSchema} = require("@graphql-tools/schema");
const { User } = require('./models/user');
const { Role, UserRole } = require('./models/role');
const {storeUserSocket, sendMessage, discardUserSocket} = require("./sockets/messenger");
const cors = require("cors");
const {Server} = require("socket.io");
const { FriendRequest } = require('./models/friend-request');
const { Post } = require('./models/post');
const { PostAttachment } = require('./models/post-attachment');
const { Attachment } = require('./models/attachment');
const app = express();
const httpServer = http.createServer(app);
require('./config/passport')(passport);

require('dotenv').config();
app.use(express.json());
app.use(router);

passport.serializeUser(function (user, done) {
    if (user) done(null, user);
});

passport.deserializeUser(function (id, done) {
    done(null, id);
});

async function syncModels() {
    await User.sync();
    await Role.sync();
    await UserRole.sync();
    await FriendRequest.sync();
    await Post.sync();
    await Attachment.sync();
    await PostAttachment.sync();
}

async function startServer() {
    app.use(passport.initialize());
    const schemaWithAuthorization =
        applyMiddleware(makeExecutableSchema({typeDefs, resolvers}), permissions);

    const server = new ApolloServer({schema: schemaWithAuthorization, plugins: [ApolloServerPluginDrainHttpServer({httpServer})]});
    await server.start();
    
    app.use(graphqlUploadExpress());
    app.use('/graphql', cors(), (req, res, next) => {
        passport.authenticate('jwt', {session: false}, (err, user, info) => {
            if (user) {
                req.user = user;
            }
            next();
        })(req, res, next)
    }, expressMiddleware(server, {
        context: ({req}) => {
            const user = req.user || null;
            return {user};
         }
     }));

    await new Promise((resolve) => httpServer.listen({port: process.env.SERVER_PORT}, resolve));
    // await startMessenger()
    await startDBs();
    await syncModels();
}

startServer();
// ------------------------------------ websockets ------------------------------
async function startMessenger() {
    app.use(cors);

    var http = require('http').createServer(app);
    http.listen(process.env.NODE_PORT, () => {
        console.log("Http Connected on port", process.env.NODE_PORT);
    })

    const io = new Server().listen(http, {
        cors: {
            origin: "http://localhost:63342",
        }
    });

    const wrapMiddlewareForSocketIo = middleware => (socket, next) => {
        middleware(socket.request, {}, next)
    };
    io.use(wrapMiddlewareForSocketIo(passport.initialize()));
    io.use(wrapMiddlewareForSocketIo(passport.authenticate(['jwt'])));

    io.on("connection", (socket) => {
        console.log("connected using socket.io")
        storeUserSocket(io, socket.request.user, socket);
        socket.on('sendMessage', async ({receiverId, data}) => {
            console.log("MSG: " + data.msg.message);
            const senderId = socket.request.user;
            await sendMessage(io, senderId, receiverId, data);
        })
    });

    io.on("disconnect", async (userId, socket) => {
        await discardUserSocket(userId, socket)
    })
}
