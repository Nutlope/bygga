import type { PartPiece, ProductSpec, StepKind, ToolId, Vec3, WarnId, Pose } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import type { Family } from "./family";

/*
 * ALEX, read from IKEA's manuals.
 *
 * Drawer units and the storage unit share one carcass: two sides with the drawer runners already on them, a back
 * that stands between them on cam bolts and cam locks, and a top and bottom that cover the ends of the sides and
 * the back, each on six cam bolts locked from the outsides of the sides. It is built lying on its back on a rug,
 * gets its glides (or castors) and is stood up. The 9-drawer unit and the wide unit on castors screw their bottom on
 * with long Allen screws instead; the tall one is strapped to the wall.
 * Every drawer is built standing on its front: cam bolts in the front (and dowels in the sides of a shallow one),
 * the sides pushed on and locked, the bottom slid down the grooves, the back dropped in and held by ribbed plastic
 * dowels hammered through the sides. The drawers ride on the runners in the carcass and two little screws in each
 * stop them coming out.
 */

const T = 15; // carcass boards
const TF = 15; // drawer fronts
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

// fittings, sized so different ones stay apart in the list
const CAM_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const SHORT_BOLT: HwDef = { kind: "camScrew", len: 24, dia: 7, name: "Short cam bolt" };
const CAM: HwDef = { kind: "cam", len: 13, dia: 15 };
const DRAWER_CAM: HwDef = { kind: "cam", len: 10, dia: 12, name: "Drawer cam lock" };
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const RIBBED: HwDef = { kind: "dowel", len: 32, dia: 7, name: "Ribbed plastic dowel" };
const STOP: HwDef = { kind: "screw", len: 8, dia: 4, name: "Drawer stop screw" };
const FRAME_SCREW: HwDef = { kind: "screw", len: 50, dia: 6, name: "Allen screw" };
const GLIDE: HwDef = { kind: "glide", len: 6, dia: 20, name: "Glide" };
const CASTOR: HwDef = { kind: "castor", len: 60, dia: 50 };
const CASTOR_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const STRAP: HwDef = { kind: "strap", len: 110, dia: 20 };
const STRAP_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const WALL_SCREW: HwDef = { kind: "screw", len: 50, dia: 5, notIncluded: true };
const WALL_PLUG: HwDef = { kind: "plug", len: 35, dia: 8, notIncluded: true };
const PLATE: HwDef = { kind: "plate", len: 12, dia: 36, name: "Mounting plate" };
const PLATE_SCREW: HwDef = { kind: "screw", len: 12, dia: 5 };
const HINGE: HwDef = { kind: "hinge", len: 50, dia: 35 };
const HINGE_SCREW: HwDef = { kind: "screw", len: 13, dia: 4 };
const SHELF_PIN: HwDef = { kind: "pin", len: 16, dia: 5 };
const PAD: HwDef = { kind: "glide", len: 2, dia: 12, name: "Stick-on pad" };

interface StepIn {
  title: string;
  detail?: string;
  tools?: ToolId[];
  people?: 1 | 2;
  pose?: Pose;
  warnings?: WarnId[];
  kind: StepKind;
  repeat?: number;
  scene?: string;
  wall?: boolean;
}

/* ---------- the carcass ---------- */

type Kind = "deep" | "shallow";
export interface Unit {
  W: number;
  D: number;
  Hc: number; // carcass height
  y0: number; // underside of the bottom (castor height)
  slots: Kind[]; // drawers from the top down
  pitch: Record<Kind, number>;
}

interface Carcass {
  g: Unit;
  sides: [string, string];
  back: string;
  top: string;
  bottom: string;
  xi: number; // inner faces of the sides
  yTop: number; // underside of the top
  yBot: number; // upper face of the bottom
}

/** Where each drawer's box sits: its slot from the top, the bottom of its box, its height and depth. */
export function slotsOf(g: Unit) {
  const xi = g.W / 2 - T;
  let y = g.y0 + g.Hc - T;
  return g.slots.map((kind, i) => {
    const p = g.pitch[kind];
    const top = y;
    y -= p;
    const fh = p - 3;
    const bh = Math.round(fh - 40);
    const bw = 2 * xi - 26;
    const bd = Math.round((g.D - T - TF - 20) / 10) * 10;
    return { i, kind, cx: 0, ow: 2 * xi, top, fy: top - 1.5 - fh / 2, fh, yb: top - p + 10, bh, bw, bd, zf: g.D / 2 - TF, zb: g.D / 2 - TF - bd };
  });
}
type Slot = ReturnType<typeof slotsOf>[number];

export function carcassParts(b: PlanBuilder, g: Unit, o: { noBottom?: boolean } = {}): Carcass {
  const xi = g.W / 2 - T;
  const hs = g.Hc - 2 * T;
  const ys = g.y0 + T + hs / 2;
  // without a bottom panel the sides run down to the floor rails
  const sh = o.noBottom ? g.Hc - T : hs;
  const sy = o.noBottom ? g.y0 + sh / 2 : ys;
  const slots = slotsOf(g);
  const runLen = g.D - T - TF - 30;
  const side = (name: string, sg: -1 | 1) => {
    const pieces: PartPiece[] = [{ shape: "box", size: [T, sh, g.D], pos: [sg * (g.W / 2 - T / 2), sy, 0] }];
    for (const s of slots) pieces.push({ shape: "box", size: [12, 16, runLen], pos: [sg * (xi - 6), s.yb + 12, g.D / 2 - TF - 10 - runLen / 2], material: "metal" });
    const { type, mid } = b.compound(name, pieces);
    return b.place(type, mid);
  };
  const sides: [string, string] = [side("Left side", -1), side("Right side", 1)];
  const back = b.place(b.part("Back panel", [2 * xi, hs, T]), [0, ys, -g.D / 2 + T / 2]);
  const tb = b.part(o.noBottom ? "Top" : "Top and bottom panel", [g.W, T, g.D]);
  const top = b.place(tb, [0, g.y0 + g.Hc - T / 2, 0]);
  const bottom = o.noBottom ? "" : b.place(tb, [0, g.y0 + T / 2, 0]);
  return { g, sides, back, top, bottom, xi, yTop: g.y0 + g.Hc - T, yBot: g.y0 + T };
}

export function stepper(b: PlanBuilder) {
  let pose: Pose = "+y";
  return (s: StepIn, body: () => void) => {
    const side = !!s.scene && s.scene !== "main";
    if (s.pose && !side) pose = s.pose;
    const warnings = new Set<WarnId>(s.warnings ?? []);
    if (s.people === 2) warnings.add("two");
    b.step({ title: s.title, detail: s.detail, tools: s.tools ?? [], people: s.people ?? 1, pose: side ? (s.pose ?? "+y") : pose, warnings: [...warnings].slice(0, 3), kind: s.kind, repeat: s.repeat, scene: s.scene, wall: s.wall }, body);
  };
}
type Stepper = ReturnType<typeof stepper>;

/** The joints of the carcass, as lists of fittings. */
function joints(c: Carcass) {
  const { g, sides, back, top, bottom, xi, yTop, yBot } = c;
  const sg = (i: number) => (i === 0 ? -1 : 1);
  const zBack = -g.D / 2 + T / 2;
  const yBack = spread(yBot + 70, yTop - 70, 3);
  const zEnds = spread(-g.D / 2 + 50, g.D / 2 - 50, 3);
  const xEnd = (i: number) => sg(i) * (g.W / 2 - T / 2);
  return {
    // cam bolts in the inside of each side at the back edge, locked from the inside of the back
    backBolts: [0, 1].flatMap((i) => yBack.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * xi, y, zBack], dir: [-sg(i), 0, 0], mate: back, mateHole: 4 }))),
    backCams: [0, 1].flatMap((i) => yBack.map((y): FitOpts => ({ on: back, at: [sg(i) * (xi - 25), y, zBack + T / 2], dir: [0, 0, -1] }))),
    backDowels: [0, 1].flatMap((i) => [yBot + 140, yTop - 140].map((y): FitOpts => ({ on: back, at: [sg(i) * xi, y, zBack], dir: [sg(i), 0, 0], mate: sides[i] }))),
    // dowels in the ends of the sides and the back, into the top and bottom
    endDowels: (end: "top" | "bottom") => {
      const y = end === "top" ? yTop : yBot;
      const dir: Vec3 = end === "top" ? [0, -1, 0] : [0, 1, 0];
      const mate = end === "top" ? top : bottom;
      return [
        ...[0, 1].flatMap((i) => [-g.D / 4, g.D / 4].map((z): FitOpts => ({ on: sides[i], at: [xEnd(i), y, z], dir, mate }))),
        ...[0, 1].map((i): FitOpts => ({ on: back, at: [sg(i) * (xi - 70), y, zBack], dir, mate })),
      ];
    },
    sideDowels: (end: "top" | "bottom") => {
      const y = end === "top" ? yTop : yBot;
      const dir: Vec3 = end === "top" ? [0, -1, 0] : [0, 1, 0];
      return [0, 1].flatMap((i) => [-g.D / 4, g.D / 4].map((z): FitOpts => ({ on: sides[i], at: [xEnd(i), y, z], dir, mate: end === "top" ? top : bottom })));
    },
    // cam bolts in the top or bottom over each side, locked from the outside of the side
    endBolts: (end: "top" | "bottom") =>
      [0, 1].flatMap((i) => zEnds.map((z): FitOpts => (end === "top" ? { on: top, at: [xEnd(i), yTop, z], dir: [0, 1, 0], mate: sides[i], mateHole: 4 } : { on: bottom, at: [xEnd(i), yBot, z], dir: [0, -1, 0], mate: sides[i], mateHole: 4 }))),
    endCams: (end: "top" | "bottom") => [0, 1].flatMap((i) => zEnds.map((z): FitOpts => ({ on: sides[i], at: [sg(i) * (g.W / 2), end === "top" ? yTop - 25 : yBot + 25, z], dir: [sg(i) * -1, 0, 0] }))),
    // long Allen screws up through the bottom into the sides
    bottomScrews: [0, 1].flatMap((i) => zEnds.map((z): FitOpts => ({ on: bottom, at: [xEnd(i), g.y0, z], dir: [0, 1, 0], mate: sides[i] }))),
    glides: [-1, 1].flatMap((sx) => [-1, 1].map((sz): FitOpts => ({ on: bottom, at: [sx * (g.W / 2 - 35), g.y0, sz * (g.D / 2 - 35)], dir: [0, 1, 0], hole: false }))),
    castors: [-1, 1].flatMap((sx) => [-1, 1].map((sz): FitOpts => ({ on: bottom, at: [sx * (g.W / 2 - 45), g.y0, sz * (g.D / 2 - 50)], dir: [0, 1, 0], hole: false }))),
    castorScrews: [-1, 1].flatMap((sx) =>
      [-1, 1].flatMap((sz) => [-1, 1].flatMap((ex) => [-1, 1].map((ez): FitOpts => ({ on: bottom, at: [sx * (g.W / 2 - 45) + ex * 16, g.y0, sz * (g.D / 2 - 50) + ez * 16], dir: [0, 1, 0] })))),
    ),
  };
}

/** Sides (and back) laid flat on the rug, inside faces up, in a scene of their own. */
function layFlat(b: PlanBuilder, c: Carcass, withBack: boolean) {
  // all three lie with their height running away from you, the sides turned so the runners face up
  const gap = 60;
  const half = withBack ? c.xi + gap : gap / 2;
  const sx = half + c.g.D / 2;
  b.stagger(0.2);
  b.stage(c.sides[0], [-sx, (T + 12) / 2, 0], [0, Math.PI / 2, Math.PI / 2], [0, 160, 0]);
  if (withBack) b.stage(c.back, [0, T / 2, 0], [-Math.PI / 2, 0, 0], [0, 160, 0]);
  b.stage(c.sides[1], [sx, (T + 12) / 2, 0], [0, Math.PI / 2, -Math.PI / 2], [0, 160, 0]);
  b.then(0.2);
}

/** The top and bottom laid flat, inside faces up. */
function layPanels(b: PlanBuilder, c: Carcass, which: ("top" | "bottom")[]) {
  b.stagger(0.2);
  which.forEach((w, i) => {
    const key = w === "top" ? c.top : c.bottom;
    const x = which.length === 1 ? 0 : (i - 0.5) * (c.g.W + 80);
    b.stage(key, [x, T / 2, 0], w === "top" ? [0, 0, Math.PI] : [0, 0, 0], [0, 160, 0]);
  });
  b.then(0.2);
}

/** The 5-drawer unit and the storage unit (36 x 70): back and sides on cam locks, then top and bottom on cam locks. */
export function carcassA(b: PlanBuilder, st: Stepper, c: Carcass, feet: "glides" | "castors") {
  const j = joints(c);
  st({ title: "Screw the cam bolts into the sides", detail: "Lay both sides on a rug, runners up. Three bolts along the back edge of each, by hand until they stop.", tools: ["screwdriver"], kind: "cams", scene: "flat", warnings: ["floor"] }, () => {
    layFlat(b, c, true);
    b.fits(CAM_BOLT, j.backBolts, 0.08);
  });
  st({ title: "Tap the dowels into the ends", detail: "Two in each end of both sides and one in each end of the back: twelve in all.", tools: ["hammer"], kind: "dowels", scene: "flat" }, () => {
    b.fits(DOWEL, [...j.endDowels("top"), ...j.endDowels("bottom")], 0.05);
  });
  st({ title: "Stand the sides on the back", detail: "The back lies flat on the rug, its cam holes up. The bolts in the sides go into the holes in its long edges.", pose: "+z", kind: "join", warnings: ["floor"] }, () => {
    b.add(c.back, [0, 0, 300]);
    b.then(0.15);
    b.stagger(0.25);
    b.add(c.sides[0], [-260, 0, 120]);
    b.add(c.sides[1], [260, 0, 120]);
  });
  st({ title: "Lock the back with the cam locks", detail: "Six in the back. Arrow towards the bolt, then turn them clockwise until tight.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, j.backCams, 0.1));
  st({ title: "Screw the cam bolts into the top and bottom", detail: "Six in each panel, three along each long edge.", tools: ["screwdriver"], kind: "cams", scene: "panels" }, () => {
    layPanels(b, c, ["top", "bottom"]);
    b.fits(CAM_BOLT, [...j.endBolts("top"), ...j.endBolts("bottom")], 0.06);
  });
  st({ title: "Push the top and bottom onto the ends", detail: "Cam bolts facing in, onto the dowels and into the holes in the ends of the sides.", kind: "join" }, () => {
    b.stagger(0.3);
    b.add(c.top, [0, 300, 0]);
    b.add(c.bottom, [0, -300, 0]);
  });
  st({ title: "Turn the cam locks in the sides", detail: "Twelve, three at each end of both sides, until the top and bottom pull tight.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, [...j.endCams("top"), ...j.endCams("bottom")], 0.08));
  feetSteps(b, st, c, feet, false);
}

function feetSteps(b: PlanBuilder, st: Stepper, c: Carcass, feet: "glides" | "castors", hammer: boolean) {
  const j = joints(c);
  if (feet === "glides") {
    st({ title: hammer ? "Tap the glides into the bottom" : "Press the glides into the bottom", detail: hammer ? "One in each corner, tapped gently with the hammer." : "One in each corner hole, pushed in by hand.", tools: hammer ? ["hammer"] : [], kind: "legs" }, () => b.fits(GLIDE, j.glides, 0.15));
  } else {
    st({ title: "Screw the castors onto the bottom", detail: "One in each corner, four screws through each plate.", tools: ["screwdriver"], kind: "legs" }, () => {
      b.fits(CASTOR, j.castors, 0.2);
      b.then(0.1);
      b.fits(CASTOR_SCREW, j.castorScrews, 0.04);
    });
  }
  st({ title: feet === "glides" ? "Stand it up" : "Stand it on its castors", detail: "Tip it up carefully, it is open at the front.", pose: "+y", kind: "standup" }, () => {});
}

/** The 9-drawer unit: back on dowels and cam locks, top on cam locks, bottom screwed on, glides, then the wall strap. */
function carcass9(b: PlanBuilder, st: Stepper, c: Carcass) {
  const j = joints(c);
  st({ title: "Screw the cam bolts into the sides", detail: "Lay the sides on a rug, runners up. Three bolts along the back edge of each.", tools: ["screwdriver"], kind: "cams", scene: "flat", warnings: ["floor"] }, () => {
    layFlat(b, c, true);
    b.fits(CAM_BOLT, j.backBolts, 0.08);
  });
  st({ title: "Tap dowels into the back and stand the sides on it", detail: "Two dowels in each long edge of the back. It lies flat with its cam holes up.", tools: ["hammer"], pose: "+z", kind: "join", warnings: ["floor"] }, () => {
    b.add(c.back, [0, 0, 300]);
    b.then(0.1);
    b.fits(DOWEL, j.backDowels, 0.08);
    b.then(0.15);
    b.stagger(0.25);
    b.add(c.sides[0], [-260, 0, 120]);
    b.add(c.sides[1], [260, 0, 120]);
  });
  st({ title: "Lock the back with the cam locks", detail: "Six in the back, turned clockwise until tight.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, j.backCams, 0.1));
  st({ title: "Screw the cam bolts into the top", detail: "Six, three along each long edge.", tools: ["screwdriver"], kind: "cams", scene: "panels" }, () => {
    layPanels(b, c, ["top"]);
    b.fits(CAM_BOLT, j.endBolts("top"), 0.08);
  });
  st({ title: "Fit the top on dowels", detail: "Four dowels in the top ends of the sides. The notch for the wall strap goes at the back.", tools: ["hammer"], kind: "join" }, () => {
    b.fits(DOWEL, j.sideDowels("top"), 0.08);
    b.then(0.15);
    b.add(c.top, [0, 300, 0]);
  });
  st({ title: "Turn the cam locks in the sides", detail: "Six, three at the top of each side.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, j.endCams("top"), 0.1));
  st({ title: "Fit the bottom on dowels", detail: "Four dowels in the bottom ends of the sides.", tools: ["hammer"], kind: "join" }, () => {
    b.fits(DOWEL, j.sideDowels("bottom"), 0.08);
    b.then(0.15);
    b.add(c.bottom, [0, -300, 0]);
  });
  st({ title: "Screw the bottom to the sides", detail: "Six long screws, three into each side, with the Allen key.", tools: ["allen"], kind: "screws" }, () => b.fits(FRAME_SCREW, j.bottomScrews, 0.1));
  feetSteps(b, st, c, "glides", true);
  // the wall strap, before the drawers go in
  const { g, top, yTop } = c;
  const H = g.y0 + g.Hc;
  st({ title: "Mark the wall at the top of the unit", detail: "Stand it where it will go and draw a line on the wall along its top.", tools: ["pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {});
  st({ title: "Screw the strap to the wall", detail: "Five centimetres under the line, in the middle. Wall screws and plugs aren't included: use ones made for your wall.", tools: ["drill", "screwdriver"], kind: "anchor", wall: true, warnings: ["wall"] }, () => {
    const at: Vec3 = [0, H - 50, -g.D / 2 - 1];
    b.fit(WALL_PLUG, { at, dir: [0, 0, -1] });
    b.then(0.1);
    b.fit(STRAP, { at: [0, H - 50, -g.D / 2 - 2], dir: [0, 0, -1], hole: false });
    b.then(0.1);
    b.fit(WALL_SCREW, { at: [0, H - 50, -g.D / 2 + 4], dir: [0, 0, -1] });
  });
  st({ title: "Hook the strap into the top and screw it", detail: "Push the strap through the slot at the back of the top, then one screw from inside, up into the top.", tools: ["screwdriver"], kind: "anchor", wall: true, warnings: ["tip"] }, () => {
    b.fit(STRAP_SCREW, { on: top, at: [0, yTop, -g.D / 2 + 45], dir: [0, 1, 0] });
  });
}

/** The wide unit on castors (67 x 66): back between the sides standing up, top on cam locks, bottom screwed on lying down. */
function carcass6(b: PlanBuilder, st: Stepper, c: Carcass) {
  const j = joints(c);
  st({ title: "Screw the cam bolts into the sides", detail: "Lay the sides on a rug, runners up. Three bolts along the back edge of each.", tools: ["screwdriver"], kind: "cams", scene: "flat", warnings: ["floor"] }, () => {
    layFlat(b, c, true);
    b.fits(CAM_BOLT, j.backBolts, 0.08);
  });
  st({ title: "Tap the dowels into the ends", detail: "Two in each end of both sides and one in each end of the back: twelve in all.", tools: ["hammer"], kind: "dowels", scene: "flat" }, () => {
    b.fits(DOWEL, [...j.endDowels("top"), ...j.endDowels("bottom")], 0.05);
  });
  st({ title: "Stand the back between the sides", detail: "Upright on the rug. The bolts in the sides go into the holes in the edges of the back.", kind: "join", warnings: ["floor"] }, () => {
    b.stagger(0.3);
    b.add(c.sides[0], [-200, 0, 0]);
    b.add(c.back, [0, 0, -300]);
    b.add(c.sides[1], [200, 0, 0]);
  });
  st({ title: "Lock the back with the cam locks", detail: "Six, from the inside of the back, turned clockwise.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, j.backCams, 0.1));
  st({ title: "Screw the short cam bolts into the top", detail: "Six, three along each side edge.", tools: ["screwdriver"], kind: "cams", scene: "panels" }, () => {
    layPanels(b, c, ["top"]);
    b.fits(SHORT_BOLT, j.endBolts("top"), 0.08);
  });
  st({ title: "Put the top on and lock it", detail: "Holes down, onto the dowels. Six cam locks in the sides.", tools: ["screwdriver"], kind: "cams" }, () => {
    b.add(c.top, [0, 300, 0]);
    b.then(0.15);
    b.fits(CAM, j.endCams("top"), 0.1);
  });
  st({ title: "Lay it on its back and screw on the bottom", detail: "Six long screws through the bottom into the sides, with the Allen key.", tools: ["allen"], pose: "+z", kind: "screws", warnings: ["floor"] }, () => {
    b.add(c.bottom, [0, -300, 0]);
    b.then(0.15);
    b.fits(FRAME_SCREW, j.bottomScrews, 0.1);
  });
  feetSteps(b, st, c, "castors", false);
}

/* ---------- the drawers ---------- */

interface Drawer {
  s: Slot;
  front: string;
  sides: [string, string];
  bottom: string;
  back: string;
}

export function drawerParts(b: PlanBuilder, slots: Slot[], oneKind: boolean) {
  const types = new Map<string, string>();
  const type = (name: string, size: Vec3, fiber = false) => {
    const k = name + size.join("x");
    if (!types.has(k)) types.set(k, b.part(name, size, fiber ? { material: "fiber" } : {}));
    return types.get(k)!;
  };
  const label = (kind: Kind) => (oneKind ? "Drawer" : kind === "deep" ? "Deep drawer" : "Shallow drawer");
  return slots.map((s): Drawer => {
    const n = label(s.kind);
    const xs = s.bw / 2 - 6;
    const zc = (s.zf + s.zb) / 2;
    return {
      s,
      front: b.place(type(`${n} front`, [s.ow - 3, s.fh, TF]), [s.cx, s.fy, s.zf + TF / 2]),
      sides: [-1, 1].map((g) => b.place(type(`${n} side`, [12, s.bh, s.bd]), [s.cx + g * xs, s.yb + s.bh / 2, zc])) as [string, string],
      bottom: b.place(type(`${n} bottom`, [s.bw - 24, 4, s.bd], true), [s.cx, s.yb + 10, zc]),
      back: b.place(type(`${n} back`, [s.bw - 24, s.bh - 12, 12]), [s.cx, s.yb + 12 + (s.bh - 12) / 2, s.zb + 6]),
    };
  });
}

function drawerFits(d: Drawer) {
  const { s } = d;
  const cx = s.cx;
  const xs = s.bw / 2 - 6;
  const per = (fn: (g: number, side: string) => FitOpts[]) => [-1, 1].flatMap((g) => fn(g, d.sides[g < 0 ? 0 : 1]));
  const ys = s.kind === "deep" ? [s.yb + s.bh * 0.25, s.yb + s.bh * 0.75] : [s.yb + s.bh * 0.68];
  return {
    bolts: per((g, sd) => ys.map((y): FitOpts => ({ on: d.front, at: [cx + g * xs, y, s.zf], dir: [0, 0, 1], mate: sd, mateHole: 4 }))),
    dowels: s.kind === "deep" ? [] : per((g, sd) => [{ on: sd, at: [cx + g * xs, s.yb + s.bh * 0.3, s.zf], dir: [0, 0, 1], mate: d.front }]),
    cams: per((g, sd) => ys.map((y): FitOpts => ({ on: sd, at: [cx + g * (s.bw / 2), y, s.zf - 28], dir: [-g, 0, 0] }))),
    ribbed: per((g, sd) => [0.3, 0.75].map((k): FitOpts => ({ on: sd, at: [cx + g * (s.bw / 2), s.yb + 12 + (s.bh - 12) * k, s.zb + 6], dir: [-g, 0, 0], mate: d.back }))),
    stops: per((g, sd) => [{ on: sd, at: [cx + g * xs, s.yb + s.bh, s.zb + 30], dir: [0, -1, 0] }]),
  };
}

/** One drawer of a kind built on its front in a scene of its own, the others of that kind the same way. */
export function drawerSteps(b: PlanBuilder, st: Stepper, ds: Drawer[], kind: Kind, o: { boltsFirst?: boolean; oneKind?: boolean; cam?: HwDef }) {
  const all = ds.filter((d) => d.s.kind === kind);
  if (!all.length) return;
  const d0 = all[0];
  const f = drawerFits(d0);
  const rep = all.length > 1 ? all.length : undefined;
  const scene = `drawer-${kind}`;
  const c0: Vec3 = [d0.s.cx, d0.s.yb + d0.s.bh / 2, (d0.s.zf + d0.s.zb) / 2];
  const rel = (k: string): Vec3 => {
    const it = b.partItem(k);
    return [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]];
  };
  const stage = (k: string, from: Vec3) => b.stage(k, rel(k), b.partItem(k).final.rot, from);
  const word = o.oneKind ? "drawer" : `${kind} drawer`;
  const dst = (s: Omit<StepIn, "scene" | "pose" | "repeat">, body: () => void) => st({ ...s, scene, pose: "-z", repeat: rep }, body);
  const shallow = kind === "shallow";
  if (shallow && !o.boltsFirst) {
    dst({ title: `Tap a dowel into each ${word} side`, detail: "Into the hole in the front end, next to the groove.", tools: ["hammer"], kind: "dowels" }, () => {
      b.stagger(0.25);
      for (const sd of d0.sides) b.stage(sd, [rel(sd)[0] * 2.2, rel(sd)[1], rel(sd)[2]], [0, 0, 0], [0, 160, 0]);
      b.then(0.15);
      b.fits(DOWEL, f.dowels, 0.15);
    });
  }
  dst({ title: `Screw the cam bolts into the ${word} front`, detail: `Lay the front face down on the rug. ${f.bolts.length === 4 ? "Four bolts, two at each end." : "One bolt at each end."}`, tools: ["screwdriver"], kind: "cams", warnings: ["face"] }, () => {
    stage(d0.front, [0, 0, -160]);
    b.then(0.15);
    b.fits(CAM_BOLT, f.bolts, 0.12);
  });
  dst(
    { title: "Push the sides onto the front", detail: shallow && o.boltsFirst ? "Tap a dowel into the front end of each side first. Grooves facing in." : "Grooves facing in, onto the bolts and dowels.", tools: shallow && o.boltsFirst ? ["hammer"] : [], kind: "join" },
    () => {
      if (shallow && o.boltsFirst) {
        b.stagger(0.25);
        for (const sd of d0.sides) b.stage(sd, [rel(sd)[0] * 2.2, rel(sd)[1], rel(sd)[2]], [0, 0, 0], [0, 160, 0]);
        b.then(0.15);
        b.fits(DOWEL, f.dowels, 0.15);
        b.then(0.15);
      }
      b.stagger(0.25);
      for (const sd of d0.sides) stage(sd, [0, 0, -280]);
    },
  );
  dst({ title: "Lock the sides with the cam locks", detail: `${f.cams.length === 4 ? "Four" : "Two"}, from the outsides, turned clockwise until tight.`, tools: ["screwdriver"], kind: "cams" }, () => b.fits(o.cam ?? DRAWER_CAM, f.cams, 0.15));
  dst({ title: "Slide the bottom down the grooves", detail: "Smooth side up, all the way down to the front.", kind: "drawer" }, () => stage(d0.bottom, [0, 0, -420]));
  dst({ title: "Drop the back in", detail: "Down between the sides, onto the bottom.", kind: "drawer" }, () => stage(d0.back, [0, 0, -300]));
  dst({ title: "Hammer the ribbed dowels through the sides", detail: "Two through each side into the ends of the back, until the heads are flush.", tools: ["hammer"], kind: "dowels" }, () => b.fits(RIBBED, f.ribbed, 0.12));
}

export function drawersIn(b: PlanBuilder, st: Stepper, ds: Drawer[], order: Kind[], o: { tip?: boolean } = {}) {
  const firsts = new Set(order.map((k) => ds.find((d) => d.s.kind === k)).filter((d): d is Drawer => !!d));
  const anyShallow = ds.some((d) => d.s.kind === "shallow") && ds.some((d) => d.s.kind === "deep");
  st(
    {
      title: ds.length > 1 ? "Slide the drawers in" : "Slide the drawer in",
      detail: anyShallow ? "Shallow ones at the top. Pull the runners out, set the drawer on them and push it home." : "Pull the runners out, set the drawer on them and push it home.",
      pose: "+y",
      kind: "drawer",
      warnings: o.tip ? ["tip"] : [],
    },
    () => {
      for (const d of ds) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 480]);
        if (!firsts.has(d)) {
          const f = drawerFits(d);
          for (const [def, list] of [[CAM_BOLT, f.bolts], [DOWEL, f.dowels], [DRAWER_CAM, f.cams], [RIBBED, f.ribbed]] as [HwDef, FitOpts[]][]) for (const fo of list) b.preset(def, fo);
        }
        b.wait(0.2);
      }
    },
  );
  st({ title: "Fit the drawer stops", detail: `Pull each drawer out and turn two small screws into the tops of its sides at the back: ${ds.length * 2} in all.`, tools: ["screwdriver"], kind: "drawer" }, () => {
    b.fits(STOP, ds.flatMap((d) => drawerFits(d).stops), 0.05);
  });
}

/* ---------- the storage unit's door and shelf ---------- */

function doorAndShelf(b: PlanBuilder, st: Stepper, c: Carcass) {
  const { g, sides, xi, yTop, yBot } = c;
  const zf = g.D / 2;
  const door = b.place(b.part("Door", [2 * xi - 3, yTop - yBot - 3, TF]), [0, (yTop + yBot) / 2, zf - TF / 2]);
  const shelf = b.place(b.part("Shelf", [2 * xi - 2, T, g.D - T - TF - 20]), [0, (yTop + yBot) / 2 - 20, (-g.D / 2 + T + zf - TF) / 2 - 5]);
  const hy = [yBot + 90, yTop - 90];
  st({ title: "Screw the mounting plates inside the left side", detail: "Two plates near the front edge, two screws each. Use the right side instead to hang the door the other way.", tools: ["screwdriver"], kind: "hinges" }, () => {
    b.fits(PLATE, hy.map((y): FitOpts => ({ on: sides[0], at: [-xi, y, zf - 37], dir: [-1, 0, 0], hole: false })), 0.2);
    b.then(0.1);
    b.fits(PLATE_SCREW, hy.flatMap((y) => [-16, 16].map((e): FitOpts => ({ on: sides[0], at: [-xi, y + e, zf - 37], dir: [-1, 0, 0] }))), 0.1);
  });
  st({ title: "Screw the hinges onto the door", detail: "Lay the door face down. Cup in its hole, two screws each.", tools: ["screwdriver"], kind: "hinges", scene: "door", warnings: ["face"] }, () => {
    b.stage(door, [0, TF / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.15);
    const hx = -xi + 1.5 + 22;
    b.fits(HINGE, hy.map((y): FitOpts => ({ on: door, at: [hx, y, zf - TF], dir: [0, 0, 1], hole: 17 })), 0.2);
    b.then(0.1);
    b.fits(HINGE_SCREW, hy.flatMap((y) => [-22, 22].map((e): FitOpts => ({ on: door, at: [hx + 24, y + e, zf - TF], dir: [0, 0, 1] }))), 0.1);
  });
  st({ title: "Clip the door onto the plates", detail: "Hook each hinge on at the front and press until it clicks. Adjust the screws on the hinges until the gaps are even.", tools: ["screwdriver"], kind: "doors" }, () => b.add(door, [-200, 0, 300]));
  st({ title: "Stick the pads under the shelf", detail: "Four, one near each corner of its underside, about 7 cm in from the ends.", kind: "shelves", scene: "shelf" }, () => {
    b.stage(shelf, [0, T / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
    b.then(0.15);
    const sp = b.partItem(shelf).final.pos;
    const sd = g.D - T - TF - 20;
    b.fits(PAD, [-1, 1].flatMap((sx) => [-1, 1].map((sz): FitOpts => ({ on: shelf, at: [sx * (xi - 30), sp[1] - T / 2, sp[2] + sz * (sd / 2 - 70)], dir: [0, 1, 0], hole: false }))), 0.15);
  });
  st({ title: "Push in the shelf pins and lay the shelf on them", detail: "Pick a height, the same row of holes at all four corners.", kind: "shelves" }, () => {
    const sp = b.partItem(shelf).final.pos;
    const sd = g.D - T - TF - 20;
    b.fits(SHELF_PIN, [0, 1].flatMap((i) => [-1, 1].map((sz): FitOpts => ({ on: sides[i], at: [(i === 0 ? -1 : 1) * xi, sp[1] - T / 2 - 3, sp[2] + sz * (sd / 2 - 40)], dir: [i === 0 ? -1 : 1, 0, 0] }))), 0.12);
    b.then(0.15);
    b.add(shelf, [0, 0, 400]);
  });
}

/* ---------- the desk ---------- */

const SHORT_BOLT_DESK = SHORT_BOLT;
const RUNNER_SCREW: HwDef = { kind: "screw", len: 11, dia: 6, name: "Runner screw" };
const FLAP_PLATE: HwDef = { kind: "plate", len: 10, dia: 40, name: "Flap mounting plate" };
const GROMMET: HwDef = { kind: "cap", len: 15, dia: 60, name: "Cable grommet" };

/**
 * The desk: two drawers first, then the box built upside down on its top (divider, end panels and back rail on
 * dowels and cam locks, the lower panel screwed on), the steel frame put together standing and screwed on upside
 * down, then turned over for the grommets, the cable trough boards, the hinged flap and the drawers.
 */
function buildDesk(b: PlanBuilder, st: Stepper, W: number, D: number, H: number) {
  const yL = 620; // underside of the box: the room under the desk
  const yI = yL + T, yU = H - T; // inside of the box
  const ih = yU - yI;
  const F = 90; // the cable trough along the back, under the flap
  const zT = -D / 2 + F; // back edge of the top, front of the trough
  const xE = W / 2 - T / 2;
  const sgs = [-1, 1];

  // the box
  const top = b.place(b.part("Top", [W, T, D - F]), [0, H - T / 2, F / 2]);
  const lower = b.place(b.part("Lower panel", [W, T, D]), [0, yL + T / 2, 0]);
  const endT = b.part("End panel", [T, ih, D]);
  const ends = sgs.map((g) => b.place(endT, [g * xE, yI + ih / 2, 0]));
  const backRail = b.place(b.part("Back rail", [W - 2 * T, ih, T]), [0, yI + ih / 2, -D / 2 + T / 2]);
  const divD = D - F;
  const divider = b.place(b.part("Divider", [T, ih, divD]), [0, yI + ih / 2, zT + divD / 2]);
  const bwd = (W - 3 * T) / 2;
  const boardT = b.part("Trough board", [bwd - 2, ih - 6, T]);
  const boards = sgs.map((g) => b.place(boardT, [g * (W / 4 + T / 4), yI + (ih - 6) / 2, zT - T / 2]));
  const notch = 220, nd = 25;
  const flapD = F - 3;
  const fy = H - T / 2, fz = -D / 2 + flapD / 2;
  const flapC = b.compound("Flap", [
    { shape: "box", size: [(W - 4 - notch) / 2, T, flapD], pos: [-(W - 4 + notch) / 4, fy, fz] },
    { shape: "box", size: [(W - 4 - notch) / 2, T, flapD], pos: [(W - 4 + notch) / 4, fy, fz] },
    { shape: "box", size: [notch, T, flapD - nd], pos: [0, fy, fz - nd / 2] },
  ]);
  const flap = b.place(flapC.type, flapC.mid);

  // the frame
  const fx = W / 2 - 40, fzz = D / 2 - 40, bar = 25;
  const yTopBar = yL - bar / 2, yLowBar = 160;
  const legH = yL - bar - (yLowBar + bar / 2);
  const legFrame = b.compound("Leg frame", [
    ...sgs.map((g): PartPiece => ({ shape: "box", size: [bar, legH, bar], pos: [0, yLowBar + bar / 2 + legH / 2, g * fzz], material: "metal" })),
    { shape: "box", size: [bar, bar, 2 * fzz + bar], pos: [0, yTopBar, 0], material: "metal" },
  ], { material: "metal" });
  const legs = sgs.map((g) => b.place(legFrame.type, [g * fx + legFrame.mid[0], legFrame.mid[1], legFrame.mid[2]]));
  const stub = yLowBar - bar / 2;
  const base = b.compound("Base frame", [
    ...sgs.map((g): PartPiece => ({ shape: "box", size: [bar, bar, 2 * fzz + bar], pos: [g * fx, yLowBar, 0], material: "metal" })),
    { shape: "box", size: [2 * fx - bar, bar, bar], pos: [0, yLowBar, 0], material: "metal" },
    ...sgs.flatMap((gx) => sgs.map((gz): PartPiece => ({ shape: "box", size: [bar, stub, bar], pos: [gx * fx, stub / 2, gz * fzz], material: "metal" }))),
  ], { material: "metal" });
  const baseK = b.place(base.type, base.mid);
  const rail = b.place(b.part("Top rail", [2 * fx - bar, bar, bar], { material: "metal" }), [0, yTopBar, -fzz]);

  // the drawers, one in each half
  const slots: Slot[] = sgs.map((g, i) => {
    const fh = ih - 3;
    const bh = Math.round(fh - 40);
    const bw = bwd - 26;
    const bd = Math.round((D - F - T - TF - 20) / 10) * 10;
    return { i, kind: "shallow" as Kind, cx: g * (W / 4 + T / 4), ow: bwd, top: yU, fy: yI + ih / 2, fh, yb: yI + 10, bh, bw, bd, zf: D / 2 - TF, zb: D / 2 - TF - bd };
  });
  const ds = drawerParts(b, slots, true);
  drawerSteps(b, st, ds, "shallow", { boltsFirst: true, oneKind: true });

  // the box, upside down on its top
  const zDiv = [zT + T + 60, D / 2 - 60];
  const zEnd = [-D / 4, D / 4];
  st({ title: "Lay the top face down and screw in the short cam bolts", detail: "On a rug. Six: two down the middle for the divider and two at each end.", tools: ["screwdriver"], pose: "-y", kind: "cams", warnings: ["floor", "face"] }, () => {
    b.add(top, [0, -300, 0]);
    b.then(0.15);
    b.fits(SHORT_BOLT_DESK, [...zDiv.map((z): FitOpts => ({ on: top, at: [0, yU, z], dir: [0, 1, 0], mate: divider, mateHole: 4 })), ...sgs.flatMap((g) => zEnd.map((z): FitOpts => ({ on: top, at: [g * xE, yU, z], dir: [0, 1, 0], mate: ends[g < 0 ? 0 : 1], mateHole: 4 })))], 0.1);
  });
  const ry = yI + 22;
  const rz = (slots[0].zf + slots[0].zb) / 2;
  const runLen = slots[0].bd - 20;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 20 };
  const runnerFits = (on: string, x: number, into: number) => ({
    r: { on, at: [x, ry, rz] as Vec3, dir: [into, 0, 0] as Vec3, hole: false as const },
    s: [rz + runLen / 2 - 30, rz - runLen / 2 + 30].map((z): FitOpts => ({ on, at: [x - into * 5, ry, z], dir: [into, 0, 0] })), // through the runner's thin flange
  });
  const divRun = sgs.map((g) => runnerFits(divider, g * (T / 2), -g));
  const endRun = sgs.map((g, i) => runnerFits(ends[i], g * (W / 2 - T), g));
  st({ title: "Screw a runner onto each face of the divider", detail: "Two screws in each, the open end of the runner to the front. Turn the divider over for the second one.", tools: ["screwdriver"], kind: "runners", scene: "divider" }, () => {
    b.stage(divider, [0, T / 2, 0], [0, 0, Math.PI / 2], [0, 160, 0]);
    b.then(0.15);
    b.fits(RUNNER, divRun.map((r) => r.r), 0.25);
    b.then(0.1);
    b.fits(RUNNER_SCREW, divRun.flatMap((r) => r.s), 0.08);
  });
  st({ title: "Stand the divider on the top", detail: "Two dowels in its edge, then onto the bolts down the middle of the top.", tools: ["hammer"], kind: "join" }, () => {
    b.fits(DOWEL, [zT + T + 150, D / 2 - 150].map((z): FitOpts => ({ on: divider, at: [0, yU, z], dir: [0, -1, 0], mate: top })), 0.12);
    b.then(0.15);
    b.add(divider, [0, -250, 0]);
  });
  st({ title: "Lock the divider", detail: "Two cam locks, turned clockwise.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, zDiv.map((z): FitOpts => ({ on: divider, at: [T / 2, yU - 25, z], dir: [-1, 0, 0] })), 0.15));
  st({ title: "Screw a runner inside each end panel", detail: "Two screws in each, the open end to the front.", tools: ["screwdriver"], kind: "runners", scene: "ends" }, () => {
    b.stagger(0.2);
    sgs.forEach((g, i) => b.stage(ends[i], [g * (ih / 2 + 40), T / 2, 0], [0, 0, g < 0 ? Math.PI / 2 : -Math.PI / 2], [0, 160, 0]));
    b.then(0.15);
    b.fits(RUNNER, endRun.map((r) => r.r), 0.25);
    b.then(0.1);
    b.fits(RUNNER_SCREW, endRun.flatMap((r) => r.s), 0.08);
  });
  const px = [-W / 4, W / 4];
  st({ title: "Fit the flap plates on the back rail", detail: "Push both plates into their holes along the top edge and tighten their screws.", tools: ["screwdriver"], kind: "hinges", scene: "rail" }, () => {
    b.stage(backRail, [0, T / 2, 0], [-Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(FLAP_PLATE, px.map((x): FitOpts => ({ on: backRail, at: [x, yU - 20, -D / 2 + T], dir: [0, 0, -1], hole: false })), 0.2);
  });
  st({ title: "Tap dowels into the back rail and lay it on the top", detail: "Two dowels in each end of the rail, then set it along the back edge of the top.", tools: ["hammer"], kind: "dowels" }, () => {
    b.fits(DOWEL, sgs.flatMap((g) => [yI + ih * 0.3, yI + ih * 0.7].map((y): FitOpts => ({ on: backRail, at: [g * (W / 2 - T), y, -D / 2 + T / 2], dir: [-g, 0, 0], mate: ends[g < 0 ? 0 : 1] }))), 0.1);
    b.then(0.15);
    b.add(backRail, [0, -250, 0]);
  });
  st({ title: "Push the end panels onto the back rail", detail: "Onto its dowels from each side.", kind: "join" }, () => {
    b.stagger(0.25);
    b.add(ends[0], [-250, -150, 0]);
    b.add(ends[1], [250, -150, 0]);
  });
  st({ title: "Set them on the top on dowels", detail: "Four dowels in the edges of the end panels. Then four cam locks, turned clockwise.", tools: ["hammer", "screwdriver"], kind: "cams" }, () => {
    b.fits(DOWEL, sgs.flatMap((g) => zEnd.map((z): FitOpts => ({ on: ends[g < 0 ? 0 : 1], at: [g * xE, yU, z + 50], dir: [0, -1, 0], mate: top }))), 0.1);
    b.then(0.15);
    b.fits(CAM, sgs.flatMap((g) => zEnd.map((z): FitOpts => ({ on: ends[g < 0 ? 0 : 1], at: [g * (W / 2 - T), yU - 25, z], dir: [g, 0, 0] }))), 0.12);
  });
  st({ title: "Tap the dowels in for the lower panel", detail: "Eight, along the edges facing up: two in each end panel, the back rail and the divider.", tools: ["hammer"], kind: "dowels" }, () => {
    b.fits(DOWEL, [
      ...sgs.flatMap((g) => zEnd.map((z): FitOpts => ({ on: ends[g < 0 ? 0 : 1], at: [g * xE, yI, z], dir: [0, 1, 0], mate: lower }))),
      ...px.map((x): FitOpts => ({ on: backRail, at: [x + 60, yI, -D / 2 + T / 2], dir: [0, 1, 0], mate: lower })),
      ...[zT + T + 150, D / 2 - 150].map((z): FitOpts => ({ on: divider, at: [0, yI, z], dir: [0, 1, 0], mate: lower })),
    ], 0.06);
  });
  st({ title: "Put the lower panel on and screw it to the divider", detail: "One long screw through the middle, with the Allen key.", tools: ["allen"], kind: "screws" }, () => {
    b.add(lower, [0, -300, 0]);
    b.then(0.15);
    b.fit(FRAME_SCREW, { on: lower, at: [0, yL, (zT + D / 2) / 2 + T / 2], dir: [0, 1, 0], mate: divider });
  });

  // the frame, standing
  st({ title: "Push the leg frames into the base frame", detail: "Four legs into the sockets, pressed down until they click.", kind: "legs", scene: "frame" }, () => {
    b.stage(baseK, b.partItem(baseK).final.pos, [0, 0, 0], [0, 120, 0]);
    b.then(0.15);
    b.stagger(0.3);
    for (const k of legs) b.stage(k, b.partItem(k).final.pos, [0, 0, 0], [0, 260, 0]);
  });
  st({ title: "Click the top rail in at the back", detail: "Between the tops of the leg frames, the right way round so its ends lock in.", kind: "legs", scene: "frame" }, () => {
    b.stage(rail, b.partItem(rail).final.pos, [0, 0, 0], [-300, 0, 0]);
  });
  st({ title: "Turn the frame over onto the box", detail: "Upside down onto the lower panel, the top rail at the back.", kind: "join", people: 2 }, () => {
    b.stagger(0.05);
    for (const k of [baseK, ...legs, rail]) b.add(k, [0, -700, 0]);
  });
  const zs3 = [-fzz + 40, 0, fzz - 40];
  st({ title: "Screw the frame to the box", detail: "Seven long screws, three through each top bar and one through the rail, with the Allen key.", tools: ["allen"], kind: "screws" }, () => {
    b.fits(FRAME_SCREW, [...sgs.flatMap((g, i) => zs3.map((z): FitOpts => ({ on: legs[i], at: [g * fx, yL - bar, z], dir: [0, 1, 0], mate: lower }))), { on: rail, at: [0, yL - bar, -fzz], dir: [0, 1, 0], mate: lower }], 0.1);
  });
  st({ title: "Turn the desk over and press in the grommets", detail: "Two, in the holes at the back of the top.", pose: "+y", kind: "general", people: 2 }, () => {
    b.fits(GROMMET, sgs.map((g): FitOpts => ({ on: top, at: [g * (W / 2 - 80), H, zT + 50], dir: [0, -1, 0], hole: 30 })), 0.2);
  });
  st({ title: "Drop the trough boards in", detail: "Two dowels in the bottom edge of each, then down into the trough behind the drawers.", tools: ["hammer"], kind: "join" }, () => {
    b.fits(DOWEL, boards.flatMap((k, i) => [-1, 1].map((e): FitOpts => ({ on: k, at: [sgs[i] * (W / 4 + T / 4) + e * (bwd / 2 - 70), yI, zT - T / 2], dir: [0, 1, 0], mate: lower }))), 0.1);
    b.then(0.15);
    b.stagger(0.3);
    for (const k of boards) b.add(k, [0, 300, 0]);
  });
  st({ title: "Screw the hinges under the flap", detail: "Lay the flap face down. Cup in its hole, two screws each.", tools: ["screwdriver"], kind: "hinges", scene: "flap", warnings: ["face"] }, () => {
    b.stage(flap, [0, T / 2, 0], [Math.PI, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(HINGE, px.map((x): FitOpts => ({ on: flap, at: [x, yU, -D / 2 + 30], dir: [0, 1, 0], hole: 17 })), 0.2);
    b.then(0.1);
    b.fits(HINGE_SCREW, px.flatMap((x) => [-22, 22].map((e): FitOpts => ({ on: flap, at: [x + e, yU, -D / 2 + 55], dir: [0, 1, 0] }))), 0.1);
  });
  st({ title: "Clip the flap onto the plates", detail: "Hook each hinge on and press until it clicks. The screws on the hinges line it up with the top.", tools: ["screwdriver"], kind: "doors" }, () => b.add(flap, [0, 260, -200]));
  drawersIn(b, st, ds, ["shallow"]);
}

/* ---------- the small unit on castors (36 x 50) ---------- */

const SMALL_CAM: HwDef = { kind: "cam", len: 10, dia: 12, name: "Small cam lock" };
const BIG_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 10, name: "Thick dowel" };
const DRAWER_CASTOR: HwDef = { kind: "castor", len: 88, dia: 45, name: "Drawer castor" };

/**
 * Built lying on its left side: the back and two floor rails stand in it on dowels and cam locks, the right side
 * goes on top, then it is stood up for the top and laid on its back for the castors. A shallow drawer at the top and
 * a deep file drawer with its own castor under the front.
 */
function buildSmall(b: PlanBuilder, st: Stepper, W: number, D: number, H: number) {
  const y0 = 60;
  const Hc = H - y0;
  const inner = Hc - 2 * T;
  const g: Unit = { W, D, Hc, y0, slots: ["shallow", "deep"], pitch: { shallow: 100, deep: inner - 100 } };
  const c = carcassParts(b, g, { noBottom: true });
  const { sides, back, top, xi, yTop, yBot } = c;
  const sgs = [-1, 1];
  const railT = b.part("Floor rail", [2 * xi, T, 80]);
  const zRail = [-D / 2 + 40, D / 2 - TF - 100];
  const rails = zRail.map((z) => b.place(railT, [0, y0 + T / 2, z]));
  const [sl, sd] = slotsOf(g);

  // the shallow drawer from the common parts, the file drawer drawn here
  const ds = drawerParts(b, [sl], true);
  const zf = D / 2 - TF;
  const fTop = sl.top - sl.fh - 4.5;
  const fh = fTop - (y0 + 3);
  const bw = sd.bw, bd = sd.bd, bh = sd.bh, yb = sd.yb;
  const zc = zf - bd / 2;
  const xs = bw / 2 - 6;
  const fFront = b.place(b.part("File drawer front", [2 * xi - 3, fh, TF]), [0, y0 + 3 + fh / 2, zf + TF / 2]);
  const fSideT = b.part("File drawer side", [12, bh, bd]);
  const fSides = sgs.map((g2) => b.place(fSideT, [g2 * xs, yb + bh / 2, zc]));
  const fRail = b.place(b.part("File drawer rail", [bw - 24, 40, 30]), [0, yb + 12 + 20, zf - 15]);
  const fBottom = b.place(b.part("File drawer bottom", [bw - 24, 4, bd], { material: "fiber" }), [0, yb + 10, zc]);
  const fBack = b.place(b.part("File drawer back", [bw - 24, bh - 12, 12]), [0, yb + 12 + (bh - 12) / 2, zf - bd + 6]);

  const yBk = [yBot + 80, yTop - 80];
  const zBack = -D / 2 + T / 2;
  const bolts: FitOpts[] = [0, 1].flatMap((i) => [
    ...yBk.map((y): FitOpts => ({ on: sides[i], at: [sgs[i] * xi, y, zBack], dir: [-sgs[i], 0, 0], mate: back, mateHole: 4 })),
    ...zRail.map((z, r): FitOpts => ({ on: sides[i], at: [sgs[i] * xi, y0 + T / 2, z], dir: [-sgs[i], 0, 0], mate: rails[r], mateHole: 4 })),
  ]);
  const backCams = (i: number) => yBk.map((y): FitOpts => ({ on: back, at: [sgs[i] * (xi - 25), y, zBack + T / 2], dir: [0, 0, -1] }));
  const railCams = (i: number) => rails.map((k, r): FitOpts => ({ on: k, at: [sgs[i] * (xi - 25), y0 + T, zRail[r]], dir: [0, -1, 0] }));
  const zTop = [-D / 4, D / 4];

  st({ title: "Screw the cam bolts into the sides", detail: "Lay both sides on a rug, runners up. Four in each: two at the back edge and two along the bottom.", tools: ["screwdriver"], kind: "cams", scene: "flat", warnings: ["floor"] }, () => {
    layFlat(b, c, false);
    b.fits(CAM_BOLT, bolts, 0.08);
  });
  st({ title: "Tap the dowels into the tops of the sides", detail: "Two in the top edge of each side.", tools: ["hammer"], kind: "dowels", scene: "flat" }, () => {
    b.fits(DOWEL, [0, 1].flatMap((i) => zTop.map((z): FitOpts => ({ on: sides[i], at: [sgs[i] * (W / 2 - T / 2), yTop, z], dir: [0, -1, 0], mate: top }))), 0.1);
  });
  st({ title: "Stand the back in the left side", detail: "Lay the left side down, runners up. Four dowels in the long edges of the back, then onto the bolts.", tools: ["hammer"], pose: "+x", kind: "join", warnings: ["floor"] }, () => {
    b.add(sides[0], [-300, 0, 0]);
    b.then(0.15);
    b.fits(DOWEL, [0, 1].flatMap((i) => [yBot + 140, yTop - 140].map((y): FitOpts => ({ on: back, at: [sgs[i] * xi, y, zBack], dir: [sgs[i], 0, 0], mate: sides[i] }))), 0.08);
    b.then(0.15);
    b.add(back, [300, 0, 0]);
  });
  st({ title: "Lock the back", detail: "Two small cam locks, turned clockwise.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(SMALL_CAM, backCams(0), 0.15));
  st({ title: "Tap the thick dowels into the floor rails", detail: "Two in each end of both rails: eight in all.", tools: ["hammer"], kind: "dowels", scene: "rails" }, () => {
    b.stagger(0.2);
    rails.forEach((k, r) => b.stage(k, [0, T / 2, (r - 0.5) * 160], [0, 0, 0], [0, 160, 0]));
    b.then(0.15);
    b.fits(BIG_DOWEL, [0, 1].flatMap((i) => rails.flatMap((k, r) => [-25, 25].map((e): FitOpts => ({ on: k, at: [sgs[i] * xi, y0 + T / 2, zRail[r] + e], dir: [sgs[i], 0, 0], mate: sides[i] })))), 0.06);
  });
  st({ title: "Stand the rails in the side and lock them", detail: "One at the back and one near the front, along the bottom edge. Two big cam locks.", tools: ["screwdriver"], kind: "cams" }, () => {
    b.stagger(0.25);
    for (const k of rails) b.add(k, [300, 0, 0]);
    b.then(0.15);
    b.fits(CAM, railCams(0), 0.15);
  });
  st({ title: "Lay the right side on top", detail: "Runners down, onto the dowels and bolts of the back and rails.", kind: "join" }, () => b.add(sides[1], [400, 0, 0]));
  st({ title: "Lock the rails and the back on this side", detail: "Two big cam locks in the rails and two small ones in the back.", tools: ["screwdriver"], kind: "cams" }, () => {
    b.fits(CAM, railCams(1), 0.15);
    b.then(0.1);
    b.fits(SMALL_CAM, backCams(1), 0.15);
  });
  st({ title: "Screw the short cam bolts into the top", detail: "Four, two along each side edge.", tools: ["screwdriver"], kind: "cams", scene: "panels" }, () => {
    layPanels(b, c, ["top"]);
    b.fits(SHORT_BOLT, sgs.flatMap((g2, i) => zTop.map((z): FitOpts => ({ on: top, at: [g2 * (W / 2 - T / 2), yTop, z + 60], dir: [0, 1, 0], mate: sides[i], mateHole: 4 }))), 0.1);
  });
  st({ title: "Stand it up and put the top on", detail: "Holes down, onto the dowels. Four big cam locks in the sides.", tools: ["screwdriver"], pose: "+y", kind: "cams" }, () => {
    b.add(top, [0, 300, 0]);
    b.then(0.15);
    b.fits(CAM, sgs.flatMap((g2, i) => zTop.map((z): FitOpts => ({ on: sides[i], at: [g2 * (W / 2), yTop - 25, z + 60], dir: [-g2, 0, 0] }))), 0.12);
  });
  st({ title: "Lay it on its back and screw on the castors", detail: "Under the ends of the floor rails, four screws through each plate.", tools: ["screwdriver"], pose: "+z", kind: "legs", warnings: ["floor"] }, () => {
    const at = sgs.flatMap((sx) => rails.map((k, r) => ({ k, p: [sx * (W / 2 - 45), y0, zRail[r]] as Vec3 })));
    b.fits(CASTOR, at.map((a): FitOpts => ({ on: a.k, at: a.p, dir: [0, 1, 0], hole: false })), 0.2);
    b.then(0.1);
    b.fits(CASTOR_SCREW, at.flatMap((a) => [-1, 1].flatMap((ex) => [-1, 1].map((ez): FitOpts => ({ on: a.k, at: [a.p[0] + ex * 16, y0, a.p[2] + ez * 16], dir: [0, 1, 0] })))), 0.04);
  });
  st({ title: "Stand it on its castors", detail: "Tip it up carefully.", pose: "+y", kind: "standup" }, () => {});

  drawerSteps(b, st, ds, "shallow", { boltsFirst: true, oneKind: true, cam: SMALL_CAM });

  // the file drawer, on its front
  const c0: Vec3 = [0, yb + bh / 2, zc];
  const rel = (k: string): Vec3 => {
    const p = b.partItem(k).final.pos;
    return [p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]];
  };
  const stage = (k: string, from: Vec3) => b.stage(k, rel(k), [0, 0, 0], from);
  const fst = (s: Omit<StepIn, "scene">, body: () => void) => st({ pose: "-z", ...s, scene: "file" }, body);
  const ys = [yb + bh * 0.25, yb + bh * 0.75];
  const yr = yb + 32;
  const rx = [-(bw / 4), bw / 4];
  fst({ title: "Screw the cam bolts into the file drawer front", detail: "Lay it face down. Six: two at each end and two low in the middle for the rail.", tools: ["screwdriver"], kind: "cams", warnings: ["face"] }, () => {
    stage(fFront, [0, 0, -160]);
    b.then(0.15);
    b.fits(CAM_BOLT, [
      ...sgs.flatMap((g2, i) => ys.map((y): FitOpts => ({ on: fFront, at: [g2 * xs, y, zf], dir: [0, 0, 1], mate: fSides[i], mateHole: 4 }))),
      ...rx.map((x): FitOpts => ({ on: fFront, at: [x, yr, zf], dir: [0, 0, 1], mate: fRail, mateHole: 4 })),
    ], 0.1);
  });
  fst({ title: "Push the sides onto the front", detail: "Two dowels in the front end of each side first, grooves facing in.", tools: ["hammer"], kind: "join" }, () => {
    b.stagger(0.25);
    for (const k of fSides) b.stage(k, [rel(k)[0] * 2.2, rel(k)[1], rel(k)[2]], [0, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(DOWEL, sgs.flatMap((g2, i) => [yb + bh * 0.4, yb + bh * 0.6].map((y): FitOpts => ({ on: fSides[i], at: [g2 * xs, y, zf], dir: [0, 0, 1], mate: fFront }))), 0.1);
    b.then(0.15);
    for (const k of fSides) stage(k, [0, 0, -280]);
  });
  fst({ title: "Lock the sides", detail: "Four small cam locks, from the outsides.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(SMALL_CAM, sgs.flatMap((g2, i) => ys.map((y): FitOpts => ({ on: fSides[i], at: [g2 * (bw / 2), y, zf - 28], dir: [-g2, 0, 0] }))), 0.12));
  fst({ title: "Fit the rail against the front", detail: "Three dowels in its face, then down between the sides onto the bolts. Two big cam locks.", tools: ["hammer", "screwdriver"], kind: "cams" }, () => {
    b.fits(DOWEL, [-bw / 3, 0, bw / 3].map((x): FitOpts => ({ on: fRail, at: [x, yr + 8, zf], dir: [0, 0, 1], mate: fFront })), 0.1);
    b.then(0.15);
    stage(fRail, [0, 0, -300]);
    b.then(0.15);
    b.fits(CAM, rx.map((x): FitOpts => ({ on: fRail, at: [x, yr + 20, zf - 15], dir: [0, -1, 0] })), 0.15);
  });
  fst({ title: "Slide the bottom down the grooves", detail: "Smooth side up, all the way down to the front.", kind: "drawer" }, () => stage(fBottom, [0, 0, -420]));
  fst({ title: "Put the back on and hammer in the ribbed dowels", detail: "Into the grooves on top of the bottom, then two dowels through each side.", tools: ["hammer"], kind: "dowels" }, () => {
    stage(fBack, [0, 0, -300]);
    b.then(0.15);
    b.fits(RIBBED, sgs.flatMap((g2, i) => [0.3, 0.75].map((k): FitOpts => ({ on: fSides[i], at: [g2 * (bw / 2), yb + 12 + (bh - 12) * k, zf - bd + 6], dir: [-g2, 0, 0], mate: fBack }))), 0.12);
  });
  fst({ title: "Screw the castor under the front", detail: "Stand the drawer on its back. One castor under the rail, four screws.", tools: ["screwdriver"], pose: "+z", kind: "legs" }, () => {
    b.fit(DRAWER_CASTOR, { on: fRail, at: [0, yb + 8, zf - 15], dir: [0, 1, 0], hole: false });
    b.then(0.1);
    b.fits(CASTOR_SCREW, [-1, 1].flatMap((ex) => [-1, 1].map((ez): FitOpts => ({ on: fRail, at: [ex * 16, yb + 8, zf - 15 + ez * 10], dir: [0, 1, 0] }))), 0.06);
  });

  // in they go, each with its stops
  const d0 = ds[0];
  st({ title: "Slide the top drawer in", detail: "Pull the top runners out, set the drawer on them and push it home. Two stop screws at the back.", tools: ["screwdriver"], kind: "drawer" }, () => {
    b.stagger(0);
    for (const k of [d0.front, ...d0.sides, d0.bottom, d0.back]) b.add(k, [0, 0, 480]);
    b.then(0.2);
    b.fits(STOP, drawerFits(d0).stops, 0.1);
  });
  st({ title: "Slide the file drawer in", detail: "Onto the lower runners, its castor on the floor. Two stop screws at the back.", tools: ["screwdriver"], kind: "drawer" }, () => {
    b.stagger(0);
    for (const k of [fFront, ...fSides, fRail, fBottom, fBack]) b.add(k, [0, 0, 480]);
    b.then(0.2);
    b.fits(STOP, fSides.map((k, i): FitOpts => ({ on: k, at: [sgs[i] * xs, yb + bh, zf - bd + 30], dir: [0, -1, 0] })), 0.1);
  });
}

/* ---------- which product ---------- */

function build(b: PlanBuilder, s: ProductSpec) {
  const slug = s.slug ?? "";
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const st = stepper(b);

  // the 5-drawer unit, standing on glides or on castors
  if (/^alex-drawer-unit(-on-castors-36-x-76)?$/.test(slug)) {
    const castors = slug.includes("castors");
    const y0 = castors ? 60 : 0;
    const Hc = H - y0;
    const inner = Hc - 2 * T;
    const sh = 115;
    const g: Unit = { W, D, Hc, y0, slots: ["shallow", "shallow", "deep", "deep", "deep"], pitch: { shallow: sh, deep: (inner - 2 * sh) / 3 } };
    const c = carcassParts(b, g);
    const ds = drawerParts(b, slotsOf(c.g), false);
    carcassA(b, st, c, castors ? "castors" : "glides");
    drawerSteps(b, st, ds, "deep", {});
    drawerSteps(b, st, ds, "shallow", {});
    drawersIn(b, st, ds, ["deep", "shallow"]);
    return true;
  }
  if (slug === "alex-drawer-unit-9-drawers-36-x-116") {
    const inner = H - 2 * T;
    const g: Unit = { W, D, Hc: H, y0: 0, slots: [...range(5).map((): Kind => "shallow"), ...range(4).map((): Kind => "deep")], pitch: { shallow: inner / 10, deep: (inner * 1.25) / 10 } };
    const c = carcassParts(b, g);
    const ds = drawerParts(b, slotsOf(c.g), false);
    carcass9(b, st, c);
    drawerSteps(b, st, ds, "shallow", { boltsFirst: true });
    drawerSteps(b, st, ds, "deep", {});
    drawersIn(b, st, ds, ["shallow", "deep"], { tip: true });
    return true;
  }
  if (slug === "alex-drawer-unit-on-castors-67-x-66") {
    const y0 = 60;
    const Hc = H - y0;
    const g: Unit = { W, D, Hc, y0, slots: range(6).map((): Kind => "shallow"), pitch: { shallow: (Hc - 2 * T) / 6, deep: 0 } };
    const c = carcassParts(b, g);
    const ds = drawerParts(b, slotsOf(c.g), true);
    carcass6(b, st, c);
    drawerSteps(b, st, ds, "shallow", { boltsFirst: true, oneKind: true });
    drawersIn(b, st, ds, ["shallow"]);
    return true;
  }
  if (slug === "alex-drawer-unit-on-castors-36-x-50") {
    buildSmall(b, st, W, D, H);
    return true;
  }
  if (/^alex-desk-/.test(slug)) {
    buildDesk(b, st, W, D, H);
    return true;
  }
  if (slug === "alex-storage-unit-36-x-70") {
    const g: Unit = { W, D, Hc: H, y0: 0, slots: [], pitch: { shallow: 0, deep: 0 } };
    const c = carcassParts(b, g);
    carcassA(b, st, c, "glides");
    doorAndShelf(b, st, c);
    return true;
  }
  return false;
}

const family: Family = {
  names: ["ALEX"],
  build,
};
export default family;
