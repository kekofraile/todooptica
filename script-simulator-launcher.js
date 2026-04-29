(function () {
  const statusEl = document.getElementById("simulator-status");
  const launchLinks = Array.from(
    document.querySelectorAll("[data-launch-simulator]"),
  );
  if (!statusEl) {
    return;
  }

  const buildUrl = "games/lumen-optical-store-rush/index.html";

  fetch(buildUrl, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Build no disponible");
      }
      return response.text();
    })
    .then(() => {
      statusEl.textContent = "Build detectada: lista para jugar en navegador.";
      statusEl.dataset.state = "ready";
      launchLinks.forEach((link) => {
        link.textContent = "Jugar ahora";
      });
    })
    .catch(() => {
      statusEl.textContent =
        "No se ha detectado aún la build estática del juego. Ejecuta `npm run build:store-rush` en la raíz.";
      statusEl.dataset.state = "missing";

      launchLinks.forEach((link) => {
        link.textContent = "Build pendiente";
      });
    });
})();
