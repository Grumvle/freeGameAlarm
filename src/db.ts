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
        notified_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS user_subscriptions (
        user_id TEXT NOT NULL,
        store   TEXT NOT NULL,
        PRIMARY KEY (user_id, store)
      );

      CREATE TABLE IF NOT EXISTS registered_channels (
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id)
      );
    `);
  }
  return _db;
}

// ── 알림 추적 ──────────────────────────────────────────────

export function isNotified(id: string): boolean {
  return getDb()
    .prepare('SELECT 1 FROM notified_games WHERE id = ?')
    .get(id) !== undefined;
}

export function markNotified(id: string, title: string, store: string): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO notified_games (id, title, store) VALUES (?, ?, ?)')
    .run(id, title, store);
}

export function cleanupOldEntries(daysOld = 30): void {
  const cutoff = Math.floor(Date.now() / 1000) - daysOld * 86400;
  getDb().prepare('DELETE FROM notified_games WHERE notified_at < ?').run(cutoff);
}

// ── 유저 구독 ──────────────────────────────────────────────

export function getSubscriptions(userId: string): string[] {
  return (
    getDb()
      .prepare('SELECT store FROM user_subscriptions WHERE user_id = ?')
      .all(userId) as { store: string }[]
  ).map(r => r.store);
}

export function addSubscription(userId: string, store: string): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO user_subscriptions (user_id, store) VALUES (?, ?)')
    .run(userId, store);
}

export function removeSubscription(userId: string, store: string): void {
  getDb()
    .prepare('DELETE FROM user_subscriptions WHERE user_id = ? AND store = ?')
    .run(userId, store);
}

export function clearSubscriptions(userId: string): void {
  getDb()
    .prepare('DELETE FROM user_subscriptions WHERE user_id = ?')
    .run(userId);
}

export function getSubscribersForStore(store: string): string[] {
  return (
    getDb()
      .prepare('SELECT user_id FROM user_subscriptions WHERE store = ?')
      .all(store) as { user_id: string }[]
  ).map(r => r.user_id);
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
