import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

interface AppContainerProps {
  children: React.ReactNode;
}

export const AppContainer: React.FC<AppContainerProps> = ({ children }) => {
  const location = useLocation();
  const { wallpaper, currentTheme } = useTheme();

  // Define routes where custom wallpaper should be hidden
  const isPublicRoute = location.pathname === '/' || location.pathname === '/login';
  
  // Only show wallpaper if set AND we are NOT on a public route
  const showWallpaper = wallpaper && !isPublicRoute;

  // Performance Optimization: Check for low-power mode or mobile
  // Simplified background for non-wallpaper state: Static gradient instead of animation
  // We remove the framer-motion loops entirely for the default state to save GPU/CPU.
  
  return (
    <div className="relative min-h-screen font-sans text-white bg-midnight overflow-hidden selection:bg-teal-500/30">
      
      {/* --- The Living Background Layer (GPU Optimized) --- */}
      <div className="fixed inset-0 z-0 pointer-events-none transform-gpu transition-colors duration-1000">
        {/* Base Darkness */}
        <div className="absolute inset-0 bg-midnight opacity-90" />
        
        {showWallpaper ? (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="absolute inset-0 z-0"
          >
            <img 
              src={wallpaper!} 
              alt="Sanctuary Wallpaper" 
              className="w-full h-full object-cover opacity-60" 
            />
            <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
          </motion.div>
        ) : (
          <>
            {/* Static Gradient Blobs (Zero Animation Overhead) */}
            <div 
              className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] rounded-full blur-[120px] mix-blend-screen opacity-30"
              style={{ backgroundColor: currentTheme.primaryColor }}
            />
            
            <div 
              className={`absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] mix-blend-screen opacity-20 bg-gradient-to-t ${currentTheme.gradient}`}
            />
          </>
        )}

        {/* Noise Texture Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] brightness-100 contrast-150 mix-blend-overlay"></div>
      </div>

      {/* --- Content Layer --- */}
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, filter: 'blur(2px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(2px)' }}
          transition={{ duration: 0.15, ease: "easeOut" }} // Snappy fast transition
          className="relative z-10 w-full h-full min-h-screen flex flex-col"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};