import type { Family } from "./family";
import type { Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";

/**
 * LILLEHEM, from IKEA's manuals: every seat is a padded module frame (1-seat 72 x 72 cm, or 2-seat 144 x 72) with
 * four screw-in legs. Its cover is pulled over and fastened underneath. Backrests and armrests are separate padded
 * panels: each one hangs in two brackets screwed to the side of a module (a short and a long screw each) and is
 * locked by two bolts from below. Modules side by side are joined with one bolt and spacer in the new module's side
 * and two hooks on its neighbour's, and the new one is lowered onto the hooks. A TUNSTA side table stands on its own
 * between modules; it is built upside down on its top.
 */

type Side = "back" | "left" | "right";
type Yaw = 0 | 1 | 2 | 3; // quarter turns: 0 faces the front (+z), 1 faces +x, 2 faces the back, 3 faces -x
interface Rec {
  key: string;
  lp: Vec3; // centre in the module's own frame
  ry: number; // its own turn in that frame
}
interface Panel extends Rec {
  side: Side;
  x: number; // a backrest's centre along the module
}
interface Mod {
  n: 1 | 2;
  w: number;
  ox: number;
  oz: number;
  yaw: Yaw;
  sides: Side[];
  on?: number; // the module it hangs on
  frame: Rec;
  legs: Rec[];
  panels: Panel[];
}
interface Table {
  ox: number;
  oz: number;
  recs: Record<string, Rec>;
  legs: Rec[];
}
type Unit = { mod: Mod } | { table: Table };

const D = 720, W1 = 720, LEG = 200, TOP = 420, PT = 40, PI_ = 110, PH = 730;
const TW = 500, TL = 700; // TUNSTA's top
const SHORT: HwDef = { kind: "bolt", len: 16, dia: 6 };
const LONG: HwDef = { kind: "bolt", len: 50, dia: 6 };
const LOCK: HwDef = { kind: "bolt", len: 30, dia: 6 };
const JBOLT: HwDef = { kind: "bolt", len: 25, dia: 8 };
const SPACER: HwDef = { kind: "spacer", len: 25, dia: 20, name: "Spacer" };
const BRACKET: HwDef = { kind: "angle", len: 50, dia: 40, name: "Panel bracket" };
const HOOK: HwDef = { kind: "hook", len: 30, dia: 30, name: "Joining hook" };
const TSCREW: HwDef = { kind: "screw", len: 60, dia: 7 };

// the guides whose legs are wood (they get felt pads); the others have metal legs
const WOOD = new Set([
  "lillehem-2-seat-module",
  "lillehem-3-seat-modular-sofa-side-table",
  "lillehem-3-seat-modular-sofa-w-chaise-longue",
  "lillehem-4-seat-modular-sofa",
  "lillehem-armchair-side-table",
  "lillehem-modular-corner-sofa-4-seat",
]);

const turn = (yaw: Yaw, v: Vec3): Vec3 => {
  switch (yaw) {
    case 1:
      return [v[2], v[1], -v[0]];
    case 2:
      return [-v[0], v[1], -v[2]];
    case 3:
      return [-v[2], v[1], v[0]];
    default:
      return v;
  }
};
const W = (m: { ox: number; oz: number; yaw: Yaw }, v: Vec3): Vec3 => {
  const r = turn(m.yaw, v);
  return [m.ox + r[0], r[1], m.oz + r[2]];
};
const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const ext = (m: Mod): [number, number] => (m.yaw % 2 ? [D, m.w] : [m.w, D]);

/* ---------- what each guide is made of ---------- */

interface Cell {
  n: 1 | 2;
  p: Side[];
  yaw?: 0 | 2;
}
interface Spec {
  n: 1 | 2;
  x: number;
  z: number;
  yaw: Yaw;
  p: Side[];
  on?: number;
}
type Entry = Spec | { table: [number, number] };

/** A straight run from left to right; modules next to each other are joined, a table ("T") stands between them. */
function line(out: Entry[], cells: (Cell | "T")[], x0 = 0, after?: number) {
  let x = x0;
  let prev = after;
  for (const c of cells) {
    if (c === "T") {
      out.push({ table: [x + TW / 2, 0] });
      x += TW;
      prev = undefined;
      continue;
    }
    const yaw = c.yaw ?? 0;
    // a module turned round has its own left on the right
    if (c.p.includes(yaw ? "right" : "left")) x += PT;
    const w = c.n * W1;
    out.push({ n: c.n, x: x + w / 2, z: 0, yaw, p: c.p, on: prev });
    prev = out.length - 1;
    x += w;
    if (c.p.includes(yaw ? "left" : "right")) x += PT;
  }
}

function layout(s: ProductSpec): Entry[] | null {
  const v = s.variant.toLowerCase();
  const o: Entry[] = [];
  const B: Side[] = ["back"], BL: Side[] = ["back", "left"], BR: Side[] = ["back", "right"], ALL: Side[] = ["back", "left", "right"];
  const corner = (n: 1 | 2) => {
    // the corner module at the back left, its back and left side padded; a run to its right and a wing coming forward
    o.push({ n: 1, x: 0, z: 0, yaw: 0, p: BL });
    line(o, [{ n, p: BR }], D / 2, 0);
    o.push({ n, x: 0, z: D / 2 + (n * W1) / 2, yaw: 1, p: BL, on: 0 });
  };
  if (/^1-seat module/.test(v)) line(o, [{ n: 1, p: [] }]);
  else if (/^2-seat module/.test(v)) line(o, [{ n: 2, p: B }]);
  else if (/^armchair with side table/.test(v)) line(o, [{ n: 1, p: ALL }, "T"]);
  else if (/^armchair/.test(v)) line(o, [{ n: 1, p: ALL }]);
  else if (/^2-seat modular sofa with side table/.test(v)) line(o, [{ n: 1, p: BL }, "T", { n: 1, p: BR }]);
  else if (/^2-seat modular sofa/.test(v)) line(o, [{ n: 2, p: ALL }]);
  else if (/^3-seat modular sofa w/.test(v)) {
    line(o, [{ n: 2, p: BL }, { n: 1, p: BR }]);
    const r = o[1] as Spec;
    o.push({ n: 1, x: r.x, z: D, yaw: 0, p: [], on: 1 });
  } else if (/^3-seat modular sofa with side table/.test(v)) line(o, [{ n: 2, p: BL }, "T", { n: 1, p: BL, yaw: 2 }]);
  else if (/^3-seat modular sofa/.test(v)) line(o, [{ n: 2, p: BL }, { n: 1, p: BR }]);
  else if (/^4-seat modular sofa with side table/.test(v)) line(o, [{ n: 2, p: BL }, "T", { n: 2, p: BL, yaw: 2 }]);
  else if (/^4-seat modular sofa/.test(v)) line(o, [{ n: 2, p: BL }, { n: 2, p: BR }]);
  else if (/^5-seat modular sofa with side table/.test(v)) line(o, [{ n: 2, p: ALL }, "T", { n: 2, p: B }, "T", { n: 1, p: BR }]);
  else if (/^6-seat modular sofa with side table/.test(v)) {
    o.push({ n: 1, x: 0, z: 0, yaw: 0, p: BL });
    line(o, [{ n: 1, p: B }, "T", { n: 1, p: B }, { n: 1, p: [] }], D / 2, 0);
    o.push({ n: 2, x: 0, z: D / 2 + W1, yaw: 1, p: B, on: 0 });
    o.push({ n: 1, x: D + 380, z: D + 380, yaw: 0, p: [] }); // the loose module in front, as a footstool
  } else if (/^6-seat modular sofa/.test(v)) line(o, [{ n: 2, p: BL }, { n: 2, p: [] }, { n: 2, p: BL, yaw: 2 }]);
  else if (/^modular corner sofa, 2/.test(v)) corner(1);
  else if (/^modular corner sofa, 4/.test(v)) corner(2);
  else return null;
  return o;
}

/* ---------- the guide ---------- */

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const entries = layout(s);
  if (!entries) return false;
  const wood = WOOD.has(s.slug ?? "");

  const frameT = new Map<number, string>();
  const frameOf = (n: 1 | 2) => {
    if (!frameT.has(n)) frameT.set(n, b.part(n === 1 ? "1-seat module" : "2-seat module", [n * W1, TOP - LEG, D], { material: "soft" }));
    return frameT.get(n)!;
  };
  const legT = b.part("Leg", [36, LEG, 36], { shape: "cyl", material: wood ? "wood" : "metal" });
  // a backrest stands beside the frame and is thick above the seat; an armrest is the same along the end
  const back = b.compound("Backrest", [
    { shape: "box", size: [W1, PH - LEG, PT], pos: [0, (LEG + PH) / 2, -D / 2 - PT / 2] },
    { shape: "box", size: [W1, PH - TOP, PI_], pos: [0, (TOP + PH) / 2, -D / 2 + PI_ / 2] },
  ], { material: "soft" });
  const arm = b.compound("Armrest", [
    { shape: "box", size: [PT, PH - LEG, D], pos: [D / 2 + PT / 2, (LEG + PH) / 2, 0] },
    { shape: "box", size: [PI_, PH - TOP, D], pos: [D / 2 - PI_ / 2, (TOP + PH) / 2, 0] },
  ], { material: "soft" });

  const mods: Mod[] = [];
  const tables: Table[] = [];
  const units: Unit[] = [];
  const put = (m: { ox: number; oz: number; yaw: Yaw }, ref: string, lp: Vec3, ry = 0): Rec => ({ key: b.place(ref, W(m, lp), [0, (m.yaw * Math.PI) / 2 + ry, 0]), lp, ry });
  for (const e of entries) {
    if ("table" in e) {
      const t: Table = { ox: e.table[0], oz: e.table[1], recs: {}, legs: [] };
      tables.push(t);
      units.push({ table: t });
      continue;
    }
    const w = e.n * W1;
    const m: Mod = { n: e.n, w, ox: e.x, oz: e.z, yaw: e.yaw, sides: e.p, on: e.on, frame: undefined as unknown as Rec, legs: [], panels: [] };
    m.frame = put(m, frameOf(e.n), [0, (LEG + TOP) / 2, 0]);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) m.legs.push(put(m, legT, [x * (w / 2 - 60), LEG / 2, z * (D / 2 - 60)]));
    if (e.p.includes("back"))
      for (let i = 0; i < e.n; i++) {
        const x = -w / 2 + W1 / 2 + i * W1;
        m.panels.push({ ...put(m, back.type, plus(back.mid, [x, 0, 0])), side: "back", x });
      }
    if (e.p.includes("left")) m.panels.push({ ...put(m, arm.type, [-w / 2 + D / 2 - arm.mid[0], arm.mid[1], arm.mid[2]], Math.PI), side: "left", x: 0 });
    if (e.p.includes("right")) m.panels.push({ ...put(m, arm.type, [w / 2 - D / 2 + arm.mid[0], arm.mid[1], arm.mid[2]]), side: "right", x: 0 });
    mods.push(m);
    units.push({ mod: m });
  }

  // TUNSTA, in its own frame: the top, two long sides, two blocks between them, the bottom panel and four legs
  const tTop = b.part("Tabletop", [TW, 18, TL], { material: "board" });
  const tSide = b.part("Side", [16, 110, TL], { material: "board" });
  const tBlock = b.part("Block", [80, 110, 18], { material: "board" });
  const tBottom = b.part("Bottom panel", [TW, 16, TL], { material: "board" });
  const tLeg = b.part("Table leg", [30, 226, 30], { shape: "cyl", material: "metal" });
  for (const t of tables) {
    const tm = { ox: t.ox, oz: t.oz, yaw: 0 as Yaw };
    t.recs.top = put(tm, tTop, [0, 361, 0]);
    t.recs.sideL = put(tm, tSide, [-TW / 2 + 8, 297, 0]);
    t.recs.sideR = put(tm, tSide, [TW / 2 - 8, 297, 0]);
    t.recs.blockL = put(tm, tBlock, [-TW / 2 + 56, 297, 0]);
    t.recs.blockR = put(tm, tBlock, [TW / 2 - 56, 297, 0]);
    t.recs.bottom = put(tm, tBottom, [0, 234, 0]);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) t.legs.push(put(tm, tLeg, [x * (TW / 2 - 45), 113, z * (TL / 2 - 45)]));
  }

  // centre the whole thing on the origin
  {
    const xs: number[] = [], zs: number[] = [];
    for (const m of mods) {
      const [ex, ez] = ext(m);
      xs.push(m.ox - ex / 2 - PT, m.ox + ex / 2 + PT);
      zs.push(m.oz - ez / 2 - PT, m.oz + ez / 2 + PT);
    }
    for (const t of tables) xs.push(t.ox - TW / 2, t.ox + TW / 2), zs.push(t.oz - TL / 2, t.oz + TL / 2);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    for (const it of b.items) if (it.kind === "part") it.final = { pos: plus(it.final.pos, [-cx, 0, -cz]), rot: it.final.rot };
    for (const m of [...mods, ...tables]) {
      m.ox -= cx;
      m.oz -= cz;
    }
  }

  const alone = mods.length === 1;
  const pl = (n: number, one: string, many: string) => (n > 1 ? many : one);
  const step = (o: { title: string; detail?: string; scene: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] }, body: () => void = () => {}) =>
    b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  const fit = (def: HwDef, list: FitOpts[], gap = 0.08) => b.fits(def, list, gap);
  const at = (m: { ox: number; oz: number; yaw: Yaw }, lp: Vec3, d: Vec3, on: string, o: Partial<FitOpts> = {}): FitOpts => ({ on, at: W(m, lp), dir: turn(m.yaw, d), ...o });

  // where each module (or table) stands in a scene while it's worked on: side by side, square to the camera
  const offs = new Map<string, Map<object, Vec3>>();
  const inMain = new Set<string>();
  const arrange = (scene: string, list: (Mod | Table)[], alongZ = false) => {
    const ws = list.map((m) => ("w" in m ? m.w + 2 * PT : TW) + 450);
    const total = ws.reduce((a, w) => a + w, 0);
    let x = -total / 2;
    const map = new Map<object, Vec3>();
    list.forEach((m, i) => {
      map.set(m, alongZ ? [0, 0, x + ws[i] / 2] : [x + ws[i] / 2, 0, 0]);
      x += ws[i];
    });
    offs.set(scene, map);
  };
  const stage = (scene: string, m: Mod | Table, recs: Rec[], from?: Vec3, away: Vec3 = [0, 0, 0]) => {
    if (scene === "main") {
      for (const r of recs) if (!inMain.has(r.key)) b.add(r.key, from), inMain.add(r.key);
      return;
    }
    const off = plus(offs.get(scene)?.get(m) ?? [0, 0, 0], away);
    for (const r of recs) b.stage(r.key, plus(off, r.lp), [0, r.ry, 0], from);
  };
  const all = (m: Mod) => [m.frame, ...m.legs, ...m.panels];
  const ms = (name: string) => (alone ? "main" : name);

  /* ---------- the module frames ---------- */
  const many = mods.length > 1;
  const S = ms("modules");
  if (S !== "main") arrange(S, mods);
  step({ title: many ? "Turn the modules upside down and screw in the legs" : "Turn the module upside down and screw in the legs", detail: many ? "Four in each, clockwise by hand until snug." : "Clockwise by hand until each one is snug.", scene: S, pose: "-y", kind: "legs", warnings: ["floor", "hand"] }, () => {
    b.stagger(0.2);
    for (const m of mods) stage(S, m, [m.frame], [0, 200, 0]);
    b.then(0.1);
    b.stagger(0.12);
    for (const m of mods) stage(S, m, m.legs, [0, -220, 0]);
  });
  if (wood)
    step({ title: "Press a felt pad onto each leg", detail: "Onto the end of the leg, before it stands on the floor.", scene: S, pose: "-y" }, () => {
      for (const m of mods) fit(HW.glide, m.legs.map((l) => at(m, [l.lp[0], 0, l.lp[2]], [0, 1, 0], l.key, { hole: false })), 0.06);
    });
  step({ title: many ? "Pull the covers over the modules" : "Pull the cover over the module", detail: "Stand it on its legs. One of you on each side: line the seams up with the edges and pull it down evenly.", scene: S, people: 2 });
  step({ title: many ? "Tip them up and fasten the covers underneath" : "Tip it up and fasten the cover underneath", detail: "Pull the edge of the cover under the frame and fasten it all the way round, snug around the legs.", scene: S, pose: "-z", warnings: ["floor"] });

  /* ---------- the backrests and armrests ---------- */
  const panels = mods.flatMap((m) => m.panels.map((p) => ({ m, p })));
  const nb = panels.filter((x) => x.p.side === "back").length, na = panels.length - nb;
  if (panels.length) {
    const what = [nb ? pl(nb, "backrest", "backrests") : "", na ? pl(na, "armrest", "armrests") : ""].filter(Boolean).join(" and ");
    const one = panels.length === 1;
    // laid out in a row, standing up
    // every panel faces the same way, its outer face at the back
    const total = panels.length * (W1 + 300);
    const spot = (i: number): Vec3 => [-total / 2 + (i + 0.5) * (W1 + 300), back.mid[1], 0];
    step({ title: one ? `Pull the cover over the ${what}` : `Pull the covers over the ${what}`, detail: "Stand it on its bottom edge. One of you each side: work the cover down evenly so the seams sit on the edges.", scene: "panels", people: 2 }, () => {
      b.stagger(0.15);
      panels.forEach(({ p }, i) => b.stage(p.key, spot(i), [0, p.side === "back" ? 0 : Math.PI / 2, 0], [0, 200, 0]));
    });
    step({ title: one ? "Turn it over and fasten the cover underneath" : "Turn them over and fasten the covers underneath", detail: "Push the edge of the cover into the channel along the bottom, all the way along.", scene: "panels", pose: "-y" });
  }

  // the brackets go on with the module tipped so that side faces up; then it's stood up and the panel lowered in
  const bracketPts = (m: Mod, p: Panel): { at: Vec3; d: Vec3; lock: Vec3 }[] => {
    const half = m.w / 2;
    if (p.side === "back") return [-200, 200].map((dx) => ({ at: [p.x + dx, 330, -D / 2] as Vec3, d: [0, 0, 1] as Vec3, lock: [p.x + dx, LEG, -D / 2 - PT / 2] as Vec3 }));
    const sx = p.side === "right" ? 1 : -1;
    return [-200, 200].map((dz) => ({ at: [sx * half, 330, dz] as Vec3, d: [-sx, 0, 0] as Vec3, lock: [sx * (half + PT / 2), LEG, dz] as Vec3 }));
  };
  const hangPanels = (side: Side) => {
    const list = mods.filter((m) => m.panels.some((p) => p.side === side));
    if (!list.length) return;
    const scene = ms(side === "back" ? "backrests" : side === "left" ? "left ends" : "right ends");
    // a module laid on its side is turned about the left to right axis, so a row of them runs front to back
    if (scene !== "main") arrange(scene, list, side !== "back");
    const ps = (m: Mod) => m.panels.filter((p) => p.side === side);
    const n = list.reduce((a, m) => a + ps(m).length, 0);
    const noun = side === "back" ? pl(n, "backrest", "backrests") : pl(n, "armrest", "armrests");
    const done = (m: Mod) => m.panels.filter((p) => p.side !== side && (p.side === "back" || (side === "right" && p.side === "left")));
    const pose: Pose = side === "back" ? "-z" : side === "left" ? "-x" : "+x";
    const where = side === "back" ? "the back" : "the end";
    const lie = side === "back" ? (list.length > 1 ? "onto their fronts" : "onto its front") : list.length > 1 ? "on their sides" : "on its side";
    step({ title: `Lay the ${pl(list.length, "module", "modules")} ${lie} and screw brackets onto ${where}`, detail: `Two brackets for each ${side === "back" ? "backrest" : "armrest"}, each with a short and a long screw, using the Allen key.`, scene, pose, kind: "screws", tools: ["allen"] }, () => {
      b.stagger(0.15);
      for (const m of list) stage(scene, m, [m.frame, ...m.legs, ...done(m)], scene === "main" ? undefined : [0, 160, 0]);
      b.then(0.1);
      for (const m of list)
        for (const p of ps(m)) {
          const pts = bracketPts(m, p);
          fit(BRACKET, pts.map((q) => at(m, q.at, q.d, m.frame.key, { hole: false })), 0.1);
          b.then(0.05);
          const along = (q: { at: Vec3; d: Vec3 }, k: number): Vec3 => (q.d[2] ? [q.at[0] + k, q.at[1], q.at[2]] : [q.at[0], q.at[1], q.at[2] + k]);
          fit(SHORT, pts.map((q) => at(m, along(q, -12), q.d, m.frame.key)), 0.08);
          fit(LONG, pts.map((q) => at(m, along(q, 12), q.d, m.frame.key)), 0.08);
        }
    });
    step({ title: `Stand ${list.length > 1 ? "them" : "it"} up and lower the ${noun} into the brackets`, detail: "Hold it upright and let the slots in its bottom slide down over the brackets until it sits flat.", scene, kind: "join" }, () => {
      b.stagger(0.2);
      for (const m of list) stage(scene, m, ps(m), [0, 320, 0]);
    });
    step({ title: `Lock ${n > 1 ? "each one" : "it"} with two bolts from below`, detail: "Up through the bracket into the bottom of the panel, with the Allen key.", scene, kind: "bolts", tools: ["allen"] }, () => {
      for (const m of list) for (const p of ps(m)) fit(LOCK, bracketPts(m, p).map((q) => at(m, q.lock, [0, 1, 0], p.key, { travel: 70, spin: 3 })), 0.12);
    });
  };
  hangPanels("back");
  hangPanels("left");
  hangPanels("right");

  /* ---------- the side tables ---------- */
  if (tables.length) {
    const T = "table";
    arrange(T, tables);
    const nt = tables.length;
    const each = (one: string, many: string) => (nt > 1 ? many : one);
    const tr = (t: Table, k: string) => t.recs[k];
    const tm = (t: Table) => ({ ox: t.ox, oz: t.oz, yaw: 0 as Yaw });
    step({ title: each("Lay the tabletop face down and push in the two sides", "Lay the tabletops face down and push in the sides"), detail: "On a rug or the flattened box. Press each side into the fittings along the edge and slide it along until it locks.", scene: T, pose: "-y", kind: "join", warnings: ["floor"] }, () => {
      b.stagger(0.2);
      for (const t of tables) stage(T, t, [tr(t, "top")], [0, -200, 0]);
      b.then(0.1);
      for (const t of tables) stage(T, t, [tr(t, "sideL"), tr(t, "sideR")], [0, -260, 0]);
    });
    step({ title: "Tap four dowels into the edges of the sides", detail: "Two at each end of both sides.", scene: T, pose: "-y", kind: "dowels", tools: ["hammer"] }, () => {
      for (const t of tables)
        for (const k of ["sideL", "sideR"]) {
          const r = tr(t, k);
          fit(HW.dowel, [-300, 300].map((z) => at(tm(t), [r.lp[0], 242, z], [0, 1, 0], r.key, { mate: tr(t, "bottom").key })), 0.1);
        }
    });
    step({ title: each("Tap the dowels into the two blocks", "Tap the dowels into the blocks"), detail: "Two in one end of each block and one in the other.", scene: T, pose: "-y", kind: "dowels", tools: ["hammer"] }, () => {
      for (const t of tables)
        for (const k of ["blockL", "blockR"]) {
          const r = tr(t, k);
          stage(T, t, [r], [0, -200, 0], [0, 0, 500]);
          b.then(0.05);
          fit(HW.dowel, [-20, 20].map((dx) => at(tm(t), [r.lp[0] + dx, 352, 0], [0, -1, 0], r.key, { mate: tr(t, "top").key })), 0.08);
          fit(HW.dowel, [at(tm(t), [r.lp[0], 242, 0], [0, 1, 0], r.key, { mate: tr(t, "bottom").key })]);
        }
    });
    step({ title: "Push the blocks in between the sides", detail: "Two dowels down into the tabletop, against the middle of each side.", scene: T, pose: "-y", kind: "join" }, () => {
      for (const t of tables) stage(T, t, [tr(t, "blockL"), tr(t, "blockR")], [0, -200, 0]);
    });
    step({ title: "Screw the four leg plates onto the bottom panel", detail: "Four small screws in each, near the corners of the panel's underside.", scene: T, pose: "-y", kind: "screws", tools: ["screwdriver"] }, () => {
      for (const t of tables) {
        const r = tr(t, "bottom");
        // laid beside the table, underside up
        b.stage(r.key, plus(plus(offs.get(T)!.get(t)!, [0, 362, TL + 250]), [0, 0, 0]), [0, 0, 0], [0, -200, 0]);
        b.then(0.1);
        const pts = t.legs.map((l) => [l.lp[0], 226, l.lp[2]] as Vec3);
        fit(HW.plate, pts.map((p) => at(tm(t), p, [0, 1, 0], r.key, { hole: false })), 0.1);
        b.then(0.05);
        fit(HW.screwS, pts.flatMap((p) => [[-22, -22], [22, -22], [22, 22], [-22, 22]].map(([dx, dz]) => at(tm(t), [p[0] + dx, 226, p[2] + dz], [0, 1, 0], r.key))), 0.03);
      }
    });
    step({ title: "Lay the bottom panel on and screw it down", detail: "Leg plates facing up. Six long screws, into both sides and both blocks, with the Allen key.", scene: T, pose: "-y", kind: "screws", tools: ["allen"] }, () => {
      for (const t of tables) stage(T, t, [tr(t, "bottom")], [0, -220, 0]);
      b.then(0.1);
      for (const t of tables) {
        const bot = tr(t, "bottom").key;
        const pts: [number, number, string][] = [
          [-TW / 2 + 8, -200, "sideL"], [-TW / 2 + 8, 200, "sideL"], [TW / 2 - 8, -200, "sideR"], [TW / 2 - 8, 200, "sideR"],
          [-TW / 2 + 56, 0, "blockL"], [TW / 2 - 56, 0, "blockR"],
        ];
        fit(TSCREW, pts.map(([x, z, k]) => at(tm(t), [x, 226, z], [0, 1, 0], bot, { mate: tr(t, k).key, travel: 90, spin: 4 })), 0.08);
      }
    });
    step({ title: "Screw the legs into the leg plates", detail: "Clockwise by hand until each one is tight.", scene: T, pose: "-y", kind: "legs", warnings: ["hand"] }, () => {
      b.stagger(0.15);
      for (const t of tables) stage(T, t, t.legs, [0, -220, 0]);
    });
    step({ title: each("Turn the table over", "Turn the tables over"), detail: "Lift it by the box, not by the legs.", scene: T, kind: "standup" });
  }

  /* ---------- joining the modules ---------- */
  type Joint = { a: Mod; b: Mod; hooks: Vec3[]; bolt: Vec3; d: Vec3 };
  const joints: Joint[] = [];
  // which module each entry index is
  const modAt = new Map<number, Mod>();
  {
    let k = 0;
    entries.forEach((e, i) => {
      if (!("table" in e)) modAt.set(i, mods[k++]);
    });
  }
  for (const m of mods) {
    if (m.on === undefined) continue;
    const a = modAt.get(m.on)!;
    const dx = m.ox - a.ox, dz = m.oz - a.oz;
    const ax = Math.abs(dx) > Math.abs(dz) ? 0 : 2;
    const sg = Math.sign(ax ? dz : dx);
    const ea = ext(a), eb = ext(m);
    const face = (ax ? a.oz : a.ox) + (sg * (ax ? ea[1] : ea[0])) / 2;
    const ta = ax ? a.ox : a.oz, tb = ax ? m.ox : m.oz;
    const la = ax ? ea[0] : ea[1], lb = ax ? eb[0] : eb[1];
    const lo = Math.max(ta - la / 2, tb - lb / 2), hi = Math.min(ta + la / 2, tb + lb / 2);
    const mid = (lo + hi) / 2, off = Math.min(250, (hi - lo) / 2 - 100);
    const pt = (t: number): Vec3 => (ax ? [t, 300, face] : [face, 300, t]);
    const d: Vec3 = ax ? [0, 0, sg] : [sg, 0, 0]; // from the old module toward the new one
    joints.push({ a, b: m, hooks: [pt(mid - off), pt(mid + off)], bolt: pt(mid + off), d });
  }
  const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]];
  const wfit = (def: HwDef, p: Vec3, d: Vec3, on: string, o: Partial<FitOpts> = {}): FitOpts => ({ on, at: p, dir: d, ...o });
  if (joints.length) {
    const news = [...new Set(joints.map((j) => j.b))];
    const olds = [...new Set(joints.map((j) => j.a))];
    arrange("bolts", news);
    arrange("hooks", olds);
    step({ title: news.length > 1 ? "Turn the modules over and screw a bolt into each joining side" : "Turn the module over and screw a bolt into its side", detail: "Slide the spacer onto the bolt first. It goes into the hole low down on the side that meets the neighbour.", scene: "bolts", pose: "-y", kind: "bolts", tools: ["allen"], warnings: ["floor"] }, () => {
      b.stagger(0.15);
      for (const m of news) stage("bolts", m, all(m), [0, 160, 0]);
      b.then(0.1);
      for (const j of joints) {
        fit(SPACER, [wfit(SPACER, j.bolt, j.d, j.b.frame.key, { hole: false })]);
        b.then(0.05);
        fit(JBOLT, [wfit(JBOLT, plus(j.bolt, [-j.d[0] * 25, 0, -j.d[2] * 25]), j.d, j.b.frame.key, { travel: 80, spin: 3 })]);
      }
    });
    step({ title: olds.length > 1 ? "Tip the neighbours onto their backs and screw on two hooks each" : "Tip the other module onto its back and screw on two hooks", detail: "On the side the new module meets, one near the front and one near the back, with a short screw each.", scene: "hooks", pose: "+z", kind: "screws", tools: ["allen"], warnings: ["floor"] }, () => {
      b.stagger(0.15);
      for (const m of olds) stage("hooks", m, all(m), [0, 160, 0]);
      b.then(0.1);
      for (const j of joints) {
        fit(HOOK, j.hooks.map((p) => wfit(HOOK, p, neg(j.d), j.a.frame.key, { hole: false })), 0.12);
        b.then(0.05);
        fit(SHORT, j.hooks.map((p) => wfit(SHORT, [p[0], p[1] + 14, p[2]], neg(j.d), j.a.frame.key)), 0.1);
      }
    });
  }

  /* ---------- into place ---------- */
  if (!alone || tables.length) {
    let first = true;
    for (const u of units) {
      if ("table" in u) {
        if (alone) {
          step({ title: "Stand the side table beside the armchair", detail: "It stands on its own legs, tight against the armrest.", scene: "main", kind: "join" }, () => {
            for (const r of [...Object.values(u.table.recs), ...u.table.legs]) b.add(r.key, [400, 0, 0]);
          });
        } else
          step({ title: "Stand the side table in the gap", detail: "It stands on its own legs between the modules. Leave room for the next module beside it.", scene: "main", kind: "join" }, () => {
            for (const r of [...Object.values(u.table.recs), ...u.table.legs]) b.add(r.key, [0, 300, 0]);
          });
        continue;
      }
      const m = u.mod;
      if (alone) continue;
      const j = joints.find((x) => x.b === m);
      if (!j) {
        step({ title: first ? "Stand the first module where the sofa will go" : m.sides.length ? "Stand the next module in place" : "Stand the loose module where you want it", detail: first ? "The others are joined to it one by one." : undefined, scene: "main", kind: "join" }, () => {
          for (const r of all(m)) b.add(r.key, [0, 200, 0]);
        });
        first = false;
        continue;
      }
      step({ title: "Lower the next module onto the hooks", detail: "Lift its joining side a little, line the bolt up over the hook and let it drop in, so the two modules sit tight together.", scene: "main", kind: "join" }, () => {
        for (const r of all(m)) b.add(r.key, [j.d[0] * 300, 160, j.d[2] * 300]);
      });
    }
  }
  return true;
}

const family: Family = { names: ["LILLEHEM"], build };
export default family;
