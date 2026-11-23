import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import { FingerprintPattern, ScanFace, KeyRound, Loader2, ArrowRight, LogOut, Lock } from 'lucide-react';
import { useBiometrics } from '../../hooks/useBiometrics';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import {
  loadLockSettings, saveLockSettings, LockSettings, LOCK_EVENT, LOCK_NOW_EVENT, shouldLockOnReturn, shouldLockForIdle,
} from '../../security/appLock';

/**
 * APP LOCK (phone + web) — one controller, one lock screen.
 *  - Locks on a cold start, when you come back after the chosen grace period, after idling, or via "Lock now".
 *  - Phone: fingerprint / face (5 tries in ONE system sheet + the phone's PIN as fallback). Web / fallback: account password.
 *  - The app stays MOUNTED under the lock screen (your chat, music and widgets don't reset when you unlock).
 *  - Double-prompt fix: the system sheet closing fires a "resume" on some phones; resumes during a prompt and for
 *    1.5 s after it are ignored, and only one system prompt can exist at a time (hooks/useBiometrics.ts).
 */
export const BiometricGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isAutoLockBlocked } = useAuth() as any;
  const bio = useBiometrics();
  const native = Capacitor.isNativePlatform();
  const [settings, setSettings] = useState<LockSettings>(() => loadLockSettings());
  const useBio = native && bio.isAvailable && bio.isEnabled;

  // Cold start → locked; but NOT right after signing in with the password (you just proved it's you)
  const [locked, setLocked] = useState<boolean>(() => {
    let fresh = false;
    try {
      const t = parseInt(sessionStorage.getItem('aastha_fresh_sign_in') || '0', 10);
      fresh = Date.now() - t < 60_000;
    } catch { /* ignore */ }
    return loadLockSettings().enabled && !fresh;
  });
  // consume the "just signed in" flag AFTER mounting (initialisers can run twice in dev — StrictMode)
  useEffect(() => { const t = setTimeout(() => { try { sessionStorage.removeItem('aastha_fresh_sign_in'); } catch { /* ignore */ } }, 0); return () => clearTimeout(t); }, []);
  const autoPrompt = useRef<boolean>(true);
  const prompting = useRef(false);
  const ignoreUntil = useRef(0);
  const hiddenAt = useRef<number | null>(null);
  const lastActivity = useRef(Date.now());

  // keep settings fresh (Settings → Security writes them)
  useEffect(() => {
    const reload = () => setSettings(loadLockSettings());
    window.addEventListener(LOCK_EVENT, reload);
    window.addEventListener('storage', reload);
    const lockNow = () => { if (loadLockSettings().enabled) { autoPrompt.current = false; setLocked(true); } };
    window.addEventListener(LOCK_NOW_EVENT, lockNow);
    return () => { window.removeEventListener(LOCK_EVENT, reload); window.removeEventListener('storage', reload); window.removeEventListener(LOCK_NOW_EVENT, lockNow); };
  }, []);
  useEffect(() => { if (!settings.enabled) setLocked(false); }, [settings.enabled]);
  // Migration: phones that had the old "Biometric lock" switch on keep being locked (it locked on every return)
  useEffect(() => {
    if (bio.isLoading || !native || !bio.isEnabled) return;
    let has = false; try { has = localStorage.getItem('aastha_app_lock') !== null; } catch { /* ignore */ }
    if (!has) { saveLockSettings({ enabled: true, afterMs: 0, hideInSwitcher: false }); setSettings(loadLockSettings()); autoPrompt.current = true; setLocked(true); }
  }, [bio.isLoading, bio.isEnabled, native]);

  // Hide the app in "recent apps" (Android also blocks screenshots while on)
  useEffect(() => {
    if (!native) return;
    import('@capacitor-community/privacy-screen').then(({ PrivacyScreen }) =>
      (settings.enabled && settings.hideInSwitcher ? PrivacyScreen.enable() : PrivacyScreen.disable()).catch(() => {})
    ).catch(() => {});
  }, [native, settings.enabled, settings.hideInSwitcher]);

  const unlocked = useCallback(() => {
    setLocked(false);
    lastActivity.current = Date.now();
    hiddenAt.current = null;
  }, []);

  const tryBiometric = useCallback(async () => {
    if (!useBio || prompting.current) return;
    prompting.current = true;
    try {
      const ok = await bio.promptBiometrics();
      if (ok) unlocked();
    } finally {
      ignoreUntil.current = Date.now() + 1500; // the sheet closing may fire pause/resume — not a real "leave"
      prompting.current = false;
    }
  }, [useBio, bio, unlocked]);

  // Auto-show the system sheet when we lock for a cold start / return (not for idle — you may not be looking)
  useEffect(() => {
    if (locked && useBio && autoPrompt.current && !bio.isLoading) {
      autoPrompt.current = false;
      const t = setTimeout(tryBiometric, 250); // let the activity settle (S23/Android resume lag)
      return () => clearTimeout(t);
    }
  }, [locked, useBio, bio.isLoading, tryBiometric]);

  // Leave / come back
  useEffect(() => {
    const onHide = () => {
      if (prompting.current || Date.now() < ignoreUntil.current) return;
      if (hiddenAt.current === null) hiddenAt.current = Date.now();
    };
    const onShow = () => {
      if (prompting.current || Date.now() < ignoreUntil.current) { hiddenAt.current = null; return; }
      const s = loadLockSettings();
      if (!locked && shouldLockOnReturn(s, hiddenAt.current, Date.now())) { autoPrompt.current = true; setLocked(true); }
      hiddenAt.current = null;
      lastActivity.current = Date.now();
    };
    let remove: (() => void) | null = null;
    if (native) {
      const h = App.addListener('appStateChange', ({ isActive }) => (isActive ? onShow() : onHide()));
      remove = () => { h.then((l) => l.remove()).catch(() => {}); };
    } else {
      const v = () => (document.visibilityState === 'hidden' ? onHide() : onShow());
      document.addEventListener('visibilitychange', v);
      remove = () => document.removeEventListener('visibilitychange', v);
    }
    return () => { remove?.(); };
  }, [native, locked]);

  // Idle inside the app
  useEffect(() => {
    const touch = () => { lastActivity.current = Date.now(); };
    const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const t = setInterval(() => {
      if (locked || prompting.current || document.visibilityState === 'hidden') return;
      const busy = typeof isAutoLockBlocked === 'function' ? isAutoLockBlocked() : false; // music / focus timer running
      if (shouldLockForIdle(loadLockSettings(), lastActivity.current, Date.now(), busy)) { autoPrompt.current = false; setLocked(true); }
    }, 5000);
    return () => { evs.forEach((e) => window.removeEventListener(e, touch)); clearInterval(t); };
  }, [locked, isAutoLockBlocked]);

  return (
    <>
      {children}
      {locked && settings.enabled && createPortal(
        <LockScreen
          name={String(user?.name || '').split(' ')[0]}
          avatar={user?.avatar}
          biometric={useBio ? bio.kind : (native && bio.isLoading ? 'biometric' : null)} /* no password flash while the sensor check loads */
          onBiometric={tryBiometric}
          onUnlocked={unlocked}
          onSignOut={() => logout()}
          identifier={user?.username || user?.email || ''}
        />,
        document.body
      )}
    </>
  );
};

// ── Lock screen ────────────────────────────────────────────────────────────────────────────────────────────
const LockScreen: React.FC<{
  name: string; avatar?: string; biometric: 'fingerprint' | 'face' | 'biometric' | null;
  onBiometric: () => void; onUnlocked: () => void; onSignOut: () => void; identifier: string;
}> = ({ name, avatar, biometric, onBiometric, onUnlocked, onSignOut }) => {
  const [now, setNow] = useState(new Date());
  const [showPassword, setShowPassword] = useState(!biometric);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t); }, []);
  useEffect(() => { setShowPassword(!biometric); }, [biometric]);
  // block scrolling of the app underneath
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true); setError(null);
    try {
      await api.post('/users/verify-password', { password });
      setPassword('');
      onUnlocked();
    } catch (err: any) {
      setError(err?.response?.status === 429 ? 'Too many tries — wait a few minutes, or sign out and back in.' : 'That password didn’t match.');
    } finally { setBusy(false); }
  };

  const BioIcon = biometric === 'face' ? ScanFace : FingerprintPattern;
  const bioLabel = biometric === 'face' ? 'Unlock with face' : biometric === 'fingerprint' ? 'Unlock with fingerprint' : 'Unlock';
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?(am|pm)$/i, '');
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 z-[300] overflow-hidden bg-md-surface text-md-on-surface flex flex-col" role="dialog" aria-modal="true" aria-label="Aastha is locked">
      {/* soft aura from the user's own palette (same family as the chat background) */}
      <div aria-hidden className="absolute inset-0" style={{ background: `
        radial-gradient(70% 45% at 85% 8%, rgb(var(--md-primary) / 0.30), transparent 70%),
        radial-gradient(65% 40% at 0% 55%, rgb(var(--md-tertiary) / 0.20), transparent 72%),
        radial-gradient(80% 45% at 70% 100%, rgb(var(--md-secondary) / 0.22), transparent 70%)` }} />

      <div className="relative flex-1 flex flex-col items-center px-6 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+1.5rem)] max-w-md w-full mx-auto">
        {/* clock */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="font-serif text-[72px] leading-none tracking-tight tabular-nums">{time}</div>
          <div className="mt-2 text-sm text-md-on-surface-variant">{date}</div>
        </motion.div>

        {/* who */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }} className="mt-12 flex flex-col items-center">
          <div className="relative">
            <span aria-hidden className="absolute -inset-2 rounded-full bg-md-primary/20 blur-lg" />
            {avatar
              ? <img src={avatar} alt="" className="relative w-20 h-20 rounded-full object-cover border-2 border-md-surface" />
              : <img src="/logo.png" alt="" className="relative w-20 h-20 rounded-[26px] object-cover" />}
            <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center border-[3px] border-md-surface"><Lock size={14} /></span>
          </div>
          <h1 className="mt-5 font-serif text-2xl">{name ? `Welcome back, ${name}` : 'Welcome back'}</h1>
          <p className="mt-1 text-sm text-md-on-surface-variant">Aastha is locked</p>
        </motion.div>

        <div className="flex-1" />

        {/* unlock */}
        <AnimatePresence mode="wait" initial={false}>
          {!showPassword && biometric ? (
            <motion.div key="bio" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col items-center gap-4 w-full">
              <button onClick={onBiometric} aria-label={bioLabel}
                className="relative w-24 h-24 rounded-full glass glass-clear flex items-center justify-center text-md-primary active:scale-95 transition-transform">
                <motion.span aria-hidden className="absolute inset-0 rounded-full border-2 border-md-primary/50" animate={{ scale: [1, 1.25], opacity: [0.7, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }} />
                <BioIcon size={44} strokeWidth={1.6} />
              </button>
              <span className="text-sm font-medium">{bioLabel}</span>
              <button onClick={() => setShowPassword(true)} className="h-10 px-4 rounded-full text-sm text-md-on-surface-variant hover:bg-md-on-surface/[0.06] inline-flex items-center gap-2">
                <KeyRound size={15} /> Use password instead
              </button>
            </motion.div>
          ) : (
            <motion.form key="pw" onSubmit={submit} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="w-full">
              <label htmlFor="lock-pw" className="sr-only">Account password</label>
              <div className={`glass glass-clear rounded-full h-14 flex items-center gap-2 pl-5 pr-1.5 ${error ? 'ring-2 ring-md-error/70' : ''}`}>
                <KeyRound size={18} className="text-md-on-surface-variant shrink-0" />
                <input id="lock-pw" type="password" autoComplete="current-password" autoFocus value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }} placeholder="Your account password"
                  className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-md-on-surface-variant/70" />
                <button type="submit" disabled={!password || busy} aria-label="Unlock"
                  className="w-11 h-11 shrink-0 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center disabled:opacity-40">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                </button>
              </div>
              {error && <p role="alert" className="mt-3 text-center text-sm text-md-error">{error}</p>}
              {biometric && (
                <button type="button" onClick={() => { setShowPassword(false); onBiometric(); }} className="mt-3 mx-auto h-10 px-4 rounded-full text-sm text-md-on-surface-variant hover:bg-md-on-surface/[0.06] flex items-center gap-2">
                  <BioIcon size={16} /> {bioLabel}
                </button>
              )}
            </motion.form>
          )}
        </AnimatePresence>

        <button onClick={onSignOut} className="mt-6 h-9 px-3 rounded-full text-xs text-md-on-surface-variant/80 hover:text-md-on-surface inline-flex items-center gap-1.5">
          <LogOut size={13} /> Not you? Sign out
        </button>
      </div>
    </div>
  );
};
