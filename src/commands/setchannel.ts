import { ChatInputCommandInteraction, Client, MessageFlags, TextChannel } from 'discord.js';
import { getGuildChannels, registerChannel } from '../db';
import { getAllFreeGames } from '../scrapers';
import { markGamesNotified, postGamesToChannel } from '../notifier';

export async function handleSetChannel(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const { guildId } = interaction;
  if (!guildId || !(interaction.channel instanceof TextChannel)) {
    await interaction.reply({ content: '❌ 서버의 텍스트 채널에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const isFirst = getGuildChannels(guildId).length === 0;
  registerChannel(guildId, interaction.channelId);
  await interaction.reply({
    content: `✅ <#${interaction.channelId}> 채널이 무료 게임 알림 채널로 등록되었습니다.`,
    flags: MessageFlags.Ephemeral,
  });

  if (isFirst) {
    try {
      const games = await getAllFreeGames();
      if (games.length > 0) {
        await postGamesToChannel(interaction.channel as TextChannel, games, {
          heading: `🎮 **현재 무료 게임 ${games.length}개:**`,
        });
        markGamesNotified(games);
      } else {
        await interaction.followUp({ content: '현재 무료 게임이 없습니다.', flags: MessageFlags.Ephemeral });
      }
    } catch (err) {
      console.error('[setchannel] 현재 무료 게임 전송 실패:', err);
      await interaction.followUp({
        content: `❌ 무료 게임 목록 전송 실패: ${(err as Error).message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    }
  }
}
