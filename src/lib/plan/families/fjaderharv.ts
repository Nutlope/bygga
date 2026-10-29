import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec } from "../../types";

/**
 * FJÄDERHARV has no assembly manual: the paperboard mini chest comes put together, with packing inside the drawers.
 * The guide unpacks the casing, empties the drawers and slides them back in. The page gives 32 x 16 x 25 cm.
 */

const t = 3; // paperboard walls

function chest(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = 160; // from the product page
  const shell: PartPiece[] = [
    { shape: "box", size: [W, t, D], pos: [0, H / 2 - t / 2, 0] },
    { shape: "box", size: [W, t, D], pos: [0, -H / 2 + t / 2, 0] },
    { shape: "box", size: [t, H - 2 * t, D], pos: [-W / 2 + t / 2, 0, 0] },
    { shape: "box", size: [t, H - 2 * t, D], pos: [W / 2 - t / 2, 0, 0] },
    { shape: "box", size: [W - 2 * t, H - 2 * t, t], pos: [0, 0, -D / 2 + t / 2] },
    { shape: "box", size: [W - 2 * t, t, D - t], pos: [0, 0, t / 2] },
  ];
  const parts: CustomPart[] = [{ id: "case", name: "Casing", size: [W, H, D], pos: [0, H / 2, 0], pieces: shell }];
  const dw = W - 2 * t - 2, dh = H / 2 - 1.5 * t - 2, dd = D - t - 2;
  const drawer: PartPiece[] = [
    // the front, with the handle cut out shown as a dark strip
    { shape: "box", size: [dw, dh, t], pos: [0, 0, dd / 2 - t / 2] },
    { shape: "box", size: [dw / 4, dh / 6, 1], pos: [0, dh / 3, dd / 2 + 0.5], material: "metal" },
    { shape: "box", size: [dw, dh - 10, t], pos: [0, -5, -dd / 2 + t / 2] },
    { shape: "box", size: [t, dh - 10, dd - 2 * t], pos: [-dw / 2 + t / 2, -5, 0] },
    { shape: "box", size: [t, dh - 10, dd - 2 * t], pos: [dw / 2 - t / 2, -5, 0] },
    { shape: "box", size: [dw, t, dd], pos: [0, -dh / 2 + t / 2, 0] },
  ];
  [t + 1 + dh / 2, H / 2 + t / 2 + 1 + dh / 2].forEach((y, i) =>
    parts.push({ id: `D${i}`, name: "Drawer", size: [dw, dh, dd], pos: [0, y, t / 2 + 1], pieces: drawer }),
  );
  return {
    parts,
    steps: [
      {
        title: "Unpack the chest",
        detail: "It comes put together, so there's nothing to screw. Lift it out of the box and take off the wrapping.",
        add: ["case"],
        from: { case: [0, 250, 0] },
      },
      {
        title: "Empty the drawers and slide them back in",
        detail: "Pull each drawer out, take out the packing inside and push it back in until the front sits flush.",
        add: ["D0", "D1"],
        from: { D0: [0, 0, 220], D1: [0, 0, 220] },
      },
    ],
  };
}

const family: Family = {
  names: ["FJÄDERHARV", "FJADERHARV"],
  recipe(s) {
    if (/fjaderharv-mini-chest/.test(s.slug ?? "")) return chest(s);
    return null;
  },
};
export default family;
