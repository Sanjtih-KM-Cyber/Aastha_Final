import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Reply, Sparkles, Wand2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  onReply?: (content: string) => void;
  onCopy?: (content: string) => void;
  onOpenWidget?: (widget: string, params?: any) => void;
  searchQuery?: string;
  isStreaming?: boolean;
  currentMatchIndex?: number;
  isMobile?: boolean;
}

// Helper to parse hidden <proposal> tags
const extractProposals = (text: string) => {
    const proposalRegex = /<proposal tool="([^"]+)" params='([^']+)' reason="([^"]+)" \/>/g;
    const proposals = [];
    let cleanText = text;
    let match;

    while ((match = proposalRegex.exec(text)) !== null) {
        try {
            proposals.push({
                tool: match[1],
                params: JSON.parse(match[2]),
                reason: match[3]
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
  onReply,
  onCopy,
  onOpenWidget,
  searchQuery,
  isStreaming,
  currentMatchIndex = -1,
  isMobile = false,
}) => {
  const isUser = role === 'user';
  const { currentTheme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Parse Content for Proposals
  const { cleanText: visibleContent, proposals } = useMemo(() => {
      if (isUser) return { cleanText: content, proposals: [] };
      return extractProposals(content);
  }, [content, isUser]);

  const isThinking = isStreaming && (!visibleContent || visibleContent.length === 0);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`group flex w-full ${
        isUser ? 'justify-end' : 'justify-start'
      } ${isMobile ? 'mb-10' : 'mb-6'}`}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      onClick={() => isMobile && setIsHovered(!isHovered)}
    >
      {/* Assistant avatar (desktop only) */}
      {!isUser && (
        <div className="hidden md:flex flex-shrink-0 mr-3 self-end">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #111827)`,
              boxShadow: `0 0 10px ${currentTheme.primaryColor}40`,
            }}
          >
            <Sparkles size={14} className="text-white" />
          </div>
        </div>
      )}

      {/* Bubble wrapper */}
      <div
        className="
          relative
          w-fit
          min-w-[120px]
          max-w-[90%]
          sm:max-w-[80%]
          md:max-w-[70%]
          lg:max-w-[60%]
          xl:max-w-[55%]
        "
      >
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
            ${!isMobile ? 'backdrop-blur-xl' : 'backdrop-blur-none'}
          `}
          style={
            !isUser
              ? {
                  background: isMobile
                    ? '#111827'
                    : `linear-gradient(135deg, ${currentTheme.primaryColor}20, #00000070)`,
                  borderLeft: `3px solid ${currentTheme.primaryColor}`,
                }
              : {
                  background: isMobile
                    ? '#1f2937'
                    : `linear-gradient(135deg, #1f293780, #11182780)`,
                }
          }
        >
          {isThinking ? (
            <div className="flex items-center gap-3 h-6">
              <span className="text-xs text-white/50 font-medium">
                Thinking
              </span>
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce delay-150" />
                <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce delay-300" />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {visibleContent.split('\n').map((line, i) => (
                <p
                  key={i}
                  className="break-words whitespace-pre-wrap text-white/95 font-light"
                >
                  {renderContent(line)}
                </p>
              ))}
            </div>
          )}

          {/* SMART ACTION CHIPS (The Manager) */}
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

          <div
            className={`text-[10px] mt-2 opacity-40 font-medium ${
              isUser ? 'text-right' : 'text-left'
            }`}
          >
            {timeString}
          </div>
        </div>

        {/* Actions */}
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
                onClick={() => onReply?.(content)}
                className="p-2 rounded-full bg-zinc-800 border border-white/10 text-white/70 hover:text-white shadow-lg"
              >
                <Reply size={14} />
              </button>
              <button
                onClick={() => onCopy?.(content)}
                className="p-2 rounded-full bg-zinc-800 border border-white/10 text-white/70 hover:text-white shadow-lg"
              >
                <Copy size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
