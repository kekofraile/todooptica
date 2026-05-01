(() => {
  const EYE_EXPLORER_PARTS = [
    {
      id: "cornea",
      name: "Córnea",
      title: "Superficie transparente que inicia el enfoque",
      desc: "Es la primera interfaz óptica del ojo. Su curvatura y transparencia desvían la luz hacia el interior antes de atravesar la pupila.",
      fact: "Aporta la mayor parte de la potencia refractiva del ojo y se mantiene avascular para conservar su transparencia.",
      color: "#5fb8d3",
    },
    {
      id: "iris",
      name: "Iris",
      title: "Diafragma pigmentado que modula la entrada de luz",
      desc: "Regula cuánta luz penetra en el globo ocular. Su tono depende de la melanina y de cómo la luz se dispersa en el estroma.",
      fact: "Su musculatura cambia el tamaño pupilar en segundos para proteger la retina y mejorar la calidad visual.",
      color: "#9f6c45",
    },
    {
      id: "pupil",
      name: "Pupila",
      title: "Apertura central del sistema óptico",
      desc: "No es un tejido, sino el orificio por el que la luz avanza desde la cámara anterior hacia el cristalino.",
      fact: "Su diámetro cambia según la iluminación, el esfuerzo visual y la respuesta autonómica.",
      color: "#1a1d23",
    },
    {
      id: "lens",
      name: "Cristalino",
      title: "Lente flexible para el ajuste fino del foco",
      desc: "Trabaja con la córnea para llevar el foco a la retina. Modifica su forma para afinar la visión de lejos y de cerca.",
      fact: "Con la edad pierde elasticidad y aparece la presbicia, aunque siga siendo transparente.",
      color: "#d7c07d",
    },
    {
      id: "retina",
      name: "Retina",
      title: "Tejido neurosensorial que transforma luz en señal",
      desc: "Recubre la pared posterior del ojo y convierte la energía luminosa en impulsos eléctricos que el cerebro interpreta.",
      fact: "Conos, bastones y neuronas retinianas forman un circuito complejo antes de que la señal salga por el nervio óptico.",
      color: "#c56d5d",
    },
    {
      id: "optic",
      name: "Nervio óptico",
      title: "Vía de salida visual hacia el cerebro",
      desc: "Recoge la información procesada por la retina y la conduce desde el disco óptico a las vías visuales centrales.",
      fact: "En el disco óptico no hay fotorreceptores; por eso corresponde al punto ciego fisiológico.",
      color: "#c1a062",
    },
    {
      id: "sclera",
      name: "Esclerótica",
      title: "Cubierta fibrosa que da forma y protección",
      desc: "Es la envoltura externa resistente del globo ocular. Sirve de soporte al contenido interno y se continúa con la córnea.",
      fact: "Su aspecto blanquecino procede del colágeno denso que forma la capa más externa del ojo.",
      color: "#ece8df",
    },
    {
      id: "vitreous",
      name: "Humor vítreo",
      title: "Gel transparente que rellena la cavidad posterior",
      desc: "Ocupa la mayor parte del volumen ocular y ayuda a mantener la retina aplicada mientras transmite la luz hacia el polo posterior.",
      fact: "Con la edad puede licuarse parcialmente y generar condensaciones percibidas como moscas volantes.",
      color: "#b8d9e3",
    },
  ];

  const EYE_EXPLORER_ANCHOR_MAP = {
    cornea: { x: 0.136, y: 0.507, rx: 0.042, ry: 0.124, depthShift: 1.28 },
    iris: { x: 0.225, y: 0.412, rx: 0.034, ry: 0.068, depthShift: 1.04 },
    pupil: { x: 0.251, y: 0.518, rx: 0.024, ry: 0.058, depthShift: 1.12 },
    lens: { x: 0.315, y: 0.518, rx: 0.042, ry: 0.122, depthShift: 0.72 },
    retina: { x: 0.683, y: 0.476, rx: 0.07, ry: 0.118, depthShift: -0.08 },
    optic: { x: 0.852, y: 0.569, rx: 0.044, ry: 0.066, depthShift: -0.32 },
    sclera: { x: 0.546, y: 0.142, rx: 0.122, ry: 0.068, depthShift: 0.08 },
    vitreous: { x: 0.499, y: 0.518, rx: 0.172, ry: 0.202, depthShift: 0.12 },
  };

  const EYE_EXPLORER_STRINGS = {
    quizOff: "Desafío rápido",
    quizOn: "Salir del desafío",
    quizPromptPrefix: "Encuentra:",
    progress(visited, total) {
      return `${visited}/${total}`;
    },
    angle(value) {
      return `${Math.round(value)}°`;
    },
  };

  const EYE_EXPLORER_DEFAULT_PART_ID = EYE_EXPLORER_PARTS[0].id;
  const EYE_EXPLORER_MAX_ANGLE = 28;

  const createEyeExplorerController = (root) => {
    const resolvedRoot = root || document.querySelector("[data-eye-explorer]");
    if (!resolvedRoot) return null;

    const canvas = resolvedRoot.querySelector("[data-eye-canvas]");
    const hotspotsWrap = resolvedRoot.querySelector("[data-eye-hotspots]");
    if (!canvas || !hotspotsWrap) return null;

    const angleEl = resolvedRoot.querySelector("[data-eye-angle]");
    const partNameEl = resolvedRoot.querySelector("[data-eye-part-name]");
    const partTitleEl = resolvedRoot.querySelector("[data-eye-part-title]");
    const partDescEl = resolvedRoot.querySelector("[data-eye-part-desc]");
    const partFactEl = resolvedRoot.querySelector("[data-eye-fact]");
    const progressEl = resolvedRoot.querySelector("[data-eye-progress]");
    const quizToggle = resolvedRoot.querySelector("[data-eye-quiz-toggle]");
    const quizBox = resolvedRoot.querySelector("[data-eye-quiz]");
    const quizPrompt = resolvedRoot.querySelector("[data-eye-quiz-prompt]");
    const quizScoreEl = resolvedRoot.querySelector("[data-eye-quiz-score]");
    const quizBestEl = resolvedRoot.querySelector("[data-eye-quiz-best]");
    const rotateButtons = Array.from(
      resolvedRoot.querySelectorAll("[data-eye-rotate]"),
    );
    const animateBtn = resolvedRoot.querySelector("[data-eye-animate]");
    const partButtons = Array.from(
      resolvedRoot.querySelectorAll(".eye-part-btn[data-eye-part]"),
    );

    const parts = EYE_EXPLORER_PARTS.map((part) => ({ ...part }));
    const partMap = new Map(parts.map((part) => [part.id, part]));
    const hotspots = new Map();

    let activePart = partMap.get(EYE_EXPLORER_DEFAULT_PART_ID) || parts[0];
    let visited = new Set(activePart ? [activePart.id] : []);
    let quizActive = false;
    let quizScore = 0;
    let quizBest = 0;
    let quizTarget = null;

    partButtons.forEach((button) => {
      const part = partMap.get(button.dataset.eyePart || "");
      const dot = button.querySelector(".eye-part-btn__dot");
      if (part && dot) {
        dot.style.setProperty("--part-color", part.color);
      }
    });

    const updateInfo = (part = activePart) => {
      if (!part) return;
      if (partNameEl) partNameEl.textContent = part.name;
      if (partTitleEl) partTitleEl.textContent = part.title;
      if (partDescEl) partDescEl.textContent = part.desc;
      if (partFactEl) partFactEl.textContent = part.fact;
    };

    const updateProgress = () => {
      if (progressEl) {
        progressEl.textContent = EYE_EXPLORER_STRINGS.progress(
          visited.size,
          parts.length,
        );
      }
    };

    const syncPartButtons = () => {
      partButtons.forEach((button) => {
        const isActive = button.dataset.eyePart === activePart?.id;
        button.classList.toggle("active", isActive);
        button.classList.toggle(
          "is-visited",
          visited.has(button.dataset.eyePart),
        );
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    };

    const syncHotspots = () => {
      hotspots.forEach((button, partId) => {
        button.classList.toggle("active", partId === activePart?.id);
        button.classList.toggle("is-visited", visited.has(partId));
      });
    };

    const pickQuizTarget = () => {
      const options = parts.filter((part) => part.id !== activePart?.id);
      quizTarget = options.length
        ? options[Math.floor(Math.random() * options.length)]
        : null;
      return quizTarget;
    };

    const updateQuizUI = () => {
      resolvedRoot.classList.toggle("is-quiz-open", quizActive);
      if (quizToggle) {
        quizToggle.textContent = quizActive
          ? EYE_EXPLORER_STRINGS.quizOn
          : EYE_EXPLORER_STRINGS.quizOff;
      }
      if (quizBox) quizBox.hidden = !quizActive;
      if (quizPrompt && quizActive && quizTarget) {
        quizPrompt.textContent = `${EYE_EXPLORER_STRINGS.quizPromptPrefix} ${quizTarget.name}`;
      }
      if (quizScoreEl) quizScoreEl.textContent = String(quizScore);
      if (quizBestEl) quizBestEl.textContent = String(quizBest);
    };

    const setQuizActive = (value) => {
      quizActive = Boolean(value);
      if (quizActive) pickQuizTarget();
      updateQuizUI();
      return quizActive;
    };

    const handleQuizHit = (part) => {
      if (!quizActive || !quizTarget || !part) return false;
      if (part.id !== quizTarget.id) return false;
      quizScore += 1;
      if (quizScore > quizBest) quizBest = quizScore;
      pickQuizTarget();
      updateQuizUI();
      return true;
    };

    const setActivePart = (id) => {
      const next = partMap.get(id);
      if (!next) return null;
      activePart = next;
      visited.add(next.id);
      updateInfo(next);
      updateProgress();
      syncPartButtons();
      syncHotspots();
      handleQuizHit(next);
      return next;
    };

    const ensureHotspots = (onSelect) => {
      hotspotsWrap.innerHTML = "";
      hotspots.clear();

      parts.forEach((part) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "eye-explorer__hotspot";
        button.dataset.eyePart = part.id;
        button.style.setProperty("--hotspot-color", part.color);
        button.setAttribute("aria-label", `Seleccionar ${part.name}`);
        button.addEventListener("click", () => {
          const selected = setActivePart(part.id);
          if (selected && typeof onSelect === "function") onSelect(selected);
        });
        hotspotsWrap.appendChild(button);
        hotspots.set(part.id, button);
      });

      syncHotspots();
      return hotspots;
    };

    const setAngleLabel = (value) => {
      if (angleEl) angleEl.textContent = EYE_EXPLORER_STRINGS.angle(value);
    };

    updateInfo(activePart);
    updateProgress();
    syncPartButtons();
    updateQuizUI();

    return {
      root: resolvedRoot,
      canvas,
      hotspotsWrap,
      hotspots,
      rotateButtons,
      animateBtn,
      quizToggle,
      partButtons,
      partMap,
      parts,
      ensureHotspots,
      setActivePart,
      setAngleLabel,
      setQuizActive,
      toggleQuiz: () => setQuizActive(!quizActive),
      getActivePart: () => activePart,
      getVisited: () => visited,
      getQuizTarget: () => quizTarget,
      isQuizActive: () => quizActive,
      syncPartButtons,
      syncHotspots,
      updateInfo,
      updateProgress,
      updateQuizUI,
    };
  };

  window.TodoOpticaEyeExplorer = Object.freeze({
    PARTS: EYE_EXPLORER_PARTS,
    ANCHORS: EYE_EXPLORER_ANCHOR_MAP,
    STRINGS: EYE_EXPLORER_STRINGS,
    DEFAULT_PART_ID: EYE_EXPLORER_DEFAULT_PART_ID,
    MAX_ANGLE: EYE_EXPLORER_MAX_ANGLE,
    createEyeExplorerController,
  });
})();
