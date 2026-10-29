import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * NORBERG wall-mounted drop-leaf table, read from its manual: two steel angles screwed under the narrow wall strip,
 * the strip held level on the wall and the holes drilled, three hinges joining the strip to the top (all upside down
 * on the floor), the leg holder under the top, the whole thing screwed to the wall, then the leg's pivot fixed to
 * the wall below it, its cap on, and the leg swung up into the holder and locked.
 */

const fx = (kind: CustomFix["kind"], on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at, ...o });

function dropLeaf(s: ProductSpec): CustomParams {
  // the page: 74 wide, 60 deep; the top at table height, the leg's pivot 43 cm under it
  const W = s.size.w * 10, D = 600, Y = 740, T = 18;
  const zW = -D / 2; // the wall
  const sd = 100; // the strip's depth
  const yU = Y - T; // underside of the top
  const zJ = zW + sd; // where the strip meets the top
  const aw = W / 2 - 10; // each angle's length
  const pivot: [number, number] = [Y - 430, zW + 15], tip: [number, number] = [yU - 20, -40];
  const dy = tip[0] - pivot[0], dz = tip[1] - pivot[1], L = Math.hypot(dy, dz);
  const legC: Vec3 = [0, (pivot[0] + tip[0]) / 2, (pivot[1] + tip[1]) / 2];
  const legLo: Vec3 = [-30, pivot[0] - 40, zW], legHi: Vec3 = [30, tip[0] + 10, tip[1] + 15];
  const legPos: Vec3 = [0, (legLo[1] + legHi[1]) / 2, (legLo[2] + legHi[2]) / 2];
  const rel = (v: Vec3): Vec3 => [v[0] - legPos[0], v[1] - legPos[1], v[2] - legPos[2]];
  const leg: PartPiece[] = [
    { shape: "box", size: [26, L, 16], pos: rel(legC), rot: [Math.atan2(dz, dy), 0, 0] },
    { shape: "box", size: [60, 70, 6], pos: rel([0, pivot[0], zW + 3]) },
  ];
  const angle: PartPiece[] = [
    { shape: "box", size: [aw, 3, 30], pos: [0, 30 - 1.5, 0] },
    { shape: "box", size: [aw, 60, 3], pos: [0, 0, -15 + 1.5] },
  ];
  const parts: CustomPart[] = [
    { id: "WS", name: "Wall strip", size: [W, T, sd], pos: [0, Y - T / 2, zW + sd / 2] },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `A${i}`, name: "Wall angle", size: [aw, 60, 30], pos: [(sx * W) / 4, yU - 30, zW + 15], pieces: angle, material: "metal" })),
    { id: "TP", name: "Table top", size: [W, T, D - sd], pos: [0, Y - T / 2, zJ + (D - sd) / 2] },
    { id: "LH", name: "Leg holder", size: [70, 20, 40], pos: [0, yU - 10, tip[1] + 5] },
    { id: "LG", name: "Leg", size: [legHi[0] - legLo[0], legHi[1] - legLo[1], legHi[2] - legLo[2]], pos: legPos, pieces: leg, material: "metal" },
  ];
  for (const p of parts) p.material ??= "board";
  const hx = [-W / 2 + 100, 0, W / 2 - 100];
  const hingeScrews = (side: -1 | 1): Vec3[] => hx.flatMap((x) => [-14, 14].map((dx) => [x + dx, yU - 2, zJ + side * 18] as Vec3));
  const angleScrews: Vec3[] = [-1, 1].flatMap((sx) => [-1, 0, 1].map((k) => [(sx * W) / 4 + (k * aw) / 3, yU - 3, zW + 18] as Vec3));
  const wallAt: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((k) => [(sx * W) / 4 + (k * aw) / 3, yU - 35, zW + 3] as Vec3));
  const legWall: Vec3[] = [-18, 18].map((dx) => [dx, pivot[0] - 20, zW + 6]);
  const steps: CustomStep[] = [
    {
      title: "Screw the two angles under the wall strip",
      detail: "Lay the strip upside down on a rug. Each angle's upright edge goes along the back, three screws in each.",
      add: ["WS", "A0", "A1"],
      fix: [fx("screw", "A0", [0, 1, 0], angleScrews.slice(0, 3), { len: 15, dia: 4 }), fx("screw", "A1", [0, 1, 0], angleScrews.slice(3), { len: 15, dia: 4 })],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Mark and drill the wall",
      detail: "Hold the strip against the wall at the height you want, level it, mark the four holes in the angles, and drill.",
      tools: ["level", "pencil", "drill"],
      pose: "+y",
      wall: true,
      warnings: ["wall"],
    },
    {
      title: "Screw the hinges onto the strip",
      detail: "Upside down on the rug again. Three hinges along its front edge, two screws in each.",
      fix: [fx("flatHinge", "WS", [0, 1, 0], hx.map((x) => [x, yU, zJ] as Vec3), { name: "Hinge", len: 60, dia: 34 }), fx("screw", "WS", [0, 1, 0], hingeScrews(-1), { len: 15, dia: 4 })],
      tools: ["screwdriver"],
      pose: "-y",
    },
    { title: "Lay the table top against the strip", detail: "Upside down too, its back edge tight against the strip under the hinges.", add: ["TP"], from: { TP: [0, 0, 300] } },
    { title: "Screw the hinges to the top", detail: "Two screws in each hinge.", fix: [fx("screw", "TP", [0, 1, 0], hingeScrews(1), { len: 15, dia: 4 })], tools: ["screwdriver"] },
    {
      title: "Screw the leg holder under the top",
      detail: "In the middle, over the marks, with its open end towards the wall. Two screws.",
      add: ["LH"],
      fix: [fx("screw", "LH", [0, 1, 0], [-22, 22].map((dx) => [dx, yU - 20, tip[1] + 5] as Vec3), { len: 15, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw it to the wall together",
      detail: "One of you holds the top up against the wall while the other screws through the four holes. Wall screws aren't included: pick ones made for your wall.",
      fix: [fx("plug", "A0", [0, 0, -1], wallAt.map(([x, y]) => [x, y, zW] as Vec3)), fx("screw", "A0", [0, 0, -1], wallAt, { len: 50, dia: 5 })],
      tools: ["screwdriver"],
      pose: "+y",
      people: 2,
      wall: true,
      warnings: ["wall", "two"],
    },
    {
      title: "Fix the leg's pivot to the wall",
      detail: "Hang the leg straight down under the middle of the top, check it's upright with the level, mark, drill and screw its bracket on with two screws.",
      add: ["LG"],
      from: { LG: [0, 0, 220] },
      fix: [fx("plug", "LG", [0, 0, -1], legWall.map(([x, y]) => [x, y, zW] as Vec3)), fx("screw", "LG", [0, 0, -1], legWall, { len: 50, dia: 5 })],
      tools: ["level", "pencil", "drill", "screwdriver"],
      wall: true,
      warnings: ["wall"],
    },
    {
      title: "Push the cap onto the top of the leg",
      fix: [fx("cap", "LG", [0, -1, 0], [[0, tip[0] + 10, tip[1]]], { len: 12, dia: 26, name: "Leg cap" })],
    },
    { title: "Raise the top and swing the leg up", detail: "Lift the top level, swing the leg out and up, and let its end drop into the holder." },
    { title: "Lock the leg", detail: "Turn the catch on the holder over the end of the leg. To fold the table, turn it back and lower the top." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["NORBERG"],
  recipe(s) {
    if (/drop-leaf table/i.test(s.variant)) return dropLeaf(s);
    return null;
  },
};
export default family;
