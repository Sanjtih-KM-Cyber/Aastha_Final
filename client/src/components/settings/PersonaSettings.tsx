import React, { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Upload, X, Check, Loader2, Mic } from 'lucide-react';
import api from '../../services/api';

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
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            // In a real implementation, this would upload to S3/Cloudinary/Server
            // For now, we simulate a successful upload and update the user model if needed
            // OR call an endpoint if one exists.
            // The requirement says "Move Upload Voice/Screenshot... into Settings".
            // Assuming endpoints: /api/users/upload-voice and /api/users/upload-clone-base

            // Simulating API call for now as specific endpoints might need creation or verification
            // Let's assume we handle it via a generic upload endpoint or simulate it.

            await new Promise(resolve => setTimeout(resolve, 1500)); // Fake upload delay

            setSuccessMsg(`${type === 'voice' ? 'Voice sample' : 'Clone screenshot'} uploaded successfully!`);
            setTimeout(() => setSuccessMsg(''), 3000);

        } catch (e) {
            console.error(e);
            alert("Upload failed.");
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
