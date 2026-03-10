// ==================== Bulls & Cows — Two Players ====================

const state = {
    secrets: [null, null],      // secrets[0] = Player 1's secret, secrets[1] = Player 2's secret
    attempts: [0, 0],
    currentSetup: 0,            // 0 = setting up Player 1, 1 = Player 2
    currentTurn: 0,             // 0 = Player 1's turn, 1 = Player 2's turn
    gameOver: false,
    phase: 'setup'              // 'setup' | 'transition' | 'game' | 'win'
};

// ==================== Utility ====================

function calcResult(guess, secret) {
    let bulls = 0, hits = 0;
    for (let i = 0; i < 4; i++) {
        if (guess[i] === secret[i]) bulls++;
        else if (secret.includes(guess[i])) hits++;
    }
    return { bulls, hits };
}

function validateDigits(inputs) {
    const digits = [];
    for (const input of inputs) {
        const val = input.value.trim();
        if (!/^\d$/.test(val)) return { valid: false, digits: [], error: 'יש להזין 4 ספרות!' };
        digits.push(parseInt(val));
    }
    if (new Set(digits).size !== 4) return { valid: false, digits: [], error: 'כל הספרות חייבות להיות שונות!' };
    return { valid: true, digits, error: '' };
}

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

// ==================== Screen Management ====================

function showScreen(id) {
    ['setupScreen', 'transitionScreen', 'gameScreen', 'winScreen'].forEach(s => {
        document.getElementById(s).style.display = 'none';
    });
    document.getElementById(id).style.display = '';
}

// ==================== Setup Phase ====================

const setupDigits = document.querySelectorAll('#setupDigits .secret-input');
const setupBadge = document.getElementById('setupBadge');
const setupMessage = document.getElementById('setupMessage');
const showSecretToggle = document.getElementById('showSecretToggle');

wireDigitInputs(setupDigits, confirmSecret);

showSecretToggle.addEventListener('change', () => {
    const type = showSecretToggle.checked ? 'text' : 'password';
    setupDigits.forEach(inp => inp.type = type);
});

function confirmSecret() {
    const { valid, digits, error } = validateDigits(setupDigits);
    if (!valid) {
        setupMessage.textContent = error;
        setupMessage.className = 'message error';
        return;
    }
    // First digit shouldn't be 0
    if (digits[0] === 0) {
        setupMessage.textContent = 'הספרה הראשונה לא יכולה להיות 0!';
        setupMessage.className = 'message error';
        return;
    }

    state.secrets[state.currentSetup] = digits;
    setupMessage.textContent = '';
    setupMessage.className = 'message';

    if (state.currentSetup === 0) {
        // Move to transition → Player 2
        state.currentSetup = 1;
        document.getElementById('transitionTitle').textContent = 'תעבירו את המכשיר לשחקן 2';
        showScreen('transitionScreen');
    } else {
        // Both secrets set → start game, transition to player 1's turn
        document.getElementById('transitionTitle').textContent = 'תעבירו את המכשיר לשחקן 1';
        state.phase = 'transition-to-game';
        showScreen('transitionScreen');
    }
}

function onReady() {
    if (state.phase === 'transition-to-game') {
        // Start the actual game
        state.phase = 'game';
        state.currentTurn = 0;
        updateTurnUI();
        showScreen('gameScreen');
        gameDigits[0].focus();
    } else if (state.phase === 'transition-turn') {
        // Continue game — next player's turn
        state.phase = 'game';
        updateTurnUI();
        showScreen('gameScreen');
        gameDigits[0].focus();
    } else {
        // Setup player 2
        resetSetupInputs();
        setupBadge.textContent = 'שחקן 2';
        setupBadge.className = 'player-badge p2';
        showScreen('setupScreen');
        setupDigits[0].focus();
    }
}

function resetSetupInputs() {
    setupDigits.forEach(inp => { inp.value = ''; inp.type = 'password'; });
    showSecretToggle.checked = false;
    setupMessage.textContent = '';
    setupMessage.className = 'message';
}

// ==================== Game Phase ====================

const gameDigits = document.querySelectorAll('#gameDigits .game-digit');
const guessBtn = document.getElementById('guessBtn');
const gameMessage = document.getElementById('gameMessage');
const turnNameEl = document.getElementById('turnName');
const turnIndicator = document.getElementById('turnIndicator');
const currentTurnLabel = document.getElementById('currentTurnLabel');

wireDigitInputs(gameDigits, makeGuess);

function updateTurnUI() {
    const p = state.currentTurn; // 0 or 1
    const pNum = p + 1;
    const opNum = p === 0 ? 2 : 1;
    const icon = p === 0 ? '🟦' : '🟥';

    turnNameEl.textContent = `שחקן ${pNum}`;
    turnIndicator.className = 'turn-indicator ' + (p === 0 ? 'p1-turn' : 'p2-turn');

    currentTurnLabel.textContent = `${icon} תור שחקן ${pNum} — נחש את המספר של שחקן ${opNum}`;
    currentTurnLabel.className = 'current-turn-label ' + (p === 0 ? 'p1' : 'p2');

    // Highlight active panel
    document.getElementById('panel1').classList.toggle('active-panel', p === 0);
    document.getElementById('panel2').classList.toggle('active-panel', p === 1);

    // Clear game inputs
    gameDigits.forEach(inp => {
        inp.value = '';
        inp.classList.remove('bull', 'hit', 'miss');
    });
    gameMessage.textContent = '';
    gameMessage.className = 'message';
    guessBtn.disabled = false;
}

function makeGuess() {
    if (state.gameOver) return;

    const { valid, digits, error } = validateDigits(gameDigits);
    if (!valid) {
        gameMessage.textContent = error;
        gameMessage.className = 'message error';
        return;
    }

    const p = state.currentTurn;
    const opponentSecret = state.secrets[p === 0 ? 1 : 0]; // guessing the OTHER player's secret
    state.attempts[p]++;

    const result = calcResult(digits, opponentSecret);

    // Animate digit boxes
    gameDigits.forEach((input, i) => {
        input.classList.remove('bull', 'hit', 'miss');
        setTimeout(() => {
            if (digits[i] === opponentSecret[i]) input.classList.add('bull');
            else if (opponentSecret.includes(digits[i])) input.classList.add('hit');
            else input.classList.add('miss');
        }, i * 100);
    });

    // Add to the current player's history
    const historyEl = document.getElementById(`history${p + 1}`);
    addHistoryRow(historyEl, digits.join(''), result.bulls, result.hits);

    // Update attempt count
    document.getElementById(`attempts${p + 1}`).textContent = `${state.attempts[p]} ניחושים`;

    // Check win
    if (result.bulls === 4) {
        state.gameOver = true;
        guessBtn.disabled = true;
        setTimeout(() => showWinScreen(p), 600);
        return;
    }

    // Switch turns after a short delay
    gameMessage.textContent = '';
    setTimeout(() => {
        const nextPlayer = p === 0 ? 1 : 0;
        state.currentTurn = nextPlayer;
        state.phase = 'transition-turn';
        document.getElementById('transitionTitle').textContent = `תעבירו את המכשיר לשחקן ${nextPlayer + 1}`;
        showScreen('transitionScreen');
    }, 800);
}

function addHistoryRow(container, guessStr, bulls, hits) {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
        <span class="guess-num">${guessStr}</span>
        <span class="bulls">${'🎯'.repeat(bulls) || '—'}</span>
        <span class="hits">${'🔥'.repeat(hits) || '—'}</span>
    `;
    container.insertBefore(row, container.firstChild);
}

// ==================== Win Screen ====================

function showWinScreen(winner) {
    const pNum = winner + 1;
    document.getElementById('winTitle').textContent = `🎉 שחקן ${pNum} ניצח!`;
    document.getElementById('winDetails').textContent = `גילה את המספר הסודי ב-${state.attempts[winner]} ניחושים`;

    const summary = document.getElementById('winSummary');
    summary.innerHTML = `
        <div>🟦 <strong>שחקן 1</strong> — המספר הסודי: <strong style="direction:ltr;display:inline-block;letter-spacing:2px;">${state.secrets[0].join('')}</strong> (${state.attempts[0]} ניחושים)</div>
        <div>🟥 <strong>שחקן 2</strong> — המספר הסודי: <strong style="direction:ltr;display:inline-block;letter-spacing:2px;">${state.secrets[1].join('')}</strong> (${state.attempts[1]} ניחושים)</div>
    `;

    showScreen('winScreen');
    launchConfetti();
}

// ==================== New Game ====================

function resetAll() {
    state.secrets = [null, null];
    state.attempts = [0, 0];
    state.currentSetup = 0;
    state.currentTurn = 0;
    state.gameOver = false;
    state.phase = 'setup';

    // Reset setup
    resetSetupInputs();
    setupBadge.textContent = 'שחקן 1';
    setupBadge.className = 'player-badge p1';

    // Reset game
    document.getElementById('history1').innerHTML = '';
    document.getElementById('history2').innerHTML = '';
    document.getElementById('attempts1').textContent = '0 ניחושים';
    document.getElementById('attempts2').textContent = '0 ניחושים';
    gameDigits.forEach(inp => {
        inp.value = '';
        inp.classList.remove('bull', 'hit', 'miss');
    });
    gameMessage.textContent = '';
    gameMessage.className = 'message';

    // Remove confetti
    const canvas = document.getElementById('confetti');
    if (canvas) canvas.remove();

    showScreen('setupScreen');
    setupDigits[0].focus();
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
        if (frame < 200) {
            requestAnimationFrame(animate);
        } else {
            canvas.remove();
        }
    }
    animate();
}

// ==================== Init ====================

// Set initial badge style
setupBadge.className = 'player-badge p1';
showScreen('setupScreen');
setupDigits[0].focus();
