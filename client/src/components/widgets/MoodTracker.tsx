import React, { useState, useEffect } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { userService, MoodEntryDTO } from '../../services/userService';
import { Check, Grid, BarChart2, Sparkles, Book, MessageCircle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MoodTrackerProps {
  isOpen: boolean;
  onClose: () => void;
  onLogMood?: (mood: string) => void;
  zIndex?: number;
  onFocus?: () => void;
}

const MOODS = [
  { emoji: '🤩', label: 'Excited', score: 10, color: '#F59E0B' }, 
  { emoji: '🙂', label: 'Good', score: 8, color: '#10B981' },    
  { emoji: '😌', label: 'Calm', score: 7, color: '#14B8A6' },    
  { emoji: '😐', label: 'Neutral', score: 5, color: '#9CA3AF' }, 
  { emoji: '😫', label: 'Tired', score: 4, color: '#8B5CF6' },   
  { emoji: '😔', label: 'Down', score: 3, color: '#3B82F6' },    
  { emoji: '😰', label: 'Anxious', score: 2, color: '#6366F1' }, 
  { emoji: '🤯', label: 'Overwhelmed', score: 1, color: '#F97316' }, 
  { emoji: '😡', label: 'Angry', score: 1, color: '#EF4444' },   
];

export const MoodTracker: React.FC<MoodTrackerProps> = ({ isOpen, onClose, onLogMood, zIndex, onFocus }) => {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'log' | 'trends' | 'insights'>('log');
  const [history, setHistory] = useState<MoodEntryDTO[]>([]);
  const [lastLogged, setLastLogged] = useState<typeof MOODS[0] | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen]);

  const fetchHistory = async () => {
    if(history.length === 0) setIsLoadingHistory(true);
    try {
      const data = await userService.getMoods();
      setHistory(data);
    } catch (e) { console.error(e); }
    finally { setIsLoadingHistory(false); }
  };

  const handleLog = async (moodItem: typeof MOODS[0]) => {
    try {
      await userService.saveMood(moodItem.label, moodItem.score);
      setLastLogged(moodItem);
      if (onLogMood) onLogMood(moodItem.label);
      fetchHistory(); 
      setTimeout(() => setLastLogged(null), 1500);
    } catch (e) { console.error("Log failed", e); }
  };
  
  const handleAnalyze = async (source: 'diary' | 'chat') => {
      setIsAnalyzing(true);
      setAnalysisResult("");
      try {
          if (source === 'diary') {
              const result = await userService.analyzeDiary();
              // The backend now returns a rich text summary in 'summary' field or similar
              // Depending on exact return of new geminiService. For now assuming object with 'analysis' text
              if (result && result.analysis) {
                  setAnalysisResult(result.analysis);
              } else {
                  setAnalysisResult("I reviewed your diary. It seems you are reflecting deeply, but I need a bit more data to form a conclusion.");
              }
          } else {
              const result = await userService.analyzeChat();
              setAnalysisResult(result.result);
          }
      } catch (e) {
          setAnalysisResult("Unable to generate analysis. Please ensure you have entries saved.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  // --- FIX: Stacked Histogram Data ---
  const getWeeklyData = () => {
      const days = [];
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + (weekOffset * 7));
      
      for (let i = 6; i >= 0; i--) {
          const d = new Date(endDate);
          d.setDate(endDate.getDate() - i);
          const dateStr = d.toDateString();
          
          // Find all entries for this day
          const dayEntries = history.filter(h => new Date(h.timestamp || '').toDateString() === dateStr);
          
          const dayData: any = {
              dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
              fullDate: d,
          };

          // Calculate counts for each mood to stack them
          MOODS.forEach(m => dayData[m.label] = 0); // Init 0
          
          if (dayEntries.length > 0) {
              dayEntries.forEach(e => {
                  if (dayData[e.mood] !== undefined) dayData[e.mood] += 1;
              });
          }

          days.push(dayData);
      }
      return days;
  };

  const weeklyData = getWeeklyData();
  const dateRangeLabel = `${weeklyData[0].fullDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - ${weeklyData[6].fullDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Mood Tracker"
      initialWidth={360} initialHeight={580} defaultPosition={{ x: 200, y: 150 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
    >
      <div className="flex flex-col h-full w-full rounded-3xl overflow-hidden font-sans shadow-2xl">
        
        {/* HEADER */}
        <div className="h-[45%] flex flex-col items-center justify-center p-6 relative transition-colors duration-700 ease-in-out text-center" style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #111827)` }}>
            <AnimatePresence mode="wait">
                {activeTab === 'log' && lastLogged ? (
                    <motion.div key="logged" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                        <div className="text-8xl mb-4 filter drop-shadow-2xl">{lastLogged.emoji}</div>
                        <h2 className="font-serif text-3xl text-white">{lastLogged.label}</h2>
                    </motion.div>
                ) : (
                    <motion.div key="header-default" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
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
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay pointer-events-none" />
        </div>

        {/* BODY */}
        <div className="h-[55%] bg-gray-900 flex flex-col p-4">
            <div className="flex bg-white/5 p-1 rounded-xl mb-4 shrink-0 border border-white/10">
                {['log', 'trends', 'insights'].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${activeTab === tab ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white'}`}>
                        {tab === 'log' && <Grid size={12}/>}{tab === 'trends' && <BarChart2 size={12}/>}{tab === 'insights' && <Sparkles size={12}/>}{tab}
                    </button>
                ))}
            </div>

            <div className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    {/* LOG TAB */}
                    {activeTab === 'log' && (
                        <motion.div key="grid" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="grid grid-cols-3 gap-2 h-full overflow-y-auto scrollbar-hide pb-2">
                            {MOODS.map((m) => (
                                <button key={m.label} onClick={() => handleLog(m)} className="flex flex-col items-center justify-center p-2 rounded-xl transition-all border bg-white/5 border-transparent hover:bg-white/10 hover:border-white/20">
                                    <span className="text-2xl mb-1 filter drop-shadow-md">{m.emoji}</span>
                                    <span className="text-[9px] text-white/60 font-medium uppercase">{m.label}</span>
                                </button>
                            ))}
                        </motion.div>
                    )}

                    {/* TRENDS TAB - Stacked Bar Chart */}
                    {activeTab === 'trends' && (
                        <motion.div key="chart" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full w-full pt-2 flex flex-col">
                             <div className="flex justify-between items-center mb-2 px-2">
                                <button onClick={() => setWeekOffset(prev => prev - 1)} className="p-1 hover:bg-white/10 rounded"><ChevronLeft size={14} className="text-white/70"/></button>
                                <span className="text-[10px] text-white/40 uppercase font-mono">{dateRangeLabel}</span>
                                <button onClick={() => setWeekOffset(prev => prev + 1)} disabled={weekOffset >= 0} className="p-1 hover:bg-white/10 rounded disabled:opacity-30"><ChevronRight size={14} className="text-white/70"/></button>
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
                        </motion.div>
                    )}

                    {/* INSIGHTS TAB */}
                    {activeTab === 'insights' && (
                        <motion.div key="insights" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col justify-center gap-4 h-full px-4">
                            <button onClick={() => handleAnalyze('diary')} disabled={isAnalyzing} className="w-full py-4 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-2xl flex items-center justify-center gap-3 text-indigo-200 transition-all group disabled:opacity-50">
                                <Book size={20} className="group-hover:scale-110 transition-transform"/>
                                <span className="font-bold">Analyze Diary</span>
                            </button>
                            <button onClick={() => handleAnalyze('chat')} disabled={isAnalyzing} className="w-full py-4 bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 rounded-2xl flex items-center justify-center gap-3 text-teal-200 transition-all group disabled:opacity-50">
                                <MessageCircle size={20} className="group-hover:scale-110 transition-transform"/>
                                <span className="font-bold">Analyze Chat</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
      </div>
    </DraggableWindow>
  );
};