import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowRight, ShieldCheck, Mail, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const OTPInput = ({ length = 6, onComplete }: { length?: number; onComplete: (code: string) => void }) => {
  const [code, setCode] = useState<string[]>(new Array(length).fill(''));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const processInput = (e: React.ChangeEvent<HTMLInputElement>, slot: number) => {
    const num = e.target.value.replace(/[^0-9]/g, ''); // Only numbers
    const newCode = [...code];
    newCode[slot] = num.slice(-1); // Take last char
    setCode(newCode);

    if (slot < length - 1 && num) {
      inputs.current[slot + 1]?.focus();
    }

    const finalCode = newCode.join('');
    if (finalCode.length === length) onComplete(finalCode);
  };

  const onKeyUp = (e: React.KeyboardEvent<HTMLInputElement>, slot: number) => {
    if (e.key === 'Backspace' && !code[slot] && slot > 0) {
      inputs.current[slot - 1]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center my-6">
      {code.map((num, idx) => (
        <input
          key={idx}
          ref={(ref) => (inputs.current[idx] = ref)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={num}
          onChange={(e) => processInput(e, idx)}
          onKeyUp={(e) => onKeyUp(e, idx)}
          className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-2xl font-mono text-white focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400/50 transition-all"
        />
      ))}
    </div>
  );
};

export const VerifyOTPScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth(); // We'll use this to manually set user after verification

  // State
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [otp, setOtp] = useState('');

  useEffect(() => {
     if (location.state?.email) {
         setEmail(location.state.email);
     } else {
         // If tried to access directly without email state, go back to login
         navigate('/login');
     }
  }, [location, navigate]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async (codeToVerify?: string) => {
      const code = codeToVerify || otp;
      if (code.length !== 6) return;

      setLoading(true);
      setError(null);

      try {
          const res = await api.post('/users/verify-otp', { email, otp: code });
          // Success! Context logic for "login" usually expects (email, password) OR we can manually hydrate.
          // Since our AuthContext relies on the cookie primarily, we can just call `checkAuth` or `window.location.reload`
          // OR better, we explicitly update the user state.
          // Since 'login' function in context usually does the API call, we need a way to just 'refresh'.

          // Assuming AuthContext has a reload or we can just fetch ME.
          // Actually, let's just navigate to Sanctuary.
          // If the cookie is set (which verify-otp does), the next /me call will work.

          // Force a full reload to ensure AuthContext picks up the new cookie and state
          window.location.href = '/sanctuary';

      } catch (err: any) {
          setError(err.response?.data?.message || 'Verification failed');
          setLoading(false);
      }
  };

  const handleResend = async () => {
      if (resendCooldown > 0) return;
      setLoading(true);
      setError(null);
      try {
          await api.post('/users/resend-otp', { email });
          setResendCooldown(60);
          alert("Code sent!");
      } catch (err: any) {
          setError(err.response?.data?.message || 'Failed to resend');
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0e17] text-white relative overflow-hidden font-sans">

        {/* Background Ambience */}
        <div className="absolute inset-0 z-0">
             <div className="absolute top-[-20%] left-[-20%] w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[120px]" />
             <div className="absolute bottom-[-20%] right-[-20%] w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px]" />
        </div>

        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md p-8 relative z-10"
        >
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mb-4 border border-teal-500/20">
                        <ShieldCheck size={32} className="text-teal-400" />
                    </div>
                    <h2 className="text-2xl font-serif font-bold mb-2">Verify Account</h2>
                    <p className="text-white/50 text-sm">
                        We sent a code to <br/>
                        <span className="text-white font-medium">{email}</span>
                    </p>
                </div>

                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 flex items-center gap-3 text-red-200 text-sm overflow-hidden">
                            <AlertCircle size={16} className="shrink-0" /> {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <OTPInput onComplete={(code) => { setOtp(code); handleVerify(code); }} />

                <button
                    onClick={() => handleVerify()}
                    disabled={loading || otp.length !== 6}
                    className="w-full py-4 rounded-xl font-medium text-lg mb-6 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-teal-500 to-indigo-600 hover:scale-[1.02] shadow-lg shadow-teal-500/20"
                >
                    {loading ? <RefreshCw className="animate-spin" /> : <>Verify <ArrowRight size={20} /></>}
                </button>

                <div className="text-center">
                    <button
                        onClick={handleResend}
                        disabled={resendCooldown > 0}
                        className="text-sm text-white/40 hover:text-white transition-colors disabled:opacity-50"
                    >
                        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend"}
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                     <button onClick={() => navigate('/login')} className="text-xs text-white/30 hover:text-white transition-colors">
                         Log out & try different email
                     </button>
                </div>
            </div>
        </motion.div>
    </div>
  );
};
