import { Request, Response } from 'express';
import app from './app';
import { connectDatabase } from './database';

export async function vercelHandler(req: Request, res: Response): Promise<void> {
  try {
    await connectDatabase();
  } catch (error) {
    console.error('Failed to initialize database for API request:', error);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Service unavailable' }));
    return;
  }

  const requestUrl = req.url || '/';
  const pathname = requestUrl.split('?', 1)[0];
  if (pathname !== '/api' && !pathname.startsWith('/api/')) {
    req.url = `/api${requestUrl.startsWith('/') ? '' : '/'}${requestUrl}`;
  }

  app(req, res);
}
