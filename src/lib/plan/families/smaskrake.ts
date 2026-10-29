import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SMÅSKRAKE (child's chair that turns over into a lower chair or a table), from its manual. Three dowels go into the
 * seat's back edge and the seat is pressed down onto the backrest lying flat. With it on its side, a steel side frame
 * is laid on and bolted to both boards with four bolts; turned over, the other frame takes four more.
 */

const T = 20; // tube

function recipe(_s: ProductSpec): CustomParams {
  // IKEA: 39 x 39 x 39 (one size), seat 16 cm high this way up (25 cm turned over)
  const W = 390, H = 390, D = 390;
  const BT = 18, fx0 = W / 2 - T / 2, fz = D / 2 - T / 2;
  const bw = 2 * (fx0 - T / 2); // the boards fit between the frames
  const seatTop = 160, sy = seatTop - BT / 2;
  const zb = -D / 2 + T / 2; // the backrest, in line with the frames' back tubes
  const seatZ0 = zb + BT / 2, seatD = D / 2 - seatZ0;
  const bars = [sy, sy - 70]; // the two bars along each side frame
  const frame: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "cyl", size: [T, H - T, T], pos: [0, 0, g * fz] })),
    ...[T / 2, H - T / 2].map((y): PartPiece => ({ shape: "cyl", size: [T, D, T], pos: [0, y - H / 2, 0], rot: [Math.PI / 2, 0, 0] })),
    ...bars.map((y): PartPiece => ({ shape: "cyl", size: [T, 2 * fz - T, T], pos: [0, y - H / 2, 0], rot: [Math.PI / 2, 0, 0] })),
  ];
  const parts: CustomPart[] = [
    { id: "B", name: "Backrest", size: [bw, H - T, BT], pos: [0, H / 2, zb], material: "wood" },
    { id: "S", name: "Seat", size: [bw, BT, seatD], pos: [0, sy, seatZ0 + seatD / 2], material: "wood" },
    { id: "FR", name: "Side frame", size: [T, H, D], pos: [fx0, H / 2, 0], material: "metal", pieces: frame },
    { id: "FL", name: "Side frame", size: [T, H, D], pos: [-fx0, H / 2, 0], material: "metal", pieces: frame },
  ];
  // two bolts through the bar into the seat's end, two through the back tube into the backrest's end
  const bolts = (g: number): CustomFix[] => [
    { kind: "bolt", count: 2, len: 40, dia: 6, on: g > 0 ? "FR" : "FL", mate: "S", at: [-40, 120].map((z): Vec3 => [g * (W / 2), sy, z]), dir: [-g, 0, 0] },
    { kind: "bolt", count: 2, len: 40, dia: 6, on: g > 0 ? "FR" : "FL", mate: "B", at: [230, 330].map((y): Vec3 => [g * (W / 2), y, zb]), dir: [-g, 0, 0] },
  ];
  return {
    parts,
    steps: [
      {
        title: "Tap the dowels into the seat",
        detail: "Three, into the holes along its back edge.",
        add: ["S"],
        fix: [{ kind: "dowel", count: 3, len: 30, dia: 8, on: "S", mate: "B", at: [-110, 0, 110].map((x): Vec3 => [x, sy, seatZ0]), dir: [0, 0, -1] }],
        pose: "+z",
        warnings: ["floor"],
        wait: ["S"],
      },
      {
        title: "Press the seat onto the backrest",
        detail: "Lay the backrest flat on a rug and push the seat's dowels straight down into its holes.",
        add: ["B", "S"],
      },
      {
        title: "Bolt on one side frame",
        detail: "Turn it onto its side, lay the frame on and drive in four bolts with the key. Push each one in by hand first so it starts straight.",
        add: ["FR"],
        fix: bolts(1),
        tools: ["allen"],
        pose: "+x",
      },
      { title: "Turn it over and bolt on the other frame", detail: "Four more bolts the same way, then tighten all eight.", add: ["FL"], fix: bolts(-1), tools: ["allen"], pose: "-x" },
      { title: "Stand it up", detail: "This way up it's a low chair. Turn it over for a higher seat, or onto its back for a small table.", pose: "+y" },
    ],
  };
}

const family: Family = { names: ["SMÅSKRAKE", "SMASKRAKE"], recipe };
export default family;
