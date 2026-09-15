// Spartans — the pages listed on More. Pinned ones also show as Quick links
// on Home. `go` navigates, `action` opens a sheet, `soon` means the page is
// planned for a later phase and only shows a notice for now.

import type { IconName } from './components/Icon';
import type { TabId } from './components/Chrome';

export type Page = {
  id: string;
  label: string;
  icon: IconName;
  sub: string;
  go?: TabId;
  action?: 'badges';
  soon?: string;   // phase note
};

export const PAGES: Page[] = [
  { id: 'map', label: 'Map', icon: 'map', sub: 'Find any room', soon: 'Phase 4' },
  { id: 'lunch', label: 'Lunch menu', icon: 'fork', sub: 'What the caf has today', soon: 'Phase 2' },
  { id: 'contacts', label: 'Contacts', icon: 'phone', sub: 'Teachers, office, counselling', go: 'contacts' },
  { id: 'homework', label: 'Homework', icon: 'tasks', sub: 'By class, by due date', go: 'homework' },
  { id: 'social', label: 'Social', icon: 'users', sub: 'Friends and shared blocks', go: 'social' },
  { id: 'badges', label: 'Badges', icon: 'badge', sub: 'Your collection and XP', action: 'badges' },
  { id: 'dayview', label: 'Day view', icon: 'clock', sub: 'Today, block by block, with bell times', go: 'dayview' },
  { id: 'library', label: 'Library', icon: 'book', sub: 'Hours and books out', soon: 'Phase 2' },
  { id: 'grades', label: 'Grades', icon: 'chart', sub: 'Every class, every term', soon: 'Phase 4' },
  { id: 'university', label: 'University', icon: 'grad', sub: 'Applications and scholarships', soon: 'Phase 4' },
  { id: 'me', label: 'Profile & ID', icon: 'id', sub: 'Student card, timetable, settings', go: 'me' },
];

export const pageById = (id: string) => PAGES.find(p => p.id === id);
