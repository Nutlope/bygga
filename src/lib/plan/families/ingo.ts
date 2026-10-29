import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * INGO, read from the table's manual. Everything happens upside down on a rug. A corner bracket is screwed onto
 * each end of both short rails, with a dowel in the middle of each; the long rails are screwed onto the brackets.
 * The frame goes onto the top, on the two dowels, and twelve screws with washers fix it. Each leg takes a barrel
 * nut in its top and two hanger bolts, is set into a corner and held with a spring washer and a nut on each bolt,
 * tightened with the box spanner. Then the table is turned over.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const S = [-1, 1] as const;
const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

const TT = 28; // top
const RH = 80, RT = 20; // rails
const LEG = 55;
const IN = 25; // the frame stands in from the top's edges

const BRACKET = { len: 90, dia: 40, name: "Corner bracket" };
const SMALL = { len: 16, dia: 4 };
const TOP_SCREW = { len: 50, dia: 5 };
const HANGER = { len: 70, dia: 8, name: "Hanger bolt" };
const BARREL = { len: 40, dia: 10, name: "Barrel nut" };
const SPRING = { len: 2, dia: 14, name: "Spring washer" };
const WASHER = { len: 2, dia: 14 };

function table(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const yU = H - TT; // underside of the top
  const yR = yU - RH / 2;
  const xo = W / 2 - IN, zo = D / 2 - IN; // the frame's outside
  const xs = xo - RT / 2, zs = zo - RT / 2; // rail middles
  const xl = xo - RT - LEG / 2, zl = zo - RT - LEG / 2; // legs sit in the frame's inside corners
  const parts: CustomPart[] = [
    { id: "T", name: "Table top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    ...S.map((sx, i): CustomPart => ({ id: `Z${i + 1}`, name: "Short rail", size: [RT, RH, 2 * zo - 2 * RT], pos: [sx * xs, yR, 0], material: "wood" })),
    ...S.map((sz, i): CustomPart => ({ id: `X${i + 1}`, name: "Long rail", size: [2 * xo, RH, RT], pos: [0, yR, sz * zs], material: "wood" })),
    ...CORNERS.map(([sx, sz], i): CustomPart => ({ id: `G${i + 1}`, name: "Leg", size: [LEG, yU, LEG], pos: [sx * xl, yU / 2, sz * zl], material: "wood" })),
  ];
  const zr = (sx: number) => `Z${sx < 0 ? 1 : 2}`;
  const xr = (sz: number) => `X${sz < 0 ? 1 : 2}`;
  // each bracket sits across an inside corner, 40 mm along each rail
  const bk = (sx: number, sz: number): Vec3 => [sx * (xo - RT - 22), yR, sz * (zo - RT - 22)];
  const brackets = CORNERS.map(([sx, sz]) => fx("angle", [bk(sx, sz)], [sx * 0.71, 0, sz * 0.71], { ...BRACKET, on: zr(sx), mate: xr(sz) }));
  const intoShort = CORNERS.map(([sx, sz]) => fx("screw", [-18, 18].map((dy): Vec3 => [sx * (xo - RT - 2), yR + dy, sz * (zo - RT - 40)]), [sx, 0, 0], { ...SMALL, on: zr(sx) }));
  const intoLong = CORNERS.map(([sx, sz]) => fx("screw", [-18, 18].map((dy): Vec3 => [sx * (xo - RT - 40), yR + dy, sz * (zo - RT - 2)]), [0, 0, sz], { ...SMALL, on: xr(sz) }));
  const dowels = S.map((sx) => fx("dowel", [[sx * xs, yU, 0]], [0, -1, 0], { len: 30, dia: 8, on: zr(sx), mate: "T" }));
  // twelve screws up through the rails into the top: four in each long rail, two in each short one
  const longX = [-0.36, -0.12, 0.12, 0.36].map((f) => f * 2 * xo);
  const shortZ = [-0.25, 0.25].map((f) => f * 2 * zo);
  const yS = yU - 30; // counterbored from below
  const topPts: { at: Vec3; on: string }[] = [
    ...S.flatMap((sz) => longX.map((x) => ({ at: [x, yS, sz * zs] as Vec3, on: xr(sz) }))),
    ...S.flatMap((sx) => shortZ.map((z) => ({ at: [sx * xs, yS, z] as Vec3, on: zr(sx) }))),
  ];
  const topWashers = [fx("washer", topPts.map((p) => p.at), [0, 1, 0], { ...WASHER })];
  const topScrews = topPts.map((p) => fx("screw", [p.at], [0, 1, 0], { ...TOP_SCREW, on: p.on, mate: "T" }));
  // each leg: a barrel nut down into its top, two hanger bolts through its inside corner into the nut
  const inner = (i: number, dy = 0): Vec3 => {
    const [sx, sz] = CORNERS[i];
    return [sx * (xl - LEG / 2 + 6), yR + dy, sz * (zl - LEG / 2 + 6)];
  };
  const out = (i: number): Vec3 => [CORNERS[i][0] * 0.71, 0, CORNERS[i][1] * 0.71];
  const barrels = CORNERS.map(([sx, sz], i) => fx("connector", [[sx * xl, yU, sz * zl]], [0, -1, 0], { ...BARREL, on: `G${i + 1}` }));
  const hangers = CORNERS.map((_, i) => fx("stud", [inner(i, -18), inner(i, 18)], out(i), { ...HANGER, on: `G${i + 1}` }));
  const legNuts = CORNERS.flatMap((_, i) => {
    const [sx, sz] = CORNERS[i];
    const p = (dy: number): Vec3 => [sx * (xl - LEG / 2 - 14), yR + dy, sz * (zl - LEG / 2 - 14)];
    return [fx("washer", [p(-18), p(18)], out(i), { ...SPRING }), fx("nut", [p(-18), p(18)], out(i), { len: 6, dia: 8 })];
  });
  return {
    parts,
    steps: [
      {
        title: "Fit the short rails with brackets and dowels",
        detail: "Lay the rails on a rug. A dowel into the hole in the middle of each top edge, then a corner bracket at each end with two screws.",
        add: ["Z1", "Z2"],
        fix: [...dowels, ...brackets, ...intoShort],
        tools: ["hammer", "screwdriver"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Screw the long rails onto the brackets",
        detail: "Two screws through each bracket. The dowels point the same way as the big holes in the long rails' edges.",
        add: ["X1", "X2"],
        fix: intoLong,
        tools: ["screwdriver"],
        from: { X1: [0, 0, -220], X2: [0, 0, 220] },
      },
      {
        title: "Set the frame on the top",
        detail: "Lay the top face down on the rug and put the frame onto it, the dowels into the top's holes.",
        add: ["T"],
        from: { T: [0, 220, 0] },
        warnings: ["face"],
      },
      {
        title: "Screw the frame to the top",
        detail: "Twelve screws, each with a washer, down through the rails into the top.",
        fix: [...topWashers, ...topScrews],
        tools: ["screwdriver"],
      },
      {
        title: "Fit the barrel nuts and hanger bolts into the legs",
        detail: "A barrel nut into the hole in the top of each leg, slot lined up, then two hanger bolts through the corner into it.",
        fix: [...barrels, ...hangers],
        wait: ["G1", "G2", "G3", "G4"],
        tools: ["flathead"],
      },
      {
        title: "Bolt the legs into the corners",
        detail: "Push each leg into a corner, its bolts through the bracket. A spring washer and a nut on each, tightened with the box spanner.",
        add: ["G1", "G2", "G3", "G4"],
        fix: legNuts,
        tools: ["wrench"],
        from: { G1: [0, -260, 0], G2: [0, -260, 0], G3: [0, -260, 0], G4: [0, -260, 0] },
      },
      { title: "Turn the table over", detail: "Together, lifting it by the top, not the legs.", pose: "+y", people: 2, warnings: ["two"] },
    ],
  };
}

const family: Family = {
  names: ["INGO"],
  recipe(s) {
    if (/^ingo-table/.test(s.slug ?? "")) return table(s);
    return null;
  },
};
export default family;
