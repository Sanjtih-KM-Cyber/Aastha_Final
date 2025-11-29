import { useState, useCallback } from 'react';
import api from '../services/api';
import { useEncryption } from '../context/EncryptionContext';
import { DiaryEntryDTO, MoodEntryDTO } from '../services/userService';

// Re-using DTOs from userService or defining locally
export { type DiaryEntryDTO, type MoodEntryDTO };

export const useSanctuary = () => {
  const { encrypt, decrypt, isReady } = useEncryption();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- DIARY OPERATIONS ---

  const getDiaryEntries = useCallback(async (): Promise<DiaryEntryDTO[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/data/diary');
      const rawEntries: DiaryEntryDTO[] = res.data;

      // Decrypt on client side
      const decryptedEntries = rawEntries.map(entry => ({
        ...entry,
        title: decrypt(entry.title),
        content: decrypt(entry.content)
      }));

      return decryptedEntries;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to fetch diary';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [decrypt]);

  const saveDiaryEntry = useCallback(async (title: string, content: string, tags: string[] = []): Promise<DiaryEntryDTO> => {
    if (!isReady) throw new Error("Encryption keys not ready");
    
    setIsLoading(true);
    try {
      const encryptedTitle = encrypt(title);
      const encryptedContent = encrypt(content);

      const res = await api.post('/data/diary', {
        title: encryptedTitle,
        content: encryptedContent,
        tags
      });

      // Return the unencrypted version for UI update
      return {
        ...res.data,
        title: title,
        content: content
      };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to save entry';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [encrypt, isReady]);

  // --- MOOD OPERATIONS ---

  const logMood = useCallback(async (moodLabel: string): Promise<MoodEntryDTO> => {
    if (!isReady) throw new Error("Encryption keys not ready");

    setIsLoading(true);
    try {
      const encryptedMood = encrypt(moodLabel);
      const res = await api.post('/data/moods', { mood: encryptedMood });
      
      return {
        ...res.data,
        mood: moodLabel
      };
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [encrypt, isReady]);

  const getMoodHistory = useCallback(async (): Promise<MoodEntryDTO[]> => {
    try {
      const res = await api.get('/data/moods');
      // Logic could be added here to decrypt if we want to show history text
      // For now assume mapped back or just displaying icons based on strict types
      return res.data; 
    } catch (err) {
      console.error(err);
      return [];
    }
  }, []);

  return {
    isLoading,
    error,
    getDiaryEntries,
    saveDiaryEntry,
    logMood,
    getMoodHistory
  };
};