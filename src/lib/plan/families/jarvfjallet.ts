import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * JÄRVFJÄLLET office chair with armrests, read from IKEA's manual. The one-piece base is laid upside down for the
 * five castors and stood up, and the gas lift (cap off) goes in. The backrest is put together on a table: the lumbar
 * support is screwed to the frame with two screws, the cushion hooks over the frame's top bracket and folds down over
 * the bottom one, and is held with one bolt at the top and two at the bottom. The mechanism is bolted under the seat
 * with four bolts, the backrest's bar slides under the seat and takes three long bolts, the seat is pressed onto the
 * gas lift, the headrest slides onto the top of the frame with two screws, and each armrest takes three long bolts.
 * IKEA's sizes: 68 x 68 cm, up to 140 high, seat 52 x 46 from 45 to 56 cm. Drawn at the highest seat, as it
 * comes up before anyone has sat on it.
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
// x between distances a and b from the middle, on side g
const xs = (g: number, a: number, b: number): [number, number] => [Math.min(g * a, g * b), Math.max(g * a, g * b)];

function chair(s: ProductSpec): CustomParams {
  const R = (Math.round(s.size.w * 10) || 680) / 2 - 30; // reach of the legs, castors under their ends
  const AY0 = 60, AY1 = 95; // the base's arms
  const MY = 460, SY0 = 500, SY = 560; // mechanism underside, seat underside, seat top
  const angles = [0, 1, 2, 3, 4].map((i) => (i * 2 * Math.PI) / 5);
  const base: CustomPart = {
    id: "A",
    name: "Star base",
    material: "metal",
    size: [2 * R, 70, 2 * R],
    pos: [0, AY0 + 35, 0],
    pieces: [
      { shape: "cyl", size: [70, 70, 70], pos: [0, 0, 0] },
      ...angles.map((a): PartPiece => ({ shape: "box", size: [45, AY1 - AY0, R - 20], pos: [(Math.sin(a) * (R + 20)) / 2, (AY0 + AY1) / 2 - (AY0 + 35), (Math.cos(a) * (R + 20)) / 2], rot: [0, a, 0] })),
    ],
  };
  const parts: CustomPart[] = [
    base,
    { id: "G", name: "Gas lift", shape: "cyl", material: "metal", size: [50, MY - 110, 50], pos: [0, (MY + 110) / 2, 0] },
    // spine of the backrest: a bar under the seat, up behind the cushion, with a bracket for the cushion top and bottom
    boxes("B", "Backrest frame", [
      [[-50, SY0 - 30, -300], [50, SY0, -150]], // a flat plate that takes the three bolts
      [[-20, SY0 - 30, -310], [20, 1370, -300]],
      [[-60, 600, -300], [60, 630, -270]],
      [[-40, 1230, -300], [40, 1250, -270]],
    ], "metal"),
    boxes("U", "Lumbar support", [[[-120, 700, -300], [120, 780, -270]]], "board"),
    boxes("C", "Back cushion", [[[-240, 600, -270], [240, 1250, -210]]], "soft"),
    boxes("M", "Mechanism", [
      [[-100, MY, -130], [100, SY0, 120]],
      [[100, MY + 10, 40], [230, MY + 25, 60]], // height lever, on the right
    ], "metal"),
    boxes("S", "Seat", [[[-260, SY0, -210], [260, SY, 250]]], "soft"),
    boxes("H", "Headrest", [[[-150, 1280, -300], [150, 1400, -240]]], "soft"),
  ];
  for (const [i, g] of [[0, -1], [1, 1]] as const)
    parts.push(
      boxes(`R${i}`, "Armrest", [
        [[xs(g, 130, 280)[0], SY0 - 20, -60], [xs(g, 130, 280)[1], SY0, 60]],
        [[xs(g, 280, 305)[0], SY0 - 20, -40], [xs(g, 280, 305)[1], 820, 20]],
        [[xs(g, 255, 330)[0], 820, -140], [xs(g, 255, 330)[1], 845, 130]],
      ], "board"),
    );

  const ends = angles.map((a): Vec3 => [Math.round(Math.sin(a) * (R - 15)), AY0, Math.round(Math.cos(a) * (R - 15))]);
  const steps: CustomStep[] = [
    {
      title: "Push the castors into the base",
      detail: "Lay the base upside down on a rug and press each castor straight in until it snaps home.",
      add: ["A"],
      fix: [fix("castor", ends, [0, 1, 0], { len: 58, dia: 50 })],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Take the cap off the gas lift", detail: "Pull the plastic cap off its top and throw it away.", pose: "+y" },
    { title: "Stand the gas lift in the base", detail: "Stand the base on its castors. The narrow end goes up; it just sits in the hole for now.", add: ["G"], from: { G: [0, 300, 0] } },
    {
      title: "Screw the lumbar support to the backrest frame",
      detail: "Lay the frame flat on a table, the bar under the seat hanging over the edge. Two screws hold the support.",
      add: ["B", "U"],
      fix: [fix("screw", [-1, 1].map((g): Vec3 => [g * 70, 740, -270]), [0, 0, -1], { len: 12, dia: 6, on: "U", mate: "B" })],
      tools: ["allen"],
      from: { B: [0, 0, -400], U: [0, 0, 250] },
    },
    {
      title: "Hook the back cushion over the top bracket",
      detail: "Slip the pocket at the top of the cushion over the bracket at the top of the frame.",
      add: ["C"],
      from: { C: [0, 250, 150] },
    },
    { title: "Fold the cushion down over the frame", detail: "Pull it down until its bottom edge meets the bracket at the bottom of the frame." },
    {
      title: "Bolt the cushion on at the top",
      detail: "One short bolt through the top bracket.",
      fix: [fix("bolt", [[0, 1240, -300]], [0, 0, 1], { len: 12, dia: 6, on: "B", mate: "C" })],
      tools: ["allen"],
    },
    {
      title: "Bolt it at the bottom",
      detail: "Two bolts through the bottom bracket. The backrest is done; set it aside.",
      fix: [fix("bolt", [-1, 1].map((g): Vec3 => [g * 35, 615, -300]), [0, 0, 1], { len: 16, dia: 6, on: "B", mate: "C" })],
      tools: ["allen"],
    },
    {
      title: "Bolt the mechanism under the seat",
      detail: "Lay the seat upside down on the table, the lever on the right as you look at its front. Four bolts hold it.",
      add: ["S", "M"],
      fix: [fix("bolt", [-1, 1].flatMap((g) => [-90, 80].map((z): Vec3 => [g * 70, MY, z])), [0, 1, 0], { len: 16, dia: 6, on: "M", mate: "S" })],
      tools: ["allen"],
      from: { S: [0, 300, 0], M: [0, -300, 0] },
    },
    {
      title: "Bolt the backrest under the seat",
      detail: "Slide the bar at the bottom of the backrest in under the back of the seat. Three long bolts fix it.",
      fix: [fix("bolt", [[-30, SY0 - 30, -240], [30, SY0 - 30, -240], [0, SY0 - 30, -180]], [0, 1, 0], { len: 30, dia: 6, on: "B", mate: "S" })],
      tools: ["allen"],
    },
    {
      title: "Press the seat onto the gas lift",
      detail: "Set the mechanism over the top of the gas lift and push down. Sitting on it once locks it for good.",
    },
    {
      title: "Screw the headrest on",
      detail: "Slide it down onto the top of the frame, then two screws from behind.",
      add: ["H"],
      fix: [fix("screw", [1300, 1340].map((y): Vec3 => [0, y, -310]), [0, 0, 1], { len: 12, dia: 6, on: "B", mate: "H" })],
      tools: ["allen"],
      from: { H: [0, 300, 0] },
    },
    {
      title: "Bolt the armrests under the seat",
      detail: "Three long bolts from below through each arm into the seat.",
      add: ["R0", "R1"],
      fix: [fix("bolt", [-1, 1].flatMap((g) => [160, 210, 255].map((x, i): Vec3 => [g * x, SY0 - 20, i === 1 ? 30 : -30])), [0, 1, 0], { len: 30, dia: 6 })],
      tools: ["allen"],
      from: { R0: [-300, 0, 0], R1: [300, 0, 0] },
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["JÄRVFJÄLLET", "JARVFJALLET"],
  recipe(s) {
    if (!/office chair/i.test(`${s.variant} ${s.slug ?? ""}`.replace(/-/g, " "))) return null;
    return chair(s);
  },
};
export default family;
