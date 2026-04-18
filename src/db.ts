import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'games.db');

let _db: Database.Database | null = null;

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
    `);

    for (const sql of [
      'ALTER TABLE notified_games ADD COLUMN end_date_ts INTEGER',
    ]) {
      try { _db.exec(sql); } catch { /* 이미 존재하면 무시 */ }
    }
  }
  return _db;
}

// ── 알림 추적 ──────────────────────────────────────────────

export function isNotified(id: string): boolean {
  return getDb()
    .prepare('SELECT 1 FROM notified_games WHERE id = ?')
    .get(id) !== undefined;
}

export function markNotified(id: string, title: string, store: string, endDateRaw?: string): void {
  const endDateTs = endDateRaw ? Math.floor(new Date(endDateRaw).getTime() / 1000) : null;
  getDb()
    .prepare('INSERT OR IGNORE INTO notified_games (id, title, store, end_date_ts) VALUES (?, ?, ?, ?)')
    .run(id, title, store, endDateTs);
}

export function cleanupExpiredGames(): number {
  const now = Math.floor(Date.now() / 1000);
  const result = getDb()
    .prepare('DELETE FROM notified_games WHERE end_date_ts IS NOT NULL AND end_date_ts < ?')
    .run(now);
  return result.changes;
}

export function cleanupOldEntries(daysOld = 30): void {
  const cutoff = Math.floor(Date.now() / 1000) - daysOld * 86400;
  getDb().prepare('DELETE FROM notified_games WHERE notified_at < ?').run(cutoff);
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

export function getAllStoreRoles(store: string): { guildId: string; roleId: string }[] {
  return (
    getDb()
      .prepare('SELECT guild_id, role_id FROM guild_store_roles WHERE store = ?')
      .all(store) as { guild_id: string; role_id: string }[]
  ).map(r => ({ guildId: r.guild_id, roleId: r.role_id }));
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

export function getAllChannels(): { guildId: string; channelId: string }[] {
  return (
    getDb()
      .prepare('SELECT guild_id, channel_id FROM registered_channels')
      .all() as { guild_id: string; channel_id: string }[]
  ).map(r => ({ guildId: r.guild_id, channelId: r.channel_id }));
}

export function getGuildChannels(guildId: string): string[] {
  return (
    getDb()
      .prepare('SELECT channel_id FROM registered_channels WHERE guild_id = ?')
      .all(guildId) as { channel_id: string }[]
  ).map(r => r.channel_id);
}
