import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { COMMANDS, dispatch } from './commands';
import { broadcast, startScheduler } from './scheduler';
import { getAllChannels } from './db';

dotenv.config();

const TOKEN          = process.env.DISCORD_TOKEN;
const GUILD_ID       = process.env.DISCORD_GUILD_ID;
const INTERVAL_HOURS = parseInt(process.env.CHECK_INTERVAL_HOURS ?? '6', 10);

if (!TOKEN) {
  console.error('필수 환경변수 누락: DISCORD_TOKEN');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function registerCommands(clientId: string): Promise<void> {
  const rest = new REST().setToken(TOKEN!);
  await rest.put(Routes.applicationCommands(clientId), { body: COMMANDS });
  console.log('슬래시 커맨드 전역 등록 완료');

  if (GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(clientId, GUILD_ID), { body: COMMANDS });
    console.log(`슬래시 커맨드 서버 등록 완료 (서버 ID: ${GUILD_ID})`);
  }
}

client.once('clientReady', async (readyClient) => {
  console.log(`✅ 봇 로그인: ${readyClient.user.tag}`);
  await registerCommands(readyClient.user.id).catch(err =>
    console.error('커맨드 등록 실패:', err)
  );
  startScheduler(client, INTERVAL_HOURS);

  if (getAllChannels().length > 0) {
    const { gameCount, sent, total } = await broadcast(client).catch(err => {
      console.error('[시작] 오류:', err);
      return { gameCount: 0, sent: 0, total: 0 };
    });
    if (gameCount > 0) {
      console.log(`[시작] 새 무료 게임 ${gameCount}개 → ${sent}/${total}개 채널 전송 완료`);
    } else {
      console.log('[시작] 새로운 무료 게임 없음 — 알림 건너뜀');
    }
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  await dispatch(interaction, client).catch(err =>
    console.error(`[${interaction.commandName}] 처리 오류:`, err)
  );
});

client.login(TOKEN);
