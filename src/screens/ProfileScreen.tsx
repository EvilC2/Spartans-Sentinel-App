// Spartans — Me / Profile screen (from the header avatar, not a tab)
// Sections (top → bottom):
//   1. Profile header (name, grade, photo) + badge button → BadgesSheet
//   2. Digital student ID card (StudentIdCard — tap to flip to the QR side)
//   3. My timetable — table: block # | Day 1 class | Day 2 class (tap a cell for the class card)
//   4. Settings / account list
//   5. Sign out

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Platform, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon, IconName, Check } from '../components/Icon';
import { StudentIdCard, Portrait } from '../components/StudentIdCard';
import { SectionHeader } from '../components/Chrome';
import { AppHeader } from '../components/AppHeader';
import { useClassSheet } from '../components/ClassCard';
import { levelState, levelTitle } from '../xp';
import { useProfile, StudentProfile, Course, fullName, gradeLabel, homeroom, teacherShort, roomShort, courseAt, Slot } from '../ProfileContext';
import { BadgesSheet, unlockedCount } from './BadgesScreen';
import type { ScreenProps } from '../../App';

// Shape the card/header components read. Built from the saved profile.
type Stu = { name: string; gradeLabel: string; homeroom: string; pronouns: string };
const toStu = (p: StudentProfile): Stu => ({
  name: fullName(p) || 'Student',
  gradeLabel: gradeLabel(p),
  homeroom: homeroom(p) || '—',
  pronouns: p.pronouns || '',
});

export default function ProfileScreen({ onNavigate, topInset, onEditProfile }: ScreenProps) {
  const { c, mode, toggle } = useTheme();
  const { profile, signOut: doSignOut, roles } = useProfile();
  const p = profile!;
  const stu = toStu(p);
  const [badges, setBadges] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const sheet = useClassSheet();

  const signOut = () => {
    const msg = 'Your account stays on this device. Sign back in with your school email or student number and your password.';
    // RN-web has no Alert; fall back to the browser confirm.
    if (Platform.OS === 'web') { if (typeof confirm === 'function' && confirm(`Sign out?\n\n${msg}`)) doSignOut(); return; }
    Alert.alert('Sign out?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { doSignOut(); } },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader topInset={topInset} title="Profile" back />

      {/* ── Profile header ──────────────────────────────────── */}
      <ProfileHeader stu={stu} p={p} onBadges={() => setBadges(true)} />

      {/* ── Student ID card ─────────────────────────────────── */}
      <View style={{ paddingTop: 4, paddingHorizontal: 20 }}>
        <StudentIdCard p={p} />
        <Text style={{ textAlign: 'center', fontSize: 11, color: c.ink4, marginTop: 8 }}>Tap the card to flip it</Text>
      </View>

      {/* ── My timetable ────────────────────────────────────── */}
      <SectionHeader title="My timetable" trailing="Day view" onTrailing={() => onNavigate('dayview')} />
      <View style={{ paddingHorizontal: 20 }}>
        <WeekTable p={p} onCourse={sheet.openCourse} />
      </View>

      {/* ── Outside the timetable ───────────────────────────── */}
      {p.extraCourses.length > 0 && (
        <>
          <SectionHeader title="Outside the timetable" />
          <View style={{ paddingHorizontal: 20 }}>
            <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }, shadow.sm]}>
              {p.extraCourses.map((x, j) => (
                <Pressable key={j} onPress={() => sheet.open({ name: x.name, teacher: x.teacher, kind: 'extra' })} accessibilityRole="button" accessibilityLabel={`${x.name}, open class card`} style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: j === p.extraCourses.length - 1 ? 0 : 1, borderBottomColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{x.name}</Text>
                  {!!x.teacher && <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 2 }}>{teacherShort(x.teacher)}</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}

      {/* ── Settings list ───────────────────────────────────── */}
      <SectionHeader title="Settings" />
      <View style={{ paddingHorizontal: 20 }}>
        <SettingsList mode={mode} onToggleTheme={toggle} onEditProfile={onEditProfile} email={p.email} roles={roles} onAdmin={() => setAdminOpen(true)} />
      </View>

      {/* ── Sign out ────────────────────────────────────────── */}
      <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 8 }}>
        <Pressable
          onPress={signOut}
          style={({ pressed }) => ({
            paddingVertical: 13, paddingHorizontal: 16,
            borderWidth: 1, borderColor: c.line, borderRadius: 14,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{
            color: c.crimson, fontSize: 14, fontWeight: '600', letterSpacing: -0.1,
          }}>
            Sign out
          </Text>
        </Pressable>
      </View>

      <Text style={{
        paddingTop: 14, paddingHorizontal: 20, paddingBottom: 8,
        textAlign: 'center', fontSize: 11, color: c.ink4, letterSpacing: 0.3,
      }}>
        Spartans · Sentinel Secondary's unofficial app · v3.0
      </Text>

      <BadgesSheet visible={badges} onClose={() => setBadges(false)} />
      <AdminSheet visible={adminOpen} onClose={() => setAdminOpen(false)} />
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────────
// Profile header — name, grade, photo
// ────────────────────────────────────────────────────────────────
const ProfileHeader = ({ stu, p, onBadges }: { stu: Stu; p: StudentProfile; onBadges: () => void }) => {
  const { c } = useTheme();
  const n = unlockedCount();
  return (
    <View style={{
      paddingTop: 22, paddingHorizontal: 20, paddingBottom: 18,
      flexDirection: 'row', alignItems: 'center', gap: 16,
    }}>
      <Portrait p={p} w={72} h={72} round />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
          fontWeight: '700', color: c.ink3,
        }}>
          Student
        </Text>
        <Text style={{
          fontSize: 24, fontWeight: '600', color: c.ink,
          letterSpacing: -0.5, lineHeight: 27.6, marginTop: 2,
        }}>
          {stu.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 13, color: c.ink3 }}>{stu.gradeLabel}</Text>
          <Text style={{ fontSize: 13, color: c.ink4 }}>·</Text>
          <Text style={{ fontSize: 13, color: c.ink3 }}>Homeroom {stu.homeroom}</Text>
          <Text style={{ fontSize: 13, color: c.ink4 }}>·</Text>
          <Text style={{ fontSize: 13, color: c.ink3 }}>{stu.pronouns}</Text>
        </View>
        <LevelLine />
      </View>
      {/* Badge button — right of the name, above the ID card */}
      <Pressable
        onPress={onBadges}
        hitSlop={6}
        style={({ pressed }) => [{
          alignItems: 'center', justifyContent: 'center',
          width: 48, height: 48, borderRadius: 14,
          backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
          opacity: pressed ? 0.6 : 1,
        }, shadow.sm]}
      >
        <Icon name="badge" size={22} stroke={1.7} color={c.gold} />
        <View style={{
          position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, borderRadius: 9,
          paddingHorizontal: 5, backgroundColor: c.navy700, borderWidth: 1.5, borderColor: c.paper,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={[{ fontSize: 10, fontWeight: '700', color: '#fff' }, tnum]}>{n}</Text>
        </View>
      </Pressable>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Weekly schedule table — header row + 4 block rows.
//   #  |  Day 1 (1-n)  |  Day 2 (2-n)
// ────────────────────────────────────────────────────────────────
const WeekTable = ({ p, onCourse }: { p: StudentProfile; onCourse: (k: Course) => void }) => {
  const { c } = useTheme();
  const rows = [1, 2, 3, 4].map(n => ({
    n,
    d1: courseAt(p, `1-${n}` as Slot),
    d2: courseAt(p, `2-${n}` as Slot),
  }));
  const NUM_W = 36;
  return (
    <View style={[{
      backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.line,
      borderRadius: 16, overflow: 'hidden',
    }, shadow.sm]}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', backgroundColor: c.paper2, borderBottomWidth: 1, borderBottomColor: c.line }}>
        <View style={{ width: NUM_W, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRightWidth: 1, borderRightColor: c.line2 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: c.ink4 }}>#</Text>
        </View>
        {['Day 1', 'Day 2'].map((d, i) => (
          <View key={d} style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 12, borderRightWidth: i === 0 ? 1 : 0, borderRightColor: c.line2 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: c.ink3 }}>{d}</Text>
          </View>
        ))}
      </View>

      {rows.map((r, i) => (
        <View key={r.n} style={{ flexDirection: 'row', borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: c.line2 }}>
          <View style={{ width: NUM_W, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: c.line2, backgroundColor: c.paper2 }}>
            <Text style={[{ fontFamily: fonts.serif, fontSize: 18, color: c.ink2, letterSpacing: -0.3 }, tnum]}>{r.n}</Text>
          </View>
          <TableCell k={r.d1} slot={`1-${r.n}`} divider onPress={r.d1 && !r.d1.spare && r.d1.name ? () => onCourse(r.d1!) : undefined} />
          <TableCell k={r.d2} slot={`2-${r.n}`} onPress={r.d2 && !r.d2.spare && r.d2.name ? () => onCourse(r.d2!) : undefined} />
        </View>
      ))}
    </View>
  );
};

const TableCell = ({ k, slot, divider = false, onPress }: { k?: Course; slot: string; divider?: boolean; onPress?: () => void }) => {
  const { c } = useTheme();
  const name = k?.spare ? 'Spare' : (k?.name || `Block ${slot}`);
  const sub = k?.spare ? '' : [teacherShort(k?.teacher || ''), k?.room ? roomShort(k.room) : null].filter(Boolean).join(' · ');
  const color = k?.color || c.ink4;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={onPress ? `${name}, open class card` : undefined} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderRightWidth: divider ? 1 : 0, borderRightColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
      <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: k?.spare ? c.line : color, minHeight: 28 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: '600', color: k?.spare ? c.ink3 : c.ink, letterSpacing: -0.2, lineHeight: 16 }}>
          {name}
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 11, color: c.ink3, marginTop: 2, letterSpacing: -0.1 }}>
          {sub || slot}
        </Text>
      </View>
    </Pressable>
  );
};

// Level + XP bar under the name. Local XP from unlocked badges (src/xp.ts).
const LevelLine = () => {
  const { c } = useTheme();
  const lv = levelState();
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text style={[{ fontSize: 12.5, fontWeight: '700', color: c.navy700 }, tnum]}>Level {lv.level} · {levelTitle(lv.level)}</Text>
        <Text style={[{ fontSize: 11, color: c.ink4 }, tnum]}>{lv.xp} XP · {lv.toNext} to next</Text>
      </View>
      <View style={{ marginTop: 4, height: 5, borderRadius: 3, backgroundColor: c.line2, overflow: 'hidden' }}>
        <View style={{ width: `${Math.round(lv.progress * 100)}%`, height: '100%', backgroundColor: c.gold, borderRadius: 3 }} />
      </View>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Settings list — Appearance row toggles light/dark
// ────────────────────────────────────────────────────────────────
const SettingsList = ({
  mode, onToggleTheme, onEditProfile, email, roles, onAdmin,
}: { mode: 'light' | 'dark'; onToggleTheme: () => void; onEditProfile: () => void; email?: string; roles: string[]; onAdmin: () => void }) => {
  const { c } = useTheme();
  const items: {
    label: string; icon: IconName; sub: string | null; onPress?: () => void;
  }[] = [
    { label: 'Edit profile & classes', icon: 'me', sub: 'Name, grade, email, all 8 blocks', onPress: onEditProfile },
    { label: 'Notifications', icon: 'bell', sub: 'Announcements, homework, events' },
    { label: 'Account & privacy', icon: 'me', sub: email || 'No school email set' },
    {
      label: 'Appearance', icon: 'sparkle',
      sub: mode === 'dark' ? 'Dark · Tap to switch to light' : 'Light · Tap to switch to dark',
      onPress: onToggleTheme,
    },
    { label: 'Linked apps', icon: 'grid', sub: 'MyEdBC · Office 365' },
    { label: 'Help & support', icon: 'compass', sub: null },
    {
      label: 'App Club Admin', icon: 'shield', onPress: onAdmin,
      sub: roles.length ? `Roles: ${roles.join(', ')}` : 'School App Club members: enter your invite code',
    },
  ];

  return (
    <View style={[{
      backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.line,
      borderRadius: 16, overflow: 'hidden',
    }, shadow.sm]}>
      {items.map((it, i) => (
        <SettingsRow key={it.label} it={it} isLast={i === items.length - 1} />
      ))}
    </View>
  );
};

const SettingsRow = ({ it, isLast }: { it: any; isLast: boolean }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={it.onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: 12, alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: c.line2,
        opacity: pressed && it.onPress ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 32, height: 32, borderRadius: 9,
        backgroundColor: c.navy50,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name={it.icon} size={17} stroke={1.8} color={c.navy700} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: c.ink, letterSpacing: -0.1 }}>
          {it.label}
        </Text>
        {!!it.sub && (
          <Text numberOfLines={1} style={{ fontSize: 12, color: c.ink3, marginTop: 1 }}>
            {it.sub}
          </Text>
        )}
      </View>
      <Icon name="chev-r" size={16} stroke={1.8} color={c.ink4} />
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// App Club Admin — redeem an invite code. The code binds one role to this
// account on the server (single use, expires); the server also decides what
// that role may write. Owners can mint codes here too.
// ────────────────────────────────────────────────────────────────
const ROLE_OPTIONS = ['trivia', 'polls', 'news', 'menu', 'popups', 'badges', 'library', 'owner'] as const;

const AdminSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  const { roles, redeemInvite, online } = useProfile();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [minted, setMinted] = useState<string | null>(null);
  const isOwner = roles.includes('owner');

  const redeem = async () => {
    if (busy || !code.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const role = await redeemInvite(code);
      setMsg({ ok: true, text: `You now have the ${role} role.` });
      setCode('');
    } catch (e: any) {
      setMsg({ ok: false, text: String(e?.message || 'Could not redeem that code.') });
    } finally { setBusy(false); }
  };

  const mint = async (role: string) => {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const { admin } = await import('../backend');
      setMinted(await admin.createInvite(role as any));
    } catch (e: any) {
      setMsg({ ok: false, text: String(e?.message || 'Could not create a code.') });
    } finally { setBusy(false); }
  };

  const field = { borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.ink, backgroundColor: c.surface } as const;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.paper }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: c.ink }}>App Club Admin</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={{ fontSize: 15, color: c.navy700, fontWeight: '600' }}>Done</Text></Pressable>
          </View>
          <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>
            {roles.length ? `Your roles: ${roles.join(', ')}.` : 'No roles yet.'}
            {' '}Got an invite code from the club? Enter it once; the role sticks to this account.
          </Text>
          {!online && (
            <Text style={{ fontSize: 13, color: c.crimson }}>Offline — codes need a connection.</Text>
          )}

          <TextInput
            value={code}
            onChangeText={t => setCode(t.toUpperCase())}
            placeholder="INVITE CODE"
            placeholderTextColor={c.ink4}
            autoCapitalize="characters"
            autoCorrect={false}
            style={field}
            onSubmitEditing={redeem}
          />
          <Pressable
            onPress={redeem}
            disabled={busy || !code.trim()}
            style={({ pressed }) => ({
              backgroundColor: c.navy700, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
              opacity: busy || !code.trim() ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{busy ? 'Checking…' : 'Redeem code'}</Text>
          </Pressable>
          {msg && (
            <Text style={{ fontSize: 14, color: msg.ok ? c.moss : c.crimson }}>{msg.text}</Text>
          )}

          {isOwner && (
            <View style={{ marginTop: 20, gap: 10 }}>
              <SectionHeader title="Create an invite code" />
              <Text style={{ fontSize: 13, color: c.ink3, lineHeight: 18 }}>
                Owner only. Tap a role; the code works once and expires in 7 days. Send it to the member privately.
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ROLE_OPTIONS.map(r => (
                  <Pressable
                    key={r}
                    onPress={() => mint(r)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                      borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.navy50 : c.surface,
                    })}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: c.ink }}>{r}</Text>
                  </Pressable>
                ))}
              </View>
              {minted && (
                <View style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 14, backgroundColor: c.surface }}>
                  <Text style={{ fontSize: 12, color: c.ink3 }}>New code</Text>
                  <Text selectable style={[{ fontSize: 24, fontWeight: '700', color: c.ink, letterSpacing: 2 }, tnum]}>{minted}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};
