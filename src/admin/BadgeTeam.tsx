// Spartans — App Club Admin → Badges (the Badge team).
// "Design a badge" opens the five-step wizard (BadgeWizard). Under it, every
// badge in the app: search it, sort by most recently edited (default) or by
// rarity, filter to what's waiting. Tap any badge to edit it in the same
// wizard; badges with work in progress open that work instead.

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, Platform } from 'react-native';
import { useTheme } from '../ThemeContext';
import { shadow, tnum } from '../theme';
import { Icon } from '../components/Icon';
import { BadgeArt, BadgeTemplate } from '../components/BadgeArt';
import { BADGES, Badge, CATEGORY, RARITY, RARITY_ORDER } from '../badges';
import { ListCard } from '../screens/Settings';
import {
  BadgeDesign, DesignStatus, STATUS, newDesign, newEdit, toBadge, openWorkOn, useBadgeDesigns,
} from '../badgeDesigns';
import { BadgeWizard } from './BadgeWizard';

type Sort = 'recent' | 'rarity';
type Filter = 'all' | 'pending' | 'draft' | 'rejected';
type Entry = { key: string; badge: Badge; work?: BadgeDesign; at?: string };

const PAGE = 40;

export const BadgeTeam = ({ canApprove }: { canApprove: boolean }) => {
  const { c } = useTheme();
  const { designs, note, catalog } = useBadgeDesigns();
  const [open, setOpen] = useState<BadgeDesign | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [filter, setFilter] = useState<Filter>('all');
  const [all, setAll] = useState(false);

  // Every badge, plus new designs that aren't in the catalogue yet.
  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = BADGES.map(b => {
      const work = openWorkOn(b.id);
      const at = [work?.updatedAt, b.editedAt].filter(Boolean).sort().pop();
      return { key: b.id, badge: work ? toBadge(work) : b, work, at };
    });
    for (const d of designs) {
      if (d.targetId || d.status === 'approved') continue;
      out.push({ key: d.id, badge: toBadge(d), work: d, at: d.updatedAt });
    }
    return out;
  }, [designs, catalog]);

  const count = (s: DesignStatus) => entries.filter(e => e.work?.status === s).length;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = entries
      .filter(e => filter === 'all' || e.work?.status === filter)
      .filter(e => !s || `${e.badge.title} ${e.badge.desc} ${RARITY[e.badge.rarity].label} ${CATEGORY[e.badge.category]}`.toLowerCase().includes(s));
    return sort === 'recent'
      // Recently edited first; never-edited badges keep catalogue order after them.
      ? [...list].sort((a, b) => (b.at || '').localeCompare(a.at || ''))
      : [...list].sort((a, b) => RARITY_ORDER.indexOf(a.badge.rarity) - RARITY_ORDER.indexOf(b.badge.rarity) || a.badge.title.localeCompare(b.badge.title));
  }, [entries, q, sort, filter]);
  const visible = all || q.trim() ? shown : shown.slice(0, PAGE);

  const pending = count('pending');

  return (
    <>
      {!!note && <Note text={note} warn />}

      {/* Start a design */}
      <Pressable onPress={() => setOpen(newDesign())} accessibilityRole="button" accessibilityLabel="Design a badge"
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, backgroundColor: c.navy700, opacity: pressed ? 0.85 : 1 }, shadow.md]}>
        <View style={{ width: 58, height: 58 }}>
          <BadgeTemplate tint={RARITY.rare} size={58} id="cta" />
          <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={22} stroke={2.6} color="#fff" />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 }}>Design a badge</Text>
          <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 2, lineHeight: 17 }}>Idea, how to get it, rarity, art, then {canApprove ? 'publish' : 'send it for approval'}.</Text>
        </View>
        <Icon name="chev-r" size={18} stroke={2} color="rgba(255,255,255,0.8)" />
      </Pressable>

      {canApprove && pending > 0 && (
        <Pressable onPress={() => { setFilter('pending'); setSort('recent'); }} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: c.skyTint, opacity: pressed ? 0.8 : 1 })}>
          <Icon name="clock" size={17} stroke={1.9} color={c.sky600} />
          <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: c.ink }}>{pending} waiting for your approval</Text>
          <Icon name="chev-r" size={15} stroke={2} color={c.sky600} />
        </Pressable>
      )}

      {/* All badges */}
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>All badges</Text>
          <Text style={[{ fontSize: 12.5, color: c.ink3 }, tnum]}>{shown.length}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: c.surface }}>
          <Icon name="search" size={16} stroke={2} color={c.ink4} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search badges" placeholderTextColor={c.ink4} autoCorrect={false} returnKeyType="search"
            style={{ flex: 1, paddingVertical: 11, fontSize: 15.5, color: c.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}) }} />
          {!!q && (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search">
              <Icon name="close" size={15} stroke={2} color={c.ink4} />
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Seg value={sort} onChange={setSort} options={[['recent', 'Recent'], ['rarity', 'Rarity']]} />
          <View style={{ flex: 1 }} />
          {([['all', 'All'], ['pending', 'Waiting'], ['draft', 'Drafts'], ['rejected', 'Sent back']] as [Filter, string][])
            .filter(([f]) => f === 'all' || count(f as DesignStatus) > 0 || filter === f)
            .map(([f, label]) => (
              <Chip key={f} on={filter === f} label={f === 'all' ? label : `${label} ${count(f as DesignStatus)}`} onPress={() => setFilter(f)} />
            ))}
        </View>

        {visible.length === 0 ? (
          <Text style={{ fontSize: 13, color: c.ink4, textAlign: 'center', paddingVertical: 12 }}>No badges match.</Text>
        ) : (
          <ListCard>
            {visible.map((e, i) => <BadgeRow key={e.key} e={e} last={i === visible.length - 1} onPress={() => setOpen(e.work || newEdit(e.badge))} />)}
          </ListCard>
        )}
        {!all && !q.trim() && shown.length > PAGE && (
          <Pressable onPress={() => setAll(true)} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: c.paper2, opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.ink2 }}>Show all {shown.length}</Text>
          </Pressable>
        )}
      </View>

      <BadgeWizard design={open} canApprove={canApprove} onClose={() => setOpen(null)} />
    </>
  );
};

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

const BadgeRow = ({ e, last, onPress }: { e: Entry; last: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  const b = e.badge;
  const w = e.work;
  const tone = w ? { gold: c.gold, sky: c.sky600, moss: c.moss, crimson: c.crimson }[STATUS[w.status].tone] : null;
  const tag = w ? (w.status === 'pending' ? 'Waiting' : STATUS[w.status].label) : e.at ? `Edited ${ago(e.at)}` : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${b.title}. ${tag || 'Tap to edit'}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: pressed ? c.paper2 : 'transparent', borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line2 })}>
      <BadgeArt badge={b} size={46} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{b.title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: c.ink3, marginTop: 1 }}>
          <Text style={{ color: RARITY[b.rarity].chrome ? c.ink2 : RARITY[b.rarity].color, fontWeight: '700' }}>{RARITY[b.rarity].label}</Text>
          {` · ${CATEGORY[b.category]}${w && !w.targetId ? ' · New' : ''}`}
        </Text>
      </View>
      {!!tag && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: tone ? tone + '1F' : c.paper2 }}>
          {!!tone && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone }} />}
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: tone || c.ink3 }}>{tag}</Text>
        </View>
      )}
      <Icon name="chev-r" size={15} stroke={1.8} color={c.ink4} />
    </Pressable>
  );
};

const Seg = <T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.paper2, borderRadius: 999, padding: 3 }}>
      {options.map(([id, label]) => {
        const on = id === value;
        return (
          <Pressable key={id} onPress={() => onChange(id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={[{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: on ? c.surface : 'transparent' }, on ? shadow.sm : shadow.none]}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: on ? c.ink : c.ink3 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? c.navy700 : c.paper2 }}>
      <Text style={[{ fontSize: 12.5, fontWeight: '600', color: on ? '#fff' : c.ink2 }, tnum]}>{label}</Text>
    </Pressable>
  );
};

const Note = ({ text, warn }: { text: string; warn?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, backgroundColor: warn ? c.crimsonTint : c.skyTint }}>
      <Icon name={warn ? 'flash' : 'sparkle'} size={16} stroke={1.9} color={warn ? c.crimson : c.sky600} />
      <Text style={{ flex: 1, fontSize: 12.5, color: c.ink2, lineHeight: 17 }}>{text}</Text>
    </View>
  );
};
