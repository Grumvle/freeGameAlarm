import { ChatInputCommandInteraction, Client, MessageFlags } from 'discord.js';
import { runManualCheck } from '../scheduler';

export async function handleCheck(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const { guilds, games, channels } = await runManualCheck(client);
    await interaction.editReply(
      games === 0
        ? '✅ 새로 알릴 무료 게임이 없습니다. (모든 서버 최신 상태)'
        : `✅ 새 무료 게임 **${games}건**을 ${guilds}개 서버 / ${channels}개 채널에 알렸습니다!`,
    );
  } catch (err) {
    console.error('[/check]', err);
    await interaction.editReply('❌ 확인 중 오류가 발생했습니다.').catch(() => {});
  }
}
