const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d", { alpha: false });

const baseSize = { width: 900, height: 600 };
let viewScale = 1;
let deviceScale = Math.min(window.devicePixelRatio || 1, 2);
let manualAdvance = false;

const keys = new Set();
const state = {
  mode: "start",
  score: 0,
  health: 3,
  level: 1,
  time: 0,
  player: {
    x: baseSize.width / 2,
    y: baseSize.height / 2,
    r: 16,
    speed: 230,
    vx: 0,
    vy: 0,
    invincible: 0,
  },
  hazards: [],
  collectibles: [],
};

const dom = {
  score: document.getElementById("ui-score"),
  level: document.getElementById("ui-level"),
  remaining: document.getElementById("ui-remaining"),
  health: document.getElementById("ui-health"),
  status: document.getElementById("ui-status"),
  screen: document.getElementById("ui-screen"),
  screenKicker: document.getElementById("ui-screen-kicker"),
  screenTitle: document.getElementById("ui-screen-title"),
  screenCopy: document.getElementById("ui-screen-copy"),
  primaryAction: document.getElementById("ui-primary-action"),
  fullscreenAction: document.getElementById("ui-fullscreen-action"),
};

const ui = {
  accent: "#0f8f5c",
  accentLight: "#45c88c",
  accentGlow: "rgba(15, 143, 92, 0.28)",
  lens: "#1d6f98",
  gold: "#d8b73b",
  warn: "#c94d5f",
  warnDark: "#8f2639",
  warnGlow: "rgba(201, 77, 95, 0.24)",
  ink: "#0a1a12",
  soft: "rgba(10, 26, 18, 0.7)",
  panel: "rgba(255, 255, 255, 0.88)",
};

const uiState = {
  statusText: "Recoge los prismas verdes.",
  statusTone: "",
  statusTimer: 0,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function roundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function defaultStatusText() {
  if (state.mode === "start") {
    return "Pulsa Jugar o Espacio para empezar.";
  }
  if (state.mode === "gameover") {
    return "Pulsa Reintentar o Espacio para otra partida.";
  }
  if (state.player.invincible > 0) {
    return "Recuperando estabilidad. Evita otro impacto.";
  }
  const remaining = state.collectibles.length;
  return `${remaining} ${remaining === 1 ? "prisma pendiente" : "prismas pendientes"}.`;
}

function setStatus(text, tone = "", seconds = 1.4) {
  uiState.statusText = text;
  uiState.statusTone = tone;
  uiState.statusTimer = seconds;
}

function setText(node, value) {
  if (node.textContent !== value) {
    node.textContent = value;
  }
}

function syncUi() {
  if (!dom.score) return;

  const remaining = state.mode === "start" ? 4 : state.collectibles.length;
  setText(dom.score, String(state.score));
  setText(dom.level, `Nivel ${state.level}`);
  setText(dom.remaining, String(remaining));

  if (dom.health.children.length !== 3) {
    dom.health.replaceChildren(
      ...Array.from({ length: 3 }, () => document.createElement("span")),
    );
  }
  Array.from(dom.health.children).forEach((pip, index) => {
    pip.classList.toggle("is-active", index < state.health);
  });

  const statusText =
    uiState.statusTimer > 0 ? uiState.statusText : defaultStatusText();
  setText(dom.status, statusText);
  dom.status.classList.toggle("is-danger", uiState.statusTone === "danger");
  dom.status.classList.toggle("is-success", uiState.statusTone === "success");

  const screenVisible = state.mode === "start" || state.mode === "gameover";
  dom.screen.classList.toggle("is-visible", screenVisible);
  if (state.mode === "gameover") {
    setText(dom.screenKicker, "Partida terminada");
    setText(dom.screenTitle, `Puntuación ${state.score}`);
    setText(
      dom.screenCopy,
      `Has llegado al nivel ${state.level}. Ajusta el ritmo, espera a que pasen los fragmentos rojos y vuelve a capturar prismas.`,
    );
    setText(dom.primaryAction, "Reintentar");
  } else {
    setText(dom.screenKicker, "Todo Óptica presenta");
    setText(dom.screenTitle, "Prisma Rush");
    setText(
      dom.screenCopy,
      "Captura los prismas verdes, esquiva los fragmentos rojos y aguanta cada nivel sin perder las tres vidas.",
    );
    setText(dom.primaryAction, "Jugar");
  }

  setText(
    dom.fullscreenAction,
    document.fullscreenElement ? "Salir de pantalla" : "Pantalla completa",
  );
}

function resizeCanvas() {
  deviceScale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = baseSize.width * deviceScale;
  canvas.height = baseSize.height * deviceScale;

  const isFullscreen = Boolean(document.fullscreenElement);
  const padding = isFullscreen ? 0.98 : 0.9;
  const maxWidth = window.innerWidth * padding;
  const maxHeight = window.innerHeight * padding;
  viewScale = Math.min(maxWidth / baseSize.width, maxHeight / baseSize.height, 1);

  canvas.style.width = `${baseSize.width * viewScale}px`;
  canvas.style.height = `${baseSize.height * viewScale}px`;
}

function spawnCollectibles() {
  state.collectibles = [
    { x: 150, y: 120, r: 12, pulse: 0 },
    { x: 750, y: 120, r: 12, pulse: 0 },
    { x: 150, y: 480, r: 12, pulse: 0 },
    { x: 750, y: 480, r: 12, pulse: 0 },
  ];
}

function spawnHazards() {
  state.hazards = [
    {
      type: "sentinel",
      x: 450,
      y: 140,
      r: 18,
      vx: 0,
      vy: 0,
      angle: 0,
      spin: 0,
    },
    {
      type: "drifter",
      x: 260,
      y: 350,
      r: 16,
      vx: 120,
      vy: -80,
      angle: 0,
      spin: 1.4,
    },
    {
      type: "drifter",
      x: 640,
      y: 340,
      r: 16,
      vx: -110,
      vy: 90,
      angle: 0,
      spin: -1.2,
    },
    {
      type: "drifter",
      x: 450,
      y: 520,
      r: 15,
      vx: 0,
      vy: -140,
      angle: 0,
      spin: 1.1,
    },
  ];
}

function resetGame() {
  state.mode = "playing";
  state.score = 0;
  state.health = 3;
  state.level = 1;
  state.time = 0;
  state.player.x = baseSize.width / 2;
  state.player.y = baseSize.height / 2;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.invincible = 0;
  spawnCollectibles();
  spawnHazards();
  setStatus("Recoge los prismas verdes.", "success", 1.6);
}

function levelUp() {
  state.level += 1;
  state.hazards.push({
    type: "drifter",
    x: 450,
    y: 420,
    r: 15,
    vx: 140 + state.level * 5,
    vy: -100,
    angle: 0,
    spin: state.level % 2 === 0 ? 1.3 : -1.3,
  });
  setStatus(`Nivel ${state.level}: más fragmentos en pista.`, "success", 1.8);
}

function handleMovement(dt) {
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) dx += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) dy += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
  }

  state.player.vx = dx * state.player.speed;
  state.player.vy = dy * state.player.speed;
  state.player.x += state.player.vx * dt;
  state.player.y += state.player.vy * dt;

  const margin = state.player.r + 6;
  state.player.x = clamp(state.player.x, margin, baseSize.width - margin);
  state.player.y = clamp(state.player.y, margin, baseSize.height - margin);
}

function updateHazards(dt) {
  for (const hazard of state.hazards) {
    if (hazard.type === "drifter") {
      hazard.x += hazard.vx * dt;
      hazard.y += hazard.vy * dt;
      hazard.angle += hazard.spin * dt;

      if (hazard.x < hazard.r + 6 || hazard.x > baseSize.width - hazard.r - 6) {
        hazard.vx *= -1;
        hazard.x = clamp(hazard.x, hazard.r + 6, baseSize.width - hazard.r - 6);
      }
      if (hazard.y < hazard.r + 6 || hazard.y > baseSize.height - hazard.r - 6) {
        hazard.vy *= -1;
        hazard.y = clamp(hazard.y, hazard.r + 6, baseSize.height - hazard.r - 6);
      }
    } else {
      hazard.angle += 0.6 * dt;
    }
  }
}

function collectCheck() {
  for (let i = state.collectibles.length - 1; i >= 0; i -= 1) {
    const c = state.collectibles[i];
    if (distance(state.player, c) < state.player.r + c.r) {
      state.collectibles.splice(i, 1);
      state.score += 1;
      setStatus("Prisma capturado.", "success", 1.2);
      if (state.score % 4 === 0) {
        levelUp();
      }
    }
  }

  if (state.collectibles.length === 0) {
    spawnCollectibles();
  }
}

function hazardCheck(dt) {
  if (state.player.invincible > 0) {
    state.player.invincible = Math.max(0, state.player.invincible - dt);
  }

  if (state.player.invincible > 0) return;

  if (state.health <= 0) return;

  for (const hazard of state.hazards) {
    if (distance(state.player, hazard) < state.player.r + hazard.r - 4) {
      state.health -= 1;
      state.player.invincible = 1.2;
      if (state.health <= 0) {
        state.mode = "gameover";
        setStatus("Partida terminada.", "danger", 2.4);
      } else {
        setStatus("Impacto. Mantén distancia con los fragmentos.", "danger", 1.8);
      }
      break;
    }
  }
}

function update(dt) {
  state.time += dt;
  if (uiState.statusTimer > 0) {
    uiState.statusTimer = Math.max(0, uiState.statusTimer - dt);
  }
  for (const collectible of state.collectibles) {
    collectible.pulse += dt * 2.2;
  }

  if (state.mode !== "playing") {
    return;
  }

  handleMovement(dt);
  updateHazards(dt);
  collectCheck();
  hazardCheck(dt);
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, baseSize.height);
  gradient.addColorStop(0, "#edf6f6");
  gradient.addColorStop(0.48, "#dff1ef");
  gradient.addColorStop(1, "#cfe8e2");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, baseSize.width, baseSize.height);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = "rgba(29, 111, 152, 0.18)";
  for (let x = 38; x < baseSize.width; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, baseSize.height);
    ctx.stroke();
  }
  for (let y = 38; y < baseSize.height; y += 38) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(baseSize.width, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = ui.accent;
  ctx.beginPath();
  ctx.ellipse(180, 126, 178, 92, -0.02, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ui.lens;
  ctx.beginPath();
  ctx.ellipse(690, 500, 210, 92, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ui.gold;
  ctx.globalAlpha = 0.12;
  ctx.beginPath();
  ctx.ellipse(500, 78, 118, 38, 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundedRect(10, 10, baseSize.width - 20, baseSize.height - 20, 20);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.52)";
  ctx.lineWidth = 2;
  ctx.stroke();
  roundedRect(18, 18, baseSize.width - 36, baseSize.height - 36, 16);
  ctx.strokeStyle = "rgba(10, 26, 18, 0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(80, 534);
  ctx.bezierCurveTo(280, 446, 462, 504, 620, 418);
  ctx.bezierCurveTo(704, 372, 772, 332, 834, 350);
  ctx.stroke();
  ctx.restore();
}

function drawCollectibles() {
  for (const c of state.collectibles) {
    const pulse = 1 + Math.sin(c.pulse) * 0.1;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = ui.accentGlow;
    ctx.beginPath();
    ctx.arc(0, 0, c.r + 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = "rgba(15, 143, 92, 0.35)";
    ctx.shadowBlur = 16;
    const prismGradient = ctx.createLinearGradient(-c.r, -c.r, c.r, c.r);
    prismGradient.addColorStop(0, ui.accentLight);
    prismGradient.addColorStop(1, ui.accent);
    ctx.fillStyle = prismGradient;
    ctx.beginPath();
    ctx.moveTo(0, -c.r);
    ctx.lineTo(c.r, c.r);
    ctx.lineTo(-c.r, c.r);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

function drawHazards() {
  for (const hazard of state.hazards) {
    ctx.save();
    ctx.translate(hazard.x, hazard.y);
    ctx.rotate(hazard.angle);
    ctx.fillStyle = ui.warnGlow;
    ctx.beginPath();
    ctx.rect(
      -hazard.r - 10,
      -hazard.r - 10,
      hazard.r * 2 + 20,
      hazard.r * 2 + 20,
    );
    ctx.fill();

    ctx.shadowColor = "rgba(143, 38, 57, 0.32)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = ui.warn;
    ctx.beginPath();
    ctx.moveTo(0, -hazard.r);
    ctx.lineTo(hazard.r, 0);
    ctx.lineTo(0, hazard.r);
    ctx.lineTo(-hazard.r, 0);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = ui.warnDark;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-hazard.r * 0.38, -hazard.r * 0.38);
    ctx.lineTo(hazard.r * 0.38, hazard.r * 0.38);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  const wobble = Math.sin(state.time * 4) * 0.1 + 1;
  ctx.scale(wobble, wobble);

  if (state.player.invincible > 0) {
    ctx.strokeStyle = "rgba(29, 111, 152, 0.45)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, state.player.r + 11, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.shadowColor = "rgba(6, 70, 49, 0.32)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#064631";
  ctx.beginPath();
  ctx.arc(0, 0, state.player.r + 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fefcf7";
  ctx.beginPath();
  ctx.arc(0, 0, state.player.r, 0, Math.PI * 2);
  ctx.fill();

  const lensGradient = ctx.createRadialGradient(-5, -5, 2, 0, 0, state.player.r);
  lensGradient.addColorStop(0, "#63deb0");
  lensGradient.addColorStop(1, ui.accent);
  ctx.fillStyle = lensGradient;
  ctx.beginPath();
  ctx.arc(0, 0, state.player.r - 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, state.player.r - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = ui.ink;
  ctx.font = "600 18px Space Grotesk, sans-serif";
  ctx.fillText(`Score ${state.score}`, 26, 30);

  ctx.font = "500 16px Space Grotesk, sans-serif";
  ctx.fillStyle = ui.soft;
  ctx.fillText(`Level ${state.level}`, 26, 52);

  const heartX = baseSize.width - 28;
  const heartY = 28;
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i < state.health ? ui.warn : "rgba(214, 84, 58, 0.25)";
    ctx.beginPath();
    ctx.arc(heartX - i * 26, heartY, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPanel(title, lines) {
  const panelWidth = 440;
  const panelHeight = 220;
  const x = baseSize.width / 2 - panelWidth / 2;
  const y = baseSize.height / 2 - panelHeight / 2;

  ctx.save();
  ctx.fillStyle = ui.panel;
  roundedRect(x, y, panelWidth, panelHeight, 26);
  ctx.fill();

  ctx.strokeStyle = "rgba(10, 26, 18, 0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = ui.ink;
  ctx.font = "700 30px Fraunces, serif";
  ctx.fillText(title, x + 30, y + 60);

  ctx.font = "500 16px Space Grotesk, sans-serif";
  ctx.fillStyle = ui.soft;
  lines.forEach((line, index) => {
    ctx.fillText(line, x + 30, y + 100 + index * 24);
  });
  ctx.restore();
}

function render() {
  ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  drawBackground();

  if (state.mode !== "start") {
    drawCollectibles();
    drawHazards();
    drawPlayer();
  }

  syncUi();
}

function handleKeyDown(event) {
  const blockKeys = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ];
  if (blockKeys.includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "KeyF") {
    toggleFullscreen();
    return;
  }

  if (event.code === "Escape" && document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  if (event.code === "Space") {
    if (state.mode === "start" || state.mode === "gameover") {
      resetGame();
      return;
    }
  }

  keys.add(event.code);
}

function handleKeyUp(event) {
  keys.delete(event.code);
}

function toggleFullscreen() {
  const root = document.getElementById("game-root");
  if (!document.fullscreenElement) {
    if (root.requestFullscreen) {
      root.requestFullscreen();
    }
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

function startFromUi() {
  resetGame();
  canvas.focus();
}

function loop(timestamp) {
  const dt = Math.min(0.035, (timestamp - loop.lastTime) / 1000 || 0);
  loop.lastTime = timestamp;

  if (!manualAdvance) {
    update(dt);
  }
  render();
  window.requestAnimationFrame(loop);
}
loop.lastTime = performance.now();

window.advanceTime = (ms) => {
  manualAdvance = true;
  const step = 1 / 60;
  const frames = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < frames; i += 1) {
    update(step);
  }
  render();
};

window.render_game_to_text = () => {
  const payload = {
    mode: state.mode,
    note: "Origin top-left; x right, y down; units in canvas pixels.",
    arena: { width: baseSize.width, height: baseSize.height },
    player: {
      x: Number(state.player.x.toFixed(2)),
      y: Number(state.player.y.toFixed(2)),
      r: state.player.r,
      vx: Number(state.player.vx.toFixed(2)),
      vy: Number(state.player.vy.toFixed(2)),
      invincible: Number(state.player.invincible.toFixed(2)),
    },
    score: state.score,
    health: state.health,
    level: state.level,
    time: Number(state.time.toFixed(2)),
    hazards: state.hazards.map((hazard) => ({
      x: Number(hazard.x.toFixed(2)),
      y: Number(hazard.y.toFixed(2)),
      r: hazard.r,
      vx: Number(hazard.vx.toFixed(2)),
      vy: Number(hazard.vy.toFixed(2)),
      type: hazard.type,
    })),
    collectibles: state.collectibles.map((collectible) => ({
      x: Number(collectible.x.toFixed(2)),
      y: Number(collectible.y.toFixed(2)),
      r: collectible.r,
    })),
    ui: {
      status: dom.status?.textContent || defaultStatusText(),
      screenVisible: dom.screen?.classList.contains("is-visible") || false,
    },
    fullscreen: Boolean(document.fullscreenElement),
  };
  return JSON.stringify(payload);
};

window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("fullscreenchange", resizeCanvas);
canvas.addEventListener("pointerdown", () => canvas.focus());
dom.primaryAction.addEventListener("click", startFromUi);
dom.fullscreenAction.addEventListener("click", () => {
  toggleFullscreen();
  canvas.focus();
});

resizeCanvas();
syncUi();
window.requestAnimationFrame(loop);
