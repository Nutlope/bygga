import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, HwKind, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * TROGEN, read from the step stool's manual. It is built lying on one side: the two steps are pushed onto that
 * side's dowels, then the two front boards, and the other side goes on top. Each board end then takes a barrel nut
 * and a bolt through the side, first on the upper side, then turned over for the other one, and it is stood up.
 */

const T = 18;
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, on: string, more: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...more });
const NUT = { name: "Barrel nut", len: 14, dia: 10 };
const BOLT = { len: 60, dia: 6 };

function recipe(s: ProductSpec): CustomParams | null {
  if (!/step stool/i.test(s.variant)) return null;
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const inner = W - 2 * T, xs = W / 2 - T / 2, xi = W / 2 - T;
  const lowY = Math.round(H * 0.41), upY = Math.round(H * 0.77); // tops of the two steps
  const half = D / 2;
  const pc = H / 2;
  // a side, in its own plane: [height, depth]; tall with a hand hole at the back, low and rounded at the front, an arch underneath
  const prof: [number, number][] = [
    [0, -half], [H, -half], [H, -half + 90], [H - 30, -half + 130], [upY + 12, -half + 170], [upY - 30, 10],
    [lowY + 40, 40], [lowY + 15, 80], [lowY + 15, half - 25], [lowY - 10, half], [0, half],
    [0, half - 50], [35, half - 85], [55, half - 140], [55, -half + 140], [35, -half + 85], [0, -half + 50],
  ];
  const side = (id: string, sx: number): CustomPart => ({
    id, name: "Side", size: [T, H, D], pos: [sx * xs, pc, 0], material: "board",
    pieces: [{ shape: "slab", size: [H, T, D], pos: [0, 0, 0], outline: prof.map(([y, z]) => [y - pc, z]), round: 12, rot: [0, 0, Math.PI / 2] } as PartPiece],
  });
  const lowD = half - 10, upD = half; // the low step runs from the middle to the front, the high one from the back to the middle
  const apH = 70;
  const parts: CustomPart[] = [
    side("SL", -1),
    { id: "S0", name: "Low step", size: [inner, T, lowD], pos: [0, lowY - T / 2, 10 + lowD / 2], material: "board" },
    { id: "S1", name: "High step", size: [inner, T, upD], pos: [0, upY - T / 2, -upD / 2], material: "board" },
    { id: "F0", name: "Front board", size: [inner, apH, T], pos: [0, lowY - T - apH / 2, half - T / 2], material: "board" },
    { id: "F1", name: "Front board", size: [inner, apH, T], pos: [0, upY - T - apH / 2, -T / 2], material: "board" },
    side("SR", 1),
  ];
  const boards = ["S0", "S1", "F0", "F1"];
  // two dowels in each board end, a barrel nut and a bolt between them
  const ends = (b: string): Vec3[] => {
    const p = parts.find((x) => x.id === b)!;
    const flat = p.size[1] === T;
    const span = (flat ? p.size[2] : p.size[1]) / 2 - 22;
    return [-span, span].map((o) => (flat ? [0, p.pos[1], p.pos[2] + o] : [0, p.pos[1] + o, p.pos[2]]) as Vec3);
  };
  const dowels = (sx: number, list: string[], on?: string) =>
    list.map((b) => fx("dowel", ends(b).map(([, y, z]) => [sx * xi, y, z] as Vec3), on ? [sx, 0, 0] : [-sx, 0, 0], on ?? b, { mate: on ? b : sx < 0 ? "SL" : "SR", len: 30, dia: 8 }));
  const mid = (b: string) => parts.find((x) => x.id === b)!.pos;
  const nuts = (sx: number) =>
    boards.map((b) => {
      const [, y, z] = mid(b);
      const flat = b.startsWith("S");
      const at: Vec3 = flat ? [sx * (xi - 30), y - T / 2, z] : [sx * (xi - 30), y, z - T / 2];
      return fx("nut", [at], flat ? [0, 1, 0] : [0, 0, 1], b, NUT);
    });
  const bolts = (sx: number) =>
    fx("bolt", boards.map((b) => [sx * (W / 2), mid(b)[1], mid(b)[2]] as Vec3), [-sx, 0, 0], sx < 0 ? "SL" : "SR", BOLT);
  return {
    parts,
    steps: [
      {
        title: "Lay one side flat",
        detail: "Inside face up, on a rug or the flattened box, the arch towards you.",
        add: ["SL"],
        pose: "+x",
        warnings: ["floor"],
      },
      {
        title: "Push the two steps onto the side",
        detail: "Tap two dowels into the holes for each step, then press the steps down onto them, standing on edge.",
        fix: dowels(-1, ["S0", "S1"], "SL"),
        add: ["S0", "S1"],
        tools: ["hammer"],
      },
      {
        title: "Push the front boards on",
        detail: "Two dowels for each, then press each board on along the front edge of its step.",
        fix: dowels(-1, ["F0", "F1"], "SL"),
        add: ["F0", "F1"],
        tools: ["hammer"],
      },
      {
        title: "Lower the other side on",
        detail: "Tap two dowels into the top end of each board, then fit the second side over all eight and press it down evenly.",
        fix: dowels(1, boards),
        add: ["SR"],
        tools: ["hammer"],
      },
      {
        title: "Bolt the top side on",
        detail: "Drop a barrel nut into the hole in each board, slot facing out, and turn it with a flat screwdriver so the bolt can find its thread. Then turn the bolts in through the side.",
        fix: [...nuts(1), bolts(1)],
        tools: ["flathead", "allen"],
      },
      {
        title: "Turn it over and bolt the other side",
        detail: "The same way: four barrel nuts, then four bolts through the side.",
        pose: "-x",
        fix: [...nuts(-1), bolts(-1)],
        tools: ["flathead", "allen"],
      },
      {
        title: "Stand it up and tighten every bolt",
        detail: "Go round all eight bolts once more with the Allen key until the steps sit firm.",
        pose: "+y",
        tools: ["allen"],
      },
    ],
  };
}

const family: Family = { names: ["TROGEN"], recipe };
export default family;
