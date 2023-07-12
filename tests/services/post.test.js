const { sequelize, driverSession } = require('../../db/connect');

const { hashPassword } = require('../../repositories/personRepo');
const { User } = require('../../models/user');
const { Role } = require('../../models/role');
const {
  archivePost,
  savePostAsDraft,
  publishPost,
} = require('../../repositories/postRepo');
const { Post, PostStatusEnum } = require('../../models/post');
const { pushToNewsFeed } = require('../../repositories/fanout');
const { PostAttachment } = require('../../models/post-attachment');
const { Attachment } = require('../../models/attachment');

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

async function createPostForTesting(user, post, postAttachments) {
  let createdPost = await Post.create({
    id: post.id,
    userId: user.id,
    content: post.content,
    postStatus: post.postStatus,
  });

  if (!postAttachments?.length) return [createdPost.get(), null];
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

let draftPost, archivedPost, publishedPost;

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

beforeAll(() => {
  sequelize.options.logging = false;
});

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

  [archivedPost] = await createPostForTesting(user, {
    id: 1,
    content: 'This is an archived post',
    postStatus: PostStatusEnum.archived,
  });
  [draftPost] = await createPostForTesting(user, {
    id: 2,
    content: 'This is a draft post',
    postStatus: PostStatusEnum.draft,
  });
  [publishedPost] = await createPostForTesting(user, {
    id: 3,
    content: 'This is a publish post',
    postStatus: PostStatusEnum.published,
  });

  expectedFriends.sort((a, b) => a.id - b.id);

  // console.log('--------------------BEFORE-EACH--------------------------');
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
  // console.log('--------------------AFTER-EACH--------------------------');
}, 20000);

afterAll(async () => {
  await sequelize.close();
  await driverSession.close();
  console.log('--------------------AFTER-ALL--------------------------');
});

describe('Archiving posts', () => {
  test('No post id provided. Null expected', async () => {
    const archivedPost = await archivePost(user.id, null, {
      content: 'This is my content',
    });
    expect(archivedPost).toBeNull();
  });

  test('Post id provided, Post status draft. Null expected', async () => {
    const archivedPost = await archivePost(user.id, draftPost.id, {
      content: 'This is my content',
    });
    expect(archivedPost).toBeNull();
  });

  test('Post ID provided, but post not found. Null expected', async () => {
    expect(
      await archivePost(user.id, 123456, { content: 'Should not be found' })
    ).toBeNull();
  });
});

describe('SavingPostAsDraft', () => {
  test('No post ID provided, Valid content', async () => {
    expect(
      (await savePostAsDraft(user.id, null, { content: 'Hello world' })).get()
    ).toEqual({
      userId: user.id,
      id: expect.any(Number),
      lastModifiedAt: expect.any(Date),
      createdAt: expect.any(Date),
      content: 'Hello world',
      postStatus: PostStatusEnum.draft,
    });
  });

  test('Post ID provided, No post found', async () => {
    expect(
      await savePostAsDraft(user.id, 123456, { content: 'Hello world' })
    ).toBeNull();
  });

  test('Post ID provided, post status is NOT draft', async () => {
    expect(
      await savePostAsDraft(user.id, publishedPost.id, {
        content: 'Hello World',
      })
    ).toBeNull();
  });

  test('Post ID provided, found post. Expected: Updated Post', async () => {
    let savedPost = (
      await savePostAsDraft(user.id, draftPost.id, {
        content: 'Should be updated',
      })
    ).get();
    let actual = (await Post.findByPk(draftPost.id)).get();

    expect(actual.postStatus).toEqual(PostStatusEnum.draft);
    expect(actual.content).toEqual('Should be updated');

    savedPost.lastModifiedAt = expect.any(Date);
    expect(actual).toEqual(savedPost);
  });
});

describe('Publishing a post', () => {
  test('No post ID provided, post content is blank. Should return null', async () => {
    expect(await publishPost(user.id, null, { content: '' })).toBeNull();
  });

  test('No post ID, content is not blank. Should return the newly created post', async () => {
    let savedPost = await publishPost(user.id, null, {
      content: 'Definitely not blank',
    });

    let actual = await Post.findByPk(savedPost.id);

    savedPost = savedPost.get();
    savedPost.lastModifiedAt = expect.any(Date);
    savedPost.createdAt = expect.any(Date);

    expect(actual.getDataValue('content')).toEqual('Definitely not blank');
    expect(actual.get()).toEqual(savedPost);
  });

  test('Post ID provided, content is not blank. Post should be updated (content, status)', async () => {
    await publishPost(user.id, draftPost.id, { content: 'My new post' });

    let actual = (await Post.findByPk(draftPost.id)).get();

    expect(actual.content).toEqual('My new post');
    expect(actual.postStatus).toEqual(PostStatusEnum.published);
    expect(actual).toEqual({
      id: draftPost.id,
      content: 'My new post',
      createdAt: expect.any(Date),
      lastModifiedAt: expect.any(Date),
      postStatus: PostStatusEnum.published,
      userId: user.id,
    });
  });

  test('Post ID provided, content is blank, not the post owner. Should return null', async () => {
    expect(
      await publishPost(friend.id, draftPost.id, { content: '' })
    ).toBeNull();
  });

  test('Post ID provided, content is blank, is post owner, no attachments. Should return null', async () => {
    expect(
      await publishPost(user.id, draftPost.id, { content: '' })
    ).toBeNull();
  });

  test('Post ID provided, content is not blank, is not the post owner. Should return null', async () => {
    expect(
      await publishPost(friend.id, draftPost.id, { content: 'My world' })
    ).toBeNull();
  });

  test('Post ID provided, content is not blank, but no post found. Should return null', async () => {
    expect(
      await publishPost(user.id, 123456789, { content: 'My world' })
    ).toBeNull();
  });

  test('Post ID provided, all fields are valid, post status = draft. Should return updated post with published status', async () => {
    await publishPost(user.id, draftPost.id, { content: 'New content' });
    const actual = await Post.findByPk(draftPost.id);

    expect(actual.getDataValue('postStatus')).toEqual(PostStatusEnum.published);
    expect(actual.getDataValue('content')).toEqual('New content');
    expect(actual.get()).toEqual({
      id: draftPost.id,
      content: 'New content',
      postStatus: PostStatusEnum.published,
      userId: user.id,
      lastModifiedAt: expect.any(Date),
      createdAt: expect.any(Date),
    });
  });

  test('Post ID provided, all fields are valid, post status = draft. Push to newsfeed should be called once', async () => {
    const Fanout = require('../../repositories/fanout');
    Fanout.pushToNewsFeed = jest.fn();
    const attachment = await Attachment.create({
      url: 'url',
      size: 123,
      name: 'any_name',
      type: 'any_type',
    });
    await PostAttachment.create(
      {
        postId: draftPost.id,
        attachmentId: attachment.getDataValue('id')
      }
    );
    await publishPost(user.id, draftPost.id, { content: '' });
    expect(Fanout.pushToNewsFeed).toHaveBeenCalled();
  });
  
  test('Post ID provided, all fields are valid, post status != draft. Should return updated post with published status', async () => {
    await publishPost(user.id, publishedPost.id, { content: 'New content' });
    const actual = await Post.findByPk(publishedPost.id);

    expect(actual.getDataValue('postStatus')).toEqual(PostStatusEnum.published);
    expect(actual.getDataValue('content')).toEqual('New content');
    expect(actual.get()).toEqual({
      id: publishedPost.id,
      content: 'New content',
      postStatus: PostStatusEnum.published,
      userId: user.id,
      lastModifiedAt: expect.any(Date),
      createdAt: expect.any(Date),
    });
  });
});
