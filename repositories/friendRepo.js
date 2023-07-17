const { Op } = require('sequelize');
const { User } = require('../models/user.js');
const { DEFAULT_PAGE_SIZE, DEFAULT_PAGE, calculateOffset, calculatePageLimit } = require('../utils/pagination.js');
const { neo4j } = require('../db/connect.js');

const driverSession = require('../db/connect.js').driverSession;

async function findFriends(userId, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE) {
  const friendsRelationships = await driverSession.run(
    `
  MATCH (user:PERSON {id: $userId}) <-[friend_with:FRIEND_WITH]-> (friend:PERSON)
  WITH friend.id AS friends_ids ORDER BY friends_ids
  SKIP $page
  LIMIT $pageSize
  RETURN COLLECT(friends_ids) AS friends_ids`,
    {
      userId: userId,
      page: neo4j.int(calculateOffset(page, pageSize)),
      pageSize: neo4j.int(calculatePageLimit(pageSize)),
    }
  );

  let friendsIds = friendsRelationships.records[0].get('friends_ids');
  if (!friendsIds?.length) return [];

  let friends = await User.findAll({
    attributes: [
      'id',
      'firstName',
      'lastName',
      'email',
      'dateOfBirth',
      'createdAt',
    ],
    where: {
      id: { [Op.in]: friendsIds },
    },
  });
  return friends.map((friend) => friend.get());
}


async function findAllFriends(userId) {
  const friendsRelationships = await driverSession.run(
    `
    MATCH (user:PERSON {id: $userId}) <-[friend_with:FRIEND_WITH]-> (friend:PERSON)
    RETURN COLLECT(friend.id) AS friends_ids`,
    { userId: userId }
  );

  let friendsIds = friendsRelationships.records[0].get('friends_ids');
  if (!friendsIds?.length) return [];

  let friends = await User.findAll({
    attributes: ['id', 'firstName', 'lastName', 'email', 'dateOfBirth', 'createdAt'],
    where: {
      id: { [Op.in]: friendsIds },
    },
  });

  return friends.map((friend) => friend.get());
}


async function findSliceOfFriends(userId, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE) {
  let friendsRelationships = await driverSession.run(
    `
        MATCH (user:PERSON {id: $userId}) <-[friend_with:FRIEND_WITH]-> (friend:PERSON)
        RETURN COLLECT(friend) AS friends
        ORDER BY friend.id
        SKIP $page
        LIMIT $pageSize
        `,
    {
      userId: userId,
      offset: calculateOffset(page),
      size: calculatePageLimit(pageSize),
    }
  );

  let friendsIds = friendsRelationships.records[0].get('friends_ids');
  if (!friendsIds?.length) return [];

  let friends = await User.findAll({
    attributes: [
      'id',
      'firstName',
      'lastName',
      'email',
      'dateOfBirth',
      'createdAt',
    ],
    where: {
      id: { [Op.in]: friendsIds },
    },
  });

  return friends.map((friend) => friend.get());
}

// Unfriend
// TODO: Test it
async function deleteFriendship(userId, friendId) {
    await driverSession.run(`
    MATCH (person:PERSON {id: $userId}) <-[friendship:FRIEND_WITH]-> (anotherPerson:PERSON {id: $friendId})
    DELETE friendship
    `, {userId: userId, friendId: friendId});
}


async function isFriend(userId, friendId) {
  const queryResult = await driverSession.run(
    `
  RETURN exists((:PERSON {id: $userId}) <-[:FRIEND_WITH]-> (:PERSON {id: $friendId})) AS is_friend;`,
    { userId: userId, friendId: friendId }
  );
  return queryResult.records[0].get('is_friend');
}


module.exports = {
    findFriends,
    findSliceOfFriends,
    deleteFriendship,
    findAllFriends,
    isFriend
}
