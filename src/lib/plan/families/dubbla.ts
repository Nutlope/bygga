import type { Family } from "./family";
import type { CustomParams, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * DUBBLA laptop stand. IKEA sells it ready assembled (its page says so and has no assembly instructions): a white
 * top with rounded corners on a steel scissor frame with a gas spring, a lever under the right-hand edge and felt
 * pads under the feet. The guide unpacks it, sets the height and checks the pads; it's drawn at its lowest, 18 cm.
 */

const TUBE = 20;

function stand(s: ProductSpec): CustomParams {
  const W = s.size.w * 10 || 600, D = s.size.d * 10 || 400, H = s.size.h * 10 || 180;
  const TT = 18, yTop = H - TT;
  const c: Vec3 = [0, yTop / 2, 0];
  const xs = W / 2 - 110; // the two scissor pairs, in from the ends
  const run = D - 120; // how far each bar reaches front to back
  const rise = yTop - 30 - TUBE;
  const len = Math.hypot(run, rise), a = Math.atan2(rise, run);
  const frame: PartPiece[] = [
    // a scissor of two crossed bars on each side
    ...[-1, 1].flatMap((sx) => [-1, 1].map((k): PartPiece => ({ shape: "box", size: [TUBE, TUBE, len], pos: [sx * (xs + (k < 0 ? 0 : TUBE)), TUBE / 2 + rise / 2 + 6 - yTop / 2, 0], rot: [k * a, 0, 0] }))),
    // the feet bars and the rails under the top, across the width
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [TUBE, 2 * xs + 2 * TUBE + 20, TUBE], pos: [0, TUBE / 2 - yTop / 2, sz * (run / 2)], rot: [0, 0, Math.PI / 2] })),
    { shape: "box", size: [2 * xs + 60, 22, run], pos: [0, yTop / 2 - 11, 0] },
    // the lever under the right-hand edge
    { shape: "box", size: [70, 12, 40], pos: [W / 2 - 40, yTop / 2 - 18, D / 2 - 60] },
  ];
  const r = 40;
  const outline: [number, number][] = [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]];
  return {
    parts: [
      { id: "F", name: "Scissor frame", size: [W, yTop, D], pos: c, pieces: frame, material: "metal" },
      { id: "T", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], pieces: [{ shape: "slab", size: [W, TT, D], pos: [0, 0, 0], outline, round: r }], material: "board" },
    ],
    steps: [
      { title: "Unpack the stand", detail: "It comes ready assembled, so there is nothing to put together. Lift it out by the top, folded flat.", add: ["F", "T"], from: { T: [0, 0, 0] } },
      { title: "Check the felt pads", detail: "One under each end of both foot bars. Press any loose one back on so the stand can't mark the table." },
      { title: "Set the height", detail: "Hold the top with both hands, squeeze the lever under the right-hand edge and let the gas spring lift it, between 18 and 41 cm. Let go of the lever to lock it.", warnings: ["hand"] },
    ],
  };
}

const family: Family = {
  names: ["DUBBLA"],
  recipe: (s) => (/^dubbla-laptop-stand/.test(s.slug ?? "") ? stand(s) : null),
};
export default family;
