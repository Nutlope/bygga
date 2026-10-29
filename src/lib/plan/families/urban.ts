import type { Family } from "./family";
import type { CustomParams, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * URBAN junior chair: one moulded plastic piece, seat, back, legs and footrest together. IKEA sells it ready made
 * (its page has no assembly instructions), so its guide only unpacks it and shows where the footrest is.
 */
function chair(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 450, H = Math.round(s.size.h * 10) || 790, D = Math.round(s.size.d * 10) || 480;
  const yS = (s.seat?.seatH ?? 53) * 10, st = 30, lw = 40, Hb = H - yS;
  const y = (v: number) => v - H / 2; // pieces are placed about the chair's own centre
  const legs: PartPiece[] = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz): PartPiece => {
      const top: Vec3 = [sx * (W / 2 - 60), y(yS - st), sz * (D / 2 - 80)], foot: Vec3 = [sx * (W / 2 - lw / 2), y(0), sz * (D / 2 - lw / 2)];
      const v = [foot[0] - top[0], foot[1] - top[1], foot[2] - top[2]], len = Math.hypot(v[0], v[1], v[2]);
      return { shape: "box", size: [lw, len, lw], pos: [(top[0] + foot[0]) / 2, (top[1] + foot[1]) / 2, (top[2] + foot[2]) / 2], rot: [Math.atan2(v[2], -v[1]) * -1, 0, Math.asin(v[0] / len)] };
    }),
  );
  const pieces: PartPiece[] = [
    { shape: "slab", size: [W - 100, st, D - 120], pos: [0, y(yS - st / 2), 20], outline: [[-(W - 100) / 2, -(D - 120) / 2], [(W - 100) / 2, -(D - 120) / 2], [(W - 100) / 2, (D - 120) / 2], [-(W - 100) / 2, (D - 120) / 2]], round: 60 },
    // the back stands up from the seat: a slab drawn flat, then turned upright and tipped back a little
    { shape: "slab", size: [W - 140, 26, Hb], pos: [0, y(yS + Hb / 2 - 10), -D / 2 + 75], outline: [[-(W - 140) / 2, -Hb / 2], [(W - 140) / 2, -Hb / 2], [(W - 120) / 2, Hb / 2], [-(W - 120) / 2, Hb / 2]], round: 70, rot: [-Math.PI / 2 + 0.1, 0, 0] },
    ...legs,
    // the footrest across the front legs, and the rail at the back
    { shape: "box", size: [W - 60, 30, 40], pos: [0, y(230), D / 2 - 70] },
    { shape: "box", size: [W - 60, 30, 30], pos: [0, y(230), -D / 2 + 70] },
  ];
  return {
    parts: [{ id: "C", name: "Junior chair", size: [W, H, D], pos: [0, H / 2, 0], material: "board", pieces }],
    steps: [
      { title: "Unpack the chair", detail: "It comes in one moulded piece, so there is nothing to put together. Take off all the packaging.", add: ["C"], from: { C: [0, 300, 0] } },
      { title: "Push it up to the table", detail: "Your child climbs on with a foot on the footrest at the front. Check it stands steady on all four feet." },
    ],
  };
}

const family: Family = {
  names: ["URBAN"],
  recipe(s) {
    if (/^urban-junior-chair/.test(s.slug ?? "")) return chair(s);
    return null;
  },
};
export default family;
