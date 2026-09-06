// Which popup and pins are hanging off the tower right now, on each side.
// A popup is the one open fact (right) or comparison (left) per side — the
// paper note a child reads; a pin is everything older on that side, collapsed
// to a small tappable square on the brick it belongs to.
//
// Invariants:
// - The open popup is exactly one event (right) or one thing (left) — never a
//   bundle. 'latest' means the most recently passed one: the highest atYears
//   on the right, the tallest passed thing on the left. An id means a pin was
//   tapped and that one fact is being read instead.
// - Which item is open is chosen before anything is grouped, so a compaction
//   regrouping the bricks underneath can never change it. The open item's own
//   brick may still carry a pin — for the rest of that brick's members.
// - A pin carries every member of its brick, ascending (by atYears on the
//   right, by meters on the left), so src/popups.ts can key its DOM element on
//   the membership and rebuild it when that changes.
// - Pins are ascending by bricksFromGround; every passed item appears exactly
//   once across the open popup and the pins.
//
// Pure math only — src/popups.ts turns these models into DOM, and src/main.ts
// recomputes them every rendered frame. No DOM here.

import type { Beat } from './beats';
import { effectiveRenderUnit, type Compaction } from './compaction';
import type { ThingLandmark } from './landmarks';
import { bricksFor } from './sim';

export interface PopupModel {
  side: 'left' | 'right';
  // The drawn course this popup hangs from, counted from the ground at the
  // current effective render unit: bricksFromGround course-heights above the
  // ground line is exactly where the canvas draws this landmark's dashed
  // leader (src/render/stage.ts), so a popup never floats above the tower.
  bricksFromGround: number;
  // The right side's open event. Undefined for a left-side popup.
  event?: Beat;
  // The left side's open thing. Undefined for a right-side popup.
  thing?: ThingLandmark;
}

export interface PinModel {
  side: 'left' | 'right';
  bricksFromGround: number;
  // Every event this pin's brick holds, ascending by atYears — so the last is
  // the most recently passed, the one the pin is named and iconed after.
  // Empty on the left side.
  events: Beat[];
  // Every thing this pin's brick holds, ascending by meters — the last is the
  // tallest. Empty on the right side.
  things: ThingLandmark[];
  // How many members this pin stands for: 1 for a lone fact, 2 or more for a
  // bundle, which shows a count badge instead of an icon.
  count: number;
}

// Which popup is open on each side: an id (an event's or a thing's), or
// 'latest' for the most recently passed one — the default, and where a side
// returns whenever the stack passes something new on it.
export interface PopupSelection {
  right: string | 'latest';
  left: string | 'latest';
}

export interface PopupSide {
  open: PopupModel | null;
  pins: PinModel[];
}

// The drawn brick an item lands in: Math.floor(years / unit) at the unit
// actually being drawn (src/lib/compaction.ts's effectiveRenderUnit), so a
// compaction that merges ten courses into one merges their items into one
// pin, and an expansion splits them back.
function brickOf(years: number, unit: number): number {
  return Math.floor(years / unit);
}

// The leftovers of every brick once the open item has been taken out of it,
// as pins ascending by brick. `years` is how each member is placed on the
// tower — atYears for an event, the thing's own derived years for a thing.
function pinsFrom<T>(
  members: readonly T[],
  yearsOf: (member: T) => number,
  unit: number,
  toPin: (bricksFromGround: number, group: T[]) => PinModel,
): PinModel[] {
  const groups = new Map<number, T[]>();
  for (const member of members) {
    const brick = brickOf(yearsOf(member), unit);
    const group = groups.get(brick);
    if (group) group.push(member);
    else groups.set(brick, [member]);
  }

  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([brick, group]) => toPin(brick, group));
}

// Right side (time events): everything the stack has passed, with the
// selected event — or, for 'latest', the one with the highest atYears — open
// on its own, and every other passed event grouped into its brick's pin.
function rightSide(beats: readonly Beat[], years: number, unit: number, selection: PopupSelection['right']): PopupSide {
  const passed = beats.filter((beat) => beat.atYears <= years).sort((a, b) => a.atYears - b.atYears);
  if (passed.length === 0) return { open: null, pins: [] };

  // A selected id the stack no longer holds leaves this side with nothing
  // open; src/main.ts notices and falls back to 'latest'.
  const openEvent = selection === 'latest' ? passed[passed.length - 1] : (passed.find((b) => b.id === selection) ?? null);

  const open: PopupModel | null = openEvent
    ? { side: 'right', bricksFromGround: brickOf(openEvent.atYears, unit), event: openEvent }
    : null;

  const rest = openEvent ? passed.filter((b) => b.id !== openEvent.id) : passed;
  const pins = pinsFrom(rest, (b) => b.atYears, unit, (bricksFromGround, events) => ({
    side: 'right',
    bricksFromGround,
    events,
    things: [],
    count: events.length,
  }));

  return { open, pins };
}

// Left side (physical things): the same lifecycle, keyed off
// `thing.meters <= heightM` (the whole-brick height actually drawn,
// src/lib/sim.ts's heightM) rather than years, since a thing's height is the
// honest comparison (docs/content/candidate-heights.md). 'latest' is the
// tallest passed thing, which is what makes "when several things pass in one
// step, only the tallest opens" fall out for free.
function leftSide(
  things: readonly ThingLandmark[],
  heightM: number,
  unit: number,
  selection: PopupSelection['left'],
): PopupSide {
  const passed = things.filter((thing) => thing.meters <= heightM).sort((a, b) => a.meters - b.meters);
  if (passed.length === 0) return { open: null, pins: [] };

  const openThing = selection === 'latest' ? passed[passed.length - 1] : (passed.find((t) => t.id === selection) ?? null);

  const open: PopupModel | null = openThing
    ? { side: 'left', bricksFromGround: brickOf(openThing.years, unit), thing: openThing }
    : null;

  const rest = openThing ? passed.filter((t) => t.id !== openThing.id) : passed;
  const pins = pinsFrom(rest, (t) => t.years, unit, (bricksFromGround, group) => ({
    side: 'left',
    bricksFromGround,
    events: [],
    things: group,
    count: group.length,
  }));

  return { open, pins };
}

// The popup and pins for a build that has reached `years` (right side) and
// `heightM` (left side), given the compaction state and which item is open on
// each side. The whole-brick unit both sides bundle at is derived once from
// `years` with src/lib/sim.ts's bricksFor, the same function the drawn tower
// and the HUD's own count key off, so this can never disagree with what's on
// screen.
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
