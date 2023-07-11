const { sequelize } = require('../db/connect.js');
const { FriendRequest, FriendRequestStatusesEnum } = require('../models/friend-request.js');
const { calculateOffset, calculatePageLimit, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } = require('../utils/pagination.js');

const driverSession = require('../db/connect.js').driverSession;


async function findAllReceivedFriendRequests(receiverId) {
    let friendRequests = await driverSession.run(`
    MATCH (receiver:PERSON) WHERE ID(receiver) = $receiverId
    MATCH (sender:PERSON) -[:FRIEND_REQUEST]-> (receiver)
    RETURN sender
    `, {receiverId: receiverId});

    return friendRequests;
}

async function findFriendRequests(
  userId,
  friendRequestStatus = FriendRequestStatusesEnum.pending,
  page = DEFAULT_PAGE,
  pageSize = DEFAULT_PAGE_SIZE
) {
  switch (friendRequestStatus) {
    case FriendRequestStatusesEnum.pending:
    case FriendRequestStatusesEnum.cancelled:
      FriendRequest.findAndCountAll({
        include: { model: User, as: 'sender' },
        where: { senderId: userId, requestStatus: friendRequestStatus },
        order: ['created_at', 'DESC'],
        offset: calculateOffset(page, pageSize),
        limit: calculatePageLimit(pageSize),
      });
      break;
    case FriendRequestStatusesEnum.accepted:
    case FriendRequestStatusesEnum.rejected:
      FriendRequest.findAndCountAll({
        include: { model: User, as: 'receiver' },
        where: { receiverId: userId, requestStatus: friendRequestStatus },
        order: ['created_at', 'DESC'],
        offset: calculateOffset(page, pageSize),
        limit: calculatePageLimit(pageSize),
      });
      break;
  }
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
  let friendRequest = null;
  let created = false;
  await driverSession.executeRead(async (t1) => {
    const result = await t1.run(
      `
        MATCH (sender:PERSON {id: $senderId}), (receiver:PERSON {id: $receiverId})
        OPTIONAL MATCH (sender)-[sender_blocks:BLOCKS]->(receiver)
        OPTIONAL MATCH (sender)<-[receiver_blocks:BLOCKS]-(receiver)
        OPTIONAL MATCH (sender) <-[friend_with:FRIEND_WITH]-> (receiver)
        RETURN COALESCE(sender_blocks IS NOT NULL, false) AS sender_blocks_receiver,
        COALESCE(receiver_blocks IS NOT NULL, false) AS receiver_blocks_sender,
        COALESCE(friend_with IS NOT NULL, false) AS friend_with
        `,
      { senderId: senderId, receiverId: receiverId }
    );

    const [isBlockedBySender, isBlockedByReceiver, areFriends] = [
      result.records[0].get('sender_blocks_receiver'),
      result.records[0].get('receiver_blocks_sender'),
      result.records[0].get('friend_with'),
    ];

    if (isBlockedBySender || isBlockedByReceiver || areFriends)
      return [friendRequest, created];

    [friendRequest, created] = await FriendRequest.findOrCreate({
      where: {
        senderId: senderId,
        receiverId: receiverId,
        requestStatus: FriendRequestStatusesEnum.pending,
      },
    });
  });
  return [friendRequest, created];
}

async function cancelFriendRequest(id, senderId) {
  let updatedRowsCount = 0;
  await sequelize.transaction(async (t) => {
    [updatedRowsCount,] = await FriendRequest.update(
      { requestStatus: FriendRequestStatusesEnum.cancelled },
      {
        where: {
          id: id,
          senderId: senderId,
          requestStatus: FriendRequestStatusesEnum.pending,
        },
        transaction: t,
      }
    );
  });
  return updatedRowsCount;
}

async function acceptFriendRequest(id, receiverId) {
  await sequelize.transaction(async (t1) => {
    let affectedRowCount = 0;

    let pendingFriendRequest = await FriendRequest.findOne({
      where: {
        id: id,
        receiverId: receiverId,
        requestStatus: FriendRequestStatusesEnum.pending,
      },
      transaction: t1,
    });

    if (!pendingFriendRequest) return;

    [affectedRowCount] = await FriendRequest.update(
      { requestStatus: FriendRequestStatusesEnum.accepted },
      {
        where: {
          id: id,
          receiverId: receiverId,
          requestStatus: FriendRequestStatusesEnum.pending,
        },
        transaction: t1,
      }
    );

    const senderId = pendingFriendRequest.getDataValue('senderId');
    if (affectedRowCount > 0) {
      await driverSession.executeWrite(async (t2) => {
        return await t2.run(
          `
          MATCH (sender:PERSON {id: $senderId}), (receiver:PERSON {id: $receiverId})
          MERGE (sender)-[friend_with:FRIEND_WITH]-(receiver)`,
          { senderId: senderId, receiverId: receiverId }
        );
      });
    }
  });
}

async function rejectFriendRequest(id, receiverId) {
  let affectedRowCount = 0;
  await sequelize.transaction(async (t) => {
    [affectedRowCount] = await FriendRequest.update(
      { requestStatus: FriendRequestStatusesEnum.rejected },
      {
        where: {
          id: id,
          receiverId: receiverId,
          requestStatus: FriendRequestStatusesEnum.pending,
        },
        transaction: t,
      }
    );
  });
  return affectedRowCount;
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
    cancelFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    declineFriendRequest,
    deleteFriendRequest
}
