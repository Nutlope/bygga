import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rotate } from "../math";

/**
 * BROR, read from its manuals. Everything is open black (or grey-green) steel: L-section posts with a plastic foot
 * on each end, and levels hung between them.
 * - Shelving units (the post manual): two posts lie on the floor and side beams hook into their slots, tapped down
 *   with the plastic block; the two sides are stood up and long beams hook in front and back; a support bar clicks
 *   into each level and a steel (or plywood) shelf drops on. Two half-bars hook into each brace bar, the bars are
 *   bolted where they cross, and the X is bolted across the back. Two spacers on the back posts take the wall
 *   screws. A unit added beside another stands its first two posts in joining feet and bolts them to the posts next
 *   to them, then goes on the same way.
 * - Work bench and trolley: welded frames, a corner bracket in each corner and two bolts through the post. They're
 *   built upside down on the top frame and turned over at the end; the trolley's castors bolt into the post ends.
 * - Work bench with drawers: the same, with eight steel runners bolted between the posts, a cross brace on the
 *   back, and four steel drawers hooked and bolted together, then slid onto the runners.
 * - Steel cabinets, and shelving units with a cabinet hung inside the posts: see the cabinet section below.
 */

const PT = 3; // steel sheet, as drawn
const PA = 36; // each leg of a post's L
const BEAM = 40; // height of a beam or frame
const LEDGE = 28; // a beam's top flange, inwards
const FOOT_H = 2.5; // posts stand this far up, on their feet

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

// fittings, sized so different ones stay apart in the list
const FRAME_BOLT: HwDef = { kind: "bolt", len: 12, dia: 6 }; // frames, runners and the bench's brace
const BOLT: HwDef = { kind: "bolt", len: 10, dia: 6 }; // drawers, brace ends, joining posts
const CROSS_BOLT: HwDef = { kind: "bolt", len: 8, dia: 6 }; // the shelving brace's middle
const NUT: HwDef = { kind: "nut", len: 5, dia: 6 };
const CORNER: HwDef = { kind: "angle", len: 30, dia: 24 };
const FOOT: HwDef = { kind: "cap", len: 2, dia: 40 };
const JOIN_FOOT: HwDef = { kind: "clamp", len: 90, dia: 40 };
const TOP_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const SPACER: HwDef = { kind: "spacer", len: 20, dia: 30 };
const CASTOR: HwDef = { kind: "castor", len: 120, dia: 100 };
const CASTOR_WASHER: HwDef = { kind: "washer", len: 2, dia: 20 };
const CASTOR_NUT: HwDef = { kind: "nut", len: 8, dia: 12 };

/* ---------- drawing helpers ---------- */

interface StepOpts {
  title: string;
  detail?: string;
  kind?: StepKind;
  tools?: ToolId[];
  pose?: Pose;
  people?: 1 | 2;
  warnings?: WarnId[];
  scene?: string;
  repeat?: number;
  wall?: boolean;
  check?: "square";
}

/** Parts placed where they sit in the finished product; identical ones share a type (and a letter). */
class Kit {
  private types = new Map<string, string>();
  private poses = new Map<string, Pose>(); // a pose stays until a later step in the same scene changes it
  constructor(readonly b: PlanBuilder) {}
  part(name: string, size: Vec3, pos: Vec3, o: { material?: PartMaterial; pieces?: PartPiece[]; rot?: Vec3 } = {}) {
    const r = (n: number) => Math.round(n * 10) / 10;
    let pieces = o.pieces;
    const rot = o.rot ?? [0, 0, 0];
    if (pieces) {
      // pieces are drawn around pos; the part is centred on their bounding box
      const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
      for (const p of pieces)
        for (let i = 0; i < 3; i++) {
          lo[i] = Math.min(lo[i], p.pos[i] - p.size[i] / 2);
          hi[i] = Math.max(hi[i], p.pos[i] + p.size[i] / 2);
        }
      const mid: Vec3 = [r((lo[0] + hi[0]) / 2), r((lo[1] + hi[1]) / 2), r((lo[2] + hi[2]) / 2)];
      size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      pieces = pieces.map((p) => ({ ...p, pos: [r(p.pos[0] - mid[0]), r(p.pos[1] - mid[1]), r(p.pos[2] - mid[2])] }));
      const m = rotate(mid, rot);
      pos = [pos[0] + m[0], pos[1] + m[1], pos[2] + m[2]];
    }
    const tk = `${name}|${size.map(r).join("x")}|${o.material ?? "metal"}|${pieces ? JSON.stringify(pieces) : ""}`;
    let ref = this.types.get(tk);
    if (!ref) {
      ref = this.b.part(name, size.map(r) as Vec3, { material: o.material ?? "metal" });
      if (pieces) this.b.parts[this.b.parts.length - 1].pieces = pieces;
      this.types.set(tk, ref);
    }
    return this.b.place(ref, pos, rot);
  }
  step(o: StepOpts, body: () => void) {
    const scene = o.scene ?? "main";
    const pose = o.pose ?? this.poses.get(scene) ?? "+y";
    this.poses.set(scene, pose);
    this.b.step({ kind: "general", ...o, pose }, body);
  }
  fits(def: HwDef, list: FitOpts[], gap = 0.06) {
    if (list.length) this.b.fits(def, list, gap);
  }
  add(keys: string[], from: Vec3 | ((k: string) => Vec3 | undefined) = [0, 260, 0], gap = 0.2) {
    this.b.stagger(gap);
    for (const key of keys) this.b.add(key, typeof from === "function" ? from(key) : from);
    this.b.then(0.12);
  }
  /** Shows parts somewhere else (lying on the floor, in a scene of their own) until they're added. */
  stage(keys: string[], at: (k: string) => { pos: Vec3; rot: Vec3 }, from: Vec3 = [0, 160, 0], gap = 0.15) {
    this.b.stagger(gap);
    for (const key of keys) {
      const p = at(key);
      this.b.stage(key, p.pos, p.rot, from);
    }
    this.b.then(0.12);
  }
  final(key: string) {
    return this.b.partItem(key).final;
  }
}

/** An L-section post standing in one corner of a footprint w x d centred on xc, its flanges on the outside. */
function post(k: Kit, xc: number, w: number, d: number, sx: number, sz: number, y0: number, y1: number) {
  const L = y1 - y0;
  // drawn for the right front corner, then turned to its own corner
  const pieces: PartPiece[] = [
    { shape: "box", size: [PA, L, PT], pos: [0, 0, PA / 2 - PT / 2] },
    { shape: "box", size: [PT, L, PA - PT], pos: [PA / 2 - PT / 2, 0, -PT / 2] },
  ];
  const turn = sx > 0 ? (sz > 0 ? 0 : Math.PI / 2) : sz > 0 ? -Math.PI / 2 : Math.PI;
  return k.part("Post", [PA, L, PA], [xc + sx * (w / 2 - PA / 2), (y0 + y1) / 2, sz * (d / 2 - PA / 2)], { pieces, rot: [0, turn, 0] });
}

/** A beam's profile along x: an upright flange on the outside (+z) and a ledge inwards at the top. */
function beamPieces(len: number, ledgeLen = len): PartPiece[] {
  return [
    { shape: "box", size: [len, BEAM, PT], pos: [0, 0, LEDGE / 2] },
    { shape: "box", size: [ledgeLen, PT, LEDGE], pos: [0, BEAM / 2 - PT / 2, -PT / 2] },
  ];
}
const BEAM_DEPTH = PT + LEDGE;

/** A welded frame of four beams that fits inside the posts' corners, ledges in and up. */
function framePieces(fw: number, fd: number, panel?: { t: number; material: PartMaterial; over: number }): PartPiece[] {
  const out: PartPiece[] = [];
  for (const g of [-1, 1]) {
    out.push({ shape: "box", size: [fw, BEAM, PT], pos: [0, 0, g * (fd / 2 - PT / 2)] });
    out.push({ shape: "box", size: [fw - 2 * PT, PT, LEDGE], pos: [0, BEAM / 2 - PT / 2, g * (fd / 2 - PT - LEDGE / 2)] });
    out.push({ shape: "box", size: [PT, BEAM, fd - 2 * PT], pos: [g * (fw / 2 - PT / 2), 0, 0] });
    out.push({ shape: "box", size: [LEDGE, PT, fd - 2 * PT - 2 * LEDGE], pos: [g * (fw / 2 - PT - LEDGE / 2), BEAM / 2 - PT / 2, 0] });
  }
  if (panel) {
    // a shelf panel lying on the ledges, or a top that covers the posts too
    const pw = fw + 2 * panel.over, pd = fd + 2 * panel.over;
    out.push({ shape: "box", size: [pw, panel.t, pd], pos: [0, BEAM / 2 + panel.t / 2, 0], material: panel.material });
  }
  return out;
}

/** Bolts that hold a frame corner: a bracket inside the corner, one bolt through each face of the post. */
function cornerFits(xc: number, w: number, d: number, sx: number, sz: number, y: number, postKey: string, frameKey: string) {
  const angle: FitOpts = { on: frameKey, at: [xc + sx * (w / 2 - 2 * PT), y, sz * (d / 2 - 2 * PT - 16)], dir: [sx, 0, 0], hole: false };
  const bolts: FitOpts[] = [
    { on: postKey, at: [xc + sx * (w / 2 - PA / 2 - 4), y, sz * (d / 2)], dir: [0, 0, -sz], mate: frameKey },
    { on: postKey, at: [xc + sx * (w / 2), y, sz * (d / 2 - PA / 2 - 4)], dir: [-sx, 0, 0], mate: frameKey },
  ];
  return { angle, bolts };
}

const footAt = (xc: number, w: number, d: number, sx: number, sz: number, key: string): FitOpts => ({
  on: key,
  at: [xc + sx * (w / 2 - PA / 2 + 4), FOOT_H, sz * (d / 2 - PA / 2 + 4)],
  dir: [0, 1, 0],
  hole: false,
});

/** Posts lying side by side on the floor, before anything is fixed to them. */
const lying = (keys: string[], len: number) => (key: string) => {
  const i = keys.indexOf(key);
  void len;
  return { pos: [0, PA / 2, (i - (keys.length - 1) / 2) * 110] as Vec3, rot: [0, 0, Math.PI / 2] as Vec3 };
};

/** Two brace bars across a back, each made of two half-bars hooked together, bolted where they cross. */
function brace(k: Kit, xc: number, halfSpan: number, yLo: number, yHi: number, zBack: number) {
  const dx = 2 * halfSpan, dy = yHi - yLo;
  const Lb = Math.hypot(dx, dy);
  const ov = 90; // the halves overlap this much at the middle
  const half = Lb / 2 + ov / 2;
  const mid: Vec3 = [xc, (yLo + yHi) / 2, zBack];
  const keys: string[] = [];
  const ends: { key: string; at: Vec3; layer: number }[] = [];
  // bar A climbs to the right, bar B to the left; each half on its own layer so they lie face to face
  for (const [bi, sgn] of [1, -1].entries()) {
    const ang = Math.atan2(sgn * dy, dx);
    const u: Vec3 = [Math.cos(ang), Math.sin(ang), 0];
    for (const [hi, t] of [-1, 1].entries()) {
      const off = t * (Lb / 4 - ov / 4);
      const layer = bi * 2 + hi;
      const key = k.part("Brace half", [half, 20, PT], [mid[0] + u[0] * off, mid[1] + u[1] * off, zBack - PT / 2 - layer * PT], { rot: [0, 0, ang] });
      keys.push(key);
      ends.push({ key, layer, at: [mid[0] + (t * dx) / 2, mid[1] + (t * sgn * dy) / 2, zBack] });
    }
  }
  const zOf = (layer: number) => zBack - PT * (layer + 1); // the outer face of a layer
  const endAt = (x: number, y: number) => ends.find((e) => Math.abs(e.at[0] - x) < 1 && Math.abs(e.at[1] - y) < 1);
  return { keys, mid, ends, zOf, endAt };
}

/** The brace lying flat on the floor in a scene of its own: its back face down. */
function braceFlat(k: Kit, mid: Vec3) {
  return (key: string) => {
    const f = k.final(key);
    const d: Vec3 = [f.pos[0] - mid[0], f.pos[1] - mid[1], f.pos[2] - mid[2]];
    return { pos: [d[0], d[2] + 14, -d[1]] as Vec3, rot: [-Math.PI / 2, 0, f.rot[2]] as Vec3 };
  };
}

function wallFits(points: [number, number][], y: number, zBack: number, postKeys: string[]) {
  return {
    spacers: points.map(([x], i): FitOpts => ({ on: postKeys[i], at: [x, y, zBack], dir: [0, 0, 1], hole: false })),
    screws: points.map(([x], i): FitOpts => ({ on: postKeys[i], at: [x, y, zBack + PT], dir: [0, 0, -1], hole: false })),
    plugs: points.map(([x]): FitOpts => ({ at: [x, y, zBack - SPACER.len - 4], dir: [0, 0, -1] })),
  };
}

function wallStep(k: Kit, w: ReturnType<typeof wallFits>, what: string) {
  k.step(
    {
      title: "Fix it to the wall",
      detail: `Clip a spacer onto each back post${what}, mark the wall through it and screw it on. Wall screws and plugs aren't included: pick ones made for your wall.`,
      kind: "anchor",
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      k.fits(SPACER, w.spacers, 0.15);
      k.b.then(0.1);
      k.fits(HW.plug, w.plugs, 0.12);
      k.b.then(0.05);
      k.fits(HW.wallScrew, w.screws, 0.12);
    },
  );
}

/* ---------- work bench with drawers ---------- */

/*
 * Its manual: feet on the four posts; the top frame upside down on the floor, a post bolted into each corner
 * through a bracket, then the second frame across them; turned over, the plywood top screwed on from below; four
 * runners bolted down each side (two bolts at the front post, one at the back); two brace bars, each two halves
 * hooked together, bolted where they cross and bolted to the back posts with the runners' back bolts; two wall
 * spacers; then four steel drawers, each hooked, bolted and slid in.
 */
function drawerBench(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TOP = 18;
  const yTop = H - TOP; // post tops and the top frame's top
  const n = 4;
  const fw = W - 2 * PT, fd = D - 2 * PT;
  const corners: [number, number][] = [
    [-1, 1],
    [1, 1],
    [1, -1],
    [-1, -1],
  ];
  const posts = corners.map(([sx, sz]) => post(k, 0, W, D, sx, sz, FOOT_H, yTop));
  const fPieces = framePieces(fw, fd);
  const yHi = yTop - BEAM / 2, yLo = 100 + BEAM / 2;
  const frameTop = k.part("Frame", [fw, BEAM, fd], [0, yHi, 0], { pieces: fPieces });
  const frameBot = k.part("Frame", [fw, BEAM, fd], [0, yLo, 0], { pieces: fPieces });
  const top = k.part("Worktop", [W, TOP, D], [0, yTop + TOP / 2, 0], { material: "wood" });

  // the drawers share the height between the frames; the runners carry each one near its bottom
  const z0 = yLo + BEAM / 2, z1 = yHi - BEAM / 2;
  const pitch = (z1 - z0) / n;
  const slot = (i: number) => z0 + i * pitch;
  const RW = 20, RH = 30;
  const runY = (i: number) => slot(i) + 20 + RH / 2;
  const runners = [-1, 1].map((sx) => range(n).map((i) => k.part("Drawer runner", [RW, RH, D - 2 * PT], [sx * (W / 2 - PT - RW / 2), runY(i), 0])));
  const runnerBolts = (si: number): FitOpts[] => {
    const sx = si ? 1 : -1;
    return range(n).flatMap((i) => [
      { on: posts[si ? 1 : 0], at: [sx * (W / 2), runY(i) + 7, D / 2 - PA / 2], dir: [-sx, 0, 0], mate: runners[si][i] },
      { on: posts[si ? 1 : 0], at: [sx * (W / 2), runY(i) - 7, D / 2 - PA / 2], dir: [-sx, 0, 0], mate: runners[si][i] },
      { on: posts[si ? 2 : 3], at: [sx * (W / 2), runY(i), -(D / 2 - PA / 2)], dir: [-sx, 0, 0], mate: runners[si][i] },
    ] as FitOpts[]);
  };

  // the brace runs from the top runners to the bottom ones, its ends on the runners' back bolts
  const bx = W / 2 - PT - RW / 2;
  const br = brace(k, 0, bx, runY(0), runY(n - 1), -D / 2);
  const backBolts: FitOpts[] = [];
  for (const [si, sx] of [-1, 1].entries())
    for (let i = 0; i < n; i++) {
      const e = br.endAt(sx * bx, runY(i));
      backBolts.push(e ? { on: e.key, at: [sx * bx, runY(i), br.zOf(e.layer)], dir: [0, 0, 1], mate: runners[si][i] } : { on: posts[si ? 2 : 3], at: [sx * bx, runY(i), -D / 2], dir: [0, 0, 1], mate: runners[si][i] });
    }

  // the drawers: a front with a rolled top edge, two sides hooked on, a bottom and a back, all bolted
  const DF = 20, Hf = pitch - 8;
  const Wf = W - 2 * PA - 8;
  const Ds = D - PT - 30; // the box, from the back panel to the front plate
  const Hs = Math.round(Hf * 0.78);
  const zf = D / 2 - DF / 2, zs = D / 2 - PT - Ds / 2, zb = D / 2 - PT - Ds + PT / 2;
  const xs = Wf / 2 - PT * 1.5;
  const frontPieces: PartPiece[] = [
    { shape: "box", size: [Wf, Hf - 14, PT], pos: [0, -7, DF / 2 - PT / 2] },
    { shape: "box", size: [Wf, 14, DF], pos: [0, Hf / 2 - 7, 0] },
    { shape: "box", size: [PT, Hf - 14, DF - PT], pos: [-(Wf / 2 - PT / 2), -7, -PT / 2] },
    { shape: "box", size: [PT, Hf - 14, DF - PT], pos: [Wf / 2 - PT / 2, -7, -PT / 2] },
  ];
  interface Drawer {
    y: number;
    front: string;
    sides: string[];
    bottom: string;
    back: string;
  }
  const drawers: Drawer[] = range(n).map((i) => {
    const y = slot(i) + 22; // the box's underside
    return {
      y,
      front: k.part("Drawer front", [Wf, Hf, DF], [0, slot(i) + 4 + Hf / 2, zf], { pieces: frontPieces }),
      sides: [-1, 1].map((g) => k.part("Drawer side", [PT, Hs, Ds], [g * xs, y + Hs / 2, zs])),
      bottom: k.part("Drawer bottom", [2 * xs - PT, PT, Ds], [0, y + PT / 2, zs]),
      back: k.part("Drawer back", [2 * xs - PT, Hs - PT, PT], [0, y + PT + (Hs - PT) / 2, zb]),
    };
  });
  const drawerFits = (d: Drawer) => {
    const per = (fn: (g: number, side: string) => FitOpts[]) => [-1, 1].flatMap((g) => fn(g, d.sides[g < 0 ? 0 : 1]));
    return {
      bottom: [
        { on: d.front, at: [0, d.y + PT / 2, D / 2], dir: [0, 0, -1], mate: d.bottom } as FitOpts,
        ...per((g, sd) => [zs + Ds * 0.3, zs - Ds * 0.3].map((z): FitOpts => ({ on: sd, at: [g * (xs + PT / 2), d.y + PT / 2, z], dir: [-g, 0, 0], mate: d.bottom }))),
      ],
      back: per((g, sd) => [{ on: sd, at: [g * (xs + PT / 2), d.y + 30, zb], dir: [-g, 0, 0], mate: d.back }]),
      under: [-1, 0, 1].map((g): FitOpts => ({ on: d.bottom, at: [g * (xs - 80), d.y, zb], dir: [0, 1, 0], mate: d.back })),
      top: per((g, sd) => [{ on: sd, at: [g * (xs + PT / 2), d.y + Hs - 16, zb], dir: [-g, 0, 0], mate: d.back }]),
      nuts: per((g, sd) => [{ on: sd, at: [g * (xs - PT / 2), d.y + Hs - 16, zb], dir: [g, 0, 0], hole: false as const }]),
    };
  };

  /* steps */
  const L = yTop - FOOT_H;
  k.step({ title: "Push a foot onto each post", detail: "Lay the four posts on the floor. The foot slides over the end until it sits tight.", scene: "prep" }, () => {
    k.stage(posts, lying(posts, L));
    k.fits(FOOT, corners.map(([sx, sz], i) => footAt(0, W, D, sx, sz, posts[i])), 0.12);
  });
  const corner = (i: number, frame: string, y: number) => cornerFits(0, W, D, corners[i][0], corners[i][1], y, posts[i], frame);
  k.step(
    {
      title: "Bolt the first post to a frame",
      detail: "Lay a frame upside down on a rug: it becomes the top. Hold a bracket inside its corner and bolt the post on through both faces, hand tight for now.",
      kind: "bolts",
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    () => {
      k.add([frameTop]);
      const c = corner(0, frameTop, yHi);
      k.fits(CORNER, [c.angle]);
      k.b.then(0.1);
      k.add([posts[0]], [0, -300, 0]);
      k.fits(FRAME_BOLT, c.bolts, 0.12);
    },
  );
  k.step({ title: "Bolt on the other three posts", detail: "A bracket and two bolts in each corner, the same way.", kind: "bolts", tools: ["allen"] }, () => {
    const cs = [1, 2, 3].map((i) => corner(i, frameTop, yHi));
    k.fits(CORNER, cs.map((c) => c.angle), 0.1);
    k.b.then(0.1);
    k.add(posts.slice(1), [0, -300, 0]);
    k.fits(FRAME_BOLT, cs.flatMap((c) => c.bolts));
  });
  k.step(
    {
      title: "Bolt the second frame between the posts",
      detail: "It goes in a little way from the feet, on the holes near the ends. A bracket and two bolts in each corner.",
      kind: "bolts",
      tools: ["allen"],
    },
    () => {
      const cs = range(4).map((i) => corner(i, frameBot, yLo));
      k.add([frameBot], [0, -300, 0]);
      k.fits(CORNER, cs.map((c) => c.angle), 0.1);
      k.b.then(0.1);
      k.fits(FRAME_BOLT, cs.flatMap((c) => c.bolts));
    },
  );
  k.step({ title: "Turn it over and lay the top on", detail: "Stand it on its feet, then rest the plywood top on the frame, flush on every side.", kind: "join", pose: "+y" }, () => k.add([top], [0, 300, 0]));
  k.step({ title: "Screw the top on from below", detail: "Eight screws up through the frame's ledge into the plywood.", kind: "screws", tools: ["screwdriver"] }, () => {
    const zl = D / 2 - 2 * PT - LEDGE / 2;
    const xl = W / 2 - 2 * PT - LEDGE / 2;
    const at: Vec3[] = [
      ...[-1, 0, 1].flatMap((g) => [-1, 1].map((sz) => [g * (W / 2 - 160), yTop - PT, sz * zl] as Vec3)),
      [-xl, yTop - PT, 0],
      [xl, yTop - PT, 0],
    ];
    k.fits(TOP_SCREW, at.map((p): FitOpts => ({ on: frameTop, at: p, dir: [0, 1, 0], mate: top })));
  });
  for (const si of [0, 1]) {
    k.step(
      {
        title: si ? "Bolt the runners to the right side" : "Bolt four runners to the left side",
        detail: si ? "The same as the left: two bolts at the front post, one at the back." : "One under each drawer, open side facing in. Two bolts through the front post, one through the back post.",
        kind: "runners",
        tools: ["allen"],
      },
      () => {
        k.add(runners[si], [si ? -200 : 200, 0, 0], 0.15);
        k.fits(FRAME_BOLT, runnerBolts(si));
      },
    );
  }
  k.step(
    {
      title: "Hook the brace halves together",
      detail: "Drop the tabs of one half into the slots of the other and slide it along until it locks. Make two bars.",
      scene: "brace",
    },
    () => k.stage(br.keys, braceFlat(k, br.mid), [0, 120, 0], 0.25),
  );
  k.step({ title: "Bolt the two bars together in the middle", detail: "One bolt through both, with the nut underneath. Then open them into an X.", scene: "brace", kind: "bolts", tools: ["allen"] }, () => {
    k.fits(BOLT, [{ on: br.keys[3], at: [br.mid[0], br.mid[1], br.zOf(3)], dir: [0, 0, 1], mate: br.keys[0] }]);
    k.b.then(0.1);
    k.fits(NUT, [{ on: br.keys[0], at: [br.mid[0], br.mid[1], -D / 2], dir: [0, 0, -1], hole: false }]);
  });
  k.step(
    {
      title: "Bolt the brace across the back",
      detail: "Its four ends go on the back holes of the top and bottom runners; the other four bolts go into the middle runners.",
      kind: "bolts",
      tools: ["allen"],
      check: "square",
    },
    () => {
      k.add(br.keys, [0, 0, -300], 0.15);
      k.fits(FRAME_BOLT, backBolts);
    },
  );
  const wy = runY(n - 1) + 60;
  wallStep(
    k,
    wallFits(
      [
        [-bx, -D / 2],
        [bx, -D / 2],
      ],
      wy,
      -D / 2,
      [posts[3], posts[2]],
    ),
    "",
  );

  // one drawer, built in a scene of its own, then the same for the others
  const d0 = drawers[0];
  const c0: Vec3 = [0, d0.y + Hs / 2, zs];
  const rel = (key: string) => {
    const f = k.final(key);
    return { pos: [f.pos[0] - c0[0], f.pos[1] - c0[1], f.pos[2] - c0[2]] as Vec3, rot: f.rot };
  };
  const f0 = drawerFits(d0);
  const dstep = (o: StepOpts, body: () => void) => k.step({ scene: "drawer", repeat: n, kind: "drawer", ...o }, body);
  dstep({ title: "Hook the sides onto a drawer front", detail: "Push each side's tabs into the slots at the end of the front, then press it down until it locks." }, () => {
    k.stage([d0.front], rel, [0, 0, 200]);
    k.stage(d0.sides, rel, [0, 200, 0], 0.25);
  });
  dstep({ title: "Drop in the bottom and bolt it", detail: "Smooth side up. One bolt through the front and two through each side.", kind: "bolts", tools: ["allen"] }, () => {
    k.stage([d0.bottom], rel, [0, 260, 0]);
    k.fits(BOLT, f0.bottom, 0.1);
  });
  dstep({ title: "Slide the back on and bolt it", detail: "It slides down between the sides from the top. One bolt through each side.", kind: "bolts", tools: ["allen"] }, () => {
    k.stage([d0.back], rel, [0, 220, 0]);
    k.fits(BOLT, f0.back, 0.15);
  });
  dstep({ title: "Turn the drawer over and bolt the bottom to the back", detail: "Three bolts up through the bottom.", kind: "bolts", tools: ["allen"], pose: "-y" }, () => k.fits(BOLT, f0.under, 0.15));
  dstep({ title: "Turn it back and bolt the top corners", detail: "A bolt through each side into the back, held with a nut and the spanner inside.", kind: "bolts", tools: ["allen", "wrench"], pose: "+y" }, () => {
    k.fits(BOLT, f0.top, 0.15);
    k.b.then(0.1);
    k.fits(NUT, f0.nuts, 0.15);
  });
  k.step({ title: "Slide in all four drawers", detail: "Rest each one on its runners and push it in. Open only one drawer at a time.", kind: "drawer", warnings: ["tip"] }, () => {
    const defs: [HwDef, keyof ReturnType<typeof drawerFits>][] = [
      [BOLT, "bottom"],
      [BOLT, "back"],
      [BOLT, "under"],
      [BOLT, "top"],
      [NUT, "nuts"],
    ];
    for (const [i, d] of drawers.entries()) {
      b.stagger(0);
      for (const key of [d.front, ...d.sides, d.bottom, d.back]) b.add(key, [0, 0, 480]);
      if (i > 0) {
        const f = drawerFits(d);
        for (const [def, name] of defs) for (const o of f[name]) b.preset(def, o);
      }
      b.wait(0.22);
    }
  });
  return true;
}

/* ---------- work bench and trolley ---------- */

/*
 * Their manuals: three welded frames (the top one carries the plywood, the others are steel shelves). The top lies
 * upside down on a rug and a post is bolted into each corner through a bracket, hand tight; the middle shelf and
 * then the bottom one are bolted across the posts the same way. The trolley's castors bolt into the post ends with
 * a washer and nut; the bench's posts get feet first. Turned over, every bolt is tightened.
 */
function benchFrames(b: PlanBuilder, s: ProductSpec, castors: boolean) {
  const k = new Kit(b);
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TOP = 18;
  const fw = W - 2 * PT, fd = D - 2 * PT;
  const yTop = H - TOP;
  const y0 = castors ? CASTOR.len : FOOT_H;
  const posts = CORNERS.map(([sx, sz]) => post(k, 0, W, D, sx, sz, y0, yTop));
  const yT = yTop - BEAM / 2;
  // the middle and bottom shelves, read off IKEA's photos
  const yM = (castors ? 720 : 690) - PT - BEAM / 2;
  const yB = (castors ? 385 : 280) - PT - BEAM / 2;
  const top = k.part("Top frame", [fw, BEAM, fd], [0, yT, 0], { pieces: framePieces(fw, fd, { t: TOP, material: "wood", over: PT }) });
  const tray = framePieces(fw, fd, { t: PT, material: "metal", over: -PT });
  const mid = k.part("Shelf", [fw, BEAM, fd], [0, yM, 0], { pieces: tray });
  const low = k.part("Shelf", [fw, BEAM, fd], [0, yB, 0], { pieces: tray });
  const corner = (i: number, frame: string, y: number) => cornerFits(0, W, D, CORNERS[i][0], CORNERS[i][1], y, posts[i], frame);
  const frameStep = (title: string, detail: string, frame: string, y: number) =>
    k.step({ title, detail, kind: "bolts", tools: ["allen"] }, () => {
      const cs = range(4).map((i) => corner(i, frame, y));
      k.add([frame], [0, -300, 0]);
      k.fits(CORNER, cs.map((c) => c.angle), 0.1);
      k.b.then(0.1);
      k.fits(FRAME_BOLT, cs.flatMap((c) => c.bolts));
    });

  if (!castors)
    k.step({ title: "Push a foot onto each post", detail: "Lay the four posts on the floor. The foot slides over the end until it sits tight.", scene: "prep" }, () => {
      k.stage(posts, lying(posts, yTop - y0));
      k.fits(FOOT, CORNERS.map(([sx, sz], i) => footAt(0, W, D, sx, sz, posts[i])), 0.12);
    });
  k.step(
    {
      title: "Bolt the first post to the top",
      detail: "Lay the top upside down on a rug. Hold a bracket inside a corner and bolt the post on through both faces, hand tight for now.",
      kind: "bolts",
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    () => {
      k.add([top]);
      const c = corner(0, top, yT);
      k.fits(CORNER, [c.angle]);
      k.b.then(0.1);
      k.add([posts[0]], [0, -300, 0]);
      k.fits(FRAME_BOLT, c.bolts, 0.12);
    },
  );
  k.step({ title: "Bolt on the other three posts", detail: "A bracket and two bolts in each corner, still hand tight.", kind: "bolts", tools: ["allen"] }, () => {
    const cs = [1, 2, 3].map((i) => corner(i, top, yT));
    k.fits(CORNER, cs.map((c) => c.angle), 0.1);
    k.b.then(0.1);
    k.add(posts.slice(1), [0, -300, 0]);
    k.fits(FRAME_BOLT, cs.flatMap((c) => c.bolts));
  });
  frameStep("Bolt on the middle shelf", "Slide it down the posts to its holes, lip towards the top. A bracket and two bolts in each corner.", mid, yM);
  frameStep("Bolt on the bottom shelf", "On the holes near the ends of the posts, the same way.", low, yB);
  if (castors)
    k.step({ title: "Bolt a castor into each post end", detail: "Washer on the stem, stem through the end plate, then the nut inside, tightened with the spanner.", kind: "legs", tools: ["wrench"] }, () => {
      const at = (i: number): Vec3 => [CORNERS[i][0] * (W / 2 - PA / 2), y0, CORNERS[i][1] * (D / 2 - PA / 2)];
      k.fits(CASTOR_WASHER, range(4).map((i): FitOpts => ({ on: posts[i], at: at(i), dir: [0, 1, 0], hole: false })), 0.1);
      k.b.then(0.1);
      k.fits(CASTOR, range(4).map((i): FitOpts => ({ on: posts[i], at: [at(i)[0], y0 - 2, at(i)[2]], dir: [0, 1, 0], hole: false })), 0.15);
      k.b.then(0.1);
      k.fits(CASTOR_NUT, range(4).map((i): FitOpts => ({ on: posts[i], at: [at(i)[0], y0 + 3, at(i)[2]], dir: [0, -1, 0], hole: false })), 0.1);
    });
  k.step(
    {
      title: "Turn it over and tighten every bolt",
      detail: castors ? "Stand it on its castors, check the shelves are level, then tighten all 24 bolts." : "Stand it on its feet, check it doesn't rock, then tighten all 24 bolts.",
      kind: "bolts",
      tools: ["allen"],
      pose: "+y",
      check: "square",
    },
    () => {},
  );
  return true;
}

/* ---------- shelving units ---------- */

interface Unit {
  xc: number;
  w: number;
  posts: string[]; // front left, front right, back right, back left
  side: string[][]; // left and right side beams, bottom up
  long: string[][]; // front and back long beams, bottom up
  bars: string[];
  shelves: string[];
  brace?: ReturnType<typeof brace>;
  yHi: number;
  yLo: number;
}

const CORNERS: [number, number][] = [
  [-1, 1],
  [1, 1],
  [1, -1],
  [-1, -1],
];

// the grey-green sets come with pine plywood shelves (the black unit with a cabinet keeps steel ones)
const PLYWOOD = /^bror-shelving-unit-(254-x-55-x-190|cabinet-85-x-40-x-190|cabinets-)/;

/** Levels: a tall single 85 wide unit has five, other tall ones four, the low ones three. */
function levelsOf(s: ProductSpec, w: number) {
  const H = s.size.h * 10;
  if (H < 1500) return 3;
  return !s.row && w > 800 ? 5 : 4;
}

/** Where a unit's levels go (the beams' undersides) and which two levels its X spans, when it isn't the post manual's even spread. */
interface Levels {
  ys: number[];
  brace: [number, number] | null;
}

function shelfUnit(k: Kit, s: ProductSpec, xc: number, w: number, lv?: Levels): Unit {
  const H = s.size.h * 10, D = s.size.d * 10;
  const wood = PLYWOOD.test(s.slug ?? "");
  const t = wood ? 9 : 6;
  const ys = lv?.ys ?? spread(150, H - BEAM - t, levelsOf(s, w));
  const n = ys.length;
  const posts = CORNERS.map(([sx, sz]) => post(k, xc, w, D, sx, sz, FOOT_H, H));
  const sideLen = D - 4 * PT, longLen = w - 4 * PT;
  const sidePieces = beamPieces(sideLen, sideLen - 2 * LEDGE);
  const longPieces = beamPieces(longLen);
  const xb = w / 2 - PT - BEAM_DEPTH / 2, zb = D / 2 - PT - BEAM_DEPTH / 2;
  const side = [-1, 1].map((sx) => ys.map((y) => k.part("Side beam", [sideLen, BEAM, BEAM_DEPTH], [xc + sx * xb, y + BEAM / 2, 0], { pieces: sidePieces, rot: [0, (sx * Math.PI) / 2, 0] })));
  const long = [1, -1].map((sz) => ys.map((y) => k.part("Long beam", [longLen, BEAM, BEAM_DEPTH], [xc, y + BEAM / 2, sz * zb], { pieces: longPieces, rot: [0, sz > 0 ? 0 : Math.PI, 0] })));
  const bars = ys.map((y) => k.part("Support bar", [30, 12, D - 4 * PT], [xc, y + BEAM - PT - 6, 0]));
  const shelves = ys.map((y) => k.part(wood ? "Plywood shelf" : "Shelf", [w - 4 * PT, t, D - 4 * PT], [xc, y + BEAM + t / 2, 0], { material: wood ? "wood" : "metal" }));
  // the X spans the top gap of a tall unit, and the whole height of a low one
  const yHi = ys[n - 1] - 18;
  const yLo = (H < 1500 ? ys[0] : ys[n - 2]) + BEAM + 18;
  const span = lv ? lv.brace : null;
  const br = !lv ? brace(k, xc, w / 2 - PA / 2, yLo, yHi, -D / 2) : span ? brace(k, xc, w / 2 - PA / 2, ys[span[0]] + BEAM + 18, ys[span[1]] - 18, -D / 2) : undefined;
  return { xc, w, posts, side, long, bars, shelves, brace: br, yHi, yLo };
}

/** Bolts through the brace ends into the back posts, nuts inside. */
function braceEndFits(u: Unit, D: number) {
  const bolts: FitOpts[] = [], nuts: FitOpts[] = [];
  for (const e of u.brace?.ends ?? []) {
    const postKey = e.at[0] < u.xc ? u.posts[3] : u.posts[2];
    bolts.push({ on: e.key, at: [e.at[0], e.at[1], u.brace!.zOf(e.layer)], dir: [0, 0, 1], mate: postKey });
    nuts.push({ on: postKey, at: [e.at[0], e.at[1], -D / 2 + PT], dir: [0, 0, -1], hole: false });
  }
  return { bolts, nuts };
}

interface ShelvingOpts {
  k?: Kit; // the kit already holding the parts built before the shelving (a cabinet)
  levels?: (w: number) => Levels;
  beforeWall?: (units: Unit[]) => void; // steps between the last brace and the wall fixing
  afterWall?: (units: Unit[]) => void;
}

function shelvingUnits(b: PlanBuilder, s: ProductSpec, widths: number[], o: ShelvingOpts = {}) {
  const k = o.k ?? new Kit(b);
  const H = s.size.h * 10, D = s.size.d * 10;
  const total = widths.reduce((a, w) => a + w, 0);
  let x = -total / 2;
  const units = widths.map((w) => {
    const u = shelfUnit(k, s, x + w / 2, w, o.levels?.(w));
    x += w;
    return u;
  });
  const tall = H >= 1500;
  const people = tall ? 2 : 1;
  const many = units.length > 1;
  const L = H - FOOT_H;
  // posts that stand beside the next unit go in joining feet instead
  const capped = (ui: number, ci: number) => (ci === 1 || ci === 2 ? ui === units.length - 1 : ui === 0);
  const caps = (u: Unit, ui: number, cis: number[]) => cis.filter((ci) => capped(ui, ci)).map((ci) => footAt(u.xc, u.w, D, CORNERS[ci][0], CORNERS[ci][1], u.posts[ci]));
  const inPlace = (key: string) => ({ pos: k.final(key).pos, rot: k.final(key).rot });

  const braceSteps = (u: Unit, ui: number) => {
    if (!u.brace) return;
    const br = u.brace;
    const scene = `brace${ui}`;
    const ends = braceEndFits(u, D);
    k.step({ title: "Hook the brace halves together", detail: "Drop the tabs of one half into the slots of the other and slide it along until it locks. Make two bars.", scene }, () =>
      k.stage(br.keys, braceFlat(k, br.mid), [0, 120, 0], 0.25),
    );
    k.step({ title: "Bolt the bars together where they cross", detail: "The short bolt, with the nut held underneath. Then open them into an X.", scene, kind: "bolts", tools: ["allen"] }, () => {
      k.fits(CROSS_BOLT, [{ on: br.keys[3], at: [br.mid[0], br.mid[1], br.zOf(3)], dir: [0, 0, 1], mate: br.keys[0] }]);
      k.b.then(0.1);
      k.fits(NUT, [{ on: br.keys[0], at: [br.mid[0], br.mid[1], -D / 2], dir: [0, 0, -1], hole: false }]);
    });
    k.step({ title: "Bolt the brace across the back", detail: "A bolt through each end into a back post, with a nut inside. It keeps the shelving square.", kind: "bolts", tools: ["allen"], check: "square" }, () => {
      k.add(br.keys, [0, 0, -300], 0.15);
      k.fits(BOLT, ends.bolts, 0.1);
      k.b.then(0.1);
      k.fits(NUT, ends.nuts, 0.1);
    });
  };
  const levelSteps = (u: Unit, single: boolean) => {
    if (single) {
      k.step({ title: "Click a support bar into each level", detail: "Hook one end over the back beam, swing it down onto the front beam and press until it clicks." }, () => k.add(u.bars, [0, 200, 0], 0.15));
      k.step({ title: "Lay a shelf on each level", detail: "It drops in between the beams and rests on their ledges." }, () => k.add(u.shelves, [0, 260, 0], 0.15));
    } else
      k.step({ title: "Click in the support bars and lay the shelves on", detail: "A bar across the middle of each level, clicked onto the front and back beams, then a shelf on top." }, () => {
        k.add(u.bars, [0, 200, 0], 0.12);
        k.add(u.shelves, [0, 260, 0], 0.12);
      });
  };
  const longFrom = (u: Unit) => (key: string) => (u.long[0].includes(key) ? ([0, 0, 260] as Vec3) : u.long[1].includes(key) ? ([0, 0, -260] as Vec3) : ([260, 0, 0] as Vec3));

  /* the first unit, as the manual builds it */
  const u0 = units[0];
  k.step(
    {
      title: "Push a foot onto each post",
      detail: many ? "The foot slides over the end of the post. Leave it off the two posts that will stand next to the next unit." : "Lay the four posts on the floor. The foot slides over the end until it sits tight.",
      scene: "prep",
    },
    () => {
      k.stage(u0.posts, lying(u0.posts, L));
      k.fits(FOOT, caps(u0, 0, [0, 1, 2, 3]), 0.12);
    },
  );
  k.step(
    {
      title: "Hook the side beams into two posts",
      detail: "Lay the posts on the floor, slots up. Drop each beam's hooks into the slots and tap it down with the plastic block and a hammer.",
      kind: "join",
      tools: ["hammer"],
      pose: "+x",
      warnings: ["floor"],
    },
    () => {
      k.add([u0.posts[0], u0.posts[3]], [0, 0, 0], 0.1);
      k.add(u0.side[0], [220, 0, 0], 0.15);
    },
  );
  k.step({ title: "Build the other side the same way", detail: "Two posts and the same number of side beams, tapped down.", scene: "side0", pose: "-x", tools: ["hammer"] }, () =>
    k.stage([u0.posts[1], u0.posts[2], ...u0.side[1]], inPlace, [-220, 0, 0], 0.12),
  );
  k.step(
    {
      title: "Stand the sides up and hook in the long beams",
      detail: "One of you holds the sides while the other hooks a beam in front and back at every level and taps it down.",
      kind: "join",
      tools: ["hammer"],
      people,
      pose: "+y",
      warnings: people > 1 ? ["two"] : [],
    },
    () => {
      k.add([u0.posts[1], u0.posts[2], ...u0.side[1]], [260, 0, 0], 0.05);
      k.add([...u0.long[0], ...u0.long[1]], longFrom(u0), 0.1);
    },
  );
  levelSteps(u0, true);
  braceSteps(u0, 0);

  /* each unit added beside it */
  for (let ui = 1; ui < units.length; ui++) {
    const u = units[ui], prev = units[ui - 1];
    const xj = u.xc - u.w / 2;
    const joinFeet = [0, 3].map((ci): FitOpts => ({ on: u.posts[ci], at: [xj, 0, CORNERS[ci][1] * (D / 2 - PA / 2)], dir: [0, -1, 0], hole: false }));
    const ys = [H - 250, 250];
    const joinBolts = [0, 3].flatMap((ci) => ys.map((y): FitOpts => ({ on: prev.posts[ci === 0 ? 1 : 2], at: [xj - PT, y, CORNERS[ci][1] * (D / 2 - PA / 2)], dir: [1, 0, 0], mate: u.posts[ci] })));
    const joinNuts = [0, 3].flatMap((ci) => ys.map((y): FitOpts => ({ on: u.posts[ci], at: [xj + PT, y, CORNERS[ci][1] * (D / 2 - PA / 2)], dir: [-1, 0, 0], hole: false })));
    const nth = ui === 1 ? "second" : ui === 2 ? "third" : "next";
    k.step(
      {
        title: `Stand the ${nth} unit's first posts in joining feet`,
        detail: "Slide a joining foot under each post at the end, then stand a new post in it, back to back with the old one.",
        kind: "legs",
      },
      () => {
        k.add([u.posts[0], u.posts[3]], [0, 300, 0], 0.15);
        k.fits(JOIN_FOOT, joinFeet, 0.15);
      },
    );
    k.step({ title: "Bolt the new posts to the old ones", detail: "Two bolts near the top and bottom of each pair, nuts on the new side.", kind: "bolts", tools: ["allen"] }, () => {
      k.fits(BOLT, joinBolts, 0.1);
      k.b.then(0.1);
      k.fits(NUT, joinNuts, 0.1);
    });
    k.step({ title: "Hook the side beams into the new posts", detail: "Tap each one down with the plastic block, the same as before.", kind: "join", tools: ["hammer"] }, () => k.add(u.side[0], [260, 0, 0], 0.12));
    k.step({ title: "Build its far side on the floor", detail: "Feet on two more posts, then hook in the side beams and tap them down.", scene: `side${ui}`, pose: "-x", tools: ["hammer"] }, () => {
      k.stage([u.posts[1], u.posts[2], ...u.side[1]], inPlace, [-220, 0, 0], 0.12);
      k.fits(FOOT, caps(u, ui, [1, 2]), 0.12);
    });
    k.step(
      { title: "Stand it up and hook in the long beams", detail: "Front and back at every level, tapped down.", kind: "join", tools: ["hammer"], people, pose: "+y", warnings: people > 1 ? ["two"] : [] },
      () => {
        k.add([u.posts[1], u.posts[2], ...u.side[1]], [260, 0, 0], 0.05);
        k.add([...u.long[0], ...u.long[1]], longFrom(u), 0.1);
      },
    );
    levelSteps(u, false);
    braceSteps(u, ui);
  }

  const pts: [number, number][] = [];
  const hosts: string[] = [];
  for (const u of units)
    for (const ci of [3, 2]) {
      pts.push([u.xc + CORNERS[ci][0] * (u.w / 2 - PA / 2), -D / 2]);
      hosts.push(u.posts[ci]);
    }
  o.beforeWall?.(units);
  wallStep(k, wallFits(pts, units[0].yHi - 60, -D / 2, hosts), many ? ", two per unit" : "");
  o.afterWall?.(units);
  return true;
}

/* ---------- steel cabinets ---------- */

/*
 * The cabinet manuals. A box of folded steel panels: two base frames with a foot in each end, two sides set on
 * them, a bottom, back panels tipped in through the front and swung up against the back (their tabs pushed over
 * with a flat screwdriver), two wall brackets inside the top back corners, a top laid on and bolted up from below.
 * The bolts go in loose and are tightened once the box is square. The loose shelves rest on clip-in holders and
 * are locked with clips; each door stands on a pivot pin in the bottom and is held at the top by a pin through
 * the top (the low cabinet's bent pin) or a catch clicked up out of the door (the tall one).
 * - Low cabinet (76 x 66): stood up from the start, two back panels, one shelf.
 * - Tall cabinet (85 x 191): its two base frames run across the front and back, with adjustable feet; it's built
 *   lying on its back as far as the base, then stood up for four back panels, a bottom panel and four shelves.
 * - Shelving units with cabinets: the cabinet is built first, the shelving from the post manual with fewer
 *   levels, then a rail is hung on the side posts under each cabinet, the cabinet slid in onto them and bolted,
 *   and two brackets over its top hold it to the back posts.
 */

const LONG_BOLT: HwDef = { kind: "bolt", len: 30, dia: 6 };
const SMALL_SCREW: HwDef = { kind: "screw", len: 8, dia: 4 };
const WALL_BRACKET: HwDef = { kind: "bracket", len: 50, dia: 40 };
const WALL_PLATE: HwDef = { kind: "bracket", len: 40, dia: 24, name: "Wall plate" };
const SHELF_HOLDER: HwDef = { kind: "clip", len: 24, dia: 16, name: "Shelf holder" };
const SHELF_CLIP: HwDef = { kind: "clip", len: 14, dia: 12, name: "Shelf clip" };
const PIVOT: HwDef = { kind: "pin", len: 18, dia: 8, name: "Pivot pin" };
const HINGE_PIN: HwDef = { kind: "pin", len: 70, dia: 6, name: "Hinge pin" };
const HINGE_CATCH: HwDef = { kind: "hinge", len: 40, dia: 16, name: "Hinge catch" };
const ADJ_FOOT: HwDef = { kind: "foot", len: 20, dia: 28 };
const CORNER_PLATE: HwDef = { kind: "angle", len: 30, dia: 30, name: "Corner bracket" };
const CAB_BRACKET: HwDef = { kind: "angle", len: 40, dia: 30, name: "Cabinet bracket" };

const ST = 20; // the folded steel panels, as drawn
const BACK_T = 10;

interface Cab {
  tall: boolean;
  xc: number;
  y0: number; // what it stands on
  W: number;
  H: number;
  D: number;
  yb: number; // underside of the sides' inside, on the base
  yt: number; // underside of the top
  base: string[];
  sides: string[]; // left, right
  bottom: string;
  backs: string[]; // bottom up
  top: string;
  shelves: string[];
  shelfYs: number[];
  doors: string[]; // left, right
}

function cabinet(k: Kit, tall: boolean, xc: number, y0: number, W: number, H: number, D: number): Cab {
  const yt = y0 + H - ST;
  let yb: number, base: string[], sides: string[];
  if (tall) {
    // two frames across the width, front and back, between the sides' bottom ends
    yb = y0 + 50;
    base = [1, -1].map((sz) => k.part("Base frame", [W - 2 * ST, 30, 30], [xc, y0 + 35, sz * (D / 2 - 15)]));
    sides = [-1, 1].map((sx) => k.part("Side panel", [ST, yt - (y0 + 20), D], [xc + sx * (W / 2 - ST / 2), (yt + y0 + 20) / 2, 0]));
  } else {
    // a frame under each side, front to back: a rail on two legs, the plastic feet in the leg ends
    yb = y0 + FOOT_H + 40;
    const pieces: PartPiece[] = [
      { shape: "box", size: [24, 40, 24], pos: [0, 0, -(D / 2 - 12)] },
      { shape: "box", size: [24, 40, 24], pos: [0, 0, D / 2 - 12] },
      { shape: "box", size: [20, 15, D - 48], pos: [0, 12.5, 0] },
    ];
    base = [-1, 1].map((sx) => k.part("Base frame", [24, 40, D], [xc + sx * (W / 2 - 12), y0 + FOOT_H + 20, 0], { pieces }));
    sides = [-1, 1].map((sx) => k.part("Side panel", [ST, yt - yb, D], [xc + sx * (W / 2 - ST / 2), (yt + yb) / 2, 0]));
  }
  const iw = W - 2 * ST;
  const bottom = k.part("Bottom panel", [iw, ST, D - 30], [xc, yb + ST / 2, -5]);
  const nb = tall ? 4 : 2;
  const bh = (yt - yb) / nb;
  const backs = range(nb).map((i) => k.part("Back panel", [iw, bh, BACK_T], [xc, yb + bh * (i + 0.5), -D / 2 + BACK_T / 2]));
  const top = k.part("Top", [W, ST, D], [xc, yt + ST / 2, 0]);
  const ns = tall ? 4 : 1;
  const yIn = yb + ST;
  const shelfYs = range(ns).map((i) => yIn + ((yt - yIn) * (i + 1)) / (ns + 1));
  const shelves = shelfYs.map((y) => k.part("Shelf", [iw - 4, ST, D - 50], [xc, y, -15]));
  // the doors are alike: the right one is the left turned over, so its handle comes to the middle
  const dw = iw / 2 - 2, dh = yt - yb - 4;
  const doorPieces: PartPiece[] = [
    { shape: "box", size: [dw, dh, 16], pos: [0, 0, 0] },
    { shape: "box", size: [14, 56, 14], pos: [dw / 2 - 28, 0, 15] },
  ];
  const doors = [-1, 1].map((sx) => k.part("Door", [dw, dh, 30], [xc + sx * (dw / 2 + 1), (yb + yt) / 2, D / 2 - 8], { pieces: doorPieces, rot: [0, 0, sx < 0 ? 0 : Math.PI] }));
  return { tall, xc, y0, W, H, D, yb, yt, base, sides, bottom, backs, top, shelves, shelfYs, doors };
}

type Group = [HwDef, (c: Cab) => FitOpts[]];
const sx2 = [-1, 1];

/* the fittings, as functions of a cabinet so a second one built the same way can carry them too */
const cabFits = {
  feet: (c: Cab): FitOpts[] =>
    c.tall
      ? sx2.flatMap((sx) => sx2.map((sz): FitOpts => ({ on: c.sides[sx < 0 ? 0 : 1], at: [c.xc + sx * (c.W / 2 - ST / 2), c.y0 + 20, sz * (c.D / 2 - 15)], dir: [0, 1, 0], hole: false })))
      : sx2.flatMap((sx) => sx2.map((sz): FitOpts => ({ on: c.base[sx < 0 ? 0 : 1], at: [c.xc + sx * (c.W / 2 - 12), c.y0 + FOOT_H, sz * (c.D / 2 - 12)], dir: [0, 1, 0], hole: false }))),
  // the low box: three loose bolts in each side, two for the bottom and one high at the back
  boxBolts: (c: Cab): FitOpts[] =>
    sx2.flatMap((sx) => {
      const on = c.sides[sx < 0 ? 0 : 1], x = c.xc + sx * (c.W / 2 - ST);
      return [
        { on, at: [x, c.yb + ST / 2, c.D / 2 - 50], dir: [sx, 0, 0], mate: c.bottom },
        { on, at: [x, c.yb + ST / 2, -c.D / 2 + 40], dir: [sx, 0, 0], mate: c.bottom },
        { on, at: [x, c.yt - 30, -c.D / 2 + 25], dir: [sx, 0, 0], mate: c.backs[c.backs.length - 1] },
      ] as FitOpts[];
    }),
  // the tall box: a bolt through each side into each base frame's end, then a corner bracket over each joint
  frameBolts: (c: Cab): FitOpts[] => sx2.flatMap((sx, si) => sx2.map((sz, fi): FitOpts => ({ on: c.sides[si], at: [c.xc + sx * (c.W / 2), c.y0 + 35, sz * (c.D / 2 - 15)], dir: [-sx, 0, 0], mate: c.base[fi] }))),
  corners: (c: Cab): FitOpts[] => sx2.flatMap((sx, si) => sx2.map((sz): FitOpts => ({ on: c.sides[si], at: [c.xc + sx * (c.W / 2 - ST), c.y0 + 62, sz * (c.D / 2 - 45)], dir: [sx, 0, 0], hole: false }))),
  cornerBolts: (c: Cab): FitOpts[] => sx2.flatMap((sx, si) => sx2.map((sz): FitOpts => ({ on: c.sides[si], at: [c.xc + sx * (c.W / 2 - ST - 2), c.y0 + 62, sz * (c.D / 2 - 45)], dir: [sx, 0, 0], mate: c.base[sz > 0 ? 0 : 1] }))),
  // where a back panel meets the one above it, a bolt through each side
  backBolts: (i: number) => (c: Cab): FitOpts[] => {
    const y = c.yb + ((c.yt - c.yb) * (i + 1)) / c.backs.length - (i === c.backs.length - 1 ? 30 : 0);
    return sx2.map((sx, si): FitOpts => ({ on: c.sides[si], at: [c.xc + sx * (c.W / 2 - ST), y, -c.D / 2 + 22], dir: [sx, 0, 0], mate: c.backs[i] }));
  },
  brackets: (c: Cab): FitOpts[] => sx2.map((sx, si): FitOpts => ({ on: c.sides[si], at: [c.xc + sx * (c.W / 2 - ST), c.yt - 40, -c.D / 2 + 40], dir: [sx, 0, 0], hole: false })),
  bracketScrews: (c: Cab): FitOpts[] => sx2.flatMap((sx, si) => [-12, 12].map((dy): FitOpts => ({ on: c.sides[si], at: [c.xc + sx * (c.W / 2 - ST - 2), c.yt - 40 + dy, -c.D / 2 + 30], dir: [sx, 0, 0] }))),
  // from inside the side's fold, up into the top
  topBolts: (c: Cab): FitOpts[] => sx2.flatMap((sx, si) => sx2.map((sz): FitOpts => ({ on: c.sides[si], at: [c.xc + sx * (c.W / 2 - ST / 2), c.yt - 12, sz * (c.D / 2 - 40)], dir: [0, 1, 0], mate: c.top }))),
};

/** The box, built as its manual does: in the main scene for a cabinet on its own, in a scene of its own when it goes into a shelving unit. */
function cabinetBox(k: Kit, cabs: Cab[], scene?: string): Group[] {
  const c = cabs[0];
  const groups: Group[] = [];
  const repeat = cabs.length > 1 ? cabs.length : undefined;
  const fit = (def: HwDef, fn: (c: Cab) => FitOpts[], gap = 0.08) => {
    groups.push([def, fn]);
    k.fits(def, fn(c), gap);
  };
  const rel = (key: string) => {
    const f = k.final(key);
    return { pos: [f.pos[0] - c.xc, f.pos[1] - c.y0, f.pos[2]] as Vec3, rot: f.rot };
  };
  const put = (keys: string[], from: Vec3, gap = 0.2) => (scene ? k.stage(keys, rel, from, gap) : k.add(keys, from, gap));
  const step = (o: StepOpts, body: () => void) => k.step({ scene, repeat, ...o }, body);
  const tabs = (title: string, n: number, where: string) => step({ title, detail: `Push the ${n} tabs ${where} over with a flat screwdriver so the panel can't come out.`, tools: ["flathead"] }, () => {});

  if (c.tall) {
    step({ title: "Screw a foot into each end of the base frames", detail: "Turn them in by hand, all the way.", kind: "legs", pose: "+y" }, () => {
      put(c.base, [0, 200, 0]);
      fit(ADJ_FOOT, cabFits.feet, 0.12);
    });
    step({ title: "Push the base frames into a side", detail: "Lay the side on its edge on a rug, holes in, and push both frame ends into the slots at its bottom end.", kind: "join", pose: "+z", warnings: ["floor"] }, () => put([c.sides[0]], [-300, 0, 0]));
    step({ title: "Push the other side onto the frames", kind: "join" }, () => put([c.sides[1]], [300, 0, 0]));
    step({ title: "Turn in four bolts", detail: "One through each side into each frame end. Leave them a few turns loose for now.", kind: "bolts", tools: ["allen"] }, () => fit(BOLT, cabFits.frameBolts));
    step({ title: "Clip on the corner brackets and bolt them", detail: "One over each frame joint inside the sides, then a bolt through each, tightened.", kind: "bolts", tools: ["allen"] }, () => {
      fit(CORNER_PLATE, cabFits.corners, 0.1);
      k.b.then(0.1);
      fit(BOLT, cabFits.cornerBolts);
    });
    c.backs.forEach((b, i) => {
      const nth = ["bottom", "second", "third", "top"][i];
      step(
        {
          title: i ? `Swing in the ${nth} back panel` : "Stand it up and swing in the bottom back panel",
          detail: i ? "Its lower edge goes behind the top of the panel under it." : "Stand the box on its feet. Tip the panel in through the front, then swing it up against the back.",
          kind: "join",
          pose: "+y",
          people: i ? 1 : 2,
          warnings: i ? [] : ["two"],
        },
        () => put([b], [0, 0, 400]),
      );
      tabs("Lock it with the tabs", 9, "along its sides");
      if (i) step({ title: "Bolt the panel joint to the sides", detail: "One bolt in each side where the panels meet. Leave them loose.", kind: "bolts", tools: ["allen"] }, () => fit(BOLT, cabFits.backBolts(i - 1)));
    });
  } else {
    step({ title: "Push a foot into each end of the base frames", detail: "They press into the open ends of the legs.", kind: "legs", pose: "+y" }, () => {
      put(c.base, [0, 200, 0]);
      fit(FOOT, cabFits.feet, 0.12);
    });
    step({ title: "Stand the sides on the base frames", detail: "The legs slide up into the sides' bottom corners, holes facing in.", kind: "join" }, () => put(c.sides, [0, 300, 0]));
    step({ title: "Set in the bottom and turn in six bolts", detail: "Three in each side: two for the bottom, one high at the back. Leave each a few turns out for now.", kind: "bolts", tools: ["allen"] }, () => {
      put([c.bottom], [0, 300, 0]);
      fit(BOLT, cabFits.boxBolts);
    });
    step({ title: "Swing the lower back panel into place", detail: "Tip it in through the front, then swing it up against the back.", kind: "join" }, () => put([c.backs[0]], [0, 0, 400]));
    tabs("Lock it with the tabs", 6, "along its sides");
    step({ title: "Swing in the upper back panel", detail: "Its lower edge goes behind the top of the lower panel.", kind: "join" }, () => put([c.backs[1]], [0, 0, 400]));
    tabs("Lock it with the tabs", 7, "along its sides");
  }
  step({ title: "Screw a wall bracket into each top back corner", detail: "Two screws each. Leave them a little loose so the top can go on.", kind: "screws", tools: ["screwdriver"], people: 1 }, () => {
    fit(WALL_BRACKET, cabFits.brackets, 0.15);
    k.b.then(0.1);
    fit(SMALL_SCREW, cabFits.bracketScrews);
  });
  if (c.tall) {
    step({ title: "Push up the tabs in the top", detail: "Lay the top upside down and lever its four corner tabs up with a flat screwdriver.", tools: ["flathead"] }, () => {
      k.stage([c.top], (key) => {
        const f = k.final(key);
        return { pos: [f.pos[0], ST / 2, f.pos[2] + c.D + 200] as Vec3, rot: [Math.PI, 0, 0] as Vec3 };
      });
    });
  }
  step({ title: "Lay the top on", detail: "Its folded edge goes down over the front of the sides.", kind: "join", people: c.tall ? 2 : 1, warnings: c.tall ? ["two"] : [] }, () => put([c.top], [0, 300, 0]));
  tabs("Lock the top with the tabs", 3, "at the back of the top");
  step({ title: "Bolt the top on from below", detail: "Four long bolts up through the tops of the sides.", kind: "bolts", tools: ["allen"] }, () => fit(LONG_BOLT, cabFits.topBolts));
  if (c.tall) step({ title: "Level it on its feet", detail: "Turn the feet until it stands level and doesn't rock.", kind: "legs", check: "square" }, () => {});
  step({ title: "Tighten the bracket screws", detail: "Both screws in each wall bracket, all the way.", kind: "screws", tools: ["screwdriver"] }, () => {});
  if (c.tall) {
    step({ title: "Tighten the bolts under the top", detail: "The two at the top back panel joint.", kind: "bolts", tools: ["allen"] }, () => {});
    step({ title: "Tighten the eight bolts lower down", detail: "The panel joints and the base frames, both sides.", kind: "bolts", tools: ["allen"], check: "square" }, () => {});
    step({ title: "Lay the bottom panel in", detail: "Tilt it in and let it drop onto the base frames.", kind: "join" }, () => put([c.bottom], [0, 200, 300]));
  } else step({ title: "Tighten the six bolts", detail: "Check the box stands square first.", kind: "bolts", tools: ["allen"], check: "square" }, () => {});
  return groups;
}

function cabWall(k: Kit, c: Cab) {
  const plates = sx2.map((sx): FitOpts => ({ on: c.backs[c.backs.length - 1], at: [c.xc + sx * (c.W / 2 - ST - 20), c.yt - 40, -c.D / 2], dir: [0, 0, 1], hole: false }));
  k.step(
    {
      title: "Fix it to the wall",
      detail: "Hook a wall plate onto each bracket through the back, mark the wall through it and screw it on. Wall screws and plugs aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      k.fits(WALL_PLATE, plates, 0.15);
      k.b.then(0.1);
      k.fits(HW.plug, plates.map((p) => ({ at: [p.at[0], p.at[1], -c.D / 2 - 40] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.12);
      k.b.then(0.05);
      k.fits(HW.wallScrew, plates.map((p) => ({ on: p.on, at: [p.at[0], p.at[1], -c.D / 2 + 2] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })), 0.12);
    },
  );
}

/** Shelves and doors, in every cabinet at once. */
function cabFinish(k: Kit, cabs: Cab[]) {
  const all = <T,>(fn: (c: Cab) => T[]) => cabs.flatMap(fn);
  const each = cabs.length > 1 ? " in each cabinet" : "";
  const c0 = cabs[0];
  const corners = (c: Cab, y: number, x: number) => sx2.flatMap((sx, si) => [-c.D / 2 + 45, c.D / 2 - 70].map((z) => ({ si, at: [c.xc + sx * x, y, z] as Vec3, sx })));
  const holders = all((c) => c.shelfYs.flatMap((y) => corners(c, y - ST / 2 - 8, c.W / 2 - ST).map((p): FitOpts => ({ on: c.sides[p.si], at: p.at, dir: [p.sx, 0, 0], hole: false }))));
  const clips = all((c) => c.shelves.flatMap((sh, i) => corners(c, c.shelfYs[i] + ST / 2, c.W / 2 - ST - 6).map((p): FitOpts => ({ on: sh, at: p.at, dir: [0, -1, 0], hole: false }))));
  const hx = (c: Cab, sx: number) => c.xc + sx * (c.W / 2 - ST - 14);
  if (!c0.tall) {
    k.step({ title: `Tip the shelf in${each}`, detail: "Tilt it in through the front and lay it on the bottom for now.", kind: "shelves" }, () =>
      k.stage(all((c) => c.shelves), (key) => {
        const f = k.final(key);
        const c = cabs.find((x) => x.shelves.includes(key))!;
        return { pos: [f.pos[0], c.yb + ST * 1.5, f.pos[2]] as Vec3, rot: f.rot };
      }, [0, 0, 300]),
    );
  }
  k.step({ title: `Clip in the shelf holders${each}`, detail: c0.tall ? "Four for each shelf, hooked into the slots in the sides at the heights you want." : "Four of them, hooked into the slots in the sides at the height you want.", kind: "shelves" }, () =>
    k.fits(SHELF_HOLDER, holders, 0.05),
  );
  k.step({ title: c0.tall ? "Lay the four shelves on" : `Lift the shelf onto the holders${each}`, detail: "Tilt each shelf in and lower it until it rests on all four holders.", kind: "shelves" }, () =>
    k.add(all((c) => c.shelves), c0.tall ? [0, 0, 300] : [0, -150, 0], 0.15),
  );
  k.step({ title: `Lock the shelves with the clips${each}`, detail: "A clip over each holder, pressed down onto the shelf.", kind: "shelves" }, () => k.fits(SHELF_CLIP, clips, 0.05));
  k.step({ title: `Push the pivot pins into the bottom${each}`, detail: "One in each front corner, collar down.", kind: "doors" }, () =>
    k.fits(PIVOT, all((c) => sx2.map((sx): FitOpts => ({ on: c.bottom, at: [hx(c, sx), c.yb + ST, c.D / 2 - 24], dir: [0, -1, 0] }))), 0.1),
  );
  for (const [di, side] of ["left", "right"].entries()) {
    k.step(
      {
        title: di ? `Hang the right door the same way${each}` : `Stand the left door on its pin${each}`,
        detail: di ? "On its pin, swung in at the top." : "Fit the hole in its bottom corner over the pin, then swing it in at the top.",
        kind: "doors",
      },
      () => k.add(all((c) => [c.doors[di]]), [0, 60, 300]),
    );
    k.step(
      {
        title: c0.tall ? `Click up the ${side} door's hinge catch` : `Drop the hinge pin through the top`,
        detail: c0.tall ? "Push the catch at the door's top corner up into the hole in the top until it clicks." : `Down through the top into the ${side} door, then turn its bent end flat.`,
        kind: "doors",
      },
      () =>
        c0.tall
          ? k.fits(HINGE_CATCH, all((c) => [{ on: c.doors[di], at: [hx(c, di ? 1 : -1), c.yt - 12, c.D / 2 - 10] as Vec3, dir: [0, 1, 0] as Vec3, mate: c.top }]), 0.1)
          : k.fits(HINGE_PIN, all((c) => [{ on: c.top, at: [hx(c, di ? 1 : -1), c.yt + ST, c.D / 2 - 10] as Vec3, dir: [0, -1, 0] as Vec3, mate: c.doors[di] }]), 0.1),
    );
  }
  if (c0.tall) k.step({ title: "Line up the doors", detail: "If the tops don't meet in a straight line, turn a front foot up or down.", kind: "legs" }, () => {});
}

function standaloneCabinet(b: PlanBuilder, s: ProductSpec, tall: boolean) {
  const k = new Kit(b);
  const c = cabinet(k, tall, 0, 0, s.size.w * 10, s.size.h * 10, s.size.d * 10);
  cabinetBox(k, [c]);
  cabWall(k, c);
  cabFinish(k, [c]);
  return true;
}

/** A shelving unit (or two side by side) with a low cabinet hung in each, on rails under it and brackets over it. */
function cabinetShelving(b: PlanBuilder, s: ProductSpec, widths: number[]) {
  const k = new Kit(b);
  const H = s.size.h * 10, D = s.size.d * 10;
  const tall = H >= 1500;
  const t = PLYWOOD.test(s.slug ?? "") ? 9 : 6;
  const yTop = H - BEAM - t;
  // the tall unit: three levels over the cabinet, the X across the upper two gaps; the low one: only the top
  const levels: Levels = tall ? { ys: [yTop - 800, yTop - 400, yTop], brace: [0, 2] } : { ys: [yTop], brace: null };
  const yc = tall ? 40 : 240; // the rails' ledge, under the cabinet
  const CW = 760, CH = 660;
  const total = widths.reduce((a, w) => a + w, 0);
  const xs = widths.map((w, i) => -total / 2 + widths.slice(0, i).reduce((a, x) => a + x, 0) + w / 2);
  const cabs = xs.map((x) => cabinet(k, false, x, yc, CW, CH, D));
  const LW = 60, LEN = D - 4 * PT;
  const railPieces: PartPiece[] = [
    { shape: "box", size: [PT, 40, LEN], pos: [LW / 2 - PT / 2, 0, 0] },
    { shape: "box", size: [LW, PT, LEN], pos: [0, -20 + PT / 2, 0] },
  ];
  const rails = xs.map((x, i) => sx2.map((sx) => k.part("Cabinet rail", [LW, 40, LEN], [x + sx * (widths[i] / 2 - PT - LW / 2), yc + 20 - PT, 0], { pieces: railPieces, rot: [0, sx > 0 ? 0 : Math.PI, 0] })));

  const groups = cabinetBox(k, cabs, "cabinet");
  const n = cabs.length;
  const each = n > 1 ? " in each unit" : "";
  shelvingUnits(b, s, widths, {
    k,
    levels: () => levels,
    beforeWall: () =>
      k.step({ title: `Hang a rail on each side${each}`, detail: "Low down on the side posts: drop each rail's keyholes over the studs so its ledge points in.", kind: "join" }, () => k.add(rails.flat(), [0, 200, 0], 0.15)),
    afterWall: () => {
      k.step(
        { title: n > 1 ? "Slide the cabinets in onto the rails" : "Slide the cabinet in onto the rails", detail: "From the front, base frames on the rails' ledges, until its back is against the back posts.", kind: "join", people: 2, warnings: ["two"] },
        () => {
          for (const [i, c] of cabs.entries()) {
            const keys = [...c.base, ...c.sides, c.bottom, ...c.backs, c.top];
            b.stagger(0);
            for (const key of keys) b.add(key, [0, 0, 500]);
            if (i > 0) for (const [def, fn] of groups) for (const o of fn(c)) b.preset(def, o);
            b.wait(0.3);
          }
        },
      );
      const bottomBolts = cabs.flatMap((c, i) => sx2.map((sx, si): FitOpts => ({ on: rails[i][si], at: [c.xc + sx * (CW / 2 - 12), yc - PT, D / 2 - 12], dir: [0, 1, 0], mate: c.base[si] })));
      k.step({ title: n > 1 ? "Bolt the cabinets to the rails" : "Bolt the cabinet to the rails", detail: "One bolt up through each rail into the base frame above it, near the front.", kind: "bolts", tools: ["allen"] }, () => k.fits(BOLT, bottomBolts, 0.12));
      const over = cabs.flatMap((c) => sx2.map((sx, si): FitOpts => ({ on: c.top, at: [c.xc + sx * (CW / 2 - 20), c.yt + ST, -D / 2 + 30], dir: [0, -1, 0], hole: false, mate: c.sides[si] })));
      k.step({ title: n > 1 ? "Hook a bracket over each cabinet top corner" : "Hook a bracket over the cabinet top", detail: "One at each back corner, its tab hooked into the back post.", kind: "join" }, () => k.fits(CAB_BRACKET, over, 0.12));
      k.step({ title: "Bolt the brackets down", detail: "One bolt through each bracket into the cabinet top.", kind: "bolts", tools: ["allen"] }, () =>
        k.fits(BOLT, over.map((o) => ({ ...o, at: [o.at[0], o.at[1] + 2, o.at[2]] as Vec3, hole: undefined, mate: undefined })), 0.12),
      );
      cabFinish(k, cabs);
    },
  });
  return true;
}

/* ---------- family ---------- */

const family: Family = {
  names: ["BROR"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (/^bror-work-bench-drawers/.test(slug)) return drawerBench(b, s);
    if (/^bror-shelving-unit-\d/.test(slug) && !s.row) return shelvingUnits(b, s, [s.size.w * 10]);
    if (/^bror-trolley/.test(slug)) return benchFrames(b, s, true);
    if (/^bror-work-bench-\d/.test(slug)) return benchFrames(b, s, false);
    if (/^bror-cabinet-2-doors/.test(slug)) return standaloneCabinet(b, s, false);
    if (/^bror-cabinet-doors/.test(slug)) return standaloneCabinet(b, s, true);
    if (/^bror-shelving-unit-cabinet-/.test(slug) && !s.row) return cabinetShelving(b, s, [s.size.w * 10]);
    return false;
  },
  row(b, s) {
    const slug = s.slug ?? "";
    if (/^bror-shelving-unit-cabinets-/.test(slug) && s.row) return cabinetShelving(b, s, s.row.units?.map((u) => u.w * 10) ?? range(s.row.n).map(() => (s.size.w * 10) / s.row!.n));
    if (!/^bror-shelving-unit-\d/.test(slug) || s.row?.of !== "open") return false;
    const units = s.row.units?.map((u) => u.w * 10) ?? range(s.row.n).map(() => (s.size.w * 10) / s.row!.n);
    return shelvingUnits(b, s, units);
  },
};
export default family;
