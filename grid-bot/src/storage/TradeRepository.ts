import type Database from 'better-sqlite3';
import type { Order, OrderSide } from '../exchange/types.js';
import { getDb } from './db.js';

export interface Snapshot {
  pair: string;
  totalValueUsdt: number;
  pnlUsdt: number;
  recordedAt: number;
}

export class TradeRepository {
  constructor(private readonly database: Database.Database = getDb()) {}

  saveOrder(order: Order, mode: 'paper' | 'live', pair: string): void {
    this.database.prepare(`
      INSERT OR REPLACE INTO orders (id, pair, side, price, amount, status, mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(order.id, pair, order.side, order.price, order.amount, order.status, mode, order.createdAt);
  }

  updateOrderStatus(orderId: string, status: string): void {
    this.database.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
  }

  recordFill(orderId: string, pair: string, price: number, amount: number, side: OrderSide): void {
    this.database.prepare(`
      INSERT INTO fills (order_id, pair, price, amount, side, filled_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(orderId, pair, price, amount, side, Date.now());
  }

  saveSnapshot(snapshot: Snapshot): void {
    this.database.prepare(`
      INSERT INTO snapshots (pair, total_value_usdt, pnl_usdt, recorded_at)
      VALUES (?, ?, ?, ?)
    `).run(snapshot.pair, snapshot.totalValueUsdt, snapshot.pnlUsdt, snapshot.recordedAt);
  }

  logEvent(type: string, message: string, metadata?: Record<string, unknown>): void {
    this.database.prepare(`
      INSERT INTO events (type, message, metadata_json, created_at)
      VALUES (?, ?, ?, ?)
    `).run(type, message, metadata ? JSON.stringify(metadata) : null, Date.now());
  }

  getOpenOrders(pair?: string): Order[] {
    const rows = pair
      ? this.database.prepare("SELECT * FROM orders WHERE status = 'open' AND pair = ?").all(pair)
      : this.database.prepare("SELECT * FROM orders WHERE status = 'open'").all();

    return (rows as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      symbol: row.pair as string,
      side: row.side as OrderSide,
      price: row.price as number,
      amount: row.amount as number,
      status: 'open' as const,
      filled: 0,
      createdAt: row.created_at as number,
    }));
  }

  getLatestSnapshots(): Snapshot[] {
    const rows = this.database.prepare(`
      SELECT s.pair, s.total_value_usdt, s.pnl_usdt, s.recorded_at
      FROM snapshots s
      INNER JOIN (
        SELECT pair, MAX(recorded_at) AS max_at FROM snapshots GROUP BY pair
      ) latest ON s.pair = latest.pair AND s.recorded_at = latest.max_at
    `).all() as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      pair: row.pair as string,
      totalValueUsdt: row.total_value_usdt as number,
      pnlUsdt: row.pnl_usdt as number,
      recordedAt: row.recorded_at as number,
    }));
  }

  getLatestEvent(): { type: string; message: string; createdAt: number } | null {
    const row = this.database.prepare(
      'SELECT type, message, created_at FROM events ORDER BY created_at DESC LIMIT 1',
    ).get() as Record<string, unknown> | undefined;

    if (!row) return null;
    return {
      type: row.type as string,
      message: row.message as string,
      createdAt: row.created_at as number,
    };
  }
}
