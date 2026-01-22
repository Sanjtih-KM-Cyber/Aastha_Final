import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Mail, Lock, User, ArrowRight, Shield,
  Sparkles, Eye, EyeOff, AlertCircle, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { FadeIn } from '../landing/FadeIn';

type LoginMode = 'login' | 'register' | 'verify-otp' | 'forgot-init' | 'forgot-otp' | 'forgot-complete';

interface LoginProps {
  initialMode?: 'login' | 'register';
  onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ initialMode = 'login', onBack }) => {
  const navigate = useNavigate();
  const { login } = useAuth();

  // State
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password State
  const [resetEmail, setResetEmail] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');

  // Quotes
  const [quote, setQuote] = useState('');
  const quotes = [
    "Peace comes from within. Do not seek it without.",
    "The quieter you become, the more you can hear.",
    "To understand everything is to forgive everything.",
    "The soul always knows what to do to heal itself.",
    "Breathe. Let go. And remind yourself that this very moment is the only one you know you have for sure.",
    "Quiet the mind, and the soul will speak.",
    "In the midst of movement and chaos, keep stillness inside of you.",
    "Within you, there is a stillness and a sanctuary to which you can retreat at any time.",
    "Happiness is not something ready made. It comes from your own actions.",
    "The best way out is always through.",
    "What you seek is seeking you.",
    "Everything you can imagine is real.",
    "Do not let the behavior of others destroy your inner peace.",
    "It is not the mountain we conquer, but ourselves.",
    "Life is a balance of holding on and letting go.",
    "Silence is not the absence of something but the presence of everything.",
    "Your calm mind is the ultimate weapon against your challenges.",
    "He who has a why to live can bear almost any how.",
    "Out of difficulties grow miracles.",
    "The only journey is the one within.",
    "Trust the wait. Embrace the uncertainty. Enjoy the beauty of becoming.",
    "You are the sky. Everything else – it’s just the weather.",
    "Be happy for this moment. This moment is your life.",
    "Simplicity is the ultimate sophistication.",
    "Nature does not hurry, yet everything is accomplished.",
    "Wherever you go, go with all your heart.",
    "Tension is who you think you should be. Relaxation is who you are."
  ];

  useEffect(() => {
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      navigate('/chat');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await api.post('/auth/register', {
        username: name,
        email: regEmail,
        password: regPassword
      });
      setMode('verify-otp');
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const otpString = otp.join('');
      const response = await api.post('/auth/verify-otp', {
        email: regEmail,
        otp: otpString
      });

      // Auto login after verification
      localStorage.setItem('token', response.data.token);
      window.location.href = '/chat';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // NOTE: Backend always returns 200 OK for security (user enumeration protection)
      await api.post('/users/reset-init', { email: resetEmail });

      // Move to OTP step regardless
      setOtp(['', '', '', '', '', '']);
      setMode('forgot-otp');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const otpString = otp.join('');
      // This endpoint now returns { resetToken, securityQuestion }
      const res = await api.post('/users/reset-verify-otp', {
        email: resetEmail,
        otp: otpString
      });

      setResetToken(res.data.resetToken);
      setSecurityQuestion(res.data.securityQuestion);
      setMode('forgot-complete');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.post('/users/reset-complete', {
        resetToken,
        answer: securityAnswer,
        newPassword
      });

      // Auto-login with the returned token
      if (res.data.token) {
        localStorage.setItem('token', res.data.token);
        window.location.href = '/chat';
      } else {
        // Fallback to login screen
        setMode('login');
        setEmail(resetEmail);
        setPassword('');
        setError(null);
        // Show success message briefly?
        alert("Password reset successfully. Please login.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6).split('');
    if (pastedData.length === 0) return;

    const newOtp = [...otp];
    pastedData.forEach((char, index) => {
      if (index < 6) newOtp[index] = char;
    });
    setOtp(newOtp);

    // Focus last filled input
    const lastIndex = Math.min(pastedData.length, 5);
    document.getElementById(`otp-${lastIndex}`)?.focus();
  };

  const handleBack = () => {
    if (mode === 'register' || mode === 'forgot-init') setMode('login');
    else if (mode === 'forgot-otp') setMode('forgot-init'); // Go back to email
    else if (mode === 'forgot-complete') setMode('forgot-init'); // Restart flow
    else if (mode === 'verify-otp') setMode('login'); // Cancel registration
    else if (onBack) onBack();
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-black flex text-white font-sans overflow-hidden">
      {/* Left Panel - Art/Sanctuary (Desktop Only) */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#1a1a2e] to-black opacity-80" />
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 10, repeat: Infinity }}
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-900/20 rounded-full blur-[100px]"
          />
          <motion.div
             animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ duration: 15, repeat: Infinity }}
            className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[120px]"
          />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-8">
            <Sparkles size={24} className="text-white" />
          </div>
          <h1 className="text-4xl font-light tracking-wide mb-2">Aastha</h1>
          <p className="text-white/50 text-sm tracking-widest uppercase">AI Companion</p>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 backdrop-blur-md border border-white/10 flex items-center justify-center mb-8">
            {(mode === 'verify-otp' || mode === 'forgot-otp') ? <Shield size={32} className="text-white"/> : <Sparkles size={32} className="text-white" />}
          </div>
          <h2 className="text-5xl font-bold mb-6 leading-tight font-serif">
            {mode === 'login' && "Return to\nSanctuary."}
            {mode === 'register' && "Begin Your\nJourney."}
            {mode === 'verify-otp' && "Secure\nVerification."}
            {mode === 'forgot-init' && "Recover Your\nPeace."}
            {mode === 'forgot-otp' && "Verify\nIdentity."}
            {mode === 'forgot-complete' && "Secure\nReset."}
          </h2>
          <p className="text-slate-300 text-lg leading-relaxed italic">
            "{quote}"
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-xs text-white/30 uppercase tracking-widest">
          <div className="h-px w-8 bg-white/30" />
          <span>Secure Environment</span>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-[#0B0F17] relative">
        <button
          onClick={handleBack}
          className="absolute top-8 left-8 p-2 rounded-full hover:bg-white/5 text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft size={24} />
        </button>

        <div className="w-full max-w-md">
          <FadeIn direction="up">
            <div className="mb-8 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-white mb-2">
                {mode === 'login' && 'Welcome Back'}
                {mode === 'register' && 'Create Account'}
                {mode === 'verify-otp' && 'Check your Email'}
                {mode === 'forgot-init' && 'Find Account'}
                {mode === 'forgot-otp' && 'Verify Identity'}
                {mode === 'forgot-complete' && 'Reset Password'}
              </h2>
              <p className="text-slate-400">
                {mode === 'login' && 'Please enter your details to sign in.'}
                {mode === 'register' && 'Join thousands finding peace today.'}
                {mode === 'verify-otp' && `We sent a code to ${regEmail || 'your email'}.`}
                {mode === 'forgot-init' && 'Enter email to recover password.'}
                {mode === 'forgot-otp' && `We sent a code to ${resetEmail || 'your email'}.`}
                {mode === 'forgot-complete' && 'Answer your security question.'}
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3"
              >
                <AlertCircle size={20} />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <label className="text-sm font-medium text-slate-300">Password</label>
                    <button
                      type="button"
                      onClick={() => setMode('forgot-init')}
                      className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-white text-black font-bold rounded-xl py-4 hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
                <p className="text-center text-slate-400 text-sm mt-6">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className="text-white font-medium hover:underline"
                  >
                    Create one
                  </button>
                </p>
              </form>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                      placeholder="How should we call you?"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-white text-black font-bold rounded-xl py-4 hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
                <p className="text-center text-slate-400 text-sm mt-6">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-white font-medium hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}

            {/* VERIFY OTP FORM */}
            {mode === 'verify-otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-8">
                 <div className="flex justify-between gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-2xl font-bold text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-white text-black font-bold rounded-xl py-4 hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify Email</span>
                      <CheckCircle2 size={20} />
                    </>
                  )}
                </button>
                <p className="text-center text-slate-400 text-sm">
                  Didn't receive code?{' '}
                  <button
                    type="button"
                    onClick={handleRegister} // Resend logic could be added here
                    className="text-white font-medium hover:underline"
                  >
                    Resend
                  </button>
                </p>
              </form>
            )}

            {/* FORGOT PASSWORD INIT */}
            {mode === 'forgot-init' && (
              <form onSubmit={handleForgotInit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-white text-black font-bold rounded-xl py-4 hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Send Recovery Code</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* FORGOT PASSWORD OTP - THIS WAS MISSING */}
            {mode === 'forgot-otp' && (
              <form onSubmit={handleForgotVerifyOtp} className="space-y-8">
                <div className="flex justify-between gap-2">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      className="w-12 h-14 bg-white/5 border border-white/10 rounded-xl text-center text-2xl font-bold text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-white text-black font-bold rounded-xl py-4 hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Verify Identity</span>
                      <CheckCircle2 size={20} />
                    </>
                  )}
                </button>
                <p className="text-center text-slate-400 text-sm">
                  Didn't receive code?{' '}
                  <button
                    type="button"
                    onClick={handleForgotInit} // Retry sending email
                    className="text-white font-medium hover:underline"
                  >
                    Resend
                  </button>
                </p>
              </form>
            )}

            {/* FORGOT PASSWORD COMPLETE */}
            {mode === 'forgot-complete' && (
              <form onSubmit={handleForgotComplete} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Security Question</label>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-white/80">
                    {securityQuestion || "What is your favorite color?"}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Answer</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type="text"
                      required
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                      placeholder="Your answer"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/20 transition-all"
                      placeholder="New strong password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-white text-black font-bold rounded-xl py-4 hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Reset & Login</span>
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </form>
            )}

          </FadeIn>
        </div>
      </div>
    </div>
  );
};
