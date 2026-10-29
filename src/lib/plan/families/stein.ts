import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * STEIN chair: one moulded piece of clear plastic that comes ready to use (IKEA lists no assembly and no manual),
 * so the guide only unpacks it and shows how the chairs stack.
 */

function recipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10), D = Math.round(s.size.d * 10);
  const SH = 450, ST = 14; // seat height and thickness
  const seatD = 420;
  const zs = 20; // seat centre, a little forward
  const leg = 26;
  const legY = SH - ST;
  const fx = 125, fz = zs + 140; // front legs under the rim of the round seat
  const bx = 150, bz = -D / 2 + leg / 2 + 10; // back legs splay back and rise into the back posts
  const backH = H - SH;
  const pieces: PartPiece[] = [
    { shape: "cyl", size: [seatD, ST, seatD], pos: [0, SH - ST / 2, zs] },
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [leg, legY, leg], pos: [g * fx, legY / 2, fz] })),
    // the back legs run on up into the back posts, leaning back
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [leg, H - 30, leg], pos: [g * bx, (H - 30) / 2, (bz + zs - seatD / 2 + 30) / 2], rot: [Math.atan2(zs - seatD / 2 + 30 - bz, H - 30), 0, 0] })),
    // the curved back band
    { shape: "box", size: [2 * bx + leg + 40, Math.min(170, backH * 0.5), 12], pos: [0, H - Math.min(170, backH * 0.5) / 2, zs - seatD / 2 + 20] },
  ];
  const chair: CustomPart = { id: "C", name: "Chair", size: [W, H, D], pos: [0, H / 2, 0], material: "glass", pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] - H / 2, p.pos[2]] as Vec3 })) };
  return {
    parts: [chair],
    steps: [
      { title: "Take the chair out of its packing", detail: "It comes in one piece, ready to use. Peel off any protective film.", add: ["C"] },
      { title: "Stand it on a flat floor", detail: "Check all four feet touch the floor. To store several, stack them straight on top of each other." },
    ],
  };
}

const family: Family = {
  names: ["STEIN"],
  recipe(s) {
    if (!/chair/i.test(s.variant)) return null;
    return recipe(s);
  },
};
export default family;
