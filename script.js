// --- 1. SETUP PIXI APP ---
const box = 40; 
const gridCount = 15;

const app = new PIXI.Application({
    width: box * gridCount, 
    height: box * gridCount,
    backgroundColor: 0x578a34, // Base forest green
    antialias: true
});
document.getElementById('game-container').appendChild(app.view);

// --- 2. GAME VARIABLES ---
let score = 0;
let direction = "RIGHT";
let snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
let food = { x: 5, y: 5 };
let fruitType = 0; // 0 = Apple, 1 = Banana, 2 = Orange
let frameCount = 0;
let isGameOver = false;
let gameInterval = null; // Stores the timer for the game loop

// --- 3. SOUND SYSTEM ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'eat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'die') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(500, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.6);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    } else if (type === 'move') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    }
}

// --- 4. LAYERS ---
const boardLayer = new PIXI.Container();
const foodLayer = new PIXI.Container();
const snakeLayer = new PIXI.Container();
const uiLayer = new PIXI.Container();

app.stage.addChild(boardLayer, foodLayer, snakeLayer, uiLayer);

// --- 5. DRAWING FUNCTIONS ---
function drawBoard() {
    boardLayer.removeChildren();
    for (let y = 0; y < gridCount; y++) {
        for (let x = 0; x < gridCount; x++) {
            const tile = new PIXI.Graphics();
            const color = (x + y) % 2 === 0 ? 0xaad751 : 0xa2d149;
            tile.beginFill(color);
            tile.drawRect(x * box, y * box, box, box);
            tile.endFill();
            boardLayer.addChild(tile);
        }
    }
}

function drawFood() {
    foodLayer.removeChildren();
    const f = new PIXI.Graphics();
    const cx = food.x * box + box / 2;
    const cy = food.y * box + box / 2;
    f.position.set(cx, cy);

    f.beginFill(0x000000, 0.3);
    f.drawCircle(4, 4, box / 2 - 4);
    f.endFill();

    if (fruitType === 0) { // APPLE
        f.beginFill(0xff3333); f.drawCircle(0, 0, box / 2 - 4); f.endFill();
        f.beginFill(0x006400); f.drawEllipse(2, - (box * 0.3), 3, 6); f.endFill();
    } else if (fruitType === 1) { // BANANA
        f.rotation = Math.PI / 4; 
        f.beginFill(0xFFEB3B); f.drawEllipse(0, 0, box / 2 - 2, box / 5); f.endFill();
        f.beginFill(0x3E2723); f.drawCircle(-(box/2 - 2), 0, 2); f.drawCircle((box/2 - 2), 0, 2); f.endFill();
    } else { // ORANGE
        f.beginFill(0xFF9800); f.drawCircle(0, 0, box / 2 - 4); f.endFill();
        f.beginFill(0xE65100); f.drawCircle(-5, -5, 1.5); f.drawCircle(5, 5, 1.5); f.drawCircle(-5, 5, 1.5); f.drawCircle(5, -5, 1.5); f.endFill();
        f.beginFill(0x2E7D32); f.drawEllipse(0, - (box * 0.35), 4, 3); f.endFill();
    }
    foodLayer.addChild(f);
}

function drawSnake() {
    snakeLayer.removeChildren();
    const bodyColor = 0x448AFF;   
    const darkColor = 0x2962FF;   
    const shineColor = 0x82B1FF;  
    const cycleLength = 83; 
    const openDuration = 12; 
    const isMouthOpen = (frameCount % cycleLength) < openDuration;

    // Connectors
    snake.forEach((seg, i) => {
        if (i < snake.length - 1) {
            const nextSeg = snake[i + 1];
            const s = new PIXI.Graphics();
            const cx = seg.x * box + box / 2;
            const cy = seg.y * box + box / 2;
            const nextCx = nextSeg.x * box + box / 2;
            const nextCy = nextSeg.y * box + box / 2;

            s.beginFill(darkColor); 
            if (cx === nextCx) s.drawRect(cx - box / 2, Math.min(cy, nextCy), box, Math.abs(cy - nextCy));
            else s.drawRect(Math.min(cx, nextCx), cy - box / 2, Math.abs(cx - nextCx), box);
            s.endFill();

            s.beginFill(bodyColor); 
            if (cx === nextCx) s.drawRect(cx - box / 2 + 2, Math.min(cy, nextCy), box - 4, Math.abs(cy - nextCy));
            else s.drawRect(Math.min(cx, nextCx), cy - box / 2 + 2, Math.abs(cx - nextCx), box - 4);
            s.endFill();

            s.beginFill(shineColor, 0.6); 
            if (cx === nextCx) s.drawRect(cx - 4, Math.min(cy, nextCy), 8, Math.abs(cy - nextCy));
            else s.drawRect(Math.min(cx, nextCx), cy - 4, Math.abs(cx - nextCx), 8);
            s.endFill();

            snakeLayer.addChild(s);
        }
    });

    // Segments
    snake.forEach((seg, i) => {
        const s = new PIXI.Graphics();
        const isHead = i === 0;
        const isTail = i === snake.length - 1;
        const cx = seg.x * box + box / 2;
        const cy = seg.y * box + box / 2;

        if (isHead) {
            s.position.set(cx, cy); 
            if (direction === "RIGHT") s.rotation = 0;
            if (direction === "DOWN") s.rotation = Math.PI / 2;
            if (direction === "LEFT") s.rotation = Math.PI;
            if (direction === "UP") s.rotation = -Math.PI / 2;

            s.beginFill(darkColor); s.drawCircle(0, 0, box / 2); s.endFill();
            s.beginFill(bodyColor);
            if (isMouthOpen) { s.arc(0, 0, box / 2 - 2, 0.5, -0.5); s.lineTo(0, 0); s.closePath(); } 
            else { s.drawCircle(0, 0, box / 2 - 2); }
            s.endFill();
            s.beginFill(0xFFFFFF); s.drawCircle(6, -9, 6); s.drawCircle(6, 9, 6); s.endFill();
            s.beginFill(0x000000); s.drawCircle(7, -9, 2.5); s.drawCircle(7, 9, 2.5); s.endFill();
        } else if (isTail) {
            s.beginFill(darkColor); s.drawCircle(cx, cy, box / 3.5); s.endFill();
            s.beginFill(bodyColor); s.drawCircle(cx, cy, box / 3.5 - 1); s.endFill();
        } else {
            s.beginFill(bodyColor); s.drawCircle(cx, cy, box / 2 - 2); s.endFill();
            s.beginFill(shineColor, 0.5); s.drawCircle(cx - 3, cy - 3, 5); s.endFill();
        }
        snakeLayer.addChild(s);
    });
}

// --- 6. GAME CONTROL & BUTTON LOGIC ---
const gameBtn = document.getElementById('game-btn');

function startGame() {
    // Stop any existing loop
    if (gameInterval) clearInterval(gameInterval);
    
    // Resume audio context
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // Reset everything
    isGameOver = false;
    uiLayer.removeChildren(); // Clear Game Over text
    score = 0;
    direction = "RIGHT";
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    food = { x: 5, y: 5 };
    fruitType = 0;
    frameCount = 0;
    
    // Update Score UI
    document.getElementById("score").innerText = score;
    
    // Update Button
    gameBtn.innerText = "RESTART";
    gameBtn.blur(); // Remove focus

    // Draw initial state
    drawBoard();
    drawFood();
    drawSnake();

    // Start Loop
    gameInterval = setInterval(update, 120);
}

// Button Click Listener
gameBtn.addEventListener('click', startGame);

function showGameOver() {
    isGameOver = true;
    clearInterval(gameInterval); // Stop loop
    
    playSound('die');
    gameBtn.innerText = "PLAY AGAIN"; // Change button text

    // Show Game Over Overlay
    uiLayer.removeChildren();
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.7);
    bg.drawRect(0, 0, app.screen.width, app.screen.height);
    bg.endFill();
    uiLayer.addChild(bg);

    const titleStyle = new PIXI.TextStyle({
        fontFamily: 'Courier New', fontSize: 80, fontWeight: 'bold',
        fill: ['white'], 
    });
    const titleText = new PIXI.Text('GAME OVER', titleStyle);
    titleText.anchor.set(0.5);
    titleText.x = app.screen.width / 2;
    titleText.y = app.screen.height / 2;
    uiLayer.addChild(titleText);
}

// --- 7. INPUT HANDLING ---
window.addEventListener("keydown", e => {
    const key = e.key;

    // Start game if Spacebar is pressed (only if game over or not started)
    if ((isGameOver || !gameInterval) && (key === " " || key === "Spacebar")) {
        startGame();
        return;
    }

    if (!isGameOver && gameInterval) {
        let moved = false;
        if (key === "ArrowLeft" && direction !== "RIGHT") { direction = "LEFT"; moved = true; }
        if (key === "ArrowUp" && direction !== "DOWN") { direction = "UP"; moved = true; }
        if (key === "ArrowRight" && direction !== "LEFT") { direction = "RIGHT"; moved = true; }
        if (key === "ArrowDown" && direction !== "UP") { direction = "DOWN"; moved = true; }
        
        if (moved) playSound('move');
    }
});

// --- 8. GAME LOOP ---
function update() {
    if (isGameOver) return; 

    frameCount++; 
    const head = { ...snake[0] };

    if (direction === "LEFT") head.x--;
    if (direction === "UP") head.y--;
    if (direction === "RIGHT") head.x++;
    if (direction === "DOWN") head.y++;

    if (head.x < 0 || head.y < 0 || head.x >= gridCount || head.y >= gridCount || 
        snake.some(s => s.x === head.x && s.y === head.y)) {
        showGameOver(); 
        return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
        playSound('eat');
        score++;
        document.getElementById("score").innerText = score;

        food = {
            x: Math.floor(Math.random() * (gridCount - 1)),
            y: Math.floor(Math.random() * (gridCount - 1))
        };
    } else {
        snake.pop();
    }

    drawFood();
    drawSnake();
}

// --- 9. INITIAL RENDER ---
// Draw board once, but do not start loop until button is clicked
drawBoard();
drawFood();
drawSnake();