import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";

/**
 * HAVBÄCK bathroom furniture, read from the wash-stand, high cabinet and wall cabinet manuals and the basin,
 * countertop and HAGAÅN manuals sold with them. Nothing is cam-locked: every panel has click fittings that snap into
 * the sides, and plastic wedges are pushed in afterwards to lock them. Each unit hangs on a suspension rail screwed to
 * the wall, is locked to it with two machine screws, and a wash-stand or high cabinet is also screwed to the wall at the
 * bottom through two small brackets. A wash-stand has two sides, a back panel across the top, a rail along the bottom
 * front and (with drawers) a low back rail: no top or bottom, so the pipes can come up from behind. Its two drawers are
 * boxes built on their own and pushed onto the runners, with the front hooked on last; a doors version has a shelf with
 * an upstand and two doors on clip hinges. High and wall cabinets are boxes built lying on their front, with a
 * hardboard back slid into grooves and riveted, and one door. Sets of two or three units are built one by one and
 * screwed together side by side before the basin or countertop goes on.
 */

type Kind = "drawers" | "doors" | "open" | "high" | "wall";

const GAP = 3;

const SCREW: HwDef = { kind: "screw", len: 13, dia: 3.5 }; // the small chipboard screws for brackets, fittings and hinge plates
const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const PLATE_SCREW: HwDef = { kind: "screw", len: 10, dia: 6 }; // the stubby screws for the joining plates
const FIT_SCREW: HwDef = { kind: "screw", len: 25, dia: 4 }; // locks a high or wall cabinet's suspension fitting
const MACHINE: HwDef = { kind: "bolt", len: 12, dia: 6 };
const JOIN: HwDef = { kind: "screw", len: 40, dia: 5 };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 22 };
const BRACKET: HwDef = { kind: "angle", len: 40, dia: 30 };
const SUSPENSION: HwDef = { kind: "hook", len: 60, dia: 40 };
const WEDGE_TOP: HwDef = { kind: "connector", len: 60, dia: 12 };
const WEDGE_LOW: HwDef = { kind: "connector", len: 70, dia: 14 };
const SPACER: HwDef = { kind: "spacer", len: 8, dia: 20 };
const HINGE: HwDef = { kind: "hinge", len: 50, dia: 35 };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 10 };
const STOP: HwDef = { kind: "clip", len: 20, dia: 14 }; // the plastic door stop
const WIRE: HwDef = { kind: "clip", len: 40, dia: 8 }; // the bent wire clips in a drawer
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 }; // plastic, with a cam over its head
const CAM: HwDef = { kind: "cam", len: 10, dia: 15 };
const SUPPORT: HwDef = { kind: "strap", len: 150, dia: 30, name: "Drawer support" }; // a steel stay up the inside of a wide drawer's back
const JOIN_PLATE: HwDef = { kind: "connector", len: 50, dia: 30 }; // a flat joining plate
const SHELF_SUPPORT: HwDef = { kind: "pin", len: 16, dia: 5 }; // with a screw-in peg, it locks the shelf
const SHELF_PIN: HwDef = { kind: "pin", len: 12, dia: 5 }; // the plain clip-in kind
const RIVET: HwDef = { kind: "clip", len: 12, dia: 8 }; // a sleeve and its pin, through the back
const BACK_CLIP: HwDef = { kind: "clip", len: 16, dia: 12 };
const LEG_PLATE: HwDef = { kind: "plate", len: 40, dia: 40 };
const COVER: HwDef = { kind: "cap", len: 10, dia: 40 };

const r = (n: number) => Math.round(n * 10) / 10;

interface Unit {
  kind: Kind;
  x0: number; // centre
  W: number;
  H: number;
  D: number;
  T: number;
  sideL: string;
  sideR: string;
  panels: string[]; // in the order they click in
  backs: string[]; // a hardboard back (high and wall cabinets)
  shelves: string[];
  rail: string;
  zr: number; // the rail's centre, between the back and the wall
  yr: number;
  hinges: "L" | "R" | "both" | "none";
}

interface Drawer {
  front: string;
  boxFront: string;
  back: string;
  sides: [string, string];
  bottom: string;
  divider?: string;
  lo: number;
  hi: number;
  yb: number;
  sh: number;
  u: Unit;
}

interface Door {
  key: string;
  u: Unit;
  sx: -1 | 1; // hinge side
  x: number;
  w: number;
  lo: number;
  hi: number;
  ys: number[];
}

/** What a guide is: the units in it from left to right, and what goes on top. */
interface Layout {
  units: { kind: Kind; W: number; H: number; D: number }[];
  us: boolean;
  top?: { kind: "basin" | "deep" | "double" | "counter"; W: number; D: number; h: number; bowl?: "semi" | "vessel"; bowlX?: number };
  tap: boolean;
}

function layoutOf(s: ProductSpec): Layout | null {
  const slug = s.slug ?? "";
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const us = /bathroom-vanity|124-5|155-x|deep-wash-basin-2|45-5-x/.test(slug);
  const FH = us ? 638 : 630;
  const doors = /doors|w-drs/.test(slug) && !/drawers/.test(slug);
  const kind: Kind = doors ? "doors" : "drawers";
  if (/high-cabinet/.test(slug)) return { units: [{ kind: "high", W, H, D }], us, tap: false };
  if (/wall-cabinet/.test(slug)) return { units: [{ kind: "wall", W, H, D }], us, tap: false };
  if (!/wash|vanity/.test(slug)) return null;
  const tap = /tap/.test(slug);
  // a stand on its own
  if (!/orrsjon|vindelalven/.test(slug)) return { units: [{ kind, W, H: FH, D }], us, tap };
  const counter = /drawers-wash-basin-8-2|drawers-wash-basin-t|doors-wash-basin-82|124-5-x-54|155-x|vindelalven/.test(slug);
  const fd = us ? 535 : D - 10;
  // the sets of several units, sold as one
  if (/124-5|155-x/.test(slug)) {
    const units: Layout["units"] = /155-x/.test(slug)
      ? [{ kind: "open", W: 460, H: FH, D: fd }, { kind: "drawers", W: 610, H: FH, D: fd }, { kind: "open", W: 460, H: FH, D: fd }]
      : [{ kind: "drawers", W: 610, H: FH, D: fd }, { kind: "drawers", W: 610, H: FH, D: fd }];
    const top: Layout["top"] = counter
      ? { kind: "counter", W, D, h: 20, bowl: "semi", bowlX: /124-5/.test(slug) ? -W / 4 : 0 }
      : { kind: "double", W, D, h: H - FH };
    return { units, us, top, tap };
  }
  const fw = us && W < 700 ? 610 : Math.round((W - 20) / 100) * 100;
  if (counter) return { units: [{ kind, W: fw, H: FH, D: fd }], us, top: { kind: "counter", W, D, h: 20, bowl: /vindelalven/.test(slug) ? "vessel" : "semi" }, tap };
  return { units: [{ kind, W: fw, H: FH, D: fd }], us, top: { kind: /deep/.test(slug) ? "deep" : "basin", W, D, h: H - FH }, tap };
}

class Havback {
  b: PlanBuilder;
  s: ProductSpec;
  L: Layout;
  types = new Map<string, string>();
  units: Unit[] = [];
  drawers: Drawer[] = [];
  doorList: Door[] = [];
  poses = new Map<string, Pose>();
  alt?: string; // a unit built in its own scene before it joins the others
  origin: Vec3 = [0, 0, 0];

  constructor(b: PlanBuilder, s: ProductSpec, L: Layout) {
    this.b = b;
    this.s = s;
    this.L = L;
  }

  part(name: string, size: Vec3, pos: Vec3, o: { material?: PartMaterial; shape?: "box" | "cyl" } = {}) {
    const k = `${name}|${size.map(Math.round).join("x")}|${o.material ?? "board"}`;
    let ref = this.types.get(k);
    if (!ref) {
      ref = this.b.part(name, size.map(r) as Vec3, { material: o.material ?? "board", shape: o.shape });
      this.types.set(k, ref);
    }
    return this.b.place(ref, pos.map(r) as Vec3);
  }

  compound(name: string, pieces: PartPiece[], at: (mid: Vec3) => Vec3) {
    const c = this.b.compound(name, pieces);
    return this.b.place(c.type, at(c.mid));
  }

  pos(key: string) {
    return this.b.partItem(key).final.pos;
  }

  put(key: string, from: Vec3) {
    if (!this.alt) return this.b.add(key, from);
    const p = this.pos(key);
    this.b.stage(key, [p[0] - this.origin[0], p[1] - this.origin[1], p[2] - this.origin[2]], [0, 0, 0], from);
  }

  step(def: { title: string; detail?: string; kind: StepKind; tools?: ToolId[]; people?: 1 | 2; pose?: Pose; warnings?: WarnId[]; scene?: string; repeat?: number; check?: "square"; wall?: boolean }, body: () => void) {
    const warnings = [...(def.warnings ?? [])];
    if (def.people === 2 && !warnings.includes("two")) warnings.unshift("two");
    const scene = def.scene ?? (this.alt ? this.alt : "main");
    const pose = def.pose ?? this.poses.get(scene) ?? "+y";
    this.poses.set(scene, pose);
    this.b.step({ ...def, repeat: def.repeat ?? this.repeatNext, scene, pose, warnings: warnings.slice(0, 3) }, body);
  }

  /* ---------- the units ---------- */

  unit(kind: Kind, x0: number, W: number, H: number, D: number): Unit {
    const box = kind === "high" || kind === "wall";
    const T = box ? 16 : 18;
    const sideL = this.part("Side panel", [T, H, D], [x0 - (W / 2 - T / 2), H / 2, 0]);
    const sideR = this.part("Side panel", [T, H, D], [x0 + (W / 2 - T / 2), H / 2, 0]);
    const iw = W - 2 * T;
    const zb = -D / 2 + 20 + T / 2; // the panels at the back stand in from the back edges, leaving room for the rail
    const panels: string[] = [];
    const backs: string[] = [];
    const shelves: string[] = [];
    if (kind === "drawers" || kind === "doors") {
      panels.push(this.part("Back panel", [iw, 160, T], [x0, H - 80, zb]));
      if (kind === "drawers") panels.push(this.part("Back rail", [iw, 100, T], [x0, 50, zb]));
      panels.push(this.part("Front rail", [iw, T, 60], [x0, T / 2, D / 2 - 30]));
    } else {
      // from the back in its grooves to the front edge, or to just behind the door
      const pd = kind === "open" ? D - 14 : D - T - 15, pz = kind === "open" ? 7 : (13 - T) / 2;
      panels.push(this.part("Top panel", [iw, T, pd], [x0, H - T / 2, pz]));
      if (kind !== "wall") panels.push(this.part(kind === "open" ? "Shelf" : "Fixed shelf", [iw, T, pd], [x0, H / 2, pz]));
      panels.push(this.part("Bottom panel", [iw, T, pd], [x0, T / 2, pz]));
      backs.push(this.part("Back panel", [iw + 16, H - 2 * T + 16, 3], [x0, H / 2, -D / 2 + 12], { material: "fiber" }));
    }
    const yr = H - (box || kind === "open" ? T : 0) - 110;
    const zr = -D / 2 + 5;
    const rail = this.part("Suspension rail", [W - 2 * T - 10, 40, 8], [x0, yr, zr], { material: "metal" });
    const u: Unit = { kind, x0, W, H, D, T, sideL, sideR, panels, backs, shelves, rail, zr, yr, hinges: kind === "doors" ? "both" : box ? "L" : "none" };
    this.units.push(u);
    return u;
  }

  side(u: Unit, sx: number) {
    return sx < 0 ? u.sideL : u.sideR;
  }
  /** On the inner face of a side. */
  inner(u: Unit, sx: number, y: number, z: number): FitOpts {
    return { on: this.side(u, sx), at: [r(u.x0 + sx * (u.W / 2 - u.T)), r(y), r(z)], dir: [sx, 0, 0] };
  }

  /** The small brackets near the back: at the bottom of a wash-stand, top and bottom of a high cabinet, top of a wall cabinet. */
  bracketYs(u: Unit) {
    if (u.kind === "high") return [u.H - 90, 90];
    if (u.kind === "wall") return [u.H - 90];
    if (u.kind === "open") return [];
    return [70];
  }
  brackets(u: Unit) {
    const z = this.bz(u);
    return this.bracketYs(u).flatMap((y) => [-1, 1].map((sx) => ({ sx, y, at: this.inner(u, sx, y, z) })));
  }
  /** Brackets sit in the gap behind the back panel. */
  bz(u: Unit) {
    return u.kind === "high" || u.kind === "wall" ? -u.D / 2 + 6 : -u.D / 2 + 10;
  }
  bracketFits(u: Unit) {
    const out: [HwDef, FitOpts][] = [];
    for (const k of this.brackets(u)) {
      out.push([BRACKET, { ...k.at, hole: false }]);
      for (const dz of [-1, 1]) out.push([SCREW, this.inner(u, k.sx, k.y + 14, this.bz(u) + dz * 5)]);
    }
    return out;
  }
  suspensions(u: Unit) {
    return [-1, 1].map((sx) => ({ sx, at: this.inner(u, sx, u.yr, -u.D / 2 + 16) }));
  }
  suspensionFits(u: Unit) {
    const out: [HwDef, FitOpts][] = [];
    for (const f of this.suspensions(u)) {
      out.push([SUSPENSION, { ...f.at, hole: false }]);
      if (u.kind === "high" || u.kind === "wall") {
        // through the fitting's body into the side
        const o = this.inner(u, f.sx, u.yr - 26, -u.D / 2 + 30);
        out.push([FIT_SCREW, { ...o, at: [o.at[0] - f.sx * 12, o.at[1], o.at[2]] }]);
      }
      else for (const [dy, dz] of [[26, 8], [-26, 8], [0, 34]]) out.push([SCREW, this.inner(u, f.sx, u.yr + dy, -u.D / 2 + 16 + dz)]);
    }
    return out;
  }
  hingeYs(u: Unit) {
    if (u.kind === "doors") return [u.T + 110, u.H - 110];
    if (u.kind === "wall") return [u.T + 100, u.H - u.T - 100];
    return [u.T + 150, u.H / 2 + 60, u.H - u.T - 150];
  }
  hingePlateFits(u: Unit) {
    const sides = u.hinges === "both" ? [-1, 1] : u.hinges === "L" ? [-1] : [];
    const out: [HwDef, FitOpts][] = [];
    for (const sx of sides)
      for (const y of this.hingeYs(u)) {
        for (const dy of [-16, 16]) out.push([SCREW, this.inner(u, sx, y + dy, u.D / 2 - 37)]);
      }
    return out;
  }
  runnerY(d: Drawer) {
    return d.yb + 6;
  }
  dd(u: Unit) {
    return Math.max(250, Math.floor((u.D - 2 * u.T - 40) / 50) * 50);
  }
  runnerFits(u: Unit) {
    const out: [HwDef, FitOpts][] = [];
    const dd = this.dd(u);
    const zc = u.D / 2 - u.T - 2 - dd / 2;
    for (const d of this.drawers.filter((x) => x.u === u))
      for (const sx of [-1, 1]) {
        out.push([{ kind: "runner", len: dd, dia: 20 }, { ...this.inner(u, sx, this.runnerY(d), zc), hole: false }]);
        for (const dz of [-dd / 2 + 40, dd / 2 - 40]) out.push([RUNNER_SCREW, this.inner(u, sx, this.runnerY(d) - 4, zc + dz)]);
      }
    return out;
  }
  wedgeFits(u: Unit, top: boolean) {
    const out: [HwDef, FitOpts][] = [];
    const ends = (key: string, y: number, n: number, dir: Vec3) => {
      const z = this.pos(key)[2];
      for (const sx of [-1, 1])
        for (let i = 0; i < n; i++) out.push([top ? WEDGE_TOP : WEDGE_LOW, { on: key, at: [r(u.x0 + sx * (u.W / 2 - u.T - 18 - i * 30)), y, r(z)], dir, hole: false }]);
    };
    const [back, ...rest] = u.panels;
    if (top) ends(back, u.H, u.kind === "drawers" ? 2 : 1, [0, -1, 0]);
    else for (const k of rest) ends(k, 0, u.kind === "doors" ? 2 : 1, [0, 1, 0]);
    return out;
  }

  fitAll(list: [HwDef, FitOpts][], gap = 0.05) {
    for (const [def, o] of list) {
      this.b.fit(def, o);
      this.b.wait(gap);
    }
  }
  presetAll(list: [HwDef, FitOpts][]) {
    for (const [def, o] of list) this.b.preset(def, o);
  }

  /** Lay both sides flat, inside up, one behind the other, for what is screwed onto them first. */
  flat(u: Unit) {
    this.b.stagger(0.25);
    this.b.stage(u.sideL, [0, u.T / 2, -(u.D / 2 + 40)], [0, 0, Math.PI / 2], [0, 160, 0]);
    this.b.stage(u.sideR, [0, u.T / 2, u.D / 2 + 40], [0, 0, -Math.PI / 2], [0, 160, 0]);
    this.b.then(0.15);
  }

  /** Every fitting on a unit's frame, in the manual's order: what the frame steps fit on the first unit, and what a copy arrives with. */
  frameFits(u: Unit) {
    return [...this.bracketFits(u), ...this.suspensionFits(u), ...this.hingePlateFits(u), ...this.runnerFits(u), ...this.wedgeFits(u, true), ...this.wedgeFits(u, false)];
  }

  /** A wash-stand frame or a HAGAÅN open cabinet: sides flat first, then the panels click in with the frame standing up. */
  buildStand(u: Unit, scene: string) {
    const prep = scene === "main" ? "prep" : `${scene}-prep`;
    const open = u.kind === "open";
    this.step(
      {
        title: open ? "Screw a suspension fitting onto each side" : "Screw the small brackets onto the sides",
        detail: open ? "Left and right are marked. Three small screws each, in the top back corner." : "One near the bottom back corner of each side, two screws each.",
        kind: "screws",
        tools: ["screwdriver"],
        scene: prep,
        warnings: ["floor"],
      },
      () => {
        this.flat(u);
        this.fitAll(open ? this.suspensionFits(u) : this.bracketFits(u));
      },
    );
    if (!open)
      this.step({ title: "Screw a suspension fitting onto each side", detail: "Left and right are marked: each goes in the top back corner, with three screws.", kind: "screws", tools: ["screwdriver"], scene: prep }, () => this.fitAll(this.suspensionFits(u)));
    if (u.kind === "drawers")
      this.step({ title: "Screw the drawer runners onto the sides", detail: "Two on each side, two screws each. The wheel end goes to the front.", kind: "runners", tools: ["screwdriver"], scene: prep }, () => this.fitAll(this.runnerFits(u), 0.03));
    if (u.kind === "doors")
      this.step({ title: "Screw the hinge plates onto the sides", detail: "Two on each side, at the front edge. Two screws each.", kind: "screws", tools: ["screwdriver"], scene: prep }, () => this.fitAll(this.hingePlateFits(u)));

    const [first, ...rest] = u.panels;
    const names = open ? ["the top", "the shelf and the bottom"] : u.kind === "drawers" ? ["the back panel", "the back rail and the front rail"] : ["the back panel", "the front rail"];
    this.step(
      { title: `Click ${names[0]} into one side`, detail: "Stand the side up, inside facing you. Push the panel's pegs into the holes, then press down until it clicks.", kind: "join", pose: "+y" },
      () => {
        this.put(u.sideR, [0, 160, 0]);
        this.b.then(0.1);
        this.put(first, [-260, 0, 0]);
      },
    );
    this.step({ title: `Click ${names[1]} in`, detail: "Each one the same way: pegs into the holes, then press down until it clicks.", kind: "join" }, () => {
      this.b.stagger(0.4);
      for (const k of rest) this.put(k, [-260, 0, 0]);
    });
    this.step({ title: "Press the other side on", detail: "Pegs into its holes along all the panels, then press it down until every one clicks.", kind: "join" }, () => this.put(u.sideL, [-300, 0, 0]));
    if (open) {
      this.step({ title: "Slide the back panel into the grooves", detail: "Lay the cabinet on its front. The back slides in from the top, between the sides.", kind: "general", pose: "-z", warnings: ["floor"] }, () => {
        for (const k of u.backs) this.put(k, [0, 500, 0]);
      });
      this.step({ title: "Fix the back with the plastic rivets", detail: "Push each sleeve through the back into the panel behind it, then press its pin in.", kind: "general" }, () => this.fitAll(this.rivets(u, 4)));
      return;
    }
    this.step({ title: "Push the white wedges into the top joints", detail: `${this.wedgeFits(u, true).length} of them, one in each slot along the top edge. They lock the clicks.`, kind: "join", warnings: ["square"], check: "square" }, () => this.fitAll(this.wedgeFits(u, true), 0.1));
    this.step({ title: "Push the grey wedges into the bottom joints", detail: "From underneath, one in each slot. Make sure the frame is square first.", kind: "join" }, () => this.fitAll(this.wedgeFits(u, false), 0.1));
  }

  rivets(u: Unit, n: number): [HwDef, FitOpts][] {
    const out: [HwDef, FitOpts][] = [];
    const zb = -u.D / 2 + 10.5;
    const keys = u.panels;
    const per = Math.max(1, Math.round(n / keys.length));
    let left = n;
    keys.forEach((k, i) => {
      const y = this.pos(k)[1];
      const m = i === keys.length - 1 ? left : Math.min(left, per);
      for (let j = 0; j < m; j++) {
        const x = m === 1 ? u.x0 : u.x0 - (u.W / 2 - 60) + ((u.W - 120) * j) / (m - 1);
        out.push([RIVET, { on: u.backs[0], at: [r(x), r(y), zb], dir: [0, 0, 1], mate: k }]);
      }
      left -= m;
    });
    return out;
  }

  /** A high or wall cabinet, built lying on its front. */
  buildBox(u: Unit) {
    const high = u.kind === "high";
    this.step(
      { title: "Screw the small brackets onto the sides", detail: high ? "One at each end of each side, near the back edge. Two screws each." : "One near the top back corner of each side, two screws each.", kind: "screws", tools: ["screwdriver"], scene: "prep", warnings: ["floor"] },
      () => {
        this.flat(u);
        this.fitAll(this.bracketFits(u));
      },
    );
    this.step(
      { title: "Screw the hinge plates onto one side", detail: "On the side you want the door to hang from, at the front edge. Two screws each; the door can go on either side.", kind: "screws", tools: ["screwdriver"], scene: "prep" },
      () => this.fitAll(this.hingePlateFits(u)),
    );
    const [top, ...rest] = u.panels;
    const mid = high ? rest[0] : undefined;
    const bottom = rest[rest.length - 1];
    this.step(
      { title: "Click the top and the bottom into one side", detail: "Stand that side on its front edge. Pegs into the holes, then press down until each one clicks.", kind: "join", pose: "-z", warnings: ["floor"] },
      () => {
        this.put(u.sideR, [0, 0, 200]);
        this.b.then(0.1);
        this.b.stagger(0.35);
        this.put(top, [-260, 0, 0]);
        this.put(bottom, [-260, 0, 0]);
      },
    );
    if (mid) this.step({ title: "Click the fixed shelf in", detail: "In the middle, the same way.", kind: "join" }, () => this.put(mid, [-260, 0, 0]));
    this.step({ title: "Press the other side on", detail: "Pegs into its holes, then press it down along its length until every joint clicks.", kind: "join", people: high ? 2 : 1 }, () => this.put(u.sideL, [-300, 0, 0]));
    this.step({ title: "Slide the back panel into the grooves", detail: "From the top end, all the way down. Check the cabinet is square before you fix it.", kind: "general", check: "square", warnings: ["square"] }, () => {
      for (const k of u.backs) this.put(k, [0, 600, 0]);
    });
    this.step({ title: "Fix the back with the plastic rivets", detail: "Push each sleeve through the back into the panel behind it, then press its pin in.", kind: "general" }, () => this.fitAll(this.rivets(u, high ? 6 : 4)));
    if (!high)
      this.step({ title: "Press the clips onto the back", detail: "Six of them along the sides, by hand: no hammer.", kind: "general" }, () =>
        this.fitAll([-1, 1].flatMap((sx) => [0.2, 0.5, 0.8].map((f): [HwDef, FitOpts] => [BACK_CLIP, { on: u.backs[0], at: [r(u.x0 + sx * (u.W / 2 - u.T - 6)), r(u.H * f), -u.D / 2 + 10.5], dir: [0, 0, 1], hole: false }]))),
      );
    if (high)
      this.step({ title: "Fit the two leg plates under the bottom", detail: "On the hinge side's end. They're there if you ever want legs; leave them in either way.", kind: "screws", tools: ["screwdriver"] }, () =>
        this.fitAll([-1, 1].map((sx): [HwDef, FitOpts] => [LEG_PLATE, { on: bottom, at: [r(u.x0 + sx * (u.W / 2 - u.T - 40)), 0, r(u.D / 2 - 60)], dir: [0, 1, 0], hole: false }])),
      );
    this.step({ title: "Fit the suspension fittings in the top corners", detail: "Left and right are marked. One screw each, and don't overtighten it.", kind: "screws", tools: ["screwdriver"], warnings: ["hand"] }, () => this.fitAll(this.suspensionFits(u)));
  }

  /* ---------- on the wall ---------- */

  railSteps(u: Unit, first: boolean) {
    const b = this.b;
    const ends = [-1, 1].map((sx) => r(u.x0 + sx * (u.W / 2 - u.T - 40)));
    const what = u.kind === "high" ? "cabinet" : u.kind === "wall" ? "cabinet" : u.kind === "open" ? "open cabinet" : "wash-stand";
    this.step(
      {
        title: first ? "Screw the suspension rail to the wall" : `Screw the next rail to the wall`,
        detail: first
          ? `Level, with its top ${u.kind === "high" || u.kind === "wall" ? "35" : "130"} mm below where the top of the ${what} will be. A spacer behind each screw. Wall screws and plugs aren't included: pick ones made for your wall.`
          : "Level with the first one, about 150 mm away, so the frames meet side by side.",
        kind: "anchor",
        tools: ["drill", "level", "pencil", "screwdriver"],
        pose: "+y",
        scene: "main",
        wall: true,
        warnings: ["wall"],
      },
      () => {
        b.add(u.rail, [0, 0, -120]);
        b.then(0.1);
        b.fits(HW.plug, ends.map((x) => ({ at: [x, u.yr, u.zr - 10] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.1);
        b.then(0.05);
        b.fits(SPACER, ends.map((x) => ({ on: u.rail, at: [x, u.yr, u.zr - 4] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })), 0.1);
        b.then(0.05);
        b.fits(HW.wallScrew, ends.map((x) => ({ on: u.rail, at: [x, u.yr, u.zr + 4] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.1);
      },
    );
  }

  hangStep(u: Unit, frameKeys: string[] = [], preset?: [HwDef, FitOpts][]) {
    const what = u.kind === "high" || u.kind === "wall" ? "cabinet" : u.kind === "open" ? "open cabinet" : "wash-stand";
    this.step(
      {
        title: `Hang the ${what} on the rail`,
        detail: "Lift it so both fittings hook over the rail. Then turn their screws with the Allen key to set the height and pull it back to the wall.",
        kind: "anchor",
        tools: ["allen"],
        people: u.kind === "high" || u.kind === "wall" || this.L.us ? 2 : 1,
        pose: "+y",
        scene: "main",
        wall: true,
      },
      () => {
        this.b.stagger(0);
        for (const k of frameKeys) this.b.add(k, [0, 120, 160]);
        if (preset) this.presetAll(preset);
      },
    );
  }

  lockSteps(u: Unit) {
    const b = this.b;
    const tops = u.kind === "high" || u.kind === "wall" ? this.brackets(u).filter((k) => k.y > u.H / 2) : this.suspensions(u).map((f) => ({ sx: f.sx, y: u.yr, at: f.at }));
    this.step(
      { title: "Lock it to the rail", detail: "A machine screw and a washer through each fitting into the rail, so the unit can't be lifted off.", kind: "screws", tools: ["screwdriver"], scene: "main" },
      () => {
        const pts = tops.map((k) => this.inner(u, k.sx, k.y, u.zr + 6));
        b.fits(WASHER, pts.map((o) => ({ ...o, dir: [0, 0, -1] as Vec3, hole: false as const })), 0.08);
        b.then(0.05);
        b.fits(MACHINE, pts.map((o) => ({ ...o, dir: [0, 0, -1] as Vec3, mate: u.rail })), 0.1);
        if (u.kind === "high" || u.kind === "wall") {
          b.then(0.05);
          b.fits(COVER, pts.map((o) => ({ ...o, dir: [-Math.sign(o.at[0] - u.x0), 0, 0] as Vec3, hole: false as const })), 0.1);
        }
      },
    );
    const lows = this.brackets(u).filter((k) => k.y < u.H / 2);
    if (!lows.length) return;
    this.step(
      { title: "Screw the bottom to the wall", detail: "A wall screw and a washer through each bottom bracket. Screws and plugs for your wall aren't included.", kind: "anchor", tools: ["drill", "screwdriver"], scene: "main", wall: true, warnings: ["wall"] },
      () => {
        const pts = lows.map((k) => this.inner(u, k.sx, k.y, -u.D / 2 + 4));
        b.fits(HW.plug, pts.map((o) => ({ at: [o.at[0], o.at[1], -u.D / 2 - 10] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.1);
        b.then(0.05);
        b.fits(WASHER, pts.map((o) => ({ ...o, dir: [0, 0, -1] as Vec3, hole: false as const })), 0.08);
        b.fits(HW.wallScrew, pts.map((o) => ({ ...o, dir: [0, 0, -1] as Vec3 })), 0.1);
        if (u.kind === "high") {
          b.then(0.05);
          b.fits(COVER, pts.map((o) => ({ ...o, dir: [-Math.sign(o.at[0] - u.x0), 0, 0] as Vec3, hole: false as const })), 0.1);
        }
      },
    );
  }

  joinStep(a: Unit, c: Unit) {
    const x = a.x0 + a.W / 2;
    this.step(
      { title: "Screw the two units together", detail: "Two screws through the side into its neighbour, 40 mm in from the front edge: one high, one low.", kind: "join", tools: ["drill", "screwdriver"], scene: "main" },
      () => this.b.fits(JOIN, [a.H * 0.8, a.H * 0.25].map((y) => ({ on: a.sideR, at: [r(x - a.T), r(y), r(a.D / 2 - 40)] as Vec3, dir: [1, 0, 0] as Vec3, mate: c.sideL })), 0.15),
    );
  }

  /* ---------- inside ---------- */

  makeDrawers(u: Unit) {
    const { T, W, D, x0 } = u;
    const lo0 = T + GAP, hi0 = u.H - GAP;
    const fh = (hi0 - lo0 - GAP) / 2;
    const bw = W - 2 * T - 26;
    const dd = this.dd(u);
    const zc = D / 2 - T - 2 - dd / 2;
    for (let i = 0; i < 2; i++) {
      const lo = lo0 + i * (fh + GAP), hi = lo + fh;
      const top = i === 1;
      const sh = top ? 120 : Math.min(200, fh - 80);
      const yb = lo + 30;
      const front = this.part("Drawer front", [W - 2 * T - 4, fh, T], [x0, lo + fh / 2, D / 2 - T / 2]);
      const boxFront = this.part("Drawer box front", [bw - 32, sh, 16], [x0, yb + sh / 2, D / 2 - T - 2 - 8]);
      const back = this.part("Drawer back", [bw - 32, sh, 16], [x0, yb + sh / 2, zc - dd / 2 + 8]);
      const sides = [-1, 1].map((sx) => this.part("Drawer side", [16, sh, dd], [x0 + sx * (bw / 2 - 8), yb + sh / 2, zc])) as [string, string];
      const bottom = this.part("Drawer bottom", [bw - 24, 8, dd - 32], [x0, yb + 12, zc], { material: "fiber" });
      const divider = top && W >= 600 ? this.part("Divider", [bw - 40, sh - 40, 10], [x0, yb + 16 + (sh - 40) / 2, zc]) : undefined;
      this.drawers.push({ front, boxFront, back, sides, bottom, divider, lo, hi, yb, sh, u });
    }
  }

  drawerSteps() {
    const b = this.b;
    if (!this.drawers.length) return;
    const list = this.drawers;
    const d0 = list[0];
    const u0 = d0.u;
    const dd = this.dd(u0);
    const zc = u0.D / 2 - u0.T - 2 - dd / 2;
    const n = list.length;
    const rep = n > 1 ? n : undefined;
    const wide = u0.W >= 700;
    const wires = u0.W >= 600 ? 3 : 1;
    const c0: Vec3 = [u0.x0, d0.yb + 100, zc];
    const rel = (k: string): Vec3 => {
      const p = this.pos(k);
      return [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
    };
    const bumpers = (d: Drawer): [HwDef, FitOpts][] => [-1, 1].map((sx) => [BUMPER, { on: d.front, at: [r(d.u.x0 + sx * (d.u.W / 2 - d.u.T - 30)), r(d.lo + 40), r(d.u.D / 2 - d.u.T)], dir: [0, 0, 1], hole: false }]);
    const wireFits = (d: Drawer): [HwDef, FitOpts][] => Array.from({ length: wires }, (_, i): [HwDef, FitOpts] => [WIRE, { on: d.back, at: [r(d.u.x0 + (wires === 1 ? 0 : -bwOf(d) / 3 + (bwOf(d) / 3) * i)), r(d.yb + d.sh), r(this.pos(d.back)[2])], dir: [0, -1, 0], hole: false }]);
    const bwOf = (d: Drawer) => d.u.W - 2 * d.u.T - 26;
    const lockFits = (d: Drawer): [HwDef, FitOpts][] => {
      const out: [HwDef, FitOpts][] = [];
      const bw = bwOf(d);
      for (const k of [d.boxFront, d.back]) {
        const z = this.pos(k)[2];
        for (const sx of [-1, 1]) out.push([DOWEL, { on: d.sides[sx < 0 ? 0 : 1], at: [r(d.u.x0 + sx * (bw / 2)), r(d.yb + d.sh / 2), r(z)], dir: [-sx, 0, 0], mate: k }]);
      }
      for (const k of [d.boxFront, d.back]) {
        const z = this.pos(k)[2];
        for (const sx of [-1, 1]) out.push([CAM, { on: k, at: [r(d.u.x0 + sx * (bw / 2 - 40)), r(d.yb + d.sh), r(z)], dir: [0, -1, 0] }]);
      }
      return out;
    };
    const supportFits = (d: Drawer): [HwDef, FitOpts][] => {
      if (!wide) return [];
      const z = this.pos(d.bottom)[2];
      // up the inside of the back: hooked over its top edge with one screw down into it, its foot screwed to the bottom
      const zb = this.pos(d.back)[2] + 8;
      const top = d.yb + d.sh, floor = d.yb + 16;
      return [
        [{ ...SUPPORT, len: Math.round(d.sh - 16) }, { on: d.back, at: [d.u.x0, r((top + floor) / 2), r(zb)], dir: [0, 0, 1], hole: false }],
        [SCREW, { on: d.back, at: [d.u.x0, r(top), r(zb - 8)], dir: [0, -1, 0] }],
        ...[-1, 1].map((sx): [HwDef, FitOpts] => [SCREW, { on: d.bottom, at: [d.u.x0 + sx * 18, r(floor + 4), r(zb + 12)], dir: [0, -1, 0] }]),
      ];
    };

    this.step(
      { title: "Stick two bumpers on the back of each front", detail: "Lay the fronts face down on the rug. One bumper near each bottom corner.", kind: "general", scene: "fronts", repeat: n > 2 ? n / 2 : undefined, warnings: ["floor", "face"] },
      () => {
        b.stagger(0.2);
        let off = 0;
        list.slice(0, 2).forEach((d) => {
          b.stage(d.front, [0, d.u.T / 2, off], [Math.PI / 2, 0, 0], [0, 160, 0]);
          off += d.hi - d.lo + 60;
        });
        b.then(0.1);
        this.fitAll(list.slice(0, 2).flatMap(bumpers), 0.1);
      },
    );
    this.step({ title: "Hook the wire clips into the drawer back", detail: wires > 1 ? `${wires} along its top edge.` : "One in the middle of its top edge.", kind: "drawer", scene: "drawer", repeat: rep, warnings: ["floor"] }, () => {
      b.stage(d0.back, rel(d0.back), [0, 0, 0], [0, 200, 0]);
      b.then(0.1);
      this.fitAll(wireFits(d0), 0.1);
    });
    this.step({ title: "Click the sides onto the back", detail: "Push each side onto the pegs at the ends, then press until it clicks.", kind: "drawer", scene: "drawer", repeat: rep }, () => {
      b.stagger(0.3);
      for (const k of d0.sides) b.stage(k, rel(k), [0, 0, 0], [Math.sign(this.pos(k)[0] - u0.x0) * 200, 0, 0]);
    });
    this.step({ title: "Slide the bottom into the grooves", detail: "Down the grooves in both sides until it sits in the groove of the back.", kind: "drawer", scene: "drawer", repeat: rep }, () => b.stage(d0.bottom, rel(d0.bottom), [0, 0, 0], [0, 0, 380]));
    this.step({ title: "Press the box front on", detail: "Its slots go over the ends of the sides. Press it down evenly.", kind: "drawer", scene: "drawer", repeat: rep }, () => b.stage(d0.boxFront, rel(d0.boxFront), [0, 0, 0], [0, 0, 260]));
    this.step({ title: "Lock the corners", detail: "A plastic dowel through each side into the front and back, then turn the cap over each one until it locks.", kind: "drawer", tools: ["screwdriver"], scene: "drawer", repeat: rep }, () => this.fitAll(lockFits(d0), 0.08));
    if (wide)
      this.step({ title: "Screw the support inside the back", detail: "Hook it over the middle of the back's top edge: one screw down into the edge and two through its foot into the bottom.", kind: "drawer", tools: ["screwdriver"], scene: "drawer", repeat: rep }, () => this.fitAll(supportFits(d0), 0.1));
    const div = list.filter((d) => d.divider);
    if (div.length) {
      const dv = div[0];
      const c1: Vec3 = [dv.u.x0, dv.yb + 100, zc];
      const rel1 = (k: string): Vec3 => {
        const p = this.pos(k);
        return [p[0] - c1[0], p[1] - c1[1], p[2] - c1[2]];
      };
      this.step(
        { title: "Fit the divider in the top drawer", detail: "It goes across the middle, held by two wire clips. It leaves room behind for the water trap.", kind: "drawer", scene: "drawer-top", repeat: div.length > 1 ? div.length : undefined },
        () => {
          b.stagger(0);
          for (const k of [dv.back, ...dv.sides, dv.bottom, dv.boxFront]) b.stage(k, rel1(k), [0, 0, 0]);
          for (const [def, o] of [...wireFits(dv), ...lockFits(dv), ...supportFits(dv)]) b.preset(def, o);
          b.then(0.2);
          b.stage(dv.divider!, rel1(dv.divider!), [0, 0, 0], [0, 260, 0]);
          b.then(0.1);
          this.fitAll([-1, 1].map((sx): [HwDef, FitOpts] => [WIRE, { on: dv.divider!, at: [r(dv.u.x0 + sx * ((bwOf(dv) - 40) / 2 - 10)), r(dv.yb + 16), r(this.pos(dv.divider!)[2])], dir: [0, -1, 0], hole: false }]), 0.1);
        },
      );
    }
    this.step({ title: "Pull the runners out", detail: "All the way, on both sides of each drawer.", kind: "runners", scene: "main", pose: "+y" }, () => {});
    this.step(
      { title: n > 1 ? `Put the ${n} drawers on the runners` : "Put the drawer on the runners", detail: "Rest each box on its runners and push it back until the catches click under it.", kind: "drawer", scene: "main" },
      () => {
        for (const d of list) {
          b.stagger(0);
          for (const k of [d.back, ...d.sides, d.bottom, d.boxFront, ...(d.divider ? [d.divider] : [])]) b.add(k, [0, 0, 480]);
          if (d !== d0 && d !== div[0]) for (const [def, o] of [...wireFits(d), ...lockFits(d), ...supportFits(d)]) b.preset(def, o);
          if (d.divider && d !== div[0]) for (const sx of [-1, 1]) b.preset(WIRE, { on: d.divider, at: [r(d.u.x0 + sx * ((bwOf(d) - 40) / 2 - 10)), r(d.yb + 16), r(this.pos(d.divider)[2])], dir: [0, -1, 0], hole: false });
          b.wait(0.25);
        }
      },
    );
    this.step({ title: n > 1 ? "Hook the fronts on" : "Hook the front on", detail: "Hook the top of each front over the box, swing it down and push until both catches click. The wheels under the catches move it up, down and sideways.", kind: "drawer", tools: ["screwdriver"] }, () => {
      for (const d of list) {
        b.stagger(0);
        b.add(d.front, [0, 120, 260]);
        if (list.indexOf(d) >= 2) this.presetAll(bumpers(d));
        b.wait(0.3);
      }
    });
  }

  /** A wash-stand's shelf behind the doors: a board with an upstand at its back, joined by a plate, on four supports. */
  doorShelf(u: Unit) {
    const { T, W, D, x0 } = u;
    const iw = W - 2 * T - 2;
    const y = Math.round(u.H * 0.42);
    const sd = Math.round(D * 0.5);
    const zf = D / 2 - T - 4; // its front edge, just behind the doors
    const shelf = this.part("Shelf", [iw, T, sd], [x0, y + T / 2, zf - sd / 2]);
    const up = this.part("Shelf upstand", [iw, 110, T], [x0, y + T + 55, zf - sd + T / 2]);
    u.shelves.push(shelf, up);
    return { shelf, up, y, sd };
  }

  doorSteps(u: Unit) {
    const { T, W, D, x0 } = u;
    const lo = T + GAP, hi = u.H - GAP;
    const w = (W - 2 * T - 2 * GAP - GAP) / 2;
    for (const sx of [-1, 1] as const) {
      const x = x0 + sx * (w / 2 + GAP / 2);
      const key = this.part("Door", [w, hi - lo, T], [x, (lo + hi) / 2, D / 2 - T / 2]);
      this.doorList.push({ key, u, sx, x, w, lo, hi, ys: this.hingeYs(u) });
    }
    this.hangDoors(u, this.doorList.filter((d) => d.u === u));
  }

  hangDoors(u: Unit, list: Door[]) {
    const b = this.b;
    const many = list.length > 1;
    const hingeAt = (d: Door, y: number): FitOpts => ({ on: d.key, at: [r(d.x + d.sx * (d.w / 2 - 22)), r(y), r(u.D / 2 - u.T)], dir: [0, 0, 1], twist: d.sx > 0 ? Math.PI : 0 });
    const stand = u.kind === "doors";
    if (stand)
    this.step(
      { title: "Stick a bumper on each door", detail: "Lay the door face down on the rug. The bumper goes near the corner away from the hinges.", kind: "general", scene: "doors", warnings: ["floor", "face"] },
      () => {
        b.stagger(0.2);
        let off = 0;
        for (const d of list) {
          b.stage(d.key, [off + d.w / 2, u.T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
          off += d.w + 80;
        }
        b.then(0.1);
        const pads: FitOpts[] = [];
        for (const d of list) for (const y of many ? [d.lo + 50] : [d.lo + 50, d.hi - 50]) pads.push({ on: d.key, at: [r(d.x - d.sx * (d.w / 2 - 20)), r(y), r(u.D / 2 - u.T)], dir: [0, 0, 1], hole: false });
        b.fits(BUMPER, pads, 0.1);
      },
    );
    this.step(
      { title: many ? "Press the hinges into the doors" : "Press the hinges into the door", detail: stand ? "Each hinge cup into its round hole, then flip its lever to lock it." : "Lay the door face down on the rug. Each hinge cup into its round hole, then flip its lever to lock it.", kind: "hinges", scene: "doors", warnings: stand ? [] : ["floor", "face"] },
      () => {
        if (!stand) {
          b.stagger(0.2);
          for (const d of list) b.stage(d.key, [0, u.T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
          b.then(0.1);
        }
        b.fits(HINGE, list.flatMap((d) => d.ys.map((y) => hingeAt(d, y))), 0.12);
      },
    );
    this.step(
      { title: many ? "Click the doors onto the hinge plates" : "Click the door onto the hinge plates", detail: "Hook each hinge onto its plate and press until it clicks.", kind: "doors", scene: "main", pose: "+y", people: u.kind === "high" ? 2 : 1 },
      () => {
        b.stagger(0.35);
        for (const d of list) b.add(d.key, [0, 0, 380]);
      },
    );
    this.step({ title: many ? "Line up the doors" : "Line up the door", detail: "Turn the hinge screws until the gaps are even: one sets the height, one the side, one the depth.", kind: "doors", tools: ["screwdriver"] }, () => {});
  }

  boxShelves(u: Unit) {
    const b = this.b;
    const { T, W, D, x0 } = u;
    const iw = W - 2 * T - 2;
    const high = u.kind === "high";
    const lists: { ys: number[]; def: HwDef; title: string; detail: string }[] = [];
    if (high) {
      const midY = u.H / 2;
      const low = [1, 2].map((i) => Math.round(T + ((midY - T) * i) / 3));
      const up = [1, 2, 3].map((i) => Math.round(midY + T + ((u.H - T - midY - T) * i) / 4));
      lists.push({ ys: low, def: SHELF_SUPPORT, title: "Fit the two lower shelves", detail: "Four locking supports for each, screwed into the holes you like. The shelf drops into their slots." });
      lists.push({ ys: up, def: SHELF_PIN, title: "Fit the three upper shelves", detail: "Four clip-in supports for each, at the same height, then lay the shelf on until it clicks." });
    } else {
      const ys = [1, 2, 3, 4].map((i) => Math.round(T + ((u.H - 2 * T) * i) / 5));
      lists.push({ ys, def: SHELF_PIN, title: "Fit the four shelves", detail: "Four supports for each shelf, at the same height, then lay the shelf on until it clicks." });
    }
    for (const L of lists) {
      const keys = L.ys.map((y) => this.part("Shelf", [iw, 12, D - 40], [x0, y + 6, 0], { material: high ? "board" : "board" }));
      this.step({ title: L.title, detail: L.detail, kind: "shelves" }, () => {
        const pins: FitOpts[] = [];
        for (const y of L.ys) for (const sx of [-1, 1]) for (const z of [-(D / 2 - 40), D / 2 - 50]) pins.push(this.inner(u, sx, y - 3, z));
        b.fits(L.def, pins, 0.05);
        b.then(0.1);
        b.stagger(0.3);
        for (const k of keys) b.add(k, [0, 0, 360]);
      });
    }
    const stops = high ? 3 : 2;
    this.step({ title: high ? "Push in the three door stops" : "Push in the two door stops", detail: "Into the holes along the front edge of the side the door closes against.", kind: "doors" }, () => {
      const xs = u.x0 + (u.W / 2 - u.T / 2);
      b.fits(STOP, this.hingeYs(u).slice(0, stops).map((y) => ({ on: u.sideR, at: [r(xs), r(y), r(u.D / 2)] as Vec3, dir: [0, 0, -1] as Vec3, hole: false as const })), 0.12);
    });
  }

  /* ---------- on top ---------- */

  topSteps() {
    const top = this.L.top;
    if (!top) return;
    const b = this.b;
    const first = this.units[0], last = this.units[this.units.length - 1];
    const H = first.H;
    const zBack = -first.D / 2;
    const zc = zBack + top.D / 2;
    if (top.kind === "counter") {
      const ends = this.units.length > 1 ? [first, last] : [first];
      const bwOf = (u: Unit) => u.W - 2 * u.T - 20;
      const battens = ends.map((u) => this.part("Wall batten", [bwOf(u), 30, 12], [u.x0, H - 15, zBack + 6], { material: "wood" }));
      const nb = battens.length;
      const counter = this.part("Countertop", [top.W, top.h, top.D], [0, H + top.h / 2, zc]);
      let bowl: string | undefined;
      if (top.bowl === "vessel") {
        const dia = 400;
        bowl = this.compound("Countertop basin", [
          { shape: "cyl", size: [dia * 0.6, 20, dia * 0.6], pos: [0, 10, 0] },
          { shape: "cyl", size: [dia, 100, dia], pos: [0, 70, 0] },
        ], (m) => [0, H + top.h + m[1], zc + 20]);
      } else {
        const bwid = 600 > top.W / 2 ? 500 : 600, bd = 400, bh = 70;
        const wt = 20;
        const bx = top.bowlX ?? 0;
        bowl = this.compound("Wash-basin", [
          { shape: "box", size: [bwid, 12, bd], pos: [0, 6, 0] },
          { shape: "box", size: [bwid, bh - 12, wt], pos: [0, 12 + (bh - 12) / 2, bd / 2 - wt / 2] },
          { shape: "box", size: [bwid, bh - 12, 70], pos: [0, 12 + (bh - 12) / 2, -bd / 2 + 35] },
          { shape: "box", size: [wt, bh - 12, bd - wt - 70], pos: [-bwid / 2 + wt / 2, 12 + (bh - 12) / 2, (70 - wt) / 2] },
          { shape: "box", size: [wt, bh - 12, bd - wt - 70], pos: [bwid / 2 - wt / 2, 12 + (bh - 12) / 2, (70 - wt) / 2] },
        ], (m) => [bx + m[0], H + top.h + m[1], zc + 10 + m[2]]);
      }
      this.step(
        { title: nb > 1 ? "Screw the wall battens to the wall" : "Screw the wall batten to the wall", detail: "Level, just under where the countertop's back edge will sit. Wall screws and plugs aren't included.", kind: "anchor", tools: ["drill", "level", "screwdriver"], wall: true, warnings: ["wall"], scene: "main", pose: "+y" },
        () => {
          for (const k of battens) {
            b.add(k, [0, 0, 160]);
            b.then(0.1);
            const p = this.pos(k);
            const half = bwOf(ends[battens.indexOf(k)]) / 2;
            const xs = [-1, 1].map((sx) => r(p[0] + sx * (half - 60)));
            b.fits(HW.plug, xs.map((x) => ({ at: [x, p[1], zBack - 10] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.1);
            b.fits(HW.wallScrew, xs.map((x) => ({ on: k, at: [x, p[1], zBack + 12] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.1);
          }
        },
      );
      this.step(
        { title: "Lay the countertop on a bead of silicone", detail: "Silicone along the top edges of the frame, then lower the countertop on, flush at the back. Weigh it down while it sets. Silicone isn't included.", kind: "general", people: top.W > 1000 ? 2 : 1, warnings: top.W > 1000 ? ["two"] : [] },
        () => b.add(counter, [0, 260, 0]),
      );
      this.step({ title: "Seal along the wall", detail: "A thin line of silicone where the countertop meets the wall, smoothed with a wet finger.", kind: "general" }, () => {});
      if (top.bowl === "vessel") {
        this.step({ title: "Set the basin on the countertop", detail: "Drill the hole for the waste where its own instructions show, then bed the basin on silicone over it.", kind: "general", tools: ["drill"] }, () => b.add(bowl!, [0, 260, 0]));
      } else {
        this.step({ title: "Cut the hole for the basin", detail: "Mark it with the template from the basin's box and cut it with a jigsaw. Seal the cut edges with silicone.", kind: "general", tools: ["pencil", "drill"] }, () => {});
        this.step({ title: "Set the basin into the hole", detail: "Silicone around the rim underneath, then lower it in and press it down evenly. Leave it to set for three hours.", kind: "general" }, () => b.add(bowl!, [0, 260, 0]));
      }
    } else {
      const BW = top.W, BD = top.D;
      const wt = 26, floor = 14, deck = 90;
      const ht = top.h - floor, yw = floor + ht / 2;
      const pieces: PartPiece[] = [
        { shape: "box", size: [BW, floor, BD], pos: [0, floor / 2, 0] },
        { shape: "box", size: [BW, ht, wt], pos: [0, yw, BD / 2 - wt / 2] },
        { shape: "box", size: [BW, ht, deck], pos: [0, yw, -BD / 2 + deck / 2] },
        { shape: "box", size: [wt, ht, BD - wt - deck], pos: [-BW / 2 + wt / 2, yw, (deck - wt) / 2] },
        { shape: "box", size: [wt, ht, BD - wt - deck], pos: [BW / 2 - wt / 2, yw, (deck - wt) / 2] },
      ];
      if (top.kind === "double") pieces.push({ shape: "box", size: [wt * 2, ht, BD - wt - deck], pos: [0, yw, (deck - wt) / 2] });
      const basin = this.compound(top.kind === "double" ? "Double wash-basin" : "Wash-basin", pieces, (m) => [m[0], H + m[1], zc + m[2]]);
      this.step(
        { title: "Set the basin on a bead of silicone", detail: "Silicone along the top edges of the frame, then lower the basin on, flush at the back. Silicone isn't included.", kind: "general", people: top.W > 1000 ? 2 : 1, warnings: top.W > 1000 ? ["two"] : [] },
        () => b.add(basin, [0, 260, 0]),
      );
      this.step({ title: "Let it set, then seal the joints", detail: "Wait three hours before you use it. Then a thin line of silicone along the wall and around the basin's edge.", kind: "general" }, () => {});
    }
    this.step(
      { title: this.L.tap ? "Fit the tap and the water trap" : "Fit the waste and the water trap", detail: "They follow their own instructions. Have a plumber connect the water if you're not sure.", kind: "general", tools: ["wrench"] },
      () => {},
    );
  }

  /* ---------- the whole guide ---------- */

  build() {
    const L = this.L;
    const total = L.units.reduce((a, u) => a + u.W, 0);
    let x = -total / 2;
    const us: Unit[] = [];
    for (const d of L.units) {
      const u = this.unit(d.kind, x + d.W / 2, d.W, d.H, d.D);
      x += d.W;
      us.push(u);
      if (d.kind === "drawers") this.makeDrawers(u);
    }
    const k0 = us[0].kind;
    if (k0 === "high" || k0 === "wall") {
      const u = us[0];
      this.buildBox(u);
      this.railSteps(u, true);
      this.hangStep(u);
      this.lockSteps(u);
      const d: Door = { key: this.part("Door", [u.W - 2 * u.T - 2 * GAP, u.H - 2 * u.T - 2 * GAP, u.T], [u.x0, u.H / 2, u.D / 2 - u.T / 2]), u, sx: -1, x: u.x0, w: u.W - 2 * u.T - 2 * GAP, lo: u.T + GAP, hi: u.H - u.T - GAP, ys: this.hingeYs(u) };
      this.doorList.push(d);
      this.hangDoors(u, [d]);
      this.boxShelves(u);
      return;
    }

    // wash-stands first, then anything beside them, each built once and the copies hung ready made
    const stands = us.filter((u) => u.kind !== "open");
    const opens = us.filter((u) => u.kind === "open");
    const frameKeys = (u: Unit) => [u.sideL, u.sideR, ...u.panels, ...u.backs];
    const s0 = stands[0];
    const rep = stands.length > 1 ? stands.length : undefined;
    this.repeatNext = rep;
    this.buildStand(s0, "main");
    this.repeatNext = undefined;
    this.railSteps(s0, true);
    this.hangStep(s0);
    this.lockSteps(s0);
    for (const u of stands.slice(1)) {
      this.railSteps(u, false);
      this.hangStep(u, frameKeys(u), this.frameFits(u));
      this.lockSteps(u);
      const left = us[us.indexOf(u) - 1];
      if (left) this.joinStep(left, u);
    }
    opens.forEach((u, i) => {
      if (i === 0) {
        this.alt = "open";
        this.origin = [u.x0, 0, 0];
        this.repeatNext = opens.length > 1 ? opens.length : undefined;
        this.buildStand(u, "open");
        this.repeatNext = undefined;
        this.alt = undefined;
      }
      this.railSteps(u, false);
      if (i === 0) this.hangStep(u, frameKeys(u));
      else this.hangStep(u, frameKeys(u), [...this.suspensionFits(u), ...this.rivets(u, 4)]);
      this.lockSteps(u);
      const ix = us.indexOf(u);
      const left = us[ix - 1], right = us[ix + 1];
      if (left && left.kind !== "open" && ix > 0) this.joinStep(left, u);
      else if (right) this.joinStep(u, right);
    });
    for (const u of stands) if (u.kind === "doors") this.standDoorInside(u);
    this.drawerSteps();
    this.topSteps();
  }

  repeatNext?: number;

  standDoorInside(u: Unit) {
    const b = this.b;
    const { T, W, D, x0 } = u;
    const iw = W - 2 * T;
    const stretcher = this.part("Top stretcher", [iw, T, 100], [x0, u.H - T / 2, -D / 2 + 20 + T + 50]);
    u.panels.push(stretcher);
    const back = u.panels[0];
    const plateAt: Vec3 = [x0, u.H, r(-D / 2 + 20 + T)];
    this.step({ title: "Screw the joining plate onto the stretcher", detail: "In the middle of one long edge, two screws.", kind: "screws", tools: ["screwdriver"], scene: "stretcher", warnings: ["floor"] }, () => {
      b.stage(stretcher, [0, T / 2, 0], [0, 0, 0], [0, 160, 0]);
      b.then(0.1);
      b.fit(JOIN_PLATE, { on: stretcher, at: plateAt, dir: [0, -1, 0], hole: false });
      b.then(0.05);
      b.fits(PLATE_SCREW, [-12, 12].map((dx) => ({ on: stretcher, at: [x0 + dx, u.H, r(-D / 2 + 20 + T + 15)] as Vec3, dir: [0, -1, 0] as Vec3 })), 0.1);
    });
    this.step({ title: "Lay the stretcher across the top and screw it to the back panel", detail: "It sits between the sides, against the back panel. Two screws through the plate into the panel's top edge.", kind: "screws", tools: ["screwdriver"], scene: "main" }, () => {
      b.add(stretcher, [0, 200, 0]);
      b.then(0.1);
      b.fits(PLATE_SCREW, [-12, 12].map((dx) => ({ on: back, at: [x0 + dx, u.H, r(-D / 2 + 20 + T / 2)] as Vec3, dir: [0, -1, 0] as Vec3 })), 0.1);
    });
    this.step({ title: "Push the door stop into the front rail", detail: "In the middle of the rail's top, where the two doors meet.", kind: "doors" }, () => {
      const rail = u.panels.find((k) => this.pos(k)[1] < T)!;
      b.fit(STOP, { on: rail, at: [x0, T, r(D / 2 - 15)], dir: [0, -1, 0], hole: false });
    });
    const { shelf, up, y, sd } = this.doorShelf(u);
    const zj = r(D / 2 - T - 4 - sd + T);
    this.step({ title: "Join the shelf to its upstand", detail: "Screw the plate under the shelf's back edge, then two screws through it into the upstand.", kind: "screws", tools: ["screwdriver"], scene: "shelf", warnings: ["floor"] }, () => {
      const c: Vec3 = [x0, y, 0];
      b.stage(shelf, [0, T / 2, this.pos(shelf)[2] - c[2]], [0, 0, 0], [0, 160, 0]);
      b.stage(up, [0, T + 55, this.pos(up)[2] - c[2]], [0, 0, 0], [0, 0, -200]);
      b.then(0.1);
      b.fit(JOIN_PLATE, { on: shelf, at: [x0, y, zj], dir: [0, 1, 0], hole: false });
      b.then(0.05);
      b.fits(PLATE_SCREW, [-12, 12].map((dx) => ({ on: shelf, at: [x0 + dx, y, r(zj + 10)] as Vec3, dir: [0, 1, 0] as Vec3 })), 0.1);
      b.fits(PLATE_SCREW, [-12, 12].map((dx) => ({ on: up, at: [x0 + dx, y + 10, r(zj - T / 2)] as Vec3, dir: [0, 0, 1] as Vec3 })), 0.1);
    });
    this.step({ title: "Fit the shelf supports and lay the shelf on", detail: "Four supports at the same height, screwed in by hand. The shelf drops into their slots with the upstand at the back.", kind: "shelves", scene: "main" }, () => {
      const pins: FitOpts[] = [];
      for (const sx of [-1, 1]) for (const z of [D / 2 - T - 30, D / 2 - T - sd + 20]) pins.push(this.inner(u, sx, y - 3, z));
      b.fits(SHELF_SUPPORT, pins, 0.06);
      b.then(0.1);
      b.stagger(0);
      b.add(shelf, [0, 0, 360]);
      b.add(up, [0, 0, 360]);
    });
    this.doorSteps(u);
  }
}

const family: Family = {
  names: ["HAVBÄCK", "HAVBACK"],
  build(b, s) {
    if (s.archetype !== "cabinet") return false;
    const L = layoutOf(s);
    if (!L) return false;
    new Havback(b, s, L).build();
    return true;
  },
};
export default family;
