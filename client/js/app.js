/**
 * LUDO EMPIRE - Main Application
 * Entry point and coordinator
 */

// CHANGE THIS TO YOUR LIVE SERVER URL WHEN DEPLOYED (e.g., https://ludo-server.onrender.com)
const SERVER_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://ludo-empire.onrender.com';

class LudoApp {
    constructor() {
        this.network = new NetworkManager();
        this.ui = new UIManager();
        this.gameEngine = null;
        this.currentState = 'loading';

        this.player = null;
        this.room = null;

        this.init();
    }

    async init() {
        console.log('Initializing LudoApp...');
        alert('LudoApp Initializing...'); // DEBUG

        // Initialize UI immediate
        try {
            this.setupUI();
            alert('UI Setup done'); // DEBUG
        } catch (e) { alert('UI Setup Error: ' + e.message); }

        // Ensure we transition to menu even if connection is slow/fails
        const loadingFallback = setTimeout(() => {
            if (this.currentState === 'loading') {
                console.log('Loading timeout reached, forcing menu...');
                alert('Loading taking too long, forcing menu...'); // DEBUG
                this.changeState('menu');
            }
        }, 10000); // 10 seconds for debugging

        // Setup game loop & input
        this.setupInputHandlers();

        // Connect to server in background
        try {
            console.log('Connecting to server:', SERVER_URL);
            alert('Connecting to: ' + SERVER_URL); // DEBUG
            await this.network.connect(SERVER_URL);
            alert('Connected successfully!'); // DEBUG
            this.setupNetworkHandlers();
            this.authenticate();
            console.log('Network connected and authenticated.');
        } catch (error) {
            console.error('Initial connection failed:', error);
            this.ui.showError('Connection failed. Sitting in offline mode.');
            alert('Network Error: ' + error.message); // DEBUG
        } finally {
            // If we are still in loading state, move to menu
            if (this.currentState === 'loading') {
                this.changeState('menu');
                clearTimeout(loadingFallback);
            }
        }
    }

    setupUI() {
        // Screen transitions
        this.ui.on('navigate', (screen) => this.changeState(screen));

        // Menu buttons
        document.getElementById('btn-quick-play').addEventListener('click', () => {
            this.findQuickMatch();
        });

        document.getElementById('btn-create-room').addEventListener('click', () => {
            this.changeState('create_room');
        });

        document.getElementById('btn-join-room').addEventListener('click', () => {
            const code = prompt('Enter room code:');
            if (code) this.joinRoom(code.toUpperCase());
        });

        document.getElementById('btn-create').addEventListener('click', () => {
            this.createRoom();
        });

        document.getElementById('btn-start-game').addEventListener('click', () => {
            this.network.startGame();
        });

        document.getElementById('btn-roll').addEventListener('click', () => {
            this.rollDice();
        });

        // Game controls
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.ui.showModal('pause');
        });

        document.getElementById('btn-resume').addEventListener('click', () => {
            this.ui.hideModal('pause');
        });

        document.getElementById('btn-leave-game').addEventListener('click', () => {
            this.network.leaveRoom();
            this.changeState('menu');
            this.ui.hideModal('pause');
        });

        // Settings toggles
        document.getElementById('private-room').addEventListener('change', (e) => {
            const passGroup = document.getElementById('password-group');
            passGroup.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    setupNetworkHandlers() {
        this.network.on('authenticated', (data) => {
            this.player = data.player;
        });

        this.network.on('room_created', (data) => {
            this.room = data.room;
            this.enterLobby(data);
        });

        this.network.on('room_joined', (data) => {
            this.room = data.room;
            this.enterLobby(data);
        });

        this.network.on('player_joined', (data) => {
            this.ui.updateLobbyPlayers(data.roomState.players);
        });

        this.network.on('player_left', (data) => {
            if (this.room) {
                this.room.players = this.room.players.filter(p => p.id !== data.playerId);
                this.ui.updateLobbyPlayers(this.room.players);
            }
        });

        this.network.on('game_started', (data) => {
            this.startGame(data);
        });

        this.network.on('turn_started', (data) => {
            this.handleTurnStart(data);
        });

        this.network.on('dice_rolled', (data) => {
            this.handleDiceRolled(data);
        });

        this.network.on('token_moved', (data) => {
            this.handleTokenMoved(data);
        });

        this.network.on('token_captured', (data) => {
            this.handleTokenCaptured(data);
        });

        this.network.on('player_won', (data) => {
            this.handlePlayerWon(data);
        });

        this.network.on('game_ended', (data) => {
            this.handleGameEnded(data);
        });

        this.network.on('chat_message', (data) => {
            this.ui.addChatMessage(data);
        });

        this.network.on('connection_lost', () => {
            this.ui.showError('Connection lost. Attempting to reconnect...');
        });
    }

    setupInputHandlers() {
        // Canvas interactions
        const canvas = document.getElementById('game-canvas');

        canvas.addEventListener('click', (e) => {
            if (this.currentState !== 'playing') return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this.handleBoardClick(x, y);
        });

        // Touch support
        let touchStartX, touchStartY;
        canvas.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        canvas.addEventListener('touchend', (e) => {
            if (this.currentState !== 'playing') return;

            const rect = canvas.getBoundingClientRect();
            const x = e.changedTouches[0].clientX - rect.left;
            const y = e.changedTouches[0].clientY - rect.top;

            this.handleBoardClick(x, y);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.currentState === 'playing') {
                if (e.code === 'Space') {
                    this.rollDice();
                }
            }
        });
    }

    authenticate() {
        // Check for existing token
        const token = localStorage.getItem('ludo_token');
        const playerData = {
            username: localStorage.getItem('ludo_username') || `Player_${Math.floor(Math.random() * 1000)}`
        };

        this.network.authenticate(token, playerData);
    }

    createRoom() {
        const mode = document.querySelector('.mode-btn.active').dataset.mode;
        const maxPlayers = parseInt(document.querySelector('.count-btn.active').dataset.count);
        const isPrivate = document.getElementById('private-room').checked;
        const password = isPrivate ? document.getElementById('room-password').value : null;

        this.network.createRoom({
            gameMode: mode,
            maxPlayers: maxPlayers,
            isPrivate: isPrivate,
            password: password
        });
    }

    joinRoom(roomId) {
        this.network.joinRoom(roomId);
    }

    findQuickMatch() {
        // TODO: Implement matchmaking
        this.ui.showNotification('Finding match...');
    }

    enterLobby(data) {
        this.changeState('lobby');
        this.ui.updateLobbyPlayers(data.room.players);
        this.ui.setRoomCode(data.room.id);
    }

    startGame(data) {
        this.changeState('playing');

        // Initialize game engine
        const canvas = document.getElementById('game-canvas');
        this.gameEngine = new GameEngine(canvas);
        this.gameEngine.initialize();

        // Sync initial state
        this.gameEngine.syncGameState(data.gameState);

        // Setup players UI
        this.ui.setupGamePlayers(this.room.players);
    }

    handleTurnStart(data) {
        this.ui.showTurnIndicator(data.playerId === this.player.id);
        document.getElementById('btn-roll').disabled = data.playerId !== this.player.id;

        if (this.gameEngine) {
            this.gameEngine.gameState.currentPlayer = data.playerId;
        }
    }

    async rollDice() {
        document.getElementById('btn-roll').disabled = true;

        // Visual roll
        const dice = document.getElementById('dice');
        dice.classList.add('rolling');

        // Wait for server response
        this.network.rollDice();
    }

    handleDiceRolled(data) {
        const dice = document.getElementById('dice');
        dice.classList.remove('rolling');

        // Set dice face
        const rotations = {
            1: 'rotateX(0deg) rotateY(0deg)',
            2: 'rotateX(-180deg) rotateY(0deg)',
            3: 'rotateX(0deg) rotateY(-90deg)',
            4: 'rotateX(0deg) rotateY(90deg)',
            5: 'rotateX(-90deg) rotateY(0deg)',
            6: 'rotateX(90deg) rotateY(0deg)'
        };

        dice.style.transform = rotations[data.value];

        // Update game state
        if (this.gameEngine) {
            this.gameEngine.rollDice(data.value);

            // If no moves available, auto-skip after delay
            if (data.moves.length === 0) {
                setTimeout(() => this.network.nextTurn(), 1500);
            }
        }
    }

    handleBoardClick(x, y) {
        if (!this.gameEngine) return;

        // Check if clicked on valid move hint
        const gridPos = this.gameEngine.boardRenderer.screenToGrid(x, y);
        const validMove = this.gameEngine.gameState.validMoves.find(
            m => m.to.x === gridPos.x && m.to.y === gridPos.y
        );

        if (validMove) {
            this.executeMove(validMove);
        }
    }

    executeMove(move) {
        // Send to server
        const signature = this.generateMoveSignature(move);
        this.network.moveToken(move.tokenId, move, signature);

        // Local prediction
        this.gameEngine.moveToken(move.tokenId, move.to);
    }

    generateMoveSignature(move) {
        // Simple client-side signature for validation
        const data = `${this.player.id}:${move.tokenId}:${this.gameEngine.gameState.diceValue}:${Date.now()}`;
        return btoa(data);
    }

    handleTokenMoved(data) {
        if (this.gameEngine) {
            const token = this.gameEngine.findToken(data.tokenId);
            if (token) {
                this.gameEngine.moveToken(data.tokenId, data.to);
            }
        }
    }

    handleTokenCaptured(data) {
        this.ui.showCaptureEffect(data.attacker, data.victim);
    }

    handlePlayerWon(data) {
        this.ui.showWinnerNotification(data.playerId);
    }

    handleGameEnded(data) {
        setTimeout(() => {
            this.ui.showGameOver(data.winners);
        }, 2000);
    }

    changeState(newState) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

        // Show new screen
        const screen = document.getElementById(this.getScreenId(newState));
        if (screen) screen.classList.add('active');

        this.currentState = newState;
    }

    getScreenId(state) {
        const mapping = {
            'loading': 'loading-screen',
            'menu': 'main-menu',
            'create_room': 'create-room-screen',
            'lobby': 'lobby-screen',
            'playing': 'game-screen'
        };
        return mapping[state] || state;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.gameApp = new LudoApp();
});