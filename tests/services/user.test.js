const { sequelize } = require('../../db/connect');
const { Role } = require('../../models/role');
const { User } = require('../../models/user');
const { addPerson, hashPassword } = require('../../repositories/personRepo');

const upsertedUser = {
  id: 1,
  firstName: 'Social',
  lastName: 'Media',
  email: 'social@media.com',
  password: 'social',
  dateOfBirth: '1975-05-05',
};

beforeAll(async () => {
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
  await User.findOrCreate({
    where: { id: upsertedUser.id, email: upsertedUser.email },
    defaults: {
      firstName: upsertedUser.firstName,
      lastName: upsertedUser.lastName,
      password: await hashPassword(upsertedUser.password),
      dateOfBirth: upsertedUser.dateOfBirth,
    },
  });
  console.log('--------------------BEFORE-All--------------------------');
}, 20000);

afterAll(async () => {
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  await sequelize.truncate({
    force: true,
    restartIdentity: true,
    cascade: true,
    truncate: true,
  });
  await sequelize.query('SET FOREIGN_KEY_CHECKS= 1;');
  await sequelize.close();
  console.log('--------------------AFTER-All--------------------------');
}, 20000);

const user = {
  firstName: 'Node',
  lastName: 'Javascript',
  email: 'node@javascript.cs',
  password: 'node_pass',
  dateOfBirth: '1950-01-01',
  roles: ['user', 'admin'],
};

test('Should add a new user successfully', async () => {
  await addPerson(user);
  const data = await User.findOne({ where: { email: user.email } });
  expect(data.get()).toEqual({
    id: expect.any(Number),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    dateOfBirth: user.dateOfBirth,
    createdAt: expect.any(Date),
    lastModifiedAt: expect.any(Date),
    password: expect.any(String),
  });

  expect(data.getDataValue('password')).not.toEqual(user.password);
});

test('Add user should fail due to Duplicate email', async () => {
  expect(addPerson(upsertedUser)).rejects.toThrow();
});
