
import { Request, Response } from 'express';

// Simple in-memory cache for audio buffers (LRU-like behavior via Map insertion order)
// Key: uuid, Value: { buffer: Buffer, timestamp: number }
const audioCache = new Map<string, { buffer: Buffer, timestamp: number }>();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

export const storeAudio = (id: string, buffer: Buffer) => {
    // Evict old
    if (audioCache.size >= MAX_CACHE_SIZE) {
        const firstKey = audioCache.keys().next().value;
        if (firstKey) audioCache.delete(firstKey);
    }
    audioCache.set(id, { buffer, timestamp: Date.now() });
};

export const getAudio = (req: Request, res: Response) => {
    const { id } = req.params;
    const data = audioCache.get(id);

    if (!data) {
        return res.status(404).json({ message: "Audio expired or not found" });
    }

    // Serve correct headers
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', data.buffer.length);
    res.send(data.buffer);
};

// Periodic cleanup
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of audioCache.entries()) {
        if (now - val.timestamp > CACHE_TTL) {
            audioCache.delete(key);
        }
    }
}, 1000 * 60 * 5);
