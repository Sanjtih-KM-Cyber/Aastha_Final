import React, { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Upload, X, Check, Loader2, Mic, ToggleLeft, ToggleRight, Lock } from 'lucide-react';
import api from '../../services/api';

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                } else {
                    reject(new Error("Canvas context is null"));
                }
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const PersonaSettings: React.FC = () => {
    const { user, updateUser } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const voiceInputRef = useRef<HTMLInputElement>(null);
    const screenshotInputRef = useRef<HTMLInputElement>(null);

    // Calculate Access
    const isPro = user?.isPro;
    const hasVoiceTopUp = user?.voiceTopUpExpires && new Date(user.voiceTopUpExpires) > new Date();
    // Pro users can access everything. Top-up users can access Voice Clone (active for 3 days).
    const canUseVoiceClone = isPro || hasVoiceTopUp;
    const canUsePersonification = isPro; // Only Pro can use Text/Personification Clone (based on user request implication, or maybe both?)
    // Re-reading: "topup users should have option to manually turn of voice clone for 3 days".
    // This implies TopUp = Voice Clone Access. Pro = All Access.

    const handleUpload = async (file: File, type: 'voice' | 'screenshot') => {
        setIsUploading(true);
        setSuccessMsg('');

        try {
            let base64Data = '';

            if (type === 'screenshot') {
                base64Data = await compressImage(file);
                await api.post('/users/persona-screenshot', { image: base64Data });
            } else {
                base64Data = await fileToBase64(file);
                await api.post('/users/persona-voice', { audio: base64Data });
            }

            setSuccessMsg(`${type === 'voice' ? 'Voice sample' : 'Clone screenshot'} uploaded successfully!`);
            // Force refresh user data to update toggle state if needed
            // (Assuming updateUser refetch logic exists or we implement optimistic update)
            setTimeout(() => setSuccessMsg(''), 3000);

        } catch (e: any) {
            console.error(e);
            alert("Upload failed: " + (e.response?.data?.message || e.message));
        } finally {
            setIsUploading(false);
        }
    };

    const toggleSetting = async (key: 'isActive' | 'isPersonaActive' | 'isVoiceActive') => {
        if (!user?.cloneMode) return;
        const currentVal = user.cloneMode[key];
        const newVal = !currentVal;

        // Optimistic UI Update
        updateUser({
            ...user,
            cloneMode: { ...user.cloneMode, [key]: newVal }
        });

        try {
            await api.put('/users/clone-settings', { [key]: newVal });
        } catch (e) {
            console.error(e);
            // Revert on fail
            updateUser({
                ...user,
                cloneMode: { ...user.cloneMode, [key]: currentVal }
            });
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Clone Mode Configuration</h3>

            {/* --- MASTER TOGGLE & SUB-TOGGLES --- */}
            <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h4 className="text-white font-medium">Master Switch</h4>
                        <p className="text-xs text-white/50">Enable or disable all clone features.</p>
                    </div>
                    <button
                        onClick={() => toggleSetting('isActive')}
                        disabled={!canUseVoiceClone && !canUsePersonification}
                        className={`${!canUseVoiceClone && !canUsePersonification ? 'opacity-50 cursor-not-allowed' : 'text-teal-400'}`}
                    >
                        {user?.cloneMode?.isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-white/20" />}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5">
                    {/* Personification Toggle */}
                    <div className={`p-4 rounded-xl border ${canUsePersonification ? 'bg-white/5 border-white/10' : 'bg-white/5 border-white/5 opacity-50'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-bold text-white">Personification</span>
                            {canUsePersonification ? (
                                <button onClick={() => toggleSetting('isPersonaActive')} className="text-violet-400">
                                    {user?.cloneMode?.isPersonaActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} className="text-white/20" />}
                                </button>
                            ) : <Lock size={16} className="text-white/30" />}
                        </div>
                        <p className="text-[10px] text-white/50">Mimics text style from screenshots. (Pro Only)</p>
                    </div>

                    {/* Voice Clone Toggle */}
                    <div className={`p-4 rounded-xl border ${canUseVoiceClone ? 'bg-white/5 border-white/10' : 'bg-white/5 border-white/5 opacity-50'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-bold text-white">Voice Clone</span>
                            {canUseVoiceClone ? (
                                <button onClick={() => toggleSetting('isVoiceActive')} className="text-teal-400">
                                    {user?.cloneMode?.isVoiceActive ? <ToggleRight size={24} /> : <ToggleLeft size={24} className="text-white/20" />}
                                </button>
                            ) : <Lock size={16} className="text-white/30" />}
                        </div>
                        <p className="text-[10px] text-white/50">Mimics voice from audio samples. (Pro or Top-up)</p>
                    </div>
                </div>
            </div>

            {/* --- UPLOADS --- */}
            <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-6">
                <div>
                    <h4 className="text-white font-medium mb-1">Voice Clone Sample</h4>
                    <p className="text-xs text-white/50 mb-3">Upload a 30s-60s clear audio recording. {canUseVoiceClone ? "" : "(Requires Pass)"}</p>

                    <div
                        onClick={() => canUseVoiceClone && voiceInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-4 flex items-center justify-center gap-3 transition-colors ${canUseVoiceClone ? 'border-white/10 cursor-pointer hover:bg-white/5' : 'border-white/5 opacity-50 cursor-not-allowed'}`}
                    >
                        <Mic className="text-teal-400" />
                        <span className="text-sm text-white/70">Upload Voice Sample (.wav, .mp3)</span>
                    </div>
                    <input
                        type="file"
                        ref={voiceInputRef}
                        className="hidden"
                        accept="audio/*"
                        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'voice')}
                    />
                </div>

                <div className="border-t border-white/5 pt-6">
                    <h4 className="text-white font-medium mb-1">Chat Style Screenshot</h4>
                    <p className="text-xs text-white/50 mb-3">Upload a screenshot of a chat conversation. {canUsePersonification ? "" : "(Pro Only)"}</p>

                    <div
                        onClick={() => canUsePersonification && screenshotInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-xl p-4 flex items-center justify-center gap-3 transition-colors ${canUsePersonification ? 'border-white/10 cursor-pointer hover:bg-white/5' : 'border-white/5 opacity-50 cursor-not-allowed'}`}
                    >
                        <Upload className="text-violet-400" />
                        <span className="text-sm text-white/70">Upload Chat Screenshot</span>
                    </div>
                    <input
                        type="file"
                        ref={screenshotInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'screenshot')}
                    />
                </div>

                {isUploading && (
                    <div className="flex items-center justify-center gap-2 text-teal-400 text-sm animate-pulse">
                        <Loader2 size={16} className="animate-spin" /> Processing...
                    </div>
                )}

                {successMsg && (
                    <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
                        <Check size={16} /> {successMsg}
                    </div>
                )}
            </div>
        </div>
    );
};
