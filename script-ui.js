const prefersReducedMotion =
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Scrollytelling sections: sticky media + steps that update on scroll.
const setupScrolly = () => {
  const wraps = document.querySelectorAll("[data-scrolly]");
  if (!wraps.length || !("IntersectionObserver" in window)) return;

  wraps.forEach((wrap) => {
    const img =
      wrap.querySelector("[data-scrolly-current]") ||
      wrap.querySelector(".scrolly-frame img");
    const nextImg = wrap.querySelector("[data-scrolly-next]");
    const caption = wrap.querySelector("[data-scrolly-caption]");
    const steps = Array.from(wrap.querySelectorAll("[data-scrolly-step]"));
    if (!img || steps.length === 0) return;
    const isImmersive = wrap.dataset.scrollyMode === "immersive";

    const preload = new Set();
    steps.forEach((step) => {
      const src = step.getAttribute("data-image");
      if (!src || preload.has(src)) return;
      const tmp = new Image();
      tmp.decoding = "async";
      tmp.src = src;
      preload.add(src);
    });

    let activeIndex = -1;
    let swapTimer;

    const setActive = (nextIndex) => {
      if (nextIndex === activeIndex) return;
      activeIndex = nextIndex;

      steps.forEach((step, idx) => {
        step.classList.toggle("active", idx === activeIndex);
      });

      const step = steps[activeIndex];
      const nextSrc = step.getAttribute("data-image");
      const nextCaption = step.getAttribute("data-caption") || "";
      const progress = steps.length > 1 ? activeIndex / (steps.length - 1) : 1;
      wrap.style.setProperty("--scrolly-progress", progress.toFixed(4));
      wrap.style.setProperty("--scrolly-active-index", activeIndex);
      if (caption) caption.textContent = nextCaption;

      if (nextSrc && img.getAttribute("src") !== nextSrc) {
        if (prefersReducedMotion) {
          img.src = nextSrc;
          if (nextImg) nextImg.src = nextSrc;
          return;
        }
        wrap.classList.add("is-swapping");
        window.clearTimeout(swapTimer);

        if (nextImg) {
          nextImg.src = nextSrc;
        } else {
          window.setTimeout(() => {
            img.src = nextSrc;
          }, 90);
        }

        swapTimer = window.setTimeout(
          () => {
            img.src = nextSrc;
            if (nextImg) nextImg.src = nextSrc;
            wrap.classList.remove("is-swapping");
          },
          nextImg ? 360 : 240,
        );
      } else {
        window.clearTimeout(swapTimer);
        wrap.classList.remove("is-swapping");
      }
    };

    setActive(0);

    const isCompact = window.matchMedia("(max-width: 720px)").matches;
    const rootMargin = isImmersive
      ? "-38% 0px -46% 0px"
      : isCompact
        ? "-25% 0px -65% 0px"
        : "-40% 0px -55% 0px";
    const thresholds = isCompact
      ? [0, 0.2, 0.4, 0.6, 0.8, 1]
      : [0, 0.25, 0.5, 0.75, 1];

    const io = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best) return;
        const idx = steps.indexOf(best.target);
        if (idx >= 0) setActive(idx);
      },
      {
        rootMargin,
        threshold: thresholds,
      },
    );

    steps.forEach((step) => io.observe(step));

    if (isCompact) {
      steps.forEach((step, idx) => {
        step.addEventListener("click", () => setActive(idx));
      });
    }
  });
};

// Horizontal rails: allow drag-to-scroll + wheel.
const setupRails = () => {
  const rails = document.querySelectorAll("[data-rail]");
  if (!rails.length) return;

  rails.forEach((wrap) => {
    const rail = wrap.querySelector(".rail");
    if (!rail) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onDown = (event) => {
      isDown = true;
      rail.classList.add("is-dragging");
      startX = event.pageX - rail.offsetLeft;
      scrollLeft = rail.scrollLeft;
    };

    const onUp = () => {
      isDown = false;
      rail.classList.remove("is-dragging");
    };

    const onMove = (event) => {
      if (!isDown) return;
      event.preventDefault();
      const x = event.pageX - rail.offsetLeft;
      const walk = (x - startX) * 1.5;
      rail.scrollLeft = scrollLeft - walk;
    };

    rail.addEventListener("mousedown", onDown);
    rail.addEventListener("mouseleave", onUp);
    rail.addEventListener("mouseup", onUp);
    rail.addEventListener("mousemove", onMove);

    rail.addEventListener(
      "wheel",
      (event) => {
        rail.scrollLeft += event.deltaY;
      },
      { passive: true },
    );
  });
};

// Tabs with keyboard navigation.
const setupTabs = () => {
  const roots = document.querySelectorAll("[data-tabs]");
  if (!roots.length) return;

  roots.forEach((root) => {
    const buttons = Array.from(root.querySelectorAll("[data-tab]"));
    const panels = Array.from(root.querySelectorAll("[data-tab-panel]"));
    if (!buttons.length || !panels.length) return;

    const getPanel = (id) =>
      panels.find((panel) => panel.dataset.tabPanel === id);

    const activate = (id, { focus = false } = {}) => {
      buttons.forEach((btn) => {
        const isActive = btn.dataset.tab === id;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
        btn.tabIndex = isActive ? 0 : -1;
        if (isActive && focus) btn.focus({ preventScroll: true });
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.tabPanel === id;
        panel.hidden = !isActive;
      });
    };

    buttons.forEach((btn) => {
      btn.setAttribute("role", "tab");
      btn.addEventListener("click", () =>
        activate(btn.dataset.tab, { focus: true }),
      );
    });

    const list = root.querySelector("[data-tab-list]");
    if (list) {
      list.setAttribute("role", "tablist");
      list.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const current = buttons.findIndex((b) =>
          b.classList.contains("active"),
        );
        const dir = event.key === "ArrowRight" ? 1 : -1;
        const next = (current + dir + buttons.length) % buttons.length;
        activate(buttons[next].dataset.tab, { focus: true });
      });
    }

    panels.forEach((panel) => {
      panel.setAttribute("role", "tabpanel");
      panel.hidden = true;
      const id = panel.dataset.tabPanel;
      const btn = buttons.find((b) => b.dataset.tab === id);
      if (btn) {
        const tabId = btn.id || `${id}-tab-${Math.random().toString(16).slice(2)}`;
        btn.id = tabId;
        panel.setAttribute("aria-labelledby", tabId);
      }
    });

    const initial = buttons[0].dataset.tab;
    activate(initial);
    const initialPanel = getPanel(initial);
    if (initialPanel) initialPanel.hidden = false;
  });
};

setupScrolly();
setupRails();
setupTabs();
