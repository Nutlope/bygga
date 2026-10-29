import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * KVISTBRO storage table, read from its manual: a round steel wire basket, wider at the top, and a loose lid. The
 * basket is turned upside down and four felt pads are stuck under its bottom ring, then it is turned over and the
 * lid laid on. IKEA: 44 across, 42 high.
 */

/** Euler angles (x then z) that turn a part's y axis onto d. */
function along(d: Vec3): Vec3 {
  const n = Math.hypot(...d);
  const [x, y, z] = [d[0] / n, d[1] / n, d[2] / n];
  return [Math.atan2(z, y), 0, Math.atan2(-x, Math.hypot(y, z))];
}

/** A wire from a to b, as a piece placed from the part's centre c. */
function wire(a: Vec3, b: Vec3, c: Vec3, dia = 6): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return { shape: "cyl", size: [dia, Math.hypot(...d), dia], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot: along(d) };
}

const at = (r: number, t: number, y: number): Vec3 => [r * Math.cos(t), y, r * Math.sin(t)];

/** A ring of wire, as short straight pieces. */
function ring(r: number, y: number, c: Vec3, n = 28, dia = 6): PartPiece[] {
  return Array.from({ length: n }, (_, k) => wire(at(r, (2 * Math.PI * k) / n, y), at(r, (2 * Math.PI * (k + 1)) / n, y), c, dia));
}

function recipe(s: ProductSpec): CustomParams {
  const D = Math.round(s.size.w * 10) || 440, H = Math.round(s.size.h * 10) || 420;
  const LT = 18; // lid
  const HB = H - LT; // basket
  const rT = D / 2 - 8, rB = rT * 0.76; // the basket tapers to its foot
  const c: Vec3 = [0, HB / 2, 0];
  const rAt = (y: number) => rB + ((rT - rB) * y) / HB;
  const pieces: PartPiece[] = [...ring(rT, HB - 4, c, 32, 8), ...ring(rB, 4, c, 28, 8), ...ring(rAt(HB * 0.18), HB * 0.18, c, 28, 4)];
  // the diamond mesh: wires leaning both ways round the basket
  const n = 18;
  for (let k = 0; k < n; k++)
    for (const g of [-1, 1]) {
      const t0 = (2 * Math.PI * k) / n;
      pieces.push(wire(at(rB, t0, 4), at(rT, t0 + (g * 2 * Math.PI) / n * 1.5, HB - 4), c, 4));
    }
  // the floor: a small ring in the middle and spokes out to the foot ring
  pieces.push(...ring(60, 6, c, 14, 5));
  for (let k = 0; k < 8; k++) pieces.push(wire(at(60, (Math.PI * k) / 4, 6), at(rB, (Math.PI * k) / 4, 6), c, 4));
  const parts: CustomPart[] = [
    { id: "B", name: "Basket", size: [2 * rT + 8, HB, 2 * rT + 8], pos: c, material: "metal", pieces },
    { id: "L", name: "Lid", size: [D, LT, D], pos: [0, HB + LT / 2, 0], shape: "cyl", material: "board" },
  ];
  const pads: Vec3[] = [0, 1, 2, 3].map((k) => at(rB, Math.PI / 4 + (Math.PI * k) / 2, 0));
  return {
    parts,
    steps: [
      {
        title: "Stick the felt pads under the basket",
        detail: "Turn the basket upside down. Peel off four pads and press one onto the bottom ring at each quarter.",
        add: ["B"],
        fix: [{ kind: "glide", count: 4, at: pads, dir: [0, 1, 0], on: "B", len: 3, dia: 20 }],
        pose: "-y",
      },
      { title: "Turn it over and lay the lid on", detail: "The lid just rests in the top ring. Lift it by the slot to get inside.", add: ["L"], from: { L: [0, 220, 0] }, pose: "+y" },
    ],
  };
}

const family: Family = {
  names: ["KVISTBRO"],
  recipe(s) {
    if (!/storage table/i.test(s.variant)) return null;
    return recipe(s);
  },
};
export default family;
