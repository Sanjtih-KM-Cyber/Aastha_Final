import dotenv from 'dotenv';
dotenv.config(); // Must be first to ensure env vars are loaded before imports

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression'; // Performance boost
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken'; // ✅ REQUIRED IMPORT
import connectDB from './db'; 
import authRoutes from './routes/authRoutes';
import chatRoutes from './routes/chatRoutes';
import dataRoutes from './routes/dataRoutes';
import aiRoutes from './routes/aiRoutes';
import * as ghostService from './services/ghostService';

// --- CRITICAL SECURITY CHECK ---
const requiredEnvVars = ['JWT_SECRET', 'SERVER_ENCRYPTION_KEY', 'MONGO_URI'];
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error(`FATAL ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1); // Stop the server immediately
}

connectDB();

// Init Ghost Service
ghostService.init();

const app = express();
const server = createServer(app);

// --- REAL-TIME SYNC ENGINE (SECURED) ---
const wss = new WebSocketServer({ server, path: '/ws' });
// Support multiple devices per user: userId -> Set<WebSocket>
const clients = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws, req) => {
    let isAuthenticated = false;
    let authenticatedUserId: string | null = null;

    // Timeout: If auth not received in 5s, close.
    const authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
            console.log('[WS] Auth timeout, closing.');
            ws.close(4001, 'Auth Timeout');
        }
    }, 5000);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());

            // --- AUTH HANDSHAKE ---
            if (!isAuthenticated) {
                if (data.type === 'AUTH' && data.token && data.userId) {
                    try {
                        const secret = process.env.JWT_SECRET as string;
                        const decoded = jwt.verify(data.token, secret) as any;

                        if (decoded.id !== data.userId) {
                            console.log(`[WS] Security Alert: ID Mismatch.`);
                            ws.close(4003, 'Forbidden: ID Mismatch');
                            return;
                        }

                        // Success
                        isAuthenticated = true;
                        authenticatedUserId = data.userId;
                        clearTimeout(authTimeout);

                        // Add to client set
                        if (!clients.has(authenticatedUserId!)) {
                            clients.set(authenticatedUserId!, new Set());
                        }
                        clients.get(authenticatedUserId!)?.add(ws);

                        console.log(`[WS] Client authenticated: ${authenticatedUserId}`);
                        return; // Handshake complete, don't broadcast this message
                    } catch (e) {
                         console.error('[WS] Invalid Token');
                         ws.close(4001, 'Invalid Token');
                         return;
                    }
                } else {
                    // First message MUST be AUTH
                    console.log('[WS] First message not AUTH, closing.');
                    ws.close(4001, 'Protocol Error: First message must be AUTH');
                    return;
                }
            }

            // --- NORMAL MESSAGES ---
            if (isAuthenticated && authenticatedUserId) {
                const userSockets = clients.get(authenticatedUserId);
                if (userSockets) {
                    userSockets.forEach(client => {
                        if (client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(data));
                        }
                    });
                }
            }

        } catch (e) {
            console.error('[WS] Error processing message', e);
        }
    });

    ws.on('close', () => {
        if (authenticatedUserId) {
            console.log(`[WS] Client disconnected: ${authenticatedUserId}`);
            const userSockets = clients.get(authenticatedUserId);
            if (userSockets) {
                userSockets.delete(ws);
                if (userSockets.size === 0) {
                    clients.delete(authenticatedUserId);
                }
            }
        }
    });
});

// --- DEFENSE IN DEPTH ---
app.disable('x-powered-by'); // Hide the Tech Stack
app.set('trust proxy', 1);

// HELMET - Content Security Policy
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // ✅ FIX: Added YouTube and ytimg to scripts
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.razorpay.com", "https://www.youtube.com", "https://s.ytimg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      // ✅ FIX: Added YouTube to connectSrc
      connectSrc: ["'self'", "ws:", "wss:", "https://aasthaai.site", "https://aastha-final.onrender.com", "http://localhost:*", "https://lumberjack.razorpay.com", "https://www.youtube.com"],
      // ✅ FIX: Added YouTube thumbnails to imgSrc
      imgSrc: ["'self'", "data:", "https:", "blob:", "https://i.ytimg.com", "https://www.youtube.com"],
      // ✅ FIX: Added YouTube to frameSrc (Critical for Widget)
      frameSrc: ["'self'", "https://api.razorpay.com", "https://www.youtube.com", "https://youtube.com"],
      upgradeInsecureRequests: null,
    }
  },
  crossOriginEmbedderPolicy: false
}));

// Accept a list of origins (add your domains)
const allowedOrigins = [
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
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With']
}));

app.use(compression()); // Compress all responses
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok', ts: new Date() }));

// Mount routers
app.use('/api/users', authLimiter, authRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/ai', apiLimiter, aiRoutes);
app.use('/api/data', apiLimiter, dataRoutes);

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

const PORT = Number(process.env.PORT) || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
