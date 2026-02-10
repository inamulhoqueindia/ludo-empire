import crypto from 'crypto';
import CryptoJS from 'crypto-js';

export class SecurityManager {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.secretKey = process.env.GAME_SECRET || crypto.randomBytes(32).toString('hex');
    }

    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    hashMove(move, timestamp, secret) {
        const data = `${move.playerId}:${move.tokenId}:${move.diceValue}:${timestamp}:${secret}`;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    encryptDiceRoll(roll, roomId, sequence) {
        const payload = JSON.stringify({ roll, roomId, sequence, ts: Date.now() });
        const cipher = crypto.createCipher(this.algorithm, this.secretKey);
        let encrypted = cipher.update(payload, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return { encrypted, authTag: authTag.toString('hex') };
    }

    decryptDiceRoll(encryptedData, authTag) {
        try {
            const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
            decipher.setAuthTag(Buffer.from(authTag, 'hex'));
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        } catch (e) {
            return null;
        }
    }

    generateMoveSignature(playerId, moveData, sequence) {
        const hmac = crypto.createHmac('sha256', this.secretKey);
        hmac.update(`${playerId}:${JSON.stringify(moveData)}:${sequence}`);
        return hmac.digest('hex');
    }

    verifyMoveSignature(playerId, moveData, sequence, signature) {
        const expected = this.generateMoveSignature(playerId, moveData, sequence);
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    }

    generateRoomSeed(roomId) {
        return crypto.createHash('sha256')
            .update(`${roomId}:${Date.now()}:${this.secretKey}`)
            .digest('hex');
    }
}