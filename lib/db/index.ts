
import { createClient, Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'
import { OWNER_ID } from '../pricing'
import path from 'path'
import os from 'os'

const globalDb = globalThis as unknown as { client?: Client; dbReady?: boolean; initPromise?: Promise<void> }

// Using TURSO_DATABASE_URL and TURSO_AUTH_TOKEN if they exist, else local SQLite
const dbUrl = process.env.TURSO_DATABASE_URL || (process.env.VERCEL ? `file:${path.join(os.tmpdir(), 'local.db')}` : 'file:local.db')

export const client = globalDb.client ?? createClient({
  url: dbUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

if (process.env.NODE_ENV !== 'production') globalDb.client = client
export const db = drizzle(client, { schema })

// Bootstrap: create tables and seed default pricing once per process
if (!globalDb.initPromise) {
  globalDb.initPromise = (async () => {
    await client.execute(`PRAGMA journal_mode = WAL;`).catch(() => {})
    await client.execute(`PRAGMA busy_timeout = 5000;`).catch(() => {})
    await client.executeMultiple(`
      CREATE TABLE IF NOT EXISTS pricing (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        boiled TEXT NOT NULL,
        raw TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS egg_orders (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        created_at TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        hostel TEXT NOT NULL DEFAULT 'Uni 1',
        boiled_quantity INTEGER NOT NULL,
        raw_quantity INTEGER NOT NULL,
        boiled_price REAL NOT NULL,
        raw_price REAL NOT NULL,
        boiled_subtotal REAL NOT NULL,
        raw_subtotal REAL NOT NULL,
        delivery_charge REAL NOT NULL DEFAULT 0,
        room_delivery INTEGER NOT NULL DEFAULT 0,
        total REAL NOT NULL,
        room TEXT NOT NULL,
        phone TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'New',
        payment_status TEXT NOT NULL DEFAULT 'Pending'
      );
      CREATE TABLE IF NOT EXISTS shop_settings (
        id TEXT PRIMARY KEY,
        is_open INTEGER NOT NULL DEFAULT 1,
        active_hostel TEXT NOT NULL DEFAULT 'Both',
        raw_available INTEGER NOT NULL DEFAULT 1,
        boiled_available INTEGER NOT NULL DEFAULT 1,
        delivery_charge REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      INSERT OR IGNORE INTO pricing (id, userId, boiled, raw, version, updated_at)
      VALUES (
        'store',
        '${OWNER_ID}',
        '[12,11,10,9,9,8]',
        '[11,10,9,9,8,7]',
        1,
        datetime('now')
      );
      INSERT OR IGNORE INTO shop_settings (id, is_open, updated_at)
      VALUES ('store', 1, datetime('now'));
    `).catch(console.error)
  
    // Migration: add name column for existing databases
    await client.execute(`ALTER TABLE egg_orders ADD COLUMN name TEXT NOT NULL DEFAULT ''`).catch(() => {})
    await client.execute(`ALTER TABLE egg_orders ADD COLUMN hostel TEXT NOT NULL DEFAULT 'Uni 1'`).catch(() => {})
    await client.execute(`ALTER TABLE shop_settings ADD COLUMN active_hostel TEXT NOT NULL DEFAULT 'Both'`).catch(() => {})
    await client.execute(`ALTER TABLE shop_settings ADD COLUMN raw_available INTEGER NOT NULL DEFAULT 1`).catch(() => {})
    await client.execute(`ALTER TABLE shop_settings ADD COLUMN boiled_available INTEGER NOT NULL DEFAULT 1`).catch(() => {})
    await client.execute(`ALTER TABLE shop_settings ADD COLUMN delivery_charge REAL NOT NULL DEFAULT 0`).catch(() => {})
    await client.execute(`ALTER TABLE egg_orders ADD COLUMN delivery_charge REAL NOT NULL DEFAULT 0`).catch(() => {})
    await client.execute(`ALTER TABLE egg_orders ADD COLUMN room_delivery INTEGER NOT NULL DEFAULT 0`).catch(() => {})
  })()
}

export async function ensureDb() {
  if (globalDb.initPromise) {
    await globalDb.initPromise
  }
}
