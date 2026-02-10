import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// TUMHARE CONFIGURATIONS (Support ENV variables for deployment)
const dbConfig = {
    host: process.env.DB_HOST || 'sql206.infinityfree.com',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'if0_41097646',
    password: process.env.DB_PASSWORD || '73UjmJHxm9F9zJ',
    database: process.env.DB_NAME || 'if0_41097646_ludo',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

export const db = mysql.createPool(dbConfig);

export async function testConnection() {
    try {
        const connection = await db.getConnection();
        console.log('✅ MySQL Connected Successfully!');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ MySQL Connection Failed:', error.message);
        return false;
    }
}

export async function saveUser(userId, username, isGuest = true) {
    const query = `INSERT INTO users (id, username, is_guest, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE last_login = NOW()`;
    await db.execute(query, [userId, username, isGuest]);
}

export async function createRoomDB(roomId, roomCode, hostId, maxPlayers, isPrivate = false, password = null) {
    const query = `INSERT INTO rooms (id, room_code, host_id, max_players, is_private, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'waiting', NOW())`;
    await db.execute(query, [roomId, roomCode, hostId, maxPlayers, isPrivate, password]);
}

export async function joinRoomDB(roomId, userId, playerColor, isHost = false) {
    const query = `INSERT INTO room_players (id, room_id, user_id, player_color, is_host, joined_at) VALUES (UUID(), ?, ?, ?, ?, NOW())`;
    await db.execute(query, [roomId, userId, playerColor, isHost]);
}

export async function leaveRoomDB(roomId, userId) {
    const query = `DELETE FROM room_players WHERE room_id = ? AND user_id = ?`;
    await db.execute(query, [roomId, userId]);
}

export async function updateRoomStatus(roomId, status, winnerId = null) {
    const query = `UPDATE rooms SET status = ?, winner_id = ?, ended_at = NOW() WHERE id = ?`;
    await db.execute(query, [status, winnerId, roomId]);
}

export async function saveGameMove(roomId, userId, moveNumber, diceValue, tokenId, fromPos, toPos, moveType) {
    const query = `INSERT INTO game_moves (id, room_id, user_id, move_number, dice_value, token_id, from_position, to_position, move_type, timestamp) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    await db.execute(query, [roomId, userId, moveNumber, diceValue, tokenId, JSON.stringify(fromPos), JSON.stringify(toPos), moveType]);
}

export async function logChat(roomId, userId, message) {
    const query = `INSERT INTO chat_messages (id, room_id, user_id, message, created_at) VALUES (UUID(), ?, ?, ?, NOW())`;
    await db.execute(query, [roomId, userId, message]);
}