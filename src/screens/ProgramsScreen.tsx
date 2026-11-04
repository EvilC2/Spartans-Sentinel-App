// Spartans — Programs tab.
// Everything the student is part of, in four groups: Timetable classes,
// Outside timetable classes (YELL, Careers, online courses, French Immersion),
// Extracurriculars (sports first, then band and music, then the rest), Clubs.
// Tap a card and it opens right here, pushing the rest down (one open at a
// time): description, upcoming, homework, announcements, grades
// (ProgramBody). nav.openProgram(id) from anywhere lands here with it open.
// "Add programs" at the bottom searches the whole catalog (clubs, teams,
// academies, every course) or adds a new one by name; added ones are stored
// as the profile's extraCourses, so they sync with the account.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Platform, useWindowDimensions, LayoutAnimation, UIManager } from 'react-native';
import { useTheme } from '../ThemeContext';
import { useKeyboardHeight, sheetHeight } from '../useKeyboard';
import { fonts, shadow, tnum } from '../theme';
import { Icon } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { ProgramIcon, wash, glow, onGlow } from '../components/ProgramIcon';
import { ProgramBody } from '../components/ProgramBody';
import { LinearGradient } from 'expo-linear-gradient';
import { useProfile, teacherShort, roomShort } from '../ProfileContext';
import { useNav } from '../nav';
import { useHomework } from '../stores';
import {
  Program, ExtraKind, programsFor, groupPrograms, matchPrograms, toExtra, classifyName, programHomework,
  KIND_ONE, KIND_COLOR, CatalogEntry,
} from '../programs';
import type { ScreenProps } from '../../App';

if (Platform.OS === 'android') UIManager.setLayoutAnimationEnabledExperimental?.(true);
const animate = () => LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));

export default function ProgramsScreen({ topInset, onEdit, onNavigate }: ScreenProps) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const nav = useNav();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const programs = useMemo(() => programsFor(profile), [profile]);
  const groups = groupPrograms(programs);

  // Card tops (inside the list) so an opened card can be scrolled into view.
  const scroll = useRef<ScrollView>(null);
  const listY = useRef(0);
  const tops = useRef<Record<string, number>>({});
  const scrollTo = (id: string) => setTimeout(() => {
    const y = tops.current[id];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, listY.current + y - 12), animated: true });
  }, 260);

  const toggle = (id: string) => {
    animate();
    const opening = openId !== id;
    // Closing a card above this one moves this one up: follow it.
    const above = openId && (tops.current[openId] ?? 0) < (tops.current[id] ?? 0);
    setOpenId(opening ? id : null);
    if (opening && above) scrollTo(id);
  };

  // Opened from elsewhere (a timetable tile, the calendar).
  useEffect(() => {
    if (!nav.program) return;
    setOpenId(nav.program);
    scrollTo(nav.program);
    nav.clearProgram();
  }, [nav.program]);

  return (
    <ScrollView ref={scroll} style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <AppHeader topInset={topInset} title="Programs" count={
        <View style={{ minWidth: 30, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${programs.length} programs`}>
          <Text style={[{ fontSize: 13, fontWeight: '700', color: c.link }, tnum]}>{programs.length}</Text>
        </View>
      } />
      <View style={{ height: 4 }} />

      {groups.length === 0 && (
        <Text style={{ paddingHorizontal: 20, paddingTop: 16, fontSize: 13, color: c.ink3, lineHeight: 18 }}>
          Nothing yet. Add your timetable in Profile, or tap Add programs below.
        </Text>
      )}

      <View onLayout={e => { listY.current = e.nativeEvent.layout.y; }} style={{ paddingHorizontal: 16 }}>
        {groups.map(g => (
          <React.Fragment key={g.group}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 26, paddingHorizontal: 4, paddingBottom: 12 }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 22, letterSpacing: -0.5, color: c.ink }}>
                {g.label}  <Text style={[{ fontFamily: undefined, fontSize: 15, color: c.ink4, fontWeight: '600' }, tnum]}>{g.items.length}</Text>
              </Text>
              {g.group === 'timetable' && (
                <Pressable onPress={() => onEdit('classes')} hitSlop={8}><Text style={{ fontSize: 14, color: c.link, fontWeight: '600' }}>Edit</Text></Pressable>
              )}
            </View>
            {g.items.map(p => (
              <View key={p.id} onLayout={e => { tops.current[p.id] = e.nativeEvent.layout.y; }}>
                <ProgramCard
                  p={p}
                  open={openId === p.id}
                  onToggle={() => toggle(p.id)}
                  onNavigate={onNavigate}
                  onEditTimetable={() => onEdit('classes')}
                />
              </View>
            ))}
          </React.Fragment>
        ))}
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          accessibilityLabel="Add programs"
          style={({ pressed }) => [{
            height: 50, borderRadius: 16, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8, opacity: pressed ? 0.8 : 1,
          }, shadow.sm]}
        >
          <Icon name="plus" size={18} stroke={2.2} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: -0.2 }}>Add programs</Text>
        </Pressable>
        <Text style={{ fontSize: 13, color: c.ink3, marginTop: 10, lineHeight: 18, textAlign: 'center', paddingHorizontal: 12 }}>
          Online courses, teams, bands, clubs and anything outside the timetable.
        </Text>
      </View>

      <AddProgramSheet visible={adding} onClose={() => setAdding(false)} existing={programs} />
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────────
// One card per program. Closed: icon, name, blocks or kind, open homework.
// Open: the same row on top and ProgramBody under it.
// ────────────────────────────────────────────────────────────────
const ProgramCard = ({ p, open, onToggle, onNavigate, onEditTimetable }: {
  p: Program; open: boolean; onToggle: () => void; onNavigate: ScreenProps['onNavigate']; onEditTimetable: () => void;
}) => {
  const { c, mode } = useTheme();
  const { items } = useHomework();
  // Program colours are deep; glow() brightens them on the dark theme.
  const col = glow(p.color, mode);
  const openHw = programHomework(p, items).filter(h => !h.done).length;
  // Blocks bold in the class colour, then teacher, then room, each styled on its own.
  const lead = p.kind === 'class' ? p.slots.join('  ') : KIND_ONE[p.kind];
  const teacher = teacherShort(p.teacher || '');
  const room = p.kind === 'class' && p.room ? roomShort(p.room) : '';
  // Open: the card turns plain and the program colour fades down from the
  // top, gone by the tabs (header height + where ProgramBody says they start).
  const bodyBg = mode === 'dark' ? '#1C2531' : c.surface;
  const [headH, setHeadH] = useState(0);
  const [fadeY, setFadeY] = useState(0);
  return (
    <View style={[{
      marginBottom: 10, backgroundColor: open ? bodyBg : wash(col, mode === 'dark' ? 0.24 : 0.11), borderRadius: 20, overflow: 'hidden',
    }, open ? shadow.md : shadow.none]}>
      {open && (
        <LinearGradient
          pointerEvents="none"
          colors={[wash(col, mode === 'dark' ? 0.32 : 0.2), wash(col, 0)]}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: headH + (fadeY || 60) }}
        />
      )}
      <Pressable
        onLayout={e => setHeadH(e.nativeEvent.layout.height)}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${p.name}. ${open ? 'Close' : 'Open'}`}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <ProgramIcon bare name={p.name} kind={p.kind} color={p.color} size={open ? 52 : 46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={open ? 2 : 1} style={open
            ? { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: c.ink, letterSpacing: -0.5 }
            : { fontSize: 16, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{p.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 }}>
            {!!lead && <Text numberOfLines={1} style={[{ fontSize: 13, fontWeight: '800', color: col }, tnum]}>{lead}</Text>}
            {!!teacher && <Text numberOfLines={1} style={{ fontSize: 13.5, color: c.ink2, flexShrink: 1 }}>{teacher}</Text>}
            {!!room && <Text numberOfLines={1} style={[{ fontSize: 13.5, fontWeight: '500', color: c.ink3 }, tnum]}>{room}</Text>}
          </View>
        </View>
        {openHw > 0 && !open && (
          <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: col, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`${openHw} homework open`}>
            <Text style={[{ fontSize: 11.5, fontWeight: '800', color: onGlow(mode) }, tnum]}>{openHw}</Text>
          </View>
        )}
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chev-d" size={16} stroke={2} color={open ? col : c.ink4} />
        </View>
      </Pressable>
      {open && (
        <View>
          <ProgramBody pr={p} onNavigate={onNavigate} onEditTimetable={onEditTimetable} onFadeEnd={setFadeY} />
        </View>
      )}
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Add programs — search the catalog, or add a new one with a kind.
// ────────────────────────────────────────────────────────────────
const KINDS: ExtraKind[] = ['outside', 'online', 'sport', 'music', 'extra', 'club'];

const AddProgramSheet = ({ visible, onClose, existing }: { visible: boolean; onClose: () => void; existing: Program[] }) => {
  const { c, mode } = useTheme();
  const { height } = useWindowDimensions();
  const kb = useKeyboardHeight();
  const { profile, save } = useProfile();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<ExtraKind | null>(null);
  const [online, setOnline] = useState(false);   // course list is huge: this marks the pick as an online course
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const have = useMemo(() => new Set(existing.map(p => p.name.trim().toLowerCase())), [existing]);
  const results = useMemo(() => {
    const all = matchPrograms(q, profile?.grade, have);
    return (online ? all.filter(r => r.kind === 'outside') : all).slice(0, 30);
  }, [q, profile?.grade, have, online]);
  const trimmed = q.trim();
  const exact = results.some(r => r.name.toLowerCase() === trimmed.toLowerCase());
  const canAddNew = trimmed.length >= 2 && !exact && !have.has(trimmed.toLowerCase());

  const add = async (name: string, k?: ExtraKind) => {
    if (!profile) return;
    setError(null);
    const next = { ...profile, extraCourses: [...profile.extraCourses, toExtra(name, k)] };
    try {
      await save(next);
      setAdded(name);
      setQ('');
      setKind(null);
      setTimeout(() => setAdded(null), 1800);
    } catch {
      // save() writes the device copy before talking to the server, so the
      // program is in the list either way; the account copy catches up on sync.
      setAdded(name);
      setQ('');
      setKind(null);
      setError('Saved on this phone. It syncs to your account next time you are signed in.');
      setTimeout(() => { setAdded(null); setError(null); }, 3000);
    }
  };

  const close = () => { setQ(''); setKind(null); setError(null); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(14,34,56,0.35)' }} accessibilityLabel="Close" />
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: kb }}>
        <View style={[{ height: sheetHeight(height, kb, 0.86), backgroundColor: c.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }, shadow.lg]}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
          </View>

          <View style={{ paddingHorizontal: 20, paddingTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 24, letterSpacing: -0.5, color: c.ink }}>Add programs</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => ({
              width: 32, height: 32, borderRadius: 16, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1,
            })}>
              <Icon name="close" size={16} stroke={2} color={c.ink2} />
            </Pressable>
          </View>

          <View style={{ marginHorizontal: 20, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 14, paddingHorizontal: 13, backgroundColor: c.paper2 }}>
            <Icon name="search" size={17} stroke={1.8} color={c.ink4} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search courses, teams, clubs"
              placeholderTextColor={c.ink4}
              autoFocus
              autoCorrect={false}
              returnKeyType="done"
              style={{ flex: 1, fontSize: 15, color: c.ink, paddingVertical: 8 }}
              accessibilityLabel="Search programs"
            />
            {!!q && (
              <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search"><Icon name="close" size={14} stroke={2} color={c.ink4} /></Pressable>
            )}
          </View>

          <View style={{ marginHorizontal: 20, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, color: c.ink2, flex: 1 }}>Taking it <Text style={{ fontWeight: '700' }}>online</Text>?</Text>
            <Pressable
              onPress={() => setOnline(v => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: online }}
              accessibilityLabel="Online course"
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 11, borderRadius: 15,
                backgroundColor: online ? glow(KIND_COLOR.online, mode) : c.paper2, opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ fontSize: 13.5, fontWeight: online ? '700' : '500', color: online ? onGlow(mode) : c.ink2 }}>{online ? 'Online: on' : 'Online: off'}</Text>
            </Pressable>
          </View>

          {!!added && <Text style={{ marginTop: 10, textAlign: 'center', fontSize: 14, fontWeight: '700', color: glow(c.moss, mode) }}>Added {added}</Text>}
          {!!error && <Text style={{ marginTop: 4, marginHorizontal: 20, textAlign: 'center', fontSize: 13, color: c.ink3 }}>{error}</Text>}

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {canAddNew && (
              <View style={[{ backgroundColor: c.surface, borderRadius: 18, padding: 16, marginBottom: 14 }, shadow.sm]}>
                <Text style={{ fontSize: 13, fontWeight: '500', color: c.ink3 }}>Not in the list</Text>
                <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, marginTop: 2, letterSpacing: -0.3 }}>Add “{trimmed}”</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {KINDS.map(k => {
                    const on = (kind || (online ? 'online' : classifyName(trimmed))) === k;
                    return (
                      <Pressable key={k} onPress={() => setKind(k)} accessibilityRole="button" accessibilityState={{ selected: on }} style={({ pressed }) => ({
                        paddingHorizontal: 11, height: 30, borderRadius: 15, justifyContent: 'center',
                        backgroundColor: on ? glow(KIND_COLOR[k], mode) : c.paper2, opacity: pressed ? 0.6 : 1,
                      })}>
                        <Text style={{ fontSize: 13.5, fontWeight: on ? '700' : '500', color: on ? onGlow(mode) : c.ink2 }}>{KIND_ONE[k]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable onPress={() => add(trimmed, kind || (online ? 'online' : classifyName(trimmed)))} accessibilityRole="button" style={({ pressed }) => ({
                  marginTop: 12, height: 42, borderRadius: 12, backgroundColor: c.action, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1,
                })}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Add new program</Text>
                </Pressable>
              </View>
            )}

            {results.length === 0 && !canAddNew && (
              <Text style={{ fontSize: 13, color: c.ink3, textAlign: 'center', paddingTop: 20 }}>Type a few letters to search.</Text>
            )}

            {results.length > 0 && (
              <View style={[{ backgroundColor: c.surface, borderRadius: 18, overflow: 'hidden' }, shadow.sm]}>
                {results.map((r, i) => <CatalogRow key={r.name} r={r} isLast={i === results.length - 1} onAdd={() => add(r.name, online ? 'online' : r.kind)} />)}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const CatalogRow = ({ r, isLast, onAdd }: { r: CatalogEntry; isLast: boolean; onAdd: () => void }) => {
  const { c, mode } = useTheme();
  return (
    <Pressable
      onPress={onAdd}
      accessibilityRole="button"
      accessibilityLabel={`Add ${r.name}`}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent',
      })}
    >
      <ProgramIcon name={r.name} kind={r.kind} color={KIND_COLOR[r.kind]} size={34} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{r.name}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: glow(KIND_COLOR[r.kind], mode), marginTop: 1 }}>{KIND_ONE[r.kind]}</Text>
      </View>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={15} stroke={2.2} color={c.link} />
      </View>
    </Pressable>
  );
};
