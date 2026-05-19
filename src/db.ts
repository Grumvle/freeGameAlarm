import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'games.db');

let _db: Database.Database | null = null;

const MIGRATIONS: Array<{ version: number; up: (db: Database.Database) => void }> = [
  {
    version: 1,
    up: (db) => {
      const columns = db.pragma('table_info(notified_games)') as Array<{ name: string }>;
      if (!columns.some(c => c.name === 'end_date_ts')) {
        db.exec('ALTER TABLE notified_games ADD COLUMN end_date_ts INTEGER');
      }
    },
  },
];

function runMigrations(db: Database.Database): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');
  const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number | null };
  const current = row?.v ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      m.up(db);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(m.version);
    }
  }
}

function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    _db = new Database(DB_PATH);
    _db.exec(`
      CREATE TABLE IF NOT EXISTS notified_games (
        id          TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        store       TEXT NOT NULL,
        notified_at INTEGER NOT NULL DEFAULT (unixepoch()),
        end_date_ts INTEGER
      );

      CREATE TABLE IF NOT EXISTS registered_channels (
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id)
      );

      CREATE TABLE IF NOT EXISTS guild_store_roles (
        guild_id TEXT NOT NULL,
        store    TEXT NOT NULL,
        role_id  TEXT NOT NULL,
        PRIMARY KEY (guild_id, store)
      );

      CREATE TABLE IF NOT EXISTS guild_notify_settings (
        guild_id           TEXT PRIMARY KEY,
        notify_hour        INTEGER NOT NULL DEFAULT 12,
        last_notified_date TEXT
      );

      CREATE TABLE IF NOT EXISTS guild_notified_games (
        guild_id    TEXT NOT NULL,
        game_id     TEXT NOT NULL,
        title       TEXT NOT NULL,
        store       TEXT NOT NULL,
        notified_at INTEGER NOT NULL DEFAULT (unixepoch()),
        end_date_ts INTEGER,
        PRIMARY KEY (guild_id, game_id)
      );
    `);
    runMigrations(_db);
  }
  return _db;
}

// ── 서버별 알림 시각 설정 ──────────────────────────────────

const DEFAULT_NOTIFY_HOUR = 12;

export function getNotifyHour(guildId: string): number {
  const row = getDb()
    .prepare('SELECT notify_hour FROM guild_notify_settings WHERE guild_id = ?')
    .get(guildId) as { notify_hour: number } | undefined;
  return row?.notify_hour ?? DEFAULT_NOTIFY_HOUR;
}

export function setNotifyHour(guildId: string, hour: number): void {
  // last_notified_date is intentionally left untouched on update so that
  // changing the hour does not cause a duplicate delivery on the same day.
  getDb()
    .prepare(`
      INSERT INTO guild_notify_settings (guild_id, notify_hour)
      VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET notify_hour = excluded.notify_hour
    `)
    .run(guildId, hour);
}

export function getLastNotifiedDate(guildId: string): string | undefined {
  const row = getDb()
    .prepare('SELECT last_notified_date FROM guild_notify_settings WHERE guild_id = ?')
    .get(guildId) as { last_notified_date: string | null } | undefined;
  return row?.last_notified_date ?? undefined;
}

export function setLastNotifiedDate(guildId: string, date: string): void {
  getDb()
    .prepare(`
      INSERT INTO guild_notify_settings (guild_id, notify_hour, last_notified_date)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET last_notified_date = excluded.last_notified_date
    `)
    .run(guildId, DEFAULT_NOTIFY_HOUR, date);
}

// ── 서버별 알림 추적 ───────────────────────────────────────

export function getGuildNotifiedIds(guildId: string): Set<string> {
  const rows = getDb()
    .prepare('SELECT game_id FROM guild_notified_games WHERE guild_id = ?')
    .all(guildId) as { game_id: string }[];
  return new Set(rows.map(r => r.game_id));
}

export function markGuildNotified(
  guildId: string,
  gameId: string,
  title: string,
  store: string,
  endDateRaw?: string,
): void {
  const parsedEndDate = endDateRaw ? new Date(endDateRaw).getTime() : NaN;
  const endDateTs = Number.isFinite(parsedEndDate) ? Math.floor(parsedEndDate / 1000) : null;
  getDb()
    .prepare(`
      INSERT OR IGNORE INTO guild_notified_games (guild_id, game_id, title, store, end_date_ts)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(guildId, gameId, title, store, endDateTs);
}

export function getGuildsWithChannels(): string[] {
  return (
    getDb()
      .prepare('SELECT DISTINCT guild_id FROM registered_channels')
      .all() as { guild_id: string }[]
  ).map(r => r.guild_id);
}

export function cleanupGuildNotifiedGames(unknownEndDateDays = 60): number {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - unknownEndDateDays * 86400;
  const db = getDb();
  const expired = db
    .prepare('DELETE FROM guild_notified_games WHERE end_date_ts IS NOT NULL AND end_date_ts < ?')
    .run(now);
  const stale = db
    .prepare('DELETE FROM guild_notified_games WHERE end_date_ts IS NULL AND notified_at < ?')
    .run(cutoff);
  return expired.changes + stale.changes;
}

// ── 역할 관리 ──────────────────────────────────────────────

export function setStoreRole(guildId: string, store: string, roleId: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO guild_store_roles (guild_id, store, role_id) VALUES (?, ?, ?)')
    .run(guildId, store, roleId);
}

export function getStoreRole(guildId: string, store: string): string | undefined {
  const row = getDb()
    .prepare('SELECT role_id FROM guild_store_roles WHERE guild_id = ? AND store = ?')
    .get(guildId, store) as { role_id: string } | undefined;
  return row?.role_id;
}

// ── 채널 관리 ──────────────────────────────────────────────

export function registerChannel(guildId: string, channelId: string): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO registered_channels (guild_id, channel_id) VALUES (?, ?)')
    .run(guildId, channelId);
}

export function unregisterChannel(guildId: string, channelId: string): void {
  getDb()
    .prepare('DELETE FROM registered_channels WHERE guild_id = ? AND channel_id = ?')
    .run(guildId, channelId);
}

export function getGuildChannels(guildId: string): string[] {
  return (
    getDb()
      .prepare('SELECT channel_id FROM registered_channels WHERE guild_id = ?')
      .all(guildId) as { channel_id: string }[]
  ).map(r => r.channel_id);
}
