import { ChatInputCommandInteraction, Client, MessageFlags } from 'discord.js';
import { unregisterChannel } from '../db';

export async function handleUnsetChannel(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const { guildId } = interaction;
  if (!guildId) {
    await interaction.reply({ content: '❌ 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  unregisterChannel(guildId, interaction.channelId);
  await interaction.reply({
    content: `✅ <#${interaction.channelId}> 채널의 무료 게임 알림이 해제되었습니다.`,
    flags: MessageFlags.Ephemeral,
  });
}
