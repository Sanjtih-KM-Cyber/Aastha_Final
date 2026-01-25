import React, { useState, useEffect, useRef } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { Network, Search, RefreshCw, User, Skull, Heart, CircleDashed, Fingerprint, FileText, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

interface Person {
    _id: string;
    name: string;
    alias: string;
    relationshipScore: number;
    verdict: 'KEEPER' | 'TOXIC' | 'SUSPECT' | 'NPC';
    rapSheet: string[];
    mugshot?: string;
}

interface TheWebProps {
    isOpen: boolean;
    onClose: () => void;
    zIndex?: number;
    onFocus?: () => void;
    persistenceKey?: string;
}

const VERDICT_COLORS = {
    KEEPER: 'text-green-400 border-green-500/50 bg-green-500/10',
    TOXIC: 'text-red-500 border-red-500/50 bg-red-500/10',
    SUSPECT: 'text-amber-400 border-amber-500/50 bg-amber-500/10',
    NPC: 'text-gray-400 border-gray-500/50 bg-gray-500/10'
};

const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; // Smaller for mugshots
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                }
            };
        };
        reader.onerror = (error) => reject(error);
    });
};

const CaseFile: React.FC<{ person: Person; onClose: () => void; onUpdate: () => void }> = ({ person, onClose, onUpdate }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const compressed = await compressImage(file);
            await api.post('/data/web/mugshot', { personId: person._id, image: compressed });
            onUpdate(); // Refresh parent
        } catch (e) {
            console.error(e);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            className="absolute inset-4 z-50 bg-[#fdf6e3] text-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col font-mono"
            style={{
                backgroundImage: 'url("https://www.transparenttextures.com/patterns/aged-paper.png")',
                transform: 'rotate(-1deg)'
            }}
        >
            {/* Header Tab */}
            <div className="h-12 flex items-center justify-between px-6 bg-[#d2c29d] border-b border-[#bfa776]">
                <span className="font-bold tracking-widest text-sm uppercase opacity-70">CONFIDENTIAL // DOSSIER</span>
                <button onClick={onClose} className="hover:bg-black/10 p-1 rounded-full"><span className="text-xl">×</span></button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
                <div className="flex gap-6">
                    {/* Mugshot Area */}
                    <div
                        className="w-32 h-40 bg-gray-200 border-2 border-gray-400 shadow-inner flex items-center justify-center shrink-0 relative rotate-1 cursor-pointer group overflow-hidden"
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                    >
                        {person.mugshot ? (
                            <img src={person.mugshot} alt={person.name} className={`w-full h-full object-cover grayscale contrast-125 ${isUploading ? 'opacity-50' : ''}`} />
                        ) : (
                            <User size={48} className="text-gray-400" />
                        )}

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            {isUploading ? <RefreshCw className="animate-spin text-white" /> : <Camera size={24} className="text-white" />}
                        </div>

                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />

                        <div className="absolute -bottom-4 bg-black text-white px-2 py-0.5 text-xs font-bold uppercase tracking-widest z-10">
                            {person._id.slice(-6)}
                        </div>
                    </div>

                    <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-1">{person.name}</h2>
                                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">AKA: "{person.alias}"</p>
                            </div>
                            <div className={`px-4 py-2 border-4 font-black text-xl uppercase -rotate-6 tracking-widest opacity-80 ${VERDICT_COLORS[person.verdict].replace('text-', 'border-').replace('bg-', '')} text-red-700 border-red-700`}>
                                {person.verdict}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6 text-xs border-t border-b border-gray-300 py-3">
                            <div>
                                <span className="block text-gray-400 uppercase">Relationship Score</span>
                                <span className={`font-bold text-lg ${person.relationshipScore > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                    {person.relationshipScore > 0 ? '+' : ''}{person.relationshipScore}
                                </span>
                            </div>
                            <div>
                                <span className="block text-gray-400 uppercase">Classification</span>
                                <span className="font-bold">{person.verdict === 'KEEPER' ? 'Safe' : 'Monitor'}</span>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold uppercase mb-2 flex items-center gap-2"><FileText size={12}/> Behavioral Rap Sheet</h3>
                            <ul className="list-disc list-inside space-y-1 text-sm leading-relaxed opacity-90">
                                {person.rapSheet.length > 0 ? (
                                    person.rapSheet.map((trait, i) => <li key={i}>{trait}</li>)
                                ) : (
                                    <li className="italic opacity-50">No behavioral patterns detected yet.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export const TheWebWidget: React.FC<TheWebProps> = ({ isOpen, onClose, zIndex, onFocus, persistenceKey }) => {
    const { currentTheme } = useTheme();
    const { user } = useAuth();

    const [people, setPeople] = useState<Person[]>([]);
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);

    useEffect(() => {
        if (isOpen) fetchWeb();
    }, [isOpen]);

    const fetchWeb = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/data/web');
            setPeople(res.data || []);
            // Update selected person ref if open
            if (selectedPerson) {
                const updated = res.data.find((p: Person) => p._id === selectedPerson._id);
                if (updated) setSelectedPerson(updated);
            }
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    const runScan = async () => {
        setIsScanning(true);
        try {
            await api.post('/data/web/scan');
            await fetchWeb();
        } catch (e) { console.error(e); }
        finally { setIsScanning(false); }
    };

    // --- GRAPH LOGIC ---
    // Simple Layout: User in center (50%, 50%). Others orbiting.
    // Distance = inverse of relationship score? No, closeness = higher score.
    // Angle = distributed evenly.

    const centerX = 50; // Percent
    const centerY = 50;

    const getNodePosition = (index: number, total: number, score: number) => {
        const angle = (index / total) * 2 * Math.PI;
        // Score -100 to 100.
        // Distance: 100 (Close) -> 15% radius. -100 (Far) -> 45% radius.
        // Normalized Score 0 to 1: (score + 100) / 200.
        // Actually, "Close" usually means closer visually.
        // Score 100 = 15% dist. Score -100 = 45% dist. Score 0 = 30% dist.
        const normalizedScore = (score + 100) / 200; // 0 (Bad) to 1 (Good)

        // Wait, "Villains" might be distant, but "Toxic" implies entanglement?
        // Let's stick to simple: High Score = Close. Low Score = Far.
        const minRadius = 15;
        const maxRadius = 40;
        const radius = maxRadius - (normalizedScore * (maxRadius - minRadius));

        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        return { x, y };
    };

    return (
        <DraggableWindow
            isOpen={isOpen}
            onClose={onClose}
            title="The Web"
            initialWidth={600}
            initialHeight={600}
            defaultPosition={{ x: 300, y: 100 }}
            zIndex={zIndex || 10}
            onFocus={onFocus || (() => {})}
            icon={Network}
            color="#60A5FA"
            persistenceKey={persistenceKey}
        >
            <div className="relative w-full h-full bg-[#0a0e17] overflow-hidden flex flex-col">

                {/* Background Grid */}
                <div className="absolute inset-0 opacity-10"
                     style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                />

                {/* --- TOOLBAR --- */}
                <div className="absolute top-4 right-4 z-20 flex gap-2">
                    <button
                        onClick={runScan}
                        disabled={isScanning}
                        className="p-2 rounded-full bg-white/5 border border-white/10 text-white/50 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2"
                        title="Run Retro-Scan"
                    >
                        <RefreshCw size={16} className={isScanning ? "animate-spin" : ""} />
                        {isScanning && <span className="text-xs">Scanning...</span>}
                    </button>
                </div>

                {/* --- THE BOARD --- */}
                <div className="flex-1 relative">

                    {/* SVG LINES LAYER */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        {people.map((p, i) => {
                            const pos = getNodePosition(i, people.length, p.relationshipScore);

                            // Line Styles
                            let stroke = "#fff";
                            let strokeDasharray = "0";
                            let opacity = 0.2;
                            let width = 1;

                            if (p.relationshipScore > 50) { // Green Taut
                                stroke = "#4ade80";
                                opacity = 0.6;
                                width = 2;
                            } else if (p.relationshipScore < -20) { // Red Tangled (Jagged simulated by color for now, SVG filters are heavy)
                                stroke = "#ef4444";
                                opacity = 0.5;
                                width = 1.5;
                                strokeDasharray = "5,2"; // Jagged-ish
                            } else { // Yellow Loose
                                stroke = "#facc15";
                                strokeDasharray = "4,4";
                                opacity = 0.3;
                            }

                            return (
                                <line
                                    key={p._id}
                                    x1={`${centerX}%`} y1={`${centerY}%`}
                                    x2={`${pos.x}%`} y2={`${pos.y}%`}
                                    stroke={stroke}
                                    strokeWidth={width}
                                    strokeDasharray={strokeDasharray}
                                    opacity={opacity}
                                />
                            );
                        })}
                    </svg>

                    {/* NODES LAYER */}
                    {/* Center User Node */}
                    <div
                        className="absolute w-16 h-16 rounded-full bg-white text-black font-bold flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.3)] z-10 border-4 border-black"
                        style={{ left: `${centerX}%`, top: `${centerY}%`, transform: 'translate(-50%, -50%)' }}
                    >
                        YOU
                    </div>

                    {/* People Nodes */}
                    <AnimatePresence>
                        {people.map((p, i) => {
                            const pos = getNodePosition(i, people.length, p.relationshipScore);
                            return (
                                <motion.div
                                    key={p._id}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="absolute cursor-pointer group z-10"
                                    style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                                    drag
                                    dragConstraints={{ left: -50, right: 50, top: -50, bottom: 50 }} // Loose constraints
                                    onClick={() => setSelectedPerson(p)}
                                >
                                    <div
                                        className={`
                                            relative -translate-x-1/2 -translate-y-1/2
                                            w-12 h-12 rounded-full border-2 flex items-center justify-center
                                            bg-[#0a0e17] transition-all hover:scale-110 shadow-lg
                                            ${p.verdict === 'KEEPER' ? 'border-green-500 shadow-green-900/50' : ''}
                                            ${p.verdict === 'TOXIC' ? 'border-red-500 shadow-red-900/50' : ''}
                                            ${p.verdict === 'SUSPECT' ? 'border-amber-500 shadow-amber-900/50' : ''}
                                            ${p.verdict === 'NPC' ? 'border-gray-500' : ''}
                                        `}
                                    >
                                        <span className="text-[10px] font-bold text-white truncate max-w-[40px]">{p.name.split(' ')[0]}</span>

                                        {/* Hover Alias Tooltip */}
                                        <div className="absolute top-full mt-2 bg-white text-black text-xs font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
                                            {p.alias}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {people.length === 0 && !isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center flex-col text-white/30 pointer-events-none">
                            <Fingerprint size={48} className="mb-4 opacity-50" />
                            <p className="text-sm">No subjects identified.</p>
                            <p className="text-xs">Run a Retro-Scan to begin profiling.</p>
                        </div>
                    )}
                </div>

                {/* --- CASE FILE OVERLAY --- */}
                <AnimatePresence>
                    {selectedPerson && (
                        <CaseFile person={selectedPerson} onClose={() => setSelectedPerson(null)} onUpdate={fetchWeb} />
                    )}
                </AnimatePresence>

            </div>
        </DraggableWindow>
    );
};
