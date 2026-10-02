import { NextFunction, Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.message === 'Already exists') {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.message === 'Item is in use') {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof Error && error.message.startsWith('E11000')) {
    res.status(400).json({ error: 'Already exists' });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
}
