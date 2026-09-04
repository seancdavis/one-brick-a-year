// The milestone list: moments in Earth's timeline the stack passes on its
// way back through time. Copy is written for an eight-year-old, facts
// checked. No DOM here — src/beats.ts turns these into cards.

export interface Beat {
  id: string;
  atYears: number;
  title: string;
  line: string;
}

export const BEATS: readonly Beat[] = [
  {
    id: 'writing',
    // Sumerian cuneiform, about 3200 BCE.
    atYears: 5000,
    title: 'People start writing.',
    line: 'Every history book ever written is about the bricks under this one.',
  },
  {
    id: 'humans',
    // Homo sapiens fossils at Jebel Irhoud, Morocco, about 300,000 years
    // (Hublin et al., Nature 2017).
    atYears: 300000,
    title: 'The first people.',
    line: 'Above this brick, nobody looked like us.',
  },
  {
    id: 'asteroid',
    // Chicxulub impact at the K–Pg boundary, 66.0 Ma (Renne et al., Science
    // 2013); impactor about 10 km wide, crater about 180 km.
    atYears: 66e6,
    title: 'The asteroid.',
    line: 'A rock six miles wide hits the Earth. The dinosaurs are gone. The hole it left is 110 miles across.',
  },
  {
    id: 'dinosaurs',
    // Earliest dinosaurs in the Carnian, about 230 to 235 Ma.
    atYears: 235e6,
    title: 'The first dinosaurs.',
    line: 'From here down to the asteroid is about 170 million bricks. A stack 1,600 kilometers tall.',
  },
  {
    id: 'animals',
    // Ediacaran biota about 575 Ma; sponge biomarkers to about 635 Ma (Love
    // et al., Nature 2009).
    atYears: 600e6,
    title: 'The first animals.',
    line: 'Soft and small, in the sea. No bones yet.',
  },
  {
    id: 'oxygen',
    // Great Oxidation Event about 2.4 Ga (Holland 2006).
    atYears: 2.4e9,
    title: 'The air gets oxygen.',
    line: "Tiny living things breathe out oxygen for a billion years. Before this, you couldn't breathe here.",
  },
  {
    id: 'life',
    // Isua, Greenland stromatolites about 3.7 Ga (Nutman et al., Nature 2016).
    atYears: 3.7e9,
    title: 'The first life.',
    line: 'Smaller than a speck. Everything alive comes from here.',
  },
];

// Returns beats in (fromYears, toYears], ascending.
export function beatsCrossed(prevYears: number, years: number): Beat[] {
  return BEATS.filter((beat) => prevYears < beat.atYears && beat.atYears <= years);
}
