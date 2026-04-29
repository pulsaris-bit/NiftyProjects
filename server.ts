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

if (JWT_SECRET === 'nifty-secret-key-12345') {
  console.warn('WAARSCHUWING: Er wordt een standaard JWT_SECRET gebruikt. Stel een JWT_SECRET omgevingsvariabele in voor productie.');
}

const PORT = 3000;

// Ensure data directory exists for database
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize Database in the data directory
const db = new Database(path.join(dataDir, 'database.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

  CREATE TABLE IF NOT EXISTS space_members (
    spaceId TEXT NOT NULL,
    userId TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    PRIMARY KEY (spaceId, userId),
    FOREIGN KEY (spaceId) REFERENCES spaces(id),
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
    dueDate TEXT,
    subtasks TEXT, -- JSON string
    attachments TEXT, -- JSON string
    isDeleted INTEGER DEFAULT 0,
    deletedAt TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (spaceId) REFERENCES spaces(id)
  );

  CREATE TABLE IF NOT EXISTS task_members (
    taskId TEXT NOT NULL,
    userId TEXT NOT NULL,
    PRIMARY KEY (taskId, userId),
    FOREIGN KEY (taskId) REFERENCES tasks(id),
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`);

// Migration: Ensure dueDate column exists
try {
  db.prepare('SELECT dueDate FROM tasks LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE tasks ADD COLUMN dueDate TEXT');
    console.log('Database gemigreerd: dueDate kolom toegevoegd aan tasks.');
  } catch (err) {
    console.error('Migratiefout dueDate:', err);
  }
}

// Migration: Ensure isDeleted and deletedAt columns exist
try {
  db.prepare('SELECT isDeleted FROM tasks LIMIT 1').get();
} catch (e) {
  try {
    db.exec('ALTER TABLE tasks ADD COLUMN isDeleted INTEGER DEFAULT 0');
    db.exec('ALTER TABLE tasks ADD COLUMN deletedAt TEXT');
    console.log('Database gemigreerd: isDeleted en deletedAt kolommen toegevoegd aan tasks.');
  } catch (err) {
    console.error('Migratiefout softDelete:', err);
  }
}

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

// --- Helpers ---

const parseJSON = (val: any) => {
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return Array.isArray(val) ? val : []; }
  }
  return Array.isArray(val) ? val : [];
};

// --- Auth Routes ---

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, avatar } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Naam, e-mail en wachtwoord zijn verplicht' });
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = `user-${Date.now()}`;
    
    const stmt = db.prepare('INSERT INTO users (id, name, email, password, avatar) VALUES (?, ?, ?, ?, ?)');
    stmt.run(userId, name, email, hashedPassword, avatar || '');

    // Create a default space for the new user
    const spaceStmt = db.prepare('INSERT INTO spaces (id, userId, name, emoji, icon, color, columns) VALUES (?, ?, ?, ?, ?, ?, ?)');
    spaceStmt.run(`space-${Date.now()}`, userId, 'Algemeen', '📁', 'Layers', '#FF5733', JSON.stringify(['Te doen', 'Bezig', 'Klaar']));

    const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: userId, name, email, avatar } });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'E-mailadres al in gebruik' });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server fout' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-mail en wachtwoord zijn verplicht' });

  const user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: 'Ongeldige inloggegevens' });
  }

  // Cleanup old trash items for this user
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const isoString = thirtyDaysAgo.toISOString();
    
    db.transaction(() => {
      // Find tasks to delete
      const oldTasks = db.prepare('SELECT id FROM tasks WHERE userId = ? AND isDeleted = 1 AND deletedAt < ?').all(user.id, isoString) as { id: string }[];
      if (oldTasks.length > 0) {
        const ids = oldTasks.map(t => t.id);
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM task_members WHERE taskId IN (${placeholders})`).run(...ids);
        db.prepare(`DELETE FROM tasks WHERE id IN (${placeholders})`).run(...ids);
        console.log(`Auto-cleanup: ${oldTasks.length} taken verwijderd uit prullenbak van ${user.email}`);
      }
    })();
  } catch (err) {
    console.error('Auto-cleanup error:', err);
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar } });
});

app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  const user: any = db.prepare('SELECT id, name, email, avatar FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

app.put('/api/auth/profile', authenticateToken, async (req: any, res) => {
  const { name, avatar } = req.body;
  if (!name) return res.status(400).json({ error: 'Naam is verplicht' });

  try {
    db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?').run(name, avatar || '', req.user.id);
    const updatedUser: any = db.prepare('SELECT id, name, email, avatar FROM users WHERE id = ?').get(req.user.id);
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Kon profiel niet bijwerken' });
  }
});

app.post('/api/auth/change-password', authenticateToken, async (req: any, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Huidig en nieuw wachtwoord zijn verplicht' });

  try {
    const user: any = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Huidig wachtwoord is onjuist' });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedNewPassword, req.user.id);
    res.json({ success: true, message: 'Wachtwoord succesvol gewijzigd' });
  } catch (error) {
    res.status(500).json({ error: 'Kon wachtwoord niet wijzigen' });
  }
});

app.get('/api/users/search', authenticateToken, (req: any, res) => {
  const query = req.query.q as string;
  if (!query || query.length < 2) return res.json([]);
  
  const users = db.prepare('SELECT id, name, email, avatar FROM users WHERE (name LIKE ? OR email LIKE ?) AND id != ? LIMIT 10')
    .all(`%${query}%`, `%${query}%`, req.user.id);
  res.json(users);
});

// --- Data Routes ---

app.get('/api/spaces', authenticateToken, (req: any, res) => {
  const spaces = db.prepare(`
    SELECT DISTINCT s.*,
    (SELECT COUNT(*) FROM space_members WHERE spaceId = s.id) > 0 as isShared
    FROM spaces s
    LEFT JOIN space_members sm ON s.id = sm.spaceId
    WHERE s.userId = ? OR sm.userId = ?
  `).all(req.user.id, req.user.id);
  res.json(spaces.map((s: any) => ({ ...s, isShared: !!s.isShared, columns: JSON.parse(s.columns || '[]') })));
});

app.post('/api/spaces/:id/share', authenticateToken, (req: any, res) => {
  const { targetUserId } = req.body;
  const spaceId = req.params.id;

  // Check if current user is owner or member
  const hasAccess = db.prepare(`
    SELECT 1 FROM spaces s
    WHERE s.id = ? AND (
      s.userId = ? 
      OR EXISTS (SELECT 1 FROM space_members WHERE spaceId = s.id AND userId = ?)
    )
  `).get(spaceId, req.user.id, req.user.id);

  if (!hasAccess) return res.status(403).json({ error: 'Je hebt geen rechten om deze ruimte te delen' });

  try {
    // Check if target user exists
    const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(targetUserId);
    if (!userExists) return res.status(404).json({ error: 'Gebruiker niet gevonden' });

    db.prepare('INSERT OR IGNORE INTO space_members (spaceId, userId) VALUES (?, ?)').run(spaceId, targetUserId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Kon ruimte niet delen' });
  }
});

app.post('/api/spaces', authenticateToken, (req: any, res) => {
  try {
    const { id, name, emoji, icon, color, columns } = req.body;
    const stmt = db.prepare('INSERT INTO spaces (id, userId, name, emoji, icon, color, columns) VALUES (?, ?, ?, ?, ?, ?, ?)');
    stmt.run(id, req.user.id, name, emoji, icon, color, JSON.stringify(columns));
    res.json({ success: true });
  } catch (error: any) {
    console.error('Space creation error:', error);
    res.status(500).json({ error: error.message || 'Kon ruimte niet toevoegen' });
  }
});

app.put('/api/spaces/:id', authenticateToken, (req: any, res) => {
  const { name, emoji, icon, color, columns } = req.body;
  
  const space = db.prepare(`
    SELECT 1 FROM spaces s
    WHERE s.id = ? AND (
      s.userId = ? 
      OR EXISTS (SELECT 1 FROM space_members WHERE spaceId = s.id AND userId = ?)
    )
  `).get(req.params.id, req.user.id, req.user.id);

  if (!space) return res.status(403).json({ error: 'Je hebt geen rechten om deze ruimte-instellingen te wijzigen' });

  const stmt = db.prepare('UPDATE spaces SET name = ?, emoji = ?, icon = ?, color = ?, columns = ? WHERE id = ?');
  stmt.run(name, emoji, icon, color, JSON.stringify(columns), req.params.id);
  res.json({ success: true });
});

app.delete('/api/spaces/:id', authenticateToken, (req: any, res) => {
  const space = db.prepare(`
    SELECT 1 FROM spaces s
    WHERE s.id = ? AND (
      s.userId = ? 
      OR EXISTS (SELECT 1 FROM space_members WHERE spaceId = s.id AND userId = ?)
    )
  `).get(req.params.id, req.user.id, req.user.id);

  if (!space) return res.status(403).json({ error: 'Je hebt geen rechten om deze ruimte te verwijderen' });

  const transaction = db.transaction(() => {
    // Collect all tasks in this space to clean up their members
    const tasksInSpace = db.prepare('SELECT id FROM tasks WHERE spaceId = ?').all(req.params.id) as { id: string }[];
    const taskIds = tasksInSpace.map(t => t.id);
    
    if (taskIds.length > 0) {
      // Clean up task members for all tasks in this space
      const placeholders = taskIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM task_members WHERE taskId IN (${placeholders})`).run(...taskIds);
      db.prepare(`DELETE FROM tasks WHERE spaceId = ?`).run(req.params.id);
    }
    
    db.prepare('DELETE FROM space_members WHERE spaceId = ?').run(req.params.id);
    db.prepare('DELETE FROM spaces WHERE id = ?').run(req.params.id);
  });
  
  transaction();
  res.json({ success: true });
});

app.get('/api/tasks', authenticateToken, (req: any, res) => {
  // Periodically cleanup old trash items (at least when fetching data)
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const isoString = thirtyDaysAgo.toISOString();
    
    db.transaction(() => {
      const oldTasks = db.prepare('SELECT id FROM tasks WHERE userId = ? AND isDeleted = 1 AND deletedAt < ?').all(req.user.id, isoString) as { id: string }[];
      if (oldTasks.length > 0) {
        const ids = oldTasks.map(t => t.id);
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM task_members WHERE taskId IN (${placeholders})`).run(...ids);
        db.prepare(`DELETE FROM tasks WHERE id IN (${placeholders})`).run(...ids);
      }
    })();
  } catch (err) {
    // Silent fail for cleanup
  }

  const tasks = db.prepare(`
    SELECT DISTINCT t.* FROM tasks t
    LEFT JOIN task_members tm ON t.id = tm.taskId
    LEFT JOIN space_members sm ON t.spaceId = sm.spaceId
    LEFT JOIN spaces s ON t.spaceId = s.id
    WHERE t.userId = ? OR tm.userId = ? OR sm.userId = ? OR s.userId = ?
  `).all(req.user.id, req.user.id, req.user.id, req.user.id);
  res.json(tasks.map((t: any) => ({
    ...t,
    isDeleted: !!t.isDeleted,
    subtasks: JSON.parse(t.subtasks || '[]'),
    attachments: JSON.parse(t.attachments || '[]')
  })));
});

app.post('/api/tasks/:id/share', authenticateToken, (req: any, res) => {
  const { targetUserId } = req.body;
  const taskId = req.params.id;

  const task: any = db.prepare('SELECT * FROM tasks WHERE id = ? AND userId = ?').get(taskId, req.user.id);
  if (!task) return res.status(403).json({ error: 'Alleen de eigenaar kan een taak delen' });

  try {
    // Check if target user exists
    const userExists = db.prepare('SELECT 1 FROM users WHERE id = ?').get(targetUserId);
    if (!userExists) return res.status(404).json({ error: 'Gebruiker niet gevonden' });

    db.prepare('INSERT OR IGNORE INTO task_members (taskId, userId) VALUES (?, ?)').run(taskId, targetUserId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Kon taak niet delen' });
  }
});

app.post('/api/tasks', authenticateToken, (req: any, res) => {
  try {
    const task = req.body;
    
    if (!task.spaceId) {
      return res.status(400).json({ error: 'Ruimte ID is verplicht' });
    }

    // Verify space exists and user has access (either owner or member)
    const space = db.prepare(`
      SELECT 1 FROM spaces s
      WHERE s.id = ? AND (
        s.userId = ? 
        OR EXISTS (SELECT 1 FROM space_members WHERE spaceId = s.id AND userId = ?)
      )
    `).get(task.spaceId, req.user.id, req.user.id);

    if (!space) {
      return res.status(404).json({ error: 'De opgegeven ruimte bestaat niet of je hebt geen toegang' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO tasks (id, userId, spaceId, title, description, status, priority, link, dueDate, subtasks, attachments, isDeleted, deletedAt, createdAt) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      task.id, 
      req.user.id, 
      task.spaceId, 
      task.title, 
      task.description || '', 
      task.status, 
      task.priority, 
      task.link || '', 
      task.dueDate || null,
      JSON.stringify(parseJSON(task.subtasks)), 
      JSON.stringify(parseJSON(task.attachments)),
      task.isDeleted ? 1 : 0,
      task.deletedAt || null,
      task.createdAt
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Task creation SQL error:', error.message, 'Payload:', JSON.stringify(req.body));
    res.status(500).json({ error: 'Kon taak niet toevoegen: ' + error.message });
  }
});

app.put('/api/tasks/:id', authenticateToken, (req: any, res) => {
  const updates = req.body;
  
  // Check access: user must be owner OR member of the task OR member of the space
  const current: any = db.prepare(`
    SELECT DISTINCT t.* FROM tasks t
    LEFT JOIN task_members tm ON t.id = tm.taskId
    LEFT JOIN space_members sm ON t.spaceId = sm.spaceId
    LEFT JOIN spaces s ON t.spaceId = s.id
    WHERE t.id = ? AND (t.userId = ? OR tm.userId = ? OR sm.userId = ? OR s.userId = ?)
  `).get(req.params.id, req.user.id, req.user.id, req.user.id, req.user.id);

  if (!current) return res.status(403).json({ error: 'Geen toegang tot deze taak of taak bestaat niet' });

  // Handle subtasks and attachments merging
  const existingSubtasks = typeof current.subtasks === 'string' ? JSON.parse(current.subtasks || '[]') : (current.subtasks || []);
  const existingAttachments = typeof current.attachments === 'string' ? JSON.parse(current.attachments || '[]') : (current.attachments || []);

  const updatedSubtasks = updates.subtasks !== undefined ? parseJSON(updates.subtasks) : existingSubtasks;
  const updatedAttachments = updates.attachments !== undefined ? parseJSON(updates.attachments) : existingAttachments;

  // Fields allowed to be updated by members
  const updated = { ...current, ...updates };

  const stmt = db.prepare(`
    UPDATE tasks 
    SET spaceId = ?, title = ?, description = ?, status = ?, priority = ?, link = ?, dueDate = ?, subtasks = ?, attachments = ?, isDeleted = ?, deletedAt = ?
    WHERE id = ?
  `);
  stmt.run(
    updated.spaceId,
    updated.title,
    updated.description,
    updated.status,
    updated.priority,
    updated.link,
    updated.dueDate || null,
    JSON.stringify(updatedSubtasks),
    JSON.stringify(updatedAttachments),
    updated.isDeleted ? 1 : 0,
    updated.deletedAt || null,
    req.params.id
  );
  res.json({ success: true });
});

app.delete('/api/tasks/:id', authenticateToken, (req: any, res) => {
  const taskId = req.params.id;
  const userId = req.user.id;
  
  // Check access: user must be owner OR member of the task OR member of the space
  const task = db.prepare(`
    SELECT DISTINCT t.id FROM tasks t
    LEFT JOIN task_members tm ON t.id = tm.taskId
    LEFT JOIN space_members sm ON t.spaceId = sm.spaceId
    LEFT JOIN spaces s ON t.spaceId = s.id
    WHERE t.id = ? AND (t.userId = ? OR tm.userId = ? OR sm.userId = ? OR s.userId = ?)
  `).get(taskId, userId, userId, userId, userId);

  if (!task) {
    console.warn(`Delete permission denied for task ${taskId} by user ${userId}`);
    return res.status(403).json({ error: 'Je hebt geen rechten om deze taak te verwijderen of de taak bestaat niet' });
  }

  try {
    const deleteOp = db.transaction((id: string) => {
      db.prepare('DELETE FROM task_members WHERE taskId = ?').run(id);
      db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    });
    
    deleteOp(taskId);
    console.log(`Taak ${taskId} definitief verwijderd door ${req.user.email}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Kon taak niet definitief verwijderen: ' + error.message });
  }
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

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Interne serverfout', details: err.message });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM ontvangen, server wordt afgesloten...');
    db.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT ontvangen, server wordt afgesloten...');
    db.close();
    process.exit(0);
  });
}

startServer();
