import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import { rotate } from "../math";

/**
 * TEGELÖN, read from the chair's and the garden table's manuals.
 * - Chair: the woven back slides down over the frame's back posts and is bolted at the sides, the frame is laid
 *   upside down on the woven seat and bolted to it (washer and spring washer on each), then two more bolts lock
 *   the back at the bottom.
 * - Table: two hanger bolts go into the top of each leg; each pair of legs is bolted to a short rail to make an end
 *   frame (washer, spring washer and nut, tightened with the wrench), the end frames slide onto the upturned top
 *   and are bolted the same way, then four Allen bolts lock the corners and two people turn it over.
 */

const UP: Vec3 = [0, 1, 0];
const SIDES = [-1, 1];
const fx = (kind: CustomFix["kind"], at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, ...o });

/** One part drawn as several pieces placed where they sit in the product; its box and centre are worked out. */
function compound(id: string, name: string, abs: PartPiece[], material: PartMaterial): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of abs)
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const c of [-1, 1]) {
          const v = rotate([(a * p.size[0]) / 2, (b * p.size[1]) / 2, (c * p.size[2]) / 2], p.rot ?? [0, 0, 0]);
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], p.pos[k] + v[k]);
            hi[k] = Math.max(hi[k], p.pos[k] + v[k]);
          }
        }
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const size = [0, 1, 2].map((k) => hi[k] - lo[k]) as Vec3;
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] as Vec3 }));
  return { id, name, size, pos, pieces, material };
}

function tube(a: Vec3, b: Vec3, dia: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d);
  return { shape: "cyl", size: [dia, L, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(d[2], d[1]), 0, -Math.asin(d[0] / L)] };
}

function chair(s: ProductSpec): CustomParams {
  // IKEA: 58 wide, 61 deep, 83 high, seat 52 x 48 at 45 high
  const W = s.size.w * 10 || 580, D = s.size.d * 10 || 610, H = s.size.h * 10 || 830;
  const T = 20, ys = 410; // tubes; the seat rail
  const xs = W / 2 - 50, zs = D / 2 - 80, zb = -D / 2 + 90; // seat rail corners
  const xF = W / 2 - T / 2, zF = D / 2 - T / 2 - 20, zB = -D / 2 + T / 2 + 20;
  const postTop = ys + 120; // the back posts stand up above the seat rail
  const frame = compound("F", "Leg frame", [
    ...SIDES.flatMap((sx) => [tube([sx * xF, 0, zF], [sx * xs, ys, zs], T), tube([sx * xF, 0, zB], [sx * xs, ys, zb], T), tube([sx * xs, ys, zs], [sx * xs, ys, zb], T)]),
    tube([-xs, ys, zs], [xs, ys, zs], T),
    tube([-xs, ys, zb], [xs, ys, zb], T),
    ...SIDES.map((k) => tube([k * xs, ys, zb], [k * xs, postTop, zb - 10], T)),
  ], "metal");
  // the woven back: a panel leaning back, with a tube down each side that slides over the posts
  const b0: Vec3 = [0, ys + 70, zb - 20], b1: Vec3 = [0, H - 20, -D / 2 + 20];
  const tilt = Math.atan2(b1[2] - b0[2], b1[1] - b0[1]);
  const len = Math.hypot(b1[1] - b0[1], b1[2] - b0[2]);
  const mid: Vec3 = [0, (b0[1] + b1[1]) / 2, (b0[2] + b1[2]) / 2];
  const back = compound("B", "Woven back", [
    { shape: "box", size: [W - 60, len, 30], pos: mid, rot: [tilt, 0, 0], material: "soft" },
    ...SIDES.map((k) => tube([k * xs, postTop - 100, zb - 10], [k * xs, b0[1] + 30, b0[2]], T + 8)),
  ], "metal");
  const seat = compound("S", "Woven seat", [{ shape: "box", size: [W - 60, 40, D - 130], pos: [0, ys + T / 2 + 20, 25] }], "soft");
  // one bolt from the outside of each post, going in towards the middle
  const sideBolts = (y: number): CustomFix[] => SIDES.map((k) => fx("bolt", [[k * (xs + T / 2 + 4), y, zb - 10]], { len: 16, dia: 6, dir: [-k, 0, 0], mate: "F" }));
  const seatBolts: Vec3[] = SIDES.flatMap((k) => [zs - 40, zb + 40].map((z): Vec3 => [k * xs, ys - T / 2, z]));
  return {
    parts: [frame, back, seat],
    steps: [
      { title: "Lower the back onto the back posts", detail: "Slide the tubes on each side of the woven back down over the two posts.", add: ["F", "B"], from: { B: [0, 300, 0] } },
      { title: "Line up the holes", detail: "Lift the back a little until the holes in its tubes meet the holes in the posts." },
      {
        title: "Bolt the back to the posts",
        detail: "One bolt through each side. Tighten them with the Allen key.",
        fix: sideBolts(postTop - 30),
        tools: ["allen"],
      },
      {
        title: "Lay the frame upside down on the seat",
        detail: "Put the woven seat face down on a table with a cloth under it, the right way round, and stand the frame on it. A bolt with a washer and a spring washer goes in each corner.",
        add: ["S"],
        fix: [fx("bolt", seatBolts, { len: 20, dia: 6, dir: UP, mate: "S" }), fx("washer", seatBolts, { len: 2, dia: 16, dir: UP }), fx("washer", seatBolts, { name: "Spring washer", len: 2, dia: 12, dir: UP })],
        tools: ["allen"],
        pose: "-y",
      },
      {
        title: "Tighten the seat bolts and lock the back",
        detail: "Tighten all four seat bolts, then put one more bolt through each back post below the first ones.",
        fix: sideBolts(postTop - 80),
        tools: ["allen"],
      },
      { title: "Stand the chair up", pose: "+y" },
    ],
  };
}

function table(s: ProductSpec): CustomParams {
  // IKEA: 216 x 86, 75 high
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 20, ay = 60; // top slab, apron height under it
  const ya = H - tt - ay; // bottom of the aprons
  const xl = W / 2 - 60, zl = D / 2 - 60;
  const top = compound("T", "Table top", [
    { shape: "box", size: [W, tt, D], pos: [0, H - tt / 2, 0] },
    ...SIDES.map((k): PartPiece => ({ shape: "box", size: [W - 60, ay, 20], pos: [0, ya + ay / 2, k * (D / 2 - 20)] })),
    // cross bars under the slab, and a corner bracket inside each end of the aprons
    ...[-0.3, -0.1, 0.1, 0.3].map((f): PartPiece => ({ shape: "box", size: [30, 30, D - 60], pos: [f * W, H - tt - 15, 0] })),
    ...SIDES.flatMap((sx) => SIDES.map((sz): PartPiece => ({ shape: "box", size: [8, ay - 10, 50], pos: [sx * (xl - 45), ya + ay / 2, sz * (zl + 5)] }))),
  ], "metal");
  const legs = SIDES.flatMap((sx, i) =>
    SIDES.map((sz, j): CustomPart => ({
      id: `L${i}${j}`,
      name: "Leg",
      size: [50, H - tt, 50],
      pos: [sx * xl, (H - tt) / 2, sz * zl],
      pieces: [
        { shape: "cyl", size: [44, H - tt - ay, 44], pos: [0, -ay / 2, 0] },
        { shape: "box", size: [50, ay, 50], pos: [0, (H - tt) / 2 - ay / 2, 0] },
      ],
      material: "metal",
    })),
  );
  const rails = SIDES.map((sx, i): CustomPart => ({ id: `R${i}`, name: "End rail", size: [25, ay, 2 * zl - 50], pos: [sx * xl, ya + ay / 2, 0], material: "metal" }));
  const yb = ya + ay / 2;
  // two hanger bolts in each leg's top block: one into the end rail, one into the top's corner bracket
  const toRail = (sx: number): Vec3[] => SIDES.map((sz): Vec3 => [sx * xl, yb, sz * (zl - 25)]);
  const toTop = (sx: number): Vec3[] => SIDES.map((sz): Vec3 => [sx * (xl - 25), yb, sz * zl]);
  const all = (f: (sx: number) => Vec3[]) => SIDES.flatMap(f);
  const railNuts = SIDES.flatMap((sx) => SIDES.map((sz): Vec3 => [sx * xl, yb, sz * (zl - 45)]));
  const topNuts = SIDES.flatMap((sx) => SIDES.map((sz): Vec3 => [sx * (xl - 49), yb, sz * zl]));
  // a washer, a spring washer and a nut on each bolt; every point of a set faces the same way
  const nutSet = (pts: Vec3[], dir: Vec3): CustomFix[] => [
    fx("washer", pts, { len: 2, dia: 16, dir }),
    fx("washer", pts, { name: "Spring washer", len: 2, dia: 12, dir }),
    fx("nut", pts, { len: 8, dia: 13, dir }),
  ];
  const legIds = (i: number) => [`L${i}0`, `L${i}1`];
  return {
    parts: [top, ...legs, ...rails],
    steps: [
      {
        title: "Screw two hanger bolts into each leg",
        detail: "Into the holes in the block at the top, by hand, until they stop.",
        fix: SIDES.flatMap((sx, i) => [
          ...legIds(i).map((id, j) => fx("legScrew", [toRail(sx)[j]], { len: 40, dia: 8, dir: [0, 0, -SIDES[j]], on: id, mate: `R${i}` })),
          ...legIds(i).map((id, j) => fx("legScrew", [toTop(sx)[j]], { len: 40, dia: 8, dir: [-sx, 0, 0], on: id, mate: "T" })),
        ]),
        wait: [...legIds(0), ...legIds(1)],
      },
      {
        title: "Push two legs onto each end rail",
        detail: "The hanger bolts go through the holes in the rail's end brackets.",
        add: ["R0", ...legIds(0), "R1", ...legIds(1)],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Fit the washers and nuts and tighten them",
        detail: "A washer, a spring washer and a nut on each bolt. Tighten with the wrench until the spring washer is flat.",
        fix: SIDES.flatMap((sz) => nutSet(railNuts.filter((p) => Math.sign(p[2]) === sz), [0, 0, -sz])),
        tools: ["wrench"],
      },
      {
        title: "Slide the end frames onto the upturned top",
        detail: "Lay the top upside down on a rug. The second hanger bolt in each leg goes into the corner bracket.",
        add: ["T"],
        warnings: ["floor"],
      },
      {
        title: "Fit the washers and nuts and tighten them",
        detail: "The same as before: washer, spring washer and nut, then the wrench.",
        fix: SIDES.flatMap((sx) => nutSet(topNuts.filter((p) => Math.sign(p[0]) === sx), [-sx, 0, 0])),
        tools: ["wrench"],
      },
      { title: "Check every spring washer is flat", detail: "Go round all eight nuts and give any loose one another turn." },
      {
        title: "Lock each corner with an Allen bolt",
        detail: "Through the corner bracket into the leg, one at each corner.",
        fix: [fx("bolt", all((sx) => SIDES.map((sz): Vec3 => [sx * (xl - 40), ya + 12, sz * (zl - 30)])), { len: 20, dia: 6, dir: UP })],
        tools: ["allen"],
      },
      { title: "Turn the table over together", detail: "Lift it by the top, one person at each end, not by the legs.", pose: "+y", people: 2, warnings: ["two"] },
    ],
  };
}

const family: Family = {
  names: ["TEGELÖN", "TEGELON"],
  recipe(s) {
    const t = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
    if (/chair/.test(t)) return chair(s);
    if (/table/.test(t)) return table(s);
    return null;
  },
};
export default family;
