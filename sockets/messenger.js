const {addMessage} = require("../services/messages");

function storeUserSocket(io, userId, socket){
    let listOfUserSockets;
    listOfUserSockets = io.sockets.sockets.get(userId) || [];
    listOfUserSockets.push(socket.id);
    io.sockets.sockets.set(userId, listOfUserSockets);
}

function discardUserSocket(io, userId, socket){
    let listOfSockets = io.sockets.sockets.get(userId);
    listOfSockets = listOfSockets.filter(toBeFilteredSocket => socket.id === toBeFilteredSocket);
    io.sockets.sockets.set(userId, listOfSockets);
}

async function sendMessage(io, senderId, receiverId, data){
    console.log('sendMessage: ' +  data.msg.message)
    await addMessage(data.conversationId, data.msg)
    let receiverSockets = io.sockets.sockets.get(receiverId);
    let response = {senderId: senderId, msg: data.msg.message.text};
    io.to(receiverSockets).emit('receiveMessage', response);
}

module.exports = {
    storeUserSocket,
    discardUserSocket,
    sendMessage
}
