import { BRICK_M } from './constants';

// The set of flat, single-color icons drawn beside each landmark's label.
// Mirrored by the ICONS record in src/render/icons.ts (slice 4).
export type IconId =
  | 'bricks'
  | 'ruler'
  | 'door'
  | 'home'
  | 'scroll'
  | 'statue'
  | 'tower'
  | 'skyscraper'
  | 'person'
  | 'mountain'
  | 'plane'
  | 'rocket'
  | 'station'
  | 'asteroid'
  | 'dinosaur'
  | 'trilobite'
  | 'earth'
  | 'bubbles'
  | 'cell'
  | 'ring';

export const ICON_IDS: readonly IconId[] = [
  'bricks',
  'ruler',
  'door',
  'home',
  'scroll',
  'statue',
  'tower',
  'skyscraper',
  'person',
  'mountain',
  'plane',
  'rocket',
  'station',
  'asteroid',
  'dinosaur',
  'trilobite',
  'earth',
  'bubbles',
  'cell',
  'ring',
];

export interface Landmark {
  id: string;
  kind: 'thing' | 'time';
  meters: number;
  years: number;
  label: string;
  icon: IconId;
}

// The minimal shape of the personalization profile buildLandmarks needs.
// Slice 6 moves the full `Personalization` type to src/lib/personalize.ts and this becomes an alias for it.
interface Profile {
  name: string;
  ageYears: number;
  homeMeters: number;
}

export function buildLandmarks(profile: Profile): Landmark[] {
  const landmarks: Landmark[] = [
    {
      // The child's own age, set at the start screen (default 8).
      id: 'life',
      kind: 'time',
      label: 'your whole life',
      icon: 'bricks',
      years: profile.ageYears,
      meters: profile.ageYears * BRICK_M,
    },
    {
      // A standard 30 cm school ruler.
      id: 'ruler',
      kind: 'thing',
      label: 'a school ruler',
      icon: 'ruler',
      meters: 0.3,
      years: 0.3 / BRICK_M,
    },
    {
      // A standard interior door is about 2 m tall.
      id: 'door',
      kind: 'thing',
      label: 'a door',
      icon: 'door',
      meters: 2.0,
      years: 2.0 / BRICK_M,
    },
    {
      // Chosen at the start screen: one-story home 4 m, two-story home 8 m (default), or apartment building 30 m.
      id: 'home',
      kind: 'thing',
      label: 'your home',
      icon: 'home',
      meters: profile.homeMeters,
      years: profile.homeMeters / BRICK_M,
    },
    {
      // Writing systems (e.g. cuneiform) emerge around 3000 BCE, roughly 5,000 years ago.
      id: 'writing',
      kind: 'time',
      label: 'people start writing things down',
      icon: 'scroll',
      years: 5000,
      meters: 5000 * BRICK_M,
    },
    {
      // The Statue of Liberty is 93 m tall, including its pedestal.
      id: 'liberty',
      kind: 'thing',
      label: 'the Statue of Liberty',
      icon: 'statue',
      meters: 93,
      years: 93 / BRICK_M,
    },
    {
      // The Eiffel Tower is 330 m tall, including antennas.
      id: 'eiffel',
      kind: 'thing',
      label: 'the Eiffel Tower',
      icon: 'tower',
      meters: 330,
      years: 330 / BRICK_M,
    },
    {
      // The Burj Khalifa, the tallest building on Earth, is 828 m tall.
      id: 'burj',
      kind: 'thing',
      label: 'the tallest building on Earth',
      icon: 'skyscraper',
      meters: 828,
      years: 828 / BRICK_M,
    },
    {
      // Homo sapiens emerge roughly 300,000 years ago.
      id: 'humans',
      kind: 'time',
      label: 'the first people',
      icon: 'person',
      years: 300000,
      meters: 300000 * BRICK_M,
    },
    {
      // Mount Everest stands 8,849 m above sea level.
      id: 'everest',
      kind: 'thing',
      label: 'Mount Everest',
      icon: 'mountain',
      meters: 8849,
      years: 8849 / BRICK_M,
    },
    {
      // Commercial airliners cruise around 11,000 m (36,000 ft).
      id: 'planes',
      kind: 'thing',
      label: 'where airplanes fly',
      icon: 'plane',
      meters: 11000,
      years: 11000 / BRICK_M,
    },
    {
      // The Kármán line, the common boundary of space, is 100,000 m (100 km) up.
      id: 'space',
      kind: 'thing',
      label: 'space begins',
      icon: 'rocket',
      meters: 100000,
      years: 100000 / BRICK_M,
    },
    {
      // The International Space Station orbits at roughly 400,000 m (400 km).
      id: 'iss',
      kind: 'thing',
      label: 'the space station',
      icon: 'station',
      meters: 400000,
      years: 400000 / BRICK_M,
    },
    {
      // The Chicxulub asteroid impact, ending the age of the dinosaurs, was about 66 million years ago.
      id: 'asteroid',
      kind: 'time',
      label: 'the asteroid hits the dinosaurs',
      icon: 'asteroid',
      years: 66e6,
      meters: 66e6 * BRICK_M,
    },
    {
      // The first dinosaurs appear roughly 235 million years ago.
      id: 'dinosaurs',
      kind: 'time',
      label: 'the first dinosaurs',
      icon: 'dinosaur',
      years: 235e6,
      meters: 235e6 * BRICK_M,
    },
    {
      // The first animals appear roughly 600 million years ago.
      id: 'animals',
      kind: 'time',
      label: 'the first animals',
      icon: 'trilobite',
      years: 600e6,
      meters: 600e6 * BRICK_M,
    },
    {
      // The Earth's diameter is about 12,742,000 m (12,742 km).
      id: 'earth-wide',
      kind: 'thing',
      label: 'as wide as the whole Earth',
      icon: 'earth',
      meters: 12742000,
      years: 12742000 / BRICK_M,
    },
    {
      // The Great Oxidation Event begins roughly 2.4 billion years ago.
      id: 'oxygen',
      kind: 'time',
      label: 'the air gets oxygen',
      icon: 'bubbles',
      years: 2.4e9,
      meters: 2.4e9 * BRICK_M,
    },
    {
      // The earliest evidence of life on Earth dates to roughly 3.7 billion years ago.
      id: 'life-first',
      kind: 'time',
      label: 'the first life',
      icon: 'cell',
      years: 3.7e9,
      meters: 3.7e9 * BRICK_M,
    },
    {
      // The Earth's circumference is about 40,075,000 m (40,075 km).
      id: 'around',
      kind: 'thing',
      label: 'all the way around the Earth',
      icon: 'ring',
      meters: 40075000,
      years: 40075000 / BRICK_M,
    },
  ];

  return landmarks.sort((a, b) => a.meters - b.meters);
}
