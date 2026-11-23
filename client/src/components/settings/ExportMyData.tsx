import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useEncryption } from '../../context/EncryptionContext';
import { saveTextFile } from '../../utils/saveFile';

/**
 * "Export my data" (ROADMAP 7.5, DPDP Act right to access): chats, diary, moods, memory, The Web, settings.
 * The server decrypts what it encrypted; diary entries are locked with this device's key, so we unlock them here
 * when the diary key is available (otherwise they stay marked `locked: true`).
 */
export const buildExport = (data: any, decryptDiary?: (c: string) => string) => {
  const diary = (data?.diary || []).map((d: any) => {
    if (!decryptDiary) return d;
    try {
      const title = decryptDiary(d.title);
      const content = decryptDiary(d.content);
      if (typeof content === 'string' && content !== '' || typeof title === 'string' && title !== '') return { ...d, title, content, locked: false };
    } catch { /* keep locked */ }
    return d;
  });
  return { ...data, diary };
};

export const ExportMyData: React.FC = () => {
  const { decrypt, isReady } = useEncryption();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await api.get('/users/export');
      const full = buildExport(res.data, isReady ? decrypt : undefined);
      const stamp = new Date().toISOString().slice(0, 10);
      const how = await saveTextFile(`aastha-export-${stamp}.json`, JSON.stringify(full, null, 2));
      const locked = full.diary.filter((d: any) => d.locked).length;
      setMsg(`${how === 'shared' ? 'Ready, pick where to save it.' : 'Downloaded.'} ${full.chats?.length || 0} messages, ${full.diary.length} diary entries${locked ? ` (${locked} still locked, open your diary once, then export again)` : ''}, ${full.moods?.length || 0} moods.`);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || 'Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 rounded-[20px] bg-md-surface-container border border-md-outline-variant/40 mb-8">
      <h4 className="text-sm font-semibold text-md-on-surface">Export my data</h4>
      <p className="text-xs text-md-on-surface-variant mt-1 leading-relaxed">
        One file with everything we store about you: chats, diary, moods, what Aastha remembers, The Web and your settings.
        It's readable (JSON) and not encrypted, keep it somewhere safe.
      </p>
      <button
        onClick={run}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-md-primary text-md-on-primary text-sm font-medium disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {busy ? 'Preparing…' : 'Export my data'}
      </button>
      {msg && <p className="mt-2 text-xs text-md-on-surface-variant" role="status">{msg}</p>}
    </div>
  );
};
