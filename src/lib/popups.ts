// Which popups and pins are hanging off the tower right now, on each side.
// A popup is the one open fact (or comparison) per side — the paper tag a
// child can read; a pin is everything older, collapsed to a small tappable
// square (docs/autopilot/2026-09-06-popups-and-menu.md's "Popups and pins").
// The fact (or thing) is part of the brick: the moment the stack passes a
// time event or a physical thing, it leaves the canvas label and joins the
// tower's course for its year, exactly as round 4's retired tags module worked —
// this module adds the "only one open per side" lifecycle and the left
// side's things on top of that.
//
// Pure math only — src/popups.ts (slice 2) turns these models into DOM, and
// src/main.ts recomputes them every rendered frame. No DOM here.

import type { Beat } from './beats';
import { effectiveRenderUnit, type Compaction } from './compaction';
import type { ThingLandmark } from './landmarks';
import { bricksFor } from './sim';

export interface PopupModel {
  side: 'left' | 'right';
  // The drawn course this popup hangs from, counted from the ground at the
  // current effective render unit — see round 4's retired TagModel for the
  // same convention: bricksFromGround course-heights above the
  // ground line is exactly where the canvas draws this landmark's dashed
  // leader (src/render/stage.ts), so a popup never floats above the tower.
  bricksFromGround: number;
  // The right side's events, ascending by atYears — exactly one for an
  // un-bundled brick, 2 or more once compaction folds several into one
  // drawn course. Empty for a left-side (thing) popup.
  events: Beat[];
  // The left side's thing. Ordinarily exactly one thing shares a drawn
  // brick, so this is that thing; if compaction ever bundles two or more
  // things into the same course, this is the tallest of them (see
  // popupsFor's leftSide). Undefined for a right-side (event) popup.
  thing?: ThingLandmark;
}

export interface PinModel {
  side: 'left' | 'right';
  bricksFromGround: number;
  events: Beat[];
  thing?: ThingLandmark;
  // How many facts (right) or things (left) this pin's brick holds — 1 for
  // an un-bundled brick, 2 or more for a bundle, shown as a small count
  // badge instead of an icon (round 5's "Popups and pins").
  count: number;
}

// Which popup is open on each side: a string is the id of an event or thing
// most recently tapped; 'latest' means the most recently passed one (the
// default, before anything has been tapped); null means nothing open at all.
export interface PopupSelection {
  right: string | 'latest' | null;
  left: string | 'latest' | null;
}

export interface PopupSide {
  open: PopupModel | null;
  pins: PinModel[];
}

interface EventGroup {
  bricksFromGround: number;
  events: Beat[];
}

interface ThingGroup {
  bricksFromGround: number;
  // Ascending by meters, so the last entry is the tallest — the group's
  // "newest" thing, the same convention round 4's retired tags module used for a bundle's
  // newest event.
  things: ThingLandmark[];
}

// Groups passed events by the drawn brick they land in — Math.floor(atYears
// / unit) at the unit actually being drawn (src/lib/compaction.ts's
// effectiveRenderUnit) — so a compaction that merges ten courses into one
// merges their events into one group, and an expansion splits them back.
// Ascending by brick; every passed event appears exactly once. Ported
// verbatim from round 4's retired tagsFor.
function groupEvents(beats: readonly Beat[], years: number, unit: number): EventGroup[] {
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
      bricksFromGround,
      events: [...events].sort((a, b) => a.atYears - b.atYears),
    }));
}

// The same grouping as groupEvents, keyed off a thing's own `years` (derived
// from its height, src/lib/landmarks.ts's fromMeters) so a thing and an
// event that land in the same real year still land in the same-numbered
// brick — the two sides just never share a group, since they're stacked
// independently (src/lib/layout.ts).
function groupThings(things: readonly ThingLandmark[], heightM: number, unit: number): ThingGroup[] {
  const groups = new Map<number, ThingLandmark[]>();
  for (const thing of things) {
    if (thing.meters > heightM) continue;
    const brick = Math.floor(thing.years / unit);
    const group = groups.get(brick);
    if (group) {
      group.push(thing);
    } else {
      groups.set(brick, [thing]);
    }
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bricksFromGround, list]) => ({
      bricksFromGround,
      things: [...list].sort((a, b) => a.meters - b.meters),
    }));
}

// Right side (time events): the open popup is the group holding `selection`,
// or the latest-passed group (the highest brick — groups are ascending) for
// 'latest', or nothing for null. Every other group becomes a pin, its count
// the number of events it bundles.
function rightSide(beats: readonly Beat[], years: number, unit: number, selection: PopupSelection['right']): PopupSide {
  const groups = groupEvents(beats, years, unit);
  if (groups.length === 0) return { open: null, pins: [] };

  const openIndex =
    selection === null
      ? -1
      : selection === 'latest'
        ? groups.length - 1
        : groups.findIndex((g) => g.events.some((e) => e.id === selection));

  const open: PopupModel | null =
    openIndex >= 0
      ? { side: 'right', bricksFromGround: groups[openIndex].bricksFromGround, events: groups[openIndex].events }
      : null;

  const pins: PinModel[] = groups
    .filter((_, i) => i !== openIndex)
    .map((g) => ({ side: 'right', bricksFromGround: g.bricksFromGround, events: g.events, count: g.events.length }));

  return { open, pins };
}

// Left side (physical things): the same lifecycle as the right side, keyed
// off `thing.meters <= heightM` (the whole-brick height actually drawn,
// src/lib/sim.ts's heightM) rather than years, since a thing's height is the
// honest comparison (docs/content/candidate-heights.md). No bundling by
// default — a group ordinarily holds one thing — but if two things ever
// share a drawn brick under heavy compaction, they bundle exactly like the
// right side, and the group's popup/pin carries its tallest member: "when
// several things pass in one step, latest is the tallest" is then just the
// same "pick the highest-brick group" rule as the right side, since ascending
// brick order tracks ascending height.
function leftSide(
  things: readonly ThingLandmark[],
  heightM: number,
  unit: number,
  selection: PopupSelection['left'],
): PopupSide {
  const groups = groupThings(things, heightM, unit);
  if (groups.length === 0) return { open: null, pins: [] };

  const openIndex =
    selection === null
      ? -1
      : selection === 'latest'
        ? groups.length - 1
        : groups.findIndex((g) => g.things.some((t) => t.id === selection));

  const tallest = (g: ThingGroup) => g.things[g.things.length - 1];

  const open: PopupModel | null =
    openIndex >= 0
      ? { side: 'left', bricksFromGround: groups[openIndex].bricksFromGround, events: [], thing: tallest(groups[openIndex]) }
      : null;

  const pins: PinModel[] = groups
    .filter((_, i) => i !== openIndex)
    .map((g) => ({
      side: 'left',
      bricksFromGround: g.bricksFromGround,
      events: [],
      thing: tallest(g),
      count: g.things.length,
    }));

  return { open, pins };
}

// The popups and pins for a build that has reached `years` (right side) and
// `heightM` (left side), given the compaction state and which popup, if any,
// is open on each side. The whole-brick unit both sides bundle at is derived
// once from `years` with src/lib/sim.ts's bricksFor, the same function the
// drawn tower and the HUD's own count key off, so this can never disagree
// with what's on screen.
export function popupsFor(args: {
  beats: readonly Beat[];
  things: readonly ThingLandmark[];
  years: number;
  heightM: number;
  compaction: Compaction;
  selection: PopupSelection;
}): { right: PopupSide; left: PopupSide } {
  const unit = effectiveRenderUnit(args.compaction, bricksFor(args.years));
  return {
    right: rightSide(args.beats, args.years, unit, args.selection.right),
    left: leftSide(args.things, args.heightM, unit, args.selection.left),
  };
}
