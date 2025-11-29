import React from 'react';
import { Lock, Hand, Timer, Activity, Mic, Sparkles } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { motion, Variants } from 'framer-motion';

export const BentoGrid: React.FC = () => {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <section className="w-full max-w-[1400px] mx-auto z-10 relative">
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[320px]"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ amount: 0.2 }}
      >
        
        {/* 1. Privacy (Large) */}
        <motion.div variants={cardVariants} className="md:col-span-2">
          <GlassCard className="group h-full flex flex-col justify-between hover:bg-white/5 transition-colors bg-gradient-to-br from-white/5 to-transparent">
            <div className="flex justify-between items-start">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Lock className="text-teal-200" size={28} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-white/20">Security</span>
            </div>
            <div>
              <h3 className="font-serif text-3xl mb-2">Private Sanctuary</h3>
              <p className="text-white/60 leading-relaxed text-lg max-w-lg">
                Your thoughts are end-to-end encrypted. Aastha includes a password-protected digital diary that effectively locks your data away from everyone, including us.
              </p>
            </div>
          </GlassCard>
        </motion.div>

        {/* 2. Voice (Standard) */}
        <motion.div variants={cardVariants} className="md:col-span-1">
          <GlassCard className="group h-full flex flex-col justify-between hover:bg-white/5 transition-colors">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
              <Mic className="text-violet-200" size={28} />
            </div>
            <div>
              <h3 className="font-serif text-2xl mb-2">Voice Mode</h3>
              <p className="text-white/60 leading-relaxed">
                Speak freely. Aastha listens and responds with a soothing, natural voice for hands-free therapy.
              </p>
            </div>
          </GlassCard>
        </motion.div>

        {/* 3. Mood (Standard) */}
        <motion.div variants={cardVariants} className="md:col-span-1">
          <GlassCard className="group h-full flex flex-col justify-between hover:bg-white/5 transition-colors">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
              <Activity className="text-rose-200" size={28} />
            </div>
            <div>
              <h3 className="font-serif text-2xl mb-2">Mood Tracking</h3>
              <p className="text-white/60 leading-relaxed">
                Visualize your emotional patterns over time. Understand your triggers and wins with beautiful charts.
              </p>
            </div>
          </GlassCard>
        </motion.div>

        {/* 4. Focus (Large) */}
        <motion.div variants={cardVariants} className="md:col-span-2">
           <GlassCard className="group h-full flex flex-col justify-between hover:bg-white/5 transition-colors bg-gradient-to-tl from-white/5 to-transparent">
            <div className="flex justify-between items-start">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <Timer className="text-amber-200" size={28} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-white/20">Productivity</span>
            </div>
            <div>
              <h3 className="font-serif text-3xl mb-2">Mindful Focus</h3>
              <p className="text-white/60 leading-relaxed text-lg max-w-lg">
                Integrated Pomodoro timer that syncs with ambient soundscapes to help you enter deep work states effortlessly.
              </p>
            </div>
          </GlassCard>
        </motion.div>

      </motion.div>
    </section>
  );
};