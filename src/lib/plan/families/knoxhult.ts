import type { Family } from "./family";
import type { Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";

/**
 * KNOXHULT kitchen cabinets, read from their manuals. Every frame is cam bolts into the sides, cam locks in the top
 * and bottom, two wooden dowels at each joint, and a hardboard back nailed on with thirty nails (three corners first).
 * A suspension fitting is screwed into each top back corner before the frame is joined; the cabinet hangs on two
 * screws in the wall (not included) through a keyhole plate, is adjusted, locked, and the fitting gets a cover.
 * Wall cabinets are built lying on their front. The 120 wide one has a divider held by four long screws through the
 * top and bottom, its hinge plates go on before the frame is joined, and a third fitting hangs it by the divider.
 * The high cabinet is built on its side with a plinth on dowels and an angle bracket, stands on four feet in the
 * sides, and the 228 cm one is that high cabinet with the 75 cm wall cabinet screwed on top.
 * The corner base cabinet is its own builder (cornerBase below), with its worktop and cover panel.
 */

type Kind = "wall" | "high";

const T = 16; // carcass boards and shelves
const FT = 16; // fronts
const GAP = 2; // between carcass and door
const PLINTH = 70;
const FOOT_H = 10;

const BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const CAM: HwDef = { kind: "cam", len: 13, dia: 15 };
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const NAIL: HwDef = { kind: "nail", len: 20, dia: 1.6 };
const SUSP: HwDef = { kind: "angle", len: 60, dia: 50, name: "Suspension fitting" };
const SUSP_SCREW: HwDef = { kind: "screw", len: 15, dia: 4 };
const HINGE_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const HINGE: HwDef = { kind: "hinge", len: 50, dia: 35 };
const PLATE: HwDef = { kind: "plate", len: 40, dia: 20, name: "Hinge plate" };
const KEYHOLE: HwDef = { kind: "hook", len: 50, dia: 30, name: "Wall plate" };
const COVER: HwDef = { kind: "cap", len: 40, dia: 50, name: "Cover" };
const PIN: HwDef = { kind: "pin", len: 16, dia: 5 };
const BUMPER: HwDef = { kind: "glide", len: 2, dia: 10, name: "Door bumper" };
const LONG_SCREW: HwDef = { kind: "screw", len: 50, dia: 7 }; // through the top and bottom into the divider
const SOCKET: HwDef = { kind: "connector", len: 12, dia: 12, name: "Foot socket" };
const FOOT: HwDef = { kind: "foot", len: 20, dia: 24 };
const BRACKET: HwDef = { kind: "angle", len: 30, dia: 24, name: "Angle bracket" };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const JOIN_SCREW: HwDef = { kind: "screw", len: 40, dia: 4 }; // the high cabinet's top into the wall cabinet on it

const r = (n: number) => Math.round(n * 10) / 10;

interface Unit {
  kind: Kind;
  W: number;
  H: number; // sides, mm
  Dc: number;
  zc: number; // centre of the carcass
  y0: number; // underside of the sides
  yb: number; // underside of the bottom panel
  sideL: string;
  sideR: string;
  top: string;
  bottom: string;
  divider?: string;
  plinth?: string;
  back: string;
  susp: { on: string; sx: number; at: Vec3 }[];
}

interface DoorDef {
  key: string;
  side: string;
  sx: number;
  lo: number;
  hi: number;
  n: number;
  u: Unit;
}

class Knox {
  b: PlanBuilder;
  s: ProductSpec;
  W: number;
  D: number;
  Dc: number;
  zc: number;
  types = new Map<string, string>();
  poses = new Map<string, Pose>();
  alt?: string;
  origin: Vec3 = [0, 0, 0];

  constructor(b: PlanBuilder, s: ProductSpec) {
    this.b = b;
    this.s = s;
    this.W = s.size.w * 10;
    this.D = s.size.d * 10;
    this.Dc = this.D - FT - GAP;
    this.zc = -this.D / 2 + this.Dc / 2;
  }

  part(name: string, size: Vec3, pos: Vec3, material: "board" | "fiber" = "board") {
    const k = `${name}|${size.map(Math.round).join("x")}|${material}`;
    let ref = this.types.get(k);
    if (!ref) {
      ref = this.b.part(name, size, { material });
      this.types.set(k, ref);
    }
    return this.b.place(ref, pos);
  }

  pos(key: string) {
    return this.b.partItem(key).final.pos;
  }

  put(key: string, from: Vec3) {
    if (!this.alt) return this.b.add(key, from);
    const p = this.pos(key);
    this.b.stage(key, [p[0] - this.origin[0], p[1] - this.origin[1], p[2] - this.origin[2]], [0, 0, 0], from);
  }

  step(def: { title: string; detail?: string; kind: StepKind; tools?: ToolId[]; people?: 1 | 2; pose?: Pose; warnings?: WarnId[]; scene?: string; check?: "square"; wall?: boolean }, body: () => void) {
    const warnings = [...(def.warnings ?? [])];
    if (def.people === 2 && !warnings.includes("two")) warnings.unshift("two");
    const scene = def.scene ?? (this.alt && def.kind !== "anchor" ? this.alt : "main");
    const pose = def.pose ?? this.poses.get(scene) ?? "+y";
    this.poses.set(scene, pose);
    this.b.step({ ...def, scene, pose, warnings: warnings.slice(0, 3) }, body);
  }

  /** A step on the rug next to the cabinet: panels laid flat, inside up, while their fittings go in. */
  prep(def: { title: string; detail?: string; kind: StepKind; tools?: ToolId[] }, lay: [string, Vec3, Vec3][], body: () => void) {
    this.step({ ...def, scene: "prep", warnings: ["floor"] }, () => {
      this.b.stagger(0.22);
      for (const [k, at, rot] of lay) this.b.stage(k, at, rot, [0, 160, 0]);
      this.b.then(0.15);
      body();
    });
  }

  /* ---------- the frame ---------- */

  unit(kind: Kind, H: number, y0: number, divider: boolean): Unit {
    const { W, Dc, zc } = this;
    const yb = kind === "high" ? y0 + PLINTH : y0;
    const sideL = this.part("Side panel", [T, H, Dc], [-(W / 2 - T / 2), y0 + H / 2, zc]);
    const sideR = this.part("Side panel", [T, H, Dc], [W / 2 - T / 2, y0 + H / 2, zc]);
    const top = this.part(kind === "wall" ? "Top and bottom" : "Top panel", [W - 2 * T, T, Dc], [0, y0 + H - T / 2, zc]);
    const bottom = this.part(kind === "wall" ? "Top and bottom" : "Bottom panel", [W - 2 * T, T, Dc], [0, yb + T / 2, zc]);
    const div = divider ? this.part("Divider", [T, H - 2 * T, Dc], [0, y0 + H / 2, zc]) : undefined;
    const plinth = kind === "high" ? this.part("Plinth", [W - 2 * T, PLINTH, T], [0, y0 + PLINTH / 2, zc + Dc / 2 - 20 - T / 2]) : undefined;
    const back = this.part("Back panel", [W, H, 3], [0, y0 + H / 2, zc - Dc / 2 - 1.5], "fiber");
    const ys = y0 + H - T - 45;
    const zb = zc - Dc / 2 + 30;
    const susp = [
      { on: sideL, sx: -1, at: [-(W / 2 - T), ys, zb] as Vec3 },
      { on: sideR, sx: 1, at: [W / 2 - T, ys, zb] as Vec3 },
      ...(div ? [{ on: div, sx: 1, at: [T / 2, ys, zb] as Vec3 }] : []),
    ];
    return { kind, W, H, Dc, zc, y0, yb, sideL, sideR, top, bottom, divider: div, plinth, back, susp };
  }

  joint(u: Unit, sx: -1 | 1, atTop: boolean) {
    const y = atTop ? u.y0 + u.H - T / 2 : u.yb + T / 2;
    const x = sx * (u.W / 2 - T);
    const side = sx < 0 ? u.sideL : u.sideR;
    const panel = atTop ? u.top : u.bottom;
    const bz = [-1, 1].map((k) => r(u.zc + k * (u.Dc / 2 - 35)));
    const dz = [-1, 1].map((k) => r(u.zc + k * (u.Dc / 2 - 95)));
    return {
      bolts: bz.map((z): FitOpts => ({ on: side, at: [x, y, z], dir: [sx, 0, 0], mate: panel })),
      cams: bz.map((z): FitOpts => ({ on: panel, at: [x - sx * 34, atTop ? y - T / 2 : y + T / 2, z], dir: [0, atTop ? 1 : -1, 0] })),
      dowels: dz.map((z): FitOpts => ({ on: panel, at: [x, y, z], dir: [-sx, 0, 0], mate: side })),
    };
  }

  hingeYs(lo: number, hi: number, n: number) {
    const a = lo + 100, z = hi - 100;
    return n === 3 ? [a, (a + z) / 2, z] : [a, z];
  }

  frame(u: Unit, o: { platesFirst?: { side: string; sx: number; ys: number[] }[] }) {
    const b = this.b;
    const wall = u.kind === "wall";
    const ends = [false, true];
    const sideLay = (): [string, Vec3, Vec3][] => [
      [u.sideL, [0, T / 2, -(u.Dc / 2 + 40)], [0, 0, Math.PI / 2]],
      [u.sideR, [0, T / 2, u.Dc / 2 + 40], [0, 0, -Math.PI / 2]],
    ];
    const tbLay = (): [string, Vec3, Vec3][] => [
      [u.bottom, [0, T / 2, -(1.5 * u.Dc + 80)], [0, 0, 0]],
      [u.top, [0, T / 2, (u.divider ? 2.5 : 1.5) * u.Dc + (u.divider ? 120 : 80)], [0, 0, 0]],
    ];

    if (!wall) {
      this.prep(
        { title: "Fit the feet into the sides", detail: "Lay both sides on a rug. Tap a socket into each hole in the bottom ends, then screw a foot into each.", kind: "legs", tools: ["hammer"] },
        sideLay(),
        () => {
          const pts = [u.sideL, u.sideR].flatMap((k, i) => [-1, 1].map((sz): FitOpts => ({ on: k, at: [(i ? 1 : -1) * (u.W / 2 - T / 2), u.y0, r(u.zc + sz * (u.Dc / 2 - 50))], dir: [0, 1, 0] })));
          b.fits(SOCKET, pts, 0.08);
          b.then(0.1);
          b.fits(FOOT, pts.map((p) => ({ ...p, hole: false })), 0.08);
        },
      );
    }
    this.prep(
      { title: "Screw the cam bolts into the sides", detail: "Eight in all, into the holes nearest the ends, by hand until they stop.", kind: "cams", tools: ["screwdriver"] },
      // the top and bottom are laid out here too, so they lie still while their dowels go in
      [...(wall ? sideLay() : []), ...tbLay()],
      () => b.fits(BOLT, ends.flatMap((e) => [...this.joint(u, -1, e).bolts, ...this.joint(u, 1, e).bolts]), 0.06),
    );
    this.prep(
      {
        title: u.susp.length > 2 ? "Screw in the three suspension fittings" : "Screw a suspension fitting into each side",
        detail: u.susp.length > 2 ? "One in the top back corner of each side and one on the divider, two screws each. The big hole faces the back." : "In the top back corner, two screws each. The big hole faces the back.",
        kind: "screws",
        tools: ["screwdriver"],
      },
      u.divider ? [[u.divider, [0, T / 2, 1.5 * u.Dc + 80], [0, 0, Math.PI / 2]]] : [],
      () => {
        for (const f of u.susp) {
          b.fit(SUSP, { on: f.on, at: f.at, dir: [f.sx, 0, 0], hole: false });
          b.then(0.05);
          b.fits(SUSP_SCREW, [-1, 1].map((k): FitOpts => ({ on: f.on, at: [f.at[0], f.at[1] + k * 18, f.at[2] - 12], dir: [f.sx, 0, 0] })), 0.06);
        }
      },
    );
    if (o.platesFirst) {
      this.prep({ title: "Screw the hinge plates onto the sides", detail: "Two on each side, at the front edge, the way the drawing shows.", kind: "hinges", tools: ["screwdriver"] }, [], () => {
        for (const p of o.platesFirst!) b.fits(PLATE, p.ys.map((y): FitOpts => ({ on: p.side, at: [p.sx * (u.W / 2 - T), y, r(u.zc + u.Dc / 2 - 37)], dir: [p.sx, 0, 0] })), 0.1);
      });
    }
    const divDowels = (): FitOpts[] =>
      u.divider
        ? [u.y0 + T, u.y0 + u.H - T].flatMap((y, i) => [-1, 1].map((k): FitOpts => ({ on: u.divider!, at: [0, y, r(u.zc + k * (u.Dc / 2 - 95))], dir: [0, i ? -1 : 1, 0], mate: i ? u.top : u.bottom })))
        : [];
    this.prep(
      { title: u.divider ? "Tap the dowels into the top, bottom and divider" : "Tap the dowels into the top and bottom", detail: "Two into each end, half their length. A light tap with the hammer.", kind: "dowels", tools: ["hammer"] },
      [],
      () => b.fits(DOWEL, [...ends.flatMap((e) => [...this.joint(u, -1, e).dowels, ...this.joint(u, 1, e).dowels]), ...divDowels()], 0.06),
    );

    if (wall) {
      if (u.divider) {
        this.step(
          { title: "Screw the divider between the top and bottom", detail: "Lay the cabinet on its front. Two long screws through the top and two through the bottom, with the Allen key.", kind: "screws", tools: ["allen"], pose: "-z", warnings: ["floor"] },
          () => {
            b.stagger(0.25);
            this.put(u.bottom, [0, -200, 0]);
            this.put(u.divider!, [0, 0, 200]);
            this.put(u.top, [0, 200, 0]);
            b.then(0.1);
            const zz = [-1, 1].map((k) => r(u.zc + k * (u.Dc / 2 - 60)));
            b.fits(LONG_SCREW, [
              ...zz.map((z): FitOpts => ({ on: u.top, at: [0, u.y0 + u.H, z], dir: [0, -1, 0], mate: u.divider })),
              ...zz.map((z): FitOpts => ({ on: u.bottom, at: [0, u.yb, z], dir: [0, 1, 0], mate: u.divider })),
            ], 0.1);
          },
        );
      }
      this.step(
        { title: "Join the top and bottom to one side", detail: "Lay it on its front on the rug. The dowels go into the side, the cam bolts into the holes in the panels.", kind: "join", pose: "-z", warnings: ["floor"] },
        () => {
          b.stagger(0.3);
          if (!u.divider) {
            this.put(u.bottom, [0, -200, 0]);
            this.put(u.top, [0, 200, 0]);
          }
          this.put(u.sideR, [260, 0, 0]);
        },
      );
    } else {
      this.step(
        { title: "Stand the top and bottom on one side", detail: "Lay a side flat on the rug, inside up, and push the dowels and cam bolts in.", kind: "join", pose: "+x", warnings: ["floor"] },
        () => {
          b.stagger(0.3);
          this.put(u.sideL, [0, 0, 0]);
          b.then(0.1);
          this.put(u.bottom, [200, 0, 0]);
          this.put(u.top, [200, 0, 0]);
        },
      );
    }
    const first = wall ? 1 : -1;
    this.step({ title: "Lock the cams", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls tight.", kind: "cams", tools: ["screwdriver"] }, () => {
      b.fits(CAM, ends.flatMap((e) => this.joint(u, first as -1 | 1, e).cams), 0.12);
    });

    if (u.plinth) {
      const pl = this.pos(u.plinth);
      const yIn = pl[1] + PLINTH / 2;
      this.prep(
        { title: "Screw the angle bracket onto the plinth", detail: "In the middle of its back face, at the top edge. One screw.", kind: "screws", tools: ["screwdriver"] },
        [[u.plinth, [0, T / 2, 1.5 * u.Dc + 80], [-Math.PI / 2, 0, 0]]],
        () => {
          b.fit(BRACKET, { on: u.plinth, at: [0, yIn - 12, pl[2] - T / 2], dir: [0, 0, 1], hole: false });
          b.then(0.05);
          b.fit(BRACKET_SCREW, { on: u.plinth, at: [0, yIn - 20, pl[2] - T / 2 - 2], dir: [0, 0, 1] });
        },
      );
      this.prep({ title: "Tap the dowels into the plinth", detail: "Two into each end.", kind: "dowels", tools: ["hammer"] }, [], () => {
        b.fits(DOWEL, [-1, 1].flatMap((sx) => [-1, 1].map((k): FitOpts => ({ on: u.plinth!, at: [sx * (u.W / 2 - T), pl[1] + k * 15, pl[2]], dir: [-sx, 0, 0], mate: sx < 0 ? u.sideL : u.sideR }))), 0.08);
      });
      this.step({ title: "Push the plinth into the side", detail: "Under the bottom, set back from the front edge, bracket to the back.", kind: "join" }, () => this.put(u.plinth!, [200, 0, 0]));
    }

    const other = wall ? u.sideL : u.sideR;
    this.step(
      { title: wall ? "Push the other side on" : "Lower the other side on", detail: "Onto all the dowels and cam bolts at once, pressing evenly along it.", kind: "join", people: wall ? 1 : 2 },
      () => this.put(other, wall ? [-260, 0, 0] : [300, 0, 0]),
    );
    this.step({ title: "Lock the cams on that side", detail: "Turn each one until it pulls the side tight.", kind: "cams", tools: ["screwdriver"] }, () => {
      b.fits(CAM, ends.flatMap((e) => this.joint(u, -first as -1 | 1, e).cams), 0.12);
    });
    if (u.plinth) {
      const pl = this.pos(u.plinth);
      this.step({ title: "Screw the bracket to the bottom", detail: "One screw up into the bottom panel. Then turn the cabinet onto its front.", kind: "screws", tools: ["screwdriver"] }, () => {
        b.fit(BRACKET_SCREW, { on: u.bottom, at: [0, u.yb, pl[2] - T / 2 - 12], dir: [0, 1, 0] });
      });
    }
    this.backSteps(u);
  }

  backSteps(u: Unit) {
    const b = this.b;
    const zb = u.zc - u.Dc / 2 - 3;
    const x0 = -u.W / 2 + T / 2, x1 = u.W / 2 - T / 2;
    const yb = u.yb + T / 2, yt = u.y0 + u.H - T / 2;
    const host = (x: number) => (x < 0 ? u.sideL : u.sideR);
    const nail = (x: number, y: number, on?: string): FitOpts => ({ on: on ?? host(x), at: [r(x), r(y), zb], dir: [0, 0, 1], hole: false });
    this.step(
      {
        title: "Lay the back on and nail three corners",
        detail: "Its edges sit in the grooves. One nail in a top corner, one in the other top corner, then one at the bottom, checking the frame is square as you go.",
        kind: "nails",
        tools: ["hammer"],
        pose: "-z",
        check: "square",
        warnings: ["square", "floor"],
      },
      () => {
        this.put(u.back, [0, 0, -260]);
        b.then(0.1);
        b.fits(NAIL, [nail(x0, yt - 10, u.top), nail(x1, yt - 10, u.top), nail(x1, yb + 10, u.bottom)], 0.25);
      },
    );
    const mid = u.divider ? 5 : 0;
    const rest = 27 - mid;
    this.step({ title: "Nail the rest of the back", detail: `${rest} more nails along the edges, about a hand apart.`, kind: "nails", tools: ["hammer"] }, () => {
      const list: FitOpts[] = [];
      const along = (n: number, f: (t: number) => FitOpts) => {
        for (let i = 0; i < n; i++) list.push(f((i + 1) / (n + 1)));
      };
      const perim = 2 * (u.H + u.W);
      const nSide = Math.round((rest * u.H) / perim), nTop = Math.round((rest * u.W) / perim);
      const nBot = rest - 2 * nSide - nTop;
      along(nSide, (t) => nail(x0, yb + (yt - yb) * t));
      along(nSide, (t) => nail(x1, yb + (yt - yb) * t));
      along(nTop, (t) => nail(x0 + (x1 - x0) * t, yt, u.top));
      along(Math.max(0, nBot), (t) => nail(x0 + (x1 - x0) * t, yb, u.bottom));
      b.fits(NAIL, list, 0.04);
    });
    if (u.divider) {
      this.step({ title: "Nail the back to the divider", detail: "Draw a line across the back over the divider, then five nails along it.", kind: "nails", tools: ["hammer", "pencil"] }, () => {
        b.fits(NAIL, Array.from({ length: 5 }, (_, i) => nail(0, yb + ((yt - yb) * (i + 1)) / 6, u.divider)), 0.12);
      });
    }
  }

  /** Wall screws through the fittings' keyhole plates, hang, adjust, lock and cover. */
  hang(u: Unit, title: string) {
    const b = this.b;
    const zw = u.zc - u.Dc / 2 - 3;
    this.step(
      {
        title,
        detail: "Turn the screw in each fitting back first. Mark the fitting holes level on the wall and drive in the screws, heads standing out. Wall screws and plugs aren't included: pick ones made for your wall.",
        kind: "anchor",
        tools: ["drill", "pencil", "level", "screwdriver"],
        pose: "+y",
        wall: true,
        warnings: ["wall"],
      },
      () => {
        b.fits(HW.plug, u.susp.map((f): FitOpts => ({ at: [f.at[0], f.at[1], zw - 2], dir: [0, 0, -1] })), 0.1);
        b.then(0.05);
        b.fits(HW.wallScrew, u.susp.map((f): FitOpts => ({ at: [f.at[0], f.at[1], zw], dir: [0, 0, -1] })), 0.1);
      },
    );
    this.step(
      { title: "Hang it on the screws", detail: "A wall plate goes over each screw head, then lift the cabinet so the fittings catch them. Turn the fitting screws to set it level and tight to the wall.", kind: "anchor", people: u.W >= 1000 || u.kind === "high" ? 2 : 1, wall: true },
      () => b.fits(KEYHOLE, u.susp.map((f): FitOpts => ({ on: f.on, at: [f.at[0], f.at[1], f.at[2] - 10], dir: [0, 0, -1], hole: false })), 0.12),
    );
    this.step({ title: "Lock the fittings and click on the covers", detail: "Tighten the locking screw in each fitting, then press its cover on.", kind: "screws", tools: ["screwdriver"] }, () =>
      b.fits(COVER, u.susp.map((f): FitOpts => ({ on: f.on, at: f.at, dir: [f.sx, 0, 0], hole: false })), 0.12),
    );
  }

  plates(list: DoorDef[]) {
    this.step({ title: list.length > 1 ? "Screw on the hinge plates" : "Screw the hinge plates onto the side", detail: "Into the front holes on the inside of the side. Decide now which way the door opens.", kind: "hinges", tools: ["screwdriver"], pose: "+y" }, () => {
      for (const d of list) this.b.fits(PLATE, this.hingeYs(d.lo, d.hi, d.n).map((y): FitOpts => ({ on: d.side, at: [d.sx * (d.u.W / 2 - T), y, r(d.u.zc + d.u.Dc / 2 - 37)], dir: [d.sx, 0, 0] })), 0.1);
    });
  }

  /** Hinges screwed into the door lying face down on the rug, then clipped onto the plates. */
  doors(list: DoorDef[]) {
    const b = this.b;
    const back = this.D / 2 - FT;
    this.step({ title: list.length > 1 ? "Screw the hinges into the doors" : "Screw the hinges into the door", detail: "Door face down on the rug. Press each hinge cup into its hole and fix it with two screws.", kind: "hinges", tools: ["screwdriver"], scene: "prep", warnings: ["floor"] }, () => {
      b.stagger(0.25);
      list.forEach((d, i) => {
        b.stage(d.key, [r((i - (list.length - 1) / 2) * (this.doorW.get(d.key)! + 120)), FT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
      });
      b.then(0.12);
      for (const d of list) {
        const ys = this.hingeYs(d.lo, d.hi, d.n);
        const x = this.pos(d.key)[0] + d.sx * (this.doorW.get(d.key)! / 2 - 22);
        b.fits(HINGE, ys.map((y): FitOpts => ({ on: d.key, at: [x, y, back], dir: [0, 0, 1], twist: d.sx > 0 ? Math.PI : 0 })), 0.1);
        b.then(0.05);
        b.fits(HINGE_SCREW, ys.flatMap((y) => [-1, 1].map((k): FitOpts => ({ on: d.key, at: [x - d.sx * 30, y + k * 22, back], dir: [0, 0, 1] }))), 0.05);
      }
    });
    this.step({ title: list.length > 1 ? "Clip the doors onto the plates" : "Clip the door onto the plates", detail: "Hook the back of each hinge over its plate and press until it clicks. Turn the hinge screws to even up the gaps.", kind: "doors", tools: ["screwdriver"], pose: "+y" }, () => {
      b.stagger(0.3);
      for (const d of list) this.put(d.key, [d.sx * 120, 0, 320]);
    });
  }

  doorW = new Map<string, number>();
  door(x: number, w: number, lo: number, hi: number) {
    const k = this.part("Door", [w, hi - lo, FT], [x, (lo + hi) / 2, this.D / 2 - FT / 2]);
    this.doorW.set(k, w);
    return k;
  }

  shelves(u: Unit, n: number, bays: { x: number; w: number; walls: [string, number][] }[], title: string) {
    if (!n) return;
    const b = this.b;
    const lo = u.yb + T, hi = u.y0 + u.H - T;
    const ys = Array.from({ length: n }, (_, i) => r(lo + ((hi - lo) * (i + 1)) / (n + 1)));
    const keys = bays.flatMap((bay) => ys.map((y) => ({ bay, y, k: this.part("Shelf", [bay.w - 2, T, u.Dc - 20], [bay.x, y + T / 2, u.zc + 10]) })));
    this.step({ title, detail: "Four pins for each shelf, at the same height on both sides, then lay the shelf on them.", kind: "shelves", pose: "+y" }, () => {
      const pins: FitOpts[] = keys.flatMap(({ bay, y }) => bay.walls.flatMap(([wall, x]) => [-1, 1].map((k): FitOpts => ({ on: wall, at: [x, y - 3, r(u.zc + k * (u.Dc / 2 - 45))], dir: [Math.sign(x - bay.x), 0, 0], hole: false }))));
      b.fits(PIN, pins, 0.05);
      b.then(0.1);
      b.stagger(0.25);
      for (const { k } of keys) this.put(k, [0, 0, 300]);
    });
  }

  /** Two bumpers where the doors close: the free edge of the side, the divider, or the middle of the bottom. */
  bumpers(units: { u: Unit; at: "side" | "middle" | "divider" }[]) {
    this.step({ title: "Stick on the door bumpers", detail: "On the front edge where the door closes, so it shuts softly.", kind: "general" }, () => {
      const pts: FitOpts[] = units.flatMap(({ u, at }) => {
        const z = u.zc + u.Dc / 2;
        if (at === "middle") return [-1, 1].map((k): FitOpts => ({ on: u.bottom, at: [k * 60, u.yb + T / 2, z], dir: [0, 0, -1] }));
        const on = at === "divider" ? u.divider! : u.sideR;
        const x = at === "divider" ? 0 : u.W / 2 - T / 2;
        return [u.yb + 60, u.y0 + u.H - 60].map((y): FitOpts => ({ on, at: [x, y, z], dir: [0, 0, -1] }));
      });
      this.b.fits(BUMPER, pts, 0.12);
    });
  }

  /* ---------- products ---------- */

  wallCabinet() {
    const W = this.W, H = this.s.size.h * 10;
    const divider = W >= 1000;
    const nDoors = (this.s.cabinet?.doors ?? 1) >= 2 ? 2 : 1;
    const u = this.unit("wall", H, 0, divider);
    const dw = nDoors === 2 ? (W - 3) / 2 - 1.5 : W - 3;
    const doors = nDoors === 2 ? [this.door(-(dw / 2 + 1.5), dw, 1.5, H - 1.5), this.door(dw / 2 + 1.5, dw, 1.5, H - 1.5)] : [this.door(0, dw, 1.5, H - 1.5)];
    const list: DoorDef[] = doors.map((key, i) => {
      const sx = nDoors === 2 && i === 1 ? 1 : -1;
      return { key, side: sx < 0 ? u.sideL : u.sideR, sx, lo: 0, hi: H, n: 2, u };
    });
    this.frame(u, { platesFirst: divider ? list.map((d) => ({ side: d.side, sx: d.sx, ys: this.hingeYs(d.lo, d.hi, d.n) })) : undefined });
    if (!divider) this.plates(list);
    this.hang(u, "Screw the wall screws in");
    const n = H > 400 ? 1 : 0;
    const bays = divider
      ? [
          { x: -(W / 4 + T / 4), w: W / 2 - 1.5 * T, walls: [[u.sideL, -(W / 2 - T)], [u.divider!, -T / 2]] as [string, number][] },
          { x: W / 4 + T / 4, w: W / 2 - 1.5 * T, walls: [[u.divider!, T / 2], [u.sideR, W / 2 - T]] as [string, number][] },
        ]
      : [{ x: 0, w: W - 2 * T, walls: [[u.sideL, -(W / 2 - T)], [u.sideR, W / 2 - T]] as [string, number][] }];
    // the manual hangs the doors first; the shelves go in before them here so you can see them
    this.shelves(u, n, bays, divider ? "Push in the shelf pins and lay in the shelves" : "Push in the shelf pins and lay in the shelf");
    this.doors(list);
    this.bumpers([{ u, at: divider ? "divider" : nDoors === 2 ? "middle" : "side" }]);
  }

  highCabinet() {
    const W = this.W, Htot = this.s.size.h * 10;
    const stack = Htot > 1800;
    const Hh = stack ? 1530 : Htot;
    const hu = this.unit("high", Hh - FOOT_H, FOOT_H, false);
    const inside = (u: Unit) => [{ x: 0, w: W - 2 * T, walls: [[u.sideL, -(W / 2 - T)], [u.sideR, W / 2 - T]] as [string, number][] }];
    const hDoor: DoorDef = { key: this.door(0, W - 3, hu.yb, Hh - 1.5), side: hu.sideL, sx: -1, lo: hu.yb, hi: Hh, n: 3, u: hu };
    this.frame(hu, {});
    this.step({ title: "Stand it up and level the feet", detail: "Lift it upright together, then turn the feet until it stands level and steady.", kind: "standup", pose: "+y", people: 2, tools: ["level"] }, () => {});
    if (!stack) {
      this.hang(hu, "Fix it to the wall");
      this.plates([hDoor]);
      this.shelves(hu, 3, inside(hu), "Push in the shelf pins and lay in the shelves");
      this.bumpers([{ u: hu, at: "side" }]);
      this.doors([hDoor]);
      return;
    }
    // the 75 cm wall cabinet, built on the rug as its own manual says, then screwed on top
    const wu = this.unit("wall", Htot - Hh, Hh, false);
    const wDoor: DoorDef = { key: this.door(0, W - 3, Hh + 1.5, Htot - 1.5), side: wu.sideL, sx: -1, lo: Hh, hi: Htot, n: 2, u: wu };
    this.alt = "top";
    this.origin = [0, Hh - 300, 0];
    this.frame(wu, {});
    this.alt = undefined;
    this.step({ title: "Lift the wall cabinet onto the high cabinet", detail: "Together, upright, flush at the front, back and sides.", kind: "join", people: 2, pose: "+y" }, () => {
      this.b.stagger(0);
      for (const k of [wu.sideL, wu.sideR, wu.top, wu.bottom, wu.back]) this.b.add(k, [0, 300, 0]);
    });
    this.step({ title: "Screw the two cabinets together", detail: "Four screws up through the top of the high cabinet into the bottom of the one on it.", kind: "screws", tools: ["screwdriver"] }, () => {
      const pts: FitOpts[] = [-1, 1].flatMap((sx) => [-1, 1].map((k): FitOpts => ({ on: hu.top, at: [sx * (W / 2 - T - 60), Hh - T, r(hu.zc + k * (hu.Dc / 2 - 60))], dir: [0, 1, 0], mate: wu.bottom })));
      this.b.fits(JOIN_SCREW, pts, 0.12);
    });
    this.hang({ ...hu, susp: [...hu.susp, ...wu.susp] }, "Fix both cabinets to the wall");
    this.plates([hDoor, wDoor]);
    this.shelves(hu, 3, inside(hu), "Shelf pins and shelves in the high cabinet");
    this.shelves(wu, 1, inside(wu), "Shelf pins and the shelf in the wall cabinet");
    this.bumpers([{ u: hu, at: "side" }, { u: wu, at: "side" }]);
    this.doors([hDoor, wDoor]);
  }
}

/* ---------- the corner base cabinet ---------- */

const SHORT_FRAME: HwDef = { kind: "screw", len: 35, dia: 7 }; // the short frame screws for the filler strip
const PANEL_BRACKET: HwDef = { kind: "angle", len: 50, dia: 40, name: "Panel bracket" };
const HINGE_PLATE: HwDef = { kind: "plate", len: 50, dia: 20, name: "Hinge plate" };
const TOP_SCREW: HwDef = { kind: "screw", len: 50, dia: 4 }; // up through the rails into the worktop

/**
 * KNOXHULT corner base cabinet, 100 wide with its worktop: a carcass on four feet in the sides and one in the plinth,
 * two rails across the top held by long frame screws, built lying on its front and the back nailed on. A block under
 * the bottom carries the plinth's end; then a cover panel closes the blind part of the front on four brackets, a filler
 * strip goes beside it, the worktop is screwed on from below (it reaches over the cabinet beside it in the corner), one
 * shelf on seven pins, two wall screws through the fittings, and the door, hinged off the cover panel. The manual shows
 * the blind part on either side; this is the one with it on the left.
 */
function cornerBase(k: Knox) {
  const b = k.b;
  const W = k.W; // 1000
  const Dc = 558;
  const zc = -k.D / 2 + Dc / 2; // the back against the wall
  const zf = zc + Dc / 2; // front edge of the carcass
  const y0 = FOOT_H, top = 880, yb = 100; // sides, top of the sides, underside of the bottom
  const H = top - y0;
  const sideL = k.part("Side panel", [T, H, Dc], [-(W / 2 - T / 2), y0 + H / 2, zc]);
  const sideR = k.part("Side panel", [T, H, Dc], [W / 2 - T / 2, y0 + H / 2, zc]);
  const bottom = k.part("Bottom panel", [W - 2 * T, T, Dc], [0, yb + T / 2, zc]);
  const ph = yb - y0;
  const pz = zf - 40 - T / 2;
  const plinth = k.part("Plinth", [W - 2 * T, ph, T], [0, y0 + ph / 2, pz]);
  const railZ = [zf - 50, zc - Dc / 2 + 50];
  const rails = railZ.map((z) => k.part("Rail", [W - 2 * T, T, 100], [0, top - T / 2, z]));
  const back = k.part("Back panel", [W, top - yb, 3], [0, yb + (top - yb) / 2, zc - Dc / 2 - 1.5], "fiber");
  // the front: cover panel over the blind part, a filler strip, the door
  const fy0 = yb, fy1 = top - 2, fz = zf + GAP + FT / 2;
  const CW = 350, SW = 44, DW = 600;
  const xc1 = -W / 2 + CW; // right edge of the cover panel
  const xs = xc1 + 2 + SW / 2;
  const xd = W / 2 - 2 - DW / 2;
  const cover = k.part("Cover panel", [CW, fy1 - fy0, FT], [-W / 2 + CW / 2, (fy0 + fy1) / 2, fz]);
  const filler = k.part("Filler strip", [SW, fy1 - fy0, FT], [xs, (fy0 + fy1) / 2, fz]);
  const door = k.part("Door", [DW, fy1 - fy0, FT], [xd, (fy0 + fy1) / 2, fz]);
  const block = k.part("Plinth support", [T, ph, zf + GAP + FT - (pz + T / 2)], [xs, y0 + ph / 2, (pz + T / 2 + zf + GAP + FT) / 2]);
  const WT = 30, over = 220;
  const worktop = b.place(b.part("Worktop", [W + over, WT, k.D], { material: "wood" }), [-over / 2, top + WT / 2, 0]);
  const shelfY = 490;
  const shelf = k.part("Shelf", [W - 2 * T - 2, T, Dc - 20], [0, shelfY + T / 2, zc - 5]);
  const u: Unit = { kind: "wall", W, H, Dc, zc, y0, yb, sideL, sideR, top: rails[0], bottom, back, susp: [] };
  const ys = top - 60, zb = zc - Dc / 2 + 30;
  const susp = [
    { on: sideL, sx: -1, at: [-(W / 2 - T), ys, zb] as Vec3 },
    { on: sideR, sx: 1, at: [W / 2 - T, ys, zb] as Vec3 },
  ];
  const sideLay = (): [string, Vec3, Vec3][] => [
    [sideL, [0, T / 2, -(Dc / 2 + 40)], [0, 0, Math.PI / 2]],
    [sideR, [0, T / 2, Dc / 2 + 40], [0, 0, -Math.PI / 2]],
  ];

  k.prep({ title: "Screw a wall fitting onto each side", detail: "In the top back corner, inside face up, two screws each.", kind: "screws", tools: ["screwdriver"] }, sideLay(), () => {
    for (const f of susp) {
      b.fit(SUSP, { on: f.on, at: f.at, dir: [f.sx, 0, 0], hole: false });
      b.then(0.05);
      b.fits(SUSP_SCREW, [-1, 1].map((d): FitOpts => ({ on: f.on, at: [f.at[0], f.at[1] + d * 18, f.at[2] - 12], dir: [f.sx, 0, 0] })), 0.06);
    }
  });
  k.prep({ title: "Screw the cam bolts into the sides", detail: "Two in each side, for the bottom. By hand until they stop.", kind: "cams", tools: ["screwdriver"] }, [], () => {
    b.fits(BOLT, [-1, 1].flatMap((sx) => k.joint(u, sx as -1 | 1, false).bolts), 0.08);
  });
  const sideFeet = [sideL, sideR].flatMap((key, i) => [-1, 1].map((sz): FitOpts => ({ on: key, at: [(i ? 1 : -1) * (W / 2 - T / 2), y0, r(zc + sz * (Dc / 2 - 50))], dir: [0, 1, 0] })));
  k.prep({ title: "Fit the feet into the sides", detail: "Tap a socket into each hole in the bottom ends, then screw a foot into each.", kind: "legs", tools: ["hammer"] }, [[bottom, [0, T / 2, -(1.5 * Dc + 80)], [0, 0, 0]]], () => {
    b.fits(SOCKET, sideFeet, 0.08);
    b.then(0.1);
    b.fits(FOOT, sideFeet.map((p) => ({ ...p, hole: false })), 0.08);
  });
  k.prep({ title: "Tap the dowels into the bottom", detail: "Two into each end, half their length.", kind: "dowels", tools: ["hammer"] }, [], () => {
    b.fits(DOWEL, [-1, 1].flatMap((sx) => k.joint(u, sx as -1 | 1, false).dowels), 0.06);
  });
  k.step({ title: "Join the bottom to the left side", detail: "Lay it on its front on the rug. The bottom slides in with the groove for the back at the back.", kind: "join", pose: "-z", warnings: ["floor"] }, () => {
    b.stagger(0.3);
    k.put(sideL, [-200, 0, 0]);
    k.put(bottom, [200, 0, 0]);
  });
  k.step({ title: "Lock the cams", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls tight.", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(CAM, k.joint(u, -1, false).cams, 0.12);
  });

  const plinthFoot: FitOpts = { on: plinth, at: [0, y0, pz], dir: [0, 1, 0] };
  const railLay = rails.map((rk, i): [string, Vec3, Vec3] => [rk, [0, T / 2, (i ? 1 : -1) * (Dc + 120)], [0, 0, 0]]);
  k.prep({ title: "Fit the foot into the plinth", detail: "A socket in the middle hole of its bottom edge, then the foot.", kind: "legs", tools: ["hammer"] }, [[plinth, [0, T / 2, 1.5 * Dc + 80], [-Math.PI / 2, 0, 0]], ...railLay], () => {
    b.fit(SOCKET, plinthFoot);
    b.then(0.1);
    b.fit(FOOT, { ...plinthFoot, hole: false });
  });
  k.prep({ title: "Tap the dowels into the plinth", detail: "Two into each end.", kind: "dowels", tools: ["hammer"] }, [], () => {
    b.fits(DOWEL, [-1, 1].flatMap((sx) => [-1, 1].map((d): FitOpts => ({ on: plinth, at: [sx * (W / 2 - T), y0 + ph / 2 + d * 20, pz], dir: [-sx, 0, 0], mate: sx < 0 ? sideL : sideR }))), 0.08);
  });
  k.step({ title: "Push the plinth into the side", detail: "Under the bottom, set back from the front edge. The manual shows which way round for a corner on the right.", kind: "join" }, () => k.put(plinth, [200, 0, 0]));
  const angleAt: Vec3 = [0, yb, pz - T / 2];
  k.step({ title: "Screw a small angle bracket onto the plinth", detail: "In the middle of its back face, at the top. One screw for now.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fit(BRACKET, { on: plinth, at: [angleAt[0], angleAt[1] - 12, angleAt[2]], dir: [0, 0, 1], hole: false });
    b.then(0.05);
    b.fit(BRACKET_SCREW, { on: plinth, at: [angleAt[0], angleAt[1] - 20, angleAt[2] - 2], dir: [0, 0, 1] });
  });
  k.prep({ title: "Tap the dowels into the two rails", detail: "One into each end. Check the holes face the way the drawing shows.", kind: "dowels", tools: ["hammer"] }, [], () => {
    b.fits(DOWEL, rails.flatMap((rk) => [-1, 1].map((sx): FitOpts => ({ on: rk, at: [sx * (W / 2 - T), top - T / 2, k.pos(rk)[2]], dir: [-sx, 0, 0], mate: sx < 0 ? sideL : sideR }))), 0.08);
  });
  const railScrews = (sx: -1 | 1) => rails.map((rk): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * (W / 2), top - T / 2, k.pos(rk)[2]], dir: [-sx, 0, 0], mate: rk }));
  k.step({ title: "Fit the rails and screw them to the left side", detail: "One at the front and one at the back of the top. A long frame screw through the side into each, with the Allen key.", kind: "screws", tools: ["allen"] }, () => {
    b.stagger(0.3);
    for (const rk of rails) k.put(rk, [200, 0, 0]);
    b.then(0.1);
    b.fits(LONG_SCREW, railScrews(-1), 0.12);
  });
  k.step({ title: "Put the right side on", detail: "Onto the dowels and cam bolts, then two more long frame screws into the rails.", kind: "screws", tools: ["allen"] }, () => {
    k.put(sideR, [260, 0, 0]);
    b.then(0.1);
    b.fits(LONG_SCREW, railScrews(1), 0.12);
  });
  k.step({ title: "Lock the cams on that side", detail: "Turn each one until it pulls the side tight.", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(CAM, k.joint(u, 1, false).cams, 0.12);
  });
  k.step({ title: "Screw the angle bracket to the bottom", detail: "One screw up into the bottom panel.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fit(BRACKET_SCREW, { on: bottom, at: [0, yb, angleAt[2] - 12], dir: [0, 1, 0] });
  });

  // the back: three single nails squaring it up, then the rest
  const zn = zc - Dc / 2 - 3;
  const x0 = -W / 2 + T / 2, x1 = W / 2 - T / 2, ny0 = yb + T / 2, ny1 = top - T / 2;
  const nail = (x: number, y: number, on: string): FitOpts => ({ on, at: [r(x), r(y), zn], dir: [0, 0, 1], hole: false });
  const backRail = rails[1];
  k.step({ title: "Lay the back on and nail one corner", detail: "Square to the bottom edge first, then one nail in the corner.", kind: "nails", tools: ["hammer"], check: "square", warnings: ["square"] }, () => {
    k.put(back, [0, 0, -260]);
    b.then(0.1);
    b.fit(NAIL, nail(x1, ny0, bottom));
  });
  k.step({ title: "Nail the opposite corner", detail: "Push the frame until the back's edge lines up with the top, then one nail.", kind: "nails", tools: ["hammer"] }, () => b.fit(NAIL, nail(x0, ny1, backRail)));
  k.step({ title: "Nail a third corner", detail: "Check it's still square: the back's edges run along the frame all round.", kind: "nails", tools: ["hammer"] }, () => b.fit(NAIL, nail(x1, ny1, backRail)));
  k.step({ title: "Nail the rest of the back", detail: "21 more along the edges, about a hand apart, then turn the cabinet upright.", kind: "nails", tools: ["hammer"] }, () => {
    const list: FitOpts[] = [];
    const along = (n: number, f: (t: number) => FitOpts) => {
      for (let i = 0; i < n; i++) list.push(f((i + 1) / (n + 1)));
    };
    along(4, (t) => nail(x0, ny0 + (ny1 - ny0) * t, sideL));
    along(4, (t) => nail(x1, ny0 + (ny1 - ny0) * t, sideR));
    along(6, (t) => nail(x0 + (x1 - x0) * t, ny1, backRail));
    along(6, (t) => nail(x0 + (x1 - x0) * t, ny0, bottom));
    list.push(nail(x0, ny0, bottom));
    b.fits(NAIL, list, 0.04);
  });

  // the block under the bottom that carries the end of the plinth on the blind side
  k.step({ title: "Screw the plinth support under the bottom", detail: "Stand the cabinet on its right side. Two long frame screws through the bottom into the support block, below where the filler strip goes.", kind: "screws", tools: ["allen"], pose: "-x", warnings: ["floor"] }, () => {
    k.put(block, [0, -160, 0]);
    b.then(0.1);
    b.fits(LONG_SCREW, [-1, 1].map((d): FitOpts => ({ on: bottom, at: [xs, yb + T, r(k.pos(block)[2] + d * 12 - 10)], dir: [0, -1, 0], mate: block })), 0.12);
  });
  const angle2: Vec3 = [xs + T / 2, yb - 12, pz + T / 2];
  k.step({ title: "Screw the second small angle onto the plinth", detail: "In the corner between the plinth and the support block. One screw into the plinth.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fit(BRACKET, { on: plinth, at: angle2, dir: [0, 0, -1], hole: false });
    b.then(0.05);
    b.fit(BRACKET_SCREW, { on: plinth, at: [angle2[0] + 12, angle2[1] - 8, angle2[2]], dir: [0, 0, -1] });
  });
  k.step({ title: "Screw the angle to the support block", detail: "One screw into the side of the block.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fit(BRACKET_SCREW, { on: block, at: [xs + T / 2, angle2[1] - 8, angle2[2] + 12], dir: [-1, 0, 0] });
  });

  // the door and the cover panel, face down on the rug
  const back2 = fz - FT / 2;
  const hy = k.hingeYs(fy0, fy1, 2);
  const hingeX = xd - (DW / 2 - 22);
  k.step({ title: "Screw the hinges into the door", detail: "Face down on the rug, hinges along the edge that meets the cover panel. Two screws each.", kind: "hinges", tools: ["screwdriver"], scene: "fronts", warnings: ["floor", "face"] }, () => {
    b.stagger(0.25);
    b.stage(door, [-(DW / 2 + 60), FT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.stage(cover, [CW / 2 + 60, FT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.12);
    b.fits(HINGE, hy.map((y): FitOpts => ({ on: door, at: [hingeX, y, back2], dir: [0, 0, 1] })), 0.1);
    b.then(0.05);
    b.fits(SUSP_SCREW, hy.flatMap((y) => [-1, 1].map((d): FitOpts => ({ on: door, at: [hingeX + 30, y + d * 22, back2], dir: [0, 0, 1] }))), 0.05);
  });
  k.step({ title: "Screw the hinge plates onto the cover panel", detail: "On its back, along the edge next to the door: press each plate on and drive in its two screws.", kind: "hinges", tools: ["screwdriver"], scene: "fronts" }, () => {
    b.fits(HINGE_PLATE, hy.map((y): FitOpts => ({ on: cover, at: [xc1 - 30, y, back2], dir: [0, 0, 1], hole: false })), 0.15);
  });
  const brk = [
    { at: [-W / 2 + T + 30, top - 80, back2] as Vec3, into: sideL, dir: [-1, 0, 0] as Vec3 },
    { at: [-W / 2 + T + 30, yb + 80, back2] as Vec3, into: sideL, dir: [-1, 0, 0] as Vec3 },
    { at: [xc1 - 90, top - T - 6, back2] as Vec3, into: rails[0], dir: [0, 1, 0] as Vec3 },
    { at: [xc1 - 90, yb + T + 6, back2] as Vec3, into: bottom, dir: [0, -1, 0] as Vec3 },
  ];
  const brkPanel = (i: number) => {
    const p = brk[i].at;
    return [
      b.fit(PANEL_BRACKET, { on: cover, at: p, dir: [0, 0, 1], hole: false }),
      ...b.fits(BRACKET_SCREW, [-1, 1].map((d): FitOpts => ({ on: cover, at: [p[0] + d * 14, p[1], p[2]], dir: [0, 0, 1] })), 0.06),
    ];
  };
  k.step({ title: "Screw two panel brackets onto the cover panel", detail: "Along the edge that goes at the side, near the top and the bottom. Two screws each.", kind: "screws", tools: ["screwdriver"], scene: "fronts" }, () => {
    brkPanel(0);
    b.then(0.05);
    brkPanel(1);
  });
  k.step({ title: "Screw on the other two brackets", detail: "By the hinge plates, at the top and the bottom edge, flanges pointing up and down.", kind: "screws", tools: ["screwdriver"], scene: "fronts" }, () => {
    brkPanel(2);
    b.then(0.05);
    brkPanel(3);
  });
  const into = (i: number): FitOpts[] => {
    const f = brk[i];
    const p: Vec3 = f.dir[0] ? [-W / 2 + T, f.at[1], zf - 20] : [f.at[0], f.dir[1] > 0 ? top - T : yb + T, zf - 20];
    return [-1, 1].map((d): FitOpts => ({ on: f.into, at: f.dir[0] ? [p[0], p[1] + d * 14, p[2]] : [p[0] + d * 14, p[1], p[2]], dir: f.dir }));
  };
  k.step({ title: "Hold the cover panel on the front", detail: "Stand the cabinet up. The panel covers the left part of the front, flush with the side and the top.", kind: "join", pose: "+y" }, () => k.put(cover, [0, 0, 300]));
  k.step({ title: "Screw the top bracket to the rail", detail: "Two screws up into the front rail.", kind: "screws", tools: ["screwdriver"] }, () => b.fits(BRACKET_SCREW, into(2), 0.1));
  k.step({ title: "Screw the side brackets to the side", detail: "Two screws each into the inside of the left side.", kind: "screws", tools: ["screwdriver"] }, () => b.fits(BRACKET_SCREW, [...into(0), ...into(1)], 0.08));
  k.step({ title: "Screw the bottom bracket to the bottom", detail: "Two screws down into the bottom panel.", kind: "screws", tools: ["screwdriver"] }, () => b.fits(BRACKET_SCREW, into(3), 0.1));
  k.step({ title: "Fit the filler strip beside the cover panel", detail: "Two short frame screws, not the long ones, through the edge of the cover panel into the strip. Use the Allen key.", kind: "screws", tools: ["allen"] }, () => {
    k.put(filler, [0, 0, 260]);
    b.then(0.1);
    b.fits(SHORT_FRAME, [fy0 + 120, fy1 - 120].map((y): FitOpts => ({ on: cover, at: [xc1 - 20, y, back2], dir: [1, 0, 0], mate: filler })), 0.12);
  });

  k.step({ title: "Lay the worktop on", detail: "Flush with the back and the right side. The long end reaches over the blind side, towards the corner.", kind: "join", people: 2 }, () => k.put(worktop, [0, 260, 0]));
  k.step({ title: "Screw the worktop down through the rails", detail: "Clamp it in place first. Eight screws up through the rails, four in each.", kind: "screws", tools: ["screwdriver"], people: 2 }, () => {
    b.fits(TOP_SCREW, rails.flatMap((rk) => [-0.42, -0.14, 0.14, 0.42].map((f): FitOpts => ({ on: rk, at: [r(f * (W - 2 * T)), top - T, k.pos(rk)[2]], dir: [0, 1, 0], mate: worktop }))), 0.08);
  });
  k.step({ title: "Push in the shelf pins", detail: "Seven, all at the same height: two in each side and three along the back.", kind: "shelves" }, () => {
    const pins: FitOpts[] = [
      ...[-1, 1].flatMap((sx) => [-1, 1].map((d): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * (W / 2 - T), shelfY - 3, r(zc + d * (Dc / 2 - 50))], dir: [sx, 0, 0] }))),
      ...[-0.25, 0, 0.25].map((f): FitOpts => ({ on: back, at: [r(f * W), shelfY - 3, zc - Dc / 2], dir: [0, 0, -1] })),
    ];
    b.fits(PIN, pins, 0.06);
  });
  k.step({ title: "Screw the worktop down at the front", detail: "Three long frame screws up through the top of the cover panel, the filler strip and the front rail. Use the Allen key.", kind: "screws", tools: ["allen"] }, () => {
    b.fits(LONG_SCREW, [
      // 50 mm: 20 of it in the panel or rail, the rest in the 30 mm worktop
      { on: cover, at: [-W / 2 + 60, top - 22, fz], dir: [0, 1, 0], mate: worktop },
      { on: filler, at: [xs, top - 22, fz], dir: [0, 1, 0], mate: worktop },
      { on: rails[0], at: [W / 4, top - T - 3, railZ[0] + 30], dir: [0, 1, 0], mate: worktop },
    ], 0.12);
  });
  k.step({ title: "Tilt the shelf in and lay it on the pins", detail: "In at an angle through the door opening, then lower it flat.", kind: "shelves" }, () => k.put(shelf, [200, 120, 360]));
  k.step({ title: "Push it into place and level the feet", detail: "Into the corner, then turn the five feet until the worktop is level both ways.", kind: "legs", tools: ["level"] }, () => {});

  const zw = zc - Dc / 2 - 3;
  k.step({ title: "Mark and drill for the wall screws", detail: "Through the two fittings at the back. It must be fixed to the wall so it can't tip. Wall screws and plugs aren't included: pick ones made for your wall.", kind: "anchor", tools: ["pencil", "drill", "screwdriver"], wall: true, warnings: ["wall", "tip"] }, () => {
    b.fits(HW.plug, susp.map((f): FitOpts => ({ at: [f.at[0], f.at[1], zw - 2], dir: [0, 0, -1] })), 0.1);
    b.then(0.05);
    b.fits(HW.wallScrew, susp.map((f): FitOpts => ({ at: [f.at[0], f.at[1], zw], dir: [0, 0, -1] })), 0.1);
  });
  k.step({ title: "Hook the fittings over the screw heads", detail: "A wall plate goes on each fitting. Turn the fitting screws to set the height and pull it tight to the wall.", kind: "anchor", wall: true }, () =>
    b.fits(KEYHOLE, susp.map((f): FitOpts => ({ on: f.on, at: [f.at[0], f.at[1], f.at[2] - 10], dir: [0, 0, -1], hole: false })), 0.12),
  );
  k.step({ title: "Lock the fittings", detail: "Tighten the locking screw in each one.", kind: "screws", tools: ["screwdriver"] }, () => {});
  k.step({ title: "Stick on the door bumpers", detail: "Two on the front edge of the right side, where the door closes.", kind: "general" }, () => {
    b.fits(BUMPER, [yb + 60, top - 60].map((y): FitOpts => ({ on: sideR, at: [W / 2 - T / 2, y, zf], dir: [0, 0, -1] })), 0.12);
  });
  k.step({ title: "Click the door onto the hinge plates", detail: "Hook each hinge onto its plate and press until it clicks. Turn the hinge screws to even up the gaps.", kind: "doors", tools: ["screwdriver"] }, () => k.put(door, [120, 0, 320]));
}

function kindOf(s: ProductSpec): Kind | null {
  const slug = s.slug ?? "";
  if (/corner/.test(slug)) return null;
  if (/wall-cabinet/.test(slug)) return "wall";
  if (/high-cabinet/.test(slug)) return "high";
  return null;
}

const family: Family = {
  names: ["KNOXHULT"],
  build(b, s) {
    if (/corner-base/.test(s.slug ?? "")) {
      cornerBase(new Knox(b, s));
      return true;
    }
    const kind = kindOf(s);
    if (!kind) return false;
    const k = new Knox(b, s);
    if (kind === "wall") k.wallCabinet();
    else k.highCabinet();
    return true;
  },
};
export default family;
