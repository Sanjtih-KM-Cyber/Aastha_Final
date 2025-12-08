import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Menu, Headphones, AlertCircle, Smile, Copy, Reply, 
  Mic, MicOff, X, Zap, Leaf, Search, Image as ImageIcon,
  Sparkles, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { MessageBubble } from './MessageBubble';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

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
}

// --- Dynamic API URL Helper ---
const getApiUrl = (endpoint: string) => {
  // Use the environment variable if available (e.g., from .env or Vercel)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return `${envUrl}${endpoint}`;
  }
  // Fallback (mostly for local dev if .env is missing)
  const host = window.location.hostname;
  // If we are on localhost, assume local backend on 5000
  if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:5000/api${endpoint}`;
  }
  // Otherwise, use relative path (if proxy is set up) or expect VITE_API_URL to be set
  // For safety, we can default to the provided Render URL if not on localhost
  return `https://aastha-final.onrender.com/api${endpoint}`;
};

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

export const ChatView: React.FC<ChatViewProps> = ({ onMobileMenuClick, onOpenWidget }) => {
  const { user } = useAuth();
  const { setTheme, currentTheme } = useTheme();
  const navigate = useNavigate();
  
  const botName = user?.persona === 'aarav' ? 'Aastik' : 'Aastha';

  // --- State Management ---
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFlash, setShowFlash] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Interactions
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ msgId: string, matchIndex: number }[]>([]); // Flattened list of all matches
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Voice & Dictation
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDictating, setIsDictating] = useState(false); 
  const [transcript, setTranscript] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem('user_tts_enabled') === 'true');
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(() => localStorage.getItem('user_voice_uri'));
  
  // Credits & Mode
  const [localCredits, setLocalCredits] = useState(user?.credits || 0);
  const [modelMode, setModelMode] = useState<'pro' | 'eco'>(user?.credits && user.credits > 0 ? 'pro' : 'eco');
  const [isStandardMode, setIsStandardMode] = useState(false);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedTagsRef = useRef<Set<string>>(new Set());

  // 1. Sync User Credits
  useEffect(() => {
      if (user) {
          const credits = user.credits || 0;
          const isPremium = user.isPro || credits > 0;
          
          setIsStandardMode(!isPremium);
          setLocalCredits(user.isPro ? 9999 : credits);
          setModelMode(isPremium ? 'pro' : 'eco');
      }
  }, [user]);

  // 2. Initial History Load (Redirects on 401)
  useEffect(() => {
     const fetchHistory = async () => {
         try {
             const res = await fetch(getApiUrl('/chat/history'), { credentials: 'include' });
             
             if (!res.ok) { 
                 if (res.status === 401) {
                    navigate('/login'); 
                    return;
                 }
                 throw new Error("Failed to fetch history"); 
             }
             
             const data = await res.json();
             if (Array.isArray(data) && data.length > 0) {
                 setMessages(data);
                 setTimeout(() => scrollToBottom(), 100);
             } else {
                 setMessages([{ role: 'assistant', content: `Hi ${user?.name || 'friend'}, I am ${botName}. How can I support you right now?`, timestamp: Date.now() }]);
             }
         } catch (e) { 
             setMessages([{ role: 'assistant', content: `Hi ${user?.name || 'friend'}, I am ${botName}. I'm ready to listen.`, timestamp: Date.now() }]);
         }
     };
     
     if (user) fetchHistory();
  }, [user, navigate]);

  // 3. Voice Synthesis Setup
  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // 4. Speech Recognition Setup
  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
          setIsListening(false);
          // If in voice mode and not manually stopped, restart?
          // No, usually we stop after sending. But if connection dropped, maybe notify.
      };
      recognition.onerror = (event: any) => {
          console.error("Speech Recognition Error:", event.error);
          if (event.error === 'not-allowed') {
              setError("Microphone access denied. Please check browser settings.");
              setIsVoiceMode(false);
          }
      };

      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
           currentText += event.results[i][0].transcript;
        }
        
        if (isDictating) {
            // For dictation, we append only final results or handle interim differently
            // Here, simplicity: if isFinal, append.
            const isFinal = event.results[event.results.length - 1].isFinal;
            if (isFinal) {
                setInput(prev => {
                    const spacer = prev.length > 0 && !prev.endsWith(' ') ? ' ' : '';
                    return prev + spacer + currentText;
                });
                if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
                }
                // Don't stop immediately if continuous, but for simple dictation, maybe stop?
                // The previous logic stopped immediately which is why it felt broken.
                // Let's keep listening until user toggles off, or just update input.
            }
        } else {
            // Voice Mode
            setTranscript(currentText);
            const isFinal = event.results[event.results.length - 1].isFinal;

            // Only send on silence timer OR if final result is clear
            if (currentText.trim().length > 0) {
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                // Reduce silence timer for snappier response
                silenceTimerRef.current = setTimeout(() => { handleVoiceSend(currentText); }, 1500);
            }
        }
      };
      recognitionRef.current = recognition;
    } else {
        console.warn("Speech Recognition API not supported in this browser.");
    }
  }, [isDictating]);

  // --- Handlers ---
  const startListening = () => { if (recognitionRef.current && !isListening) { try { setTranscript(''); recognitionRef.current.start(); } catch (e) { console.error("Speech start failed", e); } } };
  const stopListening = () => { if (recognitionRef.current && isListening) recognitionRef.current.stop(); };
  
  const toggleVoiceMode = () => {
    // @ts-ignore
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        setError("Your browser does not support Voice Mode. Try Chrome or Edge.");
        return;
    }
    if (isStandardMode) {
        alert("Voice Mode requires Premium Credits. Upgrade to Pro.");
        return;
    }
    if (isVoiceMode) {
        stopListening();
        setIsVoiceMode(false);
    } else {
        // If Dictation is active, swap seamlessly without stopping recognition
        if (isDictating) {
            setIsDictating(false);
            setIsVoiceMode(true);
            return;
        }
        setIsVoiceMode(true);
        startListening();
    }
  };
  
  const toggleDictation = () => {
      // @ts-ignore
      if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
          setError("Dictation not supported.");
          return;
      }
      if (isDictating) {
          recognitionRef.current?.stop();
          setIsDictating(false);
      } else {
          // If Voice Mode is active, swap seamlessly without stopping recognition
          if (isVoiceMode) {
              setIsVoiceMode(false);
              setIsDictating(true);
              return;
          }
          try { recognitionRef.current?.start(); setIsDictating(true); } catch(e) { console.error("Dictation start failed", e); }
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
      if (isStandardMode) {
          setError("Vision Analysis requires Premium Credits. Upgrade to Pro.");
          setTimeout(() => setError(null), 3000);
          if (fileInputRef.current) fileInputRef.current.value = ''; // Clear input to allow retry
          return;
      }
      if (e.target.files && e.target.files[0]) {
          try {
            const compressed = await compressImage(e.target.files[0]);
            setAttachedImage(compressed);
          } catch (err) { 
            console.error("Image compression error:", err);
            setError("Failed to process image. Please try another."); 
          }
      }
      // Reset value so same file can be selected again if cleared
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(e => {
            console.error("Clipboard write failed:", e);
            alert("Copy failed (Browser restriction). Please use manual copy.");
        });
    } else {
        console.warn("Clipboard API unavailable/blocked.");
        alert("Clipboard API unavailable. Please use manual copy.");
    }
  };
  
  const handleReply = (content: string) => {
      setReplyingTo(content);
      textareaRef.current?.focus();
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  };

  // --- Main Send Logic ---
  const handleSend = async (e?: React.FormEvent, overrideInput?: string) => {
    e?.preventDefault();
    const textToSend = overrideInput || input;
    if (!textToSend.trim() && !attachedImage) return;

    let finalContent = textToSend;
    if (replyingTo) {
        finalContent = `> Replying to: "${replyingTo}"\n\n${textToSend}`;
        setReplyingTo(null);
    }
    if (attachedImage) {
        finalContent = `[Image Attached] ${finalContent}`;
    }

    const userMsg: ChatMessage = {
        role: 'user',
        content: finalContent,
        timestamp: Date.now(),
        id: `local-${Date.now()}` // Assign ID for search
    };
    setMessages(prev => [...prev, userMsg]);
    
    setInput(''); setAttachedImage(null); setShowEmojiPicker(false); setIsTyping(true); setError(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      const response = await fetch(getApiUrl('/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({ message: textToSend, image: attachedImage }), 
      });

      if (!response.ok) {
          if (response.status === 401) {
              alert("Session expired. Redirecting to login.");
              navigate('/login');
              return;
          }
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.message || `${botName} is unreachable.`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      const newModelMessageId = Date.now().toString();
      // Clear processed tags for new message
      processedTagsRef.current.clear();

      setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: '', 
          timestamp: Date.now(), 
          id: newModelMessageId
      }]);
      
      let aiContentRaw = '';
      let buffer = '';
      let warningFromBackend = '';

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
                            if (data.meta.warning) warningFromBackend = data.meta.warning;
                        }
                        
                        if (data.content) {
                            aiContentRaw += data.content;
                            const cleanContent = processMagicTags(aiContentRaw);
                            
                            setMessages(prev => prev.map(msg => {
                                if (msg.id === newModelMessageId) {
                                    return { 
                                        ...msg, 
                                        content: cleanContent, 
                                        warning: warningFromBackend || msg.warning 
                                    };
                                }
                                return msg;
                            }));
                        }
                    } catch (e: any) {
                        if (e.message && e.message.includes("Upgrade")) setError(e.message);
                    }
                }
            }
        }
      }
      
      const cleanFinal = processMagicTags(aiContentRaw);
      if ((isVoiceMode || ttsEnabled) && aiContentRaw) speakMessage(cleanFinal);

    } catch (error: any) {
      setError(error.message || "Connection failed");
      setIsTyping(false);
      // We can't access modelMessageId/newModelMessageId here easily if it was local to the try block
      // But we can filter out empty assistant messages if needed, or just leave it.
      // Ideally, define the ID before the try block if we want to use it here.
    } finally { setIsTyping(false); }
  };

  const processMagicTags = (text: string) => {
    // 1. Scan for <color> tags specifically in the full text
    const colorRegex = /<color>([^<]+)<\/color>/gi;
    let match;
    while ((match = colorRegex.exec(text)) !== null) {
        const fullTag = match[0];
        const colorValue = match[1].trim();

        if (!processedTagsRef.current.has(fullTag)) {
             if (!showCountdown) {
                setShowCountdown(true);
                setCountdownNum(3);
                const timer = setInterval(() => {
                    setCountdownNum(prev => {
                        if (prev <= 1) {
                            clearInterval(timer);
                            setShowCountdown(false);
                            setShowFlash(true);
                            setTimeout(() => {
                                setTheme(colorValue);
                                setTimeout(() => setShowFlash(false), 500);
                            }, 300);
                            return 0;
                        }
                        return prev - 1;
                    });
                }, 1000);
             }
             processedTagsRef.current.add(fullTag);
        }
    }

    // 2. Scan for self-closing or other tags
    const otherTags = text.match(/<[^>]+>/gi);
    if (otherTags) {
        otherTags.forEach(tag => {
            if (processedTagsRef.current.has(tag)) return;
            const lowerTag = tag.toLowerCase();

            if (onOpenWidget) {
                if (lowerTag.includes('<recommend_breathing')) {
                     const m = tag.match(/mode="([^"]+)"/i);
                     onOpenWidget('breathing', { initialMode: m ? m[1] : undefined });
                } else if (lowerTag.includes('<open_breathing')) {
                     onOpenWidget('breathing');
                }

                if (lowerTag.includes('<open_soundscape')) {
                    const m = tag.match(/preset="([^"]+)"/i);
                    onOpenWidget('soundscape', { preset: m ? m[1] : undefined });
                }

                if (lowerTag.includes('<open_diary')) onOpenWidget('diary');
                if (lowerTag.includes('<open_mood_tracker')) onOpenWidget('mood');
                if (lowerTag.includes('<open_pomodoro')) onOpenWidget('pomodoro');
                if (lowerTag.includes('<open_jam-with-aastha')) onOpenWidget('jam');
                if (lowerTag.includes('<farewell')) { /* Optional: Trigger logout or farewell anim */ }
            }

            processedTagsRef.current.add(tag);
        });
    }

    // Strip all tags
    return text.replace(/<[^>]*>/g, ''); 
  };

  const speakMessage = (text: string) => {
    if ('speechSynthesis' in window) {
       window.speechSynthesis.cancel();
       // Remove markdown, emojis, and special chars for TTS
       const cleanText = text
         .replace(/[*#]/g, '') // remove markdown
         .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, ''); // remove emojis

       const utterance = new SpeechSynthesisUtterance(cleanText);
       const voices = window.speechSynthesis.getVoices();
       let chosenVoice = voices.find(v => v.voiceURI === selectedVoiceURI) || voices.find(v => v.name.includes('Google US English'));
       if (chosenVoice) utterance.voice = chosenVoice;
       utterance.onend = () => {
           // In "Talk like in a call" mode, we want to immediately listen again
           if (isVoiceMode) {
               // Small delay to prevent catching own echo
               setTimeout(() => startListening(), 300);
           }
       };
       window.speechSynthesis.speak(utterance);
    }
  };

  const getDateLabel = (timestamp: number) => {
      const date = new Date(timestamp);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) return 'Today';
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // --- Search Logic ---
  useEffect(() => {
      if (searchQuery.trim()) {
          const hits: { msgId: string, matchIndex: number }[] = [];

          messages.forEach(msg => {
             const lowerContent = msg.content.toLowerCase();
             const lowerQuery = searchQuery.toLowerCase();

             // Count occurrences in this message
             const parts = lowerContent.split(lowerQuery);
             // If split results in N parts, there are N-1 matches
             const matchCount = parts.length - 1;

             if (matchCount > 0 && msg.id) {
                 for (let i = 0; i < matchCount; i++) {
                     hits.push({ msgId: msg.id, matchIndex: i });
                 }
             }
          });

          setSearchResults(hits);
          setCurrentMatchIndex(hits.length > 0 ? hits.length - 1 : 0); // Start at latest
      } else {
          setSearchResults([]);
          setCurrentMatchIndex(0);
      }
  }, [searchQuery, messages]);

  // Find target ID for scrolling
  useEffect(() => {
      if (searchResults.length > 0 && searchResults[currentMatchIndex]) {
          const { msgId } = searchResults[currentMatchIndex];
          const el = document.getElementById(`msg-${msgId}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  }, [currentMatchIndex, searchResults]);

  const nextMatch = () => setCurrentMatchIndex(prev => (prev + 1) % searchResults.length);
  const prevMatch = () => setCurrentMatchIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);

  const renderMessages = () => {
      // We do NOT filter messages anymore, we show all and highlight
      let lastDateLabel = '';

      return messages.map((msg, idx) => {
          const dateLabel = getDateLabel(msg.timestamp || Date.now());
          const showSeparator = dateLabel !== lastDateLabel;
          lastDateLabel = dateLabel;

          // Provide an ID for scrolling if it doesn't have one (generate on fly if needed, but safer to use state)
          const domId = `msg-${msg.id || idx}`;

          // Determine if this message contains the *currently active* match
          // and which specific instance of the word it is
          let currentMatchIndexInMessage = -1;

          if (searchResults.length > 0) {
              const currentMatch = searchResults[currentMatchIndex];
              if (currentMatch && currentMatch.msgId === msg.id) {
                  currentMatchIndexInMessage = currentMatch.matchIndex;
              }
          }

          const isCurrentlyStreaming = isTyping && msg.role === 'assistant' && idx === messages.length - 1;

          return (
             <React.Fragment key={domId}>
                {showSeparator && (
                    <div className="flex justify-center my-8">
                        <span className="bg-black/30 backdrop-blur-md border border-white/5 text-white/50 text-[10px] font-medium px-4 py-1 rounded-full uppercase tracking-widest shadow-sm">
                            {dateLabel}
                        </span>
                    </div>
                )}
                <div id={domId} className="flex flex-col w-full">
                    <MessageBubble 
                        role={msg.role} 
                        content={msg.content} 
                        timestamp={msg.timestamp}
                        onReply={() => handleReply(msg.content)} 
                        onCopy={copyToClipboard}
                        searchQuery={searchQuery}
                        currentMatchIndex={currentMatchIndexInMessage}
                        isStreaming={isCurrentlyStreaming} 
                    />
                    {msg.warning && (
                        <div className="flex items-center justify-center gap-1.5 text-[10px] text-white/30 -mt-3 mb-4">
                            <ShieldAlert size={10} /> {msg.warning}
                        </div>
                    )}
                </div>
             </React.Fragment>
          );
      });
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center overflow-hidden">
      
      {/* 1. Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none transition-colors duration-1000 ease-in-out" 
           style={{ background: `radial-gradient(circle at 50% 30%, ${currentTheme.primaryColor}22 0%, #0a0e17 70%)` }} />
      <div className="absolute inset-0 z-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay" />

      {/* 2. Flash Effect & Countdown */}
      <AnimatePresence>
          {showCountdown && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 pointer-events-none">
                  <motion.div
                    key={countdownNum}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    exit={{ scale: 2, opacity: 0 }}
                    className="text-white text-9xl font-bold font-serif"
                  >
                      {countdownNum}
                  </motion.div>
              </motion.div>
          )}
          {showFlash && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-white pointer-events-none" />}
      </AnimatePresence>

      {/* 3. Full Screen Voice Mode Overlay */}
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

      {/* 4. Header (Dynamic Island) */}
      <motion.div initial={{ y: -50 }} animate={{ y: 0 }} className="absolute top-0 w-full z-30 pt-6 px-4 pointer-events-none flex justify-center">
         
         {/* Mobile Menu Trigger */}
         <div className="absolute left-4 top-6 pointer-events-auto md:hidden">
            <button onClick={onMobileMenuClick} className="p-2.5 rounded-full bg-black/20 backdrop-blur-xl border border-white/10 text-white/70"><Menu size={20} /></button>
         </div>

         {/* The Pill Search Bar */}
         <div className="pointer-events-auto flex items-center bg-black/30 backdrop-blur-2xl border border-white/10 rounded-full pl-4 pr-2 py-2 shadow-2xl w-[280px] md:w-[400px] transition-all focus-within:w-[320px] md:focus-within:w-[450px] focus-within:bg-black/50 group">
             <Search size={16} className="text-white/30 group-focus-within:text-white/70 transition-colors mr-2" />
             <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="bg-transparent border-none outline-none text-sm text-white w-full" />
             {searchQuery && (
                 <div className="flex items-center gap-1 ml-2 border-l border-white/10 pl-2">
                     <span className="text-[10px] text-white/40 whitespace-nowrap">
                         {searchResults.length > 0 ? `${currentMatchIndex + 1}/${searchResults.length}` : '0/0'}
                     </span>
                     <button onClick={prevMatch} disabled={searchResults.length === 0} className="p-1 text-white/50 hover:text-white"><span className="text-xs">▲</span></button>
                     <button onClick={nextMatch} disabled={searchResults.length === 0} className="p-1 text-white/50 hover:text-white"><span className="text-xs">▼</span></button>
                     <button onClick={() => setSearchQuery('')} className="p-1 text-white/30 hover:text-white ml-1"><X size={14}/></button>
                 </div>
             )}
         </div>

         {/* Right Controls */}
         <div className="absolute right-4 top-6 pointer-events-auto flex items-center gap-3">
             <div className={`px-3 py-1.5 rounded-full backdrop-blur-xl border flex items-center gap-2 shadow-lg transition-colors ${!isStandardMode ? 'bg-black/30 border-white/10' : 'bg-white/5 border-white/5'}`}>
                {!isStandardMode ? <Zap size={14} className="text-amber-300" fill="currentColor" /> : <Leaf size={14} className="text-gray-400" fill="currentColor" />}
                <span className={`text-xs font-mono font-bold ${!isStandardMode ? 'text-white/60' : 'text-gray-400'}`}>
                    {!isStandardMode && localCredits > 100 ? '∞' : `${localCredits} Premium`}
                </span>
             </div>
             
             <button onClick={toggleVoiceMode} className="w-10 h-10 rounded-full bg-black/30 border border-white/10 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all shadow-lg relative group">
                <Headphones size={18} />
             </button>
         </div>
      </motion.div>

      {/* 5. Error Toast */}
      <AnimatePresence>{error && <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-24 z-40 bg-red-500/10 border border-red-500/20 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 text-red-200 text-sm shadow-xl cursor-pointer" onClick={() => setError(null)}><AlertCircle size={16} /> {error}</motion.div>}</AnimatePresence>

      {/* 6. Chat Area (Flex Layout) */}
      <div 
         ref={messagesContainerRef}
         className="flex-1 w-full max-w-4xl mx-auto overflow-y-auto px-4 md:px-8 scrollbar-hide flex flex-col pt-28"
      >
         <div className="flex flex-col mt-auto pb-4 min-h-0">
             {renderMessages()}
             <div ref={messagesEndRef} />
         </div>
      </div>

      {/* 7. Input Area (Static Footer) */}
      <div className="w-full px-4 pb-6 pt-2 shrink-0 max-w-[700px] mx-auto z-30">
         <div className="flex flex-col gap-2">
            
            {/* Contexts (Reply / Image) */}
            <AnimatePresence>
                {replyingTo && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="self-center w-[95%] bg-black/60 backdrop-blur-xl border border-white/10 rounded-t-2xl border-b-0 p-3 flex justify-between items-center text-xs text-white/70">
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

            {/* Main Bar */}
            <div className={`relative flex items-center gap-3 bg-[#0a0e17]/80 backdrop-blur-2xl border border-white/10 p-2 pr-2 pl-3 shadow-[0_0_40px_rgba(0,0,0,0.3)] transition-all ${replyingTo ? 'rounded-b-[2rem] rounded-t-none' : 'rounded-[2rem]'}`}>
                
                {/* Left Tools */}
                <div className="flex items-center gap-1">
                    <button onClick={() => fileInputRef.current?.click()} disabled={isStandardMode} className={`p-2.5 rounded-full transition-all relative ${attachedImage ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'} ${isStandardMode ? 'opacity-30 cursor-not-allowed' : ''}`}>
                        <ImageIcon size={20} />
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                    
                    <button onClick={toggleDictation} className={`p-2.5 rounded-full transition-all ${isDictating ? 'bg-red-500/20 text-red-400' : 'text-white/40 hover:bg-white/5 hover:text-white'}`}>
                        {isDictating ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                </div>

                {/* Input Field */}
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
                    
                    {/* Emoji Picker */}
                    <div className="relative">
                        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 transition-colors ${showEmojiPicker ? 'text-white' : 'text-white/30 hover:text-white'}`}>
                            <Smile size={20} />
                        </button>
                        {showEmojiPicker && (
                            <div className="absolute bottom-14 right-0 shadow-2xl z-50">
                                <EmojiPicker
                                    theme={Theme.DARK}
                                    emojiStyle={EmojiStyle.APPLE}
                                    onEmojiClick={(e) => {
                                        setInput(prev => prev + e.emoji);
                                        // Optional: Keep picker open or close it
                                        // setShowEmojiPicker(false);
                                    }}
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
                                    ] as any} // Cast to any if strict types complain about category names
                                />
                            </div>
                        )}
                    </div>
                </form>

                {/* Send Button */}
                <button 
                    onClick={(e) => handleSend(e)}
                    disabled={!input.trim() && !attachedImage} 
                    className="p-3.5 rounded-full text-white shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed ml-1" 
                    style={{ background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #4f46e5)` }}
                >
                    <Send size={18} className="ml-0.5" fill="currentColor" />
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};