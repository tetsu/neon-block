const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

const scoreDisplay = document.getElementById('score-display');
const startScreen = document.getElementById('start-screen');
const stageScreen = document.getElementById('stage-screen');
const stageTitle = document.getElementById('stage-title');
const gameOverScreen = document.getElementById('game-over-screen');
const victoryScreen = document.getElementById('victory-screen');
const finalScoreSpan = document.getElementById('final-score');
const victoryScoreSpan = document.getElementById('victory-score');
const mobileControls = document.getElementById('mobile-controls');

document.getElementById('start-btn').addEventListener('click', () => setGameState(GameState.STAGE_TRANSITION));
document.getElementById('restart-btn').addEventListener('click', () => { currentLevel = 0; score = 0; lives = 3; setGameState(GameState.STAGE_TRANSITION); });
document.getElementById('play-again-btn').addEventListener('click', () => { currentLevel = 0; score = 0; lives = 3; setGameState(GameState.STAGE_TRANSITION); });
document.getElementById('ending-restart-btn').addEventListener('click', () => { currentLevel = 0; score = 0; lives = 3; setGameState(GameState.START); });

const GameState = { START: 0, STAGE_TRANSITION: 1, PLAYING: 2, GAME_OVER: 3, VICTORY: 4, ENDING: 5 };

const PADDLE_COLOR = '#00f3ff';
const BALL_COLOR = '#ff00ea';
const BRICK_COLORS = ['#ff00ea', '#39ff14', '#00f3ff', '#fffb00'];

// LEVELS array is now externalized in levels.js

const ITEM_TYPES = [
    { type: 'EXPAND', color: '#00f3ff', text: '< >' },
    { type: 'LIFE', color: '#ff00ea', text: '1UP' },
    { type: 'MULTI', color: '#39ff14', text: 'x3' },
    { type: 'SLOW', color: '#fffb00', text: 'SLW' },
    { type: 'LASER', color: '#ff3333', text: 'GUN' }
];

let currentState = GameState.START;
let score = 0;
let lives = 3;
let currentLevel = 0;
let animationId;
let transitionTimeoutId;

let rightPressed = false;
let leftPressed = false;

const paddle = {
    baseWidth: 100,
    width: 100,
    height: 15,
    x: GAME_WIDTH / 2 - 50,
    y: GAME_HEIGHT - 30,
    speed: 8,
    expandTimer: 0,
    laserTimer: 0,
    hasLaser: false,
    draw: function() {
        ctx.shadowBlur = 15;
        let color = this.hasLaser ? '#ff3333' : PADDLE_COLOR;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 5);
        ctx.fill();
        
        if (this.hasLaser) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x + 10, this.y - 5, 5, 10);
            ctx.fillRect(this.x + this.width - 15, this.y - 5, 5, 10);
        }
        ctx.shadowBlur = 0;
    },
    update: function() {
        if (this.expandTimer > 0) {
            this.expandTimer--;
            if (this.expandTimer <= 0) this.width = this.baseWidth;
        }

        if (this.laserTimer > 0) {
            this.laserTimer--;
            if (this.laserTimer <= 0) {
                this.hasLaser = false;
                mobileControls.style.display = 'none';
            }
        }

        if (rightPressed && this.x < GAME_WIDTH - this.width) {
            this.x += this.speed;
        } else if (leftPressed && this.x > 0) {
            this.x -= this.speed;
        }
    }
};

class Ball {
    constructor(x, y, dx, dy) {
        this.radius = 8;
        this.x = x;
        this.y = y;
        this.dx = dx;
        this.dy = dy;
        this.speedMult = 1;
        this.active = true;
        this.attached = true;
    }
    
    draw() {
        if (!this.active) return;
        ctx.shadowBlur = 15;
        ctx.shadowColor = BALL_COLOR;
        ctx.fillStyle = BALL_COLOR;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    
    update() {
        if (!this.active) return;
        if (this.attached) {
            this.x = paddle.x + paddle.width / 2;
            this.y = paddle.y - this.radius;
            return;
        }
        this.x += this.dx * this.speedMult;
        this.y += this.dy * this.speedMult;

        if (this.x + this.radius > GAME_WIDTH || this.x - this.radius < 0) {
            this.dx = -this.dx;
            Sound.wallHit();
        }
        
        if (this.y - this.radius < 0) {
            this.dy = -this.dy;
            Sound.wallHit();
        } else if (this.y + this.radius > GAME_HEIGHT) {
            this.active = false;
        }

        if (this.y + this.radius > paddle.y && this.y - this.radius < paddle.y + paddle.height &&
            this.x + this.radius > paddle.x && this.x - this.radius < paddle.x + paddle.width) {
            
            Sound.paddleHit();
            let hitPoint = this.x - (paddle.x + paddle.width / 2);
            let normalizedHit = hitPoint / (paddle.width / 2);
            let angle = normalizedHit * (Math.PI / 3); 
            
            let speed = Math.sqrt(this.dx*this.dx + this.dy*this.dy);
            this.dx = speed * Math.sin(angle);
            this.dy = -speed * Math.cos(angle);
            
            this.y = paddle.y - this.radius; 
            this.speedMult = Math.min(this.speedMult + 0.05, 1.8);
        }
    }
}

let balls = [];
let items = [];
let bullets = [];

function spawnBall() {
    balls.push(new Ball(paddle.x + paddle.width / 2, paddle.y - 15, 4, -4));
}

function resetLevelState() {
    balls = [];
    spawnBall();
    paddle.width = paddle.baseWidth;
    paddle.expandTimer = 0;
    paddle.laserTimer = 0;
    paddle.hasLaser = false;
    mobileControls.style.display = 'none';
    paddle.x = GAME_WIDTH / 2 - paddle.width / 2;
    items = [];
    bullets = [];
}

const brickRowCount = 5;
const brickColumnCount = 9;
const brickPadding = 15;
const brickOffsetTop = 50;
const brickOffsetLeft = 35;
const brickWidth = 65;
const brickHeight = 20;
let bricks = [];

function loadLevel(levelIndex) {
    bricks = [];
    let layout = LEVELS[levelIndex % LEVELS.length];
    for (let c = 0; c < brickColumnCount; c++) {
        bricks[c] = [];
        for (let r = 0; r < brickRowCount; r++) {
            let type = layout[r][c];
            if (type > 0) {
                bricks[c][r] = { x: 0, y: 0, status: 1, color: BRICK_COLORS[type - 1] };
            } else {
                bricks[c][r] = { x: 0, y: 0, status: 0, color: null };
            }
        }
    }
    resetLevelState();
}

function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            if (bricks[c][r] && bricks[c][r].status === 1) {
                let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
                let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
                bricks[c][r].x = brickX;
                bricks[c][r].y = brickY;
                
                ctx.shadowBlur = 10;
                ctx.shadowColor = bricks[c][r].color;
                ctx.fillStyle = bricks[c][r].color;
                ctx.beginPath();
                ctx.roundRect(brickX, brickY, brickWidth, brickHeight, 3);
                ctx.fill();
            }
        }
    }
    ctx.shadowBlur = 0;
}

function spawnItem(x, y) {
    if (Math.random() < 0.25) { // 25% drop rate
        let itemType = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
        items.push({ x: x, y: y, width: 30, height: 15, type: itemType, active: true, dy: 3 });
    }
}

function updateDrawItems() {
    for (let i = 0; i < items.length; i++) {
        let it = items[i];
        if (!it.active) continue;
        
        it.y += it.dy;
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = it.type.color;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeStyle = it.type.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(it.x, it.y, it.width, it.height, 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = it.type.color;
        ctx.font = "10px Orbitron";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(it.type.text, it.x + it.width/2, it.y + it.height/2 + 1);
        
        if (it.y + it.height > paddle.y && it.y < paddle.y + paddle.height &&
            it.x + it.width > paddle.x && it.x < paddle.x + paddle.width) {
            
            it.active = false;
            Sound.itemCatch();
            applyItem(it.type.type);
            score += 50;
        }
        
        if (it.y > GAME_HEIGHT) it.active = false;
    }
}

function applyItem(type) {
    if (type === 'EXPAND') {
        paddle.width = 150;
        paddle.expandTimer = 600; // 10 seconds
    } else if (type === 'LIFE') {
        lives++;
    } else if (type === 'MULTI') {
        let activeBall = balls.find(b => b.active) || new Ball(paddle.x, paddle.y-10, 4, -4);
        let b1 = new Ball(activeBall.x, activeBall.y, 4, -4);
        let b2 = new Ball(activeBall.x, activeBall.y, -4, -4);
        b1.attached = false;
        b2.attached = false;
        balls.push(b1);
        balls.push(b2);
    } else if (type === 'SLOW') {
        balls.forEach(b => b.speedMult = 0.8);
    } else if (type === 'LASER') {
        paddle.hasLaser = true;
        paddle.laserTimer = 600; // 10 seconds
        mobileControls.style.display = 'block'; // Show shoot button
    }
}

function shootBullets() {
    if (paddle.hasLaser && bullets.length < 8) { // max bullets on screen
        Sound.laserShoot();
        bullets.push({ x: paddle.x + 10, y: paddle.y - 10, dy: -8, active: true });
        bullets.push({ x: paddle.x + paddle.width - 15, y: paddle.y - 10, dy: -8, active: true });
    }
}

function updateDrawBullets() {
    for (let i = 0; i < bullets.length; i++) {
        let b = bullets[i];
        if (!b.active) continue;
        
        b.y += b.dy;
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff3333';
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.rect(b.x, b.y, 5, 10);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        if (b.y < 0) b.active = false;
    }
}

function collisionDetection() {
    let activeBricks = 0;
    for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
            let b = bricks[c][r];
            if (b && b.status === 1) {
                activeBricks++;
                
                // Ball collision
                balls.forEach(ball => {
                    if (ball.active && ball.x + ball.radius > b.x && ball.x - ball.radius < b.x + brickWidth &&
                        ball.y + ball.radius > b.y && ball.y - ball.radius < b.y + brickHeight) {
                        ball.dy = -ball.dy;
                        b.status = 0;
                        Sound.brickHit();
                        score += 10;
                        activeBricks--;
                        spawnItem(b.x + brickWidth/2 - 15, b.y + brickHeight/2 - 7.5);
                    }
                });

                // Bullet collision
                bullets.forEach(bullet => {
                    if (bullet.active && bullet.x + 5 > b.x && bullet.x < b.x + brickWidth &&
                        bullet.y + 10 > b.y && bullet.y < b.y + brickHeight) {
                        bullet.active = false;
                        b.status = 0;
                        Sound.brickHit();
                        score += 10;
                        activeBricks--;
                        spawnItem(b.x + brickWidth/2 - 15, b.y + brickHeight/2 - 7.5);
                    }
                });
            }
        }
    }
    
    // Check level clear
    if (activeBricks <= 0 && currentState === GameState.PLAYING) {
        currentLevel++;
        Sound.levelComplete();
        if (currentLevel >= LEVELS.length) {
            setGameState(GameState.ENDING);
        } else {
            setGameState(GameState.STAGE_TRANSITION);
        }
    }
}

document.addEventListener("keydown", keyDownHandler, false);
document.addEventListener("keyup", keyUpHandler, false);
canvas.addEventListener("mousemove", mouseMoveHandler, false);
canvas.addEventListener("touchmove", touchMoveHandler, { passive: false });
canvas.addEventListener("mousedown", handleAction, false);
canvas.addEventListener("touchstart", handleAction, { passive: false });
document.getElementById('shoot-btn').addEventListener('touchstart', (e) => { e.preventDefault(); shootBullets(); });
document.getElementById('shoot-btn').addEventListener('mousedown', (e) => { e.preventDefault(); shootBullets(); });

function handleAction(e) {
    if (currentState !== GameState.PLAYING) return;
    // Launch ball if attached
    let launched = false;
    balls.forEach(b => {
        if (b.active && b.attached) {
            b.attached = false;
            launched = true;
        }
    });
    // If no balls were attached, shoot lasers
    if (!launched && paddle.hasLaser && e.target !== document.getElementById('shoot-btn')) {
        // Just allows tapping the canvas itself to shoot if preferred
        shootBullets();
    }
}

function keyDownHandler(e) {
    if (e.key == "Right" || e.key == "ArrowRight") rightPressed = true;
    else if (e.key == "Left" || e.key == "ArrowLeft") leftPressed = true;
    else if (e.key == " " || e.key == "Spacebar") {
        if (currentState === GameState.PLAYING) {
            let launched = false;
            balls.forEach(b => {
                if (b.active && b.attached) {
                    b.attached = false;
                    launched = true;
                }
            });
            if (!launched) shootBullets();
        }
    }
}

function keyUpHandler(e) {
    if (e.key == "Right" || e.key == "ArrowRight") rightPressed = false;
    else if (e.key == "Left" || e.key == "ArrowLeft") leftPressed = false;
}

function mouseMoveHandler(e) {
    if (currentState !== GameState.PLAYING) return;
    let canvasRect = canvas.getBoundingClientRect();
    let relativeX = e.clientX - canvasRect.left;
    let scaleX = canvas.width / canvasRect.width;
    let canvasX = relativeX * scaleX;

    if (canvasX > 0 && canvasX < GAME_WIDTH) {
        paddle.x = canvasX - paddle.width / 2;
        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x + paddle.width > GAME_WIDTH) paddle.x = GAME_WIDTH - paddle.width;
    }
}

function touchMoveHandler(e) {
    if (currentState !== GameState.PLAYING) return;
    e.preventDefault();
    let touch = e.touches[0];
    let canvasRect = canvas.getBoundingClientRect();
    let relativeX = touch.clientX - canvasRect.left;
    let scaleX = canvas.width / canvasRect.width;
    let canvasX = relativeX * scaleX;

    if (canvasX > 0 && canvasX < GAME_WIDTH) {
        paddle.x = canvasX - paddle.width / 2;
        if (paddle.x < 0) paddle.x = 0;
        if (paddle.x + paddle.width > GAME_WIDTH) paddle.x = GAME_WIDTH - paddle.width;
    }
}

function setGameState(state) {
    if (transitionTimeoutId) clearTimeout(transitionTimeoutId);
    let previousState = currentState;
    currentState = state;
    
    startScreen.classList.remove('show');
    stageScreen.classList.remove('show');
    gameOverScreen.classList.remove('show');
    victoryScreen.classList.remove('show');
    const endingScreen = document.getElementById('ending-screen');
    endingScreen.classList.remove('show');
    
    if (state === GameState.START) {
        startScreen.classList.add('show');
    } else if (state === GameState.STAGE_TRANSITION) {
        if (previousState !== GameState.PLAYING) {
            // First time playing, reset all
            initGame(false);
        } else {
            // Advancing levels
            loadLevel(currentLevel);
        }
        stageTitle.innerText = `STAGE ${currentLevel + 1}`;
        stageScreen.classList.add('show');
        
        // Show stage screen for 2 seconds then enter PLAYING
        drawBricks(); // Just drawing once behind the screen
        transitionTimeoutId = setTimeout(() => {
            setGameState(GameState.PLAYING);
        }, 2000);

    } else if (state === GameState.PLAYING) {
        if (animationId) cancelAnimationFrame(animationId);
        draw();
    } else if (state === GameState.GAME_OVER) {
        finalScoreSpan.innerText = score;
        gameOverScreen.classList.add('show');
        mobileControls.style.display = 'none';
        cancelAnimationFrame(animationId);
    } else if (state === GameState.VICTORY) {
        victoryScoreSpan.innerText = score;
        victoryScreen.classList.add('show');
        mobileControls.style.display = 'none';
        cancelAnimationFrame(animationId);
    } else if (state === GameState.ENDING) {
        mobileControls.style.display = 'none';
        endingScreen.classList.add('show');
        
        const scrollContainer = endingScreen.querySelector('.scroll-container');
        const endBtn = document.getElementById('ending-restart-btn');
        endBtn.classList.remove('show');
        scrollContainer.classList.remove('animate');
        
        // force reflow to restart animation
        void scrollContainer.offsetWidth; 
        
        scrollContainer.classList.add('animate');
        setTimeout(() => {
            endBtn.classList.add('show');
        }, 15000); // Wait for scroll
        cancelAnimationFrame(animationId);
    }
}

function drawUI() {
    scoreDisplay.innerText = `Level: ${currentLevel + 1} | Score: ${score} | Lives: ${lives}`;
}

function initGame(startDraw = true) {
    score = 0;
    lives = 3;
    currentLevel = 0;
    loadLevel(currentLevel);
    if (animationId) cancelAnimationFrame(animationId);
    if (startDraw) draw();
}

function draw() {
    if (currentState !== GameState.PLAYING) return;
    
    ctx.fillStyle = 'rgba(5, 5, 8, 0.4)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    drawBricks();
    updateDrawItems();
    updateDrawBullets();
    paddle.draw();
    
    balls.forEach(b => b.draw());
    drawUI();
    
    collisionDetection();
    paddle.update();
    balls.forEach(b => b.update());
    
    // Clean up dead objects
    bullets = bullets.filter(b => b.active);
    items = items.filter(i => i.active);
    balls = balls.filter(b => b.active);

    // Check if all balls are dead
    if (balls.length === 0) {
        lives--;
        Sound.loseLife();
        if (lives <= 0) {
            setGameState(GameState.GAME_OVER);
            return;
        } else {
            resetLevelState();
        }
    }
    
    animationId = requestAnimationFrame(draw);
}

// Ensure first page load sits at START
setGameState(GameState.START);
