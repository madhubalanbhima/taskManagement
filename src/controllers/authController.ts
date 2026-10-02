import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role } from '../models/catalog';
import { User } from '../models/user';

export async function login(req: Request, res: Response): Promise<void> {
  const mobile = String(req.body.mobile || '').trim();
  const password = String(req.body.password || '');
  const user = await User.findOne({ mobile }).select('+password');
  if (!user || !await bcrypt.compare(password, user.password)) {
    res.status(401).json({ error: 'Invalid mobile or password' });
    return;
  }
  if (!user.active) {
    res.status(403).json({ error: 'Account is inactive' });
    return;
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  res.json({ token: jwt.sign({ id: user.id }, secret, { expiresIn: '12h' }) });
}

export async function currentUser(req: Request, res: Response): Promise<void> {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = await User.findById(userId).select('name roleId active');
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const role = await Role.findById(user.roleId).select('name');
  if (!role) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json({ id: user.id, name: user.name, roleId: user.roleId.toString(), active: user.active, role: role.name });
}
