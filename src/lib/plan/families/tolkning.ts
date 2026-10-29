import type { Family } from "./family";
import type { CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { rotate } from "../math";

/**
 * TOLKNING, read from its manuals. Handwoven rattan that comes almost whole.
 * The pouffe is a round basket: drop the loose bottom board in, then lay the lid on. No fittings.
 * The bench is built upside down: the woven box lies on its top on a rug, the two bent leg frames sit on its
 * bottom and are screwed on with twelve Allen screws and washers, then it is turned over and the lid laid on.
 * The bedside table is two leg frames notched into a cross, a hoop on top, a basket and a loose tray.
 * The room divider has no manual: it comes folded and ready to use, so its guide only unfolds it.
 */

const r1 = (n: number) => Math.round(n * 10) / 10;

/** A part drawn as pieces placed in product coordinates: works out its box and moves the pieces relative to it. */
function built(id: string, name: string, pieces: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces)
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const c of [-1, 1]) {
          const v = rotate([(a * p.size[0]) / 2, (b * p.size[1]) / 2, (c * p.size[2]) / 2], p.rot ?? [0, 0, 0]);
          for (let i = 0; i < 3; i++) {
            lo[i] = Math.min(lo[i], p.pos[i] + v[i]);
            hi[i] = Math.max(hi[i], p.pos[i] + v[i]);
          }
        }
  const mid = lo.map((v, i) => r1((v + hi[i]) / 2)) as Vec3;
  return {
    id,
    name,
    size: lo.map((v, i) => r1(hi[i] - v)) as Vec3,
    pos: mid,
    material,
    pieces: pieces.map((p) => ({ ...p, pos: p.pos.map((v, i) => r1(v - mid[i])) as Vec3 })),
  };
}

/** A round rod from a to b. */
function rod(a: Vec3, b: Vec3, dia: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const u = d.map((v) => v / len);
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(u[2], u[1]), 0, Math.asin(-u[0])] };
}

/* ---------- pouffe ---------- */

// IKEA's page: 50 cm across, 41 cm high
function pouffe(): CustomParams {
  const D = 500;
  const H = 410;
  const R = D / 2;
  const lidT = 30;
  const top = H - lidT;
  const wall = 14;
  // the woven wall as staves round the circle, a woven floor and four little feet
  const staves = 28;
  const pieces: PartPiece[] = [];
  const w = (2 * Math.PI * (R - wall / 2)) / staves + 2;
  for (let i = 0; i < staves; i++) {
    const t = (i / staves) * 2 * Math.PI;
    pieces.push({ shape: "box", size: [w, top - 10, wall], pos: [(R - wall / 2) * Math.sin(t), (top + 10) / 2, (R - wall / 2) * Math.cos(t)], rot: [0, t, 0] });
  }
  pieces.push({ shape: "cyl", size: [D - 2 * wall, 10, D - 2 * wall], pos: [0, 15, 0] });
  for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) pieces.push({ shape: "cyl", size: [22, 10, 22], pos: [x * (R - 50), 5, z * (R - 50)] });
  const parts: CustomPart[] = [
    built("B", "Pouffe basket", pieces, "wood"),
    { id: "F", name: "Bottom board", size: [D - 2 * wall - 10, 8, D - 2 * wall - 10], pos: [0, 24, 0], shape: "cyl", material: "board" },
    { id: "L", name: "Lid", size: [D + 8, lidT, D + 8], pos: [0, top + lidT / 2, 0], shape: "cyl", material: "wood" },
  ];
  const steps: CustomStep[] = [
    { title: "Stand the basket up", detail: "On its little feet, open side up.", add: ["B"] },
    { title: "Drop the bottom board in", detail: "Smooth side up, so it lies flat on the woven floor.", add: ["F"] },
    { title: "Lay the lid on", detail: "It sits loose on the rim, so you can lift it off to store things inside.", add: ["L"] },
  ];
  return { parts, steps };
}

/* ---------- bench ---------- */

const SCREW = { len: 50, dia: 6, name: "Allen screw" };
const WASHER = { len: 1.5, dia: 16 };

function bench(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const lidT = 30;
  const boxTop = H - lidT;
  const boxH = Math.round(H * 0.44);
  const boxBot = boxTop - boxH;
  const wall = 20;
  // the woven box: four walls and a floor, open at the top
  const box = built(
    "X",
    "Storage box",
    [
      { shape: "box", size: [W, boxH, wall], pos: [0, boxBot + boxH / 2, -D / 2 + wall / 2] },
      { shape: "box", size: [W, boxH, wall], pos: [0, boxBot + boxH / 2, D / 2 - wall / 2] },
      { shape: "box", size: [wall, boxH, D - 2 * wall], pos: [-W / 2 + wall / 2, boxBot + boxH / 2, 0] },
      { shape: "box", size: [wall, boxH, D - 2 * wall], pos: [W / 2 - wall / 2, boxBot + boxH / 2, 0] },
      { shape: "box", size: [W - 2 * wall, 14, D - 2 * wall], pos: [0, boxBot + 7, 0] },
    ],
    "wood",
  );
  // a leg frame: a plate under the box across its depth with a tab pointing in, two legs, and a bent brace from each leg to the tab
  const LEG = 32, plateT = 12;
  const xl = W / 2 - 55, zl = D / 2 - 45;
  const yPlate = boxBot - plateT / 2;
  const tab = 120;
  const frame = (id: string, sx: number) => {
    const x = sx * xl;
    const tipX = x - sx * tab;
    return built(
      id,
      "Leg frame",
      [
        { shape: "box", size: [50, plateT, 2 * zl + LEG], pos: [x, yPlate, 0] },
        { shape: "box", size: [tab, plateT, 60], pos: [x - (sx * tab) / 2, yPlate, 0] },
        { shape: "cyl", size: [LEG, boxBot - plateT, LEG], pos: [x, (boxBot - plateT) / 2, -zl] },
        { shape: "cyl", size: [LEG, boxBot - plateT, LEG], pos: [x, (boxBot - plateT) / 2, zl] },
        rod([x, boxBot * 0.42, -zl + 6], [tipX, boxBot - plateT, -12], 16),
        rod([x, boxBot * 0.42, zl - 6], [tipX, boxBot - plateT, 12], 16),
      ],
      "wood",
    );
  };
  const parts: CustomPart[] = [box, frame("FL", -1), frame("FR", 1), { id: "L", name: "Lid", size: [W, lidT, D], pos: [0, boxTop + lidT / 2, 0], material: "wood" }];
  // six screws through each frame: two by each leg and two in the tab
  const holes = (sx: number): Vec3[] => {
    const x = sx * xl, y = boxBot - plateT;
    return [[x, y, -zl + 45], [x, y, -zl + 110], [x, y, zl - 110], [x, y, zl - 45], [x - sx * (tab - 25), y, -18], [x - sx * (tab - 25), y, 18]];
  };
  const frameFix = (id: string, sx: number) => [
    { kind: "washer" as const, count: 6, at: holes(sx), dir: [0, 1, 0] as Vec3, on: id, ...WASHER },
    { kind: "screw" as const, count: 6, at: holes(sx), dir: [0, 1, 0] as Vec3, on: id, mate: "X", ...SCREW },
  ];
  const steps: CustomStep[] = [
    {
      title: "Lay the box upside down on a rug",
      detail: "Open side down, so the woven bottom faces up. A rug or the flattened box keeps the rattan from scratching.",
      add: ["X"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Stand the leg frames on the bottom",
      detail: "One at each end, the tab pointing in to the middle, holes over the holes in the box.",
      add: ["FL", "FR"],
    },
    {
      title: "Screw on one leg frame",
      detail: "A washer under each screw head. Turn all six in by hand first, then tighten them with the Allen key.",
      fix: frameFix("FL", -1),
      tools: ["allen"],
    },
    { title: "Screw on the other leg frame", detail: "The same way: six screws, six washers, then tighten.", fix: frameFix("FR", 1), tools: ["allen"] },
    { title: "Turn the bench over", detail: "Stand it on its legs.", pose: "+y" },
    { title: "Lay the lid on top", detail: "It rests loose on the box. Don't stand on the bench.", add: ["L"] },
  ];
  return { parts, steps };
}


/** The room divider: three rattan frames hinged together, stood in a zigzag. */
function divider(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 1500, H = Math.round(s.size.h * 10) || 1700;
  const pw = Math.round(W / 3) - 10, cane = 22, foot = 30;
  const a = 0.45; // how far the outer panels turn from the middle one
  const frame = (): PartPiece[] => [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "cyl", size: [cane, H, cane], pos: [sx * (pw / 2 - cane / 2), 0, 0] })),
    ...[-1, 1].map((sy): PartPiece => ({ shape: "box", size: [pw - 2 * cane, cane, cane], pos: [0, sy * (H / 2 - foot - cane / 2), 0] })),
    { shape: "box", size: [pw - 2 * cane, H - 2 * foot - 2 * cane, 4], pos: [0, 0, 0] },
  ];
  // an outer panel hinges on an edge of the middle one and turns back from it
  const outer = (sx: number): Vec3 => [sx * (pw / 2 + (pw / 2) * Math.cos(a)), H / 2, -(pw / 2) * Math.sin(a)];
  const parts: CustomPart[] = [
    { id: "M", name: "Middle panel", size: [pw, H, cane], pos: [0, H / 2, 0], material: "wood", pieces: frame() },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `O${i}`, name: "Side panel", size: [pw, H, cane], pos: outer(sx), rot: [0, sx * a, 0], material: "wood", pieces: frame() })),
  ];
  const steps: CustomStep[] = [
    { title: "Lift the folded divider out of its packaging", detail: "It comes ready to use, the three panels already hinged together. Stand it on its feet.", add: ["M"], from: { M: [0, 300, 0] } },
    { title: "Open out the side panels", detail: "Swing each one away from the middle panel on its hinges.", add: ["O0", "O1"], from: { O0: [pw * 0.6, 0, 250], O1: [-pw * 0.6, 0, 250] } },
    { title: "Stand it in a zigzag", detail: "Keep the panels at an angle to each other so it stands steady on all six feet. It is for indoor use only." },
  ];
  return { parts, steps };
}

/* ---------- bedside table ---------- */

/**
 * The bedside table: two rattan leg frames notched into each other to stand as a cross, built upside down on a rug
 * with one screw where the low bars cross. Turned over, a round hoop lies on the top bars on four screws, the woven
 * basket goes in on the low cross and the tray lies loose on the hoop.
 */
function bedside(s: ProductSpec): CustomParams {
  const D = Math.round(s.size.w * 10) || 520, H = Math.round(s.size.h * 10) || 700;
  const trayH = 60, yRing = H - trayH, ringT = 15, rR = D / 2 - 30;
  const rl = D / 2 - 15, LEG = 30, BAR = 25;
  const yTop = yRing - ringT - BAR / 2, yLow = 150;
  const frame = (id: string, axis: 0 | 2) => {
    const at = (r: number, y: number): Vec3 => (axis === 0 ? [r, y, 0] : [0, y, r]);
    const bar = (y: number): PartPiece => ({ shape: "box", size: axis === 0 ? [2 * rl, BAR, BAR] : [BAR, BAR, 2 * rl], pos: at(0, y) });
    return built(
      id,
      "Leg frame",
      [
        ...[-1, 1].map((k): PartPiece => ({ shape: "cyl", size: [LEG, yRing, LEG], pos: at(k * rl, yRing / 2) })),
        bar(yTop),
        bar(yLow),
        ...[-1, 1].map((k) => rod(at(k * (rl - 10), yTop - 150), at(k * 110, yTop - BAR / 2), 14)),
      ],
      "wood",
    );
  };
  const n = 24, w = (2 * Math.PI * rR) / n + 2;
  const hoop: PartPiece[] = Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    return { shape: "box", size: [w, ringT, 18], pos: [rR * Math.sin(t), yRing - ringT / 2, rR * Math.cos(t)], rot: [0, t, 0] };
  });
  const basketD = 2 * (rl - LEG / 2) - 14, basketH = 200; // it fits just inside the legs
  const parts: CustomPart[] = [
    frame("A", 0),
    frame("B", 2),
    built("R", "Hoop", hoop, "wood"),
    { id: "K", name: "Basket", size: [basketD, basketH, basketD], pos: [0, yLow + BAR / 2 + basketH / 2, 0], shape: "cyl", material: "wood" },
    { id: "T", name: "Tray", size: [D, trayH, D], pos: [0, H - trayH / 2, 0], shape: "cyl", material: "wood" },
  ];
  const ringScrews: Vec3[] = [[rR, yRing, 0], [-rR, yRing, 0], [0, yRing, rR], [0, yRing, -rR]];
  const steps: CustomStep[] = [
    {
      title: "Slot the two leg frames together",
      detail: "Upside down on a rug: push one frame down into the notches of the other so they stand as a cross. One screw where the low bars cross, by hand.",
      add: ["A", "B"],
      from: { B: [0, -320, 0] },
      fix: [{ kind: "screw", count: 1, at: [[0, yLow - BAR / 2, 0]], dir: [0, 1, 0], on: "A", mate: "B", len: 30, dia: 4 }],
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Turn it over and screw on the hoop",
      detail: "Lay the hoop on the top bars, its holes over the holes in the bars. Four screws, by hand.",
      add: ["R"],
      from: { R: [0, 220, 0] },
      fix: [
        { kind: "screw", count: 2, at: ringScrews.slice(0, 2), dir: [0, -1, 0], on: "R", mate: "A", len: 30, dia: 4 },
        { kind: "screw", count: 2, at: ringScrews.slice(2), dir: [0, -1, 0], on: "R", mate: "B", len: 30, dia: 4 },
      ],
      pose: "+y",
      tools: ["screwdriver"],
    },
    {
      title: "Tighten all five screws",
      detail: "By hand until the heads sit flush. Stop there: turning further splits the rattan.",
      tools: ["screwdriver"],
      warnings: ["hand"],
    },
    {
      title: "Put the basket in and lay the tray on",
      detail: "Tilt the basket in between two legs onto the low cross. The tray lies loose on the hoop.",
      add: ["K", "T"],
      from: { K: [420, 80, 420], T: [0, 220, 0] },
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["TOLKNING"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/pouf/.test(slug) || /pouf/i.test(s.variant)) return pouffe();
    if (/bench/.test(slug)) return bench(s);
    if (/bedside-table/.test(slug)) return bedside(s);
    if (/room-divider/.test(slug) || /room divider/i.test(s.variant)) return divider(s);
    return null;
  },
};
export default family;
