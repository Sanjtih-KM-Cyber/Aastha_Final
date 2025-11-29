import React from 'react';
import { LoginScreen } from '../components/auth/LoginScreen';
import { Background } from '../components/Background'; // Reuse your background component

export const Auth: React.FC = () => {
  return (
    <div className="w-full min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <Background />
      {/* Added max-w-md to constrain width */}
      <div className="w-full max-w-md z-10 relative">
        <LoginScreen />
      </div>
    </div>
  );
};