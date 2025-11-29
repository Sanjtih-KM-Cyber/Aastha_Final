import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Internal GlassCard component for styling
const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 ${className}`}>
    {children}
  </div>
);

export const FooterDoorway = () => {
  const navigate = useNavigate();

  const handleEnter = () => {
    navigate('/login');
  };

  return (
    <footer className="relative h-[80vh] flex flex-col items-center justify-end pb-32 overflow-hidden z-20 bg-[#05080f] border-t border-white/5">
      
      {/* Noise Texture */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      {/* Light beam effect */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-teal-500/10 blur-[150px] opacity-40 hover:opacity-100 transition-opacity duration-1000" />

      {/* Trigger Text */}
      <motion.div 
        animate={{ y: [0, 5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="mb-12 text-center relative z-10 pointer-events-none"
      >
        <p className="font-serif text-4xl md:text-5xl text-white/90 mb-4 tracking-tight">Ready to meet her?</p>
        <p className="text-white/40 text-xs tracking-[0.4em] uppercase font-bold">Click to Enter Sanctuary</p>
      </motion.div>

      {/* The Doorway */}
      <motion.div
        onClick={handleEnter}
        className="relative cursor-pointer group z-20"
        whileHover={{ scale: 1.02, y: -10 }}
        transition={{ duration: 0.5 }}
      >
        {/* Door Frame */}
        <div className="w-64 h-80 md:w-80 md:h-96 bg-gradient-to-t from-white/5 to-transparent rounded-t-full border border-white/10 border-b-0 backdrop-blur-sm relative overflow-hidden transition-all duration-700 group-hover:bg-white/10 group-hover:shadow-[0_0_80px_rgba(255,255,255,0.15)]">
          
          {/* Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-teal-900/40 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          {/* Light Source at bottom */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-white/5 blur-3xl rounded-t-full group-hover:bg-white/20 transition-all duration-700"></div>
          
          {/* Silhouette Icon */}
          <div className="absolute bottom-0 w-full flex justify-center pb-10 opacity-30 group-hover:opacity-100 transition-all duration-700 group-hover:-translate-y-2">
             <div className="w-1.5 bg-white/70 h-12 rounded-full shadow-[0_0_15px_white]"></div>
          </div>
        </div>
      </motion.div>
    </footer>
  );
};