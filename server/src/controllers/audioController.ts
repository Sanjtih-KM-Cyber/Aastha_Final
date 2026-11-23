
import { Request, Response } from 'express';

import VoiceNote from '../models/VoiceNote';
import { encrypt, decrypt } from '../utils/serverEncryption';

/** Audio types we accept from the user's own voice recordings (MediaRecorder output on Android/iOS/desktop). */
export const USER_AUDIO_TYPES: Record<string, string> = {
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a',
};
export const MAX_USER_AUDIO_BYTES = 2 * 1024 * 1024; // ~2 min of opus; the client caps recordings at 2 min

/** `data:audio/webm;codecs=opus;base64,...` → { buffer, mime, ext } or null if not an accepted audio type / too big. */
export const parseAudioDataUrl = (dataUrl: unknown): { buffer: Buffer; mime: string; ext: string } | null => {
    if (typeof dataUrl !== 'string') return null;
    const m = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(?:;[^,]*)?,(.*)$/i.exec(dataUrl.slice(0, 200) + '');
    if (!m) return null;
    const mime = m[1].toLowerCase();
    const ext = USER_AUDIO_TYPES[mime];
    if (!ext || !/;base64,/i.test(dataUrl.slice(0, 200))) return null;
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    if (b64.length > Math.ceil(MAX_USER_AUDIO_BYTES * 4 / 3) + 8) return null;
    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length || buffer.length > MAX_USER_AUDIO_BYTES) return null;
    return { buffer, mime, ext };
};

export const storeAudio = async (id: string, buffer: Buffer, user?: any, opts: { encrypt?: boolean; mime?: string } = {}) => {
    opts = { ...opts, encrypt: true }; // ALL audio is encrypted at rest (user recordings AND Aastha's TTS replies)
    try {
        // Linked to its owner so account deletion removes it (auto-expires after 30 days anyway)
        await VoiceNote.create({
            id,
            user,
            buffer: opts.encrypt ? Buffer.from(encrypt(buffer.toString('base64')), 'utf8') : buffer,
            encrypted: !!opts.encrypt,
            mime: opts.mime,
        });
        return true;
    } catch (e) {
        console.error("Failed to store audio persistence:", e);
        return false;
    }
};

/** Decoded audio bytes of a stored note (decrypts user recordings). */
export const readAudio = (note: any): Buffer => {
    const buf: Buffer = note.buffer as any;
    if (!note.encrypted) return buf;
    return Buffer.from(decrypt(buf.toString('utf8')), 'base64');
};

export const getAudio = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const note = await VoiceNote.findOne({ id });

        if (!note) {
            return res.status(404).json({ message: "Audio expired or not found" });
        }

        // Range support: without it browsers can't seek/scrub inside the note (they restart from 0).
        const buf: Buffer = readAudio(note);
        const total = buf.length;
        res.setHeader('Content-Type', (note as any).mime || 'audio/wav');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'private, max-age=86400, immutable'); // ids are unique UUIDs
        const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || '').trim());
        if (range && (range[1] || range[2])) {
            let start = range[1] ? parseInt(range[1], 10) : Math.max(0, total - parseInt(range[2], 10)); // suffix range
            let end = range[1] && range[2] ? parseInt(range[2], 10) : total - 1;
            end = Math.min(end, total - 1);
            if (isNaN(start) || start > end || start >= total) {
                res.setHeader('Content-Range', `bytes */${total}`);
                return res.status(416).end();
            }
            res.status(206);
            res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
            res.setHeader('Content-Length', end - start + 1);
            return res.end(buf.subarray(start, end + 1));
        }
        res.setHeader('Content-Length', total);
        res.end(buf);
    } catch (e) {
        console.error("Audio Fetch Error:", e);
        res.status(500).send("Error fetching audio");
    }
};
