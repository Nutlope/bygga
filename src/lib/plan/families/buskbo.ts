import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BUSKBO. The rattan armchair is sold assembled, with no manual: the round back and arms, the seat and the four
 * legs with their stretchers are bound together in one piece. Its guide only unwraps it and puts the cushion in.
 */

/** A rattan hoop round the back and sides, open at the front: a U-shaped band seen from above (x, z from its middle). */
function hoop(a: number, b: number, zFront: number, band: number): [number, number][] {
  const n = 14;
  const arc = (ra: number, rb: number) => Array.from({ length: n + 1 }, (_, i): [number, number] => {
    const t = Math.PI + (i * Math.PI) / n; // from the left round the back to the right
    return [Math.cos(t) * ra, Math.sin(t) * rb];
  });
  const out = arc(a, b), inn = arc(a - band, b - band).reverse();
  return [[-a, zFront], ...out, [a, zFront], [a - band, zFront], ...inn, [-(a - band), zFront]];
}

function armchair(s: ProductSpec): CustomParams {
  // IKEA: 72 wide, 63 deep, 75 high, seat 32 high, 12 free under it
  const W = Math.round(s.size.w * 10) || 720, D = Math.round(s.size.d * 10) || 630, H = Math.round(s.size.h * 10) || 750;
  const ySeat = 220, yRim = 300; // the seat frame, and the thick rim round it
  const a = W / 2 - 15, b = D * 0.6, zc = -D / 2 + b; // the hoops' round back, centred towards the front
  const c: Vec3 = [0, H / 2, 0];
  const at = (x: number, y: number, z: number): Vec3 => [x, y - c[1], z];
  const pieces: PartPiece[] = [
    // the rim round the seat and the bands of the back and arms above it
    { shape: "slab", size: [W, 30, D], pos: at(0, yRim, zc), outline: hoop(a, b, D / 2 - zc - 20, 30) },
    ...[0, 1, 2, 3, 4, 5, 6, 7].map((k): PartPiece => {
      const y = yRim + 70 + k * 48;
      const f = Math.max(0, (k - 2) / 5); // the arms curve back towards the top
      return { shape: "slab", size: [W, 14, D], pos: at(0, y, zc), outline: hoop(a - 10, b - 10, D / 2 - zc - 50 - f * 170, 14) };
    }),
    { shape: "slab", size: [W, 30, D], pos: at(0, H - 15, zc), outline: hoop(a, b, D / 2 - zc - 230, 30) },
    // uprights at the back, binding the bands
    ...[-0.45, 0, 0.45].map((t): PartPiece => ({ shape: "cyl", size: [32, H - yRim, 32], pos: at(Math.sin(t) * (a - 20), (H + yRim) / 2, zc - Math.cos(t) * (b - 20)) })),
    // the front of the arms bending down to the rim
    ...[-1, 1].map((g): PartPiece => ({ shape: "cyl", size: [34, 200, 34], pos: at(g * (a - 15), yRim + 100, D / 2 - 40) })),
    // the seat frame inside the rim
    { shape: "box", size: [W - 120, 24, D - 120], pos: at(0, ySeat, 10) },
    // four splayed legs and the stretchers between them
    ...[-1, 1].flatMap((gx) => [-1, 1].map((gz): PartPiece => ({ shape: "cyl", size: [34, yRim + 10, 34], pos: at(gx * (W / 2 - 110), (yRim + 10) / 2, gz * (D / 2 - 120)), rot: [gz * 0.14, 0, -gx * 0.12] }))),
    ...[-1, 1].map((gz): PartPiece => ({ shape: "cyl", size: [24, W - 160, 24], pos: at(0, 90, gz * (D / 2 - 95)), rot: [0, 0, Math.PI / 2] })),
    ...[-1, 1].map((gx): PartPiece => ({ shape: "cyl", size: [24, D - 200, 24], pos: at(gx * (W / 2 - 85), 90, 0), rot: [Math.PI / 2, 0, 0] })),
  ];
  const parts: CustomPart[] = [
    { id: "A", name: "Armchair", size: [W, H, D], pos: [0, H / 2, 0], pieces, material: "wood" },
    { id: "C", name: "Seat cushion", size: [W - 170, 110, D - 150], pos: [0, ySeat + 12 + 55, 25], material: "soft" },
  ];
  return {
    parts,
    steps: [
      { title: "Unwrap the armchair and stand it on its feet", detail: "It comes in one piece, with nothing to screw together. Check the four glides are on the feet.", add: ["A"] },
      { title: "Put the cushion on the seat", detail: "Zip side to the back, pushed in under the arms.", add: ["C"], from: { C: [0, 300, 120] } },
    ],
  };
}

const family: Family = {
  names: ["BUSKBO"],
  recipe(s) {
    if (/armchair/i.test(s.variant) || /buskbo-armchair/.test(s.slug ?? "")) return armchair(s);
    return null;
  },
};
export default family;
