import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * STEGESUND, read from its manuals. Everything is light bamboo held with Allen bolts through the legs.
 * Shelf unit: each side is a ready-made ladder (two legs and their rails). One ladder lies on the floor, the top and
 * the shelves are bolted into it, then the other ladder goes on top; the tall unit is two such units bolted end to
 * end. A bracket (or a strap on the tall one) holds the top to the wall.
 * Bench: an end frame takes the slatted shelf and the two long rails, the other end frame closes it, then the frame
 * is turned upside down onto the seat board and bolted to it from below.
 * Trolley: dowels in the top tray's rails, one end frame on the floor takes the shelves and the rails, the tray's
 * bottom slides into the rails, the other end goes on, and four castors are screwed into the legs.
 */

const SHORT = { len: 40, dia: 6 };
const LONG = { len: 70, dia: 6 };

/** A part from box (or rod) pieces placed where they sit in the finished product, centred on their bounds. */
function compound(id: string, name: string, pieces: PartPiece[]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces) {
    // a rod along z is drawn as a cylinder turned a quarter about x
    const sz: Vec3 = p.rot?.[0] ? [p.size[0], p.size[2], p.size[1]] : p.size;
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], p.pos[i] - sz[i] / 2);
      hi[i] = Math.max(hi[i], p.pos[i] + sz[i] / 2);
    }
  }
  const pos: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  return {
    id,
    name,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    pos,
    material: "wood",
    pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] })),
  };
}

const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });

/** Slats running front to back between two rails along the front and back edges, top of the slats at y. */
function slatted(id: string, w: number, d: number, y: number, rail: number, rim = 0, railZ = d / 2 - 10): CustomPart {
  const st = 14, sw = 22, gap = 9;
  const pieces: PartPiece[] = [];
  for (const sz of [-1, 1]) pieces.push(box([w, rail, 20], [0, y + rim - rail / 2, sz * railZ]));
  const n = Math.floor((w + gap) / (sw + gap));
  const pitch = (w - sw) / (n - 1);
  for (let i = 0; i < n; i++) pieces.push(box([sw, st, d - 40], [-w / 2 + sw / 2 + i * pitch, y - st / 2, 0]));
  return compound(id, "Slatted shelf", pieces);
}

/** Bolts in from the outside of a side, through the legs: `pts` are [y, z]. */
function bolts(side: number, on: string, mate: string, x: number, pts: [number, number][], o = SHORT): CustomFix {
  return { kind: "bolt", count: pts.length, ...o, at: pts.map(([y, z]) => [side * x, y, z] as Vec3), dir: [-side, 0, 0], on, mate };
}

/* ---------- shelf units ---------- */

const P = 28; // legs, square

interface Unit {
  y0: number; // where its legs start
  h: number; // leg length
  levels: { y: number; slats: boolean }[]; // tops of the shelves, from the top down
}

function shelfRecipe(s: ProductSpec): CustomParams {
  const W = 360, D = 280;
  const tall = s.size.h > 120;
  const lower: Unit = { y0: 0, h: 870, levels: [{ y: 850, slats: false }, { y: 600, slats: true }, { y: 345, slats: true }, { y: 90, slats: true }] };
  const upper: Unit = { y0: 870, h: 750, levels: [{ y: 1600, slats: false }, { y: 1345, slats: false }, { y: 1090, slats: false }] };
  const units = tall ? [lower, upper] : [lower];
  const zr = D / 2 - P / 2;
  const parts: CustomPart[] = [];
  const iw = W - 2 * P;
  const ids = units.map((u, k) => {
    const sides = [-1, 1].map((sx, i) => {
      const x = sx * (W / 2 - P / 2);
      const pieces: PartPiece[] = [-1, 1].map((sz) => box([P, u.h, P], [x, u.y0 + u.h / 2, sz * zr]));
      // a rail under each shelf, and one at the foot of the upper unit's ladder that stands on the lower unit
      const ys = u.levels.map((l) => l.y - 20 - 15);
      if (k === 1) ys.push(u.y0 + 15);
      // the lower unit of the tall one has a rung at the very top too: the joining bolts go up through it
      if (k === 0 && tall) ys.push(u.y0 + u.h - 15);
      for (const y of ys) pieces.push(box([18, 30, D - 2 * P], [x, y, 0]));
      const part = compound(`L${k}${i}`, "Ladder", pieces);
      parts.push(part);
      return part.id;
    });
    const shelves = u.levels.map((l, j) => {
      const id = `S${k}${j}`;
      if (l.slats) parts.push({ ...slatted(id, iw, D, l.y, 30), name: "Slatted shelf" });
      else parts.push({ id, name: j === 0 && k === 0 && !tall ? "Top" : "Shelf", size: [iw, 18, D], pos: [0, l.y - 9, 0], material: "wood" });
      return id;
    });
    return { sides, shelves };
  });
  // two bolts through each ladder into each shelf, one in each leg
  const boltY = (u: Unit, j: number) => u.levels[j].y - 12;
  const into = (k: number, side: number, j: number) =>
    bolts(side, ids[k].sides[side < 0 ? 0 : 1], ids[k].shelves[j], W / 2, [-1, 1].map((sz) => [boltY(units[k], j), sz * zr] as [number, number]));
  const steps: CustomStep[] = [];
  units.forEach((u, k) => {
    const { sides, shelves } = ids[k];
    const unit = tall ? (k === 0 ? "the lower unit" : "the upper unit") : "";
    const [first, ...rest] = shelves;
    steps.push({
      title: k === 0 ? (tall ? "Bolt the lower unit's top board to a ladder" : "Bolt the top to a ladder") : "Start the upper unit the same way",
      detail: k === 0
        ? "Lay one ladder flat on a rug. Stand the plain board on its edge against the top rail and turn a bolt through each leg."
        : "A ladder of the upper unit on the rug, its foot rail at the bottom. Bolt its top board on, one bolt in each leg.",
      add: [sides[0], first],
      fix: [into(k, -1, 0)],
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
    });
    steps.push({
      title: unit ? `Bolt on the shelves of ${unit}` : "Bolt on the shelves",
      detail: u.levels.slice(1).some((l) => l.slats) ? "Slats up, each one against its rail. Two bolts each, through the legs." : "Each board against its rail. Two bolts each, through the legs.",
      add: rest,
      fix: rest.map((_, j) => into(k, -1, j + 1)),
      tools: ["allen"],
    });
    steps.push({
      title: "Lay the other ladder on top and bolt it on",
      detail: "Line every rail up under its shelf before you turn the bolts in. Tighten them all once it is square.",
      add: [sides[1]],
      fix: shelves.map((_, j) => into(k, 1, j)),
      tools: ["allen"],
      check: "square",
    });
  });
  if (tall) {
    steps.push({
      title: "Bolt the two units together",
      detail: "End to end on the rug. Two bolts from inside the lower unit, through its top rungs into the foot rails of the upper one.",
      fix: [0, 1].map((i): CustomFix => ({
        kind: "bolt",
        count: 1,
        ...SHORT,
        at: [[(i ? 1 : -1) * (W / 2 - P / 2), 840, 0]],
        dir: [0, 1, 0],
        on: ids[0].sides[i],
        mate: ids[1].sides[i],
      })),
      tools: ["allen"],
    });
  }
  const ty = 850; // the top of the lower unit
  steps.push({
    title: tall ? "Stand it up together" : "Stand it up",
    detail: "Lift it upright by the ladders and set it against the wall.",
    pose: "+y",
    people: tall ? 2 : 1,
    warnings: tall ? ["two"] : [],
  });
  const zb = -D / 2;
  steps.push(
    tall
      ? {
          title: "Strap it to the wall",
          detail: "Mark the wall 3 cm under the shelf at the middle of the unit. Screw the strap under that shelf, then into the wall. Wall screws aren't included: pick ones made for your wall.",
          fix: [
            { kind: "strap", count: 1, at: [[0, ty - 18, zb + 20]], dir: [0, 1, 0], on: ids[0].shelves[0] },
            { kind: "screw", count: 1, len: 14, dia: 4, at: [[0, ty - 18, zb + 30]], dir: [0, 1, 0], on: ids[0].shelves[0], included: true },
            { kind: "plug", count: 1, at: [[0, ty - 48, zb]], dir: [0, 0, -1] },
            { kind: "screw", count: 1, len: 50, dia: 5, at: [[0, ty - 48, zb + 2]], dir: [0, 0, -1] },
          ],
          tools: ["screwdriver", "drill", "pencil", "tape"],
          wall: true,
          warnings: ["wall", "tip"],
        }
      : {
          title: "Fix it to the wall",
          detail: "Screw the bracket under the top at the back, with a washer, then screw it to the wall through its slot. Wall screws aren't included: pick ones made for your wall.",
          fix: [
            { kind: "bracket", count: 1, at: [[0, ty - 18, zb + 16]], dir: [0, 1, 0], on: ids[0].shelves[0] },
            { kind: "washer", count: 1, at: [[0, ty - 18, zb + 30]], dir: [0, 1, 0], on: ids[0].shelves[0] },
            { kind: "screw", count: 1, len: 14, dia: 4, at: [[0, ty - 18, zb + 30]], dir: [0, 1, 0], on: ids[0].shelves[0], included: true },
            { kind: "plug", count: 1, at: [[0, ty - 48, zb]], dir: [0, 0, -1] },
            { kind: "washer", count: 1, at: [[0, ty - 48, zb + 4]], dir: [0, 0, -1] },
            { kind: "screw", count: 1, len: 50, dia: 5, at: [[0, ty - 48, zb + 2]], dir: [0, 0, -1] },
          ],
          tools: ["screwdriver", "drill", "pencil"],
          wall: true,
          warnings: ["wall", "tip"],
        },
  );
  return { parts, steps };
}

/* ---------- bench ---------- */

function benchRecipe(): CustomParams {
  const W = 790, D = 340, H = 470;
  const L = 35, bt = 18, top = H - 15; // legs stand 15 mm above the seat board
  const zl = D / 2 - L / 2;
  const rh = 50, ry = top - bt - rh / 2;
  const shelfY = 135;
  const parts: CustomPart[] = [];
  const ends = [-1, 1].map((sx, i) => {
    const x = sx * (W / 2 - L / 2), xi = sx * (W / 2 - L - 10);
    const pieces: PartPiece[] = [
      ...[-1, 1].map((sz) => box([L, H, L], [x, H / 2, sz * zl])),
      box([20, rh, D - 2 * L], [xi, ry, 0]),
      box([20, 30, D - 2 * L], [xi, shelfY - 14 - 15, 0]),
    ];
    const p = compound(`E${i}`, "End frame", pieces);
    parts.push(p);
    return p.id;
  });
  const iw = W - 2 * L;
  // the shelf's rails sit in line with the legs
  parts.push(slatted("S", iw, D - 2 * L, shelfY, 40, 0, zl));
  for (const [i, sz] of [-1, 1].entries()) parts.push({ id: `R${i}`, name: "Long rail", size: [iw, rh, 20], pos: [0, ry, sz * zl], material: "wood" });
  parts.push({ id: "T", name: "Seat", size: [iw, bt, D], pos: [0, top - bt / 2, 0], material: "wood" });
  const railY = shelfY - 20; // middle of the shelf's rails
  const long = (side: number, mate: string, y: number) => bolts(side, ends[side < 0 ? 0 : 1], mate, W / 2, [-1, 1].map((sz) => [y, sz * zl] as [number, number]), LONG);
  const steps: CustomStep[] = [
    {
      title: "Bolt the slatted shelf to an end frame",
      detail: "Stand the end frame up with its rails facing in. The shelf's rails go against the legs, one long bolt in each.",
      add: [ends[0], "S"],
      fix: [long(-1, "S", railY)],
      tools: ["allen"],
    },
    {
      title: "Bolt on the two long rails",
      detail: "Their sloped edge faces out and up. One long bolt through each leg.",
      add: ["R0", "R1"],
      fix: [{ ...long(-1, "R0", ry), count: 1, at: [[-W / 2, ry, -zl]], mate: "R0" }, { ...long(-1, "R1", ry), count: 1, at: [[-W / 2, ry, zl]], mate: "R1" }],
      tools: ["allen"],
    },
    {
      title: "Bolt on the other end frame",
      detail: "Four long bolts, two into the shelf and two into the rails. Tighten them once the frame stands square.",
      add: [ends[1]],
      fix: [long(1, "S", railY), { ...long(1, "R0", ry), count: 1, at: [[W / 2, ry, -zl]], mate: "R0" }, { ...long(1, "R1", ry), count: 1, at: [[W / 2, ry, zl]], mate: "R1" }],
      tools: ["allen"],
      check: "square",
    },
  ];
  // eight short bolts up through the rails into the seat: two in each
  const up = (on: string, pts: [number, number][]): CustomFix => ({ kind: "bolt", count: pts.length, ...SHORT, at: pts.map(([x, z]) => [x, ry - rh / 2, z] as Vec3), dir: [0, 1, 0], on, mate: "T" });
  const xe = W / 2 - L - 10, zq = D / 4, xq = iw / 4;
  steps.push({
    title: "Turn it upside down onto the seat and bolt it on",
    detail: "Lay the seat face down on a rug and set the frame on it, legs up. Two short bolts through each rail.",
    add: ["T"],
    fix: [up(ends[0], [[-xe, -zq], [-xe, zq]]), up(ends[1], [[xe, -zq], [xe, zq]]), up("R0", [[-xq, -zl], [xq, -zl]]), up("R1", [[-xq, zl], [xq, zl]])],
    from: { T: [0, -300, 0] },
    tools: ["allen"],
    pose: "-y",
    warnings: ["floor"],
  });
  steps.push({ title: "Turn the bench the right way up", pose: "+y" });
  return { parts, steps };
}

/* ---------- trolley ---------- */

function trolleyRecipe(): CustomParams {
  const W = 420, D = 330;
  const C = 60; // castor height under the legs
  const zl = D / 2 - P / 2;
  const levels = [140, 390]; // tops of the slats
  const trayY = 620; // top of the tray's bottom board
  const trayRim = 70;
  const parts: CustomPart[] = [];
  const ends = [-1, 1].map((sx, i) => {
    const x = sx * (W / 2 - P / 2);
    const legH = (i === 0 ? 760 : 700) - C;
    const pieces: PartPiece[] = [-1, 1].map((sz) => box([P, legH, P], [x, C + legH / 2, sz * zl]));
    // rims at the end of each tray, and the handle across the top of one end
    for (const y of levels) pieces.push(box([18, 40, D - 2 * P], [x, y + 40 - 20 - 14, 0]));
    pieces.push(box([18, trayRim, D - 2 * P], [x, trayY - 12 + trayRim / 2, 0]));
    if (i === 0) pieces.push({ shape: "cyl", size: [26, D - 2 * P, 26], pos: [x, 760 - 20, 0], rot: [Math.PI / 2, 0, 0] });
    const p = compound(`E${i}`, i === 0 ? "End frame with handle" : "End frame", pieces);
    parts.push(p);
    return p.id;
  });
  const iw = W - 2 * P;
  levels.forEach((y, i) => {
    const sh = slatted(`S${i}`, iw, D, y, 40, 26);
    parts.push(sh);
  });
  for (const [i, sz] of [-1, 1].entries()) parts.push({ id: `R${i}`, name: "Tray rail", size: [iw, trayRim, 20], pos: [0, trayY - 12 + trayRim / 2, sz * zl], material: "wood" });
  parts.push({ id: "B", name: "Tray bottom", size: [iw, 8, 2 * zl - 20], pos: [0, trayY - 8, 0], material: "board" });
  const ry = trayY - 12 + trayRim / 2;
  const sideBolts = (side: number) => {
    const on = ends[side < 0 ? 0 : 1];
    return [
      ...levels.map((y, i) => bolts(side, on, `S${i}`, W / 2, [-1, 1].map((sz) => [y + 6, sz * zl] as [number, number]))),
      ...[0, 1].map((i) => bolts(side, on, `R${i}`, W / 2, [[ry, (i ? 1 : -1) * zl]])),
    ];
  };
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the tray rails",
      detail: "One into each end of both rails, on a rug. Grooves facing each other.",
      fix: [0, 1].flatMap((i) =>
        [-1, 1].map((sx): CustomFix => ({ kind: "dowel", count: 1, at: [[sx * (iw / 2), ry, (i ? 1 : -1) * zl]], dir: [-sx, 0, 0], on: `R${i}`, mate: ends[sx < 0 ? 0 : 1] })),
      ),
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the shelves and rails to an end frame",
      detail: "The end frame with the handle lies on the rug. Slats facing the handle's top, two bolts into each shelf and one into each rail.",
      add: [ends[0], "S0", "S1", "R0", "R1"],
      fix: sideBolts(-1),
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Slide the tray bottom into the rails",
      detail: "Smooth side up, along the grooves until it meets the end frame.",
      add: ["B"],
      from: { B: [600, 0, 0] },
    },
    {
      title: "Bolt on the other end frame",
      detail: "Onto the dowels, then six bolts. Tighten them all once it is square.",
      add: [ends[1]],
      fix: sideBolts(1),
      tools: ["allen"],
      check: "square",
    },
  ];
  // two castors with brakes go under one end, two without under the other
  const castors = (i: number): CustomFix[] => {
    const x = (i ? 1 : -1) * (W / 2 - P / 2);
    const at = [-1, 1].map((sz) => [x, C, sz * zl] as Vec3);
    return [
      { kind: "washer", count: 2, at, dir: [0, 1, 0], on: ends[i] },
      { kind: "castor", count: 2, name: i ? "Castor" : "Castor with brake", at: at.map((p) => [p[0], p[1] - 2, p[2]] as Vec3), dir: [0, 1, 0], on: ends[i] },
    ];
  };
  steps.push({
    title: "Screw in the castors with brakes",
    detail: "A washer on each, then turn them into the legs at one end and tighten with the spanner.",
    fix: castors(0),
    tools: ["wrench"],
  });
  steps.push({ title: "Screw in the other two castors", detail: "The same way, at the other end.", fix: castors(1), tools: ["wrench"] });
  steps.push({ title: "Stand it up on its castors", pose: "+y" });
  return { parts, steps };
}

const family: Family = {
  names: ["STEGESUND"],
  recipe(s) {
    const v = s.variant.toLowerCase();
    if (/^shelf unit/.test(v)) return shelfRecipe(s);
    if (/^bench/.test(v)) return benchRecipe();
    if (/^trolley/.test(v)) return trolleyRecipe();
    return null;
  },
};
export default family;
