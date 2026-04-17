import axios from 'axios';
import { GameInfo } from '../types';

const API_URL =
  'https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions';

interface PromoOffer {
  startDate: string;
  endDate: string;
  discountSetting: { discountPercentage: number };
}

interface EpicElement {
  title: string;
  productSlug: string | null;
  urlSlug: string | null;
  catalogNs?: { mappings?: Array<{ pageSlug: string; pageType: string }> };
  price: {
    totalPrice: {
      originalPrice: number;
      currencyCode: string;
      fmtPrice: { originalPrice: string };
    };
  };
  promotions: {
    promotionalOffers: Array<{ promotionalOffers: PromoOffer[] }>;
  } | null;
  keyImages: Array<{ type: string; url: string }>;
}

interface EpicApiResponse {
  data: { Catalog: { searchStore: { elements: EpicElement[] } } };
}

function getSlug(el: EpicElement): string | null {
  return (
    el.catalogNs?.mappings?.find(m => m.pageType === 'productHome')?.pageSlug ??
    el.productSlug ??
    el.urlSlug ??
    null
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function getEpicFreeGames(): Promise<GameInfo[]> {
  const { data } = await axios.get<EpicApiResponse>(API_URL, {
    params: { locale: 'ko', country: 'KR', allowCountries: 'KR' },
    timeout: 10_000,
  });

  const elements = data.data.Catalog.searchStore.elements;
  const games: GameInfo[] = [];

  for (const el of elements) {
    if (!el.promotions) continue;

    const currentGroups = el.promotions.promotionalOffers;
    const activeOffer = currentGroups
      .flatMap(g => g.promotionalOffers)
      .find(o => o.discountSetting.discountPercentage === 0);

    if (!activeOffer) continue;
    if (el.price.totalPrice.originalPrice === 0) continue; // F2P 제외

    const slug = getSlug(el);
    if (!slug) continue;

    const thumbnail =
      el.keyImages.find(img =>
        ['Thumbnail', 'DieselStoreFrontWide'].includes(img.type)
      )?.url ?? el.keyImages[0]?.url;

    games.push({
      id: `epic_${slug}`,
      title: el.title,
      store: 'Epic Games',
      url: `https://store.epicgames.com/ko/p/${slug}`,
      imageUrl: thumbnail,
      originalPrice: el.price.totalPrice.fmtPrice.originalPrice,
      endDate: formatDate(activeOffer.endDate),
    });
  }

  return games;
}
