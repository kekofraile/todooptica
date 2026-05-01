const shared = window.TodoOpticaEyeExplorer || {};

export const EYE_EXPLORER_PARTS = shared.PARTS || [];
export const EYE_EXPLORER_ANCHORS = shared.ANCHORS || {};
export const EYE_EXPLORER_STRINGS = shared.STRINGS || {};
export const EYE_EXPLORER_DEFAULT_PART_ID = shared.DEFAULT_PART_ID || "cornea";
export const EYE_EXPLORER_MAX_ANGLE = shared.MAX_ANGLE || 28;

export const createEyeExplorerController = (...args) => {
  if (typeof shared.createEyeExplorerController !== "function") return null;
  return shared.createEyeExplorerController(...args);
};
