import type { DayConfig, EndlessModifier, ServiceId, StationId } from "../types";

const unlocksByDay: Record<number, StationId[]> = {
  1: ["entrance", "reception", "waiting_bench", "pickup_shelf", "checkout", "mirror", "frame_wall"],
  4: ["exam_lane_1"],
  7: ["lens_cabinet"],
  8: ["training_seat"],
  10: ["adjustment_bench"],
  13: ["premium_island"],
  18: ["stock_room"],
};

function weights(entries: Array<[ServiceId, number]>): Partial<Record<ServiceId, number>> {
  return Object.fromEntries(entries) as Partial<Record<ServiceId, number>>;
}

function cumulativeUnlocks(day: number): StationId[] {
  const result = new Set<StationId>();
  for (const [unlockDay, stationIds] of Object.entries(unlocksByDay)) {
    if (Number(unlockDay) <= day) {
      stationIds.forEach((stationId) => result.add(stationId));
    }
  }
  return Array.from(result);
}

function day(
  id: number,
  title: string,
  subtitle: string,
  revenueTarget: number,
  servedTarget: number,
  satisfactionTarget: number,
  durationSeconds: number,
  spawnRate: number,
  maxCustomers: number,
  bonusType: DayConfig["bonusType"],
  bonusLabel: string,
  serviceWeights: Partial<Record<ServiceId, number>>,
  guaranteedAppointments: DayConfig["guaranteedAppointments"] = [],
  eventModifier?: EndlessModifier,
): DayConfig {
  return {
    id,
    title,
    subtitle,
    revenueTarget,
    servedTarget,
    satisfactionTarget,
    durationSeconds,
    spawnRate,
    maxCustomers,
    bonusType,
    bonusLabel,
    serviceWeights,
    guaranteedAppointments,
    unlocks: cumulativeUnlocks(id),
    eventModifier,
  };
}

export const DAYS: DayConfig[] = [
  day(1, "Soft opening", "Solo recogidas y caja para aprender el circuito básico.", 120, 3, 82, 170, 18, 3, "zero_angry", "Cierra sin salidas enfadadas.", weights([["pickup", 6]])),
  day(2, "Caja asistida", "Contrata a la cajera de apoyo y empieza a usar el banco de espera.", 180, 5, 82, 195, 15.5, 5, "zero_angry", "No dejes escapar a nadie en esta primera tarde con cola.", weights([["pickup", 5]])),
  day(3, "Primeros ajustes", "Entra el ajuste rápido y la recepción pide más criterio.", 240, 7, 80, 210, 14, 6, "quick_services", "Completa 3 servicios rápidos sin colapsar la caja.", weights([["pickup", 4], ["adjustment", 3]])),
  day(4, "Exam opening", "Se abre el gabinete y nacen las tareas en paralelo.", 320, 8, 78, 230, 13, 6, "exams", "Completa 2 revisiones visuales.", weights([["pickup", 2], ["adjustment", 2], ["frame_sale", 3], ["eye_exam", 3]]), [{ at: 40, serviceId: "eye_exam", archetypeId: "first_timer" }]),
  day(5, "Appointments", "Citas programadas y tráfico mixto.", 380, 9, 79, 235, 12.5, 6, "appointments_on_time", "Mantén a tiempo las 2 citas del día.", weights([["pickup", 2], ["adjustment", 2], ["frame_sale", 2], ["eye_exam", 4]]), [{ at: 36, serviceId: "eye_exam", archetypeId: "office_rush" }, { at: 112, serviceId: "eye_exam", archetypeId: "friendly_neighbor" }]),
  day(6, "Saturday pulse", "Caja, recogidas y gabinete compiten a la vez.", 460, 11, 78, 245, 11.5, 7, "diversity", "Encadena revisión, recogida y monturas en un mismo día.", weights([["pickup", 3], ["adjustment", 2], ["frame_sale", 3], ["eye_exam", 3]])),
  day(7, "Lens cabinet", "Llegan lentillas y control de stock ligero.", 560, 12, 78, 250, 11, 7, "stockout_free", "Evita cualquier rotura de stock.", weights([["pickup", 2], ["adjustment", 2], ["frame_sale", 2], ["eye_exam", 2], ["lens_refill", 4]])),
  day(8, "First-time lenses", "Otro temporizador largo entra en juego.", 650, 12, 79, 255, 10.5, 7, "satisfaction", "Ningún entrenamiento puede entrar en rojo.", weights([["pickup", 2], ["adjustment", 1], ["frame_sale", 2], ["eye_exam", 2], ["lens_refill", 2], ["lens_training", 3]]), [{ at: 72, serviceId: "lens_training", archetypeId: "first_timer" }]),
  day(9, "Community day", "Seniors, familias y buen trato por encima de la velocidad.", 740, 13, 82, 260, 10.5, 8, "satisfaction", "Termina por encima del 84% de satisfacción.", weights([["pickup", 2], ["adjustment", 3], ["frame_sale", 2], ["eye_exam", 2], ["lens_refill", 2], ["lens_training", 1]])),
  day(10, "Repair corner", "La recogida y el ajuste se enlazan físicamente.", 850, 14, 80, 270, 10, 8, "quick_services", "Completa 3 ajustes y 3 recogidas.", weights([["pickup", 3], ["adjustment", 4], ["frame_sale", 2], ["eye_exam", 2], ["lens_refill", 2], ["lens_training", 1]])),
  day(11, "Premium touch", "Sube el ticket medio y la exigencia.", 980, 15, 80, 275, 9.6, 8, "frame_sales", "Cierra 2 ventas premium.", weights([["pickup", 2], ["adjustment", 2], ["frame_sale", 3], ["eye_exam", 2], ["lens_refill", 2], ["lens_training", 1], ["premium_consult", 2]])),
  day(12, "Operational wobble", "La tienda responde a una pequeña disrupción.", 1050, 15, 75, 280, 9.3, 8, "satisfaction", "Recupera la satisfacción por encima de 75%.", weights([["pickup", 3], ["adjustment", 2], ["frame_sale", 2], ["eye_exam", 2], ["lens_refill", 2], ["lens_training", 1], ["premium_consult", 1]]), [], {
    id: "delayed_pickups",
    label: "Pedidos retrasados",
    description: "Las recogidas tardan un poco más en completarse hoy.",
    spawnMultiplier: 1,
    patienceMultiplier: 0.96,
    serviceWeights: { pickup: 4 },
  }),
  day(13, "Store expansion", "Más espacio, más tránsito, más decisiones de ruta.", 1180, 15, 80, 285, 9, 9, "diversity", "Vende en tres familias distintas.", weights([["pickup", 2], ["adjustment", 2], ["frame_sale", 3], ["eye_exam", 2], ["lens_refill", 2], ["lens_training", 1], ["premium_consult", 2]])),
  day(14, "Flow support", "Se siente la mejora operativa del equipo.", 1300, 16, 81, 290, 8.7, 9, "zero_angry", "No permitas más de 2 clientes perdidos.", weights([["pickup", 2], ["adjustment", 3], ["frame_sale", 3], ["eye_exam", 2], ["lens_refill", 2], ["lens_training", 1], ["premium_consult", 2]])),
  day(15, "Seasonal campaign", "Semana temática con mezcla total de servicios.", 1450, 17, 82, 295, 8.4, 9, "diversity", "Cumple el reto de diversidad de servicios.", weights([["pickup", 2], ["adjustment", 2], ["frame_sale", 3], ["eye_exam", 3], ["lens_refill", 2], ["lens_training", 2], ["premium_consult", 2]])),
  day(16, "VIP visit", "Una clienta VIP altera tus prioridades.", 1600, 17, 82, 300, 8.2, 9, "vip", "Mantén contenta a la clienta VIP.", weights([["pickup", 2], ["adjustment", 2], ["frame_sale", 3], ["eye_exam", 3], ["lens_refill", 2], ["lens_training", 1], ["premium_consult", 3]]), [{ at: 96, serviceId: "premium_consult", archetypeId: "vip_guest" }]),
  day(17, "Peak mix", "Casi todo el catálogo vibra a la vez.", 1750, 20, 85, 310, 7.9, 10, "satisfaction", "Mantén la satisfacción por encima del 85%.", weights([["pickup", 2], ["adjustment", 3], ["frame_sale", 3], ["eye_exam", 3], ["lens_refill", 2], ["lens_training", 2], ["premium_consult", 2]])),
  day(18, "Grand mastery", "La tienda completa exige rutas limpias y temple.", 2000, 23, 90, 320, 7.5, 10, "satisfaction", "Supera el 90% y desbloquea endless limpio.", weights([["pickup", 2], ["adjustment", 3], ["frame_sale", 3], ["eye_exam", 3], ["lens_refill", 2], ["lens_training", 2], ["premium_consult", 3]])),
];

export const ENDLESS_MODIFIERS: EndlessModifier[] = [
  {
    id: "contacts_week",
    label: "Semana de lentillas",
    description: "Más pedidos de lentillas y algo menos de paciencia.",
    spawnMultiplier: 1.08,
    patienceMultiplier: 0.95,
    serviceWeights: { lens_refill: 5, lens_training: 3 },
  },
  {
    id: "repair_rush",
    label: "Repair rush",
    description: "Suben ajustes y pequeñas emergencias de comodidad.",
    spawnMultiplier: 1.12,
    patienceMultiplier: 0.98,
    serviceWeights: { adjustment: 5, pickup: 3 },
  },
  {
    id: "vip_afternoon",
    label: "VIP afternoon",
    description: "Más consultas premium en una tarde delicada.",
    spawnMultiplier: 1.04,
    patienceMultiplier: 0.92,
    serviceWeights: { premium_consult: 4, frame_sale: 4 },
  },
  {
    id: "school_season",
    label: "Back to school",
    description: "Revisiones y monturas a ritmo alto.",
    spawnMultiplier: 1.15,
    patienceMultiplier: 0.96,
    serviceWeights: { eye_exam: 4, frame_sale: 4 },
  },
];
