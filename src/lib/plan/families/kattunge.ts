import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * KATTUNGE cot, read from IKEA's manual (the newborn setting, with the base at the top). Both slatted sides go
 * between the two arched ends on eight connector bolts. Four base brackets are bolted inside the ends, the base is
 * laid on them and bolted from below, and the connector bolts are tightened. Four bolts with cap nuts go through the
 * ends at the corners of the base, and two support plates are screwed under the middle of the base.
 * IKEA's sizes: 144 long, 74 wide, 101 high, for a 70 x 140 mattress.
 */

const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const rod = (dia: number, from: Vec3, to: Vec3, pos: Vec3): PartPiece => {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const along = to[0] !== from[0] ? 0 : to[2] !== from[2] ? 2 : 1;
  const c: Vec3 = [(from[0] + to[0]) / 2 - pos[0], (from[1] + to[1]) / 2 - pos[1], (from[2] + to[2]) / 2 - pos[2]];
  return { shape: "cyl", size: [dia, len, dia], pos: c, rot: along === 0 ? [0, 0, Math.PI / 2] : along === 2 ? [Math.PI / 2, 0, 0] : [0, 0, 0] };
};

function cot(s: ProductSpec): CustomParams {
  // IKEA's page: 144 x 74, 101 high (our listing says 150 x 78 x 86)
  const L = 1440, W = 740, H = 1010;
  const t = 32; // tube of the ends
  const xe = L / 2 - t / 2, ze = W / 2 - t / 2, xi = L / 2 - t; // centre line and inside face of the ends
  const yLow = 170, yTop = 860, yBase = 500; // side rails, top of the base
  const end = (id: string, g: number): CustomPart => {
    const pos: Vec3 = [g * xe, H / 2, 0];
    const pieces: PartPiece[] = [
      rod(t, [g * xe, 0, -ze], [g * xe, 900, -ze], pos),
      rod(t, [g * xe, 0, ze], [g * xe, 900, ze], pos),
      rod(t, [g * xe, 900, -ze], [g * xe, 900, ze], pos),
      rod(24, [g * xe, 140, -ze], [g * xe, 140, ze], pos),
      // the arch over the middle
      rod(t, [g * xe, H - t / 2, -200], [g * xe, H - t / 2, 200], pos),
      rod(t, [g * xe, 900, -200], [g * xe, H - t / 2, -200], pos),
      rod(t, [g * xe, 900, 200], [g * xe, H - t / 2, 200], pos),
      ...Array.from({ length: 9 }, (_, i) => rod(18, [g * xe, 140, -ze + (i + 1) * ((2 * ze) / 10)], [g * xe, i >= 3 && i <= 5 ? H - 20 : 900, -ze + (i + 1) * ((2 * ze) / 10)], pos)),
    ];
    return { id, name: "End", material: "metal", size: [t, H, W], pos, pieces };
  };
  const side = (id: string, g: number): CustomPart => {
    const z = g * ze;
    const pos: Vec3 = [0, (yLow + yTop) / 2, z];
    const n = 17;
    const pieces: PartPiece[] = [
      rod(26, [-xi, yLow, z], [xi, yLow, z], pos),
      rod(26, [-xi, yTop, z], [xi, yTop, z], pos),
      ...Array.from({ length: n }, (_, i) => rod(16, [-xi + (i + 1) * ((2 * xi) / (n + 1)), yLow, z], [-xi + (i + 1) * ((2 * xi) / (n + 1)), yTop, z], pos)),
    ];
    return { id, name: "Side", material: "metal", size: [2 * xi, yTop - yLow + 26, 26], pos, pieces };
  };
  const bw = 2 * xi - 10, bd = 2 * (ze - 13) - 10;
  const parts: CustomPart[] = [
    end("E0", -1),
    end("E1", 1),
    side("S0", -1),
    side("S1", 1),
    { id: "B", name: "Bed base", material: "board", size: [bw, 20, bd], pos: [0, yBase - 10, 0] },
    { id: "X", name: "Your mattress", material: "soft", size: [bw, 100, bd], pos: [0, yBase + 50, 0], extra: true },
  ];
  const ends = [-1, 1] as const;
  const studs = ends.flatMap((g) => [-1, 1].flatMap((h) => [yLow, yTop].map((y): Vec3 => [g * (L / 2), y, h * ze])));
  // on the second and eighth bars, which run up to the top rail
  const brackets = ends.flatMap((g) => [-1, 1].map((h): Vec3 => [g * xi, yBase - 20, h * 212]));
  const bracketBolts = brackets.map(([x, y, z]): Vec3 => [Math.sign(x) * (xe - 14), y - 26, z]);
  return {
    parts,
    steps: [
      {
        title: "Bolt both sides between the ends",
        detail: "The holes in the end of each top rail face down. Turn the eight connector bolts in through the legs, not fully tight yet.",
        add: ["E0", "S0", "S1", "E1"],
        fix: ends.map((g) => fix("bolt", studs.filter((p) => Math.sign(p[0]) === g), [-g, 0, 0], { name: "Connector bolt", len: 30, dia: 8, on: g < 0 ? "E0" : "E1" })),
        tools: ["allen"],
      },
      {
        title: "Bolt the base brackets inside the ends",
        detail: "Use the top holes for a newborn. The two kinds of bracket each go where the manual's numbers show, with one bolt each.",
        fix: ends.flatMap((g) => [
          fix("angle", brackets.filter((p) => Math.sign(p[0]) === g), [-g, 0, 0], { name: "Base bracket", len: 40, dia: 30, on: g < 0 ? "E0" : "E1" }),
          fix("bolt", bracketBolts.filter((p) => Math.sign(p[0]) === g), [g, 0, 0], { len: 12, dia: 6, on: g < 0 ? "E0" : "E1" }),
        ]),
        tools: ["allen"],
      },
      {
        title: "Lay the base in and bolt it to the brackets",
        detail: "One bolt up through each bracket into the base.",
        add: ["B"],
        fix: [fix("bolt", brackets.map(([x, , z]): Vec3 => [x - Math.sign(x) * 30, yBase - 20, z]), [0, 1, 0], { len: 12, dia: 6, mate: "B" })],
        tools: ["allen"],
        from: { B: [0, 400, 0] },
      },
      { title: "Tighten the connector bolts", detail: "Their heads should sit flush with the legs, no further.", tools: ["allen"], kind: "bolts" },
      {
        title: "Bolt through the ends at the corners of the base",
        detail: "A bolt from the outside of each leg, a cap nut from the inside. Hold the nut with one key and turn the bolt with the other.",
        fix: ends.flatMap((g) => [
          fix("bolt", [-1, 1].map((h): Vec3 => [g * (L / 2), yBase - 40, h * (ze - 40)]), [-g, 0, 0], { len: 16, dia: 6, on: g < 0 ? "E0" : "E1" }),
          fix("nut", [-1, 1].map((h): Vec3 => [g * xi, yBase - 40, h * (ze - 40)]), [g, 0, 0], { name: "Cap nut", len: 15, dia: 10 }),
        ]),
        tools: ["allen"],
      },
      {
        title: "Screw the support plates under the base",
        detail: "Two plates under the middle of the base, two screws each.",
        fix: [
          fix("plate", [-1, 1].map((h): Vec3 => [0, yBase - 20, h * 200]), [0, 1, 0], { name: "Support plate", len: 3, dia: 60, mate: "B" }),
          fix("bolt", [-1, 1].flatMap((h) => [-25, 25].map((x): Vec3 => [x, yBase - 20, h * 200])), [0, 1, 0], { len: 12, dia: 6, mate: "B" }),
        ],
        tools: ["allen"],
      },
      { title: "Lay your mattress in", detail: "It should fit snugly, with no gap at the sides or the ends.", add: ["X"], from: { X: [0, 400, 0] } },
    ],
  };
}

const family: Family = {
  names: ["KATTUNGE"],
  recipe(s) {
    if (!/cot|crib/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return cot(s);
  },
};
export default family;
