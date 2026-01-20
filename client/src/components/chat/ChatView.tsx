import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Menu, Headphones, AlertCircle, Smile, 
  Mic, MicOff, X, Search, Image as ImageIcon, Plus, Camera,
  ShieldAlert, Loader2, ChevronDown, Reply
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
  reaction?: string; // New field for sticky reaction
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
  const [suggestedChips, setSuggestedChips] = useState<string[]>([]); // New State for Chips

  // Patience / Listening Mode State
  const [isWaitingForPermission, setIsWaitingForPermission] = useState(false);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Media Menu State
  const [showMediaMenu, setShowMediaMenu] = useState(false);

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

  // Silence Timer Logic (Listening Mode)
  useEffect(() => {
    if (uiAction === 'listen') {
        // Reset timer on any input or message
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
  }, [uiAction, messages, input]); // Reset on new messages or typing

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

    if (isVoiceMode) {
        // EXITING VOICE MODE
        stopListening();
        setIsVoiceMode(false);
        setTtsEnabled(false); // Auto-disable TTS
        localStorage.setItem('user_tts_enabled', 'false');
    } else {
        // ENTERING VOICE MODE
        if (isDictating) { setIsDictating(false); }

        setIsVoiceMode(true);
        setTtsEnabled(true); // Auto-enable TTS
        localStorage.setItem('user_tts_enabled', 'true');

        // Select Indian Voice if available
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

  // --- 5. SEND LOGIC ---
  const handleSend = async (e?: React.FormEvent, overrideInput?: string) => {
    if (e) e.preventDefault();
    
    const textToSend = overrideInput || input;
    if (!textToSend.trim() && !attachedImage) return;

    let finalContent = textToSend;
    if (replyingTo) { finalContent = `> Replying to: "${replyingTo}"\n\n${textToSend}`; setReplyingTo(null); }
    if (attachedImage) { finalContent = `[Image Attached] ${finalContent}`; }

    const userMsg: ChatMessage = { role: 'user', content: finalContent, timestamp: Date.now(), id: `local-${Date.now()}` };
    const tempBotId = `temp-${Date.now()}`;
    
    // Save the user's message immediately
    setMessages(prev => [
        ...prev, 
        userMsg,
        { role: 'assistant', content: '', timestamp: Date.now(), id: tempBotId } 
    ]);
    
    setInput(''); setAttachedImage(null); setShowEmojiPicker(false); 
    setIsTyping(true); 
    setError(null);
    setStatusDisplay('Thinking...'); // Reset status
    autoResizeTextarea();

    try {
      let token = '';
      try {
        const storedInfo = localStorage.getItem('userInfo');
        if (storedInfo) token = JSON.parse(storedInfo).token;
      } catch(e) {}

      // ADDED: Permission Grant Flag
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
            images: attachedImage ? [attachedImage] : [],
            forceReply: isPermissionGrant // Tell backend to override listening mode
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

                        // Handle Hidden Thought
                        if (data.type === 'thought' && data.content) {
                            const thought = data.content;
                            console.log("Subconscious:", thought);
                            if (thought.status_display) setStatusDisplay(thought.status_display);
                            if (thought.ui_action) {
                                setUiAction(thought.ui_action);
                                // If listening, remove the optimistic bot bubble so it doesn't look like an empty message
                                if (thought.ui_action === 'listen') {
                                    setMessages(prev => prev.filter(m => m.id !== tempBotId));
                                }
                            }
                            if (thought.mood) setCurrentMood(thought.mood);

                            // Handle Dynamic Suggested Chips
                            if (thought.suggested_replies && Array.isArray(thought.suggested_replies)) {
                                setSuggestedChips(thought.suggested_replies);
                            }

                            if (thought.reaction) {
                                // Add sticky reaction to USER'S last message (or the one we replied to)
                                // If we are granting permission, we might want to react to the *previous* user msg.
                                // For now, simplest is react to the most recent user msg in the local state.
                                setMessages(prev => {
                                    // Find last user message
                                    const reversed = [...prev].reverse();
                                    const lastUserMsg = reversed.find(m => m.role === 'user');
                                    if (lastUserMsg) {
                                        return prev.map(m => m.id === lastUserMsg.id ? { ...m, reaction: thought.reaction } : m);
                                    }
                                    return prev;
                                });
                            }
                        }

                        // Handle Content Stream
                        if (data.content && !data.type) { // Standard content has no type usually, or text
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

      // If listen mode, clear any partial text if it was empty/minimal?
      // Actually, standard content stream will be empty if AI obeyed instructions, so cleanFinal will be empty.
      // If AI disobeyed and sent text despite 'listen', we show it (better safe).

      if ((isVoiceMode || ttsEnabled) && aiContentRaw) speakMessage(cleanFinal);

    } catch (error: any) {
      console.error(error);
      setMessages(prev => prev.filter(m => m.id !== tempBotId)); 
      setError(error.message || "Connection failed.");
    } finally { setIsTyping(false); }
  };

  const processMagicTags = (text: string) => {
    // Legacy Tag Processing (Retained for backward compat, but Proposal tags are handled in MessageBubble)
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
            // Only handle LEGACY simple tags here. Complex proposals are handled by MessageBubble click.
            if (onOpenWidget) {
                // If it's a Proposal tag, IGNORE it here (don't strip it yet, let UI render it)
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
    // Don't strip proposal tags here, MessageBubble needs them
    cleanText = cleanText.replace(/<(?!proposal)[^>]+>/g, '');
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
                {/* 🛡️ FIX 2: Added overflow-visible to message wrapper */}
                <div id={domId} className="flex flex-col w-full shrink-0 overflow-visible">
                    <MessageBubble 
                        role={msg.role} 
                        content={msg.content} 
                        timestamp={msg.timestamp}
                        reaction={msg.reaction} // Pass Reaction
                        mood={currentMood} // Pass Mood for Avatar
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

  // ==================================================================================
  // MAIN LAYOUT (RESPONSIVE FIXES APPLIED)
  // ==================================================================================
  return (
    <div className="relative w-full h-[100dvh] flex flex-col md:block items-center overflow-hidden bg-transparent">
      
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

      {/* --- SECTION 1: HEADER (SMART HEADER) --- */}
      {/* Responsive Height & Gradient */}
      <div className={`shrink-0 w-full z-30 pt-safe px-4 pb-2 pointer-events-auto ${isMobile ? 'bg-gradient-to-b from-black/80 to-transparent' : 'md:absolute md:top-0 md:pt-6 bg-none'}`}>
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
                                            // Reset timer to wait another 15s
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
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/20 backdrop-blur-xl border border-white/5 shadow-lg"
                            >
                                <div className={`w-2 h-2 rounded-full ${currentActivity === 'Online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-amber-400 animate-pulse'}`} />
                                <span className="text-xs font-medium text-white/80 tracking-wide uppercase">{statusDisplay}</span>
                            </motion.div>
                        )
                    )}
                 </AnimatePresence>
             </div>

             <div className="shrink-0 flex items-center gap-3 justify-end z-20">
                 <div className={`flex items-center transition-all duration-300 ease-spring ${isSearchOpen ? 'w-[200px] md:w-[300px] bg-black/40 border-white/10 px-3' : 'w-10 bg-black/20 border-transparent justify-center'} h-10 rounded-full backdrop-blur-xl border`}>
                     {isSearchOpen ? (
                         <>
                            <input
                                autoFocus
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                onBlur={() => !searchQuery && setIsSearchOpen(false)}
                                placeholder="Search history..."
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
                 </div>

                 <button id="voice-mode-btn" onClick={toggleVoiceMode} className={`shrink-0 w-10 h-10 rounded-full border border-white/10 backdrop-blur-xl flex items-center justify-center text-white/70 hover:text-white transition-all shadow-lg ${isVoiceMode ? 'bg-white/20 text-white' : 'bg-black/20 hover:bg-white/10'}`}>
                    <Headphones size={18} />
                 </button>
             </div>
          </div>
      </div>
      
      <AnimatePresence>{error && <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-red-500/10 border border-red-500/20 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-3 text-red-200 text-sm shadow-xl cursor-pointer" onClick={() => setError(null)}><AlertCircle size={16} /> {error}</motion.div>}</AnimatePresence>

      {/* --- SECTION 2: CHAT AREA (THE FIX) --- */}
      {/* 🛡️ FIX 1: Removed max-w-4xl to stop desktop clipping
          🛡️ FIX 2: Added overflow-visible to children loops (in renderMessages)
          🛡️ FIX 3: Removed overflow-x-hidden (S23 Fix: Stops sideways clipping)
      */}
      <div 
          ref={messagesContainerRef}
          className="flex-1 w-full max-w-full mx-auto overflow-y-auto overflow-x-hidden px-4 sm:px-6 md:px-8 scrollbar-hide min-h-0 md:h-full md:pt-28 md:pb-0 z-10"
          style={{ overscrollBehaviorY: 'contain' }}
      >
          <div className="flex flex-col min-h-full justify-end pb-[18vh] md:pb-40">
              <div className="h-4" /> 
              {renderMessages()}
              <div ref={messagesEndRef} />
          </div>
      </div>

      {/* --- SECTION 3: INPUT AREA --- */}
      {/* Responsive bottom padding (pb-safe) handles Home Indicator */}
      <div className={`shrink-0 w-full px-4 pb-safe pt-2 z-30 max-w-[700px] mx-auto ${isMobile ? 'bg-gradient-to-t from-black via-black/80 to-transparent' : 'md:absolute md:bottom-0 md:left-1/2 md:-translate-x-1/2 md:pb-6 bg-none'}`}>
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
                        const hour = new Date().getHours();
                        const isLateNight = hour >= 23 || hour < 5;
                        const isNewUser = messages.length <= 2;

                        // Use AI suggestions if available, else fall back to heuristics
                        let chips = suggestedChips.length > 0 ? suggestedChips : (
                             isNewUser ? ["Who are you?", "What can you do?", "I'm stressed"] :
                             isLateNight ? ["I can't sleep", "Tell me a story", "Play night sounds"] :
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

            {/* INPUT AREA (MODIFIED FOR LISTEN MODE) */}
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

                 <div className="flex items-center gap-1 relative">
                     {/* UNIFIED MEDIA BUTTON */}
                     {isMobile ? (
                         <div className="relative">
                             <button
                                type="button"
                                onClick={() => setShowMediaMenu(!showMediaMenu)}
                                disabled={isStandardMode}
                                className={`p-2.5 rounded-full transition-all ${showMediaMenu || attachedImage ? 'bg-white/10 text-white rotate-45' : 'text-white/40 hover:bg-white/5 hover:text-white'} ${isStandardMode ? 'opacity-30 cursor-not-allowed' : ''}`}
                             >
                                 <Plus size={22} />
                             </button>
                             <AnimatePresence>
                                 {showMediaMenu && (
                                     <motion.div
                                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                        className="fixed bottom-24 left-6 bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden min-w-[160px] z-[100] flex flex-col p-1.5"
                                     >
                                         <button onClick={() => { cameraInputRef.current?.click(); setShowMediaMenu(false); }} className="flex items-center gap-3 w-full p-3 hover:bg-white/5 rounded-xl text-left text-base text-white/90 active:bg-white/10 transition-colors">
                                             <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center"><Camera size={16} className="text-teal-400" /></div> Camera
                                         </button>
                                         <button onClick={() => { fileInputRef.current?.click(); setShowMediaMenu(false); }} className="flex items-center gap-3 w-full p-3 hover:bg-white/5 rounded-xl text-left text-base text-white/90 active:bg-white/10 transition-colors">
                                             <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center"><ImageIcon size={16} className="text-violet-400" /></div> Gallery
                                         </button>
                                     </motion.div>
                                 )}
                             </AnimatePresence>
                         </div>
                     ) : (
                         <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isStandardMode}
                            className={`p-2.5 rounded-full transition-all relative ${attachedImage ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'} ${isStandardMode ? 'opacity-30 cursor-not-allowed' : ''}`}
                         >
                             <ImageIcon size={20} />
                         </button>
                     )}

                     <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                     <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageSelect} />
                     
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
             </div>
          </div>
      </div>
    </div>
  );
};
