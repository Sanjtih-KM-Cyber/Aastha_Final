import React, { useState, useEffect } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { useEncryption } from '../../context/EncryptionContext';
import { userService, MoodEntryDTO } from '../../services/userService';
import { Check, Grid, BarChart2, Sparkles, Book, MessageCircle } from 'lucide-react';
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
  { emoji: '🤩', label: 'Excited', score: 9 },
  { emoji: '🙂', label: 'Good', score: 7 },
  { emoji: '😌', label: 'Calm', score: 6 },
  { emoji: '😐', label: 'Neutral', score: 5 },
  { emoji: '😫', label: 'Tired', score: 4 },
  { emoji: '😔', label: 'Down', score: 3 },
  { emoji: '😰', label: 'Anxious', score: 2 },
  { emoji: '🤯', label: 'Overwhelmed', score: 1 },
  { emoji: '😡', label: 'Angry', score: 1 },
];

export const MoodTracker: React.FC<MoodTrackerProps> = ({ isOpen, onClose, onLogMood, zIndex, onFocus }) => {
  const { encrypt } = useEncryption();
  const { currentTheme } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'log' | 'trends' | 'insights'>('log');
  const [history, setHistory] = useState<MoodEntryDTO[]>([]);
  const [lastLogged, setLastLogged] = useState<typeof MOODS[0] | null>(null);
  
  // Insights State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisText, setAnalysisText] = useState("");

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen]);

  const fetchHistory = async () => {
    try {
      const data = await userService.getMoods();
      setHistory(data);
    } catch (e) { console.error(e); }
  };

  const handleLog = async (moodItem: typeof MOODS[0]) => {
    try {
      const encrypted = encrypt(moodItem.label);
      await userService.saveMood(encrypted, moodItem.score);
      setLastLogged(moodItem);
      if (onLogMood) onLogMood(moodItem.label);
      fetchHistory(); // Refresh trends immediately
    } catch (e) { console.error("Log failed", e); }
  };

  const handleAnalyze = (source: 'diary' | 'chat') => {
      setIsAnalyzing(true);
      setAnalysisText("");
      
      // Mock Analysis
      setTimeout(() => {
          setIsAnalyzing(false);
          const todaysEntry = history.find(h => new Date(h.timestamp || '').toDateString() === new Date().toDateString());
          const score = todaysEntry?.score || 5;

          if (score >= 6) {
              setAnalysisText(source === 'diary' 
                  ? "Your diary reflects so much strength. Keep riding this wave! 🌊" 
                  : "I love the energy in our chats. You're glowing today. ✨");
          } else {
              setAnalysisText(source === 'diary'
                  ? "It's okay to feel heavy. Your words matter, and so do you. 🤍"
                  : "I'm here to listen. Let's take it one breath at a time. 🌿");
          }
      }, 2000);
  };

  // Prepare Chart Data (Last 7 Days)
  const getChartData = () => {
      const days = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toDateString();
          
          const entry = history.find(h => new Date(h.timestamp || '').toDateString() === dateStr);
          days.push({
              name: d.toLocaleDateString('en-US', { weekday: 'short' }),
              score: entry ? entry.score : 0,
              fullDate: d.toLocaleDateString()
          });
      }
      return days;
  };

  const chartData = getChartData();

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Mood Tracker"
      initialWidth={360} initialHeight={580} defaultPosition={{ x: 200, y: 150 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
    >
      <div className="flex flex-col h-full w-full rounded-3xl overflow-hidden font-sans shadow-2xl">
        
        {/* --- TOP 50%: Dynamic Header --- */}
        <div 
            className="h-[50%] flex flex-col items-center justify-center p-6 relative transition-colors duration-700 ease-in-out text-center"
            style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #111827)` }}
        >
            <AnimatePresence mode="wait">
                {activeTab === 'log' && lastLogged ? (
                    <motion.div 
                        key="logged" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    >
                        <div className="text-8xl mb-4 filter drop-shadow-2xl">{lastLogged.emoji}</div>
                        <h2 className="font-serif text-3xl text-white">{lastLogged.label}</h2>
                    </motion.div>
                ) : activeTab === 'log' ? (
                    <motion.div key="header-log" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <h2 className="font-serif text-4xl text-white leading-tight">How is your <br/><span className="italic opacity-80">heart</span>?</h2>
                    </motion.div>
                ) : activeTab === 'trends' ? (
                    <motion.div key="header-trends" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        <h2 className="font-serif text-4xl text-white">Your Flow</h2>
                        <p className="text-white/60 mt-2 text-sm">Last 7 Days</p>
                    </motion.div>
                ) : (
                    <motion.div key="header-insights" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                        {isAnalyzing ? (
                            <div className="flex flex-col items-center gap-2">
                                <Sparkles className="animate-spin text-white/50" size={32} />
                                <span className="text-white/50 text-sm animate-pulse">Connecting to heart...</span>
                            </div>
                        ) : analysisText ? (
                            <p className="text-xl font-serif text-white italic leading-relaxed px-4">"{analysisText}"</p>
                        ) : (
                            <h2 className="font-serif text-4xl text-white">Aastha's<br/><span className="italic opacity-80">Wisdom</span></h2>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay pointer-events-none" />
        </div>

        {/* --- BOTTOM 50%: Controls --- */}
        <div className="h-[50%] bg-gray-900 flex flex-col p-4">
            
            {/* Navigation Tabs */}
            <div className="flex bg-white/5 p-1 rounded-xl mb-4 shrink-0 border border-white/10">
                {['log', 'trends', 'insights'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`
                            flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5
                            ${activeTab === tab ? 'bg-white text-black shadow-md' : 'text-white/40 hover:text-white'}
                        `}
                    >
                        {tab === 'log' && <Grid size={12}/>}
                        {tab === 'trends' && <BarChart2 size={12}/>}
                        {tab === 'insights' && <Sparkles size={12}/>}
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 relative overflow-hidden">
                <AnimatePresence mode="wait">
                    
                    {/* TAB 1: LOG */}
                    {activeTab === 'log' && (
                        <motion.div 
                            key="grid" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                            className="grid grid-cols-3 gap-2 h-full overflow-y-auto scrollbar-hide pb-2"
                        >
                            {MOODS.map((m) => {
                                const isSelected = lastLogged?.label === m.label;
                                return (
                                    <button
                                        key={m.label}
                                        onClick={() => handleLog(m)}
                                        className={`
                                            flex flex-col items-center justify-center p-2 rounded-xl transition-all border relative
                                            ${isSelected ? 'bg-white/10 border-white/30' : 'bg-white/5 border-transparent hover:bg-white/10'}
                                        `}
                                    >
                                        <span className="text-2xl mb-1 filter drop-shadow-md">{m.emoji}</span>
                                        <span className="text-[9px] text-white/60 font-medium uppercase">{m.label}</span>
                                        {isSelected && <div className="absolute top-1 right-1 text-green-400"><Check size={10}/></div>}
                                    </button>
                                )
                            })}
                        </motion.div>
                    )}

                    {/* TAB 2: TRENDS */}
                    {activeTab === 'trends' && (
                        <motion.div 
                            key="chart" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                            className="h-full w-full pt-4"
                        >
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <XAxis 
                                        dataKey="name" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} 
                                        dy={10}
                                    />
                                    <Tooltip 
                                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                        contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                                    />
                                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={currentTheme.primaryColor} fillOpacity={entry.score > 0 ? 0.8 : 0.1} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </motion.div>
                    )}

                    {/* TAB 3: INSIGHTS */}
                    {activeTab === 'insights' && (
                        <motion.div 
                            key="insights" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                            className="flex flex-col justify-center gap-4 h-full px-4"
                        >
                            <button 
                                onClick={() => handleAnalyze('diary')}
                                className="w-full py-4 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 rounded-2xl flex items-center justify-center gap-3 text-indigo-200 transition-all group"
                            >
                                <Book size={20} className="group-hover:scale-110 transition-transform"/>
                                <span className="font-bold">Analyze Diary</span>
                            </button>
                            <button 
                                onClick={() => handleAnalyze('chat')}
                                className="w-full py-4 bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 rounded-2xl flex items-center justify-center gap-3 text-teal-200 transition-all group"
                            >
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