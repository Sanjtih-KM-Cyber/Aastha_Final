import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import api from '../services/api';

/**
 * Widget window buttons: 'mac' (traffic lights on the left) or 'windows' (– ✕ on the right).
 * Saved on the account (PUT /users/preferences) so the phone and the web match; cached locally for an
 * instant first paint and for logged-out screens.
 */
export type WindowControls = 'mac' | 'windows';
const KEY = 'aastha_window_controls';
const EVT = 'aastha:window-controls';

const readLocal = (): WindowControls | null => {
  try { const v = localStorage.getItem(KEY); return v === 'mac' || v === 'windows' ? v : null; } catch { return null; }
};

export const useWindowControls = (): WindowControls => {
  const { user } = useAuth();
  const [local, setLocal] = useState<WindowControls | null>(readLocal);
  useEffect(() => {
    const sync = () => setLocal(readLocal());
    window.addEventListener(EVT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener('storage', sync); };
  }, []);
  const server = (user as any)?.windowControls as WindowControls | undefined;
  // keep the local cache in step with the account (e.g. changed on another device)
  useEffect(() => { if (server && server !== readLocal()) { try { localStorage.setItem(KEY, server); } catch { /* ignore */ } setLocal(server); } }, [server]);
  return server || local || 'windows';
};

export const saveWindowControls = async (value: WindowControls, updateUser?: (u: any) => void) => {
  try { localStorage.setItem(KEY, value); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
  updateUser?.({ windowControls: value });
  await api.put('/users/preferences', { windowControls: value });
};
