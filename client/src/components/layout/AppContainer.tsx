import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

interface AppContainerProps {
  children: React.ReactNode;
}

export const AppContainer: React.FC<AppContainerProps> = ({ children }) => {
  const location = useLocation();
  const { wallpaper, currentTheme, isLowPowerMode } = useTheme();
  const [imageError, setImageError] = useState(false);

  React.useEffect(() => {
      setImageError(false);
  }, [wallpaper]);

  return (
    <div className="relative min-h-screen font-sans text-white bg-midnight overflow-hidden selection:bg-teal-500/30">
      <div className="fixed inset-0 z-0 pointer-events-none transform-gpu transition-colors duration-1000">
        <div className="absolute inset-0 bg-midnight opacity-90" />
        
        {wallpaper && !imageError ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-0">
            <img 
                src={wallpaper} 
                alt="Sanctuary Wallpaper" 
                className="w-full h-full object-cover opacity-60"
                onError={() => setImageError(true)}
            />
            <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
          </motion.div>
        ) : (
          /* Default Background */
          <>
            {isLowPowerMode ? (
               // LITE MODE: Static Aurora (Layered Gradients for Depth)
               <div className="absolute inset-0">
                   {/* Top Left Primary Glow */}
                   <div
                      className="absolute top-[-20%] left-[-20%] w-[80vw] h-[80vw] rounded-full opacity-30 mix-blend-screen"
                      style={{
                          background: `radial-gradient(circle, ${currentTheme.primaryColor}, transparent 70%)`
                      }}
                   />
                   {/* Bottom Right Secondary Glow */}
                   <div
                      className="absolute bottom-[-20%] right-[-20%] w-[80vw] h-[80vw] rounded-full opacity-20 mix-blend-screen"
                      style={{
                          background: `radial-gradient(circle, ${currentTheme.primaryColor}, transparent 70%)` // Fallback to primary if gradient parsing is complex, or use simple secondary color logic later
                      }}
                   />
                   {/* Center Deep Tint */}
                   <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
               </div>
            ) : (
               // HIGH QUALITY: Animated Blobs
               <>
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3], x: [0, 20, 0] }}
                  transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-[-10%] left-[-10%] w-[70vw] h-[70vw] rounded-full blur-[120px] mix-blend-screen opacity-30"
                  style={{ backgroundColor: currentTheme.primaryColor }}
                />
                <motion.div
                  animate={{ scale: [1, 1.1, 1], x: [0, -30, 0] }}
                  transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                  className={`absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[120px] mix-blend-screen opacity-20 bg-gradient-to-t ${currentTheme.gradient}`}
                />
               </>
            )}
          </>
        )}

        {/* LITE MODE: Remove Noise Overlay */}
        {!isLowPowerMode && (
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04] brightness-100 contrast-150 mix-blend-overlay"></div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={isLowPowerMode ? { opacity: 0 } : { opacity: 0, filter: 'blur(5px)' }}
          animate={isLowPowerMode ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' }}
          exit={isLowPowerMode ? { opacity: 0 } : { opacity: 0, filter: 'blur(5px)' }}
          transition={{ duration: isLowPowerMode ? 0.2 : 0.4, ease: "easeOut" }}
          className="relative z-10 w-full h-full min-h-screen flex flex-col"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
