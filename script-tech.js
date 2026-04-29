/* --- FOCUS HUNTER GAME LOGIC --- */
const setupFocusGame = () => {
  const root = document.querySelector("#desafio-enfoque");
  if (!root) return;

  const target = root.querySelector("[data-game-target]");
  const triggerBtn = root.querySelector("[data-game-trigger]");
  const feedbackEl = root.querySelector("[data-game-feedback]");
  const feedbackIconEl = feedbackEl?.querySelector(".feedback-icon");
  const feedbackTextEl = feedbackEl?.querySelector(".feedback-text");
  const streakEl = root.querySelector("[data-game-streak]");
  const bestEl = root.querySelector("[data-game-best]");
  const difficultySelect = root.querySelector("[data-game-difficulty]");
  const modeSelect = root.querySelector("[data-game-mode]");
  const timerEl = root.querySelector("[data-game-timer]");
  const perfectEl = root.querySelector("[data-game-perfect]");
  const accuracyEl = root.querySelector("[data-game-accuracy]");
  const muteBtn = root.querySelector("[data-game-mute]");
  const summaryEl = root.querySelector("[data-game-summary]");
  const viewport = root.querySelector(".game-viewport");
  const triggerLabelEl = triggerBtn?.querySelector("[data-game-trigger-label]");

  let isPlaying = false;
  let animationId = null;
  let feedbackTimeoutId = null;
  let blurValue = 0;
  let time = 0;
  let speed = 0.03;
  let baseSpeed = 0.03;
  let timeLeft = null;
  let timerId = null;
  let inView = false;
  let paused = false;
  let modeState = "idle";
  let difficulty = "standard";
  let mode = "practice";
  let isMuted = false;
  let perfects = 0;
  let attempts = 0;
  let successes = 0;
  let streak = 0;
  let best = 0;
  let level = 1;

  const levelNames = [
    "Principiante",
    "Observador",
    "Explorador",
    "Rastreador",
    "Ojo de Halcón",
    "Maestro Óptico",
    "Leyenda Visual",
  ];

  const SETTINGS_KEY = "todooptica_focusgame_settings";
  const difficultyConfig = {
    calm: {
      baseSpeed: 0.02,
      successBoost: 0.002,
      perfectBoost: 0.004,
      maxSpeed: 0.07,
      amplitudeBase: 5.4,
      amplitudeStep: 0.5,
      perfectBase: 0.75,
      goodBase: 2.5,
      perfectStep: 0.04,
      goodStep: 0.08,
    },
    standard: {
      baseSpeed: 0.03,
      successBoost: 0.003,
      perfectBoost: 0.006,
      maxSpeed: 0.09,
      amplitudeBase: 6,
      amplitudeStep: 0.7,
      perfectBase: 0.65,
      goodBase: 2.1,
      perfectStep: 0.05,
      goodStep: 0.1,
    },
    pro: {
      baseSpeed: 0.04,
      successBoost: 0.004,
      perfectBoost: 0.008,
      maxSpeed: 0.12,
      amplitudeBase: 6.6,
      amplitudeStep: 0.9,
      perfectBase: 0.55,
      goodBase: 1.8,
      perfectStep: 0.05,
      goodStep: 0.12,
    },
  };

  const getDifficultyConfig = () =>
    difficultyConfig[difficulty] || difficultyConfig.standard;

  const setMessage = (text, type = "info") => {
    if (!summaryEl) return;
    summaryEl.hidden = false;
    summaryEl.textContent = text;
    summaryEl.dataset.state = type;
  };

  const hideFeedback = () => {
    if (!feedbackEl) return;
    if (feedbackTimeoutId) {
      window.clearTimeout(feedbackTimeoutId);
      feedbackTimeoutId = null;
    }
    feedbackEl.hidden = true;
    feedbackEl.dataset.state = "";
    if (feedbackIconEl) {
      feedbackIconEl.textContent = "📸";
      feedbackIconEl.classList.remove("feedback-icon--perfect");
    }
    if (feedbackTextEl) feedbackTextEl.textContent = "";
  };

  const showFeedback = (
    text,
    { type = "info", icon = "📸", perfect = false, duration = 680 } = {},
  ) => {
    if (!feedbackEl || !feedbackIconEl || !feedbackTextEl) return;
    if (feedbackTimeoutId) window.clearTimeout(feedbackTimeoutId);
    feedbackEl.hidden = false;
    feedbackEl.dataset.state = type;
    feedbackIconEl.textContent = icon;
    feedbackIconEl.classList.toggle("feedback-icon--perfect", perfect);
    feedbackTextEl.textContent = text;
    feedbackTimeoutId = window.setTimeout(() => {
      hideFeedback();
    }, duration);
  };

  const setStats = () => {
    if (streakEl) streakEl.textContent = String(streak);
    if (bestEl) bestEl.textContent = String(best);
    if (perfectEl) perfectEl.textContent = String(perfects);
    if (accuracyEl) {
      const ratio = attempts ? Math.round((successes / attempts) * 100) : 0;
      accuracyEl.textContent = `${ratio}%`;
    }
    if (summaryEl) {
      summaryEl.textContent = `Nivel ${level} · ${levelNames[Math.min(level - 1, levelNames.length - 1)]}`;
    }
  };

  const setTimer = () => {
    if (!timerEl) return;
    if (timeLeft === null) {
      timerEl.textContent = "∞";
      return;
    }
    timerEl.textContent = `${timeLeft}s`;
  };

  const getTimedDuration = () => {
    const override = Number(window.__focusGameTestDuration);
    if (Number.isFinite(override) && override > 0) {
      return Math.round(override);
    }
    return 30;
  };

  const getAmplitude = () => {
    const cfg = getDifficultyConfig();
    return cfg.amplitudeBase + (level - 1) * cfg.amplitudeStep;
  };

  const calcBlur = () => {
    const amp = getAmplitude();
    return Math.abs(Math.sin(time) * amp);
  };

  const updateBlur = () => {
    blurValue = calcBlur();
    if (target) {
      target.style.filter = `blur(${blurValue.toFixed(2)}px)`;
    }
  };

  const updateSpeed = (delta) => {
    const cfg = getDifficultyConfig();
    speed = Math.min(cfg.maxSpeed, Math.max(cfg.baseSpeed, speed + delta));
  };

  const resetState = () => {
    streak = 0;
    perfects = 0;
    attempts = 0;
    successes = 0;
    level = 1;
    const cfg = getDifficultyConfig();
    baseSpeed = cfg.baseSpeed;
    speed = baseSpeed;
    time = 0;
    timeLeft = mode === "timed" ? getTimedDuration() : null;
    blurValue = 0;
    updateBlur();
    setStats();
    setTimer();
  };

  const saveSettings = () => {
    const payload = {
      difficulty,
      mode,
      muted: isMuted,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload));
  };

  const loadSettings = () => {
    try {
      const payload = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (payload?.difficulty) difficulty = payload.difficulty;
      if (payload?.mode) mode = payload.mode;
      if (payload?.muted !== undefined) isMuted = payload.muted;
    } catch {
      // ignore
    }
  };

  const updateControls = () => {
    if (difficultySelect) difficultySelect.value = difficulty;
    if (modeSelect) modeSelect.value = mode;
    if (muteBtn)
      muteBtn.textContent = isMuted ? "Activar sonido" : "Silenciar sonido";
    if (triggerBtn) triggerBtn.dataset.state = isPlaying ? "capture" : "idle";
    if (triggerLabelEl) {
      triggerLabelEl.textContent = isPlaying
        ? "Capturar ahora"
        : "Empezar desafío";
    }
  };

  const tick = () => {
    if (!isPlaying || paused || !inView) return;
    time += speed;
    updateBlur();
    animationId = requestAnimationFrame(tick);
  };

  const stopTimer = () => {
    if (!timerId) return;
    window.clearInterval(timerId);
    timerId = null;
  };

  const startTimer = () => {
    if (mode !== "timed") return;
    timeLeft = getTimedDuration();
    setTimer();
    stopTimer();
    timerId = window.setInterval(() => {
      if (paused || !isPlaying) return;
      timeLeft -= 1;
      setTimer();
      if (timeLeft <= 0) {
        endGame();
      }
    }, 1000);
  };

  const startGame = () => {
    if (isPlaying) return;
    isPlaying = true;
    modeState = "playing";
    resetState();
    hideFeedback();
    updateControls();
    setMessage("Pulsa el botón o la imagen cuando la visión esté nítida.", "info");
    startTimer();
    tick();
  };

  const endGame = () => {
    isPlaying = false;
    modeState = "idle";
    stopTimer();
    cancelAnimationFrame(animationId);
    animationId = null;
    hideFeedback();
    updateControls();
    setMessage("¡Buen trabajo! Puedes volver a intentarlo.", "success");
  };

  const handleSuccess = (perfect) => {
    attempts += 1;
    successes += 1;
    streak += 1;
    if (streak > best) best = streak;
    if (perfect) perfects += 1;
    const cfg = getDifficultyConfig();
    updateSpeed(perfect ? cfg.perfectBoost : cfg.successBoost);
    level = Math.min(level + 1, levelNames.length);
    setStats();
    setMessage(
      perfect ? "¡Perfecto! 🎯" : "¡Muy bien! Sigue así.",
      perfect ? "success" : "good",
    );
    showFeedback(perfect ? "¡Perfecto!" : "Buen enfoque", {
      type: perfect ? "success" : "good",
      icon: perfect ? "🎯" : "✓",
      perfect,
    });
  };

  const handleFail = () => {
    attempts += 1;
    streak = 0;
    const cfg = getDifficultyConfig();
    updateSpeed(-cfg.successBoost);
    setStats();
    setMessage("Casi. Ajusta tu enfoque y prueba de nuevo.", "error");
    showFeedback("Sigue intentando", {
      type: "error",
      icon: "✕",
      duration: 520,
    });
  };

  const handleShot = () => {
    if (!isPlaying) return;
    if (paused) return;
    const cfg = getDifficultyConfig();
    const perfect = blurValue <= cfg.perfectBase - level * cfg.perfectStep;
    const good = blurValue <= cfg.goodBase - level * cfg.goodStep;
    if (perfect || good) handleSuccess(perfect);
    else handleFail();
  };

  const onVisibility = (entries) => {
    entries.forEach((entry) => {
      inView = entry.isIntersecting;
    });
  };

  window.__focusGame = {
    start: startGame,
    capture: handleShot,
    getBlur: () => blurValue,
    setBlur: (value) => {
      blurValue = Math.max(0, Number(value) || 0);
      if (target) {
        target.style.filter = `blur(${blurValue.toFixed(2)}px)`;
      }
    },
  };

  if (triggerBtn) {
    triggerBtn.addEventListener("click", () => {
      if (isPlaying) {
        handleShot();
        return;
      }
      startGame();
    });
  }
  if (target) target.addEventListener("click", handleShot);

  difficultySelect?.addEventListener("change", (event) => {
    difficulty = event.target.value;
    saveSettings();
    if (isPlaying) resetState();
  });

  modeSelect?.addEventListener("change", (event) => {
    mode = event.target.value;
    saveSettings();
    if (isPlaying) resetState();
  });

  muteBtn?.addEventListener("click", () => {
    isMuted = !isMuted;
    saveSettings();
    updateControls();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === " " && isPlaying) {
      event.preventDefault();
      handleShot();
    }
  });

  if ("IntersectionObserver" in window && viewport) {
    const io = new IntersectionObserver(onVisibility, { threshold: 0.3 });
    io.observe(viewport);
  } else {
    inView = true;
  }

  loadSettings();
  updateControls();
  setStats();
  setTimer();
  setMessage("Pulsa “Empezar desafío” y captura cuando la imagen esté nítida.", "info");
  hideFeedback();
};

setupFocusGame();
