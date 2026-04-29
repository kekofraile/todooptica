export type ServiceId =
  | "pickup"
  | "adjustment"
  | "frame_sale"
  | "eye_exam"
  | "lens_refill"
  | "lens_training"
  | "premium_consult";

export type StationId =
  | "entrance"
  | "reception"
  | "pickup_shelf"
  | "checkout"
  | "mirror"
  | "frame_wall"
  | "exam_lane_1"
  | "training_seat"
  | "lens_cabinet"
  | "adjustment_bench"
  | "premium_island"
  | "stock_room"
  | "waiting_bench";

export type CustomerTemperament =
  | "patient"
  | "rushed"
  | "picky"
  | "cheerful"
  | "elder"
  | "fashion"
  | "nervous"
  | "vip";

export type CustomerStage =
  | "entering"
  | "queue_reception"
  | "awaiting_triage"
  | "walking_to_station"
  | "waiting_station"
  | "service_in_progress"
  | "ready_for_finalization"
  | "walking_to_checkout"
  | "awaiting_checkout"
  | "walking_to_exit"
  | "complete"
  | "angry_exit";

export type CustomerNeedStage =
  | "triage"
  | "pickup_retrieve"
  | "pickup_adjustment"
  | "adjustment"
  | "frame_browse"
  | "frame_confirm"
  | "exam_start"
  | "exam_finalize"
  | "lens_refill"
  | "lens_training_start"
  | "lens_training_finalize"
  | "premium_browse"
  | "premium_confirm"
  | "checkout"
  | "checkout_auto";

export type DayBonusType =
  | "zero_angry"
  | "frame_sales"
  | "quick_services"
  | "exams"
  | "appointments_on_time"
  | "diversity"
  | "vip"
  | "satisfaction"
  | "stockout_free";

export interface StationDefinition {
  id: StationId;
  label: string;
  x: number;
  y: number;
  radius: number;
  unlockDay?: number;
  zone: "front" | "exam" | "lens" | "repair" | "premium" | "back";
  icon: string;
  tint: number;
}

export interface StationState extends StationDefinition {
  unlocked: boolean;
  occupiedBy: string | null;
  boosted: boolean;
}

export interface ServiceDefinition {
  id: ServiceId;
  label: string;
  icon: string;
  baseValue: number;
  patienceWeight: number;
  primaryStation: StationId;
  timerSeconds: number;
  description: string;
}

export interface CustomerArchetype {
  id: string;
  label: string;
  temperament: CustomerTemperament;
  speed: number;
  patience: number;
  spendMultiplier: number;
  patienceDrain: number;
  color: number;
  bonusMood: number;
}

export interface DayConfig {
  id: number;
  title: string;
  subtitle: string;
  durationSeconds: number;
  revenueTarget: number;
  servedTarget: number;
  satisfactionTarget: number;
  bonusType: DayBonusType;
  bonusLabel: string;
  maxCustomers: number;
  spawnRate: number;
  unlocks: StationId[];
  serviceWeights: Partial<Record<ServiceId, number>>;
  guaranteedAppointments: Array<{ at: number; serviceId: ServiceId; archetypeId: string }>;
  eventModifier?: EndlessModifier;
}

export interface EndlessModifier {
  id: string;
  label: string;
  description: string;
  spawnMultiplier: number;
  patienceMultiplier: number;
  serviceWeights?: Partial<Record<ServiceId, number>>;
}

export interface UpgradeDefinition {
  id: string;
  label: string;
  category: "operations" | "comfort" | "product" | "space" | "staff";
  description: string;
  cost: number;
  unlockDay: number;
  appliesTo?: ServiceId | StationId | "all";
  effect: {
    timerMultiplier?: number;
    patienceBonus?: number;
    valueMultiplier?: number;
    comfortBonus?: number;
  };
  visual?: {
    stationIds?: StationId[];
    highlightColor?: number;
  };
}

export interface ActiveTask {
  customerId: string;
  label: string;
  stationId: StationId;
  remaining: number;
  stage: CustomerNeedStage;
  critical: boolean;
}

export interface DayStats {
  money: number;
  customersServed: number;
  angryExits: number;
  averageSatisfaction: number;
  serviceCounts: Record<ServiceId, number>;
  premiumSales: number;
  examsCompleted: number;
  quickServices: number;
  frameSales: number;
  stockouts: number;
  vipSatisfied: boolean;
}

export interface CampaignSave {
  currentDay: number;
  highestDayUnlocked: number;
  totalCash: number;
  purchasedUpgrades: string[];
  endlessUnlocked: boolean;
  reputation: number;
  lastDayResults?: DayStats;
}

export interface CustomerEntity {
  id: string;
  label: string;
  archetypeId: string;
  temperament: CustomerTemperament;
  serviceId: ServiceId;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  stage: CustomerStage;
  needStage: CustomerNeedStage;
  patience: number;
  maxPatience: number;
  satisfaction: number;
  speed: number;
  color: number;
  requestIcon: string;
  stationId: StationId | null;
  timerRemaining: number;
  totalValue: number;
  isAppointment: boolean;
  isVIP: boolean;
  paymentPending: boolean;
  upsellApplied: boolean;
  followupServiceId?: ServiceId;
  statusText: string;
  moveWaypointX?: number;
  moveWaypointY?: number;
}

export interface WorldSnapshot {
  day: DayConfig;
  dayNumber: number;
  endlessMode: boolean;
  modifier?: EndlessModifier;
  timeRemaining: number;
  moneyToday: number;
  customers: CustomerEntity[];
  stations: StationState[];
  activeTasks: ActiveTask[];
  stats: DayStats;
  save: CampaignSave;
  message: string;
  objectiveText: string;
}
