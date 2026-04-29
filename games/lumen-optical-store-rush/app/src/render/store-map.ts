import Phaser from "phaser";
import { PALETTE } from "./palette";
import type { StationState } from "../types";

function addSign(
  scene: Phaser.Scene,
  label: string,
  width: number,
  fill: number,
): Phaser.GameObjects.Container {
  const sign = scene.add.container(0, 0);
  const plate = scene.add.graphics();
  plate.fillStyle(0xffffff, 0.96);
  plate.fillRoundedRect(-width / 2 - 8, -20, width + 16, 40, 18);
  plate.lineStyle(4, PALETTE.outline, 0.22);
  plate.strokeRoundedRect(-width / 2 - 8, -20, width + 16, 40, 18);
  plate.fillStyle(fill, 1);
  plate.fillRoundedRect(-width / 2, -16, width, 32, 14);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "18px",
      color: "#fffaf0",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  sign.add([plate, text]);
  return sign;
}

function addMat(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: number,
): void {
  const mat = scene.add.graphics();
  mat.fillStyle(fill, 0.92);
  mat.fillRoundedRect(x - width / 2, y - height / 2, width, height, 18);
  mat.lineStyle(3, 0xffffff, 0.22);
  mat.strokeRoundedRect(x - width / 2 + 8, y - height / 2 + 8, width - 16, height - 16, 14);
  container.add(mat);
}

function drawFrames(scene: Phaser.Scene, parent: Phaser.GameObjects.Container): void {
  const glasses = [
    [-42, -8, 0xf36c3d],
    [0, -8, 0x79b3ef],
    [42, -8, 0x213452],
    [-42, 26, 0xd47d3b],
    [0, 26, 0x5577b4],
    [42, 26, 0x2f3a50],
  ];
  glasses.forEach(([x, y, tint]) => {
    const g = scene.add.graphics();
    g.lineStyle(4, tint as number, 1);
    g.strokeRoundedRect((x as number) - 16, (y as number) - 9, 26, 18, 8);
    g.strokeRoundedRect((x as number) + 6, (y as number) - 9, 26, 18, 8);
    g.lineBetween((x as number) + 10, y as number, (x as number) + 6, y as number);
    parent.add(g);
  });
}

function drawCabinetShelves(scene: Phaser.Scene, parent: Phaser.GameObjects.Container): void {
  const shelves = scene.add.graphics();
  shelves.fillStyle(0xb86928, 1);
  shelves.fillRoundedRect(-72, -58, 144, 116, 18);
  shelves.fillStyle(0xfff4df, 1);
  shelves.fillRoundedRect(-62, -48, 124, 96, 12);
  shelves.fillStyle(0xd1a160, 1);
  shelves.fillRoundedRect(-48, -30, 36, 24, 6);
  shelves.fillRoundedRect(-2, -30, 36, 24, 6);
  shelves.fillRoundedRect(44, -30, 36, 24, 6);
  shelves.fillRoundedRect(-48, 10, 36, 24, 6);
  shelves.fillRoundedRect(-2, 10, 36, 24, 6);
  shelves.fillRoundedRect(44, 10, 36, 24, 6);
  shelves.lineStyle(4, PALETTE.outline, 0.4);
  shelves.strokeRoundedRect(-72, -58, 144, 116, 18);
  parent.add(shelves);
}

function createStationVisual(
  scene: Phaser.Scene,
  station: StationState,
): Phaser.GameObjects.Container {
  const group = scene.add.container(station.x, station.y);
  const tint = station.boosted ? station.tint + 0x111111 : station.tint;
  const alpha = station.unlocked ? 1 : 0.26;
  const glow = scene.add.ellipse(0, 8, 152, 92, tint, station.unlocked ? 0.2 : 0.08);
  group.add(glow);

  const shadow = scene.add.ellipse(0, 34, 118, 28, 0x4c3419, 0.14);
  group.add(shadow);

  const furniture = scene.add.graphics();
  const label = scene.add
    .text(0, 58, station.label, {
      fontFamily: "Trebuchet MS, sans-serif",
      fontSize: "14px",
      color: station.unlocked ? "#20406c" : "#6e7782",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  label.setStroke("#fffaf1", 4);

  switch (station.id) {
    case "reception": {
      addMat(scene, group, 0, 32, 152, 60, PALETTE.rugBlue);
      furniture.fillStyle(PALETTE.wood, alpha);
      furniture.fillRoundedRect(-72, -10, 144, 42, 14);
      furniture.fillStyle(0xffe7b6, alpha);
      furniture.fillRoundedRect(-68, -14, 136, 28, 14);
      furniture.fillStyle(0x4a6a96, alpha);
      furniture.fillRoundedRect(-10, -6, 44, 22, 6);
      furniture.fillStyle(PALETTE.gold, alpha);
      furniture.fillCircle(-42, 4, 10);
      furniture.lineStyle(4, PALETTE.outline, 0.45 * alpha);
      furniture.strokeRoundedRect(-72, -10, 144, 42, 14);
      group.add(furniture);
      const sign = addSign(scene, "Recepción", 140, PALETTE.coral);
      sign.setPosition(0, -48);
      group.add(sign);
      break;
    }
    case "checkout": {
      addMat(scene, group, 0, 32, 170, 60, PALETTE.rugBlue);
      furniture.fillStyle(PALETTE.wood, alpha);
      furniture.fillRoundedRect(-78, -12, 156, 46, 14);
      furniture.fillStyle(0xffe5a0, alpha);
      furniture.fillRoundedRect(-84, -24, 168, 18, 12);
      furniture.fillStyle(0x355f97, alpha);
      furniture.fillRoundedRect(8, -4, 36, 22, 7);
      furniture.fillStyle(0xdbeeff, alpha);
      furniture.fillRoundedRect(-40, -2, 28, 18, 5);
      furniture.lineStyle(4, PALETTE.outline, 0.45 * alpha);
      furniture.strokeRoundedRect(-78, -12, 156, 46, 14);
      group.add(furniture);
      if (station.boosted) {
        const clerk = scene.add.graphics();
        clerk.fillStyle(0x2aa859, alpha);
        clerk.fillRoundedRect(24, -2, 26, 30, 10);
        clerk.fillStyle(PALETTE.peach, alpha);
        clerk.fillCircle(36, -12, 14);
        clerk.fillStyle(0x49bf67, alpha);
        clerk.fillRoundedRect(22, -26, 28, 10, 7);
        clerk.lineStyle(3, PALETTE.outline, 0.3 * alpha);
        clerk.strokeCircle(36, -12, 14);
        group.add(clerk);
      }
      const sign = addSign(scene, "Caja", 120, PALETTE.navy);
      sign.setPosition(0, -58);
      group.add(sign);
      break;
    }
    case "pickup_shelf": {
      furniture.fillStyle(0xc26f27, alpha);
      furniture.fillRoundedRect(-48, -32, 96, 76, 18);
      furniture.fillStyle(0xfff0d7, alpha);
      furniture.fillRoundedRect(-38, -22, 76, 56, 12);
      furniture.fillStyle(0xd8a75e, alpha);
      furniture.fillRoundedRect(-22, -12, 20, 16, 4);
      furniture.fillRoundedRect(8, -12, 20, 16, 4);
      furniture.fillRoundedRect(-22, 12, 20, 16, 4);
      furniture.fillRoundedRect(8, 12, 20, 16, 4);
      furniture.lineStyle(4, PALETTE.outline, 0.45 * alpha);
      furniture.strokeRoundedRect(-48, -32, 96, 76, 18);
      group.add(furniture);
      const sign = addSign(scene, "Recogidas", 132, PALETTE.gold);
      sign.setPosition(0, -62);
      group.add(sign);
      break;
    }
    case "frame_wall": {
      addMat(scene, group, 0, 18, 188, 108, PALETTE.rugGreen);
      furniture.fillStyle(0xffffff, alpha);
      furniture.fillRoundedRect(-86, -52, 172, 94, 20);
      furniture.lineStyle(5, PALETTE.outline, 0.3 * alpha);
      furniture.strokeRoundedRect(-86, -52, 172, 94, 20);
      furniture.fillStyle(0xe9f7ff, alpha);
      furniture.fillRoundedRect(-70, -24, 140, 40, 12);
      group.add(furniture);
      drawFrames(scene, group);
      const sign = addSign(scene, "Monturas", 120, PALETTE.coral);
      sign.setPosition(0, -82);
      group.add(sign);
      break;
    }
    case "exam_lane_1": {
      furniture.fillStyle(PALETTE.wood, alpha);
      furniture.fillRoundedRect(-72, -16, 144, 44, 14);
      furniture.fillStyle(0xfff7ea, alpha);
      furniture.fillRoundedRect(-54, -66, 108, 58, 18);
      furniture.fillStyle(0x5f90c5, alpha);
      furniture.fillRoundedRect(-26, -56, 52, 38, 12);
      furniture.fillStyle(0xd4efff, alpha);
      furniture.fillRoundedRect(-8, -48, 16, 20, 4);
      furniture.lineStyle(4, PALETTE.outline, 0.45 * alpha);
      furniture.strokeRoundedRect(-72, -16, 144, 44, 14);
      furniture.strokeRoundedRect(-54, -66, 108, 58, 18);
      group.add(furniture);
      const sign = addSign(scene, "Eye Exam", 146, PALETTE.coral);
      sign.setPosition(0, -98);
      group.add(sign);
      break;
    }
    case "waiting_bench": {
      furniture.fillStyle(0x3d7cc0, alpha);
      furniture.fillRoundedRect(-64, -14, 128, 42, 18);
      furniture.fillStyle(0x85c5ff, alpha);
      furniture.fillRoundedRect(-58, -30, 116, 24, 14);
      furniture.fillStyle(0xf4d17e, alpha);
      furniture.fillRoundedRect(-58, 10, 22, 16, 8);
      furniture.fillRoundedRect(36, 10, 22, 16, 8);
      furniture.lineStyle(4, PALETTE.outline, 0.42 * alpha);
      furniture.strokeRoundedRect(-64, -14, 128, 42, 18);
      group.add(furniture);
      break;
    }
    case "mirror": {
      furniture.fillStyle(0xbde8ff, alpha);
      furniture.fillRoundedRect(-26, -56, 52, 86, 20);
      furniture.fillStyle(0xf7fbff, alpha);
      furniture.fillRoundedRect(-18, -46, 36, 56, 14);
      furniture.fillStyle(PALETTE.wood, alpha);
      furniture.fillRoundedRect(-30, 22, 60, 14, 8);
      furniture.lineStyle(4, PALETTE.outline, 0.38 * alpha);
      furniture.strokeRoundedRect(-26, -56, 52, 86, 20);
      group.add(furniture);
      break;
    }
    case "lens_cabinet": {
      addMat(scene, group, 0, 32, 184, 68, PALETTE.rugBlue);
      furniture.fillStyle(0x2d9ad6, alpha);
      furniture.fillRoundedRect(-82, -10, 164, 40, 14);
      furniture.fillStyle(0xfff7ea, alpha);
      furniture.fillRoundedRect(-76, -54, 152, 36, 12);
      furniture.fillStyle(0x7cc8ff, alpha);
      furniture.fillRoundedRect(-24, -2, 28, 18, 5);
      furniture.fillRoundedRect(12, -2, 28, 18, 5);
      furniture.lineStyle(4, PALETTE.outline, 0.45 * alpha);
      furniture.strokeRoundedRect(-82, -10, 164, 40, 14);
      group.add(furniture);
      const sign = addSign(scene, "Contacts", 136, PALETTE.navy);
      sign.setPosition(0, -62);
      group.add(sign);
      break;
    }
    case "training_seat": {
      addMat(scene, group, 0, 32, 148, 60, PALETTE.rugBlue);
      furniture.fillStyle(0x4fb3e2, alpha);
      furniture.fillRoundedRect(-26, -12, 52, 48, 20);
      furniture.fillStyle(0xdff7ff, alpha);
      furniture.fillRoundedRect(-18, -24, 36, 18, 8);
      furniture.fillStyle(PALETTE.wood, alpha);
      furniture.fillRect(-4, 34, 8, 18);
      furniture.lineStyle(4, PALETTE.outline, 0.42 * alpha);
      furniture.strokeRoundedRect(-26, -12, 52, 48, 20);
      group.add(furniture);
      break;
    }
    case "adjustment_bench": {
      addMat(scene, group, 0, 32, 196, 80, PALETTE.rugOrange);
      furniture.fillStyle(0xc7772f, alpha);
      furniture.fillRoundedRect(-82, -10, 164, 44, 14);
      furniture.fillStyle(0xffefdd, alpha);
      furniture.fillRoundedRect(-24, -36, 48, 18, 8);
      furniture.lineStyle(6, 0x5a7aab, alpha);
      furniture.lineBetween(-16, -28, 20, 4);
      furniture.lineBetween(20, -28, -16, 4);
      furniture.lineStyle(4, PALETTE.outline, 0.42 * alpha);
      furniture.strokeRoundedRect(-82, -10, 164, 44, 14);
      group.add(furniture);
      break;
    }
    case "premium_island": {
      addMat(scene, group, 0, 26, 240, 86, PALETTE.rugOrange);
      furniture.fillStyle(0x2c95d8, alpha);
      furniture.fillRoundedRect(-94, -14, 188, 34, 16);
      furniture.fillStyle(0xffdb72, alpha);
      furniture.fillRoundedRect(-16, -24, 32, 20, 10);
      furniture.lineStyle(4, PALETTE.outline, 0.4 * alpha);
      furniture.strokeRoundedRect(-94, -14, 188, 34, 16);
      group.add(furniture);
      break;
    }
    case "stock_room": {
      drawCabinetShelves(scene, group);
      break;
    }
    case "entrance": {
      addMat(scene, group, 0, 16, 92, 110, PALETTE.rugGreen);
      furniture.fillStyle(0xe3f3ff, alpha);
      furniture.fillRoundedRect(-24, -44, 48, 86, 18);
      furniture.lineStyle(4, PALETTE.outline, 0.26 * alpha);
      furniture.strokeRoundedRect(-24, -44, 48, 86, 18);
      group.add(furniture);
      break;
    }
    default:
      furniture.fillStyle(tint, alpha);
      furniture.fillRoundedRect(-44, -30, 88, 60, 18);
      furniture.fillStyle(PALETTE.glass, alpha);
      furniture.fillRoundedRect(-34, -20, 68, 40, 12);
      furniture.lineStyle(4, PALETTE.outline, 0.4 * alpha);
      furniture.strokeRoundedRect(-44, -30, 88, 60, 18);
      group.add(furniture);
  }

  const iconPlate = scene.add.ellipse(0, -4, 42, 42, 0xffffff, station.unlocked ? 0.96 : 0.18);
  iconPlate.setStrokeStyle(3, PALETTE.outline, station.unlocked ? 0.22 : 0.08);
  const icon = scene.add.text(0, -5, station.icon, { fontSize: "22px" }).setOrigin(0.5);
  group.add([iconPlate, icon, label]);

  return group;
}

export function drawStoreMap(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  stations: StationState[],
): Map<string, Phaser.GameObjects.Container> {
  const stationViews = new Map<string, Phaser.GameObjects.Container>();
  container.removeAll(true);

  const background = scene.add.graphics();
  background.fillGradientStyle(PALETTE.bgTop, PALETTE.bgTop, PALETTE.bgBottom, PALETTE.bgBottom, 1);
  background.fillRect(0, 0, 1400, 900);

  background.fillStyle(0xfff1ce, 1);
  background.fillRoundedRect(68, 112, 1248, 648, 52);
  background.fillStyle(PALETTE.wallBlue, 1);
  background.fillRoundedRect(88, 128, 1208, 180, 28);
  background.fillStyle(PALETTE.wallBlueDeep, 0.22);
  for (let x = 96; x < 1280; x += 34) {
    background.fillRect(x, 136, 16, 164);
  }

  background.fillStyle(PALETTE.wood, 1);
  background.fillRect(80, 124, 1226, 14);
  background.fillRect(80, 300, 1226, 12);
  background.lineStyle(8, PALETTE.outline, 0.24);
  background.strokeRoundedRect(68, 112, 1248, 648, 52);

  background.fillStyle(PALETTE.floor, 1);
  background.fillRoundedRect(88, 308, 1208, 436, 28);
  background.lineStyle(2, PALETTE.floorAccent, 0.44);
  for (let x = 112; x < 1274; x += 66) {
    background.lineBetween(x, 320, x, 736);
  }
  for (let y = 338; y < 730; y += 56) {
    background.lineBetween(96, y, 1288, y);
  }
  container.add(background);

  addMat(scene, container, 356, 624, 264, 112, PALETTE.rugBlue);
  addMat(scene, container, 732, 608, 280, 106, PALETTE.rugOrange);
  addMat(scene, container, 1088, 604, 282, 116, PALETTE.rugOrange);
  addMat(scene, container, 1056, 436, 272, 102, PALETTE.rugBlue);
  addMat(scene, container, 584, 430, 220, 92, PALETTE.rugGreen);

  const decor = scene.add.graphics();
  decor.fillStyle(PALETTE.plant, 1);
  decor.fillCircle(118, 714, 28);
  decor.fillCircle(1278, 712, 28);
  decor.fillStyle(0xa1582a, 1);
  decor.fillRoundedRect(94, 724, 48, 20, 10);
  decor.fillRoundedRect(1254, 724, 48, 20, 10);
  decor.fillStyle(0xc07532, 1);
  decor.fillRoundedRect(1148, 172, 120, 122, 20);
  decor.fillRoundedRect(123, 184, 82, 82, 16);
  decor.lineStyle(4, PALETTE.outline, 0.28);
  decor.strokeRoundedRect(1148, 172, 120, 122, 20);
  decor.strokeRoundedRect(123, 184, 82, 82, 16);
  decor.fillStyle(0xffebc6, 1);
  decor.fillRoundedRect(1162, 188, 92, 92, 14);
  decor.fillRoundedRect(135, 196, 58, 58, 10);
  container.add(decor);

  for (const station of stations) {
    const group = createStationVisual(scene, station);
    group.setAlpha(station.unlocked ? 1 : 0.24);
    stationViews.set(station.id, group);
    container.add(group);
  }

  return stationViews;
}
