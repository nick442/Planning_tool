import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

export interface OpenDatabase {
  db: Db;
  sqlite: Database.Database;
  close: () => void;
}

/**
 * Opens (or creates) the SQLite file and applies pending migrations.
 * Pass ':memory:' for a throwaway database in tests.
 */
export function openDatabase(path: string, migrationsFolder: string): OpenDatabase {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  // WAL: readers don't block the writer, and a crash can't corrupt the file.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return { db, sqlite, close: () => sqlite.close() };
}
