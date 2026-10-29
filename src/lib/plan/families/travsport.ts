import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * TRAVSPORT sit/stand desk, read from its manuals (the top with its shelf, then the electric underframe). The raised
 * shelf goes on three blocks with cam bolts and cam locks and is screwed to the top from below. The frame stands up
 * from the start: glides in the feet, brackets and the two lifting columns bolted on, the two halves of the cross
 * beam slid together and bolted, the drive shaft and the motor fitted. The top is laid on by two people and screwed
 * on, then the control panel and the cable tray go underneath and the desk is plugged in.
 */

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 120 x 70, top 72 to 117 high; the shelf stands 11 cm above the top
  const W = s.size.w * 10 || 1200, D = s.size.d * 10 || 700, H = s.size.h * 10 || 720;
  const tT = 22, yTop = H - tT / 2, under = H - tT;
  const shT = 18, blockH = 90, shD = 220, zSh = -D / 2 + shD / 2 + 10, shL = W - 80;
  const blocksX = [-shL / 2 + 100, 40, shL / 2 - 10];
  const xC = W / 2 - 180, armH = 40, yArm = under - armH / 2, yFoot = 25, footH = 30;
  const colTop = under - armH, colBot = yFoot + footH / 2;
  const zBeam = -60;
  const parts: CustomPart[] = [
    { id: "SH", name: "Shelf", size: [shL, shT, shD], pos: [0, H + blockH + shT / 2, zSh], material: "board" },
    ...blocksX.map((x, i): CustomPart => ({ id: `K${i + 1}`, name: "Shelf block", size: [20, blockH, shD - 30], pos: [x, H + blockH / 2, zSh], material: "board" })),
    { id: "TP", name: "Desk top", size: [W, tT, D], pos: [0, yTop, 0], material: "board" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `F${i + 1}`, name: "Foot", size: [70, footH, D - 20], pos: [sx * xC, yFoot, 0], material: "metal" })),
    ...[-1, 1].map((sx, i): CustomPart => ({
      id: `C${i + 1}`,
      name: "Lifting column",
      size: [70, under - colBot, D - 120],
      pos: [sx * xC, (colBot + under) / 2, 0],
      // the column with the arm on top that carries the desk top
      pieces: [
        { shape: "box", size: [70, colTop - colBot, 55], pos: [0, (colBot + colTop) / 2 - (colBot + under) / 2, 0] },
        { shape: "box", size: [60, armH, D - 120], pos: [0, yArm - (colBot + under) / 2, 0] },
      ],
      material: "metal",
    })),
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `B${i + 1}`, name: "Beam half", size: [xC - 30, armH, 40], pos: [(sx * (xC - 30)) / 2, yArm, zBeam], material: "metal" })),
    { id: "DS", name: "Drive shaft", shape: "cyl", size: [12, 2 * xC - 80, 12], pos: [0, yArm - armH / 2 - 10, zBeam], rot: [0, 0, Math.PI / 2], material: "metal" },
    { id: "MO", name: "Motor", size: [110, 60, 80], pos: [xC - 100, yArm - armH / 2 - 30, zBeam], material: "metal" },
    { id: "CP", name: "Control panel", size: [100, 22, 60], pos: [W / 2 - 110, under - 11, D / 2 - 40], material: "metal" },
    { id: "CT", name: "Cable tray", size: [2 * xC - 140, 70, 110], pos: [0, under - 35 - 15, -D / 2 + 110], material: "soft" },
  ];
  const away = { SH: [0, 0, -900], K1: [0, 0, -900], K2: [0, 0, -900], K3: [0, 0, -900], TP: [0, 0, -900] } as Record<string, Vec3>;
  const pick = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, away[id]]));
  const ySh = H + blockH;
  const pairs = (x: number, y: number, z0: number, dz: number): Vec3[] => [-1, 1].map((sz): Vec3 => [x, y, z0 + sz * dz]);
  const glides: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xC, yFoot - footH / 2, sz * (D / 2 - 50)]));
  const colBolts = (sx: number): CustomFix => ({
    kind: "bolt",
    count: 6,
    len: 16,
    dia: 8,
    at: [colBot + 60, colBot + 100, colTop - 40].flatMap((y) => [-1, 1].map((sz): Vec3 => [sx * (xC + 35), y, sz * 15])),
    dir: [-sx, 0, 0],
    on: sx < 0 ? "C1" : "C2",
  });
  return {
    parts,
    steps: [
      {
        title: "Screw the cam bolts into the shelf",
        detail: "Lay the shelf on a rug, underside up. Two cam bolts go in at each block's place.",
        fix: [{ kind: "camScrew", count: 6, at: blocksX.flatMap((x) => pairs(x, ySh, zSh, 50)), dir: [0, 1, 0], on: "SH", mate: "K1" }],
        wait: ["SH"],
        from: pick("SH"),
        warnings: ["floor"],
      },
      {
        title: "Tap a dowel into each block",
        detail: "One dowel in the bottom of each of the three blocks.",
        fix: blocksX.map((x, i): CustomFix => ({ kind: "dowel", count: 1, at: [[x, H, zSh]], dir: [0, 1, 0], on: `K${i + 1}`, mate: "TP" })),
        wait: ["K1", "K2", "K3"],
        from: pick("K1", "K2", "K3"),
        tools: ["hammer"],
      },
      {
        title: "Lock the blocks onto the shelf",
        detail: "Push each block onto its two cam bolts, then turn the cam locks in the blocks until they pull tight.",
        fix: blocksX.map((x, i): CustomFix => ({ kind: "cam", count: 2, at: pairs(x - 10, ySh - 25, zSh, 50), dir: [1, 0, 0], on: `K${i + 1}` })),
      },
      {
        title: "Screw the shelf to the desk top",
        detail: "Stand the top on its back edge with the shelf against it. Five long screws go up through the top into the blocks: two in each end block, one in the middle.",
        fix: [
          {
            kind: "bolt",
            name: "Long screw",
            count: 5,
            len: 60,
            dia: 6,
            // the middle one beside the block's dowel, not under it
            at: [...pairs(blocksX[0], under, zSh, 40), [blocksX[1], under, zSh + 40], ...pairs(blocksX[2], under, zSh, 40)],
            dir: [0, 1, 0],
            on: "TP",
            mate: "K1",
          },
        ],
        wait: ["TP"],
        from: pick("TP"),
      },
      {
        title: "Screw the glides into the feet",
        detail: "Lay both feet on the rug. One glide under each end, turned in by hand.",
        add: ["F1", "F2"],
        fix: [{ kind: "foot", name: "Adjustable glide", count: 4, at: glides, dir: [0, 1, 0] }],
      },
      {
        title: "Bolt the column brackets to the feet",
        detail: "The brackets are marked L and R. Two flat screws in each, turned in with the Allen key, then four bolts screwed into them by hand.",
        fix: [
          ...[-1, 1].map((sx): CustomFix => ({ kind: "bolt", name: "Flat screw", count: 2, len: 16, dia: 6, at: pairs(sx * xC, yFoot + footH / 2, 0, 20), dir: [0, -1, 0], on: sx < 0 ? "F1" : "F2" })),
          { kind: "bolt", count: 4, len: 16, dia: 8, at: [-1, 1].flatMap((sx) => pairs(sx * xC, yFoot + footH / 2, 0, 60)), dir: [0, -1, 0] },
        ],
      },
      { title: "Bolt the columns onto the brackets", detail: "Six bolts in each column, then tighten the four bracket bolts too.", add: ["C1", "C2"], fix: [colBolts(-1), colBolts(1)] },
      {
        title: "Slide the beam halves together",
        detail: "Hang each half on the arm at the top of a column and push them together in the middle until they meet.",
        add: ["B1", "B2"],
      },
      {
        title: "Bolt the beam to the arms",
        detail: "Twelve bolts, six at each end. Tighten them once the frame stands square.",
        fix: [-1, 1].map((sx): CustomFix => ({
          kind: "bolt",
          count: 6,
          len: 12,
          dia: 6,
          at: [-1, 0, 1].flatMap((k) => [-1, 1].map((sy): Vec3 => [sx * (xC - 40 - 15 * (k + 1)), yArm + sy * 10, zBeam + 20])),
          dir: [0, 0, -1],
          on: sx < 0 ? "B1" : "B2",
        })),
        check: "square",
      },
      { title: "Push in the drive shaft", detail: "Slide it through the beam until both ends sit in the columns.", add: ["DS"] },
      {
        title: "Fit the motor",
        detail: "Slide it onto the shaft at the right-hand column, lock it in place and fix it with two bolts. Clip its cable along the beam.",
        add: ["MO"],
        fix: [
          { kind: "bolt", count: 2, len: 30, dia: 6, at: [xC - 130, xC - 70].map((x): Vec3 => [x, yArm - armH / 2 - 30, zBeam + 40]), dir: [0, 0, -1], on: "MO" },
          { kind: "clip", name: "Cable clip", count: 2, at: [[-200, yArm - armH / 2, zBeam], [200, yArm - armH / 2, zBeam]], on: "B1" },
        ],
      },
      {
        title: "Screw on the top plates and pads",
        detail: "A plate on each arm with two flat screws, then stick the four pads on top of the arms.",
        fix: [
          { kind: "bolt", name: "Flat screw", count: 4, len: 16, dia: 6, at: [-1, 1].flatMap((sx) => pairs(sx * xC, under, 0, 150)), dir: [0, -1, 0] },
          { kind: "glide", name: "Pad", count: 4, at: [-1, 1].flatMap((sx) => pairs(sx * xC, under, 0, D / 2 - 90)), dir: [0, -1, 0] },
        ],
      },
      {
        title: "Lay the top on the frame",
        detail: "Lift it on together, shelf at the back, and line its holes up over the arms.",
        add: ["TP", "SH", "K1", "K2", "K3"],
        people: 2,
      },
      {
        title: "Screw the frame to the top",
        detail: "Four screws through each arm into the inserts in the top.",
        fix: [{ kind: "screw", count: 8, len: 16, dia: 6, at: [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => pairs(sx * xC, under, sz * 220, 40))), dir: [0, 1, 0], mate: "TP" }],
      },
      {
        title: "Screw the control panel under the top",
        detail: "At the front right corner, two screws. Plug its cable into the motor.",
        add: ["CP"],
        fix: [{ kind: "screw", count: 2, len: 16, dia: 4, at: [[W / 2 - 140, under, D / 2 - 40], [W / 2 - 80, under, D / 2 - 40]], dir: [0, 1, 0], on: "CP", mate: "TP" }],
      },
      {
        title: "Hang the cable tray under the top",
        detail: "Screw its hooks under the back of the top, hang the tray on them and lay the cables in it.",
        add: ["CT"],
        fix: [
          { kind: "screw", count: 4, len: 16, dia: 4, at: [-300, -100, 100, 300].map((x): Vec3 => [x, under, -D / 2 + 70]), dir: [0, 1, 0], mate: "TP" },
          { kind: "hook", count: 4, at: [-300, -100, 100, 300].map((x): Vec3 => [x, under, -D / 2 + 150]), dir: [0, 1, 0], mate: "TP" },
        ],
      },
      {
        title: "Plug it in and set the lowest height",
        detail: "Turn the glides until the desk stands steady. Plug in the power supply, then hold the down button until the desk reaches its lowest position and stops.",
      },
    ],
  };
}

const family: Family = { names: ["TRAVSPORT"], recipe };
export default family;
