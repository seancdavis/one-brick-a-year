// Canvas Path2D wrappers around the pure path data in src/lib/icon-paths.ts.
// Every icon is authored in a 24×24 box; ICON_SIZE_PX is the on-screen size
// drawStage scales them up to (see src/render/stage.ts).

import type { IconId } from '../lib/landmarks';
import { ICON_PATHS } from '../lib/icon-paths';

export interface Icon {
  path: Path2D;
  w: number;
  h: number;
}

const ICON_BOX_PX = 24;

// Written as an explicit object literal (not built via a loop over ICON_IDS)
// so that TypeScript checks this assignment against Record<IconId, Icon>
// directly: a missing or misspelled id fails `npm run typecheck`.
export const ICONS: Record<IconId, Icon> = {
  bricks: { path: new Path2D(ICON_PATHS.bricks), w: ICON_BOX_PX, h: ICON_BOX_PX },
  ruler: { path: new Path2D(ICON_PATHS.ruler), w: ICON_BOX_PX, h: ICON_BOX_PX },
  door: { path: new Path2D(ICON_PATHS.door), w: ICON_BOX_PX, h: ICON_BOX_PX },
  home: { path: new Path2D(ICON_PATHS.home), w: ICON_BOX_PX, h: ICON_BOX_PX },
  scroll: { path: new Path2D(ICON_PATHS.scroll), w: ICON_BOX_PX, h: ICON_BOX_PX },
  statue: { path: new Path2D(ICON_PATHS.statue), w: ICON_BOX_PX, h: ICON_BOX_PX },
  tower: { path: new Path2D(ICON_PATHS.tower), w: ICON_BOX_PX, h: ICON_BOX_PX },
  skyscraper: { path: new Path2D(ICON_PATHS.skyscraper), w: ICON_BOX_PX, h: ICON_BOX_PX },
  person: { path: new Path2D(ICON_PATHS.person), w: ICON_BOX_PX, h: ICON_BOX_PX },
  mountain: { path: new Path2D(ICON_PATHS.mountain), w: ICON_BOX_PX, h: ICON_BOX_PX },
  plane: { path: new Path2D(ICON_PATHS.plane), w: ICON_BOX_PX, h: ICON_BOX_PX },
  rocket: { path: new Path2D(ICON_PATHS.rocket), w: ICON_BOX_PX, h: ICON_BOX_PX },
  station: { path: new Path2D(ICON_PATHS.station), w: ICON_BOX_PX, h: ICON_BOX_PX },
  asteroid: { path: new Path2D(ICON_PATHS.asteroid), w: ICON_BOX_PX, h: ICON_BOX_PX },
  dinosaur: { path: new Path2D(ICON_PATHS.dinosaur), w: ICON_BOX_PX, h: ICON_BOX_PX },
  trilobite: { path: new Path2D(ICON_PATHS.trilobite), w: ICON_BOX_PX, h: ICON_BOX_PX },
  earth: { path: new Path2D(ICON_PATHS.earth), w: ICON_BOX_PX, h: ICON_BOX_PX },
  bubbles: { path: new Path2D(ICON_PATHS.bubbles), w: ICON_BOX_PX, h: ICON_BOX_PX },
  cell: { path: new Path2D(ICON_PATHS.cell), w: ICON_BOX_PX, h: ICON_BOX_PX },
  ring: { path: new Path2D(ICON_PATHS.ring), w: ICON_BOX_PX, h: ICON_BOX_PX },
};

export const ICON_SIZE_PX = 28;
