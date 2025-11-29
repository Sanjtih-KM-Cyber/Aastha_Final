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
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, timestamp, onReply, onCopy }) => {
  const isUser = role === 'user';
  const { currentTheme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  // Format time
  const timeString = timestamp 
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`group flex w-full mb-6 relative ${isUser ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar (AI Only) */}
      {!isUser && (
        <div className="flex-shrink-0 mr-3 self-end hidden md:block">
           <div 
             className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
             style={{ 
               background: `linear-gradient(135deg, ${currentTheme.primaryColor}, #111827)`,
               boxShadow: `0 0 10px ${currentTheme.primaryColor}40`
             }}
           >
             <Sparkles size={14} className="text-white" />
           </div>
        </div>
      )}

      {/* Bubble Container */}
      <div className="relative max-w-[85%] md:max-w-[70%]">
        
        {/* The Bubble */}
        <div 
          className={`
            relative px-6 py-4 text-base leading-relaxed backdrop-blur-xl shadow-sm
            ${isUser 
              ? 'rounded-[26px] rounded-br-md text-white border border-white/10 bg-white/10' 
              : 'rounded-[26px] rounded-bl-md text-white border border-white/10'
            }
          `}
          style={!isUser ? {
             background: `linear-gradient(135deg, ${currentTheme.primaryColor}15, ${currentTheme.primaryColor}05)`,
             borderLeft: `2px solid ${currentTheme.primaryColor}60`
          } : {}}
        >
          {content.split('\n').map((line, i) => (
             <p key={i} className={`min-h-[1.5em] ${i > 0 ? "mt-2" : ""}`}>{line}</p>
          ))}
          
          {/* Timestamp inside bubble */}
          <div className={`text-[10px] mt-2 opacity-40 font-medium ${isUser ? 'text-right' : 'text-left'}`}>
            {timeString}
          </div>
        </div>

        {/* Floating Action Menu (Reply/Copy) */}
        <AnimatePresence>
          {isHovered && (
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
                onClick={() => onReply && onReply(content)}
                className="p-2 rounded-full bg-black/40 border border-white/10 hover:bg-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all backdrop-blur-md shadow-lg"
                title="Reply"
              >
                <Reply size={14} />
              </button>
              <button 
                onClick={() => onCopy && onCopy(content)}
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