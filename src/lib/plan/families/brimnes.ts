import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "../builder";
import { buildCustom } from "../custom";

/*
 * BRIMNES, read from IKEA's manuals.
 *
 * Every carcass is chipboard held with cam bolts screwed into the sides, wooden dowels and cam locks, with a
 * hardboard back nailed on (two halves on the wardrobes, three on the 3-door), plastic bar feet tapped into the bottom
 * edges, and the wall fixing in the box (brackets screwed under the top). Cabinets, wardrobes, the bookcase and
 * the TV benches are built lying on their backs; the chests lie on their left side, back panels slid down the
 * grooves. Every drawer is the same: cam bolts in the front, the sides stood on it with dowels and cam locks, the
 * bottom slid in, the back tapped on with plastic nails, then turned over for the runners, the back bar and the
 * handle. Doors take their hinges face down and clip onto plates screwed to the sides first.
 */

const T = 16;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

// fittings, sized so different ones stay apart in the list
const FOOT = { len: 10, dia: 34 }; // the plastic bar feet tapped into bottom edges
const LONG_SCREW = { len: 64, dia: 7 }; // connector screws turned with the Allen key
const LONG_PIN = { len: 60 }; // the long double-ended cam pins
const HINGE_SCREW = { len: 12, dia: 3.5 };
const RUNNER_SCREW = { len: 12, dia: 4 };
const BACK_NAIL = { len: 20, dia: 1.6 };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const WALL_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 35, dia: 8 };
const WASHER: HwDef = HW.washer;
const BRACKET: HwDef = { kind: "bracket", len: 90, dia: 30 };

/* ---------- a recipe and where its fittings go ---------- */

type Part = CustomPart;
type Box = { min: Vec3; max: Vec3 };
const boxOf = (p: Part): Box => ({ min: [0, 1, 2].map((k) => p.pos[k] - p.size[k] / 2) as Vec3, max: [0, 1, 2].map((k) => p.pos[k] + p.size[k] / 2) as Vec3 });
const unit = (k: number, s: number): Vec3 => {
  const v: Vec3 = [0, 0, 0];
  v[k] = s;
  return v;
};

/** Where two parts meet: the axis they touch along, the plane, and the patch they share. */
function touch(a: Part, b: Part) {
  const A = boxOf(a), B = boxOf(b);
  let n = -1, best = Infinity;
  for (const k of [0, 1, 2]) {
    const gap = Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]);
    const others = [0, 1, 2].filter((j) => j !== k);
    if (Math.abs(gap) <= 4 && others.every((j) => Math.min(A.max[j], B.max[j]) - Math.max(A.min[j], B.min[j]) > 2) && Math.abs(gap) < best) {
      best = Math.abs(gap);
      n = k;
    }
  }
  if (n < 0) throw new Error(`BRIMNES: ${a.id} and ${b.id} don't touch`);
  const aLow = a.pos[n] < b.pos[n];
  const plane = aLow ? (A.max[n] + B.min[n]) / 2 : (A.min[n] + B.max[n]) / 2;
  const [u, v] = [0, 1, 2].filter((j) => j !== n);
  const r = (k: number): [number, number] => [Math.max(A.min[k], B.min[k]), Math.min(A.max[k], B.max[k])];
  const ru = r(u), rv = r(v);
  const long = ru[1] - ru[0] >= rv[1] - rv[0] ? u : v;
  const short = long === u ? v : u;
  return { n, plane, long, short, rl: long === u ? ru : rv, rs: long === u ? rv : ru };
}

/** Points on the joint between a and b, at fractions along its long side, centred across it (or at `across`). */
function along(a: Part, b: Part, fr: number[], across = 0.5): Vec3[] {
  const c = touch(a, b);
  return fr.map((f) => {
    const p: Vec3 = [0, 0, 0];
    p[c.n] = c.plane;
    p[c.long] = c.rl[0] + (c.rl[1] - c.rl[0]) * f;
    p[c.short] = c.rs[0] + (c.rs[1] - c.rs[0]) * across;
    return p;
  });
}
const toward = (host: Part, c: ReturnType<typeof touch>) => unit(c.n, host.pos[c.n] > c.plane ? 1 : -1);

/** Dowels in the joint, pushed into `host` first. */
const dowels = (host: Part, other: Part, fr: number[], across?: number): CustomFix => ({ kind: "dowel", count: fr.length, at: along(host, other, fr, across), dir: toward(host, touch(host, other)), on: host.id, mate: other.id });
/** Cam bolts screwed into the face of `face`, their heads caught by cam locks in the edge of `edge`. */
const bolts = (face: Part, edge: Part, fr: number[], across?: number, len?: number): CustomFix => ({ kind: "camScrew", count: fr.length, at: along(face, edge, fr, across), dir: toward(face, touch(face, edge)), on: face.id, mate: edge.id, len });
/** Cam locks in `edge`, a little in from the joint, on its face towards `side` (+1 or -1 along its thinnest axis). */
function cams(face: Part, edge: Part, fr: number[], side: 1 | -1, across?: number): CustomFix {
  const c = touch(face, edge);
  const into = edge.pos[c.n] > c.plane ? 1 : -1;
  const t = [0, 1, 2].filter((k) => k !== c.n).reduce((a, k) => (edge.size[k] < edge.size[a] ? k : a), c.short);
  const E = boxOf(edge);
  const at = along(face, edge, fr, across).map((p) => {
    const q: Vec3 = [...p];
    q[c.n] += into * Math.min(32, edge.size[c.n] / 3);
    q[t] = side > 0 ? E.max[t] : E.min[t];
    return q;
  });
  return { kind: "cam", count: fr.length, at, dir: unit(t, -side), on: edge.id };
}
/** Screws through `through` into `into`, from its far face. */
function screws(through: Part, into: Part, fr: number[], hw: { len: number; dia: number }, across?: number, kind: CustomFix["kind"] = "screw"): CustomFix {
  const c = touch(through, into);
  const d = into.pos[c.n] > c.plane ? 1 : -1;
  const B = boxOf(through);
  const at = along(through, into, fr, across).map((p) => {
    const q: Vec3 = [...p];
    q[c.n] = d > 0 ? B.min[c.n] : B.max[c.n];
    return q;
  });
  return { kind, count: fr.length, at, dir: unit(c.n, d), on: through.id, mate: into.id, ...hw };
}
/** Fittings at given points on one part. */
const at = (kind: CustomFix["kind"], on: Part, pts: Vec3[], dir: Vec3, hw: { len?: number; dia?: number } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on: on.id, ...hw });

class Kit {
  parts: Part[] = [];
  steps: CustomStep[] = [];
  constructor(public W: number, public H: number, public D: number) {}
  part(id: string, name: string, size: Vec3, pos: Vec3, o: Partial<Part> = {}) {
    const p: Part = { id, name, size, pos, material: "board", ...o };
    this.parts.push(p);
    return p;
  }
  step(s: CustomStep) {
    // the custom builder takes ten fittings a step: share the rest over a second step with the same title
    const f = s.fix ?? [];
    if (f.length <= 10) this.steps.push(s);
    else for (let i = 0; i < f.length; i += 10) this.steps.push({ ...s, fix: f.slice(i, i + 10), add: i ? [] : s.add, title: i ? `${s.title} (continued)` : s.title });
  }
  get recipe(): CustomParams {
    return { parts: this.parts, steps: this.steps };
  }
}

/** The plan item placed for a recipe part (the custom builder keeps each part where the recipe put it). */
function keyOf(b: PlanBuilder, p: Part) {
  const it = b.items.find((x) => x.kind === "part" && x.final.pos.every((v, i) => Math.abs(v - p.pos[i]) < 0.5) && b.parts.find((t) => t.id === x.ref)?.name === p.name);
  if (!it) throw new Error(`BRIMNES: no item for ${p.id}`);
  return it.key;
}

type StepOpts = { title: string; detail?: string; tools?: ToolId[]; pose?: Pose; scene?: string; kind?: StepKind; warnings?: WarnId[]; people?: 1 | 2; repeat?: number; wall?: boolean };
const step = (b: PlanBuilder, o: StepOpts, body: () => void = () => {}) => b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);

/* ---------- the back, feet and wall fixing ---------- */

/** Hardboard back in one or more pieces side by side, nailed round the edges and into the panels behind. */
function backPanels(k: Kit, n: number, y0: number, y1: number, inset = 0) {
  const w = (k.W - 4 - 2 * inset) / n;
  return range(n).map((i) => k.part(`back${i}`, "Back panel", [w - (n > 1 ? 1 : 0), y1 - y0, 3], [-k.W / 2 + 2 + inset + w * (i + 0.5), (y0 + y1) / 2, -k.D / 2 - 1.5], { material: "fiber" }));
}

/** Feet tapped into the bottom edges of the given parts, near the front and back. */
function feet(parts: Part[], per: number, D: number): CustomFix[] {
  return parts.map((p) => at("glide", p, spread(-D / 2 + 50, D / 2 - 60, per).map((z): Vec3 => [p.pos[0], p.pos[1] - p.size[1] / 2, z]), [0, 1, 0], FOOT));
}

/** The fixing in the box: brackets screwed under the top at the back, then screws through them into the wall. */
function wallSteps(b: PlanBuilder, o: { top: string; y: number; xs: number[]; zb: number; inBox: boolean; tall: boolean }) {
  const screwsIn = !o.inBox ? " Wall screws and plugs aren't included: pick ones made for your wall." : "";
  step(
    b,
    {
      title: "Fix it to the wall",
      detail: `Stand it against the wall, mark through the brackets, drill and plug the holes, then screw it on with a washer on each screw.${screwsIn}`,
      tools: ["screwdriver", "drill", "pencil"],
      kind: "anchor",
      wall: true,
      people: o.tall ? 2 : 1,
      warnings: o.tall ? ["wall", "tip", "two"] : ["wall", "tip"],
    },
    () => {
      const plug: HwDef = { ...WALL_PLUG, notIncluded: !o.inBox };
      const ws: HwDef = { ...WALL_SCREW, notIncluded: !o.inBox };
      b.stagger(0.15);
      for (const x of o.xs) b.fit(plug, { at: [x, o.y + 40, o.zb - 2], dir: [0, 0, -1] });
      b.then(0.1);
      for (const x of o.xs) b.fit(WASHER, { at: [x, o.y + 40, o.zb + 3], dir: [0, 0, -1] });
      b.then(0.05);
      for (const x of o.xs) b.fit(ws, { at: [x, o.y + 40, o.zb + 4], dir: [0, 0, -1] });
    },
  );
  void o.top;
}

/** Brackets screwed to the top (with a washer under each screw), before the top goes on: a recipe step's fittings. */
function bracketFixes(top: Part, xs: number[], zb: number): CustomFix[] {
  const y = top.pos[1] + top.size[1] / 2;
  return [
    at("bracket", top, xs.map((x): Vec3 => [x, y, zb + 16]), [0, -1, 0], BRACKET),
    at("washer", top, xs.map((x): Vec3 => [x, y + 2, zb + 30]), [0, -1, 0], { len: WASHER.len, dia: WASHER.dia }),
    at("screw", top, xs.map((x): Vec3 => [x, y + 3, zb + 30]), [0, -1, 0], { len: BRACKET_SCREW.len, dia: BRACKET_SCREW.dia }),
  ];
}

/** One part type per name and size on a plan, so identical drawer and door parts share a letter. */
const typeCache = new WeakMap<PlanBuilder, Map<string, { type: string; mid: Vec3 }>>();
function typeOf(b: PlanBuilder, name: string, size: Vec3, o: { material?: "board" | "fiber" | "metal" } = {}) {
  const m = typeCache.get(b) ?? new Map();
  typeCache.set(b, m);
  const key = `p|${name}|${size.map(Math.round).join("x")}|${o.material ?? ""}`;
  if (!m.has(key)) m.set(key, { type: b.part(name, size, o), mid: [0, 0, 0] });
  return m.get(key)!.type;
}
function compoundOf(b: PlanBuilder, name: string, pieces: PartPiece[]) {
  const m = typeCache.get(b) ?? new Map();
  typeCache.set(b, m);
  const key = `c|${name}|${JSON.stringify(pieces)}`;
  if (!m.has(key)) m.set(key, b.compound(name, pieces));
  return m.get(key)!;
}

/* ---------- drawers ---------- */

interface DrawerBox {
  x: number;
  y0: number; // underside of the box
  w: number; // outside width of the box
  sh: number; // side height
  dd: number; // depth behind the front
  zf: number; // front face of the front
  fw: number;
  fh: number;
  fy: number; // middle of the front
  glass?: boolean;
  handle: number; // handle length
  flip?: boolean; // the front faces the back (-z): everything mirrored front to back
}
const Zp = (d: { flip?: boolean }, v: Vec3): Vec3 => (d.flip ? [v[0], v[1], -v[2]] : v);

function frontPieces(d: DrawerBox, ft: number): PartPiece[] {
  if (!d.glass) return [{ shape: "box", size: [d.fw, d.fh, ft], pos: [0, 0, 0] }];
  const r = Math.min(70, d.fh * 0.22);
  return [
    { shape: "box", size: [d.fw, r, ft], pos: [0, d.fh / 2 - r / 2, 0] },
    { shape: "box", size: [d.fw, r, ft], pos: [0, -d.fh / 2 + r / 2, 0] },
    { shape: "box", size: [r, d.fh - 2 * r, ft], pos: [-d.fw / 2 + r / 2, 0, 0] },
    { shape: "box", size: [r, d.fh - 2 * r, ft], pos: [d.fw / 2 - r / 2, 0, 0] },
    { shape: "box", size: [d.fw - 2 * r, d.fh - 2 * r, 4], pos: [0, 0, -2], material: "fiber" },
  ];
}

/**
 * BRIMNES drawers, as every manual builds them: one of each size is built on screen (with "do this for each"),
 * the others slide in at the end with their fittings already on.
 */
function drawers(b: PlanBuilder, list: DrawerBox[], o: { bumpers?: number; word?: string; plain?: boolean } = {}) {
  if (!list.length) return;
  const ft = 16, st = 12;
  const made = list.map((d) => {
    const zIn = d.zf - ft;
    const xs = d.w / 2 - st / 2;
    const zc = zIn - d.dd / 2;
    const { type, mid } = compoundOf(b, d.glass ? "Drawer front with glass" : "Drawer front", frontPieces(d, ft));
    const front = b.place(type, Zp(d, [d.x + mid[0], d.fy + mid[1], d.zf - ft / 2 + (d.flip ? -mid[2] : mid[2])]), d.flip ? [0, Math.PI, 0] : [0, 0, 0]);
    const sideT = typeOf(b, "Drawer side", [st, d.sh, d.dd]);
    const sides = [-1, 1].map((g) => b.place(sideT, Zp(d, [d.x + g * xs, d.y0 + d.sh / 2, zc])));
    const backT = typeOf(b, "Drawer back", [d.w - 2 * st, d.sh - 14, st]);
    const back = b.place(backT, Zp(d, [d.x, d.y0 + 14 + (d.sh - 14) / 2, zIn - d.dd + st / 2]));
    const botT = typeOf(b, "Drawer bottom", [d.w - 2 * st + 10, 3, d.dd - st - 4], { material: "fiber" });
    const bottom = b.place(botT, Zp(d, [d.x, d.y0 + 9, zc + st / 2 - 2]));
    // drawers on metal runners have a back bar between them; a plain drawer slides on plastic rails
    const bar = o.plain ? "" : b.place(typeOf(b, "Back bar", [d.w + 20, 10, 12], { material: "metal" }), Zp(d, [d.x, d.y0 + 6, zIn - d.dd - 6]));
    return { d, front, sides, back, bottom, bar, zIn, xs, zc };
  });
  type M = (typeof made)[number];
  const ROD: HwDef = { kind: "dowel", len: 30, dia: 8 };
  const NAIL: HwDef = { kind: "nail", len: 30, dia: 4 };
  const RUN = (m: M): HwDef => ({ kind: "runner", len: Math.round((m.d.dd - 20) / 10) * 10, dia: 20 });
  const HANDLE = (m: M): HwDef => ({ kind: "handle", len: m.d.handle, dia: 14 });
  const BUMP: HwDef = { kind: "glide", len: 2, dia: 9 };
  const SCR: HwDef = { kind: "screw", ...RUNNER_SCREW };
  const HSCR: HwDef = { kind: "screw", len: 25, dia: 4 };
  const per = <T>(m: M, fn: (g: -1 | 1, side: string) => T[]) => [...fn(-1, m.sides[0]), ...fn(1, m.sides[1])];
  const fitsOf = (m: M) => {
    const f = rawFits(m);
    const out = {} as typeof f;
    for (const key of Object.keys(f) as (keyof typeof f)[]) out[key] = f[key].map((x) => ({ ...x, at: Zp(m.d, x.at), dir: Zp(m.d, x.dir), twist: m.d.flip && x.twist === undefined ? undefined : x.twist }));
    return out;
  };
  const rawFits = (m: M) => {
    const { d, zIn, xs } = m;
    const nb = o.bumpers ?? 2;
    return {
      bolts: per(m, (g, sd) => [0.2, 0.8].map((f): FitOpts => ({ on: m.front, at: [d.x + g * xs, d.y0 + d.sh * f, zIn], dir: [0, 0, 1], mate: sd, mateHole: 4 }))),
      dowels: per(m, (g, sd) => [0.5].map((f): FitOpts => ({ on: sd, at: [d.x + g * xs, d.y0 + d.sh * f + (g < 0 ? 0 : 0), zIn], dir: [0, 0, -1], mate: m.front }))).flatMap((x) => [x, { ...x, at: [x.at[0], x.at[1] - d.sh * 0.14, x.at[2]] as Vec3 }]),
      cams: per(m, (g, sd) => [0.2, 0.8].map((f): FitOpts => ({ on: sd, at: [d.x + g * (xs - st / 2), d.y0 + d.sh * f, zIn - 30], dir: [g, 0, 0] }))),
      nails: per(m, (g, sd) => [0.35, 0.75].map((f): FitOpts => ({ on: sd, at: [d.x + g * (xs + st / 2), d.y0 + 14 + (d.sh - 14) * f, zIn - d.dd + st / 2], dir: [-g, 0, 0], mate: m.back }))),
      bumps: spread(d.x - d.fw / 2 + 30, d.x + d.fw / 2 - 30, nb).map((x): FitOpts => ({ on: m.front, at: [x, d.fy + d.fh / 2 - 20, zIn], dir: [0, 0, 1], hole: false })),
      runners: o.plain ? [] : per(m, (g, sd) => [{ on: sd, at: [d.x + g * xs, d.y0, zIn - 10 - (d.dd - 20) / 2], dir: [0, 1, 0], hole: false } as FitOpts]),
      runScrews: o.plain ? [] : per(m, (g, sd) => [zIn - 40, zIn - d.dd + 50].map((z): FitOpts => ({ on: sd, at: [d.x + g * (xs + st / 2 + 2), d.y0 + 8, z], dir: [-g, 0, 0] }))),
      barScrews: o.plain ? [] : [-1, 1].map((g): FitOpts => ({ on: m.bar, at: [d.x + g * (xs + 4), d.y0 + 6, zIn - d.dd - 12], dir: [0, 0, 1], mate: m.sides[g < 0 ? 0 : 1] })),
      handle: [{ on: m.front, at: [d.x, d.fy + (d.glass ? d.fh / 2 - 40 : d.fh * 0.25), d.zf], dir: [0, 0, -1], hole: false } as FitOpts],
      hScrews: [-1, 1].map((g): FitOpts => ({ on: m.front, at: [d.x + g * (d.handle / 2 - 12), d.fy + (d.glass ? d.fh / 2 - 40 : d.fh * 0.25), zIn], dir: [0, 0, 1] })),
    };
  };
  const kinds = new Map<string, M[]>();
  for (const m of made) {
    const key = `${Math.round(m.d.w)}x${Math.round(m.d.sh)}x${Math.round(m.d.fh)}x${m.d.glass ? 1 : 0}`;
    kinds.set(key, [...(kinds.get(key) ?? []), m]);
  }
  const shown = [...kinds.values()].map((g) => g[0]);
  const n = made.length;
  const word = o.word ?? "drawer";
  const rep = n > 1 ? n : undefined;
  const span = Math.max(...shown.map((m) => m.d.fw)) + 200;
  const offs = shown.map((_, i) => (i - (shown.length - 1) / 2) * span);
  const stage = (m: M, i: number, k: string, from?: Vec3) => {
    const it = b.partItem(k);
    const c: Vec3 = Zp(m.d, [m.d.x, m.d.y0 + m.d.sh / 2, m.zc]);
    b.stage(k, [it.final.pos[0] - c[0] + offs[i], it.final.pos[1] - c[1], it.final.pos[2] - c[2]], it.final.rot, from);
  };
  const fs = shown.map(fitsOf);
  const each = (fn: (m: M, i: number) => void) => shown.forEach(fn);
  const ds = (o2: StepOpts, body: () => void) => step(b, { scene: "drawer", repeat: rep, kind: "drawer", pose: "-z", ...o2 }, body);
  const the = n > 1 ? "each" : "the";

  ds({ title: `Screw the cam bolts into ${the} ${word} front`, detail: "Lay the front face down on a rug. Four bolts, by hand until they stop.", tools: ["screwdriver"], kind: "cams", warnings: ["face"] }, () => {
    each((m, i) => stage(m, i, m.front, [0, 0, -200]));
    b.then(0.15);
    each((_, i) => b.fits(HW.camScrew, fs[i].bolts, 0.08));
  });
  ds({ title: "Tap in the dowels and stand the sides on the front", detail: "Two dowels in the front end of each side. The grooves for the bottom face in and down.", tools: ["hammer"], kind: "dowels" }, () => {
    each((_, i) => b.fits(ROD, fs[i].dowels, 0.06));
    b.then(0.1);
    b.stagger(0.25);
    each((m, i) => m.sides.forEach((sd) => stage(m, i, sd, [0, 0, -260])));
  });
  ds({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls the side tight.", tools: ["screwdriver"], kind: "cams" }, () => each((_, i) => b.fits(HW.cam, fs[i].cams, 0.1)));
  ds({ title: `Slide in the ${word} bottom`, detail: "Smooth side up, along the grooves until it reaches the front.", kind: "drawer" }, () => each((m, i) => stage(m, i, m.bottom, [0, 0, -400])));
  ds({ title: "Tap on the back", detail: "It sits on the bottom between the sides. Two plastic nails through each side into it.", tools: ["hammer"], kind: "nails" }, () => {
    each((m, i) => stage(m, i, m.back, [0, 0, -240]));
    b.then(0.15);
    each((_, i) => b.fits(NAIL, fs[i].nails, 0.1));
  });
  ds({ title: "Stick the bumpers inside the front", detail: "Near the top corners, so the front closes quietly.", kind: "general" }, () => each((_, i) => b.fits(BUMP, fs[i].bumps, 0.15)));
  if (!o.plain) ds({ title: `Fit the runners to ${the} ${word}`, detail: "Turn it upside down. Each runner clips onto the bottom edge of its side, then two screws.", tools: ["screwdriver"], kind: "runners", pose: "-y" }, () => {
    each((m, i) => b.fits(RUN(m), fs[i].runners, 0.25));
    b.then(0.1);
    each((_, i) => b.fits(SCR, fs[i].runScrews, 0.08));
  });
  if (!o.plain) ds({ title: "Fit the back bar", detail: "It hooks into both runners behind the back. One screw at each end.", tools: ["screwdriver"], kind: "screws", pose: "-y" }, () => {
    each((m, i) => stage(m, i, m.bar, [0, -160, 0]));
    b.then(0.15);
    each((_, i) => b.fits(SCR, fs[i].barScrews, 0.12));
  });
  ds({ title: "Screw on the handle", detail: "Two screws from inside the front. Snug is enough.", tools: ["screwdriver"], kind: "screws", pose: "+y" }, () => {
    each((m, i) => b.fits(HANDLE(m), fs[i].handle, 0.2));
    b.then(0.05);
    each((_, i) => b.fits(HSCR, fs[i].hScrews, 0.12));
  });
  step(
    b,
    {
      title: n > 2 ? `Slide in all ${n} ${word}s` : n === 2 ? `Slide in both ${word}s` : `Slide in the ${word}`,
      detail: "Rest its runners on the ones in the frame and push it in until it closes.",
      kind: "drawer",
    },
    () => {
      for (const m of made) {
        b.stagger(0);
        for (const k of [m.front, ...m.sides, m.bottom, m.back, m.bar].filter(Boolean)) b.add(k, [0, 0, m.d.flip ? -520 : 520]);
        if (!shown.includes(m)) {
          const f = fitsOf(m);
          const all: [HwDef, FitOpts[]][] = [
            [HW.camScrew, f.bolts],
            [ROD, f.dowels],
            [HW.cam, f.cams],
            [NAIL, f.nails],
            [BUMP, f.bumps],
            [RUN(m), f.runners],
            [SCR, f.runScrews],
            [SCR, f.barScrews],
            [HANDLE(m), f.handle],
            [HSCR, f.hScrews],
          ];
          for (const [def, l] of all) for (const x of l) b.preset(def, x);
        }
        b.wait(0.22);
      }
    },
  );
}

/** Runners screwed to the inside of a wall for each drawer: a recipe fitting (two screws each, wheel at the front). */
function cabinetRunners(wall: Part, side: 1 | -1, ys: number[], zf: number, len: number): CustomFix[] {
  const x = wall.pos[0] + side * (wall.size[0] / 2);
  return [
    at("runner", wall, ys.map((y): Vec3 => [x + side * 5, y, zf - 10 - len / 2]), [-side, 0, 0], { len, dia: 20 }),
    at("screw", wall, ys.flatMap((y) => [zf - 40, zf - len + 30].map((z): Vec3 => [x + side * 10, y, z])), [-side, 0, 0], RUNNER_SCREW),
  ];
}

/* ---------- doors ---------- */

interface Door {
  x: number;
  w: number;
  y0: number;
  h: number;
  zf: number; // front face
  hinge: -1 | 1; // hinge edge: left or right
  ys: number[]; // hinge heights
  wall: Part; // panel the hinge plates are on
  glass?: boolean;
  mirror?: boolean;
  handleY: number;
  handle: number;
}

function doorPieces(d: Door, t: number): PartPiece[] {
  const r = 70;
  const frame: PartPiece[] = [
    { shape: "box", size: [d.w, r, t], pos: [0, d.h / 2 - r / 2, 0] },
    { shape: "box", size: [d.w, r, t], pos: [0, -d.h / 2 + r / 2, 0] },
    { shape: "box", size: [r, d.h - 2 * r, t], pos: [-d.w / 2 + r / 2, 0, 0] },
    { shape: "box", size: [r, d.h - 2 * r, t], pos: [d.w / 2 - r / 2, 0, 0] },
  ];
  const fill = d.glass || d.mirror ? "fiber" : "board";
  return [...frame, { shape: "box", size: [d.w - 2 * r, d.h - 2 * r, d.glass || d.mirror ? 4 : t - 6], pos: [0, 0, d.glass || d.mirror ? -2 : -3], material: fill }];
}

/** Hinge plates on the walls: a recipe fitting (two screws each), done in the manual before the frame is built. */
function plateFixes(ds: Door[]): CustomFix[] {
  const byWall = new Map<string, { wall: Part; pts: Vec3[]; dir: Vec3 }>();
  for (const d of ds) {
    const W = d.wall;
    const face = d.hinge < 0 ? W.pos[0] + W.size[0] / 2 : W.pos[0] - W.size[0] / 2; // the face towards the door's opening
    const dir: Vec3 = [d.hinge < 0 ? -1 : 1, 0, 0];
    const key = `${W.id}|${dir[0]}`;
    const e = byWall.get(key) ?? { wall: W, pts: [], dir };
    for (const y of d.ys) for (const dz of [-16, 16]) e.pts.push([face, y, W.pos[2] + W.size[2] / 2 - 37 + dz]);
    byWall.set(key, e);
  }
  return [...byWall.values()].map((e) => at("screw", e.wall, e.pts, e.dir, HINGE_SCREW));
}

function doors(b: PlanBuilder, ds: Door[], o: { bumpers: number; two?: boolean }) {
  const t = 18;
  const keys = ds.map((d) => {
    const { type, mid } = compoundOf(b, d.mirror ? "Door with mirror" : d.glass ? "Glass door" : "Door", doorPieces(d, t));
    return b.place(type, [d.x + mid[0], d.y0 + d.h / 2 + mid[1], d.zf - t / 2 + mid[2]]);
  });
  const HINGE: HwDef = HW.hinge;
  const HS: HwDef = { kind: "screw", ...HINGE_SCREW };
  const hingeAt = (d: Door, i: number) => d.ys.map((y): FitOpts => ({ on: keys[i], at: [d.x + d.hinge * (d.w / 2 - 22), y, d.zf - t], dir: [0, 0, 1], twist: d.hinge > 0 ? Math.PI : 0 }));
  const hingeScrews = (d: Door, i: number) => d.ys.flatMap((y) => [-1, 1].map((e): FitOpts => ({ on: keys[i], at: [d.x + d.hinge * (d.w / 2 - 22), y + e * 24, d.zf - t], dir: [0, 0, 1] })));
  const many = ds.length > 1;
  const span = Math.max(...ds.map((d) => d.w)) + 160;
  // all doors lie face down side by side in the door scene
  step(
    b,
    {
      title: many ? "Screw the hinges into the doors" : "Screw the hinges into the door",
      detail: `Lay ${many ? "the doors" : "the door"} face down on a rug. Press each hinge into its round hole, arm over the edge, and screw it on.`,
      tools: ["screwdriver"],
      scene: "door",
      pose: "-z",
      kind: "hinges",
      warnings: ["face"],
    },
    () => {
      b.stagger(0.2);
      ds.forEach((d, i) => b.stage(keys[i], [(i - (ds.length - 1) / 2) * span, d.h / 2, 0], [0, 0, 0], [0, 0, -200]));
      b.then(0.15);
      ds.forEach((d, i) => b.fits(HINGE, hingeAt(d, i), 0.12));
      b.then(0.1);
      ds.forEach((d, i) => b.fits(HS, hingeScrews(d, i), 0.05));
    },
  );
  step(
    b,
    {
      title: many ? "Hang the doors" : "Hang the door",
      detail: "Hook each hinge onto its plate and press until it clicks. Turn the hinge screws to even out the gaps.",
      tools: ["screwdriver"],
      kind: "doors",
      people: o.two ? 2 : 1,
    },
    () => {
      ds.forEach((d, i) => {
        b.stagger(0);
        b.add(keys[i], [d.hinge * -60, 0, 300]);
        b.wait(0.3);
      });
    },
  );
  step(b, { title: many ? "Screw on the handles" : "Screw on the handle", detail: "Two screws from the back of each door, on the edge away from the hinges.", tools: ["screwdriver"], kind: "screws" }, () => {
    const HANDLE = (d: Door): HwDef => ({ kind: "handle", len: d.handle, dia: 14 });
    ds.forEach((d, i) => b.fit(HANDLE(d), { on: keys[i], at: [d.x - d.hinge * (d.w / 2 - 45), d.handleY, d.zf], dir: [0, 0, -1], hole: false, twist: Math.PI / 2 }));
    b.then(0.05);
    ds.forEach((d, i) =>
      b.fits({ kind: "screw", len: 25, dia: 4 }, [-1, 1].map((e): FitOpts => ({ on: keys[i], at: [d.x - d.hinge * (d.w / 2 - 45), d.handleY + e * (d.handle / 2 - 12), d.zf - t], dir: [0, 0, 1] })), 0.1),
    );
  });
  step(b, { title: "Stick on the door bumpers", detail: "Inside the frame where each door closes, so it shuts quietly.", kind: "general" }, () => {
    const pts: FitOpts[] = [];
    for (let i = 0; i < o.bumpers; i++) {
      const d = ds[i % ds.length];
      const k = keys[i % ds.length];
      pts.push({ on: k, at: [d.x - d.hinge * (d.w / 2 - 25), i < ds.length ? d.y0 + 40 : d.y0 + d.h - 40, d.zf - t], dir: [0, 0, 1], hole: false });
    }
    b.fits({ kind: "glide", len: 2, dia: 9 }, pts, 0.15);
  });
}

/* ---------- wardrobes ---------- */

function wardrobe(b: PlanBuilder, s: ProductSpec, three: boolean) {
  const W = three ? 1170 : 780, H = 1900, D = 500;
  const k = new Kit(W, H, D);
  const P = 75; // plinth
  const xi = W / 2 - T;
  const L = k.part("L", "Side panel", [T, H, D], [-W / 2 + T / 2, H / 2, 0]);
  const R = k.part("R", "Side panel", [T, H, D], [W / 2 - T / 2, H / 2, 0]);
  const bot = k.part("bot", "Bottom panel", [2 * xi, T, D], [0, P + T / 2, 0]);
  const top = k.part("top", "Top panel", [2 * xi, T, D], [0, H - T / 2, 0]);
  const pf = k.part("pf", "Plinth", [2 * xi, P, T], [0, P / 2, D / 2 - 30 - T / 2]);
  const pb = k.part("pb", "Plinth", [2 * xi, P, T], [0, P / 2, -D / 2 + 20 + T / 2]);
  const inD = D - 20; // inner panels stop short of the front
  const zIn = -D / 2 + inD / 2;
  const dz = D / 2 + 2; // doors stand on the front edges
  const zb = -D / 2;

  if (!three) {
    // a hanging space with a small box in the bottom right: a divider, a fixed shelf over it, a loose shelf inside
    const yS = 760;
    const div = k.part("div", "Divider", [T, yS - (P + T), inD], [0, (P + T + yS) / 2, zIn]);
    const shelf = k.part("shelf", "Fixed shelf", [xi + T / 2, T, inD], [(xi - T / 2) / 2, yS + T / 2, zIn]);
    const loose = later("loose", "Shelf", [xi - T / 2 - 4, T, inD - 20], [(T / 2 + xi) / 2, (P + T + yS) / 2 + 20, zIn - 10]);
    const rail = later("rail", "Clothes rail", [2 * xi - 4, 25, 25], [0, H - T - 70, 0], { shape: "cyl", material: "metal" });
    const backs = backPanels(k, 2, 4, H);
    const doorH = H - P - 8;
    const ys = [P + 120, P + doorH / 2, H - 140];
    const ds: Door[] = [-1, 1].map((g) => ({ x: (g * W) / 4, w: W / 2 - 3, y0: P + 4, h: doorH, zf: dz + 18, hinge: g as -1 | 1, ys, wall: g < 0 ? L : R, handleY: P + doorH * 0.5, handle: 190 }));

    k.step({ title: "Screw the hinge plates onto the left side", detail: "Lay it on a rug, inside up. Three plates near the front edge, two screws each. The right side gets three too.", add: ["L"], fix: plateFixes([ds[0]]), tools: ["screwdriver"], pose: "+z", warnings: ["floor"] });
    k.step({
      title: "Screw the cam bolts into the left side",
      detail: "By hand until they stop: two for the bottom, one for each plinth. The right side takes six.",
      fix: [bolts(L, bot, [0.25, 0.75]), bolts(L, pf, [0.25], 0.3), bolts(L, pb, [0.25], 0.3)],
      tools: ["screwdriver"],
    });
    k.step({ title: "Push the bottom onto the left side", detail: "Lay the side on its back edge on the rug. Dowels in, then press the bottom onto them, cam lock holes up.", add: ["bot"], fix: [dowels(L, bot, [0.12, 0.5, 0.88])], tools: ["hammer"], pose: "+z", warnings: ["floor"] });
    k.step({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn clockwise until the bottom pulls tight.", fix: [cams(L, bot, [0.25, 0.75], 1)], tools: ["screwdriver"] });
    k.step({ title: "Tap the dowels into the divider and the fixed shelf", detail: "Ten in all, into the holes along their edges.", fix: [dowels(div, bot, [0.12, 0.5, 0.88]), dowels(div, shelf, [0.1, 0.37, 0.63, 0.9]), dowels(shelf, R, [0.1, 0.37, 0.63])], tools: ["hammer"] });
    k.step({ title: "Fit the cam fittings for the shelf joint", detail: "Press two cam locks into the shelf, screw the two long pins and two cam bolts into the top of the divider.", fix: [cams(div, shelf, [0.2, 0.8], 1), at("camScrew", div, along(div, shelf, [0.2, 0.8]), [0, -1, 0], LONG_PIN), bolts(div, shelf, [0.4, 0.6])], tools: ["screwdriver"] });
    k.step({ title: "Join the shelf to the divider", detail: "Push the shelf onto the pins and bolts, then turn all four cam locks until it pulls tight.", add: ["div", "shelf"], fix: [cams(div, shelf, [0.4, 0.6], 1), cams(shelf, div, [0.2, 0.8], 1)], tools: ["screwdriver"] });
    k.step({ title: "Screw the divider to the bottom", detail: "Two long connector screws up through the bottom into the divider, with the Allen key.", fix: [screws(bot, div, [0.25, 0.75], LONG_SCREW, 0.5, "screw")], tools: ["allen"] });
    k.step({ title: "Tap the dowels into the plinths and push them on", detail: "One in each end. Both plinths go under the bottom, one at the front and one at the back.", add: ["pf", "pb"], fix: [dowels(pf, L, [0.8], 0.7), dowels(pb, L, [0.8], 0.7), dowels(pf, R, [0.8], 0.7), dowels(pb, R, [0.8], 0.7)], tools: ["hammer"] });
    k.step({ title: "Prepare the right side", detail: "Three hinge plates and six cam bolts, as on the left, plus two for the fixed shelf.", add: ["R"], fix: [...plateFixes([ds[1]]), bolts(R, bot, [0.25, 0.75]), bolts(R, pf, [0.25], 0.3), bolts(R, pb, [0.25], 0.3), bolts(R, shelf, [0.3, 0.7])], tools: ["screwdriver"] });
    k.step({ title: "Lay the right side on together", detail: "Tap its dowels into the bottom and the shelf first, then lower it so every bolt finds its hole.", fix: [dowels(bot, R, [0.12, 0.5, 0.88]), dowels(shelf, R, [0.9])], people: 2, tools: ["hammer"] });
    k.step({ title: "Lock the cam locks", detail: "Eight of them: in the bottom, the plinths and the fixed shelf.", fix: [cams(R, bot, [0.25, 0.75], 1), cams(L, pf, [0.25], -1, 0.3), cams(L, pb, [0.25], 1, 0.3), cams(R, pf, [0.25], -1, 0.3), cams(R, pb, [0.25], 1, 0.3), cams(R, shelf, [0.3, 0.7], 1)], tools: ["screwdriver"] });
    k.step({ title: "Prepare the top", detail: "Tap the two door stops into its underside at the front, then screw in its four cam bolts.", fix: [at("clip", top, [-W / 4, W / 4].map((x): Vec3 => [x, H - T, D / 2 - 20]), [0, 1, 0], { len: 12, dia: 10 }), bolts(top, L, [0.25, 0.75]), bolts(top, R, [0.25, 0.75])], tools: ["hammer", "screwdriver"] });
    k.step({ title: "Push the top on", detail: "Dowels into the sides, then press the top onto them and lock its four cam locks.", add: ["top"], fix: [dowels(L, top, [0.12, 0.5, 0.88]), dowels(R, top, [0.12, 0.5, 0.88]), cams(L, top, [0.25, 0.75], 1, 0.5), cams(R, top, [0.25, 0.75], -1, 0.5)], tools: ["hammer", "screwdriver"] });
    k.step({ title: "Turn it over onto its front together", detail: "Check it is square: both diagonals the same.", pose: "-z", people: 2, check: "square" });
    k.step({ title: "Nail on the back panels", detail: "The two halves meet down the middle. Nails every 15 cm round the edges and into the bottom, the shelf and the divider.", add: backs.map((p) => p.id), fix: [{ kind: "nail", count: 40, to: backs.map((p) => p.id), ...BACK_NAIL }], tools: ["hammer"] });
    k.step({ title: "Tap in the feet", detail: "Two plastic feet into the bottom edge of each side.", fix: feet([L, R], 2, D), tools: ["hammer"] });
    k.step({ title: "Screw the wall brackets onto the top", detail: "Two brackets at the back, one screw and washer each.", fix: bracketFixes(top, [-W / 2 + 120, W / 2 - 120], zb), tools: ["screwdriver"] });
    k.step({ title: "Stand it up together", detail: "Lift it from the top end, don't drag it.", pose: "+y", people: 2, warnings: ["two"] });
    buildCustom(b, { ...s, custom: k.recipe });
    wallSteps(b, { top: keyOf(b, top), y: H - T - 30, xs: [-W / 2 + 120, W / 2 - 120], zb, inBox: true, tall: true });
    finishWardrobe(b, rail, [{ part: loose, pins: 4 }]);
    doors(b, ds, { bumpers: 2, two: false });
    return true;
  }

  // three doors: a full-height divider two thirds across, a fixed shelf in the right section
  const xD = W / 2 - W / 3 - T / 2;
  const div = k.part("div", "Divider", [T, H - P - 2 * T, inD], [xD, (P + T + H - T) / 2, zIn]);
  const yS = 1000;
  const shelf = k.part("shelf", "Fixed shelf", [xi - (xD + T / 2), T, inD], [(xD + T / 2 + xi) / 2, yS, zIn]);
  const loose = [
    later("s0", "Shelf", [xD - T / 2 + xi - 4, T, inD - 20], [(-xi + xD - T / 2) / 2, 360, zIn - 10]),
    later("s1", "Shelf", [xi - xD - T / 2 - 4, T, inD - 20], [(xD + T / 2 + xi) / 2, 500, zIn - 10]),
    later("s2", "Shelf", [xi - xD - T / 2 - 4, T, inD - 20], [(xD + T / 2 + xi) / 2, 1450, zIn - 10]),
  ];
  // loose shelves of the left and right sections differ in width
  const rail = later("rail", "Clothes rail", [xD - T / 2 + xi - 4, 25, 25], [(-xi + xD - T / 2) / 2, H - T - 70, 0], { shape: "cyl", material: "metal" });
  const backs = backPanels(k, 3, 4, H);
  const doorH = H - P - 8;
  const ys = [P + 120, P + doorH / 2, H - 140];
  const dw = W / 3 - 3;
  const ds: Door[] = [
    { x: -W / 3, w: dw, y0: P + 4, h: doorH, zf: dz + 18, hinge: -1, ys, wall: L, handleY: P + doorH * 0.5, handle: 190 },
    { x: 0, w: dw, y0: P + 4, h: doorH, zf: dz + 18, hinge: 1, ys, wall: div, mirror: true, handleY: P + doorH * 0.5, handle: 190 },
    { x: W / 3, w: dw, y0: P + 4, h: doorH, zf: dz + 18, hinge: 1, ys, wall: R, handleY: P + doorH * 0.5, handle: 190 },
  ];
  const angles = spread(-xi + 120, xi - 120, 3);

  k.step({ title: "Screw two cam bolts into the divider", detail: "Lay it on a rug. They hold the fixed shelf.", fix: [bolts(div, shelf, [0.3, 0.7])], tools: ["screwdriver"], pose: "+z", warnings: ["floor"] });
  k.step({ title: "Push the fixed shelf onto the divider", detail: "Two dowels, then lock its two cam locks.", add: ["shelf"], fix: [dowels(div, shelf, [0.12, 0.88]), cams(div, shelf, [0.3, 0.7], 1)], tools: ["hammer", "screwdriver"] });
  k.step({ title: "Tap two dowels into the other end of the shelf", detail: "That end goes into the right side later.", fix: [dowels(shelf, R, [0.15, 0.85])], tools: ["hammer"] });
  k.step({ title: "Screw the divider onto the bottom", detail: "Two long connector screws up through the bottom, with the Allen key.", add: ["bot"], fix: [screws(bot, div, [0.25, 0.75], LONG_SCREW)], tools: ["allen"] });
  k.step({
    title: "Prepare the left side",
    detail: "On a rug, inside up: four cam bolts, then three hinge plates with two screws each. The right side gets the same.",
    add: ["L"],
    fix: [bolts(L, bot, [0.25, 0.75]), bolts(L, pf, [0.25], 0.3), bolts(L, pb, [0.5], 0.3), ...plateFixes([ds[0]])],
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  k.step({ title: "Push the left side onto the bottom", detail: "Lay it on its back edge on the rug, tap the dowels in, and press the bottom and divider onto it.", add: ["L"], fix: [dowels(L, bot, [0.12, 0.5, 0.88]), dowels(R, bot, [0.15, 0.85]), dowels(bot, div, [0.88], 0.5)], tools: ["hammer"], pose: "+z", warnings: ["floor"] });
  k.step({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn clockwise.", fix: [cams(L, bot, [0.25, 0.75], 1)], tools: ["screwdriver"] });
  k.step({ title: "Tap the dowels into the plinths and push them on", detail: "Six in all: two in each end of the back plinth, one in each end of the front one. Slide them in from the open side.", add: ["pf", "pb"], fix: [dowels(pf, L, [0.8], 0.7), dowels(pb, L, [0.12, 0.88], 0.7), dowels(pf, R, [0.8], 0.7), dowels(pb, R, [0.12, 0.88], 0.7)], tools: ["hammer"] });
  k.step({ title: "Lay the right side on together", detail: "Its four cam bolts and three hinge plates go on first. Lower it so every dowel and bolt finds its hole.", add: ["R"], fix: [bolts(R, bot, [0.25, 0.75]), bolts(R, pf, [0.25], 0.3), bolts(R, pb, [0.5], 0.3), ...plateFixes([ds[2]])], people: 2, tools: ["screwdriver"] });
  k.step({ title: "Lock the cam locks", detail: "In the bottom and both plinths, on both sides.", fix: [cams(R, bot, [0.25, 0.75], 1), cams(L, pf, [0.25], -1, 0.3), cams(L, pb, [0.5], 1, 0.3), cams(R, pf, [0.25], -1, 0.3), cams(R, pb, [0.5], 1, 0.3)], tools: ["screwdriver"] });
  k.step({ title: "Screw the angle brackets behind the front plinth", detail: "Three small brackets join it to the bottom, one screw each.", fix: [at("angle", pf, angles.map((x): Vec3 => [x, P - 10, pf.pos[2] - T / 2]), [0, 0, 1], { len: 30, dia: 24 }), at("screw", pf, angles.map((x): Vec3 => [x, P - 20, pf.pos[2] - T / 2 - 2]), [0, 0, 1], HINGE_SCREW)], tools: ["screwdriver"] });
  k.step({ title: "Prepare the top", detail: "Four cam bolts in it, then tap the three door stops into its underside at the front.", fix: [bolts(top, L, [0.25, 0.75]), bolts(top, R, [0.25, 0.75]), at("clip", top, [-W / 3, 0, W / 3].map((x): Vec3 => [x, H - T, D / 2 - 20]), [0, 1, 0], { len: 12, dia: 10 })], tools: ["screwdriver", "hammer"] });
  k.step({ title: "Push the top on", detail: "Six dowels into the sides and the divider, then press it down.", add: ["top"], fix: [dowels(L, top, [0.15, 0.85]), dowels(R, top, [0.15, 0.85]), dowels(div, top, [0.15, 0.85])], tools: ["hammer"] });
  k.step({ title: "Screw the top to the divider and lock it", detail: "Two long connector screws down through the top, then turn the four cam locks.", fix: [screws(top, div, [0.25, 0.75], LONG_SCREW), cams(L, top, [0.25, 0.75], 1, 0.5), cams(R, top, [0.25, 0.75], -1, 0.5)], tools: ["allen", "screwdriver"] });
  k.step({ title: "Tap in the feet", detail: "Two into the bottom edge of each side and two under the front plinth.", fix: [...feet([L, R], 2, D), at("glide", pf, [-W / 4, W / 4].map((x): Vec3 => [x, 0, pf.pos[2]]), [0, 1, 0], FOOT)], tools: ["hammer"] });
  k.step({ title: "Turn it over onto its front together", detail: "Check it is square: both diagonals the same.", pose: "-z", people: 2, check: "square" });
  k.step({ title: "Nail on the back panels", detail: "Three pieces, side by side. Nails every 15 cm round the edges and into the bottom, the shelf and the divider.", add: backs.map((p) => p.id), fix: [{ kind: "nail", count: 30, to: backs.map((p) => p.id), ...BACK_NAIL }, { kind: "nail", count: 30, to: backs.map((p) => p.id), ...BACK_NAIL }], tools: ["hammer"] });
  k.step({ title: "Screw the wall brackets onto the top", detail: "Two brackets at the back, one screw and washer each.", fix: bracketFixes(top, [-W / 2 + 150, W / 2 - 150], zb), tools: ["screwdriver"] });
  k.step({ title: "Stand it up together", detail: "Lift it from the top end, don't drag it.", pose: "+y", people: 2 });
  k.step({ title: "Screw the hinge plates onto the divider", detail: "Three on its left face, two screws each, for the mirror door.", fix: plateFixes([ds[1]]), tools: ["screwdriver"] });
  buildCustom(b, { ...s, custom: k.recipe });
  wallSteps(b, { top: keyOf(b, top), y: H - T - 30, xs: [-W / 2 + 150, W / 2 - 150], zb, inBox: true, tall: true });
  doors(b, ds, { bumpers: 3, two: false });
  finishWardrobe(b, rail, loose.map((part) => ({ part, pins: 4 })));
  return true;
}

/** Loose shelves on pins and the rail on its two holders, added after the frame stands. */
function finishWardrobe(b: PlanBuilder, rail: Part, shelves: { part: Part; pins: number }[]) {
  const shelfKeys = shelves.map((x) => placeLater(b, x.part));
  const railKey = placeLater(b, rail);
  const many = shelves.length > 1;
  step(b, { title: many ? "Put the shelves in on their pins" : "Put the shelf in on its pins", detail: "Four pins under each shelf, at the height you want.", kind: "shelves" }, () => {
    for (const x of shelves) {
      const p = x.part;
      const pts: FitOpts[] = [-1, 1].flatMap((g) => [p.pos[2] - p.size[2] / 2 + 50, p.pos[2] + p.size[2] / 2 - 50].map((z): FitOpts => ({ at: [p.pos[0] + g * (p.size[0] / 2 + 2), p.pos[1] - T / 2 - 3, z], dir: [g, 0, 0] })));
      b.fits(HW.pin, pts.slice(0, x.pins), 0.06);
    }
    b.then(0.1);
    shelves.forEach((_, i) => b.add(shelfKeys[i], [0, 0, 400]));
  });
  step(b, { title: "Hang the clothes rail", detail: "Screw a holder to each side, one screw each, then drop the rail into them.", tools: ["screwdriver"], kind: "screws" }, () => {
    const x0 = rail.pos[0], w = rail.size[0];
    for (const g of [-1, 1]) {
      b.fit(HW.hook, { at: [x0 + g * (w / 2 + 2), rail.pos[1] + 10, 0], dir: [g, 0, 0] });
      b.fit({ kind: "screw", ...HINGE_SCREW }, { at: [x0 + g * (w / 2 + 2), rail.pos[1] + 25, 0], dir: [g, 0, 0] });
    }
    b.then(0.1);
    b.add(railKey, [0, 200, 0]);
  });
}

/** A part that isn't in the recipe: placed straight on the plan, to be added by a later step. */
const later = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<Part> = {}): Part => ({ id, name, size, pos, material: "board", ...o });
function placeLater(b: PlanBuilder, p: Part) {
  const rod = p.shape === "cyl" && p.size[0] > p.size[1] * 1.5;
  const t = b.part(p.name, rod ? [p.size[1], p.size[0], p.size[2]] : p.size, { shape: p.shape ?? "box", material: p.material ?? "board" });
  return b.place(t, p.pos, rod ? [0, 0, Math.PI / 2] : [0, 0, 0]);
}

/* ---------- chests and the bedside table: built lying on the left side ---------- */

/** Drawer openings stacked between y0 and y1, inset between two walls at xl and xr. */
function stackDrawers(o: { x0: number; x1: number; y0: number; y1: number; n: number; zf: number; dd: number; glassTop?: boolean; handle: number }): DrawerBox[] {
  const ph = (o.y1 - o.y0) / o.n;
  const wIn = o.x1 - o.x0;
  return range(o.n).map((i) => {
    const yb = o.y1 - (i + 1) * ph; // drawers counted from the top
    const fh = ph - 4;
    return { x: (o.x0 + o.x1) / 2, y0: yb + 14, w: wIn - 26, sh: Math.min(fh - 40, 170), dd: o.dd, zf: o.zf, fw: wIn - 4, fh, fy: yb + 2 + fh / 2, glass: o.glassTop && i === 0, handle: o.handle };
  });
}

function chest(b: PlanBuilder, s: ProductSpec, n: number) {
  const W = 780, D = 460, H = n === 4 ? 1240 : 950;
  const k = new Kit(W, H, D);
  const xi = W / 2 - T;
  const L = k.part("L", "Side panel", [T, H - T, D], [-W / 2 + T / 2, (H - T) / 2, 0]);
  const R = k.part("R", "Side panel", [T, H - T, D], [W / 2 - T / 2, (H - T) / 2, 0]);
  const top = k.part("top", "Top panel", [W, T, D], [0, H - T / 2, 0]);
  const P = 60;
  const z0 = -D / 2 + 12; // the grooves for the back
  const plinth = k.part("plinth", "Plinth rail", [2 * xi, P, T], [0, P / 2, D / 2 - 10 - T / 2]);
  const rear = k.part("rear", "Back rail", [2 * xi, 80, T], [0, 40, z0 + T / 2]);
  const rail = k.part("rail", "Top rail", [2 * xi, T, 60], [0, H - T - T / 2, D / 2 - 40]);
  const hb = (H - T - 80) / 3;
  const backs = range(3).map((i) => k.part(`b${i}`, "Back panel", [2 * xi, hb, 8], [0, 80 + hb * (i + 0.5), z0 + 4]));
  const yTop = H - 2 * T - 2;
  const dd = Math.round((D / 2 - 18 - (z0 + T) - 20) / 10) * 10;
  const ds = stackDrawers({ x0: -xi, x1: xi, y0: P + 2, y1: yTop, n, zf: D / 2, dd, glassTop: true, handle: 200 });
  const runLen = Math.round((dd - 20) / 10) * 10;
  const runY = ds.map((d) => d.y0 + 4);
  const ang = (g: -1 | 1): Vec3 => [g * (xi - 14), P / 2, plinth.pos[2] - T / 2];
  const rearPts = n === 4 ? [0.3, 0.7] : [0.5];

  k.step({ title: "Screw the runners onto the left side", detail: `Lay it on a rug, inside up. ${n} runners, two screws each, wheel at the front. The right side gets its own the same way.`, add: ["L"], fix: cabinetRunners(L, 1, runY, D / 2, runLen), tools: ["screwdriver"], warnings: ["floor"] });
  k.step({ title: "Screw the cam bolts into the left side", detail: "Four: one for the back rail and one for each back panel. The right side takes four too.", fix: [bolts(L, rear, [0.5], 0.5), ...backs.map((p) => bolts(L, p, [0.5]))], tools: ["screwdriver"] });
  k.step({ title: "Screw the L brackets onto the plinth rail", detail: "One at each end on the back face, two screws each, the bent edge flush with the end.", add: ["plinth"], fix: [at("angle", plinth, [ang(-1), ang(1)], [0, 0, 1], { len: 40, dia: 40 }), at("screw", plinth, [-1, 1].flatMap((g) => [-12, 12].map((dy): Vec3 => [g * (xi - 30), P / 2 + dy, plinth.pos[2] - T / 2])), [0, 0, 1], { len: 13, dia: 5 })], tools: ["screwdriver"], pose: "+x", warnings: ["floor"] });
  k.step({ title: "Screw the plinth rail to the left side", detail: "Lay the left side down, runners up. One screw through the bracket into the side.", fix: [at("screw", L, [[-xi, P / 2, plinth.pos[2] - T / 2 - 20]], [-1, 0, 0], { len: 13, dia: 5 })], tools: ["screwdriver"] });
  k.step({ title: "Stand the back rail in the left side", detail: "Dowels in its ends, then push it into the side at the bottom of the back edge and turn its cam lock.", add: ["rear"], fix: [dowels(rear, L, rearPts, 0.5), dowels(rear, R, rearPts, 0.5), cams(L, rear, [0.5], 1, 0.5)], tools: ["hammer", "screwdriver"] });
  k.step({ title: "Stand the top rail in the left side", detail: "Two dowels in each end. It goes at the top of the front edge.", add: ["rail"], fix: [dowels(rail, L, [0.25, 0.75]), dowels(rail, R, [0.25, 0.75])], tools: ["hammer"] });
  k.step({ title: "Slide the back panels down the grooves", detail: "Tap two dowels into each end of the three panels first, then slide them in one by one.", add: backs.map((p) => p.id), fix: backs.flatMap((p) => [dowels(p, L, [0.25, 0.75]), dowels(p, R, [0.25, 0.75])]), tools: ["hammer"] });
  k.step({ title: "Lock the cam locks", detail: "One in each back panel, on the inside.", fix: backs.map((p) => cams(L, p, [0.5], 1)), tools: ["screwdriver"] });
  k.step({ title: "Lower the right side on", detail: "Its runners and four cam bolts go in first, like the left side. Runners facing in, line up every dowel and bolt, then press it down evenly.", add: ["R"], fix: [...cabinetRunners(R, -1, runY, D / 2, runLen), bolts(R, rear, [0.5], 0.5), ...backs.map((p) => bolts(R, p, [0.5]))], tools: ["screwdriver"] });
  k.step({ title: "Lock the cam locks", detail: "Four of them: in the back rail and the three back panels.", fix: [cams(R, rear, [0.5], 1, 0.5), ...backs.map((p) => cams(R, p, [0.5], 1))], tools: ["screwdriver"] });
  k.step({ title: "Screw the plinth rail to the right side", detail: "One screw through the second bracket.", fix: [at("screw", R, [[xi, P / 2, plinth.pos[2] - T / 2 - 20]], [1, 0, 0], { len: 13, dia: 5 })], tools: ["screwdriver"] });
  k.step({ title: "Tap four dowels into the tops of the sides", detail: "Two in each.", fix: [dowels(L, top, [0.25, 0.75]), dowels(R, top, [0.25, 0.75])], tools: ["hammer"] });
  k.step({ title: "Prepare the top", detail: "Upside down on the rug: four cam bolts, then the two wall brackets at the back, one screw and washer each.", fix: [bolts(top, L, [0.15, 0.85]), bolts(top, R, [0.15, 0.85]), ...bracketFixes(top, [-W / 2 + 120, W / 2 - 120], -D / 2)], tools: ["screwdriver"] });
  k.step({ title: "Push the top on and lock it", detail: "Onto the dowels, then turn the four cam locks in the sides.", add: ["top"], fix: [cams(top, L, [0.15, 0.85], 1), cams(top, R, [0.15, 0.85], -1)], tools: ["screwdriver"] });
  k.step({ title: "Tap in the feet", detail: "Three plastic feet into the bottom edge of each side.", fix: feet([L, R], 3, D), tools: ["hammer"] });
  k.step({ title: "Stand it up", detail: "Lift it upright, don't pull it up by one corner.", pose: "+y" });
  buildCustom(b, { ...s, custom: k.recipe });
  wallSteps(b, { top: keyOf(b, top), y: H - T - 30, xs: [-W / 2 + 120, W / 2 - 120], zb: -D / 2, inBox: true, tall: false });
  drawers(b, ds);
  return true;
}

function bedside(b: PlanBuilder, s: ProductSpec) {
  const W = 390, H = 530, D = 410;
  const k = new Kit(W, H, D);
  const xi = W / 2 - T;
  const L = k.part("L", "Side panel", [T, H - T, D], [-W / 2 + T / 2, (H - T) / 2, 0]);
  const R = k.part("R", "Side panel", [T, H - T, D], [W / 2 - T / 2, (H - T) / 2, 0]);
  const top = k.part("top", "Top panel", [W, T, D], [0, H - T / 2, 0]);
  const P = 60;
  const front = k.part("front", "Plinth rail", [2 * xi, P, T], [0, P / 2, D / 2 - 10 - T / 2]);
  const rear = k.part("rear", "Back rail", [2 * xi, P, T], [0, P / 2, -D / 2 + T / 2]);
  const back = backPanels(k, 1, 4, H);
  const yS = 300;
  const dd = 330;
  const ds = stackDrawers({ x0: -xi, x1: xi, y0: P + 2, y1: yS - 2, n: 1, zf: D / 2, dd, glassTop: true, handle: 160 });
  const runLen = 310;
  k.step({ title: "Screw the cam bolts into the left side", detail: "Lay it on a rug, inside up. Two at the bottom. The right side takes two as well.", add: ["L"], fix: [bolts(L, front, [0.5], 0.4), bolts(L, rear, [0.5], 0.4)], tools: ["screwdriver"], warnings: ["floor"] });
  k.step({ title: "Screw a runner onto the left side", detail: "Two screws, wheel at the front.", fix: cabinetRunners(L, 1, [ds[0].y0 + 4], D / 2, runLen), tools: ["screwdriver"] });
  k.step({ title: "Stand the two rails in the left side", detail: "Lay the left side down. A dowel in each end of both rails, then push them into the side at the bottom.", add: ["front", "rear"], fix: [dowels(front, L, [0.7], 0.5), dowels(rear, L, [0.7], 0.5), dowels(front, R, [0.7], 0.5), dowels(rear, R, [0.7], 0.5)], tools: ["hammer"], pose: "+x", warnings: ["floor"] });
  k.step({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn clockwise.", fix: [cams(L, front, [0.5], -1, 0.4), cams(L, rear, [0.5], 1, 0.4)], tools: ["screwdriver"] });
  k.step({ title: "Prepare the right side", detail: "Its two cam bolts and its runner, the same as the left.", add: ["R"], fix: [bolts(R, front, [0.5], 0.4), bolts(R, rear, [0.5], 0.4), ...cabinetRunners(R, -1, [ds[0].y0 + 4], D / 2, runLen)], tools: ["screwdriver"] });
  k.step({ title: "Put the right side on and lock it", detail: "Press it onto the dowels and turn the two cam locks.", fix: [cams(R, front, [0.5], -1, 0.4), cams(R, rear, [0.5], 1, 0.4)], tools: ["screwdriver"] });
  k.step({ title: "Stand it up and fit the top", detail: "Four cam bolts in the top, four dowels in the sides, then press the top on and lock it.", add: ["top"], fix: [bolts(top, L, [0.15, 0.85]), bolts(top, R, [0.15, 0.85]), dowels(L, top, [0.3, 0.7]), dowels(R, top, [0.3, 0.7]), cams(top, L, [0.15, 0.85], 1), cams(top, R, [0.15, 0.85], -1)], tools: ["screwdriver", "hammer"], pose: "+y" });
  k.step({ title: "Tap in the feet", detail: "Two plastic feet into the bottom edge of each side.", fix: feet([L, R], 2, D), tools: ["hammer"], pose: "-y" });
  k.step({ title: "Nail on the back", detail: "Lay it on its front. Square it up, then nail round the edges.", add: [back[0].id], fix: [{ kind: "nail", count: 18, to: [back[0].id], ...BACK_NAIL }], tools: ["hammer"], pose: "-z", check: "square" });
  k.step({ title: "Stand it up", pose: "+y" });
  buildCustom(b, { ...s, custom: k.recipe });
  const shelf = later("shelf", "Shelf", [2 * xi - 4, T, D - 30], [0, yS + T / 2, -10]);
  const sk = placeLater(b, shelf);
  step(b, { title: "Put the shelf in on its pins", detail: "Four pins in the sides just above the drawer, then lay the shelf on them.", kind: "shelves" }, () => {
    b.fits(HW.pin, [-1, 1].flatMap((g) => [-D / 2 + 60, D / 2 - 80].map((z): FitOpts => ({ at: [g * (xi + 2), yS - 3, z], dir: [g, 0, 0] }))), 0.08);
    b.then(0.1);
    b.add(sk, [0, 0, 300]);
  });
  drawers(b, ds, { bumpers: 2 });
  return true;
}

/* ---------- TV benches: a long middle shelf with dividers above and below, built upside down ---------- */

function tvBench(b: PlanBuilder, s: ProductSpec, n: 2 | 3) {
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10), D = 410;
  const k = new Kit(W, H, D);
  const xi = W / 2 - T;
  const P = 50;
  const yS = 270; // underside of the middle shelf
  const L = k.part("L", "Side panel", [T, H - T, D], [-W / 2 + T / 2, (H - T) / 2, 0]);
  const R = k.part("R", "Side panel", [T, H - T, D], [W / 2 - T / 2, (H - T) / 2, 0]);
  const top = k.part("top", "Top panel", [W, T, D], [0, H - T / 2, 0]);
  const shelf = k.part("shelf", "Middle shelf", [2 * xi, T, D], [0, yS + T / 2, 0]);
  const cw = (2 * xi - (n - 1) * T) / n;
  const dx = (i: number) => -xi + (i + 1) * cw + i * T + T / 2; // divider centres
  const zF = D / 2 - 20 - T, zB = -D / 2 + T; // inside faces of the plinths
  const up = range(n - 1).map((i) => k.part(`u${i}`, "Upper divider", [T, H - T - (yS + T), D - 20], [dx(i), (yS + T + H - T) / 2, -10]));
  const low = range(n - 1).map((i) => k.part(`d${i}`, "Lower divider", [T, yS, zF - zB], [dx(i), yS / 2, (zF + zB) / 2]));
  const pf = k.part("pf", "Plinth", [2 * xi, P, T], [0, P / 2, zF + T / 2]);
  const pb = k.part("pb", "Plinth", [2 * xi, P, T], [0, P / 2, zB - T / 2]);
  const back = backPanels(k, 1, 4, H);
  const walls = [L, ...low, R];
  const dd = Math.round((zF - zB - 40) / 10) * 10;
  const ds = range(n).flatMap((i) => stackDrawers({ x0: walls[i].pos[0] + T / 2, x1: walls[i + 1].pos[0] - T / 2, y0: P + 2, y1: yS - 2, n: 1, zf: D / 2, dd, glassTop: true, handle: 200 }));
  const runLen = Math.round((dd - 20) / 10) * 10;
  const ry = ds[0].y0 + 4;
  const runs = low.flatMap((d) => [...cabinetRunners(d, -1, [ry], D / 2, runLen), ...cabinetRunners(d, 1, [ry], D / 2, runLen)]);
  const shelfDw = n === 3 ? [0.15, 0.5, 0.85] : [0.25, 0.75];
  const nails = n === 3 ? 36 : 29;

  k.step({ title: n > 2 ? "Screw the runners onto the lower dividers" : "Screw the runners onto the lower divider", detail: "Lay them on a rug. One runner on each face, two screws each, wheel at the front.", add: low.map((p) => p.id), fix: runs, tools: ["screwdriver"], warnings: ["floor"] });
  k.step({ title: "Prepare the left side", detail: "Inside up on the rug: its runner, then four cam bolts, two for the middle shelf and one for each plinth. The right side waits too.", fix: [bolts(L, shelf, [0.25, 0.75]), bolts(L, pf, [0.25], 0.4), bolts(L, pb, [0.25], 0.4), ...cabinetRunners(L, 1, [ry], D / 2, runLen)], wait: ["L"], tools: ["screwdriver"] });
  k.step({ title: n > 2 ? "Screw the upper dividers onto the middle shelf" : "Screw the upper divider onto the middle shelf", detail: "Lay the shelf on the rug. Dowels into the divider, then two long connector screws through the shelf into it, with the Allen key.", add: ["shelf", ...up.map((p) => p.id)], fix: [...up.map((u) => dowels(u, shelf, [0.2, 0.8])), ...up.map((u) => screws(shelf, u, [0.35, 0.65], LONG_SCREW))], tools: ["hammer", "allen"], pose: "-y", warnings: ["floor"], from: { shelf: [0, -300, 0] } });
  k.step({ title: n > 2 ? "Stand the lower dividers on the shelf" : "Stand the lower divider on the shelf", detail: "Two dowels and two cam bolts in the end of each, then push it onto the shelf and turn the cam locks.", fix: [...low.map((d) => dowels(d, shelf, [0.2, 0.8])), ...low.map((d) => bolts(d, shelf, [0.35, 0.65])), ...low.map((d) => cams(d, shelf, [0.35, 0.65], 1))], tools: ["hammer", "screwdriver"] });
  k.step({ title: "Fit the left side", detail: "Dowels into the shelf end, then push the side on and lock its two cam locks.", add: ["L"], fix: [dowels(shelf, L, shelfDw), cams(L, shelf, [0.25, 0.75], 1)], tools: ["hammer", "screwdriver"] });
  k.step({ title: "Push in the plinths", detail: "A dowel in each end. One goes at the front, one at the back, under the dividers.", add: ["pf", "pb"], fix: [dowels(pf, L, [0.8], 0.6), dowels(pb, L, [0.8], 0.6), dowels(pf, R, [0.8], 0.6), dowels(pb, R, [0.8], 0.6)], tools: ["hammer"] });
  k.step({ title: "Lock the plinth cam locks", detail: "One at the left end of each plinth.", fix: [cams(L, pf, [0.25], -1, 0.4), cams(L, pb, [0.25], 1, 0.4)], tools: ["screwdriver"] });
  k.step({ title: "Fit the right side", detail: "Its runner and four cam bolts first, then dowels into the shelf end, push it on and lock four cam locks.", add: ["R"], fix: [...cabinetRunners(R, -1, [ry], D / 2, runLen), bolts(R, shelf, [0.25, 0.75]), bolts(R, pf, [0.25], 0.4), bolts(R, pb, [0.25], 0.4), dowels(shelf, R, shelfDw), cams(R, shelf, [0.25, 0.75], 1), cams(R, pf, [0.25], -1, 0.4), cams(R, pb, [0.25], 1, 0.4)], tools: ["hammer", "screwdriver"] });
  k.step({ title: "Tap in the feet", detail: "Two plastic feet into the bottom edge of each side and each lower divider.", fix: feet([L, R, ...low], 2, D - 60), tools: ["hammer"] });
  k.step({ title: "Tap the dowels into the tops of the sides", detail: `Two in each side and each upper divider.`, fix: [dowels(L, top, [0.25, 0.75]), dowels(R, top, [0.25, 0.75]), ...up.map((u) => dowels(u, top, [0.25, 0.75]))], tools: ["hammer"], pose: "+y" });
  k.step({ title: "Prepare the top", detail: `Upside down on the rug: ${2 * (n + 1)} cam bolts, then the two wall brackets at the back, one screw and washer each.`, fix: [bolts(top, L, [0.1, 0.9]), bolts(top, R, [0.1, 0.9]), ...up.map((u) => bolts(top, u, [0.1, 0.9])), ...bracketFixes(top, [-W / 2 + 150, W / 2 - 150], -D / 2)], tools: ["screwdriver"] });
  k.step({ title: "Turn it over and put the top on", detail: "Stand it on its feet, lower the top onto the dowels and lock all the cam locks.", add: ["top"], fix: [cams(top, L, [0.1, 0.9], 1), cams(top, R, [0.1, 0.9], -1), ...up.map((u) => cams(top, u, [0.1, 0.9], 1))], tools: ["screwdriver"], people: W > 1500 ? 2 : 1 });
  k.step({ title: "Nail on the back", detail: "Lay it on its front. The cut-outs for the cables go at the top. Square it up, then nail round the edges and into the shelf.", add: [back[0].id], fix: [{ kind: "nail", count: nails, to: [back[0].id], ...BACK_NAIL }], tools: ["hammer"], pose: "-z", check: "square" });
  k.step({ title: "Stand it up", pose: "+y", people: W > 1500 ? 2 : 1 });
  buildCustom(b, { ...s, custom: k.recipe });
  wallSteps(b, { top: keyOf(b, top), y: H - T - 30, xs: [-W / 2 + 150, W / 2 - 150], zb: -D / 2, inBox: false, tall: false });
  drawers(b, ds, { bumpers: n === 2 ? 1 : 2 });
  return true;
}

/* ---------- bookcase and cabinet: built lying on their backs ---------- */

function bookcase(b: PlanBuilder, s: ProductSpec) {
  const W = 600, H = 1900, D = 350;
  const k = new Kit(W, H, D);
  const xi = W / 2 - T;
  const P = 60;
  const yF = 470;
  const L = k.part("L", "Side panel", [T, H, D], [-W / 2 + T / 2, H / 2, 0]);
  const R = k.part("R", "Side panel", [T, H, D], [W / 2 - T / 2, H / 2, 0]);
  const top = k.part("top", "Top panel", [2 * xi, T, D], [0, H - T / 2, 0]);
  const fixed = k.part("fixed", "Fixed shelf", [2 * xi, T, D], [0, yF + T / 2, 0]);
  const pf = k.part("pf", "Plinth", [2 * xi, P, T], [0, P / 2, D / 2 - 10 - T / 2]);
  const pb = k.part("pb", "Plinth", [2 * xi, P, T], [0, P / 2, -D / 2 + T / 2]);
  const back = backPanels(k, 1, 4, H);
  const dd = 280;
  const ds = stackDrawers({ x0: -xi, x1: xi, y0: P + 2, y1: yF - 2, n: 2, zf: D / 2, dd, handle: 200 });
  const runLen = 260;
  const ry = ds.map((d) => d.y0 + 4);
  k.step({ title: "Screw the cam bolts into the left side", detail: "Lay it on a rug, inside up. Two for the fixed shelf and one for each plinth.", add: ["L"], fix: [bolts(L, fixed, [0.25, 0.75]), bolts(L, pf, [0.25], 0.4), bolts(L, pb, [0.25], 0.4)], tools: ["screwdriver"], pose: "+z", warnings: ["floor"] });
  k.step({ title: "Screw the runners onto the left side", detail: "Two runners at the bottom, two screws each, wheel at the front.", fix: cabinetRunners(L, 1, ry, D / 2, runLen), tools: ["screwdriver"] });
  k.step({ title: "Push the fixed shelf and the plinths onto the left side", detail: "Dowels into the side first: two for the shelf and one for each plinth.", add: ["fixed", "pf", "pb"], fix: [dowels(L, fixed, [0.2, 0.8]), dowels(L, pf, [0.8], 0.7), dowels(L, pb, [0.8], 0.7)], tools: ["hammer"] });
  k.step({ title: "Lock the cam locks", detail: "Four of them, arrow towards the bolt.", fix: [cams(L, fixed, [0.25, 0.75], 1), cams(L, pf, [0.25], -1, 0.4), cams(L, pb, [0.25], 1, 0.4)], tools: ["screwdriver"] });
  k.step({ title: "Put the right side on", detail: "Its cam bolts, runners and dowels go in first, like the left. Then press it on.", add: ["R"], fix: [bolts(R, fixed, [0.25, 0.75]), bolts(R, pf, [0.25], 0.4), bolts(R, pb, [0.25], 0.4), ...cabinetRunners(R, -1, ry, D / 2, runLen), dowels(R, fixed, [0.2, 0.8]), dowels(R, pf, [0.8], 0.7), dowels(R, pb, [0.8], 0.7)], tools: ["screwdriver", "hammer"] });
  k.step({ title: "Lock the cam locks", detail: "Four more on the right.", fix: [cams(R, fixed, [0.25, 0.75], 1), cams(R, pf, [0.25], -1, 0.4), cams(R, pb, [0.25], 1, 0.4)], tools: ["screwdriver"] });
  k.step({ title: "Tap in the feet", detail: "Two plastic feet into the bottom edge of each side.", fix: feet([L, R], 2, D), tools: ["hammer"] });
  k.step({ title: "Fit the top", detail: "Four dowels into its ends, push it between the sides, then two long connector screws through each side into it.", add: ["top"], fix: [dowels(top, L, [0.2, 0.8]), dowels(top, R, [0.2, 0.8]), screws(L, top, [0.4, 0.6], LONG_SCREW), screws(R, top, [0.4, 0.6], LONG_SCREW)], tools: ["hammer", "allen"] });
  k.step({ title: "Turn it over and nail on the back", detail: "Lay it on its front, square it up and nail round the edges and into the fixed shelf.", add: [back[0].id], fix: [{ kind: "nail", count: 31, to: [back[0].id], ...BACK_NAIL }], tools: ["hammer"], pose: "-z", check: "square" });
  k.step({ title: "Screw the wall brackets onto the top", detail: "Two brackets at the back, one screw and washer each.", fix: bracketFixes(top, [-xi + 80, xi - 80], -D / 2), tools: ["screwdriver"] });
  k.step({ title: "Stand it up together", pose: "+y", people: 2 });
  buildCustom(b, { ...s, custom: k.recipe });
  const shelves = [800, 1150, 1500].map((y, i) => later(`s${i}`, "Shelf", [2 * xi - 4, T, D - 20], [0, y, -10]));
  const keys = shelves.map((p) => placeLater(b, p));
  step(b, { title: "Put the shelves in on their pins", detail: "Four pins under each of the three shelves, at the heights you want.", kind: "shelves" }, () => {
    for (const p of shelves) b.fits(HW.pin, [-1, 1].flatMap((g) => [-D / 2 + 50, D / 2 - 60].map((z): FitOpts => ({ at: [g * (xi + 2), p.pos[1] - T / 2 - 3, z], dir: [g, 0, 0] }))), 0.05);
    b.then(0.1);
    keys.forEach((kk) => b.add(kk, [0, 0, 300]));
  });
  wallSteps(b, { top: keyOf(b, top), y: H - T - 50, xs: [-xi + 80, xi - 80], zb: -D / 2, inBox: false, tall: true });
  drawers(b, ds, { bumpers: 2 });
  return true;
}

function cabinet(b: PlanBuilder, s: ProductSpec) {
  const W = 780, H = 950, D = 410;
  const k = new Kit(W, H, D);
  const xi = W / 2 - T;
  const P = 60;
  const L = k.part("L", "Side panel", [T, H - T, D], [-W / 2 + T / 2, (H - T) / 2, 0]);
  const R = k.part("R", "Side panel", [T, H - T, D], [W / 2 - T / 2, (H - T) / 2, 0]);
  const top = k.part("top", "Top panel", [W, T, D], [0, H - T / 2, 0]);
  const bot = k.part("bot", "Bottom panel", [2 * xi, T, D], [0, P + T / 2, 0]);
  const div = k.part("div", "Divider", [T, H - T - (P + T), D - 20], [0, (P + T + H - T) / 2, -10]);
  const pf = k.part("pf", "Plinth", [2 * xi, P, T], [0, P / 2, D / 2 - 10 - T / 2]);
  const back = backPanels(k, 2, 4, H);
  const doorH = H - P - 6;
  const ds: Door[] = [-1, 1].map((g) => ({ x: (g * W) / 4, w: W / 2 - 3, y0: P + 3, h: doorH, zf: D / 2 + 2 + 18, hinge: g as -1 | 1, ys: [P + 100, H - 120], wall: g < 0 ? L : R, glass: true, handleY: P + doorH * 0.5, handle: 190 }));
  const hang = (side: Part, g: -1 | 1): CustomFix[] => [
    at("bracket", side, [[side.pos[0] - g * (T / 2), H - 120, -D / 2 + 30]], [g, 0, 0], { len: 50, dia: 30 }),
    at("screw", side, [-1, 1].map((e): Vec3 => [side.pos[0] - g * (T / 2), H - 120 + e * 20, -D / 2 + 30]), [g, 0, 0], { len: 12, dia: 3 }),
  ];
  k.step({ title: "Screw the wall fittings and hinge plates onto the left side", detail: "Lay it on a rug, inside up. The keyhole plate goes at the top of the back edge, the two hinge plates near the front.", add: ["L"], fix: [...hang(L, -1), ...plateFixes([ds[0]])], tools: ["screwdriver"], pose: "+z", warnings: ["floor"] });
  k.step({ title: "Screw the cam bolts into the left side", detail: "Two for the bottom and one for the plinth.", fix: [bolts(L, bot, [0.25, 0.75]), bolts(L, pf, [0.25], 0.4)], tools: ["screwdriver"] });
  k.step({ title: "Screw the divider onto the bottom", detail: "Two long connector screws up through the bottom into the divider, with the Allen key.", add: ["bot", "div"], fix: [screws(bot, div, [0.25, 0.75], LONG_SCREW)], tools: ["allen"] });
  k.step({ title: "Push the left side on", detail: "Two dowels into the side, then press the bottom onto them and turn its two cam locks.", fix: [dowels(L, bot, [0.15, 0.85]), cams(L, bot, [0.25, 0.75], 1)], tools: ["hammer", "screwdriver"] });
  k.step({ title: "Push the plinth on", detail: "A dowel in each end, then lock its cam lock.", add: ["pf"], fix: [dowels(pf, L, [0.8], 0.7), dowels(pf, R, [0.8], 0.7), cams(L, pf, [0.25], -1, 0.4)], tools: ["hammer", "screwdriver"] });
  k.step({ title: "Put the right side on", detail: "Its wall fitting, hinge plates, cam bolts and dowels go in first. Press it on and lock three cam locks.", add: ["R"], fix: [...hang(R, 1), ...plateFixes([ds[1]]), bolts(R, bot, [0.25, 0.75]), bolts(R, pf, [0.25], 0.4), dowels(R, bot, [0.15, 0.85]), cams(R, bot, [0.25, 0.75], 1), cams(R, pf, [0.25], -1, 0.4)], tools: ["screwdriver", "hammer"] });
  k.step({ title: "Fit the top", detail: "Six cam bolts into the top, six dowels into the sides and the divider, then press it on and lock it.", add: ["top"], fix: [bolts(top, L, [0.15, 0.85]), bolts(top, R, [0.15, 0.85]), bolts(top, div, [0.3, 0.7]), dowels(L, top, [0.35, 0.65]), dowels(R, top, [0.35, 0.65]), dowels(div, top, [0.15, 0.85]), cams(top, L, [0.15, 0.85], 1), cams(top, R, [0.15, 0.85], -1), cams(top, div, [0.3, 0.7], 1)], tools: ["screwdriver", "hammer"] });
  k.step({ title: "Turn it over and nail on the back", detail: "Lay it on its front. Two halves, side by side. Square it up, then nail round the edges and into the divider.", add: back.map((p) => p.id), fix: [{ kind: "nail", count: 36, to: back.map((p) => p.id), ...BACK_NAIL }], tools: ["hammer"], pose: "-z", check: "square" });
  k.step({ title: "Tap in the feet", detail: "Two plastic feet into the bottom edge of each side.", fix: feet([L, R], 2, D), tools: ["hammer"] });
  k.step({ title: "Stand it up", pose: "+y" });
  buildCustom(b, { ...s, custom: k.recipe });
  step(b, { title: "Hang it on the wall", detail: "Two screws in the wall, level with each other, then lift it on so the keyhole plates drop over them and tighten them from inside. Wall screws aren't included: pick ones made for your wall.", tools: ["screwdriver", "drill", "pencil", "level"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    for (const g of [-1, 1]) b.fit({ ...WALL_PLUG, notIncluded: true }, { at: [g * (W / 2 - T - 20), H - 120, -D / 2 - 2], dir: [0, 0, -1] });
    b.then(0.1);
    for (const g of [-1, 1]) b.fit({ ...WALL_SCREW, notIncluded: true }, { at: [g * (W / 2 - T - 20), H - 120, -D / 2 + 4], dir: [0, 0, -1] });
  });
  const shelves = [-1, 1].flatMap((g) => [320, 560, 760].map((y, i) => later(`s${g}${i}`, "Shelf", [xi - T / 2 - 4, T, D - 40], [(g * (xi + T / 2)) / 2, y, -20])));
  const keys = shelves.map((p) => placeLater(b, p));
  step(b, { title: "Put the shelves in on their pins", detail: "Four pins under each shelf, three shelves on each side of the divider.", kind: "shelves" }, () => {
    for (const p of shelves) b.fits(HW.pin, [-1, 1].flatMap((g) => [-D / 2 + 50, D / 2 - 70].map((z): FitOpts => ({ at: [p.pos[0] + g * (p.size[0] / 2 + 2), p.pos[1] - T / 2 - 3, z], dir: [g, 0, 0] }))), 0.03);
    b.then(0.1);
    keys.forEach((kk) => b.add(kk, [0, 0, 300]));
  });
  doors(b, ds, { bumpers: 2 });
  return true;
}

/* ---------- the storage bed: a spine with cross dividers on floor rails, four drawers on runners ---------- */

/** Mattress width and length (mm) from the variant, as "135 × 190 cm". */
function mattressOf(s: ProductSpec): [number, number] | null {
  const m = /(\d{2,3})\s*[×x]\s*(\d{3})/.exec(s.variant);
  return m ? [Number(m[1]) * 10, Number(m[2]) * 10] : null;
}

function storageBed(b: PlanBuilder, s: ProductSpec) {
  const mt = mattressOf(s);
  if (!mt) return false;
  // laid out along x: the head panel on the left, drawers out of both long sides (front +z and back -z)
  const L = mt[1] + 60, W = mt[0] + 60, H = 470;
  const k = new Kit(L, H, W);
  const t = 18;
  const yTop = 370; // top of the spine and the slat ledges
  const head = k.part("head", "Head panel", [t, H, W], [-L / 2 + t / 2, H / 2, 0]);
  const foot = k.part("foot", "Foot panel", [t, H, W], [L / 2 - t / 2, H / 2, 0]);
  const Ls = L - 2 * t;
  // each long side is a frame round two drawer openings
  const oy0 = 40, oy1 = 340, post = 60;
  const sidePieces: PartPiece[] = [
    { shape: "box", size: [Ls, oy0, t], pos: [0, -H / 2 + oy0 / 2, 0] },
    { shape: "box", size: [Ls, H - oy1, t], pos: [0, H / 2 - (H - oy1) / 2, 0] },
    ...[-Ls / 2 + post / 2, 0, Ls / 2 - post / 2].map((x): PartPiece => ({ shape: "box", size: [post, oy1 - oy0, t], pos: [x, -H / 2 + (oy0 + oy1) / 2, 0] })),
  ];
  const sideF = k.part("sf", "Side panel", [Ls, H, t], [0, H / 2, W / 2 - t / 2], { pieces: sidePieces });
  const sideB = k.part("sb", "Side panel", [Ls, H, t], [0, H / 2, -W / 2 + t / 2], { pieces: sidePieces });
  const rw = 80, rh = 22;
  const spine = k.part("spine", "Middle panel", [Ls, yTop, t], [0, yTop / 2, 0]);
  const rails = [-1, 1].map((g) => k.part(`r${g}`, "Floor rail", [Ls, rh, rw], [0, rh / 2, g * (t / 2 + rw / 2)]));
  const cw = W / 2 - t - t / 2;
  const cross = [-1, 1].map((g) => k.part(`c${g}`, "Cross divider", [t, yTop - rh, cw], [0, rh + (yTop - rh) / 2, g * (t / 2 + cw / 2)]));
  const ledges = [-1, 1].flatMap((g) => [-1, 1].map((h) => k.part(`l${g}${h}`, "Slat ledge", [Ls / 2 - 2, 30, 30], [h * (Ls / 4), yTop - 15, g * (W / 2 - t - 15)], { material: "metal" })));
  // each strip is an angle: a web screwed to the face of the middle panel, a flange on top level with the ledges
  const sh = 30, sw = 20;
  const stripPieces = (g: number): PartPiece[] => [
    { shape: "box", size: [Ls / 2 - 2, sh, 2], pos: [0, 0, -g * (sw / 2 - 1)] },
    { shape: "box", size: [Ls / 2 - 2, 2, sw], pos: [0, sh / 2 - 1, 0] },
  ];
  const strips = [-1, 1].flatMap((h) => [-1, 1].map((g) => k.part(`st${h}${g}`, "Support strip", [Ls / 2 - 2, sh, sw], [h * (Ls / 4), yTop + 8 - sh / 2, g * (t / 2 + sw / 2)], { material: "metal", pieces: stripPieces(g) })));
  const slats = k.part("slats", "Slatted bed base", [L - 2 * t - 20, 20, W - 2 * t - 20], [0, yTop + 18, 0], { extra: true, material: "wood" });
  // drawers: two in each long side, between the head (or foot) panel and the cross dividers
  const bay = L / 2 - t - t / 2;
  const dd = Math.round((W / 2 - t - t / 2 - 40) / 10) * 10;
  const ds: DrawerBox[] = [-1, 1].flatMap((g) =>
    [-1, 1].map((h): DrawerBox => {
      const x = h * (t / 2 + bay / 2);
      const fw = bay - 2 * post + 20;
      return { x, y0: oy0 + 14, w: bay - 26, sh: 220, dd, zf: W / 2, fw, fh: oy1 - oy0 - 4, fy: (oy0 + oy1) / 2, handle: 200, flip: g < 0 };
    }),
  );
  const runLen = Math.round((dd - 20) / 10) * 10;
  const ry = ds[0].y0 + 4;
  const run = (wall: Part, side: 1 | -1, zs: number[]) => {
    const x = wall.pos[0] + side * (wall.size[0] / 2);
    return [
      at("runner", wall, zs.map((z): Vec3 => [x + side * 5, ry, z]), [-side, 0, 0], { len: runLen, dia: 20 }),
      at("screw", wall, zs.flatMap((z) => [-1, 0, 1].map((e): Vec3 => [x + side * 10, ry, z + e * (runLen / 2 - 40)])), [-side, 0, 0], { len: 12, dia: 4 }),
    ];
  };
  const zRun = (g: number) => g * (W / 2 - t - 20 - runLen / 2);
  const corner = (end: Part, side: Part) => along(end, side, [0.5], 0.5)[0];
  const ends = [head, foot], sides = [sideF, sideB];

  k.step({ title: "Push the long pins through the middle panel", detail: "Lay the parts on a rug. The two double-ended pins go through the holes in the middle, half out on each side.", add: ["spine"], fix: [at("camScrew", spine, [[0, 180, 0], [0, 300, 0]], [0, 0, 1], { len: 110, dia: 8 })], warnings: ["floor"] });
  k.step({ title: "Screw the runners onto the cross dividers", detail: "One on each face, three screws each. The runners are marked CL and CR: keep them to the side shown.", add: cross.map((p) => p.id), fix: cross.flatMap((c) => [...run(c, -1, [zRun(Math.sign(c.pos[2]))]), ...run(c, 1, [zRun(Math.sign(c.pos[2]))])]), tools: ["screwdriver"] });
  k.step({ title: "Tap the dowels into the cross dividers", detail: "Four into the edge of each that meets the middle panel.", fix: cross.map((c) => dowels(c, spine, [0.15, 0.4, 0.6, 0.85])), tools: ["hammer"] });
  k.step({ title: "Lock the cross dividers to the middle panel", detail: "Push one onto each side of it, over the pins, and turn the four cam locks.", fix: cross.map((c) => at("cam", c, [180, 300].map((y): Vec3 => [c.pos[0] - t / 2, y, c.pos[2] - Math.sign(c.pos[2]) * (cw / 2 - 40)]), [1, 0, 0], { dia: 15 })), tools: ["screwdriver"] });
  k.step({ title: "Prepare the floor rails", detail: "A plastic glide under each, one cam bolt in each, and three dowels.", fix: [...rails.map((r) => at("glide", r, [[0, 0, r.pos[2]]], [0, 1, 0], FOOT)), ...rails.map((r) => bolts(r, spine, [0.5], 0.5)), ...rails.map((r) => dowels(r, head, [0.5])), ...rails.map((r) => dowels(r, foot, [0.5])), ...rails.map((r, i) => dowels(r, cross[i], [0.5]))], tools: ["hammer", "screwdriver"] });
  k.step({ title: "Lower the middle panel onto the floor rails", detail: "The cross dividers rest on the rails. Turn a cam lock in the middle panel for each rail.", fix: rails.map((r) => at("cam", spine, [[0, rh + 30, 0]].map((p): Vec3 => [p[0] + 80, p[1], Math.sign(r.pos[2]) * (t / 2)]), [0, 0, -Math.sign(r.pos[2])], { dia: 15 })), tools: ["screwdriver"] });
  k.step({ title: "Prepare the head and foot panels", detail: "Two runners on each, three screws each. Then two glides in the bottom edge, the connector pins and four cam bolts each.", add: ["head", "foot"], fix: [...run(head, 1, [zRun(1), zRun(-1)]), ...run(foot, -1, [zRun(1), zRun(-1)]), ...ends.map((e) => at("glide", e, [-1, 1].map((g): Vec3 => [e.pos[0], 0, g * (W / 2 - 120)]), [0, 1, 0], FOOT)), ...ends.map((e) => at("stud", e, sides.map((sd) => corner(e, sd)), [0, 1, 0], { len: 40, dia: 8 }))], tools: ["screwdriver", "hammer"] });
  k.step({ title: "Screw the cam bolts into the head and foot panels", detail: "Four in each: two for the middle panel and one for each floor rail.", fix: ends.flatMap((e) => [bolts(e, spine, [0.3, 0.7]), ...rails.map((r) => bolts(e, r, [0.5]))]), tools: ["screwdriver"] });
  k.step({ title: "Fit the head and foot panels and lock them", detail: "Push them onto the ends of the middle panel and the rails, then turn the eight cam locks.", fix: ends.flatMap((e) => [cams(e, spine, [0.3, 0.7], 1), ...rails.map((r) => cams(e, r, [0.5], 1))]), tools: ["screwdriver"] });
  k.step({ title: "Press the round connectors into the head and foot panels", detail: "One at each end of both, arrow pointing at the hole for the side.", fix: ends.map((e) => at("connector", e, sides.map((sd): Vec3 => { const p = corner(e, sd); return [e.pos[0] - Math.sign(e.pos[0]) * (t / 2), 380, p[2] - Math.sign(p[2]) * 60]; }), [Math.sign(e.pos[0]), 0, 0], { len: 14, dia: 40 })), tools: ["allen"] });
  k.step({ title: "Fit the long sides together", detail: "Two dowels in each end, then lift each side into place between the head and foot panels and turn the connectors with the Allen key until they pull tight.", add: ["sf", "sb"], fix: sides.flatMap((sd) => ends.map((e) => dowels(e, sd, [0.25, 0.75], 0.5))), tools: ["hammer", "allen"], people: 2 });
  k.step({ title: "Screw the brackets under the floor rails", detail: "A small bracket joins each rail to the head panel, two screws each.", fix: rails.flatMap((r) => [at("angle", r, [[-Ls / 2 + 20, rh, r.pos[2]]], [0, -1, 0], { len: 30, dia: 24 }), at("screw", r, [-1, 1].map((e): Vec3 => [-Ls / 2 + 20 + e * 10, rh, r.pos[2]]), [0, -1, 0], { len: 12, dia: 4 })]), tools: ["screwdriver"] });
  k.step({ title: "Screw the slat ledges inside the long sides", detail: "Two metal ledges along each side, four screws each.", add: ledges.map((p) => p.id), fix: ledges.map((l) => at("screw", l, spread(l.pos[0] - l.size[0] / 2 + 60, l.pos[0] + l.size[0] / 2 - 60, 4).map((x): Vec3 => [x, yTop - 15, Math.sign(l.pos[2]) * (W / 2 - t)]), [0, 0, Math.sign(l.pos[2])], { len: 16, dia: 4 })), tools: ["screwdriver"] });
  k.step({ title: "Screw the support strips along the middle panel", detail: "Four angle strips, two along each face, top edge level with the ledges. Three screws each.", add: strips.map((p) => p.id), fix: strips.map((p) => at("screw", p, spread(p.pos[0] - p.size[0] / 2 + 80, p.pos[0] + p.size[0] / 2 - 80, 3).map((x): Vec3 => [x, yTop - 12, Math.sign(p.pos[2]) * (t / 2 + 2)]), [0, 0, -Math.sign(p.pos[2])], { len: 12, dia: 4 })), tools: ["screwdriver"] });
  k.step({ title: "Fit the fixings for the slatted base", detail: "Eight inserts in the head and foot panels, one screw each. They hold the base from sliding.", fix: ends.flatMap((e) => [at("nut", e, spread(-W / 2 + 150, W / 2 - 150, 4).map((z): Vec3 => [e.pos[0] - Math.sign(e.pos[0]) * (t / 2), yTop + 10, z]), [Math.sign(e.pos[0]), 0, 0], { len: 8, dia: 10 }), at("screw", e, spread(-W / 2 + 150, W / 2 - 150, 4).map((z): Vec3 => [e.pos[0] - Math.sign(e.pos[0]) * (t / 2), yTop + 10, z]), [Math.sign(e.pos[0]), 0, 0], { len: 10, dia: 4 })]), tools: ["screwdriver"] });
  k.step({ title: "Screw on the headboard brackets", detail: "Only if you fit a headboard: two brackets on the outside of the head panel, two screws each.", fix: [at("plate", head, [-1, 1].map((g): Vec3 => [-L / 2, H - 120, g * (W / 2 - 200)]), [1, 0, 0], { len: 60, dia: 60 }), at("screw", head, [-1, 1].flatMap((g) => [-20, 20].map((e): Vec3 => [-L / 2, H - 120 + e, g * (W / 2 - 200)])), [1, 0, 0], { len: 16, dia: 5 })], tools: ["screwdriver"] });
  k.step({ title: "Roll out the slatted base", detail: "It is sold separately. Lay it on the ledges and the middle strips.", add: ["slats"] });
  buildCustom(b, { ...s, custom: k.recipe });
  // the front drawers first, so the one built on screen faces you
  drawers(b, [...ds.filter((d) => !d.flip), ...ds.filter((d) => d.flip)], { bumpers: 2 });
  void spine;
  return true;
}

/* ---------- the day bed: a pull-out base with two drawers, inside a frame of two ends, a back and a front rail ---------- */

function dayBed(b: PlanBuilder, s: ProductSpec) {
  const L = 2050, D = 870, H = Math.round(s.size.h * 10) || 580;
  const k = new Kit(L, H, D);
  const t = 18;
  // the pull-out base, closed under the front rail
  const py0 = 45, py1 = 320, pd = 720;
  const zpf = D / 2 - t / 2, zpb = D / 2 - pd + t / 2;
  const pl = L - 60;
  const post = 70;
  const frontPieces: PartPiece[] = [
    { shape: "box", size: [pl, 40, t], pos: [0, (py1 - py0) / 2 - 20, 0] },
    { shape: "box", size: [pl, 30, t], pos: [0, -(py1 - py0) / 2 + 15, 0] },
    ...[-pl / 2 + post / 2, 0, pl / 2 - post / 2].map((x): PartPiece => ({ shape: "box", size: [post, py1 - py0 - 70, t], pos: [x, -5, 0] })),
  ];
  const pf = k.part("pf", "Pull-out front", [pl, py1 - py0, t], [0, (py0 + py1) / 2, zpf], { pieces: frontPieces });
  const pb = k.part("pb", "Pull-out back", [pl, py1 - py0, t], [0, (py0 + py1) / 2, zpb]);
  const bx = [-pl / 2 + t / 2, 0, pl / 2 - t / 2];
  const beams = bx.map((x, i) => k.part(`bm${i}`, "Beam", [t, py1 - py0 - 30, pd - 2 * t], [x, py0 + (py1 - py0 - 30) / 2, (zpf + zpb) / 2]));
  const prails = [zpf - t / 2 - 12, zpb + t / 2 + 12].map((z, i) => k.part(`pr${i}`, "Slat rail", [pl - 2 * t, 20, 24], [0, py1 - 10 - 30, z], { material: "metal" }));
  const nps = 13;
  const pslats = range(nps).map((i) => k.part(`ps${i}`, "Slat", [55, 12, pd - 2 * t], [-pl / 2 + 80 + ((pl - 160) * i) / (nps - 1), py1 - 30 + 6, (zpf + zpb) / 2], { material: "wood" }));
  // the frame
  const ends = [-1, 1].map((g) => k.part(`e${g}`, "End panel", [t, H, D], [g * (L / 2 - t / 2), H / 2, 0]));
  const back = k.part("back", "Back panel", [L - 2 * t, H, t], [0, H / 2, -D / 2 + t / 2]);
  const ry0 = py1 + 4, ry1 = ry0 + 80;
  const front = k.part("front", "Front rail", [L - 2 * t, ry1 - ry0, t], [0, (ry0 + ry1) / 2, D / 2 - t / 2]);
  const ys = ry1 - 20;
  const ledges = [-D / 2 + t + 12, D / 2 - t - 12].map((z, i) => k.part(`ml${i}`, "Slat rail", [L - 2 * t, 20, 24], [0, ys - 10, z], { material: "metal" }));
  const nms = 12;
  const mslats = range(nms).map((i) => k.part(`ms${i}`, "Slat", [70, 15, D - 2 * t], [-L / 2 + 110 + ((L - 220) * i) / (nms - 1), ys + 7.5, 0], { material: "wood" }));
  const mattress = /mattress/i.test(s.variant) ? [0, 1].map((i) => k.part(`m${i}`, "Mattress", [L - 2 * t - 10, 100, D - 2 * t - 10], [0, ys + 15 + 50 + i * 100, 0], { material: "soft", extra: true })) : [];
  // drawers between the beams
  const bay = pl / 2 - t - t / 2;
  const ds: DrawerBox[] = [-1, 1].map((g) => ({ x: (g * (bay + t)) / 2, y0: py0 + 20, w: bay - 26, sh: 180, dd: pd - 2 * t - 40, zf: D / 2, fw: bay - 2 * post + 70, fh: py1 - py0 - 80, fy: (py0 + 30 + py1 - 40) / 2, handle: 200 }));
  const runLen = Math.round((ds[0].dd - 20) / 10) * 10;
  const run = (wall: Part, side: 1 | -1) => {
    const x = wall.pos[0] + side * (wall.size[0] / 2);
    const zc = D / 2 - t - 10 - runLen / 2;
    return [
      at("runner", wall, [[x + side * 5, ds[0].y0 + 4, zc]], [-side, 0, 0], { len: runLen, dia: 20 }),
      at("screw", wall, [-1, 0, 1].map((e): Vec3 => [x + side * 10, ds[0].y0 + 4, zc + e * (runLen / 2 - 40)]), [-side, 0, 0], { len: 12, dia: 4 }),
    ];
  };
  const slatClips = (rails: Part[], slats: Part[], n: number): CustomFix[] => {
    const pts = slats.flatMap((sl) => rails.map((r): Vec3 => [sl.pos[0], r.pos[1] + r.size[1] / 2, r.pos[2]]));
    const byRail = rails.map((r) => pts.filter((p) => p[2] === r.pos[2]).slice(0, Math.ceil(n / rails.length)));
    return rails.map((r, i) => at("clip", r, byRail[i].slice(0, i === 0 ? Math.ceil(n / 2) : Math.floor(n / 2)), [0, -1, 0], { len: 12, dia: 10 }));
  };

  // spots along each beam end, far enough apart that no two fittings share a hole
  const BEAM_DOWELS = [0.15, 0.35, 0.65, 0.85], OUTER = [0.25, 0.75], MIDDLE = [0.25, 0.5, 0.75];
  k.step({ title: "Screw the runners onto the beams", detail: "Lay the three beams on a rug. The middle one takes a runner on each face, the outer two one each, three screws each.", add: beams.map((p) => p.id), fix: [...run(beams[0], 1), ...run(beams[1], -1), ...run(beams[1], 1), ...run(beams[2], -1)], tools: ["screwdriver"], warnings: ["floor"] });
  k.step({ title: "Screw the castors under the beams", detail: "Two castors on each beam, two screws each.", fix: beams.flatMap((bm) => [at("castor", bm, [zpb + 120, zpf - 120].map((z): Vec3 => [bm.pos[0], py0, z]), [0, 1, 0], { len: 45, dia: 40 }), at("screw", bm, [zpb + 120, zpf - 120].flatMap((z) => [-25, 25].map((e): Vec3 => [bm.pos[0], py0, z + e])), [0, 1, 0], { len: 30, dia: 4 })]), tools: ["screwdriver"], pose: "-y" });
  k.step({ title: "Tap the dowels into the beams", detail: "Four into each end of every beam.", fix: beams.flatMap((bm) => [dowels(bm, pb, BEAM_DOWELS), dowels(bm, pf, BEAM_DOWELS)]), tools: ["hammer"], pose: "+y" });
  k.step({ title: "Screw the cam bolts into the back of the pull-out", detail: "Lay it on the rug, inside up. Seven bolts.", add: ["pb"], fix: [bolts(pb, beams[0], OUTER), bolts(pb, beams[1], MIDDLE), bolts(pb, beams[2], OUTER)], tools: ["screwdriver"], pose: "-z", warnings: ["floor"] });
  k.step({ title: "Stand the beams on the back and lock them", detail: "Push them onto the dowels and bolts, runners towards the middle, and turn the seven cam locks.", fix: [cams(pb, beams[0], OUTER, 1), cams(pb, beams[1], MIDDLE, 1), cams(pb, beams[2], OUTER, -1)], tools: ["screwdriver"] });
  k.step({ title: "Fit the front of the pull-out", detail: "Seven cam bolts in it first, then turn it over onto the beams and lock the seven cam locks.", add: ["pf"], fix: [bolts(pf, beams[0], OUTER), bolts(pf, beams[1], MIDDLE), bolts(pf, beams[2], OUTER), cams(pf, beams[0], OUTER, 1), cams(pf, beams[1], MIDDLE, 1), cams(pf, beams[2], OUTER, -1)], tools: ["screwdriver"] });
  k.step({ title: "Screw the front to the beams", detail: "Six long screws, two into each beam.", fix: beams.map((bm) => screws(pf, bm, [0.05, 0.95], { len: 60, dia: 5 })), tools: ["screwdriver"] });
  k.step({ title: "Screw the slat rails inside the pull-out", detail: "One along the front and one along the back, four screws each.", add: prails.map((p) => p.id), fix: prails.map((r) => at("screw", r, spread(-pl / 2 + 150, pl / 2 - 150, 4).map((x): Vec3 => [x, r.pos[1], r.pos[2] + (r.pos[2] > 0 ? 12 : -12)]), [0, 0, r.pos[2] > 0 ? 1 : -1], { len: 16, dia: 4 })), tools: ["screwdriver"], pose: "+y" });
  k.step({ title: "Lay the slats on the pull-out", detail: "Thirteen slats across the rails, clipped down at the ends.", add: pslats.map((p) => p.id), fix: slatClips(prails, pslats, 18) });
  k.step({ title: "Prepare the end panels", detail: "Two connector pins and two dowels into the back edge of each.", add: ends.map((p) => p.id), fix: ends.flatMap((e) => [at("stud", e, [[e.pos[0], H - 120, -D / 2 + t], [e.pos[0], 120, -D / 2 + t]], [0, 0, 1], { len: 40, dia: 8 }), dowels(e, back, [0.35, 0.65])]), tools: ["screwdriver", "hammer"] });
  k.step({ title: "Press the round connectors into the back panel", detail: "Two at each end, arrow pointing at the edge.", add: ["back"], fix: ends.map((e) => at("connector", back, [H - 120, 120].map((y): Vec3 => [Math.sign(e.pos[0]) * (L / 2 - t - 50), y, -D / 2 + t]), [0, 0, -1], { len: 14, dia: 40 })), tools: ["allen"] });
  k.step({ title: "Join the ends to the back together", detail: "Push each end onto the back and turn the connectors with the Allen key until they pull tight.", people: 2, tools: ["allen"] });
  k.step({ title: "Fit the front rail", detail: "Two plates join it to the end panels, with two screws at each end.", add: ["front"], fix: [...ends.map((e) => at("plate", front, [[Math.sign(e.pos[0]) * (L / 2 - t - 40), (ry0 + ry1) / 2, D / 2 - t]], [0, 0, 1], { len: 50, dia: 30 })), ...ends.map((e) => at("screw", e, [-25, 25].map((dy): Vec3 => [Math.sign(e.pos[0]) * (L / 2 - t - 2), (ry0 + ry1) / 2 + dy, D / 2 - t - 20]), [Math.sign(e.pos[0]), 0, 0], { len: 16, dia: 4 }))], tools: ["screwdriver"] });
  k.step({ title: "Tap the glides into the end panels", detail: "Two under each end.", fix: ends.map((e) => at("glide", e, [-D / 2 + 60, D / 2 - 60].map((z): Vec3 => [e.pos[0], 0, z]), [0, 1, 0], FOOT)), tools: ["hammer"] });
  k.step({ title: "Screw on the slat rails", detail: "One along the back panel and one along the front rail, four screws each.", add: ledges.map((p) => p.id), fix: ledges.map((r) => at("screw", r, spread(-L / 2 + 150, L / 2 - 150, 4).map((x): Vec3 => [x, r.pos[1], r.pos[2] + (r.pos[2] > 0 ? 12 : -12)]), [0, 0, r.pos[2] > 0 ? 1 : -1], { len: 16, dia: 4 })), tools: ["screwdriver"] });
  k.step({ title: "Lay the slats on the frame", detail: "Twelve slats, clipped onto the rails at both ends. Don't sit on it before they are all in.", add: mslats.map((p) => p.id), fix: slatClips(ledges, mslats, 12) });
  if (mattress.length) k.step({ title: "Put the mattresses on", detail: "One on the frame, one for the pull-out when you open it into a double bed.", add: mattress.map((p) => p.id), people: 2 });
  buildCustom(b, { ...s, custom: k.recipe });
  drawers(b, ds, { bumpers: 2 });
  void pb;
  return true;
}

/* ---------- the dressing table: a fixed top over a drawer, and a mirror lid over a tray ---------- */

function dressingTable(b: PlanBuilder, s: ProductSpec) {
  const W = 700, H = 770, D = 420;
  const k = new Kit(W, H, D);
  const xi = W / 2 - T;
  const L = k.part("L", "Side panel", [T, H - T, D], [-W / 2 + T / 2, (H - T) / 2, 0]);
  const R = k.part("R", "Side panel", [T, H - T, D], [W / 2 - T / 2, (H - T) / 2, 0]);
  const yC = H - T - 150; // top of the tray compartment's bottom
  const back = k.part("back", "Back rail", [2 * xi, 220, T], [0, H - T - 110, -D / 2 + T / 2]);
  const top = k.part("top", "Top panel", [W / 2, T, D], [-W / 4, H - T / 2, 0]);
  const div = k.part("div", "Divider", [T, H - T - (yC - T), D - T], [0, (yC - T + H - T) / 2, T / 2]);
  const cw = xi - T / 2;
  const bot = k.part("bot", "Tray bottom", [cw, T, D - 2 * T], [(T / 2 + xi) / 2, yC - T / 2, 0]);
  const front = k.part("front", "Front panel", [cw, H - T - (yC - T), T], [(T / 2 + xi) / 2, (yC - T + H - T) / 2, D / 2 - T / 2]);
  const lidPieces: PartPiece[] = [
    { shape: "box", size: [W / 2 - 4, T, D - 4], pos: [0, 0, 0] },
    { shape: "box", size: [W / 2 - 80, 4, D - 80], pos: [0, -T / 2 - 2, 0], material: "fiber" },
  ];
  const lid = k.part("lid", "Mirror lid", [W / 2 - 4, T + 4, D - 4], [W / 4, H - T / 2 - 2, 0], { pieces: lidPieces });
  const trayPieces: PartPiece[] = [
    { shape: "box", size: [cw - 12, 6, D - 2 * T - 30], pos: [0, -27, 0] },
    { shape: "box", size: [8, 60, D - 2 * T - 30], pos: [-(cw - 12) / 2 + 4, 0, 0] },
    { shape: "box", size: [8, 60, D - 2 * T - 30], pos: [(cw - 12) / 2 - 4, 0, 0] },
    { shape: "box", size: [cw - 28, 60, 8], pos: [0, 0, -(D - 2 * T - 30) / 2 + 4] },
    { shape: "box", size: [cw - 28, 60, 8], pos: [0, 0, (D - 2 * T - 30) / 2 - 4] },
  ];
  const tray = k.part("tray", "Tray", [cw - 12, 60, D - 2 * T - 30], [(T / 2 + xi) / 2, yC + 30, 0], { pieces: trayPieces, material: "soft" });
  const ds = stackDrawers({ x0: -xi, x1: -T / 2, y0: yC - T, y1: H - T - 2, n: 1, zf: D / 2, dd: D - 2 * T - 30, handle: 160 });
  ds[0].w = ds[0].w + 16;
  const slide = (wall: Part, side: 1 | -1) => at("runner", wall, [[wall.pos[0] + side * (wall.size[0] / 2 + 5), ds[0].y0 + 4, ds[0].zf - T - ds[0].dd / 2]], [-side, 0, 0], { len: 320, dia: 12 });
  const slideScrews = (wall: Part, side: 1 | -1) => at("screw", wall, spread(-D / 2 + 80, D / 2 - 60, 4).map((z): Vec3 => [wall.pos[0] + side * (wall.size[0] / 2 + 10), ds[0].y0 + 4, z]), [-side, 0, 0], { len: 12, dia: 3.5 });

  k.step({ title: "Prepare the left side", detail: "Lay it on a rug. Two cam bolts for the back rail, and two plastic feet into the bottom edge.", add: ["L"], fix: [bolts(L, back, [0.3, 0.7]), ...feet([L], 2, D)], tools: ["screwdriver", "hammer"], pose: "+x", warnings: ["floor"] });
  k.step({ title: "Stand the back rail in the left side", detail: "Two dowels, then push it on and turn its two cam locks.", add: ["back"], fix: [dowels(L, back, [0.2, 0.8]), cams(L, back, [0.3, 0.7], 1)], tools: ["hammer", "screwdriver"] });
  k.step({ title: "Fit the top over the drawer", detail: "Stand it up. Four cam bolts in the top, dowels in the left side and the back rail, then press it on the left half and lock it.", add: ["top"], fix: [bolts(top, L, [0.2, 0.8]), bolts(top, back, [0.3, 0.7]), dowels(L, top, [0.35, 0.65]), dowels(back, top, [0.4, 0.8]), cams(top, L, [0.2, 0.8], 1), cams(top, back, [0.3, 0.7], 1)], tools: ["screwdriver", "hammer"], pose: "+y" });
  k.step({ title: "Fit the divider under the top", detail: "Two dowels into its top edge, then one long connector screw down through the top into it.", add: ["div"], fix: [dowels(div, top, [0.25, 0.75]), screws(top, div, [0.5], LONG_SCREW)], tools: ["hammer", "allen"] });
  k.step({ title: "Screw the drawer rails on", detail: "A plastic rail on the left side and one on the divider, four screws each.", fix: [slide(L, 1), slideScrews(L, 1), slide(div, -1), slideScrews(div, -1)], tools: ["screwdriver"] });
  k.step({ title: "Fit the bottom of the tray space", detail: "Two cam bolts in the divider and two dowels in the end of the bottom, then push it onto the divider and lock the two cam locks.", add: ["bot"], fix: [bolts(div, bot, [0.3, 0.7]), dowels(bot, div, [0.15, 0.85]), cams(div, bot, [0.3, 0.7], 1)], tools: ["screwdriver", "hammer"] });
  k.step({ title: "Put the right side on", detail: "Cam bolts and feet go in first, like the left. Dowels in the back rail and the bottom, then press it on and lock its four cam locks.", add: ["R"], fix: [bolts(R, back, [0.3, 0.7]), bolts(R, bot, [0.3, 0.7]), ...feet([R], 2, D), dowels(R, back, [0.2, 0.8]), dowels(bot, R, [0.15, 0.85]), cams(R, back, [0.3, 0.7], 1), cams(R, bot, [0.3, 0.7], 1)], tools: ["screwdriver", "hammer"] });
  k.step({ title: "Fit the front panel", detail: "A cam bolt and a dowel at each end, two long connector screws through it into the bottom, then lock the two cam locks.", add: ["front"], fix: [bolts(R, front, [0.5]), bolts(div, front, [0.5]), dowels(front, R, [0.2]), dowels(front, div, [0.2]), screws(front, bot, [0.3, 0.7], LONG_SCREW), cams(R, front, [0.5], -1), cams(div, front, [0.5], -1)], tools: ["screwdriver", "allen", "hammer"] });
  k.step({ title: "Hinge the mirror lid on", detail: "Two flat hinges along its back edge into the back rail, two screws each. Then the lid stay at the right, so it stays open.", add: ["lid"], fix: [at("flatHinge", lid, [-1, 1].map((g): Vec3 => [W / 4 + g * 100, H - T, -D / 2 + 20]), [0, 1, 0], { len: 60, dia: 34 }), at("screw", back, [-1, 1].flatMap((g) => [-25, 25].map((e): Vec3 => [W / 4 + g * 100 + e, H - T - 4, -D / 2 + T])), [0, 0, -1], { len: 12, dia: 3.5 }), at("gasLift", lid, [[xi - 30, H - T - 60, 0]], [1, 0, 0], { len: 200, dia: 20 }), at("screw", lid, [-1, 1].map((e): Vec3 => [xi - 30, H - T - 14, e * 80]), [0, 1, 0], { len: 12, dia: 3.5 })], tools: ["screwdriver"] });
  k.step({ title: "Put the tray in", detail: "It sits on the bottom under the lid.", add: ["tray"] });
  buildCustom(b, { ...s, custom: k.recipe });
  drawers(b, ds, { bumpers: 2, plain: true });
  return true;
}

/* ---------- headboard with storage compartment ---------- */

/**
 * The headboard, read from its manual. The front frame is built face down: long cam rods and big dowels join the
 * legs and the middle stile to the top rail, the two filler panels slide down the grooves and the bottom rail closes
 * them. Behind it go two open end boxes (a bottom, an inner side and a back each) and the long compartment between
 * them, built on the rug and lowered onto dowels and cam bolts in the frame's back, with a divider in the middle.
 * Stood up and fixed to the wall, the lid goes on top and a shelf slides into each end box.
 */
function headboardRecipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 1580, H = Math.round(s.size.h * 10) || 1110, D = Math.round(s.size.d * 10) || 280;
  const t = 18, zf = D / 2 - t / 2, zb = zf - t / 2; // the front frame and its back face
  const lw = 110, rh = 110, xl = W / 2 - lw / 2, xin = W / 2 - lw; // legs and their inner edge
  const yTr = H - rh / 2, yBr = 420 + rh / 2; // top and bottom rails
  const yPan0 = 420 + rh, yPan1 = H - rh;
  const bw = 290, xs = W / 2 - bw - t / 2, xe = W / 2 - bw / 2 + t / 4; // end boxes: inner side and the box's middle
  const dz = D - 2 * t, zc = (zb + -D / 2) / 2 + t / 2; // box depth behind the frame and its centre
  const zk = -D / 2 + t / 2; // backs
  const y0 = 420, yLid = H - t; // the boxes stand on the bottom rail's level, under the lid
  const yC = H - rh; // the compartment's floor, level with the top rail's lower edge
  const P = (id: string, name: string, size: Vec3, pos: Vec3, material: CustomPart["material"] = "board"): CustomPart => ({ id, name, size, pos, material });
  const parts: CustomPart[] = [
    P("TR", "Top rail", [2 * xin, rh, t], [0, yTr, zf]),
    ...[-1, 1].map((g, i) => P(`L${i}`, "Leg", [lw, H, t], [g * xl, H / 2, zf])),
    P("ST", "Middle stile", [lw, yPan1 - yPan0, t], [0, (yPan0 + yPan1) / 2, zf]),
    ...[-1, 1].map((g, i) => P(`F${i}`, "Filler panel", [xin - lw / 2, yPan1 - yPan0, 8], [g * (xin + lw / 2) / 2, (yPan0 + yPan1) / 2, zf], "fiber")),
    P("BR", "Bottom rail", [2 * xin, rh, t], [0, yBr, zf]),
    ...[-1, 1].flatMap((g, i) => [
      P(`EB${i}`, "End box bottom", [bw - t, t, dz], [g * (xs + t / 2 + (bw - t) / 2), y0 + t / 2, zc]),
      P(`ES${i}`, "End box side", [t, yLid - y0, dz], [g * xs, (y0 + yLid) / 2, zc]),
      P(`EK${i}`, "End box back", [bw, yLid - y0, t], [g * (xs - t / 2 + bw / 2), (y0 + yLid) / 2, zk]),
    ]),
    P("CB", "Compartment bottom", [2 * xs - t, t, dz], [0, yC + t / 2, zc]),
    P("CK", "Compartment back", [2 * (xs - t / 2) - 2 * t, yLid - yC - t, t], [0, (yC + t + yLid) / 2, zk]),
    P("DV", "Divider", [t, yLid - yC - t, dz], [0, (yC + t + yLid) / 2, zc]),
    P("LD", "Lid", [W, t, D - t], [0, H - t / 2, zc - t / 2 + t / 2]),
    ...[-1, 1].map((g, i) => P(`SH${i}`, "Shelf", [bw - t, t, dz - 10], [g * (xs + t / 2 + (bw - t) / 2), 760, zc])),
  ];
  const fx = (kind: CustomFix["kind"], on: string | undefined, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at, ...o });
  const ROD = { name: "Cam rod", len: 90, dia: 7 };
  const BIG = { len: 40, dia: 10 };
  const CB = { len: 34, dia: 6 };
  const CAM = { dia: 15 };
  const rodPts = (y: number, ym: number): Vec3[] => [[-xin, y, zf], [xin, y, zf], [0, ym, zf]];
  const rodDirs = (y: number, ym: number, on: string) => [fx("camScrew", on, [-1, 0, 0], [rodPts(y, ym)[0]], ROD), fx("camScrew", on, [1, 0, 0], [rodPts(y, ym)[1]], ROD), fx("camScrew", on, [0, ym > y ? 1 : -1, 0], [rodPts(y, ym)[2]], ROD)];
  const bigDowels = (y: number, ym: number, on: string, sy: number) => [
    ...[-1, 1].map((g) => fx("dowel", on, [-g, 0, 0], [-35, 35].map((d) => [g * xin, y + d, zf] as Vec3), BIG)),
    fx("dowel", on, [0, -sy, 0], [-35, 35].map((d) => [d, ym, zf] as Vec3), BIG),
  ];
  const locks = (y: number, ym: number): CustomFix[] => [
    fx("cam", undefined, [0, 0, 1], [[-xin + 30, y, zb], [xin - 30, y, zb], [0, ym + (ym > y ? -30 : 30), zb], [-xl, y, zb], [xl, y, zb], [0, ym + (ym > y ? 40 : -40), zb]], CAM),
  ];
  const boxIds = ["EB0", "ES0", "EK0", "EB1", "ES1", "EK1", "CB", "CK"];
  const UP: Vec3 = [0, 0, -700];
  const fromUp = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, UP]));
  const frameBolts: Vec3[] = [
    ...[-1, 1].flatMap((g) => [yBr, yTr].map((y): Vec3 => [g * xs, y, zb])),
    ...[-1, 1].map((g): Vec3 => [g * (xs + bw / 2), y0 + t / 2, zb]),
    ...[-420, 0, 420].map((x): Vec3 => [x === 0 ? 200 : x, yC + t / 2, zb]),
    [0, yC + t + 40, zb],
  ];
  const steps: CustomStep[] = [
    { title: "Fit the cam rods into the top rail", detail: "Lay it face down on a rug. One rod in each end and one in the middle of the lower edge.", add: ["TR"], fix: rodDirs(yTr, yPan1, "TR"), pose: "-z", warnings: ["floor"], tools: ["screwdriver"] },
    {
      title: "Join the legs and the stile to the top rail",
      detail: "Two big dowels at each joint, then push the legs onto the ends and the stile onto the middle.",
      add: ["L0", "L1", "ST"],
      fix: bigDowels(yTr, yPan1, "TR", 1),
      from: { L0: [-260, 0, 0], L1: [260, 0, 0], ST: [0, -260, 0] },
      tools: ["hammer"],
    },
    { title: "Lock the top joints", detail: "Six cam locks, arrow to the rod, then clockwise.", fix: locks(yTr, yPan1), tools: ["screwdriver"] },
    { title: "Slide the filler panels in", detail: "Down the grooves from the open end, smooth side facing down.", add: ["F0", "F1"], from: { F0: [0, -500, 0], F1: [0, -500, 0] } },
    { title: "Fit the cam rods into the bottom rail", detail: "Three, the same way.", fix: rodDirs(yBr, yPan0, "BR"), wait: ["BR"], from: { BR: [0, -300, 0] }, tools: ["screwdriver"] },
    { title: "Push on the bottom rail", detail: "Two big dowels at each joint, over the ends of the filler panels.", add: ["BR"], fix: bigDowels(yBr, yPan0, "BR", -1), from: { BR: [0, -300, 0] }, tools: ["hammer"] },
    { title: "Lock the bottom joints", detail: "Six more cam locks.", fix: locks(yBr, yPan0), tools: ["screwdriver"] },
    { title: "Screw cam bolts into the back of the frame", detail: "Ten, into the holes on the back of the rails, by hand.", fix: [fx("camScrew", undefined, [0, 0, 1], frameBolts, CB)], tools: ["screwdriver"] },
    { title: "Screw cam bolts into the end box bottoms", detail: "Two in each, on the rug next to the frame.", fix: [-1, 1].map((g, i) => fx("camScrew", `EB${i}`, [g, 0, 0], [-80, 80].map((d) => [g * (xs + t / 2), y0 + t / 2, zc + d] as Vec3), CB)), wait: boxIds, from: fromUp(boxIds), tools: ["screwdriver"] },
    { title: "Join the end boxes", detail: "The side onto the bottom's bolts, the back on two dowels.", fix: [-1, 1].map((g, i) => fx("dowel", `EK${i}`, [0, 0, -1], [y0 + 120, yLid - 120].map((y) => [g * xs, y, zk + t / 2] as Vec3), { mate: `ES${i}` })), tools: ["hammer"] },
    { title: "Lock the end boxes", detail: "Four cam locks in the sides.", fix: [-1, 1].map((g, i) => fx("cam", `ES${i}`, [g, 0, 0], [-80, 80].map((d) => [g * (xs - t / 2), y0 + 40, zc + d] as Vec3), CAM)), tools: ["screwdriver"] },
    {
      title: "Screw cam bolts into the compartment panels",
      detail: "Two in each end of the long bottom and the long back.",
      fix: [-1, 1].flatMap((g) => [
        fx("camScrew", "CB", [-g, 0, 0], [-70, 70].map((d) => [g * (xs - t / 2), yC + t / 2, zc + d] as Vec3), CB),
        fx("camScrew", "CK", [-g, 0, 0], [yC + 40, yLid - 30].map((y) => [g * (xs - t / 2 - t), y, zk] as Vec3), CB),
      ]),
      tools: ["screwdriver"],
    },
    {
      title: "Put the compartment between the end boxes",
      detail: "Two dowels join the bottom to the back, and eight go into the box sides.",
      fix: [
        fx("dowel", "CB", [0, 0, 1], [-300, 300].map((x) => [x, yC + t / 2, -D / 2 + t] as Vec3), { mate: "CK" }),
        ...[-1, 1].map((g) => fx("dowel", "CB", [-g, 0, 0], [-110, -30, 30, 110].map((d) => [g * (xs - t / 2), yC + t / 2 + (Math.abs(d) < 50 ? 0 : 0), zc + d] as Vec3))),
      ],
      tools: ["hammer"],
    },
    { title: "Lock the compartment", detail: "Eight cam locks in the box sides.", fix: [-1, 1].map((g, i) => fx("cam", `ES${i}`, [-g, 0, 0], [-70, 70, -100, 100].map((d, k) => [g * (xs + t / 2), k < 2 ? yC + t / 2 : yC + 60, k < 2 ? zc + d : zk + 30] as Vec3), CAM)), tools: ["screwdriver"] },
    {
      title: "Lower the boxes onto the frame",
      detail: "Two people. Eight dowels in the frame's back first, then lay the boxes on so the bolts and dowels find their holes.",
      add: boxIds,
      from: fromUp(boxIds),
      fix: [fx("dowel", undefined, [0, 0, 1], [...[-1, 1].flatMap((g) => [yBr + 30, yTr - 30].map((y): Vec3 => [g * xs, y, zb])), ...[-1, 1].flatMap((g) => [-1, 1].map((k): Vec3 => [g * (xs + bw / 2) + k * 60, y0 + t / 2, zb]))], { mate: undefined })],
      people: 2,
      tools: ["hammer"],
    },
    { title: "Fit the divider", detail: "Two dowels in its bottom edge, then stand it in the middle of the compartment.", add: ["DV"], fix: [fx("dowel", "DV", [0, -1, 0], [-60, 60].map((d) => [0, yC + t, zc + d] as Vec3), { mate: "CB" })], from: { DV: [0, 0, -400] }, tools: ["hammer"] },
    { title: "Lock the boxes to the frame", detail: "Ten cam locks inside the boxes and the compartment.", fix: [fx("cam", undefined, [0, -1, 0], frameBolts.map(([x, y]) => [x, y + (y > yC ? 0 : 0), zb - 30] as Vec3), CAM)], tools: ["screwdriver"] },
    {
      title: "Screw the wall brackets onto the backs",
      detail: "One at the top of each end box back, two screws each.",
      fix: [
        fx("angle", undefined, [0, 0, 1], [-1, 1].map((g) => [g * (W / 2 - 80), yLid - 60, -D / 2] as Vec3), { name: "Wall bracket", len: 50, dia: 40 }),
        fx("screw", undefined, [0, 0, 1], [-1, 1].flatMap((g) => [-15, 15].map((d) => [g * (W / 2 - 80) + d, yLid - 40, -D / 2] as Vec3)), { len: 14, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Tap the glides on and stand it up", detail: "One under each leg, then lift it upright together.", fix: [fx("glide", undefined, [0, 1, 0], [-1, 1].map((g) => [g * xl, 0, zf] as Vec3), { name: "Glide strip" })], pose: "+y", people: 2, tools: ["hammer"] },
    {
      title: "Fix it to the wall",
      detail: "Screw the two keyhole plates to the wall, hook the brackets on and tighten. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        fx("bracket", undefined, [0, 0, -1], [-1, 1].map((g) => [g * (W / 2 - 80), yLid - 60, -D / 2 - 2] as Vec3), { name: "Wall plate", len: 50, dia: 30 }),
        fx("plug", undefined, [0, 0, -1], [-1, 1].map((g) => [g * (W / 2 - 80), yLid - 60, -D / 2 - 30] as Vec3)),
        fx("screw", undefined, [0, 0, -1], [-1, 1].map((g) => [g * (W / 2 - 80), yLid - 60, -D / 2 + 10] as Vec3), { len: 50, dia: 5 }),
      ],
      wall: true,
      warnings: ["wall", "tip"],
      tools: ["drill", "screwdriver", "pencil", "level"],
    },
    { title: "Click the lid stays on", detail: "One on top of each end box side, near the front.", fix: [fx("clip", undefined, [0, -1, 0], [-1, 1].map((g) => [g * xs, yLid, zb - 40] as Vec3), { name: "Lid stay", len: 30, dia: 30 })] },
    { title: "Screw cam bolts into the lid", detail: "Six on its underside.", fix: [fx("camScrew", "LD", [0, 1, 0], [-1, 1].flatMap((g) => [-80, 80].map((d) => [g * xs, yLid, zc + d] as Vec3)).concat([[0, yLid, zc - 60], [0, yLid, zc + 60]]), CB)], wait: ["LD"], from: { LD: [0, 300, 0] }, tools: ["screwdriver"] },
    { title: "Lay the lid on", detail: "Two dowels in the divider take it; its bolts drop into the sides.", add: ["LD"], fix: [fx("dowel", "DV", [0, 1, 0], [[0, yLid, zc - 100], [0, yLid, zc + 100]], { mate: "LD" })], from: { LD: [0, 300, 0] }, tools: ["hammer"] },
    { title: "Lock the lid", detail: "Six cam locks, in the box sides and the divider.", fix: [fx("cam", undefined, [1, 0, 0], [-1, 1].flatMap((g) => [-80, 80].map((d) => [g * xs - t / 2, yLid - 30, zc + d] as Vec3)).concat([[-t / 2, yLid - 30, zc - 60], [-t / 2, yLid - 30, zc + 60]]), CAM)], tools: ["screwdriver"] },
    { title: "Push in the shelf pins", detail: "Four in each end box, all at the same height.", fix: [fx("pin", undefined, [1, 0, 0], [-1, 1].flatMap((g) => [-90, 90].flatMap((d) => [[g * (xs + t / 2), 760 - t / 2, zc + d] as Vec3, [g * (W / 2 - 4), 760 - t / 2, zk + t / 2 + 4] as Vec3])), { len: 12, dia: 5 })] },
    { title: "Slide the shelves in", detail: "From the open ends, onto the pins.", add: ["SH0", "SH1"], from: { SH0: [-400, 0, 0], SH1: [400, 0, 0] } },
  ];
  return { parts, steps };
}

/* ---------- the family ---------- */

function kindOf(s: ProductSpec) {
  const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
  if (/headboard/.test(v)) return "headboard";
  if (/wardrobe/.test(v)) return /3 doors|3-doors/.test(v) ? "wardrobe3" : "wardrobe2";
  if (/chest of 3 drawers/.test(v)) return "chest3";
  if (/chest of 4 drawers/.test(v)) return "chest4";
  if (/bedside table/.test(v)) return "bedside";
  if (/day-bed|day bed/.test(v)) return "daybed";
  if (/bed frame/.test(v)) return "bed";
  if (/dressing table/.test(v)) return "dressing";
  if (/tv bench/.test(v)) return s.size.w >= 150 ? "tv3" : "tv2";
  if (/bookcase/.test(v)) return "bookcase";
  if (/cabinet with doors/.test(v) && s.size.w >= 70) return "cabinet";
  return null;
}

const family: Family = {
  names: ["BRIMNES"],
  build(b, s) {
    switch (kindOf(s)) {
      case "wardrobe2":
        return wardrobe(b, s, false);
      case "wardrobe3":
        return wardrobe(b, s, true);
      case "chest3":
        return chest(b, s, 3);
      case "chest4":
        return chest(b, s, 4);
      case "bedside":
        return bedside(b, s);
      case "bed":
        return storageBed(b, s);
      case "daybed":
        return dayBed(b, s);
      case "dressing":
        return dressingTable(b, s);
      case "tv2":
        return tvBench(b, s, 2);
      case "tv3":
        return tvBench(b, s, 3);
      case "bookcase":
        return bookcase(b, s);
      case "cabinet":
        return cabinet(b, s);
      case "headboard":
        buildCustom(b, { ...s, custom: headboardRecipe(s) });
        return true;
      default:
        return false;
    }
  },
};
export default family;
