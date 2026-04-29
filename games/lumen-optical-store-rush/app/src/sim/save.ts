import type { CampaignSave } from "../types";

const STORAGE_KEY = "lumen-optical-store-rush-save";

export const DEFAULT_SAVE: CampaignSave = {
  currentDay: 1,
  highestDayUnlocked: 1,
  totalCash: 0,
  purchasedUpgrades: [],
  endlessUnlocked: false,
  reputation: 72,
};

export function loadSave(): CampaignSave {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SAVE };
    }
    const parsed = JSON.parse(raw) as Partial<CampaignSave>;
    return {
      ...DEFAULT_SAVE,
      ...parsed,
      purchasedUpgrades: Array.isArray(parsed.purchasedUpgrades)
        ? parsed.purchasedUpgrades
        : [],
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function persistSave(save: CampaignSave): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

export function clearSave(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
