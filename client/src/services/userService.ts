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
const OFFLINE_DIARY_KEY = 'offline_diary_queue';

export const userService = {
  // --- Diary ---
  async getDiaryEntries(): Promise<DiaryEntryDTO[]> {
    const res = await api.get('/data/diary');
    const serverEntries = res.data;

    // MERGE OFFLINE ENTRIES
    try {
        const queueRaw = localStorage.getItem(OFFLINE_DIARY_KEY);
        if (queueRaw) {
            const queue = JSON.parse(queueRaw);
            const offlineEntries = queue.map((q: any) => ({
                _id: q.tempId || `temp-${Date.now()}`,
                title: q.title,
                content: q.content,
                tags: q.tags,
                createdAt: q.date, // Use date as createdAt for sorting
                entryDate: q.date
            }));
            // Return combined (Server + Offline)
            return [...serverEntries, ...offlineEntries];
        }
    } catch (e) {
        console.error("Error merging offline diary", e);
    }

    return serverEntries;
  },

  async saveDiaryEntry(entry: { title: string; content: string; tags?: string[]; date?: string; moodKeywords?: string }): Promise<DiaryEntryDTO> {
    const res = await api.post('/data/diary', entry);
    return res.data;
  },

  async saveDiaryEntryWithRetry(entry: { title: string; content: string; tags?: string[]; date?: string; moodKeywords?: string }): Promise<DiaryEntryDTO> {
      try {
          const res = await api.post('/data/diary', entry);
          return res.data;
      } catch (error) {
          console.warn("API Failed, saving diary offline", error);

          // Create payload for queue
          const tempId = `temp-${Date.now()}`;
          const queuePayload = { ...entry, tempId };

          // Save to Queue
          const currentQueue = JSON.parse(localStorage.getItem(OFFLINE_DIARY_KEY) || '[]');
          currentQueue.push(queuePayload);
          localStorage.setItem(OFFLINE_DIARY_KEY, JSON.stringify(currentQueue));

          // Return compatible DTO
          return {
              _id: tempId,
              title: entry.title,
              content: entry.content,
              tags: entry.tags,
              createdAt: entry.date,
              entryDate: entry.date
          };
      }
  },

  async syncOfflineDiary(): Promise<void> {
      const queueRaw = localStorage.getItem(OFFLINE_DIARY_KEY);
      if (!queueRaw) return;

      const queue = JSON.parse(queueRaw);
      if (queue.length === 0) return;

      console.log(`Syncing ${queue.length} offline diary entries...`);
      const failed: any[] = [];

      for (const item of queue) {
          try {
              const { tempId, ...payload } = item;
              await api.post('/data/diary', payload);
          } catch (e) {
              console.error("Sync failed for diary entry", item, e);
              failed.push(item);
          }
      }

      if (failed.length > 0) {
          localStorage.setItem(OFFLINE_DIARY_KEY, JSON.stringify(failed));
      } else {
          localStorage.removeItem(OFFLINE_DIARY_KEY);
      }
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
              // We must preserve the timestamp since we updated the backend to support it
              await api.post('/data/moods', {
                  mood: entry.mood,
                  score: entry.score,
                  timestamp: entry.timestamp
              });
          } catch (e) {
              console.error("Sync failed for entry", entry, e);
              failed.push(entry); // Keep it in queue
          }
      }

      if (failed.length > 0) {
          localStorage.setItem(OFFLINE_MOOD_KEY, JSON.stringify(failed));
      } else {
          localStorage.removeItem(OFFLINE_MOOD_KEY);
          // SIGNAL UI TO REFRESH
          window.dispatchEvent(new Event('mood-synced'));
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
