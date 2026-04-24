import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import redis from '../../infra/cache/redis';

export const globalLimiter = rateLimit({
  store: new RedisStore({ 
    // @ts-ignore - Incompatibilidade de tipos entre ioredis e rate-limit-redis
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) 
  }),
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false, // Desativa todas as validações para evitar o erro de double count no dev
});

export const loginLimiter = rateLimit({
  store: new RedisStore({
    // @ts-ignore
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1))
  }),
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
