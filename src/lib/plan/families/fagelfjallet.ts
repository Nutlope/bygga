import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "../builder";
import { buildCustom } from "../custom";

/*
 * FÅGELFJÄLLET, read from IKEA's manuals.
 *
 * The chests are built lying on the left side: cam bolts and runners on both sides, the rails stood in on dowels
 * and cam-locked at both ends, the profiled plinth bolted onto the bottom rail, then the frame goes onto its back for
 * the back panels (slid up the grooves from the bottom), the top (wall brackets and cam bolts, dowels in the sides),
 * the drawer interlock and its clips, and the feet pressed into the bottom edges. The 160 cm chests have a middle
 * panel with runners on both faces and rails in each half. Every drawer is the same: cam bolts in the front, sides
 * and cam locks, the bottom slid in (a wire support under the wide ones), the back on plastic cam dowels, the runner
 * catches and a cup handle. The nightstands and the wardrobe are cam-and-dowel carcasses on the same feet, with
 * clip-on hinges; the bed's headboard and footboard are frames and panels on double cam bolts, joined by side rails
 * bolted to the posts and pulled onto the footboard with round connectors, with roll-out boxes built on their fronts.
 */

const T = 18; // side panels
const TT = 25; // the top
const F = 12; // the feet under the bottom edges
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

// fittings, sized so different ones stay apart in the list
const CAM_BOLT = { len: 34 };
const LINK_BOLT = { len: 30, dia: 7 }; // the wide-headed connecting bolt turned with the Allen key
const RUNNER_SCREW = { len: 12, dia: 3.5 };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const WALL_SCREW: HwDef = { kind: "screw", len: 50, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 35, dia: 8 };
const WASHER: HwDef = HW.washer;
const BRACKET: HwDef = { kind: "bracket", len: 90, dia: 30 };
const CLIP = { len: 12, dia: 10, name: "Clip" };
const CATCH = { len: 14, dia: 12, name: "Catch" };
const LATCH = { len: 16, dia: 14, name: "Interlock latch" };
const RIVET = { len: 16, dia: 8, name: "Plastic rivet" };

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
  if (n < 0) throw new Error(`FÅGELFJÄLLET: ${a.id} and ${b.id} don't touch`);
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
const bolts = (face: Part, edge: Part, fr: number[], across?: number): CustomFix => ({ kind: "camScrew", count: fr.length, at: along(face, edge, fr, across), dir: toward(face, touch(face, edge)), on: face.id, mate: edge.id, ...CAM_BOLT });
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
/** Screws (or bolts) through `through` into `into`, from its far face. */
function screws(through: Part, into: Part, fr: number[], hw: { len: number; dia: number; name?: string }, across?: number, kind: CustomFix["kind"] = "screw"): CustomFix {
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
const at = (kind: CustomFix["kind"], on: Part, pts: Vec3[], dir: Vec3, hw: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on: on.id, ...hw });

class Kit {
  parts: Part[] = [];
  steps: CustomStep[] = [];
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

type StepOpts = { title: string; detail?: string; tools?: ToolId[]; pose?: Pose; scene?: string; kind?: StepKind; warnings?: WarnId[]; people?: 1 | 2; repeat?: number; wall?: boolean; check?: "square" };
const step = (b: PlanBuilder, o: StepOpts, body: () => void = () => {}) => b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);

/** One part type per name and size on a plan, so identical drawer and door parts share a letter. */
const typeCache = new WeakMap<PlanBuilder, Map<string, { type: string; mid: Vec3 }>>();
function typeOf(b: PlanBuilder, name: string, size: Vec3, o: { material?: "board" | "fiber" | "metal" | "wood" } = {}) {
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

/** A framed front: a raised frame round a sunken panel, as on every FÅGELFJÄLLET drawer and door. */
function framed(w: number, h: number, t: number, r = Math.min(70, h * 0.2)): PartPiece[] {
  return [
    { shape: "box", size: [w, r, t], pos: [0, h / 2 - r / 2, 0] },
    { shape: "box", size: [w, r, t], pos: [0, -h / 2 + r / 2, 0] },
    { shape: "box", size: [r, h - 2 * r, t], pos: [-w / 2 + r / 2, 0, 0] },
    { shape: "box", size: [r, h - 2 * r, t], pos: [w / 2 - r / 2, 0, 0] },
    { shape: "box", size: [w - 2 * r, h - 2 * r, t - 6], pos: [0, 0, -3] },
  ];
}

/* ---------- feet, the wall fixing ---------- */

/** The plastic feet pressed into the bottom edges: L-shaped at the back corners, straight ones at the front. */
function feet(k: Kit, o: { xo: number; zb: number; zf: number; mids?: number[] }) {
  const back = [-1, 1].map((g) =>
    k.part(`footB${g}`, "Back foot", [70, F, 70], [g * (o.xo - 35), F / 2, o.zb + 35], {
      pieces: [
        { shape: "box", size: [70, F, 22], pos: [0, 0, -24] },
        { shape: "box", size: [22, F, 70], pos: [24, 0, 0] },
      ],
      // one part for both corners: the left one is the right one turned a quarter
      rot: g < 0 ? [0, Math.PI / 2, 0] : undefined,
    }),
  );
  const front = [-1, 1].map((g) => k.part(`footF${g}`, "Front foot", [90, F, 22], [g * (o.xo - 45), F / 2, o.zf + 9]));
  const mids = (o.mids ?? []).map((z, i) => k.part(`footM${i}`, "Front foot", [22, F, 90], [0, F / 2, z]));
  return { back, front, mids };
}

/** The fixing in the box: the brackets under the top are pushed against the wall, marked, plugged and screwed. */
function wallSteps(b: PlanBuilder, o: { y: number; xs: number[]; zb: number; tall?: boolean }) {
  step(
    b,
    {
      title: "Fix it to the wall",
      detail: "Push it against the wall, slide the brackets back to touch it and mark through their slots. Drill, plug the holes and screw it on with a washer on each screw.",
      tools: ["screwdriver", "drill", "pencil"],
      kind: "anchor",
      wall: true,
      people: o.tall ? 2 : 1,
      warnings: o.tall ? ["wall", "tip", "two"] : ["wall", "tip"],
    },
    () => {
      b.stagger(0.15);
      for (const x of o.xs) b.fit(WALL_PLUG, { at: [x, o.y + 40, o.zb - 2], dir: [0, 0, -1] });
      b.then(0.1);
      for (const x of o.xs) b.fit(WASHER, { at: [x, o.y + 40, o.zb + 3], dir: [0, 0, -1] });
      b.then(0.05);
      for (const x of o.xs) b.fit(WALL_SCREW, { at: [x, o.y + 40, o.zb + 4], dir: [0, 0, -1] });
    },
  );
}

/** Brackets screwed under the top at the back, with a washer under each screw: a recipe step's fittings. */
function bracketFixes(top: Part, xs: number[], zb: number): CustomFix[] {
  const y = top.pos[1] - top.size[1] / 2;
  return [
    at("bracket", top, xs.map((x): Vec3 => [x, y, zb + 16]), [0, 1, 0], BRACKET),
    at("washer", top, xs.map((x): Vec3 => [x, y - 2, zb + 30]), [0, 1, 0], { len: WASHER.len, dia: WASHER.dia }),
    at("screw", top, xs.map((x): Vec3 => [x, y - 3, zb + 30]), [0, 1, 0], { len: BRACKET_SCREW.len, dia: BRACKET_SCREW.dia }),
  ];
}

/** Runners screwed to the inside of a wall for each drawer: three screws each, the wheel at the front. */
function wallRunners(wall: Part, side: 1 | -1, ys: number[], zf: number, len: number): CustomFix[] {
  const x = wall.pos[0] + side * (wall.size[0] / 2);
  return [
    at("runner", wall, ys.map((y): Vec3 => [x + side * 5, y, zf - 10 - len / 2]), [-side, 0, 0], { len, dia: 20 }),
    at("screw", wall, ys.flatMap((y) => [zf - 40, zf - 10 - len / 2, zf - len + 20].map((z): Vec3 => [x + side * 10, y, z])), [-side, 0, 0], RUNNER_SCREW),
  ];
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
  wire: boolean; // a wire support under the bottom (the wide drawers)
}

/**
 * The drawers, as every FÅGELFJÄLLET manual builds them: one of each size is built on screen (with "do this for
 * each"), the others slide in at the end with their fittings already on.
 */
function drawers(b: PlanBuilder, list: DrawerBox[]) {
  if (!list.length) return;
  const ft = 20, st = 12;
  const made = list.map((d) => {
    const zIn = d.zf - ft;
    const xs = d.w / 2 - st / 2;
    const zc = zIn - d.dd / 2;
    const { type, mid } = compoundOf(b, "Drawer front", framed(d.fw, d.fh, ft));
    const front = b.place(type, [d.x + mid[0], d.fy + mid[1], d.zf - ft / 2 + mid[2]]);
    const sideT = typeOf(b, "Drawer side", [st, d.sh, d.dd]);
    const sides = [-1, 1].map((g) => b.place(sideT, [d.x + g * xs, d.y0 + d.sh / 2, zc]));
    const backT = typeOf(b, "Drawer back", [d.w - 2 * st, d.sh - 14, st]);
    const back = b.place(backT, [d.x, d.y0 + 14 + (d.sh - 14) / 2, zIn - d.dd + st / 2]);
    const botT = typeOf(b, "Drawer bottom", [d.w - 2 * st + 10, 3, d.dd - st - 4], { material: "fiber" });
    const bottom = b.place(botT, [d.x, d.y0 + 9, zc + st / 2 - 2]);
    return { d, front, sides, back, bottom, zIn, xs, zc };
  });
  type M = (typeof made)[number];
  const PIN: HwDef = { kind: "camScrew", len: 30, dia: 7, name: "Plastic cam dowel" };
  const BOLT: HwDef = { kind: "camScrew", len: 24, dia: 6 };
  const CAM: HwDef = { kind: "cam", len: 11, dia: 12 };
  const WIRE: HwDef = { kind: "clip", len: 60, dia: 8, name: "Bottom support" };
  const RING: HwDef = { kind: "clip", len: 20, dia: 18, name: "Interlock ring" };
  const SCR: HwDef = { kind: "screw", ...RUNNER_SCREW };
  const HANDLE: HwDef = { kind: "handle", len: 96, dia: 28, name: "Cup handle" };
  const HSCR: HwDef = { kind: "screw", len: 25, dia: 4 };
  const per = <X>(m: M, fn: (g: -1 | 1, side: string) => X[]) => [...fn(-1, m.sides[0]), ...fn(1, m.sides[1])];
  const fitsOf = (m: M) => {
    const { d, zIn, xs } = m;
    const zBack = zIn - d.dd + st / 2;
    return {
      bolts: per(m, (g, sd) => [0.25, 0.75].map((f): FitOpts => ({ on: m.front, at: [d.x + g * xs, d.y0 + d.sh * f, zIn], dir: [0, 0, 1], mate: sd, mateHole: 4 }))),
      cams: per(m, (g, sd) => [0.25, 0.75].map((f): FitOpts => ({ on: sd, at: [d.x + g * (xs - st / 2), d.y0 + d.sh * f, zIn - 26], dir: [g, 0, 0] }))),
      wire: d.wire ? [{ on: m.bottom, at: [d.x, d.y0 + 6, m.zc], dir: [0, 1, 0], hole: false, twist: Math.PI / 2 } as FitOpts] : [],
      ring: [{ on: m.back, at: [d.x + d.w / 2 - st - 40, d.y0 + d.sh / 2, zBack - st / 2], dir: [0, 0, 1], hole: false } as FitOpts],
      pins: per(m, (g, sd) => [0.35, 0.8].map((f): FitOpts => ({ on: sd, at: [d.x + g * (xs + st / 2), d.y0 + 14 + (d.sh - 14) * f, zBack], dir: [-g, 0, 0], mate: m.back }))),
      backCams: per(m, (g) => [0.35, 0.8].map((f): FitOpts => ({ on: m.back, at: [d.x + g * (xs - st / 2 - 26), d.y0 + 14 + (d.sh - 14) * f, zBack + st / 2], dir: [0, 0, -1] }))),
      runScrews: per(m, (g, sd) => [zIn - 40, m.zc, zIn - d.dd + 40].map((z): FitOpts => ({ on: sd, at: [d.x + g * (xs + st / 2 + 2), d.y0 + 6, z], dir: [-g, 0, 0] }))),
      handle: [{ on: m.front, at: [d.x, d.fy + d.fh * 0.12, d.zf], dir: [0, 0, -1], hole: false } as FitOpts],
      hScrews: [-1, 1].map((g): FitOpts => ({ on: m.front, at: [d.x + g * 32, d.fy + d.fh * 0.12, zIn], dir: [0, 0, 1] })),
    };
  };
  const kinds = new Map<string, M[]>();
  for (const m of made) {
    const key = `${Math.round(m.d.w)}x${Math.round(m.d.sh)}x${Math.round(m.d.fh)}`;
    kinds.set(key, [...(kinds.get(key) ?? []), m]);
  }
  const shown = [...kinds.values()].map((g) => g[0]);
  const n = made.length;
  const rep = n > 1 ? n : undefined;
  const span = Math.max(...shown.map((m) => m.d.fw)) + 200;
  const offs = shown.map((_, i) => (i - (shown.length - 1) / 2) * span);
  const stage = (m: M, i: number, k: string, from?: Vec3) => {
    const it = b.partItem(k);
    const c: Vec3 = [m.d.x, m.d.y0 + m.d.sh / 2, m.zc];
    b.stage(k, [it.final.pos[0] - c[0] + offs[i], it.final.pos[1] - c[1], it.final.pos[2] - c[2]], it.final.rot, from);
  };
  const fs = shown.map(fitsOf);
  const each = (fn: (m: M, i: number) => void) => shown.forEach(fn);
  const ds = (o2: StepOpts, body: () => void) => step(b, { scene: "drawer", repeat: rep, kind: "drawer", pose: "-z", ...o2 }, body);
  const the = n > 1 ? "each" : "the";
  const wired = shown.some((m) => m.d.wire);

  ds({ title: `Screw the cam bolts into ${the} drawer front`, detail: "Lay the front face down on a rug. Four bolts, by hand until they stop.", tools: ["screwdriver"], kind: "cams", warnings: ["face"] }, () => {
    each((m, i) => stage(m, i, m.front, [0, 0, -200]));
    b.then(0.15);
    each((_, i) => b.fits(BOLT, fs[i].bolts, 0.08));
  });
  ds({ title: "Stand the sides on the front", detail: "The grooves for the bottom face in and down. Guide the bolts into the holes in the ends.", kind: "join" }, () => {
    b.stagger(0.25);
    each((m, i) => m.sides.forEach((sd) => stage(m, i, sd, [0, 0, -260])));
  });
  ds({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls the side tight.", tools: ["screwdriver"], kind: "cams" }, () => each((_, i) => b.fits(CAM, fs[i].cams, 0.1)));
  ds({ title: "Slide in the drawer bottom", detail: "Smooth side up, along the grooves until it reaches the front.", kind: "drawer" }, () => each((m, i) => stage(m, i, m.bottom, [0, 0, -400])));
  if (wired)
    ds({ title: "Tap the wire support into the bottom", detail: "Only on the wide drawers. It clips into the groove of the front and the back holds it, so the bottom can't sag.", tools: ["hammer"], kind: "general" }, () =>
      each((m, i) => {
        if (m.d.wire) b.fits(WIRE, fs[i].wire, 0.2);
      }),
    );
  ds({ title: "Lower the back between the sides", detail: "Its bottom edge goes over the drawer bottom. Push the plastic ring for the interlock into the hole near its end.", kind: "join" }, () => {
    each((m, i) => stage(m, i, m.back, [0, 260, 0]));
    b.then(0.15);
    each((_, i) => b.fits(RING, fs[i].ring, 0.2));
  });
  ds({ title: "Push in the plastic cam dowels and lock them", detail: "Two through each side into the back, then turn the four cam locks in the back.", tools: ["screwdriver"], kind: "cams" }, () => {
    each((_, i) => b.fits(PIN, fs[i].pins, 0.08));
    b.then(0.1);
    each((_, i) => b.fits(CAM, fs[i].backCams, 0.1));
  });
  ds({ title: "Screw on the runner catches", detail: "Three screws along the bottom edge of each side, where the runners will catch.", tools: ["screwdriver"], kind: "runners", pose: "-y" }, () => each((_, i) => b.fits(SCR, fs[i].runScrews, 0.06)));
  ds({ title: "Screw on the handle", detail: "Two screws from inside the front. Snug is enough.", tools: ["screwdriver"], kind: "screws", pose: "+y" }, () => {
    each((_, i) => b.fits(HANDLE, fs[i].handle, 0.2));
    b.then(0.05);
    each((_, i) => b.fits(HSCR, fs[i].hScrews, 0.12));
  });
  step(
    b,
    {
      title: n > 2 ? `Slide in all ${n} drawers` : n === 2 ? "Slide in both drawers" : "Slide in the drawer",
      detail: "Pull the runners out, rest the drawer on them and push it home until it clicks. Only one drawer opens at a time once they're all in.",
      kind: "drawer",
      warnings: ["tip"],
    },
    () => {
      for (const m of made) {
        b.stagger(0);
        for (const k of [m.front, ...m.sides, m.bottom, m.back]) b.add(k, [0, 0, 520]);
        if (!shown.includes(m)) {
          const f = fitsOf(m);
          const all: [HwDef, FitOpts[]][] = [
            [BOLT, f.bolts],
            [CAM, f.cams],
            [WIRE, f.wire],
            [RING, f.ring],
            [PIN, f.pins],
            [CAM, f.backCams],
            [SCR, f.runScrews],
            [HANDLE, f.handle],
            [HSCR, f.hScrews],
          ];
          for (const [def, l] of all) for (const x of l) b.preset(def, x);
        }
        b.wait(0.2);
      }
    },
  );
}

/* ---------- chests: built lying on the left side, then on the back ---------- */

interface ChestCfg {
  cols: 1 | 2;
  levels: number; // drawer levels in each column, the small pair on the 6-drawer counted as one
  pair?: boolean; // two small drawers side by side at the top, on a metal centre bar
  midBack?: boolean; // a rail across the back half way up (the taller chests)
  halves?: boolean; // the back in two halves, a bottom back rail on dowels and three bolts at the seam
}

function chestCfg(s: ProductSpec): ChestCfg | null {
  const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
  const w = s.size.w, h = s.size.h;
  if (!/chest of|drawer dresser/.test(v)) return null;
  if (w < 100 && h < 90) return { cols: 1, levels: 3, halves: true };
  if (w < 100 && h < 110) return { cols: 1, levels: 4, halves: true, midBack: true };
  if (w < 100) return { cols: 1, levels: 5, pair: true, midBack: true };
  if (h < 90) return { cols: 2, levels: 3 };
  return { cols: 2, levels: 4, midBack: true };
}

function chest(b: PlanBuilder, s: ProductSpec, c: ChestCfg) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const k = new Kit();
  const xo = W / 2 - 12; // outer faces of the sides, set in under the top
  const xi = xo - T;
  const zb = -D / 2, Ds = D - 30, zf = zb + Ds;
  const yS1 = H - TT;
  const Hs = yS1 - F;
  const sideZ = zb + Ds / 2;
  const L = k.part("L", "Side panel", [T, Hs, Ds], [-xo + T / 2, F + Hs / 2, sideZ]);
  const R = k.part("R", "Side panel", [T, Hs, Ds], [xo - T / 2, F + Hs / 2, sideZ]);
  const M = c.cols === 2 ? k.part("M", "Middle panel", [T, Hs, Ds], [0, F + Hs / 2, sideZ]) : null;
  const top = k.part("top", "Top panel", [W, TT, D], [0, H - TT / 2, 0]);
  // columns between the walls
  const cols = c.cols === 2 ? [{ x0: -xi, x1: -T / 2, l: L, r: M! }, { x0: T / 2, x1: xi, l: M!, r: R }] : [{ x0: -xi, x1: xi, l: L, r: R }];
  const BZ = 20; // rails are 20 thick
  const zBackIn = zb + 14; // the back panels sit in grooves just in from the back edge
  const rail = (id: string, name: string, col: (typeof cols)[number], y0: number, h: number, z: number) =>
    k.part(id, name, [col.x1 - col.x0, h, BZ], [(col.x0 + col.x1) / 2, y0 + h / 2, z]);
  const seam = (F + 10 + yS1) / 2;
  const colRails = cols.map((col, i) => {
    const tf = rail(`tf${i}`, "Top front rail", col, yS1 - 50, 50, zf - BZ / 2);
    const tb = rail(`tb${i}`, "Top back rail", col, yS1 - 50, 50, zBackIn + BZ / 2);
    const bf = rail(`bf${i}`, "Bottom front rail", col, F + 10, 80, zf - BZ / 2);
    const list = [tf, tb, bf];
    if (c.midBack) list.push(rail(`mb${i}`, "Middle back rail", col, seam - 40, 80, zBackIn + BZ / 2));
    if (c.pair) list.push(rail(`bb${i}`, "Bottom back rail", col, F + 10, 80, zBackIn + BZ / 2));
    return { col, tf, tb, bf, list };
  });
  const plinth = k.part("plinth", "Plinth", [2 * xo + 12, 90, 20], [0, F + 45, zf + 10], {
    pieces: [
      { shape: "box", size: [2 * xo + 12, 78, 16], pos: [0, -6, -2] },
      { shape: "box", size: [2 * xo + 12, 12, 20], pos: [0, 39, 0] },
    ],
  });
  // the back: two halves and a dowelled bottom rail, or one panel per column fixed with rivets
  const backs = c.halves
    ? [
        k.part("backU", "Back panel", [2 * xi, yS1 - seam, 8], [0, (seam + yS1) / 2, zb + 10], { material: "fiber" }),
        k.part("backL", "Back panel", [2 * xi, seam - F - 10, 8], [0, (F + 10 + seam) / 2, zb + 10], { material: "fiber" }),
      ]
    : cols.map((col, i) => k.part(`back${i}`, "Back panel", [col.x1 - col.x0, yS1 - F - 10, 8], [(col.x0 + col.x1) / 2, (F + 10 + yS1) / 2, zb + 10], { material: "fiber" }));
  const rearB = c.halves ? k.part("rearB", "Bottom back rail", [2 * xi, 80, BZ], [0, F + 50, zBackIn + BZ / 2]) : null;

  // drawers: levels shared out between the bottom rail and the top rail
  const y0 = F + 92, y1 = yS1 - 52;
  const ph = (y1 - y0) / c.levels;
  const dd = Math.round((zf - 20 - (zBackIn + BZ + 12)) / 10) * 10;
  const runLen = Math.round((dd - 20) / 10) * 10;
  const levelY = (j: number) => y1 - (j + 1) * ph; // levels counted from the top
  const boxes: DrawerBox[] = [];
  for (const { col } of colRails)
    for (let j = 0; j < c.levels; j++) {
      const yb = levelY(j), fh = ph - 4;
      const wIn = col.x1 - col.x0;
      const pair = c.pair && j === 0;
      const xs = pair ? [col.x0 + wIn / 4, col.x0 + (wIn * 3) / 4] : [(col.x0 + col.x1) / 2];
      const fw = pair ? wIn / 2 - 4 : wIn - 4;
      for (const x of xs) boxes.push({ x, y0: yb + 22, w: (pair ? wIn / 2 : wIn) - 26, sh: Math.min(fh - 60, 170), dd, zf, fw, fh, fy: yb + 2 + fh / 2, wire: !pair });
    }
  const runY = range(c.levels).map((j) => levelY(j) + 26);
  const barY0 = runY[0] - 14, barY1 = yS1 - 50;
  // the small drawers' divider: a board between the top rails, its top edge on dowels and cam bolts in the top
  const DV = 16;
  const bar = c.pair ? k.part("bar", "Divider", [DV, yS1 - barY0, zf - zBackIn - 2 * BZ], [0, (barY0 + yS1) / 2, (zf + zBackIn) / 2]) : null;
  void barY1;

  // the interlock: a box on the right-hand wall of each column, its latches clipped in at every level
  const locks = colRails.map(({ col }, i) => {
    const face = col.r.pos[0] - T / 2;
    return k.part(`lock${i}`, "Interlock", [14, 60, 100], [face - 7, levelY(c.levels - 1) + 90, zBackIn + BZ + 70], { material: "metal" });
  });
  const ft = feet(k, { xo, zb, zf, mids: c.cols === 2 ? [zb + 60, zf - 50] : [] });

  /* the steps */
  const allRails = colRails.flatMap((r) => r.list);
  const railsOf = (i: number) => colRails[i].list;
  const n = allRails.length / c.cols;
  // the dowel low in each rail end, the cam bolt high: far enough apart that neither gets pushed off the joint
  const camFr = [0.75];
  // on the middle panel the two halves' holes sit back to back: the left half's near the back of the rail end, the right half's near the front
  const acr = (wall: Part, p: Part) => (wall === M ? (p.pos[0] < 0 ? 0.15 : 0.85) : 0.5);
  const camLocks = (wall: Part, list: Part[]) => list.map((p) => cams(wall, p, camFr, p.pos[2] > 0 ? -1 : 1, acr(wall, p)));
  const runnersOn = (wall: Part, side: 1 | -1) => wallRunners(wall, side, runY, zf, runLen);
  const nl = c.levels;

  k.step({
    title: c.cols === 2 ? "Screw the runners onto the left side" : "Screw the cam bolts and runners into the left side",
    detail:
      c.cols === 2
        ? `Lay it on a rug, inside up. ${nl} runners, three screws each, the wheel at the front. The middle panel takes runners on both faces and the right side its own, the same way.`
        : `Lay it on a rug, inside up. ${n} cam bolts by hand, then ${nl} runners with three screws each, the wheel at the front. The right side gets the same.`,
    add: ["L"],
    fix: [...(c.cols === 1 ? railsOf(0).map((p) => bolts(L, p, camFr)) : []), ...runnersOn(L, 1)],
    tools: ["screwdriver"],
    pose: "+x",
    warnings: ["floor"],
  });
  if (c.cols === 2) k.step({ title: "Screw the cam bolts into the left side", detail: `${n} of them, by hand until they stop.`, fix: railsOf(0).map((p) => bolts(L, p, camFr)), tools: ["screwdriver"] });
  k.step({
    title: "Tap dowels into the rails and stand them in the left side",
    detail: "A dowel in each end. Push each rail down onto its dowel and cam bolt, the holes for the cam locks facing up.",
    add: railsOf(0).map((p) => p.id),
    fix: railsOf(0).flatMap((p) => [dowels(p, L, [0.2], 0.5), dowels(p, cols[0].r, [0.2], acr(cols[0].r, p))]),
    tools: ["hammer"],
  });
  k.step({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls the rail tight.", fix: camLocks(L, railsOf(0)), tools: ["screwdriver"] });
  if (c.cols === 2) {
    k.step({
      title: "Lay the middle panel on",
      detail: "Its cam bolts for the first rails go in first. Runners down, line it up with the dowels and press it on evenly.",
      add: ["M"],
      fix: [...railsOf(0).map((p) => bolts(M!, p, camFr, acr(M!, p))), ...runnersOn(M!, -1), ...runnersOn(M!, 1)],
      tools: ["screwdriver"],
    });
    k.step({ title: "Lock the cam locks", detail: "One in the other end of each rail.", fix: camLocks(M!, railsOf(0)), tools: ["screwdriver"] });
    k.step({ title: "Screw the cam bolts for the right half into the middle panel", detail: `${n} more, into its upper face.`, fix: railsOf(1).map((p) => bolts(M!, p, camFr, acr(M!, p))), tools: ["screwdriver"] });
    k.step({
      title: "Tap dowels into the other rails and stand them on it",
      detail: "The same way: a dowel in each end, onto the bolts.",
      add: railsOf(1).map((p) => p.id),
      fix: railsOf(1).flatMap((p) => [dowels(p, M!, [0.2], acr(M!, p)), dowels(p, R, [0.2], 0.5)]),
      tools: ["hammer"],
    });
    k.step({ title: "Lock the cam locks", fix: camLocks(M!, railsOf(1)), tools: ["screwdriver"] });
  }
  const last = colRails[c.cols - 1].list;
  k.step({
    title: "Lay the right side on",
    detail: `Screw in its ${n} cam bolts and ${nl} runners first, like the left side. Runners facing in, line up every dowel and bolt, then press it down evenly.`,
    add: ["R"],
    fix: [...last.map((p) => bolts(R, p, camFr)), ...runnersOn(R, -1)],
    tools: ["screwdriver"],
  });
  k.step({ title: "Lock the cam locks", detail: `${n} of them, one in the end of each rail.`, fix: camLocks(R, last), tools: ["screwdriver"] });
  k.step({
    title: "Bolt the plinth onto the bottom rail",
    detail: `${3 * c.cols} bolts through the rail from inside, with the Allen key. The profiled edge goes at the top.`,
    add: ["plinth"],
    fix: colRails.map((r) => screws(r.bf, plinth, [0.15, 0.5, 0.85], { ...LINK_BOLT, name: "Connecting bolt" }, 0.5, "bolt")),
    tools: ["allen"],
  });

  // the 6-drawer's top also takes two cam bolts for the divider between the small drawers
  const topFix = [bolts(top, L, [0.15, 0.85]), bolts(top, R, [0.15, 0.85]), ...(M ? [bolts(top, M, [0.15, 0.85])] : []), ...(bar ? [bolts(top, bar, [0.3, 0.7])] : []), ...bracketFixes(top, [-xo + 120, xo - 120], zb)];
  const topDowels = [dowels(L, top, [0.3, 0.7]), dowels(R, top, [0.3, 0.7]), ...(M ? [dowels(M, top, [0.3, 0.7])] : [])];
  const topCams = [cams(top, L, [0.15, 0.85], 1), cams(top, R, [0.15, 0.85], -1), ...(M ? [cams(top, M, [0.15, 0.85], 1)] : [])];
  const topSteps = () => {
    k.step({ title: "Tap dowels into the tops of the sides", detail: M ? "Two in each panel." : "Two in each side.", fix: topDowels, tools: ["hammer"] });
    k.step({
      title: "Fit the top",
      detail: "Upside down on the rug first: the cam bolts, then the two wall brackets at the back edge, a washer under each screw. Then push it onto the dowels.",
      add: ["top"],
      fix: topFix,
      tools: ["screwdriver"],
    });
    k.step({ title: "Bolt the top to the back rail", detail: "Through the rail into the top, with the Allen key.", fix: colRails.map((r) => screws(r.tb, top, [0.5], { ...LINK_BOLT, name: "Connecting bolt" }, 0.5, "bolt")), tools: ["allen"] });
    k.step({ title: "Lock the cam locks", detail: "In the sides, under the top.", fix: topCams, tools: ["screwdriver"] });
  };

  if (c.halves) {
    const [bu, bl] = backs;
    const seamPts: Vec3[] = spread(-xi + 100, xi - 100, 3).map((x): Vec3 => [x, seam + (c.midBack ? 0 : 16), zb + (c.midBack ? 34 : 14)]);
    k.step({ title: "Turn it onto its back and slide in the first back panel", detail: "Lift it over together. Slide the panel up the grooves from the bottom end as far as it goes.", add: [bu.id], pose: "+z", people: 2, warnings: ["two", "floor"] });
    k.step({
      title: "Screw in three bolts, heads left out",
      detail: "Along the bottom edge of the panel. Leave each head standing a few millimetres so the second panel can slide under it.",
      fix: [at("bolt", c.midBack ? colRails[0].list[3] : bu, seamPts, [0, 0, -1], { ...LINK_BOLT, name: "Connecting bolt" })],
      tools: ["allen"],
    });
    k.step({
      title: "Slide in the second back panel and the bottom back rail",
      detail: "The panel goes up under the bolt heads. Tap three dowels into each end of the rail and push it in behind the panel's bottom edge.",
      add: [bl.id, rearB!.id],
      fix: [dowels(rearB!, L, [0.2, 0.5, 0.8], 0.5), dowels(rearB!, R, [0.2, 0.5, 0.8], 0.5)],
      tools: ["hammer"],
    });
    topSteps();
  } else {
    topSteps();
    k.step({
      title: c.cols === 2 ? "Turn it onto its back and slide in the back panels" : "Turn it onto its back and slide in the back panel",
      detail: c.cols === 2 ? "Lift it over together. One panel in each half, up the grooves from the bottom end." : "Lift it over together. Unfold the panel and slide it up the grooves from the bottom end.",
      add: backs.map((p) => p.id),
      pose: "+z",
      people: 2,
      warnings: ["two", "floor"],
    });
    k.step({
      title: "Fix the back with the plastic rivets",
      detail: "Push each sleeve through the panel, then tap the pin into it to spread it.",
      fix: backs.map((p) => at("clip", p, [-1, 1].flatMap((g) => [p.pos[1] - p.size[1] / 2 + 40, p.pos[1] + p.size[1] / 2 - 25].map((y): Vec3 => [p.pos[0] + g * (p.size[0] / 2 - 60), y, zb + 6])), [0, 0, 1], RIVET)),
      tools: ["hammer"],
    });
    if (c.cols === 2)
      k.step({
        title: "Clip the backs to the middle panel",
        detail: "Four clips and four catches along its back edge, holding both panels.",
        fix: [
          at("clip", M!, spread(F + 150, yS1 - 150, 4).map((y): Vec3 => [-T / 2 - 1, y, zb + 16]), [1, 0, 0], CLIP),
          at("clip", M!, spread(F + 150, yS1 - 150, 4).map((y): Vec3 => [T / 2 + 1, y, zb + 16]), [-1, 0, 0], CATCH),
        ],
      });
  }

  // the interlock and its clips, in each column at once
  const both = c.cols === 2;
  const faceOf = (col: (typeof cols)[number]) => col.r.pos[0] - T / 2;
  k.step({
    title: both ? "Screw an interlock into each half" : "Screw the interlock onto the right side",
    detail: "Low down near the back of the right-hand wall, one screw. Its chain of latches hangs up the wall.",
    add: locks.map((l) => l.id),
    fix: colRails.map(({ col }, i) => at("screw", locks[i], [[faceOf(col) - 14, locks[i].pos[1], locks[i].pos[2]]], [1, 0, 0], { len: 10, dia: 4 })),
    tools: ["screwdriver"],
  });
  k.step({
    title: "Clip the latches into the wall",
    detail: "Two at each drawer level, into the holes from the bottom up. Keep the cord between them straight.",
    fix: colRails.map(({ col }, i) => at("clip", col.r, runY.flatMap((y) => [y + 20, y + 50]).map((y): Vec3 => [faceOf(col) - 1, y, locks[i].pos[2] + 30]), [1, 0, 0], LATCH)),
  });
  k.step({
    title: "Push the clips onto the runners",
    detail: "Two at each level, at the back end of both runners.",
    fix: colRails.flatMap(({ col }) => [
      at("clip", col.l, runY.map((y): Vec3 => [col.x0 + 6, y + 12, zf - runLen + 10]), [-1, 0, 0], CLIP),
      at("clip", col.r, runY.map((y): Vec3 => [col.x1 - 6, y + 12, zf - runLen + 10]), [1, 0, 0], CLIP),
    ]),
  });
  k.step({
    title: "Fit a catch and a clip for each drawer",
    detail: "The catch goes on the right-hand runner, near the front; the clip next to it.",
    fix: colRails.flatMap(({ col }) => {
      const per = boxes.filter((bx) => bx.x > col.x0 && bx.x < col.x1);
      return [
        at("clip", col.r, per.map((bx, j): Vec3 => [col.x1 - 6, bx.y0 + 4, zf - 70 - (j % 2) * 30]), [1, 0, 0], CATCH),
        at("clip", col.r, per.map((bx, j): Vec3 => [col.x1 - 6, bx.y0 + 4, zf - 110 - (j % 2) * 30]), [1, 0, 0], CLIP),
      ];
    }),
  });
  if (c.halves) k.step({ title: "Tighten the three bolts", detail: "Now that both back panels are in, turn them in until the heads sit flush.", tools: ["allen"] });
  if (bar) {
    const tf0 = colRails[0].tf;
    const hx = DV / 2;
    k.step({
      title: "Screw the runners onto the divider and push it up under the top",
      detail: "One runner on each face, three screws each, the wheels at the front. Two dowels in its top edge, then push it up between the top rails onto the dowels and cam bolts.",
      add: [bar.id],
      fix: [
        dowels(bar, top, [0.15, 0.85]),
        ...[-1, 1].flatMap((g) => [
          at("runner", bar, [[g * (hx + 5), runY[0], zf - 10 - runLen / 2]], [-g, 0, 0], { len: runLen, dia: 20 }),
          at("screw", bar, [zf - 40, zf - 10 - runLen / 2, zf - runLen + 20].map((z): Vec3 => [g * (hx + 10), runY[0], z]), [-g, 0, 0], RUNNER_SCREW),
        ]),
      ],
      tools: ["screwdriver", "hammer"],
    });
    k.step({ title: "Lock the cam locks", detail: "Two in the divider, just under the top.", fix: [cams(top, bar, [0.3, 0.7], 1)], tools: ["screwdriver"] });
    k.step({
      title: "Screw the bracket to the divider and the front rail",
      detail: "The metal bracket holds the front of the divider to the top front rail. Two screws.",
      fix: [
        at("angle", bar, [[hx + 2, yS1 - 70, zf - BZ - 15]], [-1, 0, 0], { len: 40, dia: 20, name: "Divider bracket" }),
        at("screw", bar, [[hx + 2, yS1 - 80, zf - BZ - 15]], [-1, 0, 0], { len: 12, dia: 4 }),
        { ...at("screw", bar, [[hx + 2, yS1 - 25, zf - BZ - 2]], [0, 0, 1], { len: 12, dia: 4 }), mate: tf0.id },
      ],
      tools: ["screwdriver"],
    });
  }
  k.step({
    title: "Press in the feet",
    detail: "L-shaped ones at the back corners, straight ones at the front corners and under the middle. Push their pegs into the bottom edges.",
    add: [...ft.back, ...ft.front, ...ft.mids].map((p) => p.id),
  });
  k.step({ title: "Stand it up", detail: "Lift it upright together, don't pull it up by one corner.", pose: "+y", people: 2, warnings: ["two"] });
  buildCustom(b, { ...s, custom: k.recipe });
  wallSteps(b, { y: yS1 - 80, xs: [-xo + 120, xo - 120], zb, tall: H > 1100 });
  drawers(b, boxes);
  return true;
}


/* ---------- doors on clip-on hinges, shelves on supports ---------- */

const PLATE = { len: 40, dia: 20, name: "Mounting plate" };
const PLATE_SCREW = { len: 15, dia: 4 };
const HINGE = { len: 50, dia: 35 };
const KNOB = { len: 26, dia: 32 };
const KNOB_SCREW = { len: 25, dia: 4 };
const SUPPORT = { len: 16, dia: 5, name: "Shelf support" };
const BUMPER = { len: 10, dia: 10, name: "Door buffer" };

/** The plan item placed for a recipe part (the custom builder keeps each part where the recipe put it). */
function keyOf(b: PlanBuilder, p: Part) {
  const it = b.items.find((x) => x.kind === "part" && x.final.pos.every((v, i) => Math.abs(v - p.pos[i]) < 0.5) && b.parts.find((t) => t.id === x.ref)?.name === p.name);
  if (!it) throw new Error(`FÅGELFJÄLLET: no item for ${p.id}`);
  return it.key;
}
/** A part that isn't in the recipe: placed straight on the plan, to be added by a later step. */
function placeLater(b: PlanBuilder, p: Part) {
  if (p.pieces) {
    const { type, mid } = compoundOf(b, p.name, p.pieces);
    return b.place(type, [p.pos[0] + mid[0], p.pos[1] + mid[1], p.pos[2] + mid[2]]);
  }
  return b.place(typeOf(b, p.name, p.size, { material: (p.material as "board") ?? "board" }), p.pos);
}
const later = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<Part> = {}): Part => ({ id, name, size, pos, material: "board", ...o });

interface Hung {
  door: Part;
  key: string;
  wall: string; // plan key of the side it hangs on
  wx: number; // inner face of that side
  g: 1 | -1; // -1: hinged on the left
}

/** Doors hung as the manuals show: plates screwed to the side, hinges screwed into the door, then clipped together. */
function doorSteps(b: PlanBuilder, doors: Hung[], ys: number[], knobY: number, o: { plated?: boolean } = {}) {
  const n = doors.length;
  const pf = (d: Hung) => ys.map((y): Vec3 => [d.wx, y, d.door.pos[2] - d.door.size[2] / 2 - 20]);
  if (!o.plated) step(b, { title: n > 1 ? "Screw the mounting plates onto the sides" : "Screw the mounting plates onto the side", detail: `${ys.length} on the hinge side${n > 1 ? " of each door" : ""}, two screws each, in the holes near the front edge.`, tools: ["screwdriver"], kind: "hinges" }, () => {
    for (const d of doors) b.fits({ kind: "clip", ...PLATE }, pf(d).map((p): FitOpts => ({ on: d.wall, at: p, dir: [-d.g, 0, 0], hole: false })), 0.12);
    b.then(0.1);
    for (const d of doors) b.fits({ kind: "screw", ...PLATE_SCREW }, pf(d).flatMap((p) => [-24, 24].map((dy): FitOpts => ({ on: d.wall, at: [p[0] - d.g * 3, p[1] + dy, p[2]], dir: [d.g, 0, 0] }))), 0.06);
  });
  const hx = (d: Hung) => d.door.pos[0] + d.g * (d.door.size[0] / 2 - 22);
  const zr = (d: Hung) => d.door.pos[2] - d.door.size[2] / 2;
  const span = Math.max(...doors.map((d) => d.door.size[0])) + 200;
  step(b, { title: n > 1 ? "Screw the hinges into the doors" : "Screw the hinges into the door", detail: "Lay the door face down on a rug. Each hinge cup goes into its round hole, two screws.", tools: ["screwdriver"], kind: "hinges", scene: "door", pose: "-z", warnings: ["face"] }, () => {
    doors.forEach((d, i) => b.stage(d.key, [(i - (n - 1) / 2) * span, 0, 0], [0, 0, 0], [0, 200, 0]));
    b.then(0.15);
    for (const d of doors) b.fits({ kind: "hinge", ...HINGE }, ys.map((y): FitOpts => ({ on: d.key, at: [hx(d), y, zr(d)], dir: [0, 0, 1] })), 0.15);
    b.then(0.1);
    for (const d of doors) b.fits({ kind: "screw", len: 12, dia: 3.5 }, ys.flatMap((y) => [-20, 20].map((dy): FitOpts => ({ on: d.key, at: [hx(d) - d.g * 12, y + dy, zr(d)], dir: [0, 0, 1] }))), 0.06);
  });
  step(b, { title: n > 1 ? "Clip the doors onto the plates" : "Clip the door onto the plates", detail: "Hook the back of each hinge over its plate and press the front until it clicks. Adjust with the hinge screws until the gaps are even.", kind: "doors", people: n > 1 && ys.length > 2 ? 2 : 1 }, () => {
    for (const d of doors) b.add(d.key, [0, 0, 400]);
  });
  step(b, { title: n > 1 ? "Screw on the knobs" : "Screw on the knob", detail: "One screw from the inside of the door.", tools: ["screwdriver"], kind: "screws" }, () => {
    for (const d of doors) {
      const x = d.door.pos[0] - d.g * (d.door.size[0] / 2 - 40);
      const zf = d.door.pos[2] + d.door.size[2] / 2;
      b.fit({ kind: "knob", ...KNOB }, { on: d.key, at: [x, knobY, zf], dir: [0, 0, -1], hole: false });
      b.then(0.05);
      b.fit({ kind: "screw", ...KNOB_SCREW }, { on: d.key, at: [x, knobY, zf - d.door.size[2]], dir: [0, 0, 1] });
    }
  });
}

/** Supports pushed into the side walls and the shelves slid onto them, then a door buffer in the lowest one. */
function shelfSteps(b: PlanBuilder, shelves: Part[], walls: { key: string; x: number; g: 1 | -1 }[], o: { buffer?: { x: number } } = {}) {
  const keys = shelves.map((p) => placeLater(b, p));
  const pts = (sp: Part, w: (typeof walls)[number]) => [sp.pos[2] - sp.size[2] / 2 + 50, sp.pos[2] + sp.size[2] / 2 - 50].map((z): FitOpts => ({ on: w.key, at: [w.x, sp.pos[1] - sp.size[1] / 2 - 4, z], dir: [-w.g, 0, 0] }));
  step(b, { title: "Push in the shelf supports", detail: `${shelves.length * 4} of them, into the holes in the sides at the height you want.`, kind: "shelves" }, () => {
    for (const sp of shelves) for (const w of walls) b.fits({ kind: "pin", ...SUPPORT }, pts(sp, w), 0.08);
  });
  if (o.buffer) {
    const low = shelves[shelves.length - 1], lk = keys[keys.length - 1];
    step(b, { title: "Tap the door buffer into the shelf", detail: "Into the front edge, at the end away from the hinges, so the door closes softly.", tools: ["hammer"], kind: "general", scene: "shelf" }, () => {
      b.stage(lk, [0, 0, 0], [0, 0, 0], [0, 200, 0]);
      b.then(0.15);
      b.fit({ kind: "clip", ...BUMPER }, { on: lk, at: [o.buffer!.x, low.pos[1], low.pos[2] + low.size[2] / 2], dir: [0, 0, -1] });
    });
  }
  step(b, { title: shelves.length > 1 ? "Slide the shelves in" : "Slide the shelf in", detail: "Onto the supports, until the back edge touches the back.", kind: "shelves" }, () => {
    for (const kk of keys) b.add(kk, [0, 0, 420]);
  });
}

/** A cupboard with a door below an open niche: the nightstand (a board back, wall fixed) and the bedside table. */
function cupboard(b: PlanBuilder, s: ProductSpec, night: boolean) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const k = new Kit();
  const xo = W / 2 - 10, xi = xo - T;
  const zb = -D / 2, Ds = D - 20, zf = zb + Ds;
  const yS1 = H - TT, Hs = yS1 - F;
  const L = k.part("L", "Side panel", [T, Hs, Ds], [-xo + T / 2, F + Hs / 2, zb + Ds / 2]);
  const R = k.part("R", "Side panel", [T, Hs, Ds], [xo - T / 2, F + Hs / 2, zb + Ds / 2]);
  const top = k.part("top", "Top panel", [W, TT, D], [0, H - TT / 2, 0]);
  const P = 90;
  const backT = night ? 16 : 4;
  const zBack = night ? zb : zb + 8; // a board back between the sides, or hardboard in the grooves
  const back = k.part("back", "Back panel", [2 * xi, Hs - (night ? 0 : 4), backT], [0, F + Hs / 2 + (night ? 0 : 2), zBack + backT / 2], { material: night ? "board" : "fiber" });
  const zIn = zBack + backT;
  const bottom = k.part("bottom", "Bottom panel", [2 * xi, 18, zf - 20 - zIn], [0, F + P + 9, (zIn + zf - 20) / 2]);
  const plinth = k.part("plinth", "Plinth", [2 * xi, P, 20], [0, F + P / 2, zf - 10], {
    pieces: [
      { shape: "box", size: [2 * xi, P - 12, 16], pos: [0, -6, -2] },
      { shape: "box", size: [2 * xi, 12, 20], pos: [0, P / 2 - 6, 0] },
    ],
  });
  const nicheY = yS1 - Math.round(H * 0.19); // floor of the open niche
  const sh = (id: string, y: number) => later(id, "Shelf", [2 * xi - 2, 18, zf - zIn - 10], [0, y + 9, (zIn + zf - 10) / 2]);
  const shelves = night ? [sh("s1", nicheY - 18), sh("s2", (F + P + 18 + nicheY) / 2)] : [sh("s1", nicheY - 18)];
  const doorH = nicheY - 18 - (F + P + 18) - 4;
  const door = later("door", "Door", [2 * xi - 4, doorH, 20], [0, F + P + 18 + 2 + doorH / 2, zf - 10], { pieces: framed(2 * xi - 4, doorH, 20, Math.min(70, (2 * xi) * 0.16)) });
  const ft = feet(k, { xo, zb, zf: zf - 2 });
  const fr = [0.2, 0.8];
  if (night) {
    k.step({ title: "Screw the cam bolts into the left side", detail: "Lay it on a rug, inside up. Four by hand: two for the back, two for the bottom. The right side takes four as well.", add: ["L"], fix: [bolts(L, back, fr), bolts(L, bottom, fr)], tools: ["screwdriver"], pose: "+x", warnings: ["floor"] });
    k.step({ title: "Tap dowels into the back and push it onto the left side", detail: "Two in each end. Stand the side up and press the back onto it.", add: ["back"], pose: "+y", fix: [dowels(back, L, [0.3, 0.7]), dowels(back, R, [0.3, 0.7])], tools: ["hammer"] });
    k.step({ title: "Lock the cam locks", fix: [cams(L, back, fr, 1)], tools: ["screwdriver"] });
    k.step({ title: "Push the bottom in", detail: "Two dowels in each end first, holes for the cam locks facing down.", add: ["bottom"], fix: [dowels(bottom, L, [0.3, 0.7]), dowels(bottom, R, [0.3, 0.7])], tools: ["hammer"] });
    k.step({ title: "Lock the cam locks", fix: [cams(L, bottom, fr, -1)], tools: ["screwdriver"] });
    k.step({ title: "Put the right side on", detail: "Its four cam bolts first, then press it onto the dowels.", add: ["R"], fix: [bolts(R, back, fr), bolts(R, bottom, fr)], tools: ["screwdriver"] });
    k.step({ title: "Lock the cam locks", detail: "Four of them, then turn it upside down onto the rug.", fix: [cams(R, back, fr, 1), cams(R, bottom, fr, -1)], tools: ["screwdriver"] });
    k.step({ title: "Tap dowels into the sides", detail: "Two into the top edge of each side.", fix: [dowels(L, top, [0.3, 0.7]), dowels(R, top, [0.3, 0.7])], tools: ["hammer"], pose: "-y" });
    k.step({ title: "Screw a bracket onto the back", detail: "On the inside, at the middle of the top edge.", fix: [at("angle", back, [[0, yS1 - 15, zIn]], [0, 0, -1], { len: 30, dia: 24 }), at("screw", back, [[0, yS1 - 25, zIn + 2]], [0, 0, -1], { len: 13, dia: 4 })], tools: ["screwdriver"] });
    k.step({
      title: "Fit the top",
      detail: "Top face down on the rug: the two wall brackets at its back edge, a washer under each screw, and four cam bolts. Lower the frame onto it, dowels into their holes.",
      add: ["top"],
      fix: [bolts(top, L, [0.15, 0.85]), bolts(top, R, [0.15, 0.85]), ...bracketFixes(top, [-xo + 80, xo - 80], zb)],
      tools: ["screwdriver"],
    });
    k.step({ title: "Lock the cam locks", detail: "Four in the sides, under the top.", fix: [cams(top, L, [0.15, 0.85], 1), cams(top, R, [0.15, 0.85], -1)], tools: ["screwdriver"] });
    k.step({ title: "Screw a bracket under the bottom", detail: "At the front, in the middle, for the plinth.", fix: [at("angle", bottom, [[0, F + P, zf - 30]], [0, 1, 0], { len: 30, dia: 24 }), at("screw", bottom, [[0, F + P, zf - 40]], [0, 1, 0], { len: 13, dia: 4 })], tools: ["screwdriver"] });
  } else {
    k.step({ title: "Screw the cam bolts into the sides", detail: "Lay them on a rug, inside up. Two in each, for the bottom.", add: ["L"], fix: [bolts(L, bottom, fr)], tools: ["screwdriver"], pose: "+x", warnings: ["floor"] });
    k.step({ title: "Tap dowels into the bottom and join it to the sides", detail: "Two in each end, then press both sides on, cam bolts into their holes.", add: ["bottom", "R"], pose: "+y", fix: [dowels(bottom, L, [0.3, 0.7]), dowels(bottom, R, [0.3, 0.7]), bolts(R, bottom, fr)], tools: ["hammer", "screwdriver"] });
    k.step({ title: "Lock the cam locks", detail: "Four of them, in the bottom.", fix: [cams(L, bottom, fr, -1), cams(R, bottom, fr, -1)], tools: ["screwdriver"] });
    k.step({ title: "Tap dowels into the sides", detail: "Two into the top edge of each side.", fix: [dowels(L, top, [0.3, 0.7]), dowels(R, top, [0.3, 0.7])], tools: ["hammer"] });
    k.step({ title: "Fit the top", detail: "Four cam bolts into its underside first, then press it onto the dowels.", add: ["top"], fix: [bolts(top, L, [0.15, 0.85]), bolts(top, R, [0.15, 0.85])], tools: ["screwdriver"] });
    k.step({ title: "Lock the cam locks", detail: "Four in the sides, under the top.", fix: [cams(top, L, [0.15, 0.85], 1), cams(top, R, [0.15, 0.85], -1)], tools: ["screwdriver"] });
  }
  k.step({
    title: "Screw the brackets onto the plinth",
    detail: "One at each end, on the back face. Then turn the frame upside down.",
    fix: [at("angle", plinth, [-1, 1].map((g): Vec3 => [g * (xi - 25), F + P / 2, zf - 20]), [0, 0, 1], { len: 30, dia: 24 }), at("screw", plinth, [-1, 1].map((g): Vec3 => [g * (xi - 25), F + P / 2 + 10, zf - 20]), [0, 0, 1], { len: 13, dia: 4 })],
    tools: ["screwdriver"],
    pose: "-y",
  });
  k.step({
    title: "Drop the plinth in and screw it to the sides",
    detail: "Between the sides at the front, under the bottom. One screw through each bracket.",
    add: ["plinth"],
    fix: [-1, 1].map((g) => ({ ...at("screw", plinth, [[g * (xi - 10), F + P / 2, zf - 34]], [g, 0, 0], { len: 13, dia: 4 }), mate: (g < 0 ? L : R).id })),
    tools: ["screwdriver"],
  });
  if (!night) {
    k.step({ title: "Slide in the back panel", detail: "Stand it upright. Slide the panel down the grooves from the top, smooth side in.", add: ["back"], pose: "+y" });
    k.step({ title: "Fix the back with two plastic rivets", detail: "Push each sleeve through the panel into the bottom, then tap the pin into it.", fix: [at("clip", back, [-1, 1].map((g): Vec3 => [g * (xi - 60), F + P + 9, zb + 8]), [0, 0, 1], RIVET)], tools: ["hammer"] });
    k.step({
      title: "Push the clips onto the back edges",
      detail: "Six clips and six catches round the panel, holding it in the grooves.",
      fix: [
        at("clip", L, spread(F + P + 80, yS1 - 80, 3).map((y): Vec3 => [-xi + 1, y, zb + 16]), [1, 0, 0], CLIP),
        at("clip", R, spread(F + P + 80, yS1 - 80, 3).map((y): Vec3 => [xi - 1, y, zb + 16]), [-1, 0, 0], CLIP),
        at("clip", L, spread(F + P + 140, yS1 - 140, 3).map((y): Vec3 => [-xi + 1, y, zb + 16]), [1, 0, 0], CATCH),
        at("clip", R, spread(F + P + 140, yS1 - 140, 3).map((y): Vec3 => [xi - 1, y, zb + 16]), [-1, 0, 0], CATCH),
      ],
    });
  }
  k.step({ title: "Press in the feet", detail: "L-shaped ones at the back corners, straight ones at the front. Push their pegs into the bottom edges.", add: [...ft.back, ...ft.front].map((p) => p.id), pose: "-y" });
  k.step({ title: "Stand it up", pose: "+y" });
  buildCustom(b, { ...s, custom: k.recipe });
  if (night) wallSteps(b, { y: yS1 - 80, xs: [-xo + 80, xo - 80], zb });

  // shelves and the door, after the wall fixing as in the manual
  const lk = keyOf(b, L), rk = keyOf(b, R);
  shelfSteps(b, shelves, [{ key: lk, x: -xi, g: -1 }, { key: rk, x: xi, g: 1 }], { buffer: { x: xi - 30 } });
  const dk = placeLater(b, door);
  doorSteps(b, [{ door, key: dk, wall: lk, wx: -xi, g: -1 }], [door.pos[1] - doorH / 2 + 90, door.pos[1] + doorH / 2 - 90], door.pos[1] + doorH * 0.15);
  return true;
}

/* ---------- the wardrobe: built lying on its left side, a low compartment with a divider, two doors ---------- */

function wardrobe(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const k = new Kit();
  const xo = W / 2 - 10, xi = xo - T;
  const zb = -D / 2, Ds = D - 20, zf = zb + Ds;
  const yS1 = H - TT, Hs = yS1 - F;
  const P = 90;
  const zIn = zb + 10; // in front of the hardboard back
  const dep = zf - 22 - zIn; // inner panels stop behind the doors
  const zc = (zIn + zf - 22) / 2;
  const L = k.part("L", "Side panel", [T, Hs, Ds], [-xo + T / 2, F + Hs / 2, zb + Ds / 2]);
  const R = k.part("R", "Side panel", [T, Hs, Ds], [xo - T / 2, F + Hs / 2, zb + Ds / 2]);
  const top = k.part("top", "Top panel", [W, TT, D], [0, H - TT / 2, 0]);
  const yB = F + P; // underside of the bottom
  const bottom = k.part("bottom", "Bottom panel", [2 * xi, 18, dep + 22], [0, yB + 9, zc + 11]);
  const yS = Math.round(H * 0.27); // the fixed shelf over the low compartment
  const shelf = k.part("fixed", "Fixed shelf", [2 * xi, 18, dep], [0, yS + 9, zc]);
  const div = k.part("div", "Divider", [18, yS - yB - 18, dep], [0, (yB + 18 + yS) / 2, zc]);
  const tf = k.part("tf", "Top front rail", [2 * xi, 60, 20], [0, yS1 - 30, zf - 10]);
  const tb = k.part("tb", "Top back rail", [2 * xi, 60, 20], [0, yS1 - 30, zIn + 10]);
  const plinth = k.part("plinth", "Plinth", [2 * xi, P, 20], [0, F + P / 2, zf - 10], {
    pieces: [
      { shape: "box", size: [2 * xi, P - 12, 16], pos: [0, -6, -2] },
      { shape: "box", size: [2 * xi, 12, 20], pos: [0, P / 2 - 6, 0] },
    ],
  });
  const backs = [
    k.part("backL", "Back panel", [2 * xi, yS + 18 - (F + 10), 4], [0, (F + 10 + yS + 18) / 2, zb + 8], { material: "fiber" }),
    k.part("backU", "Back panel", [2 * xi, yS1 - (yS + 18), 4], [0, (yS + 18 + yS1) / 2, zb + 8], { material: "fiber" }),
  ];
  const ft = feet(k, { xo, zb, zf: zf - 2, mids: [zf - 50] });
  const doorH = yS1 - 60 - 2 - (yB + 18 + 2);
  const dw = xi - 2;
  const doors = [-1, 1].map((g) => later(`door${g}`, "Door", [dw, doorH, 20], [g * (dw / 2 + 1), yB + 20 + doorH / 2, zf - 10], { pieces: tallDoor(dw, doorH, 20) }));
  const hy = [doors[0].pos[1] - doorH / 2 + 110, doors[0].pos[1], doors[0].pos[1] + doorH / 2 - 110];
  const plates = (wall: Part, g: 1 | -1): CustomFix[] => [
    at("clip", wall, hy.map((y): Vec3 => [g * xi, y, zf - 40]), [-g, 0, 0], PLATE),
    at("screw", wall, hy.flatMap((y) => [-24, 24].map((dy): Vec3 => [g * (xi - 3), y + dy, zf - 40])), [g, 0, 0], PLATE_SCREW),
  ];
  const railY = yS1 - 110;
  const holders = (wall: Part, g: 1 | -1): CustomFix[] => [
    at("clip", wall, [[g * xi, railY, zc]], [-g, 0, 0], { len: 30, dia: 30, name: "Rail holder" }),
    at("screw", wall, [-14, 14].map((dz): Vec3 => [g * (xi - 3), railY + 20, zc + dz]), [g, 0, 0], { len: 15, dia: 4 }),
  ];
  const fr = [0.2, 0.8];
  const LB = { ...LINK_BOLT, len: 60, name: "Long connecting bolt" };

  // the low compartment is put together first and the left side goes onto all of it at once, so the side waits until then
  const rf = [0.75]; // rail ends: the dowel low, the cam bolt high
  k.step({ title: "Screw the cam bolts into the left side", detail: "Lay both sides on a rug, inside up. Six bolts in each, by hand until they stop.", fix: [bolts(L, bottom, fr), bolts(L, shelf, fr), bolts(L, tf, rf), bolts(L, tb, rf)], wait: ["L"], from: { L: [0, 300, 0] }, tools: ["screwdriver"], pose: "+x", warnings: ["floor"] });
  k.step({ title: "Screw the hinge plates onto the left side", detail: "Three, near the front edge, two screws each. The right side takes three the same way.", fix: plates(L, -1), tools: ["screwdriver"] });
  k.step({ title: "Screw the rail holder onto the left side", detail: "Near the top, two screws. One on the right side too.", fix: holders(L, -1), tools: ["screwdriver"] });
  k.step({
    title: "Build the low compartment",
    detail: "Beside the side, on the rug. Dowels in the ends of the bottom and two cam bolts in it for the divider. A dowel in each end of the divider, push it onto the bolts and turn its two cam locks.",
    add: ["bottom", "div"],
    from: { bottom: [0, 0, 0] },
    fix: [dowels(bottom, L, [0.3, 0.7]), dowels(bottom, R, [0.3, 0.7]), bolts(bottom, div, [0.25, 0.75]), dowels(div, bottom, [0.35]), dowels(div, shelf, [0.35]), cams(bottom, div, [0.25, 0.75], 1)],
    tools: ["hammer", "screwdriver"],
  });
  k.step({ title: "Tap in the door buffers", detail: "Two into the front edge of the bottom, one near each end.", fix: [at("clip", bottom, [-1, 1].map((g): Vec3 => [g * (xi - 40), yB + 9, zf]), [0, 0, -1], BUMPER)], tools: ["hammer"] });
  k.step({
    title: "Bolt the fixed shelf onto the divider",
    detail: "Dowels in both ends of the shelf first. Lower it onto the divider's dowels and drive three long bolts down through it, with the Allen key.",
    add: ["fixed"],
    fix: [dowels(shelf, L, [0.3, 0.7]), dowels(shelf, R, [0.3, 0.7]), screws(shelf, div, [0.2, 0.5, 0.8], LB, 0.5, "bolt")],
    tools: ["hammer", "allen"],
  });
  k.step({ title: "Put the compartment and the left side together", detail: "Bring the side and the compartment together so every dowel and cam bolt finds its hole, the bottom at the side's lower end.", add: ["L"], people: 2, warnings: ["two"] });
  k.step({ title: "Lock the cam locks", detail: "Four in the bottom and the fixed shelf, at the left side.", fix: [cams(L, bottom, fr, -1), cams(L, shelf, fr, -1)], tools: ["screwdriver"] });
  k.step({ title: "Fit the top rails", detail: "A dowel in each end, push them onto the side at the top of the back and front edges and turn their cam locks.", add: ["tb", "tf"], fix: [dowels(tb, L, [0.2]), dowels(tb, R, [0.2]), dowels(tf, L, [0.2]), dowels(tf, R, [0.2]), cams(L, tb, rf, 1), cams(L, tf, rf, -1)], tools: ["hammer", "screwdriver"] });
  k.step({
    title: "Lay the right side on",
    detail: "Its six cam bolts, three hinge plates and rail holder go on first. Line it up with every dowel and bolt and press it down evenly.",
    add: ["R"],
    fix: [bolts(R, bottom, fr), bolts(R, shelf, fr), bolts(R, tf, rf), bolts(R, tb, rf), ...plates(R, 1), ...holders(R, 1)],
    tools: ["screwdriver"],
    people: 2,
    warnings: ["two"],
  });
  k.step({ title: "Lock the cam locks", detail: "Six of them, at the right side.", fix: [cams(R, bottom, fr, -1), cams(R, shelf, fr, -1), cams(R, tb, rf, 1), cams(R, tf, rf, -1)], tools: ["screwdriver"] });
  k.step({ title: "Screw the brackets onto the plinth", detail: "Three on its back face, one screw each.", fix: [at("angle", plinth, [-1, 0, 1].map((g): Vec3 => [g * (xi - 30), F + P / 2, zf - 20]), [0, 0, 1], { len: 30, dia: 24 }), at("screw", plinth, [-1, 0, 1].map((g): Vec3 => [g * (xi - 30), F + P / 2 - 12, zf - 20]), [0, 0, 1], { len: 13, dia: 4 })], tools: ["screwdriver"] });
  k.step({ title: "Fit the plinth under the bottom", detail: "Between the sides at the front. One screw up through each bracket into the bottom.", add: ["plinth"], fix: [at("screw", plinth, [-1, 0, 1].map((g): Vec3 => [g * (xi - 30), yB, zf - 34]), [0, 1, 0], { len: 13, dia: 4 })], tools: ["screwdriver"] });
  k.step({ title: "Fit the top", detail: "Six cam bolts in its underside and four dowels in the sides, then push it on and turn the cam locks in the sides.", add: ["top"], fix: [dowels(L, top, [0.3, 0.7]), dowels(R, top, [0.3, 0.7]), bolts(top, L, [0.1, 0.5, 0.9]), bolts(top, R, [0.1, 0.5, 0.9]), cams(top, L, [0.1, 0.5, 0.9], 1), cams(top, R, [0.1, 0.5, 0.9], -1)], tools: ["screwdriver", "hammer"] });
  k.step({ title: "Press in the feet", detail: "Two L-shaped ones at the back corners, three straight ones along the front.", add: [...ft.back, ...ft.front, ...ft.mids].map((p) => p.id) });
  k.step({ title: "Bolt the top to the back rail", detail: "One bolt up through the middle of the rail, with the Allen key.", fix: [screws(tb, top, [0.5], { ...LINK_BOLT, name: "Connecting bolt" }, 0.5, "bolt")], tools: ["allen"] });
  k.step({ title: "Turn it onto its front and slide in the back panels", detail: "Lift it over together onto the rug. Slide the two panels down the grooves from the bottom end, the upper one first.", add: backs.map((p) => p.id), pose: "-z", people: 2, warnings: ["two", "floor"] });
  k.step({ title: "Fix the back with the plastic rivets", detail: "Four, through the panel into the bottom and the fixed shelf.", fix: [at("clip", backs[0], [-1, 1].flatMap((g) => [yB + 9, yS + 9].map((y): Vec3 => [g * (xi - 80), y, zb + 6])), [0, 0, 1], RIVET)], tools: ["hammer"] });
  k.step({
    title: "Push the clips onto the back edges",
    detail: "Fourteen clips and fourteen catches along the grooves, holding both panels.",
    fix: [-1, 1].flatMap((g) => [
      at("clip", g < 0 ? L : R, spread(F + 150, yS1 - 150, 7).map((y): Vec3 => [g * xi, y, zb + 14]), [-g, 0, 0], CLIP),
      at("clip", g < 0 ? L : R, spread(F + 250, yS1 - 250, 7).map((y): Vec3 => [g * xi, y, zb + 14]), [-g, 0, 0], CATCH),
    ]),
  });
  k.step({ title: "Screw the wall brackets under the top", detail: "At the back corners, a washer under each screw.", fix: bracketFixes(top, [-xo + 100, xo - 100], zb), tools: ["screwdriver"] });
  k.step({ title: "Screw the back panels to the fixed shelf", detail: "One screw where the two panels meet, in the middle.", fix: [at("screw", backs[0], [[0, yS + 9, zb + 6]], [0, 0, 1], { len: 16, dia: 4 })], tools: ["screwdriver"] });
  k.step({ title: "Stand it up", detail: "Together, and lift it: don't drag it up by one corner. Mind the ceiling as it comes up.", pose: "+y", people: 2, warnings: ["two"] });
  buildCustom(b, { ...s, custom: k.recipe });
  wallSteps(b, { y: yS1 - 80, xs: [-xo + 100, xo - 100], zb, tall: true });

  const loose = later("shelf", "Shelf", [xi - 9 - 2, 18, dep - 10], [(xi + 9) / 2, (yB + 18 + yS) / 2, zc - 5]);
  const rk = keyOf(b, R), dk = keyOf(b, div);
  shelfSteps(b, [loose], [{ key: dk, x: 9, g: -1 }, { key: rk, x: xi, g: 1 }]);
  const railKey = b.place(b.part("Clothes rail", [25, 2 * xi - 4, 25], { shape: "cyl", material: "metal" }), [0, railY, zc], [0, 0, Math.PI / 2]);
  step(b, { title: "Drop the clothes rail into its holders", detail: "Rest each end in a holder, then press it down until it clicks.", kind: "general" }, () => b.add(railKey, [0, 200, 0]));
  const hung: Hung[] = doors.map((d, i) => ({ door: d, key: placeLater(b, d), wall: i ? rk : keyOf(b, L), wx: i ? xi : -xi, g: i ? 1 : -1 }));
  doorSteps(b, hung, hy, doors[0].pos[1] - doorH * 0.04, { plated: true });
  return true;
}

/** A tall framed door with a middle rail, two sunken panels. */
function tallDoor(w: number, h: number, t: number): PartPiece[] {
  const r = 70, mid = h * 0.46;
  const pane = (y0: number, y1: number): PartPiece => ({ shape: "box", size: [w - 2 * r, y1 - y0, t - 6], pos: [0, (y0 + y1) / 2, -3] });
  return [
    { shape: "box", size: [w, r, t], pos: [0, h / 2 - r / 2, 0] },
    { shape: "box", size: [w, r, t], pos: [0, -h / 2 + r / 2, 0] },
    { shape: "box", size: [w, r, t], pos: [0, -h / 2 + mid, 0] },
    { shape: "box", size: [r, h - 2 * r, t], pos: [-w / 2 + r / 2, 0, 0] },
    { shape: "box", size: [r, h - 2 * r, t], pos: [w / 2 - r / 2, 0, 0] },
    pane(-h / 2 + r, -h / 2 + mid - r / 2),
    pane(-h / 2 + mid + r / 2, h / 2 - r),
  ];
}

/* ---------- the bed: footboard and headboard built flat, side rails bolted and connected, then the base ---------- */

const D_BOLT: HwDef = { kind: "camScrew", len: 44, dia: 7, name: "Double cam bolt" };
const BED_CAM: HwDef = HW.cam;
const RAIL_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 10 };
const SMALL_DOWEL: HwDef = { kind: "dowel", len: 25, dia: 6 };
const SUPPORT_SCREW: HwDef = { kind: "camScrew", len: 30, dia: 8, name: "Connecting screw" };
const BED_BOLT: HwDef = { kind: "bolt", len: 110, dia: 8, name: "Bed bolt" };
const BED_WEDGE: HwDef = { kind: "clip", len: 14, dia: 22, name: "Wedge" };
const BED_NUT: HwDef = { kind: "nut", len: 6, dia: 8 };
const CONN_BOLT: HwDef = { kind: "stud", len: 45, dia: 8, name: "Connector bolt" };
const BED_CONN: HwDef = { kind: "cam", len: 18, dia: 34, name: "Bed connector" };
const GLIDE: HwDef = { kind: "glide", len: 8, dia: 40, name: "Glide" };
const RAIL_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const BEAM_BRACKET: HwDef = { kind: "angle", len: 60, dia: 40, name: "Beam bracket" };
const BRACE_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const HOLDER: HwDef = { kind: "clip", len: 30, dia: 25, name: "Slat holder" };
const HOLDER_SCREW: HwDef = { kind: "screw", len: 12, dia: 6 };
const BEAM_HOLDER: HwDef = { kind: "clip", len: 60, dia: 30, name: "Beam slat holder" };
const STRIP = (len: number, wide: boolean): HwDef => ({ kind: "strap", len, dia: wide ? 40 : 22, name: "Anti-slip strip" });
// the storage boxes
const BOX_BOLT: HwDef = { kind: "camScrew", len: 30, dia: 6 };
const BOX_DOWEL: HwDef = { kind: "dowel", len: 32, dia: 8 };
const BOX_CAM: HwDef = { kind: "cam", len: 11, dia: 14 };
const BOX_PIN: HwDef = { kind: "camScrew", len: 35, dia: 8, name: "Plastic cam dowel" };
const BOX_SCREW: HwDef = { kind: "screw", len: 34, dia: 5 };
const CASTOR_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };

/**
 * The bed frame, as the manuals build it: the footboard lies on its face while its legs, upright, rails and panels
 * are joined with double cam bolts (a centre support and its glide on the wide bed), then the headboard the same
 * way on a rug. Two of you stand the headboard up, bolt the side rails to its posts through wedge nuts and pull the
 * footboard on with the round connectors. Then the metal slat rails, the beam on its brackets (wide bed), the
 * telescopic braces, the slat holders, the anti-slip strips and the slatted bases. Boxes are built on their fronts.
 */
function bed(b: PlanBuilder, s: ProductSpec) {
  const twin = s.size.w < 130;
  const wide = !twin; // the 150 cm bed: two panels each end, a centre support, the beam
  // IKEA's measures (the catalog size is larger): 105 x 101 x 197 and 162 x 101 x 207
  const W = twin ? 1050 : 1620, L = twin ? 1970 : 2070, H = 1010;
  const PS = 60, PD = 34; // posts and legs: wide across, thin front to back
  const BT = 20, PT = 12; // rails, panels
  const xP = W / 2 - PS / 2, iw = W - 2 * PS;
  const zH = -L / 2 + PD / 2, zF = L / 2 - PD / 2;
  const Lin = L - 2 * PD;
  const yHT = 970, yHB0 = 200, yHB1 = 440; // headboard: top rail from 970, bottom rail 200 to 440
  const yFT = 360, yFB0 = 40, yFB1 = 130; // footboard: top rail from 360, bottom rail 40 to 130
  const xR = xP; // the side rails stand in line with the posts
  const yR0 = 200, yR1 = 380, yRm = (yR0 + yR1) / 2;
  const ySl = 315; // top of the slat rails and the beam
  const boxes = Number(/with (\d) storage boxes/i.exec(s.variant)?.[1] ?? 0);
  const slatsIn = twin || boxes === 4; // the bundles sold with LURÖY bases
  const sg = (x: number) => (x < 0 ? -1 : 1);
  const two = [-1, 1] as const;

  /* parts */
  const pw = wide ? (iw - PS) / 2 : iw;
  const panelX = wide ? [-(PS / 2 + pw / 2), PS / 2 + pw / 2] : [0];
  const T = (name: string, size: Vec3, material: "board" | "fiber" | "metal" | "wood" = "board") => typeOf(b, name, size, { material });
  // footboard
  const legs = two.map((g) => b.place(T("Footboard leg", [PS, yFT, PD]), [g * xP, yFT / 2, zF]));
  const fTop = b.place(T("Footboard top rail", [W, 30, 70]), [0, yFT + 15, zF]);
  const fLow = b.place(T("Footboard bottom rail", [iw, yFB1 - yFB0, BT]), [0, (yFB0 + yFB1) / 2, zF]);
  const fMid = wide ? b.place(T("Footboard upright", [PS, yFT - yFB1, BT]), [0, (yFB1 + yFT) / 2, zF]) : "";
  const fPanels = panelX.map((x) => b.place(T("Footboard panel", [pw, yFT - yFB1, PT]), [x, (yFB1 + yFT) / 2, zF]));
  const zSup = zF - BT / 2 - 20;
  const support = wide ? b.place(T("Centre support", [70, ySl + 15, 40]), [0, (ySl + 15) / 2, zSup]) : "";
  // headboard
  const posts = two.map((g) => b.place(T("Headboard post", [PS, yHT, PD]), [g * xP, yHT / 2, zH]));
  const hTop = b.place(T("Headboard top rail", [W, H - yHT, 80]), [0, (yHT + H) / 2, zH]);
  const hLow = b.place(T("Headboard bottom rail", [iw, yHB1 - yHB0, BT]), [0, (yHB0 + yHB1) / 2, zH]);
  const hMid = wide ? b.place(T("Headboard upright", [PS, yHT - yHB1, BT]), [0, (yHB1 + yHT) / 2, zH]) : "";
  const hPanels = panelX.map((x) => b.place(T("Headboard panel", [pw, yHT - yHB1, PT]), [x, (yHB1 + yHT) / 2, zH]));
  // the frame
  const sides = two.map((g) => b.place(T("Side rail", [BT, yR1 - yR0, Lin]), [g * xR, yRm, 0]));
  const xSl = xR - BT / 2 - 12.5;
  const slatRails = two.map((g) => b.place(T("Slat rail", [25, 25, Lin - 20], "metal"), [g * xSl, ySl - 12.5, 0]));
  const zBH = zH + BT / 2, zBF = zSup - 20; // the faces the beam brackets screw to
  const beamL = zBF - zBH - 6;
  const beam = wide ? b.place(T("Centre beam", [45, 25, beamL], "metal"), [0, ySl - 12.5, (zBH + zBF) / 2]) : "";
  // telescopic braces under the slat rails: a diamond from the beam brackets on the wide bed, a V on the twin
  const yBr = ySl - 26;
  const xs = xSl - 2;
  const braceEnds: [Vec3, Vec3][] = wide
    ? [zBH + 30, zBF - 30].flatMap((z) => two.map((g): [Vec3, Vec3] => [[0, yBr, z], [g * xs, yBr, (zBH + zBF) / 2]]))
    : two.map((k): [Vec3, Vec3] => [[-xs, yBr, 0], [xs, yBr, (k * Lin) / 4]]);
  const braces = braceEnds.map(([a, c]) => {
    const dx = c[0] - a[0], dz = c[2] - a[2];
    return b.place(T("Brace", [20, 2, Math.round(Math.hypot(dx, dz))], "metal"), [(a[0] + c[0]) / 2, yBr, (a[2] + c[2]) / 2], [0, Math.atan2(dx, dz), 0]);
  });
  // slatted bases (LURÖY), one or two side by side
  const bw = wide ? 740 : 960, bl = Lin - 12;
  const nSl = 17;
  const slatPieces: PartPiece[] = range(nSl).map((i) => ({ shape: "box", size: [bw, 8, 60], pos: [0, 0, -bl / 2 + 30 + (i * (bl - 60)) / (nSl - 1)], material: "wood" }));
  const { type: baseT, mid: baseMid } = b.compound("Slatted base", slatPieces, { material: "wood", extra: !slatsIn });
  const bases = (wide ? [-375, 375] : [0]).map((x) => b.place(baseT, [x + baseMid[0], ySl + 4 + baseMid[1], baseMid[2]]));

  /* joints */
  type J = { on: string; mate: string; at: Vec3; dir: Vec3 };
  const j = (on: string, mate: string, at: Vec3, dir: Vec3): J => ({ on, mate, at, dir });
  const fo = (x: J, dy = 0, dx = 0): FitOpts => ({ on: x.on, mate: x.mate, at: [x.at[0] + dx, x.at[1] + dy, x.at[2]], dir: x.dir });
  const cam = (on: string, at: Vec3, face: 1 | -1): FitOpts => ({ on, at, dir: [0, 0, -face] });
  // footboard joints: legs into the bottom rail ends and under the top rail, the upright between the rails
  const fyB = (yFB0 + yFB1) / 2;
  const legLow = two.map((g, i) => j(legs[i], fLow, [g * (iw / 2), fyB, zF], [g, 0, 0]));
  const legTop = two.map((g, i) => j(legs[i], fTop, [g * xP, yFT, zF], [0, -1, 0]));
  const midLow = wide ? j(fMid, fLow, [0, yFB1, zF], [0, 1, 0]) : null;
  const midTop = wide ? j(fMid, fTop, [0, yFT, zF], [0, -1, 0]) : null;
  const fIn = zF - BT / 2, fLegIn = zF - PD / 2, fTopIn = zF - 35; // the faces that are up while it lies on its front
  // headboard joints
  const hyB = [yHB0 + 70, yHB1 - 70];
  const lowEnds = two.map((g) => hyB.map((y) => j(hLow, posts[g < 0 ? 0 : 1], [g * (iw / 2), y, zH], [-g, 0, 0])));
  const postTop = two.map((g, i) => j(posts[i], hTop, [g * xP, yHT, zH], [0, -1, 0]));
  const midHLow = wide ? j(hMid, hLow, [0, yHB1, zH], [0, 1, 0]) : null;
  const midHTop = wide ? j(hMid, hTop, [0, yHT, zH], [0, -1, 0]) : null;
  const hFront = zH + BT / 2, hPostF = zH + PD / 2, hBack = zH - BT / 2, hPostB = zH - PD / 2, hTopB = zH - 40;

  const cF: Vec3 = [0, 0, zF], cH: Vec3 = [0, 0, zH];
  const stageAt = (k: string, c: Vec3, from?: Vec3, shift: Vec3 = [0, 0, 0]) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c[0] + shift[0], it.final.pos[1] - c[1] + shift[1], it.final.pos[2] - c[2] + shift[2]], it.final.rot, from);
  };
  // a leg or post joined to a rail end comes in along the rail's dowels, from beside it
  const out = (k: string, d = 260): Vec3 => [sg(b.partItem(k).final.pos[0]) * d, 0, 0];
  const foot = (o: StepOpts, body: () => void) => step(b, { scene: "footboard", pose: "-z", ...o }, body);
  const head = (o: StepOpts, body: () => void) => step(b, { scene: "headboard", pose: "+z", ...o }, body);

  /* the footboard, lying on its front on a rug */
  if (wide) {
    const all = [...legLow, ...legTop, midLow!, midTop!];
    foot({ title: "Fit the double cam bolts and dowels into the legs and the upright", detail: "Lay the parts on a rug. A dowel beside each bolt, then turn a cam lock over each bolt to hold it.", tools: ["hammer", "screwdriver"], kind: "cams", warnings: ["floor"] }, () => {
      b.stagger(0.12);
      for (const k of legs) stageAt(k, cF, [0, 200, 0], out(k));
      stageAt(fMid, cF, [0, 200, 0], [0, 220, 0]);
      b.then(0.15);
      b.fits(HW.dowel, all.map((x) => fo(x, x.dir[1] ? 0 : 25, x.dir[1] ? (x.at[0] ? -sg(x.at[0]) * 15 : 15) : 0)), 0.06);
      b.then(0.1);
      b.fits(D_BOLT, all.map((x) => fo(x, x.dir[1] ? 0 : -15, x.dir[1] && x.at[0] ? sg(x.at[0]) * 10 : 0)), 0.06);
      b.then(0.1);
      b.fits(BED_CAM, [...two.map((g, i) => cam(legs[i], [g * (iw / 2 + 30), fyB - 15, fLegIn], -1)), ...two.map((g, i) => cam(legs[i], [g * (xP + 10), yFT - 30, fLegIn], -1)), cam(fMid, [0, yFB1 + 30, fIn], -1), cam(fMid, [0, yFT - 30, fIn], -1)], 0.08);
    });
    foot({ title: "Push the legs and the upright onto the bottom rail", detail: "Bolts and dowels into their holes, then turn the three cam locks in the rail.", tools: ["screwdriver"], kind: "cams" }, () => {
      stageAt(fLow, cF, [0, 0, 0]);
      b.then(0.1);
      for (const k of [...legs, fMid]) stageAt(k, cF);
      b.then(0.1);
      b.fits(BED_CAM, [...two.map((g) => cam(fLow, [g * (iw / 2 - 30), fyB - 15, fIn], -1)), cam(fLow, [0, yFB1 - 30, fIn], -1)], 0.1);
    });
  } else {
    foot({ title: "Tap dowels into the ends of the bottom rail", detail: "Lay the parts on a rug, one dowel in each end.", tools: ["hammer"], kind: "dowels", warnings: ["floor"] }, () => {
      stageAt(fLow, cF, [0, 200, 0]);
      b.then(0.15);
      b.fits(HW.dowel, legLow.map((x) => ({ on: fLow, mate: x.on, at: [x.at[0], x.at[1] + 25, x.at[2]], dir: [-x.dir[0], 0, 0] })), 0.1);
    });
    foot({ title: "Fit a double cam bolt into each leg", detail: "Push it into the hole on the inside of the leg and turn a cam lock over it.", tools: ["screwdriver"], kind: "cams" }, () => {
      b.stagger(0.15);
      for (const k of legs) stageAt(k, cF, out(k, 200), out(k));
      b.then(0.15);
      b.fits(D_BOLT, legLow.map((x) => fo(x, -15)), 0.1);
      b.then(0.1);
      b.fits(BED_CAM, two.map((g, i) => cam(legs[i], [g * (iw / 2 + 30), fyB - 15, fLegIn], -1)), 0.1);
    });
    foot({ title: "Push the legs onto the bottom rail and lock them", detail: "Slide each leg onto the dowel and bolt in the rail end, then turn the two cam locks in the rail.", tools: ["screwdriver"], kind: "cams" }, () => {
      b.stagger(0.2);
      for (const k of legs) stageAt(k, cF);
      b.then(0.15);
      b.fits(BED_CAM, two.map((g) => cam(fLow, [g * (iw / 2 - 30), fyB - 15, fIn], -1)), 0.1);
    });
  }
  foot({ title: wide ? "Slide the panels into the grooves" : "Slide the panel into the grooves", detail: "Smooth side down, all the way to the bottom rail.", kind: "general" }, () => {
    b.stagger(0.25);
    for (const k of fPanels) stageAt(k, cF, [0, 350, 0]);
  });
  if (twin) {
    foot({ title: "Fit dowels and double cam bolts into the tops of the legs", detail: "One of each in every leg, and a cam lock over each bolt.", tools: ["hammer", "screwdriver"], kind: "cams" }, () => {
      b.fits(HW.dowel, legTop.map((x) => fo(x, 0, -sg(x.at[0]) * 15)), 0.1);
      b.then(0.1);
      b.fits(D_BOLT, legTop.map((x) => fo(x, 0, sg(x.at[0]) * 10)), 0.1);
      b.then(0.1);
      b.fits(BED_CAM, two.map((g, i) => cam(legs[i], [g * (xP + 10), yFT - 30, fLegIn], -1)), 0.1);
    });
  }
  foot({ title: "Put the top rail on and lock it", detail: wide ? "Push it onto the bolts and dowels of the legs and the upright, then turn its three cam locks." : "Push it onto the bolts and dowels, then turn its two cam locks.", tools: ["screwdriver"], kind: "cams" }, () => {
    stageAt(fTop, cF, [0, 200, 0]);
    b.then(0.1);
    b.fits(BED_CAM, [...two.map((g) => cam(fTop, [g * (xP - 10), yFT + 15, fTopIn], -1)), ...(wide ? [cam(fTop, [0, yFT + 15, fTopIn], -1)] : [])], 0.1);
  });
  if (wide) {
    const supIn = zSup - 20;
    foot({ title: "Press a glide into the centre support", detail: "Into its bottom end, pegs first.", kind: "general" }, () => {
      stageAt(support, cF, [0, 250, 0]);
      b.then(0.15);
      b.fit(GLIDE, { on: support, at: [0, 0, zSup], dir: [0, 1, 0], hole: false });
    });
    foot({ title: "Fix the centre support to the footboard", detail: "Two small dowels into the frame, push the support onto them, then drive the two connecting screws with the crank.", tools: ["hammer", "allen"], kind: "screws" }, () => {
      b.fits(SMALL_DOWEL, [80, 200].map((y): FitOpts => ({ on: fMid, mate: support, at: [0, y, fIn], dir: [0, 0, 1] })), 0.1);
      b.then(0.1);
      b.fits(SUPPORT_SCREW, [yFB1 - 40, 260].map((y): FitOpts => ({ on: support, mate: y < yFB1 ? fLow : fMid, at: [0, y, supIn], dir: [0, 0, 1] })), 0.15);
    });
  }
  const connY = [yR0 + 45, yR1 - 45];
  const connBolts = two.flatMap((g, i) => connY.map((y): FitOpts => ({ on: legs[i], at: [g * xR, y, fLegIn], dir: [0, 0, 1], mate: sides[i], mateHole: 5 })));
  foot({ title: "Screw the connector bolts into the legs", detail: "Two in the inside face of each leg, by hand until they stop.", kind: "bolts" }, () => b.fits(CONN_BOLT, connBolts, 0.1));
  foot({ title: "Press the glides under the legs", detail: "One into the bottom end of each leg.", kind: "general" }, () =>
    b.fits(GLIDE, two.map((g, i): FitOpts => ({ on: legs[i], at: [g * xP, 0, zF], dir: [0, 1, 0], hole: false })), 0.15),
  );

  /* the headboard, lying on its back on a rug */
  const lowBolts = lowEnds.flat();
  if (wide) {
    head({ title: "Tap dowels into the bottom rail and the upright", detail: "Lay them on a rug. Two in each end of the rail, two in the bottom end of the upright.", tools: ["hammer"], kind: "dowels", warnings: ["floor"] }, () => {
      b.stagger(0.2);
      for (const k of [hLow, hMid]) stageAt(k, cH, [0, 200, 0]);
      b.then(0.15);
      b.fits(HW.dowel, [...lowBolts.map((x) => fo(x, 35)), ...two.map((g): FitOpts => ({ ...fo(midHLow!, 0, g * 18) }))], 0.06);
    });
    head({ title: "Fit a double cam bolt into the upright", detail: "Into its bottom end, then turn the cam lock over it.", tools: ["screwdriver"], kind: "cams" }, () => {
      b.fit(D_BOLT, fo(midHLow!));
      b.then(0.1);
      b.fit(BED_CAM, cam(hMid, [0, yHB1 + 30, hFront], 1));
    });
  } else {
    head({ title: "Tap dowels into the ends of the bottom rail", detail: "Lay it on a rug, two in each end.", tools: ["hammer"], kind: "dowels", warnings: ["floor"] }, () => {
      stageAt(hLow, cH, [0, 200, 0]);
      b.then(0.15);
      b.fits(HW.dowel, lowBolts.map((x) => fo(x, 35)), 0.08);
    });
  }
  head({ title: "Fit the double cam bolts into the bottom rail", detail: "Two in each end, each held by a cam lock in the rail.", tools: ["screwdriver"], kind: "cams" }, () => {
    b.fits(D_BOLT, lowBolts.map((x) => fo(x)), 0.08);
    b.then(0.1);
    b.fits(BED_CAM, lowBolts.map((x) => cam(hLow, [x.at[0] - sg(x.at[0]) * 30, x.at[1], hFront], 1)), 0.08);
  });
  head({ title: "Push the posts onto the rail ends and lock them", detail: "Two cam locks in each post.", tools: ["screwdriver"], kind: "cams" }, () => {
    b.stagger(0.25);
    for (const k of posts) stageAt(k, cH, out(k));
    b.then(0.15);
    b.fits(BED_CAM, lowBolts.map((x) => cam(x.mate, [sg(x.at[0]) * xP, x.at[1], hPostF], 1)), 0.08);
  });
  if (wide)
    head({ title: "Stand the upright on the bottom rail and lock it", detail: "In the middle, onto its dowels, then one cam lock in the rail.", tools: ["screwdriver"], kind: "cams" }, () => {
      b.fit(BED_CAM, cam(hLow, [0, yHB1 - 30, hFront], 1));
    });
  head({ title: wide ? "Slide the panels into the grooves" : "Slide the panel into the grooves", detail: "Down to the bottom rail, smooth side to the front.", kind: "general" }, () => {
    b.stagger(0.25);
    for (const k of hPanels) stageAt(k, cH, [0, 500, 0]);
  });
  const topJ = [...postTop, ...(wide ? [midHTop!] : [])];
  head({ title: "Tap dowels into the tops of the posts", detail: "One in each.", tools: ["hammer"], kind: "dowels" }, () => b.fits(HW.dowel, postTop.map((x) => fo(x, 0, -sg(x.at[0]) * 15)), 0.12));
  head({ title: wide ? "Push double cam bolts into the posts and the upright" : "Push double cam bolts into the posts", detail: "Into the top ends, beside the dowels.", kind: "cams" }, () => b.fits(D_BOLT, topJ.map((x) => fo(x, 0, x.at[0] ? sg(x.at[0]) * 10 : 0)), 0.12));
  head({ title: "Push the top rail on", detail: "Its groove goes over the panels' top edges, down onto the bolts and dowels.", kind: "join" }, () => stageAt(hTop, cH, [0, 200, 0]));
  head({ title: "Turn it over and lock the cam locks", detail: wide ? "Three in the posts and the upright, three in the top rail." : "Two in the posts, two in the top rail.", tools: ["screwdriver"], kind: "cams", pose: "-z" }, () => {
    b.fits(BED_CAM, [...topJ.map((x) => cam(x.on, [x.at[0] ? sg(x.at[0]) * (xP + 10) : 0, yHT - 30, x.on === hMid ? hBack : hPostB], -1)), ...topJ.map((x) => cam(hTop, [x.at[0] ? sg(x.at[0]) * (xP - 10) : 0, (yHT + H) / 2, hTopB], -1))], 0.08);
  });
  head({ title: "Press the glides under the posts", detail: "One into the bottom end of each post.", kind: "general", pose: "-z" }, () =>
    b.fits(GLIDE, two.map((g, i): FitOpts => ({ on: posts[i], at: [g * xP, 0, zH], dir: [0, 1, 0], hole: false })), 0.15),
  );

  /* the frame */
  const zHe = -L / 2 + PD, zFe = L / 2 - PD; // side rail ends
  const dowelY = [yRm - 20, yRm + 20];
  step(b, { title: "Tap the dowels into the side rails", detail: "Two in each end.", tools: ["hammer"], scene: "rails", kind: "dowels", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    two.forEach((g, i) => b.stage(sides[i], [g * 260, BT / 2, 0], [0, 0, (g * Math.PI) / 2], [0, 160, 0]));
    b.then(0.15);
    b.fits(RAIL_DOWEL, two.flatMap((g, i) => [[zHe, -1], [zFe, 1]].flatMap(([z, d]) => dowelY.map((y): FitOpts => ({ on: sides[i], at: [g * xR, y, z], dir: [0, 0, d], mate: z < 0 ? posts[i] : legs[i] })))), 0.06);
  });
  const headItems = [...posts, hTop, hLow, ...(wide ? [hMid] : []), ...hPanels];
  const footItems = [...legs, fTop, fLow, ...(wide ? [fMid, support] : []), ...fPanels];
  const boltY = connY;
  const sideBolt = (i: number) => {
    const g = two[i];
    b.fits(BED_BOLT, boltY.map((y): FitOpts => ({ on: posts[i], at: [g * xR, y, -L / 2], dir: [0, 0, 1], mate: sides[i], hole: 5 })), 0.15);
    b.then(0.1);
    b.fits(BED_WEDGE, boltY.map((y): FitOpts => ({ on: sides[i], at: [g * (xR - BT / 2), y, zHe + 70], dir: [g, 0, 0] })), 0.12);
    b.then(0.05);
    b.fits(BED_NUT, boltY.map((y): FitOpts => ({ on: sides[i], at: [g * xR, y, zHe + 70], dir: [0, 0, -1], hole: false })), 0.12);
  };
  step(b, { title: "Stand the headboard up and push a side rail onto it", detail: "Two of you: one holds the headboard upright while the other pushes the rail onto its dowels. The holes for the wedges face in.", people: 2, kind: "join" }, () => {
    b.stagger(0);
    for (const k of headItems) b.add(k, [0, 0, -200]);
    b.wait(0.4);
    b.add(sides[0], [0, 0, 500]);
  });
  step(b, { title: "Bolt the side rail to the post", detail: "Two bed bolts through the post. Push a wedge into each hole in the rail, thread a nut on and tighten with the spanner while you turn the bolt with the crank.", tools: ["allen", "wrench"], people: 2, kind: "bolts" }, () => sideBolt(0));
  step(b, { title: "Fit the other side rail the same way", detail: "Onto the dowels, two bolts through the post, a wedge and a nut on each.", tools: ["allen", "wrench"], people: 2, kind: "bolts" }, () => {
    b.add(sides[1], [0, 0, 500]);
    b.then(0.15);
    sideBolt(1);
  });
  step(b, { title: "Press the bed connectors into the side rails", detail: "Into the big holes near the foot ends, two in each rail. The arrow points to the end of the rail.", kind: "cams" }, () =>
    b.fits(BED_CONN, two.flatMap((g, i) => boltY.map((y): FitOpts => ({ on: sides[i], at: [g * (xR - BT / 2), y, zFe - 40], dir: [g, 0, 0] }))), 0.1),
  );
  step(b, { title: "Fit the footboard and tighten the connectors", detail: "Two of you: push it onto the dowels and connector bolts, then turn each connector with the Allen key until the joint pulls tight.", tools: ["allen"], people: 2, kind: "join", warnings: ["two"] }, () => {
    b.stagger(0);
    for (const k of footItems) b.add(k, [0, 0, 400]);
  });
  step(b, { title: "Screw the slat rails to the side rails", detail: "Eight screws along each rail, the flat flange at the top facing in.", tools: ["screwdriver"], kind: "screws" }, () => {
    b.stagger(0.3);
    two.forEach((g, i) => b.add(slatRails[i], [-g * 200, 0, 0]));
    b.then(0.15);
    b.fits(RAIL_SCREW, two.flatMap((g, i) => spread(-(Lin / 2 - 80), Lin / 2 - 80, 8).map((z): FitOpts => ({ on: slatRails[i], at: [g * (xR - BT / 2 - 2), ySl - 14, z], dir: [g, 0, 0], mate: sides[i] }))), 0.04);
  });
  if (wide) {
    step(b, { title: "Screw the beam brackets on", detail: "One in the middle of the headboard's bottom rail, one on the centre support, two screws each.", tools: ["screwdriver"], kind: "screws" }, () => {
      b.fits(BEAM_BRACKET, [{ on: hLow, at: [0, ySl - 25, zBH], dir: [0, 0, -1], hole: false }, { on: support, at: [0, ySl - 25, zBF], dir: [0, 0, 1], hole: false }], 0.2);
      b.then(0.1);
      b.fits(RAIL_SCREW, [[hLow, zBH, -1], [support, zBF, 1]].flatMap(([on, z, d]) => [-20, 20].map((x): FitOpts => ({ on: on as string, at: [x, ySl - 40, z as number], dir: [0, 0, d as number] }))), 0.1);
    });
    step(b, { title: "Lay the centre beam in its brackets", detail: "Drop each end down into its bracket.", kind: "join" }, () => b.add(beam, [0, 260, 0]));
  }
  const braceScrews: FitOpts[] = wide
    ? braceEnds.flatMap(([a, c], i) => [{ on: braces[i], at: [a[0], yBr - 1, a[2]] as Vec3, dir: [0, 1, 0] as Vec3, mate: a[2] < 0 ? hLow : support }, { on: braces[i], at: [c[0], yBr - 1, c[2] + (a[2] < 0 ? -12 : 12)] as Vec3, dir: [0, 1, 0] as Vec3, mate: slatRails[c[0] < 0 ? 0 : 1] }])
    : [
        { on: braces[0], at: [-xs, yBr - 1, 0], dir: [0, 1, 0], mate: slatRails[0] },
        ...braceEnds.map(([, c], i): FitOpts => ({ on: braces[i], at: [c[0], yBr - 1, c[2]], dir: [0, 1, 0], mate: slatRails[1] })),
      ];
  step(b, { title: wide ? "Screw the four braces under the frame" : "Screw the two braces under the frame", detail: wide ? "Pull each one out to length. They run from the beam brackets to the middle of the slat rails, one screw at each end." : "Pull each one out to length. Both start at the middle of one slat rail and run to the other, one screw at each end.", tools: ["screwdriver"], kind: "screws" }, () => {
    b.stagger(0.25);
    for (const k of braces) b.add(k, [0, -160, 0]);
    b.then(0.15);
    b.fits(BRACE_SCREW, braceScrews, 0.08);
  });
  step(b, { title: "Square the frame and lock the braces", detail: "Measure both diagonals and push the frame until they match, then put a screw in the middle of each brace.", tools: ["screwdriver", "tape"], kind: "square", check: "square", warnings: ["square"] }, () =>
    b.fits(BRACE_SCREW, braces.map((k): FitOpts => ({ on: k, at: b.partItem(k).final.pos.map((v, i) => (i === 1 ? v - 1 : v)) as Vec3, dir: [0, 1, 0], hole: false })), 0.12),
  );
  const zHold = Lin / 2 - 10 - 25;
  const holders = two.flatMap((g, i) => two.map((k): FitOpts => ({ on: slatRails[i], at: [g * xSl, ySl, k * zHold], dir: [0, -1, 0] })));
  step(b, { title: "Fit the slat holders at the ends of the rails", detail: "One at each end of both slat rails, a screw up from underneath into each.", tools: ["screwdriver"], kind: "screws" }, () => {
    b.fits(HOLDER, holders, 0.1);
    b.then(0.1);
    b.fits(HOLDER_SCREW, holders.map((o) => ({ ...o, at: [o.at[0], ySl - 25, o.at[2]] as Vec3, dir: [0, 1, 0] as Vec3, hole: false })), 0.1);
  });
  if (wide) {
    const zb = beamL / 2 - 30, zc = (zBH + zBF) / 2;
    step(b, { title: "Push the holders into the ends of the beam", detail: "Their pegs go into the holes on top.", kind: "general" }, () =>
      b.fits(BEAM_HOLDER, two.map((k): FitOpts => ({ on: beam, at: [0, ySl, zc + k * zb], dir: [0, -1, 0] })), 0.15),
    );
    const segB = (beamL - 140) / 3;
    step(b, { title: "Stick the wide strips along the beam", detail: "Three of them, end to end between the holders. Peel the backing off as you go and press them flat; cut the last one to length.", kind: "general" }, () =>
      b.fits(STRIP(Math.round(segB - 10), true), range(3).map((i): FitOpts => ({ on: beam, at: [0, ySl, zc - (beamL - 140) / 2 + segB * (i + 0.5)], dir: [0, -1, 0], hole: false })), 0.15),
    );
  }
  const segR = (2 * zHold - 60) / 3;
  step(b, { title: "Stick the strips along the slat rails", detail: "Three on each rail, between the holders. Press them down firmly so the slats can't slide or squeak.", kind: "general" }, () =>
    b.fits(STRIP(Math.round(segR - 10), false), two.flatMap((g, i) => range(3).map((k): FitOpts => ({ on: slatRails[i], at: [g * xSl, ySl, -zHold + 30 + segR * (k + 0.5)], dir: [0, -1, 0], hole: false }))), 0.08),
  );
  step(b, { title: wide ? "Lay in the slatted bases" : "Lay in the slatted base", detail: slatsIn ? "Curved side up, the end slats tucked under the holders." : "The slatted bases are sold separately. Curved side up, the end slats tucked under the holders.", kind: "slats", people: wide ? 2 : 1 }, () => {
    b.stagger(0.4);
    for (const k of bases) b.add(k, [0, 300, 0]);
  });
  if (boxes) bedBoxes(b, { n: boxes, xo: xR + BT / 2 - 5, Lin });
  return true;
}

/** The roll-out boxes: built on their fronts (cam bolts, sides, back on plastic cam dowels), then the bottom and the castors upside down. */
function bedBoxes(b: PlanBuilder, o: { n: number; xo: number; Lin: number }) {
  const { n, xo, Lin } = o;
  const FL = (Lin - 30) / 2, BD = 640;
  const y0 = 58, sh = 132, by = 66; // underside of the sides, side height, bottom
  const T = (name: string, size: Vec3, material: "board" | "fiber" = "board") => typeOf(b, name, size, { material });
  const slots: [number, number][] = n >= 4 ? [[1, -1], [1, 1], [-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  const all = slots.map(([g, k]) => {
    const zc = k * (FL / 2 + 7.5);
    const xc = g * (xo - 18 - (BD - 34) / 2);
    return {
      g,
      zc,
      xc,
      front: b.place(T("Box front", [18, 170, FL]), [g * (xo - 9), 110, zc]),
      sides: [-1, 1].map((e) => b.place(T("Box side", [BD - 34, sh, 16]), [xc, y0 + sh / 2, zc + e * (FL / 2 - 8)])),
      back: b.place(T("Box back", [16, y0 + sh - 72, FL]), [g * (xo - BD + 8), (72 + y0 + sh) / 2, zc]),
      bottom: b.place(T("Box bottom", [BD - 24, 3, FL - 22], "fiber"), [xc, by, zc]),
    };
  });
  type Bx = (typeof all)[number];
  const fitsOf = (x: Bx) => {
    const xF = x.g * (xo - 18), xB = x.g * (xo - BD + 16), xBo = x.g * (xo - BD);
    const ends = [-1, 1];
    const zE = (e: number) => x.zc + e * (FL / 2 - 8);
    const zIn = (e: number) => x.zc + e * (FL / 2 - 16);
    const ys = [y0 + 35, y0 + sh - 35];
    return {
      bolts: ends.flatMap((e, i) => ys.map((y): FitOpts => ({ on: x.front, at: [xF, y, zE(e)], dir: [x.g, 0, 0], mate: x.sides[i], mateHole: 4 }))),
      dowels: ends.flatMap((e, i): FitOpts[] => [
        { on: x.sides[i], at: [xF, y0 + sh / 2, zE(e)], dir: [-x.g, 0, 0], mate: x.front },
        { on: x.sides[i], at: [xB, y0 + sh / 2, zE(e)], dir: [x.g, 0, 0], mate: x.back },
      ]),
      frontCams: ends.flatMap((e, i) => ys.map((y): FitOpts => ({ on: x.sides[i], at: [xF - x.g * 30, y, zIn(e)], dir: [0, 0, e] }))),
      pins: ends.flatMap((e, i) => ys.map((y): FitOpts => ({ on: x.back, at: [xBo, Math.max(y, 100), zE(e)], dir: [x.g, 0, 0], mate: x.sides[i] }))),
      backCams: ends.flatMap((e, i) => ys.map((y): FitOpts => ({ on: x.sides[i], at: [xB + x.g * 30, Math.max(y, 100), zIn(e)], dir: [0, 0, e] }))),
      // up through the edge of the bottom, where it lies in the grooves, into the back, the front and the sides
      screws: [
        ...spread(x.zc - FL / 2 + 120, x.zc + FL / 2 - 120, 3).map((z): FitOpts => ({ on: x.bottom, at: [xB - x.g * 2.5, by - 1.5, z], dir: [0, 1, 0], mate: x.back })),
        ...spread(x.zc - FL / 4, x.zc + FL / 4, 2).map((z): FitOpts => ({ on: x.bottom, at: [xF + x.g * 2.5, by - 1.5, z], dir: [0, 1, 0], mate: x.front })),
        ...ends.flatMap((e, i) => [x.xc - 150, x.xc + 150].map((xx): FitOpts => ({ on: x.bottom, at: [xx, by - 1.5, zIn(e) + e * 2.5], dir: [0, 1, 0], mate: x.sides[i] }))),
      ],
      castors: [xF - x.g * 70, xB + x.g * 70].flatMap((cx) => ends.map((e): FitOpts => ({ on: x.bottom, at: [cx, by - 1.5, x.zc + e * (FL / 2 - 70)], dir: [0, 1, 0], hole: false }))),
      castorScrews: [xF - x.g * 70, xB + x.g * 70].flatMap((cx) => ends.flatMap((e) => [-16, 16].map((dz): FitOpts => ({ on: x.bottom, at: [cx, by - 1.5, x.zc + e * (FL / 2 - 70) + dz], dir: [0, 1, 0] })))),
    };
  };
  const x0 = all[0];
  const c0: Vec3 = [x0.xc, y0 + sh / 2, x0.zc];
  const stageB = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
  };
  const f0 = fitsOf(x0);
  const bs = (o2: StepOpts, body: () => void) => step(b, { scene: "box", pose: "-x", repeat: all.length, ...o2 }, body);
  bs({ title: "Screw the cam bolts into a box front", detail: "Lay the front face down on a rug. Four bolts, two near each end.", tools: ["screwdriver"], kind: "cams", warnings: ["floor", "face"] }, () => {
    stageB(x0.front, [-200, 0, 0]);
    b.then(0.15);
    b.fits(BOX_BOLT, f0.bolts, 0.1);
  });
  bs({ title: "Tap the dowels into the box sides", detail: "One into each end of both sides.", tools: ["hammer"], kind: "dowels" }, () => {
    b.stagger(0.2);
    for (const k of x0.sides) stageB(k, [300, 0, 0]);
    b.then(0.15);
    b.fits(BOX_DOWEL, f0.dowels, 0.1);
  });
  bs({ title: "Stand the sides on the front and lock them", detail: "Onto the bolts, then turn the four cam locks clockwise.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(BOX_CAM, f0.frontCams, 0.1));
  bs({ title: "Put the back on", detail: "Lay it over the ends of the sides and push the four plastic cam dowels through it.", kind: "cams" }, () => {
    stageB(x0.back, [-260, 0, 0]);
    b.then(0.15);
    b.fits(BOX_PIN, f0.pins, 0.1);
  });
  bs({ title: "Lock the back with the cam locks", detail: "Four more, in the sides near the back.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(BOX_CAM, f0.backCams, 0.1));
  bs({ title: "Turn it over and slide in the bottom", detail: "Upside down now. The bottom runs in the grooves from the back edge.", kind: "drawer", pose: "-y" }, () => stageB(x0.bottom, [0, 0, -500]));
  bs({ title: "Screw the bottom on", detail: "Nine screws with the Allen key, into the back, the sides and the front.", tools: ["allen"], kind: "screws", pose: "-y" }, () => b.fits(BOX_SCREW, f0.screws, 0.06));
  bs({ title: "Screw on the castors", detail: "One near each corner, two screws each.", tools: ["screwdriver"], kind: "legs", pose: "-y" }, () => {
    b.fits(HW.castor, f0.castors, 0.15);
    b.then(0.1);
    b.fits(CASTOR_SCREW, f0.castorScrews, 0.04);
  });
  step(b, { title: all.length > 2 ? `Roll all ${all.length} boxes under the bed` : "Roll the boxes under the bed", detail: "Crouch and lift the front a little so the castors clear the side rail.", kind: "drawer" }, () => {
    for (const [i, x] of all.entries()) {
      b.stagger(0);
      for (const k of [x.front, ...x.sides, x.back, x.bottom]) b.add(k, [x.g * 700, 0, 0]);
      if (i > 0) {
        const f = fitsOf(x);
        const list: [HwDef, FitOpts[]][] = [
          [BOX_BOLT, f.bolts],
          [BOX_DOWEL, f.dowels],
          [BOX_CAM, [...f.frontCams, ...f.backCams]],
          [BOX_PIN, f.pins],
          [BOX_SCREW, f.screws],
          [HW.castor, f.castors],
          [CASTOR_SCREW, f.castorScrews],
        ];
        for (const [def, l] of list) for (const op of l) b.preset(def, op);
      }
      b.wait(0.25);
    }
  });
}

/* ---------- the family ---------- */

const family: Family = {
  names: ["FÅGELFJÄLLET", "FAGELFJALLET"],
  build(b, s) {
    const c = chestCfg(s);
    if (c) return chest(b, s, c);
    const v = s.variant.toLowerCase();
    if (/^nightstand/.test(v)) return cupboard(b, s, true);
    if (/^bedside table/.test(v)) return cupboard(b, s, false);
    if (/^wardrobe with 2 doors/.test(v)) return wardrobe(b, s);
    if (/^bed frame/.test(v)) return bed(b, s);
    return false;
  },
};
export default family;
