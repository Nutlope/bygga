import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";

/**
 * SEKTION, read from the base, wall and high cabinet frame manuals and the MAXIMERA drawer, UTRUSTA hinge and
 * reinforced rail manuals sold with them. The frame: cam bolts go into both sides and the suspension fittings into
 * the top back corners, the bottom (and on a wall or high cabinet the top) go onto one side on dowels and are locked
 * with cam locks, the back slides into its grooves before the other side closes it. Square it up, a nail in three
 * corners, two plastic brackets at the top, then nails all along. A base cabinet gets two rails across the top
 * instead of a top (ventilated ones under a sink), a high cabinet a fixed shelf on connectors. It hangs on a
 * suspension rail on the wall (sold separately), the fittings are adjusted and their covers clicked on. Shelves sit
 * on pins; doors hang on UTRUSTA hinges, pressed into the door and clipped onto plates screwed to the sides; MAXIMERA
 * drawers are built on the floor, clicked onto their fronts and pushed onto runners screwed into the frame.
 * Corner cabinets and the cabinets for a fridge or built-in appliances keep their old guides for now.
 */

const T = 16;
const G = 10; // back groove, in from the back edge
const DT = 19; // front thickness
const DGAP = 3; // between fronts

interface Cab {
  base: boolean;
  W: number;
  H: number;
  D: number; // frame depth
  zb: number;
  doors: { x: number; w: number; hingeLeft: boolean }[];
  glass: boolean;
  shelves: number;
}

function cabOf(s: ProductSpec): Cab | null {
  const c = s.cabinet;
  if (s.archetype !== "cabinet" || !c || c.corner || c.fit || c.drawers || /MAXIMERA/i.test(s.name)) return null;
  const v = s.variant.toLowerCase();
  const base = /^base cabinet/.test(v);
  const wall = /^wall cabinet/.test(v);
  if (!base && !wall) return null;
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10);
  if (base && H !== 760) return null;
  const Dp = Math.round(s.size.d * 10);
  const nd = Math.max(0, Math.min(2, c.doors ?? 0));
  const D = Dp - (nd ? DT + 1 : 0);
  const zb = -Dp / 2;
  const doors = Array.from({ length: nd }, (_, i) => ({ x: nd === 1 ? 0 : (i === 0 ? -1 : 1) * (W / 4), w: W / nd - 3, hingeLeft: nd === 1 || i === 0 }));
  return { base, W, H, D, zb, doors, glass: /glass/.test(v), shelves: Math.max(0, Math.round(c.shelves ?? 0)) };
}

const named = (b: PlanBuilder, def: HwDef, name: string) => {
  const t = b.hw.get(b.hwType(def));
  if (t) t.name = name;
  return def;
};

class Kit {
  private types = new Map<string, string>();
  constructor(public b: PlanBuilder) {}
  part(name: string, size: Vec3, pos: Vec3, o: { material?: PartMaterial; pieces?: PartPiece[]; extra?: boolean; shape?: "box" | "cyl"; rot?: Vec3 } = {}) {
    const k = `${name}|${size.map(Math.round).join("x")}|${o.pieces ? JSON.stringify(o.pieces) : ""}`;
    let ref = this.types.get(k);
    if (!ref) {
      ref = this.b.part(name, size, { material: o.material ?? "board", extra: o.extra, shape: o.shape });
      if (o.pieces) this.b.parts[this.b.parts.length - 1].pieces = o.pieces;
      this.types.set(k, ref);
    }
    return this.b.place(ref, pos, o.rot);
  }
  step(
    o: { title: string; detail: string; kind: StepKind; tools?: ToolId[]; pose?: Pose; people?: 1 | 2; scene?: string; warnings?: WarnId[]; wall?: boolean; check?: "square"; repeat?: number },
    body: () => void,
  ) {
    this.b.step({ ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  }
  fits(def: HwDef, list: FitOpts[]) {
    if (!list.length) return;
    this.b.fits(def, list, Math.min(0.08, 2.4 / list.length));
    this.b.then(0.1);
  }
}

const many = (n: number, one: string, more: string) => (n === 1 ? one : more);

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const c = cabOf(s);
  if (!c) return false;
  const k = new Kit(b);
  const { base, W, H, D, zb } = c;
  const Wi = W - 2 * T;
  const zc = zb + D / 2;
  const dd = D - G;
  const zp = zc + G / 2;
  const what = base ? "base cabinet" : "wall cabinet";

  const sideL = k.part("Side", [T, H, D], [-W / 2 + T / 2, H / 2, zc]);
  const sideR = k.part("Side", [T, H, D], [W / 2 - T / 2, H / 2, zc]);
  const bottom = k.part("Bottom", [Wi, T, dd], [0, T / 2, zp]);
  const top = base ? "" : k.part("Top", [Wi, T, dd], [0, H - T / 2, zp]);
  const RW = 90;
  const railF = base ? k.part("Top rail", [Wi, T, RW], [0, H - T / 2, zb + D - RW / 2]) : "";
  const railB = base ? k.part("Top rail", [Wi, T, RW], [0, H - T / 2, zb + G + RW / 2]) : "";
  const back = k.part("Back panel", [Wi + 12, H - 4, 3], [0, H / 2, zb + G - 1.5], { material: "fiber" });

  // joints: three bolts, dowels and cam locks for each end of a base cabinet's bottom, two for a wall cabinet's top and bottom
  const zs = base ? [zp - dd / 2 + 60, zp, zp + dd / 2 - 60] : [zp - dd / 2 + 50, zp + dd / 2 - 50];
  const pieces = base ? [bottom] : [bottom, top];
  const yOf = (p: string) => (p === bottom ? T / 2 : H - T / 2);
  const bolts = (sx: number): FitOpts[] => pieces.flatMap((p) => zs.map((z) => ({ on: sx < 0 ? sideL : sideR, at: [(sx * Wi) / 2, yOf(p), z + 20] as Vec3, dir: [sx, 0, 0] as Vec3, mate: p })));
  const dowels = (sx: number): FitOpts[] => pieces.flatMap((p) => zs.map((z) => ({ on: p, at: [(sx * Wi) / 2, yOf(p), z - 20] as Vec3, dir: [-sx, 0, 0] as Vec3 })));
  const cams = (sx: number): FitOpts[] =>
    pieces.flatMap((p) => zs.map((z) => ({ on: p, at: [sx * (Wi / 2 - 24), p === bottom ? T : H - T, z + 20] as Vec3, dir: [0, p === bottom ? -1 : 1, 0] as Vec3 })));

  // the suspension fittings sit in the top corners at the back, inside the sides
  const ySus = H - 50, zSus = zb + G + 25;
  const sus = [-1, 1].map((sx) => ({ on: sx < 0 ? sideL : sideR, at: [(sx * Wi) / 2, ySus, zSus] as Vec3, dir: [sx, 0, 0] as Vec3 }));
  const SUS = () => named(b, { kind: "bracket", len: 50, dia: 45 }, "Suspension fitting");

  // laid flat inside up (pose "-x"): the side that joins last keeps its own turn, so its bolts point the way it travels
  k.step({ title: "Screw the cam bolts into both sides", detail: "Lay the sides flat with the holes up and turn the bolts in until they stop.", kind: "cams", tools: ["screwdriver"], scene: "sides", pose: "-x", warnings: ["floor"] }, () => {
    b.stagger(0.15);
    [sideL, sideR].forEach((key, i) => b.stage(key, [0, H / 2, (i - 0.5) * (D + 120)], key === sideL ? [0, Math.PI, 0] : [0, 0, 0]));
    b.then(0.15);
    k.fits(HW.camScrew, [...bolts(-1), ...bolts(1)]);
  });
  k.step({ title: "Screw the suspension fittings into the sides", detail: "One in the top back corner of each side, three screws in each.", kind: "screws", tools: ["screwdriver"], scene: "sides", pose: "-x" }, () => {
    k.fits(SUS(), sus);
    k.fits({ kind: "screw", len: 12, dia: 4 }, sus.flatMap((p) => [-14, 0, 14].map((dz) => ({ ...p, at: [p.at[0], p.at[1] - (dz ? 22 : -22), p.at[2] + dz] as Vec3 }))));
  });
  const pose: Pose = "-z";
  k.step(
    { title: base ? "Tap dowels into the bottom and join it to one side" : "Tap dowels into the top and bottom and join them to one side", detail: "Lay the side on its front edge on a rug. Dowels in, then push the panels onto the cam bolts.", kind: "dowels", tools: ["hammer"], pose, warnings: ["floor"] },
    () => {
      b.add(sideL, [0, 0, 0]);
      b.then(0.15);
      k.fits(HW.dowel, dowels(-1));
      for (const p of pieces) b.add(p, [360, 0, 0]);
    },
  );
  k.step({ title: "Turn the cam locks", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", kind: "cams", tools: ["screwdriver"], pose }, () => k.fits(HW.cam, cams(-1)));
  k.step({ title: "Slide in the back panel", detail: "Into the grooves, smooth side to the inside, from the open end.", kind: "join", pose }, () => b.add(back, [Math.min(900, W + 200), 0, 0]));
  k.step({ title: "Tap in the other dowels and fit the other side", detail: "Line every dowel and bolt up with its hole and press the side on evenly.", kind: "dowels", tools: ["hammer"], pose, people: H > 900 ? 2 : 1 }, () => {
    k.fits(HW.dowel, dowels(1));
    b.add(sideR, [420, 0, 0]);
  });
  k.step({ title: "Turn the other cam locks", detail: "The same way as on the first side.", kind: "cams", tools: ["screwdriver"], pose }, () => k.fits(HW.cam, cams(1)));
  if (base)
    k.step({ title: "Screw in the top rails", detail: "One at the front and one at the back, a screw down through each end into the top of the side. Click the clips onto the front rail first.", kind: "screws", tools: ["screwdriver"], pose }, () => {
      b.stagger(0.25);
      b.add(railF, [0, 0, -300]);
      b.add(railB, [0, 0, -300]);
      b.then(0.15);
      k.fits(named(b, { kind: "clip", len: 14, dia: 22 }, "Rail clip"), (W > 700 ? [-0.3, 0, 0.3] : [-0.25, 0.25]).map((t) => ({ on: railF, at: [t * Wi, H - T, zb + D - RW / 2] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })));
      k.fits(
        { kind: "screw", len: 40, dia: 5 },
        [railF, railB].flatMap((r) => [-1, 1].map((sx) => ({ on: sx < 0 ? sideL : sideR, at: [(sx * (Wi + T)) / 2, H, r === railF ? zb + D - RW / 2 : zb + G + RW / 2] as Vec3, dir: [0, -1, 0] as Vec3, mate: r }))),
      );
    });
  // square it, a nail in three corners, then nails along the bottom and the top
  const upper = base ? railB : top;
  const corners: Vec3[] = [[-Wi / 2 + 20, T / 2, zb + G - 3], [Wi / 2 - 20, T / 2, zb + G - 3], [Wi / 2 - 20, H - T / 2, zb + G - 3]];
  const nail = (at: Vec3, mate: string): FitOpts => ({ on: back, at, dir: [0, 0, 1], mate, hole: false });
  k.step({ title: "Square it up and nail one corner", detail: "Both diagonals the same length. One nail in the bottom corner.", kind: "nails", tools: ["hammer"], pose, check: "square" }, () => k.fits(HW.nail, [nail(corners[0], bottom)]));
  k.step({ title: "Nail the other bottom corner", detail: "Keep the back pushed tight to the edge.", kind: "nails", tools: ["hammer"], pose }, () => k.fits(HW.nail, [nail(corners[1], bottom)]));
  k.step({ title: "Nail the top corner", detail: "Check it is still square before you do.", kind: "nails", tools: ["hammer"], pose }, () => k.fits(HW.nail, [nail(corners[2], upper)]));
  const along = (y: number, mate: string, n: number) => Array.from({ length: n }, (_, i) => nail([-Wi / 2 + 60 + ((Wi - 120) * i) / Math.max(1, n - 1), y, zb + G - 3], mate));
  k.step({ title: "Nail the back all along", detail: "Nine more nails, along the bottom and the top.", kind: "nails", tools: ["hammer"], pose }, () => k.fits(HW.nail, [...along(T / 2, bottom, 5), ...along(H - T / 2, upper, 4)]));

  // the suspension rail is sold separately, screwed level to the wall
  const rail = k.part("Suspension rail (not included)", [W + 60, 40, 8], [0, ySus + 10, zb - 4], { material: "metal", extra: true });
  k.step(
    { title: "Hang it on the suspension rail", detail: `Screw the rail level to the wall first (rail and wall screws aren't included). Then lift the ${what} so both fittings hook over it.`, kind: "anchor", tools: ["drill", "screwdriver", "level", "pencil"], wall: true, people: H > 900 ? 2 : 1, warnings: H > 900 ? ["two", "wall"] : ["wall"] },
    () => {
      b.add(rail, [0, 0, -200]);
      b.then(0.15);
      const xs = W > 700 ? [-W / 3, 0, W / 3] : [-W / 4, W / 4];
      k.fits(HW.plug, xs.map((x) => ({ on: rail, at: [x, ySus + 10, zb - 8] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })));
      k.fits(HW.wallScrew, xs.map((x) => ({ on: rail, at: [x, ySus + 10, zb - 6] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })));
    },
  );
  k.step({ title: "Adjust the suspension fittings", detail: "Turn the two screws to raise it level and pull it tight to the wall.", kind: "screws", tools: ["screwdriver", "level"] }, () =>
    k.fits(named(b, { kind: "screw", len: 30, dia: 5 }, "Adjusting screw"), sus.map((p) => ({ ...p, at: [p.at[0] - Math.sign(p.at[0]) * 2, p.at[1] + 10, p.at[2] + 12] as Vec3, hole: false as const }))),
  );
  k.step({ title: "Click on the covers", detail: "One over each suspension fitting.", kind: "general" }, () =>
    k.fits(named(b, { kind: "cap", len: 6, dia: 40 }, "Fitting cover"), sus.map((p) => ({ ...p, at: [p.at[0] - Math.sign(p.at[0]) * 8, p.at[1], p.at[2]] as Vec3, dir: [-p.dir[0], 0, 0] as Vec3, hole: false as const }))),
  );

  // shelves on pins, spread evenly
  if (c.shelves) {
    const ys = Array.from({ length: c.shelves }, (_, i) => Math.round(T + ((H - 2 * T) * (i + 1)) / (c.shelves + 1)));
    const sd = dd - 20;
    const zs2 = zb + D - sd / 2 - 6;
    const shelves = ys.map((y) => k.part("Shelf", [Wi - 2, T, sd], [0, y, zs2]));
    const pins = ys.flatMap((y) => [-1, 1].flatMap((sx) => [zs2 - sd / 2 + 40, zs2 + sd / 2 - 40].map((z) => ({ on: sx < 0 ? sideL : sideR, at: [(sx * Wi) / 2, y - T / 2, z] as Vec3, dir: [sx, 0, 0] as Vec3, hole: false as const }))));
    k.step({ title: "Push in the shelf pins", detail: "Four for each shelf, at the same height on both sides.", kind: "shelves" }, () => k.fits(HW.pin, pins));
    k.step({ title: many(c.shelves, "Lay the shelf on the pins", "Lay the shelves on the pins"), detail: "Slide it in from the front until it rests on all four.", kind: "shelves" }, () => {
      b.stagger(0.25);
      for (const key of shelves) b.add(key, [0, 0, 420]);
    });
  }

  // doors on UTRUSTA hinges
  const n = c.doors.length;
  if (n) {
    const dh = H - 3;
    const zd = zb + D + 1 + DT / 2;
    const nh = dh > 1500 ? 4 : dh > 1100 ? 3 : 2;
    const hys = Array.from({ length: nh }, (_, i) => Math.round(1.5 + 100 + ((dh - 200) * i) / (nh - 1)));
    const fw = 60;
    const keys = c.doors.map((d) => {
      const pieces: PartPiece[] | undefined = c.glass
        ? [
            { shape: "box", size: [fw, dh, DT], pos: [-d.w / 2 + fw / 2, 0, 0] },
            { shape: "box", size: [fw, dh, DT], pos: [d.w / 2 - fw / 2, 0, 0] },
            { shape: "box", size: [d.w - 2 * fw, fw, DT], pos: [0, dh / 2 - fw / 2, 0] },
            { shape: "box", size: [d.w - 2 * fw, fw, DT], pos: [0, -dh / 2 + fw / 2, 0] },
          ]
        : undefined;
      return k.part(c.glass ? "Glass door" : "Door", [d.w, dh, DT], [d.x, 1.5 + dh / 2, zd], { pieces });
    });
    const hx = (d: Cab["doors"][number]) => (d.hingeLeft ? d.x - d.w / 2 + 22 : d.x + d.w / 2 - 22);
    const zBack = zd - DT / 2;
    const hinges: FitOpts[] = c.doors.flatMap((d, i) => hys.map((y) => ({ on: keys[i], at: [hx(d), y, zBack] as Vec3, dir: [0, 0, 1] as Vec3, twist: d.hingeLeft ? 0 : Math.PI })));
    k.step({ title: "Press the hinges into " + many(n, "the door", "the doors"), detail: "Lay it face down on a rug. Open each hinge, press its cup into the hole and push the lever down to lock it.", kind: "hinges", scene: "doors", warnings: ["floor"] }, () => {
      b.stagger(0.15);
      keys.forEach((key, i) => b.stage(key, [(i - (n - 1) / 2) * (c.doors[i].w + 90), DT / 2, 0], [Math.PI / 2, 0, 0]));
      b.then(0.15);
      k.fits(HW.hinge, hinges);
    });
    const plates = c.doors.flatMap((d) => hys.map((y) => ({ on: d.hingeLeft ? sideL : sideR, at: [d.hingeLeft ? -Wi / 2 : Wi / 2, y, zb + D - 37] as Vec3, dir: [d.hingeLeft ? -1 : 1, 0, 0] as Vec3 })));
    k.step({ title: "Screw the mounting plates to the " + many(n, "side", "sides"), detail: "Into the front holes, level with the hinges. Their screws come fitted.", kind: "hinges", tools: ["screwdriver"] }, () =>
      k.fits(named(b, { kind: "plate", len: 10, dia: 42 }, "Mounting plate"), plates),
    );
    k.step({ title: many(n, "Clip the door onto the plates", "Clip the doors onto the plates"), detail: "Hook each hinge over its plate and press until it clicks. Turn the hinge screws until the gaps are even.", kind: "doors", tools: ["screwdriver"] }, () => {
      b.stagger(0.3);
      for (const key of keys) b.add(key, [0, 0, 360]);
    });
  }
  return true;
}

/* ---------- high cabinets, sink cabinets, MAXIMERA drawer cabinets, wall cabinets with drawers ---------- */

type Kind = "base" | "wall" | "high";
type DSize = "low" | "medium" | "high";
/** One row of fronts, from the bottom up; heights in inches of the frame, as SEKTION fronts are sold. */
type Row =
  | { kind: "doors"; inch: number; n: number; shelves?: number }
  | { kind: "drawer"; inch: number; inner?: boolean }
  | { kind: "front"; inch: number } // a fixed front on two brackets
  | { kind: "apron"; inch: number } // left open for the front of an apron sink
  | { kind: "lift"; inch: number }; // a door that lifts up, on two hinge mechanisms

interface Layout {
  kind: Kind;
  W: number;
  H: number;
  D: number;
  rows: Row[];
  fixed: number[]; // fixed shelves of a high cabinet, as a share of its height
  sink: boolean; // ventilated rails across the top
  use?: "sink" | "apron" | "hob" | "fridge" | "appliance";
  nails?: number; // along the back, after the corners and brackets
  grille?: "shelf" | "bottom"; // a ventilation grille at the back of the fixed shelf, or under the front of a top cabinet
}

const drawers = (...inch: number[]): Row[] => inch.map((i) => ({ kind: "drawer", inch: i }));

function layoutOf(s: ProductSpec): Layout | null {
  const slug = s.slug ?? "";
  if (s.archetype !== "cabinet" || s.cabinet?.corner || /corner/.test(slug)) return null;
  const m = /([\d.]+) × ([\d.]+) × ([\d.]+) cm/.exec(s.variant);
  if (!m) return null;
  const [W, D0, H] = m.slice(1, 4).map((v) => Math.round(parseFloat(v) * 10));
  const D = D0 >= 500 ? 610 : 380;
  const two = /2-doors|2-glass/.test(slug);
  const sinkRails = /sink/.test(slug);
  const base = (rows: Row[], use?: Layout["use"]): Layout => ({ kind: "base", W, H, D, rows, fixed: [], sink: sinkRails, use });
  if (/^sektion-top-cabinet/.test(slug)) return { kind: "wall", W, H, D, rows: [{ kind: "lift", inch: 15 }], fixed: [], sink: false, nails: 10, grille: "bottom", use: "fridge" };
  if (/^sektion-high-cabinet/.test(slug)) {
    if (/fridge|freezer|built-in/.test(slug)) {
      const door = (inch: number): Row => ({ kind: "doors", inch, n: 1 });
      const rows = /built-in/.test(slug) ? [] : H < 2100 ? [door(30), door(25), door(25)] : [door(30), door(60)];
      return { kind: "high", W, H, D, rows, fixed: [0.77], sink: false, nails: 24, grille: "shelf", use: /built-in/.test(slug) ? "appliance" : "fridge" };
    }
    if (/shelves-2-doors/.test(slug)) return { kind: "high", W, H, D, rows: [{ kind: "doors", inch: 30, n: 1, shelves: 1 }, { kind: "doors", inch: 50, n: 1, shelves: 3 }], fixed: [30 / 80], sink: false };
    if (/^sektion-high-cabinet-\d+-x-\d+-x-[\d-]+$/.test(slug)) return { kind: "high", W, H, D, rows: [], fixed: [0.5], sink: false };
    return null;
  }
  if (/^sektion-(maximera-)?wall-cab/.test(slug) && /2-drawers|2-dra/.test(slug))
    return { kind: "wall", W, H, D, rows: [...drawers(5, 5), { kind: "doors", inch: 30, n: two ? 2 : 1, shelves: 1 }], fixed: [], sink: false };
  if (/havsen/.test(slug)) return base([{ kind: "doors", inch: 25, n: W > 700 ? 2 : 1 }, { kind: "apron", inch: 5 }], "apron");
  if (/tallsjon/.test(slug)) return base([{ kind: "doors", inch: 25, n: W > 700 ? 2 : 1 }, { kind: "front", inch: 5 }], "sink");
  if (/for-sink/.test(slug)) return base([{ kind: "doors", inch: 30, n: two ? 2 : 1 }], "sink");
  if (/drawer-door|drawer-2-doors/.test(slug)) return base([{ kind: "doors", inch: 20, n: two ? 2 : 1, shelves: 1 }, ...drawers(10)]);
  const hob = /cktp/.test(slug) ? "hob" : undefined;
  if (/2-fronts-3-draw/.test(slug)) return base([{ kind: "drawer", inch: 20, inner: true }, ...drawers(10)], hob);
  if (/3-fronts-3-draw/.test(slug)) return base(drawers(10, 10, 10), hob);
  if (/4-fronts-3-draw/.test(slug)) return base([...drawers(10, 10, 5), { kind: "front", inch: 5 }], hob);
  if (/maximera-base-cabinet-2-drawers/.test(slug)) return base(drawers(15, 15));
  if (/maximera-base-cabinet-3-drawers/.test(slug)) return base(W < 500 ? drawers(10, 10, 10) : drawers(15, 10, 5));
  if (/maximera-base-cabinet-4-drawers/.test(slug)) return base(drawers(10, 10, 5, 5));
  return null;
}

const SUS: HwDef = { kind: "bracket", len: 50, dia: 45, name: "Suspension fitting" };
const SUS_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const RAIL_SCREW: HwDef = { kind: "screw", len: 40, dia: 5 };
const EURO: HwDef = { kind: "screw", len: 11, dia: 5 }; // flat-head screws into the pre-drilled holes
const SMALL: HwDef = { kind: "screw", len: 15, dia: 3.5 };
const BACK_CLIP: HwDef = { kind: "clip", len: 16, dia: 22, name: "Back bracket" };
const RAIL_CLIP: HwDef = { kind: "clip", len: 14, dia: 22, name: "Rail clip" };
const CONNECTOR: HwDef = { kind: "pin", len: 14, dia: 8, name: "Shelf connector" };
const FRONT_FIT: HwDef = { kind: "connector", len: 40, dia: 24, name: "Front fitting" };
const FRONT_BRACKET: HwDef = { kind: "angle", len: 50, dia: 30, name: "Front bracket" };
const PLATE: HwDef = { kind: "plate", len: 10, dia: 42, name: "Mounting plate" };

interface Drawer {
  size: DSize;
  inner: boolean;
  lo: number;
  hi: number;
  front: string;
  sides: [string, string];
  back: string;
  bottom: string;
  rails: string[];
  yb: number; // underside of the box
  sh: number;
}

class Sek {
  k: Kit;
  b: PlanBuilder;
  L: Layout;
  W: number;
  H: number;
  D: number;
  Wi: number;
  n: number; // bolts and dowels at each joint
  zp: number; // centre of the top and bottom, in front of the back
  dd: number;
  fz: number; // centre of the fronts
  sideL: string;
  sideR: string;
  bottom: string;
  top?: string;
  back: string;
  rails: string[] = [];
  glass: boolean;
  what: string;
  tall: boolean;

  constructor(b: PlanBuilder, s: ProductSpec, L: Layout) {
    this.b = b;
    this.k = new Kit(b);
    this.L = L;
    const { W, H, D } = L;
    this.W = W;
    this.H = H;
    this.D = D;
    this.Wi = W - 2 * T;
    this.n = D >= 500 ? 3 : 2;
    this.dd = D - G;
    this.zp = G / 2;
    this.fz = D / 2 + 1 + DT / 2;
    this.glass = /glass/.test(s.slug ?? "");
    this.what = L.kind === "base" ? "base cabinet" : L.kind === "wall" ? "wall cabinet" : "high cabinet";
    this.tall = H > 1200;
    const k = this.k;
    this.sideL = k.part("Side", [T, H, D], [-W / 2 + T / 2, H / 2, 0]);
    this.sideR = k.part("Side", [T, H, D], [W / 2 - T / 2, H / 2, 0]);
    this.bottom = k.part("Bottom", [this.Wi, T, this.dd], [0, T / 2, this.zp]);
    if (L.kind !== "base") this.top = k.part("Top", [this.Wi, T, this.dd], [0, H - T / 2, this.zp]);
    this.back = k.part("Back panel", [this.Wi + 12, H - 4, 3], [0, H / 2, -D / 2 + G - 1.5], { material: "fiber" });
    if (L.kind === "base") {
      const name = L.sink ? "Ventilated rail" : "Rail";
      const h = L.sink ? 30 : 12;
      this.rails = [D / 2 - 40, -D / 2 + G + 40].map((z) => k.part(name, [this.Wi, h, 80], [0, H - h / 2, z], { material: "metal" }));
    }
  }

  side(sx: number) {
    return sx < 0 ? this.sideL : this.sideR;
  }

  /* ---------- the frame ---------- */

  panels() {
    return this.top ? [this.bottom, this.top] : [this.bottom];
  }
  yOf(p: string) {
    return p === this.bottom ? T / 2 : this.H - T / 2;
  }
  zs() {
    const { zp, dd } = this;
    return this.n === 3 ? [zp - dd / 2 + 60, zp, zp + dd / 2 - 60] : [zp - dd / 2 + 50, zp + dd / 2 - 50];
  }
  bolts(sx: number, only?: string): FitOpts[] {
    return this.panels().filter((p) => !only || p === only).flatMap((p) => this.zs().map((z) => ({ on: this.side(sx), at: [(sx * this.Wi) / 2, this.yOf(p), z + 20] as Vec3, dir: [sx, 0, 0] as Vec3, mate: p })));
  }
  dowels(sx: number, only?: string): FitOpts[] {
    return this.panels().filter((p) => !only || p === only).flatMap((p) => this.zs().map((z) => ({ on: p, at: [(sx * this.Wi) / 2, this.yOf(p), z - 20] as Vec3, dir: [-sx, 0, 0] as Vec3 })));
  }
  cams(sx: number, only?: string): FitOpts[] {
    return this.panels().filter((p) => !only || p === only).flatMap((p) =>
      this.zs().map((z) => ({ on: p, at: [sx * (this.Wi / 2 - 24), p === this.bottom ? T : this.H - T, z + 20] as Vec3, dir: [0, p === this.bottom ? -1 : 1, 0] as Vec3 })),
    );
  }
  sus() {
    const y = this.H - (this.top ? T : 0) - 50;
    const z = -this.D / 2 + G + 25;
    return [-1, 1].map((sx) => ({ on: this.side(sx), at: [(sx * this.Wi) / 2, y, z] as Vec3, dir: [sx, 0, 0] as Vec3 }));
  }
  susScrews() {
    return this.sus().flatMap((p) => [-14, 0, 14].map((dz) => ({ ...p, at: [p.at[0], p.at[1] + (dz ? -22 : 22), p.at[2] + dz] as Vec3 })));
  }
  fitSuspension() {
    this.k.fits(SUS, this.sus().map((p) => ({ ...p, hole: false as const })));
    this.k.fits(SUS_SCREW, this.susScrews());
  }

  frame() {
    const { b, k, L, W, H, D } = this;
    const base = L.kind === "base";
    const early = !base || D < 500; // a 60 cm deep base cabinet gets its suspension fittings last, standing up
    const nb = this.bolts(-1).length * 2;
    // laid flat inside up (pose "+x"): the side that joins last keeps its own turn, so its bolts point the way it travels
    k.step({ title: "Screw the cam bolts into both sides", detail: `${nb} in all. Lay the sides flat with the holes up and turn the bolts in until they stop.`, kind: "cams", tools: ["screwdriver"], scene: "sides", pose: "+x", warnings: ["floor"] }, () => {
      b.stagger(0.15);
      [this.sideL, this.sideR].forEach((key, i) => b.stage(key, [0, H / 2, (i - 0.5) * (D + 120)], key === this.sideR ? [0, Math.PI, 0] : [0, 0, 0]));
      b.then(0.15);
      k.fits(HW.camScrew, [...this.bolts(-1), ...this.bolts(1)]);
    });
    if (early)
      k.step({ title: "Screw a suspension fitting into each side", detail: "In the top back corner, three screws each. The hook faces the back.", kind: "screws", tools: ["screwdriver"], scene: "sides", pose: "+x" }, () => this.fitSuspension());

    const first: Pose = base ? "-z" : "-x";
    k.step(
      {
        title: base ? "Tap dowels into the bottom and join it to one side" : "Tap dowels into the top and bottom and stand them on one side",
        detail: base ? "Lay the side on its front edge on a rug. Dowels in, then push the bottom onto the cam bolts." : "That side lies flat on a rug, inside up. Dowels into the ends, then push the panels onto the cam bolts.",
        kind: "dowels",
        tools: ["hammer"],
        pose: first,
        warnings: ["floor"],
      },
      () => {
        b.add(this.sideR, [0, 0, 0]);
        b.then(0.15);
        k.fits(HW.dowel, this.dowels(1));
        b.stagger(0.25);
        for (const p of this.panels()) b.add(p, [-360, 0, 0]);
      },
    );
    k.step({ title: "Turn the cam locks", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", kind: "cams", tools: ["screwdriver"], pose: first }, () => k.fits(HW.cam, this.cams(1)));
    k.step({ title: "Slide in the back panel", detail: "Into the grooves, smooth side to the inside, from the open side.", kind: "join", pose: first }, () => b.add(this.back, [-Math.min(900, W + 200), 0, 0]));
    k.step(
      { title: "Tap in the other dowels and fit the other side", detail: "Line every dowel and bolt up with its hole and press the side on evenly.", kind: "dowels", tools: ["hammer"], pose: first, people: this.tall ? 2 : 1 },
      () => {
        k.fits(HW.dowel, this.dowels(-1));
        b.add(this.sideL, [-420, 0, 0]);
      },
    );
    k.step({ title: "Turn the other cam locks", detail: "The same way as on the first side.", kind: "cams", tools: ["screwdriver"], pose: first }, () => k.fits(HW.cam, this.cams(-1)));

    const pose: Pose = "-z";
    const [railF, railB] = this.rails;
    const railScrews = (r: string): FitOpts[] => {
      const z = this.b.partItem(r).final.pos[2];
      return [-1, 1].map((sx) => ({ on: this.side(sx), at: [(sx * (this.Wi + T)) / 2, H, z] as Vec3, dir: [0, -1, 0] as Vec3, mate: r }));
    };
    if (base && !L.sink)
      k.step({ title: "Click the clips onto the front rail and screw it on", detail: "Across the top at the front. One screw down through each end into the top of the side.", kind: "screws", tools: ["screwdriver"], pose }, () => {
        b.add(railF, [0, 300, 0]);
        b.then(0.15);
        k.fits(RAIL_CLIP, (W > 700 ? [-0.3, 0, 0.3] : W > 450 ? [-0.25, 0.25] : [0]).map((t) => ({ on: railF, at: [t * this.Wi, H, D / 2 - 40] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })));
        k.fits(RAIL_SCREW, railScrews(railF));
      });

    const zn = -D / 2 + G - 3;
    const nail = (at: Vec3, mate: string): FitOpts => ({ on: this.back, at, dir: [0, 0, 1], mate, hole: false });
    const upper = this.top ?? this.bottom;
    const yTop = this.top ? H - T / 2 : H - 30;
    const corners: [Vec3, string][] = [
      [[-this.Wi / 2 + 20, T / 2, zn], this.bottom],
      [[this.Wi / 2 - 20, T / 2, zn], this.bottom],
      [[this.Wi / 2 - 20, yTop, zn], this.top ?? this.sideR],
    ];
    k.step({ title: base ? "Square it up and nail one corner" : "Turn it onto its front, square it up and nail one corner", detail: "Both diagonals the same length. One nail in a bottom corner.", kind: "nails", tools: ["hammer", "tape"], pose, check: "square", warnings: ["square", "floor"] }, () =>
      k.fits(HW.nail, [nail(...corners[0])]),
    );
    k.step({ title: "Nail the other bottom corner", detail: "Keep the back pushed tight to the edge.", kind: "nails", tools: ["hammer"], pose }, () => k.fits(HW.nail, [nail(...corners[1])]));
    k.step({ title: "Nail the top corner", detail: "Check it is still square before you do.", kind: "nails", tools: ["hammer"], pose }, () => k.fits(HW.nail, [nail(...corners[2])]));
    const clips: Vec3[] = [-1, 1].map((sx) => [sx * (this.Wi / 2 - 40), yTop, zn]);
    k.step({ title: "Nail on the two plastic brackets at the top", detail: "One in each top corner of the back, a nail through each.", kind: "nails", tools: ["hammer"], pose }, () => {
      k.fits(BACK_CLIP, clips.map((p) => ({ on: this.back, at: p, dir: [0, 0, 1] as Vec3, hole: false as const })));
      k.fits(HW.nail, clips.map((p) => nail(p, this.top ?? (p[0] < 0 ? this.sideL : this.sideR))));
    });
    const nn = L.nails ?? (L.kind === "high" ? (D >= 500 ? 22 : 24) : 9);
    k.step({ title: "Nail the back all along", detail: `${nn} more nails, about a hand apart, into ${L.kind === "high" ? "the sides, the bottom and the top" : this.top ? "the bottom and the top" : "the bottom and the sides"}.`, kind: "nails", tools: ["hammer"], pose }, () => {
      const edges: [number, number, number, number, string][] = []; // x0, y0, x1, y1, mate
      edges.push([-this.Wi / 2 + 60, T / 2, this.Wi / 2 - 60, T / 2, this.bottom]);
      if (this.top) edges.push([-this.Wi / 2 + 60, H - T / 2, this.Wi / 2 - 60, H - T / 2, upper]);
      if (L.kind !== "wall") for (const sx of [-1, 1]) edges.push([(sx * (this.Wi + 8)) / 2, 150, (sx * (this.Wi + 8)) / 2, H - 150, this.side(sx)]);
      const lens = edges.map((e) => Math.hypot(e[2] - e[0], e[3] - e[1]));
      const total = lens.reduce((a, c) => a + c, 0);
      const counts = lens.map((l) => Math.max(1, Math.round((nn * l) / total)));
      for (let left = nn - counts.reduce((a, c) => a + c, 0), i = 0; left !== 0; i = (i + 1) % counts.length) {
        counts[i] += Math.sign(left);
        left -= Math.sign(left);
      }
      const list: FitOpts[] = [];
      edges.forEach((e, i) => {
        const c = counts[i];
        for (let j = 0; j < c; j++) {
          const t = c === 1 ? 0.5 : j / (c - 1);
          list.push(nail([e[0] + (e[2] - e[0]) * t, e[1] + (e[3] - e[1]) * t, zn], e[4]));
        }
      });
      k.fits(HW.nail, list);
    });

    if (L.grille === "bottom") {
      const g = k.part("Ventilation grille", [this.Wi, 10, 60], [0, T + 5, D / 2 - 40], { material: "metal" });
      k.step({ title: "Stand it up and screw the ventilation grille inside the front", detail: "On the bottom, along the front edge, one screw at each end. Warm air from the fridge rises through it.", kind: "screws", tools: ["screwdriver"], pose: "+y" }, () => {
        b.add(g, [0, 260, 0]);
        b.then(0.15);
        k.fits(SMALL, [-1, 1].map((sx) => ({ on: g, at: [sx * (this.Wi / 2 - 30), T + 10, D / 2 - 40] as Vec3, dir: [0, -1, 0] as Vec3, mate: this.bottom })));
      });
    }

    if (base) {
      if (L.sink)
        k.step({ title: "Stand it up and screw the ventilated rails across the top", detail: "One at the front and one at the back, a screw down through each end into the side.", kind: "screws", tools: ["screwdriver"], pose: "+y" }, () => {
          b.stagger(0.3);
          for (const r of this.rails) b.add(r, [0, 260, 0]);
          b.then(0.15);
          k.fits(RAIL_SCREW, this.rails.flatMap(railScrews));
        });
      else
        k.step({ title: "Stand it up and screw on the back rail", detail: "Across the top at the back, a screw down through each end into the side.", kind: "screws", tools: ["screwdriver"], pose: "+y" }, () => {
          b.add(railB, [0, 260, 0]);
          b.then(0.15);
          k.fits(RAIL_SCREW, railScrews(railB));
        });
      if (!early)
        k.step({ title: "Screw in the suspension fittings", detail: "One in each top back corner, three screws each. The hook faces the back.", kind: "screws", tools: ["screwdriver"], pose: "+y" }, () => this.fitSuspension());
    }
    this.hang();
  }

  hang() {
    const { b, k, W, D } = this;
    const sus = this.sus();
    const ySus = sus[0].at[1];
    const rail = k.part("Suspension rail (not included)", [W + 60, 40, 8], [0, ySus + 10, -D / 2 - 4], { material: "metal", extra: true });
    const legs = this.L.kind === "wall" ? "" : " Click its legs on first if you use them (sold separately).";
    k.step(
      {
        title: this.tall ? "Stand it up together and hang it on the suspension rail" : "Hang it on the suspension rail",
        detail: `Screw the rail level to the wall first (rail, wall screws and plugs aren't included).${legs} Then lift the ${this.what} so both fittings hook over it.`,
        kind: "anchor",
        tools: ["drill", "screwdriver", "level", "pencil"],
        pose: "+y",
        wall: true,
        people: this.tall || W > 700 ? 2 : 1,
        warnings: this.tall || W > 700 ? ["two", "wall"] : ["wall"],
      },
      () => {
        b.add(rail, [0, 0, -200]);
        b.then(0.15);
        const xs = W > 700 ? [-W / 3, 0, W / 3] : [-W / 4, W / 4];
        k.fits(HW.plug, xs.map((x) => ({ on: rail, at: [x, ySus + 10, -D / 2 - 8] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })));
        k.fits(HW.wallScrew, xs.map((x) => ({ on: rail, at: [x, ySus + 10, -D / 2 - 6] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })));
      },
    );
    k.step({ title: "Adjust the suspension fittings", detail: "Turn the two screws in each: one raises it level, the other pulls it tight to the wall.", kind: "screws", tools: ["screwdriver", "level"] }, () =>
      k.fits(named(b, { kind: "screw", len: 30, dia: 5 }, "Adjusting screw"), sus.map((p) => ({ ...p, at: [p.at[0] - Math.sign(p.at[0]) * 2, p.at[1] + 10, p.at[2] + 12] as Vec3, hole: false as const }))),
    );
    k.step({ title: "Click on the covers", detail: "One over each suspension fitting.", kind: "general" }, () =>
      k.fits(named(b, { kind: "cap", len: 6, dia: 40 }, "Fitting cover"), sus.map((p) => ({ ...p, at: [p.at[0] - Math.sign(p.at[0]) * 8, p.at[1], p.at[2]] as Vec3, dir: [-p.dir[0], 0, 0] as Vec3, hole: false as const }))),
    );
  }

  /* ---------- inside ---------- */

  rowsAt() {
    const total = this.L.rows.reduce((a, r) => a + r.inch, 0);
    let y = 0;
    return this.L.rows.map((r) => {
      const h = (this.H * r.inch) / total;
      const out = { r, lo: y, hi: y + h };
      y += h;
      return out;
    });
  }

  fixedShelves() {
    const { b, k, D } = this;
    const grille = this.L.grille === "shelf" ? 60 : 0; // the air behind an appliance rises through it
    const z0 = -D / 2 + G + grille, z1 = D / 2 - 10;
    for (const f of this.L.fixed) {
      const y = Math.round(this.H * f - T / 2);
      const key = k.part("Fixed shelf", [this.Wi, T, z1 - z0], [0, y, (z0 + z1) / 2]);
      const zs = this.n === 3 ? [z0 + 50, (z0 + z1) / 2, z1 - 50] : [z0 + 50, z1 - 50];
      const pins = [-1, 1].flatMap((sx) => zs.map((z) => ({ on: this.side(sx), at: [(sx * this.Wi) / 2, y - T / 2, z] as Vec3, dir: [sx, 0, 0] as Vec3, hole: false as const })));
      const g = grille ? k.part("Ventilation grille", [this.Wi, 10, grille], [0, y + T / 2 - 5, z0 - grille / 2], { material: "metal" }) : "";
      if (g) {
        k.step({ title: "Screw the ventilation grille onto the fixed shelf", detail: "Along its back edge, one screw at each end. Lay the shelf flat to do it.", kind: "screws", tools: ["screwdriver"], scene: "shelf", warnings: ["floor"] }, () => {
          const c: Vec3 = [0, y, 0];
          for (const key2 of [key, g]) {
            const pp = b.partItem(key2).final.pos;
            b.stage(key2, [pp[0] - c[0], pp[1] - c[1] + T / 2, pp[2] - c[2]], [0, 0, 0]);
          }
          b.then(0.15);
          k.fits(SMALL, [-1, 1].map((sx) => ({ on: g, at: [sx * (this.Wi / 2 - 30), y + T / 2, z0 - 8] as Vec3, dir: [0, -1, 0] as Vec3, mate: key })));
        });
      }
      k.step(
        { title: "Push in the shelf connectors and fit the fixed shelf", detail: `${pins.length} connectors, ${pins.length / 2} into each side at the same height${grille ? ", just above where the appliance ends" : ""}. Lower the shelf onto them${grille ? ", grille to the back" : ""} and turn them until they lock it.`, kind: "shelves", tools: ["screwdriver"] },
        () => {
          k.fits(CONNECTOR, pins);
          b.stagger(0);
          b.add(key, [0, 300, 0]);
          if (g) b.add(g, [0, 300, 0]);
        },
      );
    }
  }

  shelves() {
    const { b, k, D } = this;
    const ys: number[] = [];
    for (const { r, lo, hi } of this.rowsAt()) {
      if (r.kind !== "doors" || !r.shelves) continue;
      for (let i = 1; i <= r.shelves; i++) ys.push(Math.round(lo + ((hi - lo) * i) / (r.shelves + 1)));
    }
    if (!ys.length) return;
    const sd = this.dd - 20;
    const z = D / 2 - sd / 2 - 6;
    const keys = ys.map((y) => k.part(this.glass ? "Glass shelf" : "Shelf", [this.Wi - 2, this.glass ? 6 : T, sd], [0, y, z], { material: this.glass ? "glass" : "board" }));
    const pins = ys.flatMap((y) => [-1, 1].flatMap((sx) => [z - sd / 2 + 40, z + sd / 2 - 40].map((zz) => ({ on: this.side(sx), at: [(sx * this.Wi) / 2, y - (this.glass ? 3 : T / 2), zz] as Vec3, dir: [sx, 0, 0] as Vec3, hole: false as const }))));
    k.step({ title: "Push in the shelf pins", detail: "Four for each shelf, at the same height on both sides.", kind: "shelves" }, () => k.fits(HW.pin, pins));
    k.step({ title: many(ys.length, "Lay the shelf on the pins", "Lay the shelves on the pins"), detail: "Slide each one in from the front until it rests on all four.", kind: "shelves" }, () => {
      b.stagger(0.25);
      for (const key of keys) b.add(key, [0, 0, 420]);
    });
  }

  /** A fixed front: two brackets screwed into the sides, then the front screwed to them. */
  fixedFront(lo: number, hi: number) {
    const { b, k, W, D } = this;
    const fh = hi - lo - DGAP;
    const y = (lo + hi) / 2;
    const key = k.part("Front", [W - DGAP, fh, DT], [0, y, this.fz]);
    const br = [-1, 1].map((sx) => ({ on: this.side(sx), at: [(sx * this.Wi) / 2, y, D / 2 - 15] as Vec3, dir: [sx, 0, 0] as Vec3, hole: false as const }));
    k.step({ title: "Screw the two front brackets into the sides", detail: "Just behind the front edge, at the height of the front. Two screws each.", kind: "screws", tools: ["screwdriver"] }, () => {
      k.fits(FRONT_BRACKET, br);
      k.fits(EURO, br.flatMap((p) => [-12, 12].map((dy) => ({ ...p, at: [p.at[0], p.at[1] + dy, p.at[2] - 12] as Vec3, hole: undefined }))));
    });
    k.step({ title: "Screw the front onto the brackets", detail: "Hold it level with the top edge, then two screws through each bracket into its back.", kind: "screws", tools: ["screwdriver"] }, () => {
      b.add(key, [0, 0, 360]);
      b.then(0.15);
      k.fits(SMALL, br.flatMap((p) => [-12, 12].map((dy) => ({ on: key, at: [p.at[0] - Math.sign(p.at[0]) * 14, p.at[1] + dy, this.fz - DT / 2] as Vec3, dir: [0, 0, 1] as Vec3 }))));
    });
  }

  /** MAXIMERA drawers: each box built on the floor and clicked onto its front, runners into the frame. */
  drawers() {
    const { b, k, W, D } = this;
    const bw = this.Wi - 26;
    const dd = Math.max(250, Math.floor((D - 60) / 50) * 50);
    const zc = D / 2 - 2 - dd / 2;
    const list: Drawer[] = [];
    const box = (size: DSize, inner: boolean, lo: number, hi: number, yb: number, front: string): Drawer => {
      const sh = size === "low" ? 70 : 120;
      const sides = [-1, 1].map((sx) => k.part("Drawer side", [16, sh, dd], [sx * (bw / 2 - 8), yb + sh / 2, zc], { material: "metal" })) as [string, string];
      const back = k.part("Drawer back", [bw - 32, sh - 20, 16], [0, yb + 10 + (sh - 20) / 2, zc - dd / 2 + 10]);
      const bottom = k.part("Drawer bottom", [bw - 32, 10, dd - 4], [0, yb + 5, zc]);
      const rails =
        size === "low"
          ? []
          : (size === "high" ? [60, 140] : [60]).flatMap((dy) => [-1, 1].map((sx) => k.part("Gallery rail", [12, 12, dd - 20], [sx * (bw / 2 - 8), yb + sh + dy, zc + 8], { material: "metal" })));
      return { size, inner, lo, hi, front, sides, back, bottom, rails, yb, sh };
    };
    for (const { r, lo, hi } of this.rowsAt()) {
      if (r.kind !== "drawer") continue;
      const h = hi - lo;
      const size: DSize = h <= 150 ? "low" : h <= 300 ? "medium" : "high";
      const front = k.part("Drawer front", [W - DGAP, h - DGAP, DT], [0, (lo + hi) / 2, this.fz]);
      list.push(box(size, false, lo, hi, lo + 18, front));
      if (r.inner) {
        // an inner drawer behind the top of a tall front, with its own low front
        const ih = 100;
        const iy = hi - ih - 30;
        const ifront = k.part("Inner drawer front", [bw - 32, ih, T], [0, iy + ih / 2, zc + dd / 2 - T / 2]);
        list.push(box("low", true, iy, iy + ih, iy + 6, ifront));
      }
    }
    if (!list.length) return;
    const fitsOf = (d: Drawer) => {
      const z = d.inner ? b.partItem(d.front).final.pos[2] - T / 2 : this.fz - DT / 2;
      return [-1, 1].map((sx) => [sx * (bw / 2 - (d.inner ? 30 : 8)), d.yb + d.sh / 2, z] as Vec3);
    };
    const frontScrews = (d: Drawer) => fitsOf(d).flatMap((p) => [-1, 1].map((q) => ({ on: d.front, at: [p[0] + q * 12, p[1], p[2]] as Vec3, dir: [0, 0, 1] as Vec3 })));
    const bottomScrew = (d: Drawer): FitOpts => ({ on: d.bottom, at: [0, d.yb, zc - dd / 2 + 10], dir: [0, 1, 0], mate: d.back });
    const kinds = [...new Set(list.map((d) => `${d.size}${d.inner ? "-inner" : ""}`))];
    for (const kd of kinds) {
      const group = list.filter((d) => `${d.size}${d.inner ? "-inner" : ""}` === kd);
      const d0 = group[0];
      const scene = `drawer-${kd}`;
      const c0: Vec3 = [0, d0.yb + 80, zc];
      const rel = (key: string): Vec3 => {
        const p = b.partItem(key).final.pos;
        return [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
      };
      const rep = group.length > 1 ? group.length : undefined;
      const which = d0.inner ? " inner" : kinds.length > 1 ? ` ${d0.size}` : "";
      k.step({ title: `Click the back onto the${which} drawer sides`, detail: "Each end of the back hooks into a side with a click.", kind: "drawer", scene, repeat: rep, warnings: ["floor"] }, () => {
        b.stagger(0.25);
        for (const key of [...d0.sides, d0.back]) b.stage(key, rel(key), [0, 0, 0], [0, 0, -260]);
      });
      k.step({ title: "Slide the bottom in and screw it to the back", detail: "It runs in the grooves of the sides. One screw up through the bottom into the back.", kind: "drawer", tools: ["screwdriver"], scene, repeat: rep }, () => {
        b.stage(d0.bottom, rel(d0.bottom), [0, 0, 0], [0, 0, 420]);
        b.then(0.1);
        b.fit(SMALL, bottomScrew(d0));
      });
      k.step({ title: "Screw the front fittings on and click the front onto the drawer", detail: "One fitting at each end of the back of the front, two screws each. Then push the drawer onto them until both click.", kind: "drawer", tools: ["screwdriver"], scene, repeat: rep }, () => {
        b.stage(d0.front, rel(d0.front), [0, 0, 0], [0, 0, 300]);
        b.then(0.1);
        k.fits(FRONT_FIT, fitsOf(d0).map((p) => ({ on: d0.front, at: p, dir: [0, 0, 1] as Vec3, hole: false as const })));
        k.fits(EURO, frontScrews(d0));
      });
      if (d0.rails.length) {
        k.step({ title: d0.rails.length > 2 ? "Click the gallery rails on" : "Click the gallery rails on", detail: "Left and right are marked. Each one clicks into the front and the back.", kind: "drawer", scene, repeat: rep }, () => {
          b.stagger(0.25);
          for (const key of d0.rails) b.stage(key, rel(key), [0, 0, 0], [0, 200, 0]);
        });
        }
    }
    const runner: HwDef = { kind: "runner", len: dd, dia: 20 };
    k.step({ title: "Screw the runners into the cabinet", detail: "A pair for each drawer, front end flush with the frame, in the holes marked for its height. Two screws each.", kind: "runners", tools: ["screwdriver"] }, () => {
      const runners: FitOpts[] = [];
      const screws: FitOpts[] = [];
      for (const d of list)
        for (const sx of [-1, 1]) {
          const x = (sx * this.Wi) / 2;
          runners.push({ on: this.side(sx), at: [x, d.yb + 4, zc], dir: [sx, 0, 0], hole: false });
          for (const dz of [-dd / 2 + 40, dd / 2 - 30]) screws.push({ on: this.side(sx), at: [x - sx * 10, d.yb + 4, zc + dz], dir: [sx, 0, 0] });
        }
      k.fits(runner, runners);
      k.fits(EURO, screws);
    });
    k.step({ title: many(list.length, "Put the drawer on the runners", `Put the ${list.length} drawers on the runners`), detail: "Pull the runners out, rest each drawer on them and push it in until it clicks. Inner drawers first.", kind: "drawer" }, () => {
      const first = new Set(kinds.map((kd) => list.find((d) => `${d.size}${d.inner ? "-inner" : ""}` === kd)));
      const order = [...list.filter((d) => d.inner), ...list.filter((d) => !d.inner)];
      for (const d of order) {
        b.stagger(0);
        for (const key of [d.front, ...d.sides, d.back, d.bottom, ...d.rails]) b.add(key, [0, 0, 520]);
        if (!first.has(d)) {
          for (const p of fitsOf(d)) b.preset(FRONT_FIT, { on: d.front, at: p, dir: [0, 0, 1], hole: false });
          for (const o of frontScrews(d)) b.preset(EURO, o);
          b.preset(SMALL, bottomScrew(d));
        }
        b.wait(0.22);
      }
    });
  }

  doors() {
    const { b, k, W, D } = this;
    interface Door {
      key: string;
      x: number;
      w: number;
      lo: number;
      h: number;
      left: boolean;
      ys: number[];
    }
    const list: Door[] = [];
    for (const { r, lo, hi } of this.rowsAt()) {
      if (r.kind !== "doors") continue;
      const h = hi - lo - DGAP;
      const w = W / r.n - DGAP;
      const nh = h > 1500 ? 4 : h > 1100 ? 3 : 2;
      const ys = Array.from({ length: nh }, (_, i) => Math.round(lo + 100 + ((h - 200) * i) / (nh - 1)));
      for (let i = 0; i < r.n; i++) {
        const x = r.n === 1 ? 0 : (i === 0 ? -1 : 1) * (W / 4);
        const fw = 60;
        const pieces: PartPiece[] | undefined = this.glass
          ? [
              { shape: "box", size: [fw, h, DT], pos: [-w / 2 + fw / 2, 0, 0] },
              { shape: "box", size: [fw, h, DT], pos: [w / 2 - fw / 2, 0, 0] },
              { shape: "box", size: [w - 2 * fw, fw, DT], pos: [0, h / 2 - fw / 2, 0] },
              { shape: "box", size: [w - 2 * fw, fw, DT], pos: [0, -h / 2 + fw / 2, 0] },
              { shape: "box", size: [w - 2 * fw, h - 2 * fw, 4], pos: [0, 0, 0], material: "glass" },
            ]
          : undefined;
        const key = k.part(this.glass ? "Glass door" : "Door", [w, h, DT], [x, lo + DGAP / 2 + h / 2, this.fz], { pieces });
        list.push({ key, x, w, lo, h, left: r.n === 1 || i === 0, ys });
      }
    }
    if (!list.length) return;
    const n = list.length;
    const hx = (d: Door) => (d.left ? d.x - d.w / 2 + 22 : d.x + d.w / 2 - 22);
    k.step({ title: "Press the hinges into " + many(n, "the door", "the doors"), detail: "Lay it face down on a rug. Open each hinge, press its cup into the hole and push the lever down to lock it.", kind: "hinges", scene: "doors", warnings: ["floor", "face"] }, () => {
      b.stagger(0.15);
      let off = 0;
      for (const d of list) {
        b.stage(d.key, [off + d.w / 2, DT / 2, 0], [Math.PI / 2, 0, 0]);
        off += d.w + 90;
      }
      b.then(0.15);
      k.fits(HW.hinge, list.flatMap((d) => d.ys.map((y) => ({ on: d.key, at: [hx(d), y, this.fz - DT / 2] as Vec3, dir: [0, 0, 1] as Vec3, twist: d.left ? 0 : Math.PI }))));
    });
    const plates = list.flatMap((d) => d.ys.map((y) => ({ on: d.left ? this.sideL : this.sideR, at: [d.left ? -this.Wi / 2 : this.Wi / 2, y, D / 2 - 37] as Vec3, dir: [d.left ? -1 : 1, 0, 0] as Vec3 })));
    k.step({ title: "Screw the mounting plates to the " + many(new Set(list.map((d) => d.left)).size, "side", "sides"), detail: "Into the front holes, level with the hinges. Their screws come fitted.", kind: "hinges", tools: ["screwdriver"] }, () => k.fits(PLATE, plates));
    k.step(
      { title: many(n, "Clip the door onto the plates", "Clip the doors onto the plates"), detail: "Hook each hinge over its plate and press until it clicks. Turn the hinge screws until the gaps are even.", kind: "doors", tools: ["screwdriver"], people: list.some((d) => d.h > 1500) ? 2 : 1 },
      () => {
        b.stagger(0.3);
        for (const d of list) b.add(d.key, [0, 0, 360]);
      },
    );
  }

  /** A door that lifts up: a hinge mechanism screwed into each side, plates on the door, the door clicked onto the arms. */
  liftDoor() {
    const { b, k, W, D, H } = this;
    const row = this.rowsAt().find((x) => x.r.kind === "lift");
    if (!row) return;
    const h = row.hi - row.lo - DGAP;
    const key = k.part("Door", [W - DGAP, h, DT], [0, row.lo + DGAP / 2 + h / 2, this.fz]);
    const mech = [-1, 1].map((sx) => ({ on: this.side(sx), at: [(sx * this.Wi) / 2, H - T - 70, D / 2 - 110] as Vec3, dir: [sx, 0, 0] as Vec3, hole: false as const }));
    k.step({ title: "Screw a hinge mechanism into each side", detail: "Near the top front corner, three screws each. Keep them closed: the springs are strong.", kind: "hinges", tools: ["screwdriver"], warnings: ["hand"] }, () => {
      k.fits(named(b, { kind: "hinge", len: 120, dia: 60 }, "Lift-up hinge"), mech);
      k.fits(EURO, mech.flatMap((m) => [-30, 0, 30].map((dz) => ({ ...m, at: [m.at[0], m.at[1] - 40, m.at[2] + dz] as Vec3, hole: undefined }))));
    });
    const plates = [-1, 1].map((sx) => ({ on: key, at: [sx * (this.Wi / 2 - 30), H - 60, this.fz - DT / 2] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const }));
    k.step({ title: "Screw the two hinge plates onto the door", detail: "Lay it face down on a rug. One plate near each top corner, four screws each.", kind: "hinges", tools: ["screwdriver"], scene: "doors", warnings: ["floor", "face"] }, () => {
      b.stage(key, [0, DT / 2, 0], [Math.PI / 2, 0, 0]);
      b.then(0.15);
      k.fits(named(b, { kind: "plate", len: 10, dia: 50 }, "Hinge plate"), plates);
      k.fits(SMALL, plates.flatMap((p) => [-1, 1].flatMap((dx) => [-1, 1].map((dy) => ({ on: key, at: [p.at[0] + dx * 15, p.at[1] + dy * 12, p.at[2]] as Vec3, dir: [0, 0, 1] as Vec3 })))));
    });
    k.step({ title: "Lift the arms and click the door on", detail: "Raise both arms, hook the plates onto them and press until they click. Then adjust it level.", kind: "doors", tools: ["screwdriver"], people: 2, warnings: ["two", "hand"] }, () => b.add(key, [0, 0, 360]));
  }

  build() {
    this.frame();
    this.fixedShelves();
    this.drawers();
    this.shelves();
    for (const { r, lo, hi } of this.rowsAt()) if (r.kind === "front") this.fixedFront(lo, hi);
    this.doors();
    this.liftDoor();
    const use = this.L.use;
    if (use === "apron") this.k.step({ title: "Ready for the sink", detail: "The apron sink sits on the rails with its front over the open band at the top. Fit it, the tap and the drain following their own instructions.", kind: "general" }, () => {});
    else if (use === "sink") this.k.step({ title: "Ready for the sink", detail: "Fit the sink, tap and drain following their own instructions, or ask a plumber.", kind: "general" }, () => {});
    else if (use === "fridge") this.k.step({ title: "Ready for the fridge", detail: "Slide the fridge or freezer in and fix it following its own instructions. Its doors then join the cabinet doors with the connection hardware sold with it.", kind: "general" }, () => {});
    else if (use === "appliance") this.k.step({ title: "Ready for the appliances", detail: "Fit each one following its own instructions. Have a qualified electrician connect them.", kind: "general" }, () => {});
    else if (use === "hob") this.k.step({ title: "Ready for the cooktop", detail: "It goes in the countertop above. Have a qualified electrician connect it, or a gas fitter for gas.", kind: "general" }, () => {});
  }
}


/* ---------- the corner wall cabinet ---------- */

const FRAME_SCREW: HwDef = { kind: "screw", len: 50, dia: 7, name: "Frame screw" };
const LOCK_CLIP: HwDef = { kind: "clip", len: 20, dia: 25, name: "Locking clip" };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 10, name: "Bumper" };
const JOIN_SCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
const Q = Math.PI / 4;
const S2 = Math.SQRT2;
const r1 = (n: number) => Math.round(n * 10) / 10;

const dims = (s: ProductSpec) => {
  const m = /([\d.]+) × ([\d.]+) × ([\d.]+) cm/.exec(s.variant);
  return m ? m.slice(1, 4).map((v) => Math.round(parseFloat(v) * 10)) : null;
};

/**
 * SEKTION corner wall cabinet: its back corner goes into the corner of the room, an arm 38 cm deep along each wall ending
 * in a side panel, and one door across the diagonal front. The top and bottom are screwed to a narrow post that closes the
 * back corner, the sides go on with dowels and cams, the two backs slide into their grooves and are nailed, and it hangs
 * on a suspension rail on each wall. The corner is at the back left.
 */
function cornerWall(b: PlanBuilder, s: ProductSpec): boolean {
  const d = dims(s);
  if (!d) return false;
  const slug = s.slug ?? "";
  const k = new Kit(b);
  const [W, A, H] = d;
  const D = W;
  const x0 = -W / 2, z0 = -D / 2;
  const P1: Vec3 = [W / 2 - T, 0, z0 + A]; // front end of the right side's inner face
  const P2: Vec3 = [x0 + A, 0, D / 2 - T]; // front end of the front side's inner face
  const L = P1[0] - P2[0];
  const n: Vec3 = [1 / S2, 0, 1 / S2]; // out through the front
  const u: Vec3 = [1 / S2, 0, -1 / S2]; // along the front, towards the right side
  const M: Vec3 = [(P1[0] + P2[0]) / 2, 0, (P1[2] + P2[2]) / 2];

  /** The top, the bottom or a shelf: an arm along each wall and the triangle up to the diagonal front. */
  const slab = (i: number, th: number): PartPiece[] => {
    const xa = x0 + i, xb = W / 2 - T - i, za = z0 + i, zb = D / 2 - T - i;
    const c: Vec3 = [(xa + xb) / 2, 0, (za + zb) / 2];
    const pts: [number, number][] = [[xa, za], [xb, za], [xb, z0 + A - i], [x0 + A - i, zb], [xa, zb]];
    return [{ shape: "slab", size: [xb - xa, th, zb - za], pos: c, outline: pts.map(([x, z]) => [r1(x - c[0]), r1(z - c[2])] as [number, number]) }];
  };
  const slabs = new Map<string, { type: string; mid: Vec3 }>();
  const slabPart = (name: string, i: number, th: number, y: number, material?: PartMaterial) => {
    const key = `${name}|${i}|${th}`;
    let c = slabs.get(key);
    if (!c) {
      c = b.compound(name, slab(i, th), { material });
      slabs.set(key, c);
    }
    return b.place(c.type, [c.mid[0], y, c.mid[2]]);
  };

  const sideR = k.part("Side panel", [T, H, A], [W / 2 - T / 2, H / 2, z0 + A / 2]);
  const sideF = k.part("Side panel", [T, H, A], [x0 + A / 2, H / 2, D / 2 - T / 2], { rot: [0, Math.PI / 2, 0] });
  const bottom = slabPart("Top and bottom panel", 0, T, T / 2);
  const top = slabPart("Top and bottom panel", 0, T, H - T / 2);
  const pc: Vec3 = [x0 + 52, H / 2, z0 + 52];
  const post = k.part("Corner post", [130, H - 2 * T, T], pc, { rot: [0, Q, 0] });
  const backB = k.part("Back panel", [W, H, 3], [0, H / 2, z0 - 1.5], { material: "fiber" });
  const backL = k.part("Back panel", [W, H, 3], [x0 - 1.5, H / 2, 0], { material: "fiber", rot: [0, Math.PI / 2, 0] });

  // where the sides meet the top and bottom: two bolts and two dowels at each end of each side
  const joints = (side: string, yTop: boolean) => {
    const y = yTop ? H - T / 2 : T / 2;
    const right = side === sideR;
    const at = (f: number): Vec3 => (right ? [W / 2 - T, y, r1(z0 + A * f)] : [r1(x0 + A * f), y, D / 2 - T]);
    const out: Vec3 = right ? [1, 0, 0] : [0, 0, 1];
    const panel = yTop ? top : bottom;
    const cam = (p: Vec3): Vec3 => [p[0] - out[0] * 34, yTop ? H - T : T, p[2] - out[2] * 34];
    return {
      bolts: [0.3, 0.75].map((f): FitOpts => ({ on: side, at: at(f), dir: out, mate: panel })),
      cams: [0.3, 0.75].map((f): FitOpts => ({ on: panel, at: cam(at(f)), dir: [0, yTop ? 1 : -1, 0] })),
      dowels: [0.15, 0.9].map((f): FitOpts => ({ on: panel, at: at(f), dir: [-out[0], 0, -out[2]], mate: side })),
    };
  };
  const sus = [
    { side: sideR, at: [W / 2 - T, H - T - 45, z0 + 28] as Vec3, out: [1, 0, 0] as Vec3, along: [0, 0, 1] as Vec3 },
    { side: sideF, at: [x0 + 28, H - T - 45, D / 2 - T] as Vec3, out: [0, 0, 1] as Vec3, along: [1, 0, 0] as Vec3 },
  ];

  k.step({ title: "Screw the top and bottom to the corner post", detail: "Stand them on their back edges with the post between them, two frame screws through each into its ends. Use the Allen key.", kind: "screws", tools: ["allen"], pose: "+z", warnings: ["floor"] }, () => {
    b.add(post, [0, 0, 0]);
    b.then(0.1);
    b.stagger(0.3);
    b.add(bottom, [0, -200, 0]);
    b.add(top, [0, 200, 0]);
    b.then(0.1);
    const ends = [-30, 30].map((dd): Vec3 => [r1(pc[0] + dd * u[0]), 0, r1(pc[2] + dd * u[2])]);
    k.fits(FRAME_SCREW, [...ends.map((p): FitOpts => ({ on: top, at: [p[0], H, p[2]], dir: [0, -1, 0], mate: post })), ...ends.map((p): FitOpts => ({ on: bottom, at: [p[0], 0, p[2]], dir: [0, 1, 0], mate: post }))]);
  });
  k.step({ title: "Screw the cam bolts into both sides", detail: "Eight in all, four near the ends of each side's inner face. Turn them in until they stop.", kind: "cams", tools: ["screwdriver"], scene: "prep", warnings: ["floor"] }, () => {
    b.stagger(0.25);
    b.stage(sideR, [0, T / 2, -(A / 2 + 40)], [0, 0, -Math.PI / 2], [0, 160, 0]);
    b.stage(sideF, [0, T / 2, A / 2 + 40], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.then(0.15);
    k.fits(HW.camScrew, [sideR, sideF].flatMap((sd) => [false, true].flatMap((e) => joints(sd, e).bolts)));
  });
  k.step({ title: "Screw a suspension fitting onto each side", detail: "In the top back corner of each side, two screws each. The hook faces the back.", kind: "screws", tools: ["screwdriver"], scene: "prep" }, () => {
    k.fits(SUS, sus.map((f) => ({ on: f.side, at: f.at, dir: f.out, hole: false as const })));
    k.fits(EURO, sus.flatMap((f) => [-22, 22].map((dy) => ({ on: f.side, at: [f.at[0] - f.along[0] * 14, f.at[1] + dy, f.at[2] - f.along[2] * 14] as Vec3, dir: f.out }))));
  });
  for (const [i, side] of [sideR, sideF].entries()) {
    const j = [joints(side, false), joints(side, true)];
    const away: Vec3 = side === sideR ? [300, 0, 0] : [0, 0, 300];
    k.step({ title: i === 0 ? "Tap in the dowels and press one side on" : "Tap in the dowels and press the other side on", detail: "Two dowels into the top and two into the bottom at that end, then push the side onto them, bolts into the holes.", kind: "dowels", tools: ["hammer"], pose: "+z" }, () => {
      k.fits(HW.dowel, j.flatMap((x) => x.dowels));
      b.add(side, away);
    });
    k.step({ title: "Turn the cam locks", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls the side tight.", kind: "cams", tools: ["screwdriver"], pose: "+z" }, () => k.fits(HW.cam, j.flatMap((x) => x.cams)));
  }
  k.step({ title: "Turn it over and slide the backs in", detail: "Back up now. Each back runs in the grooves of the top and bottom, from its side panel to the post.", kind: "flip", pose: "-z", warnings: ["floor"] }, () => {
    b.stagger(0.35);
    b.add(backB, [0, 0, -260]);
    b.add(backL, [-260, 0, 0]);
  });
  const nailB = (x: number, y: number, on: string): FitOpts => ({ on: backB, at: [r1(x), r1(y), z0 - 3], dir: [0, 0, 1], mate: on, hole: false });
  const nailL = (z: number, y: number, on: string): FitOpts => ({ on: backL, at: [x0 - 3, r1(y), r1(z)], dir: [1, 0, 0], mate: on, hole: false });
  k.step({ title: "Square it up and nail one corner", detail: "Both diagonals the same length. One nail through the back into the bottom corner by the side.", kind: "nails", tools: ["hammer", "tape"], pose: "-z", check: "square", warnings: ["square"] }, () => k.fits(HW.nail, [nailB(W / 2 - T / 2, T / 2, sideR)]));
  k.step({ title: "Nail the other back at its bottom corner", detail: "Keep it square while you do.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => k.fits(HW.nail, [nailL(D / 2 - T / 2, T / 2, sideF)]));
  k.step({ title: "Nail a top corner", detail: "Check it is still square first.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => k.fits(HW.nail, [nailB(W / 2 - T / 2, H - T / 2, sideR)]));
  k.step({ title: "Nail on the four plastic brackets", detail: "One in each top and bottom corner by the post, one nail each. They hold the backs tight against the post.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => {
    const pts: FitOpts[] = [nailB(x0 + 130, 40, sideR), nailB(x0 + 130, H - 40, sideR), nailL(z0 + 130, 40, sideF), nailL(z0 + 130, H - 40, sideF)].map((p) => ({ ...p, mate: undefined }));
    k.fits(BACK_CLIP, pts);
    k.fits(HW.nail, pts.map((p, i) => ({ ...p, mate: i % 2 ? top : bottom, at: [p.at[0], i % 2 ? H - T / 2 : T / 2, p.at[2]] as Vec3 })));
  });
  k.step({ title: "Nail the backs to the post", detail: "Two nails through each back into the edge of the post, one high and one low.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => {
    k.fits(HW.nail, [H * 0.3, H * 0.7].flatMap((y) => [nailB(x0 + 92, y, post), nailL(z0 + 92, y, post)]));
  });

  // a suspension rail on each wall, the fittings hook over them
  const yr = H - T - 45;
  const railB = k.part("Suspension rail (not included)", [W, 40, 8], [0, yr, z0 - 3 - 4], { material: "metal", extra: true });
  const railL = k.part("Suspension rail (not included)", [W, 40, 8], [x0 - 3 - 4, yr, 0], { material: "metal", extra: true, rot: [0, Math.PI / 2, 0] });
  k.step(
    { title: "Screw a suspension rail to each wall and hang the cabinet on them", detail: "Level the rails at the same height into the corner, then lift the cabinet so both fittings hook over. Rails, wall screws and plugs aren't included.", kind: "anchor", tools: ["drill", "level", "pencil", "screwdriver"], pose: "+y", wall: true, people: H > 900 ? 2 : 1, warnings: H > 900 ? ["two", "wall"] : ["wall"] },
    () => {
      b.stagger(0.3);
      b.add(railB, [0, 0, -120]);
      b.add(railL, [-120, 0, 0]);
      b.then(0.1);
      const ends = [W / 2 - 60, 0];
      k.fits(HW.plug, [...ends.map((x) => ({ at: [x, yr, z0 - 11] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })), ...ends.map((z) => ({ at: [x0 - 11, yr, -z] as Vec3, dir: [-1, 0, 0] as Vec3, hole: false as const }))]);
      k.fits(HW.wallScrew, [...ends.map((x) => ({ on: railB, at: [x, yr, z0 - 3] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })), ...ends.map((z) => ({ on: railL, at: [x0 - 3, yr, -z] as Vec3, dir: [-1, 0, 0] as Vec3, hole: false as const }))]);
    },
  );
  k.step({ title: "Adjust the fittings and lock them", detail: "Turn the screws in both fittings to set the height and pull it tight to the walls, then push a locking clip into each.", kind: "screws", tools: ["screwdriver", "level"] }, () => {
    k.fits(LOCK_CLIP, sus.map((f) => ({ on: f.side, at: [f.at[0] - f.out[0] * 10, f.at[1] - 20, f.at[2] - f.out[2] * 10] as Vec3, dir: f.out, hole: false as const })));
  });

  // inside: UTRUSTA corner shelves on six pins each, or the carousel
  if (s.cabinet?.corner?.inner === "carousel") cornerCarousel(b, k, { cx: x0 + 270, cz: z0 + 270, H, top, bottom });
  else if (s.cabinet?.shelves) {
    const n2 = s.cabinet.shelves;
    const glass = /glass/.test(slug);
    const ys = Array.from({ length: n2 }, (_, i) => Math.round((T + ((H - 2 * T) * (i + 1)) / (n2 + 1)) / 32) * 32);
    const th = glass ? 6 : T;
    const keys = ys.map((y) => slabPart(glass ? "Glass shelf" : "Shelf", 12, th, y + th / 2, glass ? "glass" : undefined));
    k.step({ title: many(ys.length, "Push in the shelf pins and lay the shelf on", "Push in the shelf pins and lay the shelves on"), detail: "Six pins for each shelf, all at one height: two in each side and two in the post.", kind: "shelves" }, () => {
      const pins: FitOpts[] = [];
      for (const y of ys)
        pins.push(
          { on: sideR, at: [W / 2 - T, y, z0 + 70], dir: [1, 0, 0], hole: false },
          { on: sideR, at: [W / 2 - T, y, z0 + A - 50], dir: [1, 0, 0], hole: false },
          { on: sideF, at: [x0 + 70, y, D / 2 - T], dir: [0, 0, 1], hole: false },
          { on: sideF, at: [x0 + A - 50, y, D / 2 - T], dir: [0, 0, 1], hole: false },
          ...[-40, 40].map((dd): FitOpts => ({ on: post, at: [r1(pc[0] + dd * u[0] + 9 * n[0]), y, r1(pc[2] + dd * u[2] + 9 * n[2])], dir: [-n[0], 0, -n[2]], hole: false })),
        );
      k.fits(HW.pin, pins);
      b.stagger(0.3);
      for (const key of keys) b.add(key, [260, 0, 260]);
    });
  }

  // the door across the diagonal, hung on the right-hand side; the frame alone has none
  if (!/cabinet-66-x-37-5/.test(slug) && s.cabinet?.doors !== 0) {
    const dw = Math.floor((L * S2 - 10) / 10) * 10;
    const dh = H - DGAP;
    const fz = T / 2 + 2;
    const dc: Vec3 = [r1(M[0] + n[0] * fz), r1(dh / 2 + 1.5), r1(M[2] + n[2] * fz)];
    const glass = /glass/.test(slug);
    const fw = 60;
    const pieces: PartPiece[] | undefined = glass
      ? [
          { shape: "box", size: [fw, dh, DT], pos: [-dw / 2 + fw / 2, 0, 0] },
          { shape: "box", size: [fw, dh, DT], pos: [dw / 2 - fw / 2, 0, 0] },
          { shape: "box", size: [dw - 2 * fw, fw, DT], pos: [0, dh / 2 - fw / 2, 0] },
          { shape: "box", size: [dw - 2 * fw, fw, DT], pos: [0, -dh / 2 + fw / 2, 0] },
          { shape: "box", size: [dw - 2 * fw, dh - 2 * fw, 4], pos: [0, 0, 0], material: "glass" },
        ]
      : undefined;
    const door = k.part(glass ? "Glass door" : "Door", [dw, dh, DT], dc, { rot: [0, Q, 0], pieces });
    const hn = dh > 900 ? 3 : 2;
    const hys = Array.from({ length: hn }, (_, i) => r1(100 + ((dh - 200) * i) / (hn - 1)));
    const back = (kk: number, y: number): Vec3 => [r1(dc[0] + u[0] * kk - n[0] * DT / 2), y, r1(dc[2] + u[2] * kk - n[2] * DT / 2)];
    k.step({ title: "Press the hinges into the door", detail: `Lay it face down on a rug. ${hn} hinges along the edge that goes on the right-hand side; each clicks into its round hole.`, kind: "hinges", scene: "doors", warnings: ["floor", "face"] }, () => {
      b.stage(door, [0, DT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
      b.then(0.1);
      k.fits(HW.hinge, hys.map((y) => ({ on: door, at: back(dw / 2 - 22, y), dir: [-n[0], 0, -n[2]] as Vec3, twist: Math.PI })));
    });
    k.step({ title: "Screw the mounting plates to the right-hand side", detail: "One for each hinge, in the holes by the front edge. The door can hang on the other side instead: then the plates go there.", kind: "hinges", tools: ["screwdriver"] }, () => {
      const plates = hys.map((y) => ({ on: sideR, at: [W / 2 - T, y, z0 + A - 37] as Vec3, dir: [1, 0, 0] as Vec3, hole: false as const }));
      k.fits(PLATE, plates);
      k.fits(EURO, plates.map((p) => ({ ...p, at: [p.at[0], p.at[1] + 16, p.at[2]] as Vec3, hole: undefined })).slice(0, 2));
    });
    k.step({ title: "Clip the door onto the plates", detail: "Hook each hinge over its plate and press until it clicks. Turn the hinge screws until the gaps are even.", kind: "doors", tools: ["screwdriver"] }, () => b.add(door, [n[0] * 380, 0, n[2] * 380]));
    k.step({ title: "Stick on the bumpers", detail: "On the front edges of the top and bottom, by the left-hand side, where the door closes.", kind: "doors" }, () => {
      const e: Vec3 = [P2[0] + u[0] * 30, 0, P2[2] + u[2] * 30];
      k.fits(BUMPER, [
        { on: bottom, at: [r1(e[0]), T / 2, r1(e[2])], dir: [-n[0], 0, -n[2]], hole: false },
        { on: top, at: [r1(e[0]), H - T / 2, r1(e[2])], dir: [-n[0], 0, -n[2]], hole: false },
      ]);
    });
  }
  k.step({ title: "Screw it to the cabinet beside it", detail: "Once the next cabinet hangs level with it, four screws through the side near the hinge holes.", kind: "screws", tools: ["screwdriver"] }, () => {
    k.fits(JOIN_SCREW, [0.25, 0.75].flatMap((f) => [60, A - 60].map((z) => ({ on: sideR, at: [W / 2 - T, r1(H * f), r1(z0 + z)] as Vec3, dir: [1, 0, 0] as Vec3 }))));
  });
  return true;
}

/** UTRUSTA carousel: two shelves on a pole that turns in a bearing at the top and the bottom. */
function cornerCarousel(b: PlanBuilder, k: Kit, c: { cx: number; cz: number; H: number; top: string; bottom: string; rad?: number; y0?: number }) {
  const { cx, cz, H } = c;
  const y0 = c.y0 ?? 0;
  const rad = c.rad ?? 250;
  const ph = H - 2 * T - 10;
  const pole = k.part("Carousel pole", [25, ph, 25], [cx, y0 + T + 5 + ph / 2, cz], { material: "metal", shape: "cyl" });
  const ys = [y0 + T + 60, r1(y0 + T + (H - 2 * T) * 0.52)];
  const shelves = ys.map((y) => k.part("Carousel shelf", [2 * rad, 30, 2 * rad], [cx, y, cz], { shape: "cyl" }));
  const BEARING: HwDef = { kind: "connector", len: 20, dia: 60, name: "Bearing" };
  const RIM: HwDef = { kind: "clip", len: 30, dia: 10, name: "Rim clip" };
  const LOCK: HwDef = { kind: "pin", len: 20, dia: 6, name: "Locking pin" };
  const yb = y0 + T, yt = y0 + H - T;
  k.step({ title: "Screw the bearings to the bottom and the top", detail: "The cup with the peg goes in the middle of the bottom, the open one under the top, right above it. Two screws each.", kind: "screws", tools: ["screwdriver"] }, () => {
    k.fits(BEARING, [{ on: c.bottom, at: [cx, yb, cz], dir: [0, -1, 0], hole: false }, { on: c.top, at: [cx, yt, cz], dir: [0, 1, 0], hole: false }]);
    k.fits(SMALL, [-1, 1].flatMap((q) => [{ on: c.bottom, at: [cx + q * 22, yb, cz] as Vec3, dir: [0, -1, 0] as Vec3 }, { on: c.top, at: [cx + q * 22, yt, cz] as Vec3, dir: [0, 1, 0] as Vec3 }]));
  });
  k.step({ title: "Click the rim clips onto both carousel shelves", detail: "Nine around the edge of each shelf, then press the hub into its middle.", kind: "general", scene: "carousel", warnings: ["floor"] }, () => {
    b.stagger(0.3);
    shelves.forEach((key, i) => b.stage(key, [i * (2 * rad + 80) - rad - 40, 15, 0], [0, 0, 0], [0, 160, 0]));
    b.then(0.1);
    const clips: FitOpts[] = [];
    for (const [i, key] of shelves.entries())
      for (let j = 0; j < 9; j++) {
        const a = (j / 9) * Math.PI * 2;
        clips.push({ on: key, at: [r1(cx + Math.cos(a) * (rad - 6)), ys[i] + 15, r1(cz + Math.sin(a) * (rad - 6))], dir: [0, -1, 0], hole: false });
      }
    k.fits(RIM, clips);
  });
  k.step({ title: "Slide the shelves onto the pole and pin them", detail: "Join the two halves of the pole first. One pin under each shelf at the height you want.", kind: "general", scene: "carousel" }, () => {
    b.stage(pole, [0, ph / 2, 0], [0, 0, 0], [0, 200, 0]);
    b.then(0.1);
    b.stagger(0.3);
    shelves.forEach((key, i) => b.stage(key, [0, ys[i] - y0 - T - 5, 0], [0, 0, 0], [0, 300, 0]));
    b.then(0.1);
    k.fits(LOCK, ys.map((y) => ({ on: pole, at: [cx + 12, y - 25, cz] as Vec3, dir: [-1, 0, 0] as Vec3, hole: false as const })));
  });
  k.step({ title: "Tip the carousel in and lock the pole", detail: "Stand the pole in the bottom bearing, push its top up into the top bearing, and screw it so it can't drop out.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.stagger(0);
    for (const key of [pole, ...shelves]) b.add(key, [260, 0, 260]);
    b.then(0.15);
    b.fit(SMALL, { on: pole, at: [cx + 12, yt - 30, cz], dir: [-1, 0, 0], hole: false });
  });
}


/* ---------- the corner base cabinet 96.5 x 96.5 ---------- */

const CORNER_HINGE: HwDef = { kind: "hinge", len: 70, dia: 30, name: "Corner hinge" };
const HINGE_PLATE: HwDef = { kind: "plate", len: 50, dia: 20, name: "Hinge plate" };
const ROLLER: HwDef = { ...HW.roller, name: "Door roller" };

interface Fit3 {
  side: string;
  at: Vec3; // on the side's inner face
  out: Vec3; // into the side
  along: Vec3; // towards the wall
}

/** A suspension fitting in a side's top back corner, with its three screws. */
function suspFit(k: Kit, f: Fit3) {
  k.fits(SUS, [{ on: f.side, at: f.at, dir: f.out, hole: false }]);
  const p = (dy: number, dk: number): Vec3 => [r1(f.at[0] + f.along[0] * dk), r1(f.at[1] + dy), r1(f.at[2] + f.along[2] * dk)];
  k.fits(SUS_SCREW, [p(22, 14), p(-22, 14), p(0, -16)].map((at) => ({ on: f.side, at, dir: f.out })));
}

/** The rails on the walls, the cabinet hooked on, the fittings locked and capped, and the cabinet beside it screwed on. */
function cornerHang(b: PlanBuilder, k: Kit, o: { rails: { key: string; ends: Vec3[]; out: Vec3 }[]; susp: Fit3[]; join?: { side: string; at: Vec3[]; out: Vec3 } }) {
  k.step(
    {
      title: o.rails.length > 1 ? "Screw a suspension rail to each wall and hang the cabinet on them" : "Screw the suspension rail to the wall and hang the cabinet on it",
      detail: (o.rails.length > 1 ? "Level the rails at the same height into the corner" : "Level the rail on the wall") + `, then lift the cabinet so the fittings hook over. Rails, wall screws and plugs aren't included. Click its legs on first if you use them.`,
      kind: "anchor",
      tools: ["drill", "level", "pencil", "screwdriver"],
      people: 2,
      pose: "+y",
      wall: true,
      warnings: ["two", "wall"],
    },
    () => {
      b.stagger(0.3);
      for (const rl of o.rails) b.add(rl.key, [rl.out[0] * 120, 0, rl.out[2] * 120]);
      b.then(0.1);
      const ends = o.rails.flatMap((rl) => rl.ends.map((p) => ({ rl, p })));
      k.fits(HW.plug, ends.map(({ rl, p }) => ({ at: [p[0] + rl.out[0] * 8, p[1], p[2] + rl.out[2] * 8] as Vec3, dir: rl.out, hole: false as const })));
      k.fits(HW.wallScrew, ends.map(({ rl, p }) => ({ on: rl.key, at: p, dir: rl.out, hole: false as const })));
    },
  );
  k.step({ title: "Adjust the fittings and lock them", detail: "Turn the screws in each fitting to set the height and pull it tight to the walls, then push a locking clip into each.", kind: "screws", tools: ["screwdriver", "level"] }, () => {
    k.fits(LOCK_CLIP, o.susp.map((f) => ({ on: f.side, at: [f.at[0] - f.out[0] * 10, f.at[1] - 20, f.at[2] - f.out[2] * 10] as Vec3, dir: f.out, hole: false as const })));
  });
  k.step({ title: "Click on the covers", detail: "One over each suspension fitting.", kind: "general" }, () => {
    k.fits(named(b, { kind: "cap", len: 6, dia: 40 }, "Fitting cover"), o.susp.map((f) => ({ on: f.side, at: [f.at[0] - f.out[0] * 8, f.at[1], f.at[2] - f.out[2] * 8] as Vec3, dir: [-f.out[0], 0, -f.out[2]] as Vec3, hole: false as const })));
  });
  const j = o.join;
  if (j)
    k.step({ title: "Screw it to the cabinet beside it", detail: "Once the next cabinet hangs level with it, four screws through the side near the hinge holes.", kind: "screws", tools: ["screwdriver"] }, () => {
      k.fits(JOIN_SCREW, j.at.map((at) => ({ on: j.side, at, dir: j.out })));
    });
}

/**
 * SEKTION corner base cabinet 96.5 x 96.5: an L of two boxes. A full box along the left wall, built like any base
 * cabinet, and a short box along the back wall whose bottom joins the long one's on cam bolts, closed by an end panel.
 * Each box has its own back, a corner rail ties the tops together, it hangs on a rail on each wall, and the door is two
 * leaves joined by corner hinges. The corner of the room is at the back left.
 */
function cornerBaseL(b: PlanBuilder, s: ProductSpec): boolean {
  const k = new Kit(b);
  const W = Math.round(s.size.w * 10), A = 610, H = 760;
  const x0 = -W / 2, z0 = -W / 2;
  const xf = x0 + A; // the long box's front, and where the short box starts
  const zf = z0 + A; // the short box's front
  const RY = Math.PI / 2;
  const RT = 12; // rail thickness

  // the long box: its sides at the back and the front end, open towards +x
  const s1a = k.part("Side panel", [T, H, A], [x0 + A / 2, H / 2, z0 + T / 2], { rot: [0, RY, 0] });
  const s1b = k.part("Side panel", [T, H, A], [x0 + A / 2, H / 2, W / 2 - T / 2], { rot: [0, RY, 0] });
  const bottom1 = k.part("Bottom panel", [W - 2 * T, T, A - G], [x0 + G + (A - G) / 2, T / 2, 0], { rot: [0, RY, 0] });
  const back1 = k.part("Back panel", [W - 2 * T + 12, H - 4, 3], [x0 + G - 1.5, H / 2, 0], { material: "fiber", rot: [0, RY, 0] });
  const rail1 = k.part("Back rail", [W - 2 * T, RT, 60], [x0 + G + 30, H - RT / 2, 0], { material: "metal", rot: [0, RY, 0] });
  // the short box: its bottom carries on from the long one's, an end panel, a back on the back wall
  const bw2 = W / 2 - T - xf;
  const bottom2 = k.part("Short bottom", [bw2, T, A - G], [xf + bw2 / 2, T / 2, z0 + G + (A - G) / 2]);
  const side2 = k.part("End panel", [T, H, A], [W / 2 - T / 2, H / 2, z0 + A / 2]);
  const back2 = k.part("Short back", [W / 2 - T - xf + 6, H - 4, 3], [(xf + W / 2 - T) / 2 + 3, H / 2, z0 + G - 1.5], { material: "fiber" });
  const tr = b.compound(
    "Corner rail",
    [
      { shape: "box", size: [60, RT, W - 2 * T], pos: [xf - 30, H - RT / 2, 0] },
      { shape: "box", size: [W / 2 - T - xf, RT, 60], pos: [(xf + W / 2 - T) / 2, H - RT / 2, zf - 30] },
    ],
    { material: "metal" },
  );
  const tRail = b.place(tr.type, tr.mid);

  const xs3 = [0.2, 0.5, 0.82].map((f) => r1(x0 + G + (A - G) * f));
  const xd3 = [0.12, 0.62, 0.92].map((f) => r1(x0 + G + (A - G) * f));
  // a joint between one of the long box's sides and its bottom
  const j1 = (sz: -1 | 1) => {
    const side = sz < 0 ? s1a : s1b;
    const z = sz < 0 ? z0 + T : W / 2 - T;
    return {
      bolts: xs3.map((x): FitOpts => ({ on: side, at: [x, T / 2, z], dir: [0, 0, sz], mate: bottom1 })),
      cams: xs3.map((x): FitOpts => ({ on: bottom1, at: [x, T, z - sz * 24], dir: [0, -1, 0] })),
      dowels: xd3.map((x): FitOpts => ({ on: bottom1, at: [x, T / 2, z], dir: [0, 0, -sz], mate: side })),
    };
  };
  const zj = xs3.map((x) => r1(x - x0 + z0));
  const zd = xd3.map((x) => r1(x - x0 + z0));
  const joinBolts = zj.map((z): FitOpts => ({ on: bottom1, at: [xf, T / 2, z], dir: [-1, 0, 0], mate: bottom2 }));
  const joinCams = zj.map((z): FitOpts => ({ on: bottom2, at: [xf + 24, T, z], dir: [0, -1, 0] }));
  const joinDowels = zd.map((z): FitOpts => ({ on: bottom2, at: [xf, T / 2, z], dir: [1, 0, 0], mate: bottom1 }));
  const endBolts = zj.map((z): FitOpts => ({ on: side2, at: [W / 2 - T, T / 2, z], dir: [1, 0, 0], mate: bottom2 }));
  const endCams = zj.map((z): FitOpts => ({ on: bottom2, at: [W / 2 - T - 24, T, z], dir: [0, -1, 0] }));
  const endDowels = zd.map((z): FitOpts => ({ on: bottom2, at: [W / 2 - T, T / 2, z], dir: [-1, 0, 0], mate: side2 }));
  const susp: Fit3[] = [
    { side: s1a, at: [x0 + G + 25, H - 50, z0 + T], out: [0, 0, -1], along: [-1, 0, 0] },
    { side: s1b, at: [x0 + G + 25, H - 50, W / 2 - T], out: [0, 0, 1], along: [-1, 0, 0] },
    { side: side2, at: [W / 2 - T, H - 50, z0 + G + 25], out: [1, 0, 0], along: [0, 0, -1] },
  ];

  k.step({ title: "Screw the cam bolts into the long box's sides", detail: "Three into each side, in the holes nearest the bottom. Turn them in until they stop.", kind: "cams", tools: ["screwdriver"], scene: "prep", warnings: ["floor"] }, () => {
    b.stagger(0.25);
    b.stage(s1a, [0, T / 2, -(A / 2 + 40)], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.stage(s1b, [0, T / 2, A / 2 + 40], [0, 0, -Math.PI / 2], [0, 160, 0]);
    b.then(0.15);
    k.fits(HW.camScrew, [...j1(-1).bolts, ...j1(1).bolts]);
  });
  k.step({ title: "Screw a suspension fitting onto each side", detail: "In the top back corner, three screws each. The hook faces the back.", kind: "screws", tools: ["screwdriver"], scene: "prep" }, () => {
    for (const f of susp.slice(0, 2)) suspFit(k, f);
  });
  k.step({ title: "Tap the dowels into the ends of the bottom", detail: "Three into each end.", kind: "dowels", tools: ["hammer"], pose: "+y", warnings: ["floor"] }, () => {
    b.add(bottom1, [0, 200, 0]);
    b.then(0.1);
    k.fits(HW.dowel, [...j1(-1).dowels, ...j1(1).dowels]);
  });
  k.step({ title: "Press both sides onto the bottom", detail: "Bolts and dowels into their holes, inside faces towards each other.", kind: "dowels", people: 2, pose: "+y" }, () => {
    b.stagger(0.3);
    b.add(s1a, [0, 0, -260]);
    b.add(s1b, [0, 0, 260]);
  });
  k.step({ title: "Turn the cam locks", detail: "Arrow towards the bolt, then turn each one clockwise until it bites.", kind: "cams", tools: ["screwdriver"], pose: "+y" }, () => k.fits(HW.cam, [...j1(-1).cams, ...j1(1).cams]));
  k.step({ title: "Stand it up and slide the back down its grooves", detail: "Smooth side to the inside, from the top until it sits on the bottom.", kind: "join", pose: "+y" }, () => b.add(back1, [0, 500, 0]));
  k.step({ title: "Screw the back rail across the top", detail: "Flush with the back edges of the sides, one screw down into each.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.add(rail1, [0, 220, 0]);
    b.then(0.1);
    k.fits(RAIL_SCREW, [z0 + T / 2, W / 2 - T / 2].map((z) => ({ on: z < 0 ? s1a : s1b, at: [x0 + G + 30, H, z] as Vec3, dir: [0, -1, 0] as Vec3, mate: rail1 })));
  });
  const xb = x0 + G - 3;
  const nailL = (z: number, y: number, on: string): FitOpts => ({ on: back1, at: [xb, r1(y), r1(z)], dir: [1, 0, 0], mate: on, hole: false });
  k.step({ title: "Turn it onto its front, square it up and nail one corner", detail: "Both diagonals the same length. One nail through the back into a bottom corner.", kind: "nails", tools: ["hammer", "tape"], pose: "-x", check: "square", warnings: ["square", "floor"] }, () => k.fits(HW.nail, [nailL(z0 + 30, T / 2, bottom1)]));
  k.step({ title: "Nail the other bottom corner", detail: "Keep the back pushed tight to the edge.", kind: "nails", tools: ["hammer"], pose: "-x" }, () => k.fits(HW.nail, [nailL(W / 2 - 30, T / 2, bottom1)]));
  k.step({ title: "Nail a top corner", detail: "Check it is still square first.", kind: "nails", tools: ["hammer"], pose: "-x" }, () => k.fits(HW.nail, [nailL(W / 2 - T / 2 - 4, H - 60, s1b)]));
  k.step({ title: "Nail on the two plastic brackets at the top", detail: "One in each top corner of the back, one nail each.", kind: "nails", tools: ["hammer"], pose: "-x" }, () => {
    const pts = [nailL(z0 + T + 30, H - 20, s1a), nailL(W / 2 - T - 30, H - 20, s1b)];
    k.fits(BACK_CLIP, pts.map((p) => ({ ...p, mate: undefined })));
    k.fits(HW.nail, pts.map((p, i) => ({ ...p, at: [p.at[0], p.at[1], i ? W / 2 - T / 2 : z0 + T / 2] as Vec3 })));
  });
  k.step({ title: "Nail the rest of the back", detail: "Ten nails along the edges, into the sides and the bottom.", kind: "nails", tools: ["hammer"], pose: "-x" }, () => {
    const list: FitOpts[] = [];
    for (const f of [0.35, 0.65]) list.push(nailL(z0 + T / 2 + 4, H * f, s1a), nailL(W / 2 - T / 2 - 4, H * f, s1b));
    for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.88]) list.push(nailL(z0 + W * f, T / 2, bottom1));
    k.fits(HW.nail, list);
  });
  k.step({ title: "Lay it on its side and screw three cam bolts into the bottom", detail: "Into the front edge of the bottom, by the back end. The short box joins on there.", kind: "cams", tools: ["screwdriver"], pose: "+z", warnings: ["floor"] }, () => k.fits(HW.camScrew, joinBolts));
  k.step({ title: "Tap the dowels into the short bottom and push it on", detail: "Six dowels, three into each end. Then push it onto the bolts.", kind: "dowels", tools: ["hammer"], pose: "+z" }, () => {
    k.fits(HW.dowel, [...joinDowels, ...endDowels]);
    b.add(bottom2, [300, 0, 0]);
  });
  k.step({ title: "Turn the cam locks", detail: "Three, in the short bottom. Turn each one clockwise until it pulls the bottoms tight.", kind: "cams", tools: ["screwdriver"], pose: "+z" }, () => k.fits(HW.cam, joinCams));
  k.step({ title: "Screw the cam bolts and a suspension fitting into the end panel", detail: "Three bolts near its bottom, and the fitting in its top back corner with three screws.", kind: "cams", tools: ["screwdriver"], scene: "end", warnings: ["floor"] }, () => {
    b.stage(side2, [0, T / 2, 0], [0, 0, Math.PI / 2]);
    b.then(0.15);
    k.fits(HW.camScrew, endBolts);
    suspFit(k, susp[2]);
  });
  k.step({ title: "Push the end panel onto the short bottom", detail: "Bolts and dowels into their holes.", kind: "dowels", pose: "+z" }, () => b.add(side2, [300, 0, 0]));
  k.step({ title: "Turn the cam locks", detail: "Three, in the short bottom by the end panel.", kind: "cams", tools: ["screwdriver"], pose: "+z" }, () => k.fits(HW.cam, endCams));
  k.step({ title: "Stand it up and slide the short back down into its grooves", detail: "From the top, along the back of the short box, until it sits on the bottom.", kind: "join", pose: "+y" }, () => b.add(back2, [0, 500, 0]));
  k.step({ title: "Screw the corner rail across the top front", detail: "Its long arm runs along the front of the long box, the short arm over the front of the short box. Four screws, down into the sides.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.add(tRail, [0, 220, 0]);
    b.then(0.1);
    k.fits(RAIL_SCREW, [
      { on: s1a, at: [xf - 30, H, z0 + T / 2], dir: [0, -1, 0], mate: tRail },
      { on: s1b, at: [xf - 30, H, W / 2 - T / 2], dir: [0, -1, 0], mate: tRail },
      { on: side2, at: [W / 2 - T / 2, H, zf - 45], dir: [0, -1, 0], mate: tRail },
      { on: side2, at: [W / 2 - T / 2, H, zf - 15], dir: [0, -1, 0], mate: tRail },
    ]);
  });
  const zb2 = z0 + G - 3;
  const nailB = (x: number, y: number, on: string): FitOpts => ({ on: back2, at: [r1(x), r1(y), zb2], dir: [0, 0, 1], mate: on, hole: false });
  k.step({ title: "Turn it onto its front, square it and nail the short back at the bottom", detail: "One nail by the end panel.", kind: "nails", tools: ["hammer", "tape"], pose: "-z", check: "square", warnings: ["square", "floor"] }, () => k.fits(HW.nail, [nailB(W / 2 - T - 30, T / 2, bottom2)]));
  k.step({ title: "Nail its top corner", detail: "Into the end panel, by the top.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => k.fits(HW.nail, [nailB(W / 2 - T / 2 - 4, H - 60, side2)]));
  k.step({ title: "Nail on the two plastic brackets", detail: "In the top corners of the short back, one nail each.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => {
    const pts = [nailB(xf + 30, H - 20, back2), nailB(W / 2 - T - 30, H - 20, back2)];
    k.fits(BACK_CLIP, pts.map((p) => ({ ...p, mate: undefined })));
    k.fits(HW.nail, pts.map((p, i) => ({ ...p, mate: i ? side2 : s1a, at: [i ? W / 2 - T / 2 - 4 : xf - 20, p.at[1], p.at[2]] as Vec3 })));
  });
  k.step({ title: "Nail the rest of the short back", detail: "Five nails along the end panel and the bottom.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => {
    k.fits(HW.nail, [nailB(W / 2 - T / 2 - 4, H * 0.35, side2), nailB(W / 2 - T / 2 - 4, H * 0.65, side2), ...[0.25, 0.5, 0.75].map((f) => nailB(xf + (W / 2 - T - xf) * f, T / 2, bottom2))]);
  });

  const yr = H - 50 + 10;
  const railL = k.part("Suspension rail (not included)", [W, 40, 8], [x0 - 4, yr, 0], { material: "metal", extra: true, rot: [0, RY, 0] });
  const railB = k.part("Suspension rail (not included)", [W, 40, 8], [0, yr, z0 - 4], { material: "metal", extra: true });
  cornerHang(b, k, {
    rails: [
      { key: railL, ends: [z0 + 60, W / 2 - 60].map((z): Vec3 => [x0 - 8, yr, z]), out: [-1, 0, 0] },
      { key: railB, ends: [xf + 40, W / 2 - 60].map((x): Vec3 => [x, yr, z0 - 8]), out: [0, 0, -1] },
    ],
    susp,
  });

  if (s.cabinet?.shelves) {
    const y = Math.round(H / 2 / 32) * 32;
    const st = b.compound("Corner shelf", [
      { shape: "box", size: [A - G - 30, T, W - 2 * T - 2], pos: [x0 + G + (A - G - 30) / 2, y + T / 2, 0] },
      { shape: "box", size: [W / 2 - T - xf - 1, T, A - G - 30], pos: [(xf + W / 2 - T - 1) / 2, y + T / 2, z0 + G + (A - G - 30) / 2] },
    ]);
    const key = b.place(st.type, st.mid);
    k.step({ title: "Push in the shelf pins and lay the shelf on", detail: "Six pins at one height: two in each side of the long box and two in the end panel.", kind: "shelves" }, () => {
      const pins: FitOpts[] = [];
      for (const x of [x0 + G + 50, xf - 80]) pins.push({ on: s1a, at: [x, y, z0 + T], dir: [0, 0, -1], hole: false }, { on: s1b, at: [x, y, W / 2 - T], dir: [0, 0, 1], hole: false });
      for (const z of [z0 + G + 50, zf - 80]) pins.push({ on: side2, at: [W / 2 - T, y, z], dir: [1, 0, 0], hole: false });
      k.fits(HW.pin, pins);
      b.add(key, [300, 100, 300]);
    });
  }
  if (s.cabinet?.corner?.inner === "carousel") lCarousel(b, k, { cx: x0 + G + 300, cz: z0 + G + 300, H, bottom1, s1a, s1b, z0 });

  // two leaves at the inside corner: one across the short box's front, one across the long box's front
  const lw = Math.round(W / 2 - xf - 15), dh = H - DGAP;
  const ye = r1(H / 2);
  const lf = zf + 1 + DT / 2, xl2 = xf + 1 + DT / 2;
  const leafA = k.part("Door", [lw, dh, DT], [W / 2 - 1.5 - lw / 2, ye, lf]);
  const leafB = k.part("Door", [lw, dh, DT], [xl2, ye, W / 2 - 1.5 - lw / 2], { rot: [0, RY, 0] });
  const hy = [120, H - 120];
  const ja = W / 2 - 1.5 - lw + 15; // leaf A's edge at the inside corner
  k.step({ title: "Screw the hinge plates onto one leaf", detail: "On the back of the leaf that goes across the long box, along its edge at the inside corner. Two screws each.", kind: "hinges", tools: ["screwdriver"], scene: "doors", warnings: ["floor", "face"] }, () => {
    b.stage(leafB, [0, DT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    k.fits(HINGE_PLATE, hy.map((y) => ({ on: leafB, at: [xl2 - DT / 2, y, W / 2 - 1.5 - lw + 15] as Vec3, dir: [1, 0, 0] as Vec3, hole: false as const })));
    k.fits(SMALL, hy.flatMap((y) => [-12, 12].map((dd) => ({ on: leafB, at: [xl2 - DT / 2, y + dd, W / 2 - 1.5 - lw + 15] as Vec3, dir: [1, 0, 0] as Vec3 }))));
  });
  k.step({ title: "Screw the corner hinges onto the other leaf", detail: "On the back of the second leaf, along the same edge. Two screws each.", kind: "hinges", tools: ["screwdriver"], scene: "doors" }, () => {
    b.stage(leafA, [lw + 80, DT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    k.fits(CORNER_HINGE, hy.map((y) => ({ on: leafA, at: [ja, y, lf - DT / 2] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const })));
    k.fits(SMALL, hy.flatMap((y) => [-12, 12].map((dd) => ({ on: leafA, at: [ja + 8, y + dd, lf - DT / 2] as Vec3, dir: [0, 0, 1] as Vec3 }))));
  });
  k.step({ title: "Clip the leaves together and screw on the roller", detail: "Each corner hinge clips onto its plate. The roller goes at the top of the free leaf, near its edge, with one screw.", kind: "hinges", tools: ["screwdriver"], scene: "doors" }, () => {
    k.fits(ROLLER, [{ on: leafB, at: [xl2 - DT / 2, H - 40, W / 2 - 1.5 - 25], dir: [1, 0, 0], hole: false }]);
    k.fits(SMALL, [{ on: leafB, at: [xl2 - DT / 2, H - 40, W / 2 - 1.5 - 40], dir: [1, 0, 0] }]);
  });
  k.step({ title: "Press the hinges into the door and screw their plates onto the end panel", detail: "Two hinges along the outer edge of the leaf across the short box; the plates go in the holes at the front of the end panel.", kind: "hinges", tools: ["screwdriver"] }, () => {
    k.fits(HW.hinge, hy.map((y) => ({ on: leafA, at: [W / 2 - 1.5 - 22, y, lf - DT / 2] as Vec3, dir: [0, 0, 1] as Vec3, twist: Math.PI })));
    k.fits(PLATE, hy.map((y) => ({ on: side2, at: [W / 2 - T, y, zf - 37] as Vec3, dir: [1, 0, 0] as Vec3, hole: false as const })));
  });
  k.step({ title: "Click the door onto the plates", detail: "Hold both leaves folded flat, hook the hinge arms over the plates and press until they click.", kind: "doors", people: 2 }, () => {
    b.stagger(0);
    b.add(leafA, [0, 0, 380]);
    b.add(leafB, [380, 0, 0]);
  });
  k.step({ title: "Line up the door and stick on the bumpers", detail: "Turn the hinge screws until both leaves close evenly. The two bumpers go on the front edge of the bottom, where the folding leaf closes.", kind: "doors", tools: ["screwdriver"] }, () => {
    k.fits(BUMPER, [W / 2 - 120, W / 2 - 40].map((z) => ({ on: bottom1, at: [xf, T / 2, z] as Vec3, dir: [-1, 0, 0] as Vec3, hole: false as const })));
  });
  return true;
}

/** UTRUSTA carousel for the L corner: two kidney trays turning on a bearing on the bottom and one under a beam across the long box. */
function lCarousel(b: PlanBuilder, k: Kit, c: { cx: number; cz: number; H: number; bottom1: string; s1a: string; s1b: string; z0: number }) {
  const BEARING: HwDef = { kind: "connector", len: 20, dia: 70, name: "Bearing" };
  const BEAM_BRACKET: HwDef = { kind: "angle", len: 60, dia: 40, name: "Beam bracket" };
  const { cx, cz, H } = c;
  const dia = 560;
  const y0 = T;
  const ys = [y0 + 40, r1(y0 + (H - y0) * 0.5)];
  const trays = ys.map((y) => {
    const t = b.compound("Carousel tray", [
      { shape: "cyl", size: [dia, 12, dia], pos: [0, 6, 0] },
      { shape: "cyl", size: [dia, 6, dia], pos: [0, 70, 0], material: "metal" },
    ], { material: "metal" });
    return b.place(t.type, [cx + t.mid[0], y + t.mid[1], cz + t.mid[2]]);
  });
  const beam = k.part("Carousel beam", [40, 30, -2 * c.z0 - 2 * T], [cx, H - 90, 0], { material: "metal" });
  k.step({ title: "Screw the bottom bearing onto the bottom", detail: "Where the marks show, at the middle of the corner. Four screws.", kind: "screws", tools: ["screwdriver"] }, () => {
    k.fits(BEARING, [{ on: c.bottom1, at: [cx, y0, cz], dir: [0, -1, 0], hole: false }]);
    k.fits(SMALL, [0, 1, 2, 3].map((q) => ({ on: c.bottom1, at: [r1(cx + Math.cos((q * Math.PI) / 2) * 25), y0, r1(cz + Math.sin((q * Math.PI) / 2) * 25)] as Vec3, dir: [0, -1, 0] as Vec3 })));
  });
  k.step({ title: "Put the trays together", detail: "Press each rim onto its tray until it clicks all round.", kind: "general", scene: "carousel", warnings: ["floor"] }, () => {
    b.stagger(0.3);
    trays.forEach((key, i) => b.stage(key, [(i - 0.5) * (dia + 80), 40, 0], [0, 0, 0], [0, 160, 0]));
  });
  k.step({ title: "Set the lower tray on the bottom bearing", detail: "Its hub drops over the bearing's peg. Turn it to check it runs freely.", kind: "general" }, () => b.add(trays[0], [200, 200, 200]));
  k.step({ title: "Fit the beam across the long box", detail: "A bracket screwed into each side, the beam screwed to both, and the top bearing under it.", kind: "screws", tools: ["screwdriver"] }, () => {
    const ends = [c.z0 + T, -c.z0 - T];
    k.fits(BEAM_BRACKET, ends.map((z, i) => ({ on: i ? c.s1b : c.s1a, at: [cx, H - 90, z] as Vec3, dir: [0, 0, i ? 1 : -1] as Vec3, hole: false as const })));
    b.add(beam, [0, 200, 0]);
    b.then(0.1);
    k.fits(BEARING, [{ on: beam, at: [cx, H - 105, cz], dir: [0, 1, 0], hole: false }]);
    k.fits(SMALL, [0, 1, 2].map((q) => ({ on: beam, at: [cx, H - 105, r1(cz + (q - 1) * 14)] as Vec3, dir: [0, 1, 0] as Vec3 })));
  });
  k.step({ title: "Hang the upper tray and lock it", detail: "Tip it in, push its hub up onto the top bearing and turn the screw in the hub so it can't drop.", kind: "general" }, () => b.add(trays[1], [200, 0, 200]));
}


/* ---------- the blind corner base cabinet 127 ---------- */

/**
 * SEKTION corner base cabinet 127 x 61 (the frame): one long box whose left part hides behind the cabinet on the other
 * wall. Built like a base cabinet, plus a fixed front panel stood on the bottom over the blind part, held by frame screws,
 * and a post at its edge where the door opening starts. Two rails across the top, the back nailed on lying on its front,
 * and it hangs on the suspension rail.
 */
interface Blind {
  k: Kit;
  W: number;
  H: number;
  D: number;
  Wi: number;
  xp: number; // the post's left face; the door opening runs from xp + T to the right side
  sideL: string;
  sideR: string;
  front: string;
  post: string;
}

function cornerBlind(b: PlanBuilder, s: ProductSpec, inside?: (c: Blind) => void): boolean {
  const k = new Kit(b);
  const W = Math.round(s.size.w * 10), D = 610, H = 760;
  const Wi = W - 2 * T, dd = D - G, zp = G / 2;
  const xp = W / 2 - T - 600; // the door opening starts here
  const RT = 12;
  const sideL = k.part("Side", [T, H, D], [-W / 2 + T / 2, H / 2, 0]);
  const sideR = k.part("Side", [T, H, D], [W / 2 - T / 2, H / 2, 0]);
  const bottom = k.part("Bottom", [Wi, T, dd], [0, T / 2, zp]);
  const fw = xp + W / 2 - T;
  const front = k.part("Front panel", [fw, H - T, T], [-W / 2 + T + fw / 2, T + (H - T) / 2, D / 2 - T / 2]);
  const post = k.part("Post", [T, H - T, 80], [xp + T / 2, T + (H - T) / 2, D / 2 - 40]);
  const back = k.part("Back panel", [Wi + 12, H - 4, 3], [0, H / 2, -D / 2 + G - 1.5], { material: "fiber" });
  const railB = k.part("Rail", [Wi, RT, 80], [0, H - RT / 2, -D / 2 + G + 40], { material: "metal" });
  const railF = k.part("Rail", [W / 2 - T - xp - T, RT, 80], [(xp + T + W / 2 - T) / 2, H - RT / 2, D / 2 - 40 - T], { material: "metal" });

  const zs = [zp - dd / 2 + 60, zp, zp + dd / 2 - 60];
  const bolts = (sx: number): FitOpts[] => zs.map((z) => ({ on: sx < 0 ? sideL : sideR, at: [(sx * Wi) / 2, T / 2, z + 20], dir: [sx, 0, 0], mate: bottom }));
  const dowels = (sx: number): FitOpts[] => zs.map((z) => ({ on: bottom, at: [(sx * Wi) / 2, T / 2, z - 20], dir: [-sx, 0, 0] }));
  const cams = (sx: number): FitOpts[] => zs.map((z) => ({ on: bottom, at: [sx * (Wi / 2 - 24), T, z + 20], dir: [0, -1, 0] }));
  const sus: Fit3[] = [-1, 1].map((sx) => ({ side: sx < 0 ? sideL : sideR, at: [(sx * Wi) / 2, H - 50, -D / 2 + G + 25] as Vec3, out: [sx, 0, 0] as Vec3, along: [0, 0, -1] as Vec3 }));

  k.step({ title: "Screw a suspension fitting onto each side", detail: "Lay the sides flat, inside up. One fitting in each top back corner, three screws each.", kind: "screws", tools: ["screwdriver"], scene: "sides", pose: "+x", warnings: ["floor"] }, () => {
    b.stagger(0.15);
    [sideL, sideR].forEach((key, i) => b.stage(key, [0, H / 2, (i - 0.5) * (D + 120)], key === sideR ? [0, Math.PI, 0] : [0, 0, 0]));
    b.then(0.15);
    for (const f of sus) suspFit(k, f);
  });
  k.step({ title: "Screw the cam bolts into both sides", detail: "Three into each side, in the holes nearest the bottom.", kind: "cams", tools: ["screwdriver"], scene: "sides", pose: "+x" }, () => k.fits(HW.camScrew, [...bolts(-1), ...bolts(1)]));
  k.step({ title: "Tap dowels into the bottom and push it onto one side", detail: "Three dowels into each end. Stand the right side up on a rug, then push the bottom onto its bolts.", kind: "dowels", tools: ["hammer"], pose: "+y", warnings: ["floor"] }, () => {
    b.add(sideR, [0, 0, 0]);
    b.then(0.15);
    k.fits(HW.dowel, [...dowels(1), ...dowels(-1)]);
    b.add(bottom, [-360, 0, 0]);
  });
  k.step({ title: "Turn the cam locks", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", kind: "cams", tools: ["screwdriver"] }, () => k.fits(HW.cam, cams(1)));
  k.step({ title: "Stand the front panel on the bottom and screw it on", detail: "Over the blind part, flush with the front edge. Three frame screws up through the bottom into its edge. Use the Allen key.", kind: "screws", tools: ["allen"] }, () => {
    b.add(front, [0, 300, 0]);
    b.then(0.1);
    k.fits(FRAME_SCREW, [0.2, 0.5, 0.8].map((f) => ({ on: bottom, at: [r1(-W / 2 + T + fw * f), 0, D / 2 - T / 2] as Vec3, dir: [0, 1, 0] as Vec3, mate: front })));
  });
  k.step({ title: "Fit the other side", detail: "Line every dowel and bolt up with its hole and press the side on evenly.", kind: "dowels", people: 2 }, () => b.add(sideL, [-420, 0, 0]));
  k.step({ title: "Turn the other cam locks", detail: "The same way as on the first side.", kind: "cams", tools: ["screwdriver"] }, () => k.fits(HW.cam, cams(-1)));
  k.step({ title: "Screw the post to the edge of the front panel", detail: "Where the door opening starts. Three frame screws through the post into the panel's edge.", kind: "screws", tools: ["allen"] }, () => {
    b.add(post, [300, 0, 0]);
    b.then(0.1);
    k.fits(FRAME_SCREW, [0.2, 0.5, 0.8].map((f) => ({ on: post, at: [xp + T, r1(T + (H - T) * f), D / 2 - T / 2] as Vec3, dir: [-1, 0, 0] as Vec3, mate: front })));
  });
  k.step({ title: "Slide the back down its grooves", detail: "Smooth side to the inside, from the top until it sits on the bottom.", kind: "join" }, () => b.add(back, [0, 600, 0]));
  k.step({ title: "Screw the rails across the top", detail: "The long one at the back, the short one over the door opening. One screw down through each end into the side or the post.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.stagger(0.25);
    b.add(railB, [0, 260, 0]);
    b.add(railF, [0, 260, 0]);
    b.then(0.15);
    k.fits(RAIL_SCREW, [
      { on: sideL, at: [-(Wi + T) / 2, H, -D / 2 + G + 40], dir: [0, -1, 0], mate: railB },
      { on: sideR, at: [(Wi + T) / 2, H, -D / 2 + G + 40], dir: [0, -1, 0], mate: railB },
      { on: post, at: [xp + T / 2, H, D / 2 - 40 - T], dir: [0, -1, 0], mate: railF },
      { on: sideR, at: [(Wi + T) / 2, H, D / 2 - 40 - T], dir: [0, -1, 0], mate: railF },
    ]);
  });
  const zn = -D / 2 + G - 3;
  const nail = (at: Vec3, mate: string): FitOpts => ({ on: back, at, dir: [0, 0, 1], mate, hole: false });
  k.step({ title: "Turn it onto its front, square it up and nail one corner", detail: "Both diagonals the same length. One nail in a bottom corner.", kind: "nails", tools: ["hammer", "tape"], pose: "-z", check: "square", warnings: ["square", "floor"] }, () => k.fits(HW.nail, [nail([-Wi / 2 + 20, T / 2, zn], bottom)]));
  k.step({ title: "Nail the other bottom corner", detail: "Keep the back pushed tight to the edge.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => k.fits(HW.nail, [nail([Wi / 2 - 20, T / 2, zn], bottom)]));
  k.step({ title: "Nail a top corner", detail: "Check it is still square first.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => k.fits(HW.nail, [nail([(Wi + 8) / 2, H - 60, zn], sideR)]));
  const clips: Vec3[] = [-1, 1].map((sx) => [sx * (Wi / 2 - 40), H - 20, zn]);
  k.step({ title: "Nail on the two plastic brackets at the top", detail: "One in each top corner of the back, a nail through each.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => {
    k.fits(BACK_CLIP, clips.map((p) => ({ on: back, at: p, dir: [0, 0, 1] as Vec3, hole: false as const })));
    k.fits(HW.nail, clips.map((p) => nail([Math.sign(p[0]) * (Wi + 8) / 2, p[1], zn], p[0] < 0 ? sideL : sideR)));
  });
  k.step({ title: "Nail the back all along", detail: "Twelve more nails, into the bottom and the sides.", kind: "nails", tools: ["hammer"], pose: "-z" }, () => {
    const list: FitOpts[] = [];
    for (let i = 0; i < 8; i++) list.push(nail([r1(-Wi / 2 + 80 + ((Wi - 160) * i) / 7), T / 2, zn], bottom));
    for (const sx of [-1, 1]) for (const f of [0.35, 0.65]) list.push(nail([(sx * (Wi + 8)) / 2, r1(H * f), zn], sx < 0 ? sideL : sideR));
    k.fits(HW.nail, list);
  });
  const yr = H - 40;
  const rail = k.part("Suspension rail (not included)", [W + 60, 40, 8], [0, yr, -D / 2 - 4], { material: "metal", extra: true });
  cornerHang(b, k, { rails: [{ key: rail, ends: [-W / 3, 0, W / 3].map((x): Vec3 => [x, yr, -D / 2 - 8]), out: [0, 0, -1] }], susp: sus });
  inside?.({ k, W, H, D, Wi, xp, sideL, sideR, front, post });
  return true;
}

/* ---------- what goes in the blind corner 127: the UTRUSTA shelf, a MAXIMERA drawer, the pull-out trays, the door ---------- */

/** The front over the door opening: it covers the post and the opening, 3 mm short of the outside edge. */
const blindFront = (c: Blind) => ({ x: (c.xp + c.W / 2) / 2, w: c.W / 2 - c.xp - DGAP, z: c.D / 2 + 1 + DT / 2 });

/** UTRUSTA shelf for the corner base cabinet: one board right across, on eight pins, lowered in from the top. */
function blindShelf(b: PlanBuilder, c: Blind, y: number) {
  const { k, D, Wi, xp } = c;
  const z0 = -D / 2 + G + 2, z1 = D / 2 - 82; // its front edge stops behind the post
  const shelf = k.part("Shelf", [Wi - 2, T, z1 - z0], [0, y, (z0 + z1) / 2]);
  const yp = y - T / 2;
  const pins: FitOpts[] = [];
  for (const sx of [-1, 1]) for (const z of [z0 + 40, (z0 + z1) / 2, z1 - 40]) pins.push({ on: sx < 0 ? c.sideL : c.sideR, at: [(sx * Wi) / 2, yp, r1(z)], dir: [sx, 0, 0], hole: false });
  for (const x of [xp + 4, xp + T - 4]) pins.push({ on: c.post, at: [x, yp - 4, D / 2 - 80], dir: [0, 0, 1], hole: false });
  k.step({ title: "Push in the shelf pins", detail: "Eight at the same height: three in each side and two in the back of the post.", kind: "shelves" }, () => k.fits(HW.pin, pins));
  k.step({ title: "Lower the shelf onto the pins", detail: "From the top, right across the cabinet behind the blind front, until it rests on all eight.", kind: "shelves" }, () => b.add(shelf, [0, 520, 0]));
}

/** A MAXIMERA drawer over the door: its runners go on the post and the right side, the box is built on the floor. */
function blindDrawer(b: PlanBuilder, c: Blind, lo: number, hi: number) {
  const { k, D, xp } = c;
  const ox0 = xp + T, ox1 = c.W / 2 - T;
  const f = blindFront(c);
  const bw = ox1 - ox0 - 26;
  const cx = (ox0 + ox1) / 2;
  const dd = Math.floor((D - 60) / 50) * 50;
  const zc = D / 2 - 2 - dd / 2;
  const yb = lo + 18, sh = 120;
  const sides = [-1, 1].map((sx) => k.part("Drawer side", [16, sh, dd], [cx + sx * (bw / 2 - 8), yb + sh / 2, zc], { material: "metal" }));
  const back = k.part("Drawer back", [bw - 32, sh - 20, 16], [cx, yb + 10 + (sh - 20) / 2, zc - dd / 2 + 10]);
  const bottom = k.part("Drawer bottom", [bw - 32, 10, dd - 4], [cx, yb + 5, zc]);
  const rails = [-1, 1].map((sx) => k.part("Gallery rail", [12, 12, dd - 20], [cx + sx * (bw / 2 - 8), yb + sh + 60, zc + 8], { material: "metal" }));
  const front = k.part("Drawer front", [f.w, hi - lo - DGAP, DT], [f.x, (lo + hi) / 2, f.z]);
  const c0: Vec3 = [cx, yb + 80, zc];
  const rel = (key: string): Vec3 => {
    const p = b.partItem(key).final.pos;
    return [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
  };
  const scene = "drawer";
  k.step({ title: "Click the back onto the drawer sides", detail: "Each end of the back hooks into a side with a click.", kind: "drawer", scene, warnings: ["floor"] }, () => {
    b.stagger(0.25);
    for (const key of [...sides, back]) b.stage(key, rel(key), [0, 0, 0], [0, 0, -260]);
  });
  k.step({ title: "Slide the bottom in and screw it to the back", detail: "It runs in the grooves of the sides. One screw up through the bottom into the back.", kind: "drawer", tools: ["screwdriver"], scene }, () => {
    b.stage(bottom, rel(bottom), [0, 0, 0], [0, 0, 420]);
    b.then(0.1);
    b.fit(SMALL, { on: bottom, at: [cx, yb, zc - dd / 2 + 10], dir: [0, 1, 0], mate: back });
  });
  const ff = [-1, 1].map((sx): Vec3 => [cx + sx * (bw / 2 - 8), yb + sh / 2, f.z - DT / 2]);
  k.step({ title: "Screw the front fittings on and click the front onto the drawer", detail: "One fitting at each end of the back of the front, two screws each. Then push the drawer onto them until both click.", kind: "drawer", tools: ["screwdriver"], scene }, () => {
    b.stage(front, rel(front), [0, 0, 0], [0, 0, 300]);
    b.then(0.1);
    k.fits(FRONT_FIT, ff.map((p) => ({ on: front, at: p, dir: [0, 0, 1] as Vec3, hole: false as const })));
    k.fits(EURO, ff.flatMap((p) => [-1, 1].map((q) => ({ on: front, at: [p[0] + q * 12, p[1], p[2]] as Vec3, dir: [0, 0, 1] as Vec3 }))));
  });
  k.step({ title: "Click the gallery rails on", detail: "Left and right are marked. Each one clicks into the front and the back.", kind: "drawer", scene }, () => {
    b.stagger(0.25);
    for (const key of rails) b.stage(key, rel(key), [0, 0, 0], [0, 200, 0]);
  });
  const runner: HwDef = { kind: "runner", len: dd, dia: 20 };
  const yr = yb + 4;
  k.step({ title: "Screw the runner onto the post", detail: "Along the left of the opening, front end flush with the post, in the holes marked 3. One screw at each end.", kind: "runners", tools: ["screwdriver"] }, () => {
    k.fits(runner, [{ on: c.post, at: [ox0, yr, zc], dir: [-1, 0, 0], hole: false }]);
    k.fits(EURO, [D / 2 - 64, D / 2 - 20].map((z) => ({ on: c.post, at: [ox0 + 10, yr, z] as Vec3, dir: [-1, 0, 0] as Vec3 })));
  });
  k.step({ title: "Screw the other runner into the right side", detail: "At the same height, in the holes marked 3. One screw at the front and one at the back.", kind: "runners", tools: ["screwdriver"] }, () => {
    k.fits(runner, [{ on: c.sideR, at: [ox1, yr, zc], dir: [1, 0, 0], hole: false }]);
    k.fits(EURO, [zc - dd / 2 + 40, zc + dd / 2 - 30].map((z) => ({ on: c.sideR, at: [ox1 - 10, yr, z] as Vec3, dir: [1, 0, 0] as Vec3 })));
  });
  k.step({ title: "Put the drawer on the runners", detail: "Pull the runners out, rest the drawer on them and push it in until it clicks.", kind: "drawer" }, () => {
    b.stagger(0);
    for (const key of [front, ...sides, back, bottom, ...rails]) b.add(key, [0, 0, 520]);
  });
}

/** UTRUSTA pull-out fitting: four pivot blocks on the right side, four arms, and two kidney trays that swing out with the door. */
function blindPullOut(b: PlanBuilder, c: Blind) {
  const { k, D } = c;
  const ox1 = c.W / 2 - T;
  const BLOCK: HwDef = { kind: "bracket", len: 60, dia: 40, name: "Pivot block" };
  const POST: HwDef = { kind: "clip", len: 80, dia: 10, name: "Rim post" };
  const JOIN: HwDef = { kind: "connector", len: 30, dia: 12, name: "Rim connector" };
  const levels = [110, 430]; // the trays' undersides
  const za = [D / 2 - 120, -60]; // the two arms of each tray
  const L = 840, Wt = 400, TH = 10, RH = 80;
  const cx = ox1 - 30 - L / 2;
  // a kidney: rounded at both ends, pinched in at the front
  const outline: [number, number][] = [[-L / 2, -Wt / 2], [L / 2, -Wt / 2], [L / 2, Wt / 2], [110, Wt / 2], [0, Wt / 2 - 70], [-110, Wt / 2], [-L / 2, Wt / 2]];
  const segs = outline.map((p, i) => [p, outline[(i + 1) % outline.length]] as const);
  const per = segs.map(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]));
  const total = per.reduce((a, v) => a + v, 0);
  const along = (t: number): [number, number] => {
    let d = t * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= per[i]) {
        const [p, q] = segs[i];
        return [p[0] + ((q[0] - p[0]) * d) / per[i], p[1] + ((q[1] - p[1]) * d) / per[i]];
      }
      d -= per[i];
    }
    return outline[0];
  };
  const postsXZ = Array.from({ length: 12 }, (_, i) => along((i + 0.5) / 12)).map(([x, z]): [number, number] => [r1(x * 0.985), r1(z * 0.97)]);
  const trays = levels.map((y) => {
    const t = b.compound("Tray", [{ shape: "slab", size: [L, TH, Wt], pos: [cx, y + TH / 2, 0], outline, round: 90 }]);
    const rimPieces: PartPiece[] = segs.map(([p, q], i) => ({
      shape: "box",
      size: [r1(per[i] + 4), RH, 4],
      pos: [r1(cx + ((p[0] + q[0]) / 2) * 0.985), y + TH + RH / 2, r1(((p[1] + q[1]) / 2) * 0.97)],
      rot: [0, -Math.atan2(q[1] - p[1], q[0] - p[0]), 0],
    }));
    const rm = b.compound("Tray rim", rimPieces);
    return { y, tray: b.place(t.type, t.mid), rim: b.place(rm.type, rm.mid), mid: t.mid };
  });
  const arms = levels.flatMap((y) => za.map((z) => k.part("Swing arm", [300, 16, 16], [ox1 - 150, y - 12, z], { material: "metal" })));

  k.step({ title: "Screw the four pivot blocks into the right side", detail: "Two at each tray height, in the holes the chart shows. Two screws each.", kind: "screws", tools: ["screwdriver"] }, () => {
    const blocks = levels.flatMap((y) => za.map((z) => ({ on: c.sideR, at: [ox1, y - 12, z] as Vec3, dir: [1, 0, 0] as Vec3, hole: false as const })));
    k.fits(BLOCK, blocks);
    k.fits(EURO, blocks.flatMap((p) => [-20, 20].map((dz) => ({ on: c.sideR, at: [ox1 - 10, p.at[1], p.at[2] + dz] as Vec3, dir: [1, 0, 0] as Vec3 }))));
  });
  k.step({ title: "Hook the four arms into the blocks", detail: "Tilt each arm, hook its end into the block and swing it down level.", kind: "general" }, () => {
    b.stagger(0.2);
    for (const a of arms) b.add(a, [0, 180, 0]);
  });
  // both trays are built on the floor, side by side
  const at = (i: number, key: string, lift = 0): Vec3 => {
    const p = b.partItem(key).final.pos;
    const m = trays[i];
    return [p[0] - cx + (i - 0.5) * (L + 120), p[1] - m.y + lift, p[2]];
  };
  const scene = "trays";
  k.step({ title: "Click twelve posts into each rim", detail: "Lay the rim strip out on the floor and push the posts into its slots, all the same way up.", kind: "general", scene, warnings: ["floor"] }, () => {
    b.stagger(0.2);
    trays.forEach((t, i) => b.stage(t.rim, at(i, t.rim, 200), [0, 0, 0], [0, 120, 0]));
    b.then(0.1);
    k.fits(POST, trays.flatMap((t) => postsXZ.map(([x, z]) => ({ on: t.rim, at: [cx + x, t.y + TH + RH, z] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const }))));
  });
  k.step({ title: "Join the ends of each rim", detail: "A connector over each joint, two for each rim, until the ends meet.", kind: "general", scene }, () => {
    k.fits(JOIN, trays.flatMap((t) => [0.25, 0.75].map((q) => along(q)).map(([x, z]) => ({ on: t.rim, at: [r1(cx + x * 0.985), t.y + TH + RH / 2, r1(z * 0.97)] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const }))));
  });
  k.step({ title: "Press each rim onto its tray", detail: "All twelve posts into the holes round the edge of the tray.", kind: "general", scene }, () => {
    b.stagger(0.2);
    trays.forEach((t, i) => b.stage(t.tray, at(i, t.tray), [0, 0, 0], [0, 0, 260]));
    b.then(0.1);
    trays.forEach((t, i) => b.stage(t.rim, at(i, t.rim), [0, 0, 0]));
  });
  k.step({ title: "Screw the posts to the trays", detail: "Tip each tray up and drive a screw up through the tray into every post, twelve each.", kind: "screws", tools: ["screwdriver"], scene }, () => {
    k.fits(SMALL, trays.flatMap((t) => postsXZ.map(([x, z]) => ({ on: t.tray, at: [cx + x, t.y, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: t.rim }))));
  });
  k.step({ title: "Lower the trays onto the arms", detail: "Each tray's two sockets drop over the pins at the ends of its arms. The lower tray first. Swing them in and out to check.", kind: "general" }, () => {
    b.stagger(0.4);
    for (const t of trays) {
      b.add(t.tray, [0, 260, 0]);
      b.add(t.rim, [0, 260, 0]);
    }
  });
}

/** The door over the opening, on two UTRUSTA corner cabinet hinges whose plates go on the post. */
function blindDoor(b: PlanBuilder, c: Blind, hi: number) {
  const { k, xp } = c;
  const f = blindFront(c);
  const h = hi - DGAP;
  const door = k.part("Door", [f.w, h, DT], [f.x, DGAP / 2 + h / 2, f.z]);
  const ys = [100, h - 100].map((y) => Math.round(y + DGAP / 2));
  const hx = f.x - f.w / 2 + 22;
  k.step({ title: "Press the hinges into the door", detail: "Lay it face down on a rug, hinge holes towards the post side. Press each cup in and push the lever down to lock it.", kind: "hinges", scene: "doors", warnings: ["floor", "face"] }, () => {
    b.stage(door, [0, DT / 2, 0], [Math.PI / 2, 0, 0]);
    b.then(0.15);
    k.fits(HW.hinge, ys.map((y) => ({ on: door, at: [hx, y, f.z - DT / 2] as Vec3, dir: [0, 0, 1] as Vec3 })));
  });
  k.step({ title: "Screw the mounting plates to the post", detail: "Into the holes on the opening side of the post, level with the hinges. Their screws come fitted.", kind: "hinges", tools: ["screwdriver"] }, () =>
    k.fits(PLATE, ys.map((y) => ({ on: c.post, at: [xp + T, y, c.D / 2 - 37] as Vec3, dir: [-1, 0, 0] as Vec3 }))),
  );
  k.step({ title: "Clip the door onto the plates", detail: "Hook each hinge over its plate and press until it clicks. Turn the hinge screws until the gaps are even.", kind: "doors", tools: ["screwdriver"] }, () => b.add(door, [0, 0, 360]));
}

const family: Family = {
  names: ["SEKTION"],
  build(b, s) {
    if (/^sektion-corner-wall/.test(s.slug ?? "")) return cornerWall(b, s);
    if (/^sektion-corner-base/.test(s.slug ?? "") && s.cabinet?.corner?.shape === "l") return cornerBaseL(b, s);
    if (s.slug === "sektion-corner-base-cabinet-127-x-61-x-76") return cornerBlind(b, s);
    if (s.slug === "sektion-corner-base-cab-w-drawer-and-shelf-127-x")
      return cornerBlind(b, s, (c) => {
        const split = Math.round((c.H * 2) / 3); // a 20" door under a 10" drawer front
        blindShelf(b, c, Math.round(split / 2 / 32) * 32);
        blindDrawer(b, c, split, c.H);
        blindDoor(b, c, split);
      });
    if (s.slug === "sektion-corner-base-cab-w-pull-out-fitting-127-x")
      return cornerBlind(b, s, (c) => {
        blindPullOut(b, c);
        blindDoor(b, c, c.H);
      });
    if (build(b, s)) return true;
    const L = layoutOf(s);
    if (!L) return false;
    new Sek(b, s, L).build();
    return true;
  },
};
export default family;
