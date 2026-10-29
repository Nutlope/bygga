import type { Family } from "./family";
import type { Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";

/**
 * VIMLE, from IKEA's manuals: a modular sofa where every module is its own frame. A seat section has no legs: its
 * backrest is lowered onto four studs (two on the 1-seat) and clamped, and the section hangs between its neighbours.
 * The armrests carry the legs and are held on by three threaded rods with nuts from inside the section; a chaise
 * longue or a corner section stands on its own legs and has hooks the section is lifted onto, on a stud screwed into
 * its end. Two seat sections side by side are joined with the connection fitting, which adds two legs under the join.
 * Covers go on every frame before the modules are joined; the cushions go in last.
 */

type Kind = "seat" | "arm" | "chaise" | "corner" | "bed" | "stool";
interface Rec {
  key: string;
  lp: Vec3; // centre in the module's own frame
}
interface Mod {
  kind: Kind;
  w: number; // along the module's own x
  n: number; // seats
  ox: number;
  oz: number;
  yaw: Yaw;
  recs: Rec[]; // frame parts, legs included
  legs: Rec[];
  cush: string[]; // seat cushions
  backs: string[]; // back cushions
  k: Record<string, string>;
}

const D = 980, Z0 = -490, BT = 180, LEG = 60;
const CW = 810; // chaise longue
const STUD: HwDef = { kind: "stud", len: 90, dia: 8 };
const ROD: HwDef = { kind: "stud", len: 140, dia: 8 };
const PIN: HwDef = { kind: "stud", len: 150, dia: 10 };
const BSTUD: HwDef = { kind: "stud", len: 70, dia: 8 };
const CSTUD: HwDef = { kind: "stud", len: 100, dia: 8 };
const BIGW: HwDef = { kind: "washer", len: 6, dia: 40 };
const W16: HwDef = { kind: "washer", len: 1.5, dia: 16 };
const W24: HwDef = { kind: "washer", len: 2, dia: 24 };
const W30: HwDef = { kind: "washer", len: 2, dia: 30 };
const NUT: HwDef = { kind: "nut", len: 6, dia: 8 };
const WING: HwDef = { kind: "nut", len: 14, dia: 30 };
const CBOLT: HwDef = { kind: "bolt", len: 150, dia: 8 };
const HEAD: HwDef = { kind: "bolt", len: 14, dia: 8 };
const HSCREW: HwDef = { kind: "screw", len: 16, dia: 8 };
// the sofa-bed's own fittings
const BW = 1600; // the 2-seat sofa-bed section
const STOOL = 730; // the leather footstool, along the wing
// the open-end kit that comes with the leather footstool
const EBRK: HwDef = { kind: "bracket", len: 90, dia: 70, name: "Top bracket" };
const SUPP: HwDef = { kind: "bracket", len: 200, dia: 60, name: "Support bracket" };
const CSK: HwDef = { kind: "screw", len: 20, dia: 6, name: "Countersunk screw" };
const CARR: HwDef = { kind: "bolt", len: 60, dia: 8, name: "Carriage bolt" };
const LPLATE: HwDef = { kind: "plate", len: 160, dia: 70, name: "Leg plate" };
const WSCREW: HwDef = { kind: "screw", len: 20, dia: 6, name: "Wing screw" };
const BBOLT: HwDef = { kind: "bolt", len: 16, dia: 8 };
const FNUT: HwDef = { kind: "nut", len: 8, dia: 8, name: "Flange nut" };
const MSCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const SBOLT: HwDef = { kind: "bolt", len: 70, dia: 8 };

const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
// 1: turned a quarter, its front facing +x (the left wing of a corner sofa); 3: the other way, facing -x (the right wing)
type Yaw = 0 | 1 | 3;
const turn = (yaw: Yaw, d: Vec3): Vec3 => (yaw === 1 ? [d[2], d[1], -d[0]] : yaw === 3 ? [-d[2], d[1], d[0]] : d);
const W = (m: Mod, v: Vec3): Vec3 => plus([m.ox, 0, m.oz], turn(m.yaw, v));
const Wd = (m: Mod, d: Vec3): Vec3 => turn(m.yaw, d);
const yawRot = (yaw: Yaw): Vec3 => [0, yaw === 1 ? Math.PI / 2 : yaw === 3 ? -Math.PI / 2 : 0, 0];
// where a module sits in another one's frame (they share a yaw when they are joined)
const rel = (m: Mod, a: Mod): Vec3 => {
  const dx = m.ox - a.ox, dz = m.oz - a.oz;
  return a.yaw === 1 ? [-dz, 0, dx] : a.yaw === 3 ? [dz, 0, -dx] : [dx, 0, dz];
};

// "corner": a second corner section closing the back row (a U); "stool": the footstool at an open end
type Cell = number | "chaise" | "arm" | "bed" | "corner" | "stool";
interface Layout {
  row?: Cell[];
  corner?: boolean;
  back?: Cell[];
  wing?: Cell[];
  wing2?: Cell[]; // the right wing, coming forward from the second corner
  leather?: boolean; // the Grann/Bomstad range: frames come covered, sections are built from three pieces
  armW?: number;
  mirror?: boolean; // drawn as a left corner, then mirrored: the corner stands at the back right
}

/** What the product is made of, from its name: null for the VIMLE products whose manuals aren't covered here. */
function layout(s: ProductSpec): Layout | null {
  const v = s.variant.toLowerCase();
  const W2 = 1410, W3 = 2110, W1 = 710;
  // the older Grann/Bomstad leather range: 80 cm high, a footstool at the open end
  if (s.size.h < 82) {
    if (/^corner sofa, 3-seat/.test(v)) return { corner: true, back: [W1, "arm"], wing: [W1, "stool"], leather: true, mirror: true };
    if (/^u-shaped sofa, 6 seat/.test(v)) return { corner: true, back: [W2, "corner"], wing: [W2, "arm"], wing2: [W1, "stool"], leather: true };
    return null;
  }
  if (/^2-seat sofa-bed section/.test(v)) return { row: ["bed"] };
  if (/^2-seat sofa-bed$/.test(v)) return { row: ["arm", "bed", "arm"], leather: true };
  if (/^3-seat sofa-bed with chaise/.test(v)) return { row: ["arm", "bed", "chaise", "arm"] };
  // IKEA: 256 cm on the left (corner, 2-seat section, wide armrest) and 356 on the right (corner, sofa-bed, chaise, armrest)
  if (/^crnr sofa-bed, 5-seat w chaise/.test(v)) return { corner: true, back: ["bed", "chaise", "arm"], wing: [W2, "arm"], armW: 220 };
  if (/bed/.test(v)) return null;
  if (/^1-seat section/.test(v)) return { row: [W1] };
  if (/^2-seat section/.test(v)) return { row: [W2] };
  if (/^3-seat section/.test(v)) return { row: [W3] };
  if (/^chaise longue section/.test(v)) return { row: ["chaise"] };
  if (/^corner section/.test(v)) return { corner: true, back: [], wing: [] };
  if (/^armchair/.test(v)) return { row: ["arm", W1, "arm"] };
  if (/^2-seat sofa$/.test(v)) return { row: ["arm", W2, "arm"] };
  if (/^3-seat sofa$/.test(v)) return { row: ["arm", W3, "arm"] };
  if (/^4-seat sofa$/.test(v)) return { row: ["arm", W2, W2, "arm"] };
  if (/^3-seat sofa with chaise/.test(v)) return { row: ["arm", W2, "chaise", "arm"] };
  if (/^4-seat sofa with chaise/.test(v)) return { row: ["arm", W3, "chaise", "arm"] };
  if (/^corner sofa, 4-seat$/.test(v)) return { corner: true, back: [W2, "arm"], wing: [W2, "arm"] };
  if (/^corner sofa, 5-seat$/.test(v)) return { corner: true, back: [W2, "arm"], wing: [W3, "arm"] };
  if (/^corner sofa, 5-seat w/.test(v)) return { corner: true, back: [W2, "chaise", "arm"], wing: [W2, "arm"] };
  return null;
}

/** The ottoman: a padded box on four legs with a loose padded lid. */
function ottoman(b: PlanBuilder, s: ProductSpec) {
  const w = s.size.w * 10, h = s.size.h * 10, d = s.size.d * 10;
  const lt = 140;
  const box = b.place(b.part("Storage box", [w, h - lt - LEG, d], { material: "soft" }), [0, LEG + (h - lt - LEG) / 2, 0]);
  const lid = b.place(b.part("Padded lid", [w, lt, d], { material: "soft" }), [0, h - lt / 2, 0]);
  const legT = b.part("Leg", [50, LEG, 50], { shape: "cyl", material: "wood" });
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => [x * (w / 2 - 70), z * (d / 2 - 70)]);
  const legs = pts.map(([x, z]) => b.place(legT, [x, LEG / 2, z]));
  b.step({ title: "Turn the box upside down and screw in the legs", detail: "On something soft. Clockwise by hand until each one is snug.", pose: "-y", kind: "legs", warnings: ["hand", "floor"] }, () => {
    b.add(box, [0, 200, 0]);
    b.then(0.1);
    b.stagger(0.2);
    for (const l of legs) b.add(l, [0, -220, 0], { spin: 2 });
  });
  b.step({ title: "Stick a felt pad under each leg", pose: "-y", kind: "general", warnings: [] }, () => {
    b.fits(HW.glide, legs.map((l, i) => ({ on: l, at: [pts[i][0], 0, pts[i][1]] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.12);
  });
  b.step({ title: "Fit the cover around the box", detail: "Stand it up. One of you each side: fasten the cover along the inside of the top edge, then pull it down the sides.", kind: "general", people: 2, warnings: ["two"] }, () => {});
  b.step({ title: "Fasten the cover under the box", detail: "Turn it over again, unscrew the legs, pull the cover tight underneath and screw the legs back in through their holes.", pose: "-y", kind: "general", warnings: ["hand"] }, () => {});
  b.step({ title: "Zip the cover onto the lid and lay it on top", detail: "Stand the box up first. The lid just sits on the box, so you can lift it off to reach inside.", kind: "cushions", warnings: [] }, () => b.add(lid, [0, 240, 0]));
  return true;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (/^ottoman/i.test(s.variant)) return ottoman(b, s);
  const lay = layout(s);
  if (!lay) return false;
  const p = s.sofa ?? {};
  const H = s.size.h * 10;
  const seatTop = (p.seatH ?? 48) * 10;
  const baseTop = seatTop - 180;
  const backH = (p.backH ?? 68) * 10;
  const armH = (p.armH ?? 68) * 10;
  const row = lay.row ?? [];
  const nArms = row.filter((x) => x === "arm").length;
  const fixed = row.reduce<number>((t, x) => t + (typeof x === "number" ? x : x === "chaise" ? CW : x === "bed" ? BW : 0), 0);
  // the armrests are what's left of IKEA's width: 15 cm, or 22 cm for the wide ones
  const armW = lay.armW ?? (p.armW ? p.armW * 10 : nArms ? Math.min(240, Math.max(150, (s.size.w * 10 - fixed) / nArms)) : 150);
  const cushH = H - seatTop - 10;

  const mods: Mod[] = [];
  const legT = b.part("Leg", [50, LEG, 50], { shape: "cyl", material: "wood" });
  const types = new Map<string, string>();
  const typeOf = (name: string, size: Vec3, material: "soft" | "wood" = "soft") => {
    const id = `${name}|${size.map(Math.round).join("x")}`;
    if (!types.has(id)) types.set(id, b.part(name, size, { material }));
    return types.get(id)!;
  };
  const compounds = new Map<string, { type: string; mid: Vec3 }>();
  const put = (m: Mod, ref: string, lp: Vec3, list: Rec[] = m.recs) => {
    const key = b.place(ref, W(m, lp), yawRot(m.yaw));
    list.push({ key, lp });
    return key;
  };
  const leg = (m: Mod, x: number, z: number) => {
    const r = put(m, legT, [x, LEG / 2, z], m.legs);
    m.recs.push(m.legs[m.legs.length - 1]);
    return r;
  };
  const mod = (kind: Kind, w: number, ox: number, oz: number, yaw: Yaw): Mod => {
    const m: Mod = { kind, w, n: kind === "seat" ? Math.round(w / 700) : kind === "bed" ? 2 : kind === "arm" || kind === "stool" ? 0 : 1, ox, oz, yaw, recs: [], legs: [], cush: [], backs: [], k: {} };
    mods.push(m);
    const cushion = (name: string, size: Vec3, lp: Vec3) => b.place(typeOf(name, size), W(m, lp), yawRot(m.yaw));
    if (kind === "seat" && lay.leather) {
      // a padded seat frame, the spring backrest on rods, and a padded top board on rods; only the back cushions are loose
      m.k.base = put(m, typeOf("Seat frame", [w, seatTop - LEG, D]), [0, (LEG + seatTop) / 2, 0]);
      m.k.back = put(m, typeOf("Backrest", [w, backH - 60 - seatTop, BT]), [0, (seatTop + backH - 60) / 2, Z0 + BT / 2]);
      m.k.top = put(m, typeOf("Top board", [w, 60, BT + 30]), [0, backH - 30, Z0 + (BT + 30) / 2]);
      const cw = w / m.n;
      for (let i = 0; i < m.n; i++) m.backs.push(cushion("Back cushion", [cw - 14, cushH, 200], [-w / 2 + cw * (i + 0.5), seatTop + cushH / 2, Z0 + BT + 104]));
    } else if (kind === "corner" && lay.leather) {
      // one padded frame, L-shaped, on four legs; the seat cushion lies in it
      const cb = seatTop - 120;
      const fr = compounds.get("lcorner") ?? b.compound("Corner section", [
        { shape: "box", size: [D, cb - LEG, D], pos: [0, (LEG + cb) / 2, 0] },
        { shape: "box", size: [D, backH - cb, BT], pos: [0, (cb + backH) / 2, Z0 + BT / 2] },
        { shape: "box", size: [BT, backH - cb, D - BT], pos: [Z0 + BT / 2, (cb + backH) / 2, Z0 + BT + (D - BT) / 2] },
      ], { material: "soft" });
      compounds.set("lcorner", fr);
      m.k.back = put(m, fr.type, fr.mid);
      for (const [x, z] of [[-410, -410], [410, -410], [410, 410], [-410, 410]]) leg(m, x, z);
      const bw = D - BT;
      m.cush.push(cushion("Corner seat cushion", [bw - 10, 120, bw - 10], [Z0 + BT + bw / 2, cb + 60, Z0 + BT + bw / 2]));
      m.backs.push(cushion("Back cushion", [bw - 200 - 4, cushH, 200], [Z0 + BT + 200 + (bw - 200) / 2 + 2, seatTop + cushH / 2, Z0 + BT + 104]));
      m.backs.push(cushion("Corner back cushion", [200, cushH, bw], [Z0 + BT + 104, seatTop + cushH / 2, Z0 + BT + bw / 2]));
    } else if (kind === "stool") {
      // the footstool with storage: a box on four legs with a loose lid
      m.k.body = put(m, typeOf("Footstool box", [w, seatTop - LEG - 120, D]), [0, (LEG + seatTop - 120) / 2, 0]);
      m.k.lid = put(m, typeOf("Footstool lid", [w, 120, D]), [0, seatTop - 60, 0]);
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) leg(m, x * (w / 2 - 70), z * (D / 2 - 70));
    } else if (kind === "seat") {
      m.k.base = put(m, typeOf("Seat frame", [w, baseTop - LEG, D]), [0, LEG + (baseTop - LEG) / 2, 0]);
      m.k.back = put(m, typeOf("Backrest", [w, backH - baseTop, BT]), [0, baseTop + (backH - baseTop) / 2, Z0 + BT / 2]);
      const cw = w / m.n;
      for (let i = 0; i < m.n; i++) {
        const x = -w / 2 + cw * (i + 0.5);
        m.cush.push(cushion("Seat cushion", [cw - 8, 180, D - BT - 10], [x, baseTop + 90, Z0 + BT + (D - BT) / 2 - 2]));
        m.backs.push(cushion("Back cushion", [cw - 14, cushH, 200], [x, seatTop + cushH / 2, Z0 + BT + 104]));
      }
    } else if (kind === "bed") {
      // folded: the frame with its side plates and the bed folded inside, a front panel, the backrest on the plates
      const fz = D / 2 - 40; // where the front panel starts
      const frame = b.compound("Sofa-bed frame", [
        ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [50, baseTop - LEG, fz - Z0] as Vec3, pos: [sx * (w / 2 - 25), LEG + (baseTop - LEG) / 2, (Z0 + fz) / 2] as Vec3 })),
        { shape: "box", size: [w - 100, 100, fz - Z0 - BT - 20], pos: [0, LEG + 70, (Z0 + BT + fz - 20) / 2] },
        ...[-1, 1].flatMap((sx) => [Z0 + 60, fz - 40].map((z) => ({ shape: "box" as const, size: [50, LEG, 50] as Vec3, pos: [sx * (w / 2 - 40), LEG / 2, z] as Vec3 }))),
      ], { material: "board" });
      m.k.frame = put(m, frame.type, frame.mid);
      m.k.front = put(m, typeOf("Front panel", [w, baseTop - LEG - 10, 40]), [0, LEG + 10 + (baseTop - LEG - 10) / 2, fz + 20]);
      const back = b.compound("Sofa-bed backrest", [
        { shape: "box", size: [w - 100, baseTop - 120, BT], pos: [0, (120 + baseTop) / 2, Z0 + BT / 2] },
        { shape: "box", size: [w, backH - baseTop, BT], pos: [0, (baseTop + backH) / 2, Z0 + BT / 2] },
      ], { material: "soft" });
      m.k.back = put(m, back.type, back.mid);
      m.k.mat = put(m, typeOf("Mattress", [1400, 120, fz - Z0 - BT - 40]), [0, baseTop - 60, (Z0 + BT + fz) / 2]);
      const cw = w / m.n;
      for (let i = 0; i < m.n; i++) {
        const x = -w / 2 + cw * (i + 0.5);
        m.cush.push(cushion("Seat cushion", [cw - 8, 180, D - BT - 10], [x, baseTop + 90, Z0 + BT + (D - BT) / 2 - 2]));
        m.backs.push(cushion("Back cushion", [cw - 14, cushH, 200], [x, seatTop + cushH / 2, Z0 + BT + 104]));
      }
    } else if (kind === "arm") {
      m.k.body = put(m, typeOf("Armrest", [w, armH - LEG, D]), [0, LEG + (armH - LEG) / 2, 0]);
      for (const z of [-410, 410]) leg(m, 0, z);
    } else if (kind === "chaise") {
      const block = compounds.get("block") ?? b.compound("Chaise back end", [
        { shape: "box", size: [CW, backH - LEG, BT], pos: [0, LEG + (backH - LEG) / 2, Z0 + BT / 2] },
        { shape: "box", size: [CW, seatTop - LEG, 120], pos: [0, LEG + (seatTop - LEG) / 2, Z0 + BT + 60] },
      ], { material: "soft" });
      compounds.set("block", block);
      const z1 = Z0 + BT + 120; // where the storage box starts
      const L = 1640 - BT - 120;
      const body = compounds.get("body") ?? b.compound("Chaise storage seat", [
        { shape: "box", size: [CW, 250, L], pos: [0, LEG + 125, z1 + L / 2] },
        { shape: "box", size: [CW, seatTop - LEG - 250, L], pos: [0, (LEG + 250 + seatTop) / 2, z1 + L / 2] },
      ], { material: "soft" });
      compounds.set("body", body);
      m.k.body = put(m, body.type, body.mid);
      m.k.block = put(m, block.type, block.mid);
      for (const z of [Z0 + 80, z1 + L / 2 - 120, z1 + L - 80]) for (const x of [-CW / 2 + 80, CW / 2 - 80]) leg(m, x, z);
      m.backs.push(cushion("Back cushion", [CW - 14, cushH, 200], [0, seatTop + cushH / 2, Z0 + BT + 104]));
    } else {
      // the corner: an L-shaped backrest and two base pieces in front of it
      const back = compounds.get("corner") ?? b.compound("Corner backrest", [
        { shape: "box", size: [D, backH - LEG, BT], pos: [0, LEG + (backH - LEG) / 2, Z0 + BT / 2] },
        { shape: "box", size: [BT, backH - LEG, D - BT], pos: [Z0 + BT / 2, LEG + (backH - LEG) / 2, Z0 + BT + (D - BT) / 2] },
      ], { material: "soft" });
      compounds.set("corner", back);
      m.k.back = put(m, back.type, back.mid);
      const bw = D - BT, half = bw / 2;
      const baseT = typeOf("Corner base", [bw, baseTop - LEG, half]);
      m.k.baseA = put(m, baseT, [Z0 + BT + bw / 2, LEG + (baseTop - LEG) / 2, Z0 + BT + half / 2]);
      m.k.baseB = put(m, baseT, [Z0 + BT + bw / 2, LEG + (baseTop - LEG) / 2, Z0 + BT + half * 1.5]);
      for (const [x, z] of [[-410, -410], [410, -410], [410, 410], [-410, 410]]) leg(m, x, z);
      m.cush.push(cushion("Corner seat cushion", [bw - 10, 180, bw - 10], [Z0 + BT + bw / 2, baseTop + 90, Z0 + BT + bw / 2]));
      m.backs.push(cushion("Back cushion", [bw - 200 - 4, cushH, 200], [Z0 + BT + 200 + (bw - 200) / 2 + 2, seatTop + cushH / 2, Z0 + BT + 104]));
      m.backs.push(cushion("Corner back cushion", [200, cushH, bw], [Z0 + BT + 104, seatTop + cushH / 2, Z0 + BT + bw / 2]));
    }
    return m;
  };

  // lay the modules out: a row from left to right, or a corner at the back left with a row to its right and a wing
  // coming forward from it
  // armb: an armrest on the sofa-bed; bedc: the chaise bolted to it; bedk: the sofa-bed on the corner's studs
  // open: the open end of a leather section, next to the footstool
  type J = { kind: "arm3" | "armc" | "hook" | "conn" | "armb" | "bedc" | "bedk" | "open"; a: Mod; b: Mod; s: 1 | -1 };
  const joints: J[] = [];
  const widthOf = (x: Cell) => (x === "arm" ? armW : x === "chaise" ? CW : x === "bed" ? BW : x === "corner" ? D : x === "stool" ? STOOL : x);
  const chain = (list: Cell[], start: number, yaw: Yaw, first?: Mod, o = 0) => {
    let c = start;
    let prev = first;
    for (const x of list) {
      const w = widthOf(x);
      const kind: Kind = x === "arm" ? "arm" : x === "chaise" ? "chaise" : x === "bed" ? "bed" : x === "corner" ? "corner" : x === "stool" ? "stool" : "seat";
      // along +x for a row (a corner closing it is turned to face -x); along +z for a wing: the left wing's own -x, the right wing's own +x
      const m = yaw ? mod(kind, w, o, c + w / 2, yaw) : mod(kind, w, c + w / 2, o, kind === "corner" ? 3 : 0);
      c += w;
      if (prev) {
        const out: 1 | -1 = yaw === 1 ? -1 : 1; // which side of the earlier module the new one is on, in its own frame
        const back = (-out) as 1 | -1;
        if (kind === "corner") joints.push({ kind: "hook", a: prev, b: m, s: out });
        else if (kind === "stool") joints.push({ kind: "open", a: prev, b: m, s: out });
        else
        if (prev.kind === "corner" && kind === "bed") joints.push({ kind: "bedk", a: m, b: prev, s: back });
        else if (prev.kind === "bed" && kind === "arm") joints.push({ kind: "armb", a: prev, b: m, s: out });
        else if (prev.kind === "arm" && kind === "bed") joints.push({ kind: "armb", a: m, b: prev, s: back });
        else if (prev.kind === "bed" && kind === "chaise") joints.push({ kind: "bedc", a: prev, b: m, s: out });
        else if (prev.kind === "chaise" && kind === "bed") joints.push({ kind: "bedc", a: m, b: prev, s: back });
        else if (prev.kind === "corner") joints.push({ kind: "hook", a: m, b: prev, s: back });
        else if (kind === "arm") joints.push({ kind: prev.kind === "chaise" ? "armc" : "arm3", a: prev, b: m, s: out });
        else if (prev.kind === "arm") joints.push({ kind: kind === "chaise" ? "armc" : "arm3", a: m, b: prev, s: back });
        else if (kind === "chaise") joints.push({ kind: "hook", a: prev, b: m, s: out });
        else if (prev.kind === "chaise") joints.push({ kind: "hook", a: m, b: prev, s: back });
        else joints.push({ kind: "conn", a: prev, b: m, s: out });
      }
      prev = m;
    }
  };
  let corner: Mod | undefined;
  if (lay.corner) {
    corner = mod("corner", D, 0, 0, 0);
    chain(lay.back ?? [], D / 2, 0, corner);
    chain(lay.wing ?? [], D / 2, 1, corner);
    const c2 = mods.find((m) => m.kind === "corner" && m !== corner);
    if (c2) chain(lay.wing2 ?? [], D / 2, 3, c2, c2.ox);
  } else {
    const total = row.reduce<number>((t, x) => t + widthOf(x), 0);
    chain(row, -total / 2, 0);
  }
  // centre the whole sofa on the origin
  {
    const xs: number[] = [], zs: number[] = [];
    for (const m of mods) {
      const ext = m.kind === "chaise" ? 1640 : D;
      for (const v of [W(m, [-m.w / 2, 0, Z0]), W(m, [m.w / 2, 0, Z0 + ext])]) {
        xs.push(v[0]);
        zs.push(v[2]);
      }
    }
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const shift: Vec3 = [-cx, 0, -cz];
    for (const it of b.items) if (it.kind === "part") it.final = { pos: plus(it.final.pos, shift), rot: it.final.rot };
    for (const m of mods) {
      m.ox -= cx;
      m.oz -= cz;
    }
  }

  const seats = mods.filter((m) => m.kind === "seat");
  const arms = mods.filter((m) => m.kind === "arm");
  const chaise = mods.find((m) => m.kind === "chaise");
  const alone = mods.length === 1;
  const hooked = joints.some((j) => j.kind === "hook");
  const pl = (n: number, one: string, many: string) => (n > 1 ? many : one);

  // a step, with the defaults the house voice uses
  const step = (o: { title: string; detail?: string; scene?: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] }, body: () => void = () => {}) =>
    b.step({ kind: "general", ...o, scene: o.scene ?? "main", warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  const fit = (def: HwDef, list: FitOpts[], gap = 0.08) => b.fits(def, list, gap);
  const at = (m: Mod, lp: Vec3, d: Vec3, on: string, mate?: string, hole?: false): FitOpts => ({ on, at: W(m, lp), dir: Wd(m, d), mate, hole });

  // where each module stands in its own scene while it's built: groups side by side
  const stageOff = new Map<Mod, Vec3>();
  const stageRef = new Map<Mod, Mod>();
  const place = (scene: Mod[]) => {
    let x = 0;
    const widths = scene.map((m) => m.w + 2 * armW + 300);
    const total = widths.reduce((a, w) => a + w, 0);
    scene.forEach((m, i) => {
      stageOff.set(m, [-total / 2 + x + widths[i] / 2, 0, 0]);
      stageRef.set(m, m);
      x += widths[i];
    });
  };
  const stage = (m: Mod, recs: Rec[], from?: Vec3, away: Vec3 = [0, 0, 0]) => {
    const ref = stageRef.get(m) ?? m;
    const off = plus(stageOff.get(ref) ?? [0, 0, 0], away);
    for (const r of recs) b.stage(r.key, plus(plus(rel(m, ref), r.lp), off), [0, 0, 0], from);
  };
  // in "main" a part goes straight to its place; in a scene it is staged where the module stands there
  const show = (scene: string, m: Mod, recs: Rec[], from?: Vec3) => {
    if (scene === "main") for (const r of recs) b.add(r.key, from);
    else stage(m, recs, from);
  };
  const rec = (m: Mod, key: string) => m.recs.find((r) => r.key === key)!;

  /* ---------- the sofa-bed section ---------- */
  // it stands on its own legs, so it's built where the sofa goes, unless a corner section stands there first
  const bed = mods.find((m) => m.kind === "bed");
  const bedScene = corner ? "bed" : "main";
  if (bed) {
    const m = bed, bs = bedScene, w = m.w;
    if (bs !== "main") place([m]);
    step({ title: "Cut the two ties that hold the bed folded", detail: "Stand the frame on the floor with the folded bed inside it, and throw the ties away.", scene: bs }, () => show(bs, m, [rec(m, m.k.frame)], [0, 200, 0]));
    step({ title: "Hang the front panel on its two brackets", detail: "One of you at each end. Lower it straight down until both ends sit on the brackets.", scene: bs, kind: "join", people: 2 }, () => show(bs, m, [rec(m, m.k.front)], [0, 260, 160]));
    step({ title: "Lock the front panel with the wing screw", detail: "One of you lifts the front of the bed a little; the other turns the wing screw in through the middle bracket by hand.", scene: bs, kind: "screws", people: 2, warnings: ["two", "hand"] }, () => {
      fit(WSCREW, [{ ...at(m, [0, LEG + 50, D / 2 - 48], [0, 0, 1], m.k.front, m.k.frame), travel: 70, spin: 3 }]);
    });
    step({ title: "Unfold the bed", detail: "Together: lift the seat part up and out, then swing the leg frame over and down onto the floor.", scene: bs, people: 2 });
    step({ title: "Lower the backrest onto the side plates", detail: "Fit the holes at the bottom of the backrest over the pins on both side plates and press it down.", scene: bs, kind: "join", people: 2 }, () => show(bs, m, [rec(m, m.k.back)], [0, 380, 0]));
    const bp: Vec3[] = [-1, 1].flatMap((sx) => [170, 250].map((y) => [sx * (w / 2), y, Z0 + BT / 2] as Vec3));
    step({ title: "Bolt the backrest to the side plates", detail: "Two bolts through each side plate from outside, with a flange nut inside. Hold the nut with the box spanner and tighten with the Allen key.", scene: bs, kind: "bolts", people: 2, tools: ["allen", "wrench"] }, () => {
      fit(BBOLT, bp.map((q) => ({ ...at(m, q, [-Math.sign(q[0]), 0, 0], m.k.frame, m.k.back), travel: 60 })), 0.1);
      b.then(0.1);
      fit(FNUT, bp.map((q) => ({ ...at(m, [q[0] - Math.sign(q[0]) * 60, q[1], q[2]], [Math.sign(q[0]), 0, 0], m.k.back), hole: false as const })), 0.08);
    });
    step({ title: "Hook the fabric flap over the back rail", detail: "Pull the flap at the bottom of the backrest up behind the slats and hook its edge over the rail, all the way along.", scene: bs });
    step({ title: "Screw down the two mattress holders", detail: "One at each end of the back rail, with the screwdriver.", scene: bs, kind: "screws", tools: ["screwdriver"] }, () => {
      fit(MSCREW, [-1, 1].map((sx) => at(m, [sx * (w / 2 - 160), LEG + 120, Z0 + BT + 40], [0, -1, 0], m.k.frame)), 0.15);
    });
    step({ title: "Lay the mattress on the bed", detail: "Unroll it and cut the wrapping off with care: it takes up to 72 hours to reach its full shape. Tuck its back edge under the holders.", scene: bs, people: 2 }, () => show(bs, m, [rec(m, m.k.mat)], [0, 320, 300]));
    step({ title: "Fold the bed back into the sofa", detail: "Lift the leg frame and fold the bed in, mattress and all, until it rests in the frame.", scene: bs });
    if (!lay.leather) {
      step({ title: "Tip it onto its back and cut the transport straps", detail: "Lift and tip it together. Throw the straps away.", scene: bs, pose: "+z", people: 2, warnings: ["two", "floor"] });
      step({ title: "Pull the cover down over the backrest", detail: "Stand it up first. One of you at each end: work it down evenly and press the hook strips along the top.", scene: bs, people: 2 });
      step({ title: "Fasten the cover around the frame", detail: "Pull it over the front panel and the sides, then fasten it underneath, all the way round.", scene: bs });
    }
  }

  /* ---------- the seat sections' frames ---------- */
  const secScene = alone || !hooked ? "main" : "sections";
  if (secScene !== "main") place(seats);
  const studX = (m: Mod) => (m.n === 1 ? [-m.w / 4, m.w / 4] : [0, 1, 2, 3].map((i) => -m.w / 2 + (m.w * (i + 0.5)) / 4));
  if (seats.length && lay.leather) {
    // Grann/Bomstad: the backrest and then the top board go on rods, each held by a washer and a nut
    const many = seats.length > 1;
    const yb = seatTop, yt = backH - 60;
    step({ title: many ? "Screw the rods into the seat frames" : "Screw the rods into the seat frame", detail: "Into the holes along the back of the frame's top, by hand until they stop.", scene: secScene, kind: "bolts", warnings: ["hand"] }, () => {
      b.stagger(0.2);
      for (const m of seats) show(secScene, m, [rec(m, m.k.base)], [0, 200, 0]);
      b.then(0.15);
      for (const m of seats) fit(ROD, studX(m).map((x) => ({ ...at(m, [x, yb + 70, Z0 + BT / 2], [0, -1, 0], m.k.base), travel: 140, spin: 3 })));
    });
    step({ title: many ? "Lower the backrests onto the rods" : "Lower the backrest onto the rods", detail: "Springs facing the front. Guide every rod through the bottom rail of the backrest.", scene: secScene, kind: "join" }, () => {
      b.stagger(0.3);
      for (const m of seats) show(secScene, m, [rec(m, m.k.back)], [0, 380, 0]);
    });
    step({ title: "Tighten a washer and nut onto each rod", detail: "Inside the backrest, on its bottom rail, with the box spanner.", scene: secScene, kind: "bolts", tools: ["wrench"] }, () => {
      for (const m of seats) fit(W16, studX(m).map((x) => ({ ...at(m, [x, yb + 40, Z0 + BT / 2], [0, -1, 0], m.k.back), hole: false as const })), 0.06);
      b.then(0.05);
      for (const m of seats) fit(NUT, studX(m).map((x) => ({ ...at(m, [x, yb + 46, Z0 + BT / 2], [0, -1, 0], m.k.back), hole: false as const })), 0.08);
    });
    step({ title: many ? "Screw the rods into the top boards" : "Screw the rods into the top board", detail: "Lay the board upside down and screw the rods into its underside by hand.", scene: secScene, kind: "bolts", warnings: ["hand"] }, () => {
      for (const m of seats) stage(m, [rec(m, m.k.top)], [0, 200, 0], [0, 30 - (backH - 30), 700]);
      b.then(0.15);
      for (const m of seats) fit(ROD, studX(m).map((x) => ({ ...at(m, [x, yt - 70, Z0 + BT / 2], [0, 1, 0], m.k.top), travel: 140, spin: 3 })));
    });
    step({ title: many ? "Lower the top boards onto the backrests" : "Lower the top board onto the backrest", detail: "Guide the rods down through the top rail of the backrest.", scene: secScene, kind: "join" }, () => {
      b.stagger(0.3);
      for (const m of seats) stage(m, [rec(m, m.k.top)], [0, 300, 0]);
    });
    step({ title: "Tighten a washer and nut onto each rod from below", detail: "Reach in under the top rail with the box spanner.", scene: secScene, kind: "bolts", tools: ["wrench"] }, () => {
      for (const m of seats) fit(W16, studX(m).map((x) => ({ ...at(m, [x, yt - 40, Z0 + BT / 2], [0, 1, 0], m.k.back), hole: false as const })), 0.06);
      b.then(0.05);
      for (const m of seats) fit(NUT, studX(m).map((x) => ({ ...at(m, [x, yt - 46, Z0 + BT / 2], [0, 1, 0], m.k.back), hole: false as const })), 0.08);
    });
  } else if (seats.length) {
    const many = seats.length > 1;
    step({ title: many ? "Screw the studs into the seat frames" : "Screw the studs into the seat frame", detail: "Into the holes along the back of the frame's top, by hand until they stop.", scene: secScene, kind: "bolts", warnings: ["hand"] }, () => {
      b.stagger(0.2);
      for (const m of seats) show(secScene, m, [rec(m, m.k.base)], [0, 200, 0]);
      b.then(0.15);
      for (const m of seats) fit(STUD, studX(m).map((x) => ({ ...at(m, [x, baseTop + 45, Z0 + BT / 2], [0, -1, 0], m.k.base), travel: 120, spin: 3 })));
    });
    step({ title: many ? "Lower the backrests onto the studs" : "Lower the backrest onto the studs", detail: "Springs facing the front. Guide every stud into its hole and let the backrest sit flat on the frame.", scene: secScene, kind: "join", people: seats.some((m) => m.w > 2000) ? 2 : 1 }, () => {
      b.stagger(0.3);
      for (const m of seats) show(secScene, m, [rec(m, m.k.back)], [0, 380, 0]);
    });
    step({ title: seats.length > 1 ? "Lock the backrests with the clamps" : "Lock the backrest with the clamps", detail: "Push a clamp onto each stud from the front, inside the backrest, then turn it until it locks tight.", scene: secScene, kind: "bolts", warnings: ["hand"] }, () => {
      for (const m of seats) fit(HW.clamp, studX(m).map((x) => ({ ...at(m, [x, baseTop + 40, Z0 + BT], [0, 0, -1], m.k.back), hole: false as const, travel: 90 })));
    });
  }

  /* ---------- two sections side by side: the connection fitting ---------- */
  const conns = joints.filter((j) => j.kind === "conn");
  const connLegs: { key: string; x: number; z: number }[] = [];
  for (const j of conns) {
    const xj = j.a.w / 2;
    for (const z of [-410, 410]) {
      const key = b.place(legT, W(j.a, [xj, LEG / 2, z]));
      connLegs.push({ key, x: xj, z });
    }
  }
  for (const j of conns) {
    const xj = j.a.w / 2;
    step({ title: "Hook the connectors over the two backrests", detail: "Push the sections tight together first. One connector goes over the top of the backrests at the back, the other lower down across the frames.", kind: "join", tools: [] }, () => {
      fit(HW.connector, [
        { ...at(j.a, [xj, backH - 40, Z0], [0, 0, 1], j.a.k.back, j.b.k.back), hole: false },
        { ...at(j.a, [xj, baseTop - 40, Z0], [0, 0, 1], j.a.k.base, j.b.k.base), hole: false },
      ], 0.3);
    });
    const pts: [number, number, string, string][] = [
      [LEG + 90, -350, j.a.k.base, j.b.k.base],
      [LEG + 90, 350, j.a.k.base, j.b.k.base],
      [baseTop + 120, Z0 + 90, j.a.k.back, j.b.k.back],
      [backH - 150, Z0 + 90, j.a.k.back, j.b.k.back],
    ];
    step({ title: "Bolt the sections together through the sides", detail: "A wing nut and a washer go on each stud on both sides of the join. Tighten them by hand, evenly.", kind: "bolts", warnings: ["hand"] }, () => {
      fit(CSTUD, pts.map(([y, z, on, mate]) => at(j.a, [xj, y, z], [1, 0, 0], on, mate)), 0.12);
      b.then(0.1);
      fit(W16, pts.flatMap(([y, z, on, mate]) => [{ ...at(j.a, [xj - 30, y, z], [1, 0, 0], on), hole: false as const }, { ...at(j.b, [-j.b.w / 2 + 30, y, z], [-1, 0, 0], mate), hole: false as const }]), 0.05);
      b.then(0.1);
      fit(WING, pts.flatMap(([y, z, on, mate]) => [{ ...at(j.a, [xj - 34, y, z], [1, 0, 0], on), hole: false as const }, { ...at(j.b, [-j.b.w / 2 + 34, y, z], [-1, 0, 0], mate), hole: false as const }]), 0.05);
    });
    step({ title: "Tip it onto its back and screw two legs under the join", detail: "Lift and tip it together, by the frames. The legs go into the holes where the sections meet.", pose: "+z", kind: "legs", people: 2, warnings: ["two", "hand"] }, () => {
      b.stagger(0.25);
      for (const l of connLegs) b.add(l.key, [0, -240, 0], { spin: 2 });
    });
    step({ title: "Stick a felt pad under each new leg", pose: "+z", kind: "general" }, () => {
      fit(HW.glide, connLegs.map((l) => ({ on: l.key, at: W(j.a, [l.x, 0, l.z]), dir: [0, 1, 0] as Vec3, hole: false as const })), 0.2);
    });
  }

  /* ---------- the chaise longue ---------- */
  const chScene = alone ? "main" : "chaise";
  if (chaise) {
    if (chScene !== "main") place([chaise]);
    const c = chaise;
    const body = rec(c, c.k.body), block = rec(c, c.k.block);
    step({ title: "Open the lid and lift out what's inside", detail: "The lid rises on its struts. Inside are the back end of the chaise and its cushion.", scene: chScene, kind: "general" }, () => {
      show(chScene, c, [body], [0, 160, 0]);
    });
    const bpts: Vec3[] = [[-250, 130], [250, 130], [-250, 260], [250, 260]].map(([x, y]) => [x, y, Z0 + BT + 120]);
    step({ title: "Screw four studs into the back end", detail: "Into the face that meets the storage box, by hand.", scene: chScene, kind: "bolts", warnings: ["hand"] }, () => {
      if (chScene === "main") b.add(block.key, [0, 0, -500]);
      else stage(c, [block], [0, 160, 0], [0, 0, -700]);
      b.then(0.15);
      fit(BSTUD, bpts.map((q) => ({ ...at(c, [q[0], q[1], q[2] - 35], [0, 0, 1], c.k.block, c.k.body), travel: 120 })), 0.12);
    });
    step({ title: "Lay the chaise on its side and push the back end on", detail: "Guide the studs into the holes in the end of the storage box.", scene: chScene, pose: "+x", kind: "join", warnings: ["floor"] }, () => {
      if (chScene !== "main") stage(c, [block], [0, 0, -300]);
    });
    step({ title: "Screw a wing nut onto each stud", detail: "From inside the storage box, by hand until tight.", scene: chScene, pose: "+x", kind: "bolts", warnings: ["hand"] }, () => {
      fit(WING, bpts.map((q) => ({ ...at(c, [q[0], q[1], q[2] + 40], [0, 0, -1], c.k.body), hole: false as const })), 0.12);
    });
    step({ title: "Screw in the six legs", detail: "Clockwise by hand until each one is snug.", scene: chScene, pose: "+x", kind: "legs", warnings: ["hand"] }, () => {
      b.stagger(0.2);
      show(chScene, c, c.legs, [0, -240, 0]);
    });
    step({ title: "Stick a felt pad under each leg", scene: chScene, pose: "+x" }, () => {
      fit(HW.glide, c.legs.map((l) => ({ on: l.key, at: W(c, [l.lp[0], 0, l.lp[2]]), dir: [0, 1, 0] as Vec3, hole: false as const })), 0.1);
    });
    step({ title: "Stand it up and close the lid", detail: "Lower the lid gently; the struts hold it.", scene: chScene, kind: "standup" });
  }

  /* ---------- the corner section ---------- */
  const coScene = alone ? "main" : "corner";
  const corners = mods.filter((m) => m.kind === "corner");
  if (corner && lay.leather) {
    // Grann/Bomstad: the corner comes in one piece; legs underneath, then a hook on each side for every section
    place(corners);
    const two = corners.length > 1;
    step({ title: two ? "Turn the corner sections upside down and screw in the legs" : "Turn the corner section upside down and screw in the legs", detail: "On something soft. Four legs in each, clockwise by hand until snug.", scene: coScene, pose: "-y", kind: "legs", warnings: ["hand", "floor"] }, () => {
      b.stagger(0.25);
      for (const c of corners) stage(c, [rec(c, c.k.back)], [0, 200, 0]);
      b.then(0.1);
      for (const c of corners) stage(c, c.legs, [0, -240, 0]);
    });
    step({ title: "Stick a felt pad under each leg", scene: coScene, pose: "-y" }, () => {
      for (const c of corners) fit(HW.glide, c.legs.map((l) => ({ on: l.key, at: W(c, [l.lp[0], 0, l.lp[2]]), dir: [0, 1, 0] as Vec3, hole: false as const })), 0.1);
    });
    const hk: [Vec3, Vec3][] = [
      [[D / 2, LEG + 90, -260], [-1, 0, 0]],
      [[D / 2, LEG + 90, 340], [-1, 0, 0]],
      [[-260, LEG + 90, D / 2], [0, 0, -1]],
      [[340, LEG + 90, D / 2], [0, 0, -1]],
    ];
    step({ title: "Stand it up and screw on the four hooks", detail: two ? "Two on each open side of both corners, with the Allen key. The sections hang on these." : "Two on each open side, with the Allen key. The sections hang on these.", scene: coScene, kind: "screws", tools: ["allen"] }, () => {
      for (const c of corners) fit(HW.hook, hk.map(([q, d]) => ({ ...at(c, q, d, c.k.back), hole: false as const, twist: Math.PI / 2 })), 0.12);
      b.then(0.1);
      for (const c of corners) fit(HSCREW, hk.map(([q, d]) => at(c, [q[0] + d[0] * -4, q[1] + 10, q[2] + d[2] * -4], d, c.k.back)), 0.12);
    });
  } else if (corner) {
    const c = corner;
    if (coScene !== "main") place([c]);
    const bw = D - BT;
    const spA: Vec3[] = [[Z0 + BT + bw * 0.3, LEG + 120, Z0 + BT], [Z0 + BT + bw * 0.75, LEG + 120, Z0 + BT]];
    const spB: Vec3[] = [[Z0 + BT, LEG + 120, Z0 + BT + bw * 0.62], [Z0 + BT, LEG + 120, Z0 + BT + bw * 0.88]];
    step({ title: "Screw two studs into each base piece", detail: "Into the back face of each piece, by hand.", scene: coScene, kind: "bolts", warnings: ["hand"] }, () => {
      b.stagger(0.25);
      if (coScene === "main") show(coScene, c, [rec(c, c.k.baseA), rec(c, c.k.baseB)], [0, 200, 0]);
      else {
        stage(c, [rec(c, c.k.baseA)], [0, 200, 0], [0, 0, 500]);
        stage(c, [rec(c, c.k.baseB)], [0, 200, 0], [600, 0, 300]);
      }
      b.then(0.15);
      fit(STUD, spA.map((q) => ({ ...at(c, q, [0, 0, -1], c.k.baseA, c.k.back), travel: 120 })), 0.12);
      fit(STUD, spB.map((q) => ({ ...at(c, q, [-1, 0, 0], c.k.baseB, c.k.back), travel: 120 })), 0.12);
    });
    step({ title: "Push a base piece onto the backrest and clamp it", detail: "Push a clamp onto each stud from inside the backrest and turn it until it locks.", scene: coScene, kind: "bolts" }, () => {
      show(coScene, c, [rec(c, c.k.back)], [0, 300, 0]);
      if (coScene !== "main") stage(c, [rec(c, c.k.baseA)], [0, 0, 300]);
      b.then(0.15);
      fit(HW.clamp, spA.map((q) => ({ ...at(c, [q[0], q[1], q[2] - BT + 20], [0, 0, 1], c.k.back), hole: false as const })), 0.15);
    });
    step({ title: "Push on the other base piece and clamp it", detail: "The same way, onto the other side of the backrest.", scene: coScene, kind: "bolts" }, () => {
      if (coScene !== "main") stage(c, [rec(c, c.k.baseB)], [300, 0, 0]);
      b.then(0.15);
      fit(HW.clamp, spB.map((q) => ({ ...at(c, [q[0] - BT + 20, q[1], q[2]], [1, 0, 0], c.k.back), hole: false as const })), 0.15);
    });
    step({ title: "Tip it onto its back and screw in the four legs", detail: "Clockwise by hand until each one is snug.", scene: coScene, pose: "+z", kind: "legs", warnings: ["hand", "floor"] }, () => {
      b.stagger(0.2);
      show(coScene, c, c.legs, [0, -240, 0]);
    });
    step({ title: "Stick a felt pad under each leg", scene: coScene, pose: "+z" }, () => {
      fit(HW.glide, c.legs.map((l) => ({ on: l.key, at: W(c, [l.lp[0], 0, l.lp[2]]), dir: [0, 1, 0] as Vec3, hole: false as const })), 0.1);
    });
    // the sofa-bed is bolted to the corner, so that side gets no hooks
    const bedSide = joints.some((j) => j.kind === "bedk" && j.b === c && j.a.yaw === 0);
    const hk = ([
      [[D / 2, LEG + 90, -260], [-1, 0, 0], c.k.baseA],
      [[D / 2, LEG + 90, 340], [-1, 0, 0], c.k.baseB],
      [[-260, LEG + 90, D / 2], [0, 0, -1], c.k.back],
      [[340, LEG + 90, D / 2], [0, 0, -1], c.k.baseB],
    ] as [Vec3, Vec3, string][]).filter((h) => !(bedSide && h[1][0] === -1));
    step({ title: `Stand it up and screw on the ${hk.length === 4 ? "four" : "two"} hooks`, detail: hk.length === 4 ? "Two on each open side, with the Allen key. The sections hang on these." : "On the side the section hangs on, with the Allen key.", scene: coScene, kind: "screws", tools: ["allen"] }, () => {
      fit(HW.hook, hk.map(([q, d, on]) => ({ ...at(c, q, d, on), hole: false as const, twist: Math.PI / 2 })), 0.12);
      b.then(0.1);
      fit(HSCREW, hk.map(([q, d, on]) => at(c, [q[0] + d[0] * -4, q[1] + 10, q[2] + d[2] * -4], d, on)), 0.12);
    });
  }

  /* ---------- the armrests ---------- */
  if (arms.length) {
    place(arms);
    step({ title: arms.length > 1 ? "Turn the armrests over and screw in the legs" : "Turn the armrest over and screw in the legs", detail: "Two legs in each, clockwise by hand until snug.", scene: "arms", pose: "-y", kind: "legs", warnings: ["hand", "floor"] }, () => {
      b.stagger(0.25);
      for (const m of arms) stage(m, [rec(m, m.k.body)], [0, 200, 0]);
      b.then(0.1);
      for (const m of arms) stage(m, m.legs, [0, -220, 0]);
    });
    step({ title: "Stick a felt pad under each leg", scene: "arms", pose: "-y" }, () => {
      for (const m of arms) fit(HW.glide, m.legs.map((l) => ({ on: l.key, at: W(m, [l.lp[0], 0, l.lp[2]]), dir: [0, 1, 0] as Vec3, hole: false as const })), 0.12);
    });
  }

  /* ---------- the covers ---------- */
  if (seats.length && !lay.leather) {
    step({ title: seats.length > 1 ? "Pull the covers down over the backrests" : "Pull the cover down over the backrest", detail: "One of you at each end. Work it down evenly so the seams sit on the edges.", scene: secScene, people: 2 });
    step({ title: "Fasten the cover and pull it over the seat front", detail: "Press the hook strips along the top of the backrest, then pull the cover over the front edge of the frame and fasten it underneath.", scene: secScene });
  }
  if (chaise) {
    step({ title: "Fit the cover around the storage box and the lid", detail: "With the lid open, fasten the cover inside along the top edge of the box, then pull the lid's cover over it and close the zips underneath.", scene: chScene, people: 2 });
    step({ title: "Pull the cover over the back end", detail: "Work it down over the backrest and fasten it along the bottom.", scene: chScene, people: 2 });
  }
  if (corner && !lay.leather) {
    step({ title: "Fit the cover on the corner section", detail: "The corner post first, then down over the backrest, fastening the strips as you go.", scene: coScene, people: 2 });
  }
  if (arms.length && !lay.leather) {
    step({ title: arms.length > 1 ? "Pull the covers over the armrests" : "Pull the cover over the armrest", detail: "One of you on each side. Then turn each one over and fasten the cover underneath, around the legs.", scene: "arms", people: 2 });
  }

  /* ---------- joining the modules ---------- */
  // armrest to a section: three rods screwed into the armrest, washers and nuts from inside the section
  const a3 = joints.filter((j) => j.kind === "arm3");
  const ac = joints.filter((j) => j.kind === "armc");
  const armSide = (j: J) => j.s * (j.a.w / 2);
  const rodPts = (j: J) => {
    const x = armSide(j);
    return [
      { lp: [x, LEG + 120, 380] as Vec3, on: j.a.k.base },
      { lp: [x, LEG + 120, -380] as Vec3, on: j.a.k.base },
      { lp: [x, baseTop + 110, Z0 + BT / 2] as Vec3, on: j.a.k.back },
    ];
  };
  const acPts = (j: J) => {
    const x = armSide(j);
    return {
      rod: [x, LEG + 120, 300] as Vec3,
      bolts: [[x, LEG + 120, -300], [x, seatTop - 80, 0]] as Vec3[],
    };
  };
  if (a3.length || ac.length) {
    const n3 = a3.length, nc = ac.length;
    step({ title: n3 + nc > 1 ? "Screw the rods into the armrests" : "Screw the rods into the armrest", detail: n3 && nc ? "Three into the armrest that goes on a seat section, one into the armrest for the chaise. Into the holes on the inner side, by hand." : nc ? "One into the hole low down at the front of the inner side, by hand." : "Three into the holes on the inner side, by hand until they stop.", scene: "arms", kind: "bolts", warnings: ["hand"] }, () => {
      for (const j of a3) fit(ROD, rodPts(j).map((r) => ({ ...at(j.a, r.lp, [-j.s, 0, 0] as Vec3, j.b.k.body, r.on), travel: 140, spin: 3 })), 0.1);
      for (const j of ac) fit(ROD, [{ ...at(j.a, acPts(j).rod, [-j.s, 0, 0], j.b.k.body, j.a.k.body), travel: 140, spin: 3 }]);
    });
  }
  const pushArm = (j: J, scene: string) => {
    const push: Vec3 = Wd(j.a, [j.s * 360, 0, 0]);
    if (scene === "main") for (const r of j.b.recs) b.add(r.key, push);
    else {
      stageRef.set(j.b, stageRef.get(j.a) ?? j.a);
      stage(j.b, j.b.recs, push);
    }
  };
  const nuts = (j: J) => {
    const pts = rodPts(j);
    fit(W16, pts.map((r) => ({ ...at(j.a, [r.lp[0] - j.s * 40, r.lp[1], r.lp[2]], [j.s, 0, 0], r.on), hole: false as const })), 0.06);
    b.then(0.05);
    fit(NUT, pts.map((r) => ({ ...at(j.a, [r.lp[0] - j.s * 44, r.lp[1], r.lp[2]], [j.s, 0, 0], r.on), hole: false as const })), 0.08);
  };
  const a3Scene = hooked ? "sections" : "main";
  if (a3.length) {
    step({ title: a3.length > 1 ? "Push the armrests onto the ends of the sections" : "Push the armrest onto the end of the section", detail: lay.leather ? "Guide the rods through the holes in the end of the frame." : "Slide the big washer onto the front rod first, then guide the rods through the holes in the frame.", scene: a3Scene, kind: "join" }, () => {
      b.stagger(0.3);
      for (const j of a3) pushArm(j, a3Scene);
      b.then(0.15);
      if (!lay.leather) for (const j of a3) fit(BIGW, [{ ...at(j.a, rodPts(j)[0].lp, [-j.s, 0, 0], j.b.k.body), hole: false }]);
    });
    step({ title: "Tighten a washer and nut onto each rod", detail: "From inside the section, with the box spanner. Tighten them all firmly.", scene: a3Scene, kind: "bolts", tools: ["wrench"] }, () => {
      for (const j of a3) nuts(j);
    });
  }
  // armrest to the chaise: it's stood on its back end, one rod and two connection bolts
  for (const j of ac) {
    const c = j.a;
    const q = acPts(j);
    step({ title: "Stand the chaise on its back end and push the armrest on", detail: "Slide the big washer onto the rod, then guide it through the hole in the side of the chaise.", scene: chScene, pose: "+z", kind: "join" }, () => {
      pushArm(j, chScene);
      b.then(0.15);
      fit(BIGW, [{ ...at(c, q.rod, [-j.s, 0, 0], j.b.k.body), hole: false }]);
    });
    step({ title: "Bolt the armrest on from inside the chaise", detail: "Screw a bolt head onto each of the two loose rods first. Washer on, then through the frame into the armrest, with the Allen key.", scene: chScene, pose: "+z", kind: "bolts", tools: ["allen"] }, () => {
      const host = (p: Vec3) => (p[2] < Z0 + BT + 120 ? c.k.block : c.k.body);
      fit(W24, q.bolts.map((p) => ({ ...at(c, [p[0] - j.s * 30, p[1], p[2]], [j.s, 0, 0], host(p)), hole: false as const })), 0.1);
      b.then(0.05);
      fit(CBOLT, q.bolts.map((p) => at(c, [p[0] - j.s * 32, p[1], p[2]], [j.s, 0, 0], host(p), j.b.k.body)), 0.15);
    });
    step({ title: "Tighten a washer and nut onto the rod", detail: "From inside the storage box, with the box spanner.", scene: chScene, pose: "+z", kind: "bolts", tools: ["wrench"] }, () => {
      fit(W16, [{ ...at(c, [q.rod[0] - j.s * 40, q.rod[1], q.rod[2]], [j.s, 0, 0], c.k.body), hole: false }]);
      b.then(0.05);
      fit(NUT, [{ ...at(c, [q.rod[0] - j.s * 44, q.rod[1], q.rod[2]], [j.s, 0, 0], c.k.body), hole: false }]);
    });
  }
  // the chaise's hooks, on the side a section hangs on
  const hooks = joints.filter((j) => j.kind === "hook");
  for (const j of hooks.filter((h) => h.b.kind === "chaise")) {
    const c = j.b, x = -j.s * (CW / 2);
    const hk: Vec3[] = [[x, LEG + 90, 380], [x, LEG + 90, -260]];
    step({ title: "Screw the hooks onto the side of the chaise", detail: "Lie it back down first. Two hooks and two bolt heads with washers, all with the Allen key.", scene: chScene, kind: "screws", tools: ["allen"] }, () => {
      fit(HW.hook, hk.map((p) => ({ ...at(c, p, [j.s, 0, 0], p[2] > 0 ? c.k.body : c.k.block), hole: false as const, twist: Math.PI / 2 })), 0.15);
      b.then(0.05);
      fit(HSCREW, hk.map((p) => at(c, [p[0], p[1] + 10, p[2]], [j.s, 0, 0], p[2] > 0 ? c.k.body : c.k.block)), 0.12);
      b.then(0.05);
      const hd: Vec3[] = hk.map((p) => [p[0], seatTop - 120, p[2]]);
      fit(W24, hd.map((p) => ({ ...at(c, p, [j.s, 0, 0], p[2] > 0 ? c.k.body : c.k.block), hole: false as const })), 0.1);
      fit(HEAD, hd.map((p) => at(c, p, [j.s, 0, 0], p[2] > 0 ? c.k.body : c.k.block)), 0.12);
    });
  }
  // a stud in each end of a section that hangs on a hook
  if (hooks.length && lay.leather) {
    // Grann/Bomstad: a hanging pin with a washer each side and a nut, the section stood on its other end
    const done = new Set<Mod>();
    for (const j of hooks) {
      const m = j.a, x = j.s * (m.w / 2);
      const again = done.has(m);
      done.add(m);
      step({ title: again ? "Turn it onto its other end and fit the second pin" : "Stand the section on its end and fit a hanging pin", detail: "Low down at the front of the end that meets the corner. A washer each side of the frame, then hold the nut inside with the box spanner and turn the pin tight.", scene: "sections", pose: j.s > 0 ? "+x" : "-x", kind: "bolts", tools: ["wrench"] }, () => {
        fit(PIN, [{ ...at(m, [x + j.s * 40, LEG + 90, 380], [-j.s, 0, 0], m.k.base), travel: 150, spin: 3 }]);
        fit(W30, [{ ...at(m, [x, LEG + 90, 380], [-j.s, 0, 0], m.k.base), hole: false }, { ...at(m, [x - j.s * 30, LEG + 90, 380], [j.s, 0, 0], m.k.base), hole: false }], 0.06);
        fit(NUT, [{ ...at(m, [x - j.s * 34, LEG + 90, 380], [j.s, 0, 0], m.k.base), hole: false }]);
      });
    }
  } else if (hooks.length) {
    step({ title: hooks.length > 1 ? "Screw a hanging stud into the section ends" : "Screw a hanging stud into the end of the section", detail: "Low down at the front of the end that meets the hooks. A washer each side of the frame and the wing nut inside, by hand.", scene: "sections", kind: "bolts", warnings: ["hand"] }, () => {
      for (const j of hooks) {
        const m = j.a, x = j.s * (m.w / 2);
        fit(PIN, [{ ...at(m, [x + j.s * 40, LEG + 90, 380], [-j.s, 0, 0], m.k.base), travel: 150 }]);
        fit(W30, [{ ...at(m, [x, LEG + 90, 380], [-j.s, 0, 0], m.k.base), hole: false }, { ...at(m, [x - j.s * 30, LEG + 90, 380], [j.s, 0, 0], m.k.base), hole: false }], 0.06);
        fit(WING, [{ ...at(m, [x - j.s * 34, LEG + 90, 380], [j.s, 0, 0], m.k.base), hole: false }]);
      }
    });
  }

  /* ---------- Grann/Bomstad: the open end and the footstool ---------- */
  const opens = joints.filter((j) => j.kind === "open");
  for (const j of opens) {
    const m = j.a, x = j.s * (m.w / 2), z0 = Z0 + BT / 2;
    step({ title: "Fit the top bracket to the open end", detail: "Turn the section so its back faces you. Loosen the nut at the bottom of the backrest at that end, slide the bracket in under the top board, screw it on with the Allen key, then tighten the nut again.", scene: "sections", kind: "screws", tools: ["allen", "wrench"] }, () => {
      fit(EBRK, [{ ...at(m, [x - j.s * 50, backH - 110, Z0], [0, 0, 1], m.k.back), hole: false }]);
      b.then(0.1);
      fit(CSK, [-1, 1].map((d) => at(m, [x - j.s * (50 + d * 25), backH - 110, Z0 + 4], [0, 0, 1], m.k.back)), 0.12);
    });
    step({ title: "Bolt the support to the end of the seat frame", detail: "Push it into the slot at the end of the frame. The carriage bolt goes through with a washer and nut, held with the box spanner; then one screw with the Allen key.", scene: "sections", kind: "bolts", tools: ["allen", "wrench"] }, () => {
      fit(SUPP, [{ ...at(m, [x, LEG + 160, z0 + 60], [-j.s, 0, 0], m.k.base), hole: false }]);
      b.then(0.1);
      fit(CARR, [at(m, [x + j.s * 10, LEG + 200, z0 + 60], [-j.s, 0, 0], m.k.base)]);
      fit(W16, [{ ...at(m, [x - j.s * 40, LEG + 200, z0 + 60], [j.s, 0, 0], m.k.base), hole: false }]);
      fit(NUT, [{ ...at(m, [x - j.s * 44, LEG + 200, z0 + 60], [j.s, 0, 0], m.k.base), hole: false }]);
      b.then(0.05);
      fit(CSK, [at(m, [x + j.s * 4, LEG + 100, z0 + 60], [-j.s, 0, 0], m.k.base)]);
    });
    const lz = [-410, 410];
    const kit = lz.map((z) => leg(m, x - j.s * 60, z));
    step({ title: "Fit the two leg plates and screw in the legs", detail: "Push a plate onto the bottom of the open end at the back and at the front, then screw a leg into each by hand.", scene: "sections", kind: "legs", warnings: ["hand"] }, () => {
      fit(LPLATE, lz.map((z) => ({ ...at(m, [x - j.s * 60, LEG + 3, z], [0, 1, 0], m.k.base), hole: false as const })), 0.15);
      b.then(0.1);
      stage(m, m.recs.filter((r) => kit.includes(r.key)), [0, -220, 0]);
    });
    step({ title: "Stick a felt pad under each new leg", scene: "sections" }, () => {
      fit(HW.glide, lz.map((z) => ({ on: kit[lz.indexOf(z)], at: W(m, [x - j.s * 60, 0, z]), dir: [0, 1, 0] as Vec3, hole: false as const })), 0.15);
    });
  }
  const stool = mods.find((m) => m.kind === "stool");
  if (stool) {
    const f = stool;
    place([f]);
    step({ title: "Turn the footstool upside down and screw in the legs", detail: "On something soft. Clockwise by hand until each one is snug.", scene: "stool", pose: "-y", kind: "legs", warnings: ["hand", "floor"] }, () => {
      stage(f, [rec(f, f.k.body)], [0, 200, 0]);
      b.then(0.1);
      b.stagger(0.2);
      stage(f, f.legs, [0, -220, 0]);
    });
    step({ title: "Stick a felt pad under each leg", scene: "stool", pose: "-y" }, () => {
      fit(HW.glide, f.legs.map((l) => ({ on: l.key, at: W(f, [l.lp[0], 0, l.lp[2]]), dir: [0, 1, 0] as Vec3, hole: false as const })), 0.12);
    });
    step({ title: "Stand it up and lay the lid on", detail: "The lid just rests on the box, so you can lift it off to reach inside.", scene: "stool", kind: "cushions" }, () => stage(f, [rec(f, f.k.lid)], [0, 240, 0]));
  }

  /* ---------- into place ---------- */
  if (hooked) {
    // the modules that stand on their own legs go down first; the sections are lifted onto their hooks
    const groupOf = (m: Mod) => [m, ...joints.filter((j) => (j.kind === "arm3" || j.kind === "armc") && j.a === m).map((j) => j.b)];
    const addGroup = (m: Mod, from: Vec3) => {
      for (const g of groupOf(m)) for (const r of g.recs) b.add(r.key, from);
    };
    const anchors = corners.length ? corners : [chaise!];
    step({ title: corners.length > 1 ? "Stand the two corner sections where the sofa will go" : corner ? "Stand the corner section where the sofa will go" : "Stand the chaise where the sofa will go", detail: corners.length > 1 ? "A section's width apart, both square to the wall. Leave room behind to walk round." : "Leave room behind it to walk round while you hang the sections on.", kind: "join" }, () => {
      for (const a of anchors) addGroup(a, [0, 200, 0]);
    });
    const hung = new Set<Mod>();
    // the sections with an armrest on go up first, as in the manual
    const armed = (m: Mod) => a3.some((j) => j.a === m);
    for (const m of [...seats].sort((x, y) => Number(armed(y)) - Number(armed(x)))) {
      const mine = hooks.filter((h) => h.a === m);
      if (!mine.length) continue;
      const on = mine.filter((h) => anchors.includes(h.b));
      if (!on.length) continue;
      hung.add(m);
      step({ title: on.length > 1 ? "Lift the section onto the hooks of both corners" : corner ? "Lift the section onto the corner's hooks" : "Lift the section onto the chaise's hooks", detail: "One of you at each end. Lower the stud straight down into the hook until the section hangs level.", kind: "join", people: 2 }, () => addGroup(m, [0, 280, 0]));
    }
    if (corner && chaise && !bed) {
      step({ title: "Set the chaise under the free end and hook it on", detail: "Lift the end of the section together and lower its stud into the chaise's hook.", kind: "join", people: 2 }, () => addGroup(chaise, Wd(chaise, [500, 0, 0])));
    }
    if (stool) {
      step({ title: "Set the footstool at the open end", detail: "It stands free, so you can move it or use it on its own.", kind: "join" }, () => {
        for (const r of stool.recs) b.add(r.key, [0, 200, 0]);
      });
    }
  }

  /* ---------- the sofa-bed's joins: all from inside it, with the bed unfolded ---------- */
  if (bed && !alone) {
    const m = bed;
    const inner = (j: J, lp: Vec3): Vec3 => [j.s * (m.w / 2 - 60), lp[1], lp[2]];
    const kj = joints.find((j) => j.kind === "bedk");
    if (kj) {
      const c = kj.b;
      const pts: Vec3[] = [[kj.s * (m.w / 2), LEG + 110, -150], [kj.s * (m.w / 2), LEG + 110, 300]];
      const host = (q: Vec3) => (q[2] < Z0 + BT + 400 ? c.k.baseA : c.k.baseB);
      step({ title: "Screw two studs into the side of the corner section", detail: "Into the holes low down on the side the sofa-bed goes against, by hand. Leave the same length showing on each.", kind: "bolts", warnings: ["hand"] }, () => {
        fit(BSTUD, pts.map((q) => ({ ...at(m, [q[0] + kj.s * 35, q[1], q[2]], [-kj.s, 0, 0] as Vec3, host(q)), travel: 90, spin: 3 })), 0.12);
      });
      step({ title: "Push the sofa-bed against the corner section", detail: "Unfold the bed first so you can reach inside. Guide the studs through the slots in the side plate.", kind: "join", people: 2 }, () => {
        b.stagger(0.05);
        for (const r of m.recs) b.add(r.key, Wd(m, [-kj.s * 500, 0, 0]));
      });
      step({ title: "Screw a wing knob onto each stud", detail: "From inside the sofa-bed, by hand until the two sections are pulled tight together.", kind: "bolts", warnings: ["hand"] }, () => {
        fit(WING, pts.map((q) => ({ ...at(m, inner(kj, q), [-kj.s, 0, 0], m.k.frame), hole: false as const })), 0.12);
      });
    } else if (bedScene !== "main") {
      step({ title: "Stand the sofa-bed where the sofa will go", kind: "join", people: 2 }, () => {
        for (const r of m.recs) b.add(r.key, [0, 200, 0]);
      });
    }
    // an armrest: three rods with a wing knob on each, through the sofa-bed's side plate into the armrest
    const armbs = joints.filter((j) => j.kind === "armb");
    if (armbs.length) {
      step({ title: "Screw a wing knob onto the end of each rod", detail: armbs.length > 1 ? "Six rods, three for each armrest. Turn the knob on until it stops." : "Three rods. Turn the knob on until it stops.", kind: "bolts", warnings: ["hand"] });
      for (const j of armbs) {
        const rp: Vec3[] = [[j.s * (m.w / 2), LEG + 110, 330], [j.s * (m.w / 2), LEG + 110, -200], [j.s * (m.w / 2), baseTop - 60, -200]];
        step({ title: "Push an armrest against the end of the sofa-bed", detail: "Unfold the bed first. Line the holes in the armrest up with the ones in the side plate.", kind: "join" }, () => pushArm(j, "main"));
        step({ title: "Fix the armrest with the three rods", detail: "From inside the sofa-bed: one through the front hole, then two through the back, into the armrest. Tighten the knobs by hand, then fold the bed back in.", kind: "bolts", warnings: ["hand"] }, () => {
          fit(ROD, rp.map((q) => ({ ...at(m, q, [j.s, 0, 0], j.b.k.body, m.k.frame), travel: 160, spin: 3 })), 0.15);
          b.then(0.05);
          fit(WING, rp.map((q) => ({ ...at(m, inner(j, q), [j.s, 0, 0], m.k.frame), hole: false as const })), 0.1);
        });
      }
    }
    // the chaise: two bolts from inside its storage box, a wing knob on each inside the sofa-bed
    for (const j of joints.filter((x) => x.kind === "bedc")) {
      const c = j.b;
      const grp = [c, ...joints.filter((x) => x.kind === "armc" && x.a === c).map((x) => x.b)];
      const bq: Vec3[] = [[j.s * (m.w / 2), LEG + 110, -60], [j.s * (m.w / 2), LEG + 110, 300]];
      step({ title: "Push the chaise longue against the sofa-bed", detail: "Open its lid and unfold the bed so you can reach inside both.", kind: "join", people: 2 }, () => {
        b.stagger(0.05);
        for (const g of grp) for (const r of g.recs) b.add(r.key, Wd(m, [j.s * 600, 0, 0]));
      });
      step({ title: "Bolt the chaise to the sofa-bed", detail: "Screw a bolt head onto each stud first. From inside the storage box, a washer on, then through into the sofa-bed with the Allen key; a wing knob goes on each inside the sofa-bed.", kind: "bolts", tools: ["allen"] }, () => {
        fit(W24, bq.map((q) => ({ ...at(m, [q[0] + j.s * 34, q[1], q[2]], [-j.s, 0, 0], c.k.body), hole: false as const })), 0.1);
        b.then(0.05);
        fit(SBOLT, bq.map((q) => at(m, [q[0] + j.s * 36, q[1], q[2]], [-j.s, 0, 0], c.k.body, m.k.frame)), 0.15);
        b.then(0.05);
        fit(WING, bq.map((q) => ({ ...at(m, inner(j, q), [j.s, 0, 0], m.k.frame), hole: false as const })), 0.1);
      });
    }
    step({ title: chaise ? "Fold the bed back in and close the lid" : "Fold the bed back in", detail: "Check the bed folds out and back in freely before you put the cushions on.", kind: "general" });
  }

  /* ---------- cushions ---------- */
  const cush = mods.flatMap((m) => m.cush);
  const backs = mods.flatMap((m) => m.backs);
  if (cush.length) {
    const zip = lay.leather ? { title: "Lay the seat cushions on the seat", detail: "Zips face the back." } : { title: cush.length > 1 ? "Zip the covers onto the seat cushions and lay them in" : "Zip the cover onto the seat cushion and lay it in", detail: "Fold the cushion to get it in, then smooth the cover over it. Zips face the back." };
    step({ ...zip, kind: "cushions" }, () => {
      b.stagger(0.18);
      for (const k of cush) b.add(k, [0, 320, 0]);
    });
  }
  step({ title: backs.length > 1 ? "Fill the back cushions and stand them in place" : "Fill the back cushion and stand it in place", detail: "Push the filling into the corners of each cover, zip it closed, then lean it on the backrest.", kind: "cushions" }, () => {
    b.stagger(0.18);
    for (const k of backs) b.add(k, [0, 160, 360]);
  });
  if (lay.mirror) mirror(b);
  return true;
}

/** Mirrors the whole guide left to right: a corner sofa drawn with its corner on the left gets it on the right. */
function mirror(b: PlanBuilder) {
  const fx = (v: Vec3): Vec3 => [-v[0], v[1], v[2]];
  const fr = (r: Vec3): Vec3 => [r[0], -r[1], -r[2]];
  for (const p of b.parts) for (const pc of p.pieces ?? []) {
    pc.pos = fx(pc.pos);
    if (pc.rot) pc.rot = fr(pc.rot);
  }
  for (const it of b.items) {
    if (it.kind === "part") {
      it.final = { pos: fx(it.final.pos), rot: fr(it.final.rot) };
      for (const st of it.states) {
        st.pos = fx(st.pos);
        st.rot = fr(st.rot);
        if (st.from) st.from = fx(st.from);
      }
      for (const h of it.holes) {
        h.p = fx(h.p);
        h.n = fx(h.n);
      }
    } else {
      it.pos = fx(it.pos);
      it.dir = fx(it.dir);
      if (it.twist) it.twist = -it.twist;
    }
  }
  for (const st of b.steps) st.pose = st.pose === "+x" ? "-x" : st.pose === "-x" ? "+x" : st.pose;
}

const family: Family = { names: ["VIMLE"], build };
export default family;
