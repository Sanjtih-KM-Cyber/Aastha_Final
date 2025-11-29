import React from 'react';
import { motion } from 'framer-motion';

export const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Deep Base */}
      <div className="absolute inset-0 bg-midnight opacity-90" />
      
      {/* Aurora Gradients */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-teal-900/40 rounded-full blur-[120px] mix-blend-screen"
      />
      
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          x: [0, 50, 0],
          opacity: [0.2, 0.4, 0.2]
        }}
        transition={{ 
          duration: 12, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-violet-900/40 rounded-full blur-[120px] mix-blend-screen"
      />
      
      <motion.div 
        animate={{ 
          scale: [1, 1.3, 1],
          y: [0, -30, 0],
          opacity: [0.1, 0.3, 0.1]
        }}
        transition={{ 
          duration: 10, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] bg-orange-900/20 rounded-full blur-[100px] mix-blend-screen"
      />

      {/* Grain overlay for texture */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
    </div>
  );
};