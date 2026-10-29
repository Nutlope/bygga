import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { HwDef, PlanBuilder } from "../builder";
import { rotate } from "../math";

/**
 * ROSENTORP, from IKEA's manuals. The chair and the bar stool are a back frame and a front frame (legs and rails
 * glued up at the factory) joined by side rails: a long bolt in each leg, its barrel nut beside it, the rail's
 * keyhole slid over the bolt head, clipped and tightened. The bar stool adds lower side rails screwed through the
 * legs. The stool is two X leg frames joined the same way. The seat goes on last, upside down, through angle
 * brackets. The round and oval tables stand on pedestals (one column with four legs, or two columns with two legs
 * each joined by a beam), with a butterfly leaf in a frame under a top in two halves; the rectangular table and
 * the desk have four turned legs bolted onto corner brackets. The swivel chair has a four-legged wooden base.
 */

interface StepO {
  title: string;
  detail?: string;
  scene?: string;
  pose?: Pose;
  kind?: StepKind;
  tools?: ToolId[];
  people?: 1 | 2;
  warnings?: WarnId[];
  check?: "square";
}
type Xf = (p: Vec3, r: Vec3) => [Vec3, Vec3];

const PI = Math.PI;
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const shift = (d: Vec3): Xf => (p, r) => [add3(p, d), r];
/** Turned upside down about the height h/2 (on its top, front and back swapped). */
const flip = (h: number, d: Vec3 = [0, 0, 0]): Xf => (p, r) => [add3([p[0], h - p[1], -p[2]], d), [r[0] + PI, r[1], r[2]]];
const box = (size: Vec3, pos: Vec3, o: { rot?: Vec3; material?: PartMaterial } = {}): PartPiece => ({ shape: "box", size, pos, ...o });
const cyl = (dia: number, len: number, pos: Vec3, o: { rot?: Vec3; material?: PartMaterial } = {}): PartPiece => ({ shape: "cyl", size: [dia, len, dia], pos, ...o });
/** A straight bar from a to b (in the xy plane of its part), as a box turned to lie along it. */
const bar = (a: [number, number], b: [number, number], t: number, d: number, z = 0, o: { material?: PartMaterial } = {}): PartPiece => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return box([len + t * 0.4, t, d], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], { rot: [0, 0, Math.atan2(b[1] - a[1], b[0] - a[0])], ...o });
};
const ring = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));
const LR = [-1, 1] as const;

/** Parts by name, drawn where they sit in the finished product, and steps that show, move and fix them. */
class Kit {
  private types = new Map<string, { type: string; mid: Vec3 }>();
  private keys = new Map<string, string>();
  scene = "main";
  constructor(public b: PlanBuilder) {}
  part(id: string, name: string, size: Vec3, pos: Vec3, o: { shape?: "box" | "cyl"; material?: PartMaterial; rot?: Vec3 } = {}) {
    const tk = `${name}|${size.map(Math.round).join("x")}|${o.shape ?? "box"}|${o.material ?? "board"}`;
    let t = this.types.get(tk);
    if (!t) {
      t = { type: this.b.part(name, size, { shape: o.shape, material: o.material ?? "board" }), mid: [0, 0, 0] };
      this.types.set(tk, t);
    }
    this.keys.set(id, this.b.place(t.type, pos, o.rot ?? [0, 0, 0]));
  }
  /** A part made of pieces drawn in its own frame, which sits at `at`, turned by `rot`. */
  comp(id: string, name: string, pieces: PartPiece[], o: { material?: PartMaterial; at?: Vec3; rot?: Vec3 } = {}) {
    const tk = `${name}|${o.material ?? ""}|${JSON.stringify(pieces)}`;
    let t = this.types.get(tk);
    if (!t) {
      t = this.b.compound(name, pieces, { material: o.material ?? "board" });
      this.types.set(tk, t);
    }
    const rot = o.rot ?? [0, 0, 0];
    this.keys.set(id, this.b.place(t.type, add3(o.at ?? [0, 0, 0], rotate(t.mid, rot)), rot));
  }
  /** A part whose drawn pieces may reach past its own size (see halfTop). */
  raw(id: string, name: string, size: Vec3, pieces: PartPiece[], pos: Vec3, rot: Vec3) {
    const tk = `raw|${name}|${JSON.stringify(pieces)}`;
    let t = this.types.get(tk);
    if (!t) {
      t = { type: this.b.part(name, size, { material: "board" }), mid: [0, 0, 0] };
      this.b.parts[this.b.parts.length - 1].pieces = pieces;
      this.types.set(tk, t);
    }
    this.keys.set(id, this.b.place(t.type, pos, rot));
  }
  k(id: string) {
    const k = this.keys.get(id);
    if (!k) throw new Error("no part " + id);
    return k;
  }
  step(o: StepO, body: () => void = () => {}) {
    this.scene = o.scene ?? "main";
    const warnings = o.warnings ?? (o.people === 2 ? (["two"] as WarnId[]) : []);
    this.b.step({ kind: "general", ...o, scene: this.scene, warnings }, body);
  }
  /** Parts reach their spot: in the main scene the finished product, elsewhere the same spot in that scene. */
  show(ids: string[], from?: Vec3, gap = 0.2) {
    this.b.stagger(gap);
    for (const id of ids) {
      const key = this.k(id);
      if (this.scene === "main") this.b.add(key, from);
      else {
        const f = this.b.partItem(key).final;
        this.b.stage(key, f.pos, f.rot, from);
      }
    }
    this.b.then(0.12);
  }
  /** Parts shown away from their spot (moved, laid down or turned over). */
  put(ids: string[], xf: Xf, from?: Vec3, gap = 0.15) {
    this.b.stagger(gap);
    for (const id of ids) {
      const key = this.k(id);
      const f = this.b.partItem(key).final;
      const [p, r] = xf(f.pos, f.rot);
      this.b.stage(key, p, r, from);
    }
    this.b.then(0.12);
  }
  /** Fittings at points in the finished product, each going in along `dir`, held by part `on`. */
  fit(def: HwDef, at: Vec3[], dir: Vec3 | ((i: number) => Vec3), on: string | ((i: number) => string), o: { mate?: (i: number) => string; hole?: false; travel?: number } = {}) {
    this.b.fits(
      def,
      at.map((p, i) => ({
        on: this.k(typeof on === "string" ? on : on(i)),
        at: p,
        dir: typeof dir === "function" ? dir(i) : dir,
        mate: o.mate ? this.k(o.mate(i)) : undefined,
        hole: o.hole,
        travel: o.travel,
      })),
      0.07,
    );
    this.b.then(0.1);
  }
}

/* ---------- fittings ---------- */

const BOLT: HwDef = { kind: "bolt", len: 90, dia: 6 };
const BARREL: HwDef = { kind: "nut", len: 14, dia: 10, name: "Barrel nut" };
const SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const ANGLE: HwDef = { kind: "angle", len: 40, dia: 30 };
const CLIP: HwDef = { kind: "clip", len: 12, dia: 18, name: "Bolt clip" };
const LAG: HwDef = { kind: "screw", len: 60, dia: 6, name: "Wood screw" };
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const ROD: HwDef = { kind: "stud", len: 110, dia: 8, name: "Threaded rod" };
const RODS: HwDef = { kind: "stud", len: 70, dia: 8, name: "Threaded rod" };
const COUPLER: HwDef = { kind: "nut", len: 20, dia: 10, name: "Coupling nut" };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 16 };
const LOCKW: HwDef = { kind: "washer", len: 1, dia: 14, name: "Toothed washer" };
const NUT: HwDef = { kind: "nut", len: 6, dia: 8 };
const MSCREW: HwDef = { kind: "bolt", len: 16, dia: 6, name: "Machine screw" };
const WSCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const CORNER: HwDef = { kind: "angle", len: 70, dia: 70, name: "Corner bracket" };

/* ---------- the chair and the bar stool ---------- */

function chair(b: PlanBuilder, bar_: boolean) {
  const k = new Kit(b);
  const W = bar_ ? 400 : 440, D = bar_ ? 450 : 530, H = bar_ ? 920 : 910, SY = bar_ ? 630 : 450;
  const T = 25, SB = SY - T, RH = 80, RY = SB - RH / 2, L = 40, IN = W - 2 * L;
  const zb = -D / 2 + 40, zf = D / 2 - 45, lx = W / 2 - L / 2, LOW = 300, LOWS = 280, FOOT = 230;
  const xa = SY + 105, xb = H - 100;
  const back: PartPiece[] = [
    ...LR.map((sx) => box([L, H, L], [sx * lx, H / 2, 0])),
    box([IN, RH, 22], [0, RY, 0]),
    box([IN, 90, 25], [0, H - 55, 0]),
    box([IN, 35, 22], [0, SY + 80, 0]),
    bar([-IN / 2 + 15, xa], [IN / 2 - 15, xb], 30, 18),
    bar([-IN / 2 + 15, xb], [IN / 2 - 15, xa], 30, 18),
    ...(bar_ ? [box([IN, 35, 22], [0, LOW, 0])] : []),
  ];
  const front: PartPiece[] = [
    ...LR.map((sx) => box([L, SB, L], [sx * lx, SB / 2, 0])),
    box([IN, RH, 22], [0, RY, 0]),
    ...(bar_ ? [box([IN, 40, 22], [0, FOOT, 0]), box([IN, 4, 36], [0, FOOT + 22, 2], { material: "metal" })] : []),
  ];
  k.comp("back", "Back frame", back, { material: "wood", at: [0, 0, zb] });
  k.comp("front", "Front frame", front, { material: "wood", at: [0, 0, zf] });
  const len = zf - zb - L, zm = (zb + zf) / 2;
  LR.forEach((sx, i) => k.part(`sr${i}`, "Side rail", [22, RH, len], [sx * lx, RY, zm], { material: "wood" }));
  if (bar_) LR.forEach((sx, i) => k.part(`lr${i}`, "Lower side rail", [22, 35, len], [sx * lx, LOWS, zm], { material: "wood" }));
  const sz = D / 2 - (zb + L / 2);
  k.part("seat", "Seat", [W, T, sz], [0, SB + T / 2, D / 2 - sz / 2], { material: "wood" });

  const beside = shift([W + 260, 0, zb - zf]);
  const brk = (z: number, s: 1 | -1) => LR.map((sx) => [sx * (lx - 70), SB - 18, z + s * 11] as Vec3);
  const bracketsOn = (id: string, z: number, s: 1 | -1) => {
    k.fit(ANGLE, brk(z, s), [0, 0, -s], id, { hole: false });
    k.fit(SCREW, brk(z, s), [0, 0, -s], id);
  };
  const nutsBolts = (id: string, z: number, s: 1 | -1) => {
    k.fit(BARREL, LR.map((sx) => [sx * (W / 2 - 8), RY, z] as Vec3), (i) => [-LR[i], 0, 0], id, { hole: false });
    k.fit(BOLT, LR.map((sx) => [sx * lx, RY, z + s * (L / 2 + 50)] as Vec3), [0, 0, -s], id, { travel: 40 });
  };
  const clips = (z: number) => k.fit(CLIP, LR.map((sx) => [sx * (lx - 11), RY, z] as Vec3), (i) => [LR[i], 0, 0], (i) => `sr${i}`, { hole: false });
  const lags = (id: string, z: number, s: 1 | -1) => k.fit(LAG, LR.map((sx) => [sx * lx, LOWS, z - s * (L / 2)] as Vec3), [0, 0, s], id, { mate: (i) => `lr${i}` });

  k.step({ title: bar_ ? "Lay out both frames and screw on four brackets" : "Lay the back frame down and screw on two brackets", detail: bar_ ? "On a rug, back frame on its back. One screw holds each bracket to the seat rail for now." : "On a rug, lying on its back. One screw holds each bracket to the seat rail for now.", pose: "+z", kind: "screws", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    k.show(["back"], [0, 0, 200]);
    if (bar_) k.put(["front"], beside, [0, 0, 200]);
    bracketsOn("back", zb, 1);
    if (bar_) bracketsOn("front", zf, -1);
  });
  k.step({ title: "Push in the barrel nuts and screw in the long bolts", detail: "Turn each barrel nut with a flat screwdriver until its hole lines up, then screw the bolt in by hand a few turns. Leave the head sticking out.", pose: "+z", kind: "bolts", tools: ["flathead"] }, () => {
    nutsBolts("back", zb, 1);
    if (bar_) nutsBolts("front", zf, -1);
  });
  k.step({ title: "Slide the side rails over the bolt heads", detail: "The keyhole in each rail's end goes over a bolt head and down.", pose: "+z", kind: "join" }, () => k.show(["sr0", "sr1"], [0, 0, 260]));
  k.step({ title: "Clip in the bolts and tighten them", detail: "Push a clip into each keyhole behind the bolt head, then tighten the bolt with the Allen key.", pose: "+z", kind: "bolts", tools: ["allen"] }, () => clips(zb + L / 2 + 60));
  if (bar_) {
    k.step({ title: "Push the lower side rails onto the back legs", detail: "Their pegs go into the holes in the legs.", pose: "+z", kind: "join" }, () => k.show(["lr0", "lr1"], [0, 0, 240]));
    k.step({ title: "Screw the lower rails to the back legs", detail: "One long screw through each leg, with the bit in the screwdriver.", pose: "+z", kind: "screws", tools: ["screwdriver"] }, () => lags("back", zb, 1));
  } else {
    k.step({ title: "Screw two brackets onto the front frame", detail: "Lay it beside the back frame. One screw in each bracket for now.", pose: "+z", kind: "screws", tools: ["screwdriver"] }, () => {
      k.put(["front"], beside, [0, 0, 200]);
      bracketsOn("front", zf, -1);
    });
    k.step({ title: "Fit its barrel nuts and bolts", detail: "The same as the back frame: line up the nuts, then screw the bolts in a few turns by hand.", pose: "+z", kind: "bolts", tools: ["flathead"] }, () => nutsBolts("front", zf, -1));
  }
  k.step({ title: "Lower the front frame onto the rails", detail: "Turn it over and drop its bolt heads into the keyholes at the free ends of the rails.", pose: "+z", kind: "join" }, () => {
    k.show(["front"], [0, 0, 320]);
    if (bar_) clips(zf - L / 2 - 60);
  });
  if (!bar_) k.step({ title: "Turn it upside down, clip and tighten the front", detail: "Rest it on a table. A clip behind each bolt head, then tighten with the Allen key.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => clips(zf - L / 2 - 60));
  if (bar_) k.step({ title: "Screw the lower rails to the front legs", detail: "One long screw through each front leg.", pose: "+z", kind: "screws", tools: ["screwdriver"] }, () => lags("front", zf, -1));
  k.step({ title: "Stand it up and tighten all four bolts", detail: "Press down on the frame so all four legs touch the floor, then tighten each bolt hard.", kind: "bolts", tools: ["allen"], check: "square" });
  if (bar_) k.step({ title: "Turn it over and tighten the long screws", detail: "Upside down on a table. All four, firmly.", pose: "-y", kind: "screws", tools: ["screwdriver"] });
  k.step({ title: "Lower the frame onto the seat", detail: "Lay the seat face down on a table and put the frame on it upside down, centred so the gap is the same all round.", pose: "-y", kind: "join", check: "square" }, () => k.show(["seat"], [0, 240, 0]));
  k.step({ title: "Screw the seat on through the brackets", detail: "One screw up through each bracket. Use a hand screwdriver, not a drill.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fit(SCREW, [...LR.map((sx) => [sx * (lx - 70), SB, zb + 32] as Vec3), ...LR.map((sx) => [sx * (lx - 70), SB, zf - 32] as Vec3)], [0, 1, 0], "seat"),
  );
  return true;
}

/* ---------- the stool ---------- */

function stool(b: PlanBuilder) {
  const k = new Kit(b);
  const W = 400, D = 300, T = 25, SB = 425, lx = 170, lz = 120, RY = 390;
  const xa = 70, xb = 340, half = lz - 20;
  const frame: PartPiece[] = [
    ...LR.map((sz) => box([40, SB, 40], [0, SB / 2, sz * lz])),
    box([22, 70, 2 * lz - 40], [0, RY, 0]),
    box([18, 30, Math.hypot(2 * half, xb - xa)], [0, (xa + xb) / 2, 0], { rot: [Math.atan2(xb - xa, 2 * half), 0, 0] }),
    box([18, 30, Math.hypot(2 * half, xb - xa)], [0, (xa + xb) / 2, 0], { rot: [-Math.atan2(xb - xa, 2 * half), 0, 0] }),
  ];
  LR.forEach((sx, i) => k.comp(`f${i}`, "Leg frame", frame, { material: "wood", at: [sx * lx, 0, 0] }));
  LR.forEach((sz, i) => k.part(`r${i}`, "Rail", [2 * lx - 40, 70, 22], [0, RY, sz * lz], { material: "wood" }));
  k.part("seat", "Seat", [W, T, D], [0, SB + T / 2, 0], { material: "wood" });

  const ends = (x: number) => LR.map((sz) => [x, RY, sz * lz] as Vec3);
  const brk = (sx: number) => LR.map((sz) => [sx * (lx - 11), SB - 12, sz * 55] as Vec3);
  const beside = shift([-2 * lx, 0, D + 260]);
  k.step({ title: "Lay the leg frames flat and push in the brackets", detail: "Screw the threaded end of each corner bracket into its hole by hand, two in each frame.", pose: "+x", kind: "screws", warnings: ["floor", "hand"] }, () => {
    k.show(["f0"], [-200, 0, 0]);
    k.put(["f1"], beside, [-200, 0, 0]);
    for (const [i, sx] of LR.entries()) k.fit(ANGLE, brk(sx), [sx, 0, 0], `f${i}`, { hole: false });
  });
  k.step({ title: "Push in the barrel nuts and screw in the bolts", detail: "Line up each nut's hole with a flat screwdriver and screw the bolt in a few turns by hand.", pose: "+x", kind: "bolts", tools: ["flathead"] }, () => {
    for (const [i, sx] of LR.entries()) {
      k.fit(BARREL, LR.map((sz) => [sx * lx, RY, sz * (lz + 12)] as Vec3), (j) => [0, 0, -LR[j]], `f${i}`, { hole: false });
      k.fit(BOLT, ends(sx * (lx - 70)), [sx, 0, 0], `f${i}`, { travel: 40 });
    }
  });
  k.step({ title: "Tap in dowels and stand the rails on one frame", detail: "Two dowels in each rail end, then slide the keyholes over the bolt heads.", pose: "+x", kind: "dowels", tools: ["hammer"] }, () => {
    k.fit(DOWEL, ends(-(lx - 20)).flatMap((p) => [[p[0], p[1] - 22, p[2]], [p[0], p[1] + 22, p[2]]] as Vec3[]), [-1, 0, 0], (i) => `r${i >> 1}`, { mate: () => "f0" });
    k.show(["r0", "r1"], [300, 0, 0]);
  });
  k.step({ title: "Clip in the bolts and tighten them", detail: "A clip into each keyhole behind the bolt head, then the Allen key.", pose: "+x", kind: "bolts", tools: ["allen"] }, () =>
    k.fit(CLIP, LR.map((sz) => [-(lx - 40), RY, sz * (lz - 11)] as Vec3), (i) => [0, 0, LR[i]], (i) => `r${i}`, { hole: false }),
  );
  k.step({ title: "Tap dowels into the rails and lower the other frame on", detail: "Two dowels in each free rail end. Turn the second frame over and drop its bolt heads into the keyholes.", pose: "+x", kind: "dowels", tools: ["hammer"] }, () => {
    k.fit(DOWEL, ends(lx - 20).flatMap((p) => [[p[0], p[1] - 22, p[2]], [p[0], p[1] + 22, p[2]]] as Vec3[]), [1, 0, 0], (i) => `r${i >> 1}`);
    k.show(["f1"], [300, 0, 0]);
  });
  k.step({ title: "Clip in and tighten the second frame", detail: "The same as the first.", pose: "+x", kind: "bolts", tools: ["allen"] }, () =>
    k.fit(CLIP, LR.map((sz) => [lx - 40, RY, sz * (lz - 11)] as Vec3), (i) => [0, 0, LR[i]], (i) => `r${i}`, { hole: false }),
  );
  k.step({ title: "Stand it up and tighten all four bolts", detail: "Press down on the top of the frames so all four legs touch the floor, then tighten each bolt hard.", kind: "bolts", tools: ["allen"], check: "square" });
  k.step({ title: "Tap two dowels in and lower the frame onto the seat", detail: "One dowel in the top of each frame. Lay the seat face down and put the frame on it upside down.", pose: "-y", kind: "dowels", tools: ["hammer"] }, () => {
    k.fit(DOWEL, LR.map((sx) => [sx * lx, SB, 0] as Vec3), [0, 1, 0], (i) => `f${i}`);
    k.show(["seat"], [0, 240, 0]);
  });
  k.step({ title: "Screw the seat on through the brackets", detail: "One screw up through each bracket, with a hand screwdriver.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fit(SCREW, LR.flatMap((sx) => brk(sx).map((p) => [p[0] - sx * 14, SB, p[2]] as Vec3)), [0, 1, 0], "seat"),
  );
  return true;
}

/* ---------- the swivel chair ---------- */

function swivel(b: PlanBuilder) {
  const k = new Kit(b);
  const HY = 275, R0 = 45, R1 = 470, Y0 = 290, Y1 = 22;
  k.part("hub", "Hub", [92, 110, 92], [0, HY, 0], { shape: "cyl", material: "wood" });
  const len = Math.hypot(R1 - R0, Y0 - Y1), tilt = -Math.atan2(Y0 - Y1, R1 - R0);
  const angs = ring(4, (i) => PI / 4 + (i * PI) / 2);
  angs.forEach((a, i) => k.comp(`l${i}`, "Leg", [box([len, 46, 44], [(R0 + R1) / 2, (Y0 + Y1) / 2, 0], { rot: [0, 0, tilt] })], { material: "wood", rot: [0, -a, 0] }));
  k.part("lift", "Gas lift", [30, 120, 30], [0, 390, 0], { shape: "cyl", material: "metal" });
  k.part("cover", "Column cover", [58, 50, 58], [0, 355, 0], { shape: "cyl", material: "wood" });
  k.part("mech", "Seat plate", [220, 20, 220], [0, 440, 10], { material: "metal" });
  k.part("seat", "Seat", [500, 90, 420], [0, 495, 20], { material: "soft" });
  k.comp("back", "Backrest", [box([470, 520, 55], [0, 712, -175], { rot: [-0.12, 0, 0] }), box([260, 20, 150], [0, 440, -105])], { material: "soft" });

  const SAS = ["seat", "mech", "back"];
  const flipSeat = flip(495 * 2 - 45 * 2 + 90, [760, 0, 0]);
  const legEnd = (a: number, r: number, y: number): Vec3 => [r * Math.cos(a), y, r * Math.sin(a)];
  k.step({ title: "Push the four legs into the hub", detail: "Hub upside down on a rug. Each leg's tongue slides into a slot.", pose: "-y", kind: "join", warnings: ["floor"] }, () => {
    k.show(["hub"], [0, -200, 0]);
    k.show(angs.map((_, i) => `l${i}`), undefined, 0.15);
  });
  k.step({ title: "Screw the legs to the hub", detail: "One screw up into each leg, tightened with the Allen key.", pose: "-y", kind: "bolts", tools: ["allen"] }, () =>
    k.fit({ kind: "bolt", len: 16, dia: 6 }, angs.map((a) => legEnd(a, 30, HY - 55)), [0, 1, 0], "hub", { mate: (i) => `l${i}` }),
  );
  k.step({ title: "Turn the base over and push in the gas lift", detail: "Narrow end down. It holds by friction, no tools.", kind: "join" }, () => k.show(["lift"], [0, 260, 0]));
  k.step({ title: "Slide the cover over the gas lift", detail: "Down until it rests on the hub.", kind: "join" }, () => k.show(["cover"], [0, 240, 0]));
  k.step({ title: "Bolt the seat plate under the seat", detail: "Seat upside down on a soft surface. Four bolts, tightened with the Allen key.", kind: "bolts", tools: ["allen"] }, () => {
    k.put(["seat"], flipSeat, [0, 200, 0]);
    k.put(["mech"], flipSeat, [0, 200, 0]);
    k.fit({ kind: "bolt", len: 20, dia: 6 }, LR.flatMap((sx) => LR.map((sz) => [sx * 90, 430, 10 + sz * 90] as Vec3)), [0, 1, 0], "mech", { mate: () => "seat" });
  });
  k.step({ title: "Bolt the backrest onto the seat", detail: "Rest the seat on a table edge with the backrest hanging down. Four bolts through its foot.", kind: "bolts", tools: ["allen"] }, () => {
    k.put(["back"], flipSeat, [0, 0, -220]);
    k.fit({ kind: "bolt", len: 20, dia: 6 }, LR.flatMap((sx) => LR.map((sz) => [sx * 105, 430, -105 + sz * 55] as Vec3)), [0, 1, 0], "back", { mate: () => "seat" });
  });
  k.step({ title: "Lower the seat onto the gas lift", detail: "Turn it the right way up and press the plate's socket down onto the lift.", kind: "join" }, () => k.show(SAS, [0, 280, 0], 0));
  k.step({ title: "Pull the cover over the backrest", detail: "From the top, inside out at the bottom, smoothing it down the back and the front.", kind: "cushions" });
  k.step({ title: "Close the zip round the seat", detail: "Start at the back and work round both sides, then tuck the zip pull away under the seat.", kind: "cushions" });
  k.step({ title: "Stretch the edge under the seat and press it on", detail: "Pull the elastic edge under all round and press the hook and loop strips together.", pose: "-y", kind: "cushions" });
  return true;
}

/* ---------- the round and oval pedestal tables ---------- */

/**
 * One half of a round or oval top, x > 0 (turned for the other half). A drawn part can't be cut in half: the round
 * half is drawn as the whole disc, and both halves overlap exactly. The oval half is its straight middle and its
 * round end; the round end sits a hair lower, so the part of its rim that reaches under the other half is hidden.
 */
function halfTop(k: Kit, id: string, a: number, bz: number, y: number, t: number, oval: boolean, side: 1 | -1) {
  const mid = a / 2, c = a - bz, sx = c + 50;
  const pieces: PartPiece[] = oval ? [box([sx, t, 2 * bz], [sx / 2 - mid, 0, 0]), cyl(2 * bz, t - 6, [c - mid, -3, 0])] : [cyl(2 * a, t, [-mid, 0, 0])];
  k.raw(id, "Table top half", [a, t, 2 * bz], pieces, [side * mid, y, 0], [0, side > 0 ? 0 : PI, 0]);
}
/** A pedestal leg in its own frame: x outward, a gentle S down to the floor. */
const pedLeg = (r0: number, r1: number): PartPiece[] => {
  const m = r0 + (r1 - r0) * 0.45;
  return [bar([r0, 235], [m, 118], 64, 56), bar([m, 118], [r1, 16], 48, 46)];
};
const column = (): PartPiece[] => [cyl(160, 200, [0, 180, 0]), cyl(108, 290, [0, 425, 0]), cyl(150, 80, [0, 610, 0])];

function pedestal(b: PlanBuilder, oval: boolean) {
  const k = new Kit(b);
  const H = 750, TT = 30, TY = H - TT, FH = 70;
  const A = oval ? 800 : 550, BZ = 550;
  const FL = oval ? 700 : 520, FW = oval ? 700 : 600, SL = oval ? 1240 : 760, SZ = FW / 2 + 15;
  const cols = oval ? [-360, 360] : [0];
  halfTop(k, "t1", A, BZ, TY + TT / 2, TT, oval, 1);
  halfTop(k, "t0", A, BZ, TY + TT / 2, TT, oval, -1);
  k.comp("frame", "Leaf frame", [
    ...LR.map((s) => box([FL, FH, 24], [0, TY - FH / 2, s * (FW / 2 - 12)])),
    ...LR.map((s) => box([24, FH, FW - 48], [s * (FL / 2 - 12), TY - FH / 2, 0])),
    box([FL - 60, 20, FW - 70], [0, TY - 14, 0]),
    box([FL - 60, 20, FW - 70], [0, TY - 36, 0]),
  ]);
  LR.forEach((s, i) => k.part(`s${i}`, "Slide", [SL, 30, 30], [0, TY - 15, s * SZ], { material: "metal" }));
  LR.forEach((s, i) => k.part(`h${i}`, "Leaf holder", [140, 50, 20], [0, TY - FH + 25, s * (FW / 2 - 34)], { material: "wood" }));
  const legs: { id: string; a: number; cx: number }[] = [];
  cols.forEach((cx, c) => {
    k.comp(`c${c}`, "Column", column(), { material: "wood", at: [cx, 0, 0] });
    k.part(`ring${c}`, "Steel ring", [176, 60, 176], [cx, 620, 0], { shape: "cyl", material: "metal" });
    const angs = oval ? [cx > 0 ? 0.95 : PI - 0.95, cx > 0 ? -0.95 : PI + 0.95] : ring(4, (i) => PI / 4 + (i * PI) / 2);
    for (const a of angs) {
      const id = `l${legs.length}`;
      k.comp(id, "Leg", pedLeg(70, oval ? 430 : 470), { material: "wood", at: [cx, 0, 0], rot: [0, -a, 0] });
      legs.push({ id, a, cx });
    }
  });
  if (oval) k.part("beam", "Beam", [2 * 360 - 150, 90, 70], [0, 190, 0], { material: "wood" });
  const at = (l: (typeof legs)[number], r: number, y: number, t = 0): Vec3 => [l.cx + r * Math.cos(l.a) - t * Math.sin(l.a), y, r * Math.sin(l.a) + t * Math.cos(l.a)];
  const out = (l: (typeof legs)[number]): Vec3 => [Math.cos(l.a), 0, Math.sin(l.a)];
  const lids = legs.map((l) => l.id);
  const colIds = cols.map((_, c) => `c${c}`), rings = cols.map((_, c) => `ring${c}`);
  const base = [...colIds, ...rings, ...lids, ...(oval ? ["beam"] : [])];
  const leafSide = ["frame", "s0", "s1", "h0", "h1"];
  const halves = ["t0", "t1"];
  // the legs wait on the rug around the column, each in line with its place, so they go on along their dowels
  const laid = (i: number): Xf => (p, r) => [add3(p, [Math.cos(legs[i].a) * 320, 0, Math.sin(legs[i].a) * 320]), r];

  // the legs and their rods
  k.step({ title: "Lay out the legs and fit the barrel nuts and rods", detail: "On a rug. Push a barrel nut into the hole in the top of each leg and screw a long threaded rod into its end, the right way round.", kind: "bolts", warnings: ["floor"] }, () => {
    k.show(colIds, [0, 300, 0]);
    lids.forEach((id, i) => k.put([id], laid(i)));
    k.fit(BARREL, legs.map((l) => at(l, 110, 268)), [0, -1, 0], (i) => lids[i], { hole: false });
    k.fit(ROD, legs.map((l) => at(l, 70, 235)), (i) => out(legs[i]), (i) => lids[i], { travel: 60 });
  });
  k.step({ title: "Tap two dowels into each leg", detail: "Into the holes either side of the rod, with a hammer.", kind: "dowels", tools: ["hammer"] }, () =>
    k.fit(DOWEL, legs.flatMap((l) => [at(l, 70, 235, -22), at(l, 70, 235, 22)]), (i) => out(legs[i >> 1]), (i) => lids[i >> 1]),
  );
  k.step({ title: oval ? "Bolt two legs onto each column" : "Bolt the legs onto the column", detail: "Drop the steel ring over the top of the column first. Push each leg's rod through, then a washer and a coupling nut inside, tightened with the spanner.", kind: "bolts", tools: ["wrench"] }, () => {
    k.show(rings, [0, 260, 0]);
    k.show(lids, undefined, 0.15);
    k.fit(WASHER, legs.map((l) => at(l, 40, 235)), (i) => out(legs[i]), (i) => lids[i], { hole: false });
    k.fit(COUPLER, legs.map((l) => at(l, 36, 235)), (i) => out(legs[i]), (i) => lids[i], { hole: false });
  });
  if (oval) {
    const bx = 360 - 75;
    k.step({ title: "Fit barrel nuts and rods in the beam", detail: "A barrel nut near each end, lined up with a flat screwdriver, then a long rod screwed into each end.", kind: "bolts", tools: ["flathead"] }, () => {
      k.put(["beam"], shift([0, 0, 700]));
      k.fit(BARREL, LR.map((s) => [s * (bx - 40), 235, 0] as Vec3), [0, -1, 0], "beam", { hole: false });
      k.fit(ROD, LR.map((s) => [s * bx, 190, 0] as Vec3), (i) => [-LR[i], 0, 0], "beam", { travel: 60 });
    });
    k.step({ title: "Tap two dowels into each end of the beam", kind: "dowels", tools: ["hammer"] }, () =>
      k.fit(DOWEL, LR.flatMap((s) => [[s * bx, 190, -22], [s * bx, 190, 22]] as Vec3[]), (i) => [-LR[i >> 1], 0, 0], "beam"),
    );
    k.step({ title: "Join the columns with the beam", detail: "Its rods go through the columns. A washer and a coupling nut on each, inside the column, tightened with the spanner.", kind: "bolts", tools: ["wrench"] }, () => {
      k.show(["beam"]);
      k.fit(WASHER, LR.map((s) => [s * 330, 190, 0] as Vec3), (i) => [-LR[i], 0, 0], "beam", { hole: false });
      k.fit(COUPLER, LR.map((s) => [s * 334, 190, 0] as Vec3), (i) => [-LR[i], 0, 0], "beam", { hole: false });
    });
  }
  const tops = cols.flatMap((cx) => LR.map((s) => [cx + s * 40, 650, 0] as Vec3));
  k.step({ title: oval ? "Fit barrel nuts and short rods in the column tops" : "Fit barrel nuts and short rods in the column top", detail: "A barrel nut in each side hole, lined up, then a short rod screwed down into the top.", kind: "bolts", tools: ["flathead"] }, () => {
    k.fit(BARREL, cols.flatMap((cx) => LR.map((s) => [cx + s * 75, 620, 0] as Vec3)), (i) => [-LR[i % 2], 0, 0], (i) => colIds[i >> 1], { hole: false });
    k.fit(RODS, tops, [0, -1, 0], (i) => colIds[i >> 1], { travel: 40 });
  });
  k.step({ title: oval ? "Tap a dowel into each column top" : "Tap two dowels into the column top", kind: "dowels", tools: ["hammer"] }, () =>
    k.fit(DOWEL, oval ? cols.map((cx) => [cx, 650, 45] as Vec3) : LR.map((s) => [0, 650, s * 45] as Vec3), [0, -1, 0], (i) => colIds[oval ? i : 0]),
  );

  // the leaf frame and its slides
  const slidePts = (n: number, span: number) => LR.flatMap((s) => ring(n, (i) => [-span / 2 + (span * (i + 0.5)) / n, TY - 15, s * SZ] as Vec3));
  if (!oval)
    k.step({ title: "Screw the slides onto the frame", detail: "One bolt at the end of each slide first, then four screws along it. Don't overtighten.", scene: "frame", kind: "screws", tools: ["allen", "screwdriver"] }, () => {
      k.show(["frame"], [0, 200, 0]);
      k.show(["s0", "s1"], [0, 0, 200]);
      k.fit(MSCREW, LR.map((s) => [FL / 2 - 40, TY - 15, s * (SZ + 15)] as Vec3), (i) => [0, 0, -LR[i]], (i) => `s${i}`, { mate: () => "frame" });
      k.fit(WSCREW, slidePts(4, FL - 120).map((p) => [p[0], p[1], p[2] + Math.sign(p[2]) * 15] as Vec3), (i) => [0, 0, i < 4 ? 1 : -1], (i) => `s${i >> 2}`, { mate: () => "frame" });
    });
  k.step({ title: "Push the two spring catches into the frame ends", kind: "join", scene: "frame" }, () => {
    if (oval) k.show(["frame"], [0, 200, 0]);
    k.fit({ kind: "stud", len: 50, dia: 8, name: "Spring catch" }, LR.map((s) => [s * (FL / 2), TY - 40, 0] as Vec3), (i) => [-LR[i], 0, 0], "frame", { travel: 30 });
  });
  k.step({ title: "Fit the leaf holders with dowels and cams", detail: "A dowel and a cam in each holder, then set them in the frame and turn the cams with the Allen key to lock them.", scene: "frame", kind: "cams", tools: ["allen"] }, () => {
    k.show(["h0", "h1"], [0, 160, 0]);
    k.fit({ kind: "dowel", len: 25, dia: 6 }, LR.map((s) => [-40, TY - FH + 25, s * (FW / 2 - 24)] as Vec3), (i) => [0, 0, LR[i]], (i) => `h${i}`);
    k.fit({ kind: "cam", len: 13, dia: 20 }, LR.map((s) => [30, TY - FH + 25, s * (FW / 2 - 44)] as Vec3), (i) => [0, 0, LR[i]], (i) => `h${i}`);
  });

  const F = flip(H);
  if (!oval) {
    // the 110: the base goes onto the frame on the upside-down top
    k.step({ title: "Lay the top halves face down and lock them", detail: "On a rug, side by side. Turn both latches to locked.", scene: "top", kind: "general", warnings: ["floor", "face"] }, () => k.put(halves, F, [0, 200, 0]));
    k.step({ title: "Set the frame on the top", detail: "Its pegs go into the holes in the halves. Don't press on the leaf.", scene: "top", kind: "join" }, () => k.put(leafSide, F, [0, 260, 0], 0));
    k.step({ title: "Screw the slides to the top", detail: "Twelve screws, six along each slide. Don't overtighten.", scene: "top", kind: "screws", tools: ["screwdriver"] }, () =>
      k.fit(WSCREW, slidePts(6, SL - 120), [0, 1, 0], (i) => `s${i >= 6 ? 1 : 0}`, { mate: (i) => `t${(i % 6) < 3 ? 0 : 1}` }),
    );
    k.step({ title: "Turn the base over onto the frame", detail: "Lower it upside down so the column top sits in the middle of the frame.", scene: "top", kind: "join" }, () => k.put(base, F, [0, 380, 0], 0));
    const brPts = ring(4, (i) => i * (PI / 2)).map((a) => [Math.cos(a) * 90, 625, Math.sin(a) * 90] as Vec3);
    k.step({ title: "Bolt four angle brackets to the column", detail: "Two machine screws with toothed washers through each bracket into the column top.", scene: "top", kind: "bolts", tools: ["allen"] }, () => {
      k.fit({ kind: "angle", len: 70, dia: 50, name: "Angle bracket" }, brPts, (i) => [-Math.cos((i * PI) / 2), 0, -Math.sin((i * PI) / 2)], "c0", { hole: false });
      const sp = brPts.flatMap((p) => [[p[0], 610, p[2]], [p[0], 638, p[2]]] as Vec3[]);
      k.fit(LOCKW, sp, (i) => [-Math.cos(((i >> 1) * PI) / 2), 0, -Math.sin(((i >> 1) * PI) / 2)], "c0", { hole: false });
      k.fit(MSCREW, sp, (i) => [-Math.cos(((i >> 1) * PI) / 2), 0, -Math.sin(((i >> 1) * PI) / 2)], "c0");
    });
    k.step({ title: "Screw the brackets to the frame", detail: "Two screws through each bracket into the frame's base.", scene: "top", kind: "screws", tools: ["screwdriver"] }, () =>
      k.fit(WSCREW, brPts.flatMap((p) => [[p[0] * 1.5 - p[2] * 0.3, TY - 46, p[2] * 1.5 + p[0] * 0.3], [p[0] * 1.5 + p[2] * 0.3, TY - 46, p[2] * 1.5 - p[0] * 0.3]] as Vec3[]), [0, 1, 0], "frame"), // into the underside of its base
    );
    k.step({ title: "Turn the table over together", detail: "Lift it by the top, never by the legs.", kind: "standup", people: 2 }, () => {
      k.show([...base, ...leafSide, ...halves], undefined, 0);
    });
  } else {
    // the 160: the frame goes onto the standing base, the top onto the frame
    const brPts = cols.flatMap((cx) => LR.map((s) => [cx + s * 90, TY - FH, 0] as Vec3));
    k.step({ title: "Screw four angle brackets under the frame", detail: "Frame upside down. Two machine screws with toothed washers through each bracket.", scene: "frame", kind: "bolts", tools: ["allen"] }, () => {
      k.fit({ kind: "angle", len: 70, dia: 50, name: "Angle bracket" }, brPts, [0, 1, 0], "frame", { hole: false });
      const sp = brPts.flatMap((p) => [[p[0], p[1], p[2] - 30], [p[0], p[1], p[2] + 30]] as Vec3[]);
      k.fit(LOCKW, sp, [0, 1, 0], "frame", { hole: false });
      k.fit(MSCREW, sp, [0, 1, 0], "frame");
    });
    k.step({ title: "Lower the frame onto the columns", detail: "The short rods go up through the brackets.", kind: "join" }, () => k.show(["frame", "h0", "h1"], [0, 300, 0], 0)); // the slides go on with the top
    k.step({ title: "Tighten four cap nuts onto the rods", detail: "With the crank key, through the holes in the frame.", kind: "bolts", tools: ["allen"] }, () =>
      k.fit({ kind: "nut", len: 12, dia: 10, name: "Cap nut" }, tops.map((p) => [p[0], TY - FH + 6, p[2]] as Vec3), [0, -1, 0], (i) => colIds[i >> 1], { hole: false }),
    );
    k.step({ title: "Screw the brackets to the column tops", detail: "Two screws through each bracket.", kind: "screws", tools: ["screwdriver"] }, () =>
      k.fit({ kind: "screw", len: 30, dia: 5 }, cols.flatMap((cx) => LR.flatMap((s) => [-25, 25].map((z) => [cx + s * 75, 635, z] as Vec3))), (i) => [-LR[(i >> 1) % 2], 0, 0], (i) => colIds[i >> 2]),
    );
    k.step({ title: "Lay the top halves face down and lock them", detail: "On a rug, side by side. Turn both latches to locked.", scene: "top", kind: "general", warnings: ["floor", "face"] }, () => {
      k.put(halves, F, [0, 200, 0]);
      k.put(["s0", "s1"], F, [0, 200, 0]);
    });
    k.step({ title: "Screw the slides to the top", detail: "Sixteen screws, eight along each slide. Don't overtighten.", scene: "top", kind: "screws", tools: ["screwdriver"] }, () =>
      k.fit(WSCREW, slidePts(8, SL - 120), [0, 1, 0], (i) => `s${i >= 8 ? 1 : 0}`, { mate: (i) => `t${(i % 8) < 4 ? 0 : 1}` }),
    );
    k.step({ title: "Lift the top onto the frame together", detail: "Turn it the right way up and lower it so the slides sit on the frame.", kind: "join", people: 2 }, () => k.show([...halves, "s0", "s1"], [0, 300, 0], 0));
    k.step({ title: "Screw the slides to the frame from below", detail: "Eight screws, four along each side.", kind: "screws", tools: ["screwdriver"] }, () =>
      k.fit(WSCREW, slidePts(4, FL - 120).map((p) => [p[0], TY - 30, p[2]] as Vec3), [0, 1, 0], (i) => `s${i >> 2}`, { mate: () => "frame" }),
    );
    k.step({ title: "Pull the halves apart and screw the slide ends", detail: "Four more screws, two at each end of the slides, that you can only reach with the table open.", kind: "screws", tools: ["screwdriver"] }, () =>
      k.fit(WSCREW, LR.flatMap((s) => LR.map((e) => [e * (SL / 2 - 40), TY - 30, s * SZ] as Vec3)), [0, 1, 0], (i) => `s${i >> 1}`, { mate: (i) => `t${i % 2}` }),
    );
  }
  k.step({ title: "Pull the halves apart and take out the transport screws", detail: "Open the latches first. Throw the two screws away; the leaf can open now.", kind: "general" });
  k.step({ title: "Unfold the leaf and lay it in", detail: "Lift it up out of the frame, fold it open and lower it between the halves.", kind: "general" });
  k.step({ title: "Push the halves together and lock the latches", detail: "Until they click. To close it again, lift the leaf, fold it back into the frame and push the halves together.", kind: "general" });
  return true;
}

/* ---------- the rectangular table ---------- */

function rectTable(b: PlanBuilder) {
  const k = new Kit(b);
  const L = 1550, Wd = 870, H = 750, TT = 25, TY = H - TT, AH = 90, AY = TY - AH / 2;
  const LX = 700, LZ = 360, LB = 65, split = 375;
  // the main top with its long aprons and one end apron; the end section with its own; the slide frame between
  k.part("top", "Table top", [L - (L / 2 - split) - 0, TT, Wd], [(-L / 2 + split) / 2, TY + TT / 2, 0], { material: "board" });
  k.part("end", "End top", [L / 2 - split, TT, Wd], [(L / 2 + split) / 2, TY + TT / 2, 0], { material: "board" });
  const aLen = split - (-LX + LB / 2), aX = (split + (-LX + LB / 2)) / 2;
  LR.forEach((s, i) => k.part(`a${i}`, "Long apron", [aLen, AH, 22], [aX, AY, s * LZ], { material: "wood" }));
  k.part("ae", "End apron", [22, AH, 2 * LZ - LB], [-LX, AY, 0], { material: "wood" });
  k.part("be", "End apron", [22, AH, 2 * LZ - LB], [LX, AY, 0], { material: "wood" });
  const sLen = LX - LB / 2 - split;
  LR.forEach((s, i) => k.part(`b${i}`, "Short apron", [sLen, AH, 22], [split + sLen / 2, AY, s * LZ], { material: "wood" }));
  const RZ = 290, RY2 = TY - 22;
  LR.forEach((s, i) => k.part(`r${i}`, "Runner", [1280, 40, 36], [0, RY2, s * RZ], { material: "wood" }));
  LR.forEach((s, i) => k.part(`x${i}`, "Cross bar", [60, 30, 2 * RZ - 36], [s * 450, RY2, 0], { material: "wood" }));
  LR.forEach((s, i) => k.part(`g${i}`, "Slide rail", [1280, 18, 40], [0, RY2 - 29, s * RZ], { material: "wood" }));
  k.part("leaf", "Leaf", [600, 22, 2 * RZ - 50], [-150, RY2 - 49, 0], { material: "board" });
  const leg: PartPiece[] = [box([LB, 110, LB], [0, TY - 55, 0]), cyl(64, 140, [0, TY - 180, 0]), cyl(54, 300, [0, 315, 0]), cyl(36, 165, [0, 82, 0])];
  const legPos = LR.flatMap((sx) => LR.map((sz) => [sx * LX, 0, sz * LZ] as Vec3));
  legPos.forEach((p, i) => k.comp(`l${i}`, "Leg", leg, { material: "wood", at: p }));

  const frame = ["x0", "x1", "r0", "r1", "g0", "g1", "be"];
  const away = shift([700, 0, 0]);
  const out = (i: number) => [0, 0, LR[i]] as Vec3;
  k.step({ title: "Tap dowels into the cross bars", detail: "Two in each end. Lay the parts on a rug.", pose: "-y", kind: "dowels", tools: ["hammer"], warnings: ["floor"] }, () => {
    k.put(["x0", "x1"], away, [0, -200, 0]);
    k.fit(DOWEL, LR.flatMap((sx) => LR.flatMap((sz) => [[sx * 450 - 15, RY2, sz * (RZ - 18)], [sx * 450 + 15, RY2, sz * (RZ - 18)]] as Vec3[])), (i) => out((i >> 1) % 2), (i) => `x${i >> 2}`);
  });
  k.step({ title: "Push the runners onto the cross bars", detail: "One along each side, onto the dowels.", pose: "-y", kind: "join" }, () => k.put(["r0", "r1"], away, [0, 0, 0]));
  k.step({ title: "Screw four cam studs into the slide rails", pose: "-y", kind: "cams", tools: ["screwdriver"] }, () => {
    k.put(["g0", "g1"], shift([700, 0, 0]), [0, -150, 0]);
    k.fit({ kind: "camScrew", len: 34, dia: 7, name: "Cam stud" }, LR.flatMap((s) => LR.map((e) => [700 + e * 450, RY2 - 20, s * RZ] as Vec3)).map((p) => [p[0] - 700, p[1], p[2]] as Vec3), [0, -1, 0], (i) => `g${i >> 1}`);
  });
  k.step({ title: "Screw two pins into the slide rails", detail: "One near the end of each.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fit({ kind: "stud", len: 20, dia: 8, name: "Pin" }, LR.map((s) => [-600, RY2 - 38, s * RZ] as Vec3), [0, 1, 0], (i) => `g${i}`),
  );
  k.step({ title: "Screw a corner bracket onto each slide rail", detail: "Two screws each, at the end without the pin.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () => {
    k.fit(CORNER, LR.map((s) => [620, RY2 - 29, s * (RZ - 20)] as Vec3), (i) => out(i), (i) => `g${i}`, { hole: false });
    k.fit(SCREW, LR.flatMap((s) => [[600, RY2 - 29, s * (RZ - 20)], [640, RY2 - 29, s * (RZ - 20)]] as Vec3[]), (i) => out(i >> 1), (i) => `g${i >> 1}`);
  });
  k.step({ title: "Press the slide rails onto the frame", detail: "The cam studs go into the holes in the cross bars.", pose: "-y", kind: "join" }, () => k.put(["g0", "g1"], away));
  k.step({ title: "Tighten the four cam locks", detail: "Arrow towards the stud, then a turn clockwise.", pose: "-y", kind: "cams", tools: ["screwdriver"] }, () =>
    k.fit(HWCAM, LR.flatMap((s) => LR.map((e) => [e * 450, RY2 - 10, s * (RZ - 30)] as Vec3)), (i) => out(i >> 1), (i) => `x${i % 2}`),
  );
  k.step({ title: "Screw the catch onto the end apron", detail: "From the second bag. Two screws.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () => {
    k.put(["be"], away, [0, -200, 0]);
    k.fit({ kind: "clip", len: 40, dia: 40, name: "Catch" }, [[LX - 11, AY, 0]], [1, 0, 0], "be", { hole: false });
    k.fit({ kind: "screw", len: 12, dia: 4 }, [[LX - 11, AY, -20], [LX - 11, AY, 20]], [1, 0, 0], "be");
  });
  k.step({ title: "Screw the end apron to the brackets", detail: "Four screws, two through each bracket.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fit(SCREW, LR.flatMap((s) => [[LX - 11, AY - 20, s * (RZ - 20)], [LX - 11, AY + 20, s * (RZ - 20)]] as Vec3[]), [1, 0, 0], "be"),
  );
  k.step({ title: "Tap dowels into the long aprons", detail: "Four in the top edge of each.", pose: "-y", kind: "dowels", tools: ["hammer"] }, () => {
    k.put(["a0", "a1"], shift([0, 0, 0]), [0, -200, 0]);
    k.fit(DOWEL, LR.flatMap((s) => ring(4, (i) => [aX - aLen / 2 + 120 + ((aLen - 240) * i) / 3, TY, s * LZ] as Vec3)), [0, 1, 0], (i) => `a${i >> 2}`);
  });
  k.step({ title: "Lay the top face down and screw in ten cam studs", pose: "-y", kind: "cams", tools: ["screwdriver"], warnings: ["face"] }, () => {
    k.show(["top"], [0, 200, 0]);
    k.fit({ kind: "camScrew", len: 34, dia: 7, name: "Cam stud" }, LR.flatMap((s) => ring(5, (i) => [aX - aLen / 2 + 70 + ((aLen - 140) * i) / 4, TY, s * (LZ - 30)] as Vec3)), [0, 1, 0], "top");
  });
  k.step({ title: "Bolt the long aprons onto the top", detail: "Press them on over the dowels and studs, then two long bolts through each.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {
    k.show(["a0", "a1"]);
    k.fit({ kind: "bolt", len: 70, dia: 6, name: "Long bolt" }, LR.flatMap((s) => LR.map((e) => [aX + e * (aLen / 2 - 30), TY - AH, s * LZ] as Vec3)), [0, 1, 0], (i) => `a${i >> 1}`, { mate: () => "top" });
  });
  k.step({ title: "Tighten the ten cam locks", pose: "-y", kind: "cams", tools: ["screwdriver"] }, () =>
    k.fit(HWCAM, LR.flatMap((s) => ring(5, (i) => [aX - aLen / 2 + 70 + ((aLen - 140) * i) / 4, TY - 25, s * (LZ - 11)] as Vec3)), (i) => out(i >= 5 ? 0 : 1).map((v) => -v) as Vec3, (i) => `a${i >= 5 ? 1 : 0}`),
  );
  k.step({ title: "Slide the frame into the aprons", detail: "Its slide rails run in the grooves inside the aprons.", pose: "-y", kind: "join" }, () => k.show(frame, undefined, 0));
  k.step({ title: "Fit the other end apron with two corner brackets", detail: "Two screws in each bracket.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () => {
    k.show(["ae"], [-200, 0, 0]);
    const p = LR.map((s) => [-LX + 30, AY, s * (LZ - 40)] as Vec3);
    k.fit(CORNER, p, (i) => out(i), "ae", { hole: false });
    k.fit(SCREW, p.flatMap((q) => [[q[0], q[1] - 20, q[2]], [q[0], q[1] + 20, q[2]]] as Vec3[]), (i) => out(i >> 1), (i) => `a${i >> 1}`);
  });
  k.step({ title: "Fix it with two long bolts", pose: "-y", kind: "bolts", tools: ["allen"] }, () =>
    k.fit({ kind: "bolt", len: 70, dia: 6, name: "Long bolt" }, LR.map((s) => [-LX, TY - AH, s * 200] as Vec3), [0, 1, 0], "ae", { mate: () => "top" }),
  );
  k.step({ title: "Screw on the stop block", detail: "Two screws. It stops the frame coming out when the table is open.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () => {
    k.fit({ kind: "clip", len: 40, dia: 30, name: "Stop block" }, [[0, TY, 0]], [0, 1, 0], "top", { hole: false });
    k.fit({ kind: "screw", len: 16, dia: 4 }, [[-20, TY, 0], [20, TY, 0]], [0, 1, 0], "top");
  });
  k.step({ title: "Push the end section on until it clicks", detail: "Its catch locks onto the end apron.", pose: "-y", kind: "join" }, () => k.show(["end", "b0", "b1"], [300, 0, 0], 0.05));
  k.step({ title: "Screw two pins into the end section", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fit({ kind: "stud", len: 20, dia: 8, name: "Pin" }, LR.map((s) => [split + 60, TY, s * 200] as Vec3), [0, 1, 0], "end"),
  );
  k.step({ title: "Screw its short aprons to the brackets", detail: "Four screws, two through each bracket.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fit(SCREW, LR.flatMap((s) => [[LX - 60, AY - 20, s * (LZ - 11)], [LX - 60, AY + 20, s * (LZ - 11)]] as Vec3[]), (i) => out(i >> 1), (i) => `b${i >> 1}`),
  );
  k.step({ title: "Bolt the end section on", detail: "Three long bolts.", pose: "-y", kind: "bolts", tools: ["allen"] }, () =>
    k.fit({ kind: "bolt", len: 70, dia: 6, name: "Long bolt" }, [-1, 0, 1].map((t) => [LX, TY - AH, t * 200] as Vec3), [0, 1, 0], "be", { mate: () => "end" }),
  );
  const legPrep = (ids: number[], n: number) =>
    k.step({ title: n ? "Prepare the other two legs" : "Fit a dowel, barrel nut and two rods in two legs", detail: "A dowel in the top, the barrel nut in its hole, then the long and the short rod screwed into it through the side.", pose: "-y", kind: "bolts" }, () => {
      ids.forEach((i, j) => k.put([`l${i}`], () => [[(j - 0.5) * 200, H - 32, 600], [0, 0, PI / 2]]));
      k.fit(DOWEL, ids.map((i) => [legPos[i][0], TY, legPos[i][2]] as Vec3), [0, -1, 0], (j) => `l${ids[j]}`);
      k.fit(BARREL, ids.map((i) => [legPos[i][0], TY - 40, legPos[i][2]] as Vec3), [0, -1, 0], (j) => `l${ids[j]}`, { hole: false });
      const dirIn = (i: number): Vec3 => [Math.sign(legPos[i][0]) * Math.SQRT1_2, 0, Math.sign(legPos[i][2]) * Math.SQRT1_2];
      k.fit({ kind: "stud", len: 110, dia: 8, name: "Threaded rod" }, ids.map((i) => [legPos[i][0] - Math.sign(legPos[i][0]) * 23, TY - 30, legPos[i][2] - Math.sign(legPos[i][2]) * 23] as Vec3), (j) => dirIn(ids[j]), (j) => `l${ids[j]}`, { travel: 60 });
      k.fit({ kind: "stud", len: 70, dia: 8, name: "Threaded rod" }, ids.map((i) => [legPos[i][0] - Math.sign(legPos[i][0]) * 23, TY - 75, legPos[i][2] - Math.sign(legPos[i][2]) * 23] as Vec3), (j) => dirIn(ids[j]), (j) => `l${ids[j]}`, { travel: 40 });
    });
  const legOn = (ids: number[], n: number) =>
    k.step({ title: n ? "Fit the other two legs" : "Fit two legs on the brackets", detail: "Push the rods through the bracket, then a washer and a nut on each, tightened with the box spanner.", pose: "-y", kind: "legs", tools: ["wrench"] }, () => {
      k.show(ids.map((i) => `l${i}`), [0, 0, 0]);
      const pts = ids.flatMap((i) => [TY - 30, TY - 75].map((y) => [legPos[i][0] - Math.sign(legPos[i][0]) * 70, y, legPos[i][2] - Math.sign(legPos[i][2]) * 70] as Vec3));
      const d = (j: number): Vec3 => { const i = ids[j >> 1]; return [Math.sign(legPos[i][0]) * Math.SQRT1_2, 0, Math.sign(legPos[i][2]) * Math.SQRT1_2]; };
      k.fit(WASHER, pts, d, (j) => `l${ids[j >> 1]}`, { hole: false });
      k.fit(NUT, pts.map((p) => [p[0] * 0.995, p[1], p[2] * 0.99] as Vec3), d, (j) => `l${ids[j >> 1]}`, { hole: false });
    });
  legPrep([0, 1], 0);
  legOn([0, 1], 0);
  legPrep([2, 3], 1);
  legOn([2, 3], 1);
  k.step({ title: "Press a glide into each foot", pose: "-y", kind: "legs" }, () =>
    k.fit({ kind: "glide", len: 6, dia: 30 }, legPos.map((p) => [p[0], 0, p[2]] as Vec3), [0, 1, 0], (i) => `l${i}`, { hole: false }),
  );
  k.step({ title: "Turn the table over together", detail: "Lift it by the top, not the legs.", kind: "standup", people: 2 });
  k.step({ title: "Screw the stop and the two leaf supports onto the leaf", detail: "Leaf face down. One stop with two screws, then the two supports from the third bag with two screws each.", scene: "leaf", kind: "screws", tools: ["screwdriver"] }, () => {
    k.put(["leaf"], flip(2 * (RY2 - 49) + 22 - 11 * 2 + 0, [0, 0, 0]), [0, 200, 0]);
    k.fit({ kind: "clip", len: 40, dia: 30, name: "Stop block" }, [[-150, RY2 - 60, 0]], [0, 1, 0], "leaf", { hole: false });
    k.fit({ kind: "screw", len: 16, dia: 4 }, [[-170, RY2 - 60, 0], [-130, RY2 - 60, 0]], [0, 1, 0], "leaf");
    const sp = LR.map((s) => [-150 + s * 250, RY2 - 60, 0] as Vec3);
    k.fit({ kind: "angle", len: 90, dia: 40, name: "Leaf support" }, sp, [0, 1, 0], "leaf", { hole: false });
    k.fit({ kind: "screw", len: 16, dia: 4 }, sp.flatMap((p) => [[p[0], p[1], -30], [p[0], p[1], 30]] as Vec3[]), [0, 1, 0], "leaf");
  });
  k.step({ title: "Open the table and try the leaf", detail: "Unlock the catch under the end and pull it out. Lay the leaf in with its two pins in the holes, then push the end back until it clicks.", kind: "general" }, () => {});
  k.step({ title: "Store the leaf under the top", detail: "With the table closed it rests on the frame under the top, ready for next time.", kind: "join" }, () => {
    k.show(["leaf"], [0, -200, 0]);
    k.fit({ kind: "pin", len: 20, dia: 8, name: "Leaf pin" }, LR.map((s) => [-150 + s * 220, RY2 - 38, 0] as Vec3), [0, -1, 0], "leaf", { hole: false });
  });
  return true;
}
const HWCAM: HwDef = { kind: "cam", len: 13, dia: 15 };

/* ---------- the desk ---------- */

function desk(b: PlanBuilder) {
  const k = new Kit(b);
  const H = 750, TT = 28, TY = H - TT, AH = 82, AY = TY - AH / 2, LX = 310, LZ = 235, LB = 50, RZ = LZ;
  // the round ends sit a hair lower than the middle so their rims don't show across it
  k.comp("top", "Desk top", [box([600, TT, 600], [0, TY + TT / 2, 0]), ...LR.map((s) => cyl(600, TT - 6, [s * 300, TY + TT / 2 - 3, 0]))]);
  k.part("rb", "Back rail", [2 * LX - LB, AH, 20], [0, AY, -RZ], { material: "wood" });
  k.comp("rf", "Front rail", [...LR.map((s) => box([55, AH, 20], [s * (LX - LB / 2 - 27.5), AY, RZ])), box([2 * LX - LB, 16, 20], [0, TY - 8, RZ])], { material: "wood" });
  LR.forEach((s, i) => k.part(`re${i}`, "End rail", [20, AH, 2 * LZ - LB], [s * LX, AY, 0], { material: "wood" }));
  // a curved rail round each end, from the back leg to the front one
  const arc: PartPiece[] = ring(6, (i) => {
    const a0 = -PI / 2 + (PI * i) / 6, a1 = -PI / 2 + (PI * (i + 1)) / 6, am = (a0 + a1) / 2, R = LZ;
    return box([2 * R * Math.sin(PI / 12) + 6, AH, 20], [R * Math.cos(am), AY, R * Math.sin(am)], { rot: [0, -am - PI / 2, 0] });
  });
  LR.forEach((s, i) => k.comp(`ce${i}`, "Curved rail", arc, { material: "wood", at: [s * LX, 0, 0], rot: [0, s > 0 ? 0 : PI, 0] }));
  const leg: PartPiece[] = [box([LB, AH, LB], [0, AY, 0]), cyl(44, 360, [0, TY - AH - 180, 0]), cyl(36, 280, [0, 140, 0])];
  const legPos = LR.flatMap((sx) => LR.map((sz) => [sx * LX, 0, sz * LZ] as Vec3));
  legPos.forEach((p, i) => k.comp(`l${i}`, "Leg", leg, { material: "wood", at: p }));
  LR.forEach((s, i) => k.part(`dr${i}`, "Drawer rail", [16, 30, 2 * RZ - 30], [s * 222, TY - 15, -5], { material: "metal" }));
  const DY = TY - 50, DW = 428;
  k.part("df", "Drawer front", [440, 56, 18], [0, DY, RZ + 1], { material: "wood" });
  LR.forEach((s, i) => k.part(`ds${i}`, "Drawer side", [12, 50, 400], [s * (DW / 2 - 6), DY - 2, RZ - 9 - 200], { material: "board" }));
  k.part("db", "Drawer back", [DW - 24, 50, 12], [0, DY - 2, RZ - 9 - 394], { material: "board" });
  k.part("dbot", "Drawer bottom", [DW - 20, 4, 396], [0, DY - 24, RZ - 9 - 200], { material: "fiber" });
  LR.forEach((s, i) => k.part(`dsl${i}`, "Drawer slide", [6, 20, 390], [s * (DW / 2 + 3), DY, RZ - 9 - 200], { material: "metal" }));
  k.part("felt", "Felt mat", [DW - 30, 3, 380], [0, DY - 20, RZ - 9 - 200], { material: "soft" });

  const rails = ["rb", "rf", "re0", "re1"];
  const spread = (id: string): Xf => {
    const o: Record<string, Vec3> = { rb: [0, 0, -160], rf: [0, 0, 160], re0: [-160, 0, 0], re1: [160, 0, 0] };
    return shift(o[id]);
  };
  const corners = legPos.map((p) => [p[0] - Math.sign(p[0]) * (LB / 2 + 18), AY, p[2] - Math.sign(p[2]) * (LB / 2 + 18)] as Vec3);
  const diag = (i: number): Vec3 => [Math.sign(legPos[i][0]) * Math.SQRT1_2, 0, Math.sign(legPos[i][2]) * Math.SQRT1_2];
  const dowelPts: [string, Vec3][] = [
    ...[-200, 0, 200].map((x) => ["rb", [x, TY, -RZ]] as [string, Vec3]),
    ...LR.map((s) => ["rf", [s * 255, TY, RZ]] as [string, Vec3]),
    ["rf", [0, TY, RZ]],
    ...LR.flatMap((s, i) => [-90, 90].map((z) => [`re${i}`, [s * LX, TY, z]] as [string, Vec3])),
  ];
  k.step({ title: "Tap ten dowels into the rails", detail: "Into the holes in their top edges. Lay the rails on a rug.", pose: "-y", kind: "dowels", tools: ["hammer"], warnings: ["floor"] }, () => {
    for (const id of rails) k.put([id], spread(id), [0, -150, 0], 0.08);
    k.fit(DOWEL, dowelPts.map(([, p]) => p), [0, -1, 0], (i) => dowelPts[i][0]);
  });
  const bolts = (on: (i: number) => string, axis: 0 | 2) => {
    const pts = corners.flatMap((c, i) => [AY - 20, AY + 20].map((y) => (axis === 0 ? [legPos[i][0] - Math.sign(legPos[i][0]) * 10, y, c[2]] : [c[0], y, legPos[i][2] - Math.sign(legPos[i][2]) * 10]) as Vec3));
    const d = (j: number): Vec3 => { const i = j >> 1; return axis === 0 ? [Math.sign(legPos[i][0]), 0, 0] : [0, 0, Math.sign(legPos[i][2])]; };
    k.fit({ kind: "nut", len: 10, dia: 10, name: "Insert nut" }, pts, d, on, { hole: false });
    k.fit({ kind: "bolt", len: 20, dia: 6 }, pts, d, on);
  };
  k.step({ title: "Bolt the corner brackets onto the end rails", detail: "Two insert nuts and two bolts through each bracket.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => {
    k.fit(CORNER, corners, diag, (i) => `re${legPos[i][0] > 0 ? 1 : 0}`, { hole: false });
    bolts((j) => `re${legPos[j >> 1][0] > 0 ? 1 : 0}`, 0);
  });
  k.step({ title: "Stand the rails up into a frame", detail: "Front and back rails between the end rails, on the brackets.", pose: "-y", kind: "join" }, () => k.show(rails, undefined, 0.1));
  k.step({ title: "Bolt the brackets to the front and back rails", detail: "Two insert nuts and two bolts through each bracket.", pose: "-y", kind: "bolts", tools: ["allen"] }, () => bolts((j) => (legPos[j >> 1][2] > 0 ? "rf" : "rb"), 2));
  k.step({ title: "Lift the frame onto the top together", detail: "Top face down on the flattened box. The ten dowels go into its holes.", pose: "-y", kind: "join", people: 2, warnings: ["two", "face"] }, () => k.show(["top"], [0, 220, 0]));
  k.step({ title: "Screw the frame to the top", detail: "Ten long screws through the rails.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fit({ kind: "screw", len: 50, dia: 4 }, dowelPts.map(([, p]) => [p[0] + (p[0] === 0 ? 30 : 0), TY - 30, p[2]] as Vec3), [0, 1, 0], (i) => dowelPts[i][0], { mate: () => "top" }),
  );
  const laid = (i: number): Xf => () => [[-60, H - 25, 560 + 110 * i], [0, 0, PI / 2]];
  k.step({ title: "Screw a glide into the foot of each leg", detail: "By hand, all the way in.", pose: "-y", kind: "legs", warnings: ["hand"] }, () => {
    legPos.forEach((_, i) => k.put([`l${i}`], laid(i), [0, -120, 0], 0.08));
    k.fit({ kind: "glide", len: 8, dia: 30 }, legPos.map((p) => [p[0], 0, p[2]] as Vec3), [0, 1, 0], (i) => `l${i}`, { hole: false });
  });
  const rodPts = legPos.flatMap((p) => [AY - 18, AY + 18].map((y) => [p[0] - Math.sign(p[0]) * 18, y, p[2] - Math.sign(p[2]) * 18] as Vec3));
  k.step({ title: "Fit the barrel nuts and rods in the legs", detail: "A barrel nut in the hole in each leg's top, then two rods screwed into it through the inner corner.", pose: "-y", kind: "bolts", tools: ["flathead"] }, () => {
    k.fit(BARREL, legPos.map((p) => [p[0], TY, p[2]] as Vec3), [0, -1, 0], (i) => `l${i}`, { hole: false });
    k.fit({ kind: "stud", len: 70, dia: 8, name: "Threaded rod" }, rodPts, (j) => diag(j >> 1), (j) => `l${j >> 1}`, { travel: 40 });
  });
  const legOn = (ids: number[], title: string) =>
    k.step({ title, detail: "Push the rods through the bracket and put a washer and a nut on each, tightened with the box spanner.", pose: "-y", kind: "legs", tools: ["wrench"] }, () => {
      k.show(ids.map((i) => `l${i}`), [0, 0, 0], 0.15);
      const pts = ids.flatMap((i) => [rodPts[2 * i], rodPts[2 * i + 1]].map((p) => [p[0] - Math.sign(p[0]) * 40, p[1], p[2] - Math.sign(p[2]) * 40] as Vec3));
      k.fit(WASHER, pts, (j) => diag(ids[j >> 1]), (j) => `l${ids[j >> 1]}`, { hole: false });
      k.fit(NUT, pts, (j) => diag(ids[j >> 1]), (j) => `l${ids[j >> 1]}`, { hole: false });
    });
  legOn([0, 1], "Fit the two legs at one end");
  legOn([2, 3], "Fit the two legs at the other end");
  k.step({ title: "Tap dowels into the curved rails", detail: "Two in the top edge of each.", pose: "-y", kind: "dowels", tools: ["hammer"] }, () => {
    k.put(["ce0", "ce1"], (p, r) => [[p[0] * 1.6, p[1], p[2]], r], [0, -120, 0]);
    k.fit(DOWEL, LR.flatMap((s) => [-0.6, 0.6].map((a) => [s * (LX + LZ * Math.cos(a)), TY, LZ * Math.sin(a)] as Vec3)), [0, -1, 0], (i) => `ce${i >> 1}`);
  });
  k.step({ title: "Press the curved rails on at the ends", detail: "Between the legs, dowels into the top.", pose: "-y", kind: "join" }, () => k.show(["ce0", "ce1"]));
  k.step({ title: "Screw the curved rails to the top", detail: "Three long screws in each.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fit({ kind: "screw", len: 50, dia: 4 }, LR.flatMap((s) => [-0.9, 0, 0.9].map((a) => [s * (LX + LZ * Math.cos(a)), TY - 30, LZ * Math.sin(a)] as Vec3)), [0, 1, 0], (i) => `ce${Math.floor(i / 3)}`, { mate: () => "top" }),
  );
  k.step({ title: "Screw the drawer rails under the top", detail: "The one marked L on the left, R on the right. Two screws each.", pose: "-y", kind: "screws", tools: ["screwdriver"] }, () => {
    k.show(["dr0", "dr1"], [0, -150, 0]);
    k.fit({ kind: "screw", len: 12, dia: 4 }, LR.flatMap((s) => [-150, 150].map((z) => [s * 222, TY - 30, z] as Vec3)), [0, 1, 0], (i) => `dr${i >> 1}`, { mate: () => "top" });
  });
  k.step({ title: "Turn the desk over together", detail: "Lift it by the top, not the legs.", kind: "standup", people: 2 });

  // the drawer, built on the floor
  const fz = RZ + 1 - 9;
  k.step({ title: "Screw two cam studs into the drawer front", detail: "Front face down.", scene: "drawer", kind: "cams", tools: ["screwdriver"] }, () => {
    k.show(["df"], [0, 150, 0]);
    k.fit({ kind: "camScrew", len: 30, dia: 7, name: "Cam stud" }, LR.map((s) => [s * (DW / 2 - 6), DY + 10, fz] as Vec3), [0, 0, 1], "df");
  });
  k.step({ title: "Tap in two dowels", scene: "drawer", kind: "dowels", tools: ["hammer"] }, () =>
    k.fit({ kind: "dowel", len: 25, dia: 6 }, LR.map((s) => [s * (DW / 2 - 6), DY - 15, fz] as Vec3), [0, 0, 1], "df"),
  );
  k.step({ title: "Fit the sides with their plastic dowels", detail: "Push two plastic dowels in, then the sides onto the front.", scene: "drawer", kind: "join" }, () => {
    k.fit({ kind: "dowel", len: 25, dia: 8, name: "Plastic dowel" }, LR.map((s) => [s * (DW / 2 - 6), DY, RZ - 9 - 400] as Vec3), [0, 0, 1], (i) => `ds${i}`);
    k.show(["ds0", "ds1"], [0, 0, -150]);
  });
  k.step({ title: "Lock the sides with two cams", detail: "Arrow towards the stud, then a turn clockwise.", scene: "drawer", kind: "cams", tools: ["screwdriver"] }, () =>
    k.fit(HWCAM, LR.map((s) => [s * (DW / 2 - 12), DY + 10, fz - 30] as Vec3), (i) => [LR[i], 0, 0], (i) => `ds${i}`),
  );
  k.step({ title: "Slide the bottom into the grooves", scene: "drawer", kind: "join" }, () => k.show(["dbot"], [0, 0, -400]));
  k.step({ title: "Fit the back on its pins and lock it with two cams", detail: "Push in the two pins, put the back on, then turn the cams clockwise.", scene: "drawer", kind: "cams", tools: ["screwdriver"] }, () => {
    k.fit({ kind: "pin", len: 20, dia: 8, name: "Push pin" }, LR.map((s) => [s * (DW / 2 - 6), DY - 15, RZ - 9 - 394] as Vec3), [0, 0, 1], (i) => `ds${i}`, { hole: false });
    k.show(["db"], [0, 150, 0]);
    k.fit(HWCAM, LR.map((s) => [s * (DW / 2 - 12), DY + 10, RZ - 9 - 370] as Vec3), (i) => [LR[i], 0, 0], (i) => `ds${i}`);
  });
  k.step({ title: "Screw the slides onto the drawer sides", detail: "Two screws each.", scene: "drawer", kind: "screws", tools: ["screwdriver"] }, () => {
    k.show(["dsl0", "dsl1"], [0, 0, 0]);
    k.fit({ kind: "screw", len: 12, dia: 3.5 }, LR.flatMap((s) => [-120, 120].map((dz) => [s * (DW / 2 + 6), DY, RZ - 209 + dz] as Vec3)), (i) => [-LR[i >> 1], 0, 0], (i) => `dsl${i >> 1}`);
  });
  k.step({ title: "Screw on the knob", detail: "One screw from inside the drawer front.", scene: "drawer", kind: "screws", tools: ["screwdriver"] }, () =>
    k.fit({ kind: "knob", len: 22, dia: 26 }, [[0, DY, RZ + 10]], [0, 0, -1], "df", { hole: false }),
  );
  k.step({ title: "Slide the drawer in", detail: "Its slides run on the rails under the top. Clip the two stops onto the rails' ends behind it.", kind: "drawer" }, () => {
    k.show(["df", "ds0", "ds1", "db", "dbot", "dsl0", "dsl1"], [0, 0, 420], 0);
    k.fit({ kind: "clip", len: 20, dia: 16, name: "Drawer stop" }, LR.map((s) => [s * 222, TY - 30, -RZ + 20] as Vec3), [0, 0, 1], (i) => `dr${i}`, { hole: false });
  });
  k.step({ title: "Lay the felt mat in the drawer", detail: "Felt side up, pressed flat into the corners.", kind: "drawer" }, () => k.show(["felt"], [0, 200, 0]));
  return true;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const slug = s.slug ?? "";
  if (/bar-stool/.test(slug)) return chair(b, true);
  if (/^rosentorp-chair/.test(slug)) return chair(b, false);
  if (/^rosentorp-stool/.test(slug)) return stool(b);
  if (/swivel/.test(slug)) return swivel(b);
  if (/table-110-155/.test(slug)) return pedestal(b, false);
  if (/table-160-215/.test(slug)) return pedestal(b, true);
  if (/table-155-215/.test(slug)) return rectTable(b);
  if (/desk/.test(slug)) return desk(b);
  return false;
}

const family: Family = { names: ["ROSENTORP"], build };
export default family;
