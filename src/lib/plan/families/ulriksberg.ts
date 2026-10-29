import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ULRIKSBERG, read from the armchair's manual. The woven backrest stands upside down on a rug and the seat's tube
 * frame is bolted to its lower edge (two bolts). Upright, one steel side frame goes on: a peg on the seat into its
 * hole and a bolt through the back leg into the backrest. Upside down again, a bolt goes up through the side frame
 * into the seat, then the other side frame goes on with its two bolts. Felt pads go under the feet and, standing,
 * all six bolts are tightened with the Allen key.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, mate: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, mate, ...o });

const T = 25; // steel tube
const rod = (a: Vec3, b: Vec3, c: Vec3): PartPiece => {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const mid: Vec3 = [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]];
  // a cylinder stands along y; tip it forward or back (about x) or lay it along z
  return { shape: "cyl", size: [T, len, T], pos: mid, rot: [Math.atan2(d[2], d[1]), 0, 0] };
};

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 67 wide, 74 deep, 76 high, seat 37 high, arms 54 high and 6.2 wide
  const W = (s.size.w || 67) * 10, D = (s.size.d || 74) * 10, H = (s.size.h || 76) * 10;
  const xF = W / 2 - 31, yArm = 540, ySeat = 370;
  const zFront = D / 2 - 35, zFoot = -D / 2 + 15, zTop = -D / 2 + 130;
  const ySR = ySeat - 40 - T / 2; // the side frame's seat rail, under the seat's edge
  const backAt = (y: number) => zTop + ((zFoot - zTop) * (yArm - y)) / yArm; // the back leg, from the armrest down to the floor
  const side = (sx: number): CustomPart => {
    const x = sx * xF;
    const c: Vec3 = [x, yArm / 2 + 10, (zFront + zFoot) / 2];
    return {
      id: sx < 0 ? "L" : "R",
      name: "Side frame",
      size: [62, yArm + 20, zFront - zFoot + T],
      pos: c,
      material: "metal",
      pieces: [
        rod([x, 0, zFront], [x, yArm, zFront], c),
        rod([x, yArm, zTop], [x, 0, zFoot], c),
        rod([x, 200, zFront], [x, 200, backAt(200)], c),
        rod([x - sx * 8, ySR, zFront], [x - sx * 8, ySR, backAt(ySR)], c),
        { shape: "box", size: [62, 36, zFront - zTop + 40], pos: [0, yArm + 2 - c[1], (zFront + zTop) / 2 - c[2]], material: "wood" },
      ],
    };
  };
  // the backrest leans back from just behind the seat to the top
  const bBot = ySeat + 10, bz0 = -D / 2 + 140, bz1 = -D / 2 + 30;
  const lean = Math.atan2(bz0 - bz1, H - bBot);
  const bLen = Math.hypot(H - bBot, bz0 - bz1);
  const seatW = 2 * xF - 10, seatD = zFront - bz0 - 10;
  const zSeat = (zFront + bz0 + 10) / 2;
  const parts: CustomPart[] = [
    { id: "B", name: "Backrest", size: [2 * xF - 40, bLen, 30], pos: [0, (bBot + H) / 2, (bz0 + bz1) / 2], rot: [-lean, 0, 0], material: "wood" },
    {
      id: "S",
      name: "Seat",
      size: [seatW, 40, seatD],
      pos: [0, ySeat - 20, zSeat],
      material: "wood",
      pieces: [
        // the seat sits right on the side frames' seat rails, so the bolts up through them bite into it
        { shape: "box", size: [seatW, 40, seatD], pos: [0, 0, 0] },
        { shape: "cyl", size: [T, seatW - 60, T], pos: [0, -8, -seatD / 2 + 20], rot: [0, 0, Math.PI / 2], material: "metal" },
      ],
    },
    side(1),
    side(-1),
  ];
  const yBolt = yArm - 60;
  const backBolt = (sx: number) => fx("bolt", [[sx * xF, yBolt, backAt(yBolt)]], [-sx, 0, 0], sx < 0 ? "L" : "R", "B", { len: 30, dia: 6 });
  const seatBolt = (sx: number) => fx("bolt", [[sx * (xF - 8), ySR - T / 2, zFront - 60]], [0, 1, 0], sx < 0 ? "L" : "R", "S", { len: 30, dia: 6 });
  const feet: Vec3[] = [-1, 1].flatMap((sx) => [[sx * xF, 0, zFront], [sx * xF, 0, zFoot]] as Vec3[]);
  const steps: CustomStep[] = [
    {
      title: "Bolt the seat to the backrest",
      detail: "Stand the backrest upside down on a rug and lay the seat's tube frame on its lower edge. Turn both bolts in by hand only.",
      add: ["B", "S"],
      fix: [fx("bolt", [-1, 1].map((sx): Vec3 => [sx * 180, ySeat - 20, bz0 - 10]), [0, 1, 0], "S", "B", { len: 30, dia: 6 })],
      pose: "-y",
      warnings: ["floor", "loose"],
    },
    {
      title: "Fit the first side frame",
      detail: "Stand it upright. Push the peg on the seat into the hole in the frame, then turn a bolt through the back leg into the backrest.",
      add: ["R"],
      fix: [backBolt(1)],
      pose: "+y",
    },
    { title: "Bolt the frame to the seat", detail: "Tip the chair upside down and turn one bolt up through the frame into the seat.", fix: [seatBolt(1)], pose: "-y" },
    {
      title: "Fit the other side frame",
      detail: "Peg into its hole, then one bolt into the seat and one through the back leg into the backrest.",
      add: ["L"],
      fix: [seatBolt(-1), backBolt(-1)],
    },
    { title: "Stick felt pads under the feet", detail: "One on the end of each leg, pressed on firmly.", fix: [{ kind: "glide", count: 4, at: feet, dir: [0, 1, 0], name: "Felt pad" }] },
    { title: "Stand it up and tighten all the bolts", detail: "Check the chair stands level, then tighten all six bolts firmly.", pose: "+y", tools: ["allen"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["ULRIKSBERG"],
  recipe(s) {
    if (!/armchair/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return recipe(s);
  },
};
export default family;
