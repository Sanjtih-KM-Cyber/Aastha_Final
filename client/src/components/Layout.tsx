import React from 'react';
import { Background } from './Background';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="relative min-h-screen font-sans text-white selection:bg-teal-500/30 overflow-x-hidden">
      {/* 
        The Background component is rendered ONCE here. 
        It is NOT part of the AnimatePresence below, so it won't unmount/remount on route changes.
        This creates the "persistent" effect.
      */}
      <Background />
      
      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="relative z-10 w-full min-h-screen"
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
};
