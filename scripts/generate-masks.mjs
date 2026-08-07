// Deterministic pixel-dissolve mask generator.
// Produces two SVG alpha masks under public/masks/.
// viewBox 0 0 1000 1000 with preserveAspectRatio="none" so the mask stretches
// to fill any element aspect ratio (no letterbox / transparent side columns).
// Seeded pseudo-randomness: identical output every run, no runtime randomness.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";

// Deterministic hash-based pseudo-random in [0,1).
function rng(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const masksDir = join(cwd(), "public", "masks");
mkdirSync(masksDir, { recursive: true });

const VB = 1000; // viewBox extent
const CELLS = 100; // cells per axis
const STEP = VB / CELLS; // 10
const CELL = 8.4; // cell size (< STEP for small gaps)
const PAD = (STEP - CELL) / 2; // 0.8

function header() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" preserveAspectRatio="none">`;
}

// 1. BOTTOM mask: solid top band, staggered cells fading toward the bottom.
(function bottom() {
  const solidH = 820; // fully opaque from y=0 through ~820
  const fadeStart = 800; // cells begin around y=800 (overlap with solid)
  const rects = [
    `  <rect x="0" y="0" width="${VB}" height="${solidH}" fill="#ffffff" />`,
  ];
  for (let r = Math.floor(fadeStart / STEP); r < CELLS; r++) {
    const y0 = r * STEP;
    const rowProgress = (y0 - fadeStart) / (VB - fadeStart); // 0 at fadeStart -> 1 at bottom
    // density and opacity both decrease toward the bottom
    const density = Math.pow(1 - rowProgress, 1.15);
    for (let c = 0; c < CELLS; c++) {
      const rnd = rng(r * 1000 + c + 1);
      if (rnd < density) {
        const opacity = Math.max(
          0.04,
          Math.pow(1 - rowProgress, 0.8) * (0.55 + rnd * 0.45)
        );
        const x = (c * STEP + PAD).toFixed(1);
        const y = (y0 + PAD).toFixed(1);
        rects.push(
          `  <rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#ffffff" opacity="${opacity.toFixed(2)}" />`
        );
      }
    }
  }
  writeFileSync(
    join(masksDir, "pixel-dissolve-bottom.svg"),
    `${header()}\n${rects.join("\n")}\n</svg>`
  );
  console.log("Generated public/masks/pixel-dissolve-bottom.svg");
})();

// 2. LEFT mask: sparse cells at the far left, increasing density toward the
// right, fully opaque for the remainder after ~28% width.
(function left() {
  const solidStart = 280; // fully opaque from x=280 to x=1000
  const rects = [
    `  <rect x="${solidStart}" y="0" width="${VB - solidStart}" height="${VB}" fill="#ffffff" />`,
  ];
  for (let c = 0; c < solidStart / STEP; c++) {
    const x0 = c * STEP;
    const colProgress = x0 / solidStart; // 0 at far left -> 1 at solidStart
    // density and opacity increase toward the right
    const density = Math.pow(colProgress, 1.25);
    for (let r = 0; r < CELLS; r++) {
      const rnd = rng(c * 1000 + r + 7001);
      if (rnd < density) {
        const opacity = Math.max(
          0.04,
          Math.pow(colProgress, 0.7) * (0.55 + rnd * 0.45)
        );
        const x = (x0 + PAD).toFixed(1);
        const y = (r * STEP + PAD).toFixed(1);
        rects.push(
          `  <rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="#ffffff" opacity="${opacity.toFixed(2)}" />`
        );
      }
    }
  }
  writeFileSync(
    join(masksDir, "pixel-dissolve-left.svg"),
    `${header()}\n${rects.join("\n")}\n</svg>`
  );
  console.log("Generated public/masks/pixel-dissolve-left.svg");
})();
