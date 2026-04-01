// audio.js - Web Audio API Sound Generator for Neon Breakout

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Attach initAudio to user interactions to unlock audio content in browsers
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });

function playTone(freq, type, duration, vol=0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const Sound = {
    paddleHit: () => playTone(300, 'square', 0.1, 0.1),
    wallHit: () => playTone(400, 'square', 0.1, 0.1),
    brickHit: () => playTone(600, 'sine', 0.1, 0.2),
    laserShoot: () => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    itemCatch: () => {
        playTone(600, 'sine', 0.1);
        setTimeout(() => playTone(800, 'sine', 0.1), 100);
        setTimeout(() => playTone(1200, 'sine', 0.2), 200);
    },
    loseLife: () => {
        playTone(200, 'sawtooth', 0.5, 0.2);
        setTimeout(() => playTone(150, 'sawtooth', 0.5, 0.2), 200);
    },
    levelComplete: () => {
        playTone(400, 'sine', 0.1);
        setTimeout(() => playTone(500, 'sine', 0.1), 100);
        setTimeout(() => playTone(600, 'sine', 0.1), 200);
        setTimeout(() => playTone(800, 'sine', 0.3), 300);
    }
};
