// Spartans — "this one": a wash of sky over the thing a notification opened,
// held for a moment and faded out, so the eye lands on it. Sits inside the row
// or card it marks (which needs to be the positioned parent).
//
// useReveal scrolls that row into view: give it the row's ref and the screen's
// scroller, and it runs once when `on` turns true.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeContext';

export const Spot = ({ on, radius = 0, inset = 0 }: { on: boolean; radius?: number; inset?: number }) => {
  const { mode } = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(on);
  useEffect(() => {
    if (!on) return;
    setShow(true);
    a.setValue(0);
    const run = Animated.sequence([
      Animated.delay(260),
      Animated.timing(a, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1300),
      Animated.timing(a, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]);
    run.start(({ finished }) => { if (finished) setShow(false); });
    return () => run.stop();
  }, [on, a]);
  if (!show) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
      left: inset, right: inset, borderRadius: radius, opacity: a,
      backgroundColor: mode === 'dark' ? 'rgba(143,189,240,0.18)' : 'rgba(59,139,217,0.15)',
    }]} />
  );
};

// Where a screen's ScrollView is, so a row can ask to be brought into view.
// `y` is kept up to date from onScroll.
export const useScrollSpot = () => {
  const ref = useRef<ScrollView>(null);
  const y = useRef(0);
  const frame = useRef<View>(null);
  // Puts `node` about a third of the way down the list.
  const bring = (node: View | null) => {
    if (!node || !frame.current) return;
    frame.current.measureInWindow((_fx, fy, _fw, fh) => {
      node.measureInWindow((_x, ny, _w, nh) => {
        const want = fy + Math.max(90, (fh - nh) * 0.33);
        ref.current?.scrollTo({ y: Math.max(0, y.current + ny - want), animated: true });
      });
    });
  };
  return {
    ref, frame, bring,
    onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => { y.current = e.nativeEvent.contentOffset.y; },
  };
};

// Runs `bring` once when `on` turns true, after the row has been laid out.
export const useReveal = (on: boolean, node: React.RefObject<View | null>, bring: (n: View | null) => void, wait = 320) => {
  const go = useRef(bring);
  go.current = bring;
  useEffect(() => {
    if (!on) return;
    const t = setTimeout(() => go.current(node.current), wait);
    return () => clearTimeout(t);
  }, [on, node, wait]);
};
