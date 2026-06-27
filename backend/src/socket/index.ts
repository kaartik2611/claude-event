import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import sherlockService from '../services/sherlock.service';

let io: SocketIOServer | null = null;

export const initializeSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error'));
    }
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });
  
  io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`🔌 Socket connected: ${user.id} (${user.role})`);
    
    // Join role-based room
    socket.join(user.role);
    
    // Join zone-based room (for police and sherlocks)
    if (user.zone_id) {
      socket.join(`zone:${user.zone_id}`);
    }
    
    // Admin joins all zones
    if (user.role === 'admin') {
      socket.join('admin');
    }
    
    // Zone subscription
    socket.on('zone:join', (zone_id: string) => {
      socket.join(`zone:${zone_id}`);
      console.log(`📍 ${user.id} joined zone: ${zone_id}`);
    });
    
    socket.on('zone:leave', (zone_id: string) => {
      socket.leave(`zone:${zone_id}`);
      console.log(`📍 ${user.id} left zone: ${zone_id}`);
    });
    
    // Case subscription
    socket.on('case:subscribe', (case_id: string) => {
      socket.join(`case:${case_id}`);
      console.log(`📋 ${user.id} subscribed to case: ${case_id}`);
    });
    
    socket.on('case:unsubscribe', (case_id: string) => {
      socket.leave(`case:${case_id}`);
    });
    
    // Sherlock heartbeat (location updates)
    socket.on('sherlock:heartbeat', async (data: { sherlock_id: string; location: { lat: number; lng: number } }) => {
      if (user.role === 'sherlock') {
        try {
          await sherlockService.updateLocation(data.sherlock_id, data.location);
          
          // Broadcast location to zone
          if (user.zone_id) {
            io!.to(`zone:${user.zone_id}`).emit('sherlock:location', {
              sherlock_id: data.sherlock_id,
              location: data.location
            });
          }
        } catch (error) {
          console.error('Heartbeat error:', error);
        }
      }
    });
    
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${user.id}`);
    });
  });
  
  console.log('✅ Socket.IO initialized');
  
  return io;
};

export { io };
