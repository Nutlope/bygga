import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * KUNGSFORS, read from the kitchen trolley's manual. Built upside down: the upper frame with its rails lies on a rug,
 * eight posts are pushed into it and screwed, the lower frame goes on top and is screwed to the posts, and the corner
 * plates are bolted on. The four castors (two with brakes) are screwed in with the spanner. Then it's turned over, the
 * two trays slide in onto the ledges at the height you want, and the loose top tray is set in the top.
 */

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 60 long, 40 wide, 90 high
  const W = s.size.w * 10 || 600, D = s.size.d * 10 || 400, H = s.size.h * 10 || 900;
  const p = 22; // square tube
  const yC = 110; // castors under the lower frame
  const yLow = yC + p / 2, yUp = H - 70 - p / 2; // the top tray rests on the upper frame
  const xi = W / 2 - p / 2, zi = D / 2 - p / 2;
  const up = 102; // the upper frame's pieces sit this far above its centre
  const ring = (y: number): PartPiece[] => [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [W, p, p], pos: [0, y, sz * zi] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [p, p, D - 2 * p], pos: [sx * xi, y, 0] })),
  ];
  // rails for hanging utensils: three along the back and along each side, under the upper frame
  const rails: PartPiece[] = [70, 140, 210].flatMap((dy): PartPiece[] => [
    { shape: "cyl", size: [10, W - 2 * p, 10], pos: [0, up - dy, -zi], rot: [0, 0, Math.PI / 2] },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "cyl", size: [10, D - 2 * p, 10], pos: [sx * xi, up - dy, 0], rot: [Math.PI / 2, 0, 0] })),
  ]);
  // a steel tray: a thin bottom with a low rim all round, open on top
  const tray = (h: number): { size: Vec3; pieces: PartPiece[] } => {
    const tw = W - 2 * p - 4, td = D - 2 * p - 4, t = 2;
    return {
      size: [tw, h, td],
      pieces: [
        { shape: "box", size: [tw, t, td], pos: [0, -h / 2 + t / 2, 0] },
        ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [tw, h, t], pos: [0, 0, sz * (td / 2 - t / 2)] })),
        ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [t, h, td - 2 * t], pos: [sx * (tw / 2 - t / 2), 0, 0] })),
      ],
    };
  };
  const post = (id: string, name: string, x: number, z: number, y0 = yC, y1 = H - 20): CustomPart => ({ id, name, size: [p, y1 - y0, p], pos: [x, (y0 + y1) / 2, z], material: "metal" });
  const corners = [[-1, 1], [1, 1], [-1, -1], [1, -1]] as const;
  const mids: [number, number][] = [[-W / 6, -zi], [W / 6, -zi], [-xi, 0], [xi, 0]];
  const parts: CustomPart[] = [
    { id: "U", name: "Upper frame with rails", size: [W, 230, D], pos: [0, yUp - up, 0], material: "metal", pieces: [...ring(up), ...rails] },
    ...corners.map(([sx, sz], i) => post(`L${i + 1}`, "Leg", sx * xi, sz * zi, yC, H - 20)),
    ...mids.map(([x, z], i) => post(`M${i + 1}`, "Post", x, z, yLow + p / 2, yUp - p / 2)),
    { id: "B", name: "Lower frame", size: [W, p, D], pos: [0, yLow, 0], material: "metal", pieces: [...ring(0), { shape: "box", size: [p, p, D - 2 * p], pos: [0, 0, 0] }] },
    { id: "T1", name: "Tray", ...tray(40), pos: [0, 430, 0], material: "metal" },
    { id: "T2", name: "Tray", ...tray(40), pos: [0, yLow + p / 2 + 20, 0], material: "metal" },
    { id: "T3", name: "Top tray", ...tray(70), pos: [0, H - 35, 0], material: "metal" },
  ];
  const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
  const SCREW = { len: 12, dia: 5 };
  // the six posts screwed to each frame: the four legs and the two at the back (the side posts are held by the rails)
  const sixAt = (y: number): Vec3[] => [...corners.map(([sx, sz]): Vec3 => [sx * (W / 2), y, sz * (D / 2 - p)]), ...mids.slice(0, 2).map(([x]): Vec3 => [x, y, -D / 2])];
  const sixDir = (pt: Vec3): Vec3 => (Math.abs(pt[0]) > W / 2 - 1 ? [-Math.sign(pt[0]), 0, 0] : [0, 0, 1]);
  const six = (y: number, on: string) => sixAt(y).map((pt) => fx("screw", [pt], sixDir(pt), on, SCREW));
  return {
    parts,
    steps: [
      {
        title: "Push two legs into the upper frame",
        detail: "Lay the frame upside down on a rug. The holes in the legs face out to the sides.",
        add: ["U", "L1", "L2"],
        pose: "-y",
        warnings: ["floor"],
      },
      { title: "Push in the other legs and posts", detail: "Two more legs at the corners and four short posts: two at the back, one in the middle of each side.", add: ["L3", "L4", "M1", "M2", "M3", "M4"] },
      { title: "Screw the posts to the upper frame", detail: "Six screws, through the frame into the legs and the back posts.", fix: six(yUp, "U"), tools: ["allen"] },
      { title: "Lay the lower frame on top", detail: "Its cross bar goes across the middle; every post finds its socket.", add: ["B"] },
      { title: "Screw the lower frame to the posts", detail: "Six more screws, the same way.", fix: six(yLow, "B"), tools: ["allen"] },
      {
        title: "Bolt the corner plates",
        detail: "Two bolts at each corner: one through the side of the leg, one down through the plate.",
        fix: [
          ...corners.map(([sx, sz]) => fx("bolt", [[sx * (W / 2), yLow + 40, sz * zi]], [-sx, 0, 0], "B", { len: 12, dia: 6 })),
          // the plate's bolt goes into the frame's long tube just in from the leg, clear of the leg screw
          fx("bolt", corners.map(([sx, sz]): Vec3 => [sx * (xi - 26), yLow - p / 2, sz * zi]), [0, 1, 0], "B", { len: 12, dia: 6 }),
        ],
      },
      {
        title: "Screw in the castors",
        detail: "The two with brakes go at one end. Tighten each one with the spanner.",
        fix: [fx("castor", corners.map(([sx, sz]): Vec3 => [sx * xi, yC - 2, sz * zi]), [0, 1, 0], "B", { dia: 75, len: 100 })],
        tools: ["wrench"],
      },
      { title: "Turn the trolley over", detail: "Stand it on its castors.", pose: "+y" },
      { title: "Slide the trays in", detail: "Onto the ledges, at whichever heights suit you; the bottom one rests on the lower frame.", add: ["T1", "T2"], from: { T1: [0, 0, 500], T2: [0, 0, 500] } },
      { title: "Set the top tray in the top", detail: "It sits loose, so you can lift it off and use it as a tray.", add: ["T3"] },
    ],
  };
}

const family: Family = { names: ["KUNGSFORS"], recipe };
export default family;
