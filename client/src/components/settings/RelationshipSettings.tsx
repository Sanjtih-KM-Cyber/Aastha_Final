import React, { useEffect, useState } from 'react';
import { followUpCheckIns } from '../../services/followUpCheckIns';
import { deviceTimeZone } from '../../utils/timeZone';
import { Heart, Languages, MapPin, Brain, Loader2, Check, Sparkles, Pencil, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { FreshStartCard } from './FreshStartCard';
import { MemoryCard } from './MemoryCard';

const LEVELS = ['New friend', 'Getting to know you', 'Friend', 'Close friend', 'Bestie'];

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'auto', label: 'Match how I write (auto)' },
  { value: 'english', label: 'English' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'hindi', label: 'हिन्दी Hindi' },
  { value: 'marathi', label: 'मराठी Marathi' },
  { value: 'bengali', label: 'বাংলা Bengali' },
  { value: 'tamil', label: 'தமிழ் Tamil' },
  { value: 'telugu', label: 'తెలుగు Telugu' },
  { value: 'kannada', label: 'ಕನ್ನಡ Kannada' },
  { value: 'malayalam', label: 'മലയാളം Malayalam' },
  { value: 'gujarati', label: 'ગુજરાતી Gujarati' },
  { value: 'punjabi', label: 'ਪੰਜਾਬੀ Punjabi' },
  { value: 'odia', label: 'ଓଡ଼ିଆ Odia' },
  { value: 'urdu', label: 'اردو Urdu' },
  { value: 'assamese', label: 'অসমীয়া Assamese' },
  { value: 'nepali', label: 'नेपाली Nepali' },
  { value: 'konkani', label: 'कोंकणी Konkani' },
  { value: 'maithili', label: 'मैथिली Maithili' },
  { value: 'bhojpuri', label: 'भोजपुरी Bhojpuri' },
  { value: 'sindhi', label: 'سنڌي Sindhi' },
  { value: 'kashmiri', label: 'کٲشُر Kashmiri' },
  { value: 'sanskrit', label: 'संस्कृतम् Sanskrit' },
  { value: 'tanglish', label: 'Tanglish' },
  { value: 'banglish', label: 'Banglish' },
  { value: 'manglish', label: 'Manglish' },
  { value: 'spanish', label: 'Español Spanish' },
  { value: 'french', label: 'Français French' },
  { value: 'german', label: 'Deutsch German' },
  { value: 'portuguese', label: 'Português Portuguese' },
  { value: 'italian', label: 'Italiano Italian' },
  { value: 'russian', label: 'Русский Russian' },
  { value: 'arabic', label: 'العربية Arabic' },
  { value: 'turkish', label: 'Türkçe Turkish' },
  { value: 'indonesian', label: 'Bahasa Indonesia' },
  { value: 'filipino', label: 'Filipino' },
  { value: 'japanese', label: '日本語 Japanese' },
  { value: 'korean', label: '한국어 Korean' },
  { value: 'chinese', label: '中文 Chinese' },
  { value: 'vietnamese', label: 'Tiếng Việt Vietnamese' },
  { value: 'thai', label: 'ไทย Thai' },
  { value: 'sinhala', label: 'සිංහල Sinhala' },
  { value: 'swahili', label: 'Kiswahili Swahili' },
];

/**
 * "Your connection", closeness (bond level), language/region and thinking mode (ROADMAP A6, A9).
 */
export const RelationshipSettings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const u: any = user || {};
  const botName = u.persona === 'aarav' || u.persona === 'aastik' ? 'Aastik' : 'Aastha';

  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [region, setRegion] = useState<string>(u.region || '');
  // "Aastha reaches out first" (7.4), stored server-side so every device follows it
  const [checkIns, setCheckIns] = useState<{ enabled: boolean; pending: number } | null>(null);
  const [letterOn, setLetterOn] = useState(true);
  // Closeness can grow (or fade) on the server at any time, on any device: refresh it when this screen opens
  useEffect(() => {
    api.get('/users/me').then(r => {
      if (r.data?.bond) updateUser({ bond: r.data.bond, ...(r.data.nickname !== undefined ? { nickname: r.data.nickname } : {}) } as any);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    api.get('/users/reach-out', { params: { tz: deviceTimeZone() } }).then(r => { setCheckIns({ enabled: r.data?.enabled !== false, pending: r.data?.pending || 0 }); setLetterOn(r.data?.weeklyLetter?.enabled !== false); }).catch(() => setCheckIns({ enabled: true, pending: 0 }));
  }, []);
  const toggleCheckIns = async () => {
    if (!checkIns) return;
    const next = !checkIns.enabled;
    setSaving('checkins');
    try {
      await api.put('/users/reach-out', { enabled: next });
      setCheckIns({ ...checkIns, enabled: next });
      if (next) followUpCheckIns.sync(true).catch(() => {}); else followUpCheckIns.cancelAll().catch(() => {});
    } catch {
      alert('Could not save. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const save = async (field: string, payload: Record<string, any>) => {
    setSaving(field);
    try {
      const res = await api.put('/users/profile', payload);
      if (res.data) updateUser(res.data);
      setSaved(field);
      setTimeout(() => setSaved(null), 1800);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const bond = u.bond || { level: 0, earnedLevel: 0, override: null };
  const override: number | null = typeof bond.override === 'number' ? bond.override : null;
  const earned: number = bond.earnedLevel ?? bond.level ?? 0;
  const isPro = !!u.isPro || (u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt) > new Date());

  // Bestie nickname (server: PUT /users/nickname). Aastha invents one at Bestie; you can change it, ask for another, or turn it off.
  const nick: { value: string; by: string; off: boolean } | null = u.nickname || null;
  const atBestie = (bond.level ?? 0) >= 4;
  const [nickDraft, setNickDraft] = useState<string | null>(null);
  const nickAction = async (payload: Record<string, any>) => {
    setSaving('nickname');
    try {
      const r = await api.put('/users/nickname', payload);
      updateUser({ nickname: r.data?.nickname } as any);
      setNickDraft(null);
      setSaved('nickname'); setTimeout(() => setSaved(null), 1800);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Could not save. Please try again.');
    } finally { setSaving(null); }
  };

  const status = (field: string) =>
    saving === field ? <Loader2 size={14} className="animate-spin text-md-on-surface-variant" /> :
    saved === field ? <Check size={14} className="text-green-400" /> : null;

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold text-md-on-surface-variant/80 uppercase tracking-widest">Your connection</h3>

      {/* Closeness */}
      <div className="p-5 rounded-[24px] bg-md-surface-container border border-md-outline-variant/30">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-md-on-surface font-medium flex items-center gap-2"><Heart size={16} className="text-pink-300" /> Closeness</h4>
          {status('closeness')}
        </div>
        <p className="text-xs text-md-on-surface-variant mb-4">
          {botName}'s personality is there from the first message, and you get closer the more you talk: more shared history, more teasing, a nickname at Bestie. You've reached <span className="text-md-on-surface">{LEVELS[earned]}</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save('closeness', { closeness: 'auto' })}
            className={`px-3 py-2 rounded-full text-sm border transition-colors ${override === null ? 'bg-white text-black border-white' : 'border-white/15 text-md-on-surface-variant hover:bg-md-on-surface/10'}`}
          >
            Grow naturally
          </button>
          {LEVELS.map((name, i) => {
            const chosen = override === i;
            // "Grow naturally": show where you are right now
            const now = override === null && earned === i;
            return (
              <button
                key={name}
                onClick={() => save('closeness', { closeness: i })}
                aria-pressed={chosen}
                className={`px-3 py-2 rounded-full text-sm border transition-colors inline-flex items-center gap-1.5 ${chosen ? 'bg-white text-black border-white' : now ? 'bg-md-secondary-container text-md-on-secondary-container border-md-primary/60' : 'border-white/15 text-md-on-surface-variant hover:bg-md-on-surface/10'}`}
              >
                {now && <span className="w-1.5 h-1.5 rounded-full bg-md-primary" aria-hidden />}
                {name}
                {now && <span className="text-[10px] opacity-75">now</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bestie nickname */}
      <div className="p-5 rounded-[24px] bg-md-surface-container border border-md-outline-variant/30">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-md-on-surface font-medium flex items-center gap-2"><Sparkles size={16} className="text-md-primary" /> Your nickname</h4>
          {status('nickname')}
        </div>
        {!atBestie ? (
          <p className="text-xs text-md-on-surface-variant">Unlocks at <span className="text-md-on-surface">Bestie</span>. {botName} will come up with a nickname that's just yours.</p>
        ) : nickDraft !== null ? (
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); nickAction({ action: 'set', value: nickDraft }); }}>
            <input autoFocus value={nickDraft} maxLength={20} onChange={(e) => setNickDraft(e.target.value)} placeholder="What should they call you?"
              className="flex-1 min-w-0 bg-md-surface-container-highest border border-md-outline-variant/40 rounded-xl px-3 py-2.5 text-md-on-surface text-sm focus:outline-none focus:border-md-primary" />
            <button type="submit" className="px-4 rounded-full bg-md-primary text-md-on-primary text-sm font-medium">Save</button>
            <button type="button" onClick={() => setNickDraft(null)} className="px-3 rounded-full text-md-on-surface-variant text-sm">Cancel</button>
          </form>
        ) : (
          <>
            <p className="text-xs text-md-on-surface-variant mb-3">
              {nick?.value
                ? <>{botName} calls you <span className="text-md-on-surface font-medium">“{nick.value}”</span>{nick.by === 'user' ? ' (your pick)' : ''}{nick.off ? 'turned off' : ''}.</>
                : `${botName} is still thinking of one, it'll show up in chat soon.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => nickAction({ action: 'regenerate' })} className="h-9 px-3.5 rounded-full bg-md-secondary-container text-md-on-secondary-container text-sm font-medium inline-flex items-center gap-1.5"><RefreshCw size={14} /> Another one</button>
              <button onClick={() => setNickDraft(nick?.value || '')} className="h-9 px-3.5 rounded-full border border-md-outline-variant/50 text-md-on-surface text-sm inline-flex items-center gap-1.5"><Pencil size={14} /> Choose my own</button>
              {nick?.value && (
                <button onClick={() => nickAction({ action: nick.off ? 'on' : 'off' })} className="h-9 px-3.5 rounded-full text-md-on-surface-variant text-sm hover:bg-md-on-surface/[0.06]">{nick.off ? 'Use it again' : 'Don’t use a nickname'}</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Language + region */}
      <div className="p-5 rounded-[24px] bg-md-surface-container border border-md-outline-variant/30 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="pref-lang" className="text-md-on-surface font-medium flex items-center gap-2"><Languages size={16} className="text-md-primary" /> Language</label>
            {status('language')}
          </div>
          <select
            id="pref-lang"
            value={u.preferredLanguage || 'auto'}
            onChange={(e) => save('language', { preferredLanguage: e.target.value })}
            className="w-full bg-md-surface-container-highest border border-md-outline-variant/40 rounded-xl px-3 py-2.5 text-md-on-surface text-sm focus:outline-none focus:border-white/30"
          >
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="pref-region" className="text-md-on-surface font-medium flex items-center gap-2"><MapPin size={16} className="text-amber-300" /> Where you're from <span className="text-md-on-surface-variant/80 text-xs font-normal">(optional)</span></label>
            {status('region')}
          </div>
          <input
            id="pref-region"
            value={region}
            maxLength={60}
            placeholder="e.g. Pune, Kolkata, Chennai"
            onChange={(e) => setRegion(e.target.value)}
            onBlur={() => region !== (u.region || '') && save('region', { region })}
            className="w-full bg-md-surface-container-highest border border-md-outline-variant/40 rounded-xl px-3 py-2.5 text-md-on-surface text-sm placeholder:text-md-on-surface-variant/70 focus:outline-none focus:border-white/30"
          />
          <p className="text-xs text-md-on-surface-variant/80 mt-2">Helps {botName} use expressions that feel like home, only after you use them first.</p>
        </div>
      </div>

      {/* Thinking mode */}
      <div className="p-5 rounded-[24px] bg-md-surface-container border border-md-outline-variant/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-md-on-surface font-medium flex items-center gap-2"><Brain size={16} className="text-md-primary" /> Think deeper {!isPro && <span className="text-[10px] px-2 py-0.5 rounded-full bg-md-primary/20 text-md-primary">PRO</span>}</h4>
            <p className="text-xs text-md-on-surface-variant mt-1">
              {botName} takes a moment to think before every reply. Decisions and dilemmas get this automatically for everyone.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={!!u.thinkingMode}
            aria-label="Think deeper"
            disabled={!isPro || saving === 'thinking'}
            onClick={() => save('thinking', { thinkingMode: !u.thinkingMode })}
            className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${u.thinkingMode && isPro ? 'bg-md-primary' : 'bg-md-surface-container-highest'} ${!isPro ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${u.thinkingMode && isPro ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* GIF reactions */}
      <div className="p-5 rounded-[24px] bg-md-surface-container border border-md-outline-variant/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-md-on-surface font-medium">GIFs & memes</h4>
            <p className="text-xs text-md-on-surface-variant mt-1">
              {botName} can drop a GIF in fun moments, never when you're having a hard time.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={u.gifsEnabled !== false}
            aria-label="GIFs and memes"
            disabled={saving === 'gifs'}
            onClick={() => save('gifs', { gifsEnabled: u.gifsEnabled === false })}
            className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${u.gifsEnabled !== false ? 'bg-md-primary' : 'bg-md-surface-container-highest'}`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${u.gifsEnabled !== false ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Check-ins about things you mentioned (7.4) */}
      <div className="p-5 rounded-[24px] bg-md-surface-container border border-md-outline-variant/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h4 className="text-md-on-surface font-medium">{botName} checks in on you</h4>
            <p className="text-xs text-md-on-surface-variant mt-1">
              Mention something with a date ("exam on Friday") and {botName} may gently ask how it went the day after.
              At most once a day, only between 10 am and 9 pm your time, and not after a really hard day.
              {checkIns?.enabled && checkIns.pending > 0 ? ` ${checkIns.pending} coming up.` : ''}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={!!checkIns?.enabled}
            aria-label="Check-ins about things you mentioned"
            disabled={!checkIns || saving === 'checkins'}
            onClick={toggleCheckIns}
            className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${checkIns?.enabled ? 'bg-md-primary' : 'bg-md-surface-container-highest'}`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${checkIns?.enabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>

      <div className="p-5 rounded-[24px] bg-md-surface-container border border-md-outline-variant/30 flex items-center justify-between gap-4">
        <div>
          <h4 className="text-md-on-surface font-medium">💌 Weekly letter</h4>
          <p className="text-xs text-md-on-surface-variant mt-1">After a week you chatted, {botName} writes you a short letter on Sunday evening.</p>
        </div>
        <button type="button" role="switch" aria-checked={letterOn} aria-label="Weekly letter"
          onClick={async () => { const v = !letterOn; setLetterOn(v); try { await api.put('/users/weekly-letter', { enabled: v }); followUpCheckIns.sync(true).catch(() => {}); } catch { setLetterOn(!v); } }}
          className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${letterOn ? 'bg-md-primary' : 'bg-md-surface-container-highest'}`}>
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${letterOn ? 'left-6' : 'left-1'}`} />
        </button>
      </div>

      <MemoryCard botName={botName} />
      <FreshStartCard botName={botName} />
    </section>
  );
};
