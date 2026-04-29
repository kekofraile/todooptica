import type { StoreSimulation } from "../sim/store-simulation";
import type { UpgradeDefinition } from "../types";

type Listener = {
  onNewCampaign: () => void;
  onContinue: () => void;
  onEndless: () => void;
  onResumeDay: () => void;
  onBuyUpgrade: (id: string) => void;
  onNextDay: () => void;
  onResetSave: () => void;
};

export class DomUI {
  root: HTMLElement;
  hud: HTMLElement;
  menu: HTMLElement;
  briefing: HTMLElement;
  results: HTMLElement;
  prompt: HTMLElement;
  listeners: Listener;
  upgradeFilter = "all";
  cachedUpgrades: UpgradeDefinition[] = [];
  cachedWallet = 0;
  cachedRequiredUpgradeId: string | null = null;

  constructor(root: HTMLElement, listeners: Listener) {
    this.root = root;
    this.listeners = listeners;
    root.innerHTML = `
      <div class="lumen-shell">
        <div id="game-stage" class="game-stage"></div>
        <div class="hud" data-hud>
          <div class="hud__top">
            <div>
              <p class="hud__eyebrow">Lumen Optical</p>
              <h1 class="hud__title" data-day-title>Store Rush</h1>
            </div>
            <div class="hud__stats">
              <span class="hud__pill" data-day-time>00:00</span>
              <span class="hud__pill hud__pill--warm" data-day-money>0€</span>
              <span class="hud__pill hud__pill--teal" data-day-reputation>72 rep</span>
            </div>
          </div>
          <p class="hud__objective" data-objective></p>
          <p class="hud__next-step" data-next-step></p>
          <div class="hud__grid">
            <div>
              <h2>Tareas activas</h2>
              <ul data-task-list class="hud__tasks"></ul>
            </div>
            <div>
              <h2>Estado tienda</h2>
              <ul data-store-stats class="hud__store-list"></ul>
            </div>
          </div>
          <div class="hud__message" data-message></div>
          <div class="hud__controls">Mover: WASD o flechas · Interactuar: E / Space</div>
        </div>
        <div class="prompt" data-prompt hidden></div>
        <section class="overlay overlay--menu is-visible" data-menu>
          <div class="panel panel--hero">
            <div class="menu__layout">
              <div>
                <p class="panel__eyebrow">Boutique management</p>
                <h2>Lumen Optical: Store Rush</h2>
                <p>
                  Dirige una óptica de barrio moderna: atiende clientes, arranca revisiones,
                  remata monturas, gestiona lentillas y haz crecer la tienda día a día.
                </p>
                <div class="menu__actions">
                  <button data-action="new">Nueva campaña</button>
                  <button data-action="continue">Continuar campaña</button>
                  <button data-action="endless">Endless mode</button>
                </div>
                <div class="menu__subactions">
                  <button data-action="reset" class="ghost">Borrar progreso</button>
                </div>
              </div>
              <aside class="menu__feature-list">
                <div class="menu__feature">
                  <strong>18 días</strong>
                  <span>Campaña gradual con nuevas zonas y presión creciente.</span>
                </div>
                <div class="menu__feature">
                  <strong>Óptica auténtica</strong>
                  <span>Revisiones, monturas, lentillas, recogidas y ajustes.</span>
                </div>
                <div class="menu__feature">
                  <strong>Playfield claro</strong>
                  <span>HUD compacto, tareas activas y estados de estaciones visibles.</span>
                </div>
              </aside>
            </div>
            <div class="menu__notes">
              <p>Optical fantasy readable first: task timers, route pressure, and boutique growth.</p>
            </div>
          </div>
        </section>
        <section class="overlay" data-briefing>
          <div class="panel">
            <p class="panel__eyebrow">Briefing del día</p>
            <h2 data-briefing-title></h2>
            <p data-briefing-subtitle></p>
            <div class="briefing__metrics" data-briefing-metrics></div>
            <button data-action="start-day">Abrir la tienda</button>
          </div>
        </section>
        <section class="overlay" data-results>
          <div class="panel">
            <p class="panel__eyebrow">Cierre de jornada</p>
            <h2 data-results-title>Resumen</h2>
            <div data-results-stars class="results__stars"></div>
            <div data-results-grid class="results__grid"></div>
            <div data-results-bonus class="results__bonus"></div>
            <div class="results__actions">
              <button data-action="next-day">Ir a mejoras</button>
            </div>
          </div>
        </section>
        <section class="overlay" data-upgrades>
          <div class="panel">
            <p class="panel__eyebrow">Mejoras boutique</p>
            <h2>Invierte los beneficios</h2>
            <p data-upgrade-wallet></p>
            <div class="upgrade-toolbar">
              <label>
                Mostrar
                <select data-upgrade-filter>
                  <option value="all">Todo</option>
                  <option value="operations">Operativa</option>
                  <option value="comfort">Confort</option>
                  <option value="product">Producto</option>
                  <option value="space">Espacio</option>
                  <option value="staff">Staff</option>
                </select>
              </label>
              <p data-upgrade-note class="upgrade-note"></p>
            </div>
            <div data-upgrade-list class="upgrade-list"></div>
            <div class="results__actions">
              <button data-action="resume-campaign">Siguiente jornada</button>
            </div>
          </div>
        </section>
      </div>
    `;

    this.hud = root.querySelector("[data-hud]") as HTMLElement;
    this.menu = root.querySelector("[data-menu]") as HTMLElement;
    this.briefing = root.querySelector("[data-briefing]") as HTMLElement;
    this.results = root.querySelector("[data-results]") as HTMLElement;
    this.prompt = root.querySelector("[data-prompt]") as HTMLElement;

    root.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const upgradeId = target?.closest("[data-upgrade-id]")?.getAttribute("data-upgrade-id");
      if (upgradeId) {
        this.listeners.onBuyUpgrade(upgradeId);
        return;
      }
      const action = target?.closest("[data-action]")?.getAttribute("data-action");
      if (!action) {
        return;
      }
      if (action === "new") this.listeners.onNewCampaign();
      if (action === "continue") this.listeners.onContinue();
      if (action === "endless") this.listeners.onEndless();
      if (action === "start-day") this.listeners.onResumeDay();
      if (action === "next-day") this.listeners.onNextDay();
      if (action === "resume-campaign") this.listeners.onResumeDay();
      if (action === "reset") this.listeners.onResetSave();
    });

    root.addEventListener("change", (event) => {
      const target = event.target as HTMLSelectElement | null;
      if (target?.matches("[data-upgrade-filter]")) {
        this.upgradeFilter = target.value;
        this.renderUpgradeList();
      }
    });
  }

  getGameMount(): HTMLElement {
    return this.root.querySelector("#game-stage") as HTMLElement;
  }

  showMenu(sim: StoreSimulation): void {
    this.hideAllOverlays();
    this.menu.classList.add("is-visible");
    this.hud.classList.remove("is-visible");
    const buttons = this.menu.querySelectorAll<HTMLButtonElement>('button[data-action="continue"], button[data-action="endless"]');
    buttons.forEach((button) => {
      if (button.dataset.action === "continue") {
        button.disabled = sim.save.highestDayUnlocked < 1;
      }
      if (button.dataset.action === "endless") {
        button.disabled = !sim.save.endlessUnlocked;
      }
    });
  }

  showBriefing(sim: StoreSimulation): void {
    this.hideAllOverlays();
    this.hud.classList.add("is-visible");
    this.briefing.classList.add("is-visible");
    (this.root.querySelector("[data-briefing-title]") as HTMLElement).textContent =
      `Día ${sim.dayNumber}: ${sim.currentDay.title}`;
    (this.root.querySelector("[data-briefing-subtitle]") as HTMLElement).textContent =
      sim.currentDay.subtitle;
    (this.root.querySelector("[data-briefing-metrics]") as HTMLElement).innerHTML = `
      <div><strong>${sim.currentDay.revenueTarget}€</strong><span>Objetivo ingresos</span></div>
      <div><strong>${sim.currentDay.servedTarget}</strong><span>Clientes objetivo</span></div>
      <div><strong>${sim.currentDay.satisfactionTarget}%</strong><span>Satisfacción</span></div>
      <div><strong>${sim.currentDay.bonusLabel}</strong><span>Bonus</span></div>
    `;
  }

  showResults(sim: StoreSimulation): void {
    const summary = sim.getResultsSummary();
    this.hideAllOverlays();
    this.hud.classList.add("is-visible");
    this.results.classList.add("is-visible");
    (this.root.querySelector("[data-results-title]") as HTMLElement).textContent =
      `Día ${sim.dayNumber}: ${sim.currentDay.title}`;
    (this.root.querySelector("[data-results-stars]") as HTMLElement).innerHTML = Array.from(
      { length: 3 },
      (_, index) =>
        `<span class="star ${index < summary.stars ? "is-on" : ""}">★</span>`,
    ).join("");
    (this.root.querySelector("[data-results-grid]") as HTMLElement).innerHTML = `
      <div><strong>${summary.stats.money}€</strong><span>Ingresos del día</span></div>
      <div><strong>${summary.stats.customersServed}</strong><span>Clientes servidos</span></div>
      <div><strong>${summary.stats.averageSatisfaction}%</strong><span>Satisfacción media</span></div>
      <div><strong>${summary.stats.angryExits}</strong><span>Salidas enfadadas</span></div>
      <div><strong>${summary.stats.examsCompleted}</strong><span>Revisiones</span></div>
      <div><strong>${summary.stats.premiumSales}</strong><span>Premium</span></div>
    `;
    (this.root.querySelector("[data-results-bonus]") as HTMLElement).textContent =
      summary.bonusComplete
        ? `Bonus cumplido: ${sim.currentDay.bonusLabel}`
        : `Bonus pendiente: ${sim.currentDay.bonusLabel}`;
  }

  showUpgrades(sim: StoreSimulation): void {
    this.cachedUpgrades = sim.getAvailableUpgrades();
    this.cachedWallet = sim.save.totalCash;
    this.cachedRequiredUpgradeId = sim.getRequiredUpgradeForNextDay()?.id ?? null;
    this.hideAllOverlays();
    this.hud.classList.add("is-visible");
    this.results.classList.remove("is-visible");
    this.briefing.classList.remove("is-visible");
    this.menu.classList.remove("is-visible");
    const overlay = this.root.querySelector("[data-upgrades]") as HTMLElement;
    overlay.classList.add("is-visible");
    (this.root.querySelector("[data-upgrade-wallet]") as HTMLElement).textContent =
      `Caja boutique disponible: ${sim.save.totalCash}€`;
    const filter = this.root.querySelector("[data-upgrade-filter]") as HTMLSelectElement;
    filter.value = this.upgradeFilter;
    (this.root.querySelector("[data-upgrade-note]") as HTMLElement).textContent = this.cachedRequiredUpgradeId
      ? "Contrata a la cajera de apoyo para abrir el Día 2 y desbloquear la primera automatización real."
      : "Filtra por categoría y decide qué parte de la boutique quieres reforzar.";
    const resumeButton = this.root.querySelector<HTMLButtonElement>('button[data-action="resume-campaign"]');
    if (resumeButton) {
      resumeButton.disabled = Boolean(this.cachedRequiredUpgradeId);
    }
    this.renderUpgradeList();
  }

  renderUpgradeList(): void {
    const upgrades = this.cachedUpgrades.filter(
      (upgrade) => this.upgradeFilter === "all" || upgrade.category === this.upgradeFilter,
    );
    (this.root.querySelector("[data-upgrade-list]") as HTMLElement).innerHTML = upgrades
      .map(
        (upgrade: UpgradeDefinition) => `
        <article class="upgrade-card">
          <div>
            <p class="upgrade-card__tag">${upgrade.category}</p>
            <h3>${upgrade.label}</h3>
            <p>${upgrade.description}</p>
          </div>
          <button data-upgrade-id="${upgrade.id}" ${this.cachedWallet < upgrade.cost ? "disabled" : ""}>
            Comprar · ${upgrade.cost}€
          </button>
        </article>
      `,
      )
      .join("") || `<article class="upgrade-card upgrade-card--empty"><p>No hay mejoras en esta categoría todavía.</p></article>`;
  }

  updateHud(sim: StoreSimulation): void {
    const snapshot = sim.getSnapshot();
    (this.root.querySelector("[data-day-title]") as HTMLElement).textContent =
      `${snapshot.endlessMode ? "Endless" : `Día ${snapshot.dayNumber}`} · ${snapshot.day.title}`;
    (this.root.querySelector("[data-day-time]") as HTMLElement).textContent =
      `${Math.floor(snapshot.timeRemaining / 60)
        .toString()
        .padStart(2, "0")}:${Math.floor(snapshot.timeRemaining % 60)
        .toString()
        .padStart(2, "0")}`;
    (this.root.querySelector("[data-day-money]") as HTMLElement).textContent =
      `${Math.round(snapshot.moneyToday)}€ hoy`;
    (this.root.querySelector("[data-day-reputation]") as HTMLElement).textContent =
      `${snapshot.save.reputation} rep`;
    (this.root.querySelector("[data-objective]") as HTMLElement).textContent =
      snapshot.objectiveText;
    (this.root.querySelector("[data-next-step]") as HTMLElement).textContent =
      sim.nextGoal?.label ?? "Siguiente: mantén libre la recepción y vigila los temporizadores.";
    (this.root.querySelector("[data-message]") as HTMLElement).textContent =
      snapshot.message;
    (this.root.querySelector("[data-task-list]") as HTMLElement).innerHTML = snapshot.activeTasks
      .slice(0, 6)
      .map(
        (task) => `<li class="${task.critical ? "is-critical" : ""}">
          <span>${task.label}</span>
          <strong>${task.remaining > 0 ? `${Math.ceil(task.remaining)}s` : "Listo"}</strong>
        </li>`,
      )
      .join("") || `<li><span>Tienda estable</span><strong>Sin colas críticas</strong></li>`;
    (this.root.querySelector("[data-store-stats]") as HTMLElement).innerHTML = `
      <li><span>Atendidos</span><strong>${snapshot.stats.customersServed}</strong></li>
      <li><span>Satisfacción</span><strong>${snapshot.stats.averageSatisfaction}%</strong></li>
      <li><span>Enfadados</span><strong>${snapshot.stats.angryExits}</strong></li>
      <li><span>Premium</span><strong>${snapshot.stats.premiumSales}</strong></li>
    `;
  }

  setPrompt(text: string | null): void {
    if (!text) {
      this.prompt.hidden = true;
      return;
    }
    this.prompt.hidden = false;
    this.prompt.textContent = `E · ${text}`;
  }

  hideAllOverlays(): void {
    this.root.querySelectorAll(".overlay").forEach((overlay) =>
      overlay.classList.remove("is-visible"),
    );
  }
}
