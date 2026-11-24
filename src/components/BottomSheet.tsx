// Spartans — the bottom sheet every slide-up menu uses. Swipe down anywhere on
// it and the whole sheet follows your finger: let go low enough (or flick) and
// it closes, otherwise it springs back. Tapping the dimmed page closes it too.
//
// A list inside the sheet must be a SheetScroll. While that list is scrolled
// down, a downward swipe scrolls it as usual; once it reaches its top, the same
// swipe carries on into the sheet. (SheetScroll turns off the bounce at the top,
// so the content can't stretch away from the sheet while the sheet stands still.)
//
// The drag reads plain touch events, not the responder system, on purpose:
//   • RN's Modal becomes the responder for any touch that isn't on a button, and
//     then nothing inside it is asked about the move.
//   • A view above a ScrollView that does claim the touch stops it scrolling.
// The PanResponder is only there to cancel a button's press once a drag starts.
//
// Modals opened from the sheet go in `over`, not `children`: touches in a nested
// Modal pass through its React parents, so a swipe there would drag this sheet.
//
// Full-height pages use RN's pageSheet Modal with `allowSwipeDismissal`, where
// iOS does all of this itself.

import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, GestureResponderEvent, Modal, NativeScrollEvent, NativeSyntheticEvent, PanResponder,
  Pressable, ScrollView, ScrollViewProps, StyleProp, StyleSheet, View, ViewStyle,
} from 'react-native';

const START = 8;          // pt of downward travel before the sheet takes the touch
const FLICK = 0.75;       // pt per ms
const BOUNCE_FROM = 48;   // the list bounces again once it's this far from its top

type SheetApi = { setTop: (y: number) => void; setLocked: (on: boolean) => void };
const SheetCtx = createContext<SheetApi>({ setTop: () => {}, setLocked: () => {} });

// One touch: where it started, the latest two points (for speed), and whether
// it is still being watched, is dragging the sheet, or is none of our business.
type Touch = { state: 'watch' | 'drag' | 'off'; x: number; y: number; from: number; lastY: number; lastT: number; v: number };

export const BottomSheet = ({ visible = true, onClose, bottom = 0, dim = 0.35, style, over, children }: {
  visible?: boolean; onClose: () => void; bottom?: number; dim?: number; style?: StyleProp<ViewStyle>; over?: React.ReactNode; children: React.ReactNode;
}) => {
  const y = useRef(new Animated.Value(0)).current;
  const [h, setH] = useState(0);
  const height = useRef(0);
  const listTop = useRef(0);      // how far the list inside is scrolled
  const locked = useRef(false);   // a row is being dragged to a new place
  const leaving = useRef(false);
  const touch = useRef<Touch | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  // A dragged-away sheet stays parked off screen until it opens again.
  useLayoutEffect(() => {
    if (!visible) return;
    leaving.current = false;
    locked.current = false;
    touch.current = null;
    listTop.current = 0;
    y.setValue(0);
  }, [visible, y]);

  const settle = () => Animated.spring(y, { toValue: 0, useNativeDriver: true, speed: 22, bounciness: 0 }).start();
  const leave = () => {
    leaving.current = true;
    Animated.timing(y, { toValue: height.current || 600, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: true })
      .start(() => close.current());
  };

  const begin = (e: GestureResponderEvent) => {
    const n = e.nativeEvent;
    // A second finger calls it off.
    if (n.touches.length > 1) { if (touch.current?.state === 'drag') settle(); touch.current = null; return; }
    if (leaving.current) return;
    touch.current = { state: 'watch', x: n.pageX, y: n.pageY, from: n.pageY, lastY: n.pageY, lastT: n.timestamp, v: 0 };
  };
  const move = (e: GestureResponderEvent) => {
    const t = touch.current;
    if (!t || t.state === 'off' || leaving.current) return;
    const n = e.nativeEvent;
    if (n.timestamp > t.lastT) t.v = (n.pageY - t.lastY) / (n.timestamp - t.lastT);
    t.lastY = n.pageY;
    t.lastT = n.timestamp;
    if (t.state === 'watch') {
      const dx = Math.abs(n.pageX - t.x);
      if (locked.current || (dx > START && dx > Math.abs(n.pageY - t.y))) { t.state = 'off'; return; }
      // Still scrolling the list: the sheet starts from where the list runs out.
      if (listTop.current > 1) { t.from = n.pageY; return; }
      if (n.pageY - t.from < START) { t.from = Math.min(t.from, n.pageY); return; }
      t.state = 'drag';
      t.from = n.pageY;
    }
    y.setValue(Math.max(0, n.pageY - t.from));
  };
  const end = (e: GestureResponderEvent) => {
    const t = touch.current;
    touch.current = null;
    if (!t || t.state !== 'drag' || leaving.current) return;
    const d = t.lastY - t.from;
    // Held still before letting go: that's not a flick.
    const v = e.nativeEvent.timestamp - t.lastT > 90 ? 0 : t.v;
    if (d > Math.min(140, (height.current || 600) * 0.28) || (v > FLICK && d > 12)) leave();
    else settle();
  };
  const cancel = () => {
    const t = touch.current;
    touch.current = null;
    if (t?.state === 'drag' && !leaving.current) settle();
  };

  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => touch.current?.state === 'drag',
    onPanResponderTerminationRequest: () => false,
  })).current;

  const api = useMemo<SheetApi>(() => ({
    setTop: v => { listTop.current = v; },
    setLocked: on => { locked.current = on; },
  }), []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, {
        backgroundColor: `rgba(14,34,56,${dim})`,
        opacity: y.interpolate({ inputRange: [0, Math.max(1, h)], outputRange: [1, 0], extrapolate: 'clamp' }),
      }]}>
        <Pressable onPress={onClose} style={{ flex: 1 }} accessibilityLabel="Close" />
      </Animated.View>
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom }}>
        <Animated.View
          {...pan.panHandlers}
          onTouchStart={begin}
          onTouchMove={move}
          onTouchEnd={end}
          onTouchCancel={cancel}
          onLayout={e => { height.current = e.nativeEvent.layout.height + bottom; setH(height.current); }}
          style={[style, { transform: [{ translateY: y }] }]}
        >
          <SheetCtx.Provider value={api}>{children}</SheetCtx.Provider>
        </Animated.View>
      </View>
      {over}
    </Modal>
  );
};

// The list inside a BottomSheet. Takes everything a ScrollView does.
export const SheetScroll = ({ onScroll, contentContainerStyle, scrollEnabled = true, children, ref, ...props }: ScrollViewProps & { ref?: React.Ref<ScrollView> }) => {
  const sheet = useContext(SheetCtx);
  const [bounces, setBounces] = useState(false);
  useEffect(() => { sheet.setLocked(!scrollEnabled); }, [sheet, scrollEnabled]);
  const track = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const top = e.nativeEvent.contentOffset.y;
    sheet.setTop(top);
    setBounces(top > BOUNCE_FROM);
  };
  return (
    <ScrollView
      {...props}
      ref={ref}
      scrollEnabled={scrollEnabled}
      // Short content still fills the list: the bare part of a ScrollView below
      // its content gives JS no touches, so a drag there wouldn't move the sheet.
      contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
      bounces={bounces}
      overScrollMode="never"
      scrollEventThrottle={16}
      onScroll={e => { track(e); onScroll?.(e); }}
      // The throttle can drop the last event, which is the one that says "top".
      onScrollEndDrag={track}
      onMomentumScrollEnd={track}
    >
      {children}
    </ScrollView>
  );
};
