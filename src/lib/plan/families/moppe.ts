import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * MOPPE mini chest of drawers. IKEA sells it ready assembled (its page has no assembly instructions), so the guide
 * only unpacks it: the birch plywood case, then the drawers, which travel taped in place. The 31 cm chest has two
 * columns of three drawers; the 42 cm one has three small drawers on top, two below and one wide one at the bottom.
 */

const T = 9; // plywood
const FT = 6; // drawer fronts and sides

function chest(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const c: Vec3 = [0, H / 2, 0];
  const rel = (p: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const box = (size: Vec3, at: Vec3): PartPiece => ({ shape: "box", size, pos: rel(at) });
  const iw = W - 2 * T, ih = H - 2 * T;
  // rows from the top: how many drawers side by side in each
  const rows = W > 360 ? [3, 2, 1] : [2, 2, 2];
  const rh = (ih - 2 * 4) / 3; // two shelves of 4 mm between the rows
  const shell: PartPiece[] = [
    box([W, T, D], [0, H - T / 2, 0]),
    box([W, T, D], [0, T / 2, 0]),
    box([T, ih, D], [-W / 2 + T / 2, H / 2, 0]),
    box([T, ih, D], [W / 2 - T / 2, H / 2, 0]),
    box([iw, ih, 3], [0, H / 2, -D / 2 + 1.5]),
    ...[1, 2].map((k) => box([iw, 4, D - 3], [0, H - T - k * rh - (k - 0.5) * 4, 1.5])),
  ];
  const parts: CustomPart[] = [{ id: "C", name: "Chest", size: [W, H, D], pos: c, pieces: shell, material: "wood" }];
  const dd = D - 3 - 4;
  const ids: string[] = [];
  rows.forEach((n, r) => {
    const top = H - T - r * (rh + 4);
    const w = (iw - (n - 1) * 2) / n;
    for (let i = 0; i < n; i++) {
      const x = -iw / 2 + w / 2 + i * (w + 2);
      const y = top - rh / 2;
      const id = `D${r}${i}`;
      const h = rh - 2, dw = w - 1;
      const dc: Vec3 = [x, y, D / 2 - dd / 2];
      const pc = (size: Vec3, at: Vec3): PartPiece => ({ shape: "box", size, pos: [at[0] - dc[0], at[1] - dc[1], at[2] - dc[2]] });
      parts.push({
        id,
        name: n === 1 ? "Wide drawer" : n === 2 ? "Drawer" : "Small drawer",
        size: [dw, h, dd],
        pos: dc,
        material: "wood",
        pieces: [
          pc([dw, h, FT], [x, y, D / 2 - FT / 2]),
          pc([dw, h - 20, FT], [x, y - 10, D / 2 - dd + FT / 2]),
          pc([FT, h - 20, dd - 2 * FT], [x - dw / 2 + FT / 2, y - 10, D / 2 - dd / 2]),
          pc([FT, h - 20, dd - 2 * FT], [x + dw / 2 - FT / 2, y - 10, D / 2 - dd / 2]),
          pc([dw - 2 * FT, 3, dd - 2 * FT], [x, y - h / 2 + 1.5, D / 2 - dd / 2]),
        ],
      });
      ids.push(id);
    }
  });
  const from = Object.fromEntries(ids.map((id) => [id, [0, 0, 220] as Vec3]));
  return {
    parts,
    steps: [
      { title: "Unpack the chest", detail: "It comes ready assembled, so there is nothing to put together. Cut the wrapping carefully so the knife can't mark the wood.", add: ["C"] },
      { title: "Take the drawers out and remove the packing", detail: `Pull out all ${ids.length} drawers and take out the tape and card that hold them still in the box.`, kind: "drawer" },
      { title: "Slide the drawers back in", detail: "Each one into its own opening, the finger notch at the top. They should run freely without forcing.", add: ids, from, kind: "drawer" },
    ],
  };
}

const family: Family = {
  names: ["MOPPE"],
  recipe: (s) => (/^moppe-mini-chest/.test(s.slug ?? "") ? chest(s) : null),
};
export default family;
