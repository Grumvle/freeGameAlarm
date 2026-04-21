import { ChatInputCommandInteraction, Client, MessageFlags } from 'discord.js';
import { getAllFreeGames } from '../scrapers';
import { buildEmbed } from '../notifier';

export async function handleList(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const games = await getAllFreeGames();
    if (games.length === 0) {
      await interaction.editReply('😢 현재 무료 게임이 없습니다.');
      return;
    }
    await interaction.editReply(`🎮 **현재 무료 게임 ${games.length}개:**`);
    for (const game of games) {
      await interaction.followUp({ embeds: [buildEmbed(game)], flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    console.error('[/list]', err);
    await interaction.editReply('❌ 목록 조회 중 오류가 발생했습니다.').catch(() => {});
  }
}
