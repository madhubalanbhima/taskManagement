import { Request, Response } from 'express';
import { vercelHandler } from '../../src/vercelHandler';

export default function handler(req: Request, res: Response): Promise<void> {
  return vercelHandler(req, res);
}
