import { Server } from 'http';
import { verifyJwt } from '../utils/jwtKeys';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import User from '../models/User';

let wss: WebSocketServer | null = null;
const clients = new Map<string, Set<WebSocket>>();

export const init = (server: Server) => {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        let isAuthenticated = false;
        let authenticatedUserId: string | null = null;

        const authTimeout = setTimeout(() => {
            if (!isAuthenticated) {
                ws.close(4001, 'Auth Timeout');
            }
        }, 5000);

        ws.on('message', async (message) => {
            try {
                const data = JSON.parse(message.toString());

                // AUTH HANDSHAKE
                if (!isAuthenticated) {
                    if (data.type === 'AUTH' && data.token && data.userId) {
                        try {
                            const decoded = verifyJwt(data.token) as any; // current or previous JWT secret

                            if (decoded.purpose || decoded.id !== data.userId) {
                                ws.close(4003, 'Forbidden: ID Mismatch');
                                return;
                            }

                            // Same revocation rule as HTTP `protect`
                            const owner = await User.findById(decoded.id).select('tokenVersion').lean();
                            if (!owner || (decoded.tv ?? 0) !== ((owner as any).tokenVersion ?? 0)) {
                                ws.close(4001, 'Invalid Token');
                                return;
                            }

                            isAuthenticated = true;
                            authenticatedUserId = data.userId;
                            clearTimeout(authTimeout);

                            if (!clients.has(authenticatedUserId!)) {
                                clients.set(authenticatedUserId!, new Set());
                            }
                            clients.get(authenticatedUserId!)?.add(ws);

                            // console.log(`[WS] Client authenticated: ${authenticatedUserId}`);
                            return;
                        } catch (e) {
                             ws.close(4001, 'Invalid Token');
                             return;
                        }
                    } else {
                        ws.close(4001, 'Protocol Error: First message must be AUTH');
                        return;
                    }
                }

                // ECHO MESSAGE (Legacy support if client relies on echo)
                // Ideally, clients shouldn't rely on echo for their own messages, but for multi-device sync
                // we might want to broadcast user messages to other devices.
                // For now, we only care about SERVER broadcasting.

            } catch (e) {
                console.error('[WS] Error processing message', e);
            }
        });

        ws.on('close', () => {
            if (authenticatedUserId) {
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
};

export const broadcast = (userId: string, type: string, payload: any) => {
    if (!wss) return;
    const userSockets = clients.get(userId);
    if (userSockets) {
        const message = JSON.stringify({ type, payload });
        userSockets.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
};
