/**
 * Core Game Engine
 * Manages game loop, rendering, and state synchronization
 */

class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.lastTime = 0;
        this.deltaTime = 0;
        this.isRunning = false;
        this.currentState = null;
        
        // Systems
        this.boardRenderer = null;
        this.tokenManager = null;
        this.diceSystem = null;
        this.camera = null;
        
        // Game State
        this.gameState = {
            phase: 'waiting',
            currentPlayer: null,
            players: [],
            tokens: new Map(),
            diceValue: null,
            selectedToken: null,
            validMoves: [],
            animationQueue: []
        };

        // Rendering
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Bind methods
        this.loop = this.loop.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        window.addEventListener('resize', this.handleResize);
    }

    initialize() {
        this.setupCanvas();
        this.boardRenderer = new BoardRenderer(this.ctx);
        this.tokenManager = new TokenManager(this.ctx);
        this.diceSystem = new DiceSystem();
        this.camera = new CameraController(this.canvas);
        
        this.handleResize();
        this.start();
    }

    setupCanvas() {
        // High DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr, dpr);
        this.width = rect.width;
        this.height = rect.height;
    }

    handleResize() {
        this.setupCanvas();
        if (this.boardRenderer) {
            this.boardRenderer.calculateLayout(this.width, this.height);
        }
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop);
    }

    stop() {
        this.isRunning = false;
    }

    loop(timestamp) {
        if (!this.isRunning) return;
        
        this.deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        this.update(this.deltaTime);
        this.render();
        
        requestAnimationFrame(this.loop);
    }

    update(dt) {
        // Update animations
        this.updateAnimations(dt);
        
        // Update tokens
        this.tokenManager.update(dt);
        
        // Update camera
        this.camera.update(dt);
        
        // Process game logic
        if (this.gameState.phase === 'playing') {
            this.updateGameLogic(dt);
        }
    }

    updateAnimations(dt) {
        const queue = this.gameState.animationQueue;
        
        for (let i = queue.length - 1; i >= 0; i--) {
            const anim = queue[i];
            anim.elapsed += dt;
            
            const progress = Math.min(anim.elapsed / anim.duration, 1);
            const eased = MathUtils.easeInOutQuad(progress);
            
            if (anim.type === 'token_move') {
                const token = this.gameState.tokens.get(anim.tokenId);
                if (token) {
                    token.position = MathUtils.lerp2D(
                        anim.from,
                        anim.to,
                        eased
                    );
                    token.scale = 1 + Math.sin(progress * Math.PI) * 0.2;
                }
            } else if (anim.type === 'dice_roll') {
                // Dice animation handled by CSS, but we can add effects here
            }
            
            if (progress >= 1) {
                if (anim.onComplete) anim.onComplete();
                queue.splice(i, 1);
            }
        }
    }

    updateGameLogic(dt) {
        // Handle input, check win conditions, etc.
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Apply camera transform
        this.ctx.save();
        this.camera.apply(this.ctx);
        
        // Render board
        this.boardRenderer.render();
        
        // Render tokens
        this.tokenManager.render(this.gameState.tokens);
        
        // Render UI overlays
        this.renderOverlays();
        
        this.ctx.restore();
        
        // Render screen-space UI
        this.renderScreenUI();
    }

    renderOverlays() {
        // Highlight valid moves
        if (this.gameState.validMoves.length > 0) {
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            this.gameState.validMoves.forEach(move => {
                const pos = this.boardRenderer.gridToScreen(move.to);
                this.ctx.beginPath();
                this.ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
    }

    renderScreenUI() {
        // Render any screen-space effects
    }

    // Game Actions
    rollDice(value) {
        this.gameState.diceValue = value;
        
        // Add animation
        this.gameState.animationQueue.push({
            type: 'dice_roll',
            elapsed: 0,
            duration: 1000,
            value: value
        });
        
        // Determine valid moves
        this.calculateValidMoves();
    }

    calculateValidMoves() {
        const currentPlayer = this.gameState.players.find(
            p => p.id === this.gameState.currentPlayer
        );
        
        if (!currentPlayer) return;
        
        const tokens = this.gameState.tokens.get(currentPlayer.id) || [];
        const dice = this.gameState.diceValue;
        const moves = [];
        
        tokens.forEach(token => {
            if (token.status === 'home' && dice === 6) {
                moves.push({
                    tokenId: token.id,
                    to: this.boardRenderer.getStartPosition(currentPlayer.color),
                    type: 'enter'
                });
            } else if (token.status === 'playing') {
                const path = this.boardRenderer.getPath(currentPlayer.color);
                const currentIdx = path.findIndex(
                    p => p.x === token.gridX && p.y === token.gridY
                );
                
                if (currentIdx !== -1 && currentIdx + dice < path.length) {
                    const targetPos = path[currentIdx + dice];
                    moves.push({
                        tokenId: token.id,
                        to: targetPos,
                        type: 'move'
                    });
                }
            }
        });
        
        this.gameState.validMoves = moves;
        return moves;
    }

    moveToken(tokenId, toPosition) {
        const token = this.findToken(tokenId);
        if (!token) return;
        
        const fromPosition = { x: token.gridX, y: token.gridY };
        
        // Add movement animation
        this.gameState.animationQueue.push({
            type: 'token_move',
            tokenId: tokenId,
            from: fromPosition,
            to: toPosition,
            elapsed: 0,
            duration: 600,
            onComplete: () => {
                token.gridX = toPosition.x;
                token.gridY = toPosition.y;
                this.checkCaptures(token);
            }
        });
        
        // Clear valid moves
        this.gameState.validMoves = [];
    }

    findToken(tokenId) {
        for (const [, tokens] of this.gameState.tokens) {
            const token = tokens.find(t => t.id === tokenId);
            if (token) return token;
        }
        return null;
    }

    checkCaptures(movingToken) {
        // Check if token landed on opponent token
        for (const [playerId, tokens] of this.gameState.tokens) {
            if (playerId === movingToken.playerId) continue;
            
            for (const token of tokens) {
                if (token.gridX === movingToken.gridX && 
                    token.gridY === movingToken.gridY &&
                    !this.boardRenderer.isSafeZone(token.gridX, token.gridY)) {
                    // Capture!
                    this.captureToken(token);
                }
            }
        }
    }

    captureToken(token) {
        // Animate token back to home
        const homePos = this.boardRenderer.getHomePosition(token.color, token.index);
        
        this.gameState.animationQueue.push({
            type: 'token_move',
            tokenId: token.id,
            from: { x: token.gridX, y: token.gridY },
            to: homePos,
            elapsed: 0,
            duration: 800,
            onComplete: () => {
                token.status = 'home';
                token.gridX = homePos.x;
                token.gridY = homePos.y;
            }
        });
    }

    syncGameState(serverState) {
        // Interpolate towards server state
        this.gameState.currentPlayer = serverState.currentTurn;
        this.gameState.diceValue = serverState.diceValue;
        
        // Update tokens with interpolation
        Object.entries(serverState.playerTokens).forEach(([playerId, tokens]) => {
            if (!this.gameState.tokens.has(playerId)) {
                this.gameState.tokens.set(playerId, tokens);
            } else {
                // Interpolate existing tokens
                const localTokens = this.gameState.tokens.get(playerId);
                tokens.forEach((serverToken, idx) => {
                    if (localTokens[idx]) {
                        // Smooth transition to server position
                        localTokens[idx].targetX = serverToken.coordinate.x;
                        localTokens[idx].targetY = serverToken.coordinate.y;
                        localTokens[idx].status = serverToken.status;
                    }
                });
            }
        });
    }

    destroy() {
        this.stop();
        window.removeEventListener('resize', this.handleResize);
    }
}