/* ============================
   GLOBALS
============================ */

const gridEl = document.getElementById("grid");
const optionsModal = document.getElementById("optionsModal");
const optionsBtn = document.getElementById("optionsBtn");

const sizeSelect = document.getElementById("sizeSelect");
const difficultySelect = document.getElementById("difficultySelect");
const timerSelect = document.getElementById("timerSelect");

const newGameBtn = document.getElementById("newGameBtn");
const careerModeBtn = document.getElementById("careerModeBtn");

const timerDisplay = document.getElementById("timerDisplay");
const gridHint = document.getElementById("gridHint");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const overlayBtn = document.getElementById("overlayBtn");

let size = 6;
let difficulty = "easy";
let lives = 5;
let maxLives = 5;
let solution = [];
let territories = [];
let foundCount = 0;
let gameActive = false;

let timerOn = false;
let timerSeconds = 0;
let timerInterval = null;

let careerActive = false;
let careerLevel = 1;

let logicMode = "subtle";
let clueMode = "heavy";

/* ============================
   UTILS
============================ */

function rand(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
}

/* ============================
   SOLUTION GENERATION
============================ */

function isSafe(board, r, c, n) {
    for (let i = 0; i < n; i++) {
        if (board[r][i] === 1) return false;
        if (board[i][c] === 1) return false;
    }

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < n && nc >= 0 && nc < n) {
                if (board[nr][nc] === 1) return false;
            }
        }
    }

    return true;
}

function generateSolution(n) {
    const board = Array.from({ length: n }, () => Array(n).fill(0));
    const positions = [];

    function backtrack(row) {
        if (row === n) return true;

        const cols = [...Array(n).keys()].sort(() => Math.random() - 0.5);

        for (const col of cols) {
            if (isSafe(board, row, col, n)) {
                board[row][col] = 1;
                positions.push({ row, col });

                if (backtrack(row + 1)) return true;

                positions.pop();
                board[row][col] = 0;
            }
        }
        return false;
    }

    backtrack(0);
    return positions;
}

/* ============================
   LOGIC-DRIVEN ANGULAR TERRITORIES
============================ */

function generateLogicDrivenTerritories(n, solutionLocal) {
    const grid = Array.from({ length: n }, () => Array(n).fill(-1));
    const territoriesLocal = Array.from({ length: n }, () => []);

    solutionLocal.forEach((chip, idx) => {
        const r = chip.row;
        const c = chip.col;

        let w, h;

        if (difficulty === "easy") {
            w = rand(2, 3);
            h = rand(2, 3);
        } else if (difficulty === "medium") {
            w = rand(2, 4);
            h = rand(2, 4);
        } else {
            w = rand(3, 5);
            h = rand(3, 5);
        }

        const r0 = Math.max(0, r - Math.floor(h / 2));
        const c0 = Math.max(0, c - Math.floor(w / 2));

        for (let rr = r0; rr < Math.min(n, r0 + h); rr++) {
            for (let cc = c0; cc < Math.min(n, c0 + w); cc++) {
                if (grid[rr][cc] === -1) {
                    grid[rr][cc] = idx;
                }
            }
        }

        if (grid[r][c] === -1) {
            grid[r][c] = idx;
        }
    });

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (grid[r][c] === -1) {
                let best = 0;
                let bestDist = Infinity;

                solutionLocal.forEach((chip, idx) => {
                    const dist = Math.abs(chip.row - r) + Math.abs(chip.col - c);
                    if (dist < bestDist) {
                        bestDist = dist;
                        best = idx;
                    }
                });

                grid[r][c] = best;
            }
        }
    }

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const id = r * n + c;
            const t = grid[r][c];
            territoriesLocal[t].push(id);
        }
    }

    territories = territoriesLocal;
    return territoriesLocal;
}

/* ============================
   CLUE MODE / LOGIC MODE
============================ */

function decideClueMode() {
    if (difficulty === "easy") {
        clueMode = "heavy";
    } else if (difficulty === "medium") {
        clueMode = "standard";
    } else {
        clueMode = "minimal";
    }
}

function analysePuzzle(n, territoriesLocal, solutionLocal) {
    let forcedMoves = 0;

    const possible = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => true)
    );

    for (let t = 0; t < territoriesLocal.length; t++) {
        const ids = territoriesLocal[t];
        let validCells = 0;

        ids.forEach(id => {
            const r = Math.floor(id / n);
            const c = id % n;
            if (possible[r][c]) validCells++;
        });

        if (validCells === 1) forcedMoves++;
    }

    for (let r = 0; r < n; r++) {
        let validCells = 0;
        for (let c = 0; c < n; c++) validCells++;
        if (validCells === 1) forcedMoves++;
    }

    for (let c = 0; c < n; c++) {
        let validCells = 0;
        for (let r = 0; r < n; r++) validCells++;
        if (validCells === 1) forcedMoves++;
    }

    return forcedMoves;
}

function decideLogicMode(n, territoriesLocal, solutionLocal) {
    const score = analysePuzzle(n, territoriesLocal, solutionLocal);
    logicMode = score < 2 ? "visual" : "subtle";
}

/* ============================
   STRICT VALID MATRIX
============================ */

function computeValidMatrixStrict() {
    const cells = gridEl.children;

    const valid = Array.from({ length: size }, () =>
        Array(size).fill(true)
    );

    const rowHasChip = Array(size).fill(false);
    const colHasChip = Array(size).fill(false);
    const territoryHasChip = Array(territories.length).fill(false);

    for (let i = 0; i < cells.length; i++) {
        if (cells[i].classList.contains("correct")) {
            const r = parseInt(cells[i].dataset.row);
            const c = parseInt(cells[i].dataset.col);
            const id = r * size + c;
            const t = territories.findIndex(t => t.includes(id));

            rowHasChip[r] = true;
            colHasChip[c] = true;
            territoryHasChip[t] = true;
        }
    }

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const id = r * size + c;
            const t = territories.findIndex(t => t.includes(id));

            if (rowHasChip[r]) valid[r][c] = false;
            if (colHasChip[c]) valid[r][c] = false;
            if (territoryHasChip[t]) valid[r][c] = false;

            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr;
                    const nc = c + dc;
                    if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
                    const adj = cells[nr * size + nc];
                    if (adj.classList.contains("correct")) {
                        valid[r][c] = false;
                    }
                }
            }
        }
    }

    return valid;
}

/* ============================
   FORCED MOVE EXTRACTION
============================ */

function extractForcedMoves(valid) {
    const forced = [];

    territories.forEach((territory, tIndex) => {
        const v = territory
            .map(id => ({ id, r: Math.floor(id / size), c: id % size }))
            .filter(cell => valid[cell.r][cell.c]);

        if (v.length === 1) {
            forced.push({
                type: "forced-territory",
                territory: tIndex,
                cell: v[0]
            });
        }
    });

    for (let r = 0; r < size; r++) {
        const v = [];
        for (let c = 0; c < size; c++) {
            if (valid[r][c]) v.push({ r, c });
        }
        if (v.length === 1) {
            forced.push({
                type: "forced-row",
                row: r,
                cell: v[0]
            });
        }
    }

    for (let c = 0; c < size; c++) {
        const v = [];
        for (let r = 0; r < size; r++) {
            if (valid[r][c]) v.push({ r, c });
        }
        if (v.length === 1) {
            forced.push({
                type: "forced-col",
                col: c,
                cell: v[0]
            });
        }
    }

    return forced;
}

/* ============================
   BINARY DEDUCTION
============================ */

function extractBinaryMoves(valid) {
    const binaries = [];

    territories.forEach((territory, tIndex) => {
        const v = territory
            .map(id => ({ id, r: Math.floor(id / size), c: id % size }))
            .filter(cell => valid[cell.r][cell.c]);

        if (v.length === 2) {
            binaries.push({
                type: "binary-territory",
                territory: tIndex,
                cells: v
            });
        }
    });

    return binaries;
}

/* ============================
   APPLY FORCED MOVES
============================ */

function applyForcedMoves(forced) {
    const cells = gridEl.children;

    forced.forEach(f => {
        const r = f.cell.r;
        const c = f.cell.c;
        const idx = r * size + c;
        const el = cells[idx];

        if (!el.classList.contains("correct")) {
            el.classList.add("correct");
            el.dataset.fixed = "true";
            foundCount++;
        }
    });
}

/* ============================
   STRICT DEDUCTION LOOP
============================ */

function runStrictDeduction() {
    let progress = true;

    while (progress) {
        progress = false;

        const valid = computeValidMatrixStrict();

        const forced = extractForcedMoves(valid);
        if (forced.length > 0) {
            applyForcedMoves(forced);
            progress = true;
            continue;
        }

        const binaries = extractBinaryMoves(valid);
        if (binaries.length > 0) {
            applyDeterministicClues(binaries);
        }

        markImpossibleCells();
    }
}

/* ============================
   FORCED START SPECTRUM
============================ */

function applyForcedStartSpectrum() {
    // Hard: no given start. Medium: sometimes. Easy: always.
    if (difficulty === "hard") return;

    const chance = difficulty === "easy" ? 1.0 : 0.6;
    if (Math.random() > chance) return;

    if (!solution.length) return;
    const idx = rand(0, solution.length - 1);
    const chip = solution[idx];

    const cells = gridEl.children;
    const id = chip.row * size + chip.col;
    const el = cells[id];
    if (!el) return;

    if (!el.classList.contains("correct")) {
        el.classList.add("correct");
        el.dataset.fixed = "true";
        foundCount++;
    }
}

/* ============================
   VISUAL CLUE APPLICATION
============================ */

function applyDeterministicClues(clues) {
    const cells = gridEl.children;

    for (let i = 0; i < cells.length; i++) {
        if (!cells[i].classList.contains("correct")) {
            cells[i].style.outline = "none";
            cells[i].style.backgroundColor = "";
        }
    }

    clues.forEach(clue => {
        if (clue.type === "binary-territory") {
            clue.cells.forEach(cell => {
                const idx = cell.r * size + cell.c;
                const el = cells[idx];
                el.style.outline = "2px dashed #ffcc00";
            });
        }
    });
}

/* ============================
   IMPOSSIBLE CELL MARKING
============================ */

function markImpossibleCells() {
    const cells = gridEl.children;
    const valid = computeValidMatrixStrict();

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const idx = r * size + c;
            const el = cells[idx];

            if (!valid[r][c] && !el.classList.contains("correct")) {
                el.style.opacity = "0.25";
            } else {
                el.style.opacity = "1";
            }
        }
    }
}

/* ============================
   GRID RENDERING
============================ */

const neonColors = [
    "#D4D4D4","#FF3B3B","#00C8FF","#00FF7A","#FF9A00",
    "#B300FF","#FFD700","#00FFE8","#FF00A8","#7AFF00",
    "#0066FF","#FF5CF0","#A6FF00","#FF6A00","#00FFCC","#C800FF"
];

function buildGrid() {
    gridEl.innerHTML = "";
    gridEl.style.position = "relative";
    gridEl.style.gridTemplateColumns = `repeat(${size}, 48px)`;
    gridEl.style.gridTemplateRows = `repeat(${size}, 48px)`;

    const territoryColors = territories.map((_, i) => neonColors[i % neonColors.length]);

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = r;
            cell.dataset.col = c;

            const id = r * size + c;
            const territoryIndex = territories.findIndex(t => t.includes(id));
            const color = territoryColors[territoryIndex];

            cell.style.background = `linear-gradient(135deg, ${color}55, ${color}22)`;
            cell.style.border = "2px solid " + color + "55";
            cell.style.boxShadow = "inset 0 0 8px " + color + "55";

            let clickTimeout = null;

            cell.addEventListener("mouseover", () => {
                if (logicMode === "visual") highlightHover(r, c);
            });

            cell.addEventListener("mouseout", () => {
                if (logicMode === "visual") clearHover();
            });

            cell.addEventListener("click", () => {
                if (!gameActive) return;
                if (cell.dataset.fixed === "true") return;
                if (clickTimeout) return;
                clickTimeout = setTimeout(() => {
                    clickTimeout = null;
                    handleSingleClick(cell);
                }, 200);
            });

            cell.addEventListener("dblclick", () => {
                if (!gameActive) return;
                if (cell.dataset.fixed === "true") return;
                if (clickTimeout) {
                    clearTimeout(clickTimeout);
                    clickTimeout = null;
                }
                handleDoubleClick(cell);
            });

            gridEl.appendChild(cell);
        }
    }

    markImpossibleCells();

    const valid = computeValidMatrixStrict();
    const binaries = extractBinaryMoves(valid);
    applyDeterministicClues(binaries);
}

/* ============================
   HOVER LOGIC
============================ */

function highlightHover(r, c) {
    const cells = gridEl.children;

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const rr = parseInt(cell.dataset.row);
        const cc = parseInt(cell.dataset.col);

        let conflict = false;

        if (rr === r || cc === c) conflict = true;

        const id = rr * size + cc;
        const tid = r * size + c;

        const t1 = territories.findIndex(t => t.includes(id));
        const t2 = territories.findIndex(t => t.includes(tid));

        if (t1 === t2) conflict = true;

        if (Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1) conflict = true;

        if (conflict) {
            cell.style.outline = "2px solid #ff3366";
        }
    }
}

function clearHover() {
    const cells = gridEl.children;
    for (let i = 0; i < cells.length; i++) {
        if (!cells[i].classList.contains("correct")) {
            cells[i].style.outline = "none";
        }
    }
}

/* ============================
   CELL INTERACTION
============================ */

function handleSingleClick(cell) {
    if (cell.dataset.fixed === "true") return;
    if (cell.classList.contains("correct")) return;
    cell.classList.toggle("blocked");
}

function handleDoubleClick(cell) {
    if (cell.dataset.fixed === "true") return;
    if (cell.classList.contains("correct")) return;

    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);

    if (cell.classList.contains("chip")) {
        cell.classList.remove("chip");
        return;
    }

    cell.classList.remove("blocked");
    cell.classList.add("chip");

    if (solution.some(p => p.row === r && p.col === c)) {
        cell.classList.remove("chip");
        cell.classList.add("correct");
        cell.dataset.fixed = "true";
        foundCount++;

        runStrictDeduction();

        if (foundCount === solution.length) {
            winGame();
            return;
        }

    } else {
        cell.classList.add("wrong");
        lives--;
        if (lives <= 0) failGame("Incorrect microchip. Bomb detonated.");
    }
}

/* ============================
   TIMER
============================ */

function startTimer() {
    if (!timerOn) return;
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        timerSeconds--;
        updateTimerDisplay();
        if (timerSeconds <= 0) failGame("Time expired.");
    }, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
}

function updateTimerDisplay() {
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
    const s = String(timerSeconds % 60).padStart(2, "0");
    timerDisplay.textContent = `${m}:${s}`;
}

window.addEventListener("blur", pauseTimer);
window.addEventListener("focus", () => {
    if (gameActive && timerOn) startTimer();
});

/* ============================
   GAME FLOW
============================ */

function startNormalGame() {
    careerActive = false;

    size = parseInt(sizeSelect.value);
    difficulty = difficultySelect.value;
    timerOn = timerSelect.value === "on";

    maxLives = difficulty === "easy" ? 5 :
               difficulty === "medium" ? 3 : 1;
    lives = maxLives;

    solution = generateSolution(size);
    territories = generateLogicDrivenTerritories(size, solution);
    foundCount = 0;
    gameActive = true;

    decideClueMode();
    decideLogicMode(size, territories, solution);

    buildGrid();
    applyForcedStartSpectrum();
    runStrictDeduction();

    if (timerOn) {
        timerSeconds = Math.floor(size * size * (difficulty === "easy" ? 0.9 : difficulty === "medium" ? 1.2 : 1.5));
        updateTimerDisplay();
        startTimer();
    } else {
        timerDisplay.textContent = "OFF";
    }

    gridHint.textContent = "Bomb armed. Locate all microchips.";
    optionsModal.classList.remove("visible");
}

function startCareerMode() {
    careerActive = true;
    careerLevel = 1;
    startCareerLevel();
    optionsModal.classList.remove("visible");
}

function startCareerLevel() {
    size = 5 + careerLevel;
    difficulty = "hard";
    timerOn = true;

    maxLives = 1;
    lives = 1;

    solution = generateSolution(size);
    territories = generateLogicDrivenTerritories(size, solution);
    foundCount = 0;
    gameActive = true;

    decideClueMode();
    decideLogicMode(size, territories, solution);

    buildGrid();
    applyForcedStartSpectrum();
    runStrictDeduction();

    timerSeconds = Math.floor(size * size * 1.5);
    updateTimerDisplay();
    startTimer();

    gridHint.textContent = `Career Level ${careerLevel}`;
}

/* ============================
   WIN / FAIL
============================ */

function winGame() {
    pauseTimer();
    gameActive = false;

    overlay.classList.add("visible");
    overlayTitle.textContent = "Bomb Defused";
    overlayTitle.className = "overlay-title success";

    if (careerActive) {
        if (careerLevel < 7) {
            overlayText.textContent = `Level ${careerLevel} cleared. Prepare for Level ${careerLevel + 1}.`;
        } else {
            overlayText.textContent = `You cleared all levels! Career complete.`;
        }
    } else {
        overlayText.textContent = "All microchips located. System stabilized.";
    }
}

function failGame(reason) {
    pauseTimer();
    gameActive = false;

    overlay.classList.add("visible");
    overlayTitle.textContent = "Detonation";
    overlayTitle.className = "overlay-title fail";

    if (careerActive) {
        overlayText.textContent = `${reason} Restarting Career Mode at Level 1.`;
    } else {
        overlayText.textContent = reason;
    }
}

/* ============================
   OVERLAY BUTTON
============================ */

overlayBtn.addEventListener("click", () => {
    overlay.classList.remove("visible");

    if (careerActive) {
        if (foundCount === solution.length) {
            careerLevel++;
            if (careerLevel > 7) careerLevel = 1;
        } else {
            careerLevel = 1;
        }
        startCareerLevel();
    } else {
        startNormalGame();
    }
});

/* ============================
   MODAL / BUTTONS
============================ */

optionsBtn.addEventListener("click", () => {
    optionsModal.classList.add("visible");
});

newGameBtn.addEventListener("click", startNormalGame);
careerModeBtn.addEventListener("click", startCareerMode);

/* ============================
   INIT
============================ */

updateTimerDisplay();
