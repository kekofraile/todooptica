import type { StationDefinition } from "../types";

export const STATIONS: StationDefinition[] = [
  { id: "entrance", label: "Entrada", x: 196, y: 432, radius: 42, zone: "front", icon: "🚪", tint: 0xe0cda3 },
  { id: "reception", label: "Recepción", x: 360, y: 276, radius: 48, zone: "front", icon: "📋", tint: 0x1c5f66 },
  { id: "waiting_bench", label: "Banco de espera", x: 500, y: 192, radius: 52, zone: "front", icon: "🪑", tint: 0xc9795d },
  { id: "pickup_shelf", label: "Recogidas", x: 614, y: 284, radius: 48, zone: "front", icon: "📦", tint: 0xd8b874 },
  { id: "checkout", label: "Caja", x: 770, y: 282, radius: 48, zone: "front", icon: "💳", tint: 0x213452 },
  { id: "mirror", label: "Espejo", x: 818, y: 442, radius: 48, zone: "front", icon: "🪞", tint: 0x90d1c8 },
  { id: "frame_wall", label: "Mural de monturas", x: 578, y: 510, radius: 52, zone: "front", icon: "👓", tint: 0x0b9c4c },
  { id: "exam_lane_1", label: "Gabinete 1", x: 954, y: 250, radius: 56, unlockDay: 4, zone: "exam", icon: "👁️", tint: 0x345ca8 },
  { id: "training_seat", label: "Silla de lentillas", x: 950, y: 450, radius: 52, unlockDay: 8, zone: "lens", icon: "💧", tint: 0x58b8b3 },
  { id: "lens_cabinet", label: "Armario lentillas", x: 1128, y: 442, radius: 48, unlockDay: 7, zone: "lens", icon: "🫧", tint: 0x7cbeb6 },
  { id: "adjustment_bench", label: "Banco de ajustes", x: 1042, y: 612, radius: 54, unlockDay: 10, zone: "repair", icon: "🛠️", tint: 0xd07c62 },
  { id: "premium_island", label: "Premium & sol", x: 716, y: 608, radius: 52, unlockDay: 13, zone: "premium", icon: "✨", tint: 0xedb15d },
  { id: "stock_room", label: "Stock", x: 1218, y: 250, radius: 52, unlockDay: 18, zone: "back", icon: "📚", tint: 0x4d627c },
];
