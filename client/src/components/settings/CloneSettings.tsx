import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, Image as ImageIcon, Mic, Trash2, UserRound, Users, Check, FileText } from 'lucide-react';
import api from '../../services/api';
import { parseChatExport, sampleFor, ParsedChat } from '../../utils/chatExport';

/**
 * Clone Mode, consent-first (ROADMAP A12, A13).
 * Step 1: whose style + explicit statements (server enforces them too).
 * Step 2: screenshot → style notes (screenshot is NOT stored; the learned notes are shown here).
 * Step 3: optional voice sample (encrypted).
 * Then: switch on/off, see usage, delete everything.
 */
interface Statement { key: string; text: string }
interface CloneStatus {
  consent: { subject: 'self' | 'other'; name: string; attestedAt: string } | null;
  hasStyle: boolean;
  style: null | { tone: string; sentenceLength: string; capitalisation: string; emoji: string; punctuation: string; language: string; phrases: string[]; quirks: string[] };
  hasVoice: boolean;
  isActive: boolean;
  isVoiceActive: boolean;
  usedToday: number;
  dailyLimit: number;
  statements?: { self: Statement[]; other: Statement[] };
}

const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1200 / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const Toggle: React.FC<{ on: boolean; disabled?: boolean; label: string; onChange: () => void }> = ({ on, disabled, label, onChange }) => (
  <button
    role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={onChange}
    className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${on ? 'bg-md-primary' : 'bg-md-surface-container-highest'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-6' : 'left-1'}`} />
  </button>
);

export const CloneSettings: React.FC = () => {
  const [status, setStatus] = useState<CloneStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  // consent form
  const [subject, setSubject] = useState<'self' | 'other'>('self');
  const [name, setName] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [editingConsent, setEditingConsent] = useState(false);
  const shotRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLInputElement>(null);
  // exported chat: parsed on the device; only the chosen person's scrubbed messages are uploaded
  const [parsed, setParsed] = useState<ParsedChat | null>(null);
  const [person, setPerson] = useState<string>('');
  const voiceRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { setStatus((await api.get('/users/clone')).data); } catch { setError("Couldn't load Clone Mode."); }
  };
  useEffect(() => { load(); }, []);

  const call = async (key: string, fn: () => Promise<any>) => {
    setBusy(key); setError('');
    try {
      const res = await fn();
      setStatus((prev) => ({ ...(prev as CloneStatus), ...res.data }));
      return true;
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Something went wrong. Please try again.');
      return false;
    } finally { setBusy(null); }
  };

  if (!status) {
    return <div className="flex items-center gap-2 text-md-on-surface-variant text-sm py-6"><Loader2 size={16} className="animate-spin" /> Loading Clone Mode…</div>;
  }

  const statements = status.statements?.[subject] || [];
  const allChecked = statements.length > 0 && statements.every((s) => checked[s.key]);
  const showConsentForm = !status.consent || editingConsent;

  const submitConsent = async () => {
    const ok = await call('consent', () => api.post('/users/clone/consent', {
      subject, subjectName: subject === 'other' ? name.trim() : undefined,
      attestations: statements.filter((s) => checked[s.key]).map((s) => s.key),
    }));
    if (ok) { setEditingConsent(false); setChecked({}); }
  };

  return (
    <section className="space-y-4">
      <h3 className="text-sm font-bold text-md-on-surface-variant/80 uppercase tracking-widest">Clone Mode</h3>
      <p className="text-xs text-md-on-surface-variant -mt-2">
        Chat with an AI that imitates a texting style, yours, or someone who has said yes. Replies are always labelled as an AI imitation.
      </p>

      {error && <div role="alert" className="text-sm text-md-error bg-md-error/10 border border-md-error/30 rounded-xl px-3 py-2">{error}</div>}

      {/* STEP 1, CONSENT */}
      {showConsentForm ? (
        <div className="p-5 rounded-[20px] bg-md-surface-container border border-md-outline-variant/40 space-y-4">
          <h4 className="text-md-on-surface font-medium flex items-center gap-2"><ShieldCheck size={16} className="text-md-primary" /> Whose style is this?</h4>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Whose style">
            {([['self', 'My own', UserRound], ['other', 'Someone else', Users]] as const).map(([val, label, Icon]) => (
              <button key={val} role="radio" aria-checked={subject === val}
                onClick={() => { setSubject(val); setChecked({}); }}
                className={`flex items-center gap-2 justify-center px-3 py-3 rounded-2xl border text-sm ${subject === val ? 'bg-md-secondary-container text-md-on-secondary-container border-transparent' : 'border-md-outline-variant/40 text-md-on-surface-variant hover:bg-md-on-surface/[0.06]'}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>
          {subject === 'other' && (
            <div>
              <label htmlFor="clone-name" className="text-xs text-md-on-surface-variant">Their name or nickname</label>
              <input id="clone-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya"
                className="mt-1 w-full bg-md-surface-container-highest border border-md-outline-variant/40 rounded-xl px-3 py-2.5 text-md-on-surface text-sm placeholder:text-md-on-surface-variant/70 focus:outline-none focus:border-white/30" />
            </div>
          )}
          <div className="space-y-2">
            {statements.map((s) => (
              <label key={s.key} className="flex items-start gap-3 text-sm text-md-on-surface cursor-pointer">
                <input type="checkbox" className="mt-1 accent-violet-400 w-4 h-4 shrink-0" checked={!!checked[s.key]}
                  onChange={(e) => setChecked((c) => ({ ...c, [s.key]: e.target.checked }))} />
                <span>{s.text}</span>
              </label>
            ))}
          </div>
          {subject === 'other' && (
            <p className="text-[11px] text-white/45">Please don't use this to imitate someone who hasn't agreed, including an ex or someone who has passed away without their family's blessing.</p>
          )}
          <div className="flex gap-2">
            <button onClick={submitConsent} disabled={!allChecked || (subject === 'other' && !name.trim()) || busy === 'consent'}
              className="flex-1 py-3 rounded-full bg-md-primary text-md-on-primary font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
              {busy === 'consent' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} I agree, continue
            </button>
            {status.consent && <button onClick={() => setEditingConsent(false)} className="px-4 rounded-full border border-white/15 text-md-on-surface-variant text-sm">Cancel</button>}
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 rounded-[20px] bg-md-surface-container border border-md-outline-variant/40 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-md-on-surface font-medium truncate">Imitating: {status.consent!.name}</p>
              <p className="text-xs text-md-on-surface-variant">Consent given {new Date(status.consent!.attestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
            <button onClick={() => { setEditingConsent(true); setSubject(status.consent!.subject); }} className="text-xs text-md-primary hover:underline shrink-0">Change person</button>
          </div>

          {/* STEP 2, STYLE */}
          <div className="p-5 rounded-[20px] bg-md-surface-container border border-md-outline-variant/40 space-y-3">
            <h4 className="text-md-on-surface font-medium flex items-center gap-2"><ImageIcon size={16} className="text-md-primary" /> Texting style</h4>
            <p className="text-xs text-md-on-surface-variant">Upload a chat screenshot with plenty of {status.consent!.subject === 'self' ? 'your messages (right side)' : `${status.consent!.name}'s messages (left side)`}. The screenshot is analysed and then discarded, only the style notes below are kept, encrypted.</p>
            {status.style && (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs bg-md-surface-container-high rounded-xl p-3">
                {([['Tone', status.style.tone], ['Length', status.style.sentenceLength], ['Caps', status.style.capitalisation], ['Emoji', status.style.emoji], ['Punctuation', status.style.punctuation], ['Language', status.style.language]] as const)
                  .filter(([, v]) => v).map(([k, v]) => (<React.Fragment key={k}><dt className="text-md-on-surface-variant/80">{k}</dt><dd className="text-white/85">{v}</dd></React.Fragment>))}
                {status.style.phrases.length > 0 && (<><dt className="text-md-on-surface-variant/80">Says</dt><dd className="text-white/85">{status.style.phrases.join(' · ')}</dd></>)}
              </dl>
            )}
            <button onClick={() => shotRef.current?.click()} disabled={busy === 'shot'}
              className="w-full py-2.5 rounded-full border border-white/15 text-white/85 text-sm hover:bg-md-on-surface/[0.06] flex items-center justify-center gap-2">
              {busy === 'shot' ? <><Loader2 size={16} className="animate-spin" /> Reading the style…</> : status.hasStyle ? 'Replace screenshot' : 'Upload screenshot'}
            </button>
            <input ref={shotRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) await call('shot', async () => api.post('/users/persona-screenshot', { image: await compressImage(f) })); }} />

            {/* Exported chat, usually teaches the style much better than one screenshot */}
            <div className="pt-2 border-t border-md-outline-variant/40 space-y-2">
              <p className="text-xs text-md-on-surface-variant flex items-start gap-1.5"><FileText size={14} className="shrink-0 mt-0.5" />
                <span>Or use an exported chat, WhatsApp: open the chat → ⋮ → More → <em>Export chat</em> → <em>Without media</em>. Telegram Desktop: Export chat history → JSON.</span>
              </p>
              {!parsed ? (
                <button onClick={() => exportRef.current?.click()} className="w-full py-2.5 rounded-full border border-white/15 text-white/85 text-sm hover:bg-md-on-surface/[0.06]">Upload exported chat (.txt / .json)</button>
              ) : (
                <div className="space-y-2 bg-md-surface-container-high rounded-xl p-3">
                  <p className="text-xs text-md-on-surface-variant">Found {parsed.messages.length} messages. Whose texting style should be learned?</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Person to learn from">
                    {parsed.participants.slice(0, 8).map((pp) => (
                      <button key={pp.name} role="radio" aria-checked={person === pp.name} onClick={() => setPerson(pp.name)}
                        className={`px-3 py-1.5 rounded-full text-xs border ${person === pp.name ? 'bg-md-secondary-container text-md-on-secondary-container border-transparent' : 'border-white/15 text-md-on-surface-variant'}`}>
                        {pp.name} · {pp.count}
                      </button>
                    ))}
                  </div>
                  {person && (
                    <p className="text-[11px] text-md-on-surface-variant">
                      Only {Math.min(sampleFor(parsed, person).length, 400)} of {person}'s messages will be sent, with phone numbers, emails, links, codes and other names removed. Everything else stays on this device, and nothing is stored after the style is learned.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button disabled={!person || busy === 'export'}
                      onClick={async () => {
                        const sample = sampleFor(parsed, person);
                        if (sample.length < 15) { setError(`Need at least 15 messages from ${person}.`); return; }
                        const ok = await call('export', () => api.post('/users/clone/chat-sample', { messages: sample }));
                        if (ok) { setParsed(null); setPerson(''); }
                      }}
                      className="flex-1 py-2.5 rounded-full bg-md-primary text-md-on-primary text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
                      {busy === 'export' ? <><Loader2 size={14} className="animate-spin" /> Learning…</> : `Learn ${person ? person + "'s" : 'their'} style`}
                    </button>
                    <button onClick={() => { setParsed(null); setPerson(''); }} className="px-4 rounded-full border border-white/15 text-md-on-surface-variant text-sm">Cancel</button>
                  </div>
                </div>
              )}
              <input ref={exportRef} type="file" accept=".txt,.json,text/plain,application/json" className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]; e.target.value = '';
                  if (!f) return;
                  if (f.size > 15 * 1024 * 1024) { setError('That export is too large (max 15 MB). Export without media.'); return; }
                  try {
                    const chat = parseChatExport(await f.text(), f.name);
                    if (!chat.messages.length) { setError("Couldn't find any messages in that file. Use WhatsApp's .txt export (without media) or Telegram's result.json."); return; }
                    setParsed(chat);
                    const target = status.consent!.subject === 'other'
                      ? chat.participants.find((pp) => pp.name.toLowerCase().includes(status.consent!.name.toLowerCase().split(' ')[0]))
                      : undefined;
                    setPerson(target?.name || '');
                    setError('');
                  } catch { setError("Couldn't read that file."); }
                }} />
            </div>
          </div>

          {/* STEP 3, VOICE (optional) */}
          <div className="p-5 rounded-[20px] bg-md-surface-container border border-md-outline-variant/40 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-md-on-surface font-medium flex items-center gap-2"><Mic size={16} className="text-md-primary" /> Voice <span className="text-md-on-surface-variant/80 text-xs font-normal">(optional)</span></h4>
              <Toggle on={status.isVoiceActive} disabled={!status.hasVoice || busy === 'voiceToggle'} label="Use cloned voice"
                onChange={() => call('voiceToggle', () => api.put('/users/clone-settings', { isVoiceActive: !status.isVoiceActive }))} />
            </div>
            <p className="text-xs text-md-on-surface-variant">A clear 20–60 second recording{status.consent!.subject === 'other' ? ` of ${status.consent!.name}, shared with their permission` : ' of your own voice'}. Stored encrypted; delete it any time.</p>
            <button onClick={() => voiceRef.current?.click()} disabled={busy === 'voice'}
              className="w-full py-2.5 rounded-full border border-white/15 text-white/85 text-sm hover:bg-md-on-surface/[0.06] flex items-center justify-center gap-2">
              {busy === 'voice' ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : status.hasVoice ? 'Replace voice sample' : 'Upload voice sample'}
            </button>
            <input ref={voiceRef} type="file" accept="audio/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (!f) return;
                if (f.size > 3 * 1024 * 1024) { setError('Please choose an audio clip under 3 MB (about a minute).'); return; }
                await call('voice', async () => api.post('/users/persona-voice', { audio: await fileToDataUrl(f) }));
              }} />
          </div>

          {/* ON / OFF */}
          <div className="p-5 rounded-[20px] bg-md-primary-container/40 border border-md-outline-variant/40 flex items-center justify-between gap-3">
            <div>
              <h4 className="text-md-on-surface font-medium">Chat with the imitation</h4>
              <p className="text-xs text-white/55">{status.hasStyle ? `${status.usedToday}/${status.dailyLimit} replies used today. Aastha steps back in automatically if you're struggling.` : 'Add a screenshot first.'}</p>
            </div>
            <Toggle on={status.isActive} disabled={!status.hasStyle || busy === 'active'} label="Clone Mode"
              onChange={() => call('active', () => api.put('/users/clone-settings', { isActive: !status.isActive }))} />
          </div>

          <button
            onClick={() => { if (confirm('Delete the clone? This removes the consent record, learned style and voice sample. It cannot be undone.')) call('delete', () => api.delete('/users/clone')); }}
            className="w-full py-2.5 rounded-full text-sm text-md-error border border-md-error/30 hover:bg-md-error/10 flex items-center justify-center gap-2">
            {busy === 'delete' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete clone & all its data
          </button>
        </>
      )}
    </section>
  );
};
