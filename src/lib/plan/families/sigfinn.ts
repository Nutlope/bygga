import type { Family } from "./family";
import type { CustomParams, PartPiece, ProductSpec } from "../../types";

/*
 * SIGFINN monitor stand, fixed height. It is one bent bamboo-veneer board, sold ready to use with no assembly manual
 * (the page lists none), so the guide only unpacks it and sets it on the desk. IKEA's sizes: 53 long, 24 deep, 10 high.
 */

function recipe(s: ProductSpec): CustomParams {
  const L = 530, D = 240, H = 100, T = 12;
  const pieces: PartPiece[] = [
    { shape: "box", size: [L - 2 * T, T, D], pos: [0, H - T / 2, 0], material: "wood" },
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [T, H, D], pos: [g * (L / 2 - T / 2), H / 2, 0], material: "wood" })),
  ];
  return {
    parts: [{ id: "S", name: "Monitor stand", size: [L, H, D], pos: [0, H / 2, 0], material: "wood", pieces }],
    steps: [
      { title: "Take the stand out of its wrapping", detail: "It comes in one piece, ready to use: there is nothing to put together.", add: ["S"], from: { S: [0, 200, 0] } },
      { title: "Set it on your desk", detail: "Centre it under the monitor. Keep its feet on a flat surface." },
    ],
  };
}

const family: Family = {
  names: ["SIGFINN"],
  recipe(s) {
    return /^sigfinn-monitor-stand-fixed-height/.test(s.slug ?? "") ? recipe(s) : null;
  },
};
export default family;
