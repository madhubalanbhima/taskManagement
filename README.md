# Task Management

Express, TypeScript, and MongoDB task management app.

## Requirements

- Node.js 20 or later
- A MongoDB instance (local or MongoDB Atlas)

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` to your MongoDB connection string and replace `JWT_SECRET` with a long, random secret.
4. Start the development server with `npm run dev`, or build and run it with `npm run build` and `npm start`.

The server seeds the initial roles, positions, statuses, and demo accounts only when the roles collection is empty. Demo accounts use mobile numbers `9000000001`, `9000000002`, and `9000000003`, with password `1234`. Change or remove these accounts before exposing a deployment publicly.

## API

The existing API paths are preserved: `/api/login`, `/api/me`, `/api/roles`, `/api/positions`, `/api/statuses`, `/api/users`, `/api/lookup/users`, and `/api/tasks`.

SQLite data in `tasks.db` is not automatically imported. Export or migrate existing records separately before switching deployments.
