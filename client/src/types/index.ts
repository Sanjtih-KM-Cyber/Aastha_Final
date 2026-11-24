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
  quotaResetsAt?: string | null; // rolling 24 h window: when the free messages refill (null = full)
  isPro?: boolean;
  subscriptionExpiresAt?: string;
  voicePassExpiresAt?: string;
  streak?: number; // NEW
  securityQuestions?: { question: string }[];
  persona?: 'aastha' | 'aarav'; // NEW
  encryptionSalt?: string; // NEW: For secure key derivation (replaces email for new users)
  isOnboardingComplete?: boolean;
  // Returned by the API on login/getMe (Q10: were used without being typed)
  masterKey?: string;          // diary key material ("The Fortress")
  nameEncrypted?: string;
  emailEncrypted?: string;
  isDataDonationOn?: boolean;
  thinkingMode?: boolean;
  gifsEnabled?: boolean;
  nickname?: { value: string; by: string; off: boolean } | null; // Bestie nickname (Settings → Connection)
  safetyIntroSeen?: boolean;   // "How Aastha keeps you safe" card (7.5)
  windowControls?: 'mac' | 'windows'; // widget window buttons (synced across devices)
  privateNotifications?: boolean; // hide notification text on the lock screen / in web push
  themeColor?: string | null; // Sanctuary colour: preset id or #rrggbb (synced)
  appFont?: string;     // Sanctuary text font id (design/fonts.ts)
  headingFont?: string; // Sanctuary heading font id
  legalConsentCurrent?: boolean; // accepted the current Terms + Privacy Policy (server/src/legal.ts)
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

export type LoopMode = 'off' | 'all' | 'one' | 'custom';
