// Spartans — Badge team wizard (App Club Admin → Badges → Design a badge).
// Laid out like the open badge page (BadgeDetail): colour glow fading to
// paper, the badge big in the middle, "Badge Unlocked", title, description,
// rarity pill. The page IS the editor: step 1 types the title and
// description in place, and the badge on top updates as you go.
//   1 Idea          title + description
//   2 How to get it seasonal (when?) · attendance (where?) · QR code · granted
//   3 Rarity        seasonal fills itself in and the badge stays empty
//   4 Art           an icon on the rarity template (drag, pinch, resize) or a
//                   whole-badge PNG
//   5 Send          check it over, pick where it shows, send for approval
// Editing an existing badge uses the same steps, filled in with what the
// badge has now. Closing saves a draft. Managers (Badges manager, owners)
// publish straight away, and approve or send back other people's work.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal, TextInput, Image, Platform, PanResponder, Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../ThemeContext';
import { shadow, tnum } from '../theme';
import { Icon, IconName } from '../components/Icon';
import { BadgeArt, BadgeTemplate, RarityPill, TiltBadge, iconBox } from '../components/BadgeArt';
import { CATEGORY, CATEGORY_ORDER, Category, CustomArt, RARITY, SEASON, Rarity } from '../badges';
import { RARITY_XP } from '../xp';
import { useKeyboardHeight } from '../useKeyboard';
import { ask } from '../confirm';
import {
  BadgeDesign, HowKind, HOW, HOW_ORDER, PICKABLE, PLACES, STATUS, seasonOf, categoryFor, stepProblems, readyToSend,
  howSummary, toBadge, freshCode, qrPayload, saveDesign, submitDesign, removeDesign, reviewDesign, publishDesign, uploadArt, useBadgeDesigns,
} from '../badgeDesigns';
import { Chips } from './PostEditor';
import { fieldStyle } from '../screens/Settings';

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: 'Idea' }, { n: 2, label: 'How to get it' }, { n: 3, label: 'Rarity' }, { n: 4, label: 'Art' }, { n: 5, label: 'Send' },
];
const firstOpen = (d: BadgeDesign): Step => {
  if (d.status === 'pending' || d.status === 'approved') return 5;
  const p = stepProblems(d);
  return p[1] ? 1 : p[2] ? 2 : p[3] ? 3 : p[4] ? 4 : d.title ? 5 : 1;   // edits open on the summary
};

// `canApprove`: owner or Badges manager.
export const BadgeWizard = ({ design, canApprove, onClose }: { design: BadgeDesign | null; canApprove: boolean; onClose: () => void }) => {
  const { c, mode: theme } = useTheme();
  const { mode } = useBadgeDesigns();
  const kb = useKeyboardHeight();
  const desc = useRef<TextInput>(null);
  const [d, setD] = useState<BadgeDesign | null>(design);
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const dirty = useRef(false);

  useEffect(() => {
    setD(design); setErr(null); setReviewNote(''); dirty.current = false;
    if (design) setStep(firstOpen(design));
  }, [design]);

  if (!d) return null;
  const locked = d.status === 'pending' || d.status === 'approved';
  const problems = stepProblems(d);
  const badge = toBadge(d);
  const tint = d.rarity ? (d.season ? SEASON[d.season] : RARITY[d.rarity]) : null;
  const glow = tint ? (tint.chrome ? '#C9CFD6' : tint.color) : c.navy600;

  const patch = (p: Partial<BadgeDesign>) => {
    dirty.current = true;
    setErr(null);
    setD(cur => (cur ? { ...cur, ...p } : cur));
  };

  // Changing how it's earned keeps the rarity honest: seasonal forces
  // Seasonal, and leaving seasonal clears it so a real one gets picked.
  const setHow = (kind: HowKind) => {
    const how = { ...d.how, kind, code: kind === 'qr' ? d.how.code || freshCode() : d.how.code };
    const season = kind === 'seasonal' ? seasonOf(how.date) : undefined;
    // An edited seasonal badge can stay "built in" and keep its season.
    const keepSeason = kind === 'builtin' && d.rarity === 'seasonal';
    const rarity: Rarity | null = kind === 'seasonal' ? 'seasonal' : d.rarity === 'seasonal' && !keepSeason ? null : d.rarity;
    patch({ how, season: keepSeason ? d.season : season, rarity, category: categoryFor(kind, d.category) });
  };

  const close = async () => {
    if (!locked && dirty.current && (d.title.trim() || d.desc.trim())) {
      try { await saveDesign({ ...d, status: 'draft' }); } catch { /* the list shows the server error on refresh */ }
    }
    onClose();
  };

  const next = () => {
    if (step < 5) {
      const p = problems[step as 1 | 2 | 3 | 4];
      if (p) { setErr(p); return; }
      setStep((step + 1) as Step);
    }
  };
  const back = () => { setErr(null); if (step > 1) setStep((step - 1) as Step); };
  const jump = (n: Step) => {
    setErr(null);
    // Forward only past steps that are done.
    for (let s = 1; s < n; s++) if (problems[s as 1 | 2 | 3 | 4]) { setStep(s as Step); setErr(problems[s as 1 | 2 | 3 | 4]); return; }
    setStep(n);
  };

  // Members send it for approval; managers publish it.
  const send = async () => {
    Keyboard.dismiss();
    if (!readyToSend(d)) { const s = ([1, 2, 3, 4] as const).find(n => problems[n])!; setStep(s); setErr(problems[s]); return; }
    setBusy(true); setErr(null);
    try { await (canApprove ? publishDesign(d) : submitDesign(d)); dirty.current = false; onClose(); }
    catch (e: any) { setErr(String(e?.message || 'Could not send it.')); }
    finally { setBusy(false); }
  };
  const takeBack = async () => {
    setBusy(true); setErr(null);
    try { const out = await saveDesign({ ...d, status: 'draft', submittedAt: null }); setD(out); setStep(1); }
    catch (e: any) { setErr(String(e?.message || 'Could not take it back.')); }
    finally { setBusy(false); }
  };
  const review = async (ok: boolean) => {
    setBusy(true); setErr(null);
    try { await reviewDesign(d, ok, reviewNote); onClose(); }
    catch (e: any) { setErr(String(e?.message || 'Could not save the review.')); }
    finally { setBusy(false); }
  };
  const discard = async () => {
    const edit = !!d.targetId;
    if (!(await ask(edit ? 'Throw away these changes?' : 'Delete this design?', edit ? 'The badge stays as it is.' : 'It is removed for the whole badge team.', edit ? 'Throw away' : 'Delete', true))) return;
    try { if (!d.id.startsWith('local-') || mode !== 'live') await removeDesign(d.id); dirty.current = false; onClose(); }
    catch (e: any) { setErr(String(e?.message || 'Could not delete it.')); }
  };

  const nextLabel = step < 5 ? `Next: ${STEPS[step].label}` : canApprove ? (d.targetId ? 'Publish changes' : 'Publish badge') : 'Send for approval';
  const heading = locked ? STATUS[d.status].label : d.targetId ? `Editing · ${STEPS[step - 1].label}` : `Step ${step} of 5 · ${STEPS[step - 1].label}`;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: c.paper }}>
        <LinearGradient
          colors={[glow, glow + (theme === 'dark' ? '66' : 'AA'), c.paper]}
          locations={[0, 0.45, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '58%' }}
        />
        <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.6)' }} />
        </View>

        {/* Top: steps + delete + close */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.92 }}>
              {heading}
            </Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {STEPS.map(s => (
                <Pressable key={s.n} onPress={() => jump(s.n)} hitSlop={{ top: 10, bottom: 10 }} accessibilityRole="button" accessibilityLabel={`Step ${s.n}: ${s.label}`}
                  style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: s.n <= step ? '#fff' : 'rgba(255,255,255,0.35)' }} />
              ))}
            </View>
          </View>
          {!locked && (d.title || !d.id.startsWith('local-')) && <RoundTop icon="trash" label="Delete design" onPress={discard} />}
          <RoundTop icon="close" label="Close" onPress={close} />
        </View>

        {/* The keyboard never opens by itself; drag the page or tap Done to close it. */}
        <ScrollView contentContainerStyle={{ alignItems: 'center', paddingTop: 22, paddingHorizontal: 24, paddingBottom: 28 + (kb ? 56 : 0) }}
          keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
          {/* The badge */}
          {step === 4 && !locked ? (
            <ArtEditor design={d} size={240} onChange={art => patch({ art })} />
          ) : (
            <Pressable onPress={Keyboard.dismiss} accessible={false}>
              <TiltBadge badge={badge} size={step === 1 ? 170 : 210} locked={false} />
            </Pressable>
          )}

          <Text style={{ fontSize: 13, color: c.ink3, marginTop: 14, letterSpacing: 0.6, textTransform: 'uppercase' }}>Badge Unlocked</Text>
          {step === 1 && !locked ? (
            <>
              <TextInput value={d.title} onChangeText={t => patch({ title: t })} placeholder="Tap to name the badge" placeholderTextColor={c.ink4}
                maxLength={40} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => desc.current?.focus()} accessibilityLabel="Badge name"
                style={{ ...noOutline, alignSelf: 'stretch', fontSize: 30, fontWeight: '700', color: c.ink, letterSpacing: -0.8, textAlign: 'center', marginTop: 2, paddingVertical: 2 }} />
              <TextInput ref={desc} value={d.desc} onChangeText={t => patch({ desc: t.replace(/\n/g, ' ') })} placeholder="How do you earn it?" placeholderTextColor={c.ink4}
                maxLength={90} multiline returnKeyType="done" submitBehavior="blurAndSubmit" accessibilityLabel="How to earn it"
                style={{ ...noOutline, alignSelf: 'stretch', fontSize: 19, color: c.ink3, textAlign: 'center', marginTop: 4, letterSpacing: -0.2, lineHeight: 24, paddingVertical: 2 }} />
            </>
          ) : (
            <>
              <Text style={{ fontSize: 30, fontWeight: '700', color: c.ink, letterSpacing: -0.8, textAlign: 'center', marginTop: 2, lineHeight: 36 }}>{d.title || 'New badge'}</Text>
              <Text style={{ fontSize: 19, color: c.ink3, textAlign: 'center', marginTop: 6, letterSpacing: -0.2, lineHeight: 24 }}>{d.desc || 'How to earn it'}</Text>
            </>
          )}
          {!!d.rarity && <View style={{ marginTop: 12 }}><RarityPill rarity={d.rarity} season={d.season} /></View>}

          {/* This step */}
          <View style={{ alignSelf: 'stretch', marginTop: 26, gap: 12 }}>
            {step === 1 && <IdeaStep edit={!!d.targetId} />}
            {step === 2 && <HowStep d={d} locked={locked} setHow={setHow} patch={patch} />}
            {step === 3 && <RarityStep d={d} locked={locked} patch={patch} />}
            {step === 4 && <ArtStep d={d} locked={locked} patch={patch} />}
            {step === 5 && <SendStep d={d} locked={locked} canApprove={canApprove} patch={patch} jump={jump} reviewNote={reviewNote} setReviewNote={setReviewNote} />}
            {!!err && <Text style={{ fontSize: 14, color: c.crimson, textAlign: 'center' }}>{err}</Text>}
          </View>
        </ScrollView>

        {/* While typing: a Done bar on top of the keyboard instead of the step buttons. */}
        {kb > 0 && (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: kb, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.paper2 }}>
            <Pressable onPress={Keyboard.dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close the keyboard"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: c.navy700, opacity: pressed ? 0.7 : 1 })}>
              <Icon name="check" size={14} stroke={2.4} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Done</Text>
            </Pressable>
          </View>
        )}

        {/* Bottom bar, like the share row on the badge page */}
        {kb === 0 && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 18, paddingHorizontal: 20, backgroundColor: c.paper }}>
          {step > 1 && <IconTile icon="chev-l" label="Back" onPress={back} />}
          <View style={{ flex: 1 }}>
            {locked && step === 5 ? (
              d.status === 'pending' && canApprove ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pill label="Send back" tone="plain" onPress={() => review(false)} disabled={busy || !reviewNote.trim()} />
                  <Pill label={busy ? 'Saving…' : d.targetId ? 'Approve changes' : 'Approve'} onPress={() => review(true)} disabled={busy} color={c.moss} />
                </View>
              ) : d.status === 'pending' ? (
                <Pill label={busy ? 'One sec…' : 'Take back to edit'} tone="plain" onPress={takeBack} disabled={busy} />
              ) : (
                <Pill label="Done" onPress={onClose} />
              )
            ) : locked ? (
              <Pill label="Next" onPress={() => setStep((step + 1) as Step)} />
            ) : (
              <Pill label={busy ? 'Sending…' : nextLabel} onPress={step < 5 ? next : send} disabled={busy} color={step === 5 ? glow : undefined} />
            )}
          </View>
        </View>}
      </View>
    </Modal>
  );
};

// ════════════════════════════════════════════════════════════════
// Steps
// ════════════════════════════════════════════════════════════════
const IdeaStep = ({ edit }: { edit: boolean }) => {
  return (
    <View style={{ gap: 8 }}>
      <Hint icon="sparkle" text={edit ? 'Tap the name or the description to change them. Everyone who has this badge keeps it.' : 'Tap the name and the line under it to type them, the way students will read them.'} />
      <Hint icon="shield" text="School activities only. Off-campus or unsupervised events can't be badges." />
    </View>
  );
};

const HowStep = ({ d, locked, setHow, patch }: {
  d: BadgeDesign; locked: boolean; setHow: (k: HowKind) => void; patch: (p: Partial<BadgeDesign>) => void;
}) => {
  const { c } = useTheme();
  const h = d.how;
  const setH = (p: Partial<BadgeDesign['how']>) => {
    const how = { ...h, ...p };
    patch({ how, season: how.kind === 'seasonal' ? seasonOf(how.date) : undefined });
  };
  const year = new Date().getFullYear();
  const upcoming = (md: string) => { const iso = `${year}-${md}`; return iso >= isoToday() ? iso : `${year + 1}-${md}`; };
  const quick: [string, string][] = [
    ['Halloween', upcoming('10-31')], ['Winter break', upcoming('12-19')], ["Valentine's", upcoming('02-14')],
    ["St. Patrick's", upcoming('03-17')], ['First of June', upcoming('06-01')],
  ];

  return (
    <>
      <SectionTitle text="How do students get it?" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {(d.targetId ? ['builtin' as HowKind, ...HOW_ORDER] : HOW_ORDER).map(k => {
          const on = h.kind === k;
          return (
            <Pressable key={k} onPress={() => !locked && setHow(k)} disabled={locked} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={({ pressed }) => [{ width: '47%', flexGrow: 1, padding: 14, borderRadius: 18, gap: 8, backgroundColor: on ? c.navy700 : c.surface, opacity: pressed ? 0.8 : locked && !on ? 0.5 : 1 }, on ? shadow.md : shadow.sm]}>
              <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.18)' : c.navy50 }}>
                <Icon name={HOW[k].icon} size={19} stroke={1.9} color={on ? '#fff' : c.navy700} />
              </View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '700', color: on ? '#fff' : c.ink }}>{HOW[k].label}</Text>
                <Text style={{ fontSize: 12.5, color: on ? 'rgba(255,255,255,0.8)' : c.ink3, marginTop: 1 }}>{HOW[k].sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {h.kind === 'seasonal' && (
        <Panel>
          <SectionTitle text="When?" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <DateBox label="Day it unlocks" value={h.date || ''} onChange={v => setH({ date: v })} locked={locked} />
            <DateBox label="Last day, optional" value={h.until || ''} onChange={v => setH({ until: v || undefined })} locked={locked} />
          </View>
          {!locked && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {quick.map(([label, iso]) => (
                <SoftChip key={label} label={label} on={h.date === iso} onPress={() => setH({ date: iso })} />
              ))}
            </View>
          )}
          {!!d.season && <Text style={{ fontSize: 13, color: c.ink3 }}>That's a <Text style={{ fontWeight: '700', color: SEASON[d.season].dark }}>{SEASON[d.season].label}</Text> badge. Students who open the app {h.until ? 'in that window' : 'that day'} get it.</Text>}
        </Panel>
      )}

      {h.kind === 'attendance' && (
        <Panel>
          <SectionTitle text="Where?" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {PLACES.map(p => {
              const on = !!h.places?.includes(p.id);
              return <SoftChip key={p.id} label={p.name} on={on} disabled={locked}
                onPress={() => setH({ places: on ? h.places!.filter(x => x !== p.id) : [...(h.places || []), p.id] })} />;
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: c.ink }}>How many times?</Text>
            <Stepper value={h.times || 1} min={1} max={30} onChange={v => setH({ times: v })} disabled={locked} />
          </View>
          <Text style={{ fontSize: 12.5, color: c.ink3 }}>Counts a check-in at {h.places?.length ? 'any of these' : 'the places you pick'}.</Text>
        </Panel>
      )}

      {h.kind === 'qr' && (
        <Panel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ padding: 10, borderRadius: 16, backgroundColor: '#fff' }}>
              <QRCode value={qrPayload(h.code || 'pending')} size={120} color="#0E2238" backgroundColor="#fff" />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text selectable style={[{ fontSize: 13, fontWeight: '700', color: c.ink, letterSpacing: 0.6 }, tnum]}>{h.code}</Text>
              <Text style={{ fontSize: 12.5, color: c.ink3, lineHeight: 17 }}>Show or print it at the activity. It starts working once the badge is approved.</Text>
              {!locked && (
                <Pressable onPress={() => setH({ code: freshCode() })} hitSlop={6} accessibilityRole="button"
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}>
                  <Icon name="swap" size={14} stroke={2} color={c.navy700} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: c.navy700 }}>New code</Text>
                </Pressable>
              )}
            </View>
          </View>
        </Panel>
      )}

      {h.kind === 'builtin' && (
        <Hint icon="sparkle" text="Leave it as it is: the app already knows when to give this badge out." />
      )}

      {h.kind === 'granted' && (
        <Hint icon="shield" text="No automatic unlock. Someone on the badge team gives it to a student and writes down why." />
      )}
    </>
  );
};

const RarityStep = ({ d, locked, patch }: { d: BadgeDesign; locked: boolean; patch: (p: Partial<BadgeDesign>) => void }) => {
  const { c } = useTheme();
  if (d.how.kind === 'seasonal' || (d.rarity === 'seasonal' && d.how.kind === 'builtin' && locked)) {
    return (
      <>
        <SectionTitle text="Rarity" />
        <Panel>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BadgeTemplate tint={d.season ? SEASON[d.season] : RARITY.seasonal} size={52} empty />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink }}>Seasonal, filled in for you</Text>
              <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 2, lineHeight: 17 }}>
                Seasonal badges take the {d.season ? SEASON[d.season].label.toLowerCase() : "season's"} colour and start empty. Add its art in the next step. {RARITY_XP.seasonal} XP.
              </Text>
            </View>
          </View>
        </Panel>
      </>
    );
  }
  return (
    <>
      <SectionTitle text="How rare is it?" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {(d.targetId && d.season ? [...PICKABLE, 'seasonal' as Rarity] : PICKABLE).map(r => {
          const on = d.rarity === r;
          const t = RARITY[r];
          return (
            <Pressable key={r} onPress={() => !locked && patch({ rarity: r })} disabled={locked} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t.label}
              style={({ pressed }) => [{
                width: '30%', flexGrow: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 18, gap: 6,
                backgroundColor: on ? (t.chrome ? '#E9EDF1' : t.color + '22') : c.surface,
                borderWidth: 2, borderColor: on ? (t.chrome ? '#9AA3AD' : t.color) : 'transparent',
                opacity: pressed ? 0.8 : locked && !on ? 0.45 : 1,
              }, shadow.sm]}>
              <BadgeTemplate tint={r === 'seasonal' && d.season ? SEASON[d.season] : t} size={46} id={`pick-${r}`} />
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: c.ink }}>{t.label}</Text>
              <Text style={[{ fontSize: 11.5, color: c.ink3 }, tnum]}>{RARITY_XP[r]} XP</Text>
            </Pressable>
          );
        })}
      </View>
      {d.rarity === 'secret' && <Hint icon="sparkle" text="Secret badges show as ??? until someone unlocks them." />}
      <Text style={{ fontSize: 12.5, color: c.ink3, textAlign: 'center' }}>{d.targetId ? 'Changing the rarity changes how much XP it is worth.' : "The badge uses this rarity's plain template until you add art."}</Text>
    </>
  );
};

const ArtStep = ({ d, locked, patch }: { d: BadgeDesign; locked: boolean; patch: (p: Partial<BadgeDesign>) => void }) => {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seasonal = d.rarity === 'seasonal';
  const a = d.art;

  // PNG only, so transparent edges stay transparent on the template.
  const pick = async (mode: 'icon' | 'image') => {
    if (busy) return;
    setErr(null);
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setErr('Allow photo access in Settings to add a picture.'); return; }
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: false, quality: 1,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    if (r.canceled || !r.assets[0]) return;
    const asset = r.assets[0];
    const png = asset.mimeType === 'image/png' || /\.png$/i.test(asset.fileName || '') || /\.png(\?|$)/i.test(asset.uri) || /^data:image\/png/.test(asset.uri);
    if (!png) { setErr('That picture isn\'t a PNG. Badge art has to be a PNG.'); return; }
    setBusy(true);
    try {
      const uri = await uploadArt(asset.uri);
      patch({ art: mode === 'icon' ? { mode: 'icon', uri, ...(a.mode === 'icon' ? { x: a.x, y: a.y, scale: a.scale } : { x: 0, y: 0, scale: 0.55 }) } : { mode: 'image', uri } });
    } catch (e: any) { setErr(String(e?.message || 'Could not upload the picture.')); }
    finally { setBusy(false); }
  };

  const choose = (m: CustomArt['mode']) => {
    if (locked) return;
    if (m === 'template' || m === 'original') { patch({ art: { mode: m } }); return; }
    if (a.mode === m) return;
    // Switching between icon and whole badge keeps the picture.
    if (a.mode === 'icon' || a.mode === 'image') {
      patch({ art: m === 'icon' ? { mode: 'icon', uri: a.uri, x: 0, y: 0, scale: 0.55 } : { mode: 'image', uri: a.uri } });
      return;
    }
    pick(m);
  };

  const options: { m: CustomArt['mode']; label: string; sub: string; icon: IconName }[] = [
    ...(d.targetId ? [{ m: 'original' as const, label: 'Current', sub: 'Keep its art', icon: 'check-circle' as IconName }] : []),
    ...(!seasonal ? [{ m: 'template' as const, label: 'Plain', sub: 'Rarity template', icon: 'badge' as IconName }] : []),
    { m: 'icon', label: 'Icon on top', sub: 'PNG on the template', icon: 'image' },
    { m: 'image', label: 'Whole badge', sub: 'PNG replaces it', icon: 'swap' },
  ];

  const nudge = (ds: number) => a.mode === 'icon' && patch({ art: { ...a, scale: clamp(a.scale + ds, 0.15, 1.1) } });

  return (
    <>
      <SectionTitle text={d.targetId ? 'Art' : seasonal ? 'Add the art' : 'Art (optional)'} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {options.map(o => {
          const on = a.mode === o.m;
          return (
            <Pressable key={o.m} onPress={() => choose(o.m)} disabled={locked || busy} accessibilityRole="radio" accessibilityState={{ selected: on }}
              style={({ pressed }) => [{ flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderRadius: 18, gap: 6, backgroundColor: on ? c.navy700 : c.surface, opacity: pressed ? 0.8 : 1 }, on ? shadow.md : shadow.sm]}>
              <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? 'rgba(255,255,255,0.18)' : c.navy50 }}>
                <Icon name={o.icon} size={18} stroke={1.9} color={on ? '#fff' : c.navy700} />
              </View>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: on ? '#fff' : c.ink }}>{o.label}</Text>
              <Text style={{ fontSize: 11, color: on ? 'rgba(255,255,255,0.8)' : c.ink3, textAlign: 'center' }}>{o.sub}</Text>
            </Pressable>
          );
        })}
      </View>

      {busy && <Text style={{ fontSize: 13, color: c.ink3, textAlign: 'center' }}>Uploading…</Text>}

      {a.mode === 'icon' && !locked && (
        <Panel>
          <Text style={{ fontSize: 13, color: c.ink3, textAlign: 'center' }}>Drag the icon to move it. Pinch or use − and + to resize. It always sits on top of the badge.</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: 4 }}>
            <IconTile icon="minus" label="Smaller" onPress={() => nudge(-0.05)} />
            <View style={{ alignItems: 'center', justifyContent: 'center', minWidth: 52 }}>
              <Text style={[{ fontSize: 18, fontWeight: '700', color: c.ink }, tnum]}>{Math.round(a.scale * 100)}%</Text>
              <Text style={{ fontSize: 11.5, color: c.ink3 }}>size</Text>
            </View>
            <IconTile icon="plus" label="Bigger" onPress={() => nudge(0.05)} />
            <IconTile icon="compass" label="Center" onPress={() => patch({ art: { ...a, x: 0, y: 0 } })} />
            <IconTile icon="image" label="Change" onPress={() => pick('icon')} />
          </View>
        </Panel>
      )}
      {a.mode === 'image' && !locked && (
        <Panel>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22 }}>
            <IconTile icon="image" label="Change" onPress={() => pick('image')} />
          </View>
        </Panel>
      )}
      <Text style={{ fontSize: 12.5, color: c.ink3, textAlign: 'center' }}>PNG only. A transparent background looks best.</Text>
      {!!err && <Text style={{ fontSize: 14, color: c.crimson, textAlign: 'center' }}>{err}</Text>}
    </>
  );
};

const SendStep = ({ d, locked, canApprove, patch, jump, reviewNote, setReviewNote }: {
  d: BadgeDesign; locked: boolean; canApprove: boolean; patch: (p: Partial<BadgeDesign>) => void; jump: (n: Step) => void;
  reviewNote: string; setReviewNote: (v: string) => void;
}) => {
  const { c } = useTheme();
  const artLabel = { original: 'Current art', template: d.rarity === 'seasonal' ? 'Empty' : 'Plain template', icon: 'Icon on the template', image: 'Whole-badge PNG' }[d.art.mode];
  const rows: { step: Step; icon: IconName; label: string; value: string }[] = [
    { step: 1, icon: 'edit', label: 'Idea', value: d.title || '—' },
    { step: 2, icon: d.how.kind ? HOW[d.how.kind].icon : 'tasks', label: d.how.kind ? HOW[d.how.kind].label : 'How to get it', value: howSummary(d.how) },
    { step: 3, icon: 'sparkle', label: 'Rarity', value: d.rarity ? `${d.season ? `${SEASON[d.season].label} · ` : ''}${RARITY[d.rarity].label} · ${RARITY_XP[d.rarity]} XP` : '—' },
    { step: 4, icon: 'image', label: 'Art', value: artLabel },
  ];
  return (
    <>
      {d.status === 'rejected' && !!d.note && <Note tone="crimson" icon="message" title="Sent back" text={d.note} />}
      {d.status === 'pending' && <Note tone="sky" icon="clock" title={d.targetId ? 'Changes waiting for approval' : 'Waiting for approval'} text={canApprove ? 'Check it over, then approve it or send it back with a note.' : 'A Badges manager looks at it next. You can take it back to change something.'} />}
      {d.status === 'approved' && <Note tone="moss" icon="check-circle" title="Approved" text={`It's on the Badges page${d.badgeId ? ` (id ${d.badgeId})` : ''}.${d.note ? ` ${d.note}` : ''}`} />}
      {d.status === 'draft' && !!d.targetId && <Note tone="sky" icon="edit" title="Editing an existing badge" text="Tap any row to change it. Students see the new version once it's approved." />}

      <View style={[{ borderRadius: 18, backgroundColor: c.surface, overflow: 'hidden' }, shadow.sm]}>
        {rows.map((r, i) => (
          <Pressable key={r.step} onPress={() => jump(r.step)} accessibilityRole="button" accessibilityLabel={`${r.label}: ${r.value}`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: pressed ? c.paper2 : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: c.line2 })}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={r.icon} size={16} stroke={1.9} color={c.navy700} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 12, color: c.ink3 }}>{r.label}</Text>
              <Text numberOfLines={2} style={{ fontSize: 14.5, fontWeight: '600', color: c.ink }}>{r.value}</Text>
            </View>
            {!locked && <Icon name="chev-r" size={16} stroke={1.8} color={c.ink4} />}
          </Pressable>
        ))}
      </View>

      <SectionTitle text="Shows under" />
      {locked ? (
        <Text style={{ fontSize: 14, color: c.ink2 }}>{CATEGORY[d.category]}</Text>
      ) : (
        <Chips value={d.category} options={CATEGORY_ORDER.map(k => [k, CATEGORY[k]] as [string, string])} onChange={v => patch({ category: v as Category })} />
      )}

      {d.status === 'pending' && canApprove && (
        <>
          <SectionTitle text="Note for the designer" />
          <TextInput value={reviewNote} onChangeText={setReviewNote} placeholder="Needed to send it back. Optional to approve." placeholderTextColor={c.ink4}
            multiline style={[fieldStyle(c), { minHeight: 70, textAlignVertical: 'top', borderWidth: 0 }]} />
        </>
      )}
      {!locked && <Text style={{ fontSize: 12.5, color: c.ink3, textAlign: 'center' }}>{canApprove ? "You're a manager, so it goes live as soon as you publish." : 'A Badges manager approves it before students can see it.'}</Text>}
    </>
  );
};

// ════════════════════════════════════════════════════════════════
// Icon editor: the template with the icon on top. One finger drags,
// two fingers pinch to resize. Web: drag, and the − / + buttons.
// ════════════════════════════════════════════════════════════════
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const LIMIT = 0.42;

const ArtEditor = ({ design, size, onChange }: { design: BadgeDesign; size: number; onChange: (a: CustomArt) => void }) => {
  const badge = toBadge(design);
  const a = design.art;
  const live = useRef({ a, onChange });
  live.current = { a, onChange };
  const start = useRef({ x: 0, y: 0, scale: 0.5, dx: 0, dy: 0, dist: 0, touches: 0 });

  const pan = useMemo(() => {
    const dist = (t: readonly { pageX: number; pageY: number }[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
    const baseline = (touches: readonly { pageX: number; pageY: number }[], g: { dx: number; dy: number }) => {
      const cur = live.current.a;
      if (cur.mode !== 'icon') return;
      start.current = { x: cur.x, y: cur.y, scale: cur.scale, dx: g.dx, dy: g.dy, dist: touches.length >= 2 ? dist(touches) : 0, touches: touches.length };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => live.current.a.mode === 'icon',
      onMoveShouldSetPanResponder: () => live.current.a.mode === 'icon',
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e, g) => baseline(e.nativeEvent.touches as any, g),
      onPanResponderMove: (e, g) => {
        const cur = live.current.a;
        if (cur.mode !== 'icon') return;
        const touches = (e.nativeEvent.touches || []) as unknown as { pageX: number; pageY: number }[];
        if (touches.length !== start.current.touches) { baseline(touches, g); return; }
        const s = start.current;
        if (touches.length >= 2 && s.dist > 0) {
          live.current.onChange({ ...cur, scale: clamp(s.scale * (dist(touches) / s.dist), 0.15, 1.1) });
        } else {
          live.current.onChange({ ...cur, x: clamp(s.x + (g.dx - s.dx) / size, -LIMIT, LIMIT), y: clamp(s.y + (g.dy - s.dy) / size, -LIMIT, LIMIT) });
        }
      },
    });
  }, [size]);

  if (a.mode !== 'icon') return <Pressable onPress={Keyboard.dismiss} accessible={false}><BadgeArt badge={badge} size={size} /></Pressable>;
  return (
    <View style={{ width: size, height: size }}>
      <BadgeArt badge={{ ...badge, custom: { mode: 'template' }, rarity: badge.rarity === 'seasonal' ? 'common' : badge.rarity, tint: badge.tint }} size={size} />
      <View {...pan.panHandlers} style={{ position: 'absolute', ...iconBox(a, size) }}>
        <Image source={{ uri: a.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        <View pointerEvents="none" style={{ position: 'absolute', left: -4, top: -4, right: -4, bottom: -4, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.85)', borderStyle: 'dashed' }} />
      </View>
    </View>
  );
};

// ════════════════════════════════════════════════════════════════
// Bits
// ════════════════════════════════════════════════════════════════
// The web build draws a focus ring round inputs; the badge page shouldn't.
const noOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as object;
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const RoundTop = ({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
    style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
    <Icon name={icon} size={15} stroke={2} color="#FFFFFF" />
  </Pressable>
);

const IconTile = ({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ alignItems: 'center', gap: 5, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} stroke={1.9} color={c.ink2} />
      </View>
      <Text style={{ fontSize: 11.5, color: c.ink3 }}>{label}</Text>
    </Pressable>
  );
};

const Pill = ({ label, onPress, disabled, tone = 'solid', color }: { label: string; onPress: () => void; disabled?: boolean; tone?: 'solid' | 'plain'; color?: string }) => {
  const { c } = useTheme();
  const bg = tone === 'plain' ? c.paper2 : color || c.navy700;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => [{ flex: 1, paddingVertical: 15, borderRadius: 999, alignItems: 'center', backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, tone === 'solid' ? shadow.sm : shadow.none]}>
      <Text style={{ fontSize: 15.5, fontWeight: '700', color: tone === 'plain' ? c.ink : '#fff', letterSpacing: -0.1 }}>{label}</Text>
    </Pressable>
  );
};

const SectionTitle = ({ text }: { text: string }) => {
  const { c } = useTheme();
  return <Text style={{ fontSize: 17, fontWeight: '700', color: c.ink, letterSpacing: -0.3 }}>{text}</Text>;
};

const Panel = ({ children }: { children: React.ReactNode }) => {
  const { c } = useTheme();
  return <View style={[{ borderRadius: 18, backgroundColor: c.surface, padding: 14, gap: 10 }, shadow.sm]}>{children}</View>;
};

const Hint = ({ icon, text }: { icon: IconName; text: string }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: c.navy50 }}>
      <Icon name={icon} size={16} stroke={1.9} color={c.navy700} />
      <Text style={{ flex: 1, fontSize: 13, color: c.ink2, lineHeight: 18 }}>{text}</Text>
    </View>
  );
};

const Note = ({ tone, icon, title, text }: { tone: 'crimson' | 'sky' | 'moss'; icon: IconName; title: string; text: string }) => {
  const { c } = useTheme();
  const bg = { crimson: c.crimsonTint, sky: c.skyTint, moss: c.mossTint }[tone];
  const fg = { crimson: c.crimson, sky: c.sky600, moss: c.moss }[tone];
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: bg }}>
      <Icon name={icon} size={17} stroke={1.9} color={fg} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: fg }}>{title}</Text>
        <Text selectable style={{ fontSize: 13, color: c.ink2, marginTop: 2, lineHeight: 18 }}>{text}</Text>
      </View>
    </View>
  );
};

const SoftChip = ({ label, on, onPress, disabled }: { label: string; on: boolean; onPress: () => void; disabled?: boolean }) => {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? c.navy700 : c.paper2, opacity: pressed ? 0.7 : disabled && !on ? 0.5 : 1 })}>
      {on && <Icon name="check" size={12} stroke={2.6} color="#fff" />}
      <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{label}</Text>
    </Pressable>
  );
};

const Stepper = ({ value, min, max, onChange, disabled }: { value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) => {
  const { c } = useTheme();
  const btn = (icon: IconName, v: number, label: string) => (
    <Pressable onPress={() => onChange(clamp(v, min, max))} disabled={disabled || v < min || v > max} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: c.paper2, alignItems: 'center', justifyContent: 'center', opacity: disabled || v < min || v > max ? 0.35 : pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={15} stroke={2.2} color={c.ink2} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {btn('minus', value - 1, 'Fewer')}
      <Text style={[{ fontSize: 17, fontWeight: '700', color: c.ink, minWidth: 24, textAlign: 'center' }, tnum]}>{value}</Text>
      {btn('plus', value + 1, 'More')}
    </View>
  );
};

const DateBox = ({ label, value, onChange, locked }: { label: string; value: string; onChange: (v: string) => void; locked: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ fontSize: 12.5, color: c.ink3 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} editable={!locked} placeholder="YYYY-MM-DD" placeholderTextColor={c.ink4}
        autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={10}
        style={[fieldStyle(c), { borderWidth: 0, backgroundColor: c.paper2 }, tnum]} />
    </View>
  );
};
