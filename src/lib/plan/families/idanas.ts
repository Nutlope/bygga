import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "../builder";
import { rotate } from "../math";
import type { Family } from "./family";

/*
 * IDANÄS, read from IKEA's manuals.
 *
 * The cabinets are all made the same way: the sides lie on a rug and take their drawer runners and cam bolts, the
 * rails stand in one side on dowels and cam locks, two people lay the other side on, the top hooks on with plastic
 * connectors, and the back panels slide down grooves with the unit standing on its top. The underframe (legs clicked
 * onto rails) is bolted on while it's upside down, the feet screw in, and the unit is fixed to the wall. Drawers fold
 * up from one strip round a bottom, the front clicks on, wire stiffeners clip under the bottom and the drawer drops
 * onto the runners.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

// fittings, sized so different ones stay apart in the list
const DOWEL: HwDef = HW.dowel;
const CAM_BOLT: HwDef = HW.camScrew;
const CAM: HwDef = HW.cam;
const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const TOP_CLIP: HwDef = { kind: "clip", len: 16, dia: 18 };
const BACK_SCREW: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const BACK_CLIP: HwDef = { kind: "clip", len: 12, dia: 24 };
const FRAME_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 8 };
const FRAME_SCREW: HwDef = { kind: "screw", len: 100, dia: 6 };
const ANGLE_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const FOOT: HwDef = { kind: "foot", len: 22, dia: 30 };
const GLIDE: HwDef = { kind: "glide", len: 6, dia: 30 };
const PIN: HwDef = HW.pin;
const TIP: HwDef = { kind: "bracket", len: 40, dia: 30 };
const WALL_PLUG: HwDef = { kind: "plug", len: 40, dia: 8 };
const WALL_SCREW: HwDef = { kind: "screw", len: 70, dia: 5 };
const WASHER: HwDef = HW.washer;
const KNOB: HwDef = HW.knob;
const KNOB_SCREW: HwDef = { kind: "screw", len: 25, dia: 4 };
const DRAWER_CLIP: HwDef = { kind: "clip", len: 10, dia: 12 };
const STIFFENER: HwDef = { kind: "clip", len: 8, dia: 60 };

/** Part types shared by name and size, so identical panels get one letter. */
class Kit {
  private types = new Map<string, string>();
  constructor(public b: PlanBuilder) {}
  part(name: string, size: Vec3, pos: Vec3, o: { material?: PartMaterial; rot?: Vec3; shape?: "box" | "cyl"; extra?: boolean } = {}) {
    const k = `${name}|${size.map(Math.round).join("x")}|${o.material ?? "board"}|${o.shape ?? "box"}`;
    let t = this.types.get(k);
    if (!t) {
      t = this.b.part(name, size, { material: o.material, shape: o.shape, extra: o.extra });
      this.types.set(k, t);
    }
    return this.b.place(t, pos, o.rot ?? [0, 0, 0]);
  }
  compound(name: string, pieces: PartPiece[], at: Vec3, mid: Vec3) {
    const k = `${name}|${JSON.stringify(pieces)}`;
    let t = this.types.get(k);
    if (!t) {
      const c = this.b.compound(name, pieces);
      t = c.type;
      this.types.set(k, t);
    }
    return this.b.place(t, [at[0] + mid[0], at[1] + mid[1], at[2] + mid[2]]);
  }
  pos(k: string) {
    return this.b.partItem(k).final.pos;
  }
  size(k: string) {
    const it = this.b.partItem(k);
    return this.b.parts.find((p) => p.id === it.ref)!.size;
  }
}

interface StepO {
  tools?: ToolId[];
  pose?: Pose;
  scene?: string;
  people?: 1 | 2;
  warnings?: WarnId[];
  repeat?: number;
  check?: "square";
  wall?: boolean;
}
function step(b: PlanBuilder, title: string, detail: string, kind: StepKind, o: StepO, body: () => void) {
  b.step({ title, detail, kind, ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
}

/**
 * A rail with dowels in both ends goes in between two sides that are already standing: as the manual shows, the
 * sides are eased apart a little (they only hang on their connectors), the rail goes in, and the sides are pushed
 * back onto its dowels.
 */
function between(b: PlanBuilder, sides: string[], body: () => void, gap = 30) {
  b.stagger(0);
  sides.forEach((key, i) => {
    const f = b.partItem(key).final;
    b.stage(key, [f.pos[0] + (i ? gap : -gap), f.pos[1], f.pos[2]], f.rot);
  });
  b.then(0.1);
  body();
  b.then(0.15);
  b.stagger(0);
  sides.forEach((key, i) => b.add(key, [i ? gap : -gap, 0, 0]));
}

/* ---------- drawers ---------- */

interface Drawer {
  front: string;
  sides: string[];
  back: string;
  bottom: string;
  c: Vec3; // centre of the box, assembled
  sh: number;
  dd: number;
  xs: number; // half the box width, to the side centres
  y0: number; // underside of the box
  zf: number; // back face of the front
  knobs: Vec3[];
  stiff: number;
  backKnob?: Vec3; // a drawer that opens from both sides has a knob on its back too
}

/**
 * One drawer: a front, a folding strip of side, back and side, a bottom. `x` its centre, `ow` and `oh` the opening
 * (between the runners' sides and the rails), `zf` the front face of the unit and `dd` the box depth behind the front.
 */
function makeDrawer(k: Kit, o: { x: number; yb: number; ow: number; oh: number; zf: number; dd: number; knobs: number; ft?: number; gap?: number; stiff?: number; through?: boolean }): Drawer {
  const ft = o.ft ?? 18, gap = o.gap ?? 2;
  const fw = o.ow - 2 * gap, fh = o.oh - 2 * gap;
  const front = k.part("Drawer front", [fw, fh, ft], [o.x, o.yb + o.oh / 2, o.zf - ft / 2]);
  const xs = o.ow / 2 - 13 - 6; // clear of the runners
  const sh = Math.min(fh - 30, Math.max(80, fh * 0.7));
  const y0 = o.yb + 14;
  const zb = o.zf - ft - o.dd;
  const sides = [-1, 1].map((g) => k.part("Drawer side", [12, sh, o.dd], [o.x + g * xs, y0 + sh / 2, zb + o.dd / 2]));
  const back = k.part("Drawer back", [2 * xs - 12, sh, 12], [o.x, y0 + sh / 2, zb + 6]);
  const bottom = k.part("Drawer bottom", [2 * xs - 4, 4, o.dd - 10], [o.x, y0 + 10, zb + 2 + (o.dd - 10) / 2], { material: "fiber" });
  const ky = o.yb + o.oh / 2;
  const knobs: Vec3[] = o.knobs === 2 ? [-1, 1].map((g) => [o.x + g * fw * 0.25, ky, o.zf] as Vec3) : [[o.x, ky, o.zf]];
  return { front, sides, back, bottom, c: [o.x, y0 + sh / 2, zb + o.dd / 2], sh, dd: o.dd, xs, y0, zf: o.zf - ft, knobs, stiff: o.stiff ?? (o.ow < 500 ? 2 : 3), backKnob: o.through ? [o.x, y0 + sh / 2, zb] : undefined };
}

function drawerFits(d: Drawer) {
  const zb = d.zf - d.dd;
  return {
    clips: [-1, 1].flatMap((g, i) => [d.y0 + 25, d.y0 + d.sh - 25].map((y): FitOpts => ({ on: d.sides[i], at: [d.c[0] + g * d.xs, y, d.zf], dir: [0, 0, -1], mate: d.front }))),
    stiffeners: spread(zb + 60, d.zf - 80, d.stiff).map((z): FitOpts => ({ on: d.bottom, at: [d.c[0], d.y0 + 8, z], dir: [0, -1, 0], hole: false })),
    knobs: [...d.knobs.map((p): FitOpts => ({ on: d.front, at: p, dir: [0, 0, -1], hole: false })), ...(d.backKnob ? [{ on: d.back, at: d.backKnob, dir: [0, 0, 1] as Vec3, hole: false as const }] : [])],
    knobScrews: [...d.knobs.map((p): FitOpts => ({ on: d.front, at: [p[0], p[1], d.zf], dir: [0, 0, 1] })), ...(d.backKnob ? [{ on: d.back, at: [d.backKnob[0], d.backKnob[1], d.backKnob[2] + 12] as Vec3, dir: [0, 0, -1] as Vec3 }] : [])],
  };
}

/** The drawer steps, shown on the first drawer and repeated, then every drawer slides onto its runners. */
function drawerSteps(b: PlanBuilder, ds: Drawer[], o: { from?: Vec3; pose?: Pose } = {}) {
  if (!ds.length) return;
  const d0 = ds[0];
  const base = d0.y0 - 14; // the bottom edge of the front sits on the floor
  const rel = (k: string): Vec3 => {
    const p = b.partItem(k).final.pos;
    return [p[0] - d0.c[0], p[1] - base, p[2] - d0.c[2]];
  };
  const stage = (k: string, from?: Vec3, rot?: Vec3, at?: Vec3) => b.stage(k, at ?? rel(k), rot ?? b.partItem(k).final.rot, from);
  const f0 = drawerFits(d0);
  const rep = ds.length > 1 ? ds.length : undefined;
  const s = { scene: "drawer", repeat: rep };
  const back = rel(d0.back);
  step(b, "Lay out the drawer strip and slide in the bottom", "The sides and back come as one folding strip. Lay it flat, grooves up, and slide the bottom into the groove of the back.", "drawer", s, () => {
    b.stagger(0.15);
    stage(d0.back, [0, 120, 0], [Math.PI / 2, 0, 0], [back[0], 6, back[2] - d0.sh / 2 + 6]);
    d0.sides.forEach((k, i) => {
      const g = i ? 1 : -1;
      stage(k, [0, 120, 0], [0, 0, (-g * Math.PI) / 2], [g * (d0.xs + d0.sh / 2), 6, 0]);
    });
    b.then(0.2);
    stage(d0.bottom, [0, 0, 380], [0, 0, 0], [0, 14, 0]);
  });
  step(b, "Fold up the sides and the back", "Lift the strip round the bottom so the corners close. The bottom stays in its grooves all round.", "drawer", s, () => {
    b.stagger(0.2);
    stage(d0.back, [0, -80, -60]);
    for (const k of d0.sides) stage(k);
    b.then(0.1);
    stage(d0.bottom);
  });
  step(b, "Click the front on", "Push the front onto the ends of the sides, then press down until the four connectors click.", "drawer", s, () => {
    stage(d0.front, [0, 0, 300]);
    b.then(0.15);
    b.fits(DRAWER_CLIP, f0.clips, 0.1);
  });
  step(b, "Clip the wire stiffeners under the bottom", `${d0.stiff === 2 ? "Two" : "Three"} of them, across the bottom, each end in its hole in the sides.`, "drawer", s, () => b.fits(STIFFENER, f0.stiffeners, 0.15));
  step(b, d0.knobs.length > 1 || d0.backKnob ? "Screw on the knobs" : "Screw on the knob", d0.backKnob ? "One on the front and one on the back: it opens from both sides. The screws go in from inside." : "The screw goes in from inside the front.", "screws", { ...s, tools: ["screwdriver"] }, () => {
    b.fits(KNOB, f0.knobs, 0.15);
    b.then(0.05);
    b.fits(KNOB_SCREW, f0.knobScrews, 0.15);
  });
  step(
    b,
    ds.length > 2 ? `Put all ${ds.length} drawers in` : ds.length === 2 ? "Put both drawers in" : "Put the drawer in",
    "Pull the runners out, lay the drawer on them and push it in until the catches at the front click.",
    "drawer",
    { warnings: ["tip"] },
    () => {
      for (const [i, d] of ds.entries()) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.back, d.bottom]) b.add(k, o.from ?? [0, 0, 520]);
        if (i > 0) {
          const f = drawerFits(d);
          for (const [def, list] of [[DRAWER_CLIP, f.clips], [STIFFENER, f.stiffeners], [KNOB, f.knobs], [KNOB_SCREW, f.knobScrews]] as [HwDef, FitOpts[]][])
            for (const x of list) b.preset(def, x);
        }
        b.wait(0.2);
      }
    },
  );
}

/* ---------- chests and other cabinets on legs ---------- */

interface Case {
  W: number;
  H: number;
  D: number;
  U: number; // the underframe, floor to the underside of the cabinet
  t: number;
  xo: number; // outer faces of the sides
  xi: number; // inner faces
  zb: number;
  zf: number;
  yb: number; // underside of the cabinet
  yt: number; // underside of the top
}

function caseOf(s: ProductSpec, U: number): Case {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = 18;
  const xo = W / 2 - 15;
  return { W, H, D, U, t, xo, xi: xo - t, zb: -D / 2, zf: D / 2 - 20, yb: U, yt: H - 22 };
}

/** The underframe: legs clicked onto short and long rails, upside down, then dowelled and screwed on, feet in. */
function underframe(b: PlanBuilder, k: Kit, c: Case, sides: string[], o: { brackets: boolean; tall?: boolean; mid?: string; glides?: boolean; pose?: Pose; nBrackets?: number }) {
  const P = o.pose ?? "-y";
  const { U, xo, zb, zf } = c;
  const lw = 44, rh = 60, rt = 20;
  const xl = xo - lw / 2;
  const zl = [zb + lw / 2, zf - lw / 2];
  const legXs = o.mid ? [-xl, 0, xl] : [-xl, xl];
  const legs = legXs.flatMap((x) => zl.map((z) => ({ k: k.part("Leg", [lw, U, lw], [x, U / 2, z]), x, z })));
  const shorts = [-1, 1].map((g) => k.part("Short rail", [rt, rh, zf - zb - 2 * lw], [g * (xo - rt / 2), U - rh / 2, (zb + zf) / 2]));
  // with a middle pair of legs the long rails come in halves
  const half = (xo - lw - lw / 2);
  const longs = o.mid
    ? zl.flatMap((_, i) => [-1, 1].map((g) => k.part("Long rail", [half, rh, rt], [g * (lw / 2 + half / 2), U - rh / 2, i ? zf - rt / 2 : zb + rt / 2])))
    : zl.map((_, i) => k.part("Long rail", [2 * (xo - lw), rh, rt], [0, U - rh / 2, i ? zf - rt / 2 : zb + rt / 2]));
  const flip = (key: string, from: Vec3) => {
    const p = k.pos(key);
    b.stage(key, [p[0], U - p[1], p[2]], [Math.PI, 0, 0], from);
  };
  step(b, "Click two legs onto each short rail", o.mid ? "Upside down on the rug. Push each rail end into the slot in a leg until it clicks. The middle legs go on the long rails next." : "Upside down on the rug. Push each rail end into the slot in a leg until it clicks.", "legs", { scene: "frame", warnings: ["floor"] }, () => {
    b.stagger(0.15);
    for (const l of legs) flip(l.k, [0, 160, 0]);
    b.then(0.1);
    for (const r of shorts) flip(r, [0, 160, 0]);
  });
  step(b, "Click in the long rails", o.mid ? "Two at the front and two at the back, with a middle leg between each pair." : "One at the front and one at the back, between the pairs of legs.", "legs", { scene: "frame" }, () => {
    b.stagger(0.2);
    for (const r of longs) flip(r, [0, 160, 0]);
  });
  const xs = xo - c.t / 2;
  const zd = [zb + 80, zf - 80];
  step(b, "Tap the dowels into the bottom", "One into the bottom edge of each side, near the corners.", "dowels", { tools: ["hammer"], pose: P }, () => {
    const list = [-1, 1].flatMap((g, i) => [zd[0] + 40, zd[1] - 40].map((z): FitOpts => ({ on: sides[i], at: [g * xs, U, z], dir: [0, 1, 0], mate: shorts[i] })));
    if (o.mid) list.push(...zl.map((z): FitOpts => ({ on: o.mid!, at: [0, U + 20, z + (z < 0 ? 40 : -40)], dir: [0, 1, 0] })));
    b.fits(FRAME_DOWEL, list, 0.1);
  });
  step(b, o.tall ? "Lower the underframe on together" : "Lower the underframe onto it", "Legs up, so the short rails sit along the sides and drop onto the dowels.", "legs", { pose: P, people: o.tall ? 2 : 1 }, () => {
    b.stagger(0);
    for (const key of [...legs.map((l) => l.k), ...shorts, ...longs]) b.add(key, [0, -260, 0]);
  });
  step(b, "Screw the underframe on", "The long screws go up through the short rails into the sides. Use the Allen key.", "screws", { tools: ["allen"], pose: P }, () => {
    const list = [-1, 1].flatMap((g, i) => zd.map((z): FitOpts => ({ on: shorts[i], at: [g * (xo - 10), U - rh, z], dir: [0, 1, 0] })));
    if (o.mid) list.push(...legs.filter((l) => l.x === 0).map((l): FitOpts => ({ on: l.k, at: [0, 0, l.z], dir: [0, 1, 0] })));
    b.fits(FRAME_SCREW, list, 0.12);
  });
  if (o.brackets)
    step(b, "Screw on the brackets", "Two at the back of the underframe, screwed to the cabinet so it holds the back edge too.", "screws", { tools: ["screwdriver"], pose: P }, () => {
      const xs2 = o.mid ? [-xo + lw + 30, -lw / 2 - 30, lw / 2 + 30, xo - lw - 30] : (o.nBrackets ?? 2) === 4 ? spread(-xo + lw + 30, xo - lw - 30, 4) : [-xo + lw + 30, xo - lw - 30];
      const at = xs2.map((x): FitOpts => ({ on: longs[o.mid && x > 0 ? 1 : 0], at: [x, U, zb + rt], dir: [0, 0, -1], hole: false }));
      b.fits(HW.angle, at, 0.15);
      b.then(0.1);
      b.fits(ANGLE_SCREW, at.map((x) => ({ ...x, at: [x.at[0], x.at[1] - 20, x.at[2]] as Vec3, hole: undefined })), 0.12);
    });
  step(b, o.glides ? "Tap in the glides" : "Screw in the feet", o.glides ? "One into the bottom of each leg." : "By hand into the bottom of each leg. Turn them out later to level it.", o.glides ? "general" : "legs", { pose: P, tools: o.glides ? ["hammer"] : [] }, () => {
    b.fits(o.glides ? GLIDE : FOOT, legs.map((l): FitOpts => ({ on: l.k, at: [l.x, 0, l.z], dir: [0, 1, 0] })), 0.12);
  });
}

/** Two tip-over fittings at the back, under the top, then a plug, washer and screw into the wall for each. */
function wallSteps(b: PlanBuilder, top: string, c: Case, n = 2) {
  const xs = n === 1 ? [0] : spread(-c.xi + 80, c.xi - 80, n);
  const y = c.yt - 15;
  step(b, "Screw the wall fittings to the back", "Just under the top, one near each side. They stop it tipping over.", "anchor", { tools: ["screwdriver"], wall: true, warnings: ["tip"] }, () => {
    b.fits(TIP, xs.map((x): FitOpts => ({ on: top, at: [x, c.yt, c.zb + 20], dir: [0, 1, 0], hole: false })), 0.15);
  });
  step(b, "Fix it to the wall", "Mark through the fittings, drill, push in the plugs, then screw through a washer into each. The plugs suit solid walls: use fixings made for your wall if it's different.", "anchor", { tools: ["drill", "pencil", "screwdriver"], wall: true, warnings: ["wall", "tip"] }, () => {
    b.fits(WALL_PLUG, xs.map((x): FitOpts => ({ at: [x, y, c.zb - 2], dir: [0, 0, -1] })), 0.15);
    b.then(0.05);
    b.fits(WASHER, xs.map((x): FitOpts => ({ at: [x, y, c.zb + 30], dir: [0, 0, -1] })), 0.15);
    b.then(0.05);
    b.fits(WALL_SCREW, xs.map((x): FitOpts => ({ at: [x, y, c.zb + 32], dir: [0, 0, -1] })), 0.15);
  });
}

interface Row {
  h: number; // relative opening height
  cols: number; // drawers side by side (1 or 2)
}

/**
 * A chest: sides with runners, a front rail above, between and below the drawers and a back rail at the bottom,
 * the top hooked on, two back panels, the underframe, the wall fittings, then the drawers. A split top row has a
 * short divider screwed up into the top rail. The 162 cm chest stands two columns of drawers each side of a middle
 * panel.
 */
function buildChest(b: PlanBuilder, s: ProductSpec, rows: Row[], o: { mid?: boolean; knobs: number; clips: number }) {
  const k = new Kit(b);
  const c = caseOf(s, 140);
  const { t, xo, xi, zb, zf, yb, yt, W, D } = c;
  const hc = yt - yb;
  const side = (g: number) => k.part(g < 0 ? "Left side" : "Right side", [t, hc, zf - zb], [g * (xo - t / 2), (yb + yt) / 2, (zb + zf) / 2]);
  const sides = [side(-1), side(1)];
  const top = k.part("Top", [W, 22, D], [0, c.H - 11, 0]);
  const mid = o.mid ? k.part("Middle panel", [t, hc - 40, zf - zb - 12], [0, yb + 20 + (hc - 40) / 2, (zb + zf) / 2 + 6]) : "";
  const RT = 20, RD = 50;
  const zr = zf - RD / 2;
  // openings between rails, from the top
  const free = hc - (rows.length + 1) * RT;
  const unit = free / sum(rows.map((r) => r.h));
  const openings: { yb: number; oh: number }[] = [];
  let y = yt - RT;
  for (const r of rows) {
    const oh = r.h * unit;
    openings.push({ yb: y - oh, oh });
    y -= oh + RT;
  }
  const railY = [yt - RT / 2, ...openings.map((op) => op.yb - RT / 2)];
  const sg = (i: number) => (i ? 1 : -1);
  // a rail end: the face it meets, the way into that panel and the panel
  interface End { x: number; g: number; recv: string }
  interface RailJ { key: string; front: boolean; ends: End[] }
  const sideEnds = (): End[] => [0, 1].map((i) => ({ x: sg(i) * xi, g: sg(i), recv: sides[i] }));
  const BR = 80;
  const backRail = k.part("Back rail", [2 * xi, BR, t], [0, yb + BR / 2, zb + 14 + t / 2]);
  const backJ: RailJ = { key: backRail, front: false, ends: sideEnds() };
  const outerY = mid ? [railY[0], railY[railY.length - 1]] : railY;
  const railJs: RailJ[] = outerY.map((ry) => ({ key: k.part("Rail", [2 * xi, RT, RD], [0, ry, zr]), front: true, ends: sideEnds() }));
  // beside a middle panel, the rails between the drawers are short, one each side
  const shortJs: RailJ[] = mid
    ? railY.slice(1, -1).flatMap((ry) =>
        [0, 1].map((i): RailJ => ({ key: k.part("Short rail", [xi - t / 2, RT, RD], [(sg(i) * (xi + t / 2)) / 2, ry, zr]), front: true, ends: [{ x: sg(i) * xi, g: sg(i), recv: sides[i] }, { x: sg(i) * (t / 2), g: -sg(i), recv: mid }] })),
      )
    : [];
  const rails = railJs.map((r) => r.key);
  const backs = [-1, 1].map((g) => k.part("Back panel", [xi + 6, hc - 6, 3], [(g * (xi + 6)) / 2, yb + 3 + (hc - 6) / 2, zb + 8], { material: "fiber" }));

  // runners, one each side of every drawer
  const dd = Math.round((zf - RD - 10 - (zb + 30)) / 10) * 10;
  const runLen = Math.round((dd - 20) / 50) * 50;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 40 };
  const zRun = zf - 22 - runLen / 2;
  const cells: { x: number; ow: number; yb: number; oh: number; walls: [number, number] }[] = [];
  openings.forEach((op, i) => {
    const n = o.mid ? 2 : rows[i].cols;
    if (n === 1) cells.push({ ...op, x: 0, ow: 2 * xi, walls: [-xi, xi] });
    else for (const g of [-1, 1]) cells.push({ ...op, x: (g * (xi + t / 2)) / 2, ow: xi - t / 2, walls: g < 0 ? [-xi, -t / 2] : [t / 2, xi] });
  });
  const splitRow = !o.mid && rows.some((r) => r.cols > 1);
  const splitOp = openings[rows.findIndex((r) => r.cols > 1)];
  const divider = splitRow ? k.part("Divider", [t, splitOp.oh, zf - zb - 40], [0, splitOp.yb + splitOp.oh / 2, (zb + zf) / 2 + 10]) : "";
  const runnerAt = (x: number, ry: number, inward: number): FitOpts => ({ at: [x, ry, zRun], dir: [inward, 0, 0], hole: false });
  const runnersOn = (wallX: number, g: number) => cells.filter((cl) => Math.abs(cl.walls[g < 0 ? 0 : 1] - wallX) < 1).map((cl) => cl.yb + 14);
  const drawers = cells.map((cl) => makeDrawer(k, { x: cl.x, yb: cl.yb, ow: cl.ow, oh: cl.oh, zf, dd, knobs: cl.ow < 500 ? 1 : o.knobs }));

  // the rails' joints: a dowel and a cam bolt at each end, the cam lock in the rail
  const ends = (j: RailJ, e: End) => {
    const p = k.pos(j.key);
    const { x, g, recv } = e;
    return j.front
      ? { dowel: { on: j.key, at: [x, p[1], p[2] - 12] as Vec3, dir: [-g, 0, 0] as Vec3, mate: recv }, bolt: { on: recv, at: [x, p[1], p[2] + 12] as Vec3, dir: [g, 0, 0] as Vec3, mate: j.key, mateHole: 4 }, cam: { on: j.key, at: [x - g * 30, p[1] + RT / 2, p[2] + 12] as Vec3, dir: [0, -1, 0] as Vec3 } }
      : { dowel: { on: j.key, at: [x, p[1] + 22, p[2]] as Vec3, dir: [-g, 0, 0] as Vec3, mate: recv }, bolt: { on: recv, at: [x, p[1] - 22, p[2]] as Vec3, dir: [g, 0, 0] as Vec3, mate: j.key, mateHole: 4 }, cam: { on: j.key, at: [x - g * 30, p[1] - 22, p[2] + t / 2] as Vec3, dir: [0, 0, -1] as Vec3 } };
  };
  const all = [backJ, ...railJs, ...shortJs];
  const jointsOf = (js: RailJ[], recv?: string) => js.flatMap((j) => j.ends.filter((e) => !recv || e.recv === recv).map((e) => ends(j, e)));

  /* the sides, flat on the rug */
  const lay = (key: string, g: number) => {
    const sz = k.size(key);
    b.stage(key, [g * (sz[1] / 2 + 60), t / 2, 0], [0, 0, (-g * Math.PI) / 2], [0, 160, 0]);
  };
  const screwsFor = (on: string, list: FitOpts[]) => list.flatMap((x) => [-1, 1].map((e): FitOpts => ({ on, at: [x.at[0], x.at[1] + 4, zRun + e * (runLen / 2 - 40)], dir: x.dir })));
  const runnerStep = (i: number) => {
    const g = sg(i);
    const list = runnersOn(g * xi, g).map((ry) => ({ ...runnerAt(g * xi, ry, g), on: sides[i] }));
    step(b, i ? "Screw the runners to the right side" : "Screw the runners to the left side", `The runners are marked ${i ? "R" : "L"}. Lay the side on a rug, inside up, and screw each one on along its line of holes, wheel at the front.`, "runners", { scene: "prep", tools: ["screwdriver"], warnings: i ? [] : ["floor"] }, () => {
      if (!i) {
        b.stagger(0.2);
        lay(sides[0], -1);
        lay(sides[1], 1);
        if (mid) b.stage(mid, [0, t / 2, k.size(mid)[2] + 120], [0, 0, Math.PI / 2], [0, 160, 0]);
        b.then(0.2);
      }
      b.fits(RUNNER, list, 0.15);
      b.then(0.1);
      b.fits(RUNNER_SCREW, screwsFor(sides[i], list), 0.06);
    });
  };
  runnerStep(0);
  runnerStep(1);
  if (mid)
    step(b, "Screw the runners to the middle panel", "One on each face for every drawer, the L runners on the right face and the R runners on the left, wheels at the front.", "runners", { scene: "prep", tools: ["screwdriver"] }, () => {
      const list = [-1, 1].flatMap((g) => runnersOn(g * (t / 2), -g).map((ry) => ({ ...runnerAt(g * (t / 2), ry, -g), on: mid })));
      b.fits(RUNNER, list, 0.1);
      b.then(0.1);
      b.fits(RUNNER_SCREW, screwsFor(mid, list), 0.05);
    });
  step(b, mid ? "Screw in the cam bolts" : "Screw the cam bolts into both sides", mid ? "Into the small holes along the front edges of the sides and in both faces of the middle panel, until they stop." : "Into the small holes along the front edge and at the bottom of the back edge, by hand or with the Allen key until they stop.", "cams", { scene: "prep", tools: ["allen"] }, () => {
    b.fits(CAM_BOLT, jointsOf(all).map((j) => j.bolt), 0.04);
  });
  const LONG_SCREW: HwDef = { kind: "screw", len: 50, dia: 7 };
  if (mid) {
    step(b, "Tap the dowels into the top and bottom rails", "One into each end of both long rails.", "dowels", { scene: "rails", tools: ["hammer"] }, () => {
      b.stagger(0.1);
      railJs.forEach((r, i) => b.stage(r.key, [0, RT / 2, (i - 0.5) * 120], [0, 0, 0], [0, 120, 0]));
      b.then(0.15);
      b.fits(DOWEL, jointsOf(railJs).map((j) => j.dowel), 0.06);
    });
    step(b, "Screw the middle panel to the long rails", "Lay it on its back edge with the rails across its front edge. One long screw through each rail into the panel.", "screws", { pose: "+z", tools: ["allen"], warnings: ["floor"] }, () => {
      b.add(mid, [0, 0, 0]);
      b.then(0.15);
      b.stagger(0.2);
      for (const r of railJs) b.add(r.key, [0, 0, 260]);
      b.then(0.15);
      b.fits(LONG_SCREW, railJs.map((r): FitOpts => ({ on: r.key, at: [0, k.pos(r.key)[1], zf], dir: [0, 0, -1], mate: mid })), 0.15);
    });
    step(b, "Screw the back rail to the middle panel", "Tap a dowel into each end first. It goes at the bottom of the back edge.", "screws", { pose: "+z", tools: ["hammer", "allen"] }, () => {
      b.fits(DOWEL, jointsOf([backJ]).map((j) => j.dowel), 0.1);
      b.then(0.1);
      b.add(backRail, [0, 0, -260]);
      b.then(0.15);
      b.fits(LONG_SCREW, [{ on: backRail, at: [0, yb + BR / 2, zb + 14], dir: [0, 0, 1], mate: mid }], 0.15);
    });
    step(b, `Tap the dowels into the ${shortJs.length} short rails and fit them`, "Two in each, one at each end. Push them sideways onto the middle panel between the drawers and lock them with cam locks.", "cams", { pose: "+z", tools: ["hammer", "screwdriver"] }, () => {
      b.fits(DOWEL, jointsOf(shortJs).map((j) => j.dowel), 0.04);
      b.then(0.1);
      b.stagger(0.15);
      // along their dowels, in from the open sides towards the middle panel
      for (const r of shortJs) b.add(r.key, [Math.sign(k.pos(r.key)[0]) * 260, 0, 0]);
      b.then(0.15);
      b.fits(CAM, jointsOf(shortJs, mid).map((j) => j.cam), 0.1);
    });
    step(b, "Push the sides on together", "One at each end, onto all the dowels and cam bolts at once.", "join", { pose: "+z", people: 2 }, () => {
      b.stagger(0.3);
      b.add(sides[0], [-400, 0, 0]);
      b.add(sides[1], [400, 0, 0]);
    });
    step(b, "Lock the cam locks", "Every rail end at the sides. Arrow towards the bolt, then a clockwise turn.", "cams", { pose: "+z", tools: ["screwdriver"] }, () => b.fits(CAM, [0, 1].flatMap((i) => jointsOf(all, sides[i]).map((j) => j.cam)), 0.06));
  } else {
    step(b, "Tap two dowels into the back rail", "One into each end, next to the hole for the cam bolt.", "dowels", { scene: "rails", tools: ["hammer"] }, () => {
      b.stage(backRail, [0, t / 2, -300], [Math.PI / 2, 0, 0], [0, 120, 0]);
      b.then(0.15);
      b.fits(DOWEL, jointsOf([backJ]).map((j) => j.dowel), 0.12);
    });
    step(b, "Stand the back rail in the left side", "Lay the left side on the rug, runners up, and push the rail onto its cam bolt at the bottom of the back edge.", "join", { pose: "+x", warnings: ["floor"] }, () => {
      b.add(sides[0], [0, 0, 0]);
      b.then(0.15);
      b.add(backRail, [300, 0, 0]);
    });
    step(b, `Tap the dowels into the ${rails.length} rails`, "One into each end of every rail.", "dowels", { scene: "rails", tools: ["hammer"] }, () => {
      b.stagger(0.1);
      rails.forEach((r, i) => b.stage(r, [0, RT / 2, (i - (rails.length - 1) / 2) * 90], [0, 0, 0], [0, 120, 0]));
      b.then(0.15);
      b.fits(DOWEL, jointsOf(railJs).map((j) => j.dowel), 0.04);
    });
    step(b, "Stand the rails in the side", "Along the front edge, each onto its dowel and cam bolt. The holes for the cam locks face up.", "join", { pose: "+x" }, () => {
      b.stagger(0.12);
      for (const r of rails) b.add(r, [300, 0, 0]);
    });
    step(b, "Lock the rails with cam locks", "Arrow towards the bolt, then turn each one clockwise until it pulls tight.", "cams", { pose: "+x", tools: ["screwdriver"] }, () => b.fits(CAM, jointsOf(all, sides[0]).map((j) => j.cam), 0.1));
    if (divider) {
      step(b, "Screw the runners to the divider", "One on each face, wheels at the front.", "runners", { scene: "rails", tools: ["screwdriver"] }, () => {
        b.stage(divider, [0, t / 2, 400], [0, 0, Math.PI / 2], [0, 160, 0]);
        b.then(0.15);
        const ry = splitOp.yb + 14;
        const list = [-1, 1].map((g) => ({ ...runnerAt(g * (t / 2), ry, -g), on: divider }));
        b.fits(RUNNER, list, 0.15);
        b.then(0.1);
        b.fits(RUNNER_SCREW, screwsFor(divider, list), 0.08);
      });
      step(b, "Screw the divider to the rails", "It stands between the two top drawers. One long screw through each rail into it, with the Allen key.", "screws", { pose: "+x", tools: ["allen"] }, () => {
        b.add(divider, [0, 0, 300]);
        b.then(0.15);
        const ys = [splitOp.yb + splitOp.oh + RT, splitOp.yb - RT];
        b.fits(LONG_SCREW, ys.map((yy, i): FitOpts => ({ on: divider, at: [0, yy, zr], dir: [0, i ? 1 : -1, 0] })), 0.15);
      });
    }
    step(b, "Lay the other side on together", "Lower it straight down so every rail finds its dowel and cam bolt.", "join", { pose: "+x", people: 2 }, () => b.add(sides[1], [500, 0, 0]));
    step(b, "Lock the cam locks on this side", "Arrow towards the bolt, then a clockwise turn.", "cams", { pose: "+x", tools: ["screwdriver"] }, () => b.fits(CAM, jointsOf(all, sides[1]).map((j) => j.cam), 0.1));
  }
  // the top hooks on: connectors in its underside drop into keyholes in the sides
  const clips: FitOpts[] = [-1, 1].flatMap((g) => spread(zb + 80, zf - 80, o.clips / 2).map((z): FitOpts => ({ on: top, at: [g * (xo - t / 2), yt, z], dir: [0, 1, 0] })));
  step(b, "Hook the top on", "Lay the chest on its back. Push the connectors into the underside of the top, then slide the top onto the sides until it clicks.", "join", { pose: "+z", warnings: ["floor"] }, () => {
    b.fits(TOP_CLIP, clips, 0.08);
    b.then(0.15);
    b.add(top, [0, 300, 0]);
  });
  step(b, "Stand it on its top and slide in the back panels", "Down the grooves in the sides, one after the other, until they meet the top.", "join", { pose: "-y" }, () => {
    b.stagger(0.3);
    for (const k2 of backs) b.add(k2, [0, -500, 0]);
  });
  step(b, "Screw the back to the back rail", `${W > 1200 ? "Eight" : "Four"} small screws along the bottom edge.`, "screws", { pose: "-y", tools: ["screwdriver"] }, () => {
    b.fits(BACK_SCREW, spread(-xi + 80, xi - 80, W > 1200 ? 8 : 4).map((x): FitOpts => ({ on: backs[x < 0 ? 0 : 1], at: [x, yb + BR / 2, zb + 6.5], dir: [0, 0, 1], mate: backRail })), 0.12);
  });
  step(b, "Push in the back clips", "Along both sides, so the back can't rattle in its grooves.", "general", { pose: "-y" }, () => {
    b.fits(BACK_CLIP, [-1, 1].flatMap((g, i) => spread(yb + 200, yt - 150, W > 1200 ? 3 : 4).map((yy): FitOpts => ({ on: backs[i], at: [g * (xi - 10), yy, zb + 9.5], dir: [0, 0, 1], hole: false }))), 0.06);
  });
  underframe(b, k, c, sides, { brackets: true, tall: c.H > 1200 || W > 1200, mid: mid || undefined });
  step(b, "Stand it up", W > 1200 || c.H > 1200 ? "Turn it over onto its feet together." : "Turn it over onto its feet.", "standup", { people: W > 1200 || c.H > 1200 ? 2 : 1 }, () => {});
  wallSteps(b, top, c);
  drawerSteps(b, drawers);
  void zr;
  return true;
}

/** A drawer with a board bottom: cam bolts in the bottom, dowelled sides locked onto it, the back down their grooves, the front on cam bolts. */
function camDrawer(b: PlanBuilder, k: Kit, o: { x: number; yb: number; ow: number; oh: number; zf: number; dd: number }) {
  const ft = 18, gap = 2, st = 16;
  const fw = o.ow - 2 * gap, fh = o.oh - 2 * gap;
  const front = k.part("Drawer front", [fw, fh, ft], [o.x, o.yb + o.oh / 2, o.zf - ft / 2]);
  const xs = o.ow / 2 - 13 - st / 2;
  const sh = Math.min(fh - 30, 160);
  const y0 = o.yb + 14;
  const zF = o.zf - ft, zB = zF - o.dd;
  const sides = [-1, 1].map((g) => k.part("Drawer side", [st, sh, o.dd], [o.x + g * xs, y0 + sh / 2, zB + o.dd / 2]));
  const bw = 2 * xs - st;
  const bottom = k.part("Drawer bottom", [bw, 12, o.dd - 20], [o.x, y0 + 6, zF - (o.dd - 20) / 2]);
  const back = k.part("Drawer back", [bw + 12, sh - 12, 12], [o.x, y0 + 12 + (sh - 12) / 2, zB + 8]);
  return { front, sides, bottom, back, xs, sh, y0, zF, zB, c: [o.x, y0, zB + o.dd / 2] as Vec3, knob: [o.x, o.yb + o.oh / 2, o.zf] as Vec3 };
}

function camDrawerSteps(b: PlanBuilder, d: ReturnType<typeof camDrawer>) {
  const rel = (key: string): Vec3 => {
    const p = b.partItem(key).final.pos;
    return [p[0] - d.c[0], p[1] - d.c[1] + 14, p[2] - d.c[2]];
  };
  const stage = (key: string, from: Vec3) => b.stage(key, rel(key), [0, 0, 0], from);
  const x = d.c[0];
  const sx = (g: number) => x + g * (d.xs - 8);
  const sideBolts = [-1, 1].flatMap((g, i) => [d.zF - 50, d.zB + 60].map((z): FitOpts => ({ on: d.bottom, at: [sx(g), d.y0 + 6, z], dir: [-g, 0, 0], mate: d.sides[i], mateHole: 4 })));
  const sideDowels = [-1, 1].flatMap((g, i) => [d.zF - 100, d.zB + 110].map((z): FitOpts => ({ on: d.sides[i], at: [sx(g), d.y0 + 6, z], dir: [g, 0, 0], mate: d.bottom })));
  const sideCams = [-1, 1].flatMap((g, i) => [d.zF - 50, d.zB + 60].map((z): FitOpts => ({ on: d.sides[i], at: [x + g * (d.xs + 8), d.y0 + 6, z], dir: [-g, 0, 0] })));
  const frontBolts = [-1, 1].flatMap((g, i) => [d.y0 + 30, d.y0 + d.sh - 30].map((yy): FitOpts => ({ on: d.front, at: [x + g * d.xs, yy, d.zF], dir: [0, 0, 1], mate: d.sides[i], mateHole: 4 })));
  const frontCams = [-1, 1].flatMap((g, i) => [d.y0 + 30, d.y0 + d.sh - 30].map((yy): FitOpts => ({ on: d.sides[i], at: [x + g * (d.xs - 8), yy, d.zF - 30], dir: [g, 0, 0] })));
  const sc = { scene: "drawer" };
  step(b, "Screw the cam bolts into the drawer bottom", "Two along each long edge.", "cams", { ...sc, tools: ["allen"] }, () => {
    stage(d.bottom, [0, 120, 0]);
    b.then(0.15);
    b.fits(CAM_BOLT, sideBolts, 0.1);
  });
  step(b, "Tap the dowels into the drawer sides", "Two in each, along the bottom edge, with the grooves facing in.", "dowels", { ...sc, tools: ["hammer"] }, () => {
    b.stagger(0.2);
    d.sides.forEach((key, i) => b.stage(key, [(i ? 1 : -1) * 260, 8, 0], [0, 0, ((i ? 1 : -1) * Math.PI) / 2], [0, 120, 0]));
    b.then(0.15);
    b.fits(DOWEL, sideDowels, 0.1);
  });
  step(b, "Stand the sides on the bottom and lock them", "Push each onto its dowels and cam bolts, then turn the cam locks clockwise.", "cams", { ...sc, tools: ["screwdriver"] }, () => {
    b.stagger(0.2);
    for (const key of d.sides) stage(key, [0, 0, 0]);
    b.then(0.15);
    b.fits(CAM, sideCams, 0.1);
  });
  step(b, "Slide in the drawer back", "Down the grooves at the back of the sides until it rests on the bottom.", "drawer", sc, () => stage(d.back, [0, 260, 0]));
  step(b, "Fit the front and lock it", "Screw the cam bolts into the back of the front, push it onto the sides and turn the cam locks.", "cams", { ...sc, tools: ["allen", "screwdriver"] }, () => {
    b.fits(CAM_BOLT, frontBolts, 0.08);
    b.then(0.1);
    stage(d.front, [0, 0, 300]);
    b.then(0.15);
    b.fits(CAM, frontCams, 0.08);
  });
  step(b, "Screw on the knob", "The screw goes in from inside the front.", "screws", { ...sc, tools: ["screwdriver"] }, () => {
    b.fit(KNOB, { on: d.front, at: d.knob, dir: [0, 0, -1], hole: false });
    b.then(0.05);
    b.fit(KNOB_SCREW, { on: d.front, at: [d.knob[0], d.knob[1], d.zF], dir: [0, 0, 1] });
  });
  step(b, "Put the drawer in", "Pull the runners out, lay the drawer on them and push it in until the catches click.", "drawer", {}, () => {
    b.stagger(0);
    for (const key of [d.front, ...d.sides, d.bottom, d.back]) b.add(key, [0, 0, 480]);
  });
}

/**
 * The bedside table: one runner on each side, a rail at the bottom front and back, the top hooked on, one back
 * panel, the underframe on glides, a loose shelf on four pins over the drawer, and a drawer of boards on cam locks.
 */
function buildBedside(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const c = caseOf(s, 190);
  const { t, xo, xi, zb, zf, yb, yt, W, D } = c;
  const hc = yt - yb;
  const sides = [-1, 1].map((g) => k.part(g < 0 ? "Left side" : "Right side", [t, hc, zf - zb], [g * (xo - t / 2), (yb + yt) / 2, (zb + zf) / 2]));
  const top = k.part("Top", [W, 22, D], [0, c.H - 11, 0]);
  const RT = 20, RD = 50, BR = 80;
  const rail = k.part("Front rail", [2 * xi, RT, RD], [0, yb + RT / 2, zf - RD / 2]);
  const backRail = k.part("Back rail", [2 * xi, BR, t], [0, yb + BR / 2, zb + 14 + t / 2]);
  const back = k.part("Back panel", [2 * xi + 12, hc - 6, 3], [0, yb + 3 + (hc - 6) / 2, zb + 8], { material: "fiber" });
  const oh = Math.round((hc - RT - 18) * 0.5);
  const shelfY = yb + RT + oh + 9;
  const shelf = k.part("Shelf", [2 * xi - 2, 18, zf - zb - 30], [0, shelfY, (zb + zf) / 2 + 7]);
  const dd = Math.round((zf - 18 - (zb + 40)) / 10) * 10;
  const runLen = Math.round((dd - 20) / 50) * 50;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 40 };
  const zRun = zf - 22 - runLen / 2;
  const d = camDrawer(b, k, { x: 0, yb: yb + RT, ow: 2 * xi, oh, zf, dd });
  const sg = (i: number) => (i ? 1 : -1);
  const joint = (key: string, i: number, front: boolean) => {
    const p = k.pos(key), x = sg(i) * xi, g = sg(i);
    return front
      ? { dowel: { on: key, at: [x, p[1], p[2] - 12] as Vec3, dir: [-g, 0, 0] as Vec3, mate: sides[i] }, bolt: { on: sides[i], at: [x, p[1], p[2] + 12] as Vec3, dir: [g, 0, 0] as Vec3, mate: key, mateHole: 4 }, cam: { on: key, at: [x - g * 30, p[1] + RT / 2, p[2] + 12] as Vec3, dir: [0, -1, 0] as Vec3 } }
      : { dowel: { on: key, at: [x, p[1] + 22, p[2]] as Vec3, dir: [-g, 0, 0] as Vec3, mate: sides[i] }, bolt: { on: sides[i], at: [x, p[1] - 22, p[2]] as Vec3, dir: [g, 0, 0] as Vec3, mate: key, mateHole: 4 }, cam: { on: key, at: [x - g * 30, p[1] - 22, p[2] + t / 2] as Vec3, dir: [0, 0, -1] as Vec3 } };
  };
  const js = (i: number) => [joint(backRail, i, false), joint(rail, i, true)];
  const runners = [0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * xi, d.y0 - 6, zRun], dir: [sg(i), 0, 0], hole: false }));
  step(b, "Screw a runner to each side", "Lay both sides on a rug, inside up. The runners are marked L and R: two screws each, wheel at the front.", "runners", { scene: "prep", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    sides.forEach((key, i) => b.stage(key, [sg(i) * (hc / 2 + 60), t / 2, 0], [0, 0, (-sg(i) * Math.PI) / 2], [0, 160, 0]));
    b.then(0.2);
    b.fits(RUNNER, runners, 0.2);
    b.then(0.1);
    b.fits(RUNNER_SCREW, runners.flatMap((r) => [-1, 1].map((e): FitOpts => ({ on: r.on, at: [r.at[0], r.at[1] + 4, zRun + e * (runLen / 2 - 40)], dir: r.dir }))), 0.1);
  });
  step(b, "Tap the dowels into the two rails", "One into each end of both.", "dowels", { scene: "rails", tools: ["hammer"] }, () => {
    b.stagger(0.15);
    b.stage(rail, [0, RT / 2, 120], [0, 0, 0], [0, 120, 0]);
    b.stage(backRail, [0, t / 2, -120], [Math.PI / 2, 0, 0], [0, 120, 0]);
    b.then(0.15);
    b.fits(DOWEL, [0, 1].flatMap((i) => js(i).map((j) => j.dowel)), 0.1);
  });
  step(b, "Screw the cam bolts into the sides", "Two in each, at the bottom of the front and back edges.", "cams", { scene: "prep", tools: ["allen"] }, () => b.fits(CAM_BOLT, [0, 1].flatMap((i) => js(i).map((j) => j.bolt)), 0.1));
  step(b, "Stand the rails in the left side", "Lay it on the rug, runner up, and push both rails onto their dowels and cam bolts.", "join", { pose: "+x", warnings: ["floor"] }, () => {
    b.add(sides[0], [0, 0, 0]);
    b.then(0.15);
    b.stagger(0.2);
    for (const key of [backRail, rail]) b.add(key, [260, 0, 0]);
  });
  step(b, "Lock the rails with cam locks", "Arrow towards the bolt, then a clockwise turn.", "cams", { pose: "+x", tools: ["screwdriver"] }, () => b.fits(CAM, js(0).map((j) => j.cam), 0.12));
  step(b, "Put the other side on and lock it", "Lower it onto the rails, then turn its two cam locks.", "cams", { pose: "+x", tools: ["screwdriver"] }, () => {
    b.add(sides[1], [400, 0, 0]);
    b.then(0.15);
    b.fits(CAM, js(1).map((j) => j.cam), 0.12);
  });
  step(b, "Hook the top on", "Lay it on its back. Push the two connectors into the underside of the top and slide it onto the sides until it clicks.", "join", { pose: "+z", warnings: ["floor"] }, () => {
    b.fits(TOP_CLIP, [0, 1].map((i): FitOpts => ({ on: top, at: [sg(i) * (xo - t / 2), yt, 0], dir: [0, 1, 0] })), 0.12);
    b.then(0.15);
    b.add(top, [0, 300, 0]);
  });
  step(b, "Stand it on its top and slide in the back", "Down the grooves in the sides, cable hole at the bottom.", "join", { pose: "-y" }, () => b.add(back, [0, -500, 0]));
  step(b, "Screw the back to the back rail", "Two small screws.", "screws", { pose: "-y", tools: ["screwdriver"] }, () =>
    b.fits(BACK_SCREW, [-1, 1].map((g): FitOpts => ({ on: back, at: [g * (xi - 80), yb + BR / 2, zb + 6.5], dir: [0, 0, 1], mate: backRail })), 0.15),
  );
  step(b, "Push in the back clips", "Three along each side.", "general", { pose: "-y" }, () =>
    b.fits(BACK_CLIP, [0, 1].flatMap((i) => spread(yb + 150, yt - 100, 3).map((yy): FitOpts => ({ on: back, at: [sg(i) * (xi - 10), yy, zb + 9.5], dir: [0, 0, 1], hole: false }))), 0.08),
  );
  underframe(b, k, c, sides, { brackets: false, glides: true });
  step(b, "Stand it up", "Turn it over onto its legs.", "standup", {}, () => {});
  step(b, "Put the shelf in", "Push the four shelf pins into the sides, slide the shelf in over the drawer space and press it down onto them.", "shelves", {}, () => {
    b.fits(PIN, [0, 1].flatMap((i) => [zb + 60, zf - 60].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, shelfY - 13, z], dir: [sg(i), 0, 0] }))), 0.1);
    b.then(0.15);
    b.add(shelf, [0, 0, 360]);
  });
  camDrawerSteps(b, d);
  return true;
}

/* ---------- tables on two leg frames ---------- */

const SHELF_CLIP: HwDef = { kind: "clip", len: 20, dia: 20 };
const TOP_SCREW: HwDef = { kind: "screw", len: 60, dia: 6 };

interface Frames {
  W: number;
  D: number;
  H: number;
  lw: number;
  xl: number; // leg centres
  zl: number;
  xin: number; // inner faces of the frames
  zin: number;
  yt: number; // underside of the top
  frames: string[];
  top: string;
}

/** The top and two side frames, each two legs joined by a top and a bottom rail at the factory. */
function framesOf(k: Kit, s: ProductSpec, o: { lw?: number; topT?: number; ov?: number; low: number; lowH?: number; topH?: number }): Frames {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const lw = o.lw ?? 40, topT = o.topT ?? 22, ov = o.ov ?? 15;
  const xl = W / 2 - ov - lw / 2, zl = D / 2 - ov - lw / 2;
  const yt = H - topT;
  const top = k.part("Top", [W, topT, D], [0, H - topT / 2, 0]);
  const rt = lw, th = o.topH ?? 70, lh = o.lowH ?? 40;
  const frames = [-1, 1].map((g) => {
    const pieces = [
      ...[-1, 1].map((e) => ({ shape: "box" as const, size: [lw, yt, lw] as Vec3, pos: [0, yt / 2, e * zl] as Vec3 })),
      { shape: "box" as const, size: [rt, th, 2 * zl - lw] as Vec3, pos: [0, yt - th / 2, 0] as Vec3 },
      { shape: "box" as const, size: [rt, lh, 2 * zl - lw] as Vec3, pos: [0, o.low, 0] as Vec3 },
    ];
    return k.compound("Leg frame", pieces, [g * xl, 0, 0], [0, yt / 2, 0]);
  });
  return { W, D, H, lw, xl, zl, xin: xl - lw / 2, zin: zl - lw / 2, yt, frames, top };
}

/** A part joining the two frames: where its ends meet them (y, z), how many cam bolts and dowels at each end. */
interface Member {
  key: string;
  pts: [number, number][]; // y, z of each joint at one end
  camDir: Vec3; // the way the cam locks go into the member
  dowels: "frame" | "member";
  doff?: Vec3; // where the dowel sits from the cam bolt (default 24 mm higher, which suits rails 60 mm or more tall)
}

function memberFits(f: Frames, m: Member, i: number) {
  const g = i ? 1 : -1;
  const x = g * f.xin;
  const [ox, oy, oz] = m.doff ?? [0, 24, 0];
  return {
    bolts: m.pts.map(([y, z]): FitOpts => ({ on: f.frames[i], at: [x, y, z], dir: [g, 0, 0], mate: m.key, mateHole: 4 })),
    dowels: m.pts.map(([y, z]): FitOpts =>
      m.dowels === "frame" ? { on: f.frames[i], at: [x + ox, y + oy, z + oz], dir: [g, 0, 0], mate: m.key } : { on: m.key, at: [x + ox, y + oy, z + oz], dir: [-g, 0, 0], mate: f.frames[i] },
    ),
    cams: m.pts.map(([y, z]): FitOpts => ({ on: m.key, at: [g * (f.xin - 30), y, z - m.camDir[2] * 10 - m.camDir[1] * 0], dir: m.camDir })),
  };
}

function stageFrames(b: PlanBuilder, f: Frames) {
  f.frames.forEach((key, i) => b.stage(key, [0, 20, (i ? 1 : -1) * (f.D / 2 + 40)], [0, 0, Math.PI / 2], [0, 160, 0]));
}

function glideStep(b: PlanBuilder, f: Frames, what = "Tap the glides into the legs") {
  step(b, what, "Lay both frames on a rug. One glide into the bottom of each leg.", "general", { scene: "prep", tools: ["hammer"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    stageFrames(b, f);
    b.then(0.2);
    b.fits(GLIDE, f.frames.flatMap((key, i) => [-1, 1].map((e): FitOpts => ({ on: key, at: [(i ? 1 : -1) * f.xl, 0, e * f.zl], dir: [0, 1, 0], hole: false }))), 0.1);
  });
}

/** The top: dowels in the tops of the legs, the top laid on, and long screws up through the frames' top rails. */
function topSteps(b: PlanBuilder, f: Frames, o: { screws: number; bolts?: number; people?: 1 | 2 }) {
  step(b, "Tap the dowels into the tops of the legs", "One in each leg.", "dowels", { tools: ["hammer"] }, () =>
    b.fits(DOWEL, f.frames.flatMap((key, i) => [-1, 1].map((e): FitOpts => ({ on: key, at: [(i ? 1 : -1) * f.xl, f.yt, e * f.zl], dir: [0, -1, 0], mate: f.top }))), 0.1),
  );
  if (o.bolts) {
    const pts = f.frames.flatMap((_, i) => spread(-f.zin + 30, f.zin - 30, o.bolts! / 2).map((z): Vec3 => [(i ? 1 : -1) * (f.xin + 10), f.yt, z]));
    step(b, "Screw the cam bolts into the top", "Lay it upside down on a rug.", "cams", { scene: "top", tools: ["allen"], warnings: ["face"] }, () => {
      b.stage(f.top, [0, 11, 0], [Math.PI, 0, 0], [0, 160, 0]);
      b.then(0.15);
      b.fits(CAM_BOLT, pts.map((at): FitOpts => ({ on: f.top, at, dir: [0, 1, 0], mate: f.frames[at[0] < 0 ? 0 : 1], mateHole: 4 })), 0.1);
    });
    step(b, "Lay the top on and lock it", "Onto the dowels, then turn the cam locks in the frames' top rails.", "cams", { tools: ["screwdriver"], people: o.people }, () => {
      b.add(f.top, [0, 300, 0]);
      b.then(0.15);
      b.fits(CAM, pts.map((at): FitOpts => ({ on: f.frames[at[0] < 0 ? 0 : 1], at: [at[0] + (at[0] < 0 ? -10 : 10), at[1] - 30, at[2]], dir: [at[0] < 0 ? 1 : -1, 0, 0] })), 0.1);
    });
  } else step(b, "Lay the top on", "Line it up so it overhangs evenly all round, onto the dowels.", "join", { people: o.people }, () => b.add(f.top, [0, 300, 0]));
  if (o.screws)
    step(b, "Screw the top on from below", "Long screws up through the frames' top rails, with the Allen key.", "screws", { tools: ["allen"] }, () => {
      const zs = o.screws === 2 ? [0] : [-f.zin / 2, f.zin / 2];
      const xs = o.screws === 2 ? [0, 1] : [0, 1];
      b.fits(TOP_SCREW, xs.flatMap((i) => zs.map((z): FitOpts => ({ on: f.frames[i], at: [(i ? 1 : -1) * f.xl, f.yt - 70, z], dir: [0, 1, 0], mate: f.top }))), 0.12);
    });
}

/** The side table: four rails between the frames, a shelf on pins at the bottom and one on clips in the middle. */
function buildSideTable(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const low = 130;
  const f = framesOf(k, s, { low, topH: 70 });
  const { xin, zin, yt } = f;
  const rail = (name: string, h: number, y: number, e: number) => k.part(name, [2 * xin, h, 20], [0, y, e * (zin - 10)]);
  const upper = [-1, 1].map((e) => rail("Top rail", 70, yt - 35, e));
  const lower = [-1, 1].map((e) => rail("Bottom rail", 40, low, e));
  const ms = (key: string, y: number, e: number, doff?: Vec3): Member => ({ key, pts: [[y, e * (zin - 10)]], camDir: [0, 0, e], dowels: "member", doff });
  const mU = upper.map((key, i) => ms(key, yt - 35, i ? 1 : -1));
  const mL = lower.map((key, i) => ms(key, low, i ? 1 : -1, [0, 12, 0]));
  const shelfLow = k.part("Bottom shelf", [2 * xin - 4, 16, 2 * zin - 44], [0, low + 30, 0]);
  const midY = Math.round((low + yt) / 2);
  const shelfMid = k.part("Middle shelf", [2 * xin - 4, 16, 2 * zin - 4], [0, midY, 0]);
  const fits = (ms2: Member[], i: number) => ms2.map((m) => memberFits(f, m, i));
  const all = [...mU, ...mL];
  glideStep(b, f);
  step(b, "Screw the cam bolts into the frames", "Into the small holes on the inside of the legs, two at the top and two at the bottom of each frame.", "cams", { scene: "prep", tools: ["allen"] }, () =>
    b.fits(CAM_BOLT, [0, 1].flatMap((i) => fits(all, i).flatMap((x) => x.bolts)), 0.08),
  );
  step(b, "Tap the dowels into the top rails", "One into each end. Check which way round they go: the cam lock holes face in.", "dowels", { scene: "rails", tools: ["hammer"] }, () => {
    b.stagger(0.15);
    upper.forEach((key, i) => b.stage(key, [0, 10, (i - 0.5) * 120], [Math.PI / 2, 0, 0], [0, 120, 0]));
    b.then(0.15);
    b.fits(DOWEL, [0, 1].flatMap((i) => fits(mU, i).flatMap((x) => x.dowels)), 0.1);
  });
  step(b, "Stand the top rails in one frame and lock them", "Lay the frame on the rug, push the rails onto their bolts and turn the cam locks.", "cams", { pose: "+x", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    b.add(f.frames[0], [0, 0, 0]);
    b.then(0.15);
    for (const key of upper) b.add(key, [200, 0, 0]);
    b.then(0.15);
    b.fits(CAM, fits(mU, 0).flatMap((x) => x.cams), 0.12);
  });
  step(b, "Tap the dowels into the bottom rails", "One into each end.", "dowels", { scene: "rails", tools: ["hammer"] }, () => {
    b.stagger(0.15);
    lower.forEach((key, i) => b.stage(key, [0, 10, (i - 0.5) * 120], [Math.PI / 2, 0, 0], [0, 120, 0]));
    b.then(0.15);
    b.fits(DOWEL, [0, 1].flatMap((i) => fits(mL, i).flatMap((x) => x.dowels)), 0.1);
  });
  step(b, "Stand the bottom rails in and lock them", "The same way, at the bottom of the frame.", "cams", { pose: "+x", tools: ["screwdriver"] }, () => {
    for (const key of lower) b.add(key, [200, 0, 0]);
    b.then(0.15);
    b.fits(CAM, fits(mL, 0).flatMap((x) => x.cams), 0.12);
  });
  step(b, "Put the other frame on and lock it", "Lower it onto all four rails, then turn the four cam locks.", "cams", { pose: "+x", tools: ["screwdriver"] }, () => {
    b.add(f.frames[1], [300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, fits(all, 1).flatMap((x) => x.cams), 0.1);
  });
  step(b, "Stand it up and put in the bottom shelf", "Push the six shelf pins into the bottom rails, then lay the shelf on them.", "shelves", {}, () => {
    b.fits(PIN, [...lower.flatMap((key, i) => [-1, 0, 1].map((e): FitOpts => ({ on: key, at: [e * (xin - 40), low + 20, (i ? 1 : -1) * (zin - 20)], dir: [0, 0, i ? 1 : -1] })))], 0.08);
    b.then(0.15);
    b.add(shelfLow, [0, 260, 0]);
  });
  step(b, "Fit the middle shelf on its clips", "Push the four clips into the legs, then press the shelf down onto them.", "shelves", {}, () => {
    b.fits(SHELF_CLIP, [0, 1].flatMap((i) => [-1, 1].map((e): FitOpts => ({ on: f.frames[i], at: [(i ? 1 : -1) * f.xin, midY - 8, e * (zin - 20)], dir: [i ? 1 : -1, 0, 0] }))), 0.1);
    b.then(0.15);
    b.add(shelfMid, [0, 260, 0]);
  });
  topSteps(b, f, { screws: 4 });
  return true;
}

/** The console table: a back board, a front rail and two bottom rails between the frames, shelves in the middle and at the bottom. */
function buildConsole(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const low = 150;
  const f = framesOf(k, s, { low, topH: 80 });
  const { xin, zin, yt } = f;
  const bh = 240;
  const back = k.part("Back board", [2 * xin, bh, 18], [0, yt - bh / 2, -zin + 9]);
  const front = k.part("Front rail", [2 * xin, 60, 18], [0, yt - 30, zin - 9]);
  const lower = [-1, 1].map((e) => k.part("Bottom rail", [2 * xin, 40, 20], [0, low, e * (zin - 10)]));
  const midY = yt - bh - 9;
  const shelfMid = k.part("Shelf", [2 * xin, 18, 2 * zin - 36], [0, midY, 0]);
  const shelfLow = k.part("Bottom shelf", [2 * xin - 4, 16, 2 * zin - 44], [0, low + 28, 0]);
  const mBack: Member = { key: back, pts: [[yt - 50, -zin + 9], [yt - bh + 50, -zin + 9]], camDir: [0, 0, -1], dowels: "frame" };
  const mFront: Member = { key: front, pts: [[yt - 30, zin - 9]], camDir: [0, 0, 1], dowels: "frame" };
  const mLow = lower.map((key, i): Member => ({ key, pts: [[low, (i ? 1 : -1) * (zin - 10)]], camDir: [0, 0, i ? 1 : -1], dowels: "frame", doff: [0, 12, 0] }));
  const all = [mBack, mFront, ...mLow];
  const fits = (ms: Member[], i: number) => ms.map((m) => memberFits(f, m, i));
  // the back board takes one dowel at each end, not two
  const dowelsOf = (i: number) => [...fits([mBack], i)[0].dowels.slice(0, 1), ...fits([mFront, ...mLow], i).flatMap((x) => x.dowels)];
  glideStep(b, f);
  step(b, "Screw the cam bolts into the frames", "Five on the inside of each frame.", "cams", { scene: "prep", tools: ["allen"] }, () => b.fits(CAM_BOLT, [0, 1].flatMap((i) => fits(all, i).flatMap((x) => x.bolts)), 0.06));
  step(b, "Tap the dowels into the frames", "Four in each, next to the cam bolts.", "dowels", { scene: "prep", tools: ["hammer"] }, () => b.fits(DOWEL, [0, 1].flatMap(dowelsOf), 0.08));
  step(b, "Stand the back board in one frame and lock it", "Lay the frame on the rug. The board goes at the top of the back edge: two cam locks.", "cams", { pose: "+x", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    b.add(f.frames[0], [0, 0, 0]);
    b.then(0.15);
    b.add(back, [300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, fits([mBack], 0)[0].cams, 0.12);
  });
  step(b, "Stand the front rail in and lock it", "At the top of the front edge, one cam lock.", "cams", { pose: "+x", tools: ["screwdriver"] }, () => {
    b.add(front, [300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, fits([mFront], 0)[0].cams, 0.12);
  });
  step(b, "Stand the bottom rails in and lock them", "One at the front and one at the back, near the feet.", "cams", { pose: "+x", tools: ["screwdriver"] }, () => {
    for (const key of lower) b.add(key, [300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, fits(mLow, 0).flatMap((x) => x.cams), 0.12);
  });
  step(b, "Put the other frame on and lock it", "Lower it onto all four pieces, then turn the five cam locks.", "cams", { pose: "+x", tools: ["screwdriver"], people: 2 }, () => {
    b.add(f.frames[1], [400, 0, 0]);
    b.then(0.15);
    b.fits(CAM, fits(all, 1).flatMap((x) => x.cams), 0.1);
  });
  step(b, "Stand it up and put in the bottom shelf", "Push four shelf pins into each bottom rail, then lay the shelf on them.", "shelves", {}, () => {
    b.fits(PIN, lower.flatMap((key, i) => spread(-xin + 60, xin - 60, 4).map((x): FitOpts => ({ on: key, at: [x, low + 20, (i ? 1 : -1) * (zin - 20)], dir: [0, 0, i ? 1 : -1] }))), 0.06);
    b.then(0.15);
    b.add(shelfLow, [0, 260, 0]);
  });
  step(b, "Slide in the shelf", "Push the five clips into the back board and the front rail, then slide the shelf in over them from the side.", "shelves", {}, () => {
    b.fits(SHELF_CLIP, [...spread(-xin + 80, xin - 80, 3).map((x): FitOpts => ({ on: back, at: [x, midY + 9, -zin + 18], dir: [0, 0, -1] })), ...[-1, 1].map((g): FitOpts => ({ on: front, at: [g * (xin - 80), yt - 60, zin - 18], dir: [0, 0, 1] }))], 0.1);
    b.then(0.15);
    b.add(shelfMid, [700, 0, 0]);
  });
  topSteps(b, f, { screws: 2, bolts: 4 });
  return true;
}

/**
 * The coffee tables, built lying on one frame: top rails, then the middle shelf with its centre board (and on the
 * long table the divider between the drawers and a bottom panel), a bottom rail, the other frame. Stood up, the top
 * frame is screwed on from below and the glass dropped in. The square table's drawer runs right through and opens
 * from both sides; the long one has two drawers at the front.
 */
function buildCoffee(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const W = s.size.w * 10;
  const long = W > 900;
  const TT = 40; // the top frame
  const H = s.size.h * 10;
  const yt0 = H - TT;
  const drawerH = 130, openH = 150;
  const y7 = yt0 - openH - 9; // middle shelf
  const ydb = y7 - 9 - drawerH; // bottom of the drawer space
  const f = framesOf(k, s, { lw: 48, topT: TT, ov: 10, low: ydb + 30, lowH: 60, topH: 60 });
  const { xin, zin, yt, frames } = f;
  const RT = 20;
  const topRails = [-1, 1].map((e) => k.part("Top rail", [2 * xin, 60, RT], [0, yt - 30, e * (zin - RT / 2)]));
  const shelf = k.part("Shelf", [2 * xin, 18, 2 * zin], [0, y7, 0]);
  const pieces: PartPiece[] = [
    ...[-1, 1].map((e) => ({ shape: "box" as const, size: [W, TT, 70] as Vec3, pos: [0, 0, e * (f.D / 2 - 35)] as Vec3 })),
    ...[-1, 1].map((g) => ({ shape: "box" as const, size: [70, TT, f.D - 140] as Vec3, pos: [g * (W / 2 - 35), 0, 0] as Vec3 })),
  ];
  // the top here is a frame round the glass, not a board
  b.items.splice(b.items.findIndex((it) => it.key === f.top), 1);
  b.map.delete(f.top);
  const topFrame = k.compound("Top frame", pieces, [0, H - TT / 2, 0], [0, 0, 0]);
  const glass = k.part("Glass top", [W - 130, 5, f.D - 130], [0, H - 8, 0], { material: "metal" });
  const fr = { ...f, top: topFrame };
  let center: string, upper = "", divider = "", bottom = "", bottomRail: string;
  const zc = 0;
  if (!long) {
    center = k.part("Centre board", [2 * xin, openH - 18, 18], [0, y7 + 9 + (openH - 18) / 2, zc]);
    upper = k.part("Upper panel", [2 * xin, 18, 2 * zin - 2 * RT], [0, yt0 - 9, 0]);
    bottomRail = k.part("Bottom rail", [2 * xin, 40, RT], [0, ydb - 20, 0]);
  } else {
    center = k.part("Centre board", [2 * xin, drawerH, 18], [0, ydb + drawerH / 2, zc]);
    divider = k.part("Divider", [18, drawerH, zin - 9], [0, ydb + drawerH / 2, (zin + 9) / 2]);
    bottom = k.part("Bottom panel", [2 * xin, 18, 2 * zin], [0, ydb - 9, 0]);
    bottomRail = k.part("Bottom rail", [2 * xin, 40, RT], [0, ydb - 38, zin - RT / 2]);
  }
  // drawers
  const zf = zin;
  const dd = long ? zin - 9 - 18 - 10 : 2 * zin - 36 - 10;
  const runLen = Math.round((dd - 20) / 50) * 50;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 40 };
  const zRun = long ? zf - 22 - runLen / 2 : 0;
  const cellsX = long ? [-1, 1].map((g) => ({ x: (g * (xin + 9)) / 2, ow: xin - 9 })) : [{ x: 0, ow: 2 * xin }];
  const drawers = cellsX.map((c) => makeDrawer(k, { x: c.x, yb: ydb, ow: c.ow, oh: drawerH, zf: long ? zf : zf, dd: long ? dd : 2 * zin - 18 - 4, knobs: 1, stiff: 2, through: !long }));
  const g = (i: number) => (i ? 1 : -1);
  const m = (key: string, pts: [number, number][], camDir: Vec3, doff?: Vec3): Member => ({ key, pts, camDir, dowels: "member", doff });
  const mTop = topRails.map((key, i) => m(key, [[yt - 30, g(i) * (zin - RT / 2)]], [0, 0, g(i)]));
  // boards lying flat take the dowel beside the cam bolt, inside their thickness
  const flat: Vec3 = [0, 0, 40];
  const mShelf = m(shelf, [[y7, -zin / 2], [y7, zin / 2]], [0, 1, 0], flat);
  const mUpper = upper ? m(upper, [[yt0 - 9, -zin / 2], [yt0 - 9, zin / 2]], [0, -1, 0], flat) : null;
  const mBottom = bottom ? m(bottom, [[ydb - 9, -zin / 2], [ydb - 9, zin / 2]], [0, 1, 0], flat) : null;
  const mRail = m(bottomRail, [[k.pos(bottomRail)[1], k.pos(bottomRail)[2]]], [0, 0, 1], [0, 12, 0]);
  const F = (ms: Member, i: number) => memberFits(f, ms, i);
  // which joints get cam locks (the rest are dowels only), as the manual counts them
  const camsAt = (i: number): FitOpts[] => {
    const out: FitOpts[] = [...mTop.flatMap((x) => F(x, i).cams)];
    if (mUpper) out.push(...F(mUpper, i).cams);
    if (i === 1) out.push(F(mRail, 1).cams[0], F(mShelf, 1).cams[0]);
    if (mBottom) out.push(F(mBottom, i).cams[0]);
    return out;
  };
  const boltsAt = (i: number): FitOpts[] => {
    const out: FitOpts[] = [...mTop.flatMap((x) => F(x, i).bolts)];
    if (mUpper) out.push(...F(mUpper, i).bolts);
    if (i === 1) out.push(F(mRail, 1).bolts[0], F(mShelf, 1).bolts[0]);
    if (mBottom) out.push(F(mBottom, i).bolts[0]);
    return out;
  };
  const runners = frames.map((key, i): FitOpts => ({ on: key, at: [g(i) * f.xin, ydb + 14 - 6, zRun], dir: [g(i), 0, 0], hole: false }));
  const runnerScrews = (r: FitOpts): FitOpts[] => [-1, 1].map((e) => ({ on: r.on, at: [r.at[0], r.at[1] + 4, zRun + e * (runLen / 2 - 40)], dir: r.dir }));
  glideStep(b, f);
  for (const i of [0, 1])
    step(b, `Screw a runner to the ${i ? "other" : "first"} frame`, `On the inside of the lower rail, marked ${i ? "R" : "L"}, wheel towards the ${long ? "front" : "end"}.`, "runners", { scene: "prep", tools: ["screwdriver"] }, () => {
      b.fit(RUNNER, runners[i]);
      b.then(0.1);
      b.fits(RUNNER_SCREW, runnerScrews(runners[i]), 0.1);
    });
  step(b, "Screw the cam bolts into the frames", "Into the small holes on the inside, until they stop.", "cams", { scene: "prep", tools: ["allen"] }, () => b.fits(CAM_BOLT, [0, 1].flatMap(boltsAt), 0.06));
  step(b, "Tap the dowels into the top rails", "One into each end of both.", "dowels", { scene: "rails", tools: ["hammer"] }, () => {
    b.stagger(0.15);
    topRails.forEach((key, i) => b.stage(key, [0, 10, (i - 0.5) * 120], [Math.PI / 2, 0, 0], [0, 120, 0]));
    b.then(0.15);
    b.fits(DOWEL, [0, 1].flatMap((i) => mTop.flatMap((x) => F(x, i).dowels)), 0.1);
  });
  step(b, "Stand the top rails in one frame and lock them", "Lay the frame on a rug, push the rails onto their bolts and turn the cam locks.", "cams", { pose: "+x", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    b.add(frames[0], [0, 0, 0]);
    b.then(0.15);
    for (const key of topRails) b.add(key, [260, 0, 0]);
    b.then(0.15);
    b.fits(CAM, mTop.flatMap((x) => F(x, 0).cams), 0.12);
  });
  const shelfAt: Vec3 = [0, 9, 0];
  step(b, "Tap the dowels into the shelf", "Two into each end.", "dowels", { scene: "shelf", tools: ["hammer"] }, () => {
    b.stage(shelf, shelfAt, [0, 0, 0], [0, 120, 0]);
    b.then(0.15);
    b.fits(DOWEL, [0, 1].flatMap((i) => F(mShelf, i).dowels), 0.1);
  });
  const cb = k.pos(center);
  const down = long ? -1 : 1; // the centre board stands on the shelf: above it on the square table, under it on the long one
  step(b, "Stand the centre board on the shelf", "Tap three dowels into its edge first, then push it into the holes along the middle of the shelf.", "dowels", { scene: "shelf", tools: ["hammer"] }, () => {
    b.fits(DOWEL, [-1, 0, 1].map((e): FitOpts => ({ on: center, at: [e * (xin - 80), y7 + down * 9, zc], dir: [0, down, 0], mate: shelf })), 0.1);
    b.then(0.1);
    b.stage(center, [0, 18 + Math.abs(cb[1] - y7) - 9, 0], [0, 0, 0], [0, 200, 0]);
  });
  if (divider) {
    const dv = k.pos(divider);
    const dr = [-1, 1].map((e): FitOpts => ({ on: divider, at: [e * 9, ydb + 8, zRun], dir: [-e, 0, 0], hole: false }));
    step(b, "Screw the runners to the divider", "One on each face, wheels at the front.", "runners", { scene: "shelf", tools: ["screwdriver"] }, () => {
      b.stage(divider, [0, 9, dv[2] + 500], [0, 0, Math.PI / 2], [0, 120, 0]);
      b.then(0.15);
      b.fits(RUNNER, dr, 0.15);
      b.then(0.1);
      b.fits(RUNNER_SCREW, dr.flatMap(runnerScrews), 0.08);
    });
    step(b, "Stand the divider on the shelf and lock it", "Two cam bolts in the shelf, a dowel in the divider, then two cam locks.", "cams", { scene: "shelf", tools: ["allen", "screwdriver"] }, () => {
      const ys = y7 - 9;
      b.fits(CAM_BOLT, [dv[2] - 60, dv[2] + 60].map((z): FitOpts => ({ on: shelf, at: [0, ys, z], dir: [0, 1, 0], mate: divider, mateHole: 4 })), 0.1);
      b.fit(DOWEL, { on: divider, at: [0, ys, dv[2]], dir: [0, 1, 0], mate: shelf });
      b.then(0.1);
      b.stage(divider, [0, 18 + drawerH / 2 + 220, dv[2]], [0, 0, 0]);
      b.stage(divider, [0, 18 + drawerH / 2, dv[2]], [0, 0, 0]);
      b.then(0.15);
      b.fits(CAM, [dv[2] - 60, dv[2] + 60].map((z): FitOpts => ({ on: divider, at: [9, ys - 30, z], dir: [-1, 0, 0] })), 0.1);
    });
  }
  step(b, "Lower the shelf into the frame", long ? "Centre board and divider down, onto the shelf's dowels in the frame." : "Centre board up, onto the dowels in the frame. Hold it straight.", "join", { pose: "+x" }, () => {
    b.stagger(0);
    for (const key of [shelf, center, ...(divider ? [divider] : [])]) b.add(key, [300, 0, 0]);
  });
  const panel = upper || bottom;
  const mPanel = (mUpper ?? mBottom)!;
  step(b, long ? "Fit the bottom panel" : "Fit the upper panel", long ? "Tap a dowel into each end, push it in under the centre board and divider and turn its cam lock." : "Tap a dowel into each end, push it in on top of the centre board and turn its two cam locks.", "cams", { pose: "+x", tools: ["hammer", "screwdriver"] }, () => {
    b.fits(DOWEL, [0, 1].map((i) => F(mPanel, i).dowels[0]), 0.1);
    b.then(0.1);
    b.add(panel, [300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, long ? [F(mPanel, 0).cams[0]] : F(mPanel, 0).cams, 0.12);
  });
  step(b, `Screw it to the centre board${long ? " and divider" : ""}`, "Long screws with the Allen key, through the panel into their edges.", "screws", { pose: "+x", tools: ["allen"] }, () => {
    const yy = long ? ydb - 18 : yt0 - 18;
    const dir: Vec3 = [0, long ? 1 : -1, 0];
    const pts: Vec3[] = long ? [[-xin / 2, yy, zc], [xin / 2, yy, zc], [0, yy, (zin + 9) / 2]] : [[-xin / 2, yy + 18, zc], [xin / 2, yy + 18, zc]];
    b.fits(TOP_SCREW, pts.map((at, j): FitOpts => ({ on: panel, at, dir, mate: long && j === 2 ? divider : center })), 0.15);
  });
  step(b, "Fit the bottom rail", long ? "Tap a dowel into each end, push it in under the front edge of the bottom panel and screw it up into the panel." : "Tap a dowel into each end and push it in under the middle of the drawer space.", long ? "screws" : "dowels", { pose: "+x", tools: long ? ["hammer", "allen"] : ["hammer"] }, () => {
    b.fits(DOWEL, [0, 1].map((i) => F(mRail, i).dowels[0]), 0.1);
    b.then(0.1);
    b.add(bottomRail, [300, 0, 0]);
    if (long) {
      b.then(0.15);
      b.fit(TOP_SCREW, { on: bottomRail, at: [0, ydb - 58, zin - RT / 2], dir: [0, 1, 0], mate: bottom });
    }
  });
  step(b, "Put the other frame on together", "Lower it onto everything at once, then turn its cam locks.", "cams", { pose: "+x", tools: ["screwdriver"], people: 2 }, () => {
    b.add(frames[1], [400, 0, 0]);
    b.then(0.15);
    b.fits(CAM, camsAt(1), 0.1);
  });
  step(b, "Stand it up", "Turn it onto its legs and check that it stands square.", "standup", { check: "square" }, () => {});
  step(b, "Tap the dowels into the tops of the legs", "One in each leg.", "dowels", { tools: ["hammer"] }, () =>
    b.fits(DOWEL, frames.flatMap((key, i) => [-1, 1].map((e): FitOpts => ({ on: key, at: [g(i) * f.xl, yt, e * f.zl], dir: [0, -1, 0], mate: topFrame }))), 0.1),
  );
  const nRail = long ? 3 : 2;
  step(b, "Screw the top frame on from below", `Lay it onto the dowels, then ${2 * 2 + 2 * nRail} long screws up through the top rails.`, "screws", { tools: ["allen"] }, () => {
    b.add(topFrame, [0, 300, 0]);
    b.then(0.15);
    const pts: FitOpts[] = [
      ...frames.flatMap((key, i) => [-1, 1].map((e): FitOpts => ({ on: key, at: [g(i) * (f.xin + 10), yt - 60, e * (f.zin / 2)], dir: [0, 1, 0], mate: topFrame }))),
      ...topRails.flatMap((key, i) => spread(-xin + 80, xin - 80, nRail).map((x): FitOpts => ({ on: key, at: [x, yt - 60, g(i) * (zin - RT / 2)], dir: [0, 1, 0], mate: topFrame }))),
    ];
    b.fits(TOP_SCREW, pts, 0.08);
  });
  step(b, "Lay the glass in", "Hold it flat and lower it into the frame. Don't press on the corners.", "join", { warnings: ["hand"] }, () => b.add(glass, [0, 260, 0]));
  void fr;
  drawerSteps(b, drawers, { from: long ? [0, 0, 520] : [0, 0, 620] });
  return true;
}

/**
 * The bookcase: built lying on its back, the bottom and the fixed shelf hook into one side with plastic connectors,
 * the other side and the top hook on, the plinth rail is dowelled in under the bottom, then on its front the two
 * back panels slide in, are screwed and clipped, and the underframe goes on. Standing, it's fixed to the wall and
 * the loose shelves sit on pins.
 */
function buildBookcase(b: PlanBuilder, s: ProductSpec, cab = false) {
  const k = new Kit(b);
  const c = caseOf(s, 140);
  const { t, xo, xi, zb, zf, yb, yt, W, D } = c;
  const hc = yt - yb;
  const sides = [-1, 1].map((g) => k.part(g < 0 ? "Left side" : "Right side", [t, hc, zf - zb], [g * (xo - t / 2), (yb + yt) / 2, (zb + zf) / 2]));
  const top = k.part("Top", [W, 22, D], [0, c.H - 11, 0]);
  const PH = 60;
  const plinth = k.part("Plinth rail", [2 * xi, PH, t], [0, yb + PH / 2, zf - 10 - t / 2]);
  const depth = zf - zb - 12;
  const zs = zb + 12 + depth / 2;
  const yBottom = yb + PH + 9;
  // the high cabinet has a fixed panel under and over its drawer, the bookcase one fixed shelf
  const DH = 160;
  const yA = Math.round(yb + hc * (cab ? 0.38 : 0.46));
  const yB = yA + 18 + DH;
  const fixedY = cab ? [yA, yB] : [yA];
  const bottom = k.part("Bottom", [2 * xi, 18, depth], [0, yBottom, zs]);
  const fixed = fixedY.map((y) => k.part("Fixed shelf", [2 * xi, 18, depth], [0, y, zs]));
  const yTopFixed = fixedY[fixedY.length - 1];
  const adj = [yBottom + (yA - yBottom) / 2, yTopFixed + (yt - yTopFixed) / 2].map((y) => k.part("Shelf", [2 * xi - 2, 18, depth - (cab ? 40 : 20)], [0, Math.round(y), zs + (cab ? 0 : 10)]));
  const dd = Math.round((zf - 18 - (zb + 40)) / 10) * 10;
  const runLen = Math.round((dd - 20) / 50) * 50;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 40 };
  const zRun = zf - 22 - runLen / 2;
  const drawer = cab ? makeDrawer(k, { x: 0, yb: yA + 9, ow: 2 * xi, oh: DH, zf, dd, knobs: 2, stiff: 3 }) : null;
  const backs = [0, 1].map((i) => k.part("Back panel", [2 * xi + 12, hc / 2 - 2, 3], [0, yb + 2 + (i ? hc / 2 : 0) + (hc / 2 - 4) / 2, zb + 8], { material: "fiber" }));
  const sg = (i: number) => (i ? 1 : -1);
  const conn = (panel: string, y: number, i: number): FitOpts[] => [zb + 60, zf - 60].map((z) => ({ on: panel, at: [sg(i) * xi, y, z], dir: [-sg(i), 0, 0], mate: sides[i] }));
  if (drawer) {
    const runners = [0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * xi, drawer.y0 - 6, zRun], dir: [sg(i), 0, 0], hole: false }));
    step(b, "Screw a runner to each side", "Lay both sides on a rug, inside up. The runners are marked L and R: two screws each, wheel at the front.", "runners", { scene: "prep", tools: ["screwdriver"], warnings: ["floor"] }, () => {
      b.stagger(0.2);
      sides.forEach((key, i) => b.stage(key, [sg(i) * (hc / 2 + 60), t / 2, 0], [0, 0, (-sg(i) * Math.PI) / 2], [0, 160, 0]));
      b.then(0.2);
      b.fits(RUNNER, runners, 0.2);
      b.then(0.1);
      b.fits(RUNNER_SCREW, runners.flatMap((r) => [-1, 1].map((e): FitOpts => ({ on: r.on, at: [r.at[0], r.at[1] + 4, zRun + e * (runLen / 2 - 40)], dir: r.dir }))), 0.1);
    });
  }
  step(b, "Hook the bottom into one side", "Lay the side on its back edge on a rug. Push two connectors into each end of the bottom, then slide it into the keyholes and press down.", "join", { pose: "+z", warnings: ["floor"] }, () => {
    b.add(sides[0], [0, 0, 0]);
    b.then(0.15);
    b.fits(TOP_CLIP, conn(bottom, yBottom, 0), 0.1);
    b.then(0.1);
    b.add(bottom, [260, 0, 0]);
  });
  fixed.forEach((fx, j) =>
    step(b, cab ? (j ? "Hook in the panel over the drawer" : "Hook in the panel under the drawer") : "Hook in the fixed shelf", j ? "The same way, in the next row of holes up." : "The same way, in the holes near the middle. The edge with the holes for the back faces down.", "join", { pose: "+z" }, () => {
      b.fits(TOP_CLIP, conn(fx, fixedY[j], 0), 0.1);
      b.then(0.1);
      b.add(fx, [260, 0, 0]);
    }),
  );
  step(b, "Hook the other side on together", "Connectors into the free ends first, then lower the side on and press it down until they click.", "join", { pose: "+z", people: 2 }, () => {
    b.fits(TOP_CLIP, [...conn(bottom, yBottom, 1), ...fixed.flatMap((fx, j) => conn(fx, fixedY[j], 1))], 0.08);
    b.then(0.1);
    b.add(sides[1], [360, 0, 0]);
  });
  step(b, "Fit the plinth rail", "Tap two dowels into each end. Ease the sides apart a little, lower the rail in under the front of the bottom and push the sides back onto its dowels.", "dowels", { pose: "+z", tools: ["hammer"] }, () => {
    b.fits(DOWEL, [0, 1].flatMap((i) => [-15, 15].map((dy): FitOpts => ({ on: plinth, at: [sg(i) * xi, yb + PH / 2 + dy, zf - 10 - t / 2], dir: [-sg(i), 0, 0], mate: sides[i] }))), 0.1);
    b.then(0.1);
    between(b, sides, () => b.add(plinth, [0, 0, 260]));
  });
  step(b, "Hook the top on together", "Four connectors into its underside, then slide it onto the ends of the sides until it clicks.", "join", { pose: "+z", people: 2 }, () => {
    b.fits(TOP_CLIP, [0, 1].flatMap((i) => [zb + 60, zf - 60].map((z): FitOpts => ({ on: top, at: [sg(i) * (xo - t / 2), yt, z], dir: [0, 1, 0], mate: sides[i] }))), 0.08);
    b.then(0.15);
    b.add(top, [0, 400, 0]);
  });
  step(b, "Turn it over and slide in the back panels", "Lay it on its front. The two panels slide down the grooves from the bottom, one after the other.", "join", { pose: "-z", people: 2 }, () => {
    b.stagger(0.3);
    for (const key of [...backs].reverse()) b.add(key, [0, -900, 0]);
  });
  const screwPanels: [string, number][] = cab ? [[bottom, yBottom], [fixed[0], yA]] : [[bottom, yBottom], [fixed[0], yA]];
  step(b, "Screw the back to the shelves", "Eight small screws, into the bottom and the fixed shelf.", "screws", { pose: "-z", tools: ["screwdriver"] }, () =>
    b.fits(BACK_SCREW, screwPanels.flatMap(([key, y]) => spread(-xi + 60, xi - 60, 4).map((x): FitOpts => ({ on: backs[y > yb + hc / 2 ? 1 : 0], at: [x, y, zb + 6.5], dir: [0, 0, 1], mate: key }))), 0.06),
  );
  step(b, "Push in the back clips", "Along the sides and across the top, into the holes at the edge of the back.", "general", { pose: "-z" }, () =>
    b.fits(BACK_CLIP, [...[0, 1].flatMap((i) => spread(yb + 150, yt - 150, 5).map((y): FitOpts => ({ on: backs[y > yb + hc / 2 ? 1 : 0], at: [sg(i) * (xi - 10), y, zb + 9.5], dir: [0, 0, 1], hole: false }))), { on: backs[1], at: [0, yt - 20, zb + 9.5], dir: [0, 0, 1], hole: false }], 0.05),
  );
  underframe(b, k, c, sides, { brackets: true, tall: true, pose: "-z" });
  step(b, "Stand it up together", "Lift it upright from the top end, one of you at each end.", "standup", { people: 2 }, () => {});
  wallSteps(b, top, c);
  step(b, "Put in the shelves", "Four shelf pins for each shelf, at the height you want, then lay the shelf on them.", "shelves", {}, () => {
    b.fits(PIN, adj.flatMap((sh) => [0, 1].flatMap((i) => [zb + 60, zf - 60].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, k.pos(sh)[1] - 13, z], dir: [sg(i), 0, 0] })))), 0.06);
    b.then(0.15);
    b.stagger(0.2);
    for (const sh of adj) b.add(sh, [0, 0, 400]);
  });
  if (cab && drawer) {
    const walls = [{ x: -xi, key: sides[0] }, { x: xi, key: sides[1] }];
    doorSteps(b, [...makeDoors(k, { walls, yb: yBottom + 9, h: yA - 9 - yBottom - 9, zf }), ...makeDoors(k, { walls, yb: yB + 9, h: yt - yB - 9, zf, name: "Glass door", glass: true })]);
    drawerSteps(b, [drawer]);
  }
  return true;
}

/**
 * The TV bench: runners on the sides and the lower divider, the divider screwed up through the bottom, the shelf
 * laid on it and the sides hooked onto both, a front rail and the upper divider, the top hooked on, then upside down
 * for the back, the underframe and the centre leg. Two folding drawers go in under the shelf.
 */
function buildTvBench(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const c = caseOf(s, 140);
  const { t, xo, xi, zb, zf, yb, yt, W, D } = c;
  const hc = yt - yb;
  const sides = [-1, 1].map((g) => k.part(g < 0 ? "Left side" : "Right side", [t, hc, zf - zb], [g * (xo - t / 2), (yb + yt) / 2, (zb + zf) / 2]));
  const top = k.part("Top", [W, 22, D], [0, c.H - 11, 0]);
  const depth = zf - zb - 12, zs = zb + 12 + depth / 2;
  const bottom = k.part("Bottom", [2 * xi, 18, depth], [0, yb + 9, zs]);
  const dh = Math.round(hc * 0.42);
  const yShelf = yb + 18 + dh + 9;
  const shelf = k.part("Shelf", [2 * xi, 18, depth], [0, yShelf, zs]);
  const lowDiv = k.part("Lower divider", [t, dh, depth], [0, yb + 18 + dh / 2, zs]);
  const RT = 20;
  const rail = k.part("Front rail", [2 * xi, 60, RT], [0, yt - 30, zf - RT / 2]);
  const upDiv = k.part("Upper divider", [t, yt - (yShelf + 9), depth - RT], [0, (yt + yShelf + 9) / 2, zs - RT / 2]);
  const back = k.part("Back panel", [2 * xi + 12, hc - 6, 3], [0, yb + 3 + (hc - 6) / 2, zb + 8], { material: "fiber" });
  const cleg = k.part("Centre leg", [44, c.U, 44], [0, c.U / 2, zs]);
  const dd = Math.round((zf - 18 - (zb + 40)) / 10) * 10;
  const runLen = Math.round((dd - 20) / 50) * 50;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 40 };
  const zRun = zf - 22 - runLen / 2;
  const cells = [-1, 1].map((g) => ({ x: (g * (xi + t / 2)) / 2, ow: xi - t / 2 }));
  const drawers = cells.map((cl) => makeDrawer(k, { x: cl.x, yb: yb + 18, ow: cl.ow, oh: dh, zf, dd, knobs: 2 }));
  const sg = (i: number) => (i ? 1 : -1);
  const ry = drawers[0].y0 - 6;
  const runners: FitOpts[] = [
    ...[0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * xi, ry, zRun], dir: [sg(i), 0, 0], hole: false })),
    ...[-1, 1].map((g): FitOpts => ({ on: lowDiv, at: [g * (t / 2), ry, zRun], dir: [-g, 0, 0], hole: false })),
  ];
  const LONG: HwDef = { kind: "screw", len: 50, dia: 7 };
  step(b, "Screw the runners to the sides and the lower divider", "Lay them on a rug. One runner on each side, one on each face of the divider, wheels at the front.", "runners", { scene: "prep", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    b.stagger(0.15);
    sides.forEach((key, i) => b.stage(key, [sg(i) * (W / 2 - 200), t / 2, 0], [0, 0, (-sg(i) * Math.PI) / 2], [0, 160, 0]));
    b.stage(lowDiv, [0, t / 2, 0], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.then(0.2);
    b.fits(RUNNER, runners, 0.15);
    b.then(0.1);
    b.fits(RUNNER_SCREW, runners.flatMap((r) => [-1, 1].map((e): FitOpts => ({ on: r.on, at: [r.at[0], r.at[1] + 4, zRun + e * (runLen / 2 - 40)], dir: r.dir }))), 0.06);
  });
  step(b, "Screw the lower divider to the bottom", "Lay the bottom on the rug and stand the divider in the middle. One long screw up through the bottom, with the Allen key.", "screws", { tools: ["allen"], warnings: ["floor"] }, () => {
    b.add(bottom, [0, 200, 0]);
    b.then(0.15);
    b.add(lowDiv, [0, 260, 0]);
    b.then(0.15);
    b.fit(LONG, { on: bottom, at: [0, yb, zs], dir: [0, 1, 0], mate: lowDiv });
  });
  const conn = (panel: string, y: number, i: number): FitOpts[] => [zb + 60, zf - 60].map((z) => ({ on: panel, at: [sg(i) * xi, y, z], dir: [-sg(i), 0, 0], mate: sides[i] }));
  step(b, "Lay the shelf on and screw it to the divider", "One long screw down through the shelf into the divider.", "screws", { tools: ["allen"] }, () => {
    b.add(shelf, [0, 260, 0]);
    b.then(0.15);
    b.fit(LONG, { on: shelf, at: [0, yShelf + 9, zs], dir: [0, -1, 0], mate: lowDiv });
  });
  step(b, "Hook the sides on", "Push two connectors into each end of the bottom and the shelf, then slide each side on until they click.", "join", { people: 2 }, () => {
    b.fits(TOP_CLIP, [0, 1].flatMap((i) => [...conn(bottom, yb + 9, i), ...conn(shelf, yShelf, i)]), 0.06);
    b.then(0.15);
    b.stagger(0.3);
    for (const [i, key] of sides.entries()) b.add(key, [sg(i) * 300, 0, 0]);
  });
  const gap = 30;
  step(b, "Lay the front rail in at the top", "Tap a dowel into each end. Ease the sides apart a little and lay the rail between them at the top front.", "dowels", { tools: ["hammer"] }, () => {
    b.fits(DOWEL, [0, 1].map((i): FitOpts => ({ on: rail, at: [sg(i) * xi, yt - 30, zf - RT / 2], dir: [-sg(i), 0, 0], mate: sides[i] })), 0.1);
    b.then(0.1);
    b.stagger(0);
    sides.forEach((key, i) => {
      const f = b.partItem(key).final;
      b.stage(key, [f.pos[0] + sg(i) * gap, f.pos[1], f.pos[2]], f.rot);
    });
    b.then(0.1);
    b.add(rail, [0, 0, 260]);
  });
  step(b, "Push the sides in and screw the upper divider", "Press both sides onto the rail's dowels. Stand the divider on the shelf under the rail and screw through the rail into it.", "screws", { tools: ["allen"] }, () => {
    b.stagger(0);
    sides.forEach((key, i) => b.add(key, [sg(i) * gap, 0, 0]));
    b.then(0.15);
    b.add(upDiv, [0, 0, -300]);
    b.then(0.15);
    b.fit(LONG, { on: rail, at: [0, yt - 30, zf], dir: [0, 0, -1], mate: upDiv });
  });
  step(b, "Hook the top on together", "Connectors into its underside, then lay it on and slide it until it clicks.", "join", { people: 2 }, () => {
    b.fits(TOP_CLIP, [-1, 0, 1].map((g): FitOpts => ({ on: top, at: [g * (xo - t / 2), yt, 0], dir: [0, 1, 0] })), 0.1);
    b.then(0.15);
    b.add(top, [0, 300, 0]);
  });
  step(b, "Turn it upside down and slide in the back", "Down the grooves from the bottom, cable holes at the bottom edge.", "join", { pose: "-y", people: 2 }, () => b.add(back, [0, -500, 0]));
  step(b, "Screw the back on", "Six small screws into the bottom and the shelf, then four clips along the sides.", "screws", { pose: "-y", tools: ["screwdriver"] }, () => {
    b.fits(BACK_SCREW, [yb + 9, yShelf].flatMap((y) => [-1, 0, 1].map((e): FitOpts => ({ on: back, at: [e * (xi - 100), y, zb + 6.5], dir: [0, 0, 1], mate: y === yShelf ? shelf : bottom }))), 0.08);
    b.then(0.1);
    b.fits(BACK_CLIP, [0, 1].flatMap((i) => [yb + 120, yt - 120].map((y): FitOpts => ({ on: back, at: [sg(i) * (xi - 10), y, zb + 9.5], dir: [0, 0, 1], hole: false }))), 0.08);
  });
  underframe(b, k, c, sides, { brackets: true, tall: true, nBrackets: 4 });
  step(b, "Screw in the centre leg", "Under the middle of the bottom, with its foot.", "legs", { pose: "-y", tools: ["allen"] }, () => {
    b.add(cleg, [0, -200, 0]);
    b.then(0.15);
    b.fit(LONG, { on: cleg, at: [0, 0, zs], dir: [0, 1, 0], mate: bottom });
    b.then(0.1);
    b.fit(FOOT, { on: cleg, at: [0, 0, zs], dir: [0, 1, 0] });
  });
  step(b, "Stand it up together", "Turn it over onto its legs.", "standup", { people: 2 }, () => {});
  wallSteps(b, top, c);
  drawerSteps(b, drawers);
  return true;
}

/* ---------- doors ---------- */

const HINGE: HwDef = HW.hinge;
const PLATE_SCREW: HwDef = { kind: "screw", len: 13, dia: 4 };
const HINGE_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };

interface Door {
  key: string;
  edge: number; // x of the hinge edge
  g: number; // which way the hinge edge is from the door's middle
  wall: string; // the panel the hinges screw to
  wallX: number;
  ys: number[];
  zf: number; // front face of the cabinet
  knob: Vec3;
}

/** Doors: hinges into the doors face down, mounting plates in the cabinet, the doors clipped on, knobs. */
function doorSteps(b: PlanBuilder, ds: Door[], o: { glass?: boolean } = {}) {
  if (!ds.length) return;
  const many = ds.length > 1;
  const d0 = ds[0];
  const p0 = b.partItem(d0.key).final.pos;
  const hinges = (d: Door): FitOpts[] => d.ys.map((y) => ({ on: d.key, at: [d.edge - d.g * 40, y, d.zf - 20], dir: [0, 0, 1], twist: d.g > 0 ? Math.PI : 0 }));
  const hingeScrews = (d: Door): FitOpts[] => d.ys.flatMap((y) => [-1, 1].map((e): FitOpts => ({ on: d.key, at: [d.edge - d.g * 40, y + e * 22, d.zf - 20], dir: [0, 0, 1] })));
  const plates = (d: Door): FitOpts[] => d.ys.flatMap((y) => [-1, 1].map((e): FitOpts => ({ on: d.wall, at: [d.wallX, y + e * 16, d.zf - 40], dir: [d.g, 0, 0] })));
  step(b, many ? "Screw the hinges to the doors" : "Screw the hinges to the door", "Lay the door face down on a rug. Press each hinge into its round hole and screw it on, arm pointing out over the edge.", "hinges", { scene: "door", tools: ["screwdriver"], repeat: many ? ds.length : undefined, warnings: ["face"] }, () => {
    b.stage(d0.key, [0, 10, 0], [Math.PI / 2, 0, Math.PI], [0, 160, 0]);
    b.then(0.15);
    b.fits(HINGE, hinges(d0), 0.15);
    b.then(0.1);
    b.fits(HINGE_SCREW, hingeScrews(d0), 0.08);
  });
  void p0;
  step(b, "Screw the mounting plates inside", "Two for each door, on the side it hangs from, two screws each.", "hinges", { tools: ["screwdriver"] }, () => b.fits(PLATE_SCREW, ds.flatMap(plates), 0.04));
  step(b, many ? "Hang the doors" : "Hang the door", "Hook each hinge onto its plate and press until it clicks. Turn the hinge screws to even out the gaps.", "doors", { tools: ["screwdriver"], people: o.glass ? 2 : 1 }, () => {
    for (const [i, d] of ds.entries()) {
      b.add(d.key, [0, 0, 320]);
      if (i > 0) {
        for (const x of hinges(d)) b.preset(HINGE, x);
        for (const x of hingeScrews(d)) b.preset(HINGE_SCREW, x);
      }
      b.wait(0.15);
    }
  });
  step(b, many ? "Screw on the door knobs" : "Screw on the door knob", "From inside the door, by the edge away from the hinges.", "screws", { tools: ["screwdriver"] }, () => {
    b.fits(KNOB, ds.map((d): FitOpts => ({ on: d.key, at: d.knob, dir: [0, 0, -1], hole: false })), 0.12);
    b.then(0.05);
    b.fits(KNOB_SCREW, ds.map((d): FitOpts => ({ on: d.key, at: [d.knob[0], d.knob[1], d.zf - 20], dir: [0, 0, 1] })), 0.12);
  });
}

/** Doors side by side in an opening between two walls, hinged on the outer walls (pairs meet in the middle). */
function makeDoors(k: Kit, o: { walls: { x: number; key: string }[]; yb: number; h: number; zf: number; name?: string; glass?: boolean }): Door[] {
  const out: Door[] = [];
  for (let i = 0; i + 1 < o.walls.length; i++) {
    const L = o.walls[i], R = o.walls[i + 1];
    const w = (R.x - L.x) / 2;
    for (const g of [-1, 1]) {
      const x = (L.x + R.x) / 2 + (g * w) / 2;
      const dw = w - 3, dh = o.h - 4;
      const key = k.part(o.name ?? "Door", [dw, dh, 20], [x, o.yb + o.h / 2, o.zf - 10], {});
      const wall = g < 0 ? L : R;
      const ys = [o.yb + 90, o.yb + o.h - 90];
      if (o.h > 1300) ys.splice(1, 0, o.yb + o.h / 2);
      out.push({ key, edge: x + (g * dw) / 2, g, wall: wall.key, wallX: wall.x, ys, zf: o.zf, knob: [x - g * (dw / 2 - 40), o.yb + o.h * (o.h > 1300 ? 0.45 : 0.75), o.zf] });
    }
  }
  return out;
}

/**
 * The sideboard: like the TV bench, with the two drawers at the top. Runners on the sides and on the short drawer
 * divider, the middle divider screwed up through the bottom, the drawer shelf and the bottom hooked into the sides,
 * the rails, the top. Upside down for the back and the underframe; then a shelf in each cupboard and four doors.
 */
function buildSideboard(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const c = caseOf(s, 140);
  const { t, xo, xi, zb, zf, yb, yt, W, D } = c;
  const hc = yt - yb;
  const sides = [-1, 1].map((g) => k.part(g < 0 ? "Left side" : "Right side", [t, hc, zf - zb], [g * (xo - t / 2), (yb + yt) / 2, (zb + zf) / 2]));
  const top = k.part("Top", [W, 22, D], [0, c.H - 11, 0]);
  const depth = zf - zb - 12, zs = zb + 12 + depth / 2;
  const RT = 20, dh = 150;
  const bottom = k.part("Bottom", [2 * xi, 18, depth], [0, yb + 9, zs]);
  const yShelf = yt - RT - dh - 9;
  const dshelf = k.part("Drawer shelf", [2 * xi, 18, depth], [0, yShelf, zs]);
  const mid = k.part("Middle divider", [t, yShelf - 9 - (yb + 18), depth], [0, (yShelf - 9 + yb + 18) / 2, zs]);
  const ddivB = zs - depth / 2 + 15, ddivF = zf - 18;
  const ddiv = k.part("Drawer divider", [t, dh, ddivF - ddivB], [0, yShelf + 9 + dh / 2, (ddivB + ddivF) / 2]);
  const rail = k.part("Top rail", [2 * xi, RT, 50], [0, yt - RT / 2, zf - 25]);
  const back = k.part("Back panel", [2 * xi + 12, hc - 6, 3], [0, yb + 3 + (hc - 6) / 2, zb + 8], { material: "fiber" });
  const cleg = k.part("Centre leg", [44, c.U, 44], [0, c.U / 2, zs]);
  const shelves = [-1, 1].map((g) => k.part("Shelf", [xi - t / 2 - 4, 18, depth - 40], [(g * (xi + t / 2)) / 2, Math.round((yb + 18 + yShelf) / 2), zs - 10]));
  const dd = Math.round((zf - 18 - (zb + 40)) / 10) * 10;
  const runLen = Math.round((dd - 20) / 50) * 50;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 40 };
  const zRun = zf - 22 - runLen / 2;
  const drawers = [-1, 1].map((g) => makeDrawer(k, { x: (g * (xi + t / 2)) / 2, yb: yShelf + 9, ow: xi - t / 2, oh: dh, zf, dd, knobs: 1, stiff: 2 }));
  const sg = (i: number) => (i ? 1 : -1);
  const ry = drawers[0].y0 - 6;
  const runners: FitOpts[] = [
    ...[0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * xi, ry, zRun], dir: [sg(i), 0, 0], hole: false })),
    ...[-1, 1].map((g): FitOpts => ({ on: ddiv, at: [g * (t / 2), ry, zRun], dir: [-g, 0, 0], hole: false })),
  ];
  const LONG: HwDef = { kind: "screw", len: 50, dia: 7 };
  step(b, "Screw the runners to the sides and the drawer divider", "Lay them on a rug. One near the top of each side, one on each face of the short divider, wheels at the front.", "runners", { scene: "prep", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    b.stagger(0.15);
    sides.forEach((key, i) => b.stage(key, [sg(i) * (W / 2), t / 2, 0], [0, 0, (-sg(i) * Math.PI) / 2], [0, 160, 0]));
    b.stage(ddiv, [0, t / 2, 0], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.then(0.2);
    b.fits(RUNNER, runners, 0.15);
    b.then(0.1);
    b.fits(RUNNER_SCREW, runners.flatMap((r) => [-1, 1].map((e): FitOpts => ({ on: r.on, at: [r.at[0], r.at[1] + 4, zRun + e * (runLen / 2 - 40)], dir: r.dir }))), 0.06);
  });
  const conn = (panel: string, y: number, i: number): FitOpts[] => [zb + 60, zf - 60].map((z) => ({ on: panel, at: [sg(i) * xi, y, z], dir: [-sg(i), 0, 0], mate: sides[i] }));
  step(b, "Screw the middle divider to the bottom", "Lay the bottom on the rug and stand the divider in the middle. One long screw up through the bottom.", "screws", { tools: ["allen"], warnings: ["floor"] }, () => {
    b.add(bottom, [0, 200, 0]);
    b.then(0.15);
    b.add(mid, [0, 260, 0]);
    b.then(0.15);
    b.fit(LONG, { on: bottom, at: [0, yb, zs], dir: [0, 1, 0], mate: mid });
  });
  step(b, "Lay the drawer shelf on", "Tap four dowels into the top of the divider first, then press the shelf down onto them.", "dowels", { tools: ["hammer"] }, () => {
    b.fits(DOWEL, spread(zb + 60, zf - 60, 4).map((z): FitOpts => ({ on: mid, at: [0, yShelf - 9, z], dir: [0, -1, 0], mate: dshelf })), 0.08);
    b.then(0.15);
    b.add(dshelf, [0, 260, 0]);
  });
  step(b, "Screw the drawer divider on", "It stands on the shelf over the middle divider. One long screw up through the shelf.", "screws", { tools: ["allen"] }, () => {
    b.add(ddiv, [0, 260, 0]);
    b.then(0.15);
    b.fit(LONG, { on: dshelf, at: [0, yShelf - 9, zs], dir: [0, 1, 0], mate: ddiv });
  });
  step(b, "Hook the sides on", "Two connectors into each end of the bottom and the drawer shelf, then slide each side on until they click.", "join", { people: 2 }, () => {
    b.fits(TOP_CLIP, [0, 1].flatMap((i) => [...conn(bottom, yb + 9, i), ...conn(dshelf, yShelf, i)]), 0.06);
    b.then(0.15);
    b.stagger(0.3);
    for (const [i, key] of sides.entries()) b.add(key, [sg(i) * 300, 0, 0]);
  });
  step(b, "Fit the top rail", "Tap two dowels into each end. Ease the sides apart, swing the rail in at the top front and push the sides back onto it. One long screw down into the drawer divider.", "dowels", { tools: ["hammer", "allen"] }, () => {
    b.fits(DOWEL, [0, 1].flatMap((i) => [-12, 12].map((dz): FitOpts => ({ on: rail, at: [sg(i) * xi, yt - RT / 2, zf - 25 + dz], dir: [-sg(i), 0, 0], mate: sides[i] }))), 0.08);
    b.then(0.1);
    between(b, sides, () => b.add(rail, [0, 0, 260]));
    b.then(0.15);
    b.fit(LONG, { on: rail, at: [0, yt, zf - 25], dir: [0, -1, 0], mate: ddiv });
  });
  step(b, "Hook the top on together", "Connectors into its underside, then lay it on and slide it until it clicks.", "join", { people: 2 }, () => {
    b.fits(TOP_CLIP, [-1, 1].flatMap((g) => [zb + 80, zf - 80].map((z): FitOpts => ({ on: top, at: [g * (xo - t / 2), yt, z], dir: [0, 1, 0] }))), 0.1);
    b.then(0.15);
    b.add(top, [0, 300, 0]);
  });
  step(b, "Turn it upside down and slide in the back", "Down the grooves from the bottom.", "join", { pose: "-y", people: 2 }, () => b.add(back, [0, -600, 0]));
  step(b, "Screw the back on", "Small screws into the bottom, the shelf and the middle divider, then clips along the sides.", "screws", { pose: "-y", tools: ["screwdriver"] }, () => {
    b.fits(BACK_SCREW, [...[yb + 9, yShelf].flatMap((y) => [-1, 1].map((e): FitOpts => ({ on: back, at: [e * (xi - 100), y, zb + 6.5], dir: [0, 0, 1], mate: y === yShelf ? dshelf : bottom }))), ...[0.35, 0.7].map((f): FitOpts => ({ on: back, at: [0, yb + (yShelf - yb) * f, zb + 6.5], dir: [0, 0, 1], mate: mid }))], 0.08);
    b.then(0.1);
    b.fits(BACK_CLIP, [0, 1].flatMap((i) => spread(yb + 120, yt - 120, 3).map((y): FitOpts => ({ on: back, at: [sg(i) * (xi - 10), y, zb + 9.5], dir: [0, 0, 1], hole: false }))), 0.08);
  });
  underframe(b, k, c, sides, { brackets: true, tall: true });
  step(b, "Screw in the centre leg", "Under the middle divider, with its foot.", "legs", { pose: "-y", tools: ["allen"] }, () => {
    b.add(cleg, [0, -200, 0]);
    b.then(0.15);
    b.fit(LONG, { on: cleg, at: [0, 0, zs], dir: [0, 1, 0], mate: bottom });
    b.then(0.1);
    b.fit(FOOT, { on: cleg, at: [0, 0, zs], dir: [0, 1, 0] });
  });
  step(b, "Stand it up together", "Turn it over onto its legs.", "standup", { people: 2 }, () => {});
  wallSteps(b, top, c);
  step(b, "Put in the shelves", "Four shelf pins for each, then lay the shelf on them.", "shelves", {}, () => {
    const walls = [[-xi, -t / 2], [t / 2, xi]];
    b.fits(PIN, shelves.flatMap((sh, j) => walls[j].flatMap((x, e) => [zb + 60, zf - 80].map((z): FitOpts => ({ on: x === -xi ? sides[0] : x === xi ? sides[1] : mid, at: [x, k.pos(sh)[1] - 13, z], dir: [e ? 1 : -1, 0, 0] })))), 0.05);
    b.then(0.15);
    for (const sh of shelves) b.add(sh, [0, 0, 400]);
  });
  const dh2 = yShelf - 9 - yb - 18;
  doorSteps(b, [
    ...makeDoors(k, { walls: [{ x: -xi, key: sides[0] }, { x: -t / 2, key: mid }], yb: yb + 18, h: dh2, zf }),
    ...makeDoors(k, { walls: [{ x: t / 2, key: mid }, { x: xi, key: sides[1] }], yb: yb + 18, h: dh2, zf }),
  ]);
  drawerSteps(b, drawers);
  return true;
}

/**
 * The open wardrobe: two tall leg frames, built lying on one of them. Three rails and the two boards of the bottom
 * box go in on dowels and cam locks, the other frame on top, then the top is screwed on from below with the wall
 * brackets under it, the clothes rail hangs on two ring bolts, the feet go in, and stood up the box floor and the
 * shelf over it sit on pins.
 */
function buildOpenWardrobe(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const lowY = 420;
  const f = framesOf(k, s, { lw: 44, low: lowY, lowH: 40, topH: 80 });
  const { xin, zin, yt, frames, top, W } = f;
  const RT = 20;
  const railF = k.part("Top rail", [2 * xin, 60, RT], [0, yt - 40, zin - RT / 2]);
  const railB = k.part("Top rail", [2 * xin, 60, RT], [0, yt - 40, -zin + RT / 2]);
  const railM = k.part("Back rail", [2 * xin, 60, RT], [0, Math.round(yt * 0.55), -zin + RT / 2]);
  const bh = 220, by = 90 + bh / 2;
  const boxF = k.part("Box board", [2 * xin, bh, 18], [0, by, zin - 9]);
  const boxB = k.part("Box board", [2 * xin, bh, 18], [0, by, -zin + 9]);
  const floor = k.part("Box floor", [2 * xin - 2, 16, 2 * zin - 40], [0, 110, 0]);
  const shelf = k.part("Shelf", [2 * xin - 2, 18, 2 * zin - 4], [0, 90 + bh + 9, 0]);
  const rod = k.part("Clothes rail", [28, 2 * xin, 28], [0, yt - 140, 0], { shape: "cyl", material: "metal", rot: [0, 0, Math.PI / 2] });
  const g = (i: number) => (i ? 1 : -1);
  const m = (key: string, pts: [number, number][], camDir: Vec3): Member => ({ key, pts, camDir, dowels: "member" });
  const rails = [m(railF, [[yt - 40, zin - RT / 2]], [0, 0, 1]), m(railB, [[yt - 40, -zin + RT / 2]], [0, 0, -1]), m(railM, [[Math.round(yt * 0.55), -zin + RT / 2]], [0, 0, -1])];
  const boards = [m(boxF, [[by - 60, zin - 9], [by + 60, zin - 9]], [0, 0, 1]), m(boxB, [[by - 60, -zin + 9], [by + 60, -zin + 9]], [0, 0, -1])];
  const F = (ms: Member[], i: number) => ms.map((x) => memberFits(f, x, i));
  // a board takes one dowel at each end
  const dw = (ms: Member[], i: number) => F(ms, i).flatMap((x) => x.dowels.slice(0, 1));
  step(b, "Screw the cam bolts into the frames", "Lay both frames on a rug and screw the bolts into the small holes on their inside faces.", "cams", { scene: "prep", tools: ["allen"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    stageFrames(b, f);
    b.then(0.2);
    b.fits(CAM_BOLT, [0, 1].flatMap((i) => F([...rails, ...boards], i).flatMap((x) => x.bolts)), 0.04);
  });
  step(b, "Tap the dowels into the three rails", "One into each end.", "dowels", { scene: "rails", tools: ["hammer"] }, () => {
    b.stagger(0.12);
    [railF, railB, railM].forEach((key, i) => b.stage(key, [0, 10, (i - 1) * 110], [Math.PI / 2, 0, 0], [0, 120, 0]));
    b.then(0.15);
    b.fits(DOWEL, [0, 1].flatMap((i) => F(rails, i).flatMap((x) => x.dowels)), 0.06);
  });
  step(b, "Stand the rails in one frame and lock them", "Two at the top, one at the back halfway down. Three cam locks.", "cams", { pose: "+x", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    b.add(frames[0], [0, 0, 0]);
    b.then(0.15);
    b.stagger(0.15);
    for (const key of [railF, railB, railM]) b.add(key, [300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, F(rails, 0).flatMap((x) => x.cams), 0.1);
  });
  step(b, "Tap the dowels into the box boards", "One into each end of both.", "dowels", { scene: "rails", tools: ["hammer"] }, () => {
    b.stagger(0.15);
    [boxF, boxB].forEach((key, i) => b.stage(key, [0, 9, (i - 0.5) * 300], [Math.PI / 2, 0, 0], [0, 120, 0]));
    b.then(0.15);
    b.fits(DOWEL, [0, 1].flatMap((i) => dw(boards, i)), 0.08);
  });
  step(b, "Stand the box boards in and lock them", "At the bottom, one at the front and one at the back. Two cam locks each.", "cams", { pose: "+x", tools: ["screwdriver"] }, () => {
    for (const key of [boxF, boxB]) b.add(key, [300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, F(boards, 0).flatMap((x) => x.cams), 0.1);
  });
  step(b, "Put the other frame on together", "Lower it onto the rails and boards, then turn its seven cam locks.", "cams", { pose: "+x", tools: ["screwdriver"], people: 2 }, () => {
    b.add(frames[1], [500, 0, 0]);
    b.then(0.15);
    b.fits(CAM, F([...rails, ...boards], 1).flatMap((x) => x.cams), 0.08);
  });
  const brackets = [-1, 1].map((e): FitOpts => ({ on: top, at: [e * (xin - 80), yt, -f.D / 2 + 30], dir: [0, 1, 0], hole: false }));
  step(b, "Screw the wall brackets under the top", "Lay the top upside down. Two brackets at the back edge, each with a screw and washer.", "screws", { scene: "top", tools: ["screwdriver"], warnings: ["face"] }, () => {
    b.stage(top, [0, 11, 0], [Math.PI, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(HW.bracket, brackets, 0.15);
    b.then(0.1);
    b.fits(WASHER, brackets.map((x) => ({ ...x, at: [x.at[0], x.at[1] - 2, x.at[2] + 20] as Vec3 })), 0.12);
    b.fits(BACK_SCREW, brackets.map((x) => ({ ...x, at: [x.at[0], x.at[1] - 3, x.at[2] + 20] as Vec3, hole: undefined })), 0.12);
  });
  step(b, "Tap the dowels into the tops of the legs", "One in each leg.", "dowels", { pose: "+x", tools: ["hammer"] }, () =>
    b.fits(DOWEL, frames.flatMap((key, i) => [-1, 1].map((e): FitOpts => ({ on: key, at: [g(i) * f.xl, yt, e * f.zl], dir: [0, -1, 0], mate: top }))), 0.1),
  );
  step(b, "Screw the top on", "Push it onto the dowels, then six long screws through the frames' top rails into it.", "screws", { pose: "+x", tools: ["allen"] }, () => {
    b.add(top, [0, 300, 0]);
    b.then(0.15);
    b.fits(TOP_SCREW, frames.flatMap((key, i) => [-1, 0, 1].map((e): FitOpts => ({ on: key, at: [g(i) * f.xl, yt - 80, e * (zin - 60)], dir: [0, 1, 0], mate: top }))), 0.1);
  });
  step(b, "Hang the clothes rail", "Screw a ring bolt into each frame, slide the rail through both rings and tighten the nuts.", "general", { pose: "+x", tools: ["wrench"] }, () => {
    const rings = [0, 1].map((i): FitOpts => ({ on: frames[i], at: [g(i) * xin, yt - 140, 0], dir: [g(i), 0, 0] }));
    b.fits(HW.hook, rings, 0.15);
    b.then(0.1);
    b.fits(HW.nut, rings.map((r) => ({ ...r, at: [r.at[0] + r.dir[0] * 20, r.at[1], r.at[2]] as Vec3, hole: false as const })), 0.12);
    b.then(0.1);
    b.add(rod, [0, 0, 400]);
  });
  step(b, "Screw in the feet and stand it up together", "By hand into the bottom of each leg, then lift it upright.", "standup", { pose: "+y", people: 2 }, () =>
    b.fits(FOOT, frames.flatMap((key, i) => [-1, 1].map((e): FitOpts => ({ on: key, at: [g(i) * f.xl, 0, e * f.zl], dir: [0, 1, 0] }))), 0.1),
  );
  step(b, "Put in the box floor and the shelf", "Four pins in the box boards for the floor and four in the legs for the shelf over it. Tilt each one in and lay it down.", "shelves", {}, () => {
    b.fits(PIN, [...[boxF, boxB].flatMap((key, j) => [-1, 1].map((e): FitOpts => ({ on: key, at: [e * (xin - 50), 98, (j ? -1 : 1) * (zin - 18)], dir: [0, 0, j ? -1 : 1] }))), ...frames.flatMap((key, i) => [-1, 1].map((e): FitOpts => ({ on: key, at: [g(i) * xin, 90 + bh - 4, e * (zin - 40)], dir: [g(i), 0, 0] })))], 0.06);
    b.then(0.15);
    b.stagger(0.3);
    b.add(floor, [0, 300, 0]);
    b.add(shelf, [0, 300, 0]);
  });
  step(b, "Fix it to the wall", "Push it against the wall, mark through the brackets, drill, plug and screw. Use fixings made for your wall.", "anchor", { tools: ["drill", "pencil", "screwdriver"], wall: true, warnings: ["wall", "tip"] }, () => {
    const pts = brackets.map((x) => x.at);
    b.fits(WALL_PLUG, pts.map((p): FitOpts => ({ at: [p[0], p[1] - 20, -f.D / 2 - 2], dir: [0, 0, -1] })), 0.15);
    b.then(0.05);
    b.fits(WALL_SCREW, pts.map((p): FitOpts => ({ at: [p[0], p[1] - 20, -f.D / 2 + 10], dir: [0, 0, -1] })), 0.15);
  });
  void W;
  return true;
}

/**
 * The wardrobe: built lying on its back like the bookcase, the bottom and the top hooked onto the sides with three
 * connectors at each end, the plinth rail dowelled in and the middle divider hooked between top and bottom and
 * screwed. The clothes rail hangs on ring bolts, the back slides in with it on its front, then the underframe and
 * centre leg. Stood up and fixed to the wall, it gets its shelves and four doors on three hinges each.
 */
function buildWardrobe(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const c = caseOf(s, 140);
  const { t, xo, xi, zb, zf, yb, yt, W, D } = c;
  const hc = yt - yb;
  const sides = [-1, 1].map((g) => k.part(g < 0 ? "Left side" : "Right side", [t, hc, zf - zb], [g * (xo - t / 2), (yb + yt) / 2, (zb + zf) / 2]));
  const top = k.part("Top", [W, 22, D], [0, c.H - 11, 0]);
  const PH = 60;
  const plinth = k.part("Plinth rail", [2 * xi, PH, t], [0, yb + PH / 2, zf - 10 - t / 2]);
  const depth = zf - zb - 12, zs = zb + 12 + depth / 2;
  const yBottom = yb + PH + 9;
  const bottom = k.part("Bottom", [2 * xi, 18, depth], [0, yBottom, zs]);
  const divH = yt - yBottom - 9;
  const div = k.part("Divider", [t, divH, depth], [0, yBottom + 9 + divH / 2, zs]);
  const backs = [-1, 1].map((g) => k.part("Back panel", [xi + 6, hc - 6, 3], [(g * (xi + 6)) / 2, yb + 3 + (hc - 6) / 2, zb + 8], { material: "fiber" }));
  const hx = (xi + t / 2) / 2; // middle of each half
  const ySh = yt - 300;
  const shelves = [-1, 1].map((g) => k.part("Shelf", [xi - t / 2 - 4, 18, depth - 40], [g * hx, ySh, zs - 10]));
  const rod = k.part("Clothes rail", [28, xi - t / 2, 28], [-hx, ySh - 90, 0], { shape: "cyl", material: "metal", rot: [0, 0, Math.PI / 2] });
  const cleg = k.part("Centre leg", [44, c.U, 44], [0, c.U / 2, zs]);
  const sg = (i: number) => (i ? 1 : -1);
  const zc = [zb + 60, zs, zf - 60];
  const conn = (panel: string, y: number, i: number): FitOpts[] => zc.map((z) => ({ on: panel, at: [sg(i) * xi, y, z], dir: [-sg(i), 0, 0], mate: sides[i] }));
  const LONG: HwDef = { kind: "screw", len: 50, dia: 7 };
  step(b, "Hook the bottom into one side", "Lay the side on its back edge on a rug. Three connectors into the end of the bottom, then slide it into the keyholes and press down.", "join", { pose: "+z", warnings: ["floor"] }, () => {
    b.add(sides[0], [0, 0, 0]);
    b.then(0.15);
    b.fits(TOP_CLIP, conn(bottom, yBottom, 0), 0.1);
    b.then(0.1);
    b.add(bottom, [300, 0, 0]);
  });
  step(b, "Hook the other side on together", "Three connectors into the free end of the bottom, then lower the side on until they click.", "join", { pose: "+z", people: 2 }, () => {
    b.fits(TOP_CLIP, conn(bottom, yBottom, 1), 0.1);
    b.then(0.1);
    b.add(sides[1], [500, 0, 0]);
  });
  step(b, "Fit the plinth rail", "Tap two dowels into each end. Ease the sides apart a little, lower the rail in under the front of the bottom and push the sides back onto its dowels.", "dowels", { pose: "+z", tools: ["hammer"] }, () => {
    b.fits(DOWEL, [0, 1].flatMap((i) => [-15, 15].map((dy): FitOpts => ({ on: plinth, at: [sg(i) * xi, yb + PH / 2 + dy, zf - 10 - t / 2], dir: [-sg(i), 0, 0], mate: sides[i] }))), 0.1);
    b.then(0.1);
    between(b, sides, () => b.add(plinth, [0, 0, 260]));
  });
  step(b, "Hook the top on together", "Six connectors into its underside, three at each end, then slide it onto the sides until it clicks.", "join", { pose: "+z", people: 2 }, () => {
    b.fits(TOP_CLIP, [0, 1].flatMap((i) => zc.map((z): FitOpts => ({ on: top, at: [sg(i) * (xo - t / 2), yt, z], dir: [0, 1, 0], mate: sides[i] }))), 0.08);
    b.then(0.15);
    b.add(top, [0, 500, 0]);
  });
  step(b, "Fit the middle divider", "Hook it into the top and the bottom with two connectors at each end, then put a long screw through the bottom and the top into it.", "screws", { pose: "+z", tools: ["allen"], people: 2 }, () => {
    b.fits(TOP_CLIP, [yBottom + 9, yt].flatMap((y) => [zb + 80, zf - 80].map((z): FitOpts => ({ on: div, at: [0, y, z], dir: [0, y > yb + hc / 2 ? 1 : -1, 0] }))), 0.08);
    b.then(0.1);
    b.add(div, [0, 0, 500]);
    b.then(0.15);
    b.fits(LONG, [{ on: bottom, at: [0, yBottom - 9, zs], dir: [0, 1, 0], mate: div }, { on: top, at: [0, c.H, zs], dir: [0, -1, 0], mate: div }], 0.15);
  });
  step(b, "Hang the clothes rail", "Screw a ring bolt into the left side and one into the divider, slide the rail through both and tighten the nuts.", "general", { pose: "+z", tools: ["wrench"] }, () => {
    const rings: FitOpts[] = [{ on: sides[0], at: [-xi, ySh - 90, 0], dir: [-1, 0, 0] }, { on: div, at: [-t / 2, ySh - 90, 0], dir: [1, 0, 0] }];
    b.fits(HW.hook, rings, 0.15);
    b.then(0.1);
    b.fits(HW.nut, rings.map((r) => ({ ...r, at: [r.at[0] - r.dir[0] * 20, r.at[1], r.at[2]] as Vec3, hole: false as const })), 0.12);
    b.then(0.1);
    b.add(rod, [0, 0, 400]);
  });
  step(b, "Turn it over and slide in the back panels", "Lay it on its front. Each panel slides down the grooves from the bottom.", "join", { pose: "-z", people: 2 }, () => {
    b.stagger(0.3);
    for (const key of backs) b.add(key, [0, -900, 0]);
  });
  step(b, "Screw and clip the back", "Small screws into the bottom and the divider, then clips along the sides.", "screws", { pose: "-z", tools: ["screwdriver"] }, () => {
    b.fits(BACK_SCREW, [...[-1, 1].flatMap((g) => [g * (xi - 80), g * 100].map((x): FitOpts => ({ on: backs[g < 0 ? 0 : 1], at: [x, yBottom, zb + 6.5], dir: [0, 0, 1], mate: bottom }))), ...spread(yb + 300, yt - 300, 4).map((y): FitOpts => ({ on: backs[0], at: [-4, y, zb + 6.5], dir: [0, 0, 1], mate: div }))], 0.06);
    b.then(0.1);
    b.fits(BACK_CLIP, [0, 1].flatMap((i) => spread(yb + 200, yt - 200, 5).map((y): FitOpts => ({ on: backs[i], at: [sg(i) * (xi - 10), y, zb + 9.5], dir: [0, 0, 1], hole: false }))), 0.05);
  });
  underframe(b, k, c, sides, { brackets: true, tall: true, pose: "-z" });
  step(b, "Screw in the centre leg", "Under the divider, with its foot.", "legs", { pose: "-z", tools: ["allen"] }, () => {
    b.add(cleg, [0, -200, 0]);
    b.then(0.15);
    b.fit(LONG, { on: cleg, at: [0, 0, zs], dir: [0, 1, 0], mate: bottom });
    b.then(0.1);
    b.fit(FOOT, { on: cleg, at: [0, 0, zs], dir: [0, 1, 0] });
  });
  step(b, "Stand it up together", "Lift it upright from the top end, one of you at each end. Watch the ceiling.", "standup", { people: 2 }, () => {});
  wallSteps(b, top, c);
  step(b, "Put in the shelves", "Four shelf pins for each, then lay the shelf on them.", "shelves", {}, () => {
    const walls: [string, number, number][][] = [[[sides[0], -xi, -1], [div, -t / 2, 1]], [[div, t / 2, -1], [sides[1], xi, 1]]];
    b.fits(PIN, walls.flatMap((pair) => pair.flatMap(([key, x, d]) => [zb + 60, zf - 80].map((z): FitOpts => ({ on: key, at: [x, ySh - 13, z], dir: [d > 0 ? (x < 0 ? 1 : 1) : -1, 0, 0] })))), 0.05);
    b.then(0.15);
    for (const sh of shelves) b.add(sh, [0, 0, 400]);
  });
  doorSteps(b, [
    ...makeDoors(k, { walls: [{ x: -xi, key: sides[0] }, { x: -t / 2, key: div }], yb: yBottom + 9, h: yt - yBottom - 9, zf }),
    ...makeDoors(k, { walls: [{ x: t / 2, key: div }, { x: xi, key: sides[1] }], yb: yBottom + 9, h: yt - yBottom - 9, zf }),
  ]);
  return true;
}

/* ---------- the desk ---------- */

const DESK_DOWEL: HwDef = { kind: "dowel", len: 25, dia: 6 };
const DESK_CAM: HwDef = { kind: "cam", len: 10, dia: 12 };
const WEDGE: HwDef = { kind: "dowel", len: 34, dia: 8, name: "Wedge dowel" };
const LEG_BOLT: HwDef = { kind: "bolt", len: 50, dia: 7 };
const RAIL_SCREW: HwDef = { kind: "screw", len: 50, dia: 4 };
const PRESS_SCREW: HwDef = { kind: "screw", len: 40, dia: 8, name: "Hammer-in screw" };
const STOP_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const GROMMET: HwDef = { kind: "cap", len: 15, dia: 60, name: "Cable grommet" };
const DESK_GLIDE: HwDef = { kind: "glide", len: 10, dia: 30, name: "Screw-in glide" };

/** A drawer of boards: a front, two sides, a bottom (a board between the sides, or hardboard down grooves) and a back. */
interface DeskDrawer {
  front: string;
  sides: string[];
  bottom: string;
  back: string;
  x: number;
  xs: number; // to the side centres
  st: number;
  y0: number; // underside of the box
  h: number;
  zf: number; // front face of the front
  zF: number; // back face of the front
  zB: number; // back end of the box
  base: number; // lowest point, the front's bottom edge or the box's
}

function deskDrawer(k: Kit, name: string, o: { x: number; w: number; y0: number; h: number; zf: number; dd: number; front: [number, number, number]; st: number; board: boolean }): DeskDrawer {
  const [fw, fh, fy] = o.front, ft = 18, st = o.st;
  const front = k.part(`${name} front`, [fw, fh, ft], [o.x, fy, o.zf - ft / 2]);
  const zF = o.zf - ft, zB = zF - o.dd;
  const xs = o.w / 2 - st / 2, iw = o.w - 2 * st;
  const sides = [-1, 1].map((g) => k.part(`${name} side`, [st, o.h, o.dd], [o.x + g * xs, o.y0 + o.h / 2, zF - o.dd / 2]));
  const bottom = o.board
    ? k.part(`${name} bottom`, [iw, st, o.dd - st], [o.x, o.y0 + st / 2, zF - (o.dd - st) / 2])
    : k.part(`${name} bottom`, [iw + 8, 4, o.dd - st - 4], [o.x, o.y0 + 8, zF - (o.dd - st - 4) / 2], { material: "fiber" });
  const back = o.board ? k.part(`${name} back`, [iw, o.h, st], [o.x, o.y0 + o.h / 2, zB + st / 2]) : k.part(`${name} back`, [iw, o.h - 12, st], [o.x, o.y0 + 12 + (o.h - 12) / 2, zB + st / 2]);
  return { front, sides, bottom, back, x: o.x, xs, st, y0: o.y0, h: o.h, zf: o.zf, zF, zB, base: Math.min(fy - fh / 2, o.y0) };
}

/** Stage parts turned as one piece about `pv` (finished-product mm), landing with `pv` at `at`. */
function turnStage(b: PlanBuilder, keys: string[], rot: Vec3, pv: Vec3, at: Vec3, from?: Vec3) {
  for (const key of keys) {
    const p = b.partItem(key).final.pos;
    const r = rotate([p[0] - pv[0], p[1] - pv[1], p[2] - pv[2]], rot);
    b.stage(key, [r[0] + at[0], r[1] + at[1], r[2] + at[2]], rot, from);
  }
}

/**
 * The drawer steps as the manual draws them: built standing on its front. The big drawer's sides and bottom are
 * dowelled together and stood on the front; the two tray drawers have the sides on the front and a hardboard bottom
 * down the grooves. The back goes on last with wedge dowels and cam locks.
 */
function deskDrawerSteps(b: PlanBuilder, d: DeskDrawer, o: { scene: string; big?: boolean; wedges: number; knob?: Vec3; what: string }) {
  const sc = { scene: o.scene };
  const up: Vec3 = [Math.PI / 2, 0, 0];
  const pv: Vec3 = [d.x, d.y0, d.zf];
  const all = [d.front, ...d.sides, d.bottom, d.back];
  const onFront = (keys: string[], from?: Vec3) => turnStage(b, keys, up, pv, [0, 0, 0], from);
  const sx = (g: number) => d.x + g * d.xs;
  const inner = (g: number) => d.x + g * (d.xs - d.st / 2);
  const yB = o.big ? [d.y0 + 75, d.y0 + d.h - 75] : [d.y0 + d.h / 2];
  const frontBolts = [-1, 1].flatMap((g, i) => yB.map((y): FitOpts => ({ on: d.front, at: [sx(g), y, d.zF], dir: [0, 0, 1], mate: d.sides[i], mateHole: 4 })));
  const frontCams = [-1, 1].flatMap((g, i) => yB.map((y): FitOpts => ({ on: d.sides[i], at: [inner(g), y, d.zF - 34], dir: [g, 0, 0] })));
  const yD = o.big ? [d.y0 + 40, d.y0 + 115, d.y0 + d.h - 115, d.y0 + d.h - 40] : [d.y0 + d.h / 2 + 15];
  const sideDowels = [-1, 1].flatMap((g, i) => yD.map((y): FitOpts => ({ on: d.sides[i], at: [sx(g), y, d.zF], dir: [0, 0, -1], mate: d.front })));
  const yW = o.wedges > 2 ? [d.y0 + d.h * 0.3, d.y0 + d.h * 0.7] : [d.y0 + d.h / 2 + 4];
  const wedges = [-1, 1].flatMap((g, i) => yW.map((y): FitOpts => ({ on: d.sides[i], at: [d.x + g * (d.xs + d.st / 2), y, d.zB + d.st / 2], dir: [-g, 0, 0], mate: d.back })));
  const backCams = [-1, 1].flatMap((g) => yW.map((y): FitOpts => ({ on: d.back, at: [d.x + g * (d.xs - d.st / 2 - 30), y, d.zB + d.st], dir: [0, 0, -1] })));
  if (o.big) {
    const iw = 2 * d.xs - d.st;
    step(b, "Tap the dowels into the drawer sides and bottom", "Four into the front end of each side and two into each long edge of the bottom.", "dowels", { ...sc, tools: ["hammer"], warnings: ["floor"] }, () => {
      b.stagger(0.15);
      d.sides.forEach((key, i) => b.stage(key, [(i ? 1 : -1) * 260, d.st / 2, 0], [0, 0, ((i ? 1 : -1) * Math.PI) / 2], [0, 120, 0]));
      b.stage(d.bottom, [0, d.st / 2, 0], [0, 0, 0], [0, 120, 0]);
      b.then(0.15);
      b.fits(DESK_DOWEL, [...sideDowels, ...[-1, 1].flatMap((g, i) => [d.zF - 80, d.zB + 100].map((z): FitOpts => ({ on: d.bottom, at: [d.x + g * (iw / 2), d.y0 + d.st / 2, z], dir: [-g, 0, 0], mate: d.sides[i] })))], 0.05);
    });
    step(b, "Push the sides onto the bottom", "One on each long edge, the dowels at the front.", "join", sc, () => {
      const rel = (key: string): Vec3 => {
        const p = b.partItem(key).final.pos;
        return [p[0] - d.x, p[1] - d.y0, p[2] - (d.zF + d.zB) / 2];
      };
      b.stage(d.bottom, rel(d.bottom), [0, 0, 0]);
      b.then(0.1);
      b.stagger(0.2);
      d.sides.forEach((key, i) => b.stage(key, rel(key), [0, 0, 0], [(i ? 1 : -1) * 260, 0, 0]));
    });
  }
  step(b, `Screw the cam bolts into the ${o.what} front`, o.big ? "Lay the front face down on a rug: four bolts into the holes along its back." : "Lay it face down: one bolt near each end.", "cams", { ...sc, tools: ["allen"], warnings: o.big ? ["face"] : ["floor"] }, () => {
    onFront([d.front], [0, 120, 0]);
    b.then(0.15);
    b.fits(CAM_BOLT, frontBolts, 0.1);
  });
  if (o.big)
    step(b, "Stand the box on the front and lock it", "Lower it onto the dowels and bolts, then turn the four cam locks.", "cams", { ...sc, tools: ["screwdriver"] }, () => {
      onFront([...d.sides, d.bottom], [0, 300, 0]);
      b.then(0.15);
      b.fits(DESK_CAM, frontCams, 0.1);
    });
  else {
    step(b, "Stand the sides on the front and lock them", "Tap a small dowel into the front end of each side, push them onto the front, then turn the two cam locks.", "cams", { ...sc, tools: ["hammer", "screwdriver"] }, () => {
      onFront(d.sides, [0, 260, 0]);
      b.then(0.1);
      b.fits(DESK_DOWEL, sideDowels, 0.1);
      b.then(0.1);
      b.fits(DESK_CAM, frontCams, 0.12);
    });
    step(b, "Slide the bottom in", "Down the grooves in the sides, smooth side in, until it reaches the front.", "drawer", sc, () => onFront([d.bottom], [0, 400, 0]));
  }
  step(b, "Fit the back and lock it", `${o.big ? "" : o.wedges === 2 ? "Tap a small dowel into each end of the back first. " : ""}Lay it on the open end, push the ${o.wedges} wedge dowels in through the sides and turn the ${o.wedges} cam locks.`, "cams", { ...sc, tools: o.wedges === 2 ? ["hammer", "screwdriver"] : ["screwdriver"] }, () => {
    if (!o.big && o.wedges === 2) {
      b.fits(DESK_DOWEL, [-1, 1].map((g, i): FitOpts => ({ on: d.back, at: [d.x + g * (d.xs - d.st / 2), d.y0 + d.h / 2 - 12, d.zB + d.st / 2], dir: [-g, 0, 0], mate: d.sides[i] })), 0.1);
      b.then(0.1);
    }
    onFront([d.back], [0, 300, 0]);
    b.then(0.15);
    b.fits(WEDGE, wedges, 0.1);
    b.then(0.1);
    b.fits(DESK_CAM, backCams, 0.1);
  });
  if (o.knob) {
    const kn = o.knob;
    step(b, "Turn it over and screw on the knob", "The screw goes in from the back of the front.", "screws", { ...sc, tools: ["screwdriver"] }, () => {
      for (const key of all) {
        const p = b.partItem(key).final.pos;
        b.stage(key, [p[0] - d.x, p[1] - d.base, p[2] - (d.zf + d.zB) / 2], [0, 0, 0]);
      }
      b.then(0.15);
      b.fit(KNOB, { on: d.front, at: kn, dir: [0, 0, -1], hole: false });
      b.then(0.05);
      b.fit(KNOB_SCREW, { on: d.front, at: [kn[0], kn[1], d.zF], dir: [0, 0, 1] });
    });
  }
}

/**
 * The desk, from its 69-step manual. Each pedestal's bottom gets its legs (three each: two at the front, one at the
 * back outer corner), stands on the pedestal's inner side and is locked to it. The desk is built lying on its back
 * on the long back panel: the two pedestal units, the L-shaped rail at the top of the knee space and the outer sides
 * go on, then it's stood up for the runners and the top. The left pedestal hides a big drawer and a tray behind its
 * tall front, the centre drawer runs between the pedestals and the right pedestal has a shelf behind a door.
 */
function buildDesk(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const TT = 25, OV = 15, t = 18, U = 130;
  const yt = H - TT, xo = W / 2 - OV, zb = -D / 2 + OV, zf = D / 2 - OV;
  const PW = 400;
  const xi = xo - PW + t; // knee face of an inner side
  const xp = xo - t; // pedestal face of an outer side
  const zi = zb + t; // front face of the back panel
  const sg = (i: number) => (i ? 1 : -1);
  const hs = yt - U;
  const back = k.part("Back panel", [2 * xp, hs, t], [0, U + hs / 2, zb + t / 2]);
  const outer = [0, 1].map((i) => k.part(i ? "Right outer side" : "Left outer side", [t, hs, zf - zb], [sg(i) * (xo - t / 2), U + hs / 2, 0]));
  const inner = [0, 1].map((i) => k.part("Inner side", [t, hs, zf - zi], [sg(i) * (xi + t / 2), U + hs / 2, (zf + zi) / 2]));
  const pw = xp - (xi + t); // inside a pedestal
  const pc = (i: number) => sg(i) * (xi + t + pw / 2);
  const bot = (name: string, i: number, z0: number, z1: number) => k.part(name, [pw, t, z1 - z0], [pc(i), U + t / 2, (z0 + z1) / 2]);
  const zSplit = zf - 400;
  const botL = bot("Left bottom", 0, zi, zf);
  const botRF = bot("Right bottom, front", 1, zSplit, zf);
  const botRB = bot("Right bottom, back", 1, zi, zSplit);
  // legs: left-hand and right-hand tapers, two at the front of each pedestal and one at its back outer corner
  const LW = 44;
  const legAt = (i: number, outerLeg: boolean, front: boolean) => {
    const x = outerLeg ? sg(i) * (xp - LW / 2) : sg(i) * (xi + t + LW / 2);
    const z = front ? zf - LW / 2 : zi + LW / 2;
    const left = (i === 0) === outerLeg;
    return { k: k.part(left ? "Left-hand leg" : "Right-hand leg", [LW, U, LW], [x, U / 2, z], { material: "board" }), x, z };
  };
  const legsL = [legAt(0, true, true), legAt(0, false, true), legAt(0, true, false)];
  const legsR = [legAt(1, true, true), legAt(1, false, true), legAt(1, true, false)];
  const legOn = new Map<string, string>([[legsL[0].k, botL], [legsL[1].k, botL], [legsL[2].k, botL], [legsR[0].k, botRF], [legsR[1].k, botRF], [legsR[2].k, botRB]]);
  const legs = [...legsL, ...legsR];
  // the L-shaped rail across the top of the knee space, against the back
  const railH = k.part("Rail, top strip", [2 * xi, t, 100], [0, yt - t / 2, zi + 50]);
  const railV = k.part("Rail, back strip", [2 * xi, 80, t], [0, yt - t - 40, zi + t / 2]);
  // the top, with its cable notch at the back
  const notch = 400;
  const tp = b.compound("Top", [
    { shape: "box", size: [W, TT, D - 25], pos: [0, H - TT / 2, 12.5] },
    ...[-1, 1].map((g) => ({ shape: "box" as const, size: [(W - notch) / 2, TT, 25] as Vec3, pos: [(g * (W + notch)) / 4, H - TT / 2, -D / 2 + 12.5] as Vec3 })),
  ]);
  const top = b.place(tp.type, tp.mid);
  // the drawers
  const big = deskDrawer(k, "Big drawer", { x: pc(0), w: pw - 26, y0: U + t + 20, h: 260, zf, dd: 520, front: [pw - 4, hs - t - 4, (U + t + yt) / 2], st: 16, board: true });
  const tray = deskDrawer(k, "Tray", { x: pc(0), w: pw - 26, y0: 450, h: 70, zf: zf - 22, dd: 440, front: [pw - 26, 70, 485], st: 12, board: false });
  const cy = yt - 37;
  const centre = deskDrawer(k, "Drawer", { x: 0, w: 2 * xi - 26, y0: cy - 30, h: 50, zf, dd: 450, front: [2 * xi - 4, 66, cy], st: 12, board: false });
  const door = k.part("Door", [pw - 4, hs - t - 4, 18], [pc(1), (U + t + yt) / 2, zf - 9]);
  const shelf = k.part("Shelf", [pw - 2, t, 600], [pc(1), 440, (zi + zf) / 2 - 10]);

  /* the pedestal units */
  step(b, "Tap the dowels into the bottoms", "Into both ends of the three bottom boards: six, six and four. The left one is the big board with the cable hole.", "dowels", { scene: "prep", tools: ["hammer"], warnings: ["floor"] }, () => {
    b.stagger(0.15);
    for (const key of [botL, botRF, botRB]) b.stage(key, k.pos(key), [0, 0, 0], [0, 120, 0]);
    b.then(0.15);
    const list: FitOpts[] = [];
    const ends = (key: string, i: number, zs: number[]) => {
      for (const e of [-1, 1]) {
        const xEnd = pc(i) + (e * pw) / 2;
        const recv = (xEnd < 0) === (e < 0) ? outer[i] : inner[i];
        for (const z of zs) list.push({ on: key, at: [xEnd, U + t / 2, z], dir: [-e, 0, 0], mate: recv });
      }
    };
    ends(botL, 0, [zf - 60, 0, zi + 60]);
    ends(botRF, 1, [zf - 60, zf - 200, zSplit + 60]);
    ends(botRB, 1, [zSplit - 60, zi + 60]);
    b.fits(DOWEL, list, 0.04);
  });
  step(b, "Tap a dowel into each leg", "Into the hole in the top. There are three left-hand and three right-hand legs.", "dowels", { scene: "legs", tools: ["hammer"] }, () => {
    b.stagger(0.1);
    legs.forEach((l, i) => b.stage(l.k, [(i - 2.5) * 120, U / 2, 0], [0, 0, 0], [0, 120, 0]));
    b.then(0.15);
    b.fits(DOWEL, legs.map((l): FitOpts => ({ on: l.k, at: [l.x, U, l.z], dir: [0, -1, 0], mate: legOn.get(l.k) })), 0.08);
  });
  step(b, "Bolt the legs to the bottoms", "One bolt through each bottom into its leg, with the Allen key. Three legs on the left bottom, two on the right front piece, one on the right back piece.", "legs", { scene: "prep", tools: ["allen"] }, () => {
    b.stagger(0.12);
    for (const l of legs) b.stage(l.k, k.pos(l.k), [0, 0, 0], [0, -200, 0]);
    b.then(0.15);
    b.fits(LEG_BOLT, legs.map((l): FitOpts => ({ on: legOn.get(l.k), at: [l.x, U + t, l.z], dir: [0, -1, 0], mate: l.k })), 0.1);
  });
  step(b, "Screw the glides into the legs", "One into the bottom of each leg, by hand.", "legs", { scene: "prep" }, () =>
    b.fits(DESK_GLIDE, legs.map((l): FitOpts => ({ on: l.k, at: [l.x, 0, l.z], dir: [0, 1, 0] })), 0.1),
  );
  // the units lie on their inner sides: the knee face on the rug, bottoms standing up on the other face
  const unit = (i: number) => (i ? [inner[1], botRF, botRB, ...legsR.map((l) => l.k)] : [inner[0], botL, ...legsL.map((l) => l.k)]);
  const lay = (i: number, keys: string[], from?: Vec3) => turnStage(b, keys, [0, 0, (sg(i) * Math.PI) / 2], [sg(i) * xi, U + hs / 2, 0], [sg(i) * 650, 0, 0], from);
  const innerJ = (i: number) => (i ? ([[botRF, zf - 120], [botRF, zSplit + 100], [botRB, zi + 120]] as [string, number][]) : ([[botL, zf - 120], [botL, 0], [botL, zi + 120]] as [string, number][]));
  step(b, "Screw the cam bolts into the inner sides", "Lay both inner sides on the rug, the face with the small holes at the bottom edge up. Three bolts in each.", "cams", { scene: "ped", tools: ["allen"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    lay(0, [inner[0]], [0, 160, 0]);
    lay(1, [inner[1]], [0, 160, 0]);
    b.then(0.15);
    b.fits(CAM_BOLT, [0, 1].flatMap((i) => innerJ(i).map(([, z]): FitOpts => ({ on: inner[i], at: [sg(i) * (xi + t), U + t / 2, z], dir: [-sg(i), 0, 0], mate: innerJ(i).find((j) => j[1] === z)![0], mateHole: 4 }))), 0.08);
  });
  step(b, "Stand the bottoms on the inner sides", "Each onto its dowels and cam bolts along the bottom edge, legs pointing away from the side.", "join", { scene: "ped" }, () => {
    b.stagger(0.25);
    lay(0, unit(0).slice(1), [0, 260, 0]);
    lay(1, unit(1).slice(1), [0, 260, 0]);
  });
  step(b, "Lock the bottoms with cam locks", "Six in all, in the bottoms by the inner sides. Arrow towards the bolt, then a clockwise turn.", "cams", { scene: "ped", tools: ["screwdriver"] }, () =>
    b.fits(CAM, [0, 1].flatMap((i) => innerJ(i).map(([key, z]): FitOpts => ({ on: key, at: [sg(i) * (xi + t + 34), U + t, z], dir: [0, -1, 0] }))), 0.1),
  );
  const innerBack = [0, 1].flatMap((i) => [U + 120, yt - 120].map((y): FitOpts => ({ on: inner[i], at: [sg(i) * (xi + t / 2), y, zi], dir: [0, 0, 1], mate: back })));
  step(b, "Tap two dowels into the back edge of each inner side", "Into the holes in the edge that will meet the back panel.", "dowels", { scene: "ped", tools: ["hammer"] }, () => b.fits(DOWEL, innerBack, 0.1));
  step(b, "Push the cable grommet into the left inner side", "Into the round hole near the back, from the knee side.", "general", { scene: "ped" }, () =>
    b.fit(GROMMET, { on: inner[0], at: [-xi, yt - 130, zi + 90], dir: [1, 0, 0], hole: false }),
  );

  /* lying on its back */
  const backBolts: FitOpts[] = [
    ...[0, 1].flatMap((i) => [U + 230, yt - 230].map((y): FitOpts => ({ on: back, at: [sg(i) * (xi + t / 2), y, zi], dir: [0, 0, -1], mate: inner[i], mateHole: 4 }))),
    ...[0, 1].flatMap((i) => [pc(i) - 90, pc(i) + 90].map((x): FitOpts => ({ on: back, at: [x, U + t / 2, zi], dir: [0, 0, -1], mate: i ? botRB : botL, mateHole: 4 }))),
  ];
  step(b, "Screw the cam bolts into the back panel", "Lay it on a rug, inside face up. Eight bolts: two for each inner side and two for each bottom.", "cams", { pose: "+z", tools: ["allen"], warnings: ["floor"] }, () => {
    b.add(back, [0, 0, 200]);
    b.then(0.15);
    b.fits(CAM_BOLT, backBolts, 0.06);
  });
  step(b, "Tap two dowels into each end of the back", "For the outer sides.", "dowels", { pose: "+z", tools: ["hammer"] }, () =>
    b.fits(DOWEL, [0, 1].flatMap((i) => [U + 170, yt - 170].map((y): FitOpts => ({ on: back, at: [sg(i) * xp, y, zb + t / 2], dir: [-sg(i), 0, 0], mate: outer[i] }))), 0.1),
  );
  step(b, "Stand the pedestals on the back", "Lower each one, front edges up, onto its dowels and cam bolts. Press the inner sides down.", "join", { pose: "+z" }, () => {
    for (const i of [0, 1]) {
      b.stagger(0);
      for (const key of unit(i)) b.add(key, [0, 0, 400]);
      b.wait(0.3);
    }
  });
  step(b, "Lock them with cam locks", "Eight, in the inner sides and the bottoms by the back. Arrow towards the bolt, then a clockwise turn.", "cams", { pose: "+z", tools: ["screwdriver"] }, () =>
    b.fits(CAM, backBolts.map((f): FitOpts => {
      const i = f.at[0] > 0 ? 1 : 0;
      return f.mate === inner[i] ? { on: f.mate, at: [sg(i) * (xi + t), f.at[1], zi + 34], dir: [-sg(i), 0, 0] } : { on: f.mate, at: [f.at[0], U + t, zi + 34], dir: [0, -1, 0] };
    }), 0.08),
  );
  step(b, "Join the two rail strips", "Tap the four small dowels into the edge of the back strip, push the top strip on to make an L, and put the long screw through with the Allen key.", "screws", { scene: "rail", tools: ["hammer", "allen"] }, () => {
    const rel = (key: string): Vec3 => {
      const p = k.pos(key);
      return [p[0], p[1] - (yt - t - 80), p[2] - zi];
    };
    b.stage(railV, rel(railV), [0, 0, 0], [0, 120, 0]);
    b.then(0.15);
    b.fits(DESK_DOWEL, spread(-xi + 80, xi - 80, 4).map((x): FitOpts => ({ on: railV, at: [x, yt - t, zi + t / 2], dir: [0, -1, 0], mate: railH })), 0.08);
    b.then(0.1);
    b.stage(railH, rel(railH), [0, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fit(RAIL_SCREW, { on: railH, at: [0, yt, zi + t / 2], dir: [0, -1, 0], mate: railV });
  });
  step(b, "Fit the rail between the pedestals", "At the top of the knee space against the back, then hammer three screws through each inner side into its ends.", "screws", { pose: "+z", tools: ["hammer"] }, () => {
    b.stagger(0);
    b.add(railV, [0, 0, 400]);
    b.add(railH, [0, 0, 400]);
    b.then(0.15);
    b.fits(PRESS_SCREW, [0, 1].flatMap((i) => [[yt - t - 60, zi + t / 2], [yt - t - 25, zi + t / 2], [yt - t / 2, zi + 70]].map(([y, z], j): FitOpts => ({ on: inner[i], at: [sg(i) * (xi + t), y, z], dir: [-sg(i), 0, 0], mate: j < 2 ? railV : railH }))), 0.1);
  });
  const outerJ = (i: number): [string, number, number][] => [
    [back, U + 230, zb + t / 2],
    [back, yt - 230, zb + t / 2],
    ...(i ? ([[botRF, U + t / 2, zf - 130], [botRF, U + t / 2, zSplit + 100], [botRB, U + t / 2, zi + 130]] as [string, number, number][]) : ([[botL, U + t / 2, zf - 130], [botL, U + t / 2, 0], [botL, U + t / 2, zi + 130]] as [string, number, number][])),
  ];
  step(b, "Screw the cam bolts into the outer sides", "Lay them on the rug, inside up. Five in each.", "cams", { scene: "prep", tools: ["allen"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    outer.forEach((key, i) => b.stage(key, [sg(i) * (hs / 2 + 60), t / 2, 0], [0, 0, (-sg(i) * Math.PI) / 2], [0, 160, 0]));
    b.then(0.15);
    b.fits(CAM_BOLT, [0, 1].flatMap((i) => outerJ(i).map(([recv, y, z]): FitOpts => ({ on: outer[i], at: [sg(i) * xp, y, z], dir: [sg(i), 0, 0], mate: recv, mateHole: 4 }))), 0.05);
  });
  step(b, "Push the outer sides on", "One at each end, onto the dowels and bolts of the back and the bottoms.", "join", { pose: "+z" }, () => {
    b.stagger(0.3);
    outer.forEach((key, i) => b.add(key, [sg(i) * 400, 0, 0]));
  });
  step(b, "Lock the outer sides", "Ten cam locks, in the back and the bottoms.", "cams", { pose: "+z", tools: ["screwdriver"] }, () =>
    b.fits(CAM, [0, 1].flatMap((i) => outerJ(i).map(([recv, y, z]): FitOpts => (recv === back ? { on: back, at: [sg(i) * (xp - 34), y, zi], dir: [0, 0, -1] } : { on: recv, at: [sg(i) * (xp - 34), U + t, z], dir: [0, -1, 0] }))), 0.06),
  );
  step(b, "Stand it up together", "Tip it forward onto its legs.", "standup", { people: 2 }, () => {});

  /* standing: runners and the top */
  const walls = [{ key: outer[0], x: -xp, g: -1 }, { key: inner[0], x: -(xi + t), g: 1 }];
  const runners = (def: HwDef, y: number, zLen: number, n: number, list: { key: string; x: number; g: number }[], zEnd = zf - 22) => {
    const zr = zEnd - zLen / 2;
    const rs = list.map((w): FitOpts => ({ on: w.key, at: [w.x, y, zr], dir: [w.g, 0, 0], hole: false }));
    const sc = rs.flatMap((r) => spread(zr - zLen / 2 + 40, zr + zLen / 2 - 40, n).map((z): FitOpts => ({ on: r.on, at: [r.at[0], y + 4, z], dir: r.dir })));
    return { rs, sc };
  };
  const BIG_RUNNER: HwDef = { kind: "runner", len: 500, dia: 45 };
  const MID_RUNNER: HwDef = { kind: "runner", len: 450, dia: 40 };
  const TRAY_RUNNER: HwDef = { kind: "runner", len: 400, dia: 30, name: "Tray runner" };
  const rBig = runners(BIG_RUNNER, big.y0 + 6, 500, 3, walls);
  step(b, "Screw the runners into the left pedestal", "Low down on both walls, for the big drawer. Three screws each, catch at the front.", "runners", { tools: ["screwdriver"] }, () => {
    b.fits(BIG_RUNNER, rBig.rs, 0.15);
    b.then(0.1);
    b.fits(RUNNER_SCREW, rBig.sc, 0.06);
  });
  const rMid = runners(MID_RUNNER, centre.y0 + 6, 450, 2, [{ key: inner[0], x: -xi, g: -1 }, { key: inner[1], x: xi, g: 1 }]);
  step(b, "Screw the runners for the centre drawer", "On the knee faces of the inner sides, just under the top. Two screws each.", "runners", { tools: ["screwdriver"] }, () => {
    b.fits(MID_RUNNER, rMid.rs, 0.15);
    b.then(0.1);
    b.fits(RUNNER_SCREW, rMid.sc, 0.08);
  });
  const rTray = runners(TRAY_RUNNER, tray.y0 + 6, 400, 2, walls, tray.zF - 10);
  step(b, "Screw the tray runners into the left pedestal", "Higher up on both walls, in the row of holes you want: two screws each.", "runners", { tools: ["screwdriver"] }, () => {
    b.fits(TRAY_RUNNER, rTray.rs, 0.15);
    b.then(0.1);
    b.fits(RUNNER_SCREW, rTray.sc, 0.08);
  });
  const sideX = [-(xo - t / 2), -(xi + t / 2), xi + t / 2, xo - t / 2];
  const sideKey = [outer[0], inner[0], inner[1], outer[1]];
  const topDowels = sideX.flatMap((x, j) => (j === 0 || j === 3 ? [-130, 130] : [-130, 130, 300]).map((z): FitOpts => ({ on: sideKey[j], at: [x, yt, j === 0 || j === 3 ? z : Math.max(z, zi + 40)], dir: [0, -1, 0], mate: top })));
  step(b, "Tap the dowels into the tops of the sides", "Ten: two in each outer side, three in each inner side.", "dowels", { tools: ["hammer"] }, () => b.fits(DOWEL, topDowels, 0.06));
  const topJ = sideX.flatMap((x, j) => [-250, 0, 250].map((z) => ({ x, z: j === 1 || j === 2 ? Math.max(z, zi + 30) : z, j })));
  step(b, "Screw the cam bolts into the top", "Lay it upside down on a rug: twelve bolts, three over each side.", "cams", { scene: "top", tools: ["allen"], warnings: ["face"] }, () => {
    b.stage(top, [0, TT / 2, 0], [Math.PI, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(CAM_BOLT, topJ.map((p): FitOpts => ({ on: top, at: [p.x, yt, p.z], dir: [0, 1, 0], mate: sideKey[p.j], mateHole: 4 })), 0.05);
  });
  step(b, "Lay the top on and lock it", "Onto the dowels, cable notch at the back, then turn the twelve cam locks in the sides.", "cams", { tools: ["screwdriver"], people: 2 }, () => {
    b.add(top, [0, 300, 0]);
    b.then(0.15);
    b.fits(CAM, topJ.map((p): FitOpts => {
      // from inside the pedestals
      const face = [-xp, -(xi + t), xi + t, xp][p.j];
      return { on: sideKey[p.j], at: [face, yt - 34, p.z], dir: [p.j === 0 || p.j === 2 ? -1 : 1, 0, 0] };
    }), 0.05);
  });

  /* the drawers */
  deskDrawerSteps(b, big, { scene: "big", big: true, wedges: 4, knob: [big.x, yt - 70, zf], what: "big drawer's" });
  deskDrawerSteps(b, tray, { scene: "tray", wedges: 4, what: "tray's" });
  deskDrawerSteps(b, centre, { scene: "centre", wedges: 2, knob: [0, cy, zf], what: "centre drawer's" });
  const slide = (d: DeskDrawer, from: Vec3) => {
    b.stagger(0);
    for (const key of [d.front, ...d.sides, d.bottom, d.back]) b.add(key, from);
  };
  step(b, "Put the tray in", "Lay it on its runners, push it home and lock it with a small screw through each runner.", "drawer", { tools: ["screwdriver"] }, () => {
    slide(tray, [0, 0, 500]);
    b.then(0.15);
    b.fits(STOP_SCREW, [-1, 1].map((g, i): FitOpts => ({ on: tray.sides[i], at: [tray.x + g * (tray.xs + tray.st / 2), tray.y0 + 8, tray.zF - 40], dir: [-g, 0, 0] })), 0.15);
  });
  step(b, "Put the big drawer in", "Pull the runners out, lay the drawer on them and push it in until the catches click.", "drawer", { warnings: ["tip"] }, () => slide(big, [0, 0, 600]));
  step(b, "Put the centre drawer in", "Pull the runners out, lay it on them and push until it clicks.", "drawer", {}, () => slide(centre, [0, 0, 500]));
  step(b, "Put the shelf in", "Push the four shelf pins into the right pedestal at the height you want and lay the shelf on them.", "shelves", {}, () => {
    b.fits(PIN, [-1, 1].flatMap((g) => [zi + 60, zf - 80].map((z): FitOpts => ({ on: g < 0 ? inner[1] : outer[1], at: [g < 0 ? xi + t : xp, 440 - t / 2 - 4, z], dir: [g, 0, 0] }))), 0.08);
    b.then(0.15);
    b.add(shelf, [0, 0, 400]);
  });
  const hy = [U + t + 100, yt - 100];
  const hx = xp - 40;
  step(b, "Press the hinges into the door", "Lay it face down. One hinge in each round hole by the right-hand edge, then tighten their screws.", "hinges", { scene: "door", tools: ["screwdriver"], warnings: ["face"] }, () => {
    b.stage(door, [0, 9, 0], [Math.PI / 2, 0, Math.PI], [0, 160, 0]);
    b.then(0.15);
    b.fits(HINGE, hy.map((y): FitOpts => ({ on: door, at: [hx, y, zf - 18], dir: [0, 0, 1], twist: Math.PI })), 0.2);
  });
  step(b, "Hang the door", "Screw the hinge plates to the right outer side, clip the hinges on and turn the screws to even out the gaps.", "doors", { tools: ["screwdriver"] }, () => b.add(door, [0, 0, 320]));
  step(b, "Screw on the door knob", "By the edge away from the hinges. The screw goes in from inside.", "screws", { tools: ["screwdriver"] }, () => {
    const kn: Vec3 = [xi + t + 40, 465, zf];
    b.fit(KNOB, { on: door, at: kn, dir: [0, 0, -1], hole: false });
    b.then(0.05);
    b.fit(KNOB_SCREW, { on: door, at: [kn[0], kn[1], zf - 18], dir: [0, 0, 1] });
  });
  return true;
}

/* ---------- beds ---------- */

/** Mattress width and length (mm) from the variant, "150 x 200" or "97 x 191". */
function mattressOf(s: ProductSpec): [number, number] {
  const m = /(\d{2,3})\s*[x×]\s*(\d{3})/.exec(`${s.variant} ${s.slug ?? ""}`.replace(/-x-/g, " x "));
  return m ? [+m[1] * 10, +m[2] * 10] : [1500, 2000];
}

/** A rolled slatted base as one part: slats across the bed on two straps. */
function slatBase(b: PlanBuilder, w: number, len: number, y: number, z: number, extra: boolean, x = 0) {
  const n = Math.round(len / 110);
  const pieces: PartPiece[] = range(n).map((i) => ({ shape: "box", size: [w, 8, 60], pos: [x, y, z - len / 2 + 30 + (i * (len - 60)) / (n - 1)], material: "wood" }));
  const c = b.compound("Slatted base", pieces, { material: "wood", extra });
  return b.place(c.type, c.mid);
}

const INSERT: HwDef = { kind: "nut", len: 12, dia: 12, name: "Threaded insert" };
const RIVET: HwDef = { kind: "pin", len: 14, dia: 8, name: "Push rivet" };
const CORNER_POST: HwDef = { kind: "bracket", len: 300, dia: 60, name: "Corner post" };
const CORNER_PLATE: HwDef = { kind: "plate", len: 120, dia: 100, name: "Corner plate" };
const BED_BOLT: HwDef = { kind: "bolt", len: 16, dia: 8 };
const BED_WASHER: HwDef = { kind: "washer", len: 2, dia: 24 };
const LEG_SPACER: HwDef = { kind: "washer", len: 8, dia: 50, name: "Leg spacer" };
const BED_PAD: HwDef = { kind: "glide", len: 4, dia: 40 };
const HB_HANGER: HwDef = { kind: "hook", len: 110, dia: 30, name: "Headboard hanger" };
const BEAM_HANGER: HwDef = { kind: "bracket", len: 90, dia: 70, name: "Beam hanger" };
const BEAM_CLIP: HwDef = { kind: "clip", len: 60, dia: 20, name: "Beam clip" };
const SLAT_CLIP: HwDef = { kind: "clip", len: 30, dia: 20, name: "Slat stop" };
const BED_DOWEL: HwDef = HW.dowel;

/**
 * The upholstered bed frame: the side rails take their slat ledges at the height that suits the mattress, the head
 * rail (with the uprights the headboard hangs on) and the foot rail take the beam hangers, two legs screw into the
 * head rail, and the corners are joined by two people with corner posts and plates. The headboard gets its hangers
 * lying face down and is lifted onto the uprights; the covers are pulled over the rails and closed underneath; the
 * centre beam (on the wide beds) hangs in its hangers, grip strips go on the ledges and the slats are rolled out.
 */
function buildUpholsteredBed(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const [MW, ML] = mattressOf(s);
  const wide = MW > 1200;
  const W = MW + 70, L = ML + (wide ? 220 : 230), HB = 1210, FH = 420, LH = 210;
  const t = 18, CT = 35; // board, and the cover over it
  const zFoot = L / 2 - CT; // inside face of the foot cover
  const zHead = zFoot - ML; // the mattress' head end
  const hbT = L - ML - 2 * CT;
  const RH = 200, ry = FH - 10 - RH / 2;
  const xs = MW / 2 + t / 2;
  const side = [-1, 1].map((g) => k.part("Side rail", [t, RH, ML], [g * xs, ry, (zHead + zFoot) / 2]));
  const ledgeY = FH - 90;
  const ledges = [-1, 1].map((g) => k.part("Slat ledge", [30, 22, ML - 40], [g * (MW / 2 - 15), ledgeY, (zHead + zFoot) / 2], { material: "wood" }));
  const headRail = b.compound("Head rail", [
    { shape: "box", size: [MW + 2 * t, RH, t], pos: [0, ry, zHead - t / 2] },
    ...[-1, 0, 1].map((e) => ({ shape: "box" as const, size: [60, 640, t] as Vec3, pos: [e * (MW / 2 - 200), FH + 320 - 10, zHead - t / 2 - 40] as Vec3 })),
  ]);
  const head = b.place(headRail.type, headRail.mid);
  const foot = k.part("Foot rail", [MW + 2 * t, RH, t], [0, ry, zFoot - t / 2]);
  const legPos = (g: number, atHead: boolean): Vec3 => [g * (MW / 2 + CT / 2), LH / 2, atHead ? zHead + 10 : zFoot - 10];
  const legs = [true, false].flatMap((h) => [-1, 1].map((g) => ({ k: k.part("Leg", [46, LH, 46], legPos(g, h), { shape: "cyl", material: "wood" }), g, h, p: legPos(g, h) })));
  const headboard = k.part("Headboard", [W, HB - 60, hbT], [0, 60 + (HB - 60) / 2, -L / 2 + hbT / 2], { material: "soft" });
  const blocks = [-1, 1].map((g) => k.part("Filler block", [CT, 40, 140], [g * (MW / 2 + CT / 2), FH + 20, zHead + 70]));
  const covers = [
    ...[-1, 1].map((g) => k.part("Side rail cover", [CT, FH - 190, ML + CT], [g * (MW / 2 + CT / 2), 190 + (FH - 190) / 2, (zHead + L / 2) / 2], { material: "soft" })),
    k.part("Foot rail cover", [MW, FH - 190, CT], [0, 190 + (FH - 190) / 2, L / 2 - CT / 2], { material: "soft" }),
  ];
  const beam = wide ? k.part("Centre beam", [50, 60, ML], [0, ledgeY - 19, (zHead + zFoot) / 2], { material: "wood" }) : "";
  const strips = [
    ...[-1, 1].flatMap((g) => [-1, 0, 1].map((e) => k.part("Grip strip", [30, 2, ML / 3 - 20], [g * (MW / 2 - 15), ledgeY + 12, (zHead + zFoot) / 2 + (e * ML) / 3], { material: "fiber" }))),
    ...(wide ? [-1, 0, 1].map((e) => k.part("Beam grip strip", [40, 2, ML / 3 - 20], [0, ledgeY + 12, (zHead + zFoot) / 2 + (e * ML) / 3], { material: "fiber" })) : []),
  ];
  const slats = slatBase(b, MW - 10, ML - 20, ledgeY + 17, (zHead + zFoot) / 2, true);
  const nIns = 6;
  const layRail = (key: string, g: number) => b.stage(key, [g * 180, t / 2, 0], [0, 0, (-g * Math.PI) / 2], [0, 160, 0]);

  step(b, "Choose the height of the slats", "Lay the side rails on a rug. For a mattress thinner than 24 cm use the upper holes, for a thicker one the lower holes.", "general", { scene: "prep", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    side.forEach((key, i) => layRail(key, i ? 1 : -1));
  });
  step(b, "Hook the slat ledges on", "Into the holes you chose, all along each side rail.", "general", { scene: "prep" }, () => {
    b.stagger(0.2);
    ledges.forEach((key, i) => b.stage(key, [(i ? 1 : -1) * 180, t + 11, 0], [0, 0, 0], [0, 120, 0]));
  });
  const railIns = side.flatMap((key, i) => spread(zHead + 200, zFoot - 200, nIns / 2).map((z): FitOpts => ({ on: key, at: [(i ? 1 : -1) * (MW / 2 + t), ry + 60, z], dir: [i ? -1 : 1, 0, 0] })));
  step(b, `Push the inserts and rivets into the side rails`, `${nIns} of each: an insert in each hole, then a rivet pressed into its middle.`, "general", { scene: "prep" }, () => {
    b.fits(INSERT, railIns, 0.08);
    b.then(0.1);
    b.fits(RIVET, railIns, 0.08);
  });
  step(b, "Tighten the ledge screws", "The screws are already in the ledges: tighten them all with a screwdriver.", "screws", { scene: "prep", tools: ["screwdriver"] }, () => {});
  const ends = [head, foot];
  if (wide) {
    const hang = ends.map((key, i): FitOpts => ({ on: key, at: [0, ledgeY - 30, i ? zFoot - t : zHead], dir: [0, 0, i ? 1 : -1], hole: false }));
    step(b, "Fit the beam hangers to the end rails", "One in the middle of the head rail and one in the middle of the foot rail, each held by two inserts and rivets. Tighten their screws.", "screws", { scene: "rails", tools: ["screwdriver"] }, () => {
      b.stagger(0.2);
      b.stage(head, headRail.mid, [0, 0, 0], [0, 120, 0]);
      b.stage(foot, k.pos(foot), [0, 0, 0], [0, 120, 0]);
      b.then(0.15);
      b.fits(BEAM_HANGER, hang, 0.2);
      b.then(0.1);
      const ins = ends.flatMap((key, i) => [-40, 40].map((dx): FitOpts => ({ on: key, at: [dx, ledgeY - 50, i ? zFoot : zHead - t], dir: [0, 0, i ? -1 : 1] })));
      b.fits(INSERT, ins, 0.08);
      b.fits(RIVET, ins, 0.08);
    });
  }
  step(b, "Stick the felt pads under the legs", "Peel them off the sheet: one under each leg.", "general", { scene: "legs" }, () => {
    b.stagger(0.1);
    legs.forEach((l, i) => b.stage(l.k, [(i - 1.5) * 120, LH / 2, 0], [0, 0, 0], [0, 120, 0]));
    b.then(0.15);
    b.fits(BED_PAD, legs.map((l): FitOpts => ({ on: l.k, at: [l.p[0], 0, l.p[2]], dir: [0, 1, 0], hole: false })), 0.1);
  });
  step(b, "Screw two legs onto the head rail", "One under each end, through a spacer, by hand.", "legs", { scene: "rails" }, () => {
    if (!wide) b.stage(head, headRail.mid, [0, 0, 0], [0, 120, 0]);
    b.then(0.1);
    const hl = legs.filter((l) => l.h);
    b.fits(LEG_SPACER, hl.map((l): FitOpts => ({ at: [l.p[0], LH, l.p[2]], on: l.k, dir: [0, 1, 0], hole: false })), 0.15);
    b.then(0.1);
    for (const l of hl) b.stage(l.k, l.p, [0, 0, 0], [0, -150, 0]);
  });
  step(b, "Tap the dowels into the side rails", "Two into the head end of each.", "dowels", { scene: "prep", tools: ["hammer"] }, () =>
    b.fits(BED_DOWEL, side.flatMap((key, i) => [ry - 50, ry + 50].map((y): FitOpts => ({ on: key, at: [(i ? 1 : -1) * xs, y, zHead], dir: [0, 0, 1], mate: head })), 0.1)),
  );
  const corner = (g: number, atHead: boolean) => {
    const x = g * (MW / 2 + t / 2), z = atHead ? zHead + 20 : zFoot - 20;
    return { post: { at: [x, FH + 10, z] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const }, plate: { at: [x, ry - RH / 2, z] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const } };
  };
  for (const i of [0, 1]) {
    const g = i ? 1 : -1;
    step(b, i ? "Join the other side rail to the head rail" : "Join a side rail to the head rail", "One holds the rail on its dowels while the other drops the corner post in from above, puts the plate under and bolts them together with a washer.", "join", { people: 2, tools: ["allen"] }, () => {
      if (!i) {
        b.stagger(0);
        b.add(head, [0, 0, 0]);
        for (const l of legs.filter((x) => x.h)) b.add(l.k, [0, 0, 0]);
        b.then(0.1);
      }
      b.add(side[i], [g * 300, 0, 300]);
      b.add(ledges[i], [g * 300, 0, 300]);
      b.then(0.15);
      const c = corner(g, true);
      b.fit(CORNER_POST, { on: side[i], ...c.post });
      b.then(0.05);
      b.fit(CORNER_PLATE, { on: side[i], ...c.plate });
      b.then(0.05);
      b.fit(BED_WASHER, { on: side[i], ...c.plate, at: [c.plate.at[0], c.plate.at[1] - 4, c.plate.at[2]] });
      b.fit(BED_BOLT, { on: side[i], ...c.plate, at: [c.plate.at[0], c.plate.at[1] - 6, c.plate.at[2]] });
    });
  }
  step(b, "Fit the foot rail together", "Push it onto the ends of the side rails, then a corner post from above and a plate underneath at each corner.", "join", { people: 2 }, () => {
    b.add(foot, [0, 0, 300]);
    b.then(0.15);
    for (const g of [-1, 1]) {
      const c = corner(g, false);
      b.fit(CORNER_POST, { on: side[g < 0 ? 0 : 1], ...c.post });
      b.fit(CORNER_PLATE, { on: side[g < 0 ? 0 : 1], ...c.plate });
    }
  });
  step(b, "Screw in the foot legs", "Up through the corner plates, each with a spacer. Hand tight.", "legs", { people: 2 }, () => {
    const fl = legs.filter((l) => !l.h);
    b.fits(LEG_SPACER, fl.map((l): FitOpts => ({ on: l.k, at: [l.p[0], LH, l.p[2]], dir: [0, 1, 0], hole: false })), 0.15);
    b.then(0.05);
    for (const l of fl) b.add(l.k, [0, -200, 0], { spin: Math.PI * 4 });
  });
  const hooks = spread(-W / 2 + 120, W / 2 - 120, 4).flatMap((x) => [FH + 120, FH + 520].map((y): FitOpts => ({ on: headboard, at: [x, y, -L / 2], dir: [0, 0, 1], hole: false })));
  step(b, "Push the hangers into the headboard", "Lay it face down on a rug: eight hangers into the holes in its back frame.", "general", { scene: "head", warnings: ["face", "floor"] }, () => {
    b.stage(headboard, [0, hbT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(HB_HANGER, hooks, 0.08);
  });
  step(b, "Hang the headboard on together", "Lift it over the uprights and lower it so every hanger slides down onto them.", "join", { people: 2 }, () => b.add(headboard, [0, 400, -200]));
  step(b, "Fit the two filler blocks", "Tap two dowels into each, then push them into the headboard's sides, over the ends of the side rails.", "dowels", { tools: ["hammer"] }, () => {
    b.fits(BED_DOWEL, blocks.flatMap((key, i) => [-40, 40].map((dz): FitOpts => ({ on: key, at: [(i ? 1 : -1) * (MW / 2 + CT / 2), FH + 20, zHead + 70 + dz], dir: [0, 1, 0] }))), 0.1);
    b.then(0.1);
    b.stagger(0.2);
    for (const key of blocks) b.add(key, [0, 0, 200]);
  });
  step(b, "Pull the covers over the rails", "Start at the head end of each side rail, then the foot rail. Close the touch fastening underneath all the way along.", "general", { people: 2 }, () => {
    b.stagger(0.3);
    for (const key of covers) b.add(key, [0, 200, 0]);
  });
  step(b, "Smooth the corners and zip the headboard cover", "Tuck the fabric neatly round each leg and close the zip down the back of the headboard.", "general", {}, () => {});
  if (wide) {
    step(b, "Hang the centre beam", "Drop its ends into the hangers in the head and foot rails.", "join", {}, () => b.add(beam, [0, 300, 0]));
    step(b, "Clip on the beam clips and slat stops", "Two clips on top of the beam and a stop at each end of the slat ledges.", "general", {}, () => {
      b.fits(BEAM_CLIP, [zHead + 40, zFoot - 40].map((z): FitOpts => ({ on: beam, at: [0, ledgeY + 11, z], dir: [0, -1, 0], hole: false })), 0.15);
      b.fits(SLAT_CLIP, ledges.flatMap((key, i) => [zHead + 30, zFoot - 30].map((z): FitOpts => ({ on: key, at: [(i ? 1 : -1) * (MW / 2 - 15), ledgeY + 11, z], dir: [0, -1, 0], hole: false }))), 0.1);
    });
  } else
    step(b, "Clip on the slat stops", "One at each end of the slat ledges.", "general", {}, () =>
      b.fits(SLAT_CLIP, ledges.flatMap((key, i) => [zHead + 30, zFoot - 30].map((z): FitOpts => ({ on: key, at: [(i ? 1 : -1) * (MW / 2 - 15), ledgeY + 11, z], dir: [0, -1, 0], hole: false }))), 0.1),
    );
  step(b, "Lay the grip strips on", wide ? "Six along the slat ledges and three along the beam, end to end. They stop the slats sliding." : "Three along each slat ledge, end to end. They stop the slats sliding.", "general", {}, () => {
    b.stagger(0.1);
    for (const key of strips) b.add(key, [0, 150, 0]);
  });
  step(b, "Roll out the slats", "The slatted base is sold separately. Start at the head end and tuck the end slats under the stops.", "slats", {}, () => b.add(slats, [0, 200, -400]));
  return true;
}

const HANGER_BOLT: HwDef = { kind: "legScrew", len: 60, dia: 8, name: "Hanger bolt" };
const RAIL_CAM: HwDef = { kind: "cam", len: 20, dia: 35 };
const SLAT_RAIL_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const HOLDER_SCREW: HwDef = { kind: "screw", len: 12, dia: 5 };
const BEAM_SCREW: HwDef = { kind: "screw", len: 10, dia: 5 };
const SLAT_HOLDER: HwDef = { kind: "cap", len: 20, dia: 25, name: "Slat holder" };
const BEAM_BRACKET: HwDef = { kind: "bracket", len: 80, dia: 50, name: "Beam bracket" };
const BEAM_SLEEVE: HwDef = { kind: "connector", len: 120, dia: 60, name: "Beam sleeve" };
const SMALL_CAM: HwDef = { kind: "cam", len: 12, dia: 13 };
const SMALL_DOWEL: HwDef = { kind: "dowel", len: 25, dia: 6 };
const BLOCK_SCREW: HwDef = { kind: "screw", len: 50, dia: 6 };

/**
 * The wooden bed with spindles: the headboard is built lying on one of its posts (spindle panel and the board under
 * it, then the other post), the footboard comes in one piece. Hanger bolts go into the posts and the side rails lock
 * onto them with big cam locks, two people at a time. Metal slat rails screw along the side rails, the two-part
 * centre beam sits in brackets, and the LURÖY slats roll out under eight holders.
 */
function buildWoodBed(b: PlanBuilder, s: ProductSpec, o: { storage?: boolean } = {}) {
  const k = new Kit(b);
  const W = s.size.w * 10, L = s.size.d * 10, H = s.size.h * 10;
  const P = 60, FH = 480, t = 22;
  const xp = W / 2 - P / 2, zh = -L / 2 + P / 2, zf = L / 2 - P / 2;
  const inW = W - 2 * P;
  const posts = [-1, 1].map((g) => k.part("Head post", [P, H, P], [g * xp, H / 2, zh], { material: "wood" }));
  const board = k.part("Head board", [inW, 260, t], [0, 200 + 130, zh]);
  const spH = H - 60 - 460;
  const spN = Math.round(inW / 45);
  const spindle = b.compound("Spindle panel", [
    { shape: "box", size: [inW, 40, t], pos: [0, 480, zh] },
    { shape: "box", size: [inW, 60, 30], pos: [0, H - 60, zh] },
    ...range(spN).map((i) => ({ shape: "box" as const, size: [18, spH - 50, 18] as Vec3, pos: [-inW / 2 + 40 + (i * (inW - 80)) / (spN - 1), 500 + (spH - 50) / 2, zh] as Vec3 })),
  ]);
  const spin = b.place(spindle.type, spindle.mid);
  const fb = b.compound("Footboard", [
    { shape: "box", size: [inW, 240, t], pos: [0, FH - 140, zf] },
    ...[-1, 1].map((g) => ({ shape: "box" as const, size: [P, FH, P] as Vec3, pos: [g * xp, FH / 2, zf] as Vec3 })),
  ], { material: "wood" });
  const footboard = b.place(fb.type, fb.mid);
  const RY = 330, RH = 180;
  const xr = W / 2 - P + t / 2 + 10;
  const rails = [-1, 1].map((g) => k.part("Side rail", [t, RH, L - 2 * P], [g * xr, RY, 0], { material: "wood" }));
  const slatY = RY - 30;
  const slatRails = [-1, 1].map((g) => k.part("Slat rail", [25, 25, L - 2 * P - 20], [g * (xr - t / 2 - 12.5), slatY, 0], { material: "metal" }));
  const halfL = (L - 2 * P) / 2;
  const beams = [-1, 1].map((e) => k.part("Centre beam half", [40, 40, halfL - 10], [0, slatY, (e * halfL) / 2], { material: "metal" }));
  const slats = slatBase(b, 2 * (xr - t / 2) - 20, L - 2 * P - 40, slatY + 16.5, 0, false);
  const g2 = (i: number) => (i ? 1 : -1);
  // the storage version: blocks inside the head and foot boards carry the end runners, drawers hang under the frame
  const yb = RY - RH / 2, xi = xr - t / 2;
  const ryS = yb + 15, bw = inW / 2 - 20;
  const blocks = o.storage ? [zh + t / 2 + 20, zf - t / 2 - 20].map((z) => [-1, 1].map((g) => k.part("Support block", [bw, 60, 40], [g * (inW / 4), ryS, z], { material: "wood" }))) : [];
  const st = o.storage ? bedStorage(k, { xi, xo: xr + t / 2, zH: zh + t / 2 + 40, zF: zf - t / 2 - 40, zX: 0, yb, ch: slatY - 20 - yb, head: (g) => blocks[0][g < 0 ? 0 : 1], foot: (g) => blocks[1][g < 0 ? 0 : 1] }) : null;
  // the headboard lies on its left post: turned a quarter about the depth axis
  const lie = (keys: string[], from?: Vec3) => turnStage(b, keys, [0, 0, Math.PI / 2], [-W / 2, 0, zh], [0, 0, 0], from);
  step(b, "Screw the cam bolts into the head posts", "Lay both posts on a rug, inside faces up: four bolts in each.", "cams", { scene: "head", tools: ["allen"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    lie([posts[0]], [0, 160, 0]);
    b.stage(posts[1], [-H / 2, P / 2, 400], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.then(0.15);
    b.fits(CAM_BOLT, posts.flatMap((key, i) => [480, H - 60, 260, 400].map((y): FitOpts => ({ on: key, at: [g2(i) * (xp - P / 2), y, zh], dir: [g2(i), 0, 0], mate: y > 450 ? spin : board, mateHole: 4 }))), 0.06);
  });
  step(b, "Tap the dowels into the spindle panel and the board", "Two small ones into each lower end of the spindle panel, then ten into the ends of both.", "dowels", { scene: "head", tools: ["hammer"] }, () => {
    b.stagger(0.2);
    b.stage(spin, [-H / 2 + 400, 9, -500], [0, 0, Math.PI / 2], [0, 120, 0]);
    b.stage(board, [-H / 2, 9, -800], [0, 0, Math.PI / 2], [0, 120, 0]);
    b.then(0.15);
    b.fits(SMALL_DOWEL, [0, 1].flatMap((i) => [500, 540].map((y): FitOpts => ({ on: spin, at: [g2(i) * (inW / 2), y, zh], dir: [-g2(i), 0, 0], mate: posts[i] }))), 0.1);
    b.fits(BED_DOWEL, [0, 1].flatMap((i) => [[board, 230], [board, 330], [board, 430], [spin, 700], [spin, H - 60]] as [string, number][]).map(([key, y], j): FitOpts => ({ on: key, at: [g2(j >= 5 ? 1 : 0) * (inW / 2), y, zh], dir: [-g2(j >= 5 ? 1 : 0), 0, 0], mate: posts[j >= 5 ? 1 : 0] })), 0.05);
  });
  step(b, "Stand the spindle panel in the post", "Onto its dowels and cam bolt, then lock it with one small cam lock.", "cams", { scene: "head", tools: ["screwdriver"] }, () => {
    lie([spin], [0, 300, 0]);
    b.then(0.15);
    b.fit(SMALL_CAM, { on: spin, at: [-inW / 2 + 30, 480, zh + t / 2], dir: [0, 0, -1] });
  });
  step(b, "Stand the board in under it", "Push it down onto the dowels next to the spindle panel and lock it with three cam locks.", "cams", { scene: "head", tools: ["screwdriver"] }, () => {
    lie([board], [0, 300, 0]);
    b.then(0.15);
    b.fits(SMALL_CAM, [230, 330, 430].map((y): FitOpts => ({ on: board, at: [-inW / 2 + 30, y, zh + t / 2], dir: [0, 0, -1] })), 0.1);
  });
  step(b, "Lay the other post on and lock it", "Down onto all the dowels and bolts, then four cam locks. Turn the headboard over.", "cams", { scene: "head", tools: ["screwdriver"] }, () => {
    lie([posts[1]], [0, 300, 0]);
    b.then(0.15);
    b.fits(SMALL_CAM, [[board, 260], [board, 400], [spin, 480], [spin, H - 60]].map(([key, y]): FitOpts => ({ on: key as string, at: [inW / 2 - 30, y as number, zh + t / 2], dir: [0, 0, -1] })), 0.1);
  });
  const hb = (i: number, atHead: boolean) => [RY - 45, RY + 45].map((y): FitOpts => ({ on: atHead ? posts[i] : footboard, at: [g2(i) * (xp - P / 2), y, atHead ? zh : zf], dir: [g2(i), 0, 0], mate: rails[i] }));
  step(b, "Screw the hanger bolts into the posts", "Two on the inside of each of the four posts, by hand until they stop.", "screws", { scene: "ends" }, () => {
    b.stagger(0.2);
    for (const key of [...posts, board, spin]) b.stage(key, k.pos(key), [0, 0, 0], [0, 0, 0]);
    b.stage(footboard, fb.mid, [0, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(HANGER_BOLT, [0, 1].flatMap((i) => [...hb(i, true), ...hb(i, false)]), 0.08);
  });
  step(b, "Tap the glides into the posts", "One under each of the four posts.", "general", { scene: "ends", tools: ["hammer"] }, () =>
    b.fits(GLIDE, [0, 1].flatMap((i) => [{ on: posts[i], z: zh }, { on: footboard, z: zf }].map((p): FitOpts => ({ on: p.on, at: [g2(i) * xp, 0, p.z], dir: [0, 1, 0], hole: false }))), 0.1),
  );
  if (o.storage)
    for (const [j, end] of [board, footboard].entries()) {
      const zb = j ? zf - t / 2 : zh + t / 2, n = j ? 1 : -1;
      step(b, j ? "Tap the dowels into the foot blocks" : "Tap the dowels into the head blocks", "Two into the back of each block.", "dowels", { scene: "ends", tools: ["hammer"] }, () =>
        b.fits(BED_DOWEL, blocks[j].flatMap((key, i) => [-1, 1].map((e): FitOpts => ({ on: key, at: [g2(i) * (inW / 4) + e * (bw / 2 - 80), ryS, zb], dir: [0, 0, n], mate: end }))), 0.1),
      );
      step(b, j ? "Screw the blocks to the footboard" : "Screw the blocks to the headboard", "Push them onto their dowels, low down on the inside, then three long screws through the board into each.", "screws", { scene: "ends", tools: ["allen"] }, () => {
        b.stagger(0.2);
        for (const key of blocks[j]) b.stage(key, k.pos(key), [0, 0, 0], [0, 0, -n * 200]);
        b.then(0.15);
        b.fits(BLOCK_SCREW, blocks[j].flatMap((key, i) => [-1, 0, 1].map((e): FitOpts => ({ on: end, at: [g2(i) * (inW / 4) + e * (bw / 2 - 60), ryS, j ? zf + t / 2 : zh - t / 2], dir: [0, 0, -n], mate: key }))), 0.08);
      });
    }
  step(b, "Tap the dowels into the side rails", "Three into each end of both rails.", "dowels", { scene: "rails", tools: ["hammer"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    rails.forEach((key, i) => b.stage(key, [g2(i) * 200, t / 2, 0], [0, 0, (-g2(i) * Math.PI) / 2], [0, 160, 0]));
    b.then(0.15);
    b.fits(BED_DOWEL, rails.flatMap((key, i) => [-L / 2 + P, L / 2 - P].flatMap((z) => [RY - 70, RY, RY + 70].map((y): FitOpts => ({ on: key, at: [g2(i) * xr, y, z], dir: [0, 0, z < 0 ? 1 : -1], mate: z < 0 ? posts[i] : footboard })))), 0.04);
  });
  const camAt = (i: number) => [-L / 2 + P + 40, L / 2 - P - 40].flatMap((z) => [RY - 45, RY + 45].map((y): FitOpts => ({ on: rails[i], at: [g2(i) * (xr - t / 2), y, z], dir: [g2(i), 0, 0] })));
  step(b, "Push the cam locks into the side rails", "Eight big ones, two at each end, on the inside face.", "cams", { scene: "rails" }, () => b.fits(RAIL_CAM, [0, 1].flatMap(camAt), 0.06));
  for (const i of [0, 1])
    step(b, i ? "Fit the other side rail" : "Join a side rail to the head and foot", i ? "The same way on the other side. Then tighten all eight cam locks." : "One holds the headboard and footboard upright while the other pushes the rail onto the hanger bolts at both ends and turns its cam locks.", "cams", { people: 2, tools: ["screwdriver"] }, () => {
      if (!i) {
        b.stagger(0);
        for (const key of [...posts, board, spin, ...(blocks[0] ?? [])]) b.add(key, [0, 0, -300]);
        for (const key of [footboard, ...(blocks[1] ?? [])]) b.add(key, [0, 0, 300]);
        b.then(0.15);
      }
      b.add(rails[i], [g2(i) * 300, 0, 0]);
    });
  if (st) {
    storageFrameSteps(b, st, rails, xi, 0);
    braceStep(b, rails, (g, h) => blocks[h ? 0 : 1][g < 0 ? 0 : 1], xi, ryS, zh + t / 2 + 40, zf - t / 2 - 40);
    lockRunnersStep(b, st);
  }
  step(b, "Screw on the slat rails", "Along the inside of each side rail, eight screws each.", "screws", { tools: ["screwdriver"] }, () => {
    b.stagger(0.2);
    for (const [i, key] of slatRails.entries()) b.add(key, [g2(i) * -200, 100, 0]);
    b.then(0.15);
    b.fits(SLAT_RAIL_SCREW, slatRails.flatMap((key, i) => spread(-L / 2 + P + 80, L / 2 - P - 80, 8).map((z): FitOpts => ({ on: key, at: [g2(i) * (xr - t / 2 - 25), slatY, z], dir: [g2(i), 0, 0], mate: rails[i] }))), 0.04);
  });
  const brk = [{ on: board, z: zh + t / 2 }, { on: footboard, z: zf - t / 2 }];
  step(b, "Screw the beam brackets to the ends", "One in the middle of the head board and one in the middle of the footboard, two screws each.", "screws", { tools: ["screwdriver"] }, () => {
    b.fits(BEAM_BRACKET, brk.map((p, j): FitOpts => ({ on: p.on, at: [0, slatY, p.z], dir: [0, 0, j ? 1 : -1], hole: false })), 0.2);
    b.then(0.1);
    b.fits(SLAT_RAIL_SCREW, brk.flatMap((p, j) => [-25, 25].map((dx): FitOpts => ({ on: p.on, at: [dx, slatY + 30, p.z], dir: [0, 0, j ? 1 : -1] }))), 0.1);
  });
  step(b, "Lay the centre beam in", "Join the two halves with the sleeve and lay the ends in the brackets. Slide the sleeve over the joint.", "join", {}, () => {
    b.stagger(0.3);
    beams.forEach((key, i) => b.add(key, [0, 300, g2(i) * 200]));
    b.then(0.15);
    b.fit(BEAM_SLEEVE, { on: beams[0], at: [0, slatY, -5], dir: [0, 0, 1], hole: false });
  });
  step(b, "Screw the beam in place", "One screw at each bracket and two through the sleeve.", "screws", { tools: ["screwdriver"] }, () =>
    b.fits(BEAM_SCREW, [{ on: beams[0], z: -halfL + 30 }, { on: beams[1], z: halfL - 30 }, { on: beams[0], z: -30 }, { on: beams[1], z: 30 }].map((p): FitOpts => ({ on: p.on, at: [0, slatY + 20, p.z], dir: [0, -1, 0] })), 0.12),
  );
  step(b, "Roll out the slats and fit the holders", "Lay the LURÖY slats over the rails and beam, then screw eight holders over the end slats.", "slats", { tools: ["screwdriver"] }, () => {
    b.add(slats, [0, 200, -400]);
    b.then(0.15);
    const ha = [-1, 1].flatMap((g) => [-1, 1].flatMap((e) => [0, 1].map((j) => [g * (xr - t / 2 - 12 - j * (inW / 2 - 60)), e * (L / 2 - P - 40)] as [number, number])));
    b.fits(SLAT_HOLDER, ha.map(([x, z]): FitOpts => ({ on: Math.abs(x) > 200 ? slatRails[x < 0 ? 0 : 1] : beams[z < 0 ? 0 : 1], at: [x, slatY + 22, z], dir: [0, -1, 0], hole: false })), 0.06);
    b.then(0.1);
    b.fits(HOLDER_SCREW, ha.map(([x, z]): FitOpts => ({ on: Math.abs(x) > 200 ? slatRails[x < 0 ? 0 : 1] : beams[z < 0 ? 0 : 1], at: [x, slatY + 30, z], dir: [0, -1, 0] })), 0.06);
  });
  if (st) bedDrawerSteps(b, st);
  return true;
}

/** Stage parts turned as one group: like turnStage, but keeps a part's own half turn about y (a mirrored copy). */
function groupStage(b: PlanBuilder, keys: string[], rot: Vec3, pv: Vec3, at: Vec3, from?: Vec3) {
  for (const key of keys) {
    const f = b.partItem(key).final;
    const r = rotate([f.pos[0] - pv[0], f.pos[1] - pv[1], f.pos[2] - pv[2]], rot);
    b.stage(key, [r[0] + at[0], r[1] + at[1], r[2] + at[2]], [rot[0], f.rot[1], rot[2]], from);
  }
}

/** Stage parts as they sit in the finished bed, moved by `d` (built on the floor in another scene). */
function shiftStage(b: PlanBuilder, keys: string[], d: Vec3, from?: Vec3) {
  for (const key of keys) {
    const f = b.partItem(key).final;
    b.stage(key, [f.pos[0] + d[0], f.pos[1] + d[1], f.pos[2] + d[2]], f.rot, from);
  }
}

const OT_STUD: HwDef = { kind: "stud", len: 45, dia: 8 };
const OT_NUT: HwDef = { kind: "nut", len: 8, dia: 13, name: "Flange nut" };
const OT_WASHER: HwDef = { kind: "washer", len: 2, dia: 30 };
const OT_BOLT: HwDef = { kind: "bolt", len: 20, dia: 8 };
const OT_SCREW: HwDef = { kind: "screw", len: 14, dia: 5 };
const OT_CAP_NUT: HwDef = { kind: "nut", len: 14, dia: 14, name: "Cap nut" };
const OT_SUPPORT: HwDef = { kind: "bracket", len: 70, dia: 60, name: "Frame support" };
const OT_CATCH: HwDef = { kind: "bracket", len: 90, dia: 70, name: "Catch" };
const OT_PAD: HwDef = { kind: "glide", len: 3, dia: 35, name: "Stick-on pad" };
const OT_THREAD: HwDef = { kind: "nut", len: 25, dia: 16, name: "Threaded sleeve" };
const OT_SLEEVE: HwDef = { kind: "spacer", len: 20, dia: 16, name: "Plastic sleeve" };
const OT_LONG_BOLT: HwDef = { kind: "bolt", len: 90, dia: 8 };
const OT_FRAME_BOLT: HwDef = { kind: "bolt", len: 35, dia: 6, name: "Shoulder bolt" };
const OT_FRAME_SCREW: HwDef = { kind: "screw", len: 12, dia: 6 };
const OT_LID_BOLT: HwDef = { kind: "bolt", len: 60, dia: 6 };
const OT_BUSH: HwDef = { kind: "spacer", len: 10, dia: 14, name: "Bushing" };
const OT_STRUT_BOLT: HwDef = { kind: "bolt", len: 30, dia: 8, name: "Strut bolt" };
const OT_HANDLE_BOLT: HwDef = { kind: "bolt", len: 30, dia: 6 };
const OT_CLAMP: HwDef = { kind: "plate", len: 60, dia: 30, name: "Strap clamp" };
const OT_CLAMP_SCREW: HwDef = { kind: "screw", len: 10, dia: 6 };
const OT_END_HOLDER: HwDef = { kind: "cap", len: 15, dia: 60, name: "Slat holder" };
const OT_MID_HOLDER: HwDef = { kind: "cap", len: 15, dia: 70, name: "Double slat holder" };

/**
 * The upholstered ottoman bed: the base box bolts under the headboard lying face down, then face up it takes two
 * corner brackets and legs. The side rails get their brackets and legs at the foot end, two people bolt them to the
 * head end and the foot rail closes the box. The fabric bottom zips in and is held by cap nuts at the corners, the
 * supports and the catch go in, then the left and right lift mechanisms bolt and screw to the side rails. The metal
 * lid frame is bolted together on the floor, lifted onto the mechanisms by two people, and the gas struts are hung
 * on with the lid open. A strap handle goes under its foot end, and the slats clip into their holders on top.
 */
function buildOttomanBed(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const [MW, ML] = mattressOf(s);
  const W = MW + 100, L = ML + 240, HB = 1200, FH = 390, LH = 60;
  const T = 30; // an upholstered rail
  const zBack = -L / 2, zHi = zBack + 200; // back of the head base and its inner face
  const zFi = L / 2 - T; // inner face of the foot rail
  const xi = W / 2 - T; // inner faces of the side rails
  const RH = FH - LH;
  const zMid = (zBack + zHi) / 2;
  const g2 = (i: number) => (i ? 1 : -1);
  const soft = { material: "soft" as PartMaterial };

  /* the head end */
  const hbPieces: PartPiece[] = [{ shape: "box", size: [W, HB - FH, 150], pos: [0, (FH + HB) / 2, zBack + 90], rot: [-0.04, 0, 0] }];
  const hbC = b.compound("Headboard", hbPieces, soft);
  const headboard = b.place(hbC.type, hbC.mid);
  const yc = LH + RH / 2;
  const baseC = b.compound("Head base", [
    { shape: "box", size: [W, RH, 18], pos: [0, yc, zHi - 9] },
    { shape: "box", size: [W, RH, 18], pos: [0, yc, zBack + 9] },
    { shape: "box", size: [W, 20, 164], pos: [0, FH - 10, zMid] },
    ...[-1, 1].map((g) => ({ shape: "box" as const, size: [18, RH - 20, 164] as Vec3, pos: [g * (W / 2 - 9), yc - 10, zMid] as Vec3 })),
    ...[-1, 1].map((g) => ({ shape: "box" as const, size: [18, RH - 20, 164] as Vec3, pos: [(g * W) / 6, yc - 10, zMid] as Vec3, material: "board" as PartMaterial })),
  ], soft);
  const base = b.place(baseC.type, baseC.mid);
  const xb = xi - 25; // corner brackets, mechanisms and the lid's side tubes line up along here
  const zbH = zHi + 30, zbF = zFi - 30;
  const BY0 = LH, BY1 = 350; // corner brackets, bottom and top
  const bracket = (g: number, z: number) => k.part("Corner bracket", [50, BY1 - BY0, 60], [g * xb, (BY0 + BY1) / 2, z], { material: "metal" });
  const headBr = [-1, 1].map((g) => bracket(g, zbH));
  const footBr = [-1, 1].map((g) => bracket(g, zbF));
  const leg = (g: number, z: number) => k.part("Leg", [60, LH, 60], [g * xb, LH / 2, z], { shape: "cyl", material: "metal" });
  const headLegs = [-1, 1].map((g) => leg(g, zbH));
  const footLegs = [-1, 1].map((g) => leg(g, zbF));
  const rails = [-1, 1].map((g) => k.part("Side rail", [T, RH, zFi - zHi], [g * (xi + T / 2), yc, (zHi + zFi) / 2], soft));
  const foot = k.part("Foot rail", [W, RH, T], [0, yc, zFi + T / 2], soft);
  const bottom = k.part("Storage bottom", [2 * xi - 4, 3, zFi - zHi - 4], [0, LH + 4, (zHi + zFi) / 2], soft);

  /* the lift mechanisms, folded down as they are when the lid is shut */
  const zm0 = zbH + 40, zm1 = zm0 + 600, zmc = (zm0 + zm1) / 2;
  const mechs = [0, 1].map((i) => {
    const g = g2(i), x = g * xb;
    const c = b.compound(i ? "Lift mechanism, right" : "Lift mechanism, left", [
      { shape: "box", size: [50, 30, 600], pos: [x, LH + 22, zmc] },
      { shape: "box", size: [50, 10, 620], pos: [x, BY1 - 5, zmc] },
      { shape: "box", size: [6, 150, 300], pos: [x - g * 22, 170, zm0 + 160] },
      ...[zm1 - 80, zm0 + 180].map((z) => ({ shape: "box" as const, size: [12, 250, 30] as Vec3, pos: [x - g * 10, 218, z] as Vec3, rot: [-0.35, 0, 0] as Vec3 })),
    ], { material: "metal" });
    return b.place(c.type, c.mid);
  });
  const sLow: Vec3 = [0, 110, zm1 - 30], sHigh: Vec3 = [0, 300, zm0 + 160];
  const sv = [0, sHigh[1] - sLow[1], sHigh[2] - sLow[2]];
  const sLen = Math.hypot(sv[1], sv[2]);
  const struts = [-1, 1].map((g) => k.part("Gas strut", [22, sLen, 22], [g * (xb - 20), (sLow[1] + sHigh[1]) / 2, (sLow[2] + sHigh[2]) / 2], { shape: "cyl", material: "metal", rot: [Math.atan2(sv[2], sv[1]), 0, 0] }));

  /* the lid frame */
  const yF = BY1 + 15; // centre of its tubes
  const zH = zbH, zF = zFi - 20, zc = (zH + zF) / 2;
  const tubeC = b.compound("Side tube", [
    { shape: "box", size: [30, 30, zF - zH + 30], pos: [xb, yF, zc] },
    ...[zH, zF].map((z) => ({ shape: "box" as const, size: [40, 30, 30] as Vec3, pos: [xb - 35, yF, z] as Vec3 })),
  ], { material: "metal" });
  const tubes = [b.place(tubeC.type, [-tubeC.mid[0], tubeC.mid[1], tubeC.mid[2]], [0, Math.PI, 0]), b.place(tubeC.type, tubeC.mid)];
  const ends = [zH, zF].map((z) => k.part("End bar", [2 * (xb - 55), 30, 30], [0, yF, z], { material: "metal" }));
  const centre = k.part("Centre bar", [30, 30, zF - zH - 30], [0, yF, zc], { material: "metal" });
  const cross = k.part("Cross bar", [2 * xb + 30, 30, 30], [0, yF - 30, zc], { material: "metal" });
  const RY = yF + 105, RX = 600;
  const retC = b.compound("Mattress retainer", [
    { shape: "cyl", size: [14, 2 * RX + 14, 14], pos: [0, RY, 0], rot: [0, 0, Math.PI / 2] },
    ...[-1, 1].map((g) => ({ shape: "cyl" as const, size: [14, RY - yF - 15, 14] as Vec3, pos: [g * RX, (RY + yF + 15) / 2, 0] as Vec3 })),
  ], { material: "metal" });
  const retainers = [zH, zF].map((z) => b.place(retC.type, [retC.mid[0], retC.mid[1], z]));
  const handleC = b.compound("Strap handle", [
    { shape: "box", size: [100, 15, 100], pos: [0, yF - 22, zF - 20] },
    { shape: "box", size: [60, 45, 6], pos: [0, FH + 8, zF + 17] },
  ], { material: "metal" });
  const handle = b.place(handleC.type, handleC.mid);
  const frame = [...tubes, ...ends, centre, cross];

  /* the slats, in two rows either side of the centre bar */
  const nSl = 16;
  const slZ = spread(zH + 60, zF - 60, nSl);
  const ySl = yF + 15 + 8 + 4;
  const slats = [-1, 1].flatMap((g) => slZ.map((z) => k.part("Slat", [730, 8, 60], [g * 375, ySl, z], { material: "wood" })));

  /* the head end, lying on a rug: face down first, then face up */
  const headKeys = [headboard, base];
  const pv: Vec3 = [0, LH, zMid];
  const down: Vec3 = [Math.PI / 2, 0, 0], up: Vec3 = [-Math.PI / 2, 0, 0];
  const studX = spread(-W / 2 + 150, W / 2 - 150, 6);
  step(b, "Screw the studs into the headboard", "Lay it face down on a rug. Six studs, by hand, into the holes along its bottom edge.", "screws", { scene: "head", warnings: ["face", "floor"] }, () => {
    groupStage(b, [headboard], down, pv, [0, 100, -400], [0, 160, 0]);
    b.then(0.15);
    b.fits(OT_STUD, studX.map((x): FitOpts => ({ on: headboard, at: [x, FH, zMid], dir: [0, 1, 0], mate: base })), 0.08);
  });
  step(b, "Bolt the base box under it", "Slide the base box over the studs, then a washer and a nut on each from inside. Keep the fabric flap out of the joint.", "bolts", { scene: "head", tools: ["wrench"] }, () => {
    groupStage(b, [base], down, pv, [0, 100, -400], [0, 0, -300]);
    b.then(0.15);
    b.fits(OT_WASHER, studX.map((x): FitOpts => ({ on: base, at: [x, FH - 20, zMid], dir: [0, 1, 0], hole: false })), 0.06);
    b.then(0.05);
    b.fits(OT_NUT, studX.map((x): FitOpts => ({ on: base, at: [x, FH - 22, zMid], dir: [0, 1, 0], hole: false })), 0.06);
  });
  step(b, "Close the zips at both ends", "The cover of the base box zips shut round each end.", "general", { scene: "head" }, () => {});
  step(b, "Turn it over and fasten the flap", "Face up now. Fold the fabric flap over the top of the base box and press the touch fastening shut all along.", "flip", { scene: "head", warnings: ["floor"] }, () => {
    groupStage(b, headKeys, up, pv, [0, 100, 600]);
  });
  step(b, "Screw on the head corner brackets", "One at each end of the base box, two bolts each. Use the long Allen key.", "bolts", { scene: "head", tools: ["allen"] }, () => {
    groupStage(b, headBr, up, pv, [0, 100, 600], [0, 120, 0]);
    b.then(0.15);
    b.fits(OT_BOLT, headBr.flatMap((key, i) => [BY0 + 40, BY1 - 40].map((y): FitOpts => ({ on: key, at: [g2(i) * xb, y, zHi + 60], dir: [0, 0, -1], mate: base }))), 0.08);
  });
  step(b, "Screw in the two head legs", "Into the bottom of each bracket, by hand.", "legs", { scene: "head" }, () => {
    for (const key of headLegs) groupStage(b, [key], up, pv, [0, 100, 600], [0, 0, 160]);
  });
  const lay = (i: number, keys: string[], from?: Vec3) => groupStage(b, keys, [0, 0, (-g2(i) * Math.PI) / 2], k.pos(rails[i]), [g2(i) * 400, T / 2, 0], from);
  step(b, "Screw the corner brackets to the side rails", "Lay both rails inside face up and screw a bracket to the foot end of each, two bolts each. They make a left and a right rail.", "bolts", { scene: "rails", tools: ["allen"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    lay(0, [rails[0]], [0, 160, 0]);
    lay(1, [rails[1]], [0, 160, 0]);
    b.then(0.15);
    lay(0, [footBr[0]], [0, 120, 0]);
    lay(1, [footBr[1]], [0, 120, 0]);
    b.then(0.1);
    b.fits(OT_BOLT, footBr.flatMap((key, i) => [BY0 + 60, BY1 - 60].map((y): FitOpts => ({ on: key, at: [g2(i) * (xb - 25), y, zbF], dir: [g2(i), 0, 0], mate: rails[i] }))), 0.08);
  });
  step(b, "Screw in the two foot legs", "Into the bottom of each bracket, by hand.", "legs", { scene: "rails" }, () => {
    lay(0, [footLegs[0]], [-160, 0, 0]);
    lay(1, [footLegs[1]], [160, 0, 0]);
  });
  const railBolts = (i: number) => [BY0 + 60, BY1 - 60].map((y): FitOpts => ({ on: headBr[i], at: [g2(i) * (xb - 25), y, zbH], dir: [g2(i), 0, 0], mate: rails[i] }));
  step(b, "Bolt a side rail to the head end", "Stand the headboard up. One holds the rail against the corner bracket while the other puts in two bolts.", "join", { people: 2, tools: ["allen"] }, () => {
    b.stagger(0);
    for (const key of [...headKeys, ...headBr, ...headLegs]) b.add(key, [0, 0, -200]);
    b.then(0.15);
    b.stagger(0);
    for (const key of [rails[0], footBr[0], footLegs[0]]) b.add(key, [-300, 0, 300]);
    b.then(0.15);
    b.fits(OT_BOLT, railBolts(0), 0.1);
  });
  step(b, "Bolt on the other side rail", "The same way: hold it to the bracket and put in two bolts.", "join", { people: 2, tools: ["allen"] }, () => {
    b.stagger(0);
    for (const key of [rails[1], footBr[1], footLegs[1]]) b.add(key, [300, 0, 300]);
    b.then(0.15);
    b.fits(OT_BOLT, railBolts(1), 0.1);
  });
  step(b, "Bolt the foot rail on", "Across the ends of the side rails, two bolts into each foot bracket.", "join", { tools: ["allen"] }, () => {
    b.add(foot, [0, 0, 300]);
    b.then(0.15);
    b.fits(OT_BOLT, footBr.flatMap((key, i) => [BY0 + 60, BY1 - 60].map((y): FitOpts => ({ on: key, at: [g2(i) * xb, y, zbF + 30], dir: [0, 0, 1], mate: foot }))), 0.08);
  });
  step(b, "Check all sixteen bolts sit flush", "Every bolt head should be flat in its hole. Tighten any that stand proud.", "general", { tools: ["allen"] }, () => {});
  step(b, "Lay in the storage bottom and zip it along the sides", "Its four corner eyelets go over the studs under the brackets. Start each zip about 20 cm from a corner.", "general", {}, () => {
    b.add(bottom, [0, 300, 0]);
  });
  step(b, "Zip it along the ends", "Close the other four zips, at the head and the foot.", "general", {}, () => {});
  step(b, "Screw the cap nuts on at the corners", "One onto each stud through the bottom's corner eyelets.", "screws", {}, () =>
    b.fits(OT_CAP_NUT, [...headBr, ...footBr].map((key): FitOpts => ({ on: key, at: [k.pos(key)[0], LH + 8, k.pos(key)[2]], dir: [0, -1, 0], hole: false })), 0.12),
  );
  const supports: { on: string; at: Vec3; dir: Vec3 }[] = [
    { on: base, at: [-W / 4, BY1 - 15, zHi], dir: [0, 0, -1] },
    { on: rails[1], at: [xi, BY1 - 15, zc + 400], dir: [1, 0, 0] },
    { on: rails[0], at: [-xi, BY1 - 15, zc + 400], dir: [-1, 0, 0] },
    { on: foot, at: [W / 4, BY1 - 15, zFi], dir: [0, 0, 1] },
  ];
  step(b, "Screw on the four frame supports", "One on the head base, one on each side rail and one on the foot rail, four screws each. The lid frame rests on them.", "screws", { tools: ["screwdriver"] }, () => {
    b.fits(OT_SUPPORT, supports.map((p): FitOpts => ({ ...p, hole: false })), 0.15);
    b.then(0.1);
    const along = (d: Vec3): Vec3 => (d[2] ? [1, 0, 0] : [0, 0, 1]);
    b.fits(OT_SCREW, supports.flatMap((p) => [-1, 1].flatMap((e) => [-45, -20].map((dy): FitOpts => {
      const a = along(p.dir);
      return { on: p.on, at: [p.at[0] + a[0] * e * 18, p.at[1] + dy, p.at[2] + a[2] * e * 18], dir: p.dir };
    }))), 0.04);
  });
  const catchAt: Vec3 = [0, FH - 70, zFi];
  step(b, "Screw the catch inside the foot rail", "In the middle, with four screws. The strap handle clicks into it.", "screws", { tools: ["screwdriver"] }, () => {
    b.fit(OT_CATCH, { on: foot, at: catchAt, dir: [0, 0, 1], hole: false });
    b.then(0.1);
    b.fits(OT_SCREW, [-1, 1].flatMap((e) => [-30, 30].map((dy): FitOpts => ({ on: foot, at: [e * 30, catchAt[1] + dy, zFi], dir: [0, 0, 1] }))), 0.06);
  });
  step(b, "Stick on the pads", "Eight, peeled off the sheets: on top of the four corner brackets and the four supports, where the lid frame rests.", "general", {}, () => {
    const tops: FitOpts[] = [...headBr, ...footBr].map((key) => ({ on: key, at: [k.pos(key)[0], BY1, k.pos(key)[2]] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const }));
    tops.push(...supports.map((p): FitOpts => ({ on: p.on, at: [p.at[0] - p.dir[0] * 25, BY1, p.at[2] - p.dir[2] * 25], dir: [0, -1, 0], hole: false })));
    b.fits(OT_PAD, tops, 0.08);
  });
  const yP = LH + 50;
  const frontHole = (i: number): Vec3 => [g2(i) * xi, yP, zm1 - 30];
  step(b, "Push the threaded sleeves into the side rails", "One into the hole near the middle of each rail, from inside. Never open a lift mechanism before it is fitted: the spring can snap it up.", "general", { warnings: ["hand"] }, () =>
    b.fits(OT_THREAD, [0, 1].map((i): FitOpts => ({ on: rails[i], at: frontHole(i), dir: [g2(i), 0, 0] })), 0.15),
  );
  const mechBolt = (i: number, z: number): [FitOpts, FitOpts] => [
    { on: rails[i], at: [g2(i) * (xi - 2), yP, z], dir: [g2(i), 0, 0], hole: false },
    { on: mechs[i], at: [g2(i) * (xb - 25), yP, z], dir: [g2(i), 0, 0], mate: rails[i] },
  ];
  step(b, "Bolt in the left and right lift mechanisms", "They are marked L and R: the right one goes on the right side seen from the foot. A plastic sleeve and one long bolt each at the front.", "bolts", { tools: ["allen"] }, () => {
    b.stagger(0.3);
    mechs.forEach((key, i) => b.add(key, [-g2(i) * 250, 200, 0]));
    b.then(0.15);
    const f = [0, 1].map((i) => mechBolt(i, zm1 - 30));
    b.fits(OT_SLEEVE, f.map((x) => x[0]), 0.1);
    b.then(0.05);
    b.fits(OT_LONG_BOLT, f.map((x) => x[1]), 0.1);
  });
  step(b, "Put in the back bolts", "A sleeve and a long bolt through the back of each mechanism. Use the long bolts here, not the short ones.", "bolts", { tools: ["allen"] }, () => {
    const f = [0, 1].map((i) => mechBolt(i, zm0 + 40));
    b.fits(OT_SLEEVE, f.map((x) => x[0]), 0.1);
    b.then(0.05);
    b.fits(OT_LONG_BOLT, f.map((x) => x[1]), 0.1);
  });
  step(b, "Screw the mechanisms to the side rails", "Five screws along the foot of each one.", "screws", { tools: ["screwdriver"] }, () =>
    b.fits(OT_SCREW, [0, 1].flatMap((i) => spread(zm0 + 90, zm1 - 90, 5).map((z): FitOpts => ({ on: mechs[i], at: [g2(i) * (xb - 25), LH + 22, z], dir: [g2(i), 0, 0], mate: rails[i] }))), 0.05),
  );
  step(b, "Move the bed into place together", "Lift it, don't drag it. Once the lid frame is on it is much heavier.", "general", { people: 2 }, () => {});

  /* the lid frame, built upside down on the floor */
  const flip: Vec3 = [Math.PI, 0, 0], fpv: Vec3 = [0, yF, zc], fat: Vec3 = [0, 15, 0];
  step(b, "Join the end bars to the centre bar", "Upside down on the floor. One shoulder bolt through each end bar into the end of the centre bar.", "bolts", { scene: "frame", tools: ["allen"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    groupStage(b, [centre], flip, fpv, fat, [0, 160, 0]);
    groupStage(b, ends, flip, fpv, fat, [0, 160, 0]);
    b.then(0.15);
    b.fits(OT_FRAME_BOLT, ends.map((key, i): FitOpts => ({ on: key, at: [0, yF, i ? zF + 15 : zH - 15], dir: [0, 0, i ? -1 : 1], mate: centre })), 0.15);
  });
  step(b, "Push the side tubes on", "Slide the bent ends of each side tube over the ends of both end bars.", "join", { scene: "frame" }, () => {
    b.stagger(0.3);
    tubes.forEach((key, i) => groupStage(b, [key], flip, fpv, fat, [g2(i) * 250, 0, 0]));
  });
  step(b, "Screw the cross bar on, then turn the frame over", "Across the middle: three shoulder bolts, into both side tubes and the centre bar.", "bolts", { scene: "frame", tools: ["allen"] }, () => {
    groupStage(b, [cross], flip, fpv, fat, [0, 160, 0]);
    b.then(0.15);
    b.fits(OT_FRAME_BOLT, [-xb, 0, xb].map((x): FitOpts => ({ on: cross, at: [x, yF - 45, zc], dir: [0, 1, 0], mate: x ? tubes[x < 0 ? 0 : 1] : centre })), 0.12);
  });
  const fDrop: Vec3 = [0, -(yF - 45), 0];
  step(b, "Bolt the corners", "Right way up now: two bolts at each corner, through the side tube into the end bar.", "bolts", { scene: "frame", tools: ["allen"], warnings: ["floor"] }, () => {
    shiftStage(b, frame, fDrop);
    b.then(0.15);
    b.fits(OT_FRAME_SCREW, [0, 1].flatMap((i) => [zH, zF].flatMap((z) => [xb, xb - 40].map((x): FitOpts => ({ on: tubes[i], at: [g2(i) * x, yF + 15, z], dir: [0, -1, 0], mate: ends[z === zH ? 0 : 1] })))), 0.05);
  });
  step(b, "Screw on the mattress retainers", "One U-shaped bar at the head end and one at the foot end, two bolts each from underneath.", "bolts", { scene: "frame", tools: ["allen"] }, () => {
    b.stagger(0.3);
    shiftStage(b, retainers, fDrop, [0, 160, 0]);
    b.then(0.15);
    b.fits(OT_FRAME_SCREW, retainers.flatMap((key, j) => [-RX, RX].map((x): FitOpts => ({ on: ends[j], at: [x, yF - 15, j ? zF : zH], dir: [0, 1, 0], mate: key }))), 0.08);
  });
  step(b, "Lift the frame onto the mechanisms together", "Retainers up, the head end at the headboard. Lower it onto the mechanisms and put in a bolt at the head end of each.", "join", { people: 2, tools: ["allen"] }, () => {
    b.stagger(0);
    for (const key of [...frame, ...retainers]) b.add(key, [0, 500, 0]);
    b.then(0.15);
    b.fits(OT_LID_BOLT, tubes.map((key, i): FitOpts => ({ on: key, at: [g2(i) * xb, yF + 15, zm0 + 30], dir: [0, -1, 0], mate: mechs[i] })), 0.15);
  });
  step(b, "Bolt the frame to the mechanisms", "Two more bolts down through each side tube.", "bolts", { tools: ["allen"] }, () =>
    b.fits(OT_LID_BOLT, tubes.flatMap((key, i) => [zmc, zm1 - 40].map((z): FitOpts => ({ on: key, at: [g2(i) * xb, yF + 15, z], dir: [0, -1, 0], mate: mechs[i] }))), 0.1),
  );
  const strutTop = (i: number): Vec3 => [g2(i) * (xb - 20), sHigh[1], sHigh[2]];
  step(b, "Lift the lid and push in the bushings", "Raise the frame by its foot end and hold it up. One bushing into the upper strut hole of each mechanism.", "general", {}, () =>
    b.fits(OT_BUSH, [0, 1].map((i): FitOpts => ({ on: mechs[i], at: strutTop(i), dir: [g2(i), 0, 0], hole: false })), 0.15),
  );
  step(b, "Hang the gas struts on", "Each strut is already fixed at its lower end. Lift its top over the bushing and bolt it with the short bolt.", "bolts", { tools: ["allen"] }, () => {
    b.stagger(0.3);
    struts.forEach((key) => b.add(key, [0, -60, 80]));
    b.then(0.15);
    b.fits(OT_STRUT_BOLT, [0, 1].map((i): FitOpts => ({ on: struts[i], at: [g2(i) * (xb - 40), sHigh[1], sHigh[2]], dir: [g2(i), 0, 0], mate: mechs[i] })), 0.15);
  });
  step(b, "Tighten all six mechanism bolts", "The four long bolts and the two strut bolts, with the small Allen key, until each sits flat.", "bolts", { tools: ["allen"] }, () => {});
  step(b, "Fit the strap handle under the foot end", "Two bolts up through the handle into the end bar, then the clamp over the strap on top with two screws.", "bolts", { tools: ["allen"] }, () => {
    b.add(handle, [0, -150, 0]);
    b.then(0.15);
    b.fits(OT_HANDLE_BOLT, [-30, 30].map((x): FitOpts => ({ on: handle, at: [x, yF - 30, zF], dir: [0, 1, 0], mate: ends[1] })), 0.1);
    b.then(0.05);
    b.fit(OT_CLAMP, { on: ends[1], at: [0, yF + 15, zF], dir: [0, -1, 0], hole: false });
    b.then(0.05);
    b.fits(OT_CLAMP_SCREW, [-20, 20].map((x): FitOpts => ({ on: ends[1], at: [x, yF + 17, zF], dir: [0, -1, 0] })), 0.1);
  });
  step(b, "Tuck the flaps down over the mechanisms", "The fabric flaps on the base box fold down in front of the mechanisms.", "general", {}, () => {});
  step(b, "Close the lid", "Pull it down by the strap until the handle clicks into the catch, then check it holds.", "general", {}, () => {});
  step(b, "Clip the double holders onto the centre bar", "Sixteen, pressed into the holes all along it.", "slats", {}, () =>
    b.fits(OT_MID_HOLDER, slZ.map((z): FitOpts => ({ on: centre, at: [0, yF + 19, z], dir: [0, -1, 0], hole: false })), 0.04),
  );
  step(b, "Push a holder onto one end of every slat", `${2 * nSl} slats, ${2 * nSl} holders, on the outer end of each.`, "slats", { scene: "slats" }, () => {
    b.stagger(0.02);
    shiftStage(b, slats, [0, 4 - ySl, 0], [0, 120, 0]);
    b.then(0.15);
    b.fits(OT_END_HOLDER, slats.map((key): FitOpts => ({ on: key, at: [Math.sign(k.pos(key)[0]) * xb, yF + 19, k.pos(key)[2]], dir: [0, -1, 0], hole: false })), 0.02);
  });
  step(b, "Lay in the slats", "Bare end into the double holder on the centre bar, then press the holder at the other end into the side tube.", "slats", {}, () => {
    b.stagger(0.03);
    for (const key of slats) b.add(key, [0, 250, 0]);
  });
  step(b, "Lay the mattress on", "The struts are set for a mattress of 40 to 60 kg. Without one the lid springs up, so keep it shut until the mattress is on.", "general", { warnings: ["hand"] }, () => {});
  step(b, "Open and close it by the strap", "Lift by the strap at the foot end and let the struts take it up. Never lean into the box or let children play in it.", "general", { warnings: ["hand"] }, () => {});
  return true;
}

/* ---------- the storage beds: drawers under the frame ---------- */

const RAIL_BRACKET: HwDef = { kind: "bracket", len: 160, dia: 60, name: "Cross rail bracket" };
const ST_SCREW: HwDef = { kind: "screw", len: 16, dia: 5 };
const LOCK_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const BRACE: HwDef = { kind: "bracket", len: 300, dia: 30, name: "Corner brace" };
const DR_BOLT: HwDef = { kind: "camScrew", len: 24, dia: 6, name: "Long cam bolt" };
const DR_CONN: HwDef = { kind: "clip", len: 20, dia: 16, name: "Plastic connector" };

interface BedDrawer {
  g: number; // -1 left, 1 right: the side it pulls out
  zc: number;
  front: string;
  bottom: string;
  sides: string[];
  back: string;
  xin: number; // inner end of the box
  xout: number; // outer end of the box, against the front
  wz: number;
  bh: number;
}
interface BedStore {
  cross: string;
  ry: number;
  rx: number; // middle of a runner, from the centre line
  runners: (FitOpts & { def: HwDef })[][]; // left half, right half
  drawers: BedDrawer[];
}

/**
 * Four drawers hang on runners under the frame, two pulling out at each side: a cross rail across the middle of the
 * bed, and the runners on the head end, both faces of the cross rail and the foot end. `xi` the inner faces of the
 * side rails, `xo` their outer faces, `zH`/`zF` the faces the end runners screw to, `yb` the underside of the frame.
 */
function bedStorage(k: Kit, o: { xi: number; xo: number; zH: number; zF: number; zX: number; yb: number; ch: number; head: (g: number) => string; foot: (g: number) => string }): BedStore {
  const cross = k.part("Cross rail", [2 * o.xi, o.ch, 20], [0, o.yb + o.ch / 2, o.zX]);
  const ry = o.yb + 15;
  const x0 = 100, x1 = o.xo - 20;
  const dd = x1 - x0;
  const rx = x0 + dd / 2;
  const cells: [number, number][] = [[o.zH, o.zX - 10], [o.zX + 10, o.zF]];
  const wz = Math.min(...cells.map(([a, c]) => c - a)) - 60;
  const RUN: HwDef = { kind: "runner", len: Math.round((dd - 40) / 50) * 50, dia: 40 };
  const run = (g: number, z: number, on: string, n: number): FitOpts & { def: HwDef } => ({ def: RUN, on, at: [g * rx, ry, z], dir: [0, 0, n], hole: false, twist: Math.PI / 2 });
  const runners = [-1, 1].map((g) => [run(g, o.zH, o.head(g), -1), run(g, o.zX - 10, cross, 1), run(g, o.zX + 10, cross, -1), run(g, o.zF, o.foot(g), 1)]);
  const bh = o.yb - 36 - 40;
  const drawers = [-1, 1].flatMap((g) =>
    cells.map(([a, c]): BedDrawer => {
      const zc = (a + c) / 2;
      const front = k.part("Drawer front", [18, o.yb - 30, wz + 20], [g * (o.xo - 11), 15 + (o.yb - 30) / 2, zc]);
      const bottom = k.part("Drawer bottom", [dd, 16, wz], [g * (x0 + dd / 2), 28, zc]);
      const sides = [-1, 1].map((e) => k.part("Drawer side", [dd, bh, 16], [g * (x0 + dd / 2), 36 + bh / 2, zc + e * (wz / 2 - 8)]));
      const back = k.part("Drawer back", [16, bh, wz - 32], [g * (x0 + 8), 36 + bh / 2, zc]);
      return { g, zc, front, bottom, sides, back, xin: x0, xout: x1, wz, bh };
    }),
  );
  return { cross, ry, rx, runners, drawers };
}

/** The cross rail on its brackets and the eight runners, as both storage manuals show them. */
function storageFrameSteps(b: PlanBuilder, st: BedStore, rails: string[], xi: number, zX: number) {
  const y = b.partItem(st.cross).final.pos[1];
  const g2 = (i: number) => (i ? 1 : -1);
  step(b, "Screw the cross rail brackets to the side rails", "One halfway along the inside of each side rail, two screws each.", "screws", { tools: ["screwdriver"] }, () => {
    b.fits(RAIL_BRACKET, [0, 1].map((i): FitOpts => ({ on: rails[i], at: [g2(i) * xi, y, zX], dir: [g2(i), 0, 0], hole: false })), 0.2);
    b.then(0.1);
    b.fits(ST_SCREW, [0, 1].flatMap((i) => [-20, 20].map((dy): FitOpts => ({ on: rails[i], at: [g2(i) * (xi - 2), y + dy, zX + 25], dir: [g2(i), 0, 0] }))), 0.1);
  });
  step(b, "Lay the cross rail in and screw it on", "Down into the two brackets, then two screws through each bracket into the rail.", "screws", { tools: ["screwdriver"] }, () => {
    b.add(st.cross, [0, 300, 0]);
    b.then(0.15);
    b.fits(ST_SCREW, [0, 1].flatMap((i) => [-20, 20].map((dy): FitOpts => ({ on: st.cross, at: [g2(i) * (xi - 30), y + dy, zX - 13], dir: [0, 0, 1] }))), 0.1);
  });
  for (const i of [0, 1])
    step(b, i ? "Screw on the runners for the right drawers" : "Screw on the runners for the left drawers", "Four runners, catch towards the side of the bed: on the head end, both faces of the cross rail and the foot end. Two screws each.", "runners", { tools: ["screwdriver"] }, () => {
      const list = st.runners[i];
      b.stagger(0.15);
      for (const r of list) b.fit(r.def, r);
      b.then(0.1);
      b.fits(RUNNER_SCREW, list.flatMap((r) => [-1, 1].map((e): FitOpts => ({ on: r.on, at: [r.at[0] + e * (st.rx - 140), r.at[1], r.at[2] - r.dir[2] * 2], dir: r.dir }))), 0.06);
    });
}

function lockRunnersStep(b: PlanBuilder, st: BedStore) {
  step(b, "Lock the runners", "Sixteen small screws, one through the slot at each end of every runner. Check that each runner is level first.", "screws", { tools: ["screwdriver"] }, () => {
    b.fits(LOCK_SCREW, st.runners.flat().flatMap((r) => [-1, 1].map((e): FitOpts => ({ on: r.on, at: [r.at[0] + e * (st.rx - 160), r.at[1] - 8, r.at[2] - r.dir[2] * 2], dir: r.dir }))), 0.03);
  });
}

/** Four diagonal braces across the corners, which also square the frame. */
function braceStep(b: PlanBuilder, rails: string[], ends: (g: number, head: boolean) => string, xi: number, y: number, zH: number, zF: number) {
  step(b, "Screw in the corner braces", "One across each corner, a screw into the side rail and one into the end. Measure both diagonals: they must be the same.", "screws", { tools: ["screwdriver"], check: "square" }, () => {
    const corners = [-1, 1].flatMap((g, i) => [true, false].map((h) => ({ g, rail: rails[i], end: ends(g, h), z: h ? zH : zF, e: h ? 1 : -1 })));
    b.fits(BRACE, corners.map((c): FitOpts => ({ on: c.rail, at: [c.g * (xi - 100), y, c.z + c.e * 100], dir: [0, 1, 0], hole: false })), 0.15);
    b.then(0.1);
    b.fits(ST_SCREW, corners.flatMap((c): FitOpts[] => [
      { on: c.rail, at: [c.g * (xi - 2), y, c.z + c.e * 200], dir: [c.g, 0, 0] },
      { on: c.end, at: [c.g * (xi - 200), y, c.z + c.e * 2], dir: [0, 0, -c.e] },
    ]), 0.06);
  });
}

/** The drawers, built on the floor as the manuals draw them: one shown, the other three built the same way. */
function bedDrawerSteps(b: PlanBuilder, st: BedStore) {
  const ds = st.drawers, d0 = ds[0];
  const rel = (key: string, d: BedDrawer = d0, j = 0): Vec3 => {
    const p = b.partItem(key).final.pos;
    const c = b.partItem(d.bottom).final.pos;
    return [p[0] - c[0] + j * (d0.xout - d0.xin + 260), p[1], p[2] - c[2]];
  };
  const put = (key: string, from?: Vec3, d?: Vec3) => {
    const r = rel(key);
    b.stage(key, d ? [r[0] + d[0], r[1] + d[1], r[2] + d[2]] : r, b.partItem(key).final.rot, from);
  };
  const g = d0.g;
  const fits = (d: BedDrawer) => {
    const xc = b.partItem(d.bottom).final.pos[0];
    const ze = (e: number) => d.zc + e * (d.wz / 2 - 8);
    return {
      bolts: [-1, 1].flatMap((e, i) => [-1, 1].map((f): FitOpts & { def: HwDef } => ({ def: HW.camScrew, on: d.bottom, at: [xc + f * 200, 36, ze(e)], dir: [0, 1, 0], mate: d.sides[i], mateHole: 4 }))),
      conns: [-1, 1].map((e): FitOpts & { def: HwDef } => ({ def: DR_CONN, on: d.bottom, at: [d.g * d.xout, 28, d.zc + e * (d.wz / 2 - 120)], dir: [d.g, 0, 0], hole: false })),
      dowels: [-1, 1].map((e, i): FitOpts & { def: HwDef } => ({ def: HW.dowel, on: d.sides[i], at: [xc + d.g * 100, 36, ze(e)], dir: [0, -1, 0], mate: d.bottom })),
      cams: [-1, 1].flatMap((e, i) => [-1, 1].map((f): FitOpts & { def: HwDef } => ({ def: HW.cam, on: d.sides[i], at: [xc + f * 200, 66, ze(e) - e * 8], dir: [0, 0, e] }))),
      backBolts: [-1, 1].flatMap((e) => [-1, 1].map((f): FitOpts & { def: HwDef } => ({ def: DR_BOLT, on: d.back, at: [d.g * (d.xin + 8), 36, d.zc + e * (d.wz / 2 - 60) + f * 30], dir: [0, -1, 0], mate: d.bottom }))),
      backCams: [-1, 1].flatMap((e) => [-1, 1].map((f): FitOpts & { def: HwDef } => ({ def: HW.cam, on: d.back, at: [d.g * (d.xin + 16), 66, d.zc + e * (d.wz / 2 - 60) + f * 30], dir: [-d.g, 0, 0] }))),
    };
  };
  const f0 = fits(d0);
  const fitAll = (list: (FitOpts & { def: HwDef })[], gap = 0.08) => list.forEach((x, i) => { if (i) b.wait(gap); b.fit(x.def, x); });
  const sc = { scene: "drawer", repeat: ds.length };
  step(b, "Screw the cam bolts into the drawer bottom", "Lay the bottom on a rug, four bolts near the short edges.", "cams", { ...sc, tools: ["allen"], warnings: ["floor"] }, () => {
    put(d0.bottom, [0, 120, 0]);
    b.then(0.15);
    fitAll(f0.bolts);
  });
  step(b, "Press the connectors into the front edge", "Two into the holes along the edge where the front goes.", "general", sc, () => fitAll(f0.conns, 0.15));
  step(b, "Tap a dowel into each side", "Into the hole in the bottom edge, near the front end.", "dowels", { ...sc, tools: ["hammer"] }, () => {
    b.stagger(0.2);
    d0.sides.forEach((key, i) => put(key, [0, 120, 0], [0, 0, (i ? 1 : -1) * 260]));
    b.then(0.15);
    fitAll(f0.dowels, 0.15);
  });
  step(b, "Push the front onto the connectors", "Stand it on the rug against the edge of the bottom and press until it clicks.", "join", sc, () => put(d0.front, [g * 260, 0, 0]));
  step(b, "Stand the sides on the bottom", "Onto the cam bolts and dowels, ends against the front.", "join", sc, () => {
    b.stagger(0.2);
    d0.sides.forEach((key, i) => put(key, undefined, [0, 200, (i ? 1 : -1) * 120]));
    b.then(0.05);
    for (const key of d0.sides) put(key);
  });
  step(b, "Lock the sides", "Four cam locks, arrow towards the bolt, then a clockwise turn.", "cams", { ...sc, tools: ["screwdriver"] }, () => fitAll(f0.cams, 0.1));
  step(b, "Screw the cam bolts into the back", "Four along its bottom edge.", "cams", { ...sc, tools: ["allen"] }, () => {
    put(d0.back, [0, 120, 0], [-g * 260, 0, 0]);
    b.then(0.15);
    fitAll(f0.backBolts, 0.1);
  });
  step(b, "Stand the back on the bottom", "Between the sides at the open end, onto its bolts.", "join", sc, () => {
    put(d0.back, undefined, [0, 200, 0]);
    b.then(0.05);
    put(d0.back);
  });
  step(b, "Lock the back", `Four cam locks. Build the other ${ds.length - 1} drawers the same way.`, "cams", { ...sc, tools: ["screwdriver"] }, () => {
    fitAll(f0.backCams, 0.1);
    b.then(0.3);
    ds.slice(1).forEach((d, j) => {
      for (const key of [d.bottom, d.front, ...d.sides, d.back]) {
        b.stage(key, rel(key, d, j + 1), b.partItem(key).final.rot);
      }
      const f = fits(d);
      for (const x of [...f.bolts, ...f.conns, ...f.dowels, ...f.cams, ...f.backBolts, ...f.backCams]) b.preset(x.def, x);
    });
  });
  step(b, "Pull the runners out", "All eight, as far as they go.", "drawer", {}, () => {});
  step(b, "Hang the drawers on the runners", "Lay each drawer on its pair of runners and press down at the front until both catches click. Then push it in.", "drawer", {}, () => {
    for (const d of ds) {
      b.stagger(0);
      for (const key of [d.bottom, d.front, ...d.sides, d.back]) b.add(key, [d.g * 500, 0, 0]);
      b.wait(0.25);
    }
  });
}

const KEY_BOLT: HwDef = { kind: "bolt", len: 16, dia: 8, name: "Keyhole bolt" };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 16, dia: 6 };
const CORNER_SCREW: HwDef = { kind: "screw", len: 30, dia: 5 };
const CORNER_A: HwDef = { kind: "angle", len: 280, dia: 60, name: "Corner bracket" };
const GRIP: HwDef = { kind: "clip", len: 20, dia: 25, name: "Slat stop" };
const HANG_BOLT: HwDef = { kind: "bolt", len: 20, dia: 6 };

/**
 * The upholstered storage bed, from its manual: corner brackets and a leg go on each side rail, keyhole bolts and
 * two legs on the head box, two people hang the side rails and the foot board on the bolts, braces square the
 * corners. The headboard is lowered over the head box and bolted on, its cover pulled down over it. Under the frame a
 * cross rail and eight runners carry four drawers; the centre beam drops into its hangers and the slats lie on top.
 */
function buildUphStorageBed(b: PlanBuilder, s: ProductSpec) {
  const k = new Kit(b);
  const [MW, ML] = mattressOf(s);
  const W = s.size.w * 10, L = s.size.d * 10, HB = s.size.h * 10;
  const FH = 490, LH = 190, RT = 50, ET = 35;
  const yb = LH, RH = FH - LH, ry = yb + RH / 2;
  const xs = MW / 2 + RT / 2, xi = MW / 2, xo = MW / 2 + RT;
  const HD = Math.max(150, L - ML - ET);
  const z0 = -L / 2, zH = z0 + HD, zF = L / 2 - ET;
  const head = b.compound("Headboard", [
    { shape: "box", size: [W, HB - FH, HD], pos: [0, FH + (HB - FH) / 2, z0 + HD / 2] },
    { shape: "box", size: [W, FH - 30, 40], pos: [0, 30 + (FH - 30) / 2, z0 + 20] },
    ...[-1, 1].map((g) => ({ shape: "box" as const, size: [(W - MW) / 2, FH - 30, HD - 40] as Vec3, pos: [g * (W / 2 - (W - MW) / 4), 30 + (FH - 30) / 2, z0 + 40 + (HD - 40) / 2] as Vec3 })),
  ], { material: "soft" });
  const headboard = b.place(head.type, head.mid);
  const box = k.part("Head box", [MW, RH, HD - 40], [0, ry, z0 + 40 + (HD - 40) / 2]);
  const ledgeY = FH - 90;
  const zr = (zH + L / 2) / 2;
  // each side rail comes with its slat ledge fixed along the inside
  const rails = [-1, 1].map((g) => {
    const c = b.compound(g < 0 ? "Left side rail" : "Right side rail", [
      { shape: "box", size: [RT, RH, L / 2 - zH], pos: [g * xs, ry, zr], material: "soft" },
      { shape: "box", size: [30, 22, ML - 20], pos: [g * (xi - 15), ledgeY, (zH + zF) / 2], material: "wood" },
    ], { material: "soft" });
    return b.place(c.type, c.mid);
  });
  const foot = k.part("Foot board", [MW, RH, ET], [0, ry, zF + ET / 2], { material: "soft" });
  const legAt: Vec3[] = [...[-1, 1].map((g): Vec3 => [g * (xi - 40), LH / 2, z0 + 40 + (HD - 40) / 2]), ...[-1, 1].map((g): Vec3 => [g * xs, LH / 2, L / 2 - 40])];
  const legs = legAt.map((p) => k.part("Leg", [50, LH, 50], p, { shape: "cyl", material: "wood" }));
  const zX = (zH + zF) / 2;
  const st = bedStorage(k, { xi, xo, zH, zF, zX, yb, ch: 80, head: () => box, foot: () => foot });
  const halfL = ML / 2;
  const by = ledgeY - 19;
  const beams = [-1, 1].map((e) => k.part("Centre beam half", [50, 60, halfL - 10], [0, by, zX + (e * halfL) / 2], { material: "metal" }));
  const strips = [
    ...[-1, 1].flatMap((g) => [-1, 0, 1].map((e) => k.part("Grip strip", [30, 2, ML / 3 - 20], [g * (xi - 15), ledgeY + 12, zX + (e * ML) / 3], { material: "fiber" }))),
    ...[-1, 0, 1].map((e) => k.part("Beam grip strip", [40, 2, ML / 3 - 20], [0, by + 31, zX + (e * ML) / 3], { material: "fiber" })),
  ];
  const slats = [-1, 1].map((g) => slatBase(b, MW / 2 - 20, ML - 20, ledgeY + 17, zX, true, g * (MW / 4 + 2)));
  const g2 = (i: number) => (i ? 1 : -1);
  const lay = (key: string, i: number) => b.stage(key, [g2(i) * 200, (RT + 30) / 2, 0], [0, 0, (-g2(i) * Math.PI) / 2], [0, 160, 0]);
  // corner brackets: A at the head end of each rail, B at the foot end
  const corners = [0, 1].flatMap((i) => [zH, zF].map((z) => ({ i, z, e: z === zH ? 1 : -1 })));
  step(b, "Screw the corner brackets to the side rails", "Lay both rails on a rug, inside up. The brackets marked A go at the head end, B at the foot end: two screws each.", "screws", { scene: "prep", tools: ["allen"], warnings: ["floor"] }, () => {
    b.stagger(0.2);
    rails.forEach((key, i) => lay(key, i));
    b.then(0.15);
    b.fits(CORNER_A, corners.map((c): FitOpts => ({ on: rails[c.i], at: [g2(c.i) * xi, ry, c.z + c.e * 20], dir: [g2(c.i), 0, 0], hole: false })), 0.12);
    b.then(0.1);
    b.fits(BRACKET_SCREW, corners.flatMap((c) => [-60, 60].map((dy): FitOpts => ({ on: rails[c.i], at: [g2(c.i) * (xi - 2), ry + dy, c.z + c.e * 20], dir: [g2(c.i), 0, 0] }))), 0.06);
  });
  step(b, "Stick the felt pads under the legs", "Peel four off the sheet, one under each leg.", "general", { scene: "legs" }, () => {
    b.stagger(0.1);
    legs.forEach((key, i) => b.stage(key, [(i - 1.5) * 120, LH / 2, 0], [0, 0, 0], [0, 120, 0]));
    b.then(0.15);
    b.fits(BED_PAD, legAt.map((p, i): FitOpts => ({ on: legs[i], at: [p[0], 0, p[2]], dir: [0, 1, 0], hole: false })), 0.1);
  });
  step(b, "Screw a leg into each side rail", "Into the foot bracket, by hand until it stops.", "legs", { scene: "prep" }, () => {
    b.stagger(0.2);
    [2, 3].forEach((j, i) => b.stage(legs[j], [g2(i) * 200 - g2(i) * (RH / 2 + LH / 2), RT / 2, L / 2 - 40 - zr], [0, 0, (-g2(i) * Math.PI) / 2], [-g2(i) * 200, 0, 0]));
  });
  const keyAt = (on: string, z: number, n: number) => [-1, 1].flatMap((g) => [ry - 70, ry + 70].map((y): FitOpts => ({ on, at: [g * (xi - 25), y, z], dir: [0, 0, n] })));
  step(b, "Screw the keyhole bolts into the head box and the foot board", "Four in each, near the ends. Screw them in until they stop: the heads must stand out a little.", "screws", { scene: "ends", tools: ["allen"] }, () => {
    b.stagger(0.2);
    b.stage(box, [0, ry, -500], [0, 0, 0], [0, 160, 0]);
    b.stage(foot, [0, ry, 500], [0, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(KEY_BOLT, [...keyAt(box, zH + 4, -1), ...keyAt(foot, zF - 4, 1)], 0.06);
  });
  step(b, "Screw two legs under the head box", "One under each end, by hand.", "legs", { scene: "ends" }, () => {
    b.stagger(0.2);
    [0, 1].forEach((j) => b.stage(legs[j], [legAt[j][0], legAt[j][1], legAt[j][2] - k.pos(box)[2] - 500], [0, 0, 0], [0, -200, 0]));
  });
  for (const i of [0, 1])
    step(b, i ? "Hang the other side rail on" : "Hang a side rail on the head box", "One holds the box while the other hooks the bracket over the keyhole bolts and pushes it down. Then two bolts through the bracket.", "join", { people: 2, tools: ["allen"] }, () => {
      if (!i) {
        b.stagger(0);
        b.add(box, [0, 0, 0]);
        b.add(legs[0], [0, 0, 0]);
        b.add(legs[1], [0, 0, 0]);
        b.then(0.15);
      }
      b.stagger(0);
      b.add(rails[i], [0, 60, 0]);
      b.add(legs[2 + i], [0, 60, 0]);
      b.then(0.15);
      b.fits(KEY_BOLT, [ry - 30, ry + 30].map((y): FitOpts => ({ on: rails[i], at: [g2(i) * (xi - 30), y, zH + 4], dir: [0, 0, -1], mate: box })), 0.1);
    });
  step(b, "Hang the foot board on", "Between the rails, so its keyhole bolts drop into the B brackets. Push it down.", "join", { people: 2 }, () => b.add(foot, [0, 60, 0]));
  step(b, "Bolt the foot corners", "Two bolts through each B bracket into the foot board.", "screws", { tools: ["allen"] }, () =>
    b.fits(KEY_BOLT, [0, 1].flatMap((i) => [ry - 30, ry + 30].map((y): FitOpts => ({ on: rails[i], at: [g2(i) * (xi - 20), y, zF - 4], dir: [0, 0, 1], mate: foot }))), 0.1),
  );
  braceStep(b, rails, (_, h) => (h ? box : foot), xi, yb + 30, zH, zF);
  step(b, "Tighten the corner brackets", "Sixteen screws, four in each bracket.", "screws", { tools: ["screwdriver"] }, () =>
    b.fits(CORNER_SCREW, corners.flatMap((c) => [-110, -40, 40, 110].map((dy): FitOpts => ({ on: rails[c.i], at: [g2(c.i) * (xi - 2), ry + dy * 0.9, c.z + c.e * 45], dir: [g2(c.i), 0, 0] }))), 0.04),
  );
  step(b, "Tap the dowels into the headboard", "Lay it face down on a rug: four into the underside of the cushion.", "dowels", { scene: "head", tools: ["hammer"], warnings: ["face", "floor"] }, () => {
    b.stage(headboard, [0, HD / 2, HB / 2 - 200], [-Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(BED_DOWEL, spread(-MW / 2 + 150, MW / 2 - 150, 4).map((x): FitOpts => ({ on: headboard, at: [x, FH, zH - 60], dir: [0, -1, 0], mate: box })), 0.1);
  });
  step(b, "Lower the headboard onto the head box", "Together: hold it upright over the box and let it down so the dowels find their holes.", "join", { people: 2 }, () => b.add(headboard, [0, 500, 0]));
  const studs = [-1, 0, 1].flatMap((e) => [ry - 60, ry + 60].map((y): FitOpts => ({ on: box, at: [e * (MW / 2 - 200), y, zH], dir: [0, 0, -1] })));
  step(b, "Bolt the headboard to the box", "Six studs through the box into the headboard, then a washer and a nut on each. Tighten with the spanner.", "screws", { tools: ["wrench"] }, () => {
    b.fits(OT_STUD, studs, 0.08);
    b.then(0.1);
    b.fits(OT_WASHER, studs.map((x) => ({ ...x, at: [x.at[0], x.at[1], zH + 2] as Vec3, hole: false as const })), 0.06);
    b.fits(OT_NUT, studs.map((x) => ({ ...x, at: [x.at[0], x.at[1], zH + 4] as Vec3, hole: false as const })), 0.06);
  });
  step(b, "Pull the headboard cover down", "Over the box at both sides and close the touch fastening underneath.", "general", {}, () => {});
  step(b, "Tuck the cover round the legs", "Fold the corners neatly round each head leg.", "general", {}, () => {});
  storageFrameSteps(b, st, rails, xi, zX);
  step(b, "Join the centre beam halves", "Push the two halves into the sleeve so their ends meet in the middle.", "general", { scene: "beam" }, () => {
    b.stagger(0.3);
    beams.forEach((key, i) => b.stage(key, [0, 30, (g2(i) * halfL) / 2], [0, 0, 0], [0, 0, g2(i) * 300]));
    b.then(0.1);
    b.fit(BEAM_SLEEVE, { on: beams[0], at: [0, by, zX - 5], dir: [0, 0, 1], hole: false });
  });
  lockRunnersStep(b, st);
  const hang = [{ on: box, z: zH, n: -1 }, { on: foot, z: zF, n: 1 }];
  step(b, "Bolt the beam hangers on", "One in the middle of the head box and one in the middle of the foot board, two bolts each.", "screws", { tools: ["allen"] }, () => {
    b.fits(BEAM_BRACKET, hang.map((h): FitOpts => ({ on: h.on, at: [0, by, h.z], dir: [0, 0, h.n], hole: false })), 0.2);
    b.then(0.1);
    b.fits(HANG_BOLT, hang.flatMap((h) => [-25, 25].map((dx): FitOpts => ({ on: h.on, at: [dx, by - 40, h.z + -h.n * 2], dir: [0, 0, h.n] }))), 0.1);
  });
  step(b, "Lay the centre beam in", "Head end first, into its hanger.", "join", {}, () => {
    b.stagger(0.1);
    for (const key of beams) b.add(key, [0, 300, 0]);
  });
  step(b, "Press the foot end down", "Into the hanger at the foot board until it sits flat.", "general", {}, () => {});
  step(b, "Lay the grip strips on the ledges", "Three along each slat ledge, end to end, with a stop over each.", "general", {}, () => {
    b.stagger(0.1);
    for (const key of strips.slice(0, 6)) b.add(key, [0, 150, 0]);
    b.then(0.1);
    b.fits(GRIP, strips.slice(0, 6).map((key): FitOpts => ({ on: key, at: [k.pos(key)[0], ledgeY + 13, k.pos(key)[2]], dir: [0, -1, 0], hole: false })), 0.06);
  });
  step(b, "Lay the grip strips on the beam", "Three along the centre beam, end to end, a stop at each end.", "general", {}, () => {
    b.stagger(0.1);
    for (const key of strips.slice(6)) b.add(key, [0, 150, 0]);
    b.then(0.1);
    b.fits(GRIP, [zH + 30, zF - 30].map((z): FitOpts => ({ on: beams[z < zX ? 0 : 1], at: [0, by + 32, z], dir: [0, -1, 0], hole: false })), 0.1);
  });
  step(b, "Roll out the slats", "The slatted bases are sold separately. One each side of the beam, starting at the head end.", "slats", {}, () => {
    b.stagger(0.3);
    for (const key of slats) b.add(key, [0, 200, -400]);
  });
  bedDrawerSteps(b, st);
  return true;
}

/* ---------- the family ---------- */

const family: Family = {
  names: ["IDANÄS"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (/idanas-chest-4-drawers/.test(slug)) return buildChest(b, s, [{ h: 0.62, cols: 1 }, { h: 1, cols: 1 }, { h: 1, cols: 1 }, { h: 1, cols: 1 }], { knobs: 2, clips: 4 });
    if (/idanas-chest-6-drawers-84/.test(slug)) return buildChest(b, s, [{ h: 0.62, cols: 2 }, { h: 0.62, cols: 1 }, { h: 1, cols: 1 }, { h: 1, cols: 1 }, { h: 1, cols: 1 }], { knobs: 2, clips: 6 });
    if (/idanas-chest-6-drawers$/.test(slug)) return buildChest(b, s, [{ h: 1, cols: 2 }, { h: 1, cols: 2 }, { h: 1, cols: 2 }], { knobs: 2, clips: 6, mid: true });
    if (/idanas-bedside-table/.test(slug)) return buildBedside(b, s);
    if (/idanas-side-table/.test(slug)) return buildSideTable(b, s);
    if (/idanas-coffee-table/.test(slug)) return buildCoffee(b, s);
    if (/idanas-bookcase-81-x-39/.test(slug)) return buildBookcase(b, s);
    if (/idanas-high-cabinet/.test(slug)) return buildBookcase(b, s, true);
    if (/idanas-tv-bench/.test(slug)) return buildTvBench(b, s);
    if (/idanas-open-wardrobe/.test(slug)) return buildOpenWardrobe(b, s);
    if (/idanas-wardrobe-121/.test(slug)) return buildWardrobe(b, s);
    if (/idanas-sideboard-124/.test(slug)) return buildSideboard(b, s);
    if (/idanas-console-table/.test(slug)) return buildConsole(b, s);
    if (/idanas-desk/.test(slug)) return buildDesk(b, s);
    if (/idanas-upholstered-bed-frame/.test(slug)) return buildUpholsteredBed(b, s);
    if (/idanas-bed-frame-standard-double|idanas-bed-frame-160-x-200/.test(slug)) return buildWoodBed(b, s);
    if (/idanas-bed-frame-storage/.test(slug)) return buildWoodBed(b, s, { storage: true });
    if (/idanas-upholstered-ottoman/.test(slug)) return buildOttomanBed(b, s);
    if (/idanas-upholstered-storage-bed/.test(slug)) return buildUphStorageBed(b, s);
    return false;
  },
};
export default family;
