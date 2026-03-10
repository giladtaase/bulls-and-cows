// ==================== Bulls & Cows — Online Multiplayer ====================

const socket = io();

const state = {
    roomCode: null,
    playerIndex: -1,    // 0 or 1
    myTurn: false,
    phase: 'lobby'      // lobby | waiting | setup | game | win
};

// ==================== Utility ====================

function wireDigitInputs(inputs, onEnter) {
    inputs.forEach((input, idx) => {
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if (!/^\d$/.test(val)) { e.target.value = ''; return; }
            if (idx < inputs.length - 1) inputs[idx + 1].focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && idx > 0) inputs[idx - 1].focus();
            if (e.key === 'Enter' && onEnter) onEnter();
        });
        input.addEventListener('focus', () => setTimeout(() => input.select(), 0));
    });
}

function collectDigits(inputs) {
    const digits = [];
    for (const input of inputs) {
        const val = input.value.trim();
        if (!/^\d$/.test(val)) return { valid: false, digits: [], error: 'יש להזין 4 ספרות!' };
        digits.push(parseInt(val));
    }
    if (new Set(digits).size !== 4) return { valid: false, digits: [], error: 'כל הספרות חייבות להיות שונות!' };
    return { valid: true, digits, error: '' };
}

function showScreen(id) {
    ['lobbyScreen', 'waitingScreen', 'setupScreen', 'gameScreen', 'winScreen'].forEach(s => {
        document.getElementById(s).style.display = 'none';
    });
    document.getElementById(id).style.display = '';
}

function showMsg(elId, text, type = '') {
    const el = document.getElementById(elId);
    el.textContent = text;
    el.className = 'message ' + type;
}

// ==================== Lobby ====================

const joinCodeInput = document.getElementById('joinCodeInput');

joinCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') joinRoom();
});

function createRoom() {
    showMsg('lobbyMessage', 'יוצר חדר...', 'info');
    socket.emit('create-room', (res) => {
        if (res.success) {
            state.roomCode = res.code;
            state.playerIndex = res.playerIndex;
            document.getElementById('roomCodeDisplay').textContent = res.code;
            showScreen('waitingScreen');
        } else {
            showMsg('lobbyMessage', 'שגיאה ביצירת חדר', 'error');
        }
    });
}

function joinRoom() {
    const code = joinCodeInput.value.trim().toUpperCase();
    if (!code || code.length < 3) {
        showMsg('lobbyMessage', 'הזן קוד חדר', 'error');
        return;
    }
    showMsg('lobbyMessage', 'מצטרף...', 'info');
    socket.emit('join-room', code, (res) => {
        if (res.success) {
            state.roomCode = res.code;
            state.playerIndex = res.playerIndex;
            // Both players will get 'game-start-setup' event
        } else {
            showMsg('lobbyMessage', res.error, 'error');
        }
    });
}

function copyRoomCode() {
    navigator.clipboard.writeText(state.roomCode).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✅ הועתק!';
        setTimeout(() => btn.textContent = '📋 העתק', 2000);
    }).catch(() => {});
}

// ==================== Setup ====================

const setupDigits = document.querySelectorAll('#setupDigits .digit-box');
wireDigitInputs(setupDigits, submitSecret);

function goToSetup() {
    state.phase = 'setup';
    const pNum = state.playerIndex + 1;
    document.getElementById('setupRoomBadge').textContent = `חדר: ${state.roomCode}`;
    const badge = document.getElementById('setupPlayerBadge');
    badge.textContent = `שחקן ${pNum}`;
    badge.className = 'player-badge ' + (state.playerIndex === 0 ? 'p1' : 'p2');
    setupDigits.forEach(inp => inp.value = '');
    document.getElementById('setupWaiting').style.display = 'none';
    showMsg('setupMessage', '', '');
    showScreen('setupScreen');
    setupDigits[0].focus();
}

function submitSecret() {
    const { valid, digits, error } = collectDigits(setupDigits);
    if (!valid) { showMsg('setupMessage', error, 'error'); return; }
    if (digits[0] === 0) { showMsg('setupMessage', 'הספרה הראשונה לא יכולה להיות 0!', 'error'); return; }

    socket.emit('submit-secret', digits, (res) => {
        if (res.success) {
            showMsg('setupMessage', '✔ המספר הסודי נשמר!', 'win');
            setupDigits.forEach(inp => inp.disabled = true);
            document.getElementById('setupWaiting').style.display = 'flex';
        } else {
            showMsg('setupMessage', res.error, 'error');
        }
    });
}

// ==================== Game ====================

const gameDigits = document.querySelectorAll('#gameDigits .game-digit');
const guessBtn = document.getElementById('guessBtn');
wireDigitInputs(gameDigits, makeGuess);

function goToGame(startingTurn) {
    state.phase = 'game';
    document.getElementById('gameRoomBadge').textContent = `חדר: ${state.roomCode}`;

    // Show "you" badge
    document.getElementById('youBadge1').style.display = state.playerIndex === 0 ? '' : 'none';
    document.getElementById('youBadge2').style.display = state.playerIndex === 1 ? '' : 'none';

    // Clear histories
    document.getElementById('history1').innerHTML = '';
    document.getElementById('history2').innerHTML = '';
    document.getElementById('attempts1').textContent = '0 ניחושים';
    document.getElementById('attempts2').textContent = '0 ניחושים';

    showScreen('gameScreen');
    updateTurn(startingTurn);
}

function updateTurn(turn) {
    state.myTurn = (turn === state.playerIndex);
    const pNum = turn + 1;
    const icon = turn === 0 ? '🟦' : '🟥';

    document.getElementById('turnName').textContent = `שחקן ${pNum}`;
    document.getElementById('turnIndicator').className = 'turn-indicator ' + (turn === 0 ? 'p1-turn' : 'p2-turn');

    document.getElementById('panel1').classList.toggle('active-panel', turn === 0);
    document.getElementById('panel2').classList.toggle('active-panel', turn === 1);

    if (state.myTurn) {
        document.getElementById('gameInputArea').style.display = '';
        document.getElementById('waitingTurn').style.display = 'none';
        const label = document.getElementById('currentTurnLabel');
        label.textContent = `${icon} התור שלך — נחש!`;
        label.className = 'current-turn-label ' + (state.playerIndex === 0 ? 'p1' : 'p2');
        gameDigits.forEach(inp => { inp.value = ''; inp.classList.remove('bull', 'hit', 'miss'); inp.disabled = false; });
        guessBtn.disabled = false;
        showMsg('gameMessage', '', '');
        gameDigits[0].focus();
    } else {
        document.getElementById('gameInputArea').style.display = 'none';
        document.getElementById('waitingTurn').style.display = 'flex';
    }
}

function makeGuess() {
    if (!state.myTurn) return;

    const { valid, digits, error } = collectDigits(gameDigits);
    if (!valid) { showMsg('gameMessage', error, 'error'); return; }

    guessBtn.disabled = true;
    gameDigits.forEach(inp => inp.disabled = true);

    socket.emit('guess', digits, (res) => {
        if (!res.success) {
            showMsg('gameMessage', res.error, 'error');
            guessBtn.disabled = false;
            gameDigits.forEach(inp => inp.disabled = false);
        }
        // Results come via 'guess-result' event
    });
}

// ==================== Socket Events ====================

socket.on('game-start-setup', () => {
    goToSetup();
});

socket.on('waiting-for-opponent-secret', () => {
    // Already showing waiting UI
});

socket.on('opponent-ready', () => {
    showMsg('setupMessage', 'היריב בחר מספר — תורך!', 'info');
});

socket.on('game-begin', ({ turn }) => {
    goToGame(turn);
});

socket.on('guess-result', ({ player, guess, bulls, hits, attempts }) => {
    // Add to the correct player's history panel
    const historyEl = document.getElementById(`history${player + 1}`);
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
        <span class="guess-num">${guess}</span>
        <span class="bulls">${'🎯'.repeat(bulls) || '—'}</span>
        <span class="hits">${'🔥'.repeat(hits) || '—'}</span>
    `;
    historyEl.insertBefore(row, historyEl.firstChild);
    document.getElementById(`attempts${player + 1}`).textContent = `${attempts} ניחושים`;

    // Animate current player's digit boxes if it's their guess
    if (player === state.playerIndex) {
        const secretGuess = guess.split('').map(Number);
        gameDigits.forEach((input, i) => {
            input.classList.remove('bull', 'hit', 'miss');
            // We don't know the actual secret, so just use bulls/hits count (visual only based on position)
        });
    }
});

socket.on('turn-change', ({ turn }) => {
    updateTurn(turn);
});

socket.on('game-over', ({ winner, secrets, attempts }) => {
    state.phase = 'win';
    const iWon = winner === state.playerIndex;

    document.getElementById('winEmoji').textContent = iWon ? '🏆' : '😔';
    document.getElementById('winTitle').textContent = iWon ? '🎉 ניצחת!' : `שחקן ${winner + 1} ניצח`;
    document.getElementById('winDetails').textContent = iWon
        ? `גילית את המספר ב-${attempts[winner]} ניחושים!`
        : `היריב גילה את המספר שלך ב-${attempts[winner]} ניחושים`;

    document.getElementById('winSummary').innerHTML = `
        <div>🟦 <strong>שחקן 1</strong> — מספר סודי: <strong style="direction:ltr;display:inline-block;letter-spacing:2px;">${secrets[0]}</strong> (${attempts[0]} ניחושים)</div>
        <div>🟥 <strong>שחקן 2</strong> — מספר סודי: <strong style="direction:ltr;display:inline-block;letter-spacing:2px;">${secrets[1]}</strong> (${attempts[1]} ניחושים)</div>
    `;

    document.getElementById('rematchBtn').disabled = false;
    showMsg('rematchMessage', '', '');

    showScreen('winScreen');
    if (iWon) launchConfetti();
});

socket.on('opponent-disconnected', () => {
    document.getElementById('disconnectOverlay').style.display = 'flex';
});

socket.on('rematch-request', () => {
    showMsg('rematchMessage', 'היריב רוצה משחק חוזר!', 'info');
});

socket.on('rematch-accepted', () => {
    goToSetup();
});

// ==================== Rematch / Lobby ====================

function requestRematch() {
    socket.emit('rematch');
    document.getElementById('rematchBtn').disabled = true;
    showMsg('rematchMessage', 'ממתין ליריב...', 'info');
}

function backToLobby() {
    document.getElementById('disconnectOverlay').style.display = 'none';
    const canvas = document.getElementById('confetti');
    if (canvas) canvas.remove();
    state.roomCode = null;
    state.playerIndex = -1;
    state.myTurn = false;
    state.phase = 'lobby';
    showMsg('lobbyMessage', '', '');
    joinCodeInput.value = '';
    showScreen('lobbyScreen');
}

// ==================== Confetti ====================

function launchConfetti() {
    const canvas = document.createElement('canvas');
    canvas.id = 'confetti';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#ffd200', '#ff6b6b', '#00e676', '#448aff', '#e040fb', '#ff9100'];

    for (let i = 0; i < 150; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            speed: Math.random() * 3 + 2,
            angle: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.2,
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.y += p.speed;
            p.angle += p.spin;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.angle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        frame++;
        if (frame < 200) requestAnimationFrame(animate);
        else canvas.remove();
    }
    animate();
}
