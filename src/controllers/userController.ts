import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { Role } from '../models/catalog';
import { Task } from '../models/task';
import { User } from '../models/user';
import { AuthenticatedRequest } from '../middleware/auth';

function userResponse(user: InstanceType<typeof User>) {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    roleId: user.roleId?.toString() ?? null,
    positionId: user.positionId?.toString() ?? null,
    address: user.address,
    active: user.active,
  };
}

export async function lookupUsers(_req: Request, res: Response): Promise<void> {
  const users = await User.find({ active: true }).select('name').sort({ name: 1 });
  res.json(users.map(user => ({ id: user.id, name: user.name })));
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q || '');
  const filter: Record<string, unknown> = q
    ? { $or: [{ name: new RegExp(escapeRegex(q), 'i') }, { mobile: new RegExp(escapeRegex(q), 'i') }] }
    : {};
  if (req.query.roleId) filter.roleId = req.query.roleId;
  const users = await User.find(filter).select('name mobile roleId positionId address active').sort({ _id: -1 });
  res.json(users.map(userResponse));
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const { name, mobile, password } = req.body;
  if (!name || !mobile || !password) {
    res.status(400).json({ error: 'Name, mobile and password are required' });
    return;
  }
  const user = await User.create({
    name,
    mobile,
    roleId: req.body.roleId,
    positionId: req.body.positionId,
    address: req.body.address || '',
    password: await bcrypt.hash(String(password), 10),
    active: Boolean(req.body.active),
  });
  res.json({ id: user.id });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const update: Record<string, unknown> = {
    name: req.body.name,
    mobile: req.body.mobile,
    roleId: req.body.roleId,
    positionId: req.body.positionId,
    address: req.body.address || '',
    active: Boolean(req.body.active),
  };
  if (req.body.password) update.password = await bcrypt.hash(String(req.body.password), 10);
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!user) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ ok: true });
}

export async function deleteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (req.params.id === req.user?.id) {
    res.status(400).json({ error: 'You cannot delete your own account' });
    return;
  }
  const id = new Types.ObjectId(req.params.id);
  if (await Task.exists({ $or: [{ assigneeId: id }, { createdBy: id }] })) {
    res.status(400).json({ error: 'Item is in use' });
    return;
  }
  await User.findByIdAndDelete(id);
  res.json({ ok: true });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
