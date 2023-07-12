const { driverSession } = require('../db/connect');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { finished } = require('stream/promises');
const { isValidMedia } = require('../utils/validators/media');
const { parseFileExtension } = require('../utils/parsers/file');
const { Post, PostStatusEnum } = require('../models/post');
const { PostAttachment } = require('../models/post-attachment');
const { isFriend } = require('./friendRepo');
const Fanout = require('./fanout.js');
const { Op } = require('sequelize');
const { isBlank } = require('../utils/string-utils');
const { Attachment } = require('../models/attachment');

// TODO: Implement Privacy and Post Slicing
// TODO: (post:POST) -[NOT_VISIBLE_TO]-> (person:PERSON)
// TODO: (post:POST) -[ONLY_VISIBLE_TO]-> (person:PERSON)
// TODO: IF (post:POST) -[ONLY_VISIBLE_TO]-> (friends:FRIENDS) THEN (friend:PERSON)<-[friends_with:FRIENDS_WITH]-> (poster:Person) -[posts:POSTS]-> (post:POST)
// TODO: IF (post:POST) -[ONLY_VISIBLE_TO]-> (person:PERSON) THEN (person)
// if condition for other privacy rules like "friends"

async function fetchNewsfeed(userId, size, lastSeenPostId) {
  // TODO: handle case: User follows another user who posts public posts
  // TODO: Use machine learning in fetching the newsfeed
  try {
    let res = await driverSession.run(
      `
        MATCH (person:PERSON) WHERE ID(person) = $userId
        MATCH (someone:PERSON) -[POSTS]-> (post:POST) -[ONLY_VISIBLE_TO]-> (person)
        WHERE ID(post) > $lastSeenPostId
        OR
        MATCH (person) <-[FRIENDS_WITH]-> (someone:PERSON) -[POSTS]-> (post:POST) -[ONLY_VISIBLE_TO]-> (friends:FRIENDS)
        WHERE ID(post) > $lastSeenPostId
        RETURN (post)
        LIMIT $size
    `,
      {
        userId: userId,
        lastSeenPostId: lastSeenPostId ? lastSeenPostId : 0,
        size: size ? size : 15,
      }
    );

    return res.records.map((record) => record._fields[0].properties);
  } catch (e) {
    console.error('ERROR: ' + e);
    console.error('ERROR_CODE: ' + e.code);
  }
}

async function findPostById(postId) {
  try {
    const res = await driverSession.run(
      `
        MATCH (post:POST) WHERE ID(post) = $postId
        RETURN (post)`,
      { postId: postId }
    );
    return res.records.map((record) => record._fields[0].properties);
  } catch (e) {
    console.error('ERROR: ' + e);
    console.error('ERROR_CODE: ' + e.code);
  }
}

async function deletePostById(userId, postId) {
  try {
    await driverSession.run(
      `
            MATCH (person: PERSON) WHERE ID(person) = $userId
            MATCH (person) -[POSTS]-> (post:POST) WHERE ID(post) = $postId
            DETACH DELETE (post)
            `,
      { userId: userId, postId: postId }
    );
  } catch (e) {
    console.error('ERROR: ' + e);
    console.error('ERROR_CODE: ' + e.code);
  }
}

async function deletePost(userId, postId) {
  return await Post.destroy({
    where: { id: postId, userId: userId },
  });
}

async function findPost(userId, postId) {
  const post = await Post.findByPk(postId, {
    include: { model: PostAttachment, include: Attachment },
  });
  if (post.userId === userId) return post.get();

  if (
    post.postStatus === PostStatusEnum.published &&
    (await isFriend(userId, post.userId))
  )
    return post.get();

  return null; // or Throw an exception
}

async function savePost(userId, postId, msg) {
  let post = null;
  switch (msg.postStatus) {
    case PostStatusEnum.archived:
      post = archivePost(userId, postId, msg);
      break;
    case PostStatusEnum.draft:
      post = savePostAsDraft(userId, postId, msg);
      break;
    case PostStatusEnum.published:
      post = publishPost(userId, postId, msg);
      break;
  }

  // const post = await Post.create({ userId: userId, content: msg.content });
  // TODO: Add post to cache
  await Fanout.pushToNewsFeed(userId, post.get()); // TODO: Implement it
  return post.get();
}

async function archivePost(userId, postId, msg) {
  if (!postId) return null; // TODO: Throw an exception

  let post = await Post.findByPk(postId);
  if (!post) return null; // TODO: Throw an exception
  if (post.getDataValue('postStatus') === PostStatusEnum.draft) return null; // TODO: Throw an exception
  post.content = msg.content; // TODO: If the content is empty, check if there are no attachments or not
  post.postStatus = PostStatusEnum.archived;
  return await post.save();
}

async function savePostAsDraft(userId, postId, msg) {
  if (!postId)
    return await Post.create({
      userId: userId,
      content: msg.content,
      postStatus: PostStatusEnum.draft,
    });

  let post = await Post.findByPk(postId);
  if (!post) return null;
  if (post.getDataValue('postStatus') !== PostStatusEnum.draft) return null; // throw an exception

  post.content = msg.content;
  return await post.save();
}

async function publishPost(userId, postId, msg) {
  if (!postId) {
    if (!isBlank(msg.content))
      return await Post.create({
        content: msg.content,
        userId: userId,
        postStatus: PostStatusEnum.published,
      });

    return null; // TODO: Throw an exception
  } else {
    if (!isBlank(msg.content)) {
      const [affectRowCount] =  await Post.update(
        { content: msg.content, postStatus: PostStatusEnum.published },
        { where: { id: postId, userId: userId } }
      );
      return affectRowCount > 0 ? await Post.findByPk(postId) : null;
    }

    let post = await Post.findByPk(postId, {
      include: [{ model: PostAttachment, include: Attachment }],
    });

    if (!post) return null;
    if (post.getDataValue('userId') !== userId) return null; // TODO: Throw an exception
    if (post.getDataValue('PostAttachments').length == 0) return null; // TODO: Throw an exception

    const oldPostStatus = post.getDataValue('postStatus');
    post.set({ content: msg.content, postStatus: PostStatusEnum.published });
    const updatedPost = await post.save();
    if (oldPostStatus == PostStatusEnum.draft) {
      // TODO: Push to newsfeed 
      await Fanout.pushToNewsFeed(userId, updatedPost);
    }
    return updatedPost;
  }
}

async function addPost(userId, msg) {
  let urls = await Promise.all(
    msg.media.map(async (file) => {
      const { createReadStream, filename, mimetype, encoding } = await file;

      const fileExtension = parseFileExtension(filename);
      if (!isValidMedia(fileExtension)) {
        // TODO: Throw error
        throw new Error('Invalid media type');
      }

      const newFilename = uuidv4() + '_' + Date.now() + fileExtension; // generates a unique filename

      const stream = createReadStream();
      const out = fs.createWriteStream(
        path.join(__dirname, `/../FileUpload/Posts/${newFilename}`)
      );
      stream.pipe(out);
      await finished(out);
      return `http://localhost:3000/FileUpload/Posts/${newFilename}`;
    })
  );

  if (!urls && msg.content.trim().length === 0) {
    // TODO: Throw Error
    throw new Error('Empty Post');
  }

  try {
    await driverSession.run(
      `
    CREATE (
    MATCH (person:PERSON) WHERE ID(person) = $userId 
    CREATE (post:POST {post.content: $content, post.media: $media, post.creationDate: timestamp()})<-[POSTS]- (person)`,
      { userId: userId, content: msg.content, media: urls }
    );
    return true;
  } catch (e) {
    console.error('ERROR: ' + e);
    console.error('ERROR_CODE: ' + e.code);
    return false;
  }
}

async function getSliceOfUserPosts(userId, size, offset) {
  try {
    let res = await driverSession.run(
      `
                MATCH (person:PERSON) WHERE ID(person) = $userId
                MATCH (person) -[POSTS]-> (post:POST)
                RETURN post
                SKIP $offset
                LIMIT $size
            `,
      { userId: userId, offset: offset, size: size }
    );

    return res.records.map((record) => record._fields[0].properties);
  } catch (e) {
    console.error('ERROR: ' + e);
    console.error('ERROR_CODE: ' + e.code);
  }
}

async function getSliceOfPostComments(postId, size, offset) {
  try {
    let res = driverSession.run(
      `
            MATCH (post:POST) WHERE ID(post) = $postId
            MATCH (comment:COMMENT) -[COMMENTS_ON]-> (post)
            RETURN comment
            SKIP $offset
            LIMIT $size
        `,
      { postId: postId, offset: offset, size: size }
    );
    return res.records.map((record) => record._fields[0].properties);
  } catch (e) {
    console.error('ERROR: ' + e);
    console.error('ERROR_CODE: ' + e.code);
  }
}

async function findPostByCommentId(commentId) {
  try {
    let res = await driverSession.run(
      `
            MATCH (comment:COMMENT) WHERE ID(comment) = $commentId
            MATCH (comment) -[COMMENTS_ON]->(post:POST)
            RETURN post`
    );
    return res.records.map((record) => record._fields[0].properties);
  } catch (e) {
    console.error('ERROR: ' + e);
    console.error('ERROR_CODE: ' + e.code);
    //TODO: Handle Error
  }
}

module.exports = {
  addPost,
  findPostById,
  deletePostById,
  getSliceOfPostComments,
  findPostByCommentId,
  getSliceOfUserPosts,
  fetchNewsfeed,

  savePost,
  archivePost,
  savePostAsDraft,
  publishPost,
  findPost
};
