import { describe, it, expect } from 'vitest';
import { AssetCache, CHARACTER_ASSETS } from './assets';

describe('AssetCache', () => {
  it('exposes the six expected character keys', () => {
    expect(CHARACTER_ASSETS.map(a => a.id).sort()).toEqual([
      'boss', 'brute', 'margate_tossworthy', 'mistress_quill',
      'runner', 'sir_pommelry',
    ]);
  });

  it('throws on get() before preloadAll resolves', () => {
    const cache = new AssetCache();
    expect(() => cache.get('runner')).toThrow(/preload/i);
  });
});
