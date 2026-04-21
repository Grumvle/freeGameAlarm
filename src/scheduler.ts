import { Client, TextChannel } from 'discord.js';
import { getNewGames, markGamesNotified, postGamesToChannel } from './notifier';
import { getAllChannels, cleanupExpiredGames, cleanupOldEntries } from './db';

export interface BroadcastResult {
  gameCount: number;
  sent: number;
  total: number;
}

export async function broadcast(client: Client): Promise<BroadcastResult> {
  const channels = getAllChannels();
  const total = channels.length;

  const newGames = await getNewGames();
  if (newGames.length === 0) return { gameCount: 0, sent: 0, total };

  let sent = 0;
  for (const { channelId } of channels) {
    try {
      const ch = await client.channels.fetch(channelId);
      if (ch instanceof TextChannel) {
        await postGamesToChannel(ch, newGames, { mentionStoreRoles: true });
        sent++;
      }
    } catch (err) {
      console.error(`[알림] 채널 ${channelId} 전송 실패:`, err);
    }
  }

  if (sent > 0) {
    markGamesNotified(newGames);
  } else if (total > 0) {
    console.error('[알림] 모든 채널 전송 실패 — 다음 확인에서 다시 시도합니다.');
  }

  return { gameCount: newGames.length, sent, total };
}

export function startScheduler(client: Client, intervalHours: number): void {
  setInterval(async () => {
    console.log(`[스케줄러] 확인 시작 (${new Date().toLocaleString('ko-KR')})`);
    try {
      const { gameCount, sent, total } = await broadcast(client);
      console.log(`[스케줄러] 완료 — 새 게임 ${gameCount}개 (${sent}/${total}개 채널)`);
      const expired = cleanupExpiredGames();
      if (expired > 0) console.log(`[DB] 만료된 게임 ${expired}개 제거`);
      cleanupOldEntries(30);
    } catch (err) {
      console.error('[스케줄러] 오류:', err);
    }
  }, intervalHours * 60 * 60 * 1000);

  console.log(`[스케줄러] ${intervalHours}시간마다 자동 확인 예약됨`);
}
