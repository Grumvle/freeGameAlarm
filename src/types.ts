export type Store = 'Epic Games' | 'Steam' | 'GOG';

export const ALL_STORES: Store[] = ['Epic Games', 'Steam', 'GOG'];

export interface GameInfo {
  id: string;
  title: string;
  store: Store;
  url: string;
  imageUrl?: string;
  originalPrice?: string;
  endDate?: string;
  endDateRaw?: string; // ISO 8601 문자열 — DB 만료 정리용
}
