import { MiniMarkdown, stripMarkdown } from '../../utils/miniMarkdown';
import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Reply, Sparkles, Wand2, SmilePlus } from 'lucide-react';
import { ReactionPicker } from './ReactionPicker';
import { useTheme } from '../../context/ThemeContext';
import { VoiceNotePlayer } from './VoiceNotePlayer';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  reaction?: string;
  mood?: string;
  onReply?: (content: string) => void;
  onCopy?: (content: string) => void;
  onOpenWidget?: (widget: string, params?: any) => void;
  searchQuery?: string;
  isStreaming?: boolean;
  currentMatchIndex?: number;
  isMobile?: boolean;
  voice_note?: string;
  reasoning?: string;   // "think deeper" reasoning, shown collapsed
  isClone?: boolean;    // Clone Mode reply → labelled as an AI imitation
  gif?: { url: string; width?: number; height?: number; title?: string; source?: string };
  cloneName?: string;
  isDeepThinking?: boolean;
  myReaction?: string | null;            // the user's emoji reaction on Aastha's message (7.4)
  onReact?: (emoji: string | null) => void;
}

export { QUICK_REACTIONS } from './ReactionPicker';

// --- NEW: Emoji Mapper ---
// This translates the backend "text" reaction into an actual Emoji
const reactionMap: Record<string, string> = {
  // Positive / Happy
  'thumbsup': '👍', 'like': '👍', 'yes': '👍',
  'heart': '❤️', 'love': '❤️',
  'laugh': '😂', 'haha': '😂', 'lol': '😂', 'rofl': '🤣',
  'smile': '😊', 'happy': '😊', 'grin': '😁',
  'joy': '🥹', 'blush': '😊',
  'wink': '😉',
  'cool': '😎', 'chill': '😎', 'shades': '😎',
  'yup': '👍', 'yep': '👍', 'yeah': '👍', 'sure': '👍',
  'thanks': '🙏', 'thx': '🙏', 'ty': '🙏',
  'bye': '👋', 'cya': '👋',
  'nice': '👌',
  'smirking': '😏', 'relieved': '😌',
  'pensive': '😔',
  'mask': '😷',
  'zipper': '🤐', 'money_mouth': '🤑',
  'hugging': '🤗',
  'rolling_eyes': '🙄',

  // Agreement / Acknowledgment
  'nod': '👌', 'ok': '👌', 'okay': '👌', 'check': '✅',
  'clap': '👏', 'applause': '👏',
  'deal': '🤝', 'handshake': '🤝',
  'salute': '🫡',

  // Celebration / Hype
  'fire': '🔥', 'lit': '🔥',
  'party': '🎉', 'celebrate': '🎉', 'tada': '🎉',
  'star': '🌟', 'sparkle': '✨', 'magic': '✨',
  'rocket': '🚀', 'hype': '🚀',
  'trophy': '🏆', 'win': '🏆',
  'crown': '👑',

  // Surprise / Shock
  'surprised': '😲', 'shock': '😲', 'wow': '😲', 'gasp': '😮',
  'mindblown': '🤯', 'exploding': '🤯',

  // Negative / Sad / Angry
  'sad': '😢', 'cry': '😢', 'tear': '😢',
  'sob': '😭', 'heartbreak': '💔', 'broken': '💔',
  'angry': '😠', 'mad': '😠', 'rage': '😡',
  'dead': '💀', 'skull': '💀',
  'ghost': '👻',
  'sick': '🤢', 'vomit': '🤮',
  'poop': '💩',
  'facepalm': '🤦',

  // Confusion / Thinking
  'think': '🤔', 'hmm': '🤔', 'confused': '😕',
  'search': '🔍',
  'shrug': '🤷',

  // Calm / Sleep
  'sleep': '😴', 'zzz': '😴', 'tired': '🥱',
  'zen': '🧘', 'meditate': '🧘',

  // Misc
  'eyes': '👀', 'look': '👀',
  'pray': '🙏', 'please': '🙏',
  'muscle': '💪', 'strong': '💪',
  'money': '💸', 'cash': '💸',
  'x': '❌', 'no': '❌', 'stop': '🛑',
  'warning': '⚠️',

  // 100+ Common Emoji Expansion
  'thinking': '🤔', 'hmmm': '🤔', 'idea': '💡',
  'lightbulb': '💡', 'question': '❓', 'what': '❓',
  'awesome': '🤩', 'amazing': '🤩',
  'k': '👌', 'correct': '✅', 'wrong': '❌',
  'hi': '👋', 'hello': '👋', 'wave': '👋',
  'welcome': '🤝', 'grateful': '🙏',
  'music': '🎵', 'song': '🎶', 'dance': '💃',
  'food': '🍕', 'eat': '🍽️', 'drink': '🥤', 'cheers': '🥂',
  'coffee': '☕', 'tea': '🍵', 'beer': '🍺', 'wine': '🍷',
  'cat': '🐱', 'dog': '🐶', 'pet': '🐾', 'animal': '🦁',
  'flower': '🌸', 'nature': '🌿', 'sun': '☀️', 'moon': '🌙',
  'rain': '🌧️', 'snow': '❄️', 'water': '💧',
  'car': '🚗', 'bus': '🚌', 'train': '🚆', 'plane': '✈️',
  'home': '🏠', 'work': '💼', 'school': '🏫', 'gym': '🏋️',
  'game': '🎮', 'play': '▶️', 'pause': '⏸️',
  'kiss': '😘', 'hug': '🤗',
  'sleepy': '😴', 'bored': '😐', 'scared': '😱',
  'shocked': '😲', 'omg': '😱',
  'nerd': '🤓', 'sunglasses': '😎', 'clown': '🤡',
  'alien': '👽', 'robot': '🤖', 'devil': '😈',
  'angel': '😇', 'thumbsdown': '👎',
  'fist': '👊', 'peace': '✌️', 'rock': '🤘', 'call': '🤙',
  'point_up': '☝️', 'point_down': '👇', 'point_left': '👈', 'point_right': '👉',
  'write': '✍️', 'read': '📖', 'book': '📚', 'laptop': '💻',
  'phone': '📱', 'camera': '📷', 'video': '📹', 'movie': '🎬',
  'tv': '📺', 'radio': '📻', 'mic': '🎤', 'headphone': '🎧',
  'lock': '🔒', 'unlock': '🔓', 'key': '🔑', 'hammer': '🔨',
  'tool': '🛠️', 'gear': '⚙️', 'bomb': '💣', 'gun': '🔫',
  'knife': '🔪', 'shield': '🛡️', 'sword': '⚔️', 'pill': '💊',
  'syringe': '💉', 'bandage': '🩹', 'heartbeat': '💓', 'broken_heart': '💔',
  'ring': '💍', 'diamond': '💎', 'gift': '🎁',
  'balloon': '🎈', 'confetti': '🎊', 'medal': '🥇'
};

// Helper to parse hidden <proposal> tags AND STRIP LEAKED JSON
const extractProposals = (text: string) => {
    // 1. Remove leaked Subconscious JSON block if it appears in text
    let cleanText = text.replace(/\{[\s\S]*?"internal_monologue"[\s\S]*?\}/g, '').trim();

    // Also remove markdown json blocks if they leaked
    cleanText = cleanText.replace(/```json[\s\S]*?```/g, '').trim();

    // FIXED REGEX: Matches params with single OR double quotes
    // capturing groups: 1=tool, 2=quote_char, 3=params_content, 4=reason
    const proposalRegex = /<proposal tool="([^"]+)" params=(['"])([\s\S]*?)\2 reason="([^"]+)" \/>/g;
    const proposals = [];
    let match;

    while ((match = proposalRegex.exec(cleanText)) !== null) {
        try {
            proposals.push({
                tool: match[1],
                params: JSON.parse(match[3]), // match[3] is the content inside quotes
                reason: match[4]
            });
            // Remove the tag from visible text
            cleanText = cleanText.replace(match[0], '');
        } catch (e) {
            console.error("Failed to parse proposal:", e);
        }
    }
    return { cleanText, proposals };
};

const MessageBubbleInner: React.FC<MessageBubbleProps> = ({
  role,
  content,
  timestamp,
  reaction,
  voice_note,
  reasoning,
  isDeepThinking,
  myReaction,
  onReact,
  isClone,
  cloneName,
  gif,
  mood,
  onReply,
  onCopy,
  onOpenWidget,
  searchQuery,
  isStreaming,
  currentMatchIndex = -1,
  isMobile = false,
}) => {
  const isUser = role === 'user';
  const { currentTheme, isLowPowerMode } = useTheme(); // Consume isLowPowerMode
  const [isHovered, setIsHovered] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false); // voice notes: text hidden behind "Show text" (7.1)

  // Reactions + actions (WhatsApp-style): long-press on phones, 🙂 button on desktop, double-tap = ❤️
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [pickerAnchor, setPickerAnchor] = useState<DOMRect | null>(null);
  const openPicker = () => { if (bubbleRef.current) setPickerAnchor(bubbleRef.current.getBoundingClientRect()); setIsHovered(false); };

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef(0);
  const cancelLongPress = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };

  // Pointer events (not touch-only): long-press works with a finger, a stylus AND a mouse held down
  // (phone-sized browser windows / the desktop preview). Right-click also opens it in the phone layout.
  const openedByPress = useRef(false);
  // React bubbles events from PORTALS (the reaction bar) up to this bubble — a tap that closes the bar must not
  // start a new long-press here (it re-opened the bar 450 ms later). Only react to presses on the bubble itself.
  const fromThisBubble = (e: React.SyntheticEvent) => (e.currentTarget as Node).contains(e.target as Node);
  const handlePointerDown = (e: React.PointerEvent) => {
      if (!isMobile || (e.pointerType === 'mouse' && e.button !== 0) || !fromThisBubble(e) || pickerAnchor) return;
      touchStartPos.current = { x: e.clientX, y: e.clientY };
      openedByPress.current = false;
      cancelLongPress();
      longPressTimer.current = setTimeout(() => {
          longPressTimer.current = null;
          // Android also fires `contextmenu` ~after a long-press: ignore it for a moment so it doesn't toggle twice
          openedByPress.current = true;
          setTimeout(() => { openedByPress.current = false; }, 1000);
          openPicker();
          if (navigator.vibrate) navigator.vibrate(30); // haptic tick
      }, 450);
  };
  // Scrolling must not turn into a long-press
  const handlePointerMove = (e: React.PointerEvent) => {
      const s0 = touchStartPos.current;
      if (longPressTimer.current && s0 && Math.hypot(e.clientX - s0.x, e.clientY - s0.y) > 10) cancelLongPress();
  };
  const handlePointerUp = () => {
      const wasPending = !!longPressTimer.current;
      cancelLongPress();
      if (!isMobile || !wasPending || isUser || !onReact) return;
      // Double-tap Aastha's message = ❤️ (tap again to remove)
      const now = Date.now();
      if (now - lastTapRef.current < 300) { lastTapRef.current = 0; onReact(myReaction === '❤️' ? null : '❤️'); if (navigator.vibrate) navigator.vibrate(15); }
      else lastTapRef.current = now;
  };
  const handleContextMenu = (e: React.MouseEvent) => {
      if (!isMobile || !fromThisBubble(e)) return;
      e.preventDefault(); // the browser's own menu would cover our bar
      if (!openedByPress.current && !pickerAnchor) { cancelLongPress(); openPicker(); }
  };

  // Parse Content for Proposals
  const { cleanText: visibleContent, proposals } = useMemo(() => {
      if (isUser) return { cleanText: content, proposals: [] };
      return extractProposals(content);
  }, [content, isUser]);

  const isThinking = isStreaming && (!visibleContent || visibleContent.length === 0);

  // --- FIX: Resolve Reaction ---
  // If reaction is "thumbsup", look it up. If not found, use original text.
  const displayReaction = reaction ? (reactionMap[reaction.toLowerCase()] || reaction) : null;

  const renderContent = (text: string) => {
    if (!searchQuery || !text) return text;

    let occurrenceCount = 0;
    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return parts.map((part, index) => {
      if (part.toLowerCase() === searchQuery.toLowerCase()) {
        const isActive = occurrenceCount === currentMatchIndex;
        occurrenceCount++;
        return (
          <span
            key={index}
            className={`rounded font-bold text-black transition-all ${
              isActive
                ? 'bg-orange-400 px-1 py-0.5 shadow-md'
                : 'bg-yellow-300 px-0.5 opacity-80'
            }`}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const timeString = timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  // AVATAR MAPPING
  const getMoodEmoji = () => {
      switch (mood) {
          case 'happy': return '🌟';
          case 'sad': return '💙';
          case 'concerned': return '🥺';
          case 'sassy': return '🔥';
          case 'excited': return '⚡';
          case 'calm': return '🧘';
          default: return null;
      }
  };

  const moodColor = useMemo(() => {
      switch (mood) {
          case 'happy': return '#F59E0B'; 
          case 'sad': return '#3B82F6'; 
          case 'concerned': return '#8B5CF6'; 
          case 'sassy': return '#EF4444'; 
          case 'excited': return '#10B981'; 
          case 'calm': return '#06B6D4'; 
          default: return currentTheme.primaryColor;
      }
  }, [mood, currentTheme]);

  // LITE MODE: If lite mode is enabled, we skip framer-motion animation on initial mount
  // by using a simple div or passing specific props to motion.div
  const Wrapper = isLowPowerMode ? 'div' : motion.div;
  const animationProps = isLowPowerMode ? {} : {
      initial: { opacity: 0, y: 10, scale: 0.98 },
      animate: { opacity: 1, y: 0, scale: 1 },
      transition: { duration: 0.25, ease: 'easeOut' }
  };

  return (
    // @ts-ignore
    <Wrapper
      {...animationProps}
      className={`group flex w-full relative ${
        isUser ? 'justify-end' : 'justify-start'
      } ${isMobile ? 'mb-10' : 'mb-6'}`}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onContextMenu={handleContextMenu}
    >
      {/* Assistant avatar (Left Side) */}
      {!isUser && (
        <div className="hidden md:flex flex-shrink-0 mr-3 self-end relative">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 overflow-hidden border-2"
            style={{
              borderColor: moodColor,
              boxShadow: isLowPowerMode ? 'none' : `0 0 15px ${moodColor}50`, // Remove glow in Lite Mode
              background: '#000'
            }}
          >
             <img src="/logo.png" alt="Aastha" className="w-full h-full object-cover" />
          </div>

          {/* Mood Badge Overlay */}
          {getMoodEmoji() && (
             <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute -bottom-1 -right-1 w-5 h-5 bg-black/80 rounded-full border border-white/20 flex items-center justify-center text-[10px]"
             >
                 {getMoodEmoji()}
             </motion.div>
          )}
        </div>
      )}

      {/* Bubble wrapper (Relative parent for bubble + reactions) */}
      <div
        ref={bubbleRef}
        className={`
          relative
          w-fit
          min-w-0
          break-words
          max-w-[85%]
          sm:max-w-[80%]
          md:max-w-[70%]
          lg:max-w-[60%]
          xl:max-w-[55%]
        `}
        style={{
          // M6: was `maxWidth: 85vw` on mobile, which ignores the chat's side padding and pushed
          // bubbles past the right edge on narrow phones. A % of the row always fits.
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          ...(isMobile ? { WebkitTouchCallout: 'none' } : {}), // no native long-press menu over our reaction bar
        } as React.CSSProperties}
      >
        {/* Actual Message Bubble */}
        <div
          className={`
            relative
            overflow-hidden
            px-4 py-3
            md:px-5 md:py-3.5
            text-[15px] md:text-base
            leading-relaxed
            ${
              isUser
                // Material You content layer: tonal containers, no blur (glass is reserved for controls)
                ? 'rounded-[22px] rounded-br-[6px] text-md-on-primary-container'
                : 'rounded-[22px] rounded-bl-[6px] text-md-on-surface'
            }
          `}
          style={{
             // Tonal layers (no blur per bubble — 50 blurs would lag phones). The user's bubble is a lit
             // primary-container gradient; Aastha's is a translucent surface so the chat background breathes
             // through. A 1px top highlight gives both the same glassy edge as the bars.
             ...(isUser
              ? {
                  background: 'linear-gradient(160deg, rgb(var(--md-primary-container)) 0%, rgb(var(--md-primary-container) / 0.82) 100%)',
                  boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.12), 0 8px 22px -14px rgb(var(--md-primary) / 0.7)',
                }
              : {
                  background: 'rgb(var(--md-surface-container-high) / 0.74)',
                  boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.07), inset 0 0 0 1px rgb(var(--md-outline-variant) / 0.22), 0 8px 22px -16px rgb(0 0 0 / 0.8)',
                }),
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                maxWidth: '100%'
          }}
        >
          {!isUser && isClone && (
            <div className="mb-1.5 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-md-tertiary">
              🎭 AI imitation{cloneName ? ` · ${cloneName}` : ''}
            </div>
          )}
          {!isUser && (reasoning || isDeepThinking) && (
            <details className="mb-2 group/think">
              <summary className="cursor-pointer list-none text-xs text-violet-200/80 flex items-center gap-1.5 select-none">
                <span>💭</span>
                <span>{isDeepThinking ? 'Thinking it through…' : 'Thought it through'}</span>
                {reasoning && <span className="text-white/30 group-open/think:hidden">· tap to see</span>}
              </summary>
              {reasoning && (
                <p className="mt-2 text-xs leading-relaxed text-white/50 whitespace-pre-wrap border-l border-white/10 pl-3 max-h-48 overflow-y-auto">
                  {reasoning}
                </p>
              )}
            </details>
          )}
          {isThinking ? (
            <div className="flex items-center gap-3 h-6">
              <span className="text-xs text-white/50 font-medium">
                {isDeepThinking ? 'Thinking it through' : 'Thinking'}
              </span>
              <div className="flex gap-1">
                {/* LITE MODE: Simplify thinking animation */}
                <div className={`w-1.5 h-1.5 rounded-full bg-white/60 ${isLowPowerMode ? 'opacity-50' : 'animate-bounce'}`} />
                <div className={`w-1.5 h-1.5 rounded-full bg-white/60 ${isLowPowerMode ? 'opacity-50' : 'animate-bounce delay-150'}`} />
                <div className={`w-1.5 h-1.5 rounded-full bg-white/60 ${isLowPowerMode ? 'opacity-50' : 'animate-bounce delay-300'}`} />
              </div>
            </div>
          ) : (
            // Voice notes keep a clean look: text sits behind "Show text" under the player (7.1)
            (!voice_note || showTranscript) && (
                searchQuery ? (
                <div className="space-y-1" style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>
                {stripMarkdown(visibleContent).split('\n').map((line, i) => (
                    <p
                    key={i}
                    className="font-normal select-text"
                    style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere',
                        maxWidth: '100%'
                    }}
                    >
                    {renderContent(line)}
                    </p>
                ))}
                </div>
                ) : (
                  // Bold, italics, lists etc. rendered properly — no raw ** or _ (utils/miniMarkdown.tsx)
                  <MiniMarkdown text={visibleContent} streaming={isStreaming} className="font-normal" />
                )
            )
          )}

          {/* GIF REACTION (only https URLs from GIPHY/Tenor, resolved by the server) */}
          {!isUser && gif?.url && /^https:\/\//.test(gif.url) && (
            <figure className="mt-2 max-w-[220px]">
              <img
                src={gif.url}
                alt={gif.title || 'GIF'}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                width={gif.width}
                height={gif.height}
                className="rounded-xl w-full h-auto bg-white/5"
                style={gif.width && gif.height ? { aspectRatio: `${gif.width} / ${gif.height}` } : undefined}
              />
              <figcaption className="mt-0.5 text-[9px] text-white/35">{gif.source === 'tenor' ? 'via Tenor' : 'Powered by GIPHY'}</figcaption>
            </figure>
          )}

          {/* SMART ACTION CHIPS */}
          {proposals.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                  {proposals.map((p, idx) => (
                      <button
                          key={idx}
                          onClick={() => onOpenWidget?.(p.tool, p.params)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-md-secondary-container text-md-on-secondary-container hover:brightness-110 transition text-xs font-medium"
                      >
                          <Wand2 size={12} className="text-teal-400" />
                          <span>
                            {p.tool === 'jam' && "Play Music"}
                            {p.tool === 'breathing' && "Start Breathing"}
                            {p.tool === 'diary' && "Open Diary"}
                            {p.tool === 'pomodoro' && "Start Focus"}
                            {p.tool === 'mood' && "Track Mood"}
                            {p.tool === 'soundscape' && "Play Sounds"}
                          </span>
                      </button>
                  ))}
              </div>
          )}

          {/* VOICE NOTE PLAYER */}
          {voice_note && (
             <div className="mt-3 mb-1 w-full max-w-[280px]">
                <VoiceNotePlayer src={voice_note} accentColor={moodColor} />
                {visibleContent && visibleContent.trim() && visibleContent.trim() !== '[Voice Note]' && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowTranscript(v => !v); }}
                    aria-expanded={showTranscript}
                    className="mt-1.5 text-[11px] font-medium opacity-60 hover:opacity-100 underline-offset-2 hover:underline"
                  >
                    {showTranscript ? 'Hide text' : 'Show text'}
                  </button>
                )}
             </div>
          )}

          <div
            className={`text-[10px] mt-2 font-medium flex items-center gap-1.5 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* Aastha's mood colour lives here now (was a stripe down the bubble's edge) */}
            {!isUser && mood && <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: moodColor, boxShadow: `0 0 6px ${moodColor}` }} />}
            <span className="opacity-50">{timeString}</span>
          </div>
        </div>

        {/* --- FIXED: Sticky Reaction with Mapping --- */}
        <AnimatePresence>
          {isUser && displayReaction && (
              <motion.div
                  initial={isLowPowerMode ? { opacity: 0 } : { scale: 0, opacity: 0, rotate: -20 }}
                  animate={isLowPowerMode ? { opacity: 1 } : { scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute -left-3 -bottom-3 z-50 text-xl bg-[#2a2a2a] text-white rounded-full p-1.5 border border-white/20 shadow-xl flex items-center justify-center min-w-[32px] min-h-[32px]"
              >
                  {displayReaction}
              </motion.div>
          )}
        </AnimatePresence>

        {/* Your reaction on Aastha's message (7.4) — tap to change or remove */}
        {!isUser && myReaction && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openPicker(); }}
            aria-label={`Your reaction ${myReaction}. Change or remove`}
            className="absolute left-3 -bottom-4 z-20 text-[15px] leading-none bg-md-surface-container-highest rounded-full px-1.5 py-1 border border-md-outline-variant/50 shadow-md"
          >
            {myReaction}
          </button>
        )}

        {pickerAnchor && (
          <ReactionPicker
            anchor={pickerAnchor}
            align={isUser ? 'right' : 'left'}
            current={myReaction}
            canReact={!isUser && !!onReact}
            onPick={(emo) => onReact?.(emo)}
            onReply={onReply ? () => onReply(content) : undefined}
            onCopy={onCopy ? () => onCopy(content) : undefined}
            onClose={() => setPickerAnchor(null)}
          />
        )}

        {/* Hover Actions (Reply/Copy) */}
        <AnimatePresence>
          {!isMobile && isHovered && !isThinking && !pickerAnchor && (
            <motion.div
              initial={isMobile ? { opacity: 0, y: -8 } : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className={`
                absolute z-10 flex gap-2
                ${
                  isMobile
                    ? `top-full mt-2 ${isUser ? 'right-0' : 'left-0'}`
                    : `top-1/2 -translate-y-1/2 ${
                        isUser ? 'right-full mr-3' : 'left-full ml-3'
                      }`
                }
              `}
            >
              {!isUser && onReact && (
                <button
                  onClick={(e) => { e.stopPropagation(); openPicker(); }}
                  aria-label="React"
                  title="React"
                  className="p-2 rounded-full bg-md-surface-container-high border border-md-outline-variant/40 text-md-on-surface-variant hover:text-md-on-surface shadow-lg"
                >
                  <SmilePlus size={14} />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onReply?.(content); }}
                className="p-2 rounded-full bg-zinc-800 border border-white/10 text-white/70 hover:text-white shadow-lg"
              >
                <Reply size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onCopy?.(content); }}
                className="p-2 rounded-full bg-zinc-800 border border-white/10 text-white/70 hover:text-white shadow-lg"
              >
                <Copy size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Wrapper>
  );
};

/**
 * Memoized (ROADMAP P2): while a reply streams, only the streaming bubble re-renders instead of all ~50.
 * Callback props are intentionally ignored in the comparison — they're recreated every render but
 * behave identically for the same message content.
 */
const DATA_PROPS: (keyof MessageBubbleProps)[] = [
  'role', 'content', 'timestamp', 'reaction', 'mood', 'searchQuery', 'isStreaming',
  'currentMatchIndex', 'isMobile', 'voice_note', 'reasoning', 'isDeepThinking', 'isClone', 'cloneName', 'gif', 'myReaction',
];
export const MessageBubble = React.memo(MessageBubbleInner, (prev, next) =>
  DATA_PROPS.every((k) => prev[k] === next[k])
);
