import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface VoiceNotePlayerProps {
    src: string;
    accentColor?: string;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ src, accentColor = '#ffffff' }) => {
    const { isLowPowerMode } = useTheme(); // CONSUME LITE MODE
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurfer = useRef<WaveSurfer | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isReady, setIsReady] = useState(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // --- HIGH QUALITY MODE: WAVESURFER ---
    useEffect(() => {
        if (isLowPowerMode) return; // Skip if Lite Mode

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
                wavesurfer.current = null;
            }
        };
    }, [src, accentColor, isLowPowerMode]);

    // --- LITE MODE: NATIVE AUDIO ---
    useEffect(() => {
        if (!isLowPowerMode) return; // Skip if High Quality

        // Reset state for Lite Mode transition
        setIsReady(true); // Native audio is "ready" to stream immediately usually
        setDuration(0);
        setCurrentTime(0);

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = src;
            audioRef.current.load();
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, [src, isLowPowerMode]);

    const togglePlay = () => {
        if (isLowPowerMode) {
            // LITE MODE Logic
            if (audioRef.current) {
                if (isPlaying) {
                    audioRef.current.pause();
                } else {
                    audioRef.current.play().catch(e => console.error("Audio Play Error:", e));
                }
            }
        } else {
            // HIGH QUALITY Logic
            if (wavesurfer.current) {
                wavesurfer.current.playPause();
            }
        }
    };

    const handleNativeTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            // Ensure duration is set once metadata loads
            if (duration === 0 && audioRef.current.duration !== Infinity) {
                setDuration(audioRef.current.duration || 0);
            }
        }
    };

    const handleNativeLoadedMetadata = () => {
        if (audioRef.current) {
             setDuration(audioRef.current.duration);
        }
    };

    return (
        <div className={`flex items-center gap-3 w-full bg-black/20 backdrop-blur-md rounded-2xl p-3 pr-4 border border-white/10 min-w-[200px] ${isLowPowerMode ? 'backdrop-blur-none bg-black/40' : ''}`}>
            <button
                onClick={togglePlay}
                disabled={!isReady && !isLowPowerMode} // Lite mode is always "ready" to try
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
                {(!isReady && !isLowPowerMode) ? (
                    <Loader2 size={18} className="animate-spin text-white/50" />
                ) : isPlaying ? (
                    <Pause size={18} fill="currentColor" />
                ) : (
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                )}
            </button>

            <div className="flex-1 flex flex-col justify-center gap-1 min-w-0">
                {isLowPowerMode ? (
                    /* LITE MODE: Simple CSS Progress Bar (No Waveform) */
                    <div className="w-full h-[40px] flex items-center">
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                            <div
                                className="h-full absolute left-0 top-0 transition-all duration-200 ease-linear"
                                style={{
                                    width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                                    backgroundColor: accentColor
                                }}
                            />
                        </div>
                        {/* Hidden Audio Element for Logic */}
                        <audio
                            ref={audioRef}
                            src={src}
                            onTimeUpdate={handleNativeTimeUpdate}
                            onLoadedMetadata={handleNativeLoadedMetadata}
                            onPlay={() => setIsPlaying(true)}
                            onPause={() => setIsPlaying(false)}
                            onEnded={() => setIsPlaying(false)}
                        />
                    </div>
                ) : (
                    /* HIGH QUALITY MODE: Wavesurfer Container */
                    <div ref={containerRef} className="w-full" />
                )}

                <div className="flex justify-between text-[10px] text-white/50 font-medium px-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration || 0)}</span>
                </div>
            </div>
        </div>
    );
};
