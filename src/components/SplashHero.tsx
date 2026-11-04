// Spartans — the splash art shared by the app loading screen and the sign up /
// sign in start screen: silver Spartan head, "Sentinel Secondary · Spartans ·
// The Unofficial App", on a blue that is lightest in the middle and darkens to
// navy at the edges. expo-linear-gradient is linear only, so the radial look is
// two crossed vignettes (top/bottom and left/right) over a flat lighter blue.

import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '../theme';
import { BRAND } from './Chrome';

export const SPLASH_CENTER = '#2C5C94';   // lighter blue, middle
export const SPLASH_EDGE = '#0E2238';     // navy900, edges
const EDGE_CLEAR = 'rgba(14,34,56,0)';    // same navy, fully transparent (no grey fade)
const SILVER = '#CFD3DA';

export const SplashBackground = ({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flex: 1, backgroundColor: SPLASH_CENTER }, style]}>
    <LinearGradient
      pointerEvents="none"
      colors={[SPLASH_EDGE, EDGE_CLEAR, EDGE_CLEAR, SPLASH_EDGE]}
      locations={[0, 0.38, 0.62, 1]}
      style={StyleSheet.absoluteFill}
    />
    <LinearGradient
      pointerEvents="none"
      colors={[SPLASH_EDGE, EDGE_CLEAR, EDGE_CLEAR, SPLASH_EDGE]}
      locations={[0, 0.3, 0.7, 1]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={StyleSheet.absoluteFill}
    />
    {children}
  </View>
);

// Silver Spartan head: the flat white head tinted silver, with a soft shadow
// so it sits off the blue.
export const SilverSpartan = ({ size = 112 }: { size?: number }) => (
  <Image
    source={BRAND.white}
    accessibilityLabel="Spartans"
    resizeMode="contain"
    style={{
      width: size, height: size, tintColor: SILVER,
      shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
    }}
  />
);

export const SplashTitle = () => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', fontWeight: '600' }}>
      Sentinel Secondary
    </Text>
    <Text style={{ fontFamily: fonts.serif, fontSize: 44, color: '#fff', marginTop: 4, textAlign: 'center', letterSpacing: -1 }}>
      Spartans
    </Text>
    <Text style={{ fontFamily: 'Newsreader_400Regular_Italic', fontSize: 15, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
      The Unofficial App
    </Text>
  </View>
);

// Shown while the profile / session is still loading from disk: the same art,
// centred, no buttons.
export const LoadingSplash = () => (
  <SplashBackground style={{ alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ alignItems: 'center' }}>
      <View style={{ marginBottom: 28 }}><SilverSpartan /></View>
      <SplashTitle />
    </View>
  </SplashBackground>
);
