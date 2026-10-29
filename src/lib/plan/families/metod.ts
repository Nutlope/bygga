import type { Family } from "./family";
import type { FitZone, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";

/**
 * METOD kitchen cabinets, read from the frame manuals and the drawer, hinge and front manuals sold with them.
 * Every frame is cam bolts and cams with wooden dowels (two at each joint in a 37 cm deep frame, three in a 60 cm one),
 * a hardboard back nailed on while it lies on its front (three corners first, two plastic brackets at the top, then
 * the rest), two suspension fittings in the top back corners, and it hangs on a METOD suspension rail screwed to the wall.
 * Base cabinets have a bottom and two metal rails across the top instead of a top panel; wall, top and high cabinets
 * are built lying on one side, the other side lowered on last. Base and high cabinets stand on four legs. Then the
 * insides follow their own manuals: MAXIMERA or KNIVSHULT drawers (runners into the hung cabinet, the drawer built
 * on the floor and clicked onto its front), UTRUSTA shelves on pins, and doors on UTRUSTA hinges.
 * The corner wall and corner base cabinets have their own builders (cornerWall, cornerBase128 and cornerBase88 below).
 * Extractor hood cabinets are built differently again.
 */

type Kind = "base" | "wall" | "top" | "high";

const T = 18; // board
const LEG = 80; // METOD legs, as fitted
const GAP = 3; // between fronts

const BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const CAM: HwDef = { kind: "cam", len: 13, dia: 15 };
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const NAIL: HwDef = { kind: "nail", len: 20, dia: 1.6 };
const EURO: HwDef = { kind: "screw", len: 11, dia: 5 }; // flat-head screws into the pre-drilled holes
const RAIL_SCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
const SMALL: HwDef = { kind: "screw", len: 15, dia: 3.5 };
const CLIP: HwDef = { kind: "clip", len: 16, dia: 22 };
const SUSPENSION: HwDef = { kind: "angle", len: 70, dia: 52 };
const HOOK: HwDef = { kind: "hook", len: 40, dia: 24 };
const COVER: HwDef = { kind: "cap", len: 12, dia: 44 };
const PIN: HwDef = { kind: "pin", len: 16, dia: 5 };
const CONNECTOR: HwDef = { kind: "pin", len: 14, dia: 8 };
const HINGE: HwDef = { kind: "hinge", len: 50, dia: 35 };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 10 };
const FRONT_FIT: HwDef = { kind: "connector", len: 40, dia: 24 };
const BRACKET: HwDef = { kind: "angle", len: 50, dia: 30 };

interface Unit {
  kind: Kind;
  W: number;
  H: number;
  D: number;
  y0: number; // underside of the frame
  app: boolean; // the appliance version of its manual
  sideL: string;
  sideR: string;
  top?: string;
  bottom: string;
  backs: string[];
  rails: string[];
}

interface Band {
  z: FitZone;
  lo: number;
  hi: number;
}

/** A drawer opening narrower than the cabinet: its centre, its width counted like a frame's, the panels its runners go on. */
interface Bay {
  xc: number;
  w: number;
  left: string;
  right: string;
  pad?: string; // where the left bumper sticks, when the left panel stops short of the front
  fx: number; // the front's centre and width
  fw: number;
}

interface Drawer {
  size: "low" | "medium" | "high";
  lo: number; // front, absolute
  hi: number;
  front: string;
  sides: [string, string];
  back: string;
  bottom: string;
  extras: string[]; // gallery rails or high sides
  yb: number; // underside of the box
  sh: number;
  dd: number;
  bw: number;
}

const r = (n: number) => Math.round(n * 10) / 10;
const zs = (D: number, n: number, k: number) => Array.from({ length: n }, (_, i) => r(-D / 2 + 40 + ((D - 80) * (i + k)) / Math.max(1, n - 1 + 2 * k)));

function kindOf(s: ProductSpec): Kind | null {
  const slug = s.slug ?? "";
  if (/corner|extr|extractor/.test(slug)) return null;
  if (/top-cab/.test(slug)) return "top";
  if (/wall-c/.test(slug)) return "wall";
  if (/high|hi-cab/.test(slug)) return "high";
  if (/base|sink/.test(slug)) return "base";
  return null;
}

/** Bare frames, sold without any fronts. */
const FRAME = /^metod-(base|high|wall|top)-cabinet-\d+-x-\d+-x-\d+$/;

/** The fronts from the bottom up: the fitted layout where there is one, otherwise what the name says. */
function bandsOf(s: ProductSpec, H: number, y0: number, W: number): Band[] {
  const slug = s.slug ?? "";
  const c = s.cabinet ?? {};
  let zones: FitZone[];
  if (FRAME.test(slug)) zones = [{ kind: "open", h: 0 }];
  else if (c.fit?.zones?.length) zones = c.fit.zones;
  else {
    const twoDoors = /2-doors|2-glass|2-drs/.test(slug);
    const shelves = /shelves|shlf|shelf/.test(slug) ? Math.max(1, c.shelves ?? 1) : (c.shelves ?? 0);
    const doors: FitZone[] = twoDoors && W <= 400
      ? [{ kind: "doors", h: 60, n: 1, shelves: 1 }, { kind: "doors", h: 0, n: 1, shelves: Math.max(0, shelves - 1) }]
      : [{ kind: "doors", h: 0, n: twoDoors ? 2 : 1, shelves }];
    zones = (c.drawers ?? 0) > 0 ? [...doors, { kind: "drawers", h: 20, n: 1 }] : doors;
  }
  const fixed = zones.reduce((a, z) => a + z.h * 10, 0);
  const free = zones.filter((z) => !z.h).length;
  const share = free ? Math.max(0, H - fixed) / free : 0;
  const out: Band[] = [];
  let y = y0;
  for (const z of zones) {
    const h = z.h ? z.h * 10 : share;
    out.push({ z, lo: y, hi: y + h });
    y += h;
  }
  return out;
}

/** Front heights in a band of drawers, from the bottom: one tall front under two short ones when there are three. */
function frontHeights(h: number, n: number) {
  if (n === 3 && h >= 600) return [h / 2, h / 4, h / 4];
  return Array.from({ length: n }, () => h / n);
}

class Metod {
  b: PlanBuilder;
  s: ProductSpec;
  W: number;
  Htot: number;
  D: number;
  y0: number;
  kind: Kind;
  units: Unit[] = [];
  types = new Map<string, string>();
  fz: number; // centre of the fronts
  knivshult: boolean;

  constructor(b: PlanBuilder, s: ProductSpec, kind: Kind) {
    this.b = b;
    this.s = s;
    this.kind = kind;
    this.W = s.size.w * 10;
    this.Htot = s.size.h * 10;
    this.D = s.size.d >= 55 ? 600 : 370;
    this.y0 = kind === "base" || kind === "high" ? LEG : 0;
    this.fz = this.D / 2 + 2 + T / 2;
    this.knivshult = /knivshult/.test(s.slug ?? "");
  }

  part(name: string, size: Vec3, pos: Vec3, o: { material?: "board" | "fiber" | "wood" | "metal"; shape?: "box" | "cyl"; extra?: boolean; rot?: Vec3 } = {}) {
    const k = `${name}|${size.map(Math.round).join("x")}|${o.material ?? "board"}|${o.shape ?? "box"}`;
    let ref = this.types.get(k);
    if (!ref) {
      ref = this.b.part(name, size, { material: o.material ?? "board", shape: o.shape, extra: o.extra });
      this.types.set(k, ref);
    }
    return this.b.place(ref, pos, o.rot ?? [0, 0, 0]);
  }

  pos(key: string) {
    return this.b.partItem(key).final.pos;
  }

  /** Where a frame is built: the main scene, or its own one for a top cabinet built before it goes on the high cabinet. */
  alt?: string;
  origin: Vec3 = [0, 0, 0];
  poses = new Map<string, Pose>();

  put(key: string, from: Vec3) {
    if (!this.alt) return this.b.add(key, from);
    const p = this.pos(key);
    this.b.stage(key, [p[0] - this.origin[0], p[1] - this.origin[1], p[2] - this.origin[2]], [0, 0, 0], from);
  }

  step(def: { title: string; detail?: string; kind: StepKind; tools?: ToolId[]; people?: 1 | 2; pose?: Pose; warnings?: WarnId[]; scene?: string; repeat?: number; check?: "square"; wall?: boolean }, body: () => void) {
    const warnings = [...(def.warnings ?? [])];
    if (def.people === 2 && !warnings.includes("two")) warnings.unshift("two");
    const scene = def.scene ?? (this.alt && def.kind !== "anchor" ? this.alt : "main");
    // a pose holds in its scene until a later step there changes it
    const pose = def.pose ?? this.poses.get(scene) ?? "+y";
    this.poses.set(scene, pose);
    this.b.step({ ...def, scene, pose, warnings: warnings.slice(0, 3) }, body);
  }

  /* ---------- the frame ---------- */

  frame(kind: Kind, H: number, y0: number, app: boolean): Unit {
    const { W, D } = this;
    const sideL = this.part("Side panel", [T, H, D], [-(W / 2 - T / 2), y0 + H / 2, 0]);
    const sideR = this.part("Side panel", [T, H, D], [W / 2 - T / 2, y0 + H / 2, 0]);
    const bottom = this.part("Bottom panel", [W - 2 * T, T, D], [0, y0 + T / 2, 0]);
    const top = kind === "base" ? undefined : this.part("Top panel", [W - 2 * T, T, D], [0, y0 + H - T / 2, 0]);
    const rails = kind === "base" ? [-1, 1].map((sz) => this.part("Rail", [W - 2 * T, 16, 60], [0, y0 + H - 8, sz * (D / 2 - 30)], { material: "metal" })) : [];
    // the back of an appliance high cabinet comes in two pieces, with a gap behind the appliance for air
    const split = kind === "high" && app && H >= 2000;
    const backs = split
      ? [this.part("Back panel", [W, 700, 3], [0, y0 + 350, -D / 2 - 1.5], { material: "fiber" }), this.part("Back panel", [W, H - 900, 3], [0, y0 + 900 + (H - 900) / 2, -D / 2 - 1.5], { material: "fiber" })]
      : [this.part("Back panel", [W, H, 3], [0, y0 + H / 2, -D / 2 - 1.5], { material: "fiber" })];
    const u: Unit = { kind, W, H, D, y0, app, sideL, sideR, top, bottom, backs, rails };
    this.units.push(u);
    return u;
  }

  /** Cam bolts and dowels at one joint between a side and the top or bottom. */
  joint(u: Unit, sx: -1 | 1, yTop: boolean) {
    const n = u.D >= 500 ? 3 : 2;
    const y = yTop ? u.y0 + u.H - T / 2 : u.y0 + T / 2;
    const x = sx * (u.W / 2 - T);
    const side = sx < 0 ? u.sideL : u.sideR;
    const panel = yTop ? u.top! : u.bottom;
    const bz = zs(u.D, n, 0.5);
    const dz = zs(u.D, n, 0).map((z, i) => r(z + (i === n - 1 ? -20 : 20)));
    return {
      bolts: bz.map((z): FitOpts => ({ on: side, at: [x, y, z], dir: [sx, 0, 0], mate: panel })),
      cams: bz.map((z): FitOpts => ({ on: panel, at: [x - sx * 34, yTop ? y - T / 2 : y + T / 2, z], dir: [0, yTop ? 1 : -1, 0] })),
      dowelsInSide: dz.map((z): FitOpts => ({ on: side, at: [x, y, z], dir: [sx, 0, 0], mate: panel })),
      dowelsInPanel: dz.map((z): FitOpts => ({ on: panel, at: [x, y, z], dir: [-sx, 0, 0], mate: side })),
    };
  }

  suspension(u: Unit) {
    const y = u.y0 + u.H - (u.top ? T : 0) - 45;
    return ([-1, 1] as const).map((sx) => {
      const side = sx < 0 ? u.sideL : u.sideR;
      const x = sx * (u.W / 2 - T);
      return {
        side,
        sx,
        at: [x, y, -u.D / 2 + 28] as Vec3,
        screws: [
          [x, y + 22, -u.D / 2 + 14],
          [x, y - 22, -u.D / 2 + 14],
          [x, y, -u.D / 2 + 44],
        ] as Vec3[],
      };
    });
  }

  /** Lay both sides flat, inside up, and put in what goes in them before the frame is joined. */
  prepSides(u: Unit, title: string, detail: string, body: () => void) {
    this.step({ title, detail, kind: "cams", tools: ["screwdriver"], scene: "prep", warnings: ["floor"] }, () => {
      this.b.stagger(0.25);
      this.b.stage(u.sideL, [0, T / 2, -(u.D / 2 + 40)], [0, 0, Math.PI / 2], [0, 160, 0]);
      this.b.stage(u.sideR, [0, T / 2, u.D / 2 + 40], [0, 0, -Math.PI / 2], [0, 160, 0]);
      this.b.then(0.15);
      body();
    });
  }

  buildFrame(u: Unit) {
    const b = this.b;
    const tall = u.kind === "high";
    const jL = (yTop: boolean) => this.joint(u, -1, yTop);
    const jR = (yTop: boolean) => this.joint(u, 1, yTop);
    const ends = u.kind === "base" ? [false] : [false, true];
    const nBolts = ends.length * 2 * (u.D >= 500 ? 3 : 2);

    this.prepSides(u, "Screw the cam bolts into both sides", `${nBolts} in all, into the holes nearest the ends. Turn them in by hand until they stop.`, () => {
      b.fits(BOLT, ends.flatMap((e) => [...jL(e).bolts, ...jR(e).bolts]), 0.06);
    });

    if (u.kind === "base") {
      this.step(
        { title: "Tap in the dowels and join the sides to the bottom", detail: "Lay it on its back on the rug. Dowels into the bottom's ends, then press both sides on.", kind: "dowels", tools: ["hammer"], pose: "+z", warnings: ["floor"] },
        () => {
          this.put(u.bottom, [0, 0, 200]);
          b.then(0.1);
          b.fits(DOWEL, [...jL(false).dowelsInPanel, ...jR(false).dowelsInPanel], 0.06);
          b.then(0.1);
          b.stagger(0.3);
          this.put(u.sideL, [-260, 0, 0]);
          this.put(u.sideR, [260, 0, 0]);
        },
      );
      this.step({ title: "Lock the cams", detail: "Arrow towards the bolt, then turn each one clockwise until it bites.", kind: "cams", tools: ["screwdriver"] }, () => {
        b.fits(CAM, [...jL(false).cams, ...jR(false).cams], 0.1);
      });
    } else {
      this.prepSides(u, "Screw a suspension fitting onto each side", "In the top back corner, three small screws each. The big hole faces the back.", () => {
        for (const f of this.suspension(u)) {
          b.fit(SUSPENSION, { on: f.side, at: f.at, dir: [f.sx, 0, 0], hole: false });
          b.then(0.05);
          b.fits(EURO, f.screws.map((p) => ({ on: f.side, at: p, dir: [f.sx, 0, 0] as Vec3 })), 0.06);
        }
      });
      this.step(
        { title: "Tap dowels into one side and stand the top and bottom on it", detail: "That side lies flat on the rug, inside up.", kind: "dowels", tools: ["hammer"], pose: "-x", warnings: ["floor"] },
        () => {
          this.put(u.sideR, [0, 0, 0]);
          b.then(0.1);
          b.fits(DOWEL, [...jR(false).dowelsInSide, ...jR(true).dowelsInSide], 0.06);
          b.then(0.1);
          b.stagger(0.3);
          this.put(u.bottom, [-260, 0, 0]);
          this.put(u.top!, [-260, 0, 0]);
        },
      );
      this.step({ title: "Lock the cams on that side", detail: "Arrow towards the bolt, then turn clockwise until it bites.", kind: "cams", tools: ["screwdriver"] }, () => {
        b.fits(CAM, [...jR(false).cams, ...jR(true).cams], 0.1);
      });
    }

    this.step(
      { title: u.kind === "base" ? "Stand it up and slide the card from the box inside" : "Slide the card from the box inside", detail: "It keeps the frame from racking while you work on it. Take it out once the back is on.", kind: "general", pose: u.kind === "base" ? "+y" : "-x" },
      () => {},
    );

    if (u.kind !== "base") {
      this.step(
        { title: "Lower the other side onto the dowels", detail: "Dowels into the ends of the top and bottom first, then press the side down evenly.", kind: "dowels", tools: ["hammer"], people: tall ? 2 : 1 },
        () => {
          b.fits(DOWEL, [...jL(false).dowelsInPanel, ...jL(true).dowelsInPanel], 0.06);
          b.then(0.1);
          this.put(u.sideL, [-300, 0, 0]);
        },
      );
      this.step({ title: "Lock the cams on the second side", detail: "Turn each one until it pulls the side tight.", kind: "cams", tools: ["screwdriver"] }, () => {
        b.fits(CAM, [...jL(false).cams, ...jL(true).cams], 0.1);
      });
    } else this.baseRails(u);

    this.backSteps(u);

    if (u.kind === "base") {
      this.step(
        { title: "Stand it up and screw in the suspension fittings", detail: "One in each top back corner, three small screws each.", kind: "screws", tools: ["screwdriver"], pose: "+y" },
        () => {
          for (const f of this.suspension(u)) {
            b.fit(SUSPENSION, { on: f.side, at: f.at, dir: [f.sx, 0, 0], hole: false });
            b.then(0.05);
            b.fits(EURO, f.screws.map((p) => ({ on: f.side, at: p, dir: [f.sx, 0, 0] as Vec3 })), 0.06);
          }
        },
      );
    }
    if (u.kind === "base" || u.kind === "high") this.legs(u);
  }

  /** A base cabinet's two rails across the top: one piece clicked together, with its plastic clips for the worktop. */
  baseRails(u: Unit) {
    const b = this.b;
    const clipsPerRail = u.W <= 400 ? 1 : u.W <= 600 ? 2 : 3;
    const railScrews = (rail: string): FitOpts[] => {
      const z = this.pos(rail)[2];
      return [-1, 1].map((sx) => ({ on: rail, at: [sx * (u.W / 2 - T / 2), u.y0 + u.H, z] as Vec3, dir: [0, -1, 0] as Vec3, mate: sx < 0 ? u.sideL : u.sideR }));
    };
    const clips = (rail: string): FitOpts[] => {
      const z = this.pos(rail)[2];
      return Array.from({ length: clipsPerRail }, (_, i) => ({ on: rail, at: [r(-u.W / 2 + T + ((u.W - 2 * T) * (i + 1)) / (clipsPerRail + 1)), u.y0 + u.H, z] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const }));
    };
    if (u.app) {
      // the cabinet for a sink or an appliance: back rail first, then the front one
      for (const [i, rail] of [u.rails[0], u.rails[1]].entries()) {
        this.step(
          { title: i === 0 ? "Screw the back rail across the top" : "Screw the front rail across the top", detail: i === 0 ? "Flush with the back edges of the sides, one screw at each end." : "Flush with the front edges. Click its clips on first if your cabinet has drawers.", kind: "screws", tools: ["screwdriver"] },
          () => {
            this.put(rail, [0, 200, 0]);
            b.then(0.1);
            if (i === 1) {
              b.fits(CLIP, clips(rail), 0.08);
              b.then(0.05);
            }
            b.fits(RAIL_SCREW, railScrews(rail), 0.12);
          },
        );
      }
      return;
    }
    this.step(
      { title: "Click the clips onto the rails and screw them across the top", detail: "One rail at the front, one at the back, each with a screw into the top of each side.", kind: "screws", tools: ["screwdriver"] },
      () => {
        b.stagger(0.3);
        for (const rail of u.rails) this.put(rail, [0, 220, 0]);
        b.then(0.1);
        b.fits(CLIP, u.rails.flatMap(clips), 0.08);
        b.then(0.05);
        b.fits(RAIL_SCREW, u.rails.flatMap(railScrews), 0.12);
      },
    );
  }

  backSteps(u: Unit) {
    const b = this.b;
    const zb = -u.D / 2 - 3;
    const x0 = -u.W / 2 + T / 2, x1 = u.W / 2 - T / 2;
    const yb = u.y0 + T / 2, yt = u.y0 + u.H - (u.top ? T / 2 : 8);
    const host = (x: number) => (x < 0 ? u.sideL : u.sideR);
    const nail = (x: number, y: number, on?: string): FitOpts => ({ on: on ?? host(x), at: [r(x), r(y), zb], dir: [0, 0, 1], hole: false });
    const edge = u.kind === "base" ? 10 : u.kind === "top" ? 8 : u.kind === "wall" ? 10 : u.app && u.H >= 2000 ? 23 : 25;
    this.step(
      {
        title: "Lay it on its front and nail the back on at three corners",
        detail: "Check it's square first: both diagonals the same. One nail in a bottom corner, then the other bottom corner, then a top one.",
        kind: "nails",
        tools: ["hammer", "tape"],
        pose: "-z",
        check: "square",
        warnings: ["square", "floor"],
      },
      () => {
        b.stagger(0.25);
        for (const k of u.backs) this.put(k, [0, 0, -260]);
        b.then(0.1);
        b.fits(NAIL, [nail(x0 + 10, yb), nail(x1 - 10, yb), nail(x0 + 10, yt - 20)], 0.25);
      },
    );
    this.step({ title: "Nail on the two plastic brackets at the top", detail: "One in each top corner of the back, one nail each.", kind: "nails", tools: ["hammer"] }, () => {
      const pts: Vec3[] = [
        [x0 + 40, yt - 10, zb],
        [x1 - 40, yt - 10, zb],
      ];
      b.fits(CLIP, pts.map((p) => ({ on: host(p[0]), at: p, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.2);
      b.then(0.05);
      b.fits(NAIL, pts.map((p) => nail(p[0], p[1])), 0.15);
    });
    this.step({ title: "Nail the rest of the back", detail: "Along the edges, into the sides and the bottom, about a hand apart.", kind: "nails", tools: ["hammer"] }, () => {
      // shared along both sides and the bottom (and the top), longest edges first
      const list: FitOpts[] = [];
      const along = u.top ? [u.H, u.H, u.W, u.W] : [u.H, u.H, u.W];
      const total = along.reduce((a, b2) => a + b2, 0);
      const ns = along.map((l) => Math.max(1, Math.round((edge * l) / total)));
      let left = edge - ns.reduce((a, b2) => a + b2, 0);
      for (let i = 0; left !== 0; i = (i + 1) % ns.length) {
        ns[i] += Math.sign(left);
        left -= Math.sign(left);
      }
      const ys = (n: number) => Array.from({ length: n }, (_, i) => u.y0 + 80 + ((u.H - 160) * (i + 0.5)) / n);
      const xs = (n: number) => Array.from({ length: n }, (_, i) => -u.W / 2 + 60 + ((u.W - 120) * (i + 0.5)) / n);
      for (const y of ys(ns[0])) list.push(nail(x0, y));
      for (const y of ys(ns[1])) list.push(nail(x1, y));
      for (const x of xs(ns[2])) list.push(nail(x, yb, u.bottom));
      if (u.top) for (const x of xs(ns[3])) list.push(nail(x, u.y0 + u.H - T / 2, u.top));
      b.fits(NAIL, list, 0.05);
    });
  }

  legs(u: Unit) {
    const b = this.b;
    const xs = [-1, 1].map((sx) => sx * (u.W / 2 - 40));
    const zz = [-1, 1].map((sz) => sz * (u.D / 2 - 60));
    const legs = xs.flatMap((x) => zz.map((z) => this.part("Leg", [36, LEG, 36], [x, LEG / 2, z], { material: "metal", shape: "cyl" })));
    this.step(
      { title: "Lay it on its back and click on the legs", detail: "Four legs, one near each corner. Screw them out until the cabinet stands level.", kind: "legs", pose: "+z", warnings: ["floor"] },
      () => {
        b.stagger(0.22);
        for (const k of legs) b.add(k, [0, -200, 0]);
      },
    );
    this.step(
      { title: "Stand it up together", detail: "Lift it upright between you. Don't drag or tip it on its legs: they can snap off.", kind: "standup", people: 2, pose: "+y", warnings: ["two"] },
      () => {},
    );
  }

  /** On the METOD suspension rail: the rail is screwed to the wall, the cabinet hooks onto it and is pulled tight. */
  hang(u: Unit) {
    const b = this.b;
    const yr = u.y0 + u.H - (u.top ? T : 0) - 45;
    const rail = this.part("Suspension rail", [u.W, 40, 8], [0, yr, -u.D / 2 - 3 - 4], { material: "metal", extra: true });
    const tall = u.kind === "high";
    this.step(
      {
        title: "Screw the suspension rail to the wall and hang the cabinet on it",
        detail: "Level the rail first. The hooks on the fittings drop over it. Wall screws and plugs aren't included: pick ones made for your wall.",
        kind: "anchor",
        tools: ["drill", "level", "pencil", "screwdriver"],
        people: tall ? 2 : 1,
        pose: "+y",
        wall: true,
        warnings: ["wall"],
      },
      () => {
        b.add(rail, [0, 0, -120]);
        b.then(0.1);
        const ends = [-1, 1].map((sx) => sx * (u.W / 2 - 50));
        b.fits(HW.plug, ends.map((x) => ({ at: [x, yr, -u.D / 2 - 11] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.1);
        b.then(0.05);
        b.fits(HW.wallScrew, ends.map((x) => ({ on: rail, at: [x, yr, -u.D / 2 - 3] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.1);
        b.then(0.1);
        b.fits(
          HOOK,
          this.suspension(u).map((f) => ({ on: f.side, at: [f.at[0] - f.sx * 14, f.at[1], f.at[2]] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })),
          0.15,
        );
      },
    );
    this.step(
      { title: "Pull it tight against the wall", detail: "Turn the screw in each fitting: one moves the cabinet up or down, the other pulls it back to the rail.", kind: "screws", tools: ["screwdriver"] },
      () => {},
    );
    this.step({ title: "Click on the cover caps", detail: "One over each suspension fitting.", kind: "general" }, () => {
      b.fits(COVER, this.suspension(u).map((f) => ({ on: f.side, at: [f.at[0] - f.sx * 18, f.at[1], f.at[2] + 10] as Vec3, dir: [-f.sx, 0, 0] as Vec3, hole: false as const })), 0.2);
    });
  }

  /** A top cabinet that sits on a high cabinet: four screws down through its bottom into the high cabinet's top. */
  joinTop(lower: Unit, upper: Unit) {
    const b = this.b;
    this.step({ title: "Screw the top cabinet down onto the high cabinet", detail: "Four screws down through its bottom into the high cabinet's top, near the corners.", kind: "screws", tools: ["screwdriver"] }, () => {
      const y = upper.y0 + T;
      const pts: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (upper.W / 2 - T - 40), y, sz * (upper.D / 2 - 60)] as Vec3));
      b.fits({ kind: "screw", len: 30, dia: 4 }, pts.map((p) => ({ on: upper.bottom, at: p, dir: [0, -1, 0] as Vec3, mate: lower.top })), 0.12);
    });
  }

  unitAt(y: number) {
    return this.units.find((u) => y >= u.y0 - 1 && y <= u.y0 + u.H + 1) ?? this.units[0];
  }

  /* ---------- inside ---------- */

  /** UTRUSTA shelves resting on four pins each. */
  shelves(ys: number[]) {
    if (!ys.length) return;
    const b = this.b;
    const { W, D } = this;
    const keys = ys.map((y) => this.part("Shelf", [W - 2 * T - 2, 16, D - 40], [0, y + 8, -10]));
    this.step(
      {
        title: ys.length > 1 ? "Push in the shelf pins and lay the shelves on" : "Push in the shelf pins and lay the shelf on",
        detail: "Four pins at the same height for each shelf. Pick any holes you like.",
        kind: "shelves",
      },
      () => {
        const pins: FitOpts[] = [];
        for (const y of ys) {
          const u = this.unitAt(y);
          for (const sx of [-1, 1]) for (const z of [-(D / 2 - 60), D / 2 - 80]) pins.push({ on: sx < 0 ? u.sideL : u.sideR, at: [sx * (W / 2 - T), y - 3, z], dir: [sx, 0, 0] });
        }
        b.fits(PIN, pins, 0.06);
        b.then(0.1);
        b.stagger(0.3);
        for (const k of keys) b.add(k, [0, 0, 360]);
      },
    );
  }

  /** A fixed shelf held by six shelf connectors, three into each side. */
  fixedShelf(y: number, title: string, detail: string) {
    const b = this.b;
    const { W, D } = this;
    const u = this.unitAt(y);
    const k = this.part("Fixed shelf", [W - 2 * T, T, D - 20], [0, y + T / 2, -10]);
    this.step({ title, detail, kind: "shelves", tools: ["screwdriver"] }, () => {
      b.add(k, [0, 0, 380]);
      b.then(0.12);
      const list: FitOpts[] = [];
      for (const sx of [-1, 1]) for (const z of zs(D - 20, 3, 0.5)) list.push({ on: sx < 0 ? u.sideL : u.sideR, at: [sx * (W / 2 - T), y + T / 2, z - 10], dir: [sx, 0, 0], mate: k });
      b.fits(CONNECTOR, list, 0.08);
    });
  }

  /** Doors on UTRUSTA hinges: hinges pressed into the door, the plates screwed to the side, the door clicked on. */
  doors(bands: Band[]) {
    const b = this.b;
    const { W, D } = this;
    interface Door {
      key: string;
      sx: -1 | 1; // hinge side
      x: number;
      lo: number;
      hi: number;
      dw: number;
      ys: number[];
    }
    const list: Door[] = [];
    for (const bd of bands) {
      const n = bd.z.n ?? 1;
      const dh = bd.hi - bd.lo - GAP;
      const dw = n === 2 ? W / 2 - GAP / 2 - 1 : W - GAP;
      const hn = dh <= 1000 ? 2 : dh <= 1600 ? 3 : 4;
      const ys = Array.from({ length: hn }, (_, i) => r(bd.lo + 100 + ((dh - 200) * i) / (hn - 1)));
      for (let i = 0; i < n; i++) {
        const x = n === 2 ? (i === 0 ? -1 : 1) * (W / 4) : 0;
        const key = this.part(/glass/.test(this.s.slug ?? "") ? "Glass door" : "Door", [r(dw), r(dh), T], [x, r(bd.lo + (bd.hi - bd.lo) / 2), this.fz]);
        list.push({ key, sx: n === 2 && i === 1 ? 1 : -1, x, lo: bd.lo, hi: bd.hi, dw, ys });
      }
    }
    if (!list.length) return;
    const many = list.length > 1;
    const hingeAt = (d: Door, y: number): Vec3 => [r(d.x + d.sx * (d.dw / 2 - 22)), y, this.fz - T / 2];
    this.step(
      { title: many ? "Press the hinges into the doors" : "Press the hinges into the door", detail: "Lay the door face down on the rug. Each hinge clicks into its round hole; press the lever flat.", kind: "hinges", scene: "doors", warnings: ["floor", "face"] },
      () => {
        b.stagger(0.2);
        let off = 0;
        list.forEach((d) => {
          b.stage(d.key, [off + d.dw / 2, T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
          off += d.dw + 80;
        });
        b.then(0.1);
        b.fits(HINGE, list.flatMap((d) => d.ys.map((y) => ({ on: d.key, at: hingeAt(d, y), dir: [0, 0, 1] as Vec3, twist: d.sx > 0 ? Math.PI : 0 }))), 0.1);
      },
    );
    this.step(
      { title: "Screw the hinge plates onto the side", detail: "Line each plate up with its hinge, two screws each, in the holes at the front edge.", kind: "screws", tools: ["screwdriver"] },
      () => {
        const sc: FitOpts[] = [];
        for (const d of list)
          for (const y of d.ys) {
            const u = this.unitAt(y);
            for (const dy of [-16, 16]) sc.push({ on: d.sx < 0 ? u.sideL : u.sideR, at: [d.sx * (W / 2 - T), y + dy, D / 2 - 37], dir: [d.sx, 0, 0] });
          }
        b.fits(EURO, sc, 0.05);
      },
    );
    const tall = list.some((d) => d.hi - d.lo > 1500);
    this.step(
      { title: many ? "Click the doors onto the plates" : "Click the door onto the plates", detail: "Hook each hinge arm over its plate and press until it clicks.", kind: "doors", people: tall ? 2 : 1 },
      () => {
        b.stagger(0.35);
        for (const d of list) b.add(d.key, [0, 0, 380]);
      },
    );
    this.step(
      { title: many ? "Line up the doors and stick on the bumpers" : "Line up the door and stick on the bumpers", detail: "Turn the hinge screws until the gaps are even. A bumper goes inside each door, near the corners away from the hinges.", kind: "doors", tools: ["screwdriver"] },
      () => {
        const pads: FitOpts[] = [];
        for (const d of list) for (const y of [d.lo + 60, d.hi - 60]) pads.push({ on: d.key, at: [r(d.x - d.sx * (d.dw / 2 - 20)), r(y), this.fz - T / 2], dir: [0, 0, 1], hole: false });
        b.fits(BUMPER, pads, 0.1);
      },
    );
  }

  /** The fixed front above a sink: two brackets on its back, screwed into the sides. */
  sinkFront(bd: Band) {
    const b = this.b;
    const { W, D } = this;
    const fh = bd.hi - bd.lo - GAP;
    const key = this.part("Front", [W - GAP, r(fh), T], [0, r((bd.lo + bd.hi) / 2), this.fz]);
    const y = r((bd.lo + bd.hi) / 2);
    const brackets = [-1, 1].map((sx) => [sx * (W / 2 - T - 15), y, this.fz - T / 2] as Vec3);
    this.step({ title: "Screw the two brackets onto the back of the front", detail: "Face down on the rug, one at each end, two screws each.", kind: "screws", tools: ["screwdriver"], scene: "fronts", warnings: ["floor", "face"] }, () => {
      b.stage(key, [0, T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
      b.then(0.1);
      b.fits(BRACKET, brackets.map((p) => ({ on: key, at: p, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.15);
      b.then(0.05);
      b.fits(SMALL, brackets.flatMap((p) => [-1, 1].map((d) => ({ on: key, at: [p[0], p[1] + d * 18, p[2]] as Vec3, dir: [0, 0, 1] as Vec3 }))), 0.08);
    });
    this.step({ title: "Screw the front to the sides", detail: "Hold it level with the top, then two screws through each bracket into the side.", kind: "screws", tools: ["screwdriver"] }, () => {
      b.add(key, [0, 0, 360]);
      b.then(0.12);
      const u = this.unitAt(y);
      b.fits(EURO, [-1, 1].flatMap((sx) => [-1, 1].map((d) => ({ on: sx < 0 ? u.sideL : u.sideR, at: [sx * (W / 2 - T), y + d * 18, D / 2 - 20] as Vec3, dir: [sx, 0, 0] as Vec3 }))), 0.1);
    });
  }

  /**
   * MAXIMERA or KNIVSHULT drawers: each box built on the floor and clicked onto its front, runners into the cabinet.
   * A bay narrower than the cabinet (a corner cabinet's door opening) gives its own centre, width and panels.
   */
  drawers(bands: Band[], bay?: Bay) {
    const b = this.b;
    const D = this.D;
    const W = bay?.w ?? this.W;
    const xc = bay?.xc ?? 0;
    const host = (sx: number, y: number) => {
      if (bay) return sx < 0 ? bay.left : bay.right;
      const u = this.unitAt(y);
      return sx < 0 ? u.sideL : u.sideR;
    };
    const bw = W - 2 * T - 26;
    const dd = Math.max(250, Math.floor((D - 60) / 50) * 50);
    const zc = D / 2 - 2 - dd / 2;
    const list: Drawer[] = [];
    for (const bd of bands) {
      let y = bd.lo;
      for (const h of frontHeights(bd.hi - bd.lo, bd.z.n ?? 1)) {
        const lo = y, hi = y + h;
        y = hi;
        const size = h <= 150 ? "low" : h <= 300 ? "medium" : "high";
        const sh = size === "low" ? 70 : 120;
        const yb = lo + 18;
        const front = this.part("Drawer front", [bay?.fw ?? W - GAP, r(h - GAP), T], [bay?.fx ?? 0, r((lo + hi) / 2), this.fz]);
        const sides = [-1, 1].map((sx) => this.part("Drawer side", [16, sh, dd], [xc + sx * (bw / 2 - 8), yb + sh / 2, zc], { material: "metal" })) as [string, string];
        // the bottom runs under the back, so its screw goes up through the bottom into the back's lower edge
        const back = this.part("Drawer back", [bw - 32, sh - 16, 16], [xc, yb + 12 + (sh - 16) / 2, zc - dd / 2 + 10]);
        const bottom = this.part("Drawer bottom", [bw - 32, 12, dd - 4], [xc, yb + 6, zc]);
        const extras =
          size === "medium"
            ? [-1, 1].map((sx) => this.part("Gallery rail", [12, 12, dd - 20], [xc + sx * (bw / 2 - 8), yb + sh + 40, zc + 8], { material: "metal" }))
            : size === "high"
              ? [-1, 1].map((sx) => this.part("High side", [8, 140, dd - 20], [xc + sx * (bw / 2 - 8), yb + sh + 80, zc + 8], { material: "metal" }))
              : [];
        list.push({ size, lo, hi, front, sides, back, bottom, extras, yb, sh, dd, bw });
      }
    }
    if (!list.length) return;

    const fronts = (d: Drawer) => [-1, 1].map((sx) => [xc + sx * (d.bw / 2 - 8), r(d.yb + d.sh / 2), this.fz - T / 2] as Vec3);
    const frontScrews = (d: Drawer) => fronts(d).flatMap((p) => [-1, 1].map((k) => ({ on: d.front, at: [p[0] + k * 12, p[1], p[2]] as Vec3, dir: [0, 0, 1] as Vec3 })));
    const bottomScrew = (d: Drawer): FitOpts => ({ on: d.bottom, at: [xc, d.yb, zc - dd / 2 + 10], dir: [0, 1, 0], mate: d.back });
    const name = this.knivshult ? "KNIVSHULT" : "MAXIMERA";

    // one of each size is built in its own scene, the rest come ready made
    const sizes = [...new Set(list.map((d) => d.size))];
    for (const size of sizes) {
      const group = list.filter((d) => d.size === size);
      const d0 = group[0];
      const c0: Vec3 = [xc, d0.yb + 80, zc];
      const rel = (k: string): Vec3 => {
        const p = this.pos(k);
        return [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
      };
      const rep = group.length > 1 ? group.length : undefined;
      const which = sizes.length > 1 ? ` ${size}` : "";
      this.step(
        { title: `Click the back onto the${which} drawer sides`, detail: `The ${name} sides hook onto each end of the back with a click.`, kind: "drawer", scene: `drawer-${size}`, repeat: rep, warnings: ["floor"] },
        () => {
          b.stagger(0.25);
          for (const k of [...d0.sides, d0.back]) b.stage(k, rel(k), [0, 0, 0], [0, 0, -260]);
        },
      );
      this.step(
        { title: "Slide the bottom in and screw it to the back", detail: "It runs in the grooves of the sides. One screw up through the bottom into the back.", kind: "drawer", tools: ["screwdriver"], scene: `drawer-${size}`, repeat: rep },
        () => {
          b.stage(d0.bottom, rel(d0.bottom), [0, 0, 0], [0, 0, 420]);
          b.then(0.1);
          b.fit(SMALL, bottomScrew(d0));
        },
      );
      this.step(
        { title: "Screw the front fittings on and click the front onto the drawer", detail: "One fitting at each end of the front's back, two screws each. Then push the drawer onto them until both click.", kind: "drawer", tools: ["screwdriver"], scene: `drawer-${size}`, repeat: rep },
        () => {
          b.stage(d0.front, rel(d0.front), [0, 0, 0], [0, 0, 300]);
          b.then(0.1);
          b.fits(FRONT_FIT, fronts(d0).map((p) => ({ on: d0.front, at: p, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.15);
          b.then(0.05);
          b.fits(EURO, frontScrews(d0), 0.06);
        },
      );
      if (d0.extras.length) {
        this.step(
          { title: size === "medium" ? "Click the gallery rails on" : "Click the high sides on", detail: size === "medium" ? "Left and right are marked. Each one clicks into the front and the back." : "They slide into the top of each drawer side and click into the front.", kind: "drawer", scene: `drawer-${size}`, repeat: rep },
          () => {
            b.stagger(0.25);
            for (const k of d0.extras) b.stage(k, rel(k), [0, 0, 0], [0, 200, 0]);
          },
        );
      }
    }

    const runnerDef: HwDef = { kind: "runner", len: dd, dia: 20 };
    this.step(
      { title: list.length > 1 ? "Screw the runners into the cabinet" : "Screw the runners into the cabinet", detail: "A pair for each drawer, front end flush with the frame, in the holes the drawer's height needs.", kind: "runners", tools: ["screwdriver"] },
      () => {
        const runners: FitOpts[] = [];
        const screws: FitOpts[] = [];
        for (const d of list) {
          for (const sx of [-1, 1] as const) {
            const side = host(sx, d.yb);
            const x = xc + sx * (W / 2 - T);
            runners.push({ on: side, at: [x, d.yb + 4, zc], dir: [sx, 0, 0], hole: false });
            for (const dz of [-dd / 2 + 30, -dd / 2 + 70, dd / 2 - 60, dd / 2 - 25]) screws.push({ on: side, at: [x - sx * 10, d.yb + 4, r(zc + dz)], dir: [sx, 0, 0] });
          }
        }
        b.fits(runnerDef, runners, 0.1);
        b.then(0.1);
        b.fits(EURO, screws, 0.03);
      },
    );
    this.step(
      { title: list.length > 1 ? `Put the ${list.length} drawers on the runners` : "Put the drawer on the runners", detail: "Pull the runners out, rest the drawer on them and push it in until it clicks.", kind: "drawer" },
      () => {
        const first = new Set(sizes.map((sz) => list.find((d) => d.size === sz)));
        for (const d of list) {
          b.stagger(0);
          for (const k of [d.front, ...d.sides, d.back, d.bottom, ...d.extras]) b.add(k, [0, 0, 520]);
          if (!first.has(d)) {
            for (const p of fronts(d)) b.preset(FRONT_FIT, { on: d.front, at: p, dir: [0, 0, 1], hole: false });
            for (const o of frontScrews(d)) b.preset(EURO, o);
            b.preset(SMALL, bottomScrew(d));
          }
          b.wait(0.22);
        }
      },
    );
    this.step({ title: "Stick on the bumpers", detail: "On the front edges of the sides, where each drawer front closes against them.", kind: "general" }, () => {
      const pads: FitOpts[] = [];
      for (const d of list) {
        for (const sx of [-1, 1] as const) pads.push({ on: sx < 0 && bay?.pad ? bay.pad : host(sx, d.yb), at: [xc + sx * (W / 2 - T / 2), r((d.lo + d.hi) / 2), D / 2], dir: [0, 0, -1], hole: false });
      }
      b.fits(BUMPER, pads, 0.06);
    });
  }

  ready(use?: string) {
    const said: Record<string, [string, string]> = {
      sink: ["Ready for the sink", "The sink, tap and drain go in following their own instructions, or ask a plumber."],
      hob: ["Ready for the hob", "The hob goes in the worktop above. Have a qualified electrician connect it, or a gas engineer for gas."],
      oven: ["Ready for the oven", "Fit the oven following its own instructions. Have a qualified electrician connect it."],
      ovenhob: ["Ready for the oven and hob", "Fit them following their own instructions. Have a qualified electrician connect them."],
      fridge: ["Ready for the fridge", "Fit the fridge or freezer following its own instructions, then hang its doors on the special hinges."],
      microwave: ["Ready for the microwave", "Fit the microwave following its own instructions."],
      appliance: ["Ready for the appliances", "Fit each one following its own instructions. Have a qualified electrician connect them."],
    };
    const r2 = use ? said[use] : undefined;
    if (r2) this.step({ title: r2[0], detail: r2[1], kind: "general" }, () => {});
  }

  build() {
    const { s } = this;
    const fit = s.cabinet?.fit;
    const slug = s.slug ?? "";
    const use = fit?.use;
    const appliance = !!use && use !== "storage" && !/waste/.test(slug);

    // a 240 cm cabinet is a 200 cm high cabinet with a 40 cm top cabinet on it
    const units: { kind: Kind; H: number; y0: number; app: boolean }[] = [];
    if (this.kind === "high" && this.Htot >= 2400) {
      units.push({ kind: "high", H: 2000, y0: this.y0, app: true }, { kind: "top", H: this.Htot - 2000, y0: this.y0 + 2000, app: true });
    } else {
      const app = this.kind === "high" ? (this.Htot <= 1400 || /fridge|freezer|oven|ov-|built-in|applianc/.test(slug)) && !/micro/.test(slug) : appliance;
      units.push({ kind: this.kind, H: this.Htot, y0: this.y0, app });
    }
    const built = units.map((u) => this.frame(u.kind, u.H, u.y0, u.app));
    built.forEach((u, i) => {
      if (i === 0) {
        this.buildFrame(u);
        this.hang(u);
        return;
      }
      // the top cabinet is built on the floor, then lifted onto the high cabinet
      this.alt = "top";
      this.origin = [0, u.y0 - 300, 0];
      this.buildFrame(u);
      this.alt = undefined;
      this.step({ title: "Lift the top cabinet onto the high cabinet", detail: "Stand it upright on top, flush at the front and the sides.", kind: "join", people: 2 }, () => {
        this.b.stagger(0);
        for (const k of [u.sideL, u.sideR, u.top!, u.bottom, ...u.backs]) this.b.add(k, [0, 300, 0]);
      });
      this.joinTop(built[i - 1], u);
      this.hang(u);
    });

    const bands = bandsOf(s, this.Htot, this.y0, this.W);
    const top = this.y0 + this.Htot;
    const inside = (y: number) => y > this.y0 + T + 20 && y < top - T - 20;
    const unitTops = new Set(built.map((u) => Math.round(u.y0 + u.H)));

    // high cabinets: a fixed shelf where an appliance's opening starts and ends, or halfway in a plain one
    if (this.kind === "high") {
      const cuts: number[] = [];
      if (use === "fridge") {
        const fridgeTop = bands.length > 1 ? bands[bands.length - 1].lo : top - 600;
        if (inside(fridgeTop)) cuts.push(fridgeTop - T);
      } else
        for (const bd of bands) {
          if (bd.z.kind !== "gap") continue;
          if (inside(bd.lo)) cuts.push(bd.lo - T);
          if (inside(bd.hi) && !unitTops.has(Math.round(bd.hi))) cuts.push(bd.hi);
        }
      if (!appliance && !cuts.length && !built[0].app) {
        const doorSplit = bands.filter((bd) => bd.z.kind === "doors").length > 1 ? bands.find((bd) => bd.z.kind === "doors")!.hi : this.y0 + this.Htot / 2;
        cuts.push(doorSplit - T / 2);
      }
      cuts.forEach((y, i) =>
        this.fixedShelf(
          y,
          cuts.length > 1 ? (i === 0 ? "Fit the fixed shelf under the opening" : "Fit the fixed shelf over the opening") : use === "fridge" ? "Fit the fixed shelf over the fridge" : "Fit the fixed shelf",
          "Six shelf connectors, three into each side, hold it. Push them in and turn them until the shelf is locked.",
        ),
      );
    }

    const drawerBands = bands.filter((bd) => bd.z.kind === "drawers");
    this.drawers(drawerBands);

    // UTRUSTA shelves behind doors, and a shelf over a wall cabinet's microwave
    const shelfYs: number[] = [];
    for (const bd of bands) {
      const n = bd.z.kind === "doors" || bd.z.kind === "open" ? (bd.z.shelves ?? 0) : 0;
      for (let i = 1; i <= n; i++) shelfYs.push(r(bd.lo + ((bd.hi - bd.lo) * i) / (n + 1)));
      if (this.kind === "wall" && bd.z.kind === "gap" && inside(bd.hi)) shelfYs.push(r(bd.hi - 4));
    }
    this.shelves(shelfYs.filter(inside));

    const front = bands.find((bd) => bd.z.kind === "front");
    if (front) this.sinkFront(front);
    this.doors(bands.filter((bd) => bd.z.kind === "doors"));
    if (appliance) this.ready(use === "hood" ? undefined : use);
  }
}

/* ---------- the corner wall cabinet ---------- */

const CONFIRMAT: HwDef = { kind: "screw", len: 50, dia: 7, name: "Frame screw" };
const Q = Math.PI / 4;
const S2 = Math.SQRT2;

/**
 * METOD corner wall cabinet: its back corner goes into the corner of the room, an arm 37 cm deep along each wall with a
 * side panel at the end of each, and a diagonal front with one door. Built lying down: the top and bottom are screwed
 * to a narrow post that closes the back corner, the sides go on with cams, the two backs slide into their grooves and are
 * nailed, and it hangs on a suspension rail on each wall. The corner is at the back left.
 */
function cornerWall(m: Metod) {
  const { b, s } = m;
  const slug = s.slug ?? "";
  const W = m.W, D = m.W, H = m.Htot, A = 370;
  const x0 = -W / 2, z0 = -D / 2;
  const P1: Vec3 = [W / 2 - T, 0, z0 + A]; // front end of the right side's inner face
  const P2: Vec3 = [x0 + A, 0, D / 2 - T]; // front end of the front side's inner face
  const L = P1[0] - P2[0]; // the diagonal's run along each wall
  const n: Vec3 = [1 / S2, 0, 1 / S2]; // out through the front
  const u: Vec3 = [1 / S2, 0, -1 / S2]; // along the front, towards the right side
  const M: Vec3 = [(P1[0] + P2[0]) / 2, 0, (P1[2] + P2[2]) / 2];

  /** The top, the bottom or a shelf: an arm along each wall and the triangle up to the diagonal front. */
  const slab = (i: number, th: number): PartPiece[] => {
    const L2 = L - i * 2;
    const q: Vec3 = [x0 + A, 0, z0 + A];
    return [
      { shape: "box", size: [W - T - 2 * i, th, A - 2 * i], pos: [(x0 + W / 2 - T) / 2, 0, z0 + A / 2] },
      { shape: "box", size: [A - 2 * i, th, D / 2 - T - (z0 + A) - i], pos: [x0 + A / 2, 0, (z0 + A + D / 2 - T - i) / 2] },
      { shape: "box", size: [r(L2 * S2), th, r(L2 / S2)], pos: [r(q[0] + L2 / 4), 0, r(q[2] + L2 / 4)], rot: [0, Q, 0] },
    ];
  };
  const slabType = new Map<string, { type: string; mid: Vec3 }>();
  const slabPart = (name: string, i: number, th: number, y: number) => {
    const k = `${name}|${i}|${th}`;
    let c = slabType.get(k);
    if (!c) {
      c = b.compound(name, slab(i, th));
      slabType.set(k, c);
    }
    return b.place(c.type, [c.mid[0], y, c.mid[2]]);
  };

  const sideR = m.part("Side panel", [T, H, A], [W / 2 - T / 2, H / 2, z0 + A / 2]);
  const sideF = m.part("Side panel", [T, H, A], [x0 + A / 2, H / 2, D / 2 - T / 2], { rot: [0, Math.PI / 2, 0] });
  const bottom = slabPart("Top and bottom panel", 0, T, T / 2);
  const top = slabPart("Top and bottom panel", 0, T, H - T / 2);
  const pc: Vec3 = [x0 + 52, H / 2, z0 + 52];
  const post = m.part("Corner post", [130, H - 2 * T, T], pc, { rot: [0, Q, 0] });
  const backB = m.part("Back panel", [W, H, 3], [0, H / 2, z0 - 1.5], { material: "fiber" });
  const backL = m.part("Back panel", [W, H, 3], [x0 - 1.5, H / 2, 0], { material: "fiber", rot: [0, Math.PI / 2, 0] });

  // where the sides meet the top and bottom: two bolts and two dowels at each end of each side
  const joints = (side: string, yTop: boolean) => {
    const y = yTop ? H - T / 2 : T / 2;
    const right = side === sideR;
    const at = (f: number): Vec3 => (right ? [W / 2 - T, y, r(z0 + A * f)] : [r(x0 + A * f), y, D / 2 - T]);
    const out: Vec3 = right ? [1, 0, 0] : [0, 0, 1];
    const panel = yTop ? top : bottom;
    const cam = (p: Vec3): Vec3 => [p[0] - out[0] * 34, yTop ? H - T : T, p[2] - out[2] * 34];
    return {
      bolts: [0.3, 0.75].map((f): FitOpts => ({ on: side, at: at(f), dir: out, mate: panel })),
      cams: [0.3, 0.75].map((f): FitOpts => ({ on: panel, at: cam(at(f)), dir: [0, yTop ? 1 : -1, 0] })),
      dowels: [0.15, 0.9].map((f): FitOpts => ({ on: panel, at: at(f), dir: [-out[0], 0, -out[2]], mate: side })),
    };
  };
  const suspension = [
    { side: sideR, at: [W / 2 - T, H - T - 45, z0 + 28] as Vec3, out: [1, 0, 0] as Vec3, along: [0, 0, 1] as Vec3 },
    { side: sideF, at: [x0 + 28, H - T - 45, D / 2 - T] as Vec3, out: [0, 0, 1] as Vec3, along: [1, 0, 0] as Vec3 },
  ];

  m.step({ title: "Screw the top and bottom to the corner post", detail: "Stand them on their back edges with the post between them, two frame screws through each into its ends. Use the Allen key.", kind: "screws", tools: ["allen"], pose: "+z", warnings: ["floor"] }, () => {
    m.put(post, [0, 0, 0]);
    b.then(0.1);
    b.stagger(0.3);
    m.put(bottom, [0, -200, 0]);
    m.put(top, [0, 200, 0]);
    b.then(0.1);
    const ends = [-30, 30].map((d): Vec3 => [r(pc[0] + d * u[0]), 0, r(pc[2] + d * u[2])]);
    b.fits(CONFIRMAT, [...ends.map((p): FitOpts => ({ on: top, at: [p[0], H, p[2]], dir: [0, -1, 0], mate: post })), ...ends.map((p): FitOpts => ({ on: bottom, at: [p[0], 0, p[2]], dir: [0, 1, 0], mate: post }))], 0.1);
  });

  m.step({ title: "Screw the cam bolts into both sides", detail: "Eight in all, four near each end of the sides' inner faces. Turn them in by hand until they stop.", kind: "cams", tools: ["screwdriver"], scene: "prep", warnings: ["floor"] }, () => {
    b.stagger(0.25);
    b.stage(sideR, [0, T / 2, -(A / 2 + 40)], [0, 0, -Math.PI / 2], [0, 160, 0]);
    b.stage(sideF, [0, T / 2, A / 2 + 40], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.then(0.15);
    b.fits(BOLT, [sideR, sideF].flatMap((sd) => [false, true].flatMap((e) => joints(sd, e).bolts)), 0.06);
  });
  m.step({ title: "Screw a suspension fitting onto each side", detail: "In the top back corner of each side, two screws each. The big hole faces the back.", kind: "screws", tools: ["screwdriver"], scene: "prep" }, () => {
    for (const f of suspension) {
      b.fit(SUSPENSION, { on: f.side, at: f.at, dir: f.out, hole: false });
      b.then(0.05);
      b.fits(EURO, [-22, 22].map((d) => ({ on: f.side, at: [f.at[0] - f.along[0] * 14, f.at[1] + d, f.at[2] - f.along[2] * 14] as Vec3, dir: f.out })), 0.06);
    }
  });

  for (const [i, side] of [sideR, sideF].entries()) {
    const j = [joints(side, false), joints(side, true)];
    const away: Vec3 = side === sideR ? [300, 0, 0] : [0, 0, 300];
    m.step(
      { title: i === 0 ? "Tap in the dowels and press one side on" : "Tap in the dowels and press the other side on", detail: "Two dowels into the top and two into the bottom at that end, then push the side onto them, bolts into the holes.", kind: "dowels", tools: ["hammer"], pose: "+z" },
      () => {
        b.fits(DOWEL, j.flatMap((x) => x.dowels), 0.06);
        b.then(0.1);
        m.put(side, away);
      },
    );
    m.step({ title: "Lock the cams", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls the side tight.", kind: "cams", tools: ["screwdriver"] }, () => {
      b.fits(CAM, j.flatMap((x) => x.cams), 0.1);
    });
  }

  m.step({ title: "Turn it over and slide the backs in", detail: "Back up now. Each back runs in the grooves of the top and bottom, from its side panel to the post.", kind: "flip", pose: "-z", warnings: ["floor"] }, () => {
    b.stagger(0.35);
    m.put(backB, [0, 0, -260]);
    m.put(backL, [-260, 0, 0]);
  });
  const nailB = (x: number, y: number, on: string): FitOpts => ({ on, at: [r(x), r(y), z0 - 3], dir: [0, 0, 1], hole: false });
  const nailL = (z: number, y: number, on: string): FitOpts => ({ on, at: [x0 - 3, r(y), r(z)], dir: [1, 0, 0], hole: false });
  m.step({ title: "Square it up and nail each back at a corner", detail: "Push the frame until each back sits square in it, then one nail through each back at the bottom by its side, and one at the top.", kind: "nails", tools: ["hammer", "tape"], check: "square", warnings: ["square"] }, () => {
    b.fits(NAIL, [nailB(W / 2 - T / 2, T / 2, sideR), nailL(D / 2 - T / 2, T / 2, sideF), nailB(W / 2 - T / 2, H - T / 2, sideR)], 0.25);
  });
  m.step({ title: "Nail on the four plastic brackets", detail: "One in each top and bottom corner by the post, one nail each. They hold the backs tight against the post.", kind: "nails", tools: ["hammer"] }, () => {
    const pts: FitOpts[] = [nailB(x0 + 130, 40, bottom), nailB(x0 + 130, H - 40, top), nailL(z0 + 130, 40, bottom), nailL(z0 + 130, H - 40, top)];
    b.fits(CLIP, pts.map((p) => ({ ...p })), 0.2);
    b.then(0.05);
    b.fits(NAIL, pts, 0.15);
  });
  m.step({ title: "Nail the backs to the post", detail: "Two nails through each back into the edge of the post, one high and one low.", kind: "nails", tools: ["hammer"] }, () => {
    b.fits(NAIL, [H * 0.3, H * 0.7].flatMap((y) => [nailB(x0 + 92, y, post), nailL(z0 + 92, y, post)]), 0.15);
  });
  m.step({ title: "Nail the rest of the backs", detail: "Fifteen nails along the edges, into the sides, the top and the bottom.", kind: "nails", tools: ["hammer"] }, () => {
    const list: FitOpts[] = [];
    for (const f of [0.25, 0.5, 0.75]) list.push(nailB(W / 2 - T / 2, H * f, sideR), nailL(D / 2 - T / 2, H * f, sideF));
    for (const f of [0.35, 0.65, 0.9]) list.push(nailB(x0 + (W - T) * f, T / 2, bottom));
    for (const f of [0.45, 0.8]) list.push(nailB(x0 + (W - T) * f, H - T / 2, top), nailL(z0 + (D - T) * f, T / 2, bottom));
    list.push(nailL(z0 + (D - T) * 0.62, H - T / 2, top), nailL(z0 + (D - T) * 0.9, H - T / 2, top));
    b.fits(NAIL, list, 0.05);
  });

  // a suspension rail on each wall, the cabinet's fittings hook onto them
  const yr = H - T - 45;
  const railB = m.part("Suspension rail", [W, 40, 8], [0, yr, z0 - 3 - 4], { material: "metal", extra: true });
  const railL = m.part("Suspension rail", [W, 40, 8], [x0 - 3 - 4, yr, 0], { material: "metal", extra: true, rot: [0, Math.PI / 2, 0] });
  m.step(
    { title: "Screw a suspension rail to each wall and hang the cabinet on them", detail: "Level the rails at the same height into the corner. Both fittings drop over them. Wall screws and plugs aren't included: pick ones made for your wall.", kind: "anchor", tools: ["drill", "level", "pencil", "screwdriver"], pose: "+y", wall: true, warnings: ["wall"] },
    () => {
      b.stagger(0.3);
      m.put(railB, [0, 0, -120]);
      m.put(railL, [-120, 0, 0]);
      b.then(0.1);
      const ends = [W / 2 - 60, 0];
      b.fits(HW.plug, [...ends.map((x) => ({ at: [x, yr, z0 - 11] as Vec3, dir: [0, 0, -1] as Vec3 })), ...ends.map((z) => ({ at: [x0 - 11, yr, -z] as Vec3, dir: [-1, 0, 0] as Vec3 }))], 0.1);
      b.then(0.05);
      b.fits(HW.wallScrew, [...ends.map((x) => ({ on: railB, at: [x, yr, z0 - 3] as Vec3, dir: [0, 0, -1] as Vec3 })), ...ends.map((z) => ({ on: railL, at: [x0 - 3, yr, -z] as Vec3, dir: [-1, 0, 0] as Vec3 }))], 0.1);
      b.then(0.1);
      b.fits(HOOK, suspension.map((f) => ({ on: f.side, at: [f.at[0] - f.out[0] * 14, f.at[1], f.at[2] - f.out[2] * 14] as Vec3, dir: [-f.along[0], 0, -f.along[2]] as Vec3, hole: false as const })), 0.15);
    },
  );
  m.step({ title: "Pull it tight to the walls and click on the cover caps", detail: "Turn the screws in both fittings to set the height and pull it back to the rails, then one cap over each fitting. If cabinets hang beside it, screw them to it through the sides.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fits(COVER, suspension.map((f) => ({ on: f.side, at: [f.at[0] - f.out[0] * 18, f.at[1], f.at[2] - f.out[2] * 18] as Vec3, dir: [-f.out[0], 0, -f.out[2]] as Vec3, hole: false as const })), 0.2);
  });

  // inside: UTRUSTA corner shelves on six pins each, or the carousel
  if (/carousel/.test(slug)) cornerCarousel(m, { x0, z0, H, sideR, sideF, top, bottom });
  else if (/shelves|shelf/.test(slug)) {
    const n2 = Math.max(1, s.cabinet?.shelves ?? 2);
    const ys = Array.from({ length: n2 }, (_, i) => Math.round((T + ((H - 2 * T) * (i + 1)) / (n2 + 1)) / 32) * 32);
    const keys = ys.map((y) => slabPart("Shelf", 12, 16, y + 8));
    m.step({ title: ys.length > 1 ? "Push in the shelf pins and lay the shelves on" : "Push in the shelf pins and lay the shelf on", detail: "Six pins for each shelf, all at one height: two in each side and two in the post.", kind: "shelves" }, () => {
      const pins: FitOpts[] = [];
      for (const y of ys)
        pins.push(
          { on: sideR, at: [W / 2 - T, y, z0 + 70], dir: [1, 0, 0] },
          { on: sideR, at: [W / 2 - T, y, z0 + A - 50], dir: [1, 0, 0] },
          { on: sideF, at: [x0 + 70, y, D / 2 - T], dir: [0, 0, 1] },
          { on: sideF, at: [x0 + A - 50, y, D / 2 - T], dir: [0, 0, 1] },
          ...[-40, 40].map((d): FitOpts => ({ on: post, at: [r(pc[0] + d * u[0] + 9 * n[0]), y, r(pc[2] + d * u[2] + 9 * n[2])], dir: [-n[0], 0, -n[2]] })),
        );
      b.fits(PIN, pins, 0.05);
      b.then(0.1);
      b.stagger(0.3);
      for (const k of keys) b.add(k, [260, 0, 260]);
    });
  }

  // the door, across the diagonal, hung on the right-hand side
  if (s.cabinet?.doors === 0 || /cabinet-68-x-37/.test(slug)) return;
  const dw = Math.floor((L * S2 - 10) / 10) * 10;
  const dh = H - GAP;
  const fz = T / 2 + 2;
  const dc: Vec3 = [r(M[0] + n[0] * fz), r(dh / 2 + 1.5), r(M[2] + n[2] * fz)];
  const door = m.part(/glass/.test(slug) ? "Glass door" : "Door", [dw, dh, T], dc, { rot: [0, Q, 0] });
  const hn = dh > 900 ? 3 : 2;
  const hys = Array.from({ length: hn }, (_, i) => r(100 + ((dh - 200) * i) / (hn - 1)));
  const back = (k: number, y: number): Vec3 => [r(dc[0] + u[0] * k - n[0] * T / 2), y, r(dc[2] + u[2] * k - n[2] * T / 2)];
  m.step({ title: "Press the hinges into the door", detail: `Lay the door face down on the rug. ${hn} hinges along the edge that goes on the right-hand side; each clicks into its round hole.`, kind: "hinges", scene: "doors", warnings: ["floor", "face"] }, () => {
    b.stage(door, [0, T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    b.fits(HINGE, hys.map((y) => ({ on: door, at: back(dw / 2 - 22, y), dir: [-n[0], 0, -n[2]] as Vec3, twist: Math.PI })), 0.1);
  });
  m.step({ title: "Screw the hinge plates onto the right-hand side", detail: "One plate for each hinge, two screws each, in the holes by the front edge. The door can go on the other side instead: then the plates go there.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fits(EURO, hys.flatMap((y) => [-16, 16].map((dy) => ({ on: sideR, at: [W / 2 - T, y + dy, z0 + A - 37] as Vec3, dir: [1, 0, 0] as Vec3 }))), 0.05);
  });
  m.step({ title: "Click the door onto the plates", detail: "Hook each hinge arm over its plate and press until it clicks.", kind: "doors" }, () => {
    b.add(door, [n[0] * 380, 0, n[2] * 380]);
  });
  m.step({ title: "Line up the door and stick on the bumpers", detail: "Turn the hinge screws until the gaps are even. The two bumpers go on the front edges of the top and bottom, by the left-hand side.", kind: "doors", tools: ["screwdriver"] }, () => {
    const e: Vec3 = [P2[0] + u[0] * 30, 0, P2[2] + u[2] * 30];
    b.fits(BUMPER, [
      { on: bottom, at: [r(e[0]), T / 2, r(e[2])], dir: [-n[0], 0, -n[2]], hole: false },
      { on: top, at: [r(e[0]), H - T / 2, r(e[2])], dir: [-n[0], 0, -n[2]], hole: false },
    ], 0.1);
  });
}

/** UTRUSTA carousel for the corner wall cabinet: two shelves on a pole that turns in a bearing at the top and the bottom. */
function cornerCarousel(m: Metod, c: { x0: number; z0: number; H: number; sideR: string; sideF: string; top: string; bottom: string }) {
  const { b } = m;
  const { x0, z0, H } = c;
  const cx = x0 + 270, cz = z0 + 270, rad = 250;
  const ph = H - 2 * T - 10;
  const pole = m.part("Carousel pole", [25, ph, 25], [cx, T + 5 + ph / 2, cz], { material: "metal", shape: "cyl" });
  const ys = [T + 60, r(T + (H - 2 * T) * 0.52)];
  const shelves = ys.map((y) => m.part("Carousel shelf", [2 * rad, 30, 2 * rad], [cx, y, cz], { shape: "cyl" }));
  const BEARING: HwDef = { kind: "connector", len: 20, dia: 60, name: "Bearing" };
  const RIM: HwDef = { kind: "clip", len: 30, dia: 10, name: "Rim clip" };
  const LOCK: HwDef = { kind: "pin", len: 20, dia: 6, name: "Locking pin" };
  m.step({ title: "Screw the bearings to the bottom and the top", detail: "The cup with the peg goes in the middle of the bottom, the open one under the top, right above it. Two screws each.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fit(BEARING, { on: c.bottom, at: [cx, T, cz], dir: [0, -1, 0], hole: false });
    b.fit(BEARING, { on: c.top, at: [cx, H - T, cz], dir: [0, 1, 0], hole: false });
    b.then(0.05);
    b.fits(SMALL, [-1, 1].flatMap((k) => [{ on: c.bottom, at: [cx + k * 22, T, cz] as Vec3, dir: [0, -1, 0] as Vec3 }, { on: c.top, at: [cx + k * 22, H - T, cz] as Vec3, dir: [0, 1, 0] as Vec3 }]), 0.08);
  });
  m.step({ title: "Click the rim clips onto both carousel shelves", detail: "Nine around the edge of each shelf, then press the hub into its middle.", kind: "general", scene: "carousel", warnings: ["floor"] }, () => {
    b.stagger(0.3);
    shelves.forEach((k, i) => b.stage(k, [i * (2 * rad + 80) - rad - 40, 15, 0], [0, 0, 0], [0, 160, 0]));
    b.then(0.1);
    const clips: FitOpts[] = [];
    for (const [i, k] of shelves.entries())
      for (let j = 0; j < 9; j++) {
        const a = (j / 9) * Math.PI * 2;
        clips.push({ on: k, at: [r(cx + Math.cos(a) * (rad - 6)), ys[i] + 15, r(cz + Math.sin(a) * (rad - 6))], dir: [0, -1, 0], hole: false });
      }
    b.fits(RIM, clips, 0.03);
  });
  m.step({ title: "Slide the shelves onto the pole and pin them", detail: "Join the two halves of the pole first. One pin under each shelf at the height you want.", kind: "general", scene: "carousel" }, () => {
    b.stage(pole, [0, ph / 2, 0], [0, 0, 0], [0, 200, 0]);
    b.then(0.1);
    b.stagger(0.3);
    shelves.forEach((k, i) => b.stage(k, [0, ys[i] - T - 5, 0], [0, 0, 0], [0, 300, 0]));
    b.then(0.1);
    b.fits(LOCK, ys.map((y) => ({ on: pole, at: [cx + 12, y - 25, cz] as Vec3, dir: [-1, 0, 0] as Vec3 })), 0.15);
  });
  m.step({ title: "Tip the carousel in and lock the pole", detail: "Stand the pole in the bottom bearing, push its top up into the top bearing, and screw it so it can't drop out.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.stagger(0);
    for (const k of [pole, ...shelves]) b.add(k, [260, 0, 260]);
    b.then(0.15);
    b.fit(SMALL, { on: pole, at: [cx + 12, H - T - 30, cz], dir: [-1, 0, 0] });
  });
}

/* ---------- the extractor hood cabinet ---------- */

const PANEL_CATCH: HwDef = { kind: "stud", len: 12, dia: 8, name: "Panel catch" };
const HOLE_CAP: HwDef = { kind: "cap", len: 10, dia: 40, name: "Hole cover" };

/**
 * METOD wall cabinet for a built-in extractor hood (the 60 x 37 x 60 frame manual, the 60 wide one for 80 and 100 cm, and
 * the 80 wide one). Built lying on its right side: a partition is screwed between the fixed shelf and the top (both cut
 * out at the back for the duct) with frame screws, stood on that side, and the 60 wide frames add a hood board lower down,
 * drilled for the hood. The other side goes on, the cut-outs get flexible liner strips, and a small hardboard back closes
 * the right compartment. It hangs on the suspension rail; inside, a removable panel in front of the duct (its holes
 * capped) and side shelves on pins, then the doors. The manual branches by hood model; this follows the hood board path
 * with the holes left to the hood's own manual.
 */
function hoodCabinet(m: Metod) {
  const { b, s } = m;
  const W = m.W, H = m.Htot, D = m.D;
  const x0 = -W / 2 + T, x1 = W / 2 - T;
  const board = W < 700; // the 60 wide frames have the hood board
  const LW = 360; // the left compartment, in front of the duct
  const xp = x0 + LW + T / 2; // the partition
  const yf = H <= 600 ? 238 : 282; // underside of the fixed shelf
  const yh = 50; // underside of the hood board
  const zPanel = D / 2 - 137 - T / 2; // the removable panel in front of the duct
  const nx = x0 + LW / 2; // the duct cut-outs at the back of the top and fixed shelf
  const NW = 220, ND = 200;
  const hx = -40, HNW = 260, HND = 150; // the hood board's cut-out

  /** A full width board with a cut-out from its back edge, as pieces. */
  const notched = (name: string, y: number, cx: number, cw: number, cd: number) => {
    const zf = -D / 2 + cd; // front edge of the cut-out
    const l = cx - cw / 2 - x0, rr = x1 - (cx + cw / 2);
    const c = b.compound(name, [
      { shape: "box", size: [x1 - x0, T, D / 2 - zf], pos: [(x0 + x1) / 2, 0, (zf + D / 2) / 2] },
      { shape: "box", size: [l, T, cd], pos: [x0 + l / 2, 0, -D / 2 + cd / 2] },
      { shape: "box", size: [rr, T, cd], pos: [x1 - rr / 2, 0, -D / 2 + cd / 2] },
    ]);
    return b.place(c.type, [c.mid[0], y, c.mid[2]]);
  };
  /** A flexible liner strip pressed over the cut edge of a cut-out. */
  const strip = (y: number, cx: number, cw: number, cd: number) => {
    const zf = -D / 2 + cd;
    const c = b.compound("Liner strip", [
      { shape: "box", size: [3, T + 2, cd], pos: [cx - cw / 2 + 1.5, 0, -D / 2 + cd / 2] },
      { shape: "box", size: [cw, T + 2, 3], pos: [cx, 0, zf - 1.5] },
      { shape: "box", size: [3, T + 2, cd], pos: [cx + cw / 2 - 1.5, 0, -D / 2 + cd / 2] },
    ], { material: "fiber" });
    return b.place(c.type, [c.mid[0], y, c.mid[2]]);
  };

  const sideL = m.part("Side panel", [T, H, D], [-(W / 2 - T / 2), H / 2, 0]);
  const sideR = m.part("Side panel", [T, H, D], [W / 2 - T / 2, H / 2, 0]);
  const top = notched("Top panel", H - T / 2, nx, NW, ND);
  const shelf = notched("Fixed shelf", yf + T / 2, nx, NW, ND);
  const hp = H - T - (yf + T);
  const partition = m.part("Partition", [T, hp, D], [xp, yf + T + hp / 2, 0]);
  const hood = board ? notched("Hood board", yh + T / 2, hx, HNW, HND) : undefined;
  const backW = W / 2 - (xp - T / 2);
  const back = m.part("Back panel", [backW, H - yf, 3], [xp - T / 2 + backW / 2, yf + (H - yf) / 2, -D / 2 - 1.5], { material: "fiber" });
  const panel = m.part("Duct panel", [LW - 2, hp - 2, T], [nx, yf + T + hp / 2, zPanel]);
  const strips = [strip(H - T / 2, nx, NW, ND), strip(yf + T / 2, nx, NW, ND), ...(hood ? [strip(yh + T / 2, hx, HNW, HND)] : [])];
  const u: Unit = { kind: "wall", W, H, D, y0: 0, app: false, sideL, sideR, top, bottom: shelf, backs: [back], rails: [] };
  m.units.push(u);

  /** Cam bolts, cams and dowels where a board meets a side, n of each. */
  const joint = (panelKey: string, y: number, sx: -1 | 1, n: number, camsBelow = false) => {
    const x = sx * (W / 2 - T);
    const side = sx < 0 ? sideL : sideR;
    const bz = n === 1 ? [40] : [-110, 110];
    const dz = n === 1 ? [140] : [-150, 150];
    return {
      bolts: bz.map((z): FitOpts => ({ on: side, at: [x, y, z], dir: [sx, 0, 0], mate: panelKey })),
      cams: bz.map((z): FitOpts => ({ on: panelKey, at: [x - sx * 34, camsBelow ? y - T / 2 : y + T / 2, z], dir: [0, camsBelow ? 1 : -1, 0] })),
      dowels: dz.map((z): FitOpts => ({ on: panelKey, at: [x, y, z], dir: [-sx, 0, 0], mate: side })),
    };
  };
  const yt = H - T / 2, ys = yf + T / 2, yb = yh + T / 2;
  const right = [joint(top, yt, 1, 2, true), joint(shelf, ys, 1, 2)];
  const left = [joint(top, yt, -1, 2, true), joint(shelf, ys, -1, 1)];
  const hoodJ = hood ? [joint(hood, yb, 1, 2), joint(hood, yb, -1, 2)] : [];

  m.prepSides(u, "Screw a suspension fitting onto each side", "In the top back corner, three small screws each. The big hole faces the back.", () => {
    for (const f of m.suspension(u)) {
      b.fit(SUSPENSION, { on: f.side, at: f.at, dir: [f.sx, 0, 0], hole: false });
      b.then(0.05);
      b.fits(EURO, f.screws.map((p) => ({ on: f.side, at: p, dir: [f.sx, 0, 0] as Vec3 })), 0.06);
    }
  });
  m.step({ title: "Screw the cam bolts into both sides", detail: "Seven in all: four in the right side, three in the left, for the top and the fixed shelf. By hand until they stop.", kind: "cams", tools: ["screwdriver"], scene: "prep" }, () => {
    b.fits(BOLT, [...right, ...left].flatMap((j) => j.bolts), 0.06);
  });

  // the partition, the fixed shelf and the top go together on the rug first
  const rel = (k: string): Vec3 => {
    const p = m.pos(k);
    return [p[0] - xp, p[1] - yf, p[2]];
  };
  const frameScrews = (k: string, y: number, up: boolean) =>
    [-100, 100].map((z): FitOpts => ({ on: k, at: [xp, y, z], dir: [0, up ? 1 : -1, 0], mate: partition }));
  m.step({ title: "Screw the fixed shelf to the partition", detail: "The cut-outs at the back. Two frame screws up through the shelf into the end of the partition, with the Allen key.", kind: "screws", tools: ["allen"], scene: "inner", warnings: ["floor"] }, () => {
    b.stagger(0.3);
    b.stage(shelf, rel(shelf), [0, 0, 0], [0, -160, 0]);
    b.stage(partition, rel(partition), [0, 0, 0], [0, 200, 0]);
    b.then(0.1);
    b.fits(CONFIRMAT, frameScrews(shelf, yf, true), 0.12);
  });
  m.step({ title: "Screw the top onto the partition", detail: "Its cut-out over the shelf's. Two more frame screws down into the partition.", kind: "screws", tools: ["allen"], scene: "inner" }, () => {
    b.stage(top, rel(top), [0, 0, 0], [0, 200, 0]);
    b.then(0.1);
    b.fits(CONFIRMAT, frameScrews(top, H, false), 0.12);
  });
  m.step({ title: "Tap the dowels into the ends", detail: "Seven: two in each end of the top, two in the shelf's right end and one in its left end.", kind: "dowels", tools: ["hammer"], scene: "inner" }, () => {
    b.fits(DOWEL, [...right, ...left].flatMap((j) => j.dowels), 0.06);
  });

  m.step({ title: "Stand the shelf and top on the right side", detail: "Lay the right side flat on the rug, inside up, and press the dowels and bolts into their holes.", kind: "join", pose: "-x", warnings: ["floor"] }, () => {
    m.put(sideR, [0, 0, 0]);
    b.then(0.1);
    b.stagger(0);
    for (const k of [shelf, partition, top]) m.put(k, [-260, 0, 0]);
  });
  m.step({ title: "Lock the cams", detail: "Arrow towards the bolt, then turn each one clockwise until it bites.", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(CAM, right.flatMap((j) => j.cams), 0.1);
  });

  if (hood) {
    m.step(
      {
        title: "Drill the hood board for your hood",
        detail: "The manual's steps change with the hood; this guide takes the hood board path that suits any hood. Mark and drill the holes the hood's own manual shows. Hoods that screw to the sides don't use the board.",
        kind: "general",
        tools: ["drill", "pencil"],
        scene: "hood",
        warnings: ["floor"],
      },
      () => {
        const p = m.pos(hood);
        b.stage(hood, [0, T / 2, p[2]], [0, 0, 0], [0, 160, 0]);
      },
    );
    m.step({ title: "Screw in the cam bolts for the hood board", detail: "Two into each side, low down. The row depends on your hood: its own manual says which.", kind: "cams", tools: ["screwdriver"], scene: "main" }, () => {
      b.fits(BOLT, hoodJ.flatMap((j) => j.bolts), 0.08);
    });
    m.step({ title: "Tap the dowels into the hood board", detail: "Two into each end.", kind: "dowels", tools: ["hammer"], scene: "hood" }, () => {
      b.fits(DOWEL, hoodJ.flatMap((j) => j.dowels), 0.06);
    });
    m.step({ title: "Push the hood board onto the side", detail: "Cut-out to the back, onto the bolts at the height you chose.", kind: "join" }, () => {
      m.put(hood, [-260, 0, 0]);
    });
    m.step({ title: "Lock its cams", detail: "Two, turned clockwise until they bite.", kind: "cams", tools: ["screwdriver"] }, () => {
      b.fits(CAM, hoodJ[0].cams, 0.1);
    });
  }

  m.step({ title: "Lower the left side on", detail: "Onto all the dowels and bolts at once, pressing evenly.", kind: "dowels", tools: ["hammer"] }, () => {
    m.put(sideL, [-300, 0, 0]);
  });
  m.step({ title: "Lock the cams on that side", detail: hood ? "Five: three for the top and shelf, two for the hood board." : "Three, for the top and the shelf.", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(CAM, [...left, ...hoodJ.slice(1)].flatMap((j) => j.cams), 0.1);
  });

  m.step({ title: "Turn it onto its front and line the top's cut-out", detail: "Press the flexible strip over the cut edge, starting at one back corner and working round.", kind: "general", pose: "-z", warnings: ["floor"] }, () => {
    b.add(strips[0], [0, 0, -200]);
  });
  m.step({ title: hood ? "Line the other two cut-outs" : "Line the shelf's cut-out", detail: "Same again, then trim the ends flush with the back edge with scissors.", kind: "general" }, () => {
    b.stagger(0.3);
    for (const k of strips.slice(1)) b.add(k, [0, 0, -200]);
  });

  // the small hardboard back closes the right compartment
  const zb = -D / 2 - 3;
  const bx0 = xp, bx1 = W / 2 - T / 2, by0 = yf + T / 2, by1 = H - T / 2;
  const nail = (x: number, y: number, on: string): FitOpts => ({ on, at: [r(x), r(y), zb], dir: [0, 0, 1], hole: false });
  m.step({ title: "Lay the back over the right compartment", detail: "The small hardboard back, slid in so its edges lie on the partition, the side, the shelf and the top.", kind: "join" }, () => {
    m.put(back, [0, 0, -260]);
  });
  m.step({ title: "Square it and nail one corner", detail: "Push the compartment square to the back's edges, then one nail in the corner by the partition and the top.", kind: "nails", tools: ["hammer"], check: "square", warnings: ["square"] }, () => {
    b.fit(NAIL, nail(bx0, by1, top));
  });
  m.step({ title: "Nail the opposite corner", detail: "Check it's still square, then one nail by the side and the shelf.", kind: "nails", tools: ["hammer"] }, () => {
    b.fit(NAIL, nail(bx1, by0, sideR));
  });
  m.step({ title: "Nail a third corner", detail: "Straight in, not at an angle, so it doesn't come through inside.", kind: "nails", tools: ["hammer"] }, () => {
    b.fit(NAIL, nail(bx1, by1, sideR));
  });
  const nMore = W < 700 ? 10 : 11;
  m.step({ title: "Nail the rest of the back", detail: `${nMore} more nails along the edges, along the lines marked on the back.`, kind: "nails", tools: ["hammer"] }, () => {
    const list: FitOpts[] = [];
    const along = (n: number, f: (t: number) => FitOpts) => {
      for (let i = 0; i < n; i++) list.push(f((i + 1) / (n + 1)));
    };
    along(3, (t) => nail(bx1, by0 + (by1 - by0) * t, sideR));
    along(3, (t) => nail(bx0, by0 + (by1 - by0) * t, partition));
    along(nMore - 8, (t) => nail(bx0 + (bx1 - bx0) * t, by1, top));
    along(2, (t) => nail(bx0 + (bx1 - bx0) * t, by0, shelf));
    b.fits(NAIL, list, 0.05);
  });
  m.step({ title: "Nail on the two plastic brackets", detail: "One on the back edge of each side, near the top, one nail each.", kind: "nails", tools: ["hammer"] }, () => {
    const pts: FitOpts[] = [-1, 1].map((sx) => nail(sx * (W / 2 - T / 2), H - 40, sx < 0 ? sideL : sideR));
    b.fits(CLIP, pts, 0.2);
    b.then(0.05);
    b.fits(NAIL, pts, 0.15);
  });

  m.hang(u);

  // the removable panel in front of the duct
  const catches: FitOpts[] = [1 / 3, 2 / 3].map((f) => ({ on: partition, at: [xp - T / 2, r(yf + T + hp * f), r(zPanel)], dir: [1, 0, 0] }));
  m.step({ title: "Push the two panel catches into the partition", detail: "In the holes on its left face, behind the front edge. They hold the panel in front of the duct.", kind: "general" }, () => {
    b.fits(PANEL_CATCH, catches, 0.15);
  });
  m.step({ title: "Tap the dowels into the duct panel", detail: "Two, into its top edge.", kind: "dowels", tools: ["hammer"], scene: "panel", warnings: ["floor"] }, () => {
    b.stage(panel, [0, T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    b.fits(DOWEL, [-1, 1].map((k): FitOpts => ({ on: panel, at: [r(nx + k * (LW / 2 - 60)), H - T, r(zPanel)], dir: [0, -1, 0], mate: top })), 0.1);
  });
  m.step({ title: "Tip the panel in, top first", detail: "The dowels go into the holes under the top, then swing the bottom back onto the shelf.", kind: "general" }, () => {
    m.put(panel, [0, -60, 300]);
  });
  const nCaps = H >= 1000 ? 2 : 1;
  m.step({ title: nCaps > 1 ? "Slide it onto the catches and cap the holes" : "Slide it onto the catches and cap the hole", detail: "Push it towards the partition until both catches click into its slots. The hole covers come off when you need to reach the duct.", kind: "general" }, () => {
    const ys2 = nCaps > 1 ? [yf + T + hp * 0.3, yf + T + hp * 0.75] : [yf + T + hp * 0.45];
    b.fits(HOLE_CAP, ys2.map((y): FitOpts => ({ on: panel, at: [r(nx), r(y), r(zPanel + T / 2)], dir: [0, 0, -1], hole: false })), 0.2);
  });

  // side shelves: shallow ones in front of the duct panel, full depth ones in the right compartment
  const nL = H >= 1000 ? 2 : 1;
  const nR = H >= 800 ? nL : 0;
  const yu0 = yf + T, yu1 = H - T;
  const at = (n: number) => Array.from({ length: n }, (_, i) => Math.round((yu0 + ((yu1 - yu0) * (i + 1)) / (n + 1)) / 32) * 32);
  const zL = r((zPanel + T / 2 + D / 2) / 2 - 4), dL = 120;
  const rx0 = xp + T / 2;
  const shelves = [
    ...at(nL).map((y) => ({ y, k: m.part("Side shelf", [LW - 2, 16, dL], [nx, y + 8, zL]), walls: [[sideL, x0, -1], [partition, xp - T / 2, 1]] as [string, number, number][], zz: [zL - 40, zL + 40] })),
    ...at(nR).map((y) => ({ y, k: m.part("Side shelf", [x1 - rx0 - 2, 16, D - 20], [(rx0 + x1) / 2, y + 8, 0]), walls: [[partition, rx0, -1], [sideR, x1, 1]] as [string, number, number][], zz: [-(D / 2 - 60), D / 2 - 80] })),
  ];
  m.step({ title: "Push in the shelf pins", detail: `${shelves.length * 4} pins, four for each shelf at the same height. Pick the holes you like.`, kind: "shelves" }, () => {
    const pins: FitOpts[] = shelves.flatMap((sh) => sh.walls.flatMap(([w, x, sx]) => sh.zz.map((z): FitOpts => ({ on: w, at: [x, sh.y - 3, r(z)], dir: [sx, 0, 0] }))));
    b.fits(PIN, pins, 0.05);
  });
  m.step({ title: shelves.length > 1 ? "Tilt the shelves in and lay them on the pins" : "Tilt the shelf in and lay it on the pins", detail: "In at an angle, then level it down onto all four pins.", kind: "shelves" }, () => {
    b.stagger(0.3);
    for (const sh of shelves) b.add(sh.k, [0, 0, 360]);
  });

  if (/w-shlf-door/.test(s.slug ?? "")) m.doors([{ z: { kind: "doors", h: 0, n: W >= 800 ? 2 : 1 }, lo: 0, hi: H }]);
  m.step({ title: "Ready for the hood", detail: "Fit the extractor hood under the cabinet following its own instructions. Have a qualified electrician connect it.", kind: "general" }, () => {});
}

/* ---------- the corner base cabinets ---------- */

const SUPPORT_BLOCK: HwDef = { kind: "connector", len: 40, dia: 30, name: "Support block" };
const HANGER: HwDef = { kind: "bracket", len: 50, dia: 40, name: "Hanging bracket" };
const M6_BOLT: HwDef = { kind: "bolt", len: 60, dia: 6 };
const M6_NUT: HwDef = { kind: "nut", len: 6, dia: 10 };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 18 };
const LONG_SCREW: HwDef = { kind: "screw", len: 70, dia: 4 };
const JOIN_SCREW: HwDef = { kind: "screw", len: 45, dia: 4 };
const PLATE_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const BOTTOM_PLUG: HwDef = { kind: "cap", len: 10, dia: 10, name: "Plug" };
const SUPPORT_PLATE: HwDef = { kind: "plate", len: 40, dia: 20, name: "Support plate" };
const LOCK_CLIP: HwDef = { kind: "clip", len: 20, dia: 25, name: "Locking clip" };
const HINGE_PLATE: HwDef = { kind: "plate", len: 50, dia: 20, name: "Hinge plate" };

interface Susp {
  side: string;
  at: Vec3; // on the side's inner face
  out: Vec3; // into the side
  back: Vec3; // towards the wall
}

/** A suspension fitting in a side's top back corner: three screws, and later its hook, cap and locking clip. */
function suspFit(m: Metod, f: Susp) {
  const { b } = m;
  const p = (dy: number, dk: number): Vec3 => [r(f.at[0] + f.back[0] * dk), r(f.at[1] + dy), r(f.at[2] + f.back[2] * dk)];
  b.fit(SUSPENSION, { on: f.side, at: f.at, dir: f.out, hole: false });
  b.then(0.05);
  b.fits(EURO, [p(22, 14), p(-22, 14), p(0, -16)].map((at) => ({ on: f.side, at, dir: f.out })), 0.06);
}

/** Legs, the rails on the walls, and the fittings hooked on, locked and capped: the manual's last pages for both corner cabinets. */
function cornerFinish(m: Metod, o: { legs: Vec3[]; rails: { key: string; ends: Vec3[]; out: Vec3 }[]; susp: Susp[]; join: { side: string; at: Vec3[]; out: Vec3 } }) {
  const { b } = m;
  const legs = o.legs.map((p) => m.part("Leg", [36, LEG, 36], [p[0], LEG / 2, p[2]], { material: "metal", shape: "cyl" }));
  m.step({ title: "Lay it on its back and click on the legs", detail: `${o.legs.length} legs, at the corners and under the middle. Screw them out until the cabinet stands level.`, kind: "legs", pose: "+z", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    for (const k of legs) b.add(k, [0, -200, 0]);
  });
  m.step({ title: "Stand it up together", detail: "Lift it upright between you. Don't drag or tip it on its legs: they can snap off.", kind: "standup", people: 2, pose: "+y", warnings: ["two"] }, () => {});
  m.step(
    {
      title: o.rails.length > 1 ? "Screw a suspension rail to each wall and hang the cabinet on them" : "Screw the suspension rail to the wall and hang the cabinet on it",
      detail: "Level the rails at the height the METOD rail instructions give, then push the cabinet back so the fittings' hooks drop over. Wall screws and plugs aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "level", "pencil", "screwdriver"],
      people: 2,
      pose: "+y",
      wall: true,
      warnings: ["wall", "two"],
    },
    () => {
      b.stagger(0.3);
      for (const rl of o.rails) m.put(rl.key, [rl.out[0] * 120, 0, rl.out[2] * 120]);
      b.then(0.1);
      const ends = o.rails.flatMap((rl) => rl.ends.map((p) => ({ rl, p })));
      b.fits(HW.plug, ends.map(({ rl, p }) => ({ at: [p[0] + rl.out[0] * 8, p[1], p[2] + rl.out[2] * 8] as Vec3, dir: rl.out })), 0.1);
      b.then(0.05);
      b.fits(HW.wallScrew, ends.map(({ rl, p }) => ({ on: rl.key, at: p, dir: rl.out })), 0.1);
      b.then(0.1);
      b.fits(HOOK, o.susp.map((f) => ({ on: f.side, at: [f.at[0] - f.out[0] * 14, f.at[1], f.at[2] - f.out[2] * 14] as Vec3, dir: f.back, hole: false as const })), 0.15);
    },
  );
  m.step({ title: "Set it level and lock the fittings", detail: "Turn the screws in each fitting to set the height and pull the cabinet back to the rail, then turn a locking clip into each one so it can't lift off.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fits(LOCK_CLIP, o.susp.map((f) => ({ on: f.side, at: [f.at[0] - f.out[0] * 10, f.at[1] - 20, f.at[2] - f.out[2] * 10] as Vec3, dir: f.out, hole: false as const })), 0.15);
  });
  m.step({ title: "Click on the cover caps", detail: "One over each suspension fitting.", kind: "general" }, () => {
    b.fits(COVER, o.susp.map((f) => ({ on: f.side, at: [f.at[0] - f.out[0] * 18, f.at[1], f.at[2] - f.out[2] * 18] as Vec3, dir: f.out, hole: false as const })), 0.2);
  });
  m.step({ title: "Screw it to the cabinet beside it", detail: "Four screws through the side, near the corners of the hinge holes, once the next cabinet hangs level with it.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fits(JOIN_SCREW, o.join.at.map((at) => ({ on: o.join.side, at, dir: o.join.out })), 0.1);
  });
}

/**
 * METOD corner base cabinet 128 x 68: one long frame whose left half hides behind the cabinet on the other wall. A fixed
 * front panel closes that half, a front strip runs along its top and a post stands forward of it where the door
 * starts. Built lying on its front, the backs come in two halves joined by a metal strip. Above the door opening goes a
 * top brace, or a half-height middle panel when there is a drawer. Inside: a long shelf, a pull-out fitting or a
 * drawer, and the door hangs on corner hinges whose plates go on the back of the front panel. The manual can be
 * built either way round; this is the door on the right.
 */
function cornerBase128(m: Metod) {
  const { b, s } = m;
  const slug = s.slug ?? "";
  const W = m.W, D = m.D, H = m.Htot, y0 = m.y0;
  const xl = -W / 2 + T, xr = W / 2 - T; // inner faces of the sides
  const xp = 37.5; // where the door opening starts: the right edge of the front panel and the post
  const top = y0 + H;
  const drawer = /drawer/.test(slug);
  const pullout = /p-o|pull-out/.test(slug);
  const shelf = /shelf|shel|she$/.test(slug);
  const door = (s.cabinet?.doors ?? 1) > 0 && !/-x-60-x-80$/.test(slug);

  const sideL = m.part("Side panel", [T, H, D], [-W / 2 + T / 2, y0 + H / 2, 0]);
  const sideR = m.part("Side panel", [T, H, D], [W / 2 - T / 2, y0 + H / 2, 0]);
  const bottom = m.part("Bottom panel", [W - 2 * T, T, D], [0, y0 + T / 2, 0]);
  const fw = xp - xl;
  const fcx = (xl + xp) / 2;
  const front = m.part("Fixed front panel", [fw, H - 2 * T, T], [fcx, y0 + H / 2, D / 2 - T / 2]);
  const strip = m.part("Front strip", [fw, T, 80], [fcx, top - T / 2, D / 2 - 40]);
  const post = m.part("Post", [50, H, 60], [xp - 25, y0 + H / 2, D / 2 + 30]);
  const backs = [-1, 1].map((sx) => m.part("Back panel", [W / 2, H, 3], [(sx * W) / 4, y0 + H / 2, -D / 2 - 1.5], { material: "fiber" }));
  const joinStrip = m.part("Joining strip", [24, H - 40, 2], [0, y0 + H / 2, -D / 2 - 4], { material: "metal" });
  const backRail = m.part("Rail", [W - 2 * T, 16, 60], [0, top - 8, -D / 2 + 30], { material: "metal" });
  const frontRail = m.part("Front rail", [xr - xp, 16, 60], [(xr + xp) / 2, top - 8, D / 2 - 30], { material: "metal" });
  const bx = -55; // the top brace or middle panel sits just behind the post
  const brace = drawer ? undefined : m.part("Top brace", [150, T, 522], [bx, top - 1.5 * T, 21]);
  const middle = drawer ? m.part("Middle panel", [T, 380, D - T - 20], [xp - T / 2, top - T - 190, 1]) : undefined;
  const blockAt: Vec3 = [bx, top - 2 * T - 15, D / 2 - T];
  const zb = zs(D, 3, 0.5);
  const zd = zs(D, 3, 0).map((z, i) => r(z + (i === 2 ? -20 : 20)));
  const joint = (sx: -1 | 1) => {
    const side = sx < 0 ? sideL : sideR;
    const x = sx < 0 ? xl : xr;
    const y = y0 + T / 2;
    return {
      bolts: zb.map((z): FitOpts => ({ on: side, at: [x, y, z], dir: [sx, 0, 0], mate: bottom })),
      cams: zb.map((z): FitOpts => ({ on: bottom, at: [x - sx * 34, y0 + T, z], dir: [0, -1, 0] })),
      dowels: zd.map((z): FitOpts => ({ on: bottom, at: [x, y, z], dir: [-sx, 0, 0], mate: side })),
    };
  };
  const stripBolt: FitOpts = { on: sideL, at: [xl, top - T / 2, D / 2 - 40], dir: [-1, 0, 0], mate: strip };
  const susp: Susp[] = [
    { side: sideL, at: [xl, top - 45, -D / 2 + 28], out: [-1, 0, 0], back: [0, 0, -1] },
    { side: sideR, at: [xr, top - 45, -D / 2 + 28], out: [1, 0, 0], back: [0, 0, -1] },
  ];

  m.step({ title: "Screw the cam bolts into both sides", detail: "Seven in all: three near the bottom of each side, and one more at the top front of the left side for the front strip.", kind: "cams", tools: ["screwdriver"], scene: "prep", warnings: ["floor"] }, () => {
    b.stagger(0.25);
    b.stage(sideL, [0, T / 2, -(D / 2 + 40)], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.stage(sideR, [0, T / 2, D / 2 + 40], [0, 0, -Math.PI / 2], [0, 160, 0]);
    b.then(0.15);
    b.fits(BOLT, [...joint(-1).bolts, stripBolt, ...joint(1).bolts], 0.06);
  });
  m.step({ title: "Tap the dowels into the ends of the bottom", detail: "Three into each end. Then stand the bottom on its front edge on the rug: the cabinet is built lying on its front.", kind: "dowels", tools: ["hammer"], pose: "-z", warnings: ["floor"] }, () => {
    m.put(bottom, [0, 0, 200]);
    b.then(0.1);
    b.fits(DOWEL, [...joint(-1).dowels, ...joint(1).dowels], 0.06);
  });
  m.step({ title: "Push the right side onto the bottom", detail: "Dowels and bolts into their holes, inside faces towards each other.", kind: "dowels" }, () => {
    m.put(sideR, [300, 0, 0]);
  });
  m.step({ title: "Lock the cams", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls the side tight.", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(CAM, joint(1).cams, 0.1);
  });
  m.step({ title: "Screw the support block onto the fixed front panel", detail: "On its inside face, near the top by the end where the post will go. Two screws.", kind: "screws", tools: ["screwdriver"], scene: "front", warnings: ["floor"] }, () => {
    b.stage(front, [0, T / 2, 0], [-Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    b.fit(SUPPORT_BLOCK, { on: front, at: blockAt, dir: [0, 0, 1], hole: false });
    b.then(0.05);
    b.fits(SMALL, [-12, 12].map((d) => ({ on: front, at: [bx + d, blockAt[1], D / 2 - T] as Vec3, dir: [0, 0, 1] as Vec3 })), 0.08);
  });
  m.step({ title: "Screw the front panel onto the bottom", detail: "Lay it on the rug against the bottom's front edge, the block inside. Three frame screws through the bottom into its edge, with the Allen key.", kind: "screws", tools: ["allen"] }, () => {
    m.put(front, [0, 0, 200]);
    b.then(0.12);
    b.fits(CONFIRMAT, [-0.4, 0, 0.4].map((f) => ({ on: bottom, at: [r(fcx + fw * f), y0, D / 2 - T / 2] as Vec3, dir: [0, 1, 0] as Vec3, mate: front })), 0.12);
  });
  m.step({ title: "Push the left side on and lock the cams", detail: "Onto the dowels at the other end of the bottom, then three cams, each turned clockwise until it bites.", kind: "cams", tools: ["screwdriver"] }, () => {
    m.put(sideL, [-300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, joint(-1).cams, 0.1);
  });
  const brk = [y0 + T + 60, top - T - 60].map((y): Vec3 => [xl, r(y), D / 2 - T - 8]);
  m.step({ title: "Nail two plastic brackets where the front panel meets the left side", detail: "One near the bottom and one near the top, a nail through each into the side.", kind: "nails", tools: ["hammer"] }, () => {
    b.fits(CLIP, brk.map((at) => ({ on: sideL, at, dir: [-1, 0, 0] as Vec3, hole: false as const })), 0.15);
    b.then(0.05);
    b.fits(NAIL, brk.map((at) => ({ on: sideL, at, dir: [-1, 0, 0] as Vec3, hole: false as const })), 0.12);
  });
  const stripDowel: FitOpts = { on: strip, at: [xl, top - T / 2, D / 2 - 15], dir: [1, 0, 0], mate: sideL };
  m.step({ title: "Tap a dowel into the end of the front strip", detail: "Into the end that goes against the left side.", kind: "dowels", tools: ["hammer"], scene: "strip", warnings: ["floor"] }, () => {
    b.stage(strip, [0, 40, 0], [0, 0, 0], [0, 160, 0]);
    b.then(0.1);
    b.fit(DOWEL, stripDowel);
  });
  m.step({ title: "Turn it round and slide the front strip in", detail: "Still on its front. The strip goes along the top of the front panel, its dowel and cam into the left side. Turn the cam until it bites.", kind: "cams", tools: ["screwdriver"] }, () => {
    m.put(strip, [0, 200, 0]);
    b.then(0.12);
    b.fit(CAM, { on: strip, at: [xl + 34, top, D / 2 - 40], dir: [0, 1, 0] });
  });
  m.step({ title: "Screw the strip down onto the front panel", detail: "Three frame screws through the strip into the top edge of the panel.", kind: "screws", tools: ["allen"] }, () => {
    b.fits(CONFIRMAT, [-0.4, 0, 0.4].map((f) => ({ on: strip, at: [r(fcx + fw * f), top, D / 2 - T / 2] as Vec3, dir: [0, -1, 0] as Vec3, mate: front })), 0.12);
  });
  m.step({ title: "Stand it up and slide the card from the box inside", detail: "It keeps the frame from racking while you work on it. Take it out once the backs are on.", kind: "general", pose: "+y" }, () => {});
  m.step({ title: "Screw the back rail across the top", detail: "Flush with the back edges of the sides, one screw down into each.", kind: "screws", tools: ["screwdriver"] }, () => {
    m.put(backRail, [0, 220, 0]);
    b.then(0.1);
    b.fits(RAIL_SCREW, [-1, 1].map((sx) => ({ on: backRail, at: [sx * (W / 2 - T / 2), top, -D / 2 + 30] as Vec3, dir: [0, -1, 0] as Vec3, mate: sx < 0 ? sideL : sideR })), 0.12);
  });
  m.step({ title: "Screw a suspension fitting onto each side", detail: "In the top back corners, three screws each. The big hole faces the back.", kind: "screws", tools: ["screwdriver"] }, () => {
    for (const f of susp) suspFit(m, f);
  });

  const zb2 = -D / 2 - 3;
  const nail = (x: number, y: number, on: string): FitOpts => ({ on, at: [r(x), r(y), zb2], dir: [0, 0, 1], hole: false });
  const yb = y0 + T / 2, yt = top - 10;
  m.step({ title: "Lay it on its front and nail the backs on at three corners", detail: "Check it's square first: both diagonals the same. Both backs go in, then one nail in a bottom corner, the other bottom corner and a top one.", kind: "nails", tools: ["hammer", "tape"], pose: "-z", check: "square", warnings: ["square", "floor"] }, () => {
    b.stagger(0.25);
    for (const k of backs) m.put(k, [0, 0, -260]);
    b.then(0.1);
    b.fits(NAIL, [nail(-W / 2 + 10, yb, sideL), nail(W / 2 - 10, yb, sideR), nail(W / 2 - 10, yt - 20, sideR)], 0.25);
  });
  m.step({ title: "Nail on the two plastic brackets at the top", detail: "One in each top corner, one nail each.", kind: "nails", tools: ["hammer"] }, () => {
    const pts: Vec3[] = [[-W / 2 + 40, yt - 10, zb2], [W / 2 - 40, yt - 10, zb2]];
    b.fits(CLIP, pts.map((p) => ({ on: p[0] < 0 ? sideL : sideR, at: p, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.2);
    b.then(0.05);
    b.fits(NAIL, pts.map((p) => nail(p[0], p[1], p[0] < 0 ? sideL : sideR)), 0.15);
  });
  m.step({ title: "Slide the joining strip in where the backs meet", detail: "It clips over both edges. One nail through its top end, one screw through its bottom end into the bottom.", kind: "nails", tools: ["hammer", "screwdriver"] }, () => {
    m.put(joinStrip, [0, 300, 0]);
    b.then(0.1);
    b.fit(NAIL, { on: joinStrip, at: [0, yt - 30, -D / 2 - 5], dir: [0, 0, 1], mate: backRail });
    b.fit(SMALL, { on: joinStrip, at: [0, yb, -D / 2 - 5], dir: [0, 0, 1], mate: bottom });
  });
  m.step({ title: "Nail the rest of the backs", detail: "Seven nails along the edges, into the sides and the bottom.", kind: "nails", tools: ["hammer"] }, () => {
    b.fits(NAIL, [nail(-W / 2 + 9, y0 + H / 2, sideL), nail(W / 2 - 9, y0 + H / 2, sideR), ...[-0.4, -0.2, 0.15, 0.3, 0.42].map((f) => nail(W * f, yb, bottom))], 0.05);
  });
  m.step({ title: "Stand it up and screw the post onto the front panel", detail: "It stands in front of the panel's end, flush with the top. Three frame screws.", kind: "screws", tools: ["allen"], pose: "+y" }, () => {
    m.put(post, [0, 0, 300]);
    b.then(0.12);
    b.fits(CONFIRMAT, [0.2, 0.5, 0.8].map((f) => ({ on: post, at: [xp - 25, r(y0 + H * f), D / 2 + 60] as Vec3, dir: [0, 0, -1] as Vec3, mate: front })), 0.12);
  });

  // the bracket hangs from the back rail beside the middle panel (its bolt goes across) or over the brace (its bolt goes down)
  const hangAt: Vec3 = middle ? [xp - T - 4, top - 16, -D / 2 + 60] : [bx, top - 16, -D / 2 + 60];
  m.step({ title: "Hook the hanging bracket onto the back rail", detail: drawer ? "Behind the post, where the middle panel will hang." : "Behind the post, where the top brace will go.", kind: "general" }, () => {
    b.fit(HANGER, { on: backRail, at: hangAt, dir: [0, -1, 0], hole: false });
  });
  if (brace) {
    m.step({ title: "Slide the top brace in and push it back", detail: "Tip it in under the front strip, rest its front end on the support block and push its back end into the bracket.", kind: "general" }, () => {
      m.put(brace, [0, 120, 300]);
    });
    m.step({ title: "Bolt the brace to the bracket", detail: "The bolt goes up through the brace and the bracket. Hold the nut with a spanner and tighten.", kind: "screws", tools: ["screwdriver", "wrench"] }, () => {
      b.fit(M6_BOLT, { on: brace, at: [bx, top - 14, -D / 2 + 70], dir: [0, -1, 0] });
      b.then(0.05);
      b.fit(M6_NUT, { on: brace, at: [bx, top - 2 * T - 2, -D / 2 + 70], dir: [0, 1, 0], hole: false });
    });
    m.step({ title: "Screw the brace onto the support block", detail: "Two screws up through the block into the front of the brace.", kind: "screws", tools: ["screwdriver"] }, () => {
      b.fits(JOIN_SCREW, [-12, 12].map((d) => ({ on: brace, at: [bx + d, top - 2 * T, D / 2 - T - 15] as Vec3, dir: [0, 1, 0] as Vec3 })), 0.1);
    });
  } else if (middle) {
    const mDowel: FitOpts = { on: middle, at: [xp - T / 2, top - T, D / 2 - T - 30], dir: [0, -1, 0], mate: strip };
    m.step({ title: "Tap a dowel into the top of the middle panel", detail: "Into the hole at its front top corner.", kind: "dowels", tools: ["hammer"], scene: "middle", warnings: ["floor"] }, () => {
      b.stage(middle, [0, 190, 0], [0, 0, 0], [0, 160, 0]);
      b.then(0.1);
      b.fit(DOWEL, mDowel);
    });
    m.step({ title: "Lift the middle panel into place", detail: "Behind the post, its back end into the bracket and its dowel up into the front strip.", kind: "general" }, () => {
      m.put(middle, [0, -200, 0]);
    });
    m.step({ title: "Bolt the panel to the bracket", detail: "The bolt goes through the bracket and the panel. Hold the nut with a spanner and tighten.", kind: "screws", tools: ["screwdriver", "wrench"] }, () => {
      b.fit(M6_BOLT, { on: middle, at: [xp - T - 4, top - T - 30, -D / 2 + 70], dir: [1, 0, 0], hole: false });
      b.then(0.05);
      b.fit(M6_NUT, { on: middle, at: [xp + 2, top - T - 30, -D / 2 + 70], dir: [-1, 0, 0], hole: false });
    });
    m.step({ title: "Screw the panel to the front", detail: "One long screw through the post and the front panel into the middle panel's front edge.", kind: "screws", tools: ["screwdriver"] }, () => {
      b.fit(LONG_SCREW, { on: post, at: [xp - T / 2, top - T - 150, D / 2 + 60], dir: [0, 0, -1], mate: middle });
    });
  }
  m.step({ title: "Screw the front rail across the top of the door opening", detail: "One screw at each end; a washer goes under the one by the post.", kind: "screws", tools: ["screwdriver"] }, () => {
    m.put(frontRail, [0, 220, 0]);
    b.then(0.1);
    b.fit(WASHER, { on: frontRail, at: [xp + 10, top, D / 2 - 30], dir: [0, -1, 0], hole: false });
    b.fits(RAIL_SCREW, [{ on: frontRail, at: [xp + 10, top, D / 2 - 30], dir: [0, -1, 0] }, { on: frontRail, at: [W / 2 - T / 2, top, D / 2 - 30], dir: [0, -1, 0], mate: sideR }], 0.12);
  });
  m.step({ title: "Press the two plugs into the bottom", detail: "Into the holes near the front of the door opening.", kind: "general" }, () => {
    b.fits(BOTTOM_PLUG, [150, 480].map((x) => ({ on: bottom, at: [x, y0 + T, D / 2 - 40] as Vec3, dir: [0, -1, 0] as Vec3 })), 0.15);
  });
  const plates: Vec3[] = [-D / 2 + 100, 0, D / 2 - 40].map((z): Vec3 => [-W / 2 + T / 2, top, z]);
  m.step({ title: "Screw the three support plates onto the left side", detail: "On its top edge, where the worktop rests without a rail. A washer under the back two.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fits(WASHER, plates.slice(0, 2).map((at) => ({ on: sideL, at, dir: [0, -1, 0] as Vec3, hole: false as const })), 0.1);
    b.fits(SUPPORT_PLATE, plates.map((at) => ({ on: sideL, at: [at[0], at[1] + 2, at[2]] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const })), 0.1);
    b.fits(PLATE_SCREW, plates.map((at) => ({ on: sideL, at: [at[0], at[1] + 4, at[2]] as Vec3, dir: [0, -1, 0] as Vec3 })), 0.1);
  });

  const yr = top - 45;
  const rail = m.part("Suspension rail", [W, 40, 8], [0, yr, -D / 2 - 3 - 4], { material: "metal", extra: true });
  cornerFinish(m, {
    legs: [-W / 2 + 40, xp, W / 2 - 40].flatMap((x) => [-D / 2 + 60, D / 2 - 60].map((z): Vec3 => [x, 0, z])),
    rails: [{ key: rail, ends: [-W / 2 + 60, W / 2 - 60].map((x): Vec3 => [x, yr, -D / 2 - 3]), out: [0, 0, -1] }],
    susp,
    join: { side: sideR, at: [-1, 1].flatMap((dy) => [-1, 1].map((dz): Vec3 => [W / 2, r(y0 + H / 2 + dy * 250), r(dz * 180)])), out: [-1, 0, 0] },
  });

  // inside: the drawer above the door, then the shelf or the pull-out fitting below
  const dBand = drawer ? 200 : 0;
  if (drawer) {
    m.drawers([{ z: { kind: "drawers", h: 20, n: 1 }, lo: top - dBand, hi: top }], { xc: (xp + xr) / 2, w: xr - xp + 2 * T, left: middle!, right: sideR, pad: front, fx: W / 2 - 1.5 - 298.5, fw: 597 });
  }
  if (shelf) {
    const y = Math.round((y0 + T + (drawer ? top - T - 380 : top)) / 2 / 32) * 32;
    const k = m.part("Shelf", [W - 2 * T - 2, 16, D - 40], [0, y + 8, -10]);
    m.step({ title: "Push in the shelf pins and lay the shelf on", detail: "Eight pins at one height: three in each side and two in the back of the front panel. Tip the shelf in through the door opening.", kind: "shelves" }, () => {
      const pins: FitOpts[] = [];
      for (const sx of [-1, 1] as const) for (const z of [-D / 2 + 60, 0, D / 2 - 80]) pins.push({ on: sx < 0 ? sideL : sideR, at: [sx < 0 ? xl : xr, y - 3, z], dir: [sx, 0, 0] });
      for (const x of [-450, -120]) pins.push({ on: front, at: [x, y - 3, D / 2 - T], dir: [0, 0, 1] });
      b.fits(PIN, pins, 0.05);
      b.then(0.1);
      b.add(k, [400, 100, 400]);
    });
  }
  if (pullout) cornerPullout(m, { xc: (xp + xr) / 2, side: sideR, xr, lo: y0 + T, hi: top - dBand });

  if (!door) return;
  const dh = H - dBand - GAP;
  const dw = 597;
  const dx = W / 2 - 1.5 - dw / 2;
  const dcy = r(y0 + (H - dBand) / 2);
  const dk = m.part("Door", [dw, r(dh), T], [dx, dcy, m.fz]);
  const hys = [dcy - dh / 2 + 100, dcy + dh / 2 - 100].map(r);
  m.step({ title: "Press the corner hinges into the door", detail: "Lay the door face down on the rug. Both hinges go along the edge next to the post; each clicks into its round hole.", kind: "hinges", scene: "doors", warnings: ["floor", "face"] }, () => {
    b.stage(dk, [0, T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    b.fits(HINGE, hys.map((y) => ({ on: dk, at: [dx - dw / 2 + 22, y, m.fz - T / 2] as Vec3, dir: [0, 0, 1] as Vec3 })), 0.1);
  });
  m.step({ title: "Fit the hinge plates on the back of the front panel", detail: "Line each plate up with its hinge, push its pegs into the holes by the panel's end and screw it on with two screws.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fits(HINGE_PLATE, hys.map((y) => ({ on: front, at: [xp - 30, y, D / 2 - T] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.12);
    b.then(0.05);
    b.fits(EURO, hys.flatMap((y) => [-16, 16].map((d) => ({ on: front, at: [xp - 30, y + d, D / 2 - T] as Vec3, dir: [0, 0, 1] as Vec3 }))), 0.05);
  });
  m.step({ title: "Click the door onto the plates", detail: "Hook each hinge arm over its plate and press until it clicks.", kind: "doors" }, () => {
    b.add(dk, [0, 0, 380]);
  });
  m.step({ title: "Line up the door and stick on the bumpers", detail: "Turn the hinge screws until the gaps are even. The two bumpers go on the front edge of the right side, at the top and the bottom of the door.", kind: "doors", tools: ["screwdriver"] }, () => {
    b.fits(BUMPER, [y0 + 60, top - dBand - 60].map((y) => ({ on: sideR, at: [W / 2 - T / 2, r(y), D / 2] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })), 0.1);
  });
}

/** UTRUSTA pull-out fitting for the 128 corner cabinet: two baskets on swing arms that hang from tracks on the side. */
function cornerPullout(m: Metod, c: { xc: number; side: string; xr: number; lo: number; hi: number }) {
  const { b } = m;
  const TRACK: HwDef = { kind: "bracket", len: 300, dia: 40, name: "Mounting track" };
  const ARM: HwDef = { kind: "connector", len: 400, dia: 20, name: "Swing arm" };
  const POST: HwDef = { kind: "pin", len: 70, dia: 8, name: "Rail post" };
  const JOINER: HwDef = { kind: "clip", len: 30, dia: 10, name: "Rim joiner" };
  const HUB: HwDef = { kind: "connector", len: 60, dia: 40, name: "Basket bracket" };
  const BIG: HwDef = { kind: "screw", len: 16, dia: 5 };
  const bw = 480, bd = 460, bh = 90;
  const ys = [c.lo + 40, r(c.lo + (c.hi - c.lo) * 0.55)];
  const basket = (y: number) => {
    const pieces: PartPiece[] = [
      { shape: "box", size: [bw, 12, bd], pos: [0, 6, 0] },
      { shape: "box", size: [bw, 8, 8], pos: [0, bh, bd / 2 - 4], material: "metal" },
      { shape: "box", size: [bw, 8, 8], pos: [0, bh, -bd / 2 + 4], material: "metal" },
      { shape: "box", size: [8, 8, bd], pos: [bw / 2 - 4, bh, 0], material: "metal" },
      { shape: "box", size: [8, 8, bd], pos: [-bw / 2 + 4, bh, 0], material: "metal" },
    ];
    const t = b.compound("Basket", pieces, { material: "metal" });
    return b.place(t.type, [c.xc + t.mid[0], y + t.mid[1], -20 + t.mid[2]]);
  };
  const baskets = ys.map(basket);
  const posts = (k: number) => {
    const y = ys[k] + 12;
    const out: Vec3[] = [];
    for (let i = 0; i < 4; i++) out.push([r(c.xc - bw / 2 + 30 + ((bw - 60) * i) / 3), y, -20 + bd / 2 - 4], [r(c.xc - bw / 2 + 30 + ((bw - 60) * i) / 3), y, -20 - bd / 2 + 4]);
    for (const sx of [-1, 1]) for (const f of [-0.25, 0.25]) out.push([c.xc + sx * (bw / 2 - 4), y, r(-20 + bd * f)]);
    return out;
  };
  const tys = ys.map((y) => y + 60);
  m.step({ title: "Screw the two mounting tracks to the side", detail: "On the inside of the right side, by its front edge: one low, one high, four screws each.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fits(TRACK, tys.map((y) => ({ on: c.side, at: [c.xr, y, 240] as Vec3, dir: [1, 0, 0] as Vec3, hole: false as const })), 0.15);
    b.then(0.05);
    b.fits(BIG, tys.flatMap((y) => [-60, -20, 20, 60].map((d) => ({ on: c.side, at: [c.xr, y + d, 240] as Vec3, dir: [1, 0, 0] as Vec3 }))), 0.04);
  });
  m.step({ title: "Hook the four swing arms into the tracks", detail: "Two in each track, top and bottom. Push each one in and swing it down until it rests in its catch.", kind: "general" }, () => {
    b.fits(ARM, tys.flatMap((y) => [-20, 20].map((d) => ({ on: c.side, at: [c.xr - 200, y + d, 200] as Vec3, dir: [1, 0, 0] as Vec3, hole: false as const }))), 0.15);
  });
  m.step({ title: "Push the rail posts into both baskets", detail: "Twelve into each tray, then press the wire rim down over them.", kind: "general", scene: "baskets", warnings: ["floor"] }, () => {
    b.stagger(0.25);
    baskets.forEach((k, i) => b.stage(k, [(i - 0.5) * (bw + 80), bh / 2, 0], [0, 0, 0], [0, 160, 0]));
    b.then(0.1);
    b.fits(POST, [0, 1].flatMap((i) => posts(i).map((at) => ({ on: baskets[i], at, dir: [0, -1, 0] as Vec3 }))), 0.02);
  });
  m.step({ title: "Join each rim with its two clips", detail: "The clips close the gaps where the rim's ends meet.", kind: "general", scene: "baskets" }, () => {
    b.fits(JOINER, [0, 1].flatMap((i) => [-1, 1].map((sx) => ({ on: baskets[i], at: [c.xc + sx * (bw / 2 - 4), ys[i] + bh, -20] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const }))), 0.12);
  });
  m.step({ title: "Screw the posts and the brackets to the trays", detail: "A screw up through the tray into each post, and two brackets under each tray with two screws each.", kind: "screws", tools: ["screwdriver"], scene: "baskets" }, () => {
    b.fits(SMALL, [0, 1].flatMap((i) => posts(i).map((p) => ({ on: baskets[i], at: [p[0], ys[i], p[2]] as Vec3, dir: [0, 1, 0] as Vec3 }))), 0.02);
    b.then(0.1);
    const hubs = [0, 1].flatMap((i) => [-1, 1].map((sx) => ({ i, at: [c.xc + 120, ys[i], r(-20 + sx * 120)] as Vec3 })));
    b.fits(HUB, hubs.map((h) => ({ on: baskets[h.i], at: h.at, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.1);
    b.fits(BIG, hubs.flatMap((h) => [-14, 14].map((d) => ({ on: baskets[h.i], at: [h.at[0] + d, h.at[1], h.at[2]] as Vec3, dir: [0, 1, 0] as Vec3 }))), 0.04);
  });
  m.step({ title: "Set the baskets on the swing arms", detail: "Lower each one onto its pair of arms until its brackets click over them. Swing them in and out to check.", kind: "general" }, () => {
    b.stagger(0.3);
    for (const k of baskets) b.add(k, [0, 0, 380]);
  });
}

/**
 * METOD corner base cabinet 88 x 88: an L of two boxes. A full box along one wall, built like any base cabinet, and a
 * short box along the other wall whose bottom carries on from the first box's bottom, joined with dowels and cams.
 * Each box has its own back, a corner rail ties the tops together, and the door is two narrow leaves joined by corner
 * hinges. The corner of the room is at the back left: the long box runs along the left wall, the short one along the back.
 */
function cornerBase88(m: Metod) {
  const { b, s } = m;
  const slug = s.slug ?? "";
  const W = m.W, A = 600, H = m.Htot, y0 = m.y0;
  const x0 = -W / 2, z0 = -W / 2;
  const top = y0 + H;
  const xf = x0 + A; // the long box's front, and where the short box starts
  const zf = z0 + A; // the short box's front
  const RY = Math.PI / 2;
  const carousel = /carousel/.test(slug);
  const shelf = /shelf/.test(slug);
  const door = (s.cabinet?.doors ?? 0) > 0;

  // the long box: its sides at the back and the front end, open towards +x
  const s1a = m.part("Side panel", [T, H, A], [x0 + A / 2, y0 + H / 2, z0 + T / 2], { rot: [0, RY, 0] });
  const s1b = m.part("Side panel", [T, H, A], [x0 + A / 2, y0 + H / 2, W / 2 - T / 2], { rot: [0, RY, 0] });
  const bottom1 = m.part("Bottom panel", [W - 2 * T, T, A], [x0 + A / 2, y0 + T / 2, 0], { rot: [0, RY, 0] });
  const back1 = m.part("Back panel", [W, H, 3], [x0 - 1.5, y0 + H / 2, 0], { material: "fiber", rot: [0, RY, 0] });
  const rail1 = m.part("Rail", [W - 2 * T, 16, 60], [x0 + 30, top - 8, 0], { material: "metal", rot: [0, RY, 0] });
  // the short box: its bottom carries on from the long one's, an end panel, a back on the back wall
  const bw2 = W / 2 - T - xf;
  const bottom2 = m.part("Short bottom", [bw2, T, A], [xf + bw2 / 2, y0 + T / 2, z0 + A / 2]);
  const side2 = m.part("Side panel", [T, H, A], [W / 2 - T / 2, y0 + H / 2, z0 + A / 2]);
  const back2 = m.part("Short back", [W / 2 - xf, H, 3], [(xf + W / 2) / 2, y0 + H / 2, z0 - 1.5], { material: "fiber" });
  const tr = b.compound(
    "Corner rail",
    [
      { shape: "box", size: [60, 16, W - 2 * T], pos: [xf - 30, top - 8, 0] },
      { shape: "box", size: [W / 2 - T - xf, 16, 60], pos: [(xf + W / 2 - T) / 2, top - 8, zf - 30] },
    ],
    { material: "metal" },
  );
  const tRail = b.place(tr.type, tr.mid);

  const zb = zs(A, 3, 0.5);
  const zd = zs(A, 3, 0).map((z, i) => r(z + (i === 2 ? -20 : 20)));
  // a joint between one of the long box's sides and its bottom: x across the box from the wall
  const j1 = (sz: -1 | 1) => {
    const side = sz < 0 ? s1a : s1b;
    const z = sz < 0 ? z0 + T : W / 2 - T;
    const y = y0 + T / 2;
    const xs = (list: number[]) => list.map((v) => x0 + A / 2 + v);
    return {
      bolts: xs(zb).map((x): FitOpts => ({ on: side, at: [r(x), y, z], dir: [0, 0, sz], mate: bottom1 })),
      cams: xs(zb).map((x): FitOpts => ({ on: bottom1, at: [r(x), y0 + T, z - sz * 34], dir: [0, -1, 0] })),
      dowels: xs(zd).map((x): FitOpts => ({ on: bottom1, at: [r(x), y, z], dir: [0, 0, -sz], mate: side })),
    };
  };
  const zj = zb.map((z) => r(z0 + A / 2 + z));
  const joinBolts = zj.map((z): FitOpts => ({ on: bottom1, at: [xf, y0 + T / 2, z], dir: [-1, 0, 0], mate: bottom2 }));
  const joinCams = zj.map((z): FitOpts => ({ on: bottom2, at: [xf + 34, y0 + T, z], dir: [0, -1, 0] }));
  const joinDowels = [0.15, 0.4, 0.6, 0.85].map((f): FitOpts => ({ on: bottom2, at: [xf, y0 + T / 2, r(z0 + A * f)], dir: [1, 0, 0], mate: bottom1 }));
  const endBolts = zj.map((z): FitOpts => ({ on: side2, at: [W / 2 - T, y0 + T / 2, z], dir: [1, 0, 0], mate: bottom2 }));
  const endCams = zj.map((z): FitOpts => ({ on: bottom2, at: [W / 2 - T - 34, y0 + T, z], dir: [0, -1, 0] }));
  const endDowels = zd.map((z): FitOpts => ({ on: bottom2, at: [W / 2 - T, y0 + T / 2, r(z0 + A / 2 + z)], dir: [-1, 0, 0], mate: side2 }));
  const susp: Susp[] = [
    { side: s1a, at: [x0 + 28, top - 45, z0 + T], out: [0, 0, -1], back: [-1, 0, 0] },
    { side: s1b, at: [x0 + 28, top - 45, W / 2 - T], out: [0, 0, 1], back: [-1, 0, 0] },
    { side: side2, at: [W / 2 - T, top - 45, z0 + 28], out: [1, 0, 0], back: [0, 0, -1] },
  ];

  m.step({ title: "Screw the cam bolts into the long box's sides", detail: "Three into each side, in the holes nearest the bottom. Turn them in by hand until they stop.", kind: "cams", tools: ["screwdriver"], scene: "prep", warnings: ["floor"] }, () => {
    b.stagger(0.25);
    b.stage(s1a, [0, T / 2, -(A / 2 + 40)], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.stage(s1b, [0, T / 2, A / 2 + 40], [0, 0, -Math.PI / 2], [0, 160, 0]);
    b.then(0.15);
    b.fits(BOLT, [...j1(-1).bolts, ...j1(1).bolts], 0.06);
  });
  m.step({ title: "Screw a suspension fitting onto each side", detail: "In the top back corner, three screws each. The big hole faces the back.", kind: "screws", tools: ["screwdriver"], scene: "prep" }, () => {
    for (const f of susp.slice(0, 2)) suspFit(m, f);
  });
  m.step({ title: "Tap the dowels into the ends of the bottom", detail: "Three into each end.", kind: "dowels", tools: ["hammer"], pose: "+x", warnings: ["floor"] }, () => {
    m.put(bottom1, [200, 0, 0]);
    b.then(0.1);
    b.fits(DOWEL, [...j1(-1).dowels, ...j1(1).dowels], 0.06);
  });
  m.step({ title: "Press both sides onto the bottom", detail: "Lay it on its back on the rug. Bolts and dowels into their holes, inside faces towards each other.", kind: "dowels", people: 2 }, () => {
    b.stagger(0.3);
    m.put(s1a, [0, 0, -260]);
    m.put(s1b, [0, 0, 260]);
  });
  m.step({ title: "Lock the cams", detail: "Arrow towards the bolt, then turn each one clockwise until it bites.", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(CAM, [...j1(-1).cams, ...j1(1).cams], 0.1);
  });
  m.step({ title: "Stand it up and slide the card from the box inside", detail: "It keeps the frame from racking while you work on it. Take it out once the back is on.", kind: "general", pose: "+y" }, () => {});
  m.step({ title: "Screw the back rail across the top", detail: "Flush with the back edges of the sides, one screw down into each.", kind: "screws", tools: ["screwdriver"] }, () => {
    m.put(rail1, [0, 220, 0]);
    b.then(0.1);
    b.fits(RAIL_SCREW, [z0 + T / 2, W / 2 - T / 2].map((z) => ({ on: rail1, at: [x0 + 30, top, z] as Vec3, dir: [0, -1, 0] as Vec3, mate: z < 0 ? s1a : s1b })), 0.12);
  });
  const xb = x0 - 3;
  const nailL = (z: number, y: number, on: string): FitOpts => ({ on, at: [xb, r(y), r(z)], dir: [1, 0, 0], hole: false });
  m.step({ title: "Lay it on its front and nail the back on at three corners", detail: "Check it's square first: both diagonals the same. One nail in a bottom corner, then the other bottom corner, then a top one.", kind: "nails", tools: ["hammer", "tape"], pose: "-x", check: "square", warnings: ["square", "floor"] }, () => {
    m.put(back1, [-260, 0, 0]);
    b.then(0.1);
    b.fits(NAIL, [nailL(z0 + 10, y0 + T / 2, s1a), nailL(W / 2 - 10, y0 + T / 2, s1b), nailL(W / 2 - 10, top - 30, s1b)], 0.25);
  });
  m.step({ title: "Nail on the two plastic brackets at the top", detail: "One in each top corner of the back, one nail each.", kind: "nails", tools: ["hammer"] }, () => {
    const pts = [nailL(z0 + 40, top - 20, s1a), nailL(W / 2 - 40, top - 20, s1b)];
    b.fits(CLIP, pts, 0.2);
    b.then(0.05);
    b.fits(NAIL, pts, 0.15);
  });
  m.step({ title: "Nail the rest of the back", detail: "Ten nails along the edges, into the sides and the bottom.", kind: "nails", tools: ["hammer"] }, () => {
    const list: FitOpts[] = [];
    for (const f of [0.35, 0.65]) list.push(nailL(z0 + 9, y0 + H * f, s1a), nailL(W / 2 - 9, y0 + H * f, s1b));
    for (const f of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85]) list.push(nailL(z0 + W * f, y0 + T / 2, bottom1));
    b.fits(NAIL, list, 0.05);
  });
  m.step({ title: "Lay it on its side and screw three cam bolts into the bottom", detail: "Into the front edge of the bottom, by the back end. The short box joins on there.", kind: "cams", tools: ["screwdriver"], pose: "+z", warnings: ["floor"] }, () => {
    b.fits(BOLT, joinBolts, 0.08);
  });
  m.step({ title: "Tap the dowels into the short bottom and push it on", detail: "Seven dowels: four into the edge that meets the long box, three into the other end. Then push it onto the bolts.", kind: "dowels", tools: ["hammer"] }, () => {
    m.put(bottom2, [300, 0, 0]);
    b.then(0.1);
    b.fits(DOWEL, [...joinDowels, ...endDowels], 0.05);
  });
  m.step({ title: "Lock the cams", detail: "Three, in the short bottom. Turn each one clockwise until it pulls the bottoms tight.", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(CAM, joinCams, 0.1);
  });
  m.step({ title: "Screw the cam bolts and a suspension fitting into the end panel", detail: "Three bolts near its bottom, and the fitting in its top back corner with three screws.", kind: "cams", tools: ["screwdriver"], scene: "end", warnings: ["floor"] }, () => {
    b.stage(side2, [0, T / 2, 0], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.then(0.15);
    b.fits(BOLT, endBolts, 0.06);
    b.then(0.1);
    suspFit(m, susp[2]);
  });
  m.step({ title: "Push the end panel onto the short bottom and lock the cams", detail: "Bolts and dowels into their holes, then three cams turned clockwise until they bite.", kind: "cams", tools: ["screwdriver"] }, () => {
    m.put(side2, [300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, endCams, 0.1);
  });
  m.step({ title: "Stand it up and slide the short back down into its grooves", detail: "From the top, along the back of the short box, until it sits on the bottom.", kind: "general", pose: "+y" }, () => {
    m.put(back2, [0, 400, 0]);
  });
  m.step({ title: "Screw the corner rail across the top front", detail: "Its long arm runs along the front of the long box, the short arm over the front of the short box. Four screws, and the clips at the ends push into the sides.", kind: "screws", tools: ["screwdriver"] }, () => {
    m.put(tRail, [0, 220, 0]);
    b.then(0.1);
    b.fits(
      RAIL_SCREW,
      [
        { on: tRail, at: [xf - 30, top, z0 + T / 2], dir: [0, -1, 0], mate: s1a },
        { on: tRail, at: [xf - 30, top, W / 2 - T / 2], dir: [0, -1, 0], mate: s1b },
        { on: tRail, at: [W / 2 - T / 2, top, zf - 45], dir: [0, -1, 0], mate: side2 },
        { on: tRail, at: [W / 2 - T / 2, top, zf - 15], dir: [0, -1, 0], mate: side2 },
      ],
      0.12,
    );
  });
  const zb2 = z0 - 3;
  const nailB = (x: number, y: number, on: string): FitOpts => ({ on, at: [r(x), r(y), zb2], dir: [0, 0, 1], hole: false });
  m.step({ title: "Nail the short back on", detail: "Check it's square. One nail at the bottom by the end panel, one at the top, then a plastic bracket with a nail in each top corner.", kind: "nails", tools: ["hammer", "tape"], check: "square", warnings: ["square"] }, () => {
    b.fits(NAIL, [nailB(W / 2 - 10, y0 + T / 2, side2), nailB(W / 2 - 10, top - 30, side2)], 0.25);
    b.then(0.1);
    const pts = [nailB(xf + 30, top - 20, back2), nailB(W / 2 - 40, top - 20, back2)];
    b.fits(CLIP, pts, 0.2);
    b.then(0.05);
    b.fits(NAIL, pts, 0.15);
  });
  m.step({ title: "Nail the rest of the short back", detail: "Five nails along the end panel and the bottom.", kind: "nails", tools: ["hammer"] }, () => {
    b.fits(NAIL, [nailB(W / 2 - 9, y0 + H * 0.35, side2), nailB(W / 2 - 9, y0 + H * 0.65, side2), ...[0.25, 0.5, 0.75].map((f) => nailB(xf + (W / 2 - xf) * f, y0 + T / 2, bottom2))], 0.05);
  });

  const yr = top - 45;
  const railL = m.part("Suspension rail", [W, 40, 8], [x0 - 3 - 4, yr, 0], { material: "metal", extra: true, rot: [0, RY, 0] });
  const railB = m.part("Suspension rail", [W, 40, 8], [0, yr, z0 - 3 - 4], { material: "metal", extra: true });
  cornerFinish(m, {
    legs: [
      [x0 + 40, 0, z0 + 60],
      [x0 + 40, 0, W / 2 - 60],
      [xf - 60, 0, W / 2 - 60],
      [xf - 60, 0, zf - 60],
      [W / 2 - 40, 0, z0 + 60],
      [W / 2 - 40, 0, zf - 60],
    ],
    rails: [
      { key: railL, ends: [z0 + 60, W / 2 - 60].map((z): Vec3 => [x0 - 3, yr, z]), out: [-1, 0, 0] },
      { key: railB, ends: [xf + 40, W / 2 - 60].map((x): Vec3 => [x, yr, z0 - 3]), out: [0, 0, -1] },
    ],
    susp,
    join: { side: s1b, at: [-1, 1].flatMap((dy) => [-1, 1].map((dx): Vec3 => [r(x0 + A / 2 + dx * 180), r(y0 + H / 2 + dy * 250), W / 2])), out: [0, 0, -1] },
  });

  if (shelf) {
    const y = Math.round((y0 + H / 2) / 32) * 32;
    const st = b.compound("Corner shelf", [
      { shape: "box", size: [A - 40, 16, W - 2 * T - 2], pos: [x0 + 20 + (A - 40) / 2, y + 8, 0] },
      { shape: "box", size: [W / 2 - T - xf + 19, 16, A - 40], pos: [(xf - 20 + W / 2 - T - 1) / 2, y + 8, z0 + 20 + (A - 40) / 2] },
    ]);
    const k = b.place(st.type, st.mid);
    m.step({ title: "Push in the shelf pins and lay the shelf on", detail: "Six pins at one height: two in each side of the long box and two in the end panel.", kind: "shelves" }, () => {
      const pins: FitOpts[] = [];
      for (const x of [x0 + 60, xf - 80]) pins.push({ on: s1a, at: [x, y - 3, z0 + T], dir: [0, 0, -1] }, { on: s1b, at: [x, y - 3, W / 2 - T], dir: [0, 0, 1] });
      for (const z of [z0 + 60, zf - 80]) pins.push({ on: side2, at: [W / 2 - T, y - 3, z], dir: [1, 0, 0] });
      b.fits(PIN, pins, 0.05);
      b.then(0.1);
      b.add(k, [300, 100, 300]);
    });
  }
  if (carousel) corner88Carousel(m, { x0, z0, xf, top, bottom1, s1a, s1b });

  if (!door) return;
  // two leaves at the inside corner: one across the short box's front, one across the long box's front
  const lw = 247, dh = H - GAP;
  const ye = r(y0 + H / 2);
  const lf = zf + 2 + T / 2, xl2 = xf + 2 + T / 2;
  const leafA = m.part("Door", [lw, dh, T], [W / 2 - 1.5 - lw / 2, ye, lf]);
  const leafB = m.part("Door", [lw, dh, T], [xl2, ye, W / 2 - 1.5 - lw / 2], { rot: [0, RY, 0] });
  const CORNER_HINGE: HwDef = { kind: "hinge", len: 70, dia: 30, name: "Corner hinge" };
  const ROLLER: HwDef = { ...HW.roller, name: "Door roller" };
  const hy = [y0 + 120, top - 120];
  const ja = W / 2 - 1.5 - lw + 15; // leaf A's edge at the inside corner
  m.step({ title: "Screw the hinge plates onto one leaf", detail: "On the back of the leaf that goes across the long box, along its edge at the inside corner. Two screws each.", kind: "hinges", tools: ["screwdriver"], scene: "doors", warnings: ["floor", "face"] }, () => {
    b.stage(leafB, [0, T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    b.fits(HINGE_PLATE, hy.map((y) => ({ on: leafB, at: [xl2 - T / 2, y, W / 2 - 1.5 - lw + 15] as Vec3, dir: [1, 0, 0] as Vec3, hole: false as const })), 0.12);
    b.fits(SMALL, hy.flatMap((y) => [-12, 12].map((d) => ({ on: leafB, at: [xl2 - T / 2, y + d, W / 2 - 1.5 - lw + 15] as Vec3, dir: [1, 0, 0] as Vec3 }))), 0.05);
  });
  m.step({ title: "Screw the corner hinges onto the other leaf", detail: "On the back of the second leaf, along the same edge. Two screws each.", kind: "hinges", tools: ["screwdriver"], scene: "doors" }, () => {
    b.stage(leafA, [lw + 80, T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    b.fits(CORNER_HINGE, hy.map((y) => ({ on: leafA, at: [ja, y, lf - T / 2] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.12);
    b.fits(SMALL, hy.flatMap((y) => [-12, 12].map((d) => ({ on: leafA, at: [ja + 8, y + d, lf - T / 2] as Vec3, dir: [0, 0, 1] as Vec3 }))), 0.05);
  });
  m.step({ title: "Clip the leaves together and screw on the roller", detail: "Each corner hinge clips onto its plate. The roller goes at the top of the free leaf, 25 mm from its edge, with two screws in pre-drilled holes.", kind: "hinges", tools: ["screwdriver", "drill"], scene: "doors" }, () => {
    b.fit(ROLLER, { on: leafB, at: [xl2 - T / 2, top - 40, W / 2 - 1.5 - 25], dir: [1, 0, 0], hole: false });
    b.fits(SMALL, [-14, 14].map((d) => ({ on: leafB, at: [xl2 - T / 2, top - 40 + d, W / 2 - 1.5 - 25] as Vec3, dir: [1, 0, 0] as Vec3 })), 0.08);
  });
  m.step({ title: "Press the hinges into the door and screw their plates onto the end panel", detail: "Two hinges along the outer edge of the leaf across the short box; the plates go in the holes at the front of the end panel, two screws each.", kind: "hinges", tools: ["screwdriver"] }, () => {
    b.fits(HINGE, hy.map((y) => ({ on: leafA, at: [W / 2 - 1.5 - 22, y, lf - T / 2] as Vec3, dir: [0, 0, 1] as Vec3, twist: Math.PI })), 0.1);
    b.then(0.1);
    b.fits(EURO, hy.flatMap((y) => [-16, 16].map((d) => ({ on: side2, at: [W / 2 - T, y + d, zf - 37] as Vec3, dir: [1, 0, 0] as Vec3 }))), 0.05);
  });
  m.step({ title: "Click the door onto the plates", detail: "Hold both leaves folded flat, hook the hinge arms over the plates and press until they click.", kind: "doors", people: 2 }, () => {
    b.stagger(0);
    b.add(leafA, [0, 0, 380]);
    b.add(leafB, [380, 0, 0]);
  });
  m.step({ title: "Line up the door and stick on the bumpers", detail: "Turn the hinge screws until both leaves close evenly. The two bumpers go on the front edge of the bottom, where the folding leaf closes.", kind: "doors", tools: ["screwdriver"] }, () => {
    b.fits(BUMPER, [W / 2 - 120, W / 2 - 40].map((z) => ({ on: bottom1, at: [xf, y0 + T / 2, z] as Vec3, dir: [-1, 0, 0] as Vec3, hole: false as const })), 0.1);
  });
}

/** UTRUSTA carousel for the 88 corner cabinet: two kidney trays turning on a bearing on the bottom and one under a beam. */
function corner88Carousel(m: Metod, c: { x0: number; z0: number; xf: number; top: number; bottom1: string; s1a: string; s1b: string }) {
  const { b } = m;
  const BEARING: HwDef = { kind: "connector", len: 20, dia: 70, name: "Bearing" };
  const POST: HwDef = { kind: "pin", len: 60, dia: 8, name: "Rail post" };
  const JOINER: HwDef = { kind: "clip", len: 30, dia: 10, name: "Rim joiner" };
  const BEAM_BRACKET: HwDef = { kind: "angle", len: 60, dia: 40, name: "Beam bracket" };
  const cx = c.x0 + 300, cz = c.z0 + 300, dia = 550;
  const y0 = m.y0 + T;
  const ys = [y0 + 40, r(y0 + (c.top - y0) * 0.5)];
  const tray = (y: number) => {
    const t = b.compound(
      "Carousel tray",
      [
        { shape: "cyl", size: [dia, 12, dia], pos: [0, 6, 0] },
        { shape: "cyl", size: [dia, 6, dia], pos: [0, 70, 0], material: "metal" },
      ],
      { material: "metal" },
    );
    return b.place(t.type, [cx + t.mid[0], y + t.mid[1], cz + t.mid[2]]);
  };
  const trays = ys.map(tray);
  const beam = m.part("Carousel beam", [40, 30, m.W - 2 * T], [cx, c.top - 90, 0], { material: "metal" });
  const ring = (i: number) => Array.from({ length: 14 }, (_, j) => {
    const a = (j / 14) * Math.PI * 2;
    return [r(cx + Math.cos(a) * (dia / 2 - 8)), ys[i] + 12, r(cz + Math.sin(a) * (dia / 2 - 8))] as Vec3;
  });
  m.step({ title: "Screw the bottom bearing onto the bottom", detail: "Where the marks show, at the middle of the corner. Four screws.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fit(BEARING, { on: c.bottom1, at: [cx, y0, cz], dir: [0, -1, 0], hole: false });
    b.then(0.05);
    b.fits(SMALL, [0, 1, 2, 3].map((k) => ({ on: c.bottom1, at: [r(cx + Math.cos((k * Math.PI) / 2) * 25), y0, r(cz + Math.sin((k * Math.PI) / 2) * 25)] as Vec3, dir: [0, -1, 0] as Vec3 })), 0.06);
  });
  m.step({ title: "Screw a hub under each tray", detail: "Five screws each, through the hub into the middle of the tray.", kind: "screws", tools: ["screwdriver"], scene: "carousel", warnings: ["floor"] }, () => {
    b.stagger(0.3);
    trays.forEach((k, i) => b.stage(k, [(i - 0.5) * (dia + 80), 40, 0], [0, 0, 0], [0, 160, 0]));
    b.then(0.1);
    b.fits(SMALL, [0, 1].flatMap((i) => [0, 1, 2, 3, 4].map((k) => ({ on: trays[i], at: [r(cx + Math.cos((k * 2 * Math.PI) / 5) * 30), ys[i], r(cz + Math.sin((k * 2 * Math.PI) / 5) * 30)] as Vec3, dir: [0, 1, 0] as Vec3 }))), 0.04);
  });
  m.step({ title: "Push the rail posts in and close the rims", detail: "Fourteen posts around each tray, the rim pressed down over them until it clicks, and a joiner over the rim's ends.", kind: "general", scene: "carousel" }, () => {
    b.fits(POST, [0, 1].flatMap((i) => ring(i).map((at) => ({ on: trays[i], at, dir: [0, -1, 0] as Vec3 }))), 0.02);
    b.then(0.1);
    b.fits(JOINER, [0, 1].map((i) => ({ on: trays[i], at: [cx + dia / 2 - 8, ys[i] + 70, cz] as Vec3, dir: [0, -1, 0] as Vec3, hole: false as const })), 0.15);
  });
  m.step({ title: "Set the lower tray on the bottom bearing", detail: "Its hub drops over the bearing's peg. Turn it to check it runs freely.", kind: "general" }, () => {
    b.add(trays[0], [200, 200, 200]);
  });
  m.step({ title: "Fit the beam across the long box", detail: "A bracket screwed into each side, the beam bolted to both brackets with two bolts and nuts each, and the top bearing under it with three screws.", kind: "screws", tools: ["screwdriver", "allen", "wrench"] }, () => {
    const ends = [c.z0 + T, -c.z0 - T];
    b.fits(BEAM_BRACKET, ends.map((z, i) => ({ on: i ? c.s1b : c.s1a, at: [cx, c.top - 90, z] as Vec3, dir: [0, 0, i ? 1 : -1] as Vec3, hole: false as const })), 0.12);
    b.fits(PLATE_SCREW, ends.map((z, i) => ({ on: i ? c.s1b : c.s1a, at: [cx, c.top - 70, z] as Vec3, dir: [0, 0, i ? 1 : -1] as Vec3 })), 0.1);
    b.then(0.1);
    m.put(beam, [0, 200, 0]);
    b.then(0.1);
    const bolts = ends.flatMap((z) => [-1, 1].map((k) => [cx + k * 12, c.top - 75, z + Math.sign(-z) * 30] as Vec3));
    b.fits(M6_BOLT, bolts.map((at) => ({ on: beam, at, dir: [0, -1, 0] as Vec3 })), 0.06);
    b.fits(M6_NUT, bolts.map((at) => ({ on: beam, at: [at[0], c.top - 105, at[2]] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.06);
    b.then(0.1);
    b.fit(BEARING, { on: beam, at: [cx, c.top - 105, cz], dir: [0, 1, 0], hole: false });
    b.fits(SMALL, [0, 1, 2].map((k) => ({ on: beam, at: [cx, c.top - 105, r(cz + (k - 1) * 14)] as Vec3, dir: [0, 1, 0] as Vec3 })), 0.06);
  });
  m.step({ title: "Hang the upper tray and lock it", detail: "Tip it in, push its hub up onto the top bearing and turn the screw in the hub so it can't drop. The last screw locks the pole.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.add(trays[1], [200, 0, 200]);
    b.then(0.1);
    b.fit(JOIN_SCREW, { on: trays[1], at: [cx + 30, ys[1] + 12, cz], dir: [0, -1, 0] });
  });
}

const family: Family = {
  names: ["METOD"],
  build(b, s) {
    if (s.archetype !== "cabinet" && s.archetype !== "drawers") return false;
    const slug = s.slug ?? "";
    if (/corner-wall/.test(slug)) {
      cornerWall(new Metod(b, s, "wall"));
      return true;
    }
    if (/corner-base/.test(slug)) {
      const m = new Metod(b, s, "base");
      if (s.size.w >= 100) cornerBase128(m);
      else cornerBase88(m);
      return true;
    }
    if (/extr-hood|extractor-hood/.test(slug)) {
      hoodCabinet(new Metod(b, s, "wall"));
      return true;
    }
    const kind = kindOf(s);
    if (!kind) return false;
    new Metod(b, s, kind).build();
    return true;
  },
};
export default family;
