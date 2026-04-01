// levels.js - Procedurally generates 100 stages for Neon Block

const LEVELS = [];

// A lightweight seeded random number generator
function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

function generatePattern(levelIndex) {
    const layout = [];
    const seed = levelIndex + 1234;
    const patternType = levelIndex % 5;
    const dominantColor = (levelIndex % 4) + 1;

    for (let r = 0; r < 5; r++) {
        let row = [];
        for (let c = 0; c < 9; c++) {
            let val = 0;
            
            // Introduce new level ideas per 20 levels
            if (levelIndex < 20) {
                // simple horizontal stripes
                if (r % 2 === 0) val = dominantColor;
                else val = (dominantColor % 4) + 1;
                // random holes
                if (seededRandom(seed + r*10 + c) < 0.2) val = 0;
            } else if (levelIndex < 40) {
                // checkerboard
                if ((r + c) % 2 === 0) val = dominantColor;
                else val = 0;
                if (seededRandom(seed + r*13 + c) < 0.1) val = (levelIndex % 3) + 1;
            } else if (levelIndex < 60) {
                // diamond/pyramid
                let dist = Math.abs(c - 4) + r;
                if (dist < 5) val = dominantColor;
                else val = (dominantColor % 4) + 1;
                if (dist > 6) val = 0;
            } else if (levelIndex < 80) {
                // symmetrical random
                let symC = c < 5 ? c : 8 - c;
                if (seededRandom(seed * symC + r) > 0.4) val = (symC % 4) + 1;
            } else {
                // chaos mode
                if (seededRandom(seed + r*7 + c) > 0.3) {
                    val = Math.floor(seededRandom(seed*2 + r + c*3) * 4) + 1;
                }
            }
            
            // Force at least some blocks so level isn't empty
            if (val === 0 && r === 2 && c === 4) val = dominantColor;
            row.push(val);
        }
        layout.push(row);
    }
    return layout;
}

// Generate the 100 levels
for (let i = 0; i < 100; i++) {
    LEVELS.push(generatePattern(i));
}
