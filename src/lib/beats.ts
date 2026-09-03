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
    // Writing systems (e.g. cuneiform) emerge around 3,000 BCE, roughly 5,000 years ago.
    atYears: 5000,
    title: 'People start writing.',
    line: 'Every history book ever written is about the bricks under this one.',
  },
  {
    id: 'humans',
    // Homo sapiens emerge roughly 300,000 years ago.
    atYears: 300000,
    title: 'The first people.',
    line: 'Above this brick, nobody looked like us.',
  },
  {
    id: 'asteroid',
    // The Chicxulub asteroid impact, ending the age of the dinosaurs, was
    // about 66 million years ago and left a crater roughly 180 km (110 mi) wide.
    atYears: 66e6,
    title: 'The asteroid.',
    line: 'A rock six miles wide hits the Earth. The dinosaurs are gone. The hole it left is 110 miles across.',
  },
  {
    id: 'dinosaurs',
    // The first dinosaurs appear roughly 235 million years ago.
    atYears: 235e6,
    title: 'The first dinosaurs.',
    line: 'From here down to the asteroid is about 170 million bricks. A stack 1,600 kilometers tall.',
  },
  {
    id: 'animals',
    // The first animals appear roughly 600 million years ago.
    atYears: 600e6,
    title: 'The first animals.',
    line: 'Soft and small, in the sea. No bones yet.',
  },
  {
    id: 'oxygen',
    // The Great Oxidation Event begins roughly 2.4 billion years ago and lasted about a billion years.
    atYears: 2.4e9,
    title: 'The air gets oxygen.',
    line: "Tiny living things breathe out oxygen for a billion years. Before this, you couldn't breathe here.",
  },
  {
    id: 'life',
    // The earliest evidence of life on Earth dates to roughly 3.7 billion years ago.
    atYears: 3.7e9,
    title: 'The first life.',
    line: 'Smaller than a speck. Everything alive comes from here.',
  },
];

// Every beat the stack has just crossed going back in time, in ascending
// order. The caller (src/main.ts) tracks `prevYears` across steps.
export function beatsCrossed(prevYears: number, years: number): Beat[] {
  return BEATS.filter((beat) => prevYears < beat.atYears && beat.atYears <= years);
}
