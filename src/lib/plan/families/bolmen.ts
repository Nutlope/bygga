import type { Family } from "./family";
import type { CustomParams, PartPiece, ProductSpec } from "../../types";

/*
 * BOLMEN step stool. IKEA sells it moulded in one piece with no assembly manual (the page lists none), so the guide
 * only unpacks it and stands it up. IKEA's sizes: 44 wide, 35 deep, 25 high to the step.
 */

function recipe(s: ProductSpec): CustomParams {
  const W = 440, D = 350, H = 250, T = 20;
  const pieces: PartPiece[] = [
    { shape: "box", size: [W, T, D], pos: [0, H - T / 2, 0], material: "board" },
    // the two splayed sides it stands on, open in the middle
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [T, H - T, D - 30], pos: [g * (W / 2 - 40), (H - T) / 2, 0], material: "board" })),
    // the grip ribs moulded into the step
    ...[-2, -1, 0, 1, 2].map((k): PartPiece => ({ shape: "box", size: [W - 80, 2, 14], pos: [0, H + 1, k * 50], material: "soft" })),
  ];
  return {
    parts: [{ id: "S", name: "Step stool", size: [W, H + 2, D], pos: [0, (H + 2) / 2, 0], material: "board", pieces }],
    steps: [
      { title: "Take the stool out of its wrapping", detail: "It comes moulded in one piece, so there is nothing to put together. Peel off any labels.", add: ["S"], from: { S: [0, 200, 0] } },
      { title: "Stand it on a flat, dry floor", detail: "Check it stands steady before you step on it. It takes up to 100 kg." },
    ],
  };
}

const family: Family = {
  names: ["BOLMEN"],
  recipe(s) {
    return /^bolmen-step-stool/.test(s.slug ?? "") ? recipe(s) : null;
  },
};
export default family;
