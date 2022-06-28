const {ApolloServer} = require('apollo-server-express');
const {typeDefs} = require('./schema/TypeDefs');
const {resolvers} = require('./schema/Resolvers');
const passport = require('passport');
const express = require('express');
const {permissions} = require('./authorization');
const {graphqlUploadExpress} = require("graphql-upload");
const {startDBs} = require("./db/connect");
const {router} = require("./routes/authentication");
const {applyMiddleware} = require("graphql-middleware");
const {makeExecutableSchema} = require("@graphql-tools/schema");
const {storeUserSocket, sendMessage, discardUserSocket} = require("./sockets/messenger");
const cors = require("cors");
const {Server} = require("socket.io");
const app = express();
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

async function startServer() {
    app.use(passport.initialize());
    app.use('/graphql', (req, res, next) => {
        passport.authenticate('jwt', {session: false}, (err, user, info) => {
            if (user) {
                req.user = user;
            }
            next();
        })(req, res, next)
    })


    const schemaWithAuthorization =
        applyMiddleware(makeExecutableSchema({typeDefs, resolvers}), permissions);
    const server = new ApolloServer({
        schema: schemaWithAuthorization,
        context: ({req}) => {
            const user = req.user || null;
            return {user};
        }
    });

    await server.start();

    app.use(graphqlUploadExpress());
    server.applyMiddleware({app, path: '/graphql'});

    await startMessenger()
    await startDBs();

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
