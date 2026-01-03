import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Menu, Headphones, AlertCircle, Smile, Copy, Reply, 
  Mic, MicOff, X, Zap, Leaf, Search, Image as ImageIcon,
  ShieldAlert, Loader2, ChevronUp, ChevronDown, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { MessageBubble } from './MessageBubble';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useSync } from '../../context/SyncContext';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  warning?: string;
  id?: string;
}

interface ChatViewProps {
  onMobileMenuClick?: () => void;
  onOpenWidget?: (widget: string, config?: any) => void;
  isMobile?: boolean;
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

export const ChatView: React.FC<ChatViewProps> = ({ onMobileMenuClick, onOpenWidget, isMobile = false }) => {
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  // --- SEARCH STATE ---
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

  // --- 1. SYNC & WEBSOCKET ---
  useEffect(() => {
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
    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
      if (user) {
          const credits = user.credits || 0;
          const isPremium = user.isPro || credits > 0;
          setIsStandardMode(!isPremium);
          setLocalCredits(user.isPro ? 9999 : credits);
          setModelMode(isPremium ? 'pro' : 'eco');
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
             const { default: api } = await import('../../services/api');
             const res = await api.get('/chat/history');
             if (isMounted) {
                 if (Array.isArray(res.data) && res.data.length > 0) {
                     setMessages(res.data);
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
            const isFinal = event.results[event.results.length - 1].isFinal;
            if (isFinal) {
                setInput(prev => prev + (prev.length > 0 ? ' ' : '') + currentText);
                autoResizeTextarea();
            }
        } else {
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
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const getApiUrl = (endpoint: string) => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) return `${envUrl}${endpoint}`;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return `http://${host}:5000/api${endpoint}`;
    return `https://aastha-final.onrender.com/api${endpoint}`;
  };

  const startListening = () => { if (recognitionRef.current && !isListening) { try { setTranscript(''); recognitionRef.current.start(); } catch (e) { console.error("Speech start", e); } } };
  const stopListening = () => { if (recognitionRef.current && isListening) recognitionRef.current.stop(); };
  
  const toggleVoiceMode = () => {
    // @ts-ignore
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) { setError("Browser not supported."); return; }
    if (isStandardMode) { alert("Voice Mode requires Premium."); return; }
    if (isVoiceMode) { stopListening(); setIsVoiceMode(false); } else {
        if (isDictating) { setIsDictating(false); setIsVoiceMode(true); return; }
        setIsVoiceMode(true); startListening();
    }
  };
  
  const toggleDictation = () => {
      // @ts-ignore
      if (!window.SpeechRecognition && !window.webkitSpeechRecognition) { setError("Dictation not supported."); return; }
      if (isDictating) { recognitionRef.current?.stop(); setIsDictating(false); } else {
          if (isVoiceMode) { setIsVoiceMode(false); setIsDictating(true); return; }
          try { recognitionRef.current?.start(); setIsDictating(true); } catch(e) {}
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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isStandardMode) { setError("Vision Analysis requires Premium."); return; }
      const files = e.target.files;
      if (files && files.length > 0) {
          try {
              const compressed = await compressImage(files[0]);
              setAttachedImage(compressed);
          } catch (err) { setError("Failed to process image."); }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
  };
  
  const handleReply = (content: string) => { setReplyingTo(content); textareaRef.current?.focus(); };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    autoResizeTextarea();
  };

  // ✅ MOBILE KEYPRESS FIX
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isMobile && e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        handleSend(); 
    }
  };

  // --- 5. SEND LOGIC (FIXED) ---
  const handleSend = async (e?: React.FormEvent, overrideInput?: string) => {
    if (e) e.preventDefault();
    
    const textToSend = overrideInput || input;
    if (!textToSend.trim() && !attachedImage) return;

    let finalContent = textToSend;
    if (replyingTo) { finalContent = `> Replying to: "${replyingTo}"\n\n${textToSend}`; setReplyingTo(null); }
    if (attachedImage) { finalContent = `[Image Attached] ${finalContent}`; }

    const userMsg: ChatMessage = { role: 'user', content: finalContent, timestamp: Date.now(), id: `local-${Date.now()}` };
    const tempBotId = `temp-${Date.now()}`;
    
    setMessages(prev => [
        ...prev, 
        userMsg,
        { role: 'assistant', content: '', timestamp: Date.now(), id: tempBotId } 
    ]);
    
    setInput(''); setAttachedImage(null); setShowEmojiPicker(false); 
    setIsTyping(true); 
    setError(null);
    autoResizeTextarea();

    try {
      let token = '';
      try {
        const storedInfo = localStorage.getItem('userInfo');
        if (storedInfo) token = JSON.parse(storedInfo).token;
      } catch(e) {}

      const streamResponse = await fetch(getApiUrl('/chat'), {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
        },
        credentials: 'include', 
        // ✅ FIX: Send 'images' as an array to match the server's expectation
        body: JSON.stringify({
            message: finalContent,
            images: attachedImage ? [attachedImage] : []
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
                        if (data.meta) { 
                            setLocalCredits(data.meta.credits === '∞' ? 9999 : Number(data.meta.credits)); 
                            setModelMode(data.meta.mode); 
                            setIsStandardMode(data.meta.mode === 'standard'); 
                        }
                        if (data.content) {
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
      if ((isVoiceMode || ttsEnabled) && aiContentRaw) speakMessage(cleanFinal);

    } catch (error: any) {
      console.error(error);
      setMessages(prev => prev.filter(m => m.id !== tempBotId)); 
      setError(error.message || "Connection failed.");
    } finally { setIsTyping(false); }
  };

  const processMagicTags = (text: string) => {
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
                if (lowerTag.includes('recommend_breathing')) { const m = lowerTag.match(/mode="([^"]+)"/i); onOpenWidget('breathing', { initialMode: m ? m[1] : undefined }); }
                if (lowerTag.includes('open_breathing')) onOpenWidget('breathing');
                if (lowerTag.includes('open_soundscape')) { const m = lowerTag.match(/preset="([^"]+)"/i); onOpenWidget('soundscape', { preset: m ? m[1] : undefined }); }
                if (lowerTag.includes('open_diary')) onOpenWidget('diary');
                if (lowerTag.includes('open_mood_tracker')) onOpenWidget('mood');
                if (lowerTag.includes('open_pomodoro')) onOpenWidget('pomodoro');
                if (lowerTag.includes('open_jam-with-aastha')) onOpenWidget('jam');
            }
            processedTagsRef.current.add(tag);
        });
    }
    let cleanText = text.replace(/<color>[\s\S]*?<\/color>/gi, '');
    cleanText = cleanText.replace(/<[^>]+>/g, '');
    return cleanText;
  };

  const speakMessage = (text: string) => {
    if ('speechSynthesis' in window) {
       window.speechSynthesis.cancel();
       const cleanText = text.replace(/[*#]/g, '').replace(/[\u{1F600}-\u{1F64F}]/gu, '');
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
                {/* PC Fix: Add padding bottom if it's the last message so it doesn't get covered */}
                <div id={domId} className={`flex flex-col w-full shrink-0 ${idx === messages.length - 1 ? 'md:pb-8' : ''}`}>
                    <MessageBubble 
                        role={msg.role} 
                        content={msg.content} 
                        timestamp={msg.timestamp}
                        onReply={() => handleReply(msg.content)} 
                        onCopy={copyToClipboard}
                        searchQuery={searchQuery}
                        currentMatchIndex={currentMatchIndexInMessage}
                        isStreaming={isCurrentlyStreaming} 
                        isMobile={isMobile} // ✅ Pass to MessageBubble
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

  // ==================================================================================
  // MAIN LAYOUT
  // Mobile: Flex Column (Strict Sections). PC: Absolute/Floating Overlay.
  // ==================================================================================
  return (
    // ✅ FIX 1: Removed bg-black from root.
    <div className="relative w-full h-[100dvh] flex flex-col md:block items-center overflow-hidden bg-transparent">
      
      {/* 1. GLOBAL BACKGROUNDS & WALLPAPER */}
      {/* ✅ FIX 2: Use FIXED to span entire screen behind menu and chat */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
          {/* WALLPAPER LOGIC */}
          {user?.wallpaper ? (
              <div 
                  className="w-full h-full bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${user.wallpaper})` }}
              >
                  {/* Dim overlay for readability */}
                  <div className="absolute inset-0 bg-black/60 md:bg-black/40" />
              </div>
          ) : (
              // Fallback: Dark on Mobile, Transparent on PC (letting parent background show)
              <div className="w-full h-full bg-[#0a0e17] md:bg-transparent" />
          )}
          
          {/* Noise Texture Overlay */}
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

      {/* --- SECTION 1: HEADER --- */}
      {/* Mobile: Relative/Flex item. PC: Absolute/Floating top */}
      {/* FIX: Removed gradient for PC (md:bg-none) to solve "Black Box" issue */}
      <div className={`shrink-0 w-full z-30 pt-safe px-4 pb-2 pointer-events-auto ${isMobile ? 'bg-gradient-to-b from-black/80 to-transparent' : 'md:absolute md:top-0 md:pt-6 bg-none'}`}>
          <div className="flex items-center gap-3 h-14 justify-between">
             {/* LEFT */}
             <div className="shrink-0 flex items-center">
                 {/* Mobile: Hamburger. PC: Empty or Menu if needed */}
                 <button onClick={onMobileMenuClick} className={`p-2.5 rounded-full backdrop-blur-md border border-white/5 text-white/70 bg-black/20 ${!isMobile ? 'md:hidden' : ''}`}>
                    <Menu size={20} />
                 </button>
             </div>

             {/* CENTER: Search Bar */}
             <div className="flex-1 min-w-0 relative group flex justify-center">
                 <div className={`flex items-center bg-black/30 backdrop-blur-2xl border border-white/10 rounded-full px-3 py-2 shadow-2xl transition-all focus-within:bg-black/50 focus-within:border-white/20 w-full ${!isMobile ? 'md:w-[400px]' : ''}`}>
                    <Search size={16} className="text-white/30 group-focus-within:text-white/70 transition-colors mr-2 shrink-0" />
                    
                    <input 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search..." 
                        className="bg-transparent border-none outline-none text-sm text-white w-full min-w-0 placeholder-white/20" 
                    />
                    
                    {searchQuery && (
                        <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-1 shrink-0">
                            <span className="text-[10px] text-white/40 whitespace-nowrap min-w-[24px] text-center">
                                {searchResults.length > 0 ? `${currentMatchIndex + 1}/${searchResults.length}` : '0/0'}
                            </span>
                            <button onClick={prevMatch} disabled={searchResults.length === 0} className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded"><ChevronUp size={14} /></button>
                            <button onClick={nextMatch} disabled={searchResults.length === 0} className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded"><ChevronDown size={14} /></button>
                            <button onClick={() => setSearchQuery('')} className="p-1 text-white/30 hover:text-white ml-1 hover:bg-white/10 rounded"><X size={14}/></button>
                        </div>
                    )}
                 </div>
             </div>

             {/* RIGHT: Controls */}
             <div className="shrink-0 flex items-center gap-3 justify-end">
                 {/* PC Only: Credits */}
                 <div className={`hidden md:flex px-3 py-1.5 rounded-full backdrop-blur-xl border items-center gap-2 shadow-lg transition-colors ${!isStandardMode ? 'bg-black/30 border-white/10' : 'bg-white/5 border-white/5'}`}>
                    {!isStandardMode ? <Zap size={14} className="text-amber-300" fill="currentColor" /> : <Leaf size={14} className="text-gray-400" fill="currentColor" />}
                    <span className={`text-xs font-mono font-bold ${!isStandardMode ? 'text-white/60' : 'text-gray-400'}`}>
                        {!isStandardMode && localCredits > 100 ? '∞' : `${localCredits}`}
                    </span>
                 </div>
                 
                 <button onClick={toggleVoiceMode} className="shrink-0 w-10 h-10 rounded-full border border-white/10 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white transition-all shadow-lg bg-black/30 hover:bg-white/10">
                    <Headphones size={18} />
                 </button>
             </div>
          </div>
      </div>
      
      {/* ERROR TOAST */}
      <AnimatePresence>{error && <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-red-500/10 border border-red-500/20 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 text-red-200 text-sm shadow-xl cursor-pointer" onClick={() => setError(null)}><AlertCircle size={16} /> {error}</motion.div>}</AnimatePresence>

      {/* --- SECTION 2: CHAT AREA --- */}
      {/* Mobile: Flex-1 scrollable. PC: Full height absolute (sort of), large bottom padding */}
      <div 
          ref={messagesContainerRef}
          className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto px-4 md:px-8 scrollbar-hide min-h-0 md:h-full md:pt-28 md:pb-0 z-10"
      >
          <div className="flex flex-col min-h-full justify-end pb-4 md:pb-40">
              <div className="h-4" /> 
              {renderMessages()}
              <div ref={messagesEndRef} />
          </div>
      </div>

      {/* --- SECTION 3: INPUT AREA --- */}
      {/* Mobile: Fixed bottom via Flex (shrink-0). PC: Absolute bottom/floating */}
      {/* FIX: Removed gradient for PC (md:bg-none) to solve "Black Box" issue */}
      <div className={`shrink-0 w-full px-4 pb-4 pt-2 z-30 max-w-[700px] mx-auto ${isMobile ? 'bg-gradient-to-t from-black via-black/80 to-transparent' : 'md:absolute md:bottom-0 md:left-1/2 md:-translate-x-1/2 md:pb-6 bg-none'}`}>
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

             <div className={`relative flex items-center gap-3 bg-[#0a0e17]/60 backdrop-blur-3xl border border-white/5 p-2 pr-2 pl-3 shadow-2xl transition-all ${replyingTo ? 'rounded-b-[2rem] rounded-t-none' : 'rounded-[2rem]'}`}>
                 <div className="flex items-center gap-1">
                     <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isStandardMode} className={`p-2.5 rounded-full transition-all relative ${attachedImage ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'} ${isStandardMode ? 'opacity-30 cursor-not-allowed' : ''}`}>
                         <ImageIcon size={20} />
                     </button>
                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} capture="environment" />
                     
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
                         placeholder={isDictating ? "Listening..." : "Type a message..."} 
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
                                     categories={[
                                         { name: 'Smileys', category: 'smileys_people' },
                                         { name: 'Nature', category: 'animals_nature' },
                                         { name: 'Food', category: 'food_drink' },
                                         { name: 'Activities', category: 'activities' },
                                         { name: 'Travel', category: 'travel_places' },
                                         { name: 'Objects', category: 'objects' },
                                         { name: 'Symbols', category: 'symbols' },
                                         { name: 'Flags', category: 'flags' },
                                     ] as any}
                                 />
                             </div>
                         )}
                     </div>
                 </form>

                 <button onClick={(e) => handleSend(e)} disabled={!input.trim() && !attachedImage} className="p-3.5 rounded-full text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-1" style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #4f46e5)` }}>
                     <Send size={18} className="ml-0.5" fill="currentColor" />
                 </button>
             </div>
          </div>
      </div>
    </div>
  );
};
