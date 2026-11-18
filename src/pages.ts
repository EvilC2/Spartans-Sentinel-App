// Spartans — the pages listed on More. Pinned ones also show as Quick links
// on Home. `go` navigates, `action` opens a sheet, `soon` means the page is
// planned for a later phase and only shows a notice for now.
// `art` is a Fluent 3D emoji (same look as the caf menu); `tone` picks the
// tile's fill and accent colour (see pageTone).

import type { ImageSourcePropType } from 'react-native';
import type { IconName } from './components/Icon';
import type { TabId } from './components/Chrome';
import { glow } from './components/ProgramIcon';

export type PageTone = 'sky' | 'gold' | 'moss' | 'crimson' | 'navy';

export type Page = {
  id: string;
  label: string;
  icon: IconName;
  art: ImageSourcePropType;
  tone: PageTone;
  sub: string;
  go?: TabId;
  action?: 'badges';
  soon?: string;   // phase note
};

export const PAGES: Page[] = [
  { id: 'map', label: 'Map', icon: 'map', art: require('../assets/map/map.png'), tone: 'sky', sub: 'Find any room, get the route', go: 'map' },
  { id: 'lunch', label: 'Cafeteria', icon: 'fork', art: require('../assets/food/plate.png'), tone: 'gold', sub: 'Menu, prices, gift card', go: 'lunch' },
  { id: 'homework', label: 'Homework', icon: 'tasks', art: require('../assets/homework/notepad.png'), tone: 'crimson', sub: 'Every class, in your order', go: 'homework' },
  { id: 'contacts', label: 'Contacts', icon: 'phone', art: require('../assets/pages/phone.png'), tone: 'moss', sub: 'Teachers, office, counselling', go: 'contacts' },
  { id: 'library', label: 'Library', icon: 'book', art: require('../assets/subjects/books.png'), tone: 'moss', sub: 'Hours and books out', soon: 'Phase 2' },
  { id: 'grades', label: 'Grades', icon: 'chart', art: require('../assets/subjects/chart.png'), tone: 'sky', sub: 'Every class, every term', soon: 'Phase 4' },
  { id: 'university', label: 'University', icon: 'grad', art: require('../assets/subjects/gradcap.png'), tone: 'navy', sub: 'Applications and scholarships', soon: 'Phase 4' },
];

export const pageById = (id: string) => PAGES.find(p => p.id === id);

// Fill + accent for a page tile. Tints already have dark twins in theme.ts;
// the accent is glowed in dark so it stays bright on the deep fill.
export const pageTone = (c: any, mode: 'light' | 'dark', tone: PageTone) => {
  const t = {
    sky: { bg: c.skyTint, ink: c.sky600 },
    gold: { bg: c.goldTint, ink: c.gold },
    moss: { bg: c.mossTint, ink: c.moss },
    crimson: { bg: c.crimsonTint, ink: c.crimson },
    navy: { bg: c.navy50, ink: c.navy600 },
  }[tone];
  return { bg: t.bg, ink: glow(t.ink, mode) };
};
