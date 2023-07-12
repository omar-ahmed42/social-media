const { findAllFriends, isFriend } = require('../../repositories/friendRepo');
const { sequelize, driverSession } = require('../../db/connect');

const { hashPassword } = require('../../repositories/personRepo');
const { User } = require('../../models/user');
const { Role } = require('../../models/role');

async function createUserForTesting(user) {
  let [createdOrRetrievedUser] = await User.findOrCreate({
    where: { id: user.id, email: user.email },
    defaults: {
      firstName: user.firstName,
      lastName: user.lastName,
      password: await hashPassword(user.password),
      dateOfBirth: user.dateOfBirth,
    },
  });
  await driverSession.run(`MERGE (user:PERSON {id: $userId})`, {
    userId: user.id,
  });
  return createdOrRetrievedUser.get();
}

const user = {
  id: 1,
  firstName: 'Node',
  lastName: 'Javascript',
  email: 'node@javascript.cs',
  password: 'social',
  dateOfBirth: '1950-05-05',
};

const friend = {
  id: 2,
  firstName: 'Event',
  lastName: 'Loop',
  email: 'event.loop@javascript.cs',
  password: 'social',
  dateOfBirth: '1970-05-05',
};

const anotherFriend = {
  id: 3,
  firstName: 'Another',
  lastName: 'Friend',
  email: 'anotherfriend@javascript.cs',
  password: 'social',
  dateOfBirth: '1975-05-05',
};

const anotherFriend2 = {
  id: 4,
  firstName: 'Social',
  lastName: 'Media',
  email: 'social.media@javascript.cs',
  password: 'social',
  dateOfBirth: '1980-05-05',
};

const userWithNoFriends = {
  id: 5,
  firstName: 'No',
  lastName: 'Friends',
  email: 'no.friends@javascript.cs',
  password: 'social',
  dateOfBirth: '1985-05-05',
};

async function createFriendsForTesting(user, friend) {
  return await driverSession.run(
    `
  MATCH (user:PERSON {id: $userId}), (friend:PERSON {id: $friendId})
  MERGE (user)-[friend_with:FRIEND_WITH]-(friend)
  RETURN friend_with`,
    { userId: user.id, friendId: friend.id }
  );
}

let expectedFriends = [];

function transformAndPush(user, array) {
  let element = user;
  delete element.password;
  delete element.lastModifiedAt;
  element.createdAt = expect.any(Date);
  array.push(element);
}

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

  await createUserForTesting(user);
  transformAndPush(await createUserForTesting(friend), expectedFriends);
  transformAndPush(await createUserForTesting(anotherFriend), expectedFriends);
  transformAndPush(await createUserForTesting(anotherFriend2), expectedFriends);
  await createUserForTesting(userWithNoFriends);


  await createFriendsForTesting(user, friend);
  await createFriendsForTesting(user, anotherFriend);
  await createFriendsForTesting(user, anotherFriend2);

  expectedFriends.sort((a, b) => a.id - b.id);

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

  expectedFriends = [];
  console.log('--------------------AFTER-EACH--------------------------');
}, 20000);

afterAll(async () => {
  await sequelize.close();
  await driverSession.close();
  console.log('--------------------AFTER-ALL--------------------------');
});

describe('Find all friends', () => {
  test('Find all friends (User has more than 1 friend)', async () => {
    const friends = await findAllFriends(user.id);

    expect(friends.length).toEqual(expectedFriends.length);

    expect(friends).toEqual(expectedFriends);
  });

  test('Find all friends (User has no friends) Should return an empty array', async () => {
    const friends = await findAllFriends(userWithNoFriends.id);
    
    expect(friends.length).toEqual(0);
    expect(friends).toEqual([]);
  });


  test('Find a slice of friends (User has more than 1 friend) sorted by userId', async () => {
    const friends = await findAllFriends(user.id);

    expect(friends).toHaveLength(expectedFriends.length);
    expect(friends).toEqual(expectedFriends);
  })

  test('Find a slice of friends (User has 0 friends) Should return an empty array', async () => {
    const friends = await findAllFriends(userWithNoFriends.id);

    expect(friends).toHaveLength(0);
    expect(friends).toEqual([]);
  });

  test('Check whether 2 users are friends (They are friends, Should return true)', async () => {
    expect(await isFriend(user.id, friend.id)).toBeTruthy();
  });

  test('Check whether 2 users are friends (They aren\'t friends Should return false)', async () => {
    expect(await isFriend(user.id, userWithNoFriends.id)).toBeFalsy();
  });
});
