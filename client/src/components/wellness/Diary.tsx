import React, { useState, useEffect, useRef } from 'react';
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
  PenLine,
  Calendar,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useEncryption } from '../../context/EncryptionContext';
import { useTheme } from '../../context/ThemeContext';
import { userService, DiaryEntryDTO } from '../../services/userService';

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

const toDateString = (date: Date) => {
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

const DiaryLockScreen: React.FC<{ onUnlock: (pwd: string) => void; error: string; setError: (err: string) => void; }> = ({ onUnlock, error, setError }) => {
  const { currentTheme } = useTheme();
  const [input, setInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
        <form onSubmit={handleSubmit} className="w-full relative">
          <div className="relative">
              <input
                  type={showPassword ? "text" : "password"}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(''); }}
                  placeholder="Enter Password..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-center text-white focus:outline-none focus:border-white/30 transition-all text-lg tracking-widest pr-12"
                  autoFocus
              />
              <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
          </div>

          {error && <p className="text-red-400 text-xs text-center mt-4 flex items-center justify-center gap-1"><AlertCircle size={12} /> {error}</p>}
          <button type="submit" className="w-full mt-8 py-3 rounded-xl font-medium text-sm tracking-wide transition-all hover:scale-[1.02] shadow-lg" style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, ${currentTheme.primaryColor}80)`, color: '#000' }}>UNLOCK</button>
        </form>
      </motion.div>
    </div>
  );
};

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
      <div className="pt-8 px-8 pb-4 flex justify-between items-start border-b border-transparent">
        <div className="flex flex-col w-full">
           <span className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">{getFormattedDate(date)}</span>
           <div className="flex justify-between items-center w-full">
               {isEditing ? (
                 <input
                   value={title}
                   onChange={(e) => onTitleChange(e.target.value)}
                   onPointerDown={(e) => e.stopPropagation()}
                   placeholder="Title (Optional)..."
                   className="text-2xl font-serif font-bold bg-transparent border-none outline-none text-gray-800 placeholder-gray-300 w-full"
                 />
               ) : (
                 <h2 className="text-2xl font-serif font-bold text-gray-800 leading-tight truncate mr-2">{title || "Untitled Entry"}</h2>
               )}

               {!readOnly && (
                  <div className="flex items-center gap-2 shrink-0">
                     {isSaving && <span className="text-[10px] text-gray-400 uppercase tracking-wider animate-pulse">Saving...</span>}
                     {isEditing ? (
                       <button onClick={onSave} disabled={isSaving} className="px-4 py-1.5 rounded-full text-white text-[10px] font-bold shadow-md transition-transform hover:scale-105 active:scale-95 flex items-center gap-1.5" style={{ backgroundColor: currentTheme.primaryColor }}>
                         {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} SAVE
                       </button>
                     ) : (
                       <button onClick={onEdit} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all shadow-sm" title="Edit">
                         <PenLine size={16} />
                       </button>
                     )}
                  </div>
               )}
           </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-y-auto custom-scrollbar pl-14 pr-8 pb-8 pt-[0.35rem]">
        {isEditing ? (
          <textarea
             value={content}
             onChange={(e) => onContentChange(e.target.value)}
             onPointerDown={(e) => e.stopPropagation()}
             placeholder="Write your thoughts here..."
             className="w-full h-full min-h-full bg-transparent border-none outline-none resize-none text-gray-700 text-lg font-serif"
             style={{ lineHeight: '2rem' }}
             spellCheck={false}
          />
        ) : (
          <div className="w-full min-h-full text-gray-800 text-lg font-serif whitespace-pre-wrap" style={{ lineHeight: '2rem' }}>
            {content || <span className="text-gray-300 italic">No content for this day.</span>}
          </div>
        )}
      </div>
    </div>
  );
};

const CalendarView: React.FC<{
  currentMonth: Date;
  onMonthChange: (offset: number) => void;
  calendarGrid: (CalendarDay | null)[];
  onDayClick: (day: number) => void;
  entriesMap: Record<string, DiaryEntryDTO>;
  activeDate: Date;
  setActiveDate: (date: Date) => void;
  onCreateNew: () => void;
  onRefresh: () => void;
  isMobile?: boolean;
}> = ({
  currentMonth, onMonthChange, calendarGrid, onDayClick,
  entriesMap, activeDate, setActiveDate, onCreateNew, onRefresh, isMobile
}) => {
  const { currentTheme } = useTheme();

  return (
    <div className={`flex flex-col h-full ${isMobile ? '' : 'bg-[#fdfdf6]'}`}>

      {!isMobile && (
        <div className="p-6 pb-2 flex items-center justify-between border-b border-gray-200/50">
           <h3 className="font-serif text-2xl font-bold text-gray-800 flex items-center gap-2">
               <BookOpen size={22} style={{ color: currentTheme.primaryColor }} /> Index
           </h3>
           <div className="flex gap-2">
               <button onClick={onRefresh} className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500"><RefreshCw size={14}/></button>
               <button onClick={onCreateNew} className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-gray-400 hover:bg-gray-200 transition-colors">+ New</button>
           </div>
        </div>
      )}

      <div className={isMobile ? 'pb-4' : 'px-6 py-4'}>
        <div className={`${isMobile ? 'bg-transparent' : 'bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-gray-200 shadow-sm'}`}>

            <div className="flex justify-between items-center mb-4 px-2">
                <button onClick={() => onMonthChange(-1)} className="p-2 hover:bg-gray-200 rounded-full text-gray-600"><ChevronLeft size={isMobile ? 20 : 16} /></button>
                <span className={`font-bold uppercase tracking-widest text-gray-800 ${isMobile ? 'text-lg' : 'text-sm'}`}>
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button onClick={() => onMonthChange(1)} className="p-2 hover:bg-gray-200 rounded-full text-gray-600"><ChevronRight size={isMobile ? 20 : 16} /></button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
                   <span key={i} className={`text-center font-bold text-gray-400 uppercase ${isMobile ? 'text-xs' : 'text-[10px]'}`}>{d}</span>
                ))}
            </div>

            <div className={`grid grid-cols-7 gap-1 place-items-center ${isMobile ? 'gap-y-4' : ''}`}>
                {calendarGrid.map((day, idx) => {
                    if (!day) return <div key={`empty-${idx}`} className={isMobile ? 'w-10 h-10' : 'w-8 h-8'} />;
                    return (
                        <button
                            key={`day-${idx}`}
                            onClick={() => onDayClick(day.date.getDate())}
                            className={`
                                rounded-full flex items-center justify-center font-medium transition-all relative
                                ${isMobile ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs'}
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

      {!isMobile && (
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3 custom-scrollbar">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Recent Memories</h4>
            {Object.values(entriesMap).slice(0, 5).map((entry, i) => (
                <div key={i} onClick={() => { if(entry.createdAt) setActiveDate(new Date(entry.createdAt)) }} className="p-3 rounded-lg bg-white/40 hover:bg-white/80 cursor-pointer transition-colors border border-transparent hover:border-gray-300">
                    <div className="flex justify-between"><span className="font-bold text-sm">{entry.title || 'Untitled'}</span><span className="text-[10px] text-gray-500">{getShortDate(entry.createdAt || '')}</span></div>
                    <p className="text-xs text-gray-500 line-clamp-1 mt-1">{entry.content}</p>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}

export const Diary: React.FC<DiaryProps> = ({ isOpen, onClose, zIndex, onFocus }) => {
  const { user, unlockSanctuary } = useAuth();
  const { encrypt, decrypt } = useEncryption();
  const { currentTheme } = useTheme();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authError, setAuthError] = useState('');
  const [entriesMap, setEntriesMap] = useState<Record<string, DiaryEntryDTO>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeDate, setActiveDate] = useState(new Date());
  
  const [isFlipping, setIsFlipping] = useState<'next' | 'prev' | null>(null);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editMode, setEditMode] = useState<DiaryMode>('view');
  const [isSaving, setIsSaving] = useState(false);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const autoSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen && user) {
       if (!user.hasDiarySetup) setIsUnlocked(true); 
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (isOpen && isUnlocked) fetchEntries();
  }, [isOpen, isUnlocked, user]);

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

  const handleUnlock = async (password: string) => {
    if (!user) return;
    setAuthError('');
    try {
        const success = await unlockSanctuary(password);
        if (success) {
            setIsUnlocked(true);
        } else {
            setAuthError("Incorrect Password");
        }
    } catch (err) {
        setAuthError("Incorrect Password");
    }
  };

  // ✅ FIX: "Ctrl+X" Empty Save & "Time Travel" Date Fix
  const handleSaveEntry = async (silent = false) => {
    setIsSaving(true);
    try {
      const titleToSave = editTitle.trim();
      const contentToSave = editContent; // Allow saving empty string

      // REMOVED GUARD CLAUSE: Now you can save an empty entry (clearing it)

      const encTitle = encrypt(titleToSave || "Untitled");
      const encContent = encrypt(contentToSave);
      
      // ✅ FIX: Explicitly set date to Noon UTC on the ACTIVE DATE
      // This prevents the "previous day" shifting bug across all timezones
      const y = activeDate.getFullYear();
      const m = String(activeDate.getMonth() + 1).padStart(2, '0');
      const d = String(activeDate.getDate()).padStart(2, '0');
      const stableDateISO = `${y}-${m}-${d}T12:00:00.000Z`;

      const saved = await userService.saveDiaryEntry({
        title: encTitle,
        content: encContent,
        tags: ['journal'],
        date: stableDateISO
      });

      // ✅ FIX: Update local state using stableDateISO so UI doesn't jump
      const newEntry = { 
          ...saved, 
          title: titleToSave || "Untitled", 
          content: contentToSave, 
          createdAt: stableDateISO 
      };
      
      const key = toDateString(activeDate);
      setEntriesMap(prev => ({ ...prev, [key]: newEntry }));
    } catch (e) {
      console.error("Save error", e);
      if (!silent) alert("Failed to save entry.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
      if (editMode === 'edit') {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          setIsSaving(true);
          autoSaveTimerRef.current = setTimeout(() => {
              handleSaveEntry(true);
          }, 1000);
      }
      return () => {
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      };
  }, [editContent, editTitle]);

  const createNewEntry = () => {
    setActiveDate(new Date());
    setEditMode('edit');
  };

  const changeMonth = (offset: number) => {
      const newDate = new Date(currentMonth);
      newDate.setMonth(newDate.getMonth() + offset);
      setCurrentMonth(newDate);
  };

  const changeDay = (offset: number) => {
      if (isMobile) {
          setActiveDate(prev => addDays(prev, offset));
          return;
      }
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
      if (isMobile) {
         setIsCalendarModalOpen(false);
      }
  };

  const dMinus1 = addDays(activeDate, -1);
  const dPlus1 = addDays(activeDate, 1);

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
         hasEntry,
         isToday,
         isSelected
       });
    }
    return resultDays;
  };

  const calendarGrid = getCalendarDays();

  const onTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null);
      setTouchStart(e.targetTouches[0].clientX);
  }
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > 50;
      const isRightSwipe = distance < -50;

      if (!isFlipping) {
          if (isLeftSwipe) changeDay(1);
          if (isRightSwipe) changeDay(-1);
      }
      setTouchStart(null);
      setTouchEnd(null);
  }

  return (
    <DraggableWindow 
      isOpen={isOpen} onClose={onClose} title="Personal Journal"
      initialWidth={900} initialHeight={650} defaultPosition={{ x: 100, y: 80 }}
      zIndex={zIndex || 20} onFocus={onFocus || (() => {})}
      icon={BookOpen}
      color="#F59E0B"
    >
      <div
        className="flex h-full w-full bg-[#222] text-gray-800 relative overflow-hidden rounded-b-xl shadow-inner font-sans items-center justify-center"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        
        {!isUnlocked ? (
          <DiaryLockScreen onUnlock={handleUnlock} error={authError} setError={setAuthError} />
        ) : (
            <div className={`relative w-full h-full flex shadow-2xl ${isMobile ? '' : 'rounded-r-lg perspective-2000 w-[95%] h-[90%]'}`}>
                
                {isMobile && (
                    <div className="absolute top-0 left-0 right-0 h-14 bg-[#fdfdf6] border-b border-gray-200 z-50 flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                             <span className="font-serif font-bold text-gray-800 text-lg">
                                {activeDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                             </span>
                             <button onClick={() => setIsCalendarModalOpen(true)} className="p-2 bg-gray-100 rounded-full text-gray-600">
                                <Calendar size={18} />
                             </button>
                        </div>
                        <button
                            onClick={() => handleSaveEntry(false)}
                            disabled={isSaving}
                            className="px-4 py-1.5 text-white text-xs font-bold uppercase rounded-full shadow-sm transition-colors"
                            style={{ backgroundColor: currentTheme.primaryColor }}
                        >
                            {isSaving ? "Saving..." : "Save"}
                        </button>
                    </div>
                )}

                <AnimatePresence>
                  {isMobile && isCalendarModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
                       <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          onClick={() => setIsCalendarModalOpen(false)}
                          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                       />
                       <motion.div
                          initial={{ scale: 0.9, opacity: 0, y: 20 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.9, opacity: 0, y: 20 }}
                          className="relative w-full max-w-sm bg-[#fdfdf6] rounded-2xl shadow-2xl p-6 overflow-hidden"
                       >
                           <div className="flex justify-between items-center mb-4">
                              <h3 className="font-serif text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Calendar size={20} /> Select Date
                              </h3>
                              <button onClick={() => setIsCalendarModalOpen(false)} className="p-1 rounded-full hover:bg-black/5">
                                <X size={20} className="text-gray-500" />
                              </button>
                           </div>

                           <CalendarView
                              currentMonth={currentMonth}
                              onMonthChange={changeMonth}
                              calendarGrid={calendarGrid}
                              onDayClick={handleCalendarClick}
                              entriesMap={entriesMap}
                              activeDate={activeDate}
                              setActiveDate={setActiveDate}
                              onCreateNew={createNewEntry}
                              onRefresh={fetchEntries}
                              isMobile={true}
                           />

                           <div className="mt-4 pt-4 border-t border-gray-200 flex justify-center">
                              <button onClick={() => { setActiveDate(new Date()); setIsCalendarModalOpen(false); }} className="text-sm font-bold text-teal-600 uppercase tracking-widest">
                                Jump to Today
                              </button>
                           </div>
                       </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {!isMobile && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white z-50">
                      <button onClick={() => changeDay(-1)} disabled={!!isFlipping} className="p-2 hover:bg-white/10 rounded-full disabled:opacity-50"><ChevronLeft/></button>
                      <span className="font-mono text-sm w-32 text-center">{getFormattedDate(activeDate).split(',')[1]}</span>
                      <button onClick={() => changeDay(1)} disabled={!!isFlipping} className="p-2 hover:bg-white/10 rounded-full disabled:opacity-50"><ChevronRight/></button>
                  </div>
                )}

                <div className={`relative flex w-full h-full bg-[#2a2a2a] ${isMobile ? '' : 'rounded-lg shadow-2xl'}`} style={isMobile ? {} : { perspective: '2500px', transformStyle: 'preserve-3d' }}>
                    
                    {isLoading && (
                        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg pointer-events-none">
                            <Loader2 className="animate-spin text-white/80" size={32} />
                        </div>
                    )}

                    <div className="absolute inset-0 flex">
                        {!isMobile && (
                          <div className="w-1/2 h-full border-r border-[#ccc] overflow-hidden rounded-l-lg bg-[#fdfdf6] flex flex-col">
                              <CalendarView
                                  currentMonth={currentMonth}
                                  onMonthChange={changeMonth}
                                  calendarGrid={calendarGrid}
                                  onDayClick={handleCalendarClick}
                                  entriesMap={entriesMap}
                                  activeDate={activeDate}
                                  setActiveDate={setActiveDate}
                                  onCreateNew={createNewEntry}
                                  onRefresh={fetchEntries}
                                  isMobile={false}
                              />
                          </div>
                        )}

                        <div
                          className={`${isMobile ? 'w-full pt-14' : 'w-1/2 border-l border-[#ccc] rounded-r-lg'} h-full overflow-hidden bg-[#fdfdf6]`}
                        >
                             <PaperPage 
                                date={isFlipping === 'next' ? dPlus1 : activeDate}
                                title={isFlipping === 'next' ? entriesMap[toDateString(dPlus1)]?.title || '' : (editMode === 'view' ? entriesMap[toDateString(activeDate)]?.title : editTitle)}
                                content={isFlipping === 'next' ? entriesMap[toDateString(dPlus1)]?.content || '' : (editMode === 'view' ? entriesMap[toDateString(activeDate)]?.content : editContent)}
                                mode={isFlipping ? 'view' : editMode} 
                                isSaving={isSaving}
                                onTitleChange={setEditTitle} onContentChange={setEditContent} onSave={() => handleSaveEntry(false)} onEdit={() => setEditMode('edit')} readOnly={isFlipping !== null}
                             />
                        </div>
                    </div>

                    <AnimatePresence mode="sync" onExitComplete={() => setIsFlipping(null)}>
                      {isFlipping && !isMobile && (
                           isFlipping === 'next' ? (
                               <motion.div
                                  key="flip-next"
                                  initial={{ rotateY: 0 }} animate={{ rotateY: -180 }}
                                  transition={{ duration: 0.6, ease: "easeInOut" }}
                                  onAnimationComplete={handleAnimationComplete}
                                  style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d', position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', zIndex: 50 }}
                               >
                                  <div className="absolute inset-0 w-full h-full backface-hidden" style={{ backfaceVisibility: 'hidden' }}>
                                      <PaperPage date={activeDate} title={entriesMap[toDateString(activeDate)]?.title || ''} content={entriesMap[toDateString(activeDate)]?.content || ''} mode="view" isSaving={false} onTitleChange={()=>{}} onContentChange={()=>{}} onSave={()=>{}} onEdit={()=>{}} readOnly={true} />
                                      <div className="absolute inset-0 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                                  </div>
                                  <div className="absolute inset-0 w-full h-full rounded-l-lg overflow-hidden" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', background: '#fdfdf6' }}>
                                      <div className="flex-1 flex flex-col p-8"><h3 className="text-xl font-serif font-bold text-gray-400 mb-4">Navigation</h3><p className="text-gray-400 text-sm">Turning to {getFormattedDate(dPlus1)}...</p></div>
                                      <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                                  </div>
                               </motion.div>
                           ) : (
                               <motion.div
                                  key="flip-prev"
                                  initial={{ rotateY: -180 }} animate={{ rotateY: 0 }}
                                  transition={{ duration: 0.6, ease: "easeInOut" }}
                                  onAnimationComplete={handleAnimationComplete}
                                  style={{ transformOrigin: 'right center', transformStyle: 'preserve-3d', position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%', zIndex: 50 }}
                               >
                                  <div className="absolute inset-0 w-full h-full rounded-l-lg overflow-hidden" style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', background: '#fdfdf6' }}>
                                      <PaperPage date={dMinus1} title={entriesMap[toDateString(dMinus1)]?.title || ''} content={entriesMap[toDateString(dMinus1)]?.content || ''} mode="view" isSaving={false} onTitleChange={()=>{}} onContentChange={()=>{}} onSave={()=>{}} onEdit={()=>{}} readOnly={true} />
                                      <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                                  </div>
                                  <div className="absolute inset-0 w-full h-full rounded-r-lg overflow-hidden" style={{ backfaceVisibility: 'hidden', background: '#fdfdf6' }}>
                                       <div className="flex-1 flex flex-col p-8"><h3 className="text-xl font-serif font-bold text-gray-400 mb-4">Navigation</h3><p className="text-gray-400 text-sm">Turning back...</p></div>
                                      <div className="absolute inset-0 bg-gradient-to-l from-black/10 to-transparent pointer-events-none" />
                                  </div>
                               </motion.div>
                           )
                      )}
                      {isFlipping && isMobile && (
                          <motion.div
                              key="mobile-flip"
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              onAnimationComplete={handleAnimationComplete}
                              className="absolute inset-0 flex items-center justify-center bg-[#fdfdf6] z-50"
                          >
                              <Loader2 className="animate-spin text-gray-400" />
                          </motion.div>
                      )}
                    </AnimatePresence>

                    {!isMobile && (
                        <div className="absolute left-1/2 top-0 bottom-0 w-16 -ml-8 z-40 flex justify-center">
                            <div className="w-[2px] h-full bg-[#1a1a1a] shadow-[0_0_10px_rgba(0,0,0,0.5)]" />
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </DraggableWindow>
  );
};
