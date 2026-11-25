// Spartans — Home for a teacher. One job per part, top to bottom:
//   Card        who you are (the teacher card), and how many students you reach
//   Waiting     only until the App Club confirms the account: what that means,
//               and a box for a teacher code
//   New announcement   the one big button. Write once, send to any classes.
//   Today       the day's blocks in order, with the time, room and how many of
//               that class are on Spartans. The block that is on now is marked.
//   My classes  every class you teach. Tap one for its students and posts.
// No XP, badges, homework or Buzz here: those are for students.
//
// The first time, a short welcome says what a teacher gets.

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Image, TextInput, RefreshControl, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { NowDot, SectionHeader } from '../components/Chrome';
import { BottomSheet } from '../components/BottomSheet';
import { RoleCard } from '../admin/RoleCard';
import { Act } from '../admin/ui';
import { ART } from '../ranks';
import { useProfile, fullName, initials, roomShort, Slot } from '../ProfileContext';
import { useToday, fmtWeekday, fmtMonthDay, greeting, nextSchoolDay } from '../useToday';
import { fmt12 } from '../bell';
import { useClassSheet } from '../components/ClassCard';
import { glow } from '../components/ProgramIcon';
import { TeacherCompose } from '../components/TeacherCompose';
import { useRosters, useTeacher } from '../teacher';
import type { ScreenProps } from '../../App';

const WELCOME_KEY = 'spartans-teacher-welcome-v1';   // "spartans-" so Delete account clears it

export default function TeacherHome({ onNavigate, topInset, onEdit }: ScreenProps) {
  const { c, mode } = useTheme();
  const { profile, refreshRoles } = useProfile();
  const { confirmed, classes } = useTeacher();
  const rosters = useRosters();
  const sheet = useClassSheet();
  const t = useToday(profile?.courses || []);
  const [compose, setCompose] = useState(false);
  const [posted, setPosted] = useState<number | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_KEY).then(v => { if (!v) setWelcome(true); }).catch(() => {});
  }, []);
  const closeWelcome = () => { setWelcome(false); AsyncStorage.setItem(WELCOME_KEY, '1').catch(() => {}); };

  // Confirmed since the last look? Ask once when Home opens.
  useEffect(() => { if (!confirmed) refreshRoles(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (posted === null) return;
    const id = setTimeout(() => setPosted(null), 4000);
    return () => clearTimeout(id);
  }, [posted]);

  const refresh = async () => {
    setPulling(true);
    await Promise.all([refreshRoles(), rosters.reload()]).catch(() => {});
    setPulling(false);
  };

  const reach = classes.reduce((n, k) => n + rosters.count(k.slot), 0);
  const foot = !confirmed ? 'Waiting to be confirmed'
    : !classes.length ? 'No classes added yet'
    : `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}${reach ? ` · ${reach} students on Spartans` : ''}`;
  const open = (slot: Slot) => { const k = profile?.courses.find(x => x.slot === slot); if (k) sheet.openCourse(k); };
  const blocks = t.plan?.blocks.filter(b => b.kind === 'block') || [];
  const ahead = t.plan ? null : nextSchoolDay(t.now, profile?.courses || []);

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} tintColor={c.ink3} />}>
        <AppHeader topInset={topInset} title="Home" />

        <View style={{ paddingTop: 16, paddingHorizontal: 20 }}>
          <Text style={{ fontSize: 15, color: c.ink3, letterSpacing: -0.1 }}>
            <Text style={{ color: c.ink, fontWeight: '700' }}>{fmtWeekday(t.now)}</Text>{'  '}{fmtMonthDay(t.now)}
          </Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: 31, lineHeight: 36, marginTop: 2, color: c.ink, letterSpacing: -0.8 }}>
            {greeting(t.now)}, {profile?.firstName || 'there'}.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 12 }}>
          <RoleCard tier={confirmed ? 'manager' : 'member'} role="Teacher" name={profile ? fullName(profile) : ''} sub={profile?.dept || undefined}
            foot={foot} photo={profile?.photoUri || undefined} initials={profile ? initials(profile) : '?'} art={ART.gradcap} />

          {!confirmed && <Waiting />}

          <Act fill icon="plus" label="New announcement" disabled={!confirmed || !classes.length} onPress={() => setCompose(true)} />
          {posted !== null && (
            <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="check-circle" size={16} stroke={2} color={c.moss} />
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.ink2 }}>
                Posted to {posted === 1 ? '1 class' : `${posted} classes`}.
              </Text>
              <Pressable onPress={() => onNavigate('announcements')} hitSlop={10} accessibilityRole="button">
                <Text style={{ fontSize: 14, fontWeight: '600', color: c.link }}>See it</Text>
              </Pressable>
            </View>
          )}
          {confirmed && !classes.length && (
            <Text style={{ fontSize: 13.5, color: c.ink3, lineHeight: 19 }}>Add the classes you teach first, then you can post to them.</Text>
          )}
        </View>

        {/* ── Today ─────────────────────────────────────────────── */}
        <SectionHeader title="Today" trailing="Calendar" onTrailing={() => onNavigate('calendar')} />
        <View style={{ paddingHorizontal: 20 }}>
          {blocks.length > 0 ? (
            <View style={[{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, shadow.sm]}>
              {blocks.map((b, i) => {
                const k = b.course;
                const teaching = !!k && !k.spare && !!k.name.trim();
                const now = t.current === b;
                const n = teaching ? rosters.count(k!.slot) : 0;
                const col = glow(k?.color || c.ink4, mode);
                return (
                  <Pressable key={b.slot || i} onPress={teaching ? () => open(k!.slot) : undefined} disabled={!teaching}
                    accessibilityRole={teaching ? 'button' : undefined}
                    accessibilityLabel={`${fmt12(b.start)} to ${fmt12(b.end, true)}. ${teaching ? k!.name : 'Prep'}${now ? ', on now' : ''}`}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
                    <View style={{ width: 64 }}>
                      <Text style={[{ fontSize: 14, fontWeight: '700', color: now ? col : c.ink }, tnum]}>{fmt12(b.start)}</Text>
                      <Text style={[{ fontSize: 12, color: c.ink3, marginTop: 1 }, tnum]}>{fmt12(b.end, true)}</Text>
                    </View>
                    <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: teaching ? col : c.line }} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: teaching ? '700' : '500', color: teaching ? c.ink : c.ink3, letterSpacing: -0.3 }}>
                        {teaching ? k!.name : 'Prep'}
                      </Text>
                      <Text numberOfLines={1} style={[{ fontSize: 12.5, color: c.ink3, marginTop: 1 }, tnum]}>
                        {[`Block ${b.slot}`, teaching && k!.room ? roomShort(k!.room) : null, n ? `${n} on Spartans` : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {now ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <NowDot color={col} />
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: col }}>Now</Text>
                      </View>
                    ) : teaching ? <Icon name="chev-r" size={14} stroke={2} color={c.ink4} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ padding: 16, borderRadius: 20, backgroundColor: c.paper2 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>No classes today</Text>
              <Text style={{ fontSize: 13.5, color: c.ink3, marginTop: 2, lineHeight: 19 }}>
                {ahead ? `${ahead.when === 'Next' ? 'The next school day' : ahead.when} is Day ${ahead.t.plan.dayNum}, ${fmtMonthDay(ahead.date)}.` : 'Enjoy the break.'}
              </Text>
            </View>
          )}
        </View>

        {/* ── My classes ────────────────────────────────────────── */}
        <SectionHeader title="My classes" trailing={classes.length ? 'Edit' : undefined} onTrailing={() => onEdit('classes')} />
        <View style={{ paddingHorizontal: 20 }}>
          {classes.length > 0 ? (
            <View style={[{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, shadow.sm]}>
              {classes.map((k, i) => {
                const n = rosters.count(k.slot);
                const col = glow(k.color, mode);
                return (
                  <Pressable key={k.slot} onPress={() => open(k.slot)} accessibilityRole="button"
                    accessibilityLabel={`${k.name}, block ${k.slot}${confirmed ? `, ${n} students on Spartans` : ''}. Open`}
                    style={({ pressed }) => ({ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
                    <View style={{ width: 46, height: 30, borderRadius: 9, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={[{ fontSize: 13, fontWeight: '800', color: mode === 'dark' ? '#0E141B' : '#fff' }, tnum]}>{k.slot}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{k.name}</Text>
                      <Text numberOfLines={1} style={[{ fontSize: 12.5, color: c.ink3, marginTop: 1 }, tnum]}>
                        {[k.room ? roomShort(k.room) : null, confirmed ? (n ? `${n} ${n === 1 ? 'student' : 'students'} on Spartans` : 'No students on Spartans yet') : null].filter(Boolean).join(' · ') || 'Tap to open'}
                      </Text>
                    </View>
                    <Icon name="chev-r" size={14} stroke={2} color={c.ink4} />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ padding: 16, borderRadius: 20, backgroundColor: c.paper2, gap: 12 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>Add the classes you teach</Text>
                <Text style={{ fontSize: 13.5, color: c.ink3, marginTop: 2, lineHeight: 19 }}>Then you can post to each one and see who is in it.</Text>
              </View>
              <Act small tone="plain" icon="plus" label="Add my classes" onPress={() => onEdit('classes')} />
            </View>
          )}
          {!!rosters.note && confirmed && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 10, lineHeight: 18 }}>{rosters.note}</Text>}
          {confirmed && classes.length > 0 && (
            <Text style={{ fontSize: 12.5, color: c.ink4, marginTop: 10, lineHeight: 17 }}>
              A student shows up in a class once they put it, in the same block, in their own timetable.
            </Text>
          )}
        </View>
      </ScrollView>

      <TeacherCompose visible={compose} classes={classes} onClose={() => setCompose(false)} onPosted={setPosted} />
      {welcome && <Welcome name={profile?.firstName || ''} confirmed={confirmed} onClose={closeWelcome} />}
    </>
  );
}

// ── Waiting to be confirmed ─────────────────────────────────────
// Says what is held back and why, and takes a teacher code on the spot.
const Waiting = () => {
  const { c } = useTheme();
  const { redeemInvite, refreshRoles } = useProfile();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const use = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setMsg(null);
    try { await redeemInvite(code.trim()); }
    catch (e: any) {
      const m = String(e?.message || '');
      setMsg(/not configured/i.test(m) ? 'Codes need the server, which this build does not have.'
        : /network|fetch|timeout/i.test(m) ? 'Could not reach the server. Try again.'
        : 'That code did not work. Check it, or ask the App Club for a new one.');
    }
    setBusy(false);
  };
  const check = async () => { setBusy(true); setMsg(null); await refreshRoles().catch(() => {}); setBusy(false); setMsg('Not confirmed yet. Ask someone in the App Club, or check again later.'); };

  return (
    <View style={{ padding: 16, borderRadius: 18, backgroundColor: c.goldTint, gap: 12 }}>
      <View>
        <Text style={{ fontSize: 16.5, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>One step left: the App Club confirms you</Text>
        <Text style={{ fontSize: 14, color: c.ink2, marginTop: 3, lineHeight: 20 }}>
          It stops anyone from posing as a teacher. Look around all you like. Posting and class lists switch on once you are confirmed.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={code} onChangeText={v => setCode(v.replace(/\s/g, '').toUpperCase().slice(0, 16))} placeholder="Teacher code" placeholderTextColor={c.ink3}
          autoCapitalize="characters" autoCorrect={false} returnKeyType="done" onSubmitEditing={use} accessibilityLabel="Teacher code"
          style={[{ flex: 1, minWidth: 0, minHeight: 48, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, color: c.ink, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, letterSpacing: 1 },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
        <Act label="Use code" busy={busy} disabled={!code.trim()} onPress={use} />
      </View>
      <Pressable onPress={check} disabled={busy} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.link }}>No code? Check if I am confirmed</Text>
      </Pressable>
      {!!msg && <Text accessibilityLiveRegion="polite" style={{ fontSize: 13.5, color: c.ink2, lineHeight: 19 }}>{msg}</Text>}
    </View>
  );
};

// ── Welcome (once) ──────────────────────────────────────────────
const PERKS: { art: any; title: string; sub: string }[] = [
  { art: ART.megaphone, title: 'Post to a class in three taps', sub: 'Pick the classes, write it once. Only those students see it.' },
  { art: ART.ledger, title: 'See who is in each class', sub: 'Every student who has your class on Spartans, by block.' },
  { art: ART.gradcap, title: 'Marked as a teacher', sub: 'Your posts say Teacher, so students know they are real.' },
];

const Welcome = ({ name, confirmed, onClose }: { name: string; confirmed: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  return (
    <BottomSheet onClose={onClose} style={[{ backgroundColor: c.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34 }, shadow.lg]}>
      <View style={{ alignItems: 'center', paddingBottom: 16 }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
      </View>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 35, color: c.ink, letterSpacing: -0.7 }}>
        Welcome{name ? `, ${name}` : ''}.
      </Text>
      <Text style={{ fontSize: 15, color: c.ink3, marginTop: 4, lineHeight: 21 }}>
        Spartans is run by students in the App Club. Here is what teachers get.
      </Text>
      <View style={{ gap: 16, marginTop: 20 }}>
        {PERKS.map(k => (
          <View key={k.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Image source={k.art} style={{ width: 42, height: 42 }} resizeMode="contain" accessibilityIgnoresInvertColors />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{k.title}</Text>
              <Text style={{ fontSize: 13.5, color: c.ink3, marginTop: 1, lineHeight: 19 }}>{k.sub}</Text>
            </View>
          </View>
        ))}
      </View>
      {!confirmed && (
        <Text style={{ fontSize: 13.5, color: c.ink2, marginTop: 18, lineHeight: 19 }}>
          Posting switches on once the App Club confirms you are a teacher.
        </Text>
      )}
      <View style={{ marginTop: 22 }}>
        <Act fill label="Get started" onPress={onClose} />
      </View>
    </BottomSheet>
  );
};
