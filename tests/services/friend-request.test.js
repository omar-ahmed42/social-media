const { sequelize, driverSession } = require('../../db/connect');
const { FriendRequestStatusesEnum } = require('../../models/friend-request');
const {
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
} = require('../../services/friend-request');
const { hashPassword } = require('../../services/person');
const { User } = require('../../models/user');
const { Role } = require('../../models/role');
const { FriendRequest } = require('../../models/friend-request');

async function createUserForTesting(user) {
  await User.findOrCreate({
    where: { id: user.id, email: user.email },
    defaults: {
      firstName: user.firstName,
      lastName: user.lastName,
      password: await hashPassword(user.password),
      dateOfBirth: user.dateOfBirth,
    },
  });

  await driverSession.executeWrite(async (t2) => {
    return t2.run(
      `
        MERGE (person:PERSON {id: $id})
        RETURN person`,
      { id: user.id }
    );
  });
}

const senderUser = {
  id: 1,
  firstName: 'Node',
  lastName: 'Javascript',
  email: 'node@javascript.cs',
  password: 'social',
  dateOfBirth: '1950-05-05',
};

const receiverUser = {
  id: 2,
  firstName: 'Event',
  lastName: 'Loop',
  email: 'event.loop@javascript.cs',
  password: 'social',
  dateOfBirth: '1970-05-05',
};

const user = {
  id: 3,
  firstName: 'Angular',
  lastName: 'Javascript',
  email: 'angular@javascript.cs',
  password: 'social',
  dateOfBirth: '1980-05-05',
};

beforeEach(async () => {
  try {
    await Role.bulkCreate(
      [
        { id: 1, name: 'user' },
        { id: 2, name: 'admin' },
      ],
      { returning: false, ignoreDuplicates: true }
    );
  } catch (err) {
    console.error('ERROR: ', err);
  }

  await createUserForTesting(senderUser);
  await createUserForTesting(receiverUser);
  console.log('--------------------BEFORE-EACH--------------------------');
}, 20000);

afterEach(async () => {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await sequelize.truncate({
    force: true,
    restartIdentity: true,
    cascade: true,
    truncate: true,
  });
  await sequelize.query('SET FOREIGN_KEY_CHECKS= 1;');

  await driverSession.run('MATCH (n) -[r]-> () DELETE n, r');
  await driverSession.run('MATCH (n) DELETE n');
  console.log('--------------------AFTER-EACH--------------------------');
}, 20000);

afterAll(async () => {
  await sequelize.close();
  await driverSession.close();
  console.log('--------------------AFTER-ALL--------------------------');
});

describe('Sending a friend request', () => {
  test('Should send a friend request successfully (create a new friend request)', async () => {
    const sentFriendRequest = await sendFriendRequest(
      senderUser.id,
      receiverUser.id
    );

    const expected = {
      id: expect.any(Number),
      senderId: senderUser.id,
      receiverId: receiverUser.id,
      requestStatus: FriendRequestStatusesEnum.pending,
      createdAt: expect.any(Date),
      lastModifiedAt: expect.any(Date),
    };
    const created = true;
    expect([sentFriendRequest[0].get(), sentFriendRequest[1]]).toEqual([
      expected,
      created,
    ]);
  });

  test('Should try to create an already existing friend request', async () => {
    let expected = await FriendRequest.create({
      senderId: senderUser.id,
      receiverId: receiverUser.id,
      requestStatus: FriendRequestStatusesEnum.pending,
    });

    expected = expected.get();

    const sentFriendRequest = await sendFriendRequest(
      senderUser.id,
      receiverUser.id
    );

    expected.createdAt = expect.any(Date);
    expected.lastModifiedAt = expect.any(Date);

    const created = true;
    expect([sentFriendRequest[0].get(), sentFriendRequest[1]]).toEqual([
      expected,
      !created,
    ]);
  });

  async function createBlockRelationship(blockerId, blockeeId) {
    await driverSession.executeWrite(async (t) => {
      t.run(
        `
    MATCH (blocker: PERSON {id: $blockerId}), (blockee: PERSON {id: $blockeeId})
    MERGE  (blocker)-[blocks:BLOCKS]-> (blockee)
    RETURN blocks`,
        { blockerId: blockerId, blockeeId: blockeeId }
      );
    });
  }

  test('Should fail to send friend request due to the receiver being blocked by the sender', async () => {
    await createBlockRelationship(senderUser.id, receiverUser.id);
    const [friendRequest, created] = await sendFriendRequest(
      senderUser.id,
      receiverUser.id
    );
    expect([friendRequest, created]).toEqual([null, false]);
  });

  test('Should fail to send friend request due to the sender being blocked by the receiver', async () => {
    await createBlockRelationship(receiverUser.id, senderUser.id);
    const [friendRequest, created] = await sendFriendRequest(
      senderUser.id,
      receiverUser.id
    );
    expect([friendRequest, created]).toEqual([null, false]);
  });

  async function createFriendshipRelationship(leftFriendId, rightFriendId) {
    await driverSession.executeWrite(async (t) => {
      t.run(
        `
    MATCH (leftFriend: PERSON {id: $leftFriendId}), (rightFriend: PERSON {id: $rightFriendId})
    MERGE  (leftFriend) <-[friend_with:FRIEND_WITH]-> (rightFriend)
    RETURN friend_with`,
        { leftFriendId: leftFriendId, rightFriendId: rightFriendId }
      );
    });
  }

  test('Should fail to send friend request due to the sender being a friend of the receiver', async () => {
    await createFriendshipRelationship(senderUser.id, receiverUser.id);
    const [friendRequest, created] = await sendFriendRequest(
      senderUser.id,
      receiverUser.id
    );
    expect([friendRequest, created]).toEqual([null, false]);
  });
});

async function createFriendRequestForTesting(
  senderUser,
  receiverUser,
  requestStatus
) {
  return await FriendRequest.create({
    senderId: senderUser.id,
    receiverId: receiverUser.id,
    requestStatus: requestStatus,
  });
}
describe('Cancelling a friend request', () => {
  // TODO: Use test.each to test different request status enums
  test('Cancelling a pending friend request', async () => {
    let pendingRequest = await createFriendRequestForTesting(
      senderUser,
      receiverUser,
      FriendRequestStatusesEnum.pending
    );

    const updatedRowsCount = await cancelFriendRequest(
      pendingRequest.getDataValue('id'),
      senderUser.id
    );
    const cancelledRequest = await FriendRequest.findByPk(
      pendingRequest.getDataValue('id')
    );

    expect(updatedRowsCount).toEqual(1);
    let expected = pendingRequest.get();

    expected.requestStatus = FriendRequestStatusesEnum.cancelled;
    expected.createdAt = expect.any(Date);
    expected.lastModifiedAt = expect.any(Date);

    expect(cancelledRequest.getDataValue('requestStatus')).toEqual(
      FriendRequestStatusesEnum.cancelled
    );
    expect(cancelledRequest.get()).toEqual(expected);
  });

  test('Cancelling a non-pending friend request should fail returning 0 affected rows', async () => {
    let rejectedRequest = await createFriendRequestForTesting(
      senderUser,
      receiverUser,
      FriendRequestStatusesEnum.rejected
    );

    const updatedRowsCount = await cancelFriendRequest(
      rejectedRequest.getDataValue('id'),
      senderUser.id
    );
    const cancelledRequest = await FriendRequest.findByPk(
      rejectedRequest.getDataValue('id')
    );

    expect(updatedRowsCount).toEqual(0);

    let expected = rejectedRequest.get();

    expected.requestStatus = FriendRequestStatusesEnum.rejected;
    expected.createdAt = expect.any(Date);
    expected.lastModifiedAt = expect.any(Date);

    expect(cancelledRequest.getDataValue('requestStatus')).toEqual(
      FriendRequestStatusesEnum.rejected
    );
    expect(cancelledRequest.get()).toEqual(expected);
  });
});

describe('Accepting a friend request', () => {
  test('Accept a pending friend request', async () => {
    let pendingRequest = await createFriendRequestForTesting(
      senderUser,
      receiverUser,
      FriendRequestStatusesEnum.pending
    );

    await acceptFriendRequest(
      pendingRequest.getDataValue('id'),
      receiverUser.id
    );

    const acceptedFriendRequest = await FriendRequest.findByPk(
      pendingRequest.getDataValue('id')
    );

    let expected = pendingRequest.get();
    expected.requestStatus = FriendRequestStatusesEnum.accepted;
    expected.createdAt = expect.any(Date);
    expected.lastModifiedAt = expect.any(Date);

    const actualFriendshipResult = await driverSession.run(
      `
    MATCH (sender:PERSON {id: $senderId})-[friend_with:FRIEND_WITH]-(receiver:PERSON {id: $receiverId})
    RETURN friend_with`,
      { senderId: senderUser.id, receiverId: receiverUser.id }
    );

    expect(actualFriendshipResult.records[0]).not.toBeUndefined();
    expect(acceptedFriendRequest.get()).toEqual(expected);
    expect(acceptedFriendRequest.getDataValue('requestStatus')).toEqual(
      FriendRequestStatusesEnum.accepted
    );
  });

  test('Accepting a non-pending friend request should fail', async () => {
    let nonPendingRequest = await createFriendRequestForTesting(
      senderUser,
      receiverUser,
      FriendRequestStatusesEnum.rejected
    );

    await acceptFriendRequest(
      nonPendingRequest.getDataValue('id'),
      receiverUser.id
    );

    const actualFriendRequest = await FriendRequest.findByPk(
      nonPendingRequest.getDataValue('id')
    );

    let expected = nonPendingRequest.get();
    expected.createdAt = expect.any(Date);
    expected.lastModifiedAt = expect.any(Date);

    expect(actualFriendRequest.getDataValue('requestStatus')).toEqual(
      FriendRequestStatusesEnum.rejected
    );
    expect(actualFriendRequest.get()).toEqual(expected);
  });
});

describe('Rejecting a friend request', () => {
  test('Reject a pending friend request', async () => {
    let pendingRequest = await createFriendRequestForTesting(
      senderUser,
      receiverUser,
      FriendRequestStatusesEnum.pending
    );

    const affectedRowCount = await rejectFriendRequest(
      pendingRequest.getDataValue('id'),
      receiverUser.id
    );

    const rejectedFriendRequest = await FriendRequest.findByPk(
      pendingRequest.getDataValue('id')
    );

    let expected = pendingRequest.get();
    expected.requestStatus = FriendRequestStatusesEnum.rejected;
    expected.createdAt = expect.any(Date);
    expected.lastModifiedAt = expect.any(Date);

    expect(affectedRowCount).toEqual(1);
    expect(rejectedFriendRequest.get()).toEqual(expected);
    expect(rejectedFriendRequest.getDataValue('requestStatus')).toEqual(
      FriendRequestStatusesEnum.rejected
    );
  });

  test('Rejecting a non-pending friend request should fail', async () => {
    let nonPendingRequest = await createFriendRequestForTesting(
      senderUser,
      receiverUser,
      FriendRequestStatusesEnum.accepted
    );

    const affectedRowCount = await rejectFriendRequest(
      nonPendingRequest.getDataValue('id'),
      receiverUser.id
    );

    const actualFriendRequest = await FriendRequest.findByPk(
      nonPendingRequest.getDataValue('id')
    );

    let expected = nonPendingRequest.get();
    expected.createdAt = expect.any(Date);
    expected.lastModifiedAt = expect.any(Date);

    expect(affectedRowCount).toEqual(0);
    expect(actualFriendRequest.getDataValue('requestStatus')).toEqual(
      FriendRequestStatusesEnum.accepted
    );
    expect(actualFriendRequest.get()).toEqual(expected);
  });
});