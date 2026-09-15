// Spartans — Social tab.
// Phase 3 builds this on the backend (friends, shared blocks, badges). For
// now it explains what is coming and shows the student's own friend code so
// the screen is not empty.

import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { useProfile } from '../ProfileContext';
import type { ScreenProps } from '../../App';

const COMING: { icon: IconName; title: string; sub: string }[] = [
  { icon: 'users', title: 'Add friends', sub: 'By school email or friend code. Both sides opt in.' },
  { icon: 'calendar', title: 'Compare schedules', sub: 'Shared blocks, shared spares, who is at lunch with you.' },
  { icon: 'copy', title: 'One-tap email', sub: 'Copy a friend’s address for Google Docs and group projects.' },
  { icon: 'badge', title: 'Badges and levels', sub: 'See what your friends have unlocked.' },
];

export default function SocialScreen({ topInset }: ScreenProps) {
  const { c } = useTheme();
  const { profile } = useProfile();
  const code = profile?.studentId || (profile?.email || '').split('@')[0] || '—';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <AppHeader topInset={topInset} />

      <View style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 14 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.7, color: c.ink }}>Social</Text>
        <Text style={{ fontSize: 13, color: c.ink3, marginTop: 4, letterSpacing: -0.1 }}>
          Needs accounts, so it lands with the backend. No chat, on purpose.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <View style={[{ backgroundColor: c.skyTint, borderWidth: 1, borderColor: c.line, borderRadius: 18, padding: 16 }, shadow.sm]}>
          <Text style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: c.sky600 }}>Your friend code</Text>
          <Text style={[{ fontFamily: fonts.serif, fontSize: 30, color: c.ink, marginTop: 4, letterSpacing: 0.5 }, tnum]}>{code}</Text>
          <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 4 }}>Your student number. Friends will add you with it.</Text>
        </View>

        <View style={[{ marginTop: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }, shadow.sm]}>
          {COMING.map((x, i) => (
            <View key={x.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i === COMING.length - 1 ? 0 : 1, borderBottomColor: c.line2 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={x.icon} size={18} stroke={1.8} color={c.navy700} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{x.title}</Text>
                <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 2, lineHeight: 17 }}>{x.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
