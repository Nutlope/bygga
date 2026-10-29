import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * GÄVLE easy chair, read from its manual. Two steel frames: the back frame (back legs rising into the back posts
 * and the handle across the top) and the leg frame (front legs with a rail along each side under the seat). The
 * back frame lies upside down on a table and the leg frame is bolted to it, one short bolt a side, left loose. Turned
 * over, the oval back is bolted to the posts (four bolts); upside down again, the seat goes on with four bolts
 * through the side rails. Stood up, the seat bolts and then the two frame bolts are tightened.
 * IKEA: 54 wide, 68 deep, 70 high, seat 41 high and 54 x 42.
 */

const TUBE = 20;

/** A round tube from a to b, as a piece of a part centred at c. */
function tube(a: Vec3, b: Vec3, c: Vec3): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d);
  return {
    shape: "cyl",
    size: [TUBE, L, TUBE],
    pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]],
    rot: [Math.atan2(d[2], d[1]), 0, -Math.asin(d[0] / L)],
  };
}

/** A flat oval (a stadium), lying flat: a box between two half discs. */
function oval(w: number, t: number, d: number): PartPiece[] {
  return [
    { shape: "box", size: [w - d, t, d], pos: [0, 0, 0] },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "halfcyl", size: [d, t, d / 2], pos: [sx * ((w - d) / 2 + d / 4), 0, 0], rot: [0, (sx * Math.PI) / 2, 0] })),
  ];
}

function chair(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 540, H = Math.round(s.size.h * 10) || 700, D = Math.round(s.size.d * 10) || 680;
  const yRail = 325; // side rails and the bolt joint, just under the seat
  const xB = W / 2 - 15, xF = xB - TUBE; // back frame outside, leg frame just inside it
  const zJoint = -180;
  const yTop = H - 10, zTop = -D / 2 + 20;
  const zFoot = D / 2 - 20;

  // back frame: foot, up to the joint, then on up and back to the handle
  const bc: Vec3 = [0, H / 2, -D / 4];
  const backPieces: PartPiece[] = [
    ...[-1, 1].flatMap((sx) => [
      tube([sx * (xB - 10), 0, -D / 2 + 90], [sx * xB, yRail, zJoint], bc),
      tube([sx * xB, yRail, zJoint], [sx * (xB - 20), yTop, zTop], bc),
    ]),
    tube([-(xB - 20), yTop, zTop], [xB - 20, yTop, zTop], bc),
  ];
  // leg frame: two front legs leaning forward a little, a rail along each side back to the joint
  const fc: Vec3 = [0, yRail / 2, (zJoint + zFoot) / 2];
  const legPieces: PartPiece[] = [-1, 1].flatMap((sx) => [
    tube([sx * xF, 0, zFoot], [sx * xF, yRail, zFoot - 80], fc),
    tube([sx * xF, yRail, zFoot - 80], [sx * xF, yRail, zJoint], fc),
  ]);

  // the back lies back about 17 degrees, like the posts
  const lean = Math.atan2(zJoint - zTop, yTop - yRail);
  const yBack = 560, zPost = zJoint - ((yBack - yRail) / (yTop - yRail)) * (zJoint - zTop);
  const parts: CustomPart[] = [
    { id: "BF", name: "Back frame", size: [W, H, D / 2], pos: bc, pieces: backPieces, material: "metal" },
    { id: "LF", name: "Leg frame", size: [2 * xF + TUBE, yRail, zFoot - zJoint], pos: fc, pieces: legPieces, material: "metal" },
    { id: "BK", name: "Back", size: [W - 20, 45, 290], pieces: oval(W - 20, 45, 290), pos: [0, yBack, zPost + TUBE / 2 + 25], rot: [Math.PI / 2 - lean, 0, 0], material: "soft" },
    { id: "ST", name: "Seat", size: [W, 75, 420], pieces: oval(W, 75, 420), pos: [0, yRail + TUBE / 2 + 37, 40], material: "soft" },
  ];

  // where a post meets the back, a little above and below its middle
  const post = (sx: number, y: number): Vec3 => {
    const f = (y - yRail) / (yTop - yRail);
    return [sx * (xB - 20 * f), y, zJoint - f * (zJoint - zTop) - TUBE / 2];
  };
  return {
    parts,
    steps: [
      {
        title: "Lay the back frame upside down on a table",
        detail: "Handle down, legs up, with a cloth under it. Check it is the right way round before you go on.",
        add: ["BF"],
        pose: "-y",
      },
      {
        title: "Bolt the leg frame to it",
        detail: "The side rails go inside the back frame. One short bolt each side, only loosely for now.",
        add: ["LF"],
        fix: [-1, 1].map((sx) => ({ kind: "bolt" as const, count: 1, len: 12, dia: 6, on: "BF", mate: "LF", at: [[sx * (xB + TUBE / 2), yRail, zJoint] as Vec3], dir: [-sx, 0, 0] as Vec3 })),
        tools: ["allen"],
        pose: "-y",
      },
      {
        title: "Turn it over and bolt on the back",
        detail: "Curved side to the front. Four long bolts from behind through the posts.",
        add: ["BK"],
        fix: [{ kind: "bolt", count: 4, len: 35, dia: 6, on: "BF", mate: "BK", at: [-1, 1].flatMap((sx) => [500, 620].map((y) => post(sx, y))), dir: [0, 0, 1] }],
        tools: ["allen"],
        pose: "+y",
      },
      {
        title: "Bolt the seat on upside down",
        detail: "Lay the seat face down on a cloth on the table and set the chair on it. Four long bolts up through the side rails, loosely.",
        add: ["ST"],
        fix: [{ kind: "bolt", count: 4, len: 35, dia: 6, on: "LF", mate: "ST", at: [-1, 1].flatMap((sx) => [-90, 160].map((z): Vec3 => [sx * xF, yRail - TUBE / 2, z])), dir: [0, 1, 0] }],
        tools: ["allen"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Stand it up and tighten the seat bolts",
        detail: "With the chair on its legs, the seat settles square. Then tighten all four bolts under it.",
        tools: ["allen"],
        pose: "+y",
      },
      {
        title: "Tighten the frame bolts",
        detail: "Last, the two short bolts that join the frames, one each side.",
        tools: ["allen"],
      },
    ],
  };
}

const family: Family = {
  names: ["GÄVLE", "GAVLE"],
  recipe(s) {
    if (/easy-chair/.test(s.slug ?? "")) return chair(s);
    return null;
  },
};
export default family;
