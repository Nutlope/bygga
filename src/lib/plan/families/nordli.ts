import type { PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rotate } from "../math";
import type { Family } from "./family";

/*
 * NORDLI chests, read from IKEA's manuals. A chest is a plinth, frames ("modules") standing on it side by side and
 * on top of each other, and a top across them all. Each frame is an open box: two sides with the drawer runners on
 * them, a back between them on dowels and cam locks, and on the 80 cm frames a metal rail across the top front. The
 * frame is built lying on one side. Every drawer is built on its front: cam bolts in the front, the sides stood on
 * it, the bottom slid in, the back pushed on with plastic clips, then catches and bumper pads. The plinth takes its
 * feet upside down, then dowels, metal strips and cam bolts; the frames lock onto it with the cams in their sides.
 * Stacked frames join with connecting bolts; the top goes on with dowels, cam bolts and cams. Two wall straps, and
 * the drawers go in last. Some chests also carry a clothes rail on the top (its own manual).
 */

const T = 16; // panel thickness
const ZB = -235, ZF = 214; // back and front edges of the frame sides (the bumper pads fill the gap to the fronts)
const ZFRONT = 218; // back face of the drawer fronts
const DD = 400; // drawer box depth behind the front
const ZBOX = ZFRONT - DD; // back end of the drawer sides
const ZRUN = ZFRONT - DD / 2;
const FEET = 14, PLINTH = 54, STRIP = 2; // plinth on its feet, metal strips on it
const Y0 = FEET + PLINTH + STRIP; // where the frames stand
const TOP = 20;

// fittings, sized so different ones stay apart in the list
const CAM: HwDef = HW.cam; // frame cams
const DCAM: HwDef = { kind: "cam", len: 11, dia: 12 }; // drawer cams
const BOLT: HwDef = HW.camScrew; // frame and drawer front cam bolts
const PBOLT: HwDef = { kind: "camScrew", len: 30, dia: 7 }; // plinth and top cam bolts
const LINK: HwDef = { kind: "camScrew", len: 70, dia: 7 }; // connecting bolt between stacked frames
const DOWEL: HwDef = HW.dowel;
const DDOWEL: HwDef = { kind: "dowel", len: 40, dia: 8 };
const CLIP: HwDef = { kind: "clip", len: 30, dia: 10 };
const CATCH: HwDef = { kind: "connector", len: 40, dia: 14 };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 14 };
const RUNNER: HwDef = { kind: "runner", len: DD, dia: 20 };
const RUNNER_SCREW: HwDef = HW.screwS;
const FOOT: HwDef = { kind: "foot", len: 10, dia: 30 };
const FOOT_PAD: HwDef = { kind: "glide", len: 4, dia: 26 };
const STRAP: HwDef = HW.strap;
const STRAP_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const WALL_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 40, dia: 8 };
const WASHER: HwDef = HW.washer;
const RAIL_BOLT: HwDef = { kind: "bolt", len: 30, dia: 6 };
const PLATE_BOLT: HwDef = { kind: "bolt", len: 16, dia: 6 };
const RAIL_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const RAIL_PAD: HwDef = { kind: "glide", len: 4, dia: 20 };
const HANGER: HwDef = { kind: "clip", len: 12, dia: 18 };

/* ---------- what each chest is made of ---------- */

type Kind = "40x45-1" | "40x45-2" | "80x45-2" | "80x23-2" | "40x68-3" | "80x68-3";
interface KindSpec {
  w: number;
  h: number;
  n: number; // drawers
  dowels: number; // in the back's edges
  backs: 1 | 2;
  rail: boolean;
  drawerDowels: boolean;
}
const KINDS: Record<Kind, KindSpec> = {
  "40x45-1": { w: 400, h: 450, n: 1, dowels: 4, backs: 1, rail: false, drawerDowels: true },
  "40x45-2": { w: 400, h: 450, n: 2, dowels: 4, backs: 1, rail: false, drawerDowels: true },
  "80x45-2": { w: 800, h: 450, n: 2, dowels: 4, backs: 1, rail: true, drawerDowels: true },
  "80x23-2": { w: 800, h: 230, n: 2, dowels: 2, backs: 1, rail: true, drawerDowels: false },
  "40x68-3": { w: 400, h: 680, n: 3, dowels: 8, backs: 1, rail: false, drawerDowels: true },
  "80x68-3": { w: 800, h: 680, n: 3, dowels: 8, backs: 2, rail: true, drawerDowels: true },
};

/** One chest on its own plinth: frames as [column (40 cm steps from the left), kind], stacked in that order. */
interface UnitDef {
  w: number; // cm
  mods: [number, Kind][];
  rail?: boolean;
}
type Layout = { units: UnitDef[]; base: boolean };

const one = (k: Kind): Layout => ({ units: [{ w: KINDS[k].w / 10, mods: [[0, k]] }], base: false });
const chest = (w: number, mods: [number, Kind][], rail = false): Layout => ({ units: [{ w, mods, rail }], base: true });
const set = (...units: UnitDef[]): Layout => ({ units, base: true });
const row = (c: number, k: Kind, n: number): [number, Kind][] => Array.from({ length: n }, (_, i) => [c + (i * KINDS[k].w) / 400, k]);

// read from each chest's manuals and IKEA's photo (left to right, bottom up)
const LAYOUTS: Record<string, Layout> = {
  "nordli-modular-chest-drawers-40-x-45": one("40x45-1"),
  "nordli-modular-chest-2-drawers-40-x-45": one("40x45-2"),
  "nordli-modular-chest-2-drawers-80-x-45": one("80x45-2"),
  "nordli-modular-chest-2-drawers-80-x-23": one("80x23-2"),
  "nordli-modular-chest-3-drawers-40-x-68": one("40x68-3"),
  "nordli-modular-chest-3-drawers-80-x-68": one("80x68-3"),
  "nordli-chest-2-drawers-80-x-54": chest(80, [[0, "80x45-2"]]),
  "nordli-chest-3-drawers-80-x-76": chest(80, [[0, "80x68-3"]]),
  "nordli-chest-8-drawers-80-x-99": chest(80, [...row(0, "40x68-3", 2), [0, "80x23-2"]]),
  "nordli-chest-5-drawers-80-x-122": chest(80, [[0, "80x68-3"], ...row(0, "40x45-1", 2)]),
  "nordli-chest-7-drawers-80-x-122": chest(80, [[0, "80x68-3"], ...row(0, "40x45-2", 2)]),
  "nordli-chest-6-drawers-80-x-145": chest(80, [[0, "80x68-3"], [0, "80x68-3"]]),
  "nordli-chest-3-drawers-80-x-192": chest(80, [[0, "80x68-3"]], true),
  "nordli-chest-4-drawers-80-x-192": chest(80, [[0, "80x45-2"], [0, "80x23-2"]], true),
  "nordli-chest-3-drawers-120-x-54": chest(120, row(0, "40x45-1", 3)),
  "nordli-chest-6-drawers-120-x-54": chest(120, row(0, "40x45-2", 3)),
  "nordli-chest-6-drawers-120-x-76": chest(120, [[0, "80x68-3"], [2, "40x68-3"]]),
  "nordli-chest-7-drawers-120-x-76": chest(120, [[0, "80x45-2"], [2, "40x68-3"], [0, "80x23-2"]]),
  "nordli-chest-6-drawers-120-x-99": chest(120, [[0, "80x45-2"], [2, "40x45-1"], [0, "40x45-1"], [1, "80x45-2"]]),
  "nordli-chest-8-drawers-120-x-99": chest(120, [[0, "80x45-2"], [2, "40x45-2"], [0, "40x45-2"], [1, "80x45-2"]]),
  "nordli-chest-12-drawers-120-x-145": chest(120, [
    [0, "40x45-2"],
    [1, "80x45-2"],
    [0, "80x45-2"],
    [2, "40x45-2"],
    [0, "40x45-2"],
    [1, "80x45-2"],
  ]),
  "nordli-chest-3-drawers-120-x-169": chest(120, row(0, "40x45-1", 3), true),
  "nordli-chest-4-drawers-160-x-54": chest(160, row(0, "80x45-2", 2)),
  "nordli-chest-6-drawers-160-x-54": chest(160, [[0, "40x45-1"], [1, "40x45-2"], [2, "40x45-2"], [3, "40x45-1"]]),
  "nordli-chest-8-drawers-160-x-54": chest(160, row(0, "40x45-2", 4)),
  "nordli-chest-9-drawers-160-x-76": chest(160, [[0, "40x68-3"], [1, "80x68-3"], [3, "40x68-3"]]),
  "nordli-chest-12-drawers-160-x-145": chest(160, [...row(0, "80x68-3", 2), ...row(0, "80x68-3", 2)]),
  "nordli-chest-6-drawers-160-x-169": chest(160, [[0, "40x45-1"], [1, "40x45-2"], [2, "40x45-2"], [3, "40x45-1"]], true),
  // two chests of 80 standing side by side, each on its own plinth with its own top
  "nordli-chest-8-drawers": {
    base: true,
    units: [
      { w: 80, mods: row(0, "40x45-1", 2) },
      { w: 80, mods: [...row(0, "40x45-2", 2), [0, "80x45-2"]] },
    ],
  },
  // no manual page: the frames each set is sold with (IKEA's package list), on 40 cm tops and plinths
  "nordli-chest-drawers-40-x-54": chest(40, [[0, "40x45-1"]]),
  "nordli-chest-2-drawers-40-x-54": chest(40, [[0, "40x45-2"]]),
  "nordli-chest-3-drawers-40-x-76": chest(40, [[0, "40x68-3"]]),
  "nordli-chest-2-drawers-40-x-99": chest(40, [[0, "40x45-1"], [0, "40x45-1"]]),
  "nordli-chest-4-drawers": chest(40, [[0, "40x45-2"], [0, "40x45-2"]]),
  // sets of chests of different heights side by side, the lower ones on the left as in IKEA's photo of the set above
  "nordli-chest-7-drawers-80-x-99": set({ w: 40, mods: [[0, "40x68-3"]] }, { w: 40, mods: [[0, "40x45-2"], [0, "40x45-2"]] }),
  "nordli-chest-5-drawers-120-x-76": set({ w: 80, mods: [[0, "80x45-2"]] }, { w: 40, mods: [[0, "40x68-3"]] }),
  "nordli-chest-5-drawers-120-x-169": set({ w: 40, mods: [[0, "40x68-3"]] }, { w: 80, mods: [[0, "80x45-2"]], rail: true }),
  "nordli-chest-9-drawers-160-x-99": set({ w: 40, mods: [[0, "40x45-2"]] }, { w: 80, mods: [[0, "80x68-3"]] }, { w: 40, mods: [[0, "40x45-2"], [0, "40x45-2"]] }),
  "nordli-chest-8-drawers-160-x-192": set({ w: 40, mods: [[0, "40x45-2"]] }, { w: 40, mods: [[0, "40x45-2"], [0, "40x45-1"]] }, { w: 80, mods: [[0, "80x68-3"]], rail: true }),
  "nordli-chest-8-drawers-160-x-169": set({ w: 80, mods: [...row(0, "40x45-2", 2), ...row(0, "40x45-1", 2)] }, { w: 80, mods: [[0, "80x45-2"]], rail: true }),
};

/* ---------- geometry ---------- */

interface Drawer {
  kind: Kind;
  x: number;
  base: number; // bottom of its slot
  fw: number;
  fh: number;
  bw: number; // box width
  sh: number; // box height
  ys: number; // underside of the box
  k: number; // cam bolts, clips and cams per side, front and back
  dowels: boolean;
  front: string;
  sides: [string, string];
  bottom: string;
  back: string;
}
interface Mod {
  kind: Kind;
  spec: KindSpec;
  x: number;
  y: number;
  sides: [string, string];
  backs: string[];
  rail?: string;
  drawers: Drawer[];
  under: Mod[]; // frames it stands on
}
interface Unit {
  x: number;
  W: number;
  mods: Mod[];
  top?: string;
  topY: number;
  plinth?: string;
  strips: string[];
  stripX: number[];
  rail?: { ups: [string, string]; bar: string; x: number; z: number; y: number; H: number };
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
const G = [-1, 1] as const;

type StepOpts = {
  title: string;
  detail?: string;
  tools?: ToolId[];
  pose?: Pose;
  scene?: string;
  kind?: StepKind;
  warnings?: WarnId[];
  people?: 1 | 2;
  repeat?: number;
  wall?: boolean;
};
const step = (b: PlanBuilder, o: StepOpts, body: () => void = () => {}) =>
  b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);

function build(b: PlanBuilder, s: ProductSpec, L: Layout) {
  const D = 470;
  const types = new Map<string, string>();
  const pt = (name: string, size: Vec3, material?: "fiber" | "metal") => {
    const k = `${name}|${size.map(Math.round).join("x")}`;
    let t = types.get(k);
    if (!t) {
      t = b.part(name, size, material ? { material } : {});
      types.set(k, t);
    }
    return t;
  };

  /* ---- place every part ---- */
  const totalW = L.units.reduce((a, u) => a + u.w * 10, 0);
  let left = -totalW / 2;
  const units: Unit[] = L.units.map((ud) => {
    const W = ud.w * 10;
    const cols = W / 400;
    const heights = range(cols).map(() => (L.base ? Y0 : 0));
    const mods: Mod[] = [];
    for (const [col, kind] of ud.mods) {
      const k = KINDS[kind];
      const span = k.w / 400;
      const y = Math.max(...heights.slice(col, col + span));
      const x = left + col * 400 + k.w / 2;
      const under = mods.filter((m) => m.y + m.spec.h === y && Math.abs(m.x - x) < (m.spec.w + k.w) / 2 - 1);
      for (let c = col; c < col + span; c++) heights[c] = y + k.h;
      const sideT = pt("Side panel", [T, k.h, ZF - ZB]);
      const sides = G.map((g) => b.place(sideT, [x + g * (k.w / 2 - T / 2), y + k.h / 2, (ZF + ZB) / 2])) as [string, string];
      const bw = (k.w - 2 * T) / k.backs - (k.backs > 1 ? 1 : 0);
      const backT = pt("Back panel", [bw, k.h, T]);
      const backs = range(k.backs).map((i) => b.place(backT, [k.backs === 1 ? x : x + (i ? 1 : -1) * (bw / 2 + 0.5), y + k.h / 2, ZB + T / 2]));
      const rail = k.rail ? b.place(pt("Front rail", [k.w - 2 * T, 24, 30], "metal"), [x, y + k.h - 12, 196]) : undefined;
      const slot = k.h / k.n;
      const drawers: Drawer[] = range(k.n).map((i) => {
        const base = y + i * slot;
        const fw = k.w - 3, fh = slot - 3;
        const dbw = k.w - 2 * T - 26;
        const sh = Math.max(50, fh - 60);
        const ys = base + 30;
        const front = b.place(pt("Drawer front", [fw, fh, T]), [x, base + slot / 2, ZFRONT + T / 2]);
        const sdT = pt("Drawer side", [12, sh, DD]);
        const dsides = G.map((g) => b.place(sdT, [x + g * (dbw / 2 - 6), ys + sh / 2, ZRUN])) as [string, string];
        const bottom = b.place(pt("Drawer bottom", [dbw - 24, 4, DD - 8], "fiber"), [x, ys + 12, ZRUN - 4]);
        const back = b.place(pt("Drawer back", [dbw, sh, T]), [x, ys + sh / 2, ZBOX - T / 2]);
        return { kind, x, base, fw, fh, bw: dbw, sh, ys, k: k.n === 1 ? 3 : 2, dowels: k.drawerDowels, front, sides: dsides, bottom, back };
      });
      mods.push({ kind, spec: k, x, y, sides, backs, rail, drawers, under });
    }
    const topY = Math.max(...heights);
    if (L.base && heights.some((h) => h !== topY)) throw new Error("NORDLI layout is not level");
    const ux = left + W / 2;
    const u: Unit = { x: ux, W, mods, topY, strips: [], stripX: [] };
    if (L.base) {
      u.plinth = b.place(pt("Plinth", [W - 4, PLINTH, 450]), [ux, FEET + PLINTH / 2, -10]);
      // a metal strip under each line of sides on the plinth
      const lines = [...new Set(mods.filter((m) => m.y === Y0).flatMap((m) => [m.x - m.spec.w / 2, m.x + m.spec.w / 2]).map(Math.round))].sort((a, c) => a - c);
      const stT = pt("Metal strip", [30, STRIP, 420], "metal");
      u.stripX = lines.map((x) => Math.min(Math.max(x, left + 15), left + W - 15));
      u.strips = u.stripX.map((x) => b.place(stT, [x, FEET + PLINTH + STRIP / 2, -10]));
      u.top = b.place(pt("Top", [W, TOP, D]), [ux, topY + TOP / 2, 0]);
    }
    if (ud.rail) {
      // the foot plates stand on felt pads on the top
      const H = s.size.h * 10 - topY - TOP - 4;
      const y = topY + TOP + 4;
      const z = ZB + 20;
      const upT = b.compound("Rail upright", [
        { shape: "box", size: [25, H - 6, 25], pos: [0, 6 + (H - 6) / 2, 0], material: "metal" },
        { shape: "box", size: [60, 6, 90], pos: [0, 3, 25], material: "metal" },
      ]);
      const ups = G.map((g) => b.place(upT.type, [ux + g * 380 + upT.mid[0], y + upT.mid[1], z + upT.mid[2]])) as [string, string];
      const barT = b.part("Clothes rail", [25, 735, 25], { shape: "cyl", material: "metal" });
      const bar = b.place(barT, [ux, y + H - 12.5, z], [0, 0, Math.PI / 2]);
      u.rail = { ups, bar, x: ux, z, y, H };
    }
    left += W;
    return u;
  });
  const mods = units.flatMap((u) => u.mods);
  const drawers = mods.flatMap((m) => m.drawers);

  /* ---- where the fittings go ---- */
  const xi = (m: Mod, g: number) => m.x + g * (m.spec.w / 2 - T); // inside face of a side
  const sx = (m: Mod, g: number) => m.x + g * (m.spec.w / 2 - T / 2); // side centre
  const sideOf = (m: Mod, g: number) => m.sides[g < 0 ? 0 : 1];
  const backOf = (m: Mod, g: number) => m.backs[m.backs.length === 1 || g < 0 ? 0 : 1];
  const zBack = ZB + T / 2;
  const boltY = (m: Mod) => [m.y + m.spec.h * 0.3, m.y + m.spec.h * 0.7];
  const dowelY = (m: Mod) => {
    const per = m.spec.dowels / 2;
    const f = per === 1 ? [0.5] : per === 2 ? [0.12, 0.88] : [0.08, 0.45, 0.55, 0.92];
    return f.map((k) => m.y + m.spec.h * k);
  };
  const frameFits = (m: Mod) => ({
    lowCams: G.flatMap((g) => [-80, 80].map((z): FitOpts => ({ on: sideOf(m, g), at: [xi(m, g), m.y + 14, z], dir: [g, 0, 0] }))),
    runners: m.drawers.flatMap((d) => G.map((g): FitOpts => ({ on: sideOf(m, g), at: [xi(m, g), d.base + 40, ZRUN], dir: [g, 0, 0], hole: false }))),
    runnerScrews: m.drawers.flatMap((d) =>
      G.flatMap((g) => [ZRUN - 160, ZRUN + 160].map((z): FitOpts => ({ on: sideOf(m, g), at: [xi(m, g) - g * 12, d.base + 40, z], dir: [g, 0, 0] }))),
    ),
    backBolts: G.flatMap((g) => boltY(m).map((y): FitOpts => ({ on: sideOf(m, g), at: [xi(m, g), y, zBack], dir: [g, 0, 0], mate: backOf(m, g), mateHole: 4 }))),
    dowels: G.flatMap((g) => dowelY(m).map((y): FitOpts => ({ on: backOf(m, g), at: [xi(m, g), y, zBack], dir: [g, 0, 0], mate: sideOf(m, g) }))),
    backCams: (g: number) => boltY(m).map((y): FitOpts => ({ on: backOf(m, g), at: [xi(m, g) - g * 28, y, ZB + T], dir: [0, 0, -1] })),
    railScrews: m.rail ? G.flatMap((g) => [188, 204].map((z): FitOpts => ({ on: m.rail!, at: [xi(m, g), m.y + m.spec.h - 12, z], dir: [g, 0, 0], mate: sideOf(m, g) }))) : [],
    topCams: G.flatMap((g) => [-80, 80].map((z): FitOpts => ({ on: sideOf(m, g), at: [xi(m, g), m.y + m.spec.h - 14, z], dir: [g, 0, 0] }))),
  });
  const drawerFits = (d: Drawer) => {
    const xs = (g: number) => d.x + g * (d.bw / 2 - 6);
    const mg = Math.min(20, d.sh / 4);
    const yk = spread(d.ys + mg, d.ys + d.sh - mg, d.k);
    const yd = d.k === 3 ? [d.ys + d.sh * 0.3, d.ys + d.sh * 0.7] : [d.ys + d.sh * 0.38, d.ys + d.sh * 0.62];
    const fy = d.base + (d.fh + 3) / 2;
    return {
      bolts: G.flatMap((g) => yk.map((y): FitOpts => ({ on: d.front, at: [xs(g), y, ZFRONT], dir: [0, 0, 1], mate: d.sides[g < 0 ? 0 : 1], mateHole: 4 }))),
      // sunk deep in the side so only 12 mm stands into the front
      dowels: d.dowels ? G.flatMap((g) => yd.map((y): FitOpts => ({ on: d.sides[g < 0 ? 0 : 1], at: [xs(g), y, ZFRONT - DDOWEL.len + 24], dir: [0, 0, -1], mate: d.front }))) : [],
      frontCams: G.flatMap((g) => yk.map((y): FitOpts => ({ on: d.sides[g < 0 ? 0 : 1], at: [xs(g) - g * 6, y, ZFRONT - 28], dir: [g, 0, 0] }))),
      clips: G.flatMap((g) => yk.map((y): FitOpts => ({ on: d.back, at: [xs(g), y, ZBOX - T], dir: [0, 0, 1], mate: d.sides[g < 0 ? 0 : 1] }))),
      backCams: G.flatMap((g) => yk.map((y): FitOpts => ({ on: d.sides[g < 0 ? 0 : 1], at: [xs(g) - g * 6, y, ZBOX + 28], dir: [g, 0, 0] }))),
      catches: G.map((g): FitOpts => ({ on: d.sides[g < 0 ? 0 : 1], at: [xs(g), d.ys, ZFRONT - 50], dir: [0, 1, 0] })),
      bumpers: G.flatMap((g) => G.map((v): FitOpts => ({ on: d.front, at: [d.x + g * (d.fw / 2 - 12), fy + v * (d.fh / 2 - 20), ZFRONT], dir: [0, 0, 1], hole: false }))),
    };
  };

  /* ---- the frames, one of each kind shown lying side by side ---- */
  const kinds = [...new Set(mods.map((m) => m.kind))];
  const shown = kinds.map((k) => mods.find((m) => m.kind === k)!);
  const nMods = mods.length;
  const repF = nMods > 1 ? nMods : undefined;
  const zOff = (i: number) => (i - (shown.length - 1) / 2) * 1300;
  // staged from the left edge, so every frame's left side lies on the floor when they are turned onto it
  const origin = (m: Mod): Vec3 => [m.x - m.spec.w / 2, m.y, 0];
  const rel = (m: Mod, i: number, k: string, shift: Vec3 = [0, 0, 0]): Vec3 => {
    const p = b.partItem(k).final.pos;
    const o = origin(m);
    return [p[0] - o[0] + shift[0], p[1] - o[1] + shift[1], p[2] - o[2] + zOff(i) + shift[2]];
  };
  const ff = shown.map(frameFits);
  const fstep = (o: StepOpts, body: () => void) => step(b, { scene: "frame", repeat: repF, ...o }, body);
  const many = (n: number, a: string, c: string) => (n === 1 ? a : c);
  const kindWords = kinds.length > 1 ? ` Build all ${nMods} frames this way; they differ only in size and in how many runners they take.` : "";

  fstep(
    {
      title: "Push the cam locks into both sides",
      detail: "Lay the sides on a rug, inside faces up. Two cams go into each, near the bottom end, arrows pointing at the edge." + kindWords,
      kind: "cams",
      pose: "+x",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.2);
      // the left side lies where the frame is built, the right one beside it, both inside face up (the frame lies on its left side)
      shown.forEach((m, i) => {
        b.stage(m.sides[0], rel(m, i, m.sides[0]), [0, 0, 0], [160, 0, 0]);
        b.stage(m.sides[1], [T / 2, m.spec.h / 2, (ZF + ZB) / 2 + zOff(i) + 640], [0, 0, Math.PI], [160, 0, 0]);
      });
      b.then(0.15);
      ff.forEach((f) => b.fits(CAM, f.lowCams, 0.08));
    },
  );
  fstep(
    {
      title: "Screw the runners onto the sides",
      detail: "Runners marked L go on the left side and R on the right, the wheel end to the front. Two screws hold each one.",
      tools: ["screwdriver"],
      kind: "runners",

      pose: "+x",
    },
    () => {
      ff.forEach((f) => b.fits(RUNNER, f.runners, 0.15));
      b.then(0.1);
      ff.forEach((f) => b.fits(RUNNER_SCREW, f.runnerScrews, 0.04));
    },
  );
  fstep(
    {
      title: "Screw the cam bolts into the sides",
      detail: "Two in each side, in the holes along the back edge. Turn them in by hand until they stop.",
      tools: ["screwdriver"],
      kind: "cams",

      pose: "+x",
    },
    () => ff.forEach((f) => b.fits(BOLT, f.backBolts, 0.08)),
  );
  fstep(
    {
      title: "Tap the dowels into the back and press it onto one side",
      detail: "Lay the left side down, runners up. Check the small holes in the back are at the bottom before you press it on.",
      tools: ["hammer"],
      pose: "+x",
      kind: "dowels",
    },
    () => {
      b.stagger(0.2);
      shown.forEach((m, i) => m.backs.forEach((k) => b.stage(k, rel(m, i, k), [0, 0, 0], [300, 0, 0])));
      b.then(0.15);
      ff.forEach((f) => b.fits(DOWEL, f.dowels, 0.06));
    },
  );
  fstep(
    { title: "Lock the cam locks in the back", detail: "Arrow towards the bolt, then turn each one clockwise until the back pulls tight against the side.", tools: ["screwdriver"], pose: "+x", kind: "cams" },
    () => ff.forEach((f) => b.fits(CAM, f.backCams(-1), 0.1)),
  );
  fstep(
    { title: "Lay the other side on and lock it", detail: "Runners facing in. Lower it onto the dowels and bolts, then turn its two cam locks in the back.", tools: ["screwdriver"], pose: "+x", kind: "cams" },
    () => {
      shown.forEach((m, i) => b.stage(m.sides[1], rel(m, i, m.sides[1]), [0, 0, 0], [300, 0, 0]));
      b.then(0.15);
      ff.forEach((f) => b.fits(CAM, f.backCams(1), 0.1));
    },
  );
  if (shown.some((m) => m.rail))
    fstep(
      {
        title: "Screw the rail across the top front",
        detail: kinds.some((k) => !KINDS[k].rail) ? "Only the 80 cm frames have one. Stand the frame up; two screws at each end." : "Stand the frame up. Two screws through each end into the sides.",
        tools: ["screwdriver"],
        pose: "+y",
        kind: "screws",
      },
      () => {
        shown.forEach((m, i) => {
          if (m.rail) b.stage(m.rail, rel(m, i, m.rail), [0, 0, 0], [0, 200, 0]);
        });
        b.then(0.15);
        ff.forEach((f) => b.fits(RUNNER_SCREW, f.railScrews, 0.08));
      },
    );

  /* ---- the drawers, one of each size shown lying on its front ---- */
  const dkinds = [...new Set(drawers.map((d) => `${d.kind}|${Math.round(d.fh)}`))];
  const dshown = dkinds.map((k) => drawers.find((d) => `${d.kind}|${Math.round(d.fh)}` === k)!);
  const nD = drawers.length;
  const repD = nD > 1 ? nD : undefined;
  const xOff = (() => {
    const ws = dshown.map((d) => d.fw + 250);
    const total = ws.reduce((a, c) => a + c, 0);
    let at = -total / 2;
    return ws.map((w) => {
      const c = at + w / 2;
      at += w;
      return c;
    });
  })();
  const dc = (d: Drawer): Vec3 => [d.x, d.ys + d.sh / 2, ZRUN];
  const dstage = (d: Drawer, i: number, k: string, from?: Vec3, shift: Vec3 = [0, 0, 0]) => {
    const p = b.partItem(k).final.pos;
    const c = dc(d);
    b.stage(k, [p[0] - c[0] + xOff[i] + shift[0], p[1] - c[1] + shift[1], p[2] - c[2] + shift[2]], [0, 0, 0], from);
  };
  const df = dshown.map(drawerFits);
  const dstep = (o: StepOpts, body: () => void) => step(b, { scene: "drawer", pose: "-z", repeat: repD, kind: "drawer", ...o }, body);
  const dword = nD === 1 ? "drawer" : "drawers";

  dstep(
    {
      title: "Screw the cam bolts into the drawer front",
      detail: `Lay the front face down on a rug, the grip notch away from you.${dshown.some((d) => d.k === 3) ? " The deep drawer takes three on each side, the others two." : ""}`,
      tools: ["screwdriver"],
      kind: "cams",
      warnings: ["face"],
    },
    () => {
      b.stagger(0.2);
      dshown.forEach((d, i) => dstage(d, i, d.front, [0, 0, -160]));
      b.then(0.15);
      df.forEach((f) => b.fits(BOLT, f.bolts, 0.06));
    },
  );
  const anyDowels = dshown.some((d) => d.dowels);
  if (anyDowels)
    dstep(
      {
        title: "Tap the dowels into the drawer sides",
        detail: dshown.every((d) => d.dowels) ? "Two into the front end of each side." : "Two into the front end of each side. The shallow drawers have none.",
        tools: ["hammer"],
        kind: "dowels",
      },
      () => {
        b.stagger(0.15);
        dshown.forEach((d, i) => d.sides.forEach((sd, j) => dstage(d, i, sd, [0, 0, -300], [(j ? 1 : -1) * 90, 0, -120])));
        b.then(0.15);
        df.forEach((f) => b.fits(DDOWEL, f.dowels, 0.06));
      },
    );
  dstep(
    { title: "Stand the sides on the front", detail: "Grooves facing each other and the triangle marks the same way. Push them onto the bolts and dowels.", kind: "join" },
    () => {
      b.stagger(0.2);
      dshown.forEach((d, i) => d.sides.forEach((sd) => dstage(d, i, sd, anyDowels ? undefined : [0, 0, -300])));
    },
  );
  dstep(
    { title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn each one clockwise until the side pulls tight.", tools: ["screwdriver"], kind: "cams" },
    () => df.forEach((f) => b.fits(DCAM, f.frontCams, 0.06)),
  );
  dstep({ title: "Slide in the drawer bottom", detail: "Smooth side in. It runs down the grooves until it reaches the front." }, () =>
    dshown.forEach((d, i) => dstage(d, i, d.bottom, [0, 0, -420])),
  );
  dstep(
    { title: "Press on the drawer back and push in the clips", detail: "The back covers the ends of the sides. Press the plastic clips through it into the sides.", kind: "join" },
    () => {
      dshown.forEach((d, i) => dstage(d, i, d.back, [0, 0, -260]));
      b.then(0.15);
      df.forEach((f) => b.fits(CLIP, f.clips, 0.08));
    },
  );
  dstep(
    { title: "Lock the cam locks at the back", detail: "Turn them clockwise until the back pulls tight.", tools: ["screwdriver"], kind: "cams" },
    () => df.forEach((f) => b.fits(DCAM, f.backCams, 0.06)),
  );
  dstep(
    { title: "Fit the runner catches and the bumper pads", detail: "A catch under each side near the front, and a pad in each corner of the front's inside face." },
    () => {
      df.forEach((f) => b.fits(CATCH, f.catches, 0.15));
      b.then(0.1);
      df.forEach((f) => b.fits(BUMPER, f.bumpers, 0.08));
    },
  );

  /* ---- the frames come together ---- */
  const frameKeys = (m: Mod) => [...m.sides, ...m.backs, ...(m.rail ? [m.rail] : [])];
  const presetFrame = (m: Mod) => {
    if (shown.includes(m)) return;
    const f = frameFits(m);
    const all: [HwDef, FitOpts[]][] = [
      [CAM, f.lowCams],
      [RUNNER, f.runners],
      [RUNNER_SCREW, f.runnerScrews],
      [BOLT, f.backBolts],
      [DOWEL, f.dowels],
      [CAM, [...f.backCams(-1), ...f.backCams(1)]],
      [RUNNER_SCREW, f.railScrews],
    ];
    for (const [def, l] of all) for (const o of l) b.preset(def, o);
  };
  const addFrame = (m: Mod, from: Vec3) => {
    b.stagger(0);
    for (const k of frameKeys(m)) b.add(k, from);
    presetFrame(m);
    b.wait(0.3);
  };

  if (!L.base) {
    const m = mods[0];
    step(b, { title: "Stand the frame up", detail: "It has no top or bottom of its own: it stands on a NORDLI plinth or on another frame.", kind: "standup" }, () => addFrame(m, [0, 200, 0]));
  }

  units.forEach((u, ui) => {
    if (!L.base) return;
    const which = units.length > 1 ? ` of the ${units.length === 2 ? (ui ? "right" : "left") : ["left", "middle", "right"][ui] ?? "next"} chest` : "";
    const footX = u.W > 800 ? [-(u.W / 2 - 60), 0, u.W / 2 - 60] : [-(u.W / 2 - 60), u.W / 2 - 60];
    const footAt = footX.flatMap((x) => [-180, 140].map((z): Vec3 => [u.x + x, 0, z]));
    const bottom = u.mods.filter((m) => m.y === Y0);
    step(
      b,
      {
        title: `Screw the feet into the plinth${which}`,
        detail: `Lay it upside down on a rug. Screw in all ${footAt.length} feet by hand and stick a felt pad under each.`,
        pose: ui === 0 ? "-y" : "+y",
        kind: "legs",
        warnings: ["floor"],
      },
      () => {
        // the second chest's plinth is turned over on its own, in front of the first chest
        if (ui === 0) b.add(u.plinth!, [0, -240, 0]);
        else b.stage(u.plinth!, [u.x, FEET + PLINTH / 2, D / 2 + 380], [Math.PI, 0, 0], [0, 200, 0]);
        b.then(0.15);
        b.fits(FOOT, footAt.map((p): FitOpts => ({ on: u.plinth!, at: [p[0], FEET, p[2]], dir: [0, 1, 0] })), 0.12);
        b.then(0.1);
        b.fits(FOOT_PAD, footAt.map((p): FitOpts => ({ on: u.plinth!, at: [p[0], FEET - FOOT.len, p[2]], dir: [0, 1, 0], hole: false })), 0.08);
      },
    );
    const plinthTop = FEET + PLINTH;
    step(
      b,
      { title: "Turn the plinth over and tap in the dowels", detail: "Two at each place a side will stand.", tools: ["hammer"], pose: "+y", kind: "dowels" },
      () => {
        if (ui > 0) {
          b.add(u.plinth!, [0, 0, 380]);
          b.then(0.15);
        }
        b.fits(
          DOWEL,
          bottom.flatMap((m) => G.flatMap((g) => [-190, 150].map((z): FitOpts => ({ on: u.plinth!, at: [sx(m, g), plinthTop, z], dir: [0, -1, 0], mate: sideOf(m, g) })))),
          0.06,
        );
      },
    );
    step(b, { title: "Press the metal strips onto the dowels", detail: many(u.strips.length, "Along the line where the sides will stand.", "One along each line where the sides will stand, from front to back."), kind: "join" }, () => {
      b.stagger(0.2);
      for (const k of u.strips) b.add(k, [0, 160, 0]);
    });
    step(
      b,
      { title: "Screw the cam bolts into the plinth", detail: "Through the holes in the strips. Turn them in by hand until they stop.", tools: ["screwdriver"], kind: "cams" },
      () =>
        b.fits(
          PBOLT,
          bottom.flatMap((m) => G.flatMap((g) => [-80, 80].map((z): FitOpts => ({ on: u.plinth!, at: [sx(m, g), plinthTop + STRIP, z], dir: [0, -1, 0], mate: sideOf(m, g), mateHole: 4 })))),
          0.06,
        ),
    );
    bottom.forEach((m, i) =>
      step(
        b,
        {
          title: i === 0 ? (bottom.length > 1 ? "Stand the first frame on the plinth" : "Stand the frame on the plinth") : "Stand the next frame beside it",
          detail: "Check the cam arrows point down at the bolts, lower it onto the dowels, then turn its four cam locks clockwise.",
          tools: ["screwdriver"],
          kind: "join",
        },
        () => addFrame(m, [0, 300, 0]),
      ),
    );
    // frames on frames, a level at a time
    const levels = [...new Set(u.mods.filter((m) => m.y > Y0).map((m) => m.y))].sort((a, c) => a - c);
    for (const y of levels) {
      const upper = u.mods.filter((m) => m.y === y);
      const lower = [...new Set(upper.flatMap((m) => m.under))];
      const links: FitOpts[] = [], dowels: FitOpts[] = [];
      for (const up of upper)
        for (const g of G) {
          const x = sx(up, g);
          for (const lo of up.under)
            for (const h of G) {
              if (Math.abs(sx(lo, h) - x) > 4) continue;
              links.push({ on: sideOf(lo, h), at: [sx(lo, h), y, 80], dir: [0, -1, 0], mate: sideOf(up, g), mateHole: 4 });
              dowels.push({ on: sideOf(lo, h), at: [sx(lo, h), y, -170], dir: [0, -1, 0], mate: sideOf(up, g) });
            }
        }
      step(
        b,
        {
          title: many(lower.length, "Fit the connecting bolts into the frame below", "Fit the connecting bolts into the frames below"),
          detail: "From the bag that came with each frame: a dowel and a connecting bolt in the top of each side, and four cam locks to hold them.",
          tools: ["screwdriver", "hammer"],
          kind: "cams",
        },
        () => {
          b.fits(DOWEL, dowels, 0.08);
          b.then(0.05);
          b.fits(LINK, links, 0.1);
          b.then(0.1);
          for (const lo of lower) b.fits(CAM, frameFits(lo).topCams, 0.06);
        },
      );
      step(
        b,
        {
          title: many(upper.length, "Lower the next frame on top and lock it", "Lower the next frames on top and lock them"),
          detail: "Onto the bolts and dowels, then turn the cam locks in both frames clockwise.",
          tools: ["screwdriver"],
          kind: "join",
        },
        () => upper.forEach((m) => addFrame(m, [0, 320, 0])),
      );
    }
    const topMods = u.mods.filter((m) => m.y + m.spec.h === u.topY);
    step(
      b,
      { title: "Tap the dowels into the tops of the sides", detail: "Two in the top end of every side.", tools: ["hammer"], kind: "dowels" },
      () => b.fits(DOWEL, topMods.flatMap((m) => G.flatMap((g) => [-190, 150].map((z): FitOpts => ({ on: sideOf(m, g), at: [sx(m, g), u.topY, z], dir: [0, -1, 0], mate: u.top })))), 0.06),
    );
    step(
      b,
      { title: "Screw the cam bolts into the top", detail: "Lay the top upside down on a rug, then turn the bolts in by hand.", tools: ["screwdriver"], kind: "cams", warnings: ["face"] },
      () => {
        b.stage(u.top!, [u.x, TOP / 2, D / 2 + 360], [Math.PI, 0, 0], [0, 200, 0]);
        b.then(0.15);
        b.fits(PBOLT, topMods.flatMap((m) => G.flatMap((g) => [-80, 80].map((z): FitOpts => ({ on: u.top!, at: [sx(m, g), u.topY, z], dir: [0, 1, 0], mate: sideOf(m, g), mateHole: 4 })))), 0.06);
      },
    );
    step(b, { title: "Lay the top on", detail: "Turn it over and lower it onto the dowels, flush at the back.", kind: "join" }, () => b.add(u.top!, [0, 260, 0]));
    step(
      b,
      { title: "Lock the top with the cam locks", detail: "From each frame's bag: two cams in the top of each side, turned clockwise until the top pulls down.", tools: ["screwdriver"], kind: "cams" },
      () => topMods.forEach((m) => b.fits(CAM, frameFits(m).topCams, 0.06)),
    );
    step(b, {
      title: "Level the chest with the feet",
      detail: "Stand it where it will go and turn the feet with the spanner until it stands level and steady.",
      tools: ["wrench", "level"],
      kind: "legs",
    });
    // the 40 cm top takes one strap in the middle, the wider ones two
    const sxs = (u.W <= 400 ? [0] : [-u.W / 4, u.W / 4]).map((x) => u.x + x);
    step(
      b,
      {
        title: "Fix it to the wall",
        detail: `${sxs.length === 1 ? "One strap, screwed" : "Two straps, each screwed"} to the top at the back and into the wall. Pick wall screws made for your wall if the ones in the bag don't suit it.`,
        tools: ["drill", "screwdriver", "pencil"],
        kind: "anchor",
        wall: true,
        warnings: ["wall", "tip"],
      },
      () => {
        // each strap lies on the top at the back and runs up the wall behind it
        const zs = ZB + 50;
        const ys = u.topY + TOP;
        b.fits(STRAP, sxs.map((x): FitOpts => ({ on: u.top!, at: [x, ys, zs], dir: [0, -1, 0], hole: false })), 0.2);
        b.then(0.1);
        b.fits(STRAP_SCREW, sxs.map((x): FitOpts => ({ on: u.top!, at: [x, ys + 1.4, zs + 30], dir: [0, -1, 0] })), 0.15);
        b.then(0.1);
        b.fits(WALL_PLUG, sxs.map((x): FitOpts => ({ at: [x, ys + 40, ZB], dir: [0, 0, -1] })), 0.1);
        b.then(0.05);
        b.fits(WASHER, sxs.flatMap((x) => [0, 1.6].map((dz): FitOpts => ({ at: [x, ys + 40, ZB + dz], dir: [0, 0, -1] }))), 0.06);
        b.then(0.05);
        b.fits(WALL_SCREW, sxs.map((x): FitOpts => ({ at: [x, ys + 40, ZB + 3.2], dir: [0, 0, -1] })), 0.1);
      },
    );
    if (u.rail) railSteps(b, u);
  });

  step(
    b,
    {
      title: nD === 1 ? "Hang the drawer on the runners" : `Hang all ${nD} ${dword} on the runners`,
      detail: "Pull the runners out, rest the drawer on them and push it in until the catches click. Open only one drawer at a time.",
      kind: "drawer",
      warnings: ["tip"],
    },
    () => {
      for (const d of drawers) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 520]);
        if (!dshown.includes(d)) {
          const f = drawerFits(d);
          const all: [HwDef, FitOpts[]][] = [
            [BOLT, f.bolts],
            [DDOWEL, f.dowels],
            [DCAM, f.frontCams],
            [CLIP, f.clips],
            [DCAM, f.backCams],
            [CATCH, f.catches],
            [BUMPER, f.bumpers],
          ];
          for (const [def, l] of all) for (const o of l) b.preset(def, o);
        }
        b.wait(0.18);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
}

/** The clothes rail that stands on the back of the top (its own manual): built lying down, then lifted on by two. */
function railSteps(b: PlanBuilder, u: Unit) {
  const r = u.rail!;
  const pivot: Vec3 = [r.x, r.y, r.z];
  const rot: Vec3 = [-Math.PI / 2, 0, 0];
  const flat = (k: string, from?: Vec3) => {
    const it = b.partItem(k);
    const p = rotate([it.final.pos[0] - pivot[0], it.final.pos[1] - pivot[1], it.final.pos[2] - pivot[2]], rot);
    const turned: Vec3 = it.final.rot.some((v) => v) ? it.final.rot : rot; // the rail is round, so it only moves
    b.stage(k, [p[0] + r.x, p[1] + 30, p[2] + 700], turned, from);
  };
  const ux = (g: number) => r.x + g * 380;
  const barY = r.y + r.H - 12.5;
  step(b, { title: "Stick the pads under the rail's foot plates", detail: "Lay both uprights on a rug, foot plates up.", scene: "rail", kind: "general", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    r.ups.forEach((k) => flat(k, [0, 160, 0]));
    b.then(0.15);
    b.fits(RAIL_PAD, G.flatMap((g) => [10, 50].map((dz): FitOpts => ({ on: r.ups[g < 0 ? 0 : 1], at: [ux(g), r.y, r.z + dz], dir: [0, 1, 0], hole: false }))), 0.1);
  });
  step(b, { title: "Bolt the rail to one upright", detail: "One Allen bolt through the upright into the end of the rail.", scene: "rail", tools: ["allen"], kind: "bolts" }, () => {
    flat(r.bar, [0, 160, 0]);
    b.then(0.15);
    b.fit(RAIL_BOLT, { on: r.ups[0], at: [ux(-1) - 12.5, barY, r.z], dir: [1, 0, 0], mate: r.bar });
  });
  step(b, { title: "Slide the hangers onto the rail", detail: "Both of them, before the second upright goes on.", scene: "rail", kind: "general" }, () =>
    b.fits(HANGER, [-150, 150].map((x): FitOpts => ({ on: r.bar, at: [r.x + x, barY + 12.5, r.z], dir: [0, -1, 0], hole: false })), 0.15),
  );
  step(b, { title: "Bolt on the other upright", detail: "Tighten both bolts now.", scene: "rail", tools: ["allen"], kind: "bolts" }, () =>
    b.fit(RAIL_BOLT, { on: r.ups[1], at: [ux(1) + 12.5, barY, r.z], dir: [-1, 0, 0], mate: r.bar }),
  );
  step(
    b,
    { title: "Lift the rail onto the back of the top", detail: "One holds it upright while the other bolts the foot plates tight.", tools: ["allen"], people: 2, kind: "join" },
    () => {
      b.stagger(0.1);
      for (const k of [...r.ups, r.bar]) b.add(k, [0, 300, 0]);
      b.then(0.15);
      b.fits(PLATE_BOLT, G.map((g): FitOpts => ({ on: r.ups[g < 0 ? 0 : 1], at: [ux(g), r.y + 40, r.z - 12.5], dir: [0, 0, 1] })), 0.15);
    },
  );
  step(b, { title: "Screw the foot plates to the top", detail: "Three screws through each plate.", tools: ["screwdriver"], kind: "screws" }, () =>
    b.fits(RAIL_SCREW, G.flatMap((g) => [-25, 5, 35].map((dz): FitOpts => ({ on: r.ups[g < 0 ? 0 : 1], at: [ux(g) + g * 18, r.y + 6, r.z + 25 + dz], dir: [0, -1, 0], mate: u.top }))), 0.1),
  );
}

/* ---------- the bed with storage (its own manual, and the drawers' own) ---------- */

/*
 * The bed is a low box with three drawers on each long side. Two long bottom boards on plastic feet are joined at
 * the head and foot by crosspieces; dividers and the two end panels stand on them on cam bolts. Two top boards run
 * along the long sides over the drawers, slat rails are screwed along their inner edges, short top boards close the
 * head and foot, and two roll-out slatted bases lie on the rails. The drawers are built on their fronts and hang on
 * runners screwed to the dividers and end panels, sticking in under the slats.
 */
const BT = 18; // bed boards
const BH = 300, BL = 2020; // IKEA: 30 cm high, 202 cm long
const BFOOT = 15;
const BY1 = BFOOT + BT; // top of the bottom boards
const BPH = BH - BY1 - BT; // end panels and dividers
const BASE_W = 560; // each bottom board, under one row of drawers
const TOP_W = 300; // each long top board
const END_D = 200; // the short top boards at the head and foot
const DIV_T = 25, DIV_D = 280;
const RAIL_W = 44, RAIL_H = 40;
const SLAT_T = 15;
const DR_D = 520, DR_H = 180, DR_SIDE = 12; // drawer box (51 cm inside)

const B_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 10 };
const B_LONG_DOWEL: HwDef = DDOWEL; // the thin dowels, the same as the drawers'
const B_CONNECT: HwDef = { kind: "camScrew", len: 44, dia: 7, name: "Connecting bolt" };
const B_FOOT: HwDef = { kind: "foot", len: BFOOT, dia: 60, name: "Plastic foot" };
const B_RUNNER: HwDef = { kind: "runner", len: 500, dia: 20 };
const B_RAIL_SCREW: HwDef = { kind: "screw", len: 80, dia: 6 };
const B_END_SCREW: HwDef = { kind: "screw", len: 55, dia: 5 };
const B_PUSH: HwDef = { kind: "screw", len: 30, dia: 4, name: "Push-in screw" };
const B_CAP: HwDef = HW.cap;
const B_GRIP: HwDef = { kind: "glide", len: 3, dia: 30, name: "Grip strip" };

function buildBed(b: PlanBuilder, W: number) {
  const L = BL;
  const part = (name: string, size: Vec3, material?: "fiber" | "wood") => b.part(name, size, material ? { material } : {});
  const zEnd = L / 2 - BT; // inner faces of the end panels
  const bay = (L - 2 * BT - 2 * DIV_T) / 3;
  const zDiv = bay / 2 + DIV_T / 2;
  const xDivIn = W / 2 - TOP_W; // inner edge of the dividers, under the inner edge of the top boards
  const xRail = W / 2 - TOP_W - RAIL_W / 2;
  const yRail = BH - BT - RAIL_H / 2;
  const Wm = W - 2 * TOP_W; // the opening between the top boards
  const zSlats = L / 2 - END_D; // the slatted bases fill the opening between the short top boards

  /* ---- place every part ---- */
  const baseT = part("Bottom board", [BASE_W, BT, L]);
  const bases = G.map((g) => b.place(baseT, [g * (W / 2 - BASE_W / 2), BFOOT + BT / 2, 0])) as [string, string];
  const crossT = part("Bottom crosspiece", [W - 2 * BASE_W, BT, 160]);
  const cross = G.map((e) => b.place(crossT, [0, BFOOT + BT / 2, e * (L / 2 - 80)])) as [string, string];
  const endT = part("End panel", [W, BPH, BT]);
  const ends = G.map((e) => b.place(endT, [0, BY1 + BPH / 2, e * (L / 2 - BT / 2)])) as [string, string];
  const divT = part("Divider", [DIV_D, BPH, DIV_T]);
  // dividers[side][end]
  const divs = G.map((g) => G.map((e) => b.place(divT, [g * (xDivIn + DIV_D / 2), BY1 + BPH / 2, e * zDiv]))) as [string, string][];
  const topT = part("Top board", [TOP_W, BT, L]);
  const tops = G.map((g) => b.place(topT, [g * (W / 2 - TOP_W / 2), BH - BT / 2, 0])) as [string, string];
  const railT = part("Slat rail", [RAIL_W, RAIL_H, L - 2 * BT], "wood");
  const rails = G.map((g) => b.place(railT, [g * xRail, yRail, 0])) as [string, string];
  const fillT = part("End top board", [Wm, BT, END_D]);
  const fills = G.map((e) => b.place(fillT, [0, BH - BT / 2, e * (L / 2 - END_D / 2)])) as [string, string];
  const nSl = 8, slatL = Wm - 4, slatZ = (i: number) => -zSlats / 2 + 50 + (i * (zSlats - 100)) / (nSl - 1);
  const slatT = b.compound("Slatted base", [
    ...range(nSl).map((i): PartPiece => ({ shape: "box", size: [slatL, SLAT_T, 60], pos: [0, 0, slatZ(i)], material: "wood" })),
    ...G.map((g): PartPiece => ({ shape: "box", size: [30, 2, zSlats - 40], pos: [g * (Wm / 4), -SLAT_T / 2 - 1, 0], material: "soft" })),
  ]);
  const slatY = BH - BT + SLAT_T / 2;
  const slats = G.map((e) => b.place(slatT.type, [slatT.mid[0], slatY + slatT.mid[1], e * (zSlats / 2) + slatT.mid[2]])) as [string, string];

  // each opening: its side, its two faces (z and the panel the face belongs to) and its drawer
  interface Bay { g: number; zc: number; lo: [number, string]; hi: [number, string]; front: string; sides: [string, string]; bottom: string; back: string }
  const bays: Bay[] = [];
  const frontT = part("Drawer front", [BT, BPH - 4, bay - 4]);
  const bw = bay - 26; // box width between the runners
  const dsideT = part("Drawer side", [DR_D, DR_H, DR_SIDE]);
  const dbotT = part("Drawer bottom", [DR_D - 8, 4, bw - 2 * DR_SIDE + 12], "fiber");
  const dbackT = part("Drawer back", [16, DR_H, bw]);
  const ys = BY1 + 20;
  for (const g of G)
    for (let i = 0; i < 3; i++) {
      const zLo = i === 0 ? -zEnd : i === 1 ? -zDiv + DIV_T / 2 : zDiv + DIV_T / 2;
      const zHi = i === 0 ? -zDiv - DIV_T / 2 : i === 1 ? zDiv - DIV_T / 2 : zEnd;
      const lo = i === 0 ? ends[0] : divs[g < 0 ? 0 : 1][i === 1 ? 0 : 1];
      const hi = i === 2 ? ends[1] : divs[g < 0 ? 0 : 1][i === 0 ? 0 : 1];
      const zc = (zLo + zHi) / 2;
      const xIn = g * (W / 2 - BT); // inside face of the front
      const front = b.place(frontT, [g * (W / 2 - BT / 2), BY1 + BPH / 2, zc]);
      const sides = G.map((h) => b.place(dsideT, [xIn - (g * DR_D) / 2, ys + DR_H / 2, zc + h * (bw / 2 - DR_SIDE / 2)])) as [string, string];
      const bottom = b.place(dbotT, [xIn - (g * (DR_D - 8)) / 2, ys + 12, zc]);
      const back = b.place(dbackT, [xIn - g * (DR_D + 8), ys + DR_H / 2, zc]);
      bays.push({ g, zc, lo: [zLo, lo], hi: [zHi, hi], front, sides, bottom, back });
    }

  /* ---- where the fittings go ---- */
  const sideOf = (g: number) => (g < 0 ? 0 : 1);
  const endOf = (e: number) => (e < 0 ? 0 : 1);
  const jointX = (g: number) => g * (W / 2 - BASE_W); // where a crosspiece meets a bottom board
  const zJoint = (e: number) => e * (L / 2 - 80);
  const divBoltX = (g: number) => [g * (xDivIn + 50), g * (xDivIn + DIV_D - 50)];
  const divDowelX = (g: number) => [g * (xDivIn + 110), g * (xDivIn + DIV_D - 110)];
  const endBoltX = (g: number) => [g * (W / 2 - 80), g * (W / 2 - BASE_W + 80)];
  const endDowelX = (g: number) => [g * (W / 2 - 200), g * (W / 2 - BASE_W + 200)];
  const topBoltX = (g: number) => [g * (W / 2 - 60), g * (W / 2 - TOP_W + 60)];
  const topDowelX = (g: number) => [g * (W / 2 - 120), g * (W / 2 - 180)];
  const fillBoltX = [-(Wm / 2 - 60), 0, Wm / 2 - 60];
  const fillDowelX = [-Wm / 4, Wm / 4];
  const zEndMid = (e: number) => e * (L / 2 - BT / 2);
  const each = <T,>(f: (g: number, e: number) => T[]) => G.flatMap((g) => G.flatMap((e) => f(g, e)));
  const baseY = BY1, topY = BH - BT;

  const feet = G.flatMap((g) => [-(L / 2 - 120), 0, L / 2 - 120].flatMap((z) => [BASE_W / 2 - 60, -(BASE_W / 2 - 60)].map((dx): FitOpts => ({ on: bases[sideOf(g)], at: [g * (W / 2 - BASE_W / 2) + dx, BFOOT, z], dir: [0, 1, 0] }))));
  const jointDowels = each((g, e) => [-60, 60].map((dz): FitOpts => ({ on: cross[endOf(e)], at: [jointX(g), BFOOT + BT / 2, zJoint(e) + dz], dir: [-g, 0, 0], mate: bases[sideOf(g)] })));
  const jointBolts = each((g, e) => [-20, 20].map((dz): FitOpts => ({ on: cross[endOf(e)], at: [jointX(g), BFOOT + BT / 2, zJoint(e) + dz], dir: [-g, 0, 0], mate: bases[sideOf(g)], mateHole: 4 })));
  const jointCams = each((g, e) =>
    [-20, 20].flatMap((dz) => [
      { on: cross[endOf(e)], at: [jointX(g) - g * 30, BY1, zJoint(e) + dz] as Vec3, dir: [0, -1, 0] as Vec3 },
      { on: bases[sideOf(g)], at: [jointX(g) + g * 30, BY1, zJoint(e) + dz] as Vec3, dir: [0, -1, 0] as Vec3 },
    ]),
  );
  const baseBolts = [
    ...each((g, e) => divBoltX(g).map((x): FitOpts => ({ on: bases[sideOf(g)], at: [x, baseY, e * zDiv], dir: [0, -1, 0], mate: divs[sideOf(g)][endOf(e)], mateHole: 4 }))),
    ...each((g, e) => endBoltX(g).map((x): FitOpts => ({ on: bases[sideOf(g)], at: [x, baseY, zEndMid(e)], dir: [0, -1, 0], mate: ends[endOf(e)], mateHole: 4 }))),
  ];
  const divDowels = each((g, e) => {
    const k = divs[sideOf(g)][endOf(e)];
    return divDowelX(g).flatMap((x): FitOpts[] => [
      { on: k, at: [x, baseY, e * zDiv], dir: [0, 1, 0], mate: bases[sideOf(g)] },
      { on: k, at: [x, topY, e * zDiv], dir: [0, -1, 0], mate: tops[sideOf(g)] },
    ]);
  });
  // cams in the dividers' and end panels' faces, towards the middle of the bed
  const divCams = (y: number) => each((g, e) => divBoltX(g).map((x): FitOpts => ({ on: divs[sideOf(g)][endOf(e)], at: [x, y, e * zDiv - DIV_T / 2], dir: [0, 0, 1] })));
  const endCams = (xs: (g: number) => number[], y: number) => each((g, e) => xs(g).map((x): FitOpts => ({ on: ends[endOf(e)], at: [x, y, e * zEnd], dir: [0, 0, e] })));
  const endDowels = each((g, e) => endDowelX(g).map((x): FitOpts => ({ on: bases[sideOf(g)], at: [x, baseY, zEndMid(e)], dir: [0, -1, 0], mate: ends[endOf(e)] })));
  const runnerAt = (bb: Bay, face: "lo" | "hi") => {
    const [z, k] = bb[face];
    const sgn = face === "lo" ? -1 : 1; // the way into the panel
    const xc = bb.g * (W / 2 - 20 - B_RUNNER.len / 2);
    return {
      runner: { on: k, at: [xc, BY1 + 22, z], dir: [0, 0, sgn], twist: Math.PI / 2, hole: false } as FitOpts,
      // both screws go where the short dividers are, near the front edge
      screws: [W / 2 - 60, W / 2 - 260].map((x): FitOpts => ({ on: k, at: [bb.g * x, BY1 + 22, z - sgn * 4], dir: [0, 0, sgn] })),
    };
  };
  const topDowels = each((g, e) => topDowelX(g).map((x): FitOpts => ({ on: ends[endOf(e)], at: [x, topY, zEndMid(e)], dir: [0, -1, 0], mate: tops[sideOf(g)] })));
  const topBolts = [
    ...each((g, e) => topBoltX(g).map((x): FitOpts => ({ on: tops[sideOf(g)], at: [x, topY, zEndMid(e)], dir: [0, 1, 0], mate: ends[endOf(e)], mateHole: 4 }))),
    ...each((g, e) => divBoltX(g).map((x): FitOpts => ({ on: tops[sideOf(g)], at: [x, topY, e * zDiv], dir: [0, 1, 0], mate: divs[sideOf(g)][endOf(e)], mateHole: 4 }))),
  ];
  const railDowels = G.flatMap((g) => [-(zSlats - 60), -60, 60, zSlats - 60].map((z): FitOpts => ({ on: rails[sideOf(g)], at: [g * xRail, topY, z], dir: [0, -1, 0], mate: slats[z < 0 ? 0 : 1] })));
  const railScrews = G.flatMap((g): FitOpts[] => [
    ...G.map((e): FitOpts => ({ on: rails[sideOf(g)], at: [g * (xRail - RAIL_W / 2), yRail, e * zDiv], dir: [g, 0, 0], mate: divs[sideOf(g)][endOf(e)] })),
    ...G.flatMap((e) => [-10, 10].map((dy): FitOpts => ({ on: ends[endOf(e)], at: [g * xRail, yRail + dy, e * (L / 2)], dir: [0, 0, -e], mate: rails[sideOf(g)] }))),
  ]);
  const fillBolts = G.flatMap((e) => fillBoltX.map((x): FitOpts => ({ on: fills[endOf(e)], at: [x, topY, zEndMid(e)], dir: [0, 1, 0], mate: ends[endOf(e)], mateHole: 4 })));
  const fillDowels = G.flatMap((e) => fillDowelX.map((x): FitOpts => ({ on: ends[endOf(e)], at: [x, topY, zEndMid(e)], dir: [0, -1, 0], mate: fills[endOf(e)] })));
  const fillCams = G.flatMap((e) => fillBoltX.map((x): FitOpts => ({ on: ends[endOf(e)], at: [x, topY - 30, e * zEnd], dir: [0, 0, e] })));
  const fillScrews = each((g, e) => [{ on: fills[endOf(e)], at: [g * xRail, BH, e * (L / 2 - END_D / 2 - 20)] as Vec3, dir: [0, -1, 0] as Vec3, mate: rails[sideOf(g)] }]);
  const grips = G.flatMap((e) => [1, 4, 7].flatMap((i) => [-Wm / 4, Wm / 4].map((x): FitOpts => ({ on: slats[endOf(e)], at: [x, BH - BT + SLAT_T, e * (zSlats / 2) + slatZ(i)], dir: [0, -1, 0], hole: false }))));
  const drawerFits = (bb: Bay) => {
    const g = bb.g;
    const xIn = g * (W / 2 - BT);
    const zs = (h: number) => bb.zc + h * (bw / 2 - DR_SIDE / 2);
    const yk = [ys + 40, ys + DR_H - 40];
    const xBack = xIn - g * (DR_D + 16);
    return {
      bolts: G.flatMap((h) => yk.map((y): FitOpts => ({ on: bb.front, at: [xIn, y, zs(h)], dir: [g, 0, 0], mate: bb.sides[h < 0 ? 0 : 1], mateHole: 4 }))),
      dowels: G.flatMap((h) => [ys + 70, ys + DR_H - 70].map((y): FitOpts => ({ on: bb.sides[h < 0 ? 0 : 1], at: [xIn - g * (DDOWEL.len - 24), y, zs(h)], dir: [-g, 0, 0], mate: bb.front }))),
      cams: G.flatMap((h) => yk.map((y): FitOpts => ({ on: bb.sides[h < 0 ? 0 : 1], at: [xIn - g * 28, y, zs(h) - h * 6], dir: [0, 0, h] }))),
      push: G.flatMap((h) => yk.map((y): FitOpts => ({ on: bb.back, at: [xBack, y, zs(h)], dir: [g, 0, 0], mate: bb.sides[h < 0 ? 0 : 1] }))),
      caps: G.flatMap((h) => yk.map((y): FitOpts => ({ on: bb.back, at: [xBack, y, zs(h)], dir: [g, 0, 0], hole: false }))),
    };
  };

  /* ---- the frame ---- */
  const bstep = (o: StepOpts, body: () => void = () => {}) => step(b, o, body);
  bstep({ title: "Tap the plastic feet into the bottom boards", detail: "Lay both long bottom boards upside down on a rug. Six feet go into each, in pairs across the board.", tools: ["hammer"], kind: "legs", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    G.forEach((g) => b.stage(bases[sideOf(g)], [g * (W / 2 - BASE_W / 2 + 200), BT / 2, 0], [0, 0, Math.PI], [0, 160, 0]));
    b.then(0.15);
    b.fits(B_FOOT, feet, 0.05);
  });
  bstep({ title: "Turn the long boards over and lay the crosspieces between them", detail: "The boards stand on their feet now. Leave a gap so the crosspieces can take their dowels.", kind: "general" }, () => {
    b.stagger(0.2);
    G.forEach((g) => b.stage(bases[sideOf(g)], [g * (W / 2 - BASE_W / 2 + 200), BFOOT + BT / 2, 0], [0, 0, 0]));
    b.then(0.1);
    G.forEach((e) => b.add(cross[endOf(e)], [0, 160, 0]));
  });
  bstep({ title: "Tap the dowels into the crosspieces", detail: "Two dowels go into each end of both crosspieces: use the thick short dowels.", tools: ["hammer"], kind: "dowels" }, () => b.fits(B_DOWEL, jointDowels, 0.06));
  bstep({ title: "Push the connecting bolts into the crosspieces", detail: "Two in each end, beside the dowels. Push them in until the collar sits on the edge.", kind: "cams" }, () => b.fits(B_CONNECT, jointBolts, 0.06));
  bstep({ title: "Push the long boards onto the crosspieces", detail: "Slide each long board onto the dowels and bolts until the joints close.", kind: "join" }, () => {
    b.stagger(0.2);
    G.forEach((g) => b.add(bases[sideOf(g)], [g * 200, 0, 0]));
  });
  bstep({ title: "Lock the joints with the cam locks", detail: "Two cams at every bolt, one on each side of the joint. Turn them clockwise until the boards pull tight.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, jointCams, 0.05));
  bstep({ title: "Screw the cam bolts into the bottom boards", detail: "Two at each place a divider or an end panel will stand. Turn them in by hand until they stop.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(BOLT, baseBolts, 0.04));
  bstep({ title: "Tap the dowels into the dividers", detail: "Lay the four dividers flat. Two short thick dowels in the bottom edge of each and two in the top edge.", tools: ["hammer"], kind: "dowels", warnings: ["floor"] }, () => {
    b.stagger(0.15);
    each((g, e) => [divs[sideOf(g)][endOf(e)]]).forEach((k, i) => {
      const g = i < 2 ? -1 : 1, e = i % 2 ? 1 : -1;
      b.stage(k, [g * (W / 2 + 260), DIV_T / 2, e * zDiv * 1.4], [Math.PI / 2, 0, 0]);
    });
    b.then(0.15);
    b.fits(B_DOWEL, divDowels, 0.05);
  });
  bstep({ title: "Stand the dividers on the bolts", detail: "Two on each long board, cam holes facing the head end. Press them down onto the dowels.", kind: "join" }, () => {
    b.stagger(0.2);
    each((g, e) => [divs[sideOf(g)][endOf(e)]]).forEach((k) => b.add(k, [0, 260, 0]));
  });
  bstep({ title: "Lock the dividers with the cam locks", detail: "Two in each divider, arrow towards the bolt, turned clockwise until it pulls down tight.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, divCams(BY1 + 30), 0.06));
  bstep({ title: "Tap the long dowels into the bottom boards", detail: "Use the long thin dowels: two at each end of both boards, where the end panels stand.", tools: ["hammer"], kind: "dowels" }, () => b.fits(B_LONG_DOWEL, endDowels, 0.06));
  bstep({ title: "Lower the end panels onto the bolts", detail: "One at the head and one at the foot, across the full width. Hold each one level as it goes down.", kind: "join", people: 2 }, () => {
    b.stagger(0.3);
    G.forEach((e) => b.add(ends[endOf(e)], [0, 300, 0]));
  });
  bstep({ title: "Lock the end panels with the cam locks", detail: "Four in each end panel, on the inside. Turn them clockwise.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, endCams(endBoltX, BY1 + 30), 0.05));
  for (const face of ["lo", "hi"] as const) {
    const r = bays.map((bb) => runnerAt(bb, face));
    bstep(
      {
        title: face === "lo" ? "Screw on the runners from the first drawer pack" : "Screw on the runners from the second drawer pack",
        detail: `${face === "lo" ? "One on the head side" : "One on the foot side"} of each drawer opening, the front end at the edge of the bed. Two screws hold each one.`,
        tools: ["screwdriver"],
        kind: "runners",
      },
      () => {
        b.fits(B_RUNNER, r.map((x) => x.runner), 0.12);
        b.then(0.1);
        b.fits(RUNNER_SCREW, r.flatMap((x) => x.screws), 0.04);
      },
    );
  }
  bstep({ title: "Tap the long dowels into the tops of the end panels", detail: "Two near each corner, for the long top boards.", tools: ["hammer"], kind: "dowels" }, () => b.fits(B_LONG_DOWEL, topDowels, 0.06));
  bstep({ title: "Screw the cam bolts into the long top boards", detail: "Lay both top boards upside down on a rug. Eight bolts in each, by hand until they stop.", tools: ["screwdriver"], kind: "cams", warnings: ["face"] }, () => {
    b.stagger(0.2);
    G.forEach((g) => b.stage(tops[sideOf(g)], [g * (W / 2 + 260), BT / 2, 0], [0, 0, Math.PI], [0, 160, 0]));
    b.then(0.15);
    b.fits(BOLT, topBolts, 0.04);
  });
  bstep({ title: "Turn the top boards over and lay them on", detail: "Onto the dowels and bolts of the end panels and dividers, flush with the outside edges.", kind: "join", people: 2 }, () => {
    b.stagger(0.3);
    G.forEach((g) => b.add(tops[sideOf(g)], [g * 200, 260, 0]));
  });
  bstep({ title: "Lock the top boards with the cam locks", detail: "Sixteen cams, in the tops of the end panels and dividers. Turn each one clockwise.", tools: ["screwdriver"], kind: "cams" }, () => {
    b.fits(CAM, endCams(topBoltX, topY - 30), 0.05);
    b.fits(CAM, divCams(topY - 30), 0.05);
  });
  bstep({ title: "Tap the dowels into the slat rails", detail: "Four short thick dowels along the top of each rail. They hold the slatted bases in place later.", tools: ["hammer"], kind: "dowels", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    G.forEach((g) => b.stage(rails[sideOf(g)], [g * (W / 2 + 200), RAIL_H / 2, 0], [0, 0, 0], [0, 160, 0]));
    b.then(0.15);
    b.fits(B_DOWEL, railDowels, 0.06);
  });
  bstep({ title: "Screw the slat rails along the top boards", detail: "Dowels up, along the inner edge of each top board. Six long screws per rail, into the dividers and the end panels.", tools: ["allen"], kind: "screws" }, () => {
    b.stagger(0.2);
    G.forEach((g) => b.add(rails[sideOf(g)], [0, 200, 0]));
    b.then(0.15);
    b.fits(B_RAIL_SCREW, railScrews, 0.08);
  });
  bstep({ title: "Screw the cam bolts into the short top boards", detail: "Lay them upside down. Three in each, by hand until they stop.", tools: ["screwdriver"], kind: "cams", warnings: ["face"] }, () => {
    b.stagger(0.2);
    G.forEach((e) => b.stage(fills[endOf(e)], [0, BT / 2, e * (L / 2 + 300)], [0, 0, Math.PI], [0, 160, 0]));
    b.then(0.15);
    b.fits(BOLT, fillBolts, 0.06);
  });
  bstep({ title: "Tap the dowels into the end panels", detail: "Two short thick dowels in the middle of each end panel's top edge.", tools: ["hammer"], kind: "dowels" }, () => b.fits(B_DOWEL, fillDowels, 0.08));
  bstep({ title: "Lay the short top boards on", detail: "Turn them over and lower them between the long top boards, at the head and the foot.", kind: "join" }, () => {
    b.stagger(0.3);
    G.forEach((e) => b.add(fills[endOf(e)], [0, 260, e * 200]));
  });
  bstep({ title: "Lock them with the cam locks", detail: "Three in each end panel, turned clockwise.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, fillCams, 0.08));
  bstep({ title: "Screw the short top boards to the rails", detail: "One screw down through each inside corner into the end of a rail.", tools: ["allen"], kind: "screws" }, () => b.fits(B_END_SCREW, fillScrews, 0.1));

  /* ---- the drawers, one shown lying on its front ---- */
  const shownBay = bays.find((bb) => bb.g > 0)!;
  const df = drawerFits(shownBay);
  const dc: Vec3 = [shownBay.g * (W / 2 - BT - DR_D / 2), ys + DR_H / 2, shownBay.zc];
  const dstage = (k: string, from?: Vec3, shift: Vec3 = [0, 0, 0]) => {
    const p = b.partItem(k).final.pos;
    b.stage(k, [p[0] - dc[0] + shift[0], p[1] - dc[1] + shift[1], p[2] - dc[2] + shift[2]], [0, 0, 0], from);
  };
  const up: Vec3 = [-200, 0, 0]; // from above, with the drawer lying on its front
  const dstep = (o: StepOpts, body: () => void) => step(b, { scene: "drawer", pose: "-x", repeat: bays.length, kind: "drawer", ...o }, body);
  dstep({ title: "Screw the cam bolts into the drawer front", detail: "Lay the front face down on a rug, grip notch away from you. Four bolts, by hand.", tools: ["screwdriver"], kind: "cams", warnings: ["face"] }, () => {
    dstage(shownBay.front, up);
    b.then(0.15);
    b.fits(BOLT, df.bolts, 0.08);
  });
  dstep({ title: "Tap the dowels into the drawer sides", detail: "Two into the front end of each side.", tools: ["hammer"], kind: "dowels" }, () => {
    b.stagger(0.15);
    shownBay.sides.forEach((k, j) => dstage(k, up, [-150, 0, (j ? 1 : -1) * 120]));
    b.then(0.15);
    b.fits(DDOWEL, df.dowels, 0.08);
  });
  dstep({ title: "Stand the sides on the front", detail: "Grooves facing each other. Push them onto the bolts and dowels.", kind: "join" }, () => {
    b.stagger(0.2);
    shownBay.sides.forEach((k) => dstage(k));
  });
  dstep({ title: "Lock the cam locks", detail: "Turn each one clockwise until the side pulls tight against the front.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(DCAM, df.cams, 0.08));
  dstep({ title: "Slide in the drawer bottom", detail: "Smooth side in. It runs down the grooves until it reaches the front." }, () => dstage(shownBay.bottom, [-420, 0, 0]));
  dstep({ title: "Lay the drawer back on", detail: "It covers the ends of the sides.", kind: "join" }, () => dstage(shownBay.back, [-260, 0, 0]));
  dstep({ title: "Hammer in the push-in screws", detail: "Two through each end of the back into the sides.", tools: ["hammer"], kind: "nails" }, () => b.fits(B_PUSH, df.push, 0.1));
  dstep({ title: "Press the caps over the screw heads", detail: "One on each of the four screws." }, () => b.fits(B_CAP, df.caps, 0.1));

  bstep({ title: "Pull out the runners and unlock them", detail: "Pull all twelve runners out to the end and flip the lock at the front of each one open.", kind: "runners" });
  step(
    b,
    { title: `Hang all ${bays.length} drawers on the runners`, detail: "Rest each drawer on its runners, push it in and press down at the front until both catches click.", kind: "drawer" },
    () => {
      for (const bb of bays) {
        b.stagger(0);
        for (const k of [bb.front, ...bb.sides, bb.bottom, bb.back]) b.add(k, [bb.g * 520, 0, 0]);
        if (bb !== shownBay) {
          const f = drawerFits(bb);
          const all: [HwDef, FitOpts[]][] = [
            [BOLT, f.bolts],
            [DDOWEL, f.dowels],
            [DCAM, f.cams],
            [B_PUSH, f.push],
            [B_CAP, f.caps],
          ];
          for (const [def, l] of all) for (const o of l) b.preset(def, o);
        }
        b.wait(0.18);
      }
    },
  );
  bstep({ title: "Lay the slatted bases on the rails", detail: "Unroll them across the opening, one from the head and one from the foot, straps down and over the dowels.", kind: "slats" }, () => {
    b.stagger(0.3);
    G.forEach((e) => b.add(slats[endOf(e)], [0, 200, 0]));
  });
  bstep({ title: "Press the grip strips onto the slats", detail: "Twelve of them, spread over both halves. They stop the mattress sliding.", kind: "slats" }, () => b.fits(B_GRIP, grips, 0.06));
}

const family: Family = {
  names: ["NORDLI"],
  build(b, s) {
    if (s.row) return false;
    if (s.slug?.startsWith("nordli-bed-frame-storage")) {
      // the frame comes in 140 and 160; the US Queen is the 160 frame
      const mw = s.bed?.mattressW ?? s.size.w;
      buildBed(b, mw >= 150 ? 1600 : 1400);
      return true;
    }
    const L = s.slug ? LAYOUTS[s.slug] : undefined;
    if (!L) return false;
    build(b, s, L);
    return true;
  },
};
export default family;
