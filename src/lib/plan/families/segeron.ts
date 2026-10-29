import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";

/**
 * SEGERÖN, from IKEA's manuals: outdoor furniture in powder-coated aluminium and steel with woven rope.
 * A seat section is a woven backrest whose side tubes run down into the back legs, a steel grid seat frame and
 * straight front legs. It is built lying on its side on a rug: the seat frame is bolted to the bottom bar of the
 * backrest (four long bolts on the one-seat section; two on the corner section, which then gets a side backrest
 * hooked on at the top and bolted through its bottom bar), then turned upside down for the front legs (two, or one
 * on the corner). Sections stand side by side and are joined with two clips over the seat tubes on every join.
 * The chair is built upside down on a rug: a front and a back leg frame, each bolted on with two bolts, the front
 * legs carrying the arm tubes. The sun lounger is built upside down on a table: three woven panels hooked on and
 * bolted, the wheel legs and front legs bolted on, then it is turned over and the backrest raised. The tables are a
 * frame of four rails locked with corner brackets, bolted to the legs upside down, then turned over for the
 * aluminium slats, which hook into each other and are held by clips.
 */

const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const ry = (v: Vec3, a: number): Vec3 => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const r1 = (n: number) => Math.round(n * 10) / 10;
const rv = (v: Vec3): Vec3 => [r1(v[0]), r1(v[1]), r1(v[2])];
const box = (size: Vec3, pos: Vec3, material?: PartMaterial, rot?: Vec3): PartPiece => ({ shape: "box", size, pos, ...(material ? { material } : {}), ...(rot ? { rot } : {}) });
const cyl = (dia: number, len: number, pos: Vec3, rot?: Vec3, material: PartMaterial = "metal"): PartPiece => ({ shape: "cyl", size: [dia, len, dia], pos, material, ...(rot ? { rot } : {}) });

type StepOpts = { title: string; detail?: string; scene?: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] };
const stepper = (b: PlanBuilder, scene = "main") => (o: StepOpts, body: () => void = () => {}) =>
  b.step({ kind: "general", tools: [], ...o, scene: o.scene ?? scene, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);

/* ---------- fittings ---------- */

const LONG: HwDef = { kind: "bolt", len: 50, dia: 6 };
const SHORT: HwDef = { kind: "bolt", len: 16, dia: 6 };
const BIGW: HwDef = { kind: "washer", len: 2, dia: 20 };
const SMALLW: HwDef = { kind: "washer", len: 1.5, dia: 14 };
const SPRING: HwDef = { kind: "washer", len: 2, dia: 11, name: "Spring washer" };
const JOIN: HwDef = { kind: "clip", len: 60, dia: 32, name: "Connecting clip" };

/** A bolt with its washers stacked on the same spot. */
function bolted(b: PlanBuilder, bolt: HwDef, washers: HwDef[], list: FitOpts[], gap = 0.08) {
  if (!list.length) return;
  b.fits(bolt, list, gap);
  for (const w of washers) {
    b.then(0.05);
    b.fits(w, list.map((o) => ({ ...o, hole: false as const, mate: undefined })), 0.05);
  }
}

/* ---------- the seat sections ---------- */

const SH = 280; // top of the seat frame
const SEAT = 620; // the seat frame is square
const TOP = 690; // top of the backrest
const LEAN = 0.22; // the backrest leans back this much (radians)
const CUSH = 400; // top of a seat cushion
const BACKC = 760; // top of a back cushion
const CT = 140; // back cushion thickness

type MK = "one" | "corner";
type Yaw = -1 | 0 | 1;
interface Cell {
  kind: MK;
  x0: number; // back left corner of its footprint, mm
  z0: number;
  yaw: Yaw; // 1: turned a quarter so its front faces +x (the left wing); -1: front faces -x
  cush: ("main" | "side")[]; // backrests that get a back cushion (the others are armrests)
}
interface Mod {
  c: Cell;
  ox: number;
  oz: number;
  a: number; // yaw angle
  seat: string;
  back: string;
  side?: string;
  legs: string[];
  keys: string[];
  st: Vec3; // where it stands while it is built, in its scene
}
interface Rec {
  lp: Vec3;
  lr: Vec3;
}

const foot = (k: MK) => (k === "one" ? { w: SEAT, d: SEAT + 140 } : { w: SEAT + 140, d: SEAT + 140 });
// the seat's centre and the front leg positions, in the module's own frame (centred on its footprint)
const seatMid = (k: MK): Vec3 => (k === "one" ? [0, 0, 70] : [70, 0, 70]);
const legSpots = (k: MK): [number, number][] => (k === "one" ? [[-285, 285], [285, 285]] : [[285, 285]]);

function layout(s: ProductSpec): { cells: Cell[]; cushions: boolean } | null {
  const slug = s.slug ?? "";
  const one = (x0: number, z0 = 0): Cell => ({ kind: "one", x0, z0, yaw: 0, cush: ["main"] });
  const corner = (x0: number, z0: number, yaw: Yaw, cush: ("main" | "side")[]): Cell => ({ kind: "corner", x0, z0, yaw, cush });
  const C = SEAT + 140;
  if (/one-seat-section/.test(slug)) return { cells: [one(0)], cushions: false };
  if (/corner-section-outdoor/.test(slug)) return { cells: [corner(0, 0, 0, ["main", "side"])], cushions: false };
  if (/corner-section-cushion/.test(slug)) return { cells: [corner(0, 0, 0, ["main", "side"])], cushions: true };
  if (/2-seat-sofa/.test(slug)) return { cells: [one(0), one(SEAT)], cushions: true };
  // IKEA's photo: a corner at the back left, a one-seat section and a corner turned to make the right arm, and a
  // corner turned to make the left wing's arm in front of the first one
  if (/corner-sofa-3-seat/.test(slug))
    return { cells: [corner(0, 0, 0, ["main", "side"]), one(C), corner(C + SEAT, 0, -1, ["side"]), corner(0, C, 1, ["main"])], cushions: true };
  return null;
}

function sections(b: PlanBuilder, s: ProductSpec): boolean {
  const lay = layout(s);
  if (!lay) return false;
  const { cells, cushions } = lay;

  // centre the whole set on the origin
  const rect = (c: Cell) => {
    const f = foot(c.kind);
    const lx = c.yaw ? f.d : f.w, lz = c.yaw ? f.w : f.d;
    return { x0: c.x0, x1: c.x0 + lx, z0: c.z0, z1: c.z0 + lz };
  };
  const rs = cells.map(rect);
  const cx = (Math.min(...rs.map((r) => r.x0)) + Math.max(...rs.map((r) => r.x1))) / 2;
  const cz = (Math.min(...rs.map((r) => r.z0)) + Math.max(...rs.map((r) => r.z1))) / 2;

  const recs = new Map<string, Rec>();
  const types = new Map<string, { type: string; mid: Vec3 }>();
  const typeOf = (id: string, make: () => { type: string; mid: Vec3 }) => {
    if (!types.has(id)) types.set(id, make());
    return types.get(id)!;
  };
  // a part placed in the module's own frame at `lp`, turned `la` about the vertical
  const put = (m: Mod, t: { type: string; mid: Vec3 }, anchor: Vec3, la = 0) => {
    const lp = rv(plus(anchor, ry(t.mid, la)));
    const key = b.place(t.type, rv(plus([m.ox, 0, m.oz], ry(lp, m.a))), [0, m.a + la, 0]);
    recs.set(key, { lp, lr: [0, la, 0] });
    m.keys.push(key);
    return key;
  };
  const W = (m: Mod, v: Vec3): Vec3 => rv(plus([m.ox, 0, m.oz], ry(v, m.a)));
  const Wd = (m: Mod, d: Vec3): Vec3 => rv(ry(d, m.a));

  const seatOf = (k: MK) =>
    typeOf(`seat-${k}`, () => {
      const h = SEAT / 2, t = 25;
      const pcs: PartPiece[] = [
        box([SEAT, t, t], [0, SH - t / 2, h - t / 2]),
        box([SEAT, t, t], [0, SH - t / 2, -h + t / 2]),
        box([t, t, SEAT - 2 * t], [-h + t / 2, SH - t / 2, 0]),
        box([t, t, SEAT - 2 * t], [h - t / 2, SH - t / 2, 0]),
      ];
      for (let i = 1; i < 8; i++) {
        const u = -h + t + ((SEAT - 2 * t) * i) / 8;
        pcs.push(box([SEAT - 2 * t, 5, 5], [0, SH - 4, u]), box([5, 5, SEAT - 2 * t], [u, SH - 9, 0]));
      }
      for (const [x, z] of legSpots(k)) pcs.push(cyl(38, 70, [x - seatMid(k)[0], SH - t - 35, z - seatMid(k)[2]]));
      return b.compound("Seat frame", pcs, { material: "metal" });
    });
  // a backrest along a seat edge: x along the edge, the seat edge at z = 0 and the backrest behind it (-z)
  const backOf = (kind: "back" | "side") =>
    typeOf(`back-${kind}`, () => {
      const hw = SEAT / 2 - 14;
      const up = Math.hypot(TOP - (SH - 25), (TOP - SH + 25) * Math.tan(LEAN));
      const my = (TOP + SH - 25) / 2;
      const mz = -12.5 - ((my - (SH - 25)) * Math.tan(LEAN));
      const pcs: PartPiece[] = [box([SEAT - 56, 25, 25], [0, SH - 12.5, -12.5], "metal")];
      for (const sx of [-1, 1]) {
        pcs.push(cyl(28, up, [sx * hw, my, mz], [-LEAN, 0, 0]));
        // the backrest's tubes run down into the back legs; the side backrest has a leg at its front end only
        if (kind === "back" || sx < 0) pcs.push(cyl(28, SH - 12, [sx * hw, (SH - 12) / 2, -12.5]));
      }
      const wy = (SH + 60 + TOP - 20) / 2;
      pcs.push(box([SEAT - 60, TOP - 20 - SH - 60, 10], [0, wy, -12.5 - (wy - (SH - 25)) * Math.tan(LEAN)], "fiber", [-LEAN, 0, 0]));
      return b.compound(kind === "back" ? "Backrest" : "Side backrest", pcs, { material: "metal" });
    });
  const legT = typeOf("leg", () => b.compound("Front leg", [cyl(30, SH - 30, [0, (SH - 30) / 2, 0])], { material: "metal" }));

  const mods: Mod[] = cells.map((c, i) => {
    const r = rs[i];
    const m: Mod = { c, ox: (r.x0 + r.x1) / 2 - cx, oz: (r.z0 + r.z1) / 2 - cz, a: (c.yaw * Math.PI) / 2, seat: "", back: "", legs: [], keys: [], st: [0, 0, 0] };
    const sm = seatMid(c.kind);
    m.seat = put(m, seatOf(c.kind), sm);
    m.back = put(m, backOf("back"), [sm[0], 0, sm[2] - SEAT / 2]);
    if (c.kind === "corner") m.side = put(m, backOf("side"), [sm[0] - SEAT / 2, 0, sm[2]], Math.PI / 2);
    for (const [x, z] of legSpots(c.kind)) m.legs.push(put(m, legT, [x + sm[0] - seatMid(c.kind)[0], 0, z]));
    return m;
  });

  // cushions: one seat cushion per seat, a back cushion against every backrest that isn't an armrest
  const seatCush: string[] = [], backCush: string[] = [];
  if (cushions) {
    const soft = (name: string, size: Vec3) => typeOf(`${name}${size.join("x")}`, () => ({ type: b.part(name, size, { material: "soft" }), mid: [0, 0, 0] as Vec3 }));
    for (const m of mods) {
      const sm = seatMid(m.c.kind);
      const hasMain = m.c.cush.includes("main"), hasSide = m.c.cush.includes("side");
      const x0 = sm[0] - SEAT / 2 + (hasSide ? CT : 0), x1 = sm[0] + SEAT / 2;
      const z0 = sm[2] - SEAT / 2 + (hasMain ? CT : 0), z1 = sm[2] + SEAT / 2;
      const cs = soft("Seat cushion", [x1 - x0 - 10, CUSH - SH, z1 - z0 - 10]);
      seatCush.push(b.place(cs.type, W(m, [(x0 + x1) / 2, (SH + CUSH) / 2, (z0 + z1) / 2]), [0, m.a, 0]));
      const bh = BACKC - SH;
      if (hasMain) {
        const t = soft("Back cushion", [SEAT - 10, bh, CT - 10]);
        backCush.push(b.place(t.type, W(m, [sm[0], SH + bh / 2, sm[2] - SEAT / 2 + CT / 2]), [0, m.a, 0]));
      }
      if (hasSide) {
        const len = SEAT - (hasMain ? CT : 0);
        const t = soft("Back cushion", [len - 10, bh, CT - 10]);
        backCush.push(b.place(t.type, W(m, [sm[0] - SEAT / 2 + CT / 2, SH + bh / 2, sm[2] + SEAT / 2 - len / 2]), [0, m.a + Math.PI / 2, 0]));
      }
    }
  }

  const multi = mods.length > 1;
  const ones = mods.filter((m) => m.c.kind === "one");
  const corners = mods.filter((m) => m.c.kind === "corner");
  // while they're built, the sections stand apart in a row back to front, unturned
  if (multi)
    for (const group of [ones, corners])
      group.forEach((m, i) => {
        m.st = [0, 0, (i - (group.length - 1) / 2) * 1050];
      });
  const show = (scene: string, m: Mod, key: string, from?: Vec3) => {
    if (scene === "main") b.add(key, from && Wd(m, from));
    else {
      const r = recs.get(key)!;
      b.stage(key, plus(r.lp, m.st), r.lr, from);
    }
  };
  const at = (m: Mod, lp: Vec3, d: Vec3, on: string, mate?: string): FitOpts => ({ on, at: W(m, lp), dir: Wd(m, d), mate });
  const legBolts = (m: Mod) =>
    m.legs.flatMap((leg, i) => {
      const [x, z] = legSpots(m.c.kind)[i];
      const sx = Math.sign(x);
      return [SH - 80, SH - 45].map((y) => at(m, [x + sx * 19, y, z], [-sx, 0, 0], m.seat, leg));
    });

  const step = stepper(b);
  const each = (n: number, one: string, many: string) => (n > 1 ? many : one);

  /* ---------- one-seat sections ---------- */
  if (ones.length) {
    const sc = multi ? "seats" : "main";
    const n = ones.length;
    step({ title: each(n, "Bolt the seat frame to the backrest", "Bolt each seat frame to its backrest"), detail: "Lay the backrest on its side on a rug and hold the seat frame against its bottom bar. Four long bolts, each with a large washer.", scene: sc, pose: "-x", kind: "bolts", tools: ["allen"], warnings: ["floor"] }, () => {
      b.stagger(0.25);
      for (const m of ones) show(sc, m, m.back, [-300, 0, 0]);
      b.then(0.15);
      for (const m of ones) show(sc, m, m.seat, [0, 0, 340]);
      b.then(0.15);
      const pts = ones.flatMap((m) => [-230, -80, 80, 230].map((x) => at(m, [x, SH - 12.5, 70 - SEAT / 2 - 25], [0, 0, 1], m.back, m.seat)));
      bolted(b, LONG, [BIGW], pts);
    });
    step({ title: each(n, "Turn it upside down and fit the front legs", "Turn them upside down and fit the front legs"), detail: "Push each leg into its socket, then two short bolts with a spring washer and a small washer.", scene: sc, pose: "-y", kind: "legs", tools: ["allen"] }, () => {
      b.stagger(0.2);
      for (const m of ones) for (const l of m.legs) show(sc, m, l, [0, -300, 0]);
      b.then(0.15);
      bolted(b, SHORT, [SPRING, SMALLW], ones.flatMap(legBolts));
    });
    if (multi) step({ title: each(n, "Turn it over onto its legs", "Turn them over onto their legs"), scene: sc, kind: "standup" });
  }

  /* ---------- corner sections ---------- */
  if (corners.length) {
    const sc = multi ? "corners" : "main";
    const n = corners.length;
    step({ title: each(n, "Stand the backrest on its side and bolt the seat frame on", "Stand each backrest on its side and bolt a seat frame on"), detail: "On a rug. Two long bolts with large washers, one at each end of the bottom bar. Leave them a little loose for now.", scene: sc, pose: "-x", kind: "bolts", tools: ["allen"], warnings: ["floor", "hand"] }, () => {
      b.stagger(0.25);
      for (const m of corners) show(sc, m, m.back, [-300, 0, 0]);
      b.then(0.15);
      for (const m of corners) show(sc, m, m.seat, [0, 0, 340]);
      b.then(0.15);
      bolted(b, LONG, [BIGW], corners.flatMap((m) => [-250, 250].map((x) => at(m, [70 + x, SH - 12.5, 70 - SEAT / 2 - 25], [0, 0, 1], m.back, m.seat))));
    });
    step({ title: each(n, "Hook the side backrest on at the top", "Hook the side backrests on at the top"), detail: "Lay it over the open side of the seat frame and slide it towards the backrest until the catch at the top locks.", scene: sc, pose: "-x", kind: "join" }, () => {
      b.stagger(0.25);
      for (const m of corners) show(sc, m, m.side!, [-320, 0, 120]);
    });
    step({ title: each(n, "Bolt the side backrest to the seat frame", "Bolt the side backrests to the seat frames"), detail: "Two long bolts with large washers, down through its bottom bar.", scene: sc, pose: "-x", kind: "bolts", tools: ["allen"] }, () => {
      bolted(b, LONG, [BIGW], corners.flatMap((m) => [-250, 250].map((z) => at(m, [70 - SEAT / 2 - 25, SH - 12.5, 70 + z], [1, 0, 0], m.side!, m.seat))));
    });
    step({ title: "Tighten the first two bolts", detail: "The ones between the backrest and the seat frame, until the heads sit flat on the washers.", scene: sc, pose: "-x", kind: "bolts", tools: ["allen"] });
    step({ title: each(n, "Turn it upside down and fit the front leg", "Turn them upside down and fit the front legs"), detail: "The leg goes into the socket at the open corner: two short bolts, each with a spring washer and a small washer.", scene: sc, pose: "-y", kind: "legs", tools: ["allen"] }, () => {
      b.stagger(0.2);
      for (const m of corners) for (const l of m.legs) show(sc, m, l, [0, -300, 0]);
      b.then(0.15);
      bolted(b, SHORT, [SPRING, SMALLW], corners.flatMap(legBolts));
    });
    if (multi) step({ title: each(n, "Turn it over onto its legs", "Turn them over onto their legs"), scene: sc, kind: "standup" });
  }

  if (!multi) {
    step({ title: "Turn it over onto its legs", detail: "Keep the two clips in the bag: they join it to the next section.", kind: "standup" });
  } else {
    step({ title: "Stand the sections in place", detail: "Push the seat frames tight together, backs in line.", kind: "join", people: 2 }, () => {
      b.stagger(0.1);
      for (const m of mods) for (const k of m.keys) b.add(k, [m.ox * 0.4, 0, m.oz * 0.4]);
    });
    // where two seat frames meet: two clips over the pair of tubes on each join
    const seatRect = (m: Mod) => {
      const sm = seatMid(m.c.kind);
      const a = W(m, [sm[0] - SEAT / 2, 0, sm[2] - SEAT / 2]), c = W(m, [sm[0] + SEAT / 2, 0, sm[2] + SEAT / 2]);
      return { x0: Math.min(a[0], c[0]), x1: Math.max(a[0], c[0]), z0: Math.min(a[2], c[2]), z1: Math.max(a[2], c[2]) };
    };
    const clips: FitOpts[] = [];
    for (let i = 0; i < mods.length; i++)
      for (let j = 0; j < i; j++) {
        const p = seatRect(mods[i]), q = seatRect(mods[j]);
        const sx = Math.abs(p.x0 - q.x1) < 2 ? p.x0 : Math.abs(p.x1 - q.x0) < 2 ? p.x1 : null;
        const sz = Math.abs(p.z0 - q.z1) < 2 ? p.z0 : Math.abs(p.z1 - q.z0) < 2 ? p.z1 : null;
        if (sx !== null) {
          const a = Math.max(p.z0, q.z0), e = Math.min(p.z1, q.z1);
          if (e - a > 200) for (const z of [a + 90, e - 90]) clips.push({ on: mods[i].seat, at: [sx, SH + 4, z], dir: [0, -1, 0], hole: false, travel: 80 });
        } else if (sz !== null) {
          const a = Math.max(p.x0, q.x0), e = Math.min(p.x1, q.x1);
          if (e - a > 200) for (const x of [a + 90, e - 90]) clips.push({ on: mods[i].seat, at: [x, SH + 4, sz], dir: [0, -1, 0], hole: false, travel: 80 });
        }
      }
    step({ title: "Clip the sections together", detail: "Two clips on every join: press each one down over the two seat tubes until it clicks, then slide it along until it clicks again.", kind: "join" }, () => {
      b.fits(JOIN, clips, 0.2);
    });
  }
  if (seatCush.length) {
    step({ title: seatCush.length > 1 ? "Lay the seat cushions on" : "Lay the seat cushion on", detail: "Zips facing the back.", kind: "cushions" }, () => {
      b.stagger(0.15);
      for (const k of seatCush) b.add(k, [0, 300, 0]);
    });
    step({ title: backCush.length > 1 ? "Stand the back cushions against the backrests" : "Stand the back cushion against the backrest", detail: backCush.length > 1 ? "On the corner, the cushion along the back goes in first." : undefined, kind: "cushions" }, () => {
      b.stagger(0.15);
      for (const k of backCush) b.add(k, [0, 250, 0]);
    });
  }
  return true;
}

/* ---------- the chair with armrests: upside down on a rug ---------- */

function chair(b: PlanBuilder, s: ProductSpec): boolean {
  const w = s.size.w * 10, h = s.size.h * 10, d = s.size.d * 10;
  const sy = 420; // top of the seat frame
  const fz = d / 2 - 50, bz = -d / 2 + 85; // front legs, top of the back legs
  const xs = 285, xf = w / 2 - 25; // seat frame sides, front legs (they carry on up as the arm tubes)
  const shell = b.compound("Seat", [
    box([2 * xs + 20, 25, 25], [0, sy - 12.5, fz - 10], "metal"),
    box([2 * xs - 20, 25, 25], [0, sy - 12.5, bz - 15], "metal"),
    ...[-1, 1].map((sx) => box([25, 25, fz - bz + 5], [sx * xs, sy - 12.5, (fz + bz) / 2 - 12.5], "metal")),
    ...Array.from({ length: 9 }, (_, i) => box([2 * xs - 25, 8, 30], [0, sy - 6, bz + 20 + (i * (fz - bz - 60)) / 8], "metal")),
    ...[-1, 1].map((sx) => cyl(32, 45, [sx * xf, sy - 47, fz])),
    ...[-1, 1].map((sx) => box([xf - xs, 20, 30], [sx * (xs + xf) / 2, sy - 12.5, fz], "metal")),
    ...[-1, 1].map((sx) => cyl(36, 20, [sx * (xs - 5), sy - 35, bz])),
    box([2 * xs + 40, h - sy - 20, 20], [0, (sy + h - 20) / 2, -d / 2 + 15], "fiber"),
    box([2 * xs + 60, 25, 40], [0, h - 12.5, -d / 2 + 25], "metal"),
    ...[-1, 1].map((sx) => box([20, 230, fz - bz - 40], [sx * (w / 2 - 25), sy + 115, (fz + bz) / 2 - 30], "fiber")),
    ...[-1, 1].map((sx) => box([40, 25, fz - bz + 10], [sx * (w / 2 - 25), sy + 242, (fz + bz) / 2 - 10], "metal")),
  ], { material: "metal" });
  const seat = b.place(shell.type, shell.mid);
  const front = b.compound("Front leg frame", [
    ...[-1, 1].map((sx) => cyl(30, sy - 70, [sx * xf, (sy - 70) / 2, fz])),
    box([2 * xf - 30, 22, 22], [0, sy - 36, fz - 25], "metal"),
    ...[-1, 1].map((sx) => box([40, 5, 40], [sx * (xs - 60), sy - 27.5, fz - 25], "metal")),
  ], { material: "metal" });
  const frontK = b.place(front.type, front.mid);
  const tubeT = b.part("Arm tube", [26, sy + 230 - (sy - 70), 26], { shape: "cyl", material: "metal" });
  const tubes = [-1, 1].map((sx) => b.place(tubeT, [sx * xf, (sy - 70 + sy + 230) / 2, fz]));
  const tilt = Math.atan2(70, sy - 25);
  const len = Math.hypot(70, sy - 25);
  const back = b.compound("Back leg frame", [
    ...[-1, 1].map((sx) => cyl(30, len, [sx * (xs - 5), (sy - 25) / 2, bz - 35], [tilt, 0, 0])),
    box([2 * xs - 40, 22, 22], [0, sy - 36, bz + 20], "metal"),
    ...[-1, 1].map((sx) => box([40, 5, 40], [sx * (xs - 60), sy - 27.5, bz + 20], "metal")),
  ], { material: "metal" });
  const backK = b.place(back.type, back.mid);
  const cushion = b.place(b.part("Seat cushion", [2 * xs - 30, 50, fz - bz - 20], { material: "soft" }), [0, sy + 25, (fz + bz) / 2 + 10]);
  const bolt: HwDef = { kind: "bolt", len: 16, dia: 6 };
  const tabs = (z: number, on: string): FitOpts[] => [-1, 1].map((sx) => ({ on, at: [sx * (xs - 60), sy - 30, z], dir: [0, 1, 0], mate: seat }));
  const step = stepper(b);
  const aside: Vec3 = [0, 0, 650];
  step({ title: "Push the arm tubes into the front legs", detail: "The frame whose bar sits lower goes at the front. Press each tube's button in and slide it down until the button clicks out through the hole.", kind: "join" }, () => {
    b.stage(frontK, plus(front.mid, aside), [0, 0, 0], [0, 200, 0]);
    b.then(0.15);
    for (const t of tubes) b.stage(t, plus(b.partItem(t).final.pos, aside), [0, 0, 0], [0, 260, 0]);
  });
  step({ title: "Lay the seat upside down and push the front legs in", detail: "On a rug. The arm tubes go through the holes in the seat frame and up into the arms.", pose: "-y", kind: "join", warnings: ["floor"] }, () => {
    b.add(seat, [0, -250, 0]);
    b.then(0.2);
    b.add(frontK);
    for (const t of tubes) b.add(t);
  });
  step({ title: "Bolt the front legs to the seat", detail: "Two bolts with washers through the tabs on the bar.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => bolted(b, bolt, [SMALLW], tabs(fz - 25, frontK)));
  step({ title: "Push the back legs into the rings", detail: "Both legs at once, until they sit right down in the rings under the seat.", pose: "-y", kind: "join" }, () => b.add(backK, [0, -300, 0]));
  step({ title: "Bolt the back legs to the seat", detail: "Two bolts with washers through the tabs, then tighten all four.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => bolted(b, bolt, [SMALLW], tabs(bz + 20, backK)));
  step({ title: "Turn the chair over", kind: "standup" });
  step({ title: "Strap the cushion on", detail: "Loop the elastic strap round the back of the seat frame and push the plastic pin through the loop.", kind: "cushions" }, () => b.add(cushion, [0, 250, 0]));
  return true;
}

/* ---------- the sun lounger: upside down on a table ---------- */

function lounger(b: PlanBuilder, s: ProductSpec): boolean {
  const FW = 700; // frame outside width; the wheels stand out past it
  const L = 1950; // IKEA gives no length; the manual's frame is close to three times its width
  const y0 = 300, y1 = 340; // frame rails
  const hz = -L / 2; // the head end, where the backrest and wheels are
  const hinge = hz + 760;
  const frame = b.compound("Frame", [
    ...[-1, 1].map((sx) => box([30, y1 - y0, L], [sx * (FW / 2 - 15), (y0 + y1) / 2, 0])),
    ...[-1, 1].map((sz) => box([FW - 60, y1 - y0, 30], [0, (y0 + y1) / 2, sz * (L / 2 - 15)])),
    box([FW - 60, 30, 30], [0, y1 - 15, hinge + 15]),
    ...Array.from({ length: 11 }, (_, i) => box([FW - 60, 5, 6], [0, y1 - 4, hinge + 30 + ((L / 2 - 30 - hinge - 30) * (i + 0.5)) / 11])),
    ...Array.from({ length: 6 }, (_, i) => box([6, 5, L / 2 - 30 - hinge - 30], [-FW / 2 + 30 + ((FW - 60) * (i + 0.5)) / 6, y1 - 9, (hinge + 30 + L / 2 - 30) / 2])),
    ...[-1, 1].map((sx) => cyl(40, 60, [sx * (FW / 2 - 40), y0 - 30, L / 2 - 60])),
  ], { material: "metal" });
  const frameK = b.place(frame.type, frame.mid);
  const BL = hinge - hz - 40;
  const backPcs = (): PartPiece[] => [
    ...[-1, 1].map((sx) => box([25, 25, BL], [sx * (FW / 2 - 52), 0, 0])),
    ...[-1, 1].map((sz) => box([FW - 104, 25, 25], [0, 0, sz * (BL / 2 - 12.5)])),
    ...Array.from({ length: 8 }, (_, i) => box([FW - 104, 5, 6], [0, 8, -BL / 2 + 25 + ((BL - 50) * (i + 0.5)) / 8])),
  ];
  const backT = b.compound("Backrest", backPcs(), { material: "metal" });
  const ang = 0.6;
  const backFinal: Vec3 = [0, y1 + 12 + Math.sin(ang) * (BL / 2), hinge - Math.cos(ang) * (BL / 2)];
  const backK = b.place(backT.type, rv(backFinal), [ang, 0, 0]);
  const ph = 170;
  const sideT = b.part("Side panel", [25, ph, hinge - hz], { material: "fiber" });
  const sides = [-1, 1].map((sx) => b.place(sideT, [sx * (FW / 2 - 15), y1 + ph / 2, (hz + hinge) / 2]));
  const endK = b.place(b.part("End panel", [FW - 60, ph, 25], { material: "fiber" }), [0, y1 + ph / 2, hz + 15]);
  const wz = hz + 90, wy = 100;
  const lt = { y: 380, z: hz + 230 };
  const tilt = Math.atan2(lt.z - wz, lt.y - wy);
  const legLen = Math.hypot(lt.z - wz, lt.y - wy);
  const wlegT = b.part("Wheel leg", [30, legLen, 30], { shape: "cyl", material: "metal" });
  const wlegs = [-1, 1].map((sx) => b.place(wlegT, [sx * (FW / 2 + 15), (wy + lt.y) / 2, (wz + lt.z) / 2], [tilt, 0, 0]));
  const wheelT = b.compound("Wheel", [{ shape: "cyl", size: [200, 40, 200], pos: [0, 0, 0], rot: [0, 0, Math.PI / 2], material: "board" }]);
  const wheels = [-1, 1].map((sx) => b.place(wheelT.type, [sx * (FW / 2 + 50), wy, wz]));
  const flegT = b.part("Front leg", [35, y0 - 30, 35], { shape: "cyl", material: "metal" });
  const flegs = [-1, 1].map((sx) => b.place(flegT, [sx * (FW / 2 - 40), (y0 - 30) / 2, L / 2 - 60]));
  const cushT = b.compound("Cushion", [
    box([FW - 80, 70, L / 2 - 30 - hinge], [0, y1 + 35, (hinge + L / 2 - 30) / 2]),
    box([FW - 80, 70, BL], plus(backFinal, [0, 47 * Math.cos(ang), 47 * Math.sin(ang)]), undefined, [ang, 0, 0]),
  ], { material: "soft" });
  const cushK = b.place(cushT.type, cushT.mid);

  const LB: HwDef = { kind: "bolt", len: 90, dia: 6 };
  const MB: HwDef = { kind: "bolt", len: 40, dia: 6 };
  const SPACER: HwDef = { kind: "spacer", len: 12, dia: 18, name: "Spacer" };
  const step = stepper(b);
  const up = (k: string) => [-1, 1].map((sx, i) => ({ on: k, at: [sx * 200, y0, hz + 15] as Vec3, dir: [0, 1, 0] as Vec3, mate: frameK, i }));
  step({ title: "Bolt a wheel onto each wheel leg", detail: "One short bolt with a spring washer and a washer through the middle of each wheel into the end of the leg.", scene: "wheels", kind: "bolts", tools: ["allen"] }, () => {
    b.stagger(0.2);
    for (const k of [...wlegs, ...wheels]) {
      const it = b.partItem(k);
      b.stage(k, it.final.pos, it.final.rot, k === wheels[0] ? [-200, 0, 0] : k === wheels[1] ? [200, 0, 0] : [0, 200, 0]);
    }
    b.then(0.15);
    bolted(b, SHORT, [SPRING, SMALLW], [-1, 1].map((sx, i) => ({ on: wheels[i], at: [sx * (FW / 2 + 70), wy, wz] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: wlegs[i] })));
  });
  step({ title: "Lay the frame upside down and hook on a side panel", detail: "On a table with a rug on it. Hook the panel onto the frame, then two long bolts, each with a spring washer and a washer.", pose: "-y", kind: "bolts", tools: ["allen"], warnings: ["floor"] }, () => {
    b.add(frameK, [0, -250, 0]);
    b.stage(backK, [0, y1 - 12.5, (hz + hinge) / 2 + 20], [0, 0, 0], [0, -250, 0]);
    b.then(0.2);
    b.add(sides[0], [0, 300, 0]);
    b.then(0.15);
    bolted(b, LB, [SPRING, SMALLW], [hz + 150, hinge - 150].map((z) => ({ on: sides[0], at: [-(FW / 2 - 15), y0, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: frameK })));
  });
  step({ title: "Hook on the other side panel and bolt it", detail: "Two more long bolts with their washers.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {
    b.add(sides[1], [0, 300, 0]);
    b.then(0.15);
    bolted(b, LB, [SPRING, SMALLW], [hz + 150, hinge - 150].map((z) => ({ on: sides[1], at: [FW / 2 - 15, y0, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: frameK })));
  });
  step({ title: "Hook on the end panel and bolt it", detail: "Across the head end, two long bolts with their washers.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {
    b.add(endK, [0, 300, 0]);
    b.then(0.15);
    bolted(b, LB, [SPRING, SMALLW], up(endK));
  });
  step({ title: "Bolt the wheel legs on", detail: "Against the outside of the frame at the head end. The longer bolt goes in the top hole, the short one below it, each with a spring washer and a washer.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {
    b.stagger(0.15);
    for (const k of [...wlegs, ...wheels]) b.add(k, [Math.sign(b.partItem(k).final.pos[0]) * 300, 0, 0]);
    b.then(0.15);
    const pt = (sx: number, i: number, y: number, z: number): FitOpts => ({ on: wlegs[i], at: [sx * (FW / 2 + 30), y, z], dir: [-sx, 0, 0], mate: sides[i] });
    bolted(b, MB, [SPRING, SMALLW], [-1, 1].map((sx, i) => pt(sx, i, 360, lt.z - 10)));
    b.then(0.1);
    bolted(b, SHORT, [SPRING, SMALLW], [-1, 1].map((sx, i) => pt(sx, i, 315, lt.z - 35)));
  });
  step({ title: "Tighten the six bolts at the head end", detail: "Until every head sits flat on its washers.", pose: "-y", kind: "bolts", tools: ["allen"] });
  step({ title: "Fit the front legs", detail: "Push each one into its socket at the foot end, then two short bolts with a spring washer and a washer.", pose: "-y", kind: "legs", tools: ["allen"] }, () => {
    b.stagger(0.2);
    for (const k of flegs) b.add(k, [0, -300, 0]);
    b.then(0.15);
    bolted(b, SHORT, [SPRING, SMALLW], [-1, 1].flatMap((sx, i) => [y0 - 45, y0 - 15].map((y) => ({ on: frameK, at: [sx * (FW / 2 - 60), y, L / 2 - 60] as Vec3, dir: [sx, 0, 0] as Vec3, mate: flegs[i] }))));
  });
  step({ title: "Turn it over together", detail: "One of you at each end, lifting by the frame.", kind: "standup", people: 2 });
  step({ title: "Cut the strap that holds the backrest down", detail: "Cut the strap only, not the weave.", kind: "general", tools: ["knife"] });
  step({ title: "Raise the backrest and bolt its hinges", detail: "A bolt through each side panel into the backrest, with a spring washer, a washer and a spacer between the panel and the backrest. It then props up in five positions.", kind: "bolts", tools: ["allen"] }, () => {
    b.add(backK);
    b.then(0.15);
    const pts = [-1, 1].map((sx, i) => ({ on: sides[i], at: [sx * (FW / 2 - 2), y1 + 20, hinge - 25] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: backK }));
    bolted(b, MB, [SPRING, SMALLW], pts);
    b.then(0.05);
    b.fits(SPACER, [-1, 1].map((sx, i) => ({ on: sides[i], at: [sx * (FW / 2 - 34), y1 + 20, hinge - 25] as Vec3, dir: [-sx, 0, 0] as Vec3, hole: false as const })), 0.05);
  });
  step({ title: "Lay the cushion on", detail: "Tie its straps round the frame so it stays put when you move the backrest.", kind: "cushions" }, () => b.add(cushK, [0, 300, 0]));
  return true;
}

/* ---------- the tables: a rail frame upside down, then the slats ---------- */

type Clips = "a" | "b" | "both" | "last";
interface TableOpt {
  railH: number;
  stripsX: number; // strips on each long rail
  stripsC: number; // strips on the middle rail
  // the slat steps after the frame: lay slats (and clip them in the same step), or click in clips on their own
  seq: { lay?: number; clips?: Clips }[];
}

function table(b: PlanBuilder, s: ProductSpec, o: TableOpt): boolean {
  const longX = s.size.w >= s.size.d;
  const U = Math.max(s.size.w, s.size.d) * 10, V = Math.min(s.size.w, s.size.d) * 10, H = s.size.h * 10;
  // u runs along the long side, v across it; on a square table u is x
  const P = (u: number, y: number, v: number): Vec3 => (longX ? [u, y, v] : [v, y, u]);
  const S = (su: number, y: number, sv: number): Vec3 => (longX ? [su, y, sv] : [sv, y, su]);
  const lid = 50, rt = 25, sl = 18;
  const ledge = (len: number, along: "u" | "v", inward: number): PartPiece[] => [
    box(along === "u" ? S(len, o.railH, rt) : S(rt, o.railH, len), [0, 0, 0]),
    box(along === "u" ? S(len, 4, 16) : S(16, 4, len), along === "u" ? P(0, o.railH / 2 - sl - 4, inward * (rt / 2 + 8)) : P(inward * (rt / 2 + 8), o.railH / 2 - sl - 4, 0)),
  ];
  const ry0 = H - o.railH / 2;
  const longT = new Map<number, string>();
  const shortT = new Map<number, string>();
  const rails: string[] = []; // long front, long back, short left, short right
  for (const sv of [-1, 1]) {
    const t = longT.get(sv) ?? b.compound("Long rail", ledge(U - 2 * lid, "u", -sv), { material: "metal" }).type;
    longT.set(sv, t);
    rails.push(b.place(t, P(0, ry0, sv * (V / 2 - rt / 2))));
  }
  for (const su of [-1, 1]) {
    const t = shortT.get(su) ?? b.compound("Short rail", ledge(V - 2 * lid, "v", -su), { material: "metal" }).type;
    shortT.set(su, t);
    rails.push(b.place(t, P(su * (U / 2 - rt / 2), ry0, 0)));
  }
  const legT = b.part("Leg", [lid, H, lid], { shape: "cyl", material: "metal" });
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const legs = corners.map(([su, sv]) => b.place(legT, P(su * (U / 2 - lid / 2), H / 2, sv * (V / 2 - lid / 2))));
  const cy = H - sl - 2 - 15;
  const cross = b.compound("Middle rail", [
    box(S(U - 2 * rt - 10, 30, 25), [0, 0, 0]),
    ...[-1, 1].map((su) => box(S(5, 40, 50), P(su * (U / 2 - rt - 2.5), 0, 0))),
  ], { material: "metal" });
  const crossK = b.place(cross.type, P(0, cy, 0));
  // the rubber strips: on the ledges of the rails and on top of the middle rail
  const stripT = new Map<string, string>();
  const strip = (size: Vec3, pos: Vec3) => {
    const id = size.join("x");
    if (!stripT.has(id)) stripT.set(id, b.part("Rubber strip", size, { material: "soft" }));
    return b.place(stripT.get(id)!, pos);
  };
  const ys = H - sl - 1;
  const runLen = U - 2 * lid - 10;
  const stripsLong: string[] = [], stripsCross: string[] = [], stripsShort: string[] = [];
  for (const sv of [-1, 1])
    for (let k = 0; k < o.stripsX; k++) {
      const len = runLen / o.stripsX;
      stripsLong.push(strip(S(len - 2, 2, 14), P(-runLen / 2 + len * (k + 0.5), ys, sv * (V / 2 - rt - 8))));
    }
  for (let k = 0; k < o.stripsC; k++) {
    const len = (U - 2 * rt - 140) / o.stripsC;
    stripsCross.push(strip(S(len - 2, 2, 14), P(-(U - 2 * rt - 140) / 2 + len * (k + 0.5), ys, 0)));
  }
  for (const su of [-1, 1]) stripsShort.push(strip(S(14, 2, V - 2 * lid - 10), P(su * (U / 2 - rt - 8), ys, 0)));

  // the slats run the length of the table, hooked edge to edge across it
  const n = o.seq.reduce((t, x) => t + (x.lay ?? 0), 0);
  const span = V - 2 * rt;
  const sw = span / n;
  const hole = Math.floor(n / 2);
  const plainT = b.part("Slat", S(U - 2 * rt, sl, sw - 1), { material: "metal" });
  const edgeT = (name: string) => b.part(name, S(U - 2 * lid - 4, sl, sw - 1), { material: "metal" });
  const firstT = edgeT("First slat"), lastT = edgeT("Last slat");
  const holeT = H > 500 ? b.part("Slat with parasol hole", S(U - 2 * rt, sl, sw - 1), { material: "metal" }) : plainT;
  const vOf = (i: number) => -span / 2 + sw * (i + 0.5);
  const slats = Array.from({ length: n }, (_, i) => b.place(i === 0 ? firstT : i === n - 1 ? lastT : i === hole ? holeT : plainT, P(0, H - sl / 2, vOf(i))));

  const BRK: HwDef = { kind: "angle", len: 60, dia: 30, name: "Corner bracket" };
  const HEX: HwDef = { kind: "bolt", len: 30, dia: 8, name: "Hex bolt" };
  const W8: HwDef = { kind: "washer", len: 2, dia: 17 };
  const SPR8: HwDef = { kind: "washer", len: 2, dia: 14, name: "Spring washer" };
  const CB: HwDef = { kind: "bolt", len: 12, dia: 6 };
  const CLIP: HwDef = { kind: "clip", len: 30, dia: 22, name: "Slat clip" };
  const railAt = (su: number, sv: number) => ({ long: rails[sv < 0 ? 0 : 1], short: rails[su < 0 ? 2 : 3] });
  // the brackets sit in the corners against the ends of the long rails; the hex bolts go through them into the legs
  const brk = (su: number, sv: number): FitOpts => ({ on: railAt(su, sv).long, at: P(su * (U / 2 - lid - 8), ry0, sv * (V / 2 - rt - 10)), dir: S(0, 0, -sv), hole: false });
  const step = stepper(b);
  const down: Vec3 = [0, -250, 0]; // upside down, "from above" is the table's underside

  step({ title: "Lay the rails upside down on a rug", detail: "Slots facing in and the ledges at the bottom. Check every rail end against the drawing before you go on.", pose: "-y", kind: "join", warnings: ["floor"] }, () => {
    b.stagger(0.25);
    b.add(rails[0], down);
    b.add(rails[2], down);
  });
  step({ title: "Lock the first corner with a bracket", detail: "Slide the bracket into both rail ends and turn it until it sits flat in the corner.", pose: "-y", kind: "join" }, () => {
    b.fits(BRK, [brk(-1, -1)], 0.1);
  });
  step({ title: "Add the other two rails and lock the corners", detail: "Three more brackets, the same way.", pose: "-y", kind: "join" }, () => {
    b.stagger(0.25);
    b.add(rails[1], down);
    b.add(rails[3], down);
    b.then(0.15);
    b.fits(BRK, [brk(1, -1), brk(1, 1), brk(-1, 1)], 0.15);
  });
  step({ title: "Bolt on the four legs", detail: "One hex bolt with a spring washer and a washer through each bracket into the leg. Snug them with the spanner, not tight yet.", pose: "-y", kind: "legs", tools: ["wrench"], warnings: ["hand"] }, () => {
    b.stagger(0.2);
    for (const l of legs) b.add(l, [0, -320, 0]);
    b.then(0.15);
    bolted(b, HEX, [SPR8, W8], corners.map(([su, sv], i) => ({ on: legs[i], at: P(su * (U / 2 - lid / 2 - 18), ry0, sv * (V / 2 - lid / 2 - 18)), dir: rv(S(su * Math.SQRT1_2, 0, sv * Math.SQRT1_2)) })));
  });
  step({ title: "Bolt the middle rail between the ends", detail: "Its plates go against the inside of the short rails. Two bolts at each end with the Allen key.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {
    b.add(crossK, [0, -200, 0]);
    b.then(0.15);
    b.fits(CB, [-1, 1].flatMap((su) => [-12, 12].map((dv) => ({ on: crossK, at: P(su * (U / 2 - rt - 1), cy, dv), dir: S(su, 0, 0), mate: rails[su < 0 ? 2 : 3] }))), 0.1);
  });
  step({ title: "Tighten the four leg bolts", detail: "Firmly with the spanner, so the legs stand square to the frame.", pose: "-y", kind: "bolts", tools: ["wrench"], warnings: ["square"] });
  step({ title: "Turn the table over", detail: H > 500 ? "Together, lifting it by the frame." : "Lift it by the frame.", kind: "standup", people: H > 500 ? 2 : 1 });
  const lay = (list: string[]) => {
    b.stagger(0.15);
    for (const k of list) b.add(k, [0, 200, 0]);
  };
  if (o.stripsX > 1) {
    step({ title: "Lay the strips along the long rails", detail: "Two on each ledge, butted end to end, the outer ends 5 mm from the slots.", kind: "general" }, () => lay(stripsLong));
    step({ title: "Lay two strips on the middle rail", detail: "End to end, the same distance in from each end.", kind: "general" }, () => lay(stripsCross));
    step({ title: "Lay a strip along each end rail", kind: "general" }, () => lay(stripsShort));
  } else {
    step({ title: "Lay the rubber strips on the rails", detail: "One on the ledge of each rail, 5 mm from the slot at its end, and one on top of the middle rail, 65 mm in from its end.", kind: "general" }, () => lay([...stripsLong, ...stripsShort, ...stripsCross]));
  }
  // clips go on the end rails' ledges, under the slats
  const clipAt = (v: number, su: number): FitOpts => ({ on: rails[su < 0 ? 2 : 3], at: P(su * (U / 2 - rt - 10), H - sl - 3, v), dir: S(-su, 0, 0), hole: false, travel: 60 });
  let next = 0, from = 0;
  const clips = (c: Clips) => {
    const i = Math.max(0, next - 1);
    const pair = (su: number) => [clipAt(vOf(0) - sw * 0.3, su), clipAt(vOf(0) + sw * 0.3, su)];
    const mid = from + Math.floor((next - from) / 2);
    b.fits(CLIP, c === "a" ? pair(-1) : c === "b" ? pair(1) : c === "last" ? [clipAt(vOf(i), -1), clipAt(vOf(i), 1)] : [clipAt(vOf(mid), -1), clipAt(vOf(mid), 1)], 0.2);
  };
  const clipText = "Push each clip onto the ledge under the slats and slide it along until it clicks.";
  for (const x of o.seq) {
    if (x.lay) {
      const list = slats.slice(next, next + x.lay);
      const first = next === 0, end = next + x.lay === n;
      const hasHole = next <= hole && hole < next + x.lay && holeT !== plainT;
      const title = first ? "Lay the first slat in along one long side" : end ? "Drop in the last slat" : x.lay > 1 ? `Hook in ${x.lay === 2 ? "two" : "three"} more slats` : "Hook the next slat onto it";
      const detail = first
        ? "Its hooked edge faces the middle of the table. It rests on the strips at both ends."
        : end
          ? "Tip it in under the lip of the leg tops at the corners."
          : hasHole
            ? "Each one hooks under the edge of the one before, then tips down flat. The slat with the parasol hole goes in the middle."
            : "Each one hooks under the edge of the one before, then tips down flat.";
      from = next;
      next += x.lay;
      step({ title: x.clips ? `${title} and clip it` : title, detail: x.clips ? `${detail} Then two clips, one at each end.` : detail, kind: "slats" }, () => {
        lay(list);
        if (x.clips) {
          b.then(0.15);
          clips(x.clips);
        }
      });
      if (end) step({ title: "Slide the slats tight to the side", detail: "Push them across until the edges tuck under the lips of the leg tops at all four corners.", kind: "slats", warnings: ["square"] });
    } else if (x.clips) {
      const c = x.clips;
      const title = c === "a" ? "Click two clips in at one end" : c === "b" ? "Click two clips in at the other end" : c === "last" ? "Click the last two clips in" : "Click a clip in at each end";
      step({ title, detail: clipText, kind: "slats" }, () => clips(c));
    }
  }
  if (holeT !== plainT) {
    const RING: HwDef = { kind: "cap", len: 4, dia: 60, name: "Parasol ring" };
    const CAP: HwDef = { kind: "cap", len: 3, dia: 48, name: "Parasol cap" };
    step({ title: "Fit the ring and cap in the parasol hole", detail: "Press the ring into the hole, turn it to lock, then push the cap in. Take the cap out when you use a parasol.", kind: "general" }, () => {
      b.fits(RING, [{ on: slats[hole], at: P(0, H, vOf(hole)), dir: [0, -1, 0], hole: false }], 0.1);
      b.then(0.1);
      b.fits(CAP, [{ on: slats[hole], at: P(0, H + 2, vOf(hole)), dir: [0, -1, 0], hole: false }], 0.1);
    });
  }
  return true;
}

/* ---------- the bar stool: four legs under a cross plate, a foot ring, the swivel seat ---------- */

/** A round tube from a to b, any direction. */
function tube(a: Vec3, b: Vec3, dia: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const u = d.map((v) => v / len);
  return cyl(dia, len, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], [Math.atan2(u[2], u[1]), 0, Math.asin(-u[0])]);
}

function barStool(b: PlanBuilder, s: ProductSpec): boolean {
  // IKEA's page: 53 cm across the feet, 82 cm to the top of the back rim, seat 74 cm high
  const FOOT = 250, TOPR = 70, BEND = 560, LEGD = 25;
  const PLATE = 666; // underside of the cross plate, on the leg tops
  const SEATY = 740;
  const RINGY = 300;
  const at = (y: number) => (y >= BEND ? TOPR : TOPR + ((FOOT - TOPR) * (BEND - y)) / BEND); // leg offset from the middle
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const legT = b.compound("Leg", [
    tube([0, PLATE, 0], [0, BEND, 0], LEGD),
    tube([0, BEND, 0], [FOOT - TOPR, 0, FOOT - TOPR], LEGD),
    cyl(28, 14, [FOOT - TOPR, 7, FOOT - TOPR], undefined, "fiber"),
  ], { material: "metal" });
  // each leg is the same tube turned to its corner
  const legs = corners.map(([sx, sz]) => {
    const yaw = Math.atan2(sx, sz) - Math.PI / 4;
    const mid = ry(legT.mid, yaw);
    return b.place(legT.type, plus(mid, [sx * TOPR, 0, sz * TOPR]), [0, yaw, 0]);
  });
  const diag = (r: number) => corners.map(([sx, sz]): [number, number] => [(sx * r) / Math.SQRT2, (sz * r) / Math.SQRT2]);
  const arm = 2 * 165;
  const plateT = b.compound("Cross plate", [
    box([arm, 4, 34], [0, PLATE + 2, 0], "metal", [0, Math.PI / 4, 0]),
    box([arm, 4, 34], [0, PLATE + 2, 0], "metal", [0, -Math.PI / 4, 0]),
  ], { material: "metal" });
  const plate = b.place(plateT.type, plateT.mid);
  // the foot ring sits inside the legs, held off them by the spacer bolts
  const legR = at(RINGY) * Math.SQRT2;
  const ringR = legR - LEGD / 2 - 14 - 11;
  const segs = 40;
  const ringT = b.compound("Foot ring", Array.from({ length: segs }, (_, i) => {
    // each short tube runs a little past its neighbours so the ring reads as one
    const a0 = ((i - 0.06) / segs) * 2 * Math.PI, a1 = ((i + 1.06) / segs) * 2 * Math.PI;
    return tube([ringR * Math.cos(a0), RINGY, ringR * Math.sin(a0)], [ringR * Math.cos(a1), RINGY, ringR * Math.sin(a1)], 22);
  }), { material: "metal" });
  const ring = b.place(ringT.type, ringT.mid);
  // the swivel under the woven seat, the seat pan and its rim, high at the back
  const rim: PartPiece[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * 2 * Math.PI;
    const back = Math.max(0, -Math.cos(a)); // 1 at the back (-z), 0 at the sides and front
    const h = 25 + 75 * back * back;
    rim.push(box([34, h, 26], [195 * Math.sin(a), SEATY - 10 + h / 2, 195 * Math.cos(a)], "fiber", [0, a, 0]));
  }
  const seatT = b.compound("Seat", [
    cyl(150, 8, [0, PLATE + 8, 0], undefined, "metal"),
    cyl(270, 26, [0, PLATE + 25, 0], undefined, "metal"),
    cyl(380, 22, [0, SEATY - 11, 0], undefined, "fiber"),
    ...rim,
  ], { material: "fiber" });
  const seat = b.place(seatT.type, seatT.mid);

  const BOLT: HwDef = { kind: "bolt", len: 16, dia: 6 };
  const SPACER: HwDef = { kind: "bolt", len: 30, dia: 8, name: "Spacer bolt" };
  const W: HwDef = { kind: "washer", len: 1.5, dia: 16 };
  const step = stepper(b);
  step({ title: "Stand the legs on a rug and lay the cross plate on top", detail: "Put a bolt with a spring washer and a washer through each hole into a leg. Only turn them in part way for now.", kind: "bolts", tools: ["allen"], warnings: ["floor"] }, () => {
    legs.forEach((k, i) => {
      if (i) b.then(0.08);
      b.add(k, [corners[i][0] * 120, 0, corners[i][1] * 120]);
    });
    b.then(0.2);
    b.add(plate, [0, 200, 0]);
    b.then(0.2);
    bolted(b, BOLT, [SPRING, W], diag(TOPR * Math.SQRT2).map(([x, z], i): FitOpts => ({ on: plate, at: [x, PLATE + 4, z], dir: [0, -1, 0], mate: legs[i] })));
  });
  step({ title: "Lift the foot ring up between the legs", detail: "From below, up to the holes in the legs. Screw a spacer bolt through each leg into the ring, with the Allen key.", kind: "bolts", tools: ["allen"] }, () => {
    b.add(ring, [0, -RINGY + 20, 0]);
    b.then(0.2);
    const r = at(RINGY) * Math.SQRT2 + LEGD / 2;
    b.fits(SPACER, corners.map(([sx, sz], i): FitOpts => {
      const u: Vec3 = [sx / Math.SQRT2, 0, sz / Math.SQRT2];
      return { on: legs[i], at: [u[0] * r, RINGY, u[2] * r], dir: [-u[0], 0, -u[2]], mate: ring };
    }), 0.08);
  });
  step({ title: "Tighten the four bolts in the plate", detail: "Now that the ring holds the legs square, turn them until the spring washers are flat.", kind: "general", tools: ["allen"] });
  step({ title: "Turn the legs over onto the seat", detail: "Lay the seat upside down on the rug and set the plate on the swivel, the holes lined up. A bolt with a spring washer and a washer in each corner.", pose: "-y", kind: "bolts", tools: ["allen"], warnings: ["floor"] }, () => {
    b.add(seat, [0, 0, 600]);
    b.then(0.2);
    bolted(b, BOLT, [SPRING, W], diag(160).map(([x, z]): FitOpts => ({ on: plate, at: [x, PLATE, z], dir: [0, 1, 0], mate: seat })));
  });
  step({ title: "Stand the stool up", detail: "Turn the seat to check it swivels freely.", pose: "+y", kind: "standup" });
  void s;
  return true;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const slug = s.slug ?? "";
  if (/chair-armrests/.test(slug)) return chair(b, s);
  if (/bar-stool/.test(slug)) return barStool(b, s);
  if (/sun-lounger/.test(slug)) return lounger(b, s);
  if (/coffee-table/.test(slug)) return table(b, s, { railH: 50, stripsX: 1, stripsC: 1, seq: [{ lay: 1, clips: "both" }, { lay: 1, clips: "both" }, { lay: 3, clips: "both" }, { lay: 2 }, { lay: 1 }, { clips: "last" }] });
  if (/segeron-table-outdoor/.test(slug))
    return table(b, s, {
      railH: 60,
      stripsX: 2,
      stripsC: 2,
      seq: [{ lay: 1 }, { clips: "a" }, { clips: "b" }, { lay: 3 }, { clips: "both" }, { lay: 3 }, { clips: "both" }, { lay: 3 }, { clips: "both" }, { lay: 3 }, { clips: "both" }, { lay: 3 }, { clips: "both" }, { lay: 1 }, { clips: "last" }],
    });
  return sections(b, s);
}

const family: Family = { names: ["SEGERÖN"], build };
export default family;
