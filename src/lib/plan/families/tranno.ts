import type { Family } from "./family";
import type { CustomParams, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * TRÄNNÖ stool. IKEA sells it ready assembled (its page says so and has no assembly instructions): a white steel
 * frame of four splayed legs and an apron, with a solid pine seat that has a handle cut through it. The guide
 * only unpacks it and shows how it stacks.
 */

function stool(s: ProductSpec): CustomParams {
  const W = s.size.w * 10 || 330, H = s.size.h * 10 || 450;
  const ST = 20, top = H - ST;
  const seat = W - 30, L = 34, apron = 70;
  const c: Vec3 = [0, top / 2, 0];
  const legs: PartPiece[] = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz): PartPiece => {
      // each leg leans out a little towards its corner
      const xt = sx * (seat / 2 - L / 2), zt = sz * (seat / 2 - L / 2);
      const xb = sx * (W / 2 - L / 2), zb = sz * (W / 2 - L / 2);
      const len = Math.hypot(top, xb - xt, zb - zt);
      return { shape: "box", size: [L, len, L], pos: [(xt + xb) / 2, 0, (zt + zb) / 2], rot: [Math.atan2(zt - zb, top), 0, Math.atan2(xb - xt, top)] };
    }),
  );
  const aprons: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [seat - 2 * L, apron, 2], pos: [0, top / 2 - apron / 2, sz * (seat / 2 - 1)] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [2, apron, seat - 2 * L], pos: [sx * (seat / 2 - 1), top / 2 - apron / 2, 0] })),
  ];
  return {
    parts: [
      { id: "F", name: "Frame", size: [W, top, W], pos: c, pieces: [...legs, ...aprons], material: "metal" },
      { id: "S", name: "Seat", size: [seat, ST, seat], pos: [0, H - ST / 2, 0], pieces: [{ shape: "slab", size: [seat, ST, seat], pos: [0, 0, 0], outline: [[-seat / 2, -seat / 2], [seat / 2, -seat / 2], [seat / 2, seat / 2], [-seat / 2, seat / 2]], round: 30 }], material: "wood" },
    ],
    steps: [
      { title: "Unpack the stool", detail: "It comes ready assembled, so there is nothing to put together. Cut the wrapping carefully so the knife can't mark the seat.", add: ["F", "S"], from: { S: [0, 0, 0] } },
      { title: "Stack them if you need to", detail: "Up to four stools, each lowered straight onto the seat of the one below. It's for indoor use only." },
    ],
  };
}

const family: Family = {
  names: ["TRÄNNÖ", "TRANNO"],
  recipe: (s) => (/^tranno-stool/.test(s.slug ?? "") ? stool(s) : null),
};
export default family;
