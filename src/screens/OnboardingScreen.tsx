// Spartans — sign up / sign in.
// Splash ("Spartans · Sentinel Secondary's unofficial app", Sign up / Sign in) →
//   Sign up: 1 About you (or scan the student ID card) · 2 School email, password, student # ·
//     3 ID photo · 4 Day 1 blocks · 5 Day 2 blocks · 6 Classes outside the timetable · 7 Review.
//   Sign in: school email or student number (barcode scan works too) + password. Checks the
//     account saved on this device; sessions persist until Sign out.
//   Deliberately plain: function over looks. Re-used from Settings to edit.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Animated, Easing, Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../ThemeContext';
import { fonts } from '../theme';
import { SentinelCrestLarge } from '../components/Crest';
import { SpartanMark } from '../components/Chrome';
import {
  StudentProfile, emptyProfile, Slot, SLOTS, HOMEROOM_SLOT, Course, ExtraCourse, useProfile,
  fullName, EMAIL_DOMAIN, isValidEmailLocal, roomProblem, normalizeRoom, matchRooms, roomShort,
} from '../ProfileContext';
import { hashPassword, MIN_PASSWORD } from '../auth';
import { matchCourses, matchExtras, matchTeachers, teacherLabel } from '../catalog';
import { Icon } from '../components/Icon';
import IdScanner, { ScanMode, ScanResult } from '../components/IdScanner';
import { Portrait } from '../components/StudentIdCard';
import { ocrAvailable, persistPhoto } from '../idScan';

type Props = {
  initial?: StudentProfile | null;
  onDone: () => void;
  onCancel?: () => void;   // only offered when editing an existing profile
  topInset: number;
};

const GRADES = [8, 9, 10, 11, 12];
const PRONOUNS = ['he/him', 'she/her', 'they/them'];
const STEPS = ['about', 'school', 'photo', 'day1', 'day2', 'extras', 'review'] as const;
type StepId = typeof STEPS[number];

// ════════════════════════════════════════════════════════════════
export default function OnboardingScreen({ initial, onDone, onCancel, topInset }: Props) {
  const [mode, setMode] = useState<'splash' | 'signup' | 'signin'>(initial ? 'signup' : 'splash');
  if (mode === 'splash') return <Splash topInset={topInset} onEnter={m => setMode(m)} />;
  if (mode === 'signin') return <SignIn topInset={topInset} onDone={onDone} onBack={() => setMode('splash')} />;
  return (
    <Questionnaire
      initial={initial}
      onDone={onDone}
      onCancel={onCancel}
      onBackToStart={initial ? undefined : () => setMode('splash')}
      topInset={topInset}
    />
  );
}

// ────────────────────────────────────────────────────────────────
// Splash — crest + school name + Enter. Enter plays a short animation
// (crest swells, card lifts, everything fades) and then hands off.
// ────────────────────────────────────────────────────────────────
const Splash = ({ topInset, onEnter }: { topInset: number; onEnter: (m: 'signup' | 'signin') => void }) => {
  const { c } = useTheme();
  const t = useRef(new Animated.Value(0)).current;   // 0 idle → 1 exiting
  const intro = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [intro]);

  const enter = (m: 'signup' | 'signin') => {
    if (busy) return;
    setBusy(true);
    Animated.timing(t, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })
      .start(() => onEnter(m));
  };

  const crestScale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const fade = t.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.2, 0] });
  const rise = t.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const introRise = intro.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  return (
    <View style={{ flex: 1, backgroundColor: c.navy900, alignItems: 'center', justifyContent: 'center', paddingTop: topInset }}>
      <Animated.View style={{ alignItems: 'center', opacity: Animated.multiply(intro, fade), transform: [{ translateY: Animated.add(introRise, rise) }] }}>
        <Animated.View style={{ transform: [{ scale: crestScale }], marginBottom: 28 }}>
          <SpartanMark size={72} color="#fff" />
        </Animated.View>
        <Text style={{ fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: '600' }}>
          Sentinel Secondary
        </Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 44, color: '#fff', marginTop: 4, textAlign: 'center', letterSpacing: -1 }}>
          Spartans
        </Text>
        <Text style={{ fontFamily: 'Newsreader_400Regular_Italic', fontSize: 15, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
          Sentinel Secondary's unofficial app
        </Text>
        <View style={{ marginTop: 14, opacity: 0.35 }}>
          <SentinelCrestLarge color="#fff" size={26} />
        </View>
        <Pressable
          onPress={() => enter('signup')}
          style={({ pressed }) => ({
            marginTop: 40, paddingVertical: 14, width: 220, borderRadius: 999, alignItems: 'center',
            backgroundColor: '#fff', opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: c.navy900, fontSize: 16, fontWeight: '700', letterSpacing: 0.4 }}>Sign up</Text>
        </Pressable>
        <Pressable
          onPress={() => enter('signin')}
          style={({ pressed }) => ({
            marginTop: 12, paddingVertical: 13, width: 220, borderRadius: 999, alignItems: 'center',
            borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.4 }}>Sign in</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
};

// ────────────────────────────────────────────────────────────────
// Questionnaire
// ────────────────────────────────────────────────────────────────
const Questionnaire = ({ initial, onDone, onCancel, onBackToStart, topInset }: Props & { onBackToStart?: () => void }) => {
  const { c } = useTheme();
  const { save } = useProfile();
  const [p, setP] = useState<StudentProfile>(() => initial
    ? { ...initial, courses: initial.courses.map(x => ({ ...x })), extraCourses: initial.extraCourses.map(x => ({ ...x })) }
    : emptyProfile());
  const [i, setI] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [emailLocal, setEmailLocal] = useState(() => (initial?.email || '').split('@')[0]);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [flash, setFlash] = useState(0);   // bumps to play the scan-success animation
  const emailRef = useRef<TextInput>(null);
  const [scan, setScan] = useState<ScanMode | null>(null);
  const [note, setNote] = useState<string | null>(null);   // "Filled from your card: …"
  const step: StepId = STEPS[i];

  const set = (patch: Partial<StudentProfile>) => setP(x => ({ ...x, ...patch }));
  const setCourse = (slot: Slot, patch: Partial<Course>) =>
    setP(x => ({ ...x, courses: x.courses.map(k => k.slot === slot ? { ...k, ...patch } : k) }));
  const setExtra = (idx: number, patch: Partial<ExtraCourse>) =>
    setP(x => ({ ...x, extraCourses: x.extraCourses.map((k, j) => j === idx ? { ...k, ...patch } : k) }));

  const emailOk = isValidEmailLocal(emailLocal);
  const email = emailOk ? `${emailLocal.toLowerCase()}@${EMAIL_DOMAIN}` : '';
  const setSpare = (slot: Slot, spare: boolean) =>
    setCourse(slot, spare ? { spare: true, name: 'Spare', teacher: '', room: '' } : { spare: false, name: '' });

  // Card scan → profile. The barcode gives the number; OCR (dev builds only)
  // gives name, grade and the homeroom code/room.
  const applyScan = (r: ScanResult) => {
    setScan(null);
    const k = r.card || {};
    const got: string[] = [];
    const patch: Partial<StudentProfile> = {};
    if (k.studentId) { patch.studentId = k.studentId; got.push('student #'); }
    if (k.firstName && k.lastName) { patch.firstName = k.firstName; patch.lastName = k.lastName; got.push('name'); }
    if (k.grade) { patch.grade = k.grade; got.push('grade'); }
    if (k.hrRoom || k.hrTeacher) {
      patch.courses = p.courses.map(x => x.slot === HOMEROOM_SLOT
        ? { ...x, room: k.hrRoom || x.room, teacher: k.hrTeacher || x.teacher }
        : x);
      got.push('homeroom');
    }
    if (Object.keys(patch).length) set(patch);
    if (!got.length) { setErr('Could not read the card. Try again with more light, or type it in.'); return; }
    setErr(null);
    setFlash(f => f + 1);
    setNote(`Filled from your card: ${got.join(', ')}.` + (r.ocrRan === false && !ocrAvailable
      ? ' Text reading needs the full app build, so type the rest for now.' : ''));
  };

  const applyQr = (r: ScanResult) => {
    setScan(null);
    const url = /^https?:\/\//i.test(r.raw) ? r.raw : '';
    if (!url) { setErr('That QR did not hold a link. Try the one on the back of your card.'); return; }
    set({ artonaUrl: url });
    setErr(null);
    setNote('Portrait link saved. Save the photo from that page, then choose it below.');
    Linking.openURL(url).catch(() => {});
  };

  const pickPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr(fromCamera ? 'Camera access is needed to take a photo.' : 'Photo access is needed to choose a photo.'); return; }
    const opts = { mediaTypes: ['images'] as ImagePicker.MediaType[], allowsEditing: true, aspect: [3, 4] as [number, number], quality: 0.85 };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]?.uri) return;
    setErr(null);
    set({ photoUri: await persistPhoto(res.assets[0].uri) });
  };

  const validate = (): string | null => {
    if (step === 'about' && !p.firstName.trim()) return 'First name is required.';
    if (step === 'about' && !p.lastName.trim()) return 'Last name is required.';
    if (step === 'school') {
      if (!emailLocal.trim()) return 'School email is required.';
      if (!emailOk) return 'Email should be your name, last initial and 3 digits, like johnd907.';
      if (!initial || password) {
        if (password.length < MIN_PASSWORD) return `Password needs at least ${MIN_PASSWORD} characters.`;
        if (confirm !== password) return 'The two passwords do not match.';
      }
    }
    if (step === 'day1' || step === 'day2') {
      const day = step === 'day1' ? '1-' : '2-';
      const mine = p.courses.filter(k => k.slot.startsWith(day));
      const missing = mine.filter(k => !k.spare && !k.name.trim()).map(k => k.slot);
      if (missing.length) return `Enter a course for block ${missing.join(', ')}, or mark it Spare.`;
      const badRoom = mine.find(k => !k.spare && roomProblem(k.room));
      if (badRoom) return `Block ${badRoom.slot} room: ${roomProblem(badRoom.room)}.`;
    }
    return null;
  };

  const next = async () => {
    const e = validate();
    if (e) { setErr(e); return; }
    setErr(null);
    setNote(null);
    if (step === 'review') {
      const clean: StudentProfile = {
        ...p,
        firstName: p.firstName.trim(), lastName: p.lastName.trim(),
        pronouns: p.pronouns?.trim(), studentId: p.studentId?.trim(),
        email,
        passwordHash: password ? hashPassword(password) : (initial?.passwordHash || ''),
        courses: p.courses.map(k => ({ ...k, name: k.name.trim(), teacher: k.teacher.trim(), room: k.room.trim() })),
        extraCourses: p.extraCourses.map(k => ({ name: k.name.trim(), teacher: k.teacher.trim() })).filter(k => k.name),
      };
      await save(clean);
      onDone();
      return;
    }
    setI(i + 1);
  };
  const back = () => { setErr(null); setNote(null); setI(Math.max(0, i - 1)); };

  let title = '';
  let body: React.ReactNode = null;

  if (step === 'about') {
    title = initial ? 'Edit your profile' : 'Welcome to Spartans';
    body = (
      <View>
        <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>
          {initial ? 'Change anything below.' : "Sentinel Secondary's unofficial app, run by the School App Club. Tell us who you are. You can change this later in Settings."}
        </Text>
        <ScanCard
          title="Scan your student ID card"
          sub={ocrAvailable ? 'Fills in your name, grade, homeroom and student number.' : 'Reads your student number from the barcode.'}
          onPress={() => setScan('card')}
        />
        <Text style={{ fontSize: 12, color: c.ink4, marginTop: 12, textAlign: 'center' }}>or type it in</Text>
        <Field l="First name" value={p.firstName} onChange={v => set({ firstName: v })} placeholder="John" />
        <Field l="Last name" value={p.lastName} onChange={v => set({ lastName: v })} placeholder="Doe" />
        <Text style={labelStyleFor(c)}>Grade</Text>
        <Choice options={GRADES.map(String)} value={String(p.grade)} onChange={v => set({ grade: Number(v) })} />
        <Text style={labelStyleFor(c)}>Pronouns (optional)</Text>
        <Choice options={PRONOUNS} value={p.pronouns} onChange={v => set({ pronouns: v })} allowNone />
        <TextInput
          value={PRONOUNS.includes(p.pronouns || '') ? '' : p.pronouns || ''}
          onChangeText={v => set({ pronouns: v })}
          placeholder="or type your own"
          placeholderTextColor={c.ink4}
          autoCapitalize="none"
          style={[inputStyleFor(c), { marginTop: 8 }]}
        />
      </View>
    );
  } else if (step === 'school') {
    title = 'School email & password';
    body = (
      <View>
        <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>
          Your school email and a password for this app.
        </Text>
        <Text style={labelStyleFor(c)}>School email</Text>
        <EmailRow
          inputRef={emailRef}
          value={emailLocal}
          onChangeText={v => setEmailLocal(v.replace(/[^A-Za-z0-9]/g, '').toLowerCase())}
        />
        <EmailLegend />
        {!!emailLocal && !emailOk && (
          <Text style={{ fontSize: 12, color: c.crimson, marginTop: 6 }}>Should be letters then 3 digits, like johnd907.</Text>
        )}

        <Text style={labelStyleFor(c)}>{initial ? 'New password (leave blank to keep)' : 'Password'}</Text>
        <View style={[inputStyleFor(c), { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={`At least ${MIN_PASSWORD} characters`}
            placeholderTextColor={c.ink4}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, fontSize: 16, color: c.ink, paddingVertical: 11 }}
          />
          <Pressable onPress={() => setShowPw(v => !v)} hitSlop={8}>
            <Text style={{ fontSize: 13, color: c.navy700, fontWeight: '600' }}>{showPw ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 12, color: c.ink4, marginTop: 6 }}>Used to sign in on this device. Only you know it.</Text>
        <ConfirmPassword
          visible={password.length > 0}
          value={confirm}
          onChange={setConfirm}
          show={showPw}
          match={confirm.length > 0 && confirm === password}
          mismatch={confirm.length > 0 && confirm !== password}
        />

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field l="Student number (optional)" value={p.studentId} onChange={v => set({ studentId: v.replace(/\D/g, '').slice(0, 8) })} placeholder="1234567" keyboard="number-pad" />
          </View>
          <Pressable
            onPress={() => setScan('barcode')}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: c.navy700, opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name="scan" size={16} stroke={2} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Scan</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 12, color: c.ink4, marginTop: 6 }}>The 7 digits under the barcode on your ID card.</Text>
      </View>
    );
  } else if (step === 'photo') {
    title = 'Your ID photo';
    body = (
      <View>
        <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>
          For your digital student ID. Optional.
        </Text>
        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Portrait p={p} w={120} h={150} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <PhotoBtn icon="camera" label="Take photo" onPress={() => pickPhoto(true)} />
          <PhotoBtn icon="image" label="Upload photo" onPress={() => pickPhoto(false)} />
        </View>
        {!!p.photoUri && (
          <Pressable onPress={() => set({ photoUri: '' })} hitSlop={8} style={{ alignSelf: 'center', marginTop: 12 }}>
            <Text style={{ fontSize: 13, color: c.crimson, fontWeight: '600' }}>Remove photo</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => setScan('qr')}
          style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 18, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.paper2, opacity: pressed ? 0.7 : 1 })}
        >
          <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="qr" size={18} stroke={1.8} color={c.navy700} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.ink }}>Want your official school photo?</Text>
            <Text style={{ fontSize: 12, color: c.ink3, lineHeight: 17, marginTop: 2 }}>
              Scan the QR on the back of your card, save the portrait, then tap Upload photo.
            </Text>
          </View>
          <Icon name="chev-r" size={16} stroke={1.8} color={c.ink4} />
        </Pressable>
        {!!p.artonaUrl && (
          <Pressable onPress={() => Linking.openURL(p.artonaUrl!).catch(() => {})} hitSlop={6} style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: c.navy700, fontWeight: '600' }}>Open your saved portrait link again</Text>
          </Pressable>
        )}
      </View>
    );
  } else if (step === 'day1' || step === 'day2') {
    const day = step === 'day1' ? 1 : 2;
    title = `Day ${day} blocks`;
    body = (
      <View>
        {SLOTS.filter(sl => sl.startsWith(`${day}-`)).map(slot => {
          const k = p.courses.find(x => x.slot === slot)!;
          const rp = k.spare ? null : roomProblem(k.room);
          return (
            <View key={slot} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12, marginTop: 10, backgroundColor: c.paper2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: k.color }} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: c.ink }}>Block {slot}</Text>
                {slot === HOMEROOM_SLOT && (
                  <Text style={{ fontSize: 11, fontWeight: '500', color: c.ink3, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>Homeroom</Text>
                )}
                <View style={{ flex: 1 }} />
                <SpareToggle on={!!k.spare} onChange={v => setSpare(slot, v)} />
              </View>
              {!k.spare && (
                <>
                  <AutoField
                    l={slot.endsWith('-4') ? 'Course or academy' : 'Course'}
                    value={k.name}
                    onChange={v => setCourse(slot, { name: v })}
                    suggest={q => matchCourses(q, p.grade, { lastBlock: slot.endsWith('-4') })}
                    placeholder={slot.endsWith('-4') ? 'Chemistry 11 or Soccer Academy' : 'Chemistry 11'}
                    hint={slot.endsWith('-4') ? 'Academies run in the last block. Type "academy" to pick one.' : undefined}
                  />
                  <AutoField
                    l="Teacher"
                    value={k.teacher}
                    onChange={v => setCourse(slot, { teacher: v })}
                    suggest={q => matchTeachers(q).map(teacherLabel)}
                    placeholder="Last name"
                  />
                  <AutoField
                    l="Room"
                    value={k.room}
                    onChange={v => setCourse(slot, { room: normalizeRoom(v) })}
                    suggest={matchRooms}
                    placeholder="213, 149A or PORT"
                    autoCap="characters"
                    error={rp}
                  />
                </>
              )}
              {k.spare && <Text style={{ fontSize: 13, color: c.ink3, marginTop: 8 }}>Spare block</Text>}
            </View>
          );
        })}
      </View>
    );
  } else if (step === 'extras') {
    title = 'Anything outside the timetable?';
    body = (
      <View>
        <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>
          Classes, clubs and teams outside your 8 blocks: Theatre Company, Choir, YELL, Student Council, a Spartans team. Optional.
        </Text>
        {p.extraCourses.map((x, idx) => (
          <View key={idx} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12, marginTop: 12, backgroundColor: c.paper2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.ink }}>Extra class {idx + 1}</Text>
              <Pressable onPress={() => set({ extraCourses: p.extraCourses.filter((_, j) => j !== idx) })} hitSlop={8}>
                <Text style={{ fontSize: 13, color: c.crimson, fontWeight: '600' }}>Remove</Text>
              </Pressable>
            </View>
            <AutoField l="Class, club or team" value={x.name} onChange={v => setExtra(idx, { name: v })} suggest={q => matchExtras(q, p.grade)} placeholder="Theatre Company, YELL, Sr. Boys Soccer" />
            <AutoField l="Teacher" value={x.teacher} onChange={v => setExtra(idx, { teacher: v })} suggest={q => matchTeachers(q).map(teacherLabel)} placeholder="Last name" />
          </View>
        ))}
        <Pressable
          onPress={() => set({ extraCourses: [...p.extraCourses, { name: '', teacher: '' }] })}
          style={({ pressed }) => ({ marginTop: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: c.ink4, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: c.navy700, fontWeight: '600', fontSize: 14 }}>+ Add a class, club or team</Text>
        </Pressable>
      </View>
    );
  } else {
    title = 'Check it over';
    body = (
      <View>
        <Row k="Name" v={fullName(p)} />
        <Row k="Grade" v={String(p.grade)} />
        {!!p.pronouns && <Row k="Pronouns" v={p.pronouns} />}
        {!!email && <Row k="Email" v={email} />}
        <Row k="Password" v={password ? '•'.repeat(password.length) : initial?.passwordHash ? 'Unchanged' : 'none'} />
        {!!p.studentId && <Row k="Student #" v={p.studentId} />}
        <Row k="ID photo" v={p.photoUri ? 'Added' : 'Initials for now'} />
        <Row k="Homeroom" v={p.courses.find(k => k.slot === HOMEROOM_SLOT)?.room || 'none'} />
        {([1, 2] as const).map(day => (
          <View key={day}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.ink3, marginTop: 16, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Day {day}</Text>
            {p.courses.filter(k => k.slot.startsWith(`${day}-`)).map(k => (
              <Row key={k.slot} k={`Block ${k.slot}`} v={[k.name, k.teacher, k.room ? roomShort(k.room) : ''].filter(Boolean).join(' · ')} color={k.color} />
            ))}
          </View>
        ))}
        {p.extraCourses.some(x => x.name.trim()) && (
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: c.ink3, marginTop: 16, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Outside the timetable</Text>
            {p.extraCourses.filter(x => x.name.trim()).map((x, j) => (
              <Row key={j} k="Extra" v={[x.name, x.teacher].filter(Boolean).join(' · ')} />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Math.max(topInset, 20) + 16, paddingHorizontal: 20, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '700', color: c.ink3 }}>
          Step {i + 1} of {STEPS.length}
        </Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: c.ink, marginTop: 4, marginBottom: 12 }}>{title}</Text>

        {body}

        {!!note && <Text style={{ color: c.moss, marginTop: 14, fontSize: 13, fontWeight: '500' }}>{note}</Text>}
        {!!err && <Text style={{ color: c.crimson, marginTop: 14, fontSize: 13, fontWeight: '500' }}>{err}</Text>}

        {i === 0 ? (
          <View style={{ gap: 10, marginTop: 24 }}>
            <Btn label="Next" onPress={next} />
            {!!onCancel && <Btn label="Cancel" onPress={onCancel} secondary />}
            {!onCancel && !!onBackToStart && <Btn label="Back" onPress={onBackToStart} secondary />}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
            <Btn label="Back" onPress={back} secondary />
            <Btn label={step === 'review' ? 'Finish' : 'Next'} onPress={next} />
          </View>
        )}
      </ScrollView>
      <IdScanner
        visible={scan !== null}
        mode={scan || 'card'}
        onResult={r => (scan === 'qr' ? applyQr(r) : applyScan(r))}
        onClose={() => setScan(null)}
      />
      <ScanSuccess trigger={flash} />
    </KeyboardAvoidingView>
  );
};

// ────────────────────────────────────────────────────────────────
// Sign in: email or student number (scan works) + password, against the
// account saved on this device.
// ────────────────────────────────────────────────────────────────
const SignIn = ({ topInset, onDone, onBack }: { topInset: number; onDone: () => void; onBack: () => void }) => {
  const { c } = useTheme();
  const { signIn, profile } = useProfile();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scan, setScan] = useState(false);
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (busy) return;
    setBusy(true);
    const e = await signIn(id, pw);
    setBusy(false);
    if (e) { setErr(e); return; }
    setErr(null);
    onDone();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView contentContainerStyle={{ paddingTop: Math.max(topInset, 20) + 16, paddingHorizontal: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: '700', color: c.ink3 }}>Sign in</Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: c.ink, marginTop: 4, marginBottom: 12 }}>Welcome back</Text>
        <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>
          {profile ? `Signed up on this device as ${fullName(profile)}.` : 'No account on this device yet. Go back and sign up.'}
        </Text>

        <Text style={labelStyleFor(c)}>School email or student number</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={id}
            onChangeText={setId}
            placeholder="johnd907@edu.sd45.bc.ca or 1234567"
            placeholderTextColor={c.ink4}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={[inputStyleFor(c), { flex: 1 }]}
          />
          <Pressable
            onPress={() => setScan(true)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, backgroundColor: c.navy700, opacity: pressed ? 0.7 : 1 })}
          >
            <Icon name="scan" size={16} stroke={2} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Scan</Text>
          </Pressable>
        </View>

        <Text style={labelStyleFor(c)}>Password</Text>
        <View style={[inputStyleFor(c), { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}>
          <TextInput
            value={pw}
            onChangeText={setPw}
            placeholder="Your app password"
            placeholderTextColor={c.ink4}
            secureTextEntry={!showPw}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={go}
            style={{ flex: 1, fontSize: 16, color: c.ink, paddingVertical: 11 }}
          />
          <Pressable onPress={() => setShowPw(v => !v)} hitSlop={8}>
            <Text style={{ fontSize: 13, color: c.navy700, fontWeight: '600' }}>{showPw ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>

        {!!err && <Text style={{ color: c.crimson, marginTop: 14, fontSize: 13, fontWeight: '500' }}>{err}</Text>}

        <View style={{ gap: 10, marginTop: 24 }}>
          <Btn label={busy ? 'Signing in…' : 'Sign in'} onPress={go} />
          <Btn label="Back" onPress={onBack} secondary />
        </View>
      </ScrollView>
      <IdScanner
        visible={scan}
        mode="barcode"
        onResult={r => { setScan(false); if (r.card?.studentId) { setId(r.card.studentId); setErr(null); } else setErr('Could not read the barcode.'); }}
        onClose={() => setScan(false)}
      />
    </KeyboardAvoidingView>
  );
};

// ────────────────────────────────────────────────────────────────
// Form bits, hoisted so inputs keep identity (and focus) across renders.
// ────────────────────────────────────────────────────────────────
type Palette = ReturnType<typeof useTheme>['c'];

const inputStyleFor = (c: Palette) => ({
  borderWidth: 1, borderColor: c.line, borderRadius: 10,
  paddingHorizontal: 12, paddingVertical: 11,
  fontSize: 16, color: c.ink, backgroundColor: c.surface,
});
const labelStyleFor = (c: Palette) => ({
  fontSize: 12, fontWeight: '600' as const, color: c.ink3, marginBottom: 6, marginTop: 14,
  letterSpacing: 0.3, textTransform: 'uppercase' as const,
});

const Field = ({ l, value, onChange, placeholder, keyboard, autoCap, error }: {
  l: string; value?: string; onChange: (v: string) => void; placeholder?: string;
  keyboard?: 'default' | 'email-address' | 'number-pad'; autoCap?: 'none' | 'words' | 'sentences' | 'characters';
  error?: string | null;
}) => {
  const { c } = useTheme();
  return (
    <View>
      <Text style={labelStyleFor(c)}>{l}</Text>
      <TextInput
        value={value || ''}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.ink4}
        keyboardType={keyboard || 'default'}
        autoCapitalize={autoCap || 'words'}
        autoCorrect={false}
        style={[inputStyleFor(c), error ? { borderColor: c.crimson } : null]}
      />
      {!!error && <Text style={{ fontSize: 12, color: c.crimson, marginTop: 4 }}>{error}</Text>}
    </View>
  );
};

// School email row: the typed local part with "@edu.sd45.bc.ca" sitting right
// after it and moving as you type. A hidden mirror <Text> measures the current
// value (or placeholder). The mirror lives in the full-width row, not inside
// the fitted wrapper, so its measurement is never clipped by the input's own
// width (that was why the suffix used to stick).
const EmailRow = ({ inputRef, value, onChangeText }: {
  inputRef: React.RefObject<TextInput | null>; value: string; onChangeText: (v: string) => void;
}) => {
  const { c } = useTheme();
  const [w, setW] = useState(0);
  const [rowW, setRowW] = useState(0);
  const placeholder = 'johnd907';
  const shown = value || placeholder;
  const SUFFIX_W = 150;   // rough width of the suffix; the input never grows past the row minus this
  const inputW = Math.min(Math.max(28, w + 6), Math.max(60, rowW - SUFFIX_W));
  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      onLayout={e => setRowW(e.nativeEvent.layout.width - 24)}
      style={[inputStyleFor(c), { flexDirection: 'row', alignItems: 'center', paddingVertical: 0 }]}
    >
      <Text
        onLayout={e => setW(e.nativeEvent.layout.width)}
        style={{ position: 'absolute', left: 0, top: 0, opacity: 0, fontSize: 16 }}
        numberOfLines={1}
        pointerEvents="none"
      >
        {shown}
      </Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink4}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        accessibilityLabel="School email, before the @"
        style={{ fontSize: 16, color: c.ink, paddingVertical: 11, width: inputW, paddingHorizontal: 0 }}
      />
      <Text numberOfLines={1} style={{ fontSize: 16, color: c.ink4, flexShrink: 1 }}>@{EMAIL_DOMAIN}</Text>
    </Pressable>
  );
};

// Confirm-password field. Slides in beneath the password once one is typed.
const ConfirmPassword = ({ visible, value, onChange, show, match, mismatch }: {
  visible: boolean; value: string; onChange: (v: string) => void; show: boolean; match: boolean; mismatch: boolean;
}) => {
  const { c } = useTheme();
  const a = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: visible ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [visible, a]);
  return (
    <Animated.View style={{ opacity: a, maxHeight: a.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }), overflow: 'hidden', transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>
      <Text style={labelStyleFor(c)}>Confirm password</Text>
      <View style={[inputStyleFor(c), { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, borderColor: mismatch ? c.crimson : match ? c.moss : c.line }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Type it again"
          placeholderTextColor={c.ink4}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Confirm password"
          style={{ flex: 1, fontSize: 16, color: c.ink, paddingVertical: 11 }}
        />
        {match && <Icon name="check-circle" size={18} stroke={2} color={c.moss} />}
      </View>
      {mismatch && <Text style={{ fontSize: 12, color: c.crimson, marginTop: 4 }}>Does not match yet.</Text>}
    </Animated.View>
  );
};

// Scan-success flash: a check mark that pops in over the form and fades out.
// `trigger` bumps each time a scan lands with data.
const ScanSuccess = ({ trigger }: { trigger: number }) => {
  const { c } = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setOn(true);
    a.setValue(0);
    Animated.sequence([
      Animated.spring(a, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(a, { toValue: 2, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => setOn(false));
  }, [trigger, a]);
  if (!on) return null;
  const scale = a.interpolate({ inputRange: [0, 1, 2], outputRange: [0.4, 1, 1.15] });
  const opacity = a.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] });
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ opacity, transform: [{ scale }], width: 132, height: 132, borderRadius: 66, backgroundColor: c.moss, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="check-circle" size={70} stroke={2.2} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 2 }}>SCANNED</Text>
      </Animated.View>
    </View>
  );
};

// Spare switch for a block box: on = no class this block.
const SpareToggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => onChange(!on)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '600', color: on ? c.navy700 : c.ink3 }}>Spare</Text>
      <View style={{ width: 34, height: 20, borderRadius: 10, padding: 2, backgroundColor: on ? c.navy700 : c.line, justifyContent: 'center' }}>
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff', alignSelf: on ? 'flex-end' : 'flex-start' }} />
      </View>
    </Pressable>
  );
};

// Example email with each part underlined and labelled.
const EmailLegend = () => {
  const { c } = useTheme();
  const parts: [string, string, string][] = [
    ['john', 'first name', c.navy700], ['d', 'last initial', c.gold], ['907', 'numbers', c.moss], ['@edu.sd45.bc.ca', 'address', c.ink4],
  ];
  return (
    <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap' }}>
      {parts.map(([txt, lbl, col]) => (
        <View key={txt} style={{ alignItems: 'center', marginRight: 2 }}>
          <Text style={{ fontSize: 13, color: c.ink2, borderBottomWidth: 2, borderBottomColor: col, paddingBottom: 1 }}>{txt}</Text>
          <Text style={{ fontSize: 9, color: col, marginTop: 2, fontWeight: '600' }}>{lbl}</Text>
        </View>
      ))}
    </View>
  );
};

// Text input with suggestions beneath it while focused: 3 rows visible, scroll for more.
// Blur is delayed slightly so a tap on a suggestion lands before the list hides.
const SUGGESTION_ROW = 41;
const AutoField = ({ l, value, onChange, suggest, placeholder, autoCap, hint, error }: {
  l: string; value: string; onChange: (v: string) => void; suggest: (q: string) => string[]; placeholder?: string;
  autoCap?: 'none' | 'words' | 'sentences' | 'characters'; hint?: string; error?: string | null;
}) => {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [picked, setPicked] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opts = focused && !picked ? suggest(value).filter(o => o !== value) : [];

  return (
    <View>
      <Text style={labelStyleFor(c)}>{l}</Text>
      <TextInput
        value={value}
        onChangeText={v => { setPicked(false); onChange(v); }}
        onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setFocused(true); }}
        onBlur={() => { blurTimer.current = setTimeout(() => setFocused(false), 180); }}
        placeholder={placeholder}
        placeholderTextColor={c.ink4}
        autoCapitalize={autoCap || 'words'}
        autoCorrect={false}
        style={[inputStyleFor(c), error ? { borderColor: c.crimson } : null]}
      />
      {!!error && opts.length === 0 && <Text style={{ fontSize: 12, color: c.crimson, marginTop: 4 }}>{error}</Text>}
      {!!hint && !error && opts.length === 0 && <Text style={{ fontSize: 12, color: c.ink4, marginTop: 4 }}>{hint}</Text>}
      {opts.length > 0 && (
        <View style={{ borderWidth: 1, borderColor: c.line, borderTopWidth: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: c.surface, marginTop: -4, overflow: 'hidden' }}>
          <ScrollView
            style={{ maxHeight: SUGGESTION_ROW * 3 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={opts.length > 3}
          >
            {opts.map(o => (
              <Pressable
                key={o}
                onPress={() => { onChange(o); setPicked(true); setFocused(false); }}
                style={({ pressed }) => ({ height: SUGGESTION_ROW, justifyContent: 'center', paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: c.line2, backgroundColor: pressed ? c.navy50 : 'transparent' })}
              >
                <Text style={{ fontSize: 14, color: c.ink }} numberOfLines={1}>{o}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {opts.length > 3 && (
            <Text style={{ fontSize: 10, color: c.ink4, textAlign: 'center', paddingVertical: 3, borderTopWidth: 1, borderTopColor: c.line2 }}>
              {opts.length} matches · scroll for more
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const ScanCard = ({ title, sub, onPress }: { title: string; sub: string; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: c.navy700, opacity: pressed ? 0.8 : 1 })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="id" size={22} stroke={1.7} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>{title}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 16, marginTop: 2 }}>{sub}</Text>
      </View>
      <Icon name="chev-r" size={16} stroke={2} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
};

const PhotoBtn = ({ icon, label, onPress }: { icon: 'camera' | 'image'; label: string; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 })}
    >
      <Icon name={icon} size={18} stroke={1.8} color={c.navy700} />
      <Text style={{ color: c.ink, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
};

const Choice = ({ options, value, onChange, allowNone }: {
  options: string[]; value?: string; onChange: (v: string) => void; allowNone?: boolean;
}) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const on = value === o;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(on && allowNone ? '' : o)}
            style={{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? c.navy700 : c.line, backgroundColor: on ? c.navy700 : c.surface }}
          >
            <Text style={{ color: on ? '#fff' : c.ink, fontSize: 14, fontWeight: '500' }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const Row = ({ k, v, color }: { k: string; v: string; color?: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line2, alignItems: 'center' }}>
      {!!color && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      <Text style={{ width: 84, fontSize: 12, fontWeight: '600', color: c.ink3 }}>{k}</Text>
      <Text style={{ flex: 1, fontSize: 14, color: c.ink }}>{v || 'none'}</Text>
    </View>
  );
};

const Btn = ({ label, onPress, secondary }: { label: string; onPress: () => void; secondary?: boolean }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center',
        backgroundColor: secondary ? c.surface : c.navy700,
        borderWidth: 1, borderColor: secondary ? c.line : c.navy700,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: secondary ? c.ink : '#fff', fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
};
