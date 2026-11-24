import React, { useState } from 'react';
import { RotateCcw, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { chatCache } from '../../services/chatCache';
import { pendingReply } from '../../services/pendingReply';

/**
 * "Start fresh with Aastha" (owner, 2026-11-24): existing users pick what to reset (POST /users/fresh-start).
 * Account, diary, moods, The Web and payments are never touched. Memories and chats need the account password.
 */
type Part = 'closeness' | 'memories' | 'chats';

export const FreshStartCard: React.FC<{ botName: string }> = ({ botName }) => {
  const { user, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Record<Part, boolean>>({ closeness: true, memories: false, chats: false });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const needsPassword = pick.memories || pick.chats;
  const any = pick.closeness || pick.memories || pick.chats;

  const OPTIONS: { key: Part; title: string; body: string }[] = [
    { key: 'closeness', title: 'Closeness', body: `Back to New friend, nickname cleared. You grow close again from day one.` },
    { key: 'memories', title: `What ${botName} remembers`, body: `The things you told ${botName}, your check-ins and your learned texting style.` },
    { key: 'chats', title: 'Chat history', body: 'Every message and voice note in the chat. Can’t be undone.' },
  ];

  const run = async () => {
    if (!any || busy || (needsPassword && !password)) return;
    setBusy(true); setMsg(null);
    try {
      await api.post('/users/fresh-start', { ...pick, password: needsPassword ? password : undefined });
      if (pick.closeness) {
        const b: any = (user as any)?.bond || {};
        updateUser({ bond: { ...b, level: 0, earnedLevel: 0, points: 0, override: null }, nickname: null } as any);
      }
      setPassword('');
      if (pick.chats) {
        chatCache.clearAll();
        pendingReply.clearInFlight((user as any)?._id);
        pendingReply.takeOutbox((user as any)?._id); // drops anything unsent
        setMsg({ ok: true, text: 'Done. Opening a fresh chat…' });
        setTimeout(() => window.location.reload(), 900);
        return;
      }
      setMsg({ ok: true, text: `Done. ${botName} starts fresh from your next message.` });
      setOpen(false);
    } catch (e: any) {
      const s = e?.response?.status;
      setMsg({ ok: false, text: s === 422 ? 'That password didn’t match.' : e?.response?.data?.message || 'Could not reset. Please try again.' });
    } finally { setBusy(false); }
  };

  return (
    <div className="p-5 rounded-[24px] bg-md-surface-container border border-md-outline-variant/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-md-on-surface font-medium flex items-center gap-2"><RotateCcw size={16} className="text-md-primary" /> Start fresh with {botName}</h4>
          <p className="text-xs text-md-on-surface-variant mt-1">Meet {botName} again. You choose what to reset. Your account, diary and moods stay.</p>
        </div>
        {!open && (
          <button onClick={() => { setOpen(true); setMsg(null); }} className="shrink-0 px-4 py-2 rounded-full text-sm bg-md-secondary-container text-md-on-secondary-container">
            Choose
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-2">
          {OPTIONS.map(o => (
            <label key={o.key} className={`flex items-start gap-3 p-3 rounded-2xl cursor-pointer border transition-colors ${pick[o.key] ? 'border-md-primary/60 bg-md-primary-container/30' : 'border-md-outline-variant/30'}`}>
              <input
                type="checkbox"
                className="mt-1 accent-[rgb(var(--md-primary))] w-4 h-4"
                checked={pick[o.key]}
                onChange={e => setPick(p => ({ ...p, [o.key]: e.target.checked }))}
              />
              <span>
                <span className="block text-sm text-md-on-surface">{o.title}</span>
                <span className="block text-xs text-md-on-surface-variant">{o.body}</span>
              </span>
            </label>
          ))}

          {needsPassword && (
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Your account password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') run(); }}
              className="w-full mt-1 px-4 py-3 rounded-2xl bg-md-surface-container-high border border-md-outline-variant/40 text-sm text-md-on-surface outline-none focus:border-md-primary"
            />
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setOpen(false); setPassword(''); setMsg(null); }} className="px-4 py-2 rounded-full text-sm text-md-on-surface-variant hover:bg-md-on-surface/10">Cancel</button>
            <button
              onClick={run}
              disabled={!any || busy || (needsPassword && !password)}
              className={`px-4 py-2 rounded-full text-sm flex items-center gap-2 disabled:opacity-40 ${pick.chats ? 'bg-md-error text-md-on-error' : 'bg-md-primary text-md-on-primary'}`}
            >
              {busy && <Loader2 size={14} className="animate-spin" />} Start fresh
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p className={`mt-3 text-xs flex items-center gap-1.5 ${msg.ok ? 'text-md-on-surface-variant' : 'text-md-error'}`}>
          {msg.ok && <Check size={14} className="text-green-400" />} {msg.text}
        </p>
      )}
    </div>
  );
};
