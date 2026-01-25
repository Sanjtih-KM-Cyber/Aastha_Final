import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Capacitor } from '@capacitor/core';

type SyncListener = (payload: any) => void;

interface SyncContextType {
  isConnected: boolean;
  emit: (event: string, data: any) => void;
  subscribe: (event: string, callback: SyncListener) => () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<SyncListener>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Backoff State
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 5;
  const BASE_DELAY = 1000;

  useEffect(() => {
    // STRICT CHECK: Do not attempt connection if user is missing or ID is undefined
    if (!user || !user._id) {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        retryCountRef.current = 0; // Reset retries
        return;
    }

    const userId = user._id; // Capture ID for closure

    // 1. GET THE TOKEN (The Fix)
    // We need to send the token in the URL because WebSockets don't support headers
    // PRIORITY: Check Session Storage first (Current Tab), then Local Storage (Persistence)
    let token = '';
    try {
        const storedInfo = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo');
        if (storedInfo) {
            const parsed = JSON.parse(storedInfo);
            token = parsed.token || '';
        }
    } catch (e) {
        console.error("Error reading token for WS", e);
    }

    // Determine WS URL
    let protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = window.location.host;

    // FIX: Capacitor needs explicit remote URL, otherwise it tries ws://localhost
    if (Capacitor.isNativePlatform()) {
        host = 'aastha-final.onrender.com';
        protocol = 'wss:';
    } else if (window.location.hostname === 'localhost') {
        host = 'localhost:5000';
    } else if (import.meta.env.VITE_API_URL) {
        try {
            const apiUrl = new URL(import.meta.env.VITE_API_URL);
            host = apiUrl.host;
        } catch (e) {
            console.warn("[Sync] Could not parse VITE_API_URL for WebSocket, falling back to window location.");
        }
    }

    // 2. REMOVE TOKEN FROM URL (Security Fix)
    // Auth is now done via the first message handshake
    const wsUrl = `${protocol}//${host}/ws`;

    const connect = () => {
        // Prevent multiple connections
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

        // STRICT CHECK: Token is mandatory
        if (!token) {
             console.warn("[Sync] No token available. Aborting connection.");
             return;
        }

        console.log(`[Sync] Connecting to WS...`);
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[Sync] Connected. Sending Handshake...');
            // AUTH HANDSHAKE
            ws.send(JSON.stringify({ type: 'AUTH', token: token, userId: userId }));
            setIsConnected(true);
            retryCountRef.current = 0; // Reset retries on successful connection
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                // Debug log to see if the message is actually arriving
                // console.log("[Sync] Received:", message);

                const { type, payload } = message;
                const typeListeners = listenersRef.current.get(type);
                if (typeListeners) {
                    typeListeners.forEach(cb => cb(payload));
                }
            } catch (e) {
                console.error('[Sync] Parse error', e);
            }
        };

        ws.onclose = (event) => {
            console.log(`[Sync] Disconnected. Code: ${event.code}`);
            setIsConnected(false);
            wsRef.current = null;

            // Auth Failures (4xxx) -> Do Not Retry
            if (event.code >= 4000 && event.code < 5000) {
                console.warn("[Sync] Auth failed or fatal error. Not reconnecting.");
                return;
            }

            // Normal Closure (1000) or Going Away (1001) or No Status (1005)
            // We implement Exponential Backoff
            // STRICTER RETRY: Only retry if we actually have a token
            if (user && user._id && token) {
                if (retryCountRef.current < MAX_RETRIES) {
                    const delay = Math.min(10000, BASE_DELAY * Math.pow(2, retryCountRef.current));
                    console.log(`[Sync] Reconnecting in ${delay}ms (Attempt ${retryCountRef.current + 1}/${MAX_RETRIES})...`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        retryCountRef.current++;
                        connect();
                    }, delay);
                } else {
                    console.error("[Sync] Max retries reached. Giving up.");
                }
            }
        };

        ws.onerror = (err) => {
            console.error('[Sync] Error', err);
            // Don't close here, let onclose handle cleanup
        };

        wsRef.current = ws;
    };

    connect();

    return () => {
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (wsRef.current) {
            wsRef.current.onclose = null; // Prevent reconnect loop on unmount
            wsRef.current.close();
        }
    };
  }, [user]); // Re-run if user changes

  const emit = (event: string, data: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: event, payload: data }));
      }
  };

  const subscribe = (event: string, callback: SyncListener) => {
      if (!listenersRef.current.has(event)) {
          listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)?.add(callback);

      return () => {
          listenersRef.current.get(event)?.delete(callback);
      };
  };

  return (
    <SyncContext.Provider value={{ isConnected, emit, subscribe }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used within SyncProvider");
  return context;
};
