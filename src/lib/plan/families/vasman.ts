import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * VÄSMAN, read from the extendable table's manual. Built upside down by two people: four slide blocks clip onto
 * the two side rails, the rails are bolted under the fixed top, one leg frame is screwed onto their ends, then
 * the pull-out runners and the leaf rails slide in through the blocks and are stopped and bolted, and the other
 * leg frame goes on the runners' ends. The leaf and the sliding end top get their guide plates, and the table is
 * turned over with the leaf stored under the end top. The garden armchair comes assembled (IKEA has only a care sheet
 * for it, which says to tighten its screws again each season), so its guide unpacks it and checks the screws.
 */

const TUBE = 25;

/** A round tube from a to b, in the y-z plane or the x-y plane. */
function tube(a: Vec3, b: Vec3): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const rot: Vec3 = Math.abs(d[0]) < 1e-6 ? [Math.atan2(d[2], d[1]), 0, 0] : [0, 0, Math.atan2(-d[0], d[1])];
  return { shape: "cyl", size: [TUBE, len, TUBE], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot, material: "metal" };
}

/** A slatted top: slats across the table on two battens. */
function slatted(id: string, name: string, x0: number, x1: number, D: number, t: number, y: number): CustomPart {
  const L = x1 - x0, n = Math.max(3, Math.round(L / 66)), gap = 6;
  const sw = (L - gap * (n - 1)) / n;
  const pieces: PartPiece[] = Array.from({ length: n }, (_, i) => ({ shape: "box" as const, size: [sw, t, D] as Vec3, pos: [-L / 2 + sw / 2 + i * (sw + gap), 0, 0] as Vec3 }));
  return { id, name, size: [L, t, D], pos: [(x0 + x1) / 2, y, 0], pieces, material: "wood" };
}

function table(s: ProductSpec): CustomParams {
  // IKEA: 135 long (190 with the leaf), 74 wide, 75 high
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25, yT = H - tt / 2;
  const leaf = 550, xs = W / 2 - leaf; // where the fixed top ends and the sliding end top starts
  const rh = 40, rw = 30, yR = H - tt - rh / 2, zr = D / 2 - 50;
  const xp = W / 2 - 20 - TUBE / 2, zp = D / 2 - 40; // leg posts
  const xR = xp - TUBE / 2; // rails and runners end at the posts
  const legOf = (id: string, sx: number): CustomPart => {
    const x = sx * xp, top = H - tt;
    const segs: [Vec3, Vec3][] = [
      [[x, TUBE / 2, -zp], [x, top, -zp]],
      [[x, TUBE / 2, zp], [x, top, zp]],
      [[x, TUBE / 2, -zp], [x, TUBE / 2, zp]],
    ];
    const pos: Vec3 = [x, top / 2, 0];
    const rel = (p: Vec3): Vec3 => [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
    return { id, name: "Leg frame", size: [TUBE, top, 2 * zp + TUBE], pos, pieces: segs.map(([a, b]) => tube(rel(a), rel(b))), material: "metal" };
  };
  const yLr = yR - 5;
  const leafLo = yLr - 51 - 11; // underside of the stored leaf
  const parts: CustomPart[] = [
    { id: "RA", name: "Side rail", size: [xR + xs - 40, rh, rw], pos: [(-xR + xs - 40) / 2, yR, -zr], material: "metal" },
    { id: "RB", name: "Side rail", size: [xR + xs - 40, rh, rw], pos: [(-xR + xs - 40) / 2, yR, zr], material: "metal" },
    slatted("T", "Table top", -W / 2, xs - 2, D, tt, yT),
    legOf("GA", -1),
    // the runners slide inside the side rails and carry the end leg frame
    { id: "UA", name: "Runner", size: [xR + 100, 24, 20], pos: [(xR - 100) / 2, yR, -zr], material: "metal" },
    { id: "UB", name: "Runner", size: [xR + 100, 24, 20], pos: [(xR - 100) / 2, yR, zr], material: "metal" },
    { id: "KA", name: "Leaf rail", size: [xR - xs + 60, 20, 20], pos: [(xR + xs - 60) / 2, yLr - 30, -zr + 70], material: "metal" },
    { id: "KB", name: "Leaf rail", size: [xR - xs + 60, 20, 20], pos: [(xR + xs - 60) / 2, yLr - 30, zr - 70], material: "metal" },
    legOf("GB", 1),
    // stored under the end top, on the leaf rails
    slatted("F", "Leaf", xs + 10, xR - 20, D - 160, 22, yLr - 51),
    slatted("E", "End top", xs + 2, W / 2, D, tt, yT),
  ];
  const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
  const both = (f: (z: number) => Vec3[]) => [-zr, zr].flatMap(f);
  const blocks = (z: number) => fx("clip", [-W / 2 + 200, xs - 120].map((x): Vec3 => [x, yR - rh / 2, z]), [0, 1, 0], { name: "Slide block", len: 50, dia: 30 });
  const steps: CustomStep[] = [
    {
      title: "Clip two slide blocks onto one side rail",
      detail: "On a rug. Press each block on from below, then turn it until it clicks.",
      add: ["RA"],
      fix: [blocks(-zr)],
      pose: "-y",
      people: 2,
      warnings: ["floor", "two"],
    },
    { title: "Clip two onto the other side rail", detail: "The same way, and turn them all the same way round.", add: ["RB"], fix: [blocks(zr)] },
    {
      title: "Set the rails on the upside-down top",
      detail: "Lay the fixed top face down on the rug, then the rails on it, the pins of the slide blocks in their holes.",
      add: ["T"],
    },
    {
      title: "Bolt the rails to the top",
      detail: "Four long bolts with washers through each rail. Turn them in by hand first.",
      fix: [fx("bolt", both((z) => [-W / 2 + 80, -W / 2 + 320, xs - 260, xs - 60].map((x): Vec3 => [x, yR - rh / 2, z])), [0, 1, 0], { len: 60, dia: 6 })],
      tools: ["allen"],
    },
    {
      title: "Fix a leg frame to the rail ends",
      detail: "Screw two long studs into the top of each leg, then into the end of the rail.",
      add: ["GA"],
      fix: [fx("stud", both((z) => [yR - 8, yR + 8].map((y): Vec3 => [-xR, y, z])), [1, 0, 0], { len: 40, dia: 8 })],
      tools: ["allen"],
    },
    { title: "Slide the runners into the slide blocks", detail: "From the open end, both at once, all the way through.", add: ["UA", "UB"], from: { UA: [600, 0, 0], UB: [600, 0, 0] } },
    {
      title: "Screw the stops onto the runners",
      detail: "One short bolt near the inner end of each runner, so it can't pull out.",
      fix: [fx("bolt", [-zr, zr].map((z): Vec3 => [-90, yR - 12, z]), [0, 1, 0], { len: 12, dia: 6 })],
      tools: ["allen"],
    },
    { title: "Slide in the leaf rails", detail: "Under the runners, in the open end, until they meet the stops.", add: ["KA", "KB"], from: { KA: [500, 0, 0], KB: [500, 0, 0] } },
    {
      title: "Bolt the leaf rails to the runners",
      detail: "A bolt through each with a spacer tube between rail and runner. The spacer sits square, not tilted.",
      fix: [
        // from the outside of the rail, through the spacer, into the leaf rail
        ...[-1, 1].map((sz) => fx("bolt", [[xR - 40, yLr - 30, sz * (zr - 10)]], [0, 0, -sz], { len: 70, dia: 6 })),
        ...[-1, 1].map((sz) => fx("spacer", [[xR - 40, yLr - 30, sz * (zr - 36)]], [0, 0, -sz], { name: "Spacer tube", len: 50, dia: 14 })),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw in the leaf rails' stops",
      detail: "One short bolt at the inner end of each leaf rail.",
      fix: [fx("bolt", [-1, 1].map((sz): Vec3 => [xs - 10, yLr - 40, sz * (zr - 70)]), [0, 1, 0], { len: 12, dia: 6 })],
      tools: ["allen"],
    },
    { title: "Tighten the bolts at the first leg frame", detail: "Both studs on each side, firmly, with the Allen key.", tools: ["allen"] },
    {
      title: "Fix the other leg frame to the runners",
      detail: "Two short studs into the top of each leg, then into the runner ends.",
      add: ["GB"],
      fix: [fx("stud", both((z) => [yR - 6, yR + 6].map((y): Vec3 => [xR, y, z])), [-1, 0, 0], { len: 25, dia: 8 })],
      tools: ["allen"],
    },
    { title: "Tighten every bolt", detail: "Go round all eight bolts under the top and tighten them now.", tools: ["allen"], check: "square" },
    {
      title: "Screw the guide plates under the leaf",
      detail: "Lay the leaf face down on the rug. One plate at each end of a batten, two screws in each.",
      wait: ["F"],
      fix: [
        // screws first, so each plate sits between its own two
        fx("screw", [-1, 1].flatMap((sz) => [-24, 24].map((dx): Vec3 => [xs + 45 + dx, leafLo - 8, sz * (zr - 70)])), [0, 1, 0], { len: 14, dia: 4, on: "F" }),
        fx("plate", [-1, 1].map((sz): Vec3 => [xs + 45, leafLo - 4, sz * (zr - 70)]), [0, 1, 0], { name: "Leaf guide plate", len: 8, dia: 40, on: "F" }),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw the guide plates under the end top",
      detail: "The end top face down too, and the other plates, the ones with a raised block. Two screws in each.",
      wait: ["E"],
      fix: [
        fx("screw", [-1, 1].flatMap((sz) => [-24, 24].map((dx): Vec3 => [xs + 60 + dx, H - tt - 8, sz * (zr - 40)])), [0, 1, 0], { len: 14, dia: 4, on: "E" }),
        fx("plate", [-1, 1].map((sz): Vec3 => [xs + 60, H - tt - 7, sz * (zr - 40)]), [0, 1, 0], { name: "End guide plate", len: 14, dia: 40, on: "E" }),
      ],
      tools: ["allen"],
    },
    {
      title: "Turn the table over together",
      detail: "Lift it by the fixed top, not by the runners.",
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Put the leaf and the end top on",
      detail: "The leaf rests on the leaf rails, stored under the end top, and the end top rides on the runners. To extend, pull the end out, lift the leaf in and push it closed.",
      add: ["F", "E"],
      from: { F: [0, 400, 0], E: [0, 500, 0] },
    },
  ];
  return { parts, steps };
}

function armchair(s: ProductSpec): CustomParams {
  // IKEA: 54 wide, 92 high, 59 deep, seat 45 high; one cantilever frame with cord woven over the seat and back
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const X = W / 2 - 40, zf = D / 2 - 30, zb = D / 2 - 30, seatY = 450, armY = 650;
  const c: Vec3 = [0, H / 2, 0];
  const rel = (p: PartPiece): PartPiece => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] });
  const backLo: Vec3 = [0, seatY - 20, -zb + 40], backHi: Vec3 = [0, H - 10, -zb - 15];
  const side = (x: number): PartPiece[] => [
    tube([x, TUBE / 2, -zb], [x, TUBE / 2, zf]),
    tube([x, TUBE / 2, zf], [x, seatY, zf - 40]),
    tube([x, seatY, zf - 40], [x, backLo[1], backLo[2]]),
    tube([x, backLo[1], backLo[2]], [x, backHi[1], backHi[2]]),
    tube([x, armY, -zb + 20], [x, armY, zf - 70]),
    tube([x, armY, zf - 70], [x, seatY, zf - 70]),
  ];
  const lean = Math.atan2(backHi[2] - backLo[2], backHi[1] - backLo[1]);
  const raw: PartPiece[] = [
    ...side(-X),
    ...side(X),
    tube([-X, TUBE / 2, -zb], [X, TUBE / 2, -zb]),
    { shape: "box", size: [2 * X - 10, 8, zf - 40 - backLo[2]], pos: [0, seatY - 12, (zf - 40 + backLo[2]) / 2], rot: [-0.04, 0, 0], material: "fiber" },
    { shape: "box", size: [2 * X - 10, backHi[1] - backLo[1] - 30, 8], pos: [0, (backLo[1] + backHi[1]) / 2 + 10, (backLo[2] + backHi[2]) / 2], rot: [lean, 0, 0], material: "fiber" },
  ];
  const pieces = raw.map(rel);
  return {
    parts: [{ id: "CH", name: "Armchair", size: [2 * X + TUBE, H, D], pos: c, pieces, material: "metal" }],
    steps: [
      { title: "Unpack the chair", detail: "It comes ready assembled, so there is nothing to put together. Cut the wrapping open carefully so the knife can't catch the cord.", add: ["CH"] },
      { title: "Check the screws are tight", detail: "Do it again at least once a season: it keeps the chair steady." },
    ],
  };
}

const family: Family = {
  names: ["VÄSMAN", "VASMAN"],
  recipe(s) {
    const t = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
    if (/table/.test(t)) return table(s);
    if (/chair/.test(t)) return armchair(s);
    return null;
  },
};
export default family;
