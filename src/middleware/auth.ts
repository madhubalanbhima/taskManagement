import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { Role } from '../models/catalog';
import { User } from '../models/user';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    roleId: string;
    active: boolean;
    role: string;
  };
  isAdmin?: boolean;
  isMgr?: boolean;
}

export async function auth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next(new Error('JWT_SECRET is not configured'));
    return;
  }

  let payload: jwt.JwtPayload;
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    payload = decoded;
    if (typeof payload === 'string' || !payload.id || !Types.ObjectId.isValid(payload.id)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const user = await User.findById(payload.id).select('name roleId active');
    if (!user || !user.active) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const role = await Role.findById(user.roleId).select('name');
    if (!role) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.user = {
      id: user.id,
      name: user.name,
      roleId: user.roleId.toString(),
      active: user.active,
      role: role.name,
    };
    req.isAdmin = role.name.toLowerCase() === 'admin';
    req.isMgr = role.name.toLowerCase() === 'manager';
    next();
  } catch (error) {
    next(error);
  }
}

export function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.isAdmin) {
    next();
    return;
  }
  res.status(403).json({ error: 'Admin only' });
}
