import type { Family } from "./family";
import type { PartMaterial, PartPiece, ProductSpec, StepKind, ToolId, Vec3, WarnId, Pose } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { carcassA, carcassParts, drawerParts, drawerSteps, drawersIn, slotsOf, stepper, type Unit } from "./alex";

/*
 * LAGKAPTEN desks, read from the manuals of what each top stands on (the top itself comes ready drilled).
 *   ADILS and OLOV legs: a round plate screwed under the upside-down top with five screws, the leg screwed into it.
 *   KRILLE: a castor screwed into each leg with the spanner, the leg's own plate screwed under the top.
 *   SPÄND legs: two legs joined by two crossbars on threaded rods and barrel nuts, feet in, a plate bolted on each
 *   leg and screwed under the top. SPÄND storage: two U frames joined by the top tray, screwed up into the top,
 *   the bottom tray hooked in once the desk stands.
 *   MITTBACK trestles: built upside down: a post plate with two posts, the rail over them, the legs bolted to the
 *   rail with wing nuts, shelf, foot caps; the post plate is screwed under the top and the trestle set over it.
 *   ALEX drawer units: built exactly as the ALEX manual (and alex.ts) builds them, the carcass on its back, the
 *   drawers on their fronts; the top (with any legs) is set on them and screwed up through the ALEX top with four
 *   screws each; then the drawers go in and get their stop screws.
 * The 200 cm desks have one ADILS leg in the middle at the back. The L-shaped desk is two tops on four ADILS each.
 */

type Leg = "adils" | "olov" | "krille" | "spand";
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, b: number, n: number) => (n === 1 ? [(a + b) / 2] : range(n).map((i) => a + ((b - a) * i) / (n - 1)));
const TT = 28; // LAGKAPTEN top

const SCREW_TOP: HwDef = { kind: "screw", len: 20, dia: 4 };
const PLATE: HwDef = { kind: "plate", len: 4, dia: 90 };
const ALLEN: HwDef = { kind: "bolt", len: 60, dia: 6 };

interface StepIn {
  title: string;
  detail?: string;
  tools?: ToolId[];
  people?: 1 | 2;
  pose?: Pose;
  warnings?: WarnId[];
  kind?: StepKind;
  repeat?: number;
}

/** Parts placed where they end up, then steps that bring them in and fit the hardware. */
class Kit {
  private keys = new Map<string, string>();
  private boxes = new Map<string, { pos: Vec3; size: Vec3 }>();
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
    this.keys.set(id, this.b.place(t, pos, o.rot ?? [0, 0, 0]));
    this.boxes.set(id, { pos, size });
  }
  key(id: string) {
    const k = this.keys.get(id);
    if (!k) throw new Error(`LAGKAPTEN: no part ${id}`);
    return k;
  }
  has(id: string) {
    return this.keys.has(id);
  }
  lo(id: string, a: number) {
    const b = this.boxes.get(id)!;
    return b.pos[a] - b.size[a] / 2;
  }
  hi(id: string, a: number) {
    const b = this.boxes.get(id)!;
    return b.pos[a] + b.size[a] / 2;
  }
  pos(id: string) {
    return this.boxes.get(id)!.pos;
  }

  step(s: StepIn, body: () => void) {
    if (s.pose) this.pose = s.pose;
    const warnings = new Set<WarnId>(s.warnings ?? []);
    if (s.people === 2) warnings.add("two");
    this.b.step({ title: s.title, detail: s.detail, tools: s.tools ?? [], people: s.people ?? 1, pose: this.pose, warnings: [...warnings].slice(0, 3), kind: s.kind ?? "general", repeat: s.repeat }, body);
  }
  add(ids: string[], from?: Vec3 | ((id: string) => Vec3 | undefined), spin?: number) {
    this.b.stagger(ids.length > 4 ? 0.14 : 0.24);
    for (const id of ids) this.b.add(this.key(id), typeof from === "function" ? from(id) : from, spin ? { spin } : {});
    this.b.then(0.12);
  }
  /** Shown upside down somewhere else until it is added: turned half a turn about the depth axis around (cx, cy), moved dz. */
  stageFlipped(ids: string[], cx: number, cy: number, dz: number) {
    this.b.stagger(0.12);
    for (const id of ids) {
      const p = this.pos(id);
      this.b.stage(this.key(id), [2 * cx - p[0], 2 * cy - p[1], p[2] + dz], [0, 0, Math.PI]);
    }
    this.b.then(0.12);
  }
  /** Shown standing somewhere else (on the floor beside the desk) until it is added. */
  stageAt(ids: string[], at: (id: string) => Vec3) {
    this.b.stagger(0.12);
    for (const id of ids) this.b.stage(this.key(id), at(id), [0, 0, 0]);
    this.b.then(0.12);
  }
  fit(def: HwDef, pts: Vec3[], dir: Vec3 | ((p: Vec3, i: number) => Vec3), on?: string | ((p: Vec3, i: number) => string), o: { mate?: string; hole?: false; spin?: number } = {}) {
    if (!pts.length) return;
    this.b.stagger(0.05);
    this.b.fits(
      def,
      pts.map((at, i) => ({
        at,
        dir: typeof dir === "function" ? dir(at, i) : dir,
        on: on ? this.key(typeof on === "function" ? on(at, i) : on) : undefined,
        mate: o.mate ? this.key(o.mate) : undefined,
        hole: o.hole,
        spin: o.spin,
      })),
      Math.min(0.07, 2.4 / Math.max(1, pts.length)),
    );
    this.b.then(0.1);
  }
}

/* ---------- the top ---------- */

function topPart(k: Kit, id: string, w: number, d: number, at: Vec3, H: number, name = "Table top") {
  k.part(id, name, [w, TT, d], [at[0], H - TT / 2, at[2]]);
}

/* ---------- legs that screw under the top ---------- */

interface LegAt {
  id: string;
  x: number;
  z: number;
  top: string;
}

function legParts(k: Kit, kind: Leg, legs: LegAt[], H: number) {
  const yTop = H - TT;
  for (const l of legs) {
    if (kind === "adils") k.part(l.id, "Leg", [34, yTop - 4, 34], [l.x, (yTop - 4) / 2, l.z], { shape: "cyl", mat: "metal" });
    else if (kind === "olov") {
      const h = yTop - 4;
      k.part(l.id, "Adjustable leg", [40, h, 40], [l.x, h / 2, l.z], {
        mat: "metal",
        pieces: [
          { shape: "cyl", size: [40, h * 0.62, 40], pos: [0, h * 0.19, 0] },
          { shape: "cyl", size: [32, h * 0.4, 32], pos: [0, -h * 0.3, 0] },
        ],
      });
    } else if (kind === "krille") {
      const h = yTop - 62; // over the castor
      k.part(l.id, "Leg", [90, h, 90], [l.x, 62 + h / 2, l.z], {
        mat: "metal",
        pieces: [
          { shape: "cyl", size: [90, 5, 90], pos: [0, h / 2 - 2.5, 0] },
          { shape: "cyl", size: [10, h, 10], pos: [-14, 0, 0], rot: [0, 0, -0.035] },
          { shape: "cyl", size: [10, h, 10], pos: [14, 0, 0], rot: [0, 0, 0.035] },
          { shape: "cyl", size: [22, 40, 22], pos: [0, -h / 2 + 20, 0] },
        ],
      });
    }
  }
}

/** Plate and five screws under the top for each ADILS or OLOV leg, then the legs screwed in. */
function plateLegSteps(k: Kit, kind: Leg, legs: LegAt[], H: number, o: { first?: boolean } = {}) {
  const yTop = H - TT;
  const n = legs.length;
  k.step(
    {
      title: n === 1 ? "Screw the leg plate under the top" : "Screw the leg plates under the top",
      detail: "Centre each plate on the pre-drilled holes, five screws each. The top must be at least 25 mm thick for these screws.",
      tools: ["screwdriver"],
      pose: "-y",
      warnings: o.first ? ["floor"] : [],
      kind: "screws",
    },
    () => {
      for (const l of legs) {
        k.fit(PLATE, [[l.x, yTop, l.z]], [0, 1, 0], l.top, { hole: false });
        const pts = [[l.x, yTop, l.z] as Vec3, ...range(4).map((i) => [l.x + 34 * Math.cos((i * Math.PI) / 2 + Math.PI / 4), yTop, l.z + 34 * Math.sin((i * Math.PI) / 2 + Math.PI / 4)] as Vec3)];
        k.fit(SCREW_TOP, pts, [0, 1, 0], l.top);
      }
    },
  );
  k.step(
    {
      title: n === 1 ? "Screw the leg into its plate" : "Screw the legs into the plates",
      detail: kind === "olov" ? "Turn each leg in by hand until it stops. You can set the height later." : "Turn each leg in by hand until it stops.",
      kind: "legs",
    },
    () => k.add(legs.map((l) => l.id), [0, -260, 0], 2),
  );
}

function krilleSteps(k: Kit, legs: LegAt[], H: number) {
  const yTop = H - TT;
  k.step(
    { title: "Screw a castor into each leg", detail: "Turn the castor's stem into the bottom of the leg and tighten it with the spanner. Then stand the legs on the top.", tools: ["wrench"], kind: "legs" },
    () => {
      k.add(legs.map((l) => l.id), [0, -260, 0]);
      for (const l of legs) k.fit({ kind: "castor", len: 58, dia: 50 }, [[l.x, 62, l.z]], [0, 1, 0], l.id, { spin: 3 });
    },
  );
  k.step({ title: "Screw the legs to the top", detail: "Five screws through each leg's plate into the pre-drilled holes.", tools: ["screwdriver"], kind: "screws" }, () => {
    for (const l of legs) k.fit(SCREW_TOP, [[l.x, yTop - 5, l.z] as Vec3, ...range(4).map((i) => [l.x + 32 * Math.cos((i * Math.PI) / 2 + Math.PI / 4), yTop - 5, l.z + 32 * Math.sin((i * Math.PI) / 2 + Math.PI / 4)] as Vec3)], [0, 1, 0], l.id, { mate: l.top });
  });
}

function turnOver(k: Kit, kind: Leg | "mixed", extra = "") {
  const detail =
    kind === "olov"
      ? "Lift it onto its legs, don't drag it. Twist the lower part of each leg to set the height, then lock it."
      : kind === "krille"
        ? "Lift it onto its castors. Press the castor brakes down where you want it to stay."
        : "Lift it onto its legs, don't drag it. Turn the feet to stop it rocking.";
  k.step({ title: "Turn the desk over together", detail: detail + extra, people: 2, pose: "+y", kind: "standup" }, () => {});
}

/* ---------- SPÄND: a pair of legs with crossbars, and the leg with storage ---------- */

function spandPair(k: Kit, p: string, x: number, D: number, H: number) {
  const yTop = H - TT;
  const zl = D / 2 - 50;
  const h = yTop - 6;
  for (const s of [-1, 1]) k.part(`${p}L${s}`, "Leg", [30, h - 20, 30], [x, 20 + (h - 20) / 2, s * zl], { shape: "cyl", mat: "metal" });
  for (const [i, y] of [[0, yTop - 90], [1, 160]] as const) k.part(`${p}C${i}`, "Crossbar", [20, 2 * zl - 30, 20], [x, y, 0], { shape: "cyl", mat: "metal", rot: [Math.PI / 2, 0, 0] });
  for (const s of [-1, 1]) k.part(`${p}P${s}`, "Leg plate", [100, 6, 100], [x, yTop - 3, s * zl], { shape: "cyl", mat: "metal" });
}

function spandPairSteps(k: Kit, pairs: { p: string; x: number }[], D: number, H: number) {
  const yTop = H - TT;
  const zl = D / 2 - 50;
  const ids = (f: (p: string) => string[]) => pairs.flatMap((q) => f(q.p));
  k.step(
    { title: pairs.length > 1 ? "Join the crossbars to the legs" : "Join the crossbars to the legs", detail: "A threaded rod in each crossbar end, a barrel nut in the leg's hole. Turn them in with the Allen key, but don't tighten yet.", tools: ["allen"], kind: "join" },
    () => {
      k.add(ids((p) => [`${p}L-1`, `${p}L1`, `${p}C0`, `${p}C1`]), [0, -200, 0]);
      for (const q of pairs)
        for (const y of [yTop - 90, 160])
          for (const s of [-1, 1]) {
            k.fit({ kind: "stud", len: 40, dia: 6, name: "Threaded rod" }, [[q.x, y, s * (zl - 15)]], [0, 0, s], `${q.p}C${y > 500 ? 0 : 1}`);
            k.fit({ kind: "nut", len: 12, dia: 10, name: "Barrel nut" }, [[q.x - 15, y, s * zl]], [1, 0, 0], `${q.p}L${s}`);
          }
    },
  );
  k.step({ title: "Screw in the feet", detail: "One in the bottom of each leg, by hand.", kind: "legs" }, () => {
    for (const q of pairs) k.fit({ kind: "foot", len: 20, dia: 30 }, [-1, 1].map((s) => [q.x, 20, s * zl] as Vec3), [0, 1, 0], (_p, i) => `${q.p}L${i ? 1 : -1}`, { spin: 2 });
  });
  k.step({ title: "Bolt a plate onto each leg", detail: "Two bolts through each plate into the top of the leg, with the Allen key.", tools: ["allen"], kind: "bolts" }, () => {
    k.add(ids((p) => [`${p}P-1`, `${p}P1`]), [0, -120, 0]);
    for (const q of pairs) for (const s of [-1, 1]) k.fit({ kind: "bolt", len: 12, dia: 6 }, [[q.x - 10, yTop - 6, s * zl], [q.x + 10, yTop - 6, s * zl]], [0, 1, 0], `${q.p}P${s}`, { mate: `${q.p}L${s}` });
  });
  k.step({ title: "Screw the plates under the top", detail: "Stand the legs on the upside-down top and put five screws through each plate.", tools: ["screwdriver"], kind: "screws" }, () => {
    for (const q of pairs)
      for (const s of [-1, 1])
        k.fit(SCREW_TOP, [[q.x, yTop - 6, s * zl] as Vec3, ...range(4).map((i) => [q.x + 38 * Math.cos((i * Math.PI) / 2 + Math.PI / 4), yTop - 6, s * zl + 38 * Math.sin((i * Math.PI) / 2 + Math.PI / 4)] as Vec3)], [0, 1, 0], `${q.p}P${s}`, { mate: "TOP" });
  });
  k.step({ title: "Tighten the crossbars", detail: "Now that the legs stand square, tighten all four rods with the Allen key.", tools: ["allen"], kind: "bolts" }, () => {});
}

function spandStorage(k: Kit, p: string, x: number, D: number, H: number) {
  const yTop = H - TT;
  const w = 340, d = D - 80;
  const h = yTop - 20;
  const zl = d / 2 - 12;
  for (const s of [-1, 1]) {
    // one U frame: two legs and the bar over them, front to back
    k.part(`${p}U${s}`, "Side frame", [22, h, d], [x + s * (w / 2 - 11), 20 + h / 2, 0], {
      mat: "metal",
      pieces: [
        { shape: "cyl", size: [22, h, 22], pos: [0, 0, -zl] },
        { shape: "cyl", size: [22, h, 22], pos: [0, 0, zl] },
        { shape: "cyl", size: [22, 2 * zl, 22], pos: [0, h / 2 - 11, 0], rot: [Math.PI / 2, 0, 0] },
      ],
    });
  }
  const tray = (id: string, y: number) =>
    k.part(id, "Wire tray", [w - 22, 24, d - 20], [x, y, 0], {
      mat: "metal",
      pieces: [
        { shape: "box", size: [w - 22, 24, 6], pos: [0, 0, -(d - 20) / 2 + 3] },
        { shape: "box", size: [w - 22, 24, 6], pos: [0, 0, (d - 20) / 2 - 3] },
        { shape: "box", size: [6, 24, d - 20], pos: [-(w - 22) / 2 + 3, 0, 0] },
        { shape: "box", size: [6, 24, d - 20], pos: [(w - 22) / 2 - 3, 0, 0] },
        ...range(7).map((i) => ({ shape: "box" as const, size: [w - 34, 3, 3] as Vec3, pos: [0, -10, -(d - 40) / 2 + ((d - 40) * i) / 6] as Vec3 })),
      ],
    });
  tray(`${p}T`, yTop - 14);
  tray(`${p}B`, 180);
}

function spandStorageSteps(k: Kit, units: { p: string; x: number }[], D: number, H: number) {
  const yTop = H - TT;
  const w = 340, d = D - 80, zl = d / 2 - 12;
  k.step({ title: "Screw the feet into the legs", detail: "One in the bottom of each of the four legs, by hand.", kind: "legs" }, () => {
    k.add(units.flatMap((u) => [`${u.p}U-1`, `${u.p}U1`]), [0, -200, 0]);
    for (const u of units) for (const s of [-1, 1]) k.fit({ kind: "foot", len: 20, dia: 30 }, [-1, 1].map((t) => [u.x + s * (w / 2 - 11), 20, t * zl] as Vec3), [0, 1, 0], `${u.p}U${s}`, { spin: 2 });
  });
  const rods = (u: { p: string; x: number }, s: number) => {
    for (const t of [-1, 1]) {
      k.fit({ kind: "stud", len: 40, dia: 6, name: "Threaded rod" }, [[u.x + s * (w / 2 - 22), yTop - 14, t * (zl - 30)]], [s, 0, 0], `${u.p}T`);
      k.fit({ kind: "nut", len: 12, dia: 10, name: "Barrel nut" }, [[u.x + s * (w / 2 - 11), yTop - 30, t * (zl - 30)]], [0, 1, 0], `${u.p}U${s}`);
    }
  };
  k.step({ title: "Join the top tray to one frame", detail: "Two threaded rods and barrel nuts, loosely, with the Allen key.", tools: ["allen"], kind: "join" }, () => {
    k.add(units.map((u) => `${u.p}T`), [0, -150, 0]);
    for (const u of units) rods(u, -1);
  });
  k.step({ title: "Join the other frame", detail: "The same way, two more rods and nuts.", tools: ["allen"], kind: "join" }, () => {
    for (const u of units) rods(u, 1);
  });
  k.step({ title: "Screw it up into the top", detail: "Stand it on the upside-down top and put four screws through the tray's corners.", tools: ["allen"], kind: "screws" }, () => {
    for (const u of units) k.fit({ kind: "screw", len: 35, dia: 5 }, [-1, 1].flatMap((s) => [-1, 1].map((t) => [u.x + s * (w / 2 - 40), yTop - 26, t * (zl - 40)] as Vec3)), [0, 1, 0], `${u.p}T`, { mate: "TOP" });
  });
  k.step({ title: "Tighten the rods", detail: "All four, firmly, now that it sits square.", tools: ["allen"], kind: "bolts" }, () => {});
}

function spandStorageBottom(k: Kit, units: { p: string; x: number }[], D: number) {
  const w = 340, d = D - 80, zl = d / 2 - 12;
  k.step({ title: "Hook in the bottom tray", detail: "Its hooks drop over the frames low down, four in all. Push down until they click.", kind: "shelves" }, () => {
    k.add(units.map((u) => `${u.p}B`), [0, 160, 0]);
    for (const u of units) k.fit({ kind: "clip", len: 12, dia: 10 }, [-1, 1].flatMap((s) => [-1, 1].map((t) => [u.x + s * (w / 2 - 22), 186, t * (zl - 30)] as Vec3)), [0, -1, 0], `${u.p}B`, { hole: false });
  });
}

/* ---------- MITTBACK trestles ---------- */

function trestle(k: Kit, p: string, x: number, D: number, H: number) {
  const yTop = H - TT;
  const zp = D / 2 - 150;
  k.part(`${p}PL`, "Post plate", [80, 18, D - 120], [x, yTop - 9, 0], { mat: "wood" });
  for (const s of [-1, 1]) k.part(`${p}PO${s}`, "Post", [28, 300, 44], [x, yTop - 18 - 150, s * zp], { mat: "wood", pieces: [{ shape: "box", size: [28, 300, 44], pos: [0, 0, 0] }, ...range(6).map((i) => ({ shape: "cyl" as const, size: [12, 30, 12] as Vec3, pos: [0, -120 + i * 45, 0] as Vec3, rot: [0, 0, Math.PI / 2] as Vec3, material: "metal" as const }))] });
  const yr = yTop - 230;
  k.part(`${p}R`, "Rail", [40, 40, D - 80], [x, yr, 0], { mat: "wood" });
  // the legs splay out left and right from the rail ends, front and back
  const top = yr - 10, foot = 0;
  const reach = 230;
  const len = Math.hypot(top - foot, reach - 40);
  const ang = Math.atan2(reach - 40, top - foot);
  const zl = D / 2 - 70;
  for (const t of [-1, 1]) for (const s of [-1, 1]) k.part(`${p}G${t}${s}`, "Leg", [40, len, 24], [x + s * (40 + reach) / 2, (top + foot) / 2, t * zl], { mat: "wood", rot: [0, 0, s * ang] });
  const ys = 200;
  const sw = 2 * (40 + ((reach - 40) * (top - ys)) / (top - foot)) - 40;
  // its two battens reach front to back, their ends against the legs' inner edges
  k.part(`${p}S`, "Shelf", [sw, 20, 2 * zl], [x, ys, 0], {
    mat: "wood",
    pieces: [
      { shape: "box", size: [20, 20, 2 * zl], pos: [-sw / 2 + 10, 0, 0] },
      { shape: "box", size: [20, 20, 2 * zl], pos: [sw / 2 - 10, 0, 0] },
      ...range(5).map((i) => ({ shape: "box" as const, size: [sw - 40, 14, 50] as Vec3, pos: [0, 3, -(2 * zl - 120) / 2 + ((2 * zl - 120) * i) / 4] as Vec3 })),
    ],
  });
}

function trestleSteps(k: Kit, ts: { p: string; x: number }[], D: number, H: number) {
  const yTop = H - TT;
  const zp = D / 2 - 150, zl = D / 2 - 70, yr = yTop - 230, reach = 230;
  const all = (f: (p: string) => string[]) => ts.flatMap((t) => f(t.p));
  k.step({ title: "Screw the posts onto the post plate", detail: "Upside down on a rug: two Allen screws up through the plate into each post. Use these screws, not the short ones.", tools: ["allen"], pose: "-y", warnings: ["floor"], kind: "bolts" }, () => {
    k.add(all((p) => [`${p}PL`, `${p}PO-1`, `${p}PO1`]), [0, -200, 0]);
    for (const t of ts) for (const s of [-1, 1]) k.fit(ALLEN, [[t.x, yTop, s * zp - 12], [t.x, yTop, s * zp + 12]], [0, -1, 0], `${t.p}PL`, { mate: `${t.p}PO${s}` });
  });
  k.step({ title: "Slide the rail over the posts", detail: "Its holes go over both posts until it rests on the plate.", kind: "join" }, () => k.add(all((p) => [`${p}R`]), [0, -260, 0]));
  k.step({ title: "Bolt the legs to the rail", detail: "Two legs at each end. A long bolt goes through both legs and the rail, with a washer and a wing nut on the other side.", tools: [], kind: "bolts" }, () => {
    k.add(all((p) => [`${p}G-1-1`, `${p}G-11`, `${p}G1-1`, `${p}G11`]), (id) => [0, -220, 0].map((v, i) => (i === 0 ? (id.endsWith("-1") ? -120 : 120) : v)) as Vec3);
    for (const t of ts)
      for (const z of [-zl, zl]) {
        k.fit({ kind: "bolt", len: 120, dia: 8, name: "Carriage bolt" }, [[t.x - 60, yr, z]], [1, 0, 0], `${t.p}G${z < 0 ? -1 : 1}-1`, { mate: `${t.p}R` });
        k.fit({ kind: "washer", len: 2, dia: 18 }, [[t.x + 60, yr, z]], [-1, 0, 0], `${t.p}G${z < 0 ? -1 : 1}1`, { hole: false });
        k.fit({ kind: "nut", len: 10, dia: 30, name: "Wing nut" }, [[t.x + 62, yr, z]], [-1, 0, 0], `${t.p}G${z < 0 ? -1 : 1}1`, { hole: false, spin: 2 });
      }
  });
  k.step({ title: "Drop the shelf in between the legs", detail: "Slats up, its ends against the legs.", kind: "shelves" }, () => k.add(all((p) => [`${p}S`]), [0, -260, 0]));
  k.step({ title: "Screw the legs to the shelf", detail: "One Allen screw through each leg into the shelf end.", tools: ["allen"], kind: "bolts" }, () => {
    for (const t of ts) {
      const sw = k.hi(`${t.p}S`, 0) - k.lo(`${t.p}S`, 0);
      for (const z of [-zl + 6, zl - 6]) for (const s of [-1, 1]) k.fit(ALLEN, [[t.x + (s * sw) / 2 + s * 10, 200, z]], [-s, 0, 0], `${t.p}G${z < 0 ? -1 : 1}${s}`, { mate: `${t.p}S` });
    }
  });
  k.step({ title: "Tap the caps onto the feet", detail: "One on the end of each leg, with a hammer.", tools: ["hammer"], kind: "legs" }, () => {
    for (const t of ts) for (const z of [-zl, zl]) for (const s of [-1, 1]) k.fit({ kind: "cap", len: 8, dia: 30, name: "Foot cap" }, [[t.x + s * reach, 4, z]], [0, 1, 0], `${t.p}G${z < 0 ? -1 : 1}${s}`, { hole: false });
  });
  k.step({ title: "Lift the trestle off its posts", detail: "Loosen the wing nuts and pull the post plate out of the rail. The posts go on the top first.", kind: "general" }, () => {});
  k.step({ title: "Screw the post plates under the top", detail: "Lay the top upside down on the rug, each plate across one end, four short screws in each.", tools: ["screwdriver"], kind: "screws" }, () => {
    k.add(["TOP"], [0, -300, 0]);
    for (const t of ts) k.fit({ kind: "screw", len: 16, dia: 4 }, [-zp + 70, -zp + 110, zp - 110, zp - 70].map((z) => [t.x, yTop - 18, z] as Vec3), [0, 1, 0], `${t.p}PL`, { mate: "TOP" });
  });
  k.step({ title: "Set the trestles back over the posts", detail: "Slide each rail down over its posts to the height you want.", kind: "join" }, () => {});
  k.step({ title: "Tighten the wing nuts and turn it over together", detail: "Both nuts on each trestle, by hand. Then lift the desk onto its feet.", people: 2, pose: "+y", kind: "standup" }, () => {});
}

/* ---------- ALEX drawer units, built as alex.ts builds them ---------- */

const AW = 360, AD = 580;
type Carcass = ReturnType<typeof carcassParts>;
type Stepper = ReturnType<typeof stepper>;

/**
 * The builder seen from a drawer unit standing at `off`: the ALEX code draws a unit centred on x = z = 0, so places
 * and fittings are moved over. With `preset` its fittings are already in place and its parts just arrive, for the
 * second unit built "the same way".
 */
function shifted(b: PlanBuilder, off: Vec3, preset = false): PlanBuilder {
  const mv = (o: FitOpts): FitOpts => ({ ...o, at: [o.at[0] + off[0], o.at[1] + off[1], o.at[2] + off[2]] });
  const over: Record<string, unknown> = {
    place: (ref: string, pos: Vec3, rot?: Vec3) => b.place(ref, [pos[0] + off[0], pos[1] + off[1], pos[2] + off[2]], rot),
    fit: (def: HwDef, o: FitOpts) => (preset ? b.preset(def, mv(o)) : b.fit(def, mv(o))),
    fits: (def: HwDef, list: FitOpts[], gap?: number) => (preset ? list.map((o) => b.preset(def, mv(o))) : b.fits(def, list.map(mv), gap)),
    preset: (def: HwDef, o: FitOpts) => b.preset(def, mv(o)),
  };
  if (preset) {
    over.stage = () => {};
    over.add = (key: string) => b.add(key, [0, 400, 0]);
  }
  return new Proxy(b, {
    get(t, p) {
      if (typeof p === "string" && p in over) return over[p];
      const v = Reflect.get(t, p);
      return typeof v === "function" ? v.bind(t) : v;
    },
  });
}

interface AlexAt {
  cx: number;
  cz: number;
  c: Carcass;
}

/** The ALEX 5-drawer unit's own layout, at the height that leaves room for the top. */
function alexUnit(Ha: number): Unit {
  const inner = Ha - 2 * 15;
  const sh = 115;
  return { W: AW, D: AD, Hc: Ha, y0: 0, slots: ["shallow", "shallow", "deep", "deep", "deep"], pitch: { shallow: sh, deep: (inner - 2 * sh) / 3 } };
}

/** The top with any legs built upside down on the rug, set on the drawer units and screwed up through their tops. */
function alexTopSteps(b: PlanBuilder, st: Stepper, k: Kit, units: AlexAt[], legs: LegAt[], H: number) {
  const yTop = H - TT;
  const top = k.key("TOP");
  const topY = H - TT / 2;
  // the scene is turned by its pose, so the parts are staged the right way up
  const rel = (id: string): Vec3 => {
    const p = k.pos(id);
    return [p[0], p[1] - topY, p[2]];
  };
  const legIds = legs.map((l) => l.id);
  if (legs.length) {
    st({ title: legs.length > 1 ? "Screw the leg plates under the top" : "Screw the leg plate under the top", detail: "Lay the top upside down on a rug. Centre each plate on its pre-drilled holes, five screws each.", tools: ["screwdriver"], pose: "-y", warnings: ["floor"], kind: "screws", scene: "top" }, () => {
      b.stage(top, [0, 0, 0], [0, 0, 0], [0, -160, 0]);
      b.then(0.15);
      for (const l of legs) {
        k.fit(PLATE, [[l.x, yTop, l.z]], [0, 1, 0], "TOP", { hole: false });
        k.fit(SCREW_TOP, [[l.x, yTop, l.z] as Vec3, ...range(4).map((i) => [l.x + 34 * Math.cos((i * Math.PI) / 2 + Math.PI / 4), yTop, l.z + 34 * Math.sin((i * Math.PI) / 2 + Math.PI / 4)] as Vec3)], [0, 1, 0], "TOP");
      }
    });
    st({ title: legs.length > 1 ? "Screw the legs into the plates" : "Screw the leg into its plate", detail: "By hand, until it stops.", pose: "-y", kind: "legs", scene: "top" }, () => {
      b.stagger(0.2);
      for (const id of legIds) b.stage(k.key(id), rel(id), [0, 0, 0], [0, -260, 0]);
    });
  }
  st(
    {
      title: legs.length ? "Turn the top over and set it on the drawer unit together" : units.length > 1 ? "Lay the top on the drawer units together" : "Lay the top on the drawer unit together",
      detail: "Line it up with the back and the outer edge of the drawer unit. The drawers stay out for now.",
      people: 2,
      pose: "+y",
      kind: "join",
    },
    () => k.add(["TOP", ...legIds], [0, 220, 0]),
  );
  st({ title: "Screw up through the drawer unit into the top", detail: `Four screws through the holes in the top of ${units.length > 1 ? "each drawer unit" : "the drawer unit"}, with the Allen key, reaching in where the drawers go.`, tools: ["allen"], kind: "screws" }, () => {
    b.fits(
      { kind: "screw", len: 30, dia: 5 },
      units.flatMap((u) => [-1, 1].flatMap((s) => [-1, 1].map((t): FitOpts => ({ on: u.c.top, at: [u.cx + s * (AW / 2 - 60), u.c.yTop, u.cz + t * (AD / 2 - 80)], dir: [0, 1, 0], mate: top })))),
      0.08,
    );
  });
}

/** Drawer units on the left (and right) of the desk, built from the ALEX manual, then the top on them. */
function alexDesk(b: PlanBuilder, k: Kit, W: number, D: number, H: number) {
  const Ha = H - TT;
  const cz = D / 2 - AD / 2 - 16;
  const two = W >= 1400;
  const xs = two ? [-1, 1].map((sx) => sx * (W / 2 - AW / 2)) : [-W / 2 + AW / 2];
  topPart(k, "TOP", W, D, [0, 0, 0], H);
  const legs: LegAt[] = two ? (W >= 1800 ? [{ id: "M", x: 0, z: -D / 2 + 60, top: "TOP" }] : []) : [-1, 1].map((sz) => ({ id: `L${sz}`, x: W / 2 - 60, z: sz * (D / 2 - 60), top: "TOP" }));
  legParts(k, "adils", legs, H);

  const g = alexUnit(Ha);
  const units: AlexAt[] = xs.map((cx) => ({ cx, cz, c: carcassParts(shifted(b, [cx, 0, cz]), g) }));
  const ds = units.flatMap((u) => drawerParts(b, slotsOf(g).map((s) => ({ ...s, cx: s.cx + u.cx, zf: s.zf + u.cz, zb: s.zb + u.cz })), false));
  const st = stepper(b);
  carcassA(shifted(b, [units[0].cx, 0, cz]), st, units[0].c, "glides");
  for (const u of units.slice(1)) {
    st({ title: "Build the second drawer unit the same way", detail: "Back and sides on cam locks, the top and bottom on cam locks, glides under the bottom, then stand it up.", tools: ["screwdriver", "hammer"], pose: "+y", kind: "drawer" }, () => {
      carcassA(shifted(b, [u.cx, 0, cz], true), (_s, body) => body(), u.c, "glides");
    });
  }
  drawerSteps(b, st, ds, "deep", {});
  drawerSteps(b, st, ds, "shallow", {});
  alexTopSteps(b, st, k, units, legs, H);
  drawersIn(b, st, ds, ["deep", "shallow"]);
}

/* ---------- which desk ---------- */

function build(b: PlanBuilder, s: ProductSpec) {
  const slug = s.slug ?? "";
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const k = new Kit(b);
  const inset = 60;
  const corners = (top: string, w: number, d: number, cx: number, cz: number, p: string): LegAt[] =>
    [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ id: `${p}${sx}${sz}`, x: cx + sx * (w / 2 - inset), z: cz + sz * (d / 2 - inset), top })));

  if (/^lagkapten-(adils|olov|krille)-desk/.test(slug)) {
    const kind: Leg = slug.includes("olov") ? "olov" : slug.includes("krille") ? "krille" : "adils";
    topPart(k, "TOP", W, D, [0, 0, 0], H);
    const legs = corners("TOP", W, D, 0, 0, "L");
    legParts(k, kind, legs, H);
    k.step({ title: "Lay the top upside down on a rug", detail: "The rug keeps the top surface from scratching.", pose: "-y", warnings: ["floor"], kind: "general" }, () => k.add(["TOP"], [0, -300, 0]));
    if (kind === "krille") krilleSteps(k, legs, H);
    else plateLegSteps(k, kind, legs, H);
    turnOver(k, kind);
    return true;
  }
  if (/^lagkapten-linnmon-l-shaped/.test(slug)) {
    // the long side along the back is the LINNMON top, the other one runs forward on the left
    const dep = 600, longW = W - dep;
    const A = { w: dep, d: D, cx: -W / 2 + dep / 2, cz: 0 };
    const B = { w: longW, d: dep, cx: -W / 2 + dep + longW / 2, cz: -D / 2 + dep / 2 };
    topPart(k, "TOP", A.w, A.d, [A.cx, 0, A.cz], H, "Table top");
    topPart(k, "TOP2", B.w, B.d, [B.cx, 0, B.cz], H, "Second table top");
    const la = corners("TOP", A.w, A.d, A.cx, A.cz, "A");
    const lb = corners("TOP2", B.w, B.d, B.cx, B.cz, "B");
    legParts(k, "adils", [...la, ...lb], H);
    k.step({ title: "Lay both tops upside down on a rug", detail: "Side by side in the L they will make, so you can check the legs line up.", pose: "-y", warnings: ["floor"], kind: "general" }, () => k.add(["TOP", "TOP2"], [0, -300, 0]));
    plateLegSteps(k, "adils", la, H);
    k.step({ title: "Do the same on the second top", detail: "Four plates, twenty screws, four legs.", tools: ["screwdriver"], kind: "legs" }, () => {
      const yTop = H - TT;
      for (const l of lb) {
        k.fit(PLATE, [[l.x, yTop, l.z]], [0, 1, 0], l.top, { hole: false });
        k.fit(SCREW_TOP, [[l.x, yTop, l.z] as Vec3, ...range(4).map((i) => [l.x + 34 * Math.cos((i * Math.PI) / 2 + Math.PI / 4), yTop, l.z + 34 * Math.sin((i * Math.PI) / 2 + Math.PI / 4)] as Vec3)], [0, 1, 0], l.top);
      }
      k.add(lb.map((l) => l.id), [0, -260, 0], 2);
    });
    turnOver(k, "adils", " Then push the two tops together into an L.");
    return true;
  }
  if (/^lagkapten-mittback/.test(slug)) {
    topPart(k, "TOP", W, D, [0, 0, 0], H);
    const ts = [-1, 1].map((sx) => ({ p: `T${sx}`, x: sx * (W / 2 - 330) }));
    for (const t of ts) trestle(k, t.p, t.x, D, H);
    trestleSteps(k, ts, D, H);
    return true;
  }
  if (/^lagkapten-spand/.test(slug)) {
    topPart(k, "TOP", W, D, [0, 0, 0], H);
    const big = W >= 1800;
    const storage = slug.includes("120") ? [{ p: "S0", x: -W / 2 + 190 }] : big ? [-1, 1].map((sx) => ({ p: `S${sx}`, x: sx * (W / 2 - 190) })) : [];
    const pairs = storage.length === 0 ? [-1, 1].map((sx) => ({ p: `P${sx}`, x: sx * (W / 2 - 60) })) : storage.length === 1 ? [{ p: "P1", x: W / 2 - 60 }] : [];
    for (const u of storage) spandStorage(k, u.p, u.x, D, H);
    for (const q of pairs) spandPair(k, q.p, q.x, D, H);
    const mid: LegAt[] = big ? [{ id: "M", x: 0, z: -D / 2 + inset, top: "TOP" }] : [];
    legParts(k, "adils", mid, H);
    k.step({ title: "Lay the top upside down on a rug", detail: "The rug keeps the top surface from scratching.", pose: "-y", warnings: ["floor"], kind: "general" }, () => k.add(["TOP"], [0, -300, 0]));
    if (storage.length) spandStorageSteps(k, storage, D, H);
    if (pairs.length) spandPairSteps(k, pairs, D, H);
    if (mid.length) plateLegSteps(k, "adils", mid, H);
    turnOver(k, "mixed");
    if (storage.length) spandStorageBottom(k, storage, D);
    return true;
  }
  if (/^lagkapten-alex/.test(slug)) {
    alexDesk(b, k, W, D, H);
    return true;
  }
  return false;
}

const family: Family = {
  names: ["LAGKAPTEN"],
  build,
};
export default family;
