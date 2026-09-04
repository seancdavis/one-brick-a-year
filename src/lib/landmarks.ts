import { BRICK_M } from './constants';
import { ICON_IDS, type IconId } from './icon-paths';
import type { Personalization } from './personalize';

// The set of flat, single-color icons drawn beside each landmark's label.
// icon-paths.ts is the source of truth; re-exported here so existing
// imports (and tests) keep working.
export { ICON_IDS };
export type { IconId };

export interface Landmark {
  id: string;
  meters: number;
  years: number;
  label: string;
  icon: IconId;
}

// Each landmark is authored in whichever unit is natural for it — a known
// height in meters, or a known age in years — and the other field is
// derived from BRICK_M exactly once, here.
function fromYears(years: number): { years: number; meters: number } {
  return { years, meters: years * BRICK_M };
}

function fromMeters(meters: number): { meters: number; years: number } {
  return { meters, years: meters / BRICK_M };
}

export function buildLandmarks(profile: Personalization): Landmark[] {
  const landmarks: Landmark[] = [
    {
      // The child's own age, set at the start screen (default 8).
      id: 'life',
      label: 'your whole life',
      icon: 'bricks',
      ...fromYears(profile.ageYears),
    },
    {
      // A standard 30 cm school ruler.
      id: 'ruler',
      label: 'a school ruler',
      icon: 'ruler',
      ...fromMeters(0.3),
    },
    {
      // A standard interior door is about 2 m tall.
      id: 'door',
      label: 'a door',
      icon: 'door',
      ...fromMeters(2.0),
    },
    {
      // Chosen at the start screen: one-story home 4 m, two-story home 8 m (default), or apartment building 30 m.
      id: 'home',
      label: 'your home',
      icon: 'home',
      ...fromMeters(profile.homeMeters),
    },
    {
      // Writing systems (e.g. cuneiform) emerge around 3000 BCE, roughly 5,000 years ago.
      id: 'writing',
      label: 'people start writing things down',
      icon: 'scroll',
      ...fromYears(5000),
    },
    {
      // The Statue of Liberty is 93 m tall, including its pedestal.
      id: 'liberty',
      label: 'the Statue of Liberty',
      icon: 'statue',
      ...fromMeters(93),
    },
    {
      // The Eiffel Tower is 330 m tall, including antennas.
      id: 'eiffel',
      label: 'the Eiffel Tower',
      icon: 'tower',
      ...fromMeters(330),
    },
    {
      // The Burj Khalifa, the tallest building on Earth, is 828 m tall.
      id: 'burj',
      label: 'the tallest building on Earth',
      icon: 'skyscraper',
      ...fromMeters(828),
    },
    {
      // Homo sapiens emerge roughly 300,000 years ago.
      id: 'humans',
      label: 'the first people',
      icon: 'person',
      ...fromYears(300000),
    },
    {
      // Mount Everest stands 8,849 m above sea level.
      id: 'everest',
      label: 'Mount Everest',
      icon: 'mountain',
      ...fromMeters(8849),
    },
    {
      // Commercial airliners cruise around 11,000 m (36,000 ft).
      id: 'planes',
      label: 'where airplanes fly',
      icon: 'plane',
      ...fromMeters(11000),
    },
    {
      // The Kármán line, the common boundary of space, is 100,000 m (100 km) up.
      id: 'space',
      label: 'space begins',
      icon: 'rocket',
      ...fromMeters(100000),
    },
    {
      // The International Space Station orbits at roughly 400,000 m (400 km).
      id: 'iss',
      label: 'the space station',
      icon: 'station',
      ...fromMeters(400000),
    },
    {
      // The Chicxulub asteroid impact, ending the age of the dinosaurs, was about 66 million years ago.
      id: 'asteroid',
      label: 'the asteroid hits the dinosaurs',
      icon: 'asteroid',
      ...fromYears(66e6),
    },
    {
      // The first dinosaurs appear roughly 235 million years ago.
      id: 'dinosaurs',
      label: 'the first dinosaurs',
      icon: 'dinosaur',
      ...fromYears(235e6),
    },
    {
      // The first animals appear roughly 600 million years ago.
      id: 'animals',
      label: 'the first animals',
      icon: 'trilobite',
      ...fromYears(600e6),
    },
    {
      // The Earth's diameter is about 12,742,000 m (12,742 km).
      id: 'earth-wide',
      label: 'as wide as the whole Earth',
      icon: 'earth',
      ...fromMeters(12742000),
    },
    {
      // The Great Oxidation Event begins roughly 2.4 billion years ago.
      id: 'oxygen',
      label: 'the air gets oxygen',
      icon: 'bubbles',
      ...fromYears(2.4e9),
    },
    {
      // The earliest evidence of life on Earth dates to roughly 3.7 billion years ago.
      id: 'life-first',
      label: 'the first life',
      icon: 'cell',
      ...fromYears(3.7e9),
    },
    {
      // The Earth's circumference is about 40,075,000 m (40,075 km).
      id: 'around',
      label: 'all the way around the Earth',
      icon: 'ring',
      ...fromMeters(40075000),
    },
  ];

  return landmarks.sort((a, b) => a.meters - b.meters);
}
