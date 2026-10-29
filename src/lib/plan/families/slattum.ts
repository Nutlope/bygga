import type { Family } from "./family";
import type { PartMaterial, PartPiece, ProductSpec, StepKind, ToolId, Vec3, WarnId, Pose } from "../../types";
import type { HwDef, PlanBuilder } from "../builder";

/*
 * SLATTUM, read from its two manuals (single and twin; double, queen and wider). Each side rail is a steel tube
 * with its corner leg welded on. The headboard lies on its back on the floor, a rail is pushed onto each bottom
 * corner and bolted through the leg; the footboard is done the same way, lying on its front. The crossbar is
 * bolted onto its two middle legs, then two people lower it onto the headboard's rails, stand the head end up and
 * push the foot end's rails into the crossbar's sleeves. Four bolts lock the rails (their slat holders on top),
 * the four upholstered side panels are bolted on from inside, the leg bolts are tightened. The wide beds also
 * have a centre beam in three parts on two legs, hung on bolts in the head and foot boards, and a spacer tube
 * under the middle of the crossbar. The slats roll out last and tuck under the holders.
 * IKEA's sizes: 4 cm wider than the mattress, about 6 cm longer; headboard 85 cm, footboard 40 cm.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const BOLT_L: HwDef = { kind: "bolt", len: 70, dia: 6 };
const BOLT: HwDef = { kind: "bolt", len: 50, dia: 6 };
const BOLT_M: HwDef = { kind: "bolt", len: 35, dia: 6 };
const BOLT_S: HwDef = { kind: "bolt", len: 15, dia: 6 };
const HOLDER: HwDef = { kind: "cap", len: 18, dia: 22, name: "Slat holder" };
const SPACER: HwDef = { kind: "spacer", len: 25, dia: 25, name: "Spacer tube" };

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
}

/** Parts placed where they end up; steps bring them in, in the main scene or shown on their own in another. */
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
  has(id: string) {
    return this.keys.has(id);
  }
  key(id: string) {
    const k = this.keys.get(id);
    if (!k) throw new Error(`SLATTUM: no part ${id}`);
    return k;
  }
  step(s: StepIn, body: () => void) {
    const side = !!s.scene && s.scene !== "main";
    if (s.pose && !side) this.pose = s.pose;
    const warnings = new Set<WarnId>(s.warnings ?? []);
    if (s.people === 2) warnings.add("two");
    this.b.step({ title: s.title, detail: s.detail, tools: s.tools ?? [], people: s.people ?? 1, pose: side ? (s.pose ?? "+y") : this.pose, warnings: [...warnings].slice(0, 3), kind: s.kind ?? "general", scene: s.scene, check: s.check }, body);
  }
  add(ids: string[], from?: Vec3 | ((id: string) => Vec3)) {
    this.b.stagger(ids.length > 4 ? 0.14 : 0.24);
    for (const id of ids) this.b.add(this.key(id), typeof from === "function" ? from(id) : from);
    this.b.then(0.12);
  }
  /** Shown in this step's own scene where it will end up, until it is added to the bed. */
  stage(ids: string[], from?: Vec3) {
    this.b.stagger(ids.length > 4 ? 0.14 : 0.24);
    for (const id of ids) {
      const p = this.boxes.get(id)!;
      this.b.stage(this.key(id), p.pos, p.rot, from);
    }
    this.b.then(0.12);
  }
  fit(def: HwDef, pts: Vec3[], dir: Vec3 | ((p: Vec3) => Vec3), on?: string | ((p: Vec3) => string), o: { mate?: string | ((p: Vec3) => string); hole?: false } = {}) {
    if (!pts.length) return;
    const id = (f: string | ((p: Vec3) => string) | undefined, p: Vec3) => (f === undefined ? undefined : this.key(typeof f === "function" ? f(p) : f));
    this.b.stagger(0.05);
    this.b.fits(def, pts.map((at) => ({ at, dir: typeof dir === "function" ? dir(at) : dir, on: id(on, at), mate: id(o.mate, at), hole: o.hole })), Math.min(0.07, 2.4 / Math.max(1, pts.length)));
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

function build(b: PlanBuilder, s: ProductSpec) {
  if (!/^slattum-upholstered-bed-frame/.test(s.slug ?? "")) return false;
  const mt = mattress(s);
  if (!mt) return false;
  const [mw, ml] = mt;
  const wide = mw >= 1200; // the double manual: centre beam, two slat rolls
  const W = mw + 40, L = ml + (ml > 200 ? 50 : 60);
  const k = new Kit(b);

  const T = 70; // head and foot boards
  const yb = 180; // their undersides
  const zi0 = -L / 2 + T, zi1 = L / 2 - T, Li = zi1 - zi0;
  const xr = W / 2 - 55; // rails and legs
  const yr = 300; // rail centre
  const S = 30; // rail tube
  const yMid = yr - S - SPACER.len; // the crossbar's lowered middle, a spacer's length under the centre beam

  k.part("HB", "Headboard", [W, 850 - yb, T], [0, (850 + yb) / 2, -L / 2 + T / 2], { mat: "soft" });
  k.part("FB", "Footboard", [W, 400 - yb, T], [0, (400 + yb) / 2, L / 2 - T / 2], { mat: "soft" });

  // a rail and its corner leg, welded in one piece; the foot ones are the same part turned round
  const railLen = -12 - zi0;
  const legZ = -railLen / 2 + 14;
  const railPieces: PartPiece[] = [
    { shape: "box", size: [S, S, railLen], pos: [0, yr - (yr + S / 2) / 2, 0] },
    { shape: "cyl", size: [25, yr - S / 2, 25], pos: [0, (yr - S / 2) / 2 - (yr + S / 2) / 2, legZ] },
  ];
  const railSize: Vec3 = [S, yr + S / 2, railLen];
  for (const sx of [-1, 1]) {
    k.part(`RH${sx}`, "Side rail with leg", railSize, [sx * xr, (yr + S / 2) / 2, zi0 + railLen / 2], { mat: "metal", pieces: railPieces });
    k.part(`RF${sx}`, "Side rail with leg", railSize, [sx * xr, (yr + S / 2) / 2, zi1 - railLen / 2], { mat: "metal", pieces: railPieces, rot: [0, Math.PI, 0] });
  }

  // the crossbar: sleeves for the rails at its ends, its middle bent down under the slats
  const ends = 110, drop = yr - yMid, run = 100;
  const xm = xr - 20 - ends - run; // half the lowered middle
  const yc = (yr + yMid) / 2;
  const slope = Math.hypot(run, drop), ang = Math.atan2(drop, run);
  const crossPieces: PartPiece[] = [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [40, 40, 120], pos: [sx * xr, yr - yc, 0] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [ends, S, S], pos: [sx * (xr - 20 - ends / 2), yr - yc, 0] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [slope, S, S], pos: [sx * (xm + run / 2), (yr + yMid) / 2 - yc, 0], rot: [0, 0, sx * ang] })),
    { shape: "box", size: [2 * xm, S, S], pos: [0, yMid - yc, 0] },
  ];
  k.part("X", "Crossbar", [2 * xr + 40, yr - yMid + 40, 120], [0, yc, 0], { mat: "metal", pieces: crossPieces });
  const legH = yr - 20;
  for (const sx of [-1, 1])
    k.part(`XL${sx}`, "Leg with bracket", [25, legH, 40], [sx * xr, legH / 2, 0], {
      mat: "metal",
      pieces: [
        { shape: "cyl", size: [25, legH, 25], pos: [0, 0, 0] },
        { shape: "box", size: [30, 50, 3], pos: [0, legH / 2 - 25, 14] },
      ],
    });

  // four upholstered side panels, two each side
  const ph = 390 - yb;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.part(`P${sx}${sz}`, "Side panel", [40, ph, Li / 2 - 4], [sx * (W / 2 - 20), yb + ph / 2, sz * (Li / 4)], { mat: "soft" });

  // the wide beds' centre beam: two end pieces with hanging plates and a middle piece on two legs
  const zj = Li * 0.2;
  const yTop = yr + S / 2;
  if (wide) {
    const endLen = Li / 2 - zj;
    const endPieces: PartPiece[] = [
      { shape: "box", size: [S, S, endLen], pos: [0, 0, 0] },
      { shape: "box", size: [60, 100, 4], pos: [0, 10, -endLen / 2 + 2] },
    ];
    k.part("CA", "Centre beam end", [60, 100, endLen], [0, yr, zi0 + endLen / 2], { mat: "metal", pieces: endPieces });
    k.part("CC", "Centre beam end", [60, 100, endLen], [0, yr, zi1 - endLen / 2], { mat: "metal", pieces: endPieces, rot: [0, Math.PI, 0] });
    k.part("CB", "Centre beam middle", [S, S, 2 * zj], [0, yr, 0], { mat: "metal" });
    for (const sz of [-1, 1]) k.part(`CL${sz}`, "Leg", [25, yr - S / 2, 25], [0, (yr - S / 2) / 2, sz * (zj - 70)], { shape: "cyl", mat: "metal" });
  }

  // slats on the rails (and the centre beam)
  const rollLen = Li - 20;
  const rolls = wide ? [-1, 1].map((sx) => ({ id: `S${sx}`, x: (sx * xr) / 2, w: xr - 20 })) : [{ id: "S0", x: 0, w: 2 * xr }];
  for (const r of rolls) k.part(r.id, "Slatted bed base", [r.w, 16, rollLen], [r.x, yTop + 8, 0], { mat: "wood", pieces: slatRoll(r.w, rollLen) });

  const sides = [-1, 1];
  const legBolts = (z: number, dz: number, rail: (sx: number) => string, mate: string) => {
    k.fit(BOLT, sides.flatMap((sx) => [200, 250].map((y) => [sx * xr, y, z] as Vec3)), [0, 0, dz], (p) => rail(Math.sign(p[0])), { mate });
  };

  k.step(
    { title: "Push the rails onto the headboard", detail: "Lay the headboard on its back on a rug. Each rail's leg lies along the bottom edge; push the rail down onto the corner until the holes line up.", pose: "+z", warnings: ["floor"], kind: "join" },
    () => {
      k.add(["HB"], [0, 0, 300]);
      k.add(["RH-1", "RH1"], [0, 0, 500]);
    },
  );
  k.step({ title: "Bolt the legs to the headboard", detail: "Two bolts through each leg. Turn them in until the heads sit flat, but don't tighten them yet.", tools: ["allen"], kind: "bolts" }, () =>
    legBolts(zi0 + 26, -1, (sx) => `RH${sx}`, "HB"),
  );
  k.step({ title: "Push the rails onto the footboard", detail: "Lay the footboard on its front on the rug and fit the other two rails the same way.", pose: "-z", scene: "foot", warnings: ["floor"], kind: "join" }, () => {
    k.stage(["FB"], [0, 0, -300]);
    k.stage(["RF-1", "RF1"], [0, 0, -500]);
  });
  k.step({ title: "Bolt the legs to the footboard", detail: "Two bolts through each leg, heads flat, not tight yet.", tools: ["allen"], pose: "-z", scene: "foot", kind: "bolts" }, () =>
    legBolts(zi1 - 26, 1, (sx) => `RF${sx}`, "FB"),
  );
  k.step({ title: "Bolt the legs onto the crossbar", detail: "One long bolt down through each end of the crossbar into the top of its leg. The bend in the crossbar points down.", tools: ["allen"], scene: "beam", kind: "legs" }, () => {
    k.stage(["X"], [0, 200, 0]);
    k.stage(["XL-1", "XL1"], [0, -200, 0]);
    k.fit(BOLT_L, sides.map((sx) => [sx * xr, yr + 20, 0] as Vec3), [0, -1, 0], "X", { mate: (p) => `XL${Math.sign(p[0])}` });
  });
  k.step(
    { title: "Lower the crossbar onto the head end's rails", detail: "Together, one at each end. The sleeves slide down over the rails until the spring pins click into their holes. Keep your fingers clear.", pose: "+z", people: 2, warnings: ["hand"], kind: "join" },
    () => k.add(["X", "XL-1", "XL1"], [0, 0, 500]),
  );
  k.step(
    { title: "Stand it up and push in the foot end", detail: "Lift the head end onto its legs together. Then push the foot end's rails into the crossbar's sleeves until the pins click.", pose: "+y", people: 2, warnings: ["hand"], kind: "join" },
    () => k.add(["FB", "RF-1", "RF1"], [0, 0, 500]),
  );
  const zh = [zi0 + 60, zi1 - 60];
  k.step({ title: "Bolt the slat holders onto the rails", detail: "Up through each rail near the head and the foot, a holder on top of each bolt.", tools: ["allen"], kind: "bolts" }, () => {
    const pts = sides.flatMap((sx) => zh.map((z) => [sx * xr, yr - S / 2, z] as Vec3));
    const rail = (p: Vec3) => `${p[2] < 0 ? "RH" : "RF"}${Math.sign(p[0])}`;
    k.fit(BOLT_M, pts, [0, 1, 0], rail);
    k.fit(HOLDER, pts.map((p) => [p[0], yTop, p[2]] as Vec3), [0, -1, 0], rail, { hole: false });
  });

  const panelFrom = (id: string): Vec3 => [id.startsWith("P-1") ? -300 : 300, 0, 0];
  const panelBolts = (sz: number) => {
    const zs = [0.2, 0.5, 0.8].map((f) => sz * (Li / 2) * f);
    k.fit(BOLT, sides.flatMap((sx) => zs.map((z) => [sx * (xr - S / 2), yr, z] as Vec3)), (p) => [Math.sign(p[0]), 0, 0], (p) => `${sz < 0 ? "RH" : "RF"}${Math.sign(p[0])}`, { mate: (p) => `P${Math.sign(p[0])}${sz}` });
  };
  const endBolts = (z: number, sz: number) => {
    k.fit(BOLT_S, sides.flatMap((sx) => [yb + 50, yb + ph - 50].map((y) => [sx * (W / 2 - 40), y, z] as Vec3)), (p) => [Math.sign(p[0]), 0, 0], (p) => `P${Math.sign(p[0])}${sz}`);
  };
  k.step({ title: "Hold the head end side panels against the rails", detail: "One each side, between the headboard and the crossbar, padded face out.", kind: "join" }, () => k.add(["P-1-1", "P1-1"], panelFrom));
  k.step({ title: "Bolt them on from inside", detail: "Three bolts through each rail into its panel.", tools: ["allen"], kind: "bolts" }, () => panelBolts(-1));
  k.step({ title: "Bolt the panels to the headboard", detail: "Two short bolts through the bracket at the head end of each panel.", tools: ["allen"], kind: "bolts" }, () => endBolts(zi0 + 12, -1));
  k.step({ title: "Hold the foot end side panels in place", detail: "The same way, between the crossbar and the footboard.", kind: "join" }, () => k.add(["P-11", "P11"], panelFrom));
  k.step({ title: "Bolt them on from inside", detail: "Three bolts through each rail into its panel.", tools: ["allen"], kind: "bolts" }, () => panelBolts(1));
  k.step({ title: "Bolt the panels to the footboard", detail: "Two short bolts at the foot end of each panel.", tools: ["allen"], kind: "bolts" }, () => endBolts(zi1 - 12, 1));
  k.step({ title: "Tighten the leg bolts", detail: "All eight bolts through the corner legs, firmly, now that the frame stands square.", tools: ["allen"], check: "square", kind: "bolts" }, () => {});

  if (wide) {
    k.step({ title: "Turn a bolt into the headboard and the footboard", detail: "One in the middle of each, on the inside. Leave it standing out so the centre beam can hang on it.", tools: ["allen"], kind: "bolts" }, () => {
      k.fit(BOLT_S, [[0, yr + 30, zi0]], [0, 0, -1], "HB");
      k.fit(BOLT_S, [[0, yr + 30, zi1]], [0, 0, 1], "FB");
    });
    k.step({ title: "Push the centre beam together", detail: "The two end pieces slide into the middle piece until the spring pins click. Keep your fingers clear.", scene: "centre", warnings: ["hand"], kind: "join" }, () => {
      k.stage(["CB"]);
      k.stage(["CA"], [0, 0, -300]);
      k.stage(["CC"], [0, 0, 300]);
    });
    k.step({ title: "Bolt the slat holders onto its ends", detail: "Two bolts up through each end, a holder on each.", tools: ["allen"], scene: "centre", kind: "bolts" }, () => {
      const pts = [zi0 + 60, zi1 - 60].flatMap((z) => [-16, 16].map((x) => [x, yr - S / 2, z] as Vec3));
      const end = (p: Vec3) => (p[2] < 0 ? "CA" : "CC");
      k.fit(BOLT, pts, [0, 1, 0], end);
      k.fit(HOLDER, pts.map((p) => [p[0], yTop, p[2]] as Vec3), [0, -1, 0], end, { hole: false });
    });
    k.step({ title: "Bolt the two legs under the centre beam", detail: "One bolt down through the beam into each leg.", tools: ["allen"], scene: "centre", kind: "legs" }, () => {
      k.stage(["CL-1", "CL1"], [0, -200, 0]);
      k.fit(BOLT, [-1, 1].map((sz) => [0, yTop, sz * (zj - 70)] as Vec3), [0, -1, 0], "CB", { mate: (p) => `CL${Math.sign(p[2])}` });
    });
    k.step({ title: "Hang the centre beam on the bolts", detail: "Drop the slot in each end plate over the bolt in the headboard and the footboard.", kind: "join" }, () => k.add(["CA", "CB", "CC", "CL-1", "CL1"], [0, 300, 0]));
    k.step({ title: "Bolt the end plates on", detail: "One more short bolt through each plate, then tighten the bolts it hangs on.", tools: ["allen"], kind: "bolts" }, () => {
      k.fit(BOLT_S, [[0, yr - 25, zi0 + 4]], [0, 0, -1], "CA", { mate: "HB" });
      k.fit(BOLT_S, [[0, yr - 25, zi1 - 4]], [0, 0, 1], "CC", { mate: "FB" });
    });
    k.step({ title: "Fit the spacer under the centre beam", detail: "Stand the tube on the middle of the crossbar under the beam and bolt up through both from below.", tools: ["allen"], kind: "bolts" }, () => {
      k.fit(SPACER, [[0, yMid + S / 2, 0]], [0, 1, 0], "X", { hole: false });
      k.fit(BOLT_L, [[0, yMid - S / 2, 0]], [0, 1, 0], "X", { mate: "CB" });
    });
  }
  k.step(
    { title: "Roll out the slats", detail: wide ? "One roll each side of the centre beam, curved side up. Tuck the end slats under the eight holders." : "Curved side up. Tuck the end slats under the four holders.", kind: "slats" },
    () => k.add(rolls.map((r) => r.id), [0, 200, -600]),
  );
  return true;
}

const family: Family = {
  names: ["SLATTUM"],
  build,
};
export default family;
