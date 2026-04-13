# Copilot Instructions

## Repository Overview

A collection of browser-based games built with vanilla HTML/CSS/JavaScript and the Canvas 2D API. No build step, no bundler, no dependencies — open the HTML file directly in a browser.

**Games:**
- `tictactoe.html` — single-file two-player Tic Tac Toe
- `shooter/` — multi-file top-down retro shooter (SURVIVOR)

## Running the Games

Open the relevant file directly in a browser. No server required.

```
# Tic Tac Toe
tictactoe.html

# Shooter
shooter/index.html
```

## Architecture: Shooter (`shooter/`)

The shooter is split across three files with a clear separation of roles:

| File | Role |
|------|------|
| `index.html` | Canvas host only — no logic |
| `style.css` | Layout, crosshair cursor, CRT glow box-shadow |
| `game.js` | All game logic — entities, loop, rendering, state machine |

### Game Loop & State Machine

`game.js` runs a single `requestAnimationFrame` loop. `dt` (delta time in **milliseconds**) is capped at 50ms to prevent spiral-of-death on tab blur.

State transitions follow this flow:
```
MENU → PLAYING → WAVE_CLEAR → PLAYING → ... → GAME_OVER → MENU
```

The `STATE` const object and `state` variable drive all branching in `update()` and `draw()`.

### Entity Pattern

All game entities (Player, Enemy, Bullet, Particle, MuzzleFlash) follow the same contract:
- `this.active = true` — set to `false` to mark for removal
- `update(dt)` — advance state; timers count **down** in ms (`timer -= dt`)
- `draw()` — render; always wraps with `ctx.save()` / `ctx.restore()`

Arrays are garbage-collected each frame with `.filter(e => e.active)`.

### Drawing Conventions

All sprites are drawn imperatively with Canvas 2D `fillRect` / `arc` calls. There are no image assets or sprite sheets.

**Critical draw-order rule in Player:** legs are drawn in world-aligned space **before** `ctx.rotate(this.angle)` so they stay upright while the body/head/gun rotate to face the mouse. Any new body parts must respect this split.

Mouse coordinates must always be transformed from CSS space to canvas logical space:
```js
const scaleX = W / r.width;
const scaleY = H / r.height;
mouse.x = (e.clientX - r.left) * scaleX;
```

### Timers

All timers (hitFlash, shootCd, invincible, shakeDur, life) are in **milliseconds** and count downward. A timer is "active" while `> 0`.

### Persistence

Hi-score is the only persisted data, stored via `localStorage` with the key `survivor_hi`.

## Conventions

### Commit Style

Use conventional commit prefixes:
```
feat: add double-jump mechanic
fix: prevent bullets spawning inside player
refactor: extract wave-spawning into own function
```

Always append the Co-authored-by trailer:
```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

### Code Style

- Sections in `game.js` are delimited by `// ===...=== // SECTION NAME` banners
- Constants use `SCREAMING_SNAKE_CASE` (`W`, `H`, `STATE`, `WAVE_CLEAR_DUR`)
- Canvas dimensions are always `W = 640, H = 480`; never hardcode pixel values inline
- `ctx.shadowBlur` effects are used for glowing bullets and flash effects — always pair with `ctx.save()`/`ctx.restore()` to avoid bleed
- New games follow the same pattern as the shooter: one `index.html`, one `style.css`, one `game.js` inside a named subfolder

### Color Palette (Shooter)

| Usage | Hex |
|-------|-----|
| Background | `#0d0d0d` |
| Grid lines | `#171717` |
| Accent / UI highlight | `#e94560` |
| Bullets / cyan glow | `#00ffff` |
| Muzzle flash | `#ffee00` |
| Score text | `#ffffff` |
| Hi-score text | `#ffcc00` |
| Wave counter | `#6688ff` |
| Health (full) | `#44cc44` |
| Health (low) | `#cc2222` |
