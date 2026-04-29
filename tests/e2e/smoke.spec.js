const { test, expect } = require("@playwright/test");

const PAGES = [
  { name: "home", path: "/index.html", shell: ".site-header", content: "main" },
  { name: "services", path: "/servicios.html", shell: ".site-header", content: "main" },
  { name: "appointment", path: "/cita.html", shell: ".site-header", content: "main" },
  { name: "myopia", path: "/control-miopia.html", shell: ".site-header", content: "main" },
  { name: "technology", path: "/tecnologia.html", shell: ".site-header", content: "main" },
  { name: "store-rush-landing", path: "/simulador-optica.html", shell: ".site-header", content: "main" },
  { name: "store-rush-game", path: "/games/lumen-optical-store-rush/", shell: '[data-menu]', content: ".game-stage" },
  { name: "audiology", path: "/audiologia.html", shell: ".site-header", content: "main" },
  { name: "centers", path: "/centros.html", shell: ".site-header", content: "main" },
  { name: "faq", path: "/preguntas-frecuentes.html", shell: ".site-header", content: "main" },
  { name: "blog", path: "/blog.html", shell: ".site-header", content: "main" },
  {
    name: "blog-post",
    path: "/blog/vision-educacion-aprendizaje.html",
    shell: ".site-header",
    content: "main",
  },
];

for (const pageInfo of PAGES) {
  test(`smoke: loads ${pageInfo.name}`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err));

    await page.goto(pageInfo.path);
    await expect(page.locator(pageInfo.shell)).toBeVisible();
    await expect(page.locator(pageInfo.content)).toBeVisible();

    expect(
      errors.map((e) => e.message || String(e)),
      "No debe haber errores JS (pageerror) al cargar la página.",
    ).toEqual([]);
  });
}
