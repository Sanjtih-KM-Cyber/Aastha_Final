import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Reply, Sparkles } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface MessageBubbleProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  onReply?: (content: string) => void;
  onCopy?: (content: string) => void;
  searchQuery?: string;
  isStreaming?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  timestamp,
  onReply,
  onCopy,
  searchQuery,
  isStreaming,
  currentMatchIndex = -1 // -1 means no active match in this message
}: MessageBubbleProps & { currentMatchIndex?: number }) => {
  const isUser = role === 'user';
  const { currentTheme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Highlighting logic
  const renderContent = (text: string) => {
      if (!searchQuery) return text;

      // Note: splitting by regex captures separators, so 'test match test'.split(/(match)/) -> ['test ', 'match', ' test']
      // We need to count *occurrences* of the search term as we map
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
                    className={`px-0.5 rounded font-bold text-black transition-colors duration-500 ${isActive ? 'bg-yellow-400 scale-110 inline-block px-1' : 'bg-yellow-200/50'}`}
                >
                    {part}
                </span>
              );
          }
          return part;
      });
  };

  // Format time
  const timeString = timestamp
    ? new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const displayContent =
    isStreaming && content === '' ? '...' : content;

  // Copy handler
  const handleCopyClick = () => {
    if (onCopy && typeof content === 'string') {
      onCopy(content);
    }
  };

  // Reply handler (fixed)
  const handleReplyClick = () => {
    if (onReply) onReply(content);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`group flex w-full mb-4 relative ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar (AI only) */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3 self-end hidden md:block">
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

      {/* Message bubble */}
      <div className="relative max-w-[90%] md:max-w-[70%]">
        <div
          className={`
            relative px-4 py-3 md:px-6 md:py-3.5 text-sm md:text-base leading-snug backdrop-blur-xl shadow-sm
            ${
              isUser
                ? 'rounded-[18px] rounded-br-none text-white border border-white/10 bg-white/10'
                : 'rounded-[18px] rounded-bl-none text-white border border-white/10'
            }
          `}
          style={
            !isUser
              ? {
                  background: `linear-gradient(135deg, ${currentTheme.primaryColor}15, ${currentTheme.primaryColor}05)`,
                  borderLeft: `2px solid ${currentTheme.primaryColor}60`,
                }
              : {}
          }
        >
          <div className="space-y-1">
            {displayContent.split('\n').map((line, i) => (
              <p key={i} className="my-0 leading-snug break-words whitespace-pre-wrap">
                {renderContent(line)}
              </p>
            ))}
          </div>

          {isStreaming && content === '' && (
            <div className="flex gap-1.5 items-center mt-2">
              {[0, 0.2, 0.4].map((d) => (
                <div
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
                  style={{ animationDelay: `${d}s` }}
                />
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

        {/* Hover action buttons */}
        <AnimatePresence>
          {isHovered && !isStreaming && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: isUser ? -10 : 10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`
                absolute top-1/2 -translate-y-1/2 flex items-center gap-1 z-10
                ${isUser ? 'right-full mr-3' : 'left-full ml-3'}
              `}
            >
              <button
                onClick={handleReplyClick}
                className="p-2 rounded-full bg-black/40 border border-white/10 hover:bg-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all backdrop-blur-md shadow-lg"
                title="Reply"
              >
                <Reply size={14} />
              </button>

              <button
                onClick={handleCopyClick}
                className="p-2 rounded-full bg-black/40 border border-white/10 hover:bg-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all backdrop-blur-md shadow-lg"
                title="Copy"
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
