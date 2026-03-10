const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ==================== Room Management ====================

const rooms = new Map(); // roomCode → { players: [{id, secret, attempts}], turn: 0, phase: 'waiting'|'setup'|'playing'|'done' }

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return rooms.has(code) ? generateRoomCode() : code;
}

function calcResult(guess, secret) {
    let bulls = 0, hits = 0;
    for (let i = 0; i < 4; i++) {
        if (guess[i] === secret[i]) bulls++;
        else if (secret.includes(guess[i])) hits++;
    }
    return { bulls, hits };
}

function validateSecret(digits) {
    if (!Array.isArray(digits) || digits.length !== 4) return false;
    if (digits.some(d => typeof d !== 'number' || d < 0 || d > 9)) return false;
    if (new Set(digits).size !== 4) return false;
    if (digits[0] === 0) return false;
    return true;
}

function getPlayerIndex(room, socketId) {
    return room.players.findIndex(p => p.id === socketId);
}

// Cleanup stale rooms (older than 2 hours)
setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
        if (now - room.createdAt > 2 * 60 * 60 * 1000) {
            rooms.delete(code);
        }
    }
}, 60 * 1000);

// ==================== Socket Events ====================

io.on('connection', (socket) => {
    console.log(`Connected: ${socket.id}`);

    // --- Create Room ---
    socket.on('create-room', (callback) => {
        const code = generateRoomCode();
        const room = {
            players: [{ id: socket.id, secret: null, attempts: 0 }],
            turn: 0,
            phase: 'waiting',
            createdAt: Date.now()
        };
        rooms.set(code, room);
        socket.join(code);
        socket.roomCode = code;
        callback({ success: true, code, playerIndex: 0 });
        console.log(`Room ${code} created by ${socket.id}`);
    });

    // --- Join Room ---
    socket.on('join-room', (code, callback) => {
        code = (code || '').toUpperCase().trim();
        const room = rooms.get(code);

        if (!room) return callback({ success: false, error: 'החדר לא נמצא' });
        if (room.players.length >= 2) return callback({ success: false, error: 'החדר מלא' });
        if (room.phase !== 'waiting') return callback({ success: false, error: 'המשחק כבר התחיל' });

        room.players.push({ id: socket.id, secret: null, attempts: 0 });
        room.phase = 'setup';
        socket.join(code);
        socket.roomCode = code;

        callback({ success: true, code, playerIndex: 1 });

        // Notify both players that game setup begins
        io.to(code).emit('game-start-setup', {
            message: 'שני השחקנים מחוברים! בחרו מספר סודי.'
        });
        console.log(`Room ${code}: Player 2 joined (${socket.id})`);
    });

    // --- Submit Secret ---
    socket.on('submit-secret', (digits, callback) => {
        const code = socket.roomCode;
        const room = rooms.get(code);
        if (!room) return callback({ success: false, error: 'חדר לא נמצא' });

        const pIdx = getPlayerIndex(room, socket.id);
        if (pIdx === -1) return callback({ success: false, error: 'שגיאה' });

        if (!validateSecret(digits)) return callback({ success: false, error: 'מספר לא תקין — 4 ספרות שונות, לא מתחיל ב-0' });

        room.players[pIdx].secret = digits;
        callback({ success: true });

        // Check if both players submitted
        const bothReady = room.players.every(p => p.secret !== null);
        if (bothReady) {
            room.phase = 'playing';
            room.turn = 0;
            io.to(code).emit('game-begin', { turn: 0 });
            console.log(`Room ${code}: Both secrets in — game begins`);
        } else {
            // Tell this player to wait
            socket.emit('waiting-for-opponent-secret');
            // Tell the other player to hurry :)
            const otherPlayer = room.players.find(p => p.id !== socket.id);
            if (otherPlayer) {
                io.to(otherPlayer.id).emit('opponent-ready');
            }
        }
    });

    // --- Make Guess ---
    socket.on('guess', (digits, callback) => {
        const code = socket.roomCode;
        const room = rooms.get(code);
        if (!room || room.phase !== 'playing') return callback({ success: false, error: 'לא בזמן משחק' });

        const pIdx = getPlayerIndex(room, socket.id);
        if (pIdx === -1) return callback({ success: false, error: 'שגיאה' });
        if (room.turn !== pIdx) return callback({ success: false, error: 'זה לא התור שלך!' });

        if (!Array.isArray(digits) || digits.length !== 4) return callback({ success: false, error: 'ניחוש לא תקין' });
        if (digits.some(d => typeof d !== 'number' || d < 0 || d > 9)) return callback({ success: false, error: 'ניחוש לא תקין' });
        if (new Set(digits).size !== 4) return callback({ success: false, error: 'כל הספרות חייבות להיות שונות' });

        room.players[pIdx].attempts++;

        const opponentIdx = pIdx === 0 ? 1 : 0;
        const result = calcResult(digits, room.players[opponentIdx].secret);

        // Send result to both players
        io.to(code).emit('guess-result', {
            player: pIdx,
            guess: digits.join(''),
            bulls: result.bulls,
            hits: result.hits,
            attempts: room.players[pIdx].attempts
        });

        callback({ success: true, bulls: result.bulls, hits: result.hits });

        // Check win
        if (result.bulls === 4) {
            room.phase = 'done';
            io.to(code).emit('game-over', {
                winner: pIdx,
                secrets: [room.players[0].secret.join(''), room.players[1].secret.join('')],
                attempts: [room.players[0].attempts, room.players[1].attempts]
            });
            console.log(`Room ${code}: Player ${pIdx + 1} wins!`);
            // Clean up room after a delay
            setTimeout(() => rooms.delete(code), 5 * 60 * 1000);
        } else {
            // Switch turn
            room.turn = opponentIdx;
            io.to(code).emit('turn-change', { turn: opponentIdx });
        }
    });

    // --- Rematch ---
    socket.on('rematch', () => {
        const code = socket.roomCode;
        const room = rooms.get(code);
        if (!room) return;

        const pIdx = getPlayerIndex(room, socket.id);
        if (pIdx === -1) return;

        // Mark this player as wanting rematch
        room.players[pIdx].wantsRematch = true;

        if (room.players.every(p => p.wantsRematch)) {
            // Reset room
            room.players.forEach(p => {
                p.secret = null;
                p.attempts = 0;
                p.wantsRematch = false;
            });
            room.phase = 'setup';
            room.turn = 0;
            io.to(code).emit('rematch-accepted');
            console.log(`Room ${code}: Rematch!`);
        } else {
            // Notify the other player
            const otherPlayer = room.players.find(p => p.id !== socket.id);
            if (otherPlayer) io.to(otherPlayer.id).emit('rematch-request');
        }
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
        const code = socket.roomCode;
        if (!code) return;
        const room = rooms.get(code);
        if (!room) return;

        const pIdx = getPlayerIndex(room, socket.id);
        if (pIdx === -1) return;

        // Notify the other player
        const otherPlayer = room.players.find(p => p.id !== socket.id);
        if (otherPlayer) {
            io.to(otherPlayer.id).emit('opponent-disconnected');
        }

        // Remove the room
        rooms.delete(code);
        console.log(`Room ${code}: Player ${pIdx + 1} disconnected — room destroyed`);
    });
});

// ==================== Start Server ====================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎯 Bulls & Cows server running on http://localhost:${PORT}`);
});
