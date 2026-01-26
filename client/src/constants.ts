// client/src/constants.ts

export const SECURITY_QUESTIONS = [
  "What song instantly resets your vibe?",
  "Which place feels like your safe corner?",
  "Who is your comfort character?",
  "What color is your calm?",
  "Your go-to midnight snack?",
  "Which meme always makes you smile?",
  "First app you open every morning?",
  "Your rainy-day movie?",
  "What phrase gets you back on track?"
];

export const MOOD_DATA = {
  Happy: { emoji: '🤩', color: '#FCD34D', label: 'Radiant' },
  Sad: { emoji: '🌧️', color: '#60A5FA', label: 'Heavy' },
  Calm: { emoji: '😌', color: '#34D399', label: 'Peaceful' },
  Anxious: { emoji: '😰', color: '#A78BFA', label: 'Jittery' },
  Energetic: { emoji: '⚡', color: '#F87171', label: 'Charged' },
  Stressed: { emoji: '🤯', color: '#FB923C', label: 'Overloaded' },
  Anger: { emoji: '😡', color: '#EF4444', label: 'Fiery' },
  Neutral: { emoji: '😐', color: '#9CA3AF', label: 'Balanced' }
};

export const ACCENT_COLORS = {
  Aastha: '#2dd4bf', // Teal
  Sky: '#38bdf8',
  Rose: '#fb7185',
  Violet: '#a78bfa',
  Amber: '#fbbf24',
  Emerald: '#34d399',
  Indigo: '#818cf8',
  Slate: '#94a3b8'
};

export const POSITIVE_EMOJIS = ['✨', '🌿', '💪', '💜', '🔥', '🚀', '🌈', '☀️', '🌻', '🧘‍♀️'];

// ✅ MERGED: Comprehensive list including regional languages
export const LANGUAGES = [
  "English", "Hindi", "Hinglish", "Tamil", "Telugu", 
  "Punjabi", "Malayalam", "Kannada", "Bengali", "Marathi",
  "Spanish", "French", "German", "Japanese", "Mandarin"
];

// ✅ MOVED: Music Widget Constants (Prevents Circular Deps)
export const MOOD_TAGS = ["Happy", "Sad", "Calm", "Energetic", "Romantic", "Focus", "Melancholy", "Party", "Lo-Fi"];
export const GENRES = ["Lo-Fi", "Hip-Hop", "Pop", "Retro", "90s", "Modern", "Indie", "R&B", "Jazz", "Classical", "Rock", "Bollywood", "Acoustic", "EDM", "Ambient"];

// ✅ ADDED: Type Definition for Loop Mode
export type LoopMode = 'off' | 'all' | 'one' | 'custom';

// --- AUTH EVENTS ---
export const AUTH_UNAUTHORIZED_EVENT = 'auth:unauthorized';

export const SOUND_URLS = {
  birds: 'https://xuiodzjst7u2lxlz.public.blob.vercel-storage.com/birds.mp3',
  fire: 'https://xuiodzjst7u2lxlz.public.blob.vercel-storage.com/fire.mp3',
  forest: 'https://xuiodzjst7u2lxlz.public.blob.vercel-storage.com/forest.mp3',
  night: 'https://xuiodzjst7u2lxlz.public.blob.vercel-storage.com/night.mp3',
  ocean: 'https://xuiodzjst7u2lxlz.public.blob.vercel-storage.com/ocean.mp3',
  rain: 'https://xuiodzjst7u2lxlz.public.blob.vercel-storage.com/rain.mp3',
  storm2: 'https://xuiodzjst7u2lxlz.public.blob.vercel-storage.com/storm2.mp3',
  thunder: 'https://xuiodzjst7u2lxlz.public.blob.vercel-storage.com/storm2.mp3',
  wind: 'https://xuiodzjst7u2lxlz.public.blob.vercel-storage.com/wind.mp3'
};
