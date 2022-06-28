const driverSession = require('../db/connect.js').driverSession;

//TODO: Pagination

async function findAllReceivedFriendRequests(receiverId) {
    let friendRequests = await driverSession.run(`
    MATCH (receiver:PERSON) WHERE ID(receiver) = $receiverId
    MATCH (sender:PERSON) -[:FRIEND_REQUEST]-> (receiver)
    RETURN sender
    `, {receiverId: receiverId});

    return friendRequests;
}

async function findAllSentFriendRequests(senderId) {
    let friendRequests = await driverSession.run(
        `
        MATCH (sender:PERSON) WHERE ID(sender) = $senderId
        MATCH (sender) -[:FRIEND_REQUEST]-> (receiver:PERSON)
        RETURN receiver`, {senderId: senderId}
    );

    return friendRequests;
}

async function sendFriendRequest(senderId, receiverId) {
    await driverSession.run(
        `
        MATCH (sender:PERSON) WHERE ID(sender)= $senderId
        MATCH (receiver:PERSON) WHERE ID(receiver) = $receiverId
        CREATE (sender) -[:FRIEND_REQUEST]-> (receiver)`, {senderId: senderId, receiverId: receiverId}
    );
}

async function acceptFriendRequest(senderId, receiverId) {
    await driverSession.run(
        `
        MATCH (sender:PERSON) WHERE ID(sender) = $senderId
        MATCH (receiver:PERSON) WHERE ID(receiver) = $receiverId
        MATCH (sender) -[friend_request:FRIEND_REQUEST]-> (receiver)
        DELETE friend_request
        CREATE (sender) <-[:FRIEND_WITH]-> (receiver)`, {senderId: senderId, receiverId: receiverId}
    );
}

async function deleteFriendRequest(senderId, receiverId) {
    // Sender cancels the sent friend request
    await driverSession.run(
        `
        MATCH (sender:PERSON) WHERE ID(sender) = $senderId
        MATCH (receiver:PERSON) WHERE ID(receiver) = $receiverId
        MATCH (sender) -[friend_request:FRIEND_REQUEST]-> (receiver)
        DELETE friend_request
        `, {senderId: senderId, receiverId: receiverId}
    );
}

async function declineFriendRequest(senderId, receiverId) {
    // Receiver cancels the received friend request
    await driverSession.run(
        `
        MATCH (sender:PERSON) WHERE ID(sender) = $senderId
        MATCH (receiver:PERSON) WHERE ID(receiver) = $receiverId
        MATCH (sender) -[friend_request:FRIEND_REQUEST]-> (receiver)
        DELETE friend_request
        `, {senderId: senderId, receiverId: receiverId}
    );
}

module.exports = {
    findAllReceivedFriendRequests,
    findAllSentFriendRequests,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    deleteFriendRequest
}
