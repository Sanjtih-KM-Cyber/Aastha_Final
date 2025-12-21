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

  useEffect(() => {
    if (!user) return;

    // Determine WS URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:5000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws?userId=${user.id}`;

    const connect = () => {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[Sync] Connected');
            setIsConnected(true);
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
            console.log('[Sync] Disconnected. Reconnecting...');
            setIsConnected(false);
            setTimeout(connect, 3000);
        };

        ws.onerror = (err) => {
            console.error('[Sync] Error', err);
            ws.close();
        };

        wsRef.current = ws;
    };

    connect();

    return () => {
        wsRef.current?.close();
    };
  }, [user]);

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
