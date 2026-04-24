import { Router } from 'express';
import { body } from 'express-validator';
import { validateJwtCookie } from '../../common/middlewares/validateJwtCookie';
import { requirePortalRole } from '../../common/middlewares/requirePortalRole';
import { createTool, listTools, getToolById, updateTool, updateToolStatus, deleteTool, uploadToolIcon, serveToolIcon } from './controllers/tool.controller';
import { auditMiddleware } from '../../common/middlewares/auditMiddleware';
import { uploadIcon } from '../../config/multer';

const router = Router();

router.use(validateJwtCookie);
router.use(requirePortalRole(['ADMINISTRADOR']));

router.get('/', listTools);
router.get('/:id', getToolById);
router.get('/:id/serve-icon', serveToolIcon);

router.post('/', [
  body('name').notEmpty(),
  body('slug').notEmpty(),
  body('url').isURL(),
  body('category').notEmpty(),
], auditMiddleware('TOOL_CREATED'), createTool);

router.put('/:id', [
  body('name').notEmpty(),
  body('url').isURL(),
], auditMiddleware('TOOL_UPDATED'), updateTool);

router.patch('/:id/status', [
  body('status').isIn(['ACTIVE', 'INACTIVE'])
], auditMiddleware('TOOL_STATUS_UPDATED'), updateToolStatus);

router.post('/:id/icon', uploadIcon.single('icon'), auditMiddleware('TOOL_ICON_UPDATED'), uploadToolIcon);

router.delete('/:id', auditMiddleware('TOOL_DELETED'), deleteTool);

export default router;
