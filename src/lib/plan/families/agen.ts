import type { Family } from "./family";
import type { CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec } from "../../types";

/**
 * AGEN: a hand-woven rattan chair on bamboo legs. IKEA sells it ready to use and has no assembly manual for it,
 * so the guide only unpacks it and, for the armchair with cushion, lays the cushion on the seat.
 */

function chair(s: ProductSpec, cushion: boolean): CustomParams {
  const W = Math.round(s.size.w * 10) || 580, H = Math.round(s.size.h * 10) || 790, D = Math.round(s.size.d * 10) || 560;
  const yS = 440; // seat height
  const legD = 30, ring = 70; // bamboo legs, the woven seat ring
  const xl = W / 2 - 60, zl = D / 2 - 60;
  // the legs splay out a little towards the floor
  const tilt = 0.08;
  const legs: PartPiece[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): PartPiece => ({
    shape: "cyl",
    size: [legD, yS - ring / 2, legD],
    pos: [sx * xl, (yS - ring / 2) / 2 - H / 2, sz * zl],
    rot: [sz * tilt, 0, -sx * tilt],
  })));
  // the back and arms: one woven shell curving round the seat, drawn as panels on an arc
  const R = W / 2 - 20, n = 9, shellH = H - yS + ring / 2;
  const shell: PartPiece[] = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI * 0.62 + (Math.PI * 1.24 * i) / (n - 1); // from the left arm round the back to the right arm
    const h = i === 0 || i === n - 1 ? shellH * 0.55 : i === 1 || i === n - 2 ? shellH * 0.8 : shellH;
    return { shape: "box", size: [Math.round((2 * Math.PI * R * 0.62) / (n - 1)) + 8, Math.round(h), 24], pos: [Math.round(Math.sin(a) * R), Math.round(yS - ring / 2 + h / 2 - H / 2), Math.round(-Math.cos(a) * R * 0.85)], rot: [0, -a, 0] };
  });
  const seat: PartPiece[] = [{ shape: "box", size: [W - 100, ring, D - 110], pos: [0, yS - H / 2, 0] }];
  const parts: CustomPart[] = [{ id: "chair", name: "Rattan chair", size: [W, H, D], pos: [0, H / 2, 0], material: "wood", pieces: [...legs, ...seat, ...shell] }];
  const steps: CustomStep[] = [
    { title: "Lift the chair out of its packaging", detail: "It comes ready to use, with nothing to put together. Pull off the wrapping and any tape on the rattan.", add: ["chair"], from: { chair: [0, 300, 0] } },
    { title: "Stand it on a flat floor", detail: "Check all four legs touch the floor. Keep it out of the rain and direct sun, which dry out the rattan." },
  ];
  if (cushion) {
    parts.push({ id: "cush", name: "Seat cushion", size: [W - 140, 50, D - 160], pos: [0, yS + ring / 2 + 25, 10], material: "soft" });
    steps.push({ title: "Lay the cushion on the seat", detail: "Push it back against the shell so it sits flat on the woven seat.", add: ["cush"], from: { cush: [0, 260, 120] } });
  }
  return { parts, steps };
}

const family: Family = {
  names: ["AGEN"],
  recipe(s) {
    const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
    if (!/chair/.test(v)) return null;
    return chair(s, /cushion/.test(v));
  },
};
export default family;
