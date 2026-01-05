import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Trash2, Shield, User, Palette, Check,
  ToggleLeft, ToggleRight, AlertTriangle, Mic, Edit2,
  Save, Camera, CreditCard, Sparkles, Zap, Image as ImageIcon,
  Headphones, ChevronLeft, ChevronRight, Clock // <--- Added Clock
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLowPowerMode } from '../../hooks/useLowPowerMode';
import api from '../../services/api';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = [
  { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Themes & Wallpaper' },
  { id: 'voice', label: 'Voice & Sound', icon: Mic, desc: 'TTS & Persona' },
  { id: 'account', label: 'Account', icon: User, desc: 'Profile & Details' },
  { id: 'security', label: 'Security', icon: Shield, desc: 'Password & Diary' },
  { id: 'subscription', label: 'Subscription', icon: CreditCard, desc: 'Pro Access' },
  { id: 'data', label: 'Data & Privacy', icon: Shield, desc: 'Delete Account' },
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

  const { currentTheme, setTheme, setWallpaper, wallpaper } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const { isLowPower, setLowPowerMode } = useLowPowerMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Fix: Default to FALSE for TTS if not set
  const [ttsEnabled, setTtsEnabled] = useState(() => {
      const saved = localStorage.getItem('user_tts_enabled');
      return saved === 'true'; // If null, returns false.
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(localStorage.getItem('user_voice_uri'));

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Profile Edit
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [newAvatar, setNewAvatar] = useState<string | null>(null);

  // Security (Diary Reset)
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newDiaryPassword, setNewDiaryPassword] = useState('');
  const [oldDiaryPassword, setOldDiaryPassword] = useState('');
  const [resetStep, setResetStep] = useState(0);
  const [securityQuestion, setSecurityQuestion] = useState('');
  
  // Auto Lock State
  const [autoLockDuration, setAutoLockDuration] = useState<string>(() => {
      return localStorage.getItem('settings_autoLock') || '0';
  });
  
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
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices;
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
      localStorage.setItem('user_tts_enabled', String(newState));
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const uri = e.target.value;
      setSelectedVoiceURI(uri);
      localStorage.setItem('user_voice_uri', uri);
  };

  // Handle Auto Lock Change
  const handleAutoLockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      setAutoLockDuration(val);
      localStorage.setItem('settings_autoLock', val);
      // We also update the timestamp immediately to prevent immediate lock upon switching
      localStorage.setItem('auth_last_active', Date.now().toString());
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

  const handleInitiateDiaryReset = async () => {
      try {
          if (!user?.email) return;
          const res = await api.post('/users/reset-init', { email: user.email });
          setSecurityQuestion(res.data.question);
          setResetStep(1);
      } catch (e) {
          alert("Could not fetch security question.");
      }
  };

  const handleVerifyAnswer = async () => {
      try {
          await api.post('/users/verify-security-answer', { answer: securityAnswer });
          setResetStep(2);
      } catch (e) {
          alert("Incorrect answer.");
      }
  };

  const handleResetDiary = async () => {
      try {
          await api.post('/users/reset-diary-nuclear', { newPassword: newDiaryPassword });
          alert("Diary password has been reset. Your previous entries were wiped for security.");
          setResetStep(0);
          setSecurityAnswer('');
          setNewDiaryPassword('');
      } catch (e) {
          alert("Failed to reset diary.");
      }
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
          // Do not reload, as it might just refresh the current protected route (Sanctuary)
          // logout() in AuthContext clears local storage and state.
          // App.tsx should detect isAuthenticated=false and redirect to /login?
          // To be safe, we can manually redirect or let the context update happen.
          // window.location.href = '/login'; is a hard redirect that works.
          window.location.href = '/login';
      } catch (e) { setIsDeleting(false); }
  };

  const handleSubscribe = async () => {
      setIsProcessing(true);
      try {
          const orderRes = await api.post('/users/create-order');
          const { orderId, keyId, amount } = orderRes.data;

          const options = {
              key: keyId,
              amount: amount,
              currency: "INR",
              name: "Aastha Wellness",
              description: "Early Bird Pro Access",
              image: "https://placehold.co/256?text=Aastha",
              order_id: orderId,
              handler: async (response: any) => {
                  try {
                      const verifyRes = await api.post('/users/verify-payment', {
                          razorpay_order_id: response.razorpay_order_id,
                          razorpay_payment_id: response.razorpay_payment_id,
                          razorpay_signature: response.razorpay_signature
                      });

                      if (verifyRes.data.success) {
                          alert("Welcome to the family! Pro Access Unlocked.");
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

  // --- CONTENT RENDERER (Shared) ---
  const renderContent = () => (
      <div className={`space-y-8 animate-fade-in ${isMobile ? 'pb-20' : ''}`}>

          {isMobile && activeTab === 'appearance' && (
             <section className="mb-8 p-4 rounded-xl bg-white/5 border border-white/5">
                <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Performance</h3>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-white font-medium">Lite Mode</span>
                    <button onClick={() => setLowPowerMode(!isLowPower)} className={`text-teal-400 transition-transform active:scale-95`}>
                        {isLowPower ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-white/20" />}
                    </button>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                    {isLowPower
                        ? "Lite Mode is Active. Blur effects are disabled to maximize speed and battery."
                        : "High Quality Mode is Active. Full visual effects enabled."}
                </p>
             </section>
          )}

          {activeTab === 'appearance' && (
              <>
                <section>
                  <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Theme Gems</h3>
                  <div className="flex gap-4">
                    {['aurora', 'sunset', 'ocean', 'midnight'].map((themeId) => {
                      const colors: Record<string, string> = { aurora: 'bg-teal-400', sunset: 'bg-rose-400', ocean: 'bg-sky-400', midnight: 'bg-violet-400' };
                      return (
                        <button key={themeId} onClick={() => setTheme(themeId)} className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${currentTheme.id === themeId ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-100'}`}>
                          <div className={`w-8 h-8 rounded-full ${colors[themeId]} shadow-[0_0_15px_currentColor]`} />
                        </button>
                      )
                    })}
                  </div>
                </section>
                <section>
                  <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Wallpaper</h3>
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:bg-white/5 transition-colors cursor-pointer group relative overflow-hidden">
                    {wallpaper ? (
                      <>
                        <img src={wallpaper} alt="Wallpaper" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center"><Check className="text-teal-400 mb-2" size={32} /><span className="text-sm font-medium text-white">Wallpaper Active</span></div>
                      </>
                    ) : <div className="text-center"><Upload size={20} className="mx-auto mb-2 opacity-50 text-white" /><p className="text-sm text-white">Upload Background</p></div>}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && setWallpaper(e.target.files[0])} />
                  </div>
                  {wallpaper && <button onClick={handleRemoveWallpaper} className="flex items-center gap-2 text-xs text-red-400 mt-3 hover:text-red-300 transition-colors ml-1"><Trash2 size={12}/> Remove Wallpaper</button>}
                </section>
              </>
          )}

          {activeTab === 'voice' && (
              <>
                   <section>
                       <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Companion Persona</h3>
                       <div className="grid grid-cols-2 gap-4 mb-8">
                           <button
                               onClick={() => savePersona('aastha')}
                               className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${user?.persona !== 'aarav' ? 'bg-teal-500/20 border-teal-500 text-teal-200 shadow-[0_0_15px_rgba(20,184,166,0.2)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                           >
                               <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center text-xl shadow-lg">🌸</div>
                               <div className="text-center">
                                   <div className="font-bold text-sm mb-1">Aastha</div>
                                   <div className="text-[10px] opacity-70">Calm, Sisterly, Warm</div>
                               </div>
                           </button>

                           <button
                               onClick={() => savePersona('aarav')}
                               className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all ${user?.persona === 'aarav' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-200 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                           >
                               <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center text-xl shadow-lg">🧘‍♂️</div>
                               <div className="text-center">
                                   <div className="font-bold text-sm mb-1">Aastik</div>
                                   <div className="text-[10px] opacity-70">Grounded, Brotherly, Protective</div>
                               </div>
                           </button>
                       </div>
                   </section>

                   <section>
                       <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">AI Voice Settings</h3>
                       <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 mb-4">
                            <div><span className="block text-white/90 font-medium">Auto-Read Responses</span></div>
                            <button onClick={toggleTTS} className="text-teal-400">{ttsEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} className="text-white/20" />}</button>
                       </div>
                       <select className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white" value={selectedVoiceURI || ''} onChange={handleVoiceChange}>
                           <option value="" disabled>Select a voice...</option>
                           {availableVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                       </select>
                   </section>
              </>
          )}

          {activeTab === 'account' && (
            <>
               <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 relative">
                    <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                        {newAvatar || user?.avatar ? (
                            <img src={newAvatar || user?.avatar} className="w-16 h-16 rounded-full object-cover border-2 border-white/10" alt="Avatar" />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-2xl font-bold text-white">{user?.name?.charAt(0) || 'U'}</div>
                        )}
                        <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={16} className="text-white"/></div>
                        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarSelect} />
                    </div>
                    <div className="flex-1">
                         {isEditingProfile ? (
                             <div className="space-y-2">
                                 <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-black/40 border border-white/20 rounded p-1 text-sm text-white" placeholder="Name" />
                                 <input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="w-full bg-black/40 border border-white/20 rounded p-1 text-sm text-white" placeholder="Username" />
                             </div>
                         ) : (
                             <><h4 className="text-lg font-medium text-white">{user?.name}</h4><p className="text-sm text-white/50">@{user?.username}</p></>
                         )}
                    </div>
                    <button onClick={() => isEditingProfile ? saveProfile() : setIsEditingProfile(true)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60">{isEditingProfile ? <Save size={18} className="text-teal-400"/> : <Edit2 size={16} />}</button>
               </div>
               <div className="flex justify-between p-3 rounded-xl bg-white/5"><span className="text-white/70">Joined</span><span className="text-white/40 font-mono">{(user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'}) : 'Recently'}</span></div>
            </>
          )}

          {activeTab === 'security' && (
              <>
                  <section>
                      {/* --- NEW AUTO LOCK SECTION --- */}
                      <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">App Security</h3>
                      <div className="flex justify-between items-center p-4 rounded-xl bg-white/5 border border-white/5 mb-8">
                          <div className="flex items-center gap-3">
                              <div className="p-2 bg-teal-500/20 rounded-lg text-teal-400">
                                  <Clock size={20} />
                              </div>
                              <div>
                                  <h4 className="text-white font-medium text-sm">Auto-Lock Timer</h4>
                                  <p className="text-xs text-white/50">Lock app after inactivity</p>
                              </div>
                          </div>
                          <select 
                              value={autoLockDuration} 
                              onChange={handleAutoLockChange}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-500/50"
                          >
                              <option value="0">Disabled</option>
                              <option value="15000">15 Seconds</option>
                              <option value="30000">30 Seconds</option>
                              <option value="60000">1 Minute</option>
                              <option value="120000">2 Minutes</option>
                              <option value="300000">5 Minutes</option>
                              <option value="600000">10 Minutes</option>
                          </select>
                      </div>

                      <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Diary Security</h3>

                      <div className="p-6 bg-white/5 rounded-2xl border border-white/5 mb-6">
                          <h4 className="text-lg font-medium text-white mb-2">Change Diary Password</h4>
                          <p className="text-sm text-white/60 mb-4">Update your password without losing your data.</p>
                          <div className="space-y-3">
                              <input type="password" value={oldDiaryPassword} onChange={e => setOldDiaryPassword(e.target.value)} placeholder="Old Password" className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" />
                              <input type="password" value={newDiaryPassword} onChange={e => setNewDiaryPassword(e.target.value)} placeholder="New Password" className="w-full bg-black/40 border border-white/20 rounded p-2 text-white text-sm" />
                              <button onClick={handleChangeDiaryPassword} disabled={!oldDiaryPassword || !newDiaryPassword} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors text-sm disabled:opacity-50">Update Password</button>
                          </div>
                      </div>

                      <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                          <h4 className="text-lg font-medium text-white mb-2">Forgot Password (Nuclear Reset)</h4>
                          <p className="text-sm text-white/60 mb-6">Use this if you cannot remember your old password. <br/><span className="text-red-400">Warning: This will wipe your existing diary entries.</span></p>
                          
                          {resetStep === 0 && (
                              <button onClick={handleInitiateDiaryReset} className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm">Start Recovery Process</button>
                          )}

                          {resetStep === 1 && (
                              <div className="space-y-4">
                                  <p className="text-teal-400 font-medium">{securityQuestion}</p>
                                  <input type="text" value={securityAnswer} onChange={e => setSecurityAnswer(e.target.value)} placeholder="Your Answer" className="w-full bg-black/40 border border-white/20 rounded p-2 text-white" />
                                  <button onClick={handleVerifyAnswer} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg">Verify</button>
                              </div>
                          )}

                          {resetStep === 2 && (
                              <div className="space-y-4">
                                  <input type="password" value={newDiaryPassword} onChange={e => setNewDiaryPassword(e.target.value)} placeholder="New Diary Password" className="w-full bg-black/40 border border-white/20 rounded p-2 text-white" />
                                  <button onClick={handleResetDiary} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg">Reset & Wipe Diary</button>
                              </div>
                          )}
                      </div>
                  </section>
              </>
          )}

          {activeTab === 'subscription' && (
              <>
                  <section>
                      <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Membership Plan</h3>

                      {user?.isPro ? (
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30">
                              <div className="flex justify-between items-start mb-4">
                                  <div>
                                      <h2 className="text-2xl font-serif text-white mb-1">Pro Member</h2>
                                      <p className="text-sm text-white/60">You have unlimited access to Aastha.</p>
                                  </div>
                                  <Sparkles className="text-amber-400" size={28} />
                              </div>
                              <div className="flex items-center gap-2 text-amber-200 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                                  <Check size={16} />
                                  <span className="text-sm font-medium">Active Subscription</span>
                              </div>
                          </div>
                      ) : (
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 to-violet-500/10 border border-teal-500/30 relative overflow-hidden">
                              <div className="absolute top-4 right-4 bg-gradient-to-r from-teal-400 to-amber-300 text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">EARLY BIRD OFFER</div>
                              <h2 className="text-3xl font-serif text-white mb-2">₹49 <span className="text-lg text-white/40 font-sans font-normal line-through">₹199</span> <span className="text-sm text-white/60 font-sans font-normal">/ month</span></h2>
                              <p className="text-sm text-white/70 mb-6">Unlock the full healing potential of Aastha.</p>

                              <div className="space-y-3 mb-8">
                                  <div className="flex items-center gap-3 text-sm text-white/80"><Zap size={16} className="text-amber-400"/> Unlimited AI Chat</div>
                                  <div className="flex items-center gap-3 text-sm text-white/80"><ImageIcon size={16} className="text-teal-400"/> Vision Support</div>
                                  <div className="flex items-center gap-3 text-sm text-white/80"><Headphones size={16} className="text-violet-400"/> Voice Mode</div>
                              </div>

                              <button onClick={handleSubscribe} disabled={isProcessing} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2">
                                  {isProcessing ? <span className="animate-spin">⟳</span> : <><Sparkles size={18} className="text-amber-600" /> Unlock Pro Access</>}
                              </button>
                          </div>
                      )}
                  </section>
              </>
          )}

          {activeTab === 'data' && (
            <>
                <section>
                    <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Danger Zone</h3>
                    {showDeleteModal ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
                            <h4 className="font-medium text-red-100 mb-2">We are sad to see you go.</h4>
                            <textarea className="w-full bg-black/40 border border-red-500/20 rounded-lg p-2 text-sm text-white mb-4" placeholder="Reason..." value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
                            <div className="flex gap-2">
                                <button onClick={handleSoftDelete} disabled={!deleteReason || isDeleting} className="px-4 py-2 bg-red-600 rounded text-sm text-white font-medium">{isDeleting ? 'Processing...' : 'Confirm'}</button>
                                <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-white/60 text-sm">Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-3 px-4 py-3 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 w-full transition-colors"><AlertTriangle size={20} /> Delete Account</button>
                    )}
                </section>
            </>
          )}
      </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <motion.div
            initial={isMobile ? { y: '100%' } : { scale: 0.9, opacity: 0, y: 20 }}
            animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
            exit={isMobile ? { y: '100%' } : { scale: 0.9, opacity: 0, y: 20 }}
            className={`
                relative w-full max-w-2xl bg-[#0a0e17] md:bg-[#0a0e17]/90 backdrop-blur-2xl
                border-t border-white/10 md:border md:rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row
                ${isMobile ? 'h-full rounded-t-3xl' : 'h-[600px]'}
            `}
          >

            {/* --- MOBILE ROOT VIEW --- */}
            {isMobile && !isMobileDetail && (
                <div className="flex flex-col h-full w-full p-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="font-serif text-3xl tracking-tight text-white">Settings</h2>
                        <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-white/60 hover:text-white"><X size={20} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3">
                        {tabs.map((tab) => (
                            <button key={tab.id} onClick={() => handleTabClick(tab.id)} className="w-full flex items-center gap-4 p-5 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 text-left group">
                                <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white/70 group-hover:text-white">
                                    <tab.icon size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-white text-base">{tab.label}</h3>
                                    <p className="text-xs text-white/40">{tab.desc}</p>
                                </div>
                                <ChevronRight className="text-white/20" size={16} />
                            </button>
                        ))}
                         <button onClick={() => logout()} className="w-full flex items-center gap-4 p-5 rounded-2xl bg-red-500/5 hover:bg-red-500/10 transition-all border border-red-500/10 text-left mt-6">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400"><User size={20} /></div>
                            <div className="flex-1"><h3 className="font-bold text-red-300">Log Out</h3></div>
                        </button>
                    </div>
                </div>
            )}

            {/* --- MOBILE DETAIL VIEW --- */}
            {isMobile && isMobileDetail && (
                <div className="flex flex-col h-full w-full animate-slide-in-right">
                    <div className="flex items-center gap-3 p-6 border-b border-white/5">
                        <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-white/5 text-white/80"><ChevronLeft size={24} /></button>
                        <h2 className="font-bold text-lg text-white">{tabs.find(t => t.id === activeTab)?.label}</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        {renderContent()}
                    </div>
                </div>
            )}

            {/* --- DESKTOP VIEW --- */}
            {!isMobile && (
                <>
                    <div className="w-64 bg-white/5 border-r border-white/5 p-6 flex flex-col">
                    <h2 className="font-serif text-2xl mb-8 tracking-tight text-white">Settings</h2>
                    <div className="space-y-2">
                        {tabs.map((tab) => (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-white/10 text-white shadow-inner' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                            <tab.icon size={18} /> <span className="text-sm font-medium">{tab.label}</span>
                            </button>
                        ))}
                    </div>
                    <button onClick={() => logout()} className="mt-auto flex items-center gap-3 px-4 py-3 text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-xl transition-all"><span className="text-sm font-medium">Log Out</span></button>
                    </div>

                    <div className="flex-1 p-8 overflow-y-auto relative custom-scrollbar">
                        <button onClick={onClose} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"><X size={20} /></button>
                        {renderContent()}
                    </div>
                </>
            )}

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
