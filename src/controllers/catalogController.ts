import { Request, Response } from 'express';
import { Model } from 'mongoose';
import { CatalogRecord, Position, Role, Status } from '../models/catalog';
import { Task } from '../models/task';
import { User } from '../models/user';

type CatalogName = 'roles' | 'positions' | 'statuses';
const models: Record<CatalogName, Model<CatalogRecord>> = {
  roles: Role,
  positions: Position,
  statuses: Status,
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function catalogController(kind: CatalogName) {
  const Catalog = models[kind];
  return {
    list: async (req: Request, res: Response): Promise<void> => {
      const q = String(req.query.q || '');
      const records = await Catalog.find(q ? { name: new RegExp(escapeRegex(q), 'i') } : {})
        .sort({ _id: 1 });
      res.json(records.map(record => ({ id: record.id, name: record.name })));
    },
    create: async (req: Request, res: Response): Promise<void> => {
      const name = String(req.body.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      const record = await Catalog.create({ name });
      res.json({ id: record.id });
    },
    update: async (req: Request, res: Response): Promise<void> => {
      const name = String(req.body.name || '').trim();
      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      const record = await Catalog.findByIdAndUpdate(req.params.id, { name }, { new: true, runValidators: true });
      if (!record) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json({ ok: true });
    },
    remove: async (req: Request, res: Response): Promise<void> => {
      const id = req.params.id;
      const inUse = kind === 'roles'
        ? await User.exists({ roleId: id })
        : kind === 'positions'
          ? await User.exists({ positionId: id })
          : await Task.exists({ statusId: id });
      if (inUse) {
        res.status(400).json({ error: 'Item is in use' });
        return;
      }
      await Catalog.findByIdAndDelete(id);
      res.json({ ok: true });
    },
  };
}
