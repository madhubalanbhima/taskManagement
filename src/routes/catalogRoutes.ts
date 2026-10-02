import { Router } from 'express';
import { catalogController } from '../controllers/catalogController';
import { adminOnly, auth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';

export function createCatalogRouter(kind: 'roles' | 'positions' | 'statuses'): Router {
  const router = Router();
  const controller = catalogController(kind);
  router.get('/', asyncHandler(controller.list));
  router.post('/', auth, adminOnly, asyncHandler(controller.create));
  router.put('/:id', auth, adminOnly, asyncHandler(controller.update));
  router.delete('/:id', auth, adminOnly, asyncHandler(controller.remove));
  return router;
}
