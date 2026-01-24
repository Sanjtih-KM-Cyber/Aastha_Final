import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface VoiceNotePlayerProps {
  src: string;
  className?: string;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ src, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');
  const { currentTheme } = useTheme();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(255, 255, 255, 0.3)',
      progressColor: currentTheme.primaryColor, // Use theme color
      cursorColor: 'rgba(255, 255, 255, 0.5)',
      barWidth: 2,
      barGap: 3,
      barRadius: 3,
      height: 40,
      normalize: true,
      url: src,
      fetchParams: {
        credentials: 'include',
      },
    });

    wavesurfer.on('ready', () => {
      setIsReady(true);
      setDuration(formatTime(wavesurfer.getDuration()));
    });

    wavesurfer.on('audioprocess', (time) => {
      setCurrentTime(formatTime(time));
    });

    wavesurfer.on('finish', () => {
      setIsPlaying(false);
      wavesurfer.seekTo(0); // Reset to start
    });

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));

    waveSurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [src, currentTheme]);

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent bubble click
    if (waveSurferRef.current) {
      waveSurferRef.current.playPause();
    }
  };

  return (
    <div className={`flex items-center gap-3 w-full max-w-[280px] bg-black/20 backdrop-blur-md rounded-2xl p-2 pr-4 border border-white/10 ${className}`}>
      <button
        onClick={togglePlayPause}
        disabled={!isReady}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0 disabled:opacity-50 disabled:cursor-wait"
      >
        {!isReady ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isPlaying ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Waveform Container */}
        <div ref={containerRef} className="w-full" />

        {/* Time Labels */}
        <div className="flex justify-between text-[10px] text-white/40 font-medium mt-1 px-0.5">
           <span>{currentTime}</span>
           <span>{duration}</span>
        </div>
      </div>
    </div>
  );
};
