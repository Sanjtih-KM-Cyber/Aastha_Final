import api from './api';

import { createOfflineQueue, isRetryable } from './offlineQueue';

export interface DiaryEntryDTO {
  _id?: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt?: string;
  entryDate?: string;
  moodKeywords?: string;
}

export interface MoodEntryDTO {
  _id?: string;
  mood: string;
  score: number;
  timestamp?: string;
}

type DiaryPayload = { title: string; content: string; tags?: string[]; date?: string; moodKeywords?: string };

const OFFLINE_MOOD_KEY = 'offline_mood_queue';
const OFFLINE_DIARY_KEY = 'offline_diary_queue';

// One queued version per diary day; moods keyed by their timestamp (7.1, no more retry storm)
const diaryQueue = createOfflineQueue<DiaryPayload>(OFFLINE_DIARY_KEY, {
  send: (p) => api.post('/data/diary', p),
});
const moodQueue = createOfflineQueue<MoodEntryDTO>(OFFLINE_MOOD_KEY, {
  send: (m) => api.post('/data/moods', { mood: m.mood, score: m.score, timestamp: m.timestamp }),
  onDrained: () => { try { window.dispatchEvent(new Event('mood-synced')); } catch { /* ignore */ } },
});
const diaryKey = (p: DiaryPayload) => (p.date || '').slice(0, 10) || 'undated';

export const userService = {
  // --- Diary ---
  async getDiaryEntries(): Promise<DiaryEntryDTO[]> {
    const res = await api.get('/data/diary');
    const serverEntries: DiaryEntryDTO[] = res.data;
    // Unsynced local versions win over the server copy of the same day
    const offline: DiaryEntryDTO[] = diaryQueue.items().map((q) => ({
      _id: `temp-${q.key}`,
      title: q.payload.title,
      content: q.payload.content,
      tags: q.payload.tags,
      createdAt: q.payload.date,
      entryDate: q.payload.date,
    }));
    return [...serverEntries, ...offline];
  },

  async saveDiaryEntry(entry: DiaryPayload): Promise<DiaryEntryDTO> {
    const res = await api.post('/data/diary', entry);
    return res.data;
  },

  async saveDiaryEntryWithRetry(entry: DiaryPayload): Promise<DiaryEntryDTO> {
      try {
          const res = await api.post('/data/diary', entry);
          diaryQueue.remove(diaryKey(entry)); // a newer version made it, drop any queued older one
          return res.data;
      } catch (error) {
          if (!isRetryable(error)) throw error; // real rejection (400/401/403/413), don't queue it forever
          console.warn("Diary save failed, keeping it on this device until we can sync");
          diaryQueue.enqueue(diaryKey(entry), entry);
          return {
              _id: `temp-${diaryKey(entry)}`,
              title: entry.title,
              content: entry.content,
              tags: entry.tags,
              createdAt: entry.date,
              entryDate: entry.date
          };
      }
  },

  /** Safe to call often: single-flight + persisted backoff (30 s → 30 min). */
  syncOfflineDiary(force = false): Promise<void> {
      return diaryQueue.sync(force);
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
          const res = await api.post('/data/moods', { mood, score });
          return res.data;
      } catch (error) {
          if (!isRetryable(error)) throw error;
          const tempEntry: MoodEntryDTO = { _id: `temp-${Date.now()}`, mood, score, timestamp: new Date().toISOString() };
          moodQueue.enqueue(tempEntry.timestamp!, tempEntry);
          return tempEntry;
      }
  },

  syncOfflineMoods(force = false): Promise<void> {
      return moodQueue.sync(force);
  },

  // Helper to merge Server + Offline for UI
  getCombinedMoodHistory(serverHistory: MoodEntryDTO[]): MoodEntryDTO[] {
      const queue: MoodEntryDTO[] = moodQueue.items().map(i => i.payload);
      if (!queue.length) return serverHistory;
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
