import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import connectDB from './db';
import authRoutes from './routes/authRoutes';
import chatRoutes from './routes/chatRoutes';
import dataRoutes from './routes/dataRoutes';
import aiRoutes from './routes/aiRoutes';

dotenv.config();

connectDB();

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from ANY origin in development to prevent IP blocking
    // In production, you would list specific domains.
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }) as any);
app.use(express.urlencoded({ limit: '50mb', extended: true }) as any);
app.use(cookieParser() as any);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
const chatLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

app.get('/health', (req: any, res: any) => {
  res.status(200).json({ status: 'Sanctuary is active', timestamp: new Date() });
});

app.use('/api/users', authLimiter as any, authRoutes);
app.use('/api/chat', chatLimiter as any, chatRoutes);
app.use('/api/ai', apiLimiter as any, aiRoutes);
app.use('/api/data', apiLimiter as any, dataRoutes); 

app.use((err: Error, req: any, res: any, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

const PORT = Number(process.env.PORT) || 5000;

// FIX: Bind to '0.0.0.0' to allow access via IP address (e.g. 192.168.x.x)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Accepting connections from network IPs.`);
});

export default app;