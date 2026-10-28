import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { accessToken, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeBoardUsers, setActiveBoardUsers] = useState([]);
  const reconnectListenersRef = useRef(new Set());

  // Register reconnect listener
  const onReconnect = useCallback((callback) => {
    reconnectListenersRef.current.add(callback);
    return () => reconnectListenersRef.current.delete(callback);
  }, []);

  useEffect(() => {
    if (!accessToken || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const newSocket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('reconnect', () => {
      setIsConnected(true);
      // Trigger snapshot refetch on all boards
      reconnectListenersRef.current.forEach((cb) => cb());
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      setActiveBoardUsers([]);
    });

    newSocket.on('presence:update', (data) => {
      if (data && data.users) {
        setActiveBoardUsers(data.users);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [accessToken, user]);

  const joinBoard = useCallback((boardId) => {
    if (socket && isConnected) {
      socket.emit('join:board', { boardId });
    }
  }, [socket, isConnected]);

  const leaveBoard = useCallback((boardId) => {
    if (socket && isConnected) {
      socket.emit('leave:board', { boardId });
      setActiveBoardUsers([]);
    }
  }, [socket, isConnected]);

  return (
    <SocketContext.Provider value={{
      socket,
      isConnected,
      activeBoardUsers,
      joinBoard,
      leaveBoard,
      onReconnect
    }}>
      {/* Offline Banner */}
      {!isConnected && user && (
        <div
          role="status"
          className="bg-[#FFF3C4] border-b border-[#FFD966] text-[#7A5A50] px-4 py-2 text-center text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all select-none shadow-sm z-40 relative"
        >
          <span className="animate-spin text-base">☁️</span>
          <span>Connecting to live sync... Changes will sync when reconnected.</span>
        </div>
      )}
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}

