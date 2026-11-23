import React, { useState, useEffect, useRef } from 'react';
import { DraggableWindow } from '../layout/DraggableWindow';
import { Network, RefreshCw, User, FileText, Camera, X } from 'lucide-react';
import { Icons } from '../../design/icons';
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
    role?: string;       // who they are to you — chosen by the AI (server ROLES), editable
    roleLabel?: string;  // custom label when role = 'other'
    vibe?: Vibe;         // how the relationship feels — chosen by the AI, editable
    userEdited?: boolean;
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

type Vibe = 'supportive' | 'warm' | 'neutral' | 'mixed' | 'complicated' | 'draining' | 'distant' | 'unsure';

/** How a relationship feels (AI-chosen) → colour used by lines, node rings, chips and the legend. */
const VIBE: Record<Vibe, { label: string; hex: string; dash: string }> = {
    supportive:  { label: 'Supportive',  hex: '#7FD8A8', dash: '0' },
    warm:        { label: 'Warm',        hex: '#A8D88F', dash: '0' },
    neutral:     { label: 'Neutral',     hex: 'rgb(var(--md-outline))', dash: '2,4' },
    mixed:       { label: 'Mixed',       hex: '#F2C46B', dash: '6,3' },
    complicated: { label: 'Complicated', hex: '#F0A070', dash: '5,2' },
    draining:    { label: 'Draining',    hex: 'rgb(var(--md-error))', dash: '3,2' },
    distant:     { label: 'Drifting',    hex: '#9AA8C8', dash: '1,5' },
    unsure:      { label: 'Not sure yet',hex: 'rgb(var(--md-on-surface-variant))', dash: '4,4' },
};
const VIBE_KEYS = Object.keys(VIBE) as Vibe[];

/** Who someone is to you (AI-chosen) → label + emoji. Keep in sync with server ROLES. */
const ROLE: Record<string, { label: string; emoji: string }> = {
    parent: { label: 'Parent', emoji: '🏠' }, sibling: { label: 'Sibling', emoji: '🧑‍🤝‍🧑' }, family: { label: 'Family', emoji: '🌳' },
    partner: { label: 'Partner', emoji: '💞' }, ex: { label: 'Ex', emoji: '🥀' }, crush: { label: 'Crush', emoji: '🦋' },
    best_friend: { label: 'Best friend', emoji: '⭐' }, close_friend: { label: 'Close friend', emoji: '🤝' }, friend: { label: 'Friend', emoji: '🙂' },
    roommate: { label: 'Roommate', emoji: '🛋️' }, colleague: { label: 'Colleague', emoji: '💼' }, manager: { label: 'Boss', emoji: '📋' },
    mentor: { label: 'Mentor', emoji: '🧭' }, teacher: { label: 'Teacher', emoji: '📚' }, classmate: { label: 'Classmate', emoji: '🎒' },
    client: { label: 'Client', emoji: '🤝' }, neighbour: { label: 'Neighbour', emoji: '🏘️' }, online_friend: { label: 'Online friend', emoji: '💬' },
    acquaintance: { label: 'Acquaintance', emoji: '👋' }, rival: { label: 'Rival', emoji: '⚔️' }, therapist: { label: 'Therapist', emoji: '🪴' },
    other: { label: 'Someone', emoji: '👤' },
};
const vibeOf = (p: Person): Vibe => (p.vibe && VIBE[p.vibe] ? p.vibe
    : p.verdict === 'KEEPER' ? 'supportive' : p.verdict === 'TOXIC' ? 'draining' : p.verdict === 'SUSPECT' ? 'mixed' : 'neutral');
const roleText = (p: Person) => (p.role === 'other' && p.roleLabel ? p.roleLabel : (ROLE[p.role || 'other'] || ROLE.other).label);
const roleEmoji = (p: Person) => (ROLE[p.role || 'other'] || ROLE.other).emoji;

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

    const vibe = vibeOf(person);
    const v = VIBE[vibe];
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const saveClass = async (patch: { role?: string; vibe?: Vibe }) => {
        setSaving(true);
        try { await api.put(`/data/web/${person._id}`, patch); onUpdate(); } catch (e) { console.error(e); } finally { setSaving(false); }
    };
    return (
        <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
            className="absolute inset-x-3 bottom-3 top-16 z-50 rounded-[28px] bg-md-surface-container-high border border-md-outline-variant/30 shadow-2xl overflow-hidden flex flex-col"
            role="dialog"
            aria-label={`About ${person.name}`}
        >
            <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <span className="mx-auto w-9 h-1 rounded-full bg-md-on-surface-variant/40" />
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-5">
                <div className="flex items-start gap-4">
                    <button
                        type="button"
                        aria-label={person.mugshot ? 'Change photo' : 'Add photo'}
                        className="relative w-20 h-20 rounded-[24px] overflow-hidden shrink-0 bg-md-surface-container-highest flex items-center justify-center group"
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                    >
                        {person.mugshot ? (
                            <img src={person.mugshot} alt="" className={`w-full h-full object-cover ${isUploading ? 'opacity-50' : ''}`} />
                        ) : (
                            <User size={32} className="text-md-on-surface-variant" />
                        )}
                        <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-md-primary text-md-on-primary flex items-center justify-center shadow">
                            {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={14} />}
                        </span>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                    </button>

                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-serif text-md-on-surface leading-tight truncate">{person.name}</h2>
                        {person.alias && <p className="text-sm text-md-on-surface-variant truncate">“{person.alias}”</p>}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-xs font-medium bg-md-secondary-container text-md-on-secondary-container">{roleEmoji(person)} {roleText(person)}</span>
                            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium bg-md-surface-container-highest text-md-on-surface">
                                <span className="w-2 h-2 rounded-full" style={{ background: v.hex }} />{v.label}
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-md-on-surface-variant hover:bg-md-on-surface/10"><X size={20} /></button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-5">
                    <div className="rounded-[20px] bg-md-surface-container p-3">
                        <span className="block text-xs text-md-on-surface-variant">Closeness</span>
                        <span className="text-xl font-semibold" style={{ color: v.hex }}>{person.relationshipScore > 0 ? '+' : ''}{person.relationshipScore}</span>
                    </div>
                    <div className="rounded-[20px] bg-md-surface-container p-3">
                        <span className="block text-xs text-md-on-surface-variant">How it feels</span>
                        <span className="text-xl font-semibold" style={{ color: v.hex }}>{v.label}</span>
                    </div>
                </div>

                <div className="mt-3 rounded-[20px] bg-md-surface-container p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-md-on-surface-variant">{person.userEdited ? 'You set this.' : 'Aastha’s guess from your chats.'}</span>
                        <button onClick={() => setEditing(e => !e)} className="h-8 px-3 rounded-full text-xs font-medium text-md-primary hover:bg-md-primary/10">{editing ? 'Done' : 'Not right? Change'}</button>
                    </div>
                    {editing && (
                        <div className="mt-2 space-y-3">
                            <div>
                                <p className="text-[11px] text-md-on-surface-variant mb-1.5">Who they are to you</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(ROLE).map(([k, r]) => (
                                        <button key={k} disabled={saving} onClick={() => saveClass({ role: k })}
                                            className={`h-8 px-2.5 rounded-[8px] text-xs font-medium inline-flex items-center gap-1 ${person.role === k ? 'bg-md-secondary-container text-md-on-secondary-container' : 'border border-md-outline-variant text-md-on-surface-variant hover:bg-md-on-surface/[0.06]'}`}>
                                            {r.emoji} {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[11px] text-md-on-surface-variant mb-1.5">How it feels</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {VIBE_KEYS.map((k) => (
                                        <button key={k} disabled={saving} onClick={() => saveClass({ vibe: k })}
                                            className={`h-8 px-2.5 rounded-[8px] text-xs font-medium inline-flex items-center gap-1.5 ${vibe === k ? 'bg-md-secondary-container text-md-on-secondary-container' : 'border border-md-outline-variant text-md-on-surface-variant hover:bg-md-on-surface/[0.06]'}`}>
                                            <span className="w-2 h-2 rounded-full" style={{ background: VIBE[k].hex }} />{VIBE[k].label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <h3 className="mt-5 mb-2 px-1 text-sm font-medium text-md-primary flex items-center gap-2"><FileText size={14} /> What you've mentioned</h3>
                <div className="rounded-[20px] bg-md-surface-container divide-y divide-md-outline-variant/30">
                    {person.rapSheet.length > 0 ? person.rapSheet.map((trait, i) => (
                        <p key={i} className="px-4 py-3 text-sm text-md-on-surface leading-relaxed">{trait}</p>
                    )) : (
                        <p className="px-4 py-3 text-sm text-md-on-surface-variant italic">Nothing noted yet.</p>
                    )}
                </div>
                <p className="mt-3 px-1 text-[11px] text-md-on-surface-variant">Private to you and encrypted. Built only from what you've told Aastha.</p>
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
            icon={Icons.web}
            persistenceKey={persistenceKey}
        >
            <div className="relative w-full h-full overflow-hidden flex flex-col">

                {/* Dot grid in the theme's outline colour */}
                <div aria-hidden className="absolute inset-0 opacity-60"
                     style={{ backgroundImage: 'radial-gradient(circle, rgb(var(--md-outline-variant)) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
                />

                {/* --- Floating controls (Liquid Glass) --- */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 glass glass-pill flex items-center gap-1 p-1.5">
                    <button
                        onClick={runScan}
                        disabled={isScanning}
                        className="h-10 px-4 rounded-full bg-md-primary text-md-on-primary text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
                    >
                        <RefreshCw size={16} className={isScanning ? 'animate-spin' : ''} />
                        {isScanning ? 'Scanning chats…' : 'Scan my chats'}
                    </button>
                </div>

                {/* Legend — only the kinds of relationships actually on your board */}
                {people.length > 0 && (
                    <div className="absolute top-3 left-3 z-20 flex flex-col gap-1 rounded-[16px] bg-md-surface-container-high/90 px-3 py-2 max-h-[45%] overflow-y-auto">
                        {VIBE_KEYS.filter(k => people.some(p => vibeOf(p) === k)).map((k) => (
                            <span key={k} className="inline-flex items-center gap-2 text-[11px] text-md-on-surface-variant whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full" style={{ background: VIBE[k].hex }} />{VIBE[k].label}
                                <span className="opacity-60">· {people.filter(p => vibeOf(p) === k).length}</span>
                            </span>
                        ))}
                    </div>
                )}

                {/* --- THE BOARD --- */}
                <div className="flex-1 relative">

                    {/* SVG LINES LAYER */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                        {people.map((p, i) => {
                            const pos = getNodePosition(i, people.length, p.relationshipScore);

                            // Line style follows how the relationship feels (AI-chosen vibe)
                            const vb = VIBE[vibeOf(p)];
                            const stroke = vb.hex;
                            const strokeDasharray = vb.dash;
                            const opacity = vb.dash === '0' ? 0.7 : 0.5;
                            const width = p.relationshipScore > 50 ? 2.5 : 1.5;

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
                        className="absolute w-16 h-16 rounded-full bg-md-primary text-md-on-primary text-sm font-semibold flex items-center justify-center z-10 ring-8 ring-md-primary/20 shadow-lg"
                        style={{ left: `${centerX}%`, top: `${centerY}%`, transform: 'translate(-50%, -50%)' }}
                    >
                        You
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
                                        className="relative -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-transform hover:scale-105"
                                    >
                                        <span
                                            className="w-12 h-12 rounded-full bg-md-surface-container-high flex items-center justify-center overflow-hidden shadow-md"
                                            style={{ boxShadow: `0 0 0 2px ${VIBE[vibeOf(p)].hex}` }}
                                        >
                                            {p.mugshot
                                                ? <img src={p.mugshot} alt="" className="w-full h-full object-cover" />
                                                : <span className="text-sm font-semibold text-md-on-surface">{p.name.charAt(0).toUpperCase()}</span>}
                                        </span>
                                        <span className="px-2 h-5 inline-flex items-center rounded-full bg-md-surface-container-highest text-[10px] font-medium text-md-on-surface max-w-[96px] truncate">{p.name.split(' ')[0]}</span>
                                        <span className="text-[9px] text-md-on-surface-variant max-w-[96px] truncate -mt-0.5">{roleEmoji(p)} {roleText(p)}</span>
                                        {p.alias && (
                                            <span className="absolute top-full mt-1 px-2 py-1 rounded-[8px] bg-md-surface-container-highest text-md-on-surface text-[11px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 shadow">
                                                {p.alias}
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {people.length === 0 && !isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-8">
                            <div className="mt-36 text-center">
                                <p className="text-sm font-medium text-md-on-surface">Your people will appear here</p>
                                <p className="text-xs text-md-on-surface-variant mt-1">Tap “Scan my chats” — Aastha maps the people you talk about. Private to you.</p>
                            </div>
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
