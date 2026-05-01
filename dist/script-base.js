// Progressive enhancement hooks (used by CSS).
document.documentElement.classList.add("js");

const TodoOptica = (() => {
  const appointmentProfiles = {
    valladolid: {
      key: "valladolid",
      label: "Valladolid",
      defaultNote:
        "Horario Valladolid: Lun–Vie 10:00–19:30 (cada 30 min) · Sáb 10:15–14:00 (cada 15 min).",
      rules: {
        weekday: {
          start: "10:00",
          end: "19:30",
          intervalMinutes: 30,
          label: "Lun–Vie 10:00–19:30 (cada 30 min)",
        },
        saturday: {
          start: "10:15",
          end: "14:00",
          intervalMinutes: 15,
          label: "Sáb 10:15–14:00 (cada 15 min)",
        },
      },
      closedWeekdays: [0],
      holidaysByYear: {
        2026: [
          "2026-01-01",
          "2026-01-06",
          "2026-04-02",
          "2026-04-03",
          "2026-04-23",
          "2026-05-01",
          "2026-05-13",
          "2026-08-15",
          "2026-09-08",
          "2026-10-12",
          "2026-11-02",
          "2026-12-07",
          "2026-12-08",
          "2026-12-25",
        ],
      },
    },
    madrid: {
      key: "madrid",
      label: "Madrid",
      defaultNote:
        "Madrid: horario flexible de lunes a viernes entre 10:00 y 19:30.",
      rules: {
        weekday: {
          start: "10:00",
          end: "19:30",
          intervalMinutes: 30,
          label: "Lun–Vie 10:00–19:30 (cada 30 min)",
        },
      },
      closedWeekdays: [0, 6],
      holidaysByYear: {},
    },
  };

  const centers = {
    paseo: {
      key: "paseo",
      name: "Paseo de Zorrilla",
      label: "Paseo de Zorrilla · Valladolid",
      appointmentLabel: "Paseo de Zorrilla (Valladolid)",
      city: "Valladolid",
      phone: "+34983226200",
      phoneDisplay: "983 226 200",
      email: "paseozorrilla@todooptica.es",
      address: "Paseo de Zorrilla 62, 47006 Valladolid",
      maps:
        "https://www.google.com/maps/search/?api=1&query=Paseo%20de%20Zorrilla%2062%2C%20Valladolid",
      appointmentProfile: "valladolid",
    },
    labradores: {
      key: "labradores",
      name: "Labradores",
      label: "Labradores · Valladolid",
      appointmentLabel: "Labradores (Valladolid)",
      city: "Valladolid",
      phone: "+34983397231",
      phoneDisplay: "983 397 231",
      email: "labradores@todooptica.es",
      address: "C/ Labradores 22, 47004 Valladolid",
      maps:
        "https://www.google.com/maps/search/?api=1&query=C%2F%20Labradores%2022%2C%20Valladolid",
      appointmentProfile: "valladolid",
    },
    madrid: {
      key: "madrid",
      name: "Donostiarra",
      label: "Donostiarra · Madrid",
      appointmentLabel: "Donostiarra (Madrid)",
      city: "Madrid",
      phone: "+34914031795",
      phoneDisplay: "91 403 17 95",
      email: "madrid@todooptica.es",
      address: "Avda. Donostiarra 24, 28027 Madrid",
      maps:
        "https://www.google.com/maps/search/?api=1&query=Avda.%20Donostiarra%2024%2C%20Madrid",
      appointmentProfile: "madrid",
    },
  };

  const services = {
    progresivos: "Progresivos",
    miopia: "Miopía infantil",
    lentillas: "Lentillas",
    audiologia: "Audiología",
    salud: "Salud visual",
    revision: "Revisión visual",
  };

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const normalize = (value) => (value || "").toString().trim();
  const toDateKey = (value) => {
    if (!value) return "";
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    return normalize(value);
  };

  const buildWhatsAppMessage = ({
    center,
    service,
    date,
    time,
    name,
    note,
  } = {}) => {
    const lines = ["Hola, quiero pedir una cita en Todo Óptica."];
    if (center) lines.push(`Centro: ${center}.`);
    if (service) lines.push(`Servicio: ${service}.`);
    if (date) lines.push(`Fecha preferida: ${date}${time ? ` a las ${time}` : ""}.`);
    if (name) lines.push(`Nombre: ${name}.`);
    if (note) lines.push(`Nota: ${note}.`);
    return lines.join("\n");
  };

  const buildWhatsAppUrl = (message) => {
    const text = encodeURIComponent(normalize(message));
    return `https://wa.me/34601045111?text=${text}`;
  };

  const getAppointmentConfig = (centerKey, year = new Date().getFullYear()) => {
    const center = centers[centerKey];
    const profile = appointmentProfiles[center?.appointmentProfile || ""];
    if (!center || !profile) return null;

    const holidays = profile.holidaysByYear[String(year)] || [];
    return {
      center,
      profile,
      holidays,
      holidaySet: new Set(holidays),
    };
  };

  const isAppointmentHoliday = (centerKey, value) => {
    const dateKey = toDateKey(value);
    if (!dateKey) return false;
    const year = Number(dateKey.slice(0, 4));
    const config = getAppointmentConfig(centerKey, year);
    if (!config) return false;
    return config.holidaySet.has(dateKey);
  };

  return {
    appointmentProfiles,
    centers,
    services,
    prefersReducedMotion,
    buildWhatsAppMessage,
    buildWhatsAppUrl,
    getAppointmentConfig,
    isAppointmentHoliday,
  };
})();

window.TodoOptica = TodoOptica;

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  siteNav.querySelectorAll("a, button").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const getPathPrefix = () => {
  const sample = document.querySelector('.site-nav a[href$="index.html"]');
  if (sample && sample.getAttribute("href")?.startsWith("../")) return "../";
  return "";
};

const ensureCatalogLink = () => {
  if (!siteNav) return;
  const prefix = getPathPrefix();
  const catalogHref = `${prefix}catalogo.html`;
  const hasCatalog = Array.from(siteNav.querySelectorAll("a")).some((link) =>
    link.getAttribute("href")?.includes("catalogo.html"),
  );
  if (hasCatalog) return;

  const centersLink = Array.from(siteNav.querySelectorAll("a")).find((link) =>
    link.getAttribute("href")?.includes("centros.html"),
  );
  const newLink = document.createElement("a");
  newLink.href = catalogHref;
  newLink.textContent = "Catálogo";
  if (centersLink?.parentNode) {
    centersLink.parentNode.insertBefore(newLink, centersLink);
  } else {
    siteNav.appendChild(newLink);
  }
};

const ensureFooterLegalLinks = () => {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;
  const hasLegalLinks = footer.querySelector('a[href*="aviso-legal.html"]');
  if (hasLegalLinks) return;

  const heading = Array.from(footer.querySelectorAll("h4")).find((el) =>
    /legal/i.test(el.textContent),
  );
  const target = heading?.parentElement;
  if (!target) return;
  const prefix = getPathPrefix();
  const links = [
    { href: `${prefix}aviso-legal.html`, label: "Aviso legal" },
    { href: `${prefix}privacidad.html`, label: "Política de privacidad" },
    { href: `${prefix}cookies.html`, label: "Política de cookies" },
  ];
  links
    .slice()
    .reverse()
    .forEach((item) => {
    const p = document.createElement("p");
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = item.label;
    p.appendChild(a);
    target.insertBefore(p, heading.nextSibling);
  });
};

ensureCatalogLink();
ensureFooterLegalLinks();

const isApplePlatform = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

const createCommandPalette = () => {
  const palette = document.createElement("div");
  palette.className = "cmdk";
  palette.hidden = true;

  palette.innerHTML = `
    <div class="cmdk-backdrop" data-cmdk-close="true"></div>
    <div class="cmdk-dialog" role="dialog" aria-modal="true" aria-labelledby="cmdk-title">
      <div class="cmdk-header">
        <h2 class="cmdk-title" id="cmdk-title">Buscar en la web</h2>
        <button class="cmdk-close" type="button" data-cmdk-close="true" aria-label="Cerrar">Esc</button>
      </div>
      <div class="cmdk-input-wrap">
        <input class="cmdk-input" type="search" placeholder="Busca servicios, páginas o artículos..." autocomplete="off" />
        <div class="cmdk-hint">Consejo: usa <strong>${isApplePlatform() ? "⌘K" : "Ctrl+K"}</strong> para abrir y <strong>Esc</strong> para cerrar.</div>
      </div>
      <div class="cmdk-results" role="listbox" aria-label="Resultados"></div>
    </div>
  `;

  document.body.appendChild(palette);

  const input = palette.querySelector(".cmdk-input");
  const results = palette.querySelector(".cmdk-results");

  let itemsCache = null;
  let activeIndex = -1;
  let activeResults = [];

  const render = (items, query) => {
    results.innerHTML = "";

    if (!itemsCache) {
      const loading = document.createElement("div");
      loading.className = "cmdk-item";
      loading.textContent = "Cargando...";
      results.appendChild(loading);
      return;
    }

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cmdk-item";
      empty.textContent = query
        ? "Sin resultados. Prueba otra palabra."
        : "Empieza a escribir para buscar.";
      results.appendChild(empty);
      return;
    }

    items.forEach((item, idx) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cmdk-item";
      button.setAttribute("role", "option");
      button.setAttribute(
        "aria-selected",
        idx === activeIndex ? "true" : "false",
      );
      button.dataset.url = item.url;

      const metaBits = [];
      metaBits.push(item.kind === "post" ? "Blog" : "Página");
      if (item.tag) metaBits.push(item.tag);

      button.innerHTML = `
        <div>
          <div class="cmdk-item-title">${item.title}</div>
          <div class="cmdk-item-desc">${item.description || ""}</div>
        </div>
        <div class="cmdk-item-meta">
          ${metaBits.map((t) => `<span class="cmdk-pill">${t}</span>`).join("")}
        </div>
      `;

      button.addEventListener("click", () => {
        window.location.href = item.url;
      });

      results.appendChild(button);
    });
  };

  const setActiveIndex = (nextIndex) => {
    activeIndex = nextIndex;
    const buttons = Array.from(results.querySelectorAll("button.cmdk-item"));
    buttons.forEach((btn, i) =>
      btn.setAttribute("aria-selected", i === activeIndex ? "true" : "false"),
    );
    const active = buttons[activeIndex];
    if (active) active.scrollIntoView({ block: "nearest" });
  };

  const filterItems = (query) => {
    const q = query.trim().toLowerCase();
    if (!itemsCache) return [];
    if (!q) return itemsCache.slice(0, 10);
    return itemsCache
      .filter((item) => {
        const haystack =
          `${item.title} ${item.description || ""} ${item.tag || ""}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 12);
  };

  const ensureItemsLoaded = async () => {
    if (itemsCache) return;
    try {
      const candidates = [
        "/search-index.json",
        "search-index.json",
        "../search-index.json",
      ];
      for (const url of candidates) {
        const res = await fetch(url, { cache: "force-cache" });
        if (res.ok) {
          itemsCache = await res.json();
          return;
        }
      }
      itemsCache = [];
    } catch (_) {
      itemsCache = [];
    }
  };

  const open = async () => {
    palette.hidden = false;
    document.documentElement.style.overflow = "hidden";

    await ensureItemsLoaded();
    activeResults = filterItems("");
    activeIndex = activeResults.length ? 0 : -1;
    render(activeResults, "");

    input.value = "";
    input.focus({ preventScroll: true });
  };

  const close = () => {
    palette.hidden = true;
    document.documentElement.style.overflow = "";
    activeIndex = -1;
    activeResults = [];
  };

  palette.addEventListener("click", (event) => {
    if (
      event.target &&
      event.target.dataset &&
      event.target.dataset.cmdkClose === "true"
    ) {
      close();
    }
  });

  input.addEventListener("input", () => {
    activeResults = filterItems(input.value);
    activeIndex = activeResults.length ? 0 : -1;
    render(activeResults, input.value);
    setActiveIndex(activeIndex);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!activeResults.length) return;
      setActiveIndex(Math.min(activeIndex + 1, activeResults.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!activeResults.length) return;
      setActiveIndex(Math.max(activeIndex - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      const chosen = activeResults[activeIndex];
      if (chosen) {
        window.location.href = chosen.url;
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    const isK = event.key.toLowerCase() === "k";
    const wantsOpen = (event.ctrlKey || event.metaKey) && isK;
    if (wantsOpen) {
      event.preventDefault();
      if (palette.hidden) open();
      else close();
      return;
    }

    if (!palette.hidden && event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  return { open, close };
};

const cmdk = createCommandPalette();

if (siteNav) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-search";
  const shortcut = isApplePlatform() ? "⌘K" : "Ctrl K";
  button.innerHTML = `Buscar <kbd>${shortcut}</kbd>`;
  button.addEventListener("click", () => {
    siteNav.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
    cmdk.open();
  });
  siteNav.appendChild(button);
}

const revealElements = Array.from(document.querySelectorAll(".reveal"));
if (revealElements.length > 0 && "IntersectionObserver" in window) {
  const revealInViewport = () => {
    revealElements.forEach((el) => {
      if (el.classList.contains("is-visible")) return;
      const rect = el.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.96) {
        el.classList.add("is-visible");
      }
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 },
  );

  revealInViewport();
  revealElements.forEach((el) => observer.observe(el));
  window.addEventListener("load", revealInViewport, { once: true });

  // Fallback: if anything remains hidden (observer quirks), force visibility.
  window.setTimeout(() => {
    revealElements.forEach((el) => el.classList.add("is-visible"));
  }, 1200);
} else {
  revealElements.forEach((el) => el.classList.add("is-visible"));
}

const initStickyCta = () => {
  const body = document.body;
  if (!body) return;

  const centers = TodoOptica.centers;
  const centerKeys = Object.keys(centers);
  if (!centerKeys.length) return;

  const stored = window.localStorage?.getItem("todooptica_center");
  const preferred = body.dataset.center;
  let activeCenter =
    preferred && centers[preferred]
      ? preferred
      : stored && centers[stored]
        ? stored
        : centerKeys[0];
  const context = {
    service: body.dataset.service || "",
    date: "",
    time: "",
  };

  const wrapper = document.createElement("div");
  wrapper.className = "sticky-cta";
  wrapper.innerHTML = `
    <button class="sticky-cta__fab" type="button" aria-expanded="false" aria-controls="sticky-cta-panel">
      <span>¿Te ayudamos?</span>
      <strong>Llamar o WhatsApp</strong>
    </button>
    <div class="sticky-cta__panel" id="sticky-cta-panel" hidden>
      <div class="sticky-cta__header">
        <div>
          <p class="sticky-cta__eyebrow">Contacto rápido</p>
          <h3>Elige un centro</h3>
        </div>
        <button class="sticky-cta__close" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="sticky-cta__centers"></div>
      <div class="sticky-cta__actions">
        <a class="btn primary" data-sticky-call href="#">Llamar ahora</a>
        <a class="btn ghost" data-sticky-wa href="#" target="_blank" rel="noreferrer">WhatsApp</a>
        <a class="btn ghost" data-sticky-cita href="cita.html">Pedir cita</a>
      </div>
    </div>
    <div class="sticky-cta__backdrop" hidden></div>
  `;

  body.appendChild(wrapper);

  const fab = wrapper.querySelector(".sticky-cta__fab");
  const panel = wrapper.querySelector(".sticky-cta__panel");
  const closeBtn = wrapper.querySelector(".sticky-cta__close");
  const backdrop = wrapper.querySelector(".sticky-cta__backdrop");
  const centersWrap = wrapper.querySelector(".sticky-cta__centers");
  const callLink = wrapper.querySelector("[data-sticky-call]");
  const waLink = wrapper.querySelector("[data-sticky-wa]");
  const citaLink = wrapper.querySelector("[data-sticky-cita]");

  const setOpen = (open) => {
    if (!fab || !panel || !backdrop) return;
    fab.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
    backdrop.hidden = !open;
    if (open) {
      const first = panel.querySelector(".sticky-cta__center");
      first?.focus({ preventScroll: true });
    }
  };

  const updateActions = () => {
    const center = centers[activeCenter];
    if (!center) return;
    const message = TodoOptica.buildWhatsAppMessage({
      center: center.label,
      service: context.service,
      date: context.date,
      time: context.time,
    });
    if (callLink) callLink.href = `tel:${center.phone}`;
    if (waLink) waLink.href = TodoOptica.buildWhatsAppUrl(message);
    if (citaLink) citaLink.href = `cita.html?center=${activeCenter}`;
  };

  const setCenter = (key) => {
    if (!centers[key]) return;
    activeCenter = key;
    window.localStorage?.setItem("todooptica_center", key);
    centersWrap
      ?.querySelectorAll(".sticky-cta__center")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.center === key),
      );
    updateActions();
  };

  if (centersWrap) {
    centersWrap.innerHTML = centerKeys
      .map((key) => {
        const center = centers[key];
        return `
          <button class="sticky-cta__center" type="button" data-center="${key}">
            <strong>${center.name}</strong>
            <span>${center.address}</span>
          </button>
        `;
      })
      .join("");

    centersWrap.querySelectorAll(".sticky-cta__center").forEach((btn) => {
      btn.addEventListener("click", () => {
        setCenter(btn.dataset.center);
        setOpen(false);
      });
    });
  }

  fab?.addEventListener("click", () => {
    const isOpen = fab.getAttribute("aria-expanded") === "true";
    setOpen(!isOpen);
  });
  closeBtn?.addEventListener("click", () => setOpen(false));
  backdrop?.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  setCenter(activeCenter);

  TodoOptica.setStickyContext = (next) => {
    if (next?.center && centers[next.center]) {
      activeCenter = next.center;
      window.localStorage?.setItem("todooptica_center", activeCenter);
    }
    context.service = next?.service ?? context.service;
    context.date = next?.date ?? context.date;
    context.time = next?.time ?? context.time;
    updateActions();
  };
};

initStickyCta();
