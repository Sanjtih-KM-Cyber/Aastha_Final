/**
 * Lock-screen + notification music controls (owner, 2026-11-25).
 *
 * APK: @jofr/capacitor-media-session gives Android a real media session: the player in the notification shade and on
 * the lock screen (title, artist, cover, previous / play-pause / next, seek bar), headset and Bluetooth buttons, and
 * a "media playback" foreground service so Android keeps the app awake while music plays (the Android WebView has
 * no Media Session API of its own, which is why our old navigator.mediaSession code did nothing in the APK).
 * Website: the browser's own navigator.mediaSession (what Chrome shows depends on the browser).
 *
 * Plugin quirks handled here: the notification only appears after setPlaybackState('playing'); every control
 * needs an explicit handler; setMetadata must always get an `artwork` array (a missing one crashes on Android).
 */
import { Capacitor } from '@capacitor/core';
import { MediaSession } from '@jofr/capacitor-media-session';

export interface MediaTrack { title: string; artist?: string; cover?: string }
export interface MediaHandlers {
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seekTo?: (seconds: number) => void;
  stop?: () => void;
}
type Action = 'play' | 'pause' | 'nexttrack' | 'previoustrack' | 'seekto' | 'stop';

const native = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const webSession = (): any => (typeof navigator !== 'undefined' && 'mediaSession' in navigator ? (navigator as any).mediaSession : null);

/** Cover for the system player: one https image (YouTube covers) or nothing. */
export const artworkFor = (cover?: string) =>
  cover && /^https:\/\//.test(cover) ? [{ src: cover, sizes: '480x360', type: 'image/jpeg' }] : [];

let lastKey = '';

export const mediaControls = {
  async setTrack(t: MediaTrack) {
    const key = `${t.title}|${t.artist}|${t.cover}`;
    if (key === lastKey) return; // the plugin downloads the cover every call
    lastKey = key;
    const meta = { title: t.title || 'Jam with Aastha', artist: t.artist || 'Aastha', album: 'Jam with Aastha', artwork: artworkFor(t.cover) };
    try {
      if (native()) await MediaSession.setMetadata(meta);
      else if (webSession() && typeof (window as any).MediaMetadata === 'function') webSession().metadata = new (window as any).MediaMetadata(meta);
    } catch (e) { console.warn('[MediaControls] metadata', e); }
  },

  async setPlaying(state: 'playing' | 'paused' | 'none') {
    try {
      if (native()) await MediaSession.setPlaybackState({ playbackState: state });
      else if (webSession()) webSession().playbackState = state;
    } catch (e) { console.warn('[MediaControls] state', e); }
    if (state === 'none') lastKey = '';
  },

  async setPosition(durationS: number, positionS: number) {
    if (!(durationS > 0) || !(positionS >= 0)) return;
    const opts = { duration: durationS, position: Math.min(positionS, durationS), playbackRate: 1 };
    try {
      if (native()) await MediaSession.setPositionState(opts);
      else webSession()?.setPositionState?.(opts);
    } catch { /* not supported */ }
  },

  async setHandlers(h: MediaHandlers | null) {
    const map: [Action, ((d?: any) => void) | null][] = [
      ['play', h ? () => h.play() : null],
      ['pause', h ? () => h.pause() : null],
      ['nexttrack', h ? () => h.next() : null],
      ['previoustrack', h ? () => h.previous() : null],
      ['seekto', h?.seekTo ? (d: any) => { const t = Number(d?.seekTime); if (Number.isFinite(t)) h.seekTo!(t); } : null],
      ['stop', h?.stop ? () => h.stop!() : null],
    ];
    for (const [action, fn] of map) {
      try {
        if (native()) await MediaSession.setActionHandler({ action }, fn as any);
        else webSession()?.setActionHandler?.(action, fn);
      } catch { /* this action isn't supported here */ }
    }
  },
};
