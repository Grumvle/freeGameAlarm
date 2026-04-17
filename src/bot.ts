import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextChannel,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import dotenv from 'dotenv';
import {
  getAndMarkNewGames,
  postGamesToChannel,
  dmSubscribers,
  buildEmbed,
} from './notifier';
import { getAllFreeGames } from './scrapers';
import {
  cleanupOldEntries,
  getSubscriptions, addSubscription, removeSubscription, clearSubscriptions,
  registerChannel, unregisterChannel, getAllChannels, getGuildChannels,
} from './db';
import { ALL_STORES, Store } from './types';

dotenv.config();

const TOKEN          = process.env.DISCORD_TOKEN;
const GUILD_ID       = process.env.DISCORD_GUILD_ID;
const INTERVAL_HOURS = parseInt(process.env.CHECK_INTERVAL_HOURS ?? '6', 10);

if (!TOKEN) {
  console.error('필수 환경변수 누락: DISCORD_TOKEN');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ── 슬래시 커맨드 정의 ────────────────────────────────────

const STORE_CHOICES = ALL_STORES.map(s => ({ name: s, value: s }));

const COMMANDS = [
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
    .setDescription('특정 유통사의 무료 게임 알림을 DM으로 구독합니다')
    .addStringOption(opt =>
      opt.setName('store')
        .setDescription('구독할 유통사')
        .setRequired(true)
        .addChoices(...STORE_CHOICES, { name: '전체', value: 'all' })
    ),

  new SlashCommandBuilder()
    .setName('unsubscribe')
    .setDescription('무료 게임 DM 알림 구독을 해제합니다')
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

// ── 커맨드 등록 ───────────────────────────────────────────

async function registerCommands(clientId: string): Promise<void> {
  const rest = new REST().setToken(TOKEN!);
  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(clientId, GUILD_ID), { body: COMMANDS });
    console.log(`슬래시 커맨드 등록 완료 (서버 ID: ${GUILD_ID})`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: COMMANDS });
    console.log('슬래시 커맨드 전역 등록 완료 (반영까지 최대 1시간 소요)');
  }
}

// ── 스케줄러 (등록된 모든 채널에 전송) ────────────────────

async function runCheck(): Promise<number> {
  const channels = getAllChannels();
  if (channels.length === 0) {
    console.log('[알림] 등록된 채널 없음 — /setchannel 로 채널을 등록하세요.');
    return 0;
  }

  const newGames = await getAndMarkNewGames();
  if (newGames.length === 0) return 0;

  for (const { channelId } of channels) {
    try {
      const ch = await client.channels.fetch(channelId);
      if (ch instanceof TextChannel) {
        await postGamesToChannel(ch, newGames);
      }
    } catch (err) {
      console.error(`[알림] 채널 ${channelId} 전송 실패:`, err);
    }
  }

  await dmSubscribers(client, newGames);
  return newGames.length;
}

function startScheduler(): void {
  setInterval(async () => {
    console.log(`[스케줄러] 확인 시작 (${new Date().toLocaleString('ko-KR')})`);
    try {
      const count = await runCheck();
      console.log(`[스케줄러] 완료 — 새 게임 ${count}개`);
      cleanupOldEntries(30);
    } catch (err) {
      console.error('[스케줄러] 오류:', err);
    }
  }, INTERVAL_HOURS * 60 * 60 * 1000);

  console.log(`[스케줄러] ${INTERVAL_HOURS}시간마다 자동 확인 예약됨`);
}

// ── 봇 이벤트 ─────────────────────────────────────────────

client.once('clientReady', async (readyClient) => {
  console.log(`✅ 봇 로그인: ${readyClient.user.tag}`);
  await registerCommands(readyClient.user.id).catch(err =>
    console.error('커맨드 등록 실패:', err)
  );
  startScheduler();

  console.log('[시작] 초기 무료 게임 확인...');
  const count = await runCheck().catch(err => {
    console.error('[시작] 오류:', err);
    return 0;
  });
  console.log(`[시작] 완료 — 새 게임 ${count}개`);
});

// ── 인터랙션 핸들러 ───────────────────────────────────────

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, user, guildId } = interaction;

  // ── /setchannel ─────────────────────────────────────────
  if (commandName === 'setchannel') {
    if (!guildId || !(interaction.channel instanceof TextChannel)) {
      await interaction.reply({ content: '❌ 서버의 텍스트 채널에서만 사용 가능합니다.', flags: MessageFlags.Ephemeral });
      return;
    }
    registerChannel(guildId, interaction.channelId);
    await interaction.reply({
      content: `✅ <#${interaction.channelId}> 채널이 무료 게임 알림 채널로 등록되었습니다.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── /unsetchannel ────────────────────────────────────────
  if (commandName === 'unsetchannel') {
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

  // ── /check ───────────────────────────────────────────────
  if (commandName === 'check') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const count = await runCheck();
      const channels = getAllChannels();
      await interaction.editReply(
        count === 0
          ? `✅ 새로운 무료 게임이 없습니다. (알림 채널 ${channels.length}개)`
          : `✅ **${count}개**의 새 무료 게임을 ${channels.length}개 채널에 알렸습니다!`
      );
    } catch (err) {
      console.error('[/check]', err);
      await interaction.editReply('❌ 확인 중 오류가 발생했습니다.').catch(() => {});
    }
  }

  // ── /list ────────────────────────────────────────────────
  if (commandName === 'list') {
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

  // ── /subscribe ───────────────────────────────────────────
  if (commandName === 'subscribe') {
    const value = interaction.options.getString('store', true);
    const stores: Store[] = value === 'all' ? [...ALL_STORES] : [value as Store];

    for (const store of stores) addSubscription(user.id, store);

    const label = value === 'all' ? '전체 유통사' : value;
    await interaction.reply({
      content: `✅ **${label}** 구독 완료!\n새 무료 게임이 나오면 DM으로 알려드립니다.\n(Discord 개인 메시지 허용이 필요합니다)`,
      flags: MessageFlags.Ephemeral,
    });
  }

  // ── /unsubscribe ─────────────────────────────────────────
  if (commandName === 'unsubscribe') {
    const value = interaction.options.getString('store', true);
    if (value === 'all') {
      clearSubscriptions(user.id);
      await interaction.reply({ content: '✅ 모든 구독을 해제했습니다.', flags: MessageFlags.Ephemeral });
    } else {
      removeSubscription(user.id, value);
      await interaction.reply({ content: `✅ **${value}** 구독을 해제했습니다.`, flags: MessageFlags.Ephemeral });
    }
  }

  // ── /subscriptions ───────────────────────────────────────
  if (commandName === 'subscriptions') {
    const subs = getSubscriptions(user.id);

    // 이 서버에 등록된 알림 채널도 같이 표시
    const channelIds = guildId ? getGuildChannels(guildId) : [];
    const channelMentions = channelIds.map(id => `<#${id}>`).join(', ') || '없음';

    const embed = new EmbedBuilder()
      .setTitle('📋 무료 게임 알림 현황')
      .setColor(0x5865f2)
      .setTimestamp()
      .addFields(
        {
          name: '🔔 이 서버 알림 채널',
          value: channelMentions,
          inline: false,
        },
        {
          name: '📬 내 DM 구독',
          value: ALL_STORES.map(s => `${subs.includes(s) ? '✅' : '❌'} ${s}`).join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: '구독 변경: /subscribe 또는 /unsubscribe' });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
});

client.login(TOKEN);
