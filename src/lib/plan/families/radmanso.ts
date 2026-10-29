import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { PlanBuilder, type FitOpts, type HwDef } from "../builder";
import { buildCustom } from "../custom";

/*
 * RÅDMANSÖ, read from IKEA's manuals.
 *
 * The chests, the TV bench, the cabinet and the wardrobe are click-together carcasses: the panels come with click
 * fittings already in their edges, so a side pushes onto the top and clicks home with no tools. They are built lying
 * on their fronts, the back panels slid down grooves in the sides, then the bottom clicks on and long connector
 * screws pull it tight. A black steel leg frame (two leg ends and two rails, Allen bolts) is bolted under the bottom,
 * with a levelling foot in each leg. Every drawer is the same: the sides click onto the front, the bottom slides in,
 * a spring wire goes in the back, the back is locked with click pins and cam locks, then runners and a brass knob.
 * The bedside table is the odd one: cam bolts and cam locks, built lying on its side. The beds are a steel frame
 * with a sloping headboard bolted to the posts.
 */

const T = 16; // panels
const BT = 10; // back panels, in grooves
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

// fittings, sized so different ones stay apart in the list
const RUN_SCREW = { len: 11, dia: 4 };
const BRACKET_SCREW = { len: 15, dia: 4 };
const CONNECTOR = { len: 60, dia: 7, name: "Connector screw" }; // the long coarse screws turned with the Allen key
const FRAME_BOLT = { len: 25, dia: 6 }; // joins the leg frame
const LEG_BOLT = { len: 60, dia: 6 }; // the leg frame to the bottom
const FOOT = { len: 30, dia: 20, name: "Levelling foot" };
const FOOT_CUP = { len: 10, dia: 24, name: "Foot insert" };
const RAIL_SCREW = { len: 13, dia: 6 };
const WALL_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 35, dia: 8 };
const WALL_WASHER: HwDef = { kind: "washer", len: 1.5, dia: 20 };

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
  if (n < 0) throw new Error(`RÅDMANSÖ: ${a.id} and ${b.id} don't touch`);
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
const dowels = (host: Part, other: Part, fr: number[], hw: { len?: number; dia?: number; name?: string } = {}, across?: number): CustomFix => ({ kind: "dowel", count: fr.length, at: along(host, other, fr, across), dir: toward(host, touch(host, other)), on: host.id, mate: other.id, ...hw });
/** Cam bolts screwed into the face of `face`, their heads caught by cam locks in the edge of `edge`. */
const bolts = (face: Part, edge: Part, fr: number[], across?: number): CustomFix => ({ kind: "camScrew", count: fr.length, at: along(face, edge, fr, across), dir: toward(face, touch(face, edge)), on: face.id, mate: edge.id });
/** Cam locks in `edge`, a little in from the joint, on its face towards `side` (+1 or -1 along its thinnest axis). */
function cams(face: Part, edge: Part, fr: number[], side: 1 | -1, across?: number, hw: { len?: number; dia?: number; name?: string } = {}): CustomFix {
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
  return { kind: "cam", count: fr.length, at, dir: unit(t, -side), on: edge.id, ...hw };
}
/** Screws through `through` into `into`, from its far face. */
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
const at = (kind: CustomFix["kind"], on: Part, pts: Vec3[], dir: Vec3, hw: { len?: number; dia?: number; name?: string } = {}, mate?: Part): CustomFix => ({ kind, count: pts.length, at: pts, dir, on: on.id, ...(mate ? { mate: mate.id } : {}), ...hw });

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

type StepOpts = { title: string; detail?: string; tools?: ToolId[]; pose?: Pose; scene?: string; kind?: StepKind; warnings?: WarnId[]; people?: 1 | 2; repeat?: number; wall?: boolean };
const step = (b: PlanBuilder, o: StepOpts, body: () => void = () => {}) => b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);

/* ---------- shared carcass pieces ---------- */

/** Drawer runners screwed to the inside of a wall, one per drawer, `per` screws each. */
function runners(wall: Part, side: 1 | -1, ys: number[], zf: number, len: number, per = 3): CustomFix[] {
  const x = wall.pos[0] + side * (wall.size[0] / 2);
  const zs = spread(zf - 40, zf - len + 30, per);
  return [
    at("runner", wall, ys.map((y): Vec3 => [x + side * 5, y, zf - 10 - len / 2]), [-side, 0, 0], { len, dia: 20 }),
    at("screw", wall, ys.flatMap((y) => zs.map((z): Vec3 => [x + side * 10, y, z])), [-side, 0, 0], RUN_SCREW),
  ];
}

/** The metal L brackets screwed inside the sides at the top back, for the wall screws (chests of 3 and 5). */
function bracketFixes(sides: Part[], y: number, zb: number): CustomFix[] {
  return sides.flatMap((p) => {
    const g = p.pos[0] < 0 ? 1 : -1; // towards the inside
    const x = p.pos[0] + g * (p.size[0] / 2);
    return [
      at("bracket", p, [[x + g * 16, y, zb + 12]], [0, 0, -1], { len: 40, dia: 30 }),
      at("screw", p, [[x + g * 2, y - 12, zb + 24], [x + g * 2, y + 12, zb + 24]], [-g, 0, 0], BRACKET_SCREW),
    ];
  });
}

/** The adjustable wall fittings pushed into the back edges of the sides (6-drawer chest, cabinet, TV bench, wardrobe). */
function wallFittings(sides: Part[], y: number): CustomFix[] {
  return sides.map((p) => at("bracket", p, [[p.pos[0] - Math.sign(p.pos[0]) * 4, y, p.pos[2] - p.size[2] / 2]], [0, 0, 1], { len: 30, dia: 36, name: "Wall fitting" }));
}

interface LegFrame {
  ends: Part[];
  rails: Part[];
  xl: number;
  zl: number;
  y: number;
}

/**
 * The steel leg frame under every carcass: two leg ends (two round legs and a cross rail) and two long rails between
 * them, inset from the corners, the top of the rails under the bottom panel at `y`.
 */
function legFrame(k: Kit, o: { xl: number; zl: number; y: number; mids?: number[] }): LegFrame {
  const leg = 25, rh = 30, rt = 20;
  const xs = [-o.xl, ...(o.mids ?? []), o.xl];
  const ends = xs.map((x, i) =>
    k.part(`leg${i}`, i === 0 || i === xs.length - 1 ? "Leg frame" : "Middle leg frame", [leg, o.y, 2 * o.zl + leg], [x, o.y / 2, 0], {
      material: "metal",
      pieces: [
        { shape: "cyl", size: [leg, o.y, leg], pos: [0, 0, -o.zl] },
        { shape: "cyl", size: [leg, o.y, leg], pos: [0, 0, o.zl] },
        { shape: "box", size: [rt, rh, 2 * o.zl - leg], pos: [0, o.y / 2 - rh / 2, 0] },
      ],
    }),
  );
  const zr = o.zl - 40;
  const rails = [-1, 1].map((g) => k.part(`lr${g < 0 ? "b" : "f"}`, "Leg rail", [2 * o.xl - leg, rh, rt], [0, o.y - rh / 2, g * zr], { material: "metal" }));
  return { ends, rails, xl: o.xl, zl: o.zl, y: o.y };
}

/** Recipe steps for the leg frame: bolt it together, bolt it under the bottom, screw in the feet. */
function legSteps(k: Kit, f: LegFrame, bottom: Part, o: { pose: Pose; detail?: string }) {
  const zr = f.zl - 40;
  const L = f.ends[0], R = f.ends[f.ends.length - 1];
  k.step({
    title: "Bolt the leg frame together",
    detail: "Two leg ends and two rails. One short Allen bolt through each leg end into a rail, the shorter bolts, not the long ones.",
    add: [...f.ends.map((p) => p.id), ...f.rails.map((p) => p.id)],
    fix: [
      at("bolt", L, [-1, 1].map((g): Vec3 => [-f.xl - 10, f.y - 15, g * zr]), [1, 0, 0], FRAME_BOLT),
      at("bolt", R, [-1, 1].map((g): Vec3 => [f.xl + 10, f.y - 15, g * zr]), [-1, 0, 0], FRAME_BOLT),
    ],
    tools: ["allen"],
    pose: o.pose,
    from: Object.fromEntries([...f.ends, ...f.rails].map((p) => [p.id, [0, -320, 0] as Vec3])),
  });
  k.step({
    title: "Bolt the leg frame to the bottom",
    detail: o.detail ?? "Line the frame up with the holes in the bottom panel. Four long Allen bolts down through the leg ends.",
    fix: [L, R].map((p) => at("bolt", p, [-1, 1].map((g): Vec3 => [p.pos[0], f.y - 30, g * (f.zl - 90)]), [0, 1, 0], LEG_BOLT, bottom)),
    tools: ["allen"],
    pose: o.pose,
  });
  const feet = [L, R].flatMap((p) => [-1, 1].map((g): [Part, Vec3] => [p, [p.pos[0], 0, g * f.zl]]));
  k.step({
    title: "Screw a foot into each leg",
    detail: "Press an insert into the end of each leg, then screw the foot into it.",
    fix: [...[L, R].map((p) => at("cap", p, feet.filter(([q]) => q === p).map(([, v]) => v), [0, 1, 0], FOOT_CUP)), ...[L, R].map((p) => at("foot", p, feet.filter(([q]) => q === p).map(([, v]) => v), [0, 1, 0], FOOT))],
    pose: o.pose,
  });
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
  per: number; // runner screws on each side
}

/** Drawers in a column of openings between y0 and y1 and two walls at x0 and x1, counted from the top. */
function stackDrawers(o: { x0: number; x1: number; y0: number; y1: number; n: number; zf: number; dd: number; per?: number; gap?: number }): DrawerBox[] {
  const ph = (o.y1 - o.y0) / o.n;
  const wIn = o.x1 - o.x0;
  const gap = o.gap ?? 4;
  return range(o.n).map((i) => {
    const yb = o.y1 - (i + 1) * ph;
    const fh = ph - gap;
    return { x: (o.x0 + o.x1) / 2, y0: yb + 16, w: wIn - 26, sh: Math.min(fh - 50, 170), dd: o.dd, zf: o.zf, fw: wIn - 4, fh, fy: yb + gap / 2 + fh / 2, per: o.per ?? 3 };
  });
}

/**
 * RÅDMANSÖ drawers, as every manual builds them: one of each size is built on screen (with "do this for each"), the
 * others slide in at the end with their fittings already on.
 */
function drawers(b: PlanBuilder, list: DrawerBox[], o: { knobs?: boolean } = {}) {
  const knobs = o.knobs ?? true;
  if (!list.length) return;
  const ft = 16, st = 12;
  const types = new Map<string, string>();
  const typeOf = (name: string, size: Vec3, material: "board" | "fiber" = "board") => {
    const key = `${name}|${size.map(Math.round).join("x")}`;
    if (!types.has(key)) types.set(key, b.part(name, size, { material }));
    return types.get(key)!;
  };
  const made = list.map((d) => {
    const zIn = d.zf - ft;
    const xs = d.w / 2 - st / 2;
    const zc = zIn - d.dd / 2;
    const front = b.place(typeOf("Drawer front", [d.fw, d.fh, ft]), [d.x, d.fy, d.zf - ft / 2]);
    const sideT = typeOf("Drawer side", [st, d.sh, d.dd]);
    const sides = [-1, 1].map((g) => b.place(sideT, [d.x + g * xs, d.y0 + d.sh / 2, zc]));
    const back = b.place(typeOf("Drawer back", [d.w - 2 * st, d.sh - 14, st]), [d.x, d.y0 + 14 + (d.sh - 14) / 2, zIn - d.dd + st / 2]);
    const bottom = b.place(typeOf("Drawer bottom", [d.w - 2 * st + 10, 4, d.dd - st - 4], "fiber"), [d.x, d.y0 + 9, zc + st / 2 - 2]);
    return { d, front, sides, back, bottom, zIn, xs, zc };
  });
  type M = (typeof made)[number];
  const PIN: HwDef = { kind: "camScrew", len: 40, dia: 7, name: "Click pin" };
  const CAM: HwDef = { kind: "cam", len: 13, dia: 15 };
  const WIRE: HwDef = { kind: "clip", len: 30, dia: 8, name: "Spring wire" };
  const RUN = (m: M): HwDef => ({ kind: "runner", len: Math.round((m.d.dd - 20) / 10) * 10, dia: 20 });
  const SCR: HwDef = { kind: "screw", ...RUN_SCREW };
  const KNOB: HwDef = { kind: "knob", len: 25, dia: 18 };
  const KSCR: HwDef = { kind: "screw", len: 25, dia: 4 };
  const fitsOf = (m: M) => {
    const { d, zIn, xs } = m;
    const zb = zIn - d.dd + st / 2;
    const yb = (f: number) => d.y0 + 14 + (d.sh - 14) * f;
    const per = (fn: (g: -1 | 1, side: string) => FitOpts[]) => [...fn(-1, m.sides[0]), ...fn(1, m.sides[1])];
    return {
      pins: per((g, sd) => [0.3, 0.75].map((f): FitOpts => ({ on: sd, at: [d.x + g * (xs + st / 2), yb(f), zb], dir: [-g, 0, 0], mate: m.back }))),
      cams: per((g) => [0.3, 0.75].map((f): FitOpts => ({ on: m.back, at: [d.x + g * (xs - st / 2 - 22), yb(f), zb + st / 2], dir: [0, 0, -1] }))),
      wire: [{ on: m.back, at: [d.x, d.y0 + 14, zb], dir: [0, 1, 0], hole: false } as FitOpts],
      runners: per((g, sd) => [{ on: sd, at: [d.x + g * xs, d.y0, zIn - 10 - (d.dd - 20) / 2], dir: [0, 1, 0], hole: false } as FitOpts]),
      runScrews: per((g, sd) => spread(zIn - 40, zIn - d.dd + 50, d.per).map((z): FitOpts => ({ on: sd, at: [d.x + g * (xs + st / 2 + 2), d.y0 + 8, z], dir: [-g, 0, 0] }))),
      knob: [{ on: m.front, at: [d.x, d.fy, d.zf], dir: [0, 0, -1], hole: false } as FitOpts],
      kScrew: [{ on: m.front, at: [d.x, d.fy, zIn], dir: [0, 0, 1] } as FitOpts],
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

  ds({ title: `Click the sides onto ${the} drawer front`, detail: "Lay the front face down on a rug. The click fittings are already in: push each side on and press it down until it clicks.", warnings: ["face"] }, () => {
    each((m, i) => stage(m, i, m.front, [0, 0, -200]));
    b.then(0.15);
    b.stagger(0.25);
    each((m, i) => m.sides.forEach((sd) => stage(m, i, sd, [0, 0, -260])));
  });
  ds({ title: "Slide in the drawer bottom", detail: "Turn the drawer over and slide the bottom down the grooves in the sides until it reaches the front." }, () => each((m, i) => stage(m, i, m.bottom, [0, 0, -400])));
  ds({ title: "Push the spring wire into the back", detail: "Both ends all the way into the holes in the bottom edge of the back, so it presses the bottom down.", kind: "general" }, () => {
    each((m, i) => stage(m, i, m.back, [0, 0, -260]));
    b.then(0.15);
    each((_, i) => b.fits(WIRE, fs[i].wire, 0.1));
  });
  ds({ title: "Lock the back on", detail: "Four click pins through the sides into the back, then a cam lock over each one, turned to lock it.", tools: ["screwdriver"], kind: "cams" }, () => {
    each((_, i) => b.fits(PIN, fs[i].pins, 0.08));
    b.then(0.1);
    each((_, i) => b.fits(CAM, fs[i].cams, 0.1));
  });
  ds({ title: `Screw the runners onto ${the} drawer`, detail: `Stand it up. Hook each runner onto the front, then ${list[0].per} screws along the bottom edge of the side.`, tools: ["screwdriver"], kind: "runners", pose: "+y" }, () => {
    each((m, i) => b.fits(RUN(m), fs[i].runners, 0.25));
    b.then(0.1);
    each((_, i) => b.fits(SCR, fs[i].runScrews, 0.06));
  });
  if (knobs) ds({ title: "Screw on the knob", detail: "One screw from inside the front. Turn it by hand, not with a drill.", tools: ["screwdriver"], kind: "screws", pose: "+y" }, () => {
    each((_, i) => b.fits(KNOB, fs[i].knob, 0.2));
    b.then(0.05);
    each((_, i) => b.fits(KSCR, fs[i].kScrew, 0.12));
  });
  step(b, { title: n > 2 ? `Slide in all ${n} drawers` : n === 2 ? "Slide in both drawers" : "Slide in the drawer", detail: "Rest its runners on the ones in the frame and push it in until it closes. Only open one drawer at a time.", kind: "drawer" }, () => {
    for (const m of made) {
      b.stagger(0);
      for (const k of [m.front, ...m.sides, m.bottom, m.back]) b.add(k, [0, 0, 520]);
      if (!shown.includes(m)) {
        const f = fitsOf(m);
        const all: [HwDef, FitOpts[]][] = [
          [WIRE, f.wire],
          [PIN, f.pins],
          [CAM, f.cams],
          [RUN(m), f.runners],
          [SCR, f.runScrews],
          ...(knobs ? ([[KNOB, f.knob], [KSCR, f.kScrew]] as [HwDef, FitOpts[]][]) : []),
        ];
        for (const [def, l] of all) for (const x of l) b.preset(def, x);
      }
      b.wait(0.22);
    }
  });
}

/* ---------- the wall fixing (plugs and screws are in the box) ---------- */

function wallStep(b: PlanBuilder, pts: Vec3[], o: { tall?: boolean; detail?: string; notInBox?: boolean } = {}) {
  const plug: HwDef = { ...WALL_PLUG, notIncluded: o.notInBox };
  const screw: HwDef = { ...WALL_SCREW, notIncluded: o.notInBox };
  step(
    b,
    {
      title: "Fix it to the wall",
      detail: o.detail ?? "Stand it against the wall and mark through the fittings. Pull it away, drill and plug the holes, push it back and screw it on with a washer on each screw.",
      tools: ["pencil", "drill", "screwdriver"],
      kind: "anchor",
      wall: true,
      people: o.tall ? 2 : 1,
      warnings: o.tall ? ["wall", "tip", "two"] : ["wall", "tip"],
    },
    () => {
      b.stagger(0.15);
      for (const p of pts) b.fit(plug, { at: [p[0], p[1], p[2] - 30], dir: [0, 0, -1] });
      b.then(0.1);
      for (const p of pts) b.fit(WALL_WASHER, { at: [p[0], p[1], p[2] + 3], dir: [0, 0, -1] });
      b.then(0.05);
      for (const p of pts) b.fit(screw, { at: [p[0], p[1], p[2] + 4], dir: [0, 0, -1] });
    },
  );
}

const levelStep = (b: PlanBuilder, byHand = false) =>
  step(b, { title: "Level it", detail: byHand ? "Stand it where it will go and turn the feet by hand until it stands level and steady." : "Stand it where it will go and turn the feet with the spanner until it stands level and steady.", tools: byHand ? ["level"] : ["wrench", "level"], kind: "legs" });

/* ---------- chests of drawers ---------- */

/**
 * The chests are built lying on their fronts: the sides click onto the top, the back panels slide down the grooves
 * from the open end, the bottom clicks on last, then the leg frame goes on underneath.
 */
function chest(b: PlanBuilder, s: ProductSpec, kind: "c3" | "c5") {
  const W = Math.round(s.size.w * 10), D = 480, H = Math.round(s.size.h * 10);
  const Y0 = 130; // room under it
  const k = new Kit();
  const xi = W / 2 - T;
  const zBack = -D / 2 + 12;
  const tall = kind === "c5";
  // the bottom runs under the sides, screwed up into them
  const sideH = tall ? H - Y0 - T : H - Y0 - 2 * T;
  const L = k.part("L", "Side panel", [T, sideH, D], [-W / 2 + T / 2, Y0 + T + sideH / 2, 0]);
  const R = k.part("R", "Side panel", [T, sideH, D], [W / 2 - T / 2, Y0 + T + sideH / 2, 0]);
  const bottom = k.part("bot", "Bottom panel", [W, T, D], [0, Y0 + T / 2, 0]);
  const bw = 2 * xi + 16; // the backs run in the grooves
  const yb0 = Y0 + T;
  let yTop: number; // underside of the panel over the drawers
  let top: Part, shelf: Part | null = null, tray: Part | null = null, upper: Part | null = null, rail: Part | null = null;
  if (!tall) {
    top = k.part("top", "Top panel", [W, T, D], [0, H - T / 2, 0]);
    yTop = H - T;
    // a steel bar with a flange at each end, screwed to the inside of the sides
    rail = k.part("rail", "Front rail", [2 * xi, 40, 40], [0, yTop - 20, D / 2 - 38], {
      material: "metal",
      pieces: [
        { shape: "box", size: [2 * xi - 4, 20, 20], pos: [0, 10, 10] },
        { shape: "box", size: [2, 40, 40], pos: [-xi + 1, 0, 0] },
        { shape: "box", size: [2, 40, 40], pos: [xi - 1, 0, 0] },
      ],
    });
  } else {
    // an open shelf at the top: a fixed shelf with a cable hole, an upper back, and a loose top on four connectors
    const yTray = H - 20;
    tray = k.part("tray", "Top panel", [2 * xi, T, D - 17], [0, yTray - T / 2, 8.5]);
    const yShelf = yTray - T - 110;
    shelf = k.part("shelf", "Shelf", [2 * xi, T, D - 7], [0, yShelf - T / 2, 3.5]);
    yTop = yShelf - T;
    upper = k.part("ub", "Upper back panel", [bw, H - yShelf, BT], [0, (H + yShelf) / 2, zBack]);
    top = shelf;
  }
  const hb = (yTop - yb0) / 2;
  const backs = range(2).map((i) => k.part(`b${i}`, "Back panel", [bw, hb, BT], [0, yTop - hb * (i + 0.5), zBack]));
  const n = kind === "c3" ? 3 : 5;
  const dd = 400;
  const ds = stackDrawers({ x0: -xi, x1: xi, y0: yb0, y1: yTop, n, zf: D / 2, dd });
  const runY = ds.map((d) => d.y0 + 4);
  const runLen = 400;
  const legs = legFrame(k, { xl: W / 2 - 70, zl: D / 2 - 55, y: Y0 });
  const zWall = zBack + BT / 2;
  const yWall = tall ? H - 70 : H - T - 50; // in the open shelf on the tall chest

  if (!tall) {
    k.step({ title: "Screw a wall bracket onto each side", detail: "Lay the sides on a rug, inside up. The bracket goes at the top of the back edge, two screws each.", add: ["L", "R"], fix: bracketFixes([L, R], yWall, zWall), tools: ["screwdriver"], pose: "-z", warnings: ["floor"] });
    k.step({ title: "Screw the runners onto the sides", detail: "The one marked CR on the right side, CL on the left. Three screws each, the wheel at the front.", fix: [...runners(L, 1, runY, D / 2, runLen), ...runners(R, -1, runY, D / 2, runLen)], tools: ["screwdriver"] });
    k.step({ title: "Click the sides onto the top", detail: "Lay the top on its front edge. Push the pins in a side into the slots in the top, then press the side down until it clicks.", add: ["top"], tools: [], from: { top: [0, 300, 0] } });
    k.step({ title: "Screw in the front rail", detail: "The metal rail goes across the front, just under the top. Two screws at each end.", add: ["rail"], fix: [L, R].map((p) => at("screw", rail!, [-12, 12].map((dz): Vec3 => [Math.sign(p.pos[0]) * (xi - 2), yTop - 28, D / 2 - 38 + dz]), [Math.sign(p.pos[0]), 0, 0], RAIL_SCREW, p)), tools: ["screwdriver"] });
    k.step({ title: "Tap the dowels into the back panels", detail: "Two in the long edge of each panel: they go into the top, and into the panel before.", fix: [dowels(backs[0], top, [0.25, 0.75]), dowels(backs[1], backs[0], [0.25, 0.75])], tools: ["hammer"] });
    k.step({ title: "Slide in the first back panel", detail: "Dowels first, down the grooves in the sides from the open end until it meets the top.", add: ["b0"], from: { b0: [0, -620, 0] } });
    k.step({ title: "Slide in the second back panel", detail: "Down the same grooves until its dowels go into the first panel.", add: ["b1"], from: { b1: [0, -420, 0] } });
    k.step({ title: "Click on the bottom", detail: "Prop the open end up on a book so you can reach. Press the bottom onto the pins at both corners until it clicks.", add: ["bot"], from: { bot: [0, -300, 0] } });
    k.step({ title: "Screw the bottom to the sides", detail: "Two connector screws up through the bottom into the sides, near the back, with the Allen key.", fix: [screws(bottom, L, [0.2], CONNECTOR), screws(bottom, R, [0.2], CONNECTOR)], tools: ["allen"] });
  } else {
    k.step({ title: "Screw the runners onto the sides", detail: "Lay the sides on a rug, inside up. CR on the right side, CL on the left: five each, three screws each, the wheel at the front.", add: ["L", "R"], fix: [...runners(L, 1, runY, D / 2, runLen), ...runners(R, -1, runY, D / 2, runLen)], tools: ["screwdriver"], pose: "-z", warnings: ["floor"] });
    k.step({ title: "Tap the dowels into the bottom of the sides", detail: "Two in the bottom edge of each side.", fix: [dowels(L, bottom, [0.25, 0.75], { len: 30, dia: 8 }), dowels(R, bottom, [0.25, 0.75], { len: 30, dia: 8 })], tools: ["hammer"] });
    k.step({ title: "Push the wire clips into the sides", detail: "One at the top of each side, at the back. They hold the upper back panel. Use the bigger wires, not the drawer ones.", fix: [L, R].map((p) => at("clip", p, [[p.pos[0] - Math.sign(p.pos[0]) * (T / 2), H - 30, zBack + 12]], [Math.sign(p.pos[0]), 0, 0], { len: 30, dia: 8, name: "Wire clip" })) });
    k.step({ title: "Screw a wall bracket onto each side", detail: "At the top of the back edge, above the shelf. Two screws each.", fix: bracketFixes([L, R], yWall, zWall), tools: ["screwdriver"] });
    k.step({ title: "Click the shelf onto the right side", detail: "The shelf with the cable hole goes near the top, the hole at the back. Push it onto the pins and press until it clicks.", add: ["shelf"] });
    k.step({ title: "Click the left side on", detail: "Lower it onto the shelf's pins and press down until it clicks." });
    k.step({ title: "Tap the dowels into a back panel", detail: "Two long dowels in one long edge: they join the two lower back panels.", fix: [dowels(backs[1], backs[0], [0.25, 0.75], { len: 60, dia: 8 })], tools: ["hammer"] });
    k.step({ title: "Slide in the lower back panels", detail: "Down the grooves from the open end, the plain one first, until they meet the shelf.", add: ["b0", "b1"], from: { b0: [0, -900, 0], b1: [0, -600, 0] } });
    k.step({ title: "Click on the bottom and screw it tight", detail: "Prop the open end up on a book. Press the bottom onto the pins and dowels until it clicks, then four connector screws into the sides.", add: ["bot"], fix: [screws(bottom, L, [0.1, 0.9], CONNECTOR), screws(bottom, R, [0.1, 0.9], CONNECTOR)], tools: ["allen"], from: { bot: [0, -300, 0] } });
    k.step({ title: "Tap the dowels into the upper back panel", detail: "Two long dowels in its bottom edge.", fix: [dowels(upper!, shelf!, [0.25, 0.75], { len: 60, dia: 8 })], tools: ["hammer"] });
    k.step({ title: "Slide in the upper back panel", detail: "From the top end, down the grooves until it meets the shelf and the wire clips catch it.", add: ["ub"], from: { ub: [0, 400, 0] } });
    k.step({ title: "Screw the back panels tight", detail: "Two connector screws through the shelf into the upper back, two through the bottom into the lower back.", fix: [screws(shelf!, upper!, [0.25, 0.75], CONNECTOR), screws(bottom, backs[1], [0.25, 0.75], CONNECTOR)], tools: ["allen"] });
  }
  legSteps(k, legs, bottom, { pose: tall ? "+z" : "-y" });
  k.step({ title: "Stand it up", detail: tall ? "It's tall and heavy: lift it upright with a helper." : "Turn it the right way up onto its feet.", pose: "+y", people: tall ? 2 : 1 });
  if (tall) {
    const conn = [L, R].flatMap((p) => [-1, 1].map((g): Vec3 => [p.pos[0] - Math.sign(p.pos[0]) * (T / 2), H - 20 - T - 6, g * (D / 2 - 60)]));
    k.step({ title: "Screw in the top's connectors", detail: "Two on the inside of each side, near the top.", fix: [L, R].map((p) => at("connector", p, conn.filter((v) => Math.sign(v[0]) === Math.sign(p.pos[0])), [Math.sign(p.pos[0]), 0, 0], { len: 20, dia: 16, name: "Shelf connector" })), tools: ["screwdriver"] });
    k.step({ title: "Lay the top panel in", detail: "Lower it onto the four connectors, down between the sides.", add: ["tray"], from: { tray: [0, 300, 0] } });
  }
  buildCustom(b, { ...s, custom: k.recipe });
  levelStep(b);
  wallStep(b, [L, R].map((p): Vec3 => [p.pos[0] - Math.sign(p.pos[0]) * (T / 2 + 16), yWall, zWall + 2]), { tall });
  drawers(b, ds);
  void tray;
  return true;
}

/** The wide chest: a divider down the middle with runners on both faces, two columns of three drawers. */
function chest6(b: PlanBuilder, s: ProductSpec) {
  const W = Math.round(s.size.w * 10), D = 480, H = Math.round(s.size.h * 10);
  const Y0 = 130;
  const k = new Kit();
  const xi = W / 2 - T;
  const zBack = -D / 2 + 12;
  const sideH = H - Y0 - T;
  const L = k.part("L", "Side panel", [T, sideH, D], [-W / 2 + T / 2, Y0 + sideH / 2, 0]);
  const R = k.part("R", "Side panel", [T, sideH, D], [W / 2 - T / 2, Y0 + sideH / 2, 0]);
  const top = k.part("top", "Top panel", [W, T, D], [0, H - T / 2, 0]);
  const bottom = k.part("bot", "Bottom panel", [2 * xi, T, D], [0, Y0 + T / 2, 0]);
  const yb0 = Y0 + T, yTop = H - T;
  const div = k.part("div", "Divider", [T, yTop - yb0, D - 17], [0, (yTop + yb0) / 2, 8.5]); // stops at the back panel
  const lowH = 110;
  const back = k.part("back", "Back panel", [2 * xi + 16, yTop - yb0 - lowH, BT], [0, yTop - (yTop - yb0 - lowH) / 2, zBack]);
  const low = k.part("low", "Lower back panel", [2 * xi, lowH, BT], [0, yb0 + lowH / 2, zBack]);
  const dd = 400, runLen = 400;
  const left = stackDrawers({ x0: -xi, x1: -T / 2, y0: yb0, y1: yTop, n: 3, zf: D / 2, dd });
  const right = stackDrawers({ x0: T / 2, x1: xi, y0: yb0, y1: yTop, n: 3, zf: D / 2, dd });
  const runY = left.map((d) => d.y0 + 4);
  const legs = legFrame(k, { xl: W / 2 - 70, zl: D / 2 - 55, y: Y0 });

  k.step({ title: "Screw runners onto one face of the divider", detail: "Lay it on a rug. Three runners marked CR, three screws each, the wheel at the front.", add: ["div"], fix: runners(div, 1, runY, D / 2, runLen), tools: ["screwdriver"], pose: "-z", warnings: ["floor"] });
  k.step({ title: "Turn it over and do the other face", detail: "Three runners marked CL, the same way.", fix: runners(div, -1, runY, D / 2, runLen), tools: ["screwdriver"] });
  k.step({ title: "Click the divider onto the top", detail: "The top lies on its front edge, the cable hole at the back. Push the divider's pins into the slots in the middle and press it down until it clicks.", add: ["top"], from: { top: [0, 300, 0] } });
  k.step({ title: "Screw the runners onto the sides", detail: "CR on the right side, CL on the left. Three each, three screws each.", fix: [...runners(L, 1, runY, D / 2, runLen), ...runners(R, -1, runY, D / 2, runLen)], tools: ["screwdriver"] });
  k.step({ title: "Click the sides onto the top", detail: "Runners facing in. Push each side onto the pins and press it down until it clicks.", add: ["L", "R"] });
  k.step({ title: "Slide in the back panel", detail: "Blue side in, down the grooves in the sides from the open end until it meets the top.", add: ["back"], from: { back: [0, -700, 0] } });
  k.step({ title: "Click on the bottom", detail: "Prop the open end up on a book. Press the bottom onto the pins of both sides and the divider, six clicks.", add: ["bot"], from: { bot: [0, -300, 0] } });
  k.step({ title: "Screw the bottom to the sides", detail: "One connector screw through each side into the bottom, with the Allen key.", fix: [screws(L, bottom, [0.5], CONNECTOR), screws(R, bottom, [0.5], CONNECTOR)], tools: ["allen"] });
  k.step({ title: "Fix the back to the divider", detail: "Two inserts through the back into the divider's edge, then a pin with a washer into each.", fix: [at("connector", back, [0.35, 0.75].map((f): Vec3 => [0, yb0 + lowH + (yTop - yb0 - lowH) * f, zBack - BT / 2]), [0, 0, 1], { len: 15, dia: 12, name: "Back insert" }, div), at("pin", back, [0.35, 0.75].map((f): Vec3 => [0, yb0 + lowH + (yTop - yb0 - lowH) * f, zBack - BT / 2 - 2]), [0, 0, 1], { len: 14, dia: 6, name: "Back pin" })], tools: ["screwdriver"] });
  legSteps(k, legs, bottom, { pose: "-y" });
  k.step({ title: "Stand it up", detail: "With a helper: it's long. Turn it the right way up onto its feet.", pose: "+y", people: 2 });
  k.step({ title: "Push in the wall fittings", detail: "From the back: one into the back edge of each side, at the top.", fix: wallFittings([L, R], H - T - 60) });
  k.step({ title: "Clip the back to the frame", detail: "Eight back clips from behind, through the holes in the back panel, each pair pressed together until it holds.", fix: [at("clip", back, [-1, 1].flatMap((g) => [0.15, 0.4].flatMap((f) => [[g * xi * f * 2, yTop - 30, zBack - BT / 2], [g * xi * f * 2, yb0 + lowH + 30, zBack - BT / 2]] as Vec3[])), [0, 0, 1], { len: 12, dia: 14, name: "Back clip" })] });
  k.step({ title: "Tap the dowels into the lower back panel", detail: "Four along its bottom edge.", fix: [dowels(low, bottom, [0.15, 0.38, 0.62, 0.85], { len: 30, dia: 8 })], tools: ["hammer"] });
  k.step({ title: "Drop in the lower back panel", detail: "From the front, down behind the bottom drawers until the dowels sit in the bottom.", add: ["low"], from: { low: [0, 300, 0] } });
  k.step({ title: "Lock the lower back panel", detail: "Two inserts into the bottom in front of it in each half, then a pin with a washer into each.", fix: [at("connector", bottom, [-0.6, -0.25, 0.25, 0.6].map((f): Vec3 => [f * xi, yb0, zBack + BT / 2 + 10]), [0, -1, 0], { len: 15, dia: 12, name: "Back insert" }), at("pin", bottom, [-0.6, -0.25, 0.25, 0.6].map((f): Vec3 => [f * xi, yb0 + 2, zBack + BT / 2 + 10]), [0, -1, 0], { len: 14, dia: 6, name: "Back pin" })], tools: ["screwdriver"] });
  buildCustom(b, { ...s, custom: k.recipe });
  levelStep(b);
  wallStep(b, [L, R].map((p): Vec3 => [p.pos[0] - Math.sign(p.pos[0]) * 4, H - T - 60, -D / 2 - 2]), { tall: false });
  drawers(b, [...left, ...right]);
  return true;
}

/* ---------- the bedside table: cam bolts and cam locks, built lying on its left side ---------- */

function bedside(b: PlanBuilder, s: ProductSpec) {
  const W = Math.round(s.size.w * 10), D = Math.round(s.size.d * 10), H = Math.round(s.size.h * 10);
  const Y0 = 320;
  const k = new Kit();
  const xi = W / 2 - T;
  const zBack = -D / 2 + 12;
  const L = k.part("L", "Side panel", [T, H - Y0, D], [-W / 2 + T / 2, (H + Y0) / 2, 0]);
  const R = k.part("R", "Side panel", [T, H - Y0, D], [W / 2 - T / 2, (H + Y0) / 2, 0]);
  const bottom = k.part("bot", "Bottom panel", [2 * xi, T, D], [0, Y0 + T / 2, 0]);
  const yDr = Y0 + T + 120; // top of the drawer opening
  const shelf = k.part("shelf", "Shelf", [2 * xi, T, D], [0, yDr + T / 2, 0]);
  const yTray = H - 15;
  const railD = 110;
  const rail = k.part("rail", "Top rail", [2 * xi, T, railD], [0, yTray - T / 2, zBack + BT / 2 + railD / 2]);
  const back = k.part("back", "Back panel", [2 * xi + 16, H - Y0 - T, BT], [0, (H + Y0 + T) / 2, zBack]);
  const tray = k.part("tray", "Top shelf", [2 * xi, T, D - railD - 60 - 22], [0, yTray - T / 2, zBack + BT / 2 + railD + (D - railD - 60 - 22) / 2]);
  const ds = stackDrawers({ x0: -xi, x1: xi, y0: Y0 + T, y1: yDr, n: 1, zf: D / 2, dd: 300, per: 2 });
  const legs = legFrame(k, { xl: W / 2 - 40, zl: D / 2 - 40, y: Y0 });
  const panels = [shelf, bottom];

  k.step({ title: "Screw a runner onto each side", detail: "Lay both sides on a rug, inside up. CL on the left side, CR on the right, three screws each. The right side's goes on the same way.", add: ["L"], fix: runners(L, 1, [ds[0].y0 + 4], D / 2, 300), tools: ["screwdriver"], pose: "+x", warnings: ["floor"] });
  k.step({ title: "Screw the cam bolts into the sides", detail: "Five in each side, by hand until they stop.", fix: [bolts(L, bottom, [0.15, 0.85]), bolts(L, shelf, [0.15, 0.85]), bolts(L, rail, [0.5])], tools: ["screwdriver"] });
  k.step({ title: "Tap the dowels into the panels", detail: "Eight: one in each end of the bottom and the shelf, two in each end of the top rail.", fix: [dowels(bottom, L, [0.5]), dowels(bottom, R, [0.5]), dowels(shelf, L, [0.5]), dowels(shelf, R, [0.5]), dowels(rail, L, [0.25, 0.75]), dowels(rail, R, [0.25, 0.75])], tools: ["hammer"] });
  k.step({ title: "Stand the back panel in the left side", detail: "The left side lies on the rug, runner up. Push the back's edge down into the groove at the back edge.", add: ["back"], from: { back: [300, 0, 0] } });
  k.step({ title: "Stand the bottom and the shelf in", detail: "Onto the cam bolts, the bottom's leg holes facing out, the shelf's cable hole at the back.", add: ["bot", "shelf"] });
  k.step({ title: "Stand the top rail in", detail: "At the top end, behind the open shelf, against the back panel.", add: ["rail"] });
  k.step({ title: "Lower the right side on", detail: "With its runner and five cam bolts in, runner facing in. Line up every bolt and dowel and the groove for the back, then press it down evenly.", add: ["R"], fix: [...runners(R, -1, [ds[0].y0 + 4], D / 2, 300), bolts(R, bottom, [0.15, 0.85]), bolts(R, shelf, [0.15, 0.85]), bolts(R, rail, [0.5])], tools: ["screwdriver"], from: { R: [300, 0, 0] } });
  k.step({ title: "Lock the front cam locks", detail: "Four, at the front of the bottom and the shelf. Arrow towards the bolt, then turn clockwise.", fix: panels.flatMap((p) => [cams(L, p, [0.15], 1), cams(R, p, [0.15], 1)]), tools: ["screwdriver"] });
  k.step({ title: "Lock the top rail", detail: "One cam lock at each end.", fix: [cams(L, rail, [0.5], 1), cams(R, rail, [0.5], 1)], tools: ["screwdriver"] });
  k.step({ title: "Lock the back corners", detail: "Four lever locks at the back of the bottom and the shelf: push each in and turn it down until it locks.", fix: panels.flatMap((p) => [cams(L, p, [0.85], 1, 0.5, { len: 18, dia: 16, name: "Lever lock" }), cams(R, p, [0.85], 1, 0.5, { len: 18, dia: 16, name: "Lever lock" })]), tools: ["screwdriver"] });
  legSteps(k, legs, bottom, { pose: "-y", detail: "Turn the table upside down and lay the frame on the bottom. Four Allen bolts down through the leg ends." });
  k.step({ title: "Stand it up", pose: "+y" });
  k.step({ title: "Fit the cable grommet", detail: "Push it into the hole at the back of the shelf, then screw its ring in from below.", fix: [at("cap", shelf, [[-xi * 0.6, yDr + T, zBack + 50]], [0, -1, 0], { len: 12, dia: 50, name: "Cable grommet" })] });
  const conn = [L, R].flatMap((p) => [-1, 1].map((g): Vec3 => [p.pos[0] - Math.sign(p.pos[0]) * (T / 2), yTray - T - 6, tray.pos[2] + g * (tray.size[2] / 2 - 30)]));
  k.step({ title: "Screw in the top shelf's connectors", detail: "Two on the inside of each side, near the top.", fix: [L, R].map((p) => at("connector", p, conn.filter((v) => Math.sign(v[0]) === Math.sign(p.pos[0])), [Math.sign(p.pos[0]), 0, 0], { len: 20, dia: 16, name: "Shelf connector" })), tools: ["screwdriver"] });
  k.step({ title: "Lay the top shelf in", detail: "Down onto the four connectors, in front of the top rail.", add: ["tray"], from: { tray: [0, 260, 0] } });
  buildCustom(b, { ...s, custom: k.recipe });
  levelStep(b, true);
  drawers(b, ds);
  return true;
}

/* ---------- sliding doors, and the cabinets they go on ---------- */

const ZDOOR = (D: number) => D / 2 - 14; // the door runs in the tracks at the front
const ZIN = (D: number) => D / 2 - 32; // drawers, dividers and shelves stand back behind it
const TRACK_SCREW = { len: 16, dia: 3.5 };
const STOP = { len: 20, dia: 12, name: "End stop" };

/** The top track (pushed into the groove under the top) and the bottom track (screwed to the bottom). */
function trackParts(k: Kit, xi: number, yb0: number, yTop: number, D: number) {
  const z = ZDOOR(D);
  const top = k.part("tt", "Top track", [2 * xi, 10, 16], [0, yTop - 5, z], { material: "metal" });
  const bot = k.part("bt", "Bottom track", [2 * xi, 10, 16], [0, yb0 + 5, z], { material: "metal" });
  return { top, bot };
}
function trackSteps(k: Kit, t: { top: Part; bot: Part }, xi: number) {
  const ends = (p: Part, y: number) => [-1, 1].map((g): Vec3 => [g * (xi - 30), y, p.pos[2]]);
  k.step({ title: "Push the top track into its groove", detail: "Clip an end stop into each end first, then push the track up into the groove under the top, all along.", add: [t.top.id], fix: [at("clip", t.top, ends(t.top, t.top.pos[1] - 5), [0, 1, 0], STOP)], from: { [t.top.id]: [0, -200, 0] } });
  k.step({ title: "Screw down the bottom track", detail: "Its two end stops in, then lay it in the groove in the bottom and four screws along it.", add: [t.bot.id], fix: [at("clip", t.bot, ends(t.bot, t.bot.pos[1] + 5), [0, -1, 0], STOP), at("screw", t.bot, spread(-xi + 80, xi - 80, 4).map((x): Vec3 => [x, t.bot.pos[1] + 5, t.bot.pos[2]]), [0, -1, 0], TRACK_SCREW)], tools: ["screwdriver"], from: { [t.bot.id]: [0, 200, 0] } });
}

interface Door {
  part: Part;
  x: number;
  w: number;
  y0: number;
  y1: number;
}
function doorPart(k: Kit, id: string, x: number, w: number, y0: number, y1: number, D: number): Door {
  const part = k.part(id, "Sliding door", [w, y1 - y0, 18], [x, (y0 + y1) / 2, ZDOOR(D)]);
  return { part, x, w, y0, y1 };
}
/** Hang each door: two rollers under it, two guides on top that click into the top track, then its knob. */
function doorSteps(k: Kit, ds: Door[], D: number) {
  const z = ZDOOR(D);
  const two = ds.length > 1;
  k.step({
    title: two ? "Fit the rollers and guides to the doors" : "Fit the roller and guide fittings to the door",
    detail: "Two rollers under the bottom edge, two guides on the top edge, pushed into their holes until they click.",
    add: ds.map((d) => d.part.id),
    fix: ds.flatMap((d) => [
      at("roller", d.part, [-1, 1].map((g): Vec3 => [d.x + g * (d.w / 2 - 60), d.y0, z]), [0, 1, 0], { len: 44, dia: 26 }),
      at("clip", d.part, [-1, 1].map((g): Vec3 => [d.x + g * (d.w / 2 - 60), d.y1, z]), [0, -1, 0], { len: 30, dia: 16, name: "Top guide" }),
    ]),
    from: Object.fromEntries(ds.map((d) => [d.part.id, [0, 0, 400] as Vec3])),
  });
  k.step({ title: two ? "Hang the doors" : "Hang the door", detail: "Tilt the top in under the top track, set the rollers on the bottom track, then push each top guide up until it clicks.", people: 2, warnings: ["two"] });
  k.step({ title: two ? "Screw on the knobs" : "Screw on the knob", detail: "One screw from the back of the door, by hand.", fix: ds.map((d) => at("knob", d.part, [[d.x + (d.x < 0 ? d.w / 2 - 50 : -d.w / 2 + 50), (d.y0 + d.y1) / 2, z + 9]], [0, 0, -1], { len: 25, dia: 18 })), tools: ["screwdriver"] });
}

/** Loose shelves resting on four connectors screwed to the walls either side. */
function connectorShelf(k: Kit, id: string, a: Part, c: Part, y: number, D: number, z0: number) {
  const x0 = a.pos[0] + a.size[0] / 2, x1 = c.pos[0] - c.size[0] / 2;
  const zf = ZIN(D);
  const shelf = k.part(id, "Shelf", [x1 - x0 - 2, T, zf - z0], [(x0 + x1) / 2, y + T / 2 + 8, (zf + z0) / 2]);
  const pts = (p: Part, x: number, g: 1 | -1) => [z0 + 50, zf - 50].map((z): Vec3 => [x, y + 2, z]).map((v) => ({ p, v, g }));
  const all = [...pts(a, x0, 1), ...pts(c, x1, -1)];
  const fixes = [a, c].map((p) => at("connector", p, all.filter((q) => q.p === p).map((q) => q.v), [all.find((q) => q.p === p)!.g * -1, 0, 0], { len: 20, dia: 16, name: "Shelf connector" }));
  return { shelf, fixes };
}

function cabinet(b: PlanBuilder, s: ProductSpec) {
  const W = Math.round(s.size.w * 10), D = Math.round(s.size.d * 10), H = Math.round(s.size.h * 10);
  const Y0 = 124;
  const k = new Kit();
  const xi = W / 2 - T;
  const zBack = -D / 2 + 12, zb = zBack + BT / 2;
  const sideH = H - Y0 - 2 * T;
  const yb0 = Y0 + T, yTop = H - T;
  const L = k.part("L", "Side panel", [T, sideH, D], [-W / 2 + T / 2, yb0 + sideH / 2, 0]);
  const R = k.part("R", "Side panel", [T, sideH, D], [W / 2 - T / 2, yb0 + sideH / 2, 0]);
  const top = k.part("top", "Top panel", [W, T, D], [0, H - T / 2, 0]);
  const bottom = k.part("bot", "Bottom panel", [W, T, D], [0, Y0 + T / 2, 0]);
  const zf = ZIN(D);
  const div = k.part("div", "Divider", [T, sideH, zf - zb], [0, yb0 + sideH / 2, (zf + zb) / 2]);
  const ySh = yb0 + 3 * 125 + 6;
  const shL = k.part("shL", "Fixed shelf", [xi - T / 2, T, zf - zb], [-(xi + T / 2) / 2, ySh + T / 2, (zf + zb) / 2]);
  const shR = k.part("shR", "Fixed shelf", [xi - T / 2, T, zf - zb], [(xi + T / 2) / 2, ySh + T / 2, (zf + zb) / 2]);
  const backs = [-1, 1].map((g) => k.part(g < 0 ? "bL" : "bR", "Back panel", [xi + 8, sideH, BT], [g * (xi + 8) / 2, yb0 + sideH / 2, zBack]));
  const ds = stackDrawers({ x0: T / 2, x1: xi, y0: yb0, y1: ySh, n: 3, zf, dd: 380 });
  const runY = ds.map((d) => d.y0 + 4);
  const legs = legFrame(k, { xl: W / 2 - 70, zl: D / 2 - 55, y: Y0 });
  const shelfBolts = (p: Part, sh: Part) => bolts(p, sh, [0.15, 0.85]);

  k.step({ title: "Screw the runners onto the right side and the divider", detail: "Lay them on a rug, inside up. CR on the right side, CL on the divider: three each, three screws each.", add: ["R", "div"], fix: [...runners(R, -1, runY, zf, 380), ...runners(div, 1, runY, zf, 380)], tools: ["screwdriver"], pose: "-z", warnings: ["floor"] });
  k.step({ title: "Screw in the cam bolts for the fixed shelves", detail: "Two in each side and two in the divider's runner face, by hand.", fix: [shelfBolts(L, shL), shelfBolts(R, shR), shelfBolts(div, shR)], tools: ["screwdriver"] });
  k.step({ title: "Click the divider onto the top", detail: "The top lies on its front edge. Push the divider's pins into the slots in the middle and press it down until it clicks.", add: ["top"], from: { top: [0, 300, 0] } });
  k.step({ title: "Click the left side on", detail: "Push it onto the end of the top until it clicks.", add: ["L"] });
  k.step({ title: "Screw two cam bolts into the divider's other face", detail: "For the left fixed shelf.", fix: [shelfBolts(div, shL)], tools: ["screwdriver"] });
  k.step({ title: "Click the right side on", detail: "Runners facing in, onto the other end of the top." });
  k.step({ title: "Put in the fixed shelves and lock them", detail: "Four cam locks in each shelf first. Slide each shelf in onto its bolts, then turn the eight cam locks.", add: ["shL", "shR"], fix: [cams(L, shL, [0.15, 0.85], 1), cams(div, shL, [0.15, 0.85], 1), cams(div, shR, [0.15, 0.85], 1), cams(R, shR, [0.15, 0.85], 1)], tools: ["screwdriver"] });
  k.step({ title: "Slide in the back panels", detail: "Blue side in, one each side of the divider, down the grooves from the open end. The one with the cable hole on the right.", add: backs.map((p) => p.id), from: Object.fromEntries(backs.map((p) => [p.id, [0, -800, 0] as Vec3])) });
  k.step({ title: "Tap the dowels into the sides", detail: "Two in the bottom edge of each side.", fix: [dowels(L, bottom, [0.25, 0.75]), dowels(R, bottom, [0.25, 0.75])], tools: ["hammer"] });
  k.step({ title: "Put the bottom on and screw it tight", detail: "Onto the dowels and pins, then six connector screws up into the sides and the divider.", add: ["bot"], fix: [screws(bottom, L, [0.1, 0.9], CONNECTOR), screws(bottom, div, [0.1, 0.9], CONNECTOR), screws(bottom, R, [0.1, 0.9], CONNECTOR)], tools: ["allen"], from: { bot: [0, -300, 0] } });
  k.step({ title: "Clip the backs to the frame", detail: "Twenty back clips through the holes round the back panels, each pair pressed together until it holds.", fix: backs.map((p) => at("clip", p, [...spread(p.pos[0] - p.size[0] / 2 + 60, p.pos[0] + p.size[0] / 2 - 60, 3).flatMap((x) => [[x, yTop - 20, zBack - BT / 2], [x, yb0 + 20, zBack - BT / 2]] as Vec3[]), ...[ySh - 100, ySh + 200].flatMap((y) => [[p.pos[0] - p.size[0] / 2 + 20, y, zBack - BT / 2], [p.pos[0] + p.size[0] / 2 - 20, y, zBack - BT / 2]] as Vec3[])], [0, 0, 1], { len: 12, dia: 14, name: "Back clip" })) });
  legSteps(k, legs, bottom, { pose: "-y" });
  k.step({ title: "Stand it up", detail: "With a helper, onto its feet.", pose: "+y", people: 2 });
  k.step({ title: "Push in the wall fittings", detail: "One into the back edge of each side, near the top.", fix: wallFittings([L, R], yTop - 60) });
  buildCustom(b, { ...s, custom: k.recipe });
  levelStep(b);
  wallStep(b, [L, R].map((p): Vec3 => [p.pos[0] - Math.sign(p.pos[0]) * 4, yTop - 60, -D / 2 - 2]));

  const k2 = new Kit();
  const tr = trackParts(k2, xi, yb0, yTop, D);
  const yLoose = ySh + T + (yTop - ySh - T) / 2;
  const cs = connectorShelf(k2, "shelf", L, div, yLoose, D, zb);
  const door = doorPart(k2, "door", -xi / 2 + 4, xi + 8, yb0 + 12, yTop - 12, D);
  k2.step({ title: "Stick on the door stops", detail: "One under the top at each front corner, so the door stops softly.", fix: [-1, 1].map((g) => at("glide", top, [[g * (xi - 20), yTop, ZDOOR(D)]], [0, 1, 0], { len: 8, dia: 30, name: "Door stop" })) });
  trackSteps(k2, tr, xi);
  k2.step({ title: "Screw in the shelf connectors", detail: "Four in the left compartment, two each side, at the height you want the shelf.", fix: cs.fixes, tools: ["screwdriver"] });
  k2.step({ title: "Lay the shelf on them", add: ["shelf"], from: { shelf: [0, 0, 400] } });
  doorSteps(k2, [door], D);
  buildCustom(b, { ...s, custom: k2.recipe });
  drawers(b, ds, { knobs: false });
  step(b, { title: "Adjust the door", detail: "If it isn't straight, turn the adjusters in the rollers until the gap is even all the way down.", tools: ["screwdriver"], kind: "doors" });
  return true;
}

function tvBench(b: PlanBuilder, s: ProductSpec) {
  const W = Math.round(s.size.w * 10), D = Math.round(s.size.d * 10), H = Math.round(s.size.h * 10);
  const Y0 = 124;
  const k = new Kit();
  const xi = W / 2 - T;
  const yb0 = Y0 + T, yTop = H - T;
  const sideH = H - Y0;
  const zf = ZIN(D), zr = -D / 2 + T; // the back rails' front face
  const L = k.part("L", "Side panel", [T, sideH, D], [-W / 2 + T / 2, Y0 + sideH / 2, 0]);
  const R = k.part("R", "Side panel", [T, sideH, D], [W / 2 - T / 2, Y0 + sideH / 2, 0]);
  const topD = D - 60; // the top stops short of the back, for cables
  const top = k.part("top", "Top panel", [2 * xi, T, topD], [0, H - T / 2, D / 2 - topD / 2]);
  const bottom = k.part("bot", "Bottom panel", [2 * xi, T, D], [0, Y0 + T / 2, 0]);
  const c = (2 * xi - 2 * T) / 3; // three equal compartments
  const dx = c / 2 + T / 2;
  const dz0 = -D / 2 + T; // the dividers stand against the back rails
  const divs = [-1, 1].map((g) => k.part(g < 0 ? "dL" : "dR", "Divider", [T, yTop - yb0, zf - dz0], [g * dx, (yTop + yb0) / 2, (zf + dz0) / 2]));
  const rails = [yTop - 60, yb0 + 40].map((y, i) => k.part(i ? "rb" : "rt", "Back rail", [2 * xi, 80, T], [0, y, -D / 2 + T / 2]));
  const ds = stackDrawers({ x0: -dx + T / 2, x1: dx - T / 2, y0: yb0, y1: yTop, n: 3, zf, dd: 360 });
  const runY = ds.map((d) => d.y0 + 4);
  const legs = legFrame(k, { xl: W / 2 - 90, zl: D / 2 - 55, y: Y0 });
  const panels = [top, bottom, ...rails];

  k.step({ title: "Screw the runners onto the dividers", detail: "Lay them on a rug, inside up. CR on the left divider, CL on the right: three each, three screws each, on the faces that look into the middle.", add: ["dL", "dR"], fix: [...runners(divs[0], 1, runY, zf, 360), ...runners(divs[1], -1, runY, zf, 360)], tools: ["screwdriver"], pose: "-z", warnings: ["floor"] });
  k.step({ title: "Click a divider onto the top", detail: "The top lies on its front edge. Check which way up the divider goes, then push it on until it clicks.", add: ["top"], from: { top: [0, 300, 0] } });
  k.step({ title: "Click the other divider on", detail: "Runners facing the first one." });
  k.step({ title: "Click the bottom on", detail: "Onto the other ends of the dividers, until both click.", add: ["bot"], from: { bot: [0, -300, 0] } });
  k.step({ title: "Tap the dowels into the back rails", detail: "Two in each rail, where it meets the dividers.", fix: rails.map((r) => at("dowel", r, divs.map((d): Vec3 => [d.pos[0], r.pos[1], zr]), [0, 0, -1], { len: 30, dia: 8 })), tools: ["hammer"], wait: ["rt", "rb"], from: { rt: [0, 0, -300], rb: [0, 0, -300] } });
  k.step({ title: "Lay the back rails on", detail: "Across the back edges of the dividers, one at the top and one at the bottom, onto the dowels.", add: ["rt", "rb"], from: { rt: [0, 0, -300], rb: [0, 0, -300] } });
  k.step({ title: "Screw the rails to the dividers", detail: "Eight connector screws with the Allen key, two at each crossing.", fix: rails.flatMap((r) => divs.map((d) => at("screw", r, [-20, 20].map((dy): Vec3 => [d.pos[0], r.pos[1] + dy, -D / 2]), [0, 0, 1], { len: 45, dia: 6, name: "Connector screw" }, d))), tools: ["allen"] });
  k.step({ title: "Tap the dowels into the ends", detail: "Two in each end of the top, the bottom and both rails.", fix: panels.flatMap((p) => [dowels(p, L, [0.5]), dowels(p, R, [0.5])]), tools: ["hammer"] });
  k.step({ title: "Screw the cam bolts into the sides", detail: "Eight in each side, by hand until they stop.", fix: [L, R].flatMap((sd) => panels.map((p) => bolts(sd, p, [0.2, 0.8]))), tools: ["screwdriver"] });
  k.step({ title: "Put the sides on", detail: "Onto the dowels and bolts at each end.", add: ["L", "R"] });
  k.step({ title: "Lock the cam locks", detail: "Sixteen, four at each end of the top, the bottom and the rails. Arrow towards the bolt, then turn clockwise.", fix: [L, R].flatMap((sd) => panels.map((p) => cams(sd, p, [0.2, 0.8], p === top ? -1 : p === bottom ? 1 : 1))), tools: ["screwdriver"] });
  const tr = trackParts(k, xi, yb0, yTop, D);
  k.step({ title: "Lay it on its back", pose: "+z" });
  trackSteps(k, tr, xi);
  legSteps(k, legs, bottom, { pose: "-y" });
  k.step({ title: "Stand it up", detail: "With a helper: it's long.", pose: "+y", people: 2 });
  buildCustom(b, { ...s, custom: k.recipe });
  levelStep(b);
  // two L brackets screwed under the top rail, then into the wall: wall screws and plugs aren't in the box
  const wx = [-xi / 2, xi / 2];
  step(b, { title: "Screw the wall brackets to the top rail", detail: "One each side, with a screw and washer through the slot, so it can still slide.", tools: ["screwdriver"], kind: "screws" }, () => {
    const rk = b.items.find((x) => x.kind === "part" && Math.abs(x.final.pos[1] - rails[0].pos[1]) < 0.5 && Math.abs(x.final.pos[2] - rails[0].pos[2]) < 0.5)!.key;
    const y = rails[0].pos[1];
    b.fits({ kind: "bracket", len: 60, dia: 30, name: "L bracket" }, wx.map((x): FitOpts => ({ on: rk, at: [x, y, -D / 2], dir: [0, 0, 1], hole: false })), 0.2);
    b.then(0.1);
    b.fits(WALL_WASHER, wx.map((x): FitOpts => ({ on: rk, at: [x, y - 20, -D / 2 - 2], dir: [0, 0, 1] })), 0.1);
    b.fits({ kind: "screw", len: 16, dia: 4 }, wx.map((x): FitOpts => ({ on: rk, at: [x, y - 20, -D / 2 - 3], dir: [0, 0, 1] })), 0.1);
  });
  wallStep(b, wx.map((x): Vec3 => [x, rails[0].pos[1] + 20, -D / 2 - 4]), { notInBox: true, detail: "Mark through the brackets, drill and plug the wall, then screw the brackets on with a washer each. Wall screws and plugs aren't included: pick ones made for your wall." });

  const k2 = new Kit();
  const shelves = [connectorShelf(k2, "sL", L, divs[0], yb0 + (yTop - yb0) / 2, D, zr), connectorShelf(k2, "sR", divs[1], R, yb0 + (yTop - yb0) / 2, D, zr)];
  const dw = c + T + 12;
  const doors = [-1, 1].map((g) => doorPart(k2, g < 0 ? "doorL" : "doorR", g * (xi - dw / 2), dw, yb0 + 12, yTop - 12, D));
  k2.step({ title: "Screw in the shelf connectors", detail: "Eight: four in each end compartment, at the height you want the shelves.", fix: shelves.flatMap((x) => x.fixes), tools: ["screwdriver"] });
  k2.step({ title: "Lay the shelves on them", add: ["sL", "sR"], from: { sL: [0, 0, 400], sR: [0, 0, 400] } });
  doorSteps(k2, doors, D);
  buildCustom(b, { ...s, custom: k2.recipe });
  drawers(b, ds, { knobs: false });
  step(b, { title: "Adjust the doors", detail: "If a door isn't straight, turn the adjusters in its rollers until the gaps are even.", tools: ["screwdriver"], kind: "doors" });
  return true;
}

function wardrobe(b: PlanBuilder, s: ProductSpec) {
  const W = Math.round(s.size.w * 10), D = Math.round(s.size.d * 10), H = Math.round(s.size.h * 10);
  const Y0 = 124;
  const k = new Kit();
  const xi = W / 2 - T;
  const zBack = -D / 2 + 12, zb = zBack + BT / 2;
  const sideH = H - Y0 - 2 * T;
  const yb0 = Y0 + T, yTop = H - T;
  const zf = ZIN(D);
  const L = k.part("L", "Side panel", [T, sideH, D], [-W / 2 + T / 2, yb0 + sideH / 2, 0]);
  const R = k.part("R", "Side panel", [T, sideH, D], [W / 2 - T / 2, yb0 + sideH / 2, 0]);
  const div = k.part("div", "Divider", [T, sideH, zf - zb], [0, yb0 + sideH / 2, (zf + zb) / 2]);
  const top = k.part("top", "Top panel", [W, T, D], [0, H - T / 2, 0]);
  const bottom = k.part("bot", "Bottom panel", [W, T, D], [0, Y0 + T / 2, 0]);
  const yDr = yb0 + 4 * 150; // top of the drawers
  const xr0 = T / 2, xr1 = xi;
  const rails = [zf - 30, zb + 30].map((z, i) => k.part(i ? "rb" : "rf", "Rail", [xr1 - xr0, 40, 60], [(xr0 + xr1) / 2, yDr + 20, z]));
  const backs = [-1, 1].map((g) => k.part(g < 0 ? "bL" : "bR", "Back panel", [xi + 8, sideH, BT], [g * (xi + 8) / 2, yb0 + sideH / 2, zBack]));
  const ds = stackDrawers({ x0: xr0, x1: xr1, y0: yb0, y1: yDr, n: 4, zf, dd: 500 });
  const runY = ds.map((d) => d.y0 + 4);
  const legs = legFrame(k, { xl: W / 2 - 70, zl: D / 2 - 60, y: Y0 });
  const uprights = [L, div, R];

  k.step({ title: "Tap the dowels into the sides and the divider", detail: "Lay them on a rug. Two in each end of all three.", add: ["L", "div", "R"], fix: uprights.flatMap((p) => [dowels(p, bottom, [0.25, 0.75]), dowels(p, top, [0.25, 0.75])]), tools: ["hammer"], pose: "+z", warnings: ["floor"] });
  k.step({ title: "Screw the runners onto the right side", detail: "Four marked CR, three screws each, the wheel at the front.", fix: runners(R, -1, runY, zf, 500), tools: ["screwdriver"] });
  k.step({ title: "Screw the runners onto the divider", detail: "Four marked CL on its right face, the same way.", fix: runners(div, 1, runY, zf, 500), tools: ["screwdriver"] });
  k.step({ title: "Push the bottom panel onto the dowels", detail: "Its leg holes facing out. Press it onto the dowels at the bottom ends of the sides and the divider.", add: ["bot"], from: { bot: [0, -500, 0] } });
  legSteps(k, legs, bottom, { pose: "+z", detail: "Lay the frame on the bottom panel, lined up with its holes. Four long Allen bolts through the leg ends." });
  k.step({ title: "Screw the bottom to the sides and divider", detail: "Six connector screws through the bottom into the sides and the divider, with the Allen key.", fix: uprights.map((p) => screws(bottom, p, [0.1, 0.9], CONNECTOR)), tools: ["allen"], people: 2 });
  k.step({ title: "Screw in the cam bolts for the rails", detail: "Two in the divider and two in the right side, just above the drawers.", fix: [div, R].flatMap((p) => rails.map((r) => bolts(p, r, [0.5]))), tools: ["screwdriver"] });
  k.step({ title: "Fit the two rails", detail: "Cam locks in their ends, then push them onto the bolts between the divider and the right side, front and back.", add: ["rf", "rb"] });
  k.step({ title: "Lock the cam locks", detail: "Four, one at each end of the rails.", fix: rails.flatMap((r) => [cams(div, r, [0.5], 1), cams(R, r, [0.5], 1)]), tools: ["screwdriver"] });
  k.step({ title: "Slide in the right back panel", detail: "Blue side in, the cable hole at the top, along the grooves from the open end.", add: ["bR"], from: { bR: [0, 1400, 0] } });
  k.step({ title: "Slide in the left back panel", detail: "The same way, on the other side of the divider.", add: ["bL"], from: { bL: [0, 1400, 0] } });
  k.step({ title: "Push the wire clips into the sides", detail: "Two at the open end, so the back panels can't slide out.", fix: [L, R].map((p) => at("clip", p, [[p.pos[0] - Math.sign(p.pos[0]) * (T / 2), yTop - 20, zBack + 12]], [Math.sign(p.pos[0]), 0, 0], { len: 30, dia: 8, name: "Spring wire" })) });
  k.step({ title: "Put the top on and screw it tight", detail: "Onto the dowels and pins, then six connector screws into the sides and the divider.", add: ["top"], fix: uprights.map((p) => screws(top, p, [0.1, 0.9], CONNECTOR)), tools: ["allen"], from: { top: [0, 300, 0] } });
  k.step({ title: "Stand it up", detail: "Two people: lift it by the top while the other steadies the legs. Don't drag it.", pose: "+y", people: 2, warnings: ["two"] });
  k.step({ title: "Clip the backs to the frame", detail: "Twenty back clips from behind, each pair pressed together until it holds.", fix: backs.map((p) => at("clip", p, [...spread(p.pos[0] - p.size[0] / 2 + 60, p.pos[0] + p.size[0] / 2 - 60, 2).flatMap((x) => [[x, yTop - 20, zBack - BT / 2], [x, yb0 + 20, zBack - BT / 2]] as Vec3[]), ...spread(yb0 + 300, yTop - 300, 3).flatMap((y) => [[p.pos[0] - p.size[0] / 2 + 20, y, zBack - BT / 2], [p.pos[0] + p.size[0] / 2 - 20, y, zBack - BT / 2]] as Vec3[])], [0, 0, 1], { len: 12, dia: 14, name: "Back clip" })) });
  k.step({ title: "Push in the wall fittings", detail: "One into the back edge of each side, near the top.", fix: wallFittings([L, R], yTop - 60) });
  buildCustom(b, { ...s, custom: k.recipe });
  levelStep(b);
  wallStep(b, [L, R].map((p): Vec3 => [p.pos[0] - Math.sign(p.pos[0]) * 4, yTop - 60, -D / 2 - 2]), { tall: true });

  const k2 = new Kit();
  const tr = trackParts(k2, xi, yb0, yTop, D);
  const rod = k2.part("rod", "Clothes rail", [xi - T / 2 - 4, 25, 25], [-(xi + T / 2) / 2, yTop - 90, (zf + zb) / 2], { shape: "cyl", material: "metal" });
  // adjustable shelves on cam bolts: two in the right section over the drawers, one low in the left
  const shelfAt = (id: string, a: Part, c: Part, y: number) => {
    const x0 = a.pos[0] + a.size[0] / 2, x1 = c.pos[0] - c.size[0] / 2;
    return k2.part(id, "Shelf", [x1 - x0, T, zf - zb], [(x0 + x1) / 2, y + T / 2, (zf + zb) / 2]);
  };
  const sh = [shelfAt("s1", div, R, yDr + 400), shelfAt("s2", div, R, yDr + 800), shelfAt("s3", L, div, yb0 + 300)];
  const walls = (p: Part) => (p.pos[0] > 0 ? [div, R] : [L, div]);
  trackSteps(k2, tr, xi);
  k2.step({ title: "Hang the clothes rail", detail: "Screw a holder to the left side and one to the divider, one screw each, then drop the rail into them.", add: ["rod"], fix: [...[L, div].map((p) => at("hook", p, [[p.pos[0] + (p === L ? T / 2 : -T / 2), rod.pos[1] + 10, rod.pos[2]]], [p === L ? -1 : 1, 0, 0], { len: 40, dia: 22, name: "Rail holder" })), ...[L, div].map((p) => at("screw", p, [[p.pos[0] + (p === L ? T / 2 + 2 : -T / 2 - 2), rod.pos[1] + 24, rod.pos[2]]], [p === L ? -1 : 1, 0, 0], RUN_SCREW))], tools: ["screwdriver"] });
  k2.step({ title: "Screw in the cam bolts for the shelves", detail: "Eighteen, three at each end of each shelf, at the heights you want them.", fix: sh.flatMap((p) => walls(p).map((w) => bolts(w, p, [0.15, 0.5, 0.85]))), tools: ["screwdriver"] });
  k2.step({ title: "Push the cam locks into the shelves", detail: "Six in each shelf, the arrow pointing at the edge.", fix: sh.flatMap((p) => walls(p).map((w) => cams(w, p, [0.15, 0.5, 0.85], 1))), tools: ["screwdriver"] });
  k2.step({ title: "Put the shelves in and lock them", detail: "Two over the drawers, one low on the left. Turn each cam lock clockwise.", add: sh.map((p) => p.id) });
  k2.step({ title: "Fit the cable grommet", detail: "In the hole in the right back panel.", fix: [at("cap", backs[1], [[xi / 2, yTop - 120, zb]], [0, 0, -1], { len: 12, dia: 50, name: "Cable grommet" })] });
  buildCustom(b, { ...s, custom: k2.recipe });
  drawers(b, ds, { knobs: false });
  const k3 = new Kit();
  const door = doorPart(k3, "door", -xi / 2 + 4, xi + 8, yb0 + 12, yTop - 12, D);
  doorSteps(k3, [door], D);
  buildCustom(b, { ...s, custom: k3.recipe });
  step(b, { title: "Adjust the door", detail: "If it isn't straight, turn the adjusters in the rollers until the gap is even all the way down.", tools: ["screwdriver"], kind: "doors" });
  return true;
}

/* ---------- beds: wooden rails on a steel headboard and legs ---------- */

function bed(b: PlanBuilder, s: ProductSpec, king: boolean) {
  // IKEA's own measurements (the guide's size is a little off): 104 x 210 cm and 158 x 220 cm, headboard up to 103 cm
  const W = king ? 1580 : 1040, L = king ? 2200 : 2100;
  const k = new Kit();
  const rt = 22, rh = 180, yR = 220; // rails: thickness, height, underside
  const yRt = yR + rh;
  const zp = -L / 2 + 20; // the headboard posts
  const zHi = -L / 2 + 58; // inner face of the head rail
  const zFi = L / 2 - rt; // inner face of the foot rail
  const Lin = zFi - zHi, zMid = (zHi + zFi) / 2;
  const xs = W / 2 - rt; // inner faces of the side rails
  const lean = 0.25;
  const posts = [-1, 1].map((g) =>
    k.part(g < 0 ? "pL" : "pR", "Headboard post", [32, 1010, 100], [g * (W / 2 - 60), 505, zp - 32], {
      material: "metal",
      pieces: [
        { shape: "cyl", size: [32, 700, 32], pos: [0, 350 - 505, 32] },
        { shape: "cyl", size: [32, 320, 32], pos: [0, 855 - 505, -8], rot: [-lean, 0, 0] },
      ],
    }),
  );
  const head = k.part("head", "Head rail", [W, rh, rt], [0, yR + rh / 2, zHi - rt / 2]);
  const foot = k.part("foot", "Foot rail", [W, rh, rt], [0, yR + rh / 2, L / 2 - rt / 2]);
  const sides = [-1, 1].map((g) => k.part(g < 0 ? "sL" : "sR", "Side rail", [rt, rh, Lin], [g * (W / 2 - rt / 2), yR + rh / 2, zMid]));
  const zLeg = zFi - 16 - 30;
  const legs = [-1, 1].map((g) => k.part(g < 0 ? "fL" : "fR", "Foot leg", [32, yRt - 10, 32], [g * (xs - 70), (yRt - 10) / 2, zLeg], { shape: "cyl", material: "metal" }));
  const board = k.part("hb", "Headboard", [W - 40, 420, 18], [0, 805, zp - 46], { rot: [-lean, 0, 0] });
  const ySr = yRt - 70; // top of the slat rails
  const rails = [-1, 1].map((g) => k.part(g < 0 ? "rL" : "rR", "Slat rail", [30, 30, Lin - 20], [g * (xs - 15), ySr - 15, zMid], { material: "metal" }));
  const half = king ? 2 : 1;
  const beams = range(half).map((i) => k.part(`cb${i}`, "Centre beam", [40, 40, Lin / half], [0, ySr - 20, zHi + (Lin / half) * (i + 0.5)], { material: "metal" }));
  const mid = king ? k.part("ml", "Middle leg", [32, ySr - 40, 32], [0, (ySr - 40) / 2, zMid], { shape: "cyl", material: "metal" }) : null;
  const braceL = 300;
  const braces = [-1, 1].flatMap((gx) => [-1, 1].map((gz) => {
    const cz = gz < 0 ? zHi : zFi;
    const off = braceL / 2 / Math.SQRT2;
    return k.part(`br${gx}${gz}`, "Corner brace", [braceL, 30, 8], [gx * (xs - off - 4), yR + 60, cz - gz * (off + 4)], { material: "metal", rot: [0, -gx * gz * Math.PI / 4, 0] });
  }));
  const stripLen = (Lin - 20) / 3 - 10;
  const strip = (id: string, x: number, i: number, len = stripLen) => k.part(id, "Rail strip", [30, 2, len], [x, ySr + 1, zMid + (i - 1) * (len + 10)], { material: "fiber" });
  const strips = [...rails.flatMap((r, j) => range(3).map((i) => strip(`st${j}${i}`, r.pos[0], i))), ...(king ? range(3).map((i) => strip(`sc${i}`, 0, i, (Lin - 20) / 3 - 10)) : [])];
  const base = k.part("slats", "Slatted bed base", [2 * xs - 10, 30, Lin - 10], [0, ySr + 17, zMid], { material: "wood", extra: true });

  const FEET = (ps: { p: Part; at: Vec3 }[]): CustomFix[] => [
    ...ps.map(({ p, at: v }) => at("cap", p, [v], [0, 1, 0], FOOT_CUP)),
    ...ps.map(({ p, at: v }) => at("foot", p, [v], [0, 1, 0], FOOT)),
  ];
  const BOLT = { len: 70, dia: 8 };
  const CAP_NUT = { len: 12, dia: 12, name: "Cap nut" };
  const CONN = { len: 50, dia: 8, name: "Connector bolt" };
  const BARREL = { len: 15, dia: 12, name: "Barrel nut" };
  const BIG_CAM = { len: 15, dia: 32 };
  const WOOD = { len: 16, dia: 4 };
  const joint = (rail: Part, end: Part, g: number) => [0.3, 0.7].map((f): Vec3 => [rail.pos[0] - g * 0, yR + rh * f, end === head ? zHi : zFi]);

  k.step({ title: "Screw a foot into each headboard post", detail: "Lay the posts on a rug. A foot cup on the end of each, then turn the foot in.", add: ["pL", "pR"], fix: FEET(posts.map((p) => ({ p, at: [p.pos[0], 0, zp] }))), from: { pL: [0, 0, -400], pR: [0, 0, -400] } });
  k.step({ title: "Hang the head rail on the posts", detail: "Stand the posts up and drop the head rail onto the hooks, holes lined up.", add: ["head"], people: 2, from: { head: [0, 300, 0] } });
  k.step({ title: "Bolt the head rail to the posts", detail: "Two bolts through each post, a cap nut on the other side. Hold the nut with one Allen key, turn the bolt with the other.", fix: [...posts.map((p) => at("bolt", p, [0.3, 0.7].map((f): Vec3 => [p.pos[0], yR + rh * f, zp - 16]), [0, 0, 1], BOLT, head)), ...posts.map((p) => at("nut", head, [0.3, 0.7].map((f): Vec3 => [p.pos[0], yR + rh * f, zHi]), [0, 0, -1], CAP_NUT))], tools: ["allen"] });
  k.step({ title: "Fit the connectors into the head rail", detail: "A barrel nut in each end hole, then screw a connector bolt into each one. Four in all.", fix: sides.flatMap((r) => [at("camScrew", head, joint(r, head, 0).map((v): Vec3 => [r.pos[0], v[1], zHi]), [0, 0, -1], CONN, r), at("nut", head, joint(r, head, 0).map((v): Vec3 => [r.pos[0], v[1], zHi - 10]), [0, 0, 1], BARREL)]), tools: ["allen"] });
  const railFix = (r: Part): CustomFix[] => [
    dowels(r, head, [0.1, 0.5, 0.9]),
    dowels(r, foot, [0.1, 0.5, 0.9]),
    ...[head, foot].map((e) => at("cam", r, joint(r, e, 0).map((v): Vec3 => [r.pos[0] - Math.sign(r.pos[0]) * (rt / 2), v[1], e === head ? zHi + 40 : zFi - 40]), [Math.sign(r.pos[0]), 0, 0], BIG_CAM)),
  ];
  k.step({ title: "Join the first side rail to the head rail", detail: "Three dowels in each end of the rail and a cam lock near each bolt hole first. One holds the headboard, the other pushes the rail onto the bolts. Turn the two cam locks with the big Allen key.", add: ["sR"], fix: railFix(sides[1]), people: 2, tools: ["hammer", "allen"], from: { sR: [0, 0, 500] } });
  k.step({ title: "Join the other side rail", detail: "Dowels and cam locks in it the same way, then onto the head rail and turn its two cam locks.", add: ["sL"], fix: railFix(sides[0]), people: 2, tools: ["hammer", "allen"], from: { sL: [0, 0, 500] } });
  k.step({ title: "Screw the connector bolts into the foot rail", detail: "Four, two near each end, by hand.", fix: sides.map((r) => at("camScrew", foot, joint(r, foot, 0).map((v): Vec3 => [r.pos[0], v[1], zFi]), [0, 0, 1], CONN, r)), tools: ["allen"] });
  k.step({ title: "Screw a foot into each foot leg", detail: "A foot cup on the bottom, then the foot.", add: ["fL", "fR"], fix: FEET(legs.map((p) => ({ p, at: [p.pos[0], 0, zLeg] }))), from: { fL: [0, 300, 0], fR: [0, 300, 0] } });
  k.step({ title: "Screw the legs onto the foot rail", detail: "Lay the foot rail face down. Each leg's bracket goes on the inside, near the end, four screws each.", add: ["foot"], fix: legs.map((p) => at("screw", foot, [-1, 1].flatMap((gx) => [-1, 1].map((gy): Vec3 => [p.pos[0] + gx * 25, yRt - 60 + gy * 30, zFi])), [0, 0, 1], WOOD)), tools: ["screwdriver"] });
  k.step({ title: "Join the foot rail on", detail: "Two people: push it onto both side rails' dowels, then turn the four cam locks.", people: 2, tools: ["allen"] });
  const dB = braceL / Math.SQRT2;
  k.step({ title: "Screw in the corner braces", detail: "One across each inside corner, a screw at each end.", add: braces.map((p) => p.id), fix: braces.flatMap((p) => {
    const gx = Math.sign(p.pos[0]), gz = p.pos[2] < 0 ? -1 : 1, cz = gz < 0 ? zHi : zFi;
    return [
      at("screw", p, [[gx * xs, yR + 60, cz - gz * (dB - 12)]], [gx, 0, 0], WOOD),
      at("screw", p, [[gx * (xs - dB + 12), yR + 60, cz]], [0, 0, gz], WOOD),
    ];
  }), tools: ["screwdriver"] });
  k.step({ title: "Bolt on the headboard", detail: `Pick the height you want, higher or lower, then ${king ? "six" : "four"} bolts through the posts into it.`, add: ["hb"], fix: posts.map((p) => at("bolt", p, (king ? [700, 820, 940] : [740, 900]).map((y): Vec3 => [p.pos[0], y, zp - 16 - (y - 700) * Math.tan(lean)]), [0, 0, 1], BOLT, board)), tools: ["allen"], people: 2, from: { hb: [0, 300, 0] } });
  k.step({ title: "Screw on the slat rails", detail: "One along the inside of each side rail, eight screws each.", add: ["rL", "rR"], fix: rails.map((r) => at("screw", r, spread(zHi + 80, zFi - 80, 8).map((z): Vec3 => [r.pos[0] + Math.sign(r.pos[0]) * 15, ySr - 20, z]), [Math.sign(r.pos[0]), 0, 0], WOOD)), tools: ["screwdriver"] });
  if (king) {
    k.step({ title: "Screw the beam brackets to the head and foot rails", detail: "One in the middle of each, two screws each.", fix: [head, foot].flatMap((e) => [at("bracket", e, [[0, ySr - 20, e === head ? zHi : zFi]], [0, 0, e === head ? -1 : 1], { len: 60, dia: 50, name: "Beam bracket" }), at("screw", e, [-30, 30].map((x): Vec3 => [x, ySr - 50, e === head ? zHi : zFi]), [0, 0, e === head ? -1 : 1], WOOD)]), tools: ["screwdriver"] });
    k.step({ title: "Lay in the centre beam and stand the middle leg under it", detail: "Hook each half into its bracket, slide them together over the middle leg's hanger, and bolt the hanger.", add: ["cb0", "cb1", "ml"], fix: [at("bolt", mid!, [[-30, ySr - 20, zMid - 40], [-30, ySr - 20, zMid + 40]], [1, 0, 0], { len: 30, dia: 6 })], tools: ["allen"] });
    k.step({ title: "Screw the beam halves in place", detail: "Two screws at each end.", fix: beams.map((p, i) => at("screw", p, [-1, 1].map((g): Vec3 => [g * 12, ySr, i ? zFi - 30 : zHi + 30]), [0, -1, 0], { len: 12, dia: 4 })), tools: ["screwdriver"] });
  } else {
    k.step({ title: "Lay in the centre beam", detail: "Pull it out to length and hook its ends over the head and foot rails, then one screw at each end.", add: ["cb0"], fix: [at("screw", beams[0], [[0, ySr, zHi + 20], [0, ySr, zFi - 20]], [0, -1, 0], { len: 12, dia: 4 })], tools: ["screwdriver"] });
    k.step({ title: "Screw the middle of the beam", detail: "One screw through the joint so it can't slide.", fix: [at("screw", beams[0], [[0, ySr, zMid]], [0, -1, 0], { len: 12, dia: 4 })], tools: ["screwdriver"] });
  }
  const holders = rails.flatMap((r) => (king ? [zHi + 40, zHi + Lin / 3, zFi - Lin / 3, zFi - 40] : [zHi + 40, zFi - 40]).map((z): Vec3 => [r.pos[0], ySr, z]));
  k.step({ title: "Screw on the slat holders", detail: "They clip over the slat rails and stop the slats sliding. One small screw each.", fix: [at("clip", rails[0], holders, [0, -1, 0], { len: 20, dia: 16, name: "Slat holder" }), at("screw", rails[0], holders.map((v): Vec3 => [v[0], v[1] + 2, v[2] + (v[2] < zMid ? 24 : -24)]), [0, -1, 0], { len: 8, dia: 4 })], tools: ["screwdriver"] });
  k.step({ title: "Lay the strips on the rails", detail: `Peel off the backing and press them along the slat rails${king ? " and the centre beam" : ""}, cutting the tape between them with scissors.`, add: strips.map((p) => p.id) });
  k.step({ title: "Roll out the slatted base", detail: "Sold separately. Roll it out from the head end and hook its ends under the holders.", add: ["slats"], from: { slats: [0, 300, 0] } });
  buildCustom(b, { ...s, custom: k.recipe });
  void base;
  return true;
}

/* ---------- the family ---------- */

function kindOf(s: ProductSpec) {
  const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
  if (/chest of 3|chest-3/.test(v)) return "c3";
  if (/chest of 5|chest-5/.test(v)) return "c5";
  if (/chest of 6|chest-6/.test(v)) return "c6";
  if (/bedside/.test(v)) return "bedside";
  if (/wardrobe/.test(v)) return "wardrobe";
  if (/bed frame|bed-frame/.test(v)) return /king/.test(v) ? "king" : /twin/.test(v) ? "twin" : null;
  if (/tv bench|tv-bench/.test(v)) return "tv";
  if (/cabinet/.test(v)) return "cabinet";
  return null;
}

const family: Family = {
  names: ["RÅDMANSÖ"],
  build(b, s) {
    switch (kindOf(s)) {
      case "c3":
        return chest(b, s, "c3");
      case "c5":
        return chest(b, s, "c5");
      case "c6":
        return chest6(b, s);
      case "bedside":
        return bedside(b, s);
      case "cabinet":
        return cabinet(b, s);
      case "tv":
        return tvBench(b, s);
      case "wardrobe":
        return wardrobe(b, s);
      case "twin":
        return bed(b, s, false);
      case "king":
        return bed(b, s, true);
      default:
        return false;
    }
  },
};
export default family;
