const blogSearch = document.getElementById("blog-search");
const blogCards = document.querySelectorAll(".blog-card");
const searchCount = document.getElementById("search-count");

if (blogSearch && blogCards.length > 0) {
  const updateCount = (count) => {
    if (searchCount) {
      searchCount.textContent = `${count} artículos`;
    }
  };

  blogSearch.addEventListener("input", (event) => {
    const query = event.target.value.toLowerCase();
    let visibleCount = 0;

    blogCards.forEach((card) => {
      const text = card.textContent.toLowerCase();
      const isVisible = text.includes(query);
      card.hidden = !isVisible;
      if (isVisible) {
        visibleCount += 1;
      }
    });

    updateCount(visibleCount);
  });

  updateCount(blogCards.length);
}

// Blog post extras: reading progress + table of contents + scroll spy.
const postCard = document.querySelector("article.post-card");
if (postCard && document.body.classList.contains("blog-body")) {
  const updateCtaCopy = () => {
    const items = postCard.querySelectorAll("li");
    items.forEach((item) => {
      if (!item.textContent.includes("respuesta rápida por email")) return;
      const link = item.querySelector('a[href*="cita.html"]');
      if (!link) return;
      item.innerHTML = `${link.outerHTML} (respuesta rápida por teléfono o WhatsApp)`;
    });
  };

  updateCtaCopy();

  const progress = document.createElement("div");
  progress.className = "reading-progress";
  progress.innerHTML = '<div class="reading-progress__bar"></div>';
  document.body.appendChild(progress);

  const calcProgress = () => {
    const rect = postCard.getBoundingClientRect();
    const start = rect.top + window.scrollY;
    const end = start + postCard.offsetHeight - window.innerHeight;
    const raw = (window.scrollY - start) / Math.max(1, end - start);
    const pct = Math.max(0, Math.min(1, raw));
    document.documentElement.style.setProperty(
      "--reading-progress",
      pct.toFixed(4),
    );
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      calcProgress();
      ticking = false;
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => calcProgress());
  calcProgress();

  const slugify = (value) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const headings = Array.from(postCard.querySelectorAll("h2"));
  if (headings.length >= 2) {
    const used = new Map();
    headings.forEach((h) => {
      const base = slugify(h.textContent || "seccion") || "seccion";
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      const id = count === 1 ? base : `${base}-${count}`;
      h.id = h.id || id;
    });

    const toc = document.createElement("aside");
    toc.className = "post-toc";
    toc.innerHTML = `<h2 class=\"post-toc-title\">En este articulo</h2>${headings
      .map(
        (h) => `<a href=\"#${h.id}\" data-toc=\"${h.id}\">${h.textContent}</a>`,
      )
      .join("")}`;

    const contentWrap = document.createElement("div");
    contentWrap.className = "post-content";
    while (postCard.firstChild) {
      contentWrap.appendChild(postCard.firstChild);
    }

    postCard.classList.add("post-with-toc");
    postCard.appendChild(toc);
    postCard.appendChild(contentWrap);

    const tocLinks = Array.from(toc.querySelectorAll("a[data-toc]"));
    const setActive = (id) => {
      tocLinks.forEach((a) =>
        a.classList.toggle("active", a.dataset.toc === id),
      );
    };

    const scrollToHeading = (id, { updateHash = true } = {}) => {
      const target = document.getElementById(id);
      if (!target) return;
      const header = document.querySelector(".site-header");
      const offset = (header?.offsetHeight || 0) + 16;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({
        top,
        behavior: window.TodoOptica?.prefersReducedMotion ? "auto" : "smooth",
      });
      if (updateHash && id) {
        if (history.pushState) {
          history.pushState(null, "", `#${id}`);
        } else {
          window.location.hash = id;
        }
      }
    };

    tocLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const id = link.dataset.toc;
        if (id) scrollToHeading(id);
      });
    });

    if ("IntersectionObserver" in window) {
      const spy = new IntersectionObserver(
        (entries) => {
          const visible = entries.filter((e) => e.isIntersecting);
          if (visible.length === 0) return;
          const id = visible[0].target.id;
          setActive(id);
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0.01 },
      );

      headings.forEach((h) => spy.observe(h));
      setActive(headings[0].id);
    }

    const handleHash = () => {
      const id = window.location.hash.replace("#", "");
      if (id) scrollToHeading(id, { updateHash: false });
    };

    window.addEventListener("hashchange", handleHash);
    window.setTimeout(handleHash, 80);
  }
}
