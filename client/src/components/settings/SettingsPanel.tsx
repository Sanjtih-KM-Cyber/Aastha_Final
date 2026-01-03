import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Shield, Volume2, Mic, Palette, Bell, LogOut,
  ChevronRight, Moon, Sun, Smartphone, Laptop, Lock, Globe,
  Check, AlertCircle, ChevronLeft
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { ACCENT_COLORS } from '../../constants';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { user, logout, getUserDisplayName, getUserDisplayEmail, updateUser } = useAuth();
  const { setTheme, currentTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('account');
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileDetail, setIsMobileDetail] = useState(false); // For mobile navigation

  // --- PREFERENCES STATE ---
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [autoLockDuration, setAutoLockDuration] = useState<string>('0'); // '0' = Disabled

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
      // Load Preferences
      const storedTTS = localStorage.getItem('user_tts_enabled') === 'true';
      const storedVoice = localStorage.getItem('user_voice_uri') || '';
      const storedLowPower = localStorage.getItem('lite-mode-enabled') === 'true';
      const storedAutoLock = localStorage.getItem('settings_autoLock') || '0';

      setTtsEnabled(storedTTS);
      setSelectedVoice(storedVoice);
      setLowPowerMode(storedLowPower);
      setAutoLockDuration(storedAutoLock);

      const loadVoices = () => {
          const vs = window.speechSynthesis.getVoices();
          setVoices(vs);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
  }, [isOpen]);

  const handleTTSChange = (enabled: boolean) => {
      setTtsEnabled(enabled);
      localStorage.setItem('user_tts_enabled', String(enabled));
      updateUser({ settings: { ...user?.settings, soundEnabled: enabled } } as any);
  };

  const handleVoiceChange = (uri: string) => {
      setSelectedVoice(uri);
      localStorage.setItem('user_voice_uri', uri);
  };

  const handleLowPowerChange = (enabled: boolean) => {
      setLowPowerMode(enabled);
      localStorage.setItem('lite-mode-enabled', String(enabled));
      if (enabled) document.body.classList.add('lite-mode');
      else document.body.classList.remove('lite-mode');
  };

  const handleAutoLockChange = (val: string) => {
      setAutoLockDuration(val);
      localStorage.setItem('settings_autoLock', val);
      // Reset activity timer to prevent immediate lockout
      localStorage.setItem('auth_last_active', Date.now().toString());
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'voice', label: 'Voice & Sound', icon: Volume2 },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'performance', label: 'Performance', icon: Smartphone }, // New Tab
  ];

  const handleMobileTabClick = (id: string) => {
      setActiveTab(id);
      setIsMobileDetail(true);
  };

  const handleBack = () => {
      setIsMobileDetail(false);
  };

  const renderContent = () => {
      switch(activeTab) {
          case 'account':
              return (
                  <div className="space-y-6">
                      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                              {getUserDisplayName().charAt(0).toUpperCase()}
                          </div>
                          <div>
                              <h3 className="text-xl font-bold text-white">{getUserDisplayName()}</h3>
                              <p className="text-white/50 text-sm">{getUserDisplayEmail()}</p>
                              <div className="flex gap-2 mt-2">
                                  <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 text-[10px] uppercase font-bold rounded-full border border-teal-500/30">Verified</span>
                                  {user?.isPro && <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] uppercase font-bold rounded-full border border-amber-500/30">Pro</span>}
                              </div>
                          </div>
                      </div>
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Member Since</label>
                          <div className="p-4 bg-white/5 rounded-xl border border-white/5 text-white/80">
                              {new Date(user?.createdAt || Date.now()).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                      </div>
                  </div>
              );
          case 'appearance':
              return (
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          {Object.entries(ACCENT_COLORS).map(([name, color]) => (
                              <button
                                  key={name}
                                  onClick={() => setTheme(color)} // Using existing ThemeContext logic (which might map name or color)
                                  className={`relative h-24 rounded-2xl overflow-hidden transition-all border-2 ${currentTheme.primaryColor === color ? 'border-white scale-105 shadow-xl' : 'border-transparent opacity-80 hover:opacity-100 hover:scale-[1.02]'}`}
                                  style={{ backgroundColor: '#1f2937' }}
                              >
                                  <div className="absolute inset-0 opacity-30" style={{ backgroundColor: color }} />
                                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                      <span className="text-sm font-bold text-white">{name}</span>
                                  </div>
                                  {currentTheme.primaryColor === color && (
                                      <div className="absolute top-2 right-2 bg-white text-black rounded-full p-1"><Check size={12} strokeWidth={4} /></div>
                                  )}
                              </button>
                          ))}
                      </div>
                  </div>
              );
          case 'voice':
              return (
                  <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${ttsEnabled ? 'bg-teal-500/20 text-teal-300' : 'bg-white/5 text-white/40'}`}><Volume2 size={20} /></div>
                              <div>
                                  <h4 className="font-bold text-white">Text-to-Speech</h4>
                                  <p className="text-xs text-white/50">Allow Aastha to speak responses</p>
                              </div>
                          </div>
                          <button
                              onClick={() => handleTTSChange(!ttsEnabled)}
                              className={`w-12 h-6 rounded-full transition-colors relative ${ttsEnabled ? 'bg-teal-500' : 'bg-white/10'}`}
                          >
                              <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${ttsEnabled ? 'left-7' : 'left-1'}`} />
                          </button>
                      </div>

                      {ttsEnabled && (
                          <div className="space-y-3">
                              <label className="text-xs font-bold text-white/40 uppercase tracking-widest ml-1">Preferred Voice</label>
                              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar bg-white/5 rounded-xl p-2">
                                  {voices.map(voice => (
                                      <button
                                          key={voice.voiceURI}
                                          onClick={() => handleVoiceChange(voice.voiceURI)}
                                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedVoice === voice.voiceURI ? 'bg-white/10 text-white border border-white/10' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}
                                      >
                                          <div className="flex justify-between items-center">
                                              <span>{voice.name}</span>
                                              {selectedVoice === voice.voiceURI && <Check size={14} className="text-teal-400" />}
                                          </div>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              );
          case 'security':
              return (
                  <div className="space-y-6">
                      {/* Change Password Block (Placeholder) */}
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5 opacity-50 cursor-not-allowed">
                          <div className="flex items-center gap-3 mb-2">
                              <Lock size={18} className="text-white/60"/>
                              <h4 className="font-bold text-white">Change Password</h4>
                          </div>
                          <p className="text-xs text-white/40">This feature is currently disabled for security updates.</p>
                      </div>

                      {/* --- AUTO LOCK SETTING --- */}
                      <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex items-center gap-3 mb-3">
                              <Shield size={18} className="text-white/60"/>
                              <div>
                                  <h4 className="font-bold text-white">Auto-Lock Timer</h4>
                                  <p className="text-xs text-white/50">Lock app after inactivity</p>
                              </div>
                          </div>

                          <select
                              value={autoLockDuration}
                              onChange={(e) => handleAutoLockChange(e.target.value)}
                              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-all"
                          >
                              <option value="0">Disabled</option>
                              <option value="15000">15 Seconds (Test)</option>
                              <option value="30000">30 Seconds</option>
                              <option value="60000">1 Minute</option>
                              <option value="120000">2 Minutes</option>
                              <option value="300000">5 Minutes</option>
                              <option value="600000">10 Minutes</option>
                          </select>
                      </div>
                  </div>
              );
          case 'performance':
              return (
                  <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                          <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${lowPowerMode ? 'bg-amber-500/20 text-amber-300' : 'bg-white/5 text-white/40'}`}><Smartphone size={20} /></div>
                              <div>
                                  <h4 className="font-bold text-white">Lite Mode</h4>
                                  <p className="text-xs text-white/50">Reduce visual effects for speed</p>
                              </div>
                          </div>
                          <button
                              onClick={() => handleLowPowerChange(!lowPowerMode)}
                              className={`w-12 h-6 rounded-full transition-colors relative ${lowPowerMode ? 'bg-amber-500' : 'bg-white/10'}`}
                          >
                              <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${lowPowerMode ? 'left-7' : 'left-1'}`} />
                          </button>
                      </div>
                      <p className="text-xs text-white/30 px-2">
                          Lite Mode disables blur effects, reduces animation complexity, and optimizes background rendering. Recommended for older devices.
                      </p>
                  </div>
              );
          default: return null;
      }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-0">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`
                relative bg-[#121212] w-full max-w-4xl h-[85vh] md:h-[600px]
                rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col md:flex-row
                ${isMobile ? 'rounded-none h-full max-h-none border-none' : ''}
            `}
          >

            {/* --- MOBILE MAIN MENU --- */}
            {isMobile && !isMobileDetail && (
                <div className="flex flex-col h-full w-full">
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <h2 className="font-serif text-2xl tracking-tight text-white">Settings</h2>
                        <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-white/60 hover:text-white"><X size={20}/></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <div className="space-y-3">
                            {tabs.map((tab) => (
                                <button key={tab.id} onClick={() => handleMobileTabClick(tab.id)} className="w-full flex items-center justify-between px-4 py-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white/70 group-hover:text-white group-hover:bg-white/10 transition-all"><tab.icon size={20} /></div>
                                        <span className="font-bold text-white/90 group-hover:text-white">{tab.label}</span>
                                    </div>
                                    <ChevronRight size={20} className="text-white/30 group-hover:text-white/60" />
                                </button>
                            ))}
                        </div>

                        <button onClick={() => logout()} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl bg-red-500/5 hover:bg-red-500/10 transition-all border border-red-500/10 text-left mt-6">
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400"><LogOut size={20} /></div>
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
