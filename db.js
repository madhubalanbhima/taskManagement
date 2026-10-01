const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database(process.env.DB_FILE || 'tasks.db');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS roles(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS positions(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS statuses(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, mobile TEXT UNIQUE NOT NULL,
  roleId INTEGER NOT NULL REFERENCES roles(id), positionId INTEGER NOT NULL REFERENCES positions(id),
  address TEXT DEFAULT '', password TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '',
  assigneeId INTEGER REFERENCES users(id), statusId INTEGER NOT NULL REFERENCES statuses(id),
  due TEXT DEFAULT '', createdBy INTEGER REFERENCES users(id));
`);
if (!db.prepare('SELECT COUNT(*) c FROM roles').get().c) {
  for (const r of ['Admin', 'Manager', 'Employee']) db.prepare('INSERT INTO roles(name) VALUES(?)').run(r);
  for (const p of ['Director', 'Team Lead', 'Developer']) db.prepare('INSERT INTO positions(name) VALUES(?)').run(p);
  for (const s of ['To Do', 'In Progress', 'Done']) db.prepare('INSERT INTO statuses(name) VALUES(?)').run(s);
  const pw = bcrypt.hashSync('1234', 10);
  const u = db.prepare('INSERT INTO users(name,mobile,roleId,positionId,address,password) VALUES(?,?,?,?,?,?)');
  u.run('Admin User', '9000000001', 1, 1, 'HQ', pw);
  u.run('Mia Manager', '9000000002', 2, 2, 'Kollam', pw);
  u.run('Eli Employee', '9000000003', 3, 3, 'Kochi', pw);
}
module.exports = db;
