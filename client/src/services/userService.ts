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

const OFFLINE_MOOD_KEY = 'offline_mood_queue';

export const userService = {
  // --- Diary ---
  async getDiaryEntries(): Promise<DiaryEntryDTO[]> {
    const res = await api.get('/data/diary');
    return res.data;
  },

  async saveDiaryEntry(entry: { title: string; content: string; tags?: string[]; date?: string; moodKeywords?: string }): Promise<DiaryEntryDTO> {
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

  // --- Offline Robustness ---
  async saveMoodWithRetry(mood: string, score: number): Promise<MoodEntryDTO> {
      try {
          // Try Online First
          const res = await api.post('/data/moods', { mood, score });
          return res.data;
      } catch (error) {
          console.warn("API Failed, saving mood offline", error);
          // Create a temp object
          const tempEntry: MoodEntryDTO = {
              _id: `temp-${Date.now()}`,
              mood,
              score,
              timestamp: new Date().toISOString()
          };

          // Save to LocalStorage Queue
          const currentQueue = JSON.parse(localStorage.getItem(OFFLINE_MOOD_KEY) || '[]');
          currentQueue.push(tempEntry);
          localStorage.setItem(OFFLINE_MOOD_KEY, JSON.stringify(currentQueue));

          // Return as if successful (Optimistic)
          return tempEntry;
      }
  },

  async syncOfflineMoods(): Promise<void> {
      const queueRaw = localStorage.getItem(OFFLINE_MOOD_KEY);
      if (!queueRaw) return;

      const queue: MoodEntryDTO[] = JSON.parse(queueRaw);
      if (queue.length === 0) return;

      console.log(`Syncing ${queue.length} offline moods...`);

      const failed: MoodEntryDTO[] = [];

      for (const entry of queue) {
          try {
              // We discard the temp ID and let server assign new one
              // We must preserve the timestamp if the backend supports it (assuming backend defaults to 'now' if not provided, which is okay for casual tracking, or we update backend DTO)
              // For now, we accept 'now' as the timestamp of sync, or we could pass createdAt if backend allows.
              // Given the constraints, just syncing is better than nothing.
              await api.post('/data/moods', { mood: entry.mood, score: entry.score, createdAt: entry.timestamp });
          } catch (e) {
              console.error("Sync failed for entry", entry, e);
              failed.push(entry); // Keep it in queue
          }
      }

      if (failed.length > 0) {
          localStorage.setItem(OFFLINE_MOOD_KEY, JSON.stringify(failed));
      } else {
          localStorage.removeItem(OFFLINE_MOOD_KEY);
      }
  },

  // Helper to merge Server + Offline for UI
  getCombinedMoodHistory(serverHistory: MoodEntryDTO[]): MoodEntryDTO[] {
      const queueRaw = localStorage.getItem(OFFLINE_MOOD_KEY);
      if (!queueRaw) return serverHistory;

      const queue: MoodEntryDTO[] = JSON.parse(queueRaw);
      // Combine and Sort by timestamp
      const combined = [...serverHistory, ...queue];
      combined.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

      return combined;
  },

  // --- Analysis (Calls AI Controller) ---
  async analyzeDiary(payload?: { content: string }): Promise<{ analysis: string }> {
    const res = await api.post('/ai/analyze-diary', payload);
      return res.data;
  },

  async analyzeChat(): Promise<{ result: string }> {
      const res = await api.get('/ai/analyze/chat');
      return res.data;
  },

  // --- Fortress Bridge ---
  async verifyDiaryPassword(password: string): Promise<{ success: boolean }> {
      const res = await api.post('/users/verify-diary-password', { password });
      return res.data;
  }
};
