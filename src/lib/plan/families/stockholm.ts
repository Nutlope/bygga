import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import { rotate } from "../math";

/**
 * STOCKHOLM, read from IKEA's manuals. Almost everything is built upside down on a rug:
 * - Dining tables: four legs slide into holders under the top and are locked with a clamp each.
 * - Side tables: the pedestal one gets a plate on its column, screwed to the top, dowels and one long bolt into the
 *   base; the 55 has four splayed legs screwed in by hand, a locking screw each and adjustable feet.
 * - Coffee tables: the old oval one has screw-in legs and a shelf screwed between them; the 2025 slatted one is
 *   threaded onto three tubes from the centre slat out, with spacers between the slats and the legs clamped in.
 * - Bench: two leg frames, two long rails (dowels, barrel nuts, long bolts), the slatted seat bolted in, felt pads,
 *   then the pad strapped on top. Shelving unit and shelving bench: posts with cam pins and feet, shelves with cam
 *   housings, built lying on the back, then on the front for the last post, levelled and (the tall one) fixed to the wall.
 * - Chairs and easy chairs follow their own manuals step by step; the 2025 sofas are modules with felt pads and
 *   fold-out connectors, pushed together; the old leather sofa gets four legs upside down and its cushions.
 * - Cabinets: the 2-door one has side frames with legs, built on its side, then upside down, then the top, the wall
 *   spacers and the doors on clip hinges; the glass-door one is a box of framed glass panels bolted together lying on its
 *   back, on a base of two leg frames, with sliding glass doors; the rattan one with sliding doors is built lying on its
 *   back on cam bolts and dowels, stood up for the middle post, the top and the doors, then strapped to the wall.
 * - Sideboard: the top upside down with its rails and push openers, the sides hung on it, backs, bottom and a base
 *   built beside it, then upright for clips, wall fixing, shelves, drawers and four doors.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const dims = (s: ProductSpec) => ({ W: s.size.w * 10, H: s.size.h * 10, D: s.size.d * 10 });

type Opt = Partial<Pick<CustomPart, "shape" | "material" | "rot" | "pieces">>;
const part = (id: string, name: string, size: Vec3, pos: Vec3, o: Opt = {}): CustomPart => ({ id, name, size, pos, material: "board", ...o });
const fx = (kind: CustomFix["kind"], at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, ...o });
const UP: Vec3 = [0, 1, 0];
const DOWN: Vec3 = [0, -1, 0];

/** One part drawn as several pieces given where they sit in the product; its box and centre are worked out. */
function compound(id: string, name: string, abs: PartPiece[], material: PartMaterial): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of abs)
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const c of [-1, 1]) {
          const v = rotate([(a * p.size[0]) / 2, (b * p.size[1]) / 2, (c * p.size[2]) / 2], p.rot ?? [0, 0, 0]);
          for (let k = 0; k < 3; k++) {
            lo[k] = Math.min(lo[k], p.pos[k] + v[k]);
            hi[k] = Math.max(hi[k], p.pos[k] + v[k]);
          }
        }
  const pos: Vec3 = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const size: Vec3 = [0, 1, 2].map((k) => hi[k] - lo[k]) as Vec3;
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] as Vec3 }));
  return { id, name, size, pos, pieces, material };
}

/** A straight leg or post from one end to the other, turned to lean the way they do. */
function stick(id: string, name: string, a: Vec3, b: Vec3, t: number, o: Opt = {}): CustomPart {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d);
  const n = d.map((x) => x / L);
  const rot: Vec3 = [Math.atan2(n[2], n[1]), 0, -Math.asin(n[0])];
  return part(id, name, [t, L, t], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], { material: "wood", rot, ...o });
}

/** A flat round part (a disc is drawn upright only as a piece, a bare flat cylinder would be laid down as a rod). */
const disc = (id: string, name: string, size: Vec3, pos: Vec3, material: PartMaterial = "board"): CustomPart => ({ id, name, size, pos, material, pieces: [{ shape: "cyl", size, pos: [0, 0, 0] }] });

/** A flat oval: a box with a round end on each side. */
const ovalPieces = (W: number, T: number, D: number): PartPiece[] => [
  { shape: "box", size: [W - D, T, D], pos: [0, 0, 0] },
  { shape: "cyl", size: [D, T, D], pos: [-(W - D) / 2, 0, 0] },
  { shape: "cyl", size: [D, T, D], pos: [(W - D) / 2, 0, 0] },
];
const corners = (x: number, z: number): [number, number][] => [[-x, -z], [x, -z], [x, z], [-x, z]];

/* ---------- dining tables ---------- */

function dining(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const T = 30, L = 70;
  const round = Math.abs(W - D) < 30;
  const parts: CustomPart[] = [
    round
      ? disc("top", "Table top", [W, T, D], [0, H - T / 2, 0])
      : part("top", "Table top", [W, T, D], [0, H - T / 2, 0], { pieces: ovalPieces(W, T, D) }),
  ];
  const lx = round ? W * 0.22 : W / 2 - 320;
  const lz = round ? D * 0.22 : D / 2 - 170;
  const legs = corners(lx, lz);
  legs.forEach(([x, z], i) => parts.push(part(`L${i}`, "Leg", [L, H - T, L], [x, (H - T) / 2, z], { shape: "cyl", material: "wood" })));
  const ids = legs.map((_, i) => `L${i}`);
  const steps: CustomStep[] = [
    {
      title: "Slide the legs into their holders",
      detail: "Lay the top upside down on a rug. Push the end of each leg into its holder, then slide it sideways until it stops.",
      add: ["top", ...ids],
      from: Object.fromEntries(ids.map((id) => [id, [0, -300, 0] as Vec3])),
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Lock each leg with a clamp",
      detail: "Push a clamp into the holder beside the leg and turn its bolt with the Allen key until the leg can't move.",
      fix: legs.map(([x, z], i) => fx("clamp", [[x + (x > 0 ? -1 : 1) * (L / 2 + 14), H - T - 22, z]], { dir: UP, on: `L${i}`, mate: "top" })),
      tools: ["allen"],
    },
    { title: "Turn it over together", detail: "Lift it by the top, not by the legs.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

/* ---------- side tables ---------- */

function pedestal(s: ProductSpec): CustomParams {
  const { W, H } = dims(s);
  const T = 30, B = 50, C = 110, bd = W * 0.75;
  const colH = H - T - B;
  const parts = [
    disc("top", "Table top", [W, T, W], [0, H - T / 2, 0]),
    part("col", "Column", [C, colH, C], [0, B + colH / 2, 0], { shape: "cyl" }),
    disc("base", "Base", [bd, B, bd], [0, B / 2, 0]),
  ];
  const ring = (r: number, n: number, y: number, a0 = 0): Vec3[] => range(n).map((i) => [r * Math.cos(a0 + (2 * Math.PI * i) / n), y, r * Math.sin(a0 + (2 * Math.PI * i) / n)]);
  const steps: CustomStep[] = [
    {
      title: "Screw the plate onto the column",
      detail: "Three bolts through the plate into one end of the column. Tighten them with the Allen key.",
      fix: [fx("plate", [[0, H - T, 0]], { dir: UP, on: "col" }), fx("bolt", ring(30, 3, H - T), { dir: UP, on: "col", len: 20, dia: 6 })],
      tools: ["allen"],
      pose: "-y",
    },
    {
      title: "Screw the column to the top",
      detail: "Lay the top upside down on a rug and stand the column on it. Four screws through the plate into the top.",
      add: ["top"],
      fix: [fx("screw", ring(75, 4, H - T, Math.PI / 4), { dir: UP, on: "top", len: 16, dia: 5 })],
      tools: ["allen"],
      warnings: ["floor"],
    },
    { title: "Tap three dowels into the column", detail: "Into the holes in its free end.", fix: [fx("dowel", ring(32, 3, B), { dir: UP, on: "col", mate: "base" })], tools: ["hammer"] },
    { title: "Lay the base on the dowels", detail: "Holes for the felt pads facing up.", add: ["base"] },
    { title: "Bolt the base to the column", detail: "The long bolt goes through the middle of the base. Tighten it with the Allen key.", fix: [fx("bolt", [[0, 0, 0]], { dir: UP, on: "base", mate: "col", len: 100, dia: 8 })], tools: ["allen"] },
    { title: "Press the felt pads into the base", detail: "Five round the edge, pushed in until they're flat.", fix: [fx("glide", ring(bd / 2 - 35, 5, 0), { dir: UP, on: "base" })] },
    { title: "Turn it over", detail: "Stand it on its base.", pose: "+y" },
  ];
  return { parts, steps };
}

function splayed(s: ProductSpec): CustomParams {
  const { W, H } = dims(s);
  const T = 30, t = 40;
  const r1 = W * 0.28, r2 = W * 0.36; // leg centres from the middle, at the top and on the floor (along the diagonal)
  const q = (r: number) => r / Math.SQRT2;
  const parts: CustomPart[] = [disc("top", "Table top", [W, T, W], [0, H - T / 2, 0])];
  const legs = corners(1, 1);
  legs.forEach(([sx, sz], i) => parts.push(stick(`L${i}`, "Leg", [sx * q(r2), 0, sz * q(r2)], [sx * q(r1), H - T, sz * q(r1)], t)));
  const ids = legs.map((_, i) => `L${i}`);
  const steps: CustomStep[] = [
    {
      title: "Screw the legs into the top",
      detail: "Lay the top upside down on a rug. Turn each leg clockwise by hand until it sits tight on its plate.",
      add: ["top", ...ids],
      fix: legs.map(([sx, sz], i) => fx("legScrew", [[sx * q(r1), H - T, sz * q(r1)]], { dir: UP, on: `L${i}`, mate: "top", len: 60, dia: 8 })),
      pose: "-y",
      warnings: ["floor", "hand"],
    },
    {
      title: "Lock each leg with a screw",
      detail: "One screw through the bracket on the inside of each leg into the top.",
      fix: legs.map(([sx, sz], i) => fx("screw", [[sx * q(r1 - 45), H - T, sz * q(r1 - 45)]], { dir: UP, on: "top", mate: `L${i}`, len: 20, dia: 6 })),
      tools: ["allen"],
    },
    { title: "Screw in the feet", detail: "One in the end of each leg, by hand.", fix: legs.map(([sx, sz], i) => fx("foot", [[sx * q(r2), 0, sz * q(r2)]], { dir: UP, on: `L${i}` })), warnings: ["hand"] },
    { title: "Stand it up and level it", detail: "Turn the feet in or out until it stands steady and the top is level.", pose: "+y", tools: ["level"] },
  ];
  return { parts, steps };
}

/* ---------- coffee tables ---------- */

function ovalCoffee(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const T = 30, t = 45, ys = 180, sh = 18;
  const xTop = W / 2 - 330, xFloor = W / 2 - 250, lz = 140;
  const xAt = (y: number) => xFloor + ((xTop - xFloor) * y) / (H - T);
  const parts: CustomPart[] = [part("top", "Table top", [W, T, D], [0, H - T / 2, 0], { pieces: ovalPieces(W, T, D) })];
  const legs = corners(1, 1);
  legs.forEach(([sx, sz], i) => parts.push(stick(`L${i}`, "Leg", [sx * xFloor, 0, sz * lz], [sx * xTop, H - T, sz * lz], t, { shape: "cyl" })));
  const xs = xAt(ys) - t / 2;
  parts.push(part("shelf", "Shelf", [2 * xs, sh, 2 * lz + t], [0, ys, 0]));
  const ids = legs.map((_, i) => `L${i}`);
  const steps: CustomStep[] = [
    {
      title: "Screw the legs into the top",
      detail: "Lay the top upside down on a rug. Turn each leg clockwise by hand.",
      add: ["top", ...ids],
      fix: legs.map(([sx, sz], i) => fx("legScrew", [[sx * xTop, H - T, sz * lz]], { dir: UP, on: `L${i}`, mate: "top", len: 60, dia: 8 })),
      pose: "-y",
      warnings: ["floor", "hand"],
    },
    { title: "Check every leg is tight", detail: "Keep turning until each leg sits flat against the top with no gap." },
    { title: "Lower the shelf onto the legs", detail: "Its corners fit round the legs. Holes for the screws face the legs.", add: ["shelf"] },
    {
      title: "Screw the shelf to the legs",
      detail: "One screw at each corner, through the shelf into the leg.",
      fix: legs.map(([sx, sz], i) => fx("screw", [[sx * xs, ys, sz * lz]], { dir: [sx, 0, 0], on: "shelf", mate: `L${i}`, len: 40, dia: 4 })),
      tools: ["screwdriver"],
    },
    { title: "Turn it over", detail: "Lift it by the top, not by the shelf.", pose: "+y" },
  ];
  return { parts, steps };
}

function slatCoffee(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const n = 7, st = 45, gap = 8;
  const sw = (D - (n - 1) * gap) / n;
  const pitch = sw + gap;
  const zOf = (i: number) => (i - (n - 1) / 2) * pitch;
  const yt = H - st / 2; // tubes run through the middle of the slats
  const tx = [-(W / 2 - 200), 0, W / 2 - 200];
  const L = 45;
  const parts: CustomPart[] = [];
  range(n).forEach((i) => parts.push(part(`S${i}`, "Slat", [W, st, sw], [0, yt, zOf(i)], { material: "wood" })));
  tx.forEach((x, i) => parts.push(part(`T${i}`, "Tube", [20, 20, D - 6], [x, yt, 0], { shape: "cyl", material: "metal" })));
  const legAt: [number, number][] = [[tx[0] + 40, zOf(1)], [tx[2] - 40, zOf(1)], [tx[2] - 40, zOf(5)], [tx[0] + 40, zOf(5)]];
  legAt.forEach(([x, z], i) => parts.push(part(`L${i}`, "Leg", [L, H - st, L], [x, (H - st) / 2, z], { material: "wood" })));
  const legs = legAt.map((_, i) => `L${i}`);
  const spacers = (between: [number, number][], tubes = [0, 1, 2]) =>
    fx("washer", between.flatMap(([a, b]) => tubes.map((t) => [tx[t], yt, (zOf(a) + zOf(b)) / 2] as Vec3)), { dir: [0, 0, 1], len: gap, dia: 26 });
  const steps: CustomStep[] = [
    {
      title: "Tap a long dowel into each leg",
      detail: "Into the hole in the top end. Do this upside down on a rug, the way the rest goes together.",
      fix: legAt.map(([x, z], i) => fx("dowel", [[x, H - st, z]], { dir: UP, on: `L${i}`, mate: z < 0 ? "S1" : "S5", len: 60, dia: 8 })),
      pose: "-y",
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Push a clip onto each leg", detail: "Its two pins go into the holes in the end face.", fix: legAt.map(([x, z], i) => fx("clip", [[x + (x < 0 ? -L / 2 : L / 2), H - st - 20, z]], { dir: [x < 0 ? 1 : -1, 0, 0], on: `L${i}` })) },
    { title: "Screw a threaded rod into each bolt head", detail: "Six of them, by hand until they stop. You need them at the end." },
    { title: "Push the three tubes through the centre slat", detail: "Lay the centre slat on the rug, holes facing the ends. The tubes go through until their marks line up.", add: ["S3", "T0", "T1", "T2"], from: { T0: [0, 0, 400], T1: [0, 0, 400], T2: [0, 0, 400] } },
    { title: "Screw the tubes to the centre slat", detail: "One screw down into each tube holds it in place.", fix: [fx("screw", tx.map((x) => [x + 30, H - st, zOf(3)] as Vec3), { dir: UP, on: "S3", len: 25, dia: 4 })], tools: ["screwdriver"] },
    { title: "Slide six spacers onto the tubes", detail: "One on each tube, on both sides of the centre slat.", fix: [spacers([[2, 3], [3, 4]])] },
    { title: "Slide on the next two slats", detail: "One from each end of the tubes, pushed against the spacers.", add: ["S2", "S4"], from: { S2: [0, 0, -300], S4: [0, 0, 300] } },
    { title: "Slide six more spacers on", fix: [spacers([[1, 2], [4, 5]])] },
    { title: "Slide on the slats with the notches", detail: "Notches at the ends, facing out: the legs go into them.", add: ["S1", "S5"], from: { S1: [0, 0, -300], S5: [0, 0, 300] } },
    { title: "Push the legs into the notches", detail: "The clip on each leg slides into the notch until it stops.", add: legs },
    { title: "Slide the last two spacers onto the middle tube", fix: [spacers([[0, 1], [5, 6]], [1])] },
    { title: "Slide on the outer slats", add: ["S0", "S6"], from: { S0: [0, 0, -300], S6: [0, 0, 300] } },
    {
      title: "Bolt the tube ends and turn it over",
      detail: "A bolt with its threaded rod into each end of the tubes. Tighten them all with the Allen key, then turn the table over.",
      fix: [
        fx("bolt", tx.map((x) => [x, yt, -D / 2] as Vec3), { dir: [0, 0, 1], on: "S0", len: 30, dia: 8 }),
        fx("bolt", tx.map((x) => [x, yt, D / 2] as Vec3), { dir: [0, 0, -1], on: "S6", len: 30, dia: 8 }),
      ],
      tools: ["allen"],
    },
    { title: "Tighten the bolts again", detail: "Standing up, give all six bolts one more turn so the slats sit tight.", pose: "+y", tools: ["allen"] },
  ];
  return { parts, steps };
}

/* ---------- bench with pad ---------- */

function bench(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const P = 40, Hf = H - P, t = 50, rh = 70, rt = 25;
  const xl = W / 2 - t / 2, zl = D / 2 - t / 2;
  const yr = Hf - rh / 2;
  const frame = (sx: number) =>
    compound(sx < 0 ? "EL" : "ER", "Leg frame", [
      { shape: "box", size: [t, Hf, t], pos: [sx * xl, Hf / 2, -zl] },
      { shape: "box", size: [t, Hf, t], pos: [sx * xl, Hf / 2, zl] },
      { shape: "box", size: [t, rh, D - 2 * t], pos: [sx * xl, yr, 0] },
    ], "wood");
  const inner = W - 2 * t;
  const sd = D - 2 * rt;
  const nSl = Math.max(8, Math.round(inner / 80));
  const seat = compound("seat", "Slatted seat", [
    ...range(nSl).map((i): PartPiece => ({ shape: "box", size: [inner / nSl - 18, 20, sd], pos: [-inner / 2 + (inner / nSl) * (i + 0.5), Hf - 10, 0] })),
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [inner, 40, 30], pos: [0, Hf - 40, sz * (sd / 2 - 15)] })),
  ], "wood");
  const parts: CustomPart[] = [
    frame(-1),
    frame(1),
    part("RB", "Long rail", [inner, rh, rt], [0, yr, -D / 2 + rt / 2], { material: "wood" }),
    part("RF", "Long rail", [inner, rh, rt], [0, yr, D / 2 - rt / 2], { material: "wood" }),
    seat,
    part("pad", "Seat pad", [W, P, D], [0, Hf + P / 2, 0], { material: "soft" }),
  ];
  const end = (sx: number) => sx * (W / 2 - t);
  const railZ = (sz: number) => sz * (D / 2 - rt / 2);
  const dowels = (sx: number) => fx("dowel", [-1, 1].flatMap((sz) => [yr - 18, yr + 18].map((y) => [end(sx), y, railZ(sz)] as Vec3)), { dir: [sx, 0, 0], on: sx < 0 ? "EL" : "ER" });
  const nuts = (sx: number) => fx("nut", [-1, 1].map((sz) => [sx * (W / 2 - t - 30), Hf - rh, railZ(sz)] as Vec3), { dir: UP, len: 24, dia: 10 });
  const bolts = (sx: number) => fx("bolt", [-1, 1].map((sz) => [sx * (W / 2), yr, railZ(sz)] as Vec3), { dir: [-sx, 0, 0], on: sx < 0 ? "EL" : "ER", len: 110, dia: 6 });
  const seatX = [-1, 0, 1].map((k) => (k * inner) / 3);
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the leg frames",
      detail: "Lay the leg frames on a rug. Two dowels go into each leg, where a long rail will meet it: start with one frame.",
      add: ["EL"],
      fix: [dowels(-1)],
      pose: "-y",
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Push the long rails onto one leg frame", detail: "Stand the frame on its end rail, legs up, and push both rails onto its dowels.", add: ["RB", "RF"] },
    { title: "Drop two barrel nuts into the rails", detail: "Slot facing the end of the rail, so the bolt can find its thread.", fix: [nuts(-1)], tools: ["flathead"] },
    { title: "Bolt the rails to the leg frame", detail: "A long bolt through each leg into its barrel nut. Not fully tight yet.", fix: [bolts(-1)], tools: ["allen"] },
    { title: "Push the other leg frame onto the rails", detail: "Tap its four dowels in first. They go into the free ends of the rails.", add: ["ER"], fix: [dowels(1)], from: { ER: [400, 0, 0] }, tools: ["hammer"] },
    { title: "Drop in the other two barrel nuts", fix: [nuts(1)], tools: ["flathead"] },
    { title: "Bolt on the other leg frame", detail: "Two more long bolts, not fully tight yet.", fix: [bolts(1)], tools: ["allen"] },
    { title: "Lower the frame onto the slatted seat", detail: "Lay the seat on the rug, battens up, and set the frame down round it.", add: ["seat"] },
    { title: "Drop six barrel nuts into the seat", detail: "Into the holes in the battens, slots facing the rails.", fix: [fx("nut", [-1, 1].flatMap((sz) => seatX.map((x) => [x + 40, Hf - 60, sz * (sd / 2 - 15)] as Vec3)), { dir: UP, len: 12, dia: 10 })], tools: ["flathead"] },
    {
      title: "Bolt the rails to the seat",
      detail: "Six bolts through the long rails into the barrel nuts.",
      fix: [-1, 1].map((sz) => fx("bolt", seatX.map((x) => [x, Hf - 40, sz * (D / 2)] as Vec3), { dir: [0, 0, -sz], on: sz < 0 ? "RB" : "RF", mate: "seat", len: 50, dia: 6 })),
      tools: ["allen"],
    },
    { title: "Tighten the leg bolts", detail: "Now that the seat holds it square, tighten all four long bolts firmly.", tools: ["allen"], check: "square" },
    {
      title: "Stick felt pads under the legs and turn it over",
      detail: "One on the end of each leg, then stand the bench on its feet.",
      fix: [-1, 1].map((sx) => fx("glide", [-1, 1].map((sz) => [sx * xl, 0, sz * zl] as Vec3), { dir: UP, on: sx < 0 ? "EL" : "ER" })),
    },
    { title: "Lay the pad on and fasten its straps", detail: "Pad edges flush with the frame all round. Tuck the four straps under the seat and fasten them.", add: ["pad"], pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- shelving unit and shelving bench: posts with cam pins, shelves with housings ---------- */

interface PostUnit {
  W: number;
  H: number;
  D: number;
  xs: number[]; // post positions along the width
  ys: number[]; // shelf centres
  T: number; // shelf thickness
  t: number; // post section
  wall: boolean;
}

function postUnit(u: PostUnit, kind: "unit" | "bench"): CustomParams {
  const { W, H, D, xs, ys, T, t } = u;
  const zp = D / 2 - t / 2;
  const sd = D - 2 * t;
  const parts: CustomPart[] = [];
  const posts: { id: string; x: number; z: number }[] = [];
  for (const sz of [-1, 1])
    xs.forEach((x, i) => {
      const id = `${sz < 0 ? "B" : "F"}${i}`;
      posts.push({ id, x, z: sz * zp });
      parts.push(part(id, kind === "bench" ? "Leg" : "Post", [t, H, t], [x, H / 2, sz * zp], { material: "wood" }));
    });
  ys.forEach((y, i) => parts.push(part(`S${i}`, kind === "bench" ? (i === ys.length - 1 ? "Top" : "Shelf") : "Shelf", [W, T, sd], [0, y, 0])));
  const top = `S${ys.length - 1}`;
  const xIn = (x: number) => Math.max(-W / 2 + 30, Math.min(W / 2 - 30, x));
  // a pin from the post into the shelf's long edge, and the housing in the shelf that catches it
  const pins = (p: { id: string; x: number; z: number }, only?: number[]) =>
    fx("camScrew", (only ?? ys.map((_, i) => i)).map((i) => [xIn(p.x), ys[i], Math.sign(p.z) * (sd / 2)] as Vec3), { dir: [0, 0, -Math.sign(p.z)], on: p.id, len: 30, dia: 8 });
  const housings = (shelves: number[]) =>
    fx("cam", shelves.flatMap((i) => posts.map((p) => [xIn(p.x) + (p.x > 0 ? -18 : 18), ys[i] + T / 2, Math.sign(p.z) * (sd / 2 - 22)] as Vec3)), { dir: DOWN, dia: 15 });
  const locks = (p: { id: string; x: number; z: number }[], shelves: number[]) =>
    fx("screw", shelves.flatMap((i) => p.map((q) => [xIn(q.x) + (q.x > 0 ? -18 : 18), ys[i] - T / 2, Math.sign(q.z) * (sd / 2 - 22)] as Vec3)), { dir: UP, len: 10, dia: 6 });
  const foot = (p: { id: string; x: number; z: number }) => fx("foot", [[p.x, 0, p.z]], { dir: UP, on: p.id });
  const P = (id: string) => posts.find((p) => p.id === id)!;
  const last = xs.length - 1;
  const bl = P("B0"), br = P(`B${last}`);
  const fronts = posts.filter((p) => p.id[0] === "F");
  const allShelves = ys.map((_, i) => i);
  const steps: CustomStep[] = [];
  const pl = kind === "bench" ? "legs" : "posts";
  const one = kind === "bench" ? "leg" : "post";
  steps.push({
    title: `Screw a foot into each ${one}`,
    detail: `Into the end of each of the ${posts.length} ${pl}, by hand. The cam pins go in next: ${ys.length} along one face of each, screwed in with the Allen key until they stop.`,
    fix: [foot(bl), pins(bl)],
    pose: "+z",
    tools: ["allen"],
    warnings: ["floor"],
  });
  if (kind === "unit") {
    const lower = ys.slice(0, -1).map((_, i) => `S${i}`);
    const yTop = ys[ys.length - 1] - T / 2;
    const brk: Vec3[] = [-1, 1].map((sx) => [sx * (W / 2 - 160), yTop, -sd / 2 + 30]);
    steps.push({
      title: `Press in the housings and stand ${lower.length} shelves on the first post`,
      detail: "Four housings in each shelf, near the ends, pressed flat. The post lies on the rug, pins up: each shelf stands on its back edge and drops onto a pin.",
      add: lower,
      fix: [housings(allShelves.slice(0, -1))],
    });
    steps.push({ title: "Lock them to the post", detail: "Turn the screw in each housing clockwise until it pulls the shelf tight. Not with a drill.", fix: [locks([bl], allShelves.slice(0, -1))], tools: ["screwdriver"] });
    steps.push({
      title: "Screw the wall brackets under the top shelf",
      detail: "Press its housings in, then two brackets at the back edge with a screw and a washer through each. Stand it on the first post as well.",
      add: [top],
      fix: [housings([ys.length - 1]), fx("bracket", brk, { dir: UP, on: top }), fx("screw", brk.map((p) => [p[0] + 20, p[1], p[2]] as Vec3), { dir: UP, on: top, len: 16, dia: 4 }), fx("washer", brk.map((p) => [p[0] + 20, p[1], p[2]] as Vec3), { dir: UP, on: top })],
      tools: ["screwdriver"],
    });
    steps.push({ title: "Lock the top shelf", fix: [locks([bl], [ys.length - 1])], tools: ["screwdriver"] });
    steps.push({
      title: "Lay the front posts on top",
      detail: "Screw their feet and pins in first. Each pin drops into the housing at the front edge of a shelf.",
      add: fronts.map((p) => p.id),
      fix: [...fronts.map((p) => pins(p)), ...fronts.map(foot)],
      tools: ["allen"],
    });
    steps.push({ title: "Lock the shelves to the front posts", fix: [locks(fronts, allShelves)], tools: ["screwdriver"] });
    steps.push({ title: "Turn it over and fit the last post", detail: "Lay it on its front on the rug, foot and pins in the post first.", add: [br.id], fix: [pins(br), foot(br)], pose: "-z", tools: ["allen"] });
    steps.push({ title: "Lock the shelves to the last post", fix: [locks([br], allShelves)], tools: ["screwdriver"] });
    steps.push({ title: "Stand it up together and level it", detail: "Turn the feet with the spanner until it stands straight. Check with a level on the top shelf.", pose: "+y", people: 2, tools: ["wrench", "level"], warnings: ["two"] });
    steps.push({
      title: "Fix it to the wall",
      detail: "Push it against the wall, mark through the slots in the brackets, drill, and screw it on with a washer on each screw. Wall screws aren't included: pick ones made for your wall.",
      fix: [fx("plug", brk.map((p) => [p[0], p[1] - 40, -D / 2] as Vec3), { dir: [0, 0, -1] }), fx("screw", brk.map((p) => [p[0], p[1] - 40, -D / 2 + 4] as Vec3), { dir: [0, 0, -1], len: 50, dia: 5 }), fx("washer", brk.map((p) => [p[0], p[1] - 40, -D / 2 + 8] as Vec3), { dir: [0, 0, -1] })],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    });
  } else {
    const backs = posts.filter((p) => p.id[0] === "B");
    const mid = backs.filter((p) => p !== bl && p !== br);
    steps.push({ title: "Press in the housings and stand the top on the first leg", detail: "Six housings in the top, pressed flat. The leg lies on the rug, pins up: the top stands on its back edge and drops onto the top pin.", add: [top], fix: [housings([ys.length - 1])] });
    steps.push({ title: "Lock it to the leg", detail: "Turn the screw in the housing clockwise until it pulls tight. Not with a drill.", fix: [locks([bl], [ys.length - 1])], tools: ["screwdriver"] });
    steps.push({ title: "Fit the second leg at the other end", detail: "Foot and pins in first, then push it onto the top.", add: [br.id], fix: [pins(br), foot(br)], tools: ["allen"] });
    steps.push({ title: "Lock the top to the second leg", fix: [locks([br], [ys.length - 1])], tools: ["screwdriver"] });
    steps.push({ title: "Press in the housings and stand the shelf on the two legs", detail: "Six housings, then the shelf on its back edge, onto the lower pins.", add: ["S0"], fix: [housings([0])] });
    steps.push({ title: "Lock the shelf", fix: [locks([bl, br], [0])], tools: ["screwdriver"] });
    steps.push({ title: "Lay the front legs on top", detail: "Feet and pins in first. Each pin drops into a housing at the front edge.", add: fronts.map((p) => p.id), fix: [...fronts.map((p) => pins(p)), ...fronts.map(foot)], tools: ["allen"] });
    steps.push({ title: "Lock the shelves to the front legs", fix: [locks(fronts, allShelves)], tools: ["screwdriver"] });
    steps.push({
      title: "Turn it over and fit the middle back leg",
      detail: "Lay it on its front, then foot and pins in the last leg and push it on. Lock both housings.",
      add: mid.map((p) => p.id),
      fix: [...mid.map((p) => pins(p)), ...mid.map(foot), locks(mid, allShelves)],
      pose: "-z",
      tools: ["allen", "screwdriver"],
    });
    steps.push({ title: "Stand it up and level it", detail: "Turn the feet with the spanner until it stands steady on all six.", pose: "+y", tools: ["wrench", "level"] });
  }
  return { parts, steps };
}

function shelvingUnit(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const T = 25, t = 38, n = 5;
  const y0 = 140, y1 = H - T / 2;
  return postUnit({ W, H, D, xs: [-(W / 2 - t / 2), W / 2 - t / 2], ys: range(n).map((i) => y0 + ((y1 - y0) * i) / (n - 1)), T, t, wall: true }, "unit");
}

function shelvingBench(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const T = 25, t = 40;
  return postUnit({ W, H, D, xs: [-(W / 2 - t / 2), 0, W / 2 - t / 2], ys: [110, H - T / 2], T, t, wall: false }, "bench");
}

/* ---------- chairs ---------- */

/** STOCKHOLM 2025 chair: two leg frames halved into a cross, a curved backrest on three tall legs, the round seat. */
function chair2025(s: ProductSpec): CustomParams {
  const { W, H } = dims(s);
  const lt = 45, r = W / 2 - 50;
  const seatY = 450, sT = 90, rh = 50;
  const yr = seatY - sT - rh / 2;
  const leg = (id: string, x: number, z: number, h: number) => part(id, h < H ? "Front leg" : "Tall leg", [lt, h, lt], [x, h / 2, z], { shape: "cyl", material: "wood" });
  const rb = r + lt / 2 + 10;
  const bh = 130;
  const arc = range(5).map((i): PartPiece => {
    const a = ((10 + 40 * i) * Math.PI) / 180;
    return { shape: "box", size: [2 * rb * Math.sin(Math.PI / 9) + 12, bh, 20], pos: [rb * Math.cos(a), H - bh / 2, -rb * Math.sin(a)], rot: [0, a + Math.PI / 2, 0] };
  });
  const parts: CustomPart[] = [
    leg("LL", -r, 0, H),
    leg("LR", r, 0, H),
    part("RX", "Cross rail", [2 * r - lt, rh, 25], [0, yr, 0], { material: "wood" }),
    leg("LB", 0, -r, H),
    leg("LF", 0, r, seatY - sT),
    part("RZ", "Cross rail", [25, rh, 2 * r - lt], [0, yr, 0], { material: "wood" }),
    compound("back", "Backrest", arc, "wood"),
    disc("seat", "Seat", [2 * (r - lt / 2) - 10, sT, 2 * (r - lt / 2) - 10], [0, seatY - sT / 2, 0], "soft"),
  ];
  const out = r + lt / 2;
  const steps: CustomStep[] = [
    {
      title: "Stick the felt pads on the tall legs",
      detail: "Two near the top of each side leg and one on the back leg, on the outside where the backrest will rest.",
      add: ["LL", "LR", "RX", "LB", "LF", "RZ"],
      fix: [fx("glide", [[-out, H - 40, 0], [-out, H - 95, 0]], { dir: [1, 0, 0], on: "LL" }), fx("glide", [[out, H - 40, 0], [out, H - 95, 0]], { dir: [-1, 0, 0], on: "LR" }), fx("glide", [[0, H - 65, -out]], { dir: [0, 0, 1], on: "LB" })],
    },
    { title: "Push the two leg frames together", detail: "The rails cross in the middle: slot one down over the other until both sit flush." },
    { title: "Hook the backrest onto the legs", detail: "Its fittings drop over the heads on the three tall legs. Push it down until it sits level.", add: ["back"], from: { back: [0, 260, 0] } },
    { title: "Bolt the backrest to the side legs", detail: "One bolt through each end of the backrest. Not fully tight yet.", fix: [-1, 1].map((sx) => fx("bolt", [[sx * (rb + 10), H - 70, 0]], { dir: [-sx, 0, 0], on: "back", mate: sx < 0 ? "LL" : "LR", len: 30, dia: 6 })), tools: ["allen"] },
    { title: "Screw the rails together where they cross", detail: "Two screws from underneath with the bit.", fix: [fx("screw", [[0, yr - rh / 2, -14], [0, yr - rh / 2, 14]], { dir: UP, on: "RX", mate: "RZ", len: 30, dia: 5 })], tools: ["screwdriver"] },
    {
      title: "Turn it upside down onto the seat and bolt it on",
      detail: "Lay the seat upside down on a soft table or rug and lower the frame onto it. Four long bolts through the rails into the seat.",
      add: ["seat"],
      fix: [
        fx("bolt", [[-r / 2, yr - rh / 2, 0], [r / 2, yr - rh / 2, 0]], { dir: UP, on: "RX", mate: "seat", len: 100, dia: 6 }),
        fx("bolt", [[0, yr - rh / 2, -r / 2], [0, yr - rh / 2, r / 2]], { dir: UP, on: "RZ", mate: "seat", len: 100, dia: 6 }),
      ],
      pose: "-y",
      tools: ["allen"],
      warnings: ["floor"],
    },
    { title: "Turn it over and tighten the backrest bolts", detail: "Standing up, tighten both bolts firmly.", pose: "+y", tools: ["allen"] },
  ];
  return { parts, steps };
}

/** The older chair with armrests: a seat frame and four leaning legs upside down, the seat, then the armrest top on plates. */
function armChair(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const lt = 40, fh = 60, seatY = 450;
  const yf = seatY - 20 - fh / 2; // frame rails, under the seat
  const fx0 = W / 2 - 70, fz0 = D / 2 - 70; // frame corners
  const armY = 640;
  const legF = (sx: number) => stick(sx < 0 ? "FL" : "FR", "Front leg", [sx * (fx0 + 40), 0, fz0 + 40], [sx * fx0, armY, fz0 - 10], lt);
  const legB = (sx: number) => stick(sx < 0 ? "BL" : "BR", "Back leg", [sx * (fx0 + 40), 0, -fz0 - 70], [sx * fx0, H - 40, -fz0 + 10], lt);
  // where each leg crosses the frame's height (they lean), so the side rails reach them and the bolts join the two
  const legAt = (sz: number) => {
    const [a, b] = sz > 0 ? [[fx0 + 40, fz0 + 40, armY], [fx0, fz0 - 10]] as const : [[fx0 + 40, -fz0 - 70, H - 40], [fx0, -fz0 + 10]] as const;
    const k = yf / a[2];
    return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k };
  };
  const lf = legAt(1), lb = legAt(-1);
  const rx = fx0 - 15.5; // side rails, against the legs
  const frame = compound("frame", "Seat frame", [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [25, fh, lf.z - lb.z], pos: [sx * rx, yf, (lf.z + lb.z) / 2] })),
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [2 * rx - 25, fh, 25], pos: [0, yf, sz * (fz0 - lt / 2 - 12.5)] })),
  ], "wood");
  const len = 2 * fz0;
  const drop = H - 40 - armY;
  const tilt = Math.atan2(drop, len);
  const top = compound("top", "Armrest and back", [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [45, 30, Math.hypot(len, drop) + 40], pos: [sx * fx0, (armY + H - 40) / 2 + 15, 0], rot: [tilt, 0, 0] })),
    { shape: "box", size: [2 * fx0 - 45, 90, 30], pos: [0, H - 45, -fz0 + 10] },
  ], "wood");
  const plF = fz0 - 10, plB = -fz0 + 10; // leg tops, under the armrest piece
  const parts: CustomPart[] = [frame, legF(-1), legF(1), legB(-1), legB(1), part("seat", "Seat", [2 * fx0 - 30, 60, 2 * fz0 - 20], [0, seatY - 20, 0], { material: "soft" }), top];
  const boltAt = (sx: number, sz: number): Vec3 => [sx * ((sz > 0 ? lf : lb).x + lt / 2), yf, (sz > 0 ? lf : lb).z];
  const steps: CustomStep[] = [
    {
      title: "Fit the barrel nuts and bolts into the frame",
      detail: "Lay the seat frame upside down on a rug. A barrel nut in each corner, then a bolt turned in until about 5 cm sticks out.",
      add: ["frame"],
      fix: [fx("nut", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * rx, yf - fh / 2, (sz > 0 ? lf : lb).z] as Vec3)), { dir: UP, len: 14, dia: 10 }), ...[-1, 1].map((sx) => fx("bolt", [-1, 1].map((sz) => boltAt(sx, sz)), { dir: [-sx, 0, 0], on: "frame", len: 60, dia: 6 }))],
      pose: "-y",
      tools: ["allen"],
      warnings: ["floor"],
    },
    { title: "Push the front legs onto the bolts", detail: "The bolt heads slide into the slots in the legs.", add: ["FL", "FR"] },
    { title: "Tighten the front legs", detail: "Through the hole in each leg, with the long Allen key.", tools: ["allen"] },
    { title: "Push the back legs onto the bolts", detail: "The longer legs, leaning back.", add: ["BL", "BR"] },
    { title: "Tighten the back legs", tools: ["allen"] },
    { title: "Bend the seat into shape", detail: "Flex it gently along its edges so it sits round in the frame." },
    { title: "Turn it over and drop the seat in", add: ["seat"], pose: "+y" },
    { title: "Bolt the seat to the frame", detail: "Two long bolts up from underneath through the front and back rails.", fix: [fx("bolt", [-1, 1].map((sz) => [0, yf - fh / 2, sz * (fz0 - lt / 2 - 12.5)] as Vec3), { dir: UP, on: "frame", mate: "seat", len: 80, dia: 6 })], tools: ["allen"] },
    { title: "Screw a plate onto each front leg", detail: "Plate flat on the top end, one countersunk screw through the hole over the leg.", fix: [-1, 1].flatMap((sx) => [fx("plate", [[sx * fx0, armY, plF - 24]], { dir: DOWN, on: sx < 0 ? "FL" : "FR" }), fx("screw", [[sx * fx0, armY, plF]], { dir: DOWN, on: sx < 0 ? "FL" : "FR", len: 20, dia: 4 })]), tools: ["screwdriver"] },
    { title: "Screw a plate onto each back leg", detail: "The free hole of each plate points to the front.", fix: [-1, 1].flatMap((sx) => [fx("plate", [[sx * fx0, H - 40, plB + 24]], { dir: DOWN, on: sx < 0 ? "BL" : "BR" }), fx("screw", [[sx * fx0, H - 40, plB]], { dir: DOWN, on: sx < 0 ? "BL" : "BR", len: 20, dia: 4 })]), tools: ["screwdriver"] },
    {
      title: "Turn it upside down onto the armrests",
      detail: "Lay the armrest piece upside down on the rug and lower the chair onto it. Two screws through the front plates.",
      add: ["top"],
      fix: [fx("screw", [-1, 1].map((sx) => [sx * fx0, armY, plF - 48] as Vec3), { dir: UP, on: "top", len: 16, dia: 5 })],
      pose: "-y",
      tools: ["screwdriver"],
    },
    { title: "Screw the back plates on", detail: "Two more screws, then turn the chair over.", fix: [fx("screw", [-1, 1].map((sx) => [sx * fx0, H - 40, plB + 48] as Vec3), { dir: UP, on: "top", len: 16, dia: 5 })], tools: ["screwdriver"] },
    { title: "Stand it up", pose: "+y" },
  ];
  return { parts, steps };
}

/** STOCKHOLM 2025 easy chair: two side frames on dowels, two rails bolted between them, the woven seat bolted in. */
function easyChair(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const t = 40, armY = 450;
  const xs = W / 2 - t / 2;
  const zb = -D / 2 + 140, zf = D / 2 - 60; // back post, front upstand
  const side = (sx: number) => ({
    run: part(sx < 0 ? "RL" : "RR", "Runner", [t, t, D], [sx * xs, t / 2, 0], { material: "wood" }),
    post: part(sx < 0 ? "PL" : "PR", "Back post", [t, H - t, t], [sx * xs, t + (H - t) / 2, zb], { material: "wood" }),
    arm: compound(sx < 0 ? "AL" : "AR", "Armrest", [
      { shape: "box", size: [t, t, zf - zb], pos: [sx * xs, armY + t / 2, (zb + zf + t) / 2] },
      { shape: "box", size: [t, armY - t, t], pos: [sx * xs, t + (armY - t) / 2, zf] },
    ], "wood"),
  });
  const L = side(-1), R = side(1);
  const inner = W - 2 * t;
  const sTop: Vec3 = [0, H - 40, zb], sLow: Vec3 = [0, 330, zf];
  const sl = Math.hypot(sTop[1] - sLow[1], sTop[2] - sLow[2]);
  const ang = Math.atan2(sTop[1] - sLow[1], sLow[2] - sTop[2]);
  const seat = compound("seat", "Woven seat", [
    { shape: "box", size: [inner, 14, sl], pos: [0, (sTop[1] + sLow[1]) / 2, (sTop[2] + sLow[2]) / 2], rot: [ang, 0, 0] },
    { shape: "box", size: [inner, 40, 40], pos: sTop },
    { shape: "box", size: [inner, 40, 40], pos: sLow },
  ], "soft");
  const parts: CustomPart[] = [
    part("CB", "Rail", [inner, t, t], [0, t / 2, zb], { material: "wood" }),
    part("CF", "Rail", [inner, t, t], [0, t / 2, zf - 60], { material: "wood" }),
    L.run, L.post, L.arm, R.run, R.post, R.arm, seat,
  ];
  // the rails take two dowels in each end, into the runners; the posts come with their dowels in
  const railDowels: CustomFix[] = ["CB", "CF"].flatMap((id, i) =>
    [-1, 1].map((sx) => fx("dowel", [-12, 12].map((dz) => [sx * (inner / 2), t / 2, (i ? zf - 60 : zb) + dz] as Vec3), { dir: [-sx, 0, 0], on: id, mate: sx < 0 ? "RL" : "RR", len: 30, dia: 8 })),
  );
  const railZ = [zb, zf - 60];
  const steps: CustomStep[] = [
    { title: "Tap the dowels into the rails", detail: "Two in each end of both rails, on a rug.", fix: railDowels, wait: ["CB", "CF"], tools: ["hammer"], warnings: ["floor"] },
    { title: "Push the back post into a runner", detail: "Stand it in the holes near the back of the curved runner.", add: ["RL", "PL"] },
    { title: "Push the armrest onto the post and runner", detail: "Its back end goes onto the top of the post and its front leg into the end of the runner.", add: ["AL"] },
    {
      title: "Lay the side down and stand the rails in it",
      detail: "Build the other side the same way. Lay this one on its outer face and push both rails onto its dowels.",
      add: ["CB", "CF"],
      pose: "+x",
    },
    { title: "Put the other side on top", detail: "Lower it onto the dowels in the rails.", add: ["RR", "PR", "AR"] },
    {
      title: "Drop four barrel nuts into the rails",
      detail: "Turn it upside down. The slot in each nut faces the hole for the bolt.",
      fix: [fx("nut", [-1, 1].flatMap((sx) => railZ.map((z) => [sx * (inner / 2 - 45), 0, z] as Vec3)), { dir: UP, len: 20, dia: 10 })],
      pose: "-y",
      tools: ["flathead"],
    },
    {
      title: "Bolt the runners to the rails",
      detail: "Four long bolts through the runners into the barrel nuts. Turn it the right way up when they're tight.",
      fix: [-1, 1].map((sx) => fx("bolt", railZ.map((z) => [sx * (W / 2), t / 2, z] as Vec3), { dir: [-sx, 0, 0], on: sx < 0 ? "RL" : "RR", len: 100, dia: 6 })),
      tools: ["allen"],
    },
    {
      title: "Bolt the top of the seat to the back posts",
      detail: "Hold the seat rail against the posts and turn a bolt through each post into it.",
      add: ["seat"],
      fix: [-1, 1].map((sx) => fx("bolt", [[sx * (W / 2), sTop[1], sTop[2]]], { dir: [-sx, 0, 0], on: sx < 0 ? "PL" : "PR", mate: "seat", len: 60, dia: 6 })),
      pose: "+y",
      tools: ["allen"],
    },
    {
      title: "Bolt the front of the seat on",
      detail: "Two more bolts through the armrests into the front seat rail.",
      fix: [-1, 1].map((sx) => fx("bolt", [[sx * (W / 2), sLow[1], sLow[2]]], { dir: [-sx, 0, 0], on: sx < 0 ? "AL" : "AR", mate: "seat", len: 60, dia: 6 })),
      tools: ["allen"],
    },
    { title: "Stick the felt pads under the runners", detail: "Two under each runner, at the front and the back.", fix: [-1, 1].map((sx) => fx("glide", [[sx * xs, 0, -D / 2 + 40], [sx * xs, 0, D / 2 - 40]], { dir: UP, on: sx < 0 ? "RL" : "RR" })), pose: "-y" },
    { title: "Turn it the right way up", pose: "+y" },
  ];
  return { parts, steps };
}

/** STOCKHOLM 2025 armchair: a round backrest on two posts that go through the seat, two front legs, upholstered. */
function roundArmchair(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const legH = 150, seatT = 240, seatTop = legH + seatT;
  const pr = 30, px = W / 2 - 180, pz = -D / 2 + 170;
  const rb = W / 2 - 60, bh = H - seatTop - 20;
  const arc = range(5).map((i): PartPiece => {
    const a = ((20 + 35 * i) * Math.PI) / 180;
    return { shape: "box", size: [2 * rb * Math.sin((17.5 * Math.PI) / 180) + 40, bh, 110], pos: [rb * Math.cos(a), H - bh / 2, -rb * Math.sin(a) + 40], rot: [0, a + Math.PI / 2, 0] };
  });
  const parts: CustomPart[] = [
    compound("back", "Backrest", arc, "soft"),
    part("PL", "Back post", [2 * pr, H - bh, 2 * pr], [-px, (H - bh) / 2, pz], { shape: "cyl", material: "wood" }),
    part("PR", "Back post", [2 * pr, H - bh, 2 * pr], [px, (H - bh) / 2, pz], { shape: "cyl", material: "wood" }),
    disc("seat", "Seat", [W - 40, seatT, D - 40], [0, legH + seatT / 2, 0], "soft"),
    part("FL", "Front leg", [80, legH, 80], [-(W / 2 - 170), legH / 2, D / 2 - 170], { shape: "cyl", material: "wood" }),
    part("FR", "Front leg", [80, legH, 80], [W / 2 - 170, legH / 2, D / 2 - 170], { shape: "cyl", material: "wood" }),
  ];
  const yb = H - bh;
  const steps: CustomStep[] = [
    { title: "Push the posts into the backrest", detail: "Each post slides up into its sleeve under the backrest and turns to lock.", add: ["back", "PL", "PR"], from: { PL: [0, -300, 0], PR: [0, -300, 0] } },
    { title: "Screw a stud into each post", detail: "Into the hole near the top of the post, by hand until it stops.", fix: [-1, 1].map((v) => fx("stud", [[v * px, yb + 40, pz + pr]], { dir: [0, 0, -1], on: v < 0 ? "PL" : "PR", len: 60, dia: 8 })), warnings: ["hand"] },
    { title: "Open the cover under the seat", detail: "Undo the zip at the back so you can reach the frame inside.", add: ["seat"] },
    { title: "Lay it on its back and slide the posts in", detail: "The posts go through the holes in the seat frame, studs first.", pose: "+z" },
    { title: "Push the posts all the way through", detail: "Until the marks on the posts line up with the frame." },
    { title: "Screw in the other two studs", detail: "Through the frame into the posts, by hand.", fix: [fx("stud", [-1, 1].map((sx) => [sx * px, legH + 40, pz + pr] as Vec3), { dir: [0, 0, -1], len: 60, dia: 8 })], warnings: ["hand"] },
    {
      title: "Tighten the nuts with the box spanner",
      detail: "A washer and a nut on each of the four studs, the two big washers on the lower ones.",
      fix: [fx("washer", [-1, 1].flatMap((sx) => [yb + 40, legH + 40].map((y) => [sx * px, y, pz + pr + 30] as Vec3)), { dir: [0, 0, -1] }), fx("nut", [-1, 1].flatMap((sx) => [yb + 40, legH + 40].map((y) => [sx * px, y, pz + pr + 34] as Vec3)), { dir: [0, 0, -1], len: 6, dia: 8 }), fx("washer", [-1, 1].map((sx) => [sx * px, legH + 40, pz + pr + 26] as Vec3), { dir: [0, 0, -1], len: 3, dia: 40 })],
      tools: ["wrench"],
    },
    { title: "Close the cover", detail: "Pull it tight over the frame and zip it shut." },
    { title: "Screw in the front legs", detail: "Clockwise by hand until each sits tight.", add: ["FL", "FR"], warnings: ["hand"] },
    { title: "Stick felt pads under the legs", detail: "One under each leg and post, then stand it up.", fix: [fx("glide", [[-px, 0, pz], [px, 0, pz], [-(W / 2 - 170), 0, D / 2 - 170], [W / 2 - 170, 0, D / 2 - 170]], { dir: UP })] },
    { title: "Stand it up", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- sofas ---------- */

/** STOCKHOLM 2025: each module is one upholstered block on felt pads; fold-out brackets join them. */
function modular(s: ProductSpec): CustomParams | null {
  const { W, H, D } = dims(s);
  const v = s.variant.toLowerCase();
  const armW = 890, secW = 650;
  const kinds: ("L" | "S" | "R")[] = /1-seat section/.test(v) ? ["S"] : /2-seat/.test(v) ? ["L", "R"] : /3-seat/.test(v) ? ["L", "S", "R"] : /4-seat/.test(v) ? ["L", "S", "S", "R"] : [];
  if (!kinds.length) return null;
  const widths = kinds.map((k) => (k === "S" ? (kinds.length === 1 ? W : secW) : armW));
  const total = widths.reduce((a, b) => a + b, 0);
  const seatH = 420, bt = 230, aw = 220;
  const parts: CustomPart[] = [];
  let x = -total / 2;
  const mods = kinds.map((k, i) => {
    const w = widths[i], cx = x + w / 2;
    x += w;
    const pieces: PartPiece[] = [
      { shape: "box", size: [w, seatH, D], pos: [cx, seatH / 2, 0] },
      { shape: "box", size: [w, H - seatH, bt], pos: [cx, seatH + (H - seatH) / 2, -D / 2 + bt / 2] },
    ];
    if (k !== "S") {
      const ax = k === "L" ? cx - w / 2 + aw / 2 : cx + w / 2 - aw / 2;
      pieces.push({ shape: "box", size: [aw, H - 60 - seatH, D - bt], pos: [ax, seatH + (H - 60 - seatH) / 2, bt / 2] });
    }
    const id = `M${i}`;
    parts.push(compound(id, k === "S" ? "1-seat section" : k === "L" ? "Left armrest section" : "Right armrest section", pieces, "soft"));
    return { id, cx, w };
  });
  const pads = (m: { id: string; cx: number; w: number }) => fx("glide", corners(m.w / 2 - 80, D / 2 - 80).map(([dx, z]) => [m.cx + dx, 0, z] as Vec3), { dir: UP, on: m.id, len: 4, dia: 40 });
  const steps: CustomStep[] = [];
  const [first, ...rest] = mods;
  steps.push({
    title: kinds.length > 1 ? "Tip a module onto its back and stick on the pads" : "Tip it onto its back and stick on the pads",
    detail: "On a clean floor. Four felt pads under it, one in each corner, pressed on firmly.",
    add: [first.id],
    fix: [pads(first)],
    pose: "+z",
    warnings: ["floor"],
  });
  steps.push({
    title: "Fold out the connecting brackets",
    detail: kinds.length > 1 ? "Two on the side that meets the next module: swing them out until they stop, then stand it up." : "Two on the side that meets the next module: swing them out until they stop, then stand it up.",
    pose: "+y",
  });
  for (const m of rest)
    steps.push({
      title: "Stick pads under the next module and push it on",
      detail: "Pads first, tipped on its back. Then line its slots up with the brackets and push the two together until the seams close.",
      add: [m.id],
      fix: [pads(m)],
      from: { [m.id]: [500, 0, 0] },
    });
  if (kinds.length === 1)
    steps.push({ title: "Push it against the next module", detail: "Line the brackets up with the slots in its neighbour and push until the two sit tight together." });
  return { parts, steps };
}

/** The older leather sofa: four legs bolted on upside down, then its seat, back and arm cushions. */
function leatherSofa(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const legH = 110, armW = 150, armTop = 640, base = 400, bt = 200;
  const inner = W - 2 * armW;
  const frame = compound("frame", "Sofa frame", [
    { shape: "box", size: [inner, base - legH, D - bt], pos: [0, legH + (base - legH) / 2, bt / 2] },
    { shape: "box", size: [W, 620 - legH, bt], pos: [0, legH + (620 - legH) / 2, -D / 2 + bt / 2] },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [armW, armTop - legH, D - bt], pos: [sx * (W / 2 - armW / 2), legH + (armTop - legH) / 2, bt / 2] })),
  ], "soft");
  const parts: CustomPart[] = [frame];
  const lp = corners(W / 2 - 60, D / 2 - 60);
  lp.forEach(([x, z], i) => parts.push(part(`L${i}`, "Leg", [45, legH, 45], [x, legH / 2, z], { shape: "cyl", material: "metal" })));
  const seatT = 150, sd = D - bt - 20;
  [-1, 1].forEach((sx, i) => parts.push(part(`C${i}`, "Seat cushion", [inner / 2 - 4, seatT, sd], [sx * (inner / 4), base + seatT / 2, -D / 2 + bt + sd / 2], { material: "soft" })));
  const bw = inner / 3 - 4, bh = H - base - seatT + 60;
  range(3).forEach((i) => parts.push(part(`K${i}`, "Back cushion", [bw, bh, 170], [-inner / 2 + (inner / 3) * (i + 0.5), H - bh / 2, -D / 2 + bt + 85], { material: "soft" })));
  [-1, 1].forEach((sx, i) => parts.push(part(`A${i}`, "Arm cushion", [armW, 170, 220], [sx * (W / 2 - armW / 2), armTop + 85, -D / 2 + bt + 110], { material: "soft" })));
  const steps: CustomStep[] = [
    { title: "Turn the frame upside down", detail: "On a rug or the packaging, so the leather isn't scratched.", add: ["frame"], pose: "-y", people: 2, warnings: ["two", "floor"] },
    {
      title: "Bolt on the legs",
      detail: "A washer on each bolt, through the leg's plate into the frame. Tighten with the Allen key.",
      add: lp.map((_, i) => `L${i}`),
      fix: [fx("washer", lp.map(([x, z]) => [x, legH, z] as Vec3), { dir: UP }), fx("bolt", lp.map(([x, z]) => [x, legH, z] as Vec3), { dir: UP, len: 50, dia: 8 })],
      tools: ["allen"],
    },
    { title: "Turn it over together", detail: "Lift it, don't tip it onto the legs.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Lay in the seat cushions", detail: "Zips facing the back.", add: ["C0", "C1"] },
    { title: "Put the back cushions in place", detail: "Push them down behind the seat cushions so they stand straight.", add: ["K0", "K1", "K2"] },
    { title: "Add the arm cushions", detail: "One in each back corner, on top of the armrests.", add: ["A0", "A1"] },
  ];
  return { parts, steps };
}

/* ---------- cabinets: 2 doors on legs, glass-door, sliding doors ---------- */

/**
 * A flat frame of four members round a fill (glass, rattan, a board), as pieces about its centre. `thin` is the
 * axis it is thin along; the members are `m` wide. With no fill it is an open frame.
 */
function framed(size: Vec3, thin: 0 | 1 | 2, m: number, fill: PartMaterial | null, frame: PartMaterial = "wood", bars = 0): PartPiece[] {
  const [a, b] = ([0, 1, 2] as const).filter((k) => k !== thin);
  const vec = (va: number, vb: number, vt: number): Vec3 => {
    const v: Vec3 = [0, 0, 0];
    v[a] = va;
    v[b] = vb;
    v[thin] = vt;
    return v;
  };
  const A = size[a], B = size[b], T = size[thin];
  const out: PartPiece[] = [];
  for (const s of [-1, 1]) {
    out.push({ shape: "box", size: vec(A, m, T), pos: vec(0, s * (B / 2 - m / 2), 0), material: frame });
    out.push({ shape: "box", size: vec(m, B - 2 * m, T), pos: vec(s * (A / 2 - m / 2), 0, 0), material: frame });
  }
  // cross bars dividing the fill into panes (the rattan backs and doors have them)
  if (bars) {
    out.push({ shape: "box", size: vec(A - 2 * m, m * 0.6, T * 0.8), pos: vec(0, 0, 0), material: frame });
    out.push({ shape: "box", size: vec(m * 0.6, B - 2 * m, T * 0.8), pos: vec(0, 0, 0), material: frame });
  }
  if (fill) out.push({ shape: "box", size: vec(A - m, B - m, fill === "glass" ? 5 : Math.min(T, 8)), pos: vec(0, 0, 0), material: fill });
  return out;
}

const panel = (id: string, name: string, size: Vec3, pos: Vec3, pieces: PartPiece[], material: PartMaterial = "wood"): CustomPart => ({ id, name, size, pos, pieces, material });
const named = (kind: CustomFix["kind"], name: string, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => fx(kind, at, { name, ...o });
const SIDES = [-1, 1] as const;

/** Cabinet with 2 doors: two side frames with legs, built on its side, then upside down, then the top, wall and doors. */
function cabinet2(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const P = 34, Tt = 20, Bt = 22, yB = Math.round(H * 0.36), yTop = H - Tt, yRail = 130;
  const xi = W / 2 - P, xp = W / 2 - P / 2, zp = D / 2 - P / 2;
  const zBack = -D / 2 + P - 8; // the back between the back legs, flush with their inside
  const yIn = yB + Bt; // floor of the cabinet
  const parts: CustomPart[] = [];
  SIDES.forEach((sx, i) =>
    parts.push(
      compound(i ? "R" : "L", "Side frame", [
        ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [P, yTop, P], pos: [sx * xp, yTop / 2, sz * zp], material: "wood" })),
        { shape: "box", size: [16, yTop - yB, D - 2 * P], pos: [sx * (xi + 8), (yB + yTop) / 2, 0], material: "board" },
        { shape: "box", size: [24, 30, D - 2 * P], pos: [sx * xp, yRail, 0], material: "wood" },
        // the rail the bottom rests on
        { shape: "box", size: [36, 30, D - 2 * P], pos: [sx * (xi - 2), yB - 15, 0], material: "wood" },
      ], "wood"),
    ),
  );
  const ym = (yB + yTop) / 2;
  parts.push(part("B0", "Back panel", [2 * xi, ym - yB, 16], [0, (yB + ym) / 2, zBack]));
  parts.push(part("B1", "Back panel", [2 * xi, yTop - ym, 16], [0, (ym + yTop) / 2, zBack]));
  parts.push(part("RL", "Rail", [2 * (xp - 12), 30, 24], [0, yRail, 0], { material: "wood" }));
  parts.push(part("BT", "Bottom", [2 * xi, Bt, D - 2 * P], [0, yB + Bt / 2, 0]));
  parts.push(part("TOP", "Top", [W, Tt, D], [0, H - Tt / 2, 0]));
  const inner = yTop - yIn;
  const shelfYs = [1, 2].map((k) => yIn + (inner * k) / 3);
  shelfYs.forEach((y, i) => parts.push(part(`S${i}`, "Shelf", [2 * xi - 4, 18, D - 2 * P - 24], [0, y, -12])));
  const dh = inner - 4, dz = D / 2 - 12;
  SIDES.forEach((sx, i) => parts.push(part(`D${i}`, "Door", [xi - 2, dh, 18], [sx * (xi / 2), yIn + 2 + dh / 2, dz])));

  const sideId = (sx: number) => (sx < 0 ? "L" : "R");
  const backYs = [yB + 60, yTop - 60];
  const hingeYs = [yIn + 110, yTop - 110];
  const plates: Vec3[] = SIDES.flatMap((sx) => hingeYs.map((y) => [sx * xi, y, D / 2 - P - 40] as Vec3));
  const backBolts = (sx: number) => backYs.map((y, i) => fx("camScrew", [[sx * xi, y, zBack]], { dir: [sx, 0, 0], on: sideId(sx), mate: `B${i}` }));
  const backLocks = (sx: number) => fx("cam", backYs.map((y) => [sx * (xi - 35), y, zBack + 8] as Vec3), { dir: [0, 0, -1] });
  const topCams: Vec3[] = SIDES.flatMap((sx) => [-1, 1].map((sz) => [sx * (xi + 8), yTop, sz * (D / 2 - P - 60)] as Vec3));
  const lockAt = [-30, yTop, D / 2 - 40] as Vec3;
  const supports: Vec3[] = SIDES.flatMap((sx) => shelfYs.flatMap((y) => [-1, 1].map((sz) => [sx * xi, y - 9, sz * (D / 2 - P - 50) - 12] as Vec3)));
  const spacers: Vec3[] = SIDES.map((sx) => [sx * (xi - 90), yTop - 70, zBack - 8]);
  const wallAt: Vec3[] = SIDES.map((sx) => [sx * (xi - 90), yTop - 140, zBack - 8]);
  const hinges: Vec3[] = SIDES.flatMap((sx) => hingeYs.map((y) => [sx * (xi - 30), y, dz - 9] as Vec3));
  const meet = (sx: number, y: number): Vec3 => [sx * 30, y, dz - 9];
  const yLock = yIn + dh * 0.55;

  const steps: CustomStep[] = [
    {
      title: "Screw the hinge plates onto the side frames",
      detail: "Lay both frames on a rug, inside up. Two plates near the front edge of each, two screws in each plate.",
      fix: [...SIDES.map((sx) => named("plate", "Mounting plate", plates.filter((p) => Math.sign(p[0]) === sx), { dir: [sx, 0, 0], on: sideId(sx), len: 12, dia: 40 })), ...SIDES.map((sx) => fx("screw", plates.filter((p) => Math.sign(p[0]) === sx).flatMap((p) => [[p[0], p[1] + 25, p[2]], [p[0], p[1] - 25, p[2]]] as Vec3[]), { dir: [sx, 0, 0], on: sideId(sx), len: 13, dia: 4 }))],
      wait: ["L", "R"],
      pose: "+x",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Screw in the cam bolts",
      detail: "Three in each frame: two along the back leg for the back, one in the low rail. Turn them in until they stop.",
      fix: [...backBolts(-1), ...backBolts(1), ...SIDES.map((sx) => fx("camScrew", [[sx * (xp - 12), yRail, 0]], { dir: [sx, 0, 0], on: sideId(sx), mate: "RL" }))],
      tools: ["screwdriver"],
    },
    {
      title: "Push the dowels into the back panels",
      detail: "Three along the joint between the two halves, and two in each end.",
      fix: [
        fx("dowel", [-1, 0, 1].map((k) => [k * xi * 0.6, ym, zBack] as Vec3), { dir: [0, -1, 0], on: "B0", mate: "B1" }),
        ...SIDES.map((sx) => fx("dowel", [(yB + ym) / 2, (ym + yTop) / 2].map((y) => [sx * xi, y, zBack] as Vec3), { dir: [-sx, 0, 0], mate: sideId(sx) })),
      ],
      wait: ["B0", "B1"],
    },
    {
      title: "Stand the back on the left side frame",
      detail: "The left frame lies on the rug, inside up. Press the two halves of the back together and down onto the dowels and cam bolts.",
      add: ["L", "B0", "B1"],
      from: { B0: [0, 0, 0], B1: [0, 0, 0] },
    },
    { title: "Lock the back to the frame", detail: "Two cam locks in the back, arrows towards the edge, turned clockwise until tight.", fix: [backLocks(-1)], tools: ["screwdriver"] },
    {
      title: "Stand it upside down and slide in the rail",
      detail: "Tip it up so the legs point at the ceiling. The low rail goes onto the cam bolt in the side frame, holes facing up.",
      add: ["RL"],
      pose: "-y",
    },
    { title: "Put on the other side frame", detail: "Onto the dowels and cam bolts in the back and the end of the rail.", add: ["R"] },
    { title: "Lock the back to the second frame", detail: "Two more cam locks in the back.", fix: [backLocks(1)], tools: ["screwdriver"] },
    {
      title: "Lock the rail",
      detail: "One cam lock in each end of the rail, turned until it pulls tight.",
      fix: [fx("cam", SIDES.map((sx) => [sx * (xp - 45), yRail - 15, 0] as Vec3), { dir: [0, 1, 0], on: "RL" })],
      tools: ["screwdriver"],
    },
    { title: "Lay the bottom in", detail: "Between the side frames, against the back, holes facing the legs.", add: ["BT"] },
    {
      title: "Screw the bottom in place",
      detail: "One long screw at each corner, through the rail of the side frame into the bottom, turned in with the Allen key.",
      fix: SIDES.map((sx) => named("bolt", "Connector screw", [-1, 1].map((sz) => [sx * (xi - 10), yB - 30, sz * (D / 2 - P - 30)] as Vec3), { dir: [0, 1, 0], on: sideId(sx), mate: "BT", len: 50, dia: 7 })),
      tools: ["allen"],
    },
    {
      title: "Screw a foot into each leg",
      detail: "By hand, all four the same way in.",
      fix: [fx("foot", SIDES.flatMap((sx) => [-1, 1].map((sz) => [sx * xp, 0, sz * zp] as Vec3)), { dir: [0, 1, 0], len: 20, dia: 26 })],
      warnings: ["hand"],
    },
    {
      title: "Screw the strike plate under the top",
      detail: "Lay the top upside down on the rug. The plate goes near the front edge, a little left of the middle, with two screws.",
      fix: [named("clip", "Strike plate", [lockAt], { dir: [0, 1, 0], on: "TOP", len: 6, dia: 30 }), fx("screw", [[lockAt[0] - 25, yTop, lockAt[2]], [lockAt[0] + 25, yTop, lockAt[2]]], { dir: [0, 1, 0], on: "TOP", len: 13, dia: 4 })],
      wait: ["TOP"],
      tools: ["screwdriver"],
    },
    { title: "Screw four cam bolts into the top", detail: "One near each corner, over the side panels.", fix: [fx("camScrew", topCams, { dir: [0, 1, 0], on: "TOP" })], tools: ["screwdriver"] },
    { title: "Turn the cabinet the right way up", detail: "Lift it together onto its feet.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Lower the top on", detail: "The cam bolts drop into the holes at the top of the side panels.", add: ["TOP"] },
    {
      title: "Lock the top",
      detail: "Four cam locks inside the side panels, just under the top, turned clockwise until tight.",
      fix: SIDES.map((sx) => fx("cam", topCams.filter((p) => Math.sign(p[0]) === sx).map((p) => [sx * xi, yTop - 30, p[2]] as Vec3), { dir: [sx, 0, 0], on: sideId(sx) })),
      tools: ["screwdriver"],
    },
    {
      title: "Press the wall spacers into the back",
      detail: "Two near the top corners, pushed into their holes.",
      fix: [fx("spacer", spacers, { dir: [0, 0, 1], len: 25, dia: 30 })],
    },
    {
      title: "Push it to the wall and set the spacers",
      detail: "Turn each spacer out until it touches the wall and the cabinet stands straight. Over a skirting board, screw the extensions on first.",
      warnings: ["wall"],
    },
    { title: "Level it with the feet", detail: "Turn the feet with the spanner until the top is level side to side and front to back.", tools: ["wrench", "level"] },
    { title: "Mark and drill the wall", detail: "Pull it forward a little, mark through the two holes near the top of the back, and drill.", tools: ["pencil", "drill"], warnings: ["wall"] },
    {
      title: "Screw it to the wall",
      detail: "Push it back, then a washer on each screw through the back into the wall. Click the cover caps on. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", wallAt.map((p) => [p[0], p[1], -D / 2 - 30] as Vec3), { dir: [0, 0, -1] }),
        fx("washer", wallAt, { dir: [0, 0, -1], dia: 24 }),
        fx("screw", wallAt, { dir: [0, 0, -1], len: 50, dia: 5 }),
        fx("cap", wallAt.map((p) => [p[0], p[1], p[2] + 3] as Vec3), { dir: [0, 0, -1], dia: 24 }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Push in the shelf supports",
      detail: "Four for each shelf, in the side panels at the same height.",
      fix: SIDES.map((sx) => named("pin", "Shelf support", supports.filter((p) => Math.sign(p[0]) === sx), { dir: [sx, 0, 0], on: sideId(sx) })),
    },
    { title: "Lay the shelves on the supports", add: ["S0", "S1"] },
    {
      title: "Screw the bolt onto the left door",
      detail: "Lay both doors face down. The sliding bolt goes at the top of the left door's inner edge, two screws.",
      fix: [named("clip", "Door bolt", [meet(-1, yTop - 60)], { dir: [0, 0, 1], on: "D0", len: 10, dia: 30 }), fx("screw", [meet(-1, yTop - 35), meet(-1, yTop - 85)], { dir: [0, 0, 1], on: "D0", len: 13, dia: 4 })],
      wait: ["D0", "D1"],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the catch plate onto the left door",
      detail: "Halfway up its inner edge, two screws. The lock's latch catches behind it.",
      fix: [named("clip", "Catch plate", [meet(-1, yLock)], { dir: [0, 0, 1], on: "D0", len: 4, dia: 30 }), fx("screw", [meet(-1, yLock + 25), meet(-1, yLock - 25)], { dir: [0, 0, 1], on: "D0", len: 10, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the lock onto the right door",
      detail: "Its keyhole lines up with the hole in the door, two screws.",
      fix: [named("clip", "Lock", [meet(1, yLock)], { dir: [0, 0, 1], on: "D1", len: 18, dia: 40 }), fx("screw", [meet(1, yLock + 26), meet(1, yLock - 26)], { dir: [0, 0, 1], on: "D1", len: 13, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Press the hinges into the doors",
      detail: "Two in each door. Push the cup into its hole, then fold the lever down until it locks.",
      fix: SIDES.map((sx, i) => fx("hinge", hinges.filter((p) => Math.sign(p[0]) === sx), { dir: [0, 0, 1], on: `D${i}` })),
    },
    {
      title: "Clip the doors onto the plates",
      detail: "Hold each door open at a right angle and push the hinges onto the plates until they click.",
      add: ["D0", "D1"],
      from: { D0: [0, 0, 320], D1: [0, 0, 320] },
    },
    { title: "Adjust the doors", detail: "Turn the screws on the hinges until the gaps round the doors are even and they close flat." },
    { title: "Check the lock", detail: "Close the left door, slide its bolt up, close the right door and turn the key." },
  ];
  return { parts, steps };
}

/**
 * Glass-door cabinet: five framed panels (back, sides and top with glass, a bottom with a board) bolted into a box
 * lying on its back, the base of two leg frames and a rail built on the bottom first, then the front frame that holds
 * the sliding glass doors.
 */
function glassCabinet(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const F = 30, M = 40, yC = Math.round(H * 0.15), L = 45;
  const hc = H - yC, xs = W / 2 - F / 2, zi = D / 2 - F;
  const xl = W / 2 - 150, zl = D / 2 - F - 25;
  const parts: CustomPart[] = [];
  const box = (id: string, name: string, size: Vec3, pos: Vec3, thin: 0 | 1 | 2, fill: PartMaterial | null) => parts.push(panel(id, name, size, pos, framed(size, thin, M, fill)));
  box("BK", "Back frame", [W, hc, F], [0, yC + hc / 2, -D / 2 + F / 2], 2, "glass");
  SIDES.forEach((sx, i) => box(i ? "SR" : "SL", "Side frame", [F, hc, D - 2 * F], [sx * xs, yC + hc / 2, 0], 0, "glass"));
  box("TP", "Top frame", [W - 2 * F, F, D - 2 * F], [0, H - F / 2, 0], 1, "glass");
  box("BT", "Bottom frame", [W - 2 * F, F, D - 2 * F], [0, yC + F / 2, 0], 1, "board");
  box("FR", "Front frame", [W, hc, F], [0, yC + hc / 2, D / 2 - F / 2], 2, null);
  // the base: two leg frames (two legs and a cross piece each) and the long rail between them
  SIDES.forEach((sx, i) =>
    parts.push(
      compound(`LF${i}`, "Leg frame", [
        ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [L, yC, L], pos: [sx * xl, yC / 2, sz * zl], material: "wood" })),
        { shape: "box", size: [L, 60, 2 * zl - L], pos: [sx * xl, yC - 30, 0], material: "wood" },
      ], "wood"),
    ),
  );
  parts.push(part("RL", "Rail", [2 * xl - L, 60, 30], [0, yC - 30, 0], { material: "wood" }));
  const ih = hc - 2 * F; // inside height
  const dw = (W - 2 * M) / 2 + 30;
  SIDES.forEach((sx, i) => parts.push(part(`D${i}`, "Glass door", [dw, ih - 4, 6], [sx * (dw / 2 - 15), yC + F + ih / 2, zi - (i ? 6 : 16)], { material: "glass" })));
  const ySh = yC + F + ih * 0.5;
  parts.push(part("GS", "Glass shelf", [W - 2 * F - 6, 6, D - 2 * F - 60], [0, ySh + 3, -20], { material: "glass" }));

  const yMid = yC + hc / 2;
  const sup = (sx: number, sz: number): Vec3 => [sx * (W / 2 - F), ySh - 12, sz * (zi - 15)];
  const bolt = { len: 50, dia: 6 };
  // the base is built beside the frame, all its parts shifted the same way so it stays together
  const aside: Vec3 = [-0.8 * W, 0, 0];
  const sideBolts = (y: number, on: string) => SIDES.map((sx) => fx("bolt", [-1, 1].map((sz) => [sx * (W / 2), y, (sz * D) / 4] as Vec3), { dir: [-sx, 0, 0], mate: on, ...bolt }));
  const backBolts = (y: number, mate: string) => fx("bolt", [-1, 0, 1].map((k) => [(k * W) / 4, y, -D / 2] as Vec3), { dir: [0, 0, 1], on: "BK", mate, ...bolt });
  const edgeDowels = (z: number, dir: Vec3, mate: string) => [
    ...SIDES.map((sx, i) => fx("dowel", [yC + hc * 0.25, yC + hc * 0.75].map((y) => [sx * xs, y, z] as Vec3), { dir, on: i ? "SR" : "SL", mate })),
    fx("dowel", SIDES.map((sx) => [(sx * W) / 4, H - F / 2, z] as Vec3), { dir, on: "TP", mate }),
    fx("dowel", SIDES.map((sx) => [(sx * W) / 4, yC + F / 2, z] as Vec3), { dir, on: "BT", mate }),
  ];

  const steps: CustomStep[] = [
    {
      title: "Lay the back frame on a rug and push in the dowels",
      detail: "The frame without the grey braces, outside down. Eight dowels, two on each edge, pushed in by hand: no hammer near the glass.",
      add: ["BK"],
      fix: [
        ...SIDES.map((sx, i) => fx("dowel", [yC + hc * 0.25, yC + hc * 0.75].map((y) => [sx * xs, y, -D / 2 + F] as Vec3), { dir: [0, 0, -1], on: "BK", mate: i ? "SR" : "SL" })),
        fx("dowel", SIDES.map((sx) => [(sx * W) / 4, H - F / 2, -D / 2 + F] as Vec3), { dir: [0, 0, -1], on: "BK", mate: "TP" }),
        fx("dowel", SIDES.map((sx) => [(sx * W) / 4, yC + F / 2, -D / 2 + F] as Vec3), { dir: [0, 0, -1], on: "BK", mate: "BT" }),
      ],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Screw the shelf supports into the side frames",
      detail: "Two on each side frame, one near each long edge, a screw through each. Stick a felt dot on top of every support.",
      fix: [
        ...SIDES.map((sx, i) => named("pin", "Shelf support", [sup(sx, -1), sup(sx, 1)], { dir: [sx, 0, 0], on: i ? "SR" : "SL", len: 20, dia: 20 })),
        ...SIDES.map((sx, i) => fx("screw", [sup(sx, -1), sup(sx, 1)].map((p) => [p[0], p[1] - 25, p[2]] as Vec3), { dir: [sx, 0, 0], on: i ? "SR" : "SL", len: 12, dia: 4 })),
        named("glide", "Felt dot", SIDES.flatMap((sx) => [sup(sx, -1), sup(sx, 1)]).map((p) => [p[0] - Math.sign(p[0]) * 8, ySh - 6, p[2]] as Vec3), { dir: [0, -1, 0], len: 2, dia: 10 }),
      ],
      wait: ["SL", "SR"],
      tools: ["screwdriver"],
    },
    { title: "Stand a side frame on the dowels", detail: "On the end of the back, supports facing in.", add: ["SL"] },
    {
      title: "Stand the other side frame on and screw the supports to the back",
      detail: "One screw through each support at the back edge into the back frame.",
      add: ["SR"],
      fix: [fx("screw", SIDES.map((sx) => [sx * (W / 2 - F - 20), ySh - 12, -D / 2 + F] as Vec3), { dir: [0, 0, -1], on: "BK", len: 12, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the top frame between the sides",
      detail: "Hold it in line with the top edges. Two bolts through each side frame, not fully tight yet.",
      add: ["TP"],
      fix: sideBolts(H - F / 2, "TP"),
      tools: ["allen"],
    },
    { title: "Bolt the back to the top", detail: "Three bolts along the joint, not fully tight yet.", fix: [backBolts(H - F / 2, "TP")], tools: ["allen"] },
    { title: "Push dowels into the rail", detail: "One in each end.", fix: SIDES.map((sx, i) => fx("dowel", [[sx * (xl - L / 2), yC - 30, 0]], { dir: [-sx, 0, 0], on: "RL", mate: `LF${i}`, len: 40, dia: 10 })), wait: ["RL"], from: { RL: aside } },
    {
      title: "Join the leg frames to the rail",
      detail: "A long connector bolt through the middle of each leg frame into the rail. Tighten them by hand for now.",
      fix: SIDES.map((sx, i) => named("bolt", "Connector bolt", [[sx * (xl + L / 2), yC - 30, 0]], { dir: [-sx, 0, 0], on: `LF${i}`, mate: "RL", len: 70, dia: 7 })),
      wait: ["LF0", "LF1"],
      from: { LF0: aside, LF1: aside },
      tools: ["allen"],
      warnings: ["hand"],
    },
    { title: "Stand the base upside down on the bottom frame", detail: "Lay the bottom frame on the rug, board side down, and stand the legs on it with their feet up.", wait: ["BT"], from: { BT: aside } },
    {
      title: "Bolt the bottom frame to the legs",
      detail: "Four bolts through the edges of the frame into the tops of the legs. Tighten them with the Allen key.",
      fix: SIDES.flatMap((sx, i) => [-1, 1].map((sz) => fx("bolt", [[sx * xl, yC + F / 2, sz * zi]], { dir: [0, 0, -sz], on: "BT", mate: `LF${i}`, ...bolt }))),
      tools: ["allen"],
    },
    { title: "Tighten the connector bolts", detail: "Now the base is square, turn the two bolts in the leg frames tight.", tools: ["allen"] },
    { title: "Screw a foot into each leg", detail: "By hand, all the way in.", fix: SIDES.map((sx, i) => fx("foot", [-1, 1].map((sz) => [sx * xl, 0, sz * zl] as Vec3), { dir: [0, 1, 0], on: `LF${i}`, len: 20, dia: 26 })), warnings: ["hand"] },
    { title: "Lower the bottom and base into the frame", detail: "Base outwards, the bottom between the side frames at their open end.", add: ["BT", "LF0", "LF1", "RL"] },
    { title: "Bolt the sides to the bottom", detail: "Two bolts through each side frame.", fix: sideBolts(yC + F / 2, "BT"), tools: ["allen"] },
    { title: "Bolt the back to the bottom", detail: "Three bolts along the joint.", fix: [backBolts(yC + F / 2, "BT")], tools: ["allen"] },
    { title: "Push dowels into the front edges", detail: "Eight in all: two in each side, two in the top and two in the bottom.", fix: edgeDowels(zi, [0, 0, -1], "FR") },
    {
      title: "Lay the front frame on",
      detail: "With its grey braces still on and the door they hold on the inside. Line it up with the dowels and press it down.",
      add: ["FR", "D0"],
      from: { FR: [0, 0, 300], D0: [0, 0, 300] },
    },
    { title: "Screw a support to the front", detail: "Through the support on one side frame into the front frame.", fix: [fx("screw", [[-(W / 2 - F - 25), ySh - 12, zi]], { dir: [0, 0, 1], on: "FR", len: 12, dia: 4 })], tools: ["screwdriver"] },
    {
      title: "Bolt the front to the top and bottom",
      detail: "Five bolts: three into the bottom, two into the top. One hole is under a brace for now.",
      fix: [fx("bolt", [-1, 0, 1].map((k) => [(k * W) / 4, yC + F / 2, D / 2] as Vec3), { dir: [0, 0, -1], on: "FR", mate: "BT", ...bolt }), fx("bolt", [-1, 0].map((k) => [(k * W) / 4, H - F / 2, D / 2] as Vec3), { dir: [0, 0, -1], on: "FR", mate: "TP", ...bolt })],
      tools: ["allen"],
    },
    { title: "Slide the brace aside", detail: "Push the grey brace across to free the last holes. Don't take it off yet: it still holds the door." },
    { title: "Screw the other support to the front", fix: [fx("screw", [[W / 2 - F - 8, ySh - 12, zi]], { dir: [0, 0, 1], on: "FR", len: 12, dia: 4 })], tools: ["screwdriver"] },
    { title: "Fit the last bolt", detail: "Through the front into the top.", fix: [fx("bolt", [[W / 4, H - F / 2, D / 2]], { dir: [0, 0, -1], on: "FR", mate: "TP", ...bolt })], tools: ["allen"] },
    { title: "Tighten all the bolts", detail: "Go round all twenty bolts in the frame with the Allen key until each one is tight.", tools: ["allen"], check: "square" },
    { title: "Stand it up together", detail: "Lift it by the frame, not the glass.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Put in the second door", detail: "Tilt it in at the open side, top first, into the inner track.", add: ["D1"], from: { D1: [0, 0, 300] } },
    { title: "Hang it in the tracks", detail: "Lift it into the top track and let it drop into the bottom one." },
    { title: "Take the braces off", detail: "The first door is now free to slide. Recycle the braces." },
    { title: "Check that both doors slide", detail: "Push each one all the way across and back." },
    { title: "Lay the glass shelf on the supports", detail: "Through an open door, onto the felt dots.", add: ["GS"] },
    { title: "Level it with the feet", detail: "Turn the feet with the spanner until the top is level.", tools: ["wrench", "level"] },
  ];
  return { parts, steps };
}

/**
 * Cabinet with sliding doors: rattan side frames with legs, a back of two rattan halves, a bottom and a shelf, built
 * lying on its back on cam bolts and dowels; stood up for the middle post and the top, then the doors and the straps.
 */
function slidingCabinet(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const P = 40, Tt = 25, Bt = 20, yB = Math.round(H * 0.23), yTop = H - Tt;
  const xi = W / 2 - P, xp = W / 2 - P / 2, zp = D / 2 - P / 2;
  const yIn = yB + Bt, ySh = Math.round((yIn + yTop) / 2);
  const zBk = -D / 2 + P - 12.5, zMp = D / 2 - 55;
  const parts: CustomPart[] = [];
  SIDES.forEach((sx, i) =>
    parts.push(
      compound(i ? "SR" : "SL", "Side frame", [
        ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [P, yTop, P], pos: [sx * xp, yTop / 2, sz * zp], material: "wood" })),
        { shape: "box", size: [10, yTop - yB, D - 2 * P], pos: [sx * xp, (yB + yTop) / 2, 0], material: "fiber" },
        ...[yB + 20, ySh, yTop - 20].map((y): PartPiece => ({ shape: "box", size: [P - 10, 40, D - 2 * P], pos: [sx * xp, y, 0], material: "wood" })),
      ], "wood"),
    ),
  );
  const bh = yTop - yB;
  SIDES.forEach((sx, i) => {
    const size: Vec3 = [xi, bh, 25];
    parts.push(panel(`BK${i}`, "Back half", size, [(sx * xi) / 2, yB + bh / 2, zBk], framed(size, 2, 40, "fiber", "wood", 1)));
  });
  parts.push(part("BT", "Bottom", [2 * xi, Bt, D - P], [0, yB + Bt / 2, P / 2], { material: "wood" }));
  parts.push(part("SH", "Shelf", [2 * xi, 20, D - P - 50], [0, ySh, -25], { material: "wood" }));
  parts.push(part("MP", "Middle post", [40, yTop - yIn, 30], [0, (yIn + yTop) / 2, zMp], { material: "wood" }));
  {
    const size: Vec3 = [W, Tt, D];
    parts.push(panel("TP", "Top", size, [0, H - Tt / 2, 0], framed(size, 1, 50, "fiber")));
  }
  const dw = xi + 15, dh = yTop - yIn - 2;
  SIDES.forEach((sx, i) => {
    const size: Vec3 = [dw, dh, 18];
    parts.push(panel(`D${i}`, "Sliding door", size, [sx * (xi - dw / 2), yIn + 1 + dh / 2, D / 2 - (i ? 10 : 30)], framed(size, 2, 40, "fiber", "wood", 1)));
  });

  const sid = (sx: number) => (sx < 0 ? "SL" : "SR");
  const camAt = (sx: number, y: number, zs: number[]) => zs.map((z) => [sx * xi, y, z] as Vec3);
  const zShelf = [-D / 4, D / 8], zBot = [-D / 4, D / 4];
  const steps: CustomStep[] = [
    {
      title: "Screw a foot into each leg",
      detail: "Lay the two side frames on a rug, inside up. One foot in the end of each leg, by hand.",
      fix: SIDES.map((sx) => fx("foot", [-1, 1].map((sz) => [sx * xp, 0, sz * zp] as Vec3), { dir: [0, 1, 0], on: sid(sx), len: 20, dia: 30 })),
      wait: ["SL", "SR"],
      pose: "+z",
      warnings: ["floor", "hand"],
    },
    {
      title: "Screw the long cam bolts in at the shelf",
      detail: "Two in each frame, in the middle rail.",
      fix: SIDES.map((sx) => named("camScrew", "Long cam bolt", camAt(sx, ySh, zShelf), { dir: [sx, 0, 0], on: sid(sx), mate: "SH", len: 44 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the short cam bolts in at the bottom",
      detail: "Two in each frame, in the lowest rail.",
      fix: SIDES.map((sx) => fx("camScrew", camAt(sx, yB + Bt / 2, zBot), { dir: [sx, 0, 0], on: sid(sx), mate: "BT" })),
      tools: ["screwdriver"],
    },
    {
      title: "Push in the big dowels",
      detail: "Five in each frame: three along the bottom rail, two along the middle rail.",
      fix: SIDES.flatMap((sx) => [
        fx("dowel", camAt(sx, yB + Bt / 2, [-D / 2 + 70, 0, D / 2 - 70]), { dir: [sx, 0, 0], on: sid(sx), mate: "BT", len: 40, dia: 10 }),
        fx("dowel", camAt(sx, ySh, [-D / 2 + 70, D / 2 - 110]), { dir: [sx, 0, 0], on: sid(sx), mate: "SH", len: 40, dia: 10 }),
      ]),
    },
    {
      title: "Join the two halves of the back",
      detail: "Lay them on the rug, outside down, and push them together on two small dowels.",
      add: ["BK0", "BK1"],
      fix: [fx("dowel", [yB + bh / 3, yB + (2 * bh) / 3].map((y) => [0, y, zBk] as Vec3), { dir: [1, 0, 0], on: "BK0", mate: "BK1" })],
    },
    {
      title: "Push dowels into the edges of the back",
      detail: "Twelve small dowels: four along the bottom, four along the top and two at each end.",
      fix: [
        ...SIDES.map((sx, i) => fx("dowel", [150, 450].map((x) => [(sx * x * W) / 1250, yB + Bt / 2, zBk + 12.5] as Vec3), { dir: [0, 0, -1], on: `BK${i}`, mate: "BT" })),
        ...SIDES.map((sx, i) => fx("dowel", [150, 450].map((x) => [(sx * x * W) / 1250, yTop, zBk] as Vec3), { dir: [0, -1, 0], on: `BK${i}`, mate: "TP" })),
        ...SIDES.map((sx, i) => fx("dowel", [yB + 150, yTop - 150].map((y) => [sx * xi, y, zBk] as Vec3), { dir: [-sx, 0, 0], on: `BK${i}`, mate: sid(sx) })),
      ],
    },
    {
      title: "Screw the bottom to the back",
      detail: "Stand the bottom on its back edge, onto the dowels. Four long screws through the back into it.",
      add: ["BT"],
      fix: [fx("screw", [-450, -150, 150, 450].map((x) => [(x * W) / 1250, yB + Bt / 2, -D / 2 + P - 25] as Vec3), { dir: [0, 0, 1], on: "BK0", mate: "BT", len: 60, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Put on the left side frame", detail: "Push it onto the dowels and cam bolts in the back and the bottom. Holes for the cam locks face in.", add: ["SL"] },
    { title: "Slide in the shelf", detail: "The round holes face up, towards the front. Push it onto the dowels and cam bolts of the side frame.", add: ["SH"] },
    { title: "Put on the right side frame", detail: "Onto the back, the bottom and the shelf all at once.", add: ["SR"] },
    {
      title: "Lock the shelf and the bottom",
      detail: "Eight cam locks, four in each, arrows towards the edge, turned clockwise until tight.",
      fix: [
        fx("cam", SIDES.flatMap((sx) => zShelf.map((z) => [sx * (xi - 35), ySh + 10, z] as Vec3)), { dir: [0, -1, 0], on: "SH" }),
        fx("cam", SIDES.flatMap((sx) => zBot.map((z) => [sx * (xi - 35), yIn, z] as Vec3)), { dir: [0, -1, 0], on: "BT" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Stand it up", detail: "Tip it forward onto its feet together.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Push dowels into the tops of the side frames",
      detail: "Three in each.",
      fix: SIDES.map((sx) => fx("dowel", [-zp, 0, zp].map((z) => [sx * xp, yTop, z] as Vec3), { dir: [0, -1, 0], on: sid(sx), mate: "TP", len: 40, dia: 10 })),
    },
    { title: "Screw a cam bolt into the bottom", detail: "In the middle, near the front edge.", fix: [fx("camScrew", [[0, yIn, zMp]], { dir: [0, -1, 0], on: "BT", mate: "MP" })], tools: ["screwdriver"] },
    { title: "Stand the middle post on it", detail: "The hole in its foot drops over the cam bolt.", add: ["MP"] },
    { title: "Lock the post", detail: "One small cam lock in the post, near its foot.", fix: [named("cam", "Small cam lock", [[0, yIn + 30, zMp + 15]], { dir: [0, 0, -1], on: "MP", dia: 12 })], tools: ["screwdriver"] },
    { title: "Screw the post to the shelf", detail: "One screw through the post into the front edge of the shelf.", fix: [fx("screw", [[0, ySh, zMp + 15]], { dir: [0, 0, -1], on: "MP", mate: "SH", len: 40, dia: 4 })], tools: ["screwdriver"] },
    {
      title: "Mark the wall for the straps",
      detail: `Stand it where it will go. Mark two points about ${Math.round((W - 160) / 10)} cm apart, just above the height of the top.`,
      tools: ["pencil", "tape"],
      warnings: ["wall"],
    },
    {
      title: "Screw cam bolts under the top",
      detail: "Lay the top upside down on the rug. Five: one near each corner and one at the front in the middle.",
      fix: [fx("camScrew", [...SIDES.flatMap((sx) => [-1, 1].map((sz) => [sx * xp, yTop, (sz * D) / 4] as Vec3)), [0, yTop, zMp] as Vec3], { dir: [0, 1, 0], on: "TP" })],
      wait: ["TP"],
      tools: ["screwdriver"],
    },
    { title: "Lay the top on", detail: "Onto the dowels and cam bolts. Leave a gap: don't press it down yet, the doors go in first.", add: ["TP"] },
    {
      title: "Fit the bottom guides to the doors",
      detail: "Lay the doors face down. One guide at the bottom outer corner of each, held by two pins pushed through it.",
      fix: [
        ...SIDES.map((sx, i) => named("clip", "Bottom guide", [[sx * (xi - 60), yIn + 1, D / 2 - (i ? 10 : 30) - 9]], { dir: [0, 1, 0], on: `D${i}`, len: 12, dia: 30 })),
        ...SIDES.map((sx, i) => named("pin", "Guide pin", [-12, 12].map((dx) => [sx * (xi - 60) + dx, yIn + 1, D / 2 - (i ? 10 : 30) - 9] as Vec3), { dir: [0, 1, 0], on: `D${i}`, len: 14, dia: 6 })),
      ],
      wait: ["D0", "D1"],
    },
    {
      title: "Screw the top guides on",
      detail: "One on the top edge of each door, at the inner end, two screws each.",
      fix: [
        ...SIDES.map((sx, i) => named("clip", "Top guide", [[sx * (xi - dw + 60), yTop - 1, D / 2 - (i ? 10 : 30)]], { dir: [0, -1, 0], on: `D${i}`, len: 30, dia: 25 })),
        ...SIDES.map((sx, i) => fx("screw", [-25, 25].map((dx) => [sx * (xi - dw + 60) + dx, yTop - 1, D / 2 - (i ? 10 : 30)] as Vec3), { dir: [0, -1, 0], on: `D${i}`, len: 12, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Turn the doors over", detail: "Check each guide sits straight before you hang them." },
    {
      title: "Hang the doors",
      detail: "Top edge first into the track under the top, then lower it into the bottom track. The left door goes in the back track, the right one in the front.",
      add: ["D0", "D1"],
      from: { D0: [0, 0, 300], D1: [0, 0, 320] },
    },
    { title: "Press the top down", detail: "All along its length until it sits tight on the side frames. Keep your fingers clear of the edge.", warnings: ["hand"] },
    {
      title: "Lock the top",
      detail: "Four cam locks inside the side frames, just under the top, and a small one in the middle post.",
      fix: [
        ...SIDES.map((sx) => fx("cam", [-1, 1].map((sz) => [sx * xi, yTop - 30, (sz * D) / 4] as Vec3), { dir: [sx, 0, 0], on: sid(sx) })),
        named("cam", "Small cam lock", [[0, yTop - 30, zMp + 15]], { dir: [0, 0, -1], on: "MP", dia: 12 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Hook the wall straps into the top",
      detail: "One into each slot at the back edge of the top.",
      fix: [fx("strap", SIDES.map((sx) => [sx * (W / 2 - 80), H - Tt / 2, -D / 2] as Vec3), { dir: [0, 0, 1], on: "TP", included: true })],
    },
    {
      title: "Screw the straps to the wall",
      detail: "Drill at your marks, then a screw through a washer and the end of each strap. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", SIDES.map((sx) => [sx * (W / 2 - 80), H + 10, -D / 2 - 30] as Vec3), { dir: [0, 0, -1] }),
        fx("washer", SIDES.map((sx) => [sx * (W / 2 - 80), H + 10, -D / 2 - 2] as Vec3), { dir: [0, 0, -1], included: true }),
        fx("screw", SIDES.map((sx) => [sx * (W / 2 - 80), H + 10, -D / 2] as Vec3), { dir: [0, 0, -1], len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    { title: "Level it with the feet", detail: "Turn the feet by hand until it stands steady and the top is level.", tools: ["level"] },
  ];
  return { parts, steps };
}

/**
 * Sideboard: the top lies upside down and gets three rails and the push openers, the sides and the divider hang on the
 * rails with the top on its back edge, then upside down the backs slide in, the bottom goes on and the base (two legs,
 * two rails) is built beside it and screwed on. Upright: back clips, wall spacers and fixing, shelves, two drawers that
 * ride on the shelves, and four doors on clip hinges.
 */
function sideboard(s: ProductSpec): CustomParams {
  const { W, H, D } = dims(s);
  const ov = 8, t = 18, hb = 150, Bt = 18, Tt = 20;
  const xo = W / 2 - ov; // outer faces of the sides
  const yB1 = hb + Bt, yT0 = H - Tt, hs = yT0 - yB1;
  const z0 = -D / 2 + 4, z1 = D / 2 - 26, zm = (z0 + z1) / 2, Ds = z1 - z0; // sides, front to back
  const cw = xo - t - 9; // inside width of one compartment
  const cx = (sx: number) => sx * (9 + cw / 2);
  const parts: CustomPart[] = [];
  parts.push(part("TP", "Top", [W, Tt, D], [0, H - Tt / 2, 0], { material: "wood" }));
  const rail = (x: number): PartPiece => ({ shape: "box", size: [20, 30, Ds - 40], pos: [x, yT0 - 15, zm] });
  parts.push(part("C0", "Rail", [20, 30, Ds - 40], [-(xo - t - 10), yT0 - 15, zm], { material: "wood" }));
  parts.push(compound("CM", "Middle rail", [rail(-19), rail(19)], "wood"));
  parts.push(part("C1", "Rail", [20, 30, Ds - 40], [xo - t - 10, yT0 - 15, zm], { material: "wood" }));
  parts.push(part("SL", "Side", [t, hs, Ds], [-xo + t / 2, yB1 + hs / 2, zm], { material: "wood" }));
  parts.push(part("MD", "Divider", [t, hs, Ds], [0, yB1 + hs / 2, zm], { material: "wood" }));
  parts.push(part("SR", "Side", [t, hs, Ds], [xo - t / 2, yB1 + hs / 2, zm], { material: "wood" }));
  SIDES.forEach((sx, i) => parts.push(part(`BK${i}`, "Back", [cw + 12, hs + 12, 4], [cx(sx), yB1 + hs / 2, z0 + 12], { material: "fiber" })));
  parts.push(part("BT", "Bottom", [W, Bt, D], [0, hb + Bt / 2, 0], { material: "wood" }));
  // the base: two upright legs and two rails between them
  const xl = W / 2 - 300, Dl = D - 80, zc = -10, rh = 70;
  const zr = (sz: number) => zc + sz * (Dl / 2 - 60);
  SIDES.forEach((sx, i) => parts.push(part(`LG${i}`, "Leg", [30, hb, Dl], [sx * xl, hb / 2, zc], { material: "wood" })));
  SIDES.forEach((sz, i) => parts.push(part(`RL${i}`, "Base rail", [2 * xl - 30, rh, 22], [0, hb - rh / 2, zr(sz)], { material: "wood" })));
  // drawers ride on the shelves, just under the top
  const dh = 110, dd = 360, dwd = cw - 30, zf = z1 - 3;
  const ySh = yT0 - 40 - dh - 9;
  SIDES.forEach((sx, i) => parts.push(part(`SH${i}`, "Shelf", [cw - 4, 18, Ds - 30], [cx(sx), ySh, zm - 5], { material: "wood" })));
  const yd = ySh + 9 + dh / 2;
  SIDES.forEach((sx, i) => {
    const c = cx(sx);
    parts.push(
      compound(`DR${i}`, "Drawer", [
        { shape: "box", size: [dwd, dh, 18], pos: [c, yd, zf - 9] },
        ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [14, dh - 10, dd - 18], pos: [c + k * (dwd / 2 - 7), yd - 5, zf - 18 - (dd - 18) / 2] })),
        { shape: "box", size: [dwd - 28, dh - 20, 14], pos: [c, yd - 10, zf - dd + 7] },
        { shape: "box", size: [dwd - 28, 4, dd - 32], pos: [c, yd - dh / 2 + 8, zf - dd / 2], material: "fiber" },
      ], "board"),
    );
  });
  // four doors over the front, two in each half
  const dwide = xo / 2 - 3, dhh = hs - 4, dz = z1 + 9;
  const dcx = (i: number) => -xo + (i + 0.5) * (xo / 2);
  range(4).forEach((i) => parts.push(part(`D${i}`, "Door", [dwide, dhh, 18], [dcx(i), yB1 + 2 + dhh / 2, dz], { material: "wood" })));

  const panels: [string, number][] = [["SL", -xo + t / 2], ["MD", 0], ["SR", xo - t / 2]];
  const hingeYs = [yB1 + 100, yT0 - 100];
  // each door's hinge side: the panel face its plates go on, and where its hinges sit on the door
  const hingeOf = [
    { on: "SL", x: -xo + t, dir: [-1, 0, 0] as Vec3, hx: -xo + 30 },
    { on: "MD", x: -9, dir: [1, 0, 0] as Vec3, hx: -30 },
    { on: "MD", x: 9, dir: [-1, 0, 0] as Vec3, hx: 30 },
    { on: "SR", x: xo - t, dir: [1, 0, 0] as Vec3, hx: xo - 30 },
  ];
  const hingePlates = (i: number) => named("plate", "Mounting plate", hingeYs.map((y) => [hingeOf[i].x, y, z1 - 37] as Vec3), { dir: hingeOf[i].dir, on: hingeOf[i].on, len: 12, dia: 40 });
  const openX = [-xo / 2 - 40, -xo / 2 + 40, xo / 2 - 40, xo / 2 + 40];
  const zo = z1 - 60;
  const cleatScrews = [-(xo - t - 10), -19, 19, xo - t - 10].flatMap((x) => [zm - (Ds / 2 - 60), zm, zm + (Ds / 2 - 60)].map((z) => [x, yT0 - 30, z] as Vec3));
  const shelfSup = SIDES.flatMap((sx) => [sx < 0 ? hingeOf[0] : hingeOf[3], sx < 0 ? hingeOf[1] : hingeOf[2]]).map((h) => named("pin", "Shelf support", [z0 + 60, z1 - 60].map((z) => [h.x, ySh - 9, z] as Vec3), { dir: h.dir, on: h.on, len: 16, dia: 12 }));
  const midYs = range(8).map((k) => yB1 + 50 + (k * (hs - 100)) / 7);
  const clips = [
    ...[-1, 1].map((sx) => named("clip", "Back clip", [yB1 + 50, yB1 + 200, yT0 - 200, yT0 - 50].map((y) => [sx * (xo - t / 2), y, z0] as Vec3), { dir: [0, 0, 1], on: sx < 0 ? "SL" : "SR", len: 10, dia: 14 })),
    named("clip", "Back clip", midYs.map((y) => [0, y, z0] as Vec3), { dir: [0, 0, 1], on: "MD", len: 10, dia: 14 }),
  ];
  const spacerAt: Vec3[] = SIDES.map((sx) => [sx * (xo - t / 2), yT0 - 60, z0]);
  const wallAt: Vec3[] = SIDES.map((sx) => [sx * (xo - t - 60), yT0 - 50, z0 + 10]);
  const aside: Vec3 = [0, 0, D + 500];
  const base = { LG0: aside, LG1: aside, RL0: aside, RL1: aside };
  const legCams = SIDES.map((sx, i) => fx("camScrew", SIDES.flatMap((sz) => [hb - 12, hb - 58].map((y) => [sx * (xl - 15), y, zr(sz)] as Vec3)), { dir: [sx, 0, 0], on: `LG${i}` }));
  const drawer = (f: (sx: number, i: number, c: number) => CustomFix[]) => SIDES.flatMap((sx, i) => f(sx, i, cx(sx)));

  const steps: CustomStep[] = [
    {
      title: "Screw the rails under the top",
      detail: "Lay the top upside down on a rug. A rail at each end and the double rail in the middle, three screws in each strip.",
      add: ["TP", "C0", "CM", "C1"],
      fix: [fx("screw", cleatScrews, { dir: UP, len: 40, dia: 4 })],
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Screw the opener plates on",
      detail: "Four plates near the front edge, two in each half, four small screws in each.",
      fix: [
        named("plate", "Opener plate", openX.map((x) => [x, yT0, zo] as Vec3), { dir: UP, on: "TP", len: 6, dia: 40 }),
        fx("screw", openX.flatMap((x) => [-24, 24].flatMap((dx) => [-14, 14].map((dzz) => [x + dx, yT0, zo + dzz] as Vec3))), { dir: UP, on: "TP", len: 12, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Click the push openers onto the plates", detail: "Slide each opener in from the back until it clicks.", fix: [named("clip", "Push opener", openX.map((x) => [x, yT0, zo + 32] as Vec3), { dir: UP, on: "TP", len: 20, dia: 30 })] },
    {
      title: "Screw hinge plates onto the sides",
      detail: "Lay the two sides and the divider on the rug. Two plates near the front edge of each side, on the inside.",
      fix: [hingePlates(0), hingePlates(3)],
      wait: ["SL", "SR", "MD"],
      tools: ["screwdriver"],
    },
    { title: "Screw two hinge plates onto the divider", fix: [hingePlates(1)], tools: ["screwdriver"] },
    { title: "Turn the divider over and screw on two more", detail: "At the same heights as on the other face.", fix: [hingePlates(2)], tools: ["screwdriver"] },
    {
      title: "Stand the top on its back edge and hang a side on it",
      detail: "Hold the top upright between you. The three fittings on the side hook over the end rail: push it on, then slide it down until it locks.",
      add: ["SL"],
      from: { SL: [0, -250, 40] },
      pose: "+z",
      people: 2,
      warnings: ["two"],
    },
    { title: "Hang the divider on the middle rail", detail: "Hinge plates to the front, the same way as the side.", add: ["MD"], from: { MD: [0, -250, 40] } },
    { title: "Hang the other side on", add: ["SR"], from: { SR: [0, -250, 40] } },
    {
      title: "Turn it upside down and slide in the backs",
      detail: "Lay it on the top. Slide each back down into the grooves of the side and the divider.",
      add: ["BK0", "BK1"],
      from: { BK0: [0, -500, 0], BK1: [0, -500, 0] },
      pose: "-y",
      people: 2,
    },
    {
      title: "Push dowels into the sides and the divider",
      detail: "Two in the edge of each.",
      fix: panels.map(([id, x]) => fx("dowel", [z0 + 60, z1 - 60].map((z) => [x, yB1, z] as Vec3), { dir: UP, on: id, mate: "BT", len: 30, dia: 8 })),
    },
    { title: "Lay the bottom on", detail: "Onto the dowels, its edges over the backs.", add: ["BT"], from: { BT: [0, -300, 0] } },
    {
      title: "Screw the bottom on",
      detail: "Two connector screws into each side and the divider, with the Allen key.",
      fix: panels.map(([id, x]) => named("bolt", "Connector screw", [z0 + 110, z1 - 110].map((z) => [x, hb, z] as Vec3), { dir: UP, on: "BT", mate: id, len: 50, dia: 7 })),
      tools: ["allen"],
    },
    { title: "Screw cam bolts into the legs", detail: "Build the base beside the cabinet. Four in the inside face of each leg.", fix: legCams, wait: ["LG0", "LG1"], from: base, tools: ["screwdriver"] },
    {
      title: "Push dowels into the base rails",
      detail: "One in each end.",
      fix: SIDES.flatMap((sz, i) => SIDES.map((sx, j) => fx("dowel", [[sx * (xl - 15), hb - 35, zr(sz)]], { dir: [-sx, 0, 0], on: `RL${i}`, mate: `LG${j}`, len: 30, dia: 8 }))),
      wait: ["RL0", "RL1"],
      from: base,
    },
    { title: "Push the legs onto the rails", detail: "One leg at a time, onto the dowels and cam bolts in the rail ends." },
    {
      title: "Lock the rails",
      detail: "Two cam locks in each end of both rails, arrows towards the leg, turned clockwise until tight.",
      fix: SIDES.map((sz, i) => fx("cam", SIDES.flatMap((sx) => [hb - 12, hb - 58].map((y) => [sx * (xl - 50), y, zr(sz) - sz * 11] as Vec3)), { dir: [0, 0, sz], on: `RL${i}` })),
      tools: ["screwdriver"],
    },
    { title: "Turn the base over and push dowels into the legs", detail: "Two in the top of each leg.", fix: SIDES.map((sx, i) => fx("dowel", [-1, 1].map((sz) => [sx * xl, hb, zc + sz * (Dl / 2 - 50)] as Vec3), { dir: DOWN, on: `LG${i}`, mate: "BT", len: 30, dia: 8 })) },
    { title: "Screw a foot into each leg", detail: "Turn it over again. Two in the bottom of each leg, by hand.", fix: SIDES.map((sx, i) => fx("foot", [-1, 1].map((sz) => [sx * xl, 0, zc + sz * (Dl / 2 - 30)] as Vec3), { dir: UP, on: `LG${i}`, len: 20, dia: 26 })), warnings: ["hand"] },
    { title: "Lower the base onto the bottom", detail: "Feet up, the dowels into the holes in the bottom.", add: ["LG0", "LG1", "RL0", "RL1"], from: { LG0: [0, -300, 0], LG1: [0, -300, 0], RL0: [0, -300, 0], RL1: [0, -300, 0] } },
    {
      title: "Screw the base rails to the bottom",
      detail: "Two long screws through each rail, with the Allen key.",
      fix: SIDES.map((sz, i) => fx("screw", [-xl / 2, xl / 2].map((x) => [x, hb - rh, zr(sz)] as Vec3), { dir: UP, on: `RL${i}`, mate: "BT", len: 80, dia: 5 })),
      tools: ["allen"],
    },
    { title: "Turn it the right way up", detail: "Lift it together onto its feet.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Clip the backs in", detail: "Sixteen clips round the edges of the two backs. Push the first part into its hole, then the second into it.", fix: clips },
    { title: "Fit the wall spacers", detail: "One at the top of each side, at the back, its two pins in the holes.", fix: [fx("spacer", spacerAt, { dir: [0, 0, 1], len: 25, dia: 30 })] },
    { title: "Screw the knobs onto the spacers", fix: [named("cap", "Spacer knob", spacerAt, { dir: [0, 0, 1], len: 20, dia: 30 })] },
    { title: "Push it to the wall and set the spacers", detail: "Turn each knob out until it touches the wall and the sideboard stands straight.", warnings: ["wall"] },
    { title: "Level it with the feet", detail: "Turn the feet with the spanner until the top is level.", tools: ["wrench", "level"] },
    { title: "Mark and drill the wall", detail: "Through the two holes near the top of the back, then pull it forward and drill.", tools: ["pencil", "drill"], warnings: ["wall"] },
    {
      title: "Screw it to the wall",
      detail: "Push it back, a washer on each screw, then click the caps on. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", wallAt.map((p) => [p[0], p[1], -D / 2 - 30] as Vec3), { dir: [0, 0, -1] }),
        fx("washer", wallAt, { dir: [0, 0, -1], dia: 24 }),
        fx("screw", wallAt, { dir: [0, 0, -1], len: 50, dia: 5 }),
        fx("cap", wallAt.map((p) => [p[0], p[1], p[2] + 3] as Vec3), { dir: [0, 0, -1], dia: 24 }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    { title: "Screw in the shelf supports", detail: "Four for each shelf, high up in each half.", fix: shelfSup, tools: ["screwdriver"] },
    { title: "Lay the shelves on the supports", detail: "Press each one down until it clips onto the supports.", add: ["SH0", "SH1"], from: { SH0: [0, 0, 400], SH1: [0, 0, 400] } },
    {
      title: "Screw cam bolts into the drawer fronts",
      detail: "Lay each front face down on the rug. Two at each end.",
      fix: drawer((sx, i, c) => [fx("camScrew", [-1, 1].flatMap((k) => [yd - 25, yd + 25].map((y) => [c + k * (dwd / 2 - 7), y, zf - 18] as Vec3)), { dir: [0, 0, 1], on: `DR${i}` })]),
      wait: ["DR0", "DR1"],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Push the drawer sides onto the bolts", detail: "Holes for the cam locks facing in." },
    {
      title: "Lock the drawer sides",
      detail: "Two cam locks in each side, turned clockwise until tight.",
      fix: drawer((sx, i, c) => [fx("cam", [-1, 1].flatMap((k) => [yd - 25, yd + 20].map((y) => [c + k * (dwd / 2 - 14), y, zf - 48] as Vec3)), { dir: [0, 0, -1], on: `DR${i}` })]),
      tools: ["screwdriver"],
    },
    { title: "Slide in the drawer bottoms", detail: "Into the grooves in the sides and the front, smooth side up." },
    { title: "Put on the drawer backs", detail: "Over the end of the bottom, between the sides." },
    {
      title: "Screw the backs on",
      detail: "Two screws through each side into the back.",
      fix: drawer((sx, i, c) => [-1, 1].map((k) => fx("screw", [yd - 35, yd + 15].map((y) => [c + k * (dwd / 2), y, zf - dd + 7] as Vec3), { dir: [-k, 0, 0], on: `DR${i}`, len: 35, dia: 4 }))),
      tools: ["screwdriver"],
    },
    {
      title: "Turn in the stop screws",
      detail: "One inside each side near the back. Only part way: they stop the drawer.",
      fix: drawer((sx, i, c) => [-1, 1].map((k) => fx("screw", [[c + k * (dwd / 2 - 14), yd + 20, zf - dd + 60]], { dir: [k, 0, 0], on: `DR${i}`, len: 10, dia: 4 }))),
      tools: ["screwdriver"],
    },
    { title: "Slide the drawers in", detail: "On the shelves, until they reach the stops.", add: ["DR0", "DR1"], from: { DR0: [0, 0, 450], DR1: [0, 0, 450] } },
    { title: "Set the stops", detail: "Turn the stop screws until each drawer front sits just inside the cabinet's front edge.", tools: ["screwdriver"] },
    { title: "Push the drawers fully in", detail: "Both should stop at the same depth." },
    {
      title: "Press the hinges into the doors",
      detail: "Lay the doors face down. Two in each door, the cup in its hole, then fold the lever down until it locks.",
      fix: range(4).map((i) => fx("hinge", hingeYs.map((y) => [hingeOf[i].hx, y, dz - 9] as Vec3), { dir: [0, 0, 1], on: `D${i}` })),
      wait: ["D0", "D1", "D2", "D3"],
    },
    {
      title: "Clip the doors onto the plates",
      detail: "Hold each door open at a right angle and push its hinges onto the plates until they click.",
      add: ["D0", "D1", "D2", "D3"],
      from: { D0: [0, 0, 320], D1: [0, 0, 320], D2: [0, 0, 320], D3: [0, 0, 320] },
    },
    { title: "Adjust the doors", detail: "Turn the screws on the hinges until the gaps are even, then press each door to check the push opener." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["STOCKHOLM"],
  recipe(s) {
    const slug = s.slug ?? "";
    const v = s.variant.toLowerCase();
    if (/dining table|^table,/.test(v) || /stockholm-2025-table-/.test(slug)) return dining(s);
    if (/side table/.test(v)) return /side-table-40/.test(slug) || s.size.w < 50 ? pedestal(s) : splayed(s);
    if (/coffee table/.test(v)) return /2025/.test(slug) ? slatCoffee(s) : ovalCoffee(s);
    if (/shelving unit\/bench/.test(v) || /shelving-unit-bench/.test(slug)) return shelvingBench(s);
    if (/shelving unit/.test(v)) return shelvingUnit(s);
    if (/bench/.test(v)) return bench(s);
    if (/easy chair/.test(v)) return easyChair(s);
    if (/armchair/.test(v)) return roundArmchair(s);
    if (/chair with armrests/.test(v)) return armChair(s);
    if (/^chair/.test(v)) return chair2025(s);
    if (/cabinet with 2 doors/.test(v)) return cabinet2(s);
    if (/glass-door cabinet/.test(v)) return glassCabinet(s);
    if (/cabinet with sliding doors/.test(v)) return slidingCabinet(s);
    if (/^sideboard/.test(v) && /2025/.test(slug)) return sideboard(s);
    if (/seat sofa|seat section/.test(v)) return /2025/.test(slug) ? modular(s) : leatherSofa(s);
    return null;
  },
};
export default family;
