import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * GLADHÖJDEN sit/stand desk, read from its manual. The base is built upside down: the lift beam (it carries the gas
 * spring) lies on the floor and the two welded leg frames are pushed onto its ends, two short bolts each. The
 * stretcher goes between the frames with a long bolt at each end, then the short bolts are tightened. Stood up, a
 * top plate is bolted onto each column (four bolts each). The top lies face down on a rug and the base goes on it
 * upside down: the release handle slides onto the spring's lever (one screw), and eight bolts hold the plates to
 * the top, one through the cover bracket. Squeeze the handle to lift or lower the top.
 * IKEA: 100 x 60 cm, 72 to 115 cm high, 10 kg on the top at most.
 */

const TUBE = 25, COL = 40;

/** A round tube from a to b, as a piece of a part centred at c. */
function tube(a: Vec3, b: Vec3, c: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d);
  return {
    shape: "cyl",
    size: [dia, L, dia],
    pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]],
    rot: [Math.atan2(d[2], d[1]), 0, -Math.asin(d[0] / L)],
  };
}

function desk(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 1000, D = Math.round(s.size.d * 10) || 600, H = Math.round(s.size.h * 10) || 720;
  const TOP = 19, PLATE = 8;
  const yTop = H - TOP, yPlate = yTop - PLATE;
  const xF = W / 2 - 100; // the frames stand in from the ends of the top
  const zCol = -D / 2 + 100, zFoot = D / 2 - 50;
  const yCol = yPlate - 50; // the column sleeve; the lift beam's tubes slide into it
  const yBar = 230;
  const zAt = (y: number) => zFoot - ((zFoot - zCol - 40) * y) / yCol; // the front leg, foot to column
  const zMid = (zAt(yBar) + zCol) / 2;

  const fc: Vec3 = [0, yCol / 2, (zFoot + zCol) / 2];
  const frame: PartPiece[] = [
    tube([0, 0, zCol], [0, yCol, zCol], fc, COL),
    tube([0, 0, zFoot], [0, yCol, zCol + 40], fc),
    tube([0, yBar, zAt(yBar)], [0, yBar, zCol], fc),
  ];
  const beamY = (yCol - 60 + yPlate) / 2;
  const beam: PartPiece[] = [
    { shape: "box", size: [2 * xF - 2 * COL, 45, 40], pos: [0, yPlate - 25 - beamY, 0], material: "metal" },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "cyl", size: [COL - 6, yPlate - yCol + 60, COL - 6], pos: [sx * xF, 0, 0], material: "metal" })),
  ];
  const zPlate = zCol + 40, plateL = 260;
  const parts: CustomPart[] = [
    { id: "B", name: "Lift beam", size: [2 * xF + COL, yPlate - yCol + 60, 40], pos: [0, beamY, zCol], pieces: beam, material: "metal" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `F${i}`, name: "Leg frame", size: [COL, yCol, zFoot - zCol + COL], pos: [sx * xF, fc[1], fc[2]], pieces: frame, material: "metal" })),
    { id: "S", name: "Stretcher", shape: "cyl", size: [2 * xF - TUBE, TUBE, TUBE], pos: [0, yBar, zMid], material: "metal" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `P${i}`, name: "Top plate", size: [80, PLATE, plateL], pos: [sx * xF, yPlate + PLATE / 2, zPlate], material: "metal" })),
    { id: "T", name: "Desk top", size: [W, TOP, D], pos: [0, yTop + TOP / 2, 0], material: "board" },
    { id: "HD", name: "Release handle", size: [30, 30, 90], pos: [xF + 45, yPlate - 18, zCol + 40], material: "metal" },
    { id: "CB", name: "Cover bracket", size: [30, 32, 30], pos: [xF + 45, yPlate - 16, zPlate - plateL / 2 + 25], material: "metal" },
  ];

  const plateBolts = (dy: number): Vec3[] =>
    [-1, 1].flatMap((sx) => [-1, 1].flatMap((dx) => [zPlate - plateL / 2 + 25, zPlate + plateL / 2 - 25].map((z): Vec3 => [sx * xF + dx * 25, dy, z])));
  const topBolts = plateBolts(yPlate);
  const cb = parts.find((p) => p.id === "CB")!.pos;
  return {
    parts,
    steps: [
      {
        title: "Push the leg frames onto the lift beam",
        detail: "The base is built upside down. Lay the beam on the floor and push a frame's column over each end.",
        add: ["B", "F0", "F1"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Bolt the frames to the beam",
        detail: "Two short bolts in each column. Only start them for now.",
        fix: [{ kind: "bolt", count: 4, len: 12, dia: 6, at: [-1, 1].flatMap((sx) => [yCol - 40, yCol - 15].map((y): Vec3 => [sx * xF, y, zCol + COL / 2])), dir: [0, 0, -1] }],
        tools: ["allen"],
      },
      {
        title: "Lay the stretcher between the frames",
        detail: "Its ends sit against the short bars of the two frames.",
        add: ["S"],
      },
      {
        title: "Bolt the stretcher on",
        detail: "One long bolt through each frame's bar into the end of the stretcher.",
        fix: [-1, 1].map((sx): CustomFix => ({ kind: "bolt", count: 1, len: 90, dia: 6, on: "S", at: [[sx * (xF + TUBE / 2), yBar, zMid]], dir: [-sx, 0, 0] })),
        tools: ["allen"],
      },
      {
        title: "Tighten the four short bolts",
        detail: "Now the base is square, tighten the bolts in the columns.",
        tools: ["allen"],
      },
      {
        title: "Stand it up and bolt on the top plates",
        detail: "One plate on each column, four bolts each.",
        add: ["P0", "P1"],
        fix: [{ kind: "bolt", count: 8, len: 10, dia: 6, name: "Flange bolt", at: [-1, 1].flatMap((sx) => [-1, 1].flatMap((dx) => [-1, 1].map((dz): Vec3 => [sx * xF + dx * 12, yPlate + PLATE, zCol + dz * 12]))), dir: [0, -1, 0] }],
        tools: ["allen"],
        pose: "+y",
      },
      {
        title: "Set the base upside down on the top",
        detail: "Lay the top face down on a rug, holes up, then lower the base onto it so the plates sit over the holes.",
        add: ["T"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Fit the release handle",
        detail: "Slide it onto the spring's lever under the top, then one screw holds it.",
        add: ["HD"],
        fix: [{ kind: "screw", count: 1, len: 13, dia: 4, on: "HD", at: [[xF + 60, yPlate - 18, zCol + 40]], dir: [-1, 0, 0] }],
        tools: ["screwdriver"],
      },
      {
        title: "Bolt the plates to the top",
        detail: "The cover bracket goes over the end of the spring with one bolt, then seven more bolts through the plates.",
        add: ["CB"],
        fix: [
          { kind: "bolt", count: 1, len: 16, dia: 6, on: "CB", at: [[cb[0], yPlate - 32, cb[2]]], dir: [0, 1, 0] },
          { kind: "bolt", count: 7, len: 16, dia: 6, at: topBolts.filter((p) => Math.hypot(p[0] - cb[0], p[2] - cb[2]) > 30).slice(0, 7), dir: [0, 1, 0] },
        ],
        tools: ["allen"],
      },
      {
        title: "Turn it over and set the height",
        detail: "Squeeze the handle and push the top up or down, then let go. Keep it to 10 kg on top and don't sit on it.",
        pose: "+y",
        people: 2,
        warnings: ["two"],
      },
    ],
  };
}

const family: Family = {
  names: ["GLADHÖJDEN", "GLADHOJDEN"],
  recipe(s) {
    if (/sit-stand/.test(s.slug ?? "")) return desk(s);
    return null;
  },
};
export default family;
