// Spartans — App Club Admin → Maintenance: what students see, and the posts
// behind it.
//   OnScreen  place by place, what's showing right now. The Buzz leads: tap
//             Preview to see it exactly as it looks on Home, and move slides
//             up or down; the preview follows. Other places fold away. Then
//             what's coming up and what's ending soon.
//   Posts     every post you may edit: + New, search (looks through all of
//             them, whatever the filter), filter by state.
// Members only see "Move" arrows and the New kinds for the jobs they have
// (src/ranks.ts); the server enforces the same.

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../ThemeContext';
import { tnum } from '../theme';
import { Icon } from '../components/Icon';
import { Buzz, postToSlide } from '../components/Buzz';
import {
  useContent, Post, PostKind, Place, Phase, KINDS, PLACES, PLACE_ORDER, PHASES,
  phaseOf, titleOf, subOf,
} from '../content';
import { fmtWhen } from './PostEditor';
import { Act, Empty, FoundLine, Group, Hint, Row, Search, SectionTitle, Seg } from './ui';
import { byTitle, matches } from './search';
import { BannerGallery } from '../screens/Settings';
import { TEAMS } from '../ranks';

// ════════════════════════════════════════════════════════════════
// On screen
// ════════════════════════════════════════════════════════════════
export const OnScreen = ({ onOpen }: { onOpen: (p: Post) => void }) => {
  const { c } = useTheme();
  const store = useContent();
  const [openPlace, setOpenPlace] = useState<Place | null>(null);
  const [styles, setStyles] = useState(false);
  const active = store.posts.filter(p => ['live', 'scheduled'].includes(phaseOf(p, store.now)));
  const scheduled = active.filter(p => phaseOf(p, store.now) === 'scheduled')
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
  const endingSoon = active.filter(p => phaseOf(p, store.now) === 'live' && p.endsAt && Date.parse(p.endsAt) - store.now < 48 * 3600_000);

  return (
    <>
      <BuzzCard onOpen={onOpen} />

      <View style={{ gap: 8 }}>
        <SectionTitle title="Everywhere else" />
        <PostCard>
          {PLACE_ORDER.filter(pl => pl !== 'buzz').map((pl, i, all) => {
            const list = store.inPlace(pl);
            const isOpen = openPlace === pl;
            return (
              <View key={pl} style={{ borderBottomWidth: i === all.length - 1 ? 0 : 1, borderBottomColor: c.line2 }}>
                <Pressable onPress={() => setOpenPlace(isOpen ? null : pl)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
                  <View style={{ width: 32, alignItems: 'center' }}>
                    <Icon name={PLACES[pl].icon} size={20} stroke={1.9} color={c.ink2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{PLACES[pl].label}</Text>
                    <Text style={{ fontSize: 13, color: c.ink3, marginTop: 1 }}>{PLACES[pl].sub}</Text>
                  </View>
                  <Text style={[{ fontSize: 14, color: c.ink3 }, tnum]}>{list.length}</Text>
                  <View style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}><Icon name="chev-d" size={16} stroke={2.2} color={c.ink4} /></View>
                </Pressable>
                {isOpen && (
                  <View style={{ paddingBottom: 6 }}>
                    {list.length === 0
                      ? <Text style={{ fontSize: 14, color: c.ink3, paddingLeft: 60, paddingRight: 14, paddingBottom: 10 }}>Nothing here right now.</Text>
                      : list.map(p => <PostRow key={p.id} p={p} last onPress={() => onOpen(p)} inset />)}
                    {pl === 'banner' && (
                      <Pressable onPress={() => setStyles(s => !s)} accessibilityRole="button" style={{ paddingLeft: 60, paddingRight: 14, minHeight: 44, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: c.link }}>{styles ? 'Hide banner styles' : 'See every banner style'}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </PostCard>
        {styles && <BannerGallery />}
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle title="Coming up" />
        {scheduled.length === 0 ? <Text style={{ fontSize: 14, color: c.ink3, paddingHorizontal: 4 }}>Nothing scheduled.</Text> : (
          <PostCard>{scheduled.map((p, i) => <PostRow key={p.id} p={p} last={i === scheduled.length - 1} onPress={() => onOpen(p)} />)}</PostCard>
        )}
      </View>

      {endingSoon.length > 0 && (
        <View style={{ gap: 8 }}>
          <SectionTitle title="Ending in the next 2 days" />
          <PostCard>{endingSoon.map((p, i) => <PostRow key={p.id} p={p} last={i === endingSoon.length - 1} onPress={() => onOpen(p)} />)}</PostCard>
        </View>
      )}
    </>
  );
};

// The Buzz: show order, with a live preview on top and arrows to move slides.
const BuzzCard = ({ onOpen }: { onOpen: (p: Post) => void }) => {
  const { c } = useTheme();
  const store = useContent();
  const [preview, setPreview] = useState(true);
  const [focus, setFocus] = useState<{ id: string; at: number } | null>(null);
  const list = store.inPlace('buzz');
  const slides = useMemo(() => list.map(postToSlide), [list]);
  const show = (id: string) => setFocus({ id, at: Date.now() });

  const move = async (p: Post, dir: -1 | 1) => {
    await store.move(p.id, 'buzz', dir);
    show(p.id);
  };

  return (
    <View style={{ gap: 10 }}>
      <SectionTitle title="The Buzz" trailing={preview ? 'Hide preview' : 'Show preview'} onTrailing={() => setPreview(v => !v)} />

      {preview && <Buzz slides={slides} preview aspect={1.22} focus={focus} />}

      {list.length === 0 ? (
        <Empty icon="sparkle" title="Nothing in The Buzz" sub="Make a trivia question, poll or news post and it shows here." />
      ) : (
        <>
          <Text style={{ fontSize: 13.5, color: c.ink3, lineHeight: 19, paddingHorizontal: 4 }}>
            {preview ? 'Tap a slide to see it above. ' : ''}Students swipe through in this order; pinned news always leads.
          </Text>
          <PostCard>
            {list.map((p, i) => {
              const movable = !p.pinned && store.canEdit(p.kind);
              return (
                <PostRow key={p.id} p={p} last={i === list.length - 1} number={i + 1}
                  onPress={() => (preview ? show(p.id) : onOpen(p))}
                  onInfo={preview ? () => onOpen(p) : undefined}
                  order={movable ? {
                    up: i > 0 && !list[i - 1].pinned ? () => move(p, -1) : undefined,
                    down: i < list.length - 1 ? () => move(p, 1) : undefined,
                  } : undefined} />
              );
            })}
          </PostCard>
        </>
      )}
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// Posts
// ════════════════════════════════════════════════════════════════
export const Posts = ({ onOpen, editable, onNew, kinds: only }: { onOpen: (p: Post) => void; editable: PostKind[]; onNew: (k: PostKind) => void; kinds?: PostKind[] }) => {
  const { c } = useTheme();
  const store = useContent();
  const [kind, setKind] = useState<PostKind | 'all'>('all');
  const [phase, setPhase] = useState<Phase | 'all'>('all');
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState('');

  const mine = only ? store.posts.filter(p => only.includes(p.kind)) : store.posts;
  const canMake = only ? editable.filter(k => only.includes(k)) : editable;
  const kinds = (Object.keys(KINDS) as PostKind[]).filter(k => mine.some(p => p.kind === k));
  const searching = !!q.trim();
  const filtered = useMemo(() => mine
    // Searching looks through everything, not just the filter you were on.
    .filter(p => searching || kind === 'all' || p.kind === kind)
    .filter(p => searching || phase === 'all' || phaseOf(p, store.now) === phase)
    .filter(p => matches(q, titleOf(p), subOf(p), KINDS[p.kind].label))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  [mine, kind, phase, q, store.now]);
  const list = byTitle(q, filtered, p => titleOf(p) || '');
  const count = (ph: Phase) => mine.filter(p => (kind === 'all' || p.kind === kind) && phaseOf(p, store.now) === ph).length;
  const phases = ([['live', 'Live'], ['scheduled', 'Scheduled'], ['draft', 'Drafts'], ['ended', 'Ended']] as [Phase, string][])
    .filter(([id]) => count(id) > 0 || phase === id);
  const make = () => canMake.length === 1 ? onNew(canMake[0]) : setPicking(true);

  return (
    <>
      {canMake.length > 0 ? (
        picking ? (
          <Group title="What are you making?" trailing="Cancel" onTrailing={() => setPicking(false)}>
            {canMake.map(k => <Row key={k} icon={KINDS[k].icon as any} label={KINDS[k].label} sub={`Shows in ${KINDS[k].places.map(x => PLACES[x].label).join(', ')}`} onPress={() => { setPicking(false); onNew(k); }} />)}
          </Group>
        ) : (
          <Act label={canMake.length === 1 ? `New ${KINDS[canMake[0]].noun}` : 'New post'} icon="plus" fill onPress={make} />
        )
      ) : (
        <Hint text={`You can't post this yet. Ask the ${TEAMS.maintenance.label} Manager for the job.`} />
      )}

      {mine.length > 5 && <Search value={q} onChange={setQ} placeholder={`Search ${mine.length} posts`} />}
      {searching ? <FoundLine n={list.length} q={q} onClear={() => setQ('')} /> : (
        <>
          {kinds.length > 1 && (
            <Seg value={kind} onChange={v => setKind(v)} options={[{ id: 'all' as const, label: 'Every kind' }, ...kinds.map(k => ({ id: k, label: KINDS[k].label }))]} />
          )}
          {phases.length > 1 && <Seg value={phase} onChange={v => setPhase(v)} options={[
            { id: 'all' as const, label: 'All' }, ...phases.map(([id, label]) => ({ id, label, count: count(id) })),
          ]} />}
        </>
      )}

      {list.length === 0 ? (
        searching ? <Empty icon="search" title="Nothing matches" sub="Try a word from the post." />
          : <Empty title={mine.length ? 'Nothing here' : 'No posts yet'} sub={!mine.length && canMake.length ? 'Make the first one with the button above.' : undefined} />
      ) : (
        <PostCard>{list.map((p, i) => <PostRow key={p.id} p={p} last={i === list.length - 1} onPress={() => onOpen(p)} showPhase />)}</PostCard>
      )}
    </>
  );
};

// ════════════════════════════════════════════════════════════════
// Shared rows
// ════════════════════════════════════════════════════════════════
const PostCard = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return <View style={{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.line2 }}>{children}</View>;
};

export const PostRow = ({ p, last, onPress, onInfo, order, showPhase, number, inset }: {
  p: Post; last: boolean; onPress: () => void; onInfo?: () => void; showPhase?: boolean; number?: number; inset?: boolean;
  order?: { up?: () => void; down?: () => void };
}) => {
  const { c } = useTheme();
  const store = useContent();
  const phase = phaseOf(p, store.now);
  const s = store.stats(p.id);
  const t = p.kind === 'trivia' || p.kind === 'poll' ? store.tally(p.id) : null;
  const tone = { moss: c.moss, sky: c.sky600, ink: c.ink4, gold: c.gold }[PHASES[phase].tone];
  const numbers = [
    s ? `${s.viewers.toLocaleString()} saw` : null,
    t ? `${t.total.toLocaleString()} ${p.kind === 'poll' ? 'votes' : 'answers'}` : s && p.kind === 'news' ? `${s.opens.toLocaleString()} opened` : null,
  ].filter(Boolean).join(' · ');
  const when = phase === 'scheduled' ? `Starts ${fmtWhen(p.startsAt!)}` : phase === 'live' && p.endsAt ? `Ends ${fmtWhen(p.endsAt)}` : phase === 'ended' && p.endsAt ? `Ended ${fmtWhen(p.endsAt)}` : null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line2 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${KINDS[p.kind].label}: ${titleOf(p)}. ${PHASES[phase].label}`}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingVertical: 10, paddingLeft: inset ? 60 : 14, paddingRight: order || onInfo ? 6 : 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
        {number !== undefined && <Text style={[{ width: 16, fontSize: 14, fontWeight: '600', color: c.ink3, textAlign: 'center' }, tnum]}>{number}</Text>}
        {!inset && (
          <View style={{ width: 32, alignItems: 'center' }}>
            <Icon name={KINDS[p.kind].icon} size={20} stroke={1.9} color={c.ink2} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {p.pinned && <Icon name="pin" size={12} stroke={2} color={c.gold} />}
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15.5, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{titleOf(p) || 'Untitled'}</Text>
          </View>
          <Text numberOfLines={1} style={[{ fontSize: 13, color: c.ink3, marginTop: 1 }, tnum]}>
            {[showPhase ? PHASES[phase].label : null, KINDS[p.kind].label, numbers || null, when].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {showPhase && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />}
      </Pressable>
      {onInfo && (
        <Pressable onPress={onInfo} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Results and edit: ${titleOf(p) || 'Untitled'}`}
          style={({ pressed }) => ({ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.navy50 : 'transparent', marginRight: order ? 0 : 8 })}>
          <Icon name="edit" size={15} stroke={1.9} color={c.ink3} />
        </Pressable>
      )}
      {order && (
        <View style={{ paddingRight: 10, paddingLeft: 4, gap: 3 }}>
          <Arrow dir="up" onPress={order.up} />
          <Arrow dir="down" onPress={order.down} />
        </View>
      )}
    </View>
  );
};

const Arrow = ({ dir, onPress }: { dir: 'up' | 'down'; onPress?: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={{ left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={dir === 'up' ? 'Move earlier' : 'Move later'}
      style={({ pressed }) => ({ width: 36, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.navy50 : c.paper2, opacity: onPress ? 1 : 0.3, transform: [{ rotate: dir === 'up' ? '180deg' : '0deg' }] })}>
      <Icon name="chev-d" size={14} stroke={2.2} color={c.ink2} />
    </Pressable>
  );
};
