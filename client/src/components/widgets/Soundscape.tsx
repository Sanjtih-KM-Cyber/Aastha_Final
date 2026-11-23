import React, { useState, useEffect, useRef } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { SOUND_URLS } from '../../constants'; 
import { backgroundService } from '../../services/backgroundService';
import { 
  Volume2, 
  VolumeX,
  Play, 
  Pause, 
  Plus, 
  X, 
  Ear, 
  AlertCircle, 
  Music, 
  Sliders
} from 'lucide-react';
import { Icons } from '../../design/icons';

interface SoundscapeProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
  preset?: string; 
  volume?: number; 
  persistenceKey?: string;
}

const SOUNDS = [
  { id: 'rain', label: 'Rain', color: '#60A5FA', path: SOUND_URLS.rain },
  { id: 'forest', label: 'Forest', color: '#4ADE80', path: SOUND_URLS.forest },
  { id: 'fire', label: 'Fire', color: '#F87171', path: SOUND_URLS.fire },
  { id: 'ocean', label: 'Ocean', color: '#2DD4BF', path: SOUND_URLS.ocean },
  { id: 'night', label: 'Night', color: '#818CF8', path: SOUND_URLS.night },
  { id: 'wind', label: 'Wind', color: '#94A3B8', path: SOUND_URLS.wind },
  { id: 'thunder', label: 'Storm', color: '#A78BFA', path: SOUND_URLS.thunder },
  { id: 'birds', label: 'Birds', color: '#FACC15', path: SOUND_URLS.birds }
];

export const Soundscape: React.FC<SoundscapeProps> = ({ isOpen, onClose, zIndex, onFocus, preset, volume, persistenceKey }) => {
  const { currentTheme } = useTheme();
  
  // State
  const [masterVolume, setMasterVolume] = useState(0.5);
  const [activeLoops, setActiveLoops] = useState<Record<string, number>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [erroredSounds, setErroredSounds] = useState<Set<string>>(new Set());

  // Refs for Audio Objects
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Audio Engine ---

  const getAudio = (id: string) => {
    if (!audioRefs.current[id]) {
      const soundData = SOUNDS.find(s => s.id === id);
      if (!soundData) return null;

      const audio = new Audio(soundData.path);
      audio.crossOrigin = "anonymous"; 
      
      // Error Handling (Crash Prevention)
      audio.onerror = (e) => {
        console.warn(`Soundscape: Failed to load ${soundData.label}`, e);
        setErroredSounds(prev => new Set(prev).add(id));
        
        setActiveLoops(prev => {
            const newState = { ...prev };
            delete newState[id];
            return newState;
        });
        if (previewId === id) setPreviewId(null);
      };

      audioRefs.current[id] = audio;
    }
    return audioRefs.current[id];
  };

  // ✅ FIXED: Media Session Support for Lock Screen Controls
  useEffect(() => {
    if (isOpen && Object.keys(activeLoops).length > 0 && 'mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: "Ambient Soundscape",
            artist: "Aastha",
            artwork: [
                { src: 'https://i.imgur.com/8QZ9X9r.png', sizes: '512x512', type: 'image/png' } // Placeholder or app icon
            ]
        });

        // Handler Wrapper to ensure state access
        const handleStop = () => {
            onClose(); // Close widget on stop
        };

        navigator.mediaSession.setActionHandler('play', () => { /* No-op, already playing */ });
        navigator.mediaSession.setActionHandler('pause', handleStop); // Map Pause to Stop/Close
        navigator.mediaSession.setActionHandler('stop', handleStop);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);

        return () => {
            // Cleanup handlers
            navigator.mediaSession.setActionHandler('play', null);
            navigator.mediaSession.setActionHandler('pause', null);
            navigator.mediaSession.setActionHandler('stop', null);
        };
    }
  }, [isOpen, activeLoops, onClose]);

  // ✅ FIXED: Sync Volumes & Playback Effect with isOpen check AND Cleanup
  useEffect(() => {
    // 1. If widget is closed, FORCE STOP everything.
    if (!isOpen) {
        Object.values(audioRefs.current).forEach(a => a.pause());
        backgroundService.disable('soundscape');
        return; 
    }

    // 2. Normal Playback Logic (Only runs if isOpen is true)
    let hasActiveAudio = false;

    Object.keys(audioRefs.current).forEach(id => {
      const audio = audioRefs.current[id];
      if (!audio) return;

      const isLooping = activeLoops.hasOwnProperty(id);
      const isPreviewing = previewId === id;
      
      let targetVol = 0;
      if (isLooping) {
        targetVol = activeLoops[id] * masterVolume;
        audio.loop = true;
      } else if (isPreviewing) {
        targetVol = 0.5 * masterVolume; 
        audio.loop = false;
      }

      audio.volume = Math.max(0, Math.min(1, targetVol));

      if ((isLooping || isPreviewing)) {
        hasActiveAudio = true;
        if (audio.paused) {
            audio.play().catch(e => {
                if (isPreviewing) setPreviewId(null);
            });
        }
      } else {
        if (!audio.paused) {
            audio.pause();
            audio.currentTime = 0;
        }
      }
    });

    // 3. Background Mode Logic
    if (hasActiveAudio && masterVolume > 0) {
        const names = Object.keys(activeLoops).map(id => SOUNDS.find(s => s.id === id)?.label).join(', ');
        backgroundService.enable('soundscape', 'Soundscape Active 🌿', names || 'Playing ambient sounds...');
    } else {
        backgroundService.disable('soundscape');
    }

    // ✅ CLEANUP: Stop audio when component unmounts
    return () => {
        Object.values(audioRefs.current).forEach(a => a.pause());
        backgroundService.disable('soundscape');
    };

  }, [activeLoops, masterVolume, previewId, isOpen]); 

  // PERSISTENCE: Load state on mount
  useEffect(() => {
      const saved = localStorage.getItem('soundscape_state');
      if (saved) {
          try {
              const parsed = JSON.parse(saved);
              if (parsed.activeLoops) {
                  // Re-hydrate audio objects
                  Object.keys(parsed.activeLoops).forEach(id => getAudio(id));
                  setActiveLoops(parsed.activeLoops);
              }
              if (parsed.masterVolume !== undefined) setMasterVolume(parsed.masterVolume);
          } catch (e) { console.error("Failed to load soundscape state", e); }
      }
  }, []);

  // PERSISTENCE: Save state on change
  useEffect(() => {
      const state = { activeLoops, masterVolume };
      localStorage.setItem('soundscape_state', JSON.stringify(state));
  }, [activeLoops, masterVolume]);

  // Auto-configure from preset and volume
  useEffect(() => {
      if (isOpen) {
          if (preset) {
              if (preset === 'random') {
                  const newActive: Record<string, number> = {};
                  const available = SOUNDS.filter(s => !erroredSounds.has(s.id));
                  const count = 2 + Math.floor(Math.random() * 2);
                  for (let i = 0; i < count; i++) {
                      const rand = available[Math.floor(Math.random() * available.length)];
                      if (rand && !newActive[rand.id]) {
                          newActive[rand.id] = 0.3 + Math.random() * 0.5;
                          getAudio(rand.id);
                      }
                  }
                  setActiveLoops(newActive);
              } else {
                  const parts = preset.split(',');
                  const newActive: Record<string, number> = {};
                  setActiveLoops({});

                  parts.forEach(part => {
                      const [name, volStr] = part.split(':');
                      const cleanName = name.trim().toLowerCase();
                      const vol = volStr ? parseFloat(volStr) : 0.5;

                      const match = SOUNDS.find(s => s.id === cleanName || s.label.toLowerCase() === cleanName);
                      if (match) {
                          newActive[match.id] = isNaN(vol) ? 0.5 : vol;
                          getAudio(match.id);
                      }
                  });
                  setActiveLoops(newActive);
              }
          }

          if (volume !== undefined) {
              setMasterVolume(Math.max(0, Math.min(1, volume)));
          }
      }
  }, [isOpen, preset, volume]);

  // Cleanup on unmount or close (Redundant safety, but good to keep)
  useEffect(() => {
    if (!isOpen) {
        setPreviewId(null);
    }
  }, [isOpen]);

  const toggleLoop = (id: string) => {
    if (erroredSounds.has(id)) return;
    setActiveLoops(prev => {
      const isActive = prev.hasOwnProperty(id);
      const newState = { ...prev };
      if (isActive) { delete newState[id]; } 
      else { newState[id] = 0.5; getAudio(id); }
      return newState;
    });
    if (previewId === id) {
        setPreviewId(null);
        if(previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    }
  };

  const updateTrackVolume = (id: string, val: number) => {
    setActiveLoops(prev => ({ ...prev, [id]: val }));
  };

  const handlePreview = (id: string) => {
    if (erroredSounds.has(id) || activeLoops.hasOwnProperty(id)) return;
    if (previewId && previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        setPreviewId(null);
    }
    if (previewId === id) { setPreviewId(null); return; }
    getAudio(id);
    setPreviewId(id);
    previewTimeoutRef.current = setTimeout(() => { setPreviewId(null); }, 5000);
  };

  const activeCount = Object.keys(activeLoops).length;
  const EMOJI: Record<string, string> = { rain: '🌧️', forest: '🌲', fire: '🔥', ocean: '🌊', night: '🌙', wind: '🍃', thunder: '⛈️', birds: '🐦' };
  const fill = (v: number) => ({ ['--fill' as any]: `${Math.round(v * 100)}%` } as React.CSSProperties);

  return (
    <DraggableWindow
      isOpen={isOpen}
      onClose={onClose}
      title="Sounds"
      initialWidth={380}
      initialHeight={620}
      defaultPosition={{ x: 850, y: 150 }}
      zIndex={zIndex || 10}
      onFocus={onFocus || (() => {})}
      icon={Icons.sounds}
      persistenceKey={persistenceKey}
    >
      <div className="flex flex-col h-full w-full font-sans select-none px-3 pb-3 gap-3">

        {/* MASTER — tonal hero card */}
        <div className="shrink-0 rounded-[28px] bg-md-primary-container text-md-on-primary-container p-5">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <span className="w-14 h-14 rounded-[20px] bg-md-primary text-md-on-primary flex items-center justify-center relative z-10"><Music size={24} /></span>
              {activeCount > 0 && (
                <motion.span
                  aria-hidden
                  animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-[20px] border-2 border-md-primary"
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium opacity-80">{activeCount === 0 ? 'Nothing playing' : `${activeCount} layer${activeCount === 1 ? '' : 's'} playing`}</p>
              <h2 className="font-serif text-2xl leading-tight">Your mix</h2>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={() => setMasterVolume(masterVolume > 0 ? 0 : 0.5)} aria-label={masterVolume > 0 ? 'Mute' : 'Unmute'} className="shrink-0">
              {masterVolume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <input
              type="range" min="0" max="1" step="0.01"
              value={masterVolume}
              aria-label="Master volume"
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="m3-slider flex-1"
              style={fill(masterVolume)}
            />
            <span className="w-9 text-right text-xs font-medium tabular-nums">{Math.round(masterVolume * 100)}%</span>
          </div>
        </div>

        {/* LIBRARY — tiles; tap to add/remove, ear to preview */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]">
            {SOUNDS.map((sound) => {
              const isActive = Object.prototype.hasOwnProperty.call(activeLoops, sound.id);
              const isPreviewing = previewId === sound.id;
              const isError = erroredSounds.has(sound.id);
              const vol = activeLoops[sound.id] || 0.5;
              return (
                <div
                  key={sound.id}
                  className={`rounded-[24px] p-3 transition-colors duration-200 ease-md-emphasized
                    ${isActive ? 'bg-md-secondary-container text-md-on-secondary-container col-span-full' : 'bg-md-surface-container text-md-on-surface'}
                    ${isError ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleLoop(sound.id)}
                      disabled={isError}
                      aria-pressed={isActive}
                      aria-label={isActive ? `Stop ${sound.label}` : `Play ${sound.label}`}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <span className={`w-11 h-11 rounded-[16px] flex items-center justify-center text-xl shrink-0 ${isActive ? 'bg-md-primary/25' : 'bg-md-surface-container-highest'}`}>
                        {isError ? <AlertCircle size={18} className="text-md-error" /> : EMOJI[sound.id] || '🎵'}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{sound.label}</span>
                        <span className="block text-[11px] opacity-70">{isError ? 'Unavailable' : isActive ? 'Playing' : isPreviewing ? 'Previewing…' : 'Tap to add'}</span>
                      </span>
                    </button>
                    {!isActive && !isError && (
                      <button
                        onClick={() => handlePreview(sound.id)}
                        aria-label={`Preview ${sound.label} for 5 seconds`}
                        title="Preview (5 s)"
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${isPreviewing ? 'bg-md-primary text-md-on-primary' : 'text-md-on-surface-variant hover:bg-md-on-surface/10'}`}
                      >
                        <Ear size={16} />
                      </button>
                    )}
                    {isActive && (
                      <button onClick={() => toggleLoop(sound.id)} aria-label={`Remove ${sound.label}`} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 hover:bg-md-on-surface/10">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  {isActive && (
                    <div className="mt-2 flex items-center gap-3 pl-1">
                      <Sliders size={14} className="opacity-70 shrink-0" />
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={vol}
                        aria-label={`${sound.label} volume`}
                        onChange={(e) => updateTrackVolume(sound.id, parseFloat(e.target.value))}
                        className="m3-slider flex-1"
                        style={fill(vol)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {erroredSounds.size > 0 && (
            <div className="mt-3 p-3 rounded-[20px] bg-md-error-container text-md-on-error-container flex items-start gap-3">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">Some sounds couldn't load, so they're turned off for now. The rest keep playing.</p>
            </div>
          )}
        </div>
      </div>
    </DraggableWindow>
  );
};
