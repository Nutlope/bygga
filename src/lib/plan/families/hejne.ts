import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * HEJNE shelf unit, read from its manual. No cams or dowels: four slatted shelves stand on their edges in a row, two
 * uprights are laid across their ends and fixed with eight lag screws (Allen key in the box), then the unit is turned
 * over for the other two uprights and eight more. Stood up, a crossed steel brace goes on the back with four screws,
 * and two screws with washers go through the back uprights into the wall (wall screws and plugs not included).
 * IKEA's sizes: 78 wide, 50 deep, 171 high.
 */

const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

function recipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 780, H = Math.round(s.size.h * 10) || 1710, D = Math.round(s.size.d * 10) || 500;
  const uw = 45, ut = 28; // uprights: wide face to the front and back
  const xu = W / 2 - uw / 2, zu = D / 2 - ut / 2;
  const sd = D - 2 * ut; // shelves fit between the front and back uprights
  const st = 18, bh = 40; // slats, and the battens under their ends
  const tops = [140, 600, 1210, H]; // shelf tops, bottom to top
  const parts: CustomPart[] = [];
  tops.forEach((y, i) => {
    const c: Vec3 = [0, y - (st + bh) / 2, 0];
    const n = 5, gap = 12, sw = (sd - (n - 1) * gap) / n;
    const pieces: PartPiece[] = [
      ...Array.from({ length: n }, (_, k): PartPiece => ({ shape: "box", size: [W, st, sw], pos: [0, y - st / 2 - c[1], -sd / 2 + sw / 2 + k * (sw + gap)] })),
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [uw, bh, sd], pos: [sx * xu, y - st - bh / 2 - c[1], 0] })),
    ];
    parts.push({ id: `S${i}`, name: "Shelf", size: [W, st + bh, sd], pos: c, material: "wood", pieces });
  });
  const upright = (id: string, sx: number, sz: number): CustomPart => ({ id, name: "Upright", size: [uw, H, ut], pos: [sx * xu, H / 2, sz * zu], material: "wood" });
  parts.push(upright("B0", -1, -1), upright("B1", 1, -1), upright("F0", -1, 1), upright("F1", 1, 1));
  // the crossed brace on the back, between the middle shelves
  const y0 = tops[1] + 60, y1 = tops[2] - bh - st - 60, x0 = xu - 5; // its ends lie on the back uprights
  const zb = -zu + ut / 2 + 2;
  const len = Math.hypot(2 * x0, y1 - y0), ang = Math.atan2(2 * x0, y1 - y0);
  const yc = (y0 + y1) / 2;
  parts.push({
    id: "X",
    name: "Cross brace",
    size: [2 * x0, y1 - y0, 4],
    pos: [0, yc, zb],
    material: "metal",
    pieces: [-1, 1].map((g): PartPiece => ({ shape: "cyl", size: [4, len, 4], pos: [0, 0, 0], rot: [0, 0, g * ang] })),
  });

  const lag = { len: 50, dia: 6, name: "Lag screw" };
  const lags = (ids: [string, string], sz: number): CustomFix[] =>
    ids.map((id, k) => fix("bolt", tops.map((y): Vec3 => [(k ? 1 : -1) * xu, y - st - bh / 2, sz * (D / 2)]), [0, 0, -sz], { ...lag, on: id }));
  return {
    parts,
    steps: [
      {
        title: "Screw two uprights across the shelves",
        detail: "Stand the four shelves on their edges on a rug, the right way round, and lay the two back uprights across their ends. A lag screw into each shelf end, tightened with the Allen key.",
        add: ["S0", "S1", "S2", "S3", "B0", "B1"],
        fix: lags(["B0", "B1"], -1),
        tools: ["allen"],
        pose: "-z",
        warnings: ["floor"],
      },
      {
        title: "Turn it over and screw on the other two",
        detail: "The front uprights go on the same way, eight more lag screws.",
        add: ["F0", "F1"],
        fix: lags(["F0", "F1"], 1),
        tools: ["allen"],
        pose: "+z",
        check: "square",
      },
      {
        title: "Stand it up and fit the cross brace",
        detail: "Lift it upright together. Hook the brace across the back between the middle shelves, one screw at each of its four ends.",
        add: ["X"],
        from: { X: [0, 0, -300] },
        fix: [fix("screw", [[-x0, y0, zb], [x0, y0, zb], [-x0, y1, zb], [x0, y1, zb]], [0, 0, -1], { len: 16, dia: 4 })],
        tools: ["screwdriver"],
        pose: "+y",
        people: 2,
      },
      {
        title: "Fix it to the wall",
        detail: "Two screws with washers through the back uprights near the top. Wall screws and plugs aren't included: pick ones made for your wall.",
        fix: [
          fix("plug", [-1, 1].map((sx): Vec3 => [sx * xu, H - 60, -D / 2]), [0, 0, -1]),
          fix("washer", [-1, 1].map((sx): Vec3 => [sx * xu, H - 60, -D / 2 + ut]), [0, 0, -1], { dia: 18 }),
          fix("screw", [-1, 1].map((sx): Vec3 => [sx * xu, H - 60, -D / 2 + ut]), [0, 0, -1], { len: 50, dia: 5 }),
        ],
        tools: ["drill", "screwdriver", "pencil"],
        wall: true,
        warnings: ["wall", "tip"],
      },
    ],
  };
}

const family: Family = {
  names: ["HEJNE"],
  recipe(s) {
    if (!/shelf-unit|shelf unit/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
    return recipe(s);
  },
};
export default family;
