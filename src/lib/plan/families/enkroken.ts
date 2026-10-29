import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ENKROKEN desk, read from its manual. Two welded side frames (two legs, a rail under the top and a rail near the
 * floor) are joined by two long back rails, built lying on its back: two bolts at each rail end, left loose. It is
 * turned over onto the top, which goes on with seven long bolts through the top rails, then the joints are
 * tightened. Two drawer runners screw under the top (either side; we put them right, like the photo), the desk is
 * stood up, the drawer slides in from the front, and two screws stop it pulling out.
 * IKEA: 85 x 56 x 75 cm, drawer inside 25 x 40 x 4 cm.
 */

const TUBE = 25, RAIL = 22, TOP = 18;
// the back rails are flat oval tubes, deeper than tall, with two bolt holes side by side at each end
const OVAL = 20, OVAL_D = 34;

/** A round tube from a to b, as a piece of a part centred at c. */
function tube(a: Vec3, b: Vec3, c: Vec3, dia = RAIL): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...d);
  return {
    shape: "cyl",
    size: [dia, L, dia],
    pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]],
    rot: [Math.atan2(d[2], d[1]), 0, -Math.asin(d[0] / L)],
  };
}

function desk(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 850, D = Math.round(s.size.d * 10) || 560, H = Math.round(s.size.h * 10) || 750;
  const lx = W / 2 - 30, lz = D / 2 - 30; // leg centres
  const yLeg = H - TOP; // legs stop under the top
  const yHi = yLeg - RAIL / 2, yLo = 170; // rail centres
  const parts: CustomPart[] = [];
  for (const [id, sx] of [["L", -1], ["R", 1]] as const) {
    const c: Vec3 = [sx * lx, yLeg / 2, 0];
    parts.push({
      id,
      name: "Side frame",
      size: [TUBE, yLeg, D - 30],
      pos: c,
      material: "metal",
      pieces: [
        tube([sx * lx, 0, -lz], [sx * lx, yLeg, -lz], c, TUBE),
        tube([sx * lx, 0, lz], [sx * lx, yLeg, lz], c, TUBE),
        tube([sx * lx, yHi, -lz - 15], [sx * lx, yHi, lz + 15], c),
        tube([sx * lx, yLo, -lz], [sx * lx, yLo, lz], c),
      ],
    });
  }
  const railL = 2 * lx - TUBE;
  const yB = yLeg - OVAL / 2; // the upper back rail sits right under the top
  const rail = (id: string, y: number): CustomPart => ({ id, name: "Back rail", shape: "cyl", size: [OVAL, railL, OVAL_D], pos: [0, y, -lz], rot: [0, 0, Math.PI / 2], material: "metal" });
  parts.push(rail("BH", yB), rail("BL", yLo));
  parts.push({ id: "T", name: "Desk top", size: [W, TOP, D], pos: [0, H - TOP / 2, 0], material: "board" });

  // drawer at the front right, hanging on two runners
  const dw = 290, dd = 430, dh = 50, dx = W / 2 - 245, dz = D / 2 - 10 - dd / 2;
  const runY = yLeg - 18;
  const runX = [dx - dw / 2 - 8, dx + dw / 2 + 8];
  runX.forEach((x, i) => parts.push({ id: `G${i}`, name: "Drawer runner", size: [12, 36, dd + 10], pos: [x, runY, dz], material: "metal" }));
  parts.push({
    id: "DR",
    name: "Drawer",
    size: [dw, dh, dd],
    pos: [dx, yLeg - 8 - dh / 2, dz],
    material: "board",
    pieces: [
      { shape: "box", size: [dw - 20, 6, dd - 10], pos: [0, -dh / 2 + 3, 0] },
      { shape: "box", size: [dw, dh, 12], pos: [0, 0, dd / 2 - 6] },
      { shape: "box", size: [dw - 20, dh - 10, 6], pos: [0, -5, -dd / 2 + 3] },
      { shape: "box", size: [10, dh, dd], pos: [-dw / 2 + 5, 0, 0] },
      { shape: "box", size: [10, dh, dd], pos: [dw / 2 - 5, 0, 0] },
    ],
  });

  // two bolts through each back leg into the end of a back rail
  const ends = (sx: number): CustomFix[] =>
    (["BH", "BL"] as const).map((r) => {
      const y = r === "BH" ? yB : yLo;
      return { kind: "bolt", name: "Short bolt", count: 2, len: 25, dia: 6, at: [[sx * (lx + TUBE / 2), y, -lz - 12], [sx * (lx + TUBE / 2), y, -lz + 12]], dir: [-sx, 0, 0], on: sx < 0 ? "L" : "R", mate: r };
    });
  const longAt: Vec3[] = [
    [-lx, yHi - RAIL / 2, -lz / 2], [-lx, yHi - RAIL / 2, lz / 2],
    [lx, yHi - RAIL / 2, -lz / 2], [lx, yHi - RAIL / 2, lz / 2],
    [-lx / 2, yB - OVAL / 2, -lz], [0, yB - OVAL / 2, -lz], [lx / 2, yB - OVAL / 2, -lz],
  ];
  const runnerAt = (x: number): Vec3[] => [-1, 0, 1].map((k): Vec3 => [x, yLeg, dz + k * (dd / 2 - 40)]);

  return {
    parts,
    steps: [
      {
        title: "Bolt the back rails to a side frame",
        detail: "Lay the side frame on its back leg on a rug and put both rails on the floor against it. Two short bolts in each end, turned in but not tight yet.",
        add: ["L", "BH", "BL"],
        fix: ends(-1),
        tools: ["allen"],
        pose: "+z",
        warnings: ["floor"],
      },
      {
        title: "Bolt on the other side frame",
        detail: "Two short bolts into each rail end again, still loose. Then turn the frame over so it stands upside down.",
        add: ["R"],
        fix: ends(1),
        tools: ["allen"],
      },
      {
        title: "Bolt the frame onto the desk top",
        detail: "Lay the top face down on the rug and set the frame on it. The seven long bolts go down through the top rails into the top.",
        add: ["T"],
        fix: [{ kind: "bolt", name: "Long bolt", count: 7, len: 30, dia: 6, at: longAt, dir: [0, 1, 0], to: ["L", "R", "BH", "T"] }],
        tools: ["allen"],
        pose: "-y",
      },
      {
        title: "Tighten the rail bolts",
        detail: "Now turn all eight short bolts tight, so the frame sits square on the top.",
        tools: ["allen"],
        check: "square",
      },
      {
        title: "Screw the drawer runners under the top",
        detail: "Three screws in each. Their open sides face each other; they can go on either side of the desk.",
        add: ["G0", "G1"],
        fix: runX.map((x, i): CustomFix => ({ kind: "screw", count: 3, len: 13, dia: 4, at: runnerAt(x), dir: [0, 1, 0], on: `G${i}`, mate: "T" })),
        tools: ["screwdriver"],
      },
      {
        title: "Stand the desk up and slide in the drawer",
        detail: "Turn it over onto its feet, then push the drawer in from the front along the runners.",
        add: ["DR"],
        pose: "+y",
        from: { DR: [0, 0, 400] },
      },
      {
        title: "Screw in the drawer stops",
        detail: "One screw up into the back of each runner, so the drawer can't come out by mistake.",
        fix: runX.map((x, i): CustomFix => ({ kind: "screw", name: "Stop screw", count: 1, len: 10, dia: 4, at: [[x, runY - 18, dz - dd / 2 + 30]], dir: [0, 1, 0], on: `G${i}` })),
        tools: ["screwdriver"],
      },
    ],
  };
}

const family: Family = {
  names: ["ENKROKEN"],
  recipe(s) {
    if (/^enkroken-desk/.test(s.slug ?? "")) return desk(s);
    return null;
  },
};
export default family;
