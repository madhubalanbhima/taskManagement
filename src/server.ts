import 'dotenv/config';
import app from './app';
import { connectDatabase } from './database';

async function start(): Promise<void> {
  await connectDatabase();

  const port = Number(process.env.PORT || 3001);
  app.listen(port, () => console.log(`Task Manager running on port http://localhost:${port}`));
}

start().catch(error => {
  console.error('Failed to start Task Manager:', error);
  process.exitCode = 1;
});
