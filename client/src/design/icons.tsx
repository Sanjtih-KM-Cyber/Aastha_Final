/**
 * Aastha icon set, Phosphor "duotone" icons (friendlier and more expressive than plain line icons),
 * with a coloured tonal tile per tool. Tiles use Material You containers, so they follow the user's seed colour.
 * Import tool icons from here (not lucide) for navigation, tabs, window title bars and settings.
 */
import React from 'react';
import {
  BookOpenText, Smiley, Graph, Wind, MusicNotes, Waves, Timer, GearSix, ChatCircleDots, FlowerLotus,
  UserCircle, Palette, Microphone, HandHeart, ShieldCheck, Crown, Database, SignOut, Fire,
} from '@phosphor-icons/react';

type P = { size?: number; className?: string };
const duo = (Comp: React.ComponentType<any>) => {
  const C: React.FC<P> = ({ size = 20, className }) => <Comp size={size} weight="duotone" className={className} />;
  C.displayName = `Duo${(Comp as any).displayName || 'Icon'}`;
  return C;
};

export const Icons = {
  diary: duo(BookOpenText),
  mood: duo(Smiley),
  web: duo(Graph),
  breathing: duo(Wind),
  music: duo(MusicNotes),
  sounds: duo(Waves),
  focus: duo(Timer),
  settings: duo(GearSix),
  chat: duo(ChatCircleDots),
  relax: duo(FlowerLotus),
  me: duo(UserCircle),
  appearance: duo(Palette),
  voice: duo(Microphone),
  connection: duo(HandHeart),
  security: duo(ShieldCheck),
  plan: duo(Crown),
  data: duo(Database),
  logout: duo(SignOut),
  streak: duo(Fire),
};

/** Tool → tonal family (rotates primary / secondary / tertiary so the list feels alive but harmonious). */
export type Tone = 'primary' | 'secondary' | 'tertiary';
export const TOOL_TONE: Record<string, Tone> = {
  diary: 'tertiary', mood: 'primary', lore: 'secondary', web: 'secondary', breathing: 'tertiary',
  jam: 'primary', music: 'primary', soundscape: 'secondary', sounds: 'secondary', pomodoro: 'tertiary', focus: 'tertiary', settings: 'secondary',
};

const TONE_CLASS: Record<Tone, { soft: string; solid: string }> = {
  primary: { soft: 'bg-md-primary-container text-md-on-primary-container', solid: 'bg-md-primary text-md-on-primary' },
  secondary: { soft: 'bg-md-secondary-container text-md-on-secondary-container', solid: 'bg-md-secondary text-md-on-secondary' },
  tertiary: { soft: 'bg-md-tertiary-container text-md-on-tertiary-container', solid: 'bg-md-tertiary text-md-on-tertiary' },
};

/** Rounded-square tile holding a tool icon (M3 Expressive "icon container"). */
export const IconTile: React.FC<{ icon: React.FC<P>; tone?: Tone; active?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ icon: I, tone = 'primary', active, size = 'md', className = '' }) => {
  const dim = size === 'sm' ? 'w-8 h-8 rounded-[10px]' : size === 'lg' ? 'w-24 h-24 rounded-[32px]' : 'w-10 h-10 rounded-[14px]';
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 48 : 22;
  return (
    <span className={`shrink-0 inline-flex items-center justify-center transition-colors duration-200 ${dim} ${active ? TONE_CLASS[tone].solid : TONE_CLASS[tone].soft} ${className}`}>
      <I size={iconSize} />
    </span>
  );
};
