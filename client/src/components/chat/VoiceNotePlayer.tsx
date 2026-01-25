import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Loader2 } from 'lucide-react';

interface VoiceNotePlayerProps {
    src: string;
    accentColor?: string;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ src, accentColor = '#ffffff' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isReady, setIsReady] = useState(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!containerRef.current || !src) return;

        // Initialize WaveSurfer
        wavesurfer.current = WaveSurfer.create({
            container: containerRef.current,
            waveColor: 'rgba(255, 255, 255, 0.3)',
            progressColor: accentColor,
            cursorColor: 'transparent',
            barWidth: 3,
            barGap: 2,
            barRadius: 3,
            height: 40,
            normalize: true,
            minPxPerSec: 1, // Fit to container
            fillParent: true,
            url: src,
        });

        // Event Listeners
        wavesurfer.current.on('ready', (d) => {
            setIsReady(true);
            setDuration(d);
        });

        wavesurfer.current.on('play', () => setIsPlaying(true));
        wavesurfer.current.on('pause', () => setIsPlaying(false));

        wavesurfer.current.on('timeupdate', (time) => {
            setCurrentTime(time);
        });

        wavesurfer.current.on('finish', () => {
            setIsPlaying(false);
        });

        return () => {
            if (wavesurfer.current) {
                wavesurfer.current.destroy();
            }
        };
    }, [src, accentColor]);

    const togglePlay = () => {
        if (wavesurfer.current) {
            wavesurfer.current.playPause();
        }
    };

    return (
        <div className="flex items-center gap-3 w-full bg-black/20 backdrop-blur-md rounded-2xl p-3 pr-4 border border-white/10 min-w-[200px]">
            <button
                onClick={togglePlay}
                disabled={!isReady}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
                {!isReady ? (
                    <Loader2 size={18} className="animate-spin text-white/50" />
                ) : isPlaying ? (
                    <Pause size={18} fill="currentColor" />
                ) : (
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                )}
            </button>

            <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                <div ref={containerRef} className="w-full" />
                <div className="flex justify-between text-[10px] text-white/50 font-medium px-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
};
