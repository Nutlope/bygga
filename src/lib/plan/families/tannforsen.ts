import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder, type StepDef } from "../builder";

/**
 * TÄNNFORSEN, read from its manuals. Every piece clicks together: boards with pins push into keyhole slots and click,
 * plastic connectors lock the corners, and nothing is glued or cammed. Wash-stands (doors or drawers, the same frame
 * in every width) start with the two framed sides flat on a rug for their brackets, then the back rail, the lower back
 * board and the bottom front rail click into one standing side and the other side goes on. They hang on a suspension
 * rail screwed to the wall, locked with two screws, and two more go through the small brackets at the bottom into the
 * wall. Drawers are built face down on their fronts and click onto full-extension runners; doors hang on click hinges.
 * Combinations are several frames side by side, screwed together, under a TOLKEN countertop or a one-piece basin,
 * each fitted from its own box. Wall, mirror and high cabinets are a click box built lying on its back, with a back
 * panel slid in, hung on the same kind of rail, the doors clicked on last and the shelves set on supports.
 */

const T = 18; // wash-stand boards
const BACK_IN = 26; // the back boards sit in from the back edge, leaving room for the rail on the wall
const GAP = 4;

const SMALL_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const LOW_BRACKET: HwDef = { kind: "angle", len: 40, dia: 30 };
const HANGER: HwDef = { kind: "angle", len: 70, dia: 50 };
const TOP_CONNECTOR: HwDef = { kind: "clip", len: 40, dia: 12 };
const BOTTOM_CONNECTOR: HwDef = { kind: "clip", len: 50, dia: 16 };
const SUPPORT: HwDef = { kind: "pin", len: 16, dia: 6 };
const SPACER: HwDef = { kind: "washer", len: 6, dia: 12 };
const RUNNER_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const RUNNER_PLATE: HwDef = { kind: "clip", len: 70, dia: 40 };
const RAIL_INSERT: HwDef = { kind: "washer", len: 4, dia: 22 };
const LOCK_SCREW: HwDef = { kind: "screw", len: 10, dia: 6 };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 30 };
const WALL_SCREW: HwDef = HW.wallScrew;
const JOIN_SCREW: HwDef = { kind: "screw", len: 40, dia: 5 };
const HINGE: HwDef = { kind: "hinge", len: 50, dia: 35 };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 10 };
const DOOR_STOP: HwDef = { kind: "clip", len: 24, dia: 24 };
const PLATE_SCREW: HwDef = { kind: "screw", len: 12, dia: 4.5 };
const PLATE: HwDef = { kind: "angle", len: 30, dia: 20 };
const WIRE: HwDef = { kind: "connector", len: 60, dia: 4 };
const DRAWER_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const DRAWER_LOCK: HwDef = { kind: "cam", len: 13, dia: 15 };
const SUPPORT_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const EURO: HwDef = { kind: "screw", len: 11, dia: 5 }; // already in the hinge plates
const TRAP: HwDef = { kind: "connector", len: 200, dia: 40 };
// wall, mirror and high cabinets
const CAB_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const BACK_PIN: HwDef = { kind: "clip", len: 12, dia: 8 };
const BACK_CLIP: HwDef = { kind: "clip", len: 20, dia: 14 };
const GLASS_SUPPORT: HwDef = { kind: "pin", len: 16, dia: 5 };
const COVER: HwDef = { kind: "cap", len: 40, dia: 40 };
const CAB_STOP: HwDef = { kind: "clip", len: 30, dia: 18 };
const FOOT: HwDef = { kind: "foot", len: 20, dia: 30 };

const r = (n: number) => Math.round(n * 10) / 10;

function raised(w: number, h: number, t: number): PartPiece[] {
  const m = Math.min(70, w * 0.12, h * 0.18);
  return [
    { shape: "box", size: [r(w), r(h), t - 3], pos: [0, 0, -1.5] },
    { shape: "box", size: [r(w - 2 * m), r(h - 2 * m), 3], pos: [0, 0, r(t / 2 - 1.5)] },
  ];
}

class Tf {
  types = new Map<string, string>();
  poses = new Map<string, Pose>();
  constructor(
    public b: PlanBuilder,
    public s: ProductSpec,
  ) {}

  part(name: string, size: Vec3, pos: Vec3, o: { material?: PartMaterial; shape?: "box" | "cyl"; rot?: Vec3 } = {}) {
    const k = `${name}|${size.map(Math.round).join("x")}|${o.material ?? "board"}|${o.shape ?? "box"}`;
    let ref = this.types.get(k);
    if (!ref) {
      ref = this.b.part(name, size.map(r) as Vec3, { material: o.material ?? "board", shape: o.shape });
      this.types.set(k, ref);
    }
    return this.b.place(ref, pos.map(r) as Vec3, o.rot ?? [0, 0, 0]);
  }

  compound(name: string, pieces: PartPiece[], pos: Vec3, material: PartMaterial = "board") {
    const { type, mid } = this.b.compound(name, pieces, { material });
    return this.b.place(type, [r(pos[0] + mid[0]), r(pos[1] + mid[1]), r(pos[2] + mid[2])]);
  }

  pos(key: string) {
    return this.b.partItem(key).final.pos;
  }

  /** A front with TÄNNFORSEN's raised centre panel inside a flat frame. */
  panel(name: string, w: number, h: number, t: number, pos: Vec3) {
    const k = `${name}|${Math.round(w)}x${Math.round(h)}|panel`;
    let ref = this.types.get(k);
    if (!ref) {
      ref = this.b.compound(name, raised(w, h, t), { material: "board" }).type;
      this.types.set(k, ref);
    }
    return this.b.place(ref, pos.map(r) as Vec3);
  }

  step(def: Omit<StepDef, "pose"> & { pose?: Pose }, body: () => void = () => {}) {
    const scene = def.scene ?? "main";
    // a pose holds in its scene until a later step there changes it
    const pose = def.pose ?? this.poses.get(scene) ?? "+y";
    this.poses.set(scene, pose);
    const warnings = [...(def.warnings ?? [])];
    if (def.people === 2 && !warnings.includes("two")) warnings.unshift("two");
    this.b.step({ ...def, scene, pose, warnings: warnings.slice(0, 3) }, body);
  }

  /** Every part of a drawer or a door staged in its own scene, relative to where the first one's centre ends up. */
  stageRel(key: string, c0: Vec3, from?: Vec3, shift: Vec3 = [0, 0, 0]) {
    const it = this.b.partItem(key);
    const p = it.final.pos;
    this.b.stage(key, [p[0] - c0[0] + shift[0], p[1] - c0[1] + shift[1], p[2] - c0[2] + shift[2]], it.final.rot, from);
  }
}

/* ---------- wash-stands ---------- */

type UKind = "drawers" | "doors";

interface Drawer {
  front: string;
  sides: [string, string];
  back: string;
  bottom: string;
  support?: string;
  dividers: string[];
  x: number;
  lo: number;
  h: number;
  fw: number;
  ys: number; // underside of the box
  sh: number;
  xs: number; // centre of a box side, from the drawer's centre
  zF: number; // inside face of the front
  zB: number; // outside face of the back
  zc: number;
  wires: number;
}

interface Door {
  key: string;
  sx: -1 | 1; // hinge side
  x: number;
  dw: number;
  ys: number[];
}

interface Shelf {
  key: string;
  y: number; // underside
  z0: number;
  z1: number;
  spacer: boolean;
}

interface Unit {
  kind: UKind;
  x: number;
  W: number;
  Wi: number;
  H: number;
  D: number;
  y0: number;
  sideL: string;
  sideR: string;
  backTop: string;
  backLow: string;
  strip: string;
  rail: string;
  mid?: string;
  topRail?: string;
  shelves: Shelf[];
  drawers: Drawer[];
  doors: Door[];
}

type Basin = "semi" | "one" | "bowl";

interface Layout {
  units: { kind: UKind; w: number }[];
  us: boolean;
  basin?: Basin;
  counter: boolean;
  tap: boolean;
  legs: number;
  over: number; // which unit the basin sits over
}

function layoutOf(s: ProductSpec): Layout | null {
  const slug = s.slug ?? "";
  if (!/^tannforsen-(bathroom-vanity|wash-st|orrsjon|rutsjon|vastersjon)/.test(slug)) return null;
  const us = s.size.d >= 53;
  const W = Math.round(s.size.w * 10);
  const dr = (w: number) => ({ kind: "drawers" as const, w });
  const dd = (w: number) => ({ kind: "doors" as const, w });
  const combo = /orrsjon|rutsjon|vastersjon/.test(slug);
  let units: { kind: UKind; w: number }[];
  if (/-155-x-/.test(slug)) units = [dr(455), dd(610), dr(455)];
  else if (/-124-5-x/.test(slug)) units = /rutsjon/.test(slug) ? [dd(610), dr(610)] : [dr(610), dr(610)];
  else if (/orrsjon-wash-stand-wash-basin-102/.test(slug)) units = [dr(600), dr(400)];
  else {
    // "w drs" on the deep basin set is doors: its photo and manual are the doors one
    const kind: UKind | null = /drawers/.test(slug) ? "drawers" : /doors|-drs-/.test(slug) ? "doors" : null;
    if (!kind) return null;
    units = [{ kind, w: combo ? Math.round((W - 20) / 100) * 100 : W }];
  }
  let basin: Basin | undefined;
  let counter = false;
  if (/vastersjon/.test(slug)) [basin, counter] = ["bowl", true];
  else if (/rutsjon/.test(slug)) [basin, counter] = units.length > 1 ? ["semi", true] : ["one", false];
  else if (/orrsjon/.test(slug)) [basin, counter] = /deep|-basi-2$/.test(slug) ? ["one", false] : ["semi", true];
  return {
    units,
    us,
    basin,
    counter,
    tap: /tap/i.test(s.variant),
    legs: s.cabinet?.plinth ? 180 : 0,
    over: units.length >= 3 ? 1 : 0,
  };
}

class WashStand extends Tf {
  L: Layout;
  units: Unit[] = [];
  Hc: number;
  D: number;
  y0: number;
  constructor(b: PlanBuilder, s: ProductSpec, L: Layout) {
    super(b, s);
    this.L = L;
    this.Hc = L.us ? 640 : 630;
    this.D = L.us ? 535 : 480;
    this.y0 = L.legs;
  }

  get many() {
    return this.units.length > 1;
  }

  build() {
    const total = this.L.units.reduce((a, u) => a + u.w, 0);
    let x = -total / 2;
    for (const u of this.L.units) {
      this.units.push(this.unit(u.kind, x + u.w / 2, u.w));
      x += u.w;
    }
    this.frameSteps();
    this.wallSteps();
    if (this.units.some((u) => u.kind === "doors")) this.insideDoors();
    if (this.units.some((u) => u.kind === "drawers")) this.drawerSteps();
    if (this.units.some((u) => u.kind === "doors")) this.doorSteps();
    if (this.L.basin) this.basinSteps();
  }

  unit(kind: UKind, x: number, W: number): Unit {
    const { Hc: H, D, y0 } = this;
    const Wi = W - 2 * T;
    const zb = -D / 2 + BACK_IN + 8;
    const sideL = this.part("Side panel", [T, H, D], [x - W / 2 + T / 2, y0 + H / 2, 0]);
    const sideR = this.part("Side panel", [T, H, D], [x + W / 2 - T / 2, y0 + H / 2, 0]);
    const backTop = this.part("Back rail", [Wi, 150, 16], [x, y0 + H - 75, zb]);
    const lowH = Math.round(H * 0.4);
    const backLow = this.part("Lower back board", [Wi, lowH, 16], [x, y0 + lowH / 2, zb]);
    const strip = this.part("Bottom front rail", [Wi, 18, 60], [x, y0 + 9, D / 2 - T - GAP - 30]);
    const rail = this.part("Suspension rail", [Wi - 20, 40, 10], [x, y0 + H - 150, -D / 2 + 6], { material: "metal" });
    const u: Unit = { kind, x, W, Wi, H, D, y0, sideL, sideR, backTop, backLow, strip, rail, shelves: [], drawers: [], doors: [] };
    const zFront = D / 2 - T; // behind the fronts
    if (kind === "drawers") {
      const h1 = Math.round((H - 2 * GAP - GAP) * 0.46);
      const h2 = H - 3 * GAP - h1;
      const lo2 = y0 + GAP, lo1 = y0 + GAP + h2 + GAP;
      const midY = lo2 + h2 + GAP / 2;
      const z0 = zb + 8, z1 = D / 2 - 60;
      u.mid = this.part("Middle shelf", [Wi, 16, z1 - z0], [x, midY, (z0 + z1) / 2]);
      u.shelves.push({ key: u.mid, y: midY - 8, z0, z1, spacer: true });
      const dd = D - T - BACK_IN - 16 - 20;
      for (const [lo, h] of [[lo1, h1], [lo2, h2]] as const) u.drawers.push(this.drawer(u, lo, h, dd, zFront));
    } else {
      u.topRail = this.part("Top front rail", [Wi, 60, T], [x, y0 + H - 30, zFront - GAP - T / 2]);
      const dh = H - 2 * GAP;
      const dw = (Wi - 2 * GAP - 3) / 2;
      const ys = [y0 + GAP + 90, y0 + H - GAP - 90];
      for (const sx of [-1, 1] as const) {
        const dx = x + sx * (dw / 2 + 1.5);
        u.doors.push({ key: this.panel("Door", dw, dh, T, [dx, y0 + H / 2, D / 2 - T / 2]), sx, x: dx, dw, ys });
      }
      // three shelves: low and full, narrow at the back under the rail, full in the middle
      const zIn = zb + 8, zOut = zFront - GAP - T - 10;
      const shelf = (name: string, y: number, z0: number, z1: number, spacer: boolean) => {
        const key = this.part(name, [Wi - 2, 16, z1 - z0], [x, y + 8, (z0 + z1) / 2]);
        u.shelves.push({ key, y, z0, z1, spacer });
      };
      shelf("Shelf", y0 + 36, zIn, zOut, false);
      shelf("Narrow shelf", y0 + H - 150 - 40, zIn, zIn + 170, false);
      shelf("Shelf", y0 + Math.round(H * 0.46), zIn, zOut, true);
    }
    return u;
  }

  drawer(u: Unit, lo: number, h: number, dd: number, zFront: number): Drawer {
    const fw = u.Wi - 2 * GAP;
    const st = 12;
    const bw = u.Wi - 26;
    const xs = bw / 2 - st / 2;
    const ys = lo + 22;
    const sh = h - 62;
    const zF = zFront, zB = zFront - dd;
    const zc = (zF + zB) / 2;
    const front = this.panel("Drawer front", fw, h, T, [u.x, lo + h / 2, u.D / 2 - T / 2]);
    const sideT = [st, sh, dd] as Vec3;
    const sides = [-1, 1].map((g) => this.part("Drawer side", sideT, [u.x + g * xs, ys + sh / 2, zc])) as [string, string];
    const back = this.part("Drawer back", [bw - 2 * st, sh, st], [u.x, ys + sh / 2, zB + st / 2]);
    const bottom = this.part("Drawer bottom", [bw - 2 * st, 8, dd - st], [u.x, ys + 4, zc + st / 2]);
    const support = u.W >= 750 ? this.part("Bottom support", [20, 12, dd - 60], [u.x, ys - 6, zc], { material: "metal" }) : undefined;
    const nDiv = u.W >= 1000 ? 2 : u.W >= 600 ? 1 : 0;
    const dividers = Array.from({ length: nDiv }, (_, i) => this.part("Divider", [10, sh - 30, dd - st - 40], [u.x + (nDiv === 1 ? 0 : (i === 0 ? -1 : 1) * (bw / 6)), ys + 8 + (sh - 30) / 2, zc + st / 2]));
    return { front, sides, back, bottom, support, dividers, x: u.x, lo, h, fw, ys, sh, xs, zF, zB, zc, wires: u.W >= 600 ? 2 : 1 };
  }

  /* the frame */

  inX(u: Unit, sx: number) {
    return u.x + sx * (u.W / 2 - T);
  }

  side(u: Unit, sx: number) {
    return sx < 0 ? u.sideL : u.sideR;
  }

  prep(title: string, detail: string, body: () => void, o: { first?: boolean; tools?: StepDef["tools"] } = {}) {
    const b = this.b;
    this.step({ title, detail, kind: "screws", tools: o.tools ?? ["screwdriver"], scene: "prep", warnings: ["floor"] }, () => {
      if (o.first) {
        b.stagger(0.12);
        const n = this.units.length;
        this.units.forEach((u, i) => {
          const px = (i - (n - 1) / 2) * (this.Hc + 120);
          b.stage(u.sideL, [px, T / 2, -(this.D / 2 + 40)], [0, 0, Math.PI / 2], [0, 160, 0]);
          b.stage(u.sideR, [px, T / 2, this.D / 2 + 40], [0, 0, -Math.PI / 2], [0, 160, 0]);
        });
        b.then(0.15);
      }
      body();
    });
  }

  lowBrackets(u: Unit) {
    return [-1, 1].map((sx) => ({ sx, side: this.side(u, sx), at: [this.inX(u, sx), u.y0 + 60, -u.D / 2 + 14] as Vec3 }));
  }

  hangers(u: Unit) {
    return [-1, 1].map((sx) => ({ sx, side: this.side(u, sx), at: [this.inX(u, sx), u.y0 + u.H - 130, -u.D / 2 + 30] as Vec3 }));
  }

  frameSteps() {
    const b = this.b;
    const us = this.units;
    const each = this.many ? " Do the same for every frame." : "";
    this.prep(
      "Screw a small bracket onto each side",
      `Lay both sides on a rug, inside up. The bracket goes at the bottom back corner, two screws each.${each}`,
      () => {
        for (const u of us)
          for (const f of this.lowBrackets(u)) {
            b.fit(LOW_BRACKET, { on: f.side, at: f.at, dir: [f.sx, 0, 0], hole: false });
            b.fits(SMALL_SCREW, [-10, 10].map((dy) => ({ on: f.side, at: [f.at[0], f.at[1] + dy, f.at[2] + 10] as Vec3, dir: [f.sx, 0, 0] as Vec3 })), 0.06);
          }
      },
      { first: true },
    );
    this.prep("Screw the hanging brackets onto the sides", "One at the top back corner of each side, three screws each. The left and right brackets are mirror images.", () => {
      for (const u of us)
        for (const f of this.hangers(u)) {
          b.fit(HANGER, { on: f.side, at: f.at, dir: [f.sx, 0, 0], hole: false });
          b.fits(SMALL_SCREW, [[22, 0], [-22, 0], [0, 16]].map(([dy, dz]) => ({ on: f.side, at: [f.at[0], f.at[1] + dy, f.at[2] + dz] as Vec3, dir: [f.sx, 0, 0] as Vec3 })), 0.06);
        }
    });
    const doorUnits = us.filter((u) => u.kind === "doors");
    if (doorUnits.length)
      this.prep("Screw the hinge plates onto the sides", "Two on each side, near the front edge. Their screws are already in them.", () => {
        for (const u of doorUnits)
          for (const d of u.doors)
            for (const y of d.ys)
              b.fits(EURO, [-16, 16].map((dy) => ({ on: this.side(u, d.sx), at: [this.inX(u, d.sx), y + dy, u.D / 2 - T - 37] as Vec3, dir: [d.sx, 0, 0] as Vec3 })), 0.06);
      });

    this.step(
      { title: this.many ? "Click the back rails into one side of each frame" : "Click the back rail into one side", detail: "Stand the right side up on its bottom edge. Push the rail's pins into the slots and press it down until it clicks.", kind: "join", pose: "+y" },
      () => {
        b.stagger(0.2);
        for (const u of us) b.add(u.sideR, [0, 0, 0]);
        b.then(0.1);
        for (const u of us) b.add(u.backTop, [-200, 80, 0]);
      },
    );
    this.step({ title: "Hook in the lower back board", detail: "Its ends drop into the slots near the bottom of the side.", kind: "join" }, () => {
      b.stagger(0.2);
      for (const u of us) b.add(u.backLow, [-200, 80, 0]);
    });
    this.step({ title: "Click in the bottom front rail", detail: "Pins first, then press it down until it clicks.", kind: "join" }, () => {
      b.stagger(0.2);
      for (const u of us) b.add(u.strip, [-200, 60, 0]);
    });
    this.step({ title: "Press the other side on", detail: "Line up all the pins with the slots, then push it down evenly until everything clicks.", kind: "join" }, () => {
      b.stagger(0.25);
      for (const u of us) b.add(u.sideL, [-260, 0, 0]);
    });
    const topConn = (u: Unit) => [-1, 1].map((sx): FitOpts => ({ on: u.backTop, at: [this.inX(u, sx) - sx * 20, u.y0 + u.H, this.pos(u.backTop)[2]], dir: [0, -1, 0], hole: false }));
    const lowConn = (u: Unit) =>
      [-1, 1].flatMap((sx): FitOpts[] => [
        { on: u.strip, at: [this.inX(u, sx) - sx * 20, u.y0 + 18, this.pos(u.strip)[2]], dir: [0, -1, 0], hole: false },
        { on: u.backLow, at: [this.inX(u, sx) - sx * 20, this.pos(u.backLow)[1] + this.pos(u.backLow)[1] - u.y0, this.pos(u.backLow)[2] + 8], dir: [0, -1, 0], hole: false },
      ]);
    const top = () => this.step({ title: "Push in the connectors at the top", detail: "Two white ones, one at each end of the back rail. Use the white ones here, not the grey ones.", kind: "join" }, () => b.fits(TOP_CONNECTOR, us.flatMap(topConn), 0.12));
    const low = () => this.step({ title: "Push in the connectors at the bottom", detail: "Four grey ones, one at each end of the front rail and of the lower back board.", kind: "join" }, () => b.fits(BOTTOM_CONNECTOR, us.flatMap(lowConn), 0.1));
    // the drawers manual locks the top first, the doors manual the bottom
    if (us[0].kind === "drawers") {
      top();
      low();
    } else {
      low();
      top();
    }

    const drawerUnits = us.filter((u) => u.kind === "drawers");
    if (drawerUnits.length) {
      this.step(
        { title: "Rest the middle shelf on its supports", detail: "Screw a support with its spacer into each side, then tip the shelf in from the front and lay it on them.", kind: "shelves", tools: ["screwdriver"] },
        () => {
          for (const u of drawerUnits) {
            const sh = u.shelves[0];
            const z = sh.z0 + (sh.z1 - sh.z0) * 0.7;
            for (const sx of [-1, 1]) {
              b.fit(SPACER, { on: this.side(u, sx), at: [this.inX(u, sx), sh.y - 8, z], dir: [sx, 0, 0], hole: false });
              b.fit(SUPPORT, { on: this.side(u, sx), at: [this.inX(u, sx), sh.y - 8, z], dir: [sx, 0, 0] });
            }
          }
          b.then(0.15);
          for (const u of drawerUnits) b.add(u.mid!, [0, 60, 300]);
        },
      );
      const runners = (upper: boolean) => () => {
        for (const u of drawerUnits) {
          const d = u.drawers[upper ? 0 : 1];
          const len = Math.round((d.zF - d.zB - 20) / 10) * 10;
          for (const sx of [-1, 1]) {
            const side = this.side(u, sx);
            const at: Vec3 = [this.inX(u, sx), d.ys + 25, d.zc];
            if (upper) b.fit(RUNNER_PLATE, { on: side, at: [at[0], at[1], at[2] - len / 2 + 50], dir: [sx, 0, 0], hole: false });
            b.fit({ kind: "runner", len, dia: 40 }, { on: side, at, dir: [sx, 0, 0], hole: false });
            b.fits(RUNNER_SCREW, [-1, 1].map((k) => ({ on: side, at: [at[0], at[1], at[2] + k * (len / 2 - 40)] as Vec3, dir: [sx, 0, 0] as Vec3 })), 0.06);
          }
        }
      };
      this.step({ title: "Screw the lower runners onto the sides", detail: "Under the middle shelf, one on each side, two screws each. Front end flush with the front of the frame.", kind: "runners", tools: ["screwdriver"] }, runners(false));
      this.step({ title: "Screw on the upper runners with the spacer plates", detail: "Above the middle shelf. Press a plastic plate into the side first, then screw the runner over it.", kind: "runners", tools: ["screwdriver"] }, runners(true));
    }
    if (doorUnits.length) {
      this.step(
        { title: "Screw the plate onto the top front rail", detail: "Lay the rail flat. The small plate goes in the middle, two screws.", kind: "screws", tools: ["screwdriver"], scene: "prep" },
        () => {
          for (const [i, u] of doorUnits.entries()) {
            b.stage(u.topRail!, [i * (u.W + 100), T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
            b.then(0.1);
            const p = this.pos(u.topRail!);
            b.fit(PLATE, { on: u.topRail!, at: [p[0], p[1] + 30, p[2]], dir: [0, -1, 0], hole: false });
            b.fits(PLATE_SCREW, [-10, 10].map((dx) => ({ on: u.topRail!, at: [p[0] + dx, p[1] + 30, p[2]] as Vec3, dir: [0, -1, 0] as Vec3 })), 0.08);
          }
        },
      );
      this.step({ title: "Fit the top front rail", detail: "It goes across the top at the front, the plate facing up. One screw through each end into the sides.", kind: "screws", tools: ["screwdriver"] }, () => {
        for (const u of doorUnits) {
          b.add(u.topRail!, [0, 220, 0]);
          b.then(0.1);
          const p = this.pos(u.topRail!);
          b.fits(PLATE_SCREW, [-1, 1].map((sx) => ({ on: u.topRail!, at: [this.inX(u, sx) - sx * 25, p[1] + 30, p[2]] as Vec3, dir: [0, -1, 0] as Vec3, mate: this.side(u, sx) })), 0.1);
        }
      });
    }
    this.step({ title: "Check it's square", detail: "Measure both diagonals of the front; push the frame until they match.", kind: "square", tools: ["tape"], check: "square", warnings: ["square"] });
  }

  /* the wall */

  wallSteps() {
    const b = this.b;
    const us = this.units;
    const wide = us.reduce((a, u) => a + u.W, 0) >= 1000;
    this.step({
      title: this.many ? "Mark where the rails go" : "Mark where the rail goes",
      detail: "Hold the frame where it will hang. The top of the rail is 13 cm below the top of the frame and 7.5 cm in from each side. Level the line.",
      kind: "anchor",
      tools: ["pencil", "level", "tape"],
      wall: true,
      warnings: ["wall"],
    });
    this.step(
      {
        title: this.many ? "Screw the suspension rails to the wall" : "Screw the suspension rail to the wall",
        detail: "Two screws through the plastic inserts, one near each end. Wall screws and plugs aren't included: pick ones made for your wall. If you're unsure of the wall, add more screws along the rail.",
        kind: "anchor",
        tools: ["drill", "screwdriver", "level"],
        wall: true,
        warnings: ["wall"],
      },
      () => {
        b.stagger(0.2);
        for (const u of us) b.add(u.rail, [0, 0, 160]);
        b.then(0.1);
        for (const u of us) {
          const p = this.pos(u.rail);
          const xs = [-1, 1].map((sx) => u.x + sx * (u.Wi / 2 - 75));
          b.fits(HW.plug, xs.map((x) => ({ at: [x, p[1], -u.D / 2 - 30] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.08);
          b.fits(RAIL_INSERT, xs.map((x) => ({ on: u.rail, at: [x, p[1], p[2] + 5] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })), 0.08);
          b.fits(WALL_SCREW, xs.map((x) => ({ on: u.rail, at: [x, p[1], p[2] + 6] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.08);
        }
      },
    );
    if (this.L.legs) {
      const outer = [us[0], us[us.length - 1]];
      const legs: string[] = [];
      for (const [i, u] of outer.entries()) {
        const sx = i === 0 ? -1 : 1;
        for (const sz of [-1, 1]) legs.push(this.part("Leg", [40, this.L.legs, 40], [u.x + sx * (u.W / 2 - 20), this.L.legs / 2, sz * (u.D / 2 - 40)], { material: "metal" }));
      }
      this.step(
        { title: "Fit the legs under the outer sides", detail: "They come in their own box with their own screws and instructions. They carry the weight so the wall doesn't have to.", kind: "legs", tools: ["screwdriver"] },
        () => {
          b.stagger(0.2);
          for (const k of legs) b.add(k, [0, -200, 0]);
        },
      );
    }
    this.step(
      {
        title: this.many ? "Hang the frames on the rails" : "Hang the frame on the rail",
        detail: "Lift it so both hanging brackets hook over the rail. Turn the screw in each bracket with the Allen key to raise or lower it until it's level.",
        kind: "anchor",
        tools: ["allen", "level"],
        people: wide ? 2 : 1,
        wall: true,
        warnings: ["wall"],
      },
      () => {},
    );
    if (this.many)
      this.step(
        { title: "Screw the frames together", detail: "Two long screws through each pair of sides that touch, 4 cm in from the front edge: one near the top, one near the bottom.", kind: "screws", tools: ["screwdriver"] },
        () => {
          for (let i = 0; i < us.length - 1; i++) {
            const a = us[i], c = us[i + 1];
            b.fits(JOIN_SCREW, [a.y0 + a.H - 80, a.y0 + 80].map((y) => ({ on: a.sideR, at: [a.x + a.W / 2 - T, y, a.D / 2 - 40] as Vec3, dir: [1, 0, 0] as Vec3, mate: c.sideL })), 0.12);
          }
        },
      );
    this.step(
      { title: "Lock the hanging brackets to the rail", detail: "One short screw with a large washer through each bracket. Tighten them once it hangs level.", kind: "screws", tools: ["screwdriver"], wall: true },
      () => {
        for (const u of us)
          for (const f of this.hangers(u)) {
            const at: Vec3 = [f.at[0] - f.sx * 12, f.at[1] - 20, -u.D / 2 + 20];
            b.fit(WASHER, { on: f.side, at, dir: [0, 0, -1], hole: false });
            b.fit(LOCK_SCREW, { on: f.side, at: [at[0], at[1], at[2] + 1], dir: [0, 0, -1] });
          }
      },
    );
    this.step(
      { title: "Screw the bottom brackets to the wall", detail: "One screw with a washer through each small bracket. Wall screws and plugs aren't included.", kind: "anchor", tools: ["drill", "screwdriver"], wall: true, warnings: ["wall"] },
      () => {
        for (const u of us)
          for (const f of this.lowBrackets(u)) {
            const at: Vec3 = [f.at[0] - f.sx * 12, f.at[1], -u.D / 2 + 8];
            b.fit(HW.plug, { at: [at[0], at[1], -u.D / 2 - 30], dir: [0, 0, -1] });
            b.fit(WASHER, { on: f.side, at, dir: [0, 0, -1], hole: false });
            b.fit(WALL_SCREW, { on: f.side, at: [at[0], at[1], at[2] + 1], dir: [0, 0, -1] });
          }
      },
    );
  }

  /* shelves behind the doors */

  insideDoors() {
    const b = this.b;
    const us = this.units.filter((u) => u.kind === "doors");
    this.step({ title: "Screw the door stop onto the bottom rail", detail: "In the middle of the front rail, one screw. Both doors close against it.", kind: "screws", tools: ["screwdriver"] }, () => {
      for (const u of us) {
        const p = this.pos(u.strip);
        b.fit(DOOR_STOP, { on: u.strip, at: [u.x, u.y0 + 18, p[2] + 20], dir: [0, -1, 0], hole: false });
        b.fit(PLATE_SCREW, { on: u.strip, at: [u.x, u.y0 + 18, p[2] + 20], dir: [0, -1, 0] });
      }
    });
    const supports = (sh: Shelf, u: Unit) =>
      [-1, 1].flatMap((sx) => [sh.z0 + 40, sh.z1 - 40].map((z): FitOpts => ({ on: this.side(u, sx), at: [this.inX(u, sx), sh.y - 8, z], dir: [sx, 0, 0] })));
    const lay = (i: number, title: string, detail: string, withSupports: boolean) =>
      this.step({ title, detail, kind: "shelves", tools: withSupports ? ["screwdriver"] : [] }, () => {
        if (withSupports) for (const u of us) b.fits(SUPPORT, supports(u.shelves[i], u), 0.06);
        b.then(0.1);
        for (const u of us) b.add(u.shelves[i].key, [0, 40, 320]);
      });
    lay(0, "Screw in four supports and lay in the bottom shelf", "Into the lowest holes. The shelf rests on them, just above the front rail.", true);
    this.step({ title: "Screw in the supports for the other two shelves", detail: "Four high up at the back for the narrow shelf, and four with spacers in the middle for the deep one.", kind: "shelves", tools: ["screwdriver"] }, () => {
      for (const u of us) {
        b.fits(SUPPORT, supports(u.shelves[1], u), 0.06);
        const mid = supports(u.shelves[2], u);
        b.fits(SPACER, mid.map((o) => ({ ...o, hole: false as const })), 0.06);
        b.fits(SUPPORT, mid, 0.06);
      }
    });
    lay(1, "Lay in the narrow shelf", "At the back, under the rail. It leaves room in front for the water trap.", false);
    lay(2, "Lay in the middle shelf", "Tip it in from the front and lower it onto the supports with spacers.", false);
  }

  /* drawers, built face down, then clicked onto the runners */

  drawerSteps() {
    const b = this.b;
    const all = this.units.filter((u) => u.kind === "drawers").flatMap((u) => u.drawers.map((d) => ({ u, d })));
    const n = all.length;
    const { u: u0, d: d0 } = all[0];
    const c0: Vec3 = [d0.x, d0.lo + d0.h / 2, d0.zc];
    const fits = (u: Unit, d: Drawer) => {
      const xIn = d.xs - 6; // inside faces of the sides
      return {
        pads: [-1, 1].map((g): FitOpts => ({ on: d.front, at: [d.x + g * (d.fw / 2 - 30), d.lo + d.h - 25, d.zF], dir: [0, 0, 1], hole: false })),
        wires: (d.wires === 1 ? [0] : [-1, 1]).map((g): FitOpts => ({ on: d.front, at: [d.x + g * (d.fw / 4), d.ys + 14, d.zF], dir: [0, 0, -1] })),
        dowels: [-1, 1].flatMap((g) => [d.ys + d.sh * 0.3, d.ys + d.sh * 0.7].map((y): FitOpts => ({ on: d.sides[g < 0 ? 0 : 1], at: [d.x + g * (d.xs + 6), y, d.zB + 6], dir: [-g, 0, 0], mate: d.back }))),
        locks: [-1, 1].flatMap((g) => [d.ys + 30, d.ys + d.sh - 30].map((y): FitOpts => ({ on: d.back, at: [d.x + g * (xIn - 22), y, d.zB], dir: [0, 0, 1] }))),
        support: d.support ? [d.zF - 45, d.zB + 65, d.zB + 40].map((z, i): FitOpts => ({ on: d.support!, at: [d.x + (i === 0 ? 0 : i === 1 ? -4 : 4), d.ys - 12, z], dir: [0, 1, 0], mate: d.bottom })) : [],
        divWires: d.dividers.flatMap((k) => {
          const p = this.pos(k);
          return [p[2] - (d.zF - d.zB) / 2 + 60, p[2] + (d.zF - d.zB) / 2 - 60].map((z): FitOpts => ({ on: d.bottom, at: [p[0], d.ys + 8, z], dir: [0, -1, 0] }));
        }),
        u,
      };
    };
    const f0 = fits(u0, d0);
    const rep = n > 1 ? n : undefined;
    const dstep = (title: string, detail: string, body: () => void, x: { tools?: StepDef["tools"]; pose?: Pose; kind?: StepDef["kind"]; warnings?: StepDef["warnings"] } = {}) =>
      this.step({ title, detail, kind: x.kind ?? "drawer", tools: x.tools, scene: "drawer", pose: x.pose, repeat: rep, warnings: x.warnings }, body);
    dstep(
      "Lay a drawer front face down and stick on the bumpers",
      "On a rug, the inside facing up. A bumper in each top corner.",
      () => {
        this.stageRel(d0.front, c0, [0, 0, 200]);
        b.then(0.15);
        b.fits(BUMPER, f0.pads, 0.12);
      },
      { pose: "-z", warnings: ["floor", "face"] },
    );
    dstep(d0.wires === 1 ? "Press the wire clip into the front" : "Press the wire clips into the front", "Into the holes near the bottom edge, until they stop.", () => b.fits(WIRE, f0.wires, 0.12));
    dstep("Slide the sides onto the front", "Push each one down into its slots in the front.", () => {
      b.stagger(0.25);
      for (const k of d0.sides) this.stageRel(k, c0, [0, 0, -220]);
    });
    dstep("Slide the bottom down the grooves", "Smooth side inwards, all the way down to the front.", () => this.stageRel(d0.bottom, c0, [0, 0, -260]));
    dstep("Put the back on", "Hook it over the ends of the sides and press it down.", () => this.stageRel(d0.back, c0, [0, 0, -220]));
    dstep("Lock the back with the dowels and clips", "Push two plastic dowels through each side into the back, then turn the four clips to lock it.", () => {
      b.fits(DRAWER_DOWEL, f0.dowels, 0.08);
      b.then(0.1);
      b.fits(DRAWER_LOCK, f0.locks, 0.1);
    }, { tools: ["screwdriver"] });
    if (d0.support)
      dstep("Screw the support under the bottom", "Turn the drawer over. The metal support runs from front to back in the middle: one screw at the front, two at the back.", () => {
        this.stageRel(d0.support!, c0, [0, -160, 0]);
        b.then(0.1);
        b.fits(SUPPORT_SCREW, f0.support, 0.1);
      }, { tools: ["screwdriver"], pose: "-y", kind: "screws" });
    if (d0.dividers.length)
      dstep(d0.dividers.length > 1 ? "Put in the dividers" : "Put in the divider", "Turn it upright. Press the wires into the bottom, then drop the divider down over them.", () => {
        b.fits(WIRE, f0.divWires, 0.1);
        b.then(0.1);
        for (const k of d0.dividers) this.stageRel(k, c0, [0, 200, 0]);
      }, { pose: "+y" });
    this.step({ title: "Pull the runners out", detail: "Pull every runner out to its full length.", kind: "runners", pose: "+y" });
    this.step({ title: n > 1 ? "Set the drawers on the runners and push them in" : "Set the drawer on the runners and push it in", detail: "Rest the drawer on the runners, push it all the way in until it clicks at the back.", kind: "drawer" }, () => {
      for (const [i, { u, d }] of all.entries()) {
        b.stagger(0);
        for (const k of [d.back, ...d.sides, d.bottom, d.front, ...(d.support ? [d.support] : []), ...d.dividers]) b.add(k, [0, 0, 480]);
        if (i > 0) {
          const f = fits(u, d);
          const list: [HwDef, FitOpts[]][] = [
            [BUMPER, f.pads],
            [WIRE, [...f.wires, ...f.divWires]],
            [DRAWER_DOWEL, f.dowels],
            [DRAWER_LOCK, f.locks],
            [SUPPORT_SCREW, f.support],
          ];
          for (const [def, l] of list) for (const x of l) b.preset(def, x);
        }
        b.wait(0.22);
      }
    });
    this.step({ title: "Line up the fronts", detail: "Turn the wheels at the front of each runner to move a front up, down or sideways until the gaps are even.", kind: "drawer", tools: ["screwdriver"] });
  }

  /* doors */

  doorSteps() {
    const b = this.b;
    const list = this.units.filter((u) => u.kind === "doors").flatMap((u) => u.doors);
    const fz = this.D / 2 - T;
    this.step(
      { title: "Lay the doors face down and stick on the bumpers", detail: "On a rug. Two bumpers on each door, near the corners away from the hinges.", kind: "doors", scene: "doors", pose: "+y", warnings: ["floor", "face"] },
      () => {
        b.stagger(0.2);
        let off = 0;
        list.forEach((d) => {
          b.stage(d.key, [off + d.dw / 2, T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
          off += d.dw + 80;
        });
        b.then(0.1);
        b.fits(BUMPER, list.flatMap((d) => [d.ys[0] - 60, d.ys[1] + 60].map((y): FitOpts => ({ on: d.key, at: [d.x - d.sx * (d.dw / 2 - 20), y, fz], dir: [0, 0, 1], hole: false }))), 0.1);
      },
    );
    this.step({ title: "Press the hinges into the doors", detail: "Two on each door, in the round holes on the outer edge. Press the lever down to lock each one.", kind: "hinges", scene: "doors" }, () => {
      b.fits(HINGE, list.flatMap((d) => d.ys.map((y): FitOpts => ({ on: d.key, at: [d.x + d.sx * (d.dw / 2 - 22), y, fz], dir: [0, 0, 1], twist: d.sx > 0 ? Math.PI : 0 }))), 0.12);
    });
    this.step({ title: "Click the doors onto the hinge plates", detail: "Hook the end of each hinge arm onto its plate and press until it clicks.", kind: "doors", pose: "+y" }, () => {
      b.stagger(0.35);
      for (const d of list) b.add(d.key, [d.sx * 60, 0, 360]);
    });
    this.step({ title: "Line up the doors", detail: "The screws on each hinge move the door up and down, sideways, and in and out. Turn them until the gaps are even.", kind: "doors", tools: ["screwdriver"] });
  }

  /* the top: countertop and basin from their own boxes */

  basinSteps() {
    const b = this.b;
    const L = this.L;
    const s = this.s;
    const us = this.units;
    const Wt = Math.round(s.size.w * 10);
    const Dt = Math.round(s.size.d * 10);
    const yTop = this.y0 + this.Hc;
    const ct = L.counter ? 20 : 0;
    const rise = Math.max(40, Math.round(s.size.h * 10) - yTop - ct);
    const zt = -this.D / 2 + Dt / 2;
    const ub = us[L.over];
    let counter: string | undefined;
    if (L.counter) {
      const battens = (us.length === 1 ? [us[0]] : [us[0], us[us.length - 1]]).map((u) => ({ u, key: this.part("Batten", [u.Wi - 40, 40, 20], [u.x, yTop - 20, -u.D / 2 + 10], { material: "wood" }) }));
      counter = this.part("Countertop", [Wt, ct, Dt], [0, yTop + ct / 2, zt]);
      this.step(
        {
          title: battens.length > 1 ? "Screw the battens to the wall" : "Screw the batten to the wall",
          detail: "From the countertop's box. Level with the top of the frame, between the sides. Wall screws and plugs aren't included.",
          kind: "anchor",
          tools: ["drill", "screwdriver", "level"],
          wall: true,
          warnings: ["wall"],
        },
        () => {
          for (const { u, key } of battens) {
            b.add(key, [0, 0, 200]);
            b.then(0.1);
            const xs = [-1, 0, 1].map((k) => u.x + k * (u.Wi / 2 - 80));
            b.fits(HW.plug, xs.map((x) => ({ at: [x, yTop - 20, -u.D / 2 - 30] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.08);
            b.fits(WALL_SCREW, xs.map((x) => ({ on: key, at: [x, yTop - 20, -u.D / 2 + 20] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.08);
          }
        },
      );
      this.step(
        {
          title: "Lay the countertop on",
          detail: "Run silicone along the top edges of the sides and the batten first (silicone isn't included). Lower it on square, then weigh it down while the silicone sets.",
          kind: "join",
          people: Wt >= 1000 ? 2 : 1,
        },
        () => b.add(counter!, [0, 260, 0]),
      );
    }
    const yb = yTop + ct;
    let basin: string;
    if (L.basin === "one") {
      basin = this.compound(
        "Wash-basin",
        [
          { shape: "box", size: [Wt, rise - 20, Dt - 40], pos: [0, (rise - 20) / 2, 20] },
          { shape: "box", size: [Wt, rise, 40], pos: [0, rise / 2, -Dt / 2 + 20] },
        ],
        [0, yb, zt],
      );
      this.step(
        { title: "Lower the wash-basin on", detail: "It comes in its own box. Run silicone along the top edges of the frame, set it on square and seal the joint all round. Leave it a few hours to set.", kind: "join", people: 2 },
        () => b.add(basin, [0, 280, 0]),
      );
    } else if (L.basin === "semi") {
      const bw = 480, bd = 420;
      basin = this.part("Wash-basin", [bw, rise, bd], [ub.x, yb + rise / 2, zt + 20]);
      this.step({
        title: "Cut the hole for the basin",
        detail: "Tape the template from the basin's box onto the countertop where the basin goes, drill a hole in each corner and cut along the line with a jigsaw.",
        kind: "general",
        tools: ["pencil", "tape", "drill"],
      });
      this.step(
        { title: "Set the basin into the hole", detail: "Silicone round the cut edge, lower the basin in, then seal the joint. Leave it three hours before you use it.", kind: "join", people: 2 },
        () => b.add(basin, [0, 260, 0]),
      );
    } else {
      basin = this.part("Wash-basin", [420, rise, 420], [ub.x, yb + rise / 2, zt + 20], { shape: "cyl" });
      this.step(
        { title: "Set the basin on the countertop", detail: "Drill the hole for the waste where its own instructions show, then seal the basin down with silicone.", kind: "join", tools: ["drill"] },
        () => b.add(basin, [0, 240, 0]),
      );
    }
    if (L.tap) {
      const tap = this.part("Mixer tap", [40, 200, 40], [ub.x, yb + rise + 100, zt - Dt / 2 + 70], { material: "metal", shape: "cyl" });
      this.step({ title: "Fit the tap", detail: "It comes with its own instructions. Fix it in the basin's tap hole and connect its hoses before the water trap.", kind: "general", tools: ["wrench"] }, () => b.add(tap, [0, 200, 0]));
    }
    this.step(
      {
        title: "Fit the waste and the water trap",
        detail: "From their own boxes. If the pipe has to pass the back board, drill a 35 mm hole where the frame's instructions show. Get a plumber if you're unsure.",
        kind: "general",
        tools: ["wrench", "drill"],
      },
      () => b.fit(TRAP, { on: basin, at: [ub.x, yb, zt - 40], dir: [0, 1, 0], hole: false }),
    );
  }
}

/* ---------- wall, mirror and high cabinets ---------- */

interface CabKind {
  W: number;
  H: number;
  D: number;
  tall: boolean;
  doors: 1 | 2;
  mirror: boolean;
}

function cabOf(s: ProductSpec): CabKind | null {
  const slug = s.slug ?? "";
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10), D = Math.round(s.size.d * 10);
  if (/^tannforsen-high-cabinet-/.test(slug)) return { W, H, D, tall: true, doors: 1, mirror: false };
  if (/^tannforsen-wall-cabinet-door-/.test(slug)) return { W, H, D, tall: false, doors: 1, mirror: false };
  if (/^tannforsen-mirror-cabinet-doors-/.test(slug)) return { W, H, D, tall: false, doors: 2, mirror: true };
  return null;
}

function cabinet(b: PlanBuilder, s: ProductSpec, c: CabKind) {
  const t = new Tf(b, s);
  const { W, H, D, tall } = c;
  const ct = tall ? 18 : 16;
  const Dc = D - 20; // the box behind the doors
  const zc = -D / 2 + Dc / 2;
  const sideL = t.part("Side panel", [ct, H, D], [-W / 2 + ct / 2, H / 2, 0]);
  const sideR = t.part("Side panel", [ct, H, D], [W / 2 - ct / 2, H / 2, 0]);
  const Wi = W - 2 * ct;
  const top = t.part("Top and bottom", [Wi, ct, Dc], [0, H - ct / 2, zc]);
  const bottom = t.part("Top and bottom", [Wi, ct, Dc], [0, ct / 2, zc]);
  const yMid = tall ? Math.round(H * 0.3) : 0;
  const midShelf = tall ? t.part("Fixed shelf", [Wi, ct, Dc], [0, yMid, zc]) : undefined;
  const back = t.part("Back panel", [Wi, H - 2 * ct, 3], [0, H / 2, -D / 2 + 12], { material: "fiber" });
  const rail = t.part("Suspension rail", [Wi - 30, 40, 10], [0, H - 35 - 20, -D / 2 - 5], { material: "metal" });
  // the doors: inside the sides and the top and bottom, glass above the fixed shelf on the tall one
  const dh = H - 2 * ct - 2 * GAP;
  const dw = c.doors === 2 ? (Wi - 2 * GAP - 3) / 2 : Wi - 2 * GAP;
  const fz = D / 2 - 10;
  const hn = dh > 1200 ? 3 : 2;
  const hys = Array.from({ length: hn }, (_, i) => r(ct + GAP + 100 + ((dh - 200) * i) / (hn - 1)));
  const doorPieces = (glassFrom: number): PartPiece[] => {
    const fr = 60;
    if (!glassFrom && !c.mirror) return raised(dw, dh, 20);
    if (c.mirror)
      return [
        { shape: "box", size: [dw, dh, 20], pos: [0, 0, 0] },
        { shape: "box", size: [dw - 2 * fr, dh - 2 * fr, 4], pos: [0, 0, 11], material: "metal" },
      ];
    // stiles, rails and a solid panel below, glass between
    const lowH = glassFrom;
    const gh = dh - lowH - fr;
    return [
      { shape: "box", size: [fr, dh, 20], pos: [-dw / 2 + fr / 2, 0, 0] },
      { shape: "box", size: [fr, dh, 20], pos: [dw / 2 - fr / 2, 0, 0] },
      { shape: "box", size: [dw - 2 * fr, fr, 20], pos: [0, dh / 2 - fr / 2, 0] },
      { shape: "box", size: [dw - 2 * fr, lowH, 20], pos: [0, -dh / 2 + lowH / 2, 0] },
      ...[0, 1, 2].map((i): PartPiece => ({ shape: "box", size: [dw - 2 * fr, gh / 3 - 20, 4], pos: [0, -dh / 2 + lowH + (gh * (i + 0.5)) / 3, 0], material: "fiber" })),
      ...[1, 2].map((i): PartPiece => ({ shape: "box", size: [dw - 2 * fr, 20, 20], pos: [0, -dh / 2 + lowH + (gh * i) / 3, 0] })),
    ];
  };
  const doorName = c.mirror ? "Mirror door" : tall ? "Glass door" : "Door";
  const doors = (c.doors === 2 ? [-1, 1] : [1]).map((g) => {
    const sx = (c.doors === 2 ? g : -1) as -1 | 1;
    const x = c.doors === 2 ? g * (dw / 2 + 1.5) : 0;
    const key = t.compound(doorName, doorPieces(tall ? yMid - ct : 0), [x, H / 2, fz]);
    return { key, sx, x };
  });
  // shelves: one board under the fixed shelf on the tall one, glass ones above on supports
  const nGlass = tall ? 3 : 4;
  const g0 = tall ? yMid + ct / 2 : ct, g1 = H - ct;
  const glassYs = Array.from({ length: nGlass }, (_, i) => r(g0 + ((g1 - g0) * (i + 1)) / (nGlass + 1)));
  const glass = glassYs.map((y) => t.part("Glass shelf", [Wi - 4, 6, Dc - 30], [0, y + 3, zc], { material: "fiber" }));
  const lowShelfY = tall ? Math.round(yMid / 2) : 0;
  const lowShelf = tall ? t.part("Shelf", [Wi - 2, 16, Dc - 20], [0, lowShelfY + 8, zc]) : undefined;

  const prepSides = (title: string, detail: string, body: () => void, first = false) =>
    t.step({ title, detail, kind: "screws", tools: ["screwdriver"], scene: "prep", warnings: ["floor"] }, () => {
      if (first) {
        b.stagger(0.2);
        b.stage(sideL, [0, ct / 2, -(D / 2 + 40)], [0, 0, Math.PI / 2], [0, 160, 0]);
        b.stage(sideR, [0, ct / 2, D / 2 + 40], [0, 0, -Math.PI / 2], [0, 160, 0]);
        b.then(0.15);
      }
      body();
    });
  const inX = (sx: number) => sx * (W / 2 - ct);
  const side = (sx: number) => (sx < 0 ? sideL : sideR);
  const lowBr = [-1, 1].map((sx) => ({ sx, at: [inX(sx), tall ? 120 : ct + 50, -D / 2 + 14] as Vec3 }));
  const nLow = tall ? 2 : 1;
  const brackets = tall ? [...lowBr, ...[-1, 1].map((sx) => ({ sx, at: [inX(sx), H * 0.55, -D / 2 + 14] as Vec3 }))] : lowBr;
  prepSides(
    tall ? "Screw the small brackets onto the sides" : "Screw a small bracket onto each side",
    `Lay both sides on a rug, inside up. ${nLow === 2 ? "Two on each side, near the back edge" : "One near the bottom back corner"}, two screws each.`,
    () => {
      for (const f of brackets) {
        b.fit(LOW_BRACKET, { on: side(f.sx), at: f.at, dir: [f.sx, 0, 0], hole: false });
        b.fits(SMALL_SCREW, [-10, 10].map((dy) => ({ on: side(f.sx), at: [f.at[0], f.at[1] + dy, f.at[2] + 10] as Vec3, dir: [f.sx, 0, 0] as Vec3 })), 0.06);
      }
    },
    true,
  );
  prepSides(
    c.doors === 2 ? "Screw the hinge plates onto the sides" : "Screw the hinge plates onto one side",
    c.doors === 2 ? "Two on each side, at the front edge, two screws each." : "On the side the door will hang from, at the front edge, two screws each. Stop at the mark on the plate.",
    () => {
      for (const d of doors)
        for (const y of hys) b.fits(EURO, [-16, 16].map((dy) => ({ on: side(d.sx), at: [inX(d.sx), y + dy, D / 2 - 37] as Vec3, dir: [d.sx, 0, 0] as Vec3 })), 0.06);
    },
  );
  t.step(
    { title: tall ? "Click the top, bottom and fixed shelf into one side" : "Click the top and bottom into one side", detail: "On a rug, the side standing on its front edge. Push the pins into the slots and press each panel down until it clicks.", kind: "join", pose: "-z", warnings: ["floor"] },
    () => {
      b.add(sideR, [0, 0, 0]);
      b.then(0.1);
      b.stagger(0.25);
      for (const k of [top, bottom, ...(midShelf ? [midShelf] : [])]) b.add(k, [-200, 0, 80]);
    },
  );
  t.step({ title: "Press the other side on", detail: "Line up all the pins, then press it down evenly until everything clicks.", kind: "join", people: tall ? 2 : 1 }, () => b.add(sideL, [-260, 0, 0]));
  t.step({ title: "Slide in the back panel", detail: "From the top, down the grooves in the sides, white side in.", kind: "join" }, () => b.add(back, [0, H * 0.6, 0]));
  const pinPts = (tall ? [-0.35, 0.35] : [-0.3, 0.3]).flatMap((k) => [ct / 2, H - ct / 2, ...(tall ? [yMid] : [])].map((y): FitOpts => ({ on: back, at: [k * Wi, y, -D / 2 + 10], dir: [0, 0, 1] })));
  t.step({ title: "Pin the back to the top and bottom", detail: "Push each plastic sleeve through the back, then press its pin in to spread it.", kind: "join" }, () => b.fits(BACK_PIN, pinPts, 0.08));
  if (!tall)
    t.step({ title: "Check it's square and clip the back to the sides", detail: "Measure the diagonals first. Then press the clips over the back's edges by hand: no hammer.", kind: "square", check: "square", tools: ["tape"], warnings: ["square"] }, () =>
      b.fits(BACK_CLIP, [-1, 1].flatMap((sx) => [0.25, 0.5, 0.75].map((k): FitOpts => ({ on: back, at: [sx * (Wi / 2 - 10), H * k, -D / 2 + 10], dir: [0, 0, 1], hole: false }))), 0.08),
    );
  else {
    t.step({ title: "Check it's square", detail: "Measure both diagonals of the back; push the frame until they match.", kind: "square", check: "square", tools: ["tape"], warnings: ["square"] });
    t.step({ title: "Screw in the adjustable feet", detail: "Two, under the bottom at the front. Turn them down later to rest on the floor.", kind: "legs" }, () =>
      b.fits(FOOT, [-1, 1].map((sx): FitOpts => ({ on: bottom, at: [sx * (Wi / 2 - 40), 0, D / 2 - 60], dir: [0, 1, 0] })), 0.15),
    );
  }
  const hangAt = [-1, 1].map((sx) => ({ sx, at: [inX(sx), H - ct - 30, -D / 2 + 26] as Vec3 }));
  t.step({ title: "Click the hanging brackets into the top corners", detail: "Left and right are marked. Each one clicks into the holes at the back of the top.", kind: "join" }, () =>
    b.fits(HANGER, hangAt.map((f): FitOpts => ({ on: top, at: f.at, dir: [0, 0, -1], hole: false })), 0.2),
  );
  t.step({ title: "Screw the hanging brackets on", detail: "One screw each, into the top. Don't overtighten.", kind: "screws", tools: ["screwdriver"], warnings: ["hand"] }, () =>
    b.fits(CAB_SCREW, hangAt.map((f): FitOpts => ({ on: top, at: [f.at[0] - f.sx * 20, H - ct, f.at[2]], dir: [0, -1, 0] })), 0.15),
  );
  t.step({
    title: "Mark where the rail goes",
    detail: "Hold the cabinet where it will hang. The top of the rail is 3.5 cm below the top of the cabinet and 7.5 cm in from each side. Level the line.",
    kind: "anchor",
    tools: ["pencil", "level", "tape"],
    pose: "+y",
    wall: true,
    warnings: ["wall"],
  });
  t.step(
    {
      title: "Screw the suspension rail to the wall",
      detail: "Two screws through the plastic inserts. Wall screws and plugs aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "screwdriver", "level"],
      wall: true,
      warnings: ["wall"],
    },
    () => {
      b.add(rail, [0, 0, 160]);
      b.then(0.1);
      const p = t.pos(rail);
      const xs = [-1, 1].map((sx) => sx * (Wi / 2 - 75));
      b.fits(HW.plug, xs.map((x) => ({ at: [x, p[1], -D / 2 - 40] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.08);
      b.fits(RAIL_INSERT, xs.map((x) => ({ on: rail, at: [x, p[1], p[2] + 5] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })), 0.08);
      b.fits(WALL_SCREW, xs.map((x) => ({ on: rail, at: [x, p[1], p[2] + 6] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.08);
    },
  );
  t.step(
    { title: "Hang it on the rail", detail: "Hook both brackets over the rail. Turn the screw in each bracket with the Allen key until it hangs level.", kind: "anchor", tools: ["allen", "level"], people: tall ? 2 : 1, wall: true, warnings: tall ? ["wall", "tip"] : ["wall"] },
    () => {},
  );
  t.step({ title: "Lock it to the rail and fit the covers", detail: "A short screw with a washer through each bracket, then clip a cover over it.", kind: "screws", tools: ["screwdriver"], wall: true }, () => {
    for (const f of hangAt) {
      b.fit(WASHER, { on: top, at: [f.at[0] - f.sx * 14, f.at[1], -D / 2 + 20], dir: [0, 0, -1], hole: false });
      b.fit(LOCK_SCREW, { on: top, at: [f.at[0] - f.sx * 14, f.at[1], -D / 2 + 21], dir: [0, 0, -1] });
    }
    b.then(0.1);
    b.fits(COVER, hangAt.map((f): FitOpts => ({ on: f.sx < 0 ? sideL : sideR, at: [f.at[0] - f.sx * 20, f.at[1], -D / 2 + 40], dir: [-f.sx, 0, 0], hole: false })), 0.15);
  });
  t.step(
    { title: "Screw the bottom to the wall", detail: `A screw with a washer through ${brackets.length > 2 ? "each small bracket" : "both small brackets"}${tall ? ", then a cover over the top ones" : ""}. Wall screws and plugs aren't included.`, kind: "anchor", tools: ["drill", "screwdriver"], wall: true, warnings: ["wall"] },
    () => {
      for (const f of brackets) {
        const at: Vec3 = [f.at[0] - f.sx * 12, f.at[1], -D / 2 + 8];
        b.fit(HW.plug, { at: [at[0], at[1], -D / 2 - 40], dir: [0, 0, -1] });
        if (tall) b.fit(WASHER, { on: side(f.sx), at, dir: [0, 0, -1], hole: false });
        b.fit(WALL_SCREW, { on: side(f.sx), at: [at[0], at[1], at[2] + 1], dir: [0, 0, -1] });
      }
      if (tall) b.fits(COVER, brackets.slice(2).map((f): FitOpts => ({ on: side(f.sx), at: [f.at[0] - f.sx * 20, f.at[1], -D / 2 + 40], dir: [-f.sx, 0, 0], hole: false })), 0.15);
    },
  );
  const many = doors.length > 1;
  t.step(
    { title: many ? "Press the hinges into the doors" : "Press the hinges into the door", detail: "Lay it face down on the rug. Each hinge goes into its round hole; press the lever down to lock it.", kind: "hinges", scene: "doors", warnings: ["floor", "face"] },
    () => {
      b.stagger(0.2);
      let off = 0;
      for (const d of doors) {
        b.stage(d.key, [off + dw / 2, 10, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
        off += dw + 80;
      }
      b.then(0.1);
      b.fits(HINGE, doors.flatMap((d) => hys.map((y): FitOpts => ({ on: d.key, at: [d.x + d.sx * (dw / 2 - 22), y, fz - 10], dir: [0, 0, 1], twist: d.sx > 0 ? Math.PI : 0 }))), 0.12);
    },
  );
  t.step({ title: many ? "Click the doors onto the hinge plates" : "Click the door onto the hinge plates", detail: "Hook each hinge arm onto its plate and press until it clicks.", kind: "doors", people: tall ? 2 : 1 }, () => {
    b.stagger(0.35);
    for (const d of doors) b.add(d.key, [d.sx * 60, 0, 360]);
  });
  if (tall)
    t.step({ title: "Lay in the bottom shelf", detail: "Four supports into the holes under the fixed shelf, then the shelf on top of them.", kind: "shelves", tools: ["screwdriver"] }, () => {
      b.fits(SUPPORT, [-1, 1].flatMap((sx) => [zc - Dc / 2 + 40, zc + Dc / 2 - 40].map((z): FitOpts => ({ on: side(sx), at: [inX(sx), lowShelfY, z], dir: [sx, 0, 0] }))), 0.06);
      b.then(0.1);
      b.add(lowShelf!, [0, 40, 300]);
    });
  t.step(
    { title: "Click in the shelf supports and lay in the glass shelves", detail: `${nGlass * 4} supports, four for each shelf, click into the holes. Lay each glass shelf on its four.`, kind: "shelves" },
    () => {
      b.fits(GLASS_SUPPORT, glassYs.flatMap((y) => [-1, 1].flatMap((sx) => [zc - Dc / 2 + 30, zc + Dc / 2 - 30].map((z): FitOpts => ({ on: side(sx), at: [inX(sx), y, z], dir: [sx, 0, 0] })))), 0.04);
      b.then(0.1);
      b.stagger(0.2);
      for (const k of glass) b.add(k, [0, 30, 300]);
    },
  );
  const stops = c.doors === 2 ? [-1, 1].map((g): FitOpts => ({ on: g < 0 ? bottom : top, at: [0, g < 0 ? ct : H - ct, D / 2 - 30], dir: [0, g, 0], hole: false })) : (tall ? [0.2, 0.5, 0.8] : [0.25, 0.75]).map((k): FitOpts => ({ on: sideR, at: [inX(1), H * k, D / 2 - 30], dir: [1, 0, 0], hole: false }));
  t.step({ title: "Press in the door stops", detail: c.doors === 2 ? "One at the front of the bottom, one at the top. The doors close against them." : "Into the holes at the front of the side opposite the hinges.", kind: "doors" }, () => b.fits(CAB_STOP, stops, 0.12));
  t.step({ title: many ? "Line up the doors" : "Line up the door", detail: "The screws on each hinge move the door up and down, sideways, and in and out.", kind: "doors", tools: ["screwdriver"] });
}

const family: Family = {
  names: ["TÄNNFORSEN"],
  build(b, s) {
    const c = cabOf(s);
    if (c) {
      cabinet(b, s, c);
      return true;
    }
    const L = layoutOf(s);
    if (!L) return false;
    new WashStand(b, s, L).build();
    return true;
  },
};
export default family;
