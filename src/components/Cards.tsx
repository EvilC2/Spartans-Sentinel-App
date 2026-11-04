// Sentinel — Home feed cards, ported from home-bits.jsx.
// -webkit-line-clamp became numberOfLines; CSS grid rows became flex rows.

import React from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { Icon } from './Icon';
import { useTheme } from '../ThemeContext';
import { shadow, tnum, Palette } from '../theme';
import { Page, pageTone } from '../pages';

type C = Palette;

export const tagColor = (tag: string, c: C) =>
  ({
    Athletics: c.crimson,
    Counselling: c.navy700,
    Library: c.moss,
    Music: c.gold,
  } as Record<string, string>)[tag] || c.ink3;

// ────────────────────────────────────────────────────────────────
// Announcement card
// ────────────────────────────────────────────────────────────────
export const AnnouncementCard = ({ a, onPress }: { a: any; onPress?: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        backgroundColor: c.surface,
        borderWidth: 1, borderColor: c.line,
        borderRadius: 18,
        paddingHorizontal: 16, paddingVertical: 14,
        opacity: pressed ? 0.85 : 1,
      }, shadow.sm]}
    >
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 8,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {a.pinned && (
            <View style={{ width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="pin" size={14} stroke={1.8} color={c.gold} />
            </View>
          )}
          <Text style={{
            fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase',
            fontWeight: '700', color: tagColor(a.tag, c),
          }}>
            {a.tag}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: c.ink4 }}>{a.time}</Text>
      </View>

      <Text style={{
        fontSize: 15.5, fontWeight: '600', color: c.ink,
        letterSpacing: -0.2, lineHeight: 20,
      }}>
        {a.title}
      </Text>

      <Text
        numberOfLines={2}
        style={{ fontSize: 13.5, color: c.ink3, marginTop: 6, lineHeight: 19.6 }}
      >
        {a.body}
      </Text>

      <Text style={{ fontSize: 12, color: c.ink4, marginTop: 10 }}>— {a.author}</Text>
    </Pressable>
  );
};

// ────────────────────────────────────────────────────────────────
// Event card (horizontal scroll)
// ────────────────────────────────────────────────────────────────
export const EventCard = ({ e }: { e: any }) => {
  const { c } = useTheme();
  const [, m, d] = (e.date || '').split(' ');
  return (
    <View style={[{
      width: 220,
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1, borderColor: c.line,
      padding: 14,
      flexDirection: 'row', gap: 12,
    }, shadow.sm]}>
      <View style={{
        width: 50, height: 56, borderRadius: 10,
        backgroundColor: c.paper2,
        borderWidth: 1, borderColor: c.line,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{
          fontSize: 9.5, fontWeight: '700', letterSpacing: 1,
          color: c.crimson, textTransform: 'uppercase',
        }}>
          {m}
        </Text>
        <Text style={[{
          fontSize: 22, fontWeight: '600', letterSpacing: -0.5,
          color: c.ink, lineHeight: 24,
        }, tnum]}>
          {d}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 14, fontWeight: '600', color: c.ink,
            lineHeight: 17.5, letterSpacing: -0.2,
          }}
        >
          {e.title}
        </Text>
        <Text style={{ fontSize: 12, color: c.ink3, marginTop: 4 }}>{e.time}</Text>
        <Text style={{ fontSize: 12, color: c.ink4, marginTop: 1 }}>{e.loc}</Text>
      </View>
    </View>
  );
};

export const EventStrip = ({ events }: { events: any[] }) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 4 }}
  >
    {events.map(e => <EventCard key={e.id} e={e} />)}
  </ScrollView>
);

// ────────────────────────────────────────────────────────────────
// Quick link tile — a pinned page from More, in the same tinted fill and
// 3D art as its More tile. `wide` lays it out as a row (art, then label)
// for the two-column grid; otherwise art over label for three columns.
// ────────────────────────────────────────────────────────────────
export const QuickLink = ({ q, wide, onPress }: { q: Page; wide?: boolean; onPress?: () => void }) => {
  const { c, mode } = useTheme();
  const t = pageTone(c, mode, q.tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={q.label}
      style={({ pressed }) => ({
        backgroundColor: t.bg, borderRadius: 20,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        ...(wide
          ? { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 14 }
          : { alignItems: 'center', paddingTop: 14, paddingBottom: 12, paddingHorizontal: 8 }),
      })}
    >
      <Image source={q.art} style={{ width: wide ? 40 : 46, height: wide ? 40 : 46 }} accessibilityIgnoresInvertColors />
      <View style={wide ? { flex: 1, minWidth: 0 } : { marginTop: 8, alignSelf: 'stretch' }}>
        <Text numberOfLines={1} style={{ fontSize: wide ? 15 : 14, fontWeight: '800', letterSpacing: -0.3, color: c.ink, textAlign: wide ? 'left' : 'center' }}>
          {q.label}
        </Text>
      </View>
    </Pressable>
  );
};
