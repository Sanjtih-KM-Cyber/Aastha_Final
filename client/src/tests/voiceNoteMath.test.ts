import { describe, it, expect } from 'vitest';
import { formatTime, seekTimeFromX, stepTime, progressOf } from '../utils/voiceNoteMath';
import { formatClock, pickRecorderMime } from '../hooks/useVoiceRecorder';

describe('voice-note player maths', () => {
  it('formats m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65.9)).toBe('1:05');
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatClock(119.6)).toBe('1:59');
  });
  it('maps a tap on the waveform to a time, clamped', () => {
    expect(seekTimeFromX(150, 100, 200, 40)).toBe(10);
    expect(seekTimeFromX(50, 100, 200, 40)).toBe(0);
    expect(seekTimeFromX(999, 100, 200, 40)).toBe(40);
    expect(seekTimeFromX(150, 100, 0, 40)).toBe(0);         // not laid out yet
    expect(seekTimeFromX(150, 100, 200, Infinity)).toBe(0); // webm with unknown duration
  });
  it('arrow keys step 5 s, clamped', () => {
    expect(stepTime(3, 30, -1)).toBe(0);
    expect(stepTime(28, 30, 1)).toBe(30);
    expect(stepTime(10, 30, 1)).toBe(15);
  });
  it('progress is 0…1', () => {
    expect(progressOf(5, 10)).toBe(0.5);
    expect(progressOf(15, 10)).toBe(1);
    expect(progressOf(5, 0)).toBe(0);
  });
  it('picks a recorder format the device supports (Android → webm, iPhone → mp4)', () => {
    expect(pickRecorderMime((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMime((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecorderMime(() => false)).toBe('');
  });
});
