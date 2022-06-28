const driverSession = require('../db/connect.js').driverSession;

async function findFriends(userId) {
    let response = await driverSession.run(
        `
        MATCH (person:PERSON) <-[:FRIEND_WITH]-> (anotherPerson:PERSON)
        WHERE ID(person) = $userId
        RETURN anotherPerson
        `, {userId: userId}
    );
    return response.records.map(record => record._fields[0].properties);
}

async function findSliceOfFriends(userId, offset, size) {
    let response = await driverSession.run(
        `
        MATCH (person:PERSON) <-[:FRIEND_WITH]-> (anotherPerson:PERSON)
        WHERE ID(person) = $userId
        RETURN anotherPerson
        SKIP $offset
        LIMIT $size
        `, {userId: userId, offset: offset, size: size}
    );
    return response.records.map(record => record._fields[0].properties);
}

async function findFriendsContainName(name, userId) {
    let response = await driverSession.run(
        `
        MATCH (friend:PERSON) <-[:FRIEND_WITH]-> (user:PERSON)
        WHERE ID(user) = $userId AND friend.name CONTAINS $name
        RETURN friend`, {userId: userId, name: name}
    );
    return response.records.map(record => record._fields[0].properties);
}

// Unfriend
async function deleteFriendship(userId, friendId) {
    await driverSession.run(`
    MATCH (person:PERSON {id: $userId) <-[friendship:FRIEND_WITH]-> (anotherPerson:PERSON {id: $friendId)
    WHERE ID(person) = $userId AND ID(anotherPerson) = $friendId
    DELETE friendship
    `, {userId: userId, friendId: friendId});
}


module.exports = {
    findFriends,
    findSliceOfFriends,
    findFriendsContainName,
    deleteFriendship
}
