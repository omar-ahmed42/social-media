const { createClient } = require('redis');

const redisClient = createClient({
  socket: { host: process.env.REDIS_HOST, port: process.env.REDIS_PORT },
});
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('ready', () => console.log('Redis is ready'));

async function connectToRedis(redisClient) {
  await redisClient.connect();
}

module.exports = {
  redisClient,
  connectToRedis,
};
