import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import { pool } from './db';
import { initializeSocket } from './socket';
import './queues'; // Initialize queues

// Routes
import authRoutes from './routes/auth.routes';
import casesRoutes from './routes/cases.routes';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploaded photos)
app.use('/uploads', express.static(config.photoStoragePath));

// Initialize Socket.IO
const io = initializeSocket(httpServer);
export { io };

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', casesRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Kumbh Mela Backend'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
const PORT = config.port;

httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║                                                    ║
║   🕉️  Kumbh Mela 2027 - Backend Server           ║
║                                                    ║
║   🚀 Server running on port ${PORT}                ║
║   🗄️  Database: ${config.database.url.split('@')[1]?.split('/')[0] || 'PostgreSQL'}   ║
║   📡 Socket.IO: Ready                             ║
║   🔄 Queue Workers: Active                        ║
║                                                    ║
╚════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM signal received: closing HTTP server');
  httpServer.close(async () => {
    console.log('HTTP server closed');
    await pool.end();
    console.log('Database connections closed');
    process.exit(0);
  });
});
