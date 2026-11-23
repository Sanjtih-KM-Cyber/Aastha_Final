import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MAX_DELAY_MS = 30_000;
let listenersAttached = false;

const attachListeners = () => {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('disconnected', () => console.warn('[MongoDB] Disconnected — driver will retry automatically.'));
  mongoose.connection.on('reconnected', () => console.log('[MongoDB] Reconnected.'));
  mongoose.connection.on('error', (err) => console.error('[MongoDB] Connection error:', err.message));
};

/**
 * Connects to MongoDB and keeps retrying with backoff instead of killing the process.
 * A brief Atlas/network blip should never take the whole API down (and trigger Render failure emails).
 */
const connectDB = async (attempt = 1): Promise<void> => {
  attachListeners();
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || '', {
      serverSelectionTimeoutMS: 10_000,
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
  } catch (error: any) {
    const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_DELAY_MS);
    console.error(`[MongoDB] Connect attempt ${attempt} failed: ${error.message}. Retrying in ${delay / 1000}s.`);
    setTimeout(() => {
      connectDB(attempt + 1).catch(() => {});
    }, delay);
  }
};

export const isDbReady = () => mongoose.connection.readyState === 1;

export default connectDB;
