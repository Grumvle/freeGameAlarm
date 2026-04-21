import { ChatInputCommandInteraction, Client, MessageFlags } from 'discord.js';
import { broadcast } from '../scheduler';

export async function handleCheck(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const { gameCount, sent, total } = await broadcast(client);
    await interaction.editReply(
      gameCount === 0
        ? `✅ 새로운 무료 게임이 없습니다. (알림 채널 ${total}개)`
        : `✅ **${gameCount}개**의 새 무료 게임을 ${sent}/${total}개 채널에 알렸습니다!`
    );
  } catch (err) {
    console.error('[/check]', err);
    await interaction.editReply('❌ 확인 중 오류가 발생했습니다.').catch(() => {});
  }
}
