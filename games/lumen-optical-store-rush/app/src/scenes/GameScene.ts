import Phaser from "phaser";
import { PALETTE } from "../render/palette";
import { drawStoreMap } from "../render/store-map";
import type { GameController } from "../main";

type SpriteBundle = {
  body: Phaser.GameObjects.Container;
  bubble: Phaser.GameObjects.Text;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
};

export class GameScene extends Phaser.Scene {
  controller!: GameController;
  worldLayer!: Phaser.GameObjects.Container;
  stationViews = new Map<string, Phaser.GameObjects.Container>();
  player!: SpriteBundle;
  customers = new Map<string, SpriteBundle>();
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keys!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; interact: Phaser.Input.Keyboard.Key; altInteract: Phaser.Input.Keyboard.Key };
  sparkleGroup!: Phaser.GameObjects.Group;
  guideLine!: Phaser.GameObjects.Graphics;
  focusRing!: Phaser.GameObjects.Ellipse;
  focusArrow!: Phaser.GameObjects.Text;

  constructor() {
    super("game");
  }

  init(data: { controller: GameController }): void {
    this.controller = data.controller;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#f7f0e2");
    this.cameras.main.setRoundPixels(false);
    this.worldLayer = this.add.container(0, 0);
    this.stationViews = drawStoreMap(this, this.worldLayer, this.controller.sim.stations);
    this.sparkleGroup = this.add.group();
    this.guideLine = this.add.graphics();
    this.worldLayer.add(this.guideLine);
    this.focusRing = this.add.ellipse(0, 0, 112, 78, 0xf0bd72, 0.18).setVisible(false);
    this.focusRing.setStrokeStyle(3, 0xf0bd72, 0.72);
    this.worldLayer.add(this.focusRing);
    this.focusArrow = this.add
      .text(0, 0, "▼", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "28px",
        color: "#e9896d",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.focusArrow.setStroke("#fff7ef", 8);
    this.worldLayer.add(this.focusArrow);
    this.player = this.createCharacter("Óptica", 0x1b2f4b, true);
    this.player.body.setDepth(20);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      up: this.input.keyboard!.addKey("W"),
      down: this.input.keyboard!.addKey("S"),
      left: this.input.keyboard!.addKey("A"),
      right: this.input.keyboard!.addKey("D"),
      interact: this.input.keyboard!.addKey("E"),
      altInteract: this.input.keyboard!.addKey("SPACE"),
    };
  }

  createCharacter(label: string, tint: number, isPlayer = false): SpriteBundle {
    const container = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, 22, isPlayer ? 42 : 36, isPlayer ? 18 : 14, 0x7d5320, 0.18);
    const bodyGraphics = this.add.graphics();
    bodyGraphics.fillStyle(0xfdf6e7, 1);
    bodyGraphics.fillRoundedRect(-14, 0, 28, 24, 12);
    bodyGraphics.fillStyle(tint, 1);
    bodyGraphics.fillRoundedRect(-16, -2, 32, 22, 12);
    bodyGraphics.fillStyle(0x314a72, 1);
    bodyGraphics.fillRoundedRect(-16, 18, 10, 22, 5);
    bodyGraphics.fillRoundedRect(6, 18, 10, 22, 5);
    bodyGraphics.fillStyle(PALETTE.peach, 1);
    bodyGraphics.fillCircle(0, -22, isPlayer ? 15 : 14);
    bodyGraphics.fillStyle(isPlayer ? 0xc74832 : 0xe0a23f, 1);
    bodyGraphics.fillRoundedRect(-15, -32, 30, 12, 8);
    bodyGraphics.fillStyle(0xffffff, isPlayer ? 1 : 0.94);
    bodyGraphics.fillRoundedRect(-6, -2, 12, 20, 4);
    bodyGraphics.lineStyle(3, 0x8f5518, 0.25);
    bodyGraphics.strokeCircle(0, -22, isPlayer ? 15 : 14);
    bodyGraphics.strokeRoundedRect(-16, -2, 32, 22, 12);
    bodyGraphics.lineStyle(3, 0x35558c, 0.65);
    bodyGraphics.strokeRoundedRect(-13, -26, 11, 8, 4);
    bodyGraphics.strokeRoundedRect(2, -26, 11, 8, 4);
    bodyGraphics.lineBetween(-2, -22, 2, -22);
    const bubblePlate = this.add.ellipse(0, -70, 42, 42, 0xffffff, 0.98);
    bubblePlate.setStrokeStyle(3, 0xa56b2b, 0.18);
    const bubble = this.add.text(0, -70, "", { fontSize: "22px" }).setOrigin(0.5);
    const name = this.add
      .text(0, 28, label, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: isPlayer ? "13px" : "12px",
        color: "#24406b",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    name.setStroke("#fff8ee", 4);
    container.add([shadow, bodyGraphics, bubblePlate, bubble, name]);
    this.worldLayer.add(container);
    return { body: container, bubble, shadow, label: name };
  }

  update(_: number, delta: number): void {
    const dt = delta / 1000;
    this.handlePlayerMovement(dt);
    this.controller.sim.update(dt);
    this.renderWorld(dt);

    if (Phaser.Input.Keyboard.JustDown(this.keys.interact) || Phaser.Input.Keyboard.JustDown(this.keys.altInteract)) {
      const beforeMoney = this.controller.sim.moneyToday;
      const beforeTasks = this.controller.sim.getActiveTasks().length;
      this.controller.interact();
      const afterMoney = this.controller.sim.moneyToday;
      const afterTasks = this.controller.sim.getActiveTasks().length;
      if (afterMoney > beforeMoney) {
        this.spawnSparkle(this.controller.sim.playerX, this.controller.sim.playerY, `+${Math.round(afterMoney - beforeMoney)}€`, "#e9896d");
      } else if (afterTasks !== beforeTasks) {
        this.spawnSparkle(this.controller.sim.playerX, this.controller.sim.playerY, "✓", "#4fa8a2");
      }
    }
  }

  handlePlayerMovement(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.keys.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.keys.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.keys.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.keys.down.isDown) dy += 1;
    const length = Math.hypot(dx, dy) || 1;
    const speed = 220;
    const nextX = Phaser.Math.Clamp(this.controller.sim.playerX + (dx / length) * speed * dt, 92, 1268);
    const nextY = Phaser.Math.Clamp(this.controller.sim.playerY + (dy / length) * speed * dt, 140, 730);
    this.controller.updatePlayerPosition(nextX, nextY);
  }

  renderWorld(dt: number): void {
    const snapshot = this.controller.sim.getSnapshot();
    this.controller.ui.updateHud(this.controller.sim);
    this.controller.ui.setPrompt(this.controller.sim.currentPrompt?.label ?? null);
    this.player.body.setPosition(this.controller.sim.playerX, this.controller.sim.playerY + Math.sin(this.time.now / 180) * 1.5);

    const focusTarget = this.controller.sim.currentPrompt ?? this.controller.sim.nextGoal;
    let focusX = 0;
    let focusY = 0;
    if (focusTarget) {
      if (focusTarget.targetType === "station") {
        const station = this.stationViews.get(focusTarget.targetId);
        if (station) {
          focusX = station.x;
          focusY = station.y;
          this.focusRing.setPosition(focusX, focusY);
          this.focusRing.setSize(116 + Math.sin(this.time.now / 180) * 8, 82 + Math.sin(this.time.now / 180) * 6);
        }
      } else {
        const customer = snapshot.customers.find(
          (item) => item.id === focusTarget.targetId,
        );
        if (customer) {
          focusX = customer.x;
          focusY = customer.y + 8;
          this.focusRing.setPosition(focusX, focusY);
          this.focusRing.setSize(60 + Math.sin(this.time.now / 180) * 4, 34 + Math.sin(this.time.now / 180) * 2);
        }
      }
      if (focusX && focusY) {
        this.focusRing.setVisible(true);
        this.guideLine.clear();
        this.guideLine.lineStyle(6, 0xf0bd72, 0.2);
        this.guideLine.beginPath();
        this.guideLine.moveTo(this.controller.sim.playerX, this.controller.sim.playerY);
        this.guideLine.lineTo(focusX, focusY);
        this.guideLine.strokePath();
        this.guideLine.fillStyle(0xf0bd72, 0.18);
        this.guideLine.fillCircle(focusX, focusY, 10 + Math.sin(this.time.now / 180) * 2);
        this.focusArrow.setVisible(true);
        this.focusArrow.setPosition(focusX, focusY - 58 + Math.sin(this.time.now / 160) * 4);
      } else {
        this.focusRing.setVisible(false);
        this.guideLine.clear();
        this.focusArrow.setVisible(false);
      }
    } else {
      this.focusRing.setVisible(false);
      this.focusArrow.setVisible(false);
      this.guideLine.clear();
    }

    for (const station of snapshot.stations) {
      const view = this.stationViews.get(station.id);
      if (!view) continue;
      view.setAlpha(station.unlocked ? 1 : 0.22);
      view.setScale(station.occupiedBy ? 1.04 : 1);
    }

    const seen = new Set<string>();
    for (const customer of snapshot.customers) {
      let sprite = this.customers.get(customer.id);
      if (!sprite) {
        sprite = this.createCharacter(customer.label, customer.color);
        this.customers.set(customer.id, sprite);
      }
      seen.add(customer.id);
      const bob = Math.sin((this.time.now + Number(customer.id.slice(1)) * 240) / 190) * 1.2;
      const activeTargetX = customer.moveWaypointX ?? customer.targetX;
      const activeTargetY = customer.moveWaypointY ?? customer.targetY;
      const moveDx = activeTargetX - customer.x;
      const moveDy = activeTargetY - customer.y;
      sprite.body.setPosition(customer.x, customer.y + bob);
      sprite.body.setRotation(Phaser.Math.Clamp(moveDx * 0.0022, -0.16, 0.16));
      sprite.bubble.setText(customer.requestIcon);
      sprite.label.setText(customer.label);
      sprite.shadow.fillAlpha = customer.stage === "service_in_progress" ? 0.26 : 0.18;
      sprite.shadow.scaleX = 1 + Math.min(0.18, Math.abs(moveDx) * 0.0018);
      sprite.shadow.scaleY = 1 + Math.min(0.1, Math.abs(moveDy) * 0.001);
      sprite.body.setDepth(customer.y);
      sprite.label.setAlpha(customer.patience < customer.maxPatience * 0.2 ? 0.9 : 0.55);
      const station = customer.stationId ? this.stationViews.get(customer.stationId) : null;
      if (station && customer.stage === "ready_for_finalization") {
        station.setScale(1 + Math.sin(this.time.now / 180) * 0.03);
      }
    }

    for (const [id, sprite] of this.customers.entries()) {
      if (seen.has(id)) continue;
      sprite.body.destroy();
      this.customers.delete(id);
    }

    this.sparkleGroup.getChildren().forEach((child) => {
      const text = child as Phaser.GameObjects.Text;
      text.y -= 26 * dt;
      text.alpha -= 0.95 * dt;
      if (text.alpha <= 0) {
        text.destroy();
      }
    });
  }

  spawnSparkle(x: number, y: number, label: string, color: string): void {
    const text = this.add
      .text(x, y - 24, label, {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "20px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.sparkleGroup.add(text);
  }
}
