import { ChatInputCommandInteraction, Client, EmbedBuilder, GuildMember, MessageFlags } from 'discord.js';
import { ALL_STORES } from '../types';
import { getGuildChannels, getStoreRole } from '../db';

export async function handleSubscriptions(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  if (!(interaction.member instanceof GuildMember)) {
    await interaction.reply({ content: '❌ 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }

  const { guildId } = interaction;
  const member = interaction.member;

  const channelIds = guildId ? getGuildChannels(guildId) : [];
  const channelMentions = channelIds.map(id => `<#${id}>`).join(', ') || '없음';

  const subLines = ALL_STORES.map(s => {
    const roleId = guildId ? getStoreRole(guildId, s) : undefined;
    const hasRole = roleId ? member.roles.cache.has(roleId) : false;
    return hasRole ? `✅ ${s} (<@&${roleId}>)` : `❌ ${s}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('📋 무료 게임 알림 현황')
    .setColor(0x5865f2)
    .setTimestamp()
    .addFields(
      { name: '🔔 이 서버 알림 채널', value: channelMentions, inline: false },
      { name: '📣 내 구독 역할',       value: subLines.join('\n'),  inline: false },
    )
    .setFooter({ text: '구독 변경: /subscribe 또는 /unsubscribe' });

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
