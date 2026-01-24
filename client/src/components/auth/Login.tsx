import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Sparkles, Loader2, Eye, EyeOff, BookLock, Shield, KeyRound, CheckCircle2 } from 'lucide-react';
import { FadeIn } from '../landing/FadeIn';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import { SECURITY_QUESTIONS } from '../../constants';

const MOTIVATIONAL_QUOTES = [
  "Your mind is a garden. Your thoughts are the seeds. You can grow flowers or you can grow weeds.",
  "Peace comes from within. Do not seek it without.",
  "You don't have to control your thoughts. You just have to stop letting them control you.",
  "Breath is the anchor of your mindfulness.",
  "Feelings come and go like clouds in a windy sky. Conscious breathing is my anchor.",
  "It is not a daily increase, but a daily decrease. Hack away at the unessential.",
  "The present moment is the only moment available to us, and it is the door to all moments.",
  "Mental health is not a destination, but a process. It's about how you drive, not where you're going.",
  "Self-care is how you take your power back.",
  "You are allowed to be both a masterpiece and a work in progress simultaneously.",
  "Sometimes the most productive thing you can do is relax.",
  "Tough times never last, but tough people do.",
  "Healing takes time, and asking for help is a courageous step.",
  "Be gentle with yourself, you're doing the best you can.",
  "What you think, you become. What you feel, you attract. What you imagine, you create."
];

interface LoginProps {
  onBack?: () => void;
  onLoginSuccess?: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot-init' | 'forgot-otp' | 'forgot-complete' | 'verify-otp';

export const Login: React.FC<LoginProps> = ({ onBack, onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  // Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regDob, setRegDob] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDiaryPassword, setRegDiaryPassword] = useState('');
  const [secQ1, setSecQ1] = useState(SECURITY_QUESTIONS[0]);
  const [secA1, setSecA1] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegDiaryPassword, setShowRegDiaryPassword] = useState(false);

  // OTP State
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);

  // Reset State
  const [resetEmail, setResetEmail] = useState('');
  const [resetQuestion, setResetQuestion] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetAnswer, setResetAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [quote, setQuote] = useState(MOTIVATIONAL_QUOTES[0]);

  useEffect(() => {
      // Random Quote on Mount
      setQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
  }, []);

  // Handle incoming verify request (e.g. from failed login elsewhere)
  useEffect(() => {
    if (location.state?.email) {
      setRegEmail(location.state.email);
      setMode('verify-otp');
    }
  }, [location.state]);

  // OTP Cooldown Timer
  useEffect(() => {
    let timer: any;
    if (otpResendCooldown > 0) {
      timer = setInterval(() => setOtpResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpResendCooldown]);

  // Reset OTP state when switching modes
  useEffect(() => {
    setOtp(['', '', '', '', '', '']);
  }, [mode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError(null);
    try {
        const res = await login(identifier, password);
        if (res && res.requiresVerification) {
           setRegEmail(res.email);
           setMode('verify-otp');
        } else {
           if (onLoginSuccess) onLoginSuccess();
           navigate('/sanctuary');
        }
    } catch(err: any) {
       console.error(err);
       if (err.requiresVerification || err.response?.data?.requiresVerification) {
          const email = err.email || err.response?.data?.email;
          if (email) setRegEmail(email);
          setMode('verify-otp');
       } else {
           const msg = err.response?.data?.message || err.message || 'Login failed';
           setError(msg);
       }
    }
    finally { setIsLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoading(true); setError(null);
    try {
        const res = await register({
            name: regName,
            email: regEmail,
            username: regUsername,
            dateOfBirth: regDob,
            password: regPassword,
            diaryPassword: regDiaryPassword,
            securityQuestions: [{ question: secQ1, answer: secA1 }]
        });

        if (res && res.requiresVerification) {
            setMode('verify-otp');
        } else {
            // Should not happen with current strict verification, but safe fallback
            navigate('/sanctuary');
        }
    } catch(err: any) {
        console.error(err);
        setError(err.response?.data?.message || 'Registration failed');
    }
    finally { setIsLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true); setError(null);
      const code = otp.join('');
      if (code.length !== 6) {
          setError('Please enter a 6-digit code');
          setIsLoading(false);
          return;
      }

      try {
          const res = await api.post('/users/verify-otp', { email: regEmail, otp: code });

          // Auto-login Logic
          if (res.data && (res.data.token || res.data._id)) {
             localStorage.setItem('userInfo', JSON.stringify(res.data));
             localStorage.setItem('auth_last_active', Date.now().toString());
          }

          if (onLoginSuccess) onLoginSuccess();
          // Hard reload to sync context completely
          window.location.href = '/sanctuary';
      } catch(err: any) {
          console.error(err);
          setError(err.response?.data?.message || 'Invalid code');
      }
      finally { setIsLoading(false); }
  };

  const handleResendOtp = async () => {
    if (otpResendCooldown > 0) return;
    try {
        await api.post('/users/resend-otp', { email: mode === 'verify-otp' ? regEmail : resetEmail });
        setOtpResendCooldown(60);
        setError(null); // Clear any errors
        alert('Code resent! Check your spam folder.');
    } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to resend code');
    }
  };

  const handleForgotInit = async (e: React.FormEvent) => {
      e.preventDefault(); setIsLoading(true); setError(null);
      try {
          await api.post('/users/reset-init', { email: resetEmail });
          // No longer getting question immediately. Move to OTP step.
          setMode('forgot-otp');
      } catch (err: any) {
          setError(err.response?.data?.message || 'Account not found');
      } finally {
          setIsLoading(false);
      }
  };

  const handleForgotOtpVerify = async (e: React.FormEvent) => {
      e.preventDefault(); setIsLoading(true); setError(null);
      const code = otp.join('');
      if (code.length !== 6) {
          setError('Please enter a 6-digit code');
          setIsLoading(false);
          return;
      }

      try {
          const res = await api.post('/users/reset-verify-otp', { email: resetEmail, otp: code });
          // Success: Receive Token and Question
          setResetQuestion(res.data.question);
          setResetToken(res.data.resetToken);
          setMode('forgot-complete');
      } catch (err: any) {
          setError(err.response?.data?.message || 'Invalid OTP');
      } finally {
          setIsLoading(false);
      }
  };

  const handleForgotComplete = async (e: React.FormEvent) => {
      e.preventDefault(); setIsLoading(true); setError(null);
      try {
          await api.post('/users/reset-complete', {
            email: resetEmail,
            answer: resetAnswer,
            newPassword,
            resetToken: resetToken
          });
          alert('Password reset successful. Please login.');
          setMode('login');
      } catch (err: any) {
          setError(err.response?.data?.message || 'Incorrect answer');
      } finally {
          setIsLoading(false);
      }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
        otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !otp[index] && index > 0) {
          otpRefs.current[index - 1]?.focus();
      }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text');
      const cleanData = pasteData.replace(/\D/g, '').slice(0, 6); // Digits only, max 6

      if (!cleanData) return;

      const newOtp = [...otp];
      for (let i = 0; i < cleanData.length; i++) {
          newOtp[i] = cleanData[i];
      }
      setOtp(newOtp);

      // Focus appropriate input (end of pasted data or last box)
      const nextIndex = Math.min(cleanData.length, 5);
      otpRefs.current[nextIndex]?.focus();
  };

  const handleBack = () => {
      // Standard back behavior:
      if (mode === 'register' || mode === 'forgot-init') setMode('login');
      else if (mode === 'forgot-otp') setMode('forgot-init');
      else if (mode === 'forgot-complete') setMode('forgot-otp');
      else if (mode === 'verify-otp') setMode('login');
      else if (onBack) onBack();
      else navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex font-sans">
      {/* Left Panel - Art/Sanctuary (Desktop Only) */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center p-12 text-white bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-900/40 via-black to-black" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse-glow" />

        <div className="relative z-10 max-w-lg backdrop-blur-sm p-12 rounded-3xl border border-white/5 bg-white/5">
          <div className="w-16 h-16 bg-gradient-to-br from-violet-50 to-indigo-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-violet-500/20">
            {mode === 'verify-otp' || mode === 'forgot-otp' ? <Shield size={32} className="text-white"/> : <Sparkles size={32} className="text-white" />}
          </div>
          <h2 className="text-5xl font-bold mb-6 leading-tight font-serif">
            {mode === 'login' && "Return to\nSanctuary."}
            {mode === 'register' && "Begin Your\nJourney."}
            {mode === 'verify-otp' && "Secure\nVerification."}
            {mode === 'forgot-otp' && "Verify Your\nIdentity."}
            {mode === 'forgot-init' && "Recover Your\nPeace."}
            {mode === 'forgot-complete' && "Secure Your\nAccount."}
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed italic">
            {mode === 'verify-otp' || mode === 'forgot-otp'
                ? "We take your privacy seriously. Please verify your identity to ensure your sanctuary remains yours alone."
                : `"${quote}"`}
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-[#0B0F17] relative">
        <button
          onClick={handleBack}
          className="absolute top-8 left-8 p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all group"
        >
          <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="w-full max-w-md">
          <FadeIn direction="up">
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-white mb-2">
                {mode === 'login' && 'Welcome Back'}
                {mode === 'register' && 'Create Account'}
                {mode === 'verify-otp' && 'Check your Email'}
                {mode === 'forgot-otp' && 'Check your Email'}
                {mode === 'forgot-init' && 'Find Account'}
                {mode === 'forgot-complete' && 'Reset Password'}
              </h2>
              <p className="text-slate-400">
                {mode === 'login' && 'Please enter your details to sign in.'}
                {mode === 'register' && 'Join thousands finding peace today.'}
                {mode === 'verify-otp' && `We sent a code to ${regEmail || 'your email'}.`}
                {mode === 'forgot-otp' && `We sent a code to ${resetEmail || 'your email'}.`}
                {mode === 'forgot-init' && 'Enter email to recover password.'}
                {mode === 'forgot-complete' && 'Answer your security question.'}
              </p>
            </div>

            {error && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200 text-sm text-center">
                    {error}
                </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form className="space-y-5" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Email or Username</label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-300">Password</label>
                    <button type="button" onClick={() => setMode('forgot-init')} className="text-xs text-violet-400 hover:text-violet-300">Forgot?</button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-white pr-10"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-500 hover:text-white"><Eye size={18}/></button>
                  </div>
                </div>
                <button disabled={isLoading} className="w-full bg-violet-600 text-white py-4 rounded-xl font-bold hover:bg-violet-700 transition-all flex items-center justify-center">
                  {isLoading ? <Loader2 className="animate-spin" /> : 'Enter Sanctuary'}
                </button>
                <div className="text-center mt-6">
                  <button type="button" onClick={() => setMode('register')} className="text-slate-400 hover:text-white text-sm">Don't have an account? <span className="text-violet-400 font-bold">Sign up</span></button>
                </div>
              </form>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
               <form className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2" onSubmit={handleRegister}>
                  <div className="grid grid-cols-2 gap-4">
                      <input type="text" placeholder="Full Name" value={regName} onChange={e => setRegName(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white w-full" required />
                      <input type="text" placeholder="Username" value={regUsername} onChange={e => setRegUsername(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white w-full" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <input type="email" placeholder="Email Address" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white w-full" required />
                      <input
                        type="date"
                        placeholder="Date of Birth"
                        value={regDob}
                        onChange={e => setRegDob(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white w-full placeholder-white/50"
                        required
                      />
                  </div>

                  <div className="relative">
                      <input type={showRegPassword ? "text" : "password"} placeholder="Password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white w-full pr-10" required />
                      <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-3 text-slate-500 hover:text-white"><Eye size={18}/></button>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex items-center gap-2 mb-2 text-slate-300 text-xs uppercase tracking-wider font-bold">
                          <BookLock size={12} className="text-violet-400"/> Diary Encryption
                      </div>
                      <div className="relative">
                        <input
                            type={showRegDiaryPassword ? "text" : "password"}
                            placeholder="Diary Password (Different from login)"
                            value={regDiaryPassword}
                            onChange={e => setRegDiaryPassword(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white w-full text-sm mb-1 pr-9"
                            required
                        />
                        <button type="button" onClick={() => setShowRegDiaryPassword(!showRegDiaryPassword)} className="absolute right-2 top-2 text-slate-500 hover:text-white">
                            {showRegDiaryPassword ? <EyeOff size={14}/> : <Eye size={14}/>}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500">This key encrypts your journals locally. We cannot recover it.</p>
                  </div>

                  <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex items-center gap-2 mb-2 text-slate-300 text-xs uppercase tracking-wider font-bold">
                          <Shield size={12} className="text-teal-400"/> Security Question
                      </div>
                      <select value={secQ1} onChange={e => setSecQ1(e.target.value)} className="w-full bg-black/20 text-xs text-white p-2 rounded mb-2 border border-white/10 cursor-pointer">
                          {SECURITY_QUESTIONS.map(q => <option key={q} value={q} className="bg-gray-900">{q}</option>)}
                      </select>
                      <input type="text" placeholder="Answer" value={secA1} onChange={e => setSecA1(e.target.value)} className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white w-full text-sm" required />
                  </div>

                  <button disabled={isLoading} className="w-full bg-violet-600 text-white py-4 rounded-xl font-bold hover:bg-violet-700 transition-all flex items-center justify-center">
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Create Account'}
                  </button>
                  <div className="text-center">
                    <button type="button" onClick={() => setMode('login')} className="text-slate-400 hover:text-white text-sm">Already have an account? <span className="text-violet-400 font-bold">Login</span></button>
                  </div>
               </form>
            )}

            {/* VERIFY OTP FORM (Combined for Registration and Forgot Password) */}
            {(mode === 'verify-otp' || mode === 'forgot-otp') && (
                <form className="space-y-8" onSubmit={mode === 'verify-otp' ? handleVerifyOtp : handleForgotOtpVerify}>
                    <div className="flex justify-between gap-2">
                        {otp.map((digit, idx) => (
                            <input
                                key={idx}
                                ref={el => { otpRefs.current[idx] = el; }}
                                type="text"
                                maxLength={1}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="\d{1}"
                                value={digit}
                                onChange={(e) => handleOtpChange(idx, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                onPaste={handleOtpPaste}
                                className="w-12 h-14 rounded-xl bg-white/5 border border-white/10 text-center text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all focus:bg-white/10"
                            />
                        ))}
                    </div>

                    <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4 flex gap-3 items-start">
                        <KeyRound className="text-violet-400 shrink-0 mt-0.5" size={18} />
                        <div>
                            <p className="text-sm text-violet-200 font-medium">Secure Verification</p>
                            <p className="text-xs text-violet-300/60 mt-1">
                                Please enter the 6-digit code sent to {mode === 'verify-otp' ? regEmail : resetEmail}. Check your spam folder.
                            </p>
                        </div>
                    </div>

                    <button disabled={isLoading} className="w-full bg-violet-600 text-white py-4 rounded-xl font-bold hover:bg-violet-700 transition-all flex items-center justify-center gap-2">
                         {isLoading ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20}/> Verify & Continue</>}
                    </button>

                    <div className="text-center">
                        <p className="text-slate-500 text-sm">Didn't receive code?
                            <button
                                type="button"
                                onClick={handleResendOtp}
                                disabled={otpResendCooldown > 0}
                                className="text-violet-400 font-bold hover:text-violet-300 ml-1 disabled:opacity-50"
                            >
                                {otpResendCooldown > 0 ? `Wait ${otpResendCooldown}s` : 'Resend'}
                            </button>
                        </p>
                    </div>
                </form>
            )}

            {/* FORGOT PASSWORD INIT */}
            {mode === 'forgot-init' && (
                <form className="space-y-6" onSubmit={handleForgotInit}>
                    <input type="email" placeholder="Enter your registered email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white w-full" required />
                    <button disabled={isLoading} className="w-full bg-violet-600 text-white py-4 rounded-xl font-bold hover:bg-violet-700 transition-all flex items-center justify-center">
                         {isLoading ? <Loader2 className="animate-spin" /> : 'Find Account'}
                    </button>
                    <button type="button" onClick={() => setMode('login')} className="w-full text-slate-500 text-sm hover:text-white">Back to Login</button>
                </form>
            )}

            {/* FORGOT PASSWORD COMPLETE */}
            {mode === 'forgot-complete' && (
                <form className="space-y-6" onSubmit={handleForgotComplete}>
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                        <p className="text-xs text-violet-400 uppercase font-bold tracking-wide mb-2">Security Question</p>
                        <p className="text-white font-medium">{resetQuestion}</p>
                    </div>
                    <input type="text" placeholder="Your Answer" value={resetAnswer} onChange={e => setResetAnswer(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white w-full" required />
                    <input type="password" placeholder="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white w-full" required />

                    <button disabled={isLoading} className="w-full bg-violet-600 text-white py-4 rounded-xl font-bold hover:bg-violet-700 transition-all flex items-center justify-center">
                         {isLoading ? <Loader2 className="animate-spin" /> : 'Reset Password'}
                    </button>
                </form>
            )}

          </FadeIn>
        </div>
      </div>
    </div>
  );
};
