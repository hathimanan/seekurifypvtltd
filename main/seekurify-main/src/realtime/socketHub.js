// src/realtime/socketHub.js
import { Server } from "socket.io";

let io;

export function initSocket(httpServer, options = {}) {
  io = new Server(httpServer, {
    cors: options.cors || { origin: true, credentials: true },
    transports: options.transports || ['polling', 'websocket'],
    path: options.path || '/socket.io',
  });

  io.on('connection', (socket) => {
    console.log('✅ socket connected', socket.id);
    socket.on('registerUser', (userId) => {
      console.log('➡️ registerUser', userId, 'socket', socket.id);
      socket.join(`user_${userId}`);
    });
    socket.on('disconnect', (reason) => {
      console.log('❌ socket disconnected', socket.id, reason);
    });
  });

  return io;
}

export function pushAlert(userId, eventName, data) {
  if (!io) {
    console.error('Socket.io not initialized');
    return;
  }
  const room = `user_${userId}`;
  io.to(room).emit(eventName, data);
  console.log(`🔔 Alert pushed to ${room}:`, data);
}

export function pushEvent(userId, eventName, data) {
  if (!io) return;
  io.to(`user_${userId}`).emit(eventName, data);
}
