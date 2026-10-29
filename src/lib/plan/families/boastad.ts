import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BOASTAD, read from its manuals. Every piece is a black board box joined with cam bolts and cam locks.
 *   TV units and the sideboard stand on a steel base: two leg frames (three on the long ones, the middle one with a
 *   single leg) joined by two rails with bolts, laid upside down on the bottom panel and fixed with expanding plugs.
 *   Upright again, the dividers, the top and the back panels go on (the middle back panel drops in from above, the
 *   others slide in from the ends), then the sides, and clips hold the backs. Wall brackets, spacers and two screws
 *   hold it to the wall. Shelves, then the glass doors on clip hinges, then the oak folding doors: two panels joined
 *   by flat hinges, the outer one hinged to the cabinet, the inner one running on guides.
 *   The wall shelf is the same box without a base, hung on a two-part rail screwed to the wall.
 *   The high cabinet is built lying on its side, gets its base bolted on and stands up against the wall; a wooden
 *   door below and a glass door above.
 */

const SIDES = [-1, 1] as const;
const ST = 16; // carcass boards
const BT = 8; // back panels
const GAP = 3;
type Fx = Partial<CustomFix>;

const P = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}): CustomPart => ({ id, name, size, pos, material: "board", ...o });
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Fx = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const spread = (a: number, b: number, n: number) => (n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));
const pairs = (pts: Vec3[], axis: 0 | 1 | 2, gap: number) => pts.flatMap((p) => [-1, 1].map((k): Vec3 => p.map((v, i) => (i === axis ? v + (k * gap) / 2 : v)) as Vec3));

/* ---------- the steel base ---------- */

interface Base {
  parts: CustomPart[];
  frames: string[];
  rails: string[];
  feet: Vec3[];
  bolts: Vec3[];
  boltDirs: number[];
  plugs: Vec3[];
  middle?: Vec3[]; // screws holding the middle frame to the rails
  net: Vec3[]; // plugs holding the cable net
}

function base(W: number, D: number, legH: number, n: number): Base {
  const fx0 = W / 2 - 50, zl = D / 2 - 47, bar = D - 70;
  const legLen = legH - 20 - 12;
  const frame = (single: boolean, drop = 0): PartPiece[] => [
    { shape: "box", size: [30, 20, bar], pos: [0, legH / 2 - 10 - drop, 0], material: "metal" },
    ...(single ? [zl] : [-zl, zl]).map((z): PartPiece => ({ shape: "cyl", size: [25, legLen - drop, 25], pos: [0, -legH / 2 + 12 + (legLen - drop) / 2, z], material: "metal" })),
  ];
  const parts: CustomPart[] = SIDES.map((g) => P(`U${g}`, "Leg frame", [30, legH, bar], [g * fx0, legH / 2, 0], { material: "metal", pieces: frame(false) }));
  const frames = SIDES.map((g) => `U${g}`);
  const feet: Vec3[] = SIDES.flatMap((g) => SIDES.map((sz): Vec3 => [g * fx0, 0, sz * zl]));
  if (n === 3) {
    parts.push(P("U0", "Middle leg frame", [30, legH, bar], [0, legH / 2, 0], { material: "metal", pieces: frame(true, 20) }));
    frames.push("U0");
    feet.push([0, 0, zl]);
  }
  parts.push(...SIDES.map((sz) => P(`RL${sz}`, "Base rail", [2 * fx0 - 30, 20, 20], [0, legH - 10, sz * zl], { material: "metal" })));
  const bolts = SIDES.flatMap((g) => SIDES.map((sz): Vec3 => [g * (fx0 + 15), legH - 10, sz * zl]));
  const plugs: Vec3[] = [...SIDES.flatMap((g) => SIDES.map((sz): Vec3 => [g * fx0, legH, (sz * D) / 4])), ...(n === 3 ? SIDES.map((sz): Vec3 => [0, legH, sz * zl]) : [])];
  return { parts, frames, rails: SIDES.map((sz) => `RL${sz}`), feet, bolts, boltDirs: bolts.map((p) => -Math.sign(p[0])), plugs, net: SIDES.map((k): Vec3 => [-W * 0.22 + k * W * 0.13, legH, 0]), middle: n === 3 ? SIDES.map((sz): Vec3 => [0, legH - 40, sz * zl]) : undefined };
}

function baseSteps(b: Base): CustomStep[] {
  return [
    {
      title: "Screw the feet into the leg frames",
      detail: "One adjustable foot into the bottom of each leg, all the way in for now.",
      add: b.frames,
      fix: [fx("foot", b.feet, [0, 1, 0], { name: "Adjustable foot", len: 12, dia: 25 })],
    },
    {
      title: "Hook the base rails onto the frames",
      detail: b.middle ? "Hook both rails into the end frames, then set the middle frame under them and screw it on with two screws." : "Hook both rails into the end frames, flat side up.",
      add: b.rails,
      fix: b.middle ? [fx("screw", b.middle, [0, 1, 0], { on: "U0", len: 16, dia: 4 })] : [],
      tools: b.middle ? ["screwdriver"] : [],
    },
    {
      title: "Bolt the rails to the frames",
      detail: "A bolt through each frame into its rail, with a sleeve nut from the inside, tightened with the two Allen keys.",
      fix: [
        ...SIDES.map((g) => fx("bolt", b.bolts.filter((p) => Math.sign(p[0]) === g), [-g, 0, 0], { on: `U${g}`, len: 30, dia: 6 })),
        ...SIDES.map((g) => fx("nut", b.bolts.filter((p) => Math.sign(p[0]) === g).map((p): Vec3 => [p[0] - g * 30, p[1], p[2]]), [g, 0, 0], { on: `RL${Math.sign(b.bolts[0][2])}`, name: "Sleeve nut", len: 12, dia: 10 })),
      ],
      tools: ["allen"],
    },
    {
      title: "Lay the bottom panel face down",
      detail: "On a rug or the flattened box, the holes for the base facing up.",
      add: ["B"],
      pose: "-y",
      warnings: ["floor"],
      from: { B: [0, 260, 0] },
    },
    { title: "Turn the base over onto it", detail: "Upside down, its plates over the holes in the bottom panel.", warnings: ["floor"] },
    {
      title: "Fix the base and the cable net",
      detail: "Push an expanding plug through each plate into the bottom and knock its pin in. Two more plugs and pins hold the cable net.",
      add: ["NET"],
      fix: [
        fx("clip", [...b.plugs, ...b.net], [0, 1, 0], { on: "B", name: "Expanding plug", len: 16, dia: 10 }),
        fx("nail", [...b.plugs, ...b.net], [0, 1, 0], { on: "B", name: "Expanding pin", len: 30, dia: 4 }),
      ],
      tools: ["hammer"],
    },
  ];
}

/* ---------- the low units: TV benches, the sideboard and the wall shelves ---------- */

type DoorKind = "glass" | "fold";
interface Low {
  W: number;
  H: number;
  D: number;
  legH: number; // 0 on the wall
  bounds: number[]; // x of the dividers' centres
  groups: { a: number; b: number; kind: DoorKind }[]; // what covers the front, left to right
  shelves: ("glass" | "wood" | null)[]; // one per bay
  drawers: number; // in the middle bay (the sideboard)
  clips: number;
  strips: number;
  frames: number;
}

function layout(s: ProductSpec): Low | null {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const v = s.variant.toLowerCase();
  const xa = -W / 2 + ST, xb = W / 2 - ST;
  const equal = (n: number) => {
    const bw = (W - 2 * ST - (n - 1) * ST) / n;
    return Array.from({ length: n - 1 }, (_, k) => xa + (k + 1) * (bw + ST) - ST / 2);
  };
  const groups = (bs: number[], kinds: DoorKind[]) => kinds.map((kind, i) => ({ a: [xa, ...bs][i], b: [...bs, xb][i], kind }));
  if (/tv unit|wall shelf/.test(v)) {
    const wall = /wall shelf/.test(v);
    const n = W > 1500 ? 3 : 2;
    const bs = equal(n);
    return {
      W,
      H,
      D,
      legH: wall ? 0 : 120,
      bounds: bs,
      groups: groups(bs, n === 3 ? ["glass", "fold", "fold"] : ["glass", "fold"]),
      shelves: wall ? (n === 3 ? ["glass", null, null] : ["glass", null]) : n === 3 ? ["glass", "wood", "wood"] : ["glass", "wood"],
      drawers: 0,
      clips: wall ? (n === 3 ? 8 : 6) : n === 3 ? 12 : 8,
      strips: n === 3 ? 6 : 4,
      frames: n,
    };
  }
  if (/sideboard/.test(v)) {
    const mid = 350 + ST; // the drawer bay, centre to centre of its dividers
    const bs = [-mid / 2, mid / 2];
    return { W, H, D, legH: 130, bounds: bs, groups: groups([0], ["fold", "fold"]), shelves: ["wood", null, "wood"], drawers: 2, clips: 20, strips: 2, frames: 3 };
  }
  return null;
}

function low(L: Low): CustomParams {
  const { W, H, D, legH } = L;
  const wall = legH === 0;
  const y0 = legH, yB = y0 + ST, yT = H - ST; // floor of the carcass, top of the bottom panel, underside of the top
  const yc = (yB + yT) / 2;
  const hi = yT - yB;
  const xa = -W / 2 + ST, xb = W / 2 - ST;
  const zBk = -D / 2 + 8 + BT / 2; // back panels in their grooves
  const zDf = D / 2 - 20; // dividers stop short of the doors
  const dvD = zDf - (zBk + BT / 2);
  const nb = L.bounds.length + 1;
  const edges = [xa, ...L.bounds, xb];
  const bay = (i: number) => ({ a: edges[i] + (i ? ST / 2 : 0), b: edges[i + 1] - (i < nb - 1 ? ST / 2 : 0) });
  const parts: CustomPart[] = [];
  const bs = wall ? null : base(W, D, legH, L.frames);
  if (bs) parts.push(...bs.parts);
  parts.push(P("B", "Bottom panel", [W - 2 * ST, ST, D], [0, y0 + ST / 2, 0]));
  if (bs) parts.push(P("NET", "Cable net", [W * 0.3, 3, D * 0.45], [-W * 0.22, legH - 2, 0], { material: "soft" }));
  const dividers = L.bounds.map((x, k) => {
    parts.push(P(`V${k}`, "Divider", [ST, hi, dvD], [x, yc, zBk + BT / 2 + dvD / 2]));
    return `V${k}`;
  });
  // the back panels meet on the dividers; with three bays the middle one drops in from above
  const backs = Array.from({ length: nb }, (_, i) => {
    const a = edges[i], b = edges[i + 1];
    parts.push(P(`K${i}`, "Back panel", [b - a, hi, BT], [(a + b) / 2, yc, zBk]));
    return `K${i}`;
  });
  parts.push(P("T", "Top panel", [W - 2 * ST, ST, D], [0, H - ST / 2, 0]));
  parts.push(...SIDES.map((g) => P(`S${g}`, "Side panel", [ST, H - y0, D], [g * (W / 2 - ST / 2), (y0 + H) / 2, 0])));

  // shelves
  const shelfIds: string[] = [];
  const pins: CustomFix[] = [];
  L.shelves.forEach((k, i) => {
    if (!k) return;
    const { a, b } = bay(i);
    const t = k === "glass" ? 6 : ST;
    const y = yB + hi * 0.5;
    const z0 = zBk + BT / 2 + 4, z1 = zDf - 10;
    parts.push(P(`SH${i}`, k === "glass" ? "Glass shelf" : "Shelf", [b - a - 4, t, z1 - z0], [(a + b) / 2, y, (z0 + z1) / 2], { material: k === "glass" ? "glass" : "board" }));
    shelfIds.push(`SH${i}`);
    const zs = [z0 + 40, z1 - 40];
    pins.push(...[a, b].map((x, j) => fx("pin", zs.map((z): Vec3 => [x, y - t / 2 - 3, z]), [j ? 1 : -1, 0, 0], { name: k === "glass" ? "Shelf pin" : "Shelf support", len: 12, dia: 5 })));
  });

  // drawers in the middle bay
  const drawerIds: string[][] = [];
  const runners: CustomFix[] = [];
  if (L.drawers) {
    const { a, b } = bay(1);
    const dw = b - a - 26, dh = 120, Ld = dvD - 40;
    for (let i = 0; i < L.drawers; i++) {
      const top = yT - 30 - i * (dh + 40);
      const y = top - dh / 2;
      const zf = zDf - 8, zb = zf - 8 - Ld;
      const ids = [`DF${i}`, `DL${i}`, `DR${i}`, `DK${i}`, `DB${i}`];
      parts.push(
        P(ids[0], "Drawer front", [dw, dh, 16], [0, y, zf]),
        P(ids[1], "Drawer side", [12, dh - 10, Ld], [-dw / 2 + 6, y + 5, (zf - 8 + zb) / 2]),
        P(ids[2], "Drawer side", [12, dh - 10, Ld], [dw / 2 - 6, y + 5, (zf - 8 + zb) / 2]),
        P(ids[3], "Drawer back", [dw - 24, dh - 20, 12], [0, y + 10, zb + 6]),
        P(ids[4], "Drawer bottom", [dw - 24, 4, Ld - 12], [0, y - dh / 2 + 8, (zf - 8 + zb + 12) / 2], { material: "fiber" }),
      );
      drawerIds.push(ids);
      runners.push(...[a, b].map((x, j) => fx("runner", [[x, y - dh / 2 + 10, (zf + zb) / 2]], [j ? 1 : -1, 0, 0], { on: `V${j}`, len: Ld, dia: 40 })));
    }
  }

  // doors
  const dh = hi - 2 * GAP, dy = yc;
  const zD = D / 2 - 9;
  interface Door {
    id: string;
    a: number;
    b: number;
    hinge?: number; // x of the hinge edge
    group: number;
  }
  const glass: Door[] = [], fold: Door[][] = [];
  L.groups.forEach((g, gi) => {
    const w = (g.b - g.a - 3 * GAP) / 2;
    const l = { a: g.a + GAP, b: g.a + GAP + w }, r = { a: g.b - GAP - w, b: g.b - GAP };
    if (g.kind === "glass") {
      glass.push({ id: `G${gi}L`, ...l, hinge: l.a, group: gi }, { id: `G${gi}R`, ...r, hinge: r.b, group: gi });
    } else {
      const left = (g.a + g.b) / 2 <= 0 && !(g.a === L.groups[L.groups.length - 1].a);
      const outer = left ? { id: `F${gi}O`, ...l, hinge: l.a, group: gi } : { id: `F${gi}O`, ...r, hinge: r.b, group: gi };
      const inner = left ? { id: `F${gi}I`, ...r, group: gi } : { id: `F${gi}I`, ...l, group: gi };
      fold.push([outer, inner]);
    }
  });
  const fr = 22; // glass door frame
  for (const d of glass) {
    const w = d.b - d.a;
    const pieces: PartPiece[] = [
      ...SIDES.map((k): PartPiece => ({ shape: "box", size: [fr, dh, 18], pos: [(k * (w - fr)) / 2, 0, 0] })),
      ...SIDES.map((k): PartPiece => ({ shape: "box", size: [w - 2 * fr, fr, 18], pos: [0, (k * (dh - fr)) / 2, 0] })),
      { shape: "box", size: [w - 2 * fr, dh - 2 * fr, 4], pos: [0, 0, 0], material: "glass" },
    ];
    parts.push(P(d.id, "Glass door", [w, dh, 18], [(d.a + d.b) / 2, dy, zD], { pieces }));
  }
  for (const pair of fold) for (const d of pair) parts.push(P(d.id, "Folding door panel", [d.b - d.a, dh, 18], [(d.a + d.b) / 2, dy, zD], { material: "wood" }));

  const hy = [dy - dh * 0.38, dy + dh * 0.38];
  const wallAt = (x: number) => (x <= xa + 1 ? xa : x >= xb - 1 ? xb : x < 0 ? x + 0 : x); // hinge plates sit on the side or divider face
  const hingeFix = (ds: Door[], n: number): CustomFix[] =>
    ds.flatMap((d) => {
      const s = d.hinge! < (d.a + d.b) / 2 ? 1 : -1; // towards the door's middle
      const hx = d.hinge! + s * 40;
      return [fx("hinge", hy.slice(0, n).map((y): Vec3 => [hx, y, zD - 9]), [0, 0, 1], { on: d.id, len: 50, dia: 35, twist: s < 0 ? Math.PI : 0 })];
    });
  const plateFix = (ds: Door[]): CustomFix[] =>
    ds.map((d) => {
      const s = d.hinge! < (d.a + d.b) / 2 ? 1 : -1;
      const x = wallAt(d.hinge! - s * GAP);
      return fx("plate", hy.map((y): Vec3 => [x, y, D / 2 - 50]), [-s, 0, 0], { name: "Mounting plate", len: 4, dia: 30 });
    });
  const seam = (pair: Door[]) => (pair[0].hinge! < (pair[1].a + pair[1].b) / 2 ? pair[0].b + GAP / 2 : pair[0].a - GAP / 2);
  const free = (pair: Door[]) => {
    const inner = pair[1];
    return pair[0].hinge! < inner.a ? inner.b - 30 : inner.a + 30;
  };

  // fittings in the carcass
  const camB = L.bounds.flatMap((x) => [-D / 5, D / 5].map((z): Vec3 => [x, yB, z]));
  const camT = L.bounds.flatMap((x) => [-D / 5, D / 5].map((z): Vec3 => [x, yT, z]));
  const sideBolts = SIDES.flatMap((g) => [yB - ST / 2, yT + ST / 2].flatMap((y) => [-D / 4, D / 4].map((z): Vec3 => [g * (W / 2 - ST), y, z])));
  const sideCams = (y: number) => SIDES.flatMap((g) => [-D / 4, D / 4].map((z): Vec3 => [g * (W / 2 - ST - 34), y, z]));
  const clipPts = spread(-W / 2 + 60, W / 2 - 60, L.clips / 2).flatMap((x) => [yB + 40, yT - 40].map((y): Vec3 => [x, y, zBk - BT / 2]));
  const stripPts = Array.from({ length: L.strips }, (_, i) => {
    const b = bay(Math.floor(i / 2) % nb);
    return [(b.a + b.b) / 2, i % 2 ? yT : yB, D / 2 - 40] as Vec3;
  });
  const steps: CustomStep[] = [];
  if (bs) steps.push(...baseSteps(bs));
  steps.push({
    title: wall ? "Screw the cam bolts into the bottom panel" : "Turn it over and fit the cam bolts",
    detail: `${dividers.length === 1 ? "Two" : "Four"} cam bolts in the bottom panel, where the ${dividers.length === 1 ? "divider stands" : "dividers stand"}. Screw them in by hand until they stop.`,
    add: wall ? ["B"] : [],
    fix: [fx("camScrew", camB, [0, -1, 0], { on: "B" })],
    pose: "+y",
    warnings: wall ? ["floor"] : [],
  });
  steps.push({
    title: dividers.length === 1 ? "Stand the divider on the bottom" : L.drawers ? "Screw on the runners and stand the dividers up" : "Stand the dividers on the bottom",
    detail: L.drawers
      ? "First screw the drawer runners onto the inside faces of the two dividers, two screws each. Then set the dividers onto the cam bolts and turn their cam locks."
      : "Set it onto the cam bolts, holes towards the front, and turn the cam locks clockwise.",
    add: dividers,
    fix: [
      ...runners,
      ...runners.map((r) => fx("screw", pairs(r.at!, 2, 200), r.dir!, { on: r.on, len: 12, dia: 4 })),
      ...L.bounds.map((x, k) => fx("cam", [-D / 5, D / 5].map((z): Vec3 => [x - ST / 2, yB + 34, z]), [1, 0, 0], { on: `V${k}` })),
    ],
    tools: ["screwdriver"],
  });
  if (nb === 3)
    steps.push({
      title: "Drop the middle back panel in",
      detail: "Down into the grooves at the back of the two dividers, until it stands in the groove of the bottom panel.",
      add: ["K1"],
      from: { K1: [0, 450, 0] },
    });
  steps.push(
    {
      title: "Put the top on",
      detail: `Lay it on a rug and screw in its ${L.bounds.length * 2} cam bolts first, then set it on the ${dividers.length === 1 ? "divider" : "dividers"} and turn their cam locks.`,
      add: ["T"],
      fix: [fx("camScrew", camT, [0, 1, 0], { on: "T" }), ...L.bounds.map((x, k) => fx("cam", [-D / 5, D / 5].map((z): Vec3 => [x - ST / 2, yT - 34, z]), [1, 0, 0], { on: `V${k}` }))],
      tools: ["screwdriver"],
      from: { T: [0, 260, 0] },
    },
    {
      title: "Slide the back panels in from the ends",
      detail: "Along the grooves in the top and bottom, until each one meets a divider.",
      add: backs.filter((id) => id !== "K1" || nb !== 3),
      from: Object.fromEntries(backs.map((id, i) => [id, [(i < nb / 2 ? -1 : 1) * 500, 0, 0] as Vec3])),
    },
    {
      title: "Fit the side panels",
      detail: "Screw four cam bolts into each side on a rug, then press the sides onto the ends of the top and bottom.",
      add: SIDES.map((g) => `S${g}`),
      fix: SIDES.map((g) => fx("camScrew", sideBolts.filter((p) => Math.sign(p[0]) === g), [g, 0, 0], { on: `S${g}` })),
      tools: ["screwdriver"],
      people: L.W > 1500 ? 2 : 1,
    },
    { title: "Lock the sides to the top", detail: "Four cam locks in the top, turned clockwise.", fix: [fx("cam", sideCams(yT), [0, 1, 0], { on: "T" })], tools: ["screwdriver"] },
    {
      title: wall ? "Lock the sides to the bottom" : "Turn it upside down and lock the bottom",
      detail: wall ? "Four cam locks in the bottom panel." : "Four cam locks in the bottom panel, then stand it back on its feet.",
      fix: [fx("cam", sideCams(yB), [0, -1, 0], { on: "B" })],
      tools: ["screwdriver"],
      pose: wall ? "+y" : "-y",
    },
    {
      title: "Clip the back panels in",
      detail: "Each clip comes in two halves: push the first through the hole, then press the second into it.",
      fix: [fx("clip", clipPts, [0, 0, 1], { name: "Back clip", len: 12, dia: 14 })],
      pose: "+y",
    },
  );
  if (!wall)
    steps.push(
      {
        title: "Screw the wall brackets on",
        detail: "One on the back edge of each side, near the top, with two screws.",
        fix: [
          fx("bracket", SIDES.map((g): Vec3 => [g * (W / 2 - ST / 2), H - 60, -D / 2]), [0, 0, 1], { len: 40, dia: 30 }),
          fx("screw", pairs(SIDES.map((g): Vec3 => [g * (W / 2 - ST / 2), H - 60, -D / 2]), 1, 50), [0, 0, 1], { len: 12, dia: 4 }),
        ],
        tools: ["screwdriver"],
        wall: false,
      },
      {
        title: "Screw on the wall spacers",
        detail: "Into the brackets. Turn them out until they touch the wall, past a skirting board if there is one.",
        fix: [fx("spacer", SIDES.map((g): Vec3 => [g * (W / 2 - ST / 2), H - 60, -D / 2 - 6]), [0, 0, 1], { name: "Wall spacer", len: 20, dia: 22 })],
      },
      { title: "Set it against the wall and level it", detail: "Turn the feet until it stands level and steady.", tools: ["level"] },
    );
  steps.push({
    title: "Press the groove strips in",
    detail: "Into the grooves along the front of the top and bottom, a little at a time from one end.",
    fix: SIDES.map((k) => fx("clamp", stripPts.filter((p) => (p[1] === yT ? 1 : -1) === k), [0, k, 0], { on: k > 0 ? "T" : "B", name: "Groove strip", len: (bay(0).b - bay(0).a) * 0.9, dia: 8 })).filter((f) => f.count),
  });
  if (!wall)
    steps.push({
      title: "Screw it to the wall",
      detail: "Through each wall bracket, then press a cap over the screw. Wall screws and plugs aren't included: use ones made for your wall.",
      fix: [
        fx("plug", SIDES.map((g): Vec3 => [g * (W / 2 - 40), H - 60, -D / 2 - 30]), [0, 0, -1], {}),
        fx("screw", SIDES.map((g): Vec3 => [g * (W / 2 - 40), H - 60, -D / 2 - 24]), [0, 0, -1], { len: 50, dia: 5, name: "Wall screw" }),
        fx("cap", SIDES.map((g): Vec3 => [g * (W / 2 - 40), H - 60, -D / 2 - 22]), [0, 0, -1], {}),
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    });
  else {
    const rw = W / 2 - 60;
    parts.push(...SIDES.map((g) => P(`RH${g}`, "Wall rail half", [rw, 40, 15], [(g * rw) / 2 + g, H - 50, -D / 2 - 7.5], { material: "metal" })));
    const screws = spread(-W / 2 + 90, W / 2 - 90, 8).map((x): Vec3 => [x, H - 50, -D / 2 - 15]);
    steps.push(
      {
        title: "Join the two rail halves",
        detail: "Click the joining plate into both halves, then clip the two hangers in.",
        add: SIDES.map((g) => `RH${g}`),
        fix: [
          fx("plate", [[0, H - 50, -D / 2 - 15]], [0, 0, 1], { on: "RH1", name: "Rail joiner", len: 3, dia: 60 }),
          fx("hook", SIDES.map((g): Vec3 => [g * (W / 2 - 120), H - 30, -D / 2]), [0, 0, -1], { name: "Hanger", len: 40, dia: 24 }),
        ],
        from: { "RH-1": [0, 0, -300], RH1: [0, 0, -300] },
      },
      {
        title: "Hold the rail level on the wall and mark the holes",
        detail: "Its top edge just above where the shelf's top will be. Check it with the level, mark the holes and drill them.",
        tools: ["level", "pencil", "drill"],
        people: 2,
        warnings: ["two", "wall"],
      },
      {
        title: "Screw the rail to the wall",
        detail: "Eight screws, each through a spacer. Wall screws and plugs aren't included: use ones made for your wall.",
        fix: [fx("plug", screws.map((p): Vec3 => [p[0], p[1], p[2] - 20]), [0, 0, -1], {}), fx("screw", screws, [0, 0, -1], { len: 50, dia: 5, name: "Wall screw" })],
        tools: ["drill", "screwdriver"],
        wall: true,
        warnings: ["wall"],
      },
      {
        title: "Hang the shelf on the rail together",
        detail: "Lift it so the hangers drop over the rail, then turn the adjusting screws to move it sideways until it sits right.",
        people: 2,
        warnings: ["two", "wall"],
        tools: ["screwdriver"],
      },
    );
  }
  if (shelfIds.length)
    steps.push({
      title: shelfIds.length === 1 ? "Put the shelf in" : "Put the shelves in",
      detail: "Four pins or supports at the same height for each shelf, then lay the shelf on them.",
      add: shelfIds,
      fix: pins,
      from: Object.fromEntries(shelfIds.map((id) => [id, [0, 0, 400] as Vec3])),
    });
  if (drawerIds.length)
    steps.push(
      {
        title: "Put the two drawers together",
        detail: "Dowels and cam bolts into each front, the sides pressed on and locked, the bottom slid into the grooves and the back screwed on.",
        add: drawerIds.flat(),
        fix: [
          { kind: "dowel", count: 8, len: 30, dia: 8, to: drawerIds.map((d) => d[0]) },
          { kind: "camScrew", count: 4, to: drawerIds.map((d) => d[0]) },
          { kind: "cam", count: 4, to: drawerIds.map((d) => d[0]) },
        ],
        tools: ["screwdriver"],
        from: Object.fromEntries(drawerIds.flat().map((id) => [id, [0, 0, 600] as Vec3])),
      },
      {
        title: "Slide the drawers onto the runners",
        detail: "Pull the runners out, set each drawer on them and push it in until the locks under the front click.",
        fix: [fx("clip", drawerIds.flatMap((_, i) => SIDES.map((g): Vec3 => [g * 120, yT - 30 - i * 160 - 120, zDf - 30])), [0, 1, 0], { name: "Runner lock", len: 10, dia: 24 })],
      },
    );
  if (glass.length)
    steps.push(
      {
        title: "Hang the glass doors",
        detail: "Screw the mounting plates inside the cabinet, click two hinges onto each door, then hook the hinges onto the plates and press until they click.",
        add: glass.map((d) => d.id),
        fix: [...plateFix(glass), ...hingeFix(glass, 2)],
        tools: ["screwdriver"],
        from: Object.fromEntries(glass.map((d) => [d.id, [0, 0, 400] as Vec3])),
      },
      {
        title: "Fit the knobs and the bumpers",
        detail: "A knob on each glass door, screwed from the inside, and the soft bumpers on the inside of the cabinet where the doors close.",
        fix: [
          fx("knob", glass.map((d): Vec3 => [d.hinge! < (d.a + d.b) / 2 ? d.b - 30 : d.a + 30, dy, D / 2]), [0, 0, -1], { len: 20, dia: 16 }),
          ...SIDES.map((k) => fx("glide", glass.map((d): Vec3 => [d.hinge! < (d.a + d.b) / 2 ? d.b - 40 : d.a + 40, k > 0 ? yT : yB, zD - 14]), [0, k, 0], { on: k > 0 ? "T" : "B", name: "Bumper pad", len: 2, dia: 10 })),
        ],
        tools: ["screwdriver"],
      },
    );
  if (fold.length) {
    const flat = fold.flat();
    steps.push(
      {
        title: fold.length === 1 ? "Join the folding door's two panels" : "Join each folding door's two panels",
        detail: "Lay the panels face down on a rug. Two flat hinges across the join, four screws each, and two cabinet hinges on the outer panel.",
        add: flat.map((d) => d.id),
        fix: [
          fx("flatHinge", fold.flatMap((p) => hy.map((y): Vec3 => [seam(p), y, zD - 9])), [0, 0, 1], { len: 50, dia: 34 }),
          fx("screw", fold.flatMap((p) => hy.flatMap((y) => [-14, 14].flatMap((dx) => [-12, 12].map((dz): Vec3 => [seam(p) + dx, y + dz, zD - 9])))), [0, 0, 1], { len: 12, dia: 3.5 }),
          ...hingeFix(fold.map((p) => p[0]), 2),
        ],
        tools: ["screwdriver"],
        warnings: ["floor", "face"],
        from: Object.fromEntries(flat.map((d) => [d.id, [0, 0, 500] as Vec3])),
      },
      {
        title: "Fit the guide pins and guides",
        detail: "A guide pin in the top and bottom of each inner panel, at its free edge, and the matching guides screwed under the top and onto the bottom.",
        fix: SIDES.flatMap((k) => [
          fx("stud", fold.map((p): Vec3 => [free(p), dy + (k * dh) / 2, zD]), [0, -k, 0], { name: "Guide pin", len: 12, dia: 8 }),
          fx("clip", fold.map((p): Vec3 => [free(p), k > 0 ? yT : yB, zD]), [0, k, 0], { on: k > 0 ? "T" : "B", name: "Door guide", len: 14, dia: 30 }),
        ]),
        tools: ["screwdriver"],
      },
      {
        title: fold.length === 1 ? "Clip the folding door on" : "Clip the folding doors on",
        detail: "Screw the mounting plates in. One of you holds the door with its pins in the guides while the other presses the hinges onto the plates until they click.",
        fix: plateFix(fold.map((p) => p[0])),
        tools: ["screwdriver"],
        people: 2,
        warnings: ["two"],
      },
      {
        title: "Fit the knob and the bumpers",
        detail: "A knob near the free edge of each folding door, screwed from inside, and two soft bumpers where it closes.",
        fix: [
          fx("knob", fold.map((p): Vec3 => [free(p), dy, D / 2]), [0, 0, -1], { len: 20, dia: 16 }),
          ...SIDES.map((k) => fx("glide", fold.map((p): Vec3 => [free(p), k > 0 ? yT : yB, zD - 14]), [0, k, 0], { on: k > 0 ? "T" : "B", name: "Bumper pad", len: 2, dia: 10 })),
        ],
        tools: ["screwdriver"],
      },
    );
  }
  steps.push({ title: "Adjust the doors", detail: "Turn the hinge screws to move each door up, down, in or sideways until the gaps are even.", tools: ["screwdriver"] });
  return { parts, steps };
}

/* ---------- the high cabinet ---------- */

function high(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const legH = 133;
  const y0 = legH, yB = y0 + ST, yT = H - ST;
  const yF = yB + (yT - yB) * 0.44; // the fixed shelf
  const zBk = -D / 2 + 8 + BT / 2;
  const iw = W - 2 * ST;
  const z0 = zBk + BT / 2, z1 = D / 2 - 20;
  const bs = base(W, D, legH, 2);
  const parts: CustomPart[] = [
    ...SIDES.map((g) => P(`S${g}`, "Side panel", [ST, H - y0, D], [g * (W / 2 - ST / 2), (y0 + H) / 2, 0])),
    P("T", "Top panel", [iw, ST, D], [0, H - ST / 2, 0]),
    P("M", "Fixed shelf", [iw, ST, z1 - z0], [0, yF, (z0 + z1) / 2]),
    P("B", "Bottom panel", [iw, ST, D], [0, y0 + ST / 2, 0]),
    P("K0", "Back panel", [iw, yF - yB, BT], [0, (yB + yF) / 2, zBk]),
    P("K1", "Back panel", [iw, yT - yF, BT], [0, (yF + yT) / 2, zBk]),
    ...bs.parts,
  ];
  const lowShelves = [yB + (yF - yB) * 0.35, yB + (yF - yB) * 0.68];
  const upShelves = [yF + (yT - yF) * 0.34, yF + (yT - yF) * 0.67];
  parts.push(
    ...lowShelves.map((y, i) => P(`LS${i}`, "Shelf", [iw - 4, ST, z1 - z0 - 10], [0, y, (z0 + z1) / 2 - 5])),
    ...upShelves.map((y, i) => P(`GS${i}`, "Glass shelf", [iw - 4, 6, z1 - z0 - 10], [0, y, (z0 + z1) / 2 - 5], { material: "glass" })),
  );
  const zD = D / 2 - 9;
  const dl = { y: (yB + yF) / 2 + ST / 4, h: yF - yB + ST / 2 - 2 * GAP };
  parts.push(P("DL", "Door", [iw - 2 * GAP, dl.h - ST / 2, 18], [0, dl.y - ST / 4, zD], { material: "wood" }));
  const fr = 22, gw = iw - 2 * GAP, gh = yT - yF - ST / 2 - 2 * GAP;
  parts.push(
    P("DG", "Glass door", [gw, gh, 18], [0, yF + ST / 2 + GAP + gh / 2, zD], {
      pieces: [
        ...SIDES.map((k): PartPiece => ({ shape: "box", size: [fr, gh, 18], pos: [(k * (gw - fr)) / 2, 0, 0] })),
        ...SIDES.map((k): PartPiece => ({ shape: "box", size: [gw - 2 * fr, fr, 18], pos: [0, (k * (gh - fr)) / 2, 0] })),
        { shape: "box", size: [gw - 2 * fr, gh - 2 * fr, 4], pos: [0, 0, 0], material: "glass" },
      ],
    }),
  );
  const xh = -iw / 2 + 40; // hinges on the left
  const dlY = dl.y - ST / 4, dlH = dl.h - ST / 2;
  const dgY = yF + ST / 2 + GAP + gh / 2;
  const hingesOn = (id: string, y: number, h: number) => fx("hinge", [y - h * 0.38, y + h * 0.38].map((yy): Vec3 => [xh, yy, zD - 9]), [0, 0, 1], { on: id, len: 50, dia: 35 });
  const platesFor = (y: number, h: number) => fx("plate", [y - h * 0.38, y + h * 0.38].map((yy): Vec3 => [-iw / 2, yy, D / 2 - 50]), [-1, 0, 0], { on: "S-1", name: "Mounting plate", len: 4, dia: 30 });
  const sideBolts = (g: number) => [yB - ST / 2, yF, yT + ST / 2].flatMap((y) => [-D / 4, D / 4].map((z): Vec3 => [g * (W / 2 - ST), y, z]));
  // cam locks in the top's underside and in the upper faces of the shelf and the bottom
  const camsOn = (g: number): CustomFix[] =>
    (
      [
        [yT, 1, "T"],
        [yF + ST / 2, -1, "M"],
        [yB, -1, "B"],
      ] as const
    ).map(([y, d, on]) => fx("cam", [-D / 4, D / 4].map((z): Vec3 => [g * (W / 2 - ST - 34), y, z]), [0, d, 0], { on }));
  const pinsAt = (ys: number[], name: string, t: number) =>
    SIDES.map((g) => fx("pin", ys.flatMap((y) => [z0 + 40, z1 - 40].map((z): Vec3 => [g * (iw / 2), y - t / 2 - 3, z])), [g, 0, 0], { on: `S${g}`, name, len: 12, dia: 5 }));
  const clipPts = spread(yB + 60, yT - 60, 8).flatMap((y) => SIDES.map((g): Vec3 => [g * (iw / 2 - 30), y, zBk - BT / 2]));
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the sides",
      detail: "Lay one side on a rug, inside up. Six cam bolts in each side, screwed in by hand until they stop.",
      add: ["S-1"],
      fix: [fx("camScrew", sideBolts(-1), [-1, 0, 0], { on: "S-1" })],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Stand the top on the side", detail: "Its cam lock holes facing the inside.", add: ["T"], from: { T: [300, 0, 0] } },
    { title: "Stand the fixed shelf in", detail: "In the middle row of holes, front edge to the front.", add: ["M"], from: { M: [300, 0, 0] } },
    { title: "Stand the bottom on the side", detail: "At the other end, like the top.", add: ["B"], from: { B: [300, 0, 0] } },
    { title: "Lock them to the side", detail: "Six cam locks, turned clockwise.", fix: camsOn(-1), tools: ["screwdriver"] },
    {
      title: "Slide the back panels in",
      detail: "Down the grooves in the side, one into each section, until they sit in the grooves of the top, shelf and bottom.",
      add: ["K0", "K1"],
      from: { K0: [0, -500, 0], K1: [0, 500, 0] },
    },
    {
      title: "Lay the other side on together",
      detail: "With its six cam bolts already in. Line them up with the holes and press it down evenly.",
      add: ["S1"],
      fix: [fx("camScrew", sideBolts(1), [1, 0, 0], { on: "S1" })],
      people: 2,
      warnings: ["two"],
      tools: ["screwdriver"],
    },
    { title: "Lock the second side", detail: "Six more cam locks, turned clockwise.", fix: camsOn(1), tools: ["screwdriver"] },
    { title: "Clip the back panels in", detail: "Push the first half of each clip through its hole, then press the second half into it.", fix: [fx("clip", clipPts, [0, 0, 1], { name: "Back clip", len: 12, dia: 14 })] },
    {
      title: "Screw on the wall brackets and spacers",
      detail: "A bracket on the back edge of each side near the top, two screws each, and a spacer screwed into each bracket.",
      fix: [
        fx("bracket", SIDES.map((g): Vec3 => [g * (W / 2 - ST / 2), H - 60, -D / 2]), [0, 0, 1], { len: 40, dia: 30 }),
        fx("screw", pairs(SIDES.map((g): Vec3 => [g * (W / 2 - ST / 2), H - 60, -D / 2]), 1, 50), [0, 0, 1], { len: 12, dia: 4 }),
        fx("spacer", SIDES.map((g): Vec3 => [g * (W / 2 - ST / 2), H - 60, -D / 2 - 6]), [0, 0, 1], { name: "Wall spacer", len: 20, dia: 22 }),
      ],
      tools: ["screwdriver"],
      wall: false,
    },
    ...baseSteps(bs).slice(0, 3),
    {
      title: "Fix the base under the cabinet",
      detail: "Hold the base against the bottom panel, push an expanding plug through each plate and knock its pin in.",
      fix: [fx("clip", bs.plugs, [0, 1, 0], { on: "B", name: "Expanding plug", len: 16, dia: 10 }), fx("nail", bs.plugs, [0, 1, 0], { on: "B", name: "Expanding pin", len: 30, dia: 4 })],
      tools: ["hammer"],
    },
    {
      title: "Stand it up against the wall together",
      detail: "Lift it upright, turn the spacers out to the wall and level it with the feet.",
      pose: "+y",
      people: 2,
      warnings: ["two", "tip"],
      tools: ["level"],
    },
    {
      title: "Screw it to the wall",
      detail: "Through each wall bracket, then press a cap over the screw. Wall screws and plugs aren't included: use ones made for your wall.",
      fix: [
        fx("plug", SIDES.map((g): Vec3 => [g * (W / 2 - 40), H - 60, -D / 2 - 30]), [0, 0, -1], {}),
        fx("screw", SIDES.map((g): Vec3 => [g * (W / 2 - 40), H - 60, -D / 2 - 24]), [0, 0, -1], { len: 50, dia: 5, name: "Wall screw" }),
        fx("cap", SIDES.map((g): Vec3 => [g * (W / 2 - 40), H - 60, -D / 2 - 22]), [0, 0, -1], {}),
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    { title: "Push in the shelf pins", detail: "Eight pins for the glass shelves above, eight supports for the shelves below.", fix: [...pinsAt(upShelves, "Shelf pin", 6), ...pinsAt(lowShelves, "Shelf support", ST)] },
    {
      title: "Hang the lower door",
      detail: "Screw two hinges on the door and two plates in the side, then hook the hinges on and press until they click.",
      add: ["DL"],
      fix: [platesFor(dlY, dlH), hingesOn("DL", dlY, dlH)],
      tools: ["screwdriver"],
      from: { DL: [0, 0, 400] },
    },
    {
      title: "Hang the glass door",
      detail: "The same way: two hinges clicked onto the door, two plates in the side, then click it on.",
      add: ["DG"],
      fix: [platesFor(dgY, gh), hingesOn("DG", dgY, gh)],
      tools: ["screwdriver"],
      from: { DG: [0, 0, 400] },
    },
    {
      title: "Fit the knobs and the bumpers",
      detail: "A knob on each door, screwed from the inside, and four soft bumpers where the doors close.",
      fix: [
        fx("knob", [[iw / 2 - 30, dlY + dlH * 0.4, D / 2], [iw / 2 - 30, dgY - gh * 0.4, D / 2]], [0, 0, -1], { len: 20, dia: 16 }),
        fx("glide", [[iw / 2 - 30, yB, zD - 14], [iw / 2 - 30, yF + ST / 2, zD - 14]], [0, -1, 0], { name: "Bumper pad", len: 2, dia: 10 }),
        fx("glide", [[iw / 2 - 30, yF - ST / 2, zD - 14], [iw / 2 - 30, yT, zD - 14]], [0, 1, 0], { name: "Bumper pad", len: 2, dia: 10 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Put the shelves in", detail: "The wooden shelves below, the glass shelves above, each resting on four pins.", add: [...lowShelves.map((_, i) => `LS${i}`), ...upShelves.map((_, i) => `GS${i}`)] },
    { title: "Adjust the doors", detail: "Turn the hinge screws until both doors hang straight with even gaps.", tools: ["screwdriver"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["BOASTAD"],
  recipe(s) {
    if (/high cabinet/i.test(s.variant)) return high(s);
    const L = layout(s);
    return L ? low(L) : null;
  },
};
export default family;
