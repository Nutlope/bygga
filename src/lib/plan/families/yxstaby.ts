import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * YXSTABY gaming monitor stand, read from its manual: a particleboard top on two steel end legs, with a steel cable
 * tray hanging under its back edge. It is built upside down on a rug: the right leg is screwed to the top through its
 * flange, the cable tray is laid on and tipped up, the left leg slides on, then the leg flanges, the tray flange and
 * two small corner brackets are screwed down. Four anti-slip pads go under the legs and the stand is turned over;
 * the hooks clip onto the back. Fourteen screws of one kind in all.
 * The side table on castors, from its manual: built upside down on a rug. Four connector bolts go into the top, each
 * post takes a barrel nut and slides onto a bolt, a locking screw holds it, the shelf drops over the posts onto four
 * pins, and the bottom board goes on. One castor screws through it into a post (loose for now), the three curved
 * slatted panels slide into the round track one by one, then that castor is tightened and the other three go in.
 * The thumbstick stool, from its manual: the column clicks into the round base and the seat clicks onto the column.
 * IKEA: 37.5 across, 44.2 high.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
const SCREW = { len: 10, dia: 4 };
const UP: Vec3 = [0, 1, 0];

function recipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10), H = Math.round(s.size.h * 10), D = Math.round(s.size.d * 10);
  const TT = 16, yT = H - TT; // underside of the top
  const ST = 3; // steel sheet
  const FW = 30; // leg flange, inwards under the top
  const xo = W / 2; // outer face of a leg
  const leg = (id: string, g: 1 | -1): CustomPart => ({
    id,
    name: "Leg",
    size: [FW + ST, yT, D],
    pos: [g * (xo - (FW + ST) / 2), yT / 2, 0],
    material: "metal",
    pieces: [
      { shape: "box", size: [ST, yT, D], pos: [g * (FW / 2), 0, 0] },
      { shape: "box", size: [FW, ST, D - 30], pos: [-g * (ST / 2), yT / 2 - ST / 2, 0] },
    ],
  });
  const xf = xo - ST - FW / 2; // flange screw line
  const tl = 2 * (xo - ST - FW) - 10; // tray length, between the leg flanges
  const zb = -D / 2; // back edge
  const tz = zb + 40; // tray's hanging plate
  const parts: CustomPart[] = [
    {
      id: "T",
      name: "Top",
      size: [W, TT, D],
      pos: [0, H - TT / 2, 0],
      material: "board",
      // the front corners are rounded
      pieces: [{ shape: "slab", size: [W, TT, D], pos: [0, 0, 0], outline: [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, D / 2], [-W / 2, D / 2]], round: 14 }],
    },
    leg("R", 1),
    leg("L", -1),
    {
      id: "C",
      name: "Cable tray",
      size: [tl, 90, 42],
      pos: [0, yT - 45, zb + 21],
      material: "metal",
      pieces: [
        { shape: "box", size: [tl, 2, 42], pos: [0, 45 - 1, 0] },
        { shape: "box", size: [tl, 88, 2], pos: [0, -1, 19] },
      ],
    },
    ...([1, -1] as const).map((g): CustomPart => ({ id: g > 0 ? "KR" : "KL", name: "Corner bracket", size: [xo - ST - tl / 2, 30, 20], pos: [g * ((xo - ST + tl / 2) / 2), yT - 60, tz + 12], material: "metal" })),
  ];
  // the flange screws go up through the flange into the top
  const flange = (id: string, g: number, zs: number[]) => fx("screw", zs.map((z): Vec3 => [g * xf, yT - ST - 1, z]), UP, id, { ...SCREW, mate: "T" });
  const steps: CustomStep[] = [
    {
      title: "Screw the right leg onto the top",
      detail: "Lay the top face down on a rug. Stand the leg on its end, flange on the top, and turn in three screws by hand.",
      add: ["T", "R"],
      fix: [flange("R", 1, [-D / 2 + 40, 0, D / 2 - 40])],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Lay the cable tray on the top", detail: "Flat along the back edge, its end against the right leg.", add: ["C"] },
    { title: "Tip the tray up into place", detail: "Turn it up onto its edge so its flange lies on the top and its end tucks into the leg." },
    {
      title: "Slide on the left leg",
      detail: "Push it on from the end so it covers the end of the tray, then one screw through its flange.",
      add: ["L"],
      from: { L: [-200, 0, 0] },
      fix: [flange("L", -1, [0])],
      tools: ["screwdriver"],
    },
    { title: "Turn it round", detail: "Swing it end for end on the rug so the open back faces you. It stays upside down." },
    {
      title: "Slide in the corner brackets",
      detail: "One at each end of the tray, between the tray and the leg.",
      add: ["KR", "KL"],
      from: { KR: [0, 0, 120], KL: [0, 0, 120] },
    },
    { title: "Screw the left leg's flange down", detail: "Two more screws, one near each end of the flange.", fix: [flange("L", -1, [-D / 2 + 40, D / 2 - 40])], tools: ["screwdriver"] },
    {
      title: "Screw the tray's flange to the top",
      detail: "Six screws, spread along the back.",
      fix: [fx("screw", [-0.42, -0.25, -0.08, 0.08, 0.25, 0.42].map((f): Vec3 => [f * tl, yT - 3, zb + 15]), UP, "C", { ...SCREW, mate: "T" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the brackets to the legs",
      detail: "One screw through each bracket into the leg.",
      fix: ([1, -1] as const).map((g) => fx("screw", [[g * (xo - ST - 2), yT - 60, tz + 12]], [g, 0, 0], g > 0 ? "KR" : "KL", { ...SCREW, mate: g > 0 ? "R" : "L" })),
      tools: ["screwdriver"],
    },
    {
      title: "Stick on the pads and turn it over",
      detail: "Two anti-slip pads under each leg, then stand the stand on its legs.",
      fix: ([1, -1] as const).map((g) => fx("glide", [-D / 2 + 40, D / 2 - 40].map((z): Vec3 => [g * (xo - ST / 2), 0, z]), UP, g > 0 ? "R" : "L", { name: "Anti-slip pad", len: 2, dia: 20 })),
      pose: "+y",
    },
    {
      title: "Clip on the holders",
      detail: "The headphone hook, the controller holder and the cable holder hook over the back edge wherever you like them.",
      fix: [fx("hook", [-W / 3, 40, W / 3].map((x): Vec3 => [x, H - TT / 2, zb]), [0, 0, 1], "T", { name: "Holder", len: 60, dia: 30 })],
    },
  ];
  return { parts, steps };
}

/** Euler angles (x then z) that turn a part's y axis onto d. */
function along(d: Vec3): Vec3 {
  const n = Math.hypot(...d);
  const [x, y, z] = [d[0] / n, d[1] / n, d[2] / n];
  return [Math.atan2(z, y), 0, Math.atan2(-x, Math.hypot(y, z))];
}

/** Turns v by an "XYZ" Euler, as three.js does (R = Rx Ry Rz). */
function turn(v: Vec3, r: Vec3 = [0, 0, 0]): Vec3 {
  let [x, y, z] = v;
  const [a, b, c] = r;
  [x, y] = [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)];
  [x, z] = [x * Math.cos(b) + z * Math.sin(b), -x * Math.sin(b) + z * Math.cos(b)];
  [y, z] = [y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  return [x, y, z];
}

/** A part from pieces given where they sit in the finished product, centred on their bounds. */
function compound(id: string, name: string, pieces: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces)
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const c = turn([(sx * p.size[0]) / 2, (sy * p.size[1]) / 2, (sz * p.size[2]) / 2], p.rot);
          for (let i = 0; i < 3; i++) {
            lo[i] = Math.min(lo[i], p.pos[i] + c[i]);
            hi[i] = Math.max(hi[i], p.pos[i] + c[i]);
          }
        }
  const pos: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos, material, pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] })) };
}

/** The corners of a square board outline, half width h (the slab rounds them). */
function roundSquare(h: number): [number, number][] {
  return [[-h, -h], [h, -h], [h, h], [-h, h]];
}

function sideTable(): CustomParams {
  const HT = 500, H = 550, CAST = 60;
  const BT = 18, TT = 20;
  const yB = CAST + BT; // top of the bottom board
  const yT = H - TT; // underside of the top
  const R = 222; // the round track the panels run in
  const PT = 12; // panel thickness
  const ps = 136; // posts sit on the diagonals, inside the panels
  const POST = 25;
  const yS = 300; // the shelf
  const corners: Vec3[] = [[-ps, 0, -ps], [ps, 0, -ps], [ps, 0, ps], [-ps, 0, ps]];
  const posts = corners.map((_, i) => `P${i + 1}`);
  const parts: CustomPart[] = [
    { id: "T", name: "Top", size: [HT, TT, HT], pos: [0, yT + TT / 2, 0], material: "wood", pieces: [{ shape: "slab", size: [HT, TT, HT], pos: [0, 0, 0], outline: roundSquare(HT / 2), round: 150 }] },
    ...corners.map((c, i): CustomPart => ({ id: posts[i], name: "Post", size: [POST, yT - yB, POST], pos: [c[0], (yT + yB) / 2, c[2]], material: "metal" })),
    { id: "S", name: "Shelf", size: [2 * R - 50, 15, 2 * R - 50], pos: [0, yS, 0], material: "board", pieces: [{ shape: "slab", size: [2 * R - 50, 15, 2 * R - 50], pos: [0, 0, 0], outline: roundSquare(R - 25), round: 180 }] },
    { id: "B", name: "Bottom board", size: [2 * R + 30, BT, 2 * R + 30], pos: [0, CAST + BT / 2, 0], material: "wood", pieces: [{ shape: "slab", size: [2 * R + 30, BT, 2 * R + 30], pos: [0, 0, 0], outline: roundSquare(R + 15), round: 160 }] },
  ];
  // three curved panels of slats, each over a third of the track less a gap, so they can be slid round to open it
  const panel = (id: string, mid: number): CustomPart => {
    const n = 11, span = (2 * Math.PI) / 3 - 0.12;
    const w = (R * span) / n;
    const pieces: PartPiece[] = Array.from({ length: n }, (_, k) => {
      const t = mid - span / 2 + (k + 0.5) * (span / n);
      return { shape: "box", size: [w - 2, yT - yB - 6, PT], pos: [R * Math.cos(t), (yT + yB) / 2, R * Math.sin(t)], rot: [0, -(t + Math.PI / 2), 0] };
    });
    return compound(id, "Side panel", pieces, "soft");
  };
  const mids = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]; // back, front right, front left
  parts.push(panel("A", mids[0]), panel("C", mids[1]), panel("D", mids[2]));
  const UP: Vec3 = [0, 1, 0];
  // the barrel nut and the locking screw go in from the post's inner face, towards the middle
  const inward = (c: Vec3): Vec3 => [-Math.sign(c[0]), 0, 0];
  const each = (kind: CustomFix["kind"], y: number, dx: number, o: Partial<CustomFix>) =>
    corners.map((c, i) => fx(kind, [[c[0] - Math.sign(c[0]) * dx, y, c[2]]], inward(c), posts[i], o));
  const castorAt = (i: number): Vec3 => [corners[i][0], CAST, corners[i][2]];
  const castor = (is: number[]) => [fx("castor", is.map(castorAt), UP, "B", { len: CAST, dia: 50 })];
  const steps: CustomStep[] = [
    {
      title: "Screw the connector bolts into the top",
      detail: "Lay the top face down on a rug. Turn the four bolts in by hand until they stop, not with a tool.",
      add: ["T"],
      fix: [fx("bolt", corners.map((c): Vec3 => [c[0], yT - 60, c[2]]), UP, "T", { name: "Connector bolt", len: 75, dia: 8 })],
      pose: "-y",
      warnings: ["floor", "hand"],
    },
    {
      title: "Push a barrel nut into each post",
      detail: "Into the round hole near the end with the plain hole, the slot turned to line up with it.",
      fix: each("nut", yT - 25, POST / 2 + 8, { name: "Barrel nut", len: 14, dia: 10 }),
      wait: posts,
    },
    { title: "Stand the posts on the bolts", detail: "Each post slides down over its bolt, the row of holes facing in.", add: posts, from: Object.fromEntries(posts.map((p) => [p, [0, -260, 0] as Vec3])) },
    {
      title: "Tighten the locking screws",
      detail: "One in each post, through the small hole near the top, so it grips the bolt.",
      fix: each("screw", yT - 45, POST / 2 + 6, { name: "Locking screw", len: 10, dia: 6 }),
      tools: ["screwdriver"],
    },
    { title: "Lower the shelf over the posts", detail: "Either way up: tray side up for snacks, or flat side up for a controller.", add: ["S"], from: { S: [0, -320, 0] } },
    {
      title: "Screw in the shelf pins",
      detail: "One in each post, in the holes just under the shelf, at the same height on all four.",
      fix: each("pin", yS - 15, POST / 2 + 10, { len: 20, dia: 6 }),
    },
    { title: "Lay the bottom board on the posts", detail: "The holes in its corners over the ends of the posts.", add: ["B"], from: { B: [0, -220, 0] } },
    {
      title: "Screw in one castor, loosely",
      detail: "Through the bottom board into a post, by hand only, so the board can still lift a little.",
      fix: castor([0]),
      warnings: ["hand"],
    },
    { title: "Slide in the first side panel", detail: "Its top and bottom edges go into the grooves in the top and the bottom board.", add: ["A"], from: { A: [0, 0, 300] } },
    { title: "Slide it round the track", detail: "Push it round to make room for the next one." },
    { title: "Slide in the second panel", detail: "Into the grooves the same way.", add: ["C"], from: { C: [300, 0, 0] } },
    { title: "Slide that one round too", detail: "Push it along behind the first." },
    { title: "Slide in the last panel", detail: "From the other side, into the same grooves.", add: ["D"], from: { D: [-300, 0, 0] } },
    { title: "Tighten the first castor", detail: "Now the panels are in, tighten it with the spanner.", tools: ["wrench"] },
    { title: "Screw in the next castor", detail: "By hand first, then tight with the spanner.", fix: castor([2]), tools: ["wrench"] },
    { title: "Screw in the last two castors", detail: "The same way, one in each remaining corner.", fix: castor([1, 3]), tools: ["wrench"] },
    { title: "Turn the table over", detail: "Stand it on its castors. The panels slide round to open it.", pose: "+y" },
  ];
  return { parts, steps };
}

function stool(): CustomParams {
  const R = 187; // the base, 37.5 across
  const H = 442;
  const parts: CustomPart[] = [
    compound("BASE", "Base", [
      { shape: "cyl", size: [2 * R, 20, 2 * R], pos: [0, 10, 0] },
      { shape: "cyl", size: [2 * R - 70, 25, 2 * R - 70], pos: [0, 32, 0] },
      { shape: "cyl", size: [2 * R - 160, 25, 2 * R - 160], pos: [0, 57, 0] },
      { shape: "cyl", size: [140, 20, 140], pos: [0, 79, 0] },
    ], "metal"),
    compound("COL", "Column", [
      // it flares out towards the base
      { shape: "cyl", size: [165, 50, 165], pos: [0, 89 + 25, 0] },
      { shape: "cyl", size: [128, 180, 128], pos: [0, 139 + 90, 0] },
      { shape: "cyl", size: [105, 70, 105], pos: [0, 319 + 35, 0] },
    ], "metal"),
    compound("SEAT", "Seat", [
      { shape: "cyl", size: [300, 40, 300], pos: [0, H - 68, 0] },
      { shape: "cyl", size: [270, 28, 270], pos: [0, H - 14, 0] },
    ], "soft"),
  ];
  return {
    parts,
    steps: [
      { title: "Click the column into the base", detail: "Push it straight down into the hole in the middle of the base until it clicks.", add: ["BASE", "COL"], from: { COL: [0, 260, 0] } },
      { title: "Click the seat onto the column", detail: "Press it straight down over the top of the column until it clicks. Pull on it to check.", add: ["SEAT"], from: { SEAT: [0, 260, 0] } },
    ],
  };
}

const family: Family = {
  names: ["YXSTABY"],
  recipe(s) {
    if (/monitor stand/i.test(s.variant)) return recipe(s);
    if (/side table/i.test(s.variant)) return sideTable();
    if (/thumbstick stool/i.test(s.variant)) return stool();
    return null;
  },
};
export default family;
