import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { HwDef, PlanBuilder } from "../builder";
import { rotate } from "../math";

/*
 * BÅTSKÄR outdoor kitchen, read from its four manuals.
 * Kitchen units (open 60 x 60, closed 120 x 60): the two side frames lie on a rug for their feet, two people stand
 * them up with the middle shelf and the two foot rails between them; eight bolts hold the shelf, the unit goes upside
 * down for eight more in the foot rails, then the worktop goes on with eight. The closed unit then gets its back panel
 * (two hanging pins, three bolts), two side panels, eight bolts into the legs, the post between the doors, three doors
 * on six hinges (four screws each) and three handles. The slats click into the foot rails, the feet are levelled.
 * Add-on unit: not a kitchen unit but a rack of two trough shelves on two uprights that bolts onto the back legs of
 * a kitchen unit, 120 x 70 x 17 cm. Bar table: two side frames get their feet, a back rail joins them, upside down
 * the top tray goes on with eleven bolts and the foot stretcher with four.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const BOLT: HwDef = { kind: "bolt", len: 12, dia: 6 };
const FOOT: HwDef = { kind: "foot", len: 40, dia: 36, name: "Adjustable foot" };
const SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const PIN: HwDef = { kind: "pin", len: 14, dia: 8, name: "Hanging pin" };
const HANDLE: HwDef = { kind: "handle", len: 120, dia: 20 };

interface StepIn {
  title: string;
  detail?: string;
  tools?: ToolId[];
  people?: 1 | 2;
  pose?: Pose;
  warnings?: WarnId[];
  kind?: StepKind;
  scene?: string;
}

/** Bounding box of some pieces, and the pieces moved so the box is centred on 0. */
function shape(pieces: PartPiece[]): { size: Vec3; mid: Vec3; pieces: PartPiece[] } {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces) {
    const [sx, sy, sz] = p.size;
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const c of [-1, 1]) {
          const v = rotate([(a * sx) / 2, (b * sy) / 2, (c * sz) / 2], p.rot ?? [0, 0, 0]);
          for (let i = 0; i < 3; i++) {
            lo[i] = Math.min(lo[i], p.pos[i] + v[i]);
            hi[i] = Math.max(hi[i], p.pos[i] + v[i]);
          }
        }
  }
  const r = (n: number) => Math.round(n * 10) / 10;
  const mid: Vec3 = [r((lo[0] + hi[0]) / 2), r((lo[1] + hi[1]) / 2), r((lo[2] + hi[2]) / 2)];
  return {
    size: [r(hi[0] - lo[0]), r(hi[1] - lo[1]), r(hi[2] - lo[2])],
    mid,
    pieces: pieces.map((p) => ({ ...p, pos: [r(p.pos[0] - mid[0]), r(p.pos[1] - mid[1]), r(p.pos[2] - mid[2])] })),
  };
}

/** Parts placed where they end up; steps bring them in, in the main scene or shown on their own in another. */
class Kit {
  private keys = new Map<string, string>();
  private boxes = new Map<string, { pos: Vec3; rot: Vec3 }>();
  private types = new Map<string, string>();
  private pose: Pose = "+y";
  constructor(public b: PlanBuilder) {}

  /** A part drawn from pieces given where they sit in the finished product. */
  welded(id: string, name: string, abs: PartPiece[], mat: PartMaterial = "wood") {
    const sh = shape(abs);
    this.put(id, name, sh.size, sh.mid, mat, sh.pieces);
  }
  box(id: string, name: string, size: Vec3, pos: Vec3, mat: PartMaterial = "wood") {
    this.put(id, name, size, pos, mat);
  }
  /** The same part as `of`, turned by `rot` about its own middle and set at `pos`. */
  turned(id: string, of: string, pos: Vec3, rot: Vec3) {
    this.keys.set(id, this.b.place(this.b.partItem(this.key(of)).ref, pos, rot));
    this.boxes.set(id, { pos, rot });
  }
  mid(id: string) {
    return this.boxes.get(id)!.pos;
  }
  private put(id: string, name: string, size: Vec3, pos: Vec3, mat: PartMaterial, pieces?: PartPiece[]) {
    const tk = [name, size.map(Math.round).join("x"), mat, pieces ? JSON.stringify(pieces) : ""].join("|");
    let t = this.types.get(tk);
    if (!t) {
      t = this.b.part(name, size, { material: mat });
      if (pieces) this.b.parts[this.b.parts.length - 1].pieces = pieces;
      this.types.set(tk, t);
    }
    this.keys.set(id, this.b.place(t, pos));
    this.boxes.set(id, { pos, rot: [0, 0, 0] });
  }
  key(id: string) {
    const k = this.keys.get(id);
    if (!k) throw new Error(`BÅTSKÄR: no part ${id}`);
    return k;
  }
  step(s: StepIn, body: () => void) {
    const side = !!s.scene && s.scene !== "main";
    if (s.pose && !side) this.pose = s.pose;
    const warnings = new Set<WarnId>(s.warnings ?? []);
    if (s.people === 2) warnings.add("two");
    this.b.step({ title: s.title, detail: s.detail, tools: s.tools ?? [], people: s.people ?? 1, pose: side ? (s.pose ?? "+y") : this.pose, warnings: [...warnings].slice(0, 3), kind: s.kind ?? "general", scene: s.scene }, body);
  }
  add(ids: string[], from?: Vec3 | ((id: string) => Vec3)) {
    this.b.stagger(ids.length > 4 ? 0.14 : 0.24);
    for (const id of ids) this.b.add(this.key(id), typeof from === "function" ? from(id) : from);
    this.b.then(0.12);
  }
  /** Shown in a step's own scene, where it will end up or moved by `at`. */
  stage(ids: string[], from?: Vec3, at?: (pos: Vec3, rot: Vec3) => { pos: Vec3; rot: Vec3 }) {
    this.b.stagger(0.24);
    for (const id of ids) {
      const p = this.boxes.get(id)!;
      const q = at ? at(p.pos, p.rot) : p;
      this.b.stage(this.key(id), q.pos, q.rot, from);
    }
    this.b.then(0.12);
  }
  fit(def: HwDef, pts: Vec3[], dir: Vec3 | ((p: Vec3) => Vec3), on: string | ((p: Vec3) => string), o: { mate?: string | ((p: Vec3) => string); hole?: false; twist?: number } = {}) {
    if (!pts.length) return;
    const id = (f: string | ((p: Vec3) => string) | undefined, p: Vec3) => (f === undefined ? undefined : this.key(typeof f === "function" ? f(p) : f));
    this.b.stagger(0.05);
    this.b.fits(def, pts.map((at) => ({ at, dir: typeof dir === "function" ? dir(at) : dir, on: id(on, at), mate: id(o.mate, at), hole: o.hole, twist: o.twist })), Math.min(0.07, 2.4 / Math.max(1, pts.length)));
    this.b.then(0.1);
  }
}


const UP: Vec3 = [0, 1, 0];
const DOWN: Vec3 = [0, -1, 0];
const sides = [-1, 1];
const T = 40; // the frames' square tube

/** A side frame: front and back legs, a rail along the top and one near the floor. */
function sideFrame(x: number, H: number, D: number, yRail: number, yShelf?: number): PartPiece[] {
  const zl = D / 2 - T / 2;
  // a kitchen unit's frames carry a small bracket inside each leg for the shelf to rest and bolt on
  const tabs = yShelf === undefined ? [] : sides.map((sz): PartPiece => ({ shape: "box", size: [60, 4, 30], pos: [x - Math.sign(x) * (T / 2 + 30), yShelf - 3.5, sz * (D / 2 - T - 15)] }));
  return [
    ...tabs,
    ...sides.map((sz): PartPiece => ({ shape: "box", size: [T, H - 20, T], pos: [x, (H + 20) / 2, sz * zl] })),
    { shape: "box", size: [T, T, D - 2 * T], pos: [x, H - T / 2, 0] },
    { shape: "box", size: [T, T, D - 2 * T], pos: [x, yRail, 0] },
  ];
}

/** Slats lying front to back across the foot rails. */
function slats(k: Kit, n: number, W: number, D: number, y: number) {
  const inner = W - 2 * T, pitch = inner / n;
  return range(n).map((i) => {
    const id = `SL${i}`;
    k.box(id, "Slat", [pitch - 14, 24, D - 2 * T + 20], [-inner / 2 + pitch * (i + 0.5), y, 0], "metal");
    return id;
  });
}

function kitchenUnit(b: PlanBuilder, s: ProductSpec, closed: boolean) {
  const W = s.size.w * 10, D = s.size.d * 10, H = 930; // IKEA: 93 cm high
  const tt = 30, yT = H - tt; // the worktop
  const yRail = 90; // the foot rails' middle
  const yShelf = closed ? 400 : 380;
  const xL = W / 2 - T / 2, zL = D / 2 - T / 2;
  const k = new Kit(b);

  for (const sx of sides) k.welded(`F${sx}`, sx < 0 ? "Left side frame" : "Right side frame", sideFrame(sx * xL, yT, D, yRail, yShelf), "metal");
  for (const sz of sides) k.box(`R${sz}`, "Foot rail", [W - 2 * T, T, T], [0, yRail, sz * zL], "metal");
  k.box("SH", closed ? "Cabinet floor" : "Shelf", [W - 2 * T, 3, D - 2 * T], [0, yShelf, 0], "metal");
  k.welded("WT", "Worktop", [
    { shape: "box", size: [W, 3, D], pos: [0, H - 1.5, 0] },
    ...sides.map((sz): PartPiece => ({ shape: "box", size: [W, tt - 3, 3], pos: [0, yT + (tt - 3) / 2, sz * (D / 2 - 1.5)] })),
    ...sides.map((sx): PartPiece => ({ shape: "box", size: [3, tt - 3, D - 6], pos: [sx * (W / 2 - 1.5), yT + (tt - 3) / 2, 0] })),
  ], "metal");
  const slatIds = slats(k, closed ? 22 : 10, W, D, yRail + T / 2 + 12);

  const frame = (p: Vec3) => (p[0] < 0 ? "F-1" : "F1");
  const rail = (p: Vec3) => (p[2] < 0 ? "R-1" : "R1");
  const legs = sides.flatMap((sx) => sides.map((sz) => [sx * xL, 20, sz * zL] as Vec3));

  k.step(
    { title: "Screw the feet into the side frames", detail: "Lay both frames flat on a rug and turn a foot into the bottom of each leg.", pose: "+x", scene: "frames", warnings: ["floor"], kind: "legs" },
    () => {
      k.stage(["F-1"]);
      k.stage(["F1"], undefined, (pos, rot) => ({ pos: [-pos[0], pos[1], pos[2] - D - 150], rot }));
      k.fit(FOOT, legs, UP, frame, { hole: false });
    },
  );
  k.step(
    { title: closed ? "Stand the frames up with the cabinet floor and foot rails" : "Stand the frames up with the shelf and foot rails", detail: "Together. Hook the shelf's edges onto the brackets inside the legs, then slide the two foot rails onto the brackets at the feet.", pose: "+y", people: 2, kind: "join" },
    () => {
      k.add(["F-1", "F1"], (id) => [id === "F1" ? 300 : -300, 0, 0]);
      k.add(["SH"], [0, 300, 0]);
      k.add(["R1", "R-1"], (id) => [0, 0, id === "R1" ? 300 : -300]);
    },
  );
  k.step({ title: closed ? "Bolt the cabinet floor to the legs" : "Bolt the shelf to the legs", detail: "Two bolts down through each corner.", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(BOLT, sides.flatMap((sx) => sides.flatMap((sz) => [0, 22].map((d) => [sx * (xL - T / 2 - 12 - d), yShelf + 1.5, sz * (D / 2 - T - 15)] as Vec3))), DOWN, "SH", { mate: frame }),
  );
  k.step({ title: "Turn it upside down and bolt the foot rails", detail: "Two bolts through each end of both rails into the brackets by the feet.", pose: "-y", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(BOLT, sides.flatMap((sx) => sides.flatMap((sz) => [0, 24].map((d) => [sx * (xL - T / 2 - 14 - d), yRail - T / 2, sz * zL] as Vec3))), UP, rail, { mate: frame }),
  );
  k.step(
    { title: "Bolt the worktop on", detail: "Turn the unit back onto its feet and lay the worktop on. Four bolts up through each side frame's top rail.", pose: "+y", people: closed ? 2 : 1, tools: ["allen"], kind: "bolts" },
    () => {
      k.add(["WT"], [0, 300, 0]);
      k.fit(BOLT, sides.flatMap((sx) => [-0.36, -0.12, 0.12, 0.36].map((f) => [sx * xL, yT - T, f * D] as Vec3)), UP, frame, { mate: "WT" });
    },
  );

  if (closed) {
    const yP0 = yShelf + 5, yP1 = yT - T - 4, pH = yP1 - yP0, yPm = (yP0 + yP1) / 2;
    // thin steel panels just inside the legs, each with a flange folded in under the cabinet floor
    const yF = yShelf - 3, zBP = -D / 2 + T + 1.5;
    k.welded("BP", "Back panel", [
      { shape: "box", size: [W - 2 * T, yP1 - yF, 3], pos: [0, (yP1 + yF) / 2, zBP] },
      { shape: "box", size: [W - 2 * T - 8, 3, 28], pos: [0, yF, zBP + 15.5] },
    ], "metal");
    for (const sx of sides)
      k.welded(`SP${sx}`, "Side panel", [
        { shape: "box", size: [3, yP1 - yF, D - T], pos: [sx * (W / 2 - T - 1.5), (yP1 + yF) / 2, 0] }, // its edges lie on the legs
        { shape: "box", size: [28, 3, D - 2 * T - 40], pos: [sx * (W / 2 - T - 17), yF, 0] },
      ], "metal");
    const xPost = -W / 2 + W / 3;
    // up to the worktop's underside, with a tab at its foot that lies on the cabinet floor
    k.welded("PO", "Door post", [
      { shape: "box", size: [T, H - 3 - yShelf - 1.5, T], pos: [xPost, (H - 3 + yShelf + 1.5) / 2, zL] },
      { shape: "box", size: [T, 3, 30], pos: [xPost, yShelf + 3, zL - T / 2 - 15] },
    ], "metal");
    // three doors in front of the frame, each with its two hinges on the back; the handles go on later
    const dw = W / 3 - 6, dz = D / 2 + 10;
    const hingeX = [-W / 2 + T / 2, xPost, W / 2 - T / 2];
    const doorX = range(3).map((i) => -W / 2 + (W / 3) * (i + 0.5));
    const hingeY = [yP0 + 90, yP1 - 90];
    range(3).forEach((i) => {
      const hx = hingeX[i];
      k.welded(`D${i}`, "Door", [
        { shape: "box", size: [dw, pH, 20], pos: [doorX[i], yPm, dz] },
        ...hingeY.map((y): PartPiece => ({ shape: "box", size: [50, 40, 18], pos: [hx + Math.sign(doorX[i] - hx) * (T / 2 + 25), y, dz - 19], material: "metal" })),
      ], "metal");
    });
    const sidesOf = (p: Vec3) => (p[0] < 0 ? "SP-1" : "SP1");

    k.step({ title: "Fit the two hanging pins into the back panel", detail: "One in each top corner, turned in with a screwdriver.", scene: "panel", tools: ["screwdriver"], kind: "general" }, () => {
      k.stage(["BP"]);
      k.fit(PIN, sides.map((sx) => [sx * (W / 2 - T - 30), yP1, -D / 2 + 1.5] as Vec3), DOWN, "BP", { hole: false });
    });
    k.step({ title: "Hang the back panel on", detail: "Lift its pins into the holes under the top rail at the back, then three bolts up through its bottom edge.", tools: ["allen"], kind: "bolts" }, () => {
      k.add(["BP"], [0, 0, -300]);
      k.fit(BOLT, [-0.33, 0, 0.33].map((f) => [f * W, yF - 1.5, zBP + 18] as Vec3), UP, "BP", { mate: "SH" });
    });
    k.step({ title: "Hang the right side panel on", detail: "Hook its top edge in under the top rail and fix the bottom with two bolts.", tools: ["allen"], kind: "bolts" }, () => {
      k.add(["SP1"], [300, 0, 0]);
      k.fit(BOLT, sides.map((sz) => [W / 2 - T - 18, yF - 1.5, sz * (D / 4)] as Vec3), UP, "SP1", { mate: "SH" });
    });
    k.step({ title: "Hang the left side panel on", detail: "The same way, two bolts at the bottom.", tools: ["allen"], kind: "bolts" }, () => {
      k.add(["SP-1"], [-300, 0, 0]);
      k.fit(BOLT, sides.map((sz) => [-W / 2 + T + 18, yF - 1.5, sz * (D / 4)] as Vec3), UP, "SP-1", { mate: "SH" });
    });
    k.step({ title: "Bolt the side panels to the legs", detail: "Two bolts from inside into each leg, top and bottom.", tools: ["allen"], kind: "bolts" }, () =>
      k.fit(BOLT, sides.flatMap((sx) => sides.flatMap((sz) => [yP0 + 60, yP1 - 60].map((y) => [sx * (W / 2 - T - 3), y, sz * (zL - 8)] as Vec3))), (p) => [Math.sign(p[0]), 0, 0], sidesOf, { mate: frame }),
    );
    k.step({ title: "Fit the post between the doors", detail: "Push it in a third of the way along the front, between the cabinet floor and the top rail. Two bolts at the top, two at the bottom.", tools: ["allen"], kind: "bolts" }, () => {
      k.add(["PO"], [0, 0, 300]);
      k.fit(BOLT, sides.map((d) => [xPost + d * 10, H - 9, zL] as Vec3), UP, "PO", { mate: "WT" });
      k.fit(BOLT, sides.map((d) => [xPost + d * 10, yShelf + 4.5, zL - T / 2 - 15] as Vec3), DOWN, "PO", { mate: "SH" });
    });
    k.step({ title: "Screw the doors on", detail: "Two hinges on each door; four screws hold each hinge to its post.", tools: ["screwdriver"], kind: "hinges" }, () => {
      k.add(["D0", "D1", "D2"], [0, 0, 300]);
      const pts = range(3).flatMap((i) => {
        const sg = Math.sign(doorX[i] - hingeX[i]);
        return hingeY.flatMap((y) => [-12, 12].flatMap((dy) => [-7, 7].map((dz2) => [hingeX[i] + sg * (T / 2), y + dy, zL + dz2] as Vec3)));
      });
      k.fit(SCREW, pts, (p) => [Math.abs(p[0] - xPost) < 30 ? -1 : Math.sign(p[0]), 0, 0], (p) => (Math.abs(p[0] - xPost) < 30 ? "PO" : frame(p)));
    });
    const handleX = [doorX[0] + dw / 2 - 40, doorX[1] + dw / 2 - 40, doorX[2] - dw / 2 + 40];
    k.step({ title: "Bolt on the handles", detail: "One on each door, at the edge away from its hinges, with a bolt from inside.", tools: ["allen"], kind: "screws" }, () => {
      k.fit(HANDLE, handleX.map((x) => [x, yP1 - 70, dz + 10] as Vec3), [0, 0, -1], (p) => `D${handleX.indexOf(p[0])}`, { hole: false, twist: Math.PI / 2 });
      k.fit(BOLT, handleX.map((x) => [x, yP1 - 70, dz - 10] as Vec3), [0, 0, 1], (p) => `D${handleX.indexOf(p[0])}`);
    });
  }

  k.step({ title: "Click in the slats", detail: closed ? "All 22, across the foot rails. Hook the back end in and press the front down until it clicks." : "All ten, across the foot rails. Hook the back end in and press the front down until it clicks.", kind: "slats" }, () =>
    k.add(slatIds, [0, 150, 0]),
  );
  k.step({ title: "Level the unit", detail: closed ? "Turn the feet until the worktop is level. The hinges adjust if a door hangs crooked." : "Turn the feet until the worktop is level.", tools: ["level"], kind: "legs" }, () => {});
  return true;
}

function addOn(b: PlanBuilder) {
  const W = 1200, H = 700, Dt = 170; // IKEA: 120 x 70, 17 deep
  const th = 60; // the troughs' depth
  const ys = [440, H - th / 2]; // trough middles
  const k = new Kit(b);
  const zb = -Dt / 2 - 2; // the uprights' back flange
  for (const sx of sides)
    k.welded(`U${sx}`, "Upright", [
      { shape: "box", size: [4, H, 40], pos: [sx * (W / 2 + 2), H / 2, -Dt / 2 + 20] },
      { shape: "box", size: [40, H, 4], pos: [sx * (W / 2 - 18), H / 2, zb] },
    ], "metal");
  ys.forEach((y, i) =>
    k.welded(`S${i}`, "Shelf", [
      { shape: "box", size: [W, 2, Dt], pos: [0, y - th / 2 + 1, 0] },
      ...sides.map((sz): PartPiece => ({ shape: "box", size: [W, th, 2], pos: [0, y, sz * (Dt / 2 - 1)] })),
      ...sides.map((sx): PartPiece => ({ shape: "box", size: [2, th, Dt - 4], pos: [sx * (W / 2 - 1), y, 0] })),
    ], "metal"),
  );
  const up = (p: Vec3) => (p[0] < 0 ? "U-1" : "U1");
  const shelf = (p: Vec3) => (Math.abs(p[1] - ys[0]) < Math.abs(p[1] - ys[1]) ? "S0" : "S1");
  k.step({ title: "Bolt the uprights across the shelves", detail: "Lay both shelves face down on a rug and the uprights across their ends. One bolt through each upright into each shelf.", pose: "-z", tools: ["allen"], warnings: ["floor"], kind: "bolts" }, () => {
    k.add(["S0", "S1"], [0, 0, 200]);
    k.add(["U-1", "U1"], [0, 0, -250]);
    k.fit(BOLT, sides.flatMap((sx) => ys.map((y) => [sx * (W / 2 - 18), y, zb - 2] as Vec3)), [0, 0, 1], up, { mate: shelf });
  });
  k.step({ title: "Turn it over and bolt the ends", detail: "One more bolt through the side of each upright into each shelf's end.", pose: "+z", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(BOLT, sides.flatMap((sx) => ys.map((y) => [sx * (W / 2 + 4), y, -Dt / 2 + 20] as Vec3)), (p) => [-Math.sign(p[0]), 0, 0], up, { mate: shelf }),
  );
  k.step({ title: "Bolt it onto the kitchen unit", detail: "Stand the uprights against the outsides of the kitchen unit's back legs and fit two bolts through each.", pose: "+y", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(BOLT, sides.flatMap((sx) => [60, 160].map((y) => [sx * (W / 2 + 4), y, -Dt / 2 + 20] as Vec3)), (p) => [-Math.sign(p[0]), 0, 0], up, { hole: false }),
  );
  return true;
}

function barTable(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 150; // the top tray's front skirt
  const yT = H - 3; // the top's underside
  const yRail = 70;
  const xL = W / 2 - T / 2, zL = D / 2 - T / 2;
  const k = new Kit(b);
  for (const sx of sides) k.welded(`F${sx}`, "Side frame", sideFrame(sx * xL, yT, D, yRail), "metal");
  k.box("BR", "Back rail", [W - 2 * T, T, T], [0, yT - T / 2, -zL], "metal");
  k.box("ST", "Foot stretcher", [W - 2 * T, T, T], [0, yRail, 0], "metal");
  k.welded("TP", "Top", [
    { shape: "box", size: [W, 3, D], pos: [0, H - 1.5, 0] },
    { shape: "box", size: [W, tt - 3, 3], pos: [0, H - 3 - (tt - 3) / 2, D / 2 - 1.5] },
  ], "metal");
  const frame = (p: Vec3) => (p[0] < 0 ? "F-1" : "F1");
  k.step(
    { title: "Screw the feet into the side frames", detail: "Lay both frames flat on a rug and turn a foot into the bottom of each leg.", pose: "+x", scene: "frames", warnings: ["floor"], kind: "legs" },
    () => {
      k.stage(["F-1"]);
      k.stage(["F1"], undefined, (pos, rot) => ({ pos: [-pos[0], pos[1], pos[2] - D - 150], rot }));
      k.fit(FOOT, sides.flatMap((sx) => sides.map((sz) => [sx * xL, 20, sz * zL] as Vec3)), UP, frame, { hole: false });
    },
  );
  k.step({ title: "Join the frames with the back rail", detail: "Stand them up and lay the rail between the back corners of their top rails. One bolt down through each end.", tools: ["allen"], kind: "bolts" }, () => {
    k.add(["F-1", "F1"], (id) => [id === "F1" ? 300 : -300, 0, 0]);
    k.add(["BR"], [0, 250, 0]);
    k.fit(BOLT, sides.map((sx) => [sx * (xL - T / 2 - 20), yT, -zL] as Vec3), DOWN, "BR", { mate: frame });
  });
  k.step({ title: "Turn it upside down and bolt the top on", detail: "Stand the frames upside down in the top tray, skirt at the front, and fit eleven bolts up through the frames' top rails and the back rail.", pose: "-y", tools: ["allen"], kind: "bolts" }, () => {
    k.add(["TP"], [0, 300, 0]);
    k.fit(BOLT, sides.flatMap((sx) => [-0.3, -0.1, 0.1, 0.3].map((f) => [sx * xL, yT - T, f * D] as Vec3)), UP, frame, { mate: "TP" });
    k.fit(BOLT, [-0.25, 0, 0.25].map((f) => [f * W, yT - T, -zL] as Vec3), UP, "BR", { mate: "TP" });
  });
  k.step({ title: "Bolt in the foot stretcher", detail: "Lay it between the middles of the two foot rails and fit two bolts through each end bracket. Then turn the table over.", tools: ["allen"], kind: "bolts" }, () => {
    k.add(["ST"], [0, -250, 0]);
    k.fit(BOLT, sides.flatMap((sx) => sides.map((d) => [sx * (xL - T / 2), yRail, d * 10] as Vec3)), (p) => [Math.sign(p[0]), 0, 0], "ST", { mate: frame });
  });
  k.step({ title: "Stand it up and level it", detail: "Turn the table onto its feet, then turn the feet until the top is level.", pose: "+y", tools: ["level"], kind: "standup" }, () => {});
  return true;
}

function build(b: PlanBuilder, s: ProductSpec) {
  const slug = s.slug ?? "";
  if (/^batskar-add-on-unit/.test(slug)) return addOn(b);
  if (/^batskar-bar-table/.test(slug)) return barTable(b, s);
  if (/^batskar-(open|closed)-kitchen-unit/.test(slug)) return kitchenUnit(b, s, slug.includes("closed"));
  return false;
}

const family: Family = {
  names: ["BÅTSKÄR"],
  build,
};
export default family;
