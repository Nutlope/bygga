import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { POSE_EULER, rotate, unrotate } from "../math";

/**
 * TROTTEN, from IKEA's manuals. Everything is steel that bolts, clicks or hooks together; nothing is glued or doweled.
 * Desk: two A-shaped leg frames are built upside down on their top arms, joined by a telescopic beam locked with
 * eight bolts and nuts, then lowered onto the top lying face down and turned over by two people.
 * Sit/stand desk: built standing. Brackets and lifting columns bolt onto the leg bases, the beam halves slide on,
 * the motor and drive shafts go in, then the arms, the control box, the top, the cable tray and the hole covers.
 * Cabinets: a base of two rails with legs and a bottom panel, side panels that drop over the legs, backs that slide
 * down into slots and are locked by bending tabs, a top that slides back onto hooks, shelves on clips or hooks.
 * Sliding doors tilt into their tracks; hinged doors drop onto pins and click into catches at the top. The tall
 * sliding cabinet has open ladder frames above, the cabinets with doors an open frame (and on the tall one a second
 * cabinet) above. The drawer units: a trestle with a mesh shelf and one drawer, and a cabinet on castors with three.
 */

type Mat = PartMaterial;
interface Part {
  id: string;
  name: string;
  size: Vec3;
  pos: Vec3;
  rot?: Vec3;
  pieces?: PartPiece[];
  material?: Mat;
  shape?: "box" | "cyl";
}
type Add = string | [string, Vec3];
interface Fix {
  def: HwDef;
  at: Vec3[];
  dir: Vec3 | ((p: Vec3, i: number) => Vec3);
  on: string | ((p: Vec3, i: number) => string);
  mate?: string | ((p: Vec3, i: number) => string | undefined);
  flat?: boolean;
  travel?: number;
}
interface St {
  title: string;
  detail?: string;
  kind?: StepKind;
  tools?: ToolId[];
  people?: 1 | 2;
  pose?: Pose;
  warnings?: WarnId[];
  repeat?: number;
  wall?: boolean;
  scene?: string;
  add?: Add[];
  fix?: Fix[];
  stage?: { id: string; at: Vec3; from?: Vec3 }[];
  preset?: Fix[]; // fittings already on parts that arrive built
}

const pp = (shape: "box" | "cyl", size: Vec3, pos: Vec3, rot?: Vec3): PartPiece => ({ shape, size, pos, ...(rot ? { rot } : {}) });

/** Parts placed where they sit in the finished product, and steps that add them and their fittings. */
class Kit {
  private refs = new Map<string, string>();
  private keys = new Map<string, string>();
  private pose: Pose = "+y";
  constructor(public b: PlanBuilder) {}

  part(p: Part) {
    const mat = p.material ?? "metal";
    const rod = p.shape === "cyl" && Math.max(p.size[0], p.size[2]) > p.size[1] * 1.5;
    const size: Vec3 = rod ? (p.size[0] >= p.size[2] ? [p.size[1], p.size[0], p.size[2]] : [p.size[0], p.size[2], p.size[1]]) : p.size;
    const tk = `${p.name}|${size.map((n) => Math.round(n)).join("x")}|${p.shape ?? "box"}|${mat}|${p.pieces ? JSON.stringify(p.pieces) : ""}`;
    let ref = this.refs.get(tk);
    if (!ref) {
      ref = this.b.part(p.name, size.map((n) => Math.round(n * 10) / 10) as Vec3, { shape: p.shape ?? "box", material: mat });
      if (p.pieces) this.b.parts[this.b.parts.length - 1].pieces = p.pieces;
      this.refs.set(tk, ref);
    }
    const rot: Vec3 = p.rot ?? (rod ? (p.size[0] >= p.size[2] ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]) : [0, 0, 0]);
    this.keys.set(p.id, this.b.place(ref, p.pos, rot));
  }

  /** A part welded from several pieces, given where they sit in the finished product. */
  weld(id: string, name: string, pieces: PartPiece[], material: Mat = "metal") {
    const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of pieces)
      for (const a of [-1, 1])
        for (const c of [-1, 1])
          for (const e of [-1, 1]) {
            const v = rotate([(a * p.size[0]) / 2, (c * p.size[1]) / 2, (e * p.size[2]) / 2], p.rot ?? [0, 0, 0]);
            for (let i = 0; i < 3; i++) {
              lo[i] = Math.min(lo[i], p.pos[i] + v[i]);
              hi[i] = Math.max(hi[i], p.pos[i] + v[i]);
            }
          }
    const r = (n: number) => Math.round(n * 10) / 10;
    const mid: Vec3 = [0, 1, 2].map((i) => r((lo[i] + hi[i]) / 2)) as Vec3;
    const rel = pieces.map((p) => ({ ...p, pos: [0, 1, 2].map((i) => r(p.pos[i] - mid[i])) as Vec3 }));
    this.part({ id, name, size: [0, 1, 2].map((i) => r(hi[i] - lo[i])) as Vec3, pos: mid, pieces: rel, material });
  }

  k(id: string) {
    const k = this.keys.get(id);
    if (!k) throw new Error("TROTTEN: no part " + id);
    return k;
  }
  has(id: string) {
    return this.keys.has(id);
  }
  pos(id: string) {
    return this.b.partItem(this.k(id)).final.pos;
  }

  list(f: Fix): FitOpts[] {
    return f.at.map((at, i) => {
      const mate = typeof f.mate === "function" ? f.mate(at, i) : f.mate;
      return {
        on: this.k(typeof f.on === "function" ? f.on(at, i) : f.on),
        at,
        dir: typeof f.dir === "function" ? f.dir(at, i) : f.dir,
        ...(mate ? { mate: this.k(mate) } : {}),
        ...(f.flat ? { hole: false as const } : {}),
        ...(f.travel ? { travel: f.travel } : {}),
      };
    });
  }

  step(st: St) {
    const scene = st.scene ?? "main";
    if (scene === "main") this.pose = st.pose ?? this.pose;
    const pose = scene === "main" ? this.pose : (st.pose ?? "+y");
    const kind: StepKind = st.kind ?? (st.add?.length ? "join" : st.fix?.length ? "screws" : "general");
    const warnings = [...(st.warnings ?? []), ...(st.people === 2 && !st.warnings?.includes("two") ? (["two"] as WarnId[]) : [])];
    const above = unrotate([0, 320, 0], POSE_EULER[pose]).map((n) => Math.round(n)) as Vec3;
    this.b.step({ title: st.title, detail: st.detail, kind, tools: st.tools ?? [], people: st.people ?? 1, pose, warnings: warnings.slice(0, 3), repeat: st.repeat, wall: st.wall, scene }, () => {
      const b = this.b;
      if (st.stage?.length) {
        b.stagger(0.22);
        for (const s of st.stage) b.stage(this.k(s.id), s.at, [0, 0, 0], s.from ?? above);
        b.then(0.12);
      }
      if (st.add?.length) {
        b.stagger(st.add.length > 3 ? 0.16 : 0.24);
        for (const a of st.add) {
          const [id, from] = typeof a === "string" ? [a, above] : a;
          b.add(this.k(id), from);
        }
        b.then(0.12);
      }
      for (const f of st.fix ?? []) {
        b.fits(f.def, this.list(f), Math.min(0.08, 2.4 / Math.max(1, f.at.length * 4)));
        b.then(0.08);
      }
      for (const f of st.preset ?? []) for (const o of this.list(f)) b.preset(f.def, o);
    });
  }
}

const S = (len: number, dia: number, name?: string): HwDef => ({ kind: "screw", len, dia, ...(name ? { name } : {}) });
const B = (len: number, dia: number, name?: string): HwDef => ({ kind: "bolt", len, dia, ...(name ? { name } : {}) });
const sides = [-1, 1] as const;
const idx = (sx: number) => (sx > 0 ? 1 : 0);
/** A tube from one point to another (y, z), drawn as a box turned about x. */
function strut(x: number, a: [number, number], c: [number, number], t: number): { size: Vec3; pos: Vec3; rot: Vec3 } {
  const dy = a[0] - c[0], dz = a[1] - c[1];
  const len = Math.hypot(dy, dz);
  return { size: [t, len, t], pos: [x, (a[0] + c[0]) / 2, (a[1] + c[1]) / 2], rot: [Math.atan2(dz, dy), 0, 0] };
}

/* ---------- desk ---------- */

function desk(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = 750, TT = 20;
  const xa = W / 2 - 130, aL = D - 100, yA = H - TT, apex = yA - 30;
  const kit = new Kit(b);
  kit.part({ id: "T", name: "Tabletop", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "board" });
  for (const sx of sides) {
    const i = idx(sx);
    kit.part({ id: `A${i}`, name: "Top arm", size: [40, 30, aL], pos: [sx * xa, yA - 15, 0] });
    for (const sz of sides) {
      const l = strut(sx * xa, [apex, sz * 25], [0, sz * (D / 2 - 60)], 40);
      kit.part({ id: `L${i}${idx(sz)}`, name: "Leg", ...l });
    }
  }
  const hl = xa - 20 + 150;
  kit.part({ id: "B0", name: "Beam, outer half", size: [hl, 40, 60], pos: [-(xa - 20) + hl / 2, yA - 20, 0] });
  kit.part({ id: "B1", name: "Beam, inner half", size: [hl, 34, 50], pos: [xa - 20 - hl / 2, yA - 20, 0] });

  const CARRIAGE = B(45, 8, "Carriage bolt"), INSERT: HwDef = { kind: "connector", len: 40, dia: 30, name: "Joining insert" };
  const FLANGE = B(12, 8, "Flange bolt"), BOLT8 = B(16, 8), NUT8: HwDef = { kind: "nut", len: 7, dia: 8, name: "Flange nut" };
  const BOLT6 = B(12, 6), NUT6: HwDef = { kind: "nut", len: 6, dia: 6, name: "Nut" };
  const HOOK: HwDef = { kind: "hook", len: 60, dia: 30, name: "Bag hook" };
  const frame = (i: number) => {
    const sx = i ? 1 : -1;
    return {
      carriage: { def: CARRIAGE, at: sides.map((sz) => [sx * xa, yA - 2, sz * 25] as Vec3), dir: [0, -1, 0] as Vec3, on: `A${i}`, mate: (p: Vec3) => `L${i}${idx(p[2])}` },
      insert: { def: INSERT, at: [[sx * xa, apex - 20, 0] as Vec3], dir: [0, 0, 1] as Vec3, on: `A${i}`, flat: true },
      flange: { def: FLANGE, at: sides.map((sz) => [sx * (xa - 45), yA - 40, sz * 15] as Vec3), dir: [0, 1, 0] as Vec3, on: `B${i}` },
      side: { def: BOLT8, at: sides.map((sz) => [sx * (xa + 20), apex - 5, sz * 30] as Vec3), dir: [-sx, 0, 0] as Vec3, on: (p: Vec3) => `L${i}${idx(p[2])}`, mate: `B${i}` },
      cross: { def: BOLT8, at: [apex - 40, apex - 22].map((y) => [sx * xa, y, 62] as Vec3), dir: [0, 0, -1] as Vec3, on: `L${i}1`, mate: `L${i}0` },
      nuts: { def: NUT8, at: [apex - 40, apex - 22].map((y) => [sx * xa, y, -62] as Vec3), dir: [0, 0, 1] as Vec3, on: `L${i}0`, flat: true },
    };
  };
  const f0 = frame(0), f1 = frame(1);
  const lock = [-120, -40, 40, 120].flatMap((x) => sides.map((sz) => [x, yA - 20, sz * 30] as Vec3));
  const ends = sides.flatMap((sx) => [-(aL / 2 - 20), -(aL / 2 - 50), aL / 2 - 20].map((z) => [sx * xa, yA - 30, z] as Vec3));
  const hooks = sides.map((sx) => [sx * (xa + 50), yA, aL / 2 - 40] as Vec3);
  const P: Pose = "-y";
  const side: Vec3 = [700, 0, 0];

  kit.step({ title: "Push two carriage bolts through a top arm", detail: "Lay the arm on a rug, open side up. The square necks lock into the holes.", pose: P, kind: "bolts", warnings: ["floor"], add: ["A0"], fix: [f0.carriage] });
  kit.step({ title: "Push the joining insert into one leg", detail: "It joins the two legs where they meet over the arm.", kind: "join", fix: [f0.insert] });
  kit.step({ title: "Press the joined legs down onto the bolts", detail: "Both bolts go up into the corner where the legs meet.", add: ["L00", "L01"] });
  kit.step({ title: "Fix the outer beam half to the joint", detail: "Two flange bolts, with the large Allen key.", kind: "bolts", tools: ["allen"], add: [["B0", [400, 0, 0]]], fix: [f0.flange] });
  kit.step({ title: "Bolt through the side of the joint", detail: "Two bolts from the outside, with the small Allen key.", kind: "bolts", tools: ["allen"], fix: [f0.side] });
  kit.step({ title: "Add two bolts and nuts across the joint", detail: "Hold each nut with the spanner while you tighten the bolt.", kind: "bolts", tools: ["allen", "wrench"], fix: [f0.cross, f0.nuts] });
  kit.step({
    title: "Build the second leg frame and slide the beams together",
    detail: "The same way: bolts in the arm, legs, inner beam half. Then push its beam half into the outer one.",
    kind: "join",
    tools: ["allen", "wrench"],
    add: [["A1", side], ["L10", side], ["L11", side], ["B1", side]],
    fix: [f1.carriage, f1.insert, f1.flange, f1.side, f1.cross, f1.nuts],
  });
  kit.step({ title: "Lock the beam with eight bolts and nuts", detail: `Line the holes up for a ${Math.round(W / 10)} cm top. Hand tight for now.`, kind: "bolts", tools: ["allen", "wrench"], fix: [{ def: BOLT6, at: lock, dir: (p) => [0, 0, -Math.sign(p[2])], on: "B0", mate: "B1" }, { def: NUT6, at: lock.map((p) => [p[0], p[1], p[2] * 0.72] as Vec3), dir: (p) => [0, 0, Math.sign(p[2])], on: "B1", flat: true }] });
  kit.step({
    title: "Lower the frame onto the top and screw it on",
    detail: "Lay the top face down on a rug first. Seven bolts through the arms and the beam, then one through each hook.",
    kind: "bolts",
    people: 2,
    tools: ["allen"],
    warnings: ["two", "floor"],
    add: [["T", [0, 0, 1100]]],
    fix: [
      { def: BOLT6, at: [...ends, [-60, yA - 40, 0]], dir: [0, 1, 0], on: (p) => (Math.abs(p[0]) < xa - 30 ? "B0" : `A${idx(p[0])}`), mate: "T" },
      { def: HOOK, at: hooks, dir: [0, 1, 0], on: "T", flat: true },
      { def: BOLT6, at: hooks.map((p) => [p[0], p[1] - 4, p[2]] as Vec3), dir: [0, 1, 0], on: "T" },
    ],
  });
  kit.step({ title: "Tighten all the beam bolts", detail: "With the frame square on the top, go round once more with the key and the spanner.", kind: "bolts", tools: ["allen", "wrench"] });
  kit.step({ title: "Turn the desk over together", detail: "Lift it by the top, not by the legs.", pose: "+y", kind: "standup", people: 2 });
  return true;
}

/* ---------- sit/stand desk ---------- */

function sitStand(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = 710, TT = 25, yU = H - TT;
  const long = W >= 1400;
  const xl = W / 2 - 110, zc = -50, Kn = 280, zk = zc + 200, zf = D / 2 - 70;
  const kit = new Kit(b);
  for (const sx of sides) {
    const i = idx(sx), x = sx * xl;
    const st = strut(x, [Kn - 25, zk], [14, zf], 55);
    kit.weld(`F${i}`, "Leg base", [
      pp("box", [55, Kn, 55], [x, Kn / 2, zc]),
      pp("box", [55, 50, zk - zc + 55], [x, Kn - 25, (zc + zk) / 2]),
      pp("box", st.size, st.pos, st.rot),
    ]);
    kit.weld(`K${i}`, i ? "Column bracket, right" : "Column bracket, left", [
      pp("box", [80, 6, 90], [x, Kn + 3, zc]),
      ...sides.map((px) => pp("box", [5, 160, 90], [x + px * 40, Kn + 80, zc])),
    ]);
    const c0 = Kn + 6, len = yU - 80 - c0, a = len * 0.55;
    kit.weld(`C${i}`, "Lifting column", [pp("box", [70, a, 60], [x, c0 + a / 2, zc]), pp("box", [56, len - a, 46], [x, c0 + a + (len - a) / 2, zc])]);
    kit.part({ id: `A${i}`, name: "Top arm", size: [60, 30, D - 60], pos: [x, yU - 15, 0] });
    kit.part({ id: `S${i}`, name: "Drive shaft", size: [xl - 110, 14, 14], pos: [(sx * (xl + 30)) / 2, yU - 90, 0], shape: "cyl" });
  }
  const ov = long ? 300 : 200, hl = xl + 30 + ov / 2;
  kit.part({ id: "B0", name: "Beam, left half", size: [hl, 50, 70], pos: [-(xl + 30) + hl / 2, yU - 55, 0] });
  kit.part({ id: "B1", name: "Beam, right half", size: [hl, 42, 60], pos: [xl + 30 - hl / 2, yU - 55, 0] });
  kit.part({ id: "M", name: "Motor", size: [140, 60, 70], pos: [0, yU - 110, 0] });
  // the joining plate is a bent bracket: its foot screwed to the beam halves, its upper face under the top
  if (long) kit.part({ id: "P", name: "Joining plate", size: [200, 30, 70], pos: [0, yU - 15, 0] });
  kit.part({ id: "X", name: "Control box", size: [100, 40, 45], pos: [xl, yU - 50, D / 2 - 90] });
  kit.part({ id: "T", name: "Tabletop", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "board" });
  const tw = 2 * xl - 300, zt = -D / 2 + 120;
  kit.part({ id: "R", name: "Cable tray", size: [tw, 90, 160], pos: [0, yU - 45, zt] });

  const CAP8 = B(16, 8), CSK = S(10, 6, "Countersunk screw"), MBOLT = B(50, 6, "Long Allen bolt"), WS = S(16, 6, "Washer screw"), LBOLT = B(60, 6, "Long bolt");
  const PAD: HwDef = { kind: "spacer", len: 4, dia: 24, name: "Rubber pad" }, CLIP: HwDef = { kind: "clip", len: 12, dia: 20, name: "Cable clip" };
  const SLEEVE: HwDef = { kind: "spacer", len: 10, dia: 10, name: "Threaded sleeve" }, PIN: HwDef = { kind: "cap", len: 12, dia: 10, name: "Cover pin" };
  const half = (x: number) => (x < 0 ? "B0" : "B1");
  const plate = (inner: boolean) => ({
    def: CAP8,
    at: sides.flatMap((sx) => [Kn + 50, Kn + 95, Kn + 140].map((y) => [sx * (xl + (inner ? -42.5 : 42.5)), y, zc] as Vec3)),
    dir: (p: Vec3) => [inner ? Math.sign(p[0]) : -Math.sign(p[0]), 0, 0] as Vec3,
    on: (p: Vec3) => `K${idx(p[0])}`,
    mate: (p: Vec3) => `C${idx(p[0])}`,
  });
  const n = long ? 4 : 3;
  const armPts = sides.flatMap((sx) => Array.from({ length: n }, (_, k) => [sx * xl, yU - 30, -(D / 2 - 80) + (k * (D - 160)) / (n - 1)] as Vec3));
  const trayPts = (z: number) => [-tw / 2 + 60, -tw / 6, tw / 6, tw / 2 - 60].map((x) => [x, yU, z] as Vec3);
  const holes = (sx: number) => [150, 300].flatMap((z) => sides.map((sz) => [sx * (xl + 70), yU, sz * z] as Vec3));

  kit.step({ title: "Fit the left and right brackets on the leg bases", detail: "On a rug. The bracket marked L goes on the left leg, R on the right one.", warnings: ["floor"], add: ["F0", "F1", "K0", "K1"] });
  kit.step({ title: "Screw two bolts down through each bracket", detail: "By hand for now, so the bracket can still move a little.", kind: "bolts", warnings: ["hand"], fix: [{ def: CAP8, at: sides.flatMap((sx) => sides.map((sz) => [sx * xl, Kn + 6, zc + sz * 25] as Vec3)), dir: [0, -1, 0], on: (p) => `K${idx(p[0])}`, mate: (p) => `F${idx(p[0])}` }] });
  kit.step({ title: "Set the lifting columns in and bolt the inner side", detail: "Three bolts through the inner plate of each bracket, with the large Allen key.", kind: "bolts", tools: ["allen"], add: ["C0", "C1"], fix: [plate(true)] });
  kit.step({ title: "Bolt the outer side the same way", detail: "Three more bolts in each bracket, from the outside.", kind: "bolts", tools: ["allen"], fix: [plate(false)] });
  kit.step({ title: "Tighten the first four bolts", detail: "The two on top of each bracket, now that the columns sit straight.", kind: "bolts", tools: ["allen"] });
  kit.step({ title: "Slide the two beam halves onto the columns", detail: "One from each end, until the halves meet in the middle.", add: [["B0", [-500, 0, 0]], ["B1", [500, 0, 0]]] });
  if (long) kit.step({ title: "Screw the joining plate over the middle", detail: "Two countersunk screws, one into each half.", tools: ["allen"], add: ["P"], fix: [{ def: CSK, at: sides.map((sx) => [sx * 60, yU - 26, 0] as Vec3), dir: [0, -1, 0], on: "P", mate: (p) => half(p[0]) }] });
  kit.step({ title: "Tighten the twelve bolts along the beam", detail: "They're already in the beam: go along both halves with the large Allen key.", kind: "bolts", tools: ["allen"] });
  kit.step({ title: "Push the first drive shaft in", detail: "From below, into the gearbox at the top of the left column.", add: [["S0", [-200, -200, 0]]] });
  kit.step({ title: "Fit the motor and push in the second shaft", detail: "The motor sits under the middle of the beam, its cable hanging down.", add: [["M", [0, -250, 0]], ["S1", [250, -150, 0]]] });
  kit.step({ title: "Click the shaft couplings shut", detail: "Turn each one until it locks round its shaft." });
  kit.step({ title: "Bolt the motor to the beam", detail: "One long bolt, with the medium Allen key.", kind: "bolts", tools: ["allen"], fix: [{ def: MBOLT, at: [[-45, yU - 140, 0]], dir: [0, 1, 0], on: "M", mate: "B0" }] });
  kit.step({ title: "Add the second motor bolt", detail: "The same on the other side of the motor.", kind: "bolts", tools: ["allen"], fix: [{ def: MBOLT, at: [[45, yU - 140, 0]], dir: [0, 1, 0], on: "M", mate: "B1" }] });
  kit.step({ title: "Tighten the two screws on the couplings", detail: "With the smallest Allen key.", tools: ["allen"] });
  kit.step({ title: "Screw the top arms onto the beam ends", detail: "Two countersunk screws in each arm.", tools: ["allen"], add: ["A0", "A1"], fix: [{ def: CSK, at: sides.flatMap((sx) => sides.map((sz) => [sx * xl, yU, sz * 20] as Vec3)), dir: [0, -1, 0], on: (p) => `A${idx(p[0])}`, mate: (p) => half(p[0]) }] });
  kit.step({ title: "Screw the control box under the right arm", detail: "At the front, buttons facing you. Two countersunk screws.", tools: ["allen"], add: [["X", [0, -200, 0]]], fix: [{ def: CSK, at: sides.map((sz) => [xl, yU, D / 2 - 90 + sz * 25] as Vec3), dir: [0, -1, 0], on: "A1", mate: "X" }] });
  kit.step({ title: "Plug in the cables and the power", detail: "The motor cable into the control box, then the adapter into the box and the wall socket." });
  kit.step({ title: "Reset the legs", detail: "Hold the down button for five seconds. The frame runs to its lowest height and stops." });
  kit.step({ title: "Unplug it again", detail: "Keep it unplugged until the top is on." });
  kit.step({ title: "Press four rubber pads onto the beam", detail: "They sit between the beam and the top.", fix: [{ def: PAD, at: [-(xl - 120), -xl / 3, xl / 3, xl - 120].map((x) => [x, yU - 30, 0] as Vec3), dir: [0, -1, 0], on: (p) => half(p[0]), flat: true }] });
  kit.step({ title: "Lay the top on together", detail: "Face up. The pins under it drop into the holes in the arms.", people: 2, add: [["T", [0, 500, 0]]] });
  kit.step({ title: "Screw the top on from below", detail: `${long ? "Nine" : "Six"} washer screws up through the arms${long ? " and the joining plate" : ""}.`, tools: ["allen"], fix: [{ def: WS, at: [...armPts, ...(long ? [[0, yU - 4, 25] as Vec3] : [])], dir: [0, 1, 0], on: (p) => (Math.abs(p[0]) < 50 ? "P" : `A${idx(p[0])}`), mate: "T" }] });
  kit.step({ title: "Hook the cable tray on and screw one edge", detail: "Four washer screws along its front edge.", tools: ["allen"], add: [["R", [0, -250, 150]]], fix: [{ def: WS, at: trayPts(zt + 60), dir: [0, 1, 0], on: "R", mate: "T" }] });
  kit.step({ title: "Swing the tray up and screw the other edge", detail: "Four more washer screws along the back.", tools: ["allen"], fix: [{ def: WS, at: trayPts(zt - 60), dir: [0, 1, 0], on: "R", mate: "T" }] });
  kit.step({ title: "Screw in the four long bolts", detail: "Up through the beam into the top, with the medium Allen key.", kind: "bolts", tools: ["allen"], fix: [{ def: LBOLT, at: sides.flatMap((sx) => sides.map((sz) => [sx * xl * 0.55, yU - 45, sz * 20] as Vec3)), dir: [0, 1, 0], on: (p) => half(p[0]), mate: "T" }] });
  kit.step({ title: "Press the two cable clips in under the top", detail: "Into the slots at the back, for the power cable.", fix: [{ def: CLIP, at: sides.map((sx) => [sx * (xl - 250), yU, -D / 2 + 60] as Vec3), dir: [0, 1, 0], on: "T", flat: true }] });
  for (const sx of [-1, 1])
    kit.step({
      title: `Fill the unused holes on the ${sx < 0 ? "left" : "right"}`,
      detail: "A threaded sleeve in each hole, then a cover pin pushed into it.",
      warnings: ["hand"],
      fix: [
        { def: SLEEVE, at: holes(sx), dir: [0, 1, 0], on: "T" },
        { def: PIN, at: holes(sx).map((p) => [p[0], p[1] - 3, p[2]] as Vec3), dir: [0, 1, 0], on: "T", flat: true },
      ],
    });
  kit.step({ title: "Plug it in and try it", detail: "Run it all the way up and down once. Keep the load under 50 kg." });
  return true;
}

/* ---------- cabinets: shared base ---------- */

const ST = 25, TT = 20, Y0 = 100;

/** Two rails with a leg at each end, front and back (sliding doors) or left and right (doors). */
function legRails(kit: Kit, W: number, D: number, along: "x" | "z") {
  for (const s of sides) {
    const i = idx(s);
    const legs = sides.map((o) => pp("box", [25, Y0, 25], along === "x" ? [o * (W / 2 - 12.5), Y0 / 2, s * (D / 2 - 12.5)] : [s * (W / 2 - 12.5), Y0 / 2, o * (D / 2 - 12.5)]));
    const rail = along === "x" ? pp("box", [W, 30, 25], [0, Y0 - 15, s * (D / 2 - 12.5)]) : pp("box", [25, 30, D], [s * (W / 2 - 12.5), Y0 - 15, 0]);
    kit.weld(`BR${i}`, along === "x" ? "Base rail" : "Leg frame", [rail, ...legs]);
  }
}
const feetFix = (W: number, D: number, along: "x" | "z"): Fix => ({
  def: HW.foot,
  at: sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2 - 12.5), 0, sz * (D / 2 - 12.5)] as Vec3)),
  dir: [0, 1, 0],
  on: (p) => `BR${idx(along === "x" ? p[2] : p[0])}`,
  flat: true,
});

/* ---------- cabinet with sliding doors ---------- */

function slideCab(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tall = H > 1500, Hl = tall ? 750 : H, yT = Hl - TT;
  const kit = new Kit(b);
  legRails(kit, W, D, "x");
  kit.part({ id: "BP", name: "Bottom panel", size: [W - 50, 30, D - 50], pos: [0, Y0 - 15, 0] });
  for (const sx of sides) kit.part({ id: `SD${idx(sx)}`, name: "Side panel", size: [ST, yT - Y0, D], pos: [sx * (W / 2 - 12.5), (Y0 + yT) / 2, 0] });
  const nb = yT - Y0 > 700 ? 2 : 1, bh = (yT - Y0) / nb;
  for (let i = 0; i < nb; i++) kit.part({ id: `BK${i}`, name: "Back panel", size: [W - 50, bh, 12], pos: [0, Y0 + bh * (i + 0.5), -D / 2 + 20] });
  const ns = !tall && H > 900 ? 2 : 1;
  const shelfY = Array.from({ length: ns }, (_, i) => Y0 + ((yT - Y0) * (i + 1)) / (ns + 1));
  shelfY.forEach((y, i) => kit.part({ id: `SH${i}`, name: "Shelf", size: [W - 50, 20, D - 100], pos: [0, y, -25] }));
  const Wi = W - 50, dw = Wi / 2 + 20, dh = yT - Y0 - 10, dy = (Y0 + yT) / 2;
  kit.part({ id: "D0", name: "Sliding door", size: [dw, dh, 18], pos: [Wi / 2 - dw / 2, dy, D / 2 - 40] });
  kit.part({ id: "D1", name: "Sliding door with lock", size: [dw, dh, 18], pos: [-Wi / 2 + dw / 2, dy, D / 2 - 15] });
  const lv = [Hl + (H - Hl) / 3, Hl + ((H - Hl) * 2) / 3, H];
  if (tall) {
    kit.part({ id: "MP", name: "Middle panel", size: [W, TT, D - 50], pos: [0, Hl - TT / 2, 0] });
    for (const sx of sides) {
      const x = sx * (W / 2 - 12.5);
      kit.weld(`UF${idx(sx)}`, "Side frame", [
        ...sides.map((sz) => pp("box", [25, H - TT - yT, 25], [x, (yT + H - TT) / 2, sz * (D / 2 - 12.5)])),
        ...lv.map((y) => pp("box", [25, 25, D - 50], [x, y - TT - 12.5, 0])),
      ]);
    }
    lv.forEach((y, i) => kit.part({ id: `U${i}`, name: i < 2 ? "Open shelf" : "Top panel", size: [W, TT, D - 50], pos: [0, y - TT / 2, 0] }));
  } else kit.part({ id: "TP", name: "Top panel", size: [W, TT, D], pos: [0, H - TT / 2, 0] });

  const ALLEN = B(10, 6), SCR = S(13, 3.5), SCR4 = S(8, 4), LBOLT = B(60, 6, "Long bolt");
  const CLIP: HwDef = { kind: "clip", len: 30, dia: 14, name: "Shelf clip" }, STOP: HwDef = { kind: "spacer", len: 15, dia: 18, name: "Door stop" };
  const clips = (y: number) => sides.flatMap((sx) => [-(D / 2 - 40), -(D / 2 - 130), D / 2 - 130, D / 2 - 85].map((z) => [sx * (W / 2 - ST), y - 13, z] as Vec3));
  const backPts = sides.flatMap((sx) => Array.from({ length: nb * 2 }, (_, k) => [sx * (W / 2), Y0 + ((yT - Y0) * (k + 0.5)) / (nb * 2), -D / 2 + 20] as Vec3));
  const d1 = kit.pos("D1");
  const stops: Vec3[] = [[d1[0] + dw / 2 - 40, dy + dh / 2 - 60, D / 2 - 24], [d1[0] - dw / 2 + 40, dy - dh / 2 + 60, D / 2 - 24]];
  const P: Pose = "-y";

  kit.step({ title: "Screw the feet into the legs", detail: "Lay the two base rails upside down. One adjustable foot in each leg, all the way in.", pose: P, kind: "legs", warnings: ["floor"], add: ["BR0", "BR1"], fix: [feetFix(W, D, "x")] });
  kit.step({ title: "Lay the bottom panel between the rails", detail: "Its folded edges hook under the rails.", add: ["BP"] });
  kit.step({ title: "Bolt the rails to the bottom panel", detail: "Four bolts, one at each corner, with the Allen key.", kind: "bolts", tools: ["allen"], fix: [{ def: ALLEN, at: sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2 - 60), Y0 - 15, sz * (D / 2 - 25)] as Vec3)), dir: (p) => [0, 0, -Math.sign(p[2])], on: (p) => `BR${idx(p[2])}`, mate: "BP" }] });
  kit.step({ title: "Turn the base over and drop the side panels on", detail: "The slotted rails face in. Each side slides down over two legs.", pose: "+y", add: ["SD0", "SD1"] });
  if (nb === 1) kit.step({ title: "Screw the sides to the base", detail: "Four screws down through the foot of the side panels.", tools: ["screwdriver"], fix: [{ def: SCR, at: sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2 - 35), Y0, sz * (D / 2 - 60)] as Vec3)), dir: [0, -1, 0], on: "BP" }] });
  kit.step({ title: nb > 1 ? "Slide the back panels down into the slots" : "Slide the back panel down into the slots", detail: "At the back, as shown. For a room divider, use the slots in the middle instead.", add: Array.from({ length: nb }, (_, i) => `BK${i}`) });
  if (nb > 1) kit.step({ title: "Bend the tabs to lock the back", detail: "Two tabs, with a flat screwdriver, so the panels can't lift out.", tools: ["flathead"] });
  kit.step({ title: "Screw the sides to the back", detail: `${backPts.length} screws through the back edge of the side panels.`, tools: ["screwdriver"], fix: [{ def: SCR, at: backPts, dir: (p) => [-Math.sign(p[0]), 0, 0], on: (p) => `SD${idx(p[0])}`, mate: (p) => `BK${Math.min(nb - 1, Math.floor(((p[1] - Y0) / (yT - Y0)) * nb))}` }] });
  if (tall) {
    kit.step({ title: "Stand the open side frames on the side panels", detail: "Their posts drop into the tops of the side panels.", add: ["UF0", "UF1"] });
    kit.step({ title: "Lay the middle panel in", detail: "Between the frames, onto the side panels.", add: ["MP"] });
    kit.step({ title: "Fix the middle panel with four long bolts", detail: "Down through its corners, with the Allen key.", kind: "bolts", tools: ["allen"], fix: [{ def: LBOLT, at: sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2 - 12.5), Hl, sz * (D / 2 - 60)] as Vec3)), dir: [0, -1, 0], on: "MP", mate: (p) => `SD${idx(p[0])}` }] });
    kit.step({ title: "Screw the shelf screws into the frames", detail: "Twelve bolts, a few turns each, so the shelves can hook onto them.", kind: "bolts", tools: ["allen"], fix: [{ def: ALLEN, at: lv.flatMap((y) => sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2 - 25), y - TT - 12.5, sz * (D / 2 - 70)] as Vec3))), dir: (p) => [Math.sign(p[0]), 0, 0], on: (p) => `UF${idx(p[0])}`, flat: true }] });
    kit.step({ title: "Hang the top and the two shelves on", detail: "Each one drops onto its four bolts from above.", add: ["U2", "U1", "U0"] });
    kit.step({ title: "Tighten the twelve bolts", detail: "From inside, with the Allen key.", kind: "bolts", tools: ["allen"] });
  } else {
    kit.step({ title: "Lay the top on and slide it back", detail: "Rest it on the sides, then push it back until its four hooks catch.", add: ["TP"] });
    kit.step({ title: "Screw the top on from inside", detail: "Four screws up through the top of the side panels.", tools: ["screwdriver"], fix: [{ def: SCR4, at: sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2 - 12.5), yT, sz * (D / 2 - 60)] as Vec3)), dir: [0, 1, 0], on: (p) => `SD${idx(p[0])}`, mate: "TP" }] });
  }
  kit.step({ title: "Push in the shelf clips", detail: `Eight for each shelf, four on each side, at the height you want.`, kind: "shelves", fix: [{ def: CLIP, at: shelfY.flatMap(clips), dir: (p) => [Math.sign(p[0]), 0, 0], on: (p) => `SD${idx(p[0])}`, flat: true }] });
  kit.step({ title: ns > 1 ? "Lay the shelves on the clips" : "Lay the shelf on the clips", detail: "Tilt it in, then press it down until it sits on all eight clips.", kind: "shelves", add: shelfY.map((_, i) => `SH${i}`) });
  kit.step({ title: "Tilt the door without the lock into the back track", detail: "Wheels into the back track at the bottom first, then swing the top in.", kind: "doors", add: [["D0", [0, 60, 260]]] });
  kit.step({ title: "Push its top guides up until they click", detail: "Two guides, at the top of the door.", kind: "doors" });
  kit.step({ title: "Slide the door to the right", kind: "doors" });
  kit.step({
    title: "Screw two door stops onto the lock door",
    detail: "Lay it face down on something soft. One stop near each end, as shown.",
    scene: "door",
    pose: "-z",
    tools: ["screwdriver"],
    warnings: ["floor"],
    stage: [{ id: "D1", at: [0, 0, 0], from: [0, 0, -200] }],
    fix: [{ def: STOP, at: stops, dir: [0, 0, 1], on: "D1", flat: true }, { def: SCR, at: stops.map((p) => [p[0], p[1], p[2] - 15] as Vec3), dir: [0, 0, 1], on: "D1" }],
  });
  kit.step({ title: "Tilt the lock door into the front track", detail: "The same way: bottom first, then the top.", kind: "doors", add: [["D1", [0, 60, 260]]] });
  kit.step({ title: "Push its top guides up until they click", detail: "Then check both doors slide and the lock turns.", kind: "doors" });
  kit.step({ title: "Level the cabinet with the feet", detail: "Turn the feet until it stands firm and the doors close evenly." });
  return true;
}

/* ---------- cabinet with doors ---------- */

function doorCab(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const two = H > 1500, Hl = 750, yT = Hl - TT, yO = two ? 1100 : H - TT; // lower top, then the top of the open frame
  const kit = new Kit(b);
  legRails(kit, W, D, "z");
  kit.weld("BF", "Bottom frame", sides.map((sz) => pp("box", [W - 50, 30, 25], [0, Y0 - 15, sz * (D / 2 - 12.5)])));
  for (const sx of sides) kit.part({ id: `SD${idx(sx)}`, name: "Side panel", size: [ST, yT - Y0, D], pos: [sx * (W / 2 - 12.5), (Y0 + yT) / 2, 0] });
  const bh = (yT - Y0) / 2;
  for (let i = 0; i < 2; i++) kit.part({ id: `BK${i}`, name: "Back panel", size: [W - 50, bh, 10], pos: [0, Y0 + bh * (i + 0.5), -D / 2 + 15] });
  kit.part({ id: "MP", name: "Middle panel", size: [W, TT, D - 50], pos: [0, Hl - TT / 2, 0] });
  kit.part({ id: "FL", name: "Floor panel", size: [W - 50, 10, D - 40], pos: [0, Y0 + 5, 0] });
  kit.part({ id: "SH", name: "Shelf", size: [W - 50, 20, D - 60], pos: [0, (Y0 + yT) / 2, -10] });
  const fw = (W - 50) / 2 - 2;
  const doors = (pre: string, y0: number, y1: number) =>
    sides.forEach((sx) => kit.part({ id: `${pre}${idx(sx)}`, name: sx < 0 ? "Door with lock" : "Door", size: [fw, y1 - y0 - 10, 20], pos: [sx * (fw / 2 + 1), (y0 + y1) / 2, D / 2 - 10] }));
  doors("LD", Y0, yT);
  // the open frame: two ladders, their posts down into the side panels
  for (const sx of sides) {
    const x = sx * (W / 2 - 12.5);
    kit.weld(`UF${idx(sx)}`, "Side frame", [
      ...sides.map((sz) => pp("box", [25, yO - yT, 25], [x, (yT + yO) / 2, sz * (D / 2 - 12.5)])),
      ...[Hl + 12.5, yO - 12.5].map((y) => pp("box", [25, 25, D - 50], [x, y, 0])),
    ]);
  }
  const yU = two ? 1100 : 0, yUT = H - TT;
  if (two) {
    for (const sz of sides) kit.part({ id: `RF${idx(sz)}`, name: "Long rail", size: [W, 20, 25], pos: [0, yO - 10, sz * (D / 2 - 12.5)] });
    for (const sx of sides) kit.part({ id: `RS${idx(sx)}`, name: "Short rail", size: [25, 20, D - 50], pos: [sx * (W / 2 - 12.5), yO - 10, 0] });
    for (const sx of sides) kit.part({ id: `SU${idx(sx)}`, name: "Side panel, top cabinet", size: [ST, yUT - yU, D], pos: [sx * (W / 2 - 12.5), (yU + yUT) / 2, 0] });
    const uh = (yUT - yU) / 2;
    for (let i = 0; i < 2; i++) kit.part({ id: `UB${i}`, name: "Back panel", size: [W - 50, uh, 10], pos: [0, yU + uh * (i + 0.5), -D / 2 + 15] });
    kit.part({ id: "UFL", name: "Floor panel", size: [W - 50, 10, D - 40], pos: [0, yU + 5, 0] });
    kit.part({ id: "US", name: "Shelf", size: [W - 50, 20, D - 60], pos: [0, (yU + yUT) / 2, -10] });
    doors("UD", yU, yUT);
  }
  kit.part({ id: "TP", name: "Top panel", size: [W, TT, D], pos: [0, H - TT / 2, 0] });

  const ALLEN = B(10, 6), SCR4 = S(8, 4);
  const PIN: HwDef = { kind: "stud", len: 15, dia: 8, name: "Hinge pin" }, CATCH: HwDef = { kind: "clip", len: 40, dia: 20, name: "Hinge catch" };
  const SPACER: HwDef = { kind: "spacer", len: 20, dia: 40, name: "Wall spacer" };
  const pins = (y: number, on: (p: Vec3) => string): Fix => ({ def: PIN, at: sides.map((sx) => [sx * (W / 2 - 40), y, D / 2 - 10] as Vec3), dir: [0, -1, 0], on });
  const catches = (y: number, pre: string): Fix => ({ def: CATCH, at: sides.map((sx) => [sx * (W / 2 - 40), y, D / 2 - 10] as Vec3), dir: [0, 1, 0], on: (p) => `${pre}${idx(p[0])}`, flat: true });
  const mpZ = two ? [-120, -40, 40, 120] : [-100, 0, 100];
  const mpScrews: Fix = { def: SCR4, at: sides.flatMap((sx) => mpZ.map((z) => [sx * (W / 2 - 12.5), yT, z] as Vec3)), dir: [0, 1, 0], on: (p) => `SD${idx(p[0])}`, mate: "MP" };
  const wy = two ? yUT - 40 : yT - 30, wb = two ? "UB1" : "BK1";
  const wallPts = sides.map((sx) => [sx * (W / 2 - 120), wy, -D / 2 + 10] as Vec3);

  kit.step({ title: "Screw the feet into the legs", detail: "Lay the two leg frames upside down. One adjustable foot in each leg, all the way in.", pose: "-y", kind: "legs", warnings: ["floor"], add: ["BR0", "BR1"], fix: [feetFix(W, D, "z")] });
  kit.step({ title: "Click the bottom frame between the leg frames", detail: "Stand them up. Push each end in until its tabs click into the slots.", pose: "+y", add: ["BF"] });
  kit.step({ title: "Drop the side panels over the legs", detail: "The slotted rails face in. Press each panel down until it sits on the frame.", add: ["SD0", "SD1"] });
  kit.step({ title: "Slide the lower back panel in", detail: "Its folded edge goes down, into the slot in the bottom frame.", add: ["BK0"] });
  kit.step({ title: "Bend the tabs to lock it", detail: "Four up the sides and two along the bottom, with a flat screwdriver.", tools: ["flathead"] });
  kit.step({ title: "Slide the upper back panel in on top", detail: "Down into the slots until it rests on the lower one.", add: ["BK1"] });
  kit.step({ title: "Bend the tabs to lock it", detail: "Two at each side and three along the joint. Leave the top ones for now.", tools: ["flathead"] });
  if (!two) {
    const c: Vec3 = [0, (yT + H) / 2, 0];
    const rel = (id: string) => kit.pos(id).map((v, i) => v - c[i]) as Vec3;
    kit.step({ title: "Click the side frames onto the top", detail: "Lay the top face down on a rug. Each frame's corners hook into the slots at its ends.", scene: "top", pose: "-y", warnings: ["floor"], stage: ["TP", "UF0", "UF1"].map((id) => ({ id, at: rel(id) })) });
    kit.step({ title: "Bolt the frames to the top", detail: "Four bolts, one in each corner, with the Allen key.", scene: "top", pose: "-y", kind: "bolts", tools: ["allen"], fix: [{ def: ALLEN, at: sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2), H - TT - 12.5, sz * (D / 2 - 40)] as Vec3)), dir: (p) => [-Math.sign(p[0]), 0, 0], on: (p) => `UF${idx(p[0])}`, mate: "TP" }] }); // through the top's folded end into the frame's top rail
    kit.step({ title: "Lift the top section onto the cabinet", detail: "Its posts drop into the tops of the side panels. Press until they sit flush.", add: ["TP", "UF0", "UF1"] });
  } else {
    const c: Vec3 = [0, yO - 10, 0];
    const ring = ["RF0", "RF1", "RS0", "RS1"];
    const rel = (id: string) => kit.pos(id).map((v, i) => v - c[i]) as Vec3;
    kit.step({ title: "Click the four rails into a frame", detail: "The short rails' ends hook into the long ones.", scene: "rails", stage: ring.map((id) => ({ id, at: rel(id) })) });
    kit.step({ title: "Bolt the rail frame together", detail: "One bolt in each corner, with the Allen key.", scene: "rails", kind: "bolts", tools: ["allen"], fix: [{ def: ALLEN, at: sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2 - 12.5), yO - 10, sz * (D / 2)] as Vec3)), dir: (p) => [0, 0, -Math.sign(p[2])], on: (p) => `RF${idx(p[2])}`, mate: (p) => `RS${idx(p[0])}` }] });
    kit.step({ title: "Stand the open frames on the cabinet and the rail frame on top", detail: "The posts drop into the side panels below and into the rail frame above.", add: ["UF0", "UF1", ...ring] });
    kit.step({ title: "Drop the upper side panels on", detail: "Over the corners of the rail frame. Bend two tabs to hold each one.", tools: ["flathead"], add: ["SU0", "SU1"] });
  }
  kit.step({ title: "Lay the middle panel in", detail: "Tilt it in under the frame and lower it onto the side panels.", add: ["MP"] });
  kit.step({ title: "Screw the middle panel on from below", detail: `${mpScrews.at.length} screws up through the top of the side panels.`, tools: ["screwdriver"], fix: [mpScrews] });
  kit.step({ title: "Bend the tabs under the middle panel", detail: "Three along the back, with a flat screwdriver.", tools: ["flathead"] });
  kit.step({ title: "Lay the floor panel in", detail: "Back edge first, then let the front drop onto the bottom frame.", add: ["FL"] });
  kit.step({ title: "Hang the shelf on the hooks", detail: "Four hooks in the side panels hold it. Press it down until it sits level.", kind: "shelves", add: ["SH"] });
  if (two) {
    kit.step({ title: "Slide the lower back panel into the top cabinet", detail: "Folded edge down, into the slot in the rail frame.", add: ["UB0"] });
    kit.step({ title: "Bend the tabs to lock it", tools: ["flathead"] });
    kit.step({ title: "Slide the upper back panel in", detail: "Down until it rests on the lower one.", add: ["UB1"] });
    kit.step({ title: "Bend the tabs to lock it", tools: ["flathead"] });
    kit.step({ title: "Lay the top on and slide it back", detail: "Rest it on the side panels, then push it back until the hooks catch.", add: ["TP"] });
    kit.step({ title: "Bend the tabs under the top", detail: "Two at the sides and three along the back.", tools: ["flathead"] });
    kit.step({ title: "Lay the floor panel into the top cabinet", detail: "Back edge first, then the front.", add: ["UFL"] });
    kit.step({ title: "Hang the top cabinet's shelf on its hooks", kind: "shelves", add: ["US"] });
    kit.step({ title: "Push in the four hinge pins", detail: "Two in the bottom frame and two in the rail frame, at the front corners.", kind: "hinges", fix: [pins(Y0, () => "BF"), pins(yU, (p) => `RS${idx(p[0])}`)] });
  } else kit.step({ title: "Push the two hinge pins into the bottom frame", detail: "One at each front corner.", kind: "hinges", fix: [pins(Y0, () => "BF")] });
  kit.step({ title: two ? "Set the lower doors on their pins" : "Set the doors on the pins", detail: "The hole under each door goes over its pin. The door with the lock goes on the left.", kind: "doors", add: [["LD0", [0, 0, 260]], ["LD1", [0, 0, 260]]] });
  kit.step({ title: "Click the top hinges in", detail: "Push each one up into the top corner of its door until it clicks.", kind: "hinges", fix: [catches(yT - 5, "LD")] });
  if (two) {
    kit.step({ title: "Set the upper doors on their pins", detail: "The door with the lock on the left again.", kind: "doors", add: [["UD0", [0, 0, 260]], ["UD1", [0, 0, 260]]] });
    kit.step({ title: "Click their top hinges in", kind: "hinges", fix: [catches(yUT - 5, "UD")] });
  }
  kit.step({ title: "Level the cabinet with the feet", detail: "Turn the feet until it stands firm and the doors line up." });
  kit.step({
    title: "Fix it to the wall",
    detail: "Break the spacers to fit over your skirting board. Wall screws and plugs aren't included: pick ones made for your wall.",
    kind: "anchor",
    wall: true,
    tools: ["drill", "screwdriver", "pencil"],
    warnings: ["wall", "tip"],
    fix: [
      { def: SPACER, at: wallPts.map((p) => [p[0], p[1], -D / 2 - 10] as Vec3), dir: [0, 0, -1], on: wb, flat: true },
      { def: HW.plug, at: wallPts.map((p) => [p[0], p[1], -D / 2 - 40] as Vec3), dir: [0, 0, -1], on: wb, flat: true },
      { def: HW.wallScrew, at: wallPts, dir: [0, 0, -1], on: wb },
    ],
  });
  return true;
}

/* ---------- drawer unit on a trestle ---------- */

function trestle(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10, Dt = D - 50, TT = 20;
  const yL = H - TT - 40; // tops of the legs, under the rails
  const zLeg = (y: number) => 70 + (D / 2 - 15 - 70) * (1 - y / yL);
  const xr = W / 2 - 15;
  const kit = new Kit(b);
  for (const sx of sides) {
    const i = idx(sx);
    kit.part({ id: `TR${i}`, name: "Top rail", size: [30, 40, Dt - 40], pos: [sx * xr, H - TT - 20, -2.5] });
    for (const sz of sides) kit.part({ id: `L${i}${idx(sz)}`, name: "Leg", ...strut(sx * xr, [yL, sz * 70], [0, sz * (D / 2 - 15)], 25) });
  }
  const yH = 330, yLo = 110, rl = W - 55;
  for (const [k, y] of [yH, yLo].entries()) for (const sz of sides) kit.part({ id: `R${k}${idx(sz)}`, name: "Crossbar", size: [rl, 20, 20], pos: [0, y, sz * zLeg(y)], shape: "cyl" });
  const zs = zLeg(yLo) + 2;
  kit.weld("MS", "Mesh shelf", [pp("box", [rl, 4, 2 * zs], [0, yLo + 12, 0]), ...sides.map((sz) => pp("box", [rl, 50, 4], [0, yLo + 35, sz * zs]))]);
  const yd = H - TT - 130, zb = -200, zfr = Dt / 2 - 22;
  kit.weld("DB", "Drawer box", [pp("box", [260, 4, zfr - zb], [0, yd, (zb + zfr) / 2]), ...sides.map((sx) => pp("box", [4, 100, zfr - zb], [sx * 130, yd + 50, (zb + zfr) / 2]))]);
  kit.part({ id: "DF", name: "Drawer front", size: [W - 10, 135, 20], pos: [0, H - TT - 72.5, zfr + 10] });
  kit.part({ id: "DK", name: "Drawer back", size: [260, 100, 8], pos: [0, yd + 50, zb - 4] });
  kit.part({ id: "TP", name: "Top", size: [W, TT, Dt], pos: [0, H - TT / 2, 0] });

  const LB = B(40, 6), SCR = S(10, 6), SMALL = S(8, 4);
  const RUN: HwDef = { kind: "runner", len: 380, dia: 30, name: "Drawer runner" }, STUD: HwDef = { kind: "stud", len: 12, dia: 8, name: "Runner stud" }, CAP: HwDef = { kind: "cap", len: 6, dia: 16, name: "Runner wheel" };
  const STOP: HwDef = { kind: "spacer", len: 20, dia: 10, name: "Drawer stop" };
  const legBolts = (i: number): Fix => ({ def: LB, at: sides.map((sz) => [(i ? 1 : -1) * xr, H - TT, sz * 70] as Vec3), dir: [0, -1, 0], on: `TR${i}`, mate: (p) => `L${i}${idx(p[2])}` });
  const rodBolts: Fix = { def: LB, at: [yH, yLo].flatMap((y) => sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2 - 2.5), y, sz * zLeg(y)] as Vec3))), dir: (p) => [-Math.sign(p[0]), 0, 0], on: (p) => `L${idx(p[0])}${idx(p[2])}`, mate: (p) => `R${p[1] > 200 ? 0 : 1}${idx(p[2])}` };
  const shelfScrews: Fix = { def: SCR, at: sides.flatMap((sx) => sides.map((sz) => [sx * (W / 2 - 2.5), yLo + 35, sz * (zLeg(yLo + 35) - 4)] as Vec3)), dir: (p) => [-Math.sign(p[0]), 0, 0], on: (p) => `L${idx(p[0])}${idx(p[2])}`, mate: "MS" };
  const studs = sides.flatMap((sx) => [zb + 60, zfr - 60].map((z) => [sx * 132, yd + 60, z] as Vec3));
  const frontScrews: Fix = { def: SCR, at: sides.flatMap((sx) => [yd + 25, yd + 75].map((y) => [sx * 115, y, zfr] as Vec3)), dir: [0, 0, 1], on: "DB", mate: "DF" };

  kit.step({ title: "Screw a runner onto each top rail", detail: "The one marked L on the left rail, R on the right. Two screws each.", tools: ["screwdriver"], kind: "runners", add: ["TR0", "TR1"], fix: [{ def: RUN, at: sides.map((sx) => [sx * (xr - 15), H - TT - 25, -10] as Vec3), dir: (p) => [Math.sign(p[0]), 0, 0], on: (p) => `TR${idx(p[0])}`, flat: true }, { def: SMALL, at: sides.flatMap((sx) => [-150, 130].map((z) => [sx * (xr - 15), H - TT - 25, z] as Vec3)), dir: (p) => [Math.sign(p[0]), 0, 0], on: (p) => `TR${idx(p[0])}` }] });
  kit.step({ title: "Bolt two legs under the left rail", detail: "One long bolt down through the rail into each leg.", kind: "bolts", tools: ["allen"], add: ["L00", "L01"], fix: [legBolts(0)] });
  kit.step({ title: "Bolt the other two legs under the right rail", detail: "The same way.", kind: "bolts", tools: ["allen"], add: ["L10", "L11"], fix: [legBolts(1)] });
  kit.step({ title: "Bolt the four crossbars between the legs", detail: "Two high and two low. Eight bolts through the legs into the bar ends.", kind: "bolts", tools: ["allen"], people: 2, add: ["R00", "R01", "R10", "R11"], fix: [rodBolts] });
  kit.step({ title: "Fold up the edges of the mesh shelf", detail: "Check the rounded corners point down first, then bend both long edges up.", scene: "shelf", stage: [{ id: "MS", at: [0, 0, 0] }] });
  kit.step({ title: "Slide the shelf in on the low crossbars", detail: "From the side, until it sits between all four legs.", add: [["MS", [-400, 0, 0]]] });
  kit.step({ title: "Screw the shelf to the legs", detail: "Four screws, one at each corner.", tools: ["screwdriver"], fix: [shelfScrews] });
  const dc = kit.pos("DB");
  const rel = (id: string) => kit.pos(id).map((v, i) => v - dc[i]) as Vec3;
  kit.step({ title: "Fold up the sides of the drawer", detail: "Bend both mesh sides up until they stand straight.", scene: "drawer", stage: [{ id: "DB", at: [0, 0, 0] }] });
  kit.step({ title: "Slide the front onto the drawer", detail: "Its slots go over the ends of the sides.", scene: "drawer", stage: [{ id: "DF", at: rel("DF"), from: [0, 0, 250] }] });
  kit.step({ title: "Screw the front on from inside", detail: "Four screws through the sides.", scene: "drawer", tools: ["screwdriver"], fix: [frontScrews] });
  kit.step({ title: "Push the back onto the drawer", detail: "It hooks over the back ends of the sides.", scene: "drawer", stage: [{ id: "DK", at: rel("DK"), from: [0, 0, -250] }] });
  kit.step({ title: "Click the runner studs into the sides", detail: "A stud through each hole and a wheel clicked onto it, two on each side.", scene: "drawer", fix: [{ def: STUD, at: studs, dir: (p) => [-Math.sign(p[0]), 0, 0], on: "DB" }, { def: CAP, at: studs.map((p) => [p[0] + Math.sign(p[0]) * 6, p[1], p[2]] as Vec3), dir: (p) => [-Math.sign(p[0]), 0, 0], on: "DB", flat: true }] });
  kit.step({ title: "Slide the drawer in on the runners", detail: "Wheels on the runners at the back, then push it closed.", kind: "drawer", add: [["DB", [0, 0, 450]], ["DF", [0, 0, 450]], ["DK", [0, 0, 450]]] });
  kit.step({ title: "Screw in the two drawer stops", detail: "One at the back of each rail, so the drawer can't pull out.", tools: ["screwdriver"], fix: [{ def: STOP, at: sides.map((sx) => [sx * (xr - 15), H - TT - 15, -(Dt / 2 - 40)] as Vec3), dir: (p) => [Math.sign(p[0]), 0, 0], on: (p) => `TR${idx(p[0])}` }] });
  kit.step({ title: "Turn it upside down onto the top and bolt it on", detail: "Lay the top face down on a rug. Four long bolts up through the rails.", pose: "-y", kind: "bolts", tools: ["allen"], warnings: ["floor"], add: [["TP", [0, 0, 700]]], fix: [{ def: LB, at: sides.flatMap((sx) => sides.map((sz) => [sx * xr, H - TT - 40, sz * 150] as Vec3)), dir: [0, 1, 0], on: (p) => `TR${idx(p[0])}`, mate: "TP" }] });
  kit.step({ title: "Turn it the right way up", pose: "+y", kind: "standup" });
  return true;
}

/* ---------- drawer unit on castors ---------- */

function castorUnit(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const y0 = HW.castor.len, yt = H - 15; // body from the castors up to the top tray
  const kit = new Kit(b);
  const fy = (y0 + 10 + yt) / 2, fh = yt - y0 - 10, xf = W / 2 - 20;
  for (const sx of sides) {
    const x = sx * xf;
    kit.weld(`SF${idx(sx)}`, "Side frame", [
      ...sides.map((sz) => pp("box", [12, fh, 20], [x, fy, sz * (D / 2 - 30)])),
      ...[y0 + 20, yt - 10].map((y) => pp("box", [12, 20, D - 80], [x, y, 0])),
    ]);
    kit.part({ id: `SP${idx(sx)}`, name: "Side panel", size: [8, yt - y0, D], pos: [sx * (W / 2 - 4), (y0 + yt) / 2, 0] });
  }
  for (const sz of sides) kit.part({ id: `BR${idx(sz)}`, name: "Bottom rail", size: [W - 52, 25, 25], pos: [0, y0 + 12.5, sz * (D / 2 - 30)] });
  kit.part({ id: "BK", name: "Back panel", size: [W - 52, yt - y0 - 25, 8], pos: [0, (y0 + 25 + yt) / 2, -D / 2 + 8] });
  kit.weld("TP", "Top", [pp("box", [W, 3, D], [0, yt + 1.5, 0]), pp("box", [W, 15, 3], [0, yt + 7.5, -D / 2 + 1.5]), ...sides.map((sx) => pp("box", [3, 15, D - 3], [sx * (W / 2 - 1.5), yt + 7.5, 1.5]))]);
  const fronth = (yt - y0 - 6) / 3;
  const dws = W - 2 * 8 - 6, dbw = 2 * xf - 40, dd = D - 80;
  const drawers = [2, 1, 0].map((k) => {
    const yb = y0 + 2 + k * (fronth + 2), yc = yb + fronth / 2;
    const id = (p: string) => `${p}${k}`;
    kit.weld(id("DB"), "Drawer box", [pp("box", [dbw, 4, dd], [0, yb + 12, -10]), ...sides.map((sx) => pp("box", [4, fronth - 40, dd], [sx * (dbw / 2 - 2), yb + 12 + (fronth - 40) / 2, -10]))]);
    kit.part({ id: id("DK"), name: "Drawer back", size: [dbw - 8, fronth - 40, 6], pos: [0, yb + 12 + (fronth - 40) / 2, -10 - dd / 2 - 3] });
    kit.part({ id: id("DI"), name: "Drawer front frame", size: [dbw, fronth - 30, 8], pos: [0, yc, D / 2 - 32] });
    kit.part({ id: id("DF"), name: k === 1 ? "Drawer front with lock" : "Drawer front", size: [dws, fronth, 14], pos: [0, yc, D / 2 - 21] });
    return { k, yc, yb, ids: ["DB", "DK", "DI", "DF"].map(id) };
  });

  const SCR = S(10, 4), SCRS = S(13, 3.5), RUN: HwDef = { kind: "runner", len: dd - 20, dia: 30, name: "Drawer runner" };
  const runY = drawers.map((d) => d.yb + 30);
  const runners = (sx: number): Fix => ({ def: RUN, at: runY.map((y) => [sx * (xf - 6), y, -10] as Vec3), dir: [sx, 0, 0], on: `SF${idx(sx)}`, flat: true });
  const runScrews = (sx: number): Fix => ({ def: SCRS, at: runY.flatMap((y) => [-(D / 2 - 30), D / 2 - 30].map((z) => [sx * (xf - 6), y, z] as Vec3)), dir: [sx, 0, 0], on: `SF${idx(sx)}` });
  const sideScrews = (sx: number): Fix => ({ def: SCR, at: sides.map((sz) => [sx * (xf - 6), y0 + 12.5, sz * (D / 2 - 30)] as Vec3), dir: [sx, 0, 0], on: (p) => `BR${idx(p[2])}`, mate: `SF${idx(sx)}` });
  const fixFor = (d: (typeof drawers)[number]) => {
    const [db, , di, df] = d.ids;
    return [
      { def: SCR, at: sides.flatMap((sx) => [d.yc - 30, d.yc + 20].map((y) => [sx * (dbw / 2 - 6), y, D / 2 - 36] as Vec3)), dir: [0, 0, 1] as Vec3, on: db, mate: di },
      { def: S(8, 4), at: sides.map((sx) => [sx * (dbw / 4), d.yc + 30, D / 2 - 28] as Vec3), dir: [0, 0, 1] as Vec3, on: di, mate: df },
    ] as Fix[];
  };

  kit.step({ title: "Set out the two side frames", detail: "Notches at the top and towards the front, as shown.", warnings: ["floor"], add: ["SF0", "SF1"] });
  kit.step({ title: "Screw three runners onto each frame", detail: "Six screws in each frame. The rollers go to the front.", kind: "runners", tools: ["screwdriver"], fix: [runners(-1), runners(1), runScrews(-1), runScrews(1)] });
  kit.step({ title: "Click the left side panel and the bottom rails onto a frame", detail: "The rails click into the frame. Two screws hold them.", tools: ["screwdriver"], add: ["SP0", "BR0", "BR1"], fix: [sideScrews(-1)] });
  kit.step({ title: "Click the other frame and side panel on", detail: "Onto the other ends of the rails, then two more screws.", tools: ["screwdriver"], add: ["SP1"], fix: [sideScrews(1)] });
  kit.step({ title: "Slide the back panel down into the slots", detail: "The folded edge goes to the bottom.", add: ["BK"] });
  kit.step({ title: "Bend the two tabs to lock it", detail: "With a flat screwdriver, at the bottom of the back.", tools: ["flathead"] });
  kit.step({ title: "Click the top on and slide it back", detail: "Its hooks drop into the slots in the frames, then push it back until it stops.", add: ["TP"] });
  kit.step({ title: "Bend the two tabs under the top", tools: ["flathead"] });
  kit.step({ title: "Screw on the four castors", detail: "Lay the unit on its top on a rug. Tighten each castor with the spanner.", pose: "-y", kind: "legs", tools: ["wrench"], warnings: ["floor"], fix: [{ def: HW.castor, at: sides.flatMap((sx) => sides.map((sz) => [sx * xf, y0, sz * (D / 2 - 30)] as Vec3)), dir: [0, 1, 0], on: (p) => `BR${idx(p[2])}`, flat: true, travel: 70 }] });
  const d0 = drawers[0];
  const c0 = kit.pos(d0.ids[0]);
  const rel = (id: string) => kit.pos(id).map((v, i) => v - c0[i]) as Vec3;
  const [db, dk, di, df] = d0.ids;
  const rep = { repeat: 3, scene: "drawer" };
  kit.step({ title: "Fold up the sides of the drawer bottom", detail: "Bend both sides up and hook the corners together.", pose: "+y", ...rep, stage: [{ id: db, at: [0, 0, 0] }] });
  kit.step({ title: "Hook the back on", detail: "Into the slots at the back of the sides.", ...rep, stage: [{ id: dk, at: rel(dk), from: [0, 0, -200] }] });
  kit.step({ title: "Bend the tabs to hold the back", detail: "Two on each side, with a flat screwdriver.", ...rep, tools: ["flathead"] });
  kit.step({ title: "Slide the front frame on", detail: "Its slots go over the front ends of the sides.", ...rep, stage: [{ id: di, at: rel(di), from: [0, 0, 200] }] });
  kit.step({ title: "Screw the front frame on", detail: "Four screws through the sides.", ...rep, tools: ["screwdriver"], fix: [fixFor(d0)[0]] });
  kit.step({ title: "Press the drawer front on and screw it from inside", detail: "Its two pegs go into the holes in the frame, then two screws.", ...rep, tools: ["screwdriver"], stage: [{ id: df, at: rel(df), from: [0, 0, 200] }], fix: [fixFor(d0)[1]] });
  for (const d of drawers) {
    const name = d.k === 2 ? "top" : d.k === 1 ? "middle" : "bottom";
    const detail = d.k === 2 ? "Stand the unit back on its castors. Rest the drawer on the top runners and push it closed." : d.k === 1 ? "The one with the lock. Push it closed and try the key." : "Push it in until it closes.";
    kit.step({ title: `Slide in the ${name} drawer`, detail, kind: "drawer", ...(d === d0 ? { pose: "+y" as Pose } : {}), add: d.ids.map((id) => [id, [0, 0, 450]] as [string, Vec3]), preset: d === d0 ? [] : fixFor(d) });
  }
  return true;
}

const family: Family = {
  names: ["TROTTEN"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (/trotten-desk-sit-stand|trotten-desk-120-x-70/.test(slug) || /sit\/stand/i.test(s.variant)) return sitStand(b, s);
    if (/^trotten-desk/.test(slug)) return desk(b, s);
    if (/sliding-doors/.test(slug)) return slideCab(b, s);
    if (/cabinet-doors/.test(slug)) return doorCab(b, s);
    if (/drawer-unit-w-3-drawers-on-castors/.test(slug)) return castorUnit(b, s);
    if (/drawer-unit/.test(slug)) return trestle(b, s);
    return false;
  },
};
export default family;
