import { describe, expect, it } from 'vitest';
import { ICON_PATHS } from './icon-paths';

describe('ICON_PATHS', () => {
  it('has a non-empty path starting with M for every icon id', () => {
    for (const path of Object.values(ICON_PATHS)) {
      expect(path).toBeTruthy();
      expect(path.length).toBeGreaterThan(0);
      expect(path.startsWith('M')).toBe(true);
    }
  });
});
