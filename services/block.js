const driverSession = require('../db/connect.js').driverSession;

async function findAllBlockedUsers(userId){
    await driverSession.run(
        `
        MATCH (person:PERSON) WHERE ID(person) = $userId
        (person) -[:BLOCKS]-> (blockedPerson:PERSON)
        RETURN blockedPerson
        `, {userId: userId}
    );
}

async function blockUser(userId, blockedUserId){
    await driverSession.run(
        `
        MATCH (user:PERSON) WHERE ID(user) = $userId
        MATCH (blockedUser:PERSON) WHERE ID(blockedUser) = $blockedUserId
        CREATE (user) -[:BLOCKS]-> (blockedUser)`, {userId: userId, blockedUserId: blockedUserId}
    );
}

async function unblockUser(userId, blockedUserId){
    await driverSession.run(`
    MATCH (user:PERSON) WHERE ID(user) = $userId
    MATCH (blockedUser:PERSON) WHERE ID(blockedUser) = $blockedUserId
    MATCH (user) -[blocks:BLOCKS]-> (blockedUser)
    DELETE blocks
    `, {userId: userId, blockedUserId: blockedUserId});
}

module.exports = {
    findAllBlockedUsers,
    blockUser,
    unblockUser
}
