import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * EKHOLMA, read from its manuals. The sofa frame is upholstered already: the backrest is lowered onto the seat
 * frame, the armrests slide onto both ends, and every joint is a hexagon bolt screwed into one part with the turning
 * tool that clicks into a connector in the other (two under the backrest, one at the top of each arm, two at the
 * bottom of each arm). Lying on its back, the four legs are screwed in on washers with felt pads, plastic glides go
 * into the bottom, then two people stand it up, pull the cover on and fasten it underneath. The corner sofa with an
 * open end is the same frame with an end panel instead of the right arm, plus a chaise section built upside down on
 * its own legs, with a backrest clicked on, pushed against it and held with two clamps. The sofa-bed is a different
 * build: two armrests on legs joined by three rods, a bed box that slides in between them with the folded mattress
 * on top as the seat, and a backrest that hooks in behind.
 */

const LEG = 150; // free height under the sofa
const SEAT = 340; // top of the seat frame
const BACK = 700;
const ARM = 620;
const AW = 175;
const D = 850;
const BT = 180; // backrest frame, front to back

const CLICK = { kind: "stud" as const, len: 25, dia: 12, name: "Click bolt" };
const legPieces: PartPiece[] = [
  { shape: "box", size: [50, LEG / 2, 50], pos: [0, LEG / 4, 0], material: "wood" },
  { shape: "box", size: [40, LEG / 2, 40], pos: [0, -LEG / 4, 0], material: "wood" },
];

interface Frame {
  parts: CustomPart[];
  ids: { base: string; back: string; left: string; right: string; legs: string[]; seats: string[]; backs: string[] };
  x0: number;
  x1: number;
  z0: number;
}

/** One sofa frame from x0 to x1, its back at z0: seat frame, backrest, an arm at each end (or an end panel on the right). */
function frame(x0: number, x1: number, z0: number, endPanel: boolean, p: string): Frame {
  const parts: CustomPart[] = [];
  const rw = endPanel ? 90 : AW;
  const xa = x0 + AW, xb = x1 - rw;
  const sw = xb - xa;
  const zc = z0 + D / 2;
  parts.push({ id: `${p}base`, name: "Seat frame", size: [sw, SEAT - LEG, D], pos: [(xa + xb) / 2, (LEG + SEAT) / 2, zc], material: "soft" });
  parts.push({ id: `${p}back`, name: "Backrest", size: [sw, BACK - SEAT, BT], pos: [(xa + xb) / 2, (SEAT + BACK) / 2, z0 + BT / 2], material: "soft" });
  const arm = (id: string, x: number, sx: number): CustomPart => ({
    id,
    name: "Armrest",
    size: [AW + 20, ARM - LEG, D],
    pos: [x + sx * 10, (LEG + ARM) / 2, zc],
    pieces: [
      { shape: "box", size: [AW, ARM - LEG - 70, D], pos: [-sx * 10, -35, 0] },
      { shape: "box", size: [AW + 20, 70, D], pos: [0, (ARM - LEG) / 2 - 35, 0] },
    ],
    material: "soft",
  });
  parts.push(arm(`${p}armL`, x0 + AW / 2, -1));
  if (endPanel) parts.push({ id: `${p}armR`, name: "End panel", size: [rw, SEAT - LEG, D], pos: [x1 - rw / 2, (LEG + SEAT) / 2, zc], material: "soft" });
  else parts.push({ ...arm(`${p}armR`, x1 - AW / 2, 1), id: `${p}armR` });
  const legs = ([[x0 + 80, z0 + 80], [x1 - 80, z0 + 80], [x0 + 80, z0 + D - 80], [x1 - 80, z0 + D - 80]] as const).map(([x, z], i) => {
    parts.push({ id: `${p}leg${i}`, name: "Leg", size: [50, LEG, 50], pos: [x, LEG / 2, z], pieces: legPieces, material: "wood" });
    return `${p}leg${i}`;
  });
  const n = 2;
  const cw = sw / n;
  const seats = Array.from({ length: n }, (_, i) => {
    parts.push({ id: `${p}seat${i}`, name: "Seat cushion", size: [cw - 6, 150, D - BT - 10], pos: [xa + cw * (i + 0.5), SEAT + 75, z0 + BT + (D - BT) / 2 - 5], material: "soft" });
    return `${p}seat${i}`;
  });
  const backs = Array.from({ length: n }, (_, i) => {
    parts.push({ id: `${p}bc${i}`, name: "Back cushion", size: [cw - 10, 440, 200], pos: [xa + cw * (i + 0.5), SEAT + 150 + 220, z0 + BT + 100], material: "soft" });
    return `${p}bc${i}`;
  });
  return { parts, ids: { base: `${p}base`, back: `${p}back`, left: `${p}armL`, right: `${p}armR`, legs, seats, backs }, x0, x1, z0 };
}

/** The frame's own steps, the same for the sofas and the corner sofa's main section. */
function frameSteps(f: Frame, endPanel: boolean): CustomStep[] {
  const { ids, x0, x1, z0 } = f;
  const xa = x0 + AW, xb = x1 - (endPanel ? 90 : AW);
  const sw = xb - xa;
  const legAt = (i: number) => {
    const xs = [x0 + 80, x1 - 80, x0 + 80, x1 - 80], zs = [z0 + 80, z0 + 80, z0 + D - 80, z0 + D - 80];
    return [xs[i], zs[i]];
  };
  const clicks = (pts: Vec3[], dir: (p: Vec3) => Vec3, on: (p: Vec3) => string, mate: string): CustomFix[] =>
    pts.map((p) => ({ ...CLICK, count: 1, at: [p], dir: dir(p), on: on(p), mate }));
  const side = (p: Vec3) => (p[0] < (x0 + x1) / 2 ? ids.left : ids.right);
  const inward = (p: Vec3): Vec3 => [p[0] < (x0 + x1) / 2 ? 1 : -1, 0, 0];
  const second = endPanel ? "the end panel" : "the other armrest";
  return [
    {
      title: "Lower the backrest onto the seat frame",
      detail: "Stand the seat frame on the floor, then lower the backrest into place at its back edge.",
      add: [ids.base, ids.back],
    },
    {
      title: "Click the backrest to the seat frame",
      detail: "Screw the two hexagon bolts into the seat frame with the turning tool, then press the backrest down until both connectors click.",
      fix: clicks([[xa + sw * 0.25, SEAT, z0 + BT / 2], [xa + sw * 0.75, SEAT, z0 + BT / 2]], () => [0, 1, 0], () => ids.base, ids.back),
      warnings: ["hand"],
    },
    {
      title: endPanel ? "Push the armrest and the end panel on" : "Push the armrests on",
      detail: `Slide the armrest onto the left end and ${second} onto the right, against the seat frame and the backrest.`,
      add: [ids.left, ids.right],
    },
    {
      title: "Click them to the backrest",
      detail: "One hexagon bolt at the top of each end, turned in with the tool until it clicks.",
      fix: clicks([[xa, endPanel ? SEAT - 40 : BACK - 60, z0 + BT / 2], [xb, endPanel ? SEAT - 40 : BACK - 60, z0 + BT / 2]], inward, side, ids.back).map((c, i) => (endPanel && i === 1 ? { ...c, mate: ids.base } : c)),
    },
    {
      title: "Lay it on its back and click the bottom",
      detail: "On a rug or the flattened box. Two hexagon bolts at the bottom of each end, into the seat frame.",
      fix: clicks([[xa, LEG + 50, z0 + 200], [xa, LEG + 50, z0 + D - 120], [xb, LEG + 50, z0 + 200], [xb, LEG + 50, z0 + D - 120]], inward, side, ids.base),
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Screw in the legs",
      detail: "A washer on each leg's bolt, then turn it in by hand until it's snug. Stick a felt pad under each one.",
      add: ids.legs,
      fix: [
        { kind: "washer", count: 4, len: 2, dia: 30, at: [0, 1, 2, 3].map((i) => [legAt(i)[0], LEG + 1, legAt(i)[1]] as Vec3), dir: [0, 1, 0] },
        { kind: "glide", name: "Felt pad", count: 4, len: 4, dia: 40, at: [0, 1, 2, 3].map((i) => [legAt(i)[0], 0, legAt(i)[1]] as Vec3), dir: [0, 1, 0] },
      ],
      pose: "+z",
      warnings: ["hand"],
    },
    {
      title: "Push in the plastic glides",
      detail: "Into the holes in the bottom of each end, near the front and the back.",
      fix: [{ kind: "glide", name: "Plastic glide", count: 4, len: 10, dia: 30, at: [[x0 + AW / 2, LEG, z0 + 200], [x0 + AW / 2, LEG, z0 + D - 200], [x1 - 45, LEG, z0 + 200], [x1 - 45, LEG, z0 + D - 200]], dir: [0, 1, 0] }],
      pose: "+z",
    },
    { title: "Stand it up together", detail: "One of you at each end. Lift it by the frame, never by the legs.", pose: "+y", people: 2, warnings: ["two"] },
  ];
}

function coverSteps(f: Frame[]): CustomStep[] {
  return [
    { title: "Pull the cover over the frame", detail: "Two of you, starting at the armrests and the backrest, then down over the front. Line up its seams with the frame's edges.", people: 2, warnings: ["two"] },
    { title: "Fasten the cover underneath", detail: "Pull each flap tight under the frame and press the hook-and-loop strips together.", warnings: ["floor"] },
    { title: "Zip the covers onto the seat cushions and lay them in", detail: "Fold the cushion in half to get it into the cover, then zip it shut. Zips to the back.", add: f.flatMap((x) => x.ids.seats) },
    { title: "Put the back cushions in", detail: "Covers on the same way, then stand them against the backrest.", add: f.flatMap((x) => x.ids.backs) },
  ];
}

function sofa(s: ProductSpec): CustomParams {
  const W = s.size.w * 10;
  const f = frame(-W / 2, W / 2, -D / 2, false, "");
  return { parts: f.parts, steps: [...frameSteps(f, false), ...coverSteps([f])] };
}

/** The corner sofa: a two-seat frame with the left arm and an end panel, and the open-end chaise to its right. */
function corner(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, Dt = s.size.d * 10;
  const CW = 900;
  const z0 = -Dt / 2;
  const f = frame(-W / 2, W / 2 - CW, z0, true, "m");
  const xa = W / 2 - CW, xb = W / 2, xc = (xa + xb) / 2;
  const L = Dt - BT;
  const parts: CustomPart[] = [...f.parts];
  parts.push({ id: "cbase", name: "Chaise frame", size: [CW, SEAT - LEG - 30, L], pos: [xc, (LEG + SEAT - 30) / 2, z0 + BT + L / 2], material: "soft" });
  parts.push({ id: "cboard", name: "Seat board", size: [CW - 40, 30, L - 40], pos: [xc, SEAT - 15, z0 + BT + L / 2], material: "wood" });
  parts.push({ id: "cback", name: "Chaise backrest", size: [CW, BACK - LEG, BT], pos: [xc, (LEG + BACK) / 2, z0 + BT / 2], material: "soft" });
  const cl = ([[xa + 80, z0 + BT + 80], [xb - 80, z0 + BT + 80], [xa + 80, z0 + Dt - 80], [xb - 80, z0 + Dt - 80]] as const);
  cl.forEach(([x, z], i) => parts.push({ id: `cleg${i}`, name: "Leg", size: [50, LEG, 50], pos: [x, LEG / 2, z], pieces: legPieces, material: "wood" }));
  parts.push({ id: "cseat", name: "Chaise seat cushion", size: [CW - 10, 150, L - 10], pos: [xc, SEAT + 75, z0 + BT + L / 2], material: "soft" });
  for (const i of [0, 1]) parts.push({ id: `cbc${i}`, name: "Back cushion", size: [CW / 2 - 10, 440, 200], pos: [xa + (CW / 2) * (i + 0.5), SEAT + 150 + 220, z0 + BT + 100], material: "soft" });
  const legs = [0, 1, 2, 3].map((i) => `cleg${i}`);
  const chaise: CustomStep[] = [
    {
      title: "Push the support peg into the seat board",
      detail: "Into the hole in the middle of its underside, then lay the board in its cover sheet and fold the cover round it.",
      add: ["cboard"],
      fix: [{ kind: "dowel", name: "Support peg", count: 1, len: 40, dia: 10, at: [[xc, SEAT - 30, z0 + BT + L / 2]], dir: [0, 1, 0], on: "cboard" }],
    },
    {
      title: "Screw the legs into the chaise frame",
      detail: "Turn the chaise frame upside down on a rug: a washer on each leg, by hand until snug, a felt pad under each, then a plastic glide by each leg.",
      add: ["cbase", ...legs],
      fix: [
        { kind: "washer", count: 4, len: 2, dia: 30, at: cl.map(([x, z]) => [x, LEG + 1, z] as Vec3), dir: [0, 1, 0] },
        { kind: "glide", name: "Felt pad", count: 4, len: 4, dia: 40, at: cl.map(([x, z]) => [x, 0, z] as Vec3), dir: [0, 1, 0] },
        { kind: "glide", name: "Plastic glide", count: 4, len: 10, dia: 30, at: cl.map(([x, z]) => [x + (x < xc ? 70 : -70), LEG, z] as Vec3), dir: [0, 1, 0] },
      ],
      warnings: ["floor", "hand"],
    },
    {
      title: "Click the seat board onto the frame",
      detail: "Turn the frame back onto its legs. A hexagon bolt in the middle of the frame, clicked into the board's connector.",
      fix: [{ ...CLICK, count: 1, at: [[xc, SEAT - 30, z0 + BT + L / 2 + 120]], dir: [0, 1, 0], on: "cbase", mate: "cboard" }],
    },
    { title: "Pull the cover over the chaise and fasten it", detail: "Down over the sides, then pull it tight underneath and press the strips together.", warnings: ["floor"] },
    {
      title: "Click the backrest onto the chaise",
      detail: "Stand the chaise on its end, cover on the backrest first. Two hexagon bolts, turned in with the tool until they click.",
      add: ["cback"],
      fix: [{ ...CLICK, count: 2, at: [[xa + 200, LEG + 80, z0 + BT], [xb - 200, LEG + 80, z0 + BT]], dir: [0, 0, -1], on: "cbase", mate: "cback" }],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Push the chaise against the sofa and clamp them",
      detail: "Backs in line. Under the seat, one clamp at the front and one at the back, tightened by hand.",
      fix: [{ kind: "clamp", name: "Section clamp", count: 2, len: 60, dia: 30, at: [[xa, LEG + 30, z0 + 200], [xa, LEG + 30, z0 + D - 120]], dir: [0, 1, 0] }],
      warnings: ["hand"],
    },
  ];
  const cover = coverSteps([f]);
  cover[2].add = [...f.ids.seats, "cseat"];
  cover[3].add = [...f.ids.backs, "cbc0", "cbc1"];
  return { parts, steps: [...frameSteps(f, true), ...chaise, ...cover] };
}

/** The 2-seat sofa-bed (its own manual): 189 x 105 cm, the bed box between the armrests on three rods. */
function sofaBed(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, Dp = s.size.d * 10, H = s.size.h * 10;
  const aw = 140, leg = 70, armH = 700, seat = 460, z0 = -Dp / 2, zf = Dp / 2;
  const iw = W - 2 * aw, ax = iw / 2 + aw / 2;
  const bt = 160, bz0 = z0 + bt, bed = 95, mat = seat - 150;
  const parts: CustomPart[] = [];
  const arm = (id: string, sx: number): CustomPart => ({
    id,
    name: "Armrest",
    size: [aw + 20, armH - leg, Dp],
    pos: [sx * ax, (leg + armH) / 2, 0],
    pieces: [
      { shape: "box", size: [aw, armH - leg - 80, Dp], pos: [-sx * 10, -40, 0] },
      { shape: "box", size: [aw + 20, 80, Dp], pos: [0, (armH - leg) / 2 - 40, 0] },
    ],
    material: "soft",
  });
  parts.push(arm("armL", -1), arm("armR", 1));
  const lp = [-1, 1].flatMap((sx) => [z0 + 80, zf - 80].map((z) => [sx * ax, z] as [number, number]));
  const legs = lp.map(([x, z], i) => {
    parts.push({ id: `leg${i}`, name: "Leg", size: [50, leg, 50], pos: [x, leg / 2, z], pieces: [
      { shape: "box", size: [50, leg / 2, 50], pos: [0, leg / 4, 0], material: "wood" },
      { shape: "box", size: [40, leg / 2, 40], pos: [0, -leg / 4, 0], material: "wood" },
    ], material: "wood" });
    return `leg${i}`;
  });
  const rz = [z0 + 220, 30, zf - 160];
  const rods = rz.map((z, i) => {
    parts.push({ id: `rod${i}`, name: "Rod", size: [30, iw, 30], pos: [0, 75, z], rot: [0, 0, Math.PI / 2], shape: "cyl", material: "metal" });
    return `rod${i}`;
  });
  parts.push({ id: "bed", name: "Bed box", size: [iw - 20, mat - bed, zf - bz0], pos: [0, (bed + mat) / 2, (bz0 + zf) / 2], material: "soft" });
  parts.push({ id: "mat", name: "Mattress", size: [iw - 20, seat - mat, zf - bz0 - 20], pos: [0, (mat + seat) / 2, (bz0 + zf) / 2 + 10], pieces: [-1, 1].map((sx) => ({ shape: "box" as const, size: [(iw - 20) / 2 - 4, seat - mat, zf - bz0 - 20] as Vec3, pos: [(sx * (iw - 20)) / 4, 0, 0] as Vec3 })), material: "soft" });
  parts.push({ id: "back", name: "Backrest", size: [iw, armH - 250, bt], pos: [0, (250 + armH) / 2, z0 + bt / 2], material: "soft" });
  const cw = iw / 2;
  for (const i of [0, 1]) parts.push({ id: `bc${i}`, name: "Back cushion", size: [cw - 10, H - seat, 220], pos: [-iw / 2 + cw * (i + 0.5), (seat + H) / 2, bz0 + 110], material: "soft" });
  const inner = (sx: number) => sx * (iw / 2);
  const bolt = (n: number, len: number, at: Vec3[], dir: (p: Vec3) => Vec3, on: (p: Vec3) => string, mate?: (p: Vec3) => string): CustomFix[] =>
    at.map((p): CustomFix => ({ kind: "bolt", count: 1, len, dia: 8, at: [p], dir: dir(p), on: on(p), mate: mate?.(p) })).slice(0, n);
  const sideOf = (p: Vec3) => (p[0] < 0 ? "armL" : "armR");
  const inward = (p: Vec3): Vec3 => [p[0] < 0 ? 1 : -1, 0, 0];
  const rodBolts = (sx: number) => rz.flatMap((z, i) => // the plate's three bolts sit above the rod, where the armrest is (its foot ends at the legs)
  [[0, 45], [-35, 12], [35, 12]].map(([dz, dy]) => [inner(sx), 75 + dy, z + dz] as Vec3).map((p) => ({ p, i })));
  return {
    parts,
    steps: [
      {
        title: "Bolt the support blocks onto the armrests",
        detail: "Lay both armrests on their outer sides. Two bolts into the block on each, turned in with the Allen key and the turning tool.",
        add: ["armL", "armR"],
        fix: bolt(4, 60, [-1, 1].flatMap((sx) => [z0 + 300, zf - 300].map((z) => [inner(sx), 280, z] as Vec3)), (p) => [-inward(p)[0], 0, 0], sideOf),
        tools: ["allen"],
        warnings: ["floor"],
      },
      {
        title: "Screw in the legs",
        detail: "A washer on each leg's bolt, then turn it in by hand at the front and back of each armrest.",
        add: legs,
        fix: [{ kind: "washer", count: 4, len: 3, dia: 40, at: lp.map(([x, z]) => [x, leg + 1, z] as Vec3), dir: [0, 1, 0] }],
        warnings: ["hand"],
      },
      {
        title: "Push in the plastic glides",
        detail: "Two into the bottom of each armrest's inner side. The bed box slides on these.",
        fix: [{ kind: "glide", name: "Plastic glide", count: 4, len: 10, dia: 30, at: [-1, 1].flatMap((sx) => [z0 + 300, zf - 200].map((z) => [inner(sx), leg + 60, z] as Vec3)), dir: [0, 0, 1] }],
      },
      {
        title: "Stick a felt pad under each leg, and the round pads on the blocks",
        detail: "Four felt pads under the legs, then a round pad on top of each support block.",
        fix: [
          { kind: "glide", name: "Felt pad", count: 4, len: 4, dia: 40, at: lp.map(([x, z]) => [x, 0, z] as Vec3), dir: [0, 1, 0] },
          { kind: "glide", name: "Round pad", count: 2, len: 4, dia: 30, at: [-1, 1].map((sx) => [inner(sx), 300, 0] as Vec3), dir: [0, -1, 0] },
        ],
      },
      { title: "Pull the covers over the armrests", detail: "Work each one down evenly, seams on the edges, and close its zip underneath." },
      {
        title: "Bolt the three rods to one armrest",
        detail: "Stand the armrest up. One of you holds it while the other bolts each rod's plate on with three bolts and the turning tool.",
        add: rods,
        fix: rodBolts(-1).map(({ p, i }) => ({ kind: "bolt" as const, count: 1, len: 20, dia: 8, at: [p], dir: [-1, 0, 0] as Vec3, on: "armL", mate: rods[i] })),
        people: 2,
        tools: ["allen"],
        warnings: ["two"],
        from: Object.fromEntries(rods.map((r) => [r, [0, 300, 0] as Vec3])),
      },
      {
        title: "Spread the fabric over the rods and bolt on the other armrest",
        detail: "Lay the fabric flat across the rods. Push the other armrest onto their free ends: three bolts in each plate again.",
        fix: rodBolts(1).map(({ p, i }) => ({ kind: "bolt" as const, count: 1, len: 20, dia: 8, at: [p], dir: [1, 0, 0] as Vec3, on: "armR", mate: rods[i] })),
        people: 2,
        tools: ["allen"],
        warnings: ["two"],
      },
      {
        title: "Clip the brackets onto the bed box",
        detail: "One at each back corner, pressed on until it clicks. Stick a pad under each, then open the box.",
        fix: [
          { kind: "clip", name: "Bracket clip", count: 2, len: 40, dia: 30, at: [-1, 1].map((sx) => [sx * (iw / 2 - 30), mat - 20, bz0 + 30] as Vec3), dir: [0, 0, 1], on: "bed" },
          { kind: "glide", name: "Pad", count: 2, len: 4, dia: 40, at: [-1, 1].map((sx) => [sx * (iw / 2 - 120), bed, bz0 + 100] as Vec3), dir: [0, 1, 0], on: "bed" },
        ],
        wait: ["bed"],
      },
      {
        title: "Click in the three slat supports",
        detail: "Across the middle of the slats, each pushed down until it clicks.",
        fix: [{ kind: "clip", name: "Slat support", count: 3, len: 60, dia: 20, at: [-0.5, 0, 0.5].map((t) => [t * iw * 0.6, mat - 10, 80] as Vec3), dir: [0, -1, 0], on: "bed" }],
      },
      {
        title: "Slide the bed box in between the armrests",
        detail: "Together. Its brackets ride over the rods; push it in until it clicks at both sides.",
        add: ["bed"],
        from: { bed: [0, 0, 900] },
        people: 2,
        warnings: ["two"],
      },
      { title: "Zip the two mattress halves into the cover", detail: "Smooth side up. Push each half into the corners of the cover, then close the long zip.", people: 2, warnings: ["two"], kind: "cushions" },
      {
        title: "Lay the mattress on the bed and fold it in",
        detail: "Pull the bed out, lay the mattress on and press its hook strips to the bed frame, then fold it over and push the bed back in.",
        add: ["mat"],
        kind: "cushions",
      },
      { title: "Pull the cover over the backrest", detail: "Down from the top, then press the hook strips along the bottom edge." },
      {
        title: "Screw the two hooks under the backrest",
        detail: "One at each end of its lower edge, a bolt each with the turning tool.",
        fix: [
          { kind: "hook", name: "Hook bracket", count: 2, len: 50, dia: 40, at: [-1, 1].map((sx) => [sx * (iw / 2 - 60), 250, z0 + bt / 2] as Vec3), dir: [0, 1, 0], on: "back" },
          { kind: "bolt", count: 2, len: 40, dia: 6, at: [-1, 1].map((sx) => [sx * (iw / 2 - 60), 252, z0 + bt / 2] as Vec3), dir: [0, 1, 0], on: "back" },
        ],
        tools: ["allen"],
        wait: ["back"],
      },
      {
        title: "Lower the backrest in behind the bed",
        detail: "Together, between the armrests. Its hooks drop over the support blocks; press until both sides click.",
        add: ["back"],
        fix: [-1, 1].map((sx): CustomFix => ({ kind: "clip", name: "Bracket clip", count: 1, len: 40, dia: 30, at: [[sx * (iw / 2 - 20), 300, z0 + bt / 2]], dir: [-sx, 0, 0], on: sideOf([sx, 0, 0]), mate: "back" })),
        people: 2,
        warnings: ["two"],
      },
      { title: "Zip the covers onto the back cushions and put them in", detail: "Push the filling into the corners, close the zip, then stand them against the backrest.", add: ["bc0", "bc1"], kind: "cushions" },
    ],
  };
}

const family: Family = {
  names: ["EKHOLMA"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/sofa-bed/.test(slug)) return sofaBed(s);
    if (/corner-sofa/.test(slug)) return corner(s);
    if (/seat-sofa/.test(slug)) return sofa(s);
    return null;
  },
};
export default family;
