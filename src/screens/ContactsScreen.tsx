// Spartans — Contacts (from More)
// The student's own teachers first (from the timetable, matched against the
// real staff directory in src/staff.ts), then the people everyone needs:
// counsellors (yours is flagged), admin, office, library, and the school's
// main lines. Tapping a row copies the email and opens the mail app.
// The search box at the top looks through the whole staff directory (any
// teacher, not only yours) by first name, last name, role or email.

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, Platform, TextInput } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { useProfile, teacherShort } from '../ProfileContext';
import {
  STAFF, SCHOOL, StaffMember, findStaff, guessEmail, counsellorFor, staffName, staffInitials,
} from '../staff';
import type { ScreenProps } from '../../App';

type Row = {
  key: string;
  name: string;
  role: string;
  email: string;
  initials: string;
  tag?: string;        // "Yours" on the student's counsellor
  guessed?: boolean;   // email pattern-derived, not from the staff page
  phone?: string;      // tel: row instead of mailto:
};

const fromStaff = (s: StaffMember, extra: Partial<Row> = {}): Row => ({
  key: s.email, name: staffName(s), role: s.role, email: s.email, initials: staffInitials(s), ...extra,
});

export default function ContactsScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const [copied, setCopied] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // ── My teachers: one row per distinct teacher on the timetable ──
  const teachers = useMemo<Row[]>(() => {
    if (!profile) return [];
    const byTeacher = new Map<string, string[]>();
    for (const k of profile.courses) {
      if (!k.teacher.trim()) continue;
      const list = byTeacher.get(k.teacher) || [];
      list.push(k.name ? `${k.name} · ${k.slot}` : `Block ${k.slot}`);
      byTeacher.set(k.teacher, list);
    }
    for (const x of profile.extraCourses) {
      if (!x.teacher.trim()) continue;
      const list = byTeacher.get(x.teacher) || [];
      list.push(x.name || 'Extra class');
      byTeacher.set(x.teacher, list);
    }
    const rows: Row[] = [];
    for (const [teacher, classes] of byTeacher) {
      const s = findStaff(teacher);
      const email = s?.email || guessEmail(teacher);
      if (!email) continue;
      const name = s ? staffName(s) : teacher.includes(',') ? teacher.split(',').reverse().map(x => x.trim()).join(' ') : teacher;
      const short = teacherShort(teacher);
      rows.push({
        key: 't:' + teacher,
        name,
        role: classes.join(' · '),
        email,
        initials: s ? staffInitials(s) : (short[0] || '?').toUpperCase(),
        guessed: !s,
      });
    }
    return rows;
  }, [profile]);

  const mine = profile ? counsellorFor(profile.lastName) : undefined;
  const counselling = STAFF.filter(s => s.group === 'counselling').map(s =>
    fromStaff(s, { role: s.range ? `${s.role} · ${s.range}` : s.role, tag: mine && s.email === mine.email ? 'Yours' : undefined }));
  const admin = STAFF.filter(s => s.group === 'admin').map(s => fromStaff(s));
  const office = STAFF.filter(s => s.group === 'office').map(s => fromStaff(s));
  const library = STAFF.filter(s => s.group === 'library').map(s => fromStaff(s));
  const school: Row[] = [
    { key: 'main', name: 'Main office', role: 'General enquiries', email: SCHOOL.email, initials: 'SS' },
    { key: 'att', name: 'Attendance', role: 'Report an absence or late', email: SCHOOL.attendanceEmail, initials: 'AT' },
    { key: 'tel', name: 'Call the school', role: SCHOOL.phone, email: SCHOOL.phone, initials: '☎', phone: SCHOOL.phoneRaw },
  ];

  // Every word typed must appear somewhere in the person's name, role or email.
  const results = useMemo<Row[]>(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const all = [...teachers, ...STAFF.map(s => fromStaff(s, { role: s.range ? `${s.role} · ${s.range}` : s.role }))];
    const seen = new Set<string>();
    return all.filter(r => {
      if (seen.has(r.email)) return false;
      const hay = `${r.name} ${r.role} ${r.email}`.toLowerCase();
      if (!words.every(w => hay.includes(w))) return false;
      seen.add(r.email);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [query, teachers]);
  const searching = query.trim().length > 0;

  const onRow = async (r: Row) => {
    try { await Clipboard.setStringAsync(r.email); } catch { /* clipboard unavailable — still open mail */ }
    setCopied(r.key);
    setTimeout(() => setCopied(k => (k === r.key ? null : k)), 1800);
    const url = r.phone ? `tel:${r.phone}` : `mailto:${r.email}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <AppHeader topInset={topInset} title="Contacts" back />
      <View style={{ height: 14 }} />

      <SearchBox value={query} onChange={setQuery} />

      {searching ? (
        <Section title={results.length ? `${results.length} found` : 'No matches'} icon="search" rows={results} copied={copied} onRow={onRow}
          empty={`No staff match "${query.trim()}". Try a first or last name.`} />
      ) : (
      <>
      <Section title="My teachers" icon="book" rows={teachers} copied={copied} onRow={onRow}
        empty="Add your classes in Profile to see your teachers here." />
      <Section title="Counselling" icon="compass" rows={counselling} copied={copied} onRow={onRow} />
      <Section title="Administration" icon="me" rows={admin} copied={copied} onRow={onRow} />
      <Section title="Office" icon="mail" rows={office} copied={copied} onRow={onRow} />
      <Section title="Library & careers" icon="book" rows={library} copied={copied} onRow={onRow} />
      <Section title="School" icon="phone" rows={school} copied={copied} onRow={onRow} />
      </>
      )}

      <Text style={{ paddingTop: 24, paddingHorizontal: 20, textAlign: 'center', fontSize: 12, color: c.ink4, letterSpacing: 0.2, lineHeight: 17 }}>
        {SCHOOL.address}{'\n'}Directory from the school staff page · Sep 2026
      </Text>
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────────
const SearchBox = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const { c } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, shadow.sm]}>
        <Icon name="search" size={17} stroke={1.9} color={c.ink3} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search any teacher or staff"
          placeholderTextColor={c.ink4}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="never"
          accessibilityLabel="Search staff"
          style={{ flex: 1, fontSize: 15, color: c.ink, paddingVertical: 0 }}
        />
        {!!value && (
          <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityLabel="Clear search"
            style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={12} stroke={2.2} color={c.ink3} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const Section = ({
  title, icon, rows, copied, onRow, empty,
}: { title: string; icon: IconName; rows: Row[]; copied: string | null; onRow: (r: Row) => void; empty?: string }) => {
  const { c } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 10 }}>
        <Icon name={icon} size={15} stroke={1.8} color={c.ink3} />
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', color: c.ink3 }}>{title}</Text>
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }, shadow.sm]}>
          {rows.length === 0 && !!empty && (
            <Text style={{ padding: 14, fontSize: 13, color: c.ink3, lineHeight: 18 }}>{empty}</Text>
          )}
          {rows.map((r, i) => (
            <ContactRow key={r.key} r={r} isLast={i === rows.length - 1} copied={copied === r.key} onPress={() => onRow(r)} />
          ))}
        </View>
      </View>
    </View>
  );
};

const ContactRow = ({ r, isLast, copied, onPress }: { r: Row; isLast: boolean; copied: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${r.name}, ${r.role}. ${r.phone ? 'Call' : 'Copy email and open Mail'}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 11, paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: c.line2,
        backgroundColor: pressed ? c.paper2 : 'transparent',
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: r.tag ? c.navy700 : c.navy50, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 12.5, fontWeight: '700', letterSpacing: 0.3, color: r.tag ? '#fff' : c.navy700 }}>{r.initials}</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2, flexShrink: 1 }}>{r.name}</Text>
          {!!r.tag && (
            <View style={{ backgroundColor: c.goldTint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: c.gold }}>{r.tag}</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={{ fontSize: 12.5, color: c.ink3, marginTop: 2 }}>{r.role}</Text>
        <Text numberOfLines={1} style={[{ fontSize: 12, color: copied ? c.moss : c.navy700, marginTop: 3, fontWeight: '500', letterSpacing: -0.1 }, tnum]}>
          {copied ? (r.phone ? 'Calling…' : 'Copied · opening Mail') : r.email}{r.guessed && !copied ? ' · unverified' : ''}
        </Text>
      </View>

      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: copied ? c.moss : c.paper2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={copied ? 'copy' : r.phone ? 'phone' : 'mail'} size={15} stroke={1.8} color={copied ? '#fff' : c.ink2} />
      </View>
    </Pressable>
  );
};

// Keep Platform imported for future web-specific copy fallbacks.
void Platform;
