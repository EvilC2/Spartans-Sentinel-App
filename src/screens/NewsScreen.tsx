// Spartans — Announcements tab. Two sections, switched at the top:
//
//   School       The main announcements: App Club news placed in
//                Announcements (src/content). A pinned post leads as a big
//                card; the rest sit in grouped lists by when they went out
//                (Today, Yesterday, This week, Earlier), filterable by
//                category. Opening one counts as a read for the admin's numbers.
//   My programs  Posts from inside each class, club and team the student is in
//                (program_posts, migration 0021: staff and program managers
//                post them on the program's page). One group per program,
//                the most recently active first, newest three posts each;
//                tapping the header opens the program. Programs with nothing
//                posted are listed at the bottom.
//
// The Buzz window (trivia, polls) lives on Home only; it is not a tab.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, Palette, G165 } from '../theme';
import { Icon, Check } from '../components/Icon';
import { TabId } from '../components/Chrome';
import { AppHeader } from '../components/AppHeader';
import { ProgramIcon, glow } from '../components/ProgramIcon';
import { useClassSheet } from '../components/ClassCard';
import { useProfile } from '../ProfileContext';
import { programsFor, Program } from '../programs';
import { useContent, PostOf } from '../content';
import { useProgramFeed, ProgramPost } from '../clubs';

type Props = { onNavigate: (t: TabId) => void; topInset: number };
type Section = 'school' | 'programs';

const CATEGORIES = ['All', 'Athletics', 'Academic', 'General', 'Events'];
const PER_PROGRAM = 3;

export default function AnnouncementsScreen({ onNavigate, topInset }: Props) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const [section, setSection] = useState<Section>('school');
  const [expanded, setExpanded] = useState<string | null>(null);

  // ── School ──
  const { inPlace, seen, opened } = useContent();
  const news = useMemo(() => inPlace('news').filter((p): p is PostOf<'news'> => p.kind === 'news').map(toCard), [inPlace]);
  useEffect(() => { seen(news.map(n => n.id)); }, [news, seen]);

  // ── My programs ──
  const programs = useMemo(() => programsFor(profile), [profile]);
  const feed = useProgramFeed(programs.map(p => p.name));
  const groups = useMemo(() => {
    const withPosts = programs
      .map(pr => ({ pr, posts: feed.postsOf(pr.name) }))
      .filter(g => g.posts.length > 0)
      .map(g => ({ ...g, latest: Math.max(...g.posts.map(p => Date.parse(p.createdAt) || 0)) }))
      .sort((a, b) => b.latest - a.latest);
    const quiet = programs.filter(pr => !feed.postsOf(pr.name).length);
    return { withPosts, quiet };
  }, [programs, feed]);
  const programCount = groups.withPosts.reduce((n, g) => n + g.posts.length, 0);

  const toggle = (id: string, school = false) => {
    if (school && expanded !== id) opened(id);
    setExpanded(expanded === id ? null : id);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <AppHeader topInset={topInset} title="Announcements" />

      {/* School / My programs */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, borderRadius: 14, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.line }}>
          {([['school', 'School', news.length], ['programs', 'My programs', programCount]] as [Section, string, number][]).map(([k, label, n]) => {
            const on = section === k;
            return (
              <Pressable
                key={k}
                onPress={() => { setSection(k); setExpanded(null); }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${label}, ${n} ${n === 1 ? 'post' : 'posts'}`}
                style={[{ flex: 1, minHeight: 40, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: on ? c.surface : 'transparent' }, on ? shadow.sm : shadow.none]}
              >
                <Text style={{ fontSize: 14.5, fontWeight: on ? '700' : '500', color: on ? c.ink : c.ink3 }}>{label}</Text>
                {n > 0 && (
                  <View style={{ minWidth: 20, paddingHorizontal: 6, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.navy50 : 'transparent' }}>
                    <Text style={[{ fontSize: 11.5, fontWeight: '700', color: on ? c.navy700 : c.ink4 }, tnum]}>{n}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {section === 'school'
        ? <SchoolSection news={news} expanded={expanded} onToggle={id => toggle(id, true)} />
        : <ProgramsSection groups={groups} hasPrograms={programs.length > 0} loading={feed.loading} expanded={expanded} onToggle={id => toggle(id)} onNavigate={onNavigate} />}
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────────
// School: the main announcements
// ────────────────────────────────────────────────────────────────
const SchoolSection = ({ news, expanded, onToggle }: { news: Card[]; expanded: string | null; onToggle: (id: string) => void }) => {
  const { c } = useTheme();
  const [filter, setFilter] = useState('All');
  const pinned = news.find(n => n.pinned);
  const inFilter = (n: Card) => filter === 'All' || n.category === filter;
  const rest = news.filter(n => n !== pinned && inFilter(n));
  const showPinned = !!pinned && inFilter(pinned);
  const buckets = groupByTime(rest);

  if (!news.length) {
    return <Empty icon="news" title="No announcements yet" sub="School news from the App Club shows up here." />;
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14 }}>
        {CATEGORIES.map(f => <FilterChip key={f} label={f} active={f === filter} onPress={() => setFilter(f)} />)}
      </ScrollView>

      {showPinned && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 18 }}>
          <PinnedCard n={pinned!} expanded={expanded === pinned!.id} onToggle={() => onToggle(pinned!.id)} />
        </View>
      )}

      {!rest.length && !showPinned && (
        <Text style={{ paddingHorizontal: 20, paddingTop: 4, fontSize: 13.5, color: c.ink3 }}>Nothing in {filter} right now.</Text>
      )}

      {buckets.map(g => (
        <View key={g.label} style={{ paddingBottom: 18 }}>
          <SectionLabel>{g.label}</SectionLabel>
          <Group>
            {g.items.map((n, i) => (
              <SchoolRow key={n.id} n={n} first={i === 0} expanded={expanded === n.id} onToggle={() => onToggle(n.id)} />
            ))}
          </Group>
        </View>
      ))}
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// My programs: one group per program
// ────────────────────────────────────────────────────────────────
type ProgramGroups = { withPosts: { pr: Program; posts: ProgramPost[]; latest: number }[]; quiet: Program[] };

const ProgramsSection = ({ groups, hasPrograms, loading, expanded, onToggle, onNavigate }: {
  groups: ProgramGroups; hasPrograms: boolean; loading: boolean; expanded: string | null;
  onToggle: (id: string) => void; onNavigate: (t: TabId) => void;
}) => {
  const { c } = useTheme();
  const sheet = useClassSheet();
  const open = (pr: Program) => sheet.open({ name: pr.name, teacher: pr.teacher, room: pr.room, slot: pr.slots[0], kind: pr.kind === 'class' ? 'course' : 'extra' });

  if (!hasPrograms) {
    return (
      <Empty icon="grid" title="No programs yet" sub="Add your classes, clubs and teams, and their announcements gather here."
        action={{ label: 'Go to Programs', onPress: () => onNavigate('programs') }} />
    );
  }

  return (
    <View style={{ paddingTop: 14 }}>
      {!groups.withPosts.length && (
        loading
          ? <Text style={{ paddingHorizontal: 20, paddingVertical: 12, fontSize: 13.5, color: c.ink3 }}>Loading your programs…</Text>
          : <Empty icon="news" title="Nothing from your programs yet" sub="When a teacher or club lead posts in one of your programs, it shows up here." />
      )}

      {groups.withPosts.map(({ pr, posts }) => {
        const shown = posts.slice(0, PER_PROGRAM);
        return (
          <View key={pr.id} style={{ paddingBottom: 20 }}>
            <ProgramHeader pr={pr} count={posts.length} onPress={() => open(pr)} />
            <Group tint={pr.color}>
              {shown.map((p, i) => (
                <ProgramRow key={p.id} p={p} first={i === 0} expanded={expanded === p.id} onToggle={() => onToggle(p.id)} />
              ))}
              {posts.length > PER_PROGRAM && (
                <Pressable onPress={() => open(pr)} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.link }}>See all {posts.length} in {pr.name}</Text>
                  <Icon name="chev-r" size={13} stroke={2} color={c.link} />
                </Pressable>
              )}
            </Group>
          </View>
        );
      })}

      {groups.withPosts.length > 0 && groups.quiet.length > 0 && (
        <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
          <Text style={{ fontSize: 13, color: c.ink3, marginBottom: 8 }}>Nothing posted yet in</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {groups.quiet.map(pr => (
              <Pressable key={pr.id} onPress={() => open(pr)} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, opacity: pressed ? 0.6 : 1 })}>
                <Text style={{ fontSize: 13, color: c.ink2 }}>{pr.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const ProgramHeader = ({ pr, count, onPress }: { pr: Program; count: number; onPress: () => void }) => {
  const { c, mode } = useTheme();
  const sub = [pr.kind === 'class' ? pr.slots.join(' ') : null, pr.teacher].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${pr.name}, ${count} ${count === 1 ? 'post' : 'posts'}. Open`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 8, opacity: pressed ? 0.6 : 1 })}>
      <ProgramIcon name={pr.name} kind={pr.kind} color={pr.color} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: 19, lineHeight: 23, letterSpacing: -0.3, color: c.ink }}>{pr.name}</Text>
        {!!sub && <Text numberOfLines={1} style={[{ fontSize: 12.5, color: glow(pr.color, mode), fontWeight: '600', marginTop: 1 }, tnum]}>{sub}</Text>}
      </View>
      <Text style={{ fontSize: 13, fontWeight: '600', color: c.link }}>Open</Text>
      <Icon name="chev-r" size={12} stroke={2} color={c.link} />
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Rows
// ────────────────────────────────────────────────────────────────
const SchoolRow = ({ n, first, expanded, onToggle }: { n: Card; first: boolean; expanded: boolean; onToggle: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${n.category}. ${n.title}. ${n.time}`}
      style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: pressed ? c.paper2 : 'transparent' })}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: catColor(n.category, c) }} />
            <Text style={{ fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: catColor(n.category, c) }}>{n.category}</Text>
            <Text style={{ fontSize: 12, color: c.ink4 }}>· {n.time}</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', lineHeight: 21, letterSpacing: -0.2, color: c.ink }}>{n.title}</Text>
          {!expanded && !!n.preview && <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 20, color: c.ink3, marginTop: 3 }}>{n.preview}</Text>}
        </View>
        {!expanded && !!n.image && <Image source={{ uri: n.image }} style={{ width: 64, height: 64, borderRadius: 12 }} resizeMode="cover" accessibilityIgnoresInvertColors />}
      </View>
      {expanded && (
        <View style={{ marginTop: 8 }}>
          {!!n.image && <Image source={{ uri: n.image }} style={{ width: '100%', height: 170, borderRadius: 14, marginBottom: 10 }} resizeMode="cover" accessibilityIgnoresInvertColors />}
          <Text selectable style={{ fontSize: 15, lineHeight: 22, color: c.ink2 }}>{n.body}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <AuthorMark name={n.author} role={n.role} admin={n.admin} />
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 12, color: c.ink4 }}>{n.timeFull}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
};

const ProgramRow = ({ p, first, expanded, onToggle }: { p: ProgramPost; first: boolean; expanded: boolean; onToggle: () => void }) => {
  const { c } = useTheme();
  const { time, full } = timeOf(Date.parse(p.createdAt));
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${p.pinned ? 'Pinned. ' : ''}${p.title}. ${time}`}
      style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: pressed ? c.paper2 : 'transparent' })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        {p.pinned && <Icon name="pin" size={11} stroke={2.2} color={c.gold} />}
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, fontWeight: '600', color: c.ink3 }}>{p.authorName || 'Program lead'}</Text>
        <Text style={{ fontSize: 12, color: c.ink4 }}>· {time}</Text>
      </View>
      <Text style={{ fontSize: 16, fontWeight: '600', lineHeight: 21, letterSpacing: -0.2, color: c.ink }}>{p.title}</Text>
      {!!p.body && (
        <Text selectable={expanded} numberOfLines={expanded ? undefined : 2} style={{ fontSize: expanded ? 15 : 14, lineHeight: expanded ? 22 : 20, color: expanded ? c.ink2 : c.ink3, marginTop: 3 }}>{p.body}</Text>
      )}
      {expanded && <Text style={{ fontSize: 12, color: c.ink4, marginTop: 10 }}>{full}</Text>}
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Pinned school post: the lead card, in the Home card's navy
// ────────────────────────────────────────────────────────────────
const PinnedCard = ({ n, expanded, onToggle }: { n: Card; expanded: boolean; onToggle: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`Pinned. ${n.title}`}>
      <LinearGradient colors={[c.navy700, c.navy900]} start={G165.start} end={G165.end} style={[{ borderRadius: 22, overflow: 'hidden' }, shadow.md]}>
        {!!n.image && <Image source={{ uri: n.image }} style={{ width: '100%', height: 170 }} resizeMode="cover" accessibilityIgnoresInvertColors />}
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="pin" size={12} stroke={2.2} color="#E8D8AE" />
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: '#E8D8AE' }}>Pinned · {n.category}</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{n.time}</Text>
          </View>
          <Text style={{ fontFamily: fonts.serif, fontSize: 25, lineHeight: 30, letterSpacing: -0.5, color: '#fff', marginTop: 8 }}>{n.title}</Text>
          <Text selectable={expanded} numberOfLines={expanded ? undefined : 3} style={{ fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>
            {expanded ? n.body : n.preview}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.18)' }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}>
              {n.author}{n.role ? <Text style={{ fontWeight: '400', color: 'rgba(255,255,255,0.5)' }}>{`  ${n.role}`}</Text> : null}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#E8D8AE' }}>{expanded ? 'Show less' : 'Read more'}</Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────
const SectionLabel = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <Text accessibilityRole="header" style={{ paddingHorizontal: 22, paddingBottom: 8, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: c.ink3 }}>
      {children}
    </Text>
  );
};

// A rounded group of rows. `tint`: a program's colour as a thin rail.
const Group = ({ children, tint }: { children: React.ReactNode; tint?: string }) => {
  const { c, mode } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={[{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, shadow.sm]}>
        {!!tint && <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: glow(tint, mode) }} />}
        {children}
      </View>
    </View>
  );
};

const Empty = ({ icon, title, sub, action }: { icon: 'news' | 'grid'; title: string; sub: string; action?: { label: string; onPress: () => void } }) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed', padding: 24, alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={22} stroke={1.8} color={c.ink4} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink2, textAlign: 'center' }}>{title}</Text>
        <Text style={{ fontSize: 13.5, lineHeight: 19, color: c.ink3, textAlign: 'center' }}>{sub}</Text>
        {action && (
          <Pressable onPress={action.onPress} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 8, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: c.action, opacity: pressed ? 0.8 : 1 })}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
};

const FilterChip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: active ? c.navy700 : c.surface, borderWidth: 1, borderColor: active ? c.navy700 : c.line }, active ? shadow.sm : shadow.none]}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', letterSpacing: -0.1, color: active ? '#fff' : c.ink2 }}>{label}</Text>
    </Pressable>
  );
};

// ── Time ────────────────────────────────────────────────────────
// "7:48 AM" today, "Yesterday", a weekday this week, else the date.
const dayDiff = (at: number) => {
  const d = new Date(at);
  const now = new Date();
  return Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
};
const timeOf = (at: number) => {
  const d = new Date(at);
  const days = dayDiff(at);
  const clock = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const time = days <= 0 ? clock : days === 1 ? 'Yesterday' : days < 7 ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const full = `${days <= 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${clock}`;
  return { time, full };
};

// A news post in the shape the rows draw.
type Card = { id: string; pinned: boolean; admin: boolean; category: string; title: string; preview: string; body: string; author: string; role?: string; time: string; timeFull: string; at: number; image?: string | null };
const toCard = (p: PostOf<'news'>): Card => {
  const at = Date.parse(p.startsAt || p.createdAt);
  const { time, full } = timeOf(at);
  const body = p.data.body.trim();
  return {
    id: p.id, pinned: p.pinned, admin: true, category: p.data.category, title: p.data.title,
    preview: body.split(/\n+/)[0].slice(0, 220), body, author: p.data.author, role: p.data.role, image: p.data.image,
    time, timeFull: full, at,
  };
};

// Today / Yesterday / This week / Earlier, newest first inside each.
const groupByTime = (items: Card[]) => {
  const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
  const out: Record<string, Card[]> = {};
  for (const n of [...items].sort((a, b) => b.at - a.at)) {
    const d = dayDiff(n.at);
    const k = d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? 'This week' : 'Earlier';
    (out[k] ||= []).push(n);
  }
  return order.filter(k => out[k]?.length).map(label => ({ label, items: out[label] }));
};

// ── Category colours ────────────────────────────────────────────
const catColor = (k: string, c: Palette) =>
  ({ Athletics: c.crimson, Academic: c.sky600, General: c.ink3, Events: c.moss } as Record<string, string>)[k] || c.ink3;

const catTint = (k: string, c: Palette) =>
  ({ Athletics: c.crimsonTint, Academic: c.skyTint, General: c.paper2, Events: 'rgba(91,122,78,0.10)' } as Record<string, string>)[k] || c.paper2;

// Used by the post editor's preview too.
export const CategoryTag = ({ category }: { category: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ backgroundColor: catTint(category, c), paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4 }}>
      <Text style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '700', color: catColor(category, c), lineHeight: 14.7 }}>
        {category}
      </Text>
    </View>
  );
};

// Initials puck + name + admin check.
export const AuthorMark = ({ name, role, admin, compact }: { name: string; role?: string; admin?: boolean; compact?: boolean }) => {
  const { c } = useTheme();
  const initials = (name || '').split(/\s+/).map(w => w[0]).slice(0, 2).join('');
  const d = compact ? 22 : 28;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: compact ? 9.5 : 10.5, fontWeight: '700', color: c.ink2, letterSpacing: 0.3 }}>{initials}</Text>
      </View>
      <View style={{ flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text numberOfLines={1} style={{ fontSize: compact ? 12.5 : 13, fontWeight: '600', color: c.ink2, letterSpacing: -0.1, maxWidth: 160 }}>{name}</Text>
          {admin && <AdminBadge />}
        </View>
        {!compact && !!role && <Text style={{ fontSize: 11.5, color: c.ink4, marginTop: 1 }}>{role}</Text>}
      </View>
    </View>
  );
};

export const AdminBadge = () => {
  const { c } = useTheme();
  return (
    <View style={{ width: 13, height: 13, borderRadius: 6.5, backgroundColor: c.navy700, alignItems: 'center', justifyContent: 'center' }}>
      <Check size={8} color="#fff" width={3.5} />
    </View>
  );
};
