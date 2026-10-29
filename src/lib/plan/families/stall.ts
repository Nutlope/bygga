import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, PartPiece, Vec3 } from "../../types";

/**
 * STÄLL, read from IKEA's manuals for the shoe cabinets with 4 compartments (29 steps) and 3 compartments (32 steps).
 *
 * 4 compartments: built lying on its front. The divider is dowelled and screwed to the bottom, cam bolts go into the
 * top and both sides, and the plastic rack guides and pivots are screwed inside the sides and the divider. The sides
 * lock onto the bottom, a rail across the back locks between them and is screwed to the divider, then the top goes on.
 * 3 compartments: one side lies on the floor and the top and three back rails stand in it; the other side goes on top,
 * then lying on its front the bottom goes under the sides.
 * Both: a leg frame (two blocks, a rail, two legs with angle brackets) is built apart and screwed under the cabinet, it
 * is stood up and screwed to the wall through a back rail, and each compartment (a folding perforated rack, two clip-on
 * end plates, the deeper one an extra rack panel, and a front screwed on) is hung on its pivots and guides.
 */

const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const S = [-1, 1];
const T = 16;
const L = 110; // legs
const GUIDE = { name: "Rack guide", len: 14, dia: 40 };
const PIVOT = { name: "Pivot", len: 12, dia: 18 };
const SMALL = { len: 10, dia: 4 }; // guide and pivot screws
const CONNECTOR = { name: "Connector screw", len: 50, dia: 7 };
const FRONT_SCREW = { len: 13, dia: 4 };
const WALL = { len: 70, dia: 5, included: true };
const AWAY = 600; // compartments are put together in front of the cabinet

interface Box {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The leg frame: a block at each end with a leg beside it, a rail between the blocks; in product coordinates. */
function legFrame(W: number, D: number, yB: number) {
  const zl = D / 2 - 30; // legs stand at the front
  const xp = W / 2 - 40; // leg centres
  const xb = xp - 40; // block centres
  const parts: CustomPart[] = [
    ...S.map((sx, i): CustomPart => ({ id: `LB${i}`, name: "Leg block", size: [40, 40, 40], pos: [sx * xb, L - 20, zl], material: "board" })),
    { id: "LR", name: "Leg rail", size: [2 * (xb - 20), 40, 18], pos: [0, L - 20, zl + 11], material: "board" },
    ...S.map((sx, i): CustomPart => ({ id: `LP${i}`, name: "Leg", size: [40, L, 40], pos: [sx * xp, L / 2, zl], material: "board" })),
  ];
  const xi = xb - 20; // inner faces of the blocks
  const steps: CustomStep[] = [
    {
      title: "Screw four cam bolts into the leg blocks",
      detail: "Two in each: one for the rail, one for the leg.",
      fix: [
        ...S.map((sx, i) => fx("camScrew", [pt(sx * xi, L - 20, zl + 11)], [sx, 0, 0], { on: `LB${i}`, mate: "LR" })),
        ...S.map((sx, i) => fx("camScrew", [pt(sx * (xb + 20), L - 20, zl)], [-sx, 0, 0], { on: `LB${i}`, mate: `LP${i}` })),
      ],
      tools: ["screwdriver"],
      wait: ["LB0", "LB1"],
    },
    {
      title: "Tap a dowel into each end of the leg rail",
      fix: S.map((sx) => fx("dowel", [pt(sx * xi, L - 12, zl + 11)], [-sx, 0, 0], { on: "LR", mate: `LB${sx < 0 ? 0 : 1}` })),
      tools: ["hammer"],
      wait: ["LR"],
    },
    {
      title: "Lock the blocks onto the rail",
      detail: "Push a block onto each end, then two cam locks in the rail.",
      fix: [fx("cam", S.map((sx) => pt(sx * (xi - 25), L, zl + 11)), [0, -1, 0], { on: "LR" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw an angle bracket onto each leg",
      detail: "At the top of the back face, one small screw each.",
      fix: [
        ...S.map((sx, i) => fx("angle", [pt(sx * xp, L - 14, zl - 20)], [0, 0, 1], { on: `LP${i}`, name: "Angle bracket", len: 24, dia: 20 })),
        ...S.map((sx, i) => fx("screw", [pt(sx * xp, L - 20, zl - 20)], [0, 0, 1], { on: `LP${i}`, len: 16, dia: 3.5 })),
      ],
      tools: ["screwdriver"],
      wait: ["LP0", "LP1"],
    },
    {
      title: "Tap a dowel into each leg",
      detail: "Into the face that meets the block.",
      fix: S.map((sx, i) => fx("dowel", [pt(sx * (xb + 20), L - 32, zl + 10)], [sx, 0, 0], { on: `LP${i}`, mate: `LB${i}` })),
      tools: ["hammer"],
    },
    {
      title: "Lock the legs onto the blocks",
      detail: "One cam lock in each leg.",
      fix: S.map((sx, i) => fx("cam", [pt(sx * xp, L - 20, zl + 20)], [0, 0, -1], { on: `LP${i}` })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the leg frame under the cabinet",
      detail: "Rail to the front. Two small screws through the angle brackets and one long screw through the middle of the rail.",
      add: ["LB0", "LB1", "LR", "LP0", "LP1"],
      from: Object.fromEntries(["LB0", "LB1", "LR", "LP0", "LP1"].map((id) => [id, [0, -260, 0] as Vec3])),
      fix: [
        fx("screw", S.map((sx) => pt(sx * xp, yB, zl - 30)), [0, 1, 0], { len: 16, dia: 3.5, mate: "BT" }),
        fx("screw", [pt(0, L - 40, zl + 11)], [0, 1, 0], { on: "LR", mate: "BT", len: 60, dia: 4.5 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the blocks to the cabinet",
      detail: "A connector screw up through each block, with the Allen key.",
      fix: [fx("bolt", S.map((sx) => pt(sx * xb, L - 40, zl)), [0, 1, 0], { mate: "BT", ...CONNECTOR })],
      tools: ["allen"],
    },
    {
      title: "Tap a foot into each leg",
      detail: "Into the hole in the bottom end.",
      fix: [fx("glide", S.map((sx) => pt(sx * xp, 0, zl)), [0, 1, 0], { name: "Plastic foot", len: 8, dia: 30 })],
      tools: ["hammer"],
    },
  ];
  return { parts, steps };
}

/** One compartment: the folding rack, its two end plates (and the deeper one's extra panel), the front. */
function compartment(k: number, b: Box, D: number, zBack: number, extra: boolean): CustomPart[] {
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
  const zF = D / 2 - T / 2;
  const z0 = zBack + 6, z1 = D / 2 - T;
  const dR = z1 - z0, zR = (z0 + z1) / 2;
  const rack: PartPiece[] = [
    { shape: "box", size: [w - 16, 3, dR - 10], pos: [0, -h / 2 + 30, 0] },
    { shape: "box", size: [w - 16, h - 90, 3], pos: [0, 8, -dR / 2 + 6], rot: [-0.18, 0, 0] },
  ];
  const parts: CustomPart[] = [
    { id: `K${k}`, name: "Shoe rack", size: [w - 16, h - 40, dR], pos: [cx, cy, zR], pieces: rack, material: "fiber" },
    ...S.map((sx, j): CustomPart => ({ id: `E${k}${j}`, name: "End plate", size: [4, h - 40, dR], pos: [cx + sx * (w / 2 - 6), cy, zR], material: "fiber" })),
    { id: `F${k}`, name: "Front", size: [w - 4, h - 4, T], pos: [cx, cy, zF], material: "board" },
  ];
  if (extra) parts.push({ id: `X${k}`, name: "Rack panel", size: [w - 20, 3, dR - 40], pos: [cx, cy + h / 2 - 70, zR + 10], material: "fiber" });
  return parts;
}

/** Steps that put the compartments together beside the cabinet, then hang them in. */
function compartmentSteps(boxes: Box[], D: number, extra: boolean, nScrews: number): CustomStep[] {
  const n = boxes.length;
  const ids = (p: string) => boxes.map((_, k) => `${p}${k}`);
  const away = (list: string[]) => Object.fromEntries(list.map((id) => [id, [0, 0, AWAY] as Vec3]));
  const all = [...ids("K"), ...ids("E").flatMap((e) => [`${e}0`, `${e}1`]), ...(extra ? ids("X") : []), ...ids("F")];
  const word = n === 4 ? "four" : "three";
  const zF = D / 2 - T;
  const steps: CustomStep[] = [
    {
      title: "Unfold a shoe rack",
      detail: `Open the two halves until they lie flat against each other the right way round. Do this for all ${word}.`,
      wait: ids("K"),
      from: away(ids("K")),
      repeat: n,
    },
    {
      title: "Click on an end plate",
      detail: "Pivot hole to the bottom front. Press it on until all the tabs click.",
      wait: ids("E").map((e) => `${e}0`),
      from: away(ids("E").map((e) => `${e}0`)),
      repeat: n,
    },
    {
      title: "Turn it over and click on the other end plate",
      wait: ids("E").map((e) => `${e}1`),
      from: away(ids("E").map((e) => `${e}1`)),
      repeat: n,
    },
  ];
  if (extra)
    steps.push(
      {
        title: "Fit the extra rack panel",
        detail: "Hook its edge under the tabs inside the end plates.",
        wait: ids("X"),
        from: away(ids("X")),
        repeat: n,
      },
      { title: "Press the panel down until it clicks", detail: "Three clips along its edge.", repeat: n },
    );
  steps.push(
    {
      title: "Lay the front face down and set the rack on it",
      detail: "The handle edge where the rack opens, as the little picture shows, so the compartment tips out the right way.",
      wait: ids("F"),
      from: away(ids("F")),
      repeat: n,
    },
    {
      title: "Screw the front onto the rack",
      detail: `${nScrews === 4 ? "Four" : "Six"} screws through the plastic into the front. Use a hand screwdriver, not a drill.`,
      fix: boxes.map((b, k) => {
        const w = b.x1 - b.x0, cx = (b.x0 + b.x1) / 2, per = nScrews / 2;
        const xs = Array.from({ length: per }, (_, i) => cx - w / 2 + 40 + ((w - 80) * i) / (per - 1));
        return fx("screw", [b.y0 + 40, b.y1 - 60].flatMap((y) => xs.map((x) => pt(x, y, zF))), [0, 0, 1], { on: `F${k}`, ...FRONT_SCREW });
      }),
      tools: ["screwdriver"],
      repeat: n,
    },
    {
      title: "Hang the compartments in",
      detail: "Tip each one in at the bottom so the end plates go onto the pivots, then push it shut so the arms slide into the guides.",
      add: all,
      from: Object.fromEntries(all.map((id) => [id, [0, 0, AWAY * 1.6] as Vec3])),
      repeat: n,
    },
  );
  return steps;
}

/** Plastic guide (two screws) and pivot (one screw) for each end of each compartment, on the panel at that end. */
function guidesAndPivots(ends: { x: number; dir: number; on: string; y0: number; h: number }[], D: number) {
  const zG = -D / 2 + 60, zP = D / 2 - 45;
  const yG = (e: { y0: number; h: number }) => e.y0 + e.h * 0.62;
  const yP = (e: { y0: number }) => e.y0 + 40;
  return {
    guides: ends.map((e) => fx("clip", [pt(e.x, yG(e), zG)], [e.dir, 0, 0], { on: e.on, ...GUIDE })),
    guideScrews: ends.map((e) => fx("screw", [-14, 14].map((d) => pt(e.x, yG(e), zG + d)), [e.dir, 0, 0], { on: e.on, ...SMALL })),
    pivots: ends.map((e) => fx("stud", [pt(e.x, yP(e), zP)], [e.dir, 0, 0], { on: e.on, ...PIVOT })),
    pivotScrews: ends.map((e) => fx("screw", [pt(e.x, yP(e) - 16, zP)], [e.dir, 0, 0], { on: e.on, ...SMALL })),
  };
}

function wallStep(xs: number[], y: number, D: number): CustomStep {
  return {
    title: "Screw it to the wall",
    detail: "Two screws with washers through the back rail. The plugs suit solid and hollow walls; in solid wood use the screws alone.",
    fix: [
      fx("plug", xs.map((x) => pt(x, y, -D / 2 - 30)), [0, 0, -1], { included: true }),
      fx("washer", xs.map((x) => pt(x, y, -D / 2 + T + 1)), [0, 0, -1], { included: true }),
      fx("screw", xs.map((x) => pt(x, y, -D / 2 + T + 2)), [0, 0, -1], WALL),
    ],
    tools: ["drill", "screwdriver", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  };
}

/* ---------------------------------------------------------------- 4 compartments, 96x17x90 */

function four(): CustomParams {
  const W = 960, H = 900, D = 170;
  const yB = L; // underside of the bottom
  const yT = H - T; // underside of the top
  const xi = W / 2 - T;
  const RH = 140, yR = 680; // the back rail
  const zR = -D / 2 + T / 2;
  const zd = (D - T) / 2 + -D / 2 + T; // middle of the divider's depth
  const parts: CustomPart[] = [
    { id: "BT", name: "Bottom", size: [2 * xi, T, D], pos: [0, yB + T / 2, 0], material: "board" },
    { id: "DV", name: "Divider", size: [T, yT - yB - T, D - T], pos: [0, (yB + T + yT) / 2, zd], material: "board" },
    ...S.map((sx, i): CustomPart => ({ id: i ? "RS" : "LS", name: "Side", size: [T, yT - yB, D], pos: [sx * (W / 2 - T / 2), (yB + yT) / 2, 0], material: "board" })),
    { id: "RA", name: "Back rail", size: [2 * xi, RH, T], pos: [0, yR, zR], material: "board" },
    { id: "TP", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0], material: "board" },
  ];
  const legs = legFrame(W, D, yB);
  parts.push(...legs.parts);
  const yIn = yB + T, hRow = (yT - yIn) / 2;
  const boxes: Box[] = [];
  for (const r of [1, 0])
    for (const c of [0, 1]) boxes.push({ id: `${r}${c}`, x0: c ? T / 2 : -xi, x1: c ? xi : -T / 2, y0: yIn + r * hRow, y1: yIn + (r + 1) * hRow });
  boxes.forEach((b, k) => parts.push(...compartment(k, b, D, -D / 2 + T, false)));

  const ends = boxes.flatMap((b) => [
    // the left end screws into the panel on its left (a side or the divider), the right end into the one on its right
    { x: b.x0, dir: -1, on: b.x0 < -100 ? "LS" : "DV", y0: b.y0, h: hRow },
    { x: b.x1, dir: 1, on: b.x1 > 100 ? "RS" : "DV", y0: b.y0, h: hRow },
  ]);
  const gp = guidesAndPivots(ends, D);
  const zc = 25, zw = 55; // cam bolts and dowels this far either side of the middle of an edge
  const side = (sx: number) => (sx < 0 ? "LS" : "RS");
  const sideCams = (sx: number) => fx("camScrew", [...S.map((k) => pt(sx * xi, yB + T / 2, k * zc)), pt(sx * xi, yR, zR)], [sx, 0, 0], { on: side(sx) });
  const steps: CustomStep[] = [
    {
      title: "Tap two dowels into the divider and stand it on the bottom",
      detail: "Lay the panels on a rug. The divider goes in the middle of the bottom, on its two dowels.",
      add: ["BT", "DV"],
      fix: [fx("dowel", S.map((k) => pt(0, yB + T, zd + k * zw)), [0, 1, 0], { on: "DV", mate: "BT" })],
      tools: ["hammer"],
      pose: "-z",
      warnings: ["floor"],
      from: { BT: [0, -250, 0] },
    },
    {
      title: "Screw the bottom to the divider",
      detail: "One connector screw through the bottom into its end, with the Allen key.",
      fix: [fx("bolt", [pt(0, yB, zd)], [0, 1, 0], { on: "BT", mate: "DV", ...CONNECTOR })],
      tools: ["allen"],
    },
    {
      title: "Screw six cam bolts into the sides",
      detail: "Three in each side: two at the bottom end and one for the back rail.",
      fix: [sideCams(-1), sideCams(1)],
      tools: ["screwdriver"],
      wait: ["LS", "RS"],
    },
    {
      title: "Screw on the eight rack guides",
      detail: "The curved plastic guides, two screws each: one per compartment on each side and two on each face of the divider.",
      fix: [...gp.guides, ...gp.guideScrews],
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the eight pivots",
      detail: "Near the front edge below each guide, one screw each.",
      fix: [...gp.pivots, ...gp.pivotScrews],
      tools: ["screwdriver"],
    },
    {
      title: "Tap two dowels into the end of the bottom",
      fix: [fx("dowel", S.map((k) => pt(-xi, yB + T / 2, k * zw)), [1, 0, 0], { on: "BT", mate: "LS" })],
      tools: ["hammer"],
    },
    {
      title: "Fit the left side and lock it",
      detail: "Onto the dowels and bolts at the end of the bottom, then two cam locks in the bottom.",
      add: ["LS"],
      fix: [fx("cam", S.map((k) => pt(-xi + 30, yB + T, k * zc)), [0, -1, 0], { on: "BT" })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap in six dowels",
      detail: "Two into the other end of the bottom and two into each end of the back rail.",
      fix: [
        fx("dowel", S.map((k) => pt(xi, yB + T / 2, k * zw)), [-1, 0, 0], { on: "BT", mate: "RS" }),
        ...S.map((sx) => fx("dowel", S.map((k) => pt(sx * xi, yR + k * 45, zR)), [-sx, 0, 0], { on: "RA", mate: side(sx) })),
      ],
      tools: ["hammer"],
      wait: ["RA"],
    },
    {
      title: "Lay in the back rail and fit the right side",
      detail: "The rail across the back above the divider, then the side onto all the dowels. Four cam locks: two in the bottom, one in each end of the rail.",
      add: ["RA", "RS"],
      from: { RA: [0, 0, -300] },
      fix: [
        fx("cam", S.map((k) => pt(xi - 30, yB + T, k * zc)), [0, -1, 0], { on: "BT" }),
        fx("cam", S.map((sx) => pt(sx * (xi - 30), yR, -D / 2)), [0, 0, 1], { on: "RA" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the back rail to the divider",
      detail: "One connector screw through the middle of the rail.",
      fix: [fx("bolt", [pt(0, yR, -D / 2)], [0, 0, 1], { on: "RA", mate: "DV", ...CONNECTOR })],
      tools: ["allen"],
    },
    {
      title: "Fit the top",
      detail: "Six cam bolts along its inside and five dowels (two over each side, one over the divider), then press it onto the frame.",
      add: ["TP"],
      fix: [fx("camScrew", [-xi - T / 2, 0, xi + T / 2].flatMap((x) => S.map((k) => pt(x, yT, (x ? 0 : zd) + k * zc))), [0, 1, 0], { on: "TP" }), fx("dowel", [...S.flatMap((sx) => S.map((k) => pt(sx * (W / 2 - T / 2), yT, k * zw))), pt(0, yT, zd)], [0, 1, 0], { on: "TP" })],
      tools: ["hammer"],
    },
    {
      title: "Lock the top",
      detail: "Six cam locks: two near the top of each side and two in the divider.",
      fix: [
        ...S.map((sx) => fx("cam", S.map((k) => pt(sx * xi, yT - 30, k * zc)), [-sx, 0, 0], { on: side(sx) })),
        fx("cam", S.map((k) => pt(-T / 2, yT - 30, zd + k * zc)), [1, 0, 0], { on: "DV" }),
      ],
      tools: ["screwdriver"],
    },
    ...legs.steps,
    {
      title: "Stand it up against the wall",
      detail: "It must be fixed to the wall before you hang the compartments. The plugs in the box suit most solid and hollow walls; ask if unsure.",
      pose: "+y",
      people: 2,
      warnings: ["two", "tip"],
    },
    wallStep([-250, 250], yR, D),
    ...compartmentSteps(boxes, D, false, 4),
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- 3 compartments, 79x29x148 */

function three(): CustomParams {
  const W = 790, H = 1480, D = 290;
  const yB = L, ySide = yB + T; // the sides stand on the bottom
  const yT = H - T;
  const xi = W / 2 - T;
  const zR = -D / 2 + T / 2;
  const rails = [
    { id: "R1", name: "Back rail", h: 120, y: 1290 },
    { id: "R2", name: "Back rail", h: 120, y: 770 },
    { id: "R3", name: "Narrow back rail", h: 60, y: 210 },
  ];
  const parts: CustomPart[] = [
    ...S.map((sx, i): CustomPart => ({ id: i ? "RS" : "LS", name: "Side", size: [T, H - ySide, D], pos: [sx * (W / 2 - T / 2), (ySide + H) / 2, 0], material: "board" })),
    { id: "TP", name: "Top", size: [2 * xi, T, D], pos: [0, H - T / 2, 0], material: "board" },
    ...rails.map((r): CustomPart => ({ id: r.id, name: r.name, size: [2 * xi, r.h, T], pos: [0, r.y, zR], material: "board" })),
    { id: "BT", name: "Bottom", size: [W, T, D], pos: [0, yB + T / 2, 0], material: "board" },
  ];
  const legs = legFrame(W, D, yB);
  parts.push(...legs.parts);
  const hRow = (yT - ySide) / 3;
  const boxes: Box[] = [2, 1, 0].map((r) => ({ id: `${r}`, x0: -xi, x1: xi, y0: ySide + r * hRow, y1: ySide + (r + 1) * hRow }));
  boxes.forEach((b, k) => parts.push(...compartment(k, b, D, -D / 2 + T, true)));
  const side = (sx: number) => (sx < 0 ? "LS" : "RS");
  const ends = boxes.flatMap((b) => S.map((sx) => ({ x: sx * xi, dir: sx, on: side(sx), y0: b.y0, h: hRow })));
  const gp = guidesAndPivots(ends, D);
  const pick = <F extends CustomFix>(list: F[], sx: number) => list.filter((f) => f.on === side(sx));
  const zc = 40, zw = 90;
  // cam bolts in a side: two for the top, one for each of the two wide rails
  const sideCams = (sx: number) => fx("camScrew", [...S.map((k) => pt(sx * xi, yT + T / 2, k * zc)), pt(sx * xi, rails[0].y, zR), pt(sx * xi, rails[1].y, zR)], [sx, 0, 0], { on: side(sx) });
  const topDowels = (sx: number) => fx("dowel", [-1, 0, 1].map((k) => pt(sx * xi, yT + T / 2, k * zw)), [-sx, 0, 0], { on: "TP", mate: side(sx) });
  const railDowels = (sx: number, r: (typeof rails)[number]) => fx("dowel", S.map((k) => pt(sx * xi, r.y + k * (r.h / 2 - 15), zR)), [-sx, 0, 0], { on: r.id, mate: side(sx) });
  const topLocks = (sx: number) => fx("cam", S.map((k) => pt(sx * (xi - 30), yT, k * zc)), [0, 1, 0], { on: "TP" });
  const railLocks = (sx: number) => rails.slice(0, 2).map((r) => fx("cam", [pt(sx * (xi - 30), r.y, -D / 2)], [0, 0, 1], { on: r.id }));
  const steps: CustomStep[] = [
    {
      title: "Screw eight cam bolts into the sides",
      detail: "Lay both sides on a rug, inside up. Four in each: two at the top end and one for each wide back rail.",
      add: ["LS"],
      fix: [sideCams(-1), sideCams(1)],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
      wait: ["RS"],
    },
    {
      title: "Screw on the six rack guides",
      detail: "Three on each side, two screws each.",
      fix: [...pick(gp.guides, -1), ...pick(gp.guides, 1), ...gp.guideScrews],
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the six pivots",
      detail: "Near the front edge below each guide, one screw each.",
      fix: [...gp.pivots, ...gp.pivotScrews],
      tools: ["screwdriver"],
    },
    {
      title: "Tap three dowels into one end of the top",
      fix: [topDowels(-1)],
      tools: ["hammer"],
      wait: ["TP"],
    },
    {
      title: "Stand the top in the side and lock it",
      detail: "At the top end of the side on the floor. Two cam locks in the top.",
      add: ["TP"],
      fix: [topLocks(-1)],
      tools: ["screwdriver"],
    },
    {
      title: "Stand the two wide back rails in",
      detail: "Two dowels in the end of each, into the back edge of the side.",
      add: ["R1", "R2"],
      fix: [railDowels(-1, rails[0]), railDowels(-1, rails[1])],
      tools: ["hammer"],
    },
    {
      title: "Lock the rails",
      detail: "One cam lock in each.",
      fix: railLocks(-1),
      tools: ["screwdriver"],
    },
    {
      title: "Stand the narrow back rail in",
      detail: "Near the bottom end, on two dowels.",
      add: ["R3"],
      fix: [railDowels(-1, rails[2])],
      tools: ["hammer"],
    },
    {
      title: "Put the other side on",
      detail: "Nine dowels first: three in the top and two in each rail. Then lower the side onto them, inside down.",
      add: ["RS"],
      fix: [topDowels(1), ...rails.map((r) => railDowels(1, r))],
      tools: ["hammer"],
    },
    {
      title: "Lock the other side",
      detail: "Two cam locks in the top and one in each wide rail.",
      fix: [topLocks(1), ...railLocks(1)],
      tools: ["screwdriver"],
    },
    { title: "Lay it on its front", detail: "Turn it over onto the rug so the bottom ends of the sides face you.", pose: "-z", warnings: ["floor"] },
    {
      title: "Fit the bottom",
      detail: "Four cam bolts near its ends and six dowels, three at each end, then press it onto the ends of the sides.",
      add: ["BT"],
      fix: [fx("camScrew", S.flatMap((sx) => S.map((k) => pt(sx * (W / 2 - T / 2), ySide, k * zc))), [0, -1, 0], { on: "BT" }), fx("dowel", S.flatMap((sx) => [-1, 0, 1].map((k) => pt(sx * (W / 2 - T / 2), ySide, k * zw))), [0, -1, 0], { on: "BT" })],
      tools: ["screwdriver", "hammer"],
    },
    {
      title: "Lock the bottom",
      detail: "Four cam locks, two near the bottom of each side.",
      fix: S.map((sx) => fx("cam", S.map((k) => pt(sx * xi, ySide + 30, k * zc)), [-sx, 0, 0], { on: side(sx) })),
      tools: ["screwdriver"],
    },
    ...legs.steps,
    {
      title: "Stand it up against the wall",
      detail: "It must be fixed to the wall before you hang the compartments. The plugs in the box suit most solid and hollow walls; ask if unsure.",
      pose: "+y",
      people: 2,
      warnings: ["two", "tip"],
    },
    wallStep([-250, 250], rails[0].y, D),
    ...compartmentSteps(boxes, D, true, 6),
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["STÄLL", "STALL"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (slug === "stall-shoe-cabinet-4-compartments-96-x-17-x-90") return four();
    if (slug === "stall-shoe-cabinet-3-compartments") return three();
    return null;
  },
};
export default family;
