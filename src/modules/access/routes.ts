import { Router } from 'express';
import { body } from 'express-validator';
import { validateJwtCookie } from '../../common/middlewares/validateJwtCookie';
import { requirePortalRole } from '../../common/middlewares/requirePortalRole';
import { grantAccess, revokeAccess, getUserAccesses, getToolUsers, bulkGrantAccess, listRoles } from './controllers/access.controller';
import { auditMiddleware } from '../../common/middlewares/auditMiddleware';

const router = Router();

router.use(validateJwtCookie);
router.use(requirePortalRole(['ADMINISTRADOR']));

router.get('/roles', listRoles);

router.post('/grant', [
  body('userId').notEmpty().isUUID(),
  body('toolId').notEmpty().isUUID(),
  body('toolRoleId').notEmpty().isUUID()
], auditMiddleware('ACCESS_GRANTED'), grantAccess);

router.post('/revoke', [
  body('userId').notEmpty().isUUID(),
  body('toolId').notEmpty().isUUID()
], auditMiddleware('ACCESS_REVOKED'), revokeAccess);

router.get('/user/:userId', getUserAccesses);
router.get('/tool/:toolId', getToolUsers);

router.post('/bulk-grant', [
  body('userIds').isArray(),
  body('toolId').notEmpty().isUUID(),
  body('toolRoleId').notEmpty().isUUID()
], auditMiddleware('BULK_ACCESS_GRANTED'), bulkGrantAccess);

export default router;
