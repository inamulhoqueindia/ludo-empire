export class MovementEngine {
    constructor() {
        this.animationSpeed = 200; // ms per step
        this.easing = 'easeInOutQuad';
    }

    calculatePathSteps(from, to, color) {
        // Calculate intermediate steps for smooth animation
        const steps = [];
        const dx = (to.x - from.x);
        const dy = (to.y - from.y);
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        
        for (let i = 1; i <= distance; i++) {
            steps.push({
                x: from.x + (dx * i / distance),
                y: from.y + (dy * i / distance),
                progress: i / distance
            });
        }
        
        return steps;
    }

    validateMove(gameState, playerId, tokenId, targetPosition) {
        const tokens = gameState.playerTokens.get(playerId);
        const token = tokens.find(t => t.id === tokenId);
        
        if (!token) return { valid: false, reason: 'TOKEN_NOT_FOUND' };
        if (token.status !== 'playing') return { valid: false, reason: 'TOKEN_NOT_IN_PLAY' };
        
        // Check if target is within valid path range
        const path = this.getPath(token.color);
        const currentIdx = path.findIndex(p => p.x === token.coordinate.x && p.y === token.coordinate.y);
        const targetIdx = path.findIndex(p => p.x === targetPosition.x && p.y === targetPosition.y);
        
        if (targetIdx === -1) return { valid: false, reason: 'INVALID_POSITION' };
        
        const diceValue = gameState.diceValue;
        const stepsNeeded = targetIdx - currentIdx;
        
        if (stepsNeeded !== diceValue && stepsNeeded !== diceValue + 52) { // Handle wrap-around
            return { valid: false, reason: 'INVALID_DISTANCE' };
        }
        
        return { valid: true };
    }

    getPath(color) {
        // Same as BoardLogic - duplicated here for validation independence
        const paths = {
            red: [],
            green: [],
            yellow: [],
            blue: []
        };
        // ... path generation logic
        return paths[color];
    }

    interpolatePosition(start, end, progress) {
        return {
            x: start.x + (end.x - start.x) * this.ease(progress),
            y: start.y + (end.y - start.y) * this.ease(progress)
        };
    }

    ease(t) {
        // EaseInOutQuad
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
}