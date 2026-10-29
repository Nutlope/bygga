import type { Family } from "./family";
import type { PartMaterial, PartPiece, ProductSpec, StepKind, ToolId, Vec3, WarnId, Pose } from "../../types";
import type { HwDef, PlanBuilder } from "../builder";

/*
 * GLADSTAD, read from its manuals (twin; double and king; the storage box).
 *   Headboard: the cover is pulled over the padded base, the wooden frame is bolted on top with four bolts and
 *   washers, then the cover is pulled up over it and zipped shut. Felt pads go under the four feet, which screw
 *   into the bottom of the headboard and the footboard while they lie flat; bolts are turned halfway into their
 *   inner faces for the rails (and the centre beam) to hang on.
 *   Side rails: lying flat, a steel angle is bolted along each (two bolts at the ends, six along it), then two slat
 *   holders. The double and king have a centre beam with a hanging plate at each end, slat holders, and a crossbar
 *   under it on a middle leg, held by one long screw. Two people hang the beam (or the first rail) between the
 *   headboard and the footboard, then the rails; the hanging bolts are tightened; the crossbar is bolted to the
 *   angles; the slats roll out.
 *   Storage box: built on its front: clips and a handle in the front, dowels and cam bolts, the ends on cam locks,
 *   the back on dowels and push-in bolts with cam locks, four castors, the bottom slid in and clipped, two stops.
 * IKEA's sizes: 7 cm wider than the mattress, 202 cm long (212 for 200 cm mattresses); headboard 95, footboard 33.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, b: number, n: number) => (n === 1 ? [(a + b) / 2] : range(n).map((i) => a + ((b - a) * i) / (n - 1)));

const PIN: HwDef = { kind: "bolt", len: 12, dia: 6 };
const ANGLE_BOLT: HwDef = { kind: "bolt", len: 16, dia: 6 };
const STOP_BOLT: HwDef = { kind: "bolt", len: 12, dia: 5 };
const HOLDER: HwDef = { kind: "cap", len: 18, dia: 22, name: "Slat holder" };
const FRAME_BOLT: HwDef = { kind: "bolt", len: 40, dia: 8 };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 24 };
const FOOT: HwDef = { kind: "foot", len: 30, dia: 50 };
const PAD: HwDef = { kind: "glide", len: 3, dia: 45 };

interface StepIn {
  title: string;
  detail?: string;
  tools?: ToolId[];
  people?: 1 | 2;
  pose?: Pose;
  warnings?: WarnId[];
  kind?: StepKind;
  scene?: string;
  check?: "square";
  repeat?: number;
}

type Rot = { axis: 0 | 1 | 2; a: number };

/** Turns an offset about one axis, the way three.js turns a part by that Euler angle. */
function turn(v: Vec3, r: Rot): Vec3 {
  const c = Math.cos(r.a), s = Math.sin(r.a);
  const [x, y, z] = v;
  if (r.axis === 0) return [x, y * c - z * s, y * s + z * c];
  if (r.axis === 1) return [x * c + z * s, y, -x * s + z * c];
  return [x * c - y * s, x * s + y * c, z];
}

type M3 = number[][];
const mul = (a: M3, b: M3): M3 => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
/** The matrix of a three.js "XYZ" Euler turn. */
function matOf([x, y, z]: Vec3): M3 {
  const [a, b, c] = [x, y, z].map(Math.cos), [d, e, f] = [x, y, z].map(Math.sin);
  const rx = [[1, 0, 0], [0, a, -d], [0, d, a]], ry = [[b, 0, e], [0, 1, 0], [-e, 0, b]], rz = [[c, -f, 0], [f, c, 0], [0, 0, 1]];
  return mul(mul(rx, ry), rz);
}
/** Back to an "XYZ" Euler turn, as three.js reads one from a matrix. */
function eulerOf(m: M3): Vec3 {
  const y = Math.asin(Math.max(-1, Math.min(1, m[0][2])));
  if (Math.abs(m[0][2]) < 0.9999999) return [Math.atan2(-m[1][2], m[2][2]), y, Math.atan2(-m[0][1], m[0][0])];
  return [Math.atan2(m[2][1], m[1][1]), y, 0];
}

/** Parts placed where they end up; steps bring them in, in the main scene or laid out on their own in another. */
class Kit {
  private keys = new Map<string, string>();
  private boxes = new Map<string, { pos: Vec3; rot: Vec3 }>();
  private types = new Map<string, string>();
  private pose: Pose = "+y";
  constructor(public b: PlanBuilder) {}

  part(id: string, name: string, size: Vec3, pos: Vec3, o: { mat?: PartMaterial; shape?: "box" | "cyl"; pieces?: PartPiece[]; rot?: Vec3 } = {}) {
    const tk = [name, size.map(Math.round).join("x"), o.shape ?? "box", o.mat ?? "board", o.pieces ? JSON.stringify(o.pieces) : ""].join("|");
    let t = this.types.get(tk);
    if (!t) {
      t = this.b.part(name, size, { shape: o.shape ?? "box", material: o.mat ?? "board" });
      if (o.pieces) this.b.parts[this.b.parts.length - 1].pieces = o.pieces;
      this.types.set(tk, t);
    }
    const rot = o.rot ?? [0, 0, 0];
    this.keys.set(id, this.b.place(t, pos, rot));
    this.boxes.set(id, { pos, rot });
  }
  key(id: string) {
    const k = this.keys.get(id);
    if (!k) throw new Error(`GLADSTAD: no part ${id}`);
    return k;
  }
  step(s: StepIn, body: () => void) {
    const side = !!s.scene && s.scene !== "main";
    if (s.pose && !side) this.pose = s.pose;
    const warnings = new Set<WarnId>(s.warnings ?? []);
    if (s.people === 2) warnings.add("two");
    this.b.step({ title: s.title, detail: s.detail, tools: s.tools ?? [], people: s.people ?? 1, pose: side ? (s.pose ?? "+y") : this.pose, warnings: [...warnings].slice(0, 3), kind: s.kind ?? "general", scene: s.scene, check: s.check, repeat: s.repeat }, body);
  }
  add(ids: string[], from?: Vec3 | ((id: string) => Vec3)) {
    this.b.stagger(ids.length > 4 ? 0.12 : 0.24);
    for (const id of ids) this.b.add(this.key(id), typeof from === "function" ? from(id) : from);
    this.b.then(0.12);
  }
  /** Shown in this step's scene where it will end up, until it is added to the bed. */
  stage(ids: string[], from?: Vec3) {
    this.b.stagger(ids.length > 4 ? 0.12 : 0.24);
    for (const id of ids) {
      const p = this.boxes.get(id)!;
      this.b.stage(this.key(id), p.pos, p.rot, from);
    }
    this.b.then(0.12);
  }
  /** Parts that go together, shown turned about one axis around `c` and moved to `to` (laid flat on the floor). */
  stageGroup(ids: string[], c: Vec3, to: Vec3, r: Rot, from?: Vec3) {
    this.b.stagger(0.18);
    for (const id of ids) {
      const p = this.boxes.get(id)!;
      const d = turn([p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]], r);
      const turnBy: Vec3 = [0, 0, 0];
      turnBy[r.axis] = r.a;
      // a part already turned in the bed (the left slat rail) keeps that turn inside the group's
      const rot = p.rot.some((a) => a) ? eulerOf(mul(matOf(turnBy), matOf(p.rot))) : turnBy;
      this.b.stage(this.key(id), [to[0] + d[0], to[1] + d[1], to[2] + d[2]], rot, from);
    }
    this.b.then(0.12);
  }
  fit(def: HwDef, pts: Vec3[], dir: Vec3 | ((p: Vec3) => Vec3), on?: string | ((p: Vec3) => string), o: { mate?: string | ((p: Vec3) => string); hole?: false; preset?: boolean } = {}) {
    if (!pts.length) return;
    const id = (f: string | ((p: Vec3) => string) | undefined, p: Vec3) => (f === undefined ? undefined : this.key(typeof f === "function" ? f(p) : f));
    const list = pts.map((at) => ({ at, dir: typeof dir === "function" ? dir(at) : dir, on: id(on, at), mate: id(o.mate, at), hole: o.hole }));
    if (o.preset) {
      for (const f of list) this.b.preset(def, f);
      return;
    }
    this.b.stagger(0.05);
    this.b.fits(def, list, Math.min(0.07, 2.4 / Math.max(1, pts.length)));
    this.b.then(0.1);
  }
}

/** The mattress size in the variant ("Standard Double, 135 × 190 cm"), in mm. */
function mattress(s: ProductSpec): [number, number] | null {
  const m = /(\d{2,3})\s*[×x]\s*(\d{3})/.exec(s.variant);
  return m ? [+m[1] * 10, +m[2] * 10] : null;
}

/** One roll of slats on two tapes, lying along the bed. */
function slatRoll(w: number, len: number): PartPiece[] {
  const n = Math.max(8, Math.round(len / 115));
  const pitch = (len - 63) / (n - 1);
  return [
    ...range(n).map((i): PartPiece => ({ shape: "box", size: [w, 10, 63], pos: [0, 3, -len / 2 + 31.5 + i * pitch] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [24, 4, len], pos: [sx * (w / 2 - 90), -4, 0], material: "fiber" })),
  ];
}

/* ---------- the storage box ---------- */

const BX = { D: 600, L: 930, y0: 10, H: 203, tf: 18, t: 16 };

interface BoxAt {
  p: string; // id prefix
  sx: number; // the side of the bed its front is on
  z: number; // centre along the bed
}

function boxParts(k: Kit, W: number, bx: BoxAt) {
  const { D, L, y0, H, tf, t } = BX;
  const xo = bx.sx * (W / 2); // the front's outer face, flush with the rail
  const xIn = (d: number) => xo - bx.sx * d; // a distance in from the front
  const yc = y0 + H / 2;
  k.part(`${bx.p}F`, "Box front", [tf, H, L], [xIn(tf / 2), yc, bx.z], { mat: "soft" });
  k.part(`${bx.p}K`, "Box back", [t, H, L], [xIn(D - t / 2), yc, bx.z]);
  for (const e of [-1, 1]) k.part(`${bx.p}E${e}`, "Box end", [D - tf - t, H, t], [xIn((D + tf - t) / 2), yc, bx.z + e * (L / 2 - t / 2)]);
  k.part(`${bx.p}B`, "Box bottom", [D - tf - t + 10, 4, L - 2 * t + 10], [xIn((D + tf - t) / 2), y0 + 18, bx.z], { mat: "fiber" });
}

/** Where a box's fittings go, in the finished bed. */
function boxPoints(W: number, bx: BoxAt) {
  const { D, L, y0, H, tf, t } = BX;
  const xo = bx.sx * (W / 2);
  const xIn = (d: number) => xo - bx.sx * d;
  const ze = (e: number) => bx.z + e * (L / 2 - t / 2);
  const ends = [-1, 1];
  return {
    clips: spread(bx.z - L / 2 + 150, bx.z + L / 2 - 150, 3).map((z) => [xIn(tf), y0 + 12, z] as Vec3),
    handleF: [xo, y0 + H - 45, bx.z] as Vec3,
    handleK: [xIn(D), y0 + H - 45, bx.z] as Vec3,
    dowelsF: ends.map((e) => [xIn(tf), y0 + H / 2, ze(e)] as Vec3),
    dowelsK: ends.map((e) => [xIn(D - t), y0 + H / 2, ze(e)] as Vec3),
    boltsF: ends.flatMap((e) => [y0 + 40, y0 + H - 40].map((y) => [xIn(tf), y, ze(e)] as Vec3)),
    boltsK: ends.flatMap((e) => [y0 + 40, y0 + H - 40].map((y) => [xIn(D - t), y, ze(e)] as Vec3)),
    camsF: ends.flatMap((e) => [y0 + 40, y0 + H - 40].map((y) => [xIn(tf + 34), y, ze(e) - e * (t / 2)] as Vec3)),
    camsK: ends.flatMap((e) => [y0 + 40, y0 + H - 40].map((y) => [xIn(D - t - 34), y, ze(e) - e * (t / 2)] as Vec3)),
    castors: ends.flatMap((e) => [80, D - 80].map((d) => [xIn(d), y0 + 12, bx.z + e * (L / 2)] as Vec3)),
    stops: [-1, 1].map((e) => [xIn(D), y0 + H - 30, bx.z + e * (L / 2 - 120)] as Vec3),
    end: (p: Vec3) => `${bx.p}E${p[2] > bx.z ? 1 : -1}`,
  };
}

function boxFittings(k: Kit, W: number, bx: BoxAt, part: "front" | "handles" | "dowels" | "boltsF" | "camsF" | "back" | "castors" | "stops", preset = false) {
  const q = boxPoints(W, bx);
  const inward: Vec3 = [-bx.sx, 0, 0];
  const out: Vec3 = [bx.sx, 0, 0];
  const o = { preset };
  if (part === "front") k.fit({ kind: "clip", len: 16, dia: 14, name: "Bottom clip" }, q.clips, out, `${bx.p}F`, o);
  if (part === "handles") {
    k.fit({ kind: "handle", len: 150, dia: 8, name: "Pull handle" }, [q.handleF], inward, `${bx.p}F`, o);
    k.fit({ kind: "handle", len: 150, dia: 8, name: "Pull handle" }, [q.handleK], out, `${bx.p}K`, o);
  }
  if (part === "dowels") {
    k.fit({ kind: "dowel", len: 30, dia: 8 }, q.dowelsF, inward, `${bx.p}F`, o);
    k.fit({ kind: "dowel", len: 30, dia: 8 }, q.dowelsK, out, `${bx.p}K`, o);
  }
  if (part === "boltsF") k.fit({ kind: "camScrew", len: 34, dia: 7 }, q.boltsF, inward, `${bx.p}F`, o);
  if (part === "camsF") k.fit({ kind: "cam", len: 13, dia: 15 }, q.camsF, (p) => [0, 0, p[2] > bx.z ? 1 : -1], q.end, o);
  if (part === "back") {
    k.fit({ kind: "camScrew", len: 40, dia: 7, name: "Push-in cam bolt" }, q.boltsK, out, `${bx.p}K`, o);
    k.fit({ kind: "cam", len: 13, dia: 15 }, q.camsK, (p) => [0, 0, p[2] > bx.z ? 1 : -1], q.end, o);
  }
  if (part === "castors") k.fit({ kind: "castor", len: 22, dia: 45 }, q.castors, (p) => [0, 0, p[2] > bx.z ? -1 : 1], q.end, o);
  if (part === "stops") {
    k.fit({ kind: "plate", len: 30, dia: 20, name: "Stop" }, q.stops, out, `${bx.p}K`, { ...o, hole: false });
    k.fit({ kind: "screw", len: 13, dia: 3.5 }, q.stops, out, `${bx.p}K`, o);
  }
}

const boxIds = (bx: BoxAt) => ["F", "K", "E-1", "E1", "B"].map((s) => bx.p + s);

/** The first box built step by step on its front; any others the same way in one step; then all pushed in. */
function boxSteps(k: Kit, W: number, boxes: BoxAt[]) {
  const [a, ...rest] = boxes;
  const sc = "box";
  const up: Pose = a.sx > 0 ? "-x" : "+x"; // the front lies on the floor, its inside up
  const fromUp: Vec3 = [-a.sx * 300, 0, 0];
  k.step({ title: "Screw the bottom clips into the box front", detail: boxes.length > 1 ? `The boxes are built one at a time. Lay the front on a rug, inside up: three clips along its lower edge.` : "Lay the front on a rug, inside up: three clips along its lower edge.", tools: ["screwdriver"], pose: up, scene: sc, warnings: ["floor"], kind: "screws" }, () => {
    k.stage([`${a.p}F`], fromUp);
    boxFittings(k, W, a, "front");
  });
  k.step({ title: "Tap a handle into the front and the back", detail: "Both prongs of each handle into the holes near the top of the outside, with a hammer.", tools: ["hammer"], pose: up, scene: sc, kind: "general" }, () => {
    k.stageGroup([`${a.p}K`], [a.sx * (W / 2 - BX.D + BX.t / 2), 0, a.z], [a.sx * (W / 2 - BX.t / 2), 0, a.z + 1100], { axis: 1, a: Math.PI }, fromUp);
    boxFittings(k, W, a, "handles");
  });
  k.step({ title: "Tap the dowels into their ends", detail: "One into each end of the front and the back.", tools: ["hammer"], pose: up, scene: sc, kind: "dowels" }, () => boxFittings(k, W, a, "dowels"));
  k.step({ title: "Screw the cam bolts into the front", detail: "Two near each end, by hand until they stop.", tools: ["screwdriver"], pose: up, scene: sc, kind: "cams" }, () => boxFittings(k, W, a, "boltsF"));
  k.step({ title: "Stand the ends on the front", detail: "Their holes go over the bolts and the dowel.", pose: up, scene: sc, kind: "join" }, () => k.stage([`${a.p}E-1`, `${a.p}E1`], fromUp));
  k.step({ title: "Lock the ends with the cam locks", detail: "Four, arrows towards the bolts. Turn each one clockwise until it pulls tight.", tools: ["screwdriver"], pose: up, scene: sc, kind: "cams" }, () => boxFittings(k, W, a, "camsF"));
  k.step({ title: "Press the back onto the ends", detail: "Down onto the dowels, handle on the same edge as the front's.", pose: up, scene: sc, kind: "join" }, () => k.stage([`${a.p}K`], fromUp));
  k.step({ title: "Push in the bolts and lock the back", detail: "Four push-in bolts through the back into the ends, then four more cam locks.", tools: ["screwdriver"], pose: up, scene: sc, kind: "cams" }, () => boxFittings(k, W, a, "back"));
  k.step({ title: "Click the castors onto the ends", detail: "Turn the box upside down. Two castors on each end, pressed in until they click.", pose: "-y", scene: sc, kind: "legs" }, () => boxFittings(k, W, a, "castors"));
  k.step({ title: "Slide the bottom in and clip it", detail: "Smooth side in, along the grooves from the back. Turn the three clips over its edge.", pose: "-y", scene: sc, kind: "join" }, () => k.stage([`${a.p}B`], [-a.sx * 700, 0, 0]));
  k.step({ title: "Screw the stops onto the back", detail: "Turn the box over. One stop near each end, a screw in each, so the box can't roll out too far.", tools: ["screwdriver"], pose: "+y", scene: sc, kind: "screws" }, () => boxFittings(k, W, a, "stops"));
  if (rest.length)
    k.step({ title: rest.length > 1 ? `Build the other ${rest.length} boxes the same way` : "Build the second box the same way", detail: "Front, handles, dowels and cam bolts, ends, back, castors, bottom and stops.", tools: ["screwdriver", "hammer"], scene: sc, kind: "drawer", repeat: rest.length > 1 ? rest.length : undefined }, () => {
      for (const bx of rest) {
        k.stage(boxIds(bx), [0, 300, 0]);
        for (const part of ["front", "handles", "dowels", "boltsF", "camsF", "back", "castors", "stops"] as const) boxFittings(k, W, bx, part, true);
      }
    });
  k.step({ title: boxes.length > 1 ? "Roll the boxes in under the bed" : "Roll the box in under the bed", detail: "Fronts out, flush with the side rails.", kind: "drawer" }, () =>
    k.add(boxes.flatMap(boxIds), (id) => [boxes.find((b) => id.startsWith(b.p))!.sx * 500, 0, 0]),
  );
}

/* ---------- the bed ---------- */

function build(b: PlanBuilder, s: ProductSpec) {
  const slug = s.slug ?? "";
  if (!/^gladstad-upholstered-bed/.test(slug)) return false;
  const mt = mattress(s);
  if (!mt) return false;
  const [mw, ml] = mt;
  const wide = mw >= 1200; // the double manual: centre beam, middle leg, two slat rolls
  const W = mw + 70, L = ml >= 2000 ? 2120 : 2020;
  const nBoxes = +(/(\d) storage boxes/.exec(s.variant)?.[1] ?? 0);
  const k = new Kit(b);

  const T = 60; // head and foot boards
  const yf = 30; // feet
  const zH = -L / 2 + T / 2, zF = L / 2 - T / 2;
  const zi0 = -L / 2 + T, zi1 = L / 2 - T, Li = zi1 - zi0;
  const yTopF = 330;
  const yJoin = 330; // where the frame sits on the headboard base
  const rH = 90, rY = yTopF - rH / 2; // side rails
  const xA = W / 2 - 30; // inside face of the rails, where the angles sit
  const yFl = 245; // the angles' flange: slats rest on it
  const yS = yFl + 3;

  k.part("HB", "Headboard base", [W, yJoin - yf, T], [0, (yJoin + yf) / 2, zH], { mat: "soft" });
  const fh = 950 - yJoin, fw = W - 30;
  const frame: PartPiece[] = [
    { shape: "box", size: [fw, 40, 40], pos: [0, fh / 2 - 20, 0] },
    { shape: "box", size: [fw, 40, 40], pos: [0, -fh / 2 + 20, 0] },
    ...spread(-fw / 2 + 20, fw / 2 - 20, 5).map((x): PartPiece => ({ shape: "box", size: [40, fh - 80, 40], pos: [x, 0, 0] })),
  ];
  k.part("HF", "Headboard frame", [fw, fh, 40], [0, yJoin + fh / 2, zH], { mat: "wood", pieces: frame });
  k.part("HC", "Headboard cover", [W, fh, T], [0, yJoin + fh / 2, zH], { mat: "soft" });
  k.part("FB", "Footboard", [W, yTopF - yf, T], [0, (yTopF + yf) / 2, zF], { mat: "soft" });

  for (const sx of [-1, 1]) {
    k.part(`R${sx}`, "Side rail", [30, rH, Li], [sx * (W / 2 - 15), rY, 0], { mat: "soft" });
    const len = Li - 4;
    k.part(`A${sx}`, "Slat rail", [40, 45, len], [sx * (xA - 20), yFl + 22.5, 0], {
      mat: "metal",
      rot: sx < 0 ? [0, Math.PI, 0] : undefined, // the left one is the same part turned round
      pieces: [
        { shape: "box", size: [3, 45, len], pos: [18.5, 0, 0] },
        { shape: "box", size: [40, 3, len], pos: [0, -21, 0] },
        ...[-1, 1].map((e): PartPiece => ({ shape: "box", size: [40, 70, 3], pos: [0, 12, e * (len / 2 - 1.5)] })),
      ],
    });
  }

  // the crossbar: its ends under the angles' flanges, its middle bent down (under the centre beam on the wide beds)
  const yEnd = yFl - 4, yMid = wide ? yFl - 52 : 218;
  const xe = xA - 40;
  const run = 90, xm = wide ? 70 : xe - 240;
  const ends = xe - xm - run;
  const yc = (yEnd + yMid) / 2;
  const sl = Math.hypot(run, yEnd - yMid), ang = Math.atan2(yEnd - yMid, run);
  k.part("X", "Crossbar", [2 * xe, yEnd - yMid + 8, 30], [0, yc, 0], {
    mat: "metal",
    pieces: [
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [ends, 6, 30], pos: [sx * (xe - ends / 2), yEnd - yc, 0] })),
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [sl, 6, 30], pos: [sx * (xm + run / 2), (yEnd + yMid) / 2 - yc, 0], rot: [0, 0, sx * ang] })),
      { shape: "box", size: [2 * xm, 6, 30], pos: [0, yMid - yc, 0] },
    ],
  });
  const yBeam = yS - 20; // its top level with the flanges
  if (wide) {
    k.part("C", "Centre beam", [40, 40, Li], [0, yBeam, 0], { mat: "metal" });
    k.part("CP-1", "Hanging plate", [50, 110, 3], [0, yBeam, zi0 + 1.5], { mat: "metal" });
    k.part("CP1", "Hanging plate", [50, 110, 3], [0, yBeam, zi1 - 1.5], { mat: "metal" });
    const lh = yMid - 3;
    k.part("CL", "Middle leg", [40, lh, 40], [0, lh / 2, 0], { mat: "metal", pieces: [{ shape: "cyl", size: [40, lh - 30, 40], pos: [0, -15, 0] }, { shape: "box", size: [44, 30, 34], pos: [0, lh / 2 - 15, 0] }] });
  }

  const rolls = wide ? [-1, 1].map((sx) => ({ id: `S${sx}`, x: (sx * (xA - 6 + 20)) / 2, w: xA - 30 })) : [{ id: "S0", x: 0, w: 2 * xA - 10 }];
  for (const r of rolls) k.part(r.id, "Slatted bed base", [r.w, 16, Li - 20], [r.x, yS + 8, 0], { mat: "wood", pieces: slatRoll(r.w, Li - 20) });

  const boxes: BoxAt[] = [];
  if (nBoxes) {
    const z = BX.L / 2 + 10;
    for (const sx of nBoxes >= 4 ? [1, -1] : [1]) for (const sz of [-1, 1]) boxes.push({ p: `B${boxes.length}`, sx, z: sz * z });
    for (const bx of boxes) boxParts(k, W, bx);
  }

  /* headboard */
  const head = ["HB", "HF", "HC"];
  const fx = spread(-fw / 2 + 120, fw / 2 - 120, 4);
  k.step({ title: "Pull the cover over the headboard base", detail: "Lay the cover on a rug and open its zip. Pull the lower half over the padded base.", scene: "head", warnings: ["floor"], kind: "cushions" }, () => k.stage(["HB"], [0, 200, 0]));
  k.step({ title: "Bolt the frame onto the base", detail: "Stand the base on its edge. Four bolts with washers down through the frame into it, with the short Allen key.", tools: ["allen"], scene: "head", kind: "bolts" }, () => {
    k.stage(["HF"], [0, 300, 0]);
    k.fit(WASHER, fx.map((x) => [x, yJoin + 40, zH] as Vec3), [0, -1, 0], "HF", { hole: false });
    k.fit(FRAME_BOLT, fx.map((x) => [x, yJoin + 42, zH] as Vec3), [0, -1, 0], "HF", { mate: "HB" });
  });
  k.step({ title: "Pull the cover up and zip it shut", detail: "Smooth it over the frame, then pull the zip all the way along the top.", scene: "head", kind: "cushions" }, () => k.stage(["HC"], [0, -200, 0]));

  /* the feet and the hanging bolts, both boards lying flat */
  const flat = "boards";
  const headAt: Vec3 = [0, T / 2, -120], footAt: Vec3 = [0, T / 2, 250];
  const xFoot = W / 2 - 70;
  const feet: Vec3[] = [zH, zF].flatMap((z) => [-1, 1].map((sx) => [sx * xFoot, yf, z] as Vec3));
  const board = (p: Vec3) => (p[2] < 0 ? "HB" : "FB");
  k.step({ title: "Screw the feet into the boards", detail: "Lay the headboard and the footboard on their backs on a rug. Stick a felt pad under each foot, then turn two feet into the bottom edge of each board by hand.", scene: flat, warnings: ["floor"], kind: "legs" }, () => {
    k.stageGroup(head, [0, yf, zH], headAt, { axis: 0, a: -Math.PI / 2 }, [0, 200, 0]);
    k.stageGroup(["FB"], [0, yf, zF], footAt, { axis: 0, a: Math.PI / 2 }, [0, 200, 0]);
    k.fit(FOOT, feet, [0, 1, 0], board);
    k.fit(PAD, feet.map((p) => [p[0], 1, p[2]] as Vec3), [0, 1, 0], board, { hole: false });
  });
  const pinX = W / 2 - 50;
  const pinY = [yFl + 8, yTopF - 25];
  const pins: Vec3[] = [zi0, zi1].flatMap((z) => [-1, 1].flatMap((sx) => pinY.map((y) => [sx * pinX, y, z] as Vec3)));
  const cPins: Vec3[] = wide ? [zi0, zi1].flatMap((z) => [yBeam - 40, yBeam + 40].map((y) => [0, y, z] as Vec3)) : [];
  k.step({ title: "Turn the hanging bolts halfway in", detail: `${pins.length + cPins.length} bolts into the inner faces of the two boards. Stop while they still stand out, so the rails${wide ? " and the centre beam" : ""} can hang on them.`, tools: ["allen"], scene: flat, kind: "bolts" }, () =>
    k.fit(PIN, [...pins, ...cPins], (p) => [0, 0, p[2] < 0 ? -1 : 1], board),
  );

  /* side rails, lying flat */
  const rails = "rails";
  const zA = [-(Li / 2 - 30), Li / 2 - 30];
  const zAlong = spread(-Li / 2 + 220, Li / 2 - 220, 6);
  const angle = (p: Vec3) => `A${Math.sign(p[0])}`;
  const rail = (p: Vec3) => `R${Math.sign(p[0])}`;
  const out = (p: Vec3): Vec3 => [Math.sign(p[0]), 0, 0];
  k.step({ title: "Bolt a slat rail onto each side rail", detail: "Lay both side rails on a rug, inside up, and the steel rails on them, flat edge in. Two bolts at the ends of each.", tools: ["allen"], scene: rails, warnings: ["floor"], kind: "bolts" }, () => {
    for (const sx of [-1, 1]) k.stageGroup([`R${sx}`, `A${sx}`], [sx * (W / 2 - 15), rY, 0], [sx * 260, 15, 0], { axis: 2, a: sx * (Math.PI / 2) }, [0, 200, 0]);
    k.fit(ANGLE_BOLT, [-1, 1].flatMap((sx) => zA.map((z) => [sx * xA, rY + 15, z] as Vec3)), out, angle, { mate: rail });
  });
  k.step({ title: "Bolt the slat rails along their length", detail: "Six more bolts along each.", tools: ["allen"], scene: rails, kind: "bolts" }, () =>
    k.fit(ANGLE_BOLT, [-1, 1].flatMap((sx) => zAlong.map((z) => [sx * xA, rY + 15, z] as Vec3)), out, angle, { mate: rail }),
  );
  const zHold = [-(Li / 2 - 70), Li / 2 - 70];
  k.step({ title: "Fit the slat holders", detail: "A short bolt near each end of the steel rails, then press a holder onto it.", tools: ["allen"], scene: rails, kind: "bolts" }, () => {
    const pts = [-1, 1].flatMap((sx) => zHold.map((z) => [sx * xA, yS + 14, z] as Vec3));
    k.fit(STOP_BOLT, pts, out, angle, { mate: rail });
    k.fit(HOLDER, pts.map((p) => [p[0] - Math.sign(p[0]) * 4, p[1], p[2]] as Vec3), out, angle, { hole: false });
  });

  /* the centre beam, crossbar and middle leg */
  if (wide) {
    const beam = "beam";
    k.step({ title: "Bolt the hanging plates onto the centre beam", detail: "One plate on each end, a bolt through the middle of each.", tools: ["allen"], scene: beam, kind: "bolts" }, () => {
      k.stage(["C"], [0, 200, 0]);
      k.stage(["CP-1", "CP1"], [0, 0, 0]);
      k.fit(ANGLE_BOLT, [[0, yBeam, zi0 + 3], [0, yBeam, zi1 - 3]], (p) => [0, 0, p[2] < 0 ? 1 : -1], (p) => `CP${p[2] < 0 ? -1 : 1}`, { mate: "C" });
    });
    k.step({ title: "Fit the slat holders to its ends", detail: "Two bolts across each end of the beam, a holder pressed onto each.", tools: ["allen"], scene: beam, kind: "bolts" }, () => {
      const pts = [zi0 + 50, zi0 + 90, zi1 - 90, zi1 - 50].map((z) => [-20, yBeam + 12, z] as Vec3);
      k.fit({ kind: "bolt", len: 50, dia: 6 }, pts, [1, 0, 0], "C");
      k.fit(HOLDER, pts.map((p) => [20, p[1], p[2]] as Vec3), [-1, 0, 0], "C", { hole: false });
    });
    k.step({ title: "Screw the crossbar and the middle leg under it", detail: "The crossbar's bend points down. One long screw down through the beam and the crossbar into the leg.", tools: ["allen"], scene: beam, kind: "legs" }, () => {
      k.stage(["X"], [0, -150, 0]);
      k.stage(["CL"], [0, -250, 0]);
      k.fit({ kind: "screw", len: 100, dia: 6 }, [[0, yBeam + 20, 0]], [0, -1, 0], "C", { mate: "CL" });
    });
  }

  /* together on the floor */
  const two = "Together: one holds the board up, the other lifts the end in. The plate's slots drop over the bolts.";
  if (wide) {
    k.step({ title: "Hang the centre beam on the headboard", detail: two, people: 2, kind: "join" }, () => {
      k.add(head, [0, 0, -400]);
      k.add(["C", "CP-1", "CP1", "X", "CL"], [0, 200, 0]);
    });
    k.step({ title: "Hang the footboard on the other end", detail: "Lift the beam's other plate onto the footboard's middle bolts.", people: 2, kind: "join" }, () => k.add(["FB"], [0, 0, 400]));
    k.step({ title: "Hang a side rail between the boards", detail: "Its end plates drop over the bolts in the headboard and the footboard.", people: 2, kind: "join" }, () => k.add(["R-1", "A-1"], [-400, 200, 0]));
  } else
    k.step({ title: "Hang a side rail between the boards", detail: two, people: 2, kind: "join" }, () => {
      k.add(head, [0, 0, -400]);
      k.add(["FB"], [0, 0, 400]);
      k.add(["R-1", "A-1"], [-400, 200, 0]);
    });
  k.step({ title: "Hang the other side rail", detail: "The same way.", people: 2, kind: "join" }, () => k.add(["R1", "A1"], [400, 200, 0]));
  k.step({ title: "Tighten the hanging bolts", detail: `All ${pins.length + cPins.length}, through the holes in the plates, with the long Allen key.`, tools: ["allen"], check: "square", kind: "bolts" }, () => {});
  if (!wide) k.step({ title: "Lay the crossbar across the middle", detail: "Its bend points down; its ends go under the slat rails.", kind: "join" }, () => k.add(["X"], [0, 250, 0]));
  k.step({ title: "Bolt the crossbar to the slat rails", detail: "One bolt down through each slat rail into the crossbar's end.", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(PIN, [-1, 1].map((sx) => [sx * (xe - 20), yS, 0] as Vec3), [0, -1, 0], (p) => `A${Math.sign(p[0])}`, { mate: "X" }),
  );
  k.step({ title: "Roll out the slats", detail: wide ? "One roll each side of the centre beam, curved side up. Tuck the end slats under the eight holders." : "Curved side up. Tuck the end slats under the four holders.", kind: "slats" }, () => k.add(rolls.map((r) => r.id), [0, 200, -600]));
  if (boxes.length) boxSteps(k, W, boxes);
  return true;
}

const family: Family = {
  names: ["GLADSTAD"],
  build,
};
export default family;
