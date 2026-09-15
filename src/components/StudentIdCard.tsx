// Sentinel — digital student ID card, modelled on the physical Artona card:
//   crest · ÉCOLE SECONDAIRE SENTINEL SECONDARY SCHOOL · Principal
//   LASTNAME, FIRSTNAME · GR · HR · STU # · "STUDENT IDENTIFICATION 2026/2027"
//   portrait on the right · Code 39 barcode along the bottom.
// Tap to flip: the back carries the QR (Artona portrait link once scanned,
// else the student number) and the Compass concession note, like the real one.

import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Easing, Image, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Circle, Defs, RadialGradient, Stop, Path } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, G165, G155 } from '../theme';
import { SentinelCrest, SentinelCrestLarge } from '../components/Crest';
import { StudentProfile, initials as initialsOf, homeroom, courseAt, HOMEROOM_SLOT } from '../ProfileContext';
import { code39, codeForTeacher } from '../idScan';
import { SCHOOL_YEAR } from '../calendar';
import { STAFF } from '../staff';

const PRINCIPAL = (() => {
  const p = STAFF.find(s => s.group === 'admin' && /^Principal/.test(s.role));
  return p ? `Mr. ${p.first[0]}. ${p.last}` : '';
})();
const ID_YEAR = SCHOOL_YEAR.label.replace(/[–-]/, '/');   // "2026/2027" like the sticker

export const cardName = (p: StudentProfile) =>
  [p.lastName, p.firstName].filter(Boolean).map(s => s.toUpperCase()).join(', ') || 'STUDENT';

export const cardHomeroom = (p: StudentProfile) => {
  const hr = courseAt(p, HOMEROOM_SLOT);
  const code = codeForTeacher(hr?.teacher || '');
  const room = homeroom(p);
  return [code, room].filter(Boolean).join('-') || '—';
};

// ────────────────────────────────────────────────────────────────
export const StudentIdCard = ({ p }: { p: StudentProfile }) => {
  const { width } = useWindowDimensions();
  const flip = useRef(new Animated.Value(0)).current;
  const [back, setBack] = useState(false);

  const toggle = () => {
    const to = back ? 0 : 1;
    setBack(!back);
    Animated.timing(flip, { toValue: to, duration: 520, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
  };
  const frontRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRot = flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const frontOp = flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });
  const backOp = flip.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });

  const w = Math.min(width, 430) - 40;
  const h = w / 1.586;

  return (
    <Pressable onPress={toggle} style={{ width: w, height: h, alignSelf: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: w, height: h, opacity: frontOp, backfaceVisibility: 'hidden', transform: [{ perspective: 1200 }, { rotateY: frontRot }] }}>
        <Front p={p} w={w} h={h} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', width: w, height: h, opacity: backOp, backfaceVisibility: 'hidden', transform: [{ perspective: 1200 }, { rotateY: backRot }] }}>
        <Back p={p} w={w} h={h} />
      </Animated.View>
    </Pressable>
  );
};

// ── Front ───────────────────────────────────────────────────────
const Front = ({ p, w, h }: { p: StudentProfile; w: number; h: number }) => {
  const { c } = useTheme();
  const stripH = Math.round(h * 0.2);
  const photoH = Math.round(h * 0.5);
  const photoW = Math.round(photoH * 0.78);
  return (
    <LinearGradient
      colors={[c.navy700, c.navy900]}
      start={G165.start}
      end={G165.end}
      style={[{ flex: 1, borderRadius: 20, overflow: 'hidden' }, shadow.lg]}
    >
      {/* Skyline wash — nod to the school photo behind the name on the real card */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: stripH }}>
        <Svg width="100%" height="100%" viewBox="0 0 320 140" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="idGlow" cx="18%" cy="90%" r="75%">
              <Stop offset="0" stopColor="#5B8BC4" stopOpacity={0.35} />
              <Stop offset="1" stopColor="#5B8BC4" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={320} height={140} fill="url(#idGlow)" />
          <Path d="M0 118 L40 104 L70 110 L110 92 L150 100 L180 86 L215 96 L250 84 L290 94 L320 82 L320 140 L0 140 Z" fill="#fff" opacity={0.045} />
        </Svg>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: -30, top: 40, opacity: 0.07 }}>
        <SentinelCrestLarge color="#fff" size={h * 0.85} />
      </View>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 11, paddingHorizontal: 14, gap: 9 }}>
        <SentinelCrest size={24} color="#fff" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 8.5, letterSpacing: 0.9, textTransform: 'uppercase', fontWeight: '700', color: '#fff' }}>
            École Secondaire Sentinel Secondary School
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 8, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
            Principal: {PRINCIPAL || '—'} · West Vancouver
          </Text>
        </View>
      </View>

      {/* Identity band */}
      <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: 14, paddingTop: 10, gap: 10, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 19, fontWeight: '800', letterSpacing: 0.4, color: '#fff', lineHeight: 22 }}>
            {cardName(p)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            <Stat k="GR" v={String(p.grade)} />
            <Stat k="HR" v={cardHomeroom(p)} />
            <Stat k="STU #" v={p.studentId || '—'} />
          </View>
          <View style={{ alignSelf: 'flex-start', marginTop: 9, backgroundColor: '#7A4E8C', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
            <Text style={{ fontSize: 6.5, letterSpacing: 1.3, textTransform: 'uppercase', fontWeight: '700', color: 'rgba(255,255,255,0.85)' }}>Student identification</Text>
            <Text style={[{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.5, marginTop: 1 }, tnum]}>{ID_YEAR}</Text>
          </View>
        </View>
        <Portrait p={p} w={photoW} h={photoH} />
      </View>

      {/* Barcode strip — light like the printed card */}
      <View style={{ height: stripH, backgroundColor: '#F6F3EC', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Code39 value={p.studentId || '0000000'} height={stripH - 16} />
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 7.5, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700', color: '#8A93A0' }}>Expires</Text>
          <Text style={[{ fontSize: 10.5, fontWeight: '700', color: '#0E2238', fontFamily: fonts.mono }, tnum]}>Jun {SCHOOL_YEAR.end.slice(0, 4)}</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const Stat = ({ k, v }: { k: string; v: string }) => (
  <View>
    <Text style={{ fontSize: 7, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>{k}</Text>
    <Text style={[{ fontSize: 12, fontWeight: '700', color: '#fff', fontFamily: fonts.mono, marginTop: 1 }, tnum]}>{v}</Text>
  </View>
);

// Portrait: the student's photo, else initials on the warm gradient.
export const Portrait = ({ p, w, h, round }: { p: StudentProfile; w: number; h: number; round?: boolean }) => {
  const radius = round ? w / 2 : 10;
  if (p.photoUri) {
    return (
      <View style={[{ width: w, height: h, borderRadius: radius, overflow: 'hidden', borderWidth: 1.5, borderColor: '#fff', backgroundColor: '#1A3A5C' }, shadow.md]}>
        <Image source={{ uri: p.photoUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={['#B68842', '#8C6328']}
      start={G155.start}
      end={G155.end}
      style={[{ width: w, height: h, borderRadius: radius, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: '#fff' }, shadow.md]}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <RadialGradient id="sheenP" cx="30%" cy="25%" r="55%">
              <Stop offset="0" stopColor="#fff" stopOpacity={0.25} />
              <Stop offset="1" stopColor="#fff" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={50} cy={50} r={60} fill="url(#sheenP)" />
        </Svg>
      </View>
      <Text style={{ fontFamily: fonts.serif, color: '#fff', fontSize: Math.min(w, h) * 0.42, letterSpacing: -0.5 }}>{initialsOf(p)}</Text>
    </LinearGradient>
  );
};

// Real Code 39, black on the light strip, number underneath.
const Code39 = ({ value, height }: { value: string; height: number }) => {
  const { bars, width } = code39(value);
  return (
    <View style={{ flex: 1 }}>
      <Svg width="100%" height={height - 12} viewBox={`0 0 ${width} 20`} preserveAspectRatio="none">
        {bars.map((b, i) => <Rect key={i} x={b.x} y={0} width={b.w} height={20} fill="#0F1419" />)}
      </Svg>
      <Text style={[{ fontSize: 8.5, letterSpacing: 3, color: '#2C3239', fontFamily: fonts.mono, marginTop: 2, textAlign: 'center' }, tnum]}>{value}</Text>
    </View>
  );
};

// ── Back ────────────────────────────────────────────────────────
const Back = ({ p, w, h }: { p: StudentProfile; w: number; h: number }) => {
  const { c } = useTheme();
  const qr = Math.round(h * 0.62);
  const value = p.artonaUrl || p.studentId || 'sentinel';
  return (
    <LinearGradient
      colors={[c.navy900, c.navy700]}
      start={G165.start}
      end={G165.end}
      style={[{ flex: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 }, shadow.lg]}
    >
      <View style={{ backgroundColor: '#fff', padding: 7, borderRadius: 10 }}>
        <QRCode value={value} size={qr} color="#0E2238" backgroundColor="#fff" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 8, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: 'rgba(255,255,255,0.5)' }}>
          {p.artonaUrl ? 'Scan to view and order your portrait' : 'Student number'}
        </Text>
        <Text style={[{ fontSize: 18, fontWeight: '800', color: '#fff', fontFamily: fonts.mono, marginTop: 3 }, tnum]}>ID: {p.studentId || '—'}</Text>
        <Text style={{ fontSize: 9.5, lineHeight: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
          This is a valid student identification card issued by Sentinel Secondary for TransLink's Compass Concession Card.
        </Text>
        <Text style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
          {p.artonaUrl ? 'Portrait link saved from the back of your card.' : 'Scan the back of your card in Me › Edit profile to link your portrait.'}
        </Text>
      </View>
    </LinearGradient>
  );
};
