// Spartans — who's with you: opened from "with Sam +2" on Home and the Today
// together cards on Social. One row per friend in that block; tap one for their
// card. Shows only what a friend's card already would (the block you share).

import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Avatar } from './Avatar';
import { BottomSheet, SheetScroll } from './BottomSheet';
import { Icon } from './Icon';
import { Friend, fullName, peerInitials } from '../social';

export type With = { title: string; sub: string; people: { friend: Friend; spare: boolean }[] };

export const WithSheet = ({ open, onClose, onFriend }: { open: With | null; onClose: () => void; onFriend: (f: Friend) => void }) => {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  // Keep the last list while the sheet slides away.
  const last = React.useRef<With | null>(open);
  if (open) last.current = open;
  const w = open || last.current;
  return (
    <BottomSheet visible={!!open} onClose={onClose} style={[{ maxHeight: Math.round(height * 0.7), backgroundColor: c.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' }, shadow.lg]}>
      <View style={{ alignItems: 'center', paddingTop: 10 }}>
        <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" numberOfLines={2} style={{ fontFamily: fonts.serif, fontSize: 25, lineHeight: 30, letterSpacing: -0.5, color: c.ink }}>{w?.title}</Text>
          {!!w?.sub && <Text numberOfLines={1} style={[{ fontSize: 14, color: c.ink3, marginTop: 2 }, tnum]}>{w.sub}</Text>}
        </View>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close"
          style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
          <Icon name="close" size={16} stroke={2.2} color={c.ink2} />
        </Pressable>
      </View>
      <SheetScroll style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[{ backgroundColor: c.surface, borderRadius: 18, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, shadow.sm]}>
          {w?.people.map(({ friend: f, spare }, i) => (
            <Pressable key={f.id} onPress={() => onFriend(f)} accessibilityRole="button" accessibilityLabel={`${fullName(f)}, grade ${f.grade}${spare ? ', has a spare too' : ''}`} accessibilityHint="Opens their card"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
              <Avatar spec={f.avatar} uri={f.photo} initials={peerInitials(f)} size={42} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '700', letterSpacing: -0.2, color: c.ink }}>{fullName(f)}</Text>
                <Text numberOfLines={1} style={{ fontSize: 13.5, color: c.ink3, marginTop: 1 }}>Grade {f.grade}{spare ? ' · has a spare too' : ''}</Text>
              </View>
              <Icon name="chev-r" size={14} stroke={2} color={c.ink3} />
            </Pressable>
          ))}
        </View>
      </SheetScroll>
    </BottomSheet>
  );
};
