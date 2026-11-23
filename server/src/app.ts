import dotenv from 'dotenv';
dotenv.config(); // Must be first to ensure env vars are loaded before imports
import { captureError, flushMonitoring } from './monitoring'; // crash reporting (off without SENTRY_DSN)

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression'; // Performance boost
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken'; // ✅ REQUIRED IMPORT
import mongoose from 'mongoose';
import connectDB, { isDbReady } from './db';
import { scheduleKeyRotation } from './services/keyRotation';
import authRoutes from './routes/authRoutes';
import chatRoutes from './routes/chatRoutes';
import dataRoutes from './routes/dataRoutes';
import aiRoutes from './routes/aiRoutes';
import * as ghostService from './services/ghostService';
import * as socketService from './services/socketService';

// --- CRITICAL SECURITY CHECK ---
const requiredEnvVars = ['JWT_SECRET', 'SERVER_ENCRYPTION_KEY', 'MONGO_URI'];
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error(`FATAL ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1); // Stop the server immediately
}

// --- PROCESS SAFETY NET (stops stray async errors from killing the API) ---
process.on('unhandledRejection', (reason) => {
    // Log and keep serving: a failed background promise (memory, email, donation) must not take the API down.
    console.error('[Process] Unhandled promise rejection:', reason);
    captureError(reason, { kind: 'unhandledRejection' });
});

process.on('uncaughtException', (err) => {
    // State may be corrupt after a synchronous throw: log, close gracefully, let Render restart us.
    console.error('[Process] Uncaught exception — shutting down gracefully:', err);
    captureError(err, { kind: 'uncaughtException' });
    flushMonitoring().finally(() => shutdown(1));
});

connectDB();
scheduleKeyRotation(); // re-encrypts stored data onto the current keys after a rotation (services/keyRotation.ts)

// Init Ghost Service (This line caused the error before because ghostService.ts was outdated)
ghostService.init();

const app = express();
const server = createServer(app);

// --- REAL-TIME SYNC ENGINE (SECURED) ---
socketService.init(server);

// --- DEFENSE IN DEPTH ---
app.disable('x-powered-by'); // Hide the Tech Stack
app.set('trust proxy', 1);

// HELMET - Content Security Policy
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // ✅ FIX: Removed unsafe-inline for scripts. Allowed 'self', YouTube, Razorpay.
      scriptSrc: ["'self'", "'unsafe-eval'", "https://checkout.razorpay.com", "https://www.youtube.com", "https://s.ytimg.com"],
      // ✅ KEEP: unsafe-inline for styles (React dynamic styling)
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      // ✅ FIX: Added ws: wss: for WebSocket. Kept YouTube, Brain Server.
      connectSrc: [
          "'self'",
          "ws:", "wss:",
          "https://aasthaai.site",
          "https://aastha-final.onrender.com",
          "http://localhost:*",
          "https://lumberjack.razorpay.com",
          "https://www.youtube.com",
          "https://sking0123-aastha-voice.hf.space"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:", "https://i.ytimg.com", "https://www.youtube.com"],
      frameSrc: ["'self'", "https://api.razorpay.com", "https://www.youtube.com", "https://youtube.com"],
      upgradeInsecureRequests: null,
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Accept a list of origins (add your domains)
const allowedOrigins = [
  'http://localhost',             // ✅ Android Capacitor App
  'https://localhost',            // ✅ iOS Capacitor App
  'capacitor://localhost',        // ✅ Native Capacitor Scheme
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'https://aasthafv2.vercel.app',   // optional: keep for testing
  'https://aasthaai.site',          // ✅ NEW DOMAIN
  'https://www.aasthaai.site',      // ✅ WWW
  'https://aastha-final.onrender.com', // ✅ Render Backend
  process.env.FRONTEND_URL || '',
];


app.use(cors({
  origin: (origin, callback) => {
    // allow no-origin (e.g. curl) and known origins
    if (!origin) return callback(null, true);

    // Check allowed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Allow vercel previews ONLY for this project
    if (origin.endsWith('.vercel.app') && origin.includes('aastha')) {
      return callback(null, true);
    }

    console.log('Blocked CORS origin:', origin);
    return callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','X-Time-Zone'],
  exposedHeaders: ['X-Has-More']
}));

app.use(compression()); // Compress all responses
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

// --- FAULT TOLERANT RATE LIMITING ---
let limiterStore: RedisStore | undefined;

if (process.env.REDIS_URL) {
    console.log("Using Redis for Rate Limiting");
    const redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1, // Fail fast if Redis is down initially
        enableOfflineQueue: false, // ✅ FAIL FAST: Do not hang request if Redis is down
        commandTimeout: 2000,      // ✅ TIMEOUT: Kill command after 2s
        connectTimeout: 10000,     // ✅ TIMEOUT: Kill connection attempt after 10s
        retryStrategy: (times) => {
            if (times > 3) {
                console.error("[Redis] Connection failed. Fallback to memory store.");
                return null; // Stop retrying
            }
            return Math.min(times * 50, 2000);
        }
    });

    redisClient.on('error', (err) => {
        console.error('[Redis] Error:', err.message);
    });

    limiterStore = new RedisStore({
        // @ts-ignore
        sendCommand: (...args: string[]) => redisClient.call(...args),
    });
} else {
    console.log("Redis not found. Using Memory Store for Rate Limiting.");
    limiterStore = undefined; // Default is MemoryStore
}

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: limiterStore
});

const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: limiterStore
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    store: limiterStore
});

// Always 200 so a DB blip doesn't make Render restart the service; `db` shows real state.
app.get('/health', (_req: Request, res: Response) =>
  res.json({ status: 'ok', db: isDbReady() ? 'up' : 'reconnecting', ts: new Date() })
);

// Mount routers
app.use('/api/users', authLimiter, authRoutes);
// Only SENDING a message counts against the chat limit; history reads use the general API limit.
// (Before, history refetches on every tab switch ate the 20/min chat budget → users' messages got 429.)
app.use('/api/chat', (req, res, next) => (req.method === 'POST' ? chatLimiter(req, res, next) : apiLimiter(req, res, next)), chatRoutes);
app.use('/api/ai', apiLimiter, aiRoutes);
app.use('/api/data', apiLimiter, dataRoutes);

// Error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  captureError(err, { route: String(req.baseUrl || '') + String(req.route?.path || '') });
  // Never leak internal error details to clients
  if (res.headersSent) return;
  res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = Number(process.env.PORT) || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// --- GRACEFUL SHUTDOWN (Render sends SIGTERM on deploys/restarts) ---
let shuttingDown = false;
function shutdown(code: number) {
    if (shuttingDown) return;
    shuttingDown = true;
    // Hard stop if graceful close hangs
    setTimeout(() => process.exit(code), 10_000).unref();
    try {
        server.close(() => {
            mongoose.connection.close().finally(() => process.exit(code));
        });
    } catch {
        process.exit(code);
    }
}

process.on('SIGTERM', () => {
    console.log('[Process] SIGTERM received — closing gracefully.');
    shutdown(0);
});

export default app;
