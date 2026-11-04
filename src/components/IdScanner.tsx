// Sentinel — full-screen camera sheet for reading the student ID card.
//   mode 'card'    → reads the Code 39 barcode (student number) and, on builds
//                    that have on-device OCR, snaps the card and reads the
//                    name / grade / homeroom lines too.
//   mode 'barcode' → student number only.
//   mode 'qr'      → the QR on the back of the card (Artona portrait link).
// Works in Expo Go for barcodes/QR; OCR needs a dev build (see idScan.ts).

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult, BarcodeType } from 'expo-camera';
import { useTheme } from '../ThemeContext';
import { fonts } from '../theme';
import { Icon } from './Icon';
import { isStudentNumber, ocrAvailable, recognizeText, parseCardText, ScannedCard } from '../idScan';

export type ScanMode = 'card' | 'barcode' | 'qr';
export type ScanResult = {
  raw: string;                 // barcode / QR payload
  card?: ScannedCard;          // parsed fields (card mode)
  ocrRan?: boolean;            // false when OCR is unavailable on this build
};

type Props = {
  visible: boolean;
  mode: ScanMode;
  onResult: (r: ScanResult) => void;
  onClose: () => void;
  hint?: string;               // replaces the line under the frame
};

const ONE_D: BarcodeType[] = ['code39', 'code128', 'code93', 'itf14', 'codabar', 'ean13', 'upc_a'];

export default function IdScanner({ visible, mode, onResult, onClose, hint: hintText }: Props) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const [perm, requestPerm] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cam = useRef<CameraView>(null);
  const locked = useRef(false);

  useEffect(() => {
    if (!visible) { locked.current = false; setStatus(null); setBusy(false); setTorch(false); }
  }, [visible]);

  useEffect(() => {
    if (visible && perm && !perm.granted && perm.canAskAgain) requestPerm();
  }, [visible, perm, requestPerm]);

  const finish = (r: ScanResult) => { onResult(r); };

  // Snap the card and run OCR. Called after a barcode lands (card mode) or
  // from the shutter button when the barcode will not read.
  const readCard = async (raw: string) => {
    if (!ocrAvailable) {
      finish({ raw, card: isStudentNumber(raw) ? { studentId: raw } : {}, ocrRan: false });
      return;
    }
    setBusy(true);
    setStatus('Reading the card…');
    try {
      const pic = await cam.current?.takePictureAsync({ quality: 0.8, skipProcessing: true });
      const lines = pic?.uri ? await recognizeText(pic.uri) : null;
      const card = lines ? parseCardText(lines) : {};
      if (isStudentNumber(raw)) card.studentId = raw;   // barcode beats OCR for the number
      finish({ raw, card, ocrRan: !!lines });
    } catch {
      finish({ raw, card: isStudentNumber(raw) ? { studentId: raw } : {}, ocrRan: false });
    } finally {
      setBusy(false);
    }
  };

  const onScanned = (e: BarcodeScanningResult) => {
    if (locked.current || !visible) return;
    const data = (e.data || '').trim();
    if (!data) return;
    if (mode === 'qr') {
      locked.current = true;
      finish({ raw: data });
      return;
    }
    if (!isStudentNumber(data)) return;   // ignore stray barcodes (Compass card etc.)
    locked.current = true;
    if (mode === 'barcode') { finish({ raw: data, card: { studentId: data } }); return; }
    readCard(data);
  };

  const shutter = () => {
    if (locked.current) return;
    locked.current = true;
    readCard('');
  };

  // Card-shaped cut-out. The physical card is 85.6 × 54 mm.
  const frameW = Math.min(width - 48, 380);
  const frameH = mode === 'qr' ? frameW * 0.75 : frameW / 1.586;
  const top = Math.max(120, (height - frameH) / 2 - 40);

  const hint = hintText ? hintText : mode === 'qr'
    ? 'Flip your card over and line up the QR code.'
    : mode === 'barcode'
      ? 'Line up the barcode along the bottom of your card.'
      : ocrAvailable
        ? 'Line up the front of your student ID. It reads on its own.'
        : 'Line up the barcode on your card. This build reads the number only — the rest you can type.';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {perm?.granted ? (
          <CameraView
            ref={cam}
            style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: mode === 'qr' ? ['qr'] : ONE_D }}
            onBarcodeScanned={busy ? undefined : onScanned}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Icon name="camera" size={40} stroke={1.4} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center', marginTop: 16, lineHeight: 22 }}>
              {perm?.canAskAgain === false
                ? 'Camera access is off for Sentinel. Turn it on in Settings to scan your card.'
                : 'Sentinel needs the camera to read your student ID card.'}
            </Text>
            {perm?.canAskAgain !== false && (
              <Pressable onPress={requestPerm} style={{ marginTop: 18, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999, backgroundColor: '#fff' }}>
                <Text style={{ color: c.navy900, fontWeight: '700' }}>Allow camera</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Dim everything except the card window */}
        {perm?.granted && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
            <View style={{ height: top, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            <View style={{ flexDirection: 'row', height: frameH }}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
              <View style={{ width: frameW, borderRadius: 16, borderWidth: 2, borderColor: busy ? c.gold : 'rgba(255,255,255,0.9)' }}>
                {mode !== 'qr' && (
                  <View style={{ position: 'absolute', left: 14, right: 14, bottom: 10, height: 3, borderRadius: 2, backgroundColor: busy ? c.gold : 'rgba(255,255,255,0.7)' }} />
                )}
              </View>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
          </View>
        )}

        {/* Top bar */}
        <View style={{ position: 'absolute', top: Platform.OS === 'ios' ? 56 : 28, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <RoundBtn icon="close" onPress={onClose} />
          <Text style={{ color: '#fff', fontFamily: fonts.serif, fontSize: 18 }}>
            {mode === 'qr' ? 'Back of card' : 'Student ID'}
          </Text>
          <RoundBtn icon="flash" onPress={() => setTorch(t => !t)} on={torch} />
        </View>

        {/* Bottom: hint + status + shutter */}
        <View style={{ position: 'absolute', left: 24, right: 24, bottom: Platform.OS === 'ios' ? 48 : 28, alignItems: 'center' }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>{hint}</Text>
          {busy && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <ActivityIndicator color={c.gold} />
              <Text style={{ color: c.gold, fontSize: 13, fontWeight: '600' }}>{status}</Text>
            </View>
          )}
          {mode === 'card' && ocrAvailable && perm?.granted && !busy && (
            <Pressable
              onPress={shutter}
              style={({ pressed }) => ({ marginTop: 18, width: 66, height: 66, borderRadius: 33, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
            >
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff' }} />
            </Pressable>
          )}
          {mode === 'card' && ocrAvailable && (
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 8 }}>Barcode not reading? Tap the shutter.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const RoundBtn = ({ icon, onPress, on }: { icon: 'close' | 'flash'; onPress: () => void; on?: boolean }) => (
  <Pressable
    onPress={onPress}
    hitSlop={8}
    style={({ pressed }) => ({
      width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
      backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.18)', opacity: pressed ? 0.7 : 1,
    })}
  >
    <Icon name={icon} size={18} stroke={2} color={on ? '#0E2238' : '#fff'} />
  </Pressable>
);
