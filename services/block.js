const { Op } = require('sequelize');
const { neo4j } = require('../db/connect.js');
const { User } = require('../models/user.js');

const driverSession = require('../db/connect.js').driverSession;

async function findAllBlockedUsers(userId) {
  let blockedRelationships = await driverSession.run(
    `
        MATCH (person:PERSON {id: $userId})
        (person) -[:BLOCKS]-> (blockedPerson:PERSON)
        RETURN COLLECT(blockedPerson.id) AS blocked_users_ids
        `,
    { userId: neo4j.int(userId) }
  );

  let blockedUsersIds =
    blockedRelationships.records[0].get('blocked_users_ids');
  if (!blockedUsersIds?.length) return [];

  let users = await User.findAll({
    attributes: [
      'id',
      'firstName',
      'lastName',
      'email',
      'dateOfBirth',
      'createdAt',
    ],
    where: {
      id: { [Op.in]: blockedUsersIds },
    },
  });

  return users.map((user) => user.get({ plain: true }));
}

async function blockUser(userId, blockedUserId) {
  await driverSession.run(
    `
        MATCH (user:PERSON {id: $userId})
        MATCH (blockedUser:PERSON {id: $blockedUserId})
        MERGE (user) -[:BLOCKS]-> (blockedUser)`,
    { userId: neo4j.int(userId), blockedUserId: neo4j.int(blockedUserId) }
  );
  return true;
}

async function unblockUser(userId, blockedUserId) {
  await driverSession.run(
    `
    MATCH (user:PERSON {id: $userId})
    MATCH (blockedUser:PERSON {id: $blockedUserId})
    MATCH (user) -[blocks:BLOCKS]-> (blockedUser)
    DELETE blocks
    `,
    { userId: neo4j.int(userId), blockedUserId: neo4j.int(blockedUserId) }
  );
  return true;
}

module.exports = {
  findAllBlockedUsers,
  blockUser,
  unblockUser,
};
