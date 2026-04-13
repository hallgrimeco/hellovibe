// =============================================================
//  SURVIVOR — Top-Down Browser Shooter
//  Pure Canvas 2D, no external dependencies
// =============================================================

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

const W = 640, H = 480;
canvas.width  = W;
canvas.height = H;

// Scale canvas to fit window while keeping aspect ratio
function resizeCanvas() {
  const scaleX = window.innerWidth  / W;
  const scaleY = window.innerHeight / H;
  const scale  = Math.min(scaleX, scaleY);
  canvas.style.width  = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// =============================================================
//  GAME STATES
// =============================================================
const STATE = { MENU: 'MENU', PLAYING: 'PLAYING', WAVE_CLEAR: 'WAVE_CLEAR', GAME_OVER: 'GAME_OVER' };
let state = STATE.MENU;

// =============================================================
//  INPUT
// =============================================================
const keys  = {};
const mouse = { x: W / 2, y: H / 2, held: false };

window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Enter' || e.code === 'Space') handleConfirm();
  e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

canvas.addEventListener('mousemove', e => {
  const r    = canvas.getBoundingClientRect();
  const scaleX = W / r.width;
  const scaleY = H / r.height;
  mouse.x = (e.clientX - r.left) * scaleX;
  mouse.y = (e.clientY - r.top)  * scaleY;
});

canvas.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  mouse.held = true;
  if (state === STATE.MENU || state === STATE.GAME_OVER) handleConfirm();
});
canvas.addEventListener('mouseup', e => { if (e.button === 0) mouse.held = false; });

// =============================================================
//  PERSISTENCE
// =============================================================
let hiScore = parseInt(localStorage.getItem('survivor_hi') || '0');

// =============================================================
//  SCREEN SHAKE
// =============================================================
let shakeX = 0, shakeY = 0, shakeDur = 0, shakeAmt = 0;

function triggerShake(amount, duration) {
  shakeAmt = amount;
  shakeDur = duration;
}

function updateShake(dt) {
  if (shakeDur > 0) {
    shakeDur -= dt;
    shakeX = (Math.random() - 0.5) * shakeAmt * 2;
    shakeY = (Math.random() - 0.5) * shakeAmt * 2;
  } else {
    shakeX = 0; shakeY = 0;
  }
}

// =============================================================
//  PARTICLE
// =============================================================
class Particle {
  constructor(x, y, color) {
    this.x = x; this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life    = 250 + Math.random() * 250;
    this.maxLife = this.life;
    this.size    = 2 + Math.random() * 4;
    this.color   = color;
    this.active  = true;
  }
  update(dt) {
    this.x  += this.vx;
    this.y  += this.vy;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
  draw() {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle   = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

// =============================================================
//  MUZZLE FLASH
// =============================================================
class MuzzleFlash {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.life = 80; this.maxLife = 80;
    this.active = true;
  }
  update(dt) { this.life -= dt; if (this.life <= 0) this.active = false; }
  draw() {
    const t = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha  = t;
    ctx.shadowColor  = '#ffff00';
    ctx.shadowBlur   = 18;
    ctx.fillStyle    = '#ffee00';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 10 * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle    = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4 * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// =============================================================
//  BULLET
// =============================================================
class Bullet {
  constructor(x, y, angle) {
    this.x = x; this.y = y;
    const spd = 9;
    this.vx = Math.cos(angle) * spd;
    this.vy = Math.sin(angle) * spd;
    this.radius = 4;
    this.active  = true;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < -30 || this.x > W + 30 || this.y < -30 || this.y > H + 30) this.active = false;
  }
  draw() {
    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#00ffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// =============================================================
//  PLAYER
// =============================================================
class Player {
  constructor() {
    this.x = W / 2; this.y = H / 2;
    this.radius   = 14;
    this.speed    = 3;
    this.angle    = 0;         // facing angle (toward mouse)
    this.hp       = 100;
    this.maxHp    = 100;
    this.hitFlash = 0;         // ms remaining for hit-flash
    this.walkTimer  = 0;
    this.walkFrame  = 0;       // 0-3
    this.moving     = false;
    this.shootCd    = 0;
    this.shootCdMax = 160;     // ms between shots
    this.invincible = 0;       // ms of brief i-frames after hit
  }

  update(dt) {
    // Movement
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['KeyA']) dx -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) dx += 1;
    if (keys['ArrowUp']    || keys['KeyW']) dy -= 1;
    if (keys['ArrowDown']  || keys['KeyS']) dy += 1;

    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      this.x += (dx / len) * this.speed;
      this.y += (dy / len) * this.speed;
      this.walkTimer += dt;
      if (this.walkTimer >= 120) {
        this.walkTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 4;
      }
    }

    // Clamp to canvas
    this.x = Math.max(this.radius, Math.min(W - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(H - this.radius, this.y));

    // Aim at mouse
    this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

    // Timers
    if (this.hitFlash  > 0) this.hitFlash  -= dt;
    if (this.shootCd   > 0) this.shootCd   -= dt;
    if (this.invincible > 0) this.invincible -= dt;

    // Auto-fire while mouse held
    if (mouse.held && this.shootCd <= 0) firePlayerBullet();
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(3, 6, 13, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Legs (drawn BEFORE body so they appear underneath) ---
    // Legs are in world-aligned space (not rotated with body)
    const legBob = this.moving ? [3, -1, -3, 1][this.walkFrame] : 0;
    ctx.fillStyle = '#1a3a1a';
    ctx.fillRect(-4,  8 + legBob, 5, 8);   // left leg
    ctx.fillRect( 0,  8 - legBob, 5, 8);   // right leg
    // Boots
    ctx.fillStyle = '#111';
    ctx.fillRect(-5,  15 + legBob, 6, 4);
    ctx.fillRect(-1,  15 - legBob, 6, 4);

    // --- Rotate body to face mouse ---
    ctx.rotate(this.angle);

    const flash = this.hitFlash > 0 && Math.floor(this.hitFlash / 60) % 2 === 0;

    // Torso
    ctx.fillStyle = flash ? '#ff4444' : '#2d6b2d';
    ctx.fillRect(-9, -8, 18, 14);

    // Jacket lapels (darker stripe)
    ctx.fillStyle = flash ? '#ff2222' : '#1e4d1e';
    ctx.fillRect(-2, -8, 4, 14);

    // Head
    ctx.fillStyle = flash ? '#ffaaaa' : '#c8965a';
    ctx.beginPath();
    ctx.arc(5, -2, 7, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = flash ? '#dd8888' : '#3a2000';
    ctx.fillRect(1, -8, 8, 4);

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(5, -4, 3, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(6, -3, 2, 2);

    // Gun arm
    ctx.fillStyle = flash ? '#ff6666' : '#c8965a';
    ctx.fillRect(2, 2, 8, 5);   // arm

    // Gun body
    ctx.fillStyle = '#888';
    ctx.fillRect(8, 0, 12, 6);
    // Barrel
    ctx.fillStyle = '#555';
    ctx.fillRect(18, 1, 8, 4);
    // Trigger guard
    ctx.fillStyle = '#666';
    ctx.fillRect(10, 6, 4, 4);

    ctx.restore();
  }

  gunTip() {
    return {
      x: this.x + Math.cos(this.angle) * 26,
      y: this.y + Math.sin(this.angle) * 26
    };
  }

  takeDamage(amt) {
    if (this.invincible > 0) return;
    this.hp = Math.max(0, this.hp - amt);
    this.hitFlash   = 400;
    this.invincible = 600;
    triggerShake(6, 250);
  }

  canShoot() { return this.shootCd <= 0; }
  onShoot()  { this.shootCd = this.shootCdMax; }

  regenHp(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
}

// =============================================================
//  ENEMY
// =============================================================
class Enemy {
  constructor(x, y, speed) {
    this.x = x; this.y = y;
    this.radius     = 12;
    this.speed      = speed;
    this.hp         = 1;
    this.active     = true;
    this.hitFlash   = 0;
    this.wobbleTimer = 0;
    this.wobbleFrame = 0;
    this.angle       = 0;    // facing player
  }

  update(dt, player) {
    const dx   = player.x - this.x;
    const dy   = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.x    += (dx / dist) * this.speed;
    this.y    += (dy / dist) * this.speed;
    this.angle = Math.atan2(dy, dx);

    this.wobbleTimer += dt;
    if (this.wobbleTimer >= 220) { this.wobbleTimer = 0; this.wobbleFrame ^= 1; }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(2, 5, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wobble faces toward player
    ctx.rotate(this.angle + Math.PI / 2);

    const wb = this.wobbleFrame;
    const flash = this.hitFlash > 0;

    // Main body
    ctx.fillStyle = flash ? '#ffffff' : '#cc2200';
    ctx.fillRect(-10, -10 + wb, 20, 18);

    // Side spikes
    ctx.fillStyle = flash ? '#dddddd' : '#ff4400';
    ctx.fillRect(-14, -7, 5, 5);   // left spike
    ctx.fillRect(  9, -7, 5, 5);   // right spike
    ctx.fillRect( -6, -14 + wb, 4, 5); // top left spike
    ctx.fillRect(  2, -14 + wb, 4, 5); // top right spike

    // Belly
    ctx.fillStyle = flash ? '#eeeeee' : '#ff6644';
    ctx.fillRect(-6, -4 + wb, 12, 8);

    // Eyes
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(-5, -7 + wb, 4, 4);
    ctx.fillRect( 1, -7 + wb, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(-4, -6 + wb, 2, 2);
    ctx.fillRect( 2, -6 + wb, 2, 2);

    // Angry brow
    ctx.fillStyle = '#aa0000';
    ctx.fillRect(-6, -10 + wb, 5, 2);
    ctx.fillRect( 1, -10 + wb, 5, 2);

    ctx.restore();
  }
}

// =============================================================
//  HELPER: circle overlap
// =============================================================
function overlaps(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy < (ar + br) * (ar + br);
}

// =============================================================
//  SPAWN ENEMY at canvas edge
// =============================================================
function spawnEnemy(speed) {
  let x, y;
  switch (Math.floor(Math.random() * 4)) {
    case 0: x = Math.random() * W; y = -25; break;
    case 1: x = W + 25; y = Math.random() * H; break;
    case 2: x = Math.random() * W; y = H + 25; break;
    default: x = -25; y = Math.random() * H;
  }
  return new Enemy(x, y, speed);
}

// =============================================================
//  GAME STATE VARIABLES
// =============================================================
let player, bullets, enemies, particles, muzzleFlashes;
let score, wave, waveClearElapsed, regenShown;

const WAVE_CLEAR_DUR = 3200; // ms

function initGame() {
  player       = new Player();
  bullets      = [];
  enemies      = [];
  particles    = [];
  muzzleFlashes = [];
  score        = 0;
  wave         = 0;
  startNextWave();
}

function startNextWave() {
  wave++;
  const count = Math.min(5 + wave * 2, 40);
  const speed = 0.9 + wave * 0.12;
  for (let i = 0; i < count; i++) enemies.push(spawnEnemy(speed));
}

function firePlayerBullet() {
  if (!player.canShoot()) return;
  const tip = player.gunTip();
  bullets.push(new Bullet(tip.x, tip.y, player.angle));
  muzzleFlashes.push(new MuzzleFlash(tip.x, tip.y));
  player.onShoot();
}

// =============================================================
//  STATE MACHINE
// =============================================================
function handleConfirm() {
  if (state === STATE.MENU) {
    initGame();
    state = STATE.PLAYING;
  } else if (state === STATE.GAME_OVER) {
    state = STATE.MENU;
  }
}

// =============================================================
//  UPDATE
// =============================================================
function update(dt) {
  if (state === STATE.PLAYING) {
    updateShake(dt);
    player.update(dt);

    if (player.hp <= 0) {
      if (score > hiScore) {
        hiScore = score;
        localStorage.setItem('survivor_hi', hiScore);
      }
      state = STATE.GAME_OVER;
      return;
    }

    // Update bullets
    bullets.forEach(b => b.update());
    bullets = bullets.filter(b => b.active);

    // Update muzzle flashes
    muzzleFlashes.forEach(m => m.update(dt));
    muzzleFlashes = muzzleFlashes.filter(m => m.active);

    // Update enemies
    enemies.forEach(e => {
      e.update(dt, player);
      // Enemy touches player
      if (overlaps(e.x, e.y, e.radius, player.x, player.y, player.radius)) {
        player.takeDamage(15);
        // Bounce enemy back
        const dx = e.x - player.x, dy = e.y - player.y;
        const d  = Math.sqrt(dx * dx + dy * dy) || 1;
        e.x += (dx / d) * 22;
        e.y += (dy / d) * 22;
      }
    });

    // Bullet vs enemy
    for (const b of bullets) {
      for (const e of enemies) {
        if (!b.active || !e.active) continue;
        if (overlaps(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
          b.active = false;
          e.hp--;
          e.hitFlash = 120;
          if (e.hp <= 0) {
            e.active = false;
            score += 10;
            for (let i = 0; i < 8; i++) {
              particles.push(new Particle(e.x, e.y, Math.random() > 0.5 ? '#ff4400' : '#ff8800'));
            }
            particles.push(new Particle(e.x, e.y, '#ffff00'));
          }
        }
      }
    }

    bullets  = bullets.filter(b => b.active);
    enemies  = enemies.filter(e => e.active);
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.active);

    // Wave complete?
    if (enemies.length === 0) {
      state             = STATE.WAVE_CLEAR;
      waveClearElapsed  = 0;
      regenShown        = false;
    }

  } else if (state === STATE.WAVE_CLEAR) {
    waveClearElapsed += dt;

    // Regen health at midpoint
    if (!regenShown && waveClearElapsed >= WAVE_CLEAR_DUR / 2) {
      player.regenHp(20);
      regenShown = true;
    }

    // Continue particles
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.active);

    if (waveClearElapsed >= WAVE_CLEAR_DUR) {
      state = STATE.PLAYING;
      startNextWave();
    }
  }
}

// =============================================================
//  DRAW: Background grid
// =============================================================
function drawBackground() {
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#171717';
  ctx.lineWidth = 1;
  const g = 40;
  for (let x = 0; x <= W; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

// =============================================================
//  DRAW: HUD
// =============================================================
function drawHUD() {
  // Wave number — top left
  ctx.textAlign    = 'left';
  ctx.fillStyle    = '#6688ff';
  ctx.font         = 'bold 15px monospace';
  ctx.fillText(`WAVE  ${wave}`, 14, 24);

  // Score — top right
  ctx.textAlign    = 'right';
  ctx.fillStyle    = '#ffffff';
  ctx.fillText(`SCORE  ${score}`, W - 14, 24);

  // Hi-score — top right below
  ctx.fillStyle    = '#ffcc00';
  ctx.font         = '12px monospace';
  ctx.fillText(`BEST  ${hiScore}`, W - 14, 42);

  // Health bar — bottom left
  const bx = 14, by = H - 28, bw = 160, bh = 14;
  ctx.fillStyle = '#222';
  ctx.fillRect(bx, by, bw, bh);

  const ratio = player.hp / player.maxHp;
  ctx.fillStyle = ratio > 0.5 ? '#44cc44' : ratio > 0.25 ? '#cccc22' : '#cc2222';
  ctx.fillRect(bx, by, bw * ratio, bh);

  ctx.strokeStyle = '#555';
  ctx.lineWidth   = 1;
  ctx.strokeRect(bx, by, bw, bh);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 10px monospace';
  ctx.fillText(`HP  ${player.hp} / ${player.maxHp}`, bx + 5, by + 10);
}

// =============================================================
//  DRAW: Scanlines
// =============================================================
function drawScanlines() {
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}

// =============================================================
//  DRAW: Menu
// =============================================================
function drawMenu() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Title glow
  ctx.save();
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur  = 30;
  ctx.fillStyle   = '#e94560';
  ctx.font        = 'bold 72px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('SURVIVOR', W / 2, H / 2 - 90);
  ctx.restore();

  ctx.fillStyle = '#555';
  ctx.font      = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TOP-DOWN SHOOTER', W / 2, H / 2 - 44);

  // Blinking prompt
  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#00ffff';
    ctx.font        = 'bold 20px monospace';
    ctx.fillText('CLICK  OR  PRESS  ENTER', W / 2, H / 2 + 20);
    ctx.restore();
  }

  // Controls
  ctx.fillStyle = '#3a3a3a';
  ctx.font      = '13px monospace';
  ctx.fillText('MOVE: ARROW KEYS    AIM & SHOOT: MOUSE', W / 2, H / 2 + 72);

  // Hi-score
  if (hiScore > 0) {
    ctx.fillStyle = '#ffcc00';
    ctx.font      = 'bold 16px monospace';
    ctx.fillText(`BEST SCORE:  ${hiScore}`, W / 2, H / 2 + 110);
  }

  drawScanlines();
}

// =============================================================
//  DRAW: Wave Clear overlay
// =============================================================
function drawWaveClear() {
  // Draw the live game world underneath
  ctx.save();
  drawBackground();
  particles.forEach(p => p.draw());
  player.draw();
  drawHUD();
  ctx.restore();

  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = '#aaffaa';
  ctx.shadowBlur  = 20;
  ctx.fillStyle   = '#aaffaa';
  ctx.font        = 'bold 44px monospace';
  ctx.fillText(`WAVE  ${wave}  CLEAR!`, W / 2, H / 2 - 50);
  ctx.restore();

  // Progress bar
  const progress = waveClearElapsed / WAVE_CLEAR_DUR;
  ctx.fillStyle = '#222';
  ctx.fillRect(W / 2 - 130, H / 2 + 10, 260, 14);
  ctx.fillStyle = '#336633';
  ctx.fillRect(W / 2 - 130, H / 2 + 10, 260 * progress, 14);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  ctx.strokeRect(W / 2 - 130, H / 2 + 10, 260, 14);

  ctx.fillStyle = '#888';
  ctx.font      = '13px monospace';
  ctx.fillText('NEXT WAVE INCOMING...', W / 2, H / 2 + 44);

  if (regenShown) {
    ctx.save();
    ctx.shadowColor = '#44ff44';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#44ff44';
    ctx.font        = 'bold 14px monospace';
    ctx.fillText('+20 HP RESTORED', W / 2, H / 2 + 68);
    ctx.restore();
  }

  drawScanlines();
}

// =============================================================
//  DRAW: Game Over
// =============================================================
function drawGameOver() {
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur  = 28;
  ctx.fillStyle   = '#e94560';
  ctx.font        = 'bold 62px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('GAME OVER', W / 2, H / 2 - 90);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font      = 'bold 26px monospace';
  ctx.fillText(`SCORE:  ${score}`, W / 2, H / 2 - 20);

  ctx.fillStyle = '#ffcc00';
  ctx.font      = 'bold 18px monospace';
  ctx.fillText(`BEST:  ${hiScore}`, W / 2, H / 2 + 16);

  ctx.fillStyle = '#4466aa';
  ctx.font      = '15px monospace';
  ctx.fillText(`REACHED WAVE  ${wave}`, W / 2, H / 2 + 52);

  if (Math.floor(Date.now() / 550) % 2 === 0) {
    ctx.save();
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = '#00ffff';
    ctx.font        = 'bold 17px monospace';
    ctx.fillText('CLICK  OR  PRESS  ENTER  TO  RETRY', W / 2, H / 2 + 106);
    ctx.restore();
  }

  drawScanlines();
}

// =============================================================
//  DRAW: Playing
// =============================================================
function drawPlaying() {
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBackground();
  particles.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  muzzleFlashes.forEach(m => m.draw());
  enemies.forEach(e => e.draw());
  player.draw();

  ctx.restore();
  drawHUD();
  drawScanlines();
}

// =============================================================
//  MAIN DRAW DISPATCH
// =============================================================
function draw() {
  switch (state) {
    case STATE.MENU:       drawMenu();     break;
    case STATE.PLAYING:    drawPlaying();  break;
    case STATE.WAVE_CLEAR: drawWaveClear(); break;
    case STATE.GAME_OVER:  drawGameOver(); break;
  }
}

// =============================================================
//  GAME LOOP
// =============================================================
let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min(timestamp - lastTime, 50); // cap at 50ms to prevent spiral of death
  lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
