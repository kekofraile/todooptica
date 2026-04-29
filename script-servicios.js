// Lens lab (services page): a small interactive game to "feel" lens treatments.
const setupLensLab = () => {
  const roots = document.querySelectorAll("[data-lens-lab]");
  if (!roots.length) return;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const makeCode = (length = 4) => {
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
  };

  roots.forEach((root) => {
    if (root.dataset.lensLabReady === "true") return;
    root.dataset.lensLabReady = "true";

    const canvas = root.querySelector("[data-lens-canvas]");
    const meter = root.querySelector("[data-lens-meter]");
    const scoreEls = Array.from(root.querySelectorAll("[data-lens-score]"));
    const minEls = Array.from(root.querySelectorAll("[data-lens-min]"));
    const sceneLabelEls = Array.from(
      root.querySelectorAll("[data-lens-scene-label]"),
    );
    const input = root.querySelector("[data-lens-answer]");
    const check = root.querySelector("[data-lens-check]");
    const feedback = root.querySelector("[data-lens-feedback]");
    const hintBtn = root.querySelector("[data-lens-hint-btn]");
    const hintEl = root.querySelector("[data-lens-hint]");
    const attemptsEl = root.querySelector("[data-lens-attempts]");
    const bestEl = root.querySelector("[data-lens-best]");
    const newBtn = root.querySelector("[data-lens-new]");
    const sceneButtons = Array.from(root.querySelectorAll("[data-lens-scene]"));
    const featureButtons = Array.from(
      root.querySelectorAll("[data-lens-feature]"),
    );

    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const STORE_KEY = "todooptica_lens_lab_unlock";
    const STATS_KEY = "todooptica_lens_lab_stats";
    const HINT_KEY = "todooptica_lens_lab_hints";
    const scenes = [
      { id: "noche", label: "Noche (reflejos)" },
      { id: "pantalla", label: "Pantalla (fatiga)" },
      { id: "sol", label: "Exterior (luz)" },
    ];
    const sceneSettings = {
      noche: { minScore: 58, codeLength: 4 },
      pantalla: { minScore: 62, codeLength: 5 },
      sol: { minScore: 66, codeLength: 5 },
    };

    const sceneBase = {
      noche: {
        blur: 12.8,
        brightness: 0.74,
        contrast: 0.48,
        saturate: 0.68,
        hue: 0,
        glare: 2.05,
      },
      pantalla: {
        blur: 13.6,
        brightness: 0.82,
        contrast: 0.46,
        saturate: 0.66,
        hue: 18,
        glare: 1.85,
      },
      sol: {
        blur: 11.2,
        brightness: 1.08,
        contrast: 0.52,
        saturate: 0.82,
        hue: -10,
        glare: 2.15,
      },
    };

    const featureMods = {
      ar: (p) => {
        p.glare -= 1.35;
        p.contrast += 0.6;
        p.blur -= 3.8;
      },
      polar: (p) => {
        p.glare -= 1.6;
        p.contrast += 0.7;
        p.brightness -= 0.18;
        p.saturate += 0.26;
        p.blur -= 1.9;
      },
      screen: (p) => {
        p.hue -= 25;
        p.contrast += 0.55;
        p.saturate -= 0.22;
        p.glare -= 0.55;
        p.blur -= 1.8;
      },
      photo: (p) => {
        p.brightness += p.brightness > 1.04 ? -0.5 : 0;
        p.glare -= 0.9;
        p.contrast += 0.45;
        p.blur -= 1.6;
      },
    };

    const getSceneIndex = (id) => scenes.findIndex((s) => s.id === id);
    const getSceneSettings = (id) => sceneSettings[id] || sceneSettings.noche;
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
        return true;
      } catch {
        return false;
      }
    };

    let stats = safeParse(
      readStorage(localStore, STATS_KEY),
      makeDefaultStats(),
    );
    let hints = safeParse(
      readStorage(sessionStore, HINT_KEY),
      makeDefaultHints(),
    );

    const ensureSceneStats = (id) => {
      if (!stats[id]) stats[id] = { attempts: 0, best: 0 };
      return stats[id];
    };

    const ensureSceneHints = (id) => {
      if (!hints[id]) hints[id] = { used: 0, revealed: [] };
      return hints[id];
    };

    const saveStats = () => {
      writeStorage(localStore, STATS_KEY, JSON.stringify(stats));
    };

    const saveHints = () => {
      writeStorage(sessionStore, HINT_KEY, JSON.stringify(hints));
    };

    let unlocked = clamp(
      Number(readStorage(sessionStore, STORE_KEY) || 0),
      0,
      2,
    );
    let scene = scenes[0].id;
    let features = new Set();
    let code = makeCode(getSceneSettings(scene).codeLength);
    let lastScore = 0;

    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function roundRect(
        x,
        y,
        w,
        h,
        r,
      ) {
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

    const drawNight = (w, h) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#061413");
      bg.addColorStop(1, "#081b10");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 18; i += 1) {
        const x = Math.random() * w;
        const y = Math.random() * h * 0.7;
        const r = 18 + Math.random() * 44;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        const palette = ["#f2cf70", "#ff7a59", "#28c07b", "#9aa7ff"];
        const c = palette[Math.floor(Math.random() * palette.length)];
        g.addColorStop(0, `${c}55`);
        g.addColorStop(1, `${c}00`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(3, 8, 6, 0.78)";
      ctx.fillRect(0, h * 0.72, w, h * 0.28);
      ctx.strokeStyle = "rgba(182, 192, 15, 0.35)";
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h);
      ctx.lineTo(w * 0.5, h * 0.72);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawScreen = (w, h) => {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#07120f");
      bg.addColorStop(1, "#0b2318");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "rgba(251, 251, 247, 0.06)";
      ctx.lineWidth = 1;
      const step = 24;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const mw = w * 0.78;
      const mh = h * 0.54;
      const mx = (w - mw) / 2;
      const my = h * 0.18;
      ctx.fillStyle = "rgba(251, 251, 247, 0.1)";
      ctx.strokeStyle = "rgba(251, 251, 247, 0.22)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(mx, my, mw, mh, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "rgba(251, 251, 247, 0.12)";
      ctx.beginPath();
      ctx.roundRect(mx + 14, my + 14, mw - 28, mh - 28, 14);
      ctx.fill();

      for (let i = 0; i < 120; i += 1) {
        ctx.fillStyle = "rgba(251, 251, 247, 0.03)";
        ctx.fillRect(
          mx + 14 + Math.random() * (mw - 28),
          my + 14 + Math.random() * (mh - 28),
          1,
          1,
        );
      }
    };

    const drawSun = (w, h) => {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#f8fbff");
      bg.addColorStop(1, "#dff2e5");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const sx = w * 0.78;
      const sy = h * 0.22;
      const sr = Math.min(w, h) * 0.14;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.1);
      g.addColorStop(0, "rgba(255, 199, 79, 0.9)");
      g.addColorStop(1, "rgba(255, 199, 79, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 2.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(7, 22, 15, 0.06)";
      ctx.fillRect(0, h * 0.72, w, h * 0.28);
    };

    const drawCodePanel = (w, h, p, clarity) => {
      const pw = w * 0.66;
      const ph = h * 0.28;
      const px = (w - pw) / 2;
      const py = h * 0.35;
      const safeClarity =
        typeof clarity === "number" ? clamp(clarity, 0, 1) : 0.25;
      const haze = 1 - safeClarity;

      ctx.fillStyle = `rgba(251, 251, 247, ${0.84 + safeClarity * 0.14})`;
      ctx.strokeStyle = "rgba(7, 22, 15, 0.22)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = `rgba(11, 156, 76, ${0.1 + safeClarity * 0.1})`;
      ctx.beginPath();
      ctx.roundRect(px + 10, py + 10, pw - 20, ph - 20, 14);
      ctx.fill();

      ctx.font = `900 ${Math.round(ph * 0.62)}px "Space Grotesk", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.globalAlpha = 0.08 + safeClarity * 0.9;
      ctx.filter = `blur(${2 + haze * 18 + (p?.blur || 0) * 0.35}px)`;
      ctx.fillStyle = "rgba(7, 22, 15, 0.92)";
      ctx.fillText(code, px + pw / 2, py + ph / 2 + 2);
      ctx.restore();

      if (haze > 0.05) {
        ctx.save();
        ctx.filter = `blur(${12 + (p?.blur || 2) * 1.4}px)`;
        ctx.globalAlpha = 0.12 + haze * 0.28;
        ctx.fillStyle = "rgba(7, 22, 15, 0.65)";
        const offsets = [-18, -8, 10, 22];
        offsets.forEach((dx, idx) => {
          const dy = idx % 2 === 0 ? -6 : 8;
          ctx.fillText(code, px + pw / 2 + dx, py + ph / 2 + dy);
        });
        ctx.restore();
      }

      if (safeClarity > 0.65) {
        ctx.save();
        ctx.filter = "none";
        ctx.globalAlpha = (safeClarity - 0.65) / 0.35;
        ctx.fillStyle = "rgba(7, 22, 15, 0.92)";
        ctx.fillText(code, px + pw / 2, py + ph / 2 + 2);
        ctx.restore();
      }

      ctx.font = `800 ${Math.round(ph * 0.18)}px "Space Grotesk", system-ui, sans-serif`;
      ctx.save();
      ctx.globalAlpha = 0.2 + safeClarity * 0.6;
      ctx.filter = `blur(${1 + haze * 8}px)`;
      ctx.fillStyle = "rgba(7, 22, 15, 0.7)";
      ctx.fillText("TODO OPTICA LAB", px + pw / 2, py + ph * 0.18);
      ctx.restore();

      if (p) {
        const glareStrength = Math.min(
          0.85,
          0.25 + p.glare * 0.4 + haze * 0.35,
        );
        if (glareStrength * haze > 0.04) {
          ctx.save();
          ctx.globalAlpha = glareStrength * (0.6 + haze);
          ctx.filter = `blur(${10 + p.blur * 1.6}px)`;
          const g = ctx.createLinearGradient(px, py, px + pw, py + ph);
          g.addColorStop(0, "rgba(255, 255, 255, 0.85)");
          g.addColorStop(0.45, "rgba(255, 255, 255, 0.25)");
          g.addColorStop(1, "rgba(255, 255, 255, 0.85)");
          ctx.fillStyle = g;
          ctx.fillRect(px - 20, py + ph * 0.15, pw + 40, ph * 0.7);
          ctx.restore();
        }

        if (haze > 0.2) {
          ctx.save();
          ctx.globalAlpha = 0.12 + haze * 0.22;
          ctx.filter = `blur(${6 + p.blur * 0.6}px)`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.fillRect(px - 10, py - 6, pw + 20, ph + 12);
          ctx.restore();
        }
      }
    };

    const draw = (p, clarity) => {
      resizeCanvas();
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      if (scene === "noche") drawNight(w, h);
      if (scene === "pantalla") drawScreen(w, h);
      if (scene === "sol") drawSun(w, h);
      drawCodePanel(w, h, p, clarity);
    };

    const computeParams = () => {
      const base = sceneBase[scene] || sceneBase.noche;
      const params = { ...base };
      features.forEach((key) => {
        const apply = featureMods[key];
        if (apply) apply(params);
      });

      params.glare = clamp(params.glare, 0, 2.4);
      params.blur = clamp(params.blur, 0.6, 16);
      params.brightness = clamp(params.brightness, 0.45, 1.35);
      params.contrast = clamp(params.contrast, 0.45, 1.6);
      params.saturate = clamp(params.saturate, 0.45, 1.6);
      params.hue = clamp(params.hue, -45, 45);

      return params;
    };

    const computeScore = (p) => {
      const glarePenalty = Math.min(0.9, (p.glare / 2.4) * 0.9);
      const blurPenalty = Math.min(0.9, (p.blur / 14) * 0.95);
      const contrastBonus = Math.max(0, p.contrast - 1) * 0.55;
      const brightnessPenalty = Math.min(
        0.45,
        Math.abs(p.brightness - 1) * 0.45,
      );
      const saturationPenalty = Math.max(0, 0.9 - p.saturate) * 0.25;

      const clarity = clamp(
        1 -
          glarePenalty -
          blurPenalty -
          brightnessPenalty -
          saturationPenalty +
          contrastBonus,
        0,
        1,
      );
      return Math.round(clarity * 100);
    };

    const getSceneLabel = (id) =>
      (scenes.find((s) => s.id === id) || scenes[0]).label;

    const updateHintDisplay = () => {
      const settings = getSceneSettings(scene);
      const hintState = ensureSceneHints(scene);
      const revealed = new Set(hintState.revealed || []);
      const chars = Array.from({ length: settings.codeLength }, (_, idx) =>
        revealed.has(idx) ? code[idx] : "_",
      );

      if (hintEl) {
        hintEl.textContent = revealed.size ? chars.join(" ") : "";
      }

      if (hintBtn) {
        const used = hintState.used || 0;
        hintBtn.disabled = used >= 2;
        hintBtn.textContent = `Pista (${used}/2)`;
      }
    };

    const updateStats = (score) => {
      scoreEls.forEach((el) => (el.textContent = String(score)));
      const settings = getSceneSettings(scene);
      minEls.forEach((el) => (el.textContent = String(settings.minScore)));
      if (meter) meter.style.width = `${score}%`;
    };

    const updateSceneLabels = () => {
      sceneLabelEls.forEach((el) => (el.textContent = getSceneLabel(scene)));
      sceneButtons.forEach((btn) => {
        const id = btn.dataset.lensScene;
        btn.classList.toggle("active", id === scene);
        btn.setAttribute("aria-pressed", id === scene ? "true" : "false");
        const i = getSceneIndex(id);
        if (i > unlocked) btn.disabled = true;
      });
    };

    const render = () => {
      const p = computeParams();
      lastScore = computeScore(p);
      updateStats(lastScore);
      updateHintDisplay();
      updateSceneLabels();
      draw(p, lastScore / 100);
      root.dataset.lensScore = String(lastScore);

      if (attemptsEl)
        attemptsEl.textContent = String(stats[scene]?.attempts || 0);
      if (bestEl) bestEl.textContent = String(stats[scene]?.best || 0);
      if (input) input.disabled = false;
      if (check) check.disabled = false;
    };

    if (typeof window.render_game_to_text !== "function") {
      window.render_game_to_text = () =>
        JSON.stringify({
          mode: "lens_lab",
          scene,
          clarity: lastScore,
          minScore: getSceneSettings(scene).minScore,
          codeLength: getSceneSettings(scene).codeLength,
          features: Array.from(features),
          hintsUsed: ensureSceneHints(scene).used || 0,
          note: "Claridad 0-100, mayor es mejor.",
        });
    }

    const resetFeatures = () => {
      features = new Set();
      featureButtons.forEach((btn) => {
        btn.classList.remove("active");
        btn.setAttribute("aria-pressed", "false");
      });
    };

    const setScene = (nextScene) => {
      const nextIdx = getSceneIndex(nextScene);
      if (nextIdx < 0) return;
      if (nextIdx > unlocked) {
        if (feedback) {
          feedback.textContent =
            "Completa el nivel anterior para desbloquear este escenario.";
        }
        return;
      }
      scene = nextScene;
      if (feedback) feedback.textContent = "";
      if (input) input.value = "";
      resetFeatures();
      const settings = getSceneSettings(scene);
      code = makeCode(settings.codeLength);
      if (input) input.maxLength = settings.codeLength;
      const hintState = ensureSceneHints(scene);
      hintState.used = 0;
      hintState.revealed = [];
      hints[scene] = hintState;
      saveHints();
      render();
    };

    const toggleFeature = (key) => {
      if (features.has(key)) features.delete(key);
      else features.add(key);
      featureButtons.forEach((btn) => {
        if (btn.dataset.lensFeature !== key) return;
        const isOn = features.has(key);
        btn.classList.toggle("active", isOn);
        btn.setAttribute("aria-pressed", isOn ? "true" : "false");
      });
      if (feedback) feedback.textContent = "";
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
      const settings = getSceneSettings(scene);
      const hintState = ensureSceneHints(scene);
      const revealed = new Set(hintState.revealed || []);
      if (revealed.size >= settings.codeLength) return;

      const idx = Math.floor(Math.random() * settings.codeLength);
      if (!revealed.has(idx)) revealed.add(idx);
      hintState.revealed = Array.from(revealed);
      hintState.used = Math.min(2, (hintState.used || 0) + 1);
      hints[scene] = hintState;
      saveHints();
      updateHintDisplay();
    };

    const onWin = () => {
      const idx = getSceneIndex(scene);
      const hasNext = idx >= 0 && idx < scenes.length - 1;

      if (hasNext) {
        unlocked = Math.max(unlocked, idx + 1);
        writeStorage(sessionStore, STORE_KEY, String(unlocked));
      }

      if (feedback) {
        feedback.textContent = hasNext
          ? `🎉 Correcto. Has desbloqueado: ${scenes[idx + 1].label}.`
          : "🏆 Laboratorio completado. Si quieres, lo personalizamos contigo en consulta.";
      }

      const particles = [];
      const colors = ["#28c07b", "#f2cf70", "#ff7a59", "#9aa7ff", "#00d4aa"];
      for (let i = 0; i < 50; i++) {
        particles.push({
          x: canvas.width / 2,
          y: canvas.height / 2,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12 - 5,
          r: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1,
          decay: 0.02 + Math.random() * 0.02,
        });
      }

      const animateParticles = () => {
        let active = false;
        particles.forEach((p) => {
          if (p.alpha <= 0) return;
          active = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.3;
          p.alpha -= p.decay;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
        if (active) requestAnimationFrame(animateParticles);
      };
      requestAnimationFrame(animateParticles);

      root.classList.add("lens-lab-won");
      window.setTimeout(() => root.classList.remove("lens-lab-won"), 1200);

      if (hasNext) {
        window.setTimeout(() => setScene(scenes[idx + 1].id), 1500);
      }
    };

    const validate = () => {
      const settings = getSceneSettings(scene);
      const value = normalizeAnswer(input?.value, settings.codeLength);
      if (input && input.value !== value) input.value = value;

      if (lastScore < settings.minScore) {
        if (feedback) {
          feedback.textContent = `Necesitas al menos ${settings.minScore}% de claridad para validar.`;
        }
        return;
      }

      if (!value || value.length < settings.codeLength) {
        if (feedback)
          feedback.textContent = `Escribe el código (${settings.codeLength} caracteres).`;
        return;
      }

      recordAttempt();

      if (value === code) {
        onWin();
        return;
      }

      if (feedback) {
        feedback.textContent =
          lastScore < 58
            ? "Aún se ve con mucha molestia. Prueba otro tratamiento."
            : "Casi. Revisa bien los caracteres.";
      }
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

    if (newBtn) {
      newBtn.addEventListener("click", () => {
        unlocked = 0;
        writeStorage(sessionStore, STORE_KEY, "0");
        scene = scenes[0].id;
        code = makeCode(getSceneSettings(scene).codeLength);
        if (feedback) feedback.textContent = "";
        if (input) input.value = "";
        resetFeatures();
        const hintState = ensureSceneHints(scene);
        hintState.used = 0;
        hintState.revealed = [];
        hints[scene] = hintState;
        saveHints();
        render();
      });
    }

    if (hintBtn) {
      hintBtn.addEventListener("click", () => {
        revealHint();
      });
    }

    if (check) check.addEventListener("click", validate);
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        validate();
      }
    });
    input?.addEventListener("input", () => {
      const settings = getSceneSettings(scene);
      const v = normalizeAnswer(input.value, settings.codeLength);
      if (input.value !== v) input.value = v;
    });

    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => render());
      ro.observe(canvas);
    } else {
      window.addEventListener("resize", () => render(), { passive: true });
    }

    unlocked = clamp(Number(readStorage(sessionStore, STORE_KEY) || 0), 0, 2);
    scene = scenes[Math.min(unlocked, scenes.length - 1)].id;
    if (input) input.maxLength = getSceneSettings(scene).codeLength;
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
