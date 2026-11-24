import React, { useEffect, useState } from 'react';
import { Brain, Pencil, Trash2, Check, X, Loader2, CalendarClock } from 'lucide-react';
import api from '../../services/api';

/**
 * "What Aastha remembers" (owner, 2026-11-24): see, edit and delete what she has learned.
 * Server: GET /users/memory, PUT /users/memory/fact, PUT /users/memory/summary, DELETE /users/memory/follow-up/:id
 * A deleted fact is never re-learned; a 409 means her background update just landed → we show the latest list.
 */
interface Memory {
  summary: string;
  facts: { i: number; text: string }[];
  followUps: { id: string; text: string; dueDate: string }[];
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? '' : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

export const MemoryCard: React.FC<{ botName: string }> = ({ botName }) => {
  const [mem, setMem] = useState<Memory | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | 'summary' | null>(null);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    try { setMem((await api.get('/users/memory')).data); } catch { setMsg('Could not load. Please try again.'); }
  };
  useEffect(() => { if (open && !mem) load(); }, [open]);

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key); setMsg(null);
    try {
      const r = await fn();
      setMem(r.data); setEditing(null);
    } catch (e: any) {
      if (e?.response?.status === 409) { await load(); setEditing(null); setMsg(`${botName} just updated the notes. Here is the latest, try again.`); }
      else setMsg(e?.response?.data?.message || 'Could not save. Please try again.');
    } finally { setBusy(null); }
  };

  const saveFact = (f: { i: number; text: string }, text: string) =>
    run(`fact-${f.i}`, () => api.put('/users/memory/fact', { index: f.i, original: f.text, text }));
  const saveSummary = (text: string) => run('summary', () => api.put('/users/memory/summary', { text }));
  const dismiss = (id: string) => run(`fu-${id}`, () => api.delete(`/users/memory/follow-up/${id}`));

  const empty = mem && !mem.summary && mem.facts.length === 0 && mem.followUps.length === 0;
  const iconBtn = 'w-9 h-9 rounded-full flex items-center justify-center text-md-on-surface-variant hover:bg-md-on-surface/10 disabled:opacity-40';

  return (
    <div className="p-5 rounded-[24px] bg-md-surface-container border border-md-outline-variant/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-md-on-surface font-medium flex items-center gap-2"><Brain size={16} className="text-md-primary" /> What {botName} remembers</h4>
          <p className="text-xs text-md-on-surface-variant mt-1">See, fix or delete what {botName} has learned about you. Deleted things stay forgotten.</p>
        </div>
        <button onClick={() => setOpen(o => !o)} className="shrink-0 px-4 py-2 rounded-full text-sm bg-md-secondary-container text-md-on-secondary-container">
          {open ? 'Close' : 'Open'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {!mem && <div className="flex justify-center py-6"><Loader2 className="animate-spin text-md-on-surface-variant" size={20} /></div>}
          {empty && <p className="text-sm text-md-on-surface-variant text-center py-4">Nothing yet. As you chat, the things you share about yourself show up here.</p>}

          {/* Her note about you */}
          {mem && (mem.summary || editing === 'summary') && (
            <section>
              <h5 className="text-xs font-medium text-md-primary mb-2 px-1">{botName}'s note about how you've been</h5>
              {editing === 'summary' ? (
                <div className="space-y-2">
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4} maxLength={1200}
                    className="w-full px-4 py-3 rounded-2xl bg-md-surface-container-high border border-md-outline-variant/40 text-sm text-md-on-surface outline-none focus:border-md-primary resize-none" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-full text-sm text-md-on-surface-variant hover:bg-md-on-surface/10">Cancel</button>
                    <button onClick={() => saveSummary(draft)} disabled={busy === 'summary'} className="px-4 py-2 rounded-full text-sm bg-md-primary text-md-on-primary flex items-center gap-2">
                      {busy === 'summary' && <Loader2 size={14} className="animate-spin" />} Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-2xl bg-md-surface-container-high">
                  <p className="flex-1 text-sm text-md-on-surface whitespace-pre-wrap">{mem.summary}</p>
                  <button className={iconBtn} aria-label="Edit note" onClick={() => { setEditing('summary'); setDraft(mem.summary); }}><Pencil size={15} /></button>
                  <button className={iconBtn} aria-label="Delete note" disabled={busy === 'summary'} onClick={() => saveSummary('')}><Trash2 size={15} /></button>
                </div>
              )}
            </section>
          )}

          {/* Things you told her */}
          {mem && mem.facts.length > 0 && (
            <section>
              <h5 className="text-xs font-medium text-md-primary mb-2 px-1">Things you told {botName} · {mem.facts.length}</h5>
              <ul className="space-y-1.5">
                {mem.facts.map(f => (
                  <li key={`${f.i}-${f.text}`} className="flex items-center gap-1 pl-4 pr-1 py-1 rounded-2xl bg-md-surface-container-high min-h-[44px]">
                    {editing === f.i ? (
                      <>
                        <input autoFocus value={draft} maxLength={160} onChange={e => setDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveFact(f, draft); if (e.key === 'Escape') setEditing(null); }}
                          className="flex-1 min-w-0 bg-transparent text-sm text-md-on-surface outline-none border-b border-md-primary py-1" aria-label="Edit memory" />
                        <button className={iconBtn} aria-label="Save" disabled={busy === `fact-${f.i}`} onClick={() => saveFact(f, draft)}>
                          {busy === `fact-${f.i}` ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        </button>
                        <button className={iconBtn} aria-label="Cancel" onClick={() => setEditing(null)}><X size={15} /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 min-w-0 text-sm text-md-on-surface">{f.text}</span>
                        <button className={iconBtn} aria-label={`Edit "${f.text}"`} onClick={() => { setEditing(f.i); setDraft(f.text); }}><Pencil size={15} /></button>
                        <button className={iconBtn} aria-label={`Forget "${f.text}"`} disabled={busy === `fact-${f.i}`} onClick={() => saveFact(f, '')}>
                          {busy === `fact-${f.i}` ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Coming up: she may ask how it went */}
          {mem && mem.followUps.length > 0 && (
            <section>
              <h5 className="text-xs font-medium text-md-primary mb-2 px-1">{botName} may ask how these went</h5>
              <ul className="space-y-1.5">
                {mem.followUps.map(fu => (
                  <li key={fu.id} className="flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl bg-md-surface-container-high">
                    <CalendarClock size={16} className="text-md-on-surface-variant shrink-0" />
                    <span className="flex-1 min-w-0 text-sm text-md-on-surface">{fu.text} <span className="text-md-on-surface-variant">· {dayLabel(fu.dueDate)}</span></span>
                    <button onClick={() => dismiss(fu.id)} disabled={busy === `fu-${fu.id}`} className="shrink-0 px-3 py-1.5 rounded-full text-xs border border-md-outline-variant text-md-on-surface-variant hover:bg-md-on-surface/[0.06]">
                      Don't ask
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {msg && <p className="text-xs text-md-on-surface-variant">{msg}</p>}
        </div>
      )}
    </div>
  );
};
