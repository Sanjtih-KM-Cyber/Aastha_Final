import React, { useState, useRef, useEffect } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { 
  Play, Pause, SkipForward, SkipBack, Repeat, Search, 
  Disc, Sparkles, Plus, ListMusic, Lock, X, Music2, Globe, Check, Settings,
  ArrowUp, ArrowDown, Trash2, Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

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
}

interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string;
}

type LoopMode = 'off' | 'all' | 'one' | 'custom';

const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Punjabi", "Malayalam", "Kannada", "Bengali", "Marathi"];
const MOOD_TAGS = ["Happy", "Sad", "Calm", "Energetic", "Romantic", "Focus", "Melancholy", "Party", "Lo-Fi"];

// --- Reusable Stepper Component ---
interface StepperProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    max?: number;
    step?: number;
}

const Stepper: React.FC<StepperProps> = ({ value, onChange, min = 0, max = 100, step = 1 }) => {
    const handleDecrement = () => {
        if (value - step >= min) onChange(value - step);
    };

    const handleIncrement = () => {
        if (value + step <= max) onChange(value + step);
    };

    return (
        <div className="flex items-center bg-[#1F2937] rounded-lg border border-white/10 h-10 w-[120px] justify-between px-1">
            <button
                onClick={handleDecrement}
                disabled={value <= min}
                className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors"
            >
                <Minus size={14} />
            </button>

            <span className="text-sm font-medium text-white font-mono min-w-[20px] text-center">
                {value}
            </span>

            <button
                onClick={handleIncrement}
                disabled={value >= max}
                className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 transition-colors"
            >
                <Plus size={14} />
            </button>
        </div>
    );
};

export const JamWithAasthaWidget: React.FC<JamWidgetProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const { currentTheme } = useTheme();
  
  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Search & Input State
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // Generator State (Multi-Select)
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [targetDuration, setTargetDuration] = useState<number>(30); // minutes
  
  // Loop Engine State
  const [loopMode, setLoopMode] = useState<LoopMode>('off');
  const [loopTarget, setLoopTarget] = useState(2);
  const [currentLoopCount, setCurrentLoopCount] = useState(1);
  
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (isOpen) {
       const checkYT = setInterval(() => {
           if (window.YT && window.YT.Player && !playerRef.current) {
               clearInterval(checkYT);
               initPlayer();
           }
       }, 500);
       return () => clearInterval(checkYT);
    }
  }, [isOpen]);

  const initPlayer = () => {
    if (playerRef.current) return;
    playerRef.current = new window.YT.Player('jam-player-frame', {
        height: '0', width: '0',
        playerVars: { 'playsinline': 1, 'controls': 0, 'disablekb': 1, 'fs': 0, 'iv_load_policy': 3 },
        events: {
            'onStateChange': onPlayerStateChange
        }
    });
  };

  // --- Custom Loop Logic ---
  const onPlayerStateChange = (event: any) => {
    if (event.data === 1) { // Playing
      setIsPlaying(true);
      setDuration(playerRef.current.getDuration());
      startProgressLoop();
    } else if (event.data === 2) { // Paused
      setIsPlaying(false);
      stopProgressLoop();
    } else if (event.data === 0) { // Ended
      handleTrackEnd();
    }
  };

  const handleTrackEnd = () => {
      if (loopMode === 'one') {
          playerRef.current.seekTo(0);
          playerRef.current.playVideo();
      } else if (loopMode === 'custom') {
          if (currentLoopCount < loopTarget) {
              setCurrentLoopCount(prev => prev + 1);
              playerRef.current.seekTo(0);
              playerRef.current.playVideo();
          } else {
              setCurrentLoopCount(1); 
              playNext();
          }
      } else if (loopMode === 'all') {
          playNext();
      } else {
          if (currentIndex < queue.length - 1) playNext();
          else setIsPlaying(false);
      }
  };

  const loadAndPlay = (track: Track) => {
      if (playerRef.current && playerRef.current.loadVideoById) {
          playerRef.current.loadVideoById(track.id);
          setIsPlaying(true);
      }
  };

  const playNext = () => {
      if (queue.length === 0) return;
      const nextIndex = (currentIndex + 1) % queue.length;
      setCurrentIndex(nextIndex);
      loadAndPlay(queue[nextIndex]);
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

  const handleSearch = async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!query.trim()) return;
      setIsSearching(true);
      try {
          const res = await api.get(`/data/videos/search?q=${encodeURIComponent(query)}`);
          if (res.data && res.data.length > 0) {
              const newTrack = res.data[0];

              setQueue(prev => {
                // If queue is empty, play immediately
                if (prev.length === 0) {
                    setTimeout(() => loadAndPlay(newTrack), 100);
                    return [newTrack];
                }
                // Otherwise append
                return [...prev, newTrack];
              });

              if (queue.length === 0) {
                  setCurrentIndex(0);
              }
          }
      } catch (e) { console.error("Search failed", e); } 
      finally { setIsSearching(false); setQuery(''); }
  };

  const removeFromQueue = (index: number) => {
      setQueue(prev => {
          const newQueue = [...prev];
          newQueue.splice(index, 1);
          return newQueue;
      });
      // Adjust current index if needed
      if (index < currentIndex) {
          setCurrentIndex(prev => prev - 1);
      } else if (index === currentIndex) {
          // If we removed current track, stop or play next?
          // Simple logic: if queue empty, stop. Else load new current.
          if (queue.length <= 1) {
             setIsPlaying(false);
             setCurrentIndex(0);
          } else {
             // Try to stay on index or go to next available
             const nextIdx = index >= queue.length - 1 ? 0 : index;
             setCurrentIndex(nextIdx);
             // We might need to reload player if active track removed
             // But for now let's keep it simple (user might need to click play)
          }
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

  const generateVibePlaylist = async () => {
      setShowConfigModal(false);
      setIsSearching(true);
      
      const langsToSend = selectedLanguages.length > 0 ? selectedLanguages : ["English"];
      
      try {
          const res = await api.post('/ai/generate-vibe', { 
              languages: langsToSend,
              moods: selectedMoods,
              duration: targetDuration // Send duration to backend (even if backend logic for duration isn't fully complex yet)
          });
          const tracks = res.data;
          
          if (tracks && tracks.length > 0) {
              setQueue(tracks);
              setCurrentIndex(0);
              loadAndPlay(tracks[0]);
              setCurrentLoopCount(1);
          } else {
              alert("Could not generate a vibe. Try manual search.");
          }
      } catch (e) {
          console.error("Vibe Gen Error:", e);
          alert("Failed to generate vibe.");
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

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Jam with Aastha"
      initialWidth={360} initialHeight={620} defaultPosition={{ x: 800, y: 150 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
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
                                onClick={generateVibePlaylist}
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
            <div className="w-full relative z-20 mb-6">
                <form onSubmit={handleSearch} className="relative flex gap-2">
                    <div className="relative flex-1">
                        <input 
                            value={query} onChange={e => setQuery(e.target.value)}
                            placeholder="Search song..." 
                            className="w-full bg-black/30 backdrop-blur-md border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-all pr-8"
                        />
                        <Search size={14} className="absolute right-3 top-3 text-white/30" />
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

            {/* Vinyl Centerpiece */}
            <div className="relative flex-1 flex items-center justify-center w-full">
                {isPlaying && (
                    <motion.div 
                        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="absolute w-48 h-48 rounded-full blur-3xl"
                        style={{ backgroundColor: currentTheme.primaryColor }}
                    />
                )}

                <motion.div
                    animate={{ rotate: isPlaying ? 360 : 0 }}
                    transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                    className="w-56 h-56 rounded-full bg-black border-[6px] border-[#1a1a1a] shadow-2xl flex items-center justify-center relative overflow-hidden"
                >
                    <div className="absolute inset-0 rounded-full border-[20px] border-transparent border-t-white/5 border-b-white/5 opacity-20 pointer-events-none" />
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[#121212] relative z-10">
                        {currentTrackData?.thumbnail ? (
                            <img src={currentTrackData.thumbnail} className="w-full h-full object-cover" alt="Art" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                <Disc size={32} className="text-white/20" />
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
                         <div className="space-y-2">
                             {queue.map((track, idx) => (
                                 <div key={`${track.id}-${idx}`} className={`group flex items-center gap-3 p-2 rounded-lg transition-colors ${currentIndex === idx ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                                     {currentIndex === idx && isPlaying ? (
                                         <div className="w-1 h-8 bg-teal-400 rounded-full animate-pulse shrink-0"/>
                                     ) : (
                                         <span className="w-4 text-[10px] text-white/30 text-center shrink-0">{idx + 1}</span>
                                     )}
                                     <div className="flex-1 min-w-0" onClick={() => { setCurrentIndex(idx); loadAndPlay(track); }}>
                                         <div className={`text-xs truncate font-medium ${currentIndex === idx ? 'text-white' : 'text-white/70'}`}>{track.title}</div>
                                         <div className="text-[10px] truncate text-white/40">{track.artist}</div>
                                     </div>
                                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button onClick={() => moveTrack(idx, 'up')} disabled={idx === 0} className="p-1 text-white/30 hover:text-white disabled:opacity-0"><ArrowUp size={12}/></button>
                                         <button onClick={() => moveTrack(idx, 'down')} disabled={idx === queue.length - 1} className="p-1 text-white/30 hover:text-white disabled:opacity-0"><ArrowDown size={12}/></button>
                                         <button onClick={() => removeFromQueue(idx)} className="p-1 text-white/30 hover:text-red-400"><Trash2 size={12}/></button>
                                     </div>
                                 </div>
                             ))}
                         </div>
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

                    {/* Progress Bar */}
                    <div className="mb-6 group">
                        <div className="flex justify-between text-[10px] text-white/30 mb-1 font-mono group-hover:text-white/50 transition-colors">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full w-full overflow-hidden relative">
                            <motion.div
                                className="h-full rounded-full"
                                style={{ width: `${(currentTime / (duration || 1)) * 100}%`, backgroundColor: currentTheme.primaryColor }}
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
                             />
                         </div>
                    )}
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-4">
                    <button onClick={playPrev} className="text-white/40 hover:text-white transition-colors">
                        <SkipBack size={24} />
                    </button>
                    <button 
                        onClick={() => {
                            if (!playerRef.current) return;
                            if (isPlaying) playerRef.current.pauseVideo();
                            else playerRef.current.playVideo();
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