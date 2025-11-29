import React from 'react';
import { motion } from 'framer-motion';
import { X, Check, ArrowRight } from 'lucide-react';

export const TheShift: React.FC = () => {
  return (
    <section className="py-32 px-6 w-full relative overflow-hidden">
       {/* Background Split */}
       <div className="absolute inset-0 flex">
           <div className="w-1/2 h-full bg-white/0 border-r border-white/5 hidden md:block" />
           <div className="w-1/2 h-full bg-white/0" />
       </div>

       <div className="max-w-6xl mx-auto relative z-10">
           <div className="text-center mb-20">
               <span className="text-xs font-bold uppercase tracking-[0.3em] text-white/40 mb-4 block">Evolution</span>
               <h2 className="font-serif text-5xl md:text-6xl text-white">The Shift</h2>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
               
               {/* Old Way */}
               <div className="p-8 rounded-3xl border border-white/5 bg-white/0 opacity-60 hover:opacity-80 transition-opacity text-right md:pr-12">
                   <h3 className="text-2xl font-serif text-white/70 mb-6">Traditional Journaling</h3>
                   <ul className="space-y-6 flex flex-col items-end">
                       <li className="flex items-center gap-4 text-white/50">
                           <span>Static text on a screen</span>
                           <X size={18} className="text-red-900" />
                       </li>
                       <li className="flex items-center gap-4 text-white/50">
                           <span>Feeling lonely while venting</span>
                           <X size={18} className="text-red-900" />
                       </li>
                       <li className="flex items-center gap-4 text-white/50">
                           <span>Zero feedback or insights</span>
                           <X size={18} className="text-red-900" />
                       </li>
                   </ul>
               </div>

               {/* Aastha Way */}
               <motion.div 
                  initial={{ opacity: 0, x: 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ margin: "-100px" }}
                  className="p-10 rounded-3xl border border-teal-500/30 bg-gradient-to-br from-teal-900/20 to-transparent backdrop-blur-sm shadow-[0_0_60px_rgba(45,212,191,0.1)]"
               >
                   <h3 className="text-3xl font-serif text-white mb-8">The Aastha Way</h3>
                   <ul className="space-y-6">
                       <li className="flex items-center gap-4 text-white font-medium">
                           <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center"><Check size={14} className="text-black" /></div>
                           <span>Interactive, fluid conversations</span>
                       </li>
                       <li className="flex items-center gap-4 text-white font-medium">
                           <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center"><Check size={14} className="text-black" /></div>
                           <span>Always there, 24/7 support</span>
                       </li>
                       <li className="flex items-center gap-4 text-white font-medium">
                           <div className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center"><Check size={14} className="text-black" /></div>
                           <span>Proactive insights & growth</span>
                       </li>
                   </ul>
               </motion.div>

           </div>
       </div>
    </section>
  );
};