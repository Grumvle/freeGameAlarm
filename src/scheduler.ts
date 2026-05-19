import { Client, TextChannel } from 'discord.js';
import { filterNewForGuild, markGamesNotifiedForGuild, postGamesToChannel } from './notifier';
import {
  getGuildsWithChannels,
  getGuildChannels,
  getNotifyHour,
  getLastNotifiedDate,
  setLastNotifiedDate,
  cleanupGuildNotifiedGames,
} from './db';
import { getAllFreeGames } from './scrapers';
import { getKstHour, getKstDateString } from './time';
import { GameInfo } from './types';

const DELIVERY_TICK_MS = 60 * 1000;

// Latest scrape result. The env-interval scheduler refreshes this; the
// per-minute delivery tick only reads it and never scrapes.
let currentFreeGames: GameInfo[] = [];
// Stays false until the first successful scrape so the delivery tick never
// marks a day "done" with an empty cache (e.g. right after a restart).
let cacheReady = false;

export interface DeliveryResult {
  guilds: number; // guilds that received at least one game
  games: number; // total games delivered (summed across guilds)
  channels: number; // channels successfully posted to
}

async function refreshCache(): Promise<void> {
  currentFreeGames = await getAllFreeGames();
  cacheReady = true;
}

async function deliverToGuild(
  client: Client,
  guildId: string,
  games: GameInfo[],
): Promise<number> {
  let sent = 0;
  for (const channelId of getGuildChannels(guildId)) {
    try {
      const ch = await client.channels.fetch(channelId);
      if (ch instanceof TextChannel) {
        await postGamesToChannel(ch, games, { mentionStoreRoles: true });
        sent++;
      }
    } catch (err) {
      console.error(`[알림] 채널 ${channelId} 전송 실패:`, err);
    }
  }
  return sent;
}

async function deliverToEligibleGuilds(client: Client): Promise<void> {
  // Guard: never mark today done before the first scrape has populated the cache.
  if (!cacheReady) return;

  const today = getKstDateString();
  const hour = getKstHour();

  for (const guildId of getGuildsWithChannels()) {
    if (getNotifyHour(guildId) !== hour) continue;
    if (getLastNotifiedDate(guildId) === today) continue;

    const newGames = filterNewForGuild(guildId, currentFreeGames);

    if (newGames.length === 0) {
      // Daily slot reached with nothing new — mark done so we don't re-check
      // every minute for the rest of this hour.
      setLastNotifiedDate(guildId, today);
      continue;
    }

    const sent = await deliverToGuild(client, guildId, newGames);
    if (sent > 0) {
      markGamesNotifiedForGuild(guildId, newGames);
      setLastNotifiedDate(guildId, today);
      console.log(`[알림] 서버 ${guildId} — 새 게임 ${newGames.length}개 / ${sent}개 채널`);
    } else {
      // All channels failed: keep the day open so the next tick retries.
      console.error(`[알림] 서버 ${guildId} 모든 채널 전송 실패 — 다음 틱 재시도`);
    }
  }
}

/** Manual `/check`: scrape now and push per-guild new games immediately. */
export async function runManualCheck(client: Client): Promise<DeliveryResult> {
  const games = await getAllFreeGames();
  // Keep the cache consistent with this fresh scrape.
  currentFreeGames = games;
  cacheReady = true;

  let guilds = 0;
  let gamesDelivered = 0;
  let channels = 0;

  for (const guildId of getGuildsWithChannels()) {
    const newGames = filterNewForGuild(guildId, games);
    if (newGames.length === 0) continue;

    const sent = await deliverToGuild(client, guildId, newGames);
    if (sent > 0) {
      markGamesNotifiedForGuild(guildId, newGames);
      guilds++;
      gamesDelivered += newGames.length;
      channels += sent;
    }
  }

  return { guilds, games: gamesDelivered, channels };
}

export function startScheduler(client: Client, intervalHours: number): void {
  // Initial scrape so the delivery tick has data ASAP after startup.
  refreshCache()
    .then(() =>
      console.log(`[스케줄러] 초기 스크랩 완료 — 무료 게임 ${currentFreeGames.length}개`),
    )
    .catch(err => console.error('[스케줄러] 초기 스크랩 오류:', err));

  // Periodic scrape on the env-configured interval (network-heavy work).
  setInterval(async () => {
    console.log(`[스케줄러] 스크랩 시작 (${new Date().toLocaleString('ko-KR')})`);
    try {
      await refreshCache();
      const removed = cleanupGuildNotifiedGames();
      if (removed > 0) console.log(`[DB] 만료/오래된 알림 기록 ${removed}개 제거`);
      console.log(`[스케줄러] 스크랩 완료 — 무료 게임 ${currentFreeGames.length}개`);
    } catch (err) {
      console.error('[스케줄러] 스크랩 오류:', err);
    }
  }, intervalHours * 60 * 60 * 1000);

  // Lightweight per-minute delivery tick (no scraping).
  setInterval(() => {
    deliverToEligibleGuilds(client).catch(err =>
      console.error('[알림] 배달 틱 오류:', err),
    );
  }, DELIVERY_TICK_MS);

  console.log(
    `[스케줄러] 스크랩 ${intervalHours}시간 주기 · 배달 1분 주기 (서버별 설정 시각, 기본 12시 KST)`,
  );
}
