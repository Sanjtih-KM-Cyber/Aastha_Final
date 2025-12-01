import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import connectDB from './db'; // assume you have this
import authRoutes from './routes/authRoutes';
import chatRoutes from './routes/chatRoutes';
import dataRoutes from './routes/dataRoutes';
import aiRoutes from './routes/aiRoutes';

dotenv.config();
connectDB();

const app = express();

app.set('trust proxy', 1);

// Accept a list of origins (add your domains)
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://192.168.56.1:3000', // your local IP if needed
  process.env.FRONTEND_URL || 'https://your-frontend.vercel.app',
];

app.use(cors({
  origin: (origin, callback) => {
    // allow no-origin (e.g. curl) and known origins
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) return callback(null, true);
    return callback(new Error('CORS not allowed'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With']
}));

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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
