import React, { useState, useEffect } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  Save, 
  Loader2, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle,
  RefreshCw,
  PenLine
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useEncryption } from '../../context/EncryptionContext';
import { useTheme } from '../../context/ThemeContext';
import { userService, DiaryEntryDTO } from '../../services/userService';
import { deriveKey } from '../../utils/encryptionUtils';

// --- Types ---
interface DiaryProps {
  isOpen: boolean;
  onClose: () => void;
  zIndex?: number;
  onFocus?: () => void;
}

type DiaryMode = 'view' | 'edit';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  hasEntry: boolean;
  isToday: boolean;
  isSelected: boolean;
}

// --- Helper Functions ---
const toDateString = (date: Date) => {
  // Use a reliable conversion that respects the local Date object's state
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
const getFormattedDate = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
const getShortDate = (dateStr: string) => new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// --- Sub-Components ---

/** Lock Screen */
const DiaryLockScreen: React.FC<{ onUnlock: (pwd: string) => void; error: string; setError: (err: string) => void; }> = ({ onUnlock, error, setError }) => {
  const { currentTheme } = useTheme();
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) { setError('Password required'); return; }
    onUnlock(input);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#1a1a1a] text-white rounded-b-xl p-8">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center max-w-md w-full">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,0,0,0.5)] border border-white/10" style={{ backgroundColor: `${currentTheme.primaryColor}20` }}>
          <Lock size={32} style={{ color: currentTheme.primaryColor }} />
        </div>
        <h2 className="text-3xl font-serif mb-2">Sanctuary Vault</h2>
        <p className="text-white/50 text-center mb-8 text-sm">Enter your unique diary password to decrypt your journal.</p>
        <form onSubmit={handleSubmit} className="w-full">
          <input type="password" value={input} onChange={(e) => { setInput(e.target.value); setError(''); }} placeholder="Enter Password..." className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-center text-white focus:outline-none focus:border-white/30 transition-all text-lg tracking-widest" autoFocus />
          {error && <p className="text-red-400 text-xs text-center mt-4 flex items-center justify-center gap-1"><AlertCircle size={12} /> {error}</p>}
          <button type="submit" className="w-full mt-8 py-3 rounded-xl font-medium text-sm tracking-wide transition-all hover:scale-[1.02] shadow-lg" style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, ${currentTheme.primaryColor}80)`, color: '#000' }}>UNLOCK</button>
        </form>
      </motion.div>
    </div>
  );
};

/** Paper Page */
const PaperPage: React.FC<{ 
  date: Date;
  title: string;
  content: string;
  mode: DiaryMode;
  isSaving: boolean;
  onTitleChange: (val: string) => void;
  onContentChange: (val: string) => void;
  onSave: () => void;
  onEdit: () => void;
  readOnly?: boolean;
}> = ({ date, title, content, mode, isSaving, onTitleChange, onContentChange, onSave, onEdit, readOnly }) => {
  const { currentTheme } = useTheme();
  const isEditing = mode === 'edit' && !readOnly;

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#fdfdf6]"
      style={{
        backgroundImage: `linear-gradient(90deg, transparent 2.9rem, #ef444420 3rem, transparent 3.1rem), linear-gradient(#e5e7eb 1px, transparent 1px)`,
        backgroundSize: '100% 2rem', backgroundAttachment: 'local'
      }}
    >
      {/* Header */}
      <div className="pt-8 px-8 pb-4 flex justify-between items-end border-b border-transparent">
        <div className="flex flex-col w-full">
           <span className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">{getFormattedDate(date)}</span>
           {isEditing ? (
             <input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Title (Optional)..." className="text-2xl font-serif font-bold bg-transparent border-none outline-none text-gray-800 placeholder-gray-300 w-full" />
           ) : (
             <h2 className="text-2xl font-serif font-bold text-gray-800 leading-tight">{title || "Untitled Entry"}</h2>
           )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 relative overflow-y-auto custom-scrollbar pl-14 pr-8 pb-8 pt-2">
        {isEditing ? (
          <textarea value={content} onChange={(e) => onContentChange(e.target.value)} placeholder="Write your thoughts here..." className="w-full h-full bg-transparent border-none outline-none resize-none text-gray-700 text-lg leading-[2rem] font-serif" spellCheck={false} />
        ) : (
          <div className="w-full min-h-full text-gray-800 text-lg leading-[2rem] font-serif whitespace-pre-wrap">
            {content || <span className="text-gray-300 italic">No content for this day.</span>}
          </div>
        )}
      </div>

      {/* Actions */}
      {!readOnly && (
        <div className="absolute bottom-6 right-8 flex items-center gap-3 z-20">
           {isEditing ? (
             <button onClick={onSave} disabled={isSaving} className="px-6 py-2 rounded-full text-white text-xs font-bold shadow-lg transition-transform hover:scale-105 active:scale-95 flex items-center gap-2" style={{ backgroundColor: currentTheme.primaryColor }}>
               {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} SAVE
             </button>
           ) : (
             <button onClick={onEdit} className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all shadow-md" title="Edit">
               <PenLine size={18} />
             </button>
           )}
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

export const Diary: React.FC<DiaryProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const { user, encryptionKey, setEncryptionKeyManual } = useAuth();
  const { encrypt, decrypt } = useEncryption();
  const { currentTheme } = useTheme();

  // State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authError, setAuthError] = useState('');
  const [entriesMap, setEntriesMap] = useState<Record<string, DiaryEntryDTO>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  // Navigation
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeDate, setActiveDate] = useState(new Date());
  
  // Animation
  const [isFlipping, setIsFlipping] = useState<'next' | 'prev' | null>(null);
  
  // Editor State
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMode, setEditMode] = useState<DiaryMode>('view');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
       if (!user.hasDiarySetup) setIsUnlocked(true); 
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && isUnlocked) fetchEntries();
  }, [isOpen, isUnlocked]);

  // When date changes, load data into editor state
  useEffect(() => {
      const dateKey = toDateString(activeDate);
      const entry = entriesMap[dateKey];
      if (entry) {
          setEditTitle(entry.title);
          setEditContent(entry.content);
          setEditMode('view');
      } else {
          setEditTitle('');
          setEditContent('');
          setEditMode('edit'); 
      }
  }, [activeDate, entriesMap]);

  // --- Actions ---

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const data = await userService.getDiaryEntries();
      
      const map: Record<string, DiaryEntryDTO> = {};
      data.forEach(entry => {
          try {
              const decrypted = {
                  ...entry,
                  title: decrypt(entry.title),
                  content: decrypt(entry.content)
              };
              if (entry.createdAt) {
                  const dateKey = toDateString(new Date(entry.createdAt));
                  map[dateKey] = decrypted;
              }
          } catch (e) { console.error("Decrypt error", e); }
      });
      setEntriesMap(map);
    } catch (error) { console.error("Diary fetch failed", error); } 
    finally { setIsLoading(false); }
  };

  const handleUnlock = (password: string) => {
    if (!user) return;
    const derived = deriveKey(password, user.email);
    
    if (encryptionKey && derived !== encryptionKey) {
       setAuthError("Incorrect Password");
       return;
    }
    if (!encryptionKey) setEncryptionKeyManual(derived);
    setIsUnlocked(true);
    setAuthError('');
  };

  const handleSaveEntry = async () => {
    // Fix: Allow saving if only content is present. Title is optional.
    if (!editContent.trim()) return;
    
    setIsSaving(true);
    try {
      const titleToSave = editTitle.trim() || "Untitled"; // Default Title
      const encTitle = encrypt(titleToSave);
      const encContent = encrypt(editContent);
      
      const saved = await userService.saveDiaryEntry({
        title: encTitle,
        content: encContent,
        tags: ['journal'],
        date: activeDate.toISOString()
      });
      
      const newEntry = { ...saved, title: titleToSave, content: editContent, createdAt: activeDate.toISOString() };
      
      setEntriesMap(prev => ({ ...prev, [toDateString(activeDate)]: newEntry }));
      setEditMode('view');
      
    } catch (e) {
      console.error("Save error", e);
      alert("Failed to save entry.");
    } finally {
      setIsSaving(false);
    }
  };

  const createNewEntry = () => {
    setActiveDate(new Date()); // Go to today
    setEditMode('edit');
  };

  // --- Navigation ---

  const changeMonth = (offset: number) => {
      const newDate = new Date(currentMonth);
      newDate.setMonth(newDate.getMonth() + offset);
      setCurrentMonth(newDate);
  };

  const changeDay = (offset: number) => {
      if (isFlipping) return;
      setIsFlipping(offset > 0 ? 'next' : 'prev');
  };

  const handleAnimationComplete = () => {
      if (isFlipping === 'next') setActiveDate(prev => addDays(prev, 1));
      if (isFlipping === 'prev') setActiveDate(prev => addDays(prev, -1));
      setIsFlipping(null);
  };
  
  const handleCalendarClick = (day: number) => {
      const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      setActiveDate(newDate);
  };

  // Animation Helpers
  const dMinus2 = addDays(activeDate, -2);
  const dMinus1 = addDays(activeDate, -1);
  const dCurrent = activeDate;
  const dPlus1 = addDays(activeDate, 1);

  // Calendar Logic
  const getCalendarDays = (): (CalendarDay | null)[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const resultDays: (CalendarDay | null)[] = [];
    const paddingDays = firstDay.getDay(); 
    
    for (let i = 0; i < paddingDays; i++) resultDays.push(null);

    const todayStr = toDateString(new Date());

    for (let d = 1; d <= lastDay.getDate(); d++) {
       const dateObj = new Date(year, month, d);
       const dateStr = toDateString(dateObj);
       const hasEntry = !!entriesMap[dateStr];
       const isToday = todayStr === dateStr;
       const isSelected = toDateString(activeDate) === dateStr;
       
       resultDays.push({
         date: dateObj,
         isCurrentMonth: true,
         hasEntry,
         isToday,
         isSelected
       });
    }
    return resultDays;
  };

  const calendarGrid = getCalendarDays();

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Personal Journal"
      initialWidth={900} initialHeight={650} defaultPosition={{ x: 100, y: 80 }}
      zIndex={zIndex || 20} onFocus={onFocus || (() => {})}
    >
      <div className="flex h-full w-full bg-[#222] text-gray-800 relative overflow-hidden rounded-b-xl shadow-inner font-sans items-center justify-center">
        
        {!isUnlocked ? (
          <DiaryLockScreen onUnlock={handleUnlock} error={authError} setError={setAuthError} />
        ) : (
            <div className="relative w-[95%] h-[90%] flex shadow-2xl rounded-r-lg perspective-2000">
                
                {/* Controls Overlay */}
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white z-50">
                    <button onClick={() => changeDay(-1)} disabled={!!isFlipping} className="p-2 hover:bg-white/10 rounded-full disabled:opacity-50"><ChevronLeft/></button>
                    <span className="font-mono text-sm w-32 text-center">{getFormattedDate(activeDate).split(',')[1]}</span>
                    <button onClick={() => changeDay(1)} disabled={!!isFlipping} className="p-2 hover:bg-white/10 rounded-full disabled:opacity-50"><ChevronRight/></button>
                </div>

                {/* BOOK CONTAINER */}
                <div className="relative flex w-full h-full shadow-2xl bg-[#2a2a2a] rounded-lg" style={{ perspective: '2500px', transformStyle: 'preserve-3d' }}>
                    
                    {/* STATIC LAYER */}
                    <div className="absolute inset-0 flex">
                        {/* Left Static Page (Calendar) */}
                        <div className="w-1/2 h-full border-r border-[#ccc] overflow-hidden rounded-l-lg bg-[#fdfdf6] flex flex-col">
                            
                            <div className="p-6 pb-2 flex items-center justify-between border-b border-gray-200/50">
                                <h3 className="font-serif text-2xl font-bold text-gray-800 flex items-center gap-2">
                                    <BookOpen size={22} style={{ color: currentTheme.primaryColor }} /> Index
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={() => fetchEntries()} className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500"><RefreshCw size={14}/></button>
                                    <button onClick={createNewEntry} className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-gray-400 hover:bg-gray-200 transition-colors">+ New</button>
                                </div>
                            </div>

                            {/* Calendar */}
                            <div className="px-6 py-4">
                                <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-200 rounded-full text-gray-600"><ChevronLeft size={16} /></button>
                                        <span className="text-sm font-bold uppercase tracking-widest text-gray-800">
                                            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                        </span>
                                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-200 rounded-full text-gray-600"><ChevronRight size={16} /></button>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 mb-2">
                                        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => <span key={i} className="text-center text-[10px] font-bold text-gray-400 uppercase">{d}</span>)}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 place-items-center">
                                        {calendarGrid.map((day, idx) => {
                                            if (!day) return <div key={`empty-${idx}`} className="w-8 h-8" />;
                                            return (
                                                <button
                                                    key={`day-${idx}`}
                                                    onClick={() => handleCalendarClick(day.date.getDate())}
                                                    className={`
                                                        w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all relative
                                                        ${day.isSelected ? 'bg-gray-800 text-white shadow-lg scale-110 z-10' : ''}
                                                        ${!day.isSelected && day.hasEntry ? 'bg-white border border-gray-300 text-gray-800 hover:border-gray-400' : ''}
                                                        ${!day.isSelected && !day.hasEntry ? 'text-gray-400 hover:bg-gray-200/50' : ''}
                                                        ${day.isToday && !day.isSelected ? 'ring-1 ring-offset-1 ring-teal-400' : ''}
                                                    `}
                                                >
                                                    {day.date.getDate()}
                                                    {day.hasEntry && !day.isSelected && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-teal-400" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            
                            {/* List */}
                            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Recent Memories</h4>
                                {Object.values(entriesMap).slice(0, 5).map((entry, i) => (
                                    <div key={i} onClick={() => { if(entry.createdAt) setActiveDate(new Date(entry.createdAt)) }} className="p-3 rounded-lg bg-white/40 hover:bg-white/80 cursor-pointer transition-colors border border-transparent hover:border-gray-300">
                                        <div className="flex justify-between"><span className="font-bold text-sm">{entry.title || 'Untitled'}</span><span className="text-[10px] text-gray-500">{getShortDate(entry.createdAt || '')}</span></div>
                                        <p className="text-xs text-gray-500 line-clamp-1 mt-1">{entry.content}</p>
                                    </div>
                                ))}
                            </div>

                        </div>

                        {/* Right Static Page (Current Editor) */}
                        <div className="w-1/2 h-full border-l border-[#ccc] overflow-hidden rounded-r-lg bg-[#fdfdf6]">
                             <PaperPage 
                                date={isFlipping === 'next' ? dPlus1 : activeDate}
                                title={isFlipping === 'next' ? entriesMap[toDateString(dPlus1)]?.title || '' : (editMode === 'view' ? entriesMap[toDateString(activeDate)]?.title : editTitle)}
                                content={isFlipping === 'next' ? entriesMap[toDateString(dPlus1)]?.content || '' : (editMode === 'view' ? entriesMap[toDateString(activeDate)]?.content : editContent)}
                                mode={isFlipping ? 'view' : editMode} 
                                isSaving={isSaving}
                                onTitleChange={setEditTitle} onContentChange={setEditContent} onSave={handleSaveEntry} onEdit={() => setEditMode('edit')} onCancel={() => setEditMode('view')} onMoodChange={() => {}}
                                readOnly={isFlipping !== null}
                             />
                        </div>
                    </div>

                    {/* FLIPPING LAYER */}
                    <AnimatePresence mode="sync" onExitComplete={() => setIsFlipping(null)}>
                        {isFlipping === 'next' && (
                             <motion.div
                                key="flip-next"
                                initial={{ rotateY: 0 }} animate={{ rotateY: -180 }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                                onAnimationComplete={handleAnimationComplete}
                                style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d', position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', zIndex: 50 }}
                             >
                                <div className="absolute inset-0 w-full h-full backface-hidden" style={{ backfaceVisibility: 'hidden' }}>
                                    <PaperPage date={activeDate} title={entriesMap[toDateString(activeDate)]?.title || ''} content={entriesMap[toDateString(activeDate)]?.content || ''} mode="view" isSaving={false} onTitleChange={()=>{}} onContentChange={()=>{}} onSave={()=>{}} onEdit={()=>{}} onCancel={()=>{}} onMoodChange={()=>{}} readOnly={true} />
                                    <div className="absolute inset-0 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                                </div>
                                <div className="absolute inset-0 w-full h-full rounded-l-lg overflow-hidden" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', background: '#fdfdf6' }}>
                                    <div className="flex-1 flex flex-col p-8"><h3 className="text-xl font-serif font-bold text-gray-400 mb-4">Navigation</h3><p className="text-gray-400 text-sm">Turning to {getFormattedDate(dPlus1)}...</p></div>
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                                </div>
                             </motion.div>
                        )}
                        {isFlipping === 'prev' && (
                             <motion.div
                                key="flip-prev"
                                initial={{ rotateY: -180 }} animate={{ rotateY: 0 }}
                                transition={{ duration: 0.6, ease: "easeInOut" }}
                                onAnimationComplete={handleAnimationComplete}
                                style={{ transformOrigin: 'right center', transformStyle: 'preserve-3d', position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', zIndex: 50 }}
                             >
                                <div className="absolute inset-0 w-full h-full rounded-l-lg overflow-hidden" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', background: '#fdfdf6' }}>
                                    <PaperPage date={dMinus1} title={entriesMap[toDateString(dMinus1)]?.title || ''} content={entriesMap[toDateString(dMinus1)]?.content || ''} mode="view" isSaving={false} onTitleChange={()=>{}} onContentChange={()=>{}} onSave={()=>{}} onEdit={()=>{}} onCancel={()=>{}} onMoodChange={()=>{}} readOnly={true} />
                                    <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                                </div>
                                <div className="absolute inset-0 w-full h-full rounded-r-lg overflow-hidden" style={{ backfaceVisibility: 'hidden', background: '#fdfdf6' }}>
                                     <div className="flex-1 flex flex-col p-8"><h3 className="text-xl font-serif font-bold text-gray-400 mb-4">Navigation</h3><p className="text-gray-400 text-sm">Turning back...</p></div>
                                    <div className="absolute inset-0 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                                </div>
                             </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="absolute left-1/2 top-0 bottom-0 w-16 -ml-8 z-40 flex justify-center">
                        <div className="w-[2px] h-full bg-[#1a1a1a] shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                    </div>
                </div>
            </div>
        )}
      </div>
    </DraggableWindow>
  );
};
