const { Schema, Repository } = require('redis-om');
const { redisClient } = require('../client');

const postSchema = new Schema('post', {
  id: { type: 'string' },
  content: { type: 'text' },
  createdAt: { type: 'date' },
  lastModifiedAt: { type: 'date' },
  postAttachments: { type: 'string[]' },
  userId: { type: 'string' },
});

const postCacheRepository = new Repository(postSchema, redisClient);

module.exports = {
  postCacheRepository,
};
