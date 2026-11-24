// Spartans — Settings, the bottom half of the Profile screen.
// Top to bottom:
//   1. Personal touches, each with its own look: Appearance (live theme
//      previews), Notifications (sky tile), Linked apps (navy tile), App Club
//      (the club's coin on navy).
//   2. The real settings list: Edit profile · Edit classes · Account & privacy.
//   3. Sign out.
//   4. Help & feedback, last.
// Every row opens a full-page sheet in this file, except the two editors,
// which cover the app (ProfileEditor in OnboardingScreen).

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform, Linking, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemePref } from '../ThemeContext';
import { colors, fonts, shadow, tnum, G135 } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { ClubCoin, SectionHeader } from '../components/Chrome';
import { useProfile, fullName } from '../ProfileContext';
import { backendConfigured } from '../supabase';
import { MIN_PASSWORD } from '../auth';
import { ask } from '../confirm';
import {
  APP_VERSION, NOTIFY_TOPICS, useNotifyPrefs, FEEDBACK_AREAS, FEEDBACK_KINDS, useFeedback, feedbackFrom,
} from '../settings';
import type { FeedbackKind, FeedbackRow, Role } from '../backend';
import { rankLabel, roleLabel } from '../ranks';
import { useNotify } from '../notify/context';
import { useNav } from '../nav';
import { EVENT_TEMPLATES, ADMIN_TEMPLATES, previewDay, templateById } from '../notify/eventDays';
import { BADGES } from '../badges';
import { EventBanner } from '../components/EventBanner';
import { toISO } from '../calendar';
import type { EditWhat } from './OnboardingScreen';

type Palette = ReturnType<typeof useTheme>['c'];
type SheetId = 'notify' | 'linked' | 'admin' | 'account' | 'help';

export function SettingsSection({ onEdit }: { onEdit: (w: EditWhat) => void }) {
  const { c } = useTheme();
  const { profile, roles, signOut, openCatchUp, resetCatchUp } = useProfile();
  const notify = useNotifyPrefs();
  const [open, setOpen] = useState<SheetId | null>(null);
  const close = () => setOpen(null);
  const nav = useNav();

  const doSignOut = async () => {
    if (await ask('Sign out?', 'Your account stays on this device. Sign back in with your school email or student number and your password.', 'Sign out', true)) signOut();
  };

  const catchUp = profile?.catchUp;
  const doCatchUp = async () => {
    if (!catchUp?.doneAt) { openCatchUp(); return; }
    if (!(await ask('Redo Catch Up?', 'This takes back your Catch Up badges and asks the questions again. Your answers stay filled in. Badges earned any other way are safe.', 'Redo'))) return;
    const problem = await resetCatchUp();
    if (problem) { await ask('Could not reset Catch Up', problem, 'OK'); return; }
    openCatchUp();
  };

  return (
    <View>
      <SectionHeader title="Settings" />

      {/* ── 1. Personal touches ─────────────────────────────── */}
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <AppearanceCard />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <NotifyTile count={notify.onCount} paused={notify.prefs.paused} onPress={() => setOpen('notify')} />
          <LinkedTile onPress={() => setOpen('linked')} />
        </View>
        <AdminCard roles={roles} onPress={() => nav.go('admin')} />
      </View>

      {/* ── 2. Real settings ────────────────────────────────── */}
      <Text style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: c.ink3 }}>
        Account
      </Text>
      <View style={{ paddingHorizontal: 20 }}>
        <ListCard>
          <Row icon="me" label="Edit profile" sub="Name, grade, pronouns, student number, photo" onPress={() => onEdit('profile')} />
          <Row icon="calendar" label="Edit classes" sub="Day 1 and Day 2 blocks, outside the timetable" onPress={() => onEdit('classes')} />
          <Row
            icon="sparkle"
            label={catchUp?.doneAt ? 'Redo Catch Up' : 'Catch Up'}
            sub={catchUp?.doneAt ? 'Change your answers about your time at Sentinel' : `Get the badges and XP you would have earned. ${catchUp?.score || 0}% done`}
            onPress={doCatchUp}
          />
          <Row icon="shield" label="Account & privacy" sub={profile?.email || 'Password, who sees what, delete account'} onPress={() => setOpen('account')} last />
        </ListCard>
      </View>

      {/* ── 3. Sign out ─────────────────────────────────────── */}
      <View style={{ paddingTop: 14, paddingHorizontal: 20 }}>
        <Pressable
          onPress={doSignOut}
          style={({ pressed }) => ({ paddingVertical: 13, borderWidth: 1, borderColor: c.line, borderRadius: 14, alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={{ color: c.crimson, fontSize: 14, fontWeight: '600', letterSpacing: -0.1 }}>Sign out</Text>
        </Pressable>
      </View>

      {/* ── 4. Help & feedback ──────────────────────────────── */}
      <View style={{ paddingTop: 22, paddingHorizontal: 20 }}>
        <HelpCard onPress={() => setOpen('help')} />
      </View>

      <Text style={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 8, textAlign: 'center', fontSize: 11, color: c.ink4, letterSpacing: 0.3 }}>
        Spartans · Sentinel Secondary's unofficial app · {APP_VERSION}
      </Text>

      <NotifySheet visible={open === 'notify'} onClose={close} notify={notify} />
      <LinkedSheet visible={open === 'linked'} onClose={close} />
      <AccountSheet visible={open === 'account'} onClose={close} onEdit={w => { close(); onEdit(w); }} />
      <HelpSheet visible={open === 'help'} onClose={close} />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// 1. Personal touches
// ════════════════════════════════════════════════════════════════

// Appearance: three live mini-screens painted with the real light and dark
// palettes. Tap one to switch; the whole app changes at once.
const AppearanceCard = () => {
  const { c, pref, setPref, mode } = useTheme();
  const opts: { id: ThemePref; label: string }[] = [
    { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }, { id: 'system', label: 'Match phone' },
  ];
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.line, padding: 14 }, shadow.sm]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon name={mode === 'dark' ? 'moon' : 'sun'} size={18} stroke={1.9} color={c.gold} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink, letterSpacing: -0.2 }}>Appearance</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 12, color: c.ink3 }}>{pref === 'system' ? `Following your phone (${mode})` : mode === 'dark' ? 'Dark' : 'Light'}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {opts.map(o => {
          const on = pref === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => setPref(o.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${o.label} appearance`}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', opacity: pressed ? 0.75 : 1 })}
            >
              <View style={{ width: '100%', borderRadius: 14, padding: 3, borderWidth: 2, borderColor: on ? c.navy600 : 'transparent' }}>
                {o.id === 'system' ? (
                  <View style={{ flexDirection: 'row', borderRadius: 10, overflow: 'hidden' }}>
                    <View style={{ flex: 1, overflow: 'hidden' }}><MiniScreen m="light" half="left" /></View>
                    <View style={{ flex: 1, overflow: 'hidden' }}><MiniScreen m="dark" half="right" /></View>
                  </View>
                ) : (
                  <MiniScreen m={o.id} />
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                {on && <Icon name="check" size={12} stroke={2.6} color={c.navy600} />}
                <Text style={{ fontSize: 12.5, fontWeight: on ? '700' : '500', color: on ? c.ink : c.ink3 }}>{o.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

// A tiny phone screen in one palette: header bar, a card, a gold accent.
// `half` crops it for the split "Match phone" preview.
const MiniScreen = ({ m, half }: { m: 'light' | 'dark'; half?: 'left' | 'right' }) => {
  const k = colors[m];
  return (
    <View style={{
      height: 74, borderRadius: half ? 0 : 10, backgroundColor: k.paper, padding: 7, gap: 5,
      borderWidth: half ? 0 : 1, borderColor: k.line, width: half ? '200%' : '100%',
      marginLeft: half === 'right' ? '-100%' : 0,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: k.navy700 }} />
        <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k.ink4, opacity: 0.6 }} />
      </View>
      <View style={{ flex: 1, borderRadius: 6, backgroundColor: k.surface, borderWidth: 1, borderColor: k.line, padding: 5, gap: 4 }}>
        <View style={{ width: '70%', height: 4, borderRadius: 2, backgroundColor: k.ink }} />
        <View style={{ width: '45%', height: 4, borderRadius: 2, backgroundColor: k.ink3 }} />
        <View style={{ width: 16, height: 4, borderRadius: 2, backgroundColor: k.gold, marginTop: 'auto' }} />
      </View>
    </View>
  );
};

// Notifications: bright sky tile with the live count.
const NotifyTile = ({ count, paused, onPress }: { count: number; paused: boolean; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Notifications, ${paused ? 'paused' : `${count} on`}`} style={({ pressed }) => [{ flex: 1, borderRadius: 20, overflow: 'hidden', opacity: pressed ? 0.85 : 1 }, shadow.sm]}>
      <LinearGradient colors={[c.sky, c.sky600]} {...G135} style={{ padding: 14, minHeight: 128 }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={18} stroke={2} color="#fff" />
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[{ color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: -0.5, marginTop: 10 }, tnum]}>
          {paused ? 'Paused' : `${count} of ${NOTIFY_TOPICS.length}`}
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: '600' }}>Notifications</Text>
      </LinearGradient>
    </Pressable>
  );
};

// Linked apps: deep navy tile with the apps as chips.
const LinkedTile = ({ onPress }: { onPress: () => void }) => {
  const { c, mode } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Linked apps" style={({ pressed }) => [{ flex: 1, borderRadius: 20, backgroundColor: c.navy900, borderWidth: 1, borderColor: mode === 'dark' ? 'rgba(255,255,255,0.12)' : c.navy900, padding: 14, minHeight: 128, opacity: pressed ? 0.85 : 1 }, shadow.sm]}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
        {['MyEdBC', 'Outlook', 'Teams'].map(t => (
          <View key={t} style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }}>
            <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '700' }}>{t}</Text>
          </View>
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <Icon name="grid" size={16} stroke={2} color={c.silver} />
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: -0.2 }}>Linked apps</Text>
      </View>
      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>School sites in one tap</Text>
    </Pressable>
  );
};

// App Club: the club's coin on navy, same strip as the role card inside.
const AdminCard = ({ roles, onPress }: { roles: string[]; onPress: () => void }) => {
  const { mode } = useTheme();
  const line = roles.length ? rankLabel(roles as Role[]) : 'Join, or enter your invite code';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`App Club. ${line}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: pressed ? '#0E2238' : '#14304E', borderWidth: 1, borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : '#14304E' })}>
      <ClubCoin size={46} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 22, lineHeight: 27, letterSpacing: -0.4, color: '#fff' }}>App Club</Text>
        <Text numberOfLines={1} style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.78)', marginTop: 1 }}>{line}</Text>
      </View>
      <Icon name="chev-r" size={17} stroke={2.2} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
};

// Help & feedback: quiet dashed card at the very bottom.
const HelpCard = ({ onPress }: { onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.ink4, backgroundColor: pressed ? c.paper2 : 'transparent' })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.skyTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="message" size={18} stroke={1.9} color={c.sky600} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: c.ink }}>Help & feedback</Text>
        <Text style={{ fontSize: 12, color: c.ink3, marginTop: 1 }}>Tell the App Club what you like and what needs fixing</Text>
      </View>
      <Icon name="chev-r" size={16} stroke={1.8} color={c.ink4} />
    </Pressable>
  );
};

// ════════════════════════════════════════════════════════════════
// Shared bits
// ════════════════════════════════════════════════════════════════
export const ListCard = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }, shadow.sm]}>
      {children}
    </View>
  );
};

export const Row = ({ icon, label, sub, onPress, last, danger, trailing }: {
  icon: IconName; label: string; sub?: string; onPress?: () => void; last?: boolean; danger?: boolean; trailing?: React.ReactNode;
}) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent',
      })}
    >
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: danger ? c.crimsonTint : c.navy50, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} stroke={1.8} color={danger ? c.crimson : c.navy700} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14, fontWeight: '500', color: danger ? c.crimson : c.ink, letterSpacing: -0.1 }}>{label}</Text>
        {!!sub && <Text numberOfLines={2} style={{ fontSize: 12, color: c.ink3, marginTop: 1 }}>{sub}</Text>}
      </View>
      {trailing ?? (onPress ? <Icon name="chev-r" size={16} stroke={1.8} color={c.ink4} /> : null)}
    </Pressable>
  );
};

export const Toggle = ({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!on)}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <View style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: on ? c.moss : c.line, justifyContent: 'center' }}>
        <View style={[{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: on ? 'flex-end' : 'flex-start' }, shadow.sm]} />
      </View>
    </Pressable>
  );
};

// Full-page sheet: title, Done, scrolling body.
export const Sheet = ({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.paper }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, paddingBottom: 60, gap: 12 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 26, color: c.ink, flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button"><Text style={{ fontSize: 15, color: c.navy700, fontWeight: '600' }}>Done</Text></Pressable>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export const Label = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', color: c.ink3, marginTop: 12 }}>{children}</Text>;
};

export const fieldStyle = (c: Palette) => ({
  borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  fontSize: 16, color: c.ink, backgroundColor: c.surface,
}) as const;

export const Button = ({ label, onPress, disabled, tone = 'navy' }: { label: string; onPress: () => void; disabled?: boolean; tone?: 'navy' | 'crimson' | 'plain' }) => {
  const { c } = useTheme();
  const bg = tone === 'navy' ? c.navy700 : tone === 'crimson' ? c.crimson : c.surface;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: bg, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
        borderWidth: tone === 'plain' ? 1 : 0, borderColor: c.line, opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: tone === 'plain' ? c.ink : '#fff', fontWeight: '700', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
};

// ════════════════════════════════════════════════════════════════
// Notifications
// ════════════════════════════════════════════════════════════════
export const NotifySheet = ({ visible, onClose, notify }: { visible: boolean; onClose: () => void; notify: ReturnType<typeof useNotifyPrefs> }) => {
  const { c } = useTheme();
  const { prefs, setTopic, setPaused } = notify;
  const { permission, requestPermission } = useNotify();
  const phone = {
    granted: { sub: 'On. Reminders and school news reach your lock screen.', btn: null },
    undetermined: { sub: 'Off. Turn on to get reminders when the app is closed.', btn: 'Turn on' },
    denied: { sub: 'Blocked in your phone\'s Settings.', btn: 'Settings' },
    unsupported: { sub: 'Not available here. Use the app on your phone.', btn: null },
  }[permission];
  return (
    <Sheet visible={visible} onClose={onClose} title="Notifications">
      <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>Pick what Spartans should tell you about. These choices also decide what shows under the bell.</Text>
      <ListCard>
        <Row icon="phone" label="Phone notifications" sub={phone.sub} last
          trailing={phone.btn ? (
            <Pressable onPress={requestPermission} accessibilityRole="button" hitSlop={6}
              style={({ pressed }) => ({ backgroundColor: c.navy700, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{phone.btn}</Text>
            </Pressable>
          ) : permission === 'granted' ? <Icon name="check-circle" size={20} stroke={2} color={c.moss} /> : null} />
      </ListCard>
      <ListCard>
        <Row icon="bell" label="Pause everything" sub={prefs.paused ? 'Nothing will be sent until you turn this off' : 'Quiet mode for exams or holidays'} last
          trailing={<Toggle on={prefs.paused} onChange={setPaused} label="Pause all notifications" />} />
      </ListCard>
      <ListCard>
        {NOTIFY_TOPICS.map((t, i) => (
          <Row key={t.id} icon={t.icon} label={t.label} sub={t.sub} last={i === NOTIFY_TOPICS.length - 1}
            trailing={<Toggle on={!!prefs.on[t.id]} onChange={v => setTopic(t.id, v)} label={t.label} disabled={prefs.paused} />} />
        ))}
      </ListCard>
      <Text style={{ fontSize: 12, color: c.ink4, lineHeight: 17 }}>
        Homework, calendar and event-day reminders are set on this phone, so they work offline. Snow days, big news, friend requests and badges come from the App Club server. Snow days reach everyone unless everything is paused.
      </Text>
    </Sheet>
  );
};

// ════════════════════════════════════════════════════════════════
// Linked apps
// ════════════════════════════════════════════════════════════════
const LINKS: { label: string; sub: string; url: string; icon: IconName }[] = [
  { label: 'MyEducation BC', sub: 'Marks, attendance, report cards', url: 'https://myeducation.gov.bc.ca/aspen/logon.do', icon: 'chart' },
  { label: 'Outlook', sub: 'Your school email', url: 'https://outlook.office.com/mail/', icon: 'mail' },
  { label: 'Microsoft Teams', sub: 'Class teams and assignments', url: 'https://teams.microsoft.com/', icon: 'users' },
  { label: 'Office 365', sub: 'Word, PowerPoint, OneDrive', url: 'https://www.office.com/', icon: 'grid' },
];

const LinkedSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  const { profile } = useProfile();
  const links = profile?.artonaUrl
    ? [...LINKS, { label: 'School portrait', sub: 'The link from the QR on your ID card', url: profile.artonaUrl, icon: 'image' as IconName }]
    : LINKS;
  return (
    <Sheet visible={visible} onClose={onClose} title="Linked apps">
      <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>The school sites you use most. Sign in with your school email.</Text>
      <ListCard>
        {links.map((l, i) => (
          <Row key={l.label} icon={l.icon} label={l.label} sub={l.sub} last={i === links.length - 1}
            onPress={() => Linking.openURL(l.url).catch(() => {})}
            trailing={<Icon name="share" size={15} stroke={1.8} color={c.ink4} />} />
        ))}
      </ListCard>
      <Text style={{ fontSize: 12, color: c.ink4, lineHeight: 17 }}>
        These open in your browser. Spartans never sees your passwords for them.
      </Text>
    </Sheet>
  );
};

// ════════════════════════════════════════════════════════════════
// Account & privacy
// ════════════════════════════════════════════════════════════════
const AccountSheet = ({ visible, onClose, onEdit }: { visible: boolean; onClose: () => void; onEdit: (w: EditWhat) => void }) => {
  const { c } = useTheme();
  const { profile, online, roles, changePassword, deleteAccount, signOut } = useProfile();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [delErr, setDelErr] = useState<string | null>(null);

  useEffect(() => {
    if (visible) return;
    setCur(''); setPw(''); setPw2(''); setPwMsg(null); setDelOpen(false); setTyped(''); setDelErr(null);
  }, [visible]);

  if (!profile) return null;

  const sync = !backendConfigured ? 'This phone only' : online ? 'Synced with Spartans' : 'Saved on this phone, syncs when online';

  const doChange = async () => {
    if (busy) return;
    if (pw !== pw2) { setPwMsg({ ok: false, text: 'The two new passwords do not match.' }); return; }
    setBusy(true);
    const e = await changePassword(cur, pw);
    setBusy(false);
    if (e) { setPwMsg({ ok: false, text: e }); return; }
    setCur(''); setPw(''); setPw2('');
    setPwMsg({ ok: true, text: 'Password changed. Use the new one next time you sign in.' });
  };

  const doDelete = async () => {
    if (busy || typed.trim().toUpperCase() !== 'DELETE') return;
    if (!(await ask('Delete your account?', 'This cannot be undone.', 'Delete', true))) return;
    setBusy(true);
    const e = await deleteAccount();
    setBusy(false);
    if (e) setDelErr(e);
    // On success the profile is gone and the app returns to the sign-up screen.
  };

  const doSignOut = async () => {
    if (await ask('Sign out?', 'Your account stays on this device.', 'Sign out', true)) { onClose(); signOut(); }
  };

  const pwRow = (value: string, set: (v: string) => void, placeholder: string, label: string) => (
    <TextInput
      value={value}
      onChangeText={t => { set(t); setPwMsg(null); }}
      placeholder={placeholder}
      placeholderTextColor={c.ink4}
      secureTextEntry={!show}
      autoCapitalize="none"
      autoCorrect={false}
      accessibilityLabel={label}
      style={fieldStyle(c)}
    />
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Account & privacy">
      {/* Who you are */}
      <ListCard>
        <Row icon="me" label={fullName(profile) || 'Student'} sub={`Grade ${profile.grade}${profile.studentId ? ` · Student # ${profile.studentId}` : ''}`} onPress={() => onEdit('profile')} />
        <Row icon="mail" label={profile.email || 'No school email'} sub="Your sign-in. Can't be changed." />
        <Row icon="cloud" label={sync} sub={roles.length ? `App Club: ${rankLabel(roles as Role[])}` : 'Account type: student'} last />
      </ListCard>

      {/* Password */}
      <Label>Change password</Label>
      {!!profile.passwordHash || backendConfigured ? pwRow(cur, setCur, 'Current password', 'Current password') : null}
      {pwRow(pw, setPw, `New password, at least ${MIN_PASSWORD} characters`, 'New password')}
      {pwRow(pw2, setPw2, 'New password again', 'Confirm new password')}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => setShow(v => !v)} hitSlop={8}>
          <Text style={{ fontSize: 13, color: c.navy700, fontWeight: '600' }}>{show ? 'Hide passwords' : 'Show passwords'}</Text>
        </Pressable>
      </View>
      {pwMsg && <Text style={{ fontSize: 13, color: pwMsg.ok ? c.moss : c.crimson }}>{pwMsg.text}</Text>}
      <Button label={busy && !delOpen ? 'Saving…' : 'Change password'} onPress={doChange} disabled={busy || !pw || !pw2} />

      {/* Privacy */}
      <Label>Who sees what</Label>
      <ListCard>
        <Row icon="users" label="Friends you accept" sub="Your name, grade, timetable, badges and level. Used for Compare and Today together." />
        <Row icon="search" label="Other students" sub="Can find you only with your exact school email or student number, and see just your name and grade until you accept." />
        <Row icon="shield" label="App Club owners" sub="Can see account details to fix problems. They never see your password." />
        <Row icon="id" label="Only you" sub="Your grades, homework checkmarks, personal events and ID photo stay on this phone." last />
      </ListCard>
      <Text style={{ fontSize: 12, color: c.ink4, lineHeight: 17 }}>
        Remove a friend any time from Social. Spartans is run by students in the School App Club and is not an official school app.
      </Text>

      <Button label="Sign out" onPress={doSignOut} tone="plain" />

      {/* Delete */}
      <Label>Delete account</Label>
      {!delOpen ? (
        <ListCard>
          <Row icon="trash" label="Delete my account" sub="Removes your account and everything in it" danger onPress={() => setDelOpen(true)} last />
        </ListCard>
      ) : (
        <View style={{ borderWidth: 1, borderColor: c.crimson, borderRadius: 16, padding: 14, gap: 10, backgroundColor: c.crimsonTint }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.crimson }}>This deletes, for good:</Text>
          {[
            'Your Spartans account and sign-in',
            'Your profile, timetable and programs',
            'Your friends and friend requests',
            'Your badges, XP and poll votes',
            'Grades, events, pins and settings on this phone',
          ].map(t => (
            <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: c.crimson }}>•</Text>
              <Text style={{ flex: 1, fontSize: 13.5, color: c.ink2, lineHeight: 19 }}>{t}</Text>
            </View>
          ))}
          {roles.length > 0 && (
            <Text style={{ fontSize: 13, color: c.ink2, lineHeight: 18 }}>
              {roles.includes('owner') ? 'You are an App Club owner. Make sure another owner exists first. ' : ''}
              Posts you made for the club stay up without your name.
            </Text>
          )}
          <Text style={{ fontSize: 13, color: c.ink2 }}>Type DELETE to confirm.</Text>
          <TextInput
            value={typed}
            onChangeText={t => { setTyped(t); setDelErr(null); }}
            placeholder="DELETE"
            placeholderTextColor={c.ink4}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Type DELETE to confirm"
            style={fieldStyle(c)}
          />
          {!!delErr && <Text style={{ fontSize: 13, color: c.crimson }}>{delErr}</Text>}
          <Button label={busy ? 'Deleting…' : 'Delete my account'} tone="crimson" onPress={doDelete} disabled={busy || typed.trim().toUpperCase() !== 'DELETE'} />
          <Button label="Keep my account" tone="plain" onPress={() => { setDelOpen(false); setTyped(''); setDelErr(null); }} />
        </View>
      )}
    </Sheet>
  );
};

// ════════════════════════════════════════════════════════════════
// Help & feedback
// ════════════════════════════════════════════════════════════════
const FAQ: [string, string][] = [
  ['How do I change my classes?', 'Settings, then Edit classes. Switch between Day 1, Day 2 and Outside, then tap Save.'],
  ['My room or teacher is wrong.', 'Fix it in Edit classes. Your timetable is yours: nobody else can change it.'],
  ['How do I add a friend?', 'Social, then Add friend. Use their student number or school email. They have to accept.'],
  ['Where do my grades go?', 'Nowhere. Grades you type stay on this phone only.'],
  ['Is this the official school app?', "No. Spartans is Sentinel Secondary's unofficial app, built by students in the School App Club."],
];

const HelpSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  const { list, send } = useFeedback();
  const { roles, profile } = useProfile();
  const who = feedbackFrom(roles as Role[], profile?.email);
  const [area, setArea] = useState<string | null>(null);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [faq, setFaq] = useState<number | null>(null);

  const k = FEEDBACK_KINDS.find(x => x.id === kind);
  const needsText = kind !== null && kind !== 'like';
  const ready = !!area && !!kind && (!needsText || msg.trim().length > 0);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const sent = await send({ area: area!, kind: kind!, message: msg, ...who });
    setBusy(false);
    setDone(sent ? 'Sent to the App Club. Thank you!' : 'Saved on this phone. It sends next time you are online.');
    setMsg(''); setKind(null); setArea(null);
  };

  const kindColor = (id: FeedbackKind) => id === 'like' ? c.moss : id === 'fix' ? c.crimson : id === 'idea' ? c.gold : c.sky600;

  return (
    <Sheet visible={visible} onClose={onClose} title="Help & feedback">
      <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>
        Tell the School App Club what works and what doesn't. Every message is read.
      </Text>
      <Text style={{ fontSize: 12.5, color: c.ink4 }}>
        Sending as {who.from === 'club' ? `an App Club member (${roleLabel(who.fromRole as Role)})` : who.from === 'teacher' ? 'a teacher' : 'a student'}.
      </Text>

      <Label>1. What is it about?</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {FEEDBACK_AREAS.map(a => {
          const on = area === a;
          return (
            <Pressable key={a} onPress={() => { setArea(on ? null : a); setDone(null); }} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ pressed }) => ({ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? c.navy700 : c.line, backgroundColor: on ? c.navy700 : pressed ? c.paper2 : c.surface })}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{a}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label>2. How do you feel about it?</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FEEDBACK_KINDS.map(x => {
          const on = kind === x.id;
          const col = kindColor(x.id);
          return (
            <Pressable key={x.id} onPress={() => { setKind(on ? null : x.id); setDone(null); }} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ pressed }) => ({ width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: on ? col : c.line, backgroundColor: on ? c.surface : pressed ? c.paper2 : c.surface })}>
              <Icon name={x.icon} size={18} stroke={2} color={col} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: on ? col : c.ink }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label>3. Tell us more</Label>
      <TextInput
        value={msg}
        onChangeText={t => { setMsg(t.slice(0, 2000)); setDone(null); }}
        placeholder={k?.hint || 'Pick a feeling above first'}
        placeholderTextColor={c.ink4}
        multiline
        textAlignVertical="top"
        accessibilityLabel="Feedback message"
        style={[fieldStyle(c), { minHeight: 110 }]}
      />
      <Button label={busy ? 'Sending…' : area && kind ? `Send about ${area}` : 'Send feedback'} onPress={submit} disabled={!ready || busy} />
      {!!done && <Text style={{ fontSize: 13, color: c.moss, fontWeight: '600' }}>{done}</Text>}

      {list.length > 0 && (
        <>
          <Label>Your feedback</Label>
          <ListCard>
            {list.slice(0, 10).map((f, i) => {
              const kk = FEEDBACK_KINDS.find(x => x.id === f.kind);
              return (
                <View key={f.id} style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: i === Math.min(list.length, 10) - 1 ? 0 : 1, borderBottomColor: c.line2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Icon name={kk?.icon || 'message'} size={13} stroke={2.2} color={kindColor(f.kind)} />
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: kindColor(f.kind) }}>{kk?.label}</Text>
                    <Text style={{ fontSize: 12.5, color: c.ink3 }}>· {f.area}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={{ fontSize: 11, color: f.sent ? c.ink4 : c.gold, fontWeight: '600' }}>{f.sent ? new Date(f.at).toLocaleDateString() : 'Waiting to send'}</Text>
                  </View>
                  {!!f.message && <Text numberOfLines={3} style={{ fontSize: 13, color: c.ink2, marginTop: 4, lineHeight: 18 }}>{f.message}</Text>}
                </View>
              );
            })}
          </ListCard>
        </>
      )}

      <Label>Help</Label>
      <ListCard>
        {FAQ.map(([q, a], i) => {
          const on = faq === i;
          return (
            <Pressable key={q} onPress={() => setFaq(on ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: on }}
              style={{ paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: i === FAQ.length - 1 ? 0 : 1, borderBottomColor: c.line2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.ink }}>{q}</Text>
                <Icon name={on ? 'minus' : 'plus'} size={15} stroke={2} color={c.ink4} />
              </View>
              {on && <Text style={{ fontSize: 13.5, color: c.ink3, marginTop: 6, lineHeight: 19 }}>{a}</Text>}
            </Pressable>
          );
        })}
      </ListCard>
    </Sheet>
  );
};

// ════════════════════════════════════════════════════════════════
// App Club Admin pieces still drawn here and used by AdminScreen.
// ════════════════════════════════════════════════════════════════
// Event banners: every template, tap to see exactly what students get.
// Previews never mark a banner seen or unlock a badge. The banner is drawn
// inside this sheet (iOS can't stack a modal from outside it).
export const BannerGallery = () => {
  const { c } = useTheme();
  const { profile } = useProfile();
  const [preview, setPreview] = useState<string | null>(null);
  const groups: [string, typeof EVENT_TEMPLATES][] = [
    ['Posted by App Club', EVENT_TEMPLATES.filter(t => t.source === 'admin')],
    ['From the school calendar', EVENT_TEMPLATES.filter(t => t.source === 'calendar')],
    ['Same date every year', EVENT_TEMPLATES.filter(t => t.source === 'date')],
  ];
  return (
    <View style={{ marginTop: 8, gap: 10 }}>
      <Label>Event banners</Label>
      <Text style={{ fontSize: 13, color: c.ink3, lineHeight: 18 }}>
        Shown once when a student opens the app on that day. Tap one to preview it.
      </Text>
      {groups.map(([title, list]) => (
        <View key={title} style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: c.ink3 }}>{title}</Text>
          <ListCard>
            {list.map((t, i) => {
              const badge = typeof t.badge === 'function' ? t.badge(profile?.grade || 8) : t.badge;
              return (
                <Pressable key={t.id} onPress={() => setPreview(t.id)} accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12,
                    borderBottomWidth: i === list.length - 1 ? 0 : 1, borderBottomColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
                  <LinearGradient colors={t.colors as [string, string, ...string[]]} start={G135.start} end={G135.end}
                    style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                    <Image source={t.art} style={{ width: 24, height: 24 }} resizeMode="contain" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: c.ink }}>{t.name}</Text>
                    <Text style={{ fontSize: 12, color: c.ink3 }}>{badge ? `Badge: ${BADGES.find(b => b.id === badge)?.title || badge}` : 'No badge'}</Text>
                  </View>
                  <Icon name="play" size={14} stroke={2} color={c.ink4} />
                </Pressable>
              );
            })}
          </ListCard>
        </View>
      ))}
            <EventBanner day={preview ? previewDay(preview, toISO(new Date()), profile?.grade || 8) : null} preview
        onClose={() => setPreview(null)} onAction={() => setPreview(null)} />
    </View>
  );
};

// Owners: everything students sent from Help & feedback, newest first.
export const FeedbackInbox = ({ visible }: { visible: boolean }) => {
  const { c } = useTheme();
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedbackKind | 'all'>('all');

  const load = async () => {
    setErr(null);
    try { const { feedback } = await import('../backend'); setRows(await feedback.list()); }
    catch (e: any) { setErr(String(e?.message || 'Could not load feedback.')); }
  };
  useEffect(() => { if (visible) load(); }, [visible]);

  const remove = async (id: string) => {
    if (!(await ask('Delete this feedback?', 'It is removed for every owner.', 'Delete', true))) return;
    try { const { feedback } = await import('../backend'); await feedback.remove(id); setRows(r => (r || []).filter(x => x.id !== id)); }
    catch (e: any) { setErr(String(e?.message || 'Could not delete.')); }
  };

  const shown = (rows || []).filter(r => filter === 'all' || r.kind === filter);
  const count = (k: FeedbackKind) => (rows || []).filter(r => r.kind === k).length;

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Label>Feedback inbox</Label>
        <Pressable onPress={load} hitSlop={8}><Text style={{ fontSize: 13, color: c.navy700, fontWeight: '600' }}>Refresh</Text></Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(['all', ...FEEDBACK_KINDS.map(k => k.id)] as (FeedbackKind | 'all')[]).map(k => {
          const on = filter === k;
          const label = k === 'all' ? `All ${rows?.length ?? ''}` : `${FEEDBACK_KINDS.find(x => x.id === k)!.label} ${count(k)}`;
          return (
            <Pressable key={k} onPress={() => setFilter(k)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: on ? c.navy700 : c.line, backgroundColor: on ? c.navy700 : c.surface }}>
              <Text style={[{ fontSize: 12, fontWeight: '600', color: on ? '#fff' : c.ink2 }, tnum]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {!!err && <Text style={{ fontSize: 13, color: c.crimson }}>{err}</Text>}
      {rows === null && !err && <Text style={{ fontSize: 13, color: c.ink3 }}>Loading…</Text>}
      {rows !== null && shown.length === 0 && <Text style={{ fontSize: 13, color: c.ink3 }}>Nothing here yet.</Text>}
      {shown.length > 0 && (
        <ListCard>
          {shown.map((f, i) => (
            <View key={f.id} style={{ paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: i === shown.length - 1 ? 0 : 1, borderBottomColor: c.line2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.ink }}>{FEEDBACK_KINDS.find(x => x.id === f.kind)?.label}</Text>
                <Text style={{ fontSize: 12.5, color: c.ink3 }}>· {f.area}</Text>
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: 11, color: c.ink4 }}>{new Date(f.created_at).toLocaleDateString()}</Text>
                <Pressable onPress={() => remove(f.id)} hitSlop={8} accessibilityLabel="Delete feedback">
                  <Icon name="trash" size={14} stroke={1.9} color={c.ink4} />
                </Pressable>
              </View>
              {!!f.message && <Text selectable style={{ fontSize: 13, color: c.ink2, marginTop: 4, lineHeight: 18 }}>{f.message}</Text>}
              {!!f.platform && <Text style={{ fontSize: 11, color: c.ink4, marginTop: 3 }}>{f.platform} · {f.app_version}</Text>}
            </View>
          ))}
        </ListCard>
      )}
    </View>
  );
};
