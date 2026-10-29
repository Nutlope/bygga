import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * ÄLGANÄS (black powder coated steel), read from its three manuals.
 * Shoe rack: lying on a rug, two posts are bolted into the oval base; standing, three mesh shelves are bolted
 * between the posts, level or sloping, a bolt through the post and a sleeve nut from inside at each end.
 * Clothes rack: an A shaped frame lying flat gets its two lower legs, the shoe shelf and the middle bar.
 * Standing, it is fixed to the wall at the top rail and under the shoe shelf, then the key tray and strap hooks go on.
 * Hat and coat stand: the lower pole goes through the divider into the middle one, the pole is bolted into the
 * basket lying on a rug, the top pole goes on standing, then five hooks and two strap hooks.
 */

const TUBE = 22;

function shoeRack(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xp = W / 2 - 12; // posts, on the ends of the base
  const zb = D / 2 - 12;
  const base: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [25, W - 2 * zb, 25], pos: [0, 0, sz * zb], rot: [0, 0, Math.PI / 2] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "cyl", size: [25, 2 * zb - 25, 25], pos: [sx * xp, 0, 0], rot: [Math.PI / 2, 0, 0] })),
  ];
  const sl = 2 * (xp - TUBE / 2); // shelves, between the posts
  const sd = 200, tilt = 0.9;
  const shelfYs = [170, 330, 490];
  const shelf: PartPiece[] = [
    { shape: "box", size: [sl - 20, 2, sd - 20], pos: [0, 0, 0], material: "fiber" },
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [sl, 12, 12], pos: [0, 0, sz * (sd / 2 - 6)] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [12, 12, sd], pos: [sx * (sl / 2 - 6), 0, 0] })),
  ];
  const parts: CustomPart[] = [
    { id: "BA", name: "Base", size: [W, 25, D], pos: [0, 12.5, 0], material: "metal", pieces: base },
    { id: "PL", name: "Post", size: [TUBE, H - 25, TUBE], pos: [-xp, 25 + (H - 25) / 2, 0], shape: "cyl", material: "metal" },
    { id: "PR", name: "Short post", size: [TUBE, H - 55, TUBE], pos: [xp, 25 + (H - 55) / 2, 0], shape: "cyl", material: "metal" },
    ...shelfYs.map((y, i): CustomPart => ({ id: `S${i}`, name: "Shoe shelf", size: [sl, 12, sd], pos: [0, y, 0], rot: [tilt, 0, 0], material: "metal", pieces: shelf })),
  ];
  const ends = (sx: number): CustomFix[] => [
    { kind: "bolt", count: 3, len: 16, dia: 6, at: shelfYs.map((y): Vec3 => [sx * (xp + TUBE / 2), y, 0]), dir: [-sx, 0, 0], on: sx < 0 ? "PL" : "PR" },
    { kind: "nut", name: "Sleeve nut", count: 3, len: 14, dia: 10, at: shelfYs.map((y): Vec3 => [sx * (xp - TUBE / 2), y, 0]), dir: [sx, 0, 0] },
  ];
  const steps: CustomStep[] = [
    {
      title: "Bolt the posts into the base",
      detail: "Lay it all on a rug. One long bolt through each end of the base into a post, turned tight with the Allen key.",
      add: ["BA", "PL", "PR"],
      fix: [{ kind: "bolt", count: 2, len: 40, dia: 8, at: [-1, 1].map((sx): Vec3 => [sx * xp, 0, 0]), dir: [0, 1, 0], on: "BA" }],
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Bolt the shelves between the posts",
      detail: "Stand it up. A bolt through the post and a sleeve nut from inside at each end, three shelves. Slope them, small edge up, or set them level for big shoes.",
      add: ["S0", "S1", "S2"],
      fix: [...ends(-1), ...ends(1)],
      tools: ["allen"],
      pose: "+y",
    },
  ];
  return { parts, steps };
}

/** A tube between two points in the x-y plane, at z. */
function leanX(z: number, a: [number, number], b: [number, number], dia = TUBE) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return { pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z] as Vec3, size: [dia, Math.hypot(dx, dy), dia] as Vec3, rot: [0, 0, Math.atan2(-dx, dy)] as Vec3 };
}

function clothesRack(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const zw = -D / 2; // the wall
  const zA = 0; // the A frame stands across the middle of the shoe shelf
  const yj = 700, ya = H - 40; // where the lower legs join, top of the legs
  const left = (y: number) => -W / 2 + 10 + (215 * y) / ya; // x of each leg at height y
  const right = (y: number) => W / 2 - 10 - (175 * y) / ya;
  const xA = (left(ya) + right(ya)) / 2;
  const legL = leanX(zA, [left(yj), yj], [left(ya), ya]);
  const legR = leanX(zA, [right(yj), yj], [right(ya), ya]);
  const c: Vec3 = [(left(yj) + right(yj)) / 2, (yj + H) / 2, (zA + zw) / 2];
  const rel = (p: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  // the frame: both upper legs, the bend at the top and the clothes rail back to the wall, in one piece
  const frame: PartPiece[] = [
    { shape: "cyl", size: legL.size, pos: rel(legL.pos), rot: legL.rot },
    { shape: "cyl", size: legR.size, pos: rel(legR.pos), rot: legR.rot },
    { shape: "cyl", size: [TUBE, right(ya) - left(ya) + TUBE, TUBE], pos: rel([xA, ya + 10, zA]), rot: [0, 0, Math.PI / 2] },
    { shape: "cyl", size: [TUBE, zA - zw, TUBE], pos: rel([xA, H - 15, (zA + zw) / 2]), rot: [Math.PI / 2, 0, 0] },
  ];
  const lowL = leanX(zA, [left(0), 0], [left(yj), yj]);
  const lowR = leanX(zA, [right(0), 0], [right(yj), yj]);
  const yS = 300, yC = 1150;
  const sx0 = left(yS) + TUBE / 2, sx1 = right(yS) - TUBE / 2;
  const sw = sx1 - sx0, sd = D - 4;
  const shelf: PartPiece[] = [
    { shape: "box", size: [sw - 20, 2, sd - 20], pos: [0, 0, 0], material: "fiber" },
    ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [12, 14, sd], pos: [k * (sw / 2 - 6), 0, 0] })),
    ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [sw, 14, 12], pos: [0, 0, k * (sd / 2 - 6)] })),
  ];
  const cx0 = left(yC) + TUBE / 2, cx1 = right(yC) - TUBE / 2;
  const cxm = (cx0 + cx1) / 2;
  const parts: CustomPart[] = [
    { id: "FR", name: "Frame", size: [right(yj) - left(yj) + TUBE, H - yj, zA - zw + TUBE], pos: c, material: "metal", pieces: frame },
    { id: "LL", name: "Lower leg", ...lowL, shape: "cyl", material: "metal" },
    { id: "LR", name: "Lower leg", ...lowR, shape: "cyl", material: "metal" },
    { id: "SH", name: "Shoe shelf", size: [sw, 14, sd], pos: [(sx0 + sx1) / 2, yS, zw + 2 + sd / 2], material: "metal", pieces: shelf },
    { id: "CB", name: "Middle bar", size: [cx1 - cx0, 18, 18], pos: [cxm, yC, zA], shape: "cyl", material: "metal" },
    { id: "KT", name: "Key tray", size: [110, 14, 110], pos: [cxm, yC + 16, zA], shape: "cyl", material: "metal" }, // resting on the bar
  ];
  const wallTop: Vec3 = [xA, H - 15, zw];
  const wallLow: Vec3[] = [-1, 1].map((k): Vec3 => [(sx0 + sx1) / 2 + k * (sw / 2 - 60), yS - 7, zw + 2]);
  const steps: CustomStep[] = [
    {
      title: "Push the lower legs into the frame",
      detail: "Lay the frame flat on a rug. Push each lower leg on, holes lined up, and fix it with a small screw.",
      add: ["FR", "LL", "LR"],
      fix: [{ kind: "screw", count: 2, len: 10, dia: 4, at: [left(yj), right(yj)].map((x): Vec3 => [x, yj, zA + TUBE / 2]), dir: [0, 0, -1] }],
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Bolt in the shoe shelf",
      detail: "Between the legs near the bottom, one bolt through each leg, tightened with the Allen key.",
      add: ["SH"],
      fix: [
        { kind: "bolt", count: 1, len: 40, dia: 8, at: [[left(yS) - TUBE / 2, yS, zA]], dir: [1, 0, 0], on: "LL" },
        { kind: "bolt", count: 1, len: 40, dia: 8, at: [[right(yS) + TUBE / 2, yS, zA]], dir: [-1, 0, 0], on: "LR" },
      ],
      tools: ["allen"],
    },
    { title: "Bolt in the middle bar", detail: "Between the legs at the middle, one bolt through a leg.", add: ["CB"], fix: [{ kind: "bolt", count: 1, len: 40, dia: 8, at: [[right(yC) + TUBE / 2, yC, zA]], dir: [-1, 0, 0] }], tools: ["allen"] },
    { title: "Stand it against the wall", detail: "The end of the top rail and the back of the shoe shelf both touch the wall. Mark through the rail end and under the shelf.", pose: "+y", tools: ["pencil", "level"] },
    {
      title: "Screw it to the wall",
      detail: "One screw at the top, hidden in the rail, and two under the shoe shelf. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 3, at: [wallTop, ...wallLow].map((p): Vec3 => [p[0], p[1], zw - 40]), dir: [0, 0, -1] },
        { kind: "screw", count: 3, len: 50, dia: 5, at: [[wallTop[0], wallTop[1], zw + 40], ...wallLow], dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Lock the top rail",
      detail: "One countersunk screw up through the underside of the rail end, then press the cap into the end.",
      fix: [
        { kind: "screw", count: 1, len: 12, dia: 4, at: [[xA, H - 26, zw + 20]], dir: [0, 1, 0], on: "FR" },
        { kind: "cap", count: 1, len: 4, dia: 22, included: true, at: [[xA, H - 15, zw + 1]], dir: [0, 0, -1], on: "FR" },
      ],
      tools: ["screwdriver"],
    },
    { title: "Screw on the key tray", detail: "On top of the middle bar, one small screw.", add: ["KT"], fix: [{ kind: "screw", count: 1, len: 10, dia: 4, at: [[cxm, yC + 16, zA]], dir: [0, -1, 0], on: "KT" }], tools: ["screwdriver"] },
    { title: "Hang the strap hooks", detail: "Loop the two straps round the middle bar or the legs, wherever you want them.", fix: [{ kind: "hook", count: 2, at: [-40, 40].map((dx): Vec3 => [cxm + dx, yC - 10, zA]), dir: [0, 1, 0], on: "CB" }] },
  ];
  return { parts, steps };
}

function coatStand(s: ProductSpec): CustomParams {
  const H = s.size.h * 10, R = (s.size.w * 10) / 2;
  const PH = 400; // the basket
  const P = 25;
  const y1 = 620, y2 = 1180;
  const basket: PartPiece[] = [0, 1, 2, 3].map((i): PartPiece => {
    const r = R - 40 + (40 * (i + 0.5)) / 4;
    return { shape: "cyl", size: [2 * r, PH / 4, 2 * r], pos: [0, -PH / 2 + (PH / 4) * (i + 0.5), 0] };
  });
  const divider: PartPiece[] = [0, 1, 2].map((i): PartPiece => {
    const a = (i * 2 * Math.PI) / 3;
    return { shape: "box", size: [R - 20, 12, 6], pos: [((R - 20) / 2) * Math.cos(a), 0, -((R - 20) / 2) * Math.sin(a)], rot: [0, a, 0] };
  });
  const hookYs = [H - 90, H - 280, H - 440, H - 600, H - 820];
  const hookA = [Math.PI, 0, Math.PI / 2, Math.PI, 0];
  const hookLen = [170, 120, 70, 70, 140];
  const parts: CustomPart[] = [
    { id: "BK", name: "Basket", size: [2 * R, PH, 2 * R], pos: [0, PH / 2, 0], material: "metal", pieces: basket },
    { id: "P1", name: "Lower pole", size: [P, y1 - 20, P], pos: [0, 20 + (y1 - 20) / 2, 0], shape: "cyl", material: "metal" },
    { id: "DV", name: "Divider", size: [2 * R - 40, 12, 2 * R - 40], pos: [0, PH + 6, 0], material: "metal", pieces: divider },
    { id: "P2", name: "Middle pole", size: [P, y2 - y1, P], pos: [0, (y1 + y2) / 2, 0], shape: "cyl", material: "metal" },
    { id: "P3", name: "Top pole", size: [P, H - y2, P], pos: [0, (y2 + H) / 2, 0], shape: "cyl", material: "metal" },
    ...hookYs.map((y, i): CustomPart => {
      const L = hookLen[i];
      return {
        id: `H${i}`,
        name: "Hook",
        size: [L, 80, 20],
        pos: [(Math.cos(hookA[i]) * (P / 2 + L / 2)), y, -Math.sin(hookA[i]) * (P / 2 + L / 2)],
        rot: [0, hookA[i], 0],
        material: "metal",
        pieces: [
          { shape: "cyl", size: [18, L, 18], pos: [0, -30, 0], rot: [0, 0, Math.PI / 2] },
          { shape: "cyl", size: [18, 70, 18], pos: [L / 2 - 9, 5, 0] },
        ],
      };
    }),
  ];
  const steps: CustomStep[] = [
    {
      title: "Join the lower pole to the middle pole",
      detail: "Slide the divider onto the lower pole, push the middle pole on and fix the joint with two small screws.",
      add: ["P1", "DV", "P2"],
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 1, len: 10, dia: 4, at: [[sx * (P / 2), y1 - 15, 0]], dir: [-sx, 0, 0], on: "P2" })),
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the pole into the basket",
      detail: "Lay the basket on its side on a rug and push the pole in until the divider sits in its rim. The long bolt goes up through the base plate and the bottom of the basket into the pole.",
      add: ["BK"],
      fix: [
        { kind: "washer", name: "Base plate", count: 1, len: 3, dia: 120, at: [[0, 6, 0]], dir: [0, 1, 0] },
        { kind: "bolt", count: 1, len: 60, dia: 8, at: [[0, 2, 0]], dir: [0, 1, 0], on: "BK" },
      ],
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Fit the top pole",
      detail: "Stand it up, push the top pole on and fix it with one small screw.",
      add: ["P3"],
      fix: [{ kind: "screw", count: 1, len: 10, dia: 4, at: [[P / 2, y2 - 15, 0]], dir: [-1, 0, 0] }],
      tools: ["screwdriver"],
      pose: "+y",
    },
    {
      title: "Bolt on the hooks",
      detail: "Five hooks, one sleeve bolt each, turned in with the Allen key.",
      add: hookYs.map((_, i) => `H${i}`),
      // each bolt goes in through the far side of the pole, towards its hook
      fix: hookYs.map((y, i): CustomFix => ({ kind: "bolt", count: 1, len: 30, dia: 8, at: [[-Math.cos(hookA[i]) * (P / 2), y - 30, Math.sin(hookA[i]) * (P / 2)]], dir: [Math.cos(hookA[i]), 0, -Math.sin(hookA[i])], on: `H${i}` })),
      tools: ["allen"],
    },
    { title: "Hang the strap hooks", detail: "Loop the two straps round the hooks or the pole, wherever you want them.", fix: [{ kind: "hook", count: 2, at: [hookYs[0], hookYs[4]].map((y): Vec3 => [0, y - 60, P / 2]), dir: [0, 1, 0] }] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["ÄLGANÄS", "ALGANAS"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^alganas-shoe-rack/.test(slug)) return shoeRack(s);
    if (/^alganas-clothes-rack/.test(slug)) return clothesRack(s);
    if (/^alganas-hat-and-coat-stand/.test(slug)) return coatStand(s);
    return null;
  },
};
export default family;
