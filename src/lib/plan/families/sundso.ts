import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SUNDSÖ, read from the cabinet's manual. The steel cabinet slots together: both sides drop onto the base frame's
 * corner posts, the back slides in between them, the top clicks down onto tabs and two tabs are bent over to lock
 * it. Lying on its back it gets two screws at the bottom and four feet tapped into the base; stood up, the bottom
 * panel drops in and is screwed to the sides, the shelves rest on clips, and the door turns on a pin at the bottom
 * and a sprung pin at the top. Two screws through the back hold it to the wall. The table and the folding chair are
 * sold ready to use, with no assembly manual: their guides only unfold them.
 */

const W = 600, H = 860, D = 350;
const T = 20; // steel panels, drawn thicker than they are so they read
const FOOT = 12; // feet under the base
const BASE = 50; // base frame height
const Y0 = FOOT + BASE; // bottom of the sides
const TOP = 20;
const YT = H - TOP; // top of the sides
const DOOR = 20;

const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });

function cabinet(): CustomParams {
  const xs = W / 2 - T / 2;
  const iw = W - 2 * T;
  const zIn = D / 2 - DOOR; // the door sits between the sides at the front
  const zb = -D / 2 + 6;
  // the base: a rail along the front and the back, joined at the ends, with a post at each corner for the sides
  const by = FOOT + BASE / 2;
  const basePieces: PartPiece[] = [
    box([W, BASE, 30], [0, by, D / 2 - 15]),
    box([W, BASE, 30], [0, by, -D / 2 + 15]),
    ...[-1, 1].map((sx) => box([30, BASE, D - 60], [sx * (W / 2 - 15), by, 0])),
  ];
  const parts: CustomPart[] = [
    { id: "F", name: "Base frame", size: [W, BASE, D], pos: [0, by, 0], pieces: basePieces.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] - by, p.pos[2]] as Vec3 })), material: "metal" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `S${i}`, name: "Side", size: [T, YT - Y0, D], pos: [sx * xs, (Y0 + YT) / 2, 0], material: "metal" })),
    { id: "K", name: "Back", size: [iw, YT - Y0, 12], pos: [0, (Y0 + YT) / 2, zb], material: "metal" },
    { id: "P", name: "Top", size: [W, TOP, D], pos: [0, H - TOP / 2, 0], material: "metal" },
    { id: "B", name: "Bottom panel", size: [iw, 16, zIn - zb - 6], pos: [0, Y0 + 8, (zIn + zb + 6) / 2], material: "metal" },
  ];
  const shelfYs = [Y0 + 260, Y0 + 520];
  shelfYs.forEach((y, i) => parts.push({ id: `L${i}`, name: "Shelf", size: [iw - 4, 16, zIn - zb - 16], pos: [0, y, (zIn + zb + 6) / 2], material: "metal" }));
  const dw = iw - 4, dh = YT - Y0 - 4;
  // the door has a folded edge along its hinge side, which is also the handle
  const doorPieces: PartPiece[] = [box([dw, dh, 6], [0, 0, DOOR / 2 - 3]), box([30, dh, DOOR], [dw / 2 - 15, 0, 0])];
  parts.push({ id: "D", name: "Door", size: [dw, dh, DOOR], pos: [0, (Y0 + YT) / 2, D / 2 - DOOR / 2], pieces: doorPieces, material: "metal" });

  const xh = W / 2 - T - 20; // hinge side, on the right
  const xi = W / 2 - T; // inner face of a side
  const screwsBottom: CustomFix = {
    kind: "screw",
    count: 2,
    len: 10,
    dia: 4,
    at: [-1, 1].map((sx) => [sx * 150, Y0, zb] as Vec3),
    dir: [0, -1, 0],
    on: "K",
    mate: "F",
  };
  const feet: CustomFix = {
    kind: "foot",
    count: 4,
    at: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - 15), FOOT, sz * (D / 2 - 15)] as Vec3)),
    dir: [0, 1, 0],
    on: "F",
  };
  const sideScrews: CustomFix[] = [-1, 1].map((sx, i) => ({
    kind: "screw",
    count: 2,
    len: 10,
    dia: 4,
    at: [-1, 1].map((sz) => [sx * xi, Y0 + 12, sz * 110 - 10] as Vec3),
    dir: [sx, 0, 0],
    on: "B",
    mate: `S${i}`,
  }));
  const clips: CustomFix[] = [-1, 1].map((sx, i) => ({
    kind: "clip",
    name: "Shelf clip",
    count: 4,
    len: 22,
    dia: 12,
    at: shelfYs.flatMap((y) => [zb + 50, zIn - 40].map((z) => [sx * xi, y - 10, z] as Vec3)),
    dir: [sx, 0, 0],
    on: `S${i}`,
  }));
  const steps: CustomStep[] = [
    {
      title: "Lower the sides onto the base frame",
      detail: "Each side drops over the two posts at its end of the frame. The rows of slots face in.",
      add: ["F", "S0", "S1"],
      from: { S0: [0, 400, 0], S1: [0, 400, 0] },
    },
    {
      title: "Slide the back in between the sides",
      detail: "Hook its edge into one side first, then swing it across until it sits in the folds of both.",
      add: ["K"],
      from: { K: [0, 0, -300] },
    },
    {
      title: "Click the top on",
      detail: "Lower it over the four tabs at the top of the sides and back, then push it towards the back until it clicks.",
      add: ["P"],
      warnings: ["hand"],
    },
    {
      title: "Bend the two tabs up under the top",
      detail: "With a flat screwdriver, at the front. They stop the top sliding off again.",
      tools: ["flathead"],
    },
    {
      title: "Lay it on its back and screw the back to the base",
      detail: "On a rug. Two screws inside, along the bottom edge of the back.",
      fix: [screwsBottom],
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Tap the feet into the base",
      detail: "One in each corner, under the base. Lay a block of wood on each and tap it with a hammer.",
      fix: [feet],
      tools: ["hammer"],
    },
    { title: "Stand it up", detail: "Tip it forward onto its feet.", pose: "+y" },
    {
      title: "Lay the bottom panel in",
      detail: "Folded edge at the front, pointing down. Push it down until its tab locks.",
      add: ["B"],
    },
    {
      title: "Screw the bottom panel to the sides",
      detail: "Two screws into each side, low down near the front and the back.",
      fix: sideScrews,
      tools: ["screwdriver"],
    },
    {
      title: "Level the cabinet on its feet",
      detail: "Stand it where it goes and turn the feet until it doesn't rock.",
      warnings: ["square"],
    },
    {
      title: "Hook in the shelf clips",
      detail: "Four for each shelf, at the same height in the slots at the front and the back of both sides. Push each one down until it sits.",
      fix: clips,
    },
    { title: "Lay the shelves on the clips", detail: "Folded edges pointing down.", add: ["L0", "L1"] },
    {
      title: "Push the lower hinge pin into the bottom",
      detail: "On the side the door will hang from: the right in the drawing, or the left if you want it to open the other way.",
      fix: [{ kind: "pin", name: "Lower hinge pin", count: 1, len: 24, dia: 8, at: [[xh, Y0 + 16, zIn - 12]], dir: [0, -1, 0], on: "B" }],
    },
    {
      title: "Set the door on the pin",
      detail: "Tilt the door, drop the hole at its bottom corner over the pin, then swing it up against the side.",
      add: ["D"],
      from: { D: [200, 0, 300] },
    },
    {
      title: "Push the sprung pin into the top of the door",
      detail: "Squeeze it, slide it into the door's top corner and let it spring up into the hole under the top.",
      fix: [{ kind: "clip", name: "Upper hinge pin", count: 1, len: 50, dia: 16, at: [[xh, YT - 2, D / 2 - DOOR / 2]], dir: [0, -1, 0], on: "D", mate: "P" }],
      warnings: ["hand"],
    },
    {
      title: "Screw the bumpers inside the door",
      detail: "One near the top and one near the bottom, on the edge that closes. They stop the door banging on the sides.",
      fix: [
        // through the bumper into the back of the door's face
        { kind: "screw", count: 2, len: 12, dia: 3.5, at: [YT - 60, Y0 + 60].map((y) => [-dw / 2 + 30, y, D / 2 - 10] as Vec3), dir: [0, 0, 1], on: "D" },
        { kind: "washer", name: "Door bumper", count: 2, len: 6, dia: 14, at: [YT - 60, Y0 + 60].map((y) => [-dw / 2 + 30, y, D / 2 - 10] as Vec3), dir: [0, 0, 1], on: "D" },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Push the catch into the bottom",
      detail: "Into the square hole at the front, on the side the door closes against.",
      fix: [{ kind: "clip", name: "Door catch", count: 1, len: 14, dia: 14, at: [[-xh, Y0 + 16, zIn - 12]], dir: [0, -1, 0], on: "B" }],
    },
    {
      title: "Cap the holes at the front",
      detail: "One cap in the hole on the front edge of each side.",
      fix: [{ kind: "cap", count: 2, len: 6, dia: 10, at: [-1, 1].map((sx) => [sx * xs, (Y0 + YT) / 2, D / 2] as Vec3), dir: [0, 0, -1] }],
    },
  ];
  // the wall fixing: two screws through the back near the top
  const wallPts: Vec3[] = [-1, 1].map((sx) => [sx * (iw / 2 - 60), YT - 60, zb - 6] as Vec3);
  steps.push({
    title: "Fix it to the wall",
    detail: "Two screws through the holes near the top of the back. Wall screws and plugs aren't included: pick ones made for your wall.",
    fix: [
      { kind: "plug", count: 2, at: wallPts, dir: [0, 0, -1] },
      { kind: "screw", count: 2, len: 50, dia: 5, at: wallPts.map((p) => [p[0], p[1], p[2] + 8] as Vec3), dir: [0, 0, -1], on: "K" },
    ],
    tools: ["screwdriver", "drill", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  });
  return { parts, steps };
}

/* ---------- sold folded: the table and the folding chair ---------- */

/** A round or square bar from a to b (mm, relative to the part's middle), as a piece. */
function bar(a: Vec3, b: Vec3, t = 16): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  // a bar along y turned about x (leaning front to back), or one lying along x
  if (Math.abs(d[0]) > Math.abs(d[1]) && Math.abs(d[0]) > Math.abs(d[2])) return { shape: "box", size: [len, t, t], pos: mid };
  if (Math.abs(d[2]) > Math.abs(d[1])) return { shape: "box", size: [t, t, len], pos: mid, rot: [Math.atan2(-d[1], d[2]), 0, 0] };
  return { shape: "box", size: [t, len, t], pos: mid, rot: [Math.atan2(d[2], d[1]), 0, 0] };
}

/**
 * The SUNDSÖ table has no manual: it comes folded, its two leg frames crossing under the top. Unfold it and lock
 * the brace, that's all.
 */
function table(s: ProductSpec): CustomParams {
  const round = !/-x-/.test(s.slug ?? ""); // "65 cm" is the round one, "65 x 65" the square
  const Wt = s.size.w * 10, Dt = s.size.d * 10, Ht = s.size.h * 10;
  const tt = 16, yc = Ht / 2;
  const xl = Wt / 2 - 70;
  // legs cross in an X seen from the side: one frame leans forward, the other back
  const frameOf = (lean: number): PartPiece[] => {
    const top: Vec3 = [0, Ht - tt - 20 - yc, -lean * 200];
    const foot: Vec3 = [0, -yc, lean * 260];
    const at = (k: number): Vec3 => [0, top[1] + (foot[1] - top[1]) * k, top[2] + (foot[2] - top[2]) * k];
    return [
      ...[-1, 1].map((sx) => bar([sx * xl, top[1], top[2]], [sx * xl, foot[1], foot[2]])),
      bar([-xl, at(0.9)[1], at(0.9)[2]], [xl, at(0.9)[1], at(0.9)[2]]),
      bar([-xl, at(0.08)[1], at(0.08)[2]], [xl, at(0.08)[1], at(0.08)[2]]),
    ];
  };
  const parts: CustomPart[] = [
    {
      id: "T",
      name: "Top with front legs",
      size: [Wt, Ht, Dt],
      pos: [0, yc, 0],
      material: "metal",
      pieces: [round ? { shape: "cyl", size: [Wt, tt, Dt], pos: [0, Ht - tt / 2 - yc, 0] } : { shape: "box", size: [Wt, tt, Dt], pos: [0, Ht - tt / 2 - yc, 0] }, ...frameOf(1)],
    },
    { id: "L", name: "Back leg frame", size: [Wt - 100, Ht - tt - 20, 500], pos: [0, (Ht - tt - 20) / 2, 0], material: "metal", pieces: frameOf(-1).map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] + yc - (Ht - tt - 20) / 2, p.pos[2]] as Vec3 })) },
  ];
  return {
    parts,
    steps: [
      { title: "Stand the folded table on its front legs", detail: "It comes ready made, with no fittings: the legs fold flat under the top.", add: ["T"] },
      { title: "Swing the back legs out", detail: "Pull them away from the front legs until they stand on the floor and the top lies level.", add: ["L"], from: { L: [0, 120, 360] }, warnings: ["hand"] },
      { title: "Lock it open", detail: "Push the brace under the top down until it clicks over the rail. To fold it, lift the brace first and keep your fingers clear of the hinges." },
    ],
  };
}

/** The folding chair has no manual either: unfold it, press the seat down and it's ready. */
function chair(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const ys = 450, xl = W / 2 - 25;
  const back: PartPiece[] = [
    ...[-1, 1].map((sx) => bar([sx * xl, 0, -D / 2 + 120], [sx * xl, H, -D / 2 + 20])),
    ...[0, 1, 2].map((k): PartPiece => ({ shape: "box", size: [W - 40, 60, 10], pos: [0, H - 50 - k * 80, -D / 2 + 25 + k * 10], rot: [-0.12, 0, 0] })),
    bar([-xl, 120, -D / 2 + 110], [xl, 120, -D / 2 + 110]),
  ];
  const seat: PartPiece[] = Array.from({ length: 6 }, (_, k): PartPiece => ({ shape: "box", size: [W - 40, 12, 52], pos: [0, ys, -D / 2 + 90 + k * 58] }));
  const front: PartPiece[] = [
    ...[-1, 1].map((sx) => bar([(sx * xl) - sx * 20, ys - 10, -D / 2 + 110], [sx * xl - sx * 20, 0, D / 2 - 20])),
    bar([-xl + 20, 100, D / 2 - 40], [xl - 20, 100, D / 2 - 40]),
  ];
  const parts: CustomPart[] = [
    { id: "B", name: "Back frame", size: [W, H, D], pos: [0, H / 2, 0], material: "metal", pieces: back.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] - H / 2, p.pos[2]] as Vec3 })) },
    { id: "F", name: "Front legs", size: [W, ys, D], pos: [0, ys / 2, 0], material: "metal", pieces: front.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] - ys / 2, p.pos[2]] as Vec3 })) },
    { id: "S", name: "Seat", size: [W - 40, 12, D - 100], pos: [0, ys, 0], material: "metal", pieces: seat.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] - ys, p.pos[2]] as Vec3 })) },
  ];
  return {
    parts,
    steps: [
      { title: "Stand the folded chair on its back legs", detail: "It comes ready made, with no fittings to add.", add: ["B"] },
      { title: "Swing the front legs out", detail: "Pull the bottom of the front legs forward until both pairs stand on the floor.", add: ["F"], from: { F: [0, 0, -260] }, warnings: ["hand"] },
      { title: "Press the seat down", detail: "Push it down flat until it rests on the front rail. To fold the chair, lift the front of the seat; keep your fingers clear of the joints.", add: ["S"], from: { S: [0, 300, -150] } },
    ],
  };
}

const family: Family = {
  names: ["SUNDSÖ", "SUNDSO"],
  recipe(s) {
    if (/^cabinet/i.test(s.variant)) return cabinet();
    if (/table/i.test(s.variant)) return table(s);
    if (/folding chair/i.test(s.variant)) return chair(s);
    return null;
  },
};
export default family;
