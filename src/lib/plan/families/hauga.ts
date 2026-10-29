import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rotate } from "../math";

/*
 * HAUGA, read from IKEA's manuals.
 *
 * Tables (74, 118 and 168 long): two long aprons take the metal corner brackets on a rug, the short ones are screwed
 * on, the frame is screwed down onto the upside-down top, then each leg takes a cross dowel and two threaded rods
 * and is held in its bracket with washers and nuts. Glides are knocked into the legs before it is turned over.
 * The chair is two ready-made side frames with the back rails and seat rails between them on dowels and long bolts,
 * an H stretcher bolted in upside down and the seat screwed on through four clips.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/* ---------- a small layer over PlanBuilder: parts where they end up, steps as a list of moves ---------- */

interface Part {
  id: string;
  name: string;
  size: Vec3; // mm, as it sits in the finished product
  pos: Vec3; // centre, finished product
  mat?: PartMaterial;
  shape?: "box" | "cyl";
  rot?: Vec3;
  pieces?: PartPiece[]; // relative to pos
}

interface Fx {
  def: HwDef;
  at: Vec3[];
  dir: Vec3 | ((p: Vec3, i: number) => Vec3);
  on?: string | ((p: Vec3, i: number) => string);
  mate?: string | ((p: Vec3, i: number) => string | undefined);
  hole?: false;
  twist?: number | ((p: Vec3, i: number) => number);
  travel?: number;
}

type Op =
  | { stage: string[]; rot?: Vec3; pivot?: Vec3; at?: Vec3; from?: Vec3 } // shown elsewhere: turned about pivot, moved to at
  | { add: string[]; from?: Vec3 | ((id: string) => Vec3 | undefined) }
  | { fit: Fx }
  | { preset: Fx }
  | { pause: number };

interface St {
  title: string;
  detail?: string;
  pose?: Pose;
  scene?: string;
  people?: 1 | 2;
  tools?: ToolId[];
  warnings?: WarnId[];
  kind?: StepKind;
  repeat?: number;
  check?: "square";
  wall?: boolean;
  ops: Op[];
}

const KIND_OF: Partial<Record<HwDef["kind"], StepKind>> = {
  dowel: "dowels",
  camScrew: "cams",
  cam: "cams",
  screw: "screws",
  nail: "nails",
  bolt: "bolts",
  nut: "bolts",
  stud: "bolts",
  pin: "shelves",
  hinge: "hinges",
  runner: "runners",
  bracket: "anchor",
  strap: "anchor",
  glide: "legs",
  knob: "screws",
};
const TOOL_OF: Partial<Record<HwDef["kind"], ToolId>> = {
  screw: "screwdriver",
  camScrew: "screwdriver",
  cam: "screwdriver",
  bolt: "allen",
  nut: "wrench",
  hinge: "screwdriver",
  nail: "hammer",
};

function run(b: PlanBuilder, parts: Part[], steps: St[]) {
  const keys = new Map<string, string>();
  const types = new Map<string, { ref: string; mid: Vec3 }>();
  for (const p of parts) {
    const tk = `${p.name}|${p.size.map(Math.round).join("x")}|${p.mat ?? "board"}|${p.shape ?? "box"}|${p.pieces ? JSON.stringify(p.pieces) : ""}`;
    let t = types.get(tk);
    if (!t) {
      // a part of several pieces is centred on their bounds, so it is placed at pos plus that offset
      if (p.pieces) {
        const { type, mid } = b.compound(p.name, p.pieces, { material: p.mat });
        t = { ref: type, mid };
      } else t = { ref: b.part(p.name, p.size, { material: p.mat ?? "board", shape: p.shape }), mid: [0, 0, 0] };
      types.set(tk, t);
    }
    keys.set(p.id, b.place(t.ref, [p.pos[0] + t.mid[0], p.pos[1] + t.mid[1], p.pos[2] + t.mid[2]], p.rot ?? [0, 0, 0]));
  }
  const key = (id: string) => {
    const k = keys.get(id);
    if (!k) throw new Error(`HAUGA: no part ${id}`);
    return k;
  };
  const byId = new Map(parts.map((p) => [p.id, p]));
  const fitsOf = (f: Fx): FitOpts[] =>
    f.at.map((p, i) => {
      const on = typeof f.on === "function" ? f.on(p, i) : f.on;
      const mate = typeof f.mate === "function" ? f.mate(p, i) : f.mate;
      return {
        on: on ? key(on) : undefined,
        at: p,
        dir: norm(typeof f.dir === "function" ? f.dir(p, i) : f.dir),
        mate: mate ? key(mate) : undefined,
        hole: f.hole,
        twist: typeof f.twist === "function" ? f.twist(p, i) : f.twist,
        travel: f.travel,
      };
    });
  const seen = new Set<string>();
  for (const st of steps) {
    const tools = new Set<ToolId>(st.tools ?? []);
    const fx = st.ops.flatMap((o) => ("fit" in o ? [o.fit] : []));
    for (const f of fx) {
      const t = TOOL_OF[f.def.kind];
      if (t && !f.def.notIncluded) tools.add(t);
    }
    const adds = st.ops.some((o) => "add" in o);
    const kind = st.kind ?? (fx.length ? (KIND_OF[fx.find((f) => f.def.kind !== "dowel")?.def.kind ?? fx[0].def.kind] ?? "general") : adds ? "join" : "general");
    const warnings = [...(st.warnings ?? []), ...(st.people === 2 && !st.warnings?.includes("two") ? (["two"] as WarnId[]) : [])].slice(0, 3);
    b.step({ title: st.title, detail: st.detail, pose: st.pose ?? "+y", scene: st.scene, people: st.people ?? 1, tools: [...tools], warnings, kind, repeat: st.repeat, check: st.check, wall: st.wall }, () => {
      let first = true;
      for (const o of st.ops) {
        if (!first) b.then("pause" in o ? o.pause : 0.12);
        first = false;
        if ("pause" in o) continue;
        if ("stage" in o) {
          b.stagger(o.stage.length > 3 ? 0.14 : 0.22);
          for (const id of o.stage) {
            const p = byId.get(id)!;
            const it = b.partItem(key(id));
            const pv = o.pivot ?? [0, 0, 0];
            const rot = o.rot ?? [0, 0, 0];
            const q = rotate([it.final.pos[0] - pv[0], it.final.pos[1] - pv[1], it.final.pos[2] - pv[2]], rot);
            const at = o.at ?? pv;
            const r0 = p.rot ?? [0, 0, 0];
            b.stage(key(id), [q[0] + at[0], q[1] + at[1], q[2] + at[2]], r0.some((x) => x) ? r0 : rot, o.from ?? [0, 160, 0]);
          }
        } else if ("add" in o) {
          b.stagger(o.add.length > 3 ? 0.16 : 0.24);
          for (const id of o.add) {
            if (seen.has(id)) continue;
            seen.add(id);
            const from = typeof o.from === "function" ? o.from(id) : o.from;
            b.add(key(id), from);
          }
        } else if ("fit" in o) {
          b.fits(o.fit.def, fitsOf(o.fit), Math.min(0.08, 2.4 / Math.max(1, o.fit.at.length)));
        } else {
          for (const x of fitsOf(o.preset)) b.preset(o.preset.def, x);
        }
      }
    });
  }
  const missing = parts.filter((p) => !seen.has(p.id));
  if (missing.length) throw new Error(`HAUGA: never added ${missing.map((p) => p.id).join(", ")}`);
}

/* ---------- tables ---------- */

const RAIL_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const TOP_SCREW: HwDef = { kind: "screw", len: 50, dia: 4 };
const CORNER: HwDef = { kind: "angle", len: 70, dia: 34 };
const CROSS_DOWEL: HwDef = { kind: "nut", len: 22, dia: 5 };
const ROD: HwDef = { kind: "stud", len: 60, dia: 8 };
const NUT: HwDef = { kind: "nut", len: 6, dia: 7 };
const WASHER: HwDef = { kind: "washer", len: 1.5, dia: 17 };
const TABLE_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const KNOCK_GLIDE: HwDef = { kind: "glide", len: 4, dia: 24 };

interface TableGeo {
  W: number;
  D: number;
  H: number;
  T: number;
  L: number; // leg section
  ins: number; // legs in from the edge of the top
  RH: number; // apron height
  rt: number; // apron thickness
  frameW: number; // the frame sits under this much of the top (all of it, or the middle of a drop-leaf)
}

/** An apron with the shallow arch along its bottom edge: full height at the ends, narrower between them. */
function apron(len: number, h: number, t: number, alongZ: boolean, notch = 0): PartPiece[] {
  const box = (l: number, hh: number, x: number, y: number): PartPiece => ({ shape: "box", size: alongZ ? [t, hh, l] : [l, hh, t], pos: alongZ ? [0, y, x] : [x, y, 0] });
  const e = Math.min(90, len * 0.14), m = h * 0.7;
  const ends = [box(e, h, -len / 2 + e / 2, 0), box(e, h, len / 2 - e / 2, 0)];
  if (!notch) return [...ends, box(len - 2 * e, m, 0, h / 2 - m / 2)];
  // a slot in the top edge in the middle, for the drop-leaf's slide bar
  const half = (len - 2 * e - 50) / 2;
  return [...ends, box(half, m, -25 - half / 2, h / 2 - m / 2), box(half, m, 25 + half / 2, h / 2 - m / 2), box(50, m - notch, 0, h / 2 - m + (m - notch) / 2)];
}

/** The frame of four aprons, four legs and four brackets, as parts and the fittings that join them. */
function tableFrame(g: TableGeo, notch = 0) {
  const { D, H, T, L, ins, RH, rt, frameW } = g;
  const yTop = H - T;
  const lx = frameW / 2 - ins - L / 2, lz = D / 2 - ins - L / 2;
  const ra = yTop - RH / 2;
  const longL = 2 * lx - L, shortL = 2 * lz - L;
  const zl = lz + L / 2 - rt / 2, xs = lx + L / 2 - rt / 2;
  const nx = longL >= shortL ? "Long apron" : "Short apron", nz = longL >= shortL ? "Short apron" : "Long apron";
  const parts: Part[] = [
    { id: "LR0", name: nx, size: [longL, RH, rt], pos: [0, ra, -zl], pieces: apron(longL, RH, rt, false) },
    { id: "LR1", name: nx, size: [longL, RH, rt], pos: [0, ra, zl], pieces: apron(longL, RH, rt, false) },
    { id: "SR0", name: nz, size: [rt, RH, shortL], pos: [-xs, ra, 0], pieces: apron(shortL, RH, rt, true, notch) },
    { id: "SR1", name: nz, size: [rt, RH, shortL], pos: [xs, ra, 0], pieces: apron(shortL, RH, rt, true, notch) },
  ];
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  corners.forEach(([sx, sz], i) => parts.push({ id: `G${i}`, name: "Leg", size: [L, yTop, L], pos: [sx * lx, yTop / 2, sz * lz], mat: "wood" }));
  // a bracket sits across each inside corner, its ends screwed to the two aprons
  const legOf = (sx: number, sz: number) => `G${corners.findIndex(([a, b]) => a === sx && b === sz)}`;
  const bracketAt = ([sx, sz]: readonly [number, number]): Vec3 => [sx * (lx - L / 2 - 14), ra, sz * (lz - L / 2 - 14)];
  const brackets: Fx = {
    def: CORNER,
    at: corners.map(bracketAt),
    dir: (p) => [Math.sign(p[0]), 0, Math.sign(p[2])],
    on: (p) => (p[2] < 0 ? "LR0" : "LR1"),
    hole: false,
    twist: Math.PI / 4,
  };
  const bracketScrews = (long: boolean): Fx => ({
    def: RAIL_SCREW,
    at: corners.flatMap(([sx, sz]) =>
      [-14, 14].map((dy): Vec3 => (long ? [sx * (lx - L / 2 - 22), ra + dy, sz * (zl - rt / 2)] : [sx * (xs - rt / 2), ra + dy, sz * (lz - L / 2 - 22)])),
    ),
    dir: (p) => (long ? [0, 0, Math.sign(p[2])] : [Math.sign(p[0]), 0, 0]),
    on: (p) => (long ? (p[2] < 0 ? "LR0" : "LR1") : p[0] < 0 ? "SR0" : "SR1"),
  });
  // two threaded rods in each leg's cut inside corner, one above the other, one of them through the cross dowel
  const rodAt = corners.flatMap(([sx, sz]) => [ra + RH * 0.22, ra - RH * 0.22].map((y): Vec3 => [sx * (lx - L / 2 + 6), y, sz * (lz - L / 2 + 6)]));
  const rods: Fx = { def: ROD, at: rodAt, dir: (p) => [Math.sign(p[0]), 0, Math.sign(p[2])], on: (p) => legOf(Math.sign(p[0]), Math.sign(p[2])) };
  const crossDowels: Fx = { def: CROSS_DOWEL, at: corners.map(([sx, sz]): Vec3 => [sx * (lx - 6), yTop, sz * (lz - 6)]), dir: [0, -1, 0], on: (p) => legOf(Math.sign(p[0]), Math.sign(p[2])) };
  const off = (p: Vec3, d: number): Vec3 => [p[0] - Math.sign(p[0]) * d, p[1], p[2] - Math.sign(p[2]) * d];
  const washers: Fx = { def: WASHER, at: rodAt.map((p) => off(p, 19)), dir: (p) => [Math.sign(p[0]), 0, Math.sign(p[2])], hole: false };
  const nuts: Fx = { def: NUT, at: rodAt.map((p) => off(p, 21)), dir: (p) => [Math.sign(p[0]), 0, Math.sign(p[2])], hole: false };
  const glides: Fx = { def: KNOCK_GLIDE, at: corners.map(([sx, sz]): Vec3 => [sx * lx, 0, sz * lz]), dir: [0, 1, 0], on: (p) => legOf(Math.sign(p[0]), Math.sign(p[2])), hole: false };
  // screws down through the aprons into the top (upside down), spread along each apron
  const topScrews = (nLong: number, nShort: number): Fx => {
    const at: Vec3[] = [];
    for (const sz of [-1, 1]) for (const x of spread(-longL / 2 + 90, longL / 2 - 90, nLong)) at.push([x, yTop - RH, sz * zl]);
    for (const sx of [-1, 1]) for (const z of spread(-shortL / 2 + 80, shortL / 2 - 80, nShort)) at.push([sx * xs, yTop - RH, z]);
    return { def: TOP_SCREW, at, dir: [0, 1, 0], on: (p) => (Math.abs(p[2]) > zl - 1 ? (p[2] < 0 ? "LR0" : "LR1") : p[0] < 0 ? "SR0" : "SR1"), mate: "TOP" };
  };
  return { parts, brackets, bracketScrews, rods, crossDowels, washers, nuts, glides, topScrews, yTop, lx, lz, zl, xs, longL, shortL, ra };
}

/** The manual's order: brackets on the long aprons, short aprons on, the frame upside down onto the top, then the legs. */
function tableSteps(f: ReturnType<typeof tableFrame>, o: { dowels: Fx; screws: Fx; two: 1 | 2; frame: string[]; words?: [string, string]; topFirst?: St[]; after?: St[] }): St[] {
  const [wa, wb] = o.words ?? ["the long aprons", "the short aprons"];
  // the frame is put together on the rug, upside down, before it goes onto the top
  const flip = { rot: [0, 0, Math.PI] as Vec3, pivot: [0, f.ra, 0] as Vec3, at: [0, f.yTop - f.ra, 0] as Vec3 };
  const legs = ["G0", "G1", "G2", "G3"];
  const frame: St[] = [
    {
      title: `Screw the corner brackets onto ${wa}`,
      detail: "Lay the aprons on a rug, inside faces up. A bracket at each end, two screws into the apron.",
      scene: "frame",
      tools: ["screwdriver"],
      warnings: ["floor"],
      ops: [{ stage: o.frame.slice(0, 2), ...flip }, { fit: f.brackets }, { fit: f.bracketScrews(true) }],
    },
    {
      title: `Screw ${wb} to the brackets`,
      detail: "Swing each one in against the free ends of the brackets and screw it on.",
      scene: "frame",
      tools: ["screwdriver"],
      ops: [{ stage: o.frame.slice(2), ...flip, from: [0, 0, 0] }, { fit: f.bracketScrews(false) }],
    },
  ];
  const top: St[] = o.topFirst ?? [
    {
      title: "Push the dowels into the underside of the top",
      detail: "Lay the top face down on the rug. The dowels go in the holes near the edges.",
      pose: "-y",
      warnings: ["face"],
      ops: [{ add: ["TOP"], from: [0, -200, 0] }, { fit: o.dowels }],
    },
  ];
  return [
    ...(o.topFirst ? [...top, ...frame] : [...frame, ...top]),
    {
      title: "Screw the frame down onto the top",
      detail: "Lower the frame onto the top so the dowels find their holes, then screw down through the aprons.",
      pose: "-y",
      people: o.two,
      tools: ["screwdriver"],
      kind: "screws",
      ops: [{ add: o.frame, from: [0, -260, 0] }, { fit: o.screws }],
    },
    {
      title: "Fit a cross dowel and two threaded rods in each leg",
      detail: "Drop the cross dowel in the top of the leg with its slot lined up, then screw both rods into the cut corner by hand.",
      scene: "legs",
      ops: [...legs.map((id, i): Op => ({ stage: [id], pivot: [Math.sign(f.parts.find((p) => p.id === id)!.pos[0]) * f.lx, f.yTop / 2, Math.sign(f.parts.find((p) => p.id === id)!.pos[2]) * f.lz], at: [(i - 1.5) * 140, f.yTop / 2, 0] })), { fit: f.crossDowels }, { fit: f.rods }],
    },
    {
      title: "Bolt the legs into the brackets",
      detail: "The rods go through the bracket. A washer and a nut on each, tightened with the box spanner.",
      pose: "-y",
      tools: ["wrench"],
      kind: "legs",
      people: o.two,
      ops: [{ add: legs, from: [0, -300, 0] }, { fit: f.washers }, { fit: f.nuts }],
    },
    {
      title: "Knock the glides into the legs",
      detail: "Tap each one in with a hammer until it sits flat on the end of the leg.",
      pose: "-y",
      tools: ["hammer"],
      ops: [{ fit: f.glides }],
    },
    ...(o.after ?? []),
    {
      title: "Turn the table over",
      detail: (o.two === 2 ? "Lift it together by the top, not the legs." : "Lift it by the top, not the legs.") + (o.topFirst ? " To raise a leaf, lift it and pull the slide bar out under it." : ""),
      pose: "+y",
      people: o.two,
      kind: "standup",
      ops: [],
    },
  ];
}

function table(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const g: TableGeo = { W, D, H, T: 28, L: 50, ins: 22, RH: 85, rt: 20, frameW: W };
  const f = tableFrame(g);
  const parts: Part[] = [{ id: "TOP", name: "Table top", size: [W, g.T, D], pos: [0, H - g.T / 2, 0] }, ...f.parts];
  const long = W > 1400;
  const square = W < 900;
  // the small table has two locating dowels, the others four; the long one five screws along each long apron
  const dowels: Fx = {
    def: TABLE_DOWEL,
    at: (square ? [[0, -f.zl], [0, f.zl]] : [[0, -f.zl], [0, f.zl], [-f.xs, 0], [f.xs, 0]]).map(([x, z]): Vec3 => [x, f.yTop, z]),
    dir: [0, 1, 0],
    on: "TOP",
    mate: undefined,
  };
  const screws = square ? f.topScrews(3, 3) : long ? f.topScrews(5, 2) : f.topScrews(4, 2);
  const two: 1 | 2 = long ? 2 : 1;
  run(b, parts, tableSteps(f, { dowels, screws, two, frame: ["LR0", "LR1", "SR0", "SR1"] }));
  return true;
}

/* ---------- drop-leaf table ---------- */

const HINGE_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const SMALL_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const LEAF_HINGE: HwDef = { kind: "flatHinge", len: 64, dia: 36 };
const BAR_BRACKET: HwDef = { kind: "clamp", len: 52, dia: 30 };
const STOP_PLATE: HwDef = { kind: "clip", len: 10, dia: 40 };
const BUFFER: HwDef = { kind: "glide", len: 8, dia: 22 };

/**
 * The drop-leaf table, from its manual: the middle and both leaves lie face down on a rug, butted together. Two
 * dowels go into the middle, a stop plate is knocked into each leaf, four buffers are screwed under the leaf corners
 * and the leaves are hinged on, two hinges each. The slide bar lies in two U brackets screwed to the middle. The frame
 * (the end aprons have a slot for the bar) goes together like the table's and is screwed down, then the legs.
 */
function dropLeaf(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const M = 550, LF = (W - M) / 2; // the middle and each leaf
  const g: TableGeo = { W, D, H, T: 28, L: 45, ins: 16, RH: 85, rt: 20, frameW: M };
  const f = tableFrame(g, 36);
  const yU = H - g.T; // underside of the top
  const parts: Part[] = [
    { id: "TOP", name: "Table top, middle", size: [M, g.T, D], pos: [0, H - g.T / 2, 0] },
    { id: "LF0", name: "Leaf", size: [LF, g.T, D], pos: [-(M + LF) / 2, H - g.T / 2, 0] },
    { id: "LF1", name: "Leaf", size: [LF, g.T, D], pos: [(M + LF) / 2, H - g.T / 2, 0] },
    { id: "BAR", name: "Slide bar", mat: "wood", size: [M + 60, 22, 40], pos: [0, yU - 11, 0] },
    ...f.parts,
  ];
  const leafOf = (p: Vec3) => (p[0] < 0 ? "LF0" : "LF1");
  const up: Vec3 = [0, 1, 0];
  const hingeAt: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (M / 2), yU, sz * (D / 2 - 130)]));
  const bracketX = [-1, 1].map((sx) => sx * (M / 2 - 110));
  const dowels: Fx = { def: TABLE_DOWEL, at: [-1, 1].map((sz): Vec3 => [0, f.yTop, sz * f.zl]), dir: up, on: "TOP" };
  const screws = f.topScrews(3, 3);
  run(
    b,
    parts,
    tableSteps(f, {
      dowels,
      screws,
      two: 1,
      frame: ["LR0", "LR1", "SR0", "SR1"],
      words: ["the front and back aprons", "the end aprons"],
      topFirst: [
        {
          title: "Lay the top face down and push in two dowels",
          detail: "Butt the leaves up against the middle on a rug. The dowels go in the middle part, near its front and back edges.",
          pose: "-y",
          warnings: ["face", "floor"],
          ops: [{ add: ["TOP", "LF0", "LF1"], from: [0, -200, 0] }, { fit: dowels }],
        },
        {
          title: "Knock a stop plate into each leaf",
          detail: "Close to the joint, where the slide bar will run. Tap it with the hammer until it sits flat.",
          pose: "-y",
          tools: ["hammer"],
          kind: "general",
          ops: [{ fit: { def: STOP_PLATE, at: [-1, 1].map((sx): Vec3 => [sx * (M / 2 + 45), yU, 0]), dir: up, on: leafOf, hole: false } }],
        },
        {
          title: "Screw a buffer under each outer corner",
          detail: "Four in all, near the far corners of the leaves.",
          pose: "-y",
          tools: ["screwdriver"],
          ops: [
            { fit: { def: BUFFER, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (W / 2 - 50), yU, sz * (D / 2 - 50)])), dir: up, on: leafOf, hole: false } },
            { fit: { def: SMALL_SCREW, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (W / 2 - 50), yU - 8, sz * (D / 2 - 50)])), dir: up, on: leafOf } },
          ],
        },
        {
          title: "Screw the hinges across the joints",
          detail: "Two hinges on each joint, pin in line with the gap. Four screws each.",
          pose: "-y",
          tools: ["screwdriver"],
          kind: "hinges",
          ops: [
            { fit: { def: LEAF_HINGE, at: hingeAt, dir: up, on: "TOP", hole: false } },
            { fit: { def: HINGE_SCREW, at: hingeAt.flatMap((p) => [-18, 18].flatMap((dx) => [-10, 10].map((dz): Vec3 => [p[0] + dx, yU - 1.6, p[2] + dz]))), dir: up, on: (p) => (Math.abs(p[0]) < M / 2 ? "TOP" : leafOf(p)) } },
          ],
        },
        {
          title: "Lay the slide bar in its two brackets",
          detail: "The bar runs across the middle, from leaf to leaf. Put the brackets over it.",
          pose: "-y",
          ops: [{ add: ["BAR"], from: [0, -200, 0] }, { fit: { def: BAR_BRACKET, at: bracketX.map((x): Vec3 => [x, yU, 0]), dir: up, on: "TOP", hole: false, twist: Math.PI / 2 } }],
        },
        {
          title: "Screw the brackets to the top",
          detail: "Two screws in each. Check the bar still slides freely.",
          pose: "-y",
          tools: ["screwdriver"],
          ops: [{ fit: { def: SMALL_SCREW, at: bracketX.flatMap((x) => [-1, 1].map((sz): Vec3 => [x, yU - 2.5, sz * 32])), dir: up, on: "TOP" } }],
        },
      ],
    }),
  );
  return true;
}

/* ---------- chair ---------- */

const CHAIR_BOLT: HwDef = { kind: "bolt", len: 80, dia: 6 };
const CHAIR_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const SEAT_CLIP: HwDef = { kind: "angle", len: 22, dia: 26 };
const CLIP_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };

function chair(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const SY = 440; // seat top
  const st = 22; // seat thickness
  const lw = 36; // leg section
  const xs = W / 2 - lw / 2; // side frame centres
  const zr = -D / 2 + lw / 2, zf = D / 2 - lw / 2 - 20; // rear and front legs
  const yr = SY - st - 30; // seat rails
  const side = (sx: number): Part => ({
    id: sx < 0 ? "SF0" : "SF1",
    name: "Side frame",
    mat: "wood",
    size: [lw, H, D],
    pos: [sx * xs, H / 2, 0],
    pieces: [
      { shape: "box", size: [lw, H, lw], pos: [0, 0, zr], rot: [-0.04, 0, 0] },
      { shape: "box", size: [lw, SY - st, lw], pos: [0, (SY - st) / 2 - H / 2, zf] },
      { shape: "box", size: [lw - 10, 60, zf - zr - lw], pos: [0, yr - H / 2, (zf + zr) / 2] },
      { shape: "box", size: [lw - 10, 30, zf - zr - lw], pos: [0, 150 - H / 2, (zf + zr) / 2] },
    ],
  });
  const cw = 2 * xs - lw; // between the side frames
  const zb = zr + 6;
  const parts: Part[] = [
    side(-1),
    side(1),
    { id: "BT", name: "Top back rail", mat: "wood", size: [cw, 90, 22], pos: [0, H - 70, zb - 14] },
    { id: "BS", name: "Back slat", mat: "wood", size: [cw, 70, 22], pos: [0, H - 230, zb - 8] },
    { id: "RB", name: "Seat rail", mat: "wood", size: [cw, 60, 22], pos: [0, yr, zr + lw / 2 + 11] },
    { id: "RF", name: "Seat rail", mat: "wood", size: [cw, 60, 22], pos: [0, yr, zf - lw / 2 - 11] },
    { id: "X", name: "Stretcher", mat: "wood", size: [cw, 30, 24], pos: [0, 150, (zf + zr) / 2] },
    { id: "SEAT", name: "Seat", mat: "wood", size: [W - 10, st, D - 10], pos: [0, SY - st / 2, 5] },
  ];
  const cross = ["BT", "BS", "RB", "RF"];
  const byId = new Map(parts.map((p) => [p.id, p]));
  const dowelsAt = (sx: number) =>
    cross.flatMap((id) => {
      const p = byId.get(id)!;
      return [-0.25, 0.25].map((k): Vec3 => [sx * (cw / 2), p.pos[1] + p.size[1] * k, p.pos[2]]);
    });
  // dowels go into the first side frame from inside, then into the free ends of the rails for the second one
  const dowels = (sx: number): Fx => ({
    def: CHAIR_DOWEL,
    at: dowelsAt(sx),
    dir: [sx, 0, 0],
    on: (_, i) => (sx < 0 ? "SF0" : cross[Math.floor(i / 2)]),
    mate: (_, i) => (sx < 0 ? cross[Math.floor(i / 2)] : "SF1"),
  });
  const bolts = (sx: number): Fx => ({
    def: CHAIR_BOLT,
    at: [
      [sx * (W / 2), H - 70, zb - 14],
      [sx * (W / 2), yr, zr + lw / 2 + 11],
      [sx * (W / 2), yr, zf - lw / 2 - 11],
    ],
    dir: [-sx, 0, 0],
    on: sx < 0 ? "SF0" : "SF1",
    mate: undefined,
  });
  const clipsAt: Vec3[] = [-1, 1].flatMap((sx) => [zr + lw / 2 + 22, zf - lw / 2 - 22].map((z): Vec3 => [sx * (cw / 2 - 60), SY - st, z]));
  const clips: Fx = { def: SEAT_CLIP, at: clipsAt, dir: [0, 1, 0], on: (p) => (p[2] < 0 ? "RB" : "RF"), hole: false, twist: (p) => (p[2] < 0 ? 0 : Math.PI) };
  const rails = ["RB", "RF"];
  run(b, parts, [
    {
      title: "Screw the seat clips onto the seat rails",
      detail: "Lay both rails on a rug. Two clips along the top edge of each, one screw each.",
      scene: "rails",
      tools: ["screwdriver"],
      warnings: ["floor"],
      ops: [
        ...rails.map((id, i): Op => ({ stage: [id], pivot: byId.get(id)!.pos, at: [0, 30, (i - 0.5) * 160] })),
        { fit: clips },
        { fit: { def: CLIP_SCREW, at: clipsAt.map((p): Vec3 => [p[0], p[1] - 4, p[2] + (p[2] < 0 ? -6 : 6)]), dir: (p) => [0, 0, p[2] < 0 ? 1 : -1], on: (p) => (p[2] < 0 ? "RB" : "RF") } },
      ],
    },
    {
      title: "Stand the back rails and seat rails in one side frame",
      detail: "Lay the side frame on a rug and push the dowels into it. Then press each rail onto its dowels.",
      pose: "+x",
      warnings: ["floor"],
      ops: [{ add: ["SF0"] }, { fit: dowels(-1) }, { add: cross, from: [260, 0, 0] }],
    },
    {
      title: "Lay the other side frame on and bolt it",
      detail: "Dowels into the free rail ends first. Three long bolts through the frame: top back rail and both seat rails.",
      pose: "+x",
      tools: ["allen"],
      ops: [{ fit: dowels(1) }, { add: ["SF1"], from: [300, 0, 0] }, { fit: bolts(1) }],
    },
    {
      title: "Turn it over and bolt the first side",
      detail: "The same three bolts through the side frame now on top.",
      pose: "-x",
      tools: ["allen"],
      ops: [{ fit: bolts(-1) }],
    },
    {
      title: "Bolt in the stretcher",
      detail: "Stand the chair upside down on a covered table. One bolt through each lower side rail into the stretcher.",
      pose: "-y",
      tools: ["allen"],
      ops: [
        { add: ["X"], from: [0, -200, 0] },
        {
          fit: { def: CHAIR_BOLT, at: [-1, 1].map((sx): Vec3 => [sx * (W / 2), 150, (zf + zr) / 2]), dir: (p) => [-Math.sign(p[0]), 0, 0], on: (p) => (p[0] < 0 ? "SF0" : "SF1"), mate: "X" },
        },
      ],
    },
    {
      title: "Lower the frame onto the seat",
      detail: "Lay the seat face down and put the chair upside down on it. The gap is the same all round.",
      pose: "-y",
      warnings: ["face"],
      ops: [{ add: ["SEAT"], from: [0, 260, 0] }],
    },
    {
      title: "Screw the clips into the seat",
      detail: "One screw up through each clip into the seat. Now tighten every bolt and screw.",
      pose: "-y",
      tools: ["screwdriver", "allen"],
      ops: [{ fit: { def: CLIP_SCREW, at: clipsAt.map((p): Vec3 => [p[0] + 8, p[1] - 2, p[2] + (p[2] < 0 ? 12 : -12)]), dir: [0, 1, 0], on: (p) => (p[2] < 0 ? "RB" : "RF"), mate: "SEAT" } }],
    },
  ]);
  return true;
}

/*
 * The stool: two aprons take their dowels and a seat clip each on a rug, the two ready-made side frames (two legs and
 * a rail) take two clips each. Upside down, the aprons go into one side frame, the other side frame goes on and four
 * bolts pull it together. Upright, four dowels go into the leg tops; then it is lowered upside down onto the seat
 * lying face down, and the six clips are screwed to the seat.
 */
function stool(b: PlanBuilder, s: ProductSpec) {
  // IKEA: 32 x 32, 45 high
  const W = 320, D = 320, H = s.size.h * 10 || 450;
  const st = 20, SY = H - st; // seat underside
  const lw = 38, xl = W / 2 - lw / 2; // legs
  const rt = 18, rh = 80, ry = SY - rh / 2, xr = W / 2 - 5 - rt / 2; // rails and aprons, a little in from the legs' faces
  const inner = W / 2 - lw; // the aprons run between the legs
  const side = (sx: number): Part => ({
    id: sx < 0 ? "F0" : "F1",
    name: "Side frame",
    mat: "wood",
    size: [lw, SY, D],
    pos: [sx * xl, SY / 2, 0],
    pieces: [
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [lw, SY, lw], pos: [0, 0, sz * xl] })),
      { shape: "box", size: [rt, rh, 2 * inner], pos: [sx * (xr - xl), ry - SY / 2, 0] },
    ],
  });
  // the seat has a hand slot near the back
  const slot = { x: 60, z0: -95, z1: -70 };
  const seat: Part = {
    id: "SEAT",
    name: "Seat",
    mat: "wood",
    size: [W, st, D],
    pos: [0, SY + st / 2, 0],
    pieces: [
      { shape: "box", size: [W, st, D / 2 - slot.z1], pos: [0, 0, (slot.z1 + D / 2) / 2] },
      { shape: "box", size: [W, st, slot.z0 + D / 2], pos: [0, 0, (-D / 2 + slot.z0) / 2] },
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [W / 2 - slot.x, st, slot.z1 - slot.z0], pos: [sx * (W / 2 + slot.x) / 2, 0, (slot.z0 + slot.z1) / 2] })),
    ],
  };
  const parts: Part[] = [
    side(-1),
    side(1),
    { id: "A0", name: "Apron", mat: "wood", size: [2 * inner, rh, rt], pos: [0, ry, -xr] },
    { id: "A1", name: "Apron", mat: "wood", size: [2 * inner, rh, rt], pos: [0, ry, xr] },
    seat,
  ];
  const byId = new Map(parts.map((p) => [p.id, p]));
  const aprons = ["A0", "A1"], frames = ["F0", "F1"];
  const fi = (x: number) => (x < 0 ? "F0" : "F1");
  const dowels: Fx = {
    def: CHAIR_DOWEL,
    at: aprons.flatMap((id) => [-1, 1].flatMap((sx) => [ry - 22, ry + 22].map((y): Vec3 => [sx * inner, y, byId.get(id)!.pos[2]]))),
    dir: (p) => [-Math.sign(p[0]), 0, 0],
    on: (p) => (p[2] < 0 ? "A0" : "A1"),
    mate: (p) => fi(p[0]),
  };
  const fi2 = xr - rt / 2; // inner faces of the aprons and rails
  const apronClips: Fx = { def: SEAT_CLIP, at: [-1, 1].map((sz): Vec3 => [0, SY, sz * fi2]), dir: [0, 1, 0], on: (p) => (p[2] < 0 ? "A0" : "A1"), hole: false, twist: (p) => (p[2] < 0 ? 0 : Math.PI) };
  const frameClips: Fx = {
    def: SEAT_CLIP,
    at: [-1, 1].flatMap((sx) => [-60, 60].map((z): Vec3 => [sx * fi2, SY, z])),
    dir: [0, 1, 0],
    on: (p) => fi(p[0]),
    hole: false,
    twist: (p) => (p[0] < 0 ? Math.PI / 2 : -Math.PI / 2),
  };
  const clipScrews: Fx = {
    def: CLIP_SCREW,
    at: [...apronClips.at.map((p): Vec3 => [p[0] + 8, SY - 2, p[2] - Math.sign(p[2]) * 12]), ...frameClips.at.map((p): Vec3 => [p[0] - Math.sign(p[0]) * 12, SY - 2, p[2] + 8])],
    dir: [0, 1, 0],
    on: (p) => (Math.abs(p[2]) > Math.abs(p[0]) ? (p[2] < 0 ? "A0" : "A1") : fi(p[0])),
    mate: "SEAT",
  };
  // upside down the floor is level with the seat top: parts laid out flat lie just under it
  const flat = (id: string, at: Vec3, rot: Vec3): Op => ({ stage: [id], pivot: byId.get(id)!.pos, at, rot, from: [0, -160, 0] });
  const free = (ids: string[], off: Vec3): Op => ({ stage: ids, pivot: [0, 0, 0], at: off, from: [0, 0, 0] });
  run(b, parts, [
    {
      title: "Tap the dowels into the two aprons",
      detail: "Lay them flat on a rug. Two dowels into each end.",
      pose: "-y",
      tools: ["hammer"],
      warnings: ["floor"],
      ops: [flat("A0", [0, H - rt / 2, -110], [Math.PI / 2, 0, 0]), flat("A1", [0, H - rt / 2, 110], [Math.PI / 2, 0, 0]), { fit: dowels }],
    },
    {
      title: "Push a seat clip into each apron",
      detail: "Into the hole in the middle of the top edge, the tab pointing inwards.",
      pose: "-y",
      ops: [{ fit: apronClips }],
    },
    {
      title: "Push two seat clips into each side frame",
      detail: "Into the holes along the top edge of the rail, tabs pointing inwards.",
      pose: "-y",
      repeat: 2,
      ops: [flat("F0", [-420, H - lw / 2, 0], [0, 0, Math.PI / 2]), flat("F1", [420, H - lw / 2, 0], [0, 0, -Math.PI / 2]), { fit: frameClips }],
    },
    {
      title: "Push the aprons into a side frame",
      detail: "Stand a side frame upside down on the rug and press both aprons onto its dowels.",
      pose: "-y",
      ops: [{ add: ["F0"] }, free(aprons, [220, 0, 0]), { add: aprons }],
    },
    {
      title: "Put the other side frame on and bolt it",
      detail: "Press it onto the free dowels, then two bolts through each frame into the aprons.",
      pose: "-y",
      tools: ["allen"],
      ops: [
        free(["F1"], [260, 0, 0]),
        { add: ["F1"] },
        { fit: { def: CHAIR_BOLT, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (W / 2), ry, sz * xr])), dir: (p) => [-Math.sign(p[0]), 0, 0], on: (p) => fi(p[0]), mate: (p) => (p[2] < 0 ? "A0" : "A1") } },
      ],
    },
    {
      title: "Turn it over and tap a dowel into each leg",
      detail: "Into the hole in the top of each leg.",
      tools: ["hammer"],
      ops: [{ fit: { def: CHAIR_DOWEL, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, SY, sz * xl])), dir: [0, -1, 0], on: (p) => fi(p[0]), mate: "SEAT" } }],
    },
    {
      title: "Lower the frame onto the seat",
      detail: "Lay the seat face down on the rug, turn the frame upside down and lower it so the four dowels go into the seat.",
      pose: "-y",
      warnings: ["face"],
      // the frame is held up while the seat is laid down under it, then the seat is added where it lies
      ops: [free([...frames, ...aprons], [0, -320, 0]), { stage: ["SEAT"], pivot: [0, 0, 0], at: [0, 1, 0], from: [0, 0, 380] }, free([...frames, ...aprons], [0, 0, 0]), { add: ["SEAT"] }],
    },
    {
      title: "Screw the clips to the seat",
      detail: "One screw up through each of the six clips. Then tighten the four bolts once more.",
      pose: "-y",
      tools: ["screwdriver", "allen"],
      ops: [{ fit: clipScrews }],
    },
  ]);
  return true;
}

/* ---------- the click-together cases ---------- */

/*
 * The chests, the bedside table, the cabinets, the sideboard and the TV bench share one system. Sides with the
 * cabinet runners already screwed on (by you, on a rug) take the top, bottom and shelves with a click: the
 * connectors are fitted at the factory. The case is built lying on its front, the back boards or the hardboard back
 * slide into grooves and are locked with push pins and plastic clips, the plinth rail goes in on dowels with plastic
 * plinth brackets, then it is stood up for the gallery board along the back of the top and the wall fixing.
 * Drawers are built on their fronts with cam bolts, dowels and cam locks, the bottom slid in and the back locked on.
 */

type Face = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";
interface FaceOpts {
  a?: number; // spread from this fraction of the face...
  b?: number; // ...to this one, along its long side (or `along`)
  v?: number; // and at this fraction across it
  along?: 0 | 1 | 2;
  mate?: string;
  hole?: false;
  twist?: number;
  out?: number; // stand off the face by this much (washers, nuts)
}

/** Fittings spread over one face of a part, going into it. */
function kit(parts: Part[]) {
  const by = new Map(parts.map((p) => [p.id, p]));
  const box = (id: string) => {
    const p = by.get(id);
    if (!p) throw new Error(`HAUGA: no part ${id}`);
    return { lo: p.pos.map((c, i) => c - p.size[i] / 2) as Vec3, hi: p.pos.map((c, i) => c + p.size[i] / 2) as Vec3, p };
  };
  const F = (def: HwDef, id: string, face: Face, n: number, o: FaceOpts = {}): Fx => {
    const { lo, hi } = box(id);
    const k = "xyz".indexOf(face[1]) as 0 | 1 | 2;
    const sg = face[0] === "+" ? 1 : -1;
    const [u, w] = ([0, 1, 2] as const).filter((j) => j !== k);
    const along = o.along ?? (hi[u] - lo[u] >= hi[w] - lo[w] ? u : w);
    const across = along === u ? w : u;
    const a = o.a ?? 0.15, bb = o.b ?? 0.85;
    const at: Vec3[] = range(n).map((i) => {
      const t = n === 1 ? (a + bb) / 2 : a + ((bb - a) * i) / (n - 1);
      const p: Vec3 = [0, 0, 0];
      p[k] = (sg > 0 ? hi[k] : lo[k]) + sg * (o.out ?? 0);
      p[along] = lo[along] + (hi[along] - lo[along]) * t;
      p[across] = lo[across] + (hi[across] - lo[across]) * (o.v ?? 0.5);
      return p;
    });
    const dir: Vec3 = [0, 0, 0];
    dir[k] = -sg;
    return { def, at, dir, on: id, mate: o.mate, hole: o.hole, twist: o.twist };
  };
  /** The same fittings on several parts. */
  const FF = (def: HwDef, list: [string, Face, number, FaceOpts?][]): Fx => {
    const fx = list.map(([id, face, n, o]) => F(def, id, face, n, o));
    const at = fx.flatMap((f) => f.at);
    const dirs = fx.flatMap((f) => f.at.map(() => f.dir as Vec3));
    const ons = fx.flatMap((f) => f.at.map(() => f.on as string));
    const mates = fx.flatMap((f) => f.at.map(() => f.mate as string | undefined));
    return { def, at, dir: (_, i) => dirs[i], on: (_, i) => ons[i], mate: (_, i) => mates[i], hole: fx[0]?.hole, twist: fx[0]?.twist };
  };
  return { F, FF, box, by };
}

// fittings, sized so different ones stay apart in the list
const T_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const BIG_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 10 };
const RUNNER_SCREW: HwDef = { kind: "screw", len: 11, dia: 4 };
const CLICK_A: HwDef = { kind: "connector", len: 26, dia: 14 };
const CLICK_B: HwDef = { kind: "clip", len: 10, dia: 16 };
const SLEEVE: HwDef = { kind: "stud", len: 22, dia: 8 };
const LOCK_PIN: HwDef = { kind: "clip", len: 18, dia: 7 };
const PLUG_SCREW: HwDef = { kind: "screw", len: 20, dia: 6 };
const PLUG_PIN: HwDef = { kind: "clip", len: 14, dia: 12 };
const PLINTH_FOOT: HwDef = { kind: "clip", len: 20, dia: 60 };
const PLINTH_T: HwDef = { kind: "clip", len: 20, dia: 76 };
const CAM_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const PUSH_BOLT: HwDef = { kind: "camScrew", len: 26, dia: 7 };
const CAM: HwDef = HW.cam;
const KNOB: HwDef = { kind: "knob", len: 25, dia: 30 };
const KNOB_SCREW: HwDef = { kind: "screw", len: 25, dia: 4 };
const STOP: HwDef = { kind: "clip", len: 6, dia: 30 };
const SHELF_PIN: HwDef = { kind: "pin", len: 16, dia: 5 };
const W_BRACKET: HwDef = { kind: "bracket", len: 60, dia: 40 };
const W_SCREW_IN: HwDef = { kind: "screw", len: 16, dia: 4.2 };
const W_WASHER: HwDef = { kind: "washer", len: 1.5, dia: 14 };
const W_SPACER: HwDef = { kind: "spacer", len: 20, dia: 30 };
const WALL_SCREW: HwDef = { kind: "screw", len: 70, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 40, dia: 8 };
const runnerOf = (len: number): HwDef => ({ kind: "runner", len: Math.round(len / 10) * 10, dia: 20 });

/* ---- the case ---- */

interface CaseGeo {
  W: number;
  H: number;
  D: number;
  t: number;
  G: number; // the gallery: how far the sides and the board along the back stand above the top
  P: number; // plinth height
  zb: number; // back face of the back, in its grooves
}

function caseGeo(s: ProductSpec, o: { t?: number; G?: number; P?: number } = {}): CaseGeo {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  return { W, H, D, t: o.t ?? 16, G: o.G ?? 50, P: o.P ?? 70, zb: -D / 2 + 10 };
}

/** A side: full height and depth, its top corner at the front cut down to the top. */
function sidePart(g: CaseGeo, id: string, x: number, o: { h?: number; y0?: number; gallery?: boolean } = {}): Part {
  const h = o.h ?? g.H, y0 = o.y0 ?? 0;
  const G = o.gallery === false ? 0 : g.G;
  const pieces: PartPiece[] = G
    ? [
        { shape: "box", size: [g.t, h - G, g.D], pos: [0, -G / 2, 0] },
        { shape: "box", size: [g.t, G, g.D - 90], pos: [0, h / 2 - G / 2, -45] },
      ]
    : [{ shape: "box", size: [g.t, h, g.D], pos: [0, 0, 0] }];
  return { id, name: "Side", size: [g.t, h, g.D], pos: [x, y0 + h / 2, 0], pieces };
}

/** A horizontal panel between the sides, its top face at `y`. */
const panel = (g: CaseGeo, id: string, name: string, y: number, o: { x0?: number; x1?: number; d?: number; z?: number } = {}): Part => {
  const x0 = o.x0 ?? -g.W / 2 + g.t, x1 = o.x1 ?? g.W / 2 - g.t;
  const d = o.d ?? g.D - 12;
  return { id, name, size: [x1 - x0, g.t, d], pos: [(x0 + x1) / 2, y - g.t / 2, o.z ?? g.D / 2 - d / 2] };
};

/* ---- drawers ---- */

interface Drawer {
  id: string;
  x: number; // centre of the opening
  w: number;
  y0: number; // bottom of the opening
  h: number;
  zf: number; // front face
  dd: number; // box depth behind the front
  knobs: 1 | 2;
  deep: boolean; // two dowels in each side instead of one
  rs?: number; // screws in each drawer runner
}

/** Drawers stacked in one column between yLo and yHi, top first: "s" shallow, "d" deep (a shallow one is about 0.7 of a deep one). */
function stack(pre: string, x: number, w: number, yLo: number, yHi: number, kinds: ("s" | "d")[], o: { zf: number; dd: number; knobs: 1 | 2; rs?: number }): Drawer[] {
  const unit = (yHi - yLo) / kinds.reduce((a, k) => a + (k === "s" ? 0.72 : 1), 0);
  let y = yHi;
  return kinds.map((kd, i) => {
    const h = unit * (kd === "s" ? 0.72 : 1);
    y -= h;
    return { id: `${pre}${i}`, x, w, y0: y, h, zf: o.zf, dd: o.dd, knobs: o.knobs, deep: kd === "d", rs: o.rs };
  });
}

function drawerParts(d: Drawer): Part[] {
  const ft = 16, st = 12;
  const xs = d.w / 2 - 13 - st / 2;
  const sh = Math.max(70, Math.min(d.h - 45, 230));
  const ys = d.y0 + 14;
  const zi = d.zf - ft;
  const zd = zi - d.dd / 2;
  return [
    { id: `${d.id}F`, name: "Drawer front", size: [d.w - 4, d.h - 4, ft], pos: [d.x, d.y0 + d.h / 2, d.zf - ft / 2] },
    { id: `${d.id}S0`, name: "Drawer side", size: [st, sh, d.dd], pos: [d.x - xs, ys + sh / 2, zd] },
    { id: `${d.id}S1`, name: "Drawer side", size: [st, sh, d.dd], pos: [d.x + xs, ys + sh / 2, zd] },
    { id: `${d.id}B`, name: "Drawer bottom", mat: "fiber", size: [2 * xs - st + 10, 4, d.dd - 14], pos: [d.x, ys + 10, zd - 7] },
    { id: `${d.id}K`, name: "Drawer back", size: [2 * xs - st, sh - 14, st], pos: [d.x, ys + 14 + (sh - 14) / 2, zi - d.dd + st / 2] },
  ];
}

const drawerIds = (d: Drawer) => ["F", "S0", "S1", "B", "K"].map((x) => d.id + x);

function drawerFits(k: ReturnType<typeof kit>, d: Drawer) {
  const id = (x: string) => d.id + x;
  const sd = k.box(id("S0"));
  const sh = sd.hi[1] - sd.lo[1];
  const inner = (si: 0 | 1): Face => (si ? "-x" : "+x");
  const per = <T,>(fn: (si: 0 | 1) => T[]) => [...fn(0), ...fn(1)];
  const zi = d.zf - 16;
  const zBk = k.box(id("K")).p.pos[2];
  const xs = Math.abs(sd.p.pos[0] - d.x);
  const ys = sd.lo[1];
  const pts = (fn: (si: 0 | 1, y: number) => Vec3, ys2: number[]) => per((si) => ys2.map((y) => fn(si, y)));
  const ends = [ys + 18, ys + sh - 18];
  const sgn = (si: 0 | 1) => (si ? 1 : -1);
  const runLen = d.dd - 20;
  return {
    bolts: { def: CAM_BOLT, at: pts((si, y) => [d.x + sgn(si) * xs, y, zi], ends), dir: [0, 0, 1] as Vec3, on: id("F"), mate: (p: Vec3) => (p[0] < d.x ? id("S0") : id("S1")) } as Fx,
    // seated in the front so they don't show through it; their other end goes into the side
    dowels: { def: T_DOWEL, at: pts((si, y) => [d.x + sgn(si) * xs, y, zi], d.deep ? [ys + sh * 0.38, ys + sh * 0.62] : [ys + sh / 2]), dir: [0, 0, 1] as Vec3, on: id("F"), mate: (p: Vec3) => (p[0] < d.x ? id("S0") : id("S1")) } as Fx,
    cams1: { def: CAM, at: pts((si, y) => [d.x + sgn(si) * (xs - 6), y, zi - 26], ends), dir: (p: Vec3) => [p[0] < d.x ? 1 : -1, 0, 0] as Vec3, on: (p: Vec3) => (p[0] < d.x ? id("S0") : id("S1")), hole: false } as Fx,
    push: { def: PUSH_BOLT, at: pts((si, y) => [d.x + sgn(si) * (xs + 6), y, zBk], ends), dir: (p: Vec3) => [p[0] < d.x ? 1 : -1, 0, 0] as Vec3, on: (p: Vec3) => (p[0] < d.x ? id("S0") : id("S1")), mate: id("K") } as Fx,
    cams2: { def: CAM, at: pts((si, y) => [d.x + sgn(si) * (xs - 6 - 24), y, zBk], ends), dir: [0, 0, 1] as Vec3, on: id("K"), hole: false } as Fx,
    stop: k.F(STOP, id("K"), "+y", 1, { hole: false }),
    runners: { def: runnerOf(runLen), at: per((si) => [[d.x + sgn(si) * xs, ys, zi - 10 - runLen / 2] as Vec3]), dir: [0, 1, 0] as Vec3, on: (p: Vec3) => (p[0] < d.x ? id("S0") : id("S1")), hole: false } as Fx,
    runnerScrews: { def: RUNNER_SCREW, at: per((si) => ((d.rs ?? 3) === 2 ? [0.15, 0.85] : [0.15, 0.5, 0.85]).map((f): Vec3 => [d.x + sgn(si) * (xs + 6), ys + 8, zi - 10 - runLen * f])), dir: (p: Vec3) => [p[0] < d.x ? 1 : -1, 0, 0] as Vec3, on: (p: Vec3) => (p[0] < d.x ? id("S0") : id("S1")) } as Fx,
    castors: { def: CASTOR, at: [-1, 1].flatMap((sg) => [zi - 60, zi - d.dd + 60].map((z): Vec3 => [d.x + sg * xs, ys, z])), dir: [0, 1, 0] as Vec3, on: (p: Vec3) => (p[0] < d.x ? id("S0") : id("S1")), hole: false } as Fx,
    castorScrews: { def: CASTOR_SCREW, at: [-1, 1].flatMap((sg) => [zi - 60, zi - d.dd + 60].flatMap((z) => [-12, 12].map((dz): Vec3 => [d.x + sg * xs, ys, z + dz]))), dir: [0, 1, 0] as Vec3, on: (p: Vec3) => (p[0] < d.x ? id("S0") : id("S1")) } as Fx,
    knobs: k.F(KNOB, id("F"), "+z", d.knobs, { a: 0.25, b: 0.75, along: 0, hole: false }),
    knobScrews: { ...k.F(KNOB_SCREW, id("F"), "-z", d.knobs, { a: 0.25, b: 0.75, along: 0 }), dir: [0, 0, 1] as Vec3 } as Fx,
    bottom: id("B"),
    runLen,
    inner,
  };
}

/** Cabinet runners on the inside of a side (or a divider), one for each drawer next to it. */
function caseRunners(k: ReturnType<typeof kit>, ds: Drawer[], sideOf: (d: Drawer, si: 0 | 1) => string, nScrews = 3) {
  const runners: Vec3[] = [], screws: Vec3[] = [], on: string[] = [], son: string[] = [], dirs: Vec3[] = [], sdirs: Vec3[] = [];
  for (const d of ds) {
    const len = d.dd - 20;
    for (const si of [0, 1] as const) {
      const sid = sideOf(d, si);
      const b = k.box(sid);
      const x = d.x < b.p.pos[0] ? b.lo[0] : b.hi[0];
      const sg = d.x < b.p.pos[0] ? 1 : -1; // into the side
      const y = d.y0 + 10, z = d.zf - 26 - len / 2;
      runners.push([x, y, z]);
      on.push(sid);
      dirs.push([sg, 0, 0]);
      for (const f of nScrews === 2 ? [-0.4, 0.4] : [-0.4, 0, 0.4]) {
        screws.push([x - sg * 2, y, z + len * f]); // through the runner's flange into the side
        son.push(sid);
        sdirs.push([sg, 0, 0]);
      }
    }
  }
  const def = runnerOf((ds[0]?.dd ?? 400) - 20);
  return {
    runners: { def, at: runners, dir: (_, i) => dirs[i], on: (_, i) => on[i], hole: false } as Fx,
    screws: { def: RUNNER_SCREW, at: screws, dir: (_, i) => sdirs[i], on: (_, i) => son[i] } as Fx,
  };
}

/**
 * The drawers: each size is shown being built once on its front (with "do this for each"), then all of them slide
 * in with their fittings in place.
 */
function drawerSteps(k: ReturnType<typeof kit>, ds: Drawer[], o: { stop?: boolean; word?: string; castors?: boolean } = {}): St[] {
  if (!ds.length) return [];
  const groups = new Map<string, Drawer[]>();
  for (const d of ds) {
    const key = `${Math.round(d.w)}x${Math.round(d.h)}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const shown = [...groups.values()].map((g) => g[0]);
  const fs = new Map(ds.map((d) => [d.id, drawerFits(k, d)]));
  const gap = Math.max(...shown.map((d) => d.w)) + 160;
  const offs = shown.map((_, i) => (i - (shown.length - 1) / 2) * gap);
  const rep = ds.length > 1 ? ds.length : undefined;
  const word = o.word ?? "drawer";
  const centre = (d: Drawer): Vec3 => {
    const s = k.box(d.id + "S0");
    return [d.x, (s.lo[1] + s.hi[1]) / 2, d.zf - 16 - d.dd / 2];
  };
  // lying on its front: turned a quarter about x, front face on the floor
  const flat = (ids: (d: Drawer) => string[], from?: Vec3, shift: (d: Drawer) => Vec3 = () => [0, 0, 0]): Op[] =>
    shown.map((d, i) => {
      const c = centre(d);
      const sh = shift(d);
      return { stage: ids(d), rot: [Math.PI / 2, 0, 0] as Vec3, pivot: c, at: [offs[i] + sh[0], d.zf - c[2] + sh[1], sh[2]] as Vec3, from: from ?? [0, 200, 0] };
    });
  const upright = (): Op[] =>
    shown.map((d, i) => {
      const c = centre(d);
      return { stage: drawerIds(d), pivot: c, at: [offs[i], (k.box(d.id + "F").hi[1] - k.box(d.id + "F").lo[1]) / 2 + 10, 0] as Vec3, from: [0, 0, 0] };
    });
  const each = (fn: (f: ReturnType<typeof drawerFits>) => Fx): Op[] => shown.map((d) => ({ fit: fn(fs.get(d.id)!) }));
  const st = (x: Omit<St, "scene" | "repeat">): St => ({ ...x, scene: "drawer", repeat: rep });
  const steps: St[] = [
    st({ title: `Screw the cam bolts into the ${word} front`, detail: "Lay the front face down on a rug. Four bolts, screwed in until they stop.", tools: ["screwdriver"], warnings: ["face"], ops: [...flat((d) => [d.id + "F"]), ...each((f) => f.bolts)] }),
    st({
      title: `Push the dowels into the ${word} sides`,
      detail: shown.some((d) => d.deep) && shown.some((d) => !d.deep) ? "One in the front end of each side on the shallow drawer, two on the deep ones." : shown[0].deep ? "Two in the front end of each side." : "One in the front end of each side.",
      ops: [...flat((d) => [d.id + "S0", d.id + "S1"], [0, 300, 0], (d) => [0, 30, d.dd * 0.6 + 120]), ...each((f) => f.dowels)],
    }),
    st({ title: "Stand the sides on the front", detail: "The grooves for the bottom face in, at the bottom edge.", kind: "join", ops: flat((d) => [d.id + "S0", d.id + "S1"], [0, 0, 0]) }),
    st({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then a clockwise turn until it pulls tight.", tools: ["screwdriver"], ops: each((f) => f.cams1) }),
    st({ title: `Slide in the ${word} bottom`, detail: "It runs down the grooves in the sides until it reaches the front.", kind: "join", ops: flat((d) => [d.id + "B"], [0, 0, -400]) }),
  ];
  if (o.stop) steps.push(st({ title: "Knock the drawer stop onto the back", detail: "It clips over the top edge of the back board, in the middle.", tools: ["hammer"], ops: [...flat((d) => [d.id + "K"], [0, 0, 0]), ...each((f) => f.stop)] }));
  steps.push(
    st({ title: `Lay the back on the ${word}`, detail: "Swing it down between the sides, onto the edge of the bottom.", kind: "join", ops: o.stop ? [{ pause: 0 }] : flat((d) => [d.id + "K"], [0, 260, 0]) }),
    st({ title: "Push in the cam bolts for the back", detail: "Four, through the holes in the sides into the ends of the back.", ops: each((f) => f.push) }),
    st({ title: "Lock the cam locks in the back", detail: "Arrow towards the bolt, then turn clockwise.", tools: ["screwdriver"], ops: each((f) => f.cams2) }),
    o.castors
      ? st({
          title: `Screw the castors under the ${word}`,
          detail: "One at each corner of the sides, two screws each.",
          tools: ["screwdriver"],
          kind: "screws",
          ops: [...upright(), ...each((f) => f.castors), ...each((f) => f.castorScrews)],
        })
      : st({
          title: "Screw the runners onto the drawer",
          detail: `Stand the drawer up. The left and right runners are marked: ${(shown[0].rs ?? 3) === 2 ? "two" : "three"} screws in each.`,
          tools: ["screwdriver"],
          kind: "runners",
          ops: [...upright(), ...each((f) => f.runners), ...each((f) => f.runnerScrews)],
        }),
    st({
      title: shown.every((d) => d.knobs === 1) ? "Screw on the knob" : "Screw on the knobs",
      detail: "The screw goes in from inside the drawer. Snug is enough.",
      tools: ["screwdriver"],
      kind: "screws",
      ops: [...each((f) => f.knobs), ...each((f) => f.knobScrews)],
    }),
  );
  const rest = ds.filter((d) => !shown.includes(d));
  const presets = (d: Drawer): Op[] => {
    const f = fs.get(d.id)!;
    return [f.bolts, f.dowels, f.cams1, ...(o.stop ? [f.stop] : []), f.push, f.cams2, ...(o.castors ? [f.castors, f.castorScrews] : [f.runners, f.runnerScrews]), f.knobs, f.knobScrews].map((x) => ({ preset: x }));
  };
  steps.push({
    title: o.castors ? (ds.length > 1 ? `Roll in the ${word}s` : `Roll in the ${word}`) : ds.length > 2 ? `Slide in all ${ds.length} ${word}s` : ds.length === 2 ? `Slide in both ${word}s` : `Slide in the ${word}`,
    detail: o.castors ? "It runs on its castors under the bottom of the frame." : "Rest the runners on the ones in the case and push until it closes. Open only one at a time.",
    kind: "drawer",
    warnings: ["tip"],
    ops: [{ add: ds.flatMap(drawerIds), from: [0, 0, 520] }, ...rest.flatMap(presets)],
  });
  return steps;
}

/** A side laid flat on the rug, inside face up, for its runners. */
function flatSides(ids: string[], k: ReturnType<typeof kit>, D: number): Op[] {
  return ids.map((id, i) => {
    const b = k.box(id);
    const c = b.p.pos;
    const inner = c[0] < 0 ? 1 : -1; // the inside faces +x on the left side
    return { stage: [id], rot: [0, 0, inner * (Math.PI / 2)] as Vec3, pivot: c, at: [(i - (ids.length - 1) / 2) * (D * 0 + 0), 8, (i - (ids.length - 1) / 2) * (D + 120)] as Vec3, from: [0, 200, 0] };
  });
}

/* ---- the chest of 3 drawers ---- */

function chest3(b: PlanBuilder, s: ProductSpec) {
  const g = caseGeo(s);
  const { W, H, D, t, G, P } = g;
  const yTop = H - G; // top face of the top
  const yBot = P + t; // top face of the bottom
  const inner = yTop - t - yBot;
  const zf = D / 2;
  const shallow = Math.round((inner - 3 * 4) * 0.27);
  const deep = (inner - shallow) / 2;
  const ds: Drawer[] = [
    { id: "D0", x: 0, w: W - 2 * t, y0: yTop - t - shallow, h: shallow, zf, dd: D - 70, knobs: 2, deep: false },
    { id: "D1", x: 0, w: W - 2 * t, y0: yBot + deep, h: deep, zf, dd: D - 70, knobs: 2, deep: true },
    { id: "D2", x: 0, w: W - 2 * t, y0: yBot, h: deep, zf, dd: D - 70, knobs: 2, deep: true },
  ];
  const bw = W - 2 * t + 16;
  const yMid = ds[1].y0; // the rail at the back between the deep drawers
  const parts: Part[] = [
    sidePart(g, "S0", -W / 2 + t / 2),
    sidePart(g, "S1", W / 2 - t / 2),
    panel(g, "TOP", "Top", yTop),
    panel(g, "BOT", "Bottom", yBot, { d: D - 40 }),
    { id: "RT", name: "Back rail", size: [W - 2 * t, 70, t], pos: [0, yTop - t - 35, g.zb + 12 + t / 2] },
    { id: "BB0", name: "Back board", size: [bw, yMid - P, 12], pos: [0, (yMid + P) / 2, g.zb + 6] },
    { id: "BB1", name: "Back board", size: [bw, yTop - t - 70 - yMid, 12], pos: [0, (yTop - t - 70 + yMid) / 2, g.zb + 6] },
    { id: "PL", name: "Plinth rail", size: [W - 2 * t, P, t], pos: [0, P / 2, zf - 30 - t / 2] },
    { id: "GB", name: "Gallery board", size: [W - 2 * t, G, t], pos: [0, yTop + G / 2, g.zb + 12 + t / 2] },
    { id: "MR", name: "Back shelf", size: [W - 2 * t, t, 90], pos: [0, yMid - t / 2 - 4, g.zb + 12 + 45] },
    ...ds.flatMap(drawerParts),
  ];
  const k = kit(parts);
  const { F, FF } = k;
  const run1 = caseRunners(k, ds, (_, si) => (si ? "S1" : "S0"));
  const back: Vec3 = [0, 0, -260]; // lying on its front: up is the back
  const steps: St[] = [
    {
      title: "Screw the cabinet runners onto both sides",
      detail: "Lay the sides on a rug, inside up. The right and left runners are marked: three screws each.",
      scene: "prep",
      tools: ["screwdriver"],
      warnings: ["floor"],
      kind: "runners",
      ops: [...flatSides(["S0", "S1"], k, D), { fit: run1.runners }, { fit: run1.screws }],
    },
    {
      title: "Click the top and the bottom into one side",
      detail: "Stand the right side on its front edge. Push each panel's connectors into the holes and press down until it clicks.",
      pose: "-z",
      kind: "join",
      ops: [{ add: ["S1"], from: [200, 0, 0] }, { add: ["TOP", "BOT"], from: [-300, 0, 0] }],
    },
    { title: "Click the other side on", detail: "Press it on at each connector until you hear it click.", pose: "-z", ops: [{ add: ["S0"], from: [-300, 0, 0] }] },
    {
      title: "Push the dowels in along the back",
      detail: "Ten in all, into the holes near the back edges of the sides, the top and the bottom.",
      pose: "-z",
      ops: [{ fit: FF(T_DOWEL, [["S0", "+x", 3, { v: 0.06, a: 0.12, b: 0.8 }], ["S1", "-x", 3, { v: 0.06, a: 0.12, b: 0.8 }], ["TOP", "-y", 2, { v: 0.05, along: 0, a: 0.2, b: 0.8 }], ["BOT", "+y", 2, { v: 0.05, along: 0, a: 0.2, b: 0.8 }]]) }],
    },
    { title: "Push two dowels into the back rail", detail: "One in each end.", scene: "rail", ops: [{ stage: ["RT"], pivot: k.box("RT").p.pos, at: [0, 35, 0] }, { fit: FF(T_DOWEL, [["RT", "-x", 1], ["RT", "+x", 1]]) }] },
    { title: "Drop the back rail in under the top", detail: "Its dowels go into the sides. It sits against the underside of the top.", pose: "-z", ops: [{ add: ["RT"], from: back }] },
    {
      title: "Clip the back rail to the top",
      detail: "Two two-part clips: push one half into each panel and press them together.",
      pose: "-z",
      ops: [{ fit: F(CLICK_A, "RT", "+y", 2, { a: 0.25, b: 0.75, hole: false }) }, { fit: F(CLICK_B, "TOP", "-y", 2, { a: 0.25, b: 0.75, v: 0.07, along: 0, hole: false }) }],
    },
    {
      title: "Join the back boards with the big dowels",
      detail: "Two thick dowels in the edge of one board, then push the other board onto them.",
      scene: "back",
      ops: [
        { stage: ["BB0"], rot: [-Math.PI / 2, 0, 0], pivot: k.box("BB0").p.pos, at: [0, 6, 0] },
        { fit: F(BIG_DOWEL, "BB0", "+y", 2, { a: 0.25, b: 0.75 }) },
        { stage: ["BB1"], rot: [-Math.PI / 2, 0, 0], pivot: k.box("BB0").p.pos, at: [0, 6, 0], from: [0, 0, 300] },
      ],
    },
    { title: "Slide the back boards into the grooves", detail: "In from the bottom end, along the grooves in both sides, until they meet the back rail.", pose: "-z", kind: "join", ops: [{ add: ["BB0", "BB1"], from: [0, -400, 0] }] },
    {
      title: "Lock the back to the bottom with push pins",
      detail: "Push a sleeve into each hole, then press the pin into it until it is flush.",
      pose: "-z",
      ops: [{ fit: F(SLEEVE, "BB0", "-z", 2, { a: 0.2, b: 0.8, v: 0.06, mate: "BOT" }) }, { fit: F(LOCK_PIN, "BB0", "-z", 2, { a: 0.2, b: 0.8, v: 0.06, hole: false }) }],
    },
    {
      title: "Clip the back boards to the back rail",
      detail: "Two more two-part clips, one half in each part.",
      pose: "-z",
      ops: [{ fit: F(CLICK_A, "BB1", "+z", 2, { a: 0.25, b: 0.75, v: 0.96, hole: false }) }, { fit: F(CLICK_B, "RT", "+z", 2, { a: 0.25, b: 0.75, v: 0.1, hole: false }) }],
    },
    {
      title: "Push the plinth rail in",
      detail: "Two dowels in its top edge first, no hammer. It pushes onto the bottom, set back from the front.",
      pose: "-z",
      ops: [{ fit: F(T_DOWEL, "PL", "+y", 2, { a: 0.1, b: 0.9, mate: "BOT" }) }, { add: ["PL"], from: [0, -300, 0] }],
    },
    {
      title: "Click in the plinth brackets",
      detail: "Two straight ones at the ends and two T-shaped ones in between, under the bottom and against the plinth rail.",
      pose: "-z",
      ops: [{ fit: F(PLINTH_FOOT, "BOT", "-y", 2, { a: 0.06, b: 0.94, along: 0, v: 0.9, hole: false }) }, { fit: F(PLINTH_T, "BOT", "-y", 2, { a: 0.35, b: 0.65, along: 0, v: 0.9, hole: false }) }],
    },
    { title: "Stand the chest up", detail: "Lift it upright onto its plinth.", pose: "+y", kind: "standup", ops: [] },
    { title: "Push three dowels into the gallery board", detail: "Into the holes in its bottom edge, without a hammer.", scene: "rail", ops: [{ stage: ["GB"], pivot: k.box("GB").p.pos, at: [0, G / 2 + 20, 0] }, { fit: F(T_DOWEL, "GB", "-y", 3) }] },
    { title: "Press the gallery board onto the top", detail: "Along the back edge, between the sides.", ops: [{ add: ["GB"], from: [0, 200, 0] }] },
    {
      title: "Screw the sides to the gallery board",
      detail: "A screw-in plug through each side into the board, then the cover pin.",
      tools: ["screwdriver"],
      ops: [{ fit: FF(PLUG_SCREW, [["S0", "-x", 1, { v: 0.94, along: 2, a: 0.04, b: 0.04 }], ["S1", "+x", 1, { v: 0.94, along: 2, a: 0.04, b: 0.04 }]]) }],
    },
    {
      title: "Clip the back boards to the sides",
      detail: "Six two-part clips from the front, three each side, where the back boards meet the sides.",
      ops: [
        { fit: FF(CLICK_A, [["S0", "+x", 3, { v: 0.06, along: 1, a: 0.2, b: 0.7 }], ["S1", "-x", 3, { v: 0.06, along: 1, a: 0.2, b: 0.7 }]]) },
        { fit: FF(CLICK_B, [["BB0", "+z", 2, { a: 0.02, b: 0.98, along: 0, v: 0.5, hole: false }], ["BB1", "+z", 4, { a: 0.02, b: 0.98, along: 0, v: 0.5, hole: false }]]) },
      ],
    },
    { title: "Push four dowels into the back boards", detail: "In a row along the joint between the boards, for the back shelf.", ops: [{ fit: F(T_DOWEL, "BB0", "+z", 4, { v: 0.98, along: 0 }) }] },
    {
      title: "Slide in the back shelf and pin it",
      detail: "Push it back onto the dowels, then a sleeve and a pin through each side into its ends.",
      ops: [
        { add: ["MR"], from: [0, 0, 400] },
        { fit: FF(SLEEVE, [["S0", "-x", 1, { along: 2, a: 0.12, b: 0.12, v: (yMid - 12) / H }], ["S1", "+x", 1, { along: 2, a: 0.12, b: 0.12, v: (yMid - 12) / H }]]) },
        { fit: FF(LOCK_PIN, [["S0", "-x", 1, { along: 2, a: 0.12, b: 0.12, v: (yMid - 12) / H, hole: false, out: 1 }], ["S1", "+x", 1, { along: 2, a: 0.12, b: 0.12, v: (yMid - 12) / H, hole: false, out: 1 }]]) },
      ],
    },
    ...wallSteps(k, "BB1", { H, D, x: 0 }),
    ...drawerSteps(k, ds, { stop: true }),
  ];
  run(b, parts, steps);
  return true;
}

/**
 * Fixing it to the wall: a bracket screwed to the back, the chest pushed against the wall and a screw through the
 * bracket into it. HAUGA's box has the screw and plug; check they suit your wall.
 */
function wallSteps(k: ReturnType<typeof kit>, on: string, o: { H: number; D: number; x: number; n?: number; spacers?: string[] }): St[] {
  const n = o.n ?? 1;
  const bx = k.box(on);
  const xs = n === 1 ? [o.x] : spread(bx.lo[0] + 120, bx.hi[0] - 120, n);
  const y = bx.hi[1] - 40;
  const z = bx.lo[2];
  const steps: St[] = [];
  if (o.spacers?.length)
    steps.push({
      title: "Screw the wall spacers into the back",
      detail: "One near the top of each side. Turn them out until they touch the wall when it stands straight.",
      ops: [{ fit: { def: W_SPACER, at: o.spacers.map((id) => { const b = k.box(id); return [b.p.pos[0], b.hi[1] - 120, b.lo[2]] as Vec3; }), dir: [0, 0, 1], on: (_, i) => o.spacers![i], hole: false } }],
    });
  steps.push(
    {
      title: n > 1 ? "Screw the wall brackets to the back" : "Screw the wall bracket to the back",
      detail: "Near the top, folded flat against the back for now. A washer under the screw.",
      tools: ["screwdriver"],
      kind: "anchor",
      ops: [
        { fit: { def: W_BRACKET, at: xs.map((x): Vec3 => [x, y, z]), dir: [0, 0, 1], on, hole: false } },
        { fit: { def: W_WASHER, at: xs.map((x): Vec3 => [x, y - 10, z - 2]), dir: [0, 0, 1], on, hole: false } },
        { fit: { def: W_SCREW_IN, at: xs.map((x): Vec3 => [x, y - 10, z - 3.5]), dir: [0, 0, 1], on } },
      ],
    },
    {
      title: "Push it against the wall and screw the bracket on",
      detail: "Mark the wall through the bracket, drill and plug the hole, then screw through the bracket into the wall.",
      tools: ["drill", "pencil", "screwdriver"],
      kind: "anchor",
      wall: true,
      warnings: ["wall", "tip"],
      ops: [
        { fit: { def: WALL_PLUG, at: xs.map((x): Vec3 => [x, y + 40, z - 40]), dir: [0, 0, -1], hole: false } },
        { fit: { def: WALL_SCREW, at: xs.map((x): Vec3 => [x, y + 40, z - 36]), dir: [0, 0, -1] } },
      ],
    },
  );
  void o.H;
  void o.D;
  return steps;
}

/* ---- the other cases: one sequence of the manual's steps per product ---- */

interface Hutch {
  h: number; // height of its sides
  d: number; // depth
  shelves: number[]; // loose shelves on pins: heights of their top faces above the case top
}
interface Door {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  hingeX: number; // the side the hinges are on
  glass?: boolean;
}

type Phase =
  | { p: "runners"; screws?: number }
  | { p: "click"; what: "tb" | "div" | "side" | "fixed" }
  | { p: "clips"; n: number; on?: "back" | "top" | "fixed" | "plinth"; single?: boolean }
  | { p: "backRail"; dowels: number }
  | { p: "plugs"; n: number; into: string }
  | { p: "back" }
  | { p: "boards"; dowels: number }
  | { p: "pins"; n: number; into?: string }
  | { p: "plinth"; dowels: number; rails?: 1 | 2 }
  | { p: "feet"; straight: number; t: number }
  | { p: "stand" }
  | { p: "gallery"; dowels: number; fix: number; screws?: boolean }
  | { p: "hutch"; dowels: number; plates: number; clips: number }
  | { p: "spacers"; n: number }
  | { p: "wall"; n: number; on?: string }
  | { p: "shelves"; pinsPer?: number }
  | { p: "drawers" }
  | { p: "rollers"; plates?: number }
  | { p: "topBolts"; n: number }
  | { p: "tracks" }
  | { p: "slide"; stops: number }
  | { p: "rails" }
  | { p: "doors"; plateScrews: number; hingeScrews: number };

interface Cfg {
  g: CaseGeo;
  dividers?: number[];
  fixed?: { id: string; y: number; x0?: number; x1?: number; d?: number; name?: string }[];
  loose?: { id: string; y: number; x0?: number; x1?: number; d?: number }[];
  drawers?: Drawer[];
  doors?: Door[];
  sliders?: Door[]; // sliding doors: the first runs in the back channel, the second in the front one
  rails?: { id: string; x0: number; x1: number; y: number }[]; // clothes rails
  hutch?: Hutch;
  bay?: number; // an open bay under the bottom for a drawer on castors, instead of a plinth
  rollers?: Drawer[]; // drawers on castors in the bay
  noGallery?: boolean; // the case top carries a hutch instead
  stop?: boolean;
  word?: string;
  knobScrewOut?: boolean;
  seq: Phase[];
  extra?: (k: ReturnType<typeof kit>, parts: Part[]) => { parts?: Part[]; steps?: St[] };
}

const PLATE: HwDef = { kind: "connector", len: 120, dia: 30 };
const TOP_BOLT: HwDef = { kind: "bolt", len: 70, dia: 6 };
const CASTOR: HwDef = { kind: "castor", len: 45, dia: 40 };
const CASTOR_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const PLATE_SCREW: HwDef = { kind: "screw", len: 13, dia: 4 };
const HINGE: HwDef = { kind: "hinge", len: 50, dia: 35 };
const HINGE_PLATE: HwDef = { kind: "clip", len: 8, dia: 36 };
const DOOR_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const LONG_DOWEL: HwDef = { kind: "dowel", len: 60, dia: 10 };

function doorPart(d: Door, z: number): Part {
  const w = d.x1 - d.x0, h = d.y1 - d.y0, fr = 60;
  const pieces: PartPiece[] = [
    { shape: "box", size: [w, fr, 18], pos: [0, h / 2 - fr / 2, 0] },
    { shape: "box", size: [w, fr, 18], pos: [0, -h / 2 + fr / 2, 0] },
    { shape: "box", size: [fr, h - 2 * fr, 18], pos: [-w / 2 + fr / 2, 0, 0] },
    { shape: "box", size: [fr, h - 2 * fr, 18], pos: [w / 2 - fr / 2, 0, 0] },
    { shape: "box", size: [w - 2 * fr, h - 2 * fr, d.glass ? 4 : 10], pos: [0, 0, -4], material: d.glass ? "fiber" : undefined },
  ];
  return { id: d.id, name: d.glass ? "Glass door" : "Door", size: [w, h, 18], pos: [(d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, z - 9], pieces };
}

function caseBuild(b: PlanBuilder, s: ProductSpec, c: Cfg) {
  const { g } = c;
  const { W, H, D, t, G, P } = g;
  const hh = c.hutch?.h ?? 0;
  const caseH = H - hh;
  const gal = c.noGallery ? 0 : G;
  const yTop = caseH - gal;
  const yBot = (c.bay ?? P) + t;
  const zf = D / 2;
  const word = c.word ?? "chest";
  const parts: Part[] = [
    sidePart(g, "S0", -W / 2 + t / 2, { h: caseH, gallery: !c.noGallery }),
    sidePart(g, "S1", W / 2 - t / 2, { h: caseH, gallery: !c.noGallery }),
    panel(g, "TOP", "Top", yTop),
    panel(g, "BOT", "Bottom", yBot, { d: D - 40 }),
  ];
  const uses = (x: Phase["p"]) => c.seq.some((q) => q.p === x);
  if (uses("plinth")) parts.push({ id: "PL", name: "Plinth rail", size: [W - 2 * t, P, t], pos: [0, P / 2, zf - 30 - t / 2] });
  const yb0 = c.bay ? yBot - t : P;
  if (uses("back")) parts.push({ id: "BK", name: "Back panel", mat: "fiber", size: [W - 2 * t + 16, yTop - yb0, 4], pos: [0, (yTop + yb0) / 2, g.zb + 2] });
  if (!c.noGallery && uses("gallery")) parts.push({ id: "GB", name: "Gallery board", size: [W - 2 * t, G, t], pos: [0, yTop + G / 2, g.zb + 4 + t / 2] });
  (c.dividers ?? []).forEach((x, i) => parts.push({ id: `DV${i}`, name: "Divider", size: [t, yTop - t - yBot, D - 16], pos: [x, (yTop - t + yBot) / 2, 4] }));
  for (const f of c.fixed ?? []) parts.push(panel(g, f.id, f.name ?? "Shelf", f.y, { x0: f.x0, x1: f.x1, d: f.d ?? D - 20, z: f.d ? g.zb + 4 + f.d / 2 : undefined }));
  for (const f of c.loose ?? []) parts.push(panel(g, f.id, "Shelf", f.y, { x0: f.x0, x1: f.x1, d: f.d ?? D - 40, z: g.zb + 6 + (f.d ?? D - 40) / 2 }));
  if (c.hutch) {
    const hu = c.hutch;
    const zh = g.zb + hu.d / 2 - 2;
    const hg: CaseGeo = { ...g, D: hu.d };
    const hs = (id: string, x: number): Part => ({ ...sidePart(hg, id, x, { h: hh, y0: caseH }), pos: [x, caseH + hh / 2, zh], name: "Shelf unit side" });
    parts.push(hs("HS0", -W / 2 + t / 2), hs("HS1", W / 2 - t / 2));
    const hTop = H - G;
    parts.push({ id: "HT", name: "Shelf unit top", size: [W - 2 * t, t, hu.d - 4], pos: [0, hTop - t / 2, zh + 2] });
    parts.push({ id: "HG", name: "Gallery board", size: [W - 2 * t, G, t], pos: [0, hTop + G / 2, g.zb + 4 + t / 2] });
    parts.push({ id: "HB", name: "Back panel", mat: "fiber", size: [W - 2 * t + 16, hTop - caseH, 4], pos: [0, (hTop + caseH) / 2, g.zb + 2] });
    hu.shelves.forEach((y, i) => parts.push({ id: `HL${i}`, name: "Shelf", size: [W - 2 * t - 2, t, hu.d - 30], pos: [0, caseH + y - t / 2, zh + 10] }));
  }
  const ds = c.drawers ?? [];
  parts.push(...ds.flatMap(drawerParts));
  parts.push(...(c.rollers ?? []).flatMap(drawerParts));
  const doorZ = zf;
  for (const d of c.doors ?? []) parts.push(doorPart(d, doorZ));
  const slideZ = [zf - 34, zf - 10];
  (c.sliders ?? []).forEach((d, i) => parts.push(doorPart(d, slideZ[i] + 9)));
  if (c.sliders?.length) {
    parts.push({ id: "TB", name: "Bottom track", mat: "metal", size: [W - 2 * t, 8, 50], pos: [0, yBot + 4, zf - 30] });
    parts.push({ id: "TT", name: "Top track", mat: "metal", size: [W - 2 * t, 10, 50], pos: [0, yTop - t - 5, zf - 30] });
  }
  for (const r of c.rails ?? []) parts.push({ id: r.id, name: "Clothes rail", mat: "metal", shape: "cyl", size: [20, r.x1 - r.x0, 20], pos: [(r.x0 + r.x1) / 2, r.y, 0], rot: [0, 0, Math.PI / 2] });
  const k0 = kit(parts);
  const ex = c.extra?.(k0, parts);
  if (ex?.parts) parts.push(...ex.parts);
  const k = kit(parts);
  const { F, FF } = k;
  const has = (id: string) => k.by.has(id);
  const back: Vec3 = [0, 0, -260];
  const divs = (c.dividers ?? []).map((_, i) => `DV${i}`);
  const fixedIds = (c.fixed ?? []).map((f) => f.id);
  // which panel each drawer runs against, left and right
  const walls = ["S0", ...divs, "S1"].map((id) => ({ id, x: k.box(id).p.pos[0] })).sort((a, b) => a.x - b.x);
  const sideOf = (d: Drawer, si: 0 | 1) => {
    const left = [...walls].reverse().find((w) => w.x < d.x)!;
    const right = walls.find((w) => w.x > d.x)!;
    return si ? right.id : left.id;
  };
  const steps: St[] = [];
  const pose: Pose = "-z";
  let stood = false;
  for (const ph of c.seq) {
    const ps: Pose = stood ? "+y" : pose;
    switch (ph.p) {
      case "runners": {
        const r = caseRunners(k, ds, sideOf, ph.screws ?? 3);
        const ids = [...new Set(ds.flatMap((d) => [sideOf(d, 0), sideOf(d, 1)]))];
        steps.push({
          title: divs.length ? "Screw the cabinet runners onto the sides and the divider" : "Screw the cabinet runners onto both sides",
          detail: `Lay the panels on a rug, inside up. Right and left runners are marked: ${ph.screws ?? 3} screws each.`,
          scene: "prep",
          tools: ["screwdriver"],
          warnings: ["floor"],
          kind: "runners",
          ops: [...flatSides(ids, k, D), { fit: r.runners }, { fit: r.screws }],
        });
        break;
      }
      case "click":
        if (ph.what === "tb")
          steps.push({
            title: fixedIds.length && !divs.length ? "Click the top, the shelf and the bottom into one side" : "Click the top and the bottom into one side",
            detail: "Stand the right side on its front edge. Push each panel's connectors into the holes and press down until it clicks.",
            pose: ps,
            kind: "join",
            ops: [{ add: ["S1"], from: [200, 0, 0] }, { add: ["TOP", "BOT", ...(divs.length ? [] : fixedIds)], from: [-300, 0, 0] }],
          });
        else if (ph.what === "div")
          steps.push({
            title: divs.length > 1 ? "Click the dividers in" : "Click the divider in",
            detail: "Between the top and the bottom, runners facing the right way. Press until it clicks.",
            pose: ps,
            kind: "join",
            ops: [{ add: divs, from: [0, 0, -300] }],
          });
        else if (ph.what === "fixed")
          steps.push({ title: fixedIds.length > 1 ? "Click in the fixed shelves" : "Click in the fixed shelf", detail: "Push it onto its connectors until it clicks.", pose: ps, kind: "join", ops: [{ add: fixedIds, from: [-300, 0, 0] }] });
        else steps.push({ title: "Click the other side on", detail: "Press it on at each connector until you hear it click.", pose: ps, ops: [{ add: ["S0"], from: [-300, 0, 0] }] });
        break;
      case "clips": {
        const at = ph.on === "plinth" ? "PL" : ph.on === "fixed" ? fixedIds[0] : ph.on === "top" ? "TOP" : "BK";
        const ops: Op[] =
          at === "BK"
            ? [
                { fit: FF(CLICK_A, [["S0", "+x", Math.ceil(ph.n / 2), { v: 0.04, along: 1 }], ["S1", "-x", Math.floor(ph.n / 2), { v: 0.04, along: 1 }]]) },
                ...(ph.single ? [] : [{ fit: F(CLICK_B, "BK", "+z", ph.n, { a: 0.02, b: 0.98, along: 0, hole: false }) } as Op]),
              ]
            : [
                { fit: F(CLICK_A, at, at === "PL" ? "-z" : "-y", ph.n, { v: at === "PL" ? 0.5 : 0.06, along: 0, hole: false }) },
                ...(ph.single ? [] : [{ fit: F(CLICK_B, at, at === "PL" ? "-z" : "-y", ph.n, { v: at === "PL" ? 0.5 : 0.08, along: 0, hole: false, out: 3 }) } as Op]),
              ];
        steps.push({
          title: ph.single ? "Push in the plastic clips" : "Fit the two-part clips",
          detail: ph.single ? `${ph.n} of them, into the holes along the back edges.` : `${ph.n} pairs: one half into each panel, then press them together until they click.`,
          pose: ps,
          ops,
        });
        break;
      }
      case "backRail": {
        parts.push({ id: "RT", name: "Back rail", size: [W - 2 * t, 70, t], pos: [0, yTop - t - 35, g.zb + 6 + t / 2] });
        k.by.set("RT", parts[parts.length - 1]);
        steps.push({ title: "Push two dowels into the back rail", detail: "One in each end, without a hammer.", scene: "rail", ops: [{ stage: ["RT"], pivot: k.box("RT").p.pos, at: [0, 35, 0] }, { fit: FF(T_DOWEL, [["RT", "-x", 1], ["RT", "+x", 1]]) }] });
        steps.push({ title: "Drop the back rail in under the top", detail: "Its dowels go into the sides, against the underside of the top.", pose: ps, ops: [{ add: ["RT"], from: back }] });
        break;
      }
      case "plugs":
        steps.push({
          title: "Screw the plastic plugs through the sides",
          detail: "One through each side into the end of the rail. Turn them in by hand with a screwdriver.",
          pose: ps,
          tools: ["screwdriver"],
          ops: [{ fit: FF(PLUG_SCREW, [["S0", "-x", ph.n / 2, { along: 2, a: 0.03, b: 0.03, v: (k.box(ph.into).p.pos[1]) / caseH }], ["S1", "+x", ph.n / 2, { along: 2, a: 0.03, b: 0.03, v: k.box(ph.into).p.pos[1] / caseH }]]) }],
        });
        break;
      case "back":
        steps.push({ title: "Slide the back panel into the grooves", detail: "Finished side in, from the bottom end, along the grooves in both sides until it stops.", pose: ps, kind: "join", ops: [{ add: ["BK"], from: [0, -500, 0] }] });
        break;
      case "pins": {
        const into = ph.into ?? "BOT";
        const y = k.box(into).p.pos[1];
        const yy = (y - k.box("BK").lo[1]) / (k.box("BK").hi[1] - k.box("BK").lo[1]);
        steps.push({
          title: into === "BOT" ? "Lock the back to the bottom with push pins" : "Lock the back with push pins",
          detail: "Push a sleeve into each hole through the back, then press its pin in until it is flush.",
          pose: ps,
          ops: [{ fit: F(SLEEVE, "BK", "-z", ph.n, { along: 0, a: 0.15, b: 0.85, v: Math.max(0.02, Math.min(0.98, yy)), mate: into }) }, { fit: F(LOCK_PIN, "BK", "-z", ph.n, { along: 0, a: 0.15, b: 0.85, v: Math.max(0.02, Math.min(0.98, yy)), hole: false, out: 2 }) }],
        });
        break;
      }
      case "boards":
        break;
      case "plinth":
        if (ph.rails === 2 && !has("PB")) {
          parts.push({ id: "PB", name: "Back plinth rail", size: [W - 2 * t, P, t], pos: [0, P / 2, g.zb + 6 + t / 2] });
          k.by.set("PB", parts[parts.length - 1]);
          steps.push({
            title: "Push the dowels into the plinth rails",
            detail: `${ph.dowels / 2} in each rail, along its top edge, without a hammer.`,
            scene: "rail",
            ops: [{ stage: ["PL"], pivot: k.box("PL").p.pos, at: [0, P / 2, -120] }, { stage: ["PB"], pivot: k.box("PB").p.pos, at: [0, P / 2, 120] }, { fit: FF(T_DOWEL, [["PL", "+y", ph.dowels / 2], ["PB", "+y", ph.dowels / 2]]) }],
          });
          steps.push({ title: "Push the plinth rails in under the bottom", detail: "One at the front, set back from the edge, and one at the back.", pose: ps, ops: [{ add: ["PL", "PB"], from: [0, -300, 0] }] });
          break;
        }
        steps.push({
          title: "Push the plinth rail in",
          detail: `${ph.dowels} dowels in its top edge first, no hammer. It pushes onto the bottom, set back from the front.`,
          pose: ps,
          ops: [{ fit: F(T_DOWEL, "PL", "+y", ph.dowels, { a: 0.1, b: 0.9, mate: "BOT" }) }, { add: ["PL"], from: [0, -300, 0] }],
        });
        break;
      case "feet":
        steps.push({
          title: "Click in the plinth brackets",
          detail: `${ph.straight} straight ones at the ends and ${ph.t} T-shaped ones between them, under the bottom and against the plinth rail.`,
          pose: ps,
          ops: [
            { fit: F(PLINTH_FOOT, "BOT", "-y", ph.straight, { a: 0.05, b: 0.95, along: 0, v: 0.9, hole: false }) },
            { fit: F(PLINTH_T, "BOT", "-y", ph.t, { a: ph.t > 1 ? 0.3 : 0.5, b: ph.t > 1 ? 0.7 : 0.5, along: 0, v: 0.9, hole: false }) },
          ],
        });
        break;
      case "stand":
        steps.push({ title: `Stand the ${word} up`, detail: "Lift it upright onto its plinth.", pose: "+y", kind: "standup", people: W > 1200 || H > 1500 ? 2 : 1, ops: [] });
        stood = true;
        break;
      case "gallery": {
        const gb = c.hutch ? "HG" : "GB";
        const sides = c.hutch ? ["HS0", "HS1"] : ["S0", "S1"];
        const top = c.hutch ? H : caseH;
        const v = (top - G / 2) / H;
        steps.push(
          { title: `Push ${ph.dowels} dowels into the gallery board`, detail: "Into the holes in its bottom edge, without a hammer.", scene: "rail", ops: [{ stage: [gb], pivot: k.box(gb).p.pos, at: [0, G / 2 + 20, 0] }, { fit: F(T_DOWEL, gb, "-y", ph.dowels) }] },
          { title: "Press the gallery board onto the top", detail: "Along the back edge, between the sides.", pose: ps, ops: [{ add: [gb], from: stood ? [0, 200, 0] : back }] },
        );
        const sv = (id: string) => (top - G / 2 - k.box(id).lo[1]) / (k.box(id).hi[1] - k.box(id).lo[1]);
        void v;
        steps.push({
          title: "Fix the sides to the gallery board",
          detail: ph.screws ? "A screw-in plug through each side into the board." : "A sleeve through each side into the board, then its pin.",
          pose: ps,
          tools: ph.screws ? ["screwdriver"] : [],
          ops: ph.screws
            ? [{ fit: FF(PLUG_SCREW, [[sides[0], "-x", ph.fix / 2, { along: 2, a: 0.04, b: 0.04, v: sv(sides[0]) }], [sides[1], "+x", ph.fix / 2, { along: 2, a: 0.04, b: 0.04, v: sv(sides[1]) }]]) }]
            : [
                { fit: FF(SLEEVE, [[sides[0], "-x", ph.fix / 2, { along: 2, a: 0.04, b: 0.04, v: sv(sides[0]) }], [sides[1], "+x", ph.fix / 2, { along: 2, a: 0.04, b: 0.04, v: sv(sides[1]) }]]) },
                { fit: FF(LOCK_PIN, [[sides[0], "-x", ph.fix / 2, { along: 2, a: 0.04, b: 0.04, v: sv(sides[0]), hole: false, out: 2 }], [sides[1], "+x", ph.fix / 2, { along: 2, a: 0.04, b: 0.04, v: sv(sides[1]), hole: false, out: 2 }]]) },
              ],
        });
        break;
      }
      case "hutch": {
        steps.push(
          {
            title: "Click the shelf unit's top between its sides",
            detail: "Lay one side on the rug, click the top into it, then click the other side on.",
            scene: "hutch",
            ops: [{ stage: ["HS1", "HT", "HS0"], rot: [-Math.PI / 2, 0, 0], pivot: [0, caseH, g.zb], at: [0, 0, 0], from: [0, 200, 0] }],
          },
          {
            title: "Stand the shelf unit on the top",
            detail: `${ph.dowels} long dowels in the tops of the sides go up into the shelf unit's sides. Lift it on together.`,
            people: 2,
            warnings: ["two"],
            ops: [
              { fit: FF(LONG_DOWEL, [["S0", "+y", ph.dowels / 2, { along: 2, a: 0.08, b: 0.42 }], ["S1", "+y", ph.dowels / 2, { along: 2, a: 0.08, b: 0.42 }]]) },
              { add: ["HS0", "HS1", "HT"], from: [0, 400, 0] },
            ],
          },
          { title: "Slide the shelf unit's back in from the top", detail: "Finished side forward, down the grooves until it rests on the chest.", kind: "join", ops: [{ add: ["HB"], from: [0, 500, 0] }] },
        );
        if (ph.plates)
          steps.push({
            title: "Screw the joining plates across the backs",
            detail: "One plate over each side where the shelf unit meets the chest, four screws each.",
            tools: ["screwdriver"],
            ops: [
              { fit: { def: PLATE, at: [-1, 1].map((sx): Vec3 => [sx * (W / 2 - t / 2), caseH, g.zb - 1]), dir: [0, 0, 1], on: (p) => (p[0] < 0 ? "S0" : "S1"), hole: false, twist: Math.PI / 2 } },
              { fit: { def: PLATE_SCREW, at: [-1, 1].flatMap((sx) => [-45, -15, 15, 45].map((dy): Vec3 => [sx * (W / 2 - t / 2), caseH + dy, g.zb - 3])), dir: [0, 0, 1], on: (p) => (p[1] < caseH ? (p[0] < 0 ? "S0" : "S1") : p[0] < 0 ? "HS0" : "HS1") } },
            ],
          });
        if (ph.clips)
          steps.push({
            title: "Clip the backs to the top",
            detail: `${ph.clips} two-part clips along the joint.`,
            ops: [{ fit: F(CLICK_A, "TOP", "-y", ph.clips, { v: 0.04, along: 0, hole: false }) }, { fit: F(CLICK_B, "HB", "+z", ph.clips, { v: 0.02, along: 0, hole: false }) }],
          });
        break;
      }
      case "spacers":
        steps.push({
          title: "Screw the wall spacers into the back",
          detail: "Near the top of each side. Turn them out until the front stands straight against the wall.",
          tools: ["screwdriver"],
          ops: [{ fit: { def: W_SPACER, at: [-1, 1].slice(0, ph.n).map((sx): Vec3 => [sx * (W / 2 - t / 2), (c.hutch ? H : caseH) - 120, -D / 2]), dir: [0, 0, 1], on: (p) => (c.hutch ? (p[0] < 0 ? "HS0" : "HS1") : p[0] < 0 ? "S0" : "S1"), hole: false } }],
        });
        break;
      case "wall":
        steps.push(...wallSteps(k, ph.on ?? (c.hutch ? "HT" : "TOP"), { H, D, x: 0, n: ph.n }));
        break;
      case "shelves": {
        const ls = [...(c.loose ?? []).map((l) => l.id), ...(c.hutch?.shelves ?? []).map((_, i) => `HL${i}`)];
        const per = ph.pinsPer ?? 4;
        const pins: [string, Face, number, FaceOpts?][] = ls.flatMap((id): [string, Face, number, FaceOpts?][] => {
          const sb = k.box(id);
          const left = [...walls, { id: "HS0", x: -W / 2 }, { id: "HS1", x: W / 2 }].filter((w) => has(w.id) && Math.abs(k.box(w.id).p.pos[0] - sb.lo[0]) < t + 2 && k.box(w.id).lo[1] < sb.lo[1] && k.box(w.id).hi[1] > sb.hi[1]);
          void left;
          return [
            [id, "-y", per / 2, { along: 2, a: 0.1, b: 0.9, v: 0.01, hole: false }],
            [id, "-y", per / 2, { along: 2, a: 0.1, b: 0.9, v: 0.99, hole: false }],
          ];
        });
        steps.push({
          title: "Push in the shelf pins and lay the shelves on them",
          detail: `${per} pins for each shelf, at the same height on both sides. Pick the height you want.`,
          ops: [{ fit: FF(SHELF_PIN, pins) }, { add: ls, from: [0, 0, 400] }],
          kind: "shelves",
        });
        break;
      }
      case "drawers":
        steps.push(...drawerSteps(k, ds, { stop: c.stop }));
        break;
      case "rollers":
        steps.push(...drawerSteps(k, c.rollers ?? [], { castors: true, word: "bottom drawer" }));
        break;
      case "topBolts": {
        const xs = divs.map((id) => k.box(id).p.pos[0]);
        const at = xs.flatMap((x) => spread(-D / 2 + 80, D / 2 - 80, Math.max(1, Math.round(ph.n / Math.max(1, xs.length)))).map((z): Vec3 => [x, yTop, z])).slice(0, ph.n);
        steps.push({ title: "Bolt the top to the dividers", detail: "Long screws down through the top into each divider, turned with the Allen key.", pose: ps, tools: ["allen"], ops: [{ fit: { def: TOP_BOLT, at, dir: [0, -1, 0], on: "TOP", mate: divs[0] ? (p) => divs[xs.indexOf(p[0])] : undefined } }] });
        break;
      }
      case "tracks":
        steps.push(
          { title: "Press the bottom track onto the bottom", detail: "Along the front edge, the double channel facing up. Start at one end and press it down bit by bit.", ops: [{ add: ["TB"], from: [0, 200, 0] }] },
          { title: "Press the top track under the top", detail: "The same way, channels facing down, from one end to the other.", ops: [{ add: ["TT"], from: [0, -200, 0] }] },
        );
        break;
      case "slide": {
        const sl = c.sliders ?? [];
        const rollers = sl.flatMap((d) => [d.x0 + 60, d.x1 - 60].map((x): Vec3 => [x, d.y0, k.box(d.id).p.pos[2]]));
        const guides = sl.flatMap((d) => [d.x0 + 60, d.x1 - 60].map((x): Vec3 => [x, d.y1, k.box(d.id).p.pos[2]]));
        const onDoor = (p: Vec3) => sl.find((d) => p[0] >= d.x0 - 1 && p[0] <= d.x1 + 1 && Math.abs(k.box(d.id).p.pos[2] - p[2]) < 2)!.id;
        steps.push(
          {
            title: "Fit the runners and guides to the doors",
            detail: "Lay the doors face down. Two runners in the bottom edge and two guides in the top edge of each, one screw each.",
            scene: "doors",
            tools: ["screwdriver"],
            ops: [
              ...sl.map((d, i): Op => ({ stage: [d.id], rot: [-Math.PI / 2, 0, 0], pivot: k.box(d.id).p.pos, at: [(i - (sl.length - 1) / 2) * (d.x1 - d.x0 + 120), 12, 0], from: [0, 200, 0] })),
              { fit: { def: { kind: "roller", len: 44, dia: 26 }, at: rollers, dir: [0, 1, 0], on: onDoor, hole: false } },
              { fit: { def: { kind: "clip", len: 12, dia: 34 }, at: guides, dir: [0, -1, 0], on: onDoor, hole: false } },
              { fit: { def: DOOR_SCREW, at: [...rollers.map((p): Vec3 => [p[0] + 14, p[1], p[2]]), ...guides.map((p): Vec3 => [p[0] + 14, p[1], p[2]])], dir: (p) => [0, p[1] > H / 2 ? -1 : 1, 0], on: onDoor } },
            ],
          },
          {
            title: "Hang the doors in the tracks",
            detail: "Back door first, in the back channel. Lift each door up into the top track, swing the bottom in and lower it onto the bottom track.",
            kind: "doors",
            people: H > 1500 ? 2 : 1,
            ops: [{ add: sl.map((d) => d.id), from: [0, 0, 400] }],
          },
          {
            title: "Push the door stops into the bottom track",
            detail: "One at each end, so the doors stop flush with the sides.",
            ops: [{ fit: F({ kind: "clip", len: 8, dia: 24 }, "TB", "+y", ph.stops, { a: 0.02, b: 0.98, along: 0, hole: false }) }],
          },
          {
            title: "Screw on the knobs",
            detail: "One near the outer edge of each door. The screw goes in from the back.",
            tools: ["screwdriver"],
            ops: [
              { fit: { def: KNOB, at: sl.map((d): Vec3 => [d.x0 < 0 ? d.x0 + 40 : d.x1 - 40, (d.y0 + d.y1) / 2, k.box(d.id).hi[2]]), dir: [0, 0, -1], on: (_, i) => sl[i].id, hole: false } },
              { fit: { def: KNOB_SCREW, at: sl.map((d): Vec3 => [d.x0 < 0 ? d.x0 + 40 : d.x1 - 40, (d.y0 + d.y1) / 2, k.box(d.id).lo[2]]), dir: [0, 0, 1], on: (_, i) => sl[i].id } },
            ],
          },
        );
        break;
      }
      case "rails": {
        const rs = c.rails ?? [];
        const ends = rs.flatMap((r) => [r.x0, r.x1].map((x): Vec3 => [x, r.y, 0]));
        const wallAt = (p: Vec3) => walls.reduce((a, w) => (Math.abs(k.box(w.id).p.pos[0] - p[0]) < Math.abs(k.box(a.id).p.pos[0] - p[0]) ? w : a)).id;
        steps.push({
          title: rs.length > 1 ? "Put up the clothes rails" : "Put up the clothes rail",
          detail: "A holder at each end, screwed to the side and the divider, then drop the rail into the holders.",
          tools: ["screwdriver"],
          ops: [
            { fit: { def: { kind: "clip", len: 10, dia: 30 }, at: ends, dir: (p) => [Math.sign(k.box(wallAt(p)).p.pos[0] - p[0]) || 1, 0, 0], on: wallAt, hole: false } },
            { fit: { def: DOOR_SCREW, at: ends.map((p): Vec3 => [p[0], p[1] + 12, p[2]]), dir: (p) => [Math.sign(k.box(wallAt(p)).p.pos[0] - p[0]) || 1, 0, 0], on: wallAt } },
            { add: rs.map((r) => r.id), from: [0, 160, 0] },
          ],
        });
        break;
      }
      case "doors": {
        const drs = c.doors ?? [];
        const plateAt = drs.flatMap((d) => [d.y0 + 100, d.y1 - 100].map((y): Vec3 => [d.hingeX, y, zf - 40]));
        const sideFor = (x: number) => walls.reduce((a, w) => (Math.abs(k.box(w.id).p.pos[0] - x) < Math.abs(k.box(a.id).p.pos[0] - x) ? w : a)).id;
        const inner = (p: Vec3): Vec3 => [p[0] < 0 ? -1 : 1, 0, 0];
        const face = (p: Vec3): Vec3 => {
          const b = k.box(sideFor(p[0]));
          return [p[0] < b.p.pos[0] ? b.lo[0] : b.hi[0], p[1], p[2]];
        };
        const plates = plateAt.map((p) => {
          const b = k.box(sideFor(p[0]));
          return [b.p.pos[0] < 0 ? b.hi[0] : b.lo[0], p[1], p[2]] as Vec3;
        });
        void face;
        steps.push(
          {
            title: "Screw the hinge plates to the sides",
            detail: `Two for each door, near the top and the bottom, ${ph.plateScrews} screws each.`,
            tools: ["screwdriver"],
            kind: "hinges",
            ops: [
              { fit: { def: HINGE_PLATE, at: plates, dir: (p) => inner(p), on: (p) => sideFor(p[0]), hole: false } },
              { fit: { def: DOOR_SCREW, at: plates.flatMap((p) => [-12, 12].slice(0, ph.plateScrews).map((dz): Vec3 => [p[0], p[1], p[2] + dz])), dir: (p) => inner(p), on: (p) => sideFor(p[0]) } },
            ],
          },
          {
            title: "Fit the hinges to the doors",
            detail: `Lay the doors face down. Press each hinge cup into its hole and fix it with ${ph.hingeScrews} screws.`,
            scene: "doors",
            tools: ["screwdriver"],
            kind: "hinges",
            ops: [
              ...drs.map((d, i): Op => ({ stage: [d.id], rot: [-Math.PI / 2, 0, 0], pivot: k.box(d.id).p.pos, at: [(i - (drs.length - 1) / 2) * ((d.x1 - d.x0) + 120), 12, 0] })),
              { fit: { def: HINGE, at: drs.flatMap((d) => [d.y0 + 100, d.y1 - 100].map((y): Vec3 => [d.hingeX + (d.hingeX < (d.x0 + d.x1) / 2 ? 30 : -30), y, zf - 18])), dir: [0, 0, 1], on: (p) => drs.find((d) => p[0] >= d.x0 && p[0] <= d.x1)!.id, twist: Math.PI / 2 } },
              { fit: { def: DOOR_SCREW, at: drs.flatMap((d) => [d.y0 + 100, d.y1 - 100].flatMap((y) => [-20, 20].slice(0, ph.hingeScrews).map((dy): Vec3 => [d.hingeX + (d.hingeX < (d.x0 + d.x1) / 2 ? 30 : -30), y + dy, zf - 18]))), dir: [0, 0, 1], on: (p) => drs.find((d) => p[0] >= d.x0 && p[0] <= d.x1)!.id } },
            ],
          },
          {
            title: drs.length > 1 ? "Screw on the knobs" : "Screw on the knob",
            detail: "The screw goes in from the back of the door.",
            scene: "doors",
            tools: ["screwdriver"],
            ops: [
              { fit: { def: KNOB, at: drs.map((d): Vec3 => [d.hingeX < (d.x0 + d.x1) / 2 ? d.x1 - 40 : d.x0 + 40, (d.y0 + d.y1) / 2, zf]), dir: [0, 0, -1], on: (_, i) => drs[i].id, hole: false } },
              { fit: { def: KNOB_SCREW, at: drs.map((d): Vec3 => [d.hingeX < (d.x0 + d.x1) / 2 ? d.x1 - 40 : d.x0 + 40, (d.y0 + d.y1) / 2, zf - 18]), dir: [0, 0, 1], on: (_, i) => drs[i].id } },
            ],
          },
          {
            title: drs.length > 1 ? "Clip the doors onto the hinge plates" : "Clip the door onto the hinge plates",
            detail: "Hook each hinge arm over its plate and press until it clicks. The screws on the hinges set the gaps even.",
            kind: "doors",
            ops: [{ add: drs.map((d) => d.id), from: [0, 0, 400] }],
          },
        );
        break;
      }
    }
  }
  if (ex?.steps) steps.push(...ex.steps);
  run(b, parts, steps);
  return true;
}


/* ---- each product's manual, as a sequence ---- */

function bedside(b: PlanBuilder, s: ProductSpec) {
  const g = caseGeo(s, { P: 60 });
  const { W, H, D, t, G, P } = g;
  const yTop = H - G;
  const ySh = yTop - t - 165;
  const ds: Drawer[] = [{ id: "D0", x: 0, w: W - 2 * t, y0: ySh, h: 165, zf: D / 2, dd: D - 60, knobs: 1, deep: false, rs: 2 }];
  void P;
  return caseBuild(b, s, {
    g,
    word: "bedside table",
    fixed: [{ id: "SH", y: ySh }],
    drawers: ds,
    seq: [
      { p: "runners", screws: 2 },
      { p: "click", what: "tb" },
      { p: "click", what: "side" },
      { p: "back" },
      { p: "pins", n: 2 },
      { p: "clips", n: 4 },
      { p: "plinth", dowels: 2 },
      { p: "feet", straight: 2, t: 2 },
      { p: "gallery", dowels: 2, fix: 2 },
      { p: "stand" },
      { p: "drawers" },
    ],
  });
}

function chest2(b: PlanBuilder, s: ProductSpec) {
  const g = caseGeo(s);
  const { W, H, D, t, G, P } = g;
  const yTop = H - G;
  const ySh = yTop - t - 170;
  const ds = stack("D", 0, W - 2 * t, P + t, ySh - t, ["s", "d"], { zf: D / 2, dd: D - 70, knobs: 1 });
  return caseBuild(b, s, {
    g,
    fixed: [{ id: "SH", y: ySh }],
    drawers: ds,
    seq: [
      { p: "runners" },
      { p: "click", what: "tb" },
      { p: "click", what: "side" },
      { p: "clips", n: 6, single: true },
      { p: "gallery", dowels: 2, fix: 2, screws: true },
      { p: "back" },
      { p: "pins", n: 2 },
      { p: "clips", n: 4 },
      { p: "plinth", dowels: 2 },
      { p: "feet", straight: 2, t: 2 },
      { p: "stand" },
      { p: "pins", n: 2, into: "SH" },
      { p: "spacers", n: 2 },
      { p: "wall", n: 2 },
      { p: "drawers" },
    ],
  });
}

function chest6(b: PlanBuilder, s: ProductSpec) {
  const g = caseGeo(s);
  const { W, H, D, t, G, P } = g;
  const yTop = H - G;
  const cw = (W - 3 * t) / 2;
  const col = (pre: string, x: number) => stack(pre, x, cw, P + t, yTop - t, ["s", "d", "d"], { zf: D / 2, dd: D - 70, knobs: 2 });
  return caseBuild(b, s, {
    g,
    dividers: [0],
    drawers: [...col("L", -(t + cw) / 2), ...col("R", (t + cw) / 2)],
    stop: true,
    seq: [
      { p: "runners" },
      { p: "click", what: "tb" },
      { p: "click", what: "div" },
      { p: "click", what: "side" },
      { p: "back" },
      { p: "pins", n: 8 },
      { p: "clips", n: 6 },
      { p: "plinth", dowels: 8, rails: 2 },
      { p: "feet", straight: 2, t: 4 },
      { p: "stand" },
      { p: "gallery", dowels: 4, fix: 2 },
      { p: "wall", n: 2 },
      { p: "drawers" },
    ],
  });
}

function chestShelf(b: PlanBuilder, s: ProductSpec) {
  const g = caseGeo(s);
  const { W, H, D, t, P } = g;
  const hh = 330;
  const yTop = H - hh;
  const ds = stack("D", 0, W - 2 * t, P + t, yTop - t, ["s", "d", "d"], { zf: D / 2, dd: D - 70, knobs: 2 });
  return caseBuild(b, s, {
    g,
    hutch: { h: hh, d: 280, shelves: [] },
    noGallery: true,
    drawers: ds,
    stop: true,
    seq: [
      { p: "runners" },
      { p: "click", what: "tb" },
      { p: "click", what: "side" },
      { p: "back" },
      { p: "pins", n: 2 },
      { p: "clips", n: 2, on: "top" },
      { p: "plinth", dowels: 2 },
      { p: "feet", straight: 2, t: 2 },
      { p: "stand" },
      { p: "hutch", dowels: 4, plates: 2, clips: 2 },
      { p: "gallery", dowels: 3, fix: 2, screws: true },
      { p: "clips", n: 6 },
      { p: "wall", n: 1, on: "HT" },
      { p: "drawers" },
    ],
  });
}


function sideboard(b: PlanBuilder, s: ProductSpec) {
  const g = caseGeo(s);
  const { W, H, D, t, G, P } = g;
  const yTop = H - G, yBot = P + t;
  const bay = Math.round(W * 0.28);
  const dx = W / 2 - t - bay - t / 2;
  const yDr = yTop - t - 140;
  const mid = { x0: -dx + t / 2, x1: dx - t / 2 };
  const door = (id: string, sg: -1 | 1): Door => {
    const a = sg * (W / 2 - t - 2), c = sg * (dx + t / 2 + 2);
    return { id, x0: Math.min(a, c), x1: Math.max(a, c), y0: yBot + 2, y1: yTop - t - 2, hingeX: sg * (W / 2 - t), glass: true };
  };
  return caseBuild(b, s, {
    g,
    word: "sideboard",
    dividers: [-dx, dx],
    fixed: [{ id: "FX0", y: yDr, ...mid }],
    loose: [
      { id: "LS0", y: yBot + (yTop - yBot) / 2, x0: -W / 2 + t, x1: -dx - t / 2 },
      { id: "LS1", y: yBot + (yDr - t - yBot) / 2, ...mid },
      { id: "LS2", y: yBot + (yTop - yBot) / 2, x0: dx + t / 2, x1: W / 2 - t },
    ],
    drawers: [{ id: "D0", x: 0, w: mid.x1 - mid.x0, y0: yDr, h: 140, zf: D / 2, dd: D - 70, knobs: 2, deep: false }],
    doors: [door("DR0", -1), door("DR1", 1)],
    stop: true,
    seq: [
      { p: "runners" },
      { p: "click", what: "fixed" },
      { p: "click", what: "tb" },
      { p: "click", what: "div" },
      { p: "click", what: "side" },
      { p: "back" },
      { p: "pins", n: 12 },
      { p: "clips", n: 6 },
      { p: "plinth", dowels: 8, rails: 2 },
      { p: "feet", straight: 4, t: 4 },
      { p: "stand" },
      { p: "gallery", dowels: 4, fix: 2 },
      { p: "spacers", n: 2 },
      { p: "wall", n: 2 },
      { p: "shelves" },
      { p: "drawers" },
      { p: "doors", plateScrews: 2, hingeScrews: 2 },
    ],
  });
}

function tvBench(b: PlanBuilder, s: ProductSpec) {
  const g = caseGeo(s);
  const { W, H, D, t, G, P } = g;
  const yTop = H - G, yBot = P + t;
  const cw = (W - 4 * t) / 3;
  const xs = [-(cw + t), 0, cw + t];
  const dh = 150;
  const comp = (i: number) => ({ x0: xs[i] - cw / 2, x1: xs[i] + cw / 2 });
  return caseBuild(b, s, {
    g,
    word: "TV bench",
    dividers: [-(cw / 2 + t / 2), cw / 2 + t / 2],
    fixed: xs.map((_, i) => ({ id: `FX${i}`, y: yBot + dh + t, ...comp(i) })),
    loose: xs.map((_, i) => ({ id: `LS${i}`, y: yBot + dh + t + (yTop - t - yBot - dh - t) / 2 + t / 2, ...comp(i) })),
    drawers: xs.map((x, i): Drawer => ({ id: `D${i}`, x, w: cw, y0: yBot, h: dh, zf: D / 2, dd: D - 70, knobs: 2, deep: false })),
    stop: true,
    seq: [
      { p: "runners" },
      { p: "click", what: "tb" },
      { p: "click", what: "div" },
      { p: "click", what: "fixed" },
      { p: "click", what: "side" },
      { p: "gallery", dowels: 4, fix: 2, screws: true },
      { p: "topBolts", n: 3 },
      { p: "back" },
      { p: "pins", n: 8 },
      { p: "plinth", dowels: 12, rails: 2 },
      { p: "feet", straight: 4, t: 4 },
      { p: "stand" },
      { p: "shelves" },
      { p: "clips", n: 6 },
      { p: "spacers", n: 2 },
      { p: "wall", n: 2 },
      { p: "drawers" },
    ],
  });
}

function dresser(b: PlanBuilder, s: ProductSpec, cols: 1 | 2) {
  const g = caseGeo(s);
  const { W, H, D, t, G } = g;
  const bay = 230;
  const yTop = H - G, yBot = bay + t;
  const cw = cols === 2 ? (W - 3 * t) / 2 : W - 2 * t;
  const cx = cols === 2 ? [-(t + cw) / 2, (t + cw) / 2] : [0];
  const drawers = cx.flatMap((x, i) => stack(cols === 2 ? `${"LR"[i]}` : "D", x, cw, yBot, yTop - t, ["s", "d", "d"], { zf: D / 2, dd: D - 70, knobs: 2 }));
  const rw = cols === 2 ? (W - 2 * t - 6) / 2 : W - 2 * t;
  const rollers: Drawer[] = cx.map((_, i): Drawer => ({ id: `B${i}`, x: cols === 2 ? (i ? 1 : -1) * (rw / 2 + 3) : 0, w: rw, y0: 36, h: bay - 36 - 4, zf: D / 2, dd: D - 80, knobs: 2, deep: true }));
  return caseBuild(b, s, {
    g,
    word: "dresser",
    dividers: cols === 2 ? [0] : [],
    bay,
    drawers,
    rollers,
    stop: true,
    seq: [
      { p: "runners" },
      { p: "click", what: "tb" },
      ...(cols === 2 ? [{ p: "click", what: "div" } as Phase] : []),
      { p: "click", what: "side" },
      { p: "clips", n: 8 },
      { p: "back" },
      { p: "pins", n: cols === 2 ? 4 : 2 },
      { p: "stand" },
      { p: "gallery", dowels: cols === 2 ? 4 : 3, fix: 2, screws: true },
      { p: "spacers", n: 2 },
      { p: "wall", n: cols },
      { p: "drawers" },
      { p: "rollers" },
    ],
  });
}

function doorCabinet(b: PlanBuilder, s: ProductSpec, o: { hutchH: number; hutchShelves: number; lowerShelves: number }) {
  const g = caseGeo(s, { t: 18 });
  const { W, H, D, t, G, P } = g;
  const caseH = H - o.hutchH;
  const yTop = caseH, yBot = P + t;
  const hTop = H - G;
  const inner = hTop - t - caseH;
  const hs = range(o.hutchShelves).map((i) => (inner * (i + 1)) / (o.hutchShelves + 1) + t / 2);
  const half = (W - 2 * t) / 2;
  const door = (id: string, sg: -1 | 1): Door => {
    const a = sg * (W / 2 - t - 1), c = sg * 2;
    return { id, x0: Math.min(a, c), x1: Math.max(a, c), y0: yBot + 2, y1: yTop - t - 2, hingeX: sg * (W / 2 - t) };
  };
  void half;
  return caseBuild(b, s, {
    g,
    word: "cabinet",
    hutch: { h: o.hutchH, d: 300, shelves: hs },
    noGallery: true,
    loose: range(o.lowerShelves).map((i) => ({ id: `LS${i}`, y: yBot + ((yTop - t - yBot) * (i + 1)) / (o.lowerShelves + 1) + t / 2 })),
    doors: [door("DR0", -1), door("DR1", 1)],
    seq: [
      { p: "click", what: "tb" },
      { p: "click", what: "side" },
      { p: "back" },
      { p: "pins", n: 8 },
      { p: "plinth", dowels: 2 },
      { p: "feet", straight: 2, t: 2 },
      { p: "stand" },
      { p: "hutch", dowels: 4, plates: 2, clips: 2 },
      { p: "gallery", dowels: 3, fix: 2 },
      { p: "spacers", n: 2 },
      { p: "wall", n: 2 },
      { p: "shelves" },
      { p: "doors", plateScrews: 2, hingeScrews: 2 },
    ],
  });
}


function slidingCase(b: PlanBuilder, s: ProductSpec, wardrobe: boolean) {
  const g = caseGeo(s, { t: 18 });
  const { W, H, D, t, G, P } = g;
  const yTop = H - G, yBot = P + t;
  const half = (W - 2 * t) / 2;
  const sx = (i: number) => (i ? 1 : -1);
  const slider = (id: string, i: number): Door => {
    const x0 = i ? -20 : -W / 2 + t + 2, x1 = i ? W / 2 - t - 2 : 20;
    return { id, x0, x1, y0: yBot + 10, y1: yTop - t - 12, hingeX: 0, glass: !wardrobe };
  };
  void half;
  const shelfY = (n: number, i: number) => yBot + 30 + ((yTop - t - yBot - 30) * (i + 1)) / (n + 1);
  return caseBuild(b, s, {
    g,
    word: wardrobe ? "wardrobe" : "cabinet",
    dividers: [0],
    fixed: wardrobe ? [0, 1].map((i) => ({ id: `FX${i}`, y: yTop - t - 260, x0: i ? t / 2 : -W / 2 + t, x1: i ? W / 2 - t : -t / 2, d: D - 90 })) : [],
    loose: wardrobe
      ? [{ id: "LS0", y: shelfY(4, 1), x0: t / 2, x1: W / 2 - t, d: D - 90 }, { id: "LS1", y: shelfY(4, 0), x0: t / 2, x1: W / 2 - t, d: D - 90 }]
      : [0, 1].flatMap((i) => range(3).map((j) => ({ id: `LS${i}${j}`, y: shelfY(3, j), x0: i ? t / 2 : -W / 2 + t, x1: i ? W / 2 - t : -t / 2, d: D - 90 }))),
    rails: wardrobe ? [0, 1].map((i) => ({ id: `RL${i}`, x0: i ? t / 2 : -W / 2 + t, x1: i ? W / 2 - t : -t / 2, y: yTop - t - 260 - t - 60 })) : [],
    sliders: [slider("SD0", 0), slider("SD1", 1)],
    seq: [
      { p: "click", what: "tb" },
      { p: "click", what: "div" },
      ...(wardrobe ? [{ p: "click", what: "fixed" } as Phase] : []),
      { p: "click", what: "side" },
      { p: "back" },
      { p: "pins", n: wardrobe ? 16 : 6 },
      { p: "clips", n: wardrobe ? 14 : 8 },
      { p: "plinth", dowels: 6, rails: 2 },
      { p: "feet", straight: 2, t: 4 },
      { p: "stand" },
      { p: "gallery", dowels: 3, fix: 2 },
      { p: "spacers", n: 2 },
      { p: "wall", n: 2 },
      { p: "tracks" },
      { p: "shelves" },
      ...(wardrobe ? [{ p: "rails" } as Phase] : []),
      { p: "slide", stops: 2 },
    ],
  });
}

/* ---------- which guide is which ---------- */

function build(b: PlanBuilder, s: ProductSpec) {
  const slug = s.slug ?? "";
  if (/^hauga-table-/.test(slug)) return table(b, s);
  if (slug === "hauga-chair") return chair(b, s);
  if (slug === "hauga-stool") return stool(b, s);
  if (/^hauga-drop-leaf-table/.test(slug)) return dropLeaf(b, s);
  if (slug === "hauga-chest-3-drawers") return chest3(b, s);
  if (slug === "hauga-chest-6-drawers") return chest6(b, s);
  if (slug === "hauga-bedside-table-40-x-36") return bedside(b, s);
  if (slug === "hauga-2-drawer-chest-50-x-46-x-68") return chest2(b, s);
  if (slug === "hauga-chest-3-drawers-shelf-70-x-46-x-116") return chestShelf(b, s);
  if (slug === "hauga-sideboard-140-x-46-x-84") return sideboard(b, s);
  if (slug === "hauga-tv-bench-206-x-46-x-54") return tvBench(b, s);
  if (slug === "hauga-4-drawer-dresser-70-x-104") return dresser(b, s, 1);
  if (slug === "hauga-8-drawer-dresser-138-x-104") return dresser(b, s, 2);
  if (slug === "hauga-cabinet-2-doors-70-x-116") return doorCabinet(b, s, { hutchH: 420, hutchShelves: 0, lowerShelves: 1 });
  if (slug === "hauga-glass-door-cabinet-105-x-116") return slidingCase(b, s, false);
  if (slug === "hauga-wardrobe-sliding-doors-118-x-55-x-199") return slidingCase(b, s, true);
  if (slug === "hauga-wardrobe-70-x-199") return doorCabinet(b, s, { hutchH: 1100, hutchShelves: 3, lowerShelves: 1 });
  return false;
}

const family: Family = {
  names: ["HAUGA"],
  build,
};
export default family;

void HW;
