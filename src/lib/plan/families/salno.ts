import type { Family } from "./family";
import type { PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";

/**
 * SALNÖ, from IKEA's manuals. Rattan frames built on their side: the woven seat stands on its edge, one side frame is
 * lowered onto it on its pegs and screwed through with cup washers, the seat is set down onto the other side frame and
 * screwed the same way, then the chair is stood up and the low stretcher screwed in from both sides. The backrest
 * drops in from above onto two short screws in the back legs, is locked with two dowels and bolted at the armrests.
 * The bench starts upside down: a middle leg with adjustable feet and a long stretcher screwed under the seat, then
 * a side frame onto each end. Every screw is tightened again once it stands on the floor.
 */

const CUP: HwDef = { kind: "washer", len: 4, dia: 26, name: "Cup washer" };
const LONG: HwDef = { kind: "screw", len: 90, dia: 6, name: "Long screw" };
const SHORT: HwDef = { kind: "screw", len: 50, dia: 6, name: "Short screw" };
const MID: HwDef = { kind: "screw", len: 60, dia: 6, name: "Screw" };
const BOLT: HwDef = { kind: "bolt", len: 70, dia: 6 };
const DOWEL: HwDef = { kind: "dowel", len: 50, dia: 10 };
const R = 30; // rattan tube

type StepIn = { title: string; detail?: string; tools?: ToolId[]; people?: 1 | 2; pose?: Pose; warnings?: WarnId[]; kind: StepKind; scene?: string };

function stepper(b: PlanBuilder) {
  let pose: Pose = "+y";
  return (d: StepIn, body: () => void = () => {}) => {
    const side = !!d.scene && d.scene !== "main";
    if (d.pose && !side) pose = d.pose;
    const w = new Set<WarnId>(d.warnings ?? []);
    if (d.people === 2) w.add("two");
    b.step({ ...d, tools: d.tools ?? [], people: d.people ?? 1, pose: side ? (d.pose ?? "+y") : pose, warnings: [...w].slice(0, 3) }, body);
  };
}

/** A rattan tube from a to b, as a cylinder piece. */
function tube(a: Vec3, c: Vec3, dia = R): PartPiece {
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const L = Math.hypot(...v);
  const n = v.map((x) => x / L);
  const az = -Math.asin(Math.max(-1, Math.min(1, n[0])));
  const ax = Math.abs(Math.cos(az)) < 1e-6 ? 0 : Math.atan2(n[2], n[1]);
  return { shape: "cyl", size: [dia, L, dia], pos: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], rot: [ax, 0, az] };
}

interface Dims {
  W: number;
  D: number;
  H: number;
  SH: number; // seat
  armH: number;
  zf: number; // front legs
  zb: number; // back legs, at the floor
  lean: number; // how far back the backrest's top is from its foot
}

/** Both side frames: front leg up into the armrest, back leg leaning back, seat rail and low stretcher between. */
function sideFrames(b: PlanBuilder, g: Dims) {
  const xs = (sx: number) => sx * (g.W / 2 - R / 2);
  const backTop = (y: number) => g.zb - (40 * y) / (g.armH + 40); // the back leg leans back 4 cm
  return [-1, 1].map((sx) => {
    const x = xs(sx);
    const pieces = [
      tube([x, 0, g.zf], [x, g.armH, g.zf]),
      tube([x, g.armH, g.zf + 30], [x, g.armH + 15, backTop(g.armH + 15)]),
      tube([x, 0, g.zb], [x, g.armH + 40, backTop(g.armH + 40)]),
      tube([x, g.SH - 25, g.zf], [x, g.SH - 25, backTop(g.SH - 25)]),
      tube([x, 130, g.zf], [x, 130, g.zb]),
    ];
    const c = b.compound(sx < 0 ? "Left side frame" : "Right side frame", pieces, { material: "wood" });
    return { sx, x, key: b.place(c.type, c.mid), backZ: backTop };
  });
}

function backrest(b: PlanBuilder, g: Dims, inner: number, from: number, z0: number) {
  const len = Math.hypot(g.H - from, g.lean);
  const ang = Math.atan2(g.lean, g.H - from);
  const c = b.compound(
    "Backrest",
    [
      { shape: "box", size: [inner - 20, len, 24], pos: [0, (from + g.H) / 2, z0 - g.lean / 2], rot: [-ang, 0, 0] },
      tube([-inner / 2 + 15, from, z0], [-inner / 2 + 15, g.H - 10, z0 - g.lean]),
      tube([inner / 2 - 15, from, z0], [inner / 2 - 15, g.H - 10, z0 - g.lean]),
      tube([-inner / 2 + 15, g.H - 15, z0 - g.lean], [inner / 2 - 15, g.H - 15, z0 - g.lean]),
    ],
    { material: "wood" },
  );
  return b.place(c.type, c.mid);
}
const backZ = (g: Dims, from: number, z0: number, y: number) => z0 - (g.lean * (y - from)) / (g.H - from);

function chair(b: PlanBuilder, s: ProductSpec, g: Dims, cushions: boolean): boolean {
  const st = stepper(b);
  const frames = sideFrames(b, g);
  const [L, Rt] = frames;
  const inner = g.W - 2 * R;
  const zs0 = g.zb + 10, zs1 = g.zf + 20;
  const zc = (zs0 + zs1) / 2;
  const seat = b.compound(
    "Seat",
    [
      { shape: "box", size: [inner, 28, zs1 - zs0], pos: [0, g.SH - 14, zc] },
      tube([-inner / 2, g.SH - 25, zs1], [inner / 2, g.SH - 25, zs1]),
      tube([-inner / 2, g.SH - 25, zs0], [inner / 2, g.SH - 25, zs0]),
      tube([-inner / 2, 130, zc], [inner / 2, 130, zc]),
      tube([0, g.SH - 40, zc], [0, 130, zc], 26),
    ],
    { material: "wood" },
  );
  const sk = b.place(seat.type, seat.mid);
  const zB0 = zs0 - 25; // the backrest's foot, behind the seat
  const back = backrest(b, g, inner - 10, g.SH - 60, zB0);
  const sideScrews = (f: (typeof frames)[number]): FitOpts[] => [zs0 + 90, zs1 - 90].map((z) => ({ on: f.key, at: [f.sx * (g.W / 2), g.SH - 25, z] as Vec3, dir: [-f.sx, 0, 0] as Vec3, mate: sk }));
  const cups = (list: FitOpts[]) => list.map((o) => ({ ...o, mate: undefined, hole: false as const }));
  // sideways through the back leg; its tip stands out inside, where the backrest's side slots drop over it later
  const shortPts: FitOpts[] = frames.map((f) => ({ on: f.key, at: [f.sx * (g.W / 2), g.SH - 40, (f.backZ(g.SH - 40) + backZ(g, g.SH - 60, zB0, g.SH - 40)) / 2] as Vec3, dir: [-f.sx, 0, 0] as Vec3, mate: back }));
  const lowPts: FitOpts[] = frames.map((f) => ({ on: f.key, at: [f.sx * (g.W / 2), 130, zc] as Vec3, dir: [-f.sx, 0, 0] as Vec3, mate: sk }));
  const yArm = g.armH - 40;
  const armPts: FitOpts[] = frames.map((f) => ({ on: f.key, at: [f.sx * (g.W / 2), yArm, backZ(g, g.SH - 60, zB0, yArm) + 10] as Vec3, dir: [-f.sx, 0, 0] as Vec3, mate: back }));
  const both = (list: FitOpts[]) => {
    b.fits(CUP, cups(list), 0.1);
    b.fits(LONG, list, 0.15);
  };

  st(
    { title: "Stand the seat on its side and lower a side frame onto it", detail: "Its two pegs go into the holes in the seat edge. Check the seat's curved support faces down.", kind: "join", pose: "+x", warnings: ["floor"] },
    () => {
      b.add(sk, [-200, 0, 0]);
      b.then(0.2);
      b.add(Rt.key, [300, 0, 0]);
    },
  );
  st({ title: "Screw the frame to the seat", detail: "Two long screws, each through a cup washer. The cup's round side goes into the hole.", tools: ["allen"], kind: "screws" }, () => both(sideScrews(Rt)));
  st({ title: "Set it down onto the other side frame", detail: "Lay that frame on the rug and lower the seat onto its pegs.", kind: "join" }, () => b.add(L.key, [-300, 0, 0]));
  st({ title: "Turn a short screw into each back leg", detail: "From the outside, no cup washer. Its point stands out on the inside, ready for the backrest.", tools: ["allen"], kind: "screws" }, () => b.fits(SHORT, shortPts, 0.2));
  st({ title: "Turn it over and screw the second frame", detail: "Two more long screws with cup washers.", tools: ["allen"], kind: "screws", pose: "-x" }, () => both(sideScrews(L)));
  st({ title: "Stand it up and screw the low stretcher", detail: "One long screw with a cup washer through each side into the ends of the stretcher.", tools: ["allen"], kind: "screws", pose: "+y" }, () => both(lowPts));
  st({ title: "Loosen the two short screws a little", detail: "Back each one out about 2 cm, so the backrest can slide down behind them.", tools: ["allen"], kind: "general" });
  st({ title: "Lower the backrest in from above", detail: "Its slots go down over the two short screws, behind the seat.", kind: "join" }, () => b.add(back, [0, 380, 0]));
  st({ title: "Push in the two dowels", detail: "Through the holes at the foot of the backrest, under the seat. They hold it in place.", kind: "dowels" }, () =>
    b.fits(DOWEL, frames.map((f) => ({ on: back, at: [f.sx * (inner / 2 - 40), g.SH - 50, zB0] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.2),
  );
  st({ title: "Tighten the two short screws", tools: ["allen"], kind: "screws" });
  st({ title: "Bolt the backrest at the armrests", detail: "One bolt with a cup washer through each back leg into the backrest.", tools: ["allen"], kind: "bolts" }, () => {
    b.fits(CUP, cups(armPts), 0.1);
    b.fits(BOLT, armPts, 0.15);
  });
  st({
    title: "Stand it on the floor and tighten every screw",
    detail: "All ten, firmly, with the chair on a flat floor so it settles without rocking.",
    tools: ["allen"],
    kind: "screws",
  });
  if (cushions) {
    const pad = b.place(b.part("Seat cushion", [inner - 40, 40, zs1 - zs0 - 40], { material: "soft" }), [0, g.SH + 20, zc + 10]);
    const yH = g.H - 140;
    const head = b.place(b.part("Headrest cushion", [300, 160, 60], { material: "soft" }), [0, yH, backZ(g, g.SH - 60, zB0, yH) + 45], [-Math.atan2(g.lean, g.H - g.SH), 0, 0]);
    st({ title: "Put on the cushions", detail: "The seat cushion lies on the seat. Press the headrest onto the backrest: the hook-and-loop strip holds it.", kind: "cushions" }, () => {
      b.add(pad, [0, 260, 0]);
      b.then(0.1);
      b.add(head, [0, 0, 260]);
    });
  }
  void s;
  return true;
}

function bench(b: PlanBuilder, s: ProductSpec): boolean {
  const st = stepper(b);
  const W = s.size.w * 10 || 1130, D = s.size.d * 10 || 580, H = s.size.h * 10 || 840;
  const g: Dims = { W, D, H, SH: 440, armH: 640, zf: D / 2 - 70, zb: -D / 2 + 90, lean: 120 };
  const frames = sideFrames(b, g);
  const [L, Rt] = frames;
  const inner = W - 2 * R;
  const zs0 = g.zb + 10, zs1 = g.zf + 20, zc = (zs0 + zs1) / 2;
  const zB0 = zs0 - 25;
  const ang = Math.atan2(g.lean, H - g.SH);
  const lenB = Math.hypot(H - g.SH, g.lean);
  const seat = b.compound(
    "Seat and backrest",
    [
      { shape: "box", size: [inner, 28, zs1 - zs0], pos: [0, g.SH - 14, zc] },
      tube([-inner / 2, g.SH - 25, zs1], [inner / 2, g.SH - 25, zs1]),
      { shape: "box", size: [inner - 20, lenB, 24], pos: [0, (g.SH + H) / 2, zB0 - g.lean / 2], rot: [-ang, 0, 0] },
      tube([-inner / 2 + 10, H - 15, zB0 - g.lean], [inner / 2 - 10, H - 15, zB0 - g.lean]),
      tube([0, g.SH, zB0], [0, H - 15, zB0 - g.lean]),
    ],
    { material: "wood" },
  );
  const sk = b.place(seat.type, seat.mid);
  // the middle leg: two legs under the middle of the seat, joined by a bar under it and a low bar that rests on the stretcher
  const mz = [g.zf - 20, g.zb + 30];
  const midC = b.compound(
    "Middle leg",
    [tube([0, 0, mz[0]], [0, g.SH - 45, mz[0]]), tube([0, 0, mz[1]], [0, g.SH - 45, mz[1]]), tube([0, g.SH - 45, mz[0] + 15], [0, g.SH - 45, mz[1] - 15]), tube([0, 130 + R, mz[0] + 15], [0, 130 + R, mz[1] - 15])],
    { material: "wood" },
  );
  const mid = b.place(midC.type, midC.mid);
  const str = b.place(b.compound("Stretcher", [tube([-inner / 2, 130, zc], [inner / 2, 130, zc])], { material: "wood" }).type, [0, 130, zc]);
  const cups = (list: FitOpts[]) => list.map((o) => ({ ...o, mate: undefined, hole: false as const }));
  const withCups = (def: HwDef, list: FitOpts[]) => {
    b.fits(CUP, cups(list), 0.1);
    b.fits(def, list, 0.15);
  };
  const sideScrews = (f: (typeof frames)[number]): FitOpts[] => [zs0 + 70, zc, zs1 - 70].map((z) => ({ on: f.key, at: [f.sx * (W / 2), g.SH - 25, z] as Vec3, dir: [-f.sx, 0, 0] as Vec3, mate: sk }));
  const midC0: Vec3 = [0, g.SH / 2, zc];
  const rel = (k: string): Vec3 => {
    const p = b.partItem(k).final.pos;
    return [p[0] - midC0[0], p[1] - midC0[1], p[2] - midC0[2]];
  };

  st({ title: "Screw the adjustable feet into the middle leg", detail: "Upside down on the rug. By hand, into the ends of both legs.", kind: "legs", scene: "mid", pose: "-y", warnings: ["hand", "floor"] }, () => {
    b.stage(mid, rel(mid), [0, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits({ kind: "foot", len: 20, dia: 30, name: "Adjustable foot" }, mz.map((z) => ({ on: mid, at: [0, 0, z] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.2);
  });
  st({ title: "Screw the stretcher to the middle leg", detail: "One screw through its middle, without a cup washer.", tools: ["allen"], kind: "screws", scene: "mid", pose: "-y" }, () => {
    b.stage(str, rel(str), [0, 0, 0], [0, -160, 0]);
    b.then(0.15);
    b.fits(MID, [{ on: str, at: [0, 130 - R / 2, zc], dir: [0, 1, 0], mate: mid }]);
  });
  st({ title: "Lay the seat upside down and set the middle leg on it", detail: "On a rug, so the rattan doesn't get scuffed.", kind: "join", pose: "-y", warnings: ["floor"] }, () => {
    b.add(sk, [0, -200, 0]);
    b.then(0.2);
    b.add(mid, [0, 300, 0]);
    b.add(str, [0, 300, 0]);
  });
  const midTop: FitOpts[] = [mz[0] - 60, mz[1] + 60].map((z) => ({ on: mid, at: [0, g.SH - 45 - R / 2, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: sk }));
  st({ title: "Screw the middle leg to the seat", detail: "Two screws with cup washers down through the bar under the seat.", tools: ["allen"], kind: "screws" }, () => withCups(SHORT, midTop));
  const midLeg: FitOpts[] = mz.map((z) => ({ on: mid, at: [0, g.SH - 45 - R / 2, z + (z > 0 ? 25 : -25)] as Vec3, dir: [0, 1, 0] as Vec3, mate: sk }));
  st({ title: "Fix the tops of the legs", detail: "Two more screws with cup washers, one at the top of each leg. Then tip the bench onto its end.", tools: ["allen"], kind: "screws" }, () => withCups(MID, midLeg));
  st({ title: "Lower a side frame onto the end", detail: "Its three pegs go into the holes in the seat.", kind: "join", pose: "+x" }, () => b.add(Rt.key, [300, 0, 0]));
  st({ title: "Screw the side frame to the seat", detail: "Three long screws, each through a cup washer.", tools: ["allen"], kind: "screws" }, () => withCups(LONG, sideScrews(Rt)));
  st({ title: "Turn it over and push in the dowels", detail: "One into the hole at each end of the stretcher.", kind: "dowels", pose: "-x" }, () =>
    b.fits(DOWEL, frames.map((f) => ({ on: str, at: [f.sx * (inner / 2), 130 + 10, zc + 20] as Vec3, dir: [-f.sx, 0, 0] as Vec3, mate: f.key })), 0.2),
  );
  st({ title: "Bolt the stretcher to the first side frame", detail: "One bolt through the frame into the end of the stretcher.", tools: ["allen"], kind: "bolts" }, () =>
    b.fits(BOLT, [{ on: Rt.key, at: [W / 2, 130, zc], dir: [-1, 0, 0], mate: str }]),
  );
  st({ title: "Lower the other side frame onto the end", detail: "Onto its pegs and the dowel.", kind: "join" }, () => b.add(L.key, [-300, 0, 0]));
  st({ title: "Screw it to the seat", detail: "Three long screws with cup washers.", tools: ["allen"], kind: "screws" }, () => withCups(LONG, sideScrews(L)));
  const yArm = g.armH - 40;
  const armPts: FitOpts[] = frames.map((f) => ({ on: f.key, at: [f.sx * (W / 2), yArm, backZ(g, g.SH, zB0, yArm) + 10] as Vec3, dir: [-f.sx, 0, 0] as Vec3, mate: sk }));
  st({ title: "Stand it up and bolt the backrest at the armrests", detail: "One bolt with a cup washer through each back leg.", tools: ["allen"], kind: "bolts", pose: "+y" }, () => withCups(BOLT, armPts));
  st({ title: "Tighten every screw", detail: "All the screws at the ends and the one under the middle, firmly.", tools: ["allen"], kind: "screws" });
  st({ title: "Tighten the stretcher bolt", detail: "Tip the bench on its end once more and give the bolts at the low stretcher a last turn.", tools: ["allen"], kind: "bolts", pose: "-x" });
  st({ title: "Stand it up and level the feet", detail: "Turn the two feet under the middle leg until the bench stands steady.", kind: "legs", pose: "+y" });
  return true;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const slug = s.slug ?? "";
  if (/salno-bench/.test(slug)) return bench(b, s);
  if (/salno-chair-armrests/.test(slug)) {
    const W = s.size.w * 10 || 580, D = s.size.d * 10 || 580, H = s.size.h * 10 || 840;
    return chair(b, s, { W, D, H, SH: 440, armH: 640, zf: D / 2 - 70, zb: -D / 2 + 90, lean: 120 }, false);
  }
  if (/salno-armchair|salno-gryttom-armchair/.test(slug)) {
    // the GRYTTOM set is the same armchair with its cushions: IKEA's armchair sizes, not the set's
    const W = 650, D = 840, H = 1100;
    return chair(b, s, { W, D, H, SH: 400, armH: 600, zf: D / 2 - 110, zb: -D / 2 + 210, lean: 200 }, /gryttom/.test(slug));
  }
  return false;
}

const family: Family = { names: ["SALNÖ"], build };
export default family;
