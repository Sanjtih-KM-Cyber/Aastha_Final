import React from 'react';
import { motion } from 'framer-motion';
import { Home, Grid, User, Heart } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface MobileNavBarProps {
  activeTab: 'chat' | 'wellness' | 'profile';
  onTabChange: (tab: 'chat' | 'wellness' | 'profile') => void;
  onOpenWellness: () => void;
  onOpenProfile: () => void;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
  activeTab,
  onTabChange,
  onOpenWellness,
  onOpenProfile
}) => {
  const { currentTheme } = useTheme();

  return (
    <div className="fixed bottom-0 left-0 w-full z-50 md:hidden pb-safe pt-2 bg-black/80 backdrop-blur-xl border-t border-white/5">
      <div className="flex justify-around items-center h-16 px-2">

        {/* Chat Tab */}
        <button
          onClick={() => onTabChange('chat')}
          className="flex flex-col items-center gap-1 w-16 relative"
        >
          <div className={`p-1.5 rounded-full transition-all duration-300 ${activeTab === 'chat' ? 'bg-white/10' : ''}`}>
            <Home
              size={24}
              className={`transition-colors ${activeTab === 'chat' ? 'text-white' : 'text-white/40'}`}
              fill={activeTab === 'chat' ? "currentColor" : "none"}
            />
          </div>
          <span className={`text-[10px] font-medium transition-colors ${activeTab === 'chat' ? 'text-white' : 'text-white/40'}`}>
            Sanctuary
          </span>
          {activeTab === 'chat' && (
            <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-b-full" style={{ backgroundColor: currentTheme.primaryColor }} />
          )}
        </button>

        {/* Wellness Tab (Triggers Menu/Widgets) */}
        <button
          onClick={() => { onTabChange('wellness'); onOpenWellness(); }}
          className="flex flex-col items-center gap-1 w-16 relative"
        >
          <div className={`p-1.5 rounded-full transition-all duration-300 ${activeTab === 'wellness' ? 'bg-white/10' : ''}`}>
            <Grid
              size={24}
              className={`transition-colors ${activeTab === 'wellness' ? 'text-white' : 'text-white/40'}`}
            />
          </div>
          <span className={`text-[10px] font-medium transition-colors ${activeTab === 'wellness' ? 'text-white' : 'text-white/40'}`}>
            Toolkit
          </span>
          {activeTab === 'wellness' && (
            <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-b-full" style={{ backgroundColor: currentTheme.primaryColor }} />
          )}
        </button>

        {/* Profile Tab */}
        <button
          onClick={() => { onTabChange('profile'); onOpenProfile(); }}
          className="flex flex-col items-center gap-1 w-16 relative"
        >
          <div className={`p-1.5 rounded-full transition-all duration-300 ${activeTab === 'profile' ? 'bg-white/10' : ''}`}>
            <User
              size={24}
              className={`transition-colors ${activeTab === 'profile' ? 'text-white' : 'text-white/40'}`}
              fill={activeTab === 'profile' ? "currentColor" : "none"}
            />
          </div>
          <span className={`text-[10px] font-medium transition-colors ${activeTab === 'profile' ? 'text-white' : 'text-white/40'}`}>
            You
          </span>
          {activeTab === 'profile' && (
            <motion.div layoutId="nav-indicator" className="absolute -top-2 w-8 h-1 rounded-b-full" style={{ backgroundColor: currentTheme.primaryColor }} />
          )}
        </button>

      </div>
    </div>
  );
};
