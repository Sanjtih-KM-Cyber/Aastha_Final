import React, { useRef, useEffect, useState, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Book, 
  Music, 
  Wind, 
  Clock, 
  Smile, 
  Sliders, 
  Network, // Replaces BookOpen (Lore)
  Settings, 
  Sparkles, 
  Flame,
  ChevronsLeft,
  ChevronsRight,
  X,
  Ghost
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { Icons, IconTile, TOOL_TONE } from '../../design/icons';

interface WellnessHubProps {
  onToggleWidget: (widget: string) => void;
  activeWidgets: Record<string, boolean>;
  onOpenSettings: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const WIDGETS = [
  { id: 'diary', label: 'Diary', icon: Icons.diary, desc: 'Reflect on your day' },
  { id: 'mood', label: 'Mood', icon: Icons.mood, desc: 'Track how you feel' },
  { id: 'lore', label: 'The Web', icon: Icons.web, desc: 'The people in your life' },
  { id: 'breathing', label: 'Breathing', icon: Icons.breathing, desc: 'Calm your mind' },
  { id: 'jam', label: 'Music', icon: Icons.music, desc: 'Listen together' },
  { id: 'soundscape', label: 'Sounds', icon: Icons.sounds, desc: 'Ambient mixes' },
  { id: 'pomodoro', label: 'Focus', icon: Icons.focus, desc: 'Deep work timer' },
  { id: 'settings', label: 'Settings', icon: Icons.settings, desc: 'Make Aastha yours' },
];

export const WellnessHub: React.FC<WellnessHubProps> = ({ 
  onToggleWidget, 
  activeWidgets, 
  onOpenSettings, 
  isMobileOpen, 
  onCloseMobile 
}) => {
  const { user } = useAuth();
  const { currentTheme, isLowPowerMode } = useTheme(); // Consume global isLowPowerMode
  const sidebarRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Responsive Check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  useEffect(() => {
    if (!isMobileOpen || !carouselRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = itemsRef.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              startTransition(() => {
                setActiveIndex(index);
              });
            }
          }
        });
      },
      {
        root: carouselRef.current,
        threshold: 0.6,
      }
    );

    itemsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isMobileOpen, isMobile]);

  const handleWidgetClick = (widget: typeof WIDGETS[0]) => {
      if (widget.id === 'settings') {
          onOpenSettings();
      } else {
          onToggleWidget(widget.id);
      }
      onCloseMobile();
  };

  const jumpToWidget = (index: number) => {
      if (itemsRef.current[index]) {
          itemsRef.current[index]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
  };

  // Tell the chat how much room the sidebar takes (left margin 12 + width + 28 gap) so the chat stays centred in
  // the remaining space — collapsed it is 80 px wide, not 280 (the chat used to keep a fixed 320 px gap).
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-space', `${12 + (isCollapsed ? 80 : 280) + 28}px`);
    return () => { document.documentElement.style.removeProperty('--sidebar-space'); };
  }, [isCollapsed]);

  const sidebarVariants = {
    closed: { x: "-100%", opacity: 0 },
    open: { x: 0, opacity: 1 },
    desktop: { x: 0, opacity: 1, width: isCollapsed ? 80 : 280 },
  };

  if (isMobile) {
      return (
        <AnimatePresence>
            {isMobileOpen && (
                <div className="fixed inset-0 z-[60] flex flex-col pointer-events-auto">
                    {/* LITE MODE: Simplified Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={onCloseMobile}
                        className="absolute inset-0 bg-md-surface/95"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                        className="relative z-10 flex flex-col h-full w-full pt-20 pb-24"
                    >
                        <div className="px-6 pb-4 flex gap-1.5 z-20">
                            {WIDGETS.map((w, i) => (
                                <button
                                    key={w.id}
                                    onClick={() => jumpToWidget(i)}
                                    aria-label={`Go to ${w.label}`}
                                    className="flex-1 h-1.5 rounded-full overflow-hidden bg-md-surface-container-highest transition-all duration-300 relative group"
                                >
                                    <div
                                        className={`absolute inset-0 transition-all duration-500 bg-md-primary ${activeIndex === i ? '' : 'opacity-0'}`}
                                    />
                                </button>
                            ))}
                        </div>

                        <div className="px-8 mb-4 flex justify-between items-center">
                            <h2 className="text-sm font-medium tracking-wide text-md-primary">Your Sanctuary</h2>
                            <button onClick={onCloseMobile} aria-label="Close" className="w-10 h-10 -mr-2 flex items-center justify-center text-md-on-surface-variant hover:bg-md-on-surface/10 rounded-full">
                                <X size={20} />
                            </button>
                        </div>

                        <div
                            ref={carouselRef}
                            className="flex-1 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide px-6 items-center"
                            style={{ scrollSnapStop: 'always' }}
                        >
                            {WIDGETS.map((widget, i) => {
                                const isActive = i === activeIndex;
                                return (
                                    <div
                                        key={widget.id}
                                        ref={(el) => { itemsRef.current[i] = el; }}
                                        className="w-full shrink-0 snap-center px-2 flex items-center justify-center h-full"
                                        style={{ scrollSnapStop: 'always' }}
                                    >
                                        <div
                                            onClick={() => handleWidgetClick(widget)}
                                            className={`
                                                w-full h-full max-h-[60vh] relative overflow-hidden rounded-[2.5rem]
                                                flex flex-col items-center justify-center
                                                transition-all duration-500 ease-out
                                                bg-md-surface-container-high border border-md-outline-variant/30 shadow-xl
                                                ${isActive
                                                    ? 'scale-100 opacity-100 grayscale-0'
                                                    : 'scale-90 opacity-50 grayscale-[30%]'}
                                            `}
                                            style={{
                                                willChange: 'transform, opacity',
                                                transform: isActive ? 'scale(1)' : 'scale(0.9)',
                                            }}
                                        >
                                            {/* Static gradient for Lite Mode, Complex for High Quality */}
                                            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-md-primary/15 to-transparent" />

                                            <div className={`
                                                w-24 h-24 rounded-[32px] flex items-center justify-center mb-8
                                                bg-md-primary-container text-md-on-primary-container relative z-10
                                            `}>
                                                <widget.icon size={52} />
                                            </div>

                                            <h3 className="text-3xl font-serif text-md-on-surface mb-3 relative z-10">{widget.label}</h3>
                                            <p className="text-md-on-surface-variant text-sm max-w-[220px] text-center leading-relaxed relative z-10">{widget.desc}</p>

                                            <div className="mt-10 px-8 h-12 inline-flex items-center rounded-full bg-md-primary text-md-on-primary font-medium text-sm relative z-10">
                                                Open
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
      );
  }

  // Desktop: a floating Liquid Glass navigation panel (control layer) with Material 3 navigation-drawer items.
  const firstName = user?.name?.split(' ')[0] || 'Friend';
  return (
    <motion.aside
      ref={sidebarRef}
      variants={sidebarVariants}
      initial="closed"
      animate="desktop"
      transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
      aria-label="Sanctuary navigation"
      className="glass fixed top-3 bottom-3 left-3 z-20 rounded-[28px] flex-col overflow-hidden md:flex hidden"
    >
        <div className={`px-4 pt-5 pb-3 flex flex-col ${isCollapsed ? 'items-center px-3' : ''}`}>
          <div className={`flex items-center gap-3 mb-5 ${isCollapsed ? 'justify-center' : 'px-1'}`}>
            <IconTile icon={Icons.relax} tone="primary" active />
            {!isCollapsed && (
               <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-serif text-xl font-semibold text-md-on-surface tracking-tight whitespace-nowrap">
                   Sanctuary
               </motion.h1>
            )}
          </div>

          {!isCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 px-1">
                <p className="text-sm text-md-on-surface-variant">{getGreeting()},</p>
                <h2 className="font-serif text-2xl text-md-on-surface leading-tight truncate">{firstName}</h2>
            </motion.div>
          )}

          <div
             className={`inline-flex items-center gap-2 rounded-[10px] bg-md-tertiary-container text-md-on-tertiary-container ${isCollapsed ? 'w-10 h-10 justify-center' : 'h-8 px-3 w-fit ml-1'}`}
             title={`${user?.streak || 1}-day streak`}
          >
             <Icons.streak size={isCollapsed ? 20 : 16} />
             {!isCollapsed && <span className="text-xs font-medium whitespace-nowrap">{user?.streak || 1}-day streak</span>}
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
          {!isCollapsed && <p className="px-4 pt-1 pb-2 text-sm font-medium tracking-wide text-md-primary">Toolkit</p>}

          {WIDGETS.map((widget) => {
            if (widget.id === 'settings') return null;
            const isActive = !!activeWidgets[widget.id];
            return (
              <button
                key={widget.id}
                id={`nav-${widget.id}`} // Added ID for Tour Targeting
                onClick={() => { onToggleWidget(widget.id); }}
                aria-pressed={isActive}
                className={`
                  relative w-full h-[52px] flex items-center gap-3 rounded-full text-[15px] font-semibold transition-colors duration-200 ease-md-emphasized
                  ${isCollapsed ? 'justify-center px-0' : 'pl-1.5 pr-4'}
                  ${isActive
                    ? 'bg-md-secondary-container text-md-on-secondary-container'
                    : 'text-md-on-surface-variant hover:bg-md-on-surface/[0.08] hover:text-md-on-surface'}
                `}
                title={isCollapsed ? widget.label : widget.desc}
              >
                <IconTile icon={widget.icon} tone={TOOL_TONE[widget.id]} active={isActive} />
                {!isCollapsed && <span className="truncate">{widget.label}</span>}
                {isActive && !isCollapsed && <span className="ml-auto text-[11px] font-medium opacity-80">Open</span>}
                {isActive && isCollapsed && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-md-primary" />}
              </button>
            );
          })}
        </nav>

        <div className="p-3 mt-auto space-y-2">
          {!isCollapsed ? (
             <button
                onClick={onOpenSettings}
                className="w-full rounded-[20px] p-2.5 flex items-center gap-3 bg-md-surface-container-high/80 hover:bg-md-surface-container-highest transition-colors text-left"
             >
                <span className="relative shrink-0">
                    {user?.avatar ? (
                        <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-md-primary-container text-md-on-primary-container">
                          {user?.name?.charAt(0) || 'U'}
                        </span>
                    )}
                    {user?.isPro && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-md-tertiary text-md-on-tertiary flex items-center justify-center ring-2 ring-md-surface-container-high">
                            <Sparkles size={8} fill="currentColor" />
                        </span>
                    )}
                </span>
                <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-md-on-surface truncate">{user?.name}</span>
                    <span className="block text-xs text-md-on-surface-variant truncate">{user?.isPro ? 'Pro' : 'Free plan'} · Settings</span>
                </span>
                <Icons.settings size={20} className="text-md-on-surface-variant shrink-0" />
             </button>
          ) : (
              <button onClick={onOpenSettings} aria-label="Settings" title="Settings"
                className="w-full h-12 flex items-center justify-center rounded-full text-md-on-surface-variant hover:bg-md-on-surface/[0.08] hover:text-md-on-surface transition-colors">
                  <Icons.settings size={22} />
              </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            className="w-full h-10 flex items-center justify-center rounded-full text-md-on-surface-variant hover:bg-md-on-surface/[0.08] hover:text-md-on-surface transition-colors"
          >
            {isCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

      </motion.aside>
  );
}
