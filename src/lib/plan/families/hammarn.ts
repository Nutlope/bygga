import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * HAMMARN sofa bed, read from its manual. A steel tube frame with stretched fabric, built as a bed and folded into a
 * sofa at the end. Each side is two loops clicked together and bolted with a nut (the back loop turns up into the
 * armrest when it folds), two people bolt the cross tubes between the sides, the lower sling drops onto its stubs
 * with two long bolts and its tubes go through its hems, then the bed fabric goes on and its edge tubes are pushed
 * into its hems and bolted all round. Folded up, the mattress pad goes on. Fittings: 2 short bolts with nuts, 2 long
 * bolts with washers and nuts, 8 short countersunk bolts and 14 longer ones, Allen key and spanner in the box.
 * We draw it as the sofa. IKEA's sizes: 128 wide, 85 deep, 78 high, seat 38 high; the bed is 120 x 190.
 */

const D = 25; // tube

/** A round tube from a to b, as a piece of a part centred at c. */
function tube(a: Vec3, b: Vec3, c: Vec3, d = D): PartPiece {
  const v: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...v);
  const n = v.map((x) => x / L);
  return { shape: "cyl", size: [d, L, d], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot: [Math.atan2(n[2], n[1]), 0, -Math.asin(n[0])] };
}
/** A loop of tube in the y-z plane at x: a rounded rectangle drawn as four tubes. */
function loop(id: string, name: string, x: number, y0: number, y1: number, z0: number, z1: number): CustomPart {
  const c: Vec3 = [x, (y0 + y1) / 2, (z0 + z1) / 2];
  return {
    id,
    name,
    size: [D, y1 - y0 + D, z1 - z0 + D],
    pos: c,
    material: "metal",
    pieces: [
      tube([x, y0, z0], [x, y0, z1], c),
      tube([x, y1, z0], [x, y1, z1], c),
      tube([x, y0, z0], [x, y1, z0], c),
      tube([x, y0, z1], [x, y1, z1], c),
    ],
  };
}
/** A straight tube as its own part. */
function rod(id: string, name: string, a: Vec3, b: Vec3): CustomPart {
  const c: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const size: Vec3 = [Math.abs(b[0] - a[0]) + D, Math.abs(b[1] - a[1]) + D, Math.abs(b[2] - a[2]) + D];
  return { id, name, size, pos: c, material: "metal", pieces: [tube(a, b, c)] };
}
const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

function sofa(): CustomParams {
  const W = 1280, H = 780;
  const xs = W / 2 - D / 2; // side loops
  const xb = xs - D; // bed edge tubes, just inside them
  const yF = 307; // top of the floor loops
  const yS = 320; // bed fabric (seat)
  const zf = 400, zb = -385; // floor loop front and back
  const za = 340; // arm loop front, its back at -za
  const yA = 600; // armrest top
  // the back half of the bed, leaning back a little from the hinge
  const hinge: Vec3 = [0, yS + 10, -360], top: Vec3 = [0, H - 20, -405];
  const lean = Math.atan2(top[2] - hinge[2], top[1] - hinge[1]);
  const backLen = Math.hypot(top[1] - hinge[1], top[2] - hinge[2]);
  const bMid: Vec3 = [0, (hinge[1] + top[1]) / 2, (hinge[2] + top[2]) / 2];
  const along = (t: number, x: number, out = 0): Vec3 => [x, hinge[1] + (top[1] - hinge[1]) * t + Math.sin(lean) * -out, hinge[2] + (top[2] - hinge[2]) * t + Math.cos(lean) * out];

  const parts: CustomPart[] = [];
  for (const [i, sx] of [[0, -1], [1, 1]] as const) {
    parts.push(loop(`L${i}`, "Leg loop", sx * xs, D / 2, yF, zb, zf));
    parts.push(loop(`A${i}`, "Arm loop", sx * xs, yF + D, yA, -za, za));
  }
  parts.push(
    rod("C1", "Cross tube", [-xs + D / 2, 60, zb], [xs - D / 2, 60, zb]),
    rod("C2", "Cross tube", [-xs + D / 2, 60, zf], [xs - D / 2, 60, zf]),
  );
  const yL = 230; // lower sling
  parts.push({ id: "F", name: "Lower sling", size: [2 * xb, 6, 2 * za - 40], pos: [0, yL, 0], material: "soft" });
  parts.push(
    rod("C3", "Sling tube", [-xs + D / 2, yL - D / 2, za - 20], [xs - D / 2, yL - D / 2, za - 20]),
    rod("C4", "Hinge tube", [-xs + D / 2, yS - D / 2 - 4, hinge[2]], [xs - D / 2, yS - D / 2 - 4, hinge[2]]),
    { id: "C5", name: "Flat bar", size: [2 * xs - D, 8, 40], pos: [0, yL - 7, -za + 20], material: "metal" },
  );
  // the bed fabric: the seat half flat, the back half folded up
  parts.push({
    id: "B",
    name: "Bed fabric",
    size: [2 * xb - D, backLen, 6],
    pos: [0, 0, 0],
    material: "soft",
  });
  const fabric = parts[parts.length - 1];
  const fc: Vec3 = [0, (yS + H) / 2, (hinge[2] + zf) / 2];
  fabric.pos = fc;
  fabric.size = [2 * xb - D, H - yS, zf - top[2]];
  fabric.pieces = [
    { shape: "box", size: [2 * xb - D, 6, zf - hinge[2]], pos: [0, yS - fc[1], (zf + hinge[2]) / 2 - fc[2]] },
    { shape: "box", size: [2 * xb - D, backLen, 6], pos: [0, bMid[1] - fc[1], bMid[2] - fc[2]], rot: [lean, 0, 0] },
  ];
  for (const [i, sx] of [[0, -1], [1, 1]] as const) {
    parts.push(rod(`T${2 * i}`, "Seat edge tube", [sx * xb, yS, hinge[2]], [sx * xb, yS, zf - D / 2]));
    parts.push(rod(`T${2 * i + 1}`, "Back edge tube", along(0, sx * xb), along(1, sx * xb)));
  }
  parts.push(rod("T4", "End tube", [-xb, yS, zf], [xb, yS, zf]), rod("T5", "End tube", along(1, -xb), along(1, xb)));
  // the quilted mattress pad, seat and back
  const mt = 55;
  const mc: Vec3 = [0, (yS + H) / 2 + 20, (zf + top[2]) / 2];
  const bm = along(0.5, 0, mt / 2 + 8);
  parts.push({
    id: "M",
    name: "Mattress pad",
    size: [2 * xb - 10, H - yS, zf - top[2] + mt],
    pos: mc,
    material: "soft",
    pieces: [
      { shape: "box", size: [2 * xb - 10, mt, zf - hinge[2] - mt], pos: [0, yS + 6 + mt / 2 - mc[1], (zf + hinge[2] + mt) / 2 - mc[2]] },
      { shape: "box", size: [2 * xb - 10, backLen, mt], pos: [0, bm[1] - mc[1], bm[2] - mc[2]], rot: [lean, 0, 0] },
    ],
  });

  const side = (sx: number): Vec3 => [-sx, 0, 0];
  const pair = (y: number, z: number, x = xs + D / 2): Vec3[] => [[-x, y, z], [x, y, z]];
  const both = (kind: CustomFix["kind"], pts: Vec3[], o: (i: number) => Partial<CustomFix>) => pts.map((p, i) => fix(kind, [p], side(i ? 1 : -1), o(i)));
  const hingeAt = pair(yF + D / 2, -za);
  const nutsAt = pair(yF + D / 2, -za, xs - D / 2);
  return {
    parts,
    steps: [
      {
        title: "Click the loops together into two sides",
        detail: "Push each pair of loops together until the button in the joint clicks out through its hole.",
        add: ["L0", "A0", "L1", "A1"],
        warnings: ["hand"],
      },
      {
        title: "Bolt the joint in each side",
        detail: "One short bolt through each joint, a nut on the inside. Hold the nut with the spanner and tighten with the Allen key.",
        fix: [...both("bolt", hingeAt, (i) => ({ on: `A${i}`, mate: `L${i}`, len: 40, dia: 6 })), ...both("nut", nutsAt, (i) => ({ on: `L${i}` }))],
        tools: ["allen", "wrench"],
      },
      {
        title: "Bolt a cross tube between the sides",
        detail: "One holds the sides up while the other bolts. Use the short countersunk bolts, one at each end.",
        add: ["C1"],
        fix: both("bolt", pair(60, zb), (i) => ({ on: i ? "L1" : "L0", mate: "C1", len: 30, dia: 6 })),
        tools: ["allen"],
        people: 2,
      },
      {
        title: "Bolt on the second cross tube",
        detail: "The same at the other end, two more short countersunk bolts.",
        add: ["C2"],
        fix: both("bolt", pair(60, zf), (i) => ({ on: i ? "L1" : "L0", mate: "C2", len: 30, dia: 6 })),
        tools: ["allen"],
        people: 2,
      },
      {
        title: "Lay in the lower sling",
        detail: "Its hems hang inside the frame. Drop the open tube ends over the stubs on the sides.",
        add: ["F"],
      },
      {
        title: "Bolt the sling's back hem to the sides",
        detail: "Two long bolts, a washer under each head and one under each nut. Hold the nut with the spanner.",
        fix: [
          ...both("washer", pair(yL, -za + 40), (i) => ({ on: i ? "L1" : "L0", dia: 16 })),
          ...both("bolt", pair(yL, -za + 40), (i) => ({ on: i ? "L1" : "L0", mate: "F", len: 70, dia: 6 })),
          ...both("washer", pair(yL, -za + 40, xs - D / 2), (i) => ({ on: i ? "L1" : "L0", dia: 16 })),
          ...both("nut", pair(yL, -za + 40, xs - D / 2), (i) => ({ on: i ? "L1" : "L0" })),
        ],
        tools: ["allen", "wrench"],
      },
      {
        title: "Push a tube through the front hem",
        detail: "Through the sling's front hem until both ends click into the sides.",
        add: ["C3"],
        from: { C3: [700, 0, 0] },
      },
      {
        title: "Bolt on the hinge tube",
        detail: "It goes across at seat height, at the back. One short countersunk bolt at each end.",
        add: ["C4"],
        fix: both("bolt", pair(yS - D / 2 - 4, hinge[2]), (i) => ({ on: i ? "A1" : "A0", mate: "C4", len: 30, dia: 6 })),
        tools: ["allen"],
      },
      {
        title: "Push the flat bar through the back hem",
        detail: "Holes facing down, until it sits in the sides at both ends.",
        add: ["C5"],
        from: { C5: [700, 0, 0] },
      },
      {
        title: "Lay the bed fabric on and bolt it at the hinge",
        detail: "Spread it over the frame, hems down, and pull it towards the hinge. Two of the longer countersunk bolts, one each side.",
        add: ["B"],
        fix: both("bolt", pair(yS - 3, hinge[2], xb - D / 2), (i) => ({ on: i ? "A1" : "A0", mate: "B", len: 45, dia: 6 })),
        tools: ["allen"],
      },
      {
        title: "Bolt the fabric at the front",
        detail: "Two short countersunk bolts, one each side, near the front of the seat.",
        fix: both("bolt", pair(yS - 3, za, xb - D / 2), (i) => ({ on: i ? "A1" : "A0", mate: "B", len: 30, dia: 6 })),
        tools: ["allen"],
      },
      {
        title: "Push the edge tubes into one side",
        detail: "Two tubes into the long hem on one side, one for each half of the bed, until the buttons click.",
        add: ["T0", "T1"],
        from: { T0: [0, 0, 700], T1: [0, 0, 700] },
      },
      {
        title: "Push the edge tubes into the other side",
        detail: "The same two tubes on the other long side.",
        add: ["T2", "T3"],
        from: { T2: [0, 0, 700], T3: [0, 0, 700] },
      },
      {
        title: "Push in the two end tubes",
        detail: "One into each short hem, the ends into the side tubes until they click.",
        add: ["T4", "T5"],
        from: { T4: [700, 0, 0], T5: [700, 0, 0] },
      },
      {
        title: "Bolt the tubes together all round",
        detail: "Twelve of the longer countersunk bolts, from the outside in through the holes along the edge tubes, a washer on each. Tighten them all.",
        // each bolt goes in flat, in the plane of the fabric, through the tube and into the hem inside it
        fix: [
          ...[-1, 1].map((sx) => fix("bolt", [hinge[2] + 200, zf - 60].map((z): Vec3 => [sx * (xb + D / 2), yS, z]), [-sx, 0, 0], { len: 45, dia: 6 })),
          ...[-1, 1].map((sx) => fix("bolt", [0.3, 0.9].map((t) => along(t, sx * (xb + D / 2))), [-sx, 0, 0], { len: 45, dia: 6 })),
          fix("bolt", [-1, 1].map((sx): Vec3 => [sx * (xb - 60), yS, zf + D / 2]), [0, 0, -1], { len: 45, dia: 6 }),
          fix("bolt", [-1, 1].map((sx) => along(1 + D / 2 / backLen, sx * (xb - 60))), [0, -(top[1] - hinge[1]) / backLen, -(top[2] - hinge[2]) / backLen], { len: 45, dia: 6 }),
        ],
        tools: ["allen"],
      },
      {
        title: "Tighten the bolts in the hinge blocks",
        detail: "Press the frame down flat at the hinge first, then turn the two bolts in the plastic blocks until they're tight.",
        tools: ["allen"],
        kind: "bolts",
      },
      {
        title: "Fold the bed into a sofa",
        detail: "Lift the head end up and over until the back stands and the back loops turn up into armrests.",
        warnings: ["hand"],
      },
      {
        title: "Lay on the mattress pad",
        detail: "Its fold goes into the corner between the seat and the back.",
        add: ["M"],
        from: { M: [0, 400, 200] },
      },
      {
        title: "Tuck the pad's flaps round the frame",
        detail: "Pull the flaps at the back and the ends round the tubes so the pad stays put.",
      },
    ],
  };
}

const family: Family = {
  names: ["HAMMARN"],
  recipe(s: ProductSpec) {
    if (!/sofa-bed|sofa bed/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
    return sofa();
  },
};
export default family;
