import type { Family } from "./family";
import type { Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";

/**
 * MORABO, from IKEA's manuals. Every sofa frame comes upholstered in one piece with its armrests on; the armrests
 * are held by four bolts with nuts from inside the frame, so they come off. A sofa only gets its legs: each leg has
 * a sleeve pulled over its top and its washer put back, and goes into a corner of the frame with the frame on its
 * back. A chaise is bolted to the open end of a frame (four bolts, washers and nuts) after that end's armrest comes
 * off, gets its own four legs, and the armrest goes back on at its outer end. A corner sectional has a corner on
 * four legs with three U brackets on each open side; each section has legs only at its armrest end, gets a pin in
 * the top of its other end and is lifted into the brackets. Seat and back cushions go in last.
 * The sleeper sofa is built lying on its back from loose pieces: the backrest between the armrests on rods, a rail
 * front and back, a slatted seat dropped in, the legs in the armrests; a bed box on castors slides in under the seat.
 */

type Kind = "seat" | "arm" | "chaise" | "corner";
type Cell = number | "arm" | "chaise";
interface Rec {
  key: string;
  lp: Vec3; // centre in the module's own frame
}
interface Mod {
  kind: Kind;
  w: number;
  ox: number;
  oz: number;
  yaw: 0 | 1; // 1: turned a quarter, its front facing +x (the wing coming forward from the corner)
  ex: boolean; // not in the box (the sofa an add-on chaise goes onto)
  frame: string;
  recs: Rec[]; // frame, armrest, legs and sleeves
  legs: Rec[];
  sleeves: Rec[];
  cush: string[];
  backs: string[];
}
interface Layout {
  row?: Cell[]; // a sofa, left to right
  back?: Cell[]; // to the right of the corner at the back left
  wing?: Cell[]; // coming forward from that corner
  addon?: boolean; // only the chaise is in the box: the sofa it goes onto is shown as the owner's own
}

const D = 920, Z0 = -460, BT = 180, LEG = 160, BASE = 350, SEAT = 470, BACK = 670, TOP = 810;
const ARM = 130, CW = 780, CL = 1580, K = 920, SLV = 80;
const BY = (LEG + BACK) / 2, BH = BACK - LEG; // armrests and backrests run from the frame's bottom to its top

const LEGW: HwDef = { kind: "washer", len: 2, dia: 40 };
const BOLT: HwDef = { kind: "bolt", len: 100, dia: 8, name: "Carriage bolt" };
const WASH: HwDef = { kind: "washer", len: 1.6, dia: 20 };
const NUT: HwDef = { kind: "nut", len: 6.5, dia: 8 };
const BRK: HwDef = { kind: "hook", len: 60, dia: 40, name: "U bracket" };
const CSK: HwDef = { kind: "bolt", len: 30, dia: 6 };
const PIN: HwDef = { kind: "stud", len: 100, dia: 12, name: "Hanging pin" };

const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const W = (m: Mod, v: Vec3): Vec3 => (m.yaw ? [m.ox + v[2], v[1], m.oz - v[0]] : [m.ox + v[0], v[1], m.oz + v[2]]);
const Wd = (m: Mod, d: Vec3): Vec3 => (m.yaw ? [d[2], d[1], -d[0]] : d);
const rotOf = (m: Mod): Vec3 => [0, m.yaw ? Math.PI / 2 : 0, 0];
// where a module sits in another one's frame (modules joined in a line share a yaw)
const rel = (m: Mod, a: Mod): Vec3 => {
  const dx = m.ox - a.ox, dz = m.oz - a.oz;
  return a.yaw ? [-dz, 0, dx] : [dx, 0, dz];
};
const depthOf = (m: Mod) => (m.kind === "chaise" ? CL : D);

/** What the product is made of, from its name: null for the sleeper sofa, which sleeper() draws. */
function layout(s: ProductSpec): Layout | null {
  const v = s.variant.toLowerCase();
  if (/sleeper|bed/.test(v)) return null;
  if (/^armchair/.test(v)) return { row: ["arm", 650, "arm"] };
  if (/^loveseat/.test(v)) return { row: ["arm", 1400, "arm"] };
  if (/^sofa with chaise/.test(v)) return { row: ["arm", 1400, "chaise", "arm"] };
  if (/^sectional, 4-seat/.test(v)) return { row: ["arm", 1800, "chaise", "arm"] };
  if (/^5-seat sofa with chaises/.test(v)) return { row: ["arm", "chaise", "chaise", 1800, "arm"] };
  if (/^chaise, add-on/.test(v)) return { row: ["arm", 1400, "chaise", "arm"], addon: true };
  if (/5-seat corner/.test(v)) return { back: [1800, "arm"], wing: [1400, "arm"] };
  if (/6-seat crn/.test(v)) return { back: [1800, "chaise", "arm"], wing: [1400, "arm"] };
  return null;
}

/** The sleeper sofa (its own manual): a frame built lying on its back, and a pull-out bed box on castors. */
function sleeper(b: PlanBuilder, s: ProductSpec): boolean {
  const w = s.size.w * 10, aw = ARM, iw = w - 2 * aw; // 225 cm: two 13 cm armrests and 199 cm between them
  const ax = iw / 2 + aw / 2, deck = 300, front = -Z0;
  const part = (name: string, size: Vec3, o: { shape?: "cyl"; material?: "soft" | "wood" | "metal" } = {}) => b.part(name, size, { material: o.material ?? "soft", shape: o.shape });
  const back = b.place(part("Backrest", [iw, BH, BT]), [0, BY, Z0 + BT / 2]);
  const armT = part("Armrest", [aw, BH, D]);
  const arms = [-1, 1].map((e) => b.place(armT, [e * ax, BY, 0]));
  const railT = part("Rail", [iw, 40, 40], { material: "metal" });
  const rails = [Z0 + BT + 20, front - 40].map((z) => b.place(railT, [0, deck - 20, z]));
  const slats = b.place(part("Slatted seat", [iw, 30, D - BT - 80], { material: "wood" }), [0, deck + 15, Z0 + BT + (D - BT) / 2]);
  const seatC = b.place(part("Seat cushion", [iw - 6, SEAT - deck - 30, D - BT]), [0, (deck + 30 + SEAT) / 2, Z0 + BT + (D - BT) / 2]);
  const legT = part("Leg", [50, LEG, 50], { shape: "cyl", material: "wood" }), slvT = part("Leg sleeve", [56, SLV, 56], { shape: "cyl" });
  const lp = [-1, 1].flatMap((e) => [Z0 + 70, front - 70].map((z) => [e * ax, z] as [number, number]));
  const legs = lp.map(([x, z]) => b.place(legT, [x, LEG / 2, z]));
  const sleeves = lp.map(([x, z]) => b.place(slvT, [x, LEG - SLV / 2, z]));
  const bz = (Z0 + BT + 10 + front) / 2, bl = front - Z0 - BT - 10;
  const box = b.place(part("Bed box", [iw - 20, 200, bl]), [0, 150, bz]);
  const top = b.place(part("Slatted bed top", [iw - 40, 20, bl - 40], { material: "wood" }), [0, 260, bz]);
  const cw = iw / 2;
  const backs = [-1, 1].map((e) => b.place(part("Back cushion", [cw - 8, TOP - SEAT, 120]), [(e * cw) / 2, (SEAT + TOP) / 2, Z0 + BT + 62]));

  const step = (o: { title: string; detail?: string; scene?: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] }, body: () => void = () => {}) =>
    b.step({ kind: "general", ...o, scene: o.scene ?? "main", warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  const fit = (def: HwDef, list: FitOpts[], gap = 0.08) => b.fits(def, list, gap);
  const ROD: HwDef = { kind: "stud", len: 110, dia: 8, name: "Threaded rod" };
  const RSCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
  const BSCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
  const WSCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
  const CSCREW: HwDef = { kind: "screw", len: 10, dia: 6 };
  const RBOLT: HwDef = { kind: "bolt", len: 16, dia: 6 };
  const BLOCK: HwDef = { kind: "clip", len: 40, dia: 25, name: "Spacer block" };
  const CATCH: HwDef = { kind: "clip", len: 25, dia: 20, name: "Catch" };
  const WHEEL: HwDef = { kind: "castor", len: 40, dia: 40, name: "Guide wheel" };
  const CASTOR: HwDef = { kind: "castor", len: 60, dia: 50 };

  // the rods: two at each end of the backrest, into the armrests
  const rp: Vec3[] = [-1, 1].flatMap((e) => [LEG + 120, BACK - 120].map((y) => [e * (iw / 2), y, Z0 + BT / 2] as Vec3));
  const sg = (q: Vec3) => Math.sign(q[0]);
  step({ title: "Lay the backrest down and screw in the four rods", detail: "Padded side up, on a rug or the flattened box. Two rods into each end, by hand until they stop.", pose: "+z", kind: "bolts", warnings: ["floor", "hand"] }, () => {
    b.add(back, [0, 200, 0]);
    b.then(0.15);
    fit(ROD, rp.map((q) => ({ on: back, at: [q[0] + sg(q) * 40, q[1], q[2]] as Vec3, dir: [-sg(q), 0, 0] as Vec3, travel: 110, spin: 3 })), 0.1);
  });
  step({ title: "Push the armrests onto the rods", detail: "One of you at each end. Stand each armrest on its back end and guide the rods through its holes.", pose: "+z", kind: "join", people: 2 }, () => {
    b.stagger(0.3);
    arms.forEach((a, i) => b.add(a, [(i ? 1 : -1) * 400, 0, 0]));
  });
  step({ title: "Tighten a washer and nut onto each rod", detail: "From inside the armrests, with the box spanner.", pose: "+z", kind: "bolts", tools: ["wrench"] }, () => {
    fit(WASH, rp.map((q) => ({ on: arms[q[0] > 0 ? 1 : 0], at: [q[0] + sg(q) * 40, q[1], q[2]] as Vec3, dir: [-sg(q), 0, 0] as Vec3, hole: false as const })), 0.05);
    b.then(0.05);
    fit(NUT, rp.map((q) => ({ on: arms[q[0] > 0 ? 1 : 0], at: [q[0] + sg(q) * 44, q[1], q[2]] as Vec3, dir: [-sg(q), 0, 0] as Vec3, hole: false as const })), 0.08);
  });
  step({ title: "Lay the back rail against the backrest", detail: "Between the armrests, with its flange facing the front and its holes lined up.", pose: "+z", kind: "join" }, () => b.add(rails[0], [0, 0, 300]));
  step({ title: "Screw the back rail on", detail: "Eight screws, with the screwdriver.", pose: "+z", kind: "screws", tools: ["screwdriver"] }, () => {
    fit(RSCREW, Array.from({ length: 8 }, (_, i) => ({ on: rails[0], mate: back, at: [-iw / 2 + 120 + ((iw - 240) * i) / 7, deck - 20, Z0 + BT + 40] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.06);
  });
  step({ title: "Screw the spacer blocks to the armrests", detail: "Two on the inner side of each armrest, at the front, two screws each.", pose: "+z", kind: "screws", tools: ["screwdriver"] }, () => {
    const bp: Vec3[] = [-1, 1].flatMap((e) => [deck - 80, deck + 60].map((y) => [e * (iw / 2), y, front - 60] as Vec3));
    fit(BLOCK, bp.map((q) => ({ on: arms[q[0] > 0 ? 1 : 0], at: q, dir: [sg(q), 0, 0] as Vec3, hole: false as const })), 0.1);
    b.then(0.1);
    fit(BSCREW, bp.flatMap((q) => [-12, 12].map((dz) => ({ on: arms[q[0] > 0 ? 1 : 0], at: [q[0] - sg(q) * 20, q[1], q[2] + dz] as Vec3, dir: [sg(q), 0, 0] as Vec3 }))), 0.06);
  });
  step({ title: "Screw a guide wheel inside each armrest", detail: "Low down at the front, two screws each. The bed box runs on these.", pose: "+z", kind: "screws", tools: ["screwdriver"] }, () => {
    const wp: Vec3[] = [-1, 1].map((e) => [e * (iw / 2), LEG + 40, front - 140]);
    fit(WHEEL, wp.map((q) => ({ on: arms[q[0] > 0 ? 1 : 0], at: q, dir: [sg(q), 0, 0] as Vec3, hole: false as const })), 0.15);
    b.then(0.1);
    fit(WSCREW, wp.flatMap((q) => [-15, 15].map((dz) => ({ on: arms[q[0] > 0 ? 1 : 0], at: [q[0] - sg(q) * 10, q[1] - 15, q[2] + dz] as Vec3, dir: [sg(q), 0, 0] as Vec3 }))), 0.06);
  });
  const fb: Vec3[] = [-1, 1].flatMap((e) => [-12, 12].map((dz) => [e * (iw / 2 - 10), deck - 20, front - 40 + dz] as Vec3));
  step({ title: "Hang the front rail on the armrests", detail: "Screw the four bolts part way into the armrests first. Together, hook the rail's slots over them, then tighten them with the Allen key.", pose: "+z", kind: "bolts", people: 2, tools: ["allen"] }, () => {
    fit(RBOLT, fb.map((q) => ({ on: arms[q[0] > 0 ? 1 : 0], mate: rails[1], at: q, dir: [sg(q), 0, 0] as Vec3 })), 0.08);
    b.then(0.15);
    b.add(rails[1], [0, 0, 300]);
  });
  step({ title: "Fit a sleeve on each leg", detail: "Lift the washer off each leg's bolt, push the sleeve down over the top of the leg, then put the washer back on.", scene: "legs", kind: "legs" }, () => {
    b.stagger(0.05);
    legs.forEach((l, i) => b.stage(l, [(i - 1.5) * 170, LEG / 2, 0], [0, 0, 0]));
    b.then(0.1);
    b.stagger(0.12);
    sleeves.forEach((sl, i) => b.stage(sl, [(i - 1.5) * 170, LEG - SLV / 2, 0], [0, 0, 0], [0, 220, 0]));
    b.then(0.1);
    fit(LEGW, legs.map((l, i) => ({ on: l, at: [lp[i][0], LEG + 1, lp[i][1]] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const })), 0.05);
  });
  step({ title: "Screw the four legs into the armrests", detail: "Into the holes at the bottom of each armrest, clockwise by hand until snug.", pose: "+z", kind: "legs", warnings: ["hand"] }, () => {
    legs.forEach((l, i) => {
      b.stagger(0);
      b.add(l, [0, -240, 0], { spin: 2 });
      b.add(sleeves[i], [0, -240, 0]);
      b.wait(0.18);
    });
  });
  step({ title: "Screw the four catches onto the rails", detail: "Two on each rail, open side facing in. One screw each.", pose: "+z", kind: "screws", tools: ["screwdriver"] }, () => {
    const cp: Vec3[] = [0, 1].flatMap((r) => [-1, 1].map((e) => [e * (iw / 2 - 250), deck, r ? front - 40 : Z0 + BT + 40] as Vec3));
    fit(CATCH, cp.map((q, i) => ({ on: rails[i < 2 ? 0 : 1], at: q, dir: [0, -1, 0] as Vec3, hole: false as const })), 0.1);
    b.then(0.1);
    fit(CSCREW, cp.map((q, i) => ({ on: rails[i < 2 ? 0 : 1], at: [q[0], q[1] + 4, q[2]] as Vec3, dir: [0, -1, 0] as Vec3 })), 0.08);
  });
  step({ title: "Lower the slatted seat into the frame", detail: "Together, between the armrests. Press it down until its clips snap into the catches, both ends.", pose: "+z", kind: "join", people: 2 }, () => b.add(slats, [0, 0, 300]));
  step({ title: "Stand the sofa up and fold the seat cushion over", detail: "Lift it together by the frame, never by the legs. Lay the seat cushion on the slats.", kind: "standup", people: 2 }, () => b.add(seatC, [0, 260, 200]));
  step({ title: "Turn the bed box upside down", detail: "Together, on something soft.", scene: "bed", pose: "-y", people: 2, warnings: ["two", "floor"] }, () => b.stage(box, [0, 150, 0], [0, 0, 0], [0, 200, 0]));
  const cp5: Vec3[] = [[-iw / 2 + 120, 0, -bl / 2 + 100], [iw / 2 - 120, 0, -bl / 2 + 100], [-iw / 2 + 120, 0, bl / 2 - 100], [iw / 2 - 120, 0, bl / 2 - 100], [0, 0, 0]].map(([x, , z]) => [x, 50, bz + z] as Vec3);
  step({ title: "Screw on the five castors", detail: "One at each corner and one in the middle, two screws each.", scene: "bed", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () => {
    fit(CASTOR, cp5.map((q) => ({ on: box, at: q, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.12);
    b.then(0.1);
    fit(BSCREW, cp5.flatMap((q) => [-18, 18].map((dx) => ({ on: box, at: [q[0] + dx, q[1] + 2, q[2]] as Vec3, dir: [0, 1, 0] as Vec3 }))), 0.05);
  });
  const ew: Vec3[] = [-1, 1].map((e) => [e * (iw / 2 - 10), 200, Z0 + BT + 60]);
  step({ title: "Screw a guide wheel onto each end at the back", detail: "Two screws each. Then turn the box the right way up.", scene: "bed", kind: "screws", tools: ["screwdriver"] }, () => {
    fit(WHEEL, ew.map((q) => ({ on: box, at: q, dir: [-sg(q), 0, 0] as Vec3, hole: false as const })), 0.15);
    b.then(0.1);
    fit(BSCREW, ew.flatMap((q) => [-15, 15].map((dz) => ({ on: box, at: [q[0] + sg(q) * 4, q[1], q[2] + dz] as Vec3, dir: [-sg(q), 0, 0] as Vec3 }))), 0.06);
  });
  step({ title: "Cut the ties and lift the slatted top", detail: "It rises on its hinges at the back.", scene: "bed" }, () => b.stage(top, [0, 260, 0], [0, 0, 0], [0, 200, 0]));
  step({ title: "Fasten the fabric under the top", detail: "Pull it tight over the slats and fasten its two straps, then lower the top again.", scene: "bed" });
  step({ title: "Slide the bed box in under the seat", detail: "One of you lifts the front of the sofa a little while the other pushes the box in, back first, on its wheels.", kind: "join", people: 2 }, () => {
    b.stagger(0);
    b.add(box, [0, 0, 900]);
    b.add(top, [0, 0, 900]);
  });
  step({ title: "Hang the back cushions on the backrest", detail: "Cut off the two tags first. The hook strips on the back of each cushion hold it on the backrest.", kind: "cushions" }, () => {
    b.stagger(0.2);
    for (const k of backs) b.add(k, [0, 160, 360]);
  });
  return true;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (/sleeper/i.test(s.variant)) return sleeper(b, s);
  const lay = layout(s);
  if (!lay) return false;
  const addon = !!lay.addon;

  /* ---------- where the modules go ---------- */
  const mods: Mod[] = [];
  const mk = (kind: Kind, w: number, ox: number, oz: number, yaw: 0 | 1, ex = false): Mod => {
    const m: Mod = { kind, w, ox, oz, yaw, ex, frame: "", recs: [], legs: [], sleeves: [], cush: [], backs: [] };
    mods.push(m);
    return m;
  };
  const widthOf = (c: Cell) => (c === "arm" ? ARM : c === "chaise" ? CW : c);
  const kindOf = (c: Cell): Kind => (c === "arm" ? "arm" : c === "chaise" ? "chaise" : "seat");
  const lines: Mod[][] = []; // each from the corner (or the left) outwards
  let corner: Mod | undefined;
  if (lay.row) {
    const total = lay.row.reduce<number>((t, c) => t + widthOf(c), 0);
    let x = -total / 2;
    lines.push(
      lay.row.map((c) => {
        const w = widthOf(c);
        const m = mk(kindOf(c), w, x + w / 2, 0, 0, addon && c !== "chaise");
        x += w;
        return m;
      }),
    );
  } else {
    corner = mk("corner", K, 0, 0, 0);
    let x = K / 2;
    lines.push(
      (lay.back ?? []).map((c) => {
        const w = widthOf(c);
        const m = mk(kindOf(c), w, x + w / 2, 0, 0);
        x += w;
        return m;
      }),
    );
    let z = K / 2;
    lines.push(
      (lay.wing ?? []).map((c) => {
        const w = widthOf(c);
        const m = mk(kindOf(c), w, 0, z + w / 2, 1);
        z += w;
        return m;
      }),
    );
  }
  // centre the whole sofa on the origin
  {
    const xs: number[] = [], zs: number[] = [];
    for (const m of mods)
      for (const v of [W(m, [-m.w / 2, 0, Z0]), W(m, [m.w / 2, 0, Z0 + depthOf(m)])]) {
        xs.push(v[0]);
        zs.push(v[2]);
      }
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    for (const m of mods) {
      m.ox -= cx;
      m.oz -= cz;
    }
  }

  /* ---------- the parts ---------- */
  const types = new Map<string, string>();
  const box = (name: string, size: Vec3, ex: boolean, o: { shape?: "cyl"; material?: "soft" | "wood" } = {}) => {
    const id = `${name}|${size.map(Math.round).join("x")}|${o.shape ?? ""}|${ex}`;
    if (!types.has(id)) types.set(id, b.part(name, size, { material: o.material ?? "soft", shape: o.shape, extra: ex || undefined }));
    return types.get(id)!;
  };
  const shells = new Map<string, { type: string; mid: Vec3 }>();
  const shell = (name: string, w: number, depth: number, ex: boolean) => {
    const id = `${name}|${w}|${ex}`;
    if (!shells.has(id))
      shells.set(
        id,
        b.compound(name, [
          { shape: "box", size: [w, BH, BT], pos: [0, BY, Z0 + BT / 2] },
          { shape: "box", size: [w, BASE - LEG, depth - BT], pos: [0, (LEG + BASE) / 2, Z0 + BT + (depth - BT) / 2] },
        ], { material: "soft", extra: ex || undefined }),
      );
    return shells.get(id)!;
  };
  const put = (m: Mod, ref: string, lp: Vec3, list: Rec[] = m.recs) => {
    const key = b.place(ref, W(m, lp), rotOf(m));
    list.push({ key, lp });
    return key;
  };
  const leg = (m: Mod, x: number, z: number) => {
    const l = put(m, box("Leg", [50, LEG, 50], m.ex, { shape: "cyl", material: "wood" }), [x, LEG / 2, z], m.legs);
    const sl = put(m, box("Leg sleeve", [56, SLV, 56], m.ex, { shape: "cyl" }), [x, LEG - SLV / 2, z], m.sleeves);
    m.recs.push(m.legs[m.legs.length - 1], m.sleeves[m.sleeves.length - 1]);
    return [l, sl];
  };
  const cushions = (m: Mod, n: number, x0: number, w: number) => {
    const cw = w / n;
    for (let i = 0; i < n; i++) {
      const x = x0 + cw * (i + 0.5);
      m.cush.push(b.place(box(m.kind === "chaise" ? "Chaise seat cushion" : "Seat cushion", [cw - 6, SEAT - BASE, (m.kind === "chaise" ? CL : D) - BT - 136], m.ex), W(m, [x, (BASE + SEAT) / 2, Z0 + BT + 130 + ((m.kind === "chaise" ? CL : D) - BT - 130) / 2 - 2]), rotOf(m)));
      m.backs.push(b.place(box("Back cushion", [cw - 8, TOP - SEAT, 126], m.ex), W(m, [x, (SEAT + TOP) / 2, Z0 + BT + 65]), rotOf(m)));
    }
  };
  const seatName = (w: number) => (corner ? (w > 1600 ? "3-seat section" : "2-seat section") : addon ? "Your sofa" : w < 1000 ? "Armchair frame" : w < 1600 ? "Loveseat frame" : "Sofa frame");

  for (const line of lines)
    for (const m of line) {
      if (m.kind === "seat") {
        const sh = shell(seatName(m.w), m.w, D, m.ex);
        m.frame = put(m, sh.type, sh.mid);
        cushions(m, m.w < 1000 ? 1 : 2, -m.w / 2, m.w);
      } else if (m.kind === "arm") {
        m.frame = put(m, box("Armrest", [ARM, BH, D], m.ex), [0, BY, 0]);
      } else {
        const sh = shell("Chaise frame", CW, CL, false);
        m.frame = put(m, sh.type, sh.mid);
        cushions(m, 1, -CW / 2, CW);
        for (const z of [Z0 + 60, Z0 + CL - 80]) for (const x of [-CW / 2 + 60, CW / 2 - 60]) leg(m, x, z);
      }
    }
  if (corner) {
    const c = corner, bw = K - BT;
    const sh = shells.get("corner") ?? b.compound("Corner section", [
      { shape: "box", size: [K, BH, BT], pos: [0, BY, Z0 + BT / 2] },
      { shape: "box", size: [BT, BH, bw], pos: [Z0 + BT / 2, BY, Z0 + BT + bw / 2] },
      { shape: "box", size: [bw, BASE - LEG, bw], pos: [Z0 + BT + bw / 2, (LEG + BASE) / 2, Z0 + BT + bw / 2] },
    ], { material: "soft" });
    c.frame = put(c, sh.type, sh.mid);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) leg(c, x * (K / 2 - 60), z * (K / 2 - 60));
    const inner = Z0 + BT + 130, sw = K / 2 - inner;
    c.cush.push(b.place(box("Corner seat cushion", [sw - 6, SEAT - BASE, sw - 6], false), W(c, [inner + sw / 2, (BASE + SEAT) / 2, inner + sw / 2]), rotOf(c)));
    c.backs.push(b.place(box("Corner back cushion", [K / 2 - Z0 - BT - 4, TOP - SEAT, 126], false), W(c, [(Z0 + BT + K / 2) / 2, (SEAT + TOP) / 2, Z0 + BT + 65]), rotOf(c)));
    c.backs.push(b.place(box("Corner back cushion", [126, TOP - SEAT, sw - 4], false), W(c, [Z0 + BT + 65, (SEAT + TOP) / 2, inner + sw / 2]), rotOf(c)));
  }

  // each line's seat section, its chaises (nearest first) and its armrests; an armrest beyond a chaise starts on
  // the section's end and moves out to the chaise's
  const side = (m: Mod, seat: Mod) => (rel(m, seat)[0] > 0 ? 1 : -1) as 1 | -1;
  const info = lines.map((line) => {
    const seat = line.find((m) => m.kind === "seat")!;
    const chaises = line.filter((m) => m.kind === "chaise").sort((a, c) => Math.abs(rel(a, seat)[0]) - Math.abs(rel(c, seat)[0]));
    const arms = line.filter((m) => m.kind === "arm");
    const moving = arms.filter((a) => chaises.some((c) => side(c, seat) === side(a, seat)));
    // in a corner set the section's legs are only at its armrest end; the corner holds the other end
    const ends = corner ? [side(arms[0], seat)] : [-1, 1];
    for (const e of ends) for (const z of [Z0 + 60, Z0 + D - 60]) leg(seat, e * (seat.w / 2 - 40), z);
    return { line, seat, chaises, arms, moving };
  });

  /* ---------- scenes ---------- */
  const offs = new Map<Mod, { ref: Mod; off: Vec3 }>();
  const layOut = (groups: { ref: Mod; mods: Mod[] }[]) => {
    const ext = groups.map((g) => {
      const xs = g.mods.flatMap((m) => [rel(m, g.ref)[0] - m.w / 2, rel(m, g.ref)[0] + m.w / 2]);
      return [Math.min(...xs), Math.max(...xs)];
    });
    const total = ext.reduce((t, [a, c]) => t + c - a, 0) + 500 * (groups.length - 1);
    let x = -total / 2;
    groups.forEach((g, i) => {
      const off: Vec3 = [x - ext[i][0], 0, 0];
      for (const m of g.mods) offs.set(m, { ref: g.ref, off });
      x += ext[i][1] - ext[i][0] + 500;
    });
  };
  // a point given in a module's own frame, in the scene the step is in
  const spot = (scene: string, m: Mod, lp: Vec3): Vec3 => {
    if (scene === "main") return W(m, lp);
    const o = offs.get(m)!;
    return plus(o.off, plus(rel(m, o.ref), lp));
  };
  const turn = (scene: string, m: Mod): Vec3 => (scene === "main" ? rotOf(m) : [0, 0, 0]);
  const dirIn = (scene: string, m: Mod, d: Vec3): Vec3 => (scene === "main" ? Wd(m, d) : d);
  const show = (scene: string, m: Mod, recs: Rec[], from?: Vec3) => {
    for (const r of recs) {
      if (scene === "main") b.add(r.key, from && Wd(m, from));
      else b.stage(r.key, spot(scene, m, r.lp), [0, 0, 0], from);
    }
  };
  const step = (o: { title: string; detail?: string; scene?: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] }, body: () => void = () => {}) =>
    b.step({ kind: "general", ...o, scene: o.scene ?? "main", warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  const fit = (def: HwDef, list: FitOpts[], gap = 0.08) => b.fits(def, list, gap);
  const frameRec = (m: Mod) => m.recs.find((r) => r.key === m.frame)!;

  /* ---------- the steps ---------- */
  const sleeveStep = (scene: string, list: Mod[], title: string) => {
    const pairs = list.flatMap((m) => m.legs.map((l, i) => ({ m, l, sl: m.sleeves[i] })));
    step({ title, detail: "Lift the washer off each leg's bolt, push the sleeve down over the top of the leg, then put the washer back on.", scene, kind: "legs" }, () => {
      const n = pairs.length;
      b.stagger(0.05);
      pairs.forEach((p, i) => b.stage(p.l.key, [(i - (n - 1) / 2) * 170, LEG / 2, 0], [0, 0, 0]));
      b.then(0.1);
      b.stagger(0.12);
      pairs.forEach((p, i) => b.stage(p.sl.key, [(i - (n - 1) / 2) * 170, LEG - SLV / 2, 0], [0, 0, 0], [0, 220, 0]));
      b.then(0.1);
      fit(LEGW, pairs.map((p) => ({ on: p.l.key, at: W(p.m, [p.l.lp[0], LEG + 1, p.l.lp[2]]), dir: [0, -1, 0] as Vec3, hole: false as const })), 0.05);
    });
  };
  const legsIn = (scene: string, list: Mod[]) => {
    for (const m of list)
      m.legs.forEach((l, i) => {
        b.stagger(0);
        show(scene, m, [l, m.sleeves[i]], [0, -240, 0]);
        b.wait(0.18);
      });
  };
  const armStart = (a: Mod, seat: Mod): Vec3 => [side(a, seat) * (seat.w / 2 + ARM / 2), BY, 0]; // in the seat's frame
  const armOff = (scene: string, a: Mod, seat: Mod, n: number) => {
    // it waits beyond where the chaises will go
    const st = spot(scene, seat, armStart(a, seat));
    const away = spot(scene, seat, plus(armStart(a, seat), [side(a, seat) * (n * CW + 350), 0, 0]));
    step({ title: `Take the armrest off the end of ${addon ? "your sofa" : corner ? "the section" : "the frame"}`, detail: "Unscrew the four nuts inside the frame with the box spanner and keep them with their washers, then pull the armrest off its bolts.", scene, pose: "+z", kind: "bolts", tools: ["wrench"] }, () => {
      b.stage(a.frame, away, turn(scene, a), minus(st, away));
    });
  };
  const bolts = (c: Mod, prev: Mod, e: 1 | -1) => {
    const jx = e * (prev.w / 2);
    const pts: Vec3[] = [[jx, 250, Z0 + BT + 120], [jx, 250, Z0 + D - 120], [jx, BASE + 90, Z0 + BT / 2], [jx, BACK - 90, Z0 + BT / 2]];
    fit(BOLT, pts.map((p) => ({ on: c.frame, mate: prev.frame, at: W(prev, [p[0] + e * 45, p[1], p[2]]), dir: Wd(prev, [-e, 0, 0]) })), 0.1);
    b.then(0.1);
    fit(WASH, pts.map((p) => ({ on: prev.frame, at: W(prev, [p[0] - e * 40, p[1], p[2]]), dir: Wd(prev, [e, 0, 0]), hole: false as const })), 0.05);
    b.then(0.05);
    fit(NUT, pts.map((p) => ({ on: prev.frame, at: W(prev, [p[0] - e * 44, p[1], p[2]]), dir: Wd(prev, [e, 0, 0]), hole: false as const })), 0.08);
  };
  // the chaise manual, on a sofa or section lying on its back in `scene`
  const chaiseSteps = (scene: string, g: (typeof info)[number], legScene: string) => {
    const { seat, chaises, arms, moving } = g;
    for (const a of moving) {
      const e = side(a, seat);
      const mine = chaises.filter((c) => side(c, seat) === e);
      armOff(scene, a, seat, mine.length);
      mine.forEach((c, i, list) => {
        const prev = i ? list[i - 1] : seat;
        step({ title: i ? "Bolt the second chaise onto the first" : `Bolt the chaise onto the end of ${addon ? "your sofa" : corner ? "the section" : "the frame"}`, detail: "Lay it on its back with its end against the frame. Push a bolt through each of the four holes from inside the chaise, then a washer and a nut on the other side, tightened with the box spanner.", scene, pose: "+z", kind: "bolts", tools: ["wrench"] }, () => {
          show(scene, c, [frameRec(c)], [e * 600, 0, 0]);
          b.then(0.15);
          bolts(c, prev, e);
        });
      });
    }
    sleeveStep(legScene, chaises, chaises.length > 1 ? "Fit a sleeve on each of the chaises' legs" : "Fit a sleeve on each of the chaise's legs");
    step({ title: chaises.length > 1 ? "Screw the legs into the chaises" : "Screw the four legs into the chaise", detail: "Into the holes at its corners, clockwise by hand until each one is snug.", scene, pose: "+z", kind: "legs", warnings: ["hand"] }, () => legsIn(scene, chaises));
    for (const a of moving)
      step({ title: "Put the armrest on the end of the chaise", detail: "Push its bolts through the holes in the chaise's outer end and put the same four washers and nuts back on from inside, tightened with the box spanner.", scene, pose: "+z", kind: "bolts", tools: ["wrench"] }, () => {
        show(scene, a, [frameRec(a)], [side(a, seat) * 450, 0, 0]);
      });
    return arms;
  };
  const cushionStep = () => {
    const seatC = mods.flatMap((m) => m.cush), backC = mods.flatMap((m) => m.backs);
    step({ title: "Lay in the seat cushions, then stand the back cushions on them", detail: "Push the strip along the back of each back cushion down into the gap at the top of the backrest so it stays upright.", kind: "cushions" }, () => {
      b.stagger(0.15);
      for (const m of mods) for (const k of m.cush) b.add(k, [0, 320, 0]);
      b.then(0.1);
      for (const m of mods) for (const k of m.backs) b.add(k, Wd(m, [0, 160, 360]));
    });
    return seatC.length + backC.length;
  };

  if (!corner) {
    const g = info[0];
    const { seat, arms, moving } = g;
    const big = s.size.w > 200 || g.chaises.length > 0;
    if (addon) {
      step({ title: "Lay your sofa on its back", detail: "On a rug or the flattened box, with the end the chaise goes on free.", pose: "+z", kind: "flip", warnings: ["floor"] }, () => {
        b.stagger(0);
        for (const m of [seat, ...arms.filter((a) => !moving.includes(a))]) for (const r of m.recs) b.add(r.key, [0, 200, 0]);
        for (const a of moving) b.stage(a.frame, W(seat, armStart(a, seat)), rotOf(a), [0, 200, 0]);
      });
    } else {
      sleeveStep("legs", [seat], "Fit a sleeve on each leg");
      step({ title: "Lay the frame on its back and screw in the legs", detail: "On a rug or the flattened box. One leg into each corner, clockwise by hand until snug.", pose: "+z", kind: "legs", warnings: ["floor", "hand"] }, () => {
        b.stagger(0);
        b.add(seat.frame, [0, 300, 0]);
        for (const a of arms) {
          if (moving.includes(a)) b.stage(a.frame, W(seat, armStart(a, seat)), rotOf(a), [0, 300, 0]);
          else b.add(a.frame, [0, 300, 0]);
        }
        b.then(0.2);
        legsIn("main", [seat]);
      });
    }
    if (g.chaises.length) chaiseSteps("main", g, "legs2");
    step({ title: big ? "Stand it up together" : "Stand it up", detail: "Lift it by the frame, never by the legs.", kind: "standup", people: big ? 2 : 1, warnings: big ? ["two"] : [] });
    cushionStep();
    return true;
  }

  // a corner sectional: the corner first, then the sections on their backs, then the sections are hung on
  const c = corner;
  const secs = info.map((g) => g.seat);
  sleeveStep("legs", [c, ...secs], "Fit a sleeve on each leg");
  step({ title: "Turn the corner upside down and screw in its legs", detail: "On a rug or the flattened box. Four legs, clockwise by hand until snug.", pose: "-y", kind: "legs", warnings: ["floor", "hand"] }, () => {
    b.add(c.frame, [0, 300, 0]);
    b.then(0.2);
    legsIn("main", [c]);
  });
  const brk: [Vec3, Vec3][] = [-1, 0.1, 0.85].flatMap((t) => {
    const u = t < 0 ? Z0 + BT + 60 : t * (K / 2 - 60);
    return [[[K / 2, 230, u], [-1, 0, 0]], [[u, 230, K / 2], [0, 0, -1]]] as [Vec3, Vec3][];
  });
  step({ title: "Turn it over and screw on the six U brackets", detail: "Three along the bottom of each open side, with the Allen key. The sections drop into these.", kind: "screws", tools: ["allen"] }, () => {
    fit(BRK, brk.map(([p, d]) => ({ on: c.frame, at: W(c, p), dir: Wd(c, d), hole: false as const })), 0.1);
    b.then(0.1);
    fit(CSK, brk.map(([p, d]) => ({ on: c.frame, at: W(c, plus(p, [d[0] * -6, 0, d[2] * -6])), dir: Wd(c, d) })), 0.1);
  });
  layOut(info.map((g) => ({ ref: g.seat, mods: g.line })));
  step({ title: "Lay the sections on their backs and screw in their legs", detail: "Two legs in each, at the armrest end, clockwise by hand. The other end hangs on the corner.", scene: "sections", pose: "+z", kind: "legs", warnings: ["floor", "hand"] }, () => {
    b.stagger(0.1);
    for (const g of info) {
      show("sections", g.seat, [frameRec(g.seat)], [0, 300, 0]);
      for (const a of g.arms) {
        if (g.moving.includes(a)) b.stage(a.frame, spot("sections", g.seat, armStart(a, g.seat)), [0, 0, 0], [0, 300, 0]);
        else show("sections", a, [frameRec(a)], [0, 300, 0]);
      }
    }
    b.then(0.2);
    legsIn("sections", secs);
  });
  for (const g of info) if (g.chaises.length) chaiseSteps("sections", g, "legs2");
  info.forEach((g, i) => {
    const m = g.seat, e = -side(g.arms[0], m); // the end that meets the corner
    step({ title: i ? "Hang the other section on the corner" : "Push in a pin and hang the section on the corner", detail: "Push the pin into the hole at the top of the end without an armrest, up to its collar. Lift the section together and lower it so the pin drops into the slot in the corner's backrest and the frame sits in the brackets.", kind: "join", people: 2 }, () => {
      fit(PIN, [{ on: m.frame, at: W(m, [e * (m.w / 2 + 40), BACK - 70, Z0 + BT / 2]), dir: Wd(m, [-e, 0, 0]), mate: c.frame, travel: 140 }]);
      b.then(0.1);
      b.stagger(0);
      for (const x of g.line) for (const r of x.recs) b.add(r.key, [0, 300, 0]);
    });
  });
  cushionStep();
  return true;
}

const family: Family = { names: ["MORABO"], build };
export default family;
