import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { GameInfo } from './types';
import { isNotified, markNotified, getAllChannels, getAllStoreRoles } from './db';
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

export async function getAndMarkNewGames(): Promise<GameInfo[]> {
  const games = await getAllFreeGames();
  const newGames = games.filter(g => !isNotified(g.id));

  for (const game of newGames) {
    markNotified(game.id, game.title, game.store, game.endDateRaw);
  }

  return newGames;
}

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

// 역할 멘션으로 구독자 알림
export async function mentionSubscribers(client: Client, games: GameInfo[]): Promise<void> {
  const allChannels = getAllChannels();

  for (const game of games) {
    const storeRoles = getAllStoreRoles(game.store);

    for (const { guildId, roleId } of storeRoles) {
      const channelIds = allChannels
        .filter(c => c.guildId === guildId)
        .map(c => c.channelId);

      for (const channelId of channelIds) {
        try {
          const ch = await client.channels.fetch(channelId);
          if (ch instanceof TextChannel) {
            await ch.send({
              content: `<@&${roleId}> **${game.store}** 무료 게임이 나왔어요!`,
              embeds: [buildEmbed(game)],
            });
          }
        } catch {
          // 채널 전송 실패 스킵
        }
      }
    }
  }
}
