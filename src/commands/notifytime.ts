import { ChatInputCommandInteraction, Client, MessageFlags } from 'discord.js';
import { getNotifyHour, setNotifyHour } from '../db';

export async function handleNotifyTime(
  interaction: ChatInputCommandInteraction,
  _client: Client,
): Promise<void> {
  const { guildId } = interaction;
  if (!guildId) {
    await interaction.reply({
      content: '❌ 서버에서만 사용 가능합니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const hour = interaction.options.getInteger('hour');

  // No argument → show the current setting.
  if (hour === null) {
    const current = getNotifyHour(guildId);
    await interaction.reply({
      content:
        `⏰ 현재 이 서버의 무료 게임 알림 시각은 매일 **${current}시 (KST)** 입니다.\n` +
        '변경하려면 `/notifytime hour:<0-23>` 를 사용하세요.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (hour < 0 || hour > 23) {
    await interaction.reply({
      content: '❌ 시각은 0~23 사이의 숫자여야 합니다.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  setNotifyHour(guildId, hour);
  await interaction.reply({
    content: `✅ 무료 게임 알림 시각이 매일 **${hour}시 (KST)** 로 설정되었습니다.`,
    flags: MessageFlags.Ephemeral,
  });
}
