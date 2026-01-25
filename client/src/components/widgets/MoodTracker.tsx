import React, { useState, useEffect, useMemo } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { userService, MoodEntryDTO } from '../../services/userService';
import { Check, Grid, BarChart2, Sparkles, Book, MessageCircle, ChevronLeft, ChevronRight, Loader2, Smile, RefreshCw } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useEncryption } from '../../context/EncryptionContext';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface MoodTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  onLogMood?: (mood: string) => void;
  zIndex?: number;
  onFocus?: () => void;
  persistenceKey?: string;
}

// ==========================================
// MOOD CONFIGURATION
// ==========================================
const MOODS = [
  // High Positives (8-10)
  { emoji: '🤩', label: 'Excited', score: 10, color: '#F59E0B' },
  { emoji: '🥰', label: 'Love', score: 10, color: '#EC4899' },
  { emoji: '🦁', label: 'Proud', score: 9, color: '#F59E0B' },
  { emoji: '🙏', label: 'Grateful', score: 9, color: '#8B5CF6' },
  { emoji: '🙂', label: 'Good', score: 8, color: '#10B981' },
  { emoji: '🕊️', label: 'Peaceful', score: 8, color: '#60A5FA' },

  // Neutrals (4-7)
  { emoji: '😌', label: 'Calm', score: 7, color: '#14B8A6' },
  { emoji: '😐', label: 'Neutral', score: 5, color: '#9CA3AF' },
  { emoji: '😫', label: 'Tired', score: 4, color: '#8B5CF6' },

  // Negatives (1-3)
  { emoji: '😔', label: 'Down', score: 3, color: '#3B82F6' },
  { emoji: '😟', label: 'Anxious', score: 2, color: '#6366F1' },
  { emoji: '🌵', label: 'Lonely', score: 2, color: '#64748B' },
  { emoji: '😣', label: 'Guilty', score: 2, color: '#F43F5E' },
  { emoji: '🤯', label: 'Stressed', score: 1, color: '#F97316' }, 
  { emoji: '😡', label: 'Angry', score: 1, color: '#EF4444' },
  { emoji: '🌧️', label: 'Depressed', score: 1, color: '#1E293B' },
  { emoji: '😶', label: 'Numb', score: 1, color: '#475569' },
];

export const MoodTracker: React.FC<MoodTrackerProps> = ({ isOpen, onClose, onLogMood, zIndex, onFocus, persistenceKey }) => {
  const { currentTheme, isLowPowerMode } = useTheme();
  const { decrypt } = useEncryption();
  const [activeTab, setActiveTab] = useState<'log' | 'trends' | 'insights'>('log');
  const [history, setHistory] = useState<MoodEntryDTO[]>([]);
  const [lastLogged, setLastLogged] = useState<typeof MOODS[0] | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  
  // Loading States
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoggingLabel, setIsLoggingLabel] = useState<string | null>(null); // Track WHICH mood is saving
  
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (isOpen) {
        fetchHistory();

        // Listen for background sync (Optimistic UI -> Server Confirmation)
        const handleSync = () => {
             console.log("[MoodTracker] Background sync detected, refreshing...");
             fetchHistory();
        };

        window.addEventListener('mood-synced', handleSync);
        window.addEventListener('online', handleSync);

        return () => {
            window.removeEventListener('mood-synced', handleSync);
            window.removeEventListener('online', handleSync);
        };
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    // Only show spinner on initial load, not background refreshes
    if (history.length === 0) setIsLoadingHistory(true);
    try {
      const data = await userService.getMoods();
      // MERGE: Combine server data with local offline queue to show EVERYTHING
      const combined = userService.getCombinedMoodHistory(Array.isArray(data) ? data : []);
      setHistory(combined);
    } catch (e) { 
        console.error("Failed to fetch history:", e); 
    } finally { 
        setIsLoadingHistory(false); 
    }
  };

  const handleLog = async (moodItem: typeof MOODS[0]) => {
    // 1. BLOCK UI - START LOADING (User requested visibility over blind speed)
    setIsLoggingLabel(moodItem.label);

    try {
        // 2. ROBUST SAVE: Try online, fallback to offline, return result
        // We await this so the UI reflects the actual save state
        const savedEntry = await userService.saveMoodWithRetry(moodItem.label, moodItem.score);

        // 3. INSTANT UPDATE: Update local history immediately without waiting for fetch
        // This makes the chart update instantly
        setHistory(prev => {
            const newHistory = [...prev, savedEntry];
            // Re-sort by timestamp
            return newHistory.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
        });

        // 4. SHOW SUCCESS SCREEN
        setLastLogged(moodItem);
        if (onLogMood) onLogMood(moodItem.label);

        // 5. BACKGROUND SYNC (Just to be sure)
        // fetchHistory();

    } catch (e) {
        console.error("Log failed", e);
        // Even if catastrophic failure, we might want to alert, but saveMoodWithRetry handles most cases
    } finally {
        // 6. UNBLOCK UI
        setIsLoggingLabel(null);
    }
  };
  
  const handleAnalyze = async (source: 'diary' | 'chat') => {
      setIsAnalyzing(true);
      setAnalysisResult("");
      try {
          if (source === 'diary') {
              const entries = await userService.getDiaryEntries();
              const recentText = entries.slice(0, 5).map(e => {
                  try { return decrypt(e.content); } catch { return ""; }
              }).join("\n");

              if (!recentText.trim()) {
                  setAnalysisResult("Your diary seems empty or locked. Please write something first.");
                  return;
              }

              const result = await userService.analyzeDiary({ content: recentText });
              setAnalysisResult(result?.analysis || "Needs more data.");
          } else {
              const result = await userService.analyzeChat();
              setAnalysisResult(result.result);
          }
      } catch (e) {
          setAnalysisResult("Unable to generate analysis.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  // ==========================================
  // CHART DATA CALCULATION (Robust Date Matching)
  // ==========================================
  const weeklyData = useMemo(() => {
      const days = [];
      const today = new Date();
      // Normalize today to start of day to avoid time-shift bugs
      today.setHours(0,0,0,0); 
      
      // Calculate end date based on offset
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + (weekOffset * 7));
      
      // Generate last 7 days from endDate backwards
      for (let i = 6; i >= 0; i--) {
          const d = new Date(endDate);
          d.setDate(endDate.getDate() - i);
          
          const dateStr = d.toDateString(); // e.g., "Mon Jan 01 2024"
          
          const dayData: any = {
              dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
              fullDate: d,
          };

          // Initialize all moods to 0
          MOODS.forEach(m => dayData[m.label] = 0);
          
          // Match history entries
          history.forEach(h => {
              if (!h.timestamp || !h.mood) return;
              
              const hDate = new Date(h.timestamp);
              // Compare Local Dates
              if (hDate.toDateString() === dateStr) {
                   // Case-Insensitive Matching
                   const moodConfig = MOODS.find(m => m.label.toLowerCase() === h.mood.toLowerCase());
                   if (moodConfig) {
                       dayData[moodConfig.label] += 1;
                   }
              }
          });

          days.push(dayData);
      }
      return days;
  }, [history, weekOffset]);

  const dateRangeLabel = `${weeklyData[0].fullDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - ${weeklyData[6].fullDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;

  // LITE MODE WRAPPER
  const TransitionWrapper: React.FC<{children: React.ReactNode, className?: string}> = ({children, className}) => {
      if (isLowPowerMode) return <div className={className}>{children}</div>;
      return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={className}
          >
              {children}
          </motion.div>
      );
  };

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Mood Tracker"
      initialWidth={360} initialHeight={580} defaultPosition={{ x: 200, y: 150 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
      icon={Smile}
      color="#F97316"
      persistenceKey={persistenceKey}
    >
      <div className="flex flex-col h-full w-full rounded-3xl overflow-hidden font-sans shadow-2xl bg-[#111827]">
        
        {/* HEADER */}
        <div className={`h-[40%] flex flex-col items-center justify-center p-6 relative transition-colors duration-700 ease-in-out text-center`} style={{ background: isLowPowerMode ? currentTheme.primaryColor : `linear-gradient(135deg, ${currentTheme.primaryColor}, #111827)` }}>
            <AnimatePresence mode={isLowPowerMode ? undefined : "wait"}>
                {activeTab === 'log' && lastLogged ? (
                    <TransitionWrapper key="logged" className="flex flex-col items-center">
                        <div className="text-8xl mb-4 filter drop-shadow-2xl animate-bounce-short">{lastLogged.emoji}</div>
                        <h2 className="font-serif text-3xl text-white font-bold">{lastLogged.label}</h2>
                        <div className="mt-2 px-3 py-1 bg-white/20 rounded-full text-xs font-medium text-white/90">
                            Logged Successfully
                        </div>
                        <button onClick={() => setLastLogged(null)} className="mt-6 flex items-center gap-2 text-white/60 hover:text-white text-xs uppercase tracking-widest font-bold cursor-pointer z-10">
                            <RefreshCw size={12} /> Log Another
                        </button>
                    </TransitionWrapper>
                ) : (
                    <TransitionWrapper key="header-default" className="w-full">
                         {activeTab === 'insights' ? (
                             <div className="px-4">
                                 <h2 className="font-serif text-2xl text-white mb-2">Deep Insights</h2>
                                 {isAnalyzing && <div className="flex justify-center"><Loader2 className="animate-spin text-white/50"/></div>}
                                 {!isAnalyzing && analysisResult && <p className="text-sm text-white/90 italic leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">"{analysisResult}"</p>}
                                 {!isAnalyzing && !analysisResult && <p className="text-sm text-white/60">Select a source below to analyze.</p>}
                             </div>
                         ) : activeTab === 'trends' ? (
                             <div className="w-full">
                                <h2 className="font-serif text-3xl text-white mb-4">Your Flow</h2>
                             </div>
                         ) : (
                             <h2 className="font-serif text-4xl text-white leading-tight">How is your <br/><span className="italic opacity-80">heart</span>?</h2>
                         )}
                    </TransitionWrapper>
                )}
            </AnimatePresence>
            {!isLowPowerMode && <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay pointer-events-none" />}
        </div>

        {/* BODY */}
        <div className="h-[60%] bg-[#0B0F17] flex flex-col p-4">
            <div className="flex bg-white/5 p-1 rounded-xl mb-4 shrink-0 border border-white/10">
                {['log', 'trends', 'insights'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === tab ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white'}`}>
                        {tab === 'log' && <Grid size={12}/>}{tab === 'trends' && <BarChart2 size={12}/>}{tab === 'insights' && <Sparkles size={12}/>}{tab}
                    </button>
                ))}
            </div>

            <div className="flex-1 relative overflow-hidden">
                <AnimatePresence mode={isLowPowerMode ? undefined : "wait"}>
                    {/* LOG TAB */}
                    {activeTab === 'log' && (
                        <TransitionWrapper key="grid" className="h-full">
                            <div className="grid grid-cols-3 gap-2 h-full overflow-y-auto scrollbar-hide pb-2 content-start">
                                {MOODS.map((m) => {
                                    const isSavingThis = isLoggingLabel === m.label;
                                    const isSavingAny = isLoggingLabel !== null;
                                    
                                    return (
                                        <button
                                            key={m.label}
                                            onClick={() => handleLog(m)}
                                            disabled={isSavingAny}
                                            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all border bg-white/5 border-transparent ${
                                                isSavingAny ? 'opacity-50 cursor-not-allowed' : 'active:scale-95 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                        >
                                            {isSavingThis ? (
                                                <Loader2 className="animate-spin text-white/50 mb-1" size={30} />
                                            ) : (
                                                <span className="text-3xl mb-1 filter drop-shadow-md">{m.emoji}</span>
                                            )}
                                            <span className="text-[10px] text-white/60 font-medium uppercase tracking-wide">{m.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </TransitionWrapper>
                    )}

                    {/* TRENDS TAB - Stacked Bar Chart */}
                    {activeTab === 'trends' && (
                        <TransitionWrapper key="chart" className="h-full w-full pt-2 flex flex-col">
                             <div className="flex justify-between items-center mb-2 px-2 select-none">
                                <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-2 hover:bg-white/10 rounded cursor-pointer z-10"><ChevronLeft size={16} className="text-white/70"/></button>
                                <span className="text-[10px] text-white/40 uppercase font-mono">{dateRangeLabel}</span>
                                <button onClick={() => setWeekOffset(prev => prev + 1)} disabled={weekOffset >= 0} className="p-2 hover:bg-white/10 rounded disabled:opacity-30 cursor-pointer z-10"><ChevronRight size={16} className="text-white/70"/></button>
                             </div>
                             
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={weeklyData} margin={{top: 10, bottom: 0}}>
                                    <XAxis dataKey="dayLabel" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} dy={5} />
                                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#000', border: '1px solid #333', color: '#fff', fontSize: '10px' }} />
                                    {/* Render a Bar for each mood type to create a stack */}
                                    {MOODS.map((m) => (
                                        <Bar key={m.label} dataKey={m.label} stackId="a" fill={m.color} radius={[2, 2, 0, 0]} />
                                    ))}
                                </BarChart>
                             </ResponsiveContainer>
                        </TransitionWrapper>
                    )}

                    {/* INSIGHTS TAB */}
                    {activeTab === 'insights' && (
                        <TransitionWrapper key="insights" className="flex flex-col justify-center gap-4 h-full px-4">
                            <button onClick={() => handleAnalyze('diary')} disabled={isAnalyzing} className="w-full py-4 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-2xl flex items-center justify-center gap-3 text-indigo-200 transition-all group disabled:opacity-50 active:scale-95">
                                <Book size={20} className="group-hover:scale-110 transition-transform"/>
                                <span className="font-bold">Analyze Diary</span>
                            </button>
                            <button onClick={() => handleAnalyze('chat')} disabled={isAnalyzing} className="w-full py-4 bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 rounded-2xl flex items-center justify-center gap-3 text-teal-200 transition-all group disabled:opacity-50 active:scale-95">
                                <MessageCircle size={20} className="group-hover:scale-110 transition-transform"/>
                                <span className="font-bold">Analyze Chat</span>
                            </button>
                        </TransitionWrapper>
                    )}
                </AnimatePresence>
            </div>
        </div>
      </div>
    </DraggableWindow>
  );
};
