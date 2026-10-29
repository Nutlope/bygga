import type { Family } from "./family";
import type { CustomParams, PartPiece, ProductSpec } from "../../types";

/**
 * JUTEBODA stool: a woven seat on three white steel legs. IKEA sells it ready made (its page has no assembly
 * instructions), so its guide only unpacks it.
 */
function stool(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 410, H = Math.round(s.size.h * 10) || 450, D = Math.round(s.size.d * 10) || 370;
  const st = 50, yS = H - st;
  // a rounded triangle, its point at the front
  const tri: [number, number][] = [[-W / 2, -D / 2], [W / 2, -D / 2], [0, D / 2]];
  const legAt = tri.map(([x, z]) => [x * 0.8, z * 0.8 - (z > 0 ? 10 : -10)] as [number, number]);
  const pieces: PartPiece[] = [
    { shape: "slab", size: [W, st, D], pos: [0, H / 2 - st / 2, 0], outline: tri, round: 70 },
    ...legAt.map(([x, z]): PartPiece => ({ shape: "cyl", size: [22, yS, 22], pos: [x, yS / 2 - H / 2, z] })),
  ];
  return {
    parts: [{ id: "S", name: "Stool", size: [W, H, D], pos: [0, H / 2, 0], material: "wood", pieces }],
    steps: [
      { title: "Unpack the stool", detail: "It comes ready made, so there is nothing to put together. Take off all the packaging.", add: ["S"], from: { S: [0, 300, 0] } },
      { title: "Check it stands steady", detail: "All three feet should touch the floor. Keep the woven seat dry and away from direct sun." },
    ],
  };
}

const family: Family = {
  names: ["JUTEBODA"],
  recipe(s) {
    if (/^juteboda-stool/.test(s.slug ?? "")) return stool(s);
    return null;
  },
};
export default family;
