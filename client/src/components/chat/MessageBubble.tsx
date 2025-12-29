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
  currentMatchIndex?: number;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  role,
  content,
  timestamp,
  onReply,
  onCopy,
  searchQuery,
  isStreaming,
  currentMatchIndex = -1
}) => {
  const isUser = role === 'user';
  const { currentTheme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const isThinking = isStreaming && (!content || content.length === 0);

  const renderContent = (text: string) => {
      if (!searchQuery || !text) return text;
      
      let occurrenceCount = 0;
      // Escape regex special characters in search query
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Case insensitive split
      const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
      
      return parts.map((part, index) => {
          if (part.toLowerCase() === searchQuery.toLowerCase()) {
              const isActive = occurrenceCount === currentMatchIndex;
              occurrenceCount++;
              return (
                <span
                    key={index}
                    className={`rounded font-bold text-black transition-all duration-300 ${
                        isActive 
                        ? 'bg-orange-400 px-1 py-0.5 shadow-md scale-110' 
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

  const handleCopyClick = () => {
    if (onCopy && typeof content === 'string') {
      onCopy(content);
    }
  };

  const handleReplyClick = () => {
    if (onReply) onReply(content);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`group flex w-full mb-6 relative ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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

      <div className="relative max-w-[90%] md:max-w-[70%]">
        <div
          className={`
            relative px-4 py-3 md:px-6 md:py-3.5 text-sm md:text-base leading-snug backdrop-blur-xl shadow-lg
            ${
              isUser
                ? 'rounded-[20px] rounded-br-none text-white border border-white/10 bg-black/40' 
                : 'rounded-[20px] rounded-bl-none text-white border border-white/10 bg-black/30' 
            }
          `}
          style={
            !isUser
              ? {
                  background: `linear-gradient(135deg, ${currentTheme.primaryColor}20, #00000060)`,
                  borderLeft: `2px solid ${currentTheme.primaryColor}`,
                }
              : {}
          }
        >
          {isThinking ? (
             <div className="flex items-center gap-3 h-6 px-1">
                 <span className="text-xs text-white/50 font-medium tracking-wide">Thinking</span>
                 <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0.4s' }} />
                 </div>
             </div>
          ) : (
             <div className="space-y-1">
                {content.split('\n').map((line, i) => (
                  <p key={i} className="my-0 leading-snug break-words whitespace-pre-wrap text-white/90 font-light">
                    {renderContent(line)}
                  </p>
                ))}
             </div>
          )}

          <div
            className={`text-[10px] mt-2 opacity-30 font-medium ${
              isUser ? 'text-right' : 'text-left'
            }`}
          >
            {timeString}
          </div>
        </div>

        <AnimatePresence>
          {isHovered && !isThinking && (
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
