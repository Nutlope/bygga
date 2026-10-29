import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { rotate } from "../math";

/**
 * LÅNGFJÄLL, read from the conference chair's manual. The seat comes first: the one-piece shell lies face down on a
 * table with its back hanging over the edge, the cover's zip underneath is opened, the tilt mechanism and its cover
 * plate go on with two bolts, two more go in the other corners, all four are tightened and the zip is closed. Then
 * the castors are pushed into the one-piece star base on a rug, the gas lift drops into its hub, and the seat is
 * lowered onto it. The base stands aside until that last step.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
const BOLT = { name: "Allen bolt", len: 16, dia: 6 };

function recipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10;
  // IKEA: seat 53 wide and 41 deep, seat height 43 to 53 cm, 92 high at its highest; drawn halfway up
  const seatTop = 480, seatT = 70, seatW = 530, seatD = 450;
  const seatBot = seatTop - seatT;
  const zs = 20;
  const backL = 420, tilt = -0.16;
  const yb = seatTop - 30 + (backL / 2) * Math.cos(tilt), zb = zs - seatD / 2 + 30 + (backL / 2) * Math.sin(tilt);
  const shellAbs: PartPiece[] = [
    { shape: "box", size: [seatW, seatT, seatD], pos: [0, seatBot + seatT / 2, zs] },
    { shape: "box", size: [seatW - 50, backL, 60], pos: [0, yb, zb], rot: [tilt, 0, 0] },
  ];
  const mechH = 45, plateT = 12;
  const mechY = seatBot - mechH / 2;
  const R = W / 2 - 40;
  const tipY = 58, hubBot = 70, hubH = 110, hubTop = hubBot + hubH;
  const angles = [0, 1, 2, 3, 4].map((i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const rm = (R + 30) / 2;
  const rise = Math.atan2(hubBot + 20 - tipY, R - 30);
  const basePieces: PartPiece[] = [
    { shape: "cyl", size: [76, hubH, 76], pos: [0, hubBot + hubH / 2, 0] },
    ...angles.map((a): PartPiece => ({ shape: "box", size: [R - 30, 30, 46], pos: [rm * Math.cos(a), (tipY + hubBot + 20) / 2 + 15, -rm * Math.sin(a)], rot: [0, a, rise] })),
  ];
  const parts: CustomPart[] = [
    abs("SH", "Seat shell", shellAbs, "soft"),
    abs(
      "ME",
      "Tilt mechanism",
      [
        { shape: "box", size: [120, mechH, 150], pos: [0, mechY, zs] },
        { shape: "box", size: [150, 10, 16], pos: [135, mechY - 5, zs + 40] },
      ],
      "metal",
    ),
    { id: "CP", name: "Cover plate", size: [230, plateT, 260], pos: [0, seatBot - mechH - plateT / 2, zs], shape: "cyl", material: "board" },
    abs("BA", "Star base", basePieces, "metal"),
  ];
  const yB = seatBot - mechH - plateT;
  // the bolts go up through the plate into the mechanism's corners, inside its footprint
  const corner = (sx: number, sz: number): Vec3 => [sx * 45, yB, zs + sz * 60];
  const castors = angles.map((a): Vec3 => [(R - 20) * Math.cos(a), tipY, -(R - 20) * Math.sin(a)]);
  const steps: CustomStep[] = [
    {
      title: "Open the zip under the seat",
      detail: "Lay the shell face down on a table with the back hanging over the edge, and fold the flap of the cover back.",
      add: ["SH"],
      pose: "-y",
    },
    {
      title: "Bolt on the mechanism and its cover",
      detail: "Lever to the right. Set the cover plate over the mechanism and turn two bolts into opposite corners, not tight yet.",
      add: ["ME", "CP"],
      fix: [fx("bolt", [corner(-1, -1), corner(1, 1)], [0, 1, 0], "CP", { ...BOLT, mate: "SH" })],
      tools: ["allen"],
      warnings: ["loose"],
    },
    {
      title: "Turn in the other two bolts",
      detail: "Into the two corners left over, still loose.",
      fix: [fx("bolt", [corner(1, -1), corner(-1, 1)], [0, 1, 0], "CP", { ...BOLT, mate: "SH" })],
      tools: ["allen"],
    },
    { title: "Tighten all four bolts", detail: "Firmly, until the heads sit flat on the plate.", tools: ["allen"] },
    { title: "Close the zip", detail: "Fold the flap back over the mechanism and zip it shut." },
    {
      title: "Push a castor into each leg of the base",
      detail: "The base lies upside down on a rug. Press each castor straight in until it clicks home.",
      wait: ["BA"],
      fix: [fx("castor", castors, [0, 1, 0], "BA", { len: 58, dia: 50 })],
      warnings: ["floor"],
    },
    {
      title: "Drop the gas lift into the base",
      detail: "Stand the base on its castors and pull the cap off the lift. The narrow end points up.",
      fix: [fx("gasLift", [[0, hubTop, 0]], [0, -1, 0], "BA", { len: Math.round(yB - hubTop + 40), dia: 50 })],
      pose: "+y",
    },
    {
      title: "Lower the seat onto the gas lift",
      detail: "Straight down onto the lift, then sit on it once, firmly. Your weight locks it in place.",
      add: ["BA"],
      from: { BA: [0, -320, 0] },
    },
  ];
  return { parts, steps };
}

/** A part drawn as pieces placed in product coordinates. */
function abs(id: string, name: string, pieces: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces)
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const k of [-1, 1]) {
          const v = rotate([(a * p.size[0]) / 2, (b * p.size[1]) / 2, (k * p.size[2]) / 2], p.rot ?? [0, 0, 0]);
          for (let i = 0; i < 3; i++) {
            lo[i] = Math.min(lo[i], p.pos[i] + v[i]);
            hi[i] = Math.max(hi[i], p.pos[i] + v[i]);
          }
        }
  const c = lo.map((v, i) => (v + hi[i]) / 2) as Vec3;
  return { id, name, size: lo.map((v, i) => hi[i] - v) as Vec3, pos: c, material, pieces: pieces.map((p) => ({ ...p, pos: p.pos.map((v, i) => v - c[i]) as Vec3 })) };
}

const family: Family = {
  names: ["LÅNGFJÄLL", "LANGFJALL"],
  recipe(s) {
    if (!/conference chair/i.test(`${s.variant} ${s.slug ?? ""}`) || /tossberg/i.test(s.slug ?? "")) return null;
    return recipe(s);
  },
};
export default family;
