import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * NORDVIKEN, read from its manuals. All of it is solid wood joined with dowels and bolts.
 *   Chair and bar stool: the two side frames come made. One lies on its side, the curved back rail, the slats and
 *   the front rail are pressed into it on dowels, the other side frame goes on top, then it stands up and is bolted
 *   through the legs (long bolts at the seat, short ones at the top slat). Upside down on the seat, four screws
 *   through the corner brackets hold the seat.
 *   Tables (extendable, bar, drop-leaf): the apron frame is built first and the top, face down on a rug, goes under
 *   it. Each leg gets a barrel nut and two threaded rods, goes into a steel corner bracket and is held with washers
 *   and nuts tightened with the box spanner. The extendable and the bar table then get a lower rail between each pair
 *   of legs (cam locks) and a long stretcher bolted across; the drop-leaf only its four legs and glides.
 */

const R2 = Math.SQRT1_2;
const SIDES = [-1, 1] as const;
type Fx = Partial<CustomFix>;

const P = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}): CustomPart => ({ id, name, size, pos, material: "wood", ...o });
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Fx = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const auto = (kind: HwKind, count: number, o: Fx = {}): CustomFix => ({ kind, count, ...o });
const spread = (a: number, b: number, n: number) => (n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));
const near = (pts: Vec3[], d: Vec3) => pts.map((p): Vec3 => [p[0] + d[0], p[1] + d[1], p[2] + d[2]]);
const pairs = (pts: Vec3[], axis: 0 | 2, gap: number) => pts.flatMap((p) => [-1, 1].map((k): Vec3 => (axis === 0 ? [p[0] + (k * gap) / 2, p[1], p[2]] : [p[0], p[1], p[2] + (k * gap) / 2])));

/* ---------- chair and bar stool ---------- */

const LG = 40; // leg section
const TILT = 0.1; // the back legs lean back above the seat

function chair(s: ProductSpec): CustomParams {
  const stool = /stool/i.test(s.variant);
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = stool ? 880 : s.size.h * 10; // IKEA gives the bar stool as 88 cm high
  const SH = (s.seat?.seatH ?? (stool ? 62 : 45)) * 10;
  const seatT = 30, yS = SH - seatT;
  const railH = 60, yR = yS - railH / 2;
  const Lu = H - SH;
  const xL = W / 2 - LG / 2;
  const zf = D / 2 - LG / 2;
  const zb = -D / 2 + LG / 2 + Lu * Math.sin(TILT);
  const zAt = (y: number) => zb - Math.max(0, y - SH) * Math.tan(TILT);
  const yX = stool ? 230 : 150; // the side stretcher
  const yFoot = 280; // the bar stool's footrest
  const len = zf - zb - LG;
  const upY = SH + Lu / 2 - 8;
  const pieces: PartPiece[] = [
    { shape: "box", size: [LG, yS, LG], pos: [0, yS / 2 - H / 2, zf] },
    { shape: "box", size: [LG, SH, LG], pos: [0, SH / 2 - H / 2, zb] },
    { shape: "box", size: [LG, Lu + 16, LG], pos: [0, upY - H / 2, zAt(upY)], rot: [-TILT, 0, 0] },
    { shape: "box", size: [22, railH, len], pos: [0, yR - H / 2, (zf + zb) / 2] },
    { shape: "box", size: [22, 40, len], pos: [0, yX - H / 2, (zf + zb) / 2] },
  ];
  const Lr = W - 2 * LG;
  const slatH = stool ? 100 : 70;
  const slatY = stool ? [H - 60] : [H - 50 - 270, H - 50 - 135, H - 50];
  const slatIds = slatY.map((_, i) => `S${i}`);
  const parts: CustomPart[] = [
    P("L", "Side frame", [LG, H, D], [-xL, H / 2, 0], { pieces }),
    P("BR", "Back rail", [Lr, railH, 22], [0, yR, zb]),
    ...slatY.map((y, i) => P(slatIds[i], "Back slat", [Lr, slatH, 18], [0, y, zAt(y)], { rot: [-TILT, 0, 0] })),
    P("FR", "Front rail", [Lr, railH, 22], [0, yR, zf]),
    ...(stool ? [P("FT", "Footrest", [Lr, 40, 30], [0, yFoot, zf])] : []),
    P("R", "Side frame", [LG, H, D], [xL, H / 2, 0], { pieces }),
    P("SEAT", "Seat", [W, seatT, D / 2 - zb - LG / 2], [0, SH - seatT / 2, (D / 2 + zb + LG / 2) / 2]),
  ];
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  // two seat brackets in each side frame's seat rail, at the corners under the seat
  const bz = [zf - LG / 2 - 40, zb + LG / 2 + 40];
  const brackets = (sx: number) => fx("clip", bz.map((z): Vec3 => [sx * (xL - 11), yS - 14, z]), [sx, 0, 0], { on: side(sx), name: "Seat bracket", len: 24, dia: 30 });
  // dowels sit in the ends of each rail or slat; their other ends go into the side frames
  const dowelsIn = (id: string, y: number, z: number, dy: number[], o: Fx = {}): CustomFix[] =>
    SIDES.map((sx) => fx("dowel", dy.map((d): Vec3 => [sx * (xL - LG / 2), y + d, z]), [-sx, 0, 0], { on: id, len: 40, dia: 8, ...o }));
  const bolts = (sx: number) => [...[zf, zb].map((z): Vec3 => [sx * (W / 2), yR, z]), ...(stool ? [[sx * (W / 2), yFoot, zf] as Vec3] : [])];
  const yTop = slatY[slatY.length - 1];
  const steps: CustomStep[] = [
    {
      title: "Press the seat brackets into a side frame",
      detail: "Lay one side frame on a rug, inside up. Push a bracket into each end of its seat rail, stud first.",
      add: ["L"],
      fix: [brackets(-1)],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Fit the curved back rail",
      detail: "A thick dowel and a thin one in each end. Press it into the back leg at seat height, curve towards the back.",
      add: ["BR"],
      fix: [...dowelsIn("BR", yR, zb, [14], { dia: 10, name: "Thick dowel" }), ...dowelsIn("BR", yR, zb, [-14])],
    },
    {
      title: stool ? "Press in the top slat and the front rails" : "Press in the back slats and the front rail",
      detail: stool
        ? "Two dowels in each end of the slat and of the seat rail. Press them into the frame by hand; the footrest just sits in its holes for now."
        : "Two dowels in each end of every slat and of the front rail. Press them into the frame by hand, no hammer.",
      add: [...slatIds, "FR", ...(stool ? ["FT"] : [])],
      fix: [...slatIds.flatMap((id, i) => dowelsIn(id, slatY[i], zAt(slatY[i]), [-slatH / 2 + 18, slatH / 2 - 18])), ...dowelsIn("FR", yR, zf, [-16, 16])],
    },
    {
      title: "Lay the other side frame on top",
      detail: "Press its two seat brackets in first. Line every dowel up with its hole, then press the frame down evenly.",
      add: ["R"],
      fix: [brackets(1)],
    },
    {
      title: "Stand it up and bolt the seat rails",
      detail: `Use the long bolts here, ${stool ? "three" : "two"} through each side frame, and tighten them with the Allen key.`,
      fix: SIDES.map((sx) => fx("bolt", bolts(sx), [-sx, 0, 0], { on: side(sx), len: 110, dia: 6, name: "Long bolt" })),
      pose: "+y",
      tools: ["allen"],
    },
    {
      title: "Bolt the top slat",
      detail: "The two short bolts go through the back legs into the top slat.",
      fix: SIDES.map((sx) => fx("bolt", [[sx * (W / 2), yTop, zAt(yTop)]], [-sx, 0, 0], { on: side(sx), len: 70, dia: 6, name: "Short bolt" })),
      tools: ["allen"],
    },
    {
      title: `Lower the ${stool ? "stool" : "chair"} over the seat`,
      detail: `Lay the seat face down on a rug and set the ${stool ? "stool" : "chair"} upside down over it, so the seat drops in between the legs.`,
      add: ["SEAT"],
      pose: "-y",
      warnings: ["floor"],
      from: { SEAT: [0, 280, 0] },
    },
    {
      title: "Screw the seat to the brackets",
      detail: "One screw through each corner bracket into the seat.",
      fix: [fx("screw", SIDES.flatMap((sx) => bz.map((z): Vec3 => [sx * (xL - 30), yS - 6, z])), [0, 1, 0], { len: 20, dia: 4, mate: "SEAT" })],
      tools: ["screwdriver"],
    },
    { title: "Turn it upright", detail: "Check the bolts again after a week of use and tighten them if needed.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- the tables' shared leg joint ---------- */

interface LegFrame {
  H: number;
  T: number; // top
  A: number; // apron height
  L: number; // leg section
  xe: number; // end apron centre, from the middle
  ze: number; // inside face of the long side aprons, from the middle
}

const legId = (gx: number, gz: number) => `LG${gx < 0 ? "L" : "R"}${gz < 0 ? "B" : "F"}`;
const legX = (f: LegFrame) => f.xe - 10 - f.L / 2;
const legZ = (f: LegFrame) => f.ze - f.L / 2;

function legParts(f: LegFrame): CustomPart[] {
  return SIDES.flatMap((gx) => SIDES.map((gz) => P(legId(gx, gz), "Leg", [f.L, f.H - f.T, f.L], [gx * legX(f), (f.H - f.T) / 2, gz * legZ(f)])));
}

/** A steel bracket across each inside corner of the apron frame, screwed to the end apron. */
function cornerBrackets(f: LegFrame, gx: number, screws: number): CustomFix[] {
  const y = f.H - f.T - f.A / 2;
  // on the end apron's inside face, just in from the leg, its arm reaching across the corner
  const pts = SIDES.map((gz): Vec3 => [gx * (f.xe - 10), y, gz * (legZ(f) - f.L / 2 - 20)]);
  const per = screws / 2;
  return [
    fx("angle", pts, [gx, 0, 0], { on: `E${gx}`, name: "Corner bracket", len: 50, dia: 50 }),
    fx("screw", pts.flatMap((p) => spread(-20, 20, per).map((dy): Vec3 => [p[0], p[1] + dy, p[2] - Math.sign(p[2]) * 12])), [gx, 0, 0], { on: `E${gx}`, len: 16, dia: 4 }),
  ];
}

/** A barrel nut in the top of each leg, two threaded rods through its inside corner, then a washer and a nut on each. */
function legFix(f: LegFrame, gx: number, gzs: readonly number[] = SIDES, part: "all" | "rods" | "nuts" = "all"): CustomFix[] {
  const ys = [f.H - f.T - f.A / 2 + 18, f.H - f.T - f.A / 2 - 18];
  const out: CustomFix[] = [];
  for (const gz of gzs) {
    const id = legId(gx, gz);
    const x = gx * legX(f), z = gz * legZ(f);
    const corner = (d: number) => ys.map((y): Vec3 => [x - gx * (f.L / 2 + d * R2), y, z - gz * (f.L / 2 + d * R2)]);
    const dir: Vec3 = [gx * R2, 0, gz * R2];
    if (part !== "nuts")
      out.push(
        fx("connector", [[x, f.H - f.T, z]], [0, -1, 0], { on: id, name: "Barrel nut", len: 34, dia: 10 }),
        fx("stud", corner(-4), dir, { on: id, name: "Threaded rod", len: 80, dia: 8 }),
      );
    if (part !== "rods")
      out.push(
        fx("washer", corner(24), dir, { on: id, len: 2, dia: 16 }),
        fx("nut", corner(26), dir, { on: id, len: 6, dia: 8 }),
      );
  }
  return out;
}

interface Lower {
  y: number; // lower end rail centre
  h: number;
}

function lowerParts(f: LegFrame, lo: Lower): CustomPart[] {
  const xl = legX(f), zl = legZ(f);
  return [
    ...SIDES.map((gx) => P(`LR${gx}`, "Lower end rail", [40, lo.h, 2 * zl - f.L], [gx * xl, lo.y, 0])),
    P("ST", "Stretcher", [2 * xl + 140, 50, 60], [0, lo.y - lo.h / 2 - 25, 0]),
  ];
}

/** The lower rail between two legs: a short rod and a dowel in each leg, big cam locks in the rail's ends. */
function lowerFix(f: LegFrame, lo: Lower, gx: number, gzs: readonly number[] = SIDES, part: "all" | "rods" | "cams" = "all"): CustomFix[] {
  const xl = gx * legX(f), zl = legZ(f);
  return [
    ...(part === "cams" ? [] : gzs.flatMap((gz) => [
      fx("stud", [[xl, lo.y + 14, gz * (zl - f.L / 2)]], [0, 0, gz], { on: legId(gx, gz), name: "Short threaded rod", len: 40, dia: 8 }),
      fx("dowel", [[xl, lo.y - 16, gz * (zl - f.L / 2)]], [0, 0, gz], { on: legId(gx, gz), len: 40, dia: 8 }),
    ])),
    ...(part === "rods" ? [] : [fx("cam", gzs.map((gz): Vec3 => [xl, lo.y - lo.h / 2, gz * (zl - f.L / 2 - 24)]), [0, 1, 0], { on: `LR${gx}`, name: "Big cam lock", len: 20, dia: 25 })]),
  ];
}

/** Legs into the brackets two at a time (with their lower rail when there is one), the stretcher, the glides. */
function legSteps(f: LegFrame, lo: Lower | null, two: boolean): CustomStep[] {
  const legs = (gx: number) => SIDES.map((gz) => legId(gx, gz));
  const legStep = (gx: number, first: boolean): CustomStep => ({
    title: first ? (lo ? "Bolt the first two legs into the brackets" : "Bolt the legs into the brackets") : "Bolt the other two legs in",
    detail: first
      ? "Press a barrel nut into the top of each leg and screw two long rods through its corner into it. Set the leg in the bracket, put a washer and a nut on each rod and tighten them with the box spanner."
      : "The same way: barrel nut, two rods, into the brackets, washers and nuts tightened with the box spanner.",
    add: legs(gx),
    fix: legFix(f, gx),
    tools: ["wrench"],
    repeat: lo ? undefined : 2,
    from: Object.fromEntries(legs(gx).map((id) => [id, [0, -320, 0] as Vec3])),
  });
  const out: CustomStep[] = [];
  if (!lo) out.push(legStep(-1, true), legStep(1, false));
  else {
    // as the manual does it: every leg gets its rods and dowels first, one leg at each end goes in, the lower rails
    // push onto those along their dowels, then the other two legs push onto the rails' far ends
    const all = SIDES.flatMap((gx) => SIDES.map((gz) => legId(gx, gz)));
    const near = SIDES.map((gx) => legId(gx, -1)), far = SIDES.map((gx) => legId(gx, 1));
    out.push(
      {
        title: "Fit the rods and dowels into the legs",
        detail: "A barrel nut in the top of each leg and two long rods through its corner, then a short rod and a dowel in the side that faces the lower rail.",
        fix: SIDES.flatMap((gx) => [...legFix(f, gx, SIDES, "rods"), ...lowerFix(f, lo, gx, SIDES, "rods")]),
        wait: all,
        from: Object.fromEntries(all.map((id) => [id, [0, -320, 0] as Vec3])),
        tools: ["flathead"],
      },
      {
        title: "Bolt the first two legs into the brackets",
        detail: "One at each end, on the same side. A washer and a nut on each rod, tightened with the box spanner.",
        add: near,
        fix: SIDES.flatMap((gx) => legFix(f, gx, [-1], "nuts")),
        tools: ["wrench"],
        from: Object.fromEntries(near.map((id) => [id, [0, -320, 0] as Vec3])),
      },
      {
        title: "Push the lower rails onto them",
        detail: "Over the short rod and the dowel in each leg, then turn the big cam lock at that end with the Allen key.",
        add: SIDES.map((gx) => `LR${gx}`),
        fix: SIDES.flatMap((gx) => lowerFix(f, lo, gx, [-1], "cams")),
        tools: ["allen"],
        from: Object.fromEntries(SIDES.map((gx) => [`LR${gx}`, [0, 0, 260] as Vec3])),
      },
      {
        title: "Push the other two legs on and bolt them",
        detail: "Onto the far ends of the rails and into the brackets. Washers and nuts on the rods, then turn the other two cam locks.",
        add: far,
        fix: SIDES.flatMap((gx) => [...legFix(f, gx, [1], "nuts"), ...lowerFix(f, lo, gx, [1], "cams")]),
        tools: ["wrench", "allen"],
        from: Object.fromEntries(far.map((id) => [id, [0, 0, 260] as Vec3])),
      },
    );
  }
  if (lo)
    out.push({
      title: "Bolt the stretcher across",
      detail: "Lay it over the two lower rails and fix it with the two long bolts, one into each rail.",
      add: ["ST"],
      fix: [fx("bolt", SIDES.map((gx): Vec3 => [gx * legX(f), lo.y - lo.h / 2 - 50, 0]), [0, 1, 0], { on: "ST", len: 100, dia: 8, name: "Long bolt" })],
      tools: ["allen"],
      people: two ? 2 : 1,
      warnings: two ? ["two"] : [],
      from: { ST: [0, -260, 0] },
    });
  out.push({
    title: "Knock in the floor glides",
    detail: "One into the end of each leg, tapped flat with the hammer.",
    fix: [fx("glide", SIDES.flatMap((gx) => SIDES.map((gz): Vec3 => [gx * legX(f), 0, gz * legZ(f)])), [0, 1, 0], { name: "Floor glide", len: 6, dia: 30 })],
    tools: ["hammer"],
  });
  return out;
}

/** Long screws up through the apron frame into the top (the top lies face down under it). */
const upScrews = (pts: Vec3[], o: Fx = {}) => fx("screw", pts, [0, 1, 0], { len: 100, dia: 5, name: "Long screw", ...o });

/* ---------- extendable table ---------- */

function extendable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const m = /(\d+)\s*\/\s*(\d+)/.exec(s.variant);
  const Ll = m ? ((+m[2] - +m[1]) / 2) * 10 : 355; // one leaf
  const T = 28, A = 90, E = 100, S = 30, Lu = 300;
  const Fd = D - 2 * S;
  const xe = W / 2 - E - 10;
  const xi = W / 2 - E - Lu; // inside face of each cross rail
  const yA = H - T - A / 2, yU = H - T; // apron centre, underside of the top
  const yB = yU - A; // bottom edge of the aprons
  const f: LegFrame = { H, T, A, L: 55, xe, ze: Fd / 2 - 20 };
  const lo: Lower = { y: 170, h: 70 };
  const zr = Math.round(D * 0.26); // the pull-out slides' runners
  const runL = W / 2 - 45 - (xi + 20);
  const ends = SIDES.map((g) => `E${g}`), crosses = SIDES.map((g) => `X${g}`);
  const fside = (g: number) => SIDES.map((sz) => `FS${g}${sz}`);
  const parts: CustomPart[] = [];
  for (const g of SIDES)
    parts.push(
      P(`SE${g}`, "Slide end", [40, 50, 2 * zr + 60], [g * (W / 2 - 25), yU - 25, 0]),
      ...SIDES.map((sz) => P(`SR${g}${sz}`, "Slide runner", [runL, 22, 40], [g * (W / 2 - 45 - runL / 2), yU - 11, sz * zr])),
    );
  for (const g of SIDES)
    parts.push(
      ...SIDES.map((sz) => P(`FS${g}${sz}`, "Frame side", [Lu - 40, A, 20], [g * (W / 2 - E - Lu / 2), yA, sz * (Fd / 2 - 10)])),
      P(`X${g}`, "Cross rail", [20, A, Fd], [g * (xi + 10), yA, 0]),
      ...SIDES.map((sz) => P(`GB${g}${sz}`, "Guide block", [40, 30, 80], [g * (W / 2 - E - Lu / 2), yB + 15, sz * (Fd / 2 - 60)])),
    );
  parts.push(
    ...SIDES.map((sz) => P(`C${sz}`, "Centre rail", [2 * xi, A - 30, 22], [0, yU - 30 - (A - 30) / 2, sz * 11])),
    ...SIDES.map((g) => P(`E${g}`, "End apron", [20, A, Fd], [g * xe, yA, 0])),
    ...SIDES.map((sz) => P(`TP${sz}`, "Table top half", [W, T, D / 2], [0, H - T / 2, (sz * D) / 4])),
    ...SIDES.map((sz) => P(`SP${sz}`, "Side panel", [2 * xi, A - 10, 18], [0, yA, sz * (Fd / 2 - 9)])),
    ...legParts(f),
    ...lowerParts(f, lo),
    ...SIDES.map((g) => P(`LF${g}`, "Extension leaf", [Ll, 20, Fd - 60], [g * (Ll / 2 + 3), yU - 20, 0])),
  );
  const screwPts: Vec3[] = [
    ...SIDES.flatMap((g) => SIDES.flatMap((sz) => spread(W / 2 - E - Lu + 60, W / 2 - E - 60, 2).map((x): Vec3 => [g * x, yB, sz * (Fd / 2 - 10)]))),
    ...SIDES.flatMap((g) => spread(-Fd / 2 + 80, Fd / 2 - 80, 3).map((z): Vec3 => [g * xe, yB, z])),
    ...SIDES.flatMap((g) => [-Fd / 4, Fd / 4].map((z): Vec3 => [g * (xi + 10), yB, z])),
  ];
  const hingeX = [-xi / 2, xi / 2];
  const leafPts = (k: number, y: number) => SIDES.flatMap((g) => SIDES.map((sz): Vec3 => [g * (Ll / 2 + 3), y, (sz * (Fd - 60)) / k]));
  const steps: CustomStep[] = [
    {
      title: "Screw a leaf lock to each slide end",
      detail: "Lay the parts on a rug. The round lock goes in the hole in the middle of the slide end, with two screws.",
      add: SIDES.map((g) => `SE${g}`),
      fix: [
        fx("clip", SIDES.map((g): Vec3 => [g * (W / 2 - 25), yU, 0]), [0, -1, 0], { name: "Leaf lock", len: 12, dia: 36 }),
        fx("screw", SIDES.flatMap((g) => [-26, 26].map((z): Vec3 => [g * (W / 2 - 25), yU, z])), [0, -1, 0], { len: 12, dia: 3.5 }),
      ],
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Screw the runners onto the slide ends",
      detail: "Two runners on each slide end: a dowel and two screws in each joint.",
      add: SIDES.flatMap((g) => SIDES.map((sz) => `SR${g}${sz}`)),
      fix: [
        ...SIDES.map((g) => fx("dowel", SIDES.map((sz): Vec3 => [g * (W / 2 - 45), yU - 11, sz * zr]), [g, 0, 0], { on: `SE${g}`, len: 30, dia: 8 })),
        ...SIDES.map((g) => fx("screw", pairs(SIDES.map((sz): Vec3 => [g * (W / 2 - 5), yU - 11, sz * zr]), 2, 20), [-g, 0, 0], { on: `SE${g}`, len: 40, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the cam bolts into the frame sides",
      detail: "One in the inner end of each short frame side, where it will meet a cross rail.",
      add: SIDES.flatMap(fside),
      fix: SIDES.flatMap((g) => SIDES.map((sz) => fx("camScrew", [[g * (xi + 20), yA, sz * (Fd / 2 - 10)]], [g, 0, 0], { on: `FS${g}${sz}` }))),
      tools: ["screwdriver"],
    },
    {
      title: "Join each pair of frame sides to a cross rail",
      detail: "Two dowels at each joint, then a cam lock in the cross rail, turned clockwise.",
      add: crosses,
      fix: [auto("dowel", 8, { len: 30, dia: 8 }), auto("cam", 4)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the guide blocks inside the frames",
      detail: "One block against each frame side, two long screws each.",
      add: SIDES.flatMap((g) => SIDES.map((sz) => `GB${g}${sz}`)),
      fix: [auto("screw", 8, { len: 50, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Press the centre rails into the frames",
      detail: "Tap a dowel into each end of both rails. Lay them side by side and press them down into the slots in the cross rails.",
      add: SIDES.map((sz) => `C${sz}`),
      // a dowel in each rail end (kept 24 mm apart where the rails meet), pressed down into open slots in the cross rails
      fix: SIDES.flatMap((sz) => SIDES.map((g) => fx("dowel", [[g * xi, yU - 60, sz * 12]], [-g, 0, 0], { on: `C${sz}`, len: 30, dia: 8 }))),
      from: { "C-1": [0, 260, 0], C1: [0, 260, 0] },
    },
    {
      title: "Screw the leaf supports onto the cross rails",
      detail: "One plastic support hooked into each cross rail, held with two screws.",
      fix: SIDES.flatMap((g) => [
        fx("clip", [[g * xi, yU - 30, 60]], [g, 0, 0], { on: `X${g}`, name: "Leaf support", len: 30, dia: 40 }),
        fx("screw", [40, 80].map((z): Vec3 => [g * xi, yU - 50, z]), [g, 0, 0], { on: `X${g}`, len: 16, dia: 3.5 }),
      ]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw a corner bracket into each end of the end aprons",
      detail: "Three screws in each bracket, the short wide ones.",
      add: ends,
      fix: SIDES.flatMap((g) => cornerBrackets(f, g, 6)),
      tools: ["screwdriver"],
      from: Object.fromEntries(SIDES.map((g) => [`E${g}`, [g * 300, 0, 0] as Vec3])),
    },
    {
      title: "Screw the end aprons onto the frames",
      detail: "Each end apron closes one frame: one screw through each bracket into the frame side.",
      fix: [auto("screw", 4, { len: 16, dia: 4, to: ends })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the frame's edges",
      detail: "Sixteen dowels along the edges that will meet the table top.",
      fix: [auto("dowel", 16, { len: 30, dia: 8, to: [...ends, ...crosses, ...fside(-1), ...fside(1)] })],
      tools: ["hammer"],
    },
    {
      title: "Lay the two top halves face down",
      detail: "On a rug or the flattened box, pushed tight together along the long seam.",
      add: SIDES.map((sz) => `TP${sz}`),
      warnings: ["floor", "face"],
      from: Object.fromEntries(SIDES.map((sz) => [`TP${sz}`, [0, 260, sz * 200] as Vec3])),
    },
    {
      title: "Lower the frame onto the top together",
      detail: "Set the slides in their grooves first, the leaf locks in the holes at the ends. Then lower the frame onto the dowels.",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw the frame to the top",
      detail: "Eighteen long screws through the frame into the top halves.",
      fix: [upScrews(screwPts)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the hinge plates under the top",
      detail: "Two along each long side, in the middle, with two screws each.",
      fix: SIDES.flatMap((sz) => {
        const pts = hingeX.map((x): Vec3 => [x, yU, sz * (Fd / 2 - 40)]);
        return [fx("plate", pts, [0, 1, 0], { on: `TP${sz}`, name: "Hinge plate", len: 4, dia: 40 }), fx("screw", pairs(pts, 0, 30), [0, 1, 0], { on: `TP${sz}`, len: 14, dia: 4 })];
      }),
      tools: ["screwdriver"],
    },
    {
      title: "Clip the side panels onto the plates",
      detail: "Screw two hinges onto each panel, two screws each, then press them onto the plates until they click. Adjust them so the panels line up with the frame.",
      add: SIDES.map((sz) => `SP${sz}`),
      fix: SIDES.flatMap((sz) => {
        const pts = hingeX.map((x): Vec3 => [x, yU - 24, sz * (Fd / 2 - 18)]);
        return [fx("hinge", pts, [0, 0, sz], { on: `SP${sz}` }), fx("screw", pairs(pts, 0, 24), [0, 0, sz], { on: `SP${sz}`, len: 14, dia: 4 })];
      }),
      tools: ["screwdriver"],
      from: Object.fromEntries(SIDES.map((sz) => [`SP${sz}`, [0, 0, sz * 260] as Vec3])),
    },
    ...legSteps(f, lo, true),
    {
      title: "Stick the felt pads on",
      detail: "Eight pads along the centre rails, where the stored leaves rest.",
      fix: [fx("glide", SIDES.flatMap((sz) => [-0.75, -0.25, 0.25, 0.75].map((t): Vec3 => [t * xi * 1.6, yU - 30, sz * 11])), [0, -1, 0], { name: "Felt pad", len: 3, dia: 15 })],
    },
    { title: "Turn the table over together", detail: "Lift it by the top, not by the legs, and set it down on its feet.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Fit the leaves' catches, pins and pads",
      detail: "Two plastic catches under each leaf with two screws each, two pins in the edge that meets the top and two felt pads.",
      add: SIDES.map((g) => `LF${g}`),
      fix: [
        fx("clip", leafPts(3, yU - 30), [0, 1, 0], { name: "Leaf catch", len: 12, dia: 40 }),
        fx("screw", pairs(leafPts(3, yU - 30), 0, 28), [0, 1, 0], { len: 16, dia: 4 }),
        ...SIDES.map((g) => fx("stud", SIDES.map((sz): Vec3 => [g * (Ll + 3), yU - 20, (sz * (Fd - 60)) / 4]), [-g, 0, 0], { on: `LF${g}`, name: "Leaf pin", len: 16, dia: 8 })),
        fx("glide", leafPts(2.4, yU - 30), [0, 1, 0], { name: "Felt pad", len: 3, dia: 15 }),
      ],
      from: Object.fromEntries(SIDES.map((g) => [`LF${g}`, [0, 0, 900] as Vec3])),
    },
    {
      title: "Slide the leaves into their store",
      detail: "Lift a side panel and slide each leaf in under the top. To extend, pull a slide out at the end, lay a leaf on it and push it in until the lock clicks.",
    },
  ];
  return { parts, steps };
}

/* ---------- bar table ---------- */

function barTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const T = 28, A = 110, E = 60, S = 45;
  const Fd = D - 2 * S;
  const xe = W / 2 - E - 10;
  const yU = H - T, yA = yU - A / 2, yB = yU - A;
  const f: LegFrame = { H, T, A, L: 50, xe, ze: Fd / 2 - 20 };
  const lo: Lower = { y: 260, h: 70 };
  const xr = Math.round(W * 0.24); // the drawer runners
  const bl = xe - 10 - (xr + 15); // a front block, from runner to end apron
  const dx = xr - 15 - 3; // half the drawer's width
  const Ld = Fd - 100;
  const zF = Fd / 2;
  const ends = SIDES.map((g) => `E${g}`), runners = SIDES.map((g) => `RN${g}`), blocks = SIDES.map((g) => `FB${g}`);
  const parts: CustomPart[] = [
    P("BA", "Back apron", [2 * (xe - 10), A, 20], [0, yA, -(zF - 10)]),
    ...SIDES.map((g) => P(`FB${g}`, "Front block", [bl, A, 20], [g * (xr + 15 + bl / 2), yA, zF - 10])),
    ...SIDES.map((g) => P(`RN${g}`, "Drawer runner", [30, A, Fd - 20], [g * xr, yA, 10])),
    ...SIDES.map((g) => P(`E${g}`, "End apron", [20, A, Fd], [g * xe, yA, 0])),
    P("TOP", "Table top", [W, T, D], [0, H - T / 2, 0]),
    ...legParts(f),
    ...lowerParts(f, lo),
    P("DF", "Drawer front", [2 * dx, A - 12, 20], [0, yA - 2, zF - 10]),
    ...SIDES.map((g) => P(`DS${g}`, "Drawer side", [16, A - 30, Ld], [g * (dx - 8), yA - 10, zF - 20 - Ld / 2], { material: "board" })),
    P("DBT", "Drawer bottom", [2 * dx - 30, 4, Ld - 16], [0, yA - 40, zF - 20 - (Ld - 16) / 2], { material: "fiber" }),
    P("DB", "Drawer back", [2 * dx - 32, A - 44, 16], [0, yA - 18, zF - 20 - Ld + 8], { material: "board" }),
  ];
  const screwPts: Vec3[] = [
    ...spread(-xe + 80, xe - 80, 7).map((x): Vec3 => [x, yB, -(zF - 10)]),
    ...blocks.map((_, i): Vec3 => [SIDES[i] * (xr + 15 + bl / 2), yB, zF - 10]),
    ...SIDES.flatMap((g) => [-Fd / 4, Fd / 4].map((z): Vec3 => [g * xe, yB, z])),
    ...SIDES.map((g): Vec3 => [g * xr, yB, 0]),
  ];
  // a little out from the apron face, so the engine keeps the knob and its bolt apart
  const knobs = SIDES.flatMap((g) => [-Fd / 4, Fd / 4].map((z): Vec3 => [g * (xe + 13), yA, z]));
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the back apron and front blocks",
      detail: "Lay the parts out on a rug. Two cam bolts in the back apron, one in each front block.",
      add: blocks,
      // the back apron goes on after the runners, along its cam bolts
      wait: ["BA"],
      from: { BA: [0, 0, -300] },
      fix: [
        fx("camScrew", SIDES.map((g): Vec3 => [g * xr, yA, -(zF - 20)]), [0, 0, -1], { on: "BA" }),
        ...SIDES.map((g) => fx("camScrew", [[g * (xr + 15), yA, zF - 10]], [g, 0, 0], { on: `FB${g}` })),
      ],
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Join the drawer runners to the front blocks",
      detail: "A dowel in each end of both runners. Push the front blocks on and turn their cam locks clockwise.",
      add: runners,
      fix: [auto("dowel", 4, { len: 30, dia: 8 }), auto("cam", 2, { to: blocks })],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the runners to the back apron",
      detail: "Turn the back apron so its cam bolts face the runners, push it on and turn the two cam locks.",
      add: ["BA"],
      from: { BA: [0, 0, -260] },
      fix: [auto("cam", 2, { to: ["BA"] })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the corner brackets onto the end aprons",
      detail: "Two brackets on each end apron, two screws each.",
      add: ends,
      fix: SIDES.flatMap((g) => cornerBrackets(f, g, 4)),
      tools: ["screwdriver"],
      from: Object.fromEntries(SIDES.map((g) => [`E${g}`, [g * 300, 0, 0] as Vec3])),
    },
    {
      title: "Screw the knobs onto the end aprons",
      detail: "Two on the outside of each end apron, each held by a bolt from the inside.",
      fix: [
        ...SIDES.map((g) => fx("knob", knobs.filter((p) => Math.sign(p[0]) === g), [-g, 0, 0], { on: `E${g}`, len: 25, dia: 30 })),
        ...SIDES.map((g) => fx("bolt", near(knobs.filter((p) => Math.sign(p[0]) === g), [-g * 23, 0, 0]), [g, 0, 0], { on: `E${g}`, len: 30, dia: 4, name: "Knob bolt" })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the end aprons to the frame",
      detail: "Hook each end apron's brackets onto the frame, then two screws through each bracket.",
      fix: [auto("screw", 8, { len: 16, dia: 4, to: ends })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the frame's edges",
      detail: "Twelve dowels along the edges that will meet the table top.",
      fix: [auto("dowel", 12, { len: 30, dia: 8, to: ["BA", ...ends, ...blocks] })],
      tools: ["hammer"],
    },
    {
      title: "Screw the front blocks to the end aprons",
      detail: "One screw through each end apron into its front block.",
      fix: SIDES.map((g) => fx("screw", [[g * (xe + 10), yA + 30, zF - 10]], [-g, 0, 0], { on: `E${g}`, len: 30, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Lay the top face down and lower the frame onto it",
      detail: "The top goes on a rug, face down. Lower the frame onto it together, onto the dowels.",
      add: ["TOP"],
      people: 2,
      warnings: ["two", "face"],
      from: { TOP: [0, 300, 0] },
    },
    { title: "Screw the frame to the top", detail: "Fifteen long screws through the frame into the top.", fix: [upScrews(screwPts)], tools: ["screwdriver"] },
    ...legSteps(f, lo, true),
    { title: "Turn the table over together", detail: "Lift it by the top, not by the legs, and set it down on its feet.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Join the drawer sides to the front",
      detail: "Two dowels and two cam bolts in the front's back face. Push the sides on and turn their cam locks.",
      add: ["DF", "DS-1", "DS1"],
      // into the front's back face, where each side meets it (not its ends, which only sit near the runners)
      fix: [
        fx("dowel", SIDES.map((g): Vec3 => [g * (dx - 8), yA - 30, zF - 20]), [0, 0, 1], { on: "DF", len: 30, dia: 8 }),
        fx("camScrew", SIDES.map((g): Vec3 => [g * (dx - 8), yA + 10, zF - 20]), [0, 0, 1], { on: "DF" }),
        ...SIDES.map((g) => fx("cam", [[g * (dx - 16), yA + 10, zF - 44]], [g, 0, 0], { on: `DS${g}` })),
      ],
      tools: ["screwdriver"],
      from: { DF: [0, 0, 700], "DS-1": [-120, 0, 700], DS1: [120, 0, 700] },
    },
    {
      title: "Slide in the drawer bottom",
      detail: "Into the grooves in the sides, then stick the two glide pads under the back of the sides.",
      add: ["DBT"],
      fix: [fx("glide", SIDES.map((g): Vec3 => [g * (dx - 8), yA - 50, zF - Ld + 20]), [0, 1, 0], { name: "Glide pad", len: 2, dia: 18 })],
      from: { DBT: [0, 0, 700] },
    },
    { title: "Screw on the drawer back", detail: "Two screws through each side into the back.", add: ["DB"], fix: [auto("screw", 4, { len: 30, dia: 4 })], tools: ["screwdriver"], from: { DB: [0, 300, 0] } },
    {
      title: "Screw on the handle",
      detail: "Two bolts from inside the drawer front.",
      fix: [fx("handle", [[0, yA, zF + 4]], [0, 0, -1], { on: "DF", name: "Cup handle", len: 96, dia: 30 }), fx("bolt", [[-28, yA, zF - 20], [28, yA, zF - 20]], [0, 0, 1], { on: "DF", len: 30, dia: 4, name: "Handle bolt" })],
      tools: ["screwdriver"],
    },
    {
      title: "Slide the drawer in and fit the stops",
      detail: "Rest it on the runners' ledges and push it in. One stop screw in the back of each runner keeps it from coming all the way out.",
      fix: SIDES.map((g) => fx("screw", [[g * (xr - 15), yA - 20, -zF + 60]], [g, 0, 0], { on: `RN${g}`, len: 20, dia: 5, name: "Stop screw" })),
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

/* ---------- drop-leaf table ---------- */

function dropLeaf(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const leaf = (s.table?.leaf ?? 30) * 10;
  const T = 25, A = 80, Fo = D - 120; // a square frame under the middle
  const yU = H - T, yA = yU - A / 2, yB = yU - A;
  const xe = Fo / 2 - 10;
  const f: LegFrame = { H, T, A, L: 45, xe, ze: Fo / 2 - 20 };
  const seam = W / 2 - leaf; // the hinge line between top and leaf
  const ends = SIDES.map((g) => `E${g}`), rails = SIDES.map((sz) => `SR${sz}`);
  const parts: CustomPart[] = [
    ...SIDES.map((g) => P(`E${g}`, "End apron", [20, A, Fo], [g * xe, yA, 0])),
    P("M", "Middle rail", [Fo - 40, A - 10, 22], [0, yU - (A - 10) / 2, 0]),
    ...SIDES.map((sz) => P(`SR${sz}`, "Side rail", [Fo - 40, A, 20], [0, yA, sz * (Fo / 2 - 10)])),
    P("TOP", "Table top", [W - leaf, T, D], [-leaf / 2, H - T / 2, 0]),
    P("LEAF", "Leaf", [leaf, T, D], [seam + leaf / 2, H - T / 2, 0]),
    P("STOP", "Stop block", [30, 20, 60], [-(Fo / 2) - 25, yU - 10, 0]),
    ...legParts(f),
  ];
  const hinges = [-D / 4, D / 4].map((z): Vec3 => [seam, yU, z]);
  const slides: Vec3[] = [...SIDES.flatMap((sz) => [-Fo / 4, Fo / 4].map((x): Vec3 => [x, yU, sz * (Fo / 2 - 34)])), [0, yU, 24]];
  const bumpers = [-D / 3, D / 3].map((z): Vec3 => [-W / 2 + 40, yU, z]);
  const steps: CustomStep[] = [
    {
      title: "Screw the corner brackets onto the end aprons",
      detail: "Lay the frame parts on a rug. A bracket at each end of both end aprons, two screws each.",
      add: ends,
      fix: SIDES.flatMap((g) => cornerBrackets(f, g, 4)),
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Screw a cam bolt into each end apron",
      detail: "In the middle of the inside face, where the middle rail meets it.",
      fix: SIDES.map((g) => fx("camScrew", [[g * (xe - 10), yU - 30, 0]], [g, 0, 0], { on: `E${g}` })),
      tools: ["screwdriver"],
    },
    {
      title: "Fit the middle rail",
      detail: "Two dowels in each end. Press it onto the end aprons' cam bolts.",
      add: ["M"],
      fix: [auto("dowel", 4, { len: 30, dia: 8, to: ["M"] })],
    },
    { title: "Lock the middle rail", detail: "Turn the two cam locks in the rail clockwise.", fix: [auto("cam", 2, { to: ["M"] })], tools: ["screwdriver"] },
    {
      title: "Screw on a side rail",
      detail: "Stand the frame on its edge. Two screws through each bracket into the side rail, its groove facing in.",
      add: ["SR-1"],
      fix: [auto("screw", 4, { len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Turn it and screw on the other side rail", detail: "The same way, two screws in each bracket.", add: ["SR1"], fix: [auto("screw", 4, { len: 16, dia: 4 })], tools: ["screwdriver"] },
    {
      title: "Lay the top and the leaf face down",
      detail: "On a rug, pushed tight together along the hinge line.",
      add: ["TOP", "LEAF"],
      warnings: ["floor", "face"],
      from: { TOP: [-200, 260, 0], LEAF: [200, 260, 0] },
    },
    {
      title: "Screw the hinges across the join",
      detail: "Two hinges, six screws each: three into the top and three into the leaf.",
      fix: [
        fx("flatHinge", hinges, [0, 1, 0], { on: "TOP", len: 60, dia: 40 }),
        fx("screw", hinges.flatMap((p) => [-1, 1].flatMap((k) => [-18, 0, 18].map((dz): Vec3 => [p[0] + k * 18, yU, p[2] + dz]))), [0, 1, 0], { len: 14, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the stop block under the top",
      detail: "Two screws, in the holes near the far end of the top.",
      add: ["STOP"],
      fix: [auto("screw", 2, { len: 40, dia: 4, to: ["STOP"] })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw in the two bumpers",
      detail: "Under the far end of the top, one screw each.",
      fix: [fx("foot", bumpers, [0, 1, 0], { on: "TOP", name: "Bumper", len: 10, dia: 24 }), fx("screw", bumpers, [0, 1, 0], { on: "TOP", len: 20, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Set the frame on the top",
      detail: "Upside down, and slide it along until its end apron meets the stop block.",
      people: 1,
    },
    {
      title: "Push the slide rails into the frame",
      detail: "Five steel rails: two into each side rail's slots and one into the middle rail.",
      fix: [fx("clamp", slides, [0, 1, 0], { on: "TOP", name: "Slide rail", len: 150, dia: 30 })],
    },
    { title: "Screw the slide rails to the top", detail: "Two screws through each rail into the top.", fix: [fx("screw", pairs(slides, 0, 100), [0, 1, 0], { on: "TOP", len: 16, dia: 4 })], tools: ["screwdriver"] },
    ...legSteps(f, null, false),
    {
      title: "Screw on the leaf lock",
      detail: "Into the end apron under the leaf, two screws, ring hanging down.",
      fix: [fx("stud", [[xe + 10, yU - 30, 0]], [-1, 0, 0], { on: "E1", name: "Leaf lock pin", len: 40, dia: 12 }), fx("screw", [[xe + 10, yU - 30, -18], [xe + 10, yU - 30, 18]], [-1, 0, 0], { on: "E1", len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Turn the table over", detail: "Lift it by the top, not by the legs, and set it on its feet.", pose: "+y" },
    {
      title: "Raise the leaf",
      detail: "Slide the top towards the leaf until the lock clicks, then the leaf rests on the frame. Pull the ring to slide it back and let the leaf drop.",
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["NORDVIKEN"],
  recipe(s) {
    const v = s.variant.toLowerCase();
    if (s.archetype === "seat") return /chair|stool/.test(v) ? chair(s) : null;
    if (s.archetype !== "table") return null;
    if (/extendable/.test(v)) return extendable(s);
    if (/bar table/.test(v)) return barTable(s);
    if (/drop-leaf/.test(v)) return dropLeaf(s);
    return null;
  },
};
export default family;
