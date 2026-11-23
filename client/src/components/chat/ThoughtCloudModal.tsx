import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

/** Shows the companion's last "inner thought" (brain read of the user). Extracted from ChatView. */
export const ThoughtCloudModal: React.FC<{ isOpen: boolean; onClose: () => void; content: any }> = ({ isOpen, onClose, content }) => {
    if (!isOpen || !content) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-md bg-white/10 border border-white/20 backdrop-blur-xl rounded-3xl p-6 shadow-2xl overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 via-violet-400 to-amber-400" />
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white"><X size={20} /></button>

                    <h3 className="text-xl font-serif text-white mb-4 flex items-center gap-2">
                        <span className="text-2xl">☁️</span> Inner Thoughts
                    </h3>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Monologue</h4>
                            <p className="text-sm text-white/90 italic leading-relaxed">"{content.internal_monologue || 'No thoughts yet...'}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Mood</h4>
                                <p className="text-sm text-white font-medium capitalize">{content.mood || 'Neutral'}</p>
                            </div>
                            <div className="p-3 bg-black/20 rounded-xl border border-white/5">
                                <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-1">Strategy</h4>
                                <p className="text-sm text-white font-medium capitalize">{content.strategy || 'Reply'}</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
