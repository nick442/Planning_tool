import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';

const FILE_PATTERN = /^planning-(\d{4}-\d{2}-\d{2})\.db$/;
const CHECK_EVERY_MS = 30 * 60 * 1000;

export interface BackupOptions {
  sqlite: Database.Database;
  /** Folder for the daily copies (e.g. one Time Machine or iCloud Drive backs up). */
  dir: string;
  /** How many daily copies to keep. */
  keep: number;
  /** Local hour after which the day's backup is made (0–23). */
  hour: number;
  now?: () => Date;
  log?: (message: string) => void;
}

/** yyyy-MM-dd in local time (the Mac mini's time zone). */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function backupFileName(date: Date): string {
  return `planning-${localDay(date)}.db`;
}

/** Existing backup files, newest first. */
export function listBackups(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => FILE_PATTERN.test(f))
    .sort()
    .reverse();
}

/**
 * Copies the live database to `<dir>/planning-YYYY-MM-DD.db` with SQLite's
 * online backup API (safe while the server is running). Written to a temp
 * file first, so a backup is never half-written.
 */
export async function backupNow(
  sqlite: Database.Database,
  dir: string,
  date: Date,
): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, backupFileName(date));
  const tmp = `${file}.partial`;
  rmSync(tmp, { force: true });
  await sqlite.backup(tmp);
  renameSync(tmp, file);
  return file;
}

/** Deletes all but the newest `keep` backups. Returns the deleted file names. */
export function pruneBackups(dir: string, keep: number): string[] {
  const old = listBackups(dir).slice(Math.max(keep, 1));
  for (const name of old) rmSync(join(dir, name), { force: true });
  return old;
}

/** Makes today's backup if it is due and missing. Returns the new file, if any. */
export async function runBackupIfDue(options: BackupOptions): Promise<string | null> {
  const now = options.now?.() ?? new Date();
  if (now.getHours() < options.hour) return null;
  if (existsSync(join(options.dir, backupFileName(now)))) return null;
  const file = await backupNow(options.sqlite, options.dir, now);
  const removed = pruneBackups(options.dir, options.keep);
  options.log?.(
    `Backup written: ${file}${removed.length ? ` (removed ${removed.length} old)` : ''}`,
  );
  return file;
}

/**
 * Nightly backups: checks every half hour, so a backup missed while the Mac
 * was asleep or off is made as soon as it is back. Returns a stop function.
 */
export function startBackupSchedule(options: BackupOptions): () => void {
  const log = options.log ?? console.log;
  const check = () =>
    runBackupIfDue(options).catch((error: unknown) => log(`Backup failed: ${String(error)}`));
  void check();
  const timer = setInterval(() => void check(), CHECK_EVERY_MS);
  timer.unref();
  return () => clearInterval(timer);
}
