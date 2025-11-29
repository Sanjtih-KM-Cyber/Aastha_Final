
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Calendar as CalendarIcon } from 'lucide-react';

interface DiaryProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number; // Kept for compatibility but ignored for full-screen overlay
  onFocus?: () => void;
}

// --- Data Hook ---
const useDiaryStorage = () => {
  const [entries, setEntries] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('skeuomorphic_diary_entries');
      if (saved) setEntries(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load diary entries", e);
    }
  }, []);

  const saveEntry = (date: string, text: string) => {
    setEntries(prev => {
      const updated = { ...prev, [date]: text };
      localStorage.setItem('skeuomorphic_diary_entries', JSON.stringify(updated));
      return updated;
    });
  };

  const getEntry = (date: string) => entries[date] || '';

  return { getEntry, saveEntry };
};

// --- Helper Utils ---
const toDateString = (date: Date) => date.toISOString().split('T')[0];
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
const formatDateDisplay = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

// --- Components ---

const PaperPage: React.FC<{ 
  date: Date; 
  content: string; 
  onChange?: (val: string) => void; 
  readOnly?: boolean;
  side: 'left' | 'right';
  className?: string;
}> = ({ date, content, onChange, readOnly, side, className = '' }) => {
  
  return (
    <div 
      className={`relative w-full h-full bg-[#FDFDF6] shadow-inner flex flex-col overflow-hidden ${className}`}
      style={{
        // Realistic paper texture with blue lines and red margin
        backgroundImage: `
          linear-gradient(90deg, transparent 0rem, transparent 3rem, #ef444440 3rem, #ef444440 3.1rem, transparent 3.1rem),
          linear-gradient(transparent, transparent 27px, #94a3b840 27px, #94a3b840 28px)
        `,
        backgroundSize: '100% 28px'
      }}
    >
      {/* Date Header */}
      <div className="pt-6 px-16 pb-2">
        <h3 className="font-mono text-gray-500 text-sm font-bold tracking-widest uppercase border-b-2 border-gray-200 inline-block">
          {formatDateDisplay(date)}
        </h3>
      </div>

      {/* Text Area */}
      <textarea
        value={content}
        onChange={(e) => onChange && onChange(e.target.value)}
        disabled={readOnly}
        spellCheck={false}
        className={`
          flex-1 w-full bg-transparent resize-none outline-none border-none
          font-mono text-gray-800 text-base leading-[28px]
          pl-[3.5rem] pr-8
          disabled:cursor-default disabled:text-gray-600
        `}
        style={{
          // Align text to lines: font-size 16px (1rem), line-height 28px
          lineHeight: '28px',
          background: 'transparent',
        }}
        placeholder={readOnly ? '' : "Dear Diary..."}
      />
      
      {/* Page Number / Shadow Gradient */}
      <div className={`absolute bottom-4 ${side === 'left' ? 'left-8' : 'right-8'} text-gray-300 font-mono text-xs`}>
        {side === 'left' ? 'Previous' : 'Current'}
      </div>
      
      {/* Inner shadow near spine */}
      <div 
        className={`absolute top-0 bottom-0 w-8 pointer-events-none z-10 opacity-10 bg-gradient-to-r from-black to-transparent ${side === 'left' ? 'right-0 rotate-180' : 'left-0'}`} 
      />
    </div>
  );
};

export const Diary: React.FC<DiaryProps> = ({ isOpen, onClose }) => {
  const { getEntry, saveEntry } = useDiaryStorage();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Animation State
  const [isFlipping, setIsFlipping] = useState<'next' | 'prev' | null>(null);
  
  // Handlers
  const handleNext = () => {
    if (isFlipping) return;
    setIsFlipping('next');
  };

  const handlePrev = () => {
    if (isFlipping) return;
    setIsFlipping('prev');
  };

  const handleAnimationComplete = () => {
    if (isFlipping === 'next') {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (isFlipping === 'prev') {
      setCurrentDate(prev => addDays(prev, -1));
    }
    setIsFlipping(null);
  };

  // Logic to determine what dates to show
  // Right Page is always the "Target" Date. Left Page is "Target - 1".
  
  // If Flipping NEXT: 
  // We start at [Left: D-1, Right: D]. 
  // We want to arrive at [Left: D, Right: D+1].
  // The 'Right Page' (D) needs to flip to the 'Left'.
  // Underneath the Right Page, we need (D+1).
  // Underneath the Left Page, we need (D-1) -> actually effectively (D) after flip.
  
  // If Flipping PREV:
  // We start at [Left: D-1, Right: D].
  // We want to arrive at [Left: D-2, Right: D-1].
  // The 'Left Page' (D-1) needs to flip to the 'Right'.
  
  const dMinus2 = addDays(currentDate, -2);
  const dMinus1 = addDays(currentDate, -1);
  const dCurrent = currentDate;
  const dPlus1 = addDays(currentDate, 1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md perspective-2000 overflow-hidden">
      
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
      >
        <X size={24} />
      </button>

      {/* --- THE BOOK --- */}
      <div className="relative w-[90vw] max-w-6xl h-[85vh] flex items-center justify-center">
        
        {/* Book Container */}
        <div 
          className="relative flex w-full h-full shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] rounded-lg bg-[#333]" // Dark cover edge
          style={{ perspective: '2500px', transformStyle: 'preserve-3d' }}
        >
          {/* STATIC LAYER (The pages underneath) */}
          <div className="absolute inset-0 flex">
            {/* Static Left */}
            <div className="w-1/2 h-full rounded-l-lg overflow-hidden border-r border-[#ccc]">
               <PaperPage 
                 side="left"
                 date={isFlipping === 'prev' ? dMinus2 : dMinus1} 
                 content={getEntry(toDateString(isFlipping === 'prev' ? dMinus2 : dMinus1))}
                 readOnly={true} // Static pages are background, usually readOnly until active
               />
            </div>
            
            {/* Spine Gap */}
            <div className="w-0 relative z-20"></div>

            {/* Static Right */}
            <div className="w-1/2 h-full rounded-r-lg overflow-hidden border-l border-[#ccc]">
               <PaperPage 
                 side="right"
                 date={isFlipping === 'next' ? dPlus1 : dCurrent} 
                 content={getEntry(toDateString(isFlipping === 'next' ? dPlus1 : dCurrent))}
                 readOnly={isFlipping !== null}
                 onChange={(val) => saveEntry(toDateString(isFlipping === 'next' ? dPlus1 : dCurrent), val)}
               />
            </div>
          </div>

          {/* FLIPPING LAYER (The moving page) */}
          <AnimatePresence mode="sync" onExitComplete={() => setIsFlipping(null)}>
            
            {/* FLIP NEXT ANIMATION (Right page flips to Left) */}
            {isFlipping === 'next' && (
              <motion.div
                key="flip-next"
                initial={{ rotateY: 0 }}
                animate={{ rotateY: -180 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                onAnimationComplete={handleAnimationComplete}
                style={{ 
                  transformOrigin: 'left center', 
                  transformStyle: 'preserve-3d',
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '50%',
                  zIndex: 50
                }}
              >
                {/* Front of Flipper (Visible initially on Right) */}
                <div 
                  className="absolute inset-0 w-full h-full rounded-r-lg overflow-hidden backface-hidden"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <PaperPage 
                    side="right"
                    date={dCurrent} 
                    content={getEntry(toDateString(dCurrent))}
                    readOnly={true} 
                  />
                  {/* Shadow Gradient Overlay for turning effect */}
                  <div className="absolute inset-0 bg-gradient-to-l from-black/5 to-transparent pointer-events-none" />
                </div>

                {/* Back of Flipper (Visible after flip on Left) */}
                <div 
                  className="absolute inset-0 w-full h-full rounded-l-lg overflow-hidden"
                  style={{ 
                    transform: 'rotateY(180deg)', 
                    backfaceVisibility: 'hidden' 
                  }}
                >
                  <PaperPage 
                    side="left"
                    date={dCurrent} // Becomes the new Left Page
                    content={getEntry(toDateString(dCurrent))}
                    readOnly={true} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/5 to-transparent pointer-events-none" />
                </div>
              </motion.div>
            )}

            {/* FLIP PREV ANIMATION (Left page flips to Right) */}
            {isFlipping === 'prev' && (
              <motion.div
                key="flip-prev"
                initial={{ rotateY: -180 }}
                animate={{ rotateY: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                onAnimationComplete={handleAnimationComplete}
                style={{ 
                  transformOrigin: 'right center', 
                  transformStyle: 'preserve-3d',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '50%',
                  zIndex: 50
                }}
              >
                {/* Front of Flipper (Visible initially on Left side - conceptually the back of D-1) */}
                <div 
                  className="absolute inset-0 w-full h-full rounded-l-lg overflow-hidden"
                  style={{ 
                    transform: 'rotateY(180deg)', 
                    backfaceVisibility: 'hidden' 
                  }}
                >
                  <PaperPage 
                    side="left"
                    date={dMinus1} 
                    content={getEntry(toDateString(dMinus1))}
                    readOnly={true}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/5 to-transparent pointer-events-none" />
                </div>

                {/* Back of Flipper (Visible after flip on Right side - conceptually Front of D-1) */}
                <div 
                  className="absolute inset-0 w-full h-full rounded-r-lg overflow-hidden"
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <PaperPage 
                    side="right"
                    date={dMinus1} 
                    content={getEntry(toDateString(dMinus1))}
                    readOnly={true} 
                  />
                  <div className="absolute inset-0 bg-gradient-to-l from-black/5 to-transparent pointer-events-none" />
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* THE SPINE (Visual Overlay) */}
          <div className="absolute top-[-2%] bottom-[-2%] left-1/2 -translate-x-1/2 w-12 md:w-16 bg-[#2d2d2d] rounded-md z-40 shadow-2xl flex items-center justify-center">
             <div className="w-[1px] h-[95%] bg-[#404040] shadow-[0_0_5px_black]" />
             {/* Stitching effect */}
             <div className="absolute top-4 w-full h-[2px] bg-[#444]" />
             <div className="absolute bottom-4 w-full h-[2px] bg-[#444]" />
          </div>

        </div>
      </div>

      {/* --- CONTROLS --- */}
      <div className="absolute bottom-8 z-50 flex items-center gap-6 bg-black/40 backdrop-blur-xl p-4 rounded-full border border-white/10 text-white shadow-2xl">
        <button 
          onClick={handlePrev}
          disabled={!!isFlipping}
          className="p-3 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex flex-col items-center min-w-[140px]">
          <span className="text-xs text-white/50 font-sans uppercase tracking-widest">Entry Date</span>
          <div className="flex items-center gap-2">
             <CalendarIcon size={14} className="text-teal-400" />
             <span className="font-serif text-lg">{formatDateDisplay(currentDate).split(',')[1]}</span>
          </div>
        </div>

        <button 
          onClick={handleNext}
          disabled={!!isFlipping}
          className="p-3 hover:bg-white/10 rounded-full transition-colors disabled:opacity-30"
        >
          <ChevronRight size={24} />
        </button>
      </div>

    </div>
  );
};
