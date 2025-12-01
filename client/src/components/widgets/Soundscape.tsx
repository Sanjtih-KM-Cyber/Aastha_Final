
import React, { useState, useEffect, useRef } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
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

interface SoundscapeProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
}

const SOUNDS = [
  { id: 'rain', label: 'Rain', color: '#60A5FA', path: '/sounds/rain.mp3' },
  { id: 'forest', label: 'Forest', color: '#4ADE80', path: '/sounds/forest.mp3' },
  { id: 'fire', label: 'Fire', color: '#F87171', path: '/sounds/fire.mp3' },
  { id: 'ocean', label: 'Ocean', color: '#2DD4BF', path: '/sounds/ocean.mp3' },
  { id: 'night', label: 'Night', color: '#818CF8', path: '/sounds/night.mp3' },
  { id: 'wind', label: 'Wind', color: '#94A3B8', path: '/sounds/wind.mp3' },
  { id: 'thunder', label: 'Storm', color: '#A78BFA', path: '/sounds/storm2.mp3' }, // Fixed path
  { id: 'birds', label: 'Birds', color: '#FACC15', path: '/sounds/birds.mp3' }
];

export const Soundscape: React.FC<SoundscapeProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const { currentTheme } = useTheme();
  
  // State
  const [masterVolume, setMasterVolume] = useState(0.5);
  // Stores enabled sounds and their individual volume (0.0 - 1.0)
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
      audio.crossOrigin = "anonymous"; // Helpful for some CDN configs
      
      // Error Handling (Crash Prevention)
      audio.onerror = () => {
        console.warn(`Soundscape: Failed to load ${soundData.label} (${soundData.path})`);
        setErroredSounds(prev => new Set(prev).add(id));
        // Remove from active if it was playing
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

  // Sync Volumes & Playback Effect
  useEffect(() => {
    Object.keys(audioRefs.current).forEach(id => {
      const audio = audioRefs.current[id];
      if (!audio) return;

      const isLooping = activeLoops.hasOwnProperty(id);
      const isPreviewing = previewId === id;
      
      // Calculate target volume
      let targetVol = 0;
      if (isLooping) {
        targetVol = activeLoops[id] * masterVolume;
        audio.loop = true;
      } else if (isPreviewing) {
        targetVol = 0.5 * masterVolume; // Fixed preview volume scaled by master
        audio.loop = false;
      }

      // Apply safe volume
      audio.volume = Math.max(0, Math.min(1, targetVol));

      // Play/Pause Logic
      if ((isLooping || isPreviewing)) {
        if (audio.paused) {
            audio.play().catch(e => {
                console.warn(`Autoplay blocked or playback error for ${id}`, e);
                // If error is not a loading error (handled by onerror), it might be autoplay policy
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
  }, [activeLoops, masterVolume, previewId]);

  // Cleanup on unmount or close
  useEffect(() => {
    if (!isOpen) {
        // Pause all
        Object.values(audioRefs.current).forEach(a => a.pause());
        setPreviewId(null);
    }
  }, [isOpen]);

  // --- Handlers ---

  const toggleLoop = (id: string) => {
    if (erroredSounds.has(id)) return;

    setActiveLoops(prev => {
      const isActive = prev.hasOwnProperty(id);
      const newState = { ...prev };
      
      if (isActive) {
        delete newState[id];
      } else {
        // Start with 50% volume individual
        newState[id] = 0.5;
        // Ensure audio created
        getAudio(id);
      }
      return newState;
    });

    // Cancel preview if we activate it properly
    if (previewId === id) {
        setPreviewId(null);
        if(previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    }
  };

  const updateTrackVolume = (id: string, val: number) => {
    setActiveLoops(prev => ({
      ...prev,
      [id]: val
    }));
  };

  const handlePreview = (id: string) => {
    if (erroredSounds.has(id) || activeLoops.hasOwnProperty(id)) return;
    
    // Stop existing preview
    if (previewId && previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        setPreviewId(null);
    }

    // Stop if clicking same preview
    if (previewId === id) {
        setPreviewId(null);
        return;
    }

    // Start new
    getAudio(id);
    setPreviewId(id);

    // Auto stop after 5s
    previewTimeoutRef.current = setTimeout(() => {
        setPreviewId(null);
    }, 5000);
  };

  const activeCount = Object.keys(activeLoops).length;

  return (
    <DraggableWindow 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Ambient Mixer"
      initialWidth={360}
      initialHeight={600}
      defaultPosition={{ x: 850, y: 150 }}
      zIndex={zIndex || 10}
      onFocus={onFocus || (() => {})}
    >
      <div className="flex flex-col h-full w-full font-sans select-none">
        
        {/* --- TOP 35%: Master Control --- */}
        <div 
            className="h-[35%] relative flex flex-col items-center justify-center p-6 transition-colors duration-700 overflow-hidden"
            style={{ 
                background: `linear-gradient(180deg, ${currentTheme.primaryColor}20, #111827)` 
            }}
        >
            {/* Visualizer Rings */}
            <div className="relative mb-6">
                <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center relative z-10 shadow-2xl">
                    <Music size={32} className="text-white opacity-80" />
                </div>
                
                {/* Pulse 1 */}
                {activeCount > 0 && (
                    <motion.div 
                        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute inset-0 rounded-full border border-white/30"
                        style={{ borderColor: currentTheme.primaryColor }}
                    />
                )}
                {/* Pulse 2 */}
                {activeCount > 0 && (
                    <motion.div 
                        animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                        className="absolute inset-0 rounded-full border border-white/10"
                    />
                )}
            </div>

            {/* Master Volume */}
            <div className="w-full max-w-[200px] flex items-center gap-3 relative z-10">
                <VolumeX size={16} className="text-white/40" />
                <div className="flex-1 h-1.5 bg-black/40 rounded-full relative group cursor-pointer">
                    <div 
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-100" 
                        style={{ width: `${masterVolume * 100}%`, backgroundColor: currentTheme.primaryColor }} 
                    />
                    {/* Thumb */}
                    <div 
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ left: `${masterVolume * 100}%`, transform: 'translate(-50%, -50%)' }}
                    />
                    <input 
                        type="range" min="0" max="1" step="0.01"
                        value={masterVolume}
                        onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                </div>
                <Volume2 size={16} className="text-white/80" />
            </div>
            
            <p className="text-[10px] text-white/30 mt-3 uppercase tracking-widest font-medium">
                {activeCount === 0 ? 'Silence' : `${activeCount} Active Layers`}
            </p>

            {/* Noise Texture */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />
        </div>

        {/* --- BOTTOM 65%: Sound Library --- */}
        <div className="h-[65%] bg-gray-900 p-4 overflow-y-auto custom-scrollbar">
            <div className="space-y-3">
                {SOUNDS.map((sound) => {
                    const isActive = activeLoops.hasOwnProperty(sound.id);
                    const isPreviewing = previewId === sound.id;
                    const isError = erroredSounds.has(sound.id);
                    const volume = activeLoops[sound.id] || 0.5;

                    return (
                        <motion.div 
                            key={sound.id}
                            initial={false}
                            animate={{ 
                                backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                                borderColor: isActive ? sound.color : 'transparent'
                            }}
                            className={`
                                relative rounded-2xl border border-white/5 overflow-hidden transition-colors duration-300
                                ${isError ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                            `}
                        >
                            <div className="flex items-center p-3 gap-4">
                                {/* Icon / Visual */}
                                <div 
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner shrink-0"
                                    style={{ backgroundColor: isActive ? `${sound.color}30` : 'rgba(255,255,255,0.05)' }}
                                >
                                    {isError ? (
                                        <AlertCircle size={18} className="text-red-400" />
                                    ) : (
                                        <div 
                                            className="w-3 h-3 rounded-full transition-all duration-500"
                                            style={{ 
                                                backgroundColor: isActive ? sound.color : '#525252',
                                                boxShadow: isActive ? `0 0 10px ${sound.color}` : 'none',
                                                scale: isActive || isPreviewing ? 1.2 : 1
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-white/60'}`}>
                                            {sound.label}
                                        </span>
                                        {isPreviewing && <span className="text-[9px] text-teal-400 animate-pulse">Previewing...</span>}
                                    </div>
                                    
                                    {/* Volume Slider (Only visible when active) */}
                                    {isActive && (
                                        <div className="flex items-center gap-2 h-4">
                                            <Sliders size={10} className="text-white/30" />
                                            <div className="flex-1 h-1 bg-white/10 rounded-full relative group">
                                                <div 
                                                    className="absolute inset-y-0 left-0 rounded-full" 
                                                    style={{ width: `${volume * 100}%`, backgroundColor: sound.color }} 
                                                />
                                                <input 
                                                    type="range" min="0" max="1" step="0.05"
                                                    value={volume}
                                                    onChange={(e) => updateTrackVolume(sound.id, parseFloat(e.target.value))}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 shrink-0">
                                    {!isActive && !isError && (
                                        <button 
                                            onClick={() => handlePreview(sound.id)}
                                            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isPreviewing ? 'text-teal-400' : 'text-white/40'}`}
                                            title="Preview (5s)"
                                        >
                                            <Ear size={16} />
                                        </button>
                                    )}
                                    
                                    <button 
                                        onClick={() => toggleLoop(sound.id)}
                                        disabled={isError}
                                        className={`
                                            w-8 h-8 rounded-full flex items-center justify-center transition-all
                                            ${isActive 
                                                ? 'bg-white text-black hover:scale-105' 
                                                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}
                                        `}
                                    >
                                        {isActive ? <X size={14} /> : <Plus size={14} />}
                                    </button>
                                </div>
                            </div>
                            
                            {/* Subtle Activity Bar at bottom */}
                            {isActive && (
                                <motion.div 
                                    layoutId={`bar-${sound.id}`}
                                    className="h-0.5 w-full opacity-50"
                                    style={{ backgroundColor: sound.color }}
                                />
                            )}
                        </motion.div>
                    );
                })}
            </div>
            
            {/* Safe Mode Notice */}
            {erroredSounds.size > 0 && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs text-red-200 font-medium">Safe Mode Active</p>
                        <p className="text-[10px] text-red-200/60 leading-relaxed">
                            Some sounds failed to load (check /public/sounds/) and have been disabled to prevent crashes.
                        </p>
                    </div>
                </div>
            )}
        </div>
      </div>
    </DraggableWindow>
  );
};
