import * as THREE from "./vendor/three.module.min.js";
import {
  createEyeExplorerController,
  EYE_EXPLORER_PARTS as PARTS,
} from "./script-eye-explorer-core.js";

const TAU = Math.PI * 2;

const PART_ANCHOR_POSITIONS = {
  cornea: [-1.62, 0.36, 0.08],
  iris: [-1.07, 0.44, 0.12],
  pupil: [-1.04, 0.02, 0.16],
  lens: [-0.42, 0.24, 0.12],
  retina: [1.08, 0.45, 0.06],
  optic: [2.25, -0.22, -0.06],
  sclera: [0.02, 1.05, 0],
  vitreous: [0.28, 0.06, 0.18],
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toRad = (degrees) => (degrees * Math.PI) / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const createRng = (seed = 1) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const makeCanvasTexture = (canvas, options = {}) => {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = options.colorSpace ?? THREE.SRGBColorSpace;
  texture.wrapS = options.wrapS ?? THREE.ClampToEdgeWrapping;
  texture.wrapT = options.wrapT ?? THREE.ClampToEdgeWrapping;
  texture.anisotropy = options.anisotropy ?? 4;
  texture.needsUpdate = true;
  return texture;
};

const createEnvironmentTexture = () => {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, "#dce6f0");
  base.addColorStop(0.35, "#b9cad8");
  base.addColorStop(0.7, "#8ca0b2");
  base.addColorStop(1, "#5e6a76");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const upperSoftbox = ctx.createRadialGradient(
    width * 0.32,
    height * 0.18,
    20,
    width * 0.32,
    height * 0.18,
    width * 0.25,
  );
  upperSoftbox.addColorStop(0, "rgba(255, 255, 255, 0.9)");
  upperSoftbox.addColorStop(0.5, "rgba(248, 252, 255, 0.34)");
  upperSoftbox.addColorStop(1, "rgba(248, 252, 255, 0)");
  ctx.fillStyle = upperSoftbox;
  ctx.fillRect(0, 0, width, height);

  const sideSoftbox = ctx.createRadialGradient(
    width * 0.78,
    height * 0.38,
    20,
    width * 0.78,
    height * 0.38,
    width * 0.26,
  );
  sideSoftbox.addColorStop(0, "rgba(228, 239, 250, 0.78)");
  sideSoftbox.addColorStop(0.5, "rgba(216, 230, 244, 0.28)");
  sideSoftbox.addColorStop(1, "rgba(216, 230, 244, 0)");
  ctx.fillStyle = sideSoftbox;
  ctx.fillRect(0, 0, width, height);

  const warmBounce = ctx.createRadialGradient(
    width * 0.24,
    height * 0.88,
    20,
    width * 0.24,
    height * 0.88,
    width * 0.42,
  );
  warmBounce.addColorStop(0, "rgba(255, 226, 194, 0.62)");
  warmBounce.addColorStop(0.55, "rgba(255, 218, 182, 0.18)");
  warmBounce.addColorStop(1, "rgba(255, 218, 182, 0)");
  ctx.fillStyle = warmBounce;
  ctx.fillRect(0, 0, width, height);

  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    width * 0.16,
    width * 0.5,
    height * 0.5,
    width * 0.62,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(16, 22, 30, 0.32)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const texture = makeCanvasTexture(canvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
  });
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
};

const registerMaterialBaseEmissive = (material) => {
  if (!material || !material.userData) return;
  if (material.userData.baseEmissiveIntensity === undefined) {
    material.userData.baseEmissiveIntensity = material.emissiveIntensity || 0;
  }
};

const updateMeshEmissive = (material, isActive) => {
  if (!material || !("emissive" in material)) return;
  registerMaterialBaseEmissive(material);
  const base = material.userData.baseEmissiveIntensity || 0;
  material.emissiveIntensity = isActive ? base + 0.18 : base;
};

const createIrisMaps = ({ lowPowerMode = false } = {}) => {
  const size = lowPowerMode ? 512 : 1024;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorCtx = colorCanvas.getContext("2d");
  if (!colorCtx) return null;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext("2d");
  if (!bumpCtx) return null;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext("2d");
  if (!roughCtx) return null;

  const rng = createRng(93218);
  const cx = size / 2;
  const cy = size / 2;
  const pupilRadius = size * 0.112;
  const collaretteRadius = size * 0.208;
  const irisOuter = size * 0.472;

  const base = colorCtx.createRadialGradient(
    cx,
    cy,
    pupilRadius * 0.78,
    cx,
    cy,
    irisOuter,
  );
  base.addColorStop(0, "#3c3b36");
  base.addColorStop(0.18, "#6d5e45");
  base.addColorStop(0.35, "#618595");
  base.addColorStop(0.64, "#2f5f77");
  base.addColorStop(1, "#1f2d37");
  colorCtx.fillStyle = base;
  colorCtx.fillRect(0, 0, size, size);

  const vignetting = colorCtx.createRadialGradient(
    cx,
    cy,
    irisOuter * 0.52,
    cx,
    cy,
    irisOuter * 1.06,
  );
  vignetting.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignetting.addColorStop(1, "rgba(0, 0, 0, 0.26)");
  colorCtx.fillStyle = vignetting;
  colorCtx.fillRect(0, 0, size, size);

  bumpCtx.fillStyle = "#787878";
  bumpCtx.fillRect(0, 0, size, size);

  roughCtx.fillStyle = "#8f8f8f";
  roughCtx.fillRect(0, 0, size, size);

  const coarseFibers = lowPowerMode ? 900 : 1900;
  for (let i = 0; i < coarseFibers; i += 1) {
    const angle = (i / coarseFibers) * TAU + (rng() - 0.5) * 0.05;
    const inner = pupilRadius * lerp(0.92, 1.12, rng());
    const outer = irisOuter * lerp(0.8, 1.01, rng());
    const mid = lerp(inner, outer, 0.48 + rng() * 0.28);
    const bend = (rng() - 0.5) * 0.24;
    const hue = 164 + rng() * 44;
    const sat = 24 + rng() * 18;
    const light = 30 + rng() * 28;
    const alpha = 0.1 + rng() * 0.18;

    colorCtx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
    colorCtx.lineWidth = 0.35 + rng() * 1.35;
    colorCtx.beginPath();
    colorCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    colorCtx.quadraticCurveTo(
      cx + Math.cos(angle + bend) * mid,
      cy + Math.sin(angle + bend) * mid,
      cx + Math.cos(angle) * outer,
      cy + Math.sin(angle) * outer,
    );
    colorCtx.stroke();

    bumpCtx.strokeStyle = `rgba(255,255,255,${0.028 + rng() * 0.05})`;
    bumpCtx.lineWidth = 0.35 + rng() * 0.8;
    bumpCtx.beginPath();
    bumpCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    bumpCtx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    bumpCtx.stroke();
  }

  const fineFibers = lowPowerMode ? 1300 : 2800;
  for (let i = 0; i < fineFibers; i += 1) {
    const angle = rng() * TAU;
    const inner = lerp(pupilRadius * 1.03, collaretteRadius * 0.95, rng());
    const outer = lerp(collaretteRadius * 0.88, irisOuter * 0.98, rng());
    const curve = (rng() - 0.5) * 0.18;

    colorCtx.strokeStyle = `rgba(${110 + Math.floor(rng() * 80)}, ${
      145 + Math.floor(rng() * 60)
    }, ${150 + Math.floor(rng() * 70)}, ${0.03 + rng() * 0.09})`;
    colorCtx.lineWidth = 0.2 + rng() * 0.75;
    colorCtx.beginPath();
    colorCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    colorCtx.quadraticCurveTo(
      cx + Math.cos(angle + curve) * lerp(inner, outer, 0.55),
      cy + Math.sin(angle + curve) * lerp(inner, outer, 0.55),
      cx + Math.cos(angle) * outer,
      cy + Math.sin(angle) * outer,
    );
    colorCtx.stroke();
  }

  const crypts = lowPowerMode ? 120 : 260;
  for (let i = 0; i < crypts; i += 1) {
    const angle = rng() * TAU;
    const distance = lerp(
      collaretteRadius * 0.78,
      collaretteRadius * 1.12,
      rng(),
    );
    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;
    const radius = lerp(size * 0.0036, size * 0.011, rng());
    const alpha = 0.09 + rng() * 0.16;

    colorCtx.fillStyle = `rgba(16, 20, 18, ${alpha})`;
    colorCtx.beginPath();
    colorCtx.ellipse(x, y, radius * 1.2, radius, angle, 0, TAU);
    colorCtx.fill();

    roughCtx.fillStyle = `rgba(255,255,255,${0.03 + rng() * 0.05})`;
    roughCtx.beginPath();
    roughCtx.arc(x, y, radius, 0, TAU);
    roughCtx.fill();
  }

  const furrows = lowPowerMode ? 16 : 30;
  for (let i = 0; i < furrows; i += 1) {
    const radius = lerp(irisOuter * 0.77, irisOuter * 0.95, rng());
    const start = rng() * TAU;
    const span = lerp(0.5, 1.8, rng());
    colorCtx.strokeStyle = `rgba(30, 44, 53, ${0.1 + rng() * 0.17})`;
    colorCtx.lineWidth = 0.8 + rng() * 2.2;
    colorCtx.beginPath();
    colorCtx.arc(cx, cy, radius, start, start + span);
    colorCtx.stroke();

    bumpCtx.strokeStyle = `rgba(32,32,32,${0.06 + rng() * 0.12})`;
    bumpCtx.lineWidth = 0.7 + rng() * 1.7;
    bumpCtx.beginPath();
    bumpCtx.arc(cx, cy, radius, start, start + span);
    bumpCtx.stroke();
  }

  const flecks = lowPowerMode ? 220 : 460;
  for (let i = 0; i < flecks; i += 1) {
    const angle = rng() * TAU;
    const distance = lerp(pupilRadius * 1.08, irisOuter * 0.9, rng());
    const x = cx + Math.cos(angle) * distance;
    const y = cy + Math.sin(angle) * distance;
    const radius = lerp(0.45, 1.9, rng());

    colorCtx.fillStyle = `rgba(226, 186, 114, ${0.05 + rng() * 0.12})`;
    colorCtx.beginPath();
    colorCtx.arc(x, y, radius, 0, TAU);
    colorCtx.fill();
  }

  const collarette = colorCtx.createRadialGradient(
    cx,
    cy,
    collaretteRadius * 0.72,
    cx,
    cy,
    collaretteRadius * 1.08,
  );
  collarette.addColorStop(0, "rgba(249, 218, 164, 0.26)");
  collarette.addColorStop(1, "rgba(249, 223, 170, 0.02)");
  colorCtx.fillStyle = collarette;
  colorCtx.fillRect(0, 0, size, size);

  colorCtx.strokeStyle = "rgba(18, 24, 26, 0.64)";
  colorCtx.lineWidth = size * 0.017;
  colorCtx.beginPath();
  colorCtx.arc(cx, cy, irisOuter * 0.97, 0, TAU);
  colorCtx.stroke();

  colorCtx.strokeStyle = "rgba(20, 17, 14, 0.62)";
  colorCtx.lineWidth = size * 0.01;
  colorCtx.beginPath();
  colorCtx.arc(cx, cy, pupilRadius * 1.015, 0, TAU);
  colorCtx.stroke();

  colorCtx.fillStyle = "rgba(5, 10, 14, 0.94)";
  colorCtx.beginPath();
  colorCtx.arc(cx, cy, pupilRadius, 0, TAU);
  colorCtx.fill();

  bumpCtx.fillStyle = "rgba(42,42,42,0.66)";
  bumpCtx.beginPath();
  bumpCtx.arc(cx, cy, pupilRadius * 1.02, 0, TAU);
  bumpCtx.fill();

  const limbalDarken = roughCtx.createRadialGradient(
    cx,
    cy,
    irisOuter * 0.68,
    cx,
    cy,
    irisOuter,
  );
  limbalDarken.addColorStop(0, "rgba(0,0,0,0)");
  limbalDarken.addColorStop(1, "rgba(255,255,255,0.24)");
  roughCtx.fillStyle = limbalDarken;
  roughCtx.fillRect(0, 0, size, size);

  roughCtx.globalCompositeOperation = "multiply";
  roughCtx.fillStyle = "rgba(34, 34, 34, 0.24)";
  roughCtx.beginPath();
  roughCtx.arc(cx, cy, irisOuter * 0.96, 0, TAU);
  roughCtx.fill();

  const map = makeCanvasTexture(colorCanvas, {
    colorSpace: THREE.SRGBColorSpace,
    anisotropy: 8,
  });
  const bumpMap = makeCanvasTexture(bumpCanvas, {
    colorSpace: THREE.NoColorSpace,
    anisotropy: 8,
  });
  const roughnessMap = makeCanvasTexture(roughCanvas, {
    colorSpace: THREE.NoColorSpace,
    anisotropy: 8,
  });

  return { map, bumpMap, roughnessMap };
};

const createRetinaMaps = ({ lowPowerMode = false } = {}) => {
  const width = lowPowerMode ? 1024 : 1536;
  const height = Math.round(width / 2);
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext("2d");
  if (!ctx) return null;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext("2d");
  if (!bumpCtx) return null;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext("2d");
  if (!roughCtx) return null;

  const rng = createRng(41727);
  const base = ctx.createLinearGradient(0, 0, width, height * 0.08);
  base.addColorStop(0, "#7a2219");
  base.addColorStop(0.28, "#973328");
  base.addColorStop(0.62, "#be5541");
  base.addColorStop(1, "#d67456");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const bowlShade = ctx.createRadialGradient(
    width * 0.56,
    height * 0.5,
    width * 0.1,
    width * 0.56,
    height * 0.5,
    width * 0.64,
  );
  bowlShade.addColorStop(0, "rgba(255, 199, 163, 0.24)");
  bowlShade.addColorStop(0.46, "rgba(162, 57, 41, 0.05)");
  bowlShade.addColorStop(1, "rgba(50, 13, 11, 0.24)");
  ctx.fillStyle = bowlShade;
  ctx.fillRect(0, 0, width, height);

  const vesselBed = lowPowerMode ? 260 : 560;
  for (let i = 0; i < vesselBed; i += 1) {
    const y = rng() * height;
    const wave = rng() * TAU;
    const amp = lerp(2, 11, rng());
    ctx.strokeStyle = `rgba(120, 25, 22, ${0.035 + rng() * 0.08})`;
    ctx.lineWidth = 0.6 + rng() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += width / 14) {
      const yy =
        y + Math.sin((x / width) * TAU * lerp(1.6, 3.4, rng()) + wave) * amp;
      ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  const mottles = lowPowerMode ? 3400 : 7600;
  for (let i = 0; i < mottles; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    const r = lerp(0.45, 2.5, rng());
    ctx.fillStyle = `rgba(255, ${98 + Math.floor(rng() * 78)}, ${
      87 + Math.floor(rng() * 50)
    }, ${0.01 + rng() * 0.03})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  const bumpNoise = lowPowerMode ? 2600 : 5600;
  bumpCtx.fillStyle = "#757575";
  bumpCtx.fillRect(0, 0, width, height);
  for (let i = 0; i < bumpNoise; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    const r = lerp(0.6, 2.8, rng());
    const shade = Math.floor(120 + rng() * 30);
    bumpCtx.fillStyle = `rgba(${shade},${shade},${shade},${0.03 + rng() * 0.08})`;
    bumpCtx.beginPath();
    bumpCtx.arc(x, y, r, 0, TAU);
    bumpCtx.fill();
  }

  roughCtx.fillStyle = "#8f8f8f";
  roughCtx.fillRect(0, 0, width, height);

  const roughNoise = lowPowerMode ? 2000 : 4200;
  for (let i = 0; i < roughNoise; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    const r = lerp(0.5, 2.1, rng());
    const shade = Math.floor(130 + rng() * 55);
    roughCtx.fillStyle = `rgba(${shade},${shade},${shade},${0.02 + rng() * 0.08})`;
    roughCtx.beginPath();
    roughCtx.arc(x, y, r, 0, TAU);
    roughCtx.fill();
  }

  const discX = width * 0.93;
  const discY = height * 0.54;
  const maculaX = width * 0.77;
  const maculaY = height * 0.52;
  const discRadius = height * 0.062;

  const drawDisc = (xCenter) => {
    const disc = ctx.createRadialGradient(
      xCenter,
      discY,
      discRadius * 0.15,
      xCenter,
      discY,
      discRadius * 1.35,
    );
    disc.addColorStop(0, "rgba(255, 233, 199, 0.78)");
    disc.addColorStop(0.55, "rgba(245, 205, 164, 0.5)");
    disc.addColorStop(1, "rgba(205, 139, 108, 0.02)");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(xCenter, discY, discRadius * 1.4, 0, TAU);
    ctx.fill();

    const cup = ctx.createRadialGradient(
      xCenter + discRadius * 0.08,
      discY,
      discRadius * 0.04,
      xCenter + discRadius * 0.08,
      discY,
      discRadius * 0.6,
    );
    cup.addColorStop(0, "rgba(249, 219, 168, 0.34)");
    cup.addColorStop(1, "rgba(249, 219, 168, 0)");
    ctx.fillStyle = cup;
    ctx.beginPath();
    ctx.arc(xCenter + discRadius * 0.08, discY, discRadius * 0.66, 0, TAU);
    ctx.fill();

    bumpCtx.fillStyle = "rgba(182,182,182,0.52)";
    bumpCtx.beginPath();
    bumpCtx.arc(xCenter, discY, discRadius * 1.15, 0, TAU);
    bumpCtx.fill();

    roughCtx.fillStyle = "rgba(118,118,118,0.3)";
    roughCtx.beginPath();
    roughCtx.arc(xCenter, discY, discRadius * 1.04, 0, TAU);
    roughCtx.fill();
  };

  drawDisc(discX);

  const drawVesselTree = (
    originX,
    originY,
    dir,
    depth = 0,
    widthPx = 2.6,
    isArtery = true,
  ) => {
    if (depth > 4 || widthPx < 0.45) return;

    const segments = 2 + Math.floor(rng() * 2);
    let x = originX;
    let y = originY;
    let angle = dir;

    for (let i = 0; i < segments; i += 1) {
      const len = lerp(width * 0.035, width * 0.09, rng()) * (1 - depth * 0.12);
      const nextX = x + Math.cos(angle) * len;
      const nextY = y + Math.sin(angle) * len;
      const c1x = x + Math.cos(angle - 0.2) * len * 0.34;
      const c1y = y + Math.sin(angle - 0.2) * len * 0.34;
      const c2x = x + Math.cos(angle + 0.2) * len * 0.72;
      const c2y = y + Math.sin(angle + 0.2) * len * 0.72;

      const vesselColor = isArtery
        ? `rgba(230, 106, 86, ${0.3 - depth * 0.035})`
        : `rgba(170, 76, 82, ${0.26 - depth * 0.03})`;
      ctx.strokeStyle = vesselColor;
      ctx.lineWidth = widthPx;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, nextX, nextY);
      ctx.stroke();

      ctx.strokeStyle = `rgba(250, 186, 172, ${0.11 - depth * 0.01})`;
      ctx.lineWidth = Math.max(0.3, widthPx * 0.28);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, nextX, nextY);
      ctx.stroke();

      bumpCtx.strokeStyle = `rgba(208,208,208,${0.18 - depth * 0.018})`;
      bumpCtx.lineWidth = Math.max(0.3, widthPx * 0.58);
      bumpCtx.lineCap = "round";
      bumpCtx.beginPath();
      bumpCtx.moveTo(x, y);
      bumpCtx.bezierCurveTo(c1x, c1y, c2x, c2y, nextX, nextY);
      bumpCtx.stroke();

      roughCtx.strokeStyle = `rgba(112,112,112,${0.2 - depth * 0.022})`;
      roughCtx.lineWidth = Math.max(0.4, widthPx * 0.5);
      roughCtx.lineCap = "round";
      roughCtx.beginPath();
      roughCtx.moveTo(x, y);
      roughCtx.bezierCurveTo(c1x, c1y, c2x, c2y, nextX, nextY);
      roughCtx.stroke();

      if (rng() > 0.48) {
        const branchDir = angle + lerp(-0.74, 0.74, rng());
        drawVesselTree(
          lerp(x, nextX, 0.68),
          lerp(y, nextY, 0.68),
          branchDir,
          depth + 1,
          widthPx * lerp(0.56, 0.73, rng()),
          isArtery,
        );
      }

      x = nextX;
      y = nextY;
      angle += lerp(-0.34, 0.34, rng());
    }
  };

  const mainBranches = lowPowerMode ? 6 : 10;
  for (let i = 0; i < mainBranches; i += 1) {
    const spread = lerp(-0.95, 0.95, i / Math.max(1, mainBranches - 1));
    const isArtery = i % 2 === 0;
    drawVesselTree(
      discX - discRadius * 0.55,
      discY + spread * discRadius * 0.68,
      Math.PI + spread * 0.62,
      0,
      lowPowerMode ? 2.15 : 2.9,
      isArtery,
    );
  }

  const macula = ctx.createRadialGradient(
    maculaX,
    maculaY,
    discRadius * 0.35,
    maculaX,
    maculaY,
    discRadius * 2.1,
  );
  macula.addColorStop(0, "rgba(146, 38, 34, 0.44)");
  macula.addColorStop(1, "rgba(146, 38, 34, 0)");
  ctx.fillStyle = macula;
  ctx.beginPath();
  ctx.arc(maculaX, maculaY, discRadius * 2.2, 0, TAU);
  ctx.fill();

  const fovea = ctx.createRadialGradient(
    maculaX + discRadius * 0.08,
    maculaY,
    discRadius * 0.08,
    maculaX + discRadius * 0.08,
    maculaY,
    discRadius * 0.45,
  );
  fovea.addColorStop(0, "rgba(119, 23, 25, 0.52)");
  fovea.addColorStop(1, "rgba(119, 23, 25, 0)");
  ctx.fillStyle = fovea;
  ctx.beginPath();
  ctx.arc(maculaX + discRadius * 0.08, maculaY, discRadius * 0.48, 0, TAU);
  ctx.fill();

  const fovealReflex = ctx.createRadialGradient(
    maculaX - discRadius * 0.08,
    maculaY - discRadius * 0.04,
    discRadius * 0.02,
    maculaX - discRadius * 0.08,
    maculaY - discRadius * 0.04,
    discRadius * 0.18,
  );
  fovealReflex.addColorStop(0, "rgba(255, 212, 190, 0.35)");
  fovealReflex.addColorStop(1, "rgba(255, 212, 190, 0)");
  ctx.fillStyle = fovealReflex;
  ctx.beginPath();
  ctx.arc(
    maculaX - discRadius * 0.08,
    maculaY - discRadius * 0.04,
    discRadius * 0.2,
    0,
    TAU,
  );
  ctx.fill();

  roughCtx.globalCompositeOperation = "multiply";
  roughCtx.fillStyle = "rgba(118,118,118,0.26)";
  roughCtx.beginPath();
  roughCtx.arc(maculaX, maculaY, discRadius * 2, 0, TAU);
  roughCtx.fill();
  roughCtx.globalCompositeOperation = "source-over";

  const map = makeCanvasTexture(colorCanvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 8,
  });
  map.repeat.set(1, 1);

  const bumpMap = makeCanvasTexture(bumpCanvas, {
    colorSpace: THREE.NoColorSpace,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 8,
  });
  bumpMap.repeat.set(1, 1);

  const roughnessMap = makeCanvasTexture(roughCanvas, {
    colorSpace: THREE.NoColorSpace,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 8,
  });
  roughnessMap.repeat.set(1, 1);

  return { map, bumpMap, roughnessMap };
};

const createCorneaMaps = ({ lowPowerMode = false } = {}) => {
  const size = lowPowerMode ? 512 : 1024;
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext("2d");
  if (!bumpCtx) return null;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext("2d");
  if (!roughCtx) return null;

  const rng = createRng(25361);
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.49;

  bumpCtx.fillStyle = "#7f7f7f";
  bumpCtx.fillRect(0, 0, size, size);

  const stromalArcs = lowPowerMode ? 18 : 34;
  for (let i = 0; i < stromalArcs; i += 1) {
    const radius = lerp(outer * 0.26, outer * 0.94, rng());
    const start = rng() * TAU;
    const span = lerp(0.5, 2.1, rng());
    bumpCtx.strokeStyle = `rgba(255,255,255,${0.012 + rng() * 0.03})`;
    bumpCtx.lineWidth = 0.8 + rng() * 1.9;
    bumpCtx.beginPath();
    bumpCtx.arc(cx, cy, radius, start, start + span);
    bumpCtx.stroke();
  }

  const microSpecs = lowPowerMode ? 700 : 1800;
  for (let i = 0; i < microSpecs; i += 1) {
    const angle = rng() * TAU;
    const dist = Math.sqrt(rng()) * outer;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const rr = lerp(0.4, 1.3, rng());
    const shade = 120 + Math.floor(rng() * 36);
    bumpCtx.fillStyle = `rgba(${shade},${shade},${shade},${0.02 + rng() * 0.06})`;
    bumpCtx.beginPath();
    bumpCtx.arc(x, y, rr, 0, TAU);
    bumpCtx.fill();
  }

  roughCtx.fillStyle = "#6f6f6f";
  roughCtx.fillRect(0, 0, size, size);

  const tearGradient = roughCtx.createRadialGradient(
    cx - outer * 0.18,
    cy - outer * 0.22,
    outer * 0.04,
    cx - outer * 0.18,
    cy - outer * 0.22,
    outer * 0.82,
  );
  tearGradient.addColorStop(0, "rgba(70,70,70,0.36)");
  tearGradient.addColorStop(1, "rgba(70,70,70,0)");
  roughCtx.fillStyle = tearGradient;
  roughCtx.fillRect(0, 0, size, size);

  const limbalRough = roughCtx.createRadialGradient(
    cx,
    cy,
    outer * 0.72,
    cx,
    cy,
    outer,
  );
  limbalRough.addColorStop(0, "rgba(0,0,0,0)");
  limbalRough.addColorStop(1, "rgba(255,255,255,0.2)");
  roughCtx.fillStyle = limbalRough;
  roughCtx.fillRect(0, 0, size, size);

  const roughNoise = lowPowerMode ? 500 : 1200;
  for (let i = 0; i < roughNoise; i += 1) {
    const angle = rng() * TAU;
    const dist = Math.sqrt(rng()) * outer;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    roughCtx.fillStyle = `rgba(${90 + Math.floor(rng() * 40)}, ${
      90 + Math.floor(rng() * 40)
    }, ${90 + Math.floor(rng() * 40)}, ${0.015 + rng() * 0.05})`;
    roughCtx.beginPath();
    roughCtx.arc(x, y, lerp(0.35, 1.2, rng()), 0, TAU);
    roughCtx.fill();
  }

  return {
    bumpMap: makeCanvasTexture(bumpCanvas, {
      colorSpace: THREE.NoColorSpace,
      anisotropy: 8,
    }),
    roughnessMap: makeCanvasTexture(roughCanvas, {
      colorSpace: THREE.NoColorSpace,
      anisotropy: 8,
    }),
  };
};

const createScleraMaps = ({ lowPowerMode = false } = {}) => {
  const width = lowPowerMode ? 1024 : 1536;
  const height = Math.round(width / 2);
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext("2d");
  if (!ctx) return null;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = width;
  roughCanvas.height = height;
  const roughCtx = roughCanvas.getContext("2d");
  if (!roughCtx) return null;

  const rng = createRng(77123);
  const base = ctx.createLinearGradient(0, 0, width, 0);
  base.addColorStop(0, "#edf1ea");
  base.addColorStop(0.5, "#f7f9f4");
  base.addColorStop(1, "#ecefe7");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const limbusTint = (xCenter) => {
    const g = ctx.createRadialGradient(
      xCenter,
      height * 0.5,
      width * 0.01,
      xCenter,
      height * 0.5,
      width * 0.2,
    );
    g.addColorStop(0, "rgba(214, 206, 180, 0.3)");
    g.addColorStop(1, "rgba(214, 206, 180, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(xCenter - width * 0.2, 0, width * 0.4, height);
  };
  limbusTint(0);
  limbusTint(width);

  const vesselCount = lowPowerMode ? 68 : 124;
  for (let i = 0; i < vesselCount; i += 1) {
    const fromLeft = rng() > 0.5;
    const startX = fromLeft ? 0 : width;
    const startY = lerp(height * 0.08, height * 0.92, rng());
    const seg = lerp(width * 0.12, width * 0.3, rng());
    const angle = fromLeft
      ? lerp(-0.28, 0.28, rng())
      : Math.PI + lerp(-0.28, 0.28, rng());
    const endX = startX + Math.cos(angle) * seg;
    const endY = startY + Math.sin(angle) * seg + lerp(-24, 24, rng());
    const cpX = startX + Math.cos(angle) * seg * 0.52;
    const cpY = startY + Math.sin(angle + lerp(-0.35, 0.35, rng())) * seg * 0.5;

    ctx.strokeStyle = `rgba(182, 74, 74, ${0.05 + rng() * 0.12})`;
    ctx.lineWidth = 0.32 + rng() * 1.3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.stroke();

    roughCtx.strokeStyle = `rgba(255,255,255,${0.02 + rng() * 0.05})`;
    roughCtx.lineWidth = 0.6 + rng() * 0.8;
    roughCtx.beginPath();
    roughCtx.moveTo(startX, startY);
    roughCtx.quadraticCurveTo(cpX, cpY, endX, endY);
    roughCtx.stroke();
  }

  const speckles = lowPowerMode ? 1200 : 2600;
  for (let i = 0; i < speckles; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    const radius = lerp(0.4, 1.5, rng());
    const tone = Math.floor(235 + rng() * 16);

    ctx.fillStyle = `rgba(${tone}, ${tone}, ${tone - 4}, ${0.015 + rng() * 0.04})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    roughCtx.fillStyle = `rgba(255,255,255,${0.015 + rng() * 0.035})`;
    roughCtx.beginPath();
    roughCtx.arc(x, y, radius * 0.9, 0, TAU);
    roughCtx.fill();
  }

  roughCtx.globalCompositeOperation = "source-over";
  roughCtx.fillStyle = "#909090";
  roughCtx.fillRect(0, 0, width, height);
  roughCtx.globalCompositeOperation = "overlay";
  roughCtx.drawImage(colorCanvas, 0, 0, width, height);

  const map = makeCanvasTexture(colorCanvas, {
    colorSpace: THREE.SRGBColorSpace,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 8,
  });
  const roughnessMap = makeCanvasTexture(roughCanvas, {
    colorSpace: THREE.NoColorSpace,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 8,
  });
  const bumpMap = makeCanvasTexture(roughCanvas, {
    colorSpace: THREE.NoColorSpace,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    anisotropy: 8,
  });

  return { map, roughnessMap, bumpMap };
};

const createOpticNerveMaps = ({ lowPowerMode = false } = {}) => {
  const width = lowPowerMode ? 512 : 1024;
  const height = Math.round(width / 2);
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext("2d");
  if (!ctx) return null;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bumpCtx = bumpCanvas.getContext("2d");
  if (!bumpCtx) return null;

  const rng = createRng(61243);
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, "#a9923b");
  grad.addColorStop(0.3, "#cfb759");
  grad.addColorStop(0.64, "#dbc56b");
  grad.addColorStop(1, "#9f8d3d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  const fibers = lowPowerMode ? 72 : 156;
  for (let i = 0; i < fibers; i += 1) {
    const y = (i / fibers) * height + (rng() - 0.5) * 3.5;
    const phase = rng() * TAU;
    const wobble = 2 + rng() * 3.2;

    ctx.strokeStyle = `rgba(255, 241, 180, ${0.13 + rng() * 0.2})`;
    ctx.lineWidth = 0.6 + rng() * 1.05;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= width; x += width / 8) {
      const yWave = y + Math.sin((x / width) * TAU * 2.4 + phase) * wobble;
      ctx.lineTo(x, yWave);
    }
    ctx.stroke();

    bumpCtx.strokeStyle = `rgba(220,220,220,${0.1 + rng() * 0.16})`;
    bumpCtx.lineWidth = 0.5 + rng() * 0.8;
    bumpCtx.beginPath();
    bumpCtx.moveTo(0, y);
    for (let x = 0; x <= width; x += width / 8) {
      const yWave =
        y + Math.sin((x / width) * TAU * 2.1 + phase) * (wobble * 0.9);
      bumpCtx.lineTo(x, yWave);
    }
    bumpCtx.stroke();
  }

  const pores = lowPowerMode ? 340 : 760;
  for (let i = 0; i < pores; i += 1) {
    const x = rng() * width;
    const y = rng() * height;
    const radius = lerp(0.35, 1.3, rng());
    ctx.fillStyle = `rgba(142, 120, 52, ${0.05 + rng() * 0.08})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  bumpCtx.globalCompositeOperation = "source-over";
  bumpCtx.fillStyle = "rgba(122, 122, 122, 0.45)";
  bumpCtx.fillRect(0, 0, width, height);

  return {
    map: makeCanvasTexture(colorCanvas, {
      colorSpace: THREE.SRGBColorSpace,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      anisotropy: 8,
    }),
    bumpMap: makeCanvasTexture(bumpCanvas, {
      colorSpace: THREE.NoColorSpace,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping,
      anisotropy: 8,
    }),
  };
};

const createCorneaGeometry = ({ lowPowerMode = false, inner = false } = {}) => {
  const radius = inner ? 0.448 : 0.484;
  const widthSegments = lowPowerMode ? 42 : 72;
  const heightSegments = lowPowerMode ? 30 : 56;
  const geometry = new THREE.SphereGeometry(
    radius,
    widthSegments,
    heightSegments,
  );
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i);
    const radial = Math.hypot(vertex.y, vertex.z);
    const radialN = clamp(radial / radius, 0, 1);
    const centerWeight = Math.pow(1 - radialN, 1.5);
    const limbalBlend = smoothstep(0.62, 0.98, radialN);
    const meridionalWave =
      Math.sin(Math.atan2(vertex.z, vertex.y) * 4.2 + radialN * 8.5) * 0.0012;

    if (vertex.x < 0) {
      // Anterior corneal dome: steeper central curvature.
      vertex.x *= inner ? 1.05 : 1.12;
      vertex.x -= centerWeight * (inner ? 0.011 : 0.018);
    } else {
      // Posterior surface is flatter than anterior.
      vertex.x *= inner ? 0.58 : 0.64;
      vertex.x += centerWeight * (inner ? 0.001 : 0.002);
    }

    // Smooth transition near limbus to join sclera naturally.
    vertex.x += limbalBlend * (inner ? 0.03 : 0.042);
    vertex.x += meridionalWave * (inner ? 0.45 : 0.8);

    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
};

const createLensMaps = ({ lowPowerMode = false } = {}) => {
  const size = lowPowerMode ? 512 : 1024;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const colorCtx = colorCanvas.getContext("2d");
  if (!colorCtx) return null;

  const nucleusCanvas = document.createElement("canvas");
  nucleusCanvas.width = size;
  nucleusCanvas.height = size;
  const nucleusCtx = nucleusCanvas.getContext("2d");
  if (!nucleusCtx) return null;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bumpCtx = bumpCanvas.getContext("2d");
  if (!bumpCtx) return null;

  const roughCanvas = document.createElement("canvas");
  roughCanvas.width = size;
  roughCanvas.height = size;
  const roughCtx = roughCanvas.getContext("2d");
  if (!roughCtx) return null;

  const rng = createRng(51629);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.47;

  const capsuleGradient = colorCtx.createRadialGradient(
    cx,
    cy,
    radius * 0.18,
    cx,
    cy,
    radius,
  );
  capsuleGradient.addColorStop(0, "rgba(255, 241, 209, 0.82)");
  capsuleGradient.addColorStop(0.42, "rgba(241, 225, 173, 0.62)");
  capsuleGradient.addColorStop(0.76, "rgba(203, 188, 140, 0.34)");
  capsuleGradient.addColorStop(1, "rgba(186, 172, 132, 0.08)");
  colorCtx.fillStyle = capsuleGradient;
  colorCtx.fillRect(0, 0, size, size);

  const lamellae = lowPowerMode ? 24 : 42;
  for (let i = 0; i < lamellae; i += 1) {
    const t = i / Math.max(1, lamellae - 1);
    const ringRadius = lerp(radius * 0.24, radius * 0.98, t);
    const alpha = (1 - t) * 0.07 + rng() * 0.04;
    colorCtx.strokeStyle = `rgba(227, 211, 162, ${alpha})`;
    colorCtx.lineWidth = 1 + rng() * 1.8;
    colorCtx.beginPath();
    colorCtx.ellipse(
      cx,
      cy + (rng() - 0.5) * 2.6,
      ringRadius,
      ringRadius * lerp(0.74, 0.88, rng()),
      (rng() - 0.5) * 0.1,
      0,
      TAU,
    );
    colorCtx.stroke();

    bumpCtx.strokeStyle = `rgba(255,255,255,${0.015 + (1 - t) * 0.045})`;
    bumpCtx.lineWidth = 0.8 + rng() * 1.6;
    bumpCtx.beginPath();
    bumpCtx.ellipse(cx, cy, ringRadius, ringRadius * 0.8, 0, 0, TAU);
    bumpCtx.stroke();
  }

  const drawYSutures = (ctxTarget, color, alpha, lineWidth, invert = false) => {
    const orientation = invert ? -1 : 1;
    const armLength = radius * 0.36;
    const centerOffset = radius * 0.06;

    ctxTarget.strokeStyle = color.replace("{a}", String(alpha));
    ctxTarget.lineWidth = lineWidth;
    ctxTarget.lineCap = "round";
    ctxTarget.beginPath();
    ctxTarget.moveTo(cx, cy + centerOffset * orientation);
    for (let i = 0; i < 3; i += 1) {
      const angle = orientation * (-Math.PI / 2 + (i * TAU) / 3);
      ctxTarget.moveTo(cx, cy + centerOffset * orientation);
      ctxTarget.lineTo(
        cx + Math.cos(angle) * armLength,
        cy + centerOffset * orientation + Math.sin(angle) * armLength,
      );
    }
    ctxTarget.stroke();
  };

  drawYSutures(colorCtx, "rgba(229, 205, 150, {a})", 0.2, 2.2, false);
  drawYSutures(colorCtx, "rgba(183, 163, 122, {a})", 0.14, 1.8, true);
  drawYSutures(bumpCtx, "rgba(255,255,255,{a})", 0.08, 1.4, false);
  drawYSutures(bumpCtx, "rgba(40,40,40,{a})", 0.06, 1.2, true);

  const nucleusGradient = nucleusCtx.createRadialGradient(
    cx,
    cy,
    radius * 0.08,
    cx,
    cy,
    radius * 0.72,
  );
  nucleusGradient.addColorStop(0, "rgba(245, 209, 132, 0.78)");
  nucleusGradient.addColorStop(0.45, "rgba(224, 185, 109, 0.6)");
  nucleusGradient.addColorStop(1, "rgba(180, 148, 86, 0.22)");
  nucleusCtx.fillStyle = nucleusGradient;
  nucleusCtx.fillRect(0, 0, size, size);

  const nucleusNoise = lowPowerMode ? 260 : 620;
  for (let i = 0; i < nucleusNoise; i += 1) {
    const x = cx + (rng() - 0.5) * radius * 1.1;
    const y = cy + (rng() - 0.5) * radius * 1.1;
    const rr = lerp(0.4, 2, rng());
    nucleusCtx.fillStyle = `rgba(255, 214, 144, ${0.03 + rng() * 0.08})`;
    nucleusCtx.beginPath();
    nucleusCtx.arc(x, y, rr, 0, TAU);
    nucleusCtx.fill();
  }

  roughCtx.fillStyle = "#8c8c8c";
  roughCtx.fillRect(0, 0, size, size);
  const roughLamellae = lowPowerMode ? 36 : 80;
  for (let i = 0; i < roughLamellae; i += 1) {
    const ringRadius = lerp(radius * 0.2, radius * 0.97, rng());
    roughCtx.strokeStyle = `rgba(${130 + Math.floor(rng() * 40)}, ${
      130 + Math.floor(rng() * 40)
    }, ${130 + Math.floor(rng() * 40)}, ${0.04 + rng() * 0.11})`;
    roughCtx.lineWidth = 0.8 + rng() * 1.7;
    roughCtx.beginPath();
    roughCtx.ellipse(cx, cy, ringRadius, ringRadius * 0.82, 0, 0, TAU);
    roughCtx.stroke();
  }

  const smoothCenter = roughCtx.createRadialGradient(
    cx,
    cy,
    radius * 0.1,
    cx,
    cy,
    radius * 0.55,
  );
  smoothCenter.addColorStop(0, "rgba(70,70,70,0.32)");
  smoothCenter.addColorStop(1, "rgba(70,70,70,0)");
  roughCtx.fillStyle = smoothCenter;
  roughCtx.fillRect(0, 0, size, size);

  return {
    map: makeCanvasTexture(colorCanvas, {
      colorSpace: THREE.SRGBColorSpace,
      anisotropy: 8,
    }),
    nucleusMap: makeCanvasTexture(nucleusCanvas, {
      colorSpace: THREE.SRGBColorSpace,
      anisotropy: 8,
    }),
    bumpMap: makeCanvasTexture(bumpCanvas, {
      colorSpace: THREE.NoColorSpace,
      anisotropy: 8,
    }),
    roughnessMap: makeCanvasTexture(roughCanvas, {
      colorSpace: THREE.NoColorSpace,
      anisotropy: 8,
    }),
  };
};

const createLensGeometry = () => {
  const points = [];
  const steps = 72;
  const halfAxial = 0.35;
  for (let i = 0; i <= steps; i += 1) {
    const t = -1 + (i / steps) * 2;
    const absT = Math.abs(t);
    const hemispherePower = t < 0 ? 1.58 : 1.22;
    const equator = 0.063;
    const body =
      0.36 * Math.pow(Math.cos((absT * Math.PI) / 2), hemispherePower);
    const radial = equator + body;
    const y =
      t * halfAxial + (t < 0 ? -0.022 : 0.014) * Math.pow(1 - absT, 1.4);
    points.push(new THREE.Vector2(radial, y));
  }

  const geometry = new THREE.LatheGeometry(points, 96);
  geometry.rotateZ(Math.PI / 2);
  geometry.scale(0.74, 1, 1);
  geometry.computeVertexNormals();
  return geometry;
};

const createIrisRingGeometry = () => {
  const innerRadius = 0.158;
  const outerRadius = 0.468;
  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 256, 36);
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i);
    const r = Math.hypot(vertex.x, vertex.y);
    const theta = Math.atan2(vertex.y, vertex.x);
    const radial = smoothstep(innerRadius, outerRadius, r);

    const collaretteCenter = innerRadius + (outerRadius - innerRadius) * 0.24;
    const collarette =
      Math.exp(-Math.pow((r - collaretteCenter) / 0.03, 2)) * 0.0062;
    const sphincterRuff =
      Math.exp(-Math.pow((r - (innerRadius + 0.01)) / 0.02, 2)) * 0.0048;
    const ciliaryFolds =
      Math.sin(theta * 11 + radial * 17) * 0.0017 * (1 - radial * 0.5);
    const furrowRelief =
      Math.sin(theta * 24 - radial * 33) * 0.001 * smoothstep(0.55, 1, radial);
    const conicity =
      (1 - radial) * 0.0068 - smoothstep(0.62, 1, radial) * 0.0012;

    positions.setZ(
      i,
      conicity + collarette + sphincterRuff + ciliaryFolds + furrowRelief,
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.rotateY(Math.PI / 2);
  return geometry;
};

const addPartMesh = (partMeshes, partId, mesh) => {
  if (!partMeshes.has(partId)) partMeshes.set(partId, []);
  partMeshes.get(partId).push(mesh);
  mesh.userData.baseScale = mesh.scale.clone();

  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  materials.forEach(registerMaterialBaseEmissive);
};

export const setupEyeExplorer3D = async () => {
  const root = document.querySelector("[data-eye-explorer]");
  if (!root) return false;

  const controller = createEyeExplorerController(root);
  if (!controller) return false;

  const { canvas, rotateButtons, animateBtn, partButtons } = controller;
  const quizToggle = root.querySelector("[data-eye-quiz-toggle]");
  const forceHQ = Boolean(window.__eyeExplorerForceHighQuality);
  const lowPowerMode = Boolean(navigator.webdriver) && !forceHQ;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !lowPowerMode,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return false;
  }

  root.dataset.eyeRenderer = "3d";
  canvas.style.touchAction = "none";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  camera.position.set(0.18, 0.14, 5.32);
  camera.lookAt(0.08, 0, 0);

  renderer.localClippingEnabled = true;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = lowPowerMode ? 1.02 : 1.08;
  renderer.setClearColor(0x000000, 0);
  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTexture = createEnvironmentTexture();
  const envRenderTarget = envTexture
    ? pmremGenerator.fromEquirectangular(envTexture)
    : null;
  if (envTexture) envTexture.dispose();
  scene.environment = envRenderTarget?.texture || null;

  const sectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

  const materialOptions = (options = {}, clipped = true) => ({
    ...(clipped ? { clippingPlanes: [sectionPlane] } : {}),
    clipShadows: true,
    ...options,
  });

  const makeGlassMaterial = (options = {}, clipped = true) => {
    const materialConfig = {
      ...options,
      ...(options.transparent && options.depthWrite === undefined
        ? { depthWrite: false }
        : {}),
      side: options.side ?? THREE.DoubleSide,
      envMapIntensity: options.envMapIntensity ?? (lowPowerMode ? 0.62 : 1.24),
    };

    if (lowPowerMode) {
      return new THREE.MeshStandardMaterial(
        materialOptions(
          {
            color: materialConfig.color || 0xffffff,
            roughness: materialConfig.roughness ?? 0.2,
            metalness: 0,
            transparent: true,
            opacity: materialConfig.opacity ?? 0.35,
            depthWrite: materialConfig.depthWrite ?? false,
            side: materialConfig.side,
          },
          clipped,
        ),
      );
    }

    return new THREE.MeshPhysicalMaterial(
      materialOptions(
        {
          clearcoat: materialConfig.clearcoat ?? 0.12,
          clearcoatRoughness: materialConfig.clearcoatRoughness ?? 0.14,
          attenuationDistance: materialConfig.attenuationDistance ?? 1.8,
          attenuationColor:
            materialConfig.attenuationColor ??
            new THREE.Color(materialConfig.color || 0xffffff),
          ...materialConfig,
        },
        clipped,
      ),
    );
  };

  const makeClippedStandardMaterial = (options = {}) =>
    new THREE.MeshStandardMaterial(materialOptions(options, true));

  const makeInternalStandardMaterial = (options = {}) =>
    new THREE.MeshStandardMaterial(
      materialOptions(
        {
          side: options.side ?? THREE.DoubleSide,
          ...options,
        },
        false,
      ),
    );

  const makeInternalBasicMaterial = (options = {}) =>
    new THREE.MeshBasicMaterial({
      side: options.side ?? THREE.DoubleSide,
      depthWrite: options.depthWrite ?? false,
      ...options,
    });

  const hemiLight = new THREE.HemisphereLight(0xd4e6f7, 0x1f2025, 0.5);
  const ambient = new THREE.AmbientLight(0xffffff, 0.22);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.42);
  keyLight.position.set(-3.4, 2.9, 4.6);

  const fillLight = new THREE.DirectionalLight(0xbed7f5, 0.48);
  fillLight.position.set(3.6, 1.3, 3.8);

  const rimLight = new THREE.DirectionalLight(0xaecdee, 0.68);
  rimLight.position.set(3.4, 0.9, -5.4);

  const warmLight = new THREE.PointLight(0xffc690, 0.26, 18);
  warmLight.position.set(-1.8, -1.25, 2.3);

  scene.add(hemiLight, ambient, keyLight, fillLight, rimLight, warmLight);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.1, 56),
    new THREE.MeshBasicMaterial({
      color: 0x0a1014,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -1.42, 0.16);
  shadow.scale.set(1, 0.56, 1);
  scene.add(shadow);

  const eyeRig = new THREE.Group();
  eyeRig.scale.set(0.98, 0.98, 0.98);
  eyeRig.position.set(0.16, 0.02, 0.02);
  scene.add(eyeRig);

  const partMeshes = new Map();
  const anchors = new Map();

  const textureOptions = { lowPowerMode };
  const corneaMaps = createCorneaMaps(textureOptions);
  const scleraMaps = createScleraMaps(textureOptions);
  const retinaMaps = createRetinaMaps(textureOptions);
  const irisMaps = createIrisMaps(textureOptions);
  const lensMaps = createLensMaps(textureOptions);
  const opticNerveMaps = createOpticNerveMaps(textureOptions);

  const scleraOuter = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 72, 72),
    makeClippedStandardMaterial({
      color: 0xf1f3ee,
      map: scleraMaps?.map || null,
      roughnessMap: scleraMaps?.roughnessMap || null,
      bumpMap: scleraMaps?.bumpMap || null,
      bumpScale: 0.014,
      roughness: 0.74,
      metalness: 0,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      side: THREE.DoubleSide,
      emissive: 0x14100d,
      emissiveIntensity: 0.01,
    }),
  );
  scleraOuter.scale.set(1.12, 1, 1);
  scleraOuter.renderOrder = 3;
  eyeRig.add(scleraOuter);
  addPartMesh(partMeshes, "sclera", scleraOuter);

  const scleraInner = new THREE.Mesh(
    new THREE.SphereGeometry(1.39, 72, 72),
    makeClippedStandardMaterial({
      color: 0xe2e6e0,
      roughness: 0.88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      emissive: 0x110f0d,
      emissiveIntensity: 0.005,
    }),
  );
  scleraInner.scale.set(1.12, 1, 1);
  scleraInner.renderOrder = 2;
  eyeRig.add(scleraInner);
  addPartMesh(partMeshes, "sclera", scleraInner);

  const choroid = new THREE.Mesh(
    new THREE.SphereGeometry(1.345, 96, 96),
    makeClippedStandardMaterial({
      color: 0x71231b,
      roughness: 0.8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      emissive: 0x1d0806,
      emissiveIntensity: 0.02,
    }),
  );
  choroid.scale.set(1.1, 0.96, 0.96);
  choroid.renderOrder = 1;
  eyeRig.add(choroid);
  addPartMesh(partMeshes, "retina", choroid);

  const retina = new THREE.Mesh(
    new THREE.SphereGeometry(1.315, 72, 72),
    makeClippedStandardMaterial({
      color: 0xce614a,
      map: retinaMaps?.map || null,
      bumpMap: retinaMaps?.bumpMap || null,
      roughnessMap: retinaMaps?.roughnessMap || null,
      bumpScale: 0.043,
      roughness: 0.72,
      side: THREE.DoubleSide,
      emissive: 0x2f100b,
      emissiveIntensity: 0.03,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    }),
  );
  retina.scale.set(1.095, 0.955, 0.955);
  retina.renderOrder = 1;
  eyeRig.add(retina);
  addPartMesh(partMeshes, "retina", retina);

  const vitreous = new THREE.Mesh(
    new THREE.SphereGeometry(1.24, 64, 64),
    makeGlassMaterial(
      {
        color: 0xe9f6fc,
        roughness: 0.018,
        transmission: 0.98,
        thickness: 1.08,
        ior: 1.335,
        transparent: true,
        opacity: 0.035,
      },
      false,
    ),
  );
  vitreous.scale.set(1.09, 0.94, 0.94);
  vitreous.renderOrder = 4;
  eyeRig.add(vitreous);
  addPartMesh(partMeshes, "vitreous", vitreous);

  const vitreousCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.02, 42, 42),
    makeGlassMaterial(
      {
        color: 0xd8e8f2,
        roughness: 0.03,
        transmission: 0.88,
        thickness: 0.64,
        ior: 1.34,
        transparent: true,
        opacity: 0.02,
      },
      false,
    ),
  );
  vitreousCore.scale.set(1.03, 0.9, 0.9);
  vitreousCore.position.set(0.16, 0, -0.02);
  vitreousCore.renderOrder = 4;
  eyeRig.add(vitreousCore);
  addPartMesh(partMeshes, "vitreous", vitreousCore);

  const cornea = new THREE.Mesh(
    createCorneaGeometry({ lowPowerMode }),
    makeGlassMaterial(
      {
        color: 0xe3f1fa,
        bumpMap: corneaMaps?.bumpMap || null,
        roughnessMap: corneaMaps?.roughnessMap || null,
        bumpScale: 0.0038,
        roughness: 0.006,
        transmission: 0.99,
        thickness: 0.5,
        ior: 1.376,
        clearcoat: 1,
        clearcoatRoughness: 0.012,
        attenuationDistance: 1.24,
        attenuationColor: new THREE.Color(0xe6f5ff),
        transparent: true,
        opacity: 0.48,
        envMapIntensity: lowPowerMode ? 0.7 : 1.56,
      },
      false,
    ),
  );
  cornea.position.set(-1.58, 0, 0);
  cornea.scale.set(0.95, 0.79, 0.79);
  cornea.renderOrder = 6;
  eyeRig.add(cornea);
  addPartMesh(partMeshes, "cornea", cornea);

  const corneaEndothelium = new THREE.Mesh(
    createCorneaGeometry({ lowPowerMode, inner: true }),
    makeGlassMaterial(
      {
        color: 0xd6e9f3,
        roughness: 0.014,
        transmission: 0.95,
        thickness: 0.16,
        ior: 1.336,
        clearcoat: 0.34,
        clearcoatRoughness: 0.08,
        attenuationDistance: 0.74,
        attenuationColor: new THREE.Color(0xd9ebf4),
        transparent: true,
        opacity: 0.26,
        envMapIntensity: lowPowerMode ? 0.45 : 1.08,
      },
      false,
    ),
  );
  corneaEndothelium.position.set(-1.49, 0, 0);
  corneaEndothelium.scale.set(0.91, 0.74, 0.74);
  corneaEndothelium.renderOrder = 6;
  eyeRig.add(corneaEndothelium);
  addPartMesh(partMeshes, "cornea", corneaEndothelium);

  const tearFilm = new THREE.Mesh(
    createCorneaGeometry({ lowPowerMode }),
    makeGlassMaterial(
      {
        color: 0xf5fbff,
        roughness: 0.003,
        transmission: 1,
        thickness: 0.08,
        ior: 1.336,
        clearcoat: 1,
        clearcoatRoughness: 0.006,
        transparent: true,
        opacity: 0.16,
        envMapIntensity: lowPowerMode ? 0.55 : 1.7,
      },
      false,
    ),
  );
  tearFilm.position.copy(cornea.position);
  tearFilm.scale.copy(cornea.scale).multiplyScalar(1.01);
  tearFilm.renderOrder = 7;
  eyeRig.add(tearFilm);
  addPartMesh(partMeshes, "cornea", tearFilm);

  const aqueous = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 44, 44),
    makeGlassMaterial(
      {
        color: 0xe4eff5,
        roughness: 0.012,
        transmission: 0.96,
        thickness: 0.48,
        ior: 1.336,
        transparent: true,
        opacity: 0.18,
      },
      false,
    ),
  );
  aqueous.position.set(-1.2, 0, 0);
  aqueous.scale.set(0.78, 0.66, 0.66);
  aqueous.renderOrder = 5;
  eyeRig.add(aqueous);
  addPartMesh(partMeshes, "cornea", aqueous);

  const limbusRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.008, 20, 120),
    makeInternalStandardMaterial({
      color: 0x6c7266,
      roughness: 0.84,
      metalness: 0,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      emissive: 0x191a17,
      emissiveIntensity: 0.03,
    }),
  );
  limbusRing.rotation.y = Math.PI / 2;
  limbusRing.position.set(-1.11, 0, 0);
  limbusRing.renderOrder = 7;
  eyeRig.add(limbusRing);
  addPartMesh(partMeshes, "cornea", limbusRing);

  const corneaHighlight = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 22, 22),
    makeInternalBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  corneaHighlight.position.set(-1.7, 0.13, 0.14);
  corneaHighlight.scale.set(0.76, 0.44, 0.31);
  corneaHighlight.renderOrder = 9;
  eyeRig.add(corneaHighlight);
  addPartMesh(partMeshes, "cornea", corneaHighlight);

  const iris = new THREE.Mesh(
    createIrisRingGeometry(),
    makeInternalStandardMaterial({
      color: 0x5f716f,
      map: irisMaps?.map || null,
      bumpMap: irisMaps?.bumpMap || null,
      roughnessMap: irisMaps?.roughnessMap || null,
      bumpScale: 0.028,
      roughness: 0.42,
      metalness: 0.01,
      emissive: 0x1c2223,
      emissiveIntensity: 0.01,
      transparent: true,
      opacity: 0.92,
    }),
  );
  iris.position.set(-1.09, 0, 0);
  iris.renderOrder = 7;
  eyeRig.add(iris);
  addPartMesh(partMeshes, "iris", iris);

  const pupil = new THREE.Mesh(
    new THREE.CircleGeometry(0.142, 80),
    makeInternalStandardMaterial({
      color: 0x080c19,
      roughness: 0.88,
      metalness: 0,
      emissive: 0x020308,
      emissiveIntensity: 0.05,
    }),
  );
  pupil.rotation.y = Math.PI / 2;
  pupil.position.set(-1.06, 0, 0);
  pupil.renderOrder = 8;
  eyeRig.add(pupil);
  addPartMesh(partMeshes, "pupil", pupil);

  const pupilVoid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.012, 40),
    makeInternalBasicMaterial({
      color: 0x060912,
      opacity: 0.45,
      transparent: true,
    }),
  );
  pupilVoid.rotation.z = Math.PI / 2;
  pupilVoid.position.set(-1.0, 0, 0.001);
  pupilVoid.renderOrder = 8;
  eyeRig.add(pupilVoid);
  addPartMesh(partMeshes, "pupil", pupilVoid);

  const lens = new THREE.Mesh(
    createLensGeometry(),
    makeGlassMaterial(
      {
        color: 0xf0ebcf,
        map: lensMaps?.map || null,
        bumpMap: lensMaps?.bumpMap || null,
        roughnessMap: lensMaps?.roughnessMap || null,
        bumpScale: 0.011,
        roughness: 0.042,
        transmission: 0.9,
        thickness: 0.62,
        ior: 1.406,
        transparent: true,
        opacity: 0.56,
        clearcoat: 0.58,
        clearcoatRoughness: 0.085,
        emissive: 0x262111,
        emissiveIntensity: 0.014,
      },
      false,
    ),
  );
  lens.position.set(-0.78, 0, 0);
  lens.renderOrder = 6;
  eyeRig.add(lens);
  addPartMesh(partMeshes, "lens", lens);

  const lensCapsule = new THREE.Mesh(
    createLensGeometry(),
    makeGlassMaterial(
      {
        color: 0xf6f1df,
        roughness: 0.012,
        transmission: 0.98,
        thickness: 0.18,
        ior: 1.399,
        transparent: true,
        opacity: 0.36,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
      },
      false,
    ),
  );
  lensCapsule.position.copy(lens.position);
  lensCapsule.scale.set(1.028, 1.028, 1.028);
  lensCapsule.renderOrder = 6;
  eyeRig.add(lensCapsule);
  addPartMesh(partMeshes, "lens", lensCapsule);

  const lensNucleus = new THREE.Mesh(
    createLensGeometry(),
    makeGlassMaterial(
      {
        color: 0xe8c87d,
        map: lensMaps?.nucleusMap || null,
        roughnessMap: lensMaps?.roughnessMap || null,
        bumpMap: lensMaps?.bumpMap || null,
        bumpScale: 0.006,
        roughness: 0.065,
        transmission: 0.8,
        thickness: 0.4,
        ior: 1.406,
        transparent: true,
        opacity: 0.48,
        clearcoat: 0.12,
        clearcoatRoughness: 0.16,
      },
      false,
    ),
  );
  lensNucleus.position.copy(lens.position);
  lensNucleus.scale.set(0.62, 0.62, 0.62);
  lensNucleus.renderOrder = 6;
  eyeRig.add(lensNucleus);
  addPartMesh(partMeshes, "lens", lensNucleus);

  const ciliaryBody = new THREE.Mesh(
    new THREE.TorusGeometry(0.51, 0.042, 26, 96),
    makeInternalStandardMaterial({
      color: 0x6c4a37,
      roughness: 0.76,
      metalness: 0,
      emissive: 0x28150f,
      emissiveIntensity: 0.03,
    }),
  );
  ciliaryBody.rotation.y = Math.PI / 2;
  ciliaryBody.position.set(-0.84, 0, 0);
  ciliaryBody.renderOrder = 7;
  eyeRig.add(ciliaryBody);
  addPartMesh(partMeshes, "lens", ciliaryBody);

  const zonuleCount = lowPowerMode ? 14 : 24;
  if (lowPowerMode) {
    const zonuleMaterial = new THREE.LineBasicMaterial({
      color: 0xe9f2df,
      transparent: true,
      opacity: 0.2,
      clippingPlanes: [],
    });
    for (let i = 0; i < zonuleCount; i += 1) {
      const t = -1 + (i / (zonuleCount - 1)) * 2;
      const y = t * 0.35;
      const points = [
        new THREE.Vector3(-0.86, y, -0.03),
        new THREE.Vector3(-0.82, y * 0.84, -0.04),
        new THREE.Vector3(-0.75, y * 0.68, -0.045),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, zonuleMaterial);
      eyeRig.add(line);
    }
  } else {
    const zonuleMaterial = makeInternalStandardMaterial({
      color: 0xe7e6cf,
      roughness: 0.72,
      metalness: 0,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      emissive: 0x272313,
      emissiveIntensity: 0.03,
    });
    for (let i = 0; i < zonuleCount; i += 1) {
      const t = -1 + (i / (zonuleCount - 1)) * 2;
      const y = t * 0.35;
      const points = [
        new THREE.Vector3(-0.86, y, -0.034),
        new THREE.Vector3(-0.83, y * 0.92, -0.04),
        new THREE.Vector3(-0.79, y * 0.8, -0.044),
        new THREE.Vector3(-0.75, y * 0.64, -0.048),
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      const zonule = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 16, 0.0026, 8, false),
        zonuleMaterial,
      );
      eyeRig.add(zonule);
      addPartMesh(partMeshes, "lens", zonule);
    }
  }

  const opticCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.48, -0.22, -0.1),
    new THREE.Vector3(1.62, -0.27, -0.14),
    new THREE.Vector3(1.76, -0.32, -0.18),
    new THREE.Vector3(1.92, -0.36, -0.22),
  ]);

  const opticNerve = new THREE.Mesh(
    new THREE.TubeGeometry(opticCurve, 72, 0.076, 24, false),
    makeInternalStandardMaterial({
      color: 0xd4bd62,
      map: opticNerveMaps?.map || null,
      bumpMap: opticNerveMaps?.bumpMap || null,
      bumpScale: 0.016,
      roughness: 0.68,
      emissive: 0x3f3310,
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
    }),
  );
  opticNerve.renderOrder = 2;
  eyeRig.add(opticNerve);
  addPartMesh(partMeshes, "optic", opticNerve);

  const opticNerveSheath = new THREE.Mesh(
    new THREE.TubeGeometry(opticCurve, 72, 0.09, 22, false),
    makeInternalStandardMaterial({
      color: 0xe5ddb3,
      roughness: 0.76,
      metalness: 0,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      emissive: 0x2e2813,
      emissiveIntensity: 0.03,
    }),
  );
  opticNerveSheath.renderOrder = 2;
  eyeRig.add(opticNerveSheath);
  addPartMesh(partMeshes, "optic", opticNerveSheath);

  const centralVesselCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.47, -0.22, -0.11),
    new THREE.Vector3(1.62, -0.28, -0.14),
    new THREE.Vector3(1.76, -0.34, -0.18),
    new THREE.Vector3(1.92, -0.4, -0.22),
  ]);
  const centralRetinalVessel = new THREE.Mesh(
    new THREE.TubeGeometry(centralVesselCurve, 42, 0.011, 16, false),
    makeInternalStandardMaterial({
      color: 0xc37a63,
      roughness: 0.62,
      emissive: 0x4b2017,
      emissiveIntensity: 0.02,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  );
  centralRetinalVessel.renderOrder = 2;
  eyeRig.add(centralRetinalVessel);
  addPartMesh(partMeshes, "optic", centralRetinalVessel);

  const opticDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 48),
    makeInternalStandardMaterial({
      color: 0xf0d79f,
      roughness: 0.66,
      emissive: 0x3e2f15,
      emissiveIntensity: 0.02,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    }),
  );
  opticDisc.rotation.y = Math.PI / 2;
  opticDisc.position.set(1.46, -0.22, -0.115);
  opticDisc.renderOrder = 2;
  eyeRig.add(opticDisc);
  addPartMesh(partMeshes, "optic", opticDisc);

  const macula = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 44),
    makeInternalStandardMaterial({
      color: 0xbd6252,
      roughness: 0.72,
      emissive: 0x3a1711,
      emissiveIntensity: 0.02,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    }),
  );
  macula.rotation.y = Math.PI / 2;
  macula.position.set(1.28, 0.03, -0.11);
  macula.renderOrder = 2;
  eyeRig.add(macula);
  addPartMesh(partMeshes, "retina", macula);

  const vesselMaterial = makeInternalStandardMaterial({
    color: 0xc96352,
    roughness: 0.6,
    metalness: 0,
    emissive: 0x4a2018,
    emissiveIntensity: 0.025,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  for (let i = 0; i < 6; i += 1) {
    const sign = i % 2 === 0 ? 1 : -1;
    const spread = 0.055 + (i % 7) * 0.021;
    const jitter = (i % 3) * 0.012;
    const points = [
      new THREE.Vector3(
        1.44,
        -0.22 + sign * spread * 0.24,
        -0.1 - jitter * 0.2,
      ),
      new THREE.Vector3(1.31, sign * spread * 0.84, -0.112 - jitter),
      new THREE.Vector3(1.14, sign * spread * 1.13, -0.106 - jitter * 0.8),
      new THREE.Vector3(0.98, sign * spread * 1.32, -0.1 - jitter * 0.4),
      new THREE.Vector3(0.84, sign * spread * 1.48, -0.095),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const radius = 0.0025 - (i % 4) * 0.00028;
    const vessel = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 36, Math.max(0.0015, radius), 12, false),
      vesselMaterial,
    );
    eyeRig.add(vessel);
    addPartMesh(partMeshes, "retina", vessel);
  }

  const beamMatOuter = makeInternalBasicMaterial({
    color: 0xffd891,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const beamMatInner = makeInternalBasicMaterial({
    color: 0xfff6cc,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const beamFront = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 0.11, 0.11),
    beamMatOuter,
  );
  beamFront.position.set(-1.56, 0, 0);
  beamFront.visible = false;
  eyeRig.add(beamFront);

  const beamRear = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.09, 0.09),
    beamMatOuter,
  );
  beamRear.position.set(0.26, 0, 0);
  beamRear.visible = false;
  eyeRig.add(beamRear);

  const beamCore = new THREE.Mesh(
    new THREE.BoxGeometry(2.35, 0.04, 0.04),
    beamMatInner,
  );
  beamCore.position.set(-0.12, 0, 0);
  beamCore.visible = false;
  eyeRig.add(beamCore);

  const retinaPulse = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 24, 24),
    makeInternalBasicMaterial({
      color: 0xff8e63,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  retinaPulse.position.set(1.34, 0, -0.02);
  retinaPulse.visible = false;
  eyeRig.add(retinaPulse);

  const floaterCount = lowPowerMode ? 28 : 74;
  const floaterPositions = new Float32Array(floaterCount * 3);
  for (let i = 0; i < floaterCount; i += 1) {
    const phi = Math.random() * TAU;
    const costheta = Math.random() * 2 - 1;
    const theta = Math.acos(costheta);
    const radius = Math.cbrt(Math.random()) * 0.82;
    const x = Math.sin(theta) * Math.cos(phi) * radius;
    const y = Math.sin(theta) * Math.sin(phi) * radius;
    const z = Math.cos(theta) * radius;

    floaterPositions[i * 3] = x + 0.13;
    floaterPositions[i * 3 + 1] = y * 0.82;
    floaterPositions[i * 3 + 2] = z * 0.82;
  }
  const floaterGeometry = new THREE.BufferGeometry();
  floaterGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(floaterPositions, 3),
  );
  const floaterMaterial = new THREE.PointsMaterial({
    color: 0xd5e4ea,
    size: lowPowerMode ? 0.011 : 0.014,
    transparent: true,
    opacity: lowPowerMode ? 0.08 : 0.12,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const vitreousFloaters = new THREE.Points(floaterGeometry, floaterMaterial);
  vitreousFloaters.renderOrder = 4;
  eyeRig.add(vitreousFloaters);

  const adaptiveOpacities = [
    { material: scleraOuter.material, front: 0.31, side: 0.25 },
    { material: scleraInner.material, front: 0.12, side: 0.09 },
    { material: choroid.material, front: 0.21, side: 0.15 },
    { material: retina.material, front: 0.3, side: 0.22 },
    { material: opticNerve.material, front: 0.26, side: 0.18 },
    { material: opticNerveSheath.material, front: 0.09, side: 0.05 },
    { material: centralRetinalVessel.material, front: 0.18, side: 0.1 },
    { material: vitreous.material, front: 0.11, side: 0.08 },
    { material: vitreousCore.material, front: 0.08, side: 0.05 },
    { material: floaterMaterial, front: 0.1, side: 0.06 },
    { material: cornea.material, front: 0.31, side: 0.25 },
    { material: corneaEndothelium.material, front: 0.15, side: 0.1 },
    { material: tearFilm.material, front: 0.12, side: 0.09 },
    { material: aqueous.material, front: 0.1, side: 0.07 },
    { material: limbusRing.material, front: 0.44, side: 0.3 },
    { material: corneaHighlight.material, front: 0.04, side: 0.028 },
    { material: lens.material, front: 0.54, side: 0.46 },
    { material: lensCapsule.material, front: 0.34, side: 0.27 },
    { material: lensNucleus.material, front: 0.42, side: 0.35 },
  ];
  const adaptiveMaterialSet = new Set();
  const focusMaterialState = new Map();
  const INACTIVE_PART_OPACITY_FACTOR = 0.24;
  const INACTIVE_PART_MIN_OPACITY = 0.08;

  const registerFocusableMaterial = (material, partId) => {
    if (!material || material.opacity === undefined) return;

    let state = focusMaterialState.get(material);
    if (!state) {
      state = {
        partIds: new Set(),
        baseOpacity: material.opacity,
        baseDepthWrite:
          typeof material.depthWrite === "boolean"
            ? material.depthWrite
            : undefined,
      };
      focusMaterialState.set(material, state);
    }
    state.partIds.add(partId);

    if (!material.transparent) {
      material.transparent = true;
      material.needsUpdate = true;
    }
  };

  partMeshes.forEach((meshes, partId) => {
    meshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((material) =>
        registerFocusableMaterial(material, partId),
      );
    });
  });

  adaptiveOpacities.forEach((entry) => {
    adaptiveMaterialSet.add(entry.material);
    const state = focusMaterialState.get(entry.material);
    if (state) state.baseOpacity = entry.front;
  });

  PARTS.forEach((part) => {
    const anchor = new THREE.Object3D();
    const [x, y, z] = PART_ANCHOR_POSITIONS[part.id] || [0, 0, 0];
    anchor.position.set(x, y, z);
    eyeRig.add(anchor);
    anchors.set(part.id, anchor);
  });

  const partMap = controller.partMap;
  const BASE_YAW = 0.14;
  const reducedMotion =
    Boolean(window.TodoOptica?.prefersReducedMotion) || lowPowerMode;

  let angle = 0;
  let activePart = controller.getActivePart();
  let hasExplicitFocus = false;
  const visited = controller.getVisited();

  let dragging = false;
  let dragStartX = 0;
  let dragStartAngle = 0;

  let renderFrameId = null;
  let angleAnimFrame = null;
  let lastHotspotUpdateAt = 0;
  let lastRenderAt = 0;
  let canvasRect = canvas.getBoundingClientRect();
  const motionStartAt = performance.now();

  const worldAnchor = new THREE.Vector3();
  const projectedAnchor = new THREE.Vector3();

  const updateAngle = () => {
    const normalized = ((angle % 360) + 360) % 360;
    controller.setAngleLabel(normalized);
  };

  const setActivePart = (id, { explicit = true } = {}) => {
    const next = controller.setActivePart(id);
    if (!next) return;
    if (explicit) hasExplicitFocus = true;
    activePart = next;
    updateHighlight();
  };

  const hotspots = controller.ensureHotspots((part) => {
    setActivePart(part.id);
  });

  const applyFocusedOpacity = (material, baseOpacity) => {
    if (!material || baseOpacity === undefined || baseOpacity === null) return;

    const state = focusMaterialState.get(material);
    if (!state || !activePart || !hasExplicitFocus) {
      material.opacity = baseOpacity;
      return;
    }

    const isActiveMaterial = state.partIds.has(activePart.id);
    const nextOpacity = isActiveMaterial
      ? baseOpacity
      : Math.max(
          INACTIVE_PART_MIN_OPACITY,
          baseOpacity * INACTIVE_PART_OPACITY_FACTOR,
        );

    if (material.opacity !== nextOpacity) {
      material.opacity = nextOpacity;
    }

    if (typeof material.depthWrite === "boolean") {
      const nextDepthWrite = isActiveMaterial
        ? (state.baseDepthWrite ?? material.depthWrite)
        : false;
      if (material.depthWrite !== nextDepthWrite) {
        material.depthWrite = nextDepthWrite;
      }
    }
  };

  const updateHighlight = () => {
    partButtons.forEach((button) => {
      const isActive = button.dataset.eyePart === activePart.id;
      button.classList.toggle("active", isActive);
      button.classList.toggle(
        "is-visited",
        visited.has(button.dataset.eyePart),
      );
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    partMeshes.forEach((meshes, partId) => {
      const isActive = partId === activePart.id;
      meshes.forEach((mesh) => {
        const baseScale = mesh.userData.baseScale;
        if (baseScale) {
          mesh.scale.copy(baseScale).multiplyScalar(isActive ? 1.045 : 1);
        }

        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        materials.forEach((material) => updateMeshEmissive(material, isActive));
      });
    });
  };

  const updateHotspots = () => {
    const rect = canvasRect;

    PARTS.forEach((part) => {
      const button = hotspots.get(part.id);
      const anchor = anchors.get(part.id);
      if (!button || !anchor) return;

      anchor.getWorldPosition(worldAnchor);
      projectedAnchor.copy(worldAnchor).project(camera);

      const withinDepth = projectedAnchor.z >= -1 && projectedAnchor.z <= 1;
      if (!withinDepth) {
        button.style.opacity = "0";
        button.style.pointerEvents = "none";
        return;
      }

      const px = (projectedAnchor.x * 0.5 + 0.5) * rect.width;
      const py = (-projectedAnchor.y * 0.5 + 0.5) * rect.height;
      const visible =
        px >= -30 &&
        px <= rect.width + 30 &&
        py >= -30 &&
        py <= rect.height + 30;

      if (!visible) {
        button.style.opacity = "0";
        button.style.pointerEvents = "none";
        return;
      }

      const distance = camera.position.distanceTo(worldAnchor);
      const size = clamp(50 / distance, 14, 32);

      button.style.transform = `translate(${px}px, ${py}px)`;
      button.style.width = `${size}px`;
      button.style.height = `${size}px`;
      button.style.opacity = "1";
      button.style.pointerEvents = "auto";
      button.classList.toggle("active", part.id === activePart.id);
      button.classList.toggle("is-visited", visited.has(part.id));
    });
  };

  const resizeRenderer = () => {
    const rect = canvas.getBoundingClientRect();
    canvasRect = rect;
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    const maxPixelRatio = lowPowerMode ? 1 : 2;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, maxPixelRatio),
    );
    renderer.setSize(width, height, false);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    updateHotspots();
  };

  const setAngle = (next) => {
    angle = Number.isFinite(next) ? next : angle;
    updateAngle();
  };

  const nudgeAngle = (delta) => {
    setAngle(angle + delta);
  };

  const startAutoRotate = () => {
    if (angleAnimFrame) cancelAnimationFrame(angleAnimFrame);

    const start = performance.now();
    const duration = reducedMotion ? 1300 : 2400;
    const startAngle = angle;

    const loop = (now) => {
      const t = (now - start) / duration;
      if (t >= 1) {
        setAngle(startAngle + 360);
        angleAnimFrame = null;
        return;
      }

      setAngle(startAngle + 360 * t);
      angleAnimFrame = requestAnimationFrame(loop);
    };

    angleAnimFrame = requestAnimationFrame(loop);
  };

  const beamState = {
    active: false,
    start: 0,
    duration: reducedMotion ? 520 : 1550,
  };

  const startLightBeam = () => {
    beamState.active = true;
    beamState.start = performance.now();
    beamFront.visible = true;
    beamRear.visible = true;
    beamCore.visible = true;
    retinaPulse.visible = true;
  };

  const animateBeam = (now) => {
    if (!beamState.active) {
      beamFront.material.opacity = 0;
      beamRear.material.opacity = 0;
      beamCore.material.opacity = 0;
      retinaPulse.material.opacity = 0;
      beamFront.visible = false;
      beamRear.visible = false;
      beamCore.visible = false;
      retinaPulse.visible = false;
      return;
    }

    const progress = clamp((now - beamState.start) / beamState.duration, 0, 1);
    const pulse = Math.sin(progress * Math.PI);

    const frontReveal = clamp(progress / 0.4, 0, 1);
    const rearReveal = clamp((progress - 0.22) / 0.62, 0, 1);

    beamFront.scale.x = Math.max(0.02, frontReveal);
    beamFront.position.x = -2.07 + (1.02 * frontReveal) / 2;
    beamFront.material.opacity = 0.34 * pulse;

    beamRear.scale.x = Math.max(0.02, rearReveal);
    beamRear.position.x = -0.7 + (1.9 * rearReveal) / 2;
    beamRear.material.opacity = 0.3 * pulse;

    beamCore.scale.x = Math.max(0.02, rearReveal);
    beamCore.position.x = -1.3 + (2.35 * rearReveal) / 2;
    beamCore.material.opacity = 0.52 * pulse;

    const retinaGlow = Math.max(0, (progress - 0.56) * 2.3) * pulse;
    retinaPulse.material.opacity = 0.62 * retinaGlow;
    retinaPulse.scale.setScalar(0.82 + progress * 0.58);

    if (progress >= 1) {
      beamState.active = false;
    }
  };

  const setPointerDown = (x) => {
    dragging = true;
    dragStartX = x;
    dragStartAngle = angle;
  };

  const onPointerDown = (event) => {
    setPointerDown(event.clientX);
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragging) return;
    const delta = (event.clientX - dragStartX) / 8;
    setAngle(dragStartAngle + delta);
  };

  const onPointerUp = () => {
    dragging = false;
  };

  const onKeydown = (event) => {
    if (event.target instanceof Element) {
      if (event.target.closest("input, textarea, select, button")) return;
    }

    const rect = root.getBoundingClientRect();
    const visible = rect.bottom > 0 && rect.top < window.innerHeight;
    if (!visible) return;

    if (event.key === "ArrowLeft") nudgeAngle(-6);
    if (event.key === "ArrowRight") nudgeAngle(6);
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  document.addEventListener("keydown", onKeydown);

  rotateButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.eyeRotate === "right" ? 1 : -1;
      nudgeAngle(direction * 6);
    });
  });

  animateBtn?.addEventListener("click", () => {
    startAutoRotate();
    startLightBeam();
  });

  partButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.eyePart;
      if (id) setActivePart(id);
    });
  });

  quizToggle?.addEventListener("click", () => {
    controller.toggleQuiz();
  });

  const renderLoop = (now) => {
    if (now - lastRenderAt < 33) {
      renderFrameId = requestAnimationFrame(renderLoop);
      return;
    }
    lastRenderAt = now;

    const targetYaw = BASE_YAW + toRad(angle);
    eyeRig.rotation.y +=
      (targetYaw - eyeRig.rotation.y) * (reducedMotion ? 0.28 : 0.13);

    if (!reducedMotion) {
      const elapsed = now - motionStartAt;
      eyeRig.rotation.x = Math.sin(elapsed * 0.00031) * 0.018;
      eyeRig.position.y = Math.sin(elapsed * 0.00115) * 0.025;
    }

    const sideViewAmount = Math.abs(Math.cos(eyeRig.rotation.y - BASE_YAW));
    const sideBlend = smoothstep(0.05, 0.98, sideViewAmount);
    adaptiveOpacities.forEach((entry) => {
      if (!entry.material) return;
      const baseOpacity = lerp(entry.front, entry.side, sideBlend);
      applyFocusedOpacity(entry.material, baseOpacity);
    });

    focusMaterialState.forEach((state, material) => {
      if (adaptiveMaterialSet.has(material)) return;
      applyFocusedOpacity(material, state.baseOpacity);
    });

    animateBeam(now);
    renderer.render(scene, camera);
    if (now - lastHotspotUpdateAt > 66) {
      updateHotspots();
      lastHotspotUpdateAt = now;
    }
    renderFrameId = requestAnimationFrame(renderLoop);
  };

  const resizeObserver = new ResizeObserver(() => resizeRenderer());
  resizeObserver.observe(canvas);

  const cleanup = () => {
    if (renderFrameId) cancelAnimationFrame(renderFrameId);
    if (angleAnimFrame) cancelAnimationFrame(angleAnimFrame);

    resizeObserver.disconnect();

    canvas.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("keydown", onKeydown);

    const disposedMaterials = new Set();
    scene.traverse((node) => {
      if (
        !(
          node instanceof THREE.Mesh ||
          node instanceof THREE.Line ||
          node instanceof THREE.Points
        )
      ) {
        return;
      }
      if (node.geometry) node.geometry.dispose();
      const materials = Array.isArray(node.material)
        ? node.material
        : [node.material];
      materials.forEach((material) => {
        if (!material || disposedMaterials.has(material)) return;
        material.dispose();
        disposedMaterials.add(material);
      });
    });

    scleraMaps?.map?.dispose?.();
    scleraMaps?.roughnessMap?.dispose?.();
    scleraMaps?.bumpMap?.dispose?.();
    corneaMaps?.bumpMap?.dispose?.();
    corneaMaps?.roughnessMap?.dispose?.();
    retinaMaps?.map?.dispose?.();
    retinaMaps?.bumpMap?.dispose?.();
    retinaMaps?.roughnessMap?.dispose?.();
    irisMaps?.map?.dispose?.();
    irisMaps?.bumpMap?.dispose?.();
    irisMaps?.roughnessMap?.dispose?.();
    lensMaps?.map?.dispose?.();
    lensMaps?.nucleusMap?.dispose?.();
    lensMaps?.bumpMap?.dispose?.();
    lensMaps?.roughnessMap?.dispose?.();
    opticNerveMaps?.map?.dispose?.();
    opticNerveMaps?.bumpMap?.dispose?.();
    envRenderTarget?.dispose?.();
    pmremGenerator.dispose();

    renderer.dispose();
  };

  window.addEventListener("pagehide", cleanup, { once: true });

  updateHighlight();
  updateAngle();

  resizeRenderer();
  renderFrameId = requestAnimationFrame(renderLoop);

  return true;
};
