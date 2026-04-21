import axios from 'axios';
import * as cheerio from 'cheerio';
import { GameInfo } from '../types';

const AJAX_URL = 'https://www.gog.com/games/ajax/filtered';
const GIVEAWAY_URL = 'https://www.gog.com/giveaway/claim';

interface GogPrice {
  amount: string;
  baseAmount: string;
  finalAmount: string;
  isDiscounted: boolean;
  discountPercentage: number;
  isFree: boolean;
}

interface GogProduct {
  id: number;
  title: string;
  slug: string;
  image: string;
  url: string;
  price: GogPrice;
}

interface GogApiResponse {
  products: GogProduct[];
  totalGamesCount: number;
}

function toAbsoluteUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://www.gog.com${url}`;
  return url;
}

// GOG ajax/filtered API: price=free → 100% 할인 게임 포함
export async function getGogFreeGames(): Promise<GameInfo[]> {
  const { data } = await axios.get<GogApiResponse>(AJAX_URL, {
    params: { mediaType: 'game', price: 'free', page: 1 },
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
    timeout: 10_000,
  });

  const games: GameInfo[] = [];

  for (const p of data.products) {
    const { price } = p;

    // 100% 할인된 유료 게임만 포함 (영구 무료 F2P 제외)
    const isPaidNowFree =
      price.isDiscounted &&
      price.discountPercentage === 100 &&
      parseFloat(price.baseAmount) > 0;

    if (!isPaidNowFree) continue;

    games.push({
      id: `gog_${p.id}`,
      title: p.title,
      store: 'GOG',
      url: toAbsoluteUrl(p.url),
      imageUrl: `${toAbsoluteUrl(p.image)}.jpg`,
      originalPrice: `$${price.baseAmount}`,
    });
  }

  // GOG 공식 무료 증정 이벤트 페이지 별도 확인
  const giveaway = await scrapeGogGiveaway();
  for (const g of giveaway) {
    if (!games.some(existing => existing.id === g.id)) {
      games.push(g);
    }
  }

  return games;
}

// GOG는 주기적으로 /giveaway/claim 에서 단일 게임을 무료 증정
async function scrapeGogGiveaway(): Promise<GameInfo[]> {
  try {
    const { data, status } = await axios.get<string>(GIVEAWAY_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 10_000,
      validateStatus: s => s < 500,
    });

    // 기브어웨이 없을 때 리다이렉트/404
    if (status !== 200 || typeof data !== 'string') return [];

    const $ = cheerio.load(data);

    // 게임 제목: 여러 선택자 시도
    const title =
      $('[class*="giveaway__title"]').first().text().trim() ||
      $('[ng-if*="giveaway"], [class*="giveaway"] h1').first().text().trim() ||
      $('h1').first().text().trim();

    if (!title || title.length < 2) return [];

    const imageUrl =
      $('[class*="giveaway"] img').first().attr('src') ||
      $('meta[property="og:image"]').attr('content');

    return [
      {
        id: `gog_giveaway_${title.toLowerCase().replace(/\W+/g, '_')}`,
        title,
        store: 'GOG',
        url: GIVEAWAY_URL,
        imageUrl,
      },
    ];
  } catch {
    return [];
  }
}
