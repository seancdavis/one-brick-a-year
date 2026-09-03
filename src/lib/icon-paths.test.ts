import { describe, expect, it } from 'vitest';
import { ICON_IDS } from './landmarks';
import { ICON_PATHS } from './icon-paths';

describe('ICON_PATHS', () => {
  it('has a non-empty path starting with M for every icon id', () => {
    for (const id of ICON_IDS) {
      const path = ICON_PATHS[id];
      expect(path).toBeTruthy();
      expect(path.length).toBeGreaterThan(0);
      expect(path.startsWith('M')).toBe(true);
    }
  });
});
