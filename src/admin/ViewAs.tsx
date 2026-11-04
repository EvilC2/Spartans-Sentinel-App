// Spartans — App Club "View" (TEMPORARY, for testing). The button in the
// header's top right opens a list of every view: someone who isn't in the
// club (the join page), President, Teacher Sponsor, and every role on every
// team. Picking one makes App Club act as that role; picking your own role
// goes back to you. While you're viewing as someone else the button lights
// up gold, and nothing else on the page changes. Offered in demo mode, to
// developers and to top ranks; the server still checks your real roles.

import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../ThemeContext';
import { shadow, G135 } from '../theme';
import { Icon } from '../components/Icon';
import { useContent } from '../content';
import type { Role } from '../backend';
import { TEAMS, TEAM_ORDER, TOP, ART, isLead, mainRole, roleArt, roleLabel } from '../ranks';
import { ClubSheet, Group, Hint } from './ui';

export const ViewAsButton = ({ onPress }: { onPress: () => void }) => {
  const { c } = useTheme();
  const { viewAs } = useContent();
  const on = viewAs !== null;
  const label = on ? `Viewing as ${viewAs!.length ? roleLabel(mainRole(viewAs!) || viewAs![0]) : 'not in the club'}` : 'View as another role';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}>
      {on ? (
        <LinearGradient colors={['#E4C27E', '#B68842', '#8A6424']} {...G135}
          style={[{ height: 38, borderRadius: 19, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 }, shadow.sm]}>
          <Icon name="eye" size={16} stroke={2.3} color="#fff" />
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>View</Text>
        </LinearGradient>
      ) : (
        <View style={[{ height: 38, borderRadius: 19, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, shadow.sm]}>
          <Icon name="eye" size={16} stroke={2} color={c.ink2} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: c.ink2 }}>View</Text>
        </View>
      )}
    </Pressable>
  );
};

export const ViewAsSheet = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { c } = useTheme();
  const { viewAs, setViewAs, realRoles, mode } = useContent();
  const mine = mainRole(realRoles);
  // What's showing now: the view you picked, or your own main role.
  const current: Role | 'none' | null = viewAs === null ? mine : viewAs.length ? mainRole(viewAs) : 'none';
  const pick = (r: Role | 'none') => {
    setViewAs(r === 'none' ? [] : r === mine ? null : [r]);
    onClose();
  };

  const Opt = ({ r, label, sub, art }: { r: Role | 'none'; label: string; sub?: string; art: any }) => {
    const on = current === r;
    return (
      <Pressable onPress={() => pick(r)} accessibilityRole="radio" accessibilityState={{ selected: on }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 58, paddingVertical: 9, paddingHorizontal: 14, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
        <Image source={art} style={{ width: 30, height: 30 }} resizeMode="contain" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: on ? '800' : '600', color: c.ink }}>{label}{r === mine ? ' (you)' : ''}</Text>
          {!!sub && <Text numberOfLines={1} style={{ fontSize: 13, color: c.ink3, marginTop: 1 }}>{sub}</Text>}
        </View>
        {on && <Icon name="check" size={18} stroke={2.6} color={c.gold} />}
      </Pressable>
    );
  };

  return (
    <ClubSheet visible={visible} onClose={onClose} title="View as" sub="See App Club the way each role does">
      <Hint text={`Temporary, for testing. ${mode === 'demo' ? 'In demo mode everything stays on this phone.' : 'The server still uses your real roles.'}`} />
      <Group>
        <Opt r="none" label="Not in the club" sub="The join page" art={ART.globe} />
        {TOP.filter(r => r !== 'owner').map(r => <Opt key={r} r={r} label={roleLabel(r)} sub={TEAMS.executive.jobs.find(j => j.role === r)?.sub} art={roleArt(r)} />)}
      </Group>
      {TEAM_ORDER.map(t => {
        const team = TEAMS[t];
        const roles: Role[] = [...(team.lead ? [team.lead] : []), ...team.jobs.map(j => j.role).filter(r => !TOP.includes(r))];
        return (
          <Group key={t} title={team.label}>
            {roles.map(r => (
              <Opt key={r} r={r} label={isLead(r) ? 'Manager' : roleLabel(r)} sub={isLead(r) ? `Runs ${team.label}` : team.jobs.find(j => j.role === r)?.sub} art={roleArt(r)} />
            ))}
          </Group>
        );
      })}
    </ClubSheet>
  );
};
