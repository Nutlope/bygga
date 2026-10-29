import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, HwKind, PartItem, PartMaterial, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * BESTÅ, read from the frame, TV bench, shelf, hinge, drawer and leg manuals. Every frame is cam bolts and cam locks:
 * feet into the bottom, cam bolts into the bottom and top, the sides (and dividers) on the bolts, the backs slid down
 * their grooves, the top on, cams turned. Frames up to 64 cm are built standing up; the 128 and 192 cm frames are built
 * lying on their back, the back slid in from the open end before the bottom goes on. Plain frames hang two wall fittings
 * in the top back corners and are screwed to the wall through them; TV benches have L brackets on their sides and
 * dividers (the 64 cm ones on the dividers only), cover strips and cable outlets at the back, and hook onto wall screws.
 * Then shelves on four pins, doors on two hinges each with two bumpers, drawers on runners, and STUBBARP legs instead
 * of the feet. The 240 cm combinations are a TV bench with a 60 cm frame screwed on at each end. BESTÅ BURS is a
 * different build, read from its own manual (`bursRecipe`).
 */

const T = 18; // board
const BK = 3; // back panel
const DT = 19; // door and drawer front
const GAP = 3;
const FOOT_H = 10; // the frame stands this far up on its feet

type Build = "tall" | "box" | "bench" | "unit";
type Kind = HwKind;

interface Frame {
  p: string; // id prefix
  cx: number;
  W: number;
  H: number;
  D: number;
  yb: number; // underside of the bottom panel
  build: Build;
  cols: number;
}

interface Front {
  f: Frame;
  cell: number;
  y0: number;
  y1: number;
  hinge: -1 | 1 | 0; // 0: a drawer front
}

interface Shelf {
  f: Frame;
  cell: number;
  y: number;
}

interface Move {
  id: string;
  states: { step: number; pos: Vec3; rot?: Vec3; from?: Vec3 }[]; // the first replaces where it first appears
}

class Recipe {
  parts: CustomPart[] = [];
  steps: CustomStep[] = [];
  moves: Move[] = [];
  part(id: string, name: string, size: Vec3, pos: Vec3, material: PartMaterial = "board") {
    this.parts.push({ id, name, size, pos, material });
  }
  step(st: CustomStep) {
    this.steps.push(st);
    return this.steps.length - 1;
  }
  pos(id: string) {
    return this.parts.find((p) => p.id === id)!.pos;
  }
}

const fix = (kind: Kind, at: Vec3[], dir: Vec3, o: { on?: string; mate?: string; len?: number; dia?: number } = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/* ---------- a frame's geometry ---------- */

const zs = (f: Frame) => f.D / 2 - Math.min(50, f.D / 4); // cam bolts, front and back
const cw = (f: Frame) => (f.W - 2 * T - (f.cols - 1) * T) / f.cols;
const cellX0 = (f: Frame, k: number) => f.cx - f.W / 2 + T + k * (cw(f) + T);
const cellC = (f: Frame, k: number) => cellX0(f, k) + cw(f) / 2;
const divX = (f: Frame, k: number) => cellX0(f, k) - T / 2; // k = 1 .. cols-1
const sideX = (f: Frame, s: -1 | 1) => f.cx + s * (f.W / 2 - T / 2);
const inX = (f: Frame, s: -1 | 1) => f.cx + s * (f.W / 2 - T);
const ids = (f: Frame) => ({
  B: `${f.p}B`,
  T: `${f.p}T`,
  L: `${f.p}L`,
  R: `${f.p}R`,
  V: Array.from({ length: f.cols - 1 }, (_, i) => `${f.p}V${i + 1}`),
  K: Array.from({ length: f.cols }, (_, i) => `${f.p}K${i}`),
});
/** The upright on one side of a cell: its id, and the x of its face towards the cell. */
function upright(f: Frame, cell: number, s: -1 | 1) {
  const i = ids(f);
  if (s < 0) return { id: cell === 0 ? i.L : i.V[cell - 1], x: cellX0(f, cell) };
  return { id: cell === f.cols - 1 ? i.R : i.V[cell], x: cellX0(f, cell) + cw(f) };
}

function frameParts(r: Recipe, f: Frame) {
  const i = ids(f);
  const ih = f.H - 2 * T;
  r.part(i.B, "Bottom panel", [f.W, T, f.D], [f.cx, f.yb + T / 2, 0]);
  r.part(i.T, "Top panel", [f.W, T, f.D], [f.cx, f.yb + f.H - T / 2, 0]);
  r.part(i.L, "Side panel", [T, ih, f.D], [sideX(f, -1), f.yb + f.H / 2, 0]);
  r.part(i.R, "Side panel", [T, ih, f.D], [sideX(f, 1), f.yb + f.H / 2, 0]);
  // dividers stop at the back panels, which slide down grooves in the sides and dividers
  i.V.forEach((id, k) => r.part(id, "Divider", [T, ih, f.D - 20], [divX(f, k + 1), f.yb + f.H / 2, 10]));
  i.K.forEach((id, k) => r.part(id, "Back panel", [cw(f), ih, BK], [cellC(f, k), f.yb + f.H / 2, -f.D / 2 + 15], "fiber"));
}

function feetAt(f: Frame): Vec3[] {
  const xo = f.W / 2 - 40, zo = f.D / 2 - 40;
  const pts: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [f.cx + sx * xo, f.yb, sz * zo] as Vec3));
  if (f.cols === 1) return pts;
  if (f.build === "box") return [...pts, [f.cx, f.yb, 0]];
  for (let k = 1; k < f.cols; k++) for (const sz of [-1, 1]) pts.push([divX(f, k), f.yb, sz * zo]);
  return pts;
}

const BOLT = { len: 34, dia: 7 };
const CAM = { len: 13, dia: 15 };
const TWIN = { len: 16, dia: 20 };

/** Cam bolts into the bottom or top panel, a pair at each upright. */
function bolts(f: Frame, at: "B" | "T", which: ("L" | "R" | "V")[] = ["L", "R", "V"]): CustomFix[] {
  const i = ids(f);
  const y = at === "B" ? f.yb + T : f.yb + f.H - T;
  const dir: Vec3 = at === "B" ? [0, -1, 0] : [0, 1, 0];
  const ups = [...(which.includes("L") ? [{ id: i.L, x: sideX(f, -1) }] : []), ...(which.includes("R") ? [{ id: i.R, x: sideX(f, 1) }] : []), ...(which.includes("V") ? i.V.map((id, k) => ({ id, x: divX(f, k + 1) })) : [])];
  return ups.map((u) => fix("camScrew", [-1, 1].map((sz) => [u.x, y, sz * zs(f)] as Vec3), dir, { on: at === "B" ? i.B : i.T, mate: u.id, ...BOLT }));
}

/** Cam locks in the sides (or the twin cams through the dividers) next to the bottom or top panel. */
function cams(f: Frame, at: "B" | "T", what: "sides" | "dividers"): CustomFix[] {
  const i = ids(f);
  const y = at === "B" ? f.yb + T + 32 : f.yb + f.H - T - 32;
  if (what === "sides")
    return ([-1, 1] as const).map((s) => fix("cam", [-1, 1].map((sz) => [inX(f, s), y, sz * zs(f)] as Vec3), [s, 0, 0], { on: s < 0 ? i.L : i.R, ...CAM }));
  return i.V.map((id, k) => fix("cam", [-1, 1].map((sz) => [divX(f, k + 1) - T / 2, y, sz * zs(f)] as Vec3), [1, 0, 0], { on: id, ...TWIN }));
}

/* ---------- frame steps (several identical frames at once, as the combinations' end frames) ---------- */

interface Words {
  one: boolean;
  the: string; // "the" or "both"
  each: string; // "" or " of each"
}
const wordsOf = (n: number): Words => (n > 1 ? { one: false, the: "both", each: " of each" } : { one: true, the: "the", each: "" });

/** Plain frames and TV benches up to 64 cm, built standing up. */
function uprightSteps(r: Recipe, fs: Frame[], legs: boolean, title = "") {
  const f0 = fs[0];
  const w = wordsOf(fs.length);
  const all = (fn: (f: Frame) => string[]) => fs.flatMap(fn);
  const pre = title ? `${title}: ` : "";
  const brackets = (f: Frame, which: "sides" | "dividers"): CustomFix[] => {
    const i = ids(f);
    const y = f.yb + f.H - T - 40;
    const z = -f.D / 2 + 30;
    const list =
      which === "sides"
        ? ([-1, 1] as const).map((s) => ({ id: s < 0 ? i.L : i.R, x: inX(f, s), d: s as number }))
        : i.V.map((id, k) => ({ id, x: divX(f, k + 1) - T / 2, d: 1 }));
    return list.flatMap((u) => [
      fix("bracket", [[u.x, y, z]], [u.d, 0, 0], { on: u.id, len: 40, dia: 44 }),
      // far enough from the bracket's own point that custom.ts doesn't push them off the side
      fix("screw", [[u.x, y - 24, z + 8], [u.x, y + 24, z + 8]], [u.d, 0, 0], { on: u.id, len: 14, dia: 4 }),
    ]);
  };
  if (!legs)
    r.step({
      title: `${pre}Screw the feet into the bottom${w.one ? "" : "s"}`,
      detail: `Lay ${w.the} bottom panel${w.one ? "" : "s"} on a rug, underside up, and turn ${feetAt(f0).length} feet${w.each} in by hand.`,
      add: all((f) => [ids(f).B]),
      fix: fs.map((f) => fix("foot", feetAt(f), [0, 1, 0], { on: ids(f).B, len: 20, dia: 48 })),
      warnings: ["floor"],
    });
  r.step({
    title: `${pre}Screw the cam bolts into the bottom${w.one ? "" : "s"}`,
    detail: legs ? "Lay it on a rug, holes up. By hand with a screwdriver, not a drill, until they stop." : "Turn it over onto its feet. By hand with a screwdriver, not a drill, until they stop.",
    add: legs ? all((f) => [ids(f).B]) : undefined,
    fix: fs.flatMap((f) => bolts(f, "B")),
    tools: ["screwdriver"],
  });
  const bench = f0.build === "bench";
  r.step({
    title: bench ? `${pre}Screw a bracket onto each side and stand them on the bolts` : f0.build === "box" && f0.cols > 1 ? `${pre}Stand the sides and the divider on the bolts` : `${pre}Stand the sides on the bolts`,
    detail: bench
      ? "Two screws hold each bracket, at the top back corner on the inside. Then push the sides down over the bolts, holes facing in."
      : "Holes facing in, the grooves for the back at the back. Push each one straight down over its bolts.",
    add: all((f) => [ids(f).L, ids(f).R, ...(f.build === "box" ? ids(f).V : [])]),
    fix: bench ? fs.flatMap((f) => brackets(f, "sides")) : undefined,
    tools: bench ? ["screwdriver"] : undefined,
    wall: false,
  });
  r.step({
    title: `${pre}Turn the cam locks in the sides`,
    detail: "Arrow towards the bolt, then turn each one clockwise until it pulls the side down tight.",
    fix: fs.flatMap((f) => cams(f, "B", "sides")),
    tools: ["screwdriver"],
  });
  if (f0.cols > 1) {
    const n = f0.cols - 1;
    if (f0.build !== "box") {
      r.step({
        title: n > 1 ? `${pre}Screw a bracket onto each divider and stand them on the bolts` : `${pre}Screw the bracket onto the divider and stand it on the bolts`,
        detail: "At the top back corner, two screws each. Then push it down over its bolts in the middle of the bottom.",
        add: all((f) => ids(f).V),
        fix: fs.flatMap((f) => brackets(f, "dividers")),
        tools: ["screwdriver"],
        wall: false,
      });
    }
    r.step({
      title: n > 1 ? `${pre}Lock the dividers with the double cams` : `${pre}Lock the divider with the double cams`,
      detail: "The dividers take the cams with a thread on them, not the plain ones. Turn them clockwise until tight.",
      fix: fs.flatMap((f) => cams(f, "B", "dividers")),
      tools: ["screwdriver"],
    });
  }
  const backs = all((f) => ids(f).K);
  r.step({
    title: backs.length > 1 ? `${pre}Slide the back panels down the grooves` : `${pre}Slide the back panel down the grooves`,
    detail: "Finished side facing in. Push each one all the way down into the groove in the bottom.",
    add: backs,
    from: Object.fromEntries(fs.flatMap((f) => ids(f).K.map((id) => [id, [0, f.H, 0] as Vec3]))),
  });
  r.step({
    title: `${pre}Screw the cam bolts into the top${w.one ? "" : "s"} and lower ${w.one ? "it" : "them"} on`,
    detail: "Bolts in by hand on a rug first. Then turn it over and lower it so every bolt finds its hole.",
    add: all((f) => [ids(f).T]),
    fix: fs.flatMap((f) => bolts(f, "T")),
    tools: ["screwdriver"],
  });
  const tv = f0.build !== "box";
  r.step({
    title: `${pre}Turn the cam locks under the top`,
    detail: tv ? "Lay it on its front on the rug first. The dividers take the double cams again." : f0.cols > 1 ? "Plain cams in the sides, double cams in the divider." : "Arrow towards the bolt, then clockwise until tight.",
    fix: fs.flatMap((f) => [...cams(f, "T", "sides"), ...cams(f, "T", "dividers")]),
    tools: ["screwdriver"],
    pose: tv ? "-z" : undefined,
    people: tv && f0.W > 1000 ? 2 : undefined,
    warnings: tv ? ["floor"] : undefined,
  });
}

/** The 128 and 192 cm frames, built lying on their back. */
function tallSteps(r: Recipe, f: Frame) {
  const i = ids(f);
  const s1 = r.step({
    title: "Screw the feet into the bottom",
    detail: "Lay it on a rug, underside up, and turn the four feet in by hand.",
    add: [i.B],
    fix: [fix("foot", feetAt(f), [0, 1, 0], { on: i.B, len: 20, dia: 48 })],
    warnings: ["floor"],
  });
  const s2 = r.step({
    title: "Screw the cam bolts into the top and the bottom",
    detail: "Four in each, by hand with a screwdriver, not a drill.",
    add: [i.T],
    fix: [...bolts(f, "T"), ...bolts(f, "B")],
    tools: ["screwdriver"],
  });
  r.step({
    title: "Push the top onto the two sides",
    detail: "Lay the sides on the rug standing on their back edges, holes facing in, and push the top's bolts into their ends.",
    add: [i.L, i.R],
    pose: "+z",
    warnings: ["floor"],
  });
  r.step({ title: "Turn the cam locks at the top", detail: "Arrow towards the bolt, then clockwise until it pulls the joint tight.", fix: cams(f, "T", "sides"), tools: ["screwdriver"] });
  r.step({
    title: "Slide the back panel into the grooves",
    detail: "From the open end, finished side facing up, all the way in until it meets the top.",
    add: i.K,
    from: { [i.K[0]]: [0, -f.H * 0.7, 0] },
  });
  const s6 = r.step({ title: "Push on the bottom", detail: "Feet facing out. Its bolts go into the ends of the sides, over the end of the back panel.", add: [i.B] });
  r.step({ title: "Turn the cam locks at the bottom", detail: "The same as at the top: arrow to the bolt, then clockwise until tight.", fix: cams(f, "B", "sides"), tools: ["screwdriver"], check: "square" });
  r.step({ title: "Stand it up", detail: "Lift it by the top end and stand it on its feet.", pose: "+y", people: f.H > 1500 ? 2 : 1, warnings: f.H > 1500 ? ["two"] : undefined });
  // the top lies on the rug beside the bottom for its bolts; the bottom waits on the rug, flat, until the back is in
  r.moves.push({ id: i.T, states: [{ step: s2, pos: [f.cx + f.W + 120, f.yb + T / 2, 0] }, { step: s2 + 1, pos: r.pos(i.T) }] });
  const off: Vec3 = [0, -f.H * 0.45, 0];
  r.moves.push({
    id: i.B,
    states: [
      { step: s1, pos: r.pos(i.B) },
      { step: s1 + 2, pos: add3([f.cx, -360, -f.D / 2 + T / 2], [0, 0, 0]), rot: [Math.PI / 2, 0, 0] },
      { step: s6, pos: r.pos(i.B), from: off },
    ],
  });
}

/* ---------- after the frame ---------- */

/** Cover strips at the back, the two cable outlets and, standing up, the cable cover. TV benches only. */
function cableParts(r: Recipe, f: Frame) {
  const z = -f.D / 2 + 6;
  const yb = f.yb + T, yt = f.yb + f.H - T;
  r.part(`${f.p}S1`, "Cover strip", [200, 26, 8], [f.cx - 170, yb + 13, z], "metal");
  r.part(`${f.p}S2`, "Cover strip", [200, 26, 8], [f.cx + 170, yb + 13, z], "metal");
  r.part(`${f.p}S3`, "Top cover strip", [240, 26, 8], [f.cx - 200, yt - 13, z], "metal");
  r.part(`${f.p}O1`, "Cable outlet", [120, 34, 10], [f.cx, yb + 17, z], "metal");
  r.part(`${f.p}O2`, "Cable outlet", [120, 34, 10], [f.cx, yt - 17, z], "metal");
  r.part(`${f.p}C`, "Cable cover", [50, f.H - 2 * T - 90, 10], [f.cx, f.yb + f.H / 2, z], "metal");
}

function cableSteps(r: Recipe, f: Frame) {
  const z = -f.D / 2 + 6;
  const yb = f.yb + T, yt = f.yb + f.H - T;
  r.step({ title: "Slide the two cover strips into the bottom slot", detail: "It still lies on its front. They slide in at the back, one from each end of the cable gap.", add: [`${f.p}S1`, `${f.p}S2`], pose: "-z" });
  r.step({ title: "Slide the cover strip into the top slot", detail: "Push it along until it stops against the outlet's place.", add: [`${f.p}S3`] });
  r.step({
    title: "Screw on the two cable outlets",
    detail: "One at the top and one at the bottom of the cable gap, two screws each.",
    add: [`${f.p}O1`, `${f.p}O2`],
    fix: [
      fix("screw", [[f.cx - 40, yb + 34, z], [f.cx + 40, yb + 34, z]], [0, -1, 0], { on: `${f.p}O1`, mate: ids(f).B, len: 12, dia: 3.5 }),
      fix("screw", [[f.cx - 40, yt - 34, z], [f.cx + 40, yt - 34, z]], [0, 1, 0], { on: `${f.p}O2`, mate: ids(f).T, len: 12, dia: 3.5 }),
    ],
    tools: ["screwdriver"],
  });
}

function coverStep(r: Recipe, f: Frame) {
  r.step({ title: "Run the cables and clip on the cable cover", detail: "Lead the cables through the outlets, then press the cover into the gap at the back until it clicks.", add: [`${f.p}C`] });
}

/** Two people stand it up; with legs it goes upside down for them first. */
function legsParts(r: Recipe, frames: Frame[], legH: number) {
  const fs = [...frames].sort((a, b) => a.cx - b.cx);
  const out: { id: string; x: number; z: number; support: boolean; joint: boolean }[] = [];
  const W = fs.reduce((a, f) => Math.max(a, f.cx + f.W / 2), -Infinity) - fs.reduce((a, f) => Math.min(a, f.cx - f.W / 2), Infinity);
  const x0 = fs[0].cx - fs[0].W / 2;
  const D = fs[0].D;
  const xs = [x0 + 30];
  for (let k = 1; k < fs.length; k++) xs.push(fs[k].cx - fs[k].W / 2);
  xs.push(x0 + W - 30);
  const zl = D / 2 - 30;
  xs.forEach((x, k) => {
    for (const sz of [-1, 1]) out.push({ id: `G${k}${sz < 0 ? "b" : "f"}`, x, z: sz * zl, support: false, joint: k > 0 && k < xs.length - 1 });
  });
  // the grey supporting legs under the middle of a TV bench
  const tv = fs.find((f) => f.build !== "box" && f.build !== "tall" && f.cols === 2);
  if (tv) for (const sz of [-1, 1]) out.push({ id: `GS${sz < 0 ? "b" : "f"}`, x: tv.cx, z: sz * (D / 2 - 60), support: true, joint: false });
  for (const l of out) r.part(l.id, l.support ? "Supporting leg" : "Leg", [l.support ? 36 : 45, legH, l.support ? 36 : 45], [l.x, legH / 2, l.z], l.support ? "metal" : "board");
  return out;
}

function legsSteps(r: Recipe, fs: Frame[], legs: ReturnType<typeof legsParts>, legH: number) {
  const bottomAt = (x: number) => ids(fs.find((f) => x >= f.cx - f.W / 2 - 1 && x <= f.cx + f.W / 2 + 1)!).B;
  const plain = legs.filter((l) => !l.support);
  const sup = legs.filter((l) => l.support);
  const joints = legs.filter((l) => l.joint);
  const wide = fs.length > 1 || fs[0].W > 1000;
  r.step({
    title: wide ? "Turn it upside down together" : "Turn it upside down",
    detail: "Onto the rug, so the bottom faces up for the legs.",
    pose: "-y",
    people: wide ? 2 : 1,
    warnings: wide ? ["two", "floor"] : ["floor"],
  });
  if (joints.length)
    r.step({
      title: "Screw the joining plates across the joints",
      detail: "One plate under each joint between two frames, front and back. The leg screws into its middle.",
      fix: joints.map((l) => fix("plate", [[l.x, legH, l.z]], [0, 1, 0], { on: bottomAt(l.x - 10), len: 80, dia: 40 })),
      tools: ["screwdriver"],
    });
  r.step({
    title: "Screw the legs on",
    detail: "Turn the adjustable foot into the bottom of each leg and the threaded stud into its top, then screw the leg into the hole by hand until it's tight.",
    add: plain.map((l) => l.id),
    fix: [
      fix("legScrew", plain.map((l) => [l.x, legH, l.z] as Vec3), [0, 1, 0], { len: 40, dia: 8 }),
      fix("foot", plain.map((l) => [l.x, 0, l.z] as Vec3), [0, 1, 0], { len: 10, dia: 34 }),
    ],
  });
  if (sup.length)
    r.step({
      title: "Screw in the supporting legs",
      detail: "The two short grey legs go in the holes under the middle, so the bottom doesn't sag.",
      add: sup.map((l) => l.id),
      fix: [fix("legScrew", sup.map((l) => [l.x, legH, l.z] as Vec3), [0, 1, 0], { len: 30, dia: 8 })],
    });
  r.step({ title: wide ? "Stand it up together" : "Stand it up", detail: "Lift it, don't tip it up on two legs.", pose: "+y", people: wide ? 2 : 1, warnings: wide ? ["two"] : undefined });
}

function standStep(r: Recipe, f: Frame) {
  const wide = f.W > 1000;
  r.step({ title: wide ? "Stand it up together" : "Stand it up", detail: "Lift it back onto its feet, don't drag it.", pose: "+y", people: wide ? 2 : 1, warnings: wide ? ["two"] : undefined });
}

function levelStep(r: Recipe, legs: boolean) {
  r.step({
    title: "Level it",
    detail: legs ? "Turn the feet under the legs until it stands level and doesn't rock." : "Turn the feet with the Allen key from inside, or by hand, until it stands level and doesn't rock.",
    tools: legs ? ["level"] : ["allen", "level"],
  });
}

/** Plain frames: two fittings in the top back corners, screwed to the wall through them. */
function fittingAt(f: Frame, s: -1 | 1): Vec3 {
  return [inX(f, s), f.yb + f.H - T - 40, -f.D / 2 + 28];
}
function fittingSteps(r: Recipe, fs: Frame[], spacers: boolean) {
  r.step({
    title: fs.length > 1 ? "Push the wall fittings into the frames" : "Push the wall fittings into the top corners",
    detail: "One in each top back corner, its two pins into the holes in the side.",
    fix: fs.flatMap((f) => ([-1, 1] as const).map((s) => fix("bracket", [fittingAt(f, s)], [s, 0, 0], { on: s < 0 ? ids(f).L : ids(f).R, len: 40, dia: 30 }))),
    wall: false,
  });
  if (spacers)
    r.step({
      title: "Turn the spacers onto the fittings if you need them",
      detail: "Only where a skirting board keeps the frame off the wall: turn them out until the frame stands straight.",
      fix: fs.flatMap((f) => ([-1, 1] as const).map((s) => fix("spacer", [add3(fittingAt(f, s), [-s * 15, 0, -f.D / 2 + 28 - fittingAt(f, s)[2] - 4])], [0, 0, 1], { on: s < 0 ? ids(f).L : ids(f).R, len: 20, dia: 30 }))),
    });
}
function frameWall(f: Frame): { pts: Vec3[]; caps: Vec3[] } {
  const pts = ([-1, 1] as const).map((s) => [inX(f, s) - s * 15, f.yb + f.H - T - 40, -f.D / 2] as Vec3);
  return { pts, caps: pts.map((p) => [p[0], p[1], p[2] + 34] as Vec3) };
}
/** TV benches: the brackets' keyhole plates hook onto screws in the wall. */
function benchWall(f: Frame): Vec3[] {
  const i = ids(f);
  const y = f.yb + f.H - T - 40;
  const ups = f.build === "bench" ? [inX(f, -1) + 20, ...i.V.map((_, k) => divX(f, k + 1) - T / 2 - 20), inX(f, 1) - 20] : i.V.map((_, k) => divX(f, k + 1) - T / 2 - 20);
  return ups.map((x) => [x, y, -f.D / 2] as Vec3);
}

function wallStep(r: Recipe, fs: Frame[]) {
  const frames = fs.filter((f) => f.build === "box" || f.build === "tall");
  const tvs = fs.filter((f) => f.build === "bench" || f.build === "unit");
  const fw = frames.map(frameWall);
  const tw = tvs.flatMap(benchWall);
  const pts = [...fw.flatMap((x) => x.pts), ...tw];
  const fixes: CustomFix[] = [
    fix("plug", pts, [0, 0, -1], { len: 35, dia: 8 }),
    fix("screw", pts.map((p) => [p[0], p[1], p[2] + 30] as Vec3), [0, 0, -1], { len: 50, dia: 5 }),
  ];
  if (fw.length) {
    fixes.push(fix("washer", fw.flatMap((x) => x.pts).map((p) => [p[0], p[1], p[2] + 30] as Vec3), [0, 0, -1], { len: 2, dia: 20 }));
    fixes.push(fix("cap", fw.flatMap((x) => x.caps), [0, 0, -1], { len: 12, dia: 40 }));
  }
  if (tw.length) {
    fixes.push(fix("hook", tw.map((p) => [p[0], p[1], p[2] + 28] as Vec3), [0, 0, -1], { len: 20, dia: 30 }));
    fixes.push(fix("cap", tw.map((p) => [p[0], p[1], p[2] + 40] as Vec3), [0, 0, -1], { len: 30, dia: 45 }));
  }
  const n = pts.length;
  r.step({
    title: tvs.length && !frames.length ? "Hook it onto screws in the wall" : "Screw it to the wall",
    detail: tvs.length && !frames.length
      ? `Mark the ${n === 1 ? "bracket" : `${n} brackets`} on the wall, put in screws that suit your wall, then hook the keyhole plates over them and click the corner covers on.`
      : `Through the fittings, a washer under each screw head, then click the covers on. Wall screws and plugs aren't included: pick ones made for your wall.`,
    fix: fixes,
    tools: ["drill", "screwdriver", "pencil", "level"],
    wall: true,
    warnings: ["wall", "tip"],
  });
}

/* ---------- inside and in front ---------- */

function shelfParts(r: Recipe, shelves: Shelf[]) {
  shelves.forEach((s, k) => r.part(`H${k}`, "Shelf", [cw(s.f) - 2, T, s.f.D - 40], [cellC(s.f, s.cell), s.y, 0]));
}
function shelfStep(r: Recipe, shelves: Shelf[]) {
  if (!shelves.length) return;
  const fixes: CustomFix[] = [];
  for (const s of shelves)
    for (const side of [-1, 1] as const) {
      const u = upright(s.f, s.cell, side);
      fixes.push(fix("pin", [-1, 1].map((sz) => [u.x, s.y - T / 2 - 3, sz * (s.f.D / 2 - 60)] as Vec3), [side, 0, 0], { on: u.id, len: 16, dia: 5 }));
    }
  const n = shelves.length;
  // ten fittings a step at most
  for (let i = 0; i < fixes.length; i += 10) {
    const part = shelves.slice(i / 2, (i + 10) / 2);
    r.step({
      title: n > 1 ? (i ? "Put in the other shelves" : `Put in the shelves`) : "Put in the shelf",
      detail: "Four pins for each, in the same row of holes on both sides. Lay the shelf on them.",
      add: part.map((_, k) => `H${shelves.indexOf(part[k])}`),
      fix: fixes.slice(i, i + 10),
    });
  }
}

/** Door stops on the sides, where two doors one above the other meet. */
function stopStep(r: Recipe, f: Frame, ys: number[]) {
  if (!ys.length) return;
  const pts = (s: -1 | 1) => ys.map((y) => [inX(f, s), y + T, f.D / 2 - 15] as Vec3);
  r.step({
    title: ys.length > 1 ? "Screw on the door stops" : "Screw on the door stops",
    detail: "Just above the shelf where the doors meet, at the front of each side, one screw each.",
    fix: ([-1, 1] as const).flatMap((s) => [
      fix("clip", pts(s), [s, 0, 0], { on: s < 0 ? ids(f).L : ids(f).R, len: 20, dia: 16 }),
      fix("screw", pts(s).map((p) => [p[0], p[1] + 8, p[2]] as Vec3), [s, 0, 0], { on: s < 0 ? ids(f).L : ids(f).R, len: 12, dia: 3.5 }),
    ]),
    tools: ["screwdriver"],
  });
}

const frontX = (fr: Front) => {
  const pitch = fr.f.W / fr.f.cols;
  const x0 = fr.f.cx - fr.f.W / 2 + fr.cell * pitch;
  return { x0, x1: x0 + pitch };
};

function doorParts(r: Recipe, doors: Front[]) {
  doors.forEach((d, k) => {
    const { x0, x1 } = frontX(d);
    r.part(`F${k}`, "Door", [x1 - x0 - GAP, d.y1 - d.y0 - GAP, DT], [(x0 + x1) / 2, (d.y0 + d.y1) / 2, d.f.D / 2 + DT / 2 + 1]);
  });
}

function doorSteps(r: Recipe, doors: Front[]) {
  if (!doors.length) return;
  const n = doors.length;
  const hingeYs = (d: Front) => {
    const h = d.y1 - d.y0;
    const inset = h > 500 ? 100 : 70;
    return [d.y0 + inset, d.y1 - inset];
  };
  const zb = (d: Front) => d.f.D / 2 + 1;
  const s1 = r.step({
    title: n > 1 ? `Screw two hinges onto each of the ${n} doors` : "Screw the two hinges onto the door",
    detail: "Lay the door face down on the rug. The hinge cups go into the round holes, then tighten their screws.",
    add: doors.map((_, k) => `F${k}`),
    fix: doors.map((d, k) => {
      const { x0, x1 } = frontX(d);
      const x = d.hinge < 0 ? x0 + 24 : x1 - 24;
      return fix("hinge", hingeYs(d).map((y) => [x, y, zb(d)] as Vec3), [0, 0, 1], { on: `F${k}` });
    }),
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  const s2 = r.step({
    title: n > 1 ? "Hang the doors" : "Hang the door",
    detail: "Hold the door against the frame and tighten the two screws already in each hinge plate into the holes in the side.",
    tools: ["screwdriver"],
  });
  r.step({
    title: n > 1 ? "Press in the door bumpers" : "Press in the bumpers",
    detail: "Two on the back of each door, near the corners on the side that opens.",
    fix: doors.map((d, k) => {
      const { x0, x1 } = frontX(d);
      const x = d.hinge < 0 ? x1 - 30 : x0 + 30;
      return fix("glide", [[x, d.y0 + 40, zb(d)], [x, d.y1 - 40, zb(d)]], [0, 0, 1], { on: `F${k}`, len: 3, dia: 10 });
    }),
  });
  r.step({
    title: n > 1 ? "Line up the doors" : "Line up the door",
    detail: "Turn the hinge screws: one moves the door up or down, one sideways, one in or out, until the gaps are even.",
    tools: ["screwdriver"],
  });
  // each door lies face down on the floor in front while its hinges go on
  doors.forEach((d, k) => {
    const id = `F${k}`;
    const h = d.y1 - d.y0;
    const p = r.pos(id);
    const row = doors.filter((o, j) => j < k && Math.abs(r.pos(`F${j}`)[0] - p[0]) < 1).length;
    r.moves.push({
      id,
      states: [
        { step: s1, pos: [p[0], DT / 2, d.f.D / 2 + 160 + h / 2 + row * (h + 60)], rot: [Math.PI / 2, 0, 0] },
        { step: s2, pos: p, from: [0, 0, 320] },
      ],
    });
  });
}

/** BESTÅ drawer frames: steel sides onto the bottom, back down their slots, the front clamped on with cams, onto runners. */
function drawerParts(r: Recipe, drawers: Front[]) {
  drawers.forEach((d, k) => {
    const f = d.f;
    const bw = cw(f) - 26;
    const x = cellC(f, d.cell);
    const y0 = f.yb + T + 22;
    const dd = f.D - 40;
    const zc = f.D / 2 - 2 - dd / 2;
    const bh = Math.min(150, d.y1 - d.y0 - 90);
    r.part(`DB${k}`, "Drawer bottom", [bw - 4, 8, dd - 14], [x, y0 + 4, zc - 5], "fiber");
    r.part(`DL${k}`, "Drawer side", [10, bh, dd], [x - bw / 2 + 5, y0 + bh / 2, zc], "metal");
    r.part(`DR${k}`, "Drawer side", [10, bh, dd], [x + bw / 2 - 5, y0 + bh / 2, zc], "metal");
    r.part(`DK${k}`, "Drawer back", [bw - 20, bh - 10, 12], [x, y0 + 8 + (bh - 10) / 2, zc - dd / 2 + 6]);
    const { x0, x1 } = frontX(d);
    r.part(`DF${k}`, "Drawer front", [x1 - x0 - GAP, d.y1 - d.y0 - GAP, DT], [(x0 + x1) / 2, (d.y0 + d.y1) / 2, f.D / 2 + DT / 2 + 1]);
  });
}

function drawerSteps(r: Recipe, drawers: Front[]) {
  if (!drawers.length) return;
  const n = drawers.length;
  const geo = (d: Front) => {
    const f = d.f;
    const bw = cw(f) - 26;
    const x = cellC(f, d.cell);
    return { f, bw, x, y: f.yb + T + 22, dd: f.D - 40 };
  };
  r.step({
    title: "Screw the runners into the frame",
    detail: "A pair for each drawer, low down on the sides, front ends flush with the front edge.",
    fix: drawers.flatMap((d) => {
      const g = geo(d);
      return ([-1, 1] as const).flatMap((s) => {
        const u = upright(d.f, d.cell, s);
        return [
          fix("runner", [[u.x, g.y + 4, d.f.D / 2 - 2 - g.dd / 2]], [s, 0, 0], { on: u.id, len: g.dd, dia: 20 }),
          fix("screw", [-1, 0, 1].map((t) => [u.x, g.y + 4, d.f.D / 2 - 2 - g.dd / 2 + t * (g.dd / 2 - 30)] as Vec3), [s, 0, 0], { on: u.id, len: 12, dia: 4 }),
        ];
      });
    }),
    tools: ["screwdriver"],
  });
  const sA = r.step({
    title: n > 1 ? "Slide the steel sides onto the drawer bottoms" : "Slide the steel sides onto the drawer bottom",
    detail: "On the rug. The bottom's edges go into the slots along the foot of each side.",
    add: drawers.flatMap((_, k) => [`DB${k}`, `DL${k}`, `DR${k}`]),
    warnings: ["floor"],
  });
  r.step({ title: n > 1 ? "Slide the backs down into the sides" : "Slide the back down into the sides", detail: "Into the slots at the back ends of the steel sides, until it rests on the bottom.", add: drawers.map((_, k) => `DK${k}`) });
  const sF = r.step({
    title: n > 1 ? "Screw the cam bolts into the fronts" : "Screw the cam bolts into the front",
    detail: "Four in each, plus the two round stops. Lay the front face down on the rug.",
    add: drawers.map((_, k) => `DF${k}`),
    fix: drawers.flatMap((d, k) => {
      const g = geo(d);
      const zf = d.f.D / 2 + 1;
      return [
        fix("camScrew", [-1, 1].flatMap((s) => [g.y + 30, g.y + 110].map((y) => [g.x + s * (g.bw / 2 - 5), y, zf] as Vec3)), [0, 0, 1], { on: `DF${k}`, len: 24, dia: 6 }),
        fix("clip", [-1, 1].map((s) => [g.x + s * (g.bw / 2 - 40), g.y + 70, zf] as Vec3), [0, 0, 1], { on: `DF${k}`, len: 12, dia: 24 }),
      ];
    }),
    tools: ["screwdriver"],
  });
  const sJ = r.step({
    title: n > 1 ? "Press the fronts on and lock the cams" : "Press the front on and lock the cams",
    detail: "Stand the drawer on its back, lower the front onto the sides, then turn the four cams through the holes in the steel sides and click the caps on.",
    fix: drawers.flatMap((d, k) => {
      const g = geo(d);
      const zc = d.f.D / 2 - 25;
      return ([-1, 1] as const).flatMap((s) => [
        fix("cam", [g.y + 30, g.y + 110].map((y) => [g.x + s * g.bw / 2, y, zc] as Vec3), [-s, 0, 0], { on: s < 0 ? `DL${k}` : `DR${k}`, ...CAM }),
        fix("cap", [[g.x + s * g.bw / 2, g.y + 70, zc]], [-s, 0, 0], { on: s < 0 ? `DL${k}` : `DR${k}`, len: 2, dia: 14 }),
      ]);
    }),
    tools: ["screwdriver"],
  });
  const sS = r.step({ title: n > 1 ? "Push the drawers in on the runners" : "Push the drawer in on the runners", detail: "Pull the runners out, set the drawer on them and push it in until it clicks." });
  // each drawer is built on the floor in front of the frame, then slid in
  drawers.forEach((d, k) => {
    const out: Vec3 = [0, -(geo(d).y - 0), d.f.D + 260];
    for (const id of [`DB${k}`, `DL${k}`, `DR${k}`, `DK${k}`]) {
      const p = r.pos(id);
      r.moves.push({ id, states: [{ step: id === `DK${k}` ? sA + 1 : sA, pos: add3(p, out) }, { step: sS, pos: p, from: [0, 0, 380] }] });
    }
    const p = r.pos(`DF${k}`);
    r.moves.push({
      id: `DF${k}`,
      states: [
        { step: sF, pos: add3(p, add3(out, [0, 0, 220])) },
        { step: sJ, pos: add3(p, out), from: [0, 0, 120] },
        { step: sS, pos: p, from: [0, 0, 380] },
      ],
    });
  });
}

/* ---------- which product is which ---------- */

interface Guide {
  frames: Frame[];
  legH: number;
  doors: Front[];
  drawers: Front[];
  shelves: Shelf[];
  stops: number[];
}

const HEIGHTS = [380, 640, 1280, 1920];
const nearest = (h: number) => HEIGHTS.reduce((a, x) => (Math.abs(x - h) < Math.abs(a - h) ? x : a));

/** One BESTÅ unit: a frame or TV bench, with its legs, shelves and fronts. */
function guideOf(s: ProductSpec): Guide | null {
  const slug = s.slug ?? "";
  if (/burs/.test(slug) || !/^besta-/.test(slug)) return null;
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10);
  const cols = Math.round(W / 600);
  if (cols < 1 || cols > 3 || Math.abs(cols * 600 - W) > 20) return null;
  const Hf = nearest(H);
  const legH = H - Hf >= 60 ? H - Hf : 0;
  const D = s.size.d <= 25 ? 200 : 400;
  const tv = /tv (bench|unit)/i.test(s.variant) && slug !== "besta-tv-bench-120-x-40"; // that one is a plain frame with doors
  const build: Build = Hf >= 1280 ? "tall" : tv ? (Hf === 380 ? "bench" : "unit") : "box";
  const yb = legH || FOOT_H;
  const f: Frame = { p: "A", cx: 0, W, H: Hf, D, yb, build, cols };
  const g: Guide = { frames: [f], legH, doors: [], drawers: [], shelves: [], stops: [] };
  const doors = /doors?/i.test(s.variant) || (s.cabinet?.doors ?? 0) > 0;
  const drawers = /drawers/i.test(s.variant);
  const hingeOf = (c: number): -1 | 1 => (cols > 1 && c === cols - 1 ? 1 : -1);
  const inner = Hf - 2 * T;
  if (drawers) {
    for (let c = 0; c < cols; c++) g.drawers.push({ f, cell: c, y0: yb, y1: yb + 260, hinge: 0 });
  } else if (doors && build === "unit") {
    // doors in the lower half, open above with a shelf on top of the doors
    for (let c = 0; c < cols; c++) {
      g.doors.push({ f, cell: c, y0: yb, y1: yb + 380, hinge: hingeOf(c) });
      g.shelves.push({ f, cell: c, y: yb + 380 - T / 2 });
    }
  } else if (doors) {
    const rows = Math.max(1, Math.round(Hf / 640));
    const dh = Hf / rows;
    for (let c = 0; c < cols; c++) for (let j = 0; j < rows; j++) g.doors.push({ f, cell: c, y0: yb + j * dh, y1: yb + (j + 1) * dh, hinge: hingeOf(c) });
    if (build === "tall") {
      // a shelf behind each place two doors meet, and door stops on it; the 128 cm one has one more up top
      for (let j = 1; j < rows; j++) {
        g.shelves.push({ f, cell: 0, y: yb + j * dh - T / 2 });
        g.stops.push(yb + j * dh);
      }
      if (rows === 2) g.shelves.push({ f, cell: 0, y: yb + 1.5 * dh });
    } else if (build === "box" && Hf === 640) for (let c = 0; c < cols; c++) g.shelves.push({ f, cell: c, y: yb + Hf / 2 });
  } else if (build === "tall") {
    const n = 5;
    for (let j = 1; j <= n; j++) g.shelves.push({ f, cell: 0, y: yb + T + (inner * j) / (n + 1) });
  } else if (build === "bench" && legH) {
    for (let c = 0; c < cols; c++) g.shelves.push({ f, cell: c, y: yb + Hf / 2 });
  }
  return g;
}

/** The 240 cm combinations: a 120 cm TV bench with a 60 cm frame on each end, all as tall as the bench. */
function rowOf(s: ProductSpec): Guide | null {
  const slug = s.slug ?? "";
  if (!s.row || !/^besta-tv-bench/.test(slug)) return null;
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10);
  if (Math.abs(W - 2400) > 20) return null;
  const Hf = nearest(H);
  const legH = H - Hf >= 60 ? H - Hf : 0;
  const yb = legH || FOOT_H;
  const D = 400;
  const tv: Frame = { p: "A", cx: 0, W: 1200, H: Hf, D, yb, build: Hf === 380 ? "bench" : "unit", cols: 2 };
  const left: Frame = { p: "L", cx: -900, W: 600, H: Hf, D, yb, build: "box", cols: 1 };
  const right: Frame = { p: "R", cx: 900, W: 600, H: Hf, D, yb, build: "box", cols: 1 };
  const g: Guide = { frames: [tv, left, right], legH, doors: [], drawers: [], shelves: [], stops: [] };
  const y1 = yb + Hf;
  g.doors.push({ f: left, cell: 0, y0: yb, y1, hinge: -1 }, { f: tv, cell: 0, y0: yb, y1, hinge: -1 }, { f: tv, cell: 1, y0: yb, y1, hinge: 1 }, { f: right, cell: 0, y0: yb, y1, hinge: 1 });
  return g;
}

/* ---------- the whole guide ---------- */

function recipeOf(g: Guide): Recipe {
  const r = new Recipe();
  const [main, ...ends] = g.frames;
  const legs = !!g.legH;
  for (const f of g.frames) frameParts(r, f);
  const tv = main.build === "bench" || main.build === "unit";
  if (tv) cableParts(r, main);
  const legList = legs ? legsParts(r, g.frames, g.legH) : [];
  shelfParts(r, g.shelves);
  doorParts(r, g.doors);
  drawerParts(r, g.drawers);

  if (main.build === "tall") tallSteps(r, main);
  else uprightSteps(r, [main], legs, ends.length ? "TV bench" : "");
  if (tv) cableSteps(r, main);
  if (ends.length) {
    if (tv) standStep(r, main);
    uprightSteps(r, ends, legs, "End frames");
    const pts = (fl: Frame, fr: Frame): Vec3[] => [0.3, 0.7].map((t) => [fl.cx + fl.W / 2 - T, fl.yb + fl.H * t, fl.D / 2 - 60] as Vec3);
    const [l, rr] = ends;
    r.step({
      title: "Screw the end frames to the TV bench",
      detail: "Stand them tight against its ends, fronts and tops in line, and drive two screws through each side.",
      fix: [
        fix("screw", pts(l, main), [1, 0, 0], { on: ids(l).R, mate: ids(main).L, len: 38, dia: 5 }),
        fix("screw", [0.3, 0.7].map((t) => [rr.cx - rr.W / 2 + T, rr.yb + rr.H * t, rr.D / 2 - 60] as Vec3), [-1, 0, 0], { on: ids(rr).L, mate: ids(main).R, len: 38, dia: 5 }),
      ],
      tools: ["screwdriver"],
      people: 2,
      warnings: ["two"],
      pose: "+y",
    });
  }
  if (legs) legsSteps(r, g.frames, legList, g.legH);
  else if (tv && !ends.length) standStep(r, main);
  // plain frames get their wall fittings before they're levelled, as their manual has it
  if (main.build === "box" || main.build === "tall") fittingSteps(r, g.frames, true);
  else if (ends.length) fittingSteps(r, ends, false);
  levelStep(r, legs);
  if (tv) coverStep(r, main);
  wallStep(r, g.frames);
  shelfStep(r, g.shelves);
  stopStep(r, main, g.stops);
  drawerSteps(r, g.drawers);
  doorSteps(r, g.doors);
  return r;
}

/** Puts parts that wait somewhere else (a door lying on the rug, a drawer built on the floor) where the manual has them. */
function applyMoves(b: PlanBuilder, base: number, r: Recipe) {
  for (const m of r.moves) {
    const p = r.pos(m.id);
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, i) => Math.abs(v - p[i]) < 0.5));
    if (!it || !it.states.length) continue;
    const first = it.states[0];
    first.pos = m.states[0].pos;
    first.rot = m.states[0].rot ?? it.final.rot;
    if (m.states[0].from) first.from = m.states[0].from;
    for (const s of m.states.slice(1)) {
      const atFinal = s.pos.every((v, i) => Math.abs(v - p[i]) < 0.5) && !s.rot;
      it.states.push({ step: base + s.step, scene: first.scene, pos: atFinal ? it.final.pos : s.pos, rot: s.rot ?? it.final.rot, from: s.from, delay: 0.2 });
    }
    it.states.sort((a, c) => a.step - c.step);
  }
}

function draw(b: PlanBuilder, s: ProductSpec, g: Guide) {
  return drawRecipe(b, s, recipeOf(g));
}

function drawRecipe(b: PlanBuilder, s: ProductSpec, r: Recipe) {
  const base = b.steps.length;
  buildCustom(b, { ...s, custom: { parts: r.parts, steps: r.steps } });
  applyMoves(b, base, r);
  return true;
}

/* ---------- BESTÅ BURS ---------- */

/**
 * BESTÅ BURS, read from its own manual: the two dividers take the hinge plates and flap stops, stand on dowels in the
 * bottom (screwed from below), the ends go on with dowels and cam bolts, and the top on twelve dowels and eight cam
 * bolts. Face down it gets five feet and two hardboard backs, nailed (the middle stays open for cables). Then the wall
 * bracket, runners, two middle shelves, three flaps on two hinges each, two big drawers built face down on the rug
 * (each with a castor under its front) and the loose tray that hangs in the left drawer.
 */
function bursRecipe(s: ProductSpec): Recipe {
  const r = new Recipe();
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10), D = Math.round(s.size.d * 10);
  const TT = 30, yb = 60, yt = H - TT; // top thickness, underside of the bottom, underside of the top
  const zb = -D / 2 + 3, zf = D / 2 - DT - 1; // back edge of the carcass (the backs are on it), its front edge
  const xs = W / 2 - T; // inside of the end panels
  const cwid = (2 * xs - 2 * T) / 3; // each of the three compartments
  const xv = cwid / 2 + T / 2; // divider centres
  const dz = zf - zb, cz = (zf + zb) / 2;
  const B = "BT", TP = "TP", SL = "SL", SR = "SR", V1 = "V1", V2 = "V2";
  const side = (sx: number) => (sx < 0 ? SL : SR);
  const div = (sx: number) => (sx < 0 ? V1 : V2);
  r.part(B, "Bottom panel", [2 * xs, T, dz], [0, yb + T / 2, cz]);
  r.part(TP, "Top panel", [W, TT, D], [0, yt + TT / 2, 0]);
  for (const sx of [-1, 1]) r.part(side(sx), "End panel", [T, yt - yb, dz], [sx * (xs + T / 2), (yb + yt) / 2, cz]);
  for (const sx of [-1, 1]) r.part(div(sx), "Divider", [T, yt - yb - T, dz], [sx * xv, (yb + T + yt) / 2, cz]);
  for (const sx of [-1, 1]) r.part(sx < 0 ? "K1" : "K2", "Back panel", [W / 2 - xv, yt - yb, 3], [sx * (W / 2 + xv) / 2, (yb + yt) / 2, -D / 2 + 1.5], "fiber");
  const feet: Vec3[] = [...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - 35), 0, sz > 0 ? zf - 35 : zb + 35] as Vec3)), [0, 0, zb + 35]];
  feet.forEach((f, k) => r.part(`G${k}`, "Foot", [70, yb, 70], [f[0], yb / 2, f[2]]));
  // the fronts: a drawer at each end, three flaps in the middle, all under the top
  const fw = W / 3 - GAP, fy0 = 80, fy1 = yt - 5, fz = D / 2 - DT / 2;
  const fh = (fy1 - fy0 - 2 * GAP) / 3;
  const flapY = (k: number) => fy0 + k * (fh + GAP) + fh / 2;
  for (let k = 0; k < 3; k++) {
    r.part(`FL${k}`, "Flap", [fw, fh, DT], [0, flapY(k), fz]);
    r.part(`FR${k}`, "Flap rail", [fw - 60, 14, 14], [0, flapY(k) + fh / 2 - 10, zf - 6], "metal");
  }
  const shelfY = [flapY(0) + fh / 2 + GAP / 2, flapY(1) + fh / 2 + GAP / 2];
  shelfY.forEach((y, k) => r.part(`SH${k}`, "Shelf", [2 * (xv - T / 2) - 2, T, 320], [0, y, zb + 160]));
  // the drawers: a box on runners behind each end front
  const dw = cwid - 26, dy0 = 100, dy1 = 380, dzb = zb + 30;
  const dcx = (sx: number) => sx * (xv + T / 2 + cwid / 2);
  for (const sx of [-1, 1]) {
    const q = sx < 0 ? "L" : "R", x = dcx(sx);
    r.part(`D${q}F`, "Drawer front", [fw, fy1 - fy0, DT], [sx * W / 3, (fy0 + fy1) / 2, fz]);
    for (const t of [-1, 1]) r.part(`D${q}S${t < 0 ? 1 : 2}`, "Drawer side", [T, dy1 - dy0, zf + 1 - dzb], [x + t * (dw / 2 - T / 2), (dy0 + dy1) / 2, (zf + 1 + dzb) / 2]);
    r.part(`D${q}K`, "Drawer back", [dw - 2 * T, dy1 - dy0, T], [x, (dy0 + dy1) / 2, dzb + T / 2]);
    r.part(`D${q}B`, "Drawer bottom", [dw - 2 * T + 8, 5, zf - dzb - T - 4], [x, dy0 + 12, (zf + dzb + T) / 2 - 2], "fiber");
    r.part(`D${q}R`, "Drawer rail", [dw, 20, 20], [x, dy1 + 10, dzb + 10], "metal");
  }
  // the tray hangs between the left drawer's sides, at the front
  const tx = dcx(-1), tin = dw / 2 - T, ty0 = dy1 - 80, tz0 = 20, tz1 = zf - 10;
  for (const t of [-1, 1]) r.part(`TE${t < 0 ? 1 : 2}`, "Tray end", [3, 80, tz1 - tz0], [tx + t * (tin - 1.5), ty0 + 40, (tz0 + tz1) / 2], "metal");
  [tz0 + 12, tz1 - 12].forEach((z, k) => r.parts.push({ id: `TR${k}`, name: "Tray rod", size: [2 * tin - 6, 10, 10], pos: [tx, dy1 - 10, z], shape: "cyl", material: "metal" }));
  r.part("TB", "Tray bottom", [2 * tin - 6, 3, tz1 - tz0], [tx, ty0 + 1.5, (tz0 + tz1) / 2], "metal");

  const zz = [-1, 1].map((t) => cz + t * 100);
  const z3 = [-1, 0, 1].map((t) => cz + t * 150);
  const ups = [...[-1, 1].map((sx) => ({ id: side(sx), x: sx * (xs + T / 2) })), ...[-1, 1].map((sx) => ({ id: div(sx), x: sx * xv }))];
  const mid = (sx: number) => sx * (xv - T / 2); // a divider's face towards the middle
  const plateAt = (sx: number) => [0, 1, 2].map((k) => [mid(sx), flapY(k), zf - 25] as Vec3);
  const HINGE_X = fw / 2 - 24;

  r.step({
    title: "Screw the hinge plates onto the dividers",
    detail: "Three on each, on the face that will look into the middle, near the front edge. Their screws are already in them.",
    fix: [-1, 1].map((sx) => fix("plate", plateAt(sx), [-sx, 0, 0], { on: div(sx), len: 40, dia: 30 })).map((f) => ({ ...f, name: "Hinge plate" })),
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  r.step({
    title: "Screw in the flap stops",
    detail: "Three in each divider, just below the hinge plates: the stud first, then the sleeve pushed over it.",
    fix: [-1, 1].map((sx) => ({ ...fix("pin", plateAt(sx).map((p) => [p[0], p[1] - 40, p[2] + 10] as Vec3), [-sx, 0, 0], { on: div(sx), len: 16, dia: 8 }), name: "Flap stop" })),
    tools: ["screwdriver"],
  });
  const sDiv = r.step({
    title: "Stand the dividers on the bottom",
    detail: "Lay the bottom on its back edge, tap three dowels in at each divider's place, then push the dividers onto them.",
    add: [B, V1, V2], // the dividers are already out for their plates; listed so they count as added here
    fix: [-1, 1].map((sx) => fix("dowel", z3.map((z) => [sx * xv, yb + T, z] as Vec3), [0, -1, 0], { on: B, mate: div(sx), len: 30, dia: 8 })),
    pose: "+z",
    warnings: ["floor"],
  });
  r.step({
    title: "Screw the dividers on from below",
    detail: "Two long screws through the bottom into each divider, with the Allen key.",
    fix: [-1, 1].map((sx) => ({ ...fix("bolt", zz.map((z) => [sx * xv, yb, z] as Vec3), [0, 1, 0], { on: B, mate: div(sx), len: 50, dia: 7 }), name: "Allen screw" })),
  });
  r.step({
    title: "Screw the cam bolts into the end panels",
    detail: "Two in each, by hand, in the holes near the bottom edge.",
    fix: [-1, 1].map((sx) => fix("camScrew", zz.map((z) => [sx * xs, yb + T / 2, z] as Vec3), [sx, 0, 0], { on: side(sx), mate: B, ...BOLT })),
    wait: [SL, SR],
    tools: ["screwdriver"],
  });
  r.step({
    title: "Push the end panels onto the bottom",
    detail: "Three dowels in each end panel first, then push them onto the ends of the bottom, the grooves at the back.",
    add: [SL, SR],
    fix: [-1, 1].map((sx) => fix("dowel", z3.map((z) => [sx * xs, yb + T / 2, z] as Vec3), [sx, 0, 0], { on: side(sx), mate: B, len: 30, dia: 8 })),
  });
  r.step({
    title: "Turn the cam locks in the bottom",
    detail: "Two at each end, arrow towards the bolt, then clockwise until tight.",
    fix: [-1, 1].map((sx) => fix("cam", zz.map((z) => [sx * (xs - 32), yb + T, z] as Vec3), [0, -1, 0], { on: B, ...CAM })),
    tools: ["screwdriver"],
  });
  const sTop = r.step({
    title: "Screw the cam bolts into the top",
    detail: "Eight in the underside, a pair over each end panel and each divider. Lay the top on the rug, glossy side down.",
    fix: ups.map((u) => fix("camScrew", zz.map((z) => [u.x, yt, z] as Vec3), [0, 1, 0], { on: TP, mate: u.id, ...BOLT })),
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  const sLower = r.step({
    title: "Stand it up and lower the top on",
    detail: "Twelve dowels in the top edges of the end panels and dividers, then lower the top so every bolt finds its hole.",
    add: [TP],
    fix: ups.map((u) => fix("dowel", z3.map((z) => [u.x, yt, z] as Vec3), [0, -1, 0], { on: u.id, mate: TP, len: 30, dia: 8 })),
    pose: "+y",
    people: 2,
  });
  // the dividers lie on the rug for their plates, then go onto the bottom's dowels; the top waits beside until it is lowered on
  for (const sx of [-1, 1]) {
    const id = div(sx);
    r.moves.push({ id, states: [{ step: 0, pos: [sx * 320, T / 2, D / 2 + 260], rot: [0, 0, Math.PI / 2] }, { step: sDiv, pos: r.pos(id), from: [0, 0, -260] }] });
  }
  r.moves.push({ id: TP, states: [{ step: sTop, pos: [0, yt + TT / 2 + 420, 0] }, { step: sLower, pos: r.pos(TP), from: [0, 300, 0] }] });
  r.step({
    title: "Turn the cam locks under the top",
    detail: "Two in each end panel and each divider, clockwise until the top is pulled down tight.",
    fix: [
      ...[-1, 1].map((sx) => fix("cam", zz.map((z) => [sx * xs, yt - 32, z] as Vec3), [sx, 0, 0], { on: side(sx), ...CAM })),
      ...[-1, 1].map((sx) => fix("cam", zz.map((z) => [mid(sx), yt - 32, z] as Vec3), [sx, 0, 0], { on: div(sx), ...CAM })),
    ],
    tools: ["screwdriver"],
  });
  r.step({
    title: "Lay it on its front and screw on the feet",
    detail: "On the rug, together. Two screws hold each foot: one at each end of the end panels and one in the middle at the back.",
    add: feet.map((_, k) => `G${k}`),
    from: Object.fromEntries(feet.map((_, k) => [`G${k}`, [0, -220, 0] as Vec3])),
    fix: feet.map((f, k) => ({ ...fix("screw", [-1, 1].map((t) => [f[0] + t * 15, 12, f[2] + t * 15] as Vec3), [0, 1, 0], { on: `G${k}`, mate: B, len: 60, dia: 4.5 }), name: "Long screw" })),
    pose: "-z",
    people: 2,
    tools: ["screwdriver"],
    warnings: ["two", "floor"],
  });
  r.step({ title: "Press a felt pad under each foot", detail: "One on the underside of each of the five feet.", fix: [fix("glide", feet, [0, 1, 0], { len: 4, dia: 40 })] });
  r.step({
    title: "Mark the dividers on the back edges",
    detail: "Draw a pencil line across the back edge of the top and bottom at the middle of each divider, so you'll know where to nail.",
    tools: ["pencil"],
  });
  const nailsOf = (sx: number, which: "corner" | "rest") => {
    const k = sx < 0 ? "K1" : "K2";
    const xo = sx * (xs + T / 2), xd = sx * xv;
    const pts: Vec3[] =
      which === "corner"
        ? [[xo, yt - 20, -D / 2], [xd, yt - 20, -D / 2]]
        : [
            ...[yb + 60, yb + 160, yb + 260, yt - 100].map((y) => [xo, y, -D / 2] as Vec3),
            ...[yb + 60, yb + 160, yb + 260, yt - 100].map((y) => [xd, y, -D / 2] as Vec3),
            ...[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => [xd + (xo - xd) * t, yb + T / 2, -D / 2] as Vec3),
          ];
    return fix("nail", pts, [0, 0, 1], { on: k, len: 20, dia: 1.6 });
  };
  r.step({
    title: "Lay the two backs on and tack their corners",
    detail: "Smooth side in. Line each one up with the outer corners and drive one nail at each top corner.",
    add: ["K1", "K2"],
    from: { K1: [0, 0, -260], K2: [0, 0, -260] },
    fix: [nailsOf(-1, "corner"), nailsOf(1, "corner")],
    tools: ["hammer"],
  });
  r.step({ title: "Mark the dividers on the backs", detail: "Join up your pencil marks across each back, so the nails go into the middle of the divider." , tools: ["pencil"] });
  r.step({
    title: "Nail the backs on",
    detail: "Thirteen nails in each, into the end panel, the divider and the bottom. The middle stays open for the cables.",
    fix: [nailsOf(-1, "rest"), nailsOf(1, "rest")],
    tools: ["hammer"],
  });
  r.step({
    title: "Stand it up and screw on the wall bracket",
    detail: "Under the top at the back, in the middle, with one screw and a washer.",
    fix: [
      { ...fix("bracket", [[0, yt, -D / 2 + 10]], [0, 1, 0], { on: TP, len: 60, dia: 40 }), name: "Wall bracket" },
      fix("washer", [[0, yt, -D / 2 + 22]], [0, 1, 0], { on: TP, len: 1.5, dia: 16 }),
      fix("screw", [[0, yt, -D / 2 + 22]], [0, 1, 0], { on: TP, len: 16, dia: 4 }),
    ],
    pose: "+y",
    people: 2,
    tools: ["screwdriver"],
    warnings: ["two"],
    wall: false,
  });
  r.step({
    title: "Screw the bracket to the wall",
    detail: "Push the bench against the wall, then one screw with a washer through the bracket. Wall screws and plugs aren't included: pick ones made for your wall.",
    fix: [
      fix("plug", [[0, yt - 25, -D / 2 - 30]], [0, 0, -1], { len: 35, dia: 8 }),
      fix("washer", [[0, yt - 25, -D / 2 + 4]], [0, 0, -1], { len: 1.5, dia: 16 }),
      fix("screw", [[0, yt - 25, -D / 2 + 4]], [0, 0, -1], { len: 50, dia: 5 }),
    ],
    tools: ["drill", "screwdriver", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  });
  const runnerAt: { id: string; x: number; d: number }[] = [
    { id: SL, x: -xs, d: -1 },
    { id: V1, x: -(xv + T / 2), d: 1 },
    { id: V2, x: xv + T / 2, d: -1 },
    { id: SR, x: xs, d: 1 },
  ];
  const rz = (dzb + zf) / 2;
  r.step({
    title: "Screw in the drawer runners",
    detail: "Left and right runners are different: the one with the hook goes at the front. Two screws each, low down in both end compartments.",
    fix: runnerAt.flatMap((u) => [
      fix("runner", [[u.x, dy0 + 10, rz]], [u.d, 0, 0], { on: u.id, len: zf - dzb - 10, dia: 30 }),
      fix("screw", [-1, 1].map((t) => [u.x, dy0 + 10, rz + t * 120] as Vec3), [u.d, 0, 0], { on: u.id, len: 12, dia: 4 }),
    ]),
    tools: ["screwdriver"],
  });
  r.step({
    title: "Put in the shelf pins",
    detail: "Four on each side of the middle compartment, in the holes just above each flap's line.",
    fix: shelfY.flatMap((y) => [-1, 1].map((sx) => fix("pin", [-1, 1].map((t) => [mid(sx), y - T / 2 - 3, zb + 160 + t * 110] as Vec3), [sx, 0, 0], { on: div(sx), len: 16, dia: 5 }))),
  });
  r.step({
    title: "Slide in the two shelves",
    detail: "Lay them on the pins, pushed right to the back.",
    add: ["SH0", "SH1"],
    from: { SH0: [0, 0, 420], SH1: [0, 0, 420] },
  });
  const flaps = [0, 1, 2].map((k) => `FL${k}`);
  const rails = [0, 1, 2].map((k) => `FR${k}`);
  const sFlap = r.step({
    title: "Screw two hinges onto each flap",
    detail: "Lay the three flaps face down on the rug. One left and one right hinge on each, the cups in the round holes, two screws each.",
    add: flaps,
    fix: [0, 1, 2].flatMap((k) => [
      fix("hinge", [-1, 1].map((t) => [t * HINGE_X, flapY(k), zf + 1] as Vec3), [0, 0, 1], { on: `FL${k}` }),
      fix("screw", [-1, 1].flatMap((t) => [-1, 1].map((u) => [t * HINGE_X, flapY(k) + u * 22, zf + 1] as Vec3)), [0, 0, 1], { on: `FL${k}`, len: 12, dia: 3.5 }),
    ]),
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  r.step({
    title: "Screw a rail along each flap",
    detail: "Along the top edge on the back, three screws each.",
    add: rails,
    fix: [0, 1, 2].map((k) => fix("screw", [-200, 0, 200].map((x) => [x, flapY(k) + fh / 2 - 10, zf - 13] as Vec3), [0, 0, 1], { on: `FR${k}`, mate: `FL${k}`, len: 20, dia: 3.5 })),
    tools: ["screwdriver"],
  });
  const sHang = r.step({
    title: "Click the flaps onto the hinge plates",
    detail: "From the bottom flap up: slide each hinge onto its plate until it clicks, then tighten the screw on the plate.",
    tools: ["screwdriver"],
  });
  // flaps and their rails lie face down on the rug in front while the hinges and rails go on
  const lay = (p: Vec3, c: Vec3, at: Vec3): Vec3 => [at[0] + p[0] - c[0], at[1] - (p[2] - c[2]), at[2] + (p[1] - c[1])];
  const FACE: Vec3 = [Math.PI / 2, 0, 0];
  [0, 1, 2].forEach((k) => {
    const c = r.pos(`FL${k}`);
    const at: Vec3 = [0, DT / 2, D / 2 + 140 + fh / 2 + k * (fh + 50)];
    r.moves.push({ id: `FL${k}`, states: [{ step: sFlap, pos: at, rot: FACE }, { step: sHang, pos: c, from: [0, 0, 320] }] });
    r.moves.push({ id: `FR${k}`, states: [{ step: sFlap + 1, pos: lay(r.pos(`FR${k}`), c, at), rot: FACE, from: [0, 160, 0] }, { step: sHang, pos: r.pos(`FR${k}`), from: [0, 0, 320] }] });
  });

  // the drawers are built face down on the rug, then hung on the runners
  const dq = ["L", "R"] as const;
  const dids = (q: string, what: string) => `D${q}${what}`;
  const sF = r.step({
    title: "Screw the cam bolts into both drawer fronts",
    detail: "Lay each front face down on the rug. Four bolts in each, by hand.",
    add: dq.map((q) => dids(q, "F")),
    fix: [-1, 1].map((sx, i) => fix("camScrew", [-1, 1].flatMap((t) => [dy0 + 50, dy1 - 50].map((y) => [dcx(sx) + t * (dw / 2 - T / 2), y, zf + 1] as Vec3)), [0, 0, 1], { on: dids(dq[i], "F"), ...BOLT })),
    tools: ["screwdriver"],
    warnings: ["floor"],
  });
  r.step({
    title: "Screw a castor onto each front",
    detail: "In the middle of the bottom edge, on the back, two screws each. The wheel hangs below the front.",
    fix: [-1, 1].flatMap((sx, i) => [
      fix("castor", [[sx * W / 3, fy0, zf - 12]], [0, 1, 0], { on: dids(dq[i], "F"), len: fy0, dia: 45 }),
      fix("screw", [-1, 1].map((t) => [sx * W / 3 + t * 30, fy0 + 25, zf + 1] as Vec3), [0, 0, 1], { on: dids(dq[i], "F"), len: 15, dia: 4 }),
    ]),
    tools: ["screwdriver"],
  });
  const sSide = r.step({
    title: "Stand the drawer sides on the fronts",
    detail: "Two small dowels in each side's front end, then push them onto the front over the cam bolts.",
    add: dq.flatMap((q) => [dids(q, "S1"), dids(q, "S2")]),
    fix: [-1, 1].flatMap((sx, i) => [-1, 1].map((t) => fix("dowel", [dy0 + 110, dy1 - 110].map((y) => [dcx(sx) + t * (dw / 2 - T / 2), y, zf + 1] as Vec3), [0, 0, 1], { on: dids(dq[i], "F"), mate: dids(dq[i], t < 0 ? "S1" : "S2"), len: 25, dia: 6 }))),
  });
  r.step({
    title: "Turn the cam locks in the drawer sides",
    detail: "Two in each side, arrow towards the bolt, then clockwise until tight.",
    fix: [-1, 1].flatMap((sx, i) => [-1, 1].map((t) => fix("cam", [dy0 + 50, dy1 - 50].map((y) => [dcx(sx) + t * (dw / 2 - T), y, zf - 32] as Vec3), [t, 0, 0], { on: dids(dq[i], t < 0 ? "S1" : "S2"), ...CAM }))),
    tools: ["screwdriver"],
  });
  const sBot = r.step({ title: "Slide the drawer bottoms into the grooves", detail: "All the way down to the front.", add: dq.map((q) => dids(q, "B")) });
  const sBack = r.step({ title: "Lay the drawer backs on", detail: "Between the two sides, flush with their ends.", add: dq.map((q) => dids(q, "K")) });
  r.step({
    title: "Knock in the fittings for the backs",
    detail: "Three through each side into the back, tapped in with a hammer.",
    fix: [-1, 1].flatMap((sx, i) => [-1, 1].map((t) => ({ ...fix("nail", [dy0 + 50, (dy0 + dy1) / 2, dy1 - 50].map((y) => [dcx(sx) + t * (dw / 2), y, dzb + T / 2] as Vec3), [-t, 0, 0], { on: dids(dq[i], t < 0 ? "S1" : "S2"), mate: dids(dq[i], "K"), len: 30, dia: 8 }), name: "Push fitting" }))),
    tools: ["hammer"],
  });
  r.step({ title: "Pull the runners out", detail: "All four, until they lock open, with their catches at the front." });
  const sIn = r.step({
    title: "Put the drawers on the runners",
    detail: "Rest each drawer on its pulled-out runners, push it in and press until both catches click.",
    people: 1,
  });
  r.step({ title: "Line up the drawer fronts", detail: "Turn the wheel on each catch to raise or lower the front until the gaps are even with the flaps." });
  r.step({ title: "Wipe off the fingerprints", detail: "A soft damp cloth on the glossy top and fronts, then a dry one." });
  r.step({
    title: "Screw a rail onto each drawer",
    detail: "Along the top at the back, three screws each, into both sides and the back.",
    add: dq.map((q) => dids(q, "R")),
    fix: [-1, 1].map((sx, i) => fix("screw", [-1, 0, 1].map((t) => [dcx(sx) + t * (dw / 2 - T / 2), dy1 + 20, dzb + 10] as Vec3), [0, -1, 0], { on: dids(dq[i], "R"), mate: dids(dq[i], "K"), len: 30, dia: 3.5 })),
    tools: ["screwdriver"],
  });
  dq.forEach((q) => {
    const c = r.pos(dids(q, "F"));
    const at: Vec3 = [c[0], DT / 2, D / 2 + 140 + (fy1 - fy0) / 2];
    const ids2 = ["F", "S1", "S2", "B", "K"];
    const first: Record<string, number> = { F: sF, S1: sSide, S2: sSide, B: sBot, K: sBack };
    const drop: Record<string, Vec3 | undefined> = { S1: [0, 260, 0], S2: [0, 260, 0], B: [0, 300, 0], K: [0, 220, 0] };
    for (const w of ids2) {
      const id = dids(q, w);
      r.moves.push({ id, states: [{ step: first[w], pos: lay(r.pos(id), c, at), rot: FACE, from: drop[w] }, { step: sIn, pos: r.pos(id), from: [0, 0, 420] }] });
    }
  });

  // the tray is built on the floor in front and lifted into the left drawer
  const trayIds = ["TE1", "TE2", "TR0", "TR1", "TB"];
  const sTray = r.step({
    title: "Screw the tray together",
    detail: "The two rods and the bottom between the two end plates, eight screws in all.",
    add: trayIds,
    fix: [-1, 1].flatMap((t) => [
      fix("screw", [tz0 + 12, tz1 - 12].map((z) => [tx + t * tin, dy1 - 10, z] as Vec3), [-t, 0, 0], { on: t < 0 ? "TE1" : "TE2", len: 10, dia: 4 }),
      fix("screw", [tz0 + 30, tz1 - 30].map((z) => [tx + t * tin, ty0 + 1.5, z] as Vec3), [-t, 0, 0], { on: t < 0 ? "TE1" : "TE2", len: 10, dia: 4 }),
    ]),
    tools: ["screwdriver"],
  });
  r.step({
    title: "Press the rubber strips in",
    detail: "Turn the tray over, cut the strip in two and press the pieces into the edges of both end plates.",
    fix: [{ ...fix("clip", [-1, 1].flatMap((t) => [tz0 + 40, tz1 - 40].map((z) => [tx + t * (tin - 1.5), ty0, z] as Vec3)), [0, 1, 0], { len: 4, dia: 10 }), name: "Rubber strip" }],
  });
  r.step({
    title: "Stick on the bumpers",
    detail: "One on each top corner of the tray, where it rests on the drawer.",
    fix: [{ ...fix("glide", [-1, 1].flatMap((t) => [tz0 + 10, tz1 - 10].map((z) => [tx + t * (tin - 1.5), dy1, z] as Vec3)), [0, -1, 0], { len: 3, dia: 10 }), name: "Bumper" }],
  });
  const sDrop = r.step({ title: "Lift the tray into the left drawer", detail: "Open the drawer and lower the tray in at the front, so it rests on both sides." });
  const tOff: Vec3 = [0, -ty0, D / 2 + 420];
  for (const id of trayIds) r.moves.push({ id, states: [{ step: sTray, pos: add3(r.pos(id), tOff) }, { step: sDrop, pos: r.pos(id), from: [0, 260, 0] }] });
  return r;
}

const family: Family = {
  names: ["BESTÅ"],
  build(b, s) {
    if (s.row) return false;
    if (/^besta-burs-/.test(s.slug ?? "")) return drawRecipe(b, s, bursRecipe(s));
    const g = guideOf(s);
    return g ? draw(b, s, g) : false;
  },
  row(b, s) {
    const g = rowOf(s);
    return g ? draw(b, s, g) : false;
  },
};
export default family;

