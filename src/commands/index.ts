import {
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { ALL_STORES } from '../types';
import { handleSetChannel } from './setchannel';
import { handleUnsetChannel } from './unsetchannel';
import { handleCheck } from './check';
import { handleList } from './list';
import { handleSubscribe } from './subscribe';
import { handleUnsubscribe } from './unsubscribe';
import { handleSubscriptions } from './subscriptions';

export type CommandHandler = (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;

const STORE_CHOICES = ALL_STORES.map(s => ({ name: s, value: s }));

export const COMMANDS = [
  new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('[관리자] 현재 채널을 무료 게임 알림 채널로 등록합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('unsetchannel')
    .setDescription('[관리자] 현재 채널의 무료 게임 알림을 해제합니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('check')
    .setDescription('[관리자] 무료 게임을 지금 바로 확인하고 등록된 모든 채널에 알립니다')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('list')
    .setDescription('현재 무료 게임 전체 목록을 표시합니다'),

  new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('특정 유통사의 무료 게임 알림 역할을 구독합니다')
    .addStringOption(opt =>
      opt.setName('store')
        .setDescription('구독할 유통사')
        .setRequired(true)
        .addChoices(...STORE_CHOICES, { name: '전체', value: 'all' })
    ),

  new SlashCommandBuilder()
    .setName('unsubscribe')
    .setDescription('무료 게임 알림 역할 구독을 해제합니다')
    .addStringOption(opt =>
      opt.setName('store')
        .setDescription('구독 해제할 유통사')
        .setRequired(true)
        .addChoices(...STORE_CHOICES, { name: '전체', value: 'all' })
    ),

  new SlashCommandBuilder()
    .setName('subscriptions')
    .setDescription('현재 나의 구독 현황을 확인합니다'),
].map(cmd => cmd.toJSON());

const handlers: Record<string, CommandHandler> = {
  setchannel:    handleSetChannel,
  unsetchannel:  handleUnsetChannel,
  check:         handleCheck,
  list:          handleList,
  subscribe:     handleSubscribe,
  unsubscribe:   handleUnsubscribe,
  subscriptions: handleSubscriptions,
};

export async function dispatch(interaction: ChatInputCommandInteraction, client: Client): Promise<void> {
  const handler = handlers[interaction.commandName];
  if (handler) await handler(interaction, client);
}
