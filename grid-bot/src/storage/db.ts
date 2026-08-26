import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

let db: Database.Database | null = null;

export function getDb(path = 'data/grid-bot.db'): Database.Database {
  if (!db) {
    mkdirSync(dirname(path), { recursive: true });
    db = new Database(path);
    initSchema(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

function initSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      pair TEXT NOT NULL,
      side TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT NOT NULL,
      pair TEXT NOT NULL,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      side TEXT NOT NULL,
      filled_at INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair TEXT NOT NULL,
      total_value_usdt REAL NOT NULL,
      pnl_usdt REAL NOT NULL,
      recorded_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT,
      created_at INTEGER NOT NULL
    );
  `);
}
