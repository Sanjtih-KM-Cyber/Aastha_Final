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
      const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
      // OPTIMIZATION: Reduce animation complexity for list items
      initial={{ opacity: 0, y: 5 }} 
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
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
            relative px-4 py-3 md:px-6 md:py-3.5 text-sm md:text-base leading-snug shadow-sm
            ${
              isUser
                // OPTIMIZATION: Removed 'backdrop-blur-xl'. Replaced with high-opacity solid colors.
                ? 'rounded-[20px] rounded-br-none text-white border border-white/5 bg-[#1a1a1a]/90' 
                : 'rounded-[20px] rounded-bl-none text-white border border-white/5 bg-[#0f0f0f]/90' 
            }
          `}
          style={
            !isUser
              ? {
                  // Fallback for solid color if gradient is too heavy, but this simple gradient is usually fine
                  background: `linear-gradient(135deg, ${currentTheme.primaryColor}15, #0a0a0a)`,
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

        {/* Action Buttons */}
        {isHovered && !isThinking && (
           <div
              className={`
                absolute top-1/2 -translate-y-1/2 flex items-center gap-1 z-10
                ${isUser ? 'right-full mr-3' : 'left-full ml-3'}
              `}
            >
              <button
                onClick={handleReplyClick}
                className="p-2 rounded-full bg-zinc-800 border border-white/10 text-white/70 hover:text-white transition-all shadow-lg"
                title="Reply"
              >
                <Reply size={14} />
              </button>

              <button
                onClick={handleCopyClick}
                className="p-2 rounded-full bg-zinc-800 border border-white/10 text-white/70 hover:text-white transition-all shadow-lg"
                title="Copy"
              >
                <Copy size={14} />
              </button>
            </div>
          )}
      </div>
    </motion.div>
  );
};
