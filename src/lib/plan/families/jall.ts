import type { Family } from "./family";
import type { CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec } from "../../types";

/**
 * JÄLL drying rack: a folding steel rack that IKEA sells ready to use, with no assembly manual. Its guide only
 * opens it: the crossed legs swing apart until the top with its drying lines lies flat and locks.
 */

function rack(s: ProductSpec): CustomParams {
  const L = Math.round(s.size.w * 10) || 790, D = Math.round(s.size.d * 10) || 400, H = Math.round(s.size.h * 10) || 820;
  const tube = 16, zs = D / 2 - 20, spread = L / 2 - 120;
  const yTop = H - 10;
  // each side is an X of two tubes in the length, from a foot at one end up to the top rail at the other
  const ang = Math.atan2(2 * spread, yTop);
  const len = Math.hypot(2 * spread, yTop);
  const legs: PartPiece[] = [-1, 1].flatMap((sz) => [-1, 1].map((k): PartPiece => ({ shape: "cyl", size: [tube, Math.round(len), tube], pos: [0, yTop / 2 - H / 2, sz * zs], rot: [0, 0, k * ang] })));
  // the bars that keep the two X's apart, one high and one low
  const bars: PartPiece[] = [160, 420].map((y, i): PartPiece => ({ shape: "cyl", size: [tube, 2 * zs, tube], pos: [(i ? 1 : -1) * spread * (1 - (2 * y) / yTop) * 0.98, y - H / 2, 0], rot: [Math.PI / 2, 0, 0] }));
  const lines = 7;
  const top: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [tube, L, tube], pos: [0, 0, sz * (D / 2 - tube / 2)], rot: [0, 0, Math.PI / 2] })),
    ...Array.from({ length: lines }, (_, i): PartPiece => ({ shape: "cyl", size: [4, L - 40, 4], pos: [0, 0, -D / 2 + tube + ((D - 2 * tube) * (i + 0.5)) / lines], rot: [0, 0, Math.PI / 2] })),
  ];
  const parts: CustomPart[] = [
    { id: "legs", name: "Leg frame", size: [2 * spread + tube, H, D], pos: [0, H / 2, 0], material: "metal", pieces: [...legs, ...bars] },
    { id: "top", name: "Top with drying lines", size: [L, tube, D], pos: [0, yTop, 0], material: "metal", pieces: top },
  ];
  const steps: CustomStep[] = [
    { title: "Take the folded rack out of the box", detail: "It comes ready to use, with nothing to put together. Stand it on its feet, still folded.", add: ["legs"], from: { legs: [0, 300, 0] } },
    { title: "Pull the legs apart and lower the top", detail: "Open the crossed legs until the top lies flat and the bars lock it open.", add: ["top"], from: { top: [0, 250, 0] } },
    { title: "Check it stands steady", detail: "All four feet on a flat floor. Hang the washing evenly on both sides; to fold it, lift the top at one end." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["JÄLL", "JALL"],
  recipe(s) {
    return /drying rack|jall-drying/i.test(`${s.variant} ${s.slug ?? ""}`) ? rack(s) : null;
  },
};
export default family;
