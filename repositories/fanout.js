const { Op } = require('sequelize');
const { redisClient } = require('../cache/client');
const { Post } = require('../models/post');
const { findAllFriends } = require('./friendRepo');
const { savePostModelToCache } = require('./postRepo');

const MAX_NEWSFEED_SIZE = 150;

async function pushToNewsFeed(userId, postId) {
  try {
    let friends = await findAllFriends(userId);

    if (!friends?.length) return 0;

    for (let friend of friends) {
      redisClient
        .multi()
        .LPUSH(`newsfeed:${friend.id.toString()}`, postId.toString())
        .LTRIM(`newsfeed:${friend.id.toString()}`, 0, MAX_NEWSFEED_SIZE)
        .exec();
    }
  } catch (err) {
    console.err('An error has occurred during pushing to newsfeed:', err);
  }
}

async function fetchNewsfeed(userId) {
  let postsIds = await redisClient.LRANGE(`newsfeed:${userId.toString()}`, 0, -1);
  let posts = [];
  for (let postId of postsIds) {
    posts.push(await getAndSetPost(userId, postId));
  };

  return posts;
}

async function getAndSetPost(userId, postId) {
  let post = await redisClient.json.GET(`post:${postId.toString()}`);
  if (post) return post;

  post = await Post.findByPk(postId, {
    include: [{ model: PostAttachment, include: Attachment }],
  });

  return await savePostModelToCache(post);
}

module.exports = {
  pushToNewsFeed,
  fetchNewsfeed,
};
