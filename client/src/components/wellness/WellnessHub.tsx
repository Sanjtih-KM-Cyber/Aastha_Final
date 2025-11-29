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
  ChevronsRight
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
  { id: 'diary', label: 'Journal', icon: Book, color: 'text-teal-200' },
  { id: 'mood', label: 'Mood Tracker', icon: Smile, color: 'text-yellow-200' },
  { id: 'breathing', label: 'Breathing', icon: Wind, color: 'text-cyan-200' },
  { id: 'jam', label: 'Jam Session', icon: Music, color: 'text-violet-200' },
  { id: 'soundscape', label: 'Soundscapes', icon: Sliders, color: 'text-emerald-200' },
  { id: 'pomodoro', label: 'Deep Focus', icon: Clock, color: 'text-rose-200' },
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

  // Time-based Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // Click Outside Logic (Mobile Only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobileOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onCloseMobile();
      }
    };
    
    if (isMobileOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileOpen, onCloseMobile]);

  // Framer Motion Variants
  const sidebarVariants = {
    closed: { x: "-100%", opacity: 0 },
    open: { x: 0, opacity: 1 },
    desktop: { x: 0, opacity: 1, width: isCollapsed ? 80 : 280 }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        ref={sidebarRef}
        variants={sidebarVariants}
        initial="closed"
        animate={isMobile ? (isMobileOpen ? "open" : "closed") : "desktop"}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`
          fixed top-0 bottom-0 left-0 z-50
          h-full
          bg-black/40 backdrop-blur-2xl border-r border-white/10
          flex flex-col
          shadow-2xl
          overflow-hidden
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
                onClick={() => { onToggleWidget(widget.id); if(isMobile) onCloseMobile(); }}
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
          {!isMobile && (
              <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-colors"
              >
                {isCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
              </button>
          )}
        </div>

      </motion.aside>
    </>
  );
};