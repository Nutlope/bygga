import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * JOLPEN outdoor 2-seat sofa, read from IKEA's manual. Two welded steel side frames stand on the floor and the
 * slatted backrest is lowered in between them and held with two bolts and barrel nuts each side. The slatted seat
 * goes in next, with two more bolts and barrel nuts each side, then a long bolt through each corner post into the
 * seat. One bolt from behind joins the middle of the backrest to the seat, and all twelve bolts are tightened at
 * the end. No cushions come with it. IKEA's sizes: 100 x 59 cm, 67 high.
 */

const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

function sofa(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 1000, D = Math.round(s.size.d * 10) || 590, H = Math.round(s.size.h * 10) || 670;
  const t = 30; // steel tube
  const xi = W / 2 - t; // inside face of a side frame
  const zb = -D / 2, zf = D / 2;
  const SY = 330; // top of the seat
  // the backrest leans back, from the rear of the seat up to the top of the rear posts
  const b0: [number, number] = [zb + 95, SY], b1: [number, number] = [zb + 10, H];
  const bLen = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
  const tilt = -Math.atan2(b0[0] - b1[0], b1[1] - b0[1]);
  const bz = (b0[0] + b1[0]) / 2, by = (b0[1] + b1[1]) / 2;
  const onBack = (u: number): [number, number] => [b0[0] + (b1[0] - b0[0]) * u, b0[1] + (b1[1] - b0[1]) * u]; // z, y

  const side = (id: string, g: number): CustomPart => {
    const x = g * (W / 2 - t / 2);
    const pieces: PartPiece[] = [
      { shape: "box", size: [t, SY - t, t], pos: [0, (SY - t) / 2 - H / 2, zf - t / 2] }, // front leg
      { shape: "box", size: [t, t, D], pos: [0, SY - t / 2 - H / 2, 0] }, // seat rail
      { shape: "box", size: [t, H, t], pos: [0, 0, zb + t / 2] }, // rear post
      { shape: "box", size: [t, bLen, t], pos: [0, by - H / 2, bz], rot: [tilt, 0, 0] }, // leaning upright
    ];
    return { id, name: "Side frame", material: "metal", size: [t, H, D], pos: [x, H / 2, 0], pieces };
  };
  const slats = (n: number, span: number, depth: number, y: number, gap: number): PartPiece[] =>
    Array.from({ length: n }, (_, i) => ({ shape: "box", size: [2 * xi - 20, 20, (span - (n - 1) * gap) / n], pos: [0, y, -span / 2 + ((span - (n - 1) * gap) / n) / 2 + i * ((span - (n - 1) * gap) / n + gap) + depth], material: "board" }));
  const seatD = zf - (zb + t);
  const parts: CustomPart[] = [
    side("L", -1),
    side("R", 1),
    {
      id: "B",
      name: "Backrest",
      material: "metal",
      size: [2 * xi, bLen, 30],
      pos: [0, by, bz],
      rot: [tilt, 0, 0],
      pieces: [
        { shape: "box", size: [20, bLen, 25], pos: [-xi + 10, 0, -2] },
        { shape: "box", size: [20, bLen, 25], pos: [xi - 10, 0, -2] },
        { shape: "box", size: [40, bLen, 15], pos: [0, 0, -8] },
        // six slats, along the leaning face
        ...Array.from({ length: 6 }, (_, i): PartPiece => ({ shape: "box", size: [2 * xi - 20, 40, 15], pos: [0, -bLen / 2 + 30 + i * ((bLen - 60) / 5), 7], material: "board" })),
      ],
    },
    {
      id: "S",
      name: "Seat",
      material: "metal",
      size: [2 * xi, 50, seatD],
      pos: [0, SY - 25, (zb + t + zf) / 2],
      pieces: [
        { shape: "box", size: [2 * xi, 30, 25], pos: [0, -10, seatD / 2 - 12] },
        { shape: "box", size: [2 * xi, 30, 25], pos: [0, -10, -seatD / 2 + 12] },
        { shape: "box", size: [20, 30, seatD], pos: [-xi + 10, -10, 0] },
        { shape: "box", size: [20, 30, seatD], pos: [xi - 10, -10, 0] },
        ...slats(9, seatD - 20, 0, 15, 10),
      ],
    },
  ];

  const sides = [-1, 1] as const;
  const backPts = (x: number) => [0.2, 0.75].map((u): Vec3 => { const [z, y] = onBack(u); return [x, Math.round(y), Math.round(z)]; });
  const seatPts = (x: number) => [-60, 140].map((z): Vec3 => [x, SY - 15, z]);
  // into the seat frame's back and front rails
  const cornerPts = (x: number) => [zb + t + 12, zf - 12].map((z): Vec3 => [x, SY - 15, z]);
  const bolt = { len: 20, dia: 6 };
  const NUT = { name: "Barrel nut", len: 15, dia: 10 };
  return {
    parts,
    steps: [
      {
        title: "Lower the backrest between the side frames",
        detail: "Stand both side frames up on the floor, then lower the backrest in between their leaning uprights.",
        add: ["L", "R", "B"],
        people: 2,
        from: { L: [-300, 0, 0], R: [300, 0, 0], B: [0, 350, 0] },
      },
      {
        title: "Bolt the backrest to the frames",
        detail: "Two bolts with washers through each upright, into barrel nuts pushed in from the inside. Turn them in loosely for now.",
        fix: sides.flatMap((g) => [
          fix("bolt", backPts(g * (W / 2)), [-g, 0, 0], { ...bolt, on: g < 0 ? "L" : "R", mate: "B" }),
          fix("nut", backPts(g * (xi - 20)), [g, 0, 0], { ...NUT, on: "B" }),
        ]),
        tools: ["allen"],
      },
      {
        title: "Lower the seat in",
        detail: "Its slats face up and the bar with the bracket goes to the back, under the backrest.",
        add: ["S"],
        from: { S: [0, 300, 0] },
      },
      {
        title: "Bolt the seat to the side rails",
        detail: "Two bolts each side, into barrel nuts in the seat frame. Loosely for now.",
        fix: sides.flatMap((g) => [
          fix("bolt", seatPts(g * (W / 2)), [-g, 0, 0], { ...bolt, on: g < 0 ? "L" : "R", mate: "S" }),
          fix("nut", seatPts(g * (xi - 20)), [g, 0, 0], { ...NUT, on: "S" }),
        ]),
        tools: ["allen"],
      },
      {
        title: "Put a long bolt in each corner",
        detail: "Through the top of each leg into the seat frame, with a washer.",
        fix: sides.map((g) => fix("bolt", cornerPts(g * (W / 2)), [-g, 0, 0], { len: 60, dia: 6, on: g < 0 ? "L" : "R", mate: "S" })),
        tools: ["allen"],
      },
      {
        title: "Bolt the backrest to the seat",
        detail: "From behind: one bolt through the bracket in the middle of the backrest into the seat.",
        fix: [fix("bolt", [[0, SY - 10, zb + t + 2]], [0, 0, 1], { ...bolt, on: "B", mate: "S" })],
        tools: ["allen"],
      },
      {
        title: "Tighten all twelve bolts",
        detail: "Once the sofa stands level on all four legs, go round and tighten every bolt firmly.",
        tools: ["allen"],
        kind: "bolts",
      },
    ],
  };
}

const family: Family = {
  names: ["JOLPEN"],
  recipe(s) {
    if (!/sofa/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return sofa(s);
  },
};
export default family;
