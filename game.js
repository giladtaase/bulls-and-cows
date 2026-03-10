// ==================== Bulls & Cows Game ====================

let secret = [];
let attempts = 0;
let gameOver = false;

// Generate a random 4-digit number with unique digits
function generateSecret() {
    const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    // Shuffle
    for (let i = digits.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    // Take first 4, but ensure first digit is not 0
    let result = digits.slice(0, 4);
    if (result[0] === 0) {
        // Swap with a non-zero digit from the remaining
        const nonZeroIdx = result.findIndex(d => d !== 0);
        [result[0], result[nonZeroIdx]] = [result[nonZeroIdx], result[0]];
    }
    return result;
}

// Calculate bulls and hits
function calcResult(guess, secret) {
    let bulls = 0;
    let hits = 0;
    for (let i = 0; i < 4; i++) {
        if (guess[i] === secret[i]) {
            bulls++;
        } else if (secret.includes(guess[i])) {
            hits++;
        }
    }
    return { bulls, hits };
}

// DOM Elements
const digitInputs = document.querySelectorAll('.digit-box');
const guessBtn = document.getElementById('guessBtn');
const messageEl = document.getElementById('message');
const historyEl = document.getElementById('history');

// Auto-advance between digit boxes
digitInputs.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
        const val = e.target.value;
        // Only allow single digit
        if (!/^\d$/.test(val)) {
            e.target.value = '';
            return;
        }
        // Move to next box
        if (idx < 3) {
            digitInputs[idx + 1].focus();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
            digitInputs[idx - 1].focus();
        }
        if (e.key === 'Enter') {
            makeGuess();
        }
    });

    // Select all text on focus
    input.addEventListener('focus', () => {
        setTimeout(() => input.select(), 0);
    });
});

// Make a guess
function makeGuess() {
    if (gameOver) return;

    // Collect digits
    const guess = [];
    for (const input of digitInputs) {
        const val = input.value.trim();
        if (!/^\d$/.test(val)) {
            showMessage('יש להזין 4 ספרות!', 'error');
            input.focus();
            return;
        }
        guess.push(parseInt(val));
    }

    // Check for duplicate digits
    if (new Set(guess).size !== 4) {
        showMessage('כל הספרות חייבות להיות שונות!', 'error');
        return;
    }

    attempts++;
    const result = calcResult(guess, secret);

    // Animate digit boxes
    digitInputs.forEach((input, i) => {
        input.classList.remove('bull', 'hit', 'miss');
        setTimeout(() => {
            if (guess[i] === secret[i]) {
                input.classList.add('bull');
            } else if (secret.includes(guess[i])) {
                input.classList.add('hit');
            } else {
                input.classList.add('miss');
            }
        }, i * 100);
    });

    // Add to history
    addHistoryRow(guess.join(''), result.bulls, result.hits);

    // Check win
    if (result.bulls === 4) {
        gameOver = true;
        showMessage(`🎉 כל הכבוד! מצאת את המספר ב-${attempts} ניחושים!`, 'win');
        guessBtn.disabled = true;
        launchConfetti();
    } else {
        showMessage('');
        // Clear inputs for next guess
        setTimeout(() => {
            digitInputs.forEach(input => input.value = '');
            digitInputs[0].focus();
        }, 500);
    }
}

function addHistoryRow(guessStr, bulls, hits) {
    const row = document.createElement('div');
    row.className = 'history-row';
    row.innerHTML = `
        <span class="guess-num">${guessStr}</span>
        <span class="bulls">${'🎯'.repeat(bulls) || '—'}</span>
        <span class="hits">${'🔥'.repeat(hits) || '—'}</span>
    `;
    historyEl.insertBefore(row, historyEl.firstChild);
}

function showMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = 'message ' + type;
}

function newGame() {
    secret = generateSecret();
    attempts = 0;
    gameOver = false;
    historyEl.innerHTML = '';
    messageEl.textContent = '';
    messageEl.className = 'message';
    guessBtn.disabled = false;
    digitInputs.forEach(input => {
        input.value = '';
        input.classList.remove('bull', 'hit', 'miss');
    });
    digitInputs[0].focus();

    // Remove confetti if exists
    const canvas = document.getElementById('confetti');
    if (canvas) canvas.remove();
}

// ==================== Confetti Effect ====================
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

// Start the game
newGame();
