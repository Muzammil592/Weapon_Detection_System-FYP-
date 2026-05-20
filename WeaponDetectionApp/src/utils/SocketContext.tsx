import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { API_CONFIG } from './config';


interface SocketContextType {
  socket: Socket | null;
  sendDetectionRequest: (payload: {
    stream_url: string;
    user: string;
    location: string;
    camera_name?: string;
  }) => void;
}


interface SocketProviderProps {
  children: ReactNode;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Keep a module-level reference to the latest socket instance
let latestSocket: Socket | null = null;

export function getSocketInstance(): Socket | null {
  return latestSocket;
}


export function SocketProvider({ children }: SocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const hasLoggedConnectErrorRef = useRef(false);

  // Emit detection request to backend/AI service
  const sendDetectionRequest = (payload: { stream_url: string; user: string; location: string; camera_name?: string }) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('start-detection', payload);
      console.log('📤 Sent detection request:', payload);
    } else {
      console.warn('⚠️ Socket not connected. Cannot send detection request.');
    }
  };

  useEffect(() => {
    console.log('🔌 Initializing Socket.io connection to:', API_CONFIG.BASE_URL);
    // Connect to Socket.io server
    const s = io(API_CONFIG.BASE_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      timeout: 20000,
      forceNew: false,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = s;
    setSocket(s);
    latestSocket = s;

    // Socket events
    s.on('connect', () => {
      console.log('✅ Connected to Socket.io server', { id: s.id, url: API_CONFIG.BASE_URL });
      hasLoggedConnectErrorRef.current = false;
    });

    s.on('disconnect', (reason) => {
      console.log('❌ Disconnected from Socket.io server:', reason);
    });

    s.on('connect_error', (error: any) => {
      if (!hasLoggedConnectErrorRef.current) {
        console.error('🔴 Socket connection error:', error?.message || error);
        console.error('🔍 Connection details:', {
          url: API_CONFIG.BASE_URL,
          transport: s.io?.engine?.transport?.name,
          readyState: (s as any).connected ?? s.io?.readyState,
        });
        hasLoggedConnectErrorRef.current = true;
      }
    });

    s.on('reconnect', (attemptNumber: number) => {
      console.log('🔄 Reconnected to Socket.io server after', attemptNumber, 'attempts');
    });

    s.on('reconnect_error', (error: any) => {
      console.error('🔴 Socket reconnection error:', error?.message || error);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('🔌 Disconnecting socket...');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        latestSocket = null;
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, sendDetectionRequest }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}