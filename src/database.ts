import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Position, Role, Status } from './models/catalog';
import { User } from './models/user';

let connectionPromise: Promise<void> | null = null;

async function seedDefaults(): Promise<void> {
  if (await Role.exists({})) return;

  const roles = await Role.create([
    { name: 'Admin' },
    { name: 'Manager' },
    { name: 'Employee' },
  ]);
  const positions = await Position.create([
    { name: 'Managing Director' },
    { name: 'Team Lead' },
    { name: 'Developer' },
  ]);
  await Status.create([
    { name: 'To Do' },
    { name: 'In Progress' },
    { name: 'Done' },
  ]);
  const password = await bcrypt.hash('1234', 10);
  await User.create([
    { name: 'Admin User', mobile: '9000000001', roleId: roles[0]._id, positionId: positions[0]._id, address: 'HQ', password },
    { name: 'Mahalakshmi', mobile: '9000000002', roleId: roles[1]._id, positionId: positions[1]._id, address: 'Kollam', password },
    { name: 'Madhubalan', mobile: '9000000003', roleId: roles[2]._id, positionId: positions[2]._id, address: 'Kochi', password },
  ]);
}

async function removeObsoleteEmailIndex(): Promise<void> {
  const indexes = await User.collection.indexes();
  if (indexes.some(index => index.name === 'email_1')) {
    await User.collection.dropIndex('email_1');
  }
}

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const uri = process.env.MONGODB_URI;
      if (!uri) throw new Error('MONGODB_URI is required');
      if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');

      await mongoose.connect(uri);
      await removeObsoleteEmailIndex();
      await seedDefaults();
    })();
  }

  const pendingConnection = connectionPromise;
  try {
    await pendingConnection;
  } finally {
    if (connectionPromise === pendingConnection) connectionPromise = null;
  }
}
