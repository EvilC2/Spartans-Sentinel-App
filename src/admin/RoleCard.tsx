// Spartans — the App Club role card: who you are in the club, at the top of
// App Club. One slim navy strip: your photo, your role in the app's serif, your
// name, and what you're on when that isn't already in the role's name. Rank
// shows in the metal of the photo ring and the role name, nothing else:
//   member     silver ring, white role
//   developer  sky ring, white role
//   manager    gold ring, white role
//   top        gold ring with a gap, gold role (President, Teacher Sponsor)
// A team's 3D art sits on the right.

import React from 'react';
import { View, Text, Image, ImageSourcePropType } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, tnum } from '../theme';
import type { Tier } from '../ranks';

const GOLD = '#E4C27E';
const FINISH: Record<Tier, { ring: string; role: string }> = {
  member: { ring: '#B9C4D2', role: '#FFFFFF' },
  developer: { ring: '#6FB1F2', role: '#FFFFFF' },
  manager: { ring: GOLD, role: '#FFFFFF' },
  top: { ring: GOLD, role: '#F3DDAE' },
};
const NAVY = '#14304E';

export const RoleCard = ({ tier, role, name, sub, foot, photo, initials, art }: {
  tier: Tier; role: string; name: string; sub?: string; foot?: string; photo?: string; initials: string; art?: ImageSourcePropType;
}) => {
  const { mode } = useTheme();
  const f = FINISH[tier];
  const who = [name, sub].filter(Boolean).join(' · ');
  return (
    <View accessible accessibilityRole="summary" accessibilityLabel={[role, who, foot].filter(Boolean).join('. ')}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, backgroundColor: NAVY, borderWidth: 1, borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : NAVY }}>
      <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: f.ring, padding: tier === 'top' ? 3 : 0 }}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ flex: 1, borderRadius: 28, backgroundColor: '#1F4570' }} accessibilityIgnoresInvertColors />
        ) : (
          <View style={{ flex: 1, borderRadius: 28, backgroundColor: '#24507F', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: 0.2 }}>{initials}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.serif, fontSize: 25, lineHeight: 29, letterSpacing: -0.5, color: f.role }}>{role}</Text>
        <Text numberOfLines={1} style={[{ fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.82)', marginTop: 3 }, tnum]}>{who}</Text>
        {!!foot && <Text numberOfLines={2} style={{ fontSize: 13, color: 'rgba(255,255,255,0.66)', marginTop: 2, lineHeight: 18 }}>{foot}</Text>}
      </View>
      {art && <Image source={art} style={{ width: 40, height: 40 }} resizeMode="contain" accessibilityIgnoresInvertColors />}
    </View>
  );
};
