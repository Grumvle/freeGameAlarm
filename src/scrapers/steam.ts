import axios from 'axios';
import * as cheerio from 'cheerio';
import { GameInfo } from '../types';

const SEARCH_URL = 'https://store.steampowered.com/search/';

export async function getSteamFreeGames(): Promise<GameInfo[]> {
  const { data } = await axios.get<string>(SEARCH_URL, {
    params: {
      maxprice: 'free',
      category1: '998,994',
      supportedlang: 'english',
      specials: 1,
      ndl: 1,
    },
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'Cookie': 'birthtime=631152001; mature_content=1; cc3804=1; wants_mature_content=1',
    },
    timeout: 15_000,
  });

  const $ = cheerio.load(data);
  const rows = $('a.search_result_row');
  console.log(`[Steam] 검색 결과 행 수: ${rows.length}`);

  const games: GameInfo[] = [];

  rows.each((_, el) => {
    const $el = $(el);

    // data-ds-appid 속성에서 바로 추출 (href 파싱보다 안정적)
    const appId = $el.attr('data-ds-appid');
    if (!appId) return;

    const title = $el.find('span.title').text().trim();
    if (!title) return;

    // 실제 HTML 구조: .discount_pct 에 "-100%" 텍스트
    const discountPct = $el.find('.discount_pct').text().trim();
    if (discountPct !== '-100%') return;

    // 원래 가격: .discount_original_price
    const originalPrice = $el.find('.discount_original_price').text().trim() || undefined;

    // 썸네일: .search_capsule img src 직접 사용
    const imageUrl = $el.find('.search_capsule img').attr('src') || undefined;

    games.push({
      id: `steam_${appId}`,
      title,
      store: 'Steam',
      url: `https://store.steampowered.com/app/${appId}/`,
      imageUrl,
      originalPrice,
    });
  });

  return games;
}
