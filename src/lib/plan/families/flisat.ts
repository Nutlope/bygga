import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FLISAT, read from its manuals. The children's table is a frame with two lids: a middle bar on two dowels drops
 * into the frame, four screws hold it from underneath, the legs (their bolts already fitted) turn in by hand and
 * the lids lie in on top. The stool is just four splayed legs turned into the seat. The open storage is built from
 * ladder frames held by long bolts and shelves on dowels; see `storage`. The bench and desk share end frames with
 * knob-bolted legs (`bench`, `desk`); the wall storage is a small box on cam locks (`wallStorage`).
 */

const r = (n: number) => Math.round(n * 10) / 10;
const fx = (kind: CustomFix["kind"], on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({
  kind,
  count: at.length,
  on,
  dir,
  at: at.map((p) => p.map(r) as Vec3),
  ...o,
});

function table(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 22, rim = 70, bw = 50;
  const yTop = H, yF = H - T / 2;
  const frame: PartPiece[] = [
    ...[-1, 1].map((sz) => ({ shape: "box" as const, size: [W, T, rim] as Vec3, pos: [0, 0, sz * (D / 2 - rim / 2)] as Vec3 })),
    ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [rim, T, D - 2 * rim] as Vec3, pos: [sx * (W / 2 - rim / 2), 0, 0] as Vec3 })),
  ];
  const inW = W - 2 * rim, inD = D - 2 * rim;
  const lidW = (inW - bw) / 2;
  const bt = 14, yBar = yTop - 8 - bt / 2;
  const legH = H - T, ld = 40;
  const lx = W / 2 - 45, lz = D / 2 - 45;
  const parts: CustomPart[] = [
    { id: "F", name: "Table frame", size: [W, T, D], pos: [0, yF, 0], pieces: frame, material: "wood" },
    { id: "M", name: "Middle bar", size: [bw, bt, inD], pos: [0, yBar, 0], material: "wood" },
    ...[-1, 1].map((sx, i) => ({ id: `L${i}`, name: "Lid", size: [lidW, 8, inD] as Vec3, pos: [sx * (bw / 2 + lidW / 2), yTop - 4, 0] as Vec3, material: "board" as const })),
    ...[-1, 1].flatMap((sx, i) => [-1, 1].map((sz, j) => ({ id: `G${i}${j}`, name: "Leg", size: [ld, legH, ld] as Vec3, pos: [sx * lx, legH / 2, sz * lz] as Vec3, shape: "cyl" as const, material: "wood" as const }))),
  ];
  const legs = parts.filter((p) => p.name === "Leg").map((p) => p.id);
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the middle bar",
      detail: "One in each end, pushed in by hand or tapped gently.",
      fix: [fx("dowel", "M", [0, 0, 1], [[0, yBar, inD / 2]], { mate: "F" }), fx("dowel", "M", [0, 0, -1], [[0, yBar, -inD / 2]], { mate: "F" })],
      warnings: ["floor"],
    },
    {
      title: "Drop the bar into the frame",
      detail: "Lay the frame top up on a rug, then lower the bar across the middle so its dowels find the holes.",
      add: ["F"],
      from: { F: [0, -260, 0] },
    },
    {
      title: "Turn it over and screw the bar in",
      detail: "Two screws at each end, through the bar into the frame. Stop as soon as they sit flush.",
      fix: [fx("screw", "M", [0, 1, 0], [-1, 1].flatMap((sz) => [-1, 1].map((sx) => [sx * 12, yBar - bt / 2, sz * (inD / 2 - 25)] as Vec3)), { len: 16, dia: 3.5, mate: "F" })],
      tools: ["screwdriver"],
      pose: "-y",
    },
    {
      title: "Screw in the legs",
      detail: "The bolts are already in the legs. Turn each one clockwise by hand until it stops, and keep it straight.",
      add: legs,
    },
    {
      title: "Turn it over and lay the lids in",
      detail: "Stand it on its legs, then drop both lids into the frame on either side of the bar.",
      add: ["L0", "L1"],
      pose: "+y",
      from: { L0: [0, 220, 0], L1: [0, 220, 0] },
    },
  ];
  return { parts, steps };
}

function stool(s: ProductSpec): CustomParams {
  const H = s.size.h * 10, W = s.size.w * 10;
  const st = 30, sw = 270;
  const yS = H - st / 2, yB = H - st;
  const top = 85, foot = W / 2 - 25;
  const lean = Math.atan((foot - top) / yB);
  const len = Math.hypot(yB, (foot - top) * Math.SQRT2);
  const mid = (top + foot) / 2;
  const parts: CustomPart[] = [{ id: "S", name: "Seat", size: [sw, st, sw], pos: [0, yS, 0], material: "wood" }];
  [-1, 1].forEach((sx, i) =>
    [-1, 1].forEach((sz, j) => parts.push({ id: `G${i}${j}`, name: "Leg", size: [32, len, 32], pos: [sx * mid, yB / 2, sz * mid], rot: [-sz * lean, 0, sx * lean], shape: "cyl", material: "wood" })),
  );
  return {
    parts,
    steps: [
      { title: "Lay the seat upside down", detail: "On a rug or the flattened box, so the top doesn't scratch.", add: ["S"], pose: "-y", warnings: ["floor"] },
      {
        title: "Screw in the legs",
        detail: "Their bolts are already fitted. Turn each leg clockwise by hand until it is tight; the holes give them their lean.",
        add: parts.filter((p) => p.name === "Leg").map((p) => p.id),
      },
      { title: "Turn it over", detail: "Stand it up and check all four legs touch the floor.", pose: "+y" },
    ],
  };
}

/**
 * The open storage: two side ladders (their white side panels already in), a top between them on six small
 * dowels, then rails and a back panel screwed in with the unit on its back. Standing up, two middle bars take
 * long dowels for the back middle post (fitted face down) and the front middle post screws onto the front rails.
 * Last come the clothes rail on two bolts, four shelves on angle brackets and the wall fixing.
 */
function storage(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const P = 36, RT = 22, RH = 44; // posts, rungs and rails
  const xi = W / 2 - P, zp = D / 2 - P; // inside faces of the side posts, front of the back posts
  const yT = H - 25; // underside of the top
  const ys = [300, 520, 780] as const; // rung centres: bottom shelf, band bottom, band top
  const yR = yT - RH / 2; // top rail and bar centre
  const zF = D / 2 - 22 - RT / 2; // front rails sit behind the middle post
  const zB = -D / 2 + 22 + RT / 2; // back rails sit in front of the back middle post
  const band = { lo: ys[1] - 10, hi: ys[2] + 10 };
  const ladder = (sx: -1 | 1, id: string): CustomPart => {
    const cy = H / 2, ix = -sx * (P - RT) / 2;
    const rung = (y0: number, h: number): PartPiece => ({ shape: "box", size: [RT, h, 2 * zp], pos: [ix, y0 + h / 2 - cy, 0] });
    return {
      id,
      name: "Side frame",
      size: [P, H, D],
      pos: [sx * (W / 2 - P / 2), cy, 0],
      material: "wood",
      pieces: [
        { shape: "box", size: [P, H - 25, P], pos: [0, 12.5, zp + P / 2] },
        { shape: "box", size: [P, H, P], pos: [0, 0, -zp - P / 2] },
        rung(0, RH),
        ...ys.map((y) => rung(y - RH / 2, RH)),
        rung(yT, 25),
        { shape: "box", size: [8, ys[2] - ys[1] - RH, 2 * zp], pos: [ix, (ys[1] + ys[2]) / 2 - cy, 0], material: "board" },
      ],
    };
  };
  const m = 18, n = 22; // middle posts: half their width, their depth
  const topLine: [number, number][] = [
    [-xi, -D / 2], [-m, -D / 2], [-m, -D / 2 + n], [m, -D / 2 + n], [m, -D / 2], [xi, -D / 2],
    [xi, D / 2], [m, D / 2], [m, D / 2 - n], [-m, D / 2 - n], [-m, D / 2], [-xi, D / 2],
  ];
  const midH = H - (ys[0] - RH / 2);
  const shelf = (id: string, sx: -1 | 1, inner: number, y: number, z0: number, z1: number): CustomPart => ({
    id,
    name: "Shelf",
    size: [xi - inner, 18, z1 - z0],
    pos: [sx * (xi + inner) / 2, y + 9, (z0 + z1) / 2],
    material: "board",
  });
  const fz = 166; // shelves stop short of the front middle post
  const parts: CustomPart[] = [
    ladder(-1, "L"),
    ladder(1, "R"),
    ...[-1, 1].map((sx, i) => ({ id: i ? "FR" : "FL", name: "Foot", size: [P, 25, 110] as Vec3, pos: [sx * (W / 2 - P / 2), 12.5, D / 2 + 5] as Vec3, material: "wood" as const })),
    { id: "T", name: "Top", size: [2 * xi, 25, D], pos: [0, yT + 12.5, 0], material: "board", pieces: [{ shape: "slab", outline: topLine, size: [2 * xi, 25, D], pos: [0, 0, 0] }] },
    ...[1, 2].map((k, i) => ({ id: `B${i}`, name: "Back rail", size: [2 * xi, RH, RT] as Vec3, pos: [0, ys[k], zB] as Vec3, material: "wood" as const })),
    { id: "K", name: "Back panel", size: [2 * xi, band.hi - band.lo, 10], pos: [0, (band.lo + band.hi) / 2, zB - 4], material: "board" },
    ...[ys[0], yR].map((y, i) => ({ id: `F${i}`, name: "Front rail", size: [2 * xi, RH, RT] as Vec3, pos: [0, y, zF] as Vec3, material: "wood" as const })),
    ...[ys[0], yR].map((y, i) => ({ id: `C${i}`, name: "Middle bar", size: [2 * m, RH, zF - RT / 2 + D / 2 - n] as Vec3, pos: [0, y, (zF - RT / 2 - D / 2 + n) / 2] as Vec3, material: "wood" as const })),
    { id: "V", name: "Middle panel", size: [14, ys[2] + RH / 2 - ys[1], D / 2 - n - (zB + 1)], pos: [0, (ys[1] + ys[2] + RH / 2) / 2, (zB + 1 + D / 2 - n) / 2], material: "board" },
    { id: "MB", name: "Middle post", size: [2 * m, midH, n], pos: [0, H - midH / 2, -D / 2 + n / 2], material: "wood" },
    { id: "MF", name: "Middle post", size: [2 * m, midH, n], pos: [0, H - midH / 2, D / 2 - n / 2], material: "wood" },
    { id: "RD", name: "Clothes rail", size: [W / 2 - P - m - 40, 30, 30], pos: [(m + xi) / 2, yT - 65, 0], shape: "cyl", material: "wood" },
    shelf("S0", -1, m, ys[0] + RH / 2, -D / 2 + 4, fz),
    shelf("S1", 1, m, ys[0] + RH / 2, -D / 2 + 4, fz),
    shelf("S2", -1, 7, ys[1] + RH / 2, zB + 1, fz),
    shelf("S3", -1, 7, ys[2] + RH / 2, zB - RT / 2, fz),
  ];
  const lid = (sx: -1 | 1) => (sx < 0 ? "L" : "R");
  const sides = (sx: -1 | 1, y: number, z: number, mate: string) => fx("bolt", lid(sx), [-sx, 0, 0], [[sx * (W / 2), y, z]], { mate, len: 45, dia: 6, name: "Allen screw" });
  const both = (y: number, z: number, mate: string) => [sides(-1, y, z, mate), sides(1, y, z, mate)];
  const topDowel = (sx: -1 | 1) => fx("dowel", "T", [-sx, 0, 0], [-100, 0, 100].map((z) => [sx * xi, yT + 12.5, z] as Vec3), { mate: lid(sx), len: 30, dia: 6 });
  const glide = (sx: -1 | 1) => fx("glide", lid(sx), [0, 1, 0], [[sx * (W / 2 - P / 2), 0, -zp - P / 2]]);
  const yFront = (k: number) => (k ? yR : ys[0]);
  // the shelves' brackets: one under each end, screwed up into the shelf and sideways into what holds it
  const holds: { s: string; x: number; y: number; into: string; dir: -1 | 1 }[] = [
    { s: "S0", x: -xi, y: ys[0] + RH / 2, into: "L", dir: -1 },
    { s: "S0", x: -m, y: ys[0] + RH / 2, into: "C0", dir: 1 },
    { s: "S1", x: m, y: ys[0] + RH / 2, into: "C0", dir: -1 },
    { s: "S1", x: xi, y: ys[0] + RH / 2, into: "R", dir: 1 },
    { s: "S2", x: -xi, y: ys[1] + RH / 2, into: "L", dir: -1 },
    { s: "S2", x: -7, y: ys[1] + RH / 2, into: "V", dir: 1 },
    { s: "S3", x: -xi, y: ys[2] + RH / 2, into: "L", dir: -1 },
    { s: "S3", x: -7, y: ys[2] + RH / 2, into: "V", dir: 1 },
  ];
  const shelfIds = ["S0", "S1", "S2", "S3"];
  const steps: CustomStep[] = [
    {
      title: "Tap the small dowels into the top",
      detail: "Three in each end. Lay the top on a rug so it doesn't get scratched.",
      fix: [topDowel(-1), topDowel(1)],
      wait: ["T"],
      warnings: ["floor"],
    },
    {
      title: "Press a foot onto each side frame",
      detail: "Its two pins go into the bottom of the front post. Do the same on the other side frame.",
      add: ["L", "FL"],
      from: { FL: [0, -160, 0] },
      pose: "+z",
      repeat: 2,
    },
    {
      title: "Push a glide into each back post",
      detail: "Into the bottom of the back post, on both side frames.",
      fix: [glide(-1)],
      repeat: 2,
    },
    {
      title: "Join the side frames to the top",
      detail: "With both frames on their back edges, push them onto the top's dowels. Check the white side panels sit fully in their grooves.",
      add: ["T", "R", "FR"],
      from: { R: [520, 0, 0], FR: [520, 0, 0] },
      fix: [glide(1)],
    },
    {
      title: "Screw in the two back rails",
      detail: "Lower them in between the frames, the holes facing in. Turn the screws by hand with the Allen key, never with a drill.",
      add: ["B0", "B1"],
      from: { B0: [0, 0, 420], B1: [0, 0, 420] },
      fix: [...both(ys[1], zB, "B0"), ...both(ys[2], zB, "B1")],
    },
    {
      title: "Slide in the back panel",
      detail: "Tilt it into the grooves of both back rails, white side towards the front.",
      add: ["K"],
      from: { K: [0, 0, 420] },
    },
    {
      title: "Screw the back panel to the side frames",
      detail: "Two screws through each back post into the ends of the panel.",
      fix: [...both(ys[1] + 70, zB - 4, "K"), ...both(ys[2] - 70, zB - 4, "K")],
    },
    {
      title: "Screw in the two front rails",
      detail: "The bottom one level with the lowest shelf rungs, the top one just under the top.",
      add: ["F0", "F1"],
      from: { F0: [0, 0, 300], F1: [0, 0, 300] },
      fix: [0, 1].flatMap((k) => both(yFront(k), zF, `F${k}`)),
    },
    { title: "Tighten all the screws", detail: "Go round every screw once more with the Allen key until the frame feels firm." },
    {
      title: "Stand it up and fit the bottom middle bar",
      detail: "Two long dowels in its back end, then lay it from the middle of the front rail to the back.",
      fix: [fx("dowel", "C0", [0, 0, 1], [-9, 9].map((x) => [x, ys[0], -D / 2 + n] as Vec3), { mate: "MB", len: 40, dia: 8 })],
      add: ["C0"],
      from: { C0: [0, 0, -420] },
      pose: "+y",
    },
    {
      title: "Fit the top bar and the middle panel",
      detail: "The top bar goes in the same way, just under the top. Slide the white middle panel in from the front, against the back panel.",
      fix: [fx("dowel", "C1", [0, 0, 1], [-9, 9].map((x) => [x, yR, -D / 2 + n] as Vec3), { mate: "MB", len: 40, dia: 8 })],
      add: ["C1", "V"],
      from: { C1: [0, 0, -420], V: [0, 0, 460] },
    },
    {
      title: "Lay it on its front and fit the back post",
      detail: "Press the rounded post down onto the four dowels in the bars, into the notch in the top.",
      add: ["MB"],
      pose: "-z",
    },
    {
      title: "Screw the back post to the bars",
      detail: "One long screw into each bar. Turn them by hand.",
      fix: [0, 1].map((k) => fx("bolt", "MB", [0, 0, 1], [[0, yFront(k), -D / 2]], { mate: `C${k}`, len: 60, dia: 6, name: "Long Allen screw" })),
    },
    {
      title: "Stand it up and tap in the front dowels",
      detail: "One long dowel in the middle of each front rail.",
      fix: [0, 1].map((k) => fx("dowel", `F${k}`, [0, 0, -1], [[0, yFront(k), D / 2 - n]], { mate: "MF", len: 40, dia: 8 })),
      pose: "+y",
    },
    { title: "Push on the front post", detail: "Line it up with the notch in the top and press it onto both dowels.", add: ["MF"] },
    {
      title: "Screw the front post to the rails",
      detail: "Two long screws into each rail, either side of the dowel.",
      fix: [0, 1].map((k) => fx("bolt", "MF", [0, 0, -1], [-12, 12].map((d) => [0, yFront(k) + d, D / 2] as Vec3), { mate: `F${k}`, len: 40, dia: 6, name: "Long Allen screw" })),
    },
    {
      title: "Hang the clothes rail",
      detail: "Two bolts up through the rail and the top, with a nut on each. Hold the nut while you turn the bolt.",
      add: ["RD"],
      from: { RD: [0, -260, 0] },
      fix: [
        fx("bolt", "RD", [0, 1, 0], [m + 60, xi - 60].map((x) => [x, yT - 80, 0] as Vec3), { mate: "T", len: 110, dia: 6 }),
        fx("nut", "T", [0, -1, 0], [m + 60, xi - 60].map((x) => [x, H, 0] as Vec3)),
      ],
    },
    {
      title: "Screw the brackets under the shelves",
      detail: "One bracket under each end of every shelf, one screw each.",
      fix: [
        ...holds.map((h) => fx("angle", h.s, [0, 1, 0], [[h.x - h.dir * 8, h.y - 10, 0]], { name: "Shelf bracket" })),
        ...holds.map((h) => fx("screw", h.s, [0, 1, 0], [[h.x - h.dir * 14, h.y - 2, 0]], { len: 12, dia: 4 })),
      ],
      wait: shelfIds,
    },
    {
      title: "Put the shelves in",
      detail: "Two at the bottom and two in the left half of the white box, brackets underneath.",
      add: shelfIds,
      from: Object.fromEntries(shelfIds.map((id) => [id, [0, 0, 460] as Vec3])),
    },
    {
      title: "Screw the brackets to the frame",
      detail: "One screw through each bracket into the rung, bar or panel under the shelf.",
      fix: holds.map((h) => fx("screw", h.s, [h.dir, 0, 0], [[h.x - h.dir * 6, h.y - 12, 0]], { mate: h.into, len: 16, dia: 4 })),
    },
    {
      title: "Press the wall spacers onto the back",
      detail: "One on the back of each back post, near the top. Trim them first if your skirting board needs more room.",
      fix: [fx("connector", "L", [0, 0, -1], [-1, 1].map((sx) => [sx * (W / 2 - P / 2), H - 80, -D / 2] as Vec3), { name: "Wall spacer" })],
    },
    {
      title: "Fix it to the wall",
      detail: "One screw through each back post into the wall. Plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", "L", [0, 0, -1], [-1, 1].map((sx) => [sx * (W / 2 - P / 2), H - 80, -D / 2 - 30] as Vec3)),
        fx("screw", "L", [0, 0, -1], [-1, 1].map((sx) => [sx * (W / 2 - P / 2), H - 80, -D / 2 + 16] as Vec3), { len: 50, dia: 5, included: true }),
      ].map((f) => ({ ...f, on: undefined })),
      tools: ["screwdriver", "drill", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

/**
 * The height-adjustable bench and desk share one build: two end frames (glued rectangles), long rails on one dowel
 * per end stood in one end frame lying on the rug, the other frame on top and screws through both frames. The
 * outer legs come last, two green knob bolts each, in one of three rows of holes for the height.
 */
const lean = (y: number, top: number, foot: number, h: number) => foot - ((foot - top) * y) / h;

/** One end frame: two posts on the legs' slant, a top bar and a bottom bar, as pieces of one part. */
function endFrame(id: string, sx: -1 | 1, x: number, t: number, y0: number, y1: number, zAt: (y: number) => number, bars: { y: number; h: number }[], postTop = y1): CustomPart {
  const cy = (y0 + y1) / 2;
  const th = Math.atan2(zAt(y0) - zAt(postTop), postTop - y0);
  const pieces: PartPiece[] = [-1, 1].map((sz) => ({
    shape: "box" as const,
    size: [t, Math.hypot(postTop - y0, zAt(y0) - zAt(postTop)), 40] as Vec3,
    pos: [0, (y0 + postTop) / 2 - cy, sz * (zAt(y0) + zAt(postTop)) / 2] as Vec3,
    rot: [-sz * th, 0, 0] as Vec3,
  }));
  for (const b of bars) pieces.push({ shape: "box", size: [t, b.h, 2 * zAt(b.y) + 30], pos: [0, b.y - cy, 0] });
  return { id, name: "End frame", size: [t, y1 - y0, 2 * zAt(y0) + 40], pos: [sx * x, cy, 0], pieces, material: "wood" };
}

/** An outer leg on the slant, front (sz 1) or back (sz -1). */
function slantLeg(id: string, sx: number, sz: number, x: number, h: number, top: number, foot: number, t = 30, d = 45): CustomPart {
  const th = Math.atan2(foot - top, h);
  return { id, name: "Leg", size: [t, Math.hypot(h, foot - top), d], pos: [sx * x, h / 2, sz * (top + foot) / 2], rot: [-sz * th, 0, 0], material: "wood" };
}

const KNOB = { name: "Knob bolt", len: 45, dia: 8 };

function bench(s: ProductSpec): CustomParams {
  const W = s.size.w * 10 || 610, H = s.size.h * 10 || 470, D = s.size.d * 10 || 360;
  const LT = 30, FT = 24; // legs and end frames, thickness along x
  const xl = W / 2 - LT / 2, xf = xl - LT / 2 - FT / 2, xi = xf - FT / 2; // leg, frame centres, frame inner face
  const foot = D / 2 - 22, top = foot - 28;
  const zAt = (y: number) => lean(y, top, foot, H);
  const yS = H - 30, ST = 18; // seat top, the legs stand a little above it
  const y0 = yS - 300; // bottom of the end frames
  const yA = yS - ST - 35, zA = 125, yL = y0 + 30; // aprons under the seat, low rail
  const parts: CustomPart[] = [
    endFrame("E0", -1, xf, FT, y0, yS, zAt, [{ y: yS - 30, h: 60 }, { y: yL, h: 60 }]),
    ...[-1, 1].map((sz, i): CustomPart => ({ id: `A${i}`, name: "Seat rail", size: [2 * xi, 70, 20], pos: [0, yA, sz * zA], material: "wood" })),
    { id: "LR", name: "Low rail", size: [2 * xi, 60, 22], pos: [0, yL, 0], material: "wood" },
    { id: "S", name: "Seat", size: [2 * xi, ST, 300], pos: [0, yS - ST / 2, 0], material: "board" },
    endFrame("E1", 1, xf, FT, y0, yS, zAt, [{ y: yS - 30, h: 60 }, { y: yL, h: 60 }]),
    ...[-1, 1].flatMap((sx, i) => [-1, 1].map((sz, j) => slantLeg(`G${i}${j}`, sx, sz, xl, H, top, foot))),
  ];
  const ends = (id: string, pts: [number, number][]) => [-1, 1].map((sx) => fx("dowel", id, [-sx, 0, 0], pts.map(([y, z]) => [sx * xi, y, z] as Vec3)));
  const rails: [string, number, number][] = [["A0", yS - 25, -zA], ["A1", yS - 25, zA], ["LR", yL, 0]];
  const screws = (sx: -1 | 1, f: string) => fx("bolt", f, [-sx, 0, 0], rails.map(([, y, z]) => [sx * (xf + FT / 2), y, z] as Vec3), { name: "Screw", len: 50, dia: 6 });
  const legs = parts.filter((p) => p.name === "Leg").map((p) => p.id);
  return {
    parts,
    steps: [
      {
        title: "Tap the dowels into the seat and the rails",
        detail: "One in each end of the three rails, two in each end of the seat. Ten in all.",
        fix: [...ends("S", [[yS - ST / 2, -80], [yS - ST / 2, 80]]), ...ends("A0", [[yA, -zA]]), ...ends("A1", [[yA, zA]]), ...ends("LR", [[yL, 0]])],
        wait: ["S", "A0", "A1", "LR"],
        tools: ["hammer"],
        warnings: ["floor"],
      },
      {
        title: "Stand the rails in one end frame",
        detail: "Lay an end frame flat on the rug and push the two seat rails and the low rail onto its holes, standing straight up.",
        add: ["E0", "A0", "A1", "LR"],
        from: { A0: [320, 0, 0], A1: [320, 0, 0], LR: [320, 0, 0] },
        pose: "+x",
      },
      { title: "Slide the seat in", detail: "Down between the seat rails, white side out, onto its two dowels.", add: ["S"], from: { S: [360, 0, 0] } },
      { title: "Lay the other end frame on top", detail: "Line up the holes and press it down onto all the dowels.", add: ["E1"], from: { E1: [300, 0, 0] } },
      { title: "Screw the top end frame on", detail: "Three screws, one into each rail, with the Allen key. Not a drill.", fix: [screws(1, "E1")], tools: ["allen"] },
      { title: "Turn it over and screw the other frame", detail: "Three more screws, the same way.", fix: [screws(-1, "E0")], pose: "-x", tools: ["allen"] },
      {
        title: "Screw the seat rails to the seat",
        detail: "Turn the bench upside down. Two long screws through each seat rail into the seat, by hand.",
        fix: [fx("screw", "A0", [0, 1, 0], [-150, 150].flatMap((x) => [-zA, zA].map((z) => [x, yA - 35, z] as Vec3)), { len: 80, dia: 4, mate: "S" })].map((f) => ({ ...f, on: undefined })),
        pose: "-y",
        tools: ["screwdriver"],
      },
      {
        title: "Bolt on the legs at the height you want",
        detail: "Stand it up. Two knob bolts through each leg into the end frame, all four legs in the same row of holes.",
        add: legs,
        from: Object.fromEntries(legs.map((id) => [id, [id[1] === "0" ? -200 : 200, 0, 0] as Vec3])),
        fix: [-1, 1].flatMap((sx, i) => [-1, 1].map((sz) => fx("bolt", `E${i}`, [-sx, 0, 0], [y0 + 70, yS - 60].map((y) => [sx * (xl + LT / 2), y, sz * zAt(y)] as Vec3), KNOB))).map((f) => ({ ...f, on: undefined })),
        pose: "+y",
      },
    ],
  };
}

/**
 * The desk: the same frame with four rails, then a tilting top built from a white board and a raised wooden edge
 * on three sides. It hooks onto two pivot bolts at the front and rests on two rubber stops at the back; two swing
 * arms prop it up when tilted and a strap stops it tipping too far. A rod for a paper roll lies in the back notches.
 */
function desk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10 || 970, H = s.size.h * 10 || 590, D = s.size.d * 10 || 650;
  const LT = 30, FT = 24;
  const xl = W / 2 - LT / 2, xf = xl - LT / 2 - FT / 2, xi = xf - FT / 2;
  const foot = D / 2 - 25, top = foot - 65, hL = H - 30;
  const zAt = (y: number) => lean(y, top, foot, hL);
  const y0 = 150, yTb = 510, yBb = y0 + 30; // end frame bottom, top bar and bottom bar centres
  const RW = 2 * xi, RT = 22;
  const zLo = 200, zF = 200, zK = -zAt(H) - 10; // low rails, front top rail, back top rail
  const yF = yTb, yK = 490;
  const yB = 542, BT = 18, LH = 30, LW = 20; // the top: board and its raised edge
  const xT = xi - 2, zT0 = -zAt(H) - 21, zT1 = D / 2 - 35;
  const zTc = (zT0 + zT1) / 2, dT = zT1 - zT0;
  const yE = yB + BT + LH / 2;
  const xPiv = xi - 2 - LW / 2, zPiv = zAt(yE) - 4, yPiv = yE;
  const parts: CustomPart[] = [
    endFrame("E0", -1, xf, FT, y0, H, zAt, [{ y: yTb, h: 60 }, { y: yBb, h: 60 }]),
    ...[-1, 1].map((sz, i): CustomPart => ({ id: `R${i}`, name: "Low rail", size: [RW, 60, RT], pos: [0, yBb, sz * zLo], material: "wood" })),
    { id: "RK", name: "Back rail", size: [RW, 60, RT], pos: [0, yK, zK], material: "wood" },
    { id: "RF", name: "Front rail", size: [RW, 60, RT], pos: [0, yF, zF], material: "wood" },
    endFrame("E1", 1, xf, FT, y0, H, zAt, [{ y: yTb, h: 60 }, { y: yBb, h: 60 }]),
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `SA${i}`, name: "Swing arm", size: [20, 110, 36], pos: [sx * (xi - 10), yTb - 40, -120], material: "wood" })),
    {
      id: "T",
      name: "Desk top",
      size: [2 * xT, BT + LH, dT],
      pos: [0, yB + (BT + LH) / 2, zTc],
      material: "board",
      // the white board with its raised wooden edge on three sides, built on the rug first
      pieces: [
        { shape: "box", size: [2 * xT, BT, dT], pos: [0, -LH / 2, 0] },
        { shape: "box", size: [2 * xT - 2 * LW, LH, LW], pos: [0, BT / 2, -dT / 2 + LW / 2], material: "wood" },
        ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [LW, LH, dT], pos: [sx * (xT - LW / 2), BT / 2, 0], material: "wood" })),
      ],
    },
    ...[-1, 1].flatMap((sx, i) => [-1, 1].map((sz, j) => slantLeg(`G${i}${j}`, sx, sz, xl, hL, top, foot))),
    { id: "PR", name: "Paper roll rod", size: [2 * xT - 2 * LW, 24, 24], pos: [0, yB + BT + LH, zT0 + LW + 14], shape: "cyl", material: "wood" },
    { id: "ST", name: "Strap", size: [40, 110, 3], pos: [0, (yK - 20 + yE + 8) / 2, zT0 - 1.5], material: "soft" },
  ];
  const ends = (id: string, y: number, z: number) => [-1, 1].map((sx) => fx("dowel", id, [-sx, 0, 0], [[sx * xi, y, z]]));
  const big = (sx: -1 | 1, f: string) =>
    fx("bolt", f, [-sx, 0, 0], ([[yBb, -zLo], [yBb, zLo], [yK, zK]] as const).map(([y, z]) => [sx * (xf + FT / 2), y, z] as Vec3), { name: "Screw", len: 50, dia: 6 });
  const mid = (sx: -1 | 1, f: string) => fx("bolt", f, [-sx, 0, 0], [[sx * (xf + FT / 2), yF, zF]], { name: "Screw", len: 40, dia: 6 });
  const legs = parts.filter((p) => p.name === "Leg").map((p) => p.id);
  const lipScrews: Vec3[] = [
    ...[-300, 0, 300].map((x): Vec3 => [x, yB, zT0 + LW / 2]),
    ...[-1, 1].flatMap((sx) => [zT0 + 120, zTc, zT1 - 60].map((z): Vec3 => [sx * (xT - LW / 2), yB, z])),
  ];
  const lipDowels = [
    fx("dowel", "T", [0, 1, 0], [-200, 200].map((x) => [x, yB + BT, zT0 + LW / 2] as Vec3)),
    ...[-1, 1].map((sx) => fx("dowel", "T", [0, 1, 0], [zT0 + 200, zT1 - 120].map((z) => [sx * (xT - LW / 2), yB + BT, z] as Vec3))),
  ];
  const cones = [-1, 1].map((sx) => [sx * (xi - 60), yK + 30, zK] as Vec3);
  return {
    parts,
    steps: [
      {
        title: "Stand the two low rails in one end frame",
        detail: "Lay an end frame flat on the rug. A dowel in each end of both low rails, then push them into the bottom bar.",
        add: ["E0", "R0", "R1"],
        fix: [...ends("R0", yBb, -zLo), ...ends("R1", yBb, zLo)],
        from: { R0: [320, 0, 0], R1: [320, 0, 0] },
        pose: "+x",
        tools: ["hammer"],
        warnings: ["floor"],
      },
      { title: "Add the back rail", detail: "Two dowels in it, then push it into the top bar at the back.", add: ["RK"], fix: ends("RK", yK, zK), from: { RK: [320, 0, 0] } },
      { title: "Add the front rail", detail: "The same way, into the top bar at the front.", add: ["RF"], fix: ends("RF", yF, zF), from: { RF: [320, 0, 0] } },
      { title: "Lay the other end frame on top", detail: "Press it down onto all four dowels.", add: ["E1"], from: { E1: [300, 0, 0] } },
      { title: "Screw the low rails and the back rail", detail: "Three of the big screws through the end frame, with the Allen key. Not a drill.", fix: [big(1, "E1")], tools: ["allen"] },
      { title: "Screw the front rail", detail: "One of the two medium screws, into the front rail.", fix: [mid(1, "E1")], tools: ["allen"] },
      { title: "Turn it over together", detail: "Two people, so the joints don't twist.", pose: "-x", people: 2 },
      { title: "Screw the other end frame", detail: "Three big screws into the low rails and the back rail.", fix: [big(-1, "E0")], tools: ["allen"] },
      { title: "Screw the front rail on this side", detail: "The last medium screw.", fix: [mid(-1, "E0")], tools: ["allen"] },
      {
        title: "Bolt the swing arms inside the end frames",
        detail: "Stand the frame up. A barrel nut into the outside of each end frame, then a bolt through the arm into it. Leave the arms free to swing.",
        add: ["SA0", "SA1"],
        fix: [
          ...[-1, 1].map((sx, i) => fx("nut", `E${i}`, [-sx, 0, 0], [[sx * (xf + FT / 2), yTb - 70, -120]], { name: "Barrel nut", len: 20, dia: 10 })),
          ...[-1, 1].map((sx, i) => fx("bolt", `SA${i}`, [sx, 0, 0], [[sx * (xi - 20), yTb - 70, -120]], { mate: `E${i}`, len: 35, dia: 6 })),
        ],
        from: { SA0: [200, 0, 0], SA1: [-200, 0, 0] },
        pose: "+y",
        tools: ["allen"],
      },
      {
        title: "Screw the rubber stops onto the back rail",
        detail: "One near each end, a small washer under each long screw.",
        fix: [
          fx("cap", "RK", [0, -1, 0], cones.map(([x, y, z]) => [x, y + 20, z] as Vec3), { name: "Rubber stop", len: 20, dia: 30 }),
          fx("screw", "RK", [0, -1, 0], cones.map(([x, y, z]) => [x, y + 22, z] as Vec3), { len: 50, dia: 4 }),
          fx("washer", "RK", [0, -1, 0], cones.map(([x, y, z]) => [x, y + 22, z] as Vec3), { dia: 10 }),
        ],
        tools: ["screwdriver"],
      },
      {
        title: "Join the edges of the top",
        detail: "Two dowels in each end of the back edge, then push the two side edges onto them.",
        fix: [-1, 1].map((sx) => fx("dowel", "T", [-sx, 0, 0], [yE - 7, yE + 7].map((y) => [sx * (xT - LW), y, zT0 + LW / 2] as Vec3))),
        wait: ["T"],
        tools: ["hammer"],
      },
      { title: "Tap dowels into the edge", detail: "Six along the underside of the edge frame you just made.", fix: lipDowels, tools: ["hammer"] },
      { title: "Lay the board on the edge frame", detail: "Turn the edge frame over, dowels down, and press it onto the board. Then turn the top face down on the rug, carefully." },
      { title: "Screw the board to the edge frame", detail: "Nine screws up through the board, with the Allen key.", fix: [fx("screw", "T", [0, 1, 0], lipScrews, { len: 40, dia: 5 })], tools: ["allen"] },
      {
        title: "Push the barrel nuts into the top's sides",
        detail: "One near the front of each side edge, its slot turned to take the bolt.",
        fix: [-1, 1].map((sx) => fx("nut", "T", [sx, 0, 0], [[sx * (xT - LW), yPiv, zPiv]], { name: "Barrel nut", len: 20, dia: 10 })),
      },
      {
        title: "Put washers on the pivot holes",
        detail: "Press one onto the inside of each end frame, over the hole near the top front.",
        fix: [-1, 1].map((sx, i) => fx("washer", `E${i}`, [sx, 0, 0], [[sx * xi, yPiv, zPiv]], { dia: 20 })),
      },
      { title: "Lower the top into the frame", detail: "Between the end frames, the raised edge at the back.", add: ["T"], from: { T: [0, 260, 0] } },
      { title: "Hook the top onto the pivots", detail: "Slide it forward until the slots under its sides sit on both washers." },
      {
        title: "Bolt the top to the end frames",
        detail: "One bolt through each end frame into the barrel nut. Firm, but the top must still tilt.",
        fix: [-1, 1].map((sx, i) => fx("bolt", `E${i}`, [-sx, 0, 0], [[sx * (xf + FT / 2), yPiv, zPiv]], { mate: "T", len: 40, dia: 6 })),
        tools: ["allen"],
      },
      {
        title: "Tap a glide into each leg",
        detail: "Into the hole in the foot end, with a hammer.",
        fix: legs.map((id) => {
          const p = parts.find((q) => q.id === id)!;
          return fx("glide", id, [0, 1, 0], [[p.pos[0], 0, (id[2] === "0" ? -1 : 1) * foot]], { name: "Glide" });
        }),
        wait: legs,
        tools: ["hammer"],
      },
      {
        title: "Bolt on the legs at the height you want",
        detail: "Two knob bolts through each leg into the end frame, all four legs in the same row of holes.",
        add: legs,
        from: Object.fromEntries(legs.map((id) => [id, [id[1] === "0" ? -200 : 200, 0, 0] as Vec3])),
        fix: [-1, 1].flatMap((sx, i) => [-1, 1].map((sz) => fx("bolt", `E${i}`, [-sx, 0, 0], [y0 + 120, yTb - 80].map((y) => [sx * (xl + LT / 2), y, sz * zAt(y)] as Vec3), KNOB))).map((f) => ({ ...f, on: undefined })),
      },
      { title: "Lay the rod in the back notches", detail: "It holds a paper roll behind the raised edge.", add: ["PR"], from: { PR: [0, 160, 0] } },
      { title: "Try the tilt", detail: "Lift the back of the top and swing the arms up under it to hold it. Lower it again to lay it flat." },
      {
        title: "Screw on the strap",
        detail: "From the back edge of the top down to the back rail, a washer under each small screw. It stops the top tipping too far.",
        add: ["ST"],
        fix: [
          fx("screw", "ST", [0, 0, 1], [[0, yE, zT0 - 3]], { len: 16, dia: 4, mate: "T" }),
          fx("screw", "ST", [0, 0, 1], [[0, yK - 15, zT0 - 3]], { len: 16, dia: 4, mate: "RK" }),
          fx("washer", "ST", [0, 0, 1], [[0, yE, zT0 - 3], [0, yK - 15, zT0 - 3]], { dia: 12 }),
        ],
        from: { ST: [0, 0, -120] },
        tools: ["screwdriver"],
      },
    ],
  };
}

/**
 * The wall storage: two end pieces take two cam bolts each, the bottom (grooved for the back) and the back board
 * take dowels, one end goes on, the back drops into the groove, the other end closes it and four cam locks pull it
 * tight. Lying on its back, the front rail lies in the notches of the ends and a long screw holds each end. Two
 * screws (not included) through the back hang it on the wall.
 */
function wallStorage(s: ProductSpec): CustomParams {
  const W = s.size.w * 10 || 700, H = s.size.h * 10 || 160, D = s.size.d * 10 || 90;
  const ET = 18, xi = W / 2 - ET, xe = W / 2 - ET / 2;
  const KT = 12, zK = -D / 2 + KT / 2, BT = 18;
  const yR = H - 32, zR = D / 2 - 16;
  const parts: CustomPart[] = [
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `E${i}`, name: "End piece", size: [ET, H, D], pos: [sx * xe, H / 2, 0], material: "wood" })),
    { id: "B", name: "Bottom", size: [2 * xi, BT, D - KT - 4], pos: [0, BT / 2, (D / 2 - 4 + -D / 2 + KT) / 2], material: "wood" },
    { id: "K", name: "Back board", size: [2 * xi, H - 6, KT], pos: [0, (H + 6) / 2, zK], material: "wood" },
    { id: "R", name: "Front rail", size: [W + 4, 20, 20], pos: [0, yR, zR], shape: "cyl", material: "wood" },
  ];
  const yKb = H / 2 + 20, zB = 8;
  const cams = [-1, 1].map((sx, i) => fx("camScrew", `E${i}`, [sx, 0, 0], [[sx * xi, yKb, zK], [sx * xi, BT / 2, zB]], { len: 34, dia: 6 }));
  const locks = (i: number) => {
    const sx = i ? 1 : -1;
    return [fx("cam", "K", [0, 0, 1], [[sx * (xi - 26), yKb, -D / 2]], { dia: 15 }), fx("cam", "B", [0, 1, 0], [[sx * (xi - 26), 0, zB]], { dia: 15 })];
  };
  return {
    parts,
    steps: [
      { title: "Screw the cam bolts into the end pieces", detail: "Two in each, by hand with a screwdriver. Not a drill.", fix: cams, wait: ["E0", "E1"], tools: ["screwdriver"], warnings: ["floor"] },
      { title: "Tap the dowels into the bottom", detail: "Two in each end.", fix: [-1, 1].map((sx) => fx("dowel", "B", [-sx, 0, 0], [-15, 25].map((z) => [sx * xi, BT / 2, z] as Vec3))), wait: ["B"], tools: ["hammer"] },
      { title: "Push one end piece onto the bottom", detail: "Its notch at the top and the groove of the bottom towards the back.", add: ["B", "E0"], from: { E0: [-160, 0, 0] } },
      { title: "Tap the dowels into the back board", detail: "One in each end.", fix: [-1, 1].map((sx) => fx("dowel", "K", [-sx, 0, 0], [[sx * xi, H - 30, zK]])), wait: ["K"], tools: ["hammer"] },
      { title: "Fit the back board", detail: "Its lower edge in the groove of the bottom, its dowel and bolt into the end piece.", add: ["K"], from: { K: [260, 0, 0] } },
      { title: "Put on the other end piece and lock it", detail: "Press it onto the dowels and bolts, then turn the four cam locks clockwise until they pull tight.", add: ["E1"], from: { E1: [160, 0, 0] }, fix: [...locks(0), ...locks(1)], tools: ["screwdriver"] },
      {
        title: "Screw in the front rail",
        detail: "Turn it onto its back. Lay the rail in the notches and drive a long screw through each end into the end piece.",
        add: ["R"],
        from: { R: [0, 0, 120] },
        fix: [-1, 1].map((sx) => fx("bolt", "R", [0, 0, -1], [[sx * xe, yR, zR + 10]], { name: "Screw", len: 40, dia: 5, mate: sx < 0 ? "E0" : "E1" })),
        pose: "+z",
        tools: ["allen"],
      },
      {
        title: "Hang it on the wall",
        detail: "Two screws through the back board. They aren't included: pick ones made for your wall, with heads that don't sink in.",
        fix: [
          fx("plug", "K", [0, 0, -1], [-1, 1].map((sx) => [sx * (xi - 60), H - 30, -D / 2 - 30] as Vec3)),
          fx("screw", "K", [0, 0, -1], [-1, 1].map((sx) => [sx * (xi - 60), H - 30, -D / 2 + KT] as Vec3), { len: 50, dia: 5 }),
        ].map((f) => ({ ...f, on: undefined })),
        pose: "+y",
        tools: ["screwdriver", "drill", "pencil", "level"],
        wall: true,
        warnings: ["wall"],
      },
    ],
  };
}

const family: Family = {
  names: ["FLISAT"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/children-s-table/.test(slug)) return table(s);
    if (/children-s-stool/.test(slug)) return stool(s);
    if (/open-storage/.test(slug)) return storage(s);
    if (/children-s-bench/.test(slug)) return bench(s);
    if (/children-s-desk/.test(slug)) return desk(s);
    if (/wall-storage/.test(slug)) return wallStorage(s);
    return null;
  },
};
export default family;
