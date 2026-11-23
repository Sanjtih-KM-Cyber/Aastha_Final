import { createPortal } from 'react-dom';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../services/api';

/**
 * Shown once to existing accounts when the Terms / Privacy Policy change (or were never accepted):
 * DPDP Act requires informed consent to the current notice. Recorded on the server with version + time.
 */
export const LegalConsentDialog: React.FC<{ onAccepted: () => void; onLogout: () => void }> = ({ onAccepted, onLogout }) => {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accept = async () => {
    setBusy(true); setError(null);
    try { await api.post('/users/legal-consent', { accept: true }); onAccepted(); }
    catch { setError('Could not save — please check your connection and try again.'); }
    finally { setBusy(false); }
  };
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]" role="dialog" aria-modal="true" aria-labelledby="legal-title">
      <div className="w-full max-w-md max-h-full overflow-y-auto overscroll-contain rounded-[28px] bg-md-surface-container-high border border-md-outline-variant/40 p-6 shadow-2xl">
        <h2 id="legal-title" className="font-serif text-2xl text-md-on-surface">We’ve updated our Terms and Privacy Policy</h2>
        <p className="mt-3 text-sm text-md-on-surface-variant leading-relaxed">
          They explain in plain words what Aastha is (an AI companion, not a medical service), what we collect, who processes it,
          how long we keep it, and your rights — including export and deletion.
        </p>
        <div className="mt-4 flex gap-2">
          <Link to="/privacy" target="_blank" className="h-9 px-4 inline-flex items-center rounded-full bg-md-secondary-container text-md-on-secondary-container text-sm font-medium">Privacy Policy</Link>
          <Link to="/terms" target="_blank" className="h-9 px-4 inline-flex items-center rounded-full bg-md-secondary-container text-md-on-secondary-container text-sm font-medium">Terms</Link>
        </div>
        <label className="mt-5 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 w-5 h-5 accent-[rgb(var(--md-primary))]" />
          <span className="text-sm text-md-on-surface">I’m 18 or older and I agree to the Terms of Service and the Privacy Policy.</span>
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-md-error">{error}</p>}
        <button onClick={accept} disabled={!checked || busy}
          className="mt-5 w-full h-12 rounded-full bg-md-primary text-md-on-primary font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 size={18} className="animate-spin" /> : 'Continue'}
        </button>
        <button onClick={onLogout} className="mt-2 w-full h-11 rounded-full text-md-on-surface-variant text-sm hover:bg-md-on-surface/[0.06]">Not now — log out</button>
      </div>
    </div>
  , document.body);
};
