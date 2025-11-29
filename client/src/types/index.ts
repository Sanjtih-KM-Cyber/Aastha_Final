import { ReactNode } from 'react';

export interface User {
  _id: string;
  name: string;
  email: string;
  username?: string;
  avatarTheme: string;
  avatar?: string; 
  wallpaper?: string; 
  hasDiarySetup: boolean;
  credits: number;
  isPro?: boolean;
  streak?: number; // NEW
  securityQuestions?: { question: string }[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  encryptionKey: string | null; 
}

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