const { Schema, Repository } = require('redis-om');
const { redisClient } = require('../client');

const postSchema = new Schema('comment', {
  id: { type: 'string' },
  content: { type: 'text' },
  createdAt: { type: 'date' },
  lastModifiedAt: { type: 'date' },
  commentAttachments: { type: 'string[]' },
  postId: { type: 'string' },
  userId: { type: 'string' },
});

const commentCacheRepository = new Repository(commentSchema, redisClient);

module.exports = {
  commentCacheRepository,
};
