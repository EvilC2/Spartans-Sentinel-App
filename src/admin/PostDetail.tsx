// Spartans — App Club Admin: one post's numbers and where it is.
// Views (unique students who saw it), opens (taps to read, banners shown),
// and for trivia and polls every choice with its votes. Edit / take down /
// put back up from here too.

import React, { useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Modal, Image } from 'react-native';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum } from '../theme';
import { Icon } from '../components/Icon';
import { useContent, Post, KINDS, PLACES, PHASES, phaseOf, titleOf, subOf, imageOf } from '../content';
import { fmtWhen, Btn } from './PostEditor';
import { ask } from '../confirm';

export const PostDetail = ({ post, onClose, onEdit }: { post: Post | null; onClose: () => void; onEdit: (p: Post) => void }) => {
  const { c } = useTheme();
  const store = useContent();
  // Read the freshest copy (it may have just been edited).
  const p = post ? store.posts.find(x => x.id === post.id) || post : null;
  useEffect(() => { if (p) store.loadStats([p.id]); }, [p?.id]);
  if (!p) return <Modal visible={false} />;

  const phase = phaseOf(p, store.now);
  const s = store.stats(p.id);
  const t = p.kind === 'trivia' || p.kind === 'poll' ? store.tally(p.id) : null;
  const can = store.canEdit(p.kind);
  const tone = { moss: c.moss, sky: c.sky600, ink: c.ink3, gold: c.gold }[PHASES[phase].tone];

  const setStatus = async (status: 'draft' | 'published') => {
    const msg = status === 'draft' ? ['Take it down?', 'Students stop seeing it right away. It stays as a draft.', 'Take down'] : ['Put it up again?', 'It shows right away in the same places.', 'Publish'];
    if (!(await ask(msg[0], msg[1], msg[2], status === 'draft'))) return;
    await store.save({ ...p, status, endsAt: status === 'published' && p.endsAt && Date.parse(p.endsAt) <= Date.now() ? null : p.endsAt, startsAt: status === 'published' ? p.startsAt ?? new Date().toISOString() : p.startsAt } as Post);
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={KINDS[p.kind].icon} size={16} stroke={1.9} color={c.ink3} />
            <Text style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: c.ink3 }}>{KINDS[p.kind].label}</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: tone }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: tone }}>{PHASES[phase].label}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12}><Text style={{ fontSize: 15, color: c.navy700, fontWeight: '600' }}>Done</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 60, gap: 18 }}>
          {!!imageOf(p) && <Image source={{ uri: imageOf(p)! }} style={{ width: '100%', height: 150, borderRadius: 16 }} resizeMode="cover" />}
          <View>
            <Text style={{ fontFamily: fonts.serif, fontSize: 24, lineHeight: 28, color: c.ink }}>{titleOf(p) || 'Untitled'}</Text>
            <Text numberOfLines={3} style={{ fontSize: 13.5, color: c.ink3, marginTop: 4, lineHeight: 19 }}>{subOf(p)}</Text>
          </View>

          {/* Numbers */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Num label="Saw it" value={s?.viewers} />
            <Num label={p.kind === 'popup' ? 'Banner shown' : 'Opened'} value={s?.opens} />
            {t && <Num label={p.kind === 'poll' ? 'Votes' : 'Answers'} value={t.total} />}
          </View>
          {s?.sample && <Text style={{ fontSize: 12, color: c.ink4, marginTop: -8 }}>Demo: sample numbers plus what this phone did.</Text>}
          {store.mode === 'live' && !s && <Text style={{ fontSize: 12, color: c.ink4, marginTop: -8 }}>Loading numbers…</Text>}

          {/* Answers */}
          {t && (p.kind === 'trivia' || p.kind === 'poll') && (
            <View style={{ gap: 8 }}>
              <Head text={p.kind === 'trivia' ? `Answers · ${t.total ? Math.round((t.counts[p.data.answer] / t.total) * 100) : 0}% got it right` : 'Results'} />
              {p.data.options.map((o, i) => {
                const share = t.total ? t.counts[i] / t.total : 0;
                const right = p.kind === 'trivia' && i === p.data.answer;
                return (
                  <View key={i} style={{ height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: right ? c.moss : c.line, justifyContent: 'center', paddingHorizontal: 12 }}>
                    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(share * 100)}%`, backgroundColor: right ? 'rgba(91,122,78,0.22)' : 'rgba(59,139,217,0.18)' }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {right && <Icon name="check" size={14} stroke={2.6} color={c.moss} />}
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.ink }}>{o}</Text>
                      <Text style={[{ fontSize: 13, color: c.ink2, fontWeight: '600' }, tnum]}>{t.counts[i]} · {Math.round(share * 100)}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Where + when */}
          <View style={{ gap: 8 }}>
            <Head text="Where and when" />
            <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 14, gap: 10 }, shadow.sm]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {p.places.map(pl => (
                  <View key={pl} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: c.navy50 }}>
                    <Icon name={PLACES[pl].icon} size={13} stroke={2} color={c.navy700} />
                    <Text style={{ fontSize: 12.5, fontWeight: '600', color: c.navy700 }}>{PLACES[pl].label}</Text>
                  </View>
                ))}
                {p.pinned && <Text style={{ fontSize: 12.5, fontWeight: '700', color: c.gold, alignSelf: 'center' }}>Pinned</Text>}
              </View>
              <Text style={[{ fontSize: 13, color: c.ink2 }, tnum]}>Starts: {p.startsAt ? fmtWhen(p.startsAt) : p.status === 'draft' ? 'when published' : fmtWhen(p.createdAt)}</Text>
              <Text style={[{ fontSize: 13, color: c.ink2 }, tnum]}>Ends: {p.endsAt ? fmtWhen(p.endsAt) : 'when taken down'}</Text>
              <Text style={[{ fontSize: 12, color: c.ink4 }, tnum]}>Last changed {fmtWhen(p.updatedAt)}</Text>
            </View>
          </View>

          {can ? (
            <View style={{ gap: 10 }}>
              <Btn label="Edit" onPress={() => onEdit(p)} />
              {phase === 'live' || phase === 'scheduled'
                ? <Btn label="Take down" tone="plain" onPress={() => setStatus('draft')} />
                : <Btn label={phase === 'ended' ? 'Put it up again' : 'Publish now'} tone="plain" onPress={() => setStatus('published')} />}
            </View>
          ) : (
            <Text style={{ fontSize: 13, color: c.ink3 }}>You can see this, but only the {KINDS[p.kind].role} team or an owner can change it.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const Num = ({ label, value }: { label: string; value?: number }) => {
  const { c } = useTheme();
  return (
    <View style={[{ flex: 1, padding: 12, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }, shadow.sm]}>
      <Text style={[{ fontSize: 24, fontWeight: '700', color: c.ink, letterSpacing: -0.5 }, tnum]}>{value === undefined ? '–' : value.toLocaleString()}</Text>
      <Text style={{ fontSize: 12, color: c.ink3, fontWeight: '600', marginTop: 1 }}>{label}</Text>
    </View>
  );
};

const Head = ({ text }: { text: string }) => {
  const { c } = useTheme();
  return <Text style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: c.ink3 }}>{text}</Text>;
};
