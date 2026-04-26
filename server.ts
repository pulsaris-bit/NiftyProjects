/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'nifty-secret-key-12345';
const PORT = 3000;

// Ensure data directory exists for database
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize Database in the data directory
const db = new Database(path.join(dataDir, 'database.sqlite'));
db.pragma('journal_mode = WAL');

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS spaces (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT,
    icon TEXT,
    color TEXT,
    columns TEXT, -- JSON string
    FOREIGN KEY (userId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    spaceId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    link TEXT,
    subtasks TEXT, -- JSON string
    attachments TEXT, -- JSON string
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (spaceId) REFERENCES spaces(id)
  );
`);

const app = express();
app.use(cors());
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Niet geautoriseerd' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Token ongeldig' });
    req.user = user;
    next();
  });
};

// --- Auth Routes ---

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, avatar } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user-${Date.now()}`;
    
    const stmt = db.prepare('INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)');
    stmt.run(userId, name, email, hashedPassword, avatar || '');

    // Create a default space for the new user
    const spaceStmt = db.prepare('INSERT INTO spaces (id, userId, name, emoji, icon, color, columns) VALUES (?, ?, ?, ?, ?, ?, ?)');
    spaceStmt.run(`space-${Date.now()}`, userId, 'Algemeen', '📁', 'Layers', '#FF5733', JSON.stringify(['Te doen', 'Bezig', 'Klaar']));

    const token = jwt.sign({ id: userId, email }, JWT_SECRET);
    res.json({ token, user: { id: userId, name, email, avatar } });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'E-mailadres al in gebruik' });
    }
    res.status(500).json({ error: 'Server fout' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: 'Ongeldige inloggegevens' });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
});

app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  const user: any = db.prepare('SELECT id, name, email, avatar FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// --- Data Routes ---

app.get('/api/spaces', authenticateToken, (req: any, res) => {
  const spaces = db.prepare('SELECT * FROM spaces WHERE userId = ?').all(req.user.id);
  res.json(spaces.map((s: any) => ({ ...s, columns: JSON.parse(s.columns || '[]') })));
});

app.post('/api/spaces', authenticateToken, (req: any, res) => {
  const { id, name, emoji, icon, color, columns } = req.body;
  const stmt = db.prepare('INSERT INTO spaces (id, userId, name, emoji, icon, color, columns) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(id, req.user.id, name, emoji, icon, color, JSON.stringify(columns));
  res.json({ success: true });
});

app.put('/api/spaces/:id', authenticateToken, (req: any, res) => {
  const { name, emoji, icon, color, columns } = req.body;
  const stmt = db.prepare('UPDATE spaces SET name = ?, emoji = ?, icon = ?, color = ?, columns = ? WHERE id = ? AND userId = ?');
  stmt.run(name, emoji, icon, color, JSON.stringify(columns), req.params.id, req.user.id);
  res.json({ success: true });
});

app.delete('/api/spaces/:id', authenticateToken, (req: any, res) => {
  // Use a transaction to ensure both space and tasks are deleted
  const deleteTasks = db.prepare('DELETE FROM tasks WHERE spaceId = ? AND userId = ?');
  const deleteSpace = db.prepare('DELETE FROM spaces WHERE id = ? AND userId = ?');
  
  const transaction = db.transaction(() => {
    deleteTasks.run(req.params.id, req.user.id);
    deleteSpace.run(req.params.id, req.user.id);
  });
  
  transaction();
  res.json({ success: true });
});

app.get('/api/tasks', authenticateToken, (req: any, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE userId = ?').all(req.user.id);
  res.json(tasks.map((t: any) => ({
    ...t,
    subtasks: JSON.parse(t.subtasks || '[]'),
    attachments: JSON.parse(t.attachments || '[]')
  })));
});

app.post('/api/tasks', authenticateToken, (req: any, res) => {
  const task = req.body;
  const stmt = db.prepare(`
    INSERT INTO tasks (id, userId, spaceId, title, description, status, priority, link, subtasks, attachments, createdAt) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    task.id, 
    req.user.id, 
    task.spaceId, 
    task.title, 
    task.description, 
    task.status, 
    task.priority, 
    task.link || '', 
    JSON.stringify(task.subtasks || []), 
    JSON.stringify(task.attachments || []),
    task.createdAt
  );
  res.json({ success: true });
});

app.put('/api/tasks/:id', authenticateToken, (req: any, res) => {
  const updates = req.body;
  // Dynamic update is tricky in SQLite with better-sqlite3 but for simplicity we'll just handle known fields or replace
  const current: any = db.prepare('SELECT * FROM tasks WHERE id = ? AND userId = ?').get(req.params.id, req.user.id);
  if (!current) return res.status(404).json({ error: 'Taak niet gevonden' });

  // Parse existing JSON fields before merging with updates to avoid double stringification
  current.subtasks = JSON.parse(current.subtasks || '[]');
  current.attachments = JSON.parse(current.attachments || '[]');

  const updated = { ...current, ...updates };
  const stmt = db.prepare(`
    UPDATE tasks 
    SET spaceId = ?, title = ?, description = ?, status = ?, priority = ?, link = ?, subtasks = ?, attachments = ?
    WHERE id = ? AND userId = ?
  `);
  stmt.run(
    updated.spaceId,
    updated.title,
    updated.description,
    updated.status,
    updated.priority,
    updated.link,
    JSON.stringify(updated.subtasks || []),
    JSON.stringify(updated.attachments || []),
    req.params.id,
    req.user.id
  );
  res.json({ success: true });
});

app.delete('/api/tasks/:id', authenticateToken, (req: any, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND userId = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

// Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server gestart op http://localhost:${PORT}`);
  });
}

startServer();
