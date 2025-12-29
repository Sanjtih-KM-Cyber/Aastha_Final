import dotenv from 'dotenv';
dotenv.config(); // Must be first to ensure env vars are loaded before imports

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import compression from 'compression'; // Performance boost
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken'; // ✅ REQUIRED IMPORT
import connectDB from './db'; 
import authRoutes from './routes/authRoutes';
import chatRoutes from './routes/chatRoutes';
import dataRoutes from './routes/dataRoutes';
import aiRoutes from './routes/aiRoutes';

// --- CRITICAL SECURITY CHECK ---
const requiredEnvVars = ['JWT_SECRET', 'SERVER_ENCRYPTION_KEY', 'MONGO_URI'];
const missingVars = requiredEnvVars.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error(`FATAL ERROR: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1); // Stop the server immediately
}

connectDB();

const app = express();
const server = createServer(app);

// --- REAL-TIME SYNC ENGINE (SECURED) ---
const wss = new WebSocketServer({ server, path: '/ws' });
// Support multiple devices per user: userId -> Set<WebSocket>
const clients = new Map<string, Set<WebSocket>>();

wss.on('connection', (ws, req) => {
    // Extract userId AND token from query params
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');
    const token = url.searchParams.get('token'); // ✅ Get Token

    // 1. Validation: Must have both ID and Token
    if (!userId || !token) {
        console.log('[WS] Connection rejected: Missing credentials');
        ws.close(4001, 'Unauthorized: Missing credentials');
        return;
    }

    // 2. Security: Verify Token
    try {
        const secret = process.env.JWT_SECRET as string;
        const decoded = jwt.verify(token, secret) as any;
        
        // 3. ID Match: Ensure the token actually belongs to the user asking for connection
        if (decoded.id !== userId) {
             console.log(`[WS] Security Alert: ID Mismatch. Token(${decoded.id}) vs Req(${userId})`);
             ws.close(4003, 'Forbidden: ID Mismatch');
             return;
        }

        // --- AUTH SUCCESSFUL ---
        
        // Add to client set
        if (!clients.has(userId)) {
            clients.set(userId, new Set());
        }
        clients.get(userId)?.add(ws);

        console.log(`[WS] Client connected: ${userId}. Active devices: ${clients.get(userId)?.size}`);

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                // console.log(`[WS] Broadcast from ${userId}:`, data.type); // Optional: Uncomment for debug

                // Broadcast to ALL other devices belonging to this user
                const userSockets = clients.get(userId);
                if (userSockets) {
                    userSockets.forEach(client => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(data));
                        }
                    });
                }
            } catch (e) {
                console.error('[WS] Error processing message', e);
            }
        });

        ws.on('close', () => {
            console.log(`[WS] Client disconnected: ${userId}`);
            const userSockets = clients.get(userId);
            if (userSockets) {
                userSockets.delete(ws);
                if (userSockets.size === 0) {
                    clients.delete(userId);
                }
            }
        });

    } catch (err) {
        console.error('[WS] Auth Failed: Invalid Token');
        ws.close(4001, 'Unauthorized: Invalid Token');
        return;
    }
});

// --- DEFENSE IN DEPTH ---
app.disable('x-powered-by'); // Hide the Tech Stack

app.set('trust proxy', 1);

// Accept a list of origins (add your domains)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'https://aasthafv2.vercel.app',   // optional: keep for testing
  'https://aasthaai.site',          // ✅ NEW DOMAIN
  'https://www.aasthaai.site',      // ✅ WWW
  process.env.FRONTEND_URL || '',
];


app.use(cors({
  origin: (origin, callback) => {
    // allow no-origin (e.g. curl) and known origins
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) return callback(null, true);

    console.log('Blocked CORS origin:', origin);
    return callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With']
}));

app.use(compression()); // Compress all responses
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
