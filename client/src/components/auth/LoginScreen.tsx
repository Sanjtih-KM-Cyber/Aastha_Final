import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { GlassCard } from '../GlassCard';
import { Eye, Loader2, ArrowRight, Lock, BookLock, Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SECURITY_QUESTIONS } from '../../constants';
import api from '../../services/api';

type AuthMode = 'login' | 'register' | 'forgot-init' | 'forgot-complete';

interface LoginScreenProps {
    className?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ className = "" }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  
  // Login/Identifier now accepts either email or username
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register State - Added regUsername
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDiaryPassword, setRegDiaryPassword] = useState('');
  const [secQ1, setSecQ1] = useState(SECURITY_QUESTIONS[0]);
  const [secA1, setSecA1] = useState('');
  
  const [resetEmail, setResetEmail] = useState('');
  const [resetQuestion, setResetQuestion] = useState('');
  const [resetAnswer, setResetAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError('');
    try { 
        const res = await login(identifier, password); 
        // Check verification flag in success response
        if (res && res.requiresVerification) {
            navigate('/verify', { state: { email: res.email } });
        } else {
            navigate('/sanctuary'); 
        }
    } 
    catch (err: any) { 
        // Also check if the verification flag came back in an error-like response (though we use 200 for verification needed)
        if (err.requiresVerification || err.response?.data?.requiresVerification) {
             const email = err.email || err.response?.data?.email;
             navigate('/verify', { state: { email } });
        } else {
             setError(err.response?.data?.message || 'Login failed.'); 
        }
    } 
    finally { setIsLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError('');
    try {
      const res = await register({
          name: regName, 
          email: regEmail, 
          username: regUsername,
          password: regPassword, 
          diaryPassword: regDiaryPassword,
          securityQuestions: [{ question: secQ1, answer: secA1 }]
      });
      
      if (res && res.requiresVerification) {
          navigate('/verify', { state: { email: res.email } });
      } else {
          navigate('/sanctuary');
      }
    } catch (err: any) {
        if (err.requiresVerification || err.response?.data?.requiresVerification) {
            const email = err.email || err.response?.data?.email;
            navigate('/verify', { state: { email } });
        } else {
            setError(err.response?.data?.message || 'Registration failed.');
        }
    }
    finally { setIsLoading(false); }
  };

  const handleForgotInit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError('');
    try {
       const res = await api.post('/users/reset-init', { email: resetEmail });
       setResetQuestion(res.data.question); setMode('forgot-complete');
    } catch (err: any) { setError(err.response?.data?.message || 'Failed to find account.'); } 
    finally { setIsLoading(false); }
  };

  const handleForgotComplete = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError('');
    try {
        await api.post('/users/reset-complete', { email: resetEmail, answer: resetAnswer, newPassword });
        setMode('login'); setError(''); alert('Password reset successful.');
    } catch (err) { setError('Incorrect answer or system error.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className={`w-full ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div 
          key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          className="w-full"
        >
          <GlassCard className="p-8 border-white/20 shadow-2xl backdrop-blur-xl bg-black/40">
            <div className="text-center mb-6">
                <div className="w-10 h-10 rounded-full bg-white/10 mx-auto mb-2 flex items-center justify-center"><Lock size={18} /></div>
                <h2 className="font-serif text-xl">{mode === 'login' && 'Welcome Back'}{mode === 'register' && 'Create Sanctuary'}{mode.startsWith('forgot') && 'Recovery'}</h2>
            </div>
            {error && <div className="bg-red-500/20 text-red-200 text-xs p-3 rounded mb-4 text-center">{error}</div>}

            {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                    {/* FIX: Changed input type from email to text and updated placeholder to allow username */}
                    <input type="text" placeholder="Email or Username" value={identifier} onChange={e => setIdentifier(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500/50" required />
                    <div className="relative">
                        <input type={showPassword ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-teal-500/50" required />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3 text-white/40"><Eye size={18}/></button>
                    </div>
                    <button type="button" onClick={() => setMode('forgot-init')} className="text-xs text-teal-400 hover:underline block text-right">Forgot Password?</button>
                    <button disabled={isLoading} className="w-full bg-gradient-to-r from-teal-600 to-violet-600 py-3 rounded-xl text-white font-medium">{isLoading ? <Loader2 className="animate-spin mx-auto"/> : 'Enter Sanctuary'}</button>
                    <button type="button" onClick={() => setMode('register')} className="w-full text-xs text-white/40 mt-4 hover:text-white">New here? Create Account</button>
                </form>
            )}

            {mode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3 max-h-[60vh] overflow-y-auto scrollbar-hide">
                    <input type="text" placeholder="Full Name" value={regName} onChange={e => setRegName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" required />
                    <input type="text" placeholder="Username (Unique)" value={regUsername} onChange={e => setRegUsername(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" required />
                    <input type="email" placeholder="Email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" required />
                    <input type="password" placeholder="Password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" required />
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-xs text-white/50 mb-2 flex items-center gap-1"><BookLock size={12}/> Diary Encryption Password</p>
                        <input type="password" placeholder="Diary Password" value={regDiaryPassword} onChange={e => setRegDiaryPassword(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white" required />
                    </div>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                         <p className="text-xs text-white/50 mb-2 flex items-center gap-1"><Shield size={12}/> Security Question (For Recovery)</p>
                         <select value={secQ1} onChange={e => setSecQ1(e.target.value)} className="w-full bg-black/20 text-xs text-white p-2 rounded mb-2 border border-white/10">
                             {SECURITY_QUESTIONS.map(q => <option key={q} value={q} className="bg-black">{q}</option>)}
                         </select>
                         <input type="text" placeholder="Answer" value={secA1} onChange={e => setSecA1(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white" required />
                    </div>
                    <button disabled={isLoading} className="w-full bg-teal-600 py-3 rounded-xl text-white font-medium mt-2">{isLoading ? <Loader2 className="animate-spin mx-auto"/> : 'Create Account'}</button>
                    <button type="button" onClick={() => setMode('login')} className="w-full text-xs text-white/40 mt-2 hover:text-white">Back to Login</button>
                </form>
            )}

            {mode === 'forgot-init' && (
                <form onSubmit={handleForgotInit} className="space-y-4">
                    <p className="text-sm text-white/60 text-center">Enter your registered email to find your security question.</p>
                    <input type="email" placeholder="Registered Email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" required />
                    <button disabled={isLoading} className="w-full bg-teal-600 py-3 rounded-xl text-white">{isLoading ? <Loader2 className="animate-spin mx-auto"/> : 'Find Account'}</button>
                    <button type="button" onClick={() => setMode('login')} className="flex items-center justify-center gap-1 w-full text-xs text-white/40 mt-4 hover:text-white"><ArrowLeft size={12}/> Back</button>
                </form>
            )}

            {mode === 'forgot-complete' && (
                <form onSubmit={handleForgotComplete} className="space-y-4">
                    <p className="text-xs text-teal-300 text-center uppercase tracking-wide">Security Question</p>
                    <p className="text-sm text-white text-center font-medium">{resetQuestion}</p>
                    <input type="text" placeholder="Your Answer" value={resetAnswer} onChange={e => setResetAnswer(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" required />
                    <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" required />
                    <button disabled={isLoading} className="w-full bg-teal-600 py-3 rounded-xl text-white">{isLoading ? <Loader2 className="animate-spin mx-auto"/> : 'Reset Password'}</button>
                </form>
            )}
          </GlassCard>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};