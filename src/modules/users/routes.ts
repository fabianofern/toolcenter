import { Router } from 'express';
import { listUsers, getUserContext, createUser, updateUser, resetPassword, deleteUser } from './controllers/user.controller';
import { validateJwtCookie } from '../../common/middlewares/validateJwtCookie';
import { requirePortalRole } from '../../common/middlewares/requirePortalRole';
import { auditMiddleware } from '../../common/middlewares/auditMiddleware';
import { verifyOwnershipOrAdmin } from '../../common/middlewares/verifyOwnershipOrAdmin';
import { body } from 'express-validator';

const router = Router();

// Todas as rotas de usuários exigem JWT e Role de ADMIN
router.use(validateJwtCookie);
router.use(requirePortalRole(['ADMINISTRADOR']));

router.get('/', listUsers);
router.get('/:id', getUserContext);

router.post('/', [
  body('email').isEmail().normalizeEmail(),
  body('name').notEmpty(),
  body('portal_role_id').notEmpty(),
], auditMiddleware('USER_CREATED'), createUser);

router.put('/:id', verifyOwnershipOrAdmin, auditMiddleware('USER_UPDATED'), updateUser);

router.patch('/:id/reset-password', verifyOwnershipOrAdmin, auditMiddleware('PASSWORD_RESET'), resetPassword);

router.delete('/:id', verifyOwnershipOrAdmin, auditMiddleware('USER_DELETED'), deleteUser);

export default router;
