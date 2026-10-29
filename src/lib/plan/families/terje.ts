import type { Family } from "./family";
import type { CustomParams, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * TERJE folding chair. It comes fully assembled in solid beech and there is nothing to put together: the guide only
 * unfolds it and sets the seat down until it locks. Folded, it hangs on a hook through the hole in its back.
 */

function chair(s: ProductSpec): CustomParams {
  const W = (s.size.w || 44) * 10, H = (s.size.h || 79) * 10, D = (s.size.d || 50) * 10;
  const SY = 450, LT = 30;
  const xs = W / 2 - LT / 2;
  const box = (size: Vec3, pos: Vec3, rot?: Vec3): PartPiece => ({ shape: "box", size, pos: [pos[0], pos[1] - H / 2, pos[2]], ...(rot ? { rot } : {}), material: "wood" });
  // back legs run from the floor at the back up into the backrest; the front legs cross them under the seat
  const zb0 = -D / 2 + 30, zb1 = -D / 2 + 70;
  const backTilt = Math.atan2(zb1 - zb0, H);
  const zf0 = D / 2 - 20, zf1 = -D / 2 + 140;
  const frontLen = Math.hypot(zf1 - zf0, SY);
  const frontTilt = Math.atan2(zf1 - zf0, SY);
  const pieces: PartPiece[] = [
    ...[-1, 1].map((sx) => box([LT, H, LT], [sx * xs, H / 2, (zb0 + zb1) / 2], [backTilt, 0, 0])),
    ...[-1, 1].map((sx) => box([LT - 6, frontLen, LT - 6], [sx * (xs - LT), SY / 2, (zf0 + zf1) / 2], [frontTilt, 0, 0])),
    box([W - 2 * LT, 20, D - 110], [0, SY, 20]),
    box([W - 2 * LT, 120, 18], [0, H - 90, zb1 - 6]),
    ...[-1, 1].map((sx) => box([W - 2 * LT - 40, 22, 22], [0, 120, sx * 120])),
  ];
  return {
    parts: [{ id: "C", name: "Chair", size: [W, H, D], pos: [0, H / 2, 0], pieces, material: "wood" }],
    steps: [
      {
        title: "Unfold the chair",
        detail: "It comes fully assembled. Hold the backrest and pull the front legs forward until the chair stands on all four feet.",
        add: ["C"],
        from: { C: [0, 150, 0] },
      },
      {
        title: "Press the seat down until it sits flat",
        detail: "It rests on the rail between the legs. To fold it, lift the front of the seat; it hangs on a hook through the hole in the back.",
      },
    ],
  };
}

const family: Family = {
  names: ["TERJE"],
  recipe: (s) => (/folding chair/i.test(s.variant) ? chair(s) : null),
};
export default family;
