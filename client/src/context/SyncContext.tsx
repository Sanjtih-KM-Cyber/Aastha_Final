import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

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

  useEffect(() => {
    // STRICT CHECK: Do not attempt connection if user is missing or ID is undefined
    if (!user || !user._id) {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        return;
    }

    const userId = user._id; // Capture ID for closure

    // Determine WS URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Fix: In production, the API might be on a different domain than the frontend
    // If using the same domain (relative), use window.location.host
    // But if VITE_API_URL is set, we might need to parse it.
    // For now, assuming relative path for monorepo or specific hardcoded fallback if strictly needed.
    // Based on logs: wss://www.aasthaai.site/ws is failing.

    // Safer host detection
    let host = window.location.host;
    if (window.location.hostname === 'localhost') {
        host = 'localhost:5000';
    } else if (import.meta.env.VITE_API_URL) {
        // Attempt to extract host from API URL if possible, otherwise fallback to window.location
        try {
            const apiUrl = new URL(import.meta.env.VITE_API_URL);
            host = apiUrl.host;
        } catch (e) {
            console.warn("[Sync] Could not parse VITE_API_URL for WebSocket, falling back to window location.");
        }
    }

    const wsUrl = `${protocol}//${host}/ws?userId=${userId}`;

    const connect = () => {
        // Prevent multiple connections
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[Sync] Connected');
            setIsConnected(true);
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                const { type, payload } = message;
                const typeListeners = listenersRef.current.get(type);
                if (typeListeners) {
                    typeListeners.forEach(cb => cb(payload));
                }
            } catch (e) {
                console.error('[Sync] Parse error', e);
            }
        };

        ws.onclose = () => {
            console.log('[Sync] Disconnected.');
            setIsConnected(false);
            wsRef.current = null;

            // Only reconnect if user is still logged in
            if (user && user._id) {
                reconnectTimeoutRef.current = setTimeout(connect, 3000);
            }
        };

        ws.onerror = (err) => {
            console.error('[Sync] Error', err);
            ws.close();
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
