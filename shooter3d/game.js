'use strict';
// ================================================================= //
// SURVIVOR 3D  —  raycasting wave shooter                           //
// ================================================================= //

// ========================= // SETUP
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const W = 640, H = 480, HALF_H = H / 2;
canvas.width = W; canvas.height = H;

// ========================= // CONSTANTS
const STATE = { MENU: 0, PLAYING: 1, WAVE_CLEAR: 2, GAME_OVER: 3 };
const MOVE_SPEED    = 3.5;
const STRAFE_SPEED  = 3.0;
const ROT_SPEED     = 2.0;
const MOUSE_SENS    = 0.0018;
const PLAYER_R      = 0.25;
const FOV_NORMAL    = Math.PI / 3;   // 60°
const FOV_ADS       = Math.PI / 9;   // 20° ≈ 3× zoom
const ADS_SPEED     = 10;
const SHOOT_CD      = 380;           // ms between shots
const WAVE_CLEAR_D  = 3000;          // ms to show wave-clear screen
const ENEMY_SPEED   = 1.4;
const ENEMY_ATK_R   = 0.85;          // attack range in tiles
const ENEMY_ATK_INT = 1000;          // ms between enemy attacks
const ENEMY_DMG     = 12;
const FOG_DIST      = 14;            // fog starts fading at this tile distance
const MAX_DEPTH     = 24;
const Z_BUF         = new Float32Array(W);  // per-column wall distance
const SPR_DIM       = 16;            // sprite sheet cell size

// ========================= // MAP
// 0 = floor   1 = outer wall   2 = cover block
const MAP_W = 20, MAP_H = 20;
const MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0,0,1],
  [1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1],
  [1,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,0,0,0,1],
  [1,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,0,0,0,1],
  [1,0,0,0,2,2,0,0,0,0,0,0,0,0,2,2,0,0,0,1],
  [1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1],
  [1,0,0,0,2,2,0,0,0,0,0,0,0,0,2,2,0,0,0,1],
  [1,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,0,0,0,1],
  [1,0,0,0,0,0,2,0,0,0,0,0,0,2,0,0,0,0,0,1],
  [1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1],
  [1,0,0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

function isWall(x, y) {
  const mx = x | 0, my = y | 0;
  if (mx < 0 || mx >= MAP_W || my < 0 || my >= MAP_H) return true;
  return MAP[my][mx] > 0;
}

// ========================= // MONSTER SPRITE  (16×16 pixel art)
// 0=transparent  1=body  2=highlight  3=eye  4=tooth
const SPR_DATA = [
  [0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,2,1,1,1,1,2,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,3,2,1,1,1,1,2,3,1,1,0,0],
  [0,0,1,2,3,2,1,1,1,1,2,3,2,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,4,4,4,1,1,4,4,4,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,2,1,1,1,2,2,1,1,1,2,1,1,0],
  [1,1,1,1,2,1,1,1,1,1,1,2,1,1,1,1],
  [1,1,1,1,2,2,1,1,1,1,2,2,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,2,1,0,0,1,1,0,0,1,2,1,1,0],
  [0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];
const SPR_PALETTE = [null, '#7a1010', '#cc3322', '#ffee00', '#ffffff'];

// Bake sprite into a pixel array for fast per-pixel access
const sprPx = new Uint8ClampedArray(SPR_DIM * SPR_DIM * 4);
(function bakeSpr() {
  for (let sy = 0; sy < SPR_DIM; sy++) {
    for (let sx = 0; sx < SPR_DIM; sx++) {
      const v = SPR_DATA[sy][sx];
      const i = (sy * SPR_DIM + sx) * 4;
      if (v === 0) { sprPx[i + 3] = 0; continue; }
      const c = SPR_PALETTE[v];
      sprPx[i]     = parseInt(c.slice(1, 3), 16);
      sprPx[i + 1] = parseInt(c.slice(3, 5), 16);
      sprPx[i + 2] = parseInt(c.slice(5, 7), 16);
      sprPx[i + 3] = 255;
    }
  }
})();

// ========================= // INPUT
const keys  = {};
const mouse = { dx: 0, shoot: false, ads: false, locked: false };

document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Escape') {
    mouse.ads = false;
    if (mouse.locked) document.exitPointerLock();
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') mouse.ads = true;
  if ((e.code === 'Space' || e.code === 'Enter') &&
      (gameState === STATE.MENU || gameState === STATE.GAME_OVER)) {
    startGame();
  }
});
document.addEventListener('keyup', e => {
  keys[e.code] = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') mouse.ads = false;
});
canvas.addEventListener('mousedown', e => {
  if (gameState === STATE.MENU)      { startGame(); canvas.requestPointerLock(); return; }
  if (gameState === STATE.GAME_OVER) { gameState = STATE.MENU; return; }
  if (!mouse.locked)                 { canvas.requestPointerLock(); return; }
  if (e.button === 0) mouse.shoot = true;
  if (e.button === 2) mouse.ads = !mouse.ads;
  e.preventDefault();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => {
  mouse.locked = document.pointerLockElement === canvas;
  if (!mouse.locked) mouse.ads = false;
});
document.addEventListener('mousemove', e => {
  if (mouse.locked) mouse.dx += e.movementX;
});

// ========================= // PLAYER
const player = {
  x: 10.5, y: 10.5, angle: 0,
  hp: 100, maxHp: 100,
  shootCd: 0, hitFlash: 0,
  fov: FOV_NORMAL, adsT: 0,
};
function pDirX()   { return Math.cos(player.angle); }
function pDirY()   { return Math.sin(player.angle); }
function pPlaneX() { return -Math.sin(player.angle) * Math.tan(player.fov / 2); }
function pPlaneY() { return  Math.cos(player.angle) * Math.tan(player.fov / 2); }

// ========================= // ENEMIES
const enemies = [];

class Enemy {
  constructor(x, y, wave) {
    this.x = x; this.y = y;
    this.hp = 30 + wave * 10;
    this.maxHp = this.hp;
    this.active = true;
    this.atkTimer = 0;
    this.hitFlash = 0;
    this.state = 'wander';
    this.wanderTimer = 0;
    this.wdx = Math.cos(Math.random() * Math.PI * 2);
    this.wdy = Math.sin(Math.random() * Math.PI * 2);
  }

  update(dt) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.atkTimer  > 0) this.atkTimer  -= dt;

    const dx   = player.x - this.x;
    const dy   = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const see  = dist < 12 && losCheck(this.x, this.y, player.x, player.y);

    this.state = dist < ENEMY_ATK_R ? 'attack' : see ? 'chase' : 'wander';

    if (this.state === 'attack') {
      if (this.atkTimer <= 0) {
        this.atkTimer = ENEMY_ATK_INT;
        player.hp -= ENEMY_DMG;
        player.hitFlash = 220;
        if (player.hp < 0) player.hp = 0;
      }
    } else if (this.state === 'chase') {
      const spd = ENEMY_SPEED * dt / 1000;
      const nx = this.x + (dx / dist) * spd;
      const ny = this.y + (dy / dist) * spd;
      if (!isWall(nx + 0.2, this.y) && !isWall(nx - 0.2, this.y)) this.x = nx;
      if (!isWall(this.x, ny + 0.2) && !isWall(this.x, ny - 0.2)) this.y = ny;
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 1200 + Math.random() * 2000;
        const a = Math.random() * Math.PI * 2;
        this.wdx = Math.cos(a); this.wdy = Math.sin(a);
      }
      const spd = ENEMY_SPEED * 0.4 * dt / 1000;
      const nx = this.x + this.wdx * spd;
      const ny = this.y + this.wdy * spd;
      if (!isWall(nx + 0.2, this.y) && !isWall(nx - 0.2, this.y)) this.x = nx;
      else this.wdx *= -1;
      if (!isWall(this.x, ny + 0.2) && !isWall(this.x, ny - 0.2)) this.y = ny;
      else this.wdy *= -1;
    }
  }

  hit(dmg) {
    this.hp -= dmg;
    this.hitFlash = 160;
    if (this.hp <= 0) {
      this.active = false;
      score += 100;
      for (let i = 0; i < 10; i++) particles.push(new Particle(this.x, this.y));
    }
  }
}

function losCheck(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const steps = Math.ceil(Math.hypot(dx, dy) * 5);
  for (let i = 1; i < steps; i++) {
    if (isWall(x1 + dx * i / steps, y1 + dy * i / steps)) return false;
  }
  return true;
}

// ========================= // PARTICLES
const particles = [];
class Particle {
  constructor(x, y) {
    this.x = x; this.y = y;
    const a = Math.random() * Math.PI * 2;
    const s = 2 + Math.random() * 4;
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.life = this.maxLife = 400 + Math.random() * 300;
    this.active = true;
    this.r = [233, 204, 255][Math.floor(Math.random() * 3)];
    this.g = [69,  34,   100][Math.floor(Math.random() * 3)];
    this.b = [96,  34,   50][Math.floor(Math.random() * 3)];
  }
  update(dt) {
    this.x += this.vx * dt / 1000;
    this.y += this.vy * dt / 1000;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }
}

// ========================= // GAME STATE
let gameState = STATE.MENU;
let wave = 0, score = 0;
let hiScore = parseInt(localStorage.getItem('survivor3d_hi') || '0');
let waveClearTimer = 0;
let shootFlash = 0;
let walkCycle  = 0;

function startGame() {
  player.x = 10.5; player.y = 10.5; player.angle = 0;
  player.hp = player.maxHp; player.shootCd = 0;
  player.hitFlash = 0; player.adsT = 0; player.fov = FOV_NORMAL;
  enemies.length = 0; particles.length = 0;
  wave = 0; score = 0; shootFlash = 0; walkCycle = 0;
  gameState = STATE.PLAYING;
  spawnWave();
}

function spawnWave() {
  wave++;
  const count = 3 + wave * 2;
  for (let i = 0; i < count; i++) {
    let x, y, tries = 0;
    do {
      x = 1.5 + Math.random() * (MAP_W - 3);
      y = 1.5 + Math.random() * (MAP_H - 3);
      tries++;
    } while ((isWall(x, y) || Math.hypot(x - player.x, y - player.y) < 5) && tries < 200);
    enemies.push(new Enemy(x, y, wave));
  }
}

// ========================= // RAYCASTING
function castRays() {
  const dX = pDirX(), dY = pDirY();
  const pX = pPlaneX(), pY = pPlaneY();

  for (let col = 0; col < W; col++) {
    const camX  = 2 * col / W - 1;
    const rDirX = dX + pX * camX;
    const rDirY = dY + pY * camX;

    let mapX = player.x | 0, mapY = player.y | 0;
    const ddX = rDirX === 0 ? 1e30 : Math.abs(1 / rDirX);
    const ddY = rDirY === 0 ? 1e30 : Math.abs(1 / rDirY);

    let stepX, stepY, sdX, sdY;
    if (rDirX < 0) { stepX = -1; sdX = (player.x - mapX) * ddX; }
    else           { stepX =  1; sdX = (mapX + 1 - player.x) * ddX; }
    if (rDirY < 0) { stepY = -1; sdY = (player.y - mapY) * ddY; }
    else           { stepY =  1; sdY = (mapY + 1 - player.y) * ddY; }

    let hit = false, side = 0, wallType = 0;
    for (let iter = 0; iter < MAX_DEPTH * 2 && !hit; iter++) {
      if (sdX < sdY) { sdX += ddX; mapX += stepX; side = 0; }
      else           { sdY += ddY; mapY += stepY; side = 1; }
      if (mapX < 0 || mapX >= MAP_W || mapY < 0 || mapY >= MAP_H) { hit = true; wallType = 1; break; }
      if (MAP[mapY][mapX] > 0) { hit = true; wallType = MAP[mapY][mapX]; }
    }

    const perpDist = side === 0 ? (sdX - ddX) : (sdY - ddY);
    Z_BUF[col] = perpDist;

    const lineH    = Math.min(H * 4, (H / perpDist) | 0);
    const drawTop  = Math.max(0, ((H - lineH) / 2) | 0);
    const drawBot  = Math.min(H - 1, ((H + lineH) / 2) | 0);

    // Wall hit position for texture stripe
    const wallHit = side === 0
      ? player.y + perpDist * rDirY
      : player.x + perpDist * rDirX;
    const wallFrac = wallHit - Math.floor(wallHit);
    const texCol   = (wallFrac * 8) | 0;  // 0-7 stripe index

    // Base color by wall type and side
    let r, g, b;
    if (wallType === 1) {
      r = side === 0 ? 130 : 90;
      g = side === 0 ? 28  : 18;
      b = side === 0 ? 28  : 18;
      // Mortar lines every 2 stripes
      if (texCol === 0 || texCol === 4) { r = 60; g = 30; b = 30; }
    } else {
      r = side === 0 ? 38  : 25;
      g = side === 0 ? 80  : 55;
      b = side === 0 ? 140 : 95;
      if (texCol === 0 || texCol === 7) { r = 18; g = 35; b = 60; }
    }

    // Fog
    const fog = Math.min(1, perpDist / FOG_DIST);
    const sh  = 1 - fog * 0.88;
    ctx.fillStyle = `rgb(${(r * sh) | 0},${(g * sh) | 0},${(b * sh) | 0})`;
    ctx.fillRect(col, drawTop, 1, drawBot - drawTop);
  }
}

// ========================= // FLOOR & CEILING
function drawFloorCeiling() {
  // Ceiling gradient
  const cg = ctx.createLinearGradient(0, 0, 0, HALF_H);
  cg.addColorStop(0, '#040407');
  cg.addColorStop(1, '#0e0316');
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, W, HALF_H);
  // Floor
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, HALF_H, W, HALF_H);
}

// ========================= // SPRITE RENDERING  (written into ImageData for Z-buffer)
function renderSprites(imgData) {
  const px  = imgData.data;
  const dX  = pDirX(),   dY  = pDirY();
  const plX = pPlaneX(), plY = pPlaneY();
  const invDet = 1 / (plX * dY - dX * plY);

  // Sort: farthest first so near sprites paint over far ones
  const sorted = enemies
    .filter(e => e.active)
    .map(e => ({ e, d2: (e.x - player.x) ** 2 + (e.y - player.y) ** 2 }))
    .sort((a, b) => b.d2 - a.d2);

  for (const { e } of sorted) {
    const relX = e.x - player.x, relY = e.y - player.y;
    // Transform to camera space
    const tX = invDet * ( dY * relX - dX * relY);  // screen x offset
    const tY = invDet * (-plY * relX + plX * relY); // depth (Z)
    if (tY <= 0.05) continue;

    const scrX = ((W / 2) * (1 + tX / tY)) | 0;
    const sprH = Math.min(H * 3, (H / tY) | 0);
    const sprW = sprH;

    const x0 = Math.max(0, (scrX - sprW / 2) | 0);
    const x1 = Math.min(W - 1, (scrX + sprW / 2) | 0);
    const y0 = Math.max(0, (HALF_H - sprH / 2) | 0);
    const y1 = Math.min(H - 1, (HALF_H + sprH / 2) | 0);

    const fog      = Math.min(1, tY / FOG_DIST);
    const bright   = 1 - fog * 0.85;
    const flash    = e.hitFlash > 0 ? e.hitFlash / 160 : 0;

    for (let sx = x0; sx <= x1; sx++) {
      if (Z_BUF[sx] <= tY) continue; // wall in front — skip column

      const texX = ((sx - (scrX - sprW / 2)) * SPR_DIM / sprW) | 0;
      if (texX < 0 || texX >= SPR_DIM) continue;

      for (let sy = y0; sy <= y1; sy++) {
        const texY = ((sy - (HALF_H - sprH / 2)) * SPR_DIM / sprH) | 0;
        if (texY < 0 || texY >= SPR_DIM) continue;

        const si = (texY * SPR_DIM + texX) * 4;
        if (sprPx[si + 3] < 128) continue; // transparent pixel

        const r = Math.min(255, (sprPx[si]     * bright + flash * 220) | 0);
        const g = Math.min(255, (sprPx[si + 1] * bright + flash * 80)  | 0);
        const b = Math.min(255, (sprPx[si + 2] * bright)               | 0);

        const pi = (sy * W + sx) * 4;
        px[pi] = r; px[pi + 1] = g; px[pi + 2] = b; px[pi + 3] = 255;
      }
    }

    // Health bar above sprite
    if (tY < 9 && sprW > 20) {
      const barW = (sprW * 0.75) | 0;
      const barX = scrX - (barW / 2) | 0;
      const barY = y0 - 5;
      if (barY > 0 && barX > 0 && barX + barW < W) {
        ctx.fillStyle = '#222';
        ctx.fillRect(barX, barY, barW, 3);
        ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#44cc44' : '#cc2222';
        ctx.fillRect(barX, barY, (barW * e.hp / e.maxHp) | 0, 3);
      }
    }
  }

  // Particles (just a colored dot in world → screenX mapping)
  for (const p of particles) {
    if (!p.active) continue;
    const relX = p.x - player.x, relY = p.y - player.y;
    const tX2 = invDet * ( dY * relX - dX * relY);
    const tY2 = invDet * (-plY * relX + plX * relY);
    if (tY2 <= 0.05) continue;
    const sx = ((W / 2) * (1 + tX2 / tY2)) | 0;
    const sy = (HALF_H + (0 / tY2)) | 0; // at floor level
    const sz = (8 / tY2) | 0;
    if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
    if (Z_BUF[Math.max(0, Math.min(W - 1, sx))] < tY2) continue;
    const alpha = p.life / p.maxLife;
    const pi = (sy * W + sx) * 4;
    if (pi >= 0 && pi < px.length - 3) {
      px[pi]     = Math.min(255, p.r);
      px[pi + 1] = Math.min(255, p.g * alpha);
      px[pi + 2] = Math.min(255, p.b * alpha);
      px[pi + 3] = 255;
    }
    // Draw a slightly larger particle using adjacent pixels
    for (let oy = -sz; oy <= sz; oy++) {
      for (let ox = -sz; ox <= sz; ox++) {
        const nx = sx + ox, ny2 = sy + oy;
        if (nx < 0 || nx >= W || ny2 < 0 || ny2 >= H) continue;
        const ni = (ny2 * W + nx) * 4;
        px[ni]     = p.r;
        px[ni + 1] = (p.g * alpha) | 0;
        px[ni + 2] = (p.b * alpha) | 0;
        px[ni + 3] = 255;
      }
    }
  }
}

// ========================= // GUN
function drawGun() {
  const bob  = Math.sin(walkCycle * 10) * 4;
  const cx   = W / 2 + Math.sin(walkCycle * 5) * 3;
  const base = H - 40 + bob;

  ctx.save();

  // Barrel
  ctx.fillStyle = '#555';
  ctx.fillRect(cx - 7, base - 65, 14, 50);
  // Iron sight on barrel top
  ctx.fillStyle = '#666';
  ctx.fillRect(cx - 2, base - 70, 4, 7);
  // Receiver body
  ctx.fillStyle = '#444';
  ctx.fillRect(cx - 22, base - 22, 44, 28);
  // Trigger guard
  ctx.fillStyle = '#383838';
  ctx.fillRect(cx - 8, base - 5, 16, 10);
  // Handle / grip
  ctx.fillStyle = '#333';
  ctx.fillRect(cx - 10, base, 18, 28);

  // Muzzle flash
  if (shootFlash > 0) {
    const fa = shootFlash / 120;
    ctx.save();
    ctx.globalAlpha = fa;
    ctx.shadowColor = '#ffee00';
    ctx.shadowBlur  = 30;
    ctx.fillStyle   = '#ffee00';
    ctx.beginPath();
    ctx.arc(cx, base - 80, 12 * fa, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, base - 80, 5 * fa, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

// ========================= // CROSSHAIR / ADS SCOPE
function drawCrosshair() {
  const cx = W / 2, cy = HALF_H;
  const t  = player.adsT;

  if (t > 0.5) {
    // Scope overlay: darken everything OUTSIDE the circle using even-odd fill
    const rad = 62 + (1 - t) * 62;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, rad, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fill('evenodd');

    // Scope ring
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    // Inner ring
    ctx.strokeStyle = 'rgba(0,200,0,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, rad * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    // Reticle lines
    ctx.strokeStyle = 'rgba(0,230,0,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - rad + 6, cy); ctx.lineTo(cx - 6, cy);
    ctx.moveTo(cx + 6, cy);       ctx.lineTo(cx + rad - 6, cy);
    ctx.moveTo(cx, cy - rad + 6); ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy + 6);       ctx.lineTo(cx, cy + rad - 6);
    ctx.stroke();

    // Mil-dots
    ctx.fillStyle = 'rgba(0,230,0,0.7)';
    for (let d = -3; d <= 3; d++) {
      if (d === 0) continue;
      ctx.beginPath(); ctx.arc(cx + d * 13, cy, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + d * 13, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    // Center dot
    ctx.fillStyle = 'rgba(0,255,0,0.95)';
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  } else {
    // Normal open crosshair (gap widens when hip-firing)
    const gap = 5 + (1 - t) * 5;
    const len = 10;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    ctx.moveTo(cx - gap - len, cy); ctx.lineTo(cx - gap, cy);
    ctx.moveTo(cx + gap, cy);       ctx.lineTo(cx + gap + len, cy);
    ctx.moveTo(cx, cy - gap - len); ctx.lineTo(cx, cy - gap);
    ctx.moveTo(cx, cy + gap);       ctx.lineTo(cx, cy + gap + len);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(cx, cy, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

// ========================= // MINIMAP
function drawMinimap() {
  const ms = 8, ox = 10, oy = 10;
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(ox - 2, oy - 2, MAP_W * ms + 4, MAP_H * ms + 4);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = MAP[y][x];
      ctx.fillStyle = t === 1 ? '#8b1a2a' : t === 2 ? '#1a3a6b' : '#141414';
      ctx.fillRect(ox + x * ms, oy + y * ms, ms - 1, ms - 1);
    }
  }

  for (const e of enemies) {
    if (!e.active) continue;
    ctx.fillStyle = '#e94560';
    ctx.fillRect(ox + e.x * ms - 2, oy + e.y * ms - 2, 4, 4);
  }

  ctx.fillStyle = '#00ffff';
  ctx.beginPath();
  ctx.arc(ox + player.x * ms, oy + player.y * ms, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ox + player.x * ms, oy + player.y * ms);
  ctx.lineTo(ox + (player.x + pDirX() * 2.5) * ms, oy + (player.y + pDirY() * 2.5) * ms);
  ctx.stroke();

  ctx.restore();
}

// ========================= // HUD
function drawHUD() {
  // Hit-damage vignette
  if (player.hitFlash > 0) {
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(233,69,96,0)');
    g.addColorStop(1, `rgba(233,69,96,${(player.hitFlash / 220) * 0.55})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Bottom bar
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, H - 52, W, 52);

  // HP bar
  ctx.fillStyle = '#888';
  ctx.font = 'bold 11px monospace';
  ctx.fillText('HP', 12, H - 32);
  const hpW = 150;
  ctx.fillStyle = '#222';
  ctx.fillRect(30, H - 42, hpW, 12);
  const hpRatio = player.hp / player.maxHp;
  ctx.fillStyle = hpRatio > 0.5 ? '#44cc44' : hpRatio > 0.25 ? '#ccaa00' : '#cc2222';
  ctx.fillRect(30, H - 42, (hpW * hpRatio) | 0, 12);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(30, H - 42, hpW, 12);
  ctx.fillStyle = '#fff';
  ctx.font = '10px monospace';
  ctx.fillText(`${player.hp}`, 36, H - 33);

  // Score & wave (centred)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`SCORE  ${score}`, W / 2, H - 28);
  ctx.fillStyle = '#6688ff';
  ctx.font = '11px monospace';
  ctx.fillText(`WAVE ${wave}`, W / 2, H - 12);

  // Hi-score (top right)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`HI  ${hiScore}`, W - 10, 20);

  // Enemies remaining
  const rem = enemies.filter(e => e.active).length;
  ctx.fillStyle = '#e94560';
  ctx.font = '11px monospace';
  ctx.fillText(`ENEMIES  ${rem}`, W - 10, 36);

  // ADS hint
  if (!mouse.ads) {
    ctx.fillStyle = 'rgba(180,180,180,0.5)';
    ctx.font = '10px monospace';
    ctx.fillText('RMB / Shift — aim', W - 10, H - 10);
  }

  ctx.restore();
}

// ========================= // SCREEN OVERLAYS
function drawMenu() {
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, W, H);

  // Grid background
  ctx.strokeStyle = '#171717';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = '#e94560';
  ctx.shadowBlur  = 40;
  ctx.fillStyle   = '#e94560';
  ctx.font = 'bold 62px monospace';
  ctx.fillText('SURVIVOR', W / 2, H / 2 - 70);
  ctx.shadowColor = '#6688ff';
  ctx.shadowBlur  = 25;
  ctx.fillStyle   = '#6688ff';
  ctx.font = 'bold 30px monospace';
  ctx.fillText('3D', W / 2, H / 2 - 32);

  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#cccccc';
  ctx.font = '13px monospace';
  ctx.fillText('W A S D  —  move     mouse  —  look', W / 2, H / 2 + 15);
  ctx.fillText('LMB  —  shoot     RMB / Shift  —  aim', W / 2, H / 2 + 34);
  ctx.fillText('hide behind walls  ·  survive the waves', W / 2, H / 2 + 53);

  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`HI-SCORE  ${hiScore}`, W / 2, H / 2 + 82);

  ctx.fillStyle = '#00ffff';
  ctx.font = '15px monospace';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur  = 12;
  ctx.fillText('[ CLICK  OR  ENTER  TO  START ]', W / 2, H / 2 + 112);
  ctx.restore();
}

function drawWaveClear() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#6688ff'; ctx.shadowBlur = 25;
  ctx.fillStyle   = '#6688ff';
  ctx.font = 'bold 38px monospace';
  ctx.fillText(`WAVE  ${wave}  CLEAR`, W / 2, H / 2 - 8);
  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText(`SCORE  ${score}`, W / 2, H / 2 + 26);
  ctx.restore();
}

function drawGameOver() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.shadowColor = '#e94560'; ctx.shadowBlur = 35;
  ctx.fillStyle   = '#e94560';
  ctx.font = 'bold 52px monospace';
  ctx.fillText('GAME  OVER', W / 2, H / 2 - 40);
  ctx.shadowBlur = 0;
  ctx.fillStyle  = '#ffffff';
  ctx.font = '18px monospace';
  ctx.fillText(`SCORE  ${score}    WAVE  ${wave}`, W / 2, H / 2 + 8);
  ctx.fillStyle = '#ffcc00';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`HI-SCORE  ${hiScore}`, W / 2, H / 2 + 38);
  ctx.fillStyle = '#00ffff';
  ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 10;
  ctx.font = '14px monospace';
  ctx.fillText('[ CLICK  TO  CONTINUE ]', W / 2, H / 2 + 76);
  ctx.restore();
}

// ========================= // SHOOTING
function tryShoot() {
  if (player.shootCd > 0) return;
  player.shootCd = SHOOT_CD;
  shootFlash     = 120;

  const dX = pDirX(), dY = pDirY();
  const plX = pPlaneX(), plY = pPlaneY();
  const invDet = 1 / (plX * dY - dX * plY);

  // ADS tightens aim tolerance (smaller half-width threshold)
  const aimSlack = player.adsT > 0.7 ? 0.15 : 0.35;

  let bestEnemy = null, bestDist = Infinity;

  for (const e of enemies) {
    if (!e.active) continue;
    const relX = e.x - player.x, relY = e.y - player.y;
    const tX = invDet * ( dY * relX - dX * relY);
    const tY = invDet * (-plY * relX + plX * relY);
    if (tY <= 0.05) continue;

    // Normalised screen X: 0 = centre
    const normX = tX / tY;
    const sprHalf = (H / tY) / (2 * W);  // approx half-width in normalised coords

    if (Math.abs(normX) < (sprHalf + aimSlack) && tY < bestDist) {
      // Check wall is not in the way at that screen column
      const scrCol = Math.max(0, Math.min(W - 1, ((W / 2) * (1 + normX)) | 0));
      if (Z_BUF[scrCol] > tY) {
        bestDist  = tY;
        bestEnemy = e;
      }
    }
  }

  if (bestEnemy) {
    const dmg = 20 + (player.adsT > 0.7 ? 15 : 0); // bonus damage when scoped
    bestEnemy.hit(dmg);
  }
}

// ========================= // UPDATE
let lastT = 0;

function update(dt) {
  if (player.shootCd > 0) player.shootCd -= dt;
  if (player.hitFlash > 0) player.hitFlash -= dt;
  if (shootFlash > 0) shootFlash -= dt;

  // ADS lerp
  const adsTarget = mouse.ads ? 1 : 0;
  player.adsT += (adsTarget - player.adsT) * Math.min(1, ADS_SPEED * dt / 1000);
  player.fov  += ((mouse.ads ? FOV_ADS : FOV_NORMAL) - player.fov) * Math.min(1, ADS_SPEED * dt / 1000);

  // Mouse look (pointer lock)
  if (mouse.locked) { player.angle += mouse.dx * MOUSE_SENS; mouse.dx = 0; }

  // Keyboard look fallback
  if (keys['ArrowLeft']  || keys['KeyQ']) player.angle -= ROT_SPEED * dt / 1000;
  if (keys['ArrowRight'] || keys['KeyE']) player.angle += ROT_SPEED * dt / 1000;

  // Movement
  const fspd = MOVE_SPEED * dt / 1000;
  const sspd = STRAFE_SPEED * dt / 1000;
  const dX = pDirX(), dY = pDirY();
  const sX = -dY, sY = dX; // strafe axis
  let nx = player.x, ny = player.y;
  let moving = false;

  if (keys['KeyW'] || keys['ArrowUp'])   { nx += dX * fspd; ny += dY * fspd; moving = true; }
  if (keys['KeyS'] || keys['ArrowDown']) { nx -= dX * fspd; ny -= dY * fspd; moving = true; }
  if (keys['KeyA'])                      { nx -= sX * sspd; ny -= sY * sspd; moving = true; }
  if (keys['KeyD'])                      { nx += sX * sspd; ny += sY * sspd; moving = true; }

  const r = PLAYER_R;
  if (!isWall(nx + r, player.y) && !isWall(nx - r, player.y)) player.x = nx;
  if (!isWall(player.x, ny + r) && !isWall(player.x, ny - r)) player.y = ny;

  if (moving) walkCycle += dt / 1000;
  else walkCycle *= 0.9;

  // Shoot
  if (mouse.shoot) { mouse.shoot = false; tryShoot(); }

  // Update enemies
  for (const e of enemies) if (e.active) e.update(dt);
  // Remove dead
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!enemies[i].active) enemies.splice(i, 1);
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update(dt);
    if (!particles[i].active) particles.splice(i, 1);
  }

  // Wave clear check
  if (enemies.length === 0) {
    gameState      = STATE.WAVE_CLEAR;
    waveClearTimer = WAVE_CLEAR_D;
  }
}

function updateWaveClear(dt) {
  waveClearTimer -= dt;
  if (waveClearTimer <= 0) {
    gameState = STATE.PLAYING;
    spawnWave();
  }
}

// ========================= // MAIN LOOP
function draw3D() {
  drawFloorCeiling();
  castRays();
  // Write sprites into the pixel buffer so the Z-buffer clips them correctly
  const imgData = ctx.getImageData(0, 0, W, H);
  renderSprites(imgData);
  ctx.putImageData(imgData, 0, 0);
  drawGun();
  drawCrosshair();
  drawHUD();
  drawMinimap();
}

function loop(ts) {
  const dt = Math.min(50, ts - lastT);
  lastT = ts;

  switch (gameState) {
    case STATE.MENU:
      drawMenu();
      break;

    case STATE.PLAYING:
      update(dt);
      if (player.hp <= 0) {
        gameState = STATE.GAME_OVER;
        if (score > hiScore) {
          hiScore = score;
          localStorage.setItem('survivor3d_hi', hiScore);
        }
        if (mouse.locked) document.exitPointerLock();
      }
      draw3D();
      break;

    case STATE.WAVE_CLEAR:
      updateWaveClear(dt);
      draw3D();
      drawWaveClear();
      break;

    case STATE.GAME_OVER:
      draw3D();
      drawGameOver();
      break;
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
