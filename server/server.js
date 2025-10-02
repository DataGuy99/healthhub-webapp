import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new Database(join(__dirname, 'healthhub.db'));

app.use(cors());
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many authentication attempts' }
});

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    passcode TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS supplements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    dose REAL NOT NULL,
    dose_unit TEXT NOT NULL,
    form TEXT NOT NULL,
    section TEXT NOT NULL,
    active_days TEXT NOT NULL,
    is_stack INTEGER DEFAULT 0,
    stack_id TEXT,
    "order" INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );

  CREATE TABLE IF NOT EXISTS supplement_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    supplement_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    is_taken INTEGER NOT NULL,
    timestamp DATETIME NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    UNIQUE(user_id, supplement_id, date)
  );

  CREATE TABLE IF NOT EXISTS supplement_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_supplements_user ON supplements(user_id);
  CREATE INDEX IF NOT EXISTS idx_logs_user ON supplement_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_logs_date ON supplement_logs(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_sections_user ON supplement_sections(user_id);
`);

async function authenticate(req, res, next) {
  const userId = req.headers['x-user-id'];
  const passcode = req.headers['x-passcode'];

  if (!userId || !passcode) {
    return res.status(401).json({ error: 'Missing credentials' });
  }

  const user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(passcode, user.passcode);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.userId = userId;
  next();
}

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { userId, passcode } = req.body;

  if (!userId || !passcode) {
    return res.status(400).json({ error: 'Missing userId or passcode' });
  }

  if (passcode.length < 6) {
    return res.status(400).json({ error: 'Passcode must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (existing) {
    return res.status(409).json({ error: 'User already exists' });
  }

  const hashedPasscode = await bcrypt.hash(passcode, 10);
  db.prepare('INSERT INTO users (user_id, passcode) VALUES (?, ?)').run(userId, hashedPasscode);

  res.json({ success: true, userId });
});

app.post('/api/auth/verify', authLimiter, authenticate, (req, res) => {
  res.json({ success: true, userId: req.userId });
});

app.get('/api/data/all', authenticate, (req, res) => {
  const supplements = db.prepare('SELECT * FROM supplements WHERE user_id = ?').all(req.userId);
  const supplementLogs = db.prepare('SELECT * FROM supplement_logs WHERE user_id = ?').all(req.userId);
  const supplementSections = db.prepare('SELECT * FROM supplement_sections WHERE user_id = ?').all(req.userId);

  res.json({
    supplements: supplements.map(s => ({
      ...s,
      activeDays: JSON.parse(s.active_days),
      isStack: Boolean(s.is_stack),
      createdAt: s.created_at
    })),
    supplementLogs: supplementLogs.map(l => ({
      ...l,
      supplementId: l.supplement_id,
      isTaken: Boolean(l.is_taken)
    })),
    supplementSections: supplementSections.map(s => ({
      ...s,
      createdAt: s.created_at
    }))
  });
});

app.post('/api/sync', authenticate, (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid sync data' });
  }

  if (items.length > 1000) {
    return res.status(400).json({ error: 'Batch too large (max 1000 items)' });
  }

  for (const item of items) {
    const { action, operation, data } = item;

    if (action === 'supplement') {
      if (!data.name || typeof data.name !== 'string' || data.name.length > 255) {
        return res.status(400).json({ error: 'Invalid supplement name' });
      }
      if (typeof data.dose !== 'number' || data.dose <= 0) {
        return res.status(400).json({ error: 'Invalid dose' });
      }
      if (typeof data.order !== 'number' || data.order < 0) {
        return res.status(400).json({ error: 'Invalid order' });
      }
    } else if (action === 'supplement_log') {
      if (typeof data.supplementId !== 'number') {
        return res.status(400).json({ error: 'Invalid supplement ID' });
      }
      if (typeof data.isTaken !== 'boolean') {
        return res.status(400).json({ error: 'Invalid isTaken value' });
      }
    } else if (action === 'section') {
      if (!data.name || typeof data.name !== 'string') {
        return res.status(400).json({ error: 'Invalid section name' });
      }
    }
  }

  const transaction = db.transaction(() => {
    for (const item of items) {
      const { action, operation, data } = item;

      if (action === 'supplement') {
        if (operation === 'create') {
          db.prepare(`
            INSERT INTO supplements (user_id, name, dose, dose_unit, form, section, active_days, is_stack, stack_id, "order", created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            req.userId,
            data.name,
            data.dose,
            data.doseUnit,
            data.form,
            data.section,
            JSON.stringify(data.activeDays),
            data.isStack ? 1 : 0,
            data.stackId || null,
            data.order,
            data.createdAt
          );
        } else if (operation === 'update') {
          db.prepare(`
            UPDATE supplements SET name = ?, dose = ?, dose_unit = ?, form = ?, section = ?, active_days = ?, is_stack = ?, stack_id = ?, "order" = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
          `).run(
            data.name,
            data.dose,
            data.doseUnit,
            data.form,
            data.section,
            JSON.stringify(data.activeDays),
            data.isStack ? 1 : 0,
            data.stackId || null,
            data.order,
            data.id,
            req.userId
          );
        } else if (operation === 'delete') {
          db.prepare('DELETE FROM supplements WHERE id = ? AND user_id = ?').run(data.id, req.userId);
        }
      } else if (action === 'supplement_log') {
        if (operation === 'create') {
          db.prepare(`
            INSERT OR REPLACE INTO supplement_logs (user_id, supplement_id, date, is_taken, timestamp)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            req.userId,
            data.supplementId,
            data.date,
            data.isTaken ? 1 : 0,
            data.timestamp
          );
        } else if (operation === 'update') {
          db.prepare(`
            UPDATE supplement_logs SET is_taken = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
          `).run(data.isTaken ? 1 : 0, data.id, req.userId);
        }
      } else if (action === 'section') {
        if (operation === 'create') {
          db.prepare(`
            INSERT INTO supplement_sections (user_id, name, "order", created_at)
            VALUES (?, ?, ?, ?)
          `).run(req.userId, data.name, data.order, data.createdAt);
        } else if (operation === 'delete') {
          db.prepare('DELETE FROM supplement_sections WHERE id = ? AND user_id = ?').run(data.id, req.userId);
        }
      }
    }
  });

  try {
    transaction();
    res.json({ success: true, syncedCount: items.length });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`HealthHub API server running on port ${PORT}`);
});
