// Canvas Path2D wrappers around the pure path data in src/lib/icon-paths.ts,
// which is the single source of truth for the icon catalog. Every icon is
// authored in a 24×24 box; src/render/stage.ts scales them up to its own
// on-screen sizes.

import { ICON_PATHS, type IconId } from '../lib/icon-paths';

export const ICONS: Record<IconId, Path2D> = Object.fromEntries(
  (Object.entries(ICON_PATHS) as [IconId, string][]).map(([id, path]) => [id, new Path2D(path)]),
) as Record<IconId, Path2D>;
