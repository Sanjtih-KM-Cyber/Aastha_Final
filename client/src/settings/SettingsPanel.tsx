import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Trash2, Shield, User, Palette, Check, ToggleLeft, ToggleRight, AlertTriangle, Mic, Edit2, Save } from 'lucide-react';
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
  { id: 'data', label: 'Data & Privacy', icon: Shield },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('appearance');
  const { currentTheme, setTheme, setWallpaper, resetTheme, wallpaper } = useTheme();
  const { user, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem('user_tts_enabled') === 'true');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(localStorage.getItem('user_voice_uri'));

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');

  useEffect(() => {
    if (user) { setEditName(user.name); setEditUsername(user.username || ''); }
  }, [user]);

  useEffect(() => {
    const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

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

  const handleSoftDelete = async () => {
      if (!deleteReason) return;
      setIsDeleting(true);
      try {
          await api.post('/users/delete-account', { reason: deleteReason });
          logout(); window.location.reload();
      } catch (e) { setIsDeleting(false); }
  };

  const saveProfile = async () => {
      try {
          await api.put('/users/profile', { name: editName, username: editUsername });
          setIsEditingProfile(false);
          window.location.reload();
      } catch (e) { alert("Failed to update profile."); }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-2xl bg-[#0a0e17]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">
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
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-2xl font-bold text-white">{user?.name?.charAt(0) || 'U'}</div>
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
                   <div className="flex justify-between p-3 rounded-xl bg-white/5">
                        <span className="text-white/70">On a wellness journey since</span>
                        <span className="text-white/40 font-mono">{(user as any)?.createdAt ? new Date((user as any).createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'}) : 'Recently'}</span>
                   </div>
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