import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Menu, Headphones, AlertCircle, Smile, 
  Mic, MicOff, X, Search, Image as ImageIcon, Plus, Camera,
  ShieldAlert, Loader2, ChevronDown, Reply, Check, ArrowDown,
  UserPlus, Play, Pause, Lock, Zap, Leaf
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { MessageBubble } from './MessageBubble';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useSync } from '../../context/SyncContext';
import api from '../../services/api';
import { SettingsPanel } from '../settings/SettingsPanel';

// --- NEW COMPONENT: THOUGHT CLOUD MODAL ---
const ThoughtCloudModal: React.FC<{ isOpen: boolean; onClose: () => void; content: any }> = ({ isOpen, onClose, content }) => {
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

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  warning?: string;
  id?: string;
  reaction?: string;
  voice_note?: string;
}

interface ChatViewProps {
  onMobileMenuClick?: () => void;
  onOpenWidget?: (widget: string, config?: any) => void;
  isMobile?: boolean;
  currentActivity?: string;
}

// --- UTILS ---
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                } else {
                    reject(new Error("Canvas context is null"));
                }
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

const mapColorToTheme = (colorName: string): string => {
    const lower = colorName.toLowerCase().trim();
    const themes = ['aurora', 'sunset', 'ocean', 'midnight'];
    if (themes.includes(lower)) return lower;
    const colorMap: Record<string, string> = {
        'blue': '#3b82f6', 'red': '#ef4444', 'green': '#22c55e', 'orange': '#f97316',
        'purple': '#a855f7', 'pink': '#ec4899', 'yellow': '#eab308', 'teal': '#14b8a6',
        'cyan': '#06b6d4', 'white': '#ffffff', 'black': '#000000', 'gray': '#6b7280'
    };
    if (colorMap[lower]) return colorMap[lower];
    if (lower.startsWith('#')) return lower;
    return 'aurora';
};

const EMOJIS = ['😊', '🌿', '☁️', '✨', '💜', '🌧️', '🎵', '🧘‍♀️', '🌸', '☕', '🌙', '💪', '🤔', '🔥', '👀', '🫂'];

export const ChatView: React.FC<ChatViewProps> = ({ onMobileMenuClick, onOpenWidget, isMobile = false, currentActivity = 'Online' }) => {
  const { user } = useAuth();
  const { setTheme, currentTheme } = useTheme();
  const { subscribe } = useSync();
  const navigate = useNavigate();
  
  const botName = user?.persona === 'aarav' ? 'Aastik' : 'Aastha';

  // --- STATE ---
  const [isInitializing, setIsInitializing] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const hasAttemptedInit = useRef(false);
  
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [targetFlashColor, setTargetFlashColor] = useState('#ffffff');
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  // Subconscious State
  const [statusDisplay, setStatusDisplay] = useState(currentActivity || 'Online');
  const [uiAction, setUiAction] = useState<'none' | 'listen' | 'block_widget'>('none');
  const [currentMood, setCurrentMood] = useState('neutral');
  const [suggestedChips, setSuggestedChips] = useState<string[]>([]);

  // Thought Cloud
  const [showThoughtCloud, setShowThoughtCloud] = useState(false);
  const [lastSubconscious, setLastSubconscious] = useState<any>(null); // Store last brain data

  // Patience / Listening Mode State
  const [isWaitingForPermission, setIsWaitingForPermission] = useState(false);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Media Menu State
  const [showMediaMenu, setShowMediaMenu] = useState(false);

  // Scroll State
  const [showScrollDown, setShowScrollDown] = useState(false);

  // --- SEARCH STATE ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ msgId: string, matchIndex: number }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // --- VOICE STATE ---
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDictating, setIsDictating] = useState(false); 
  const [transcript, setTranscript] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem('user_tts_enabled') === 'true');
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(() => localStorage.getItem('user_voice_uri'));
  
  // AUDIO REF for Single Source of Truth
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- CLONE MODE & VOICE INPUT ---
  const [isCloneMode, setIsCloneMode] = useState(false);
  const [cloneUploadVisible, setCloneUploadVisible] = useState(false);

  // --- SETTINGS STATE ---
  const [showSettings, setShowSettings] = useState(false);

  // --- CREDITS ---
  const [localCredits, setLocalCredits] = useState(user?.credits || 0);
  const [modelMode, setModelMode] = useState<'pro' | 'eco'>(user?.credits && user.credits > 0 ? 'pro' : 'eco');
  const [isStandardMode, setIsStandardMode] = useState(false);
  
  // --- REFS ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedTagsRef = useRef<Set<string>>(new Set());

  // --- 1. SYNC & WEBSOCKET & HEARTBEAT ---
  useEffect(() => {
    // Heartbeat: Refresh user data (streak, etc.) on focus
    const handleFocus = () => {
        api.get('/users/me').catch(console.error); // Silent refresh
    };
    window.addEventListener('focus', handleFocus);

    const unsubscribe = subscribe('message', (data: any) => {
        if (data && data.content) {
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant' && (lastMsg.id?.startsWith('temp') || lastMsg.id === 'temp-ai')) {
                      return [...prev.slice(0, -1), { ...lastMsg, content: data.content, id: data._id || Date.now().toString() }];
                }
                return [...prev, { role: 'assistant', content: data.content, timestamp: Date.now() }];
            });
            setIsTyping(false);
        }
    });
    return () => {
        window.removeEventListener('focus', handleFocus);
        unsubscribe();
    };
  }, [subscribe]);

  // Silence Timer Logic (Listening Mode)
  useEffect(() => {
    if (uiAction === 'listen') {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        setIsWaitingForPermission(false);
        silenceTimeoutRef.current = setTimeout(() => {
            setIsWaitingForPermission(true);
        }, 15000); // 15 seconds silence
    } else {
        setIsWaitingForPermission(false);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    }
    return () => {
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    };
  }, [uiAction, messages, input]);

  useEffect(() => {
      if (user) {
          const credits = user.credits || 0;
          const isPremium = user.isPro || credits > 0;
          setIsStandardMode(!isPremium);
          setLocalCredits(user.isPro ? 9999 : credits);
          setModelMode(isPremium ? 'pro' : 'eco');
          if (user.cloneMode?.isActive) setIsCloneMode(true);
      }
  }, [user]);

  // --- 2. INIT CHAT ---
  useEffect(() => {
     if (!user) return; 
     if (hasAttemptedInit.current) return;
     hasAttemptedInit.current = true;

     let isMounted = true;
     const initChat = async () => {
         setIsInitializing(true);
         setConnectionStatus(`Connecting to ${botName}...`);
         try {
             const res = await api.get('/chat/history');
             if (isMounted) {
                 if (Array.isArray(res.data) && res.data.length > 0) {
                     // Performance: Slice to last 50 messages initially
                     // [FIX] Map through history to resolve any relative audio URLs AND CLEAN GARBAGE TAGS
                     const history = res.data.map((msg: any) => {
                        // Local cleaner to strip legacy tags while preserving proposals
                        let clean = msg.content || "";
                        clean = clean.replace(/<color>[\s\S]*?<\/color>/gi, '');
                        clean = clean.replace(/<(?!proposal)[^>]+>/g, '');
                        
                        return {
                            ...msg,
                            content: clean,
                            voice_note: msg.voice_note ? resolveAudioUrl(msg.voice_note) : undefined
                        };
                     });
                     setMessages(history.slice(-50));
                 } else {
                     setMessages([{ role: 'assistant', content: `Hi ${user?.name || 'friend'}, I am ${botName}. How can I support you right now?`, timestamp: Date.now() }]);
                 }
             }
         } catch (e: any) { 
             console.error("Init failed:", e);
             if (isMounted) setMessages([{ role: 'assistant', content: `Hi ${user?.name || 'friend'}, I am ${botName}. I'm listening.`, timestamp: Date.now() }]);
         } finally {
             if (isMounted) {
                 setTimeout(() => { scrollToBottom(); setIsInitializing(false); }, 500);
             }
         }
     };
     initChat();
     return () => { isMounted = false; };
  }, [user, navigate, botName]);

  // --- 3. SEARCH LOGIC ---
  useEffect(() => {
      if (searchQuery.trim()) {
          const hits: { msgId: string, matchIndex: number }[] = [];
          const lowerQuery = searchQuery.toLowerCase();
          
          messages.forEach((msg, idx) => {
             const safeId = msg.id || `msg-${idx}`;
             if (msg.content) {
                 const lowerContent = msg.content.toLowerCase();
                 let pos = lowerContent.indexOf(lowerQuery);
                 let localIndex = 0;
                 while (pos !== -1) {
                     hits.push({ msgId: safeId, matchIndex: localIndex });
                     localIndex++;
                     pos = lowerContent.indexOf(lowerQuery, pos + 1);
                 }
             }
          });
          setSearchResults(hits);
          setCurrentMatchIndex(hits.length > 0 ? hits.length - 1 : 0);
      } else { 
          setSearchResults([]); 
          setCurrentMatchIndex(0); 
      }
  }, [searchQuery, messages]);

  useEffect(() => {
      if (searchResults.length > 0 && searchResults[currentMatchIndex]) {
          const { msgId } = searchResults[currentMatchIndex];
          const el = document.getElementById(`msg-${msgId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  }, [currentMatchIndex, searchResults]);

  const nextMatch = () => setCurrentMatchIndex(prev => (prev + 1) % searchResults.length);
  const prevMatch = () => setCurrentMatchIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
  
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) nextMatch(); 
          else prevMatch();
      }
  };

  // --- 4. VOICE & HELPERS ---
  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => { setIsListening(false); };
      recognition.onerror = (event: any) => {
          if (event.error === 'not-allowed') {
              setError("Microphone access denied.");
              setIsVoiceMode(false);
          }
      };
      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
           currentText += event.results[i][0].transcript;
        }
        if (isDictating) {
            // Dictation Mode (Frontend STT)
            const isFinal = event.results[event.results.length - 1].isFinal;
            if (isFinal) {
                setInput(prev => prev + (prev.length > 0 ? ' ' : '') + currentText);
                autoResizeTextarea();
            }
        } else {
            // Voice Mode (Conversational)
            setTranscript(currentText);
            if (currentText.trim().length > 0) {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => { handleVoiceSend(currentText); }, 1500);
            }
        }
      };
      recognitionRef.current = recognition;
    }
  }, [isDictating]);

  const autoResizeTextarea = () => {
    if (textareaRef.current) {
        // Reset height to calculate correct scrollHeight
        textareaRef.current.style.height = 'auto';
        const newHeight = Math.min(textareaRef.current.scrollHeight, 120);
        textareaRef.current.style.height = `${newHeight}px`;
    }
  };

  const getApiUrl = (endpoint: string) => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return `${envUrl}${endpoint}`;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return `http://${host}:5000/api${endpoint}`;
    return `https://aastha-final.onrender.com/api${endpoint}`;
  };

  // Helper to ensure we have a full URL for audio playback
  const resolveAudioUrl = (path: string) => {
      if (!path) return '';
      if (path.startsWith('http') || path.startsWith('data:')) return path;
      if (path.startsWith('/')) {
          // Construct absolute URL based on API base
          // Example: getApiUrl('') -> https://.../api
          // path -> /api/ai/stream/...
          // We need https://.../api/ai/stream/...
          // If we append path to domain, we might double /api if path has it

          const apiBase = getApiUrl(''); // e.g. https://domain.com/api
          const domain = apiBase.replace(/\/api\/?$/, ''); // https://domain.com
          return `${domain}${path}`;
      }
      return path;
  };

  const startListening = () => { if (recognitionRef.current && !isListening) { try { setTranscript(''); recognitionRef.current.start(); } catch (e) { console.error("Speech start", e); } } };
  const stopListening = () => { if (recognitionRef.current && isListening) recognitionRef.current.stop(); };
  
  const toggleVoiceMode = () => {
    // @ts-ignore
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) { setError("Browser not supported."); return; }
    // Remove Standard Mode check for Voice Mode to allow trial usage if implemented,
    // but backend handles enforcement. Keeping frontend check is UX friendly though.
    // However, since we now support "10 free messages with Voice", we should ALLOW it.
    // if (isStandardMode) { alert("Voice Mode requires Premium."); return; } <--- REMOVED

    if (isVoiceMode) {
        stopListening();
        setIsVoiceMode(false);
        setTtsEnabled(false);
        localStorage.setItem('user_tts_enabled', 'false');
    } else {
        if (isDictating) { setIsDictating(false); }
        setIsVoiceMode(true);
        setTtsEnabled(true);
        localStorage.setItem('user_tts_enabled', 'true');
        const voices = window.speechSynthesis.getVoices();
        const indianVoice = voices.find(v => v.lang.includes('IN') || v.name.includes('India'));
        if (indianVoice) {
            setSelectedVoiceURI(indianVoice.voiceURI);
            localStorage.setItem('user_voice_uri', indianVoice.voiceURI);
        }
        startListening();
    }
  };
  
  const toggleDictation = () => {
      // @ts-ignore
      if (!window.SpeechRecognition && !window.webkitSpeechRecognition) { setError("Dictation not supported."); return; }
      if (isDictating) {
          recognitionRef.current?.stop();
          setIsDictating(false);
      } else {
          if (isVoiceMode) { setIsVoiceMode(false); }
          try {
              recognitionRef.current?.start();
              setIsDictating(true);
          } catch(e) {}
      }
  };

  const handleVoiceSend = (text: string) => { stopListening(); setTranscript(''); handleSend(undefined, text); };

  const scrollToBottom = () => {
      if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({ 
              top: messagesContainerRef.current.scrollHeight, 
              behavior: 'smooth' 
          });
      }
  };
  useEffect(() => scrollToBottom(), [messages, isTyping]);

  const handleScroll = () => {
      if (!messagesContainerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollDown(!isBottom);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isStandardMode) { setError("Vision Analysis requires Premium."); return; }
      const files = e.target.files;
      if (files && files.length > 0) {
          try {
              const compressed = await compressImage(files[0]);
              if (cloneUploadVisible) {
                 // Clone Mode Logic
                 handleCloneUpload(compressed);
              } else {
                 setAttachedImage(compressed);
              }
          } catch (err) { setError("Failed to process image."); }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCloneUpload = async (img: string) => {
     // TODO: Implement Clone Mode Activation
     setCloneUploadVisible(false);
     setIsCloneMode(true);
     setMessages(prev => [...prev, { role: 'system', content: 'SYSTEM: Clone Mode Activated. Upload a screenshot to mimic.', timestamp: Date.now() }]);
     // Just for now, we simulate activation. Ideally send to /chat to activate.
     // We will treat this as a "message" with intent to clone.
     handleSend(undefined, 'ACTIVATE_CLONE_MODE', img);
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
  };
  
  const handleReply = (content: string) => { setReplyingTo(content); textareaRef.current?.focus(); };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
              e.preventDefault();
              if (isStandardMode) { setError("Vision Analysis requires Premium."); return; }

              const blob = items[i].getAsFile();
              if (blob) {
                  try {
                      // Compress/Format image using existing util
                      const compressed = await compressImage(blob);
                      setAttachedImage(compressed);
                  } catch (err) {
                      setError("Failed to process pasted image.");
                  }
              }
              return; // Stop after first image
          }
      }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    autoResizeTextarea();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isMobile && e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        handleSend(); 
    }
  };

  // --- 5. SEND LOGIC (INTEGRATED WITH SERVER BRAIN) ---
  const handleSend = async (e?: React.FormEvent, overrideInput?: string, overrideImage?: string, audioBlob?: Blob) => {
    if (e) e.preventDefault();
    
    // Audio Handling
    let audioBase64 = null;
    if (audioBlob) {
        audioBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(audioBlob);
        });
    }

    const textToSend = overrideInput || input;
    if (!textToSend.trim() && !attachedImage && !overrideImage && !audioBlob) return;

    let finalContent = textToSend;
    if (replyingTo) { finalContent = `> Replying to: "${replyingTo}"\n\n${textToSend}`; setReplyingTo(null); }
    if (attachedImage || overrideImage) { finalContent = `[Image Attached] ${finalContent}`; }
    if (audioBlob) { finalContent = `[Voice Note]`; }

    const userMsg: ChatMessage = { role: 'user', content: finalContent, timestamp: Date.now(), id: `local-${Date.now()}` };
    const tempBotId = `temp-${Date.now()}`;
    
    // 1. UPDATE UI IMMEDIATELY
    const updatedMessages = [...messages, userMsg];
    const SLICE_LIMIT = 50;
    const nextState = [...updatedMessages, { role: 'assistant', content: '', timestamp: Date.now(), id: tempBotId }];
    setMessages(nextState.length > SLICE_LIMIT ? nextState.slice(nextState.length - SLICE_LIMIT) : nextState);
    
    setInput(''); setAttachedImage(null); setShowEmojiPicker(false);
    setIsTyping(true); 
    setError(null);
    setStatusDisplay('Thinking...'); 
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // 2. CALL BACKEND
    try {
      let token = '';
      try {
        const storedInfo = localStorage.getItem('userInfo');
        if (storedInfo) token = JSON.parse(storedInfo).token;
      } catch(e) {}

      const isPermissionGrant = finalContent === 'PERMISSION_GRANT_REPLY';
      const actualContent = isPermissionGrant ? "Please reply now." : finalContent;

      const streamResponse = await fetch(getApiUrl('/chat'), {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        credentials: 'include', 
        body: JSON.stringify({
            message: actualContent,
            images: overrideImage ? [overrideImage] : (attachedImage ? [attachedImage] : []),
            audio: audioBase64,
            forceReply: isPermissionGrant,
            isVoiceMode: isVoiceMode // <--- Pass Voice Mode Flag
        }),
      });

      if (!streamResponse.ok) {
          setIsTyping(false);
          if (streamResponse.status === 401) { 
               setError("Session expired. Please login again.");
               return; 
          }
          const errData = await streamResponse.json().catch(() => ({}));
          throw new Error(errData.message || `${botName} is unreachable.`);
      }

      const reader = streamResponse.body?.getReader();
      const decoder = new TextDecoder();
      processedTagsRef.current.clear();
      
      let aiContentRaw = '';
      let buffer = '';
      let serverAudioPlayed = false; // Flag to prevent double speaking

      if (reader) {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.replace('data: ', '');
                    if (dataStr.trim() === '[DONE]') break;
                    try {
                        const data = JSON.parse(dataStr);

                        // A. HANDLE THOUGHT (THE BRAIN)
                        if (data.type === 'thought') {
                            const brain = data.content;
                            if (brain) {
                                setLastSubconscious(brain); // Save for Thought Cloud
                                if (brain.mood) setCurrentMood(brain.mood);
                                if (brain.status_display) setStatusDisplay(brain.status_display);
                                if (brain.suggested_replies) setSuggestedChips(brain.suggested_replies);
                                if (brain.ui_action) setUiAction(brain.ui_action as any);

                                // Sticky Reaction
                                if (brain.reaction) {
                                     setMessages(prev => {
                                         const newList = [...prev];
                                         const targetIdx = newList.findIndex(m => m.id === userMsg.id);
                                         if (targetIdx !== -1) {
                                             newList[targetIdx] = { ...newList[targetIdx], reaction: brain.reaction };
                                         }
                                         return newList;
                                      });
                                }

                                // GOD MODE TOOLS (THE HANDS) -> TRANSFORM TO PROPOSALS
                                if (brain.tool_calls && brain.tool_calls.length > 0) {
                                    brain.tool_calls.forEach((tool: any) => {
                                        let toolName = '';
                                        let params = {};
                                        let reason = "I can help with that";

                                        if (tool.name === 'control_widget') {
                                            toolName = tool.params.widget;
                                            params = tool.params.params || tool.params;
                                        } else if (tool.name === 'write_diary') {
                                            toolName = 'diary';
                                            params = tool.params;
                                            reason = "Write in Diary";
                                        }

                                        // Special Widget: Voice Hug
                                        if (toolName === 'voice_hug') {
                                            // Append audio placeholder
                                            const hugTag = `\n\n[Voice Hug Playing 🎵]`;
                                            aiContentRaw += hugTag;
                                        }

                                        if (toolName) {
                                            const proposalTag = `\n<proposal tool="${toolName}" params='${JSON.stringify(params)}' reason="${reason}" />`;
                                            aiContentRaw += proposalTag;
                                        }
                                    });
                                }

                                // Stop typing indicator if listening
                                if (brain.strategy === 'listen') {
                                    setIsTyping(false);
                                    if (!aiContentRaw) {
                                        setMessages(prev => prev.filter(m => m.id !== tempBotId));
                                    }
                                }
                            }
                        }

                        // B. HANDLE META
                        if (data.meta) { 
                            setLocalCredits(data.meta.credits === '∞' ? 9999 : Number(data.meta.credits)); 
                            setModelMode(data.meta.mode); 
                            setIsStandardMode(data.meta.mode === 'standard');
                            if (data.meta.limitReached) {
                                setIsCloneMode(false);
                            }
                        }

                        // C. HANDLE VOICE NOTE (AUDIO URL - PERSISTENT)
                        if (data.voice_note) {
                            setMessages(prev => prev.map(msg => {
                                if (msg.id === tempBotId) {
                                    // RESOLVE URL before saving to state
                                    return { ...msg, voice_note: resolveAudioUrl(data.voice_note) };
                                }
                                return msg;
                            }));
                        }

                        // D. HANDLE STREAMING AUDIO (AUTO-PLAY FOR CALL MODE)
                        if (data.voice_audio) {
                            serverAudioPlayed = true;
                            // RESOLVE URL before playing
                            const resolvedUrl = resolveAudioUrl(data.voice_audio);
                            speakMessage(resolvedUrl);
                        }

                        // E. HANDLE CONTENT (THE VOICE)
                        if (data.content && !data.type) { 
                            aiContentRaw += data.content;
                            const cleanContent = processMagicTags(aiContentRaw);
                            setMessages(prev => prev.map(msg => {
                                if (msg.id === tempBotId) {
                                    return { ...msg, content: cleanContent };
                                }
                                return msg;
                            }));
                        }
                    } catch (e: any) {}
                }
            }
        }
      }
      
      const cleanFinal = processMagicTags(aiContentRaw);
      // Play Browser TTS only if server audio wasn't played AND (Voice Mode active OR TTS enabled)
      if ((isVoiceMode || ttsEnabled) && aiContentRaw && !serverAudioPlayed) {
          speakMessage(cleanFinal);
      }

    } catch (error: any) {
      console.error(error);
      setMessages(prev => prev.filter(m => m.id !== tempBotId)); 
      setError(error.message || "Connection failed.");
    } finally { setIsTyping(false); }
  };

  const processMagicTags = (text: string) => {
    // Legacy Tag Processing (Retained for backward compat)
    const tagRegex = /<[^>]+>/g;
    const matches = text.match(tagRegex);
    if (matches) {
        matches.forEach(tag => {
            if (processedTagsRef.current.has(tag)) return;
            const lowerTag = tag.toLowerCase();
            const colorMatch = /<color>([\s\S]*?)<\/color>/i.exec(text);
            if (colorMatch && !processedTagsRef.current.has(colorMatch[0])) {
                  const mappedColor = mapColorToTheme(colorMatch[1].trim());
                  if (!showCountdown) {
                    setShowCountdown(true);
                    setCountdownNum(3);
                    setTargetFlashColor(mappedColor.startsWith('#') ? mappedColor : '#ffffff');
                    const timer = setInterval(() => {
                        setCountdownNum(prev => {
                            if (prev <= 1) {
                                clearInterval(timer);
                                setShowCountdown(false);
                                setShowFlash(true);
                                setTimeout(() => {
                                    setTheme(mappedColor);
                                    setTimeout(() => setShowFlash(false), 800);
                                }, 400);
                                return 0;
                            }
                            return prev - 1;
                        });
                    }, 1000);
                  }
                  processedTagsRef.current.add(colorMatch[0]);
                  processedTagsRef.current.add('<color>');
                  processedTagsRef.current.add('</color>');
            }
            if (onOpenWidget) {
                if (lowerTag.startsWith('<proposal')) {
                    // Do nothing, MessageBubble handles parsing
                } else {
                    if (lowerTag.includes('recommend_breathing')) { const m = lowerTag.match(/mode="([^"]+)"/i); onOpenWidget('breathing', { initialMode: m ? m[1] : undefined }); }
                    if (lowerTag.includes('open_breathing') || lowerTag.includes('start_breathing_exercise')) onOpenWidget('breathing');
                    if (lowerTag.includes('open_soundscape')) { const m = lowerTag.match(/preset="([^"]+)"/i); onOpenWidget('soundscape', { preset: m ? m[1] : undefined }); }
                    if (lowerTag.includes('open_diary')) onOpenWidget('diary');
                    if (lowerTag.includes('open_mood_tracker')) onOpenWidget('mood');
                    if (lowerTag.includes('open_pomodoro')) onOpenWidget('pomodoro');
                    if (lowerTag.includes('open_jam-with-aastha')) onOpenWidget('jam');
                }
            }
            processedTagsRef.current.add(tag);
        });
    }
    let cleanText = text.replace(/<color>[\s\S]*?<\/color>/gi, '');
    cleanText = cleanText.replace(/<(?!proposal)[^>]+>/g, '');
    return cleanText;
  };

  const speakMessage = (textOrUrl: string) => {
    // STOP any currently playing audio before starting new one
    if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
    }
    window.speechSynthesis.cancel(); // Stop browser TTS too

    // 1. Detect if it's a URL (server audio)
    if (textOrUrl.startsWith('http') || textOrUrl.startsWith('/api/') || textOrUrl.startsWith('data:')) {
        // Double-check if relative path needs resolving (though handleSend usually does it)
        const finalUrl = resolveAudioUrl(textOrUrl);
        const audio = new Audio(finalUrl);
        currentAudioRef.current = audio; // Track it

        audio.play().catch(e => console.error("Audio Play Error:", e));
        audio.onended = () => {
             currentAudioRef.current = null;
             if (isVoiceMode) setTimeout(() => startListening(), 500);
        };
        return;
    }

    // 2. Fallback: Browser TTS
    if ('speechSynthesis' in window) {
       const cleanText = textOrUrl.replace(/[*#]/g, '').replace(/[\u{1F600}-\u{1F64F}]/gu, '');
       const utterance = new SpeechSynthesisUtterance(cleanText);
       const voices = window.speechSynthesis.getVoices();
       let chosenVoice = voices.find(v => v.voiceURI === selectedVoiceURI) || voices.find(v => v.name.includes('Google US English'));
       if (chosenVoice) utterance.voice = chosenVoice;
       utterance.onend = () => { if (isVoiceMode) setTimeout(() => startListening(), 300); };
       window.speechSynthesis.speak(utterance);
    }
  };

  const renderMessages = () => {
      let lastDateLabel = '';
      return messages.map((msg, idx) => {
          const dateLabel = getDateLabel(msg.timestamp || Date.now());
          const showSeparator = dateLabel !== lastDateLabel;
          lastDateLabel = dateLabel;
          
          const safeId = msg.id || `msg-${idx}`;
          const domId = `msg-${safeId}`;
          
          let currentMatchIndexInMessage = -1;
          if (searchResults.length > 0) {
              const currentMatch = searchResults[currentMatchIndex];
              if (currentMatch && currentMatch.msgId === safeId) currentMatchIndexInMessage = currentMatch.matchIndex;
          }
          const isCurrentlyStreaming = isTyping && msg.role === 'assistant' && idx === messages.length - 1;

          return (
             <React.Fragment key={domId}>
                {showSeparator && (
                    <div className="flex justify-center my-8 shrink-0">
                        <span className="bg-black/30 backdrop-blur-md border border-white/5 text-white/50 text-[10px] font-medium px-4 py-1 rounded-full uppercase tracking-widest shadow-sm">{dateLabel}</span>
                    </div>
                )}
                <div 
                    id={domId} 
                    className="flex flex-col w-full px-4 md:px-8"
                >
                    <MessageBubble 
                        role={msg.role} 
                        content={msg.content} 
                        timestamp={msg.timestamp}
                        reaction={msg.reaction}
                        voice_note={msg.voice_note} // Pass Voice Note
                        mood={currentMood}
                        onReply={() => handleReply(msg.content)} 
                        onCopy={copyToClipboard}
                        onOpenWidget={onOpenWidget}
                        searchQuery={searchQuery}
                        currentMatchIndex={currentMatchIndexInMessage}
                        isStreaming={isCurrentlyStreaming} 
                        isMobile={isMobile} 
                    />
                    {msg.warning && <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/30 -mt-3 mb-4"><ShieldAlert size={10} /> {msg.warning}</div>}
                </div>
             </React.Fragment>
          );
      });
  };

  const getDateLabel = (timestamp: number) => {
      const date = new Date(timestamp);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return 'Today';
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (isInitializing) {
      return (
          <div className="flex flex-col items-center justify-center w-full h-[100dvh] bg-black text-white">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="mb-4">
                  <Loader2 size={48} className="text-white/30" />
              </motion.div>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-white/50 font-serif tracking-wider">
                {connectionStatus}
              </motion.p>
          </div>
      );
  }

  // --- RETURN JSX ---
  return (
    // FIXED: Removed 'md:block'. It is now ALWAYS 'flex-col' to ensure strict layout boundaries.
    <div className="relative w-full h-[100dvh] flex flex-col items-center overflow-hidden bg-transparent">
      
      {/* 1. GLOBAL BACKGROUNDS & WALLPAPER */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
          {user?.wallpaper ? (
              <div 
                  className="w-full h-full bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${user.wallpaper})` }}
              >
                  <div className="absolute inset-0 bg-black/60 md:bg-black/40" />
              </div>
          ) : (
              <div className="w-full h-full bg-[#0a0e17] md:bg-transparent" />
          )}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />
      </div>

      <AnimatePresence>
          {showCountdown && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 pointer-events-none">
                  <motion.div key={countdownNum} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 2, opacity: 0 }} className="text-white text-9xl font-bold font-serif">{countdownNum}</motion.div>
              </motion.div>
          )}
          {showFlash && (
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} transition={{ duration: 0.8, ease: "easeInOut" }} className="fixed inset-0 z-[100] pointer-events-none" style={{ backgroundColor: targetFlashColor }} />
          )}
      </AnimatePresence>

      {/* CLONE MODE HEADER OVERLAY */}
      {isCloneMode && (
         <div className="absolute top-0 left-0 right-0 h-14 z-20 bg-purple-500/20 backdrop-blur-md flex items-center justify-center pointer-events-none">
             <span className="text-purple-200 font-bold tracking-wider text-xs uppercase animate-pulse">Clone Mode Active</span>
         </div>
      )}

      {/* FULL SCREEN VOICE MODE OVERLAY */}
      <AnimatePresence>
        {isVoiceMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center">
              <button onClick={toggleVoiceMode} className="absolute top-8 right-8 text-white/50 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"><X size={24} /></button>
              <div className="relative mb-12">
                 <motion.div animate={{ scale: isListening ? [1, 1.4, 1] : 1, opacity: isListening ? [0.4, 0.8, 0.4] : 0.2 }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-full blur-3xl" style={{ backgroundColor: currentTheme.primaryColor }} />
                 <div className="w-48 h-48 rounded-full border border-white/10 bg-black/50 backdrop-blur-2xl relative z-10 flex items-center justify-center">
                     <Headphones size={64} className={isListening ? "text-white" : "text-white/30"} />
                 </div>
              </div>
              <h3 className="text-3xl font-serif text-white mb-6">{isListening ? "Listening..." : "Thinking..."}</h3>
              <p className="text-white/50 text-lg max-w-lg text-center px-4 min-h-[3rem]">{transcript || "..."}</p>
              <button onClick={isListening ? stopListening : startListening} className="mt-12 p-6 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                 {isListening ? <Mic size={32} /> : <MicOff size={32} className="text-red-400" />}
              </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SETTINGS PANEL */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* THOUGHT CLOUD MODAL */}
      <ThoughtCloudModal isOpen={showThoughtCloud} onClose={() => setShowThoughtCloud(false)} content={lastSubconscious} />

      {/* --- SECTION 1: HEADER (FIXED HEIGHT) --- */}
      <div className={`shrink-0 w-full z-30 pt-[env(safe-area-inset-top)] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pb-2 pointer-events-auto ${isMobile ? 'bg-gradient-to-b from-black/80 to-transparent' : 'md:top-0 md:pt-6 bg-none'}`}>
        <div className="flex items-center gap-3 h-14 justify-between relative">
             <div className="shrink-0 flex items-center z-20">
                 <button id="mobile-menu-btn" onClick={onMobileMenuClick} className={`p-2.5 rounded-full backdrop-blur-md border border-white/5 text-white/70 bg-black/20 ${!isMobile ? 'md:hidden' : ''}`}>
                    <Menu size={20} />
                 </button>
             </div>

             <div className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-full pointer-events-auto">
                 <AnimatePresence mode="wait">
                    {!isSearchOpen && (
                        isWaitingForPermission ? (
                             <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                className="flex items-center gap-3 px-2 py-1.5 rounded-full bg-[#1F2937] border border-white/10 shadow-2xl cursor-pointer"
                             >
                                <span className="text-xs text-white/80 ml-2 font-medium">Can I reply?</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleSend(undefined, 'PERMISSION_GRANT_REPLY')}
                                        className="p-1 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white transition-colors"
                                    >
                                        <Check size={14} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsWaitingForPermission(false);
                                            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                                            silenceTimeoutRef.current = setTimeout(() => setIsWaitingForPermission(true), 15000);
                                        }}
                                        className="p-1 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                             </motion.div>
                        ) : (
                            <motion.div
                                key="status-pill"
                                onClick={() => setShowThoughtCloud(true)}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/20 backdrop-blur-xl border border-white/5 shadow-lg cursor-pointer hover:bg-black/30 transition-colors"
                            >
                                <div className={`w-2 h-2 rounded-full ${currentActivity === 'Online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-amber-400 animate-pulse'}`} />
                                <span className="text-xs font-medium text-white/80 tracking-wide uppercase">{statusDisplay}</span>
                            </motion.div>
                        )
                    )}
                 </AnimatePresence>
             </div>

             <div className="shrink-0 flex items-center gap-3 justify-end z-20">
                 {/* CREDITS INDICATOR (HIDDEN ON MOBILE) */}
                 <div className={`hidden md:flex px-3 py-1.5 rounded-full backdrop-blur-xl border items-center gap-2 shadow-lg transition-colors ${!isStandardMode ? 'bg-black/30 border-white/10' : 'bg-white/5 border-white/5'}`}>
                    {!isStandardMode ? <Zap size={14} className="text-amber-300" fill="currentColor" /> : <Leaf size={14} className="text-gray-400" fill="currentColor" />}
                    <span className={`text-xs font-mono font-bold ${!isStandardMode ? 'text-white/60' : 'text-gray-400'}`}>
                        {!isStandardMode && localCredits > 100 ? '∞' : `${localCredits} Premium`}
                    </span>
                 </div>

                 {/* HEADPHONE ICON */}
                 <button onClick={() => toggleVoiceMode()} className={`shrink-0 w-10 h-10 rounded-full border border-white/10 backdrop-blur-xl flex items-center justify-center transition-all shadow-lg ${isVoiceMode ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-black/20 text-white/70 hover:bg-white/10 hover:text-white'}`}>
                    <Headphones size={18} />
                 </button>

                 <motion.div
                    initial={false}
                    animate={{ width: isSearchOpen ? (isMobile ? 200 : 300) : 40 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`flex items-center h-10 rounded-full border ${isSearchOpen ? 'bg-black/60 border-white/10 px-3' : 'bg-black/20 border-transparent justify-center'}`}
                 >
                     {isSearchOpen ? (
                         <>
                            <motion.input
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                onBlur={() => !searchQuery && setIsSearchOpen(false)}
                                placeholder="Search..."
                                className="bg-transparent border-none outline-none text-xs text-white w-full min-w-0 placeholder-white/30"
                            />
                            {searchQuery ? (
                                <div className="flex items-center gap-0.5 shrink-0">
                                    <span className="text-[9px] text-white/30 whitespace-nowrap mr-1">{searchResults.length > 0 ? `${currentMatchIndex + 1}/${searchResults.length}` : '0'}</span>
                                    <button onMouseDown={e => e.preventDefault()} onClick={nextMatch} className="p-1 hover:text-white text-white/40"><ChevronDown size={12}/></button>
                                    <button onMouseDown={e => e.preventDefault()} onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }} className="p-1 hover:text-white text-white/40"><X size={12}/></button>
                                </div>
                            ) : (
                                <button onMouseDown={e => e.preventDefault()} onClick={() => setIsSearchOpen(false)} className="shrink-0 text-white/40 hover:text-white"><X size={14}/></button>
                            )}
                         </>
                     ) : (
                         <button onClick={() => setIsSearchOpen(true)} className="text-white/60 hover:text-white w-full h-full flex items-center justify-center">
                            <Search size={18} />
                         </button>
                     )}
                 </motion.div>
             </div>
        </div>
      </div>
      
      <AnimatePresence>{error && <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-red-500/10 border border-red-500/20 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 text-red-200 text-sm shadow-xl cursor-pointer" onClick={() => setError(null)}><AlertCircle size={16} /> {error}</motion.div>}</AnimatePresence>

      {/* --- SECTION 2: CHAT AREA (FLEXIBLE SCROLL) --- */}
      {/* CRITICAL FIXES HERE:
         1. flex-1: Tells this div to occupy all remaining vertical space.
         2. min-h-0: Prevents the div from expanding beyond the parent height. Forces scroll.
         3. w-full: Ensures width constraints.
      */}
      <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden px-4 md:px-6 py-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          style={{ 
              width: '100%',
              overflowAnchor: 'none'
          }}
      >
          {renderMessages()}
          <div ref={messagesEndRef} />
      </div>

      {/* Jump to Bottom Button - MOVED OUTSIDE THE SCROLL DIV so it floats above */}
      <AnimatePresence>
        {showScrollDown && (
            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={scrollToBottom}
                // Adjusted positioning to be safe above the input area
                className="fixed bottom-28 md:bottom-32 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/10 text-white/80 p-2 rounded-full shadow-xl z-20 hover:bg-white/10 hover:text-white transition-colors"
            >
                <ArrowDown size={20} />
            </motion.button>
        )}
      </AnimatePresence>

      {/* --- SECTION 3: INPUT AREA (FIXED HEIGHT) --- */}
      <div className={`shrink-0 w-full pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pb-[env(safe-area-inset-bottom)] pt-2 z-30 max-w-[700px] mx-auto ${isMobile ? 'bg-gradient-to-t from-black via-black/80 to-transparent' : 'md:pb-6 bg-none'}`}>
          <div className="flex flex-col gap-2">
             <AnimatePresence>
                 {replyingTo && (
                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="self-center w-[95%] bg-black/60 backdrop-blur-xl border border-white/10 rounded-t-2xl border-b-0 p-3 flex justify-between items-center text-xs text-white/70 shadow-lg">
                         <div className="flex items-center gap-2 truncate"><Reply size={12} className="text-white/40" /><span className="italic truncate max-w-[200px]">"{replyingTo}"</span></div>
                         <button onClick={() => setReplyingTo(null)} className="hover:text-white"><X size={14} /></button>
                     </motion.div>
                 )}
                 {attachedImage && (
                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="self-center relative group mb-1">
                         <img src={attachedImage} alt="Attachment" className="h-24 rounded-xl border border-white/20 shadow-2xl" />
                         <button onClick={() => setAttachedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"><X size={12} /></button>
                     </motion.div>
                 )}
             </AnimatePresence>

             {/* SMART CONTEXT CHIPS */}
             <AnimatePresence>
             {suggestedChips.length > 0 || messages.length <= 2 ? (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-x-auto scrollbar-hide flex gap-2 mb-2 px-1 relative pr-8"
                >
                    {(() => {
                        const isNewUser = messages.length <= 2;
                        let chips = suggestedChips.length > 0 ? suggestedChips : (
                             isNewUser ? ["Who are you?", "What can you do?", "I'm stressed"] :
                             ["Roast me", "Inspire me", "Let's jam"]
                        );

                        return chips.map((chip, i) => (
                            <button
                                key={i}
                                onClick={() => handleSend(undefined, chip)}
                                className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white/70 whitespace-nowrap transition-colors"
                            >
                                {chip}
                            </button>
                        ));
                    })()}

                    {/* Dismiss Button */}
                    <button
                        onClick={() => setSuggestedChips([])}
                        className="sticky right-0 bg-black/40 backdrop-blur-sm p-1.5 rounded-full border border-white/10 text-white/40 hover:text-white hover:bg-white/10 ml-2"
                    >
                        <X size={12} />
                    </button>
                </motion.div>
             ) : null}
             </AnimatePresence>

             {/* INPUT AREA */}
             <div id="chat-input-area" className={`relative flex items-center gap-3 bg-[#0a0e17]/60 backdrop-blur-3xl border ${uiAction === 'listen' ? 'border-teal-500/50 shadow-[0_0_15px_rgba(45,212,191,0.2)]' : 'border-white/5'} p-2 pr-2 pl-3 shadow-2xl transition-all ${replyingTo ? 'rounded-b-[2rem] rounded-t-none' : 'rounded-[2rem]'}`}>
                 {uiAction === 'listen' && (
                     <div className="absolute -top-8 left-0 right-0 flex justify-center pointer-events-none">
                         <motion.div
                             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                             className="bg-teal-500/20 text-teal-200 text-xs px-3 py-1 rounded-full backdrop-blur-md border border-teal-500/30 flex items-center gap-2"
                         >
                             <Headphones size={12} /> Listening Mode Active
                         </motion.div>
                     </div>
                 )}

                    <>
                    <div className="flex items-center gap-1 relative">
                        {/* UNIFIED MEDIA BUTTON */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isStandardMode}
                            className={`p-2.5 rounded-full transition-all relative ${attachedImage ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'} ${isStandardMode ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                            <ImageIcon size={20} />
                        </button>

                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageSelect} />

                        {/* DICTATION MIC */}
                        <button onClick={toggleDictation} className={`p-2.5 rounded-full transition-all ${isDictating ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}>
                            {isDictating ? <MicOff size={20} /> : <Mic size={20} />}
                        </button>
                    </div>

                    <form onSubmit={handleSend} className="flex-1 flex items-center relative h-full">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInput}
                            onKeyDown={handleKeyPress}
                            onPaste={handlePaste}
                            placeholder={isDictating ? "Listening..." : (uiAction === 'listen' ? "I'm listening..." : "Type a message...")}
                            className="w-full bg-transparent text-white placeholder-white/30 focus:outline-none text-base font-light py-3 px-2 resize-none max-h-32 scrollbar-hide"
                            rows={1}
                        />
                        <div className="relative">
                            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 transition-colors ${showEmojiPicker ? 'text-white' : 'text-white/30 hover:text-white'}`}>
                                <Smile size={20} />
                            </button>
                            {showEmojiPicker && (
                                <div className="absolute bottom-14 right-0 shadow-2xl z-50">
                                    <EmojiPicker
                                        theme={Theme.DARK}
                                        emojiStyle={EmojiStyle.APPLE}
                                        onEmojiClick={(e) => { setInput(prev => prev + e.emoji); }}
                                        lazyLoadEmojis={true}
                                        width={300}
                                        height={400}
                                        searchDisabled={false}
                                        skinTonesDisabled={false}
                                    />
                                </div>
                            )}
                        </div>
                    </form>

                    <button onClick={(e) => handleSend(e)} disabled={!input.trim() && !attachedImage} className="p-3.5 rounded-full text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-1" style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #4f46e5)` }}>
                        <Send size={18} className="ml-0.5" fill="currentColor" />
                    </button>
                    </>
             </div>
          </div>
      </div>
    </div>
  );
};
