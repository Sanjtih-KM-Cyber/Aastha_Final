import axios from 'axios';
import FormData from 'form-data';

// The URL of your deployed Hugging Face Space
// Defaulting to the live URL provided by the user
const BRAIN_URL = process.env.BRAIN_SERVER_URL || 'https://sking0123-aastha-voice.hf.space';

export const brainService = {
    /**
     * Generate Speech (TTS)
     * @param text The text to speak
     * @param voiceBuffer Optional: A buffer of a voice sample for Cloning (F5-TTS)
     * @param persona Optional: 'aastha' (Female) or 'aastik' (Male) - Defaults to 'aastha'
     * @returns Buffer of the generated audio (WAV)
     */
    generateSpeech: async (text: string, voiceBuffer?: Buffer, persona: string = 'aastha'): Promise<Buffer | null> => {
        try {
            const form = new FormData();
            form.append('text', text);
            
            // [UPDATED] Send the persona so the Python server knows which voice to pick
            form.append('voice_preset', persona);

            if (voiceBuffer) {
                form.append('voice_sample', voiceBuffer, { filename: 'sample.wav' });
            }

            const response = await axios.post(`${BRAIN_URL}/speak`, form, {
                headers: { ...form.getHeaders() },
                responseType: 'arraybuffer', // Critical for receiving binary audio
                validateStatus: (status) => status < 500 // Allow 400s to be caught manually if needed
            });

            // 1. Check Content-Type to avoid playing JSON errors as static
            const contentType = response.headers['content-type'];
            if (contentType && (contentType.includes('application/json') || contentType.includes('text/plain'))) {
                // It's an error message, not audio
                const errorText = Buffer.from(response.data).toString('utf-8');
                console.error("Brain TTS Server Error (Not Audio):", errorText);
                return null;
            }

            // 2. Check Buffer Size (Empty or too small files are invalid)
            const audioBuffer = Buffer.from(response.data);
            if (audioBuffer.length < 100) { // arbitrary small size check (WAV header is 44 bytes)
                console.error("Brain TTS Error: Received audio buffer too small.");
                return null;
            }

            return audioBuffer;
        } catch (error) {
            console.error("Brain TTS Error:", error);
            return null;
        }
    },

    /**
     * Describe Image (Vision)
     * @param imageBuffer Buffer of the image
     * @returns String caption
     */
    describeImage: async (imageBuffer: Buffer): Promise<string> => {
        try {
            const form = new FormData();
            form.append('image', imageBuffer, { filename: 'image.jpg' });

            const response = await axios.post(`${BRAIN_URL}/see`, form, {
                headers: { ...form.getHeaders() }
            });

            return response.data.caption || "I see something, but I'm not sure what.";
        } catch (error) {
            console.error("Brain Vision Error:", error);
            return "I couldn't analyze that image.";
        }
    }
};
