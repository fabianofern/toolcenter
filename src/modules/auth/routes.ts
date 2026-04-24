import { Router } from 'express';
import { body } from 'express-validator';
import { login, logout, refresh, jwks, forcePasswordChange } from './controllers/auth.controller';
import { validateJwtCookie } from '../../common/middlewares/validateJwtCookie';
import { auditMiddleware } from '../../common/middlewares/auditMiddleware';

const router = Router();

import { loginLimiter } from '../../common/middlewares/rateLimiter';

router.post('/login', loginLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], auditMiddleware('LOGIN_SUCCESS'), login);

router.post('/logout', validateJwtCookie, auditMiddleware('LOGOUT'), logout);

router.post('/refresh', validateJwtCookie, refresh);

router.post('/force-password-change', [
  body('userId').isString().notEmpty(),
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isString().notEmpty(),
], forcePasswordChange);

router.get('/jwks.json', jwks);

export default router;
