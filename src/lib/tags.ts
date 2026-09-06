// Which paper tags are hanging off the tower right now, and which brick each
// one hangs from. The fact is part of the brick: the moment the stack passes
// a time event, that event's label leaves the canvas and becomes a tag
// attached to the course for its year. When the tower compacts, several
// events fall inside one drawn brick, so their tags fold into one bundle.
//
// Pure math only — src/tags.ts turns these models into DOM, and src/main.ts
// recomputes them every rendered frame. No DOM here.

import type { Beat } from './beats';
import { effectiveRenderUnit, type Compaction } from './compaction';
import { bricksFor } from './sim';

export interface TagModel {
  // 'tag' is one event; 'bundle' is 2 or more events sharing one drawn brick.
  kind: 'tag' | 'bundle';
  // The drawn course this tag hangs from, counted from the ground at the
  // current effective render unit: the tag's anchor sits `bricksFromGround`
  // course-heights above the ground line, which is exactly where the canvas
  // used to draw this event's dashed leader (src/render/stage.ts places a
  // landmark's line at ground - years x pxPerMeter, and one course is worth
  // `unit` years). So a tag never floats above the top of the tower.
  bricksFromGround: number;
  // Ascending by atYears. Exactly one event for a 'tag', 2 or more for a
  // 'bundle'; an event appears in exactly one model.
  events: Beat[];
}

// The tags for a build that has reached `years`, given the compaction state.
// The whole-brick count effectiveRenderUnit needs is derived from `years`
// with src/lib/sim.ts's bricksFor, the same function the drawn tower and the
// HUD's own count key off, so this can never disagree with what's on screen.
//
// Passed events are those with atYears <= years. They group by the drawn
// brick they land in — Math.floor(atYears / unit) at the unit actually being
// drawn (src/lib/compaction.ts's effectiveRenderUnit, the same one
// renderCourses and courseHeightPx key off) — so a compaction that merges
// ten courses into one merges their tags into one bundle, and an expansion
// splits them back. Ascending by brick; every passed event appears exactly
// once.
export function tagsFor(beats: readonly Beat[], years: number, compaction: Compaction): TagModel[] {
  const unit = effectiveRenderUnit(compaction, bricksFor(years));

  const groups = new Map<number, Beat[]>();
  for (const beat of beats) {
    if (beat.atYears > years) continue;
    const brick = Math.floor(beat.atYears / unit);
    const group = groups.get(brick);
    if (group) {
      group.push(beat);
    } else {
      groups.set(brick, [beat]);
    }
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bricksFromGround, events]) => ({
      kind: events.length > 1 ? ('bundle' as const) : ('tag' as const),
      bricksFromGround,
      events: [...events].sort((a, b) => a.atYears - b.atYears),
    }));
}
