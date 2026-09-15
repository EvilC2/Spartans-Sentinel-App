// Spartans — More tab (the four-square icon).
// A grid of page links. Each tile has a pin in its top-right corner; pinned
// pages show as Quick links on Home. Pages marked for a later phase show a
// short notice instead of opening.

import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow } from '../theme';
import { Icon } from '../components/Icon';
import { AppHeader } from '../components/AppHeader';
import { Grid } from '../components/Chrome';
import { PAGES, Page } from '../pages';
import { usePins } from '../stores';
import { BadgesSheet } from './BadgesScreen';
import type { ScreenProps } from '../../App';

export default function MoreScreen({ onNavigate, topInset }: ScreenProps) {
  const { c } = useTheme();
  const { isPinned, toggle, pins } = usePins();
  const [badges, setBadges] = useState(false);
  const [soon, setSoon] = useState<string | null>(null);

  const open = (p: Page) => {
    if (p.go) onNavigate(p.go);
    else if (p.action === 'badges') setBadges(true);
    else if (p.soon) { setSoon(`${p.label} is coming in ${p.soon.toLowerCase()}.`); setTimeout(() => setSoon(null), 2200); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.paper }} contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
      <AppHeader topInset={topInset} />

      <View style={{ paddingTop: 14, paddingHorizontal: 20, paddingBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, letterSpacing: -0.7, color: c.ink }}>More</Text>
          <Text style={{ fontSize: 12, color: c.ink3, fontWeight: '500' }}>{pins.length} pinned</Text>
        </View>
        <Text style={{ fontSize: 13, color: c.ink3, marginTop: 4, letterSpacing: -0.1 }}>
          Pin a page to put it in Quick links on Home.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <Grid cols={2} gap={12}>
          {PAGES.map(p => (
            <PageTile key={p.id} p={p} pinned={isPinned(p.id)} onPress={() => open(p)} onPin={() => toggle(p.id)} />
          ))}
        </Grid>
        {!!soon && <Text style={{ fontSize: 12.5, color: c.navy700, fontWeight: '600', marginTop: 14, textAlign: 'center' }}>{soon}</Text>}
      </View>

      <BadgesSheet visible={badges} onClose={() => setBadges(false)} />
    </ScrollView>
  );
}

const PageTile = ({ p, pinned, onPress, onPin }: { p: Page; pinned: boolean; onPress: () => void; onPin: () => void }) => {
  const { c } = useTheme();
  // The pin is a sibling of the tile button, not a child: nested buttons are
  // invalid on web and awkward for screen readers.
  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={p.label}
        style={({ pressed }) => [{
          minHeight: 118, borderRadius: 18, padding: 14,
          backgroundColor: c.surface, borderWidth: 1, borderColor: c.line,
          opacity: pressed ? 0.75 : 1, justifyContent: 'space-between',
        }, shadow.sm]}
      >
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: p.soon ? c.paper2 : c.navy50, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={p.icon} size={22} stroke={1.7} color={p.soon ? c.ink4 : c.navy700} />
        </View>
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: c.ink, letterSpacing: -0.2, flexShrink: 1 }}>{p.label}</Text>
            {!!p.soon && (
              <View style={{ backgroundColor: c.paper2, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: c.line }}>
                <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: c.ink4, textTransform: 'uppercase' }}>Soon</Text>
              </View>
            )}
          </View>
          <Text numberOfLines={2} style={{ fontSize: 12, color: c.ink3, marginTop: 2, lineHeight: 16 }}>{p.sub}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onPin}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={pinned ? `Unpin ${p.label}` : `Pin ${p.label} to Quick links`}
        style={({ pressed }) => ({
          position: 'absolute', top: 14, right: 14,
          width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
          backgroundColor: pinned ? c.gold : c.paper2, borderWidth: 1, borderColor: pinned ? c.gold : c.line,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon name="pin" size={13} stroke={2} color={pinned ? '#fff' : c.ink4} />
      </Pressable>
    </View>
  );
};
