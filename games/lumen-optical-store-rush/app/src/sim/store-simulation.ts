import { CUSTOMER_ARCHETYPES } from "../data/customers";
import { DAYS, ENDLESS_MODIFIERS } from "../data/days";
import { STATIONS } from "../data/stations";
import { SERVICE_DEFS } from "../data/services";
import { UPGRADES } from "../data/upgrades";
import type {
  ActiveTask,
  CampaignSave,
  CustomerArchetype,
  CustomerEntity,
  CustomerNeedStage,
  DayConfig,
  DayStats,
  EndlessModifier,
  ServiceDefinition,
  ServiceId,
  StationId,
  StationState,
  UpgradeDefinition,
  WorldSnapshot,
} from "../types";
import { DEFAULT_SAVE, loadSave, persistSave } from "./save";

const WALK_THRESHOLD = 10;
const INTERACT_RADIUS = 108;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function weightedPick<T extends string>(
  weights: Partial<Record<T, number>>,
  fallback: T,
): T {
  const entries = Object.entries(weights).filter((entry) => (entry[1] ?? 0) > 0) as Array<[T, number]>;
  if (!entries.length) {
    return fallback;
  }
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let target = Math.random() * total;
  for (const [key, value] of entries) {
    target -= value;
    if (target <= 0) {
      return key;
    }
  }
  return entries[entries.length - 1][0];
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createEmptyStats(): DayStats {
  return {
    money: 0,
    customersServed: 0,
    angryExits: 0,
    averageSatisfaction: 0,
    serviceCounts: {
      pickup: 0,
      adjustment: 0,
      frame_sale: 0,
      eye_exam: 0,
      lens_refill: 0,
      lens_training: 0,
      premium_consult: 0,
    },
    premiumSales: 0,
    examsCompleted: 0,
    quickServices: 0,
    frameSales: 0,
    stockouts: 0,
    vipSatisfied: false,
  };
}

interface StockState {
  frames: number;
  premium: number;
  lenses: number;
  restockedToday: boolean;
}

export class StoreSimulation {
  save: CampaignSave = { ...DEFAULT_SAVE };
  currentDay!: DayConfig;
  dayNumber = 1;
  endlessMode = false;
  endlessModifier: EndlessModifier | undefined;
  timeRemaining = 0;
  moneyToday = 0;
  playerX = 342;
  playerY = 420;
  message = "Bienvenida a Lumen Optical.";
  objectiveText = "";
  stations: StationState[] = [];
  customers = new Map<string, CustomerEntity>();
  stats: DayStats = createEmptyStats();
  currentPrompt: { label: string; targetId: string; targetType: "customer" | "station" } | null =
    null;
  nextGoal: { label: string; targetId: string; targetType: "customer" | "station" } | null =
    null;
  lastCustomerId = 0;
  nextSpawnAt = 14;
  activeAppointments = new Set<number>();
  stock: StockState = { frames: 5, premium: 2, lenses: 4, restockedToday: false };
  finishedDay = false;
  lastResults: DayStats | null = null;
  completedSatisfactionScores: number[] = [];

  constructor() {
    this.save = loadSave();
    this.currentDay = DAYS[0];
    this.buildStations(1);
  }

  resetSave(): void {
    this.save = { ...DEFAULT_SAVE };
    persistSave(this.save);
  }

  newCampaign(): void {
    this.save = { ...DEFAULT_SAVE };
    persistSave(this.save);
    this.startDay(1, false);
  }

  startContinue(): void {
    this.startDay(this.save.currentDay, false);
  }

  startEndless(): void {
    if (!this.save.endlessUnlocked) {
      this.message = "Endless mode se desbloquea tras dominar el Día 18.";
      return;
    }
    this.startDay(18, true);
  }

  startDay(dayNumber: number, endlessMode: boolean): void {
    this.dayNumber = clamp(dayNumber, 1, DAYS.length);
    this.currentDay = DAYS[this.dayNumber - 1];
    this.endlessMode = endlessMode;
    this.endlessModifier = endlessMode
      ? ENDLESS_MODIFIERS[(Date.now() / 1000) % ENDLESS_MODIFIERS.length | 0]
      : this.currentDay.eventModifier;
    this.timeRemaining = this.currentDay.durationSeconds;
    this.moneyToday = 0;
    this.finishedDay = false;
    this.customers.clear();
    this.stats = createEmptyStats();
    this.completedSatisfactionScores = [];
    this.message = `${this.currentDay.title}: ${this.currentDay.subtitle}`;
    this.objectiveText = this.getObjectiveText();
    this.activeAppointments.clear();
    this.lastCustomerId = 0;
    this.nextSpawnAt = this.dayNumber === 1 ? 8 : 12;
    this.playerX = 336;
    this.playerY = 376;
    this.stock = {
      frames: 5 + Math.floor(this.dayNumber / 5),
      premium: 1 + Math.floor(this.dayNumber / 6),
      lenses: 4 + Math.floor(this.dayNumber / 4),
      restockedToday: false,
    };
    this.buildStations(this.dayNumber);
  }

  buildStations(dayNumber: number): void {
    this.stations = STATIONS.map((station) => {
      const unlocked =
        !station.unlockDay || this.currentDay.unlocks.includes(station.id) || dayNumber >= station.unlockDay;
      return {
        ...station,
        unlocked,
        occupiedBy: null,
        boosted: this.getUpgradeTint(station.id) !== null,
      };
    });
  }

  getUpgradeTint(stationId: StationId): number | null {
    const matching = UPGRADES.find(
      (upgrade) =>
        this.save.purchasedUpgrades.includes(upgrade.id) &&
        upgrade.visual?.stationIds?.includes(stationId),
    );
    return matching?.visual?.highlightColor ?? null;
  }

  updatePlayerPosition(x: number, y: number): void {
    this.playerX = x;
    this.playerY = y;
    this.currentPrompt = this.findPrompt();
    this.nextGoal = this.findNextGoal();
  }

  update(deltaSec: number): void {
    if (this.finishedDay) {
      this.currentPrompt = this.findPrompt();
      this.nextGoal = this.findNextGoal();
      return;
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - deltaSec);

    this.updateCustomers(deltaSec);
    this.updateSpawns(deltaSec);

    if (this.timeRemaining <= 0) {
      this.forceDayClose();
    }

    this.stats.money = Math.round(this.moneyToday);
    this.stats.averageSatisfaction = this.computeAverageSatisfaction();
    this.objectiveText = this.getObjectiveText();
    this.currentPrompt = this.findPrompt();
    this.nextGoal = this.findNextGoal();
  }

  updateSpawns(deltaSec: number): void {
    if (this.customers.size >= this.currentDay.maxCustomers) {
      return;
    }

    for (const appointment of this.currentDay.guaranteedAppointments) {
      if (!this.activeAppointments.has(appointment.at) && this.timeElapsed() >= appointment.at) {
        this.activeAppointments.add(appointment.at);
        this.spawnCustomer(appointment.serviceId, appointment.archetypeId, true);
      }
    }

    const modifierMultiplier = this.endlessModifier?.spawnMultiplier ?? 1;
    this.nextSpawnAt -= deltaSec * modifierMultiplier;
    if (this.nextSpawnAt > 0) {
      return;
    }

    const serviceId = weightedPick(this.getWeightedServices(), "pickup");
    this.spawnCustomer(serviceId);
    this.nextSpawnAt = this.currentDay.spawnRate * (0.75 + Math.random() * 0.55);
  }

  timeElapsed(): number {
    return this.currentDay.durationSeconds - this.timeRemaining;
  }

  getWeightedServices(): Partial<Record<ServiceId, number>> {
    const weights = { ...this.currentDay.serviceWeights };
    if (this.endlessModifier?.serviceWeights) {
      for (const [serviceId, value] of Object.entries(this.endlessModifier.serviceWeights)) {
        weights[serviceId as ServiceId] = (weights[serviceId as ServiceId] ?? 0) + value;
      }
    }
    return weights;
  }

  getAvailableArchetypes(serviceId: ServiceId): CustomerArchetype[] {
    return CUSTOMER_ARCHETYPES.filter((archetype) => {
      if (serviceId === "premium_consult") {
        return ["fashion_hunter", "picky_professional", "vip_guest"].includes(archetype.id);
      }
      if (serviceId === "lens_training") {
        return ["first_timer", "friendly_neighbor", "patient_parent"].includes(archetype.id);
      }
      if (serviceId === "adjustment") {
        return ["senior_comfort", "friendly_neighbor", "office_rush"].includes(archetype.id);
      }
      return archetype.id !== "vip_guest";
    });
  }

  spawnCustomer(serviceId: ServiceId, forcedArchetypeId?: string, isAppointment = false): void {
    const candidates = this.getAvailableArchetypes(serviceId);
    const archetype =
      CUSTOMER_ARCHETYPES.find((item) => item.id === forcedArchetypeId) ??
      candidates[Math.floor(Math.random() * candidates.length)];
    this.lastCustomerId += 1;
    const service = SERVICE_DEFS[serviceId];
    const isVIP = archetype.temperament === "vip" || forcedArchetypeId === "vip_guest";
    const customer: CustomerEntity = {
      id: `c${this.lastCustomerId}`,
      label: isVIP ? "VIP Lumen" : archetype.label,
      archetypeId: archetype.id,
      temperament: archetype.temperament,
      serviceId,
      x: 184,
      y: 432 + (Math.random() * 40 - 20),
      targetX: 346,
      targetY: 334 + Math.random() * 72,
      stage: "entering",
      needStage: "triage",
      patience: archetype.patience + this.getPatienceBonus(),
      maxPatience: archetype.patience + this.getPatienceBonus(),
      satisfaction: 75 + archetype.bonusMood,
      speed: archetype.speed,
      color: archetype.color,
      requestIcon: service.icon,
      stationId: null,
      timerRemaining: 0,
      totalValue: Math.round(service.baseValue * archetype.spendMultiplier * this.getValueMultiplier(serviceId, false)),
      isAppointment,
      isVIP,
      paymentPending: false,
      upsellApplied: false,
      followupServiceId: undefined,
      statusText: isAppointment ? "Cita programada esperando triaje." : "Esperando triaje.",
    };
    this.setTravelTarget(customer, customer.targetX, customer.targetY);
    this.customers.set(customer.id, customer);
  }

  getPatienceBonus(): number {
    return this.save.purchasedUpgrades.reduce((sum, upgradeId) => {
      const upgrade = UPGRADES.find((item) => item.id === upgradeId);
      return sum + (upgrade?.effect.patienceBonus ?? 0);
    }, 0);
  }

  getTimerMultiplier(serviceId: ServiceId, stationId: StationId): number {
    return this.save.purchasedUpgrades.reduce((multiplier, upgradeId) => {
      const upgrade = UPGRADES.find((item) => item.id === upgradeId);
      if (!upgrade?.effect.timerMultiplier) {
        return multiplier;
      }
      if (
        upgrade.appliesTo === "all" ||
        upgrade.appliesTo === serviceId ||
        upgrade.appliesTo === stationId
      ) {
        return multiplier * upgrade.effect.timerMultiplier;
      }
      return multiplier;
    }, 1);
  }

  getValueMultiplier(serviceId: ServiceId, premiumApplied: boolean): number {
    return this.save.purchasedUpgrades.reduce((multiplier, upgradeId) => {
      const upgrade = UPGRADES.find((item) => item.id === upgradeId);
      if (!upgrade?.effect.valueMultiplier) {
        return multiplier;
      }
      if (
        upgrade.appliesTo === "all" ||
        upgrade.appliesTo === serviceId ||
        (premiumApplied && upgrade.category === "product")
      ) {
        return multiplier * upgrade.effect.valueMultiplier;
      }
      return multiplier;
    }, 1);
  }

  startAutoCheckout(customer: CustomerEntity): void {
    const checkout = this.getStation("checkout");
    if (!checkout || (checkout.occupiedBy && checkout.occupiedBy !== customer.id)) {
      customer.stage = "awaiting_checkout";
      customer.statusText = "Lista para cobrar.";
      customer.requestIcon = "💳";
      return;
    }
    checkout.occupiedBy = customer.id;
    customer.stage = "service_in_progress";
    customer.needStage = "checkout_auto";
    customer.timerRemaining = Math.round(
      4 * this.getTimerMultiplier("pickup", "checkout"),
    );
    customer.statusText = "La cajera está cobrando el pedido.";
    customer.requestIcon = "🪙";
  }

  tryAutoCheckoutQueue(): void {
    if (!this.hasCashierAssistant()) {
      return;
    }
    const checkout = this.getStation("checkout");
    if (!checkout || checkout.occupiedBy) {
      return;
    }
    const waitingCustomer = Array.from(this.customers.values()).find(
      (customer) =>
        customer.stationId === "checkout" && customer.stage === "awaiting_checkout",
    );
    if (waitingCustomer) {
      this.startAutoCheckout(waitingCustomer);
    }
  }

  updateCustomers(deltaSec: number): void {
    for (const customer of this.customers.values()) {
      this.moveEntity(customer, deltaSec);

      if (customer.timerRemaining > 0) {
        customer.timerRemaining = Math.max(0, customer.timerRemaining - deltaSec);
        if (customer.timerRemaining === 0) {
          if (customer.needStage === "checkout_auto") {
            const checkout = this.getStation("checkout");
            if (checkout?.occupiedBy === customer.id) {
              checkout.occupiedBy = null;
            }
            this.completeCheckout(customer);
          } else {
            customer.stage = "ready_for_finalization";
            customer.statusText = "Listo para rematar.";
            customer.requestIcon = "✅";
            this.message = `${customer.label} espera el remate final de ${SERVICE_DEFS[customer.serviceId].label}.`;
          }
        }
      }

      const patienceDrainMultiplier = this.endlessModifier?.patienceMultiplier ?? 1;
      const archetype = CUSTOMER_ARCHETYPES.find((item) => item.id === customer.archetypeId);
      const drainBase = archetype?.patienceDrain ?? 1;
      const passiveDrain =
        customer.stage === "service_in_progress"
          ? 0.14
          : customer.stage === "walking_to_station" || customer.stage === "walking_to_checkout"
            ? 0.22
            : 0.45;
      customer.patience = Math.max(0, customer.patience - deltaSec * passiveDrain * drainBase * patienceDrainMultiplier);
      if (customer.patience <= customer.maxPatience * 0.2) {
        customer.requestIcon = "⚠️";
      }

      if (
        customer.patience <= 0 &&
        customer.stage !== "walking_to_exit" &&
        customer.stage !== "complete" &&
        customer.stage !== "angry_exit"
      ) {
        this.failCustomer(customer, "Se marcha enfadado por la espera.");
      }
    }

    for (const [id, customer] of this.customers.entries()) {
      if (customer.stage === "complete" || customer.stage === "angry_exit") {
        this.customers.delete(id);
      }
    }

    this.tryAutoCheckoutQueue();
  }

  moveEntity(customer: CustomerEntity, deltaSec: number): void {
    const activeTargetX = customer.moveWaypointX ?? customer.targetX;
    const activeTargetY = customer.moveWaypointY ?? customer.targetY;
    const dx = activeTargetX - customer.x;
    const dy = activeTargetY - customer.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= WALK_THRESHOLD) {
      customer.x = activeTargetX;
      customer.y = activeTargetY;
      if (
        customer.moveWaypointX !== undefined &&
        customer.moveWaypointY !== undefined
      ) {
        customer.moveWaypointX = undefined;
        customer.moveWaypointY = undefined;
        return;
      }
      this.onArrival(customer);
      return;
    }
    const step = Math.min(distance, customer.speed * deltaSec);
    customer.x += (dx / distance) * step;
    customer.y += (dy / distance) * step;
  }

  onArrival(customer: CustomerEntity): void {
    if (customer.stage === "entering") {
      customer.stage = "queue_reception";
      customer.needStage = "triage";
      customer.statusText = customer.isAppointment ? "Cita esperando en recepción." : "Esperando atención en recepción.";
      customer.requestIcon = SERVICE_DEFS[customer.serviceId].icon;
      return;
    }

    if (customer.stage === "walking_to_station") {
      customer.stage = "waiting_station";
      customer.statusText =
        customer.stationId === "waiting_bench" && customer.needStage === "triage"
          ? "Esperando a que la llames."
          : "Lista para empezar.";
      if (customer.stationId === "waiting_bench" && customer.needStage === "triage") {
        customer.requestIcon = SERVICE_DEFS[customer.serviceId].icon;
      }
      return;
    }

    if (customer.stage === "walking_to_checkout") {
      if (this.hasCashierAssistant()) {
        this.startAutoCheckout(customer);
      } else {
        customer.stage = "awaiting_checkout";
        customer.statusText = "Lista para cobrar.";
        customer.requestIcon = "💳";
      }
      return;
    }

    if (customer.stage === "walking_to_exit") {
      customer.stage = customer.satisfaction >= 30 ? "complete" : "angry_exit";
    }
  }

  findPrompt():
    | { label: string; targetId: string; targetType: "customer" | "station" }
    | null {
    let bestDistance = INTERACT_RADIUS;
    let prompt: { label: string; targetId: string; targetType: "customer" | "station" } | null =
      null;

    for (const customer of this.customers.values()) {
      const distance = Math.hypot(customer.x - this.playerX, customer.y - this.playerY);
      if (distance > bestDistance) {
        continue;
      }
      const label = this.getCustomerPrompt(customer);
      if (!label) {
        continue;
      }
      bestDistance = distance;
      prompt = { label, targetId: customer.id, targetType: "customer" };
    }

    for (const station of this.stations) {
      if (!station.unlocked) {
        continue;
      }
      const distance = Math.hypot(station.x - this.playerX, station.y - this.playerY);
      if (distance > bestDistance) {
        continue;
      }
      const label = this.getStationPrompt(station.id);
      if (!label) {
        continue;
      }
      bestDistance = distance;
      prompt = { label, targetId: station.id, targetType: "station" };
    }

    return prompt;
  }

  findNextGoal():
    | { label: string; targetId: string; targetType: "customer" | "station" }
    | null {
    const actionableCustomers = Array.from(this.customers.values()).filter((customer) =>
      [
        "entering",
        "queue_reception",
        "awaiting_triage",
        "walking_to_station",
        "waiting_station",
        "ready_for_finalization",
        "walking_to_checkout",
        "awaiting_checkout",
      ].includes(customer.stage),
    );
    if (!actionableCustomers.length) {
      return null;
    }

    const stagePriority = (customer: CustomerEntity): number => {
      switch (customer.stage) {
        case "entering":
          return 2;
        case "ready_for_finalization":
          return 0;
        case "awaiting_checkout":
          return 1;
        case "queue_reception":
        case "awaiting_triage":
          return 3;
        case "walking_to_checkout":
          return 4;
        case "walking_to_station":
          return 5;
        case "waiting_station":
          return customer.stationId === "waiting_bench" ? 7 : 6;
        default:
          return 8;
      }
    };

    const target = actionableCustomers.sort((left, right) => {
      const priorityDiff = stagePriority(left) - stagePriority(right);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return (
        Math.hypot(left.x - this.playerX, left.y - this.playerY) -
        Math.hypot(right.x - this.playerX, right.y - this.playerY)
      );
    })[0];

    if (
      target.stage === "entering" ||
      target.stage === "queue_reception" ||
      target.stage === "awaiting_triage"
    ) {
      return {
        label: `Siguiente: atender a ${target.label} en recepción`,
        targetId: target.id,
        targetType: "customer",
      };
    }
    if (target.stage === "walking_to_checkout") {
      return {
        label: `Siguiente: prepárate para cobrar a ${target.label}`,
        targetId: "checkout",
        targetType: "station",
      };
    }
    if (target.stage === "awaiting_checkout") {
      return {
        label: `Siguiente: cobrar a ${target.label} en caja`,
        targetId: "checkout",
        targetType: "station",
      };
    }
    if (target.stationId) {
      const station = this.getStation(target.stationId);
      return {
        label:
          target.stationId === "waiting_bench" && target.needStage === "triage"
            ? `Siguiente: llama a ${target.label} desde la espera`
            :
          target.stage === "walking_to_station"
            ? `Siguiente: acompaña a ${target.label} a ${station?.label ?? target.stationId}`
            :
          target.stage === "ready_for_finalization"
            ? `Siguiente: rematar en ${station?.label ?? target.stationId}`
            : `Siguiente: ve a ${station?.label ?? target.stationId}`,
        targetId: target.stationId,
        targetType: "station",
      };
    }
    return null;
  }

  getCustomerPrompt(customer: CustomerEntity): string | null {
    if (customer.stage === "queue_reception" || customer.stage === "awaiting_triage") {
      return `Atender ${customer.label}`;
    }
    if (
      customer.stage === "waiting_station" &&
      customer.stationId === "waiting_bench" &&
      customer.needStage === "triage"
    ) {
      return `Llamar ${customer.label}`;
    }
    if (customer.stage === "ready_for_finalization") {
      return `Finalizar ${SERVICE_DEFS[customer.serviceId].label}`;
    }
    return null;
  }

  getStationPrompt(stationId: StationId): string | null {
    if (stationId === "waiting_bench" && this.dayNumber >= 2) {
      const receptionCustomer = this.getReceptionQueueCustomer();
      const bench = this.getStation("waiting_bench");
      if (receptionCustomer && !bench?.occupiedBy) {
        return "Mandar cliente a espera";
      }
      const seatedCustomer = Array.from(this.customers.values()).find(
        (customer) =>
          customer.stationId === "waiting_bench" &&
          customer.stage === "waiting_station" &&
          customer.needStage === "triage",
      );
      if (seatedCustomer) {
        return "Llamar cliente en espera";
      }
    }
    if (stationId === "stock_room" && this.dayNumber >= 18 && !this.stock.restockedToday) {
      return "Reponer stock";
    }
    const relevant = Array.from(this.customers.values()).find(
      (customer) => customer.stationId === stationId && (customer.stage === "waiting_station" || customer.stage === "ready_for_finalization" || customer.stage === "awaiting_checkout"),
    );
    if (!relevant) {
      return null;
    }
    if (relevant.stage === "awaiting_checkout") {
      return "Cobrar pedido";
    }
    if (relevant.stage === "ready_for_finalization") {
      return `Rematar ${SERVICE_DEFS[relevant.serviceId].label}`;
    }
    return `Iniciar ${SERVICE_DEFS[relevant.serviceId].label}`;
  }

  interact(): void {
    if (!this.currentPrompt) {
      return;
    }
    if (this.currentPrompt.targetType === "customer") {
      const customer = this.customers.get(this.currentPrompt.targetId);
      if (!customer) {
        return;
      }
      this.interactCustomer(customer);
      return;
    }
    this.interactStation(this.currentPrompt.targetId as StationId);
  }

  interactCustomer(customer: CustomerEntity): void {
    if (customer.stage === "queue_reception" || customer.stage === "awaiting_triage") {
      this.routeAfterTriage(customer);
      return;
    }
    if (
      customer.stage === "waiting_station" &&
      customer.stationId === "waiting_bench" &&
      customer.needStage === "triage"
    ) {
      this.routeAfterTriage(customer);
      return;
    }
    if (customer.stage === "ready_for_finalization") {
      this.finalizeService(customer);
    }
  }

  interactStation(stationId: StationId): void {
    if (stationId === "waiting_bench" && this.dayNumber >= 2) {
      const receptionCustomer = this.getReceptionQueueCustomer();
      const bench = this.getStation("waiting_bench");
      if (receptionCustomer && !bench?.occupiedBy) {
        this.assignToWaitingBench(receptionCustomer);
      } else {
        const seatedCustomer = Array.from(this.customers.values()).find(
          (customer) =>
            customer.stationId === "waiting_bench" &&
            customer.stage === "waiting_station" &&
            customer.needStage === "triage",
        );
        if (seatedCustomer) {
          this.routeAfterTriage(seatedCustomer);
        }
      }
      return;
    }
    if (stationId === "stock_room" && this.dayNumber >= 18 && !this.stock.restockedToday) {
      this.stock.frames += 3;
      this.stock.premium += 2;
      this.stock.lenses += 3;
      this.stock.restockedToday = true;
      this.message = "Stock repuesto desde la trastienda.";
      return;
    }
    const customer = Array.from(this.customers.values()).find(
      (item) => item.stationId === stationId && (item.stage === "waiting_station" || item.stage === "ready_for_finalization" || item.stage === "awaiting_checkout"),
    );
    if (!customer) {
      return;
    }
    if (customer.stage === "awaiting_checkout") {
      this.completeCheckout(customer);
      return;
    }
    if (customer.stage === "ready_for_finalization") {
      this.finalizeService(customer);
      return;
    }
    this.startServiceAtStation(customer, stationId);
  }

  routeAfterTriage(customer: CustomerEntity): void {
    switch (customer.serviceId) {
      case "pickup":
        this.assignToStation(customer, "pickup_shelf", "pickup_retrieve", "Ve a recogidas.");
        break;
      case "adjustment":
        this.assignToStation(
          customer,
          this.getStation("adjustment_bench")?.unlocked ? "adjustment_bench" : "mirror",
          "adjustment",
          this.getStation("adjustment_bench")?.unlocked
            ? "Dirigido al banco de ajustes."
            : "Pasa al espejo para un ajuste rápido.",
        );
        break;
      case "frame_sale":
        this.assignToStation(customer, "frame_wall", "frame_browse", "Pasa al mural de monturas.");
        break;
      case "eye_exam":
        this.assignToStation(customer, "exam_lane_1", "exam_start", "Pasa al gabinete de revisión.");
        break;
      case "lens_refill":
        this.assignToStation(customer, "lens_cabinet", "lens_refill", "Pasa al armario de lentillas.");
        break;
      case "lens_training":
        this.assignToStation(customer, "training_seat", "lens_training_start", "Vamos a la silla de entrenamiento.");
        break;
      case "premium_consult":
        this.assignToStation(customer, "premium_island", "premium_browse", "Te acompaño a la isla premium.");
        break;
    }
  }

  assignToStation(
    customer: CustomerEntity,
    stationId: StationId,
    needStage: CustomerNeedStage,
    message: string,
  ): void {
    if (customer.stationId === "waiting_bench") {
      const bench = this.getStation("waiting_bench");
      if (bench?.occupiedBy === customer.id) {
        bench.occupiedBy = null;
      }
    }
    const station = this.getStation(stationId);
    if (!station?.unlocked) {
      this.failCustomer(customer, "La zona aún no está disponible.");
      return;
    }
    customer.stationId = stationId;
    customer.needStage = needStage;
    customer.stage = "walking_to_station";
    this.setTravelTarget(customer, station.x, station.y + 58);
    customer.statusText = message;
    customer.requestIcon = station.icon;
    this.message = `${customer.label}: ${message}`;
  }

  getStation(stationId: StationId): StationState | undefined {
    return this.stations.find((station) => station.id === stationId);
  }

  getReceptionQueueCustomer(): CustomerEntity | undefined {
    return Array.from(this.customers.values()).find(
      (customer) =>
        customer.stage === "queue_reception" || customer.stage === "awaiting_triage",
    );
  }

  getRequiredUpgradeForNextDay(): UpgradeDefinition | null {
    if (
      this.save.currentDay === 2 &&
      !this.save.purchasedUpgrades.includes("ops_fast_checkout")
    ) {
      return UPGRADES.find((upgrade) => upgrade.id === "ops_fast_checkout") ?? null;
    }
    return null;
  }

  canStartNextDay(): boolean {
    return this.getRequiredUpgradeForNextDay() === null;
  }

  hasCashierAssistant(): boolean {
    return this.save.purchasedUpgrades.includes("ops_fast_checkout");
  }

  setTravelTarget(customer: CustomerEntity, targetX: number, targetY: number): void {
    customer.targetX = targetX;
    customer.targetY = targetY;
    customer.moveWaypointX = undefined;
    customer.moveWaypointY = undefined;

    const dx = targetX - customer.x;
    const dy = targetY - customer.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 120) {
      return;
    }

    const progress = 0.35 + Math.random() * 0.22;
    const offset = (Math.random() - 0.5) * Math.min(140, distance * 0.34);
    const perpX = (-dy / distance) * offset;
    const perpY = (dx / distance) * offset;
    customer.moveWaypointX = customer.x + dx * progress + perpX;
    customer.moveWaypointY = customer.y + dy * progress + perpY;
  }

  assignToWaitingBench(customer: CustomerEntity): void {
    const bench = this.getStation("waiting_bench");
    if (!bench?.unlocked || bench.occupiedBy) {
      return;
    }
    customer.stationId = "waiting_bench";
    customer.needStage = "triage";
    customer.stage = "walking_to_station";
    this.setTravelTarget(customer, bench.x, bench.y + 66);
    customer.statusText = "Espera sentada hasta que la llames.";
    customer.requestIcon = "🪑";
    bench.occupiedBy = customer.id;
    this.message = `${customer.label}: queda en espera hasta que la llames.`;
  }

  startServiceAtStation(customer: CustomerEntity, stationId: StationId): void {
    const service = SERVICE_DEFS[customer.serviceId];
    const station = this.getStation(stationId);
    if (!station) {
      return;
    }
    if (customer.serviceId === "pickup" && customer.needStage === "pickup_retrieve") {
      customer.needStage = Math.random() < 0.55 && this.dayNumber >= 10 ? "pickup_adjustment" : "checkout";
      customer.paymentPending = true;
      customer.satisfaction += 4;
      if (customer.needStage === "pickup_adjustment") {
        this.assignToStation(customer, "adjustment_bench", "pickup_adjustment", "Necesita un ajuste de fitting.");
      } else {
        this.sendToCheckout(customer, "Pedido listo para cobrar.");
      }
      this.message = `${customer.label}: pedido recuperado con éxito.`;
      return;
    }

    if (service.id === "lens_refill") {
      if (this.stock.lenses <= 0) {
        this.stats.stockouts += 1;
        customer.satisfaction -= 18;
        customer.totalValue = Math.round(customer.totalValue * 0.45);
        this.message = "Stock bajo de lentillas: venta reducida.";
      } else {
        this.stock.lenses -= 1;
      }
      customer.paymentPending = true;
      customer.satisfaction += 6;
      this.sendToCheckout(customer, "Pedido de lentillas preparado.");
      return;
    }

    if (service.id === "premium_consult" || service.id === "frame_sale") {
      const stage = service.id === "premium_consult" ? "premium_confirm" : "frame_confirm";
      station.occupiedBy = customer.id;
      customer.stage = "service_in_progress";
      customer.needStage = stage;
      customer.timerRemaining = Math.round(
        service.timerSeconds * this.getTimerMultiplier(customer.serviceId, stationId),
      );
      customer.statusText = "Probando opciones por su cuenta.";
      customer.requestIcon = "⏳";
      return;
    }

    if (service.id === "eye_exam") {
      station.occupiedBy = customer.id;
      customer.stage = "service_in_progress";
      customer.needStage = "exam_finalize";
      customer.timerRemaining = Math.round(
        service.timerSeconds * this.getTimerMultiplier(customer.serviceId, stationId),
      );
      customer.statusText = "Revisión en curso.";
      customer.requestIcon = "🩺";
      return;
    }

    if (service.id === "lens_training") {
      station.occupiedBy = customer.id;
      customer.stage = "service_in_progress";
      customer.needStage = "lens_training_finalize";
      customer.timerRemaining = Math.round(
        service.timerSeconds * this.getTimerMultiplier(customer.serviceId, stationId),
      );
      customer.statusText = "Entrenamiento de inserción en marcha.";
      customer.requestIcon = "💧";
      return;
    }

    if (service.id === "adjustment" || customer.needStage === "pickup_adjustment") {
      station.occupiedBy = customer.id;
      customer.stage = "service_in_progress";
      customer.needStage = customer.needStage === "pickup_adjustment" ? "pickup_adjustment" : "adjustment";
      customer.timerRemaining = Math.round(
        service.timerSeconds * this.getTimerMultiplier("adjustment", stationId),
      );
      customer.statusText = "Ajuste de montura en proceso.";
      customer.requestIcon = "🛠️";
    }
  }

  finalizeService(customer: CustomerEntity): void {
    const station = customer.stationId ? this.getStation(customer.stationId) : undefined;
    if (station) {
      station.occupiedBy = null;
    }

    switch (customer.needStage) {
      case "frame_confirm": {
        const premium = this.dayNumber >= 11 && (customer.temperament === "fashion" || customer.isVIP || Math.random() < 0.35);
        if (premium) {
          if (this.stock.premium <= 0) {
            this.stats.stockouts += 1;
            customer.totalValue = Math.round(customer.totalValue * 0.72);
            customer.satisfaction -= 12;
            this.message = "Colección premium agotada: se cierra con una opción estándar.";
          } else {
            this.stock.premium -= 1;
            customer.totalValue = Math.round(customer.totalValue * 1.28 * this.getValueMultiplier("premium_consult", true));
            customer.upsellApplied = true;
            this.stats.premiumSales += 1;
          }
        } else {
          if (this.stock.frames <= 0) {
            this.stats.stockouts += 1;
            customer.totalValue = Math.round(customer.totalValue * 0.6);
            customer.satisfaction -= 10;
          } else {
            this.stock.frames -= 1;
          }
        }
        customer.paymentPending = true;
        this.stats.frameSales += 1;
        customer.satisfaction += premium ? 10 : 8;
        this.sendToCheckout(customer, premium ? "Montura premium confirmada." : "Montura seleccionada.");
        break;
      }
      case "premium_confirm":
        customer.totalValue = Math.round(customer.totalValue * 1.18 * this.getValueMultiplier("premium_consult", true));
        customer.paymentPending = true;
        customer.upsellApplied = true;
        customer.satisfaction += 10;
        this.stats.premiumSales += 1;
        this.sendToCheckout(customer, "Colección premium lista para cobro.");
        break;
      case "exam_finalize": {
        customer.satisfaction += 10;
        this.stats.examsCompleted += 1;
        const followup = this.dayNumber >= 7 && Math.random() < 0.35 ? "lens_refill" : "frame_sale";
        customer.followupServiceId = followup;
        customer.serviceId = followup;
        customer.requestIcon = SERVICE_DEFS[followup].icon;
        if (followup === "lens_refill") {
          this.assignToStation(customer, "lens_cabinet", "lens_refill", "Prescripción lista: pasamos a lentillas.");
        } else {
          this.assignToStation(customer, "frame_wall", "frame_browse", "Prescripción lista: elegimos monturas.");
        }
        break;
      }
      case "lens_training_finalize":
        customer.paymentPending = true;
        customer.satisfaction += 12;
        this.sendToCheckout(customer, "Entrenamiento completado con confianza.");
        break;
      case "adjustment":
      case "pickup_adjustment":
        customer.paymentPending = true;
        customer.satisfaction += 9;
        this.stats.quickServices += 1;
        this.sendToCheckout(customer, "Ajuste terminado.");
        break;
      default:
        break;
    }
  }

  sendToCheckout(customer: CustomerEntity, message: string): void {
    const checkout = this.getStation("checkout");
    if (!checkout) {
      return;
    }
    customer.stationId = "checkout";
    customer.needStage = "checkout";
    customer.stage = "walking_to_checkout";
    this.setTravelTarget(customer, checkout.x, checkout.y + 56);
    customer.requestIcon = "💳";
    customer.statusText = message;
    this.message = `${customer.label}: ${message}`;
  }

  completeCheckout(customer: CustomerEntity): void {
    const baseValue = customer.totalValue;
    const patienceRatio = clamp(customer.patience / customer.maxPatience, 0, 1);
    const satisfaction = clamp(customer.satisfaction + patienceRatio * 18, 10, 100);
    customer.satisfaction = satisfaction;
    this.completedSatisfactionScores.push(satisfaction);
    this.moneyToday += baseValue;
    this.stats.customersServed += 1;
    this.stats.serviceCounts[customer.followupServiceId ?? customer.serviceId] += 1;
    if (customer.serviceId === "premium_consult" || customer.followupServiceId === "premium_consult") {
      this.stats.premiumSales += 1;
    }
    if (customer.serviceId === "frame_sale" || customer.followupServiceId === "frame_sale") {
      this.stats.frameSales += 1;
    }
    if (customer.serviceId === "adjustment") {
      this.stats.quickServices += 1;
    }
    if (customer.isVIP && satisfaction >= 84) {
      this.stats.vipSatisfied = true;
    }
    customer.statusText = "Sale contenta de la boutique.";
    customer.requestIcon = "💛";
    customer.stage = "walking_to_exit";
    this.setTravelTarget(customer, 188, 720);
    this.message = `Venta cerrada: +${baseValue}€ en ${customer.label}.`;
  }

  failCustomer(customer: CustomerEntity, message: string): void {
    if (customer.stationId === "waiting_bench") {
      const bench = this.getStation("waiting_bench");
      if (bench?.occupiedBy === customer.id) {
        bench.occupiedBy = null;
      }
    }
    customer.stage = "walking_to_exit";
    this.setTravelTarget(customer, 176, 710);
    customer.satisfaction = Math.max(0, customer.satisfaction - 35);
    customer.statusText = message;
    customer.requestIcon = "💢";
    this.stats.angryExits += 1;
    this.completedSatisfactionScores.push(22);
    this.message = `${customer.label}: ${message}`;
  }

  forceDayClose(): void {
    for (const customer of this.customers.values()) {
      if (customer.stage !== "complete" && customer.stage !== "angry_exit") {
        this.failCustomer(customer, "La tienda cierra antes de completar su servicio.");
      }
    }
    this.finishedDay = true;
    this.completeDay();
  }

  completeDay(): void {
    this.stats.money = Math.round(this.moneyToday);
    this.stats.averageSatisfaction = this.computeAverageSatisfaction();
    this.lastResults = { ...this.stats };
    this.save.totalCash += this.stats.money;
    this.save.reputation = clamp(
      Math.round(
        this.save.reputation + (this.stats.averageSatisfaction - 74) * 0.08 - this.stats.angryExits * 0.7,
      ),
      40,
      99,
    );
    this.save.lastDayResults = this.lastResults;
    if (!this.endlessMode) {
      const achievedStars = this.getStars();
      if (achievedStars >= 1) {
        this.save.highestDayUnlocked = Math.max(this.save.highestDayUnlocked, this.dayNumber + 1);
        this.save.currentDay = clamp(this.dayNumber + 1, 1, DAYS.length);
      }
      if (this.dayNumber >= 18 && achievedStars >= 2) {
        this.save.endlessUnlocked = true;
      }
    }
    persistSave(this.save);
  }

  computeAverageSatisfaction(): number {
    if (!this.completedSatisfactionScores.length) {
      return this.stats.angryExits > 0 ? Math.max(40, 100 - this.stats.angryExits * 18) : 100;
    }
    return Math.round(clamp(average(this.completedSatisfactionScores), 0, 100));
  }

  getStars(): number {
    if (!this.lastResults) {
      return 0;
    }
    let stars = 0;
    if (this.lastResults.money >= this.currentDay.revenueTarget) {
      stars += 1;
    }
    if (
      this.lastResults.averageSatisfaction >= this.currentDay.satisfactionTarget ||
      this.lastResults.customersServed >= this.currentDay.servedTarget
    ) {
      stars += 1;
    }
    if (this.isBonusComplete(this.lastResults)) {
      stars += 1;
    }
    return stars;
  }

  isBonusComplete(stats: DayStats): boolean {
    switch (this.currentDay.bonusType) {
      case "zero_angry":
        return stats.angryExits === 0;
      case "frame_sales":
        return stats.frameSales >= 2;
      case "quick_services":
        return stats.quickServices >= 3;
      case "exams":
        return stats.examsCompleted >= 2;
      case "appointments_on_time":
        return stats.examsCompleted >= 2 && stats.angryExits <= 1;
      case "diversity":
        return Object.values(stats.serviceCounts).filter((count) => count > 0).length >= 3;
      case "vip":
        return stats.vipSatisfied;
      case "satisfaction":
        return stats.averageSatisfaction >= this.currentDay.satisfactionTarget;
      case "stockout_free":
        return stats.stockouts === 0;
      default:
        return false;
    }
  }

  getObjectiveText(): string {
    const modifier = this.endlessModifier
      ? ` | ${this.endlessModifier.label}: ${this.endlessModifier.description}`
      : "";
    return `Objetivo: ${this.currentDay.revenueTarget}€ / ${this.currentDay.servedTarget} clientes / ${this.currentDay.satisfactionTarget}% sat. | Bonus: ${this.currentDay.bonusLabel}${modifier}`;
  }

  getAvailableUpgrades(): UpgradeDefinition[] {
    const requiredUpgrade = this.getRequiredUpgradeForNextDay();
    if (requiredUpgrade) {
      return [requiredUpgrade];
    }
    return UPGRADES.filter(
      (upgrade) =>
        upgrade.unlockDay <= this.save.highestDayUnlocked &&
        !this.save.purchasedUpgrades.includes(upgrade.id),
    )
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 4);
  }

  purchaseUpgrade(id: string): boolean {
    const upgrade = UPGRADES.find((item) => item.id === id);
    if (!upgrade || this.save.purchasedUpgrades.includes(id) || this.save.totalCash < upgrade.cost) {
      return false;
    }
    this.save.totalCash -= upgrade.cost;
    this.save.purchasedUpgrades.push(id);
    persistSave(this.save);
    this.message = `Nueva mejora instalada: ${upgrade.label}.`;
    return true;
  }

  getSnapshot(): WorldSnapshot {
    return {
      day: this.currentDay,
      dayNumber: this.dayNumber,
      endlessMode: this.endlessMode,
      modifier: this.endlessModifier,
      timeRemaining: this.timeRemaining,
      moneyToday: this.moneyToday,
      customers: Array.from(this.customers.values()),
      stations: this.stations,
      activeTasks: this.getActiveTasks(),
      stats: this.stats,
      save: this.save,
      message: this.message,
      objectiveText: this.objectiveText,
    };
  }

  getActiveTasks(): ActiveTask[] {
    return Array.from(this.customers.values())
      .filter((customer) => customer.timerRemaining > 0 || customer.stage === "ready_for_finalization")
      .map((customer) => ({
        customerId: customer.id,
        label: `${customer.label} · ${SERVICE_DEFS[customer.serviceId].label}`,
        stationId: customer.stationId ?? SERVICE_DEFS[customer.serviceId].primaryStation,
        remaining: customer.timerRemaining,
        stage: customer.needStage,
        critical: customer.patience <= customer.maxPatience * 0.25,
      }))
      .sort((a, b) => a.remaining - b.remaining);
  }

  getResultsSummary(): {
    stats: DayStats;
    stars: number;
    bonusComplete: boolean;
    availableUpgrades: UpgradeDefinition[];
  } {
    const stats = this.lastResults ?? this.stats;
    return {
      stats,
      stars: this.getStars(),
      bonusComplete: this.isBonusComplete(stats),
      availableUpgrades: this.getAvailableUpgrades(),
    };
  }
}
