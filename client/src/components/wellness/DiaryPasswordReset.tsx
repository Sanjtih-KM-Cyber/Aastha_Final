import React, { useEffect, useState } from 'react';
import { KeyRound, HelpCircle, Mail, Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

/**
 * "Forgot diary password?" — reworked (server-verified, entries KEPT).
 * Used in Settings → Security and on the Diary lock screen.
 */
type Method = 'account_password' | 'security_answer' | 'email_code';

interface Options { question: string | null; canEmail: boolean; emailHint: string | null; lockedUntil: string | null }

const input = 'w-full bg-md-surface-container-highest border border-white/15 rounded-xl px-3 py-2.5 text-md-on-surface text-sm placeholder:text-white/35 focus:outline-none focus:border-white/40';

export const DiaryPasswordReset: React.FC<{ onDone?: (newPassword?: string) => void; compact?: boolean }> = ({ onDone, compact }) => {
  const { user } = useAuth();
  const [opts, setOpts] = useState<Options | null>(null);
  const [method, setMethod] = useState<Method>('account_password');
  const [secret, setSecret] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [showFresh, setShowFresh] = useState(false);
  // Accounts created before the master-key upgrade derived the diary key from the diary password itself.
  const legacyKey = !(user as any)?.masterKey;

  useEffect(() => {
    api.get('/users/diary/reset-options').then((r) => setOpts(r.data)).catch(() => setOpts({ question: null, canEmail: false, emailHint: null, lockedUntil: null }));
  }, []);

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key); setMsg(null);
    try {
      const r = await fn();
      return r?.data;
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.response?.data?.message || 'Something went wrong. Please try again.' });
      return null;
    } finally { setBusy(null); }
  };

  const canSubmit = secret.trim() && pw.length >= 4 && pw === pw2;

  const submit = async (fresh: boolean) => {
    if (fresh && !confirm('This permanently deletes ALL your diary entries and sets a new password. This cannot be undone. Continue?')) return;
    const data = await run(fresh ? 'fresh' : 'reset', () => api.post(fresh ? '/users/diary/start-fresh' : '/users/diary/reset-password', { method, secret, newPassword: pw }));
    if (data?.success) {
      setMsg({ kind: 'ok', text: data.message });
      const chosen = pw;
      setSecret(''); setPw(''); setPw2('');
      setTimeout(() => onDone?.(chosen), 1200); // the lock screen fills it in for you
    }
  };

  const methods: { key: Method; label: string; Icon: React.FC<any>; show: boolean }[] = [
    { key: 'account_password', label: 'Account password', Icon: KeyRound, show: true },
    { key: 'security_answer', label: 'Security question', Icon: HelpCircle, show: !!opts?.question },
    { key: 'email_code', label: 'Email me a code', Icon: Mail, show: !!opts?.canEmail },
  ];

  return (
    <div className={`space-y-4 ${compact ? '' : 'p-5 rounded-[20px] bg-md-surface-container border border-md-outline-variant/40'}`}>
      <div>
        <h4 className="text-md-on-surface font-medium flex items-center gap-2"><ShieldCheck size={16} className="text-md-primary" /> Forgot your diary password?</h4>
        <p className="text-xs text-white/55 mt-1">
          {legacyKey
            ? 'Verify it’s you and choose a new one. Note: this account uses an older diary lock, so entries written before may not open with the new password.'
            : 'Verify it’s you and choose a new one. Your entries stay exactly as they are — only the lock changes.'}
        </p>
      </div>

      {opts?.lockedUntil && <p className="text-xs text-md-error">Too many attempts — try again later.</p>}

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Verify with">
        {methods.filter((m) => m.show).map(({ key, label, Icon }) => (
          <button key={key} role="radio" aria-checked={method === key} onClick={() => { setMethod(key); setSecret(''); setMsg(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs border ${method === key ? 'bg-md-secondary-container text-md-on-secondary-container border-transparent' : 'border-white/15 text-md-on-surface-variant hover:bg-md-on-surface/[0.06]'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {method === 'account_password' && (
        <input type="password" autoComplete="current-password" aria-label="Account password" className={input} placeholder="Your account (login) password" value={secret} onChange={(e) => setSecret(e.target.value)} />
      )}
      {method === 'security_answer' && (
        <div className="space-y-2">
          <p className="text-sm text-md-primary">{opts?.question}</p>
          <input type="text" aria-label="Security answer" className={input} placeholder="Your answer" value={secret} onChange={(e) => setSecret(e.target.value)} />
        </div>
      )}
      {method === 'email_code' && (
        <div className="flex gap-2">
          <input inputMode="numeric" maxLength={6} aria-label="Email code" className={input} placeholder={codeSent ? '6-digit code' : 'Send a code first'} value={secret} onChange={(e) => setSecret(e.target.value.replace(/\D/g, ''))} />
          <button onClick={async () => { const d = await run('code', () => api.post('/users/diary/reset-code')); if (d?.success) { setCodeSent(true); setMsg({ kind: 'ok', text: `Code sent to ${opts?.emailHint || 'your email'}.` }); } }}
            className="shrink-0 px-4 rounded-xl border border-white/15 text-md-on-surface text-sm hover:bg-md-on-surface/[0.06]">
            {busy === 'code' ? <Loader2 size={14} className="animate-spin" /> : codeSent ? 'Resend' : 'Send code'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input type="password" autoComplete="new-password" aria-label="New diary password" className={input} placeholder="New diary password (4+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
        <input type="password" autoComplete="new-password" aria-label="Confirm new diary password" className={input} placeholder="Confirm new password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </div>
      {pw2 && pw !== pw2 && <p className="text-xs text-md-error -mt-2">Passwords don’t match.</p>}

      {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`text-sm ${msg.kind === 'err' ? 'text-md-error' : 'text-emerald-300'}`}>{msg.text}</p>}

      <button onClick={() => submit(false)} disabled={!canSubmit || !!busy}
        className="w-full py-3 px-4 rounded-full bg-md-primary text-md-on-primary font-semibold disabled:opacity-40 flex items-center justify-center gap-2 text-sm">
        {busy === 'reset' ? <Loader2 size={16} className="animate-spin shrink-0" /> : <KeyRound size={16} className="shrink-0" />}<span>Set new password — keep my entries</span>
      </button>

      <div className="pt-1">
        <button onClick={() => setShowFresh((v) => !v)} className="text-[11px] text-white/45 hover:text-md-on-surface-variant underline">
          {showFresh ? 'Hide' : 'Prefer to start over with an empty diary?'}
        </button>
        {showFresh && (
          <button onClick={() => submit(true)} disabled={!canSubmit || !!busy}
            className="mt-2 w-full py-2.5 rounded-full text-sm text-md-error border border-md-error/30 hover:bg-md-error/10 disabled:opacity-40 flex items-center justify-center gap-2">
            {busy === 'fresh' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete all entries & start fresh
          </button>
        )}
      </div>
    </div>
  );
};
