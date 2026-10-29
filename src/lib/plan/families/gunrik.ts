import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * GUNRIK child's desk chair, read from its manual. No gas lift: the seat and the backrest both clamp onto one tall
 * sliding bar with a height scale. The four-legged base lies upside down for its castors, the bar goes up through
 * its hub and is bolted from below (two bolts, each with a spring washer and a washer). The seat lies upside down on
 * a table for its two armrests (three bolts each), then slides down the bar and locks with its knob. The backrest gets
 * its clamp with four bolts and slides on from the top, then a cap clicks onto the bar and a stop clicks into it.
 * IKEA's sizes: 58 wide, 63 deep, 102 high, seat 29 to 47 cm high.
 */

/** One part drawn as boxes given in finished-product mm. */
function boxes(id: string, name: string, list: [Vec3, Vec3, PartMaterial?][], material: PartMaterial): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...list.map((b) => b[0][k]))) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(...list.map((b) => b[1][k]))) as Vec3;
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const pieces: PartPiece[] = list.map(([a, b, m]) => ({
    shape: "box",
    size: [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    pos: [(a[0] + b[0]) / 2 - pos[0], (a[1] + b[1]) / 2 - pos[1], (a[2] + b[2]) / 2 - pos[2]],
    ...(m ? { material: m } : {}),
  }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos, material, pieces };
}
const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

function chair(s: ProductSpec): CustomParams {
  const H = Math.round(s.size.h * 10) || 1020;
  const zc = -40; // the hub and the bar, a little behind the middle
  const R = 345; // leg reach from the hub
  const bar = 40, top = H - 20; // the bar's top, under its cap
  const SY = 440; // top of the seat
  const by0 = 560, by1 = top - 20; // backrest

  // base: a hub and four legs on the diagonals, sloping down to the castors
  const angles = [1, 3, 5, 7].map((i) => (i * Math.PI) / 4);
  const legLen = R - 40;
  const base: CustomPart = {
    id: "A",
    name: "Star base",
    material: "metal",
    size: [2 * R * Math.SQRT1_2 + 40, 80, 2 * R * Math.SQRT1_2 + 40],
    pos: [0, 100, zc],
    pieces: [
      { shape: "cyl", size: [80, 80, 80], pos: [0, 0, 0] },
      ...angles.map((a): PartPiece => ({ shape: "box", size: [44, 30, legLen], pos: [Math.sin(a) * (40 + legLen / 2), -20, Math.cos(a) * (40 + legLen / 2)], rot: [0, a, 0] })),
    ],
  };
  const parts: CustomPart[] = [
    base,
    { id: "C", name: "Sliding bar", shape: "cyl", material: "metal", size: [bar, top - 60, bar], pos: [0, (top + 60) / 2, zc] },
    // the seat with its clamp round the bar at the back and the knob that locks it
    boxes("S", "Seat", [
      [[-220, SY - 70, zc + 30], [220, SY, zc + 400], "soft"],
      [[-190, SY - 90, zc + 50], [190, SY - 70, zc + 370]],
      [[-40, SY - 110, zc - 30], [40, SY - 20, zc + 30], "metal"],
      [[-30, SY - 90, zc + 30], [30, SY - 70, zc + 60], "metal"],
      [[-15, SY - 80, zc - 60], [15, SY - 50, zc - 30], "metal"],
    ], "soft"),
  ];
  // armrests: a bar under the seat, a post up its side, a pad on top
  for (const [i, g] of [[0, -1], [1, 1]] as const) {
    const xs = (a: number, b: number): [number, number] => [Math.min(g * a, g * b), Math.max(g * a, g * b)];
    const [x0, x1] = xs(110, 260), [p0, p1] = xs(240, 270), [q0, q1] = xs(232, 288);
    parts.push(
      boxes(`A${i}`, "Armrest", [
        [[x0, SY - 110, zc + 150], [x1, SY - 90, zc + 220]],
        [[p0, SY - 110, zc + 160], [p1, 610, zc + 200]],
        [[q0, 610, zc + 80], [q1, 630, zc + 300]],
      ], "board"),
    );
  }
  parts.push(
    boxes("K", "Backrest clamp", [
      [[-40, 600, zc - 30], [40, 720, zc + 30]],
      [[-60, 600, zc + 30], [60, 720, zc + 50]],
      [[-15, 640, zc - 60], [15, 670, zc - 30]],
      [[40, 640, zc - 15], [70, 670, zc + 15]],
    ], "metal"),
    {
      id: "D",
      name: "Backrest",
      size: [420, by1 - by0, 70],
      pos: [0, (by0 + by1) / 2, zc + 85],
      material: "soft",
      pieces: [{ shape: "cyl", size: [420, 70, by1 - by0], pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] }],
    },
  );

  const tips = angles.map((a): Vec3 => [Math.sin(a) * (R - 20), 60, zc + Math.cos(a) * (R - 20)]);
  const foot: Vec3[] = [-15, 15].map((x): Vec3 => [x, 60, zc]);
  const armBolts = (g: number, on: string) => fix("bolt", [160, 185, 210].map((z, k): Vec3 => [g * (k === 1 ? 180 : 140), SY - 110, zc + z]), [0, 1, 0], { len: 30, dia: 6, on, mate: "S" });
  return {
    parts,
    steps: [
      {
        title: "Press a castor into each leg",
        detail: "Lay the base upside down on a rug. Push each castor straight in until it clicks.",
        add: ["A"],
        fix: [fix("castor", tips, [0, 1, 0], { len: 58, dia: 50, on: "A" })],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Push the bar into the hub and bolt it",
        detail: "Scale facing back. Two bolts from below, each with a spring washer and a washer, tightened with the Allen key.",
        add: ["C"],
        from: { C: [0, -700, 0] },
        fix: [
          fix("washer", foot, [0, 1, 0], { on: "A", dia: 16 }),
          fix("washer", foot, [0, 1, 0], { on: "A", dia: 12, name: "Spring washer" }),
          fix("bolt", foot, [0, 1, 0], { len: 20, dia: 8, on: "A", mate: "C" }),
        ],
        tools: ["allen"],
      },
      {
        title: "Bolt the armrests under the seat",
        detail: "Lay the seat upside down on a table. Three of the long bolts through each armrest into the seat.",
        fix: [armBolts(-1, "A0"), armBolts(1, "A1")],
        wait: ["S", "A0", "A1"],
        // all three wait together, the armrests against the seat they bolt into
        from: { S: [800, 0, 0], A0: [800, 0, 0], A1: [800, 0, 0] },
        tools: ["allen"],
      },
      {
        title: "Slide the seat down the bar",
        detail: "Stand the base up. Pull the knob on the clamp out, lower the seat onto the bar, then let the knob go.",
        add: ["S", "A0", "A1"],
        from: { S: [0, 650, 0], A0: [0, 650, 0], A1: [0, 650, 0] },
        pose: "+y",
      },
      {
        title: "Lock the seat at its height",
        detail: "Slide it until the knob clicks into a hole on the scale, then turn the knob to tighten it.",
      },
      {
        title: "Bolt the clamp to the backrest",
        detail: "Four short bolts through the clamp into the back of the backrest.",
        fix: [fix("bolt", [-1, 1].flatMap((g) => [625, 695].map((y): Vec3 => [g * 40, y, zc + 50])), [0, 0, 1], { len: 16, dia: 6, on: "K", mate: "D" })],
        wait: ["K", "D"],
        tools: ["allen"],
      },
      {
        title: "Slide the backrest onto the bar",
        detail: "From the top. Pull out the knob, set the height, let it click into place, then tighten both knobs.",
        add: ["K", "D"],
        from: { K: [0, 600, 0], D: [0, 600, 0] },
      },
      {
        title: "Click the cap onto the top of the bar",
        detail: "Press it down until it clicks, so the backrest can't come off the top.",
        fix: [fix("cap", [[0, top, zc]], [0, -1, 0], { on: "C", len: 20, dia: 44, name: "Bar cap" })],
      },
      {
        title: "Click the stop into the bar",
        detail: "Into the slot at the back of the bar, between the seat and the backrest, until it clicks.",
        fix: [fix("clip", [[0, 520, zc - bar / 2]], [0, 0, 1], { on: "C", len: 14, dia: 10, name: "Stop" })],
      },
    ],
  };
}

const family: Family = {
  names: ["GUNRIK"],
  recipe(s) {
    if (!/chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return chair(s);
  },
};
export default family;
