/**
 * Token Manager
 * Handles token rendering, animation, and interaction
 */

class TokenManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.tokens = new Map();
        this.selectedToken = null;
        this.hoverToken = null;
        
        // Animation configs
        this.bounceHeight = 10;
        this.bounceSpeed = 0.005;
    }

    update(dt) {
        // Update token animations
        for (const [, tokens] of this.tokens) {
            tokens.forEach(token => {
                // Idle animation (floating)
                if (token.status === 'playing' || token.status === 'home') {
                    token.floatOffset = Math.sin(Date.now() * this.bounceSpeed + token.id) * 5;
                }
                
                // Smooth movement to target
                if (token.targetX !== undefined && token.targetY !== undefined) {
                    const speed = dt * 0.005;
                    token.x += (token.targetX - token.x) * speed;
                    token.y += (token.targetY - token.y) * speed;
                    
                    if (Math.abs(token.targetX - token.x) < 0.1) token.x = token.targetX;
                    if (Math.abs(token.targetY - token.y) < 0.1) token.y = token.targetY;
                }
            });
        }
    }

    render(tokensMap) {
        // Render tokens by layer (home -> playing -> finished)
        const layers = ['home', 'playing', 'finished'];
        
        layers.forEach(layer => {
            for (const [playerId, tokens] of tokensMap) {
                tokens.forEach(token => {
                    if (token.status === layer) {
                        this.renderToken(token);
                    }
                });
            }
        });
    }

    renderToken(token) {
        const pos = gameEngine.boardRenderer.gridToScreen(token.gridX, token.gridY);
        const x = pos.x;
        const y = pos.y + (token.floatOffset || 0);
        const size = gameEngine.boardRenderer.cellSize * 0.35;
        
        this.ctx.save();
        
        // Shadow
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y + size * 0.8, size * 0.8, size * 0.3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Token body (3D effect)
        const gradient = this.ctx.createRadialGradient(
            x - size * 0.3, y - size * 0.3, 0,
            x, y, size
        );
        
        const colors = {
            red: ['#ff6b81', '#ff4757', '#c44569'],
            green: ['#7bed9f', '#2ed573', '#27ae60'],
            yellow: ['#ffeaa7', '#ffa502', '#e67e22'],
            blue: ['#74b9ff', '#1e90ff', '#2980b9']
        };
        
        const colorSet = colors[token.color];
        gradient.addColorStop(0, colorSet[0]);
        gradient.addColorStop(0.5, colorSet[1]);
        gradient.addColorStop(1, colorSet[2]);
        
        // Main circle
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Border
        this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        // Inner detail
        this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
        this.ctx.beginPath();
        this.ctx.arc(x - size * 0.3, y - size * 0.3, size * 0.2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Selection indicator
        if (this.selectedToken === token.id) {
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.arc(x, y, size + 8, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Glow effect
            this.ctx.shadowColor = colorSet[1];
            this.ctx.shadowBlur = 20;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }
        
        // Number on token
        this.ctx.fillStyle = 'white';
        this.ctx.font = `bold ${size}px Poppins`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
        this.ctx.shadowBlur = 2;
        this.ctx.fillText((token.index + 1).toString(), x, y);
        this.ctx.shadowBlur = 0;
        
        this.ctx.restore();
    }

    getTokenAt(x, y) {
        // Convert screen to grid and find token
        const gridPos = gameEngine.boardRenderer.screenToGrid(x, y);
        
        for (const [playerId, tokens] of this.tokens) {
            for (const token of tokens) {
                if (token.gridX === gridPos.x && token.gridY === gridPos.y) {
                    return token;
                }
            }
        }
        return null;
    }

    selectToken(tokenId) {
        this.selectedToken = tokenId;
        
        // Add selection animation
        const token = this.findToken(tokenId);
        if (token) {
            token.scale = 1.2;
            setTimeout(() => token.scale = 1.0, 200);
        }
    }

    findToken(tokenId) {
        for (const [, tokens] of this.tokens) {
            const token = tokens.find(t => t.id === tokenId);
            if (token) return token;
        }
        return null;
    }

    createToken(playerId, color, index) {
        const homePos = gameEngine.boardRenderer.getHomePosition(color, index);
        return {
            id: `${playerId}_token_${index}`,
            playerId: playerId,
            color: color,
            index: index,
            status: 'home',
            gridX: homePos.x,
            gridY: homePos.y,
            x: homePos.x,
            y: homePos.y,
            targetX: homePos.x,
            targetY: homePos.y,
            floatOffset: 0,
            scale: 1
        };
    }

    moveToken(tokenId, fromGrid, toGrid, duration = 600) {
        const token = this.findToken(tokenId);
        if (!token) return;

        // Animate along path
        const startTime = Date.now();
        const startPos = gameEngine.boardRenderer.gridToScreen(fromGrid.x, fromGrid.y);
        const endPos = gameEngine.boardRenderer.gridToScreen(toGrid.x, toGrid.y);
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = MathUtils.easeInOutQuad(progress);
            
            // Arc movement
            const arcHeight = 30 * Math.sin(progress * Math.PI);
            
            const currentX = MathUtils.lerp(startPos.x, endPos.x, eased);
            const currentY = MathUtils.lerp(startPos.y, endPos.y, eased) - arcHeight;
            
            // Update token visual position
            token.visualX = currentX;
            token.visualY = currentY;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                token.visualX = null;
                token.visualY = null;
                token.gridX = toGrid.x;
                token.gridY = toGrid.y;
            }
        };
        
        animate();
    }
}