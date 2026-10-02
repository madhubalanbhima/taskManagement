import { Router } from 'express';
import { createUser, deleteUser, listUsers, updateUser } from '../controllers/userController';
import { adminOnly, auth, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';

const router = Router();
router.use(auth);

router.get('/', adminOnly, asyncHandler(listUsers));
router.post('/', adminOnly, asyncHandler(createUser));
router.put('/:id', adminOnly, asyncHandler(updateUser));
router.delete('/:id', adminOnly, asyncHandler((req, res) => deleteUser(req as AuthenticatedRequest, res)));

export default router;
