import type { Family } from "./family";
import type { Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";

/**
 * SÖDERHAMN, from IKEA's manuals. Every module is its own frame on four tall legs: a sprung seat frame with a thin
 * backrest panel bolted to its back on studs, with a washer and nut on each from inside the frame, done with the
 * frame tipped onto its back. A chaise longue is built the same way, lying on its side. The corner section has a back
 * panel and a side panel; its cover goes on before the back panel. Each cover zips over the seat padding and is
 * pulled down over the frame. An armrest is a thin padded panel that hangs on the end of a section on four studs, through
 * holes made in the cover. Modules are joined with the sofa on its back: the legs where two frames meet are unscrewed
 * and screwed back in through a connecting plate bolted under both frames; a corner section also has U brackets the
 * sections hook onto and two bolts under each join. The 3-seat sofa-bed section is the same kind of frame with a
 * fold-out bed bolted inside it; its backrest goes on eight studs with bolt heads, and an armrest on it hangs on four
 * long studs held by bolt heads from inside.
 */

type Kind = "seat" | "chaise" | "corner" | "arm" | "bed";
type Cell = number | "chaise" | "arm" | "bed";
interface Rec {
  key: string;
  lp: Vec3; // where it sits in the module's own frame (for a leg that moves onto a plate: where it is first screwed in)
  moved?: boolean;
}
interface Mod {
  kind: Kind;
  w: number;
  ox: number;
  oz: number;
  yaw: 0 | 1; // 1: turned a quarter, its front facing +x (the wing coming forward from a corner)
  recs: Rec[]; // what is carried with the module once it's built (frame, panels, legs, seat padding)
  legs: Rec[];
  pads: Rec[];
  backs: string[];
  k: Record<string, string>;
  legLp: Vec3[];
}
interface Joint {
  kind: "arm" | "plate" | "corner";
  a: Mod; // the section (or the left module of two)
  b: Mod; // the armrest, the corner or the module to the right
  s: 1 | -1; // which end of a, in a's own frame
}

const D = 990, Z0 = -495, BT = 100, LEG = 140, FT = 170, BH = 690, PAD = 90, AW = 60, AH = 640;
const CW = 930, CL = 1510, K = 990;
const FTOP = LEG + FT; // top of the seat frame
const CTOP = 830; // top of the back cushions
const LZB = Z0 + BT + 40, LZF = D / 2 - 40; // where the legs go, back and front

const STUD: HwDef = { kind: "stud", len: 90, dia: 8 };
const CSTUD: HwDef = { kind: "stud", len: 80, dia: 8 };
const ASTUD: HwDef = { kind: "stud", len: 110, dia: 8 };
const WASH: HwDef = { kind: "washer", len: 2, dia: 20 };
const NUT: HwDef = { kind: "nut", len: 7, dia: 8 };
const BOLT: HwDef = { kind: "bolt", len: 40, dia: 8, name: "Hex bolt" };
const PLATE: HwDef = { kind: "plate", len: 200, dia: 40, name: "Connecting plate" };
const LPLATE: HwDef = { kind: "plate", len: 240, dia: 40, name: "Corner plate" };
const UBR: HwDef = { kind: "hook", len: 60, dia: 40, name: "U bracket" };
const CSL: HwDef = { kind: "bolt", len: 90, dia: 6, name: "Countersunk bolt" };
const CSS: HwDef = { kind: "bolt", len: 50, dia: 6, name: "Countersunk bolt" };
// the sofa-bed section's own fittings
const BW = 2140; // 319 cm = 6 + 214 + 93 + 6
const BSTUD: HwDef = { kind: "stud", len: 70, dia: 8 };
const LSTUD: HwDef = { kind: "stud", len: 150, dia: 8 };
const BHEAD: HwDef = { kind: "bolt", len: 14, dia: 8, name: "Bolt head" };
const MBOLT: HwDef = { kind: "bolt", len: 30, dia: 8 };
const LBOLT: HwDef = { kind: "bolt", len: 45, dia: 8 };
const SBOLT: HwDef = { kind: "bolt", len: 20, dia: 8 };

const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const W = (m: Mod, v: Vec3): Vec3 => (m.yaw ? [m.ox + v[2], v[1], m.oz - v[0]] : [m.ox + v[0], v[1], m.oz + v[2]]);
const Wd = (m: Mod, d: Vec3): Vec3 => (m.yaw ? [d[2], d[1], -d[0]] : d);
const rotOf = (m: Mod): Vec3 => [0, m.yaw ? Math.PI / 2 : 0, 0];
// where a module sits in another one's frame (they share a yaw when they are joined)
const rel = (m: Mod, a: Mod): Vec3 => {
  const dx = m.ox - a.ox, dz = m.oz - a.oz;
  return a.yaw ? [-dz, 0, dx] : [dx, 0, dz];
};

interface Layout {
  row?: Cell[];
  corner?: boolean;
  back?: Cell[];
  wing?: Cell[];
}
const S1 = 930, S3 = 1860;

/** What the product is made of; null for a product these manuals don't cover. */
function layout(s: ProductSpec): Layout | null {
  switch (s.slug) {
    case "soderhamn-1-seat-section": return { row: [S1] };
    case "soderhamn-3-seat-section": return { row: [S3] };
    case "soderhamn-corner-section": return { corner: true, back: [], wing: [] };
    case "soderhamn-3-seat-sofa": return { row: ["arm", S3, "arm"] };
    case "soderhamn-armchair": return { row: ["arm", S1, "arm"] }; // the 1-seat section with an armrest each side
    case "soderhamn-2-seat-sofa": return { row: [S1, "chaise"] }; // the 2-seat sofa with chaise longue
    case "soderhamn-4-seat-sofa-chaise-longue": return { row: ["arm", S3, "chaise"] };
    case "soderhamn-corner-sofa-4-seat": return { corner: true, back: [S3, "arm"], wing: [S1] };
    case "soderhamn-sectional-5-seat": return { corner: true, back: [S3, "arm"], wing: [S3, "arm"] };
    case "soderhamn-4-seat-sofa-bed": return { row: ["arm", "bed", "chaise", "arm"] };
    // 319 cm along the back (corner, sofa-bed, armrest) and 291 down the side (corner, 3-seat section, armrest)
    case "soderhamn-corner-sofa-bed-6-seat": return { corner: true, back: ["bed", "arm"], wing: [S3, "arm"] };
  }
  return null;
}

type StepOpts = { title: string; detail?: string; scene?: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] };

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const lay = layout(s);
  if (!lay) return false;

  /* ---------- where the modules go ---------- */
  const mods: Mod[] = [];
  const joints: Joint[] = [];
  const mod = (kind: Kind, w: number, ox: number, oz: number, yaw: 0 | 1): Mod => {
    const m: Mod = { kind, w, ox, oz, yaw, recs: [], legs: [], pads: [], backs: [], k: {}, legLp: [] };
    mods.push(m);
    return m;
  };
  const widthOf = (x: Cell) => (x === "arm" ? AW : x === "chaise" ? CW : x === "bed" ? BW : x);
  const chain = (list: Cell[], start: number, yaw: 0 | 1, first?: Mod) => {
    let c = start;
    let prev = first;
    for (const x of list) {
      const w = widthOf(x);
      const kind: Kind = x === "arm" ? "arm" : x === "chaise" ? "chaise" : x === "bed" ? "bed" : "seat";
      const m = yaw ? mod(kind, w, 0, c + w / 2, 1) : mod(kind, w, c + w / 2, 0, 0);
      c += w;
      if (prev) {
        const out: 1 | -1 = yaw ? -1 : 1; // which side of the earlier module the new one is on, in its own frame
        const back = (-out) as 1 | -1;
        if (prev.kind === "corner") joints.push({ kind: "corner", a: m, b: prev, s: back });
        else if (kind === "arm") joints.push({ kind: "arm", a: prev, b: m, s: out });
        else if (prev.kind === "arm") joints.push({ kind: "arm", a: m, b: prev, s: back });
        else joints.push({ kind: "plate", a: prev, b: m, s: out });
      }
      prev = m;
    }
  };
  let corner: Mod | undefined;
  if (lay.corner) {
    corner = mod("corner", K, 0, 0, 0);
    chain(lay.back ?? [], K / 2, 0, corner);
    chain(lay.wing ?? [], K / 2, 1, corner);
  } else {
    const row = lay.row ?? [];
    chain(row, -row.reduce<number>((t, x) => t + widthOf(x), 0) / 2, 0);
  }
  // centre the whole sofa on the origin
  {
    const xs: number[] = [], zs: number[] = [];
    for (const m of mods) {
      for (const v of [W(m, [-m.w / 2, 0, Z0]), W(m, [m.w / 2, 0, m.kind === "chaise" ? Z0 + CL : -Z0])]) {
        xs.push(v[0]);
        zs.push(v[2]);
      }
    }
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    for (const m of mods) {
      m.ox -= cx;
      m.oz -= cz;
    }
  }

  /* ---------- the parts ---------- */
  const types = new Map<string, string>();
  const typeOf = (name: string, size: Vec3, o: { material?: "soft" | "metal" | "board"; shape?: "cyl" } = {}) => {
    const id = `${name}|${size.map(Math.round).join("x")}`;
    if (!types.has(id)) types.set(id, b.part(name, size, { material: o.material ?? "soft", shape: o.shape }));
    return types.get(id)!;
  };
  const legT = typeOf("Leg", [32, LEG, 32], { material: "metal", shape: "cyl" });
  const put = (m: Mod, ref: string, lp: Vec3, list: Rec[] = m.recs) => {
    const key = b.place(ref, W(m, lp), rotOf(m));
    const r = { key, lp };
    list.push(r);
    if (list !== m.recs) m.recs.push(r);
    return key;
  };
  const cushion = (m: Mod, name: string, size: Vec3, lp: Vec3) => m.backs.push(b.place(typeOf(name, size), W(m, lp), rotOf(m)));
  const backPair = (m: Mod, x: number, cw: number, z = Z0 + BT) => {
    cushion(m, "Back cushion", [cw - 20, CTOP - FTOP - PAD, 200], [x, (FTOP + PAD + CTOP) / 2, z + 100]);
    cushion(m, "Small cushion", [Math.round(cw * 0.55), 280, 130], [x, FTOP + PAD + 150, z + 270]);
  };
  for (const m of mods) {
    const y = LEG + FT / 2, by = (LEG + BH) / 2;
    if (m.kind === "seat") {
      const n = m.w > 1200 ? 2 : 1, cw = m.w / n;
      m.k.frame = put(m, typeOf("Seat frame", [m.w, FT, D - BT]), [0, y, Z0 + BT + (D - BT) / 2]);
      m.k.back = put(m, typeOf("Backrest", [m.w, BH - LEG, BT]), [0, by, Z0 + BT / 2]);
      for (let i = 0; i < n; i++) put(m, typeOf("Seat cushion", [cw - 6, PAD, D - BT + 10]), [-m.w / 2 + cw * (i + 0.5), FTOP + PAD / 2, Z0 + BT + (D - BT + 10) / 2], m.pads);
      for (let i = 0; i < n; i++) backPair(m, -m.w / 2 + cw * (i + 0.5), cw);
      for (const z of [LZB, LZF]) for (const x of [-1, 1]) m.legLp.push([x * (m.w / 2 - 40), LEG / 2, z]);
    } else if (m.kind === "bed") {
      // folded: the frame (a ring of rails), the bed mechanism and its board inside it, two seat cushions on top
      const fd = D - BT, fz = Z0 + BT + fd / 2;
      const fr = b.compound("Sofa-bed frame", [
        { shape: "box", size: [m.w, FT, 60], pos: [0, y, Z0 + BT + 30] },
        { shape: "box", size: [m.w, FT, 60], pos: [0, y, -Z0 - 30] },
        ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [60, FT, fd - 120] as Vec3, pos: [sx * (m.w / 2 - 30), y, fz] as Vec3 })),
      ], { material: "soft" });
      m.k.frame = put(m, fr.type, fr.mid);
      m.k.back = put(m, typeOf("Backrest", [m.w, BH - LEG, BT]), [0, by, Z0 + BT / 2]);
      m.k.mech = put(m, typeOf("Bed mechanism", [m.w - 140, 110, fd - 140], { material: "metal" }), [0, FTOP - 75, fz]);
      m.k.board = put(m, typeOf("Bed board", [m.w - 140, 20, fd - 140], { material: "board" }), [0, FTOP - 10, fz]);
      const cw = m.w / 2;
      for (let i = 0; i < 2; i++) put(m, typeOf("Seat cushion", [cw - 6, PAD, D - BT + 10]), [-m.w / 2 + cw * (i + 0.5), FTOP + PAD / 2, Z0 + BT + (D - BT + 10) / 2], m.pads);
      for (let i = 0; i < 2; i++) backPair(m, -m.w / 2 + cw * (i + 0.5), cw);
      for (const z of [LZB, LZF]) for (const x of [-1, 1]) m.legLp.push([x * (m.w / 2 - 40), LEG / 2, z]);
    } else if (m.kind === "chaise") {
      const L = CL - BT;
      m.k.frame = put(m, typeOf("Chaise longue frame", [CW, FT, L]), [0, y, Z0 + BT + L / 2]);
      m.k.back = put(m, typeOf("Backrest", [CW, BH - LEG, BT]), [0, by, Z0 + BT / 2]);
      const pl = (L + 10) / 2;
      for (let i = 0; i < 2; i++) put(m, typeOf("Seat cushion", [CW - 6, PAD, pl - 4]), [0, FTOP + PAD / 2, Z0 + BT + pl * (i + 0.5)], m.pads);
      backPair(m, 0, CW);
      for (const z of [LZB, Z0 + CL - 40]) for (const x of [-1, 1]) m.legLp.push([x * (CW / 2 - 40), LEG / 2, z]);
    } else if (m.kind === "corner") {
      const fw = K - BT, fc = Z0 + BT + fw / 2;
      m.k.frame = put(m, typeOf("Corner seat frame", [fw, FT, fw]), [fc, y, fc]);
      m.k.side = put(m, typeOf("Side panel", [BT, BH - LEG, fw]), [Z0 + BT / 2, by, fc]);
      m.k.back = put(m, typeOf("Back panel", [K, BH - LEG, BT]), [0, by, Z0 + BT / 2]);
      put(m, typeOf("Corner seat cushion", [fw + 4, PAD, fw + 4]), [fc + 7, FTOP + PAD / 2, fc + 7], m.pads);
      const bx = Z0 + BT + 200, bw = K / 2 - bx;
      cushion(m, "Back cushion", [bw - 10, CTOP - FTOP - PAD, 200], [bx + bw / 2, (FTOP + PAD + CTOP) / 2, Z0 + BT + 100]);
      cushion(m, "Back cushion", [200, CTOP - FTOP - PAD, fw - 10], [Z0 + BT + 100, (FTOP + PAD + CTOP) / 2, fc]);
      cushion(m, "Small cushion", [400, 280, 130], [bx + bw / 2, FTOP + PAD + 150, Z0 + BT + 270]);
      for (const z of [LZB, K / 2 - 40]) for (const x of [LZB, K / 2 - 40]) m.legLp.push([x, LEG / 2, z]);
    } else {
      m.k.body = put(m, typeOf("Armrest", [AW, AH - LEG, D]), [0, (LEG + AH) / 2, 0]);
    }
  }

  /* ---------- the plates under the joins, and the legs that move onto them ---------- */
  interface Plate { c: Vec3; def: HwDef; hosts: { m: Mod; d: Vec3 }[]; legs: Rec[] }
  const plates: Plate[] = [];
  for (const j of joints) {
    if (j.kind !== "plate") continue;
    for (const z of [LZB, LZF]) plates.push({ c: W(j.a, [j.s * (j.a.w / 2), 0, z]), def: PLATE, hosts: [{ m: j.a, d: Wd(j.a, [-j.s, 0, 0]) }, { m: j.b, d: Wd(j.a, [j.s, 0, 0]) }], legs: [] });
  }
  const cj = joints.filter((j) => j.kind === "corner");
  const backJ = cj.find((j) => !j.a.yaw), wingJ = cj.find((j) => j.a.yaw);
  if (corner) {
    const c = corner, r = Math.SQRT1_2;
    if (backJ) plates.push({ c: W(c, [K / 2, 0, LZB]), def: PLATE, hosts: [{ m: c, d: [-1, 0, 0] }, { m: backJ.a, d: [1, 0, 0] }], legs: [] });
    if (backJ && wingJ) plates.push({ c: W(c, [K / 2, 0, K / 2]), def: LPLATE, hosts: [{ m: c, d: [-r, 0, -r] }, { m: backJ.a, d: [1, 0, 0] }, { m: wingJ.a, d: [0, 0, 1] }], legs: [] });
    if (wingJ) plates.push({ c: W(c, [LZB, 0, K / 2]), def: PLATE, hosts: [{ m: c, d: [0, 0, -1] }, { m: wingJ.a, d: [0, 0, 1] }], legs: [] });
  }
  for (const m of mods) {
    for (const lp of m.legLp) {
      const home = W(m, lp);
      const p = plates.find((q) => Math.hypot(q.c[0] - home[0], q.c[2] - home[2]) < 90);
      const key = b.place(legT, p ? [p.c[0], LEG / 2, p.c[2]] : home);
      const r: Rec = { key, lp, moved: !!p };
      m.legs.push(r);
      m.recs.push(r);
      p?.legs.push(r);
    }
  }

  /* ---------- steps ---------- */
  const step = (o: StepOpts, body: () => void = () => {}) =>
    b.step({ kind: "general", ...o, scene: o.scene ?? "main", warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  const fit = (def: HwDef, list: FitOpts[], gap = 0.08) => b.fits(def, list, gap);
  const at = (m: Mod, lp: Vec3, d: Vec3, on: string, mate?: string, hole?: false): FitOpts => ({ on, at: W(m, lp), dir: Wd(m, d), mate, hole });
  const pl = (n: number, one: string, many: string) => (n > 1 ? many : one);

  // each module is built in a scene of its own when there are several; a lone module is built where it stands
  const seats = mods.filter((m) => m.kind === "seat");
  const chaise = mods.find((m) => m.kind === "chaise");
  const arms = mods.filter((m) => m.kind === "arm");
  const alone = mods.length - arms.length === 1;
  const sceneOf = (m: Mod) => (alone ? "main" : m.kind === "seat" ? "sections" : m.kind);
  const bed = mods.find((m) => m.kind === "bed");
  const stageOff = new Map<Mod, Vec3>();
  const stageRef = new Map<Mod, Mod>();
  const place = (list: Mod[], gap = 2 * AW + 400) => {
    const widths = list.map((m) => m.w + gap);
    const total = widths.reduce((a, w) => a + w, 0);
    let x = 0;
    list.forEach((m, i) => {
      stageOff.set(m, [-total / 2 + x + widths[i] / 2, 0, 0]);
      x += widths[i];
    });
  };
  const offOf = (m: Mod) => {
    const ref = stageRef.get(m) ?? m;
    return plus(stageOff.get(ref) ?? [0, 0, 0], ref === m ? [0, 0, 0] : rel(m, ref));
  };
  // a part shown where it belongs in this scene, or moved off by `away` (in the module's own frame)
  const show = (scene: string, m: Mod, r: Rec, o: { from?: Vec3; away?: Vec3; rot?: Vec3; spin?: number } = {}) => {
    if (scene === "main") {
      if (o.away || r.moved) b.stage(r.key, plus(W(m, r.lp), Wd(m, o.away ?? [0, 0, 0])), rotOf(m), o.from && Wd(m, o.from));
      else b.add(r.key, o.from && Wd(m, o.from), { spin: o.spin });
    } else b.stage(r.key, plus(plus(offOf(m), r.lp), o.away ?? [0, 0, 0]), o.rot ?? [0, 0, 0], o.from);
  };
  const rec = (m: Mod, key: string) => m.recs.find((r) => r.key === key)!;
  const many = (list: Mod[]) => list.length > 1;

  /* the covers: the same on every frame */
  const covers = (list: Mod[], sc: string) => {
    const two = many(list);
    const pads = list.flatMap((m) => m.pads.map((r) => ({ m, r })));
    step({ title: two ? "Zip the seat covers over the padding" : "Zip the seat cover over the padding", detail: "Lay each seat cushion on the frame and zip its part of the cover closed around it. The zips face the back.", scene: sc, kind: "cushions" }, () => {
      b.stagger(0.2);
      for (const { m, r } of pads) show(sc, m, r, { from: [0, 300, 0] });
    });
    step({ title: two ? "Pull the covers over the backrests" : "Pull the cover over the backrest", detail: "Turn the back part of the cover right side out and work it down evenly over the backrest, seams on the edges.", scene: sc });
    step({ title: two ? "Fasten the covers under the frames" : "Fasten the cover under the frame", detail: "Pull the cover down over the front and sides, fold the corners neatly and press the hook strips along the underside.", scene: sc });
  };

  /* ---------- the seat sections ---------- */
  if (seats.length) {
    const sc = sceneOf(seats[0]);
    if (sc !== "main") place(seats);
    const two = many(seats);
    const studX = (m: Mod) => {
      const n = m.w > 1200 ? 8 : 4;
      return Array.from({ length: n }, (_, i) => -m.w / 2 + 80 + ((m.w - 160) * i) / (n - 1));
    };
    step({ title: two ? "Screw the legs into the seat frames" : "Screw the legs into the seat frame", detail: "Stand the frame on its back edge. Four legs, clockwise by hand until snug.", scene: sc, pose: "+z", kind: "legs", warnings: ["hand", "floor"] }, () => {
      for (const m of seats) show(sc, m, rec(m, m.k.frame), { away: [0, 0, -BT], from: [0, 0, 200] });
      b.then(0.1);
      b.stagger(0.2);
      for (const m of seats) for (const l of m.legs) show(sc, m, l, { away: [0, 0, -BT], from: [0, -220, 0] });
    });
    step({ title: two ? "Screw the studs into the backrests" : "Screw the studs into the backrest", detail: "Lay the backrest flat, padded side down. The studs go into the holes along its lower edge, by hand.", scene: sc, pose: "+z", kind: "bolts", warnings: ["hand"] }, () => {
      // the frame is held up while the backrest is laid under it
      for (const m of seats) for (const r of [rec(m, m.k.frame), ...m.legs]) show(sc, m, r, { away: [0, 0, 450] });
      for (const m of seats) show(sc, m, rec(m, m.k.back), { from: [0, 0, -200] });
      b.then(0.15);
      for (const m of seats) fit(STUD, studX(m).map((x) => ({ ...at(m, [x, LEG + FT / 2, Z0 + BT], [0, 0, -1], m.k.back, m.k.frame), travel: 120, spin: 3 })));
    });
    step({ title: two ? "Lower the frames onto the studs" : "Lower the frame onto the studs", detail: "One of you at each end. Guide every stud through its hole, then put a washer and a nut on each one by hand.", scene: sc, pose: "+z", kind: "join", people: 2 }, () => {
      b.stagger(0.05);
      for (const m of seats) {
        show(sc, m, rec(m, m.k.frame));
        for (const l of m.legs) show(sc, m, l);
      }
      b.then(0.15);
      for (const m of seats) fit(WASH, studX(m).map((x) => ({ ...at(m, [x, LEG + FT / 2, Z0 + BT + 40], [0, 0, -1], m.k.frame), hole: false as const })), 0.04);
      b.then(0.05);
      for (const m of seats) fit(NUT, studX(m).map((x) => ({ ...at(m, [x, LEG + FT / 2, Z0 + BT + 44], [0, 0, -1], m.k.frame), hole: false as const })), 0.05);
    });
    step({ title: "Tighten the nuts with the box spanner", detail: "Work along the row and tighten each one firmly.", scene: sc, pose: "+z", kind: "bolts", tools: ["wrench"] });
    step({ title: two ? "Stand the sections up" : "Stand the section up", detail: two ? "Tip each one forward onto its legs." : "Tip it forward onto its legs.", scene: sc, kind: "standup", people: seats.some((m) => m.w > 1200) ? 2 : 1 });
    covers(seats, sc);
  }

  /* ---------- the 3-seat sofa-bed section ---------- */
  if (bed) {
    const m = bed, sc = sceneOf(m);
    if (sc !== "main") place([m]);
    const sx = Array.from({ length: 8 }, (_, i) => -m.w / 2 + 100 + ((m.w - 200) * i) / 7);
    const yb = LEG + FT / 2;
    step({ title: "Pull the cover over the sofa-bed frame", detail: "Take the caps off the corners first and throw them away. Work the cover on evenly, then turn the frame over and press the hook strips along the underside.", scene: sc }, () => show(sc, m, rec(m, m.k.frame), { from: [0, 200, 0] }));
    step({ title: "Pull the cover over the backrest", detail: "One of you at each end. Work it down evenly from the top and fasten it along the lower edge.", scene: sc, people: 2 }, () => show(sc, m, rec(m, m.k.back), { away: [0, 0, -700], from: [0, 300, 0] }));
    step({ title: "Zip the covers onto the two seat cushions", detail: "Smooth side up, as the label shows. Fold each cushion to get it in, then close the zip.", scene: sc, kind: "cushions" });
    step({ title: "Screw eight studs into the back of the frame", detail: "Tip the frame onto its back edge. Into the holes along its back rail, by hand until they stop.", scene: sc, pose: "+z", kind: "bolts", warnings: ["hand"] }, () => {
      fit(BSTUD, sx.map((x) => ({ ...at(m, [x, yb, Z0 + BT - 35], [0, 0, 1], m.k.frame, m.k.back), travel: 100, spin: 3 })), 0.06);
    });
    step({ title: "Lower the backrest onto the studs", detail: "One of you at each end. Guide every stud through its hole in the backrest.", scene: sc, pose: "+z", kind: "join", people: 2 }, () => show(sc, m, rec(m, m.k.back), { from: [0, 0, -400] }));
    step({ title: "Screw a bolt head onto each stud", detail: "From inside the backrest, tight with the Allen key.", scene: sc, pose: "+z", kind: "bolts", tools: ["allen"] }, () => {
      fit(BHEAD, sx.map((x) => ({ ...at(m, [x, yb, Z0 + 20], [0, 0, 1], m.k.back), hole: false as const })), 0.06);
    });
    step({ title: "Screw in the four legs", detail: "Clockwise by hand until each one is snug.", scene: sc, pose: "+z", kind: "legs", warnings: ["hand"] }, () => {
      b.stagger(0.2);
      for (const l of m.legs) show(sc, m, l, { from: [0, -220, 0], spin: 2 });
    });
    const mx = (m.w - 140) / 2;
    step({ title: "Stand it up and bolt the bed into the frame", detail: "Together, lift the folded bed in. One bolt at the back and one at the front on each side, with the Allen key.", scene: sc, kind: "bolts", people: 2, tools: ["allen"] }, () => {
      show(sc, m, rec(m, m.k.mech), { from: [0, 300, 0] });
      b.then(0.15);
      fit(MBOLT, [-1, 1].flatMap((d) => [Z0 + BT + 120, -Z0 - 120].map((z) => at(m, [d * (m.w / 2 - 60), FTOP - 60, z], [-d, 0, 0], m.k.frame, m.k.mech))), 0.1);
    });
    step({ title: "Cut the ties and unfold the bed", detail: "Together: lift the front, pull the bed out and let the legs swing down to the floor.", scene: sc, people: 2 });
    step({ title: "Bolt the folding frame together", detail: "Two bolts on each side where the parts hinge, then four along the front, all with the Allen key.", scene: sc, kind: "bolts", tools: ["allen"] }, () => {
      fit(MBOLT, [-1, 1].flatMap((d) => [-100, 120].map((z) => at(m, [d * mx, FTOP - 40, z], [-d, 0, 0], m.k.mech))), 0.08);
      b.then(0.1);
      fit(MBOLT, [-3, -1, 1, 3].map((i) => at(m, [(i * m.w) / 8, FTOP - 30, -Z0 - 90], [0, 0, -1], m.k.mech)), 0.08);
    });
    step({ title: "Lay the board on the bed and screw it down", detail: "Cut the ties first. The board goes rough side up; four bolts with the Allen key.", scene: sc, kind: "screws", people: 2, tools: ["allen"] }, () => {
      show(sc, m, rec(m, m.k.board), { from: [0, 300, 0] });
      b.then(0.15);
      fit(LBOLT, [-1, 1].flatMap((d) => [-150, 250].map((z) => at(m, [d * (mx - 60), FTOP, z], [0, -1, 0], m.k.board, m.k.mech))), 0.08);
    });
    step({ title: "Knock the clips into place", detail: "Tap each clip with the hammer until it clicks onto the rail.", scene: sc, tools: ["hammer"] });
    step({ title: "Lay the seat cushions on the bed", detail: "Fasten the corners of each one to the bed, all four.", scene: sc, kind: "cushions" }, () => {
      b.stagger(0.2);
      for (const r of m.pads) show(sc, m, r, { from: [0, 300, 0] });
    });
    step({ title: "Fold the bed in and fit the two stop bolts", detail: "Pull the strap to fold it back into the frame, then one bolt on each side with the Allen key.", scene: sc, kind: "bolts", tools: ["allen"] }, () => {
      fit(MBOLT, [-1, 1].map((d) => at(m, [d * (m.w / 2 - 60), FTOP - 100, 0], [-d, 0, 0], m.k.frame, m.k.mech)), 0.15);
    });
    step({ title: "Tip it onto its front and bolt the hinges", detail: "Together. Two bolts with a nut on each side, then stand it up again.", scene: sc, pose: "-z", kind: "bolts", people: 2, tools: ["allen", "wrench"], warnings: ["two", "floor"] }, () => {
      const hp = [-1, 1].flatMap((d) => [Z0 + BT + 60, Z0 + BT + 140].map((z) => [d * (m.w / 2 - 60), LEG + 40, z] as Vec3));
      fit(SBOLT, hp.map((q) => at(m, q, [-Math.sign(q[0]), 0, 0], m.k.frame, m.k.mech)), 0.08);
      b.then(0.05);
      fit(NUT, hp.map((q) => ({ ...at(m, [q[0] - Math.sign(q[0]) * 40, q[1], q[2]], [Math.sign(q[0]), 0, 0], m.k.mech), hole: false as const })), 0.08);
    });
  }

  /* ---------- the chaise longue ---------- */
  if (chaise) {
    const c = chaise, sc = sceneOf(c);
    if (sc !== "main") place([c]);
    const sx = [-300, -100, 100, 300];
    step({ title: "Screw the legs into the chaise frame", detail: "Stand the frame on its long side. Four legs, clockwise by hand until snug.", scene: sc, pose: "+x", kind: "legs", warnings: ["hand", "floor"] }, () => {
      show(sc, c, rec(c, c.k.frame), { from: [0, 200, 0] });
      b.then(0.1);
      b.stagger(0.2);
      for (const l of c.legs) show(sc, c, l, { from: [0, -220, 0], spin: 2 });
    });
    step({ title: "Screw four studs into the backrest", detail: "Into the holes along its lower edge, by hand.", scene: sc, pose: "+x", kind: "bolts", warnings: ["hand"] }, () => {
      show(sc, c, rec(c, c.k.back), { away: [0, 0, -500], from: [0, 200, 0] });
      b.then(0.15);
      fit(STUD, sx.map((x) => ({ ...at(c, [x, LEG + FT / 2, Z0 + BT], [0, 0, -1], c.k.back, c.k.frame), travel: 120, spin: 3 })));
    });
    step({ title: "Push the backrest onto the end of the frame", detail: "Guide the studs through the holes, then put a washer and a nut on each one by hand.", scene: sc, pose: "+x", kind: "join" }, () => {
      show(sc, c, rec(c, c.k.back));
      b.then(0.15);
      fit(WASH, sx.map((x) => ({ ...at(c, [x, LEG + FT / 2, Z0 + BT + 40], [0, 0, -1], c.k.frame), hole: false as const })), 0.04);
      b.then(0.05);
      fit(NUT, sx.map((x) => ({ ...at(c, [x, LEG + FT / 2, Z0 + BT + 44], [0, 0, -1], c.k.frame), hole: false as const })), 0.05);
    });
    step({ title: "Tighten the nuts with the box spanner", detail: "All four, firmly.", scene: sc, pose: "+x", kind: "bolts", tools: ["wrench"] });
    step({ title: "Stand the chaise longue up", scene: sc, kind: "standup" });
    covers([c], sc);
  }

  /* ---------- the corner section ---------- */
  if (corner) {
    const c = corner, sc = sceneOf(c);
    if (sc !== "main") place([c]);
    const fc = Z0 + BT + (K - BT) / 2;
    const side: Vec3[] = [-250, -50, 150, 350].map((z) => [Z0 + BT, LEG + FT / 2, z]);
    const backS: Vec3[] = [-200, 0, 200, 400].map((x) => [x, LEG + FT / 2, Z0 + BT]);
    step({ title: "Screw the legs into the corner frame", detail: "Stand the frame on its back edge. Four legs, clockwise by hand until snug.", scene: sc, pose: "+z", kind: "legs", warnings: ["hand", "floor"] }, () => {
      show(sc, c, rec(c, c.k.frame), { from: [0, 0, 200] });
      b.then(0.1);
      b.stagger(0.2);
      for (const l of c.legs) show(sc, c, l, { from: [0, -220, 0], spin: 2 });
    });
    step({ title: "Screw four studs into the side panel", detail: "The longer studs. Into the holes along its lower edge, by hand.", scene: sc, pose: "+z", kind: "bolts", warnings: ["hand"] }, () => {
      show(sc, c, rec(c, c.k.side), { away: [-500, 0, 0], from: [0, 200, 0] });
      b.then(0.15);
      fit(ASTUD, side.map((p) => ({ ...at(c, p, [-1, 0, 0], c.k.side, c.k.frame), travel: 120, spin: 3 })));
    });
    step({ title: "Push the side panel onto the frame", detail: "Guide the studs through the holes in the side of the frame, put on a washer and a nut each, then tighten them with the box spanner.", scene: sc, pose: "+z", kind: "join", tools: ["wrench"] }, () => {
      show(sc, c, rec(c, c.k.side));
      b.then(0.15);
      fit(WASH, side.map((p) => ({ ...at(c, [p[0] + 40, p[1], p[2]], [-1, 0, 0], c.k.frame), hole: false as const })), 0.04);
      fit(NUT, side.map((p) => ({ ...at(c, [p[0] + 44, p[1], p[2]], [-1, 0, 0], c.k.frame), hole: false as const })), 0.05);
    });
    step({ title: "Stand the corner section up", scene: sc, kind: "standup" });
    step({ title: "Zip the seat cover over the padding", detail: "Lay the seat cushion on the frame and zip its part of the cover closed around it.", scene: sc, kind: "cushions" }, () => {
      for (const r of c.pads) show(sc, c, r, { from: [0, 300, 0] });
    });
    step({ title: "Pull the cover over the side panel and the frame", detail: "Work it down over the side panel, then over the front and the open side, and press the hook strips along the underside.", scene: sc });
    step({ title: "Pull its own cover over the back panel", detail: "Work it down evenly from the top and fasten it along the lower edge, leaving the stud holes clear.", scene: sc }, () => {
      show(sc, c, rec(c, c.k.back), { away: [0, 0, -700], from: [0, 300, 0] });
    });
    step({ title: "Screw four studs into the back panel", detail: "The shorter studs, by hand until they stop.", scene: sc, kind: "bolts", warnings: ["hand"] }, () => {
      fit(CSTUD, backS.map((p) => ({ ...at(c, p, [0, 0, -1], c.k.back, c.k.frame), travel: 110, spin: 3 })));
    });
    step({ title: "Tip the corner onto its back and lower it onto the back panel", detail: "One of you each side. Guide the studs through the holes, then put a washer and a nut on each one by hand.", scene: sc, pose: "+z", kind: "join", people: 2 }, () => {
      show(sc, c, rec(c, c.k.back));
      b.then(0.15);
      fit(WASH, backS.map((p) => ({ ...at(c, [p[0], p[1], p[2] + 40], [0, 0, -1], c.k.frame), hole: false as const })), 0.04);
      fit(NUT, backS.map((p) => ({ ...at(c, [p[0], p[1], p[2] + 44], [0, 0, -1], c.k.frame), hole: false as const })), 0.05);
    });
    step({ title: "Tighten all the nuts with the box spanner", detail: "The four on the back panel and the four on the side panel.", scene: sc, pose: "+z", kind: "bolts", tools: ["wrench"] });
    // the U brackets the sections hook onto, on each open side
    const br: { p: Vec3; d: Vec3; on: string; def: HwDef }[] = [];
    if (backJ) br.push({ p: [K / 2, LEG + FT / 2, 200], d: [-1, 0, 0], on: c.k.frame, def: CSS }, { p: [K / 2, 520, Z0 + BT / 2], d: [-1, 0, 0], on: c.k.back, def: CSL });
    if (wingJ) br.push({ p: [-100, LEG + FT / 2, K / 2], d: [0, 0, -1], on: c.k.frame, def: CSS }, { p: [Z0 + BT / 2, 520, K / 2], d: [0, 0, -1], on: c.k.side, def: CSL });
    if (br.length) {
      step({ title: "Make holes in the cover for the brackets", detail: "Feel for the marked holes on each open side and push an awl or a thin screwdriver through the fabric.", scene: sc, pose: "+z", tools: ["screwdriver"] });
      step({ title: "Screw the U brackets onto the open sides", detail: "Two on each side the sections meet: the long bolts go through the panels, the short ones into the frame. With the Allen key.", scene: sc, pose: "+z", kind: "screws", tools: ["allen"] }, () => {
        fit(UBR, br.map((q) => ({ ...at(c, q.p, q.d, q.on), hole: false as const, twist: Math.PI / 2 })), 0.12);
        b.then(0.1);
        for (const q of br) fit(q.def, [at(c, plus(q.p, [q.d[0] * -4, 0, q.d[2] * -4]), q.d, q.on)]);
      });
    }
    step({ title: "Stand the corner section up", scene: sc, kind: "standup" });
  }

  /* ---------- the armrests ---------- */
  const armJ = joints.filter((j) => j.kind === "arm");
  if (armJ.length) {
    place(arms, 700);
    const two = arms.length > 1;
    const sideOf = (a: Mod) => armJ.find((j) => j.b === a)!.s;
    step({ title: two ? "Pull the covers over the armrests" : "Pull the cover over the armrest", detail: "Work it down evenly, then fold it under and press the hook strips along the bottom edge.", scene: "arms" }, () => {
      for (const a of arms) show("arms", a, rec(a, a.k.body), { from: [0, 300, 0] });
    });
    const studs = (j: Joint) => {
      const x = j.s * (j.a.w / 2);
      return [
        { lp: [x, LEG + FT / 2, -250] as Vec3, on: j.a.k.frame },
        { lp: [x, LEG + FT / 2, 300] as Vec3, on: j.a.k.frame },
        { lp: [x, 430, Z0 + BT / 2] as Vec3, on: j.a.k.back },
        { lp: [x, 600, Z0 + BT / 2] as Vec3, on: j.a.k.back },
      ];
    };
    step({ title: two ? "Screw four studs into each armrest" : "Screw four studs into the armrest", detail: "Lay it on its outer side. Into the holes on the inner side, by hand until they stop.", scene: "arms", kind: "bolts", warnings: ["hand"] }, () => {
      for (const a of arms) {
        const r = rec(a, a.k.body);
        b.stage(r.key, plus(offOf(a), [0, AW / 2, 0]), [0, 0, -sideOf(a) * (Math.PI / 2)]);
      }
      b.then(0.15);
      // the sofa-bed's armrest hangs on the longer studs from its own box
      for (const j of armJ) fit(j.a.kind === "bed" ? LSTUD : ASTUD, studs(j).map((q) => ({ ...at(j.a, q.lp, [j.s, 0, 0], j.b.k.body, q.on), travel: 130, spin: 3 })), 0.1);
    });
    for (const sc of [...new Set(armJ.map((j) => sceneOf(j.a)))]) {
      const mine = armJ.filter((j) => sceneOf(j.a) === sc);
      const secs = new Set(mine.map((j) => j.a));
      const both = mine.length > 1;
      const onBed = mine.every((j) => j.a.kind === "bed");
      const hole = secs.size > 1 ? "Make holes in the cover at the end of each section" : both ? "Make holes in the cover at both ends" : "Make holes in the cover at the end of the section";
      step({ title: hole, detail: `Tip ${secs.size > 1 ? "the sections" : "the section"} onto ${secs.size > 1 ? "their backs" : "its back"}. Feel for the four marked holes and push an awl or a thin screwdriver through the fabric.`, scene: sc, pose: "+z", tools: ["screwdriver"], warnings: ["floor"] });
      step({ title: both ? "Push the armrests onto the ends" : "Push the armrest onto the end", detail: onBed ? "Guide the studs through the holes, then screw a bolt head onto each one from inside the frame, tight with the Allen key." : "Guide the studs through the holes, then put a washer and a nut on each one by hand, from inside the frame.", scene: sc, pose: "+z", kind: onBed ? "bolts" : "join", tools: onBed ? ["allen"] : undefined }, () => {
        for (const j of mine) {
          const r = rec(j.b, j.b.k.body);
          if (sc === "main") b.add(r.key, Wd(j.a, [j.s * 350, 0, 0]));
          else {
            stageRef.set(j.b, j.a);
            show(sc, j.b, r, { from: [j.s * 350, 0, 0] });
          }
        }
        b.then(0.15);
        for (const j of mine) {
          if (j.a.kind === "bed") {
            fit(BHEAD, studs(j).map((q) => ({ ...at(j.a, [q.lp[0] - j.s * 70, q.lp[1], q.lp[2]], [j.s, 0, 0], q.on), hole: false as const })), 0.05);
            continue;
          }
          fit(WASH, studs(j).map((q) => ({ ...at(j.a, [q.lp[0] - j.s * 40, q.lp[1], q.lp[2]], [j.s, 0, 0], q.on), hole: false as const })), 0.04);
          fit(NUT, studs(j).map((q) => ({ ...at(j.a, [q.lp[0] - j.s * 44, q.lp[1], q.lp[2]], [j.s, 0, 0], q.on), hole: false as const })), 0.05);
        }
      });
      if (!onBed) step({ title: "Tighten the nuts with the box spanner", detail: both ? "Firmly, so each armrest sits tight against its end." : "Firmly, so the armrest sits tight against the end.", scene: sc, pose: "+z", kind: "bolts", tools: ["wrench"] });
      step({ title: secs.size > 1 ? "Stand the sections up again" : "Stand it up again", scene: sc, kind: "standup" });
    }
  }

  /* ---------- joining the modules ---------- */
  if (!alone) {
    const groupOf = (m: Mod) => [m, ...armJ.filter((j) => j.a === m).map((j) => j.b)];
    const main = mods.filter((m) => m.kind !== "arm");
    step({ title: corner ? "Push the sections onto the corner's brackets" : "Stand the modules side by side", detail: corner ? "Stand the corner where the sofa will go, then push each section against it so the U brackets hook over its frame." : "Where the sofa will go, then push them tight together.", kind: "join", people: 2 }, () => {
      b.stagger(0.04);
      for (const m of main) {
        for (const g of groupOf(m)) for (const r of g.recs) show("main", g, r, { from: [0, 250, 0] });
        b.then(0.15);
      }
    });
    step({ title: "Tip the sofa onto its back", detail: "Lift and tip it together, by the frames, onto a blanket.", pose: "+z", kind: "flip", people: 2, warnings: ["two", "floor"] });
    step({ title: pl(plates.length, "Move the legs at the join onto a connecting plate", "Move the legs at the joins onto the connecting plates"), detail: (cj.length ? "" : "Pull the frames tight together with the clamp first. ") + "Unscrew the legs where two frames meet, bolt a plate across the join with a washer on each bolt, then screw the leg back in through the plate.", pose: "+z", kind: "bolts", tools: ["wrench"] }, () => {
      for (const p of plates) {
        fit(p.def, [{ at: [p.c[0], LEG - 3, p.c[2]], dir: [0, 1, 0], on: p.hosts[0].m.k.frame, hole: false }]);
        b.then(0.05);
        const pts = p.hosts.map((h) => ({ h, q: [p.c[0] + h.d[0] * 70, LEG, p.c[2] + h.d[2] * 70] as Vec3 }));
        fit(WASH, pts.map(({ h, q }) => ({ at: [q[0], q[1] - 6, q[2]] as Vec3, dir: [0, 1, 0] as Vec3, on: h.m.k.frame, hole: false as const })), 0.04);
        fit(BOLT, pts.map(({ h, q }) => ({ at: q, dir: [0, 1, 0] as Vec3, on: h.m.k.frame })), 0.06);
        b.then(0.05);
        b.stagger(0.15);
        for (const l of p.legs) b.add(l.key, [0, -220, 0], { spin: 2 });
        b.then(0.1);
      }
    });
    step({ title: "Stand the sofa up", detail: cj.length ? "Lift it back onto its legs together." : "Lift it back onto its legs together, then take the clamp off.", kind: "standup", people: 2 });
    if (corner && cj.length) {
      const under = (j: Joint) => (j.a.yaw ? [-150, 250].map((x) => [x, LEG, K / 2] as Vec3) : [-150, 250].map((z) => [K / 2, LEG, z] as Vec3));
      step({ title: pl(cj.length, "Bolt the corner join from underneath", "Bolt the corner joins from underneath"), detail: "Pull each join tight with the clamp at the front edge. Lying under the sofa, push two bolts with washers up through each join and tighten the nuts with the box spanner. Then take the clamps off.", kind: "bolts", tools: ["wrench"] }, () => {
        for (const j of cj) {
          const pts = under(j);
          fit(WASH, pts.map((p) => ({ ...at(corner!, [p[0], p[1] - 5, p[2]], [0, 1, 0], corner!.k.frame), hole: false as const })), 0.04);
          fit(BOLT, pts.map((p) => at(corner!, p, [0, 1, 0], corner!.k.frame, j.a.k.frame)), 0.06);
          b.then(0.05);
          fit(WASH, pts.map((p) => ({ ...at(corner!, [p[0], p[1] + 55, p[2]], [0, -1, 0], corner!.k.frame), hole: false as const })), 0.04);
          fit(NUT, pts.map((p) => ({ ...at(corner!, [p[0], p[1] + 60, p[2]], [0, -1, 0], corner!.k.frame), hole: false as const })), 0.05);
        }
      });
    }
  }

  /* ---------- cushions ---------- */
  const backs = mods.flatMap((m) => m.backs);
  step({ title: "Fill the back cushions and put them in place", detail: "Push the filling into the corners of each cover and zip it closed. The big cushions lean on the backrest, the small ones in front.", kind: "cushions" }, () => {
    b.stagger(0.15);
    for (const k of backs) b.add(k, [0, 200, 300]);
  });
  return true;
}

const family: Family = { names: ["SÖDERHAMN"], build };
export default family;
