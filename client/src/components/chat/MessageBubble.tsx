import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Reply, Sparkles, Wand2 } from 'lucide-react';
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
}

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

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  timestamp,
  reaction,
  voice_note,
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

  // Long Press Logic for Mobile
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const handleTouchStart = () => {
      if (!isMobile) return;
      isLongPressRef.current = false;
      longPressTimer.current = setTimeout(() => {
          isLongPressRef.current = true;
          setIsHovered(true); // Show options on long press
          if (navigator.vibrate) navigator.vibrate(50); // Haptic feedback
      }, 500); // 500ms Long Press
  };

  const handleTouchEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handleClick = () => {
      if (!isMobile) return;
      if (isLongPressRef.current) {
          // If a long press just happened, don't immediately hide
          isLongPressRef.current = false;
          return;
      }
      // If short tap, hide interactions
      setIsHovered(false);
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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
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
        className={`
          relative
          w-fit
          break-words
          min-w-[100px]
          max-w-[85%]
          sm:max-w-[80%]
          md:max-w-[70%]
          lg:max-w-[60%]
          xl:max-w-[55%]
        `}
        style={{
          maxWidth: isMobile ? '85vw' : undefined,
          wordBreak: 'break-word',
          overflowWrap: 'anywhere'
        }}
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
            shadow-lg
            ${
              isUser
                ? 'rounded-[22px] rounded-br-none border border-white/10'
                : 'rounded-[22px] rounded-bl-none border border-white/10'
            }
            ${!isMobile && !isLowPowerMode ? 'backdrop-blur-xl' : 'backdrop-blur-none'}
          `}
          style={{
             ...( !isUser
              ? {
                  background: isMobile || isLowPowerMode
                    ? 'rgba(10, 14, 23, 0.7)' // See-through dark tint in Lite Mode
                    : `linear-gradient(135deg, ${moodColor}15, #00000080)`,
                  borderLeft: `3px solid ${moodColor}`,
                }
              : {
                  background: isMobile || isLowPowerMode
                    ? 'rgba(31, 41, 55, 0.7)' // See-through gray tint in Lite Mode
                    : `linear-gradient(135deg, #1f293780, #11182780)`,
                }),
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                maxWidth: '100%'
          }}
        >
          {isThinking ? (
            <div className="flex items-center gap-3 h-6">
              <span className="text-xs text-white/50 font-medium">
                Thinking
              </span>
              <div className="flex gap-1">
                {/* LITE MODE: Simplify thinking animation */}
                <div className={`w-1.5 h-1.5 rounded-full bg-white/60 ${isLowPowerMode ? 'opacity-50' : 'animate-bounce'}`} />
                <div className={`w-1.5 h-1.5 rounded-full bg-white/60 ${isLowPowerMode ? 'opacity-50' : 'animate-bounce delay-150'}`} />
                <div className={`w-1.5 h-1.5 rounded-full bg-white/60 ${isLowPowerMode ? 'opacity-50' : 'animate-bounce delay-300'}`} />
              </div>
            </div>
          ) : (
            // Hide Text if Voice Note is present (for clean look), unless it's the User
            (!voice_note || isUser) && (
                <div className="space-y-1" style={{ maxWidth: '100%', overflowWrap: 'anywhere' }}>
                {visibleContent.split('\n').map((line, i) => (
                    <p
                    key={i}
                    className="text-white/95 font-light select-text"
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
            )
          )}

          {/* SMART ACTION CHIPS */}
          {proposals.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                  {proposals.map((p, idx) => (
                      <button
                          key={idx}
                          onClick={() => onOpenWidget?.(p.tool, p.params)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 transition-colors text-xs font-medium text-white/90"
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
             </div>
          )}

          <div
            className={`text-[10px] mt-2 opacity-40 font-medium ${
              isUser ? 'text-right' : 'text-left'
            }`}
          >
            {timeString}
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

        {/* Hover Actions (Reply/Copy) */}
        <AnimatePresence>
          {(isHovered || (isMobile && isHovered)) && !isThinking && (
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
