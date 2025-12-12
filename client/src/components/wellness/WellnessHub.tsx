import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Book, 
  Music, 
  Wind, 
  Clock, 
  Smile, 
  Sliders, 
  Settings, 
  Sparkles, 
  Flame,
  ChevronsLeft,
  ChevronsRight,
  X
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';

interface WellnessHubProps {
  onToggleWidget: (widget: string) => void;
  activeWidgets: Record<string, boolean>;
  onOpenSettings: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const WIDGETS = [
  { id: 'diary', label: 'Journal', icon: Book, color: 'text-teal-200', desc: 'Reflect on your day' },
  { id: 'mood', label: 'Mood Tracker', icon: Smile, color: 'text-yellow-200', desc: 'Track your emotions' },
  { id: 'breathing', label: 'Breathing', icon: Wind, color: 'text-cyan-200', desc: 'Calm your mind' },
  { id: 'jam', label: 'Jam Session', icon: Music, color: 'text-violet-200', desc: 'Listen together' },
  { id: 'soundscape', label: 'Soundscapes', icon: Sliders, color: 'text-emerald-200', desc: 'Ambient sounds' },
  { id: 'pomodoro', label: 'Deep Focus', icon: Clock, color: 'text-rose-200', desc: 'Stay productive' },
];

export const WellnessHub: React.FC<WellnessHubProps> = ({ 
  onToggleWidget, 
  activeWidgets, 
  onOpenSettings, 
  isMobileOpen, 
  onCloseMobile 
}) => {
  const { user } = useAuth();
  const { currentTheme } = useTheme();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileCardIndex, setMobileCardIndex] = useState(0);

  // Responsive Check
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Time-based Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Click Outside Logic (Mobile Only) - Only for standard Sidebar if somehow rendered
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && !isMobile) {
        onCloseMobile();
      }
    };
    
    if (isMobileOpen && !isMobile) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileOpen, onCloseMobile, isMobile]);

  // Framer Motion Variants
  const sidebarVariants = {
    closed: { x: "-100%", opacity: 0 },
    open: { x: 0, opacity: 1 },
    desktop: { x: 0, opacity: 1, width: isCollapsed ? 80 : 280 }
  };

  // --- MOBILE CARD CAROUSEL LOGIC ---
  const handleNextCard = () => {
    setMobileCardIndex((prev) => (prev + 1) % WIDGETS.length);
  };

  const handlePrevCard = () => {
    setMobileCardIndex((prev) => (prev - 1 + WIDGETS.length) % WIDGETS.length);
  };

  // Swipe Handlers (Simple Touch)
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
      if (!touchStartX.current) return;
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX.current - touchEndX;
      if (Math.abs(diff) > 50) { // Threshold
          if (diff > 0) handleNextCard(); // Swipe Left -> Next
          else handlePrevCard(); // Swipe Right -> Prev
      }
      touchStartX.current = null;
  };

  if (isMobile) {
      return (
        <AnimatePresence>
            {isMobileOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 50 }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-3xl p-6"
                >
                    {/* Close Button */}
                    <button
                        onClick={onCloseMobile}
                        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white/70 hover:bg-white/20"
                    >
                        <X size={24} />
                    </button>

                    {/* Greeting Header */}
                    <div className="text-center mb-8 mt-4">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 shadow-lg"
                             style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #111827)` }}>
                            <Sparkles size={24} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-serif text-white mb-1">
                            {getGreeting()}, <span className="text-white/60">{user?.name?.split(' ')[0]}</span>
                        </h2>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <Flame size={14} className="text-orange-400" fill="currentColor" />
                            <span className="text-xs font-mono text-white/40">{user?.streak || 1} Day Streak</span>
                        </div>
                    </div>

                    {/* Card Carousel */}
                    <div
                        className="relative w-full max-w-sm aspect-[4/5] perspective-1000"
                        onTouchStart={handleTouchStart}
                        onTouchEnd={handleTouchEnd}
                    >
                        <AnimatePresence mode='wait'>
                            <motion.div
                                key={mobileCardIndex}
                                initial={{ opacity: 0, x: 50, rotateY: -10 }}
                                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                                exit={{ opacity: 0, x: -50, rotateY: 10 }}
                                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                className="absolute inset-0 bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center shadow-2xl backdrop-blur-md"
                                style={{
                                    boxShadow: `0 0 50px -12px ${currentTheme.primaryColor}33`
                                }}
                            >
                                {/* Widget Icon */}
                                <div className={`p-6 rounded-full bg-white/5 mb-6 ${WIDGETS[mobileCardIndex].color.replace('text-', 'bg-').replace('-200', '-500/20')}`}>
                                    {React.createElement(WIDGETS[mobileCardIndex].icon, { size: 48, className: WIDGETS[mobileCardIndex].color })}
                                </div>

                                <h3 className="text-3xl font-serif text-white mb-2">{WIDGETS[mobileCardIndex].label}</h3>
                                <p className="text-white/40 text-center mb-8">{WIDGETS[mobileCardIndex].desc}</p>

                                <button
                                    onClick={() => { onToggleWidget(WIDGETS[mobileCardIndex].id); onCloseMobile(); }}
                                    className="px-8 py-3 rounded-full bg-white text-black font-bold hover:scale-105 active:scale-95 transition-all"
                                >
                                    Open Widget
                                </button>

                                {/* Dots Indicator */}
                                <div className="absolute bottom-6 flex gap-2">
                                    {WIDGETS.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`w-2 h-2 rounded-full transition-all ${idx === mobileCardIndex ? 'bg-white w-4' : 'bg-white/20'}`}
                                        />
                                    ))}
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        {/* Navigation Arrows (for non-swipe users) */}
                        <button onClick={handlePrevCard} className="absolute top-1/2 -left-4 -translate-y-1/2 p-2 text-white/30 hover:text-white"><ChevronsLeft size={32}/></button>
                        <button onClick={handleNextCard} className="absolute top-1/2 -right-4 -translate-y-1/2 p-2 text-white/30 hover:text-white"><ChevronsRight size={32}/></button>
                    </div>

                    {/* Footer Settings */}
                    <div className="mt-auto pt-8">
                         <button onClick={onOpenSettings} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors px-4 py-2 rounded-full border border-white/5 hover:bg-white/5">
                             <Settings size={16} />
                             <span className="text-sm">Settings & Profile</span>
                         </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      );
  }

  // --- DESKTOP SIDEBAR (UNCHANGED) ---
  return (
    <motion.aside
      ref={sidebarRef}
      variants={sidebarVariants}
      initial="closed"
      animate="desktop"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`
        fixed top-0 bottom-0 left-0 z-50
        h-full
        bg-black/40 backdrop-blur-2xl border-r border-white/10
        flex flex-col
        shadow-2xl
        overflow-hidden
        md:flex hidden
      `}
    >
        {/* --- Header: Greeting & Status --- */}
        <div className={`p-6 pb-4 transition-all duration-300 flex flex-col ${isCollapsed ? 'items-center' : ''}`}>
          <div className={`flex items-center gap-3 mb-6 ${isCollapsed ? 'justify-center' : ''}`}>
            <div 
              className="w-10 h-10 min-w-[40px] rounded-lg flex items-center justify-center shadow-lg"
              style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #111827)` }}
            >
              <Sparkles size={20} className="text-white" />
            </div>
            {!isCollapsed && (
               <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-serif text-xl font-bold text-white tracking-tight whitespace-nowrap">
                   Sanctuary
               </motion.h1>
            )}
          </div>

          {!isCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
                <h2 className="font-serif text-xl text-white leading-tight">
                {getGreeting()}, <br />
                <span className="opacity-60">{user?.name?.split(' ')[0] || 'Friend'}</span>
                </h2>
            </motion.div>
          )}

          {/* Streak Badge */}
          <div 
             className={`flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5 ${isCollapsed ? 'justify-center w-10 h-10 p-0' : 'w-fit'}`}
             title="Daily Streak"
          >
             <div className={`rounded bg-orange-500/20 ${isCollapsed ? 'p-2' : 'p-1'}`}>
               <Flame size={isCollapsed ? 16 : 12} className="text-orange-400" fill="currentColor" />
             </div>
             {!isCollapsed && (
                 <span className="text-xs font-mono text-white/60 whitespace-nowrap">
                     {user?.streak || 1} Day Streak
                 </span>
             )}
          </div>
        </div>

        {/* --- Navigation: Widgets --- */}
        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {!isCollapsed && <p className="px-4 text-[10px] uppercase tracking-widest text-white/30 font-bold mb-2">Toolkit</p>}
          
          {WIDGETS.map((widget) => {
            const isActive = activeWidgets[widget.id];
            return (
              <button
                key={widget.id}
                onClick={() => { onToggleWidget(widget.id); }}
                className={`
                  w-full flex items-center gap-4 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-300 group relative
                  ${isActive 
                    ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/20' 
                    : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'}
                  ${isCollapsed ? 'justify-center px-0' : ''}
                `}
                title={isCollapsed ? widget.label : undefined}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <motion.div 
                    layoutId="active-bar"
                    className={`absolute bg-teal-400/80 shadow-[0_0_10px_rgba(45,212,191,1)] rounded-full ${isCollapsed ? 'top-2 right-2 w-1.5 h-1.5' : 'left-0 top-2 bottom-2 w-1 rounded-r-full'}`}
                    style={{ backgroundColor: currentTheme.primaryColor }}
                  />
                )}

                <widget.icon 
                  size={20} 
                  className={`transition-colors duration-300 relative z-10 ${isActive ? widget.color : 'text-white/40 group-hover:text-white/80'}`} 
                />
                
                {!isCollapsed && (
                  <span className="relative z-10 truncate">{widget.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* --- Footer: Profile & Toggle --- */}
        <div className="p-4 mt-auto border-t border-white/5 bg-black/20">
          
          {!isCollapsed ? (
             <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex items-center gap-3 hover:bg-white/10 transition-colors cursor-pointer mb-4" 
                onClick={onOpenSettings}
             >
                <div className="relative">
                    {user?.avatar ? (
                        <img src={user.avatar} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                    ) : (
                        <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner"
                        style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #333)` }}
                        >
                        {user?.name?.charAt(0) || 'U'}
                        </div>
                    )}
                    {user?.isPro && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-400 rounded-full border-2 border-black flex items-center justify-center">
                            <Sparkles size={8} className="text-black" fill="currentColor"/>
                        </div>
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                    <p className="text-[10px] text-white/40 truncate">{user?.isPro ? 'Pro Member' : 'Free Plan'}</p>
                </div>

                <Settings size={16} className="text-white/40" />
             </motion.div>
          ) : (
              <button onClick={onOpenSettings} className="w-full flex justify-center mb-4 text-white/40 hover:text-white transition-colors">
                  <Settings size={20} />
              </button>
          )}

          {/* Collapse Button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

      </motion.aside>
  );
};