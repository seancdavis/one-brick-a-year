// The one source of truth for time events: every moment the stack passes on
// its way back through 4.6 billion years. src/lib/landmarks.ts derives the
// right-side "time" landmarks from this list, so an event is authored once
// and shows up as a label, a tag, and a footer phrase from the same row.
//
// Copy rules (docs/autopilot/2026-09-06-content-and-tags.md): `title` is 2 to
// 5 words with no period; `line` is at most two short sentences and 140
// characters, present tense, second person where natural, no dates and no
// "BCE" (the tag shows the years). `{age}` and `{name}` are filled in by
// src/lib/personalize.ts's fillTokens. `needsReview: true` marks a line
// written by the developer rather than taken from the candidate list, so
// Sean can find them. Every row keeps a one-line source comment; facts are
// checked, never invented.
//
// Regenerate the skeleton from the ticked candidate lists with
// `node scripts/candidates-to-data.mjs`. No DOM here.

import type { IconId } from './icon-paths';
import type { PaperColor } from './landmarks';
import type { Personalization } from './personalize';

export interface Beat {
  id: string;
  atYears: number;
  // 2 to 5 words, no period. Also the source of the right-side landmark
  // label (see timeLabel) and of beforePhraseFor's fallback.
  title: string;
  // At most two short sentences, 140 characters. May contain {age}/{name}.
  line: string;
  // Short "before X" copy for the footer's right-hand comparison
  // (src/lib/comparisons.ts's beforePhraseFor). Where the candidate list
  // gave one it is used verbatim; otherwise the footer falls back to
  // "before " + the title.
  beforePhrase?: string;
  // The line was written for this build rather than taken from the
  // candidate list — Sean reviews these.
  needsReview?: boolean;
  icon: IconId;
  paper: PaperColor;
}

// A title whose first word is a name keeps its capital when it becomes a
// lowercase label ("T. rex", not "t. rex"). Everything else is an ordinary
// word and gets lowercased. Only the first character is ever touched, so
// "the first Moon landing" keeps the Moon.
const PROPER_NOUN_FIRST_WORDS = new Set([
  'Minecraft',
  'YouTube',
  'Cleopatra',
  'Lucy',
  'Homo',
  'Titanoboa',
  'T.',
  'Velociraptor',
  'Spinosaurus',
  'Stegosaurus',
  'Saturn',
]);

// The picture-book's lowercase voice for a title: "the first people",
// "Minecraft comes out". Used for the right-side landmark label and for
// beforePhraseFor's fallback, so both read the same way.
export function timeLabel(title: string): string {
  const firstWord = title.split(' ')[0].replace(/[^A-Za-z.]/g, '');
  if (PROPER_NOUN_FIRST_WORDS.has(firstWord)) return title;
  return title.charAt(0).toLowerCase() + title.slice(1);
}

export const BEATS: readonly Beat[] = [
  {
    // Personal: one year back from today.
    id: 'birthday',
    atYears: 1,
    title: 'Your last birthday',
    line: 'One brick. That was your last birthday.',
    icon: 'bricks',
    paper: 'mustard',
  },
  {
    // Personal: the child's own age, set at the start screen (default 8).
    // buildBeats substitutes the profile's age for the default authored here.
    id: 'life',
    atYears: 8,
    title: 'Your whole life',
    line: 'Your whole life is {age} bricks tall. Everything after this is older than you.',
    needsReview: true,
    icon: 'bricks',
    paper: 'coral',
  },
  {
    // Minecraft's first public release, 2009 (Mojang).
    id: 'minecraft',
    atYears: 17,
    title: 'Minecraft comes out',
    line: 'Seventeen bricks. Minecraft is older than {name}.',
    icon: 'bricks',
    paper: 'mustard',
  },
  {
    // The first iPhone, 2007 (Apple).
    id: 'iphone',
    atYears: 19,
    title: 'The first iPhone',
    line: 'Nineteen bricks ago, nobody had a phone with no buttons.',
    icon: 'phone',
    paper: 'coral',
  },
  {
    // YouTube's first upload, "Me at the zoo", 2005 (YouTube).
    id: 'youtube',
    atYears: 21,
    title: 'YouTube starts',
    line: 'The first video was 19 seconds long and about elephants.',
    icon: 'tv',
    paper: 'mustard',
  },
  {
    // The Y2K rollover, midnight on 1 January 2000.
    id: 'y2k',
    atYears: 26,
    title: 'The year 2000',
    line: "Everyone worried the computers would break at midnight. They didn't.",
    icon: 'tv',
    paper: 'coral',
  },
  {
    // The first emoji set, 1999 (Shigetaka Kurita, NTT DoCoMo).
    id: 'emoji',
    atYears: 27,
    title: 'The first emoji',
    line: 'The first emoji were tiny: 12 dots wide.',
    icon: 'phone',
    paper: 'mustard',
  },
  {
    // Toy Story, 1995 (Pixar).
    id: 'toy-story',
    atYears: 30,
    title: 'The first Toy Story',
    line: 'The first movie made entirely with computers.',
    icon: 'tv',
    paper: 'coral',
  },
  {
    // Apollo 11, 1969 (NASA).
    id: 'moon-landing',
    atYears: 57,
    title: 'The first Moon landing',
    line: 'Two people walked on the Moon. Their footprints are still there.',
    beforePhrase: "in your grandparents' time",
    icon: 'rocket',
    paper: 'mustard',
  },
  {
    // The modern stud-and-tube brick patent, 1958 (LEGO Group).
    id: 'lego-brick',
    atYears: 68,
    title: 'The LEGO brick',
    line: 'The brick you are stacking was invented here. Old bricks still fit new ones.',
    icon: 'bricks',
    paper: 'coral',
  },
  {
    // ENIAC, 1945: about 30 tons, 167 square meters.
    id: 'computer',
    atYears: 81,
    title: 'The first computer',
    line: 'ENIAC filled a whole room and weighed as much as five elephants.',
    icon: 'tv',
    paper: 'mustard',
  },
  {
    // The first commercially sliced loaf, Chillicothe, Missouri, 1928.
    id: 'sliced-bread',
    atYears: 98,
    title: 'Sliced bread',
    line: 'Everything great since then is "the best thing since sliced bread."',
    icon: 'bread',
    paper: 'coral',
  },
  {
    // Baird's first public demonstration of television, 1926.
    id: 'television',
    atYears: 100,
    title: 'The first television',
    line: 'One hundred bricks. The first moving picture sent through the air.',
    needsReview: true,
    icon: 'tv',
    paper: 'mustard',
  },
  {
    // The Wright brothers' first powered flight, 1903: 12 seconds, 36 m.
    id: 'airplane',
    atYears: 123,
    title: 'The first airplane',
    line: 'The first flight lasted 12 seconds and went shorter than a football field.',
    icon: 'plane',
    paper: 'coral',
  },
  {
    // The Eiffel Tower opens for the 1889 World's Fair.
    id: 'eiffel-opens',
    atYears: 137,
    title: 'The Eiffel Tower opens',
    line: 'People hated it at first. Now it is the most visited monument on Earth.',
    icon: 'tower',
    paper: 'mustard',
  },
  {
    // Edison's practical carbon-filament lamp, 1879.
    id: 'light-bulb',
    atYears: 147,
    title: 'The light bulb',
    line: 'Before this brick, night was dark unless you lit a fire.',
    icon: 'bulb',
    paper: 'coral',
  },
  {
    // "View from the Window at Le Gras", about 1826 (Niépce).
    id: 'photograph',
    atYears: 200,
    title: 'The first photograph',
    line: 'It took eight hours to take. It shows a rooftop.',
    icon: 'camera',
    paper: 'mustard',
  },
  {
    // Drais's laufmaschine, 1817: no pedals.
    id: 'bicycle',
    atYears: 209,
    title: 'The first bicycle',
    line: 'No pedals. You pushed it with your feet.',
    icon: 'bicycle',
    paper: 'coral',
  },
  {
    // Leonardo da Vinci begins the Mona Lisa, about 1503.
    id: 'mona-lisa',
    atYears: 520,
    title: 'The Mona Lisa',
    line: 'A small painting of a woman half smiling. People still line up to see it.',
    needsReview: true,
    icon: 'person',
    paper: 'mustard',
  },
  {
    // Gutenberg's movable-type press, about 1440.
    id: 'printing-press',
    atYears: 586,
    title: 'The printing press',
    line: 'Before this brick, every book was written by hand.',
    icon: 'book',
    paper: 'coral',
  },
  {
    // Chaturanga, India, about the 600s.
    id: 'chess',
    atYears: 1400,
    title: 'Chess is invented',
    line: 'The same pieces and the same board people still play with today.',
    needsReview: true,
    icon: 'book',
    paper: 'mustard',
  },
  {
    // The Bakhshali manuscript's dot for zero, about the 300s.
    id: 'zero',
    atYears: 1700,
    title: 'The number zero',
    line: 'Somebody had to invent zero.',
    icon: 'book',
    paper: 'coral',
  },
  {
    // Cleopatra VII, last ruler of Ptolemaic Egypt, died 30 BCE.
    id: 'cleopatra',
    atYears: 2056,
    title: 'Cleopatra is queen',
    line: 'Cleopatra lived closer to the iPhone than to the pyramids.',
    icon: 'person',
    paper: 'mustard',
  },
  {
    // The first long walls under Qin Shi Huang, about 220 BCE.
    id: 'great-wall',
    atYears: 2250,
    title: 'The Great Wall begins',
    line: 'People start building a wall so long you could walk it for months.',
    needsReview: true,
    icon: 'wall',
    paper: 'coral',
  },
  {
    // The first recorded Olympiad, Olympia, 776 BCE.
    id: 'olympics',
    atYears: 2802,
    title: 'The first Olympic Games',
    line: 'One race, one winner, one olive wreath.',
    icon: 'ball',
    paper: 'mustard',
  },
  {
    // The Phoenician alphabet, about 1000 BCE: 22 letters.
    id: 'alphabet',
    atYears: 3000,
    title: 'The alphabet',
    line: 'Before this brick, writing had hundreds of signs. Now: about 26.',
    icon: 'book',
    paper: 'coral',
  },
  {
    // The last mammoths, Wrangel Island, about 4,000 years ago.
    id: 'mammoths',
    atYears: 4000,
    title: 'The last woolly mammoths',
    line: 'Mammoths were still alive on one island when the pyramids were already old.',
    icon: 'mammoth',
    paper: 'mustard',
  },
  {
    // The Great Pyramid of Giza, about 2560 BCE.
    id: 'pyramid',
    atYears: 4590,
    title: 'The Great Pyramid',
    line: 'The tallest building on Earth for almost 4,000 years.',
    beforePhrase: 'before the pyramids',
    icon: 'pyramid',
    paper: 'coral',
  },
  {
    // Methuselah, a bristlecone pine in California, about 4,850 years old.
    id: 'oldest-tree',
    atYears: 4850,
    title: 'The oldest living tree',
    line: 'A tree alive today, in California, was a seed at this brick.',
    icon: 'tree',
    paper: 'mustard',
  },
  {
    // Earliest cuneiform tablets, Uruk, about 3200 BCE (British Museum).
    id: 'writing',
    atYears: 5000,
    title: 'People start writing',
    line: 'Every history book ever written is about the bricks under this one.',
    beforePhrase: 'before anyone wrote anything down',
    icon: 'scroll',
    paper: 'coral',
  },
  {
    // Potter's wheels in Mesopotamia, about 5,500 years ago; carts later.
    id: 'wheel',
    atYears: 5500,
    title: 'The wheel',
    line: 'Pots were made on wheels before carts were.',
    icon: 'wheel',
    paper: 'mustard',
  },
  {
    // Milk-fat residues in pottery strainers, Poland, about 7,500 years ago.
    id: 'cheese',
    atYears: 7500,
    title: 'Cheese is invented',
    line: 'Somebody left milk too long and liked what happened.',
    needsReview: true,
    icon: 'bread',
    paper: 'coral',
  },
  {
    // Chewed birch tar with tooth marks, Sweden, about 9,000 years ago.
    id: 'chewing-gum',
    atYears: 9000,
    title: 'The oldest chewing gum',
    line: 'Tree tar, with tooth marks still in it.',
    icon: 'tree',
    paper: 'mustard',
  },
  {
    // Sagebrush bark sandals, Fort Rock Cave, Oregon, about 9,300 years ago.
    id: 'shoes',
    atYears: 9300,
    title: 'The oldest shoes',
    line: 'Sandals made of bark, found in a cave in Oregon.',
    icon: 'person',
    paper: 'coral',
  },
  {
    // The end of the Pleistocene, about 11,700 years ago.
    id: 'ice-age-ends',
    atYears: 11700,
    title: 'The last Ice Age ends',
    line: 'Where you live may have been under ice thicker than a skyscraper.',
    beforePhrase: 'before the ice melted',
    icon: 'snowflake',
    paper: 'mustard',
  },
  {
    // First crops in the Fertile Crescent, about 12,000 years ago.
    id: 'farming',
    atYears: 12000,
    title: 'Farming begins',
    line: 'Before this brick, everybody hunted and gathered. Nobody planted.',
    beforePhrase: 'before anyone farmed',
    icon: 'flower',
    paper: 'coral',
  },
  {
    // Charred flatbread crumbs at Shubayqa 1, Jordan, about 14,400 years ago.
    id: 'bread',
    atYears: 14400,
    title: 'The oldest bread',
    line: 'Bread is older than farming. Somebody baked wild grain.',
    icon: 'bread',
    paper: 'mustard',
  },
  {
    // Dog domestication, at least 15,000 years ago; some estimates 30,000.
    id: 'dogs',
    atYears: 15000,
    title: 'Dogs become friends',
    line: 'The first animal to become our friend. Wolves that stayed by the fire.',
    icon: 'dog',
    paper: 'coral',
  },
  {
    // A carved ivory bird from Mal'ta, Siberia, about 24,000 years ago; the
    // "toy" reading is uncertain.
    id: 'oldest-toy',
    atYears: 24000,
    title: 'The oldest toy',
    line: 'A little bird carved out of a tusk. Somebody made it for a child.',
    needsReview: true,
    icon: 'bird',
    paper: 'mustard',
  },
  {
    // The last Neanderthals, about 40,000 years ago.
    id: 'neanderthals',
    atYears: 40000,
    title: 'The Neanderthals disappear',
    line: 'For a while there were two kinds of people on Earth.',
    icon: 'person',
    paper: 'coral',
  },
  {
    // People reach Sahul (Australia), at least 50,000 to 65,000 years ago.
    id: 'australia',
    atYears: 50000,
    title: 'People reach Australia',
    line: 'They crossed open water to get there. Nobody knows how.',
    needsReview: true,
    icon: 'wave',
    paper: 'mustard',
  },
  {
    // The main out-of-Africa dispersal, about 60,000 years ago.
    id: 'out-of-africa',
    atYears: 60000,
    title: 'People leave Africa',
    line: 'Every person outside Africa comes from a small group that left about here.',
    icon: 'person',
    paper: 'coral',
  },
  {
    // Bone points at Sibudu, South Africa, about 64,000 to 72,000 years ago.
    id: 'bows',
    atYears: 70000,
    title: 'Bows and arrows',
    line: 'The first way to hit something from far away.',
    needsReview: true,
    icon: 'person',
    paper: 'mustard',
  },
  {
    // An ochre crosshatch on stone, Blombos Cave, about 73,000 years ago.
    id: 'oldest-drawing',
    atYears: 73000,
    title: 'The oldest drawing',
    line: "A crisscross in red on a rock. Somebody's first doodle.",
    beforePhrase: 'before anyone drew',
    icon: 'pencil',
    paper: 'coral',
  },
  {
    // Pierced shell beads, about 75,000 to 100,000 years ago.
    id: 'jewelry',
    atYears: 100000,
    title: 'The oldest jewelry',
    line: 'Shell beads with holes for string.',
    icon: 'ring',
    paper: 'mustard',
  },
  {
    // Homo sapiens fossils at Jebel Irhoud, Morocco, about 300,000 years
    // (Hublin et al., Nature 2017).
    id: 'humans',
    atYears: 300000,
    title: 'The first people',
    line: 'Above this brick, nobody looked like us.',
    beforePhrase: 'before the first people',
    icon: 'person',
    paper: 'coral',
  },
  {
    // Burnt bone at Wonderwerk Cave; controlled fire 400,000 to 1 million.
    id: 'fire',
    atYears: 1e6,
    title: 'People control fire',
    line: 'Cooking starts here. So does sitting around a fire telling stories.',
    beforePhrase: 'before anyone made a fire',
    icon: 'flame',
    paper: 'mustard',
  },
  {
    // Homo erectus, from about 1.9 million years ago.
    id: 'homo-erectus',
    atYears: 1.9e6,
    title: 'Homo erectus',
    line: 'The first people-like people to walk out of Africa.',
    icon: 'person',
    paper: 'coral',
  },
  {
    // The Quaternary glaciations begin, about 2.6 million years ago.
    id: 'ice-ages',
    atYears: 2.6e6,
    title: 'The Ice Ages begin',
    line: 'Ice grows and shrinks, over and over, every hundred thousand years or so.',
    icon: 'snowflake',
    paper: 'mustard',
  },
  {
    // "Lucy", Australopithecus afarensis, Hadar, Ethiopia, about 3.2 million.
    id: 'lucy',
    atYears: 3.2e6,
    title: 'Lucy walks upright',
    line: 'She was about as tall as {name}, walked on two legs, and climbed trees.',
    icon: 'person',
    paper: 'coral',
  },
  {
    // Lomekwi 3 flakes, Kenya, about 3.3 million years ago.
    id: 'stone-tools',
    atYears: 3.3e6,
    title: 'The first stone tools',
    line: 'Somebody hit one rock with another on purpose. Everything we make starts here.',
    beforePhrase: 'before anyone made a tool',
    icon: 'asteroid',
    paper: 'mustard',
  },
  {
    // The Colorado River begins carving, about 5 to 6 million years ago.
    id: 'grand-canyon',
    atYears: 6e6,
    title: 'The Grand Canyon starts',
    line: 'A river starts cutting through rock. It is still cutting.',
    needsReview: true,
    icon: 'mountain',
    paper: 'coral',
  },
  {
    // The human-chimpanzee split, about 6 to 7 million years ago.
    id: 'chimp-ancestor',
    atYears: 7e6,
    title: 'Our shared grandparent',
    line: 'One animal here is the great-great-grandparent of both people and chimps.',
    needsReview: true,
    icon: 'person',
    paper: 'mustard',
  },
  {
    // The first apes, about 25 million years ago.
    id: 'apes',
    atYears: 25e6,
    title: 'The first apes',
    line: 'No tails. Long arms. Very good at swinging.',
    needsReview: true,
    icon: 'person',
    paper: 'coral',
  },
  {
    // Pakicetus and kin, about 50 million years ago.
    id: 'whales',
    atYears: 50e6,
    title: 'Whales walk into the sea',
    line: 'Whales used to have legs. A wolf-sized animal that liked swimming.',
    icon: 'whale',
    paper: 'mustard',
  },
  {
    // The first primates, about 55 million years ago.
    id: 'primates',
    atYears: 55e6,
    title: 'The first primates',
    line: 'Small, big-eyed, and up in the trees. Hands that could hold on.',
    needsReview: true,
    icon: 'tree',
    paper: 'coral',
  },
  {
    // The Paleocene-Eocene Thermal Maximum, about 56 million years ago.
    id: 'petm',
    atYears: 56e6,
    title: 'The world gets very hot',
    line: 'Crocodiles lived near the North Pole.',
    icon: 'flame',
    paper: 'mustard',
  },
  {
    // Titanoboa cerrejonensis, about 60 million years ago: about 13 m.
    id: 'titanoboa',
    atYears: 60e6,
    title: 'Titanoboa, the giant snake',
    line: 'A snake as long as a school bus and as heavy as a car.',
    icon: 'dinosaur',
    paper: 'coral',
  },
  {
    // Chicxulub impact at the K-Pg boundary, 66.0 Ma (Renne et al., Science
    // 2013); impactor about 10 km wide, crater about 180 km.
    id: 'asteroid',
    atYears: 66e6,
    title: 'The asteroid hits the dinosaurs',
    line: 'A rock six miles wide hits the Earth. The dinosaurs are gone. The hole it left is 110 miles across.',
    beforePhrase: 'before the dinosaurs died',
    icon: 'asteroid',
    paper: 'mustard',
  },
  {
    // Tyrannosaurus rex, 68 to 66 million years ago.
    id: 't-rex',
    atYears: 68e6,
    title: 'T. rex',
    line: 'T. rex lived closer to {name} than to Stegosaurus.',
    icon: 'dinosaur',
    paper: 'coral',
  },
  {
    // Velociraptor, about 75 million years ago: turkey-sized, feathered.
    id: 'velociraptor',
    atYears: 80e6,
    title: 'Velociraptor, turkey-sized',
    line: 'Real ones were the size of a turkey, with feathers.',
    icon: 'dinosaur',
    paper: 'mustard',
  },
  {
    // Spinosaurus aegyptiacus, about 95 million years ago.
    id: 'spinosaurus',
    atYears: 95e6,
    title: 'Spinosaurus, the swimmer',
    line: 'Bigger than T. rex, and it swam.',
    icon: 'dinosaur',
    paper: 'coral',
  },
  {
    // The first bees, about 100 million years ago, with the first flowers.
    id: 'bees',
    atYears: 100e6,
    title: 'The first bees',
    line: 'Flowers and bees showed up together and have been friends ever since.',
    icon: 'bug',
    paper: 'mustard',
  },
  {
    // Saturn's rings, maybe 100 million years old; the age is uncertain and
    // some estimates are far older.
    id: 'saturn-rings',
    atYears: 100e6,
    title: 'Saturn gets its rings',
    line: "Sharks are older than Saturn's rings.",
    icon: 'ring',
    paper: 'coral',
  },
  {
    // The first flowering plants, about 130 million years ago.
    id: 'flowers',
    atYears: 130e6,
    title: 'The first flowers',
    line: 'Before this brick, no flowers anywhere. The world was green and brown.',
    beforePhrase: 'before flowers',
    icon: 'flower',
    paper: 'mustard',
  },
  {
    // Stegosaurus, about 150 million years ago.
    id: 'stegosaurus',
    atYears: 150e6,
    title: 'Stegosaurus and its plates',
    line: 'Plates all down its back and four spikes on its tail.',
    needsReview: true,
    icon: 'dinosaur',
    paper: 'coral',
  },
  {
    // Archaeopteryx, about 150 million years ago.
    id: 'first-bird',
    atYears: 150e6,
    title: 'The first bird',
    line: 'Archaeopteryx: feathers, wings, and teeth.',
    icon: 'bird',
    paper: 'mustard',
  },
  {
    // Pangaea begins to break up, about 180 million years ago; plates move
    // at roughly the speed fingernails grow.
    id: 'atlantic',
    atYears: 180e6,
    title: 'The Atlantic opens',
    line: 'The continents are still moving. About as fast as your fingernails grow.',
    icon: 'wave',
    paper: 'coral',
  },
  {
    // The first mammals, about 205 million years ago.
    id: 'mammals',
    atYears: 200e6,
    title: 'The first mammals',
    line: 'Tiny, furry, and awake at night. Your ancestors.',
    icon: 'cat',
    paper: 'mustard',
  },
  {
    // Earliest dinosaurs in the Carnian, about 230 to 235 Ma (Ischigualasto
    // Formation; Nesbitt et al., Biology Letters 2013).
    id: 'dinosaurs',
    atYears: 235e6,
    title: 'The first dinosaurs',
    line: 'From here down to the asteroid is about 170 million bricks. A stack 1,600 kilometers tall.',
    beforePhrase: 'before the first dinosaurs',
    icon: 'dinosaur',
    paper: 'coral',
  },
  {
    // Pangaea assembled, about 300 million years ago.
    id: 'pangaea',
    atYears: 300e6,
    title: 'All the land is one',
    line: 'You could walk from Africa to America.',
    icon: 'earth',
    paper: 'mustard',
  },
  {
    // The amniote egg, about 320 million years ago.
    id: 'eggs',
    atYears: 320e6,
    title: 'The first eggs with shells',
    line: 'Eggs with shells meant animals could leave the water for good.',
    icon: 'bird',
    paper: 'coral',
  },
  {
    // Cladoselache, about 360 million years ago; sharks themselves older.
    id: 'modern-sharks',
    atYears: 360e6,
    title: 'Sharks look like sharks',
    line: 'Fins, teeth, and the same shape they still have.',
    needsReview: true,
    icon: 'fish',
    paper: 'mustard',
  },
  {
    // Tiktaalik roseae, about 375 million years ago.
    id: 'fish-on-land',
    atYears: 375e6,
    title: 'A fish walks onto land',
    line: 'Tiktaalik: fins that worked like arms. Everything with four legs comes from here.',
    beforePhrase: 'before anything walked on land',
    icon: 'fish',
    paper: 'coral',
  },
  {
    // Archaeopteris forests, about 385 million years ago.
    id: 'trees',
    atYears: 385e6,
    title: 'The first forests',
    line: 'Sharks are older than trees.',
    icon: 'tree',
    paper: 'mustard',
  },
  {
    // The first insects, about 400 million years ago.
    id: 'insects',
    atYears: 400e6,
    title: 'The first insects',
    line: 'Six legs, and there have been more of them than anything else ever since.',
    needsReview: true,
    icon: 'bug',
    paper: 'coral',
  },
  {
    // Pneumodesmus newmani, a millipede, about 428 million years ago.
    id: 'land-animals',
    atYears: 428e6,
    title: 'The first land animals',
    line: 'A millipede the size of your finger.',
    icon: 'trilobite',
    paper: 'mustard',
  },
  {
    // The first sharks, about 450 million years ago.
    id: 'sharks',
    atYears: 450e6,
    title: 'The first sharks',
    line: 'Older than trees, older than the rings around Saturn.',
    needsReview: true,
    icon: 'fish',
    paper: 'coral',
  },
  {
    // The first land plants, about 470 million years ago.
    id: 'land-plants',
    atYears: 470e6,
    title: 'The first land plants',
    line: 'Tiny mosses. The first green on the rocks.',
    icon: 'tree',
    paper: 'mustard',
  },
  {
    // The first jawless fish, about 530 million years ago.
    id: 'fish',
    atYears: 530e6,
    title: 'The first fish',
    line: 'No jaws.',
    icon: 'fish',
    paper: 'coral',
  },
  {
    // The Cambrian explosion, about 539 million years ago.
    id: 'cambrian',
    atYears: 539e6,
    title: 'The Cambrian explosion',
    line: 'Suddenly: eyes, shells, legs, teeth.',
    beforePhrase: 'before anything had eyes',
    icon: 'trilobite',
    paper: 'mustard',
  },
  {
    // Ediacaran biota about 575 Ma; sponge biomarkers to about 635 Ma (Love
    // et al., Nature 2009).
    id: 'animals',
    atYears: 600e6,
    title: 'The first animals',
    line: 'Soft and small, in the sea. No bones yet.',
    beforePhrase: 'before the first animals',
    icon: 'bubbles',
    paper: 'coral',
  },
  {
    // Bangiomorpha pubescens, a red alga, about 1.05 billion years ago.
    id: 'many-cells',
    atYears: 1.05e9,
    title: 'The first many-celled life',
    line: 'One cell was everything, for billions of bricks. Now cells stick together.',
    needsReview: true,
    icon: 'cell',
    paper: 'mustard',
  },
  {
    // The "boring billion", about 1.8 to 0.8 billion years ago.
    id: 'boring-billion',
    atYears: 1.8e9,
    title: 'The boring billion begins',
    line: 'Scientists really call it that. Nothing much happened for a billion years.',
    icon: 'bubbles',
    paper: 'coral',
  },
  {
    // The first eukaryotes, about 1.8 to 2.1 billion years ago.
    id: 'complex-cells',
    atYears: 1.8e9,
    title: 'The first complex cells',
    line: 'Cells with a nucleus. Every plant and animal is made of these.',
    icon: 'cell',
    paper: 'mustard',
  },
  {
    // The Oklo natural fission reactors, Gabon, about 2 billion years ago.
    id: 'natural-reactor',
    atYears: 2e9,
    title: 'A natural nuclear reactor',
    line: 'In Africa, rocks ran a nuclear reaction on their own for thousands of years.',
    icon: 'flame',
    paper: 'coral',
  },
  {
    // Great Oxidation Event about 2.4 Ga (Holland 2006).
    id: 'oxygen',
    atYears: 2.4e9,
    title: 'The air gets oxygen',
    line: "Tiny living things breathe out oxygen for a billion years. Before this, you couldn't breathe here.",
    beforePhrase: 'before the air had oxygen',
    icon: 'bubbles',
    paper: 'mustard',
  },
  {
    // The first stable continental crust, about 2.7 billion years ago.
    id: 'continents',
    atYears: 2.7e9,
    title: 'The first continents',
    line: 'The first dry land you could stand on. Everywhere else is sea.',
    needsReview: true,
    icon: 'mountain',
    paper: 'coral',
  },
  {
    // Stromatolites in the Pilbara, Australia, about 3.48 billion years ago.
    id: 'oldest-fossils',
    atYears: 3.48e9,
    title: 'The oldest fossils',
    line: 'Mounds built by microbes, in Australia.',
    icon: 'bubbles',
    paper: 'mustard',
  },
  {
    // Isua, Greenland stromatolites about 3.7 Ga (Nutman et al., Nature 2016).
    id: 'life-first',
    atYears: 3.7e9,
    title: 'The first life',
    line: 'Smaller than a speck. Everything alive comes from here.',
    beforePhrase: 'before anything was alive',
    icon: 'cell',
    paper: 'coral',
  },
  {
    // The Acasta Gneiss, Canada, 4.03 billion years old.
    id: 'oldest-rocks',
    atYears: 4.03e9,
    title: 'The oldest rocks',
    line: 'The oldest piece of the ground you can still go and touch.',
    needsReview: true,
    icon: 'asteroid',
    paper: 'mustard',
  },
  {
    // Liquid water by about 4.4 billion years ago (zircon evidence).
    id: 'oceans',
    atYears: 4.4e9,
    title: 'The first oceans',
    line: 'Rain falls for a very long time and fills the world with sea.',
    needsReview: true,
    icon: 'wave',
    paper: 'coral',
  },
  {
    // A Jack Hills zircon crystal, 4.4 billion years old.
    id: 'oldest-thing',
    atYears: 4.4e9,
    title: 'The oldest thing on Earth',
    line: 'A crystal smaller than a grain of sand.',
    icon: 'asteroid',
    paper: 'mustard',
  },
  {
    // The giant-impact hypothesis: Theia, about 4.5 billion years ago.
    id: 'moon-made',
    atYears: 4.5e9,
    title: 'The Moon is made',
    line: 'A planet the size of Mars hit the Earth. The splash became the Moon.',
    icon: 'earth',
    paper: 'coral',
  },
  {
    // Just after the Moon formed, Earth's day was about six hours long.
    id: 'six-hour-day',
    atYears: 4.5e9,
    title: 'A six-hour day',
    line: 'The Earth spins so fast that a whole day fits inside six hours.',
    needsReview: true,
    icon: 'wheel',
    paper: 'mustard',
  },
  {
    // Earth's age 4.54 Gyr (Dalrymple 2001), rounded to 4.6 Gyr as most
    // children's references state it — the same number as TOTAL_YEARS.
    id: 'earth-born',
    atYears: 4.6e9,
    title: 'The Earth is born',
    line: 'The top of the stack. Every brick under this one is one year of the Earth.',
    needsReview: true,
    icon: 'earth',
    paper: 'coral',
  },
];

// The profile-aware event list. Only "life" moves: it is the child's own age,
// so BEATS carries the default and this substitutes the real one and re-sorts
// (an older child's life can overtake the events just after it).
export function buildBeats(profile: Personalization): Beat[] {
  return BEATS.map((beat) => (beat.id === 'life' ? { ...beat, atYears: profile.ageYears } : beat)).sort(
    (a, b) => a.atYears - b.atYears,
  );
}

// Returns beats in (fromYears, toYears], ascending.
export function beatsCrossed(prevYears: number, years: number, beats: readonly Beat[] = BEATS): Beat[] {
  return beats.filter((beat) => prevYears < beat.atYears && beat.atYears <= years);
}
