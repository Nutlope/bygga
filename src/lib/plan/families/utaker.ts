import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * UTÅKER, from IKEA's manual (one bed; two of them stack). Four round pine corner legs, each with cam bolts
 * screwed in. The two end rails get dowels and cam locks and are pushed onto a pair of legs each; then each side
 * rail goes onto the legs with dowels and cams, one end at a time. Two crossed steel wires are screwed into the
 * corners to keep it square, two buttons and a fabric strap go on for joining two beds side by side, and the
 * slatted base is laid in and screwed down at both ends.
 */

const LEG = 50; // corner legs, round
const RT = 22; // rails
const CAMBOLT = { kind: "camScrew" as const, len: 34, dia: 6 };
const CAM = { kind: "cam" as const, dia: 15, len: 12 };
const DOWEL = { kind: "dowel" as const, len: 30, dia: 8 };

/** IKEA's sizes by mattress (width x length, mm). */
const SIZES: Record<string, [number, number]> = { "800x2000": [830, 2050], "970x1910": [1000, 1950] };

function mattress(s: ProductSpec): [number, number] {
  const m = /(\d{2,3})\s*[×x]\s*(\d{3})/.exec(s.variant);
  if (m) return [+m[1] * 10, +m[2] * 10];
  return [s.size.w * 10 - 30, s.size.d * 10 - 50];
}

function recipe(s: ProductSpec) {
  const [mw, ml] = mattress(s);
  const [W, L] = SIZES[`${mw}x${ml}`] ?? [mw + 30, ml + 50];
  const H = 230;
  const lx = W / 2 - LEG / 2, lz = L / 2 - LEG / 2; // leg centres
  const ry0 = 100, ry1 = 200, ry = (ry0 + ry1) / 2, rh = ry1 - ry0;
  const legs: [string, number, number][] = [
    ["A", -1, -1],
    ["C", 1, -1],
    ["B", -1, 1],
    ["D", 1, 1],
  ];
  const parts: CustomPart[] = legs.map(([id, sx, sz]) => ({ id, label: id, name: "Corner leg", size: [LEG, H, LEG], pos: [sx * lx, H / 2, sz * lz], shape: "cyl", material: "wood" }));
  const ex = lx - LEG / 2; // end rails reach to the legs
  const sz0 = lz - LEG / 2;
  // the end rails sit lower by a slat's depth: the slatted base's end slats lie on them and are screwed down
  const SLAT = 16;
  parts.push({ id: "EH", name: "End rail", size: [2 * ex, rh - SLAT, RT], pos: [0, ry - SLAT / 2, -lz], material: "wood" });
  parts.push({ id: "EF", name: "End rail", size: [2 * ex, rh - SLAT, RT], pos: [0, ry - SLAT / 2, lz], material: "wood" });
  parts.push({ id: "S0", name: "Side rail", size: [RT, rh, 2 * sz0], pos: [-lx, ry, 0], material: "wood" });
  parts.push({ id: "S1", name: "Side rail", size: [RT, rh, 2 * sz0], pos: [lx, ry, 0], material: "wood" });
  // the crossed wires, corner to corner under the slats
  const span = 2 * ex - 20, run = 2 * sz0 - 20;
  const ang = Math.atan2(span, run), len = Math.hypot(span, run);
  const wires: PartPiece[] = [
    { shape: "box", size: [3, 3, len], pos: [0, 0, 0], rot: [0, ang, 0] },
    { shape: "box", size: [3, 3, len], pos: [0, 0, 0], rot: [0, -ang, 0] },
  ];
  parts.push({ id: "X", name: "Cross wires", size: [span, 3, run], pos: [0, ry0 + 20, 0], pieces: wires, material: "metal" });
  // the joining strap, hanging on the outside of the right-hand side rail
  parts.push({ id: "J", name: "Joining strap", size: [3, 90, 300], pos: [lx + RT / 2 + 1.5, ry, 0], material: "fiber" });
  // the slatted base, a roll of slats on two tapes, between the rails
  const bw = 2 * ex, bl = 2 * lz; // between the legs, end slats over the end rails
  const n = Math.round(bl / 110);
  const pitch = (bl - 60) / (n - 1);
  const roll: PartPiece[] = [
    ...Array.from({ length: n }, (_, i): PartPiece => ({ shape: "box", size: [bw, 12, 60], pos: [0, 2, -bl / 2 + 30 + i * pitch] })),
    ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [24, 4, bl], pos: [k * (bw / 2 - 90), -6, 0], material: "fiber" })),
  ];
  parts.push({ id: "SB", name: "Slatted bed base", size: [bw, 16, bl], pos: [0, ry1 - 8, 0], pieces: roll, material: "wood" });
  parts.push({ id: "M", name: "Your mattress", size: [mw, 130, ml], pos: [0, ry1 + 65, 0], material: "soft", extra: true });

  const leg = (id: string) => legs.find((l) => l[0] === id)!;
  // a cam bolt in the leg's face toward a rail: "x" faces the end rail, "z" the side rail
  const boltAt = (id: string, axis: "x" | "z", ys: number[]): CustomFix => {
    const [, sx, sz] = leg(id);
    const dir: Vec3 = axis === "x" ? [-sx, 0, 0] : [0, 0, -sz];
    const at = ys.map((y) => (axis === "x" ? [sx * (lx - LEG / 2), y, sz * lz] : [sx * lx, y, sz * (lz - LEG / 2)]) as Vec3);
    return { ...CAMBOLT, count: at.length, at, dir, on: id };
  };
  const two = [ry - 25, ry + 25];
  const one = [ry];
  // a cam lock in a rail's inside face, near the end it meets the leg
  const camAt = (rail: string, id: string, ys: number[]): CustomFix => {
    const [, sx, sz] = leg(id);
    const end = rail.startsWith("E");
    const at = ys.map((y) => (end ? [sx * (ex - 30), y, sz * (lz - RT / 2)] : [sx * (lx - RT / 2), y, sz * (sz0 - 30)]) as Vec3);
    return { ...CAM, count: at.length, at, dir: end ? [0, 0, sz] : [sx, 0, 0], on: rail };
  };
  const dowelsAt = (rail: string, id: string, ys: number[]): CustomFix => {
    const [, sx, sz] = leg(id);
    const end = rail.startsWith("E");
    const at = ys.map((y) => (end ? [sx * ex, y, sz * lz] : [sx * lx, y, sz * sz0]) as Vec3);
    return { ...DOWEL, count: at.length, at, dir: end ? [sx, 0, 0] : [0, 0, sz], on: rail };
  };

  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the legs",
      detail: "By hand, into the holes facing the rails. Each leg is lettered so it ends up at the right corner.",
      add: ["A", "B", "C", "D"],
      fix: [boltAt("A", "x", one), boltAt("A", "z", one), boltAt("C", "x", one), boltAt("C", "z", one), boltAt("B", "x", one), boltAt("B", "z", two), boltAt("D", "x", one), boltAt("D", "z", two)],
      warnings: ["hand"],
    },
    {
      title: "Tap the dowels into the end rails",
      detail: "Two in each end.",
      fix: [dowelsAt("EH", "A", two), dowelsAt("EH", "C", two), dowelsAt("EF", "B", two), dowelsAt("EF", "D", two)],
      tools: ["hammer"],
    },
    {
      title: "Push the cam locks into the end rails",
      detail: "One at each end, arrows pointing to the end of the rail.",
      fix: [camAt("EH", "A", one), camAt("EH", "C", one), camAt("EF", "B", one), camAt("EF", "D", one)],
      warnings: ["hand"],
    },
    {
      title: "Push the legs onto the end rails",
      detail: "Legs A and C on one rail, B and D on the other, the cam bolts into the rail ends.",
      add: ["EH", "EF"],
    },
    { title: "Turn the cam locks to tighten", detail: "A half turn each, clockwise, so the legs pull tight against the rails.", tools: ["screwdriver"] },
    {
      title: "Tap the dowels into a side rail",
      detail: "Two at the end that meets leg A.",
      fix: [dowelsAt("S0", "A", two)],
      tools: ["hammer"],
    },
    {
      title: "Fit the side rail to leg A and lock the cam",
      detail: "Push the cam lock in, then turn it clockwise.",
      add: ["S0"],
      fix: [camAt("S0", "A", one)],
      tools: ["screwdriver"],
    },
    {
      title: "Tap a dowel into the other end",
      detail: "Where the rail meets leg B. The rail's holes line up with the leg's.",
      fix: [dowelsAt("S0", "B", one)],
      tools: ["hammer"],
    },
    { title: "Lock that end with two cams", fix: [camAt("S0", "B", two)], tools: ["screwdriver"] },
    {
      title: "Tap three dowels into the other side rail",
      fix: [dowelsAt("S1", "C", two), dowelsAt("S1", "D", one)],
      tools: ["hammer"],
    },
    {
      title: "Fit it to legs C and D and lock the cams",
      detail: "Three cam locks, each turned clockwise until it's tight.",
      add: ["S1"],
      fix: [camAt("S1", "C", one), camAt("S1", "D", two)],
      tools: ["screwdriver"],
      check: "square",
    },
    {
      title: "Screw the cross wires into the corners",
      detail: "One screw in each corner, inside the rails, so the frame stays square.",
      add: ["X"],
      fix: [-1, 1].map((sz): CustomFix => ({
        kind: "screw",
        count: 2,
        len: 16,
        dia: 4,
        at: [-1, 1].map((sx) => [sx * (ex - 10), ry0 + 20, sz * (lz - RT / 2)] as Vec3),
        dir: [0, 0, sz],
      })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw in the two strap buttons",
      detail: "Into the outside of the left-hand side rail, for joining two beds side by side.",
      fix: [{ kind: "screw", name: "Strap button", count: 2, len: 16, dia: 6, dir: [1, 0, 0], at: [-1, 1].map((sz) => [-lx - RT / 2, ry, sz * 150] as Vec3) }],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the joining strap to the other side rail",
      detail: "One screw with a washer through the strap's hole, into the middle of the rail.",
      add: ["J"],
      fix: [
        { kind: "washer", count: 1, at: [[lx + RT / 2 + 3, ry, 0]], dir: [-1, 0, 0] },
        { kind: "screw", count: 1, len: 20, dia: 4, at: [[lx + RT / 2 + 4, ry, 0]], dir: [-1, 0, 0] },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the slatted base in and screw down one end",
      detail: "Unroll it from end to end. Four screws through the end slat.",
      add: ["SB"],
      fix: [{ kind: "screw", count: 4, len: 30, dia: 4, dir: [0, -1, 0], at: [-0.36, -0.12, 0.12, 0.36].map((t) => [t * bw, ry1, -lz + 6] as Vec3) }],
      tools: ["screwdriver"],
    },
    {
      title: "Screw down the other end",
      detail: "Pull the slats straight first, then four more screws.",
      fix: [{ kind: "screw", count: 4, len: 30, dia: 4, dir: [0, -1, 0], at: [-0.36, -0.12, 0.12, 0.36].map((t) => [t * bw, ry1, lz - 6] as Vec3) }],
      tools: ["screwdriver"],
    },
    { title: "Lay your mattress on", detail: "No more than 13 cm thick, so a second bed can stack on top.", add: ["M"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["UTÅKER", "UTAKER"],
  recipe(s) {
    if (!/stackable/i.test(`${s.slug} ${s.variant}`)) return null;
    return recipe(s);
  },
};
export default family;
