// Spartans — a teacher's "New announcement": write it once, send it to one
// class or several. Three things to do: pick the classes, a title, the message.
//
// Each class gets its own post, for that block only (program_posts.slot,
// migration 0026): the students in that block see it on the class page and in
// Announcements, and other sections of the same course don't. Opened from a
// class, that class is already picked.

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../ThemeContext';
import { tnum } from '../theme';
import { Icon } from './Icon';
import { Act, ClubSheet, Field, FieldLabel, Result } from '../admin/ui';
import { ART } from '../ranks';
import { useContent } from '../content';
import { useProfile, Slot } from '../ProfileContext';
import { postToProgram } from '../clubs';
import { TeacherClass, useRosters } from '../teacher';

export const TeacherCompose = ({ visible, classes, start, onClose, onPosted }: {
  visible: boolean; classes: TeacherClass[]; start?: Slot[]; onClose: () => void; onPosted: (n: number) => void;
}) => {
  const { c } = useTheme();
  const { mode } = useContent();
  const { profile } = useProfile();
  const rosters = useRosters();
  const [to, setTo] = useState<Slot[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Fresh each time it opens: the class it was opened from, or the only class.
  useEffect(() => {
    if (!visible) return;
    setTo(start?.length ? start : classes.length === 1 ? [classes[0].slot] : []);
    setTitle(''); setBody(''); setPinned(false); setErr(null); setBusy(false);
  }, [visible]);   // eslint-disable-line react-hooks/exhaustive-deps

  const all = classes.length > 1 && to.length === classes.length;
  const toggle = (s: Slot) => setTo(v => v.includes(s) ? v.filter(x => x !== s) : [...v, s]);
  const students = to.reduce((n, s) => n + rosters.count(s), 0);
  const ready = to.length > 0 && !!title.trim() && !busy;

  const post = async () => {
    if (!ready) return;
    setBusy(true); setErr(null);
    let sent = 0;
    let failed: string | null = null;
    for (const k of classes.filter(x => to.includes(x.slot))) {
      try { await postToProgram(mode, profile, k.name, { title, body, pinned, slot: k.slot }); sent++; }
      catch (e: any) { failed = String(e?.message || 'Could not post. Try again.'); break; }
    }
    setBusy(false);
    if (failed) {
      setErr(sent ? `Sent to ${sent} of ${to.length}, then stopped: ${failed}` : failed);
      // What went out is done: leave only the classes still to send.
      if (sent) setTo(v => v.slice(sent));
      return;
    }
    onPosted(sent);
    onClose();
  };

  return (
    <ClubSheet visible={visible} onClose={onClose} title="New announcement" sub="Your students see it in Announcements and on the class page" art={ART.megaphone}
      footer={<>
        {!!err && <Result msg={{ ok: false, text: err }} />}
        <Act fill busy={busy} disabled={!ready} icon="news" onPress={post}
          label={!to.length ? 'Pick a class first' : to.length === 1 ? 'Post to this class' : `Post to ${to.length} classes`} />
      </>}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <FieldLabel text="Send to" />
          {classes.length > 1 && (
            <Pressable onPress={() => setTo(all ? [] : classes.map(k => k.slot))} hitSlop={10} accessibilityRole="button">
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.link }}>{all ? 'Clear' : 'All my classes'}</Text>
            </Pressable>
          )}
        </View>
        {classes.length === 0 ? (
          <Text style={{ fontSize: 14, color: c.ink3, lineHeight: 20 }}>You have no classes yet. Add them in Home → Edit my classes.</Text>
        ) : (
          <View style={{ borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }}>
            {classes.map((k, i) => {
              const on = to.includes(k.slot);
              const n = rosters.count(k.slot);
              return (
                <Pressable key={k.slot} onPress={() => toggle(k.slot)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  accessibilityLabel={`${k.name}, block ${k.slot}${n ? `, ${n} students` : ''}`}
                  style={({ pressed }) => ({ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line2, backgroundColor: pressed ? c.paper2 : 'transparent' })}>
                  <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: on ? 0 : 1.5, borderColor: c.ink4, backgroundColor: on ? c.action : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on && <Icon name="check" size={15} stroke={2.6} color="#fff" />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '600', color: c.ink, letterSpacing: -0.2 }}>{k.name}</Text>
                    <Text numberOfLines={1} style={[{ fontSize: 12.5, color: c.ink3, marginTop: 1 }, tnum]}>
                      Block {k.slot}{n ? ` · ${n} on Spartans` : ''}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <Field label="Title" value={title} onChangeText={setTitle} placeholder="Quiz moved to Thursday" maxLength={120} returnKeyType="next" />
      <Field label="Message (optional)" value={body} onChangeText={setBody} placeholder="What do they need to know?" maxLength={4000} multiline />

      <Pressable onPress={() => setPinned(v => !v)} accessibilityRole="switch" accessibilityState={{ checked: pinned }} accessibilityLabel="Keep at the top of the class page"
        style={({ pressed }) => ({ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
        <Icon name="pin" size={17} stroke={2} color={pinned ? c.link : c.ink3} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: c.ink }}>Keep at the top of the class page</Text>
        <View style={{ width: 44, height: 26, borderRadius: 13, padding: 3, backgroundColor: pinned ? c.action : c.line, justifyContent: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', alignSelf: pinned ? 'flex-end' : 'flex-start' }} />
        </View>
      </Pressable>

      {to.length > 0 && students > 0 && (
        <Text style={[{ fontSize: 13, color: c.ink3, lineHeight: 18 }, tnum]}>
          {students} {students === 1 ? 'student has' : 'students have'} {to.length === 1 ? 'this class' : 'these classes'} on Spartans so far.
        </Text>
      )}
    </ClubSheet>
  );
};
