// Spartans — one App Club board on screen (see boards.ts for what each one
// holds). Status filter with counts, + New, cards you tap to edit. The arrow
// on a card moves it to the next status in one tap.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ImageSourcePropType } from 'react-native';
import { useTheme } from '../ThemeContext';
import { tnum } from '../theme';
import { Icon } from '../components/Icon';
import { ask } from '../confirm';
import type { PageTone } from '../pages';
import { BOARDS, BoardId, Item, newItem, useBoard } from './boards';
import { Act, Card, ChipPick, ClubSheet, Empty, Field, Hint, Pill, Seg, ago, toneOf } from './ui';

export const BoardView = ({ board, art, tone, canEdit = true }: {
  board: BoardId; art: ImageSourcePropType; tone: PageTone; canEdit?: boolean;
}) => {
  const { c } = useTheme();
  const b = useBoard(board);
  const info = b.info;
  const [filter, setFilter] = useState<string>('all');
  const [tag, setTag] = useState<string>('all');
  const [editing, setEditing] = useState<Item | null>(null);
  const items = b.items || [];
  const shown = useMemo(() => items
    .filter(i => filter === 'all' || i.status === filter)
    .filter(i => tag === 'all' || i.tag === tag)
    .sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || '')),
  [items, filter, tag]);
  const usedTags = (info.tags || []).filter(t => items.some(i => i.tag === t));

  const next = (it: Item) => {
    const i = info.statuses.findIndex(s => s.id === it.status);
    const n = info.statuses[(i + 1) % info.statuses.length];
    b.save({ ...it, status: n.id }).catch(() => {});
  };

  return (
    <View style={{ gap: 14 }}>
      {!!b.note && <Hint text={b.note} />}
      {canEdit && <Act label={info.add} icon="plus" fill onPress={() => setEditing(newItem(board))} />}
      <Seg value={filter} onChange={setFilter} options={[
        { id: 'all', label: 'All', count: items.length },
        ...info.statuses.map(s => ({ id: s.id, label: s.label, count: items.filter(i => i.status === s.id).length })),
      ]} />
      {usedTags.length > 1 && (
        <Seg value={tag} onChange={setTag} options={[{ id: 'all', label: `Every ${(info.tagLabel || 'tag').toLowerCase()}` }, ...usedTags.map(t => ({ id: t, label: t }))]} />
      )}
      {b.items === null && <Text style={{ fontSize: 13, color: c.ink3 }}>Loading…</Text>}
      {b.items !== null && shown.length === 0 && <Empty art={art} title={items.length ? 'Nothing here' : `No ${info.noun}s yet`} sub={canEdit && !items.length ? `Tap "${info.add}" to add the first one.` : undefined} />}
      <View style={{ gap: 10 }}>
        {shown.map(it => <ItemCard key={it.id} it={it} board={board} canEdit={canEdit} onPress={() => canEdit && setEditing(it)} onNext={() => next(it)} />)}
      </View>
      <ItemSheet item={editing} board={board} art={art} tone={tone} onClose={() => setEditing(null)} onSave={b.save} onDelete={b.remove} />
    </View>
  );
};

const ItemCard = ({ it, board, canEdit, onPress, onNext }: { it: Item; board: BoardId; canEdit: boolean; onPress: () => void; onNext: () => void }) => {
  const { c } = useTheme();
  const b = BOARDS[board];
  const st = b.statuses.find(s => s.id === it.status) || b.statuses[0];
  const last = b.statuses[b.statuses.length - 1].id === it.status;
  const due = it.due ? new Date(it.due + 'T12:00:00') : null;
  const late = due && !last && due.getTime() < Date.now() - 86400_000;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${it.title}. ${st.label}`}
        style={({ pressed }) => ({ flex: 1, padding: 14, borderRadius: 20, backgroundColor: c.surface, gap: 6, opacity: pressed ? 0.85 : 1, borderWidth: 1, borderColor: c.line2 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingRight: canEdit ? 44 : 0 }}>
          <Pill text={st.label} tone={st.tone} />
          {!!it.tag && <Pill text={it.tag} tone="ink" />}
          {due && <Pill text={due.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} tone={late ? 'crimson' : 'ink'} icon="calendar" />}
        </View>
        <Text style={{ fontSize: 15.5, fontWeight: '700', color: c.ink, letterSpacing: -0.2 }}>{it.title}</Text>
        {!!it.body && <Text numberOfLines={3} style={{ fontSize: 13.5, color: c.ink2, lineHeight: 19 }}>{it.body}</Text>}
        <Text style={{ fontSize: 12, color: c.ink4 }}>{[it.who, it.by ? `added by ${it.by}` : null, ago(it.updatedAt)].filter(Boolean).join(' · ')}</Text>
      </Pressable>
      {canEdit && (
        <Pressable onPress={onNext} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Move to ${b.statuses[(b.statuses.findIndex(s => s.id === it.status) + 1) % b.statuses.length].label}`}
          style={({ pressed }) => ({ position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: last ? c.paper2 : c.navy50, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <Icon name={last ? 'swap' : 'chev-r'} size={16} stroke={2.4} color={c.link} />
        </Pressable>
      )}
    </View>
  );
};

const ItemSheet = ({ item, board, art, tone, onClose, onSave, onDelete }: {
  item: Item | null; board: BoardId; art: ImageSourcePropType; tone: PageTone; onClose: () => void;
  onSave: (it: Item) => Promise<Item>; onDelete: (id: string) => Promise<void>;
}) => {
  const info = BOARDS[board];
  const [d, setD] = useState<Item | null>(item);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setD(item); setErr(null); }, [item]);
  if (!item || !d) return null;
  const set = (p: Partial<Item>) => setD(x => (x ? { ...x, ...p } : x));
  const fresh = !item.id;

  const save = async () => {
    if (!d.title.trim()) { setErr('Give it a title first.'); return; }
    if (d.due && !/^\d{4}-\d{2}-\d{2}$/.test(d.due)) { setErr('Dates look like 2026-11-04.'); return; }
    setBusy(true); setErr(null);
    try { await onSave(d); onClose(); } catch (e: any) { setErr(String(e?.message || 'Could not save.')); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!(await ask(`Delete this ${info.noun}?`, 'It is gone for the whole team.', 'Delete', true))) return;
    try { await onDelete(item.id); onClose(); } catch (e: any) { setErr(String(e?.message || 'Could not delete.')); }
  };

  return (
    <ClubSheet visible onClose={onClose} title={fresh ? info.add : `Edit ${info.noun}`} art={art} tone={tone}
      footer={<>
        {!!err && <ErrText text={err} />}
        <Act label={busy ? 'Saving…' : fresh ? 'Add' : 'Save'} icon="check" fill onPress={save} disabled={busy} />
      </>}>
      <Field label="Title" value={d.title} onChangeText={v => set({ title: v })} placeholder={info.titleHint} autoFocus={fresh} />
      <Field label="Notes" value={d.body} onChangeText={v => set({ body: v })} placeholder={info.bodyHint} multiline />
      <View style={{ gap: 8 }}>
        <SheetLabel text="Status" />
        <ChipPick multi={false} value={[d.status]} options={info.statuses.map(s => ({ id: s.id, label: s.label }))} onToggle={v => set({ status: v })} />
      </View>
      {!!info.tags && (
        <View style={{ gap: 8 }}>
          <SheetLabel text={info.tagLabel || 'Tag'} />
          <ChipPick multi={false} value={d.tag ? [d.tag] : []} options={info.tags.map(t => ({ id: t, label: t }))} onToggle={v => set({ tag: d.tag === v ? null : v })} />
        </View>
      )}
      {!!info.who && <Field label={info.who} value={d.who || ''} onChangeText={v => set({ who: v })} placeholder="Name" />}
      {info.due && <Field label="Date (YYYY-MM-DD)" value={d.due || ''} onChangeText={v => set({ due: v.trim() || null })} placeholder={new Date().toISOString().slice(0, 10)} keyboardType="numbers-and-punctuation" autoCorrect={false} />}
      {!fresh && <Act label="Delete" icon="trash" tone="danger" onPress={del} />}
    </ClubSheet>
  );
};

const SheetLabel = ({ text }: { text: string }) => {
  const { c } = useTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: c.ink3 }}>{text}</Text>;
};

const ErrText = ({ text }: { text: string }) => {
  const { c } = useTheme();
  return <Text style={{ fontSize: 13.5, color: c.danger }}>{text}</Text>;
};
