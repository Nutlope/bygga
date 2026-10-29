import type { Family } from "./family";
import type { CustomParams, ProductSpec } from "../../types";

/**
 * ALSEDA has no assembly manual: the stool is hand-woven from banana fibre in one piece and comes ready to use.
 * The guide only unwraps it and sets it down. Its page gives a 60 cm diameter and 18 cm height.
 */

function stool(s: ProductSpec): CustomParams {
  const H = s.size.h * 10;
  const R = 600; // diameter, from the product page
  return {
    parts: [
      {
        id: "seat",
        name: "Stool",
        size: [R, H, R],
        pos: [0, H / 2, 0],
        material: "wood",
        // a woven pad: a fuller middle and softer, rounder top and bottom edges
        pieces: [
          { shape: "cyl", size: [R, H - 50, R], pos: [0, 0, 0] },
          { shape: "cyl", size: [R - 50, H, R - 50], pos: [0, 0, 0] },
        ],
      },
    ],
    steps: [
      {
        title: "Take the stool out of its wrapping",
        detail: "It comes woven in one piece, so there's nothing to put together. Cut the wrapping away carefully so the knife doesn't catch the fibre.",
        add: ["seat"],
        from: { seat: [0, 300, 0] },
      },
      { title: "Set it down where you want it", detail: "Keep it away from damp floors and strong sun, which dry out and fade the fibre." },
    ],
  };
}

const family: Family = {
  names: ["ALSEDA"],
  recipe(s) {
    if (/alseda-stool/.test(s.slug ?? "")) return stool(s);
    return null;
  },
};
export default family;
