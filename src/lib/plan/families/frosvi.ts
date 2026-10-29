import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FRÖSVI comes assembled: IKEA's page says it's ready to use and there is no assembly manual. The guide only opens
 * it: lift the seat's front until the frame stands, push the seat down until it rests on its stops, and fold it the
 * other way to store it (the hole in the backrest hangs it on a hook).
 */

/** A square stick from a to b in the y-z plane, as a piece of the part centred at c. */
function stick(a: Vec3, b: Vec3, c: Vec3, w = 28, d = 22): PartPiece {
  const dy = b[1] - a[1], dz = b[2] - a[2];
  return { shape: "box", size: [w, Math.hypot(dy, dz), d], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot: [Math.atan2(dz, dy), 0, 0] };
}

function chair(s: ProductSpec): CustomParams {
  // IKEA: 44 wide, 51 deep, 77 high, seat 38 x 33 at 46
  const W = Math.round(s.size.w * 10) || 440, D = Math.round(s.size.d * 10) || 510, H = Math.round(s.size.h * 10) || 770;
  const ys = 460, sw = 380, sd = 330;
  const c: Vec3 = [0, H / 2, 0];
  const xo = W / 2 - 14, xi = sw / 2 + 14;
  const zb0 = -D / 2 + 70, zbT = -D / 2 + 14; // back legs, floor to top, leaning back
  const zf0 = D / 2 - 14; // front legs' feet
  const zSeatBack = zb0 + 40, zSeatFront = zSeatBack + sd;
  const pieces: PartPiece[] = [
    ...[-1, 1].flatMap((sx) => [
      stick([sx * xo, 0, zb0], [sx * xo, H, zbT], c),
      stick([sx * xi, 0, zf0], [sx * xi, ys + 40, zSeatBack - 10], c),
    ]),
    // the backrest, a stretcher low between the front legs and one under the seat
    { shape: "box", size: [2 * xo, 110, 18], pos: [0, H - 70 - c[1], zbT + 8 - c[2]], rot: [-0.07, 0, 0] },
    { shape: "box", size: [2 * xi, 22, 22], pos: [0, 140 - c[1], zf0 - 120 - c[2]] },
    { shape: "box", size: [2 * xo, 22, 22], pos: [0, 240 - c[1], zb0 - 18 - c[2]] },
    // the seat: slats between two side rails
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [20, 40, sd], pos: [sx * (sw / 2 - 10), ys - 20 - c[1], (zSeatBack + zSeatFront) / 2 - c[2]] })),
    ...Array.from({ length: 7 }, (_, k): PartPiece => ({ shape: "box", size: [sw, 16, 34], pos: [0, ys - 8 - c[1], zSeatBack + 22 + (k * (sd - 44)) / 6 - c[2]] })),
  ];
  const parts: CustomPart[] = [{ id: "C", name: "Folding chair", size: [W, H, D], pos: c, pieces, material: "wood" }];
  return {
    parts,
    steps: [
      {
        title: "Unfold the chair",
        detail: "It comes assembled. Hold the backrest and lift the front of the seat: the legs swing apart.",
        add: ["C"],
        from: { C: [0, 200, 0] },
        warnings: ["hand"],
      },
      {
        title: "Push the seat down onto its stops",
        detail: "Press the back of the seat down until it rests on the frame. Keep your fingers out of the joints.",
        warnings: ["hand"],
      },
      {
        title: "Fold it up to store it",
        detail: "Lift the front of the seat towards the backrest. The hole in the backrest hangs it on a hook.",
      },
    ],
  };
}

const family: Family = {
  names: ["FRÖSVI", "FROSVI"],
  recipe(s) {
    if (/^frosvi-folding-chair/.test(s.slug ?? "")) return chair(s);
    return null;
  },
};
export default family;
