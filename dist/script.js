(() => {
  const current = document.currentScript?.src;
  const scriptUrl = current
    ? new URL(current)
    : new URL("script.js", window.location.href);
  const baseUrl = new URL(".", scriptUrl);
  const assetVersion = scriptUrl.search;
  const loaded = new Set();
  let initialized = false;

  const resolveUrl = (src) => {
    const url = new URL(src, baseUrl);
    if (assetVersion && !url.search) url.search = assetVersion;
    return url.toString();
  };

  const loadScript = (src) => {
    const url = resolveUrl(src);
    if (loaded.has(url)) return Promise.resolve();
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      loaded.add(url);
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.dataset.loader = "true";
      script.onload = () => {
        loaded.add(url);
        resolve();
      };
      script.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
      document.head.appendChild(script);
    });
  };

  const has = (selector) => document.querySelector(selector);

  const loadModules = async () => {
    if (initialized) return;
    initialized = true;

    try {
      await loadScript("script-base.js");
    } catch (error) {
      console.error("No se pudo cargar script-base.js.", error);
      return;
    }

    const modules = [];
    if (has("[data-scrolly], [data-tabs], [data-rail]")) {
      modules.push("script-ui.js");
    }
    if (
      has(
        "[data-myopia-sim], [data-myopia-predictor], [data-miopia-simulator], [data-miopia-predictor]",
      )
    ) {
      modules.push("script-miopia.js");
    }
    if (has("[data-eye-explorer]")) {
      modules.push("script-eye-explorer-shared.js");
    }
    if (has("[data-eye-explorer], [data-lens-lab]")) {
      modules.push("script-servicios.js");
    }
    if (has("[data-appointment-wizard]")) {
      modules.push("script-cita.js");
    }
    if (
      has(
        "[data-blog-search], #blog-search, .blog-card, .post-content, [data-reading-progress], article.post-card",
      )
    ) {
      modules.push("script-blog.js");
    }
    if (has("#desafio-enfoque")) {
      modules.push("script-tech.js");
    }
    if (has("[data-catalog]")) {
      modules.push("script-catalogo.js");
    }

    const results = await Promise.allSettled(
      modules.map((src) => loadScript(src)),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn(`No se pudo cargar ${modules[index]}.`, result.reason);
      }
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        void loadModules();
      },
      { once: true },
    );
  } else {
    void loadModules();
  }
})();
