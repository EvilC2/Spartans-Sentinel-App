// Spartans — App Club → Badge team: the three ways to give badges out.
//   AwardGrant  Award-based Grantor: pick a badge, pick the students who
//               earned it, say why, give it.
//   ListGrant   List-based Grantor: pick a badge, then a whole group: a
//               program (class), a team or club, or a sign-in list (school
//               emails or student numbers, pasted from an attendance sheet).
//   QrGrant     QR-code-based Grantor: every QR badge with its code, shown
//               big enough to put up at an event or print as a poster.
//               Students scan it from their Badges page (claimBadgeCode).
// Live: award_badge_many / program_roster / find_many / claim_badge_code
// (migration 0017). Demo: sample students, and "given" is kept on this phone.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../ThemeContext';
import { tnum } from '../theme';
import { Icon } from '../components/Icon';
import { BadgeArt } from '../components/BadgeArt';
import { BADGES, Badge, RARITY } from '../badges';
import { useBadgeDesigns, qrPayload, howSummary, toBadge, placeName, allDesigns } from '../badgeDesigns';
import { earnBadge } from '../earned';
import { matchPrograms } from '../programs';
import { useContent } from '../content';
import { ask } from '../confirm';
import type { GrantTarget } from '../backend';
import { ART } from '../ranks';
import { Act, Card, CardHead, ChipPick, ClubSheet, Empty, Field, Hint, Pill, Search, SectionTitle, Seg, ago } from './ui';

// ── Shared ──────────────────────────────────────────────────────
type Student = { id: string; name: string; email: string; grade?: number; studentId?: string | null };
const toStudent = (r: GrantTarget): Student => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim() || r.email, email: r.email, grade: r.grade, studentId: r.student_id });

const DEMO_STUDENTS: Student[] = [
  { id: 'demo-maya', name: 'Maya Chen', email: 'mayac118@edu.sd45.bc.ca', grade: 10, studentId: '1049385' },
  { id: 'demo-noah', name: 'Noah Patel', email: 'noahp442@edu.sd45.bc.ca', grade: 11, studentId: '1050212' },
  { id: 'demo-priya-s', name: 'Priya Singh', email: 'priyas507@edu.sd45.bc.ca', grade: 11, studentId: '1048777' },
  { id: 'demo-sam-s', name: 'Sam Lee', email: 'saml129@edu.sd45.bc.ca', grade: 9, studentId: '1061430' },
  { id: 'demo-leo-s', name: 'Leo Duarte', email: 'leod883@edu.sd45.bc.ca', grade: 12, studentId: '1039921' },
  { id: 'demo-ivy', name: 'Ivy Okoro', email: 'ivyo215@edu.sd45.bc.ca', grade: 8, studentId: '1070034' },
];

type Given = { badge: string; title: string; count: number; to: string; reason: string; at: string };
const GIVEN_KEY = 'spartans-badges-given-v1';

const useGiving = () => {
  const { mode } = useContent();
  const live = mode !== 'demo';   // sample students never show on a real account
  const [given, setGiven] = useState<Given[]>([]);
  useEffect(() => { AsyncStorage.getItem(GIVEN_KEY).then(v => v && setGiven(JSON.parse(v))).catch(() => {}); }, []);

  const remember = (g: Given) => {
    const next = [g, ...given].slice(0, 30);
    setGiven(next);
    AsyncStorage.setItem(GIVEN_KEY, JSON.stringify(next)).catch(() => {});
  };

  const give = async (badge: Badge, to: Student[], reason: string, label: string) => {
    if (live) {
      const { grants, badges } = await import('../backend');
      try { await grants.give(to.map(s => s.id), badge.id, reason); }
      catch (e: any) {
        // Before 0017: one at a time with the old award_badge.
        if (!/award_badge_many|does not exist|schema cache/i.test(String(e?.message))) throw e;
        for (const s of to) await badges.award(s.id, badge.id, reason);
      }
    }
    remember({ badge: badge.id, title: badge.title, count: to.length, to: label, reason, at: new Date().toISOString() });
  };

  const search = async (q: string): Promise<Student[]> => {
    if (!live) { const s = q.trim().toLowerCase(); return DEMO_STUDENTS.filter(x => `${x.name} ${x.email} ${x.studentId}`.toLowerCase().includes(s)); }
    const { team } = await import('../backend');
    return (await team.find(q)).map(r => ({ id: r.id, name: `${r.first_name} ${r.last_name}`.trim(), email: r.email, grade: r.grade }));
  };
  const roster = async (program: string): Promise<Student[]> => {
    if (!live) return DEMO_STUDENTS.filter((_, i) => (program.length + i) % 2 === 0);
    const { grants } = await import('../backend');
    return (await grants.roster(program)).map(toStudent);
  };
  const lookup = async (keys: string[]): Promise<Student[]> => {
    if (!live) return DEMO_STUDENTS.filter(s => keys.some(k => k.toLowerCase() === s.email || k === s.studentId || `${k.toLowerCase()}@edu.sd45.bc.ca` === s.email));
    const { grants } = await import('../backend');
    return (await grants.lookup(keys)).map(toStudent);
  };

  return { live, given, give, search, roster, lookup };
};

// Pick one badge: search every badge, art + rarity.
const BadgePick = ({ value, onPick }: { value: Badge | null; onPick: (b: Badge | null) => void }) => {
  const { c } = useTheme();
  const { catalog } = useBadgeDesigns();
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const list = useMemo(() => BADGES.filter(b => !s || `${b.title} ${b.desc}`.toLowerCase().includes(s)).slice(0, s ? 30 : 12), [s, catalog]);
  if (value) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: c.goldTint }}>
        <BadgeArt badge={value} size={58} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: c.ink }}>{value.title}</Text>
          <Text numberOfLines={2} style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>{RARITY[value.rarity].label} · {value.desc}</Text>
        </View>
        <Act label="Change" small tone="plain" onPress={() => onPick(null)} />
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Search value={q} onChange={setQ} placeholder="Search badges" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map(b => (
          <Pressable key={b.id} onPress={() => onPick(b)} accessibilityRole="button" accessibilityLabel={b.title}
            style={({ pressed }) => ({ width: '31%', flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line2, opacity: pressed ? 0.7 : 1 })}>
            <BadgeArt badge={b} size={52} />
            <Text numberOfLines={2} style={{ fontSize: 12, fontWeight: '700', color: c.ink, textAlign: 'center' }}>{b.title}</Text>
          </Pressable>
        ))}
      </View>
      {!list.length && <Text style={{ fontSize: 13, color: c.ink3 }}>No badge called that.</Text>}
    </View>
  );
};

const Step = ({ n, text }: { n: number; text: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.gold, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>{n}</Text>
      </View>
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: c.ink }}>{text}</Text>
    </View>
  );
};

const StudentChip = ({ s, onRemove }: { s: Student; onRemove?: () => void }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: onRemove ? 6 : 12, minHeight: 34, borderRadius: 999, backgroundColor: c.navy50 }}>
      <Text style={{ fontSize: 13.5, fontWeight: '600', color: c.link }}>{s.name}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${s.name}`} style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface }}>
          <Icon name="close" size={11} stroke={2.6} color={c.ink3} />
        </Pressable>
      )}
    </View>
  );
};

const History = ({ given }: { given: Given[] }) => {
  if (!given.length) return null;
  return (
    <>
      <SectionTitle title="Recently given" />
      <Card pad={14}>
        {given.slice(0, 8).map((g, i) => {
          const b = BADGES.find(x => x.id === g.badge);
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: i ? 10 : 0 }}>
              {b ? <BadgeArt badge={b} size={40} /> : <View style={{ width: 40 }} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <GText bold text={`${g.title} → ${g.count === 1 ? g.to : `${g.count} students`}`} />
                <GText text={[g.count > 1 ? g.to : null, g.reason, ago(g.at)].filter(Boolean).join(' · ')} />
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
};
const GText = ({ text, bold }: { text: string; bold?: boolean }) => {
  const { c } = useTheme();
  return <Text numberOfLines={bold ? 1 : 2} style={bold ? { fontSize: 14.5, fontWeight: '700', color: c.ink } : { fontSize: 12.5, color: c.ink3, marginTop: 1 }}>{text}</Text>;
};

// ════════════════════════════════════════════════════════════════
// Award-based
// ════════════════════════════════════════════════════════════════
export const AwardGrant = () => {
  const { c } = useTheme();
  const g = useGiving();
  const [badge, setBadge] = useState<Badge | null>(null);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Student[] | null>(null);
  const [picked, setPicked] = useState<Student[]>([]);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (q.trim().length < 2) return;
    try { setFound(await g.search(q)); } catch (e: any) { setMsg({ ok: false, text: String(e?.message || 'Search failed.') }); }
  };
  const give = async () => {
    if (!badge || !picked.length || !reason.trim() || busy) return;
    setBusy(true); setMsg(null);
    try {
      await g.give(badge, picked, reason.trim(), picked.length === 1 ? picked[0].name : `${picked.length} students`);
      setMsg({ ok: true, text: `${badge.title} given to ${picked.length === 1 ? picked[0].name : `${picked.length} students`}.` });
      setPicked([]); setReason(''); setFound(null); setQ('');
    } catch (e: any) { setMsg({ ok: false, text: String(e?.message || 'Could not give it.') }); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 14 }}>
      {!g.live && <Hint text="Demo: sample students, and nothing is really given." />}
      <Card>
        <Step n={1} text="Which badge?" />
        <BadgePick value={badge} onPick={setBadge} />
      </Card>
      {badge && (
        <Card>
          <Step n={2} text="Who earned it?" />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><Field value={q} onChangeText={setQ} onSubmitEditing={search} placeholder="Name, school email or student number" autoCapitalize="none" autoCorrect={false} returnKeyType="search" /></View>
            <Act label="Find" icon="search" tone="soft" onPress={search} disabled={q.trim().length < 2} />
          </View>
          {found && found.length === 0 && <Text style={{ fontSize: 13, color: c.ink3 }}>Nobody found.</Text>}
          {found && found.filter(f => !picked.some(p => p.id === f.id)).map(f => (
            <Pressable key={f.id} onPress={() => setPicked(p => [...p, f])} accessibilityRole="button" accessibilityLabel={`Add ${f.name}`}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink }}>{f.name}</Text>
                <Text style={{ fontSize: 12.5, color: c.ink3 }}>{[f.grade ? `Grade ${f.grade}` : null, f.email].filter(Boolean).join(' · ')}</Text>
              </View>
              <Icon name="plus" size={18} stroke={2.4} color={c.link} />
            </Pressable>
          ))}
          {picked.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {picked.map(p => <StudentChip key={p.id} s={p} onRemove={() => setPicked(x => x.filter(y => y.id !== p.id))} />)}
            </View>
          )}
        </Card>
      )}
      {badge && picked.length > 0 && (
        <Card>
          <Step n={3} text="Why?" />
          <Field value={reason} onChangeText={setReason} placeholder="Top scorer at the Science Fair" />
          <Act label={busy ? 'Giving…' : `Give to ${picked.length === 1 ? picked[0].name.split(' ')[0] : `${picked.length} students`}`} icon="badge" tone="gold" fill onPress={give} disabled={!reason.trim() || busy} />
        </Card>
      )}
      {msg && <Text style={{ fontSize: 14, fontWeight: '600', color: msg.ok ? c.moss : c.danger }}>{msg.text}</Text>}
      <History given={g.given} />
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// List-based
// ════════════════════════════════════════════════════════════════
type Source = 'program' | 'team' | 'list';
const CLASS_KINDS = ['class', 'outside', 'online'];

export const ListGrant = () => {
  const { c } = useTheme();
  const g = useGiving();
  const [badge, setBadge] = useState<Badge | null>(null);
  const [source, setSource] = useState<Source>('program');
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [people, setPeople] = useState<Student[] | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => q.trim().length < 2 ? [] : matchPrograms(q)
    .filter(e => source === 'program' ? CLASS_KINDS.includes(e.kind) : !CLASS_KINDS.includes(e.kind)).slice(0, 8), [q, source]);

  useEffect(() => { setGroup(null); setPeople(null); setMissing([]); setQ(''); }, [source]);

  const pickGroup = async (name: string) => {
    setGroup(name); setPeople(null); setMsg(null);
    try { setPeople(await g.roster(name)); } catch (e: any) { setMsg({ ok: false, text: /program_roster|does not exist|schema cache/i.test(String(e?.message)) ? 'Program lists need migration 0017 on the server.' : String(e?.message || 'Could not load the list.') }); }
  };
  const readList = async () => {
    const keys = [...new Set(paste.split(/[\s,;]+/).map(k => k.trim()).filter(Boolean))];
    if (!keys.length) return;
    setMsg(null);
    try {
      const out = await g.lookup(keys);
      setPeople(out);
      setGroup(`${keys.length} on the list`);
      setMissing(keys.filter(k => !out.some(s => s.email.toLowerCase() === k.toLowerCase() || s.studentId === k || s.email.toLowerCase().startsWith(k.toLowerCase() + '@'))));
    } catch (e: any) { setMsg({ ok: false, text: /find_many|does not exist|schema cache/i.test(String(e?.message)) ? 'Sign-in lists need migration 0017 on the server.' : String(e?.message || 'Could not read the list.') }); }
  };
  const give = async () => {
    if (!badge || !people?.length || !reason.trim() || busy) return;
    if (!(await ask(`Give ${badge.title} to ${people.length} students?`, `Everyone in ${group}.`, 'Give it'))) return;
    setBusy(true); setMsg(null);
    try {
      await g.give(badge, people, reason.trim(), group || 'a list');
      setMsg({ ok: true, text: `${badge.title} given to ${people.length} students.` });
      setPeople(null); setGroup(null); setPaste(''); setReason(''); setMissing([]);
    } catch (e: any) { setMsg({ ok: false, text: String(e?.message || 'Could not give it.') }); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 14 }}>
      {!g.live && <Hint text="Demo: sample students, and nothing is really given." />}
      <Card>
        <Step n={1} text="Which badge?" />
        <BadgePick value={badge} onPick={setBadge} />
      </Card>
      {badge && (
        <Card>
          <Step n={2} text="Who gets it?" />
          <Seg value={source} onChange={setSource} options={[{ id: 'program', label: 'A class' }, { id: 'team', label: 'A team or club' }, { id: 'list', label: 'Sign-in list' }]} />
          {source !== 'list' ? (
            group ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, backgroundColor: c.paper2 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink }}>{group}</Text>
                  <Text style={[{ fontSize: 12.5, color: c.ink3 }, tnum]}>{people === null ? 'Finding everyone…' : `${people.length} students on Spartans`}</Text>
                </View>
                <Act label="Change" small tone="plain" onPress={() => { setGroup(null); setPeople(null); }} />
              </View>
            ) : (
              <>
                <Field value={q} onChangeText={setQ} placeholder={source === 'program' ? 'Search classes, e.g. Chemistry 11' : 'Search teams and clubs, e.g. Senior Boys Soccer'} autoCorrect={false} />
                {matches.map(m => (
                  <Pressable key={m.name} onPress={() => pickGroup(m.name)} accessibilityRole="button"
                    style={({ pressed }) => ({ paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line2, opacity: pressed ? 0.6 : 1 })}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: c.ink }}>{m.name}</Text>
                  </Pressable>
                ))}
              </>
            )
          ) : (
            <>
              <Field value={paste} onChangeText={setPaste} multiline placeholder={'One per line: school emails or student numbers\njohnd907@edu.sd45.bc.ca\n1049385'} autoCapitalize="none" autoCorrect={false} />
              <Act label="Read the list" icon="tasks" tone="soft" fill onPress={readList} disabled={!paste.trim()} />
              {missing.length > 0 && <Hint warn text={`Not found on Spartans (${missing.length}): ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`} />}
            </>
          )}
          {people && people.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {people.slice(0, 18).map(p => <StudentChip key={p.id} s={p} onRemove={() => setPeople(x => (x || []).filter(y => y.id !== p.id))} />)}
              {people.length > 18 && <Pill text={`+${people.length - 18} more`} tone="ink" />}
            </View>
          )}
          {people && people.length === 0 && <Text style={{ fontSize: 13, color: c.ink3 }}>Nobody on Spartans has that yet.</Text>}
        </Card>
      )}
      {badge && !!people?.length && (
        <Card>
          <Step n={3} text="Why?" />
          <Field value={reason} onChangeText={setReason} placeholder="Made the playoffs" />
          <Act label={busy ? 'Giving…' : `Give to all ${people.length}`} icon="badge" tone="gold" fill onPress={give} disabled={!reason.trim() || busy} />
        </Card>
      )}
      {msg && <Text style={{ fontSize: 14, fontWeight: '600', color: msg.ok ? c.moss : c.danger }}>{msg.text}</Text>}
      <History given={g.given} />
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// QR-code-based
// ════════════════════════════════════════════════════════════════
export const QrGrant = () => {
  const { c } = useTheme();
  const { designs } = useBadgeDesigns();
  const [show, setShow] = useState<{ badge: Badge; code: string; where: string } | null>(null);
  const [filter, setFilter] = useState<'live' | 'waiting'>('live');
  const qr = designs.filter(d => d.how.kind === 'qr' && !!d.how.code);
  const live = qr.filter(d => d.status === 'approved');
  const waiting = qr.filter(d => d.status !== 'approved');
  const list = filter === 'live' ? live : waiting;

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <CardHead art={ART.camera} tone="gold" title="Put up a code" sub="Show a code at an event, or print it as a poster. Students scan it from their Badges page to get the badge." />
      </Card>
      <Seg value={filter} onChange={setFilter} options={[{ id: 'live', label: 'Ready to use', count: live.length }, { id: 'waiting', label: 'Not approved yet', count: waiting.length }]} />
      {list.length === 0 && (
        <Empty art={ART.camera} title={filter === 'live' ? 'No QR badges yet' : 'Nothing waiting'}
          sub={filter === 'live' ? 'A Creator makes one in the badge designer by picking "QR code" as the way to get it.' : undefined} />
      )}
      {list.map(d => {
        const b = toBadge(d);
        const where = (d.how.places || []).map(placeName).join(', ');
        return (
          <Card key={d.id} pad={14}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <BadgeArt badge={b} size={56} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: c.ink }}>{b.title || 'Untitled'}</Text>
                <Text numberOfLines={2} style={{ fontSize: 12.5, color: c.ink3, marginTop: 1 }}>{[where || howSummary(d.how), RARITY[b.rarity]?.label].filter(Boolean).join(' · ')}</Text>
              </View>
              <View style={{ padding: 6, borderRadius: 10, backgroundColor: '#fff' }}>
                <QRCode value={qrPayload(d.how.code!)} size={52} color="#0E2238" backgroundColor="#fff" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Act label="Show big" icon="qr" fill onPress={() => setShow({ badge: b, code: d.how.code!, where })} disabled={d.status !== 'approved'} />
              <Act label="Copy code" icon="copy" tone="soft" onPress={() => Clipboard.setStringAsync(d.how.code!).catch(() => {})} />
            </View>
          </Card>
        );
      })}
      <QrPoster show={show} onClose={() => setShow(null)} />
    </View>
  );
};

// Full screen: badge, name, the code as big as the screen allows.
const QrPoster = ({ show, onClose }: { show: { badge: Badge; code: string; where: string } | null; onClose: () => void }) => {
  const { width, height } = useWindowDimensions();
  if (!show) return null;
  const size = Math.min(width - 80, height * 0.42, 420);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: '#0E2238' }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}>
        <BadgeArt badge={show.badge} size={110} />
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.6 }}>{show.badge.title}</Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center' }}>Scan with Spartans to get this badge{show.where ? ` at ${show.where}` : ''}</Text>
        <View style={{ padding: 18, borderRadius: 24, backgroundColor: '#fff' }}>
          <QRCode value={qrPayload(show.code)} size={size} color="#0E2238" backgroundColor="#fff" />
        </View>
        <Text style={[{ fontSize: 13, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 }, tnum]}>{show.code}</Text>
        <Pressable onPress={onClose} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 8, minHeight: 46, paddingHorizontal: 24, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Done</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
};

// ── Students: claiming a scanned code ───────────────────────────
// `raw` is what the camera read (spartans://badge?code=…) or a typed code.
// Returns the badge earned, or throws with a message to show.
export const claimBadgeCode = async (raw: string, live: boolean): Promise<Badge> => {
  const m = /[?&]code=([^&]+)/.exec(raw);
  const code = decodeURIComponent(m ? m[1] : raw).trim().toUpperCase();
  if (!code) throw new Error('That code is empty.');
  const today = new Date().toISOString().slice(0, 10);
  if (live) {
    const { grants } = await import('../backend');
    let id: string | null;
    try { id = await grants.claim(code); }
    catch (e: any) { throw new Error(/claim_badge_code|does not exist|schema cache/i.test(String(e?.message)) ? 'Badge codes need migration 0017 on the server.' : String(e?.message || 'Could not claim it.')); }
    if (!id) throw new Error('That code is not for a badge, or it has ended.');
    const b = BADGES.find(x => x.id === id);
    if (!b) throw new Error('Got it. It shows once the app updates its badges.');
    earnBadge(id, today);
    return b;
  }
  const designs = allDesigns();
  const d = designs.find(x => x.how.kind === 'qr' && (x.how.code || '').toUpperCase() === code && x.status === 'approved' && x.badgeId);
  const b = d ? BADGES.find(x => x.id === d.badgeId) : null;
  if (!b) throw new Error('That code is not for a badge, or it has ended.');
  earnBadge(b.id, today);
  return b;
};
