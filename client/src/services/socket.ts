import { io, Socket } from 'socket.io-client';

import { getServerUrl } from './config';

let socketInstance: Socket | null = null;

export function getSocketServerUrl(): string {
  return getServerUrl();
}

export function initializeSocket(): Socket {
  if (!socketInstance) {
    const serverUrl = getSocketServerUrl();
    socketInstance = io(serverUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
  }
  return socketInstance;
}

export function getSocket(): Socket {
  if (!socketInstance) {
    return initializeSocket();
  }
  return socketInstance;
}

/**
 * Disconnects the socket transport while preserving registered event listeners
 * so subsequent reconnections immediately work without re-registering handlers.
 */
export function disconnectSocket(): void {
  if (socketInstance && socketInstance.connected) {
    socketInstance.disconnect();
  }
}
