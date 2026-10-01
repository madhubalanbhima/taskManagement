const express = require('express'), jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs'), path = require('path');
const db = require('./db');
const SECRET = process.env.JWT_SECRET || 'change-this-secret';
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const wrap = fn => (req, res) => {
  try { fn(req, res); } catch (e) {
    const m = String(e.message);
    res.status(400).json({ error: m.includes('UNIQUE') ? 'Already exists' : m.includes('FOREIGN KEY') ? 'Item is in use' : m });
  }
};
const auth = (req, res, next) => {
  try {
    const { id } = jwt.verify((req.headers.authorization || '').slice(7), SECRET);
    const u = db.prepare('SELECT u.id,u.name,u.roleId,u.active,r.name role FROM users u JOIN roles r ON r.id=u.roleId WHERE u.id=?').get(id);
    if (!u || !u.active) throw 0;
    req.user = u; req.isAdmin = u.role.toLowerCase() === 'admin'; req.isMgr = u.role.toLowerCase() === 'manager';
    next();
  } catch { res.status(401).json({ error: 'Unauthorized' }); }
};
const adminOnly = (req, res, next) => req.isAdmin ? next() : res.status(403).json({ error: 'Admin only' });
const like = q => `%${q || ''}%`;

// ---- Auth
app.post('/api/login', wrap((req, res) => {
  const { mobile, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE mobile=?').get(String(mobile || '').trim());
  if (!u || !bcrypt.compareSync(String(password || ''), u.password)) return res.status(401).json({ error: 'Invalid mobile or password' });
  if (!u.active) return res.status(403).json({ error: 'Account is inactive' });
  res.json({ token: jwt.sign({ id: u.id }, SECRET, { expiresIn: '12h' }) });
}));
app.get('/api/me', auth, (req, res) => res.json(req.user));

// ---- Roles / Positions / Statuses
for (const t of ['roles', 'positions', 'statuses']) {
  app.get(`/api/${t}`, auth, wrap((req, res) => res.json(db.prepare(`SELECT * FROM ${t} WHERE name LIKE ? ORDER BY id`).all(like(req.query.q)))));
  app.post(`/api/${t}`, auth, adminOnly, wrap((req, res) => {
    const r = db.prepare(`INSERT INTO ${t}(name) VALUES(?)`).run(String(req.body.name || '').trim());
    res.json({ id: r.lastInsertRowid });
  }));
  app.put(`/api/${t}/:id`, auth, adminOnly, wrap((req, res) => {
    db.prepare(`UPDATE ${t} SET name=? WHERE id=?`).run(String(req.body.name || '').trim(), req.params.id); res.json({ ok: true });
  }));
  app.delete(`/api/${t}/:id`, auth, adminOnly, wrap((req, res) => { db.prepare(`DELETE FROM ${t} WHERE id=?`).run(req.params.id); res.json({ ok: true }); }));
}

// ---- Users
const userRow = u => ({ ...u, active: !!u.active });
app.get('/api/lookup/users', auth, (req, res) => res.json(db.prepare('SELECT id,name FROM users WHERE active=1 ORDER BY name').all()));
app.get('/api/users', auth, adminOnly, wrap((req, res) => {
  let sql = 'SELECT id,name,mobile,roleId,positionId,address,active FROM users WHERE (name LIKE ? OR mobile LIKE ?)';
  const p = [like(req.query.q), like(req.query.q)];
  if (req.query.roleId) { sql += ' AND roleId=?'; p.push(req.query.roleId); }
  res.json(db.prepare(sql + ' ORDER BY id DESC').all(...p).map(userRow));
}));
app.post('/api/users', auth, adminOnly, wrap((req, res) => {
  const b = req.body;
  if (!b.name || !b.mobile || !b.password) throw new Error('Name, mobile and password are required');
  const r = db.prepare('INSERT INTO users(name,mobile,roleId,positionId,address,password,active) VALUES(?,?,?,?,?,?,?)')
    .run(b.name, b.mobile, b.roleId, b.positionId, b.address || '', bcrypt.hashSync(b.password, 10), b.active ? 1 : 0);
  res.json({ id: r.lastInsertRowid });
}));
app.put('/api/users/:id', auth, adminOnly, wrap((req, res) => {
  const b = req.body;
  db.prepare('UPDATE users SET name=?,mobile=?,roleId=?,positionId=?,address=?,active=? WHERE id=?')
    .run(b.name, b.mobile, b.roleId, b.positionId, b.address || '', b.active ? 1 : 0, req.params.id);
  if (b.password) db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(b.password, 10), req.params.id);
  res.json({ ok: true });
}));
app.delete('/api/users/:id', auth, adminOnly, wrap((req, res) => {
  if (+req.params.id === req.user.id) throw new Error('You cannot delete your own account');
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id); res.json({ ok: true });
}));

// ---- Tasks
const visible = req => (req.isAdmin || req.isMgr) ? ['1=1', []] : ['(assigneeId=? OR createdBy=?)', [req.user.id, req.user.id]];
const canEdit = (req, t) => req.isAdmin || req.isMgr || t.createdBy === req.user.id;
app.get('/api/tasks', auth, wrap((req, res) => {
  const [v, p] = visible(req);
  let sql = `SELECT * FROM tasks WHERE ${v} AND title LIKE ?`; p.push(like(req.query.q));
  if (req.query.statusId) { sql += ' AND statusId=?'; p.push(req.query.statusId); }
  res.json(db.prepare(sql + ' ORDER BY id DESC').all(...p));
}));
app.post('/api/tasks', auth, wrap((req, res) => {
  const b = req.body, assignee = (req.isAdmin || req.isMgr) ? b.assigneeId : req.user.id;
  if (!b.title) throw new Error('Task name is required');
  const r = db.prepare('INSERT INTO tasks(title,description,assigneeId,statusId,due,createdBy) VALUES(?,?,?,?,?,?)')
    .run(b.title, b.description || '', assignee, b.statusId, b.due || '', req.user.id);
  res.json({ id: r.lastInsertRowid });
}));
app.put('/api/tasks/:id', auth, wrap((req, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if (!t || !canEdit(req, t)) return res.status(403).json({ error: 'Not allowed' });
  const b = req.body, assignee = (req.isAdmin || req.isMgr) ? b.assigneeId : t.assigneeId;
  db.prepare('UPDATE tasks SET title=?,description=?,assigneeId=?,statusId=?,due=? WHERE id=?')
    .run(b.title, b.description || '', assignee, b.statusId, b.due || '', t.id);
  res.json({ ok: true });
}));
app.patch('/api/tasks/:id/status', auth, wrap((req, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if (!t || !(req.isAdmin || req.isMgr || t.assigneeId === req.user.id || t.createdBy === req.user.id)) return res.status(403).json({ error: 'Not allowed' });
  db.prepare('UPDATE tasks SET statusId=? WHERE id=?').run(req.body.statusId, t.id); res.json({ ok: true });
}));
app.delete('/api/tasks/:id', auth, wrap((req, res) => {
  const t = db.prepare('SELECT * FROM tasks WHERE id=?').get(req.params.id);
  if (!t || !canEdit(req, t)) return res.status(403).json({ error: 'Not allowed' });
  db.prepare('DELETE FROM tasks WHERE id=?').run(t.id); res.json({ ok: true });
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Task Manager running on http://localhost:${PORT}`));
