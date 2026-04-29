import Phaser from "phaser";
import "./styles.css";
import { Sfx } from "./audio/sfx";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { MenuScene } from "./scenes/MenuScene";
import { StoreSimulation } from "./sim/store-simulation";
import { clearSave, persistSave } from "./sim/save";
import { DomUI } from "./ui/dom-ui";

export class GameController {
  sim = new StoreSimulation();
  ui: DomUI;
  sfx = new Sfx();
  game: Phaser.Game;
  startedPlaying = false;

  constructor(mount: HTMLElement) {
    this.ui = new DomUI(mount, {
      onNewCampaign: () => {
        this.sfx.play("start");
        this.sim.newCampaign();
        this.ui.showBriefing(this.sim);
      },
      onContinue: () => {
        const requiredUpgrade = this.sim.getRequiredUpgradeForNextDay();
        if (requiredUpgrade) {
          this.sim.message = `Necesitas comprar ${requiredUpgrade.label} antes de abrir el Día 2.`;
          this.ui.showUpgrades(this.sim);
          return;
        }
        this.sfx.play("start");
        this.sim.startContinue();
        this.ui.showBriefing(this.sim);
      },
      onEndless: () => {
        this.sfx.play("start");
        this.sim.startEndless();
        this.ui.showBriefing(this.sim);
      },
      onResumeDay: () => {
        const requiredUpgrade = this.sim.getRequiredUpgradeForNextDay();
        if (requiredUpgrade) {
          this.sfx.play("alert");
          this.sim.message = `Compra ${requiredUpgrade.label} para desbloquear la siguiente jornada.`;
          this.ui.showUpgrades(this.sim);
          return;
        }
        if (this.sim.finishedDay) {
          if (this.sim.endlessMode) {
            this.sim.startEndless();
          } else {
            this.sim.startDay(this.sim.save.currentDay, false);
          }
        }
        this.startedPlaying = true;
        this.ui.hideAllOverlays();
        this.ui.hud.classList.add("is-visible");
      },
      onBuyUpgrade: (id: string) => {
        if (this.sim.purchaseUpgrade(id)) {
          this.sfx.play("coin");
          this.ui.showUpgrades(this.sim);
        }
      },
      onNextDay: () => {
        this.ui.showUpgrades(this.sim);
      },
      onResetSave: () => {
        clearSave();
        this.sim.resetSave();
        this.ui.showMenu(this.sim);
      },
    });

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: this.ui.getGameMount(),
      backgroundColor: "#f7f0e2",
      render: {
        antialias: true,
        roundPixels: false,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1400,
        height: 900,
      },
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      scene: [BootScene, MenuScene, GameScene],
      physics: { default: "arcade" },
    });

    this.game.scene.start("menu", { controller: this });
    this.game.scene.start("game", { controller: this });
    this.ui.showMenu(this.sim);

    const ticker = () => {
      this.ui.updateHud(this.sim);
      if (this.startedPlaying && this.sim.finishedDay) {
        this.startedPlaying = false;
        this.sfx.play(this.sim.getStars() >= 2 ? "success" : "alert");
        this.ui.showResults(this.sim);
      }
      requestAnimationFrame(ticker);
    };
    ticker();

    (window as typeof window & {
      __lumenStoreRush?: {
        controller: GameController;
        startDay: (day: number) => void;
        tickMoney: () => number;
        finishDay: () => void;
        advanceTime: (ms: number) => void;
        renderGameToText: () => string;
        persistProgress: (day: number, cash: number) => void;
      };
    }).__lumenStoreRush = {
      controller: this,
      startDay: (day: number) => {
        this.sim.startDay(day, false);
        this.ui.showBriefing(this.sim);
      },
      tickMoney: () => this.sim.moneyToday,
      finishDay: () => {
        this.sim.forceDayClose();
      },
      advanceTime: (ms: number) => {
        this.advanceTime(ms);
      },
      renderGameToText: () => this.renderGameToText(),
      persistProgress: (day: number, cash: number) => {
        this.sim.save.currentDay = day;
        this.sim.save.highestDayUnlocked = Math.max(this.sim.save.highestDayUnlocked, day);
        this.sim.save.totalCash = cash;
        persistSave(this.sim.save);
      },
    };

    (window as typeof window & {
      advanceTime?: (ms: number) => void;
      render_game_to_text?: () => string;
    }).advanceTime = (ms: number) => {
      this.advanceTime(ms);
    };
    (window as typeof window & {
      advanceTime?: (ms: number) => void;
      render_game_to_text?: () => string;
    }).render_game_to_text = () => this.renderGameToText();
  }

  updatePlayerPosition(x: number, y: number): void {
    this.sim.updatePlayerPosition(x, y);
  }

  interact(): void {
    const beforeResults = this.sim.stats.customersServed;
    this.sim.interact();
    if (this.sim.stats.customersServed > beforeResults) {
      this.sfx.play("coin");
    } else {
      this.sfx.play("success");
    }
  }

  advanceTime(ms: number): void {
    const stepMs = 1000 / 60;
    const steps = Math.max(1, Math.round(ms / stepMs));
    for (let index = 0; index < steps; index += 1) {
      this.sim.update(stepMs / 1000);
    }
    const gameScene = this.game.scene.getScene("game") as GameScene;
    if (gameScene?.scene.isActive()) {
      gameScene.renderWorld(0);
    }
  }

  renderGameToText(): string {
    const snapshot = this.sim.getSnapshot();
    return JSON.stringify(
      {
        mode: this.startedPlaying ? "day" : "overlay",
        day: snapshot.dayNumber,
        title: snapshot.day.title,
        timeRemaining: Math.round(snapshot.timeRemaining),
        moneyToday: Math.round(snapshot.moneyToday),
        prompt: this.sim.currentPrompt?.label ?? null,
        player: {
          x: Math.round(this.sim.playerX),
          y: Math.round(this.sim.playerY),
        },
        customers: snapshot.customers.map((customer) => ({
          id: customer.id,
          label: customer.label,
          service: customer.serviceId,
          stage: customer.stage,
          needStage: customer.needStage,
          x: Math.round(customer.x),
          y: Math.round(customer.y),
          patience: Math.round(customer.patience),
          stationId: customer.stationId,
        })),
        tasks: snapshot.activeTasks.map((task) => ({
          label: task.label,
          remaining: Math.round(task.remaining),
          stationId: task.stationId,
        })),
        stats: snapshot.stats,
      },
      null,
      2,
    );
  }
}

const app = document.getElementById("app");
if (!app) {
  throw new Error("Missing #app root.");
}

new GameController(app);
