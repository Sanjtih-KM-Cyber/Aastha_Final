import React from 'react';
import { motion } from 'framer-motion';
import { GlassCardProps } from '../types';

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick, hoverEffect = true }) => {
  return (
    <motion.div
      whileHover={hoverEffect ? { scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.07)' } : {}}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`glass-panel rounded-2xl p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
};