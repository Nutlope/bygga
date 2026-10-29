import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * STYRSPEL, read from the gaming chair's manual. The castors click into the base upside down on a rug, then the gas
 * lift stands in it. The seat lies upside down on a table: four catches under it are lifted, the mechanism goes on
 * with four bolts, the backrest's bracket slides into the mechanism and takes three bolts, then the two armrests slide
 * in from the sides and take four bolts, tightened in a step of their own. The seat is pressed onto the gas lift,
 * and the headrest clips onto the top of the backrest and is held by one bolt from behind.
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

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 71 x 69, 119 to 142 high, seat 50 x 47 at 48 to 59, armrests from 65
  const H = Math.round(s.size.h * 10) || 1190;
  const R = 340, AY0 = 60, AY1 = 105; // the base waits beside the seat, 2R + 180 to the right, until the seat goes on
  const SY = 480, MY = 375; // top of the seat, underside of the mechanism
  const angles = [0, 1, 2, 3, 4].map((i) => (i * 2 * Math.PI) / 5 + Math.PI);
  const legs: PartPiece[] = angles.map((a) => ({ shape: "box", size: [45, AY1 - AY0, R - 20], pos: [(Math.sin(a) * (R + 20)) / 2, (AY0 + AY1) / 2 - 95, (Math.cos(a) * (R + 20)) / 2], rot: [0, a, 0] }));
  const base: CustomPart = {
    id: "BA",
    name: "Star base",
    size: [2 * R, 130, 2 * R],
    pos: [0, 95, 0],
    material: "metal",
    pieces: [{ shape: "cyl", size: [80, 100, 80], pos: [0, 15, 0] }, ...legs],
  };
  const by0 = 560, by1 = H - 130, bz = -290;
  const back = boxes("K", "Backrest", [
    [[-250, by1 - 300, bz - 15], [-225, by1, bz + 15]],
    [[225, by1 - 300, bz - 15], [250, by1, bz + 15]],
    [[-200, by0, bz - 15], [-175, by1 - 300, bz + 15]],
    [[175, by0, bz - 15], [200, by1 - 300, bz + 15]],
    [[-225, by1 - 30, bz - 15], [225, by1, bz + 15]],
    [[-200, by0 + 80, bz - 4], [200, by1 - 30, bz + 4], "fiber"],
    // the bracket: from under the mechanism back, then up behind the seat
    [[-40, MY - 25, -300], [40, MY - 5, -95], "metal"],
    [[-40, MY - 25, bz - 20], [40, by0 + 80, bz], "metal"],
  ], "board");
  const parts: CustomPart[] = [
    base,
    { id: "G", name: "Gas lift", shape: "cyl", material: "metal", size: [50, MY - 140, 50], pos: [0, (MY + 140) / 2, 0] },
    boxes("S", "Seat", [[[-250, MY + 45, -210], [250, SY, 260]]], "soft"),
    boxes("M", "Mechanism", [[[-100, MY, -130], [100, MY + 45, 100]], [[100, MY + 10, 40], [230, MY + 22, 52]]], "metal"),
    back,
    ...[-1, 1].map((g, i) =>
      boxes(`A${i + 1}`, "Armrest", [
        // the bar slides into a slot in the side of the mechanism
        [[Math.min(g * 60, g * 285), MY + 12, -60], [Math.max(g * 60, g * 285), MY + 32, 20]],
        [[Math.min(g * 260, g * 285), MY + 32, -40], [Math.max(g * 260, g * 285), 630, 0]],
        [[Math.min(g * 240, g * 300), 630, -130], [Math.max(g * 240, g * 300), 655, 110]],
      ], "board"),
    ),
    boxes("HR", "Headrest", [
      [[-15, by1 - 60, bz - 25], [-5, H - 60, bz - 15], "metal"],
      [[5, by1 - 60, bz - 25], [15, H - 60, bz - 15], "metal"],
      [[-150, H - 90, bz - 30], [150, H, bz + 20]],
    ], "fiber"),
  ];
  const ends = angles.map((a): Vec3 => [Math.sin(a) * (R - 20), AY0, Math.cos(a) * (R - 20)]);
  return {
    parts,
    steps: [
      {
        title: "Click the castors into the base",
        detail: "Lay the base upside down on a rug and push each castor in until it clicks.",
        fix: [fix("castor", ends, [0, 1, 0], { len: 60, dia: 55, on: "BA" })],
        wait: ["BA"],
        pose: "-y",
        warnings: ["floor"],
      },
      { title: "Stand the gas lift in the base", detail: "Turn the base onto its castors and drop the gas lift into the hole, narrow end up.", wait: ["G"], from: { G: [(2 * R + 180) / 1.6, 0, 0] }, pose: "+y" },
      {
        title: "Lift the catches under the seat",
        detail: "Lay the seat upside down on a table with a cloth under it. Pull the four catches up until they click.",
        add: ["S"],
        pose: "-y",
      },
      {
        title: "Bolt the mechanism under the seat",
        detail: "Four long bolts, put in by hand first, then tightened with the Allen key.",
        add: ["M"],
        fix: [fix("bolt", [-1, 1].flatMap((g) => [-100, 70].map((z): Vec3 => [g * 75, MY, z])), [0, 1, 0], { len: 30, dia: 8, on: "M", mate: "S" })],
        tools: ["allen"],
      },
      { title: "Slide the backrest into the mechanism", detail: "Push its bracket into the back of the mechanism as far as it goes.", add: ["K"], from: { K: [0, 0, -350] } },
      {
        title: "Bolt the backrest on",
        detail: "Three long bolts through the bracket. Then turn the seat over onto its back on the table.",
        fix: [fix("bolt", [-25, 0, 25].map((x): Vec3 => [x, MY - 25, -112]), [0, 1, 0], { len: 30, dia: 8, on: "K", mate: "M" })],
        tools: ["allen"],
      },
      { title: "Slide in the armrests", detail: "One from each side, into the slots under the seat.", add: ["A1", "A2"], from: { A1: [-300, 0, 0], A2: [300, 0, 0] } },
      {
        title: "Bolt the armrests on",
        detail: "Two short bolts in each, round heads, turned in by hand first.",
        fix: [-1, 1].map((g, i) => fix("bolt", [-40, 0].map((z): Vec3 => [g * 80, MY, z]), [0, 1, 0], { len: 16, dia: 8, on: "M", mate: `A${i + 1}` })),
        tools: ["allen"],
      },
      { title: "Tighten the armrest bolts", detail: "All four, firmly, so the heads sit flat.", tools: ["allen"] },
      {
        title: "Press the seat onto the gas lift",
        detail: "Turn the seat over, set the mechanism on top of the gas lift and push down hard.",
        add: ["BA", "G"],
        from: { BA: [0, -300, 0], G: [0, -300, 0] },
        pose: "+y",
      },
      { title: "Clip on the headrest", detail: "Hook it over the top of the backrest and press until it snaps in.", add: ["HR"], from: { HR: [0, 250, 0] } },
      {
        title: "Bolt the headrest",
        detail: "One bolt from behind, with the Allen key.",
        // through one of the headrest's prongs into the backrest's top bar
        fix: [fix("bolt", [[10, by1 - 15, bz - 28]], [0, 0, 1], { len: 16, dia: 6, on: "HR", mate: "K" })],
        tools: ["allen"],
      },
    ],
  };
}

const family: Family = { names: ["STYRSPEL"], recipe };
export default family;
