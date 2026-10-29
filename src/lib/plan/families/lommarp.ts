import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { rotate } from "../math";

/**
 * LOMMARP, read from its manuals, every product drawn step by step with PlanBuilder. The bookcase is built lying on
 * its back, its crown and base each made as a U on the rug and pushed onto the ends (see `bookcase`); the cabinets
 * and the TV bench share a shaped base and are described further down.
 */

const T = 18;
const BH = 110; // the base
const CH = 45; // the crown
const O = 15; // how far the crown and base stand out past the carcass
const r = (n: number) => Math.round(n * 10) / 10;

/* ---------- the cabinets and the TV bench, drawn step by step ---------- */

/*
 * The glass-door cabinet, the 102 cabinet and the TV bench share a shaped base, built upside down on a rug: cam
 * pins in the base sides, the front on dowels and cam locks, dowels in the top edges, angle brackets and dowels in
 * the back rail, then the moulded bottom panel face down with cam pins, the frame lowered onto it, the back rail
 * and corner blocks fitted, the brackets screwed up and everything cam-locked before the base is turned over.
 * The carcass stands on it: cam bolts in the bottom panel, the sides joined (to two back rails, or to the fixed
 * shelf over the drawer), lowered on and locked, the back slid down the grooves, the top panel on cam bolts, the
 * back riveted and clipped. Doors take a soft-close hinge and a plain one each, face down on a rug, and are
 * clipped onto the plates already in the sides. The drawer is built on its front with cam locks.
 * The glass-door cabinet's top unit has framed glass sides and a crown screwed under its top; it is built on its
 * own, laid on its front for the back, and lifted onto the cabinet by two people. It hangs on two wall brackets;
 * the cabinet and the TV bench have wall spacers at the back and screw to the wall through a cup washer.
 */

type StepOpts = { title: string; detail?: string; tools?: ToolId[]; pose?: Pose; scene?: string; kind?: StepKind; warnings?: WarnId[]; people?: 1 | 2; wall?: boolean };
type Fit = FitOpts;

const PI = Math.PI;
const PT = 22; // bottom and top panels, with a moulded edge
const BAS = 235; // the shaped base frame
const BI = 8; // the base frame sits in from the bottom panel's edge
const CI = 20; // the carcass sides sit in from the panels' ends
const DT = 20; // doors and drawer fronts
const BAND = 70; // the base frame's top band, above the curve
const RAIL = 60; // back rails

const H_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const H_PIN: HwDef = { kind: "camScrew", len: 30, dia: 7, name: "Cam pin" };
const H_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7, name: "Cam bolt" };
const H_CAM: HwDef = { kind: "cam", len: 13, dia: 15 };
const H_SCAM: HwDef = { kind: "cam", len: 10, dia: 12, name: "Small cam lock" };
const H_ANGLE: HwDef = { kind: "angle", len: 30, dia: 24 };
const H_SMALL: HwDef = { kind: "screw", len: 13, dia: 4 };
const H_BLOCK: HwDef = { kind: "connector", len: 50, dia: 30, name: "Corner block" };
const H_RIVET: HwDef = { kind: "clip", len: 12, dia: 8, name: "Plastic rivet" };
const H_CLIP: HwDef = { kind: "clip", len: 16, dia: 12, name: "Back clip" };
const H_SUPPORT: HwDef = { kind: "pin", len: 12, dia: 5, name: "Shelf support" };
const H_SOFT: HwDef = { kind: "hinge", len: 50, dia: 35, name: "Soft-close hinge" };
const H_HINGE: HwDef = { kind: "hinge", len: 50, dia: 35 };
const H_DROP: HwDef = { kind: "handle", len: 60, dia: 16, name: "Drop handle" };
const H_DROP_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const H_KNOB: HwDef = { kind: "knob", len: 25, dia: 30 };
const H_KNOB_SCREW: HwDef = { kind: "screw", len: 35, dia: 4, name: "Knob screw" };
const H_BUMP: HwDef = { kind: "glide", len: 5, dia: 10, name: "Bumper" };
const H_FELT: HwDef = { kind: "glide", len: 2, dia: 10, name: "Felt bumper" };
const H_BAR_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const H_RELEASE: HwDef = { kind: "clip", len: 30, dia: 12, name: "Drawer release clip" };
const H_SPACER: HwDef = { kind: "spacer", len: 30, dia: 40 };
const H_SPACER_KNOB: HwDef = { kind: "cap", len: 20, dia: 30, name: "Spacer knob" };
const H_CUP: HwDef = { kind: "washer", len: 3, dia: 24, name: "Cup washer" };
const H_COVER: HwDef = { kind: "cap", len: 10, dia: 24, name: "Wall fitting cover" };
const H_WBRACKET: HwDef = { kind: "bracket", len: 120, dia: 30 };
const H_WASHER: HwDef = { kind: "washer", len: 1.5, dia: 16 };
const H_SWASHER: HwDef = { kind: "washer", len: 1.5, dia: 10, name: "Small washer" };
const H_LONG: HwDef = { kind: "screw", len: 50, dia: 4, name: "Long screw" };
const H_PLUG: HwDef = { kind: "plug", len: 35, dia: 8, notIncluded: true };
const H_WALL_SCREW: HwDef = { kind: "screw", len: 50, dia: 5, notIncluded: true };

const sp = (n: number, a: number, b: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));
const box = (size: Vec3, pos: Vec3, material?: PartMaterial): PartPiece => ({ shape: "box", size, pos, material });

/** A PlanBuilder with the house helpers: shared part types, steps with sensible defaults, parts shown in a step's own scene. */
class Shop {
  private types = new Map<string, string>();
  constructor(public b: PlanBuilder) {}
  part(name: string, size: Vec3, pos: Vec3, o: { material?: PartMaterial; pieces?: PartPiece[] } = {}) {
    const sz = size.map(r) as Vec3;
    const k = JSON.stringify([name, sz, o.material, o.pieces]);
    let t = this.types.get(k);
    if (!t) {
      t = this.b.part(name, sz, { material: o.material ?? "board" });
      if (o.pieces) this.b.parts[this.b.parts.length - 1].pieces = o.pieces;
      this.types.set(k, t);
    }
    return this.b.place(t, pos.map(r) as Vec3);
  }
  step(o: StepOpts, body: () => void = () => {}) {
    this.b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  }
  /** Show parts in the current scene as they sit in the product, turned by `rot` about `pivot` and moved to `at`. */
  lay(keys: string[], pivot: Vec3, at: Vec3, rot: Vec3 = [0, 0, 0], from: Vec3 = [0, 160, 0]) {
    for (const k of keys) {
      const it = this.b.partItem(k);
      const p = rotate([it.final.pos[0] - pivot[0], it.final.pos[1] - pivot[1], it.final.pos[2] - pivot[2]], rot);
      this.b.stage(k, [r(p[0] + at[0]), r(p[1] + at[1]), r(p[2] + at[2])], rot, from);
    }
    this.b.then(0.15);
  }
  fits(def: HwDef, list: Fit[], gap = 0.05) {
    if (!list.length) return;
    this.b.fits(def, list.map((f) => ({ ...f, at: f.at.map(r) as Vec3 })), gap);
    this.b.then(0.1);
  }
  add(keys: string[], from: Vec3, gap = 0.2) {
    this.b.stagger(gap);
    for (const k of keys) this.b.add(k, from);
    this.b.then(0.12);
  }
  pos(k: string) {
    return this.b.partItem(k).final.pos;
  }
}

const on = (k: string, at: Vec3, dir: Vec3, o: Partial<Fit> = {}): Fit => ({ on: k, at, dir, ...o });

/* ---------- the base ---------- */

interface BaseOpts {
  front: number; // dowels along the top of the base front
  back: number; // dowels in the top of the back rail
  pins: number; // cam pins (and cam locks) along the front and along the back of the bottom panel
  feet?: number; // the TV bench's centre feet, under the middle of the bottom panel
}

function buildBase(sh: Shop, W: number, D: number, o: BaseOpts) {
  const Wb = W - 2 * BI, Db = D - 2 * BI;
  const xs = Wb / 2 - T / 2, xin = Wb / 2 - T; // base sides: middle, inside face
  const zF = Db / 2 - T, zB = -Db / 2 + T; // inside faces of the front and the back rail
  const apron: PartPiece[] = [box([Wb, BAND, T], [0, BAS / 2 - BAND / 2, 0]), ...[-1, 1].map((sx) => box([80, BAS - BAND, T], [sx * (Wb / 2 - 40), -BAND / 2, 0]))];
  const BF = sh.part("Base front", [Wb, BAS, T], [0, BAS / 2, Db / 2 - T / 2], { pieces: apron });
  const sd = Db - T;
  const legs: PartPiece[] = [box([T, BAND, sd], [0, BAS / 2 - BAND / 2, 0]), ...[-1, 1].map((sz) => box([T, BAS - BAND, 60], [0, -BAND / 2, sz * (sd / 2 - 30)]))];
  const [BL, BR] = [-1, 1].map((sx) => sh.part("Base side", [T, BAS, sd], [sx * xs, BAS / 2, -T / 2], { pieces: legs }));
  const BK = sh.part("Base back rail", [Wb - 2 * T, BAND, T], [0, BAS - BAND / 2, -Db / 2 + T / 2]);
  const BP = sh.part("Bottom panel", [W, PT, D], [0, BAS + PT / 2, 0]);
  const fx = o.feet ? sp(o.feet, -Wb / 4, Wb / 4) : [];
  const feet = fx.map((x) => sh.part("Centre foot", [60, BAS, 60], [x, BAS / 2, 0], { pieces: [{ shape: "cyl", size: [60, BAS, 60], pos: [0, 0, 0] }] }));
  const frame = [BF, BL, BR];
  const sides = [BL, BR];
  const up: Vec3 = [PI, 0, 0];
  const fp: Vec3 = [0, BAS / 2, 0];
  const yT = BAS - 22, yL = BAS - 50; // cam pin heights at the corners
  const xsF = sp(o.pins, -Wb / 2 + 120, Wb / 2 - 120);

  sh.step({ title: "Screw cam pins into the base sides", detail: "Lay the base parts upside down on a rug. Two pins in the front end of each side, turned in until the collar meets the wood.", tools: ["screwdriver"], scene: "base", kind: "cams", warnings: ["floor"] }, () => {
    sides.forEach((k, i) => sh.lay([k], fp, [(i ? 1 : -1) * 160, BAS / 2, -160], up));
    sh.fits(H_PIN, sides.flatMap((k, i) => [yT, yL].map((y) => on(k, [(i ? 1 : -1) * xs, y, zF], [0, 0, -1], { mate: BF }))));
  });
  sh.step({ title: "Tap dowels into the base front", detail: "Two at each end of its inside face.", tools: ["hammer"], scene: "base", kind: "dowels" }, () => {
    sh.lay([BF], fp, [0, BAS / 2, 0], up);
    sh.fits(H_DOWEL, [-1, 1].flatMap((sx) => [BAS - 36, 50].map((y) => on(BF, [sx * xs, y, zF], [0, 0, -1], { mate: sx < 0 ? BL : BR }))));
  });
  sh.step({ title: "Join the sides to the base front", detail: "Push each side onto the dowels, pins into the holes. Turn the four cam locks clockwise until they're tight.", tools: ["screwdriver"], scene: "base", kind: "cams" }, () => {
    sh.lay(sides, fp, [0, BAS / 2, 0], up, [0, 0, -200]);
    sh.fits(H_CAM, [-1, 1].flatMap((sx) => [yT, yL].map((y) => on(BF, [sx * (xs - 30), y, zF], [0, 0, 1]))));
  });
  const topDowels: Fit[] = [
    ...sp(o.front, -Wb / 2 + 200, Wb / 2 - 200).map((x) => on(BF, [x, BAS, Db / 2 - T / 2], [0, 1, 0], { mate: BP })),
    ...sides.flatMap((k, i) => [-1, 1].map((sz) => on(k, [(i ? 1 : -1) * xs, BAS, -T / 2 + sz * (sd / 2 - 90)], [0, 1, 0], { mate: BP }))),
  ];
  sh.step({ title: "Turn it over and tap dowels into the top edges", detail: `${topDowels.length} of them, along the top of the front and the sides.`, tools: ["hammer"], scene: "base", kind: "dowels" }, () => {
    sh.lay(frame, [0, 0, 0], [0, 0, 0]);
    sh.fits(H_DOWEL, topDowels);
  });
  const brk = sp(4, -Wb / 2 + 150, Wb / 2 - 150);
  sh.step({ title: "Screw the angle brackets onto the back rail", detail: "Four along its inside face, flush with the top edge, one screw each.", tools: ["screwdriver"], scene: "base", kind: "screws" }, () => {
    sh.lay([BK], [0, 0, 0], [0, 0, -260]);
    sh.fits(H_ANGLE, brk.map((x) => on(BK, [x, BAS - 6, zB], [0, 0, -1], { hole: false })));
    sh.fits(H_SMALL, brk.map((x) => on(BK, [x, BAS - 22, zB], [0, 0, -1])));
  });
  sh.step({ title: "Tap dowels into the top of the back rail", detail: o.back === 1 ? "One in the middle." : `${o.back} along its top edge.`, tools: ["hammer"], scene: "base", kind: "dowels" }, () =>
    sh.fits(H_DOWEL, sp(o.back, -Wb / 2 + 200, Wb / 2 - 200).map((x) => on(BK, [x + 40, BAS, -Db / 2 + T / 2], [0, 1, 0], { mate: BP }))),
  );
  const pins: Fit[] = [
    ...xsF.map((x) => on(BP, [x, BAS, Db / 2 - T / 2], [0, 1, 0], { mate: BF })),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => on(BP, [sx * xs, BAS, -T / 2 + sz * (sd / 2 - 150)], [0, 1, 0], { mate: sx < 0 ? BL : BR }))),
    ...xsF.map((x) => on(BP, [x, BAS, -Db / 2 + T / 2], [0, 1, 0], { mate: BK })),
  ];
  const pp: Vec3 = [0, BAS + PT / 2, 0];
  sh.step({ title: "Screw cam pins into the bottom panel", detail: `Lay it face down on the rug: ${pins.length} pins in the holes underneath, by hand until they stop.`, tools: ["screwdriver"], scene: "base", kind: "cams" }, () => {
    sh.lay([BP], pp, [0, PT / 2, D + 300], up);
    sh.fits(H_PIN, pins);
  });
  const both: Vec3 = [0, (BAS + PT) / 2, 0];
  sh.step({ title: "Lower the frame onto the bottom panel", detail: "Upside down, dowels and pins into their holes, front to the panel's moulded front edge.", scene: "base", kind: "join" }, () => {
    sh.lay([BP], both, both, up, [0, 0, 300]);
    sh.lay(frame, both, both, up, [0, 250, 0]);
  });
  sh.step({ title: "Fit the back rail", detail: "Between the base sides at the back, brackets inward, dowels into the panel.", scene: "base", kind: "join" }, () => sh.lay([BK], both, both, up, [0, 250, 0]));
  sh.step({ title: "Press the corner blocks in", detail: "One in each inside corner, the A blocks on one diagonal and the B blocks on the other, as marked.", scene: "base", kind: "general" }, () =>
    sh.fits(H_BLOCK, [-1, 1].flatMap((sx) => [-1, 1].map((sz) => on(BP, [sx * (xin - 30), BAS, sz * (Db / 2 - T - 30)], [0, 1, 0], { hole: false }))), 0.12),
  );
  sh.step({ title: "Screw the brackets to the bottom panel", detail: "One screw through each angle bracket.", tools: ["screwdriver"], scene: "base", kind: "screws" }, () =>
    sh.fits(H_SMALL, brk.map((x) => on(BK, [x, BAS, zB + 12], [0, 1, 0], { mate: BP }))),
  );
  const cams: Fit[] = [
    ...xsF.map((x) => on(BF, [x, BAS - 25, zF], [0, 0, 1])),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => on(sx < 0 ? BL : BR, [sx * xin, BAS - 25, -T / 2 + sz * (sd / 2 - 150)], [sx, 0, 0]))),
    ...xsF.map((x) => on(BK, [x, BAS - 25, zB], [0, 0, -1])),
  ];
  sh.step({ title: "Lock the base with cam locks", detail: `${cams.length} of them, around the inside of the frame, each turned clockwise until it pulls tight.`, tools: ["screwdriver"], scene: "base", kind: "cams" }, () => sh.fits(H_CAM, cams, 0.04));
  if (feet.length) {
    sh.step({ title: "Bolt the centre feet on", detail: "A long bolt through each foot into the bottom panel, tightened with the Allen key.", tools: ["allen"], scene: "base", kind: "legs" }, () => {
      sh.lay(feet, both, both, up, [0, 250, 0]);
      sh.fits(H_LONGBOLT, feet.map((k) => on(k, [sh.pos(k)[0], 0, 0], [0, 1, 0], { mate: BP })), 0.2);
    });
    sh.step({ title: "Turn the adjustable feet in", detail: "One into the end of each centre foot, by hand. You level them later.", scene: "base", kind: "legs" }, () =>
      sh.fits(H_ADJ, feet.map((k) => on(k, [sh.pos(k)[0], 0, 0], [0, 1, 0], { hole: false })), 0.2),
    );
  }
  const keys = [BP, ...frame, BK, ...feet];
  sh.step({ title: "Turn the base over", detail: "Stand it on its legs where the cabinet will go.", kind: "flip" }, () => sh.add(keys, [0, 200, 0], 0.08));
  return { BP, keys, Wb, Db };
}
const H_LONGBOLT: HwDef = { kind: "bolt", len: 90, dia: 8, name: "Long bolt" };
const H_ADJ: HwDef = { kind: "foot", len: 30, dia: 30, name: "Adjustable foot" };

/* ---------- doors ---------- */

interface Door {
  k: string;
  x0: number; // its edge at the hinges
  x1: number; // the other edge, where the handle goes
  y0: number;
  y1: number;
  zb: number; // back face
}

/** A door made in one piece, or a frame around a glass pane. */
function makeDoor(sh: Shop, x0: number, x1: number, y0: number, y1: number, zb: number, glass: boolean): Door {
  const w = Math.abs(x1 - x0), h = y1 - y0;
  const pos: Vec3 = [(x0 + x1) / 2, (y0 + y1) / 2, zb + DT / 2];
  const pieces = glass
    ? [
        ...[-1, 1].map((sx) => box([60, h, DT], [sx * (w / 2 - 30), 0, 0])),
        ...[-1, 1].map((sy) => box([w - 120, 70, DT], [0, sy * (h / 2 - 35), 0])),
        box([w - 120, h - 140, 4], [0, 0, 0], "glass"),
      ]
    : undefined;
  const k = sh.part(glass ? "Glass door" : "Door", [w, h, DT], pos, { pieces });
  return { k, x0, x1, y0, y1, zb };
}

/** Doors face down on a rug, a soft-close hinge and a plain one in each, then clipped on and given handles. */
function doorSteps(sh: Shop, doors: Door[], o: { bumpers?: number; handles: { doors: Door[]; def: HwDef; screw: HwDef; where?: string }[]; felt?: Door[] }) {
  const face: Vec3 = [PI / 2, 0, 0];
  const gap = 160;
  const totalW = doors.reduce((a, d) => a + Math.abs(d.x1 - d.x0) + gap, -gap);
  let cx = -totalW / 2;
  const spots = doors.map((d) => {
    const w = Math.abs(d.x1 - d.x0);
    const at: Vec3 = [cx + w / 2, DT / 2, 0];
    cx += w + gap;
    return at;
  });
  const showAll = () => doors.forEach((d, i) => sh.lay([d.k], sh.pos(d.k), spots[i], face));
  const hingeAt = (d: Door, top: boolean): Fit => {
    const sx = d.x1 > d.x0 ? 1 : -1;
    return on(d.k, [d.x0 + sx * 22, top ? d.y1 - 110 : d.y0 + 110, d.zb], [0, 0, 1]);
  };
  const scene = "doors";
  if (o.bumpers)
    sh.step({ title: "Press the bumpers into the doors", detail: `Lay the doors face down on a rug. ${o.bumpers / doors.length} small bumpers in the holes at the corners of each.`, scene, kind: "general", warnings: ["floor"] }, () => {
      showAll();
      sh.fits(H_BUMP, doors.flatMap((d) => [d.y0 + 30, d.y1 - 30].map((y) => on(d.k, [d.x1 - (d.x1 > d.x0 ? 25 : -25), y, d.zb], [0, 0, 1], { hole: false }))).slice(0, o.bumpers));
    });
  sh.step({ title: "Screw the soft-close hinges onto the doors", detail: `${o.bumpers ? "" : "Lay the doors face down on a rug. "}One at the top of each door, cup in the round hole, two screws.`, tools: ["screwdriver"], scene, kind: "hinges", warnings: o.bumpers ? [] : ["floor"] }, () => {
    if (!o.bumpers) showAll();
    sh.fits(H_SOFT, doors.map((d) => hingeAt(d, true)), 0.12);
  });
  sh.step({ title: "Screw the plain hinges on", detail: "One at the bottom of each door, the same way.", tools: ["screwdriver"], scene, kind: "hinges" }, () => sh.fits(H_HINGE, doors.map((d) => hingeAt(d, false)), 0.12));
  sh.step({ title: "Clip the doors onto the cabinet", detail: "Hook each hinge onto its mounting plate in the side and press until it clicks. Line the doors up with the adjusting screws.", tools: ["screwdriver"], kind: "doors" }, () =>
    sh.add(doors.map((d) => d.k), [0, 0, 350], 0.3),
  );
  for (const hd of o.handles) {
    const drop = hd.def.kind === "handle";
    sh.step({ title: drop ? "Screw the drop handles on" : "Screw the knobs on", detail: `One on each ${hd.where ? hd.where + " " : ""}door near the middle edge, screwed from inside.`, tools: ["screwdriver"], kind: "screws" }, () => {
      const y = (d: Door) => (drop ? d.y0 + (d.y1 - d.y0) * (hd.doors.length < doors.length ? 0.55 : 0.6) : d.y0 + (d.y1 - d.y0) * 0.45);
      const hx = (d: Door) => d.x1 - (d.x1 > d.x0 ? 40 : -40);
      sh.fits(hd.def, hd.doors.map((d) => on(d.k, [hx(d), y(d), d.zb + DT], [0, 0, -1], { hole: false })), 0.15);
      sh.fits(hd.screw, hd.doors.map((d) => on(d.k, [hx(d), y(d), d.zb], [0, 0, 1])), 0.15);
    });
  }
  if (o.felt)
    sh.step({ title: "Stick the felt bumpers on", detail: "Two inside each right-hand door, at the edge that closes against the other door.", kind: "general" }, () =>
      sh.fits(H_FELT, o.felt!.flatMap((d) => [d.y0 + 60, d.y1 - 60].map((y) => on(d.k, [d.x1 + 20, y, d.zb], [0, 0, 1], { hole: false }))), 0.12),
    );
}

/* ---------- drawer ---------- */

interface DrawerBox {
  keys: string[];
  front: string;
  sides: string[];
  back: string;
  bottom: string;
}

/** A drawer of front, sides, bottom and back, built standing on its front; `x0..x1` is the opening between the runners. */
function drawerParts(sh: Shop, x0: number, x1: number, y0: number, y1: number, zf: number, len: number, fw: number) {
  const dw = x1 - x0 - 26; // runners take 13 each side
  const h = y1 - y0 - 50;
  const dz1 = zf, dz0 = zf - len;
  const xc = (x0 + x1) / 2;
  const front = sh.part("Drawer front", [fw, y1 - y0 - 4, DT], [xc, (y0 + y1) / 2, zf + DT / 2]);
  const sy = y0 + 20 + h / 2;
  const sides = [-1, 1].map((sx) => sh.part("Drawer side", [14, h, len], [xc + sx * (dw / 2 - 7), sy, (dz0 + dz1) / 2]));
  const back = sh.part("Drawer back", [dw - 28, h - 20, 14], [xc, sy + 10, dz0 + 7]);
  const bottom = sh.part("Drawer bottom", [dw - 20, 4, len - 14], [xc, y0 + 30, (dz0 + dz1) / 2 + 7], { material: "fiber" });
  return { d: { keys: [front, ...sides, back, bottom], front, sides, back, bottom } as DrawerBox, dw, fw, dz0, dz1, xc, y0, h };
}

function drawerSteps(sh: Shop, dr: ReturnType<typeof drawerParts>, o: { knobs: number; frontBolts: boolean }) {
  const { d, dw, fw, dz0, dz1, xc, y0, h } = dr;
  const scene = "drawer";
  const face: Vec3 = [PI / 2, 0, 0];
  const piv = sh.pos(d.front);
  const lay = (keys: string[], from?: Vec3) => sh.lay(keys, piv, [0, DT / 2, 0], face, from);
  const xsd = (sx: number) => xc + sx * (dw / 2 - 7);
  const ys = [y0 + 50, y0 + 20 + h - 30];
  const boltsF = [-1, 1].flatMap((sx) => ys.map((y) => on(d.front, [xsd(sx), y, dz1], [0, 0, 1], { mate: d.sides[sx < 0 ? 0 : 1] })));
  const boltsB = [-1, 1].flatMap((sx) => ys.map((y) => on(d.back, [xsd(sx) - sx * 7, y, dz0 + 7], [-sx, 0, 0])));
  if (o.frontBolts)
    sh.step({ title: "Screw cam bolts into the drawer front and back", detail: "Lay them on a rug, the front face down: four in each.", tools: ["screwdriver"], scene, kind: "cams", warnings: ["floor"] }, () => {
      lay([d.front]);
      sh.lay([d.back], piv, [0, 7, -360], [0, 0, 0]);
      sh.fits(H_BOLT, [...boltsF, ...boltsB]);
    });
  else
    sh.step({ title: "Screw cam bolts into the drawer front", detail: "Lay it face down on a rug: four in its inside face.", tools: ["screwdriver"], scene, kind: "cams", warnings: ["floor"] }, () => {
      lay([d.front]);
      sh.fits(H_BOLT, boltsF);
    });
  if (o.frontBolts)
    sh.step({ title: "Press two bumpers into the drawer front", detail: "In the holes at its back face, near the ends.", scene, kind: "general" }, () =>
      sh.fits(H_BUMP, [-1, 1].map((sx) => on(d.front, [xc + sx * (fw / 2 - 15), y0 + 40, dz1], [0, 0, 1], { hole: false }))),
    );
  const dowels = d.sides.flatMap((k, i) => [...ys.map((y) => on(k, [xsd(i ? 1 : -1), y + 25, dz1], [0, 0, 1], { mate: d.front })), ...(o.frontBolts ? ys.map((y) => on(k, [xsd(i ? 1 : -1), y + 25, dz0 + 14], [0, 0, -1], { mate: d.back })) : [])]);
  sh.step({ title: "Stand the sides on the front", detail: `Tap ${dowels.length} dowels into the sides' ends first, grooves facing in at the bottom.`, tools: ["hammer"], scene, kind: "dowels" }, () => {
    lay(d.sides, [0, 200, 0]);
    sh.fits(H_DOWEL, dowels);
  });
  sh.step({ title: "Lock the sides to the front", detail: "Four small cam locks, turned clockwise.", tools: ["screwdriver"], scene, kind: "cams" }, () =>
    sh.fits(H_SCAM, d.sides.flatMap((k, i) => ys.map((y) => on(k, [xsd(i ? 1 : -1) - (i ? 7 : -7), y, dz1 - 30], [i ? 1 : -1, 0, 0])))),
  );
  sh.step({ title: "Slide the bottom into the grooves", detail: "All the way down to the front.", scene, kind: "join" }, () => lay([d.bottom], [0, 0, -400]));
  if (!o.frontBolts)
    sh.step({ title: "Screw cam bolts into the drawer back", detail: "Four, near its ends.", tools: ["screwdriver"], scene, kind: "cams" }, () => {
      sh.lay([d.back], piv, [0, 7, -360], [0, 0, 0]);
      sh.fits(H_BOLT, boltsB);
    });
  sh.step({ title: "Fit the back on the sides", detail: "Lower it onto the ends of the sides, over the bottom. Lock it with four small cam locks.", tools: ["screwdriver"], scene, kind: "cams" }, () => {
    lay([d.back], [0, 200, 0]);
    sh.fits(H_SCAM, d.sides.flatMap((k, i) => ys.map((y) => on(k, [xsd(i ? 1 : -1) - (i ? 7 : -7), y, dz0 + 40], [i ? 1 : -1, 0, 0]))));
  });
  if (!o.frontBolts)
    sh.step({ title: "Press two bumpers into the drawer front", detail: "In the holes at its back face, near the ends.", scene, kind: "general" }, () =>
      sh.fits(H_BUMP, [-1, 1].map((sx) => on(d.front, [xc + sx * (fw / 2 - 15), y0 + 40, dz1], [0, 0, 1], { hole: false }))),
    );
  const bar: HwDef = { kind: "connector", len: Math.round(dw - 30), dia: 15, name: "Stabiliser bar" };
  sh.step({ title: "Fit the stabiliser bar", detail: "Turn the drawer over. Lay the bar across the back and fix it with three small screws.", tools: ["screwdriver"], scene, kind: "screws" }, () => {
    sh.lay(d.keys, [0, 0, 0], [0, -y0, 0]);
    sh.fits(bar, [on(d.back, [xc, y0 + 52, dz0], [0, 0, 1], { hole: false, twist: 0 })]);
    sh.fits(H_BAR_SCREW, sp(3, xc - dw / 2 + 60, xc + dw / 2 - 60).map((x) => on(d.back, [x, y0 + 52, dz0], [0, 0, 1])));
  });
  const kx = o.knobs === 1 ? [xc] : [xc - dw / 3, xc + dw / 3];
  const ky = y0 + (h + 46) / 2;
  sh.step({ title: o.knobs === 1 ? "Screw the knob on" : "Screw the knobs on", detail: "From inside the drawer, through the front.", tools: ["screwdriver"], scene, kind: "screws" }, () => {
    sh.fits(H_KNOB, kx.map((x) => on(d.front, [x, ky, dz1 + DT], [0, 0, -1], { hole: false })), 0.15);
    sh.fits(H_KNOB_SCREW, kx.map((x) => on(d.front, [x, ky, dz1], [0, 0, 1])), 0.15);
  });
  sh.step({ title: "Put the drawer on the runners", detail: "Pull the runners out, set the drawer on them and push it in until the catches at the back hook on.", kind: "drawer" }, () => sh.add(d.keys, [0, 0, 450], 0.06));
  sh.step({ title: "Clip the release catches under the front", detail: "One at each runner, pressed on until it clicks. Squeeze them to lift the drawer out.", kind: "drawer" }, () =>
    sh.fits(H_RELEASE, [-1, 1].map((sx) => on(d.bottom, [xc + sx * (dw / 2 - 40), y0 + 28, dz1 - 40], [0, 1, 0], { hole: false })), 0.15),
  );
}

/** Runners screwed onto two inside faces, wheel end to the front, two screws each. */
function runnerFits(sh: Shop, hosts: [string, number, number][], y: number, z0: number, z1: number) {
  const len = Math.round((z1 - z0) / 10) * 10;
  sh.fits({ kind: "runner", len, dia: 40 }, hosts.map(([k, x, sx]) => on(k, [x, y, (z0 + z1) / 2], [sx, 0, 0], { hole: false })), 0.15);
  sh.fits(H_SMALL, hosts.flatMap(([k, x, sx]) => [z0 + 40, z1 - 40].map((z) => on(k, [x, y, z], [sx, 0, 0]))));
}

/** Two sides laid inside up get cam bolts, two back rails get dowels, and the rails join one side, then the other. */
function sideFrame(sh: Shop, o: { scene: string; sides: string[]; rails: string[]; x: number; y0: number; y1: number; zb: number; what: string }) {
  const { scene, sides, rails, x, y0, y1, zb } = o;
  const h = y1 - y0;
  sh.step({ title: `Screw cam bolts into the ${o.what}`, detail: "Lay both on a rug, inside up. Two in each, at the holes for the rails.", tools: ["screwdriver"], scene, kind: "cams", warnings: ["floor"] }, () => {
    sides.forEach((k, i) => sh.lay([k], sh.pos(k), [sgn(i) * (h / 2 + 120), T / 2, 0], [0, 0, -sgn(i) * PI / 2]));
    sh.fits(H_BOLT, sides.flatMap((k, i) => rails.map((rk) => on(k, [sgn(i) * x, sh.pos(rk)[1], zb + T / 2], [sgn(i), 0, 0], { mate: rk }))));
  });
  sh.step({ title: "Tap dowels into the back rails", detail: "One in each end. The rows of holes face the same way on both.", tools: ["hammer"], scene, kind: "dowels" }, () => {
    sh.lay(rails, [0, y0, 0], [0, 0, 500]);
    sh.fits(H_DOWEL, rails.flatMap((k) => [-1, 1].map((sx) => on(k, [sx * x, sh.pos(k)[1] + 14, zb + T / 2], [sx, 0, 0], { mate: sides[sx < 0 ? 0 : 1] }))));
  });
  const piv: Vec3 = [0, y0, 0];
  const cams = (sx: number) => rails.map((k) => on(k, [sx * (x - 30), sh.pos(k)[1], zb + T], [0, 0, -1]));
  sh.step({ title: `Join the rails to one of the ${o.what}`, detail: "One at its top end, one at its bottom end, at the back edge. Turn the two cam locks clockwise.", tools: ["screwdriver"], scene, kind: "cams" }, () => {
    sh.lay([sides[0], ...rails], piv, [0, 0, 0]);
    sh.fits(H_CAM, cams(-1));
  });
  sh.step({ title: `Fit the other one`, detail: "Push it onto the free ends of the rails and turn two more cam locks.", tools: ["screwdriver"], scene, kind: "cams" }, () => {
    sh.lay([sides[1]], piv, [0, 0, 0], [0, 0, 0], [300, 0, 0]);
    sh.fits(H_CAM, cams(1));
  });
}

/** The top panel, face down on a rug for its cam bolts, then laid on and locked. */
function topPanel(sh: Shop, TP: string, bolts: Fit[], cams: Fit[], into: string) {
  const p = sh.pos(TP);
  sh.step({ title: "Screw cam bolts into the top panel", detail: `Lay it face down on a rug: ${bolts.length} in the holes underneath.`, tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["floor"] }, () => {
    sh.lay([TP], p, [0, PT / 2, 0], [PI, 0, 0]);
    sh.fits(H_BOLT, bolts);
  });
  sh.step({ title: "Lay the top panel on", detail: `Cam bolts down into ${into}, moulded edge to the front. Turn the ${cams.length} cam locks to pull it tight.`, tools: ["screwdriver"], kind: "cams" }, () => {
    sh.add([TP], [0, 300, 0]);
    sh.fits(H_CAM, cams);
  });
}

/* ---------- the three products ---------- */

/** Measurements every carcass shares. */
function frameOf(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xo = W / 2 - CI, xi = xo - T;
  const zb = -D / 2 + 5; // back of the sides
  const zf = D / 2 - CI - DT; // front of the sides, behind the doors
  const y0 = BAS + PT;
  return { W, H, D, xo, xi, zb, zf, y0, sd: zf - zb, zm: (zf + zb) / 2 };
}

const sgn = (i: number) => (i ? 1 : -1);

function glassCabinet(b: PlanBuilder, s: ProductSpec) {
  const sh = new Shop(b);
  const { W, H, D, xo, xi, zb, zf, y0, sd, zm } = frameOf(s);
  const y1 = Math.round((H * 0.5) / 10) * 10 + 5; // the lower cabinet's top panel sits here
  const yu0 = y1 + PT, yu1 = H - PT; // the top unit's sides
  const xu = xo - 20, xui = xu - T; // the top unit is a little narrower
  const sdu = Math.round(sd * 0.72), zfu = zb + sdu, zmu = zb + sdu / 2;

  // lower cabinet
  const [L, R] = [-1, 1].map((sx) => sh.part("Side panel", [T, y1 - y0, sd], [sx * (xo - T / 2), (y0 + y1) / 2, zm]));
  const rails = [y0 + RAIL / 2, y1 - RAIL / 2].map((y) => sh.part("Back rail", [2 * xi, RAIL, T], [0, y, zb + T / 2]));
  const K = sh.part("Back panel", [2 * xi, y1 - y0 - 2 * RAIL, 8], [0, (y0 + y1) / 2, zb + T / 2], { material: "fiber" });
  const TP = sh.part("Top panel", [W, PT, D], [0, y1 + PT / 2, 0]);
  const shelfD = sd - 30;
  const lowS = [0.36, 0.68].map((f) => y0 + (y1 - y0) * f);
  const lowShelves = lowS.map((y) => sh.part("Shelf", [2 * xi - 2, T, shelfD], [0, y, zf - 5 - shelfD / 2]));

  // top unit, with framed glass sides
  const hu = yu1 - yu0;
  const gSide: PartPiece[] = [
    ...[-1, 1].map((sz) => box([T, hu, 50], [0, 0, sz * (sdu / 2 - 25)])),
    ...[-1, 1].map((sy) => box([T, 70, sdu - 100], [0, sy * (hu / 2 - 35), 0])),
    box([4, hu - 140, sdu - 100], [0, 0, 0], "glass"),
  ];
  const [UL, UR] = [-1, 1].map((sx) => sh.part("Glass side", [T, hu, sdu], [sx * (xu - T / 2), (yu0 + yu1) / 2, zmu], { pieces: gSide }));
  const urails = [yu0 + RAIL / 2, yu1 - RAIL / 2].map((y) => sh.part("Back rail", [2 * xui, RAIL, T], [0, y, zb + T / 2]));
  const UK = sh.part("Back panel", [2 * xui, hu - 2 * RAIL, 8], [0, (yu0 + yu1) / 2, zb + T / 2], { material: "fiber" });
  const CH = 45, cy = yu1 - CH / 2;
  const CF = sh.part("Crown front", [2 * xu + 40, CH, 20], [0, cy, zfu + DT + 10]);
  const [CL, CR] = [-1, 1].map((sx) => sh.part("Crown side", [20, CH, sdu + DT], [sx * (xu + 10), cy, zb + (sdu + DT) / 2]));
  const UT = sh.part("Top", [W, PT, sdu + DT + 50], [0, H - PT / 2, zb - 5 + (sdu + DT + 50) / 2]);
  const upS = [0.34, 0.67].map((f) => yu0 + hu * f);
  const upShelves = upS.map((y) => sh.part("Shelf", [2 * xui - 2, T, sdu - 30], [0, y, zfu - 5 - (sdu - 30) / 2]));

  // doors
  const lowDoors = [0, 1].map((i) => makeDoor(sh, sgn(i) * (xo - 1), sgn(i) * 2, y0 + 2, y1 - 2, zf, false));
  const upDoors = [0, 1].map((i) => makeDoor(sh, sgn(i) * (xu - 1), sgn(i) * 2, yu0 + 2, yu1 - CH - 2, zfu, true));

  const { BP } = buildBase(sh, W, D, { front: 2, back: 2, pins: 3 });
  const lowSides = [L, R];
  const zs = [zb + 60, zf - 60];
  sh.step({ title: "Screw cam bolts into the bottom panel", detail: "Four, at the holes where the sides stand.", tools: ["screwdriver"], kind: "cams" }, () =>
    sh.fits(H_BOLT, [-1, 1].flatMap((sx) => zs.map((z) => on(BP, [sx * (xo - T / 2), y0, z], [0, -1, 0], { mate: sx < 0 ? L : R })))),
  );
  sideFrame(sh, { scene: "cabinet", sides: lowSides, rails, x: xi, y0, y1, zb, what: "sides" });
  const cPivL: Vec3 = [0, (y0 + y1) / 2, 0];
  const bottomDowels: Fit[] = [...lowSides.flatMap((k, i) => sp(4, zb + 40, zf - 40).map((z) => on(k, [sgn(i) * (xo - T / 2), y0, z], [0, -1, 0], { mate: BP }))), ...[-1, 1].map((sx) => on(rails[0], [sx * xi * 0.5, y0, zb + T / 2], [0, -1, 0], { mate: BP }))];
  sh.step({ title: "Turn it upside down and tap dowels in", detail: "Four in the end of each side and two in the bottom rail.", tools: ["hammer"], scene: "cabinet", kind: "dowels" }, () => {
    sh.lay([...lowSides, ...rails], cPivL, [0, (y1 - y0) / 2, 0], [PI, 0, 0]);
    sh.fits(H_DOWEL, bottomDowels);
  });
  sh.step({ title: "Lower the cabinet onto the base", detail: "Turn it the right way up and lower it onto the bottom panel, dowels and cam bolts into their holes.", kind: "join" }, () => sh.add([...lowSides, ...rails], [0, 350, 0], 0.05));
  sh.step({ title: "Lock the sides to the bottom", detail: "Four cam locks, low inside the sides.", tools: ["screwdriver"], kind: "cams" }, () =>
    sh.fits(H_CAM, lowSides.flatMap((k, i) => zs.map((z) => on(k, [sgn(i) * xi, y0 + 30, z], [sgn(i), 0, 0])))),
  );
  sh.step({ title: "Slide the back panel down the grooves", detail: "Through the groove in the top rail and down into the bottom rail, smooth side facing in.", kind: "join" }, () => sh.add([K], [0, 1000, 0]));
  topPanel(sh, TP, lowSides.map((k, i) => zs.map((z): Fit => on(TP, [sgn(i) * (xo - T / 2), y1, z], [0, 1, 0], { mate: k }))).flat(), lowSides.flatMap((k, i) => zs.map((z) => on(k, [sgn(i) * xi, y1 - 30, z], [sgn(i), 0, 0]))), "the sides");
  sh.step({ title: "Rivet the back to the rails", detail: "From behind: push each sleeve through the back into the rail, then press its pin in. Four at the top, four at the bottom.", kind: "general" }, () =>
    sh.fits(H_RIVET, [y0 + RAIL / 2, y1 - RAIL / 2].flatMap((y, j) => sp(4, -xi + 120, xi - 120).map((x) => on(K, [x, y, zb], [0, 0, 1], { mate: rails[j] })))),
  );
  sh.step({ title: "Press the clips onto the back", detail: "Eight of them, four down each side. Each clip goes on in two halves, pressed together by hand.", kind: "general" }, () =>
    sh.fits(H_CLIP, [-1, 1].flatMap((sx) => sp(4, y0 + 120, y1 - 120).map((y) => on(K, [sx * (xi - 12), y, zb], [0, 0, 1], { hole: false })))),
  );

  // the top unit, built on its own
  const zsu = [zb + 50, zfu - 50];
  sh.step({ title: "Screw cam bolts into the top panel", detail: "Four more, for the top unit's sides.", tools: ["screwdriver"], kind: "cams" }, () =>
    sh.fits(H_BOLT, [-1, 1].flatMap((sx) => zsu.map((z) => on(TP, [sx * (xu - T / 2), y1 + PT, z], [0, -1, 0], { mate: sx < 0 ? UL : UR })))),
  );
  const scene = "top unit";
  const uSides = [UL, UR];
  sideFrame(sh, { scene, sides: uSides, rails: urails, x: xui, y0: yu0, y1: yu1, zb, what: "glass sides" });
  const upAt: Vec3 = [0, 0, 0], upPiv: Vec3 = [0, yu0, 0];
  // the crown, upside down on a rug, then its top
  const crown = [CF, CL, CR];
  const cPiv: Vec3 = [0, H - (CH + PT) / 2, 0];
  const cAt: Vec3 = [0, (CH + PT) / 2, D + 500];
  const upd: Vec3 = [PI, 0, 0];
  sh.step({ title: "Tap a dowel into each crown side", detail: "In its front end, where it meets the crown front.", tools: ["hammer"], scene: "crown", kind: "dowels" }, () => {
    sh.lay([CL, CR], cPiv, cAt, upd, [0, 160, 0]);
    sh.fits(H_DOWEL, [CL, CR].map((k, i) => on(k, [sgn(i) * (xu + 10), cy, zfu + DT], [0, 0, 1], { mate: CF })));
  });
  sh.step({ title: "Screw two cam bolts into the crown front", detail: "Into its back, one near each end.", tools: ["screwdriver"], scene: "crown", kind: "cams" }, () => {
    sh.lay([CF], cPiv, cAt, upd);
    sh.fits(H_BOLT, [-1, 1].map((sx) => on(CF, [sx * (xu + 10), cy - 8, zfu + DT], [0, 0, 1], { mate: sx < 0 ? CL : CR })));
  });
  sh.step({ title: "Join the crown into a U", detail: "Push the sides onto the front and turn a cam lock in each.", tools: ["screwdriver"], scene: "crown", kind: "cams" }, () => {
    sh.fits(H_CAM, [CL, CR].map((k, i) => on(k, [sgn(i) * (xu + 10), yu1, zfu + DT - 40], [0, 1, 0])));
  });
  const crownDowels: Fit[] = [...[-1, 1].map((sx) => on(CF, [sx * xu * 0.5, yu1, zfu + DT + 10], [0, 1, 0], { mate: UT })), ...[CL, CR].flatMap((k, i) => [zb + 60, zfu - 40].map((z) => on(k, [sgn(i) * (xu + 10), yu1, z], [0, 1, 0], { mate: UT })))];
  sh.step({ title: "Tap dowels into the top of the crown", detail: "Six along its edge.", tools: ["hammer"], scene: "crown", kind: "dowels" }, () => sh.fits(H_DOWEL, crownDowels));
  sh.step({ title: "Lay the crown on the top", detail: "Lay the top face down on the rug and turn the crown over onto it, dowels into the holes.", scene: "crown", kind: "join" }, () => {
    sh.lay([UT], cPiv, cAt, upd, [0, 0, 300]);
  });
  const crownScrews: Fit[] = [...sp(3, -xu + 120, xu - 120).map((x) => on(CF, [x, yu1 - CH, zfu + DT + 10], [0, 1, 0], { mate: UT })), ...[CL, CR].map((k, i) => on(k, [sgn(i) * (xu + 10), yu1 - CH, zmu], [0, 1, 0], { mate: UT }))];
  sh.step({ title: "Screw the crown to the top", detail: "Five screws, each with a small washer, through the crown into the top.", tools: ["screwdriver"], scene: "crown", kind: "screws" }, () => {
    sh.fits(H_SWASHER, crownScrews.map((f) => ({ ...f, hole: false as const })));
    sh.fits(H_LONG, crownScrews);
  });
  sh.step({ title: "Turn it over and screw in cam bolts", detail: "Four under the top, inside the crown, for the glass sides.", tools: ["screwdriver"], scene: "crown", kind: "cams" }, () => {
    sh.lay([UT, ...crown], cPiv, cAt, [0, 0, 0], [0, 200, 0]);
    sh.fits(H_BOLT, [-1, 1].flatMap((sx) => zsu.map((z) => on(UT, [sx * (xu - T / 2), yu1, z], [0, 1, 0], { mate: sx < 0 ? UL : UR }))));
  });
  const topEnds: Fit[] = [...uSides.flatMap((k, i) => zsu.map((z) => on(k, [sgn(i) * (xu - T / 2), yu1, z + 25], [0, 1, 0], { mate: UT }))), ...[-1, 1].map((sx) => on(urails[1], [sx * xui * 0.5, yu1, zb + T / 2], [0, 1, 0], { mate: UT }))];
  sh.step({ title: "Tap dowels into the top ends", detail: "Two in each glass side and two in the top rail.", tools: ["hammer"], scene, kind: "dowels" }, () => {
    sh.lay([...uSides, ...urails], upPiv, upAt);
    sh.fits(H_DOWEL, topEnds);
  });
  const uTop = [UT, ...crown];
  sh.step({ title: "Lower the top on", detail: "Crown to the front, cam bolts into the sides. Turn four cam locks to pull it tight.", tools: ["screwdriver"], scene, kind: "cams" }, () => {
    sh.lay(uTop, upPiv, upAt, [0, 0, 0], [0, 300, 0]);
    sh.fits(H_CAM, uSides.flatMap((k, i) => zsu.map((z) => on(k, [sgn(i) * xui, yu1 - 30, z], [sgn(i), 0, 0]))));
  });
  const unit = [...uSides, ...urails, ...uTop];
  const lie: Vec3 = [PI / 2, 0, 0];
  const lyPiv: Vec3 = [0, (yu0 + H) / 2, zb];
  const lyAt: Vec3 = [0, 0, 0];
  sh.step({ title: "Lay it on its front and slide the back in", detail: "Two of you turn it onto a rug. The back slides up the grooves from the open bottom end, smooth side in.", scene, kind: "join", people: 2 }, () => {
    sh.lay(unit, lyPiv, lyAt, lie, [0, 200, 0]);
    sh.lay([UK], lyPiv, lyAt, lie, [0, 0, -700]);
  });
  sh.step({ title: "Rivet the back to the rails", detail: "Eight plastic rivets: sleeve first, then press the pin in.", scene, kind: "general" }, () =>
    sh.fits(H_RIVET, [yu0 + RAIL / 2, yu1 - RAIL / 2].flatMap((y, j) => sp(4, -xui + 120, xui - 120).map((x) => on(UK, [x, y, zb], [0, 0, 1], { mate: urails[j] })))),
  );
  sh.step({ title: "Press the clips onto the back", detail: "Eight, four down each side, each pressed together in two halves.", scene, kind: "general" }, () =>
    sh.fits(H_CLIP, [-1, 1].flatMap((sx) => sp(4, yu0 + 120, yu1 - 120).map((y) => on(UK, [sx * (xui - 12), y, zb], [0, 0, 1], { hole: false })))),
  );
  const botEnds: Fit[] = [...uSides.flatMap((k, i) => zsu.map((z) => on(k, [sgn(i) * (xu - T / 2), yu0, z + 25], [0, -1, 0], { mate: TP }))), ...[-1, 1].map((sx) => on(urails[0], [sx * xui * 0.5, yu0, zb + T / 2], [0, -1, 0], { mate: TP }))];
  sh.step({ title: "Tap dowels into the bottom ends", detail: "Two in each glass side and two in the bottom rail.", tools: ["hammer"], scene, kind: "dowels" }, () => sh.fits(H_DOWEL, botEnds));
  sh.step({ title: "Lift the top unit onto the cabinet", detail: "Two of you stand it up and lower it on, dowels and cam bolts into their holes.", people: 2, kind: "join" }, () => sh.add([...unit, UK], [0, 450, 0], 0.04));
  sh.step({ title: "Lock the top unit on", detail: "Four cam locks at the bottom of the glass sides, turned clockwise.", tools: ["screwdriver"], kind: "cams" }, () =>
    sh.fits(H_CAM, uSides.flatMap((k, i) => zsu.map((z) => on(k, [sgn(i) * xui, yu0 + 30, z], [sgn(i), 0, 0])))),
  );
  const wb = [-1, 1].map((sx): Vec3 => [sx * (xu - 150), H, zb + 40]);
  sh.step({ title: "Screw the wall brackets onto the top", detail: "At the back, one screw and a washer each, the long arm reaching past the back.", tools: ["screwdriver"], kind: "screws" }, () => {
    sh.fits(H_WBRACKET, wb.map((p) => on(UT, p, [0, -1, 0], { hole: false })), 0.15);
    sh.fits(H_WASHER, wb.map((p) => on(UT, [p[0], p[1] + 2, p[2] + 30], [0, -1, 0], { hole: false })));
    sh.fits(H_SMALL, wb.map((p) => on(UT, [p[0], p[1] + 3, p[2] + 30], [0, -1, 0])));
  });
  sh.step({ title: "Fix it to the wall", detail: "Mark through the bracket slots, then screw them to the wall with a washer each. Screws and plugs for your wall aren't included.", tools: ["pencil", "drill", "screwdriver"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    sh.fits(H_PLUG, wb.map((p) => ({ at: [p[0], p[1] + 30, -D / 2 - 20] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.15);
    sh.fits(H_WASHER, wb.map((p) => ({ at: [p[0], p[1] + 30, -D / 2 - 2] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })));
    sh.fits(H_WALL_SCREW, wb.map((p) => ({ at: [p[0], p[1] + 30, -D / 2] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.15);
  });
  const supports = (sides: [string, string], x: number, ys: number[], z0: number, z1: number) =>
    sides.flatMap((k, i) => ys.flatMap((y) => [z0, z1].map((z) => on(k, [sgn(i) * x, y - T / 2 - 3, z], [sgn(i), 0, 0], { hole: false }))));
  sh.step({ title: "Push in the shelf supports", detail: "Sixteen, four for each shelf, all at the same height.", kind: "shelves" }, () =>
    sh.fits(H_SUPPORT, [...supports([UL, UR], xui, upS, zfu - 60, zb + 50), ...supports([L, R], xi, lowS, zf - 60, zb + 60)], 0.03),
  );
  sh.step({ title: "Lay the shelves on", detail: "Two in the top unit and two in the cabinet.", kind: "shelves" }, () => sh.add([...upShelves, ...lowShelves], [0, 0, 400], 0.2));
  doorSteps(sh, [...upDoors, ...lowDoors], {
    handles: [
      { doors: upDoors, def: H_DROP, screw: H_DROP_SCREW, where: "glass" },
      { doors: lowDoors, def: H_KNOB, screw: H_KNOB_SCREW, where: "lower" },
    ],
    felt: [upDoors[1], lowDoors[1]],
  });
  return true;
}

/** The wall spacers at the back, their knobs, and two screws through the back with cup washers and covers. */
function wallSteps(sh: Shop, o: { sides: string[]; K: string; xo: number; xi: number; y1: number; zb: number; D: number }) {
  const { sides, K, xo, xi, y1, zb, D } = o;
  const sAt = (i: number): Vec3 => [sgn(i) * (xo - T / 2), y1 - 70, zb];
  sh.step({ title: "Screw the wall spacers onto the back", detail: "One on the back edge of each side, near the top.", tools: ["screwdriver"], kind: "screws" }, () =>
    sh.fits(H_SPACER, sides.map((k, i) => on(k, sAt(i), [0, 0, 1], { hole: false })), 0.15),
  );
  sh.step({ title: "Set it against the wall", detail: "Turn a knob onto each spacer and screw it out until the cabinet stands straight against the wall, even over a skirting board.", kind: "anchor" }, () =>
    sh.fits(H_SPACER_KNOB, sides.map((k, i) => on(k, [sAt(i)[0], sAt(i)[1], zb - 20], [0, 0, 1], { hole: false })), 0.15),
  );
  const pts = [-1, 1].map((sx): Vec3 => [sx * (xi - 60), y1 - 45, zb + 8]);
  sh.step({ title: "Fix it to the wall", detail: "Through the two holes at the top of the back, each screw with a cup washer, then click the covers on. Screws and plugs for your wall aren't included.", tools: ["pencil", "drill", "screwdriver"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    sh.fits(H_PLUG, pts.map((p) => ({ at: [p[0], p[1], -D / 2 - 25] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.15);
    sh.fits(H_CUP, pts.map((p) => on(K, p, [0, 0, -1], { hole: false })));
    sh.fits(H_WALL_SCREW, pts.map((p) => on(K, [p[0], p[1], p[2] + 2], [0, 0, -1])), 0.15);
    sh.fits(H_COVER, pts.map((p) => on(K, [p[0], p[1], p[2] + 4], [0, 0, -1], { hole: false })));
  });
}

const supports = (pairs: [string, number, number][], ys: number[], z0: number, z1: number) =>
  pairs.flatMap(([k, x, sx]) => ys.flatMap((y) => [z0, z1].map((z) => on(k, [x, y - T / 2 - 3, z], [sx, 0, 0], { hole: false }))));

function cabinet102(b: PlanBuilder, s: ProductSpec) {
  const sh = new Shop(b);
  const { W, H, D, xo, xi, zb, zf, y0, sd } = frameOf(s);
  const y1 = H - PT;
  const yF = y0 + 185; // underside of the fixed shelf, over the drawer
  const zk = zb + 8; // in front of the back panel
  const [L, R] = [-1, 1].map((sx) => sh.part("Side panel", [T, y1 - y0, sd], [sx * (xo - T / 2), (y0 + y1) / 2, (zb + zf) / 2]));
  const fd = zf + DT - zk;
  const F = sh.part("Fixed shelf", [2 * xi, 22, fd], [0, yF + T - 11, zk + fd / 2], {
    pieces: [box([2 * xi, T, zf - zk], [0, 11 - T / 2, -DT / 2]), box([2 * xi, 22, DT], [0, 0, fd / 2 - DT / 2])],
  });
  const yT = yF + T;
  const DV = sh.part("Divider", [T, y1 - yT, zf - zk], [0, (yT + y1) / 2, (zk + zf) / 2]);
  const K = sh.part("Back panel", [2 * xi, y1 - y0, 8], [0, (y0 + y1) / 2, zb + 4], { material: "fiber" });
  const TP = sh.part("Top panel", [W, PT, D], [0, y1 + PT / 2, 0]);
  const shelfD = zf - zk - 30;
  const bw = xi - T / 2;
  const sYs = [0.36, 0.68].map((f) => yT + (y1 - yT) * f);
  const shelves = [-1, 1].flatMap((sx) => sYs.map((y) => sh.part("Shelf", [bw - 2, T, shelfD], [(sx * (xi + T / 2)) / 2, y, zf - 5 - shelfD / 2])));
  const doors = [0, 1].map((i) => makeDoor(sh, sgn(i) * (xo - 1), sgn(i) * 2, yT + 2, y1 - 2, zf, false));
  const len = Math.min(400, Math.round((sd - 40) / 10) * 10);
  const dr = drawerParts(sh, -xi, xi, y0, yF + T - 22, zf, len, 2 * xo - 4);

  const { BP } = buildBase(sh, W, D, { front: 3, back: 3, pins: 4 });
  const sides = [L, R];
  const zs = [zb + 70, zf - 70];
  sh.step({ title: "Screw cam bolts into the bottom panel", detail: "Four, at the holes where the sides stand.", tools: ["screwdriver"], kind: "cams" }, () =>
    sh.fits(H_BOLT, sides.flatMap((k, i) => zs.map((z) => on(BP, [sgn(i) * (xo - T / 2), y0, z], [0, -1, 0], { mate: k })))),
  );
  const scene = "cabinet";
  sh.step({ title: "Screw cam bolts into the sides", detail: "Lay both on a rug, inside up. Two in each, at the fixed shelf's holes.", tools: ["screwdriver"], scene, kind: "cams", warnings: ["floor"] }, () => {
    sides.forEach((k, i) => sh.lay([k], sh.pos(k), [sgn(i) * ((y1 - y0) / 2 + 120), T / 2, 0], [0, 0, -sgn(i) * PI / 2]));
    sh.fits(H_BOLT, sides.flatMap((k, i) => zs.map((z) => on(k, [sgn(i) * xi, yF + T / 2, z], [sgn(i), 0, 0], { mate: F }))));
  });
  sh.step({ title: "Tap dowels into the fixed shelf", detail: "Two in each end.", tools: ["hammer"], scene, kind: "dowels" }, () => {
    sh.lay([F], [0, yF, 0], [0, 0, D + 200]);
    sh.fits(H_DOWEL, [-1, 1].flatMap((sx) => zs.map((z) => on(F, [sx * xi, yF + T / 2, z + 40], [sx, 0, 0], { mate: sx < 0 ? L : R }))));
  });
  const piv: Vec3 = [0, y0, 0];
  sh.step({ title: "Join the fixed shelf to the sides", detail: "Push it onto one side, front lip down at the front, then fit the other side. Turn the four cam locks clockwise.", tools: ["screwdriver"], scene, kind: "cams" }, () => {
    sh.lay([L, F], piv, [0, 0, 0]);
    sh.lay([R], piv, [0, 0, 0], [0, 0, 0], [300, 0, 0]);
    sh.fits(H_CAM, [-1, 1].flatMap((sx) => zs.map((z) => on(F, [sx * (xi - 30), yT, z], [0, -1, 0]))));
  });
  const bottomDowels = sides.flatMap((k, i) => sp(4, zb + 40, zf - 40).map((z) => on(k, [sgn(i) * (xo - T / 2), y0, z + 20], [0, -1, 0], { mate: BP })));
  sh.step({ title: "Turn it upside down and tap dowels in", detail: "Four in the end of each side.", tools: ["hammer"], scene, kind: "dowels" }, () => {
    sh.lay([L, R, F], [0, (y0 + y1) / 2, 0], [0, (y1 - y0) / 2, 0], [PI, 0, 0]);
    sh.fits(H_DOWEL, bottomDowels);
  });
  sh.step({ title: "Lower the sides onto the base", detail: "Turn it the right way up and lower it onto the bottom panel, dowels and cam bolts into their holes.", kind: "join" }, () => sh.add([L, R, F], [0, 350, 0], 0.05));
  sh.step({ title: "Lock the sides to the bottom", detail: "Four cam locks, low inside the sides.", tools: ["screwdriver"], kind: "cams" }, () =>
    sh.fits(H_CAM, sides.flatMap((k, i) => zs.map((z) => on(k, [sgn(i) * xi, y0 + 30, z], [sgn(i), 0, 0])))),
  );
  const dz = [zk + 70, zf - 70];
  sh.step({ title: "Screw two cam bolts into the fixed shelf", detail: "In the middle of its top, for the divider.", tools: ["screwdriver"], kind: "cams" }, () =>
    sh.fits(H_BOLT, dz.map((z) => on(F, [0, yT, z], [0, -1, 0], { mate: DV }))),
  );
  sh.step({ title: "Tap dowels into the divider", detail: "Two in each end.", tools: ["hammer"], scene: "divider", kind: "dowels" }, () => {
    sh.lay([DV], [0, yT, 0], [0, 0, 0]);
    sh.fits(H_DOWEL, [...dz.map((z) => on(DV, [0, yT, z + 40], [0, -1, 0], { mate: F })), ...dz.map((z) => on(DV, [0, y1, z + 40], [0, 1, 0], { mate: TP }))]);
  });
  sh.step({ title: "Stand the divider on the fixed shelf", detail: "In the middle, row of holes on both faces. Turn two cam locks at its foot.", tools: ["screwdriver"], kind: "cams" }, () => {
    sh.add([DV], [0, 350, 0]);
    sh.fits(H_CAM, dz.map((z) => on(DV, [-T / 2, yT + 30, z], [1, 0, 0])));
  });
  sh.step({ title: "Slide the back panel down the grooves", detail: "Smooth side facing in, all the way down to the bottom panel.", kind: "join" }, () => sh.add([K], [0, 1000, 0]));
  topPanel(
    sh,
    TP,
    [...sides.flatMap((k, i) => zs.map((z) => on(TP, [sgn(i) * (xo - T / 2), y1, z], [0, 1, 0], { mate: k }))), ...dz.map((z) => on(TP, [0, y1, z], [0, 1, 0], { mate: DV }))],
    [...sides.flatMap((k, i) => zs.map((z) => on(k, [sgn(i) * xi, y1 - 30, z], [sgn(i), 0, 0]))), ...dz.map((z) => on(DV, [-T / 2, y1 - 30, z], [1, 0, 0]))],
    "the sides and the divider",
  );
  sh.step({ title: "Rivet the back to the fixed shelf", detail: "From behind: four sleeves through the back into the shelf's edge, then press the pins in.", kind: "general" }, () =>
    sh.fits(H_RIVET, sp(4, -xi + 120, xi - 120).map((x) => on(K, [x, yF + T / 2, zb], [0, 0, 1], { mate: F }))),
  );
  sh.step({ title: "Press the clips onto the back", detail: "Eight of them, four down each side, each pressed together in two halves.", kind: "general" }, () =>
    sh.fits(H_CLIP, [-1, 1].flatMap((sx) => sp(4, y0 + 100, y1 - 100).map((y) => on(K, [sx * (xi - 12), y, zb], [0, 0, 1], { hole: false })))),
  );
  wallSteps(sh, { sides, K, xo, xi, y1, zb, D });
  sh.step({ title: "Screw the drawer runners in", detail: "Low inside each side, wheel end to the front, two screws each.", tools: ["screwdriver"], kind: "runners" }, () =>
    runnerFits(sh, [[L, -xi, -1], [R, xi, 1]], y0 + 30, zf - len, zf),
  );
  sh.step({ title: "Push in the shelf supports", detail: "Sixteen, four for each shelf, all at the same height.", kind: "shelves" }, () =>
    sh.fits(H_SUPPORT, supports([[L, -xi, -1], [DV, -T / 2, 1], [DV, T / 2, -1], [R, xi, 1]], sYs, zf - 60, zk + 50), 0.03),
  );
  sh.step({ title: "Lay the shelves on", detail: "Two on each side of the divider.", kind: "shelves" }, () => sh.add(shelves, [0, 0, 400], 0.2));
  doorSteps(sh, doors, { bumpers: 4, handles: [{ doors, def: H_DROP, screw: H_DROP_SCREW }] });
  drawerSteps(sh, dr, { knobs: 2, frontBolts: false });
  return true;
}

function tvBench(b: PlanBuilder, s: ProductSpec) {
  const sh = new Shop(b);
  const { W, H, D, xo, xi, zb, zf, y0, sd } = frameOf(s);
  const y1 = H - PT;
  const xd = Math.round(W * 0.18); // the dividers, either side of the middle bay
  const xm = xd - T / 2; // the middle bay's sides
  const yF = y0 + 200; // the fixed shelf over the drawer
  const yT = yF + T;
  const zk = zb + 8;
  const [L, R] = [-1, 1].map((sx) => sh.part("Side panel", [T, y1 - y0, sd], [sx * (xo - T / 2), (y0 + y1) / 2, (zb + zf) / 2]));
  const [DL, DR] = [-1, 1].map((sx) => sh.part("Divider", [T, y1 - y0, zf - zk], [sx * xd, (y0 + y1) / 2, (zk + zf) / 2]));
  const FS = sh.part("Fixed shelf", [2 * xm, T, zf - zk], [0, yF + T / 2, (zk + zf) / 2]);
  const K = sh.part("Back panel", [2 * xi, y1 - y0, 8], [0, (y0 + y1) / 2, zb + 4], { material: "fiber" });
  const TP = sh.part("Top panel", [W, PT, D], [0, y1 + PT / 2, 0]);
  const shelfD = zf - zk - 30;
  const bw = xi - xd - T / 2;
  const sYs = [0.36, 0.68].map((f) => y0 + (y1 - y0) * f);
  const mY = yT + (y1 - yT) * 0.5;
  const shelves = [
    ...[-1, 1].flatMap((sx) => sYs.map((y) => sh.part("Shelf", [bw - 2, T, shelfD], [sx * (xi + xd + T / 2) / 2, y, zf - 5 - shelfD / 2]))),
    sh.part("Middle shelf", [2 * xm - 2, T, shelfD], [0, mY, zf - 5 - shelfD / 2]),
  ];
  const doors = [0, 1].map((i) => makeDoor(sh, sgn(i) * (xo - 1), sgn(i) * (xm + 2), y0 + 2, y1 - 2, zf, false));
  const len = Math.min(400, Math.round((sd - 40) / 10) * 10);
  const dr = drawerParts(sh, -xm, xm, y0, yF, zf, len, 2 * xm - 6);

  const { BP, Wb } = buildBase(sh, W, D, { front: 6, back: 6, pins: 4, feet: 2 });
  void Wb;
  const sides = [L, R], divs = [DL, DR];
  const zs = [zb + 70, zf - 70], dzs = [zk + 70, zf - 70];
  sh.step({ title: "Screw cam bolts into the bottom panel", detail: "Eight: two where each side stands and two for each divider.", tools: ["screwdriver"], kind: "cams" }, () =>
    sh.fits(H_BOLT, [...sides.flatMap((k, i) => zs.map((z) => on(BP, [sgn(i) * (xo - T / 2), y0, z], [0, -1, 0], { mate: k }))), ...divs.flatMap((k, i) => dzs.map((z) => on(BP, [sgn(i) * xd, y0, z], [0, -1, 0], { mate: k })))]),
  );
  sh.step({ title: "Tap dowels into the sides", detail: "Lay both on a rug: two in the bottom end of each.", tools: ["hammer"], scene: "sides", kind: "dowels", warnings: ["floor"] }, () => {
    sides.forEach((k, i) => sh.lay([k], sh.pos(k), [sgn(i) * ((y1 - y0) / 2 + 120), T / 2, 0], [0, 0, -sgn(i) * PI / 2]));
    sh.fits(H_DOWEL, sides.flatMap((k, i) => zs.map((z) => on(k, [sgn(i) * (xo - T / 2), y0, z + 40], [0, -1, 0], { mate: BP }))));
  });
  sh.step({ title: "Stand the sides on the bottom panel", detail: "Groove for the back at the back edge. Turn four cam locks low inside them.", tools: ["screwdriver"], kind: "cams" }, () => {
    sh.add(sides, [0, 350, 0]);
    sh.fits(H_CAM, sides.flatMap((k, i) => zs.map((z) => on(k, [sgn(i) * xi, y0 + 30, z], [sgn(i), 0, 0]))));
  });
  const scene = "middle";
  sh.step({ title: "Screw the drawer runners onto the dividers", detail: "Lay the dividers on a rug, facing each other: the runner marked L on the left one, R on the right, two screws each.", tools: ["screwdriver"], scene, kind: "runners", warnings: ["floor"] }, () => {
    divs.forEach((k, i) => sh.lay([k], sh.pos(k), [sgn(i) * ((y1 - y0) / 2 + 80), T / 2, 0], [0, 0, sgn(i) * PI / 2]));
    runnerFits(sh, [[DL, -xm, 1], [DR, xm, -1]].map(([k, x, sx]) => [k, x, -(sx as number)] as [string, number, number]), y0 + 30, zf - len, zf);
  });
  sh.step({ title: "Screw cam bolts into the dividers", detail: "Two in each, at the fixed shelf's holes.", tools: ["screwdriver"], scene, kind: "cams" }, () =>
    sh.fits(H_BOLT, divs.flatMap((k, i) => dzs.map((z) => on(k, [sgn(i) * xm, yF + T / 2, z], [sgn(i), 0, 0], { mate: FS })))),
  );
  sh.step({ title: "Tap dowels into the fixed shelf", detail: "Two in each end.", tools: ["hammer"], scene, kind: "dowels" }, () => {
    sh.lay([FS], [0, yF, 0], [0, 0, 0], [0, 0, 0]);
    sh.fits(H_DOWEL, [-1, 1].flatMap((sx) => dzs.map((z) => on(FS, [sx * xm, yF + T / 2, z + 40], [sx, 0, 0], { mate: sx < 0 ? DL : DR }))));
  });
  const piv: Vec3 = [0, y0, 0];
  sh.step({ title: "Join the dividers with the fixed shelf", detail: "Stand them up and push the shelf in between, runners below it. Turn the four cam locks.", tools: ["screwdriver"], scene, kind: "cams" }, () => {
    sh.lay([DL, DR, FS], piv, [0, 0, 0], [0, 0, 0], [0, 200, 0]);
    sh.fits(H_CAM, [-1, 1].flatMap((sx) => dzs.map((z) => on(FS, [sx * (xm - 30), yT, z], [0, -1, 0]))));
  });
  sh.step({ title: "Tap dowels into the dividers' feet", detail: "Two in the bottom end of each.", tools: ["hammer"], scene, kind: "dowels" }, () =>
    sh.fits(H_DOWEL, divs.flatMap((k, i) => dzs.map((z) => on(k, [sgn(i) * xd, y0, z + 40], [0, -1, 0], { mate: BP })))),
  );
  sh.step({ title: "Stand the middle section on the bottom panel", detail: "Dowels and cam bolts into their holes. Turn four cam locks at the dividers' feet.", tools: ["screwdriver"], kind: "cams" }, () => {
    sh.add([DL, DR, FS], [0, 350, 0], 0.08);
    sh.fits(H_CAM, divs.flatMap((k, i) => dzs.map((z) => on(k, [sgn(i) * (xd + T / 2), y0 + 30, z], [-sgn(i), 0, 0]))));
  });
  sh.step({ title: "Slide the back panel down the grooves", detail: "Cable holes at the top, smooth side facing in, all the way down to the bottom panel.", kind: "join" }, () => sh.add([K], [0, 900, 0]));
  const vert: [string, number, number[]][] = [[L, -(xo - T / 2), zs], [DL, -xd, dzs], [DR, xd, dzs], [R, xo - T / 2, zs]];
  sh.step({ title: "Tap dowels into the top ends", detail: "Two in each side and each divider.", tools: ["hammer"], kind: "dowels" }, () =>
    sh.fits(H_DOWEL, vert.flatMap(([k, x, z2]) => z2.map((z) => on(k, [x, y1, z + 40], [0, 1, 0], { mate: TP })))),
  );
  topPanel(
    sh,
    TP,
    vert.flatMap(([k, x, z2]) => z2.map((z) => on(TP, [x, y1, z], [0, 1, 0], { mate: k }))),
    vert.flatMap(([k, x, z2]) => z2.map((z) => (k === L || k === R ? on(k, [Math.sign(x) * xi, y1 - 30, z], [Math.sign(x), 0, 0]) : on(k, [x - Math.sign(x) * T / 2, y1 - 30, z], [Math.sign(x), 0, 0])))),
    "the sides and dividers",
  );
  sh.step({ title: "Rivet the back to the dividers", detail: "From behind: four sleeves through the back into each divider's edge, then press the pins in.", kind: "general" }, () =>
    sh.fits(H_RIVET, divs.flatMap((k, i) => sp(4, y0 + 80, y1 - 80).map((y) => on(K, [sgn(i) * xd, y, zb], [0, 0, 1], { mate: k })))),
  );
  sh.step({ title: "Press the clips onto the back", detail: "Six of them, three down each side, each pressed together in two halves.", kind: "general" }, () =>
    sh.fits(H_CLIP, [-1, 1].flatMap((sx) => sp(3, y0 + 100, y1 - 100).map((y) => on(K, [sx * (xi - 12), y, zb], [0, 0, 1], { hole: false })))),
  );
  sh.step({ title: "Level the centre feet", detail: "Turn the feet under the middle until they just touch the floor, so the bottom doesn't sag.", kind: "legs" });
  wallSteps(sh, { sides, K, xo, xi, y1, zb, D });
  sh.step({ title: "Push in the shelf supports", detail: "Twenty, four for each shelf, all at the same height.", kind: "shelves" }, () =>
    sh.fits(H_SUPPORT, [
      ...supports([[L, -xi, -1], [DL, -(xd + T / 2), 1], [DR, xd + T / 2, -1], [R, xi, 1]], sYs, zf - 60, zk + 50),
      ...supports([[DL, -xm, -1], [DR, xm, 1]], [mY], zf - 60, zk + 50),
    ], 0.03),
  );
  sh.step({ title: "Lay the shelves on", detail: "Two behind each door and one in the middle, over the drawer.", kind: "shelves" }, () => sh.add(shelves, [0, 0, 400], 0.2));
  doorSteps(sh, doors, { bumpers: 4, handles: [{ doors, def: H_DROP, screw: H_DROP_SCREW }] });
  drawerSteps(sh, dr, { knobs: 1, frontBolts: true });
  return true;
}

/* ---------- the bookcase ---------- */

const B_BOLT: HwDef = { kind: "camScrew", len: 24, dia: 7, name: "Cam bolt" }; // the expanding kind, pushed in and screwed
const B_ALLEN: HwDef = { kind: "screw", len: 50, dia: 7, name: "Allen screw" };
const B_SCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
const B_WASHER: HwDef = { kind: "washer", len: 1.5, dia: 14 };
const B_BRACKET: HwDef = { kind: "bracket", len: 60, dia: 40 };
const B_PIN: HwDef = { kind: "pin", len: 12, dia: 5 };

/*
 * The carcass is built lying on its back: the fixed shelf goes onto the cam bolts in one side and the other side
 * comes down onto it, the bottom and top panels are turned in between the sides on their dowels and screwed through
 * the sides. The crown and the base are each built on the rug as a U (a front and two sides on dowels and cam locks)
 * and pushed onto the ends of the carcass along their dowels and pins; the base's back rail goes on after them.
 */
function bookcase(b: PlanBuilder, s: ProductSpec) {
  const sh = new Shop(b);
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xo = W / 2 - O; // outside of the carcass sides
  const xi = xo - T; // inside
  const zb = -D / 2 + 5; // back panel, in the grooves
  const zf = D / 2 - O; // front of the carcass
  const pz0 = zb + 5, pd = zf - pz0, pzc = pz0 + pd / 2; // the panels between the sides
  const y0 = BH, y1 = H - CH; // the carcass
  const yB = y0 + T / 2, yP = y1 - T / 2, yF = r((yB + yP) / 2);
  const xj = W / 2 - O - 2.5; // where the crown and base sides overlap the carcass sides
  const zj = D / 2 - T + 1.5; // where the base front overlaps the bottom panel
  const zc = D / 2 - 20 + 3; // where the crown front overlaps the top panel

  const [L, R] = [-1, 1].map((sx) => sh.part("Side panel", [T, y1 - y0, D - O], [sx * (xo - T / 2), (y0 + y1) / 2, -O / 2]));
  const F = sh.part("Fixed shelf", [2 * xi, T, pd], [0, yF, pzc]);
  const B = sh.part("Bottom panel", [2 * xi, T, pd], [0, yB, pzc]);
  const K = sh.part("Back panel", [2 * xi, y1 - y0, 10], [0, (y0 + y1) / 2, zb], { material: "fiber" });
  const P = sh.part("Top panel", [2 * xi, T, pd], [0, yP, pzc]);
  // the crown: a front rail across the whole width and two side pieces behind its ends
  const CF = sh.part("Crown front", [W, CH, 20], [0, H - CH / 2, D / 2 - 10]);
  const [CL, CR] = [-1, 1].map((sx) => sh.part("Crown side", [20, CH, D - 20], [sx * (W / 2 - 10), H - CH / 2, -10]));
  // the base: a shaped apron with two feet, two side legs with a foot at each end, a back rail
  const apron: PartPiece[] = [box([W, 40, T], [0, BH / 2 - 20, 0]), ...[-1, 1].map((sx) => box([70, BH - 40, T], [sx * (W / 2 - 35), -20, 0]))];
  const BF = sh.part("Base front", [W, BH, T], [0, BH / 2, D / 2 - T / 2], { pieces: apron });
  const sd = D - T;
  const legP: PartPiece[] = [box([T, 40, sd], [0, BH / 2 - 20, 0]), ...[-1, 1].map((sz) => box([T, BH - 40, 60], [0, -20, sz * (sd / 2 - 30)]))];
  const [BL, BR] = [-1, 1].map((sx) => sh.part("Base side", [T, BH, sd], [sx * (W / 2 - T / 2), BH / 2, -T / 2], { pieces: legP }));
  const BK = sh.part("Base back rail", [W - 2 * T, 40, T], [0, BH - 20, -D / 2 + T / 2]);
  const shelfYs = [y0 + (yF - y0) * 0.5, yF + (yP - yF) * 0.36, yF + (yP - yF) * 0.68];
  const sDepth = Math.min(280, pd - 10);
  const shelves = shelfYs.map((y) => sh.part("Shelf", [2 * xi - 2, T, sDepth], [0, y, zf - 10 - sDepth / 2]));

  const sides = [L, R];
  const both = <X>(f: (sx: number, k: string, i: number) => X[]) => sides.flatMap((k, i) => f(sgn(i), k, i));
  const zs3 = [-pd / 2 + 50, 0, pd / 2 - 50].map((z) => pzc + z);
  const lying = { pose: "+z" as const };
  const fin = (k: string) => b.partItem(k).final;

  sh.step({ title: "Screw cam bolts into both sides", detail: "Lay the sides on a rug, inside up. Two in each, at the fixed shelf's holes in the middle, pushed in and screwed until they stop.", tools: ["screwdriver"], kind: "cams", warnings: ["floor"], ...lying }, () => {
    sh.add([L], [-300, 0, 0]);
    const p = fin(R).pos;
    b.stage(R, [p[0] + 450, p[1], p[2]], fin(R).rot, [0, 0, 250]);
    b.then(0.15);
    sh.fits(B_BOLT, both((sx, k) => [-90, 90].map((z) => on(k, [sx * xi, yF, pzc + z], [-sx, 0, 0], { mate: F }))));
  });
  sh.step({ title: "Fit the fixed shelf between the sides", detail: "Push it onto the bolts in one side, then bring the other side onto it.", kind: "join", ...lying }, () => {
    sh.add([F], [350, 0, 0]);
    sh.add([R], [450, 0, 0]);
  });
  sh.step({ title: "Turn the cam locks in the fixed shelf", detail: "Four of them, open side towards the bolt. Turn each clockwise until it pulls the joint tight.", tools: ["screwdriver"], kind: "cams", ...lying }, () =>
    sh.fits(H_CAM, [-1, 1].flatMap((sx) => [-90, 90].map((z) => on(F, [sx * (xi - 32), yF + T / 2, pzc + z], [0, -1, 0])))),
  );
  // the bottom and the top panels: dowels in while held out past the end, then turned in between the sides
  const endPanel = (k: string, y: number, top: boolean) => {
    const out = top ? 160 : -160;
    sh.step({ title: top ? "Tap dowels into the top panel" : "Tap dowels into the bottom panel", detail: "Two in each end, tapped in until they stop.", tools: ["hammer"], kind: "dowels", ...lying }, () => {
      b.stage(k, [0, y + out, pzc], [top ? 0.6 : -0.6, 0, 0], [0, out, 0]);
      b.then(0.15);
      sh.fits(H_DOWEL, [-1, 1].flatMap((sx) => [-60, 60].map((z) => on(k, [sx * xi, y, pzc + z], [-sx, 0, 0], { mate: sx < 0 ? L : R }))));
    });
    sh.step({ title: top ? "Turn the top panel in between the sides" : "Turn the bottom panel in between the sides", detail: "Tip it in at the end, dowels into the holes, its edge flush with the ends of the sides.", kind: "join", ...lying }, () => sh.add([k], [0, out, 0]));
    sh.step({ title: top ? "Screw the sides to the top" : "Screw the sides to the bottom", detail: "Three long screws through each side with the Allen key. Stop as soon as the head sits flush.", tools: ["allen"], kind: "screws", warnings: ["hand"], ...lying }, () =>
      sh.fits(B_ALLEN, both((sx, k2) => zs3.map((z) => on(k2, [sx * xo, y, z], [-sx, 0, 0], { mate: k })))),
    );
  };
  endPanel(B, yB, false);
  sh.step({ title: "Slide the back panel into the grooves", detail: "From the top end, all the way down, the grooved boards facing the front.", kind: "join", ...lying }, () => sh.add([K], [0, 1400, 0]));
  sh.step({ title: "Stand it up and check the back", detail: "The back must sit down in the groove of the bottom panel all the way along.", kind: "standup", people: 2 });
  sh.step({ title: "Rivet the back to the fixed shelf", detail: "From behind: push each sleeve through the back into the shelf's edge, then press its pin in.", kind: "general" }, () =>
    sh.fits(H_RIVET, [-210, -70, 70, 210].map((x) => on(K, [x, yF, zb - 5], [0, 0, 1], { mate: F }))),
  );
  endPanel(P, yP, true);
  sh.step({ title: "Tap dowels into the tops of the sides", detail: "Two in each end, for the crown.", tools: ["hammer"], kind: "dowels", ...lying }, () =>
    sh.fits(H_DOWEL, both((sx, k) => [-60, 60].map((z) => on(k, [sx * xj, y1, pzc + z], [0, -1, 0], { mate: sx < 0 ? CL : CR })))),
  );

  // the crown, upside down on the rug
  const cPiv: Vec3 = [0, H - CH / 2, 0], cAt: Vec3 = [0, CH / 2, 0], upd: Vec3 = [PI, 0, 0];
  const cs = [CL, CR];
  sh.step({ title: "Screw two cam bolts into the crown front", detail: "Lay it upside down on the rug. One into its back near each end, until it stops.", tools: ["screwdriver"], scene: "crown", kind: "cams", warnings: ["floor"] }, () => {
    sh.lay([CF], cPiv, cAt, upd);
    sh.fits(B_BOLT, [-1, 1].map((sx) => on(CF, [sx * (W / 2 - 10), H - CH / 2 + 8, D / 2 - 20], [0, 0, 1], { mate: sx < 0 ? CL : CR })));
  });
  sh.step({ title: "Tap a dowel into each crown side", detail: "In its front end, where it meets the crown front.", tools: ["hammer"], scene: "crown", kind: "dowels" }, () => {
    sh.lay(cs, cPiv, [0, CH / 2, 250], upd, [0, 0, 200]);
    sh.fits(H_DOWEL, cs.map((k, i) => on(k, [sgn(i) * (W / 2 - 10), H - CH / 2 - 10, D / 2 - 20], [0, 0, -1], { mate: CF })));
  });
  sh.step({ title: "Join the crown into a U", detail: "Push the sides onto the front, then turn a cam lock in each until it's tight.", tools: ["screwdriver"], scene: "crown", kind: "cams" }, () => {
    sh.lay(cs, cPiv, cAt, upd);
    sh.fits(H_CAM, cs.map((k, i) => on(k, [sgn(i) * (W / 2 - 10), H - CH, D / 2 - 60], [0, 1, 0])));
  });
  sh.step({ title: "Tap dowels into the crown", detail: "Six along the edge that sits on the top: two in the front, two in each side.", tools: ["hammer"], scene: "crown", kind: "dowels" }, () =>
    sh.fits(H_DOWEL, [
      ...[-150, 150].map((x) => on(CF, [x, H - CH, zc], [0, 1, 0], { mate: P })),
      ...cs.flatMap((k, i) => [-130, 0].map((z) => on(k, [sgn(i) * xj, H - CH, z], [0, 1, 0], { mate: sides[i] }))),
    ]),
  );
  sh.step({ title: "Push the crown onto the top end", detail: "Lay the bookcase on its back again. Push the crown straight on, dowels into the holes, front flush with the front.", kind: "join", ...lying }, () => sh.add([CF, ...cs], [0, 300, 0], 0.02));
  const crownScrews = [-200, -70, 70, 200].map((x) => on(P, [x, y1 - T, zc], [0, 1, 0], { mate: CF }));
  sh.step({ title: "Screw the crown on from inside", detail: "Four screws, each with a washer, up through the top panel into the crown.", tools: ["screwdriver"], kind: "screws", ...lying }, () => {
    sh.fits(B_WASHER, crownScrews.map((f) => ({ ...f, hole: false as const })));
    sh.fits(B_SCREW, crownScrews);
  });

  // the base
  const zp = [-100, 80];
  const zBk = -D / 2 + T + 2; // where the back rail overlaps the bottom panel
  sh.step({ title: "Screw ten cam pins into the bottom end", detail: "Two into the end of each side, three along the front and three along the back of the bottom panel, by hand until they stop.", tools: ["screwdriver"], kind: "cams", ...lying }, () =>
    sh.fits(H_PIN, [
      ...both((sx, k, i) => zp.map((z) => on(k, [sx * xj, y0, z], [0, 1, 0], { mate: i ? BR : BL }))),
      ...[-180, 0, 180].map((x) => on(B, [x, y0, zj], [0, 1, 0], { mate: BF })),
      ...[-180, 0, 180].map((x) => on(B, [x, y0, zBk], [0, 1, 0], { mate: BK })),
    ]),
  );
  const o3: Vec3 = [0, 0, 0];
  const xb = W / 2 - T / 2;
  const bs = [BL, BR];
  sh.step({ title: "Tap dowels into the base front", detail: "Stand it on the rug. Two in each end of its inside face.", tools: ["hammer"], scene: "base", kind: "dowels", warnings: ["floor"] }, () => {
    sh.lay([BF], o3, o3);
    sh.fits(H_DOWEL, [-1, 1].flatMap((sx) => [BH - 12, BH - 36].map((y) => on(BF, [sx * xb, y, D / 2 - T], [0, 0, 1], { mate: sx < 0 ? BL : BR }))));
  });
  const baseCams = [-1, 1].flatMap((sx) => [25, 50].map((y): Vec3 => [sx * xb, y, D / 2 - T]));
  sh.step({ title: "Screw cam pins into the base sides", detail: "Two in the front end of each, turned in until the collar meets the wood.", tools: ["screwdriver"], scene: "base", kind: "cams" }, () => {
    sh.lay(bs, o3, [0, 0, -250], o3, [0, 0, -200]);
    sh.fits(H_PIN, baseCams.map((p) => on(p[0] < 0 ? BL : BR, p, [0, 0, -1], { mate: BF })));
  });
  sh.step({ title: "Join the sides to the base front", detail: "Push each side onto the dowels, pins into the holes. Turn the four cam locks clockwise until they're tight.", tools: ["screwdriver"], scene: "base", kind: "cams" }, () => {
    sh.lay(bs, o3, o3);
    sh.fits(H_CAM, baseCams.map((p) => on(BF, [p[0] - Math.sign(p[0]) * 36, p[1], p[2]], [0, 0, 1])));
  });
  sh.step({ title: "Tap dowels into the top of the base", detail: "Six along its top edge: two in the front, two in each side.", tools: ["hammer"], scene: "base", kind: "dowels" }, () =>
    sh.fits(H_DOWEL, [
      ...[-150, 150].map((x) => on(BF, [x, BH, zj], [0, -1, 0], { mate: B })),
      ...bs.flatMap((k, i) => [-130, 30].map((z) => on(k, [sgn(i) * xj, BH, z], [0, -1, 0], { mate: sides[i] }))),
    ]),
  );
  sh.step({ title: "Push the base onto the bottom end", detail: "Straight on, dowels and pins into their holes, front flush with the front.", kind: "join", ...lying }, () => sh.add([BF, ...bs], [0, -300, 0], 0.02));
  const brk: Vec3[] = [-230, -80, 80, 230].map((x) => [x, BH - 20, -D / 2 + T]);
  sh.step({ title: "Fit dowels and brackets on the back rail", detail: "A dowel into each end and four angle brackets along its inside face, flush with the top, one screw each.", tools: ["hammer", "screwdriver"], scene: "rail", kind: "screws", warnings: ["floor"] }, () => {
    sh.lay([BK], fin(BK).pos, [0, 20, 0]);
    sh.fits(H_DOWEL, [-1, 1].map((sx) => on(BK, [sx * (W / 2 - T), BH - 20, -D / 2 + T / 2], [-sx, 0, 0], { mate: sx < 0 ? BL : BR })));
    sh.fits(H_ANGLE, brk.map((p) => on(BK, p, [0, 0, -1], { hole: false })));
    sh.fits(H_SMALL, brk.map((p) => on(BK, [p[0], p[1] - 8, p[2]], [0, 0, -1])));
  });
  sh.step({ title: "Fit the back rail", detail: "Spring the base sides out a little and push it in between them, onto the pins and dowels.", kind: "join", ...lying }, () => sh.add([BK], [0, -250, 0]));
  sh.step({ title: "Click the corner blocks in and screw the brackets up", detail: "A plastic block in each inside corner of the base, A and B as marked. Then a screw up through each bracket into the bottom.", tools: ["screwdriver"], kind: "screws", ...lying }, () => {
    sh.fits(H_BLOCK, [
      ...[-1, 1].map((sx) => on(BF, [sx * (W / 2 - T - 25), 50, D / 2 - T], [0, 0, 1], { hole: false })),
      ...[-1, 1].map((sx) => on(BK, [sx * (W / 2 - T - 25), 50, -D / 2 + T], [0, 0, -1], { hole: false })),
    ]);
    sh.fits(H_SMALL, brk.map((p) => on(BK, [p[0], BH, p[2] + 12], [0, 1, 0], { mate: B })));
  });
  sh.step({ title: "Turn the cam locks in the base", detail: "Two in each side and three in the back rail, each turned clockwise until it's tight.", tools: ["screwdriver"], kind: "cams", ...lying }, () =>
    sh.fits(H_CAM, [
      ...bs.flatMap((k, i) => zp.map((z) => on(k, [sgn(i) * (W / 2 - T), BH - 20, z], [sgn(i), 0, 0]))),
      ...[-180, 0, 180].map((x) => on(BK, [x, BH - 16, -D / 2 + T], [0, 0, -1])),
    ]),
  );
  sh.step({ title: "Stand it up and lock the base front", detail: "Two of you lift it upright. Then three cam locks in the back of the base front, under the bottom shelf.", tools: ["screwdriver"], kind: "cams", people: 2 }, () =>
    sh.fits(H_CAM, [-180, 0, 180].map((x) => on(BF, [x, BH - 16, D / 2 - T], [0, 0, 1]))),
  );
  sh.step({ title: "Press the clips onto the back", detail: "Eight of them, four down each side. Each clip goes on in two halves, pressed together by hand.", kind: "general" }, () =>
    sh.fits(H_CLIP, [-1, 1].flatMap((sx) => [0.15, 0.4, 0.65, 0.9].map((f) => on(K, [sx * (xi - 12), y0 + (y1 - y0) * f, zb - 5], [0, 0, 1], { hole: false })))),
  );
  const wallPts: Vec3[] = [-1, 1].map((sx) => [sx * (xi - 90), y1, zb + 30]);
  sh.step({ title: "Fix it to the wall", detail: "Screw the two brackets onto the top with a washer each, then screw them to the wall through the other washers. Screws and plugs for your wall aren't included.", tools: ["drill", "pencil", "screwdriver"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    sh.fits(B_BRACKET, wallPts.map((p) => on(P, p, [0, -1, 0], { hole: false })));
    sh.fits(H_WASHER, wallPts.map((p) => on(P, [p[0], p[1], p[2] + 25], [0, -1, 0], { hole: false })));
    sh.fits(H_SMALL, wallPts.map((p) => on(P, [p[0], p[1], p[2] + 25], [0, -1, 0])));
    sh.fits(H_PLUG, wallPts.map((p) => ({ at: [p[0], p[1] + 25, -D / 2 - 30] as Vec3, dir: [0, 0, -1] as Vec3 })));
    sh.fits(H_WASHER, wallPts.map((p) => on(P, [p[0], p[1] + 25, -D / 2], [0, 0, -1], { hole: false })));
    sh.fits(H_WALL_SCREW, wallPts.map((p) => on(P, [p[0], p[1] + 25, -D / 2], [0, 0, -1])));
  });
  sh.step({ title: "Put the shelves in", detail: "Push four pins in level for each shelf, then lay the shelf on them.", kind: "shelves" }, () => {
    sh.fits(B_PIN, both((sx, k) => shelfYs.flatMap((y) => [zf - 40, zf - sDepth + 20].map((z) => on(k, [sx * xi, y - T / 2 - 3, z], [sx, 0, 0])))), 0.03);
    sh.add(shelves, [0, 0, 300]);
  });
  return true;
}

const family: Family = {
  names: ["LOMMARP"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (/^lommarp-cabinet-glass-doors/.test(slug)) return glassCabinet(b, s);
    if (/^lommarp-cabinet-102/.test(slug)) return cabinet102(b, s);
    if (/^lommarp-tv-bench/.test(slug)) return tvBench(b, s);
    if (/^lommarp-bookcase/.test(slug)) return bookcase(b, s);
    return false;
  },
};
export default family;
