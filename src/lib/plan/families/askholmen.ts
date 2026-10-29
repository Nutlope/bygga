import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ASKHOLMEN, read from IKEA's manuals for the chair with armrests and the 143x75 table (solid acacia).
 *
 * Chair: the slatted seat gets a dowel in the front end of each side rail, the back frame is bolted on with two
 * barrel nuts, then each armrest (its front leg fixed under it) goes onto the dowel and is bolted to the back leg
 * through a washer into a sleeve nut; last, two more barrel nuts and bolts fix the front legs to the seat.
 * Table: built upside down on a rug. The two leg frames are bolted to the top's edge rails (long bolt, washer and
 * sleeve nut at each of four joints), two braces run from the top's middle rail to the frames' lower rails, screwed
 * at the top and bolted into barrel nuts at the foot, then two people turn it over.
 * The folding chair and the small folding table are sold assembled and have no manual: their guides only unfold
 * them (and tie the chair's cushion on).
 */

const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];

/* ---------------------------------------------------------------- chair with armrests */

function chairRecipe(): CustomParams {
  const SX = 235; // seat rails, inner face of the legs
  const LX = 255; // leg centres
  const AX = 267; // armrests
  const SY0 = 340, SY1 = 410; // seat frame, 41 cm seat height
  const SZ0 = -205, SZ1 = 230;
  const tilt = -0.12; // the backrest leans back
  const backLegs: PartPiece[] = [-1, 1].flatMap((g): PartPiece[] => [
    { shape: "box", size: [40, 410, 45], pos: [g * LX, 205, -225] },
    { shape: "box", size: [40, 430, 40], pos: [g * LX, 610, -250], rot: [tilt, 0, 0] },
  ]);
  const slats = [600, 690, 780].map((y): PartPiece => ({ shape: "box", size: [2 * SX, 65, 20], pos: [0, y, -250 + (y - 610) * Math.sin(tilt)], rot: [tilt, 0, 0] }));
  // the back frame's pieces, about the middle of its bounding box
  const bc: Vec3 = [0, 410, -260];
  const rel = (p: PartPiece): PartPiece => ({ ...p, pos: [p.pos[0] - bc[0], p.pos[1] - bc[1], p.pos[2] - bc[2]] });
  const seatSlats = Array.from({ length: 7 }, (_, i): PartPiece => ({ shape: "box", size: [2 * SX, 18, 50], pos: [0, (SY1 - 9) - (SY0 + SY1) / 2, SZ0 + 30 + (i * (SZ1 - SZ0 - 60)) / 6 - (SZ0 + SZ1) / 2] }));
  const seatRails: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [24, SY1 - SY0 - 18, SZ1 - SZ0], pos: [g * (SX - 12), -9, 0] })),
    { shape: "box", size: [2 * SX - 48, SY1 - SY0 - 18, 24], pos: [0, -9, (SZ1 - SZ0) / 2 - 12] },
  ];
  const arm = (g: number): PartPiece[] => [
    { shape: "box", size: [55, 28, 490], pos: [g * (AX - LX), 655 - 335, 0] },
    { shape: "box", size: [42, 641, 45], pos: [0, 320.5 - 335, 230 - 15] },
  ];
  const parts: CustomPart[] = [
    { id: "S", name: "Seat", size: [2 * SX, SY1 - SY0, SZ1 - SZ0], pos: [0, (SY0 + SY1) / 2, (SZ0 + SZ1) / 2], pieces: [...seatRails, ...seatSlats], material: "wood" },
    { id: "B", name: "Back frame", size: [2 * LX + 40, 820, 120], pos: bc, pieces: [...backLegs, ...slats].map(rel), material: "wood" },
    ...[-1, 1].map((g, i): CustomPart => ({ id: `A${i}`, name: "Armrest with front leg", size: [80, 670, 490], pos: [g * LX, 335, 15], pieces: arm(g), material: "wood" })),
  ];
  const yB = (SY0 + SY1) / 2 - 8;
  const steps: CustomStep[] = [
    {
      title: "Tap a dowel into the front of each seat rail",
      detail: "Lay the seat upside down on a rug. One dowel in the end of each side rail at the front.",
      add: ["S"],
      fix: [{ kind: "dowel", count: 2, len: 30, dia: 8, on: "S", at: [-1, 1].map((g) => pt(g * (SX - 12), yB, SZ1)), dir: [0, 0, 1] }],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the back frame to the seat",
      detail: "A barrel nut in each side rail with its slot facing the bolt, then a long bolt through each back leg. Tighten with the Allen key.",
      add: ["B"],
      fix: [
        { kind: "nut", name: "Barrel nut", count: 2, len: 14, dia: 10, on: "S", at: [-1, 1].map((g) => pt(g * (SX - 12), yB, SZ0 + 30)), dir: [0, -1, 0] },
        ...[-1, 1].map((g): CustomFix => ({ kind: "bolt", count: 1, len: 70, dia: 6, on: "B", at: [pt(g * (LX + 20), yB, SZ0 + 30)], dir: [-g, 0, 0] })),
      ],
      tools: ["flathead", "allen"],
      from: { B: [0, 0, -300] },
    },
    {
      title: "Fit the armrests and bolt them to the back legs",
      detail: "Push each front leg onto its seat dowel, then a long bolt through the back of the armrest with a washer between it and the leg, into a sleeve nut from outside the leg.",
      add: ["A0", "A1"],
      fix: [
        ...[0, 1].map((i): CustomFix => ({ kind: "washer", count: 1, len: 2, dia: 18, on: `A${i}`, at: [pt((i ? 1 : -1) * (AX + 28), 655, -215)], dir: [i ? -1 : 1, 0, 0] })),
        ...[0, 1].map((i): CustomFix => ({ kind: "bolt", count: 1, len: 70, dia: 6, on: `A${i}`, at: [pt((i ? 1 : -1) * (AX + 30), 655, -215)], dir: [i ? -1 : 1, 0, 0], mate: "B" })),
        ...[0, 1].map((i): CustomFix => ({ kind: "nut", name: "Sleeve nut", count: 1, len: 20, dia: 10, on: "B", at: [pt((i ? 1 : -1) * (LX - 20), 655, -215)], dir: [i ? 1 : -1, 0, 0] })),
      ],
      tools: ["allen"],
    },
    {
      title: "Bolt the front legs to the seat",
      detail: "A barrel nut in the front of each seat rail, then a long bolt through each front leg. Tighten every bolt once more.",
      fix: [
        { kind: "nut", name: "Barrel nut", count: 2, len: 14, dia: 10, on: "S", at: [-1, 1].map((g) => pt(g * (SX - 12), yB, SZ1 - 30)), dir: [0, -1, 0] },
        ...[0, 1].map((i): CustomFix => ({ kind: "bolt", count: 1, len: 70, dia: 6, on: `A${i}`, at: [pt((i ? 1 : -1) * (LX + 21), yB, SZ1 - 30)], dir: [i ? -1 : 1, 0, 0] })),
      ],
      tools: ["flathead", "allen"],
    },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- table */

function tableRecipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 1430, D = Math.round(s.size.d * 10) || 750, H = 730;
  const TT = 22, RH = 50;
  const ty = H - TT / 2;
  const n = Math.round(W / 70);
  const slatW = (W - (n - 1) * 8) / n;
  const topPieces: PartPiece[] = [
    ...Array.from({ length: n }, (_, i): PartPiece => ({ shape: "box", size: [slatW, TT, D], pos: [-W / 2 + slatW / 2 + i * (slatW + 8), 0, 0] })),
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [W - 40, RH, 30], pos: [0, -TT / 2 - RH / 2, g * (D / 2 - 45)] })),
    { shape: "box", size: [W - 260, 40, 40], pos: [0, -TT / 2 - 20, 0] },
  ];
  const topY = (H - TT - RH + H) / 2; // centre of the top with its rails
  const topRel = topPieces.map((p): PartPiece => ({ ...p, pos: [p.pos[0], p.pos[1] + ty - topY, p.pos[2]] }));
  const LX = W / 2 - 160; // leg frames, set in from the ends
  const LZ = D / 2 - 90;
  const legH = H - TT;
  const frame: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [50, legH, 50], pos: [0, 0, g * LZ] })),
    { shape: "box", size: [45, 70, 2 * LZ - 50], pos: [0, legH / 2 - 35, 0] },
    { shape: "box", size: [40, 50, 2 * LZ - 50], pos: [0, 180 - legH / 2, 0] },
  ];
  // the braces run from the top's middle rail down to each frame's lower rail
  const bx0 = 300, by0 = H - TT - 40, bx1 = LX - 25, by1 = 185;
  const brace = (g: number): CustomPart => {
    const dx = bx1 - bx0, dy = by0 - by1;
    const len = Math.hypot(dx, dy);
    return { id: `X${g < 0 ? 0 : 1}`, name: "Brace", size: [len, 40, 36], pos: [g * (bx0 + bx1) / 2, (by0 + by1) / 2, 0], rot: [0, 0, -g * Math.atan2(dy, dx)], material: "wood" };
  };
  const parts: CustomPart[] = [
    { id: "T", name: "Table top", size: [W, TT + RH, D], pos: [0, topY, 0], pieces: topRel, material: "wood" },
    ...[-1, 1].map((g, i): CustomPart => ({ id: `F${i}`, name: "Leg frame", size: [50, legH, 2 * LZ + 50], pos: [g * LX, legH / 2, 0], pieces: frame, material: "wood" })),
    brace(-1),
    brace(1),
  ];
  const jy = H - TT - RH / 2;
  const steps: CustomStep[] = [
    { title: "Lay the top upside down on a rug", detail: "Slats down, rails up, on something soft so the surface doesn't get scratched.", add: ["T"], pose: "-y", warnings: ["floor"] },
    { title: "Stand the two leg frames on the top", detail: "Legs pointing up, each frame between the edge rails near an end.", add: ["F0", "F1"] },
    {
      title: "Bolt the leg frames to the edge rails",
      detail: "At each of the four joints: a long bolt with a washer through the edge rail into the frame, and a sleeve nut from the other side. One Allen key holds the nut while the other turns the bolt.",
      fix: [
        ...[-1, 1].map((gz): CustomFix => ({ kind: "washer", count: 2, len: 2, dia: 18, at: [-1, 1].map((gx) => pt(gx * LX, jy, gz * (D / 2 - 30))), dir: [0, 0, -gz] })),
        ...[-1, 1].map((gz): CustomFix => ({ kind: "bolt", count: 2, len: 100, dia: 6, at: [-1, 1].map((gx) => pt(gx * LX, jy, gz * (D / 2 - 30))), dir: [0, 0, -gz] })),
        { kind: "nut", name: "Sleeve nut", count: 4, len: 20, dia: 10, at: [-1, 1].flatMap((gx) => [-1, 1].map((gz) => pt(gx * LX, jy, gz * 60))), dir: [0, 0, 1] },
      ],
      tools: ["allen"],
    },
    { title: "Lay the two braces in", detail: "The angled end on the middle rail, the other end against the frame's lower rail.", add: ["X0", "X1"] },
    {
      title: "Screw the braces to the middle rail",
      detail: "One screw through the top end of each brace.",
      fix: [{ kind: "screw", count: 2, len: 60, dia: 6, at: [-1, 1].map((g) => pt(g * (bx0 + 15), by0 - 30, 0)), dir: [0, 1, 0] }],
      tools: ["allen"],
    },
    {
      title: "Bolt the braces to the leg frames",
      detail: "A barrel nut in the foot of each brace, slot facing the bolt, then a bolt through the frame's lower rail into it.",
      fix: [
        { kind: "nut", name: "Barrel nut", count: 2, len: 14, dia: 10, at: [-1, 1].map((g) => pt(g * (bx1 - 40), by1 + 20, 0)), dir: [0, 0, -1] },
        ...[-1, 1].map((g): CustomFix => ({ kind: "bolt", count: 1, len: 60, dia: 6, at: [pt(g * (LX + 20), by1 + 10, 0)], dir: [-g, 0, 0] })),
      ],
      tools: ["flathead", "allen"],
    },
    { title: "Turn the table over", detail: "Lift it together by the frames, not the top, and stand it on all four legs.", pose: "+y", people: 2, kind: "standup" },
  ];
  return { parts, steps };
}


/* ---------------------------------------------------------------- sold folded: the chair and the 60x62 table */

/** A wooden bar from a to b (mm, relative to the part's middle), leaning front to back or lying along x. */
function bar(a: Vec3, b: Vec3, t: Vec3 = [40, 40, 22]): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  if (Math.abs(d[0]) > Math.abs(d[1]) && Math.abs(d[0]) > Math.abs(d[2])) return { shape: "box", size: [len, t[1], t[2]], pos: mid };
  return { shape: "box", size: [t[0], len, t[2]], pos: mid, rot: [Math.atan2(d[2], d[1]), 0, 0] };
}
const shift = (ps: PartPiece[], c: Vec3): PartPiece[] => ps.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));

/** The folding chair: a long frame from the front feet up into the slatted back, a rear leg frame and the seat. */
function foldingChair(s: ProductSpec): CustomParams {
  // IKEA: 36 wide, 49 deep, 87 high
  const W = Math.round(s.size.w * 10) || 360, H = Math.round(s.size.h * 10) || 870, D = Math.round(s.size.d * 10) || 490;
  const ys = 450, xo = W / 2 - 20, xi = xo - 40;
  const zf = D / 2 - 30, zb = -D / 2 + 30;
  const top: Vec3 = [0, H - 10, -D / 2 + 60];
  const main: PartPiece[] = [
    ...[-1, 1].map((g) => bar([g * xo, 0, zf], [g * xo, top[1], top[2]])),
    bar([-xo, 90, zf - 12], [xo, 90, zf - 12], [40, 50, 20]),
    ...[0, 1, 2].map((k): PartPiece => {
      const y = H - 60 - k * 85, z = zf + ((top[2] - zf) * y) / top[1] - 12;
      return { shape: "box", size: [2 * xo - 40, 60, 16], pos: [0, y, z], rot: [Math.atan2(top[2] - zf, top[1]), 0, 0] };
    }),
  ];
  const rear: PartPiece[] = [...[-1, 1].map((g) => bar([g * xi, ys - 30, zf - 50], [g * xi, 0, zb])), bar([-xi, 110, zb + 30], [xi, 110, zb + 30], [40, 50, 20])];
  const seat: PartPiece[] = Array.from({ length: 8 }, (_, k): PartPiece => ({ shape: "box", size: [2 * xi + 20, 18, 34], pos: [0, ys - 9, -D / 2 + 90 + k * 42] }));
  const cF: Vec3 = [0, H / 2, 0], cR: Vec3 = [0, ys / 2, 0], cS: Vec3 = [0, ys - 9, 0];
  const parts: CustomPart[] = [
    { id: "F", name: "Front legs with backrest", size: [W, H, D], pos: cF, pieces: shift(main, cF), material: "wood" },
    { id: "R", name: "Back legs", size: [2 * xi + 40, ys, D], pos: cR, pieces: shift(rear, cR), material: "wood" },
    { id: "S", name: "Seat", size: [2 * xi + 20, 18, 340], pos: cS, pieces: shift(seat, cS), material: "wood" },
    { id: "C", name: "Chair cushion", size: [W - 20, 60, 350], pos: [0, ys + 30, 0], material: "soft" },
  ];
  const steps: CustomStep[] = [
    { title: "Stand the folded chair on its front feet", detail: "It comes assembled, with nothing to screw together. Hold it by the top of the back.", add: ["F"] },
    { title: "Swing the back legs out", detail: "Pull them back until all four feet stand on the floor.", add: ["R"], from: { R: [0, 0, 280] }, warnings: ["hand"] },
    { title: "Press the seat down", detail: "Push it down flat until it rests on the frame. To fold the chair, lift the front of the seat; keep your fingers clear of the joints.", add: ["S"], from: { S: [0, 300, 120] }, warnings: ["hand"] },
    { title: "Tie the cushion on", detail: "Lay it on the seat and tie its strings round the back legs so it stays put.", add: ["C"], from: { C: [0, 250, 0] } },
  ];
  return { parts, steps };
}

/** The small folding table: the top with one leg frame fixed under it, and a second frame that swings out across it. */
function foldingTable(s: ProductSpec): CustomParams {
  // IKEA: 60 wide, 62 deep, 73 high
  const W = Math.round(s.size.w * 10) || 600, D = Math.round(s.size.d * 10) || 620, H = Math.round(s.size.h * 10) || 730;
  const tt = 20, n = 9;
  const yu = H - tt - 30; // the legs' top ends, on the cleats under the top
  const xo = W / 2 - 60, xi = xo - 42;
  const sw = (D - (n - 1) * 8) / n;
  const top: PartPiece[] = [
    ...Array.from({ length: n }, (_, i): PartPiece => ({ shape: "box", size: [W, tt, sw], pos: [0, H - tt / 2, -D / 2 + sw / 2 + i * (sw + 8)] })),
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [30, 40, D - 80], pos: [g * (xo + 35), H - tt - 20, 0] })),
  ];
  // the fixed frame leans one way, the swinging one the other: they cross in an X seen from the side
  const frame = (x: number, lean: number): PartPiece[] => {
    const a: Vec3 = [0, yu, lean * (D / 2 - 60)], f: Vec3 = [0, 0, -lean * (D / 2 - 30)];
    const at = (k: number): [number, number] => [a[1] + (f[1] - a[1]) * k, a[2] + (f[2] - a[2]) * k];
    return [
      ...[-1, 1].map((g) => bar([g * x, a[1], a[2]], [g * x, f[1], f[2]])),
      bar([-x, at(0.2)[0], at(0.2)[1]], [x, at(0.2)[0], at(0.2)[1]], [40, 60, 20]),
      bar([-x, at(0.85)[0], at(0.85)[1]], [x, at(0.85)[0], at(0.85)[1]], [40, 60, 20]),
    ];
  };
  const cT: Vec3 = [0, H / 2, 0], cL: Vec3 = [0, yu / 2, 0];
  const parts: CustomPart[] = [
    { id: "T", name: "Top with outer legs", size: [W, H, D], pos: cT, pieces: shift([...top, ...frame(xo, 1)], cT), material: "wood" },
    { id: "L", name: "Inner leg frame", size: [2 * xi + 40, yu, D], pos: cL, pieces: shift(frame(xi, -1), cL), material: "wood" },
  ];
  const steps: CustomStep[] = [
    { title: "Stand the folded table on its outer legs", detail: "It comes assembled, with no fittings: the inner legs lie folded under the top.", add: ["T"] },
    { title: "Swing the inner legs out", detail: "Pull them away from the outer legs until both pairs stand on the floor.", add: ["L"], from: { L: [0, 150, -300] }, warnings: ["hand"] },
    { title: "Check the top lies level", detail: "Its ends rest on the inner legs. To fold it, lift the top at that end and keep your fingers clear of the joints." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["ASKHOLMEN"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (slug === "askholmen-chair-outdoor") return foldingChair(s);
    if (slug === "askholmen-table-outdoor-60-x-62") return foldingTable(s);
    if (s.archetype === "seat" && s.seat?.arms) return chairRecipe();
    if (s.archetype === "table" && s.size.w > 100) return tableRecipe(s);
    return null;
  },
};
export default family;
