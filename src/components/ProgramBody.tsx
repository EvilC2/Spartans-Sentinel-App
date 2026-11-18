// Spartans — what a program shows when it is opened on the Programs tab.
// The row itself (icon, name, blocks) stays on top; this is everything under it:
//   Next class    when you have it next, and the room on the map
//   Tabs          Homework · Grades · Announcements · About for real courses
//                 (classes, outside timetable, online). The tab labels carry the
//                 live numbers (open homework, current mark, posts) so they read
//                 as one place.
//   Homework      the same rows as the Homework page (src/components/HomeworkList)
//   Grades        Term 1 / Term 2 / Final, big current mark on top
//   Announcements the program's own posts first (pinned, then newest), from
//                 staff and the people who run it (src/clubs.ts, migration
//                 0021); they also get a small composer on top and can pin or
//                 delete their posts. Then App Club posts that mention it. Tap
//                 one of those to read it all, which counts as reading it for
//                 XP, same as the Announcements tab.
//   About         a club's blurb, when it meets, room and sponsor (staff keep
//                 these in App Club → Clubs & programs), course-book text as
//                 headings and bullets, school events
// Clubs, teams and ensembles have no coursework: Announcements · About only.

import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, Alert, Platform, ScrollView, Image } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, tnum } from '../theme';
import { Icon } from './Icon';
import * as Clipboard from 'expo-clipboard';
import { nextOccurrence, useClassSheet } from './ClassCard';
import { ClassHomework, splitDone, HomeworkTone, Section as HomeworkSection, useHomeworkSections } from './HomeworkList';
import { glow, onGlow } from './ProgramIcon';
import { useProfile } from '../ProfileContext';
import { useHomework, useGrades, TERMS, Term, termAverage } from '../stores';
import { useNow, resolveNow } from '../useToday';
import { usePreviewTime } from '../PreviewTime';
import { useNav } from '../nav';
import { findTarget } from '../map/data';
import { courseInfo } from '../descriptions';
import { fmt12 } from '../bell';
import { toISO, fromISO, MONTH_NAMES } from '../calendar';
import { Program, programHomework, programNews, programSchoolEvents, hasCoursework } from '../programs';
import { useContent, PostOf } from '../content';
import { tagColor } from './Cards';
import { ask } from '../confirm';
import { Club, ProgramPost as OwnPost, clubFor, useCanPost, useClubs, useProgramPosts } from '../clubs';
import type { TabId } from './Chrome';

const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
type Tab = 'homework' | 'grades' | 'announcements' | 'about';

// onFadeEnd: how far down (in this view) the card's colour fade should run: the
// top of the tabs.
export const ProgramBody = ({ pr: raw, onNavigate, onEditTimetable, onFadeEnd }: { pr: Program; onNavigate: (t: TabId) => void; onEditTimetable?: () => void; onFadeEnd?: (y: number) => void }) => {
  const { c, mode } = useTheme();
  // Everything below draws in the program colour, brightened on the dark theme.
  const pr = { ...raw, color: glow(raw.color, mode) };
  const on = onGlow(mode);
  const { profile, save } = useProfile();
  const todayIso = toISO(useNow());
  const hw = useHomework();
  const { gradesFor } = useGrades();
  const coursework = hasCoursework(pr);
  const { inPlace } = useContent();
  const posts = useMemo(() => inPlace('news').filter((p): p is PostOf<'news'> => p.kind === 'news')
    .map(p => ({ ...p.data, id: p.id, at: Date.parse(p.startsAt || p.createdAt) })), [inPlace]);
  const news = programNews(pr, posts);
  const own = useProgramPosts(raw.name);
  const canPost = useCanPost(raw.name);
  const club = clubFor(useClubs().clubs, raw.name);
  const postCount = own.posts.length + news.length;
  const [tab, setTab] = useState<Tab>(coursework ? 'homework' : postCount || canPost ? 'announcements' : 'about');
  // Four tabs don't fit a phone: the row scrolls, and follows the one you pick.
  const tabRow = useRef<ScrollView>(null);
  const pick = (t: Tab) => {
    setTab(t);
    if (t === 'homework' || t === 'grades') tabRow.current?.scrollTo({ x: 0, animated: true });
    else tabRow.current?.scrollToEnd({ animated: true });
  };

  const homework = programHomework(pr, hw.items);
  const open = homework.filter(h => !h.done);
  const mark = currentMark(gradesFor(pr.name));

  const remove = () => {
    if (!profile) return;
    const doIt = async () => {
      const next = { ...profile, extraCourses: profile.extraCourses.filter(x => x.name.trim().toLowerCase() !== pr.name.toLowerCase()) };
      try { await save(next); } catch {}
    };
    // RN-web has no Alert; confirm() keeps the web preview honest.
    if (Platform.OS === 'web') { if ((globalThis as any).confirm?.(`Remove ${pr.name} from your programs?`)) doIt(); return; }
    Alert.alert(`Remove ${pr.name}?`, 'It comes off your Programs list. You can add it back any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doIt },
    ]);
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
      <NextClass pr={pr} />

      <View onLayout={e => onFadeEnd?.(e.nativeEvent.layout.y)} style={{ marginTop: 16, borderBottomWidth: 1, borderBottomColor: c.line2 }}>
        <ScrollView ref={tabRow} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }} style={{ marginBottom: -1 }}>
          {coursework && (
            <TabBtn label="Homework" on={tab === 'homework'} color={pr.color} onPress={() => pick('homework')}
              badge={open.length ? <CountDot n={open.length} color={pr.color} ink={on} /> : undefined}
            />
          )}
          {coursework && (
            <TabBtn label="Grades" on={tab === 'grades'} color={pr.color} onPress={() => pick('grades')}
              badge={mark ? <Text style={[{ fontSize: 14, fontWeight: '800', color: pr.color }, tnum]}>{mark.value}%</Text> : undefined}
            />
          )}
          <TabBtn label="Announcements" on={tab === 'announcements'} color={pr.color} onPress={() => pick('announcements')}
            badge={postCount ? <CountDot n={postCount} color={pr.color} ink={on} /> : undefined}
          />
          <TabBtn label="About" on={tab === 'about'} color={pr.color} onPress={() => pick('about')} />
        </ScrollView>
      </View>

      {coursework && tab === 'homework' && <HomeworkTab pr={pr} todayIso={todayIso} onNavigate={onNavigate} />}

      {coursework && tab === 'grades' && <Grades pr={pr} />}

      {tab === 'announcements' && <Announcements pr={pr} news={news} own={own} canPost={canPost} onNavigate={onNavigate} />}

      {tab === 'about' && <About pr={pr} club={club} todayIso={todayIso} onNavigate={onNavigate} />}

      {(pr.kind === 'class' && onEditTimetable) || pr.removable ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 18 }}>
          {pr.kind === 'class' && onEditTimetable && (
            <Pressable onPress={onEditTimetable} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.ink3 }}>Edit timetable</Text>
            </Pressable>
          )}
          {pr.removable && (
            <Pressable onPress={remove} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.danger }}>Remove from my programs</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
};

// ── Next class ──────────────────────────────────────────────────
// "Tomorrow  10:00 – 11:20 AM" with the day bold and the time in the class
// colour, and the map as a plain link (no chip).
const NextClass = ({ pr }: { pr: Program }) => {
  const { c } = useTheme();
  const { offsetMs } = usePreviewTime();
  const nav = useNav();
  const sheet = useClassSheet();   // when shown in the class card, leave it for the map
  const slot = pr.slots[0];
  const next = slot ? nextOccurrence(slot, resolveNow(new Date(), offsetMs)) : null;
  const onMap = pr.room ? findTarget(pr.room) : null;
  if (!next && !onMap) return null;
  const day = next ? (next.today ? 'Today' : next.tomorrow ? 'Tomorrow' : `${DOW3[next.date.getDay()]} ${MONTH_NAMES[next.date.getMonth()].slice(0, 3)} ${next.date.getDate()}`) : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
      {next ? (
        <View style={{ flexShrink: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: c.ink3 }}>Next class</Text>
          <Text style={{ marginTop: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: next.today ? pr.color : c.ink, letterSpacing: -0.4 }}>{day}</Text>
            <Text style={[{ fontSize: 15, fontWeight: '600', color: c.ink2 }, tnum]}>{`   ${fmt12(next.start)} – ${fmt12(next.end, true)}`}</Text>
          </Text>
        </View>
      ) : <View />}
      {!!onMap && (
        <Pressable onPress={() => { sheet.close(); nav.openMap({ to: onMap.id }); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Show on map" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: 2, opacity: pressed ? 0.6 : 1 })}>
          <Icon name="compass" size={16} stroke={2} color={c.link} />
          <Text style={{ fontSize: 14, fontWeight: '700', color: c.link }}>Map</Text>
        </Pressable>
      )}
    </View>
  );
};

const TabBtn = ({ label, on, color, badge, onPress }: { label: string; on: boolean; color: string; badge?: React.ReactNode; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={({ pressed }) => ({ paddingBottom: 9, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 22 }}>
        <Text style={{ fontSize: 14.5, fontWeight: on ? '700' : '500', color: on ? c.ink : c.ink3, letterSpacing: -0.3 }}>{label}</Text>
        {badge}
      </View>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, borderRadius: 2, backgroundColor: on ? color : 'transparent' }} />
    </Pressable>
  );
};

// ── Homework ────────────────────────────────────────────────────
// The Homework page's rows on a slightly darker panel, with the page's fills
// swapped so the opened row and its controls still stand out from it.
const HomeworkTab = ({ pr, todayIso, onNavigate }: { pr: Program; todayIso: string; onNavigate: (t: TabId) => void }) => {
  const { c } = useTheme();
  const hw = useHomework();
  const { sections } = useHomeworkSections();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const items = programHomework(pr, hw.items);
  const { list, completed } = splitDone(items);
  const section: HomeworkSection = sections.find(s => s.id === pr.id) || { id: pr.id, name: pr.name, sub: '', color: pr.color, program: pr.name };
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ marginHorizontal: -8, borderRadius: 16, backgroundColor: c.paper2, overflow: 'hidden' }}>
        <HomeworkTone.Provider value={{ panel: c.surface, field: c.paper2 }}>
          <ClassHomework s={section} list={list} completed={completed} sections={sections} todayIso={todayIso} openId={openId} setOpenId={setOpenId} showDone={showDone} onToggleDone={() => setShowDone(v => !v)} />
        </HomeworkTone.Provider>
      </View>
      <TextLink label="Open the Homework page" onPress={() => onNavigate('homework')} />
    </View>
  );
};

const CountDot = ({ n, color, ink }: { n: number; color: string; ink: string }) => (
  <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={[{ fontSize: 11.5, fontWeight: '800', color: ink }, tnum]}>{n}</Text>
  </View>
);

// ── Announcements ───────────────────────────────────────────────
type ProgramPost = PostOf<'news'>['data'] & { id: string; at: number };

const postWhen = (at: number) => {
  const d = new Date(at);
  const t = new Date();
  const days = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};

type Own = ReturnType<typeof useProgramPosts>;

const Announcements = ({ pr, news, own, canPost, onNavigate }: { pr: Program; news: ProgramPost[]; own: Own; canPost: boolean; onNavigate: (t: TabId) => void }) => {
  const { c, mode } = useTheme();
  const { opened } = useContent();
  const [openId, setOpenId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (id: string, counts = true) => {
    if (counts && openId !== id) opened(id);
    setOpenId(openId === id ? null : id);
  };
  const run = (f: () => Promise<void>) => { setErr(null); f().catch((e: any) => setErr(String(e?.message || 'That did not work. Try again.'))); };
  const del = async (p: OwnPost) => {
    if (await ask('Delete this post?', `It comes off ${pr.name} for everyone.`, 'Delete', true)) run(() => own.remove(p.id));
  };
  const empty = news.length === 0 && own.posts.length === 0;
  return (
    <View style={{ marginTop: 6 }}>
      {canPost && <Composer pr={pr} onPost={own.add} />}
      {canPost && !!own.note && <Text style={{ fontSize: 13, color: c.ink3, lineHeight: 18, paddingBottom: 6 }}>{own.note}</Text>}
      {!!err && <Text style={{ fontSize: 13, color: c.danger, lineHeight: 18, paddingBottom: 6 }}>{err}</Text>}
      {own.posts.map((p, i) => (
        <OwnPostRow key={p.id} p={p} pr={pr} first={i === 0 && !canPost} open={openId === p.id} onToggle={() => toggle(p.id, false)}
          canChange={own.canChange(p)} onPin={() => run(() => own.update(p.id, { pinned: !p.pinned }))} onDelete={() => del(p)} />
      ))}
      {empty && (
        <Text style={{ fontSize: 14.5, lineHeight: 21, color: c.ink2, paddingVertical: 10 }}>
          Nothing about {pr.name} yet. {canPost ? 'Posts you add show up here for everyone in it, along with' : 'Posts from the people who run it show up here, and'} any App Club post that mentions it.
        </Text>
      )}
      {news.map((n, i) => {
        const isOpen = openId === n.id;
        return (
          <Pressable key={n.id} onPress={() => toggle(n.id)} accessibilityRole="button" accessibilityState={{ expanded: isOpen }} accessibilityLabel={`${n.title}, ${n.category}, ${postWhen(n.at)}. ${isOpen ? 'Close' : 'Read'}`}
            style={({ pressed }) => ({ paddingVertical: 11, borderTopWidth: i || own.posts.length || canPost ? 1 : 0, borderTopColor: c.line2, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: glow(tagColor(n.category, c), mode) }}>
              {n.category}<Text style={{ fontWeight: '500', color: c.ink3 }}>{`   ${postWhen(n.at)}`}</Text>
            </Text>
            <Text style={{ fontSize: 15.5, fontWeight: '700', color: c.ink, marginTop: 3, letterSpacing: -0.3, lineHeight: 20 }}>{n.title}</Text>
            <Text numberOfLines={isOpen ? undefined : 2} style={{ fontSize: 14, color: c.ink2, marginTop: 3, lineHeight: 20 }}>{n.body.trim()}</Text>
            {isOpen && !!n.image && <Image source={{ uri: n.image }} accessibilityIgnoresInvertColors style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, marginTop: 10, backgroundColor: c.paper2 }} />}
            {isOpen && !!n.author && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 8 }}>{n.author}</Text>}
          </Pressable>
        );
      })}
      <TextLink label="All announcements" onPress={() => onNavigate('announcements')} />
    </View>
  );
};

// One of the program's own posts: who posted it in the program colour, pinned
// ones marked. Open: the whole text, and Pin / Delete for its author or staff.
const OwnPostRow = ({ p, pr, first, open, onToggle, canChange, onPin, onDelete }: {
  p: OwnPost; pr: Program; first: boolean; open: boolean; onToggle: () => void; canChange: boolean; onPin: () => void; onDelete: () => void;
}) => {
  const { c } = useTheme();
  const when = postWhen(Date.parse(p.createdAt));
  const who = p.authorName || pr.name;
  return (
    <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }}
      accessibilityLabel={`${p.pinned ? 'Pinned. ' : ''}${p.title}, from ${who}, ${when}. ${open ? 'Close' : 'Read'}`}
      style={({ pressed }) => ({ paddingVertical: 11, borderTopWidth: first ? 0 : 1, borderTopColor: c.line2, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {p.pinned && <Icon name="pin" size={12} stroke={2.4} color={pr.color} />}
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, fontWeight: '700', color: pr.color }}>
          {p.pinned ? `Pinned · ${who}` : who}<Text style={{ fontWeight: '500', color: c.ink3 }}>{`   ${when}`}</Text>
        </Text>
      </View>
      <Text style={{ fontSize: 15.5, fontWeight: '700', color: c.ink, marginTop: 3, letterSpacing: -0.3, lineHeight: 20 }}>{p.title}</Text>
      {!!p.body && <Text numberOfLines={open ? undefined : 2} style={{ fontSize: 14, color: c.ink2, marginTop: 3, lineHeight: 20 }}>{p.body}</Text>}
      {open && canChange && (
        <View style={{ flexDirection: 'row', gap: 22, marginTop: 8 }}>
          <Pressable onPress={onPin} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.link }}>{p.pinned ? 'Unpin' : 'Pin to top'}</Text>
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.danger }}>Delete</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
};

// Staff and the program's managers: a one-line "Post an announcement" that
// opens into title, text, pin and Post.
const Composer = ({ pr, onPost }: { pr: Program; onPost: (p: { title: string; body: string; pinned: boolean }) => Promise<void> }) => {
  const { c, mode } = useTheme();
  const on = onGlow(mode);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reset = () => { setTitle(''); setBody(''); setPinned(false); setErr(null); setOpen(false); };
  const post = async () => {
    setBusy(true); setErr(null);
    try { await onPost({ title, body, pinned }); reset(); }
    catch (e: any) { setErr(String(e?.message || 'Could not post. Try again.')); }
    finally { setBusy(false); }
  };
  const input = {
    minHeight: 44, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.ink, backgroundColor: c.surface,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}),
  };
  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Post an announcement to ${pr.name}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: pr.color, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={15} stroke={2.4} color={on} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.2 }}>Post an announcement</Text>
          <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>Everyone with {pr.name} sees it here</Text>
        </View>
      </Pressable>
    );
  }
  const ready = !!title.trim() && !busy;
  return (
    <View style={{ marginTop: 8, marginBottom: 10, marginHorizontal: -4, padding: 10, borderRadius: 16, backgroundColor: c.paper2, gap: 8 }}>
      <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={c.ink4} maxLength={120} autoFocus
        returnKeyType="next" style={[input, { fontWeight: '700' }]} accessibilityLabel="Post title" />
      <TextInput value={body} onChangeText={setBody} placeholder="What does everyone need to know?" placeholderTextColor={c.ink4} maxLength={4000}
        multiline style={[input, { minHeight: 88, textAlignVertical: 'top' }]} accessibilityLabel="Post text" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => setPinned(v => !v)} accessibilityRole="switch" accessibilityState={{ checked: pinned }} accessibilityLabel="Pin to top"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 11, borderRadius: 16, backgroundColor: pinned ? pr.color : c.surface, opacity: pressed ? 0.6 : 1 })}>
          <Icon name="pin" size={13} stroke={2.2} color={pinned ? on : c.ink3} />
          <Text style={{ fontSize: 13, fontWeight: pinned ? '700' : '600', color: pinned ? on : c.ink2 }}>{pinned ? 'Pinned' : 'Pin to top'}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={reset} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ paddingVertical: 6, paddingHorizontal: 4, opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink3 }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={post} disabled={!ready} accessibilityRole="button" accessibilityState={{ disabled: !ready }}
          style={({ pressed }) => ({ height: 36, paddingHorizontal: 16, borderRadius: 12, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center', opacity: !ready ? 0.4 : pressed ? 0.8 : 1 })}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{busy ? 'Posting…' : 'Post'}</Text>
        </Pressable>
      </View>
      {!!err && <Text style={{ fontSize: 13, color: c.danger, lineHeight: 18 }}>{err}</Text>}
    </View>
  );
};

// ── About ───────────────────────────────────────────────────────
const About = ({ pr, club, todayIso, onNavigate }: { pr: Program; club: Club | null; todayIso: string; onNavigate: (t: TabId) => void }) => {
  const { c } = useTheme();
  const info = courseInfo(pr.name);
  const school = programSchoolEvents(pr, todayIso).slice(0, 5);
  // A club's own blurb beats the generic line; real course-book text stays.
  const blurb = club?.blurb.trim() || '';
  return (
    <View>
      {!!blurb && <Text style={{ fontSize: 14.5, lineHeight: 21, color: c.ink2, marginTop: 14 }}>{blurb}</Text>}
      {(!blurb || info.official) && <CourseText text={info.desc} color={pr.color} />}
      {!!club && (!!club.meets || !!club.room || !!club.sponsor) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
          {!!club.meets && <Fact label="Meets" value={club.meets} />}
          {!!club.room && <Fact label="Room" value={club.room} />}
          {!!club.sponsor && <Fact label="Sponsor" value={club.sponsor} />}
        </View>
      )}
      {!!club?.gc && <ClassroomCode code={club.gc} />}
      {(!!info.fee || !!info.prereq) && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 12 }}>
          {!!info.fee && <Fact label="Course fee" value={info.fee} />}
          {!!info.prereq && <Fact label="Prerequisite" value={info.prereq} />}
        </View>
      )}

      {school.length > 0 && (
        <Section title="Coming up" link="Calendar" onLink={() => onNavigate('calendar')}>
          {school.map(e => {
            const d = fromISO(e.iso);
            return (
              <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 }}>
                <View style={{ width: 36, alignItems: 'center' }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: e.iso === todayIso ? pr.color : c.ink3 }}>{DOW3[d.getDay()]}</Text>
                  <Text style={[{ fontFamily: fonts.serif, fontSize: 22, lineHeight: 25, color: e.iso === todayIso ? pr.color : c.ink }, tnum]}>{d.getDate()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{e.title}</Text>
                  {!!e.time && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 1 }}>{e.time}</Text>}
                </View>
              </View>
            );
          })}
        </Section>
      )}
    </View>
  );
};

// Course-book text: "Big Ideas:" lines become small headings, "• " lines
// become bullets in the program colour. Long text folds after a few lines.
const CourseText = ({ text, color }: { text: string; color: string }) => {
  const { c } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const FOLD = 4;
  const long = lines.length > FOLD + 1 || text.length > 420;
  const shown = expanded || !long ? lines : lines.slice(0, FOLD);
  return (
    <View style={{ marginTop: 14 }}>
      {shown.map((l, i) => {
        if (/:$/.test(l) && l.length < 40) {
          return <Text key={i} style={{ fontSize: 14, fontWeight: '800', color: c.ink, letterSpacing: -0.2, marginTop: i ? 10 : 0, marginBottom: 4 }}>{l.replace(/:$/, '')}</Text>;
        }
        if (/^[•\-–]\s*/.test(l)) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: 5 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginTop: 8 }} />
              <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 21, color: c.ink2 }}>{l.replace(/^[•\-–]\s*/, '')}</Text>
            </View>
          );
        }
        return <Text key={i} numberOfLines={!expanded && long && shown.length === 1 ? 4 : undefined} style={{ fontSize: 14.5, lineHeight: 21, color: c.ink2, marginTop: i ? 8 : 0 }}>{l}</Text>;
      })}
      {long && (
        <Pressable onPress={() => setExpanded(v => !v)} hitSlop={8} style={{ marginTop: 6, alignSelf: 'flex-start' }} accessibilityRole="button">
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.link }}>{expanded ? 'Show less' : 'Read more'}</Text>
        </Pressable>
      )}
    </View>
  );
};

// The club's Google Classroom join code; tap to copy.
const ClassroomCode = ({ code }: { code: string }) => {
  const { c } = useTheme();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await Clipboard.setStringAsync(code); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* no clipboard: the code is on screen */ }
  };
  return (
    <Pressable
      onPress={copy}
      accessibilityRole="button"
      accessibilityLabel={`Google Classroom code ${code.split('').join(' ')}. Copy`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: c.paper2, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12, fontWeight: '500', color: c.ink3 }}>Google Classroom code to join</Text>
        <Text selectable style={[{ fontSize: 18, fontWeight: '700', color: c.ink, marginTop: 2, letterSpacing: 1 }, tnum]}>{code}</Text>
      </View>
      <Icon name={copied ? 'check' : 'copy'} size={18} stroke={2} color={copied ? c.moss : c.link} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: copied ? c.moss : c.link }}>{copied ? 'Copied' : 'Copy'}</Text>
    </Pressable>
  );
};

const Fact = ({ label, value }: { label: string; value: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ maxWidth: '100%' }}>
      <Text style={{ fontSize: 12, fontWeight: '500', color: c.ink3 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: c.ink, marginTop: 1 }}>{value}</Text>
    </View>
  );
};

const Section = ({ title, link, onLink, children }: { title: string; link?: string; onLink?: () => void; children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{title}</Text>
        {!!link && <Pressable onPress={onLink} hitSlop={8}><Text style={{ fontSize: 13.5, fontWeight: '600', color: c.link }}>{link}</Text></Pressable>}
      </View>
      {children}
    </View>
  );
};

const TextLink = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 8, marginTop: 4, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: c.link }}>{label}</Text>
      <Icon name="chev-r" size={14} stroke={2} color={c.link} />
    </Pressable>
  );
};

// ── Grades ──────────────────────────────────────────────────────
// The mark that matters right now: the final once it's in, otherwise the term average.
const currentMark = (g: Partial<Record<Term, string>>) => {
  const final = Number(g.Final);
  if (g.Final && final > 0) return { label: 'Final', value: final };
  const avg = termAverage(g);
  return avg === null ? null : { label: 'Average', value: avg };
};
const letterFor = (n: number) => n >= 86 ? 'A' : n >= 73 ? 'B' : n >= 67 ? 'C+' : n >= 60 ? 'C' : n >= 50 ? 'C−' : 'F';

const Grades = ({ pr }: { pr: Program }) => {
  const { c, mode } = useTheme();
  const { gradesFor, setGrade } = useGrades();
  const g = gradesFor(pr.name);
  const mark = currentMark(g);
  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Text style={[{ fontFamily: fonts.serif, fontSize: 40, lineHeight: 44, letterSpacing: -1, color: mark ? pr.color : c.ink4 }, tnum]}>
          {mark ? `${mark.value}%` : '—'}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink3 }}>
          {mark ? `${mark.label} · ${letterFor(mark.value)}` : 'No marks yet'}
        </Text>
      </View>
      <View style={{ marginTop: 10 }}>
        {TERMS.map((t, i) => {
          const v = g[t] || '';
          const n = Number(v);
          const tone = !v ? c.ink4 : glow(n >= 86 ? c.moss : n >= 73 ? c.navy700 : n >= 60 ? c.gold : c.crimson, mode);
          return (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 }}>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: t === 'Final' ? '800' : '500', color: c.ink }}>{t}</Text>
              {!!v && <Text style={{ fontSize: 13, fontWeight: '800', color: tone }}>{letterFor(n)}</Text>}
              <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 10, backgroundColor: c.paper2, paddingHorizontal: 10 }}>
                <TextInput
                  value={v}
                  onChangeText={x => setGrade(pr.name, t, x)}
                  placeholder="—"
                  placeholderTextColor={c.ink4}
                  keyboardType="decimal-pad"
                  maxLength={5}
                  style={[{ width: 46, textAlign: 'right', fontSize: 16, fontWeight: '700', color: tone, paddingVertical: 7 }, tnum]}
                  accessibilityLabel={`${t} mark`}
                />
                <Text style={{ fontSize: 13, color: c.ink4, marginLeft: 2 }}>%</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={{ fontSize: 12.5, color: c.ink4, marginTop: 10, lineHeight: 17 }}>
        Marks stay on this phone. MyEdBC is still the official record.
      </Text>
    </View>
  );
};
