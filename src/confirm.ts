// Spartans — yes/no question that works on phones and the web build.
// RN-web has no Alert, so the web falls back to the browser's confirm().

import { Alert, Platform } from 'react-native';

export const ask = (title: string, message: string, ok: string, destructive = false): Promise<boolean> =>
  new Promise(resolve => {
    if (Platform.OS === 'web') {
      resolve(typeof confirm === 'function' ? confirm(`${title}\n\n${message}`) : true);
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
