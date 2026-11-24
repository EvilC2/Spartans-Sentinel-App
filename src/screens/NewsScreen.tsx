// Spartans — Announcements tab. One page, no tabs:
//
//   School         The main announcements: App Club news placed in
//                  Announcements (src/content). A pinned post leads as a big
//                  card, then one card per post, newest first.
//   Your programs  Posts from inside each class, club and team the student is
//                  in (program_posts, migration 0021). One group per program,
//                  the most recently active first, newest three posts each;
//                  the header opens the program.
//
// The chips at the top jump to one part: All, School, or a single program.
// Every post is its own card with room around it. Tapping one opens it in a
// reading sheet (photo, big title, full text) so nothing unfolds in a crowded
// list. Opening a school post counts as a read for the admin's numbers.
//
// The Buzz window (trivia, polls) lives on Home only; it is not a tab.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, Palette, G165 } from '../theme';
import { Icon, Check } from '../components/Icon';
import { BottomSheet, SheetScroll } from '../components/BottomSheet';
import { TabId } from '../components/Chrome';
import { AppHeader } from '../components/AppHeader';
import { ProgramIcon, glow } from '../components/ProgramIcon';
import { useClassSheet } from '../components/ClassCard';
import { useProfile } from '../ProfileContext';
import { programsFor, Program } from '../programs';
import { useContent, PostOf } from '../content';
import { useProgramFeed, ProgramPost } from '../clubs';
import { useFocus } from '../nav';

type Props = { onNavigate: (t: TabId) => void; topInset: number };

const ALL = 'all';
const SCHOOL = 'school';
const PER_PROGRAM = 3;

// What the reading sheet shows, from either kind of post.
type Reading = {
  eyebrow: string; tone: string; title: string; body: string; image?: string | null;
  author: string; role?: string; admin?: boolean; when: string;
};

export default function AnnouncementsScreen({ onNavigate, topInset }: Props) {
  const { c, mode } = useTheme();
  const { profile } = useProfile();
  const sheet = useClassSheet();
  const [show, setShow] = useState<string>(ALL);
  const [reading, setReading] = useState<Reading | null>(null);

  // ── School ──
  const { inPlace, seen, opened } = useContent();
  const news = useMemo(() => inPlace('news').filter((p): p is PostOf<'news'> => p.kind === 'news').map(toCard).sort((a, b) => b.at - a.at), [inPlace]);
  useEffect(() => { seen(news.map(n => n.id)); }, [news, seen]);
  const pinned = news.find(n => n.pinned);
  const rest = news.filter(n => n !== pinned);

  // ── Your programs ──
  const programs = useMemo(() => programsFor(profile), [profile]);
  const feed = useProgramFeed(programs.map(p => p.name));
  const groups = programs
    .map(pr => ({ pr, posts: feed.postsOf(pr.name) }))
    .filter(g => g.posts.length > 0)
    .map(g => ({ ...g, latest: Math.max(...g.posts.map(p => Date.parse(p.createdAt) || 0)) }))
    .sort((a, b) => b.latest - a.latest);

  const openProgram = (pr: Program) => sheet.open({ name: pr.name, teacher: pr.teacher, room: pr.room, slot: pr.slots[0], kind: pr.kind === 'class' ? 'course' : 'extra' });
  const readNews = (n: Card) => {
    opened(n.id);
    setReading({ eyebrow: n.category, tone: catColor(n.category, c), title: n.title, body: n.body, image: n.image, author: n.author, role: n.role, admin: n.admin, when: n.timeFull });
  };
  // From a notification: straight into that post.
  useFocus('news', f => {
    const n = news.find(x => x.id === f.id);
    if (!n) return false;
    setShow(ALL);
    readNews(n);
    return true;
  }, [news]);
  const readPost = (pr: Program, p: ProgramPost) =>
    setReading({ eyebrow: pr.name, tone: glow(pr.color, mode), title: p.title, body: p.body, author: p.authorName || 'Program lead', when: timeOf(Date.parse(p.createdAt)).full });

  const showSchool = show === ALL || show === SCHOOL;
  const shownGroups = show === ALL ? groups : groups.filter(g => g.pr.id === show);
  // A chip for a program that has since gone quiet falls back to All.
  useEffect(() => { if (show !== ALL && show !== SCHOOL && !groups.some(g => g.pr.id === show)) setShow(ALL); }, [show, groups]);
  const nothing = !news.length && !groups.length;

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <AppHeader topInset={topInset} title="Announcements" />

        {!nothing && groups.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2 }}>
            <FilterChip label="All" active={show === ALL} onPress={() => setShow(ALL)} />
            {news.length > 0 && <FilterChip label="School" active={show === SCHOOL} onPress={() => setShow(SCHOOL)} />}
            {groups.map(g => <FilterChip key={g.pr.id} label={g.pr.name} dot={glow(g.pr.color, mode)} active={show === g.pr.id} onPress={() => setShow(g.pr.id)} />)}
          </ScrollView>
        )}

        {nothing && (
          feed.loading
            ? <Text style={{ paddingHorizontal: 20, paddingTop: 24, fontSize: 14, color: c.ink3 }}>Loading…</Text>
            : <Empty title="No announcements yet" sub="School news, and posts from your classes, clubs and teams, show up here."
                action={programs.length ? undefined : { label: 'Add your programs', onPress: () => onNavigate('programs') }} />
        )}

        {/* ── School ── */}
        {showSchool && news.length > 0 && (
          <View style={{ paddingTop: 22 }}>
            <SectionTitle title="School" sub="For everyone at Sentinel" />
            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              {!!pinned && <PinnedCard n={pinned} onPress={() => readNews(pinned)} />}
              {rest.map(n => <NewsCard key={n.id} n={n} onPress={() => readNews(n)} />)}
            </View>
          </View>
        )}

        {/* ── Your programs ── */}
        {shownGroups.length > 0 && (
          <View style={{ paddingTop: showSchool && news.length ? 34 : 22 }}>
            {show === ALL && <SectionTitle title="Your programs" sub="From your classes, clubs and teams" />}
            <View style={{ gap: 26 }}>
              {shownGroups.map(({ pr, posts }) => {
                const list = show === ALL ? posts.slice(0, PER_PROGRAM) : posts;
                return (
                  <View key={pr.id}>
                    <ProgramHeader pr={pr} count={posts.length} onPress={() => openProgram(pr)} />
                    <View style={{ paddingHorizontal: 20, gap: 12 }}>
                      {list.map(p => <ProgramCard key={p.id} p={p} tone={glow(pr.color, mode)} onPress={() => readPost(pr, p)} />)}
                      {posts.length > list.length && (
                        <Pressable onPress={() => setShow(pr.id)} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, borderWidth: 1, borderColor: c.line, opacity: pressed ? 0.6 : 1 })}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: c.link }}>Show all {posts.length} from {pr.name}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <Reader post={reading} onClose={() => setReading(null)} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// Headers
// ────────────────────────────────────────────────────────────────
const SectionTitle = ({ title, sub }: { title: string; sub: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 14 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 28, lineHeight: 33, letterSpacing: -0.6, color: c.ink }}>{title}</Text>
      <Text style={{ fontSize: 13.5, color: c.ink3, marginTop: 2 }}>{sub}</Text>
    </View>
  );
};

const ProgramHeader = ({ pr, count, onPress }: { pr: Program; count: number; onPress: () => void }) => {
  const { c, mode } = useTheme();
  const sub = [pr.kind === 'class' ? pr.slots.join(' ') : null, pr.teacher].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${pr.name}, ${count} ${count === 1 ? 'post' : 'posts'}. Open`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 10, opacity: pressed ? 0.6 : 1 })}>
      <ProgramIcon name={pr.name} kind={pr.kind} color={pr.color} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '700', letterSpacing: -0.3, color: c.ink }}>{pr.name}</Text>
        {!!sub && <Text numberOfLines={1} style={[{ fontSize: 12.5, color: glow(pr.color, mode), fontWeight: '600', marginTop: 1 }, tnum]}>{sub}</Text>}
      </View>
      <Icon name="chev-r" size={14} stroke={2} color={c.ink3} />
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Cards: one per post
// ────────────────────────────────────────────────────────────────
const NewsCard = ({ n, onPress }: { n: Card; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n.category}. ${n.title}. ${n.time}`}
      style={({ pressed }) => [{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.line, overflow: 'hidden', opacity: pressed ? 0.85 : 1 }, shadow.sm]}
    >
      {!!n.image && <Image source={{ uri: n.image }} style={{ width: '100%', height: 150 }} resizeMode="cover" accessibilityIgnoresInvertColors />}
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: catColor(n.category, c) }} />
          <Text style={{ fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: catColor(n.category, c) }}>{n.category}</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 12.5, color: c.ink4 }}>{n.time}</Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', lineHeight: 23, letterSpacing: -0.3, color: c.ink }}>{n.title}</Text>
        {!!n.preview && <Text numberOfLines={2} style={{ fontSize: 14.5, lineHeight: 21, color: c.ink3, marginTop: 5 }}>{n.preview}</Text>}
        <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '600', color: c.ink3, marginTop: 10 }}>{n.author}</Text>
      </View>
    </Pressable>
  );
};

const ProgramCard = ({ p, tone, onPress }: { p: ProgramPost; tone: string; onPress: () => void }) => {
  const { c } = useTheme();
  const { time } = timeOf(Date.parse(p.createdAt));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${p.pinned ? 'Pinned. ' : ''}${p.title}. ${time}`}
      style={({ pressed }) => [{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, overflow: 'hidden', opacity: pressed ? 0.85 : 1 }, shadow.sm]}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: tone }} />
      <View style={{ paddingVertical: 14, paddingLeft: 18, paddingRight: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          {p.pinned && <Icon name="pin" size={11} stroke={2.2} color={c.gold} />}
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, fontWeight: '600', color: c.ink3 }}>{p.authorName || 'Program lead'}</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 12.5, color: c.ink4 }}>{time}</Text>
        </View>
        <Text style={{ fontSize: 17, fontWeight: '700', lineHeight: 22, letterSpacing: -0.3, color: c.ink }}>{p.title}</Text>
        {!!p.body && <Text numberOfLines={2} style={{ fontSize: 14.5, lineHeight: 21, color: c.ink3, marginTop: 4 }}>{p.body}</Text>}
      </View>
    </Pressable>
  );
};

// Pinned school post: the lead card, in the Home card's navy.
const PinnedCard = ({ n, onPress }: { n: Card; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Pinned. ${n.title}`} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <LinearGradient colors={[c.navy700, c.navy900]} start={G165.start} end={G165.end} style={[{ borderRadius: 22, overflow: 'hidden' }, shadow.md]}>
        {!!n.image && <Image source={{ uri: n.image }} style={{ width: '100%', height: 180 }} resizeMode="cover" accessibilityIgnoresInvertColors />}
        <View style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="pin" size={12} stroke={2.2} color="#E8D8AE" />
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: '#E8D8AE' }}>Pinned · {n.category}</Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>{n.time}</Text>
          </View>
          <Text style={{ fontFamily: fonts.serif, fontSize: 26, lineHeight: 31, letterSpacing: -0.5, color: '#fff', marginTop: 8 }}>{n.title}</Text>
          <Text numberOfLines={3} style={{ fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.8)', marginTop: 8 }}>{n.preview}</Text>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginTop: 14 }}>{n.author}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Reading sheet: one post, with room
// ────────────────────────────────────────────────────────────────
const Reader = ({ post, onClose }: { post: Reading | null; onClose: () => void }) => {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  // Keep the last post while the sheet slides away.
  const [last, setLast] = useState<Reading | null>(post);
  useEffect(() => { if (post) setLast(post); }, [post]);
  const p = post || last;
  return (
    <BottomSheet visible={!!post} onClose={onClose} dim={0.4} style={[{ height: Math.round(height * 0.9), backgroundColor: c.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }, shadow.lg]}>
        {!!p && (
          <SheetScroll contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            {p.image
              ? <Image source={{ uri: p.image }} style={{ width: '100%', height: 240 }} resizeMode="cover" accessibilityIgnoresInvertColors />
              : <View style={{ height: 56 }} />}
            <View style={{ paddingHorizontal: 24, paddingTop: 22 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.tone }} />
                <Text style={{ fontSize: 12.5, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: p.tone }}>{p.eyebrow}</Text>
              </View>
              <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 32, lineHeight: 38, letterSpacing: -0.7, color: c.ink, marginTop: 10 }}>{p.title}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }}>
                <AuthorMark name={p.author} role={p.role} admin={p.admin} />
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: 12.5, color: c.ink4 }}>{p.when}</Text>
              </View>
              <Text selectable style={{ fontSize: 17.5, lineHeight: 28, color: c.ink2, marginTop: 20 }}>{p.body || 'No more details.'}</Text>
            </View>
          </SheetScroll>
        )}
        {/* Grabber: says the sheet can be pulled down. */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 9, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: p?.image ? 'rgba(255,255,255,0.75)' : c.line }} />
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"
          style={({ pressed }) => ({ position: 'absolute', top: 14, right: 16, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: p?.image ? 'rgba(14,34,56,0.55)' : c.paper2, opacity: pressed ? 0.7 : 1 })}>
          <Icon name="close" size={16} stroke={2.4} color={p?.image ? '#fff' : c.ink2} />
        </Pressable>
    </BottomSheet>
  );
};

// ────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────
const Empty = ({ title, sub, action }: { title: string; sub: string; action?: { label: string; onPress: () => void } }) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
      <View style={{ borderRadius: 22, borderWidth: 1, borderColor: c.line, borderStyle: 'dashed', padding: 26, alignItems: 'center', gap: 6 }}>
        <Icon name="news" size={22} stroke={1.8} color={c.ink4} />
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

const FilterChip = ({ label, active, dot, onPress }: { label: string; active: boolean; dot?: string; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: active ? c.navy700 : c.surface, borderWidth: 1, borderColor: active ? c.navy700 : c.line }, active ? shadow.sm : shadow.none]}
    >
      {!!dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: active ? '#fff' : dot }} />}
      <Text style={{ fontSize: 13.5, fontWeight: '600', letterSpacing: -0.1, color: active ? '#fff' : c.ink2 }}>{label}</Text>
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
