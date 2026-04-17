import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { GameInfo } from './types';
import { isNotified, markNotified, getSubscribersForStore } from './db';
import { getAllFreeGames } from './scrapers';

const STORE_COLORS: Record<string, number> = {
  'Epic Games': 0x2b2b2b,
  'Steam':      0x1b2838,
  'GOG':        0x86328a,
};

const STORE_EMOJIS: Record<string, string> = {
  'Epic Games': '🎮',
  'Steam':      '🎯',
  'GOG':        '🎁',
};

export function buildEmbed(game: GameInfo): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(game.title)
    .setURL(game.url)
    .setColor(STORE_COLORS[game.store] ?? 0x00ff00)
    .setFooter({ text: `${STORE_EMOJIS[game.store] ?? '🎮'} ${game.store}` })
    .setTimestamp();

  if (game.imageUrl) embed.setThumbnail(game.imageUrl);

  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (game.originalPrice) fields.push({ name: '💰 원래 가격', value: game.originalPrice, inline: true });
  if (game.endDate)       fields.push({ name: '⏰ 무료 종료', value: game.endDate,       inline: true });
  if (fields.length > 0)  embed.addFields(fields);

  return embed;
}

// 새 게임 조회 + DB 마킹 (채널 전송과 분리)
export async function getAndMarkNewGames(): Promise<GameInfo[]> {
  const games = await getAllFreeGames();
  const newGames = games.filter(g => !isNotified(g.id));

  for (const game of newGames) {
    markNotified(game.id, game.title, game.store, game.endDateRaw);
  }

  return newGames;
}

// 특정 채널에 게임 목록 전송
export async function postGamesToChannel(
  channel: TextChannel,
  games: GameInfo[]
): Promise<void> {
  if (games.length === 0) return;

  await channel.send(`🎁 **새로운 무료 게임 ${games.length}개 발견!**`);

  for (const game of games) {
    await channel.send({ embeds: [buildEmbed(game)] });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// 구독한 유저에게 DM 발송
export async function dmSubscribers(client: Client, games: GameInfo[]): Promise<void> {
  for (const game of games) {
    const userIds = getSubscribersForStore(game.store);

    for (const userId of userIds) {
      try {
        const user = await client.users.fetch(userId);
        await user.send({
          content: `🎁 **${game.store}** 무료 게임 알림!`,
          embeds: [buildEmbed(game)],
        });
      } catch {
        // DM 비허용 유저 스킵
      }
    }
  }
}
