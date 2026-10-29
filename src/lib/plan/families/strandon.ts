import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * STRANDÖN beach furniture comes ready to use: IKEA lists no assembly manual for the sun lounger or the folding
 * stool. Their guides only unfold them: the lounger is a fabric seat and backrest with a steel stand that swings out
 * behind the back, the stool two steel U frames crossed under a fabric seat.
 */

const tube = (from: Vec3, to: Vec3, dia: number): PartPiece => {
  const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  // a cylinder stands along y; lean it over in its own plane
  const rot: Vec3 = Math.abs(d[2]) > Math.abs(d[0]) ? [Math.atan2(d[2], d[1]), 0, 0] : [0, 0, -Math.atan2(d[0], d[1])];
  return { shape: "cyl", size: [dia, len, dia], pos: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], rot };
};
/** A part from pieces given in product mm: its box round them, the pieces made relative to its centre. */
function partOf(id: string, name: string, material: CustomPart["material"], pieces: PartPiece[], box: [Vec3, Vec3]): CustomPart {
  const c: Vec3 = [0, 1, 2].map((k) => (box[0][k] + box[1][k]) / 2) as Vec3;
  return { id, name, material, size: [0, 1, 2].map((k) => box[1][k] - box[0][k]) as Vec3, pos: c, pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 })) };
}

function lounger(s: ProductSpec): CustomParams {
  const L = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10), Wd = Math.round(s.size.d * 10);
  const t = 14;
  const x0 = -L / 2, xk = x0 + 560; // seat from the foot end to the fold
  const topX = xk + 190; // the backrest leans back
  const back = Math.hypot(topX - xk, H);
  const lean = Math.atan2(topX - xk, H);
  const parts: CustomPart[] = [
    { id: "S", name: "Seat", size: [xk - x0, t, Wd], pos: [(x0 + xk) / 2, t / 2, 0], material: "soft" },
    { id: "B", name: "Backrest", size: [topX - xk + t, H, Wd], pos: [(xk + topX) / 2, H / 2, 0], material: "soft", pieces: [{ shape: "box", size: [t, back, Wd], pos: [0, 0, 0], rot: [0, 0, -lean] }] },
    partOf("F", "Stand", "metal", [
      ...[-1, 1].map((g) => tube([topX - 20, H - 40, g * (Wd / 2 - 20)], [L / 2 - 10, 6, g * (Wd / 2 - 20)], 12)),
      { shape: "cyl", size: [12, Wd - 40, 12], pos: [L / 2 - 10, 6, 0], rot: [Math.PI / 2, 0, 0] },
    ], [[topX - 30, 0, -Wd / 2 + 10], [L / 2, H - 30, Wd / 2 - 10]]),
  ];
  return {
    parts,
    steps: [
      { title: "Unfold the lounger on the ground", detail: "It comes folded flat and ready to use. Lay the seat out flat and lift the backrest.", add: ["S", "B"] },
      { title: "Swing out the stand", detail: "Fold the steel stand out from behind the backrest until its bar rests on the ground. It holds the back up.", add: ["F"], from: { F: [-300, 0, 0] } },
      { title: "Tuck your towel under the bands", detail: "The two elastic bands on the backrest hold a towel or sunglasses in the wind." },
    ],
  };
}

function stool(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10), D = Math.round(s.size.d * 10);
  const tz = 145, fz = D / 2 - 10; // top rails and feet, front to back
  const yr = H - 10;
  const frame = (id: string, x: number, sign: 1 | -1) => partOf(id, "Frame", "metal", [
    ...[-1, 1].map((g) => tube([g * x, yr, sign * tz], [g * x, 8, -sign * fz], 16)),
    // one frame carries the front rail, the other the back one
    { shape: "cyl", size: [16, 2 * x + 16, 16], pos: [0, yr, sign * tz], rot: [0, 0, Math.PI / 2] },
  ], [[-x - 8, 0, -fz - 8], [x + 8, yr + 8, fz + 8]]);
  const parts: CustomPart[] = [
    frame("A", W / 2 - 8, 1),
    frame("B", W / 2 - 26, -1),
    { id: "S", name: "Seat", size: [2 * (W / 2 - 26) - 40, 3, 2 * tz], pos: [0, yr + 8, 0], material: "soft" },
  ];
  return {
    parts,
    steps: [
      { title: "Open the stool", detail: "It comes folded and ready to use. Pull the two frames apart until the seat fabric is tight.", add: ["A", "B", "S"] },
      { title: "Check it stands firm", detail: "All four feet with their caps on the ground, on a flat spot." },
    ],
  };
}

const family: Family = {
  names: ["STRANDÖN", "STRANDON"],
  recipe(s) {
    if (/lounger/i.test(s.variant)) return lounger(s);
    if (/stool/i.test(s.variant)) return stool(s);
    return null;
  },
};
export default family;
