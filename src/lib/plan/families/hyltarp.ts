import type { Family } from "./family";
import type { PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";

/**
 * HYLTARP, from IKEA's manuals. Every frame is built lying on its back: four threaded rods go into the front of the
 * backrest, the sprung seat frame is lowered onto them and held with wing nuts, and each armrest gets three rods,
 * is pushed onto the end of the seat and held with a washer and nut from inside. The tapered legs go into the
 * bottom of the armrests. A chaise is its own box with a lifting lid: its backrest goes on four long rods with knob
 * nuts, it stands on six short legs, and its armrest (with two legs of its own) goes on with three rods, a nut and
 * two bolts. The sofa beside a chaise or a corner has an armrest at one end only; its other end gets a long pin and
 * is lifted into U brackets on the chaise or corner. A loose cover goes over everything, then the cushions.
 * The sofa-bed is a fold-out bed in a frame of its own: a front panel hung on it, the backrest bolted to its side
 * plates, the mattress laid on; each armrest stands on two legs and is held by three rods with wing knobs from
 * inside the unfolded bed. Then the loose cover and the cushions.
 */

type Kind = "sofa" | "chaise" | "corner";
interface Rec {
  key: string;
  lp: Vec3; // centre in the module's own frame
}
interface Mod {
  kind: Kind;
  w: number; // along its own x, armrests included
  arms: (1 | -1)[]; // ends with an armrest (sofa) or the armrest side (chaise)
  ox: number;
  oz: number;
  yaw: 0 | 1; // 1: turned a quarter, its front facing +x (the wing coming forward from the corner)
  so: Vec3; // where its own origin sits in the scene it is built in
  scene: string;
  recs: Rec[];
  k: Record<string, Rec>;
  legs: Rec[];
  cush: string[];
  backs: string[];
}

const D = 930, Z0 = -465, LEG = 140, TOP = 360, SEAT = 480, AH = 630, BH = 820, ARM = 110, BD = 200, PT = 100;
const CW = 800, CL = 1620, K = 930, BACKC = 910, RY = 290; // RY: height of the rods through the seat frame

const ROD: HwDef = { kind: "stud", len: 120, dia: 8, name: "Threaded rod" };
const LROD: HwDef = { kind: "stud", len: 160, dia: 8, name: "Long threaded rod" };
const WING: HwDef = { kind: "nut", len: 14, dia: 36, name: "Wing nut" };
const KNOB: HwDef = { kind: "knob", len: 22, dia: 40, name: "Knob nut" };
const WASH: HwDef = { kind: "washer", len: 1.6, dia: 20 };
const BWASH: HwDef = { kind: "washer", len: 2, dia: 30 };
const NUT: HwDef = { kind: "nut", len: 6.5, dia: 8 };
const PIN: HwDef = { kind: "stud", len: 180, dia: 12, name: "Long pin" };
const BRK: HwDef = { kind: "hook", len: 60, dia: 40, name: "U bracket" };
const BOLT: HwDef = { kind: "bolt", len: 30, dia: 6 };
const PAD: HwDef = { kind: "glide", len: 4, dia: 30 };

const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const W = (m: Mod, v: Vec3): Vec3 => (m.yaw ? [m.ox + v[2], v[1], m.oz - v[0]] : [m.ox + v[0], v[1], m.oz + v[2]]);
const Wd = (m: Mod, d: Vec3): Vec3 => (m.yaw ? [d[2], d[1], -d[0]] : d);
const rotOf = (m: Mod): Vec3 => [0, m.yaw ? Math.PI / 2 : 0, 0];

interface Layout {
  kind: "sofa" | "chaise" | "corner";
  inner?: number; // a sofa's seat width
  e?: 1 | -1; // the chaise's side
}
function layout(s: ProductSpec): Layout | null {
  const v = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
  if (/bed/.test(v)) return null; // sofaBed() draws it
  if (/corner/.test(v)) return { kind: "corner" };
  if (/chaise/.test(v)) return { kind: "chaise", e: /right/.test(v) ? 1 : -1 };
  if (/3-seat|3 seat/.test(v)) return { kind: "sofa", inner: 2100 };
  if (/2-seat|2 seat/.test(v)) return { kind: "sofa", inner: 1600 };
  return null;
}

/** The 2-seat sofa-bed (its own manual): 182 cm, a 160 cm fold-out bed between two 11 cm armrests. */
function sofaBed(b: PlanBuilder, s: ProductSpec): boolean {
  const Wt = s.size.w * 10, Dp = s.size.d * 10, H = s.size.h * 10;
  const aw = ARM, w = Wt - 2 * aw, feet = 60, baseTop = 300, bt = 180, z0 = -Dp / 2, fz = Dp / 2 - 40, backH = BH;
  const part = (name: string, size: Vec3, material: "soft" | "board" | "wood" = "soft", shape?: "cyl") => b.part(name, size, { material, shape });
  const frame = b.compound("Sofa-bed frame", [
    ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [50, baseTop - feet, fz - z0] as Vec3, pos: [sx * (w / 2 - 25), (feet + baseTop) / 2, (z0 + fz) / 2] as Vec3 })),
    { shape: "box", size: [w - 100, 100, fz - z0 - bt - 20], pos: [0, feet + 70, (z0 + bt + fz - 20) / 2] },
    ...[-1, 1].flatMap((sx) => [z0 + 60, fz - 40].map((z) => ({ shape: "box" as const, size: [50, feet, 50] as Vec3, pos: [sx * (w / 2 - 40), feet / 2, z] as Vec3 }))),
  ], { material: "board" });
  const fr = b.place(frame.type, frame.mid);
  const front = b.place(part("Front panel", [w, baseTop - feet - 10, 40]), [0, feet + 10 + (baseTop - feet - 10) / 2, fz + 20]);
  const bk = b.compound("Sofa-bed backrest", [
    { shape: "box", size: [w - 100, baseTop - 120, bt], pos: [0, (120 + baseTop) / 2, z0 + bt / 2] },
    { shape: "box", size: [w, backH - baseTop, bt], pos: [0, (baseTop + backH) / 2, z0 + bt / 2] },
  ], { material: "soft" });
  const back = b.place(bk.type, bk.mid);
  const mat = b.place(part("Mattress", [1400, 120, fz - z0 - bt - 40]), [0, baseTop - 60, (z0 + bt + fz) / 2]);
  const ax = w / 2 + aw / 2;
  const armT = part("Armrest", [aw, AH - feet, Dp]);
  const arms = [-1, 1].map((e) => b.place(armT, [e * ax, (feet + AH) / 2, 0]));
  const legT = part("Leg", [64, feet, 64], "wood", "cyl");
  const lp = [-1, 1].flatMap((e) => [z0 + 80, -z0 - 80].map((z) => [e * ax, z] as [number, number]));
  const legs = lp.map(([x, z]) => b.place(legT, [x, feet / 2, z]));
  const seatC = b.place(part("Seat cushion", [w - 10, SEAT - baseTop, Dp - bt - 20]), [0, (baseTop + SEAT) / 2, z0 + bt + (Dp - bt) / 2 - 5]);
  const cw = w / 2;
  const backs = [-1, 1].map((e) => b.place(part("Back cushion", [cw - 8, H - SEAT, 180]), [(e * cw) / 2, (SEAT + H) / 2, z0 + bt + 92]));
  const scT = part("Scatter cushion", [440, 440, 140]);
  const scatter = [-1, 1].map((e) => b.place(scT, [e * (w / 2 - 230), SEAT + 220, z0 + bt + 180 + 75], [-0.2, -e * 0.25, 0]));

  const step = (o: { title: string; detail?: string; scene?: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] }, body: () => void = () => {}) =>
    b.step({ kind: "general", ...o, scene: o.scene ?? "main", warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  const fit = (def: HwDef, list: FitOpts[], gap = 0.08) => b.fits(def, list, gap);
  const WSCREW: HwDef = { kind: "screw", len: 20, dia: 6, name: "Wing screw" };
  const BBOLT: HwDef = { kind: "bolt", len: 16, dia: 8 };
  const FNUT: HwDef = { kind: "nut", len: 8, dia: 8, name: "Flange nut" };
  const MSCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
  const KNOBR: HwDef = { kind: "nut", len: 14, dia: 30, name: "Wing knob" };
  const sg = (v: number) => Math.sign(v);

  step({ title: "Cut the two ties that hold the bed folded", detail: "Stand the frame on the floor with the folded bed inside it, and throw the ties away." }, () => b.add(fr, [0, 200, 0]));
  step({ title: "Hang the front panel on its two brackets", detail: "One of you at each end. Lower it straight down until both ends sit on the brackets.", kind: "join", people: 2 }, () => b.add(front, [0, 260, 160]));
  step({ title: "Lock the front panel with the wing screw", detail: "One of you lifts the front of the bed a little; the other turns the wing screw in through the middle bracket by hand.", kind: "screws", people: 2, warnings: ["two", "hand"] }, () => {
    // from behind, through the middle bracket (not drawn) into the back of the front panel
    fit(WSCREW, [{ on: front, mate: fr, at: [0, feet + 50, fz - 2], dir: [0, 0, 1], travel: 70, spin: 3 }]);
  });
  step({ title: "Unfold the bed", detail: "Together: lift the seat part up and out, then swing the leg frame over and down onto the floor.", people: 2 });
  step({ title: "Lower the backrest onto the side plates", detail: "Fit the holes at the bottom of the backrest over the pins on both side plates and press it down.", kind: "join", people: 2 }, () => b.add(back, [0, 380, 0]));
  const bp: Vec3[] = [-1, 1].flatMap((sx) => [170, 250].map((y) => [sx * (w / 2), y, z0 + bt / 2] as Vec3));
  step({ title: "Bolt the backrest to the side plates", detail: "Two bolts through each side plate from outside, with a flange nut inside. Hold the nut with the box spanner and tighten with the Allen key.", kind: "bolts", people: 2, tools: ["allen", "wrench"] }, () => {
    fit(BBOLT, bp.map((q) => ({ on: fr, mate: back, at: q, dir: [-sg(q[0]), 0, 0] as Vec3, travel: 60 })), 0.1);
    b.then(0.1);
    fit(FNUT, bp.map((q) => ({ on: back, at: [q[0] - sg(q[0]) * 60, q[1], q[2]] as Vec3, dir: [sg(q[0]), 0, 0] as Vec3, hole: false as const })), 0.08);
  });
  step({ title: "Hook the fabric flap over the back rail", detail: "Pull the flap at the bottom of the backrest up behind the slats and hook its edge over the rail, all the way along." });
  step({ title: "Screw down the two mattress holders", detail: "One at each end of the back rail, with the screwdriver.", kind: "screws", tools: ["screwdriver"] }, () => {
    fit(MSCREW, [-1, 1].map((sx) => ({ on: fr, at: [sx * (w / 2 - 160), feet + 120, z0 + bt + 40] as Vec3, dir: [0, -1, 0] as Vec3 })), 0.15);
  });
  step({ title: "Lay the mattress on the bed", detail: "Unroll it and cut the wrapping off with care: it takes up to 72 hours to reach its full shape. Tuck its back edge under the holders.", people: 2 }, () => b.add(mat, [0, 320, 300]));
  step({ title: "Fold the bed back into the sofa", detail: "Lift the leg frame and fold the bed in, mattress and all, until it rests in the frame." });
  step({ title: "Turn the armrests upside down and screw in the legs", detail: "On something soft. Two legs in each, clockwise by hand until snug.", scene: "arms", pose: "-y", kind: "legs", warnings: ["hand", "floor"] }, () => {
    b.stagger(0.25);
    arms.forEach((a, i) => b.stage(a, [(i ? 1 : -1) * 400, (feet + AH) / 2, 0], [0, 0, 0], [0, 200, 0]));
    b.then(0.1);
    legs.forEach((l, i) => b.stage(l, [(lp[i][0] > 0 ? 1 : -1) * 400, feet / 2, lp[i][1]], [0, 0, 0], [0, -220, 0]));
  });
  step({ title: "Stick a felt pad under each leg", scene: "arms", pose: "-y" }, () => {
    fit(PAD, legs.map((l, i) => ({ on: l, at: [lp[i][0], 0, lp[i][1]] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.1);
  });
  step({ title: "Screw a wing knob onto the end of each rod", detail: "Six rods, three for each armrest. Turn the knob on until it stops.", kind: "bolts", warnings: ["hand"] });
  [-1, 1].forEach((e, i) => {
    const rp: Vec3[] = [[e * (w / 2), feet + 110, 330], [e * (w / 2), feet + 110, -200], [e * (w / 2), baseTop - 60, -200]];
    step({ title: "Push an armrest against the end of the sofa-bed", detail: "Unfold the bed first. Line the holes in the armrest up with the ones in the side plate.", kind: "join" }, () => {
      b.stagger(0);
      b.add(arms[i], [e * 360, 0, 0]);
      legs.forEach((l, k) => sg(lp[k][0]) === e && b.add(l, [e * 360, 0, 0]));
    });
    step({ title: "Fix the armrest with the three rods", detail: "From inside the sofa-bed: one through the front hole, then two through the back, into the armrest. Tighten the knobs by hand, then fold the bed back in.", kind: "bolts", warnings: ["hand"] }, () => {
      fit(ROD, rp.map((q) => ({ on: arms[i], mate: fr, at: q, dir: [e, 0, 0] as Vec3, travel: 160, spin: 3 })), 0.15);
      b.then(0.05);
      fit(KNOBR, rp.map((q) => ({ on: fr, at: [q[0] - e * 60, q[1], q[2]] as Vec3, dir: [e, 0, 0] as Vec3, hole: false as const })), 0.1);
    });
  });
  step({ title: "Pull the cover over the sofa-bed", detail: "Together. Fold the bed out, then work the cover down over the backrest and the armrests, seams on the edges.", people: 2 });
  step({ title: "Fasten the cover all the way round", detail: "Press the hook strips along the bed frame and under the armrests, then tuck the flaps in along the seat and fold the bed back in." });
  step({ title: "Zip the cover onto the seat cushion and lay it in", detail: "Together: push the cushion into the corners of its cover, close the zip, and lay it on the seat, zip at the back.", people: 2, kind: "cushions" }, () => b.add(seatC, [0, 320, 0]));
  step({ title: "Fill the back cushions and stand them on the seat", detail: "Push the filling into the corners of each cover and zip it closed.", kind: "cushions" }, () => {
    b.stagger(0.2);
    for (const k of backs) b.add(k, [0, 200, 300]);
  });
  step({ title: "Add the scatter cushions", detail: "One at each end, against the armrest.", kind: "cushions" }, () => {
    b.stagger(0.15);
    for (const k of scatter) b.add(k, [0, 300, 200]);
  });
  return true;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (/sofa-bed/.test(s.slug ?? "") || /sofa-bed/i.test(s.variant)) return sofaBed(b, s);
  const lay = layout(s);
  if (!lay) return false;

  /* ---------- parts ---------- */
  const types = new Map<string, string>();
  const box = (name: string, size: Vec3, o: { shape?: "cyl"; material?: "soft" | "wood" | "board" } = {}) => {
    const id = `${name}|${size.map(Math.round).join("x")}|${o.shape ?? ""}`;
    if (!types.has(id)) types.set(id, b.part(name, size, { material: o.material ?? "soft", shape: o.shape }));
    return types.get(id)!;
  };
  const comps = new Map<string, { type: string; mid: Vec3 }>();
  const compound = (id: string, name: string, pieces: () => PartPiece[]) => {
    if (!comps.has(id)) comps.set(id, b.compound(name, pieces(), { material: "board" }));
    return comps.get(id)!;
  };
  const mods: Mod[] = [];
  const mk = (kind: Kind, w: number, arms: (1 | -1)[], ox: number, oz: number, yaw: 0 | 1, scene: string): Mod => {
    const m: Mod = { kind, w, arms, ox, oz, yaw, so: [0, 0, 0], scene, recs: [], k: {}, legs: [], cush: [], backs: [] };
    mods.push(m);
    return m;
  };
  const put = (m: Mod, name: string, ref: string, lp: Vec3) => {
    const r = { key: b.place(ref, W(m, lp), rotOf(m)), lp };
    m.recs.push(r);
    m.k[name] = r;
    return r;
  };
  const leg = (m: Mod, x: number, z: number, round: boolean) => {
    const r = put(m, `leg${m.legs.length}`, round ? box("Short leg", [64, LEG, 64], { shape: "cyl", material: "wood" }) : box("Tapered leg", [52, LEG, 52], { shape: "cyl", material: "wood" }), [x, LEG / 2, z]);
    m.legs.push(r);
  };
  // a backrest: a box behind the seat and a board rising from its back edge
  const backrest = (inner: number, depth: number) =>
    compound(`back${inner}`, "Backrest", () => [
      { shape: "box", size: [inner, TOP - LEG, BD], pos: [0, (LEG + TOP) / 2, -depth / 2 + BD / 2] },
      { shape: "box", size: [inner, BH - TOP, PT], pos: [0, (TOP + BH) / 2, -depth / 2 + PT / 2] },
    ]);

  /** A sofa section: backrest, seat frame, armrests at `arms`, legs under each armrest. */
  const sofa = (m: Mod) => {
    const inner = m.w - ARM * m.arms.length;
    const cx = (m.arms.includes(-1) ? ARM / 2 : 0) - (m.arms.includes(1) ? ARM / 2 : 0); // the seat's centre
    const bk = backrest(inner, D);
    put(m, "back", bk.type, [cx, bk.mid[1], Z0 + (bk.mid[2] + D / 2)]);
    put(m, "seat", box("Seat frame", [inner, TOP - LEG, D - BD], { material: "board" }), [cx, (LEG + TOP) / 2, Z0 + BD + (D - BD) / 2]);
    for (const e of m.arms) {
      const x = e * (m.w / 2 - ARM / 2);
      put(m, `arm${e}`, box("Armrest", [ARM, AH - LEG, D]), [x, (LEG + AH) / 2, 0]);
      for (const z of [Z0 + 70, -Z0 - 70]) leg(m, x, z, false);
    }
    m.cush.push(put(m, "cush", box("Seat cushion", [inner - 10, SEAT - TOP, D - BD - 90]), [cx, (TOP + SEAT) / 2, Z0 + BD + 80 + (D - BD - 90) / 2]).key);
    const n = inner > 1800 ? 3 : 2, bw = inner / n;
    for (let i = 0; i < n; i++)
      m.backs.push(put(m, `bc${i}`, box("Back cushion", [bw - 8, BACKC - SEAT, 180]), [cx - inner / 2 + bw * (i + 0.5), (SEAT + BACKC) / 2, Z0 + PT + 92]).key);
  };
  /** The chaise: its backrest, the storage box with its lid, six short legs and an armrest on side `e`. */
  const chaise = (m: Mod, e: 1 | -1) => {
    const bx = -e * (ARM / 2), z0 = -CL / 2;
    const bk = backrest(CW, CL);
    put(m, "back", bk.type, [bx, bk.mid[1], z0 + (bk.mid[2] + CL / 2)]);
    put(m, "base", box("Chaise box", [CW, 330 - LEG, CL - BD], { material: "board" }), [bx, (LEG + 330) / 2, z0 + BD + (CL - BD) / 2]);
    put(m, "lid", box("Chaise lid", [CW, SEAT - 330, CL - BD - PT]), [bx, (330 + SEAT) / 2, z0 + BD + PT + (CL - BD - PT) / 2]);
    for (const z of [z0 + BD + 70, 100, -z0 - 70]) for (const sx of [-1, 1]) leg(m, bx + sx * (CW / 2 - 60), z, true);
    const ax = e * (m.w / 2 - ARM / 2);
    put(m, "arm", box("Chaise armrest", [ARM, AH - LEG, CL]), [ax, (LEG + AH) / 2, 0]);
    for (const z of [z0 + 70, -z0 - 70]) leg(m, ax, z, false);
    m.backs.push(put(m, "bc0", box("Back cushion", [CW - 8, BACKC - SEAT, 180]), [bx, (SEAT + BACKC) / 2, z0 + PT + 92]).key);
  };
  /** The corner: two backrest halves meeting at the back left, a square seat frame and four short legs. */
  const corner = (m: Mod) => {
    const h = K / 2, ib = -h + BD;
    const a = compound("cornerA", "Corner backrest", () => [
      { shape: "box", size: [K, TOP - LEG, BD], pos: [0, (LEG + TOP) / 2, -h + BD / 2] },
      { shape: "box", size: [K, BH - TOP, PT], pos: [0, (TOP + BH) / 2, -h + PT / 2] },
    ]);
    const c = compound("cornerB", "Corner backrest", () => [
      { shape: "box", size: [BD, TOP - LEG, K - BD], pos: [-h + BD / 2, (LEG + TOP) / 2, ib + (K - BD) / 2] },
      { shape: "box", size: [PT, BH - TOP, K - PT], pos: [-h + PT / 2, (TOP + BH) / 2, -h + PT + (K - PT) / 2] },
    ]);
    put(m, "backA", a.type, a.mid);
    put(m, "backB", c.type, c.mid);
    put(m, "seat", box("Corner seat frame", [K - BD, TOP - LEG, K - BD], { material: "board" }), [ib + (K - BD) / 2, (LEG + TOP) / 2, ib + (K - BD) / 2]);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) leg(m, x * (h - 70), z * (h - 70), true);
    const ic = -h + BD + 80, sw = h - ic;
    m.cush.push(put(m, "cush", box("Corner seat cushion", [sw - 10, SEAT - TOP, sw - 10]), [ic + sw / 2, (TOP + SEAT) / 2, ic + sw / 2]).key);
    const bz = -h + PT, bt = 180;
    m.backs.push(put(m, "bcA", box("Corner back cushion", [h - bz - bt - 4, BACKC - SEAT, bt]), [(bz + bt + h) / 2, (SEAT + BACKC) / 2, bz + bt / 2 + 2]).key);
    m.backs.push(put(m, "bcB", box("Corner back cushion", [bt, BACKC - SEAT, h - bz - 4]), [bz + bt / 2 + 2, (SEAT + BACKC) / 2, (bz + h) / 2 + 2]).key);
  };
  const scatter: string[] = [];
  const scatterAt = (m: Mod, e: 1 | -1, depth = D) => {
    const x = e * (m.w / 2 - ARM - 230);
    scatter.push(b.place(box("Scatter cushion", [440, 440, 140]), W(m, [x, SEAT + 220, -depth / 2 + PT + 180 + 75]), plus(rotOf(m), [-0.2, -e * 0.25, 0])));
  };

  /* ---------- the layout ---------- */
  let sofas: Mod[] = [], ch: Mod | undefined, cn: Mod | undefined;
  if (lay.kind === "sofa") {
    const m = mk("sofa", lay.inner! + 2 * ARM, [-1, 1], 0, 0, 0, "main");
    sofa(m);
    scatterAt(m, -1);
    scatterAt(m, 1);
    sofas = [m];
  } else if (lay.kind === "chaise") {
    const e = lay.e!, sw = 1600 + ARM, cw = CW + ARM, total = sw + cw;
    ch = mk("chaise", cw, [e], e * (total / 2 - cw / 2), 0, 0, "chaise");
    const m = mk("sofa", sw, [-e as 1 | -1], -e * (total / 2 - sw / 2), -CL / 2 + D / 2, 0, "sofa");
    sofa(m);
    chaise(ch, e);
    scatterAt(m, -e as 1 | -1);
    scatter.push(b.place(box("Scatter cushion", [440, 440, 140]), W(ch, [-e * 100, SEAT + 220, -CL / 2 + PT + 180 + 75]), [-0.2, e * 0.25, 0]));
    sofas = [m];
  } else {
    const sw = 1600 + ARM, half = (K + sw) / 2;
    cn = mk("corner", K, [], -half + K / 2, -half + K / 2, 0, "main");
    corner(cn);
    const back = mk("sofa", sw, [1], -half + K + sw / 2, -half + K / 2, 0, "sections");
    const wing = mk("sofa", sw, [-1], -half + K / 2, -half + K + sw / 2, 1, "sections");
    sofa(wing);
    sofa(back);
    scatterAt(wing, -1);
    scatterAt(back, 1);
    sofas = [wing, back];
    wing.so = [-(sw / 2 + 250), 0, 0];
    back.so = [sw / 2 + 250, 0, 0];
  }

  /* ---------- step helpers ---------- */
  const step = (o: { title: string; detail?: string; scene?: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] }, body: () => void = () => {}) =>
    b.step({ kind: "general", ...o, scene: o.scene ?? "main", warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  const fit = (def: HwDef, list: FitOpts[], gap = 0.08) => b.fits(def, list, gap);
  // a part shown where it ends up in the scene its module is built in, or off to one side of it
  const show = (m: Mod, r: Rec, from?: Vec3, aside?: Vec3) => {
    if (m.scene === "main") {
      if (aside) b.stage(r.key, W(m, plus(r.lp, aside)), rotOf(m), from && Wd(m, from));
      else b.add(r.key, from && Wd(m, from));
    } else b.stage(r.key, plus(m.so, aside ? plus(r.lp, aside) : r.lp), [0, 0, 0], from);
  };
  const at = (m: Mod, lp: Vec3) => W(m, lp);
  const dir = (m: Mod, d: Vec3) => Wd(m, d);
  const openEnd = (m: Mod) => (m.arms.length === 1 ? (-m.arms[0] as 1 | -1) : 0);
  const seatX = (m: Mod) => (m.arms.includes(-1) ? ARM / 2 : 0) - (m.arms.includes(1) ? ARM / 2 : 0);
  const innerOf = (m: Mod) => m.w - ARM * m.arms.length;
  const rodXs = (m: Mod) => [-0.375, -0.125, 0.125, 0.375].map((t) => seatX(m) + t * innerOf(m));
  const armZ = [Z0 + 100, -40, -Z0 - 150];

  /* ---------- the sofa frame, on its back ---------- */
  const frameSteps = (list: Mod[], scene: string, pins: "arm" | "end" | false) => {
    const two = list.length > 1;
    step({ title: two ? "Screw four rods into each backrest" : "Screw four rods into the backrest", detail: "Lay it on its back on a rug or the flattened box. Turn each rod in by hand until it stops.", scene, pose: "+z", kind: "bolts", warnings: ["floor", "hand"] }, () => {
      for (const m of list) show(m, m.k.back, [0, 0, -300]);
      b.then(0.15);
      for (const m of list) fit(ROD, rodXs(m).map((x) => ({ on: m.k.back.key, at: at(m, [x, RY, Z0 + BD + 50]), dir: dir(m, [0, 0, -1]), mate: m.k.seat.key, travel: 90 })));
    });
    step({ title: two ? "Lower the seat frames onto the rods" : "Lower the seat frame onto the rods", detail: "The springs face the same way as the backrest's front. Let the rods come through the holes in the frame's back rail.", scene, pose: "+z", kind: "join" }, () => {
      for (const m of list) show(m, m.k.seat, [0, 0, 350]);
    });
    step({ title: two ? "Screw a wing nut onto each rod" : "Screw a wing nut onto each of the four rods", detail: "From inside the seat frame, tight by hand.", scene, pose: "+z", kind: "bolts", warnings: ["hand"] }, () => {
      for (const m of list) fit(WING, rodXs(m).map((x) => ({ on: m.k.seat.key, at: at(m, [x, RY, Z0 + BD + 50]), dir: dir(m, [0, 0, -1]), hole: false as const })));
    });
    const armSteps = (m: Mod, e: 1 | -1) => {
      const a = m.k[`arm${e}`], ix = e * (m.w / 2 - ARM), away: Vec3 = [e * 450, 0, 0];
      step({ title: m.arms.length > 1 ? (e < 0 ? "Screw three rods into the left armrest" : "Screw three rods into the right armrest") : "Screw three rods into the armrest", detail: "Into the holes in its inner side, by hand until they stop.", scene, pose: "+z", kind: "bolts", warnings: ["hand"] }, () => {
        show(m, a, [0, 300, 0], away);
        b.then(0.15);
        fit(ROD, armZ.map((z) => ({ on: a.key, at: at(m, [ix + e * 60, RY, z]), dir: dir(m, [e, 0, 0]), mate: z < Z0 + BD ? m.k.back.key : m.k.seat.key, travel: 90 })));
      });
      step({ title: "Push the armrest onto the end of the frame", detail: "Feed the three rods through the holes in the end of the seat frame and backrest.", scene, pose: "+z", kind: "join" }, () => show(m, a, away));
      step({ title: "Put a washer and nut on each rod", detail: "From inside the frame. Tighten them with the box spanner.", scene, pose: "+z", kind: "bolts", tools: ["wrench"] }, () => {
        fit(WASH, armZ.map((z) => ({ on: z < Z0 + BD ? m.k.back.key : m.k.seat.key, at: at(m, [ix - e * 60, RY, z]), dir: dir(m, [e, 0, 0]), hole: false as const })), 0.05);
        b.then(0.05);
        fit(NUT, armZ.map((z) => ({ on: z < Z0 + BD ? m.k.back.key : m.k.seat.key, at: at(m, [ix - e * 64, RY, z]), dir: dir(m, [e, 0, 0]), hole: false as const })));
      });
    };
    const pinStep = (m: Mod) => {
      const o = openEnd(m), ex = seatX(m) + o * (innerOf(m) / 2), y = 250, z = Z0 + BD / 2;
      step({ title: "Screw the long pin into the open end", detail: "Push it through the hole in the end of the backrest with a washer on each side, and screw the knob on inside. About a hand's width stays out.", scene, pose: "+z", kind: "bolts", warnings: ["hand"] }, () => {
        fit(PIN, [{ on: m.k.back.key, at: at(m, [ex + o * 70, y, z]), dir: dir(m, [-o, 0, 0]), travel: 160 }]);
        b.then(0.05);
        fit(BWASH, [{ on: m.k.back.key, at: at(m, [ex + o * 2, y, z]), dir: dir(m, [-o, 0, 0]), hole: false }, { on: m.k.back.key, at: at(m, [ex - o * 40, y, z]), dir: dir(m, [o, 0, 0]), hole: false }]);
        b.then(0.05);
        fit(KNOB, [{ on: m.k.back.key, at: at(m, [ex - o * 46, y, z]), dir: dir(m, [o, 0, 0]), hole: false }]);
      });
    };
    for (const m of list)
      for (const e of [...m.arms].sort()) {
        armSteps(m, e);
        if (pins === "arm" && m.arms.length === 1) pinStep(m);
      }
    const legs = list.flatMap((m) => m.legs.map((l) => ({ m, l })));
    step({ title: legs.length > 2 ? `Screw the ${legs.length === 4 ? "four" : String(legs.length)} legs into the armrests` : "Screw the two legs into the armrest", detail: "Into the holes at the front and back of each armrest's underside, clockwise by hand.", scene, pose: "+z", kind: "legs", warnings: ["hand"] }, () => {
      b.stagger(0.12);
      for (const { m, l } of legs) show(m, l, [0, -260, 0]);
    });
    step({ title: "Stick a felt pad under each leg", scene, pose: "+z", kind: "legs" }, () => {
      fit(PAD, legs.map(({ m, l }) => ({ on: l.key, at: at(m, [l.lp[0], 0, l.lp[2]]), dir: [0, 1, 0] as Vec3, hole: false as const })));
    });
    if (pins === "end") for (const m of list) pinStep(m);
  };

  const coverSteps = (what: string) => {
    step({ title: `Pull the cover over the ${what}`, detail: "Backrest first, seams on the edges, then down over the armrests. Push the flaps between the seat and the armrests and backrest.", people: 2 });
    step({ title: "Fasten the cover under the armrests", detail: "Kneel at each end and press the strips onto the underside so the skirt hangs straight." });
    step({ title: "Tuck the cover in along the seat", detail: "Push the flap down into the gap at the back and sides of the seat frame with flat hands, all the way along." });
  };
  const cushionSteps = (lid: boolean) => {
    step({ title: "Pull the covers onto the cushions", detail: "Feel for the stiff side of the seat cushion: it goes down. Push each cushion into the corners of its cover and close the zip.", people: 2, kind: "cushions" });
    if (lid) step({ title: "Close the chaise lid", detail: "Push it down until it rests on the box.", kind: "general" });
    const seats = mods.flatMap((m) => m.cush), backs = mods.flatMap((m) => m.backs);
    step({ title: seats.length > 1 ? "Lay in the seat cushions" : "Lay in the seat cushion", detail: "Zip at the back.", kind: "cushions" }, () => {
      b.stagger(0.15);
      for (const k of seats) b.add(k, [0, 320, 0]);
    });
    step({ title: "Stand the back cushions on the seat", detail: "Lean each one against the backrest and plump it up.", kind: "cushions" }, () => {
      b.stagger(0.15);
      for (const m of mods) for (const k of m.backs) b.add(k, Wd(m, [0, 200, 300]));
      void backs;
    });
    step({ title: "Add the scatter cushions", detail: "One at each end, against the armrest.", kind: "cushions" }, () => {
      b.stagger(0.15);
      for (const k of scatter) b.add(k, [0, 300, 200]);
    });
  };
  const allIn = (m: Mod, from: Vec3) => {
    b.stagger(0);
    for (const r of m.recs) if (!m.cush.includes(r.key) && !m.backs.includes(r.key)) b.add(r.key, from);
  };

  /* ---------- the guides ---------- */
  if (lay.kind === "sofa") {
    frameSteps(sofas, "main", false);
    step({ title: "Stand the sofa up together", detail: "Lift it by the frame, never by the legs.", kind: "standup", people: 2 });
    coverSteps("sofa");
    cushionSteps(false);
    return true;
  }

  if (lay.kind === "chaise" && ch) {
    const m = sofas[0], e = lay.e!, c = ch, bx = -e * (ARM / 2), z0 = -CL / 2;
    frameSteps([m], "sofa", "end");
    c.so = [0, 0, 0];
    const cs = "chaise", side: Pose = e < 0 ? "-x" : "+x";
    const crx = [-0.3, 0.3].map((t) => bx + t * CW);
    const cr: Vec3[] = crx.flatMap((x) => [[x, 190, z0 + BD + 60], [x, 290, z0 + BD + 60]] as Vec3[]);
    step({ title: "Screw four long rods into the chaise backrest", detail: "By hand, into the holes in its front.", scene: cs, pose: "+z", kind: "bolts", warnings: ["floor", "hand"] }, () => {
      show(c, c.k.back, [0, 0, -300]);
      b.then(0.15);
      fit(LROD, cr.map((p) => ({ on: c.k.back.key, at: at(c, p), dir: [0, 0, -1] as Vec3, mate: c.k.base.key, travel: 110 })));
    });
    step({ title: "Tip the chaise box onto its side and push the backrest on", detail: "Lid closed. Slide the rods into the holes in the box's back end.", scene: cs, pose: side, kind: "join", warnings: ["floor"] }, () => {
      show(c, c.k.base, [0, 0, 400]);
      show(c, c.k.lid, [0, 0, 400]);
    });
    step({ title: "Screw a knob nut onto each rod", detail: "From inside the box, tight by hand.", scene: cs, pose: side, kind: "bolts", warnings: ["hand"] }, () => {
      fit(KNOB, cr.map((p) => ({ on: c.k.base.key, at: at(c, plus(p, [0, 0, 20])), dir: [0, 0, -1] as Vec3, hole: false as const })));
    });
    const round = c.legs.slice(0, 6), tall = c.legs.slice(6);
    step({ title: "Screw the six short legs into the box", detail: "Clockwise by hand until snug. Use the short round legs here, not the tapered ones.", scene: cs, pose: side, kind: "legs", warnings: ["hand"] }, () => {
      b.stagger(0.12);
      for (const l of round) show(c, l, [0, -260, 0]);
    });
    step({ title: "Stick a felt pad under each short leg", scene: cs, pose: side, kind: "legs" }, () => {
      fit(PAD, round.map((l) => ({ on: l.key, at: at(c, [l.lp[0], 0, l.lp[2]]), dir: [0, 1, 0] as Vec3, hole: false as const })));
    });
    step({ title: "Stand the chaise up and pull the cover over the lid", detail: "Open the lid and hold it up. One of you works the cover over its corners while the other holds it.", scene: cs, kind: "standup", people: 2 });
    step({ title: "Fasten the lid cover inside the box", detail: "Pull it tight and press the strips along the inside of the rim, then close the zip at the back.", scene: cs });
    const a = c.k.arm, ix = e * (c.w / 2 - ARM), away: Vec3 = [e * 450, 0, 0];
    step({ title: "Screw the two tapered legs into the chaise armrest", detail: "Lay the armrest on its side. Turn the legs in by hand, then stick a felt pad under each one.", scene: cs, kind: "legs", warnings: ["hand"] }, () => {
      show(c, a, [0, 300, 0], away);
      b.then(0.15);
      b.stagger(0.12);
      for (const l of tall) b.stage(l.key, plus(c.so, plus(l.lp, away)), [0, 0, 0], [0, -260, 0]);
      b.then(0.1);
      fit(PAD, tall.map((l) => ({ on: l.key, at: at(c, [l.lp[0], 0, l.lp[2]]), dir: [0, 1, 0] as Vec3, hole: false as const })));
    });
    const az = [z0 + 100, -100, -z0 - 160];
    step({ title: "Screw three rods into the armrest", detail: "Into the holes in its inner side, by hand until they stop.", scene: cs, kind: "bolts", warnings: ["hand"] }, () => {
      fit(ROD, az.map((z) => ({ on: a.key, at: at(c, [ix + e * 60, RY, z]), dir: [e, 0, 0] as Vec3, mate: z < z0 + BD ? c.k.back.key : c.k.base.key, travel: 90 })));
    });
    step({ title: "Stand the chaise on its back and push the armrest on", detail: "Hold the chaise steady while the rods go through the holes in its side.", scene: cs, pose: "+z", kind: "join" }, () => {
      show(c, a, away);
      for (const l of tall) b.stage(l.key, plus(c.so, l.lp), [0, 0, 0], away);
    });
    step({ title: "Put a washer and nut on the front rod", detail: "Reach in through the box and tighten it with the box spanner.", scene: cs, pose: "+z", kind: "bolts", tools: ["wrench"] }, () => {
      const z = az[2];
      fit(WASH, [{ on: c.k.base.key, at: at(c, [ix - e * 60, RY, z]), dir: [e, 0, 0], hole: false }], 0.05);
      b.then(0.05);
      fit(NUT, [{ on: c.k.base.key, at: at(c, [ix - e * 64, RY, z]), dir: [e, 0, 0], hole: false }]);
    });
    step({ title: "Bolt the armrest on with two bolts", detail: "A washer on each, through the inside of the box, tightened with the Allen key.", scene: cs, pose: "+z", kind: "bolts", tools: ["allen"] }, () => {
      fit(BOLT, [-350, 350].map((z) => ({ on: c.k.base.key, at: at(c, [ix - e * 20, 230, z]), dir: [e, 0, 0] as Vec3, mate: a.key })));
    });
    step({ title: "Stand the chaise up", detail: "Close the lid gently.", scene: cs, kind: "standup" });
    const fx = -e * (c.w / 2);
    const bz = [z0 + 120, z0 + D - 200];
    step({ title: "Screw two U brackets onto the side of the chaise", detail: "On the side without an armrest, low down, with a bolt each and the Allen key.", kind: "screws", tools: ["allen"] }, () => {
      allIn(c, [0, 300, 0]);
      b.then(0.2);
      fit(BRK, bz.map((z) => ({ on: c.k.base.key, at: at(c, [fx, 200, z]), dir: [e, 0, 0] as Vec3, hole: false as const })), 0.1);
      b.then(0.1);
      fit(BOLT, bz.map((z) => ({ on: c.k.base.key, at: at(c, [fx - e * 6, 200, z]), dir: [e, 0, 0] as Vec3 })), 0.1);
    });
    step({ title: "Lift the sofa into the brackets together", detail: "Stand the sofa up and lower its open end so the frame drops into the U brackets and the long pin sits in its slot.", kind: "join", people: 2 }, () => allIn(m, [0, 300, 0]));
    coverSteps("sofa and chaise");
    cushionSteps(true);
    return true;
  }

  if (cn) {
    const c = cn, h = K / 2;
    frameSteps(sofas, "sections", "arm");
    const cs = "corner";
    const rA: Vec3[] = [[-h + BD + 50, RY, -h + BD + 150], [-h + BD + 50, RY, h - 150]];
    const rB: Vec3[] = [[-h + 300, RY, -h + BD + 50], [h - 150, RY, -h + BD + 50]];
    step({ title: "Screw two rods into each corner backrest half", detail: "Lay both halves on their backs. Turn the rods in by hand.", scene: cs, pose: "+z", kind: "bolts", warnings: ["floor", "hand"] }, () => {
      show(c, c.k.backA, [0, 0, -300]);
      show(c, c.k.backB, [-300, 0, 0], [-450, 0, 0]);
      b.then(0.15);
      fit(ROD, rB.map((p) => ({ on: c.k.backA.key, at: at(c, p), dir: [0, 0, -1] as Vec3, mate: c.k.seat.key, travel: 90 })));
      fit(ROD, rA.map((p) => ({ on: c.k.backB.key, at: at(c, p), dir: [-1, 0, 0] as Vec3, mate: c.k.seat.key, travel: 90 })));
    });
    step({ title: "Lower the corner seat frame onto the back half", detail: "Then screw a wing nut onto each of its two rods from inside the frame.", scene: cs, pose: "+z", kind: "bolts", warnings: ["hand"] }, () => {
      show(c, c.k.seat, [0, 0, 350]);
      b.then(0.15);
      fit(WING, rB.map((p) => ({ on: c.k.seat.key, at: at(c, p), dir: [0, 0, -1] as Vec3, hole: false as const })));
    });
    step({ title: "Push the side half onto the seat frame", detail: "Its rods go through the holes in the frame's side rail. Screw on the last two wing nuts by hand.", scene: cs, pose: "+z", kind: "bolts", warnings: ["hand"] }, () => {
      show(c, c.k.backB, [-450, 0, 0]);
      b.then(0.15);
      fit(WING, rA.map((p) => ({ on: c.k.seat.key, at: at(c, p), dir: [-1, 0, 0] as Vec3, hole: false as const })));
    });
    step({ title: "Screw the four short legs into the corner", detail: "Clockwise by hand. Use the short round legs here, then stick a felt pad under each one.", scene: cs, pose: "+z", kind: "legs", warnings: ["hand"] }, () => {
      b.stagger(0.12);
      for (const l of c.legs) show(c, l, [0, -260, 0]);
      b.then(0.1);
      fit(PAD, c.legs.map((l) => ({ on: l.key, at: at(c, [l.lp[0], 0, l.lp[2]]), dir: [0, 1, 0] as Vec3, hole: false as const })));
    });
    const brk: [Vec3, Vec3][] = [
      [[h, 200, -h + 120], [-1, 0, 0]],
      [[h, 200, h - 200], [-1, 0, 0]],
      [[-h + 120, 200, h], [0, 0, -1]],
      [[h - 200, 200, h], [0, 0, -1]],
    ];
    step({ title: "Stand the corner up and screw on the four U brackets", detail: "Two low on each open side, with a bolt each and the Allen key. The sections hang in these.", kind: "screws", tools: ["allen"] }, () => {
      allIn(c, [0, 300, 0]);
      b.then(0.2);
      fit(BRK, brk.map(([p, d]) => ({ on: c.k.seat.key, at: at(c, p), dir: d, hole: false as const })), 0.1);
      b.then(0.1);
      fit(BOLT, brk.map(([p, d]) => ({ on: c.k.seat.key, at: at(c, plus(p, [d[0] * -6, 0, d[2] * -6])), dir: d })), 0.1);
    });
    sofas.forEach((m, i) =>
      step({ title: i ? "Hang the other section on the corner" : "Lift a section onto the corner together", detail: "Stand it up and lower its open end so the long pin drops into the slot in the corner's side and the frame sits in the brackets.", kind: "join", people: 2 }, () => allIn(m, [0, 300, 0])),
    );
    coverSteps("sections and the corner");
    cushionSteps(false);
    return true;
  }
  return false;
}

const family: Family = { names: ["HYLTARP"], build };
export default family;
