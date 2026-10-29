import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";

/*
 * HAVSTA, read from IKEA's manuals.
 *
 * Every cabinet frame goes together the same way, lying on its front on a rug: the top, bottom and fixed shelf
 * carry pins that drop into keyholes in the sides and slide down, the back slides in along grooves in the sides,
 * plastic pins lock it and clips hold it to the shelf edges. The plinth is a frame of its own (cam bolts and cam
 * locks, dowels on top, brackets that grip the cabinet, two feet and two glides). Tall cabinets hang on two wall
 * fittings with spacers for the skirting board. Doors hang on clip hinges, sliding doors on rollers. The chests
 * are built standing, on dowels and cam locks with the runners screwed on first; the console table is solid wood
 * on threaded rods and corner brackets.
 */

const T = 18;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// fittings, named the way the manual's drawings show them
const PIN: HwDef = { kind: "camScrew", len: 14, dia: 8, name: "Keyhole pin" };
const LONG_BOLT: HwDef = { kind: "bolt", len: 60, dia: 6 };
const FRAME_SCREW: HwDef = { kind: "screw", len: 40, dia: 4 };
const DOWEL: HwDef = HW.dowel;
const SUPPORT: HwDef = { kind: "pin", len: 16, dia: 5, name: "Shelf support" };
const SOCKET: HwDef = { kind: "stud", len: 12, dia: 10, name: "Pin socket" };
const LOCK_PIN: HwDef = { kind: "stud", len: 20, dia: 6, name: "Locking pin" };
const BACK_CLIP: HwDef = { kind: "clip", len: 20, dia: 12, name: "Back clip" };
const WEDGE: HwDef = { kind: "clip", len: 10, dia: 8, name: "Clip wedge" };
const WALL_FITTING: HwDef = { kind: "bracket", len: 50, dia: 36, name: "Wall fitting" };
const SPACER: HwDef = { kind: "spacer", len: 20, dia: 28 };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 20 };
const COVER: HwDef = { kind: "cap", len: 4, dia: 30, name: "Cover" };
const PLUG: HwDef = HW.plug;
const WALL_SCREW: HwDef = HW.wallScrew;
const L_BRACKET: HwDef = { kind: "bracket", len: 70, dia: 30 };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const STOP: HwDef = { kind: "stud", len: 16, dia: 8, name: "Door stop" };
const CATCH: HwDef = { kind: "angle", len: 30, dia: 24, name: "Door catch" };
const SMALL_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const BUMPER: HwDef = { kind: "glide", len: 2, dia: 10, name: "Bumper" };
const HINGE: HwDef = HW.hinge;
const KNOB: HwDef = HW.knob;
const KNOB_SCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
const ROLLER: HwDef = { kind: "roller", len: 44, dia: 26 };
const GUIDE: HwDef = { kind: "roller", len: 30, dia: 20, name: "Top guide" };
const DOOR_SCREW: HwDef = { kind: "screw", len: 13, dia: 4 };
const POST_SCREW: HwDef = { kind: "screw", len: 50, dia: 5 };
// plinth
const PL_BOLT: HwDef = { kind: "camScrew", len: 24, dia: 6 };
const CAM: HwDef = HW.cam;
const PL_BRACKET: HwDef = { kind: "angle", len: 40, dia: 30, name: "Plinth bracket" };
const FOOT: HwDef = { kind: "foot", len: 30, dia: 32 };
const GLIDE: HwDef = { kind: "glide", len: 10, dia: 22, name: "Glide" };

type Opts = {
  title: string;
  detail?: string;
  tools?: ToolId[];
  pose?: Pose;
  scene?: string;
  kind?: StepKind;
  warnings?: WarnId[];
  people?: 1 | 2;
  repeat?: number;
  check?: "square";
  wall?: boolean;
};
type FitO = { on?: string; mate?: string; hole?: false; twist?: number; travel?: number; gap?: number };

/** Parts by name, steps and fittings by part id, on top of the plan builder. */
class Kit {
  private types = new Map<string, string>();
  private keys = new Map<string, string>();
  constructor(readonly b: PlanBuilder) {}

  part(id: string, name: string, size: Vec3, pos: Vec3, o: { material?: PartMaterial; pieces?: PartPiece[]; shape?: "box" | "cyl"; rot?: Vec3 } = {}) {
    const material = o.material ?? "board";
    const tk = `${name}|${size.map((n) => Math.round(n)).join("x")}|${material}|${o.shape ?? "box"}|${o.pieces ? JSON.stringify(o.pieces) : ""}`;
    let t = this.types.get(tk);
    if (!t) {
      t = this.b.part(name, size, { material, shape: o.shape });
      if (o.pieces) this.b.parts[this.b.parts.length - 1].pieces = o.pieces;
      this.types.set(tk, t);
    }
    this.keys.set(id, this.b.place(t, pos, o.rot ?? [0, 0, 0]));
  }
  has(id: string) {
    return this.keys.has(id);
  }
  k(id: string) {
    const k = this.keys.get(id);
    if (!k) throw new Error("havsta: no part " + id);
    return k;
  }
  pos(id: string): Vec3 {
    return this.b.partItem(this.k(id)).final.pos;
  }
  step(o: Opts, body: () => void = () => {}) {
    this.b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
  }
  add(ids: string[], from: Vec3 | ((id: string) => Vec3 | undefined)) {
    const list = ids.filter((id) => this.has(id));
    if (!list.length) return;
    this.b.stagger(list.length > 3 ? 0.16 : 0.26);
    for (const id of list) this.b.add(this.k(id), typeof from === "function" ? from(id) : from);
    this.b.then(0.12);
  }
  /** Show parts in the current step's scene at their own spot moved by `shift` (and turned by `rot` about their centre). */
  stage(ids: string[], shift: Vec3 = [0, 0, 0], from?: Vec3, rot?: Vec3) {
    const list = ids.filter((id) => this.has(id));
    this.b.stagger(0.18);
    for (const id of list) {
      const f = this.b.partItem(this.k(id)).final;
      this.b.stage(this.k(id), add3(f.pos, shift), rot ?? f.rot, from);
    }
    this.b.then(0.12);
  }
  fit(def: HwDef, pts: Vec3[], dir: Vec3, o: FitO = {}) {
    if (!pts.length) return;
    const list: FitOpts[] = pts.map((at) => ({ at, dir, on: o.on ? this.k(o.on) : undefined, mate: o.mate ? this.k(o.mate) : undefined, hole: o.hole, twist: o.twist, travel: o.travel }));
    this.b.fits(def, list, o.gap ?? Math.min(0.08, 2 / pts.length));
    this.b.then(0.1);
  }
}

/* ---------- what each guide is ---------- */

type Kind = "open" | "doors" | "glass" | "slide" | "low" | "sideboard" | "tv" | "chest" | "console";
interface Guide {
  kind: Kind;
  W: number;
  H: number;
  D: number;
  P: number; // plinth height, 0 without one
  own: boolean; // the plinth is a separate manual, built after the frame and pushed on
  drawers: number;
}

function guideOf(s: ProductSpec): Guide | null {
  const v = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const plinth = /plinth/.test(v);
  const g = (kind: Kind, P: number, own: boolean, drawers = 0): Guide => ({ kind, W, H, D, P, own, drawers });
  if (/console/.test(v)) return g("console", 0, false);
  if (/tv.bench/.test(v)) return g("tv", 110, false);
  if (/chest/.test(v)) {
    const n = Number(/(\d+).drawers/.exec(v)?.[1] ?? 0);
    return n === 3 || n === 6 ? g("chest", 110, false, n) : null;
  }
  if (/sideboard.basic/.test(v)) return g("sideboard", 110, false);
  if (/sideboard/.test(v)) return null; // no manual for the 100 wide sideboard
  if (H < 1000 && /cabinet/.test(v) && !/glass/.test(v)) return g("low", 110, false);
  if (Math.abs(H - (plinth ? 1340 : 1230)) > 30) return null;
  const P = plinth ? 110 : 0;
  if (/shelving/.test(v)) return g("open", P, true);
  if (/glass/.test(v)) return g(W > 1000 ? "slide" : "glass", P, true);
  if (/cabinet/.test(v)) return g("doors", P, true);
  return null;
}

/* ---------- the frame ---------- */

interface Frame {
  W: number;
  Hc: number; // frame height
  Dc: number;
  y0: number; // underside of the frame
  zc: number;
  zb: number; // back face
  zf: number; // front face
  di: number; // depth of the top, bottom and shelves (they stop at the back groove)
  zi: number;
  yTop: number;
  mid?: number; // fixed shelf centre
  inset?: number; // how far the loose shelves (and the fixed one) stay back from the front, for the doors
}

function frameOf(gd: Guide, o: { mid?: number; inset?: number } = {}): Frame {
  const { W, H, D, P } = gd;
  const Dc = P ? D - 20 : D;
  const zc = P ? -10 : 0;
  const Hc = H - P;
  const zb = zc - Dc / 2, zf = zc + Dc / 2;
  const di = Dc - 12;
  return { W, Hc, Dc, y0: P, zc, zb, zf, di, zi: zf - di / 2, yTop: H, mid: o.mid, inset: o.inset };
}

function frameParts(k: Kit, f: Frame, o: { back?: 0 | 1 | 2; post?: boolean } = {}) {
  const { W, Hc, Dc, y0, zc, zb, di, zi } = f;
  k.part("L", "Side panel", [T, Hc, Dc], [-W / 2 + T / 2, y0 + Hc / 2, zc]);
  k.part("R", "Side panel", [T, Hc, Dc], [W / 2 - T / 2, y0 + Hc / 2, zc]);
  k.part("TOP", "Top panel", [W - 2 * T, T, di], [0, y0 + Hc - T / 2, zi]);
  k.part("BOT", "Bottom panel", [W - 2 * T, T, di], [0, y0 + T / 2, zi]);
  if (f.mid) {
    const dm = di - (f.inset ?? 0);
    k.part("MID", "Fixed shelf", [W - 2 * T, T, dm], [0, f.mid, zi - (f.inset ?? 0) / 2]);
  }
  if (o.post) k.part("POST", "Middle post", [60, Hc - 2 * T, T], [0, y0 + Hc / 2, zb + 12 + T / 2]);
  if (o.back === 1) k.part("BK", "Back panel", [W - 2 * T + 16, Hc - 8, 4], [0, y0 + Hc / 2, zb + 10], { material: "fiber" });
  if (o.back === 2) {
    const w = W / 2 - T + 8;
    k.part("BK", "Back panel", [w, Hc - 8, 4], [-w / 2, y0 + Hc / 2, zb + 10], { material: "fiber" });
    k.part("BK2", "Back panel", [w, Hc - 8, 4], [w / 2, y0 + Hc / 2, zb + 10], { material: "fiber" });
  }
}

const xIn = (f: Frame) => f.W / 2 - T; // inside face of a side

/** Frame steps for the tall cabinets and the low ones: on its front on a rug, panels hooked onto the keyholes. */
function frameSteps(k: Kit, f: Frame, o: { tall: boolean; back: 0 | 1 | 2; clips: number; locks: number; post?: boolean }) {
  const up: Vec3 = [0, 0, -260]; // towards the ceiling while it lies on its front
  k.step(
    {
      title: "Hang the top on one side",
      detail: "Stand the side on its front edge on a rug, holes facing in. Fit the pins on the top into the keyholes and slide it down until it stops.",
      pose: "-z",
      warnings: ["floor"],
      kind: "join",
    },
    () => {
      k.add(["L"], [-220, 0, 0]);
      k.add(["TOP"], [0, 0, -200]);
    },
  );
  const next = f.mid ? ["MID", "BOT"] : ["BOT"];
  k.step({ title: f.mid ? "Hang the fixed shelf and the bottom on it" : "Hang the bottom on it", detail: "Same way: pins into the keyholes, then push each panel down until it sits tight against the side.", pose: "-z", kind: "join" }, () =>
    k.add(next, [0, 0, -200]),
  );
  k.step({ title: "Lower the other side onto the pins", detail: "Guide every pin into its keyhole at once, then press the side down evenly.", pose: "-z", kind: "join", people: o.tall ? 2 : 1 }, () => k.add(["R"], [220, 0, 0]));
  if (o.post) {
    const p = k.pos("POST");
    k.step({ title: "Tap the dowels into the middle post", detail: "Two dowels go into its top end. The other end stays plain.", tools: ["hammer"], scene: "prep", kind: "dowels" }, () => {
      k.stage(["POST"], [0, 0, 0], [0, 160, 0]);
      k.fit(DOWEL, [-15, 15].map((dx): Vec3 => [dx, f.y0 + f.Hc - T, p[2]]), [0, 1, 0], { on: "POST", mate: "TOP" });
    });
    k.step({ title: "Fit the middle post and screw it to the bottom", detail: "Push its dowels into the top at the back, then one long screw through the bottom into its end.", tools: ["screwdriver"], pose: "-z", kind: "screws" }, () => {
      k.add(["POST"], up);
      k.fit(POST_SCREW, [[0, f.y0, p[2]]], [0, 1, 0], { on: "BOT", mate: "POST" });
    });
  }
  backSteps(k, f, o);
}

function backSteps(k: Kit, f: Frame, o: { back: 0 | 1 | 2; clips: number; locks: number }) {
  if (o.back) {
    const backs = o.back === 2 ? ["BK", "BK2"] : ["BK"];
    k.step(
      {
        title: o.back === 2 ? "Slide in the two back panels" : "Slide in the back panel",
        detail: "Turn it onto one side. The back runs in the grooves of both sides, past the top, until it meets the bottom.",
        pose: "+x",
        kind: "join",
      },
      () => k.add(backs, [0, f.Hc + 200, 0]),
    );
    const xs = spread(-f.W / 2 + 120, f.W / 2 - 120, o.locks);
    k.step({ title: "Lock the back in with the plastic pins", detail: "Push a socket into each hole along the top end, just behind the back, then tap a pin into each socket.", pose: "+x", kind: "general" }, () => {
      const pts = xs.map((x): Vec3 => [x, f.yTop - T / 2, f.zb + 12]);
      k.fit(SOCKET, pts, [0, 0, 1], { on: "TOP" });
      k.fit(LOCK_PIN, pts.map((p): Vec3 => [p[0], p[1], p[2] - 4]), [0, 0, 1], { on: "TOP" });
    });
    const rows: { y: number; on: string }[] = [
      { y: f.y0 + f.Hc - T / 2, on: "TOP" },
      ...(f.mid ? [{ y: f.mid, on: "MID" }] : []),
      { y: f.y0 + T / 2, on: "BOT" },
    ];
    const per = Math.max(1, Math.round(o.clips / rows.length));
    const pts: { at: Vec3; on: string }[] = [];
    rows.forEach((r, i) => {
      const n = i === rows.length - 1 ? o.clips - per * (rows.length - 1) : per;
      for (const x of spread(-f.W / 2 + 100, f.W / 2 - 100, n)) pts.push({ at: [x, r.y, f.zb + 8], on: r.on });
    });
    k.step(
      { title: "Clip the back to the panels", detail: "Push each clip through the back into the hole in the panel edge, then press a wedge into it to lock it.", pose: "-z", kind: "general" },
      () => {
        for (const r of rows) k.fit(BACK_CLIP, pts.filter((p) => p.on === r.on).map((p) => p.at), [0, 0, 1], { on: r.on, gap: 0.05 });
        for (const r of rows) k.fit(WEDGE, pts.filter((p) => p.on === r.on).map((p) => [p.at[0], p.at[1], p.at[2] - 6] as Vec3), [0, 0, 1], { on: r.on, gap: 0.05 });
      },
    );
  }
}

/* ---------- the plinth ---------- */

function plinthParts(k: Kit, gd: Guide, f: Frame) {
  const { W, D, P } = gd;
  const zF = D / 2 - T / 2, zB = -D / 2 + T / 2;
  k.part("PF", "Plinth front", [W, P, T], [0, P / 2, zF]);
  k.part("PB", "Plinth back", [W - 2 * T, P, T], [0, P / 2, zB]);
  k.part("PL", "Plinth end", [T, P, D - T], [-W / 2 + T / 2, P / 2, -T / 2]);
  k.part("PR", "Plinth end", [T, P, D - T], [W / 2 - T / 2, P / 2, -T / 2]);
  void f;
}

/** The plinth's own manual: dowels and cam bolts in the ends, brackets on top, front and back rail on cam locks, feet and glides underneath, dowels on top. */
function plinthSteps(k: Kit, gd: Guide, f: Frame, o: { brackets: number; feet: number; joinFirst?: boolean; joinPose?: Pose }) {
  const { W, D, P } = gd;
  const zF = D / 2 - T, zB = -D / 2 + T;
  const ends = ["PL", "PR"];
  const xE = (g: number) => g * (W / 2 - T / 2);
  const sc = "plinth";
  const flat = (id: string): Vec3 => (id === "PL" ? [-60, 0, 0] : id === "PR" ? [60, 0, 0] : id === "PF" ? [0, 0, 120] : [0, 0, -120]);
  k.step({ title: "Tap the dowels into the plinth ends", detail: "Lay the four plinth pieces out on a rug. Two dowels go into the front end of each end piece.", tools: ["hammer"], scene: sc, warnings: ["floor"], kind: "dowels" }, () => {
    for (const id of ["PF", "PB", ...ends]) k.stage([id], flat(id), [0, 140, 0]);
    for (const [i, id] of ends.entries()) k.fit(DOWEL, [P * 0.3, P * 0.7].map((y): Vec3 => [xE(i ? 1 : -1), y, zF]), [0, 0, 1], { on: id, mate: "PF" });
  });
  k.step({ title: "Screw the cam bolts into the ends", detail: "Four in each end piece, two at each end. Screw them in by hand until they stop.", tools: ["screwdriver"], scene: sc, kind: "cams" }, () => {
    for (const [i, id] of ends.entries()) {
      const x = xE(i ? 1 : -1);
      k.fit(PL_BOLT, [P * 0.25, P * 0.75].flatMap((y): Vec3[] => [[x, y, zF], [x, y, zB]]), [0, 0, 1], { on: id, gap: 0.05 });
    }
  });
  // brackets on the top edges: one near the back of each end, the rest along the back rail
  const bx: Vec3[] = [
    [-(W / 2 - T / 2), P, zB + 60],
    [W / 2 - T / 2, P, zB + 60],
    ...spread(-W / 2 + 160, W / 2 - 160, Math.max(0, o.brackets - 2)).map((x): Vec3 => [x, P - 20 + 20, zB - T / 2]),
  ];
  const onOf = (p: Vec3) => (Math.abs(p[0]) > W / 2 - T - 1 ? (p[0] < 0 ? "PL" : "PR") : "PB");
  k.step({ title: "Fit the brackets to the top edges", detail: "Each bracket sits on its holes with the upright leg facing in. Push a socket through each bracket into the plinth.", scene: sc, kind: "general" }, () => {
    for (const p of bx) k.fit(PL_BRACKET, [p], [0, -1, 0], { on: onOf(p), hole: false, gap: 0.1 });
    for (const p of bx) k.fit(SOCKET, [[p[0], p[1], p[2]]], [0, -1, 0], { on: onOf(p), gap: 0.08 });
  });
  k.step({ title: "Lock the brackets with the pins", detail: "Tap a pin into each socket until its head sits flat.", scene: sc, kind: "general" }, () => {
    for (const p of bx) k.fit(LOCK_PIN, [[p[0], p[1] + 2, p[2]]], [0, -1, 0], { on: onOf(p), gap: 0.08 });
  });
  k.step({ title: "Join the ends to the front", detail: "Push both ends onto the front piece's dowels and cam bolts.", scene: sc, kind: "join" }, () => {
    k.stage(["PF"], [0, 0, 0]);
    k.stage(ends, [0, 0, 0], [0, 0, -160]);
  });
  const camsIn = (id: string, z: number, dz: number) => [-1, 1].flatMap((g) => [P * 0.25, P * 0.75].map((y): Vec3 => [g * (W / 2 - T - 30), y, z + dz]));
  k.step({ title: "Turn the cam locks in the front", detail: "Arrow towards the bolt, then turn each one clockwise until it pulls tight.", tools: ["screwdriver"], scene: sc, kind: "cams" }, () =>
    k.fit(CAM, camsIn("PF", zF, 0), [0, 0, -1], { on: "PF" }),
  );
  k.step({ title: "Fit the back piece and lock it", detail: "Onto the cam bolts at the back of the ends, then four more cam locks.", tools: ["screwdriver"], scene: sc, kind: "cams" }, () => {
    k.stage(["PB"], [0, 0, 0], [0, 0, -160]);
    k.fit(CAM, camsIn("PB", zB, 0), [0, 0, 1], { on: "PB" });
  });
  const after = o.joinFirst ? { scene: "main", pose: o.joinPose ?? "+z" } : { scene: sc, pose: "-y" as Pose };
  const feet = () =>
    k.step({ title: o.feet > 2 ? `Screw in the ${o.feet} adjustable feet` : "Screw in the two adjustable feet", detail: "They go in at the front corners of the plinth, from underneath. Turn them in all the way, you level it later.", ...after, kind: "legs" }, () => {
      k.fit(FOOT, [[-(W / 2 - T / 2), 0, zF - 40]], [0, 1, 0], { on: "PL" });
      k.fit(FOOT, [[W / 2 - T / 2, 0, zF - 40]], [0, 1, 0], { on: "PR" });
      if (o.feet > 2) k.fit(FOOT, [[0, 0, zF + T / 2]], [0, 1, 0], { on: "PF" });
    });
  const glides = () =>
    k.step({ title: o.joinFirst ? "Press in the glides" : "Turn it over and press in the glides", detail: "Two glides under the back piece of the plinth, near its ends.", ...after, kind: "general" }, () =>
      k.fit(GLIDE, [-1, 1].map((g): Vec3 => [g * (W / 2 - 120), 0, zB - T / 2]), [0, 1, 0], { on: "PB", hole: false }),
    );
  if (!o.joinFirst) {
    glides();
    feet();
  }
  k.step({ title: o.joinFirst ? "Tap the dowels into the top edges" : "Turn it back over and tap in the dowels", detail: "Four dowels in the top edges. They locate the cabinet on the plinth.", tools: ["hammer"], scene: sc, pose: "+y", kind: "dowels" }, () =>
    k.fit(DOWEL, [-1, 1].flatMap((g) => [zF - 40, zB + 40].map((z): Vec3 => [g * (W / 2 - T / 2), P, z])), [0, 1, 0], { on: "PL", gap: 0.08 }),
  );
  return { glides, feet, bx, onOf };
}

/** The plinth pushed onto the frame's bottom while it lies on its front, then the brackets fixed to the frame. */
function plinthJoin(k: Kit, gd: Guide, f: Frame, bx: Vec3[], tall: boolean, pose: Pose = "-z") {
  const how = pose === "-z" ? "With the frame on its front" : pose === "+z" ? "With it lying on its back" : "With it upside down";
  k.step({ title: pose === "-y" ? "Lower the plinth onto the bottom" : "Push the plinth onto the bottom", detail: `${how}, fit the plinth onto the bottom so the dowels find their holes.`, pose, people: tall ? 2 : 1, kind: "join" }, () =>
    k.add(["PF", "PB", "PL", "PR"], [0, -320, 0]),
  );
  k.step({ title: "Fix the brackets to the frame", detail: "Push a socket through each bracket's upright leg into the frame, then a pin into each socket.", pose, kind: "general" }, () => {
    const pts = bx.map((p) => {
      const end = Math.abs(p[0]) > gd.W / 2 - T - 1;
      const g = Math.sign(p[0]);
      return end
        ? { at: [g * xIn(f), gd.P + 9, p[2]] as Vec3, dir: [g, 0, 0] as Vec3, on: g < 0 ? "L" : "R" }
        : { at: [p[0], gd.P + 9, f.zb + 12] as Vec3, dir: [0, 0, 1] as Vec3, on: "BOT" };
    });
    for (const p of pts) k.fit(SOCKET, [p.at], p.dir, { on: p.on, gap: 0.08 });
    for (const p of pts) k.fit(LOCK_PIN, [p.at], p.dir, { on: p.on, gap: 0.08 });
  });
}

/* ---------- wall fixing ---------- */

/** Tall cabinets: two wall fittings in the top corners, spacers turned out to the wall, screws through them, covers on. */
function wallFittingSteps(k: Kit, f: Frame, o: { plinth: boolean; feet: number }) {
  const y = f.yTop - 60;
  const pts = [-1, 1].map((g): Vec3 => [g * xIn(f), y, f.zb + 40]);
  k.step({ title: "Push the wall fittings into the top corners", detail: "One inside each side, at the back, pins into the holes.", kind: "anchor" }, () => {
    k.fit(WALL_FITTING, [pts[0]], [-1, 0, 0], { on: "L", hole: false });
    k.fit(WALL_FITTING, [pts[1]], [1, 0, 0], { on: "R", hole: false });
  });
  k.step({ title: "Screw a spacer onto each fitting", detail: "Turn it on by hand, don't force it.", kind: "anchor" }, () =>
    k.fit(SPACER, pts.map((p): Vec3 => [p[0] - Math.sign(p[0]) * 20, y, f.zb]), [0, 0, 1], { on: "TOP", hole: false }),
  );
  k.step(
    {
      title: "Stand it in place and set the spacers",
      detail: "Push it to the wall and turn both spacers out until they touch it, so it stands straight over the skirting board.",
      kind: "anchor",
      warnings: ["wall", "tip"],
    },
  );
  if (o.plinth)
    k.step({ title: "Level it with the feet", detail: `Turn the ${o.feet > 2 ? "front feet" : "two front feet"} with the spanner, through the plinth, until it stands level.`, tools: ["wrench", "level"], kind: "legs" });
  k.step(
    {
      title: "Screw it to the wall",
      detail: "Through both fittings, with a washer on each screw, then click the covers on. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["drill", "screwdriver", "pencil"],
      kind: "anchor",
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      const w = pts.map((p): Vec3 => [p[0] - Math.sign(p[0]) * 20, y, f.zb - 6]);
      k.fit(PLUG, w.map((p): Vec3 => [p[0], p[1], p[2] - 10]), [0, 0, -1]);
      k.fit(WASHER, w.map((p): Vec3 => [p[0], p[1], p[2] + 36]), [0, 0, -1], { on: "TOP", hole: false });
      k.fit(WALL_SCREW, w.map((p): Vec3 => [p[0], p[1], p[2] + 38]), [0, 0, -1]);
      k.fit(COVER, w.map((p): Vec3 => [p[0], p[1], p[2] + 40]), [0, 0, -1], { on: "TOP", hole: false });
    },
  );
}

/* ---------- shelves and doors ---------- */

const shelfFront = (f: Frame) => f.zf - (f.inset ?? 4);
const shelfDepth = (f: Frame) => shelfFront(f) - (f.zb + 32);

function shelfParts(k: Kit, f: Frame, ys: number[], lip = false) {
  const w = f.W - 2 * T - 4, d = shelfDepth(f), z1 = shelfFront(f);
  ys.forEach((y, i) => {
    k.part(`S${i}`, "Shelf", [w, T, d], [0, y, z1 - d / 2]);
    if (lip) k.part(`SL${i}`, "Shelf edge", [w, 40, 16], [0, y + T / 2 + 20, z1 - d + 8]);
  });
}

function shelfSteps(k: Kit, f: Frame, ys: number[], o: { middle?: boolean } = {}) {
  const zs = shelfFront(f) - shelfDepth(f);
  const per = o.middle ? 5 : 4;
  k.step({ title: `Push in the ${ys.length * per} shelf supports`, detail: "At the heights you want, the same hole on each side so the shelves sit level.", kind: "shelves" }, () => {
    for (const y of ys) {
      const yy = y - T / 2;
      k.fit(SUPPORT, [zs + 40, shelfFront(f) - 40].map((z): Vec3 => [-xIn(f), yy, z]), [1, 0, 0], { on: "L", gap: 0.05 });
      k.fit(SUPPORT, [zs + 40, shelfFront(f) - 40].map((z): Vec3 => [xIn(f), yy, z]), [-1, 0, 0], { on: "R", gap: 0.05 });
      if (o.middle) k.fit(SUPPORT, [[0, yy, f.zb + 30]], [0, 0, -1], { on: "POST", gap: 0.05 });
    }
  });
  k.step({ title: ys.length > 1 ? `Lay in the ${ys.length} shelves` : "Lay in the shelf", detail: ys.length > 1 ? "Tilt each one in and lower it onto its supports." : "Tilt it in and lower it onto its supports.", kind: "shelves" }, () =>
    k.add(ys.flatMap((_, i) => [`S${i}`, `SL${i}`]), [0, 0, 300]),
  );
}

type Door = { id: string; x: number; y: number; w: number; h: number; z: number; hinge: -1 | 1 };

/** A frame-and-panel door, or a glass one, as one part built from its pieces. */
function doorPieces(w: number, h: number, glass: "" | "bar" | "cross" | "plain"): PartPiece[] {
  const s = 60, rr = 70, t = 20;
  const out: PartPiece[] = [
    { shape: "box", size: [s, h, t], pos: [-w / 2 + s / 2, 0, 0] },
    { shape: "box", size: [s, h, t], pos: [w / 2 - s / 2, 0, 0] },
    { shape: "box", size: [w - 2 * s, rr, t], pos: [0, h / 2 - rr / 2, 0] },
    { shape: "box", size: [w - 2 * s, rr, t], pos: [0, -h / 2 + rr / 2, 0] },
  ];
  if (!glass) out.push({ shape: "box", size: [w - 2 * s, h - 2 * rr, 12], pos: [0, 0, -3] });
  else {
    out.push({ shape: "box", size: [w - 2 * s, h - 2 * rr, 4], pos: [0, 0, 0], material: "glass" });
    if (glass === "bar" || glass === "cross") out.push({ shape: "box", size: [w - 2 * s, 30, t - 4], pos: [0, 0, 0] });
    if (glass === "cross") out.push({ shape: "box", size: [30, h - 2 * rr, t - 4], pos: [0, 0, 0] });
  }
  return out;
}

function hingedDoors(k: Kit, f: Frame, y0: number, y1: number, glass: boolean): Door[] {
  const gap = 3;
  const w = (f.W - 2 * T - 3 * gap) / 2, h = y1 - y0 - 2 * gap;
  const z = f.zf - 10;
  const doors: Door[] = [-1, 1].map((g) => ({ id: g < 0 ? "DL" : "DR", x: (g * (w + gap)) / 2, y: (y0 + y1) / 2, w, h, z, hinge: g as -1 | 1 }));
  for (const d of doors) k.part(d.id, glass ? "Glass door" : "Door", [d.w, d.h, 20], [d.x, d.y, d.z], { pieces: doorPieces(d.w, d.h, glass ? "bar" : "") });
  return doors;
}

function hingeSteps(k: Kit, f: Frame, doors: Door[]) {
  const hy = (d: Door) => [d.y + d.h / 2 - 110, d.y - d.h / 2 + 110];
  const hx = (d: Door) => d.x + d.hinge * (d.w / 2 - 22);
  doors.forEach((d, i) =>
    k.step(
      {
        title: `Screw two hinges onto the ${d.hinge < 0 ? "left" : "right"} door`,
        detail: i ? "The other pair of hinges, mirrored. Check the marking before you screw." : "Lay the doors face down on a rug. The hinge cups sit in the round holes; tighten both screws on each.",
        tools: ["screwdriver"],
        scene: "doors",
        warnings: ["face"],
        kind: "hinges",
      },
      () => {
        if (!i) for (const dd of doors) k.stage([dd.id], [dd.hinge * 120, -dd.y + 30, 300], [0, 120, 0], [Math.PI / 2, 0, 0]);
        k.fit(HINGE, hy(d).map((y): Vec3 => [hx(d), y, d.z - 10]), [0, 0, 1], { on: d.id, twist: d.hinge > 0 ? Math.PI : 0, gap: 0.2 });
      },
    ),
  );
  k.step(
    { title: "Hang the doors", detail: "Clip each hinge onto its plate inside the side, then tighten the screws. Turn the hinge screws to even out the gaps.", tools: ["screwdriver"], kind: "doors" },
    () => k.add(doors.map((d) => d.id), [0, 0, 340]),
  );
}

function knobStep(k: Kit, doors: Door[], ky?: number) {
  k.step({ title: "Screw on the knobs", detail: "Hold each knob on the front and turn the screw in from inside the door.", tools: ["screwdriver"], kind: "screws" }, () => {
    const pts = doors.map((d): { at: Vec3; id: string } => ({ id: d.id, at: [d.x - d.hinge * (d.w / 2 - 35), ky ?? d.y, d.z] }));
    for (const p of pts) k.fit(KNOB_SCREW, [[p.at[0], p.at[1], p.at[2] - 10]], [0, 0, 1], { on: p.id });
    for (const p of pts) k.fit(KNOB, [[p.at[0], p.at[1], p.at[2] + 10]], [0, 0, -1], { on: p.id, hole: false });
  });
}

/** Stops for hinged doors: two pins in the bottom, two catch plates under the top, a bumper sheet. */
function stopSteps(k: Kit, f: Frame, yTopIn: number, yBotIn: number) {
  k.step({ title: "Screw in the door stops", detail: "Into the two holes at the front of the bottom, by hand.", tools: ["screwdriver"], kind: "screws" }, () =>
    k.fit(STOP, [-30, 30].map((x): Vec3 => [x, yBotIn, f.zf - 40]), [0, -1, 0], { on: "BOT" }),
  );
  k.step({ title: "Screw the door catches under the top", detail: "One screw each, in the middle at the front.", tools: ["screwdriver"], kind: "screws" }, () => {
    const pts = [-30, 30].map((x): Vec3 => [x, yTopIn, f.zf - 30]);
    k.fit(CATCH, pts, [0, 1, 0], { on: "TOP", hole: false });
    k.fit(SMALL_SCREW, pts.map((p): Vec3 => [p[0], p[1] - 2, p[2]]), [0, 1, 0], { on: "TOP" });
  });
  k.step({ title: "Stick on the bumpers", detail: "Peel the two bumpers off the sheet and press them on under the top, next to the catches.", kind: "general" }, () =>
    k.fit(BUMPER, [-70, 70].map((x): Vec3 => [x, yTopIn, f.zf - 15]), [0, 1, 0], { on: "TOP", hole: false }),
  );
}

/* ---------- sliding doors ---------- */

function slidingDoors(k: Kit, f: Frame, y0: number, y1: number, glass: "" | "cross" | "plain"): Door[] {
  const ov = 40;
  const w = (f.W - 2 * T) / 2 + ov / 2, h = y1 - y0 - 8;
  const back: Door = { id: "DB", x: -(f.W - 2 * T) / 4 - ov / 4, y: (y0 + y1) / 2, w, h, z: f.zf - 46, hinge: -1 };
  const front: Door = { id: "DF", x: (f.W - 2 * T) / 4 + ov / 4, y: (y0 + y1) / 2, w, h, z: f.zf - 14, hinge: 1 };
  for (const d of [back, front]) k.part(d.id, glass ? "Glass door" : "Sliding door", [d.w, d.h, 20], [d.x, d.y, d.z], { pieces: doorPieces(d.w, d.h, glass) });
  return [back, front];
}

function slidingSteps(k: Kit, f: Frame, doors: Door[], o: { stopsOn: string; knobY?: number; only?: "hang" | "finish" }) {
  const bx = (d: Door) => [d.x - d.w / 2 + 70, d.x + d.w / 2 - 70];
  if (o.only !== "finish") hangSliding(k, doors, bx);
  if (o.only === "hang") return;
  finishSliding(k, f, doors, o);
}

function hangSliding(k: Kit, doors: Door[], bx: (d: Door) => number[]) {
  k.step({ title: "Screw the rollers under the doors", detail: "Lay both doors on a rug. Two rollers at the bottom of each door, two screws in each roller.", tools: ["screwdriver"], scene: "doors", warnings: ["floor"], kind: "screws" }, () => {
    for (const d of doors) k.stage([d.id], [0, 0, d.id === "DB" ? -200 : 200]);
    for (const d of doors) {
      const yb = d.y - d.h / 2;
      k.fit(ROLLER, bx(d).map((x): Vec3 => [x, yb, d.z]), [0, 1, 0], { on: d.id, hole: false, gap: 0.12 });
      k.fit(DOOR_SCREW, bx(d).flatMap((x): Vec3[] => [[x - 15, yb, d.z], [x + 15, yb, d.z]]), [0, 1, 0], { on: d.id, gap: 0.05 });
    }
  });
  k.step({ title: "Screw the guides on top of the doors", detail: "Two guides on top of each door, two screws in each.", tools: ["screwdriver"], scene: "doors", kind: "screws" }, () => {
    for (const d of doors) {
      const yt = d.y + d.h / 2;
      k.fit(GUIDE, bx(d).map((x): Vec3 => [x, yt, d.z]), [0, -1, 0], { on: d.id, hole: false, gap: 0.12 });
      k.fit(DOOR_SCREW, bx(d).flatMap((x): Vec3[] => [[x - 15, yt, d.z], [x + 15, yt, d.z]]), [0, -1, 0], { on: d.id, gap: 0.05 });
    }
  });
  const hang = (d: Door, first: boolean) => {
    k.step({ title: first ? "Hang the back door" : "Hang the front door", detail: first ? "Tilt it in, guides into the back track at the top, then lower its rollers onto the back rail." : "Same way, in the front track.", kind: "doors" }, () =>
      k.add([d.id], [0, 0, 300]),
    );
    k.step({ title: "Lock its rollers", detail: "Push each roller's catch up until it clicks, so the door can't jump off the rail.", kind: "doors" });
  };
  hang(doors[0], true);
  hang(doors[1], false);
}

function finishSliding(k: Kit, f: Frame, doors: Door[], o: { stopsOn: string; knobY?: number }) {
  k.step({ title: "Screw in the door stops", detail: "Two stops in the bottom, in the middle, so the doors close at the right place. Two screws each.", tools: ["screwdriver"], kind: "screws" }, () => {
    const pts = [-60, 60].map((x): Vec3 => [x, k.pos(o.stopsOn)[1] + T / 2, f.zf - 60]);
    k.fit(STOP, pts, [0, -1, 0], { on: o.stopsOn, hole: false });
    k.fit(DOOR_SCREW, pts.flatMap((p): Vec3[] => [[p[0] - 12, p[1], p[2]], [p[0] + 12, p[1], p[2]]]), [0, -1, 0], { on: o.stopsOn, gap: 0.05 });
  });
  knobStep(k, doors.map((d) => ({ ...d, hinge: (d.id === "DB" ? 1 : -1) as -1 | 1 })), o.knobY);
}

/* ---------- the tall units ---------- */

function buildTall(k: Kit, gd: Guide) {
  const fr0 = frameOf(gd);
  const kind = gd.kind;
  const mid = kind === "slide" ? undefined : fr0.y0 + fr0.Hc / 2;
  const f = frameOf(gd, { mid, inset: kind === "open" ? 4 : kind === "slide" ? 62 : 24 });
  const back: 0 | 1 | 2 = kind === "open" ? 0 : kind === "slide" ? 2 : 1;
  frameParts(k, f, { back, post: kind === "slide" });
  const yIn0 = f.y0 + T, yIn1 = f.yTop - T, hIn = yIn1 - yIn0;
  const ys =
    kind === "open"
      ? [yIn0 + hIn * 0.26, yIn0 + hIn * 0.76]
      : kind === "slide"
        ? [yIn0 + hIn * 0.27, yIn0 + hIn * 0.51, yIn0 + hIn * 0.75]
        : [yIn0 + hIn * 0.26, yIn0 + hIn * 0.68, yIn0 + hIn * 0.84];
  shelfParts(k, f, ys, kind === "open");
  if (gd.P) plinthParts(k, gd, f);
  let doors: Door[] = [];
  if (kind === "doors" || kind === "glass") doors = hingedDoors(k, f, yIn0, yIn1, kind === "glass");
  if (kind === "slide") doors = slidingDoors(k, f, yIn0, yIn1, "cross");

  if (kind === "open") openFrameSteps(k, f);
  else frameSteps(k, f, { tall: true, back, clips: kind === "slide" ? 16 : 9, locks: kind === "slide" ? 6 : 4, post: kind === "slide" });

  if (gd.P) {
    const pl = plinthSteps(k, gd, f, { brackets: gd.W > 1000 ? 5 : 4, feet: 2 });
    plinthJoin(k, gd, f, pl.bx, true);
  }
  k.step({ title: "Stand it up together", detail: "Lift it upright with someone else, don't pull it up by one corner.", pose: "+y", people: 2, kind: "standup" });

  if (kind === "open") {
    if (gd.P) k.step({ title: "Level it with the feet", detail: "Turn the two front feet with the spanner, through the plinth, until it stands level.", tools: ["wrench", "level"], kind: "legs" });
    openWallStep(k, f);
    lipSteps(k, f, ys.length);
    shelfSteps(k, f, ys);
    return;
  }
  wallFittingSteps(k, f, { plinth: !!gd.P, feet: 2 });
  if (kind === "slide") {
    shelfSteps(k, f, ys, { middle: true });
    slidingSteps(k, f, doors, { stopsOn: "BOT" });
    return;
  }
  stopSteps(k, f, yIn1, yIn0);
  shelfSteps(k, f, ys);
  hingeSteps(k, f, doors);
  knobStep(k, doors);
}

/** The open shelving unit has no back: pins in the sides, the panels hooked on, long bolts and screws hold it square. */
function openFrameSteps(k: Kit, f: Frame) {
  const zp = f.zb + 40;
  const pinPts = (g: number): Vec3[] => [f.mid!, f.y0 + T / 2].map((y): Vec3 => [g * xIn(f), y, zp]);
  k.step({ title: "Screw the pins into both sides", detail: "Lay the sides on a rug, holes up. Two pins in each, screwed in by hand until they stop.", tools: ["screwdriver"], scene: "prep", warnings: ["floor"], kind: "cams" }, () => {
    k.stage(["L"], [f.W / 2 - T / 2, -f.Hc / 2 - f.y0 + T / 2, -250], [0, 160, 0], [0, 0, Math.PI / 2]);
    k.stage(["R"], [-f.W / 2 + T / 2, -f.Hc / 2 - f.y0 + T / 2, 250], [0, 160, 0], [0, 0, -Math.PI / 2]);
    k.fit(PIN, pinPts(-1), [1, 0, 0], { on: "L" });
    k.fit(PIN, pinPts(1), [-1, 0, 0], { on: "R" });
  });
  k.step({ title: "Hang the top on one side", detail: "Stand the side on its front edge on the rug. Pins into the keyholes, then slide the top down until it stops.", pose: "-z", warnings: ["floor"], kind: "join" }, () => {
    k.add(["L"], [-220, 0, 0]);
    k.add(["TOP"], [0, 0, -200]);
  });
  k.step({ title: "Hang the fixed shelf on it", detail: "In the middle, the same way.", pose: "-z", kind: "join" }, () => k.add(["MID"], [0, 0, -200]));
  k.step({ title: "Lower the other side onto them", detail: "Guide the pins into the keyholes and press it down evenly.", pose: "-z", people: 2, kind: "join" }, () => k.add(["R"], [220, 0, 0]));
  k.step({ title: "Slide in the bottom", detail: "Onto the pins in both sides, then push it down until it stops.", pose: "-z", kind: "join" }, () => k.add(["BOT"], [0, 0, -200]));
  k.step({ title: "Turn the long bolts into the fixed shelf", detail: "One at each end, through the back edge, with the bent key.", tools: ["allen"], pose: "-z", kind: "bolts" }, () =>
    k.fit(LONG_BOLT, [-1, 1].map((g): Vec3 => [g * (xIn(f) - 30), f.mid!, f.zb + 12]), [0, 0, 1], { on: "MID" }),
  );
  k.step({ title: "Tighten the four pins", detail: "Through the holes next to them, until the panels pull tight against the sides.", tools: ["screwdriver"], pose: "-z", kind: "cams" });
  k.step({ title: "Screw the sides to the top and bottom", detail: "One screw through each side into each end of the top and the bottom.", tools: ["screwdriver"], pose: "-z", kind: "screws" }, () => {
    for (const [g, id] of [[-1, "L"], [1, "R"]] as const)
      k.fit(FRAME_SCREW, [f.yTop - T / 2, f.y0 + T / 2].map((y): Vec3 => [g * (f.W / 2), y, f.zc + 20]), [-g, 0, 0], { on: id, mate: "TOP" });
  });
}

function openWallStep(k: Kit, f: Frame) {
  const y = f.yTop - T;
  const pts = [-1, 1].map((g): Vec3 => [g * (xIn(f) - 70), y, f.zb + 20]);
  k.step(
    {
      title: "Fix it to the wall",
      detail: "Screw a bracket under the top at each back corner, then screw through it into the wall with a washer. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["screwdriver", "drill", "pencil"],
      kind: "anchor",
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      k.fit(L_BRACKET, pts, [0, 1, 0], { on: "TOP", hole: false, travel: 60 });
      k.fit(BRACKET_SCREW, pts.map((p): Vec3 => [p[0], p[1], p[2] + 12]), [0, 1, 0], { on: "TOP" });
      k.fit(PLUG, pts.map((p): Vec3 => [p[0], p[1] - 30, f.zb - 10]), [0, 0, -1]);
      k.fit(WASHER, pts.map((p): Vec3 => [p[0], p[1] - 30, f.zb + 4]), [0, 0, -1], { on: "TOP", hole: false });
      k.fit(WALL_SCREW, pts.map((p): Vec3 => [p[0], p[1] - 30, f.zb + 6]), [0, 0, -1]);
    },
  );
}

/** Each loose shelf gets a raised edge at the back: two dowels, then two screws up through the shelf. */
function lipSteps(k: Kit, f: Frame, n: number) {
  const w = f.W - 2 * T - 4;
  k.step({ title: "Tap the dowels into the shelf edges", detail: "Two in the long edge of each strip.", tools: ["hammer"], scene: "shelf", kind: "dowels" }, () => {
    for (let i = 0; i < n; i++) {
      k.stage([`S${i}`, `SL${i}`], [0, -k.pos(`S${i}`)[1] + 20 + i * 0, i * 420 - 200]);
      const p = k.pos(`SL${i}`);
      k.fit(DOWEL, [-w / 3, w / 3].map((x): Vec3 => [x, p[1] - 20, p[2]]), [0, -1, 0], { on: `SL${i}`, mate: `S${i}` });
    }
  });
  k.step({ title: "Screw the edges onto the shelves", detail: "Press each strip onto its shelf's back edge, then two screws up through the shelf into it.", tools: ["screwdriver"], scene: "shelf", kind: "screws" }, () => {
    for (let i = 0; i < n; i++) {
      const p = k.pos(`SL${i}`), s = k.pos(`S${i}`);
      k.fit(FRAME_SCREW, [-w / 4, w / 4].map((x): Vec3 => [x, s[1] - T / 2, p[2]]), [0, 1, 0], { on: `S${i}`, mate: `SL${i}` });
    }
  });
}

/* ---------- the low cabinet (81 x 47 x 89): its own manual, the plinth built in ---------- */

function buildLow(k: Kit, gd: Guide) {
  const f = frameOf(gd, { inset: 24 });
  frameParts(k, f, { back: 1 });
  const yIn0 = f.y0 + T, yIn1 = f.yTop - T;
  const ys = [(yIn0 + yIn1) / 2];
  shelfParts(k, f, ys);
  plinthParts(k, gd, f);
  const doors = hingedDoors(k, f, yIn0, yIn1, false);
  frameSteps(k, f, { tall: false, back: 1, clips: 7, locks: 4 });
  const pl = plinthSteps(k, gd, f, { brackets: 4, feet: 2, joinFirst: true, joinPose: "+z" });
  plinthJoin(k, gd, f, pl.bx, false, "+z");
  pl.glides();
  pl.feet();
  k.step({ title: "Stand it up", detail: "Lift it upright, don't pull it up by one corner.", pose: "+y", kind: "standup" });
  wallFittingSteps(k, f, { plinth: true, feet: 2 });
  stopSteps(k, f, yIn1, yIn0);
  shelfSteps(k, f, ys);
  hingeSteps(k, f, doors);
  knobStep(k, doors);
}

/* ---------- the sideboard: sliding doors and two drawers under the top ---------- */

const DR_BOLT: HwDef = PL_BOLT;
const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const runnerDef = (len: number): HwDef => ({ kind: "runner", len: Math.round(len / 10) * 10, dia: 30 });

interface Tray {
  id: string;
  x: number; // centre
  w: number; // opening width
  y: number; // underside of the box
  h: number;
  z1: number; // front face
  d: number;
}

/** The sideboard's drawers: a front, a bottom slid into its groove, and a folding box of sides and back. */
function trayParts(k: Kit, t: Tray) {
  const w = t.w - 26, ft = 18;
  k.part(`${t.id}F`, "Drawer front", [w, t.h, ft], [t.x, t.y + t.h / 2, t.z1 - ft / 2]);
  k.part(`${t.id}B`, "Drawer bottom", [w - 16, 4, t.d - ft - 8], [t.x, t.y + 8, t.z1 - ft - (t.d - ft) / 2], { material: "fiber" });
  const zb = t.z1 - t.d;
  const sides: PartPiece[] = [
    { shape: "box", size: [12, t.h - 10, t.d - ft], pos: [-w / 2 + 6, 0, 0] },
    { shape: "box", size: [12, t.h - 10, t.d - ft], pos: [w / 2 - 6, 0, 0] },
    { shape: "box", size: [w - 24, t.h - 10, 12], pos: [0, 0, -(t.d - ft) / 2 + 6] },
  ];
  k.part(`${t.id}S`, "Drawer sides and back", [w, t.h - 10, t.d - ft], [t.x, t.y + (t.h - 10) / 2, zb + (t.d - ft) / 2], { pieces: sides });
}

function traySteps(k: Kit, list: Tray[]) {
  const sc = "drawer";
  const n = list.length;
  const ids = (t: Tray) => [`${t.id}F`, `${t.id}B`, `${t.id}S`];
  const shift = (t: Tray, i: number): Vec3 => [-t.x + (i - (n - 1) / 2) * (t.w + 160), -t.y, 0];
  k.step({ title: "Screw the cam bolts into the drawer fronts", detail: "Lay the fronts face down on a rug. Two bolts in each end, by hand.", tools: ["screwdriver"], scene: sc, pose: "-z", warnings: ["face"], kind: "cams" }, () => {
    list.forEach((t, i) => k.stage([`${t.id}F`], shift(t, i), [0, 0, -200]));
    for (const t of list) {
      const w = t.w - 26;
      k.fit(DR_BOLT, [-1, 1].flatMap((g) => [t.y + 25, t.y + t.h - 25].map((y): Vec3 => [t.x + g * (w / 2 - 6), y, t.z1 - 18])), [0, 0, -1], { on: `${t.id}F` });
    }
  });
  k.step({ title: "Slide the bottoms into the fronts", detail: "Into the groove along each front, smooth side up.", scene: sc, pose: "-z", kind: "drawer" }, () =>
    list.forEach((t, i) => k.stage([`${t.id}B`], shift(t, i), [0, 0, -300])),
  );
  k.step({ title: "Fold up the sides and back", detail: "Stand the folding box up round the bottom, so its sides go onto the cam bolts.", scene: sc, pose: "-z", kind: "drawer" }, () =>
    list.forEach((t, i) => k.stage([`${t.id}S`], shift(t, i), [0, 0, -260])),
  );
  k.step({ title: "Turn the cam locks", detail: "Four in each drawer, two in each side, until they pull the front tight.", tools: ["screwdriver"], scene: sc, pose: "-z", kind: "cams" }, () => {
    for (const t of list) {
      const w = t.w - 26;
      for (const g of [-1, 1])
        k.fit(CAM, [t.y + 25, t.y + t.h - 25].map((y): Vec3 => [t.x + g * (w / 2 - 12), y, t.z1 - 18 - 30]), [g, 0, 0], { on: `${t.id}S` });
    }
  });
  void ids;
}

function buildSideboard(k: Kit, gd: Guide) {
  const f = frameOf(gd, { inset: 62 });
  frameParts(k, f, { back: 1 });
  const yIn0 = f.y0 + T, yIn1 = f.yTop - T;
  // two boards hang under the top to carry the drawer runners, one each side of the middle
  const bh = 130, bd = f.di - 62;
  const bz = f.zf - 62 - bd / 2;
  for (const [i, g] of [-1, 1].entries()) k.part(`HB${i}`, "Runner board", [T, bh, bd], [g * 80, yIn1 - bh / 2, bz]);
  const ys = [f.y0 + T + (yIn1 - bh - yIn0) * 0.5];
  shelfParts(k, f, ys);
  plinthParts(k, gd, f);
  const trays: Tray[] = [-1, 1].map((g, i) => {
    const xa = g < 0 ? -xIn(f) : 80 + T / 2, xb = g < 0 ? -80 - T / 2 : xIn(f);
    return { id: `T${i}`, x: (xa + xb) / 2, w: xb - xa, y: yIn1 - bh + 10, h: bh - 30, z1: f.zf - 64, d: bd - 10 };
  });
  for (const t of trays) trayParts(k, t);
  const doors = slidingDoors(k, f, yIn0, yIn1, "");

  k.step({ title: "Hang the bottom on one side", detail: "Stand the side on its front edge on a rug, holes facing in. Pins into the keyholes, then slide the bottom down until it stops.", pose: "-z", warnings: ["floor"], kind: "join" }, () => {
    k.add(["L"], [-220, 0, 0]);
    k.add(["BOT"], [0, 0, -200]);
  });
  k.step({ title: "Screw the cam bolts into the top", detail: "Lay the top upside down on the rug. Four bolts, by hand until they stop.", tools: ["screwdriver"], scene: "prep", pose: "-y", warnings: ["floor"], kind: "cams" }, () => {
    k.stage(["TOP"], [0, -f.yTop + T, 0], [0, 160, 0]);
    k.fit(PL_BOLT, [-1, 1].flatMap((g) => [bz - bd / 3, bz + bd / 3].map((z): Vec3 => [g * 80, yIn1, z])), [0, 1, 0], { on: "TOP" });
  });
  k.step({ title: "Tap the dowels into the runner boards", detail: "Two dowels in the top edge of each board.", tools: ["hammer"], scene: "prep", pose: "-y", kind: "dowels" }, () => {
    k.stage(["HB0", "HB1"], [0, -f.yTop + T, 0], [0, 200, 0]);
    for (const i of [0, 1]) k.fit(DOWEL, [bz - bd / 6, bz + bd / 6].map((z): Vec3 => [(i ? 1 : -1) * 80, yIn1, z]), [0, 1, 0], { on: `HB${i}`, mate: "TOP" });
  });
  k.step({ title: "Press the boards onto the top and lock them", detail: "Push each board onto its dowels and bolts, then two cam locks in each.", tools: ["screwdriver"], scene: "prep", pose: "-y", kind: "cams" }, () => {
    for (const i of [0, 1]) k.fit(CAM, [bz - bd / 3, bz + bd / 3].map((z): Vec3 => [(i ? 1 : -1) * 80 + (i ? 1 : -1) * T / 2, yIn1 - 30, z]), [i ? -1 : 1, 0, 0], { on: `HB${i}` });
  });
  k.step({ title: "Hang the top and lower the other side on", detail: "Top onto the first side's keyholes, then guide every pin of the other side into place and press it down.", pose: "-z", people: 2, kind: "join" }, () => {
    k.add(["TOP", "HB0", "HB1"], [0, 0, -200]);
    k.add(["R"], [220, 0, 0]);
  });
  backSteps(k, f, { back: 1, clips: 7, locks: 8 });
  const pl = plinthSteps(k, gd, f, { brackets: 5, feet: 2, joinFirst: true, joinPose: "+z" });
  plinthJoin(k, gd, f, pl.bx, true, "+z");
  pl.glides();
  pl.feet();
  k.step({ title: "Stand it up together", detail: "Lift it upright with someone else.", pose: "+y", people: 2, kind: "standup" });
  wallFittingSteps(k, f, { plinth: true, feet: 2 });
  shelfSteps(k, f, ys);
  k.step({ title: "Screw the runners in under the top", detail: "Two pairs: one runner on the side and one on the board facing it, for each drawer. Two screws each.", tools: ["screwdriver"], kind: "runners" }, () => {
    for (const t of trays) {
      const len = t.d - 20;
      for (const g of [-1, 1]) {
        const x = t.x + g * (t.w / 2), on = Math.abs(x) > xIn(f) - 1 ? (x < 0 ? "L" : "R") : x < 0 ? "HB0" : "HB1";
        const z = t.z1 - 10 - len / 2;
        k.fit(runnerDef(len), [[x - g * 6, t.y + 20, z]], [g, 0, 0], { on, hole: false, gap: 0.15 });
        k.fit(RUNNER_SCREW, [z - len / 3, z + len / 3].map((zz): Vec3 => [x - g * 3, t.y + 20, zz]), [g, 0, 0], { on, gap: 0.05 });
      }
    }
  });
  slidingSteps(k, f, doors, { stopsOn: "BOT", only: "hang" });
  traySteps(k, trays);
  k.step({ title: "Push the drawers onto the runners", detail: "Pull the runners out, set each drawer on them and push it in until both sides click.", kind: "drawer" }, () =>
    k.add(trays.flatMap((t) => [`${t.id}F`, `${t.id}B`, `${t.id}S`]), [0, 0, 380]),
  );
  slidingSteps(k, f, doors, { stopsOn: "BOT", only: "finish" });
}

/* ---------- the TV bench ---------- */

const ZKEY_BOLT: HwDef = { kind: "bolt", len: 60, dia: 6 };

function buildTv(k: Kit, gd: Guide) {
  const f = frameOf(gd, { inset: 62 });
  const { W, y0, Hc, zb, di, zi } = f;
  k.part("L", "Side panel", [T, Hc, f.Dc], [-W / 2 + T / 2, y0 + Hc / 2, f.zc]);
  k.part("R", "Side panel", [T, Hc, f.Dc], [W / 2 - T / 2, y0 + Hc / 2, f.zc]);
  k.part("BOT", "Bottom panel", [W - 2 * T, T, di], [0, y0 + T / 2, zi]);
  k.part("TOP", "Top panel", [W - 2 * T, T, di], [0, f.yTop - T / 2, zi]);
  const dv = di - 62;
  k.part("MV", "Divider", [T, Hc - 2 * T, dv], [0, y0 + Hc / 2, zi - 31]);
  k.part("BK", "Back panel", [W - 2 * T + 16, Hc - 8, 4], [0, y0 + Hc / 2, zb + 10], { material: "fiber" });
  k.part("BR", "Back rail", [W - 2 * T, 60, T], [0, y0 + T + 30, zb + 12 + T / 2]);
  const yIn0 = y0 + T, yIn1 = f.yTop - T;
  const half = (W - 2 * T - T) / 2;
  const sw = half - 4, sd = shelfDepth(f) - T;
  const sy = (yIn0 + yIn1) / 2 + 10;
  for (const [i, g] of [-1, 1].entries()) k.part(`S${i}`, "Shelf", [sw, T, sd], [g * (T / 2 + half / 2), sy, shelfFront(f) - sd / 2]);
  plinthParts(k, gd, f);
  const doors = slidingDoors(k, f, yIn0, yIn1, "plain");

  const pinPts = (g: number): Vec3[] => [
    [g * xIn(f), y0 + T / 2, zi - di / 3],
    [g * xIn(f), y0 + T / 2, zi + di / 3],
    [g * xIn(f), f.yTop - T / 2, zi],
  ];
  k.step({ title: "Screw the pins into both sides", detail: "Lay the sides on a rug, holes up. Three pins in each, by hand until they stop.", tools: ["screwdriver"], scene: "prep", warnings: ["floor"], kind: "cams" }, () => {
    k.stage(["L"], [W / 2 - T / 2 - 300, -Hc / 2 - y0 + T / 2, 0], [0, 160, 0], [0, 0, Math.PI / 2]);
    k.stage(["R"], [-W / 2 + T / 2 + 300, -Hc / 2 - y0 + T / 2, 0], [0, 160, 0], [0, 0, -Math.PI / 2]);
    k.fit(PIN, pinPts(-1), [1, 0, 0], { on: "L" });
    k.fit(PIN, pinPts(1), [-1, 0, 0], { on: "R" });
  });
  k.step({ title: "Hang the sides on the bottom", detail: "Keyholes in the bottom's ends over the pins, then push each side down until it stops.", kind: "join", warnings: ["floor"] }, () => {
    k.add(["BOT"], [0, 120, 0]);
    k.add(["L"], [-200, 0, 0]);
    k.add(["R"], [200, 0, 0]);
  });
  k.step({ title: "Stand the divider in the middle", detail: "Onto the pins in the bottom, then slide it back until it stops.", kind: "join" }, () => k.add(["MV"], [0, 260, 0]));
  k.step({ title: "Lower the top on", detail: "Onto the pins of both sides and the divider, pressing down evenly.", people: 2, kind: "join" }, () => k.add(["TOP"], [0, 260, 0]));
  k.step({ title: "Bolt the top to the divider", detail: "Two long bolts down through the top into the divider, with the bent key.", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(ZKEY_BOLT, [zi - dv / 3 - 31, zi + dv / 3 - 31].map((z): Vec3 => [0, f.yTop, z]), [0, -1, 0], { on: "TOP", mate: "MV" }),
  );
  k.step({ title: "Turn it upside down and tighten the pins", detail: "All six, through the holes next to them, until the panels pull tight.", tools: ["screwdriver"], pose: "-y", kind: "cams" });
  k.step({ title: "Slide in the back and the back rail", detail: "The back runs in the grooves of the sides. The rail goes in front of it, along the bottom.", pose: "-y", kind: "join" }, () => {
    k.add(["BK"], [0, 0, -300]);
    k.add(["BR"], [0, -200, 0]);
  });
  k.step({ title: "Bolt the back rail on", detail: "Three long bolts through the bottom into the rail, with the bent key.", tools: ["allen"], pose: "-y", kind: "bolts" }, () =>
    k.fit(ZKEY_BOLT, spread(-W / 2 + 200, W / 2 - 200, 3).map((x): Vec3 => [x, y0, zb + 12 + T / 2]), [0, 1, 0], { on: "BOT", mate: "BR" }),
  );
  const pl = plinthSteps(k, gd, f, { brackets: 7, feet: 3, joinFirst: true, joinPose: "-y" });
  plinthJoin(k, gd, f, pl.bx, true, "-y");
  pl.feet();
  pl.glides();
  k.step({ title: "Turn it the right way up together", detail: "Lift it over with someone else, don't roll it on one corner.", pose: "+y", people: 2, kind: "standup" });
  k.step({ title: "Push in the 8 shelf supports", detail: "Four for each shelf, the same hole on each side.", kind: "shelves" }, () => {
    for (const [i, g] of [-1, 1].entries()) {
      const xo = g * xIn(f), xd = g * (T / 2);
      const zs = shelfFront(f) - sd;
      k.fit(SUPPORT, [zs + 40, shelfFront(f) - 40].map((z): Vec3 => [xo, sy - T / 2, z]), [g, 0, 0], { on: g < 0 ? "L" : "R", gap: 0.05 });
      k.fit(SUPPORT, [zs + 40, shelfFront(f) - 40].map((z): Vec3 => [xd, sy - T / 2, z]), [-g, 0, 0], { on: "MV", gap: 0.05 });
      void i;
    }
  });
  k.step({ title: "Lay in the two shelves", detail: "One each side of the divider.", kind: "shelves" }, () => k.add(["S0", "S1"], [0, 0, 300]));
  slidingSteps(k, f, doors, { stopsOn: "BOT" });
  k.step({ title: "Level it with the feet", detail: "Turn the three feet with the spanner, through the plinth, until it stands level.", tools: ["wrench", "level"], kind: "legs" });
  const pts = [-1, 1].map((g): Vec3 => [g * (xIn(f) - 120), f.yTop - T - 40, zb]);
  k.step(
    {
      title: "Fix it to the wall",
      detail: "Screw a bracket onto the back at each end, then screw through it into the wall with a washer. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["screwdriver", "drill", "pencil"],
      kind: "anchor",
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      k.fit(L_BRACKET, pts, [0, 0, 1], { on: "BK", hole: false, travel: 60 });
      k.fit(WASHER, pts.map((p): Vec3 => [p[0], p[1] + 20, p[2] - 2]), [0, 0, 1], { on: "BK", hole: false });
      k.fit(SMALL_SCREW, pts.map((p): Vec3 => [p[0], p[1] + 20, p[2] - 4]), [0, 0, 1], { on: "TOP" });
      k.fit(PLUG, pts.map((p): Vec3 => [p[0], p[1] + 40, zb - 20]), [0, 0, -1]);
      k.fit(WASHER, pts.map((p): Vec3 => [p[0], p[1] + 40, zb - 2]), [0, 0, -1], { on: "BK", hole: false });
      k.fit(WALL_SCREW, pts.map((p): Vec3 => [p[0], p[1] + 40, zb]), [0, 0, -1]);
    },
  );
}

/* ---------- the chests of drawers ---------- */

const RUNNER_SIDE_SCREW: HwDef = { kind: "screw", len: 13, dia: 5, name: "Runner screw" };
const BIG_SCREW: HwDef = { kind: "screw", len: 50, dia: 6 };
const BACK_SCREW: HwDef = FRAME_SCREW;
const TOP_CONNECTOR: HwDef = { kind: "connector", len: 20, dia: 24, name: "Top fitting" };
const CONNECTOR_BOLT: HwDef = { kind: "camScrew", len: 44, dia: 7, name: "Connector bolt" };
const DR_CAM: HwDef = { kind: "cam", len: 12, dia: 12 };
const PLASTIC_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 6, name: "Plastic dowel" };
const SMALL_DOWEL: HwDef = { kind: "dowel", len: 25, dia: 6 };
const WIRE: HwDef = { kind: "clip", len: 16, dia: 6, name: "Drawer stop wire" };
const WALL_BRACKET: HwDef = { kind: "bracket", len: 80, dia: 30 };

interface Box {
  id: string;
  x: number; // centre of the opening
  w: number;
  y: number; // bottom of the opening
  h: number;
  big: boolean;
}

function buildChest(k: Kit, gd: Guide) {
  const n = gd.drawers, cols = n === 6 ? 2 : 1;
  const f = frameOf(gd);
  const { W, y0, Dc, zc, zb, zf } = f;
  const tops = cols === 1 ? 2 : 1; // the 3-drawer chest has a second top board on the frame top
  const Hs = gd.H - y0 - tops * T; // sides
  const ySideTop = y0 + Hs;
  k.part("L", "Side panel", [T, Hs, Dc], [-W / 2 + T / 2, y0 + Hs / 2, zc]);
  k.part("R", "Side panel", [T, Hs, Dc], [W / 2 - T / 2, y0 + Hs / 2, zc]);
  const di = Dc - 12, zi = zf - di / 2;
  k.part("BOT", "Bottom panel", [W - 2 * T, T, di], [0, y0 + T / 2, zi]);
  if (cols === 2) k.part("MV", "Divider", [T, Hs - T, di], [0, y0 + T + (Hs - T) / 2, zi]);
  k.part("TOPF", cols === 2 ? "Top" : "Frame top", [W, T, Dc], [0, ySideTop + T / 2, zc]);
  if (tops === 2) k.part("TOP", "Top", [W, T, Dc], [0, ySideTop + T * 1.5, zc]);
  k.part("TR", "Back rail", [W - 2 * T, 80, T], [0, ySideTop - 40, zb + 12 + T / 2]);
  k.part("BK", "Back panel", [W - 2 * T + 16, Hs - 6, 4], [0, y0 + Hs / 2, zb + 10], { material: "fiber" });
  // openings: a small drawer on top, two big ones under it, rails between them at the front
  const yIn0 = y0 + T, yIn1 = ySideTop;
  const free = yIn1 - yIn0 - 2 * T;
  const hs = Math.round(free * 0.26), hb = (free - hs) / 2;
  const rowY = [yIn1 - hs, yIn1 - hs - T - hb, yIn0];
  const rowH = [hs, hb, hb];
  const cw = cols === 1 ? W - 2 * T : (W - 3 * T) / 2;
  const cx = (c: number) => (cols === 1 ? 0 : (c ? 1 : -1) * (T / 2 + cw / 2));
  const railsZ = zf - 20;
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < 2; r++) k.part(`FR${c}${r}`, "Front rail", [cw, T, 40], [cx(c), rowY[r] - T / 2, railsZ]);
  const boxes: Box[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) boxes.push({ id: `D${r}${c}`, x: cx(c), w: cw, y: rowY[r], h: rowH[r], big: r > 0 });
  const dd = Dc - 12 - 30 - 18;
  for (const b of boxes) drawerParts(k, b, zf, dd);
  plinthParts(k, gd, f);

  const sideX = (g: number) => g * xIn(f);
  const runnerY = (b: Box) => b.y + 12;
  const faces: { on: string; g: number; c: number }[] =
    cols === 1
      ? [{ on: "L", g: -1, c: 0 }, { on: "R", g: 1, c: 0 }]
      : [{ on: "L", g: -1, c: 0 }, { on: "R", g: 1, c: 1 }, { on: "MV", g: 1, c: 0 }, { on: "MV", g: -1, c: 1 }];
  const faceX = (fc: { on: string; g: number }) => (fc.on === "MV" ? fc.g * (T / 2) : sideX(fc.g));
  const rlen = dd - 20;
  const rz = zf - 18 - rlen / 2 - 10;
  const runnersOn = (on: string) => {
    for (const fc of faces.filter((x) => x.on === on))
      for (const b of boxes.filter((bb) => bb.x === cx(fc.c))) {
        const x = faceX(fc);
        k.fit(runnerDef(rlen), [[x - fc.g * 6, runnerY(b), rz]], [fc.g, 0, 0], { on, hole: false, gap: 0.12 });
        k.fit(RUNNER_SIDE_SCREW, [rz - rlen / 3, rz + rlen / 3].map((z): Vec3 => [x - fc.g * 12, runnerY(b), z]), [fc.g, 0, 0], { on, gap: 0.05 });
      }
  };
  k.step(
    { title: "Screw the runners onto the sides", detail: "Lay the panels on a rug, inside faces up, marked L and R. Two screws in each runner, the wheel end at the front.", tools: ["screwdriver"], scene: "prep", warnings: ["floor"], kind: "runners" },
    () => {
      k.stage(["L"], [W / 2 - T / 2, -Hs / 2 - y0 + T / 2, -Dc * 0.7], [0, 160, 0], [0, 0, Math.PI / 2]);
      k.stage(["R"], [-W / 2 + T / 2, -Hs / 2 - y0 + T / 2, Dc * 0.7], [0, 160, 0], [0, 0, -Math.PI / 2]);
      runnersOn("L");
      runnersOn("R");
    },
  );
  if (cols === 2)
    k.step({ title: "Screw runners onto both faces of the divider", detail: "Three on each face, two screws each.", tools: ["screwdriver"], scene: "prep2", kind: "runners" }, () => {
      k.stage(["MV"], [0, 0, 0], [0, 160, 0]);
      runnersOn("MV");
    });
  // cam bolts: three in each side for the bottom, one for each front rail
  const sideBolts = (g: number): Vec3[] => [
    ...[zi - di / 3, zi, zi + di / 3].map((z): Vec3 => [sideX(g), y0 + T / 2, z]),
    ...[0, 1].map((r): Vec3 => [sideX(g), rowY[r] - T / 2, railsZ]),
  ];
  k.step({ title: "Screw the cam bolts into the sides", detail: "Five in each side, by hand until they stop.", tools: ["screwdriver"], scene: "prep", kind: "cams" }, () => {
    k.fit(PL_BOLT, sideBolts(-1), [1, 0, 0], { on: "L" });
    k.fit(PL_BOLT, sideBolts(1), [-1, 0, 0], { on: "R" });
  });
  const rails = range(cols).flatMap((c) => [0, 1].map((r) => `FR${c}${r}`));
  k.step(
    { title: "Tap the dowels into the bottom and the front rails", detail: cols === 2 ? "Two in each end of the bottom, one in each end of every rail, two in each end of the divider." : "Two in each end of the bottom and one in each end of both rails.", tools: ["hammer"], scene: "prep3", kind: "dowels" },
    () => {
      k.stage(["BOT"], [0, -y0, 0], [0, 160, 0]);
      for (let c = 0; c < cols; c++) for (const r of [0, 1]) k.stage([`FR${c}${r}`], [0, -(rowY[r] - T / 2) - y0 + T / 2 + y0 * 0, 160 + (c * 2 + r) * 70], [0, 160, 0]);
      for (const g of [-1, 1]) k.fit(DOWEL, [zi - di / 4, zi + di / 4].map((z): Vec3 => [g * xIn(f), y0 + T / 2, z]), [g, 0, 0], { on: "BOT", mate: g < 0 ? "L" : "R" });
      for (let c = 0; c < cols; c++)
        for (const r of [0, 1]) for (const g of [-1, 1]) k.fit(DOWEL, [[cx(c) + g * (cw / 2), rowY[r] - T / 2, railsZ]], [g, 0, 0], { on: `FR${c}${r}` });
      if (cols === 2) {
        k.stage(["MV"], [0, 0, -Dc - 100]);
        k.fit(DOWEL, [zi - di / 4, zi + di / 4].flatMap((z): Vec3[] => [[0, y0 + T, z], [0, ySideTop, z]]), [0, 1, 0], { on: "MV" });
      }
    },
  );
  k.step({ title: "Push the bottom onto one side", detail: "Stand the side upright on the rug, runners facing in. Push the bottom onto its dowels and bolts, then three cam locks.", tools: ["screwdriver"], warnings: ["floor"], kind: "cams" }, () => {
    k.add(["L"], [-200, 0, 0]);
    k.add(["BOT"], [200, 0, 0]);
    k.fit(CAM, [zi - di / 3, zi, zi + di / 3].map((z): Vec3 => [-xIn(f) + 30, y0 + T, z]), [0, -1, 0], { on: "BOT" });
  });
  if (cols === 2)
    k.step({ title: "Screw the divider to the bottom", detail: "Stand it on the bottom's dowels, then two long screws up through the bottom into it.", tools: ["allen"], kind: "screws" }, () => {
      k.add(["MV"], [0, 300, 0]);
      k.fit(BIG_SCREW, [zi - di / 4 + 30, zi + di / 4 + 30].map((z): Vec3 => [0, y0, z]), [0, 1, 0], { on: "BOT", mate: "MV" });
    });
  k.step({ title: "Push in the front rails", detail: cols === 2 ? "Between the side and the divider, and turn the cam locks at the side." : "Their dowels into the side, then two cam locks.", tools: ["screwdriver"], kind: "cams" }, () => {
    k.add(rails, [0, 0, 260]);
    k.fit(CAM, [0, 1].map((r): Vec3 => [cx(0) - cw / 2 + 30, rowY[r], railsZ]), [0, -1, 0], { on: "FR00" });
    if (cols === 2) {
      k.fit(CAM, [0, 1].map((r): Vec3 => [cx(0) + cw / 2 - 30, rowY[r], railsZ]), [0, -1, 0], { on: "FR00" });
      k.fit(CAM, [0, 1].map((r): Vec3 => [cx(1) - cw / 2 + 30, rowY[r], railsZ]), [0, -1, 0], { on: "FR10" });
    }
  });
  if (cols === 2)
    k.step({ title: "Bolt the rails to the divider", detail: "One connector bolt through the divider into each rail, with the Allen key.", tools: ["allen"], kind: "bolts" }, () =>
      k.fit(CONNECTOR_BOLT, [0, 1].map((r): Vec3 => [-T / 2, rowY[r] - T / 2, railsZ]).flatMap((p): Vec3[] => [p, [T / 2, p[1], p[2]]]), [1, 0, 0], { on: "MV", gap: 0.1 }),
    );
  k.step({ title: "Push on the other side and lock it", detail: "Onto the dowels and bolts, then five cam locks.", tools: ["screwdriver"], people: cols === 2 ? 2 : 1, kind: "cams" }, () => {
    k.add(["R"], [220, 0, 0]);
    k.fit(CAM, [zi - di / 3, zi, zi + di / 3].map((z): Vec3 => [xIn(f) - 30, y0 + T, z]), [0, -1, 0], { on: "BOT" });
    k.fit(CAM, [0, 1].map((r): Vec3 => [cx(cols - 1) + cw / 2 - 30, rowY[r], railsZ]), [0, -1, 0], { on: `FR${cols - 1}0` });
  });
  // the top: cam bolts underneath, the wall brackets, dowels in the sides, slid on from the back
  const topBolts: Vec3[] = [
    ...[-1, 1].flatMap((g) => [zc - Dc / 3, zc, zc + Dc / 3].map((z): Vec3 => [g * (W / 2 - T / 2), ySideTop, z])),
    ...[-1, 1].map((g): Vec3 => [g * (W / 4), ySideTop, zb + 12 + T / 2]),
    ...(cols === 2 ? [zi - di / 3, zi, zi + di / 3].map((z): Vec3 => [0, ySideTop, z]) : []),
  ];
  const brk = [-1, 1].map((g): Vec3 => [g * (W / 2 - 140), ySideTop, zb + 30]);
  k.step({ title: "Screw the cam bolts into the top", detail: `Lay it upside down on the rug. ${topBolts.length} bolts, by hand until they stop.`, tools: ["screwdriver"], scene: "top", warnings: ["face"], kind: "cams" }, () => {
    k.stage(["TOPF"], [0, -ySideTop, 0], [0, 160, 0], [Math.PI, 0, 0]);
    k.fit(PL_BOLT, topBolts, [0, 1, 0], { on: "TOPF" });
  });
  k.step({ title: "Screw the wall brackets under the top", detail: "One at each back corner, one screw each.", tools: ["screwdriver"], scene: "top", kind: "anchor" }, () => {
    k.fit(WALL_BRACKET, brk, [0, 1, 0], { on: "TOPF", hole: false });
    k.fit(SMALL_SCREW, brk.map((p): Vec3 => [p[0], p[1], p[2] + 20]), [0, 1, 0], { on: "TOPF" });
  });
  k.step({ title: "Tap the dowels into the top edges of the sides", detail: "Two in each side.", tools: ["hammer"], kind: "dowels" }, () =>
    k.fit(DOWEL, [-1, 1].flatMap((g) => [zc - Dc / 6, zc + Dc / 6].map((z): Vec3 => [g * (W / 2 - T / 2), ySideTop, z])), [0, 1, 0], { on: "L", gap: 0.08 }),
  );
  const sideLocks = [-1, 1].flatMap((g) => [zc - Dc / 3, zc, zc + Dc / 3].map((z): Vec3 => [g * (xIn(f) - 0), ySideTop - 30, z]));
  k.step({ title: "Slide the top on from the back and lock it", detail: `Onto the dowels, then ${sideLocks.length + (cols === 2 ? 3 : 0)} cam locks in the sides${cols === 2 ? " and the divider" : ""}.`, tools: ["screwdriver"], kind: "cams" }, () => {
    k.add(["TOPF"], [0, 0, -360]);
    k.fit(CAM, sideLocks.filter((p) => p[0] < 0), [1, 0, 0], { on: "L" });
    k.fit(CAM, sideLocks.filter((p) => p[0] > 0), [-1, 0, 0], { on: "R" });
    if (cols === 2) k.fit(CAM, [zi - di / 3, zi, zi + di / 3].map((z): Vec3 => [T / 2, ySideTop - 30, z]), [-1, 0, 0], { on: "MV" });
  });
  if (tops === 2) {
    k.step({ title: "Push the top fittings into the frame top", detail: "Four of them, near the corners.", kind: "general" }, () =>
      k.fit(TOP_CONNECTOR, [-1, 1].flatMap((g) => [-1, 1].map((h): Vec3 => [g * (W / 2 - 100), ySideTop + T, zc + h * (Dc / 2 - 80)])), [0, -1, 0], { on: "TOPF" }),
    );
    k.step({ title: "Press the top board on", detail: "Line it up all round and press it down onto the fittings.", kind: "join" }, () => k.add(["TOP"], [0, 260, 0]));
  }
  k.step({ title: "Fit the back rail under the top", detail: `Tap ${cols === 2 ? 4 : 3} dowels into its top edge, lift it up onto them and the cam bolts at the back, then turn two cam locks.`, tools: ["hammer", "screwdriver"], kind: "cams" }, () => {
    // from below: its dowels and the top's cam bolts both point up and down
    k.add(["TR"], [0, -220, 0]);
    k.fit(DOWEL, spread(-W / 2 + 120, W / 2 - 120, cols === 2 ? 4 : 3).map((x): Vec3 => [x, ySideTop, zb + 12 + T / 2]), [0, 1, 0], { on: "TR", mate: "TOPF" });
    k.fit(CAM, [-1, 1].map((g): Vec3 => [g * (W / 4), ySideTop - 30, zb + 12 + T]), [0, 0, -1], { on: "TR" });
  });
  k.step({ title: "Slide in the back and screw it to the bottom", detail: `Down the grooves in the sides, then ${cols === 2 ? 7 : 3} screws through it into the bottom${cols === 2 ? " and the divider" : ""}.`, tools: ["screwdriver"], kind: "screws" }, () => {
    k.add(["BK"], [0, 0, -300]);
    const pts = spread(-W / 2 + 120, W / 2 - 120, 3).map((x): Vec3 => [x, y0 + T / 2, zb + 8]);
    const mv = cols === 2 ? spread(y0 + 200, ySideTop - 120, 4).map((y): Vec3 => [0, y, zb + 8]) : [];
    k.fit(BACK_SCREW, pts, [0, 0, 1], { on: "BK", mate: "BOT" });
    if (mv.length) k.fit(BACK_SCREW, mv, [0, 0, 1], { on: "BK", mate: "MV" });
  });
  const pl = plinthSteps(k, gd, f, { brackets: cols === 2 ? 5 : 4, feet: 2, joinFirst: true, joinPose: "+z" });
  k.step({ title: "Lay it on its back together", detail: "On the rug, so the bottom faces you for the plinth.", pose: "+z", people: 2, kind: "flip" });
  plinthJoin(k, gd, f, pl.bx, true, "+z");
  pl.glides();
  pl.feet();
  k.step({ title: "Stand it up together", detail: "Lift it upright with someone else.", pose: "+y", people: 2, kind: "standup" });
  k.step({ title: "Level it with the feet", detail: "Turn the two front feet with the spanner, through the plinth, until it stands level.", tools: ["wrench", "level"], kind: "legs" });
  k.step(
    {
      title: "Fix it to the wall",
      detail: "Push it to the wall, mark through the brackets, then screw them on with two washers each. Wall screws and plugs come in the bag, but check they suit your wall.",
      tools: ["drill", "screwdriver", "pencil"],
      kind: "anchor",
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      const w = brk.map((p): Vec3 => [p[0], p[1] - 40, zb]);
      k.fit({ kind: "plug", len: 35, dia: 8 }, w.map((p): Vec3 => [p[0], p[1], p[2] - 20]), [0, 0, -1]);
      k.fit(WASHER, w.flatMap((p): Vec3[] => [[p[0], p[1], p[2] + 4], [p[0], p[1], p[2] + 6]]), [0, 0, -1], { on: "TOPF", hole: false });
      k.fit({ kind: "screw", len: 50, dia: 5 }, w.map((p): Vec3 => [p[0], p[1], p[2] + 8]), [0, 0, -1]);
    },
  );
  drawerSteps(k, boxes, zf, dd, cols);
}

/** A HAVSTA drawer: front, two sides, bottom in the grooves, back on plastic dowels. */
function drawerParts(k: Kit, b: Box, zf: number, dd: number) {
  const ft = 18, st = 14;
  const fw = b.w - 4, fh = b.h - 4;
  const xs = b.w / 2 - 14 - st / 2;
  const sh = Math.max(80, fh - 40);
  const ys = b.y + 20;
  const zd = zf - ft - dd / 2;
  k.part(`${b.id}F`, "Drawer front", [fw, fh, ft], [b.x, b.y + 2 + fh / 2, zf - ft / 2], { pieces: doorPieces(fw, fh, "").map((p) => ({ ...p, size: [p.size[0], p.size[1], Math.min(p.size[2], ft)] as Vec3, pos: [p.pos[0], p.pos[1], p.pos[2] * 0.5] as Vec3 })) });
  k.part(`${b.id}L`, "Drawer side", [st, sh, dd], [b.x - xs, ys + sh / 2, zd]);
  k.part(`${b.id}R`, "Drawer side", [st, sh, dd], [b.x + xs, ys + sh / 2, zd]);
  k.part(`${b.id}B`, "Drawer bottom", [2 * xs - 4, 4, dd - 16], [b.x, ys + 10, zd - 6], { material: "fiber" });
  k.part(`${b.id}K`, "Drawer back", [2 * xs - st, sh - 16, st], [b.x, ys + 16 + (sh - 16) / 2, zf - ft - dd + st / 2]);
}

function drawerSteps(k: Kit, boxes: Box[], zf: number, dd: number, cols: number) {
  const sc = "drawer";
  const ft = 18, st = 14;
  const shown = [boxes.find((b) => !b.big)!, boxes.find((b) => b.big)!];
  const nSmall = boxes.filter((b) => !b.big).length, nBig = boxes.length - nSmall;
  const geo = (b: Box) => {
    const fh = b.h - 4, xs = b.w / 2 - 14 - st / 2, sh = Math.max(80, fh - 40), ys = b.y + 20;
    return { xs, sh, ys, zIn: zf - ft, zBk: zf - ft - dd + st / 2 };
  };
  const ids = (b: Box) => ["F", "L", "R", "B", "K"].map((x) => `${b.id}${x}`);
  const shift = (b: Box, i: number): Vec3 => [-b.x + (i - 0.5) * (b.w + 200), -b.y, 0];
  const rep = boxes.length;
  const dstep = (o: Opts, body: () => void) => k.step({ scene: sc, pose: "-z", repeat: rep, kind: "drawer", ...o }, body);
  dstep({ title: "Screw the connector bolts into the drawer front", detail: "Lay the front face down on a rug. Four bolts, two at each end, by hand. The same for every drawer.", tools: ["screwdriver"], warnings: ["face"], kind: "cams" }, () => {
    shown.forEach((b, i) => k.stage([`${b.id}F`], shift(b, i), [0, 0, -200]));
    for (const b of shown) {
      const g0 = geo(b);
      k.fit(CONNECTOR_BOLT, [-1, 1].flatMap((g) => [g0.ys + 25, g0.ys + g0.sh - 25].map((y): Vec3 => [b.x + g * g0.xs, y, g0.zIn])), [0, 0, -1], { on: `${b.id}F` });
    }
  });
  dstep({ title: "Tap the dowels into the drawer sides", detail: `One in the front end of each side on the small drawer${nSmall > 1 ? "s" : ""}, two on the big ones.`, tools: ["hammer"], kind: "dowels" }, () => {
    for (const [i, b] of shown.entries()) {
      k.stage([`${b.id}L`, `${b.id}R`], add3(shift(b, i), [0, 0, -120]), [0, 0, -300]);
      const g0 = geo(b);
      const yy = b.big ? [g0.ys + g0.sh * 0.35, g0.ys + g0.sh * 0.65] : [g0.ys + g0.sh / 2];
      for (const [g, id] of [[-1, "L"], [1, "R"]] as const) k.fit(SMALL_DOWEL, yy.map((y): Vec3 => [b.x + g * g0.xs, y, g0.zIn]), [0, 0, 1], { on: `${b.id}${id}`, mate: `${b.id}F` });
    }
  });
  dstep({ title: "Stand the sides on the front and lock them", detail: "Push them onto the bolts and dowels, then four cam locks.", tools: ["screwdriver"], kind: "cams" }, () => {
    for (const [i, b] of shown.entries()) k.stage([`${b.id}L`, `${b.id}R`], shift(b, i), [0, 0, -200]);
    for (const b of shown) {
      const g0 = geo(b);
      for (const [g, id] of [[-1, "L"], [1, "R"]] as const) k.fit(DR_CAM, [g0.ys + 25, g0.ys + g0.sh - 25].map((y): Vec3 => [b.x + g * (g0.xs - st / 2), y, g0.zIn - 30]), [g, 0, 0], { on: `${b.id}${id}` });
    }
  });
  dstep({ title: "Slide in the bottom", detail: "Along the grooves in both sides, all the way to the front.", kind: "drawer" }, () => shown.forEach((b, i) => k.stage([`${b.id}B`], shift(b, i), [0, 0, -400])));
  dstep({ title: "Tap the stop wire into the back", detail: cols === 2 ? "Only on the big drawers: its two ends go into the holes along the top edge of the back." : "Its two ends go into the holes along the top edge of the back.", tools: ["hammer"], kind: "general" }, () => {
    for (const [i, b] of shown.entries()) {
      k.stage([`${b.id}K`], add3(shift(b, i), [0, 0, -160]), [0, 160, 0]);
      const g0 = geo(b);
      if (b.big || cols === 1) k.fit(WIRE, [[b.x, g0.ys + g0.sh, g0.zBk]], [0, -1, 0], { on: `${b.id}K`, hole: false });
    }
  });
  dstep({ title: "Put the back on and lock it", detail: "Lower it onto the sides, press a plastic dowel through each side into it, then four cam locks under the bottom.", tools: ["hammer", "screwdriver"], kind: "cams" }, () => {
    for (const [i, b] of shown.entries()) k.stage([`${b.id}K`], shift(b, i), [0, 0, -200]);
    for (const b of shown) {
      const g0 = geo(b);
      for (const [g, id] of [[-1, "L"], [1, "R"]] as const) k.fit(PLASTIC_DOWEL, [g0.ys + 40, g0.ys + g0.sh - 30].map((y): Vec3 => [b.x + g * (g0.xs + st / 2), y, g0.zBk]), [-g, 0, 0], { on: `${b.id}${id}`, mate: `${b.id}K` });
      k.fit(DR_CAM, [-1, 1].flatMap((g) => [g0.zBk + 20, g0.zIn - 40].map((z): Vec3 => [b.x + g * (g0.xs - 20), g0.ys, z])), [0, 1, 0], { on: `${b.id}B` });
    }
  });
  dstep({ title: "Screw on the knobs", detail: "Two on each front, screwed in from the inside.", tools: ["screwdriver"], kind: "screws" }, () => {
    for (const b of shown) {
      const g0 = geo(b);
      const xs = cols === 2 ? [b.x] : [b.x - b.w * 0.3, b.x + b.w * 0.3];
      const y = b.y + b.h / 2;
      k.fit(KNOB_SCREW, xs.map((x): Vec3 => [x, y, g0.zIn - 4]), [0, 0, 1], { on: `${b.id}F` });
      k.fit(KNOB, xs.map((x): Vec3 => [x, y, zf]), [0, 0, -1], { on: `${b.id}F`, hole: false });
    }
  });
  k.step({ title: "Pull out the runners and slide the drawers in", detail: "Set each drawer on its pair of runners and push it in until both sides click. Start at the bottom.", kind: "drawer" }, () => {
    // the drawers not built on screen come with the same fittings, already in place
    for (const b of boxes) if (!shown.includes(b)) presetLike(k, b, zf, dd, cols);
    k.add([...boxes].reverse().flatMap(ids), [0, 0, 420]);
  });
}

/** Fittings for a drawer that isn't shown being built, matching the one that is. */
function presetLike(k: Kit, b: Box, zf: number, dd: number, cols: number) {
  const ft = 18, st = 14;
  const fh = b.h - 4, xs = b.w / 2 - 14 - st / 2, sh = Math.max(80, fh - 40), ys = b.y + 20;
  const zIn = zf - ft, zBk = zf - ft - dd + st / 2;
  const pre = (def: HwDef, id: string, pts: Vec3[], dir: Vec3, hole?: false) => {
    for (const at of pts) k.b.preset(def, { on: k.k(`${b.id}${id}`), at, dir, hole });
  };
  pre(CONNECTOR_BOLT, "F", [-1, 1].flatMap((g) => [ys + 25, ys + sh - 25].map((y): Vec3 => [b.x + g * xs, y, zIn])), [0, 0, -1]);
  const yy = b.big ? [ys + sh * 0.35, ys + sh * 0.65] : [ys + sh / 2];
  for (const [g, id] of [[-1, "L"], [1, "R"]] as const) {
    pre(SMALL_DOWEL, id, yy.map((y): Vec3 => [b.x + g * xs, y, zIn]), [0, 0, 1]);
    pre(DR_CAM, id, [ys + 25, ys + sh - 25].map((y): Vec3 => [b.x + g * (xs - st / 2), y, zIn - 30]), [g, 0, 0]);
    pre(PLASTIC_DOWEL, id, [ys + 40, ys + sh - 30].map((y): Vec3 => [b.x + g * (xs + st / 2), y, zBk]), [-g, 0, 0]);
  }
  pre(DR_CAM, "B", [-1, 1].flatMap((g) => [zBk + 20, zIn - 40].map((z): Vec3 => [b.x + g * (xs - 20), ys, z])), [0, 1, 0]);
  if (b.big || cols === 1) pre(WIRE, "K", [[b.x, ys + sh, zBk]], [0, -1, 0], false);
  const kx = cols === 2 ? [b.x] : [b.x - b.w * 0.3, b.x + b.w * 0.3];
  pre(KNOB_SCREW, "F", kx.map((x): Vec3 => [x, b.y + b.h / 2, zIn - 4]), [0, 0, 1]);
  pre(KNOB, "F", kx.map((x): Vec3 => [x, b.y + b.h / 2, zf]), [0, 0, -1], false);
}

/* ---------- the console table: solid wood ---------- */

const ROD: HwDef = { kind: "stud", len: 80, dia: 8, name: "Threaded rod" };
const NUT: HwDef = { kind: "nut", len: 6, dia: 8 };
const CORNER: HwDef = { kind: "angle", len: 60, dia: 40, name: "Corner bracket" };
const RAIL_SCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
const TOP_SCREW: HwDef = { kind: "screw", len: 40, dia: 4.5 };
const SHELF_STOP: HwDef = { kind: "stud", len: 16, dia: 6, name: "Shelf stop" };
const C_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };

function buildConsole(k: Kit, gd: Guide) {
  const { W, H, D } = gd;
  const tt = 25, lw = 50, rt = 22;
  const xl = W / 2 - 60, zl = D / 2 - 50;
  const yTopU = H - tt;
  const wood = { material: "wood" as PartMaterial };
  k.part("TOP", "Table top", [W, tt, D], [0, H - tt / 2, 0], wood);
  const legs = [-1, 1].flatMap((gx) => [-1, 1].map((gz) => ({ id: `LG${gx < 0 ? "L" : "R"}${gz < 0 ? "B" : "F"}`, x: gx * xl, z: gz * zl, gx, gz })));
  for (const l of legs) k.part(l.id, "Leg", [lw, yTopU, lw], [l.x, yTopU / 2, l.z], wood);
  const lr = 2 * xl - lw, sr = 2 * zl - lw;
  const zr = zl + lw / 2 - rt / 2, xr = xl + lw / 2 - rt / 2;
  const ah = 80, ay = yTopU - ah / 2;
  const th = 110, ty = 80 + th / 2;
  for (const g of [-1, 1]) {
    k.part(`AL${g}`, "Top rail, long", [lr, ah, rt], [0, ay, g * zr], wood);
    k.part(`AS${g}`, "Top rail, short", [rt, ah, sr], [g * xr, ay, 0], wood);
    k.part(`BL${g}`, "Lower rail, long", [lr, th, rt], [0, ty, g * zr], wood);
    k.part(`BS${g}`, "Lower rail, short", [rt, th, sr], [g * xr, ty, 0], wood);
  }
  // a ledge strip along the inside of each lower long rail carries the shelf
  const lt = 16, lh = 20, ly = 80 + 24 - 6 - lh / 2, lz = zr - rt / 2 - lt / 2;
  for (const g of [-1, 1]) k.part(`LD${g}`, "Ledge strip", [lr - 40, lh, lt], [0, ly, g * lz], wood);
  k.part("SH", "Shelf", [lr - 4, 12, 2 * (zr - rt / 2) - 4], [0, 80 + 24, 0], wood);
  const apron = ["AL-1", "AL1", "AS-1", "AS1"], tray = ["BL-1", "BL1", "BS-1", "BS1"], ledges = ["LD-1", "LD1"];
  k.step({ title: "Screw the ledge strips onto the lower rails", detail: "Lay the frames out on a rug. One strip along the inside of each long rail, four screws each.", tools: ["screwdriver"], scene: "frames", warnings: ["floor"], kind: "screws" }, () => {
    k.stage(apron, [0, -ay + ah / 2, -D * 0.7], [0, 160, 0]);
    k.stage(tray, [0, -ty + th / 2, D * 0.7], [0, 160, 0]);
    k.stage(ledges, [0, -ty + th / 2, D * 0.7], [0, 200, 0]);
    for (const g of [-1, 1])
      k.fit(RAIL_SCREW, spread(-lr / 2 + 80, lr / 2 - 80, 4).map((x): Vec3 => [x, ly, g * (lz - lt / 2)]), [0, 0, g], { on: `LD${g}`, mate: `BL${g}`, gap: 0.08 });
  });
  k.step({ title: "Screw the cam bolts into the lower frame", detail: "One at each corner, by hand until it stops.", tools: ["screwdriver"], scene: "frames", kind: "cams" }, () =>
    k.fit(C_BOLT, legs.map((l): Vec3 => [l.gx * (xr), ty, l.gz * (zl - 5)]), [-1, 0, 0], { on: "BS-1" }),
  );
  k.step({ title: "Screw the threaded rods into the top frame", detail: "One in each corner, about halfway.", scene: "frames", kind: "bolts" }, () =>
    k.fit(ROD, legs.map((l): Vec3 => [l.x, ay, l.z]), [0, 1, 0], { on: "AS-1", hole: false }),
  );
  k.step({ title: "Turn the top frame over and fit two legs", detail: "Two dowels in the top of each leg, then set the legs on the rods at one end.", tools: ["hammer"], pose: "-y", warnings: ["floor"], kind: "dowels" }, () => {
    k.add(apron, [0, 0, 0]);
    k.add(legs.filter((l) => l.gx < 0).map((l) => l.id), [0, -300, 0]);
    k.fit(DOWEL, legs.filter((l) => l.gx < 0).flatMap((l): Vec3[] => [[l.x, yTopU, l.z - 10], [l.x, yTopU, l.z + 10]]).slice(0, 4), [0, 1, 0], { on: "AL-1" });
  });
  const brPts = (gx: number) => legs.filter((l) => l.gx === gx).map((l): Vec3 => [l.x - l.gx * 40, ay, l.z - l.gz * 40]);
  k.step({ title: "Fix the corner brackets with nuts", detail: "Over each rod, then tighten the nut with the spanner.", tools: ["wrench"], pose: "-y", kind: "bolts" }, () => {
    k.fit(CORNER, brPts(-1), [0, 1, 0], { on: "AL-1", hole: false });
    k.fit(NUT, brPts(-1), [0, 1, 0], { on: "AL-1", hole: false });
  });
  k.step({ title: "Fit the other two legs", detail: "Two dowels in each, onto the rods at the other end.", tools: ["hammer"], pose: "-y", kind: "dowels" }, () => {
    k.add(legs.filter((l) => l.gx > 0).map((l) => l.id), [0, -300, 0]);
    k.fit(DOWEL, legs.filter((l) => l.gx > 0).flatMap((l): Vec3[] => [[l.x, yTopU, l.z - 10], [l.x, yTopU, l.z + 10]]), [0, 1, 0], { on: "AL1" });
  });
  k.step({ title: "Push the cam locks into the first two legs", detail: "Arrow towards where the bolt will come.", tools: ["screwdriver"], pose: "-y", kind: "cams" }, () =>
    k.fit(CAM, legs.filter((l) => l.gx < 0).map((l): Vec3 => [l.x, ty, l.z]), [0, 0, 1], { on: legs[0].id }),
  );
  k.step({ title: "Lower the lower frame onto the legs", detail: "Its cam bolts go into the legs.", pose: "-y", kind: "join" }, () => k.add([...tray, ...ledges], [0, -260, 0]));
  k.step({ title: "Fix the other two brackets", detail: "Over the rods, nuts tightened with the spanner.", tools: ["wrench"], pose: "-y", kind: "bolts" }, () => {
    k.fit(CORNER, brPts(1), [0, 1, 0], { on: "AL1", hole: false });
    k.fit(NUT, brPts(1), [0, 1, 0], { on: "AL1", hole: false });
  });
  k.step({ title: "Lock the lower frame", detail: "Two more cam locks in the other legs, then turn all four clockwise.", tools: ["screwdriver"], pose: "-y", kind: "cams" }, () =>
    k.fit(CAM, legs.filter((l) => l.gx > 0).map((l): Vec3 => [l.x, ty, l.z]), [0, 0, 1], { on: legs[3].id }),
  );
  k.step({ title: "Tap the dowels into the top frame", detail: "Two dowels into the long rail edges, for the table top.", tools: ["hammer"], pose: "-y", kind: "dowels" }, () =>
    k.fit(DOWEL, [-1, 1].map((g): Vec3 => [g * W * 0.2, yTopU, zr]), [0, 1, 0], { on: "AL1", mate: "TOP" }),
  );
  k.step({ title: "Set the frame on the table top", detail: "Lay the top face down on a rug and lower the frame onto it, upside down, onto the dowels.", pose: "-y", warnings: ["face"], kind: "join" }, () => k.add(["TOP"], [0, 300, 0]));
  k.step({ title: "Screw the frame to the top", detail: "Ten screws through the top rails into the top.", tools: ["screwdriver"], pose: "-y", kind: "screws" }, () => {
    const pts = [-1, 1].flatMap((g) => spread(-lr / 2 + 80, lr / 2 - 80, 4).map((x): Vec3 => [x, ay, g * zr]));
    pts.push([-xr, ay, 0], [xr, ay, 0]);
    k.fit(TOP_SCREW, pts.map((p): Vec3 => [p[0], yTopU - 20, p[2]]), [0, 1, 0], { on: "TOP" });
  });
  k.step({ title: "Screw in the shelf stops", detail: "Two in the end of the lower frame, so the shelf can't slide out.", tools: ["screwdriver"], pose: "-y", kind: "screws" }, () =>
    k.fit(SHELF_STOP, [-1, 1].map((g): Vec3 => [xr, 80 + 24, g * 60]), [-1, 0, 0], { on: "BS1" }),
  );
  k.step({ title: "Turn it the right way up", detail: "Lift it over, don't roll it on its legs.", pose: "+y", kind: "standup" });
  k.step({ title: "Slide in the shelf", detail: "From the open end, along the ledges in the lower frame.", kind: "shelves" }, () => k.add(["SH"], [-W, 0, 0]));
}

const family: Family = {
  names: ["HAVSTA"],
  build(b, s) {
    const gd = guideOf(s);
    if (!gd) return false;
    const k = new Kit(b);
    switch (gd.kind) {
      case "open":
      case "doors":
      case "glass":
      case "slide":
        buildTall(k, gd);
        return true;
      case "low":
        buildLow(k, gd);
        return true;
      case "sideboard":
        buildSideboard(k, gd);
        return true;
      case "tv":
        buildTv(k, gd);
        return true;
      case "chest":
        buildChest(k, gd);
        return true;
      case "console":
        buildConsole(k, gd);
        return true;
    }
  },
};
export default family;
