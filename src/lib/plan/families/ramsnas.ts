import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, Vec3 } from "../../types";

/**
 * RAMSNÄS chair, read from its manual. The seat comes on its steel frame with the four legs and the cushion. Upside
 * down on a table, with the back edge just over the edge, the back frame's two tubes slide up into the brackets at
 * the back of the seat frame. Two bolts with washers go through each bracket, turned in by hand and then tightened.
 */

const BOLT = { name: "Allen bolt", len: 20, dia: 6 };

function part(id: string, name: string, abs: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...abs.map((p) => p.pos[k] - p.size[k] / 2)));
  const hi = [0, 1, 2].map((k) => Math.max(...abs.map((p) => p.pos[k] + p.size[k] / 2)));
  const c = lo.map((v, k) => (v + hi[k]) / 2) as Vec3;
  return {
    id,
    name,
    size: lo.map((v, k) => hi[k] - v) as Vec3,
    pos: c,
    material,
    pieces: abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 })),
  };
}
const box = (lo: Vec3, hi: Vec3, material?: CustomPart["material"]): PartPiece => ({ shape: "box", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], material });

/** A rod (round, or square when shape is box) from a to b. */
function rod(a: Vec3, b: Vec3, t: number, shape: "cyl" | "box" = "cyl"): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  return { shape, size: [t, len, t], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(d[2], d[1]), 0, -Math.atan2(d[0], Math.hypot(d[1], d[2]))] };
}

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function chair(): CustomParams {
  // IKEA: 48 wide, 52 deep, 83 high; the seat 43 wide and 40 deep, 49 high on the cushion
  const yA0 = 390, yA1 = 455, X = 215, Z0 = -200, Z1 = 200;
  const legs: PartPiece[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => rod([sx * (X - 15), yA0, sz * (sz > 0 ? Z1 - 15 : -Z0 - 15)], [sx * (X + 15), 0, sz * (sz > 0 ? Z1 + 30 : -Z0 + 5)], 30, "box")));
  // each back tube runs from the floor up through the bracket at the back corner of the seat (centre yB, zB)
  const yB = 422, zB = Z0 - 20, dx = 12 / 800, dz = 32 / 800;
  const tubeAt = (y: number): [number, number] => [X - dx * (y - yB), zB - dz * (y - yB)];
  const [xT, zT] = tubeAt(800);
  const post = (sx: number): PartPiece => rod([sx * tubeAt(0)[0], 0, tubeAt(0)[1]], [sx * xT, 800, zT], 18);
  const parts: CustomPart[] = [
    part("SEAT", "Seat with legs", [
      box([-X, yA0, Z0], [X, yA1, Z1], "metal"),
      box([-X + 5, yA1, Z0 + 5], [X - 5, 490, Z1 - 5], "soft"),
      ...legs,
      ...[-1, 1].map((sx) => box([sx * X - 12, yA0 + 5, Z0 - 40], [sx * X + 12, yA1 - 5, Z0], "metal")),
    ], "metal"),
    part("BACK", "Back frame", [
      post(-1),
      post(1),
      rod([-xT, 805, zT], [xT, 805, zT], 18),
      ...[650, 730].map((y) => box([-(xT - 3), y - 22, tubeAt(y)[1] + 6], [xT - 3, y + 22, tubeAt(y)[1] + 12])),
    ], "metal"),
  ];
  // from outside, through the bracket into the tube; the washers sit under the heads
  const holes = (sx: number) => [410, 435].map((y): Vec3 => [sx * (X + 12), y, zB]);
  const bolts = (sx: number) => fx("bolt", holes(sx), [-sx, 0, 0], "SEAT", { ...BOLT, mate: "BACK" });
  const washers = (sx: number) => fx("washer", holes(sx), [-sx, 0, 0], "SEAT");
  const steps: CustomStep[] = [
    {
      title: "Slide the back frame into the seat",
      detail: "Lay the seat upside down on a table, its back edge just over the edge. Push the back frame's tubes up into the brackets as far as they go.",
      add: ["SEAT", "BACK"],
      pose: "-y",
      from: { BACK: [0, -320, 0] },
    },
    {
      title: "Bolt the left bracket by hand",
      detail: "Two bolts with washers through the bracket into the tube. Hold the back frame steady with your other hand.",
      fix: [bolts(-1), washers(-1)],
      warnings: ["loose"],
    },
    {
      title: "Bolt the right bracket and tighten",
      detail: "Two more bolts on the other side, then tighten all four with the Allen key.",
      fix: [bolts(1), washers(1)],
      tools: ["allen"],
    },
    { title: "Stand the chair up", detail: "Turn it over onto its feet. The cushion's cover can be taken off for washing later.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["RAMSNÄS", "RAMSNAS"],
  recipe(s) {
    if (!/chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return chair();
  },
};
export default family;
