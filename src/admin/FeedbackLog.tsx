// Spartans — App Club → Feedback → Real: feedback heard in person, logged by
// hand. Who said it (a student, a teacher, or an App Club member and their
// role), their name if they gave one, where you heard it, what part of the
// app, what kind, and what they said. It lands in the same inbox as app
// feedback, marked "in person", so the team works through both the same way.

import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../ThemeContext';
import { useProfile, fullName } from '../ProfileContext';
import type { FeedbackFrom, FeedbackKind, Role } from '../backend';
import { FEEDBACK_AREAS, FEEDBACK_KINDS } from '../settings';
import { TEAMS, TEAM_ORDER, TeamId, TOP, roleLabel, isLead } from '../ranks';
import { FeedbackTeam, FROM, useFeedbackInbox } from './FeedbackTeam';
import { Act, Card, CardHead, ChipPick, Field, Hint, SectionTitle, Seg } from './ui';

const WHERE = ['In class', 'Hallway', 'Lunch', 'Club meeting', 'Student council', 'Email', 'Other'];

export const FeedbackLog = ({ canDelete }: { canDelete: boolean }) => {
  const { c } = useTheme();
  const { profile } = useProfile();
  const inbox = useFeedbackInbox();
  const [from, setFrom] = useState<FeedbackFrom>('student');
  const [team, setTeam] = useState<TeamId | 'top'>('maintenance');
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [where, setWhere] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; text: string } | null>(null);

  const roles: Role[] = team === 'top' ? TOP
    : [...(TEAMS[team].lead ? [TEAMS[team].lead!] : []), ...TEAMS[team].jobs.map(j => j.role)].filter(r => !TOP.includes(r));
  const needsText = kind !== null && kind !== 'like';
  const ready = !!area && !!kind && (!needsText || msg.trim().length > 0) && (from !== 'club' || !!role);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true); setDone(null);
    try {
      await inbox.log({
        area: area!, kind: kind!, message: msg.trim(), from_type: from, from_role: from === 'club' ? role : null,
        heard_at: where, said_by: name.trim() || null,
      }, fullName(profile!) || 'You');
      setDone({ ok: true, text: 'Logged. It is in the list below.' });
      setMsg(''); setKind(null); setArea(null); setName(''); setWhere(null);
    } catch (e: any) { setDone({ ok: false, text: String(e?.message || 'Could not log it.') }); }
    finally { setBusy(false); }
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <CardHead icon="edit" tone="crimson" title="Log what you heard" sub="Someone told you about the app in person? Write it down here." />

        <Step text="Who said it?" />
        <Seg value={from} onChange={v => { setFrom(v); setRole(null); }} options={(['student', 'teacher', 'club'] as FeedbackFrom[]).map(f => ({ id: f, label: f === 'club' ? 'App Club member' : FROM[f].label }))} />
        {from === 'club' && (
          <View style={{ gap: 10 }}>
            <Seg value={team} onChange={v => { setTeam(v); setRole(null); }} options={[{ id: 'top' as const, label: 'Top' }, ...TEAM_ORDER.map(t => ({ id: t, label: TEAMS[t].label }))]} />
            <ChipPick multi={false} value={role ? [role] : []} onToggle={r => setRole(r)}
              options={roles.map(r => ({ id: r, label: isLead(r) ? 'Manager' : roleLabel(r) }))} />
          </View>
        )}
        <Field value={name} onChangeText={setName} placeholder={from === 'teacher' ? 'Their name (optional), e.g. Mr. Grant' : 'Their name or grade (optional)'} />

        <Step text="Where did you hear it?" />
        <ChipPick multi={false} value={where ? [where] : []} onToggle={w => setWhere(where === w ? null : w)} options={WHERE.map(w => ({ id: w, label: w }))} />

        <Step text="What part of the app?" />
        <ChipPick multi={false} value={area ? [area] : []} onToggle={a => setArea(area === a ? null : a)} options={FEEDBACK_AREAS.map(a => ({ id: a, label: a }))} />

        <Step text="What kind?" />
        <ChipPick multi={false} value={kind ? [kind] : []} onToggle={k => setKind(kind === k ? null : k)} options={FEEDBACK_KINDS.map(k => ({ id: k.id, label: k.label, icon: k.icon }))} />

        <Field value={msg} onChangeText={setMsg} multiline placeholder={kind ? FEEDBACK_KINDS.find(k => k.id === kind)!.hint : 'What did they say?'} />
        <Act label={busy ? 'Logging…' : 'Log it'} icon="check" fill onPress={submit} disabled={!ready || busy} />
        {done && <Text style={{ fontSize: 14, fontWeight: '600', color: done.ok ? c.moss : c.danger }}>{done.text}</Text>}
      </Card>

      {!inbox.live && <Hint text="Demo mode: logged feedback stays on this phone." />}
      <SectionTitle title="Logged in person" />
      <FeedbackTeam canDelete={canDelete} source="real" inbox={inbox} />
    </View>
  );
};

const Step = ({ text }: { text: string }) => {
  const { c } = useTheme();
  return <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: c.ink3, marginTop: 4 }}>{text}</Text>;
};
