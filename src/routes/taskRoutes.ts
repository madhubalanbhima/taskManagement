import { Router } from 'express';
import { addTaskComment, createTask, deleteTask, listTasks, updateTask, updateTaskStatus } from '../controllers/taskController';
import { auth, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errors';

const router = Router();
router.use(auth);

router.get('/', asyncHandler((req, res) => listTasks(req as AuthenticatedRequest, res)));
router.post('/', asyncHandler((req, res) => createTask(req as AuthenticatedRequest, res)));
router.put('/:id', asyncHandler((req, res) => updateTask(req as AuthenticatedRequest, res)));
router.patch('/:id/status', asyncHandler((req, res) => updateTaskStatus(req as AuthenticatedRequest, res)));
router.post('/:id/comments', asyncHandler((req, res) => addTaskComment(req as AuthenticatedRequest, res)));
router.delete('/:id', asyncHandler((req, res) => deleteTask(req as AuthenticatedRequest, res)));

export default router;
