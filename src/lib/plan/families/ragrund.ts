import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * RÅGRUND (bamboo bathroom range), read from its three manuals. Everything is held with Allen bolts.
 * Bench: built upside down on a rug. The front and back rails are bolted to the top from below, the two leg
 * frames stand on it with one bolt each, then long bolts go through the legs into the rails' ends, and the
 * slatted shelf goes in between the legs on four more long bolts.
 * Shelving unit: lying on its back, the four shelves stand on one ready-made side ladder with two bolts at each
 * end, the other ladder goes on top the same way, and stood up a bracket under the top shelf holds it to the wall.
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
    if (/^ragrund-shelving-unit/.test(slug)) return shelving(s);
    if (/^ragrund-trolley/.test(slug)) return trolley(s);
    return null;
  },
};
export default family;
