import api from './api';

export interface DiaryEntryDTO {
  _id?: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
}

export interface MoodEntryDTO {
  _id?: string;
  mood: string;
  score: number;
  timestamp?: string;
}

export const userService = {
  // --- Diary ---
  async getDiaryEntries(): Promise<DiaryEntryDTO[]> {
    const res = await api.get('/data/diary');
    return res.data;
  },

  async saveDiaryEntry(entry: { title: string; content: string; tags?: string[]; date?: string }): Promise<DiaryEntryDTO> {
    const res = await api.post('/data/diary', entry);
    return res.data;
  },

  // --- Moods ---
  async getMoods(): Promise<MoodEntryDTO[]> {
    const res = await api.get('/data/moods');
    return res.data;
  },

  async saveMood(mood: string, score: number): Promise<MoodEntryDTO> {
    // Sends mood as plain string; server handles encryption
    const res = await api.post('/data/moods', { mood, score });
    return res.data;
  },

  // --- Analysis (Calls AI Controller) ---
  async analyzeDiary(): Promise<any[]> {
      const res = await api.get('/ai/analyze/diary');
      return res.data;
  },

  async analyzeChat(): Promise<{ result: string }> {
      const res = await api.get('/ai/analyze/chat');
      return res.data;
  }
};