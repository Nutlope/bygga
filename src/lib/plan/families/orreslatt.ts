import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ORRESLÄTT, read from the armchair's manual. One step: the woven rattan hoop lies upside down on a rug, the steel
 * leg frame (welded in one piece) goes on and four bolts with square washers fix it, washers sitting flat in their
 * recesses. Then the chair is stood up.
 */

const TUBE = 20;

/** A round tube from a to b, as a piece of a part centred at c. */
function rod(a: Vec3, b: Vec3, c: Vec3): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return {
    shape: "cyl",
    size: [TUBE, Math.hypot(...d), TUBE],
    pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]],
    rot: [Math.atan2(d[2], d[1]), 0, -Math.atan2(d[0], Math.hypot(d[1], d[2]))],
  };
}

function armchair(s: ProductSpec): CustomParams {
  // IKEA: 69 wide, 72 deep, 66 high, seat 46 high
  const W = s.size.w * 10 || 690, D = s.size.d * 10 || 720, H = s.size.h * 10 || 660;
  const tilt = 0.6; // the hoop leans back
  const hoopD = Math.min(D, 700), hoopT = 26;
  const yc = H - (hoopD / 2) * Math.sin(tilt) - 10; // centre of the hoop
  const under = (z: number) => yc - z * Math.tan(tilt) - hoopT / 2 / Math.cos(tilt); // underside of the hoop above z
  const xt = 190, zf = 170, zb = -150; // where the leg frame meets the seat
  const xf = W / 2 - TUBE, zF = D / 2 - TUBE, zB = -D / 2 + TUBE;
  const tops: Vec3[] = [[-xt, under(zf) - TUBE / 2, zf], [xt, under(zf) - TUBE / 2, zf], [-xt, under(zb) - TUBE / 2, zb], [xt, under(zb) - TUBE / 2, zb]];
  const feet: Vec3[] = [[-xf, 0, zF], [xf, 0, zF], [-xf, 0, zB], [xf, 0, zB]];
  const yTopMax = Math.max(...tops.map((p) => p[1]));
  const c: Vec3 = [0, (yTopMax + TUBE / 2) / 2, 0];
  const at = (a: Vec3, b: Vec3, f: number): Vec3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  const k = 150 / tops[0][1]; // the side stretchers run about 15 cm up
  const legs: PartPiece[] = [
    ...tops.map((t, i) => rod(feet[i], t, c)),
    rod(tops[0], tops[2], c),
    rod(tops[1], tops[3], c),
    rod(at(feet[0], tops[0], k), at(feet[2], tops[2], 150 / tops[2][1]), c),
    rod(at(feet[1], tops[1], k), at(feet[3], tops[3], 150 / tops[3][1]), c),
  ];
  const parts: CustomPart[] = [
    { id: "SEAT", name: "Rattan seat", shape: "cyl", size: [W - 10, hoopT, hoopD], pos: [0, yc, 0], rot: [tilt, 0, 0], material: "wood" },
    { id: "LEGS", name: "Leg frame", size: [W, yTopMax + TUBE / 2, D], pos: c, pieces: legs, material: "metal" },
  ];
  return {
    parts,
    steps: [
      {
        title: "Lay the seat upside down",
        detail: "Put it face down on a rug so the rattan isn't scratched.",
        add: ["SEAT"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Bolt the leg frame to the seat",
        detail: "Set the frame's four plates over the holes. Start each bolt by hand with its square washer sitting flat in the recess, then tighten with the Allen key.",
        add: ["LEGS"],
        fix: [{ kind: "bolt", count: 4, len: 16, dia: 6, at: tops.map((t): Vec3 => [t[0], under(t[2]) - 4, t[2]]), dir: [0, 1, 0], on: "LEGS", mate: "SEAT" }],
      },
      { title: "Stand the chair up", detail: "Lift it by the frame and set it on its feet.", pose: "+y" },
    ],
  };
}

const family: Family = {
  names: ["ORRESLÄTT", "ORRESLATT"],
  recipe: (s) => (/armchair/i.test(`${s.variant} ${s.slug ?? ""}`) ? armchair(s) : null),
};
export default family;
