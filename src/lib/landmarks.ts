import { BRICK_M } from './constants';
import type { IconId } from './icon-paths';
import type { Personalization } from './personalize';

// A landmark is either a physical "thing" (drawn on the left, compared by
// height) or a "time" event (drawn on the right, compared by how long ago)
// — see src/lib/layout.ts, which sorts on this to build the two-sided
// layout.
export interface Landmark {
  id: string;
  meters: number;
  years: number;
  label: string;
  icon: IconId;
  kind: 'thing' | 'time';
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
      kind: 'time',
      ...fromYears(profile.ageYears),
    },
    {
      // Everyday reference object, approximate: a standard 30 cm school ruler.
      id: 'ruler',
      label: 'a school ruler',
      icon: 'ruler',
      kind: 'thing',
      ...fromMeters(0.3),
    },
    {
      // Everyday reference object, approximate: standard interior door height about 2.03 m (80 in).
      id: 'door',
      label: 'a door',
      icon: 'door',
      kind: 'thing',
      ...fromMeters(2.0),
    },
    {
      // Everyday reference object, approximate: rules of thumb, one story
      // about 4 m, two stories about 8 m, a ten-story apartment building
      // about 30 m.
      id: 'home',
      label: 'your home',
      icon: 'home',
      kind: 'thing',
      ...fromMeters(profile.homeMeters),
    },
    {
      // Earliest cuneiform tablets, Uruk, about 3200 BCE (British Museum).
      id: 'writing',
      label: 'people start writing things down',
      icon: 'scroll',
      kind: 'time',
      ...fromYears(5000),
    },
    {
      // 93 m ground to torch (US National Park Service).
      id: 'liberty',
      label: 'the Statue of Liberty',
      icon: 'statue',
      kind: 'thing',
      ...fromMeters(93),
    },
    {
      // 330 m including antennas (SETE, 2022).
      id: 'eiffel',
      label: 'the Eiffel Tower',
      icon: 'tower',
      kind: 'thing',
      ...fromMeters(330),
    },
    {
      // 828 m (Council on Tall Buildings and Urban Habitat).
      id: 'burj',
      label: 'the tallest building on Earth',
      icon: 'skyscraper',
      kind: 'thing',
      ...fromMeters(828),
    },
    {
      // Homo sapiens fossils at Jebel Irhoud, Morocco, about 300,000 years
      // (Hublin et al., Nature 2017).
      id: 'humans',
      label: 'the first people',
      icon: 'person',
      kind: 'time',
      ...fromYears(300000),
    },
    {
      // 8,848.86 m (China–Nepal joint survey, 2020).
      id: 'everest',
      label: 'Mount Everest',
      icon: 'mountain',
      kind: 'thing',
      ...fromMeters(8849),
    },
    {
      // Typical commercial cruise altitude 33,000 to 42,000 ft (FAA Pilot's
      // Handbook of Aeronautical Knowledge).
      id: 'planes',
      label: 'where airplanes fly',
      icon: 'plane',
      kind: 'thing',
      ...fromMeters(11000),
    },
    {
      // Kármán line, 100 km (FAI).
      id: 'space',
      label: 'space begins',
      icon: 'rocket',
      kind: 'thing',
      ...fromMeters(100000),
    },
    {
      // ISS orbit about 400 to 420 km (NASA).
      id: 'iss',
      label: 'the space station',
      icon: 'station',
      kind: 'thing',
      ...fromMeters(400000),
    },
    {
      // Chicxulub impact at the K–Pg boundary, 66.0 Ma (Renne et al.,
      // Science 2013); impactor about 10 km wide, crater about 180 km.
      id: 'asteroid',
      label: 'the asteroid hits the dinosaurs',
      icon: 'asteroid',
      kind: 'time',
      ...fromYears(66e6),
    },
    {
      // Earliest dinosaurs in the Carnian, about 230 to 235 Ma
      // (Ischigualasto Formation; Nesbitt et al., Biology Letters 2013).
      id: 'dinosaurs',
      label: 'the first dinosaurs',
      icon: 'dinosaur',
      kind: 'time',
      ...fromYears(235e6),
    },
    {
      // Ediacaran biota about 575 Ma; sponge biomarkers to about 635 Ma
      // (Love et al., Nature 2009).
      id: 'animals',
      label: 'the first animals',
      icon: 'trilobite',
      kind: 'time',
      ...fromYears(600e6),
    },
    {
      // Mean diameter 12,742 km (NASA).
      id: 'earth-wide',
      label: 'as wide as the whole Earth',
      icon: 'earth',
      kind: 'thing',
      ...fromMeters(12742000),
    },
    {
      // Great Oxidation Event about 2.4 Ga (Holland 2006).
      id: 'oxygen',
      label: 'the air gets oxygen',
      icon: 'bubbles',
      kind: 'time',
      ...fromYears(2.4e9),
    },
    {
      // Isua, Greenland stromatolites about 3.7 Ga (Nutman et al., Nature 2016).
      id: 'life-first',
      label: 'the first life',
      icon: 'cell',
      kind: 'time',
      ...fromYears(3.7e9),
    },
    {
      // Equatorial circumference 40,075 km (WGS84).
      id: 'around',
      label: 'all the way around the Earth',
      icon: 'ring',
      kind: 'thing',
      ...fromMeters(40075000),
    },
  ];

  return landmarks.sort((a, b) => a.meters - b.meters);
}
