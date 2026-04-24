import redis from '../../../infra/cache/redis';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const addToBlacklist = async (jti: string, expTimestamp: number): Promise<void> => {
  const expiresInSeconds = Math.max(0, Math.floor(expTimestamp - Date.now() / 1000));
  
  if (expiresInSeconds === 0) return;

  let redisSuccess = false;
  try {
    if (redis.status === 'ready' || redis.status === 'connecting') {
      await redis.set(`blacklist:jti:${jti}`, 'true', 'EX', expiresInSeconds);
      redisSuccess = true;
    }
  } catch (error) {
    console.warn('Redis error writing to blacklist, falling back to database', error);
  }

  // Fallback to PostgreSQL
  try {
    await prisma.tokenBlacklist.create({
      data: {
        jti,
        exp: new Date(expTimestamp * 1000)
      }
    });
  } catch (err: any) {
    if (err.code !== 'P2002') { // Ignore unique constraint if already saved
      console.error('Error saving to Postgres token_blacklist', err);
    }
  }
};

export const isBlacklisted = async (jti: string): Promise<boolean> => {
  try {
    if (redis.status === 'ready') {
      const exists = await redis.get(`blacklist:jti:${jti}`);
      if (exists) return true;
    }
  } catch (error) {
    console.warn('Redis error reading blacklist, checking database', error);
  }

  try {
    const entry = await prisma.tokenBlacklist.findUnique({
      where: { jti }
    });
    return !!entry;
  } catch (err) {
    console.error('Error reading Postgres token_blacklist', err);
    return false;
  }
};
