// Spartans — App Club "View as" (TEMPORARY, for testing). Lets the app's owner
// see App Club the way any role does:
//   ViewAsButton  the eye in the header. Gold while you're viewing as someone.
//   ViewAsBar     under the header while you are: who, and the way back.
//   ViewAsSheet   pick a view. Four club-wide views, then one line per team;
//                 a team opens to its roles.
// Picking one makes App Club act as that role; picking yours goes back to you.
// Offered to the owner only (`canViewAs`, src/devAccess.ts); the server still
// checks your real roles.

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../ThemeContext';
import { shadow } from '../theme';
import { Icon } from '../components/Icon';
import { useContent } from '../content';
import type { Role } from '../backend';
import { TEAMS, TEAM_ORDER, TeamId, TOP, isLead, mainRole, roleLabel, teamOf } from '../ranks';
import { Choice, ClubSheet, Fold, Group } from './ui';

const viewLabel = (v: Role[]) => (v.length ? roleLabel(mainRole(v) || v[0]) : 'someone not in the club');

export const ViewAsButton = ({ onPress }: { onPress: () => void }) => {
  const { c } = useTheme();
  const { viewAs } = useContent();
  const on = viewAs !== null;
  return (
    <Pressable onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityState={{ selected: on }}
      accessibilityLabel={on ? `Viewing as ${viewLabel(viewAs!)}. Change view` : 'View as another role'}
      style={({ pressed }) => [{
        width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
        backgroundColor: on ? '#DDB566' : c.surface, borderWidth: 1, borderColor: on ? '#C9A04E' : c.line, opacity: pressed ? 0.7 : 1,
      }, shadow.sm]}>
      <Icon name="eye" size={18} stroke={on ? 2.1 : 1.8} color={on ? '#14243A' : c.ink2} />
    </Pressable>
  );
};

export const ViewAsBar = () => {
  const { c, mode } = useTheme();
  const { viewAs, setViewAs, canViewAs } = useContent();
  if (!canViewAs || viewAs === null) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingLeft: 14, paddingRight: 4, borderRadius: 14, backgroundColor: c.goldTint }}>
      <Icon name="eye" size={16} stroke={2} color={mode === 'dark' ? '#E4C27E' : '#6B4C17'} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: c.ink2 }}>Viewing as <Text style={{ fontWeight: '700', color: c.ink }}>{viewLabel(viewAs)}</Text></Text>
      <Pressable onPress={() => setViewAs(null)} accessibilityRole="button" accessibilityLabel="Back to your own view"
        style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: c.link }}>Exit</Text>
      </Pressable>
    </View>
  );
};

export const ViewAsSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { viewAs, setViewAs, realRoles, mode } = useContent();
  const mine = mainRole(realRoles);
  // What's showing now: the view you picked, or your own main role.
  const current: Role | 'none' | null = viewAs === null ? mine : viewAs.length ? mainRole(viewAs) || viewAs[0] : 'none';
  const currentTeam = current && current !== 'none' && !TOP.includes(current) ? teamOf(current) : null;
  const [open, setOpen] = useState<TeamId | null>(null);
  useEffect(() => { if (visible) setOpen(currentTeam); }, [visible]);   // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (r: Role | 'none') => {
    setViewAs(r === 'none' ? [] : r === mine ? null : [r]);
    onClose();
  };
  const you = (r: Role) => (r === mine ? ' (you)' : '');

  const club: { r: Role | 'none'; label: string }[] = [
    ...TOP.filter(r => r !== 'owner').map(r => ({ r, label: roleLabel(r) + you(r) })),
    { r: 'teacher' as Role, label: `${roleLabel('teacher')}, not in the club` },
    { r: 'none', label: 'Student, not in the club' },
  ];

  return (
    <ClubSheet visible={visible} onClose={onClose} title="View as" sub="See App Club the way another role does">
      <Group>
        {club.map(o => <Choice key={o.r} label={o.label} on={current === o.r} onPress={() => pick(o.r)} inset={16} />)}
      </Group>
      <Group title="Teams" footer={mode === 'demo' ? 'For testing. Nothing you do here leaves this phone.' : 'For testing. The server still uses your real roles.'}>
        {TEAM_ORDER.map(t => {
          const team = TEAMS[t];
          const roles: Role[] = [...(team.lead ? [team.lead] : []), ...team.jobs.map(j => j.role).filter(r => !TOP.includes(r))];
          return (
            <Fold key={t} art={team.art} label={team.label} open={open === t} onToggle={() => setOpen(o => (o === t ? null : t))}
              sub={currentTeam === t ? roleLabel(current as Role) : `${roles.length} roles`}>
              {roles.map(r => <Choice key={r} label={(isLead(r) ? 'Manager' : roleLabel(r)) + you(r)} on={current === r} onPress={() => pick(r)} />)}
            </Fold>
          );
        })}
      </Group>
    </ClubSheet>
  );
};
