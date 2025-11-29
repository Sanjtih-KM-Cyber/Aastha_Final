import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Book, 
  Music, 
  Wind, 
  Clock, 
  Smile, 
  Sliders, 
  LogOut, 
  Settings,
  Sparkles,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface WellnessHubProps {
  onToggleWidget: (widget: string) => void;
  activeWidgets: Record<string, boolean>;
  onOpenSettings?: () => void;
}

export const WellnessHub: React.FC<WellnessHubProps> = ({ onToggleWidget, activeWidgets, onOpenSettings }) => {
  const { logout, user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: 'diary', label: 'Journal', icon: Book, color: 'text-teal-200' },
    { id: 'mood', label: 'Mood Tracker', icon: Smile, color: 'text-yellow-200' },
    { id: 'breathing', label: 'Breathing', icon: Wind, color: 'text-cyan-200' },
    { id: 'jam', label: 'Jam Session', icon: Music, color: 'text-violet-200' },
    { id: 'soundscape', label: 'Soundscapes', icon: Sliders, color: 'text-emerald-200' },
    { id: 'pomodoro', label: 'Deep Focus', icon: Clock, color: 'text-rose-200' },
  ];

  return (
    <motion.aside 
      initial={{ x: -50, opacity: 0 }}
      animate={{ 
        x: 0, 
        opacity: 1, 
        width: isCollapsed ? 80 : 260 
      }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`
        fixed left-4 top-24 bottom-6 z-40
        rounded-[2rem] 
        bg-black/40 backdrop-blur-2xl 
        border border-white/10 border-r-white/20
        shadow-[0_0_40px_rgba(0,0,0,0.3)] 
        flex flex-col overflow-hidden
      `}
    >
      {/* Header */}
      <div className={`p-6 transition-all duration-300 flex flex-col ${isCollapsed ? 'items-center' : ''}`}>
        <div className={`flex items-center gap-3 mb-1 ${isCollapsed ? 'justify-center' : ''}`}>
          <div className="w-10 h-10 min-w-[40px] rounded-full bg-gradient-to-tr from-teal-400 to-violet-500 flex items-center justify-center shadow-[0_0_15px_rgba(45,212,191,0.3)]">
            <Sparkles size={20} className="text-white" />
          </div>
          {!isCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="font-serif text-2xl font-medium tracking-tight text-white/90">Sanctuary</h2>
            </motion.div>
          )}
        </div>
      </div>

      {/* Menu - Glass Chips */}
      <div className="flex-1 px-3 py-2 space-y-2 overflow-y-auto scrollbar-hide">
        {menuItems.map((item) => {
          const isActive = activeWidgets[item.id];
          return (
            <button
              key={item.id}
              onClick={() => onToggleWidget(item.id)}
              className={`
                w-full flex items-center gap-4 px-3 py-3 rounded-2xl text-sm font-medium transition-all duration-300 group relative
                ${isActive 
                  ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/20' 
                  : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'}
                ${isCollapsed ? 'justify-center px-0' : ''}
              `}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon 
                size={20} 
                className={`transition-colors duration-300 relative z-10 ${isActive ? item.color : 'text-white/40 group-hover:text-white/80'}`} 
              />
              
              {!isCollapsed && (
                <span className="relative z-10 truncate">{item.label}</span>
              )}
              
              {/* Neon Glow Active Indicator */}
              {isActive && (
                <motion.div 
                  layoutId="active-glow"
                  className={`
                    absolute bg-teal-400/80 shadow-[0_0_10px_rgba(45,212,191,1)] rounded-full
                    ${isCollapsed ? 'top-2 right-2 w-1.5 h-1.5' : 'right-4 w-1.5 h-1.5'}
                  `}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer / Collapse Toggle */}
      <div className="p-4 border-t border-white/5 bg-black/20 mt-auto">
        
        {/* User Info (Only when expanded) */}
        {!isCollapsed && (
           <motion.div 
             initial={{ opacity: 0 }} 
             animate={{ opacity: 1 }}
             className="flex items-center justify-between mb-4"
           >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-[10px] font-bold">
                    {user?.name?.charAt(0) || 'U'}
                </div>
                <span className="text-xs text-white/60 truncate">{user?.name}</span>
              </div>
              <button onClick={onOpenSettings} className="text-white/30 hover:text-white">
                  <Settings size={14} />
              </button>
           </motion.div>
        )}

        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`
             w-full flex items-center justify-center py-2 rounded-xl hover:bg-white/5 text-white/30 hover:text-white transition-colors
          `}
        >
          {isCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>
    </motion.aside>
  );
};