import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * VITTSKÄR, from IKEA's manuals: outdoor furniture in plastic rattan.
 * A seat section is four woven panels built upside down on a rug: two side panels get corner brackets, then the two
 * leg rails (the legs come fixed in them) are bolted on one corner at a time, the bracket bolts are tightened and
 * then the corner bolts. A backrest (one per seat, also used as an armrest on a side) needs two slotted brackets
 * slipped in behind the corner bolts while the frame is still upside down; it gets two hooks, is lowered onto the
 * frame and bolted up from below with the section tipped over. The woven seat panel goes in last (the 2-seat's has
 * a brace to swing across first). Sections stand side by side and are joined with U-brackets underneath.
 * The chair is built lying on its side; the tables are built upside down on their top.
 */

const S0 = 130, S1 = 360, PH = S1 - S0; // the frame panels, floor to rim
const T = 50; // panel thickness
const CELL = 800;
const BH = 790, BT = 90; // backrest top and thickness
const SEAT = 480; // top of a seat cushion

const BOLT: HwDef = { kind: "bolt", len: 20, dia: 6 };
const WASH: HwDef = { kind: "washer", len: 1.5, dia: 18 };
const CORNER: HwDef = { kind: "angle", len: 40, dia: 30 };
const BRACKET: HwDef = { kind: "angle", len: 70, dia: 30 };
const HOOK: HwDef = { kind: "hook", len: 70, dia: 30 };
const UBRACKET: HwDef = { kind: "connector", len: 110, dia: 30 };

const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const times = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

type Side = "back" | "front" | "left" | "right";
interface Sec {
  n: 1 | 2; // seats
  x0: number; // back left corner of the frame, mm
  z0: number;
  yaw?: 1; // turned a quarter: its length runs back to front (a chaise longue, the wing of a corner sofa)
}
interface Rest {
  s: number; // section it stands on
  side: Side;
  cell?: number; // which 80 cm of that side, from the back or the left
  arm?: boolean; // used as an armrest: no back cushion in front of it
}
interface Layout {
  secs: Sec[];
  rests: Rest[];
}

const back = (s: number, cell = 0): Rest => ({ s, side: "back", cell });

/** How the product is put together from sections and backrests, read from its name and IKEA's photo. */
function layout(s: ProductSpec): Layout | null {
  const slug = s.slug ?? "";
  const one = (x0: number, z0 = 0): Sec => ({ n: 1, x0, z0 });
  const two = (x0: number, z0 = 0, yaw?: 1): Sec => ({ n: 2, x0, z0, yaw });
  if (/1-seat-section/.test(slug)) return { secs: [one(0)], rests: [] };
  if (/2-seat-section/.test(slug)) return { secs: [two(0)], rests: [] };
  if (/modular-easy-chair/.test(slug)) return { secs: [one(0)], rests: [back(0)] };
  if (/modular-chaise-longue/.test(slug)) return { secs: [two(0, 0, 1)], rests: [back(0)] };
  if (/2-seat-sofa$/.test(slug)) return { secs: [two(0)], rests: [back(0), back(0, 1)] };
  if (/2-seat-modular-sofa/.test(slug))
    return { secs: [one(0), one(CELL)], rests: [back(0), back(1), { s: 0, side: "left", arm: true }, { s: 1, side: "right", arm: true }] };
  if (/3-seat-modular-sofa/.test(slug)) return { secs: [one(0), one(CELL), one(2 * CELL)], rests: [back(0), back(1), back(2)] };
  if (/3-seat-sofa$/.test(slug)) return { secs: [two(0), one(2 * CELL)], rests: [back(0), back(0, 1), back(1)] };
  if (/3-seat-sofa-chaise-longue/.test(slug))
    return {
      secs: [two(0), two(2 * CELL, 0, 1)],
      rests: [back(0), back(0, 1), back(1), { s: 0, side: "left", arm: true }, { s: 1, side: "right", cell: 0, arm: true }],
    };
  // the corners: the corner seat is backed on two sides, the wing runs forward on the left with its backrests on its
  // outer side
  if (/3-seat-modular-corner/.test(slug))
    return {
      secs: [two(0, 0, 1), two(CELL)],
      rests: [back(0), { s: 0, side: "left", cell: 0 }, { s: 0, side: "left", cell: 1 }, back(1), back(1, 1), { s: 1, side: "right", arm: true }],
    };
  if (/4-seat-modular-corner/.test(slug))
    return {
      secs: [one(0), two(CELL), two(0, CELL, 1)],
      rests: [
        back(0),
        { s: 0, side: "left" },
        back(1),
        back(1, 1),
        { s: 2, side: "left", cell: 0 },
        { s: 2, side: "left", cell: 1 },
        { s: 2, side: "front", arm: true },
        { s: 1, side: "right", arm: true },
      ],
    };
  if (/5-seat-modular-corner/.test(slug))
    return {
      secs: [one(0), two(CELL), two(3 * CELL, 0, 1), two(0, CELL, 1)],
      rests: [
        back(0),
        { s: 0, side: "left" },
        back(1),
        back(1, 1),
        back(2),
        { s: 3, side: "left", cell: 0 },
        { s: 3, side: "left", cell: 1 },
        { s: 3, side: "front", arm: true },
        { s: 2, side: "right", cell: 0, arm: true },
      ],
    };
  return null;
}

interface Mod {
  sec: Sec;
  n: number;
  w: number; // along its own x
  ox: number;
  oz: number;
  yaw: 0 | 1;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  A: [string, string]; // leg rails, its own back and front
  B: [string, string]; // side panels, its own left and right
  seat: string;
  keys: string[];
  ex: Vec3; // where it stands in the frames scene, from its place in the sofa
}
interface RestRec {
  r: Rest;
  m: Mod;
  key: string;
  c: Vec3; // middle of its 80 cm on the frame's outer face, at the floor
  n: Vec3; // out of the frame
  t: Vec3; // along it
  on: string; // the frame panel it stands against
}

const W = (m: Mod, v: Vec3): Vec3 => (m.yaw ? [m.ox + v[2], v[1], m.oz - v[0]] : [m.ox + v[0], v[1], m.oz + v[2]]);
const Wd = (m: Mod, d: Vec3): Vec3 => (m.yaw ? [d[2], d[1], -d[0]] : d);

function sofa(b: PlanBuilder, s: ProductSpec, lay: Layout): boolean {
  const cushions = s.size.h >= 85; // the sets sold with FRÖSÖN/DUVHOLMEN cushions are 88 cm to the back cushions

  // centre the whole sofa, backrests included
  const rect = (q: Sec) => {
    const lx = q.yaw ? CELL : CELL * q.n, lz = q.yaw ? CELL * q.n : CELL;
    return { x0: q.x0, x1: q.x0 + lx, z0: q.z0, z1: q.z0 + lz };
  };
  let lo: Vec3 = [Infinity, 0, Infinity], hi: Vec3 = [-Infinity, 0, -Infinity];
  for (const q of lay.secs) {
    const r = rect(q);
    lo = [Math.min(lo[0], r.x0), 0, Math.min(lo[2], r.z0)];
    hi = [Math.max(hi[0], r.x1), 0, Math.max(hi[2], r.z1)];
  }
  for (const r of lay.rests) {
    const q = rect(lay.secs[r.s]);
    if (r.side === "back") lo[2] = Math.min(lo[2], q.z0 - BT);
    if (r.side === "front") hi[2] = Math.max(hi[2], q.z1 + BT);
    if (r.side === "left") lo[0] = Math.min(lo[0], q.x0 - BT);
    if (r.side === "right") hi[0] = Math.max(hi[0], q.x1 + BT);
  }
  const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;

  const types = new Map<string, string>();
  const typeOf = (id: string, make: () => string) => {
    if (!types.has(id)) types.set(id, make());
    return types.get(id)!;
  };
  const railOf = (w: number) =>
    typeOf(`rail${w}`, () => {
      // the front rail as drawn: legs inside its two ends
      const pcs: PartPiece[] = [{ shape: "box", size: [w, PH, T], pos: [0, (S0 + S1) / 2, 0] }];
      for (const sx of [-1, 1]) pcs.push({ shape: "cyl", size: [40, 310, 40], pos: [sx * (w / 2 - 70), 155, -T / 2 - 20], material: "metal" });
      const c = b.compound("Leg rail", pcs);
      railMid.set(w, c.mid);
      return c.type;
    });
  const railMid = new Map<number, Vec3>();
  const sideT = b.part("Side panel", [T, PH, CELL - 2 * T]);
  const seatOf = (n: number, w: number) =>
    typeOf(`seat${n}`, () => {
      if (n === 1) return b.part("Seat panel", [w - 2 * T, 30, CELL - 2 * T]);
      const c = b.compound("Seat panel", [
        { shape: "box", size: [w - 2 * T, 30, CELL - 2 * T], pos: [0, 15, 0] },
        { shape: "box", size: [40, 30, CELL - 2 * T - 10], pos: [0, -15, 0] },
      ]);
      return c.type;
    });
  const restT = b.part("Backrest", [CELL, BH - S0, BT]);

  // the sections
  const mods: Mod[] = lay.secs.map((q) => {
    const r = rect(q);
    const x0 = r.x0 - cx, x1 = r.x1 - cx, z0 = r.z0 - cz, z1 = r.z1 - cz;
    const w = CELL * q.n;
    const m: Mod = { sec: q, n: q.n, w, ox: (x0 + x1) / 2, oz: (z0 + z1) / 2, yaw: q.yaw ?? 0, x0, x1, z0, z1, A: ["", ""], B: ["", ""], seat: "", keys: [], ex: [0, 0, 0] };
    const yaw = m.yaw ? Math.PI / 2 : 0;
    const rail = railOf(w);
    const mid = railMid.get(w)!;
    const zr = CELL / 2 - T / 2;
    m.A[1] = b.place(rail, W(m, [mid[0], mid[1], zr + mid[2]]), [0, yaw, 0]);
    m.A[0] = b.place(rail, W(m, [-mid[0], mid[1], -zr - mid[2]]), [0, yaw + Math.PI, 0]);
    m.B[0] = b.place(sideT, W(m, [-w / 2 + T / 2, (S0 + S1) / 2, 0]), [0, yaw, 0]);
    m.B[1] = b.place(sideT, W(m, [w / 2 - T / 2, (S0 + S1) / 2, 0]), [0, yaw, 0]);
    m.seat = b.place(seatOf(q.n, w), W(m, [0, q.n === 1 ? 330 : 315, 0]), [0, yaw, 0]);
    m.keys = [m.A[0], m.A[1], m.B[0], m.B[1], m.seat];
    return m;
  });
  const multi = mods.length > 1;
  for (const m of mods) m.ex = multi ? [m.ox * 0.8, 0, m.oz * 0.8] : [0, 0, 0];

  // the frame panel along each side of the sofa, as the section is turned
  const panelOn = (m: Mod, side: Side) => {
    if (!m.yaw) return side === "back" ? m.A[0] : side === "front" ? m.A[1] : side === "left" ? m.B[0] : m.B[1];
    return side === "left" ? m.A[0] : side === "right" ? m.A[1] : side === "back" ? m.B[1] : m.B[0];
  };

  // the backrests
  const rests: RestRec[] = lay.rests.map((r) => {
    const m = mods[r.s];
    const k = r.cell ?? 0;
    let c: Vec3, n: Vec3, t: Vec3;
    if (r.side === "back" || r.side === "front") {
      const z = r.side === "back" ? m.z0 : m.z1;
      c = [m.x0 + CELL * k + CELL / 2, 0, z];
      n = [0, 0, r.side === "back" ? -1 : 1];
      t = [1, 0, 0];
    } else {
      const x = r.side === "left" ? m.x0 : m.x1;
      c = [x, 0, m.z0 + CELL * k + CELL / 2];
      n = [r.side === "left" ? -1 : 1, 0, 0];
      t = [0, 0, 1];
    }
    const across = r.side === "left" || r.side === "right";
    const key = b.place(restT, plus(plus(c, times(n, BT / 2)), [0, (S0 + BH) / 2, 0]), [0, across ? Math.PI / 2 : 0, 0]);
    m.keys.push(key);
    return { r, m, key, c, n, t, on: panelOn(m, r.side) };
  });
  const restsOf = (m: Mod) => rests.filter((x) => x.m === m);

  // cushions: one seat cushion on every 80 cm, set in from each side with a back cushion in front of its backrest
  const seatCush: string[] = [], backCush: string[] = [];
  if (cushions) {
    const soft = (name: string, size: Vec3) => typeOf(`${name}${size.join("x")}`, () => b.part(name, size, { material: "soft" }));
    const CT = 150;
    for (const m of mods) {
      for (let i = 0; i < m.n; i++) {
        let cx0 = m.yaw ? m.x0 : m.x0 + CELL * i, cz0 = m.yaw ? m.z0 + CELL * i : m.z0;
        let cx1 = cx0 + CELL, cz1 = cz0 + CELL;
        const covers = (x: RestRec) => {
          if (x.r.arm) return false;
          const k = x.r.cell ?? 0;
          if (x.r.side === "back") return m.yaw ? i === 0 : k === i;
          if (x.r.side === "front") return m.yaw ? i === m.n - 1 : k === i;
          return m.yaw ? k === i : x.r.side === "left" ? i === 0 : i === m.n - 1;
        };
        const mine = restsOf(m).filter(covers);
        const sides = new Set(mine.map((x) => x.r.side));
        if (sides.has("back")) cz0 += CT;
        if (sides.has("front")) cz1 -= CT;
        if (sides.has("left")) cx0 += CT;
        if (sides.has("right")) cx1 -= CT;
        const size: Vec3 = [cx1 - cx0 - 10, SEAT - S1, cz1 - cz0 - 10];
        seatCush.push(b.place(soft("Seat cushion", size), [(cx0 + cx1) / 2, (S1 + SEAT) / 2, (cz0 + cz1) / 2]));
        for (const x of mine) {
          // a back cushion on a side leaves the corner to the one along the back
          const short = (x.r.side === "left" || x.r.side === "right") && sides.has("back") ? 1 : 0;
          const len = CELL - 10 - short * CT;
          const along = short ? CT / 2 : 0;
          const p = plus(plus(x.c, times(x.n, -CT / 2)), plus(times(x.t, along), [0, (SEAT + 880) / 2, 0]));
          const across = x.r.side === "left" || x.r.side === "right";
          backCush.push(b.place(soft("Back cushion", across ? [CT, 880 - SEAT, len] : [len, 880 - SEAT, CT]), p));
        }
      }
    }
  }

  const F = multi ? "frames" : "main";
  const step = (o: { title: string; detail?: string; scene?: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] }, body: () => void = () => {}) =>
    b.step({ kind: "general", ...o, scene: o.scene ?? F, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  // in the frames scene every section stands apart; a part can also wait somewhere (`at`) before it goes in
  const show = (m: Mod, key: string, at?: Vec3, from?: Vec3, rot?: Vec3) => {
    const it = b.partItem(key);
    if (!multi && !at) b.add(key, from);
    else b.stage(key, plus(at ?? it.final.pos, m.ex), rot ?? it.final.rot, from);
  };
  const fit = (def: HwDef, list: FitOpts[], gap = 0.06) => list.length && b.fits(def, list, gap);
  const at = (m: Mod, lp: Vec3, d: Vec3, on: string, mate?: string, hole?: false): FitOpts => ({ on, at: W(m, lp), dir: Wd(m, d), mate, hole });

  // the corners of a frame: the bracket bolt into the side panel, the bracket bolt into the rail, the corner bolt
  const brB = (m: Mod, sx: number, sz: number): Vec3 => [sx * (m.w / 2 - T / 2), S0, sz * (CELL / 2 - T - 40)];
  const brA = (m: Mod, sx: number, sz: number): Vec3 => [sx * (m.w / 2 - 90), S0, sz * (CELL / 2 - T / 2)];
  const cornerBolt = (m: Mod, sx: number, sz: number): FitOpts => at(m, [sx * (m.w / 2 - T / 2), S0 + 120, sz * (CELL / 2)], [0, 0, -sz], m.A[sz < 0 ? 0 : 1], m.B[sx < 0 ? 0 : 1]);
  const railBolt = (m: Mod, sx: number, sz: number) => at(m, brA(m, sx, sz), [0, 1, 0], m.A[sz < 0 ? 0 : 1]);
  const both = (def: HwDef, list: FitOpts[]) => {
    fit(def, list);
    b.then(0.05);
    fit(WASH, list.map((o) => ({ ...o, hole: false as const, mate: undefined })));
  };
  const each = (f: (m: Mod) => FitOpts[]) => mods.flatMap(f);
  const N = mods.length > 1;
  const upside: Pose = "-y";

  /* ---------- the frames, upside down ---------- */
  step({ title: N ? "Bolt the corner brackets onto the side panels" : "Bolt the corner brackets onto both side panels", detail: "Upside down on a rug. Two brackets on each side panel, one bolt and washer in each, tightened by hand for now.", pose: upside, kind: "bolts", tools: ["allen"], warnings: ["floor", "hand"] }, () => {
    b.stagger(0.2);
    for (const m of mods) {
      show(m, m.B[0], undefined, [0, -260, 0]);
      show(m, m.B[1], plus(b.partItem(m.B[1]).final.pos, Wd(m, [-m.w / 2, 0, CELL / 2 + 200])), [0, -260, 0]);
    }
    b.then(0.15);
    const pts = each((m) => [-1, 1].flatMap((sx) => [-1, 1].map((sz) => at(m, brB(m, sx, sz), [0, 1, 0], m.B[sx < 0 ? 0 : 1], undefined, false))));
    fit(CORNER, pts, 0.08);
    b.then(0.1);
    both(BOLT, pts.map((o) => ({ ...o, hole: undefined })));
  });
  step({ title: N ? "Bolt a leg rail to one side panel of each frame" : "Bolt a leg rail to one side panel", detail: "Legs pointing up. One bolt with a washer through the end of the rail, by hand.", pose: upside, kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    for (const m of mods) show(m, m.A[0], undefined, Wd(m, [0, 0, -320]));
    b.then(0.15);
    both(BOLT, each((m) => [cornerBolt(m, -1, -1)]));
  });
  step({ title: "Bolt the bracket to the leg rail", detail: "One bolt and washer down through the bracket into the rail.", pose: upside, kind: "bolts", tools: ["allen"] }, () => {
    both(BOLT, each((m) => [railBolt(m, -1, -1)]));
  });
  step({ title: "Bolt the other side panel to the same rail", detail: "Its brackets face in, like the first one's.", pose: upside, kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    for (const m of mods) show(m, m.B[1]);
    b.then(0.15);
    both(BOLT, each((m) => [cornerBolt(m, 1, -1)]));
  });
  step({ title: "Bolt its bracket to the rail too", pose: upside, kind: "bolts", tools: ["allen"] }, () => {
    both(BOLT, each((m) => [railBolt(m, 1, -1)]));
  });
  step({ title: N ? "Bolt on the second leg rails" : "Bolt on the second leg rail", detail: "Across the open ends of the side panels, one bolt and washer at each corner.", pose: upside, kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    for (const m of mods) show(m, m.A[1], undefined, Wd(m, [0, 0, 320]));
    b.then(0.15);
    both(BOLT, each((m) => [cornerBolt(m, -1, 1), cornerBolt(m, 1, 1)]));
  });
  step({ title: "Bolt both brackets to the second rail", pose: upside, kind: "bolts", tools: ["allen"] }, () => {
    both(BOLT, each((m) => [railBolt(m, -1, 1), railBolt(m, 1, 1)]));
  });
  step({ title: "Press the corners flush and tighten the bracket bolts", detail: "Push each corner together so the panels meet without a step, then tighten the eight bolts in the brackets.", pose: upside, kind: "bolts", tools: ["allen"], warnings: ["square"] });

  const sectionsOnly = !rests.length;
  if (!sectionsOnly) {
    step({ title: rests.length > 1 ? "Slip the backrest brackets in" : "Slip the backrest brackets in at the back", detail: "Where a backrest goes, loosen the corner bolts there, slide a slotted bracket in behind each washer and tighten again.", pose: upside, kind: "bolts", tools: ["allen"] }, () => {
      fit(BRACKET, rests.flatMap((x) => [-1, 1].map((k) => ({ on: x.on, at: plus(plus(x.c, times(x.t, k * 330)), [0, S0 + 20, 0]), dir: times(x.n, -1), hole: false as const }))), 0.1);
    });
  }
  step({ title: "Tighten the bolts in the corners", detail: "All the bolts through the ends of the leg rails, firmly with the Allen key.", pose: upside, kind: "bolts", tools: ["allen"] });

  /* ---------- the backrests ---------- */
  const lift: Vec3 = [0, 460, 0];
  if (!sectionsOnly) {
    const many = rests.length > 1;
    step({ title: many ? "Bolt two hooks onto each backrest" : "Bolt the two hooks onto the backrest", detail: "Turn the frame over first. The hooks go low on the inner face of the backrest, with the crank key.", pose: "+y", kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
      b.stagger(0.2);
      for (const x of rests) show(x.m, x.key, plus(b.partItem(x.key).final.pos, lift), [0, 300, 0]);
      b.then(0.15);
      const pts = rests.flatMap((x) => [-1, 1].map((k) => ({ on: x.key, at: plus(plus(x.c, times(x.t, k * 250)), [0, S1 - 15, 0]), dir: x.n, hole: false as const })));
      fit(HOOK, pts, 0.1);
      b.then(0.1);
      both(BOLT, pts.map((o) => ({ ...o, hole: undefined })));
    });
    step({ title: many ? "Lower the backrests onto the frames" : "Lower the backrest onto the frame", detail: "Hook it over the top of the rail and let it slide down until it sits on the brackets.", pose: "+y", kind: "join" }, () => {
      b.stagger(0.25);
      for (const x of rests) show(x.m, x.key);
    });
    step({ title: N ? "Tip each section over and bolt the backrests on from below" : "Tip it over and bolt the backrest on from below", detail: "Lay it on its back on a rug, or on its side for an armrest. One bolt and washer up through each bracket into the backrest.", pose: "+z", kind: "bolts", tools: ["allen"], warnings: ["floor"] }, () => {
      both(BOLT, rests.flatMap((x) => [-1, 1].map((k) => ({ on: x.key, at: plus(plus(plus(x.c, times(x.n, BT / 2)), times(x.t, k * 330)), [0, S0, 0]), dir: [0, 1, 0] as Vec3 }))));
    });
  }

  /* ---------- the seat panels ---------- */
  const twos = mods.filter((m) => m.n === 2);
  const raised = (m: Mod) => plus(b.partItem(m.seat).final.pos, lift);
  if (twos.length) {
    step({ title: twos.length > 1 ? "Swing out the brace under each long seat panel" : "Swing out the brace under the seat panel", detail: "With the panel face down, turn the bar in the middle across it and bolt its free end with a bolt and washer.", pose: "+y", kind: "bolts", tools: ["allen"] }, () => {
      for (const m of twos) show(m, m.seat, raised(m), [0, 300, 0], [Math.PI, m.yaw ? Math.PI / 2 : 0, 0]);
      b.then(0.15);
      both(BOLT, twos.map((m) => at(m, [0, 300, CELL / 2 - T - 5], [0, 0, -1], m.seat)));
    });
  }
  step({ title: sectionsOnly ? "Turn the frame over and lay the seat panel in" : N ? "Lay the seat panels in" : "Lay the seat panel in", detail: "Rough side down. It rests inside the rim of the frame.", pose: "+y", kind: sectionsOnly ? "standup" : "join" }, () => {
    b.stagger(0.25);
    for (const m of mods) show(m, m.seat, undefined, m.n === 2 ? undefined : [0, 320, 0]);
  });

  /* ---------- side by side ---------- */
  if (multi) {
    step({ title: "Stand the sections side by side", detail: "Push them tight together, backs in a straight line.", scene: "main", kind: "join", people: 2 }, () => {
      b.stagger(0.08);
      for (const m of mods) for (const k of m.keys) b.add(k, m.ex);
    });
    const ujoins: FitOpts[] = [];
    for (let i = 0; i < mods.length; i++)
      for (let j = 0; j < i; j++) {
        const p = mods[i], q = mods[j];
        const touchX = Math.abs(p.x0 - q.x1) < 1 ? p.x0 : Math.abs(p.x1 - q.x0) < 1 ? p.x1 : null;
        const touchZ = Math.abs(p.z0 - q.z1) < 1 ? p.z0 : Math.abs(p.z1 - q.z0) < 1 ? p.z1 : null;
        if (touchX !== null) {
          const a = Math.max(p.z0, q.z0), e = Math.min(p.z1, q.z1);
          if (e - a > 100) for (const f of [0.25, 0.75]) ujoins.push({ on: panelOn(p, touchX === p.x0 ? "left" : "right"), at: [touchX, S0, a + (e - a) * f], dir: [0, 1, 0], hole: false });
        } else if (touchZ !== null) {
          const a = Math.max(p.x0, q.x0), e = Math.min(p.x1, q.x1);
          if (e - a > 100) for (const f of [0.25, 0.75]) ujoins.push({ on: panelOn(p, touchZ === p.z0 ? "back" : "front"), at: [a + (e - a) * f, S0, touchZ], dir: [0, 1, 0], hole: false });
        }
      }
    step({ title: "Join the sections with the U-brackets underneath", detail: "At each join, loosen the bolts nearest it, push a bracket up over them from below and tighten again. Two brackets per join.", scene: "main", kind: "join", tools: ["allen"] }, () => {
      fit(UBRACKET, ujoins, 0.15);
    });
  }

  /* ---------- cushions ---------- */
  if (seatCush.length) {
    step({ title: seatCush.length > 1 ? "Lay the seat cushions on" : "Lay the seat cushion on", detail: "Zips facing the back.", scene: "main", kind: "cushions" }, () => {
      b.stagger(0.15);
      for (const k of seatCush) b.add(k, [0, 300, 0]);
    });
    step({ title: backCush.length > 1 ? "Stand the back cushions against the backrests" : "Stand the back cushion against the backrest", scene: "main", kind: "cushions" }, () => {
      b.stagger(0.15);
      for (const k of backCush) b.add(k, [0, 160, 300]);
    });
  }
  return true;
}

/* ---------- the chair with armrests: built lying on its side ---------- */

function chair(b: PlanBuilder, s: ProductSpec): boolean {
  const w = s.size.w * 10, h = s.size.h * 10;
  const st = 45; // side thickness
  const xi = w / 2 - st; // inner face of a side
  const side = b.compound("Side frame", [
    { shape: "box", size: [st, 330, 600], pos: [0, 485, -10] },
    { shape: "cyl", size: [30, 325, 30], pos: [0, 162.5, -280], material: "metal" },
    { shape: "cyl", size: [30, 325, 30], pos: [0, 162.5, 260], material: "metal" },
  ]);
  const L = b.place(side.type, [-w / 2 + st / 2, side.mid[1], side.mid[2]]);
  const R = b.place(side.type, [w / 2 - st / 2, side.mid[1], side.mid[2]]);
  const back = b.place(b.part("Backrest", [2 * xi, h - 300, 50]), [0, (300 + h) / 2, -285]);
  const front = b.place(b.part("Front panel", [2 * xi, 150, 40]), [0, 375, 270]);
  const seat = b.place(b.part("Seat", [2 * xi, 40, 510]), [0, 430, -5]);
  const bolt: HwDef = { kind: "bolt", len: 16, dia: 6 };
  const pts = (x: number, on: string, list: [number, number][]): FitOpts[] => list.map(([y, z]) => ({ on, at: [x, y, z], dir: [Math.sign(x), 0, 0] }));
  const both = (list: FitOpts[]) => {
    b.fits(bolt, list, 0.1);
    b.then(0.05);
    b.fits(WASH, list.map((o) => ({ ...o, hole: false as const })), 0.06);
  };
  const up: Vec3 = [320, 0, 0]; // lying on its left side, up is the chair's right
  b.step({ title: "Lay one side down and push the backrest on", detail: "On a rug, legs pointing away from you. The peg under the backrest goes into the hole in the side.", pose: "+x", kind: "join", tools: [], warnings: ["floor"] }, () => {
    b.add(L, up);
    b.then(0.15);
    b.add(back, up);
  });
  b.step({ title: "Bolt the backrest to the side", detail: "Two bolts and washers through the bracket, by hand for now.", pose: "+x", kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    both(pts(-xi, L, [[400, -285], [600, -285]]));
  });
  b.step({ title: "Push the front panel on and bolt it", detail: "Its peg goes into the side too. Two bolts and washers, by hand.", pose: "+x", kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    b.add(front, up);
    b.then(0.15);
    both(pts(-xi, L, [[340, 270], [410, 270]]));
  });
  b.step({ title: "Lower the other side on top", detail: "Guide its peg into the hole in the backrest.", pose: "+x", kind: "join", tools: [] }, () => b.add(R, up));
  b.step({ title: "Bolt the second side on", detail: "Four bolts and washers: two into the backrest, two into the front panel.", pose: "+x", kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    both(pts(xi, R, [[400, -285], [600, -285], [340, 270], [410, 270]]));
  });
  b.step({ title: "Stand it up and tighten all eight bolts", detail: "On a flat floor, press down on the arms so all four legs touch, then tighten every bolt.", kind: "bolts", tools: ["allen"], warnings: ["square"] }, () => {});
  b.step({ title: "Lay the seat in", kind: "join", tools: [] }, () => b.add(seat, [0, 300, 0]));
  return true;
}

/* ---------- the round table: four top quarters face down, four leg panels slid into their tracks ---------- */

/**
 * From the round table's manual: the four quarters of the top are laid face down and pushed together into halves and
 * then a whole, the four leg panels slide into the tracks under the seams, a cross connector is screwed over their
 * free ends, each panel is bolted to the top's brackets, four braces go in between the panels' outer ends, all 20
 * fittings are tightened, and two people turn it over and level the feet.
 */
function roundTable(s: ProductSpec): CustomParams {
  const R = (s.size.w * 10) / 2 || 935, H = s.size.h * 10 || 740;
  const TT = 40, ty = H - TT / 2, under = H - TT;
  const PT = 30, arm = Math.round(R * 0.62); // the leg panels, from the middle out
  const RH = 40, ry = under - RH / 2; // the brackets under the top, beside each panel
  const arc = (sx: number, sz: number): [number, number][] => {
    const h = R / 2;
    const pts: [number, number][] = [[-sx * h, -sz * h]];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * (Math.PI / 2);
      pts.push([sx * R * Math.cos(a) - sx * h, sz * R * Math.sin(a) - sz * h]);
    }
    return pts;
  };
  const quads: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  // the panels lie along the seams: +x, -x, +z, -z
  const dirs: Vec3[] = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
  const mid = (PT / 2 + arm) / 2, len = arm - PT / 2;
  const panelAt = (d: Vec3): Vec3 => [d[0] * mid, (H - TT) / 2, d[2] * mid];
  const panelSize = (d: Vec3): Vec3 => (d[0] ? [len, H - TT, PT] : [PT, H - TT, len]);
  // each panel's bracket under the top runs beside it, on its clockwise side
  const side = (d: Vec3): Vec3 => [-d[2], 0, d[0]];
  // the brackets come fixed under the top, one per panel, on the quarter beside it
  const brackets = dirs.map((d) => {
    const sd = side(d), bl = 260, bm = PT / 2 + 40 + bl / 2;
    const pos: Vec3 = [d[0] * bm + sd[0] * (PT / 2 + 15), ry, d[2] * bm + sd[2] * (PT / 2 + 15)];
    return { pos, size: (d[0] ? [bl, RH, 30] : [30, RH, bl]) as Vec3, q: quads.findIndex(([sx, sz]) => Math.sign(pos[0]) === sx && Math.sign(pos[2]) === sz) };
  });
  const parts: CustomPart[] = [
    ...quads.map(([sx, sz], i): CustomPart => {
      const pos: Vec3 = [(sx * R) / 2, ty, (sz * R) / 2];
      const own = brackets.filter((k) => k.q === i).map((k): PartPiece => ({ shape: "box", size: k.size, pos: [k.pos[0] - pos[0], k.pos[1] - ty, k.pos[2] - pos[2]] }));
      return { id: `Q${i}`, name: "Top quarter", size: [R, TT, R], pos, material: "wood", pieces: [{ shape: "slab", size: [R, TT, R], pos: [0, 0, 0], outline: arc(sx, sz) }, ...own] };
    }),
    ...dirs.map((d, i): CustomPart => ({ id: `P${i}`, name: "Leg panel", size: panelSize(d), pos: panelAt(d), material: "wood" })),
    // braces between neighbouring panels' outer ends, on the underside of the top
    ...[[0, 2], [2, 1], [1, 3], [3, 0]].map(([a, b], i): CustomPart => {
      const da = dirs[a], db = dirs[b];
      const r0 = arm - 120;
      const cx = ((da[0] + db[0]) * r0) / 2, cz = ((da[2] + db[2]) * r0) / 2;
      const L = Math.SQRT2 * r0 - 140;
      return { id: `B${i}`, name: "Brace", size: [L, RH, 30], pos: [cx, ry, cz], rot: [0, cx * cz > 0 ? Math.PI / 4 : -Math.PI / 4, 0], material: "metal" };
    }),
  ];
  const panelBolts = dirs.flatMap((d, i): CustomFix[] => {
    const sd = side(d);
    const at = [140, 260].map((r): Vec3 => [d[0] * (PT / 2 + r) - sd[0] * (PT / 2), ry, d[2] * (PT / 2 + r) - sd[2] * (PT / 2)]);
    return [
      { kind: "washer", count: 2, at: at.map((p): Vec3 => [p[0] - sd[0] * 2, p[1], p[2] - sd[2] * 2]), dir: sd, on: `P${i}`, len: 2, dia: 18 },
      { kind: "bolt", count: 2, at, dir: sd, on: `P${i}`, mate: `Q${brackets[i].q}`, len: 55, dia: 6 },
    ];
  });
  const braceBolts: CustomFix[] = parts
    .filter((p) => p.id.startsWith("B"))
    .flatMap((p): CustomFix[] => {
      const a = p.rot![1], h = p.size[0] / 2 - 30;
      const at = [-1, 1].map((g): Vec3 => [p.pos[0] + g * h * Math.cos(a), under - RH, p.pos[2] - g * h * Math.sin(a)]);
      return [
        { kind: "washer", count: 2, at: at.map((q): Vec3 => [q[0], q[1] - 2, q[2]]), dir: [0, 1, 0], on: p.id, len: 2, dia: 18 },
        { kind: "bolt", count: 2, at, dir: [0, 1, 0], on: p.id, len: 55, dia: 6 },
      ];
    });
  return {
    parts,
    steps: [
      {
        title: "Push the top quarters together in pairs",
        detail: "Lay all four face down on a rug, with a helper. Slide each pair together until the pegs at the seam lock.",
        add: ["Q0", "Q1"],
        pose: "-y",
        people: 2,
        warnings: ["floor", "two"],
        from: { Q0: [-300, 0, 0], Q1: [300, 0, 0] },
      },
      {
        title: "Push the two halves together",
        detail: "Join the other pair the same way, then line up the four pegs along the middle seam and press until it closes.",
        add: ["Q2", "Q3"],
        from: { Q2: [0, 0, 400], Q3: [0, 0, 400] },
      },
      {
        title: "Slide the leg panels into their tracks",
        detail: "One at a time, from the rim inwards along a seam, until each panel's end reaches the middle.",
        add: ["P0", "P1", "P2", "P3"],
        from: { P0: [500, 0, 0], P1: [-500, 0, 0], P2: [0, 0, 500], P3: [0, 0, -500] },
      },
      {
        title: "Screw the cross connector on",
        detail: "Over the four panels' free ends in the middle, a screw into each.",
        fix: [
          { kind: "connector", name: "Cross connector", count: 1, at: [[0, 0, 0]], dir: [0, 1, 0], on: "P0", len: 30, dia: 120 },
          { kind: "screw", count: 4, at: dirs.map((d): Vec3 => [d[0] * 60, 0, d[2] * 60]), dir: [0, 1, 0], on: "P0", len: 20, dia: 5 },
        ],
        tools: ["allen"],
      },
      { title: "Bolt the panels to the top's brackets", detail: "Two bolts with washers through each panel, by hand for now.", fix: panelBolts, tools: ["allen"], warnings: ["loose"] },
      { title: "Fit the four braces", detail: "Each goes between two panels' outer ends, flat on the underside of the top. Two bolts with washers in each.", add: ["B0", "B1", "B2", "B3"], fix: braceBolts, tools: ["allen"] },
      { title: "Tighten all the bolts", detail: "All 16 bolts and the 4 connector screws, firmly.", tools: ["allen"] },
      { title: "Turn the table over together", detail: "Lift it by the edge of the top with a helper, not by one leg panel.", pose: "+y", people: 2, warnings: ["two"] },
      { title: "Level the feet", detail: "Turn the foot under each panel until the table stands steady." },
    ],
  };
}

/* ---------- the tables: the base first, then upside down on the top ---------- */

function slats(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, n: number, gap = 8): PartPiece[] {
  const wz = (z1 - z0 - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ shape: "box" as const, size: [x1 - x0, y1 - y0, wz] as Vec3, pos: [(x0 + x1) / 2, (y0 + y1) / 2, z0 + i * (wz + gap) + wz / 2] as Vec3, material: "wood" as const }));
}

function coffee(b: PlanBuilder, s: ProductSpec): boolean {
  const L = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const top = b.compound("Table top", slats(-L / 2, L / 2, -D / 2, D / 2, H - 30, H, 10), { material: "wood" });
  const topK = b.place(top.type, top.mid);
  const px = L / 2 - 110, pt = 40, yt = H - 30;
  const panel = b.part("End panel", [pt, yt, D - 80]);
  const ends = [-1, 1].map((sx) => b.place(panel, [sx * px, yt / 2, 0]));
  const inner = px - pt / 2;
  const rail = b.place(b.part("Bottom rail", [2 * inner, 80, 40]), [0, 60, 0]);
  const shelf = b.place(b.part("Shelf", [2 * inner, 30, D - 140]), [0, 225, 0]);
  const long: HwDef = { kind: "bolt", len: 60, dia: 6 };
  const short: HwDef = { kind: "bolt", len: 16, dia: 6 };
  const through = (y: number, z: number, mate: string) => [-1, 1].map((sx, i) => ({ on: ends[i], at: [sx * (px + pt / 2), y, z] as Vec3, dir: [-sx, 0, 0] as Vec3, mate }));
  const both = (def: HwDef, list: FitOpts[]) => {
    b.fits(def, list, 0.08);
    b.then(0.05);
    b.fits(WASH, list.map((o) => ({ ...o, hole: false as const, mate: undefined })), 0.05);
  };
  const stage = (k: string, from?: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, it.final.pos, it.final.rot, from);
  };
  b.step({ title: "Bolt the bottom rail between the end panels", detail: "Two long bolts and washers through each panel into the rail, tightened by hand for now.", scene: "base", kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    b.stagger(0.25);
    stage(ends[0], [-300, 0, 0]);
    stage(rail, [0, 200, 0]);
    stage(ends[1], [300, 0, 0]);
    b.then(0.15);
    both(long, [...through(40, 0, rail), ...through(80, 0, rail)]);
  });
  b.step({ title: "Lower the shelf in and bolt it", detail: "Two long bolts and washers at each end.", scene: "base", kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    stage(shelf, [0, 300, 0]);
    b.then(0.15);
    both(long, [...through(225, -150, shelf), ...through(225, 150, shelf)]);
  });
  b.step({ title: "Turn the base over onto the top and bolt it on", detail: "Lay the top face down on a rug. One short bolt and washer through each bracket into the top.", pose: "-y", kind: "bolts", tools: ["allen"], warnings: ["floor"] }, () => {
    b.add(topK, [0, 200, 0]);
    b.then(0.2);
    b.stagger(0.05);
    for (const k of [...ends, rail, shelf]) b.add(k, [0, -360, 0]);
    b.then(0.2);
    both(short, [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ on: topK, at: [sx * (inner - 30), yt, sz * (D / 2 - 120)] as Vec3, dir: [0, 1, 0] as Vec3 }))));
  });
  b.step({ title: "Tighten all twelve bolts", detail: "The eight in the ends and the four into the top, firmly with the Allen key.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {});
  b.step({ title: "Turn the table over and level it", detail: "Turn the feet under the end panels until it stands steady.", kind: "standup", tools: [] }, () => {});
  return true;
}

function dining(b: PlanBuilder, s: ProductSpec): boolean {
  const L = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const yt = H - 30, half = L / 2;
  const px = half - 420, pt = 50, inner = px - pt / 2;
  const bz = 250, rz = bz - 20 - 12.5;
  // one half of the top, as the right half: slats along its length and two battens underneath
  const hp = slats(0, half, -D / 2, D / 2, yt, H, 12);
  for (const z of [-bz, bz]) hp.push({ shape: "box", size: [inner - 20, 60, 40], pos: [15 + (inner - 20) / 2, yt - 30, z], material: "wood" });
  const topHalf = b.compound("Table top half", hp, { material: "wood" });
  const left = b.place(topHalf.type, [-topHalf.mid[0], topHalf.mid[1], -topHalf.mid[2]], [0, Math.PI, 0]);
  const right = b.place(topHalf.type, topHalf.mid);
  const panel = b.part("End panel", [pt, yt, D - 160]);
  const ends = [-1, 1].map((sx) => b.place(panel, [sx * px, yt / 2, 0]));
  const railT = b.part("Rail", [2 * inner, 110, 25]);
  const rails = [-1, 1].map((sz) => b.place(railT, [0, yt - 55, sz * rz]));
  const long: HwDef = { kind: "bolt", len: 90, dia: 6 };
  const mid: HwDef = { kind: "bolt", len: 60, dia: 6 };
  const both = (def: HwDef, list: FitOpts[]) => {
    b.fits(def, list, 0.06);
    b.then(0.05);
    b.fits(WASH, list.map((o) => ({ ...o, hole: false as const, mate: undefined })), 0.04);
  };
  const stage = (k: string, from?: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, it.final.pos, it.final.rot, from);
  };
  b.step({ title: "Bolt the two rails between the end panels", detail: "Two long bolts and washers through each panel into each rail end, by hand for now.", scene: "base", kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    b.stagger(0.25);
    stage(ends[0], [-300, 0, 0]);
    stage(ends[1], [300, 0, 0]);
    for (const k of rails) stage(k, [0, 250, 0]);
    b.then(0.15);
    both(long, [-1, 1].flatMap((sx, i) => [-1, 1].flatMap((sz, j) => [yt - 80, yt - 30].map((y) => ({ on: ends[i], at: [sx * (px + pt / 2), y, sz * rz] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: rails[j] })))));
  });
  b.step({ title: "Lay the top halves face down and join them", detail: "On a rug. Push the two dowels into one half, then slide the other half onto them.", pose: "-y", kind: "dowels", tools: [], people: 2, warnings: ["two", "floor"] }, () => {
    b.add(left, [0, 200, 0]);
    b.then(0.15);
    b.fits({ kind: "dowel", len: 40, dia: 10 }, [-1, 1].map((sz) => ({ on: left, at: [0, H - 15, sz * 300] as Vec3, dir: [-1, 0, 0] as Vec3, mate: right })), 0.15);
    b.then(0.15);
    b.add(right, [400, 0, 0]);
  });
  b.step({ title: "Turn the base over onto the top", detail: "Line the holes in the rails up with the ones in the battens.", pose: "-y", kind: "join", tools: [], people: 2, warnings: ["two"] }, () => {
    b.stagger(0.05);
    for (const k of [...ends, ...rails]) b.add(k, [0, -380, 0]);
  });
  b.step({ title: "Bolt the rails to the top", detail: "Four bolts and washers through each rail into the battens.", pose: "-y", kind: "bolts", tools: ["allen"], warnings: ["hand"] }, () => {
    both(mid, [-1, 1].flatMap((sz, j) => [-600, -200, 200, 600].map((x) => ({ on: rails[j], at: [x, yt - 30, sz * (rz - 12.5)] as Vec3, dir: [0, 0, sz] as Vec3, mate: x < 0 ? left : right }))));
  });
  b.step({ title: "Tighten all sixteen bolts", detail: "The eight in the end panels and the eight in the rails, firmly with the Allen key.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {});
  b.step({ title: "Turn the table over together", detail: "Lift it by the end panels, not the top.", kind: "standup", tools: [], people: 2, warnings: ["two"] }, () => {});
  return true;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const slug = s.slug ?? "";
  if (/chair-armrests/.test(slug)) return chair(b, s);
  if (/coffee-table/.test(slug)) return coffee(b, s);
  if (slug === "vittskar-table-187") {
    buildCustom(b, { ...s, custom: roundTable(s) });
    return true;
  }
  if (/vittskar-table/.test(slug)) return dining(b, s);
  const lay = layout(s);
  return lay ? sofa(b, s, lay) : false;
}

const family: Family = { names: ["VITTSKÄR"], build };
export default family;
