import { ChatInputCommandInteraction, Client, GuildMember, MessageFlags } from 'discord.js';
import { ALL_STORES, Store } from '../types';
import { getOrCreateStoreRole } from './roleUtils';

export async function handleSubscribe(interaction: ChatInputCommandInteraction, _client: Client): Promise<void> {
  if (!interaction.guildId || !interaction.guild || !(interaction.member instanceof GuildMember)) {
    await interaction.reply({ content: '❌ 서버의 텍스트 채널에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const value = interaction.options.getString('store', true);
  const stores: Store[] = value === 'all' ? [...ALL_STORES] : [value as Store];

  const assigned: string[] = [];
  for (const store of stores) {
    try {
      const roleId = await getOrCreateStoreRole(interaction.guild, store);
      await interaction.member.roles.add(roleId);
      assigned.push(store);
    } catch (err) {
      console.error(`[/subscribe] 역할 부여 실패 (${store}):`, err);
    }
  }

  await interaction.editReply(
    assigned.length > 0
      ? `✅ 구독 완료!\n${assigned.join('\n')}\n새 무료 게임이 나오면 이 채널에서 역할 멘션으로 알려드립니다.`
      : '❌ 역할 부여에 실패했습니다. 봇의 역할 관리 권한을 확인해주세요.'
  );
}
