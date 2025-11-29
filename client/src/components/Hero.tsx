import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';

export const Hero: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 z-10 overflow-hidden">
      
      {/* Neural Glow Background */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-teal-500/10 rounded-full blur-[150px] mix-blend-screen"
        />
        <motion.div 
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50vw] h-[50vw] bg-violet-600/10 rounded-full blur-[120px] mix-blend-screen"
        />
      </div>

      {/* Content */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-5xl mx-auto relative z-20"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8">
            <Sparkles size={12} className="text-teal-300" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">The Future of Wellness</span>
        </div>

        <h1 className="font-serif text-7xl md:text-9xl font-medium mb-8 leading-[0.95] tracking-tighter text-white">
          Your AI <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 via-white to-violet-200">Sanctuary.</span>
        </h1>
        
        <p className="text-xl text-white/60 font-light mb-12 max-w-xl mx-auto leading-relaxed">
           A digital deep breath. Experience the most empathetic AI companion designed to listen, understand, and help you heal.
        </p>
        
        <motion.button 
          whileHover={{ scale: 1.02, boxShadow: "0 0 50px rgba(45,212,191,0.4)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login')}
          className="group relative px-10 py-5 bg-white text-black rounded-full font-bold tracking-widest uppercase text-xs transition-all overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-2">
            Start Chatting <ArrowRight size={14} />
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-teal-200 to-violet-200 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </motion.button>
      </motion.div>
    </section>
  );
};