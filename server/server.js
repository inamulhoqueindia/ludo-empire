import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameServer } from './src/core/GameServer.js';
import { Logger } from './src/utils/Logger.js';
import { testConnection } from './src/config/Database.js';

const logger = new Logger('Server');

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
    cors: {
        origin: CORS_ORIGIN,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 1e6
});

app.get('/', (req, res) => {
    res.send('<h1>🎮 Ludo Empire Server is Running!</h1><p>Frontend is hosted separately. Connect via Socket.io.</p>');
});

app.get('/health', async (req, res) => {
    const dbStatus = await testConnection();
    res.json({
        status: dbStatus ? 'healthy' : 'degraded',
        db: dbStatus ? 'connected' : 'disconnected',
        timestamp: Date.now(),
        uptime: process.uptime(),
        connections: io.engine.clientsCount
    });
});

const gameServer = new GameServer(io);

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

httpServer.listen(PORT, async () => {
    logger.info(`🎮 Ludo Empire Server running on port ${PORT}`);
    logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Database connect
    await testConnection();
});

export { io, gameServer };