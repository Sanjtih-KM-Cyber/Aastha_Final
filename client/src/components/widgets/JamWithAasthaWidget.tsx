// client/src/components/widgets/JamWithAasthaWidget.tsx

import React, { useState, useRef, useEffect } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { 
  Play, Pause, SkipForward, SkipBack, Repeat, Search, 
  Disc, Sparkles, ListMusic, X, Settings,
  Music, Volume2, Volume1, VolumeX,
  ArrowUp, ArrowDown, Trash2, Minus, Plus, GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { backgroundService } from '../../services/backgroundService';
import type { LoopMode } from '../../types';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

// --- CONSTANTS (Inlined to prevent Circular Dependency/TDZ) ---
const LANGUAGES = [
    "English", "Hindi", "Hinglish", "Tamil", "Telugu",
    "Punjabi", "Malayalam", "Kannada", "Bengali", "Marathi",
    "Spanish", "French", "German", "Japanese", "Mandarin"
];

const MOOD_TAGS = ["Happy", "Sad", "Calm", "Energetic", "Romantic", "Focus", "Melancholy", "Party", "Lo-Fi"];
const GENRES = ["Lo-Fi", "Hip-Hop", "Pop", "Retro", "90s", "Modern", "Indie", "R&B", "Jazz", "Classical", "Rock", "Bollywood", "Acoustic", "EDM", "Ambient"];


// --- TYPES ---
interface Track {
    id: string; // The YouTube ID
    uuid: string; // Unique ID for Drag & Drop
    title: string;
    artist: string;
    thumbnail?: string;
}

interface JamWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
  initialParams?: any;
  persistenceKey?: string;
}

// --- HELPER COMPONENTS (Inlined) ---

// Reusable Stepper Component
interface StepperProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number;
    compact?: boolean;
}

const Stepper: React.FC<StepperProps> = ({ value, onChange, min = 0, max = 100, step = 1, compact = false }) => {
    const handleDecrement = () => {
        if (value - step >= min) onChange(value - step);
    };

    const handleIncrement = () => {
        if (value + step <= max) onChange(value + step);
    };

    const containerClass = compact
        ? "flex items-center bg-[#1F2937] rounded-lg border border-white/10 h-8 w-24 justify-between px-1"
        : "flex items-center bg-[#1F2937] rounded-lg border border-white/10 h-10 w-[120px] justify-between px-1";

    const btnClass = compact
        ? "w-6 h-6 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors"
        : "w-8 h-8 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors";

    return (
        <div className={containerClass}>
            <button
                onClick={handleDecrement}
                disabled={value <= min}
                className={btnClass}
            >
                <Minus size={compact ? 12 : 14} />
            </button>

            <span className={`text-sm font-medium text-white font-mono min-w-[20px] text-center ${compact ? 'text-xs' : ''}`}>
                {value}
            </span>

            <button
                onClick={handleIncrement}
                disabled={value >= max}
                className={btnClass}
            >
                <Plus size={compact ? 12 : 14} />
            </button>
        </div>
    );
};

// Mobile Queue Item
const MobileQueueItem = ({ track, index, isActive, onRemove, onPlay }: any) => {
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={track}
            id={track.uuid} // STABLE KEY
            dragListener={false} // Only use handle
            dragControls={controls}
            className="relative overflow-hidden mb-2"
            layout="position"
        >
            <motion.div
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors bg-[#111827] border-b border-white/5 relative z-10`}
                drag="x"
                dragConstraints={{ left: -100, right: 0 }}
                dragElastic={0.1}
                onDragEnd={(_, info) => {
                    if (info.offset.x < -80) { // Swipe Left threshold
                        onRemove();
                    }
                }}
                style={{ touchAction: 'pan-y' }}
            >
                {isActive ? (
                     <div className="w-1 h-6 bg-teal-400 rounded-full animate-pulse shrink-0"/>
                ) : (
                     <span className="w-4 text-[10px] text-white/30 text-center shrink-0">{index + 1}</span>
                )}

                <div className="flex-1 min-w-0" onClick={onPlay}>
                    <div className={`text-xs truncate font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>{track.title}</div>
                    <div className="text-[10px] truncate text-white/40">{track.artist}</div>
                </div>

                <div
                    onPointerDown={(e) => controls.start(e)}
                    className="p-2 touch-none cursor-grab active:cursor-grabbing text-white/30 hover:text-white"
                >
                    <GripVertical size={16} />
                </div>
            </motion.div>

            <div className="absolute inset-y-0 right-0 w-24 bg-red-500/20 flex items-center justify-end px-4 rounded-lg z-0">
                <Trash2 size={16} className="text-red-500" />
            </div>
        </Reorder.Item>
    );
};

// Desktop Queue Item
const DesktopQueueItem = ({ track, index, isActive, onRemove, onPlay, onMoveUp, onMoveDown, isFirst, isLast }: any) => {
    return (
        <div className={`group flex items-center gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}>
             {isActive ? (
                 <div className="w-1 h-8 bg-teal-400 rounded-full animate-pulse shrink-0"/>
             ) : (
                 <span className="w-4 text-[10px] text-white/30 text-center shrink-0">{index + 1}</span>
             )}

             <div className="flex-1 min-w-0 cursor-pointer" onClick={onPlay}>
                 <div className={`text-xs truncate font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>{track.title}</div>
                 <div className="text-[10px] truncate text-white/40">{track.artist}</div>
             </div>

             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={onMoveUp} disabled={isFirst} className="p-1 text-white/30 hover:text-white disabled:opacity-0"><ArrowUp size={12}/></button>
                 <button onClick={onMoveDown} disabled={isLast} className="p-1 text-white/30 hover:text-white disabled:opacity-0"><ArrowDown size={12}/></button>
                 <button onClick={onRemove} className="p-1 text-white/30 hover:text-red-400"><Trash2 size={12}/></button>
             </div>
         </div>
    );
};


// --- HELPER to Generate UUID ---
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface MinimizedPlayerProps {
    isPlaying: boolean;
    track: Track | undefined;
    onPlayPause: (e: React.MouseEvent) => void;
    onNext: (e: React.MouseEvent) => void;
    onPrev: (e: React.MouseEvent) => void;
}

const MinimizedPlayer: React.FC<MinimizedPlayerProps> = ({ isPlaying, track, onPlayPause, onNext, onPrev }) => (
    <div className="flex items-center gap-3 w-full max-w-full">
        {/* Prev */}
        <button
            onClick={onPrev}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center shrink-0"
        >
            <SkipBack size={14} className="text-white/70" />
        </button>

        {/* Play/Pause */}
        <button
            onClick={onPlayPause}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
        >
            {isPlaying ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="text-xs font-bold text-white truncate leading-tight">
                {track?.title || "No Track"}
            </span>
            <span className="text-xs text-white/50 truncate leading-tight">
                {track?.artist || "Aastha's Jam"}
            </span>
        </div>

        {/* Next */}
        <button
            onClick={onNext}
            className="p-1 text-white/30 hover:text-white shrink-0"
        >
            <SkipForward size={16} />
        </button>
    </div>
);

export const JamWithAasthaWidget: React.FC<JamWidgetProps> = ({ isOpen, onClose, zIndex, onFocus, initialParams, persistenceKey }) => {
  const { currentTheme } = useTheme();
  const { setPreventAutoLock } = useAuth();
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Loop Engine State
  const [loopMode, setLoopMode] = useState<LoopMode>('off');
  const [loopTarget, setLoopTarget] = useState(2);
  const [currentLoopCount, setCurrentLoopCount] = useState(1);

  // Persistence: Load on Mount
  useEffect(() => {
    const savedQ = localStorage.getItem('jam_queue');
    const savedIdx = localStorage.getItem('jam_index');
    const savedState = localStorage.getItem('jam_state');

    if (savedQ) {
        try {
            const parsed = JSON.parse(savedQ);
            if (Array.isArray(parsed)) {
                // MIGRATION: Ensure all loaded tracks have UUIDs
                const hydrated = parsed.map((t: any) => ({
                    ...t,
                    uuid: t.uuid || generateUUID()
                }));
                setQueue(hydrated);
            }
        } catch(e) { console.error("Failed to load queue", e); }
    }
    if (savedIdx) {
        const idx = parseInt(savedIdx);
        if (!isNaN(idx)) setCurrentIndex(idx);
    }
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            if (parsed.loopMode) setLoopMode(parsed.loopMode);
            if (parsed.loopTarget) setLoopTarget(parsed.loopTarget);
            if (parsed.isPlaying !== undefined) setIsPlaying(parsed.isPlaying);
        } catch (e) { console.error("Failed to load jam state", e); }
    }
  }, []);

  // Persistence: Save on Change
  useEffect(() => {
      localStorage.setItem('jam_queue', JSON.stringify(queue));
      localStorage.setItem('jam_index', currentIndex.toString());
      localStorage.setItem('jam_state', JSON.stringify({
          loopMode,
          loopTarget,
          isPlaying // Save playing state to auto-resume
      }));
  }, [queue, currentIndex, loopMode, loopTarget, isPlaying]);

  // --- MANAGER MODE: Auto-Generate Playlist from Params ---
  useEffect(() => {
      if (initialParams && isOpen) {
          const { query } = initialParams;

          // 1. SPECIFIC SONG SEARCH
          if (query) {
             setQuery(query); // Update UI
             handleSearch(undefined, query); // Force search
             return;
          }

          // 2. VIBE GENERATION (If no query)
          if (initialParams.mood || initialParams.genre || initialParams.genres || initialParams.language || initialParams.languages || initialParams.year || initialParams.specific_songs) {
             const m = initialParams.mood ? [initialParams.mood] : (initialParams.moods || []);
             const g = initialParams.genre ? [initialParams.genre] : (initialParams.genres || []);
             const l = initialParams.language ? [initialParams.language] : (initialParams.languages || []);
             const y = initialParams.year; // Pass year
             const s = initialParams.specific_songs || [];

             if (m.length > 0) setSelectedMoods(m);
             if (g.length > 0) setSelectedGenres(g);
             if (l.length > 0) setSelectedLanguages(l);

             // Trigger generation immediately with EXTRA params
             generateVibePlaylist(m, g, l, y, s);
          }
      }
  }, [initialParams, isOpen]);

  // AUTO-LOCK PREVENTION
  useEffect(() => {
      setPreventAutoLock('jam-widget', isPlaying);
      return () => setPreventAutoLock('jam-widget', false);
  }, [isPlaying, setPreventAutoLock]);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Scrubbing State
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);

  // Search & Input State
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // Generator State (Multi-Select)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [targetDuration, setTargetDuration] = useState<number>(30); // minutes
  
  // Volume State
  const [volume, setVolume] = useState(100);
  const [showVolume, setShowVolume] = useState(false);

  // Load Volume
  useEffect(() => {
      const savedVol = localStorage.getItem('jam_volume');
      if (savedVol) setVolume(parseInt(savedVol));
  }, []);

  // Save & Apply Volume
  useEffect(() => {
      localStorage.setItem('jam_volume', volume.toString());
      if (playerRef.current && playerRef.current.setVolume) {
          playerRef.current.setVolume(volume);
      }
  }, [volume]);
  
  // Ref to track latest state for YouTube Event Listener (Closure Fix)
  const stateRef = useRef({ loopMode, loopTarget, currentLoopCount, currentIndex, queue });

  useEffect(() => {
      stateRef.current = { loopMode, loopTarget, currentLoopCount, currentIndex, queue };
  }, [loopMode, loopTarget, currentLoopCount, currentIndex, queue]);

  // --- MEDIA NOTIFICATIONS (Native Lock Screen) ---
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrackData && isOpen) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTrackData.title,
            artist: currentTrackData.artist,
            artwork: [
                { src: currentTrackData.thumbnail || 'https://via.placeholder.com/512', sizes: '512x512', type: 'image/jpeg' }
            ]
        });

        navigator.mediaSession.setActionHandler('play', () => {
             if(playerRef.current && !isPlaying) playerRef.current.playVideo();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
             if(playerRef.current && isPlaying) playerRef.current.pauseVideo();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
             playNext();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
             playPrev();
        });
        navigator.mediaSession.setActionHandler('stop', () => {
             setIsPlaying(false);
             onClose();
        });
    } else if ('mediaSession' in navigator && (!currentTrackData || !isOpen)) {
        navigator.mediaSession.metadata = null;
    }
  }, [currentTrackData, isOpen, isPlaying, playNext, playPrev, onClose]);

  const playerRef = useRef<any>(null);
  const progressInterval = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- PERSISTENCE: TIME ---
  // Throttle updates to localStorage to avoid perf hit
  const lastTimeSaveRef = useRef(0);
  useEffect(() => {
      if (Math.abs(currentTime - lastTimeSaveRef.current) > 2) { // Save every 2 seconds diff
          localStorage.setItem('jam_time', currentTime.toString());
          lastTimeSaveRef.current = currentTime;
      }
  }, [currentTime]);


  // --- YouTube Init ---
  useEffect(() => {
    if (!document.getElementById('yt-script')) {
      const tag = document.createElement('script');
      tag.id = 'yt-script';
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // ✅ FIXED: Explicit cleanup to stop background service when Closed
  useEffect(() => {
    if (isOpen) {
       const checkYT = setInterval(() => {
           if (window.YT && window.YT.Player && !playerRef.current) {
               clearInterval(checkYT);
               initPlayer();
           }
       }, 500);
       
       return () => {
           clearInterval(checkYT);
           if (playerRef.current) {
               try {
                   playerRef.current.destroy();
               } catch (e) { console.error("Error destroying YT player", e); }
               playerRef.current = null;
           }
           
           // CRITICAL: Stop background service and reset playing state when widget closes
           setIsPlaying(false);
           backgroundService.disable('jam');
       };
    }
  }, [isOpen]);

  const initPlayer = () => {
    if (playerRef.current) return;
    playerRef.current = new window.YT.Player('jam-player-frame', {
        height: '0', width: '0',
        playerVars: { 'playsinline': 1, 'controls': 0, 'disablekb': 1, 'fs': 0, 'iv_load_policy': 3, 'autoplay': 1 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': (e: any) => console.error("YT Player Error:", e.data)
        }
    });
  };

  const onPlayerReady = (event: any) => {
      // Set initial volume
      event.target.setVolume(volume);

      // RESUME PLAYBACK LOGIC
      const savedTime = localStorage.getItem('jam_time');
      if (savedTime) {
          const t = parseFloat(savedTime);
          if (!isNaN(t) && t > 0) {
              event.target.seekTo(t);
          }
      }

      // Auto-play attempt
      if (queue.length > 0) {
         // Queue up the current video so controls are ready
         if (event.target.cueVideoById) {
             event.target.cueVideoById(queue[currentIndex].id);
             // Attempt to restore time again after cue
             if (savedTime) event.target.seekTo(parseFloat(savedTime));
         }

         // RESUME PLAYBACK IF WAS PLAYING
         if (isPlaying) {
             event.target.playVideo();
         }
      }
  };

  // --- Custom Loop Logic ---
  const onPlayerStateChange = (event: any) => {
    if (event.data === 1) { // Playing
      setIsPlaying(true);
      setDuration(playerRef.current.getDuration());
      startProgressLoop();

      // Enable Background Mode
      const currentTrack = queue[currentIndex];
      backgroundService.enable(
          'jam',
          "Jam with Aastha 🎵",
          currentTrack ? `${currentTrack.title} - ${currentTrack.artist}` : "Playing Music..."
      );

    } else if (event.data === 2) { // Paused
      setIsPlaying(false);
      stopProgressLoop();
      backgroundService.disable('jam');
    } else if (event.data === 0) { // Ended
      handleTrackEnd();
    }
  };

  const handleTrackEnd = () => {
      // Use Ref to get fresh values inside the event callback
      const { loopMode, loopTarget, currentLoopCount, currentIndex, queue } = stateRef.current;

      if (loopMode === 'one') {
          playerRef.current.seekTo(0);
          playerRef.current.playVideo();
      } else if (loopMode === 'custom') {
          if (currentLoopCount < loopTarget) {
              // Still in the loop cycle for THIS song
              setCurrentLoopCount(prev => prev + 1);
              playerRef.current.seekTo(0);
              playerRef.current.playVideo();
          } else {
              // Loop finished for this song
              setCurrentLoopCount(1);
              setLoopMode('off'); // Reset to Normal Play mode for the NEXT song

              if (currentIndex < queue.length - 1) {
                  // Move to next song
                  triggerNextTrack(currentIndex + 1);
              } else {
                  // This was the last song, stop playback
                  setIsPlaying(false);
              }
          }
      } else if (loopMode === 'all') {
          // Play Next logic, looping back to start if needed
          if (queue.length > 0) {
              const nextIndex = (currentIndex + 1) % queue.length;
              triggerNextTrack(nextIndex);
              setCurrentLoopCount(1);
          }
      } else {
          // Loop Mode Off (Normal)
          if (currentIndex < queue.length - 1) {
              // Play Next
              triggerNextTrack(currentIndex + 1);
          } else {
              // Last track finished -> Clear Queue & Stop (User Req: "remove all at once")
              setQueue([]);
              setIsPlaying(false);
              setCurrentIndex(0);
              backgroundService.disable('jam');
          }
      }
  };

  const triggerNextTrack = (nextIndex: number) => {
      setCurrentIndex(nextIndex);
      loadAndPlay(queue[nextIndex]);
  };

  const loadAndPlay = (track: Track) => {
      if (playerRef.current && playerRef.current.loadVideoById) {
          playerRef.current.loadVideoById(track.id);
          playerRef.current.playVideo();
          setIsPlaying(true);
      }
  };

  const playNext = () => {
      if (queue.length === 0) return;
      const nextIndex = (currentIndex + 1) % queue.length;
      triggerNextTrack(nextIndex);
      setCurrentLoopCount(1); 
  };

  const playPrev = () => {
      if (queue.length === 0) return;
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      setCurrentIndex(prevIndex);
      loadAndPlay(queue[prevIndex]);
      setCurrentLoopCount(1);
  };

  const startProgressLoop = () => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 1000);
  };

  const stopProgressLoop = () => {
    if (progressInterval.current) clearInterval(progressInterval.current);
  };

  // --- Handlers ---

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
      e?.preventDefault();
      const q = overrideQuery || query;
      if (!q.trim()) return;

      setIsSearching(true);
      try {
          const res = await api.get(`/data/videos/search?q=${encodeURIComponent(q)}`);
          
          if (Array.isArray(res.data) && res.data.length > 0) {
              const newTrack = {
                  ...res.data[0],
                  uuid: generateUUID()
              };

              if (queue.length > 0) {
                  setQueue(prev => [...prev, newTrack]);
              } else {
                  setQueue([newTrack]);
                  setCurrentIndex(0);
                  setTimeout(() => loadAndPlay(newTrack), 100);
              }
              
          } else {
              console.warn("No results found for query:", q);
          }
      } catch (e) { console.error("Search failed", e); } 
      finally { setIsSearching(false); if(!overrideQuery) setQuery(''); }
  };

  const handleReorder = (newQueue: Track[]) => {
      const currentTrackUUID = queue[currentIndex]?.uuid;
      setQueue(newQueue);

      if (currentTrackUUID) {
          const newIndex = newQueue.findIndex(t => t.uuid === currentTrackUUID);
          if (newIndex !== -1) setCurrentIndex(newIndex);
      }
  };

  const moveTrack = (index: number, direction: 'up' | 'down') => {
      if (direction === 'up' && index > 0) {
          setQueue(prev => {
              const newQ = [...prev];
              [newQ[index], newQ[index - 1]] = [newQ[index - 1], newQ[index]];
              return newQ;
          });
          if (currentIndex === index) setCurrentIndex(index - 1);
          else if (currentIndex === index - 1) setCurrentIndex(index);
      } else if (direction === 'down' && index < queue.length - 1) {
          setQueue(prev => {
              const newQ = [...prev];
              [newQ[index], newQ[index + 1]] = [newQ[index + 1], newQ[index]];
              return newQ;
          });
          if (currentIndex === index) setCurrentIndex(index + 1);
          else if (currentIndex === index + 1) setCurrentIndex(index);
      }
  };

  const removeFromQueue = (index: number) => {
      setQueue(prev => {
          const newQueue = [...prev];
          newQueue.splice(index, 1);
          return newQueue;
      });
      if (index < currentIndex) {
          setCurrentIndex(prev => prev - 1);
      } else if (index === currentIndex) {
          if (queue.length <= 1) {
             setIsPlaying(false);
             setCurrentIndex(0);
          } else {
             const nextIdx = index >= queue.length - 1 ? 0 : index;
             setCurrentIndex(nextIdx);
          }
      }
  };

  const handleGenerateClick = () => {
      setShowConfigModal(true);
  };

  const toggleSelection = (list: string[], item: string, setList: (l: string[]) => void) => {
      if (list.includes(item)) {
          setList(list.filter(i => i !== item));
      } else {
          setList([...list, item]);
      }
  };

  const generateVibePlaylist = async (
      overrideMood?: string | string[],
      overrideGenre?: string | string[],
      overrideLang?: string | string[],
      overrideYear?: string,
      specificSongs?: string[]
  ) => {
      setShowConfigModal(false);
      setIsSearching(true);
      
      setQueue([]);

      let langsToSend = selectedLanguages.length > 0 ? selectedLanguages : ["English"];
      if (overrideLang) langsToSend = Array.isArray(overrideLang) ? overrideLang : [overrideLang];

      let moodsToSend = selectedMoods;
      if (overrideMood) moodsToSend = Array.isArray(overrideMood) ? overrideMood : [overrideMood];

      let genresToSend = selectedGenres;
      if (overrideGenre) genresToSend = Array.isArray(overrideGenre) ? overrideGenre : [overrideGenre];

      try {
          const res = await api.post('/ai/generate-vibe', { 
              languages: langsToSend,
              moods: moodsToSend,
              genres: genresToSend,
              year: overrideYear,
              specific_songs: specificSongs,
              duration: targetDuration
          });
          
          if (res.data && Array.isArray(res.data)) {
              const tracks = res.data.map((t: any) => ({ ...t, uuid: generateUUID() }));

              setQueue(tracks);
              setCurrentIndex(0);
              setTimeout(() => {
                  if (tracks.length > 0) {
                    loadAndPlay(tracks[0]);
                    setCurrentLoopCount(1);
                  }
              }, 100);
          } else {
              alert("Could not generate a vibe. Try manual search.");
          }
      } catch (e) {
          console.error("Vibe Gen Error:", e);
          alert("Failed to generate vibe. Aastha might be busy.");
      } finally {
          setIsSearching(false);
      }
  };

  const toggleLoopMode = () => {
      const modes: LoopMode[] = ['off', 'all', 'one', 'custom'];
      const nextIndex = (modes.indexOf(loopMode) + 1) % modes.length;
      setLoopMode(modes[nextIndex]);
      setCurrentLoopCount(1);
  };

  const formatTime = (s: number) => {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const currentTrackData = queue[currentIndex];

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
      const check = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', check);
      return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Jam with Aastha"
      initialWidth={360} initialHeight={620} defaultPosition={{ x: 800, y: 150 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
      icon={Music}
      color="#8B5CF6"
      minimizedContent={
          <MinimizedPlayer 
             isPlaying={isPlaying} 
             track={currentTrackData}
             onPlayPause={(e) => {
                e.stopPropagation();
                if (!playerRef.current) return;
                if (isPlaying) playerRef.current.pauseVideo();
                else playerRef.current.playVideo();
             }}
             onNext={(e) => { e.stopPropagation(); playNext(); }}
             onPrev={(e) => { e.stopPropagation(); playPrev(); }}
          />
      }
      persistenceKey={persistenceKey}
    >
      <div className="flex flex-col h-full w-full font-sans select-none relative">
        
        {/* Hidden Player */}
        <div id="jam-player-frame" className="absolute pointer-events-none opacity-0" />

        {/* --- CONFIGURATION MODAL --- */}
        <AnimatePresence>
            {showConfigModal && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-6"
                >
                    <div className="w-full h-full flex flex-col">
                        <div className="flex items-center justify-between mb-4 shrink-0">
                            <h3 className="text-xl font-serif text-white">Curate Your Vibe</h3>
                            <button onClick={() => setShowConfigModal(false)}><X className="text-white/50 hover:text-white"/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-6">
                            {/* Languages */}
                            <div>
                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Languages (Multi-Select)</h4>
                                <div className="flex flex-wrap gap-2">
                                    {LANGUAGES.map(lang => (
                                        <button
                                            key={lang}
                                            onClick={() => toggleSelection(selectedLanguages, lang, setSelectedLanguages)}
                                            className={`
                                                px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                                                ${selectedLanguages.includes(lang) 
                                                    ? 'bg-white text-black border-white' 
                                                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}
                                            `}
                                        >
                                            {lang}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Moods */}
                            <div>
                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Vibe Override (Multi-Select)</h4>
                                <div className="flex flex-wrap gap-2">
                                    {MOOD_TAGS.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => toggleSelection(selectedMoods, tag, setSelectedMoods)}
                                            className={`
                                                px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                                                ${selectedMoods.includes(tag) 
                                                    ? 'bg-teal-500/20 text-teal-200 border-teal-500/50' 
                                                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}
                                            `}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Genres */}
                            <div>
                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Genre (Multi-Select)</h4>
                                <div className="flex flex-wrap gap-2">
                                    {GENRES.map(genre => (
                                        <button
                                            key={genre}
                                            onClick={() => toggleSelection(selectedGenres, genre, setSelectedGenres)}
                                            className={`
                                                px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                                                ${selectedGenres.includes(genre)
                                                    ? 'bg-purple-500/20 text-purple-200 border-purple-500/50'
                                                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'}
                                            `}
                                        >
                                            {genre}
                                        </button>
                                    ))}
                                </div>
                            </div>

                             {/* Duration Slider Replaced by Stepper */}
                            <div>
                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Session Duration</h4>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-center">
                                        <div className="flex flex-col">
                                            <div className="text-xs text-white/60 mb-1">Duration (min)</div>
                                            <div className="text-[10px] text-white/30">10 - 400 min</div>
                                        </div>
                                        <Stepper 
                                            value={targetDuration}
                                            onChange={setTargetDuration}
                                            min={10}
                                            max={400}
                                            step={10}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-white/10 shrink-0">
                            <button 
                                onClick={() => generateVibePlaylist()}
                                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 bg-white text-black hover:scale-[1.02] transition-transform"
                            >
                                <Sparkles size={16} className="text-amber-600" /> Generate Playlist
                            </button>
                            <p className="text-[10px] text-white/30 mt-3 text-center">
                                Aastha will blend your chat context with these preferences.
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* --- TOP 55%: The Stage --- */}
        <div 
            className="h-[55%] relative flex flex-col items-center p-6 transition-colors duration-700 overflow-hidden"
            style={{ background: `linear-gradient(180deg, ${currentTheme.primaryColor}40, #111827)` }}
        >
            {/* Input Bar */}
            <div className="w-full relative z-20 mb-6 mt-8">
                <form onSubmit={handleSearch} className="relative flex gap-2">
                    <div className="relative flex-1">
                        <input 
                            value={query} onChange={e => setQuery(e.target.value)}
                            placeholder="Search song..." 
                            className="w-full bg-black/30 backdrop-blur-md border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-all pr-8"
                        />
                        <button
                            type="submit" // Trigger Search on Click
                            onClick={handleSearch}
                            className="absolute right-3 top-2.5 text-white/30 hover:text-white transition-colors"
                        >
                            <Search size={14} />
                        </button>
                    </div>
                    <button 
                        type="button"
                        onClick={handleGenerateClick}
                        className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-full px-3 flex items-center justify-center transition-all"
                        title="Configure Vibe"
                    >
                        {isSearching ? <Sparkles className="animate-spin text-white" size={16} /> : <Settings size={16} style={{ color: currentTheme.primaryColor }} />}
                    </button>
                </form>
            </div>

            {/* Album Art Centerpiece (Updated Visuals) */}
            <div className="relative flex-1 flex items-center justify-center w-full">
                {isPlaying && (
                    <motion.div 
                        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                        className="absolute w-64 h-64 rounded-full blur-3xl"
                        style={{ backgroundColor: currentTheme.primaryColor }}
                    />
                )}

                <motion.div
                    className="w-56 h-56 rounded-full shadow-2xl flex items-center justify-center relative overflow-hidden z-10"
                    animate={{ scale: isPlaying ? [1, 1.02, 1] : 1 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    {/* Background Blur of Art */}
                     {currentTrackData?.thumbnail && (
                        <div
                            className="absolute inset-0 bg-cover bg-center blur-sm opacity-50 scale-110"
                            style={{ backgroundImage: `url(${currentTrackData.thumbnail})` }}
                        />
                    )}

                    {/* Actual Art */}
                    <div className="w-full h-full rounded-full overflow-hidden border border-white/10 relative z-20">
                        {currentTrackData?.thumbnail ? (
                            <img src={currentTrackData.thumbnail} className="w-full h-full object-cover" alt="Art" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                <Disc size={48} className="text-white/20" />
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>

        {/* --- BOTTOM 45%: The Deck --- */}
        <div className="h-[45%] bg-gray-900 p-6 flex flex-col justify-between relative z-10 overflow-hidden">
            
            {showQueue ? (
                <div className="flex-1 overflow-y-auto pr-1 -mr-2 mb-4 custom-scrollbar">
                     <div className="flex justify-between items-center mb-3 sticky top-0 bg-gray-900 z-10 pb-2 border-b border-white/5">
                        <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest">Queue ({queue.length})</h3>
                        <button onClick={() => setShowQueue(false)} className="text-white/40 hover:text-white"><X size={14}/></button>
                     </div>
                     {queue.length === 0 ? (
                         <div className="text-white/20 text-center py-8 text-xs italic">Queue is empty</div>
                     ) : (
                         // CONDITIONAL RENDERING BASED ON DEVICE
                         isMobile ? (
                             <Reorder.Group axis="y" values={queue} onReorder={handleReorder} className="space-y-2">
                                 {queue.map((track, idx) => (
                                     <MobileQueueItem
                                        key={track.uuid}
                                        track={track}
                                        index={idx}
                                        isActive={currentIndex === idx}
                                        onPlay={() => { setCurrentIndex(idx); loadAndPlay(track); }}
                                        onRemove={() => removeFromQueue(idx)}
                                     />
                                 ))}
                             </Reorder.Group>
                         ) : (
                             <div className="space-y-2">
                                 {queue.map((track, idx) => (
                                     <DesktopQueueItem
                                        key={track.uuid}
                                        track={track}
                                        index={idx}
                                        isActive={currentIndex === idx}
                                        onPlay={() => { setCurrentIndex(idx); loadAndPlay(track); }}
                                        onMoveUp={() => moveTrack(idx, 'up')}
                                        onMoveDown={() => moveTrack(idx, 'down')}
                                        onRemove={() => removeFromQueue(idx)}
                                        isFirst={idx === 0}
                                        isLast={idx === queue.length - 1}
                                     />
                                 ))}
                             </div>
                         )
                     )}
                </div>
            ) : (
                <>
                    {/* Track Info */}
                    <div className="flex justify-between items-end mb-2">
                        <div className="overflow-hidden">
                            <h3 className="text-white font-bold text-lg truncate pr-4">
                                {currentTrackData?.title || 'Ready to Jam'}
                            </h3>
                            <p className="text-white/40 text-xs font-medium truncate">
                                {currentTrackData?.artist || 'Select a song or ask Aastha'}
                            </p>
                        </div>
                        {loopMode === 'custom' && (
                            <div className="text-[10px] text-white/30 font-mono text-right">
                                Loop: <span style={{ color: currentTheme.primaryColor }}>{currentLoopCount}</span>/{loopTarget}
                            </div>
                        )}
                    </div>

                    {/* Progress Bar with Fluid Scrubbing */}
                    <div className="mb-6 group">
                        <div className="flex justify-between text-[10px] text-white/30 mb-1 font-mono group-hover:text-white/50 transition-colors">
                            <span>{formatTime(isDragging ? dragTime : currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                        <div className="h-4 flex items-center relative">
                            {/* Background Track */}
                            <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden pointer-events-none">
                                <div 
                                    className="h-full" 
                                    style={{ 
                                        width: `${((isDragging ? dragTime : currentTime) / (duration || 1)) * 100}%`,
                                        backgroundColor: currentTheme.primaryColor 
                                    }}
                                />
                            </div>
                            
                            {/* Range Input for Smooth Scrubbing */}
                            <input 
                                type="range" 
                                min="0" 
                                max={duration || 100} 
                                value={isDragging ? dragTime : currentTime}
                                onMouseDown={() => setIsDragging(true)}
                                onTouchStart={() => setIsDragging(true)}
                                onChange={(e) => setDragTime(parseFloat(e.target.value))}
                                onMouseUp={(e) => {
                                    setIsDragging(false);
                                    if (playerRef.current) playerRef.current.seekTo(parseFloat(e.currentTarget.value));
                                }}
                                onTouchEnd={(e) => {
                                    setIsDragging(false);
                                    if (playerRef.current) playerRef.current.seekTo(dragTime);
                                }}
                                className="w-full h-full opacity-0 cursor-pointer z-10"
                            />

                            {/* Visible Thumb (follows input value) */}
                            <div 
                                className="absolute w-3 h-3 bg-white rounded-full shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ 
                                    left: `calc(${((isDragging ? dragTime : currentTime) / (duration || 1)) * 100}% - 6px)` 
                                }}
                            />
                        </div>
                    </div>
                </>
            )}

            <div className="flex items-center justify-between shrink-0">
                {/* Loop Control */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={toggleLoopMode}
                        className={`p-2 rounded-lg transition-all ${loopMode !== 'off' ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white'}`}
                        title={`Loop: ${loopMode}`}
                    >
                        <Repeat size={18} />
                        {loopMode === 'one' && <span className="absolute text-[8px] font-bold ml-[-6px] mt-[6px]">1</span>}
                        {loopMode === 'custom' && <span className="absolute text-[8px] font-bold ml-[-6px] mt-[6px]">*</span>}
                    </button>
                    {/* Custom Loop Input - Upgraded to Stepper */}
                    {loopMode === 'custom' && (
                         <div className="ml-2">
                             <Stepper 
                                value={loopTarget}
                                onChange={setLoopTarget}
                                min={2}
                                max={50}
                                step={1}
                                compact={true}
                             />
                         </div>
                    )}
                </div>

                {/* Playback Controls & Volume */}
                <div className="flex items-center gap-4 relative">
                    {/* Volume Control */}
                    <div
                        className="relative flex items-center"
                        onMouseEnter={() => setShowVolume(true)}
                        onMouseLeave={() => setShowVolume(false)}
                    >
                        <button className="text-white/40 hover:text-white transition-colors p-2">
                            {volume === 0 ? <VolumeX size={18} /> : volume < 50 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                        </button>

                        <AnimatePresence>
                            {showVolume && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -10 }}
                                    className="absolute left-full ml-2 bg-[#1F2937] rounded-full p-2 h-8 flex items-center border border-white/10 z-20 w-24"
                                >
                                    <input
                                        type="range"
                                        min="0" max="100"
                                        value={volume}
                                        onChange={(e) => setVolume(parseInt(e.target.value))}
                                        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <button onClick={playPrev} className="text-white/40 hover:text-white transition-colors">
                        <SkipBack size={24} />
                    </button>
                    <button 
                        onClick={() => {
                            if (!playerRef.current) return;

                            // FORCE LOAD logic if state is "unstarted" (or sometimes -1/5)
                            // If user clicked play but video isn't actually loaded/playing yet
                            const state = playerRef.current.getPlayerState ? playerRef.current.getPlayerState() : -1;

                            if (isPlaying) {
                                playerRef.current.pauseVideo();
                            } else {
                                // If unstarted or cued, we might need to nudge it
                                if ((state === -1 || state === 5) && queue.length > 0) {
                                    playerRef.current.loadVideoById(queue[currentIndex].id);
                                    // Restore time if saved
                                    const savedTime = localStorage.getItem('jam_time');
                                    if (savedTime) playerRef.current.seekTo(parseFloat(savedTime));
                                } else {
                                    playerRef.current.playVideo();
                                }
                            }
                        }}
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                    </button>
                    <button onClick={playNext} className="text-white/40 hover:text-white transition-colors">
                        <SkipForward size={24} />
                    </button>
                </div>

                {/* Queue / Misc */}
                <button onClick={() => setShowQueue(!showQueue)} className={`p-2 transition-colors relative ${showQueue ? 'text-white bg-white/10 rounded-lg' : 'text-white/30 hover:text-white'}`}>
                    <ListMusic size={20} />
                    {!showQueue && <span className="absolute -top-1 -right-1 bg-white/10 text-[9px] w-4 h-4 flex items-center justify-center rounded-full text-white/70">{queue.length}</span>}
                </button>
            </div>

        </div>
      </div>
    </DraggableWindow>
  );
};
