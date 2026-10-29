import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * LÄCKÖ outdoor furniture in grey powder-coated steel, read from IKEA's manuals.
 *
 * Shelving units: a welded back frame and two welded side frames. Built lying on one side: the back frame is bolted
 * to the side frame on the floor (one bolt per shelf rail and one where the top curve meets it), the other side goes
 * on top, the feet screw into the uprights, then it stands up, the mesh shelves drop onto the rails, the feet are
 * levelled and two screws fix it to the wall.
 * Table: upside down, the four bent legs go onto studs under the top (spacer, washer, nut), then two rings slide
 * over the column of legs and each is bolted to all four.
 * 2-seat sofa: the seat lies upside down on a table; a side frame is bolted on each end (one bolt through the front
 * leg, two through the seat rail), the stretcher with its end inserts drops between them and is bolted, then it
 * stands up and the backrest hooks onto the back posts with two short bolts. Every bolt is tightened at the end.
 * The chair comes fully welded with no manual, so its guide only unpacks it.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

/** A piece of a part in finished-product mm, before it is made relative to the part. */
interface Bit {
  piece: PartPiece;
  lo: Vec3;
  hi: Vec3;
}
const bx = (lo: Vec3, hi: Vec3, material?: PartMaterial): Bit => ({
  piece: { shape: "box", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], ...(material ? { material } : {}) },
  lo,
  hi,
});
/** A steel tube from a to b, lying in a plane through one axis (the ends differ in y and z, or in x and y, or along one axis). */
const tube = (a: Vec3, b: Vec3, dia: number): Bit => {
  const [dx, dy, dz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(dx, dy, dz);
  const rot: Vec3 | undefined = Math.abs(dx) < 0.1 && Math.abs(dz) < 0.1 ? undefined : Math.abs(dx) < 0.1 ? [Math.atan2(dz, dy), 0, 0] : [0, 0, Math.atan2(-dx, dy)];
  const lo = [0, 1, 2].map((k) => Math.min(a[k], b[k]) - dia / 2) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(a[k], b[k]) + dia / 2) as Vec3;
  return { piece: { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], ...(rot ? { rot } : {}) }, lo, hi };
};
/** A run of tubes through the points. */
const path = (pts: Vec3[], dia: number): Bit[] => pts.slice(1).map((p, i) => tube(pts[i], p, dia));
/** One part made of several pieces, its box worked out from them. */
function assemble(id: string, name: string, bits: Bit[], material: PartMaterial = "metal"): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...bits.map((b) => b.lo[k]))) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(...bits.map((b) => b.hi[k]))) as Vec3;
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  return {
    id,
    name,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    pos,
    material,
    pieces: bits.map((b) => ({ ...b.piece, pos: [b.piece.pos[0] - pos[0], b.piece.pos[1] - pos[1], b.piece.pos[2] - pos[2]] as Vec3 })),
  };
}
const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

/* ---------- shelving units ---------- */

function shelving(s: ProductSpec): CustomParams {
  const tall = s.size.h > 120;
  // 61 x 160 x 32 with four shelves, or 92 x 76 x 32 with two
  const W = tall ? 610 : 920, H = tall ? 1600 : 760, D = 320;
  const T = 19, RD = 12;
  const xu = W / 2 - 10, zb = -D / 2 + 10, zf = D / 2 - 10;
  const levels = tall ? [110, 490, 870, 1250] : [90, 440];
  const yFront = levels[levels.length - 1];
  const yCurve = tall ? 1450 : 650; // where the side frame's top curve meets the back upright
  const archEnd = H - 60, archMid = H - 20;
  const archY = (x: number) => archEnd + (archMid - archEnd) * (1 - Math.abs(x) / xu);

  const back = assemble("B", "Back frame", [
    ...[-1, 1].map((g) => tube([g * xu, 0, zb], [g * xu, H - 8, zb], T)),
    ...[-1, 1].map((g) => tube([g * xu, H - 8, zb], [g * xu, H, zb], 26)),
    tube([-xu, archEnd, zb], [0, archMid, zb], RD),
    tube([0, archMid, zb], [xu, archEnd, zb], RD),
    ...levels.map((y) => tube([-xu + T / 2, y, zb], [xu - T / 2, y, zb], 10)),
    ...spread(-W / 4, W / 4, 3).map((x) => tube([x, levels[0] + 5, zb], [x, archY(x) - 5, zb], 8)),
    // tabs for the wall screws
    ...[-1, 1].map((g) => bx([g * (xu - 10) - 14, H - 175, -D / 2], [g * (xu - 10) + 14, H - 140, -D / 2 + 3])),
  ]);
  const side = (g: number) => {
    const x = g * xu, zc = zb + T / 2;
    const a = zf - zc, b = yCurve - yFront;
    const curve = range(5).map((i): Vec3 => {
      const t = (i / 4) * (Math.PI / 2);
      return [x, yFront + b * Math.sin(t), zc + a * Math.cos(t)];
    });
    return assemble(`S${g < 0 ? 0 : 1}`, "Side frame", [tube([x, 0, zf], [x, yFront, zf], T), ...path(curve, T), ...levels.map((y) => tube([x, y, zb + T / 2], [x, y, zf - T / 2], RD))]);
  };
  const shelves: CustomPart[] = levels.map((y, i) => ({
    id: `H${i}`,
    name: "Shelf",
    size: [2 * (xu - 2), 18, zf - zb - T - 4],
    pos: [0, y + RD / 2 + 9, (zb + zf) / 2],
    material: "metal",
  }));
  const parts: CustomPart[] = [side(-1), back, side(1), ...shelves];

  const BOLT = { len: 40, dia: 6 };
  const bolts = (g: number) =>
    fix("bolt", [...levels, yCurve].map((y): Vec3 => [g * xu, y, -D / 2]), [0, 0, 1], { ...BOLT, on: "B", mate: `S${g < 0 ? 0 : 1}` });
  const n = levels.length + 1;
  const shelfIds = shelves.map((p) => p.id);
  const tab = [-1, 1].map((g): Vec3 => [g * (xu - 10), H - 158, -D / 2]);
  const steps: CustomStep[] = [
    {
      title: "Bolt the back frame to a side frame",
      detail: `Lay the side frame flat on a rug and stand the back frame on its long edge against the rail ends. ${n} bolts, the flat face of each rail end against the back.`,
      add: ["S0", "B"],
      fix: [bolts(-1)],
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
      from: { B: [0, 300, 0] },
    },
    { title: "Bolt on the other side frame", detail: `Lay it on top so the rail ends meet the back frame, then ${n} more bolts.`, add: ["S1"], fix: [bolts(1)], tools: ["allen"] },
    {
      title: "Screw the feet into the uprights",
      detail: "One into the bottom of each upright, by hand.",
      fix: [
        fix("foot", [-1, 1].map((g): Vec3 => [g * xu, 0, zb]), [0, 1, 0], { on: "B" }),
        ...[-1, 1].map((g) => fix("foot", [[g * xu, 0, zf]], [0, 1, 0], { on: `S${g < 0 ? 0 : 1}` })),
      ],
      kind: "legs",
    },
    { title: "Stand it up and lay the shelves in", detail: "Tilt each shelf in and drop it flat onto its rails.", add: shelfIds, pose: "+y", from: Object.fromEntries(shelfIds.map((id) => [id, [0, 0, 300] as Vec3])), kind: "shelves" },
    { title: "Level the feet", detail: "Turn the feet in or out until it stands steady and level, even on an uneven patio.", tools: ["level"], kind: "legs" },
    {
      title: "Screw it to the wall",
      detail: "Two screws through the tabs at the back. Screws and plugs aren't included: pick ones made for your wall, with a round head.",
      fix: [fix("plug", tab, [0, 0, -1]), fix("screw", tab, [0, 0, -1], { len: 50, dia: 5 })],
      tools: ["drill", "screwdriver", "pencil", "level"],
      warnings: ["wall", "tip"],
      wall: true,
      kind: "anchor",
    },
  ];
  return { parts, steps };
}

/* ---------- table ---------- */

function table(): CustomParams {
  const R = 350, H = 710, TT = 20, LD = 19;
  const yUnder = H - TT;
  const angles = [0, 1, 2, 3].map((k) => (k * Math.PI) / 2);
  const at = (phi: number, r: number, y: number): Vec3 => [Math.round(r * Math.cos(phi) * 100) / 100, y, Math.round(r * Math.sin(phi) * 100) / 100];
  const yArm = yUnder - 24, rTab = 305;
  const leg = (k: number): CustomPart => {
    const phi = angles[k];
    const p = (r: number, y: number) => at(phi, r, y);
    return assemble(`L${k}`, "Leg", [
      ...path([p(rTab, yArm), p(60, yArm), p(22, yArm - 40), p(22, 330), p(300, 80), p(305, 12)], LD),
      tube(p(305, 0), p(305, 12), 30),
    ]);
  };
  const rings = [
    { id: "R0", y: 600 },
    { id: "R1", y: 360 },
  ];
  const parts: CustomPart[] = [
    { id: "T", name: "Table top", size: [2 * R, TT, 2 * R], pos: [0, H - TT / 2, 0], shape: "cyl", material: "metal" },
    ...angles.map((_, k) => leg(k)),
    ...rings.map((r): CustomPart => ({ id: r.id, name: "Ring", size: [76, 40, 76], pos: [0, r.y, 0], shape: "cyl", material: "metal" })),
  ];
  const onStuds = (ks: number[]): CustomFix[] => [
    fix("spacer", ks.map((k) => at(angles[k], rTab, yUnder)), [0, 1, 0], { name: "Spacer", len: 14, dia: 16, on: "T" }),
    ...(["washer", "nut"] as const).map((kind) => fix(kind, ks.map((k) => at(angles[k], rTab, yArm - LD / 2)), [0, 1, 0], { on: `L${ks[0]}` })),
  ];
  const ringBolts = (r: (typeof rings)[number]): CustomFix[] => [
    ...angles.map((phi, k) => fix("bolt", [at(phi, 38, r.y)], [-Math.round(Math.cos(phi)), 0, -Math.round(Math.sin(phi))], { len: 40, dia: 6, on: r.id, mate: `L${k}` })),
    ...(["washer", "nut"] as const).map((kind) => fix(kind, angles.map((phi) => at(phi, 12, r.y)), [0, 1, 0], { on: r.id })),
  ];
  const steps: CustomStep[] = [
    {
      title: "Fit two legs onto the studs under the top",
      detail: "Lay the top upside down on a rug. A spacer on each stud, then the flat end of the leg, a washer and a nut. Finger tight for now.",
      add: ["T", "L0", "L2"],
      fix: onStuds([0, 2]),
      tools: ["wrench"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Fit the other two legs", detail: "The same way, so the four legs meet in a column in the middle.", add: ["L1", "L3"], fix: onStuds([1, 3]), tools: ["wrench"] },
    { title: "Slide the first ring down the column", detail: "Over all four legs, right down to the top.", add: ["R0"], from: { R0: [0, -400, 0] } },
    { title: "Bolt the ring to the legs", detail: "One bolt through the ring into each leg, with a washer and nut inside. Hold the nut with the spanner.", fix: ringBolts(rings[0]), tools: ["allen", "wrench"] },
    { title: "Slide the second ring down", detail: "It stops just above where the legs spread out.", add: ["R1"], from: { R1: [0, -300, 0] } },
    { title: "Bolt the second ring to the legs", detail: "Four more bolts. Now tighten the nuts on the studs too.", fix: ringBolts(rings[1]), tools: ["allen", "wrench"] },
    { title: "Turn the table over", detail: "Lift it by the top, not the legs.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- 2-seat sofa ---------- */

function sofa(): CustomParams {
  // 115 x 87 x 56, seat 102 wide at 45 cm
  const SW = 1020, xs = 525, zF = 200, zB = -235, TD = 22;
  const seat = assemble("A", "Seat", [
    bx([-SW / 2, 438, -205], [SW / 2, 450, 209]),
    bx([-SW / 2, 380, 209], [SW / 2, 450, 221]),
    ...[-1, 1].map((g) => bx([g > 0 ? SW / 2 - 4 : -SW / 2, 390, -200], [g > 0 ? SW / 2 : -SW / 2 + 4, 438, 205])),
  ]);
  const side = (g: number) => {
    const x = g * xs;
    return assemble(`S${g < 0 ? 0 : 1}`, "Side frame", [
      tube([x, 0, zF], [x, 640, zF], TD),
      tube([x, 640, zF], [x, 640, zB], TD),
      tube([x, 0, zB], [x, 835, zB], TD),
      tube([x, 150, zF], [x, 150, zB], 16),
      tube([x, 415, zF], [x, 415, zB], 16),
      ...[zF, zB].map((z) => tube([x, 0, z], [x, 8, z], 34)),
    ]);
  };
  const xr = xs - 8, zs = -20;
  const stretcher: CustomPart = { id: "X", name: "Stretcher", size: [2 * xr, TD, TD], pos: [0, 150, zs], shape: "cyl", material: "metal" };
  const back = assemble("K", "Backrest", [
    tube([-xs, 851, zB], [xs, 851, zB], 18),
    tube([-xs + 11, 475, zB], [xs - 11, 475, zB], 16),
    ...spread(-450, 450, 11).map((x) => tube([x, 483, zB], [x, 842, zB], 10)),
    ...[-1, 1].map((g) => bx([g * xs - 16, 836, zB - 16], [g * xs + 16, 842, zB + 16])),
  ]);
  const parts: CustomPart[] = [seat, side(-1), side(1), stretcher, back];
  const BOLT = { len: 40, dia: 6 };
  const sid = (g: number) => `S${g < 0 ? 0 : 1}`;
  const legBolt = (g: number) => fix("bolt", [[g * (xs + 11), 400, zF]], [-g, 0, 0], { ...BOLT, on: sid(g), mate: "A" });
  const railBolts = (g: number) => fix("bolt", [100, -120].map((z): Vec3 => [g * (xs + 8), 415, z]), [-g, 0, 0], { ...BOLT, on: sid(g), mate: "A" });
  const steps: CustomStep[] = [
    {
      title: "Bolt a side frame to the seat",
      detail: "Lay the seat upside down on a rug on a table. One bolt through the front leg, flat head flush with the tube.",
      add: ["A", "S0"],
      fix: [legBolt(-1)],
      tools: ["allen"],
      pose: "-y",
    },
    { title: "Bolt it through the seat rail", detail: "Two more bolts along the rail under the seat. Not fully tight yet.", fix: [railBolts(-1)], tools: ["allen"] },
    { title: "Bolt on the other side frame", detail: "One bolt through its front leg.", add: ["S1"], fix: [legBolt(1)], tools: ["allen"] },
    { title: "Bolt it through the seat rail", detail: "Two bolts, as on the first side.", fix: [railBolts(1)], tools: ["allen"] },
    {
      title: "Drop the stretcher between the side frames",
      detail: "Push an insert into each end first, then lay it between the low rails.",
      add: ["X"],
      fix: [-1, 1].map((g) => fix("cap", [[g * xr, 150, zs]], [g, 0, 0], { name: "End insert", len: 12, dia: 20, on: "X" })),
      from: { X: [0, -300, 0] },
    },
    { title: "Bolt the stretcher on", detail: "One bolt through each low rail into the ends.", fix: [-1, 1].map((g) => fix("bolt", [[g * (xs + 8), 150, zs]], [-g, 0, 0], { ...BOLT, on: sid(g), mate: "X" })), tools: ["allen"] },
    {
      title: "Stand it up and hook the backrest on",
      detail: "Lower it so the tabs at the top sit on the back posts and the bottom rail hooks over them.",
      add: ["K"],
      pose: "+y",
      from: { K: [0, 300, 0] },
    },
    { title: "Bolt the backrest to the posts", detail: "A short bolt down through each tab.", fix: [fix("bolt", [-1, 1].map((g): Vec3 => [g * xs, 842, zB]), [0, -1, 0], { len: 16, dia: 6, on: "K" })], tools: ["allen"] },
    { title: "Tighten every bolt", detail: "All ten, once the sofa stands level on its feet.", tools: ["allen"], kind: "bolts" },
  ];
  return { parts, steps };
}

/** A round rod from a to b (mm, relative to its part's centre). */
function rod(a: Vec3, b: Vec3, d: number): PartPiece {
  const v: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...v);
  return { shape: "cyl", size: [d, len, d], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(v[2], v[1]), 0, Math.asin(-v[0] / len)] };
}

/** The chair comes welded in one piece (its page has no manual), so its guide only unpacks it. */
function chair(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const yS = (s.seat?.seatH ?? 45) * 10, t = 12, r = W / 2 - 20;
  const zb = -D / 2 + 50; // the back legs' tops, under the back of the seat
  const pieces: PartPiece[] = [
    // four legs splaying out a little towards the floor
    ...[-1, 1].flatMap((sx) => [rod([sx * (W / 2 - 15), -yS / 2, D / 2 - 30], [sx * (r - 30), yS / 2 - 15, D / 2 - 90], t), rod([sx * (W / 2 - 15), -yS / 2, -D / 2 + 10], [sx * (r - 30), yS / 2 - 15, zb], t)]),
    // the back uprights, rising from the back legs, and the round top rail with its bars
    ...[-1, 1].map((sx) => rod([sx * (r - 30), yS / 2 - 15, zb], [sx * (r - 20), H - yS / 2 - 80, zb - 40], t)),
    rod([-(r - 20), H - yS / 2 - 80, zb - 40], [0, H - yS / 2 - 6, zb - 40], t),
    rod([0, H - yS / 2 - 6, zb - 40], [r - 20, H - yS / 2 - 80, zb - 40], t),
    ...[-0.5, -0.17, 0.17, 0.5].map((f) => rod([f * (r - 40), yS / 2 + 20, zb - 10], [f * (r - 40), H - yS / 2 - 70 + (1 - Math.abs(f)) * 60, zb - 40], 7)),
    // the ring under the seat that ties the legs together
    rod([-(W / 2 - 30), -yS / 2 + 160, -D / 2 + 30], [-(W / 2 - 30), -yS / 2 + 160, D / 2 - 50], 10),
    rod([W / 2 - 30, -yS / 2 + 160, -D / 2 + 30], [W / 2 - 30, -yS / 2 + 160, D / 2 - 50], 10),
  ];
  // the seat is welded on too
  const seat: PartPiece = { shape: "slab", size: [2 * r - 20, 8, D - 120], pos: [0, yS - 4 - H / 2, 20], outline: [[-(r - 10), -(D - 120) / 2], [r - 10, -(D - 120) / 2], [r - 30, (D - 120) / 2], [-(r - 30), (D - 120) / 2]], round: 60 };
  const parts: CustomPart[] = [{ id: "F", name: "Chair", size: [W, H, D], pos: [0, H / 2, 0], material: "metal", pieces: [...pieces.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] + yS / 2 - H / 2, p.pos[2]] as Vec3 })), seat] }];
  const steps: CustomStep[] = [
    { title: "Unpack the chair", detail: "It comes welded in one piece, so there is nothing to put together. Take off all the packaging and the protective film.", add: ["F"], from: { F: [0, 300, 0] } },
    { title: "Check it stands steady", detail: "All four feet should touch the ground. The chairs stack, so store them stacked under cover in winter." },
  ];
  return { parts, steps };
}

function recipe(s: ProductSpec): CustomParams | null {
  const slug = s.slug ?? "";
  if (/^lacko-chair/.test(slug)) return chair(s);
  if (/lacko-shelving-unit/.test(slug)) return shelving(s);
  if (/lacko-table-outdoor/.test(slug)) return table();
  if (/lacko-2-seat-sofa/.test(slug)) return sofa();
  return null;
}

const family: Family = {
  names: ["LÄCKÖ", "LACKO"],
  recipe,
};
export default family;
