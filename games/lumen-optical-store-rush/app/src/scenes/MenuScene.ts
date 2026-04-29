import Phaser from "phaser";
import type { GameController } from "../main";

export class MenuScene extends Phaser.Scene {
  controller!: GameController;

  constructor() {
    super("menu");
  }

  init(data: { controller: GameController }): void {
    this.controller = data.controller;
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#f7f0e2");
    this.add
      .text(700, 390, "Lumen Optical", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "50px",
        color: "#1b2f4b",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(700, 448, "Store Rush", {
        fontFamily: "Trebuchet MS, sans-serif",
        fontSize: "30px",
        color: "#4fa8a2",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
  }
}
