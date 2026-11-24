import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Menu, Headphones, AlertCircle, Smile, 
  Mic, MicOff, X, Search, Image as ImageIcon, Plus, Camera,
  ShieldAlert, Loader2, ChevronDown, Reply, Check, ArrowDown,
  UserPlus, Play, Pause, Lock, Zap, Leaf, AudioLines, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { toast } from 'react-hot-toast'; // Import Toast
import { MessageBubble } from './MessageBubble';
import { ThoughtCloudModal } from './ThoughtCloudModal';
import { SafetyBanner, SafetyInfo } from './SafetyBanner';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { useSync } from '../../context/SyncContext';
import api from '../../services/api';
import { chatCache } from '../../services/chatCache';
import { pendingReply, replyArrived } from '../../services/pendingReply';
import { seenNudge } from '../../services/seenNudge';
import { useSpecular } from '../../design/LiquidGlass';
import { useStreamingChat, StreamHttpError } from '../../hooks/useStreamingChat';
import { planLabel } from '../../utils/plan';
import { deviceTimeZone } from '../../utils/timeZone';
import { useVoiceRecorder, formatClock } from '../../hooks/useVoiceRecorder';
import { SettingsPanel } from '../settings/SettingsPanel';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  warning?: string;
  id?: string;
  reaction?: string;
  voice_note?: string;
  reasoning?: string;   // "think deeper" reasoning (shown collapsed)
  isThinking?: boolean;
  isClone?: boolean;    // written by Clone Mode → labelled "AI imitation"
  gif?: { url: string; width?: number; height?: number; title?: string; source?: string }; // GIF reaction
  myReaction?: string | null; // your ❤️ 😂 👍 on Aastha's reply (7.4)
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
  const { setTheme, currentTheme, isLowPowerMode } = useTheme(); // Consuming isLowPowerMode
  const { subscribe } = useSync();
  const navigate = useNavigate();
  
  const botName = user?.persona === 'aarav' ? 'Aastik' : 'Aastha';

  // --- STATE ---
  const [isInitializing, setIsInitializing] = useState(true);
  // Crisis/concern support banner (server sends {type:'safety'}), S9
  const [safetyInfo, setSafetyInfo] = useState<SafetyInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const hasAttemptedInit = useRef(false);
  const specular = useSpecular(); // Liquid Glass touch highlight
  const mountedRef = useRef(true);
  useEffect(() => {
      mountedRef.current = true;
      return () => { mountedRef.current = false; };
  }, []);
  
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
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

  // --- DEBOUNCE STATE ---
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);
  const sendDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Survive closing the app (services/pendingReply.ts): the debounced send can be fired early when the app goes to
  // the background, a dropped reply is fetched from history, and a stop by the user is told apart from an unmount.
  const debounceFireRef = useRef<(() => void) | null>(null);
  const recoveringRef = useRef(false);
  const userStoppedRef = useRef(false);

  // Subconscious State
  const [statusDisplay, setStatusDisplay] = useState(currentActivity || 'Online');
  const [uiAction, setUiAction] = useState<'none' | 'listen' | 'block_widget'>('none');
  const [currentMood, setCurrentMood] = useState('neutral');
  const [suggestedChips, setSuggestedChips] = useState<string[]>([]);
  const [chipsDismissed, setChipsDismissed] = useState(false); // ✕ hides the row (incl. starter chips) until new suggestions arrive

  // Thought Cloud
  const [showThoughtCloud, setShowThoughtCloud] = useState(false);
  const [lastSubconscious, setLastSubconscious] = useState<any>(null); // Store last brain data

  // Patience / Listening Mode State
  const [isWaitingForPermission, setIsWaitingForPermission] = useState(false);
  const silenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  // Auto-read is OFF by default and only changes from Settings (voice calls speak anyway, without touching it).
  const [ttsEnabled, setTtsEnabled] = useState(() => { try { return localStorage.getItem('user_tts_enabled_v2') === 'true'; } catch { return false; } });
  useEffect(() => {
    const sync = () => { try { setTtsEnabled(localStorage.getItem('user_tts_enabled_v2') === 'true'); } catch { /* ignore */ } };
    window.addEventListener('aastha:tts-changed', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('aastha:tts-changed', sync); window.removeEventListener('storage', sync); };
  }, []);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(() => localStorage.getItem('user_voice_uri'));
  
  // AUDIO REF for Single Source of Truth
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- CLONE MODE & VOICE INPUT ---
  // Clone Mode: name of the person being imitated while it's switched on (null = off)
  const [cloneName, setCloneName] = useState<string | null>(null);
  const isCloneMode = !!cloneName;

  // --- SETTINGS STATE ---
  const [showSettings, setShowSettings] = useState(false);

  // --- CREDITS ---
  const [localCredits, setLocalCredits] = useState(user?.credits || 0);
  const [quotaResetsAt, setQuotaResetsAt] = useState<string | null>(user?.quotaResetsAt ?? null);
  useEffect(() => { setQuotaResetsAt(user?.quotaResetsAt ?? null); }, [user?.quotaResetsAt]);
  const [modelMode, setModelMode] = useState<'pro' | 'eco'>(user?.credits && user.credits > 0 ? 'pro' : 'eco');
  const [isStandardMode, setIsStandardMode] = useState(false);
  
  // --- REFS ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  // Liquid glass: the header (phone) and the message bar FLOAT over the messages, so the list scrolls under the
  // glass. Their real heights (reply preview, attachments, safe areas) are measured to pad the list.
  const headerRef = useRef<HTMLDivElement | null>(null);
  const inputBarRef = useRef<HTMLDivElement | null>(null);
  const [chromeH, setChromeH] = useState({ top: 0, bottom: 0 });
  useEffect(() => {
    const measure = () => setChromeH((prev) => {
      const h = headerRef.current, b = inputBarRef.current;
      const top = h && getComputedStyle(h).position === 'absolute' ? Math.round(h.getBoundingClientRect().bottom - (h.parentElement?.getBoundingClientRect().top || 0)) : 0;
      const bottom = b ? Math.round(b.getBoundingClientRect().height) : 0;
      return prev.top === top && prev.bottom === bottom ? prev : { top, bottom };
    });
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) { if (headerRef.current) ro.observe(headerRef.current); if (inputBarRef.current) ro.observe(inputBarRef.current); }
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, [isMobile]);
  // Bar grew (chips, reply preview, photo) while reading the newest message → keep it in view
  useEffect(() => { if (stickToBottomRef.current) scrollToBottom(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chromeH.bottom]);
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
        if (data.type === 'reaction' && data.reaction) {
             setMessages(prev => {
                 const newList = [...prev];
                 // Attach reaction to the last user message
                 for (let i = newList.length - 1; i >= 0; i--) {
                     if (newList[i].role === 'user') {
                         newList[i] = { ...newList[i], reaction: data.reaction };
                         break;
                     }
                 }
                 return newList;
             });
        }

        if (data && data.content) {
            if (data.role === 'user') {
                 // USER MESSAGE BROADCAST (Handle deduplication)
                 setMessages(prev => {
                     // 1. Check if we already have this message by tempId (Sender View)
                     if (data.tempId && prev.some(m => m.id === data.tempId)) {
                         return prev;
                     }
                     // 2. Check for duplicate content at the end (Optimistic UI race condition)
                     const lastMsg = prev[prev.length - 1];
                     if (lastMsg && lastMsg.role === 'user' && lastMsg.content === data.content && (Date.now() - (lastMsg.timestamp || 0) < 10000)) {
                         return prev;
                     }

                     return [...prev, { role: 'user', content: data.content, timestamp: data.timestamp || Date.now(), id: data.tempId }];
                 });
            } else {
                // ASSISTANT MESSAGE BROADCAST
                if (data.id && messagesRef.current.some(m => m.id === data.id)) return; // already shown (e.g. a follow-up nudge)
                setMessages(prev => {
                    // Reverse search for a matching temp message or identical content
                    // We search the last 5 messages to handle potential race conditions where user typed more
                    const reversed = [...prev].reverse();
                    const existingTempIndex = reversed.findIndex(m =>
                        m.role === 'assistant' && (m.id?.startsWith('temp') || m.id === 'temp-ai')
                    );
                    const identicalContentIndex = reversed.findIndex(m =>
                        m.role === 'assistant' && m.content.trim() === data.content.trim()
                    );

                    // 1. Deduplication by Content (Check if we ALREADY have this message anywhere recently)
                    if (identicalContentIndex !== -1 && identicalContentIndex < 5) {
                        return prev;
                    }

                    // 2. Sender: Found a temp placeholder to replace?
                    if (existingTempIndex !== -1 && existingTempIndex < 5) {
                        const realIndex = prev.length - 1 - existingTempIndex;
                        const newArr = [...prev];
                        // Update content but KEEP temp ID to avoid callChatAPI JIT duplication
                        newArr[realIndex] = { ...newArr[realIndex], content: data.content };
                        return newArr;
                    }

                    // 3. Receiver: Append new message
                    return [...prev, { role: 'assistant', content: data.content, timestamp: Date.now() }];
                });
                setIsTyping(false);
            }
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
          api.get('/users/clone').then(r => setCloneName(r.data?.isActive ? r.data?.consent?.name || 'Clone' : null)).catch(() => {});
      }
  }, [user]);

  // --- 2. INIT CHAT ---
  // Cache-first: show the last cached messages instantly, then refresh from the server in the
  // background. Only a first-ever load (no cache) shows the connecting screen. (ROADMAP M2)
  const mapServerHistory = (data: any[]) => data.map((msg: any) => {
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

  // Server history is authoritative; keep any local messages newer than it (e.g. sent while syncing).
  const mergeWithServer = (server: any[]) => setMessages(prev => {
      const toMs = (t: any) => new Date(t).getTime() || 0;
      const serverLast = server.length ? toMs(server[server.length - 1].timestamp) : 0;
      const newerLocal = prev.filter(m => toMs(m.timestamp) > serverLast);
      return [...server, ...newerLocal] as any;
  });

  const fetchHistory = async () => {
      const res = await api.get('/chat/history', { params: { limit: 50 } });
      return Array.isArray(res.data) ? mapServerHistory(res.data) : [];
  };

  // A reply we didn't receive (connection dropped / app closed): the server still finishes and saves it, so keep
  // checking history (every 5 s, up to 5 min after sending) and show it when it lands.
  const recoverReply = async () => {
      const uid = (user as any)?._id;
      if (recoveringRef.current || !pendingReply.getInFlight(uid)) return;
      recoveringRef.current = true;
      setStatusDisplay('Typing...');
      let found = false;
      try {
          for (;;) {
              const p = pendingReply.getInFlight(uid);
              if (!p || !mountedRef.current) break;
              try {
                  const history = await fetchHistory();
                  const state = replyArrived(history, p);
                  if (state !== 'no') {
                      found = true;
                      pendingReply.clearInFlight(uid);
                      mergeWithServer(history);
                      // drop the half-written bubble of that reply (the saved one replaces it)
                      setMessages(prev => prev.filter(m => !(m.role === 'assistant' && String(m.id || '').startsWith('temp-')
                          && new Date(m.timestamp).getTime() <= p.sentAt + 60_000)));
                      setTimeout(() => scrollToBottom(), 80);
                      break;
                  }
              } catch { /* offline for now: try again */ }
              await new Promise(r => setTimeout(r, 5000));
          }
          if (!found && mountedRef.current) {
              setMessages(prev => prev.filter(m => !(m.role === 'assistant' && String(m.id || '').startsWith('temp-') && !m.content)));
              setError(`${botName} couldn't finish that reply. Send it again?`);
          }
      } finally {
          recoveringRef.current = false;
          if (mountedRef.current) settleStatus();
      }
  };

  // Back in the app: a "left on seen" notification that already fired is saved and shown; one still waiting is cancelled.
  const settleSeenNudge = async () => {
      const m = await seenNudge.settle();
      if (m && mountedRef.current) {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, { role: 'assistant', content: m.content, timestamp: m.timestamp, id: m.id }]);
          setTimeout(() => scrollToBottom(), 80);
      }
  };

  // Messages typed but never sent because the app was closed during the 6 s pause → send them now.
  const sendOutbox = () => {
      const texts = pendingReply.takeOutbox((user as any)?._id);
      if (!texts.length) return;
      const tempBotId = `temp-${Date.now()}`;
      setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now(), id: tempBotId }]);
      callChatAPI(texts.join('\n'), [], null, false, tempBotId, false);
  };

  useEffect(() => {
     if (!user) return; 
     if (hasAttemptedInit.current) return;
     hasAttemptedInit.current = true;

     // Component-level mounted flag: survives React StrictMode's double-mount (a per-effect flag made the
     // first run discard its result while the guard skipped the second → spinner forever in dev).
     let slowTimer: ReturnType<typeof setTimeout> | null = null;
     // First message in an empty chat, a friend's hello, not a help-desk line (first name only)
     const greeting = (_line?: string) => [{ role: 'assistant', content: `Hey ${String(user?.name || '').split(' ')[0] || 'you'} 👋 I’m ${botName}. No pressure to say anything big, how’s your day going?`, timestamp: Date.now() }];

     const cached = chatCache.load((user as any)?._id);
     if (cached) {
         setMessages(cached as any);
         setIsInitializing(false);
         setTimeout(() => scrollToBottom(), 50);
     } else {
         setIsInitializing(true);
         setConnectionStatus(`Connecting to ${botName}...`);
         // Render free tier can take ~a minute to wake, tell the user instead of spinning silently.
         slowTimer = setTimeout(() => {
             if (mountedRef.current) setConnectionStatus(`Waking ${botName} up… this can take up to a minute after a quiet spell ☕`);
         }, 4000);
     }

     const initChat = async () => {
         try {
             const history = await fetchHistory();
             if (!mountedRef.current) return;
             if (history.length > 0) {
                 mergeWithServer(history);
                 setTimeout(() => scrollToBottom(), 80); // after the merged list has rendered
             }
             else if (!cached) setMessages(greeting('How can I support you right now?') as any);
         } catch (e: any) { 
             console.error("Init failed:", e);
             if (mountedRef.current && !cached) setMessages(greeting("I'm listening.") as any);
         } finally {
             if (slowTimer) clearTimeout(slowTimer);
             if (mountedRef.current && !cached) {
                 setTimeout(() => { scrollToBottom(); setIsInitializing(false); }, 300);
             }
             // The app was closed last time before a reply arrived / before a message was sent
             if (mountedRef.current) { recoverReply(); sendOutbox(); settleSeenNudge(); }
         }
     };
     initChat();
     return () => { if (slowTimer) clearTimeout(slowTimer); };
  }, [user, navigate, botName]);

  // Persist the latest messages for instant next launch (skip while a reply is streaming).
  useEffect(() => {
      if (isTyping || isInitializing || messages.length === 0) return;
      chatCache.save((user as any)?._id, messages);
  }, [messages, isTyping, isInitializing, user]);

  // --- RE-SYNC ON APP RESUME (Mobile) ---
  useEffect(() => {
      let lastResumeSync = 0;
      const listener = App.addListener('appStateChange', async ({ isActive }) => {
          // Going to the background with a message still waiting in the 6 s pause → send it NOW (the timer
          // won't run while the app is closed, and the message used to be lost)
          if (!isActive) {
              if (sendDebounceTimer.current && debounceFireRef.current) {
                  clearTimeout(sendDebounceTimer.current);
                  sendDebounceTimer.current = null;
                  const fire = debounceFireRef.current;
                  debounceFireRef.current = null;
                  fire();
                  return;
              }
              // Her reply is the last message and they're leaving → a "you there?" notification later (seenNudge.ts)
              const last = messagesRef.current[messagesRef.current.length - 1];
              if (user && last?.role === 'assistant' && !inputValueRef.current.trim() && !pendingReply.getInFlight((user as any)?._id)) {
                  cancelNudge();
                  seenNudge.prepare(last.id, botName);
              }
              return;
          }
          settleSeenNudge();
          // Back with a reply still missing → look for it right away (not throttled)
          if (user && pendingReply.getInFlight((user as any)?._id)) { recoverReply(); return; }
          // On the web this fires on every focus/visibility change, throttle to once per 30 s.
          if (isActive && user && Date.now() - lastResumeSync > 30_000) {
              lastResumeSync = Date.now();
              // Silent refresh of history when app comes to foreground
              try {
                  const history = await fetchHistory();
                  if (history.length > 0) mergeWithServer(history);
              } catch (e) { console.error("Resume sync failed", e); }
          }
      });
      return () => { listener.then(l => l.remove()); };
  }, [user]);

  // --- PHONE: PIN THE CHAT + TAB BAR TO THE *VISIBLE* SCREEN ---
  // Android Chrome can leave the page panned/scrolled (keyboard, address bar, edge-to-edge), so the layout
  // viewport and what you actually see drift apart, the header (in the chat) and the tab bar (fixed to the bottom)
  // then can't both be on screen. We pin BOTH to the visual viewport on every change:
  //   chat container → top = visual top, height = visual height
  //   tab bar        → bottom = gap below the visual viewport (CSS var --vv-bottom, read by MobileTabBar)
  // Keyboard = an input is focused AND the visible height shrank a lot → <html data-keyboard="open"> (tab bar hides).
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const c = () => document.getElementById('chat-view-container');
    const editable = () => {
      const a = document.activeElement as HTMLElement | null;
      return !!a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'range'].includes((a as HTMLInputElement).type)) || a.isContentEditable);
    };
    let wasOpen = false;
    const sync = () => {
      const el = c();
      if (!vv || !isMobile) {
        if (el) { el.style.top = ''; el.style.height = ''; el.style.bottom = ''; }
        root.style.removeProperty('--vv-bottom'); root.style.removeProperty('--vv-top'); root.style.removeProperty('--vv-height'); delete root.dataset.keyboard;
        return;
      }
      const top = Math.max(0, Math.round(vv.offsetTop));
      const height = Math.round(vv.height);
      const below = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      if (el) { el.style.top = `${top}px`; el.style.height = `${height}px`; el.style.bottom = 'auto'; }
      root.style.setProperty('--vv-bottom', `${below}px`);
      root.style.setProperty('--vv-top', `${top}px`);       // the tab bar uses the SAME frame as the chat
      root.style.setProperty('--vv-height', `${height}px`); // (fixed bottom:0 can sit below the visible screen in mobile Chrome)
      const open = editable() && window.innerHeight - vv.height > 120;
      if (open) root.dataset.keyboard = 'open'; else delete root.dataset.keyboard;
      if (open && !wasOpen && stickToBottomRef.current) setTimeout(scrollToBottom, 60);
      if (!open && wasOpen && (window.scrollY || root.scrollTop)) window.scrollTo(0, 0); // undo Chrome's pan
      wasOpen = open;
    };
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    window.addEventListener('focusin', sync);
    const onFocusOut = () => setTimeout(sync, 80); // after the keyboard starts closing
    window.addEventListener('focusout', onFocusOut);
    // the page itself must never scroll under the fixed chat (that's what pushed things off-screen)
    const onWinScroll = () => { if (!document.documentElement.dataset.keyboard && (window.scrollY || root.scrollTop)) window.scrollTo(0, 0); };
    window.addEventListener('scroll', onWinScroll, { passive: true });
    sync();
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
      window.removeEventListener('focusin', sync);
      window.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('scroll', onWinScroll);
      delete root.dataset.keyboard;
      root.style.removeProperty('--vv-bottom'); root.style.removeProperty('--vv-top'); root.style.removeProperty('--vv-height');
      const el = c();
      if (el) { el.style.top = ''; el.style.height = ''; el.style.bottom = ''; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, isInitializing]); // re-run once the real chat (not the loading screen) is mounted

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
    const loadVoices = () => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
    };
    loadVoices();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
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
    // Force production API on native devices to avoid localhost loopback issues
    if (Capacitor.isNativePlatform()) {
        return `https://aastha-final.onrender.com/api${endpoint}`;
    }

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
    } else {
        if (isDictating) { setIsDictating(false); }
        setIsVoiceMode(true);
        const voices = ('speechSynthesis' in window) ? window.speechSynthesis.getVoices() : [];
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

  // "Stick to bottom": while the user is at the bottom, any content growth (new bubbles, entrance
  // animations, images, streaming text) keeps the view pinned to the newest message. Scrolling up releases it.
  const stickToBottomRef = useRef(true);
  const scrollToBottom = () => {
      stickToBottomRef.current = true;
      if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTo({
              top: messagesContainerRef.current.scrollHeight,
              behavior: 'smooth'
          });
      }
  };
  useEffect(() => scrollToBottom(), [messages, isTyping]);
  useEffect(() => {
      const el = messagesContainerRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return;
      let frame = 0;
      const pin = () => {
          if (!stickToBottomRef.current) return;
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      };
      const ro = new ResizeObserver(pin);
      ro.observe(el);
      Array.from(el.children as HTMLCollection).forEach((c) => ro.observe(c as Element));
      const mo = new MutationObserver(() => {
          Array.from(el.children as HTMLCollection).forEach((c) => ro.observe(c as Element));
          pin();
      });
      mo.observe(el, { childList: true, subtree: true, characterData: true });
      return () => { ro.disconnect(); mo.disconnect(); cancelAnimationFrame(frame); };
  }, [isInitializing]);

  const lastScrollTopRef = useRef(0);
  const handleScroll = () => {
      if (!messagesContainerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      const isBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollDown(!isBottom);
      stickToBottomRef.current = isBottom; // user scrolled up → stop auto-pinning
      // Phone tab bar: shrinks while you scroll through the chat in EITHER direction (more room to read),
      // grows back when you're at the latest messages again (or tap it).
      const delta = scrollTop - lastScrollTopRef.current;
      if (Math.abs(delta) > 8 || isBottom) {
          window.dispatchEvent(new CustomEvent('aastha:chat-scroll', { detail: { direction: isBottom ? 'bottom' : delta > 0 ? 'down' : 'up' } }));
          lastScrollTopRef.current = scrollTop;
      }
  };

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
    const clean = String(text || '').replace(/^> Replying to: "[\s\S]*?"\n\n/, ''); // don't copy the quote header
    const done = () => toast.success('Copied', { duration: 1500, style: { borderRadius: '999px', background: 'rgb(var(--md-surface-container-high))', color: 'rgb(var(--md-on-surface))' } });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(clean).then(done).catch(() => {});
    else {
      // older Android WebViews
      const t = document.createElement('textarea'); t.value = clean; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch { /* ignore */ } t.remove();
    }
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
  // Transport (fetch, SSE parsing, batching, abort) lives in hooks/useStreamingChat; this file decides what events mean.
  const chatStream = useStreamingChat();
  const settleStatus = () => setStatusDisplay(prev => (prev === 'Listening...' ? prev : 'Online'));

  const handleStop = () => {
    userStoppedRef.current = true;
    pendingReply.clearInFlight((user as any)?._id);
    chatStream.stop();
    setIsTyping(false);
    settleStatus();
  };

  const readToken = () => {
    try {
      const storedInfo = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
      return storedInfo ? JSON.parse(storedInfo).token || '' : '';
    } catch { return ''; }
  };

  const callChatAPI = async (finalText: string, images: string[], audioBase64: string | null, isPermissionGrant: boolean, tempBotId: string, isSilent: boolean = false, tempId?: string) => {
      // Set "Thinking..." ONLY if NOT in silent mode (Listening Mode)
      if (!isSilent || isPermissionGrant) {
        setIsTyping(true);
        setStatusDisplay('Thinking...');
      }
      processedTagsRef.current.clear();
      let serverAudioPlayed = false;
      let gotSaved = false;
      userStoppedRef.current = false;
      const uid = (user as any)?._id;
      // Remember it until the reply is saved: if the connection drops or the app closes, recoverReply() finds it.
      // Voice notes / photos are saved under other text, so they're matched by time instead ('').
      pendingReply.markInFlight(uid, audioBase64 || images.length ? '' : finalText);
      const patchBot = (fn: (m: ChatMessage) => ChatMessage) => setMessages(prev => prev.map(m => m.id === tempBotId ? fn(m) : m));

      await chatStream.stream(getApiUrl('/chat'), readToken(), {
          message: finalText,
          images: images,
          audio: audioBase64,
          forceReply: isPermissionGrant,
          isVoiceMode: isVoiceMode,
          userLocalTime: new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }),
          userLocalHour: new Date().getHours(),
          thinkingMode: !!(user as any)?.thinkingMode,
          timeZone: deviceTimeZone(), // check-ins + "today" follow the user's own clock
          tempId: tempId
      }, {
          onContent: (raw) => {
              const cleanContent = processMagicTags(raw);
              setMessages(prev => {
                  const index = prev.findIndex(m => m.id === tempBotId);
                  if (index === -1) return prev; // replaced by a sync broadcast, don't duplicate
                  const newArr = [...prev];
                  newArr[index] = { ...newArr[index], content: cleanContent };
                  return newArr;
              });
          },
          onEvent: (data, ctx) => {
              // A0. SAFETY / CLOSENESS / THINKING EVENTS (Phase 3)
              if (data.type === 'safety') {
                  setSafetyInfo({ level: data.level, helplines: data.helplines || [] });
                  // pending check-in notifications are cancelled for 48 h after a crisis (server decides; refresh now)
                  if (data.level === 'crisis') window.dispatchEvent(new Event('aastha:reach-out-refresh'));
              }
              if (data.type === 'error' && data.message) setError(String(data.message));
              if (data.type === 'clone' && data.name) {
                  setCloneName(data.name);
                  patchBot(m => ({ ...m, isClone: true }));
              }
              if (data.type === 'gif' && data.gif?.url && /^https:\/\//.test(data.gif.url)) patchBot(m => ({ ...m, gif: data.gif }));
              // Your own voice note: show it as a bubble with its transcript (7.4)
              if (data.type === 'transcript' && tempId) {
                  setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: data.text || m.content, voice_note: data.voice_note ? resolveAudioUrl(data.voice_note) : m.voice_note } : m));
              }
              // Saved ids → reactions are stored against the real message (7.4)
              if (data.type === 'saved') { gotSaved = true; pendingReply.clearInFlight(uid); }
              if (data.type === 'saved' && data.assistantId) {
                  setMessages(prev => prev.map(m => m.id === tempBotId ? { ...m, id: data.assistantId } : m));
                  scheduleNudge('seen', data.assistantId, NUDGE_SEEN_MS); // left on seen → one gentle follow-up
              }
              // Quick replies in YOUR voice, written from the reply you just got
              if (data.type === 'suggestions' && Array.isArray(data.items)) { setSuggestedChips(data.items.slice(0, 3).map(String)); setChipsDismissed(false); }
              if (data.type === 'clone_paused') {
                  toast(data.reason === 'safety'
                      ? `I've paused the imitation, ${botName} is here with you now.`
                      : `That's today's ${data.limit} imitation replies, ${botName} is replying instead.`,
                      { icon: data.reason === 'safety' ? '💜' : '⏳', style: { borderRadius: '12px', background: '#1f1b2e', color: '#fff' }, duration: 5000 });
              }
              if (data.type === 'bond' && data.name) {
                  toast(`You and ${botName} are now: ${data.name}`, { icon: '💞', style: { borderRadius: '12px', background: '#1f1b2e', color: '#fff' }, duration: 4000 });
              }
              if (data.type === 'thinking_start' || data.type === 'reasoning' || data.type === 'thinking_end') {
                  setStatusDisplay(data.type === 'thinking_end' ? 'Typing...' : 'Thinking it through...');
                  patchBot(m => ({
                      ...m,
                      isThinking: data.type !== 'thinking_end',
                      reasoning: data.type === 'reasoning' ? (m.reasoning || '') + (data.content || '') : m.reasoning,
                  }));
              }

              // A. HANDLE THOUGHT (THE BRAIN)
              if (data.type === 'thought' && data.content) {
                  const brain = data.content;
                  setLastSubconscious(brain);
                  if (brain.mood) setCurrentMood(brain.mood);
                  if (brain.status_display) setStatusDisplay(brain.status_display);
                  if (brain.ui_action) setUiAction(brain.ui_action as any);

                  // Sticky Reaction on the last user message (the one we just sent)
                  if (brain.reaction) {
                      setMessages(prev => {
                          const newList = [...prev];
                          for (let i = newList.length - 1; i >= 0; i--) {
                              if (newList[i].role === 'user') { newList[i] = { ...newList[i], reaction: brain.reaction }; break; }
                          }
                          return newList;
                      });
                  }

                  // App tools → proposal chips (rendered by MessageBubble)
                  (brain.tool_calls || []).forEach((tool: any) => {
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
                      if (toolName === 'voice_hug') ctx.append(`\n\n[Voice Hug Playing 🎵]`);
                      if (toolName) ctx.append(`\n<proposal tool="${toolName}" params='${JSON.stringify(params)}' reason="${reason}" />`);
                  });

                  // Listening mode: no reply coming
                  if (brain.strategy === 'listen') {
                      setIsTyping(false);
                      if (!ctx.raw) setMessages(prev => prev.filter(m => m.id !== tempBotId));
                  }
              }

              // B. HANDLE META
              if (data.meta) {
                  if (data.meta.credits !== undefined) setLocalCredits(data.meta.credits === '∞' ? 9999 : Number(data.meta.credits));
                  if (data.meta.resetsAt !== undefined) setQuotaResetsAt(data.meta.resetsAt);
                  if (data.meta.mode) {
                      setModelMode(data.meta.mode);
                      setIsStandardMode(data.meta.mode === 'standard');
                  }
                  if (data.meta.voice_status === 'failed') {
                      const hasProAccess = user?.isPro || (user?.credits || 0) > 0 || data.meta.use_fallback_tts;
                      if (!hasProAccess) {
                          toast("My voice engine is taking a nap. Waking up... try again in 1 minute.", { icon: '😴', style: { borderRadius: '10px', background: '#333', color: '#fff' }, duration: 4000 });
                          serverAudioPlayed = true;
                      }
                  }
              }

              // C. VOICE NOTE
              if (data.voice_note && data.type !== 'transcript') patchBot(m => ({ ...m, voice_note: resolveAudioUrl(data.voice_note) }));

              // D. STREAMING AUDIO
              if (data.voice_audio) {
                  serverAudioPlayed = true;
                  speakMessage(resolveAudioUrl(data.voice_audio));
              }
          },
          onDone: (raw) => {
              const cleanFinal = processMagicTags(raw);
              if ((isVoiceMode || ttsEnabled) && raw && !serverAudioPlayed) speakMessage(cleanFinal);
              // Stream ended without the "saved" event (connection cut short) → fetch the reply from history
              if (!gotSaved) setTimeout(() => recoverReply(), 0);
          },
          onError: (err: any) => {
              if (err instanceof StreamHttpError) {
                  pendingReply.clearInFlight(uid); // the server refused it (quota, session…): nothing to wait for
                  if (err.status === 401) { setError("Session expired. Please login again."); return; }
                  console.error(err);
                  setMessages(prev => prev.filter(m => m.id !== tempBotId));
                  setError(err?.message || `${botName} is unreachable.`);
                  return;
              }
              // Network dropped (app in the background, signal lost): the server keeps going and saves the reply.
              // Keep the half-written bubble and fetch the finished reply instead of showing an error.
              console.warn('Reply stream dropped, recovering from history', err);
              setTimeout(() => recoverReply(), 0);
          },
          onAbort: () => {
              // Stop button → nothing to recover. Unmount (screen closed) → in-flight stays for the next open.
              if (userStoppedRef.current) pendingReply.clearInFlight(uid);
          },
          // Always runs (done, error or stop), the header can't stay on "Typing…" any more (7.1)
          onSettled: ({ superseded }) => {
              if (superseded) return;
              setIsTyping(false);
              settleStatus();
          },
      });
  };

  const handleSend = async (e?: React.FormEvent, overrideInput?: string, overrideImage?: string, audioBlob?: Blob) => {
    if (e) e.preventDefault();
    
    // Audio Handling
    let audioBase64: string | null = null;
    if (audioBlob) {
        audioBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(audioBlob);
        });
    }

    const textToSend = overrideInput || input;
    if (!textToSend.trim() && !attachedImage && !overrideImage && !audioBlob) return;

    // Construct UI Message
    let finalContent = textToSend;
    if (replyingTo) { finalContent = `> Replying to: "${replyingTo}"\n\n${textToSend}`; setReplyingTo(null); }
    if (attachedImage || overrideImage) { finalContent = `[Image Attached] ${finalContent}`; }
    if (audioBlob) { finalContent = `[Voice Note]`; }

    // 1. UPDATE UI IMMEDIATELY (your voice note plays from the device until the server copy arrives)
    const userMsg: ChatMessage = { role: 'user', content: finalContent, timestamp: Date.now(), id: `local-${Date.now()}`, ...(audioBlob ? { voice_note: URL.createObjectURL(audioBlob) } : {}) };
    const updatedMessages = [...messages, userMsg];
    const SLICE_LIMIT = 50;
    
    // Clear Input
    setInput(''); setAttachedImage(null); setShowEmojiPicker(false); setSuggestedChips([]); cancelNudge(); seenNudge.cancel();
    setError(null);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (isMobile) textareaRef.current?.blur();

    // 2. CHECK "PERMISSION GRANT" / FORCE REPLY
    const isPermissionGrant = finalContent === 'PERMISSION_GRANT_REPLY';

    if (isPermissionGrant) {
        setUiAction('none'); // FORCE EXIT Listening Mode
        setIsWaitingForPermission(false); // Hide Popup Immediately
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current); // Kill timer
    }

    if (isPermissionGrant || isVoiceMode || audioBlob) {
        // BYPASS DEBOUNCE for Force Reply or Voice Mode
        if (sendDebounceTimer.current) clearTimeout(sendDebounceTimer.current);
        sendDebounceTimer.current = null;
        debounceFireRef.current = null;
        pendingReply.setOutbox((user as any)?._id, []); // the waiting texts go out with this send

        // Flush any pending
        const allText = [...pendingMessages, isPermissionGrant ? "Please reply now." : finalContent].join('\n');
        setPendingMessages([]); // clear buffer

        // Add placeholder bubble
        const tempBotId = `temp-${Date.now()}`;
        const nextState: ChatMessage[] = [...updatedMessages, { role: 'assistant', content: '', timestamp: Date.now(), id: tempBotId }];
        setMessages(nextState.length > SLICE_LIMIT ? nextState.slice(nextState.length - SLICE_LIMIT) : nextState);

        // Fire API Immediately
        const finalImages = overrideImage ? [overrideImage] : (attachedImage ? [attachedImage] : []);
        await callChatAPI(allText, finalImages, audioBase64, isPermissionGrant, tempBotId, false, userMsg.id);
        return;
    }

    // 3. DEBOUNCE LOGIC (The "Wait" Feature)
    // Add message to UI (done above)
    setMessages(updatedMessages.length > SLICE_LIMIT ? updatedMessages.slice(updatedMessages.length - SLICE_LIMIT) : updatedMessages);

    // Add to buffer
    const newPending = [...pendingMessages, finalContent];
    setPendingMessages(newPending);

    // Cancel previous timer
    if (sendDebounceTimer.current) clearTimeout(sendDebounceTimer.current);

    // Start new timer (6 seconds). Also kept on the device (outbox) and fired early if the app goes to the
    // background, so closing the app during the pause can't lose the message.
    pendingReply.setOutbox((user as any)?._id, newPending);
    const fireSend = async () => {
        sendDebounceTimer.current = null;
        debounceFireRef.current = null;
        pendingReply.setOutbox((user as any)?._id, []);
        // Prepare to send
        const fullText = newPending.join('\n');
        setPendingMessages([]); // clear buffer before sending

        // Check if this is a "Burst" (>= 3 msgs)
        // If burst, we assume "Listening Mode" => DO NOT show bubble immediately
        const isBurst = newPending.length >= 3;
        const tempBotId = `temp-${Date.now()}`;

        // Only show bubble if NOT burst and NOT already listening
        const shouldShowBubble = !isBurst && uiAction !== 'listen';

        if (shouldShowBubble) {
            setMessages(prev => {
                 const withBot: ChatMessage[] = [...prev, { role: 'assistant', content: '', timestamp: Date.now(), id: tempBotId }];
                 return withBot.length > SLICE_LIMIT ? withBot.slice(withBot.length - SLICE_LIMIT) : withBot;
            });
        }

        const finalImages = overrideImage ? [overrideImage] : (attachedImage ? [attachedImage] : []);
        await callChatAPI(fullText, finalImages, audioBase64, false, tempBotId, !shouldShowBubble, userMsg.id);
    };
    debounceFireRef.current = fireSend;
    sendDebounceTimer.current = setTimeout(fireSend, 6000); // 6 Seconds Pause (High Latency Mode)
  };

  // --- REACTIONS on Aastha's replies (7.4) ---
  // --- FOLLOW-UP NUDGE: they reacted (15 s) or left the reply on seen (45 s) and haven't typed ---
  // One per reply (the server enforces it too), only while the app is open and visible, never while typing.
  const NUDGE_REACTION_MS = 15_000, NUDGE_SEEN_MS = 45_000;
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudged = useRef<Set<string>>(new Set());
  const inputValueRef = useRef('');
  inputValueRef.current = input;
  const cancelNudge = () => { if (nudgeTimer.current) { clearTimeout(nudgeTimer.current); nudgeTimer.current = null; } };
  const scheduleNudge = (reason: 'reaction' | 'seen', msgId: string, delay: number) => {
      if (!msgId || !/^[0-9a-f]{24}$/i.test(msgId) || nudged.current.has(msgId)) return;
      cancelNudge();
      nudgeTimer.current = setTimeout(async () => {
          nudgeTimer.current = null;
          const list = messagesRef.current;
          const last = list[list.length - 1];
          if (!last || last.id !== msgId || inputValueRef.current.trim() || document.visibilityState !== 'visible') return;
          nudged.current.add(msgId);
          try {
              const r = await api.post('/chat/nudge', { reason, messageId: msgId });
              if (r.status === 200 && r.data?.content) {
                  const m: ChatMessage = { role: 'assistant', content: r.data.content, timestamp: r.data.timestamp ? new Date(r.data.timestamp).getTime() : Date.now(), id: r.data.id || `nudge-${Date.now()}` };
                  setMessages(prev => (prev.some(x => x.id === m.id) || prev[prev.length - 1]?.id !== msgId) ? prev : [...prev, m]);
              }
          } catch { /* silent: it's only a nicety */ }
      }, delay);
  };
  useEffect(() => { if (input.trim()) cancelNudge(); }, [input]);
  useEffect(() => () => cancelNudge(), []);

  const reactTo = async (msgId: string | undefined, emoji: string | null) => {
      if (!msgId || !/^[0-9a-f]{24}$/i.test(msgId)) { toast('One sec, still saving that message…', { icon: '⏳' }); return; }
      let previous: string | null | undefined;
      setMessages(prev => prev.map(m => { if (m.id !== msgId) return m; previous = m.myReaction; return { ...m, myReaction: emoji }; }));
      try {
          await api.post('/chat/react', { messageId: msgId, reaction: emoji });
          // Reacted to the latest reply and then went quiet → a follow-up after 15 s (cancelled as soon as they type)
          if (emoji && messagesRef.current[messagesRef.current.length - 1]?.id === msgId) scheduleNudge('reaction', msgId, NUDGE_REACTION_MS);
      } catch {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, myReaction: previous ?? null } : m));
          toast.error("Couldn't save that reaction");
      }
  };

  // --- VOICE NOTES you record (7.4) ---
  const recorder = useVoiceRecorder((msg) => setError(msg));
  const sendRecording = async () => {
      const blob = await recorder.stop();
      if (!blob || blob.size < 800) { toast('That was too short to send', { icon: '🎙️' }); return; }
      handleSend(undefined, undefined, undefined, blob);
  };
  const startRecording = () => { if (isDictating) toggleDictation(); recorder.start(() => { sendRecording(); }); };

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
    cleanText = cleanText.replace(/\[STYLE:.*?\]/g, ''); // Remove Voice Director Tags
    cleanText = cleanText.replace(/<(?!proposal)[^>]+>/g, '');
    return cleanText;
  };

  const speakMessage = (textOrUrl: string) => {
    // STOP any currently playing audio before starting new one
    if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
    }
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop browser TTS too
    }

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

    // 2. Fallback: Browser TTS (Pro Perk: Reliable Fallback)
    if ('speechSynthesis' in window) {
       const cleanText = textOrUrl.replace(/[*#]/g, '').replace(/[\u{1F600}-\u{1F64F}]/gu, '');
       // Check if SpeechSynthesisUtterance is supported (some older webviews lack it)
       if (typeof SpeechSynthesisUtterance === 'undefined') return;

       const utterance = new SpeechSynthesisUtterance(cleanText);
       // Safety: Ensure window.speechSynthesis is available before getting voices
       const voices = ('speechSynthesis' in window) ? window.speechSynthesis.getVoices() : [];

       // Priority: Indian -> Female -> Default
       let chosenVoice =
           voices.find(v => v.voiceURI === selectedVoiceURI) ||
           voices.find(v => (v.name.includes('India') || v.lang.includes('IN')) && v.name.includes('Female')) ||
           voices.find(v => v.name.includes('Google US English')) ||
           voices.find(v => v.name.includes('Female')) ||
           voices[0];

       if (chosenVoice) utterance.voice = chosenVoice;

       // Slightly slower rate for clarity
       utterance.rate = 0.9;

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
                        <span className={`text-[10px] font-medium px-4 py-1 rounded-full uppercase tracking-widest shadow-sm bg-md-surface-container text-md-on-surface-variant`}>{dateLabel}</span>
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
                        reasoning={msg.reasoning}
                        isClone={msg.isClone}
                        gif={msg.gif}
                        myReaction={msg.myReaction}
                        onReact={msg.role === 'assistant' && !isCurrentlyStreaming ? (emo) => reactTo(msg.id, emo) : undefined}
                        cloneName={cloneName || undefined}
                        isDeepThinking={msg.isThinking}
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
    // 1. ADDED id="chat-view-container" so the script can find it
    // 2. FIXED: 'fixed inset-0' pins it to screen. 'overscroll-none touch-none' stops swipe bounce.
    // 3. FIXED: 'md:pl-80' keeps it right of the sidebar on PC.
    <div 
        id="chat-view-container"
        className="fixed inset-0 w-full flex flex-col items-center overflow-hidden bg-transparent md:pl-[var(--sidebar-space,20rem)] md:transition-[padding] md:duration-300 overscroll-none touch-none"
    >
      
      {/* 1. GLOBAL BACKGROUNDS & WALLPAPER */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
          {user?.wallpaper ? (
              <div 
                  className="w-full h-full bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${user.wallpaper})` }}
              >
                  <div className="absolute inset-0 bg-black/[0.72] md:bg-black/50" /> {/* M8: darker so chat text stays readable over photos */}
              </div>
          ) : (
              <>
                {/* Phone: soft colour "aura" from the user's own palette, gives the liquid glass something to
                    refract (glass over a flat colour just looks grey). Static gradients: no GPU cost. */}
                <div className="md:hidden w-full h-full" style={{ background: `
                  radial-gradient(70% 42% at 88% 6%, rgb(var(--md-primary) / 0.26), transparent 72%),
                  radial-gradient(62% 38% at 4% 46%, rgb(var(--md-tertiary) / 0.18), transparent 72%),
                  radial-gradient(80% 45% at 75% 98%, rgb(var(--md-secondary) / 0.20), transparent 70%),
                  linear-gradient(180deg, rgb(var(--md-surface-container-low)), rgb(var(--md-surface)) 55%, rgb(var(--md-surface-container-lowest)))` }} />
                <div className="hidden md:block w-full h-full bg-transparent" />
              </>
          )}

          {/* LITE MODE: No noise texture */}
          {!isLowPowerMode && (
              <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.03] mix-blend-overlay" />
          )}
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

      {/* CLONE MODE BANNER, always clear that replies are an AI imitation */}
      {isCloneMode && (
         <div className={`z-30 flex justify-center px-3 ${isMobile ? 'mt-2' : 'mt-1'}`}>
             <div className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-md-tertiary-container text-md-on-tertiary-container text-xs shadow-md">
                 <span>🎭 Chatting with an <strong>AI imitation</strong> of {cloneName}</span>
                 <button
                     onClick={async () => { try { await api.put('/users/clone-settings', { isActive: false }); setCloneName(null); toast(`Back to ${botName} 💜`); } catch { /* ignore */ } }}
                     className="px-2.5 py-1 rounded-full bg-black/20 hover:bg-black/30 font-medium">
                     Turn off
                 </button>
             </div>
         </div>
      )}

      {/* FULL SCREEN VOICE MODE OVERLAY */}
      <AnimatePresence>
        {isVoiceMode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/90 backdrop-blur-3xl flex flex-col items-center justify-center">
              <button onClick={toggleVoiceMode} className="absolute top-8 right-8 text-white/50 hover:text-white p-3 rounded-full hover:bg-white/10 transition-colors"><X size={24} /></button>
              <div className="relative mb-12">
                 {/* LITE MODE: Static circle instead of animated blob */}
                 {isLowPowerMode ? (
                     <div className="absolute inset-0 rounded-full blur-3xl opacity-40" style={{ backgroundColor: currentTheme.primaryColor }} />
                 ) : (
                     <motion.div animate={{ scale: isListening ? [1, 1.4, 1] : 1, opacity: isListening ? [0.4, 0.8, 0.4] : 0.2 }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-full blur-3xl" style={{ backgroundColor: currentTheme.primaryColor }} />
                 )}

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

      {/* --- SECTION 1: HEADER --- */}
      {/* LITE MODE: Updated to use transparent black for "See-Through" effect */}
      <div
        ref={headerRef}
        onPointerMove={isMobile ? specular : undefined}
        className={`shrink-0 z-30 pointer-events-auto ${isMobile
          ? 'glass glass-clear glass-specular absolute left-3 right-3 top-[calc(env(safe-area-inset-top)+0.5rem)] rounded-[28px] px-2 py-0.5'
          // PC: floats over the messages too (no bar, no hard edge), messages fade out as they reach it (mask below)
          : 'absolute top-0 left-[var(--sidebar-space,20rem)] right-0 transition-[left] duration-300 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pb-2 pt-6 bg-none'}`}>
        <div className="flex items-center gap-3 h-14 justify-between relative">
             <div className="shrink-0 flex items-center z-20">
                 {/* LITE MODE: Remove backdrop-blur */}
                 <button id="mobile-menu-btn" onClick={onMobileMenuClick} className={`p-2.5 rounded-full border border-white/5 text-white/70 bg-white/[0.06]  ${!isMobile ? 'md:hidden' : ''}`}>
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
                            // LITE MODE: Remove backdrop-blur-xl and animate-pulse
                            <motion.div
                                key="status-pill"
                                onClick={() => setShowThoughtCloud(true)}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/5 shadow-lg cursor-pointer hover:bg-white/[0.08] transition-colors `}
                            >
                                <div className={`w-2 h-2 rounded-full ${currentActivity === 'Online' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : `bg-amber-400 ${!isLowPowerMode ? 'animate-pulse' : ''}`}`} />
                                <span className="text-xs font-medium text-white/80 tracking-wide uppercase">{statusDisplay}</span>
                            </motion.div>
                        )
                    )}
                 </AnimatePresence>
             </div>

             <div className="shrink-0 flex items-center gap-3 justify-end z-20">
                 {/* CREDITS INDICATOR */}
                 {(() => {
                    const plan = planLabel(user as any, localCredits, new Date(), quotaResetsAt);
                    return (
                      <div data-testid="plan-pill" title={plan.hint ? `${plan.text} · ${plan.hint}` : plan.text} className={`hidden md:flex px-3 py-1.5 rounded-full border items-center gap-2 shadow-lg transition-colors ${plan.kind !== 'eco' ? 'bg-white/[0.08] border-white/10' : 'bg-white/5 border-white/5'}`}>
                        {plan.kind === 'eco' ? <Leaf size={14} className="text-emerald-400" fill="currentColor" /> : <Zap size={14} className="text-amber-300" fill="currentColor" />}
                        <span className={`text-xs font-medium whitespace-nowrap ${plan.kind !== 'eco' ? 'text-white/70' : 'text-white/45'}`}><span className="xl:hidden">{plan.short}</span><span className="hidden xl:inline">{plan.text}</span></span>
                      </div>
                    );
                 })()}

                 {/* HEADPHONE ICON */}
                 <button
                    id="voice-mode-btn" aria-label="Voice call"
                    onClick={() => toggleVoiceMode()}
                    disabled={isStandardMode && !user?.isPro}
                    className={`shrink-0 w-10 h-10 rounded-full border border-white/10 flex items-center justify-center transition-all shadow-lg  ${isVoiceMode ? 'bg-red-500 text-white hover:bg-red-600' : (isStandardMode && !user?.isPro ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-white/[0.06] text-white/70 hover:bg-white/10 hover:text-white')}`}
                 >
                    <Headphones size={18} />
                 </button>

                 <motion.div
                    initial={false}
                    animate={{ width: isSearchOpen ? (isMobile ? 200 : 300) : 40 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    className={`flex items-center h-10 rounded-full border ${isSearchOpen ? 'bg-black/60 border-white/10 px-3' : 'bg-white/[0.06] border-transparent justify-center'}`}
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
      
      <AnimatePresence>
        {safetyInfo && <SafetyBanner info={safetyInfo} botName={botName} onDismiss={() => setSafetyInfo(null)} />}
      </AnimatePresence>
      <AnimatePresence>{error && (
        // wrapper centres it, framer-motion's y animation would overwrite a -translate-x-1/2 transform
        <div className="absolute inset-x-0 top-24 z-40 flex justify-center px-3 pointer-events-none">
          <motion.div role="alert" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="pointer-events-auto bg-md-error/15 border border-md-error/30 px-4 py-2 rounded-full flex items-center gap-3 text-md-error text-sm shadow-xl cursor-pointer" onClick={() => setError(null)}><AlertCircle size={16} /> {error}</motion.div>
        </div>
      )}</AnimatePresence>

      {/* --- SECTION 2: CHAT AREA --- */}
      <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          // ADDED: touch-auto to allow scrolling messages
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden px-4 md:px-6 touch-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
          style={{ width: '100%', overflowAnchor: 'none', paddingTop: (chromeH.top || 0) + 16,
            // one continuous surface: content dissolves under the floating header / message bar instead of being cut
            ...(chromeH.top ? (() => { const m = `linear-gradient(to bottom, transparent 0, transparent ${isMobile ? 0 : Math.round(chromeH.top * 0.5)}px, #000 ${isMobile ? Math.round(chromeH.top * 0.35) : chromeH.top + 24}px, #000 calc(100% - ${Math.round(chromeH.bottom * 0.45)}px), rgb(0 0 0 / 0.35) 100%)`; return { maskImage: m, WebkitMaskImage: m }; })() : {}), paddingBottom: (chromeH.bottom || 128) + 12, scrollPaddingTop: chromeH.top + 16, scrollPaddingBottom: chromeH.bottom + 12 }}
      >
          {renderMessages()}
          <div ref={messagesEndRef} />
      </div>

      {/* Jump to Bottom Button */}
      <AnimatePresence>
        {showScrollDown && (
            <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={scrollToBottom}
                // LITE MODE: Simplified
                aria-label="Scroll to latest"
                className={`glass glass-pill fixed right-4 z-50 p-2.5 text-md-on-surface hover:brightness-110 transition ${isMobile ? 'bottom-[calc(10.5rem+env(safe-area-inset-bottom))]' : 'bottom-36'}`}
            >
                <ArrowDown size={20} />
            </motion.button>
        )}
      </AnimatePresence>

      {/* --- SECTION 3: INPUT AREA --- */}
      {/* FIXED: pb-6 adds padding so the input text isn't covered by Android gesture bar */}
      <div ref={inputBarRef} className={`chat-input-bar absolute bottom-0 left-0 right-0 md:left-[var(--sidebar-space,20rem)] md:transition-[left] md:duration-300 w-full pl-[calc(0.75rem+env(safe-area-inset-left))] pr-[calc(0.75rem+env(safe-area-inset-right))] pt-2 z-30 max-w-[700px] mx-auto pointer-events-none [&>*]:pointer-events-auto ${isMobile ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]' : 'md:pb-6 bg-none'}`}>
          <div className="flex flex-col gap-2">
             <AnimatePresence>
                 {replyingTo && (
                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={`self-center w-[95%] bg-black/60 border border-white/10 rounded-t-2xl border-b-0 p-3 flex justify-between items-center text-xs text-white/70 shadow-lg ${!isLowPowerMode ? 'backdrop-blur-xl' : ''}`}>
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
             {(suggestedChips.length > 0 || messages.length <= 2) && !isTyping && !chipsDismissed ? (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-x-auto scrollbar-hide flex items-center gap-2 mb-2 px-1"
                >
                    {/* Dismiss, first, so it never sits on top of a chip's text */}
                    <button type="button" onClick={() => { setSuggestedChips([]); setChipsDismissed(true); }} aria-label="Hide suggestions"
                        className="glass glass-clear shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-md-on-surface-variant hover:text-md-on-surface">
                        <X size={13} />
                    </button>
                    {(() => {
                        const isNewUser = messages.length <= 2;
                        const chips = suggestedChips.length > 0 ? suggestedChips : (isNewUser ? ["Who are you?", "What can you do?", "I'm stressed"] : []);

                        return chips.map((chip, i) => (
                            <button
                                key={i}
                                onClick={() => handleSend(undefined, chip)}
                                className="glass glass-clear shrink-0 h-8 px-3.5 rounded-full text-xs text-md-on-surface whitespace-nowrap"
                            >
                                {chip}
                            </button>
                        ));
                    })()}


                </motion.div>
             ) : null}
             </AnimatePresence>

             {/* INPUT AREA */}
             {/* LITE MODE: Removed backdrop-blur-3xl */}
             <div
               id="chat-input-area"
               onPointerMove={specular}
               className={`glass glass-clear glass-specular glass-refract relative flex items-center gap-3 p-2 pr-2 pl-3 transition-all duration-300 ease-md-emphasized ${uiAction === 'listen' ? '!border-md-primary/60 ring-2 ring-md-primary/20' : ''} ${replyingTo ? 'rounded-b-[2rem] rounded-t-none' : 'rounded-[2rem]'}`}>
                 {uiAction === 'listen' && (
                     <div className="absolute -top-8 left-0 right-0 flex justify-center pointer-events-none">
                         <motion.div
                             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                             className={`bg-teal-500/20 text-teal-200 text-xs px-3 py-1 rounded-full border border-teal-500/30 flex items-center gap-2 ${!isLowPowerMode ? 'backdrop-blur-md' : ''}`}
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
                            disabled={isStandardMode && !user?.isPro}
                            className={`p-2.5 rounded-full transition-all relative ${attachedImage ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5 hover:text-white'} ${(isStandardMode && !user?.isPro) ? 'opacity-30 cursor-not-allowed' : ''}`}
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

                    {recorder.isRecording && (
                        <div className="flex-1 flex items-center gap-3 h-12 px-2" role="status" aria-live="polite">
                            <span className="w-2.5 h-2.5 rounded-full bg-md-error animate-pulse" />
                            <span className="text-sm font-mono text-md-on-surface">{formatClock(recorder.seconds)}</span>
                            <span className="text-xs text-white/40 truncate">Recording… tap send when done</span>
                            <button type="button" onClick={recorder.cancel} aria-label="Discard recording" className="ml-auto p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10"><Trash2 size={18} /></button>
                        </div>
                    )}
                    <form onSubmit={handleSend} className={`flex-1 flex items-center relative h-full ${recorder.isRecording ? 'hidden' : ''}`}>
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
                            {!isMobile && (
                                <>
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
                                </>
                            )}
                        </div>
                    </form>

                    {!isTyping && !recorder.isRecording && !input.trim() && !attachedImage && recorder.isSupported ? (
                    <button
                        type="button"
                        onClick={startRecording}
                        aria-label="Record a voice note"
                        title="Record a voice note"
                        className="p-3.5 rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-all duration-200 ease-md-emphasized ml-1 bg-md-primary text-md-on-primary"
                    >
                        <AudioLines size={18} />
                    </button>
                    ) : (
                    <button
                        onClick={(e) => recorder.isRecording ? sendRecording() : isTyping ? handleStop() : handleSend(e)}
                        disabled={!isTyping && !recorder.isRecording && !input.trim() && !attachedImage}
                        aria-label={recorder.isRecording ? 'Send voice note' : isTyping ? 'Stop' : 'Send'}
                        className={`p-3.5 rounded-full shadow-lg hover:brightness-110 active:scale-95 transition-all duration-200 ease-md-emphasized disabled:opacity-40 disabled:cursor-not-allowed ml-1 ${isTyping ? 'bg-md-error text-md-on-error' : 'bg-md-primary text-md-on-primary'}`}
                    >
                        {isTyping ? (
                            <div className="w-[18px] h-[18px] flex items-center justify-center">
                                <div className="w-3 h-3 bg-white rounded-[2px]" />
                            </div>
                        ) : (
                            <Send size={18} className="ml-0.5" fill="currentColor" />
                        )}
                    </button>
                    )}
                    </>
             </div>
          </div>
      </div>
    </div>
  );
};
