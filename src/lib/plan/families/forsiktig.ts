import type { Family } from "./family";
import type { CustomParams, ProductSpec } from "../../types";

/**
 * FÖRSIKTIG children's stool: one moulded plastic step with an anti-slip top and rubber edging underneath. It comes
 * ready to use (IKEA lists no manual), so the guide only unpacks it and checks it stands firm. Drawn to IKEA's
 * measurements, 37 x 24 cm and 13 cm high.
 */

function recipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10), D = Math.round(s.size.d * 10);
  const H = 130, t = 14;
  const top = { shape: "slab" as const, size: [W - 20, t, D - 20] as [number, number, number], pos: [0, H / 2 - t / 2, 0] as [number, number, number], outline: [[-(W - 20) / 2, -(D - 20) / 2], [(W - 20) / 2, -(D - 20) / 2], [(W - 20) / 2, (D - 20) / 2], [-(W - 20) / 2, (D - 20) / 2]] as [number, number][], round: 40 };
  return {
    parts: [
      {
        id: "S",
        name: "Stool",
        size: [W, H, D],
        pos: [0, H / 2, 0],
        material: "board",
        pieces: [
          top,
          // the two ends flare out to the floor, each with a finger hole
          ...[-1, 1].map((g) => ({ shape: "box" as const, size: [16, H - t, D - 10] as [number, number, number], pos: [g * (W / 2 - 14), -t / 2, 0] as [number, number, number], rot: [0, 0, g * 0.12] as [number, number, number] })),
          ...[-1, 1].map((g) => ({ shape: "box" as const, size: [W - 60, H - t - 10, 8] as [number, number, number], pos: [0, -t / 2 + 5, g * (D / 2 - 10)] as [number, number, number] })),
        ],
      },
      { id: "P", name: "Anti-slip top", size: [W - 60, 2, D - 60], pos: [0, H + 1, 0], material: "soft", extra: true },
    ],
    steps: [
      { title: "Take the stool out of its packing", detail: "It comes in one piece, ready to use.", add: ["S", "P"] },
      { title: "Check it stands firm", detail: "Stand it on a dry, flat floor so the rubber edge underneath grips. Keep the top clean so it stays non-slip." },
    ],
  };
}

const family: Family = {
  names: ["FÖRSIKTIG", "FORSIKTIG"],
  recipe(s) {
    if (!/stool/i.test(s.variant)) return null;
    return recipe(s);
  },
};
export default family;
