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
}
