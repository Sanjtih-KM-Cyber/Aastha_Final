import React, { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Upload, X, Check, Loader2, Mic } from 'lucide-react';
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
                // Note: Voice samples might be large, ensure server body limit is high (10mb set in app.ts)
                await api.post('/users/persona-voice', { audio: base64Data });
            }

            setSuccessMsg(`${type === 'voice' ? 'Voice sample' : 'Clone screenshot'} uploaded successfully!`);
            setTimeout(() => setSuccessMsg(''), 3000);

        } catch (e: any) {
            console.error(e);
            alert("Upload failed: " + (e.response?.data?.message || e.message));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-4">Clone Mode Configuration</h3>

            <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-6">
                <div>
                    <h4 className="text-white font-medium mb-1">Voice Clone Sample</h4>
                    <p className="text-xs text-white/50 mb-3">Upload a 30s-60s clear audio recording of the person you want Aastha to mimic.</p>

                    <div
                        onClick={() => voiceInputRef.current?.click()}
                        className="border-2 border-dashed border-white/10 rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer hover:bg-white/5 transition-colors"
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
                    <p className="text-xs text-white/50 mb-3">Upload a screenshot of a chat conversation to analyze their texting style.</p>

                    <div
                        onClick={() => screenshotInputRef.current?.click()}
                        className="border-2 border-dashed border-white/10 rounded-xl p-4 flex items-center justify-center gap-3 cursor-pointer hover:bg-white/5 transition-colors"
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
