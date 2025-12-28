import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingFallback: React.FC = () => {
  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-black text-white font-serif z-50">
      <Loader2 className="w-8 h-8 animate-spin text-teal-500 mb-4" />
      <span className="text-white/50 text-sm tracking-widest uppercase">Loading Sanctuary...</span>
    </div>
  );
};
