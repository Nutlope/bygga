import type { Family } from "./family";
import type { PartMaterial, PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { HwDef, PlanBuilder } from "../builder";

/*
 * TÄLLÅSEN, read from its manual (one for the double and the queen). The headboard lies on a rug: two bent posts
 * are bolted into the ends of the top tube that carries the panel, the padded bottom board is screwed onto the
 * posts' plates, the panel is folded over the top tube, two stiffeners slide into it and four long bolts hold its
 * bottom edge 10 mm off the board. The footboard is screwed onto its two legs the same way. Two bolts go into each
 * leg plate for the rails to hang on, and a bracket for the centre beam into the middle of each board. Each side
 * rail lies on its back: a steel batten is bolted along it (at the height that suits the mattress) and a keyhole
 * bracket screwed to each end. Two people stand the headboard up and hang a rail on it, the footboard on that, then
 * the other rail; the rail bolts are tightened, a cross support is bolted under the battens, the centre beam (its
 * small holders on) drops into its brackets, the slat holders clip on, the cover goes over the headboard and is
 * tucked in, and the slats (sold separately) roll out.
 * IKEA's sizes: double 149 x 203 cm, queen 167 x 215 cm; headboard 107 cm, footboard 38 cm, 20 cm free under it.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const BOLT_S: HwDef = { kind: "bolt", len: 12, dia: 6 };
const CSK: HwDef = { kind: "bolt", len: 16, dia: 6, name: "Countersunk bolt" };
const RAIL_BOLT: HwDef = { kind: "bolt", len: 14, dia: 8, name: "Rail bolt" };
const LONG: HwDef = { kind: "bolt", len: 60, dia: 6 };
const HOLDER: HwDef = { kind: "clamp", len: 30, dia: 24, name: "Slat holder" };
const HOLDER_S: HwDef = { kind: "clamp", len: 24, dia: 20, name: "Small slat holder" };
const BRACKET: HwDef = { kind: "bracket", len: 80, dia: 50, name: "Centre beam bracket" };

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

/** Bounding box of some pieces, and the pieces moved so the box is centred on 0. */
function shape(pieces: PartPiece[]): { size: Vec3; mid: Vec3; pieces: PartPiece[] } {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces) {
    const a = p.rot?.[2] ?? 0; // pieces here only turn about z
    const e: Vec3 = [Math.abs(Math.cos(a)) * p.size[0] + Math.abs(Math.sin(a)) * p.size[1], Math.abs(Math.sin(a)) * p.size[0] + Math.abs(Math.cos(a)) * p.size[1], p.size[2]];
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], p.pos[i] - e[i] / 2);
      hi[i] = Math.max(hi[i], p.pos[i] + e[i] / 2);
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

  /** A part drawn from pieces given where they sit in the bed. */
  welded(id: string, name: string, abs: PartPiece[], mat: PartMaterial = "metal", extra?: boolean) {
    const sh = shape(abs);
    this.put(id, name, sh.size, sh.mid, { mat, pieces: sh.pieces, extra });
  }
  box(id: string, name: string, size: Vec3, pos: Vec3, mat: PartMaterial) {
    this.put(id, name, size, pos, { mat });
  }
  private put(id: string, name: string, size: Vec3, pos: Vec3, o: { mat: PartMaterial; pieces?: PartPiece[]; extra?: boolean }) {
    const tk = [name, size.map(Math.round).join("x"), o.mat, o.pieces ? JSON.stringify(o.pieces) : ""].join("|");
    let t = this.types.get(tk);
    if (!t) {
      t = this.b.part(name, size, { material: o.mat, extra: o.extra });
      if (o.pieces) this.b.parts[this.b.parts.length - 1].pieces = o.pieces;
      this.types.set(tk, t);
    }
    this.keys.set(id, this.b.place(t, pos));
    this.boxes.set(id, { pos, rot: [0, 0, 0] });
  }
  key(id: string) {
    const k = this.keys.get(id);
    if (!k) throw new Error(`TÄLLÅSEN: no part ${id}`);
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
  /** Shown in a step's own scene, where it will end up or moved by `at` (a right-hand rail laid beside the left one). */
  stage(ids: string[], from?: Vec3, at?: (pos: Vec3, rot: Vec3) => { pos: Vec3; rot: Vec3 }) {
    this.b.stagger(0.2);
    for (const id of ids) {
      const p = this.boxes.get(id)!;
      const q = at ? at(p.pos, p.rot) : p;
      this.b.stage(this.key(id), q.pos, q.rot, from);
    }
    this.b.then(0.12);
  }
  fit(def: HwDef, pts: Vec3[], dir: Vec3 | ((p: Vec3) => Vec3), on: string | ((p: Vec3) => string), o: { mate?: string | ((p: Vec3) => string); hole?: false } = {}) {
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

/** IKEA's outside sizes by mattress width (mm): width, length. */
const OUTSIDE: Record<number, [number, number]> = { 1350: [1490, 2030], 1520: [1670, 2150] };

const T = 25; // the legs' and posts' tubes

/** A post's rounded top corner as short straight pieces, from upright (angle 0) over to level. */
function corner(cx: number, cy: number, z: number, R: number, side: number): PartPiece[] {
  const n = 4, da = Math.PI / 2 / n;
  return range(n).map((i): PartPiece => {
    const m = da * (i + 0.5), rr = R * Math.cos(da / 2);
    return { shape: "cyl", size: [T, 2 * R * Math.sin(da / 2) + 5, T], pos: [cx + side * rr * Math.cos(m), cy + rr * Math.sin(m), z], rot: [0, 0, side * m] };
  });
}

/** One roll of slats on two tapes, lying along the bed. */
function slatRoll(w: number, len: number, x: number, y: number, z: number): PartPiece[] {
  const n = Math.max(8, Math.round(len / 110));
  const pitch = (len - 63) / (n - 1);
  return [
    ...range(n).map((i): PartPiece => ({ shape: "box", size: [w, 10, 63], pos: [x, y + 3, z - len / 2 + 31.5 + i * pitch] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [24, 4, len], pos: [x + sx * (w / 2 - 70), y - 4, z], material: "fiber" })),
  ];
}

function build(b: PlanBuilder, s: ProductSpec) {
  if (!/^tallasen-upholstered-bed-frame/.test(s.slug ?? "")) return false;
  const mt = mattress(s);
  if (!mt) return false;
  const [mw, ml] = mt;
  const withMattress = /mattress/.test(s.slug ?? "");
  const [W, L] = OUTSIDE[mw] ?? [mw + 140, ml + 130];
  const H = 1070, y0 = 200, y1 = 380; // headboard, the boards' bottom and top edges
  const yc = (y0 + y1) / 2, bh = y1 - y0;
  const R = 90;
  const xL = W / 2 - T / 2, zH = -L / 2 + T / 2, zF = L / 2 - T / 2;
  const sides = [-1, 1];
  const k = new Kit(b);

  // the top tube with the panel hanging from it, and the panel's bottom bar
  const tubeY = H - T / 2;
  const stub = 30;
  const tubeHalf = xL - R - stub;
  const pw = 2 * (xL - 32);
  const yp0 = y1 + 12; // the panel's bottom edge, 10 mm off the board
  k.welded("TT", "Top tube with panel", [
    { shape: "cyl", size: [T, 2 * tubeHalf, T], pos: [0, tubeY, zH], rot: [0, 0, Math.PI / 2] },
    { shape: "box", size: [pw, tubeY - yp0 - 30, 6], pos: [0, (tubeY + yp0 + 30) / 2, zH + 14], material: "soft" },
    { shape: "box", size: [pw, 30, 24], pos: [0, yp0 + 15, zH + 6], material: "wood" },
  ]);

  // the bent posts: upright, rounded over at the top into a stub that goes into the top tube; a plate for the boards and rails
  const plate = (x: number, z: number): PartPiece => ({ shape: "box", size: [62, 170, 4], pos: [x, yc, z] });
  const footCap = (x: number, z: number): PartPiece => ({ shape: "cyl", size: [32, 12, 32], pos: [x, 6, z], material: "soft" });
  const postTop = tubeY - R;
  for (const sx of sides)
    k.welded(`P${sx}`, "Post", [
      { shape: "cyl", size: [T, postTop - 12, T], pos: [sx * xL, (postTop + 12) / 2, zH] },
      ...corner(sx * (xL - R), postTop, zH, R, sx),
      { shape: "cyl", size: [T, stub, T], pos: [sx * (xL - R - stub / 2), tubeY, zH], rot: [0, 0, Math.PI / 2] },
      footCap(sx * xL, zH),
      plate(sx * (xL - 31), zH + T / 2 + 2),
    ]);
  const zPlateH = zH + T / 2 + 4;

  // the padded boards between the legs
  const boardW = 2 * (xL - T / 2);
  k.box("HB", "Headboard bottom board", [boardW, bh, 32], [0, yc, zH - 3.5], "soft");
  k.box("FB", "Footboard", [boardW, bh, 32], [0, yc, zF + 3.5], "soft");
  for (const sx of sides) k.box(`ST${sx}`, "Stiffener", [xL - 60, 30, 8], [(sx * (xL - 30)) / 2, yp0 + 70, zH + 6], "wood");

  // the foot legs, each with its plate
  for (const sx of sides) k.welded(`FL${sx}`, "Foot leg", [{ shape: "cyl", size: [T, y1 - 12, T], pos: [sx * xL, (y1 + 12) / 2, zF] }, footCap(sx * xL, zF), plate(sx * (xL - 31), zF - T / 2 - 2)]);
  const zPlateF = zF - T / 2 - 4;

  // side rails: padded boards, a steel batten along each (low, for a mattress thicker than 18 cm), a keyhole bracket at each end
  const zr0 = zPlateH + 4, zr1 = zPlateF - 4, Lr = zr1 - zr0;
  const xr = xL - 7, xb = xL - 42, yBat = y0 + 50, yTop = yBat + 15;
  for (const sx of sides) {
    k.box(`R${sx}`, "Side rail", [40, bh, Lr], [sx * xr, yc, 0], "soft");
    k.box(`B${sx}`, "Slat batten", [30, 30, Lr - 40], [sx * xb, yBat, 0], "metal");
    k.box(`K${sx}H`, "Rail bracket", [54, 160, 4], [sx * (xL - 31), yc, zr0 - 2], "metal");
    k.box(`K${sx}F`, "Rail bracket", [54, 160, 4], [sx * (xL - 31), yc, zr1 + 2], "metal");
  }

  // the cross support under the middle, dipping down under the centre beam, and the centre beam
  const yBeam = yTop - 20, yDip = yBeam - 22;
  const run = xb + 10 - 110;
  const drop = yTop + 2 - yDip, slope = Math.hypot(70, drop), ang = Math.atan2(drop, 70);
  k.welded("X", "Cross support", [
    ...sides.map((sx): PartPiece => ({ shape: "box", size: [run, 4, 40], pos: [sx * (110 + run / 2), yTop + 2, 0] })),
    ...sides.map((sx): PartPiece => ({ shape: "box", size: [slope, 4, 40], pos: [sx * 75, (yTop + 2 + yDip) / 2, 0], rot: [0, 0, sx * ang] })),
    { shape: "box", size: [80, 4, 40], pos: [0, yDip, 0] },
  ]);
  const zb0 = zH + T / 2 + 10, zb1 = zF - T / 2 - 10;
  k.box("CB", "Centre beam", [40, 40, zb1 - zb0], [0, yBeam, (zb0 + zb1) / 2], "metal");

  // the headboard cover: five padded channels, pulled over the panel and tucked in at the bottom
  const ch = 5, cw = pw / ch;
  const cTop = H + 14, cBot = yp0 - 4;
  k.welded(
    "CV",
    "Headboard cover",
    range(ch).map((i): PartPiece => ({ shape: "box", size: [cw - 8, cTop - cBot, 58], pos: [-pw / 2 + cw * (i + 0.5), (cTop + cBot) / 2, zH + 8] })),
    "soft",
  );

  // the slats, sold separately: a roll each side of the centre beam
  const sw = xb + 10 - 8, sl = zr1 - zr0 - 40;
  for (const sx of sides) k.welded(`S${sx}`, "Slatted bed base", slatRoll(sw, sl, (sx * (xb + 10 + 8)) / 2, yTop + 8, 0), "wood", true);
  if (withMattress) k.box("M", "Mattress", [mw, 250, ml], [0, yTop + 18 + 125, 0], "soft");

  const post = (p: Vec3) => (p[0] < 0 ? "P-1" : "P1");
  const fleg = (p: Vec3) => (p[0] < 0 ? "FL-1" : "FL1");
  const plateX = (sx: number) => sx * (xL - 31);
  const plateY = [y0 + 40, y1 - 40];
  const plateYMid = [yc - 40, yc + 40];

  // 1 to 5: the headboard, lying on its back on a rug
  k.step(
    { title: "Bolt the posts into the top tube", detail: "Lay the panel on a rug. Push each post's bent end into the top tube, plates facing up, and fit one bolt at each joint. Tighten with the handle until it clicks.", pose: "+z", tools: ["allen"], warnings: ["floor"], kind: "bolts" },
    () => {
      k.add(["TT"], [0, 0, 300]);
      k.add(["P-1", "P1"], (id) => [id === "P1" ? 300 : -300, 0, 0]);
      k.fit(BOLT_S, sides.map((sx) => [sx * (tubeHalf - 12), tubeY, zH + T / 2] as Vec3), [0, 0, -1], "TT", { mate: (p) => post(p) });
    },
  );
  k.step({ title: "Screw the bottom board onto the posts", detail: "Lift it up under the plates and fit two countersunk bolts through each plate.", tools: ["allen"], kind: "bolts" }, () => {
    k.add(["HB"], [0, 0, -250]);
    k.fit(CSK, sides.flatMap((sx) => plateY.map((y) => [plateX(sx) + sx * 6, y, zPlateH] as Vec3)), [0, 0, -1], post, { mate: "HB" });
  });
  k.step({ title: "Fold the panel over the top tube", detail: "Wrap it round the tube so it hangs down between the posts, towards the bottom board.", kind: "general" }, () => {});
  k.step({ title: "Slide in the two stiffeners", detail: "One from each side, into the pocket along the panel's bottom edge.", kind: "join" }, () =>
    k.add(["ST-1", "ST1"], (id) => [id === "ST1" ? 500 : -500, 0, 0]),
  );
  k.step({ title: "Bolt the panel's bottom edge to the board", detail: "Four long bolts up through the board into the panel's bottom bar. Leave a 10 mm gap: the cover tucks in there later.", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(LONG, [-0.36, -0.12, 0.12, 0.36].map((f) => [f * pw, y1 - 4, zH + 4] as Vec3), [0, 1, 0], "HB", { mate: "TT" }),
  );

  // 6 to 10: the footboard, and the bolts the rails and the centre beam hang on
  k.step(
    { title: "Screw the legs onto the footboard", detail: "Lay the footboard on its front. Two countersunk bolts through each leg's plate.", pose: "-z", scene: "foot", tools: ["allen"], warnings: ["floor"], kind: "legs" },
    () => {
      k.stage(["FB"], [0, 0, 250]);
      k.stage(["FL-1", "FL1"], [0, 0, -250]);
      k.fit(CSK, sides.flatMap((sx) => plateY.map((y) => [plateX(sx) + sx * 6, y, zPlateF] as Vec3)), [0, 0, 1], fleg, { mate: "FB" });
    },
  );
  k.step({ title: "Turn the rail bolts into the leg plates", detail: "Two in each plate. Leave the heads standing a few millimetres out: the rails hang on them.", pose: "-z", scene: "foot", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(RAIL_BOLT, sides.flatMap((sx) => plateYMid.map((y) => [plateX(sx) - sx * 14, y, zPlateF] as Vec3)), [0, 0, 1], fleg, { hole: false }),
  );
  k.step({ title: "Do the same on the headboard's plates", detail: "Two bolts in each, heads standing out.", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(RAIL_BOLT, sides.flatMap((sx) => plateYMid.map((y) => [plateX(sx) - sx * 14, y, zPlateH] as Vec3)), [0, 0, -1], post, { hole: false }),
  );
  const brY = yBeam;
  k.step(
    { title: "Screw a centre beam bracket onto the bottom board", detail: "In the middle of its inside face, two bolts. Use the lower holes for a mattress thicker than 18 cm, the upper ones for a thinner one.", tools: ["allen"], kind: "bolts" },
    () => {
      k.fit(BRACKET, [[0, brY, zH + 12.5]], [0, 0, -1], "HB", { hole: false });
      k.fit(BOLT_S, sides.map((sx) => [sx * 28, brY + 10, zH + 16.5] as Vec3), [0, 0, -1], "HB");
    },
  );
  k.step({ title: "Screw the other bracket onto the footboard", detail: "The same holes as on the headboard, so the beam lies level.", pose: "-z", scene: "foot", tools: ["allen"], kind: "bolts" }, () => {
    k.fit(BRACKET, [[0, brY, zF - 12.5]], [0, 0, 1], "FB", { hole: false });
    k.fit(BOLT_S, sides.map((sx) => [sx * 28, brY + 10, zF - 16.5] as Vec3), [0, 0, 1], "FB");
  });

  // 11 to 13: the side rails, lying on their backs side by side
  const railParts = (sx: number) => [`R${sx}`, `B${sx}`];
  const beside = (pos: Vec3, rot: Vec3) => ({ pos: [-pos[0], pos[1] - 420, -pos[2]] as Vec3, rot: [rot[0], rot[1] + Math.PI, rot[2]] as Vec3 });
  const rail = (p: Vec3) => (p[0] < 0 ? "R-1" : "R1");
  const batten = (p: Vec3) => (p[0] < 0 ? "B-1" : "B1");
  const battenPts = (n: number, from: number, to: number) => sides.flatMap((sx) => range(n).map((i) => [sx * xr - sx * 20, yBat, from + ((to - from) * (i + 0.5)) / n] as Vec3));
  k.step(
    { title: "Lay a batten along each side rail", detail: "Inside face up. The low line of holes suits a mattress thicker than 18 cm, the high one a thinner one. One bolt through the end to hold it.", pose: "+x", scene: "rails", tools: ["allen"], warnings: ["floor"], kind: "bolts" },
    () => {
      k.stage(railParts(-1));
      k.stage(railParts(1), undefined, beside);
      k.fit(LONG, sides.map((sx) => [sx * (xb - 15), yBat, sx * (Lr / 2 - 60)] as Vec3), (p) => [Math.sign(p[0]), 0, 0], batten);
    },
  );
  k.step({ title: "Bolt the battens on", detail: "Five more long bolts along each one. They must go in straight.", pose: "+x", scene: "rails", tools: ["allen"], kind: "bolts" }, () =>
    k.fit(LONG, battenPts(5, -Lr / 2 + 200, Lr / 2 - 200).map((p) => [Math.sign(p[0]) * (xb - 15), p[1], p[2]] as Vec3), (p) => [Math.sign(p[0]), 0, 0], batten),
  );
  k.step({ title: "Screw a keyhole bracket onto each rail end", detail: "Two countersunk bolts in each, keyholes pointing down.", pose: "+x", scene: "rails", tools: ["allen"], kind: "bolts" }, () => {
    k.stage(["K-1H", "K-1F"]);
    k.stage(["K1H", "K1F"], undefined, beside);
    // where the bracket covers the rail end, so the bolts go into the rail
    const ends = sides.flatMap((sx) => [zr0, zr1].flatMap((z) => plateY.map((y) => [sx * (xL - 15), y, z] as Vec3)));
    k.fit(CSK, ends, (p) => [0, 0, p[2] < 0 ? 1 : -1], (p) => `K${p[0] < 0 ? -1 : 1}${p[2] < 0 ? "H" : "F"}`, { mate: rail });
  });

  // 14 to 17: hang the bed together
  const railFrom: Vec3 = [0, 250, 0];
  k.step(
    { title: "Hang a side rail on the headboard", detail: "Stand the headboard up. One holds it while the other hooks the rail's keyholes over the bolts and pushes it down.", pose: "+y", people: 2, kind: "join" },
    () => k.add(["R-1", "B-1", "K-1H", "K-1F"], railFrom),
  );
  k.step({ title: "Hang the footboard on the rail", detail: "Hook its bolts into the rail's other end the same way.", people: 2, kind: "join" }, () => k.add(["FB", "FL-1", "FL1"], [0, 250, 300]));
  k.step({ title: "Hang the other side rail", detail: "Between the headboard and the footboard, keyholes over the bolts.", people: 2, kind: "join" }, () => k.add(["R1", "B1", "K1H", "K1F"], railFrom));
  k.step({ title: "Tighten the rail bolts", detail: "All eight, through the keyholes, with the handle until it clicks.", tools: ["allen"], check: "square", kind: "bolts" }, () => {});

  // 18 to 21: the cross support, the centre beam and the slat holders
  k.step({ title: "Bolt the cross support onto the battens", detail: "Across the middle of the bed, its dip pointing down. One long bolt up through each batten.", tools: ["allen"], kind: "bolts" }, () => {
    k.add(["X"], [0, 250, 0]);
    k.fit(LONG, sides.map((sx) => [sx * xb, yBat - 15, 0] as Vec3), [0, 1, 0], batten, { mate: "X" });
  });
  const zHold = [zb0 + 70, zb1 - 70];
  k.step({ title: "Screw the small holders onto the centre beam", detail: "Two at each end, a bolt up through the beam into each.", scene: "beam", tools: ["allen"], kind: "bolts" }, () => {
    k.stage(["CB"]);
    const pts = zHold.flatMap((z) => [-11, 11].map((x) => [x, yTop + 4, z] as Vec3));
    k.fit(HOLDER_S, pts, [0, -1, 0], "CB", { hole: false });
    k.fit(BOLT_S, pts.map((p) => [p[0], yBeam - 20, p[2]] as Vec3), [0, 1, 0], "CB");
  });
  k.step({ title: "Lay the centre beam into its brackets", detail: "Drop each end into the bracket on the headboard and the footboard; the middle rests in the cross support's dip.", kind: "join" }, () => k.add(["CB"], [0, 300, 0]));
  k.step({ title: "Clip the slat holders onto the battens", detail: "One near each end of both battens. Hook it into the hole and turn it in.", kind: "general" }, () =>
    k.fit(HOLDER, sides.flatMap((sx) => [zr0 + 70, zr1 - 70].map((z) => [sx * xb, yTop + 4, z] as Vec3)), [0, -1, 0], batten, { hole: false }),
  );

  // 22 to 24: the cover and the slats
  k.step({ title: "Pull the cover over the headboard", detail: "From behind, over the panel. Hook it on at the top of each post.", kind: "cushions" }, () => k.add(["CV"], [0, 0, -400]));
  k.step({ title: "Fold it over and tuck it in", detail: "Bring the front down over the panel and push its bottom edge into the gap above the board all along.", kind: "cushions" }, () => {});
  k.step({ title: "Roll out the slats", detail: "One roll each side of the centre beam, curved side up. Tuck the end slats under the holders.", kind: "slats" }, () => k.add(["S-1", "S1"], [0, 250, -600]));
  if (withMattress) k.step({ title: "Lay the mattress on", detail: "Unroll it on the slats and give it a day to fill out.", people: 2, kind: "cushions" }, () => k.add(["M"], [0, 400, 0]));
  return true;
}

const family: Family = {
  names: ["TÄLLÅSEN"],
  build,
};
export default family;
