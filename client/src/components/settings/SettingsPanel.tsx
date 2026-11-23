import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Trash2, Shield, User, Palette, Check,
  ToggleLeft, ToggleRight, AlertTriangle, Mic, Edit2,
  Save, Camera, CreditCard, Sparkles, Zap, Image as ImageIcon,
  Headphones, ChevronLeft, ChevronRight, Clock, UserPlus, LogOut, Database, Minus
} from 'lucide-react';
import { FingerprintPattern, ScanFace, Lock, EyeOff } from 'lucide-react';
import { loadLockSettings, saveLockSettings, LockSettings, LOCK_AFTER_OPTIONS, LOCK_NOW_EVENT, describeLockAfter } from '../../security/appLock';
import { Card, SectionTitle, Switch, Button, IconButton, ListItem, ListGroup, GlassBar, fieldClass } from '../../design/ui';
import { useWindowControls, saveWindowControls, WindowControls } from '../../hooks/useWindowControls';
import { useAppFontChoice, saveAppFonts } from '../../hooks/useAppFonts';
import { TEXT_FONTS, HEADING_FONTS, loadAllFonts, textFont } from '../../design/fonts';
import { ColorWheel } from '../../design/ColorWheel';
import { Icons } from '../../design/icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
// import { useLowPowerMode } from '../../hooks/useLowPowerMode'; // REMOVED
import { useBiometrics } from '../../hooks/useBiometrics';
import { notificationService } from '../../services/notificationService';
import { exactAlarmsAllowed, openExactAlarmSettings } from '../../services/notifications';
import { webPush } from '../../services/webPush';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { CloneSettings } from './CloneSettings';
import { DiaryPasswordReset } from '../wellness/DiaryPasswordReset';
import { RelationshipSettings } from './RelationshipSettings';
import { PrivacyCenter } from './PrivacyCenter';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = [
  { id: 'appearance', label: 'Appearance', icon: Icons.appearance, desc: 'Theme colour, wallpaper, lite mode' },
  { id: 'voice', label: 'Voice & Sound', icon: Icons.voice, desc: 'Companion and read-aloud' },
  { id: 'persona', label: 'Connection', icon: Icons.connection, desc: 'Closeness, language, check-ins, Clone Mode' },
  { id: 'account', label: 'Account', icon: Icons.me, desc: 'Name, username, photo' },
  { id: 'security', label: 'Security', icon: Icons.security, desc: 'App lock, reminders, diary password' },
  { id: 'subscription', label: 'Plan', icon: Icons.plan, desc: 'Free, Pro and Voice Pass' },
  { id: 'data', label: 'Data & Privacy', icon: Icons.data, desc: 'What we store, export, delete' },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('appearance');
  const [isMobileDetail, setIsMobileDetail] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // UPDATED: Consume isLowPowerMode from global ThemeContext
  const { currentTheme, setTheme, setWallpaper, wallpaper, isLowPowerMode, setLowPowerMode } = useTheme();

  const { user, logout, updateUser } = useAuth();
  // const { isLowPower, setLowPowerMode } = useLowPowerMode(); // REMOVED

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fix: Default to FALSE for TTS if not set
  const [ttsEnabled, setTtsEnabled] = useState(() => {
      try { return localStorage.getItem('user_tts_enabled_v2') === 'true'; } catch { return false; } // off unless turned on here
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(localStorage.getItem('user_voice_uri'));

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Data Donation
  const [isDataDonationOn, setIsDataDonationOn] = useState(() => user?.isDataDonationOn || false);

  // Profile Edit
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [newAvatar, setNewAvatar] = useState<string | null>(null);

  // Security (Diary Reset)
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newDiaryPassword, setNewDiaryPassword] = useState('');
  const [oldDiaryPassword, setOldDiaryPassword] = useState('');
  const [resetStep, setResetStep] = useState(0); // 0: Init, 0.5: OTP, 1: Question, 2: Reset
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Auto Lock State
  // App lock (components/auth/BiometricGuard.tsx + security/appLock.ts)
  const [lock, setLock] = useState<LockSettings>(() => loadLockSettings());
  const updateLock = (next: LockSettings) => { setLock(next); saveLockSettings(next); };

  const { isAvailable: isBiometricAvailable, toggleBiometrics, promptBiometrics, kind: biometricKind } = useBiometrics();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // Subscription
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (user) {
        setEditName(user.name);
        setEditUsername(user.username || '');
    }
  }, [user]);

  useEffect(() => {
    const loadVoices = () => {
        if ('speechSynthesis' in window) {
            setAvailableVoices(window.speechSynthesis.getVoices());
        }
    };
    loadVoices();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Load Razorpay SDK
  useEffect(() => {
    if (isOpen) {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
        return () => { 
            if (document.body.contains(script)) {
                document.body.removeChild(script); 
            }
        };
    }
  }, [isOpen]);

  const toggleTTS = () => {
      const newState = !ttsEnabled;
      setTtsEnabled(newState);
      try { localStorage.setItem('user_tts_enabled_v2', String(newState)); localStorage.removeItem('user_tts_enabled'); } catch { /* ignore */ }
      window.dispatchEvent(new Event('aastha:tts-changed')); // chat screen picks it up immediately
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const uri = e.target.value;
      setSelectedVoiceURI(uri);
      localStorage.setItem('user_voice_uri', uri);
  };



  // Load the real notification state (the toggle used to always start "off")
  useEffect(() => {
      (async () => {
          try {
              if (Capacitor.isNativePlatform()) {
                  const { value } = await Preferences.get({ key: 'notifications_enabled' });
                  setNotificationsEnabled(value === 'true');
              } else {
                  setNotificationsEnabled(await webPush.isSubscribed());
              }
          } catch { /* ignore */ }
      })();
  }, []);

  const toggleNotifications = async () => {
      // --- Native app: local notifications (+ ask for on-time "Alarms & reminders" on Android 12+) ---
      if (Capacitor.isNativePlatform()) {
          if (!notificationsEnabled) {
              const granted = await notificationService.requestPermission();
              if (!granted) { alert("Notifications are blocked. Please allow them for Aastha in your phone's settings."); return; }
              setNotificationsEnabled(true);
              if (!(await exactAlarmsAllowed())) {
                  const ok = confirm("To get reminders on time (not hours late), allow \"Alarms & reminders\" for Aastha on the next screen.");
                  if (ok) await openExactAlarmSettings();
              }
          } else {
              await notificationService.disable();
              setNotificationsEnabled(false);
          }
          return;
      }

      // --- Website / installed web app: Web Push (no Firebase needed) ---
      if (notificationsEnabled) {
          await webPush.unsubscribe();
          setNotificationsEnabled(false);
          return;
      }
      if (!webPush.isSupported()) {
          alert("This browser doesn't support notifications. Try Chrome, Edge or Firefox.");
          return;
      }
      if (webPush.needsHomeScreenInstall()) {
          alert("On iPhone, first add Aastha to your Home Screen (Share → Add to Home Screen), open it from there, then turn notifications on.");
          return;
      }
      const result = await webPush.subscribe();
      if (result === 'subscribed') {
          setNotificationsEnabled(true);
          toast.success("Notifications are on 🌸");
          webPush.sendTest().catch(() => {});
      } else if (result === 'denied') {
          alert("Notifications are blocked for this site. Allow them in your browser's site settings and try again.");
      } else if (result === 'not-configured') {
          alert("Notifications aren't available yet, please try again later.");
      } else {
          alert("Couldn't turn on notifications. Please try again.");
      }
  };

  // Turning the lock on: on a phone with a sensor, prove it works first (so nobody locks themselves out)
  const toggleAppLock = async () => {
      if (lock.enabled) {
          updateLock({ ...lock, enabled: false });
          if (isBiometricAvailable) toggleBiometrics(false);
          return;
      }
      if (isBiometricAvailable) {
          const ok = await promptBiometrics();
          if (!ok) { toast.error('Couldn’t verify, the lock is still off'); return; }
          await toggleBiometrics(true);
      }
      updateLock({ ...lock, enabled: true });
      toast.success(isBiometricAvailable ? 'Aastha is locked with your ' + (biometricKind === 'face' ? 'face' : 'fingerprint') : 'App lock is on');
  };


  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = (ev) => {
              const img = new Image();
              img.src = ev.target?.result as string;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const size = 200; 
                  canvas.width = size; canvas.height = size;
                  const ctx = canvas.getContext('2d');
                  const minDim = Math.min(img.width, img.height);
                  ctx?.drawImage(img, (img.width-minDim)/2, (img.height-minDim)/2, minDim, minDim, 0, 0, size, size);
                  setNewAvatar(canvas.toDataURL('image/jpeg', 0.8));
                  setIsEditingProfile(true); 
              };
          };
          reader.readAsDataURL(e.target.files[0]);
      }
  };

  const saveProfile = async () => {
      try {
          const res = await api.put('/users/profile', { name: editName, username: editUsername, avatar: newAvatar });
          if (res.data) {
              updateUser(res.data);
          }
          setIsEditingProfile(false);
      } catch (e) { 
          console.error(e);
          alert("Failed to update profile."); 
      }
  };

  // OTP Handling (Shared with Login)
  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasteData = e.clipboardData.getData('text').trim();
      if (!/^\d+$/.test(pasteData)) return; // Only numbers

      const digits = pasteData.split('').slice(0, 6);
      const newOtp = [...otp];
      digits.forEach((d, i) => { newOtp[i] = d; });
      setOtp(newOtp);

      // Focus the next empty box or the last box
      const nextFocus = Math.min(digits.length, 5);
      otpRefs.current[nextFocus]?.focus();
  };

  const handleChangeDiaryPassword = async () => {
      try {
          await api.post('/users/change-diary-password', { oldPassword: oldDiaryPassword, newPassword: newDiaryPassword });
          alert("Diary password updated successfully.");
          setOldDiaryPassword('');
          setNewDiaryPassword('');
      } catch (e) {
          alert("Failed to update password. Check your old password.");
      }
  };

  const handleRemoveWallpaper = () => {
      setWallpaper(null);
  };

  const savePersona = async (persona: 'aastha' | 'aarav') => {
      try {
          const res = await api.put('/users/profile', { persona });
          if (res.data) updateUser(res.data);
      } catch (e) {
          console.error(e);
          alert("Failed to update persona.");
      }
  };

  const handleSoftDelete = async () => {
      if (!deleteReason) return;
      setIsDeleting(true);
      try {
          await api.post('/users/delete-account', { reason: deleteReason });
          // Force logout and redirect to login page
          await logout();
          window.location.href = '/login';
      } catch (e) { setIsDeleting(false); }
  };

  const toggleDataDonation = async () => {
      const newValue = !isDataDonationOn;
      setIsDataDonationOn(newValue);
      try {
          await api.post('/users/toggle-data-donation', { isDataDonationOn: newValue });
          // Optimistic update of local user object if needed, though state is local here
          if (user) {
             // Shallow update user context if method available, or just rely on next fetch
             // For now, local state is sufficient for UI feedback
          }
      } catch (e) {
          setIsDataDonationOn(!newValue); // Revert on failure
          alert("Failed to update preference.");
      }
  };

  // Generic Subscribe Function
  const handleSubscribe = async (planType: 'pro' | 'voice' = 'pro') => {
      setIsProcessing(true);
      try {
          const endpoint = planType === 'voice' ? '/users/create-voice-order' : '/users/create-order';
          const orderRes = await api.post(endpoint);
          const { orderId, keyId, amount } = orderRes.data;

          const options = {
              key: keyId,
              amount: amount,
              currency: "INR",
              name: "Aastha Wellness",
              description: planType === 'voice' ? "1-Day Voice Pass" : "Pro Access (1 month)",
              image: "https://placehold.co/256?text=Aastha",
              order_id: orderId,
              handler: async (response: any) => {
                  try {
                      const verifyRes = await api.post('/users/verify-payment', {
                          razorpay_order_id: response.razorpay_order_id,
                          razorpay_payment_id: response.razorpay_payment_id,
                          razorpay_signature: response.razorpay_signature
                          // Plan is determined server-side from the Razorpay order, never sent by the client.
                      });

                      if (verifyRes.data.success) {
                          alert(verifyRes.data.message || "Access Unlocked.");
                          window.location.reload();
                      } else {
                          alert("Payment verification failed.");
                      }
                  } catch (err) {
                      console.error(err);
                      alert("Error verifying payment.");
                  }
              },
              prefill: {
                  name: user?.name,
                  email: user?.email,
              },
              theme: {
                  color: currentTheme.primaryColor
              }
          };

          const rzp = new window.Razorpay(options);
          rzp.open();
          rzp.on('payment.failed', function (response: any){
              alert("Payment Failed: " + response.error.description);
          });

      } catch (error) {
          console.error("Subscription Error:", error);
          alert("Could not initiate payment. Please try again.");
      } finally {
          setIsProcessing(false);
      }
  };

  const handleTabClick = (tabId: string) => {
      setActiveTab(tabId);
      if (isMobile) setIsMobileDetail(true);
  };

  const handleBack = () => {
      setIsMobileDetail(false);
  };

  // --- CONTENT RENDERER (Shared) --- Material You content on tonal cards (design/ui.tsx)
  const activeMeta = tabs.find(t => t.id === activeTab);
  const windowControls = useWindowControls();
  const chooseWindowControls = (v: WindowControls) => {
    saveWindowControls(v, updateUser).catch(() => toast.error('Saved on this device, will sync when you are back online'));
  };
  const fonts = useAppFontChoice();
  // Colour wheel: live preview while dragging (one theme update per frame), saved on release
  const isCustomColour = currentTheme.id === 'custom';
  const [wheelOpen, setWheelOpen] = useState(isCustomColour);
  const [hexDraft, setHexDraft] = useState(isCustomColour ? currentTheme.primaryColor : '');
  const wheelFrame = useRef<number | null>(null);
  const previewColour = (hex: string) => {
    setHexDraft(hex);
    if (wheelFrame.current) cancelAnimationFrame(wheelFrame.current);
    wheelFrame.current = requestAnimationFrame(() => setTheme(hex));
  };
  useEffect(() => { if (activeTab === 'appearance') loadAllFonts(); }, [activeTab]); // each name previews in its own face
  const chooseFont = (change: { appFont?: string; headingFont?: string }) => {
    saveAppFonts(change, updateUser).catch(() => toast.error('Saved on this device, will sync when you are back online'));
  };
  const voicePassActive = !!(user?.voicePassExpiresAt && new Date(user.voicePassExpiresAt) > new Date());
  const renderContent = () => (
      <div className={`space-y-7 animate-fade-in ${isMobile ? 'pb-24' : 'pb-6'}`}>

          {activeTab === 'appearance' && (
              <>
                <section>
                  <SectionTitle>Theme colour</SectionTitle>
                  <Card>
                    <p className="text-xs text-md-on-surface-variant mb-4">The whole app re-colours from one seed, Material You.</p>
                    <div className="flex flex-wrap gap-3">
                      {(['lotus', 'aurora', 'sunset', 'ocean', 'midnight'] as const).map((themeId) => {
                        const swatch: Record<string, string> = { lotus: '#8B7CF6', aurora: '#2dd4bf', sunset: '#fb7185', ocean: '#38bdf8', midnight: '#a78bfa' };
                        const on = currentTheme.id === themeId;
                        return (
                          <button key={themeId} onClick={() => setTheme(themeId)} aria-pressed={on} aria-label={`${themeId} theme`}
                            className={`flex flex-col items-center gap-1.5 group`}>
                            <span className={`w-14 h-14 rounded-[18px] flex items-center justify-center transition-all duration-200 ease-md-emphasized ${on ? 'ring-2 ring-md-primary ring-offset-2 ring-offset-md-surface-container rounded-[22px]' : 'group-hover:scale-105'}`}
                              style={{ background: `linear-gradient(135deg, ${swatch[themeId]}, ${swatch[themeId]}99)` }}>
                              {on && <Check size={22} className="text-black/70" />}
                            </span>
                            <span className={`text-[11px] capitalize ${on ? 'text-md-on-surface font-medium' : 'text-md-on-surface-variant'}`}>{themeId}</span>
                          </button>
                        );
                      })}
                      <button onClick={() => setWheelOpen((v) => !v)} aria-pressed={isCustomColour} aria-expanded={wheelOpen} aria-label="Pick any colour"
                        className="flex flex-col items-center gap-1.5 group">
                        <span className={`w-14 h-14 rounded-[18px] flex items-center justify-center transition-all duration-200 ease-md-emphasized ${isCustomColour ? 'ring-2 ring-md-primary ring-offset-2 ring-offset-md-surface-container rounded-[22px]' : 'group-hover:scale-105'}`}
                          style={{ background: isCustomColour ? currentTheme.primaryColor : 'conic-gradient(from 0deg, #ff5f6d, #ffc371, #a8ff78, #43e8d8, #6a8bff, #c56cf0, #ff5f6d)' }}>
                          {isCustomColour ? <Check size={22} className="text-black/70" /> : <span className="w-6 h-6 rounded-full bg-md-surface-container/80 flex items-center justify-center text-md-on-surface text-base leading-none">+</span>}
                        </span>
                        <span className={`text-[11px] ${isCustomColour ? 'text-md-on-surface font-medium' : 'text-md-on-surface-variant'}`}>Any colour</span>
                      </button>
                    </div>
                    {wheelOpen && (
                      <div className="mt-5 pt-5 border-t border-md-outline-variant/30 flex flex-col sm:flex-row items-center gap-5">
                        <ColorWheel value={isCustomColour ? currentTheme.primaryColor : (hexDraft || '#8b7cf6')} onChange={previewColour} size={isMobile ? 210 : 190} />
                        <div className="flex-1 w-full space-y-3">
                          <p className="text-sm text-md-on-surface">Drag around the wheel</p>
                          <p className="text-xs text-md-on-surface-variant leading-relaxed">Around = colour, towards the middle = softer. The whole Sanctuary re-colours as you go, your home and sign-in pages stay the same.</p>
                          <label className="flex items-center gap-2">
                            <span className="text-xs text-md-on-surface-variant w-8">Hex</span>
                            <input value={hexDraft} onChange={(e) => { const v = e.target.value.trim(); setHexDraft(v); if (/^#[0-9a-f]{6}$/i.test(v)) setTheme(v.toLowerCase()); }}
                              placeholder="#8b7cf6" maxLength={7} spellCheck={false} aria-label="Hex colour"
                              className={`${fieldClass} !h-10 font-mono text-sm !w-32`} />
                          </label>
                        </div>
                      </div>
                    )}
                  </Card>
                </section>
                <section>
                  <SectionTitle>Wallpaper</SectionTitle>
                  <Card padded={false} className="overflow-hidden">
                    <button onClick={() => fileInputRef.current?.click()} className="relative w-full h-40 flex items-center justify-center group">
                      {wallpaper ? (
                        <>
                          <img src={wallpaper} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity" />
                          <span className="relative glass glass-pill px-4 h-10 inline-flex items-center gap-2 text-sm text-md-on-surface"><Check size={16} /> Wallpaper on · Change</span>
                        </>
                      ) : (
                        <span className="flex flex-col items-center gap-2 text-md-on-surface-variant">
                          <span className="w-12 h-12 rounded-full bg-md-secondary-container text-md-on-secondary-container flex items-center justify-center"><Upload size={20} /></span>
                          <span className="text-sm">Upload a background</span>
                          <span className="text-[11px] opacity-70">The theme colour is taken from it</span>
                        </span>
                      )}
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setWallpaper(e.target.files[0])} />
                  </Card>
                  {wallpaper && <Button variant="text" className="mt-2" icon={<Trash2 size={14} />} onClick={handleRemoveWallpaper}>Remove wallpaper</Button>}
                </section>
                <section>
                  <SectionTitle>Text font</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Text font">
                    {TEXT_FONTS.map((f) => {
                      const on = fonts.text === f.id;
                      return (
                        <button key={f.id} role="radio" aria-checked={on} onClick={() => chooseFont({ appFont: f.id })}
                          className={`rounded-[20px] px-3.5 py-3 text-left border transition-colors ${on ? 'bg-md-secondary-container border-transparent' : 'bg-md-surface-container border-md-outline-variant/30 hover:bg-md-surface-container-high'}`}>
                          <span className={`flex items-center gap-1.5 text-[17px] leading-tight ${on ? 'text-md-on-secondary-container' : 'text-md-on-surface'}`} style={{ fontFamily: f.family }}>
                            {on && <Check size={14} className="shrink-0" />}{f.label}
                          </span>
                          <span className="block text-[11px] text-md-on-surface-variant mt-1" style={{ fontFamily: f.family }}>{f.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section>
                  <SectionTitle>Heading font</SectionTitle>
                  <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Heading font">
                    {HEADING_FONTS.map((f) => {
                      const on = fonts.heading === f.id;
                      const family = f.id === 'same' ? textFont(fonts.text).family : f.family;
                      return (
                        <button key={f.id} role="radio" aria-checked={on} onClick={() => chooseFont({ headingFont: f.id })}
                          className={`rounded-[20px] px-3.5 py-3 text-left border transition-colors ${on ? 'bg-md-secondary-container border-transparent' : 'bg-md-surface-container border-md-outline-variant/30 hover:bg-md-surface-container-high'}`}>
                          <span className={`flex items-center gap-1.5 text-xl leading-tight ${on ? 'text-md-on-secondary-container' : 'text-md-on-surface'}`} style={{ fontFamily: family }}>
                            {on && <Check size={14} className="shrink-0" />}{f.id === 'same' ? 'Aa' : 'Good evening'}
                          </span>
                          <span className="block text-[11px] text-md-on-surface-variant mt-1">{f.label} · {f.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-md-on-surface-variant mt-2 px-1">Only inside your Sanctuary, the home and sign-in pages keep Aastha's look. Synced to your phone and the web.</p>
                </section>
                <section>
                  <SectionTitle>Window buttons</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { v: 'mac' as const, name: 'Mac', hint: 'Coloured dots on the left' },
                      { v: 'windows' as const, name: 'Windows', hint: 'Minimise and close on the right' },
                    ]).map((o) => {
                      const on = windowControls === o.v;
                      return (
                        <button key={o.v} onClick={() => chooseWindowControls(o.v)} aria-pressed={on}
                          className={`rounded-[24px] p-3 text-left border transition-colors ${on ? 'bg-md-secondary-container border-transparent' : 'bg-md-surface-container border-md-outline-variant/30 hover:bg-md-surface-container-high'}`}>
                          {/* mini preview of a widget title bar */}
                          <div className="glass rounded-[12px] h-8 flex items-center gap-1.5 px-2 mb-3">
                            {o.v === 'mac' ? (
                              <>
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                                <span className="flex-1 text-center text-[10px] text-md-on-surface-variant pr-6">Mood</span>
                              </>
                            ) : (
                              <>
                                <span className="w-4 h-4 rounded-[5px] bg-md-primary-container" />
                                <span className="flex-1 text-[10px] text-md-on-surface-variant">Mood</span>
                                <Minus size={10} className="text-md-on-surface-variant" /><X size={10} className="text-md-on-surface-variant ml-1" />
                              </>
                            )}
                          </div>
                          <span className={`flex items-center gap-1.5 text-sm font-medium ${on ? 'text-md-on-secondary-container' : 'text-md-on-surface'}`}>{on && <Check size={14} />}{o.name}</span>
                          <span className="block text-[11px] text-md-on-surface-variant mt-0.5">{o.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-md-on-surface-variant mt-2 px-1">Saved to your account, your phone and the web stay the same.</p>
                </section>
                <section>
                  <SectionTitle>Performance</SectionTitle>
                  <ListGroup>
                    <ListItem icon={<Zap size={18} />} title="Lite mode"
                      subtitle={isLowPowerMode ? 'On, blur and animations off for speed and battery.' : 'Off, full glass effects. Turns on by itself on slower phones.'}
                      trailing={<Switch checked={isLowPowerMode} onChange={(v) => setLowPowerMode(v)} label="Lite mode" />} />
                  </ListGroup>
                </section>
              </>
          )}

          {activeTab === 'voice' && (
              <>
                   <section>
                       <SectionTitle>Companion</SectionTitle>
                       <div className="grid grid-cols-2 gap-3">
                           {([
                             { id: 'aastha' as const, name: 'Aastha', blurb: 'Calm, warm, sisterly', emoji: '🌸' },
                             { id: 'aarav' as const, name: 'Aastik', blurb: 'Grounded, steady, brotherly', emoji: '🧘‍♂️' },
                           ]).map((p) => {
                             const on = p.id === 'aarav' ? user?.persona === 'aarav' : user?.persona !== 'aarav';
                             return (
                               <button key={p.id} onClick={() => savePersona(p.id)} aria-pressed={on}
                                 className={`p-4 rounded-[24px] flex flex-col items-center gap-3 border transition-all duration-200 ease-md-emphasized ${on ? 'bg-md-primary-container text-md-on-primary-container border-transparent' : 'bg-md-surface-container border-md-outline-variant/30 text-md-on-surface hover:bg-md-surface-container-high'}`}>
                                 <span className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl ${on ? 'bg-md-primary/25' : 'bg-md-surface-container-highest'}`}>{p.emoji}</span>
                                 <span className="text-center">
                                   <span className="block font-semibold text-sm">{p.name}</span>
                                   <span className="block text-[11px] opacity-75 mt-0.5">{p.blurb}</span>
                                 </span>
                                 {on && <span className="text-[11px] font-medium inline-flex items-center gap-1"><Check size={12} /> Selected</span>}
                               </button>
                             );
                           })}
                       </div>
                   </section>

                   <section>
                       <SectionTitle>Voice</SectionTitle>
                       <ListGroup>
                         <ListItem icon={<Headphones size={18} />} title="Read replies aloud" subtitle="Off by default. Voice calls always speak."
                           trailing={<Switch checked={ttsEnabled} onChange={() => toggleTTS()} label="Read replies aloud" />} />
                         <div className="px-4 py-3">
                           <label className="block text-xs text-md-on-surface-variant mb-2" htmlFor="voice-select">Device voice (used when the voice server is busy)</label>
                           <select id="voice-select" className={fieldClass} value={selectedVoiceURI || ''} onChange={handleVoiceChange}>
                             <option value="" disabled>Select a voice…</option>
                             {availableVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                           </select>
                         </div>
                       </ListGroup>
                   </section>
              </>
          )}

          {activeTab === 'persona' && (
              <div className="space-y-8">
                  <RelationshipSettings />
                  <CloneSettings />
              </div>
          )}

          {activeTab === 'account' && (
            <>
               <Card className="flex items-center gap-4">
                    <button className="relative group shrink-0" onClick={() => avatarInputRef.current?.click()} aria-label="Change photo">
                        {newAvatar || user?.avatar ? (
                            <img src={newAvatar || user?.avatar} className="w-16 h-16 rounded-full object-cover" alt="" />
                        ) : (
                            <span className="w-16 h-16 rounded-full bg-md-primary-container text-md-on-primary-container flex items-center justify-center text-2xl font-semibold">{user?.name?.charAt(0) || 'U'}</span>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center shadow"><Camera size={14} /></span>
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarSelect} />
                    </button>
                    <div className="flex-1 min-w-0">
                         {isEditingProfile ? (
                             <div className="space-y-2">
                                 <input value={editName} onChange={e => setEditName(e.target.value)} className={fieldClass + ' h-10'} placeholder="Name" />
                                 <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className={fieldClass + ' h-10'} placeholder="Username" />
                             </div>
                         ) : (
                             <><h4 className="text-lg font-medium text-md-on-surface truncate">{user?.name}</h4><p className="text-sm text-md-on-surface-variant truncate">@{user?.username}</p></>
                         )}
                    </div>
                    <IconButton variant={isEditingProfile ? 'filled' : 'tonal'} label={isEditingProfile ? 'Save profile' : 'Edit profile'} onClick={() => isEditingProfile ? saveProfile() : setIsEditingProfile(true)}>
                      {isEditingProfile ? <Save size={18} /> : <Edit2 size={16} />}
                    </IconButton>
               </Card>
               <ListGroup>
                 <ListItem icon={<Clock size={18} />} title="Member since" trailing={<span className="text-sm text-md-on-surface-variant">{(user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'}) : 'Recently'}</span>} />
               </ListGroup>
            </>
          )}

          {activeTab === 'security' && (
              <>
                  <section>
                      <SectionTitle>Reminders</SectionTitle>
                      <ListGroup>
                        <ListItem icon={<Sparkles size={18} />} title="Mindful check-ins" subtitle="Morning and night nudges"
                          trailing={<Switch checked={notificationsEnabled} onChange={() => toggleNotifications()} label="Mindful check-ins" />} />
                      </ListGroup>
                  </section>

                  <section>
                      <SectionTitle>App lock</SectionTitle>
                      <Card padded={false} className="overflow-hidden">
                        <div className="p-4 flex items-center gap-4">
                          <span className="w-12 h-12 shrink-0 rounded-[16px] bg-md-primary-container text-md-on-primary-container flex items-center justify-center">
                            {isBiometricAvailable ? (biometricKind === 'face' ? <ScanFace size={24} /> : <FingerprintPattern size={24} />) : <Lock size={22} />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-md-on-surface font-medium">Lock Aastha</p>
                            <p className="text-xs text-md-on-surface-variant mt-0.5">
                              {isBiometricAvailable
                                ? `Unlock with your ${biometricKind === 'face' ? 'face' : biometricKind === 'fingerprint' ? 'fingerprint' : 'fingerprint or face'}, your phone's PIN and your password work too.`
                                : 'Unlock with your account password.'}
                            </p>
                          </div>
                          <Switch checked={lock.enabled} onChange={() => toggleAppLock()} label="Lock Aastha" />
                        </div>
                        {lock.enabled && (
                          <div className="px-4 pb-4 pt-1 border-t border-md-outline-variant/30">
                            <p className="text-sm text-md-on-surface mt-3 mb-2.5">Lock after</p>
                            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Lock after">
                              {LOCK_AFTER_OPTIONS.map((o) => {
                                const on = lock.afterMs === o.ms;
                                return (
                                  <button key={o.ms} type="button" role="radio" aria-checked={on} onClick={() => updateLock({ ...lock, afterMs: o.ms })}
                                    className={`h-9 px-3.5 rounded-full text-sm transition-colors inline-flex items-center gap-1.5 ${on ? 'bg-md-secondary-container text-md-on-secondary-container font-medium' : 'border border-md-outline-variant/50 text-md-on-surface-variant hover:bg-md-on-surface/[0.06]'}`}>
                                    {on && <Check size={14} />}{o.label}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[11px] text-md-on-surface-variant mt-2.5 px-0.5">{describeLockAfter(lock)} Music and focus timers keep it open.</p>
                          </div>
                        )}
                      </Card>
                      {lock.enabled && (
                        <ListGroup className="mt-3">
                          {Capacitor.isNativePlatform() && (
                            <ListItem icon={<EyeOff size={18} />} title="Hide in recent apps" subtitle="Blank preview in the app switcher (also blocks screenshots)"
                              trailing={<Switch checked={lock.hideInSwitcher} onChange={(v) => updateLock({ ...lock, hideInSwitcher: v })} label="Hide in recent apps" />} />
                          )}
                          <ListItem icon={<Lock size={18} />} title="Lock now" subtitle="Lock the app straight away"
                            onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new Event(LOCK_NOW_EVENT)), 250); }} />
                        </ListGroup>
                      )}
                  </section>

                  <section>
                      <SectionTitle>Diary password</SectionTitle>
                      <Card>
                          <p className="text-sm text-md-on-surface-variant mb-4">Change it any time, your entries stay as they are.</p>
                          <div className="space-y-3">
                              <input type="password" value={oldDiaryPassword} onChange={e => setOldDiaryPassword(e.target.value)} placeholder="Current password" className={fieldClass} />
                              <input type="password" value={newDiaryPassword} onChange={e => setNewDiaryPassword(e.target.value)} placeholder="New password" className={fieldClass} />
                              <Button onClick={handleChangeDiaryPassword} disabled={!oldDiaryPassword || !newDiaryPassword}>Update password</Button>
                          </div>
                      </Card>
                  </section>

                  {/* Reworked: server-verified, entries kept (components/wellness/DiaryPasswordReset.tsx) */}
                  <DiaryPasswordReset />
              </>
          )}

          {activeTab === 'subscription' && (
              <>
                  <section>
                      <SectionTitle>Your plan</SectionTitle>
                      <Card className={user?.isPro ? 'bg-md-primary-container border-transparent' : ''}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className={`text-xl font-semibold ${user?.isPro ? 'text-md-on-primary-container' : 'text-md-on-surface'}`}>{user?.isPro ? 'Pro' : voicePassActive ? 'Free + Voice Pass' : 'Free'}</h2>
                            <p className={`text-sm mt-1 ${user?.isPro ? 'text-md-on-primary-container/80' : 'text-md-on-surface-variant'}`}>
                              {user?.isPro
                                ? (user?.subscriptionExpiresAt ? `Active until ${new Date(user.subscriptionExpiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'Active')
                                : `16 messages every 24 hours${user?.quotaResetsAt && Date.parse(user.quotaResetsAt) > Date.now() ? ` · refills ${new Date(user.quotaResetsAt).toLocaleString('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : ''}. After that, replies continue in Eco mode.`}
                            </p>
                          </div>
                          {user?.isPro && <Sparkles className="text-md-on-primary-container shrink-0" size={24} />}
                        </div>
                      </Card>
                  </section>

                  {!user?.isPro && (
                    <section>
                      <SectionTitle>Upgrade</SectionTitle>
                      <div className="space-y-3">
                        <Card level={3} className="relative overflow-hidden">
                          <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-md-tertiary-container text-md-on-tertiary-container text-[10px] font-semibold tracking-wide">EARLY BIRD</span>
                          <h3 className="text-md-on-surface text-lg font-semibold">Pro</h3>
                          <p className="mt-1 text-md-on-surface"><span className="text-3xl font-semibold">₹49</span> <span className="text-sm text-md-on-surface-variant line-through">₹199</span> <span className="text-sm text-md-on-surface-variant">/ month</span></p>
                          <ul className="mt-4 space-y-2.5">
                            {[{ i: <Zap size={16} />, t: 'Unlimited chat on the best models' }, { i: <ImageIcon size={16} />, t: 'Send photos, Aastha can see them' }, { i: <Headphones size={16} />, t: 'Voice mode and voice notes' }].map((f, k) => (
                              <li key={k} className="flex items-center gap-3 text-sm text-md-on-surface"><span className="w-7 h-7 rounded-full bg-md-primary/15 text-md-primary flex items-center justify-center">{f.i}</span>{f.t}</li>
                            ))}
                          </ul>
                          <Button size="lg" className="w-full mt-5" onClick={() => handleSubscribe('pro')} disabled={isProcessing} icon={isProcessing ? <span className="animate-spin">⟳</span> : <Sparkles size={18} />}>
                            {isProcessing ? 'Opening…' : 'Get Pro'}
                          </Button>
                        </Card>

                        <Card>
                          <div className="flex items-start gap-3">
                            <span className="w-10 h-10 rounded-full bg-md-secondary-container text-md-on-secondary-container flex items-center justify-center shrink-0"><Headphones size={18} /></span>
                            <div className="flex-1">
                              <h3 className="text-md-on-surface font-semibold">Voice Pass <span className="font-normal text-md-on-surface-variant">· ₹19 / day</span></h3>
                              <p className="text-sm text-md-on-surface-variant mt-1">Unlimited voice calls and voice notes for 24 hours.</p>
                              {voicePassActive && (
                                <p className="text-xs text-md-primary mt-2">
                                  Active until {new Date(user!.voicePassExpiresAt!).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. Buying again adds 24 hours.
                                </p>
                              )}
                            </div>
                          </div>
                          <Button variant="tonal" className="w-full mt-4" onClick={() => handleSubscribe('voice')} disabled={isProcessing}>{isProcessing ? 'Opening…' : voicePassActive ? 'Add 24 hours' : 'Get Voice Pass'}</Button>
                        </Card>
                      </div>
                    </section>
                  )}
              </>
          )}

          {activeTab === 'data' && (
            <>
                <PrivacyCenter />
                <section>
                    <SectionTitle>Data donation</SectionTitle>
                    <ListGroup>
                      <ListItem icon={<Sparkles size={18} />} title="Help improve Aastha"
                        subtitle="Off unless you turn it on. Short snippets with your name removed, not linked to your account, kept up to a year."
                        trailing={<Switch checked={isDataDonationOn} onChange={() => toggleDataDonation()} label="Data donation" />} />
                    </ListGroup>
                </section>

                <section>
                    <SectionTitle>Delete account</SectionTitle>
                    {showDeleteModal ? (
                        <Card className="bg-md-error-container/40 border-md-error/40">
                            <h4 className="font-medium text-md-on-surface mb-1">We're sad to see you go.</h4>
                            <p className="text-xs text-md-on-surface-variant mb-4">This permanently deletes your account, chats, diary, moods, memories and voice notes. It can't be undone.</p>
                            <textarea className={fieldClass + ' h-24 py-3 mb-4 resize-none'} placeholder="Why are you leaving? (required)" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
                            <div className="flex gap-2">
                                <Button variant="danger" onClick={handleSoftDelete} disabled={!deleteReason || isDeleting}>{isDeleting ? 'Deleting…' : 'Delete forever'}</Button>
                                <Button variant="text" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
                            </div>
                        </Card>
                    ) : (
                        <ListGroup>
                          <ListItem danger icon={<AlertTriangle size={18} />} title="Delete my account" subtitle="Export your data first if you want a copy" onClick={() => setShowDeleteModal(true)} />
                        </ListGroup>
                    )}
                </section>
            </>
          )}
      </div>
  );

  const planText = user?.isPro ? 'Pro' : voicePassActive ? 'Free · Voice Pass' : 'Free plan';
  const profileHeader = (
    <button onClick={() => handleTabClick('account')} className="w-full flex items-center gap-3 p-3 rounded-[24px] bg-md-surface-container-high hover:brightness-110 transition text-left">
      {user?.avatar ? <img src={user.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
        : <span className="w-12 h-12 rounded-full bg-md-primary-container text-md-on-primary-container flex items-center justify-center text-lg font-semibold">{user?.name?.charAt(0) || 'U'}</span>}
      <span className="flex-1 min-w-0">
        <span className="block font-medium text-md-on-surface truncate">{user?.name}</span>
        <span className="block text-xs text-md-on-surface-variant truncate">{planText}</span>
      </span>
      <ChevronRight size={18} className="text-md-on-surface-variant" />
    </button>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/55" />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            initial={isMobile ? { y: '100%' } : { scale: 0.96, opacity: 0 }}
            animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1 }}
            exit={isMobile ? { y: '100%' } : { scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
            className={`relative w-full bg-md-surface-container-low text-md-on-surface shadow-2xl overflow-hidden flex
                ${isMobile ? 'h-[100dvh] flex-col' : 'max-w-4xl h-[min(720px,88vh)] rounded-[28px] border border-md-outline-variant/30 flex-row'}`}
          >

            {/* --- MOBILE ROOT VIEW --- */}
            {isMobile && !isMobileDetail && (
                <div className="flex flex-col h-full w-full">
                    <div className="px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
                      <GlassBar title={<span className="text-lg">Settings</span>} trailing={<IconButton label="Close settings" onClick={onClose}><X size={20} /></IconButton>} />
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] space-y-4">
                        {profileHeader}
                        <ListGroup>
                          {tabs.map((tab) => (
                            <ListItem key={tab.id} icon={<tab.icon size={18} />} title={tab.label} subtitle={tab.desc} onClick={() => handleTabClick(tab.id)}
                              trailing={<ChevronRight size={18} className="text-md-on-surface-variant" />} />
                          ))}
                        </ListGroup>
                        <ListGroup>
                          <ListItem danger icon={<LogOut size={18} />} title="Log out" onClick={() => logout()} />
                        </ListGroup>
                    </div>
                </div>
            )}

            {/* --- MOBILE DETAIL VIEW --- */}
            {isMobile && isMobileDetail && (
                <div className="flex flex-col h-full w-full animate-slide-in-right">
                    <div className="px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
                      <GlassBar leading={<IconButton label="Back" onClick={handleBack}><ChevronLeft size={22} /></IconButton>} title={activeMeta?.label}
                        trailing={<IconButton label="Close settings" onClick={onClose}><X size={20} /></IconButton>} />
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 pt-5 pb-[env(safe-area-inset-bottom)]">
                        {renderContent()}
                    </div>
                </div>
            )}

            {/* --- DESKTOP VIEW: M3 navigation drawer + content pane --- */}
            {!isMobile && (
                <>
                    <nav aria-label="Settings sections" className="w-72 shrink-0 bg-md-surface-container p-3 flex flex-col gap-1 overflow-y-auto">
                        <h2 className="px-4 pt-3 pb-4 text-2xl font-serif text-md-on-surface">Settings</h2>
                        <div className="px-1 pb-3">{profileHeader}</div>
                        {tabs.map((tab) => {
                          const on = activeTab === tab.id;
                          return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-current={on ? 'page' : undefined}
                              className={`w-full h-14 flex items-center gap-3 px-4 rounded-full text-left transition-colors duration-200 ${on ? 'bg-md-secondary-container text-md-on-secondary-container' : 'text-md-on-surface-variant hover:bg-md-on-surface/[0.06] hover:text-md-on-surface'}`}>
                              <tab.icon size={20} className="shrink-0" />
                              <span className="text-sm font-medium truncate">{tab.label}</span>
                            </button>
                          );
                        })}
                        <div className="mt-auto pt-3">
                          <button onClick={() => logout()} className="w-full h-14 flex items-center gap-3 px-4 rounded-full text-left text-md-error hover:bg-md-error/10 transition-colors">
                            <LogOut size={20} /><span className="text-sm font-medium">Log out</span>
                          </button>
                        </div>
                    </nav>

                    <div className="flex-1 min-w-0 flex flex-col">
                        <div className="px-4 pt-4">
                          <GlassBar title={<span className="text-lg">{activeMeta?.label}</span>}
                            trailing={<IconButton label="Close settings" onClick={onClose}><X size={20} /></IconButton>} />
                        </div>
                        <div className="flex-1 overflow-y-auto px-8 pt-6 custom-scrollbar">
                          <p className="text-sm text-md-on-surface-variant -mt-2 mb-6">{activeMeta?.desc}</p>
                          {renderContent()}
                        </div>
                    </div>
                </>
            )}

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
