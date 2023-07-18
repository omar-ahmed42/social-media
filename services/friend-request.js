const { sequelize } = require('../db/connect.js');
const {
  FriendRequest,
  FriendRequestStatusesEnum,
} = require('../models/friend-request.js');
const {
  calculateOffset,
  calculatePageLimit,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
} = require('../utils/pagination.js');

const driverSession = require('../db/connect.js').driverSession;

async function findFriendRequests(
  userId,
  friendRequestStatus = FriendRequestStatusesEnum.pending,
  page = DEFAULT_PAGE,
  pageSize = DEFAULT_PAGE_SIZE
) {
  let friendRequests = [];
  switch (friendRequestStatus) {
    case FriendRequestStatusesEnum.pending:
    case FriendRequestStatusesEnum.cancelled:
      friendRequests = await FriendRequest.findAndCountAll({
        where: { senderId: userId, requestStatus: friendRequestStatus },
        order: [['created_at', 'DESC']],
        offset: calculateOffset(page, pageSize),
        limit: calculatePageLimit(pageSize),
      });
      break;
    case FriendRequestStatusesEnum.accepted:
    case FriendRequestStatusesEnum.rejected:
      friendRequests = await FriendRequest.findAndCountAll({
        where: { receiverId: userId, requestStatus: friendRequestStatus },
        order: [['created_at', 'DESC']],
        offset: calculateOffset(page, pageSize),
        limit: calculatePageLimit(pageSize),
      });
      break;
  }
  return friendRequests?.rows.length > 0
    ? friendRequests.rows.map((friendRequest) => friendRequest.get())
    : [];
}

async function sendFriendRequest(senderId, receiverId) {
  if (senderId == receiverId) {
    return null;
  } // TODO: Throw an exception
  let friendRequest = null;
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
      { senderId: BigInt(senderId), receiverId: BigInt(receiverId) }
    );

    const [isBlockedBySender, isBlockedByReceiver, areFriends] = [
      result.records[0].get('sender_blocks_receiver'),
      result.records[0].get('receiver_blocks_sender'),
      result.records[0].get('friend_with'),
    ];

    if (isBlockedBySender || isBlockedByReceiver || areFriends) {
      return friendRequest;
    }
    try {
      [friendRequest] = await FriendRequest.findOrCreate({
        where: {
          senderId: senderId,
          receiverId: receiverId,
          requestStatus: FriendRequestStatusesEnum.pending,
        },
        benchmark: true,
      });
    } catch (err) {
      console.error('ERROR: ', err);
    }
  });

  return friendRequest;
}

async function cancelFriendRequest(id, senderId) {
  let updatedRowsCount = 0;
  await sequelize.transaction(async (t) => {
    [updatedRowsCount] = await FriendRequest.update(
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
  return await sequelize.transaction(async (t1) => {
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
    return affectedRowCount;
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

module.exports = {
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  findFriendRequests,
};
