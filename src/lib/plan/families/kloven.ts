import type { Family } from "./family";
import type { CustomParams, CustomPart, CustomStep, PartPiece, Vec3 } from "../../types";

/**
 * KLÖVEN deck chair, read from its manual. It comes as five pieces: the seat (two sloping runners, the front rail and
 * the seat slats, already joined), the two front legs, the back (its slats on two cross bars, the upper one ending in
 * the arm supports) and the two armrests. Glides go under the runners and legs first. With the seat on its side, each
 * leg goes on over two dowels and is bolted through into barrel nuts in the front rail. Stood up, the back is bolted
 * down onto the runners, the armrests go over a dowel on each arm support and are screwed from below, and an angle
 * bracket under each armrest holds it to the top of its leg.
 */

const SLOPE = 0.3217; // the runners fall about 18 degrees from the front to the floor at the back
const LEAN = 0.38; // the back leans back about 22 degrees
const RC: [number, number] = [175, -25]; // runner centre (y, z)
const RX = 290, RT = 24, RH = 90, RL = 800;
const cs = Math.cos(SLOPE), sn = Math.sin(SLOPE);
/** A point on a runner in its own frame (height across it, distance along it) to the chair's (y, z). */
const onRunner = (yl: number, t: number): [number, number] => [RC[0] + yl * cs + t * sn, RC[1] - yl * sn + t * cs];
const SLANT: Vec3 = [-SLOPE, 0, 0];
const DOWN_RUNNER: Vec3 = [0, -cs, sn]; // straight into the runner's top edge

const LEG = { x: RX + RT / 2 + 12, z: 300, d: 80, h: 600 };
const ARM = { x: 330, w: 130, t: 20, y: 600, z0: -340, z1: 400 };
const APRON = { z: 320, y: 290, h: 110, t: 22 };

/** A part from pieces placed in the finished chair, centred on their bounds (rotated boxes counted by their corners). */
function compound(id: string, name: string, pieces: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces) {
    const a = -(p.rot?.[0] ?? 0);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const y = (sy * p.size[1]) / 2, z = (sz * p.size[2]) / 2;
          const q: Vec3 = [p.pos[0] + (sx * p.size[0]) / 2, p.pos[1] + y * Math.cos(a) + z * Math.sin(a), p.pos[2] - y * Math.sin(a) + z * Math.cos(a)];
          for (let i = 0; i < 3; i++) {
            lo[i] = Math.min(lo[i], q[i]);
            hi[i] = Math.max(hi[i], q[i]);
          }
        }
  }
  const pos: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const size: Vec3 = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  return { id, name, size, pos, material, pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] })) };
}

function seat(): CustomPart {
  const pieces: PartPiece[] = [];
  for (const sx of [-1, 1]) pieces.push({ shape: "box", size: [RT, RH, RL], pos: [sx * RX, RC[0], RC[1]], rot: SLANT, material: "wood" });
  pieces.push({ shape: "box", size: [2 * RX - RT, APRON.h, APRON.t], pos: [0, APRON.y, APRON.z], material: "wood" });
  // the seat slats lie across the runners' top edges
  for (const t of [340, 256, 172, 88, 4]) {
    const [y, z] = onRunner(RH / 2 + 9, t);
    pieces.push({ shape: "box", size: [2 * RX + RT, 18, 70], pos: [0, y, z], rot: SLANT, material: "wood" });
  }
  return compound("S", "Seat", pieces, "wood");
}

const BAR_T = -120; // where the back's lower bar sits along the runners
function back(): { part: CustomPart; bolts: Vec3[]; support: number } {
  const pieces: PartPiece[] = [];
  const [by, bz] = onRunner(RH / 2 + 20, BAR_T);
  pieces.push({ shape: "box", size: [2 * RX + RT, 40, 70], pos: [0, by, bz], rot: SLANT, material: "wood" });
  // five slats stand on the lower bar, leaning back, the middle one tallest for the rounded top
  const tl = Math.tan(LEAN);
  const y0 = by - 10, z0 = bz + 45;
  const lens = [690, 725, 742, 725, 690];
  lens.forEach((len, i) => {
    const h = len * Math.cos(LEAN);
    pieces.push({ shape: "box", size: [95, len, 20], pos: [(i - 2) * 110, y0 + h / 2, z0 - (h / 2) * tl], rot: [-LEAN, 0, 0], material: "wood" });
  });
  // the upper bar runs behind the slats and ends in the two arm supports under the armrests
  const ys = ARM.y - 20;
  const zs = z0 - (ys - y0) * tl - 10 / Math.cos(LEAN) - 22;
  pieces.push({ shape: "box", size: [2 * ARM.x - ARM.w, 40, 40], pos: [0, ys, zs], material: "wood" });
  for (const sx of [-1, 1]) pieces.push({ shape: "box", size: [ARM.w, 40, 90], pos: [sx * ARM.x, ys, zs], material: "wood" });
  const bolts: Vec3[] = [];
  for (const sx of [-1, 1])
    for (const dt of [-20, 20]) {
      const [y, z] = onRunner(RH / 2 + 40, BAR_T + dt);
      bolts.push([sx * RX, y, z]);
    }
  return { part: compound("B", "Back", pieces, "wood"), bolts, support: zs };
}

function chair(): CustomParams {
  const S = seat();
  const { part: B, bolts, support } = back();
  const legs = [-1, 1].map((sx, i): CustomPart => ({ id: `L${i + 1}`, name: "Front leg", size: [RT, LEG.h, LEG.d], pos: [sx * LEG.x, LEG.h / 2, LEG.z], material: "wood" }));
  const arms = [-1, 1].map(
    (sx, i): CustomPart => ({ id: `A${i + 1}`, name: "Armrest", size: [ARM.w, ARM.t, ARM.z1 - ARM.z0], pos: [sx * ARM.x, ARM.y + ARM.t / 2, (ARM.z0 + ARM.z1) / 2], material: "wood" }),
  );
  const parts = [S, ...legs, B, ...arms];
  const [ry, rz] = onRunner(-RH / 2, -RL / 2 + 30);
  const glides: Vec3[] = [
    [-RX, ry, rz],
    [RX, ry, rz],
    [-LEG.x, 0, LEG.z],
    [LEG.x, 0, LEG.z],
  ];
  const outer = RX + RT / 2;
  const dowelZ = LEG.z - 25;
  const dowels = (sx: number): Vec3[] => [-18, 18].map((dy): Vec3 => [sx * outer, onRunner(0, (dowelZ - RC[1]) / cs)[0] + dy, dowelZ]);
  const legBolts = (sx: number): Vec3[] => [APRON.y - 28, APRON.y + 28].map((y): Vec3 => [sx * (outer + RT), y, APRON.z]);
  const nuts = (sx: number): Vec3[] => [APRON.y - 28, APRON.y + 28].map((y): Vec3 => [sx * (RX - RT / 2 - 40), y, APRON.z - APRON.t / 2]);
  const legStep = (i: number, sx: number, other: boolean): CustomStep => ({
    title: other ? "Bolt on the other leg" : "Bolt the leg onto the dowels",
    detail: "Turn a barrel nut into the hole in the back of the front rail, slot showing, so the long bolt can catch it. Tighten with the Allen key.",
    add: [`L${i}`],
    from: { [`L${i}`]: [sx * 260, 0, 0] },
    fix: [
      { kind: "nut", name: "Barrel nut", count: 2, len: 14, dia: 10, at: nuts(sx), dir: [0, 0, 1], on: "S" },
      { kind: "bolt", count: 2, len: 100, dia: 6, at: legBolts(sx), dir: [-sx, 0, 0], on: `L${i}`, mate: "S" },
    ],
    tools: ["allen"],
  });
  const steps: CustomStep[] = [
    {
      title: "Tap the glides under the runners and legs",
      detail: "One at the back end of each runner and one at the foot of each leg. Tap their pins in gently with a hammer.",
      add: ["S"],
      wait: ["L1", "L2"],
      fix: [
        { kind: "glide", name: "Glide", count: 2, len: 6, dia: 30, at: glides.slice(0, 2), dir: [0, 1, 0], on: "S" },
        { kind: "glide", name: "Glide", count: 1, len: 6, dia: 30, at: [glides[2]], dir: [0, 1, 0], on: "L1" },
        { kind: "glide", name: "Glide", count: 1, len: 6, dia: 30, at: [glides[3]], dir: [0, 1, 0], on: "L2" },
      ],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Lay the seat on its side and tap in two dowels",
      detail: "On a rug, so the slats don't scratch. The dowels go into the side of the runner by the front rail.",
      pose: "+x",
      fix: [{ kind: "dowel", count: 2, len: 30, dia: 8, at: dowels(1), dir: [-1, 0, 0], on: "S", mate: "L2" }],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    legStep(2, 1, false),
    {
      title: "Turn it over and tap in two more dowels",
      detail: "The same place on the other runner.",
      pose: "-x",
      fix: [{ kind: "dowel", count: 2, len: 30, dia: 8, at: dowels(-1), dir: [1, 0, 0], on: "S", mate: "L1" }],
      tools: ["hammer"],
    },
    legStep(1, -1, true),
    {
      title: "Stand it up and bolt the back onto the runners",
      detail: "Set the bar at the foot of the back on the runners behind the seat. Two bolts on each side, into the runners.",
      pose: "+y",
      add: ["B"],
      from: { B: [0, 260, -120] },
      fix: [{ kind: "bolt", count: 4, len: 60, dia: 6, at: bolts, dir: DOWN_RUNNER, on: "B", mate: "S" }],
      tools: ["allen"],
    },
    {
      title: "Tap a dowel into each arm support",
      detail: "Into the middle hole on top of the blocks that stick out from the back.",
      fix: [{ kind: "dowel", count: 2, len: 30, dia: 8, at: [-1, 1].map((sx): Vec3 => [sx * ARM.x, ARM.y, support]), on: "B", mate: "A1" }],
      tools: ["hammer"],
    },
    {
      title: "Screw the armrests onto the arm supports",
      detail: "Lay each armrest over its dowel and the top of its leg, then drive two screws up through the support into it.",
      add: ["A1", "A2"],
      fix: [
        {
          kind: "screw",
          count: 4,
          len: 45,
          dia: 5,
          at: [-1, 1].flatMap((sx) => [-25, 25].map((dx): Vec3 => [sx * ARM.x + dx, ARM.y - 40, support])),
          dir: [0, 1, 0],
          on: "B",
        },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw an angle bracket inside each leg",
      detail: "Its long side flat against the leg, the short one under the armrest. Check the bracket faces the right way before you screw.",
      fix: [-1, 1].flatMap((sx, i) => [
        { kind: "angle" as const, count: 1, len: 40, dia: 30, at: [[sx * (outer + 1), ARM.y - 22, LEG.z] as Vec3], dir: [0, 1, 0] as Vec3, on: `L${i + 1}` },
        { kind: "screw" as const, count: 1, len: 16, dia: 4, at: [[sx * (outer - 2), ARM.y - 30, LEG.z] as Vec3], dir: [sx, 0, 0] as Vec3, on: `L${i + 1}` },
      ]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the brackets up into the armrests",
      detail: "One screw each. Then check every bolt is tight and the chair stands steady.",
      fix: [-1, 1].map((sx, i) => ({ kind: "screw" as const, count: 1, len: 16, dia: 4, at: [[sx * (outer - 12), ARM.y - 3, LEG.z] as Vec3], dir: [0, 1, 0] as Vec3, mate: `A${i + 1}` })),
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["KLÖVEN"],
  recipe(s) {
    if (!/deck chair/i.test(s.variant) && !/deck-chair/.test(s.slug ?? "")) return null;
    return chair();
  },
};
export default family;
