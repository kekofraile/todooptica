// Lens Lab: a three-round visual calibration game for lens treatments.
const setupLensLab = () => {
  const roots = document.querySelectorAll("[data-lens-lab]");
  if (!roots.length) return;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  const makeCode = (length, salt = "") => {
    let seed = 2166136261;
    const source = `${salt}-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < source.length; i += 1) {
      seed ^= source.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    let code = "";
    for (let i = 0; i < length; i += 1) {
      seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
      seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
      code += alphabet[Math.abs(seed) % alphabet.length];
    }
    return code;
  };

  const scenes = [
    {
      id: "night",
      label: "Conducción nocturna",
      shortLabel: "Noche",
      mission: "Elimina reflejos y recupera definición sin oscurecer la escena.",
      minScore: 78,
      codeLength: 4,
      targetBrightness: 68,
      optimal: ["ar", "precision"],
      palette: ["#07160f", "#123f32", "#f2b84b", "#ec6d52"],
      base: { glare: 88, blur: 78, fatigue: 42, brightness: 58, color: 20 },
      weights: { glare: 0.24, blur: 0.24, fatigue: 0.1, brightness: 0.2, color: 0.1 },
    },
    {
      id: "screen",
      label: "Jornada con pantallas",
      shortLabel: "Pantalla",
      mission: "Baja la fatiga digital, conserva contraste y evita una dominante fría.",
      minScore: 82,
      codeLength: 5,
      targetBrightness: 74,
      optimal: ["blue", "precision", "ar"],
      palette: ["#061b22", "#164c5a", "#9cd7ff", "#17a66a"],
      base: { glare: 55, blur: 70, fatigue: 91, brightness: 82, color: 46 },
      weights: { glare: 0.18, blur: 0.22, fatigue: 0.28, brightness: 0.18, color: 0.1 },
    },
    {
      id: "sun",
      label: "Exterior con luz intensa",
      shortLabel: "Exterior",
      mission: "Controla el deslumbramiento, protege del UV y mantiene lectura de color.",
      minScore: 86,
      codeLength: 5,
      targetBrightness: 68,
      optimal: ["polar", "photo", "uv"],
      palette: ["#dff7ea", "#77b7df", "#f2b84b", "#0d7f56"],
      base: { glare: 94, blur: 50, fatigue: 62, brightness: 96, color: 30 },
      weights: { glare: 0.3, blur: 0.14, fatigue: 0.14, brightness: 0.28, color: 0.14 },
    },
  ];

  const featureEffects = {
    ar: { glare: -38, blur: -11, fatigue: -5, brightness: 2, color: -3 },
    precision: { glare: -6, blur: -38, fatigue: -8, brightness: 3, color: -2 },
    blue: { glare: -5, blur: -8, fatigue: -42, brightness: -2, color: 8 },
    polar: { glare: -36, blur: -5, fatigue: -6, brightness: -16, color: 6 },
    photo: { glare: -23, blur: -6, fatigue: -4, brightness: -18, color: 4 },
    uv: { glare: -9, blur: -2, fatigue: -8, brightness: -4, color: -5 },
  };

  const UNLOCK_KEY = "todooptica_lens_lab_unlock_v2";
  const COMPLETE_KEY = "todooptica_lens_lab_complete_v2";
  const STATS_KEY = "todooptica_lens_lab_stats_v2";
  const HINT_KEY = "todooptica_lens_lab_hints_v2";
  const MAX_ACTIVE = 3;

  const getSceneIndex = (id) => scenes.findIndex((scene) => scene.id === id);
  const getScene = (id) => scenes[getSceneIndex(id)] || scenes[0];

  const safeParse = (raw, fallback) => {
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const makeDefaultStats = () =>
    scenes.reduce((acc, scene) => {
      acc[scene.id] = { attempts: 0, best: 0 };
      return acc;
    }, {});

  const makeDefaultHints = () =>
    scenes.reduce((acc, scene) => {
      acc[scene.id] = { used: 0, revealed: [] };
      return acc;
    }, {});

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h, r) {
      const radius = typeof r === "number" ? r : 0;
      this.beginPath();
      this.moveTo(x + radius, y);
      this.lineTo(x + w - radius, y);
      this.quadraticCurveTo(x + w, y, x + w, y + radius);
      this.lineTo(x + w, y + h - radius);
      this.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      this.lineTo(x + radius, y + h);
      this.quadraticCurveTo(x, y + h, x, y + h - radius);
      this.lineTo(x, y + radius);
      this.quadraticCurveTo(x, y, x + radius, y);
      return this;
    };
  }

  roots.forEach((root) => {
    if (root.dataset.lensLabReady === "true") return;
    root.dataset.lensLabReady = "true";

    const canvas = root.querySelector("[data-lens-canvas]");
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stage = root.querySelector("[data-lens-stage]");
    const meter = root.querySelector("[data-lens-meter]");
    const scoreEls = Array.from(root.querySelectorAll("[data-lens-score]"));
    const minEls = Array.from(root.querySelectorAll("[data-lens-min]"));
    const sceneLabelEls = Array.from(root.querySelectorAll("[data-lens-scene-label]"));
    const levelEl = root.querySelector("[data-lens-level]");
    const missionEl = root.querySelector("[data-lens-mission]");
    const previewEl = root.querySelector("[data-lens-preview]");
    const noiseEl = root.querySelector("[data-lens-noise]");
    const synergyEl = root.querySelector("[data-lens-synergy]");
    const streakEl = root.querySelector("[data-lens-streak]");
    const input = root.querySelector("[data-lens-answer]");
    const check = root.querySelector("[data-lens-check]");
    const feedback = root.querySelector("[data-lens-feedback]");
    const hintBtn = root.querySelector("[data-lens-hint-btn]");
    const hintEl = root.querySelector("[data-lens-hint]");
    const attemptsEl = root.querySelector("[data-lens-attempts]");
    const bestEl = root.querySelector("[data-lens-best]");
    const newBtn = root.querySelector("[data-lens-new]");
    const sceneButtons = Array.from(root.querySelectorAll("[data-lens-scene]"));
    const featureButtons = Array.from(root.querySelectorAll("[data-lens-feature]"));

    const localStore = (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })();
    const sessionStore = (() => {
      try {
        return window.sessionStorage;
      } catch {
        return null;
      }
    })();

    const readStorage = (storage, key) => {
      try {
        return storage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    };
    const writeStorage = (storage, key, value) => {
      try {
        storage?.setItem(key, value);
      } catch {
        return false;
      }
      return true;
    };

    let stats = {
      ...makeDefaultStats(),
      ...safeParse(readStorage(localStore, STATS_KEY), makeDefaultStats()),
    };
    let hints = {
      ...makeDefaultHints(),
      ...safeParse(readStorage(sessionStore, HINT_KEY), makeDefaultHints()),
    };
    let unlocked = clamp(Number(readStorage(sessionStore, UNLOCK_KEY) || 0), 0, scenes.length - 1);
    let completed = clamp(Number(readStorage(sessionStore, COMPLETE_KEY) || 0), 0, scenes.length);
    let scene = scenes[Math.min(unlocked, scenes.length - 1)].id;
    let features = new Set();
    let code = makeCode(getScene(scene).codeLength, scene);
    let lastScore = 0;
    let lastMetrics = {};
    let lastFit = 0;
    let particleFrame = 0;

    const ensureSceneStats = (id) => {
      if (!stats[id]) stats[id] = { attempts: 0, best: 0 };
      return stats[id];
    };

    const ensureSceneHints = (id) => {
      if (!hints[id]) hints[id] = { used: 0, revealed: [] };
      return hints[id];
    };

    const saveStats = () => writeStorage(localStore, STATS_KEY, JSON.stringify(stats));
    const saveHints = () => writeStorage(sessionStore, HINT_KEY, JSON.stringify(hints));

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const computeMetrics = () => {
      const sceneData = getScene(scene);
      const metrics = { ...sceneData.base };
      features.forEach((feature) => {
        const effects = featureEffects[feature];
        if (!effects) return;
        Object.entries(effects).forEach(([key, value]) => {
          metrics[key] += value;
        });
      });

      if (features.has("polar") && features.has("photo")) {
        metrics.brightness -= scene === "sun" ? 7 : 5;
        metrics.glare -= scene === "sun" ? 8 : 2;
        metrics.color += scene === "night" ? 8 : 3;
      }
      if (features.has("blue") && scene === "sun") {
        metrics.color += 12;
        metrics.brightness += 3;
      }

      Object.keys(metrics).forEach((key) => {
        metrics[key] = clamp(metrics[key], 0, 100);
      });
      return metrics;
    };

    const computeFit = () => {
      const sceneData = getScene(scene);
      const selected = Array.from(features);
      const ideal = new Set(sceneData.optimal);
      const matches = selected.filter((key) => ideal.has(key)).length;
      const misses = selected.filter((key) => !ideal.has(key)).length;
      const exact =
        selected.length === sceneData.optimal.length &&
        sceneData.optimal.every((key) => features.has(key));
      return clamp(matches * 3.6 - misses * 2.4 + (exact ? 6 : 0), -8, 18);
    };

    const computeScore = (metrics) => {
      const sceneData = getScene(scene);
      const brightnessPenalty = Math.abs(metrics.brightness - sceneData.targetBrightness);
      const penalty =
        metrics.glare * sceneData.weights.glare +
        metrics.blur * sceneData.weights.blur +
        metrics.fatigue * sceneData.weights.fatigue +
        brightnessPenalty * sceneData.weights.brightness +
        metrics.color * sceneData.weights.color;
      lastFit = computeFit();
      return Math.round(clamp(100 - penalty + lastFit, 0, 99));
    };

    const getPreviewCode = () => {
      const sceneData = getScene(scene);
      const hintState = ensureSceneHints(scene);
      const revealed = new Set(hintState.revealed || []);
      if (lastScore >= sceneData.minScore) return code;
      const threshold = sceneData.minScore - 16;
      return Array.from({ length: sceneData.codeLength }, (_, idx) => {
        if (revealed.has(idx)) return code[idx];
        if (lastScore >= threshold && idx === 0) return code[idx];
        if (lastScore >= threshold + 6 && idx === sceneData.codeLength - 1) return code[idx];
        return "•";
      }).join("");
    };

    const describeNoise = (metrics) => {
      const sceneData = getScene(scene);
      const burden =
        metrics.glare * 0.36 +
        metrics.blur * 0.24 +
        metrics.fatigue * 0.2 +
        Math.abs(metrics.brightness - sceneData.targetBrightness) * 0.2;
      if (burden < 28) return "Baja";
      if (burden < 44) return "Media";
      return "Alta";
    };

    const describeFit = () => {
      if (lastScore >= getScene(scene).minScore) return "Listo";
      if (lastFit >= 7) return "Cerca";
      if (features.size === 0) return "Sin calibrar";
      return "Mejorable";
    };

    const showFeedback = (message, tone = "info") => {
      if (!feedback) return;
      feedback.textContent = message;
      feedback.dataset.tone = tone;
      feedback.classList.toggle("is-visible", Boolean(message));
    };

    const updateHintDisplay = () => {
      const sceneData = getScene(scene);
      const hintState = ensureSceneHints(scene);
      const revealed = new Set(hintState.revealed || []);
      const chars = Array.from({ length: sceneData.codeLength }, (_, idx) =>
        revealed.has(idx) ? code[idx] : "_",
      );
      if (hintEl) hintEl.textContent = revealed.size ? chars.join(" ") : "";
      if (hintBtn) {
        const used = hintState.used || 0;
        hintBtn.disabled = used >= 2;
        hintBtn.textContent = `Pista (${used}/2)`;
      }
    };

    const updateSceneButtons = () => {
      sceneButtons.forEach((btn) => {
        const id = btn.dataset.lensScene;
        const idx = getSceneIndex(id);
        const locked = idx > unlocked;
        btn.classList.toggle("active", id === scene);
        btn.disabled = locked;
        btn.setAttribute("aria-pressed", id === scene ? "true" : "false");
        btn.setAttribute("aria-disabled", locked ? "true" : "false");
      });
    };

    const updateFeatureButtons = () => {
      featureButtons.forEach((btn) => {
        const key = btn.dataset.lensFeature;
        const active = key ? features.has(key) : false;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
    };

    const updateStats = (score, metrics) => {
      const sceneData = getScene(scene);
      scoreEls.forEach((el) => (el.textContent = String(score)));
      minEls.forEach((el) => (el.textContent = String(sceneData.minScore)));
      sceneLabelEls.forEach((el) => (el.textContent = sceneData.label));
      if (meter) meter.style.width = `${score}%`;
      if (levelEl) levelEl.textContent = `${getSceneIndex(scene) + 1}/${scenes.length}`;
      if (missionEl) missionEl.textContent = sceneData.mission;
      if (previewEl) previewEl.textContent = getPreviewCode();
      if (noiseEl) noiseEl.textContent = describeNoise(metrics);
      if (synergyEl) synergyEl.textContent = describeFit();
      if (streakEl) streakEl.textContent = String(completed);
      if (attemptsEl) attemptsEl.textContent = String(stats[scene]?.attempts || 0);
      if (bestEl) bestEl.textContent = String(stats[scene]?.best || 0);
      if (stage) {
        const clarity = clamp(score / 100, 0, 1);
        stage.style.setProperty("--lens-code-blur", `${(1 - clarity) * 10}px`);
        stage.style.setProperty("--lens-code-opacity", String(0.32 + clarity * 0.68));
        stage.style.setProperty("--lens-code-scale", String(1.03 - clarity * 0.03));
      }
    };

    const drawNight = (w, h, sceneData, clarity, metrics) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, sceneData.palette[0]);
      bg.addColorStop(0.6, sceneData.palette[1]);
      bg.addColorStop(1, "#030605");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const glarePower = metrics.glare / 100;
      [
        [0.18, 0.28, "#f2b84b"],
        [0.36, 0.2, "#ec6d52"],
        [0.7, 0.24, "#fbfbf7"],
        [0.84, 0.34, "#9cd7ff"],
      ].forEach(([x, y, color], idx) => {
        const cx = x * w;
        const cy = y * h;
        const r = (46 + idx * 12) * (0.8 + glarePower);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        const alpha = Math.round(45 + glarePower * 105).toString(16).padStart(2, "0");
        g.addColorStop(0, `${color}${alpha}`);
        g.addColorStop(1, `${color}00`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      });

      const road = ctx.createLinearGradient(0, h * 0.54, 0, h);
      road.addColorStop(0, "rgba(7, 22, 15, 0.38)");
      road.addColorStop(1, "rgba(2, 5, 4, 0.94)");
      ctx.fillStyle = road;
      ctx.beginPath();
      ctx.moveTo(w * 0.36, h * 0.58);
      ctx.lineTo(w * 0.64, h * 0.58);
      ctx.lineTo(w * 0.94, h);
      ctx.lineTo(w * 0.06, h);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(242, 184, 75, ${0.25 + clarity * 0.35})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.62);
      ctx.lineTo(w * 0.5, h);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawScreen = (w, h, sceneData, clarity, metrics) => {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, sceneData.palette[0]);
      bg.addColorStop(1, sceneData.palette[1]);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = `rgba(156, 215, 255, ${0.04 + metrics.fatigue / 1200})`;
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += 22) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const mw = w * 0.78;
      const mh = h * 0.56;
      const mx = (w - mw) / 2;
      const my = h * 0.18;
      ctx.fillStyle = "rgba(251, 251, 247, 0.08)";
      ctx.strokeStyle = "rgba(251, 251, 247, 0.26)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(mx, my, mw, mh, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(156, 215, 255, ${0.05 + clarity * 0.09})`;
      ctx.beginPath();
      ctx.roundRect(mx + 14, my + 14, mw - 28, mh - 28, 14);
      ctx.fill();

      ctx.fillStyle = "rgba(251, 251, 247, 0.16)";
      for (let i = 0; i < 8; i += 1) {
        ctx.fillRect(mx + 38, my + 42 + i * 22, mw - 76 - i * 18, 5);
      }
      ctx.fillStyle = `rgba(236, 109, 82, ${0.1 + metrics.fatigue / 350})`;
      ctx.fillRect(mx + 34, my + mh - 58, mw - 68, 12);
    };

    const drawSun = (w, h, sceneData, clarity, metrics) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#e8fbff");
      bg.addColorStop(0.58, sceneData.palette[0]);
      bg.addColorStop(1, "#b8e1bc");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const sx = w * 0.78;
      const sy = h * 0.22;
      const sr = Math.min(w, h) * 0.14;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.2);
      g.addColorStop(0, `rgba(255, 199, 79, ${0.62 + metrics.glare / 260})`);
      g.addColorStop(1, "rgba(255, 199, 79, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(13, 127, 86, 0.18)";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.7);
      ctx.bezierCurveTo(w * 0.2, h * 0.62, w * 0.48, h * 0.77, w, h * 0.66);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(7, 22, 15, 0.12)";
      for (let i = 0; i < 7; i += 1) {
        const x = w * (0.1 + i * 0.13);
        ctx.fillRect(x, h * 0.46 + (i % 2) * 16, 18, h * 0.22);
      }
    };

    const drawLensOverlay = (w, h, clarity, metrics) => {
      const cx = w * 0.5;
      const cy = h * 0.49;
      const rx = w * 0.3;
      const ry = h * 0.28;
      const lens = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      lens.addColorStop(0, `rgba(255, 255, 255, ${0.2 + clarity * 0.18})`);
      lens.addColorStop(0.45, `rgba(255, 255, 255, ${0.04 + clarity * 0.1})`);
      lens.addColorStop(1, `rgba(23, 166, 106, ${0.08 + clarity * 0.1})`);
      ctx.save();
      ctx.strokeStyle = `rgba(251, 251, 247, ${0.3 + clarity * 0.45})`;
      ctx.fillStyle = lens;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = Math.min(0.42, metrics.glare / 180);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
      ctx.beginPath();
      ctx.moveTo(cx - rx * 0.52, cy - ry * 0.68);
      ctx.lineTo(cx + rx * 0.62, cy + ry * 0.46);
      ctx.stroke();
      ctx.restore();
    };

    const drawCodePanel = (w, h, sceneData, clarity, metrics) => {
      const pw = w * 0.66;
      const ph = h * 0.28;
      const px = (w - pw) / 2;
      const py = h * 0.35;
      const haze = 1 - clarity;
      ctx.save();
      ctx.shadowColor = "rgba(7, 22, 15, 0.28)";
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 14;
      ctx.fillStyle = `rgba(251, 251, 247, ${0.78 + clarity * 0.18})`;
      ctx.strokeStyle = `rgba(7, 22, 15, ${0.16 + clarity * 0.12})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 16);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = `rgba(23, 166, 106, ${0.08 + clarity * 0.12})`;
      ctx.beginPath();
      ctx.roundRect(px + 12, py + 12, pw - 24, ph - 24, 12);
      ctx.fill();

      ctx.font = `900 ${Math.round(ph * 0.58)}px "Space Grotesk", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.globalAlpha = 0.14 + clarity * 0.82;
      ctx.filter = `blur(${Math.max(0, haze * 16 + metrics.blur * 0.08)}px)`;
      ctx.fillStyle = "rgba(7, 22, 15, 0.92)";
      ctx.fillText(code, px + pw / 2, py + ph / 2 + 2);
      ctx.restore();

      if (clarity > 0.7) {
        ctx.save();
        ctx.globalAlpha = (clarity - 0.7) / 0.3;
        ctx.fillStyle = "rgba(7, 22, 15, 0.95)";
        ctx.fillText(code, px + pw / 2, py + ph / 2 + 2);
        ctx.restore();
      }

      if (haze > 0.04) {
        ctx.save();
        ctx.globalAlpha = haze * (0.22 + metrics.glare / 360);
        ctx.filter = `blur(${8 + haze * 14}px)`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate(-0.14);
        ctx.fillRect(-pw * 0.58, -ph * 0.1, pw * 1.16, ph * 0.24);
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = 0.28 + clarity * 0.5;
      ctx.font = `900 ${Math.round(ph * 0.16)}px "Space Grotesk", system-ui, sans-serif`;
      ctx.fillStyle = "rgba(7, 22, 15, 0.62)";
      ctx.fillText(sceneData.shortLabel.toUpperCase(), px + pw / 2, py + ph * 0.2);
      ctx.restore();
    };

    const drawParticles = (w, h) => {
      if (!particleFrame) return;
      const progress = 1 - particleFrame / 36;
      const colors = ["#17a66a", "#f2b84b", "#ec6d52", "#9cd7ff"];
      for (let i = 0; i < 42; i += 1) {
        const angle = (Math.PI * 2 * i) / 42;
        const speed = 24 + (i % 6) * 10;
        const x = w * 0.5 + Math.cos(angle) * speed * progress;
        const y = h * 0.48 + Math.sin(angle) * speed * progress + progress * progress * 40;
        ctx.globalAlpha = Math.max(0, 1 - progress);
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      particleFrame -= 1;
      if (particleFrame > 0) requestAnimationFrame(render);
    };

    const draw = (metrics, score) => {
      resizeCanvas();
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const sceneData = getScene(scene);
      const clarity = clamp(score / 100, 0, 1);
      ctx.clearRect(0, 0, w, h);
      if (scene === "night") drawNight(w, h, sceneData, clarity, metrics);
      if (scene === "screen") drawScreen(w, h, sceneData, clarity, metrics);
      if (scene === "sun") drawSun(w, h, sceneData, clarity, metrics);
      drawLensOverlay(w, h, clarity, metrics);
      drawCodePanel(w, h, sceneData, clarity, metrics);
      drawParticles(w, h);
    };

    function render() {
      lastMetrics = computeMetrics();
      lastScore = computeScore(lastMetrics);
      updateStats(lastScore, lastMetrics);
      updateHintDisplay();
      updateSceneButtons();
      updateFeatureButtons();
      draw(lastMetrics, lastScore);
      root.dataset.lensScore = String(lastScore);
      root.dataset.lensScene = scene;
    }

    const getDebugState = () => ({
      mode: "lens_lab",
      scene,
      sceneLabel: getScene(scene).label,
      clarity: lastScore,
      minScore: getScene(scene).minScore,
      codeLength: getScene(scene).codeLength,
      code,
      features: Array.from(features),
      optimal: getScene(scene).optimal.slice(),
      unlocked,
      completed,
      hintsUsed: ensureSceneHints(scene).used || 0,
      metrics: { ...lastMetrics },
      preview: previewEl?.textContent || "",
    });

    window.render_lens_lab_to_text = () => JSON.stringify(getDebugState());
    window.render_game_to_text = window.render_lens_lab_to_text;
    window.__lensLabDebug = {
      getState: getDebugState,
      solveCurrent: () => {
        features = new Set(getScene(scene).optimal);
        render();
        return getDebugState();
      },
      setScene: (id) => {
        const idx = getSceneIndex(id);
        if (idx >= 0) {
          unlocked = Math.max(unlocked, idx);
          writeStorage(sessionStore, UNLOCK_KEY, String(unlocked));
          setScene(id);
        }
        return getDebugState();
      },
    };

    const resetFeatures = () => {
      features = new Set();
      updateFeatureButtons();
    };

    const setScene = (nextScene) => {
      const nextIdx = getSceneIndex(nextScene);
      if (nextIdx < 0) return;
      if (nextIdx > unlocked) {
        showFeedback("Completa la ronda anterior para desbloquear esta escena.");
        return;
      }
      scene = nextScene;
      showFeedback("");
      if (input) input.value = "";
      resetFeatures();
      const sceneData = getScene(scene);
      code = makeCode(sceneData.codeLength, scene);
      if (input) {
        input.maxLength = sceneData.codeLength;
        input.placeholder = "•".repeat(sceneData.codeLength);
      }
      const hintState = ensureSceneHints(scene);
      hintState.used = 0;
      hintState.revealed = [];
      hints[scene] = hintState;
      saveHints();
      render();
    };

    const toggleFeature = (key) => {
      if (!featureEffects[key]) return;
      if (features.has(key)) {
        features.delete(key);
      } else if (features.size >= MAX_ACTIVE) {
        const btn = featureButtons.find((item) => item.dataset.lensFeature === key);
        btn?.classList.add("is-blocked");
        window.setTimeout(() => btn?.classList.remove("is-blocked"), 260);
        showFeedback("El laboratorio solo admite tres tratamientos a la vez.");
        return;
      } else {
        features.add(key);
      }
      showFeedback("");
      render();
    };

    const normalizeAnswer = (value, length) =>
      (value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, length);

    const recordAttempt = () => {
      const sceneStats = ensureSceneStats(scene);
      sceneStats.attempts += 1;
      sceneStats.best = Math.max(sceneStats.best, lastScore);
      stats[scene] = sceneStats;
      saveStats();
    };

    const revealHint = () => {
      const sceneData = getScene(scene);
      const hintState = ensureSceneHints(scene);
      const revealed = new Set(hintState.revealed || []);
      if ((hintState.used || 0) >= 2 || revealed.size >= sceneData.codeLength) return;
      let idx = 0;
      while (revealed.has(idx) && idx < sceneData.codeLength) idx += 1;
      if (idx >= sceneData.codeLength) return;
      revealed.add(idx);
      hintState.revealed = Array.from(revealed);
      hintState.used = Math.min(2, (hintState.used || 0) + 1);
      hints[scene] = hintState;
      saveHints();
      showFeedback("Pista añadida al lector del código.");
      render();
    };

    const onWin = () => {
      const idx = getSceneIndex(scene);
      const hasNext = idx >= 0 && idx < scenes.length - 1;
      if (hasNext) {
        unlocked = Math.max(unlocked, idx + 1);
        writeStorage(sessionStore, UNLOCK_KEY, String(unlocked));
      }
      completed = Math.max(completed, idx + 1);
      writeStorage(sessionStore, COMPLETE_KEY, String(completed));
      showFeedback(
        hasNext
          ? `Calibración correcta. Siguiente escena: ${scenes[idx + 1].label}.`
          : "Laboratorio completado. La receta está lista para consulta.",
        "success",
      );
      particleFrame = 36;
      root.classList.add("lens-lab-won");
      window.setTimeout(() => root.classList.remove("lens-lab-won"), 1200);
      render();
      if (hasNext) window.setTimeout(() => setScene(scenes[idx + 1].id), 1500);
    };

    const validate = () => {
      const sceneData = getScene(scene);
      const value = normalizeAnswer(input?.value, sceneData.codeLength);
      if (input && input.value !== value) input.value = value;
      if (lastScore < sceneData.minScore) {
        showFeedback(`Necesitas al menos ${sceneData.minScore}% de claridad para validar.`);
        return;
      }
      if (!value || value.length < sceneData.codeLength) {
        showFeedback(`Escribe el código (${sceneData.codeLength} caracteres).`);
        return;
      }
      recordAttempt();
      if (value === code) {
        onWin();
        return;
      }
      showFeedback("El código no coincide. Revisa los caracteres visibles.");
      render();
    };

    sceneButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextScene = btn.dataset.lensScene;
        if (nextScene) setScene(nextScene);
      });
    });

    featureButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.lensFeature;
        if (key) toggleFeature(key);
      });
    });

    newBtn?.addEventListener("click", () => {
      unlocked = 0;
      completed = 0;
      writeStorage(sessionStore, UNLOCK_KEY, "0");
      writeStorage(sessionStore, COMPLETE_KEY, "0");
      stats = makeDefaultStats();
      hints = makeDefaultHints();
      saveStats();
      saveHints();
      scene = scenes[0].id;
      code = makeCode(getScene(scene).codeLength, scene);
      if (input) input.value = "";
      resetFeatures();
      showFeedback("Laboratorio reiniciado.");
      render();
    });

    hintBtn?.addEventListener("click", revealHint);
    check?.addEventListener("click", validate);
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        validate();
      }
    });
    input?.addEventListener("input", () => {
      const sceneData = getScene(scene);
      const value = normalizeAnswer(input.value, sceneData.codeLength);
      if (input.value !== value) input.value = value;
    });

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => render());
      ro.observe(canvas);
    } else {
      window.addEventListener("resize", () => render(), { passive: true });
    }

    if (input) {
      input.maxLength = getScene(scene).codeLength;
      input.placeholder = "•".repeat(getScene(scene).codeLength);
    }
    render();
  });
};

// Eye explorer (services page): realistic 2D/2.5D fallback if WebGL is unavailable.
const setupEyeExplorerFallback2D = () => {
  const root = document.querySelector("[data-eye-explorer]");
  if (!root || root.dataset.eyeExplorerFallbackReady === "true") return;

  const shared = window.TodoOpticaEyeExplorer;
  if (!shared || typeof shared.createEyeExplorerController !== "function")
    return;

  const controller = shared.createEyeExplorerController(root);
  if (!controller) return;

  const {
    canvas,
    parts,
    hotspots,
    rotateButtons,
    animateBtn,
    quizToggle,
    partButtons,
  } = controller;
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  root.dataset.eyeExplorerFallbackReady = "true";
  root.dataset.eyeExplorerPresentation = "clinical-cutaway";

  const MAX_ANGLE = shared.MAX_ANGLE || 28;
  const anchorMap = shared.ANCHORS || {};
  const reducedMotion = Boolean(window.TodoOptica?.prefersReducedMotion);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const TAU = Math.PI * 2;
  const toRad = (degrees) => (degrees * Math.PI) / 180;

  let angle = 0;
  let dragging = false;
  let dragStartX = 0;
  let dragStartAngle = 0;
  let pointerId = null;
  let angleAnimFrame = null;
  let lightAnimFrame = null;

  const lightState = {
    active: false,
    start: 0,
    duration: reducedMotion ? 420 : 1500,
  };

  const illustration = new Image();
  const illustrationBuffer = document.createElement("canvas");
  let illustrationSource = illustration;
  let illustrationReady = false;
  illustration.addEventListener("load", () => {
    illustrationReady = true;
    const width = Math.max(1, illustration.naturalWidth || 1100);
    const height = Math.max(1, illustration.naturalHeight || 620);
    illustrationBuffer.width = width;
    illustrationBuffer.height = height;
    const bufferCtx = illustrationBuffer.getContext("2d");
    if (bufferCtx) {
      bufferCtx.clearRect(0, 0, width, height);
      bufferCtx.drawImage(illustration, 0, 0, width, height);
      illustrationSource = illustrationBuffer;
    }
    render();
  });
  illustration.src = "assets/eye-anatomy-explorer.svg";

  controller.ensureHotspots((part) => {
    if (!part) return;
    startLightPulse();
    render();
  });

  const resizeCanvas = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height };
  };

  const getScene = (w, h) => {
    const normalizedAngle = clamp(angle / MAX_ANGLE, -1, 1);
    const sway = Math.sin(toRad(angle * 2.1));
    const frameWidth = w * (0.84 - Math.abs(normalizedAngle) * 0.025);
    const frameHeight = h * 0.77;
    const frameX = w * 0.072 + normalizedAngle * w * 0.018;
    const frameY = h * 0.09;

    return {
      w,
      h,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      normalizedAngle,
      sway,
      centerX: frameX + frameWidth * 0.52,
      centerY: frameY + frameHeight * 0.54,
      shadowY: h * 0.85,
    };
  };

  const getPartAnchor = (partId, scene) => {
    const anchor = anchorMap[partId] ||
      anchorMap.vitreous || {
        x: 0.5,
        y: 0.5,
        rx: 0.06,
        ry: 0.06,
        depthShift: 0,
      };
    const depthShift = anchor.depthShift || 0;

    return {
      x:
        scene.frameX +
        scene.frameWidth * anchor.x +
        scene.normalizedAngle * scene.frameWidth * 0.03 * depthShift,
      y:
        scene.frameY +
        scene.frameHeight * anchor.y +
        scene.sway * scene.frameHeight * 0.006 * depthShift,
      rx: scene.frameWidth * anchor.rx,
      ry: scene.frameHeight * anchor.ry,
    };
  };

  const drawBackdrop = (scene) => {
    const base = ctx.createLinearGradient(0, 0, 0, scene.h);
    base.addColorStop(0, "#fdfcf8");
    base.addColorStop(0.58, "#eef3ef");
    base.addColorStop(1, "#d9e2db");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, scene.w, scene.h);

    const warmGlow = ctx.createRadialGradient(
      scene.frameX + scene.frameWidth * 0.04,
      scene.frameY + scene.frameHeight * 0.32,
      scene.frameWidth * 0.02,
      scene.frameX + scene.frameWidth * 0.04,
      scene.frameY + scene.frameHeight * 0.32,
      scene.frameWidth * 0.32,
    );
    warmGlow.addColorStop(0, "rgba(255, 228, 179, 0.42)");
    warmGlow.addColorStop(1, "rgba(255, 228, 179, 0)");
    ctx.fillStyle = warmGlow;
    ctx.fillRect(0, 0, scene.w, scene.h);

    const posteriorWash = ctx.createRadialGradient(
      scene.frameX + scene.frameWidth * 0.78,
      scene.frameY + scene.frameHeight * 0.56,
      scene.frameWidth * 0.02,
      scene.frameX + scene.frameWidth * 0.78,
      scene.frameY + scene.frameHeight * 0.56,
      scene.frameWidth * 0.4,
    );
    posteriorWash.addColorStop(0, "rgba(156, 96, 88, 0.18)");
    posteriorWash.addColorStop(1, "rgba(156, 96, 88, 0)");
    ctx.fillStyle = posteriorWash;
    ctx.fillRect(0, 0, scene.w, scene.h);

    ctx.fillStyle = "rgba(12, 24, 19, 0.12)";
    ctx.beginPath();
    ctx.ellipse(
      scene.centerX,
      scene.shadowY,
      scene.frameWidth * 0.23,
      scene.frameHeight * 0.06,
      0,
      0,
      TAU,
    );
    ctx.fill();
  };

  const drawIllustration = (scene) => {
    if (!illustrationReady || !illustrationSource) return false;

    const offsetX = scene.normalizedAngle * scene.w * 0.016;
    const offsetY = Math.abs(scene.normalizedAngle) * scene.h * 0.006;

    ctx.save();
    ctx.shadowColor = "rgba(26, 35, 32, 0.18)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetX = 8 + scene.normalizedAngle * 12;
    ctx.shadowOffsetY = 16;
    ctx.drawImage(
      illustrationSource,
      scene.frameX + offsetX,
      scene.frameY + offsetY,
      scene.frameWidth,
      scene.frameHeight,
    );
    ctx.restore();

    const anteriorAnchor = getPartAnchor("cornea", scene);
    const posteriorAnchor = getPartAnchor("retina", scene);
    const lensAnchor = getPartAnchor("lens", scene);

    const cornealGlaze = ctx.createRadialGradient(
      anteriorAnchor.x - anteriorAnchor.rx * 0.3,
      anteriorAnchor.y - anteriorAnchor.ry * 0.6,
      anteriorAnchor.rx * 0.15,
      anteriorAnchor.x - anteriorAnchor.rx * 0.3,
      anteriorAnchor.y - anteriorAnchor.ry * 0.6,
      anteriorAnchor.rx * 2.2,
    );
    cornealGlaze.addColorStop(0, "rgba(255, 255, 255, 0.34)");
    cornealGlaze.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = cornealGlaze;
    ctx.beginPath();
    ctx.ellipse(
      anteriorAnchor.x,
      anteriorAnchor.y,
      anteriorAnchor.rx * 2.4,
      anteriorAnchor.ry * 2.7,
      -0.18,
      0,
      TAU,
    );
    ctx.fill();

    const chamberWash = ctx.createLinearGradient(
      anteriorAnchor.x,
      anteriorAnchor.y,
      lensAnchor.x,
      lensAnchor.y,
    );
    chamberWash.addColorStop(0, "rgba(211, 235, 246, 0.18)");
    chamberWash.addColorStop(1, "rgba(211, 235, 246, 0)");
    ctx.fillStyle = chamberWash;
    ctx.beginPath();
    ctx.ellipse(
      (anteriorAnchor.x + lensAnchor.x) * 0.5,
      lensAnchor.y,
      scene.frameWidth * 0.095,
      scene.frameHeight * 0.17,
      0,
      0,
      TAU,
    );
    ctx.fill();

    const vitreousSheen = ctx.createRadialGradient(
      scene.frameX + scene.frameWidth * 0.48,
      scene.frameY + scene.frameHeight * 0.36,
      scene.frameWidth * 0.05,
      scene.frameX + scene.frameWidth * 0.48,
      scene.frameY + scene.frameHeight * 0.36,
      scene.frameWidth * 0.26,
    );
    vitreousSheen.addColorStop(0, "rgba(255, 255, 255, 0.18)");
    vitreousSheen.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = vitreousSheen;
    ctx.beginPath();
    ctx.ellipse(
      scene.frameX + scene.frameWidth * 0.5,
      scene.frameY + scene.frameHeight * 0.45,
      scene.frameWidth * 0.18,
      scene.frameHeight * 0.16,
      -0.16,
      0,
      TAU,
    );
    ctx.fill();

    const posteriorDepth = ctx.createRadialGradient(
      posteriorAnchor.x,
      posteriorAnchor.y,
      posteriorAnchor.rx * 0.15,
      posteriorAnchor.x,
      posteriorAnchor.y,
      posteriorAnchor.rx * 2.4,
    );
    posteriorDepth.addColorStop(0, "rgba(127, 58, 53, 0.2)");
    posteriorDepth.addColorStop(1, "rgba(127, 58, 53, 0)");
    ctx.fillStyle = posteriorDepth;
    ctx.beginPath();
    ctx.ellipse(
      posteriorAnchor.x,
      posteriorAnchor.y,
      posteriorAnchor.rx * 2,
      posteriorAnchor.ry * 1.45,
      0,
      0,
      TAU,
    );
    ctx.fill();

    return true;
  };

  const drawFallbackSilhouette = (scene) => {
    const shellGradient = ctx.createLinearGradient(
      scene.frameX,
      scene.frameY,
      scene.frameX + scene.frameWidth,
      scene.frameY + scene.frameHeight,
    );
    shellGradient.addColorStop(0, "#ffffff");
    shellGradient.addColorStop(0.5, "#e9eee9");
    shellGradient.addColorStop(1, "#cad4ce");

    ctx.fillStyle = shellGradient;
    ctx.beginPath();
    ctx.ellipse(
      scene.centerX,
      scene.centerY,
      scene.frameWidth * 0.34,
      scene.frameHeight * 0.26,
      0,
      0,
      TAU,
    );
    ctx.fill();
  };

  const drawHighlight = (scene) => {
    const activePart = controller.getActivePart();
    if (!activePart) return;

    const anchor = getPartAnchor(activePart.id, scene);
    const ringScale =
      activePart.id === "retina" || activePart.id === "sclera" ? 1.95 : 1.6;
    const pulse = 1 + Math.sin(performance.now() / 420) * 0.04;

    ctx.save();
    const glow = ctx.createRadialGradient(
      anchor.x,
      anchor.y,
      anchor.rx * 0.3,
      anchor.x,
      anchor.y,
      anchor.rx * ringScale * 1.7,
    );
    glow.addColorStop(0, `${activePart.color}2f`);
    glow.addColorStop(0.55, `${activePart.color}14`);
    glow.addColorStop(1, `${activePart.color}00`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(
      anchor.x,
      anchor.y,
      anchor.rx * ringScale * 1.28,
      anchor.ry * ringScale * 1.2,
      0,
      0,
      TAU,
    );
    ctx.fill();

    ctx.strokeStyle = `${activePart.color}96`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(
      anchor.x,
      anchor.y,
      anchor.rx * ringScale * pulse,
      anchor.ry * ringScale * pulse,
      0,
      0,
      TAU,
    );
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(
      anchor.x,
      anchor.y,
      anchor.rx * ringScale * 0.72,
      anchor.ry * ringScale * 0.72,
      0,
      0,
      TAU,
    );
    ctx.stroke();
    ctx.restore();
  };

  const drawLightPath = (scene) => {
    if (!lightState.active) return;

    const elapsed = performance.now() - lightState.start;
    const progress = clamp(elapsed / lightState.duration, 0, 1);
    const intensity = Math.pow(Math.sin(progress * Math.PI), 1.2);
    if (intensity <= 0.01) return;

    const cornea = getPartAnchor("cornea", scene);
    const lens = getPartAnchor("lens", scene);
    const retina = getPartAnchor("retina", scene);
    const beamStartX = scene.frameX - scene.frameWidth * 0.09;
    const beamStartY = cornea.y - scene.frameHeight * 0.018;

    const beamCore = ctx.createLinearGradient(
      beamStartX,
      beamStartY,
      retina.x,
      retina.y,
    );
    beamCore.addColorStop(0, `rgba(255, 243, 190, ${0.08 + intensity * 0.18})`);
    beamCore.addColorStop(
      0.42,
      `rgba(255, 211, 135, ${0.18 + intensity * 0.2})`,
    );
    beamCore.addColorStop(1, `rgba(249, 124, 96, ${0.2 + intensity * 0.24})`);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = beamCore;
    ctx.shadowColor = `rgba(255, 180, 99, ${0.26 + intensity * 0.18})`;
    ctx.shadowBlur = 18;
    ctx.lineWidth = scene.frameHeight * 0.03;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY);
    ctx.quadraticCurveTo(cornea.x - cornea.rx * 0.8, cornea.y, lens.x, lens.y);
    ctx.quadraticCurveTo(
      lens.x + scene.frameWidth * 0.09,
      lens.y - scene.frameHeight * 0.01,
      retina.x - retina.rx * 0.45,
      retina.y,
    );
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(255, 250, 226, ${0.34 + intensity * 0.28})`;
    ctx.lineWidth = scene.frameHeight * 0.008;
    ctx.beginPath();
    ctx.moveTo(beamStartX, beamStartY);
    ctx.quadraticCurveTo(cornea.x - cornea.rx * 0.8, cornea.y, lens.x, lens.y);
    ctx.quadraticCurveTo(
      lens.x + scene.frameWidth * 0.09,
      lens.y - scene.frameHeight * 0.01,
      retina.x - retina.rx * 0.45,
      retina.y,
    );
    ctx.stroke();

    ctx.fillStyle = `rgba(255, 168, 123, ${0.18 + intensity * 0.26})`;
    ctx.beginPath();
    ctx.ellipse(
      retina.x - retina.rx * 0.2,
      retina.y,
      retina.rx * 0.45,
      retina.ry * 0.28,
      0,
      0,
      TAU,
    );
    ctx.fill();
    ctx.restore();
  };

  const updateHotspots = (scene) => {
    if (!hotspots.size) return;

    parts.forEach((part) => {
      const anchor = getPartAnchor(part.id, scene);
      const button = hotspots.get(part.id);
      if (!button) return;

      const size = clamp((anchor.rx + anchor.ry) * 0.52, 14, 28);
      button.style.left = `${anchor.x}px`;
      button.style.top = `${anchor.y}px`;
      button.style.width = `${size}px`;
      button.style.height = `${size}px`;
      button.setAttribute(
        "aria-pressed",
        controller.getActivePart()?.id === part.id ? "true" : "false",
      );
    });
  };

  const render = () => {
    const { width, height } = resizeCanvas();
    const scene = getScene(width, height);

    ctx.clearRect(0, 0, width, height);
    drawBackdrop(scene);
    if (!drawIllustration(scene)) drawFallbackSilhouette(scene);
    drawHighlight(scene);
    drawLightPath(scene);
    updateHotspots(scene);

    root.style.setProperty(
      "--eye-angle",
      String(clamp(angle / MAX_ANGLE, -1, 1)),
    );
    root.style.setProperty(
      "--eye-light-strength",
      lightState.active
        ? String(
            clamp(
              Math.pow(
                Math.sin(
                  clamp(
                    (performance.now() - lightState.start) /
                      lightState.duration,
                    0,
                    1,
                  ) * Math.PI,
                ),
                1.15,
              ),
              0,
              1,
            ),
          )
        : "0",
    );
  };

  const setAngle = (next) => {
    angle = clamp(next, -MAX_ANGLE, MAX_ANGLE);
    controller.setAngleLabel(angle);
    render();
  };

  const nudgeAngle = (delta) => {
    setAngle(angle + delta);
  };

  const startLightPulse = () => {
    lightState.active = true;
    lightState.start = performance.now();
    lightState.duration = reducedMotion ? 420 : 1500;

    if (lightAnimFrame) cancelAnimationFrame(lightAnimFrame);
    const tick = () => {
      render();
      if (performance.now() - lightState.start >= lightState.duration) {
        lightState.active = false;
        lightAnimFrame = null;
        render();
        return;
      }
      lightAnimFrame = requestAnimationFrame(tick);
    };
    lightAnimFrame = requestAnimationFrame(tick);
  };

  const startRotationSweep = () => {
    if (angleAnimFrame) cancelAnimationFrame(angleAnimFrame);
    const start = performance.now();
    const duration = reducedMotion ? 900 : 1850;
    const amplitude = MAX_ANGLE * 0.84;

    const tick = (now) => {
      const progress = (now - start) / duration;
      if (progress >= 1) {
        angleAnimFrame = null;
        setAngle(0);
        return;
      }
      setAngle(Math.sin(progress * Math.PI * 2) * amplitude);
      angleAnimFrame = requestAnimationFrame(tick);
    };
    angleAnimFrame = requestAnimationFrame(tick);
  };

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    pointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartAngle = angle;
    canvas.setPointerCapture?.(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || pointerId !== event.pointerId) return;
    const delta = (event.clientX - dragStartX) / 7.5;
    setAngle(dragStartAngle + delta);
  });

  const stopDragging = (event) => {
    if (!dragging) return;
    if (event && pointerId !== null && event.pointerId !== pointerId) return;
    dragging = false;
    if (pointerId !== null) {
      canvas.releasePointerCapture?.(pointerId);
    }
    pointerId = null;
  };

  canvas.addEventListener("pointerup", stopDragging);
  canvas.addEventListener("pointercancel", stopDragging);
  window.addEventListener("pointerup", stopDragging);

  rotateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.eyeRotate === "right" ? 1 : -1;
      nudgeAngle(direction * 6);
      startLightPulse();
    });
  });

  animateBtn?.addEventListener("click", () => {
    startRotationSweep();
    startLightPulse();
  });

  partButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const partId = button.dataset.eyePart;
      if (!partId) return;
      controller.setActivePart(partId);
      render();
    });
  });

  quizToggle?.addEventListener("click", () => {
    controller.toggleQuiz();
    render();
  });

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof Element) {
      if (event.target.closest("input, textarea, select, button")) return;
    }

    const rect = root.getBoundingClientRect();
    const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
    if (!isVisible) return;

    if (event.key === "ArrowLeft") nudgeAngle(-6);
    if (event.key === "ArrowRight") nudgeAngle(6);
  });

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(() => render());
    resizeObserver.observe(canvas);
  } else {
    window.addEventListener("resize", render, { passive: true });
  }

  controller.setActivePart(shared.DEFAULT_PART_ID || parts[0]?.id);
  controller.setAngleLabel(0);
  render();
};

const importModule = (path) => {
  try {
    return Function("modulePath", "return import(modulePath);")(path);
  } catch (error) {
    return Promise.reject(error);
  }
};

// Eye explorer (services page): prefer the WebGL 3D model, fallback to 2D canvas.
const setupEyeExplorer = async () => {
  const root = document.querySelector("[data-eye-explorer]");
  if (!root || root.dataset.eyeExplorerReady === "true") return;
  root.dataset.eyeExplorerReady = "true";

  const prefer3D =
    root.dataset.eyeUse3d === "true" || window.__eyeExplorerUse3D === true;

  if (!prefer3D) {
    root.dataset.eyeExplorerMode = "2d";
    setupEyeExplorerFallback2D();
    return;
  }

  const canAttempt3D =
    typeof Promise === "function" &&
    typeof Function === "function" &&
    typeof HTMLCanvasElement !== "undefined";

  if (canAttempt3D) {
    try {
      const eyeExplorer3D = await importModule("./script-eye-explorer-3d.js");
      const enabled =
        typeof eyeExplorer3D?.setupEyeExplorer3D === "function" &&
        (await eyeExplorer3D.setupEyeExplorer3D());
      if (enabled) {
        root.dataset.eyeExplorerMode = "3d";
        return;
      }
    } catch (error) {
      console.warn("Eye Explorer 3D unavailable, using 2D fallback.", error);
    }
  }

  root.dataset.eyeExplorerMode = "2d";
  setupEyeExplorerFallback2D();
};

setupLensLab();
setupEyeExplorer();
