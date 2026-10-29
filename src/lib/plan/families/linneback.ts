import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * LINNEBÄCK, read from the easy chair's manual. A light tubular steel chair, not an upholstered club chair: the back
 * frame (a loop whose uprights run down to the floor) lies on its side and the two C-shaped side frames (runner,
 * front leg and side rail) are pushed onto its stubs. Stood up, the seat sling is hung between the back crossbar and
 * the tops of the front legs, four bolts go into the side joints by hand and are tightened, the sling's front bar is
 * pulled forward and bolted into the front legs with two bigger bolts, the back cushion is pulled down over the back
 * frame, and the seat cushion is laid on and fastened under the seat with the chair upside down.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
const T = 22; // tube

/** A round tube from a to b, in product coordinates. */
function tube(a: Vec3, b: Vec3): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const u = d.map((v) => v / len);
  return { shape: "cyl", size: [T, len + T, T], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(u[2], u[1]), 0, Math.asin(-u[0])] };
}

/** A part from pieces placed in product coordinates (boxes found from the tube ends, which is all these are). */
function frame(id: string, name: string, pts: [Vec3, Vec3][]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const [a, b] of pts)
    for (const p of [a, b])
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], p[i] - T / 2);
        hi[i] = Math.max(hi[i], p[i] + T / 2);
      }
  const c = lo.map((v, i) => (v + hi[i]) / 2) as Vec3;
  const pieces = pts.map(([a, b]) => {
    const p = tube(a, b);
    return { ...p, pos: p.pos.map((v, i) => v - c[i]) as Vec3 };
  });
  return { id, name, size: lo.map((v, i) => hi[i] - v) as Vec3, pos: c, material: "metal", pieces };
}

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 55 wide, 69.5 deep, 72.4 high, seat 42.4 high, 57 wide and 50 deep
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const seatTop = 424, seatW = 570, cushT = 45;
  const x = W / 2 - T / 2;
  const y0 = T / 2, yTop = H - T / 2;
  const zb = -D / 2 + 40, zf = D / 2 - 30; // back uprights, front legs
  const ySling = seatTop - cushT - 4;
  const yRail = 250; // side rails between the front legs and the uprights
  const yBack = ySling + 10;
  const bf = frame("BF", "Back frame", [
    [[-x, y0, zb - 20], [-x, yTop, zb - 45]],
    [[x, y0, zb - 20], [x, yTop, zb - 45]],
    [[-x, yTop, zb - 45], [x, yTop, zb - 45]],
    [[-x, yBack, zb - 25], [x, yBack, zb - 25]],
  ]);
  const side = (sx: number) =>
    frame(sx < 0 ? "SL" : "SR", "Side frame", [
      [[sx * x, y0, zb], [sx * x, y0, zf]],
      [[sx * x, y0, zf], [sx * x, ySling, zf - 15]],
      [[sx * x, yRail, zf - 8], [sx * x, yRail, zb]],
    ]);
  const zs = (zf - 15 + zb) / 2, ds = zf - 15 - zb + 20;
  const parts: CustomPart[] = [
    bf,
    side(-1),
    side(1),
    {
      id: "SS",
      name: "Seat sling",
      size: [W - 2 * T, T, ds],
      pos: [0, ySling, zs],
      material: "soft",
      pieces: [
        { shape: "box", size: [W - 2 * T - 20, 3, ds - T], pos: [0, -4, 0] },
        { shape: "cyl", size: [T - 4, W - 2 * T, T - 4], pos: [0, 0, ds / 2 - T / 2], rot: [0, 0, Math.PI / 2], material: "metal" },
      ],
    },
    { id: "SC", name: "Seat cushion", size: [seatW, cushT, 500], pos: [0, seatTop - cushT / 2, zs + 15], material: "soft" },
    { id: "BC", name: "Back cushion", size: [W - 60, 260, 40], pos: [0, yTop - 30 - 130, zb - 40], rot: [-0.08, 0, 0], material: "soft" },
  ];
  // where the side frame tubes end against the back frame uprights
  const sideBolts = [-1, 1].map((sx) => fx("bolt", [[sx * (W / 2), yRail, zb - 10], [sx * (W / 2), y0, zb - 10]], [-sx, 0, 0], sx < 0 ? "SL" : "SR", { name: "Allen bolt", len: 16, dia: 6, mate: "BF" }));
  const barBolts = [-1, 1].map((sx) => fx("bolt", [[sx * (W / 2), ySling, zf - 15]], [-sx, 0, 0], sx < 0 ? "SL" : "SR", { name: "Allen bolt", len: 30, dia: 8, mate: "SS" }));
  const steps: CustomStep[] = [
    {
      title: "Push the side frames onto the back frame",
      detail: "Lay the back frame on its side on a rug. Push each side frame's two ends onto the stubs until they're all the way on.",
      add: ["BF", "SL", "SR"],
      pose: "+x",
      warnings: ["floor"],
      from: { SL: [0, 0, 300], SR: [0, 0, 300] },
    },
    {
      title: "Stand it up and hang the seat sling",
      detail: "The back sleeve goes over the crossbar, and the bar in the front sleeve rests in the tops of the front legs.",
      add: ["SS"],
      pose: "+y",
      from: { SS: [0, 300, 0] },
    },
    { title: "Turn the four small bolts in by hand", detail: "One at each joint of the side frames, so the heads sit flush.", fix: sideBolts },
    { title: "Tighten them with the small Allen key", detail: "All four, firmly.", tools: ["allen"] },
    {
      title: "Bolt the front bar into the front legs",
      detail: "Pull the front of the sling forward until the bar lines up with the holes, then turn the two big bolts in by hand.",
      fix: barBolts,
    },
    { title: "Tighten them with the big Allen key", detail: "Until the bolt heads sit snug against the legs.", tools: ["allen"] },
    {
      title: "Pull the back cushion over the back frame",
      detail: "Over the top and all the way down, with the opening at the bottom.",
      add: ["BC"],
      from: { BC: [0, 360, 0] },
    },
    { title: "Lay the seat cushion on the sling", detail: "Flap to the front, then zip it round the front bar.", add: ["SC"], from: { SC: [0, 260, 0] } },
    {
      title: "Fasten the flap under the seat",
      detail: "Turn the chair upside down on a rug and zip the flap closed under the sling. Then stand it up.",
      pose: "-y",
      warnings: ["floor"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["LINNEBÄCK", "LINNEBACK"],
  recipe(s) {
    if (!/easy chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return recipe(s);
  },
};
export default family;
