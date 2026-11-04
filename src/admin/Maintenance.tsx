// Spartans — App Club Admin → Maintenance: what students see, and the posts
// behind it.
//   OnScreen  place by place, what's showing right now. The Buzz leads: tap
//             Preview to see it exactly as it looks on Home, and move slides
//             up or down; the preview follows. Other places fold away. Then
//             what's coming up and what's ending soon.
//   Posts     every post you may edit: search, filter, + New.
// Members only see "Move" arrows and the New kinds for the jobs they have
// (src/ranks.ts); the server enforces the same.

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useTheme } from '../ThemeContext';
import { shadow, tnum } from '../theme';
import { Icon } from '../components/Icon';
import { Buzz, postToSlide } from '../components/Buzz';
import {
  useContent, Post, PostKind, Place, Phase, KINDS, PLACES, PLACE_ORDER, PHASES,
  phaseOf, titleOf, subOf,
} from '../content';
import { fmtWhen, Chips, Btn } from './PostEditor';
import { Act, Empty, Hint, Search, Seg } from './ui';
import { ListCard, BannerGallery, fieldStyle } from '../screens/Settings';
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
        <Heading icon="grid" text="Everywhere else" />
        <ListCard>
          {PLACE_ORDER.filter(pl => pl !== 'buzz').map((pl, i, all) => {
            const list = store.inPlace(pl);
            const isOpen = openPlace === pl;
            return (
              <View key={pl} style={{ borderBottomWidth: i === all.length - 1 ? 0 : 1, borderBottomColor: c.line2 }}>
                <Pressable onPress={() => setOpenPlace(isOpen ? null : pl)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={PLACES[pl].icon} size={16} stroke={1.9} color={c.navy700} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14.5, fontWeight: '600', color: c.ink }}>{PLACES[pl].label}</Text>
                    <Text style={{ fontSize: 12, color: c.ink3 }}>{PLACES[pl].sub}</Text>
                  </View>
                  <CountPill n={list.length} />
                  <Icon name={isOpen ? 'chev-d' : 'chev-r'} size={15} stroke={1.8} color={c.ink4} />
                </Pressable>
                {isOpen && (
                  <View style={{ paddingBottom: 6 }}>
                    {list.length === 0
                      ? <Text style={{ fontSize: 13, color: c.ink4, paddingHorizontal: 14, paddingBottom: 8 }}>Nothing here right now.</Text>
                      : list.map(p => <PostRow key={p.id} p={p} last onPress={() => onOpen(p)} inset />)}
                    {pl === 'banner' && (
                      <Pressable onPress={() => setStyles(s => !s)} style={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: c.navy700 }}>{styles ? 'Hide banner styles' : 'See every banner style'}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ListCard>
        {styles && <BannerGallery />}
      </View>

      <View style={{ gap: 8 }}>
        <Heading icon="clock" text="Coming up" trailing={`${scheduled.length} scheduled`} />
        {scheduled.length === 0 ? <Text style={{ fontSize: 13, color: c.ink4 }}>Nothing scheduled.</Text> : (
          <ListCard>{scheduled.map((p, i) => <PostRow key={p.id} p={p} last={i === scheduled.length - 1} onPress={() => onOpen(p)} />)}</ListCard>
        )}
      </View>

      {endingSoon.length > 0 && (
        <View style={{ gap: 8 }}>
          <Heading icon="flash" text="Ending in the next 2 days" />
          <ListCard>{endingSoon.map((p, i) => <PostRow key={p.id} p={p} last={i === endingSoon.length - 1} onPress={() => onOpen(p)} />)}</ListCard>
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="sparkle" size={16} stroke={1.9} color={c.navy700} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: c.ink }}>The Buzz</Text>
        <Pressable onPress={() => setPreview(v => !v)} accessibilityRole="switch" accessibilityState={{ checked: preview }} accessibilityLabel="Preview The Buzz"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: preview ? c.navy700 : c.paper2, opacity: pressed ? 0.7 : 1 })}>
          <Icon name="play" size={12} stroke={2.2} color={preview ? '#fff' : c.ink2} />
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: preview ? '#fff' : c.ink2 }}>Preview</Text>
        </Pressable>
      </View>

      {preview && (
        <View style={[{ borderRadius: 26, padding: 12, paddingTop: 10, backgroundColor: c.paper2, gap: 8 }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', color: c.ink3 }}>On Home, right now</Text>
          <Buzz slides={slides} preview aspect={1.22} focus={focus} />
        </View>
      )}

      {list.length === 0 ? (
        <Text style={{ fontSize: 13, color: c.ink4 }}>Nothing in The Buzz right now. Make a trivia question, poll or news post under Posts.</Text>
      ) : (
        <>
          <Text style={{ fontSize: 12, color: c.ink3 }}>
            {preview ? 'Tap a slide to see it above. ' : ''}Students swipe through in this order; pinned news always leads.
          </Text>
          <ListCard>
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
          </ListCard>
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
  const list = useMemo(() => mine
    .filter(p => kind === 'all' || p.kind === kind)
    .filter(p => phase === 'all' || phaseOf(p, store.now) === phase)
    .filter(p => !q.trim() || `${titleOf(p)} ${subOf(p)}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
  [mine, kind, phase, q, store.now]);
  const count = (ph: Phase) => mine.filter(p => (kind === 'all' || p.kind === kind) && phaseOf(p, store.now) === ph).length;
  const make = () => canMake.length === 1 ? onNew(canMake[0]) : setPicking(true);

  return (
    <>
      {canMake.length > 0 ? (
        picking ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink }}>What are you making?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {canMake.map(k => (
                <Pressable key={k} onPress={() => { setPicking(false); onNew(k); }} accessibilityRole="button"
                  style={({ pressed }) => [{ width: '47%', flexGrow: 1, padding: 12, borderRadius: 18, backgroundColor: c.surface, gap: 6, opacity: pressed ? 0.7 : 1 }, shadow.sm]}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={KINDS[k].icon} size={17} stroke={1.9} color={c.navy700} />
                  </View>
                  <Text style={{ fontSize: 14.5, fontWeight: '700', color: c.ink }}>{KINDS[k].label}</Text>
                  <Text numberOfLines={2} style={{ fontSize: 12, color: c.ink3 }}>{KINDS[k].places.map(x => PLACES[x].label).join(', ')}</Text>
                </Pressable>
              ))}
            </View>
            <Act label="Cancel" tone="plain" fill onPress={() => setPicking(false)} />
          </View>
        ) : (
          <Act label={canMake.length === 1 ? `New ${KINDS[canMake[0]].noun}` : 'New post'} icon="plus" fill onPress={make} />
        )
      ) : (
        <Hint text={`You can't post this yet. Ask the ${TEAMS.maintenance.label} Manager for the job.`} />
      )}

      <Search value={q} onChange={setQ} placeholder="Search posts" />
      {kinds.length > 1 && (
        <Seg value={kind} onChange={v => setKind(v)} options={[{ id: 'all' as const, label: 'Every kind' }, ...kinds.map(k => ({ id: k, label: KINDS[k].label }))]} />
      )}
      <Seg value={phase} onChange={v => setPhase(v)} options={[
        { id: 'all' as const, label: 'All' }, { id: 'live' as const, label: 'Live', count: count('live') }, { id: 'scheduled' as const, label: 'Scheduled', count: count('scheduled') },
        { id: 'draft' as const, label: 'Drafts', count: count('draft') }, { id: 'ended' as const, label: 'Ended', count: count('ended') },
      ]} />

      {list.length === 0 ? (
        <Empty title="No posts here" sub={canMake.length ? 'Make the first one with the button above.' : undefined} />
      ) : (
        <ListCard>{list.map((p, i) => <PostRow key={p.id} p={p} last={i === list.length - 1} onPress={() => onOpen(p)} showPhase />)}</ListCard>
      )}
    </>
  );
};

// ════════════════════════════════════════════════════════════════
// Shared rows
// ════════════════════════════════════════════════════════════════
const Heading = ({ icon, text, trailing }: { icon: any; text: string; trailing?: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={16} stroke={1.9} color={c.navy700} />
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: c.ink }}>{text}</Text>
      {!!trailing && <Text style={[{ fontSize: 12.5, color: c.ink3 }, tnum]}>{trailing}</Text>}
    </View>
  );
};

const CountPill = ({ n }: { n: number }) => {
  const { c } = useTheme();
  return (
    <View style={{ minWidth: 24, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: n ? c.navy50 : c.paper2, alignItems: 'center' }}>
      <Text style={[{ fontSize: 12, fontWeight: '700', color: n ? c.navy700 : c.ink4 }, tnum]}>{n}</Text>
    </View>
  );
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
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingLeft: inset ? 58 : 14, paddingRight: order || onInfo ? 6 : 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
        {number !== undefined && <Text style={[{ width: 16, fontSize: 13, fontWeight: '700', color: c.ink4, textAlign: 'center' }, tnum]}>{number}</Text>}
        {!inset && (
          <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={KINDS[p.kind].icon} size={16} stroke={1.9} color={c.navy700} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {p.pinned && <Icon name="pin" size={12} stroke={2} color={c.gold} />}
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14.5, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{titleOf(p) || 'Untitled'}</Text>
          </View>
          <Text numberOfLines={1} style={[{ fontSize: 12, color: c.ink3, marginTop: 1 }, tnum]}>
            {[showPhase ? PHASES[phase].label : null, KINDS[p.kind].label, numbers || null, when].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {showPhase && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone }} />}
      </Pressable>
      {onInfo && (
        <Pressable onPress={onInfo} hitSlop={6} accessibilityLabel="Results and edit"
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
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={4} accessibilityLabel={dir === 'up' ? 'Move earlier' : 'Move later'}
      style={({ pressed }) => ({ width: 32, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.navy50 : c.paper2, opacity: onPress ? 1 : 0.3, transform: [{ rotate: dir === 'up' ? '180deg' : '0deg' }] })}>
      <Icon name="chev-d" size={14} stroke={2.2} color={c.ink2} />
    </Pressable>
  );
};
