import { Logger } from '../utils/Logger.js';
import { BoardLogic } from './BoardLogic.js';
import { MovementEngine } from './MovementEngine.js';
import { AntiCheat } from './AntiCheat.js';
import { SecurityManager } from '../utils/Crypto.js';

export class LudoGame {
    constructor(room, io) {
        this.room = room;
        this.io = io;
        this.logger = new Logger('LudoGame');
        this.boardLogic = new BoardLogic();
        this.movementEngine = new MovementEngine();
        this.antiCheat = new AntiCheat();
        this.security = new SecurityManager();
        
        this.state = {
            phase: 'initializing',
            currentTurn: 0,
            turnOrder: [],
            diceValue: null,
            diceRolled: false,
            movesAvailable: [],
            playerTokens: new Map(),
            safeZones: [],
            winners: [],
            turnTimer: null,
            turnStartTime: null,
            moveSequence: 0,
            gameSeed: this.security.generateRoomSeed(room.id),
            lastAction: null
        };

        this.TURN_TIME = room.settings.turnTime;
        this.TOKEN_COUNT = 4;
    }

    initialize() {
        this.state.turnOrder = this.room.players.map(p => p.id);
        this.state.phase = 'playing';
        
        // Initialize tokens for each player
        this.room.players.forEach(player => {
            this.state.playerTokens.set(player.id, this.initializeTokens(player.color));
        });

        this.startTurn();
        this.logger.info(`Game initialized in room ${this.room.id}`);
    }

    initializeTokens(color) {
        const homePositions = this.boardLogic.getHomePositions(color);
        return Array(4).fill(null).map((_, index) => ({
            id: `${color}_${index}`,
            color: color,
            position: null,
            status: 'home',
            homePosition: index,
            coordinate: homePositions[index],
            pathIndex: -1,
            reachedHome: false
        }));
    }

    startTurn() {
        if (this.state.winners.length === this.room.players.length - 1) {
            this.endGame();
            return;
        }

        const playerId = this.state.turnOrder[this.state.currentTurn];
        const player = this.room.players.find(p => p.id === playerId);
        
        if (!player || !player.isConnected) {
            this.skipTurn();
            return;
        }

        this.state.diceRolled = false;
        this.state.diceValue = null;
        this.state.movesAvailable = [];
        this.state.turnStartTime = Date.now();
        this.state.moveSequence++;

        this.startTurnTimer(playerId);

        this.broadcast('turn_started', {
            playerId,
            timeout: this.TURN_TIME,
            sequence: this.state.moveSequence
        });

        this.logger.debug(`Turn started for player ${player.username}`);
    }

    startTurnTimer(playerId) {
        if (this.state.turnTimer) {
            clearTimeout(this.state.turnTimer);
        }

        this.state.turnTimer = setTimeout(() => {
            this.handleTurnTimeout(playerId);
        }, this.TURN_TIME);
    }

    async handleDiceRoll(playerId, clientData) {
        if (this.state.diceRolled) return { error: 'ALREADY_ROLLED' };
        
        const currentPlayerId = this.state.turnOrder[this.state.currentTurn];
        if (playerId !== currentPlayerId) return { error: 'NOT_YOUR_TURN' };

        // Server-authoritative dice roll
        const diceValue = this.generateSecureDiceRoll();
        this.state.diceValue = diceValue;
        this.state.diceRolled = true;

        // Calculate available moves
        this.state.movesAvailable = this.calculateAvailableMoves(playerId, diceValue);

        // If no moves available, auto-skip
        if (this.state.movesAvailable.length === 0) {
            setTimeout(() => this.nextTurn(), 1500);
        }

        // Log for anti-cheat
        this.antiCheat.logAction(playerId, 'dice_roll', { value: diceValue, sequence: this.state.moveSequence });

        const response = {
            playerId,
            value: diceValue,
            moves: this.state.movesAvailable,
            signature: this.security.generateMoveSignature(playerId, { dice: diceValue }, this.state.moveSequence)
        };

        this.broadcast('dice_rolled', response);
        return { success: true, ...response };
    }

    generateSecureDiceRoll() {
        // Cryptographically secure random 1-6
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return (array[0] % 6) + 1;
    }

    calculateAvailableMoves(playerId, diceValue) {
        const tokens = this.state.playerTokens.get(playerId);
        const moves = [];

        tokens.forEach((token, index) => {
            if (token.status === 'home' && diceValue === 6) {
                moves.push({
                    tokenId: token.id,
                    type: 'enter',
                    from: null,
                    to: this.boardLogic.getStartPosition(token.color),
                    captures: []
                });
            } else if (token.status === 'playing') {
                const newPathIndex = token.pathIndex + diceValue;
                const path = this.boardLogic.getPath(token.color);
                
                if (newPathIndex < path.length) {
                    const targetPos = path[newPathIndex];
                    const captures = this.calculateCaptures(targetPos, playerId);
                    
                    moves.push({
                        tokenId: token.id,
                        type: 'move',
                        from: token.coordinate,
                        to: targetPos,
                        pathIndex: newPathIndex,
                        captures: captures
                    });
                } else if (newPathIndex === path.length) {
                    moves.push({
                        tokenId: token.id,
                        type: 'home',
                        from: token.coordinate,
                        to: this.boardLogic.getFinalPosition(token.color),
                        captures: []
                    });
                }
            }
        });

        return moves;
    }

    calculateCaptures(position, currentPlayerId) {
        const captures = [];
        
        this.state.playerTokens.forEach((tokens, playerId) => {
            if (playerId === currentPlayerId) return;
            
            tokens.forEach(token => {
                if (token.status === 'playing' && 
                    token.coordinate.x === position.x && 
                    token.coordinate.y === position.y &&
                    !this.boardLogic.isSafeZone(position)) {
                    captures.push({ playerId, tokenId: token.id });
                }
            });
        });

        return captures;
    }

    async handleMove(playerId, moveData, signature) {
        if (!this.state.diceRolled) return { error: 'DICE_NOT_ROLLED' };
        if (playerId !== this.state.turnOrder[this.state.currentTurn]) return { error: 'NOT_YOUR_TURN' };

        // Verify signature
        if (!this.security.verifyMoveSignature(playerId, moveData, this.state.moveSequence, signature)) {
            this.antiCheat.flagPlayer(playerId, 'INVALID_SIGNATURE');
            return { error: 'INVALID_SIGNATURE' };
        }

        // Validate move
        const validMove = this.state.movesAvailable.find(m => m.tokenId === moveData.tokenId);
        if (!validMove) {
            this.antiCheat.flagPlayer(playerId, 'INVALID_MOVE');
            return { error: 'INVALID_MOVE' };
        }

        // Execute move
        await this.executeMove(playerId, validMove);

        // Check win condition
        if (this.checkWinCondition(playerId)) {
            this.state.winners.push(playerId);
            this.broadcast('player_won', { playerId, rank: this.state.winners.length });
        }

        // Determine next turn (6 = extra turn, unless all tokens home)
        const extraTurn = this.state.diceValue === 6 && !this.checkAllTokensHome(playerId);
        
        if (!extraTurn) {
            this.nextTurn();
        } else {
            this.state.diceRolled = false;
            this.state.diceValue = null;
            this.broadcast('extra_turn', { playerId });
        }

        return { success: true };
    }

    async executeMove(playerId, move) {
        const tokens = this.state.playerTokens.get(playerId);
        const token = tokens.find(t => t.id === move.tokenId);
        
        // Update token state
        if (move.type === 'enter') {
            token.status = 'playing';
            token.pathIndex = 0;
            token.coordinate = move.to;
        } else if (move.type === 'home') {
            token.status = 'finished';
            token.reachedHome = true;
            token.coordinate = move.to;
        } else {
            token.pathIndex = move.pathIndex;
            token.coordinate = move.to;
        }

        // Handle captures
        for (const capture of move.captures) {
            const victimTokens = this.state.playerTokens.get(capture.playerId);
            const victimToken = victimTokens.find(t => t.id === capture.tokenId);
            
            victimToken.status = 'home';
            victimToken.position = null;
            victimToken.pathIndex = -1;
            victimToken.coordinate = victimToken.homePosition;

            this.broadcast('token_captured', {
                attacker: playerId,
                victim: capture.playerId,
                tokenId: capture.tokenId
            });
        }

        this.broadcast('token_moved', {
            playerId,
            tokenId: move.tokenId,
            type: move.type,
            from: move.from,
            to: move.to,
            captures: move.captures
        });

        this.state.lastAction = {
            playerId,
            move,
            timestamp: Date.now()
        };
    }

    checkAllTokensHome(playerId) {
        const tokens = this.state.playerTokens.get(playerId);
        return tokens.every(t => t.status === 'home');
    }

    checkWinCondition(playerId) {
        const tokens = this.state.playerTokens.get(playerId);
        return tokens.every(t => t.status === 'finished');
    }

    nextTurn() {
        if (this.state.turnTimer) {
            clearTimeout(this.state.turnTimer);
        }

        do {
            this.state.currentTurn = (this.state.currentTurn + 1) % this.state.turnOrder.length;
        } while (this.state.winners.includes(this.state.turnOrder[this.state.currentTurn]));

        this.startTurn();
    }

    skipTurn() {
        this.broadcast('turn_skipped', { 
            playerId: this.state.turnOrder[this.state.currentTurn],
            reason: 'disconnected'
        });
        this.nextTurn();
    }

    handleTurnTimeout(playerId) {
        this.broadcast('turn_timeout', { playerId });
        
        // Auto-move if possible (random valid move)
        if (this.state.movesAvailable.length > 0) {
            const randomMove = this.state.movesAvailable[Math.floor(Math.random() * this.state.movesAvailable.length)];
            this.handleMove(playerId, { tokenId: randomMove.tokenId }, 
                this.security.generateMoveSignature(playerId, { tokenId: randomMove.tokenId }, this.state.moveSequence));
        } else {
            this.nextTurn();
        }
    }

    handlePlayerDisconnect(playerId) {
        const player = this.room.players.find(p => p.id === playerId);
        if (player) {
            player.isConnected = false;
            this.broadcast('player_disconnected', { playerId });
            
            // If during their turn, skip after grace period
            if (this.state.turnOrder[this.state.currentTurn] === playerId) {
                setTimeout(() => {
                    if (!player.isConnected) {
                        this.skipTurn();
                    }
                }, 10000); // 10 second grace period
            }
        }
    }

    handlePlayerReconnection(playerId) {
        const player = this.room.players.find(p => p.id === playerId);
        if (player) {
            player.isConnected = true;
            this.broadcast('player_reconnected', { 
                playerId,
                gameState: this.getGameState()
            });
        }
    }

    getGameState() {
        return {
            phase: this.state.phase,
            currentTurn: this.state.currentTurn,
            turnOrder: this.state.turnOrder,
            diceValue: this.state.diceValue,
            diceRolled: this.state.diceRolled,
            movesAvailable: this.state.movesAvailable,
            playerTokens: Object.fromEntries(this.state.playerTokens),
            winners: this.state.winners,
            moveSequence: this.state.moveSequence
        };
    }

    endGame() {
        this.state.phase = 'finished';
        if (this.state.turnTimer) clearTimeout(this.state.turnTimer);
        
        this.broadcast('game_ended', {
            winners: this.state.winners,
            finalState: this.getGameState()
        });
        
        this.logger.info(`Game ended in room ${this.room.id}`);
    }

    broadcast(event, data) {
        this.io.to(this.room.id).emit(event, data);
    }
}