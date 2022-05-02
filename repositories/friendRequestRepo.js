const driverSession = require('../db/connect.js').driverSession;

//TODO: Pagination

async function findAllReceivedFriendRequests(receiverId){
    let friendRequests = await driverSession.run(`
    MATCH (receiver:PERSON) WHERE ID(receiver) = ${receiverId}
    MATCH (sender:PERSON) -[:FRIEND_REQUEST]-> (receiver)
    RETURN sender
    `);

    return friendRequests;
}

async function findAllSentFriendRequests(senderId){
    let friendRequests = await driverSession.run(
        `
        MATCH (sender:PERSON) WHERE ID(sender) = ${senderId}
        MATCH (sender) -[:FRIEND_REQUEST]-> (receiver:PERSON)
        RETURN receiver`
    );

    return friendRequests;
}

async function sendFriendRequest(senderId, receiverId){
    await driverSession.run(
        `
        MATCH (sender:PERSON) WHERE ID(sender)= ${senderId}
        MATCH (receiver:PERSON) WHERE ID(receiver) = ${receiverId}
        CREATE (sender) -[:FRIEND_REQUEST]-> (receiver)`
    );
}

async function acceptFriendRequest(senderId, receiverId){
    await driverSession.run(
        `
        MATCH (sender:PERSON) WHERE ID(sender) = ${senderId}
        MATCH (receiver:PERSON) WHERE ID(receiver) = ${receiverId}
        MATCH (sender) -[friend_request:FRIEND_REQUEST]-> (receiver)
        DELETE friend_request
        CREATE (sender) <-[:FRIEND_WITH]-> (receiver)`
    );
}

async function deleteFriendRequest(senderId, receiverId){
    await driverSession.run(
        `
        MATCH (sender:PERSON) WHERE ID(sender) = ${senderId}
        MATCH (receiver:PERSON) WHERE ID(receiver) = ${receiverId}
        MATCH (sender) -[friend_request:FRIEND_REQUEST]-> (receiver)
        DELETE friend_request
        `
    );
}

module.exports = {
    findAllReceivedFriendRequests,
    findAllSentFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    deleteFriendRequest
}
