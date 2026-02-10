import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/Logger.js';
import { LudoGame } from '../game/LudoGame.js';
import { createRoomDB, joinRoomDB, leaveRoomDB, updateRoomStatus } from '../config/Database.js';

export class RoomManager {
    constructor(io) {
        this.io = io;
        this.rooms = new Map();
        this.playerRoomMap = new Map();
        this.logger = new Logger('RoomManager');
        this.cleanupInterval = setInterval(() => this.cleanupEmptyRooms(), 60000);
    }

    async createRoom(options = {}) {
        const roomId = uuidv4();
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Database mein save
        try {
            await createRoomDB(roomId, roomCode, null, options.maxPlayers || 4, options.isPrivate, options.password);
        } catch (err) {
            this.logger.error('DB Error creating room:', err);
        }
        
        const room = {
            id: roomId,
            code: roomCode,
            createdAt: Date.now(),
            players: [],
            maxPlayers: options.maxPlayers || 4,
            gameMode: options.gameMode || 'classic',
            isPrivate: options.isPrivate || false,
            password: options.password || null,
            status: 'waiting',
            gameInstance: null,
            spectators: [],
            chat: [],
            settings: {
                turnTime: options.turnTime || 30000,
                enableChat: options.enableChat !== false,
                enableSpectate: options.enableSpectate !== false
            }
        };

        this.rooms.set(roomId, room);
        this.logger.info(`Room created: ${roomCode}`);
        return room;
    }

    async joinRoom(roomId, player, password = null) {
        const room = this.rooms.get(roomId);
        
        if (!room) {
            return { success: false, error: 'ROOM_NOT_FOUND' };
        }

        if (room.status !== 'waiting') {
            return { success: false, error: 'GAME_ALREADY_STARTED' };
        }

        if (room.players.length >= room.maxPlayers) {
            return { success: false, error: 'ROOM_FULL' };
        }

        if (room.isPrivate && room.password !== password) {
            return { success: false, error: 'WRONG_PASSWORD' };
        }

        if (this.playerRoomMap.has(player.id)) {
            this.leaveRoom(this.playerRoomMap.get(player.id), player.id);
        }

        const playerData = {
            id: player.id,
            socketId: player.socketId,
            username: player.username,
            avatar: player.avatar || 'default',
            color: this.assignColor(room),
            isReady: false,
            isHost: room.players.length === 0,
            joinedAt: Date.now(),
            stats: { wins: 0, gamesPlayed: 0, rank: 'beginner' }
        };

        room.players.push(playerData);
        this.playerRoomMap.set(player.id, roomId);
        
        // Database mein save
        try {
            await joinRoomDB(roomId, player.id, playerData.color, playerData.isHost);
        } catch (err) {
            this.logger.error('DB Error joining room:', err);
        }

        this.logger.info(`Player ${player.username} joined room ${roomId}`);
        this.broadcastToRoom(roomId, 'player_joined', {
            player: playerData,
            roomState: this.sanitizeRoomState(room)
        });

        return { success: true, room: this.sanitizeRoomState(room), player: playerData };
    }

    async leaveRoom(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) return false;

        const playerIndex = room.players.findIndex(p => p.id === playerId);
        if (playerIndex === -1) return false;

        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        this.playerRoomMap.delete(playerId);
        
        // Database se remove
        try {
            await leaveRoomDB(roomId, playerId);
        } catch (err) {
            this.logger.error('DB Error leaving room:', err);
        }

        if (room.players.length === 0) {
            this.rooms.delete(roomId);
            this.logger.info(`Room ${roomId} deleted - empty`);
        } else {
            if (player.isHost && room.players.length > 0) {
                room.players[0].isHost = true;
            }
            
            if (room.status === 'playing' && room.gameInstance) {
                room.gameInstance.handlePlayerDisconnect(playerId);
            }

            this.broadcastToRoom(roomId, 'player_left', {
                playerId,
                newHost: room.players[0]?.id,
                roomState: this.sanitizeRoomState(room)
            });
        }

        return true;
    }

    async startGame(roomId) {
        const room = this.rooms.get(roomId);
        if (!room || room.status !== 'waiting') return false;
        if (room.players.length < 2) return false;

        const allReady = room.players.every(p => p.isReady || p.isHost);
        if (!allReady) return false;

        room.status = 'playing';
        room.gameInstance = new LudoGame(room, this.io);
        room.gameInstance.initialize();
        
        // Database update
        try {
            await updateRoomStatus(roomId, 'playing');
        } catch (err) {
            this.logger.error('DB Error starting game:', err);
        }

        this.broadcastToRoom(roomId, 'game_started', {
            roomState: this.sanitizeRoomState(room),
            gameState: room.gameInstance.getGameState()
        });

        this.logger.info(`Game started in room ${roomId}`);
        return true;
    }

    assignColor(room) {
        const colors = ['red', 'green', 'yellow', 'blue'];
        const usedColors = room.players.map(p => p.color);
        return colors.find(c => !usedColors.includes(c)) || 'spectator';
    }

    getRoomByPlayer(playerId) {
        const roomId = this.playerRoomMap.get(playerId);
        return roomId ? this.rooms.get(roomId) : null;
    }

    sanitizeRoomState(room) {
        return {
            id: room.id,
            code: room.code,
            status: room.status,
            gameMode: room.gameMode,
            maxPlayers: room.maxPlayers,
            players: room.players.map(p => ({
                id: p.id,
                username: p.username,
                avatar: p.avatar,
                color: p.color,
                isReady: p.isReady,
                isHost: p.isHost
            })),
            settings: room.settings,
            playerCount: room.players.length
        };
    }

    broadcastToRoom(roomId, event, data) {
        this.io.to(roomId).emit(event, data);
    }

    cleanupEmptyRooms() {
        const now = Date.now();
        for (const [roomId, room] of this.rooms) {
            if (room.players.length === 0 && (now - room.createdAt) > 300000) {
                this.rooms.delete(roomId);
                this.logger.info(`Cleaned up empty room: ${roomId}`);
            }
        }
    }

    getPublicRooms() {
        return Array.from(this.rooms.values())
            .filter(r => !r.isPrivate && r.status === 'waiting')
            .map(r => this.sanitizeRoomState(r));
    }

    handleReconnection(playerId, socketId) {
        const room = this.getRoomByPlayer(playerId);
        if (!room || !room.gameInstance) return null;

        const player = room.players.find(p => p.id === playerId);
        if (player) {
            player.socketId = socketId;
            player.isConnected = true;
            room.gameInstance.handlePlayerReconnection(playerId);
            return {
                room: this.sanitizeRoomState(room),
                gameState: room.gameInstance.getGameState(),
                player: player
            };
        }
        return null;
    }
}