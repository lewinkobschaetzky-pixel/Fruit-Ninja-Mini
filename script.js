const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 500;

let objects = [];
let halves = [];
let effects = [];
let popups = [];
let stains = [];

let score = 0;
let level = 1;
let lives = 3;
let gameOver = false;

let scoreScale = 1;
let scoreAnim = 0;

// 🏆 HIGH SCORE (FIX)
let highscore = parseInt(localStorage.getItem("fruitHighscore")) || 0;

const fruitEmojis = ["🍉","🍈","🍇","🍋","🍊","🍍","🍎","🍒","🍓"];

// 🔊 SOUND
let audioCtx = null;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSliceSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playExplosionSound() {
  if (!audioCtx) return;
  const bufferSize = audioCtx.sampleRate * 0.2;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

  noise.connect(gain);
  gain.connect(audioCtx.destination);

  noise.start();
}

// 🔪 Spur
let trail = [];
let lastMouse = null;

// 🎨 Farben
const fruitColors = {
  "🍉": "red","🍈": "lightgreen","🍇": "purple","🍋": "yellow",
  "🍊": "orange","🍍": "gold","🍎": "red","🍒": "darkred","🍓": "crimson"
};

const restartButton = {
  x: canvas.width / 2 - 80,
  y: canvas.height / 2 + 20,
  width: 160,
  height: 50
};

// 🍉 OBJEKT
class GameObject {
  constructor() {
    const side = Math.floor(Math.random() * 3);
    const speedMultiplier = 1 + level * 0.2;

    if (side === 0) {
      this.x = 0;
      this.y = Math.random() * canvas.height * 0.8;
      this.speedX = (4 + Math.random() * 3) * speedMultiplier;
      this.speedY = (-5 - Math.random() * 3) * speedMultiplier;
    } else if (side === 1) {
      this.x = canvas.width;
      this.y = Math.random() * canvas.height * 0.8;
      this.speedX = (-4 - Math.random() * 3) * speedMultiplier;
      this.speedY = (-5 - Math.random() * 3) * speedMultiplier;
    } else {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height;
      this.speedX = (Math.random() - 0.5) * 6 * speedMultiplier;
      this.speedY = (-10 - Math.random() * 5) * speedMultiplier;
    }

    this.gravity = 0.25;

    const bombChance = Math.min(0.2 + level * 0.02, 0.5);

    if (Math.random() < bombChance) {
      this.isBomb = true;
      this.emoji = "💣";
    } else {
      this.isBomb = false;
      this.emoji = fruitEmojis[Math.floor(Math.random() * fruitEmojis.length)];
    }
  }

  update() {
    this.speedY += this.gravity;
    this.x += this.speedX;
    this.y += this.speedY;
  }

  draw() {
    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    ctx.fillText(this.emoji, this.x, this.y);
  }
}

// ✂️ HALBE FRÜCHTE
class HalfFruit {
  constructor(x, y, emoji, dir) {
    this.x = x;
    this.y = y;
    this.emoji = emoji;
    this.speedX = dir * (3 + Math.random() * 2);
    this.speedY = -6;
    this.gravity = 0.25;
    this.rotation = dir * 0.2;
  }

  update() {
    this.speedY += this.gravity;
    this.x += this.speedX;
    this.y += this.speedY;
    this.rotation += 0.1;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.beginPath();
    if (this.speedX < 0) {
      ctx.rect(-20, -20, 20, 40);
    } else {
      ctx.rect(0, -20, 20, 40);
    }
    ctx.clip();

    ctx.font = "40px Arial";
    ctx.textAlign = "center";
    ctx.fillText(this.emoji, 0, 10);

    ctx.restore();
  }
}

// 💥 EFFECT
class Effect {
  constructor(x, y, color, isExplosion = false) {
    this.particles = [];
    const amount = isExplosion ? 40 : 15;

    for (let i = 0; i < amount; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * (isExplosion ? 12 : 6),
        vy: (Math.random() - 0.5) * (isExplosion ? 12 : 6),
        size: Math.random() * 6 + 3,
        alpha: 1,
        color: isExplosion ? "orange" : color
      });
    }
  }

  update() {
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.alpha -= 0.02;
    });

    this.particles = this.particles.filter(p => p.alpha > 0);
  }

  draw() {
    this.particles.forEach(p => {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  isDone() {
    return this.particles.length === 0;
  }
}

// 🎯 SPAWN
function spawnObject() {
  if (gameOver) return;
  objects.push(new GameObject());
}
setInterval(spawnObject, 1000);

// 🔪 SCHNEIDEN
canvas.addEventListener("mousemove", function (e) {
  const rect = canvas.getBoundingClientRect();
  const mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };

  trail.push({ ...mouse, life: 1 });

  if (lastMouse && !gameOver) {
    slice(lastMouse, mouse);
  }

  lastMouse = mouse;
});

function slice(p1, p2) {
  objects = objects.filter(obj => {
    const dist = distanceToLine(obj, p1, p2);

    if (dist < 40) {
      if (obj.isBomb) {
        playExplosionSound();
        effects.push(new Effect(obj.x, obj.y, "orange", true));
        lives--;
        if (lives <= 0) gameOver = true;
      } else {
        playSliceSound();

        halves.push(new HalfFruit(obj.x, obj.y, obj.emoji, -1));
        halves.push(new HalfFruit(obj.x, obj.y, obj.emoji, 1));

        effects.push(new Effect(obj.x, obj.y, fruitColors[obj.emoji]));

        score++;
        level = Math.floor(score / 10) + 1;
      }
      return false;
    }
    return true;
  });
}

// 📏 DISTANZ
function distanceToLine(obj, p1, p2) {
  const A = obj.x - p1.x;
  const B = obj.y - p1.y;
  const C = p2.x - p1.x;
  const D = p2.y - p1.y;

  const dot = A * C + B * D;
  const len = C * C + D * D;
  let t = dot / len;

  t = Math.max(0, Math.min(1, t));

  const closestX = p1.x + t * C;
  const closestY = p1.y + t * D;

  const dx = obj.x - closestX;
  const dy = obj.y - closestY;

  return Math.sqrt(dx * dx + dy * dy);
}

// 🔄 RESTART BUTTON
function drawRestartButton() {
  ctx.fillStyle = "black";
  ctx.fillRect(restartButton.x, restartButton.y, restartButton.width, restartButton.height);

  ctx.strokeStyle = "white";
  ctx.strokeRect(restartButton.x, restartButton.y, restartButton.width, restartButton.height);

  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.fillText("NEU START", canvas.width / 2, restartButton.y + 30);
}

canvas.addEventListener("click", function (e) {
  initAudio();

  if (!gameOver) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (
    x > restartButton.x &&
    x < restartButton.x + restartButton.width &&
    y > restartButton.y &&
    y < restartButton.y + restartButton.height
  ) {
    restartGame();
  }
});

function restartGame() {
  objects = [];
  halves = [];
  effects = [];
  trail = [];
  score = 0;
  level = 1;
  lives = 3;
  gameOver = false;
  updateGame();
}

// 🔪 TRAIL
function drawTrail() {
  trail.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    p.life -= 0.05;
  });
  trail = trail.filter(p => p.life > 0);
  ctx.globalAlpha = 1;
}

// 🎮 LOOP
function updateGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ✅ Highscore FIX (immer prüfen)
  if (score > highscore) {
    highscore = score;
    localStorage.setItem("fruitHighscore", highscore);
  }

  effects.forEach(e => {
    e.update();
    e.draw();
  });

  halves.forEach(h => {
    h.update();
    h.draw();
  });

  objects.forEach(o => {
    o.update();
    o.draw();
  });

  drawTrail();

  const hudX = canvas.width - 220;

  ctx.fillStyle = "white";
  ctx.font = "18px Arial";
  ctx.fillText("Punkte: " + score, hudX, 30);
  ctx.fillText("Level: " + level, hudX, 60);
  ctx.fillText("Leben: " + lives, hudX, 90);
  ctx.fillText("Highscore: " + highscore, hudX, 120);

  if (gameOver) {
    ctx.font = "50px Arial";
    ctx.fillText("GAME OVER", canvas.width / 2 - 150, canvas.height / 2);
    drawRestartButton();
  } else {
    requestAnimationFrame(updateGame);
  }
}

updateGame();