import { Guild } from 'discord.js';
import { Store } from '../types';
import { STORE_META } from '../constants';
import { getStoreRole, setStoreRole } from '../db';

export async function getOrCreateStoreRole(guild: Guild, store: Store): Promise<string> {
  const existing = getStoreRole(guild.id, store);
  if (existing) {
    const role = guild.roles.cache.get(existing) ?? await guild.roles.fetch(existing).catch(() => null);
    if (role) {
      if (!role.mentionable) {
        await role.edit({ mentionable: true, reason: '무료 게임 알림 역할 멘션 허용' });
      }
      return role.id;
    }
  }

  const role = await guild.roles.create({
    name: `${store} 알림`,
    color: STORE_META[store].color,
    mentionable: true,
    reason: '무료 게임 알림 구독 역할',
  });
  setStoreRole(guild.id, store, role.id);
  return role.id;
}
