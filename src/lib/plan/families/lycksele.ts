import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import { boxOf } from "../custom";

/**
 * LYCKSELE, read from IKEA's manuals for the chair-bed and the 2-seat sofa-bed frame: no armrests, just a black steel
 * frame of three slatted sections and a leg frame, with a folding foam mattress on top. The leg frame is bolted
 * together first, then each section gets its own metal pieces: roller arms on the backrest, levers on the head
 * section, curved legs on the seat. The folded backrest is lifted onto the leg frame by two people, its levers are
 * bolted to the frame's lugs, it is raised, and the seat's hinges are bolted to it and locked with a clip-on bracket.
 * The mattress is folded over the frame and strapped on. The chair-bed is the same build, narrower.
 */

type Kind = CustomFix["kind"];
interface Pc {
  size: Vec3;
  pos: Vec3;
  rot?: Vec3;
  shape?: "box" | "cyl";
  material?: PartMaterial;
}

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material?: PartMaterial): Pc => ({
  size: [x1 - x0, y1 - y0, z1 - z0],
  pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  material,
});

/** A post standing at (x, z) from y0 to y1. */
const post = (x: number, z: number, y0: number, y1: number, dia = 25): Pc => ({ shape: "cyl", size: [dia, y1 - y0, dia], pos: [x, (y0 + y1) / 2, z] });

/** A wheel turning about x. */
const wheel = (x: number, y: number, z: number, dia = 44): Pc => ({ shape: "cyl", size: [dia, 18, dia], pos: [x, y, z], rot: [0, 0, Math.PI / 2] });

/** One part made of several boxes, given where each sits in the product. */
function group(id: string, name: string, pcs: Pc[], material: PartMaterial = "metal"): CustomPart {
  const bs = pcs.map((p) => boxOf(p));
  const lo = [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k])));
  const pos = [0, 1, 2].map((k) => Math.round(((lo[k] + hi[k]) / 2) * 10) / 10) as Vec3;
  const size = [0, 1, 2].map((k) => Math.round((hi[k] - lo[k]) * 10) / 10) as Vec3;
  if (pcs.length === 1 && !pcs[0].rot) return { id, name, size: pcs[0].size, pos: pcs[0].pos, shape: pcs[0].shape, material };
  const pieces: PartPiece[] = pcs.map((p) => ({ shape: p.shape ?? "box", size: p.size, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]], rot: p.rot, material: p.material ?? material }));
  return { id, name, size, pos, pieces, material };
}

/** A section leaning back by `tilt` from its bottom edge at (y0, z0): x across, v up along it, w out of its front. */
function leaning(tilt: number, y0: number, z0: number) {
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const p = (x: number, v: number, w: number): Vec3 => [x, y0 + c * v + s * w, z0 - s * v + c * w];
  const piece = (x0: number, x1: number, v0: number, v1: number, w0: number, w1: number, material?: PartMaterial): Pc => ({
    size: [x1 - x0, v1 - v0, w1 - w0],
    pos: p((x0 + x1) / 2, (v0 + v1) / 2, (w0 + w1) / 2),
    rot: [-tilt, 0, 0],
    material,
  });
  return { p, piece };
}

/** A slatted section: a steel tube frame with wooden slats across it, in a leaning plane. */
function section(l: ReturnType<typeof leaning>, hx: number, L: number, n: number): Pc[] {
  const t = 25;
  const out: Pc[] = [
    l.piece(-hx, -hx + t, 0, L, -t, 0),
    l.piece(hx - t, hx, 0, L, -t, 0),
    l.piece(-hx + t, hx - t, 0, t, -t, 0),
    l.piece(-hx + t, hx - t, L - t, L, -t, 0),
  ];
  const sw = (L - 2 * t - 10 * (n + 1)) / n;
  for (let i = 0; i < n; i++) {
    const v = t + 10 + i * (sw + 10);
    out.push(l.piece(-hx + 10, hx - 10, v, v + sw, 0, 10, "wood"));
  }
  return out;
}

const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

// the fittings, by what they look like on the manual's fittings page
const FULL = { len: 65, dia: 6, name: "Bolt, threaded all the way" };
const SHANK = { len: 75, dia: 6, name: "Bolt with a plain shank" };
const HINGE_BOLT = { len: 45, dia: 8, name: "Hinge bolt" };
const SHOULDER = { len: 22, dia: 8, name: "Shoulder bolt" };
const CAP_NUT = { len: 8, dia: 8, name: "Cap nut" };
const NUT = { len: 5, dia: 6 };
const WASHER = { len: 1.5, dia: 14 };

function recipe(s: ProductSpec): CustomParams | null {
  if (!/bed|sleeper/i.test(s.variant)) return null;
  // the US "sleeper sofa" is the 2-seat sofa-bed: 142 wide whatever the catalog says
  const W = /sleeper|2-seat/i.test(s.variant) || s.size.w > 100 ? 1420 : 800;
  const two = W > 1000;
  const hx = W / 2 - 30; // the sections' outer edges
  const ax = hx - 35; // the leg frame's arches
  const D = 1000;

  /* ---------- the parts, where they sit with it folded up as a sofa ---------- */
  // leg frame: two steel arches on a cross rail, each with a lug at the back for the head section's lever
  const arch = (id: string, sx: -1 | 1) =>
    group(id, "Leg arch", [
      post(sx * ax, -340, 0, 225),
      post(sx * ax, 20, 0, 225),
      box(sx * ax - 12.5, sx * ax + 12.5, 225, 250, -355, 35),
      box(sx * ax - 15, sx * ax + 15, 0, 8, -360, -320),
      box(sx * ax - 15, sx * ax + 15, 0, 8, 0, 40),
      sx > 0 ? box(ax + 12.5, hx, 250, 300, -355, -320) : box(-hx, -ax - 12.5, 250, 300, -355, -320),
    ]);
  const rail = group("R", "Cross rail", [box(-ax - 12.5, ax + 12.5, 200, 225, -205, -155)]);

  // seat section, slats running front to back, on two curved legs with wheels at the front
  const zs0 = -110, zs1 = 470;
  const ns = Math.max(6, Math.round((2 * hx) / 80));
  const sw = (2 * hx - 40 - 12 * (ns - 1)) / ns;
  const seat = group("S", "Seat section", [
    box(-hx, -hx + 25, 250, 275, zs0, zs1),
    box(hx - 25, hx, 250, 275, zs0, zs1),
    box(-hx + 25, hx - 25, 250, 275, zs1 - 25, zs1),
    box(-hx + 25, hx - 25, 250, 275, zs0, zs0 + 25),
    ...Array.from({ length: ns }, (_, i) => box(-hx + 20 + i * (sw + 12), -hx + 20 + i * (sw + 12) + sw, 275, 287, zs0 + 10, zs1 - 10, "wood")),
  ]);
  const lx = hx - 90;
  const frontLeg = (id: string, sx: -1 | 1) =>
    group(id, "Front leg", [box(sx * lx - 12, sx * lx + 12, 45, 250, zs1 - 30, zs1 - 6), box(sx * lx - 12, sx * lx + 12, 30, 60, zs1 - 70, zs1 - 6), wheel(sx * lx, 22, zs1 - 52)]);

  // backrest section, leaning back from the seat's back edge; its roller arms rest on the leg frame
  const tb = 0.42, Lb = 560;
  const lb = leaning(tb, 272, zs0 - 6);
  const back = group("B", "Backrest section", section(lb, hx, Lb, 6));
  const roller = (id: string, sx: -1 | 1) =>
    group(id, "Roller arm", [box(sx * (hx + 9) - 8, sx * (hx + 9) + 8, 262, 280, -230, zs0 - 6), wheel(sx * (hx + 9), 268, -238, 36)]);

  // head section behind it, nearly upright, on two levers that pivot on the leg frame's lugs
  const top = lb.p(0, Lb, -25);
  const yr0 = 200, zr0 = -400;
  const tr = -Math.atan2(top[2] - zr0, top[1] - yr0), Lr = Math.hypot(top[2] - zr0, top[1] - yr0);
  const lr = leaning(tr, yr0, zr0);
  const head = group("H", "Head section", section(lr, hx, Lr, 6));
  const lever = (id: string, sx: -1 | 1) => group(id, "Lever", [sx > 0 ? box(hx, hx + 10, 262, 300, -405, -320) : box(-hx - 10, -hx, 262, 300, -405, -320)]);

  // the plastic lock bracket clipped over the middle of the seat's hinge
  const lock = group("K", "Lock bracket", [box(-90, 90, 222, 250, zs0 - 20, zs0 + 40), box(-30, 30, 250, 262, zs0 - 20, zs0 + 25)], "board");

  // the mattress folded over the frame: seat, back and over the top down behind the head section
  const hm = W / 2 - 8;
  const mBack = leaning(tb, 287, zs0 + 8);
  const mHead = leaning(tr, yr0 - 10, zr0 - 26);
  const mattress = group("M", "Mattress", [
    box(-hm, hm, 287, 390, zs0 + 8, D / 2),
    mBack.piece(-hm, hm, 103, Lb + 20, 0, 100),
    box(-hm, hm, top[1] - 10, 870, top[2] - 140, top[2] + 75),
    mHead.piece(-hm, hm, 0, Lr - 20, -100, 0),
  ], "soft");

  const parts: CustomPart[] = [
    arch("AL", -1), arch("AR", 1), rail,
    back, roller("WL", -1), roller("WR", 1),
    head, lever("VL", -1), lever("VR", 1),
    seat, frontLeg("FL", -1), frontLeg("FR", 1),
    lock, mattress,
  ];

  /* ---------- the fittings ---------- */
  const both = (f: (sx: -1 | 1) => Vec3[]) => [...f(-1), ...f(1)];
  const railPts = both((sx) => [[sx * ax, 250, -192], [sx * ax, 250, -168]] as Vec3[]);
  const railNuts = railPts.map((p) => [p[0], 200, p[2]] as Vec3);
  // across, from inside the frame's side tube near its bottom end, out through the roller arm
  const rollAt = (sx: number) => lb.p(sx * (hx - 25), 5, -12);
  const rollPts = both((sx) => [rollAt(sx)] as Vec3[]);
  const leverPts = both((sx) => [[sx * (hx + 10), 285, -385]] as Vec3[]);
  const legPts = both((sx) => [[sx * lx, 287, zs1 - 18]] as Vec3[]);
  const pivots = both((sx) => [[sx * (hx + 10), 280, -337]] as Vec3[]);
  const hinges = both((sx) => [[sx * hx, 262, zs0 - 2]] as Vec3[]);
  const lockPts: Vec3[] = [[-60, 222, zs0 + 10], [60, 222, zs0 + 10]];
  const inward = (p: Vec3): Vec3 => [p[0] > 0 ? -1 : 1, 0, 0];
  const sideFix = (kind: Kind, pts: Vec3[], off: number, on: string, o: { len?: number; dia?: number; name?: string }) =>
    pts.map((p) => at(kind, [[p[0] - Math.sign(p[0]) * off, p[1], p[2]]], inward(p), on, undefined, o));

  const steps: CustomStep[] = [
    {
      title: "Bolt the leg frame together",
      detail: "The cross rail goes under both arches, with the hooks turned in. Use the bolts threaded all the way, a washer and nut under each, tightened with the spanner.",
      add: ["AL", "AR", "R"],
      fix: [at("bolt", railPts, [0, -1, 0], undefined, "R", FULL), at("washer", railNuts, [0, 1, 0], "R", undefined, WASHER), at("nut", railNuts.map((p) => [p[0], 196, p[2]] as Vec3), [0, 1, 0], "R", undefined, NUT)],
      tools: ["allen", "wrench"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the roller arms to the backrest section",
      detail: "Stand the section on its long edge, one of you holding it. The rollers face out, as in the drawing. One bolt with a plain shank through the side of the frame and each arm, washer and nut on the outside.",
      add: ["B", "WL", "WR"],
      fix: [
        ...[-1, 1].map((sx) => at("bolt", [rollAt(sx)], [sx, 0, 0], "B", sx < 0 ? "WL" : "WR", SHANK)),
        ...[-1, 1].map((sx) => at("washer", [[sx * (hx + 17), rollAt(sx)[1], rollAt(sx)[2]]], [-sx, 0, 0], undefined, undefined, WASHER)),
        ...[-1, 1].map((sx) => at("nut", [[sx * (hx + 19), rollAt(sx)[1], rollAt(sx)[2]]], [-sx, 0, 0], undefined, undefined, NUT)),
      ],
      tools: ["allen", "wrench"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Bolt the levers to the head section",
      detail: "Lay it slats up. One bolt threaded all the way through each lever and the side of the frame, washer and nut on the inside.",
      add: ["H", "VL", "VR"],
      fix: [
        ...leverPts.map((p) => at("bolt", [p], inward(p), undefined, "H", FULL)),
        ...sideFix("washer", leverPts, 36, "H", WASHER),
        ...sideFix("nut", leverPts, 40, "H", NUT),
      ],
      tools: ["allen", "wrench"],
    },
    {
      title: "Bolt the legs to the seat section",
      detail: "Stand it on its long edge. Slide each leg's bracket onto the front tube, then a plain-shank bolt down through it, washer and nut under. The legs curve outwards, wheels to the front.",
      add: ["S", "FL", "FR"],
      fix: [at("bolt", legPts, [0, -1, 0], undefined, "S", SHANK), at("washer", legPts.map((p) => [p[0], 45, p[2]] as Vec3), [0, 1, 0], undefined, undefined, WASHER), at("nut", legPts.map((p) => [p[0], 41, p[2]] as Vec3), [0, 1, 0], undefined, undefined, NUT)],
      tools: ["allen", "wrench"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Lift the folded back onto the leg frame",
      detail: "Fold the backrest and head sections together and lower them onto the arches, rollers down, with the seat section lying in front. The slats' rounded edges face up.",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Bolt the levers to the leg frame",
      detail: "A shoulder bolt through each lever into the lug on the arch, a cap nut inside. Tighten with the spanner, but the lever must still turn.",
      fix: [...pivots.map((p) => at("bolt", [p], inward(p), undefined, "AL", SHOULDER)), ...sideFix("nut", pivots, 34, "AL", CAP_NUT)],
      tools: ["allen", "wrench"],
    },
    {
      title: "Raise the backrest",
      detail: "Lift the backrest section up until the two sections stand as a ridge over the leg frame.",
    },
    {
      title: "Bolt the seat's hinges to the backrest",
      detail: "One of you on each side. Line up the hinge plates at the seat's back corners, then a bolt from outside and a cap nut inside.",
      fix: [...hinges.map((p) => at("bolt", [p], inward(p), undefined, "S", HINGE_BOLT)), ...sideFix("nut", hinges, 28, "S", CAP_NUT)],
      tools: ["allen", "wrench"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Clip on the lock bracket and screw it tight",
      detail: "Press it down over the middle of the hinge tube until it clicks, then two small screws from underneath.",
      add: ["K"],
      fix: [at("screw", lockPts, [0, 1, 0], "K", undefined, { len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Fold the mattress over the frame and strap it on",
      detail: `Lay it on the seat, fold it up over the backrest and down behind the head section. Fasten the straps around the frame tubes, then fit the cover.`,
      add: ["M"],
      kind: "cushions",
      people: two ? 2 : 1,
      warnings: two ? ["two"] : [],
    },
    {
      title: "Try folding it out into a bed",
      detail: "Lift the seat's front edge, pull it towards you until the back lies flat, then fold it back. It should move smoothly both ways.",
    },
  ];
  return { parts, steps };
}

const family: Family = { names: ["LYCKSELE"], recipe };
export default family;
