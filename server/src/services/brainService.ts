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
     * @returns Buffer of the generated audio (WAV)
     */
    generateSpeech: async (text: string, voiceBuffer?: Buffer): Promise<Buffer | null> => {
        try {
            const form = new FormData();
            form.append('text', text);

            if (voiceBuffer) {
                form.append('voice_sample', voiceBuffer, { filename: 'sample.wav' });
            }

            const response = await axios.post(`${BRAIN_URL}/speak`, form, {
                headers: { ...form.getHeaders() },
                responseType: 'arraybuffer' // Critical for receiving binary audio
            });

            return Buffer.from(response.data);
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
