import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec } from "../../types";

/**
 * RISÖR has no assembly manual: the room divider comes put together, three solid wood frames with white panels,
 * already joined by hinges. The guide unpacks it, stands it up and folds the outer panels forward so it stands.
 */

const F = 30; // frame section
const LEG = 70; // the stiles stand this far below the bottom rail

/** One panel: the frame, the white infill, and a few cross and upright bars at the heights given (fractions). */
function panel(w: number, h: number, rails: number[], bars: [number, number, number][]): PartPiece[] {
  const yb = -h / 2 + LEG + F / 2, yt = h / 2 - F / 2;
  const span = yt - yb;
  const p: PartPiece[] = [
    { shape: "box", size: [F, h, F], pos: [-w / 2 + F / 2, 0, 0] },
    { shape: "box", size: [F, h, F], pos: [w / 2 - F / 2, 0, 0] },
    { shape: "box", size: [w - 2 * F, F, F], pos: [0, yt, 0] },
    { shape: "box", size: [w - 2 * F, F, F], pos: [0, yb, 0] },
    { shape: "box", size: [w - 2 * F, span - F, 4], pos: [0, (yt + yb) / 2, 0], material: "board" },
  ];
  for (const r of rails) p.push({ shape: "box", size: [w - 2 * F, 20, 20], pos: [0, yb + span * r, 0] });
  // an upright bar between two rails, at a fraction of the width
  for (const [x, a, b] of bars) {
    const y0 = yb + span * a, y1 = yb + span * b;
    p.push({ shape: "box", size: [20, y1 - y0, 20], pos: [-w / 2 + F + (w - 2 * F) * x, (y0 + y1) / 2, 0] });
  }
  return p;
}

function divider(s: ProductSpec): CustomParams {
  const H = s.size.h * 10, D = s.size.d * 10;
  const w = Math.round((s.size.w * 10) / 3);
  const a = Math.asin(Math.min(0.9, (D - F) / w)); // the outer panels fold forward this far
  const z0 = -D / 2 + F / 2;
  const sides: PartPiece[] = panel(w, H, [0.22, 0.5, 0.8], [[0.4, 0, 0.22], [0.6, 0.22, 0.5], [0.3, 0.5, 0.8], [0.25, 0.8, 1]]);
  const mid: PartPiece[] = panel(w, H, [0.2, 0.55, 0.85], [[0.6, 0, 0.2], [0.5, 0.2, 0.55], [0.3, 0.55, 0.85], [0.7, 0.85, 1]]);
  // the hinges sit on the middle panel's edges, three on each side
  for (const sx of [-1, 1]) for (const f of [0.25, 0.6, 0.9]) mid.push({ shape: "box", size: [8, 50, 34], pos: [sx * (w / 2 + 2), -H / 2 + H * f, 0], material: "metal" });
  const parts: CustomPart[] = [
    { id: "M", name: "Middle panel", size: [w, H, F], pos: [0, H / 2, z0], material: "wood", pieces: mid },
    ...[-1, 1].map((sx): CustomPart => ({
      id: sx < 0 ? "L" : "R",
      name: "Side panel",
      size: [w, H, F],
      pos: [sx * (w / 2 + (w / 2) * Math.cos(a)), H / 2, z0 + (w / 2) * Math.sin(a)],
      rot: [0, sx * -a, 0],
      material: "wood",
      pieces: sides,
    })),
  ];
  return {
    parts,
    steps: [
      {
        title: "Unpack it and stand it up together",
        detail: "It comes put together, the panels already hinged and folded flat. Lift it out of the box, take off the wrapping and stand it on its feet.",
        add: ["M", "L", "R"],
        from: { M: [0, 300, 0], L: [w / 2, 300, F + 10], R: [-w / 2, 300, 2 * F + 20] },
        people: 2,
        warnings: ["two"],
      },
      {
        title: "Fold the outer panels forward",
        detail: "Open each side panel on its hinges until the divider stands steady on its own. Don't open them flat, or it can tip over.",
        warnings: ["tip"],
      },
    ],
  };
}

const family: Family = {
  names: ["RISÖR", "RISOR"],
  recipe(s) {
    if (/risor-room-divider/.test(s.slug ?? "")) return divider(s);
    return null;
  },
};
export default family;
