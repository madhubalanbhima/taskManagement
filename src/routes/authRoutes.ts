import { Router } from 'express';
import { currentUser, login } from '../controllers/authController';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';

const router = Router();

router.post('/login', asyncHandler(login));
router.get('/me', auth, asyncHandler(currentUser));

export default router;
