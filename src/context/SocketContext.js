'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@/context/AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  const userId = user?._id ? String(user._id) : null;

  useEffect(() => {
    if (!userId) {
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    const instance = io({
      path: '/socket.io',
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    // Surfaced through `connected` instead of a toast: the UI degrades to
    // polling, so a blip is not something the user needs to act on.
    const handleConnectError = (error) => {
      setConnected(false);
      console.warn('Chat socket unavailable:', error?.message || error);
    };

    instance.on('connect', handleConnect);
    instance.on('disconnect', handleDisconnect);
    instance.on('connect_error', handleConnectError);

    setSocket(instance);

    return () => {
      instance.off('connect', handleConnect);
      instance.off('disconnect', handleDisconnect);
      instance.off('connect_error', handleConnectError);
      instance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [userId]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
