// client/src/components/widgets/JamWithAasthaWidget.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { 
  Play, Pause, SkipForward, SkipBack, Repeat, Search, 
  Disc, Sparkles, ListMusic, X, Settings,
  Music, Volume2, Volume1, VolumeX, Check, Loader2
} from 'lucide-react';
import { Icons } from '../../design/icons';
import { Button, IconButton, Chip } from '../../design/ui';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { backgroundService } from '../../services/backgroundService';
import { Stepper, MobileQueueItem, DesktopQueueItem, Track } from './JamComponents';

// ✅ IMPORT CONSTANTS (Fixes ReferenceError / Circular Dep)
import { 
    LANGUAGES, 
    MOOD_TAGS, 
    GENRES
} from '../../constants';
import { LoopMode } from '../../types';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

interface JamWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
  initialParams?: any;
  persistenceKey?: string;
}

const SESSION_LENGTHS = [15, 30, 45] as const; // a playlist is <= 12 songs (server: songsForMinutes)
const REPEAT_LABEL: Record<LoopMode, string> = { off: 'Repeat off', all: 'Repeat all', one: 'Repeat this song', custom: 'Repeat this song a few times' };

// --- Helper to Generate UUID ---
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
            aria-label="Previous"
            className="w-8 h-8 rounded-full hover:bg-md-on-surface/10 flex items-center justify-center shrink-0 text-md-on-surface-variant"
        >
            <SkipBack size={14} />
        </button>

        {/* Play/Pause */}
        <button
            onClick={onPlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-8 h-8 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center shrink-0"
        >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="text-xs font-semibold text-md-on-surface truncate leading-tight">
                {track?.title || "No Track"}
            </span>
            <span className="text-xs text-md-on-surface-variant truncate leading-tight">
                {track?.artist || "Aastha's Jam"}
            </span>
        </div>

        {/* Next */}
        <button
            onClick={onNext}
            aria-label="Next"
            className="w-8 h-8 rounded-full hover:bg-md-on-surface/10 flex items-center justify-center shrink-0 text-md-on-surface-variant"
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
  const [targetDuration, setTargetDuration] = useState<number>(30); // minutes (15 / 30 / 45)
  // Short message under the search bar (replaces alert() pop-ups)
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 5000); return () => clearTimeout(t); }, [notice]);
  
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
    // ✅ FIXED: Use 10x10 dimensions to prevent aggressive background pausing on mobile WebViews
    playerRef.current = new window.YT.Player('jam-player-frame', {
        height: '10', width: '10',
        playerVars: { 'playsinline': 1, 'controls': 0, 'disablekb': 1, 'fs': 0, 'iv_load_policy': 3, 'autoplay': 1 },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': (e: any) => onPlayerError(e?.data)
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

  // 2 bad id, 5 HTML5 error, 100 removed, 101/150 owner blocked embedding: skip to the next song (max 3 in a row)
  const skippedInARow = useRef(0);
  const onPlayerError = (code: number) => {
      console.warn('YT Player Error:', code);
      const { queue, currentIndex } = stateRef.current;
      if (skippedInARow.current >= 3 || queue.length <= 1) {
          skippedInARow.current = 0;
          setIsPlaying(false);
          setNotice("This song won't play here. Try another one.");
          return;
      }
      skippedInARow.current += 1;
      const next = (currentIndex + 1) % queue.length;
      setCurrentIndex(next);
      loadAndPlay(queue[next]);
  };

  // --- Custom Loop Logic ---
  const onPlayerStateChange = (event: any) => {
    if (event.data === 1) { // Playing
      skippedInARow.current = 0;
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
          // Loop Mode Off (Normal) - Auto-Remove Played Track
          // Remove the finished track (current one)
          const newQueue = [...queue];
          newQueue.splice(currentIndex, 1);

          setQueue(newQueue);

          if (newQueue.length > 0) {
              const nextIdx = currentIndex >= newQueue.length ? 0 : currentIndex;
              setCurrentIndex(nextIdx);
              loadAndPlay(newQueue[nextIdx]);
              setCurrentLoopCount(1);
          } else {
              setIsPlaying(false);
              setCurrentIndex(0);
          }
      }
  };

  // Define playPrev/Next as useCallback for stability in effects
  const triggerNextTrack = useCallback((nextIndex: number) => {
      setCurrentIndex(nextIndex);
      loadAndPlay(queue[nextIndex]);
  }, [queue]);

  const loadAndPlay = (track: Track) => {
      if (playerRef.current && playerRef.current.loadVideoById) {
          playerRef.current.loadVideoById(track.id);
          playerRef.current.playVideo();
          setIsPlaying(true);
      }
  };

  const playNext = useCallback(() => {
      if (queue.length === 0) return;
      const nextIndex = (currentIndex + 1) % queue.length;
      triggerNextTrack(nextIndex);
      setCurrentLoopCount(1); 
  }, [queue, currentIndex, triggerNextTrack]);

  const playPrev = useCallback(() => {
      if (queue.length === 0) return;
      const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
      setCurrentIndex(prevIndex);
      loadAndPlay(queue[prevIndex]);
      setCurrentLoopCount(1);
  }, [queue, currentIndex]);

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

  // ✅ FIXED: Media Session Metadata
  useEffect(() => {
      if ('mediaSession' in navigator && queue.length > 0) {
          const track = queue[currentIndex];
          navigator.mediaSession.metadata = new MediaMetadata({
              title: track.title,
              artist: track.artist,
              artwork: [
                  { src: track.thumbnail || 'https://i.imgur.com/8QZ9X9r.png', sizes: '512x512', type: 'image/png' }
              ]
          });
      }
  }, [queue, currentIndex]);

  // ✅ FIXED: Media Session Handlers (Notification Controls)
  useEffect(() => {
      if ('mediaSession' in navigator) {
          const handleStop = () => {
              if (playerRef.current && playerRef.current.pauseVideo) playerRef.current.pauseVideo();
              onClose(); // Stop means "Close Widget" / "Clear Notification"
          };

          navigator.mediaSession.setActionHandler('play', () => {
              if (playerRef.current && playerRef.current.playVideo) playerRef.current.playVideo();
          });
          navigator.mediaSession.setActionHandler('pause', () => {
              if (playerRef.current && playerRef.current.pauseVideo) playerRef.current.pauseVideo();
          });
          navigator.mediaSession.setActionHandler('previoustrack', playPrev);
          navigator.mediaSession.setActionHandler('nexttrack', playNext);
          navigator.mediaSession.setActionHandler('stop', handleStop);

          return () => {
             navigator.mediaSession.setActionHandler('play', null);
             navigator.mediaSession.setActionHandler('pause', null);
             navigator.mediaSession.setActionHandler('previoustrack', null);
             navigator.mediaSession.setActionHandler('nexttrack', null);
             navigator.mediaSession.setActionHandler('stop', null);
          };
      }
  }, [playPrev, playNext, onClose]);

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
              setNotice(`No songs found for "${q.slice(0, 40)}".`);
          }
      } catch (e) { console.error("Search failed", e); setNotice("Search isn't working right now. Try again in a bit."); } 
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
              setNotice("Couldn't make a playlist. Try searching for a song.");
          }
      } catch (e: any) {
          console.error("Vibe Gen Error:", e?.message || e);
          setNotice(e?.response?.data?.message || "Couldn't make a playlist right now. Try again in a bit.");
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

  const progressNow = isDragging ? dragTime : currentTime;
  const progressFill = { ['--fill' as any]: `${Math.min(100, (progressNow / (duration || 1)) * 100)}%` } as React.CSSProperties;
  const volumeFill = { ['--fill' as any]: `${volume}%` } as React.CSSProperties;
  const handlePlayPause = () => {
      if (!playerRef.current) return;
      // FORCE LOAD if the player is "unstarted"/"cued" (state -1 / 5)
      const state = playerRef.current.getPlayerState ? playerRef.current.getPlayerState() : -1;
      if (isPlaying) {
          playerRef.current.pauseVideo();
      } else if ((state === -1 || state === 5) && queue.length > 0) {
          playerRef.current.loadVideoById(queue[currentIndex].id);
          const savedTime = localStorage.getItem('jam_time');
          if (savedTime) playerRef.current.seekTo(parseFloat(savedTime));
      } else {
          playerRef.current.playVideo();
      }
  };

  return (
    <DraggableWindow
      isOpen={isOpen} onClose={onClose} title="Music · Jam with Aastha"
      initialWidth={380} initialHeight={660} defaultPosition={{ x: 800, y: 150 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
      icon={Icons.music}
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
      <div className="flex flex-col h-full w-full font-sans select-none relative px-3 pb-3 gap-3">

        {/* Hidden Player */}
        <div id="jam-player-frame" className="absolute pointer-events-none opacity-0" />

        {/* --- CURATE SHEET --- */}
        <AnimatePresence>
            {showConfigModal && (
                <motion.div
                    initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
                    transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                    className="absolute inset-x-2 bottom-2 top-0 z-50 rounded-[28px] bg-md-surface-container-high border border-md-outline-variant/30 shadow-2xl flex flex-col p-5"
                    role="dialog" aria-label="Curate your vibe"
                >
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h3 className="text-xl font-serif text-md-on-surface">Curate your vibe</h3>
                        <IconButton label="Close" onClick={() => setShowConfigModal(false)}><X size={20} /></IconButton>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-hide space-y-5">
                        {([
                          { title: 'Languages', items: LANGUAGES, sel: selectedLanguages, set: setSelectedLanguages },
                          { title: 'Vibe', items: MOOD_TAGS, sel: selectedMoods, set: setSelectedMoods },
                          { title: 'Genre', items: GENRES, sel: selectedGenres, set: setSelectedGenres },
                        ] as const).map((g) => (
                          <div key={g.title}>
                            <h4 className="text-sm font-medium text-md-primary mb-2 px-1">{g.title}</h4>
                            <div className="flex flex-wrap gap-2">
                              {g.items.map((it: string) => (
                                <Chip key={it} selected={(g.sel as string[]).includes(it)} onClick={() => toggleSelection(g.sel as any, it, g.set as any)}
                                  icon={(g.sel as string[]).includes(it) ? <Check size={14} /> : undefined}>
                                  {it}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        ))}

                        <div>
                            <h4 className="text-sm font-medium text-md-primary mb-2 px-1">How long</h4>
                            <div className="flex flex-wrap gap-2">
                              {SESSION_LENGTHS.map((m) => (
                                <Chip key={m} selected={targetDuration === m} onClick={() => setTargetDuration(m)}
                                  icon={targetDuration === m ? <Check size={14} /> : undefined}>
                                  {m} min
                                </Chip>
                              ))}
                            </div>
                            <p className="text-[11px] text-md-on-surface-variant mt-2 px-1">About {Math.max(4, Math.round(targetDuration / 3.5))} songs. Turn on Repeat all to keep it going.</p>
                        </div>
                    </div>

                    <div className="pt-4 shrink-0">
                        <Button size="lg" className="w-full" onClick={() => generateVibePlaylist()} icon={<Sparkles size={18} />}>Make my playlist</Button>
                        <p className="text-[11px] text-md-on-surface-variant mt-2 text-center">Aastha blends how you've been feeling with these picks.</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* --- SEARCH --- */}
        <form onSubmit={handleSearch} className="shrink-0 flex gap-2">
            <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-md-on-surface-variant pointer-events-none" />
                <input
                    value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search a song or artist"
                    aria-label="Search songs"
                    className="w-full h-12 rounded-full bg-md-surface-container-highest text-md-on-surface placeholder:text-md-on-surface-variant/70 pl-11 pr-4 text-sm border border-transparent focus:border-md-primary focus:outline-none"
                />
            </div>
            <IconButton variant="tonal" size="md" label="Curate a playlist" onClick={handleGenerateClick} className="!w-12 !h-12">
                {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            </IconButton>
        </form>

        {notice && (
            <div role="status" className="shrink-0 -mt-1 px-4 py-2 rounded-[16px] bg-md-surface-container-highest text-md-on-surface text-xs flex items-center justify-between gap-2">
                <span>{notice}</span>
                <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-md-on-surface-variant"><X size={14} /></button>
            </div>
        )}

        {/* --- STAGE or QUEUE --- */}
        <div className="flex-1 min-h-0 rounded-[28px] bg-md-surface-container overflow-hidden flex flex-col">
          {showQueue ? (
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                   <div className="flex justify-between items-center mb-2 px-1">
                      <h3 className="text-sm font-medium text-md-primary">Up next · {queue.length}</h3>
                      <IconButton size="sm" label="Back to player" onClick={() => setShowQueue(false)}><X size={16}/></IconButton>
                   </div>
                   {queue.length === 0 ? (
                       <div className="text-md-on-surface-variant text-center py-10 text-sm">Nothing queued yet, search or tap ✨.</div>
                   ) : isMobile ? (
                       <Reorder.Group axis="y" values={queue} onReorder={handleReorder} className="space-y-2">
                           {queue.map((track, idx) => (
                               <MobileQueueItem key={track.uuid} track={track} index={idx} isActive={currentIndex === idx}
                                  onPlay={() => { setCurrentIndex(idx); loadAndPlay(track); }} onRemove={() => removeFromQueue(idx)} />
                           ))}
                       </Reorder.Group>
                   ) : (
                       <div className="space-y-2">
                           {queue.map((track, idx) => (
                               <DesktopQueueItem key={track.uuid} track={track} index={idx} isActive={currentIndex === idx}
                                  onPlay={() => { setCurrentIndex(idx); loadAndPlay(track); }}
                                  onMoveUp={() => moveTrack(idx, 'up')} onMoveDown={() => moveTrack(idx, 'down')}
                                  onRemove={() => removeFromQueue(idx)} isFirst={idx === 0} isLast={idx === queue.length - 1} />
                           ))}
                       </div>
                   )}
              </div>
          ) : (
              <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
                  {/* Artwork */}
                  <div className="flex-1 min-h-0 flex items-center justify-center">
                      <motion.div
                          className="h-full max-h-60 aspect-square rounded-[28px] overflow-hidden relative bg-md-surface-container-highest shadow-lg"
                          animate={{ scale: isPlaying ? 1 : 0.94 }}
                          transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
                      >
                          {currentTrackData?.thumbnail ? (
                              <img src={currentTrackData.thumbnail} className="w-full h-full object-cover" alt="" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center bg-md-primary-container text-md-on-primary-container">
                                  <Disc size={56} className="opacity-60" />
                              </div>
                          )}
                      </motion.div>
                  </div>

                  {/* Track info */}
                  <div className="shrink-0 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                          <h3 className="text-md-on-surface font-semibold text-lg truncate">{currentTrackData?.title || 'Ready to jam'}</h3>
                          <p className="text-md-on-surface-variant text-sm truncate">{currentTrackData?.artist || 'Search a song or ask Aastha'}</p>
                      </div>
                      {loopMode === 'custom' && (
                          <span className="shrink-0 h-7 px-2.5 rounded-full bg-md-secondary-container text-md-on-secondary-container text-[11px] font-medium inline-flex items-center">Loop {currentLoopCount}/{loopTarget}</span>
                      )}
                  </div>

                  {/* Progress (scrub) */}
                  <div className="shrink-0">
                      <input
                          type="range" min="0" max={duration || 100}
                          value={progressNow}
                          aria-label="Seek"
                          onMouseDown={() => setIsDragging(true)}
                          onTouchStart={() => setIsDragging(true)}
                          onChange={(e) => setDragTime(parseFloat(e.target.value))}
                          onMouseUp={(e) => { setIsDragging(false); if (playerRef.current) playerRef.current.seekTo(parseFloat(e.currentTarget.value)); }}
                          onTouchEnd={() => { setIsDragging(false); if (playerRef.current) playerRef.current.seekTo(dragTime); }}
                          className="m3-slider"
                          style={progressFill}
                      />
                      <div className="flex justify-between text-[11px] text-md-on-surface-variant tabular-nums -mt-1">
                          <span>{formatTime(progressNow)}</span>
                          <span>{formatTime(duration)}</span>
                      </div>
                  </div>
              </div>
          )}
        </div>

        {/* --- TRANSPORT (Liquid Glass control bar) --- */}
        <div className="shrink-0 glass rounded-[28px] px-3 py-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                    <button
                        onClick={toggleLoopMode}
                        aria-label={REPEAT_LABEL[loopMode]}
                        title={REPEAT_LABEL[loopMode]}
                        className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${loopMode !== 'off' ? 'bg-md-secondary-container text-md-on-secondary-container' : 'text-md-on-surface-variant hover:bg-md-on-surface/10'}`}
                    >
                        <Repeat size={18} />
                        {loopMode === 'one' && <span className="absolute bottom-1.5 right-1.5 text-[9px] font-bold">1</span>}
                        {loopMode === 'custom' && <span className="absolute bottom-1 right-1 text-[9px] font-bold">{loopTarget}×</span>}
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    <IconButton label="Previous" onClick={playPrev}><SkipBack size={22} /></IconButton>
                    <button
                        onClick={handlePlayPause}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        className="w-14 h-14 rounded-[20px] bg-md-primary text-md-on-primary flex items-center justify-center active:scale-95 transition-transform shadow-md"
                    >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-0.5" />}
                    </button>
                    <IconButton label="Next" onClick={playNext}><SkipForward size={22} /></IconButton>
                </div>

                <button
                    onClick={() => setShowQueue(!showQueue)}
                    aria-label="Queue"
                    aria-pressed={showQueue}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${showQueue ? 'bg-md-secondary-container text-md-on-secondary-container' : 'text-md-on-surface-variant hover:bg-md-on-surface/10'}`}
                >
                    <ListMusic size={20} />
                    {!showQueue && queue.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-md-primary text-md-on-primary text-[10px] font-semibold flex items-center justify-center">{queue.length}</span>}
                </button>
            </div>
            {loopMode === 'custom' && (
                <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-xs text-md-on-surface-variant">Play this song</span>
                    <Stepper value={loopTarget} onChange={setLoopTarget} min={2} max={20} step={1} compact label="times" format={(v) => `${v}×`} />
                </div>
            )}
            <div className="flex items-center gap-2 px-1">
                <button onClick={() => setVolume(volume === 0 ? 60 : 0)} aria-label={volume === 0 ? 'Unmute' : 'Mute'} className="text-md-on-surface-variant shrink-0">
                    {volume === 0 ? <VolumeX size={16} /> : volume < 50 ? <Volume1 size={16} /> : <Volume2 size={16} />}
                </button>
                <input type="range" min="0" max="100" value={volume} aria-label="Volume"
                    onChange={(e) => setVolume(parseInt(e.target.value))} className="m3-slider flex-1" style={volumeFill} />
            </div>
        </div>
      </div>
    </DraggableWindow>
  );
};
