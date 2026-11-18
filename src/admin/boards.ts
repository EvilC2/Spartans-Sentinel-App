// Spartans — App Club boards: the simple lists each team keeps.
//   campaigns  Marketing: posters, Instagram, social media
//   checkins   Human Resources: is each member doing their work
//   stuco      Student Council Rep: what the student council asked for
//   decisions  President / Teacher Sponsor: the final say
// Same three modes as the content store (src/content):
//   demo   a developer's machine with no keys: this phone, from sample items
//   live   the server's club_items table (migration 0017)
//   local  backend set up but 0017 not run, or the server can't be reached:
//          this phone, starting empty, with a note

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContent } from '../content';
import { demoBuild } from '../supabase';
import type { ClubItemRow } from '../backend';

export type BoardId = 'campaigns' | 'checkins' | 'stuco' | 'decisions';

export type Item = {
  id: string; board: BoardId; title: string; body: string; status: string;
  tag: string | null; due: string | null; who: string | null;
  by: string | null; createdAt: string; updatedAt: string;
};

type Status = { id: string; label: string; tone: 'sky' | 'gold' | 'moss' | 'crimson' | 'navy' | 'ink' };
export type BoardInfo = {
  noun: string;                 // "idea"
  add: string;                  // button label
  statuses: Status[];           // in order; the last is "finished"
  tags?: string[];
  tagLabel?: string;
  due?: boolean;                // has a date
  who?: string;                 // label for the "who" field, if any
  titleHint: string;
  bodyHint: string;
};

const TEAMS_TAGS = ['Developer', 'Maintenance', 'Badge', 'Feedback', 'Executive'];

export const BOARDS: Record<BoardId, BoardInfo> = {
  campaigns: {
    noun: 'campaign', add: 'New campaign', tags: ['Poster', 'Instagram', 'TikTok', 'Announcement', 'Video', 'Other'], tagLabel: 'Where', due: true, who: 'Who is making it',
    statuses: [{ id: 'idea', label: 'Idea', tone: 'gold' }, { id: 'making', label: 'Making', tone: 'sky' }, { id: 'posted', label: 'Posted', tone: 'moss' }],
    titleHint: 'What is it? (Poster: Find your class on the map)', bodyHint: 'The message, the look, where it goes up',
  },
  checkins: {
    noun: 'check-in', add: 'New check-in', tags: TEAMS_TAGS, tagLabel: 'Team', who: 'Member',
    statuses: [{ id: 'ok', label: 'On track', tone: 'moss' }, { id: 'behind', label: 'Behind', tone: 'gold' }, { id: 'missing', label: 'Not doing it', tone: 'crimson' }],
    titleHint: 'What did you check? (Posted 2 polls this week)', bodyHint: 'Notes for the next check-in',
  },
  stuco: {
    noun: 'request', add: 'New request', tags: TEAMS_TAGS, tagLabel: 'Team it goes to', due: true,
    statuses: [{ id: 'new', label: 'New', tone: 'gold' }, { id: 'sent', label: 'With the team', tone: 'sky' }, { id: 'done', label: 'Done', tone: 'moss' }],
    titleHint: 'What does student council want?', bodyHint: 'From which meeting, and any details',
  },
  decisions: {
    noun: 'decision', add: 'New decision', tags: ['App', 'Club', 'District', 'Principal', 'Money', 'Other'], tagLabel: 'About',
    statuses: [{ id: 'open', label: 'Open', tone: 'gold' }, { id: 'yes', label: 'Approved', tone: 'moss' }, { id: 'no', label: 'Declined', tone: 'crimson' }],
    titleHint: 'What needs a final say?', bodyHint: 'The question, the options, what you decided and why',
  },
};

// ── Demo items ──────────────────────────────────────────────────
const daysFrom = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const at = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const seed = (board: BoardId, rows: [string, string, string, string | null, string | null, string | null][]): Item[] =>
  rows.map(([title, body, status, tag, due, who], i) => ({
    id: `${board}-seed-${i}`, board, title, body, status, tag, due, who, by: null, createdAt: at(30 + i * 20), updatedAt: at(4 + i * 9),
  }));

const SEEDS: Record<BoardId, Item[]> = {
  campaigns: seed('campaigns', [
    ['Poster: Find any room in 2 taps', 'Map screenshot, QR to the app. Up by the office and the caf.', 'making', 'Poster', daysFrom(5), 'Priya'],
    ['Instagram: meet the App Club', 'One slide per team, who to talk to about joining.', 'idea', 'Instagram', daysFrom(14), null],
    ['Morning announcement', 'Read on the PA: the caf menu is in the app now.', 'posted', 'Announcement', daysFrom(-3), 'Jo'],
  ]),
  checkins: seed('checkins', [
    ['Posted 3 polls this week', 'Results are getting used by student council.', 'ok', 'Maintenance', null, 'Sam Okafor'],
    ['No new badges since September', 'Asked if they need help with the art step.', 'behind', 'Badge', null, 'Kai Moreno'],
    ['Feedback inbox cleared every day', '', 'ok', 'Feedback', null, 'Jo Whitfield'],
  ]),
  stuco: seed('stuco', [
    ['Spirit week schedule in the app', 'From the Oct 8 meeting. Needs to be on the calendar by Friday.', 'sent', 'Maintenance', daysFrom(3), null],
    ['A badge for the food drive', 'Everyone who drops off food gets it.', 'new', 'Badge', daysFrom(12), null],
  ]),
  decisions: seed('decisions', [
    ['Can the app show grades?', 'The district needs to say yes before we read anything from MyEdBC.', 'open', 'District', null, null],
    ['Instagram account for the club', 'Approved by the principal. Marketing runs it, the sponsor has the password.', 'yes', 'Club', null, null],
  ]),
};

// ── Store ───────────────────────────────────────────────────────
const KEY = (b: BoardId) => `spartans-board-${b}-v1`;
const fromRow = (r: ClubItemRow): Item => ({
  id: r.id, board: r.board as BoardId, title: r.title, body: r.body || '', status: r.status, tag: r.tag, due: r.due, who: r.who,
  by: r.created_by_name || null, createdAt: r.created_at, updatedAt: r.updated_at,
});
const newId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const newItem = (board: BoardId): Item => ({
  id: '', board, title: '', body: '', status: BOARDS[board].statuses[0].id, tag: null, due: null, who: null,
  by: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
});

export const useBoard = (board: BoardId) => {
  const { mode } = useContent();
  const [items, setItems] = useState<Item[] | null>(null);
  const [server, setServer] = useState(mode === 'live');
  const [note, setNote] = useState<string | null>(null);

  const readLocal = useCallback(async () => {
    const start = demoBuild ? SEEDS[board] : [];
    try { const v = await AsyncStorage.getItem(KEY(board)); return v ? (JSON.parse(v) as Item[]) : start; } catch { return start; }
  }, [board]);
  const keepLocal = (list: Item[]) => { setItems(list); AsyncStorage.setItem(KEY(board), JSON.stringify(list)).catch(() => {}); };

  const load = useCallback(async () => {
    if (mode !== 'live') { setServer(false); setItems(await readLocal()); return; }
    try {
      const { club } = await import('../backend');
      setItems((await club.list(board)).map(fromRow));
      setServer(true); setNote(null);
    } catch (e: any) {
      setServer(false);
      setNote(/club_items|does not exist|schema cache/i.test(String(e?.message)) ? 'Saved on this phone until migration 0017 runs on the server.' : String(e?.message || 'Could not load.'));
      setItems(await readLocal());
    }
  }, [mode, board, readLocal]);
  useEffect(() => { load(); }, [load]);

  const save = async (it: Item) => {
    const clean = { ...it, title: it.title.trim(), body: it.body.trim(), who: it.who?.trim() || null };
    if (server) {
      const { club } = await import('../backend');
      const row = await club.save({
        ...(clean.id && !clean.id.startsWith('local-') ? { id: clean.id } : {}),
        board, title: clean.title, body: clean.body || null, status: clean.status, tag: clean.tag, due: clean.due, who: clean.who,
      });
      const saved = fromRow(row);
      setItems(list => [saved, ...(list || []).filter(x => x.id !== saved.id)]);
      return saved;
    }
    const saved = { ...clean, id: clean.id || newId(), updatedAt: new Date().toISOString() };
    keepLocal([saved, ...(items || []).filter(x => x.id !== saved.id)]);
    return saved;
  };

  const remove = async (id: string) => {
    if (server) { const { club } = await import('../backend'); await club.remove(id); setItems(list => (list || []).filter(x => x.id !== id)); return; }
    keepLocal((items || []).filter(x => x.id !== id));
  };

  return { items, load, save, remove, note, server, info: BOARDS[board] };
};
