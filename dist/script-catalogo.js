const setupCatalogFilters = () => {
  const root = document.querySelector("[data-catalog]");
  if (!root || root.dataset.catalogReady === "true") return;
  root.dataset.catalogReady = "true";

  const buttons = Array.from(root.querySelectorAll("[data-filter]"));
  const items = Array.from(root.querySelectorAll("[data-catalog-item]"));
  const countEl = root.querySelector("[data-catalog-count]");

  const apply = (filter) => {
    root.dataset.activeFilter = filter;
    let visible = 0;
    items.forEach((item) => {
      const tags = (item.dataset.tags || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const show = filter === "all" || tags.includes(filter);
      item.hidden = !show;
      if (show) visible += 1;
    });

    buttons.forEach((btn) => {
      const isActive = btn.dataset.filter === filter;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    if (countEl) {
      countEl.textContent = `${visible} ${
        visible === 1 ? "selección visible" : "selecciones visibles"
      }`;
    }
  };

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      apply(btn.dataset.filter || "all");
    });
  });

  apply(buttons[0]?.dataset.filter || "all");
};

setupCatalogFilters();
