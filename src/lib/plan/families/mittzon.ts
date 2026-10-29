import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, CustomStep, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";

/**
 * MITTZON, from IKEA's manuals.
 * Desks: a telescopic crossbeam is set to the top's width and locked with eight screws and nuts, the legs stand on
 * T-shaped foot bars with adjustable feet, and top arms sit on the legs. The plain desk is built standing and
 * turned onto its top; the sit/stand desk is built upside down, turned up, and its top laid on from above, with a
 * control box under the beam and a control panel under the front. Both get cable holders, a plastic cable tray
 * and two hanging metal cable baskets.
 * Conference tables are built upside down on the top: four rails, corner plates, four legs locked with corner
 * blocks, and on the 105 cm tall ones two footrests between the legs. The deep (108 cm) and round tables have a
 * centre beam and a cable tray in the middle; the round top comes in two halves joined first.
 */

const SCREW: HwDef = { kind: "screw", len: 12, dia: 6 }; // the frame's machine screws, with a screwdriver
const NUT: HwDef = { kind: "nut", len: 6, dia: 6 };
const FOOTBOLT: HwDef = { kind: "bolt", len: 50, dia: 8 };
const BEAMBOLT: HwDef = { kind: "bolt", len: 12, dia: 6 };
const WOODSCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
const HOLDER: HwDef = { kind: "hook", len: 60, dia: 40, name: "Cable tray holder" };
const HANGER: HwDef = { kind: "hook", len: 45, dia: 30, name: "Basket hanger" };
const CLIP: HwDef = { kind: "hook", len: 30, dia: 20, name: "Cable clip" };
const CLAMP: HwDef = { kind: "clip", len: 12, dia: 18, name: "Cable clamp" };
const UHOOK: HwDef = { kind: "hook", len: 50, dia: 30, name: "Cable hook" };
const PLUG: HwDef = { kind: "cap", len: 2, dia: 12, name: "Hole plug" };
const STRAP: HwDef = { kind: "connector", len: 200, dia: 20, name: "Joining strap" };
const WASHER: HwDef = { kind: "washer", len: 1.5, dia: 16 };

/* ---------- desks ---------- */

function desk(b: PlanBuilder, s: ProductSpec, electric: boolean) {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = 750, TT = 25, AH = 30, FT = 10, FH = 30;
  const xl = W / 2 - 130;
  const yArm = H - TT - AH; // underside of the top arms
  const L = 2 * xl - 70; // the beam between the legs
  const yb = yArm - 25; // beam centre
  const metal = { material: "metal" as const };

  // the top; on the sit/stand desk a strip with the cable slots runs along the back
  const strip = electric ? 120 : 0;
  const top = b.place(b.part("Tabletop", [W, TT, D - strip], { material: "board" }), [0, H - TT / 2, strip / 2]);
  const back = electric ? b.place(b.part("Cable cover strip", [W, TT, strip], { material: "board" }), [0, H - TT / 2, -D / 2 + strip / 2]) : "";
  const arm = b.part("Top arm", [60, AH, D - 80], metal);
  const arms = [-1, 1].map((sx) => b.place(arm, [sx * xl, yArm + AH / 2, 0]));
  const colH = yArm - FT - FH;
  const col = electric
    ? b.compound("Lifting leg", [
        { shape: "box", size: [80, 380, 64], pos: [0, FT + FH + 190, 0] },
        { shape: "box", size: [68, colH - 380, 52], pos: [0, FT + FH + 380 + (colH - 380) / 2, 0] },
      ], metal)
    : { type: b.part("Leg", [70, colH, 50], metal), mid: [0, FT + FH + colH / 2, 0] as Vec3 };
  const cols = [-1, 1].map((sx) => b.place(col.type, [sx * xl, col.mid[1], 0]));
  const foot = b.part("Foot bar", [70, FH, D - 80], metal);
  const feet = [-1, 1].map((sx) => b.place(foot, [sx * xl, FT + FH / 2, 0]));
  const outer = b.place(b.part("Crossbeam, outer half", [L / 2 + 150, 50, 60], metal), [-L / 4 + 75, yb, 0]);
  const inner = b.place(b.part("Crossbeam, inner half", [L / 2 + 150, 40, 48], metal), [L / 4 - 75, yb, 0]);
  const zt = -D / 2 + strip + 170, zk = -D / 2 + 75;
  const tray = b.place(b.part("Cable tray", [400, 80, 110], { material: "board" }), [0, H - TT - 40, electric ? 100 : zt]);
  const rl = W / 2 - 250;
  // the plain desk's baskets hang on rails under the top; the sit/stand desk's hang straight off the back of the beam
  const rail = electric ? "" : b.part("Basket rail", [rl, 20, 30], metal);
  const rails = electric ? [] : [-1, 1].map((sx) => b.place(rail, [sx * (W / 4 - 25), H - TT - 10, zk]));
  const basket = b.part("Cable basket", [rl - 10, 110, 100], metal);
  const baskets = [-1, 1].map((sx) => b.place(basket, electric ? [sx * (W / 4 - 25), yb - 5, -80] : [sx * (W / 4 - 25), H - TT - 20 - 55, zk]));
  const box = electric ? b.place(b.part("Control box", [250, 50, 80], { material: "board" }), [-L / 4, yb - 50, 20]) : "";
  const panel = electric ? b.place(b.part("Control panel", [140, 30, 60], { material: "board" }), [W / 2 - 250, H - TT - 15, D / 2 - 60]) : "";

  const step = (o: { title: string; detail?: string; pose?: Pose; kind?: StepKind; tools?: ToolId[]; people?: 1 | 2; warnings?: WarnId[] }, body: () => void = () => {}) =>
    b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  const fit = (def: HwDef, list: FitOpts[], gap = 0.08) => b.fits(def, list, gap);
  const pt = (on: string, at: Vec3, dir: Vec3, o: Partial<FitOpts> = {}): FitOpts => ({ on, at, dir, ...o });
  const flat = { hole: false as const };

  // the beam: halves slid together, then eight screws and nuts through the overlap
  const lockXs = [-120, -40, 40, 120];
  const lockPts = lockXs.flatMap((x) => [1, -1].map((sz) => [x, yb, sz * 30] as Vec3));
  const beamStep = (pose: Pose) => {
    step({ title: "Slide the two halves of the crossbeam together", detail: `Set it to the mark for a ${Math.round(W)} mm top before you fix it.`, pose, kind: "join" }, () => {
      if (pose === "+y") {
        // on the floor in front of the frame, until the legs are up
        b.stage(outer, [-L / 4 + 75, 25, D / 2 + 350], [0, 0, 0], [-250, 0, 0]);
        b.stage(inner, [L / 4 - 75, 25, D / 2 + 350], [0, 0, 0], [250, 0, 0]);
      } else {
        b.add(outer, [-300, 0, 0]);
        b.add(inner, [300, 0, 0]);
      }
    });
    step({ title: "Lock the length with eight screws and nuts", detail: "Through the holes where the halves overlap, a nut on the inside of each.", pose, kind: "screws", tools: electric ? ["allen", "wrench"] : ["screwdriver"] }, () => {
      fit(electric ? BEAMBOLT : SCREW, lockPts.map((p) => pt(outer, p, [0, 0, -Math.sign(p[2])], { mate: inner })), 0.06);
      b.then(0.08);
      fit(NUT, lockPts.map((p) => pt(inner, [p[0], p[1], p[2] * 0.75], [0, 0, Math.sign(p[2])], flat)), 0.05);
    });
  };
  const footPts = (i: number): Vec3[] => [-1, 1].map((sz) => [(i ? 1 : -1) * xl, FT, sz * (D / 2 - 90)]);
  const feetStep = (pose: Pose) =>
    step({ title: "Screw the adjustable feet into the foot bars", detail: "Two in each bar, all the way in for now. You level the desk at the end.", pose, kind: "legs", warnings: ["hand"] }, () => {
      if (pose === "+y") feet.forEach((f) => b.add(f, [0, 0, 300]));
      else feet.forEach((f) => b.add(f, [0, 300, 0]));
      b.then(0.1);
      feet.forEach((f, i) => fit(HW.foot, footPts(i).map((p) => pt(f, p, [0, 1, 0], { spin: 3 })), 0.1));
    });
  const footBolts = (o: { title: string; detail: string; pose: Pose }) =>
    step({ ...o, kind: "bolts", tools: ["allen"] }, () => {
      feet.forEach((f, i) => fit(FOOTBOLT, [-15, 15].map((z) => pt(f, [(i ? 1 : -1) * xl, FT + 2, z], [0, 1, 0], { mate: cols[i], travel: 80, spin: 3 })), 0.1));
    });
  const armStep = (pose: Pose, title: string) => {
    step({ title, detail: "One on each leg, the long way front to back.", pose, kind: "join" }, () => {
      arms.forEach((a) => b.add(a, [0, 260, 0]));
    });
    step({ title: "Fix each top arm with two screws and nuts", detail: "Down through the arm into the top of the leg, a nut underneath.", pose, kind: "screws", tools: electric ? ["screwdriver", "wrench"] : ["screwdriver"] }, () => {
      arms.forEach((a, i) => fit(SCREW, [-15, 15].map((z) => pt(a, [(i ? 1 : -1) * xl, H - TT, z], [0, -1, 0], { mate: cols[i] })), 0.1));
      b.then(0.08);
      arms.forEach((a, i) => fit(NUT, [-15, 15].map((z) => pt(cols[i], [(i ? 1 : -1) * xl, yArm - 8, z], [0, 1, 0], flat)), 0.08));
    });
  };
  const beamToLegs = (pose: Pose) => {
    const ends: [string, number][] = [[outer, -1], [inner, 1]];
    return step({ title: "Screw the beam to the legs", detail: "Two screws and nuts at each end, through the bracket on the leg.", pose, kind: "screws", tools: ["screwdriver"] }, () => {
      for (const [k, sx] of ends) fit(SCREW, [1, -1].map((sz) => pt(k, [sx * (L / 2 - 20), yb, sz * 30], [0, 0, -sz], { mate: cols[sx > 0 ? 1 : 0] })), 0.08);
      b.then(0.08);
      for (const [k, sx] of ends) fit(NUT, [1, -1].map((sz) => pt(k, [sx * (L / 2 - 20), yb, sz * 22], [0, 0, sz], flat)), 0.06);
    });
  };
  const holders = (pose: Pose) =>
    step({ title: "Hook in the cable tray holders and the basket hangers", detail: "Two of each, into the slots under the top.", pose, kind: "general" }, () => {
      fit(HOLDER, [-150, 150].map((x) => pt(top, [x, H - TT, b.partItem(tray).final.pos[2]], [0, 1, 0], flat)), 0.12);
      b.then(0.06);
      fit(HANGER, rails.map((r) => pt(top, [b.partItem(r).final.pos[0], H - TT, zk], [0, 1, 0], flat)), 0.12);
    });
  const railStep = (pose: Pose) =>
    step({ title: "Slide the basket rails onto the hangers and screw them on", detail: "Three screws in each rail, into the top.", pose, kind: "screws", tools: ["screwdriver"] }, () => {
      rails.forEach((r) => b.add(r, [0, -200, 0]));
      b.then(0.1);
      rails.forEach((r) => {
        const x0 = b.partItem(r).final.pos[0];
        fit(SCREW, [-1, 0, 1].map((k) => pt(r, [x0 + k * (rl / 2 - 30), H - TT - 20, zk], [0, 1, 0])), 0.08);
      });
    });
  const trayStep = (pose: Pose) =>
    step({ title: "Click the cable tray together and push it into its holders", detail: "The two halves click into one tray. Push it up until both holders grip it.", pose, kind: "join" }, () => b.add(tray, [0, -200, 0]));
  const basketStep = (pose: Pose) =>
    step({ title: electric ? "Hang the two cable baskets on the hangers" : "Hang the two cable baskets on the rails", detail: "Hook the edge on, then swing each basket up until it clicks.", pose, kind: "join" }, () => {
      baskets.forEach((k) => b.add(k, [0, -200, 120]));
    });
  const plugs = () =>
    step({ title: "Press the plugs into the holes in the legs", detail: "Two in each leg, to cover the unused holes.", kind: "general", warnings: ["hand"] }, () => {
      cols.forEach((c, i) => fit(PLUG, [300, 400].map((y) => pt(c, [(i ? 1 : -1) * xl, y, 26], [0, 0, -1], flat)), 0.1));
    });
  const strapStep = (pose: Pose, on: string) =>
    step({ title: "Screw the joining strap on", detail: "It comes with the top: one screw and a washer in the middle.", pose, kind: "screws", tools: ["screwdriver"] }, () => {
      fit(STRAP, [pt(on, [0, H - TT, electric ? -D / 2 + strip : 0], [0, 1, 0], flat)]);
      b.then(0.06);
      fit(WASHER, [pt(on, [0, H - TT - 2, electric ? -D / 2 + strip : 0], [0, 1, 0], flat)]);
      fit({ kind: "screw", len: 16, dia: 4 }, [pt(on, [0, H - TT - 3, electric ? -D / 2 + strip : 0], [0, 1, 0])]);
    });

  if (!electric) {
    beamStep("+y");
    feetStep("+y");
    step({ title: "Bolt a leg onto each foot bar", detail: "Two bolts from below, with the Allen key.", kind: "legs", tools: ["allen"] }, () => {
      cols.forEach((c) => b.add(c, [0, 300, 0]));
      b.then(0.1);
      feet.forEach((f, i) => fit(FOOTBOLT, [-15, 15].map((z) => pt(f, [(i ? 1 : -1) * xl, FT + 2, z], [0, 1, 0], { mate: cols[i], travel: 80, spin: 3 })), 0.1));
    });
    step({ title: "Lift the beam onto the legs", detail: "One of you at each end. Its ends slide into the brackets on the legs.", kind: "join", people: 2 }, () => {
      b.add(outer);
      b.add(inner);
    });
    beamToLegs("+y");
    armStep("+y", "Lay the top arms on the legs");
    step({ title: "Lay the top face down and turn the frame onto it", detail: "On a rug or the box. Lift the frame together and lower it upside down, the arms on the marks.", pose: "-y", kind: "flip", people: 2, warnings: ["two", "floor"] }, () => b.add(top, [0, 0, 900]));
    holders("-y");
    step({ title: "Screw the top arms to the top", detail: "Four screws through each arm.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () => {
      arms.forEach((a, i) => fit(SCREW, [-(D / 2 - 100), -D / 6, D / 6, D / 2 - 100].map((z) => pt(a, [(i ? 1 : -1) * xl, yArm, z], [0, 1, 0])), 0.06));
    });
    step({ title: "Push the covers into the cable slots", detail: "From below, until they sit flush with the top.", pose: "-y" });
    strapStep("-y", top);
    railStep("-y");
    trayStep("-y");
    step({ title: "Press in the cable clips and turn the desk over", detail: "Four clips under the top for the cables. Then lift it over together, by the frame.", pose: "+y", kind: "standup", people: 2 }, () => {
      fit(CLIP, [-1, 1].flatMap((sx) => [-1, 1].map((sz) => pt(top, [sx * (W / 2 - 200), H - TT, sz * (D / 4)], [0, 1, 0], flat))), 0.08);
    });
    basketStep("+y");
    plugs();
    step({ title: "Set the height and level the feet", detail: "Move the legs to the height you want with the four bolts on each one, then turn the feet until it doesn't rock.", kind: "general", tools: ["allen", "level"] });
    return true;
  }

  // sit/stand: upside down until the top arms go on
  beamStep("-y");
  step({ title: "Push the lifting legs onto the ends of the beam", detail: "Motor end against the beam, the cable outlet facing the middle.", pose: "-y", kind: "join" }, () => {
    cols.forEach((c, i) => b.add(c, [(i ? 1 : -1) * 300, 0, 0]));
  });
  step({ title: "Bolt the legs to the beam", detail: "Four bolts at each end, with the Allen key.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {
    for (const [k, sx] of [[outer, -1], [inner, 1]] as [string, number][])
      fit(BEAMBOLT, [-12, 12].flatMap((dy) => [1, -1].map((sz) => pt(k, [sx * (L / 2 - 20), yb + dy, sz * 30], [0, 0, -sz], { mate: cols[sx > 0 ? 1 : 0] }))), 0.06);
  });
  feetStep("-y");
  footBolts({ title: "Bolt the foot bars onto the legs", detail: "Two countersunk bolts in each, with the Allen key.", pose: "-y" });
  armStep("+y", "Turn the frame over and lay the top arms on");
  step({ title: "Hook the basket hangers onto the beam", detail: "Two, onto the back of the beam.", kind: "general" }, () => {
    fit(HANGER, [-1, 1].map((sx) => pt(sx < 0 ? outer : inner, [sx * (W / 4 - 25), yb, -30], [0, 0, 1], flat)), 0.12);
  });
  step({ title: "Hook the cable tray holders onto the beam", detail: "Two, onto the front of the beam near the middle.", kind: "general" }, () => {
    fit(HOLDER, [-1, 1].map((sx) => pt(sx < 0 ? outer : inner, [sx * 150, yb, 30], [0, 0, -1], flat)), 0.12);
  });
  step({ title: "Press in the cable clamps and the cable hook", detail: "Four clamps along the beam and the hook near the middle, for the leg cables.", kind: "general" }, () => {
    fit(CLAMP, [-1, 1].flatMap((sx) => [L / 6, L / 3].map((x) => pt(sx < 0 ? outer : inner, [sx * x, yb - 25, -15], [0, 1, 0], flat))), 0.08);
    b.then(0.06);
    fit(UHOOK, [pt(outer, [-60, yb - 25, 0], [0, 1, 0], flat)]);
  });
  step({ title: "Slide the control box onto the beam and plug in the legs", detail: "Each leg's cable into its socket on the box. Push every plug fully home and tuck the cables into the clamps.", kind: "join" }, () => b.add(box, [0, -150, 0]));
  step({ title: "Lay the top on and screw it on from below", detail: "Face up, against the stops at the back. Six screws up through the arms.", kind: "screws", tools: ["screwdriver"], people: 2 }, () => {
    b.add(top, [0, 400, 0]);
    b.then(0.15);
    arms.forEach((a, i) => fit(SCREW, [-D / 4, 0, D / 4].map((z) => pt(a, [(i ? 1 : -1) * xl, yArm, z + strip / 2], [0, 1, 0])), 0.06));
  });
  step({ title: "Lay the cable cover strip in at the back", detail: "Push it down behind the top, then fix it with one screw from below.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.add(back, [0, 300, 0]);
    b.then(0.1);
    fit(SCREW, [pt(back, [0, H - TT, -D / 2 + strip / 2], [0, 1, 0])]);
  });
  step({ title: "Fix the top with seven more screws", detail: "Up through the brackets along the arms and the beam.", kind: "screws", tools: ["screwdriver"] }, () => {
    arms.forEach((a, i) => fit(SCREW, [-D / 2 + 70, D / 2 - 60, D / 8].slice(0, i ? 4 : 3).map((z) => pt(a, [(i ? 1 : -1) * xl, yArm, z], [0, 1, 0])), 0.06));
    // the beam's bracket reaches up to the top: the screw goes through its flange
    fit(SCREW, [pt(inner, [L / 4, H - TT - 6, 0], [0, 1, 0])]);
  });
  strapStep("+y", back);
  step({ title: "Click the cable tray together and hang it in the holders", detail: "The two halves click into one tray.", kind: "join" }, () => b.add(tray, [0, -200, 0]));
  step({ title: "Press two cable clips in under the top", detail: "Into the slots beside the cable tray.", kind: "general" }, () => {
    fit(CLIP, [-1, 1].map((sx) => pt(top, [sx * 260, H - TT, 100], [0, 1, 0], flat)), 0.1);
  });
  basketStep("+y");
  step({ title: "Press two more clips in to hold the baskets", detail: "One beside each basket, so they stay folded up.", kind: "general" }, () => {
    fit(CLIP, [-1, 1].map((sx) => pt(back, [sx * (W / 2 - 160), H - TT, -D / 2 + 60], [0, 1, 0], flat)), 0.1);
  });
  plugs();
  step({ title: "Screw the control panel under the front edge", detail: "Two screws, with the buttons facing you.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.add(panel, [0, -150, 0]);
    b.then(0.1);
    fit(WOODSCREW, [-40, 40].map((dx) => pt(panel, [W / 2 - 250 + dx, H - TT - 30, D / 2 - 60], [0, 1, 0])), 0.1);
  });
  step({ title: "Plug it in and level the feet", detail: "Run the desk all the way down once, then turn the feet until it doesn't rock.", kind: "general", tools: ["level"] });
  return true;
}

/* ---------- conference tables ---------- */

function conference(s: ProductSpec): CustomParams | null {
  const v = s.variant.toLowerCase();
  const m = v.match(/(\d+)\s*×\s*(\d+)(?:\s*×\s*(\d+))?/);
  if (!m) return null;
  const round = !m[3];
  const W = +m[1] * 10, D = round ? W : +m[2] * 10, H = (round ? +m[2] : +m[3]) * 10;
  const deep = !round && D > 900;
  const tall = H > 900;
  const TT = 25, RH = 60, RT = 30;
  const yR = H - TT - RH / 2; // rail centre
  // the rail frame: a square under a round top, inset from the edges otherwise
  const fw = round ? W * 0.62 : W - 160, fd = round ? W * 0.62 : D - 120;
  const lean = 70; // the legs splay out along the length
  const parts: CustomPart[] = [];
  if (round) {
    // it comes in two halves; drawn as the one disc they make
    parts.push({ id: "T1", name: "Round tabletop, two halves", size: [W, TT, W], pos: [0, H - TT / 2, 0], shape: "cyl", material: "board" });
  } else parts.push({ id: "T", name: "Tabletop", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "board" });
  const top = round ? "T1" : "T";
  for (const sz of [-1, 1]) parts.push({ id: `RL${sz > 0 ? 1 : 0}`, name: "Long rail", size: [fw, RH, RT], pos: [0, yR, sz * (fd / 2 - RT / 2)], material: "metal" });
  for (const sx of [-1, 1]) parts.push({ id: `RS${sx > 0 ? 1 : 0}`, name: "Short rail", size: [RT, RH, fd - 2 * RT], pos: [sx * (fw / 2 - RT / 2), yR, 0], material: "metal" });
  const legLen = H - TT;
  const ang = Math.atan2(lean, legLen);
  const legs: string[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const id = `L${sx > 0 ? 1 : 0}${sz > 0 ? 1 : 0}`;
      legs.push(id);
      // the top of the leg sits in the frame's corner, its foot further out
      parts.push({ id, name: "Leg", size: [40, legLen, 40], pos: [sx * (fw / 2 + 20 + lean / 2), legLen / 2, sz * (fd / 2 - 20)], rot: [0, 0, sx * ang], material: "metal" });
    }
  const legX = (sx: number, y: number) => sx * (fw / 2 + 20 + lean * (1 - y / legLen));
  if (deep || round) {
    parts.push({ id: "B", name: "Centre beam", size: [fw - 2 * RT, 40, 80], pos: [0, H - TT - 20, 0], material: "metal" });
    parts.push({ id: "C", name: "Cable tray", size: [Math.min(500, fw - 200), 80, 110], pos: [0, H - TT - 40 - 40, 120], material: "board" });
  }
  const footY = [250, 450];
  if (tall)
    footY.forEach((y, i) => {
      const len = 2 * (legX(1, y) - 20);
      parts.push({ id: `F${i}`, name: "Footrest", size: [len, 30, 30], pos: [0, y, (i ? -1 : 1) * (fd / 2 - 20)], material: "metal" });
    });

  const corners: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (fw / 2 - RT), H - TT - RH, sz * (fd / 2 - RT)] as Vec3));
  const cornerOf = (p: Vec3) => `L${p[0] > 0 ? 1 : 0}${p[2] > 0 ? 1 : 0}`;
  const railScrews = (n: number): CustomFix => {
    const pts: Vec3[] = [];
    // through the rail's flange under the top and into the top
    for (const sz of [-1, 1]) for (let i = 0; i < n / 2; i++) pts.push([-fw / 2 + 150 + ((fw - 300) * i) / Math.max(1, n / 2 - 1), H - TT - 12, sz * (fd / 2 - RT / 2)]);
    return { kind: "bolt", count: n, len: 30, dia: 6, at: pts, dir: [0, 1, 0] };
  };
  // the plate lies flat against the top in the frame's corner, its screw up through it into the top
  const plates: CustomFix = { kind: "plate", count: 4, at: corners.map((p) => [p[0], H - TT, p[2]] as Vec3), dir: [0, 1, 0], on: top };
  const plateScrews: CustomFix = { kind: "bolt", count: 4, len: 20, dia: 6, at: corners.map((p) => [p[0] - Math.sign(p[0]) * 30, H - TT - 4, p[2] - Math.sign(p[2]) * 30] as Vec3), dir: [0, 1, 0], on: top };
  const blockPts: Vec3[] = corners.map((p) => [p[0] - Math.sign(p[0]) * 30, H - TT - RH / 2, p[2] - Math.sign(p[2]) * 30]);
  const blocks: CustomFix = { kind: "clamp", count: 4, at: blockPts, dir: [0, 1, 0], name: "Corner block" } as CustomFix;
  // a washer and a cap bolt through each block into its own leg
  const perLeg = (kind: "washer" | "bolt"): CustomFix[] =>
    blockPts.map((p) => ({ kind, count: 1, at: [p], dir: [Math.sign(p[0]), 0, 0] as Vec3, on: cornerOf(p), ...(kind === "bolt" ? { len: 60, dia: 8 } : { dia: 8 }) }));

  const steps: CustomStep[] = [];
  const P: Pose = "-y";
  if (round) {
    steps.push({ title: "Lay the two halves of the top face down and join them", detail: "On a rug. Push them together and tighten the four connecting bolts in the seam.", add: ["T1"], pose: P, warnings: ["floor"], fix: [{ kind: "bolt", count: 4, len: 16, dia: 8, name: "Connecting bolt", at: [-0.3, -0.1, 0.1, 0.3].map((k) => [k * W, H - TT, 0] as Vec3), dir: [0, 1, 0], on: "T1" }], tools: ["allen"] });
    steps.push({ title: "Set the rails on the top", detail: "The two long ones first, then the short ones between them, all in their holes.", add: ["RL0", "RL1", "RS0", "RS1"], pose: P });
    steps.push({ title: "Screw the rails to the top", detail: "Eight countersunk screws, with the Allen key.", fix: [railScrews(8)], pose: P, tools: ["allen"] });
  } else {
    steps.push({ title: "Lay the top face down and set the rails on it", detail: "On a rug or the box. The long rails along the long edges, the short ones across the ends.", add: [top, "RL0", "RL1", "RS0", "RS1"], pose: P, warnings: ["floor"] });
    if (deep) {
      steps.push({ title: "Lay the centre beam along the middle", detail: "Between the long rails, over the cable slot. One screw at each end.", add: ["B"], pose: P, fix: [{ kind: "screw", count: 2, len: 50, dia: 6, at: [-1, 1].map((sx) => [sx * (fw / 2 - RT - 60), H - TT - 40, 0] as Vec3), dir: [0, 1, 0], on: "B" }] });
      steps.push({ title: "Screw the long rails to the top", detail: "Ten countersunk screws, with the Allen key.", fix: [railScrews(10)], pose: P, tools: ["allen"] });
    } else steps.push({ title: "Screw the long rails to the top", detail: "Four countersunk screws, with the Allen key.", fix: [railScrews(4)], pose: P, tools: ["allen"] });
    steps.push({ title: "Screw a corner plate into each corner", detail: "Flat side down, the hole over the hole in the top. One screw each.", fix: [plates, plateScrews], pose: P, tools: ["allen"] });
  }
  steps.push({ title: "Push the four legs into the corners", detail: "The slot in each leg slides over the corner of the frame.", add: legs, pose: P, from: Object.fromEntries(legs.map((l) => [l, [0, -300, 0] as Vec3])) });
  steps.push({ title: "Lock each leg with a corner block and bolt", detail: "Block in the corner, washer on the bolt, then tighten it into the leg with the long Allen key.", fix: [blocks, ...perLeg("washer"), ...perLeg("bolt")].slice(0, 10), pose: P, tools: ["allen"] });
  steps.push({ title: `Tighten all ${round ? "eight" : deep ? "fourteen" : "eight"} screws again`, detail: "Now that the legs pull the frame square, go round once more.", pose: P, tools: ["allen"] });
  if (deep || round) {
    steps.push({ title: "Click the cable tray together and hook it in", detail: "The two halves click into one tray. Four clips hold it under the beam.", add: ["C"], pose: P, fix: [{ kind: "hook", count: 4, len: 30, dia: 20, name: "Cable clip", at: [-1, 1].flatMap((sx) => [60, 180].map((z) => [sx * 200, H - TT - 40, z] as Vec3)), dir: [0, -1, 0], on: "C" } as CustomFix] });
    if (round) steps.push({ title: "Lay the centre beam over the tray and screw it on", detail: "Four small screws into the rails.", add: ["B"], pose: P, fix: [{ kind: "screw", count: 4, len: 12, dia: 6, at: [-1, 1].flatMap((sx) => [-25, 25].map((z) => [sx * (fw / 2 - RT - 30), H - TT - 40, z] as Vec3)), dir: [0, 1, 0], on: "B" }] });
    else steps.push({ title: "Bolt the tray holder to the centre beam", detail: "Four bolts, with the Allen key.", pose: P, fix: [{ kind: "bolt", count: 4, len: 30, dia: 6, at: [-1, 1].flatMap((sx) => [-25, 25].map((z) => [sx * 150, H - TT - 40, z] as Vec3)), dir: [0, 1, 0], on: "B" }] });
  }
  if (tall) {
    steps.push({ title: "Hook the two footrests in between the legs", detail: "One low at the front and one higher at the back, each end on its hook.", add: ["F0", "F1"], pose: P });
    const bolts: CustomFix[] = footY.flatMap((y, i) =>
      [-1, 1].map((sx) => ({ kind: "bolt" as const, count: 1, len: 70, dia: 8, at: [[legX(sx, y) + sx * 20, y, (i ? -1 : 1) * (fd / 2 - 20)] as Vec3], dir: [-sx, 0, 0] as Vec3, on: `L${sx > 0 ? 1 : 0}${i ? 0 : 1}`, mate: `F${i}` })),
    );
    steps.push({ title: "Bolt the footrests to the legs", detail: "One bolt through each leg into the end of a footrest.", pose: P, tools: ["allen"], fix: bolts });
  }
  steps.push({ title: "Turn the table over together", detail: "Lift it by the frame, never by the legs alone.", pose: "+y", kind: "standup", people: 2 });
  if (deep) steps.push({ title: "Screw the strap across the cable slot", detail: "It comes with the top: one screw and a washer in the middle of the slot.", fix: [{ kind: "connector", count: 1, len: 200, dia: 20, name: "Joining strap", at: [[0, H, 0]], dir: [0, -1, 0], on: top }, { kind: "washer", count: 1, at: [[0, H + 2, 0]], dir: [0, -1, 0], on: top }, { kind: "screw", count: 1, len: 16, dia: 4, at: [[0, H + 3, 0]], dir: [0, -1, 0], on: top }] });
  if (deep || round) steps.push({ title: "Fit the lid into the cable slot", detail: "It rests in the slot and lifts out when you need the cables." });
  return { parts, steps };
}

const family: Family = {
  names: ["MITTZON"],
  build(b, s) {
    if (/^desk sit\/stand/i.test(s.variant)) return desk(b, s, true);
    if (/^desk/i.test(s.variant)) return desk(b, s, false);
    return false;
  },
  recipe(s) {
    if (/^conference table/i.test(s.variant)) return conference(s);
    return null;
  },
};
export default family;
