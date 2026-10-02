import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { Task } from '../models/task';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = new Types.ObjectId(req.user!.id);
  const filter: Record<string, unknown> = {};
  if (!req.isAdmin && !req.isMgr) filter.assigneeId = userId;
  const q = String(req.query.q || '');
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');
  if (req.query.statusId) filter.statusId = req.query.statusId;
  const tasks = await Task.find(filter).sort({ _id: -1 });
  res.json(tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    assigneeId: task.assigneeId?.toString() ?? null,
    statusId: task.statusId.toString(),
    due: task.due,
    createdBy: task.createdBy.toString(),
    comments: (task.comments ?? []).map(comment => ({
      userId: comment.userId.toString(),
      userName: comment.userName,
      text: comment.text,
      createdAt: comment.createdAt,
    })),
  })));
}

export async function createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.isAdmin && !req.isMgr) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }
  const { title } = req.body;
  if (!title) {
    res.status(400).json({ error: 'Task name is required' });
    return;
  }
  const assigneeId = req.isAdmin || req.isMgr ? req.body.assigneeId : req.user!.id;
  const task = await Task.create({
    title,
    description: req.body.description || '',
    assigneeId: assigneeId || null,
    statusId: req.body.statusId,
    due: req.body.due || '',
    createdBy: req.user!.id,
  });
  res.json({ id: task.id });
}

export async function updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  const task = await Task.findById(req.params.id);
  if (!task || (!req.isAdmin && !req.isMgr)) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }
  task.title = req.body.title;
  task.description = req.body.description || '';
  if (req.isAdmin || req.isMgr) task.assigneeId = req.body.assigneeId || null;
  task.statusId = req.body.statusId;
  task.due = req.body.due || '';
  await task.save();
  res.json({ ok: true });
}

export async function updateTaskStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const task = await Task.findById(req.params.id);
  if (!task || !(req.isAdmin || req.isMgr || task.assigneeId?.toString() === req.user?.id)) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }
  task.statusId = req.body.statusId;
  await task.save();
  res.json({ ok: true });
}

export async function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.isAdmin) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }
  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }
  await task.deleteOne();
  res.json({ ok: true });
}

export async function addTaskComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  const text = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
  if (!text) {
    res.status(400).json({ error: 'Comment is required' });
    return;
  }

  const task = await Task.findById(req.params.id);
  if (!task || (!req.isAdmin && !req.isMgr && task.assigneeId?.toString() !== req.user?.id)) {
    res.status(403).json({ error: 'Not allowed' });
    return;
  }

  task.comments.push({
    userId: new Types.ObjectId(req.user!.id),
    userName: req.user!.name,
    text,
    createdAt: new Date(),
  });
  await task.save();
  res.json({ ok: true });
}
