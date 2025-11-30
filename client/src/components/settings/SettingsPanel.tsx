import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Trash2, Shield, User, Palette, Check, ToggleLeft, ToggleRight, AlertTriangle, Mic, Edit2, Save, Camera, CreditCard, Sparkles, Zap, Image as ImageIcon, Headphones } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'voice', label: 'Voice & Sound', icon: Mic },
  { id: 'account', label: 'Account', icon: User },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
  { id: 'data', label: 'Data & Privacy', icon: Shield },
];

declare global {
  interface Window {
    Razorpay: any;
  }
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('appearance');
  const { currentTheme, setTheme, setWallpaper, wallpaper } = useTheme();
  const { user, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem('user_tts_enabled') === 'true');
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
  
  // Subscription
  const [isProcessing, setIsProcessing] = useState(false);

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
          await api.put('/users/profile', { name: editName, username: editUsername, avatar: newAvatar });
          setIsEditingProfile(false);
          window.location.reload(); 
      } catch (e) { alert("Failed to update profile."); }
  };

  const handleRemoveWallpaper = () => {
      setWallpaper(null);
  };

  const handleSoftDelete = async () => {
      if (!deleteReason) return;
      setIsDeleting(true);
      try {
          await api.post('/users/delete-account', { reason: deleteReason });
          logout(); window.location.reload();
      } catch (e) { setIsDeleting(false); }
  };

  // --- RAZORPAY PAYMENT HANDLER ---
  const handleSubscribe = async () => {
      setIsProcessing(true);
      try {
          // 1. Create Order on Backend
          const orderRes = await api.post('/users/create-order');
          const { orderId, keyId, amount } = orderRes.data;

          // 2. Options
          const options = {
              key: keyId,
              amount: amount,
              currency: "INR",
              name: "Aastha Wellness",
              description: "Early Bird Pro Access",
              image: "https://i.ibb.co/5GzXwzJ/logo.png", // Fallback logo or app logo
              order_id: orderId,
              handler: async (response: any) => {
                  try {
                      // 3. Verify Payment
                      const verifyRes = await api.post('/users/verify-payment', {
                          razorpay_order_id: response.razorpay_order_id,
                          razorpay_payment_id: response.razorpay_payment_id,
                          razorpay_signature: response.razorpay_signature
                      });

                      if (verifyRes.data.success) {
                          // Success!
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-2xl bg-[#0a0e17]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">
            
            <div className="w-full md:w-64 bg-white/5 border-r border-white/5 p-6 flex flex-col">
              <h2 className="font-serif text-2xl mb-8 tracking-tight text-white">Settings</h2>
              <div className="space-y-2">
                {tabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab.id ? 'bg-white/10 text-white shadow-inner' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
                      <tab.icon size={18} /> <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                ))}
              </div>
              <button onClick={() => { logout(); window.location.reload(); }} className="mt-auto flex items-center gap-3 px-4 py-3 text-red-300 hover:text-red-200 hover:bg-red-500/10 rounded-xl transition-all"><span className="text-sm font-medium">Log Out</span></button>
            </div>

            <div className="flex-1 p-8 overflow-y-auto relative custom-scrollbar">
              <button onClick={onClose} className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"><X size={20} /></button>
              
              {activeTab === 'appearance' && (
                <div className="space-y-8 animate-fade-in">
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
                </div>
              )}

              {activeTab === 'voice' && (
                  <div className="space-y-8 animate-fade-in">
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
                  </div>
              )}

              {activeTab === 'account' && (
                <div className="space-y-6 animate-fade-in">
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
                   <div className="flex justify-between p-3 rounded-xl bg-white/5"><span className="text-white/70">On a wellness journey since</span><span className="text-white/40 font-mono">{(user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'}) : 'Recently'}</span></div>
                </div>
              )}

              {activeTab === 'subscription' && (
                  <div className="space-y-8 animate-fade-in">
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
                                  {/* Badge */}
                                  <div className="absolute top-4 right-4 bg-gradient-to-r from-teal-400 to-amber-300 text-black text-[10px] font-bold px-3 py-1 rounded-full shadow-lg">
                                      EARLY BIRD OFFER
                                  </div>

                                  <h2 className="text-3xl font-serif text-white mb-2">₹49 <span className="text-lg text-white/40 font-sans font-normal line-through">₹199</span> <span className="text-sm text-white/60 font-sans font-normal">/ month</span></h2>
                                  <p className="text-sm text-white/70 mb-6">Unlock the full healing potential of Aastha.</p>

                                  <div className="space-y-3 mb-8">
                                      <div className="flex items-center gap-3 text-sm text-white/80"><Zap size={16} className="text-amber-400"/> Unlimited AI Chat (Aastha Pro)</div>
                                      <div className="flex items-center gap-3 text-sm text-white/80"><ImageIcon size={16} className="text-teal-400"/> Vision Support (Send Images)</div>
                                      <div className="flex items-center gap-3 text-sm text-white/80"><Headphones size={16} className="text-violet-400"/> Voice Mode</div>
                                      <div className="flex items-center gap-3 text-sm text-white/80"><Sparkles size={16} className="text-rose-400"/> Custom Soundscapes</div>
                                  </div>

                                  <button 
                                    onClick={handleSubscribe}
                                    disabled={isProcessing}
                                    className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2"
                                  >
                                      {isProcessing ? <span className="animate-spin">⟳</span> : <><Sparkles size={18} className="text-amber-600" /> Unlock Pro Access</>}
                                  </button>
                                  <p className="text-[10px] text-center text-white/30 mt-3">Secured by Razorpay. Cancel anytime.</p>
                              </div>
                          )}
                      </section>
                  </div>
              )}

              {activeTab === 'data' && (
                <div className="space-y-8 animate-fade-in">
                    <section>
                        <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Danger Zone</h3>
                        {showDeleteModal ? (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
                                <h4 className="font-medium text-red-100 mb-2">We are sad to see you go.</h4>
                                <p className="text-xs text-red-200/60 mb-4">Your sanctuary will be preserved for 10 days. Why are you leaving?</p>
                                <textarea className="w-full bg-black/40 border border-red-500/20 rounded-lg p-2 text-sm text-white mb-4" placeholder="Reason..." value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
                                <div className="flex gap-2">
                                    <button onClick={handleSoftDelete} disabled={!deleteReason || isDeleting} className="px-4 py-2 bg-red-600 rounded text-sm text-white font-medium hover:bg-red-700 transition-colors">{isDeleting ? 'Processing...' : 'Confirm'}</button>
                                    <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-white/60 text-sm hover:text-white transition-colors">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setShowDeleteModal(true)} className="flex items-center gap-3 px-4 py-3 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/10 w-full transition-colors"><AlertTriangle size={20} /> Delete Account</button>
                        )}
                    </section>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};