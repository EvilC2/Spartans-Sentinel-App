// Spartans — App Club Admin: make or change one post.
// One sheet for every kind. Top to bottom: what it says (fields for the
// kind), where it shows (places), when (start / end), a live preview, then
// the actions: Publish (or Schedule), Save draft, and for a post that already
// exists, Take down / Duplicate / Delete. Saving a post that is out changes
// it everywhere at once. Every kind can carry a picture that shows behind it.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../ThemeContext';
import { fonts, shadow, tnum, G135 } from '../theme';
import { Icon } from '../components/Icon';
import { Buzz, postToSlide } from '../components/Buzz';
import { EventBanner } from '../components/EventBanner';
import { useProfile } from '../ProfileContext';
import { ask } from '../confirm';
import { toISO } from '../calendar';
import { ADMIN_TEMPLATES, previewDay, templateById } from '../notify/eventDays';
import { BADGES } from '../badges';
import { MENU, FOOD_ART, CATEGORIES, MenuCategory } from '../menu';
import { CategoryTag } from '../screens/NewsScreen';
import {
  useContent, Post, PostKind, Place, KINDS, PLACES, NewsCategory, problems, phaseOf, PHASES, blank,
} from '../content';
import { Toggle, fieldStyle } from '../screens/Settings';

// ── Dates: the editor works in local "YYYY-MM-DD" + "HH:MM" ───────
const pad = (n: number) => String(n).padStart(2, '0');
const localParts = (iso: string | null) => {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  return { date: toISO(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};
const toIsoLocal = (date: string, time: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (/^\d{1,2}:\d{2}$/.test(time) ? time : '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).toISOString();
};
const at = (daysAhead: number, h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + daysAhead); d.setHours(h, m, 0, 0); return d.toISOString(); };
export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
};

export const newPost = (kind: PostKind): Post => {
  const now = new Date().toISOString();
  return {
    id: `own-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind, data: blank(kind), places: [...KINDS[kind].defaults],
    status: 'draft', startsAt: null, endsAt: kind === 'popup' ? at(0, 23, 59) : null,
    sort: 500, pinned: false, createdAt: now, updatedAt: now,
  } as Post;
};

export const PostEditor = ({ post, onClose, onSaved }: { post: Post | null; onClose: () => void; onSaved?: (p: Post) => void }) => {
  const { c } = useTheme();
  const store = useContent();
  const { online } = useProfile();
  const [p, setP] = useState<Post | null>(post);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [banner, setBanner] = useState(false);
  useEffect(() => { setP(post); setErr(null); }, [post]);

  const exists = !!p && store.posts.some(x => x.id === p.id);
  const phase = p ? phaseOf(p, store.now) : 'draft';
  const issues = useMemo(() => (p ? problems(p) : []), [p]);

  if (!p) return <Modal visible={false} />;
  const info = KINDS[p.kind];
  const setData = (patch: Record<string, unknown>) => setP(x => x && ({ ...x, data: { ...x.data, ...patch } } as Post));
  const setPost = (patch: Partial<Post>) => setP(x => x && ({ ...x, ...patch } as Post));
  const togglePlace = (pl: Place) => setPost({ places: p.places.includes(pl) ? p.places.filter(x => x !== pl) : [...p.places, pl] });

  const run = async (next: Post, done: string) => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const out = await store.save(next);
      onSaved?.(out);
      onClose();
      void done;
    } catch (e: any) {
      setErr(String(e?.message || 'Could not save.'));
    } finally { setBusy(false); }
  };

  const publish = async () => {
    if (issues.length) { setErr(issues[0]); return; }
    const later = p.startsAt && Date.parse(p.startsAt) > Date.now();
    const where = p.places.map(x => PLACES[x].label).join(', ');
    const ok = await ask(later ? 'Schedule this?' : exists && phase === 'live' ? 'Update it for everyone?' : 'Publish to every student?',
      later ? `It goes out ${fmtWhen(p.startsAt!)} in: ${where}.` : `It shows right away in: ${where}.`, later ? 'Schedule' : exists && phase === 'live' ? 'Update' : 'Publish');
    // "When published" becomes the real time, so lists and the bell sort it right.
    if (ok) run({ ...p, status: 'published', startsAt: p.startsAt ?? new Date().toISOString(), endsAt: p.endsAt && Date.parse(p.endsAt) <= Date.now() ? null : p.endsAt } as Post, 'published');
  };
  const saveDraft = () => run({ ...p, status: 'draft' } as Post, 'draft');
  const takeDown = async () => {
    if (await ask('Take it down?', 'Students stop seeing it right away. It stays here as a draft.', 'Take down', true)) run({ ...p, status: 'draft' } as Post, 'down');
  };
  const duplicate = () => setP({ ...p, id: `own-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, status: 'draft', pinned: false, sample: undefined } as Post);
  const remove = async () => {
    if (!(await ask('Delete this post?', 'It disappears everywhere, with its numbers. This cannot be undone.', 'Delete', true))) return;
    setBusy(true);
    try { await store.remove(p.id); onClose(); } catch (e: any) { setErr(String(e?.message || 'Could not delete.')); } finally { setBusy(false); }
  };

  const start = localParts(p.startsAt);
  const end = localParts(p.endsAt);
  const later = !!p.startsAt && Date.parse(p.startsAt) > Date.now();
  const needsNet = store.mode === 'live' && !online;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.paper }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.navy50, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={info.icon} size={18} stroke={1.9} color={c.navy700} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: c.ink }}>{exists ? `Edit ${info.noun}` : `New ${info.noun}`}</Text>
            <Text style={{ fontSize: 12.5, color: c.ink3 }}>{exists ? `${PHASES[phase].label}${phase === 'live' ? ' · changes show everywhere when you update' : ''}` : 'Not posted yet'}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}><Text style={{ fontSize: 15, color: c.navy700, fontWeight: '600' }}>Cancel</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 6, paddingBottom: 80, gap: 18 }} keyboardShouldPersistTaps="handled">
          {/* ── What it says ── */}
          <Section title="What it says">
            <Fields p={p} setData={setData} setPost={setPost} />
          </Section>

          {/* ── Picture ── */}
          <Section title="Picture">
            <PictureField value={(p.data as { image?: string | null }).image} onChange={v => setData({ image: v })} />
          </Section>

          {/* ── Where ── */}
          <Section title="Where it shows">
            <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, overflow: 'hidden' }, shadow.sm]}>
              {info.places.map((pl, i) => (
                <View key={pl} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: i === info.places.length - 1 ? 0 : 1, borderBottomColor: c.line2 }}>
                  <Icon name={PLACES[pl].icon} size={18} stroke={1.8} color={c.navy700} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink }}>{PLACES[pl].label}</Text>
                    <Text style={{ fontSize: 12, color: c.ink3 }}>{PLACES[pl].sub}</Text>
                  </View>
                  <Toggle on={p.places.includes(pl)} onChange={() => togglePlace(pl)} label={PLACES[pl].label} />
                </View>
              ))}
            </View>
            {p.places.includes('bell') && 'push' in p.data && (
              <ToggleRow label="Also send a phone notification" sub={later ? 'Only for posts that go out right away' : 'Every phone that has this topic turned on'}
                on={!!(p.data as { push?: boolean }).push && !later} disabled={later} onChange={v => setData({ push: v })} />
            )}
            {p.kind === 'news' && <ToggleRow label="Pin to the top" sub="First on Announcements, first in The Buzz" on={p.pinned} onChange={v => setPost({ pinned: v })} />}
          </Section>

          {/* ── When ── */}
          <Section title="When">
            <Text style={{ fontSize: 12.5, color: c.ink3 }}>Starts</Text>
            <Chips value={p.startsAt ? 'custom' : 'now'} options={[['now', 'When published'], ['custom', 'Pick a time']]}
              onChange={v => setPost({ startsAt: v === 'now' ? null : p.startsAt || at(1, 8) })} />
            {!!p.startsAt && <DateTime date={start.date} time={start.time} onChange={(d, t) => setPost({ startsAt: toIsoLocal(d, t) ?? p.startsAt })} />}
            <Text style={{ fontSize: 12.5, color: c.ink3, marginTop: 4 }}>Ends</Text>
            <Chips value={!p.endsAt ? 'never' : 'custom'} options={[['never', 'When taken down'], ['today', 'Tonight'], ['week', 'In a week'], ['custom', 'Pick a time']]}
              onChange={v => setPost({ endsAt: v === 'never' ? null : v === 'today' ? at(0, 23, 59) : v === 'week' ? at(7, 23, 59) : p.endsAt || at(1, 23, 59) })} />
            {!!p.endsAt && <DateTime date={end.date} time={end.time} onChange={(d, t) => setPost({ endsAt: toIsoLocal(d, t) ?? p.endsAt })} />}
          </Section>

          {/* ── Preview ── */}
          <Section title="Preview">
            <Preview p={p} onBanner={() => setBanner(true)} />
          </Section>

          {/* ── Actions ── */}
          {!!err && <Text style={{ fontSize: 14, color: c.crimson }}>{err}</Text>}
          {!err && issues.length > 0 && <Text style={{ fontSize: 13, color: c.ink3 }}>Before publishing: {issues.join(' ')}</Text>}
          {needsNet && <Text style={{ fontSize: 13, color: c.crimson }}>Offline. Posting needs a connection.</Text>}
          <Btn label={busy ? 'Saving…' : later ? 'Schedule' : exists && phase === 'live' ? 'Update everywhere' : 'Publish'} onPress={publish} disabled={busy || needsNet} />
          <Btn label={phase === 'live' || phase === 'scheduled' ? 'Take down (keep as draft)' : 'Save draft'} tone="plain" onPress={phase === 'live' || phase === 'scheduled' ? takeDown : saveDraft} disabled={busy || needsNet} />
          {exists && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Btn label="Duplicate" tone="plain" onPress={duplicate} disabled={busy} /></View>
              <View style={{ flex: 1 }}><Btn label="Delete" tone="crimson" onPress={remove} disabled={busy || needsNet} /></View>
            </View>
          )}
        </ScrollView>

        {p.kind === 'popup' && (
          <EventBanner preview day={banner ? { ...previewDay(p.data.template, toISO(new Date())), title: p.data.title || templateById(p.data.template).title, body: p.data.body || templateById(p.data.template).body } : null}
            onClose={() => setBanner(false)} onAction={() => setBanner(false)} />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Fields per kind ─────────────────────────────────────────────
const Fields = ({ p, setData, setPost }: { p: Post; setData: (x: Record<string, unknown>) => void; setPost: (x: Partial<Post>) => void }) => {
  const { c } = useTheme();
  void setPost;
  switch (p.kind) {
    case 'trivia': {
      const d = p.data;
      return (
        <>
          <Field label="Question" value={d.prompt} onChange={v => setData({ prompt: v })} multiline />
          <Text style={{ fontSize: 12.5, color: c.ink3 }}>Answers · tap the circle on the right one</Text>
          {d.options.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => setData({ answer: i })} hitSlop={8} accessibilityRole="radio" accessibilityState={{ selected: d.answer === i }} accessibilityLabel={`Answer ${i + 1} is right`}
                style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: d.answer === i ? c.moss : c.line, backgroundColor: d.answer === i ? c.moss : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {d.answer === i && <Icon name="check" size={12} stroke={3} color="#fff" />}
              </Pressable>
              <TextInput value={o} onChangeText={v => setData({ options: d.options.map((x, j) => (j === i ? v : x)) })} placeholder={`Answer ${i + 1}${i > 1 ? ' (optional)' : ''}`}
                placeholderTextColor={c.ink4} style={[fieldStyle(c), { flex: 1 }]} />
            </View>
          ))}
          <Field label="After they answer (optional)" value={d.explain || ''} onChange={v => setData({ explain: v })} placeholder="A fun fact about the answer" />
        </>
      );
    }
    case 'poll': {
      const d = p.data;
      return (
        <>
          <Field label="Question" value={d.prompt} onChange={v => setData({ prompt: v })} multiline />
          <Text style={{ fontSize: 12.5, color: c.ink3 }}>Choices</Text>
          {d.options.map((o, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TextInput value={o} onChangeText={v => setData({ options: d.options.map((x, j) => (j === i ? v : x)) })} placeholder={`Choice ${i + 1}`}
                placeholderTextColor={c.ink4} style={[fieldStyle(c), { flex: 1 }]} />
              {d.options.length > 2 && (
                <Pressable onPress={() => setData({ options: d.options.filter((_, j) => j !== i) })} hitSlop={8} accessibilityLabel={`Remove choice ${i + 1}`}>
                  <Icon name="trash" size={17} stroke={1.8} color={c.ink4} />
                </Pressable>
              )}
            </View>
          ))}
          {d.options.length < 6 && (
            <Pressable onPress={() => setData({ options: [...d.options, ''] })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="plus" size={15} stroke={2.2} color={c.navy700} />
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.navy700 }}>Add a choice</Text>
            </Pressable>
          )}
          <ToggleRow label="Show results after voting" sub="Students see how everyone voted" on={d.showResults} onChange={v => setData({ showResults: v })} />
        </>
      );
    }
    case 'fact': {
      const d = p.data;
      return (
        <>
          <Field label="Small label on top" value={d.eyebrow} onChange={v => setData({ eyebrow: v })} placeholder="Did you know" />
          <Field label="Headline" value={d.title} onChange={v => setData({ title: v })} multiline />
          <Field label="More (optional)" value={d.body} onChange={v => setData({ body: v })} multiline />
        </>
      );
    }
    case 'news': {
      const d = p.data;
      return (
        <>
          <Chips value={d.category} options={(['General', 'Academic', 'Athletics', 'Events'] as NewsCategory[]).map(k => [k, k])} onChange={v => setData({ category: v })} />
          <Field label="Title" value={d.title} onChange={v => setData({ title: v })} multiline />
          <Field label="Post" value={d.body} onChange={v => setData({ body: v })} multiline tall placeholder="The first line shows in the list. Tap to read the rest." />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="From" value={d.author} onChange={v => setData({ author: v })} placeholder="School App Club" /></View>
            <View style={{ flex: 1 }}><Field label="Their role (optional)" value={d.role || ''} onChange={v => setData({ role: v })} placeholder="Student Council" /></View>
          </View>
        </>
      );
    }
    case 'menu': return <MenuFields d={p.data} setData={setData} />;
    case 'popup': {
      const d = p.data;
      const tpl = templateById(d.template);
      const tplBadge = typeof tpl.badge === 'string' ? tpl.badge : null;
      return (
        <>
          <Text style={{ fontSize: 12.5, color: c.ink3 }}>Look</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {ADMIN_TEMPLATES.map(t => {
              const on = t.id === d.template;
              return (
                <Pressable key={t.id} onPress={() => setData({ template: t.id, title: d.title || t.title, body: d.body || t.body, badge: typeof t.badge === 'string' ? t.badge : null })}
                  style={{ alignItems: 'center', gap: 4, padding: 4, borderRadius: 14, borderWidth: 2, borderColor: on ? c.navy700 : 'transparent' }}>
                  <LinearGradient colors={t.colors as [string, string, ...string[]]} start={G135.start} end={G135.end} style={{ width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                    <Image source={t.art} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  </LinearGradient>
                  <Text style={{ fontSize: 11.5, fontWeight: on ? '700' : '500', color: c.ink2 }}>{t.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Field label="Title" value={d.title} onChange={v => setData({ title: v })} />
          <Field label="What students should know" value={d.body} onChange={v => setData({ body: v })} multiline tall />
          {tplBadge && (
            <ToggleRow label={`Badge: ${BADGES.find(b => b.id === tplBadge)?.title || tplBadge}`} sub="Unlocks when a student closes the banner"
              on={d.badge === tplBadge} onChange={v => setData({ badge: v ? tplBadge : null })} />
          )}
        </>
      );
    }
    case 'event': {
      const d = p.data;
      return (
        <>
          <Field label="Title" value={d.title} onChange={v => setData({ title: v })} />
          <DateTime date={d.date} time={d.time || ''} onChange={(date, time) => setData({ date, time: time || undefined })} timeOptional />
          <Field label="Where (optional)" value={d.place || ''} onChange={v => setData({ place: v })} placeholder="Room 214, the gym, the front lawn" />
          <Field label="Details (optional)" value={d.body || ''} onChange={v => setData({ body: v })} multiline />
        </>
      );
    }
  }
};

// Menu: change an item already on the menu, or add a new one.
const MenuFields = ({ d, setData }: { d: Extract<Post, { kind: 'menu' }>['data']; setData: (x: Record<string, unknown>) => void }) => {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const item = MENU.find(m => m.id === d.itemId);
  const found = q.trim() ? MENU.filter(m => m.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const artKeys = Object.keys(FOOD_ART);
  return (
    <>
      <Chips value={d.itemId ? 'change' : 'new'} options={[['change', 'Change a menu item'], ['new', 'Add a new item']]}
        onChange={v => setData(v === 'new' ? { itemId: undefined } : { itemId: item?.id || MENU[0].id, name: d.name || (item || MENU[0]).name })} />
      {!!d.itemId && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
            {item && <Image source={item.icon} style={{ width: 36, height: 36 }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink }}>{item?.name || 'Pick an item'}</Text>
              <Text style={[{ fontSize: 12, color: c.ink3 }, tnum]}>{item ? `On the menu at ${item.price !== undefined ? `$${item.price.toFixed(2)}` : 'ask at counter'}` : ''}</Text>
            </View>
          </View>
          <TextInput value={q} onChangeText={setQ} placeholder="Search the menu to pick another item" placeholderTextColor={c.ink4} style={fieldStyle(c)} />
          {found.map(m => (
            <Pressable key={m.id} onPress={() => { setData({ itemId: m.id, name: m.name, price: m.price ?? null, blurb: '', cats: m.cats }); setQ(''); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: pressed ? 0.6 : 1 })}>
              <Image source={m.icon} style={{ width: 28, height: 28 }} />
              <Text style={{ flex: 1, fontSize: 14, color: c.ink }}>{m.name}</Text>
            </Pressable>
          ))}
        </>
      )}
      <Field label="Name" value={d.name} onChange={v => setData({ name: v })} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Price (blank = ask at counter)" value={d.price == null ? '' : String(d.price)} keyboard="decimal-pad"
            onChange={v => { const n = parseFloat(v.replace(/[^0-9.]/g, '')); setData({ price: v.trim() === '' || !Number.isFinite(n) ? null : n }); }} />
        </View>
      </View>
      <Field label={d.itemId ? 'Description (blank = keep the menu one)' : 'Description'} value={d.blurb} onChange={v => setData({ blurb: v })} multiline />
      {!d.itemId && (
        <>
          <Text style={{ fontSize: 12.5, color: c.ink3 }}>Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.filter(k => k.id !== 'all').map(k => {
              const on = d.cats.includes(k.id as MenuCategory);
              return (
                <Pressable key={k.id} onPress={() => setData({ cats: on ? d.cats.filter(x => x !== k.id) : [...d.cats, k.id] })}
                  style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: on ? c.navy700 : c.line, backgroundColor: on ? c.navy700 : c.surface }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{k.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <Text style={{ fontSize: 12.5, color: c.ink3 }}>Picture{d.itemId ? ' (blank = keep the menu one)' : ''}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {artKeys.map(k => {
          const on = d.art === k;
          return (
            <Pressable key={k} onPress={() => setData({ art: on ? undefined : k })} accessibilityLabel={k}
              style={{ width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? c.navy700 : c.line, backgroundColor: c.surface }}>
              <Image source={(FOOD_ART as Record<string, any>)[k]} style={{ width: 36, height: 36 }} />
            </Pressable>
          );
        })}
      </ScrollView>
      <ToggleRow label="Today's special" sub="In the Today strip at the top of the menu" on={!!d.featured} onChange={v => setData({ featured: v })} />
      <ToggleRow label="Sold out" sub="Greyed out, can't go on the tray" on={!!d.soldOut} onChange={v => setData({ soldOut: v })} />
      {!!d.itemId && <ToggleRow label="Hide from the menu" sub="Gone until this post ends or is taken down" on={!!d.hidden} onChange={v => setData({ hidden: v })} />}
    </>
  );
};

// ── Picture ─────────────────────────────────────────────────────
// A photo from the phone. Live: uploaded to the post-images bucket and the
// post keeps the URL. Demo: kept on this phone. Wide crop so it fills The
// Buzz window and the top of an Announcements card.
const PictureField = ({ value, onChange }: { value?: string | null; onChange: (v: string | null) => void }) => {
  const { c } = useTheme();
  const store = useContent();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async () => {
    if (busy) return;
    setErr(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr('Allow photo access in Settings to add a picture.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (r.canceled || !r.assets[0]) return;
    setBusy(true);
    try { onChange(await store.uploadImage(r.assets[0].uri, r.assets[0].mimeType || 'image/jpeg')); }
    catch (e: any) { setErr(String(e?.message || 'Could not upload the picture.')); }
    finally { setBusy(false); }
  };

  const Round = ({ icon, label, onPress }: { icon: 'camera' | 'close'; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(8,16,28,0.55)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={16} stroke={2} color="#fff" />
    </Pressable>
  );

  return (
    <View style={{ gap: 8 }}>
      {value ? (
        <View style={[{ borderRadius: 16, overflow: 'hidden', backgroundColor: c.navy50 }, shadow.sm]}>
          <Image source={{ uri: value }} style={{ width: '100%', height: 160 }} resizeMode="cover" />
          <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 }}>
            <Round icon="camera" label="Change picture" onPress={pick} />
            <Round icon="close" label="Remove picture" onPress={() => onChange(null)} />
          </View>
          {busy && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 6, backgroundColor: 'rgba(8,16,28,0.55)', alignItems: 'center' }}><Text style={{ fontSize: 12.5, color: '#fff', fontWeight: '600' }}>Uploading…</Text></View>}
        </View>
      ) : (
        <Pressable onPress={pick} disabled={busy} accessibilityRole="button" accessibilityLabel="Add a picture"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: c.navy50, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="image" size={20} stroke={1.8} color={c.navy700} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink }}>{busy ? 'Uploading…' : 'Add a photo'}</Text>
            <Text style={{ fontSize: 12, color: c.ink3 }}>Shows behind the post. Optional.</Text>
          </View>
        </Pressable>
      )}
      {store.mode !== 'live' && !!value && <Text style={{ fontSize: 12, color: c.ink4 }}>Demo: this picture stays on this phone.</Text>}
      {!!err && <Text style={{ fontSize: 13, color: c.crimson }}>{err}</Text>}
    </View>
  );
};

// ── Preview ─────────────────────────────────────────────────────
const Preview = ({ p, onBanner }: { p: Post; onBanner: () => void }) => {
  const { c } = useTheme();
  if (p.kind === 'popup') {
    const tpl = templateById(p.data.template);
    return (
      <Pressable onPress={onBanner} style={({ pressed }) => [{ borderRadius: 18, overflow: 'hidden', opacity: pressed ? 0.85 : 1 }, shadow.sm]}>
        <LinearGradient colors={tpl.colors as [string, string, ...string[]]} start={G135.start} end={G135.end} style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={tpl.art} style={{ width: 48, height: 48 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 20, color: '#fff' }}>{p.data.title || tpl.title}</Text>
            <Text numberOfLines={2} style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>{p.data.body || tpl.body}</Text>
          </View>
          <Icon name="play" size={16} stroke={2} color="#fff" />
        </LinearGradient>
        <Text style={{ position: 'absolute', right: 10, bottom: 6, fontSize: 10.5, color: 'rgba(255,255,255,0.8)' }}>Tap to see it full screen</Text>
      </Pressable>
    );
  }
  if (p.kind === 'news' && !p.places.includes('buzz')) {
    return (
      <View style={[{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 18, overflow: 'hidden' }, shadow.sm]}>
        {!!p.data.image && <Image source={{ uri: p.data.image }} style={{ width: '100%', height: 120 }} resizeMode="cover" />}
        <View style={{ padding: 14 }}>
        <CategoryTag category={p.data.category} />
        <Text style={{ fontSize: 15.5, fontWeight: '600', color: c.ink, marginTop: 8 }}>{p.data.title || 'Title'}</Text>
        <Text numberOfLines={3} style={{ fontSize: 13.5, color: c.ink3, marginTop: 6, lineHeight: 19 }}>{p.data.body || 'Post text'}</Text>
        <Text style={{ fontSize: 12, color: c.ink4, marginTop: 8 }}>{p.data.author}</Text>
        </View>
      </View>
    );
  }
  if (p.kind === 'event' && !p.places.includes('buzz')) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.skyTint, borderWidth: 1, borderColor: c.line }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.sky }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink }}>{p.data.title || 'Event title'}</Text>
          <Text style={{ fontSize: 12, color: c.ink3 }}>{[p.data.date, p.data.time, p.data.place].filter(Boolean).join(' · ') || 'Date'}</Text>
        </View>
        <Text style={{ fontSize: 9.5, fontWeight: '700', letterSpacing: 0.6, color: c.sky600 }}>CLUB</Text>
      </View>
    );
  }
  if (p.kind === 'menu' && !p.places.includes('buzz')) {
    const item = MENU.find(m => m.id === p.data.itemId);
    const art = (p.data.art && (FOOD_ART as Record<string, any>)[p.data.art]) || item?.icon || FOOD_ART.plate;
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20, backgroundColor: c.goldTint, borderWidth: 1, borderColor: '#E7D2A0', opacity: p.data.soldOut ? 0.55 : 1 }, shadow.sm]}>
        <Image source={art} style={{ width: 56, height: 56 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1, color: c.gold }}>{p.data.hidden ? 'HIDDEN' : p.data.soldOut ? 'SOLD OUT' : p.data.featured ? 'SPECIAL' : 'ON THE MENU'}</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.ink }}>{p.data.name || 'Item name'}</Text>
          <Text style={[{ fontSize: 12.5, color: c.ink3 }, tnum]}>{p.data.price != null ? `$${p.data.price.toFixed(2)}` : 'Ask at counter'}</Text>
        </View>
      </View>
    );
  }
  return <Buzz slides={[postToSlide(p)]} aspect={1.1} preview />;
};

// ── Small parts ─────────────────────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '700', color: c.ink3 }}>{title}</Text>
      {children}
    </View>
  );
};

const Field = ({ label, value, onChange, placeholder, multiline, tall, keyboard }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; tall?: boolean; keyboard?: 'decimal-pad' | 'numbers-and-punctuation';
}) => {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 12.5, color: c.ink3 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.ink4} multiline={multiline} keyboardType={keyboard}
        style={[fieldStyle(c), multiline ? { minHeight: tall ? 120 : 64, textAlignVertical: 'top' } : null]} />
    </View>
  );
};

export const Chips = ({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map(([id, label]) => {
        const on = id === value;
        return (
          <Pressable key={id} onPress={() => onChange(id)} accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: on ? c.navy700 : c.line, backgroundColor: on ? c.navy700 : c.surface }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#fff' : c.ink2 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const DateTime = ({ date, time, onChange, timeOptional }: { date: string; time: string; onChange: (date: string, time: string) => void; timeOptional?: boolean }) => {
  const { c } = useTheme();
  const [d, setD] = useState(date);
  const [t, setT] = useState(time);
  useEffect(() => { setD(date); setT(time); }, [date, time]);
  const commit = (nd: string, nt: string) => { if (/^\d{4}-\d{2}-\d{2}$/.test(nd) && (!nt || /^\d{1,2}:\d{2}$/.test(nt))) onChange(nd, nt); };
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1.3, gap: 4 }}>
        <Text style={{ fontSize: 12.5, color: c.ink3 }}>Date (YYYY-MM-DD)</Text>
        <TextInput value={d} onChangeText={v => { setD(v); commit(v, t); }} placeholder={toISO(new Date())} placeholderTextColor={c.ink4} autoCorrect={false} keyboardType="numbers-and-punctuation" style={fieldStyle(c)} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 12.5, color: c.ink3 }}>Time (24h){timeOptional ? ', optional' : ''}</Text>
        <TextInput value={t} onChangeText={v => { setT(v); commit(d, v); }} placeholder="12:15" placeholderTextColor={c.ink4} autoCorrect={false} keyboardType="numbers-and-punctuation" style={fieldStyle(c)} />
      </View>
    </View>
  );
};

export const ToggleRow = ({ label, sub, on, onChange, disabled }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink }}>{label}</Text>
        {!!sub && <Text style={{ fontSize: 12, color: c.ink3, marginTop: 1 }}>{sub}</Text>}
      </View>
      <Toggle on={on} onChange={onChange} label={label} disabled={disabled} />
    </View>
  );
};

export const Btn = ({ label, onPress, disabled, tone = 'navy' }: { label: string; onPress: () => void; disabled?: boolean; tone?: 'navy' | 'plain' | 'crimson' }) => {
  const { c } = useTheme();
  const bg = tone === 'navy' ? c.navy700 : tone === 'crimson' ? c.crimsonTint : c.surface;
  const fg = tone === 'navy' ? '#fff' : tone === 'crimson' ? c.crimson : c.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={({ pressed }) => ({ paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: bg, borderWidth: tone === 'plain' ? 1 : 0, borderColor: c.line, opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: fg }}>{label}</Text>
    </Pressable>
  );
};
