// Spartans — Homework (from More or a class card)
// Tasks grouped by class (the student's own course names from the profile).
// Items are still mock data (src/data.ts) — checking one off is local state.
// Not a bottom tab any more: reached from More, Quick links or a class card.

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import S from '../data';
import { useTheme } from '../ThemeContext';
import { fonts, shadow } from '../theme';
import { Check } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { useProfile } from '../ProfileContext';
import type { ScreenProps } from '../../App';

export default function HomeworkScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const courses = profile?.courses || [];

  const [tasks, setTasks] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    S.homework.forEach(g => g.items.forEach(i => { m[i.id] = i.done; }));
    return m;
  });
  const toggleTask = (id: string) => setTasks(t => ({ ...t, [id]: !t[id] }));
  const totalOpen = Object.values(tasks).filter(v => !v).length;
  const dueSoon = S.homework.flatMap(g => g.items).filter(i => !tasks[i.id] && /Today|Tomorrow/.test(i.due)).length;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.paper }}
      contentContainerStyle={{ paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <AppHeader topInset={topInset} title="Homework" back />

      <View style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.7, color: c.ink }}>
            Homework
          </Text>
          <Text style={{ fontSize: 12, color: c.ink3, fontWeight: '500', letterSpacing: -0.1 }}>
            {totalOpen === 0 ? 'All done' : `${totalOpen} open`}
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: dueSoon ? c.crimson : c.ink3, marginTop: 4, letterSpacing: -0.1 }}>
          {dueSoon ? `${dueSoon} due by tomorrow` : 'Nothing due before Wednesday'}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {S.homework.map(g => {
          const k = courses.find(x => x.slot === g.slot);
          return (
            <HomeworkGroup
              key={g.slot}
              g={{ ...g, course: k?.name || `Block ${g.slot}`, color: k?.color || c.navy700 }}
              tasks={tasks}
              onToggle={toggleTask}
            />
          );
        })}
      </View>

      <Text style={{ paddingTop: 28, paddingHorizontal: 20, textAlign: 'center', fontSize: 12, color: c.ink4, letterSpacing: 0.2 }}>
        Sample tasks · teacher sync coming later
      </Text>
    </ScrollView>
  );
}

// ────────────────────────────────────────────────────────────────
// Homework — grouped by class
// ────────────────────────────────────────────────────────────────
const HomeworkGroup = ({
  g, tasks, onToggle,
}: { g: any; tasks: Record<string, boolean>; onToggle: (id: string) => void }) => {
  const { c } = useTheme();
  const open = g.items.filter((i: any) => !tasks[i.id]).length;
  return (
    <View style={[{
      backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.line,
      borderRadius: 16, overflow: 'hidden',
    }, shadow.sm]}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingTop: 12, paddingHorizontal: 14, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: c.line2,
      }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.color }} />
        <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>
          {g.course}
        </Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 11, color: c.ink3, fontWeight: '500' }}>
          {open === 0 ? 'All done' : open + ' open'}
        </Text>
      </View>

      <View>
        {g.items.map((i: any, idx: number) => (
          <HomeworkItem
            key={i.id}
            i={i}
            done={tasks[i.id]}
            onToggle={() => onToggle(i.id)}
            isLast={idx === g.items.length - 1}
            accent={g.color}
          />
        ))}
      </View>
    </View>
  );
};

const HomeworkItem = ({
  i, done, onToggle, isLast, accent,
}: { i: any; done: boolean; onToggle: () => void; isLast: boolean; accent: string }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: 10, alignItems: 'center',
        paddingVertical: 11, paddingHorizontal: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: c.line2,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 20, height: 20, borderRadius: 6,
        borderWidth: 1.5, borderColor: done ? accent : c.ink4,
        backgroundColor: done ? accent : 'transparent',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {done && <Check size={12} color="#fff" width={3.5} />}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{
          fontSize: 13.5, fontWeight: '500',
          color: done ? c.ink4 : c.ink,
          letterSpacing: -0.1, lineHeight: 17.5,
          textDecorationLine: done ? 'line-through' : 'none',
        }}>
          {i.title}
        </Text>
      </View>

      <DueChip due={i.due} priority={i.priority} done={done} />
    </Pressable>
  );
};

const DueChip = ({
  due, priority, done,
}: { due: string; priority: string; done: boolean }) => {
  const { c } = useTheme();
  const isSoon = /Tomorrow|Today/.test(due);
  const color = done ? c.ink4
    : priority === 'high' ? c.crimson
    : isSoon ? c.gold
    : c.ink3;
  return (
    <Text style={{
      fontSize: 11, fontWeight: '600', color,
      letterSpacing: 0.1, textTransform: 'uppercase',
    }}>
      {due}
    </Text>
  );
};
