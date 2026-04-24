import { Router } from 'express';
import { body } from 'express-validator';
import { validateJwtCookie } from '../../common/middlewares/validateJwtCookie';
import { requirePortalRole } from '../../common/middlewares/requirePortalRole';
import { listLogs, trackExternalEvent } from './controllers/audit.controller';

const router = Router();

// /api/audit/logs é interno para Admins
router.get('/logs', validateJwtCookie, requirePortalRole(['ADMINISTRADOR']), listLogs);

// /api/audit/track é para chamadas cross-server s2s ou das tools validadas
// Por hora, blindado no endpoint. Na fase final terá chave própria ou whitelist IP.
router.post('/track', [
    body('toolSlug').notEmpty(),
    body('userId').notEmpty().isUUID(),
    body('action').notEmpty()
], validateJwtCookie, trackExternalEvent);

export default router;
