import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * OMMJÄNGE, read from the dining chair's manual. Solid wood, joined with dowels and Allen bolts. On a rug, the sled
 * runners and their stretcher, and the seat's side rails and front rail, are dowelled and bolted into two frames.
 * The front legs stand on the runner frame on dowels and the seat frame goes on top. Upside down on a table, the
 * back legs are bolted on with long bolts and barrel nuts. Then, standing, dowels go in for the three seat slats and
 * the two back boards, each held with short bolts from below or behind.
 */

const t = 28; // rails and legs

function chair(s: ProductSpec): CustomParams {
  // IKEA: 40 wide, 53 deep, 83 high, seat 45 high and 40 deep
  const W = s.size.w * 10 || 400, D = s.size.d * 10 || 530, H = s.size.h * 10 || 830;
  const seat = 450, slatT = 20, railH = 60, runH = 60;
  const xo = W / 2 - t / 2, xi = xo - t; // back legs outside, runners, front legs and seat rails inside them
  const inner = 2 * (xi - t / 2);
  const zBack = -D / 2 + 50, zFront = D / 2 - 85;
  const yRail = seat - slatT - railH / 2;
  const slatZ = [-125, 5, 135], slatD = 120;
  const boardY = [H - 65, H - 215];
  const parts: CustomPart[] = [
    { id: "RL", name: "Runner", size: [t, runH, D], pos: [-xi, runH / 2, 0], material: "wood" },
    { id: "RR", name: "Runner", size: [t, runH, D], pos: [xi, runH / 2, 0], material: "wood" },
    { id: "ST", name: "Stretcher", size: [inner, 50, t], pos: [0, 35, -10], material: "wood" },
    { id: "SL", name: "Seat rail", size: [t, railH, zFront - zBack + 70], pos: [-xi, yRail, (zFront + zBack) / 2 + 10], material: "wood" },
    { id: "SR", name: "Seat rail", size: [t, railH, zFront - zBack + 70], pos: [xi, yRail, (zFront + zBack) / 2 + 10], material: "wood" },
    { id: "FR", name: "Front rail", size: [inner, railH, t], pos: [0, yRail, zFront + 10], material: "wood" },
    { id: "FL", name: "Front leg", size: [t, yRail - railH / 2 - runH, 45], pos: [-xi, (runH + yRail - railH / 2) / 2, zFront], material: "wood" },
    { id: "FRL", name: "Front leg", size: [t, yRail - railH / 2 - runH, 45], pos: [xi, (runH + yRail - railH / 2) / 2, zFront], material: "wood" },
    { id: "BL", name: "Back leg", size: [t, H, 50], pos: [-xo, H / 2, zBack], material: "wood" },
    { id: "BR", name: "Back leg", size: [t, H, 50], pos: [xo, H / 2, zBack], material: "wood" },
    ...slatZ.map((z, i): CustomPart => ({ id: `SS${i + 1}`, name: "Seat slat", size: [W, slatT, slatD], pos: [0, seat - slatT / 2, z], material: "wood" })),
    ...boardY.map((y, i): CustomPart => ({ id: `BB${i + 1}`, name: "Back board", size: [W - 10, 130, 20], pos: [0, y, zBack + 35], material: "wood" })),
  ];
  const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
  const SX = [-1, 1] as const;
  const L = (sx: number, a: string, b: string) => (sx < 0 ? a : b);
  const ends = (y: number, z: number, cross: string, l: string, r: string) =>
    SX.map((sx) => at("dowel", [[sx * (xi - t / 2), y, z - 12], [sx * (xi - t / 2), y, z + 12]], [sx, 0, 0], cross, L(sx, l, r), { len: 30, dia: 8 }));
  const frameBolts = (y: number, z: number, cross: string, l: string, r: string) => [
    at("bolt", [[-(xi + t / 2), y, z]], [1, 0, 0], l, cross, { len: 60, dia: 6 }),
    at("bolt", [[xi + t / 2, y, z - 12], [xi + t / 2, y, z + 12]], [-1, 0, 0], r, cross, { len: 60, dia: 6 }),
  ];
  const legDowels = SX.flatMap((sx) => [
    at("dowel", [[sx * xi, runH, zFront - 10], [sx * xi, runH, zFront + 10]], [0, -1, 0], L(sx, "FL", "FRL"), L(sx, "RL", "RR"), { len: 40, dia: 8 }),
    at("dowel", [[sx * xi, yRail - railH / 2, zFront - 10], [sx * xi, yRail - railH / 2, zFront + 10]], [0, 1, 0], L(sx, "FL", "FRL"), L(sx, "SL", "SR"), { len: 40, dia: 8 }),
  ]);
  const backBolts = SX.flatMap((sx) =>
    [runH / 2, yRail].map((y) => at("bolt", [[sx * (xo + t / 2), y, zBack]], [-sx, 0, 0], L(sx, "BL", "BR"), y < 100 ? L(sx, "RL", "RR") : L(sx, "SL", "SR"), { len: 90, dia: 6 })),
  );
  const barrelNuts = SX.flatMap((sx) =>
    [runH / 2, yRail].map((y) => at("nut", [[sx * xi, y - (y < 100 ? runH : railH) / 2, zBack]], [0, 1, 0], y < 100 ? L(sx, "RL", "RR") : L(sx, "SL", "SR"), undefined, { name: "Barrel nut", len: 30, dia: 10 })),
  );
  const backDowels = SX.map((sx) => at("dowel", boardY.flatMap((y): Vec3[] => [[sx * xo, y + 30, zBack + 25], [sx * xo, y - 30, zBack + 25]]), [0, 0, -1], L(sx, "BL", "BR"), undefined, { len: 40, dia: 8 }));
  const slatDowels = SX.map((sx) => at("dowel", slatZ.flatMap((z): Vec3[] => [[sx * xi, seat - slatT, z - 30], [sx * xi, seat - slatT, z + 30]]), [0, -1, 0], L(sx, "SL", "SR"), undefined, { len: 40, dia: 8 }));
  return {
    parts,
    steps: [
      {
        title: "Tap the short dowels into the two frames",
        detail: "Lay the runner and the stretcher on a rug, with the front rail beside them. Use the short dowels here: two at each end of the stretcher and the front rail.",
        add: ["RL", "ST"],
        fix: [...ends(35, -10, "ST", "RL", "RR"), ...ends(yRail, zFront + 10, "FR", "SL", "SR")],
        wait: ["FR"],
        from: { FR: [0, 0, 450] },
        tools: ["hammer"],
        warnings: ["floor"],
      },
      {
        title: "Bolt the runner frame together",
        detail: "Push the second runner onto the stretcher's dowels and tighten the bolts with the Allen key.",
        add: ["RR"],
        fix: frameBolts(35, -10, "ST", "RL", "RR"),
      },
      {
        title: "Bolt the seat frame together",
        detail: "The same way: the front rail between the two seat rails. Keep it to one side for now.",
        fix: frameBolts(yRail, zFront + 10, "FR", "SL", "SR"),
        wait: ["SL", "SR"],
        from: { SL: [0, 0, 450], SR: [0, 0, 450] },
      },
      {
        title: "Stand the front legs on the runner frame",
        detail: "Tap the long dowels into both ends of each leg and push them into the runners, curved side to the front.",
        add: ["FL", "FRL"],
        fix: legDowels,
        tools: ["hammer"],
      },
      {
        title: "Put the seat frame on top",
        detail: "Push it down onto the dowels at the top of the front legs.",
        add: ["SL", "SR", "FR"],
        from: { SL: [0, 250, 0], SR: [0, 250, 0], FR: [0, 250, 0] },
      },
      {
        title: "Bolt on the back legs",
        detail: "Turn the chair upside down on a table. Drop a barrel nut into each hole, slot facing the bolt, and turn the long bolts in through the back legs.",
        add: ["BL", "BR"],
        fix: [...barrelNuts, ...backBolts],
        tools: ["flathead"],
        pose: "-y",
      },
      {
        title: "Tap in the dowels for the seat and back",
        detail: "Stand the chair up. Twenty long dowels: four in the front of each back leg and six along the top of each seat rail.",
        fix: [...backDowels, ...slatDowels],
        tools: ["hammer"],
        pose: "+y",
      },
      {
        title: "Bolt on the seat slats",
        detail: "Their holes sit nearer one edge: check all three face the same way, then one bolt at each end.",
        add: ["SS1", "SS2", "SS3"],
        fix: [at("bolt", slatZ.flatMap((z): Vec3[] => SX.map((sx): Vec3 => [sx * xi, seat, z])), [0, -1, 0], "SS1", undefined, { len: 50, dia: 6, to: ["SS1", "SS2", "SS3", "SL", "SR"] })],
      },
      {
        title: "Bolt the two back boards on from behind",
        detail: "Press each board onto the dowels in the back legs and turn a bolt in from the back at each end.",
        add: ["BB1", "BB2"],
        fix: [at("bolt", boardY.flatMap((y): Vec3[] => SX.map((sx): Vec3 => [sx * xo, y, zBack - 25])), [0, 0, 1], "BL", undefined, { len: 50, dia: 6, to: ["BL", "BR", "BB1", "BB2"] })],
      },
    ],
  };
}

const family: Family = {
  names: ["OMMJÄNGE", "OMMJANGE"],
  recipe: (s) => (/^ommjange-chair/.test(s.slug ?? "") ? chair(s) : null),
};
export default family;
