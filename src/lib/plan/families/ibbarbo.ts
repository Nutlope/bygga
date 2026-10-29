import type { Family } from "./family";
import type { CustomParams, PartPiece, ProductSpec } from "../../types";

/**
 * IBBARBO stool. IKEA sells it moulded in one piece with no assembly (there is no manual), so its guide only unpacks
 * it: a round seat on three wide legs.
 */

function stool(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10;
  const SD = W - 40, ST = 40; // seat
  const legW = 120, legT = 14, R = SD / 2 - legT / 2;
  const pieces: PartPiece[] = [{ shape: "cyl", size: [SD, ST, SD], pos: [0, H / 2 - ST / 2, 0] }];
  for (const a of [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3]) {
    // one leg at the front, two at the back, each a curved blade drawn flat, its face turned to the middle
    pieces.push({ shape: "box", size: [legW, H - ST + 10, legT], pos: [Math.sin(a) * R, -ST / 2 + 5, Math.cos(a) * R], rot: [0, a, 0] });
  }
  return {
    parts: [{ id: "S", name: "Stool", size: [W, H, W], pos: [0, H / 2, 0], material: "board", pieces }],
    steps: [
      {
        title: "Take the stool out of its wrapping",
        detail: "It comes moulded in one piece, with nothing to put together. Stand it on its three feet.",
        add: ["S"],
      },
      {
        title: "Stack the spares",
        detail: "Set one stool straight down on another, the legs in line, to keep extra ones out of the way.",
      },
    ],
  };
}

const family: Family = {
  names: ["IBBARBO"],
  recipe: (s) => (/stool/i.test(`${s.variant} ${s.slug ?? ""}`) ? stool(s) : null),
};
export default family;
