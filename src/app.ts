import path from 'path';
import express from 'express';
import authRoutes from './routes/authRoutes';
import { createCatalogRouter } from './routes/catalogRoutes';
import taskRoutes from './routes/taskRoutes';
import userRoutes from './routes/userRoutes';
import { asyncHandler, errorHandler } from './middleware/errors';
import { auth } from './middleware/auth';
import { lookupUsers } from './controllers/userController';

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../public')));

app.use('/api', authRoutes);
app.use('/api/roles', createCatalogRouter('roles'));
app.use('/api/positions', createCatalogRouter('positions'));
app.use('/api/statuses', createCatalogRouter('statuses'));
app.use('/api/users', userRoutes);
app.get('/api/lookup/users', auth, asyncHandler(lookupUsers));
app.use('/api/tasks', taskRoutes);

app.use(errorHandler);

export default app;
