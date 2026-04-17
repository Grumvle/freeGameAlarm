import { GameInfo, Store } from '../types';
import { getEpicFreeGames } from './epic';
import { getSteamFreeGames } from './steam';
import { getGogFreeGames } from './gog';

const SCRAPERS: Record<Store, () => Promise<GameInfo[]>> = {
  'Epic Games': getEpicFreeGames,
  'Steam':      getSteamFreeGames,
  'GOG':        getGogFreeGames,
};

export async function getAllFreeGames(): Promise<GameInfo[]> {
  const entries = Object.entries(SCRAPERS) as [Store, () => Promise<GameInfo[]>][];
  const results = await Promise.allSettled(entries.map(([, fn]) => fn()));
  const games: GameInfo[] = [];

  for (let i = 0; i < results.length; i++) {
    const [store] = entries[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      console.log(`[${store}] ${result.value.length}개 무료 게임 발견`);
      games.push(...result.value);
    } else {
      console.error(`[${store}] 오류:`, result.reason);
    }
  }

  return games;
}
