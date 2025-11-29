import React, { useRef, useEffect, useState } from 'react';
import { Hero } from '../components/Hero';
import { FloatingOS } from '../components/FloatingOS';
import { TheShift } from '../components/TheShift';
import { BentoGrid } from '../components/BentoGrid';
import { FooterDoorway } from '../components/FooterDoorway';
import { motion, useScroll, useTransform, useSpring, useMotionTemplate, useMotionValue } from 'framer-motion';
import { ArrowRight, Sparkles, Activity, Heart, Shield, Cpu, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Mouse Spotlight ---
const MouseSpotlight: React.FC = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
      style={{
        background: useMotionTemplate`
          radial-gradient(
            800px circle at ${mouseX}px ${mouseY}px,
            rgba(45, 212, 191, 0.08),
            transparent 80%
          )
        `,
        mixBlendMode: 'screen'
      }}
    />
  );
};

// --- Stack Section ---
const StackSection: React.FC<{ 
    children: React.ReactNode; 
    index: number; 
    id?: string;
    color?: string;
}> = ({ children, index, id, color = "bg-midnight" }) => {
    const ref = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
    const smoothProgress = useSpring(scrollYProgress, { damping: 20, stiffness: 100 });
    
    // Reduced scale down to prevent cut-off
    const scale = useTransform(smoothProgress, [0, 1], [1, 0.95]); 
    const brightness = useTransform(smoothProgress, [0, 1], [1, 0.5]);
    const y = useTransform(smoothProgress, [0, 1], ["0vh", "-5vh"]);

    return (
        <div ref={ref} id={id} className="relative min-h-screen w-full z-0">
            <div className="sticky top-0 h-screen overflow-hidden flex items-center justify-center">
                <motion.div 
                    style={{ scale, filter: `brightness(${brightness})`, y, zIndex: index }}
                    className={`relative w-full h-full flex flex-col justify-center items-center ${color} border-t border-white/5 shadow-[0_-50px_100px_-20px_rgba(0,0,0,0.5)]`}
                >
                    <div className="w-full max-w-[1600px] px-6 md:px-12 flex items-center justify-center h-full">
                        {children}
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

const InfiniteMarquee = () => {
    return (
        <div className="w-full py-24 bg-black border-y border-white/10 overflow-hidden relative z-20 flex items-center">
            <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black z-10 pointer-events-none" />
            <motion.div 
                className="flex gap-32 whitespace-nowrap"
                animate={{ x: ["0%", "-50%"] }}
                transition={{ repeat: Infinity, ease: "linear", duration: 40 }}
            >
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-32 items-center text-white/10 font-serif text-7xl md:text-9xl tracking-tighter select-none">
                        <span>Digital Sanctuary</span>
                        <Sparkles size={64} className="text-teal-900" />
                        <span>Safe Space</span>
                        <Heart size={64} className="text-violet-900" />
                        <span>No Judgement</span>
                        <Activity size={64} className="text-rose-900" />
                    </div>
                ))}
            </motion.div>
        </div>
    );
};

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const scrollToFeatures = (e: React.MouseEvent) => {
      e.preventDefault();
      const element = document.getElementById('features-section');
      element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
      <MouseSpotlight />
      
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-6 md:px-12 mix-blend-difference text-white">
        <div className="font-serif text-2xl font-bold tracking-tighter cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Aastha.</div>
        <div className="hidden md:flex gap-10 text-sm font-medium opacity-80">
          <a href="#" className="hover:opacity-100 transition-opacity">Manifesto</a>
          <a href="#features-section" onClick={scrollToFeatures} className="hover:opacity-100 transition-opacity">Features</a>
        </div>
        <button onClick={() => navigate('/login')} className="text-xs font-bold uppercase tracking-widest border border-white/30 px-8 py-3 rounded-full hover:bg-white hover:text-black transition-all duration-300">Enter Sanctuary</button>
      </nav>

      <div className="relative bg-midnight text-white">
        <div className="sticky top-0 h-screen z-0 flex flex-col justify-center items-center bg-midnight"><Hero /></div>

        <div className="relative z-10 mt-[-5vh]"> 
            {/* 1. Features */}
            <StackSection index={1} id="features-section" color="bg-[#0B0F17]">
                <div className="w-full flex flex-col items-center justify-center">
                    <div className="text-center mb-16">
                         <span className="text-violet-400 text-xs font-bold uppercase tracking-widest mb-4 block">Architecture</span>
                         <h2 className="font-serif text-5xl md:text-7xl">Designed for Serenity</h2>
                    </div>
                    <BentoGrid />
                </div>
            </StackSection>

            {/* 2. The Shift Comparison */}
            <StackSection index={2} color="bg-[#0F121B]">
                <TheShift />
            </StackSection>

            {/* 3. OS Demo */}
            <StackSection index={3} color="bg-[#0a0e17]">
                <div className="w-full h-full flex flex-col items-center justify-center">
                   {/* FIX: Removed duplicate header. FloatingOS already has this text. */}
                   <FloatingOS />
                </div>
            </StackSection>
            
            {/* Marquee Break */}
            <div className="relative z-20 bg-black">
                <InfiniteMarquee />
            </div>

            {/* Footer */}
            <div className="relative z-40 bg-black min-h-[90vh] flex flex-col justify-end">
                <FooterDoorway />
            </div>
        </div>
      </div>
    </>
  );
};