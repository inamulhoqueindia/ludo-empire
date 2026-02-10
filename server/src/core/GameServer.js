import { RoomManager } from './RoomManager.js';
import { Logger } from '../utils/Logger.js';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import jwt from 'jsonwebtoken';

export class GameServer {
    constructor(io) {
        this.io = io;
        this.roomManager = new RoomManager(io);
        this.logger = new Logger('GameServer');
        this.connectedPlayers = new Map();
        
        // Rate limiters
        this.messageLimiter = new Map(); // In-memory for demo, use Redis in production
        
        this.initializeSocketHandlers();
    }

    initializeSocketHandlers() {
        this.io.on('connection', (socket) => {
            this.logger.info(`Client connected: ${socket.id}`);
            
            // Authentication middleware
            socket.on('authenticate', (data) => this.handleAuth(socket, data));
            
            // Room management
            socket.on('create_room', (data) => this.handleCreateRoom(socket, data));
            socket.on('join_room', (data) => this.handleJoinRoom(socket, data));
            socket.on('leave_room', () => this.handleLeaveRoom(socket));
            socket.on('start_game', () => this.handleStartGame(socket));
            socket.on('player_ready', (data) => this.handlePlayerReady(socket, data));
            
            // Game actions
            socket.on('dice_roll', (data) => this.handleDiceRoll(socket, data));
            socket.on('move_token', (data) => this.handleMoveToken(socket, data));
            socket.on('chat_message', (data) => this.handleChat(socket, data));
            
            // Disconnect
            socket.on('disconnect', () => this.handleDisconnect(socket));
            socket.on('reconnect_attempt', (data) => this.handleReconnection(socket, data));
            
            // Ping for latency check
            socket.on('ping_check', (timestamp) => {
                socket.emit('pong_check', { clientTime: timestamp, serverTime: Date.now() });
            });
        });
    }

    async handleAuth(socket, { token, playerData }) {
        try {
            // Verify JWT or create guest
            let playerId;
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                playerId = decoded.playerId;
            } else {
                playerId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }

            const player = {
                id: playerId,
                socketId: socket.id,
                username: playerData?.username || `Player_${playerId.substr(0, 4)}`,
                avatar: playerData?.avatar || 'default',
                isAuthenticated: !!token,
                connectedAt: Date.now()
            };

            this.connectedPlayers.set(socket.id, player);
            socket.playerId = playerId;
            
            socket.emit('authenticated', { 
                playerId, 
                token: token || this.generateGuestToken(playerId),
                player 
            });

            this.logger.info(`Player authenticated: ${player.username}`);
        } catch (error) {
            socket.emit('auth_error', { message: 'Invalid token' });
        }
    }

    handleCreateRoom(socket, options) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const room = this.roomManager.createRoom(options);
        const result = this.roomManager.joinRoom(room.id, player);
        
        if (result.success) {
            socket.join(room.id);
            socket.currentRoom = room.id;
            socket.emit('room_created', result);
        }
    }

    handleJoinRoom(socket, { roomId, password }) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player) return;

        const result = this.roomManager.joinRoom(roomId, player, password);
        
        if (result.success) {
            socket.join(roomId);
            socket.currentRoom = roomId;
            socket.emit('room_joined', result);
            
            // Notify others
            socket.to(roomId).emit('player_joined', {
                player: result.player,
                roomState: result.room
            });
        } else {
            socket.emit('join_error', { error: result.error });
        }
    }

    handleLeaveRoom(socket) {
        if (!socket.currentRoom) return;
        
        const player = this.connectedPlayers.get(socket.id);
        if (player) {
            this.roomManager.leaveRoom(socket.currentRoom, player.id);
            socket.leave(socket.currentRoom);
            socket.to(socket.currentRoom).emit('player_left', { playerId: player.id });
            socket.currentRoom = null;
        }
    }

    handleStartGame(socket) {
        if (!socket.currentRoom) return;
        
        const player = this.connectedPlayers.get(socket.id);
        const room = this.roomManager.rooms.get(socket.currentRoom);
        
        if (room && player && room.players.find(p => p.id === player.id)?.isHost) {
            const success = this.roomManager.startGame(socket.currentRoom);
            if (!success) {
                socket.emit('start_game_error', { message: 'Cannot start game' });
            }
        }
    }

    async handleDiceRoll(socket, data) {
        if (!this.checkRateLimit(socket.id, 'dice')) {
            socket.emit('error', { message: 'Too many requests' });
            return;
        }

        const player = this.connectedPlayers.get(socket.id);
        if (!player || !socket.currentRoom) return;

        const room = this.roomManager.rooms.get(socket.currentRoom);
        if (!room || !room.gameInstance) return;

        const result = await room.gameInstance.handleDiceRoll(player.id, data);
        socket.emit('dice_result', result);
    }

    async handleMoveToken(socket, data) {
        const player = this.connectedPlayers.get(socket.id);
        if (!player || !socket.currentRoom) return;

        const room = this.roomManager.rooms.get(socket.currentRoom);
        if (!room || !room.gameInstance) return;

        const result = await room.gameInstance.handleMove(player.id, data.move, data.signature);
        
        if (result.error) {
            socket.emit('move_error', result);
        }
    }

    handleChat(socket, { message }) {
        if (!this.checkRateLimit(socket.id, 'chat')) return;
        
        const player = this.connectedPlayers.get(socket.id);
        if (!player || !socket.currentRoom) return;

        // Sanitize message
        const sanitized = message.substr(0, 200).replace(/[<>]/g, '');
        
        this.io.to(socket.currentRoom).emit('chat_message', {
            playerId: player.id,
            username: player.username,
            message: sanitized,
            timestamp: Date.now()
        });
    }

    handleDisconnect(socket) {
        const player = this.connectedPlayers.get(socket.id);
        if (player) {
            this.logger.info(`Player disconnected: ${player.username}`);
            
            // Don't immediately remove from room - allow reconnection
            setTimeout(() => {
                if (this.io.sockets.sockets.get(socket.id) === undefined) {
                    // Still disconnected after 30 seconds
                    if (socket.currentRoom) {
                        this.roomManager.leaveRoom(socket.currentRoom, player.id);
                    }
                    this.connectedPlayers.delete(socket.id);
                }
            }, 30000);
        }
    }

    handleReconnection(socket, { playerId, roomId }) {
        const result = this.roomManager.handleReconnection(playerId, socket.id);
        if (result) {
            this.connectedPlayers.set(socket.id, result.player);
            socket.playerId = playerId;
            socket.currentRoom = roomId;
            socket.join(roomId);
            
            socket.emit('reconnect_success', {
                room: result.room,
                gameState: result.gameState
            });
        }
    }

    checkRateLimit(socketId, type) {
        const key = `${socketId}_${type}`;
        const now = Date.now();
        
        if (!this.messageLimiter.has(key)) {
            this.messageLimiter.set(key, { count: 1, resetTime: now + 1000 });
            return true;
        }

        const limit = this.messageLimiter.get(key);
        if (now > limit.resetTime) {
            limit.count = 1;
            limit.resetTime = now + 1000;
            return true;
        }

        limit.count++;
        if (limit.count > 10) return false;
        return true;
    }

    generateGuestToken(playerId) {
        return jwt.sign({ playerId, type: 'guest' }, process.env.JWT_SECRET || 'guest_secret', { expiresIn: '24h' });
    }
}