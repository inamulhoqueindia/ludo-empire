import { Logger } from '../utils/Logger.js';

export class AntiCheat {
    constructor() {
        this.logger = new Logger('AntiCheat');
        this.playerHistory = new Map();
        this.suspiciousActivity = new Map();
        this.RATE_LIMIT_WINDOW = 1000; // 1 second
        this.MAX_ACTIONS_PER_WINDOW = 10;
        this.MAX_APM = 300; // Actions per minute
    }

    logAction(playerId, actionType, data) {
        if (!this.playerHistory.has(playerId)) {
            this.playerHistory.set(playerId, []);
        }

        const history = this.playerHistory.get(playerId);
        const now = Date.now();
        
        history.push({
            timestamp: now,
            type: actionType,
            data: data
        });

        // Keep only last 100 actions
        if (history.length > 100) {
            history.shift();
        }

        // Check rate limiting
        this.checkRateLimit(playerId, now);
        
        // Validate action consistency
        this.validateAction(playerId, actionType, data);
    }

    checkRateLimit(playerId, now) {
        const history = this.playerHistory.get(playerId);
        const recentActions = history.filter(h => now - h.timestamp < this.RATE_LIMIT_WINDOW);
        
        if (recentActions.length > this.MAX_ACTIONS_PER_WINDOW) {
            this.flagPlayer(playerId, 'RATE_LIMIT_EXCEEDED', {
                actions: recentActions.length,
                window: this.RATE_LIMIT_WINDOW
            });
        }

        // Check APM
        const actionsLastMinute = history.filter(h => now - h.timestamp < 60000);
        if (actionsLastMinute.length > this.MAX_APM) {
            this.flagPlayer(playerId, 'SUSPICIOUS_APM', { apm: actionsLastMinute.length });
        }
    }

    validateAction(playerId, actionType, data) {
        // Check for impossible dice sequences
        if (actionType === 'dice_roll') {
            this.validateDiceRoll(playerId, data);
        }

        // Check for impossible moves (speed hacking)
        if (actionType === 'move') {
            this.validateMoveTiming(playerId, data);
        }
    }

    validateDiceRoll(playerId, data) {
        const history = this.playerHistory.get(playerId);
        const rolls = history.filter(h => h.type === 'dice_roll').slice(-20);
        
        // Check for too many 6s (suspicious but possible)
        const sixes = rolls.filter(r => r.data.value === 6).length;
        if (sixes > 10 && rolls.length === 20) {
            this.flagPlayer(playerId, 'SUSPICIOUS_LUCK', { sixes });
        }

        // Check sequence patterns (bot detection)
        if (this.detectPattern(rolls.map(r => r.data.value))) {
            this.flagPlayer(playerId, 'PATTERN_DETECTED');
        }
    }

    validateMoveTiming(playerId, data) {
        const history = this.playerHistory.get(playerId);
        const lastMove = history.slice(-2)[0]; // Second to last (current is last)
        
        if (lastMove && lastMove.type === 'dice_roll') {
            const timeDiff = data.timestamp - lastMove.timestamp;
            if (timeDiff < 100) { // Less than 100ms to move after roll
                this.flagPlayer(playerId, 'INSTANT_MOVE', { timeDiff });
            }
        }
    }

    detectPattern(sequence) {
        if (sequence.length < 6) return false;
        
        // Check for repeating patterns
        const str = sequence.join('');
        const patterns = ['123456', '111111', '666666', '121212', '123123'];
        
        return patterns.some(p => str.includes(p));
    }

    flagPlayer(playerId, reason, data = {}) {
        if (!this.suspiciousActivity.has(playerId)) {
            this.suspiciousActivity.set(playerId, []);
        }

        const flags = this.suspiciousActivity.get(playerId);
        flags.push({
            timestamp: Date.now(),
            reason,
            data
        });

        this.logger.warn(`Player ${playerId} flagged: ${reason}`, data);

        // Auto-ban after 3 flags
        if (flags.length >= 3) {
            this.banPlayer(playerId);
        }
    }

    banPlayer(playerId) {
        this.logger.error(`BANNED: Player ${playerId} due to multiple violations`);
        // Emit ban event to be handled by RoomManager
        return {
            action: 'ban',
            playerId,
            reason: 'MULTIPLE_VIOLATIONS',
            flags: this.suspiciousActivity.get(playerId)
        };
    }

    getPlayerTrustScore(playerId) {
        const flags = this.suspiciousActivity.get(playerId) || [];
        const history = this.playerHistory.get(playerId) || [];
        
        if (history.length === 0) return 100;
        
        const flagWeight = flags.length * 20;
        const activityBonus = Math.min(history.length / 10, 10);
        
        return Math.max(0, 100 - flagWeight + activityBonus);
    }
}