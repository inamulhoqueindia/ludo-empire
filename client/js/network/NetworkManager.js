/**
 * Network Manager
 * Handles all WebSocket communication with the server
 */

class NetworkManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;

        this.eventHandlers = new Map();
        this.latency = 0;
        this.serverTimeOffset = 0;

        this.playerId = null;
        this.roomId = null;
    }

    connect(serverUrl) {
        return new Promise((resolve, reject) => {
            console.log('Socket.io connecting to:', serverUrl);

            // Timeout for connection
            const timeout = setTimeout(() => {
                if (!this.isConnected) {
                    console.warn('Connection attempt timed out');
                    resolve(); // Resolve anyway to let the app show the menu
                }
            }, 8000);

            this.socket = io(serverUrl, {
                transports: ['polling', 'websocket'], // Allow polling for better compatibility
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: this.reconnectDelay
            });

            this.socket.on('connect', () => {
                clearTimeout(timeout);
                console.log('Successfully connected to server!');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.warn('Connection error:', error.message);
                // We don't reject here to allow automatic retries
            });

            this.setupEventHandlers(resolve, reject);
            this.startPingCheck();
        });
    }

    setupEventHandlers(resolve, reject) {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.isConnected = true;
            this.reconnectAttempts = 0;

            if (this.playerId) {
                // Attempt reconnection with existing session
                this.emit('reconnect_attempt', { playerId: this.playerId, roomId: this.roomId });
            }

            resolve();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected:', reason);
            this.isConnected = false;
            this.trigger('connection_lost', { reason });
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            reject(error);
        });

        // Game Events
        this.socket.on('authenticated', (data) => {
            this.playerId = data.playerId;
            this.trigger('authenticated', data);
        });

        this.socket.on('room_created', (data) => {
            this.roomId = data.room.id;
            this.trigger('room_created', data);
        });

        this.socket.on('room_joined', (data) => {
            this.roomId = data.room.id;
            this.trigger('room_joined', data);
        });

        this.socket.on('player_joined', (data) => {
            this.trigger('player_joined', data);
        });

        this.socket.on('player_left', (data) => {
            this.trigger('player_left', data);
        });

        this.socket.on('game_started', (data) => {
            this.trigger('game_started', data);
        });

        this.socket.on('turn_started', (data) => {
            this.trigger('turn_started', data);
        });

        this.socket.on('dice_rolled', (data) => {
            this.trigger('dice_rolled', data);
        });

        this.socket.on('token_moved', (data) => {
            this.trigger('token_moved', data);
        });

        this.socket.on('token_captured', (data) => {
            this.trigger('token_captured', data);
        });

        this.socket.on('player_won', (data) => {
            this.trigger('player_won', data);
        });

        this.socket.on('game_ended', (data) => {
            this.trigger('game_ended', data);
        });

        this.socket.on('chat_message', (data) => {
            this.trigger('chat_message', data);
        });

        this.socket.on('error', (data) => {
            console.error('Server error:', data);
            this.trigger('error', data);
        });

        this.socket.on('pong_check', (data) => {
            const now = Date.now();
            this.latency = (now - data.clientTime) / 2;
            this.serverTimeOffset = data.serverTime + this.latency - now;
        });

        this.socket.on('reconnect_success', (data) => {
            this.trigger('reconnect_success', data);
        });
    }

    startPingCheck() {
        setInterval(() => {
            if (this.isConnected) {
                this.socket.emit('ping_check', Date.now());
            }
        }, 5000);
    }

    // Event System
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) handlers.splice(index, 1);
        }
    }

    trigger(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (e) {
                    console.error('Error in event handler:', e);
                }
            });
        }
    }

    // Actions
    authenticate(token, playerData) {
        this.emit('authenticate', { token, playerData });
    }

    createRoom(options) {
        this.emit('create_room', options);
    }

    joinRoom(roomId, password) {
        this.emit('join_room', { roomId, password });
    }

    leaveRoom() {
        this.emit('leave_room');
        this.roomId = null;
    }

    startGame() {
        this.emit('start_game');
    }

    playerReady(isReady) {
        this.emit('player_ready', { isReady });
    }

    rollDice() {
        this.emit('dice_roll', { timestamp: Date.now() });
    }

    moveToken(tokenId, moveData, signature) {
        this.emit('move_token', {
            move: { tokenId, ...moveData },
            signature,
            timestamp: Date.now()
        });
    }

    sendChat(message) {
        this.emit('chat_message', { message });
    }

    emit(event, data) {
        if (this.socket && this.isConnected) {
            this.socket.emit(event, data);
        } else {
            console.warn('Cannot emit, socket not connected');
        }
    }

    getServerTime() {
        return Date.now() + this.serverTimeOffset;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}