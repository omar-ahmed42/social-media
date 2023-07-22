const { RedisPubSub } = require('graphql-redis-subscriptions');

const pubsub = new RedisPubSub({
  connection: {
    host: process.env.PUBSUB_HOST,
    port: process.env.PUBSUB_PORT,
  },
});

module.exports = {
  pubsub,
};
