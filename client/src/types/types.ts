import { ReactNode } from 'react';

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

export interface VibeState {
  emoji: string;
  color: string;
  label: string;
  track: string;
  artist: string;
}

export enum SectionVibe {
  SAD = 'sad',
  ANGRY = 'angry',
  BORED = 'bored',
  NEUTRAL = 'neutral'
}