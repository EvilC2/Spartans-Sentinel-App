// Height of the on-screen keyboard, 0 when hidden. Bottom sheets use it to sit
// on top of the keyboard and shrink to fit the space above it, so the search
// box and what you type stay visible.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export const useKeyboardHeight = () => {
  const [h, setH] = useState(0);
  useEffect(() => {
    // Android resizes the window for the keyboard on its own; web has no event.
    if (Platform.OS !== 'ios') return;
    const a = Keyboard.addListener('keyboardWillShow', e => setH(e.endCoordinates.height));
    const b = Keyboard.addListener('keyboardWillHide', () => setH(0));
    return () => { a.remove(); b.remove(); };
  }, []);
  return h;
};

// Sheet height: the usual share of the screen, capped to the room above the
// keyboard minus a strip at the top so the sheet never runs off-screen.
export const sheetHeight = (screen: number, keyboard: number, share = 0.88, top = 60) =>
  Math.round(Math.min(screen * share, screen - keyboard - top));

// Whether the keyboard is up, on iOS and Android both (web: always false).
// For screens that rearrange themselves while typing rather than just pad.
export const useKeyboardShown = () => {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(show, () => setOn(true));
    const b = Keyboard.addListener(hide, () => setOn(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return on;
};
