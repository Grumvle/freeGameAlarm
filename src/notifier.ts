import { TextChannel, EmbedBuilder } from 'discord.js';
import { GameInfo } from './types';
import { getGuildNotifiedIds, markGuildNotified, getStoreRole } from './db';
import { STORE_META, MESSAGE_DELAY_MS } from './constants';

export function buildEmbed(game: GameInfo): EmbedBuilder {
  const meta = STORE_META[game.store] ?? { color: 0x00ff00, emoji: '🎮' };
  const embed = new EmbedBuilder()
    .setTitle(game.title)
    .setURL(game.url)
    .setColor(meta.color)
    .setFooter({ text: `${meta.emoji} ${game.store}` })
    .setTimestamp();

  if (game.imageUrl) embed.setThumbnail(game.imageUrl);

  const fields: { name: string; value: string; inline: boolean }[] = [];
  if (game.originalPrice) fields.push({ name: '💰 원래 가격', value: game.originalPrice, inline: true });
  if (game.endDate)       fields.push({ name: '⏰ 무료 종료', value: game.endDate,       inline: true });
  if (fields.length > 0)  embed.addFields(fields);

  return embed;
}

/** Games from `games` that this guild has not been notified about yet. */
export function filterNewForGuild(guildId: string, games: GameInfo[]): GameInfo[] {
  const notified = getGuildNotifiedIds(guildId);
  return games.filter(g => !notified.has(g.id));
}

export function markGamesNotifiedForGuild(guildId: string, games: GameInfo[]): void {
  for (const game of games) {
    markGuildNotified(guildId, game.id, game.title, game.store, game.endDateRaw);
  }
}

export async function postGamesToChannel(
  channel: TextChannel,
  games: GameInfo[],
  options: { mentionStoreRoles?: boolean; heading?: string } = {}
): Promise<void> {
  if (games.length === 0) return;

  await channel.send(options.heading ?? `🎁 **새로운 무료 게임 ${games.length}개 발견!**`);

  for (const game of games) {
    const roleId = options.mentionStoreRoles
      ? getStoreRole(channel.guildId, game.store)
      : undefined;

    await channel.send({
      content: roleId ? `<@&${roleId}>` : undefined,
      embeds: [buildEmbed(game)],
      allowedMentions: roleId ? { roles: [roleId] } : undefined,
    });
    await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY_MS));
  }
}
