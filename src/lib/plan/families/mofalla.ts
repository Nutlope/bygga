import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * MOFALLA folding easy chair. IKEA sells it ready to use, with no assembly manual: two chrome tube frames hinged where
 * they cross, a canvas seat and back. So the guide only unfolds it: lift it out folded, swing the seat frame open until
 * the seat lies taut, and stand it up.
 */

const TUBE = 20;

/** A tube from a to b in the y-z plane, centred relative to c. */
function tube(a: Vec3, b: Vec3, c: Vec3): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const rot: Vec3 = Math.abs(d[0]) > Math.abs(d[1]) && Math.abs(d[0]) > Math.abs(d[2]) ? [0, 0, Math.PI / 2] : [Math.atan2(d[2], d[1]), 0, 0];
  return { shape: "cyl", size: [TUBE, Math.round(len + TUBE), TUBE], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot };
}

/** A frame of tubes, placed where they sit in the unfolded chair. */
function frame(id: string, name: string, segs: [Vec3, Vec3][]): CustomPart {
  const pts = segs.flat();
  const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])) - TUBE / 2);
  const hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])) + TUBE / 2);
  const c = lo.map((v, i) => (v + hi[i]) / 2) as Vec3;
  return { id, name, size: hi.map((v, i) => v - lo[i]) as Vec3, pos: c, material: "metal", pieces: segs.map(([a, b]) => tube(a, b, c)) };
}

function chair(s: ProductSpec): CustomParams {
  // IKEA: 58 wide, 57 deep, 74 high, seat 42 high
  const W = s.size.w * 10 || 580, D = s.size.d * 10 || 570, H = s.size.h * 10 || 740;
  const ySeat = 420, y0 = TUBE / 2;
  const xa = W / 2 - TUBE / 2, xb = xa - TUBE - 4; // the back frame outside, the seat frame inside it
  const zF = D / 2 - TUBE / 2, zB = -D / 2 + TUBE / 2;
  // back frame: from the floor at the front, up and back to the top of the backrest, a bar along the floor in front
  const topZ = zB + 50;
  const back = frame("A", "Back frame", [
    [[-xa, y0, zF], [-xa, H - y0, topZ]],
    [[xa, y0, zF], [xa, H - y0, topZ]],
    [[-xa, y0, zF], [xa, y0, zF]],
    [[-xa, H - y0, topZ], [xa, H - y0, topZ]],
  ]);
  // seat frame: from the floor at the back, up and forward to the front edge of the seat
  const seatZ = zF - 60;
  const seatFrame = frame("B", "Seat frame", [
    [[-xb, y0, zB], [-xb, ySeat, seatZ]],
    [[xb, y0, zB], [xb, ySeat, seatZ]],
    [[-xb, y0, zB], [xb, y0, zB]],
    [[-xb, ySeat, seatZ], [xb, ySeat, seatZ]],
  ]);
  // the canvas: the seat from the front bar back to the back frame, the back between its uprights
  const seatBack = zB + 170, seatDrop = 30;
  const seatLen = Math.hypot(seatZ - seatBack, seatDrop);
  const seat: CustomPart = {
    id: "S",
    name: "Seat",
    size: [2 * xb - TUBE, 3, Math.round(seatLen)],
    pos: [0, ySeat - seatDrop / 2, (seatZ + seatBack) / 2],
    rot: [-Math.atan2(seatDrop, seatZ - seatBack), 0, 0],
    material: "soft",
  };
  const bTop = H - 40, bBot = H - 300;
  const zAt = (y: number) => zF + ((topZ - zF) * (y - y0)) / (H - 2 * y0);
  const backLen = Math.hypot(bTop - bBot, zAt(bTop) - zAt(bBot));
  const backrest: CustomPart = {
    id: "K",
    name: "Back",
    size: [2 * xa - TUBE, Math.round(backLen), 3],
    pos: [0, (bTop + bBot) / 2, (zAt(bTop) + zAt(bBot)) / 2 - TUBE / 2],
    rot: [Math.atan2(zAt(bTop) - zAt(bBot), bTop - bBot), 0, 0],
    material: "soft",
  };
  return {
    parts: [back, backrest, seatFrame, seat],
    steps: [
      {
        title: "Lift the chair out of the box",
        detail: "It comes folded and ready to use: nothing to screw together. Stand it on its back frame.",
        add: ["A", "K"],
      },
      {
        title: "Swing the seat frame open",
        detail: "Pull the seat frame away from the back frame until both stand on the floor and the canvas seat is taut. Keep your fingers clear of the hinges.",
        add: ["B", "S"],
        from: { B: [0, 260, 260], S: [0, 260, 260] },
        warnings: ["hand"],
      },
      { title: "Check it stands steady", detail: "Press down on the seat: all four floor bars should touch the floor. To fold it, lift the front of the seat." },
    ],
  };
}

const family: Family = {
  names: ["MOFALLA"],
  recipe(s) {
    if (/chair/i.test(s.variant) || /mofalla/.test(s.slug ?? "")) return chair(s);
    return null;
  },
};
export default family;
