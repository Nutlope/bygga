import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * RÅGRUND (bamboo bathroom range), read from its three manuals. Everything is held with Allen bolts.
 * Bench: built upside down on a rug. The front and back rails are bolted to the top from below, the two leg
 * frames stand on it with one bolt each, then long bolts go through the legs into the rails' ends, and the
 * slatted shelf goes in between the legs on four more long bolts.
 * Shelving unit: lying on its back, the four shelves stand on one ready-made side ladder with two bolts at each
 * end, the other ladder goes on top the same way, and stood up a bracket under the top shelf holds it to the wall.
 * Tall 33 cm unit: a deep lower section (two ladders, four shelves) and a shallow upper one (two short ladders,
 * three narrow shelves) are bolted up lying down, joined with two bolts, stood up and strapped to the wall.
 * Trolley: lying on its front, the three slatted shelves stand on the front frame with two bolts each, the two
 * top bars with one bolt each, the back frame goes on with eight more, then a castor is screwed to each post end.
 */

const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
const spread = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));
const SHORT = { kind: "bolt" as const, name: "Short Allen bolt", len: 45, dia: 6 };
const LONG = { kind: "bolt" as const, name: "Long Allen bolt", len: 70, dia: 6 };
const W_SCREW = { kind: "screw" as const, len: 50, dia: 5 };

/** Slats running along z on two rails along x at the z ends, about the middle. */
function slatted(w: number, d: number, st: number, rh: number, n: number): PartPiece[] {
  const sw = (w - (n - 1) * 8) / n, h = st + rh;
  return [
    ...spread(-w / 2 + sw / 2, w / 2 - sw / 2, n).map((x): PartPiece => ({ shape: "box", size: [sw, st, d], pos: [x, h / 2 - st / 2, 0] })),
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [w, rh, 20], pos: [0, -h / 2 + rh / 2, g * (d / 2 - 10)] })),
  ];
}

/* ---------------------------------------------------------------- bench */

function bench(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 780, H = Math.round(s.size.h * 10) || 470, D = Math.round(s.size.d * 10) || 370;
  const TT = 20, L = 30, AH = 50;
  const lx = W / 2 - 30, lz = D / 2 - 25; // leg centres
  const ix = lx - L / 2; // legs' inner faces along x
  const ay = H - TT - AH / 2; // aprons and the frames' top rails
  const shelfTop = 220, RH = 40, SS = 15;
  const sy = shelfTop - (SS + RH) / 2, ry = shelfTop - SS - RH / 2;
  const legH = H - TT;
  const frame: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [L, legH, L], pos: [0, 0, g * lz] })),
    { shape: "box", size: [20, AH, 2 * lz - L], pos: [0, ay - legH / 2, 0] },
    { shape: "box", size: [20, 30, 2 * lz - L], pos: [0, ry - RH / 2 - 15 - legH / 2, 0] },
  ];
  const parts: CustomPart[] = [
    { id: "T", name: "Seat top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    ...[-1, 1].map((g, i): CustomPart => ({ id: `A${i}`, name: "Long rail", size: [2 * ix, AH, 20], pos: [0, ay, g * lz], material: "wood" })),
    ...[-1, 1].map((g, i): CustomPart => ({ id: `F${i}`, name: "Leg frame", size: [L, legH, 2 * lz + L], pos: [g * lx, legH / 2, 0], material: "wood", pieces: frame })),
    { id: "S", name: "Slatted shelf", size: [2 * ix, SS + RH, 2 * lz + 20], pos: [0, sy, 0], material: "wood", pieces: slatted(2 * ix, 2 * lz + 20, SS, RH, 24) },
  ];
  const yb = H - TT - AH; // the rails' free edge, facing up while the bench is upside down
  const longBolts = (y: number): CustomFix[] =>
    [-1, 1].map((g): CustomFix => ({ ...LONG, count: 2, at: [-1, 1].map((z) => pt(g * (lx + L / 2), y, z * lz)), dir: [-g, 0, 0], on: g < 0 ? "F0" : "F1" }));
  const steps: CustomStep[] = [
    {
      title: "Bolt the long rails to the top",
      detail: "Lay the top upside down on a rug. Three short bolts down through each rail, with the Allen key.",
      add: ["T", "A0", "A1"],
      fix: [-1, 1].map((g, i): CustomFix => ({ ...SHORT, count: 3, on: `A${i}`, mate: "T", at: spread(-ix + 80, ix - 80, 3).map((x) => pt(x, yb, g * lz)), dir: [0, 1, 0] })),
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Stand the leg frames on the top",
      detail: "One at each end, between the rails, legs pointing up. A short bolt through each frame's top rail into the top.",
      add: ["F0", "F1"],
      fix: [-1, 1].map((g, i): CustomFix => ({ ...SHORT, count: 1, on: `F${i}`, mate: "T", at: [pt(g * lx, yb, 0)], dir: [0, 1, 0] })),
      tools: ["allen"],
    },
    { title: "Bolt the legs to the rails", detail: "A long bolt through each leg into the end of a rail.", fix: longBolts(ay), tools: ["allen"] },
    {
      title: "Fit the slatted shelf",
      detail: "Slats facing the top, between the legs on the frames' lower rails. A long bolt through each leg into the shelf.",
      add: ["S"],
      fix: longBolts(ry),
      tools: ["allen"],
      from: { S: [0, -400, 0] },
    },
    { title: "Turn the bench over", detail: "Stand it on its legs and check every bolt is tight.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- shelving unit */

function shelving(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 370, H = Math.round(s.size.h * 10) || 1040, D = Math.round(s.size.d * 10) || 370;
  const P = 30, ST = 18;
  const px = W / 2 - P / 2, pz = D / 2 - P / 2, iw = W - 2 * P, id = D - 2 * P;
  const tops = spread(170, H - 120, 4).reverse(); // from the top down
  const sy = (i: number) => tops[i] - ST / 2;
  const rungs = [H - 20, ...tops.slice(1).map((t) => t - ST - 15)];
  const ladder: PartPiece[] = [
    ...[-1, 1].map((z): PartPiece => ({ shape: "box", size: [P, H, P], pos: [0, 0, z * pz] })),
    ...rungs.map((y): PartPiece => ({ shape: "box", size: [20, 30, id], pos: [0, y - H / 2, 0] })),
  ];
  const parts: CustomPart[] = [
    { id: "L", name: "Side ladder", size: [P, H, D], pos: [-px, H / 2, 0], material: "wood", pieces: ladder },
    ...tops.map((_, i): CustomPart => ({ id: `S${i}`, name: "Shelf", size: [iw, ST, D], pos: [0, sy(i), 0], material: "wood" })),
    { id: "R", name: "Side ladder", size: [P, H, D], pos: [px, H / 2, 0], material: "wood", pieces: ladder },
  ];
  const bolts = (g: number): CustomFix => ({
    ...LONG,
    name: "Allen bolt",
    count: 8,
    on: g < 0 ? "L" : "R",
    at: tops.flatMap((_, i) => [-1, 1].map((z) => pt(g * (W / 2), sy(i), z * pz))),
    dir: [-g, 0, 0],
  });
  const wz = -D / 2;
  const by = tops[0] - ST;
  const shelves = tops.map((_, i) => `S${i}`);
  const steps: CustomStep[] = [
    {
      title: "Bolt the shelves to one side ladder",
      detail: "Lay the ladder on its edge on a rug, with the unit lying on its back. Stand the four shelves on it and drive two bolts through the posts into each shelf.",
      add: ["L", ...shelves],
      fix: [bolts(-1)],
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Bolt on the other side ladder", detail: "Lower it onto the shelves and drive in eight more bolts. Tighten them all once it's square.", add: ["R"], fix: [bolts(1)], tools: ["allen"], check: "square" },
    {
      title: "Fix it to the wall",
      detail: "Stand it against the wall. Screw the bracket under the top shelf at the back, then screw it to the wall through a washer. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "angle", name: "Wall bracket", count: 1, len: 60, dia: 30, on: "S0", at: [pt(0, by, wz + 15)], dir: [0, 1, 0] },
        { kind: "washer", count: 1, len: 2, dia: 16, at: [pt(0, by - 2, wz + 20)], dir: [0, 1, 0] },
        { kind: "screw", count: 1, len: 16, dia: 4, on: "S0", at: [pt(0, by - 4, wz + 20)], dir: [0, 1, 0] },
        { kind: "plug", count: 1, at: [pt(0, by - 25, wz - 20)], dir: [0, 0, -1] },
        { kind: "washer", count: 1, len: 2, dia: 16, at: [pt(0, by - 25, wz - 2)], dir: [0, 0, -1] },
        { ...W_SCREW, count: 1, at: [pt(0, by - 25, wz - 4)], dir: [0, 0, -1] },
      ],
      tools: ["screwdriver", "drill", "pencil"],
      pose: "+y",
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- tall shelving unit (33 cm) */

/**
 * The tall 33 cm unit is two sections: a deep lower one of two ladders and four shelves, and a shallow upper one of
 * two short ladders and three narrow shelves that stands on the lower top shelf at the back. All 30 bolts are the same.
 */
function tower(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 330, H = Math.round(s.size.h * 10) || 1630, D = Math.round(s.size.d * 10) || 280;
  const P = 28, ST = 18, UT = 15, BL = 50;
  const BOLT = { kind: "bolt" as const, name: "Allen bolt", len: BL, dia: 6 };
  const px = W / 2 - P / 2, pz = D / 2 - P / 2, iw = W - 2 * P;
  const HL = Math.round(H * 0.62); // the lower section's posts
  const tops = [160, Math.round(HL * 0.49), Math.round(HL * 0.735), HL - 20]; // lower shelves, bottom up
  const sy = (i: number) => tops[i] - ST / 2;
  const ladder = (h: number, d: number, rungs: number[], rh: number[]): PartPiece[] => [
    ...[-1, 1].map((z): PartPiece => ({ shape: "box", size: [P, h, P], pos: [0, 0, z * (d / 2 - P / 2)] })),
    ...rungs.map((y, i): PartPiece => ({ shape: "box", size: [20, rh[i], d - 2 * P], pos: [0, y - h / 2, 0] })),
  ];
  const lower = ladder(HL, D, [40, HL - 35], [30, 30]);
  // the upper section, as wide as the space between the lower posts and a little under half as deep
  const UW = iw, UD = 130, uy0 = tops[3], UH = H - uy0;
  const ux = UW / 2 - P / 2, uz = -D / 2 + UD / 2, uzp = UD / 2 - P / 2, uiw = UW - 2 * P;
  const utops = [uy0 + Math.round(UH * 0.33), uy0 + Math.round(UH * 0.66), H - 10];
  const upper = ladder(UH, UD, [20, UH - 40], [40, 30]);
  const parts: CustomPart[] = [
    { id: "L", name: "Side ladder", size: [P, HL, D], pos: [-px, HL / 2, 0], material: "wood", pieces: lower },
    ...tops.map((_, i): CustomPart => ({ id: `S${i}`, name: "Shelf", size: [iw, ST, D], pos: [0, sy(i), 0], material: "wood" })),
    { id: "R", name: "Side ladder", size: [P, HL, D], pos: [px, HL / 2, 0], material: "wood", pieces: lower },
    { id: "UL", name: "Short ladder", size: [P, UH, UD], pos: [-ux, uy0 + UH / 2, uz], material: "wood", pieces: upper },
    ...utops.map((t, i): CustomPart => ({ id: `U${i}`, name: "Narrow shelf", size: [uiw, UT, UD], pos: [0, t - UT / 2, uz], material: "wood" })),
    { id: "UR", name: "Short ladder", size: [P, UH, UD], pos: [ux, uy0 + UH / 2, uz], material: "wood", pieces: upper },
  ];
  const lowerBolts = (g: number, shelves: number[]): CustomFix => ({
    ...BOLT,
    count: shelves.length * 2,
    on: g < 0 ? "L" : "R",
    at: shelves.flatMap((i) => [-1, 1].map((z) => pt(g * (W / 2), sy(i), z * pz))),
    dir: [-g, 0, 0],
  });
  const upperBolts = (g: number): CustomFix => ({
    ...BOLT,
    count: 6,
    on: g < 0 ? "UL" : "UR",
    at: utops.flatMap((t) => [-1, 1].map((z) => pt(g * (UW / 2), t - UT / 2, uz + z * uzp))),
    dir: [-g, 0, 0],
  });
  const sb = tops[3] - ST; // under the lower top shelf
  const steps: CustomStep[] = [
    {
      title: "Stand the top shelf on a side ladder",
      detail: "Lay one long ladder flat on a rug and stand the shelf up at its top end, holes lined up with the posts.",
      add: ["L", "S3"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Bolt the shelf to the ladder", detail: "Two bolts through the posts, with the Allen key.", fix: [lowerBolts(-1, [3])], tools: ["allen"] },
    { title: "Bolt on the other three shelves", detail: "Two bolts in each, the bottom shelf at the far end of the ladder.", add: ["S2", "S1", "S0"], fix: [lowerBolts(-1, [2, 1, 0])], tools: ["allen"] },
    { title: "Bolt on the other side ladder", detail: "Lower it onto the shelves and drive in eight bolts.", add: ["R"], fix: [lowerBolts(1, [0, 1, 2, 3])], tools: ["allen"], check: "square" },
    {
      title: "Put the upper section together",
      detail: "The short ladders and the three narrow shelves, two bolts at each shelf end.",
      add: ["UL", "U0", "U1", "U2", "UR"],
      fix: [upperBolts(-1), upperBolts(1)],
      tools: ["allen"],
    },
    {
      title: "Bolt the upper section on",
      detail: "It sits on the top shelf of the lower section at the back. One bolt up through the shelf into each short ladder.",
      fix: [{ ...BOLT, count: 2, on: "S3", at: [-1, 1].map((g) => pt(g * ux, sb, uz)), dir: [0, 1, 0] }],
      tools: ["allen"],
    },
    { title: "Stand it up", detail: "Lift it with a helper onto its feet, close to the wall.", pose: "+y", people: 2 },
    {
      title: "Fix it to the wall",
      detail: "Mark the underside of the lower top shelf on the wall, screw the strap to the wall 30 mm below, then screw the strap up into the shelf. Wall screws and plugs aren't included.",
      fix: [
        { kind: "strap", count: 1, on: "S3", at: [pt(0, sb, -D / 2 + 25)], dir: [0, 1, 0] },
        { kind: "screw", count: 1, len: 16, dia: 4, included: true, on: "S3", at: [pt(0, sb, -D / 2 + 30)], dir: [0, 1, 0] },
        { kind: "plug", count: 1, at: [pt(0, sb - 30, -D / 2 - 20)], dir: [0, 0, -1] },
        { ...W_SCREW, count: 1, at: [pt(0, sb - 30, -D / 2 - 4)], dir: [0, 0, -1] },
      ],
      tools: ["screwdriver", "drill", "pencil", "tape"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- trolley */

function trolley(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 420, H = Math.round(s.size.h * 10) || 760, D = Math.round(s.size.d * 10) || 330;
  const P = 30, CH = 60, ST = 15, RH = 35;
  const px = W / 2 - P / 2, pz = D / 2 - P / 2, iw = W - 2 * P;
  const postH = H - CH;
  const tops = [CH + 70, CH + 330, H - 120]; // shelves, bottom up
  const ry = (i: number) => tops[i] - ST - RH / 2; // shelf rails and the frame's rails behind them
  const topBar = H - 20;
  const frame: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [P, postH, P], pos: [g * px, 0, 0] })),
    ...[...tops.map((_, i) => ry(i)), topBar].map((y): PartPiece => ({ shape: "box", size: [iw, 30, 20], pos: [0, y - CH - postH / 2, 0] })),
  ];
  const sd = 2 * pz - P; // shelves between the frames
  const parts: CustomPart[] = [
    { id: "F", name: "Front frame", size: [W, postH, P], pos: [0, CH + postH / 2, pz], material: "wood", pieces: frame },
    ...tops.map((t, i): CustomPart => ({ id: `S${i}`, name: "Slatted shelf", size: [iw, ST + RH, sd], pos: [0, t - (ST + RH) / 2, 0], material: "wood", pieces: slatted(iw, sd, ST, RH, 14) })),
    ...[-1, 1].map((g, i): CustomPart => ({ id: `T${i}`, name: "Top bar", size: [P, 30, sd], pos: [g * px, topBar, 0], material: "wood" })),
    { id: "B", name: "Back frame", size: [W, postH, P], pos: [0, CH + postH / 2, -pz], material: "wood", pieces: frame },
  ];
  const zf = D / 2;
  const shelfBolts = (g: number): CustomFix => ({
    ...SHORT,
    name: "Allen bolt",
    count: 6,
    on: g > 0 ? "F" : "B",
    at: tops.flatMap((_, i) => [-1, 1].map((x) => pt(x * (iw / 2 - 50), ry(i), g * zf))),
    dir: [0, 0, -g],
  });
  const barBolts = (g: number): CustomFix => ({ ...SHORT, name: "Allen bolt", count: 2, on: g > 0 ? "F" : "B", at: [-1, 1].map((x) => pt(x * px, topBar, g * zf)), dir: [0, 0, -g] });
  const corners = [-1, 1].flatMap((x) => [-1, 1].map((z) => [x * px, z * pz] as const));
  const steps: CustomStep[] = [
    {
      title: "Bolt the shelves to the front frame",
      detail: "Lay the front frame flat on a rug, castor end towards you. Stand the three shelves on it and drive two bolts through the frame into each.",
      add: ["F", "S0", "S1", "S2"],
      fix: [shelfBolts(1)],
      tools: ["allen"],
      pose: "-z",
      warnings: ["floor"],
    },
    { title: "Bolt on the two top bars", detail: "One at each end of the top, a bolt through each post.", add: ["T0", "T1"], fix: [barBolts(1)], tools: ["allen"] },
    { title: "Bolt on the back frame", detail: "Lower it onto the shelves and bars, then eight more bolts.", add: ["B"], fix: [shelfBolts(-1), barBolts(-1)], tools: ["allen"] },
    {
      title: "Screw on the castors",
      detail: "One under each post, four screws each, in the order shown on the plate.",
      fix: [
        // its pin sits up in the post end, which keeps it clear of the four plate screws
        { kind: "castor", count: 4, len: CH + 14, dia: 50, at: corners.map(([x, z]) => pt(x, CH + 14, z)), dir: [0, 1, 0] },
        { kind: "screw", count: 16, len: 16, dia: 4, at: corners.flatMap(([x, z]) => [-1, 1].flatMap((a) => [-1, 1].map((b) => pt(x + a * 11.5, CH - 2, z + b * 11.5)))), dir: [0, 1, 0] },
      ],
      tools: ["screwdriver"],
    },
    { title: "Stand it up", detail: "Check every bolt is tight before you load it.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["RÅGRUND", "RAGRUND"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^ragrund-bench/.test(slug)) return bench(s);
    if (slug === "ragrund-shelving-unit-33") return tower(s);
    if (/^ragrund-shelving-unit/.test(slug)) return shelving(s);
    if (/^ragrund-trolley/.test(slug)) return trolley(s);
    return null;
  },
};
export default family;
