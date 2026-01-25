
import { Request, Response } from 'express';

import VoiceNote from '../models/VoiceNote';

export const storeAudio = async (id: string, buffer: Buffer) => {
    try {
        // Save to DB (Persistent)
        await VoiceNote.create({
            id,
            buffer
        });
    } catch (e) {
        console.error("Failed to store audio persistence:", e);
    }
};

export const getAudio = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const note = await VoiceNote.findOne({ id });

        if (!note) {
            return res.status(404).json({ message: "Audio expired or not found" });
        }

        // Serve correct headers
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', note.buffer.length);
        res.send(note.buffer);
    } catch (e) {
        console.error("Audio Fetch Error:", e);
        res.status(500).send("Error fetching audio");
    }
};
