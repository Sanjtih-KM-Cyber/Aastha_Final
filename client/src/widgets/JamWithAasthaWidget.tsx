
import React, { useState, useRef, useEffect } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { Play, Pause, SkipForward, Repeat, Search, Disc } from 'lucide-react';
import { motion } from 'framer-motion';
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

const MOOD_PLAYLISTS: Record<string, { id: string; title: string; artist: string; thumbnail?: string }[]> = {
  default: [{ id: 'jfKfPfyJRdk', title: 'Lofi Beats', artist: 'Lofi Girl' }]
};

export const JamWithAasthaWidget: React.FC<JamWidgetProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const [moodInput, setMoodInput] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(MOOD_PLAYLISTS.default[0]);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const playerRef = useRef<any>(null);
  const progressInterval = useRef<ReturnType<typeof setTimeout> | null>(null);

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
           if (window.YT && window.YT.Player) {
               clearInterval(checkYT);
               if (!playerRef.current) loadPlayer(currentTrack.id);
           }
       }, 500);
       return () => clearInterval(checkYT);
    }
  }, [isOpen]);

  const loadPlayer = (videoId: string) => {
    if (!document.getElementById('yt-player-frame')) return;
    try {
        playerRef.current = new window.YT.Player('yt-player-frame', {
        height: '0', width: '0', videoId: videoId,
        playerVars: { 'playsinline': 1, 'controls': 0, 'disablekb': 1, 'fs': 0, 'iv_load_policy': 3, 'origin': window.location.origin },
        events: {
            'onReady': (e: any) => { setDuration(e.target.getDuration()); e.target.playVideo(); setIsPlaying(true); startProgressLoop(); },
            'onStateChange': (e: any) => {
                if (e.data === 1) { setIsPlaying(true); setDuration(playerRef.current.getDuration()); startProgressLoop(); }
                if (e.data === 2) { setIsPlaying(false); stopProgressLoop(); }
            }
        }
        });
    } catch(e) { console.error(e); }
  };

  const startProgressLoop = () => {
    if (progressInterval.current) clearInterval(progressInterval.current);
    progressInterval.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime) setCurrentTime(playerRef.current.getCurrentTime());
    }, 1000);
  };

  const stopProgressLoop = () => { if (progressInterval.current) clearInterval(progressInterval.current); };

  const handleMoodSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!moodInput.trim()) return;
    setIsSearching(true);
    try {
        const res = await api.get(`/data/videos/search?q=${encodeURIComponent(moodInput)}`);
        const tracks = res.data;
        if (tracks?.length > 0) playTrack(tracks[0]);
    } catch (e) { console.warn(e); } 
    finally { setIsSearching(false); }
  };

  const playTrack = (track: any) => {
      setCurrentTrack(track);
      if (playerRef.current?.loadVideoById) playerRef.current.loadVideoById(track.id);
  };

  const togglePlay = () => {
      if (!playerRef.current) return;
      if (isPlaying) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
  };

  const formatTime = (s: number) => {
      const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
      return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Jam"
      initialWidth={320} initialHeight={500} defaultPosition={{ x: 800, y: 150 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
    >
      <div className="flex flex-col h-full w-full">
        <div id="yt-player-frame" className="absolute pointer-events-none opacity-0" />
        
        {/* TOP: Album Art & Info */}
        <div className="h-[60%] bg-gradient-to-br from-[#1e1b4b] via-[#312e81] to-[#3730a3] p-8 flex flex-col items-center justify-center relative">
             <div className="w-48 h-48 rounded-2xl shadow-2xl bg-black/30 flex items-center justify-center overflow-hidden mb-6 border border-white/10 relative">
                 {currentTrack.thumbnail ? (
                     <img src={currentTrack.thumbnail} className="absolute inset-0 w-full h-full object-cover" alt="Art" />
                 ) : (
                     <Disc size={48} className="text-white/20" />
                 )}
                 {isPlaying && (
                     <div className="absolute inset-0 bg-black/20 flex items-center justify-center gap-1">
                         <motion.div animate={{ height: [10, 30, 10] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-white rounded-full" />
                         <motion.div animate={{ height: [15, 40, 15] }} transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }} className="w-1 bg-white rounded-full" />
                         <motion.div animate={{ height: [10, 25, 10] }} transition={{ repeat: Infinity, duration: 0.7, delay: 0.2 }} className="w-1 bg-white rounded-full" />
                     </div>
                 )}
             </div>
             
             <div className="text-center w-full">
                 <div className="inline-block px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-[9px] text-white/80 uppercase tracking-wider mb-2">
                     Now Playing
                 </div>
                 <h2 className="font-serif text-2xl text-white truncate px-4">{currentTrack.title}</h2>
                 <p className="text-white/50 text-sm font-sans truncate">{currentTrack.artist}</p>
             </div>
        </div>

        {/* BOTTOM: Search & Controls */}
        <div className="h-[40%] bg-[#18181b] p-6 flex flex-col justify-between">
             <form onSubmit={handleMoodSubmit} className="relative mb-2">
                 <input 
                    value={moodInput} onChange={e => setMoodInput(e.target.value)}
                    placeholder="Search vibe..." 
                    className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs text-white focus:outline-none focus:border-white/20"
                 />
                 <button type="submit" className="absolute right-3 top-2 text-white/30 hover:text-white">
                     {isSearching ? <span className="animate-spin block">⟳</span> : <Search size={14} />}
                 </button>
             </form>

             <div>
                 {/* Scrubber */}
                 <div className="flex justify-between text-[10px] text-white/30 mb-1 font-mono">
                     <span>{formatTime(currentTime)}</span>
                     <span>{formatTime(duration)}</span>
                 </div>
                 <div className="h-1 bg-white/10 rounded-full w-full overflow-hidden mb-6">
                     <motion.div 
                        className="h-full bg-white" 
                        style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
                     />
                 </div>

                 {/* Controls */}
                 <div className="flex justify-center items-center gap-6">
                     <button className="text-white/30 hover:text-white transition-colors"><Repeat size={18} /></button>
                     <button 
                        onClick={togglePlay}
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/5"
                     >
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                     </button>
                     <button className="text-white/30 hover:text-white transition-colors"><SkipForward size={18} /></button>
                 </div>
             </div>
        </div>
      </div>
    </DraggableWindow>
  );
};
