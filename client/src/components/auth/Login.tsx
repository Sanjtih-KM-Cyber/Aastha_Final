import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Sparkles, Loader2, Eye, EyeOff, BookLock, Shield, KeyRound, CheckCircle2 } from 'lucide-react';
import { Sun, Moon } from 'lucide-react';
import { usePublicTheme } from '../../hooks/usePublicTheme';
import { FadeIn } from '../landing/FadeIn';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { SECURITY_QUESTIONS } from '../../constants';
import { useTheme } from '../../context/ThemeContext'; // Import for Lite Mode

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
  const { isLowPowerMode } = useTheme(); // LITE MODE
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
    e.preventDefault(); setError(null);
    const dob = new Date(regDob);
    const age = (Date.now() - dob.getTime()) / (365.2425 * 86400000);
    if (!regDob || isNaN(dob.getTime()) || age < 18) {
      setError("Aastha is for adults (18+). If you're going through something hard, Tele-MANAS is free and open 24/7 on 14416.");
      return;
    }
    if (!acceptTerms) { setError('Please agree to the Terms and Privacy Policy.'); return; }
    setIsLoading(true);
    try {
        const res = await register({
            name: regName,
            email: regEmail,
            username: regUsername,
            dateOfBirth: regDob,
            acceptTerms,
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
          // Use client-side navigation instead of hard reload to support Capacitor/SPA
          navigate('/sanctuary');
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

  const isCodeStep = mode === 'verify-otp' || mode === 'forgot-otp';
  const [acceptTerms, setAcceptTerms] = useState(false);
  const publicTheme = usePublicTheme();
  const heroTitle: Record<string, string> = {
    'login': 'Welcome back to your sanctuary.',
    'register': 'A quiet place, just for you.',
    'verify-otp': 'One quick check.',
    'forgot-otp': 'Let’s make sure it’s you.',
    'forgot-init': 'Let’s get you back in.',
    'forgot-complete': 'Almost there.',
  };
  const formTitle: Record<string, string> = {
    'login': 'Sign in', 'register': 'Create your account', 'verify-otp': 'Check your email',
    'forgot-otp': 'Check your email', 'forgot-init': 'Forgot password', 'forgot-complete': 'Set a new password',
  };
  const formSub: Record<string, string> = {
    'login': 'Use your email or username.',
    'register': 'Takes a minute. Free to start.',
    'verify-otp': `We sent a 6-digit code to ${regEmail || 'your email'}.`,
    'forgot-otp': `We sent a 6-digit code to ${resetEmail || 'your email'}.`,
    'forgot-init': 'Enter the email you signed up with.',
    'forgot-complete': 'Answer your security question, then choose a new password.',
  };
  const label = 'block text-sm font-medium text-md-on-surface-variant mb-1.5 px-1';
  const field = 'w-full h-12 px-4 rounded-[14px] bg-md-surface-container-highest text-md-on-surface placeholder:text-md-on-surface-variant/60 border-2 border-transparent focus:border-md-primary focus:outline-none transition-colors';
  const primaryBtn = 'w-full h-14 rounded-full bg-md-primary text-md-on-primary font-semibold text-base flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.99] transition disabled:opacity-60';
  const textBtn = 'text-md-primary font-semibold hover:underline underline-offset-4';

  return (
    <div style={publicTheme.style} className="min-h-[100dvh] bg-md-surface text-md-on-surface flex font-sans relative overflow-hidden">
      {/* Soft seed-coloured light (static — no blur animation, cheap on phones) */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-md-primary/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-32 w-[560px] h-[560px] rounded-full bg-md-tertiary/15 blur-3xl" />

      {/* Top bar (Liquid Glass control) */}
      <div className="fixed top-0 inset-x-0 z-30 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="glass rounded-full h-14 max-w-6xl mx-auto flex items-center gap-2 px-2">
          <button onClick={handleBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center text-md-on-surface hover:bg-md-on-surface/10">
            <ArrowLeft size={20} />
          </button>
          <img src="/logo.png" alt="" className="w-8 h-8 rounded-[10px] object-cover" />
          <span className="font-serif text-lg">Aastha</span>
          <button onClick={publicTheme.toggle} aria-label={publicTheme.isLight ? 'Switch to dark mode' : 'Switch to light mode'}
            className="ml-auto w-10 h-10 rounded-full flex items-center justify-center text-md-on-surface-variant hover:bg-md-on-surface/10">
            {publicTheme.isLight ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 items-center px-4 pt-[calc(env(safe-area-inset-top)+6rem)] pb-10">
        {/* Hero (desktop) — tonal Material card */}
        <div className="hidden lg:flex flex-col justify-between rounded-[36px] bg-md-primary-container text-md-on-primary-container p-12 min-h-[560px] relative overflow-hidden">
          <div aria-hidden className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-md-primary/25" />
          <div aria-hidden className="absolute right-16 bottom-24 w-40 h-40 rounded-[48px] bg-md-tertiary/25 rotate-12" />
          <div className="relative">
            <span className="inline-flex w-16 h-16 rounded-[22px] overflow-hidden bg-md-surface shadow-md">
              {isCodeStep ? <span className="w-full h-full flex items-center justify-center bg-md-primary text-md-on-primary"><Shield size={30} /></span> : <img src="/logo.png" alt="" className="w-full h-full object-cover" />}
            </span>
            <h2 className="mt-10 font-serif text-5xl leading-[1.1] whitespace-pre-line">{heroTitle[mode]}</h2>
          </div>
          <p className="relative text-lg leading-relaxed opacity-90 max-w-md">
            {isCodeStep ? 'Your sanctuary stays yours — we check it’s really you before letting anyone in.' : `“${quote}”`}
          </p>
        </div>

        {/* Form card */}
        <div className="w-full max-w-md mx-auto">
          <FadeIn direction="up">
            <div className="rounded-[32px] bg-md-surface-container-low border border-md-outline-variant/30 p-6 sm:p-8 shadow-xl">
              <div className="lg:hidden flex justify-center mb-5">
                <span className="inline-flex w-16 h-16 rounded-[22px] overflow-hidden shadow-md">
                  {isCodeStep ? <span className="w-full h-full flex items-center justify-center bg-md-primary text-md-on-primary"><Shield size={30} /></span> : <img src="/logo.png" alt="" className="w-full h-full object-cover" />}
                </span>
              </div>

              {(mode === 'login' || mode === 'register') && (
                <div role="tablist" className="flex p-1 rounded-full bg-md-surface-container-highest mb-6">
                  {(['login', 'register'] as const).map((m) => (
                    <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => { setError(null); setMode(m); }}
                      className={`flex-1 h-10 rounded-full text-sm font-semibold transition-colors ${mode === m ? 'bg-md-primary text-md-on-primary shadow-sm' : 'text-md-on-surface-variant hover:text-md-on-surface'}`}>
                      {m === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                  ))}
                </div>
              )}

              <div className="mb-6 text-center lg:text-left">
                <h1 className="font-serif text-3xl text-md-on-surface">{formTitle[mode]}</h1>
                <p className="text-sm text-md-on-surface-variant mt-1.5">{formSub[mode]}</p>
              </div>

              {error && (
                <div role="alert" className="mb-5 p-3 rounded-[16px] bg-md-error-container text-md-on-error-container text-sm text-center">{error}</div>
              )}

              {/* SIGN IN */}
              {mode === 'login' && (
                <form className="space-y-4" onSubmit={handleLogin}>
                  <div>
                    <label className={label} htmlFor="login-id">Email or username</label>
                    <input id="login-id" type="text" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} className={field} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={label} htmlFor="login-pw">Password</label>
                      <button type="button" onClick={() => { setError(null); setMode('forgot-init'); }} className={`text-xs mb-1.5 ${textBtn}`}>Forgot?</button>
                    </div>
                    <div className="relative">
                      <input id="login-pw" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={`${field} pr-12`} />
                      <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-1.5 top-1.5 w-9 h-9 rounded-full flex items-center justify-center text-md-on-surface-variant hover:bg-md-on-surface/10">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <button disabled={isLoading} className={`${primaryBtn} mt-2`}>
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Enter Sanctuary'}
                  </button>
                </form>
              )}

              {/* CREATE ACCOUNT */}
              {mode === 'register' && (
                <form className="space-y-4" onSubmit={handleRegister}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={label} htmlFor="r-name">Name</label><input id="r-name" type="text" autoComplete="name" value={regName} onChange={e => setRegName(e.target.value)} className={field} required /></div>
                    <div><label className={label} htmlFor="r-user">Username</label><input id="r-user" type="text" autoComplete="username" value={regUsername} onChange={e => setRegUsername(e.target.value)} className={field} required /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={label} htmlFor="r-email">Email</label><input id="r-email" type="email" autoComplete="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} className={field} required /></div>
                    <div><label className={label} htmlFor="r-dob">Date of birth</label><input id="r-dob" type="date" value={regDob} onChange={e => setRegDob(e.target.value)} className={`${field} [color-scheme:dark]`} required /></div>
                  </div>
                  <div>
                    <label className={label} htmlFor="r-pw">Password</label>
                    <div className="relative">
                      <input id="r-pw" type={showRegPassword ? 'text' : 'password'} autoComplete="new-password" value={regPassword} onChange={e => setRegPassword(e.target.value)} className={`${field} pr-12`} required />
                      <button type="button" aria-label={showRegPassword ? 'Hide password' : 'Show password'} onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-1.5 top-1.5 w-9 h-9 rounded-full flex items-center justify-center text-md-on-surface-variant hover:bg-md-on-surface/10">
                        {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[20px] bg-md-surface-container p-4">
                    <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-md-on-surface"><BookLock size={16} className="text-md-primary" /> Diary lock</div>
                    <p className="text-xs text-md-on-surface-variant mb-3">A separate password for your diary. Forgot it later? Reset it in Settings — your entries stay.</p>
                    <div className="relative">
                      <input type={showRegDiaryPassword ? 'text' : 'password'} aria-label="Diary password" placeholder="Diary password (different from login)" value={regDiaryPassword} onChange={e => setRegDiaryPassword(e.target.value)} className={`${field} pr-12`} required />
                      <button type="button" aria-label={showRegDiaryPassword ? 'Hide diary password' : 'Show diary password'} onClick={() => setShowRegDiaryPassword(!showRegDiaryPassword)}
                        className="absolute right-1.5 top-1.5 w-9 h-9 rounded-full flex items-center justify-center text-md-on-surface-variant hover:bg-md-on-surface/10">
                        {showRegDiaryPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[20px] bg-md-surface-container p-4">
                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-md-on-surface"><Shield size={16} className="text-md-primary" /> Security question</div>
                    <select aria-label="Security question" value={secQ1} onChange={e => setSecQ1(e.target.value)} className={`${field} mb-2 text-sm`}>
                      {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <input type="text" aria-label="Answer" placeholder="Your answer" value={secA1} onChange={e => setSecA1(e.target.value)} className={field} required />
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer px-1">
                    <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} required
                      className="mt-0.5 w-5 h-5 shrink-0 accent-[rgb(var(--md-primary))]" />
                    <span className="text-sm text-md-on-surface-variant leading-relaxed">
                      I’m 18 or older and I agree to the <Link to="/terms" target="_blank" className="text-md-primary font-semibold underline-offset-2 hover:underline">Terms</Link> and
                      the <Link to="/privacy" target="_blank" className="text-md-primary font-semibold underline-offset-2 hover:underline">Privacy Policy</Link>.
                    </span>
                  </label>
                  <button disabled={isLoading || !acceptTerms} className={primaryBtn}>
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Create account'}
                  </button>
                </form>
              )}

              {/* CODE (sign-up + forgot password) */}
              {isCodeStep && (
                <form className="space-y-6" onSubmit={mode === 'verify-otp' ? handleVerifyOtp : handleForgotOtpVerify}>
                  <div className="flex justify-between gap-2" aria-label="6-digit code">
                    {otp.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={el => { otpRefs.current[idx] = el; }}
                        type="text" maxLength={1} inputMode="numeric" autoComplete="one-time-code" pattern="\d{1}"
                        aria-label={`Digit ${idx + 1}`}
                        value={digit}
                        onChange={(e) => handleOtpChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        onPaste={handleOtpPaste}
                        className={`w-12 h-14 sm:w-14 sm:h-16 rounded-[16px] text-center text-2xl font-semibold text-md-on-surface border-2 focus:outline-none transition-colors ${digit ? 'bg-md-secondary-container border-md-primary/40' : 'bg-md-surface-container-highest border-transparent'} focus:border-md-primary`}
                      />
                    ))}
                  </div>
                  <div className="rounded-[20px] bg-md-surface-container p-4 flex gap-3 items-start">
                    <KeyRound className="text-md-primary shrink-0 mt-0.5" size={18} />
                    <p className="text-xs text-md-on-surface-variant leading-relaxed">The code expires in 10 minutes. Can’t find it? Check spam or promotions.</p>
                  </div>
                  <button disabled={isLoading} className={primaryBtn}>
                    {isLoading ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20} /> Verify</>}
                  </button>
                  <p className="text-center text-sm text-md-on-surface-variant">
                    Didn’t get it?{' '}
                    <button type="button" onClick={handleResendOtp} disabled={otpResendCooldown > 0} className={`${textBtn} disabled:opacity-50 disabled:no-underline`}>
                      {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : 'Resend code'}
                    </button>
                  </p>
                </form>
              )}

              {/* FORGOT PASSWORD — email */}
              {mode === 'forgot-init' && (
                <form className="space-y-4" onSubmit={handleForgotInit}>
                  <div><label className={label} htmlFor="f-email">Email</label><input id="f-email" type="email" autoComplete="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} className={field} required /></div>
                  <button disabled={isLoading} className={primaryBtn}>{isLoading ? <Loader2 className="animate-spin" /> : 'Send code'}</button>
                  <button type="button" onClick={() => { setError(null); setMode('login'); }} className="w-full h-12 rounded-full text-md-primary font-semibold hover:bg-md-primary/10">Back to sign in</button>
                </form>
              )}

              {/* FORGOT PASSWORD — question + new password */}
              {mode === 'forgot-complete' && (
                <form className="space-y-4" onSubmit={handleForgotComplete}>
                  <div className="rounded-[20px] bg-md-secondary-container text-md-on-secondary-container p-4">
                    <p className="text-xs font-semibold opacity-80 mb-1">Your security question</p>
                    <p className="font-medium">{resetQuestion}</p>
                  </div>
                  <div><label className={label} htmlFor="f-ans">Answer</label><input id="f-ans" type="text" value={resetAnswer} onChange={e => setResetAnswer(e.target.value)} className={field} required /></div>
                  <div><label className={label} htmlFor="f-new">New password</label><input id="f-new" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={field} required /></div>
                  <button disabled={isLoading} className={primaryBtn}>{isLoading ? <Loader2 className="animate-spin" /> : 'Save new password'}</button>
                </form>
              )}
            </div>
            <p className="text-center text-xs text-md-on-surface-variant mt-5 px-6">Aastha is an AI companion, not a therapist. In crisis, call Tele-MANAS <a className="underline" href="tel:14416">14416</a>.</p>
            <p className="text-center text-xs text-md-on-surface-variant mt-2"><Link to="/privacy" className="underline-offset-2 hover:underline">Privacy Policy</Link> · <Link to="/terms" className="underline-offset-2 hover:underline">Terms</Link></p>
          </FadeIn>
        </div>
      </div>
    </div>
  );
};
