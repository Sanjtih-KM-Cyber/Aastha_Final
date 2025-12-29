import React from 'react';
import { motion } from 'framer-motion';

export const Background: React.FC = () => {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[#050505]">
      {/* Deep Base */}
      <div className="absolute inset-0 bg-midnight opacity-90" />
      
      {/* PERFORMANCE FIX: 
         - Added 'hidden md:block' to the animated blobs.
         - Mobile users (screens < 768px) will NOT render these heavy animated elements.
         - They will just see the static background color + noise, which is much faster.
      */}
      
      {/* Blob 1 */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2], // Reduced opacity range
        }}
        transition={{ 
          duration: 10, // Slower duration = less FPS pressure
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="hidden md:block absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-teal-900/30 rounded-full blur-[80px] mix-blend-screen"
      />
      
      {/* Blob 2 */}
      <motion.div 
        animate={{ 
          scale: [1, 1.1, 1],
          x: [0, 30, 0], // Reduced movement range
          opacity: [0.2, 0.3, 0.2]
        }}
        transition={{ 
          duration: 15, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="hidden md:block absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-violet-900/30 rounded-full blur-[80px] mix-blend-screen"
      />
      
      {/* Blob 3 */}
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
          y: [0, -20, 0],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{ 
          duration: 12, 
          repeat: Infinity,
          ease: "easeInOut" 
        }}
        className="hidden md:block absolute top-[40%] left-[30%] w-[35vw] h-[35vw] bg-orange-900/10 rounded-full blur-[80px] mix-blend-screen"
      />

      {/* Static Fallback for Mobile (Optional subtle gradient) */}
      <div className="md:hidden absolute inset-0 bg-gradient-to-b from-teal-900/10 via-transparent to-violet-900/10" />

      {/* Grain overlay - kept as it hides banding */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
    </div>
  );
};
