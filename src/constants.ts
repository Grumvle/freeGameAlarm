import { Store } from './types';

export const STORE_META: Record<Store, { color: number; emoji: string }> = {
  'Epic Games': { color: 0x2b2b2b, emoji: '🎮' },
  'Steam':      { color: 0x1b2838, emoji: '🎯' },
  'GOG':        { color: 0x86328a, emoji: '🎁' },
};

export const MESSAGE_DELAY_MS = 1000;
