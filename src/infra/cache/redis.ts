import { Redis } from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(redisUrl, {
  password: process.env.REDIS_PASSWORD || undefined, // Allow secure connections
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) {
      console.warn('Redis reconnection failed after 3 attempts. Falling back to DB if needed...');
      return null;
    }
    return Math.min(times * 50, 2000); // Backoff strategy
  },
});

redis.on('error', (err) => {
  console.error('Redis Connection Error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected successfully.');
});

export default redis;
