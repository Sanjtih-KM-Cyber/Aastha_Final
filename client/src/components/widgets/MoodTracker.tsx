import React, { useState, useEffect, useMemo } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { userService, MoodEntryDTO } from '../../services/userService';
import { Check, Grid, BarChart2, Sparkles, Book, MessageCircle, ChevronLeft, ChevronRight, Loader2, Smile, RefreshCw } from 'lucide-react';
import { Icons } from '../../design/icons';
import { useTheme } from '../../context/ThemeContext';
import { useEncryption } from '../../context/EncryptionContext';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Segmented, IconButton, ListGroup, ListItem } from '../../design/ui';
import api from '../../services/api';
import { deviceTimeZone } from '../../utils/timeZone';
import { AddMoodSheet, CustomMood, moodColorForScore } from './AddMoodSheet';
import { Plus } from 'lucide-react';

type MoodItem = { emoji: string; label: string; score: number; color: string; customId?: string };

/** Server: GET /data/moods/insights — 7-day averages + at most one honest pattern (7.4) */
interface MoodInsights { week: { day: string; label: string; score: number | null }[]; insight: string | null; daysLogged28: number; note: string }

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

/**
 * Tab content wrapper. MUST live at module level: it used to be defined inside MoodTracker, so every
 * re-render (history/insights/custom moods loading, logging a mood) created a new component type and React
 * tore down + rebuilt the whole tab — the "keeps refreshing" bug and the lag on Trends.
 */
const TransitionWrapper: React.FC<{ children: React.ReactNode; className?: string; lite?: boolean }> = ({ children, className, lite }) => {
  if (lite) return <div className={className}>{children}</div>;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className={className}>
      {children}
    </motion.div>
  );
};

export const MoodTracker: React.FC<MoodTrackerProps> = ({ isOpen, onClose, onLogMood, zIndex, onFocus, persistenceKey }) => {
  const { currentTheme, isLowPowerMode } = useTheme();
  const { decrypt } = useEncryption();
  const [activeTab, setActiveTab] = useState<'log' | 'trends' | 'insights'>('log');
  const [history, setHistory] = useState<MoodEntryDTO[]>([]);
  const [lastLogged, setLastLogged] = useState<MoodItem | null>(null);
  // Your own mood types (synced to your account; names encrypted on the server)
  const [customMoods, setCustomMoods] = useState<CustomMood[]>([]);
  const [showAddMood, setShowAddMood] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    api.get('/data/moods/custom').then(r => setCustomMoods(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [isOpen]);
  const allMoods: MoodItem[] = useMemo(() => [
    ...MOODS,
    ...customMoods.filter(c => !MOODS.some(m => m.label.toLowerCase() === c.label.toLowerCase()))
      .map(c => ({ emoji: c.emoji, label: c.label, score: c.score, color: moodColorForScore(c.score), customId: c.id })),
  ], [customMoods]);
  const addCustomMood = async (m: { label: string; emoji: string; score: number }) => {
    try {
      const r = await api.post('/data/moods/custom', m);
      setCustomMoods(prev => [...prev, r.data]);
      setShowAddMood(false);
      setActiveTab('log');
      toast.success(`${r.data.emoji} ${r.data.label} added — tap it to log`);
      return null;
    } catch (e: any) {
      return e?.response?.data?.message || 'Could not save. Please try again.';
    }
  };
  const deleteCustomMood = async (id: string) => {
    const prev = customMoods;
    setCustomMoods(cs => cs.filter(c => c.id !== id));
    try { await api.delete(`/data/moods/custom/${id}`); } catch { setCustomMoods(prev); }
  };
  const [weekOffset, setWeekOffset] = useState(0);
  
  // Loading States
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoggingLabel, setIsLoggingLabel] = useState<string | null>(null); // Track WHICH mood is saving
  
  const [analysisResult, setAnalysisResult] = useState<string>("");
  const [insights, setInsights] = useState<MoodInsights | null>(null);
  useEffect(() => {
    if (!isOpen || activeTab !== 'trends') return;
    api.get('/data/moods/insights', { params: { tz: deviceTimeZone() } }).then(r => setInsights(r.data)).catch(() => setInsights(null));
  }, [isOpen, activeTab, history.length]);
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

  const handleLog = async (moodItem: MoodItem) => {
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
          allMoods.forEach(m => dayData[m.label] = 0);
          
          // Match history entries
          history.forEach(h => {
              if (!h.timestamp || !h.mood) return;
              
              const hDate = new Date(h.timestamp);
              // Compare Local Dates
              if (hDate.toDateString() === dateStr) {
                   // Case-Insensitive Matching
                   const moodConfig = allMoods.find(m => m.label.toLowerCase() === h.mood.toLowerCase());
                   if (moodConfig) {
                       dayData[moodConfig.label] += 1;
                   }
              }
          });

          days.push(dayData);
      }
      return days;
  }, [history, weekOffset, allMoods]);

  const chartMoods = useMemo(() => allMoods.filter(m => weeklyData.some((d: any) => d[m.label] > 0)), [allMoods, weeklyData]);
  const dateRangeLabel = `${weeklyData[0].fullDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} - ${weeklyData[6].fullDate.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}`;

  return (
    <DraggableWindow
      isOpen={isOpen} onClose={onClose} title="Mood"
      initialWidth={380} initialHeight={620} defaultPosition={{ x: 200, y: 150 }}
      zIndex={zIndex || 10} onFocus={onFocus || (() => {})}
      icon={Icons.mood}
      persistenceKey={persistenceKey}
    >
      <div className="flex flex-col h-full w-full font-sans px-3 pb-3 gap-3">

        {/* HERO — tonal primary container (content layer) */}
        <div className="shrink-0 rounded-[28px] bg-md-primary-container text-md-on-primary-container px-5 py-5 min-h-[148px] flex flex-col justify-center relative overflow-hidden">
          <div aria-hidden className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-md-primary/20" />
          <AnimatePresence mode={isLowPowerMode ? undefined : 'wait'}>
            {activeTab === 'log' && lastLogged ? (
              <TransitionWrapper lite={isLowPowerMode} key="logged" className="relative flex items-center gap-4">
                <span className="text-6xl leading-none drop-shadow">{lastLogged.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-md-primary text-md-on-primary text-[11px] font-medium"><Check size={12} /> Logged</span>
                  <span className="block font-serif text-2xl mt-1 truncate">{lastLogged.label}</span>
                  <button onClick={() => setLastLogged(null)} className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium underline-offset-2 hover:underline">
                    <RefreshCw size={12} /> Log another
                  </button>
                </span>
              </TransitionWrapper>
            ) : (
              <TransitionWrapper lite={isLowPowerMode} key={`hero-${activeTab}`} className="relative">
                {activeTab === 'insights' ? (
                  <>
                    <p className="text-xs font-medium opacity-80">AI reflection</p>
                    <h2 className="font-serif text-2xl mt-0.5">Deep insights</h2>
                    {isAnalyzing && <div className="mt-3 flex items-center gap-2 text-sm"><Loader2 size={16} className="animate-spin" /> Reading gently…</div>}
                    {!isAnalyzing && analysisResult && <p className="mt-2 text-sm leading-relaxed max-h-28 overflow-y-auto custom-scrollbar">“{analysisResult}”</p>}
                    {!isAnalyzing && !analysisResult && <p className="mt-2 text-sm opacity-80">Choose what to look at below.</p>}
                  </>
                ) : activeTab === 'trends' ? (
                  <>
                    <p className="text-xs font-medium opacity-80">{dateRangeLabel}</p>
                    <h2 className="font-serif text-2xl mt-0.5">Your flow</h2>
                    {insights?.insight && <p className="mt-2 text-sm leading-snug">{insights.insight}</p>}
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium opacity-80">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                    <h2 className="font-serif text-3xl leading-tight mt-0.5">How is your <span className="italic">heart</span>?</h2>
                  </>
                )}
              </TransitionWrapper>
            )}
          </AnimatePresence>
        </div>

        <Segmented
          className="shrink-0"
          value={activeTab}
          onChange={(v) => setActiveTab(v)}
          options={[
            { value: 'log', label: 'Log', icon: <Grid size={14} /> },
            { value: 'trends', label: 'Trends', icon: <BarChart2 size={14} /> },
            { value: 'insights', label: 'Insights', icon: <Sparkles size={14} /> },
          ]}
        />

        <div className="flex-1 min-h-0 relative overflow-hidden">
          <AnimatePresence>
            {showAddMood && (
              <AddMoodSheet custom={customMoods} onAdd={addCustomMood} onDelete={deleteCustomMood} onClose={() => setShowAddMood(false)} />
            )}
          </AnimatePresence>
          <AnimatePresence mode={isLowPowerMode ? undefined : 'wait'}>
            {/* LOG */}
            {activeTab === 'log' && (
              <TransitionWrapper lite={isLowPowerMode} key="grid" className="h-full">
                <div className="grid grid-cols-3 gap-2 h-full overflow-y-auto scrollbar-hide pb-1 content-start">
                  {allMoods.map((m) => {
                    const isSavingThis = isLoggingLabel === m.label;
                    const isSavingAny = isLoggingLabel !== null;
                    const isLast = lastLogged?.label === m.label;
                    return (
                      <button
                        key={m.label}
                        onClick={() => handleLog(m)}
                        disabled={isSavingAny}
                        aria-label={`Log mood: ${m.label}`}
                        className={`flex flex-col items-center justify-center gap-1 py-3 rounded-[20px] transition-all duration-200 ease-md-emphasized
                          ${isLast ? 'bg-md-secondary-container text-md-on-secondary-container' : 'bg-md-surface-container hover:bg-md-surface-container-high text-md-on-surface'}
                          ${isSavingAny ? 'opacity-50' : 'active:scale-95'}`}
                      >
                        {isSavingThis ? <Loader2 className="animate-spin text-md-primary" size={28} /> : <span className="text-3xl leading-none">{m.emoji}</span>}
                        <span className="text-[11px] font-medium">{m.label}</span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setShowAddMood(true)}
                    aria-label="Add your own mood"
                    className="flex flex-col items-center justify-center gap-1 py-3 rounded-[20px] border-2 border-dashed border-md-outline-variant text-md-on-surface-variant hover:bg-md-on-surface/[0.06] active:scale-95 transition"
                  >
                    <Plus size={26} />
                    <span className="text-[11px] font-medium">Add mood</span>
                  </button>
                </div>
              </TransitionWrapper>
            )}

            {/* TRENDS */}
            {activeTab === 'trends' && (
              <TransitionWrapper lite={isLowPowerMode} key="chart" className="h-full w-full flex flex-col gap-2">
                <div className="flex items-center justify-between shrink-0">
                  <IconButton label="Previous week" onClick={() => setWeekOffset(prev => prev - 1)}><ChevronLeft size={18} /></IconButton>
                  <span className="text-xs font-medium text-md-on-surface-variant">{weekOffset === 0 ? 'This week' : dateRangeLabel}</span>
                  <IconButton label="Next week" onClick={() => setWeekOffset(prev => prev + 1)} disabled={weekOffset >= 0}><ChevronRight size={18} /></IconButton>
                </div>

                {weekOffset === 0 && insights && (
                  <div className="shrink-0 rounded-[20px] bg-md-surface-container p-3" data-testid="mood-insight">
                    <div className="flex items-end justify-between gap-1.5 h-12" aria-label="Your average mood each day this week">
                      {insights.week.map(d => (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1" title={d.score === null ? `${d.label}: not logged` : `${d.label}: ${d.score}/10`}>
                          <div className="w-full max-w-[22px] rounded-full bg-md-surface-container-highest relative overflow-hidden" style={{ height: 32 }}>
                            {d.score !== null && <div className="absolute bottom-0 inset-x-0 rounded-full bg-md-primary" style={{ height: `${Math.max(12, d.score * 10)}%` }} />}
                          </div>
                          <span className="text-[10px] text-md-on-surface-variant">{d.label.slice(0, 2)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-md-on-surface leading-relaxed">
                      {insights.insight || (insights.daysLogged28 < 6
                        ? 'Log your mood on a few more days and a pattern may show up here — no pressure.'
                        : 'No clear pattern yet — your week looks fairly steady.')}
                    </p>
                    <p className="mt-1 text-[10px] text-md-on-surface-variant">{insights.note}</p>
                  </div>
                )}

                <div className="flex-1 min-h-[120px] rounded-[20px] bg-md-surface-container p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 10, bottom: 0, left: 0, right: 0 }}>
                      <XAxis dataKey="dayLabel" axisLine={false} tickLine={false} tick={{ fill: 'rgb(var(--md-on-surface-variant))', fontSize: 10 }} dy={5} />
                      <Tooltip cursor={{ fill: 'rgb(var(--md-on-surface) / 0.06)' }} contentStyle={{ backgroundColor: 'rgb(var(--md-surface-container-highest))', border: 'none', borderRadius: 12, color: 'rgb(var(--md-on-surface))', fontSize: '11px' }} />
                      {chartMoods.map((m) => (
                        <Bar key={m.label} dataKey={m.label} stackId="a" fill={m.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TransitionWrapper>
            )}

            {/* INSIGHTS */}
            {activeTab === 'insights' && (
              <TransitionWrapper lite={isLowPowerMode} key="insights" className="h-full flex flex-col gap-2">
                <ListGroup>
                  <ListItem icon={<Book size={18} />} title="Reflect on my diary" subtitle="A gentle read of your recent entries" onClick={isAnalyzing ? undefined : () => handleAnalyze('diary')} />
                  <ListItem icon={<MessageCircle size={18} />} title="Reflect on our chats" subtitle="Themes from what you've shared lately" onClick={isAnalyzing ? undefined : () => handleAnalyze('chat')} />
                </ListGroup>
                <p className="px-2 text-[11px] text-md-on-surface-variant">An AI reflection, not a diagnosis.</p>
              </TransitionWrapper>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DraggableWindow>
  );
};
