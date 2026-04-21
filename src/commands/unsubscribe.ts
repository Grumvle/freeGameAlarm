import { ChatInputCommandInteraction, Client, GuildMember, MessageFlags } from 'discord.js';
import { ALL_STORES, Store } from '../types';
import { getStoreRole } from '../db';

export async function handleUnsubscribe(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  const { guildId } = interaction;
  if (!guildId || !interaction.guild || !(interaction.member instanceof GuildMember)) {
    await interaction.reply({ content: '❌ 서버에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const value = interaction.options.getString('store', true);
  const stores: Store[] = value === 'all' ? [...ALL_STORES] : [value as Store];

  for (const store of stores) {
    const roleId = getStoreRole(guildId, store);
    if (roleId) {
      await interaction.member.roles.remove(roleId).catch(() => {});
    }
  }

  const label = value === 'all' ? '모든 유통사' : value;
  await interaction.editReply(`✅ **${label}** 구독을 해제했습니다.`);
}
