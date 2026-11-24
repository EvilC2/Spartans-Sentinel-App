// Spartans — App Club Admin → Badges (the Badge team).
// "Design a badge" opens the five-step wizard (BadgeWizard). Under it, every
// badge in the app: search it (looks through all of them), sort by most
// recently edited (default) or by rarity, filter to what's waiting. Tap any badge to edit it in the same
// wizard; badges with work in progress open that work instead.

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../ThemeContext';
import { Icon } from '../components/Icon';
import { BadgeArt } from '../components/BadgeArt';
import { BADGES, Badge, CATEGORY, RARITY, RARITY_ORDER } from '../badges';
import {
  BadgeDesign, DesignStatus, STATUS, newDesign, newEdit, toBadge, openWorkOn, useBadgeDesigns,
} from '../badgeDesigns';
import { BadgeWizard } from './BadgeWizard';
import { Act, Empty, FoundLine, Group, Hint, Pill, Row, Search, SectionTitle, Seg, ago } from './ui';
import { byTitle, matches } from './search';

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
    const s = q.trim();
    const list = entries
      .filter(e => s || filter === 'all' || e.work?.status === filter)
      .filter(e => matches(s, e.badge.title, e.badge.desc, RARITY[e.badge.rarity].label, CATEGORY[e.badge.category]));
    if (s) return byTitle(s, list, e => e.badge.title);
    return sort === 'recent'
      // Recently edited first; never-edited badges keep catalogue order after them.
      ? [...list].sort((a, b) => (b.at || '').localeCompare(a.at || ''))
      : [...list].sort((a, b) => RARITY_ORDER.indexOf(a.badge.rarity) - RARITY_ORDER.indexOf(b.badge.rarity) || a.badge.title.localeCompare(b.badge.title));
  }, [entries, q, sort, filter]);
  const searching = !!q.trim();
  const visible = all || searching ? shown : shown.slice(0, PAGE);

  const pending = count('pending');
  const tabs = ([['all', 'All'], ['pending', 'Waiting'], ['draft', 'Drafts'], ['rejected', 'Sent back']] as [Filter, string][])
    .filter(([f]) => f === 'all' || count(f as DesignStatus) > 0 || filter === f)
    .map(([id, label]) => ({ id, label, count: id === 'all' ? undefined : count(id as DesignStatus) }));

  return (
    <>
      {!!note && <Hint text={note} warn />}
      <Act label="Design a badge" icon="plus" fill onPress={() => setOpen(newDesign())} />

      {canApprove && pending > 0 && filter !== 'pending' && !searching && (
        <Group>
          <Row icon="clock" label="Waiting for your approval" count={pending} onPress={() => { setFilter('pending'); setSort('recent'); }} />
        </Group>
      )}

      <Search value={q} onChange={setQ} placeholder={`Search all ${entries.length} badges`} />

      {searching ? <FoundLine n={shown.length} q={q} onClear={() => setQ('')} /> : (
        <>
          {tabs.length > 1 && <Seg value={filter} onChange={setFilter} options={tabs} />}
          <SectionTitle title={filter === 'all' ? 'All badges' : tabs.find(t => t.id === filter)?.label || ''} trailing={sort === 'recent' ? 'Sort by rarity' : 'Sort by recent'} onTrailing={() => setSort(sort === 'recent' ? 'rarity' : 'recent')} />
        </>
      )}

      {visible.length === 0
        ? (searching ? <Empty icon="search" title="No badge matches" sub="Try part of its name, its rarity or its kind." /> : <Empty title="Nothing here" />)
        : <Group>{visible.map(e => <BadgeRow key={e.key} e={e} person onPress={() => setOpen(e.work || newEdit(e.badge))} />)}</Group>}
      {!all && !searching && shown.length > PAGE && <Act label={`Show all ${shown.length}`} tone="soft" fill onPress={() => setAll(true)} />}

      <BadgeWizard design={open} canApprove={canApprove} onClose={() => setOpen(null)} />
    </>
  );
};

// `person` only tells Group to start its divider after the art.
const BadgeRow = ({ e, onPress }: { e: Entry; person?: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  const b = e.badge;
  const w = e.work;
  const tag = w ? (w.status === 'pending' ? 'Waiting' : STATUS[w.status].label) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${b.title}. ${tag || 'Tap to edit'}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
      <BadgeArt badge={b} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{b.title || 'Untitled'}</Text>
        <Text numberOfLines={1} style={{ fontSize: 13, color: c.ink3, marginTop: 1 }}>
          {[RARITY[b.rarity].label, CATEGORY[b.category], w && !w.targetId ? 'New' : !w && e.at ? `Edited ${ago(e.at)}` : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {!!tag && w && <Pill text={tag} tone={STATUS[w.status].tone} />}
      <Icon name="chev-r" size={15} stroke={2.2} color={c.ink4} />
    </Pressable>
  );
};
