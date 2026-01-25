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
// import { useLowPowerMode } from '../../hooks/useLowPowerMode'; // REMOVED

interface WellnessHubProps {
  onToggleWidget: (widget: string) => void;
  activeWidgets: Record<string, boolean>;
  onOpenSettings: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const WIDGETS = [
  { id: 'diary', label: 'Journal', icon: Book, color: 'text-teal-300', barColor: 'bg-teal-400', glow: 'shadow-teal-500/20', from: 'from-teal-500/20', desc: 'Reflect on your day' },
  { id: 'mood', label: 'Mood', icon: Smile, color: 'text-amber-300', barColor: 'bg-amber-400', glow: 'shadow-amber-500/20', from: 'from-amber-500/20', desc: 'Track your emotions' },
  { id: 'lore', label: 'The Web', icon: Network, color: 'text-blue-300', barColor: 'bg-blue-400', glow: 'shadow-blue-500/20', from: 'from-blue-500/20', desc: 'Social Detective Board' },
  { id: 'breathing', label: 'Breathing', icon: Wind, color: 'text-cyan-300', barColor: 'bg-cyan-400', glow: 'shadow-cyan-500/20', from: 'from-cyan-500/20', desc: 'Calm your mind' },
  { id: 'jam', label: 'Music', icon: Music, color: 'text-violet-300', barColor: 'bg-violet-400', glow: 'shadow-violet-500/20', from: 'from-violet-500/20', desc: 'Listen together' },
  { id: 'soundscape', label: 'Sounds', icon: Sliders, color: 'text-emerald-300', barColor: 'bg-emerald-400', glow: 'shadow-emerald-500/20', from: 'from-emerald-500/20', desc: 'Ambient noise' },
  { id: 'pomodoro', label: 'Focus', icon: Clock, color: 'text-rose-300', barColor: 'bg-rose-400', glow: 'shadow-rose-500/20', from: 'from-rose-500/20', desc: 'Deep work timer' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-300', barColor: 'bg-slate-400', glow: 'shadow-slate-500/20', from: 'from-slate-500/20', desc: 'Configure Aastha' },
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
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={onCloseMobile}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
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
                                    className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/10 transition-all duration-300 relative group"
                                >
                                    <div
                                        className={`absolute inset-0 transition-all duration-500 ${activeIndex === i ? w.barColor : 'opacity-0'}`}
                                    />
                                </button>
                            ))}
                        </div>

                        <div className="px-8 mb-4 flex justify-between items-center text-white">
                            <h2 className="text-sm font-medium opacity-50 uppercase tracking-widest">Your Sanctuary</h2>
                            <button onClick={onCloseMobile} className="p-2 -mr-2 text-white/50 hover:text-white rounded-full">
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
                                        ref={(el) => (itemsRef.current[i] = el)}
                                        className="w-full shrink-0 snap-center px-2 flex items-center justify-center h-full"
                                        style={{ scrollSnapStop: 'always' }}
                                    >
                                        <div
                                            onClick={() => handleWidgetClick(widget)}
                                            className={`
                                                w-full h-full max-h-[60vh] relative overflow-hidden rounded-[2.5rem]
                                                flex flex-col items-center justify-center
                                                transition-all duration-500 ease-out
                                                ${isLowPowerMode ? 'bg-[#151515] border-white/5' : 'bg-[#151515]/80 backdrop-blur-3xl border-white/10 shadow-2xl'}
                                                border
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
                                            {isLowPowerMode ? (
                                                <div className={`absolute inset-0 bg-gradient-to-br ${widget.from} to-transparent opacity-10`} />
                                            ) : (
                                                <>
                                                    <div className={`absolute inset-0 bg-gradient-to-br ${widget.from} to-transparent opacity-20`} />
                                                    <div className={`absolute top-0 inset-x-0 h-32 bg-gradient-to-b ${widget.from} to-transparent opacity-10`} />
                                                </>
                                            )}

                                            <div className={`
                                                w-24 h-24 rounded-full flex items-center justify-center mb-8
                                                bg-black/20 shadow-inner border border-white/5 relative z-10
                                            `}>
                                                {!isLowPowerMode && <div className={`absolute inset-0 rounded-full opacity-20 ${widget.barColor} blur-xl animate-pulse`} />}
                                                <widget.icon size={48} className={widget.color} />
                                            </div>

                                            <h3 className="text-3xl font-serif text-white mb-3 relative z-10">{widget.label}</h3>
                                            <p className="text-white/50 text-sm max-w-[200px] text-center leading-relaxed relative z-10">{widget.desc}</p>

                                            <div className="mt-10 px-8 py-3 rounded-full bg-white/10 border border-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors relative z-10">
                                                Tap to Open
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

  return (
    <motion.aside
      ref={sidebarRef}
      variants={sidebarVariants}
      initial="closed"
      animate="desktop"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`
        fixed top-0 bottom-0 left-0 z-20
        h-full
        bg-black/40 backdrop-blur-2xl border-r border-white/10
        flex flex-col
        shadow-2xl
        overflow-hidden
        md:flex hidden
      `}
    >
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

          <div 
             className={`flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5 ${isCollapsed ? 'justify-center w-10 h-10 p-0' : 'w-fit'} group cursor-pointer`}
             title="Daily Streak"
          >
             <div className={`rounded bg-orange-500/20 ${isCollapsed ? 'p-2' : 'p-1'} group-hover:bg-orange-500/30 transition-colors`}>
               <Flame
                 size={isCollapsed ? 16 : 12}
                 className="text-orange-400 group-hover:animate-wiggle"
                 fill="currentColor"
               />
             </div>
             {!isCollapsed && (
                 <span className="text-xs font-mono text-white/60 whitespace-nowrap">
                     {user?.streak || 1} Day Streak
                 </span>
             )}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          {!isCollapsed && <p className="px-4 text-[10px] uppercase tracking-widest text-white/30 font-bold mb-2">Toolkit</p>}
          
          {WIDGETS.map((widget) => {
            if (widget.id === 'settings') return null;
            const isActive = activeWidgets[widget.id];
            return (
              <button
                key={widget.id}
                id={`nav-${widget.id}`} // Added ID for Tour Targeting
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

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-colors"
          >
            {isCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

      </motion.aside>
  );
}
