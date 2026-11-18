// Spartans — App Club → the Developer screen. The app owner's tools on one
// screen (no sub-pages). Nobody else gets here: AdminScreen shows it only with
// useDevAccess (src/devAccess.ts).
//   View as        see the club the way any role does
//   Temp adjusters testing controls nobody else sees (time preview, Catch Up practice)
//   Widgets        what the last widget / Live Activity write did (iOS)
//   Server         which migrations are on the server (the backend check)
//   Jump to        every screen in the app
//   This build     version, platform, server mode

import React, { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import app from '../../app.json';
import { useTheme } from '../ThemeContext';
import { Icon } from '../components/Icon';
import type { TabId } from '../components/Chrome';
import { useNav } from '../nav';
import { useContent } from '../content';
import { usePreviewTime } from '../PreviewTime';
import { backendConfigured } from '../supabase';
import { APP_VERSION } from '../settings';
import { PAGES } from '../pages';
import { mainRole, roleLabel, rankLabel } from '../ranks';
import { Toggle } from '../screens/Settings';
import { Act, Group, Hint, Row } from './ui';
import { getWidgetStatus, onWidgetStatus, requestWidgetRefresh } from '../widgets/status';
import { startCatchUpPractice } from '../catchUpPractice';
import { useProfile } from '../ProfileContext';

const SCREENS: { tab: TabId; label: string; art: any }[] = [
  { tab: 'home', label: 'Home', art: require('../../assets/map/school.png') },
  { tab: 'programs', label: 'Programs', art: require('../../assets/subjects/books.png') },
  { tab: 'calendar', label: 'Calendar', art: require('../../assets/homework/alarm.png') },
  { tab: 'announcements', label: 'Announcements', art: require('../../assets/subjects/newspaper.png') },
  { tab: 'social', label: 'Social', art: require('../../assets/subjects/speech.png') },
  { tab: 'more', label: 'More', art: require('../../assets/pages/pin.png') },
  ...PAGES.filter(p => p.go).map(p => ({ tab: p.go!, label: p.label, art: p.art })),
  { tab: 'me', label: 'Profile', art: require('../../assets/subjects/star.png') },
];

export const DeveloperScreen = ({ onViewAs }: { onViewAs: () => void }) => {
  const nav = useNav();
  const store = useContent();
  const pt = usePreviewTime();
  const { profile } = useProfile();
  const viewing = store.viewAs !== null
    ? (store.viewAs.length ? roleLabel(mainRole(store.viewAs) || store.viewAs[0]) : 'Not in the club')
    : null;
  return (
    <View style={{ gap: 24 }}>
      <Group title="See the club as anyone" footer="Every App Club page shows the way that role sees it. Pick yours again to come back.">
        <Row icon="eye" label="View as another role" detail={viewing || 'You'} onPress={onViewAs} />
        {viewing && <Row icon="swap" label="Back to your own view" onPress={() => store.setViewAs(null)} />}
      </Group>

      <Group title="Temp adjusters" footer="Only on this phone. Nobody else sees these.">
        <Row icon="clock" label="Time preview on Home" sub="Scrub the day card to any time today"
          trailing={<Toggle on={pt.tools} onChange={pt.setTools} label="Time preview on Home" />} />
        {pt.active && <Row icon="swap" label="Back to the real time" onPress={pt.clear} />}
        <Row icon="play" label="Practice Catch Up" sub="Run it as any grade, as often as you like. Saves nothing, gives no badges."
          onPress={() => startCatchUpPractice(profile?.grade ?? 8)} />
      </Group>

      {Platform.OS === 'ios' && <WidgetCheck />}

      <ServerCheck />

      <Group title="Jump to a screen">
        {SCREENS.map(s => <Row key={s.tab + s.label} art={s.art} label={s.label} onPress={() => nav.go(s.tab)} />)}
      </Group>

      <Group title="This build">
        <Row icon="id" label="Version" detail={`${APP_VERSION} (${app.expo.version})`} />
        <Row icon="phone" label="Running on" detail={`${Platform.OS}${Platform.OS !== 'web' ? ` ${Platform.Version}` : ''}`} />
        <Row icon="cloud" label="Server" detail={store.mode === 'demo' ? 'None (demo)' : store.mode === 'live' ? 'Connected' : 'Partly set up'} />
        <Row icon="shield" label="Your roles" sub={rankLabel(store.realRoles) || 'None'} />
      </Group>
    </View>
  );
};

// ── Widgets ─────────────────────────────────────────────────────
// Release builds hide widget errors; this shows them. "Refresh" rewrites every
// widget and steps the Live Activity (for the previewed time, if one is set).
const WidgetCheck = () => {
  const [st, setSt] = useState(getWidgetStatus);
  useEffect(() => onWidgetStatus(setSt), []);
  const names = Object.keys(st.results);
  return (
    <Group title="Widgets & Live Activity" footer={st.previewing
      ? 'Written for the previewed time. Back to the real time rewrites them.'
      : 'Widgets refresh when the app opens. The Live Activity starts only while the app is open, from an hour before first bell.'}>
      {names.length === 0 && <Row icon="clock" label="Not written yet" sub="Sign in and open Home" />}
      {names.map(n => (
        <Row key={n} icon={st.results[n] === 'ok' ? 'check' : 'close'} label={n}
          sub={st.results[n] === 'ok' ? undefined : st.results[n]}
          detail={st.results[n] === 'ok' ? 'Up to date' : 'Failed'} />
      ))}
      <Row icon="phone" label="Live Activity" sub={st.live} />
      <Row icon="swap" label="Refresh widgets now"
        detail={st.at ? new Date(st.at).toTimeString().slice(0, 5) : undefined}
        onPress={requestWidgetRefresh} />
    </Group>
  );
};

// ── Server check ────────────────────────────────────────────────
type Check = { id: string; label: string; needs: string; run: () => Promise<unknown> };
const CHECKS = (): Check[] => {
  const sb = () => import('../supabase').then(m => m.supabase);
  const ok = async (p: PromiseLike<{ error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(r.error.message); };
  return [
    { id: 'auth', label: 'Signed in', needs: 'an account on this phone', run: async () => { const s = await sb(); const { data } = await s.auth.getSession(); if (!data.session) throw new Error('Not signed in'); } },
    { id: 'profiles', label: 'Profiles and roles', needs: 'migration 0001', run: async () => ok((await sb()).from('members').select('role').limit(1)) },
    { id: 'posts', label: 'App Club posts', needs: 'migration 0008', run: async () => ok((await sb()).from('posts').select('id').limit(1)) },
    { id: 'designs', label: 'Badge designs', needs: 'migration 0011', run: async () => ok((await sb()).from('badge_designs').select('id').limit(1)) },
    { id: 'ranks', label: 'Team managers, feedback status', needs: 'migrations 0012 and 0013', run: async () => ok((await sb()).from('feedback').select('status').limit(1)) },
    { id: 'avatars', label: 'Avatars', needs: 'migration 0014', run: async () => ok((await sb()).from('profiles').select('avatar').limit(1)) },
    { id: 'photos', label: 'Profile photos', needs: 'migration 0015', run: async () => ok((await sb()).rpc('friend_cards')) },
    { id: 'club', label: 'Five teams, boards, badge grants', needs: 'migrations 0016 and 0017', run: async () => ok((await sb()).from('club_items').select('id').limit(1)) },
  ];
};

const ServerCheck = () => {
  const { c } = useTheme();
  const [results, setResults] = useState<Record<string, true | string>>({});
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setResults({});
    for (const ch of CHECKS()) {
      try { await ch.run(); setResults(r => ({ ...r, [ch.id]: true })); }
      catch (e: any) { setResults(r => ({ ...r, [ch.id]: String(e?.message || 'Failed') })); }
    }
    setBusy(false);
  };
  if (!backendConfigured) {
    return (
      <Group title="Server">
        <Row icon="cloud" label="No server on this build" sub="No Supabase keys in .env. BACKEND.md has the setup steps." />
      </Group>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Group title="Server" footer="Which migrations have run, as far as this account can tell.">
        {CHECKS().map(ch => {
          const r = results[ch.id];
          return (
            <Row key={ch.id} label={ch.label} sub={typeof r === 'string' ? r : `Needs ${ch.needs}`}
              trailing={
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: r === true ? c.mossTint : r ? c.crimsonTint : c.paper2 }}>
                  <Icon name={r === true ? 'check' : r ? 'close' : 'minus'} size={13} stroke={2.8} color={r === true ? c.moss : r ? c.danger : c.ink4} />
                </View>
              } />
          );
        })}
      </Group>
      <Act label={busy ? 'Checking…' : 'Run the checks'} icon="swap" fill onPress={run} disabled={busy} />
      {Object.values(results).some(r => r !== true) && !busy && <Hint warn text="Anything with a cross needs its migration run in the Supabase SQL editor." />}
    </View>
  );
};

