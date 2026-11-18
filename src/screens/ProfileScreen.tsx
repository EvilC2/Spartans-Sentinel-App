// Spartans — Me / Profile screen (from the header avatar, not a tab)
// Sections (top → bottom):
//   1. Profile header (name, grade, photo) + badge button → BadgesSheet,
//      then your pinned badges (tap to change)
//   2. Digital student ID card (StudentIdCard — tap to flip to the QR side)
//   3. My timetable — table: block # | Day 1 class | Day 2 class (tap a cell for the class card)
//   4. Settings (Settings.tsx): Appearance, Notifications, Linked apps, App Club
//      Admin, then Edit profile / Edit classes / Account & privacy, Sign out,
//      Help & feedback

import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, pngShadow } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { StudentIdCard, Portrait } from '../components/StudentIdCard';
import { SectionHeader } from '../components/Chrome';
import { AppHeader } from '../components/AppHeader';
import { useClassSheet } from '../components/ClassCard';
import { XpSheet } from '../components/XpSheet';
import { XpBar } from '../components/XpBar';
import { useProfile, StudentProfile, Course, fullName, gradeLabel, homeroom, teacherShort, roomShort, courseAt, Slot } from '../ProfileContext';
import { BadgesSheet, unlockedCount } from './BadgesScreen';
import { BadgeIcon, BadgeArt } from '../components/BadgeArt';
import { Badge, isUnlocked } from '../badges';
import { badgeOf, MAX_PINNED } from '../social';
import { useEarnedVersion } from '../earned';
import { SettingsSection } from './Settings';
import { clubRoles, isTop, mainRole, roleLabel } from '../ranks';
import type { ScreenProps } from '../../App';

// Shape the card/header components read. Built from the saved profile.
type Stu = { name: string; gradeLabel: string; homeroom: string; pronouns: string };
const toStu = (p: StudentProfile): Stu => ({
  name: fullName(p) || 'Student',
  gradeLabel: gradeLabel(p),
  homeroom: homeroom(p) || '—',
  pronouns: p.pronouns || '',
});

export default function ProfileScreen({ onNavigate, topInset, onEdit }: ScreenProps) {
  const { c } = useTheme();
  const { profile, refreshRoles } = useProfile();
  const p = profile!;
  useEffect(() => { refreshRoles(); }, []);   // pick up roles granted since last launch
  const stu = toStu(p);
  const [badges, setBadges] = useState(false);
  const [xp, setXp] = useState(false);
  const sheet = useClassSheet();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader topInset={topInset} title="Profile" back />

      {/* ── Profile header ──────────────────────────────────── */}
      <ProfileHeader stu={stu} p={p} onBadges={() => setBadges(true)} onXp={() => setXp(true)} />
      <PinnedBadges p={p} onPress={() => setBadges(true)} />

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

      {/* ── Settings ────────────────────────────────────────── */}
      <SettingsSection onEdit={onEdit} />

      <BadgesSheet visible={badges} onClose={() => setBadges(false)} />
      <XpSheet visible={xp} onClose={() => setXp(false)} />
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────────
// Profile header — name, grade, photo
// ────────────────────────────────────────────────────────────────
const ProfileHeader = ({ stu, p, onBadges, onXp }: { stu: Stu; p: StudentProfile; onXp: () => void; onBadges: () => void }) => {
  const { c } = useTheme();
  const { roles } = useProfile();
  const n = unlockedCount();
  // App Club role pill: gold for the top roles (President, Teacher Sponsor;
  // the app's owner reads as President), navy for any other club role, and
  // "Teacher" for the teacher role alone (migration 0021).
  const top = isTop(roles) ? mainRole(roles) : null;
  const rolePill = top ? { label: roleLabel(top), bg: c.goldTint, fg: c.gold, icon: 'shield' as IconName }
    : clubRoles(roles).length ? { label: 'App Club', bg: c.navy50, fg: c.navy700, icon: 'shield' as IconName }
    : roles.length ? { label: roleLabel('teacher'), bg: c.navy50, fg: c.navy700, icon: 'grad' as IconName } : null;
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
          {rolePill && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: rolePill.bg }}>
              <Icon name={rolePill.icon} size={11} stroke={2.2} color={rolePill.fg} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: rolePill.fg, letterSpacing: 0.3 }}>{rolePill.label}</Text>
            </View>
          )}
        </View>
        <XpBar rank onPress={onXp} style={{ marginTop: 10 }} />
      </View>
      {/* Badge button — right of the name, above the ID card */}
      <Pressable
        onPress={onBadges}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Badges, ${n} unlocked`}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <BadgeIcon size={50} />
      </Pressable>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Pinned badges — the ones friends see under your name, small, in a row.
// Tap to change.
// ────────────────────────────────────────────────────────────────
const PinnedBadges = ({ p, onPress }: { p: StudentProfile; onPress: () => void }) => {
  const { c } = useTheme();
  useEarnedVersion();
  const pinned = (p.pinnedBadges || []).map(badgeOf).filter((b): b is Badge => !!b && isUnlocked(b)).slice(0, MAX_PINNED);
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={pinned.length ? `Pinned badges: ${pinned.map(b => b.title).join(', ')}. Change` : 'Pin up to four badges'}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}>
        {pinned.map(b => (
          <View key={b.id} style={pngShadow(5, 6, 0.4)}><BadgeArt badge={b} size={40} /></View>
        ))}
        {pinned.length < MAX_PINNED && (
          <View style={{ height: 40, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: pinned.length ? 2 : 0 }}>
            <Icon name="plus" size={14} stroke={2.2} color={c.gold} />
            {!pinned.length && <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.gold }}>Pin badges</Text>}
          </View>
        )}
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
