import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FLISAT, read from its manuals. The children's table is a frame with two lids: a middle bar on two dowels drops
 * into the frame, four screws hold it from underneath, the legs (their bolts already fitted) turn in by hand and
 * the lids lie in on top. The stool is just four splayed legs turned into the seat. The open storage is built from
 * ladder frames held by long bolts and shelves on dowels; see `storage`.
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

const family: Family = {
  names: ["FLISAT"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/children-s-table/.test(slug)) return table(s);
    if (/children-s-stool/.test(slug)) return stool(s);
    if (/open-storage/.test(slug)) return storage(s);
    return null;
  },
};
export default family;
