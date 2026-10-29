import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SKARPÖ is moulded in one piece of plastic and has no assembly manual: there is nothing to put together. The guide
 * only sets it down, and shows that they stack.
 */

function armchair(s: ProductSpec): CustomParams {
  // IKEA: 81 wide, 79 deep, 71 high, seat 53 x 49 at 37
  const W = Math.round(s.size.w * 10) || 810, D = Math.round(s.size.d * 10) || 790, H = Math.round(s.size.h * 10) || 710;
  const ys = 370, sw = 530, sd = 490, th = 40;
  const c: Vec3 = [0, H / 2, 0];
  const p = (size: Vec3, at: Vec3, rot?: Vec3): PartPiece => ({ shape: "box", size, pos: [at[0] - c[0], at[1] - c[1], at[2] - c[2]], ...(rot ? { rot } : {}) });
  const zs = D / 2 - sd / 2 - 20; // the seat sits to the front
  // the tub: a back wall curving round from arm to arm, the seat shell inside it, rounded arm tops, four legs
  const R = W / 2 - th / 2; // the tub's radius in plan
  const zc = D / 2 - R - 10; // its centre, behind the seat's front
  const arc = Array.from({ length: 9 }, (_, k) => {
    const a = Math.PI * (k / 8); // from the left arm round the back to the right arm
    const x = -Math.cos(a) * R, z = zc - Math.sin(a) * R * 0.9;
    const seg = (Math.PI * R * 0.95) / 8 + 30;
    const yTop = ys + 190 + (H - ys - 190) * Math.sin(a);
    return p([seg, yTop - ys + 60, th], [x, (yTop + ys - 60) / 2, z], [0, Math.PI / 2 - a, 0]);
  });
  const pieces: PartPiece[] = [
    p([sw, th, sd], [0, ys - th / 2, zs]),
    ...arc,
    // the arms run forward from the tub's ends, rounded on top
    ...[-1, 1].flatMap((sx): PartPiece[] => [
      p([th, 250, D / 2 - zc + 10], [sx * R, ys + 65, (zc + D / 2) / 2]),
      { ...p([th + 30, D / 2 - zc + 10, th + 30], [sx * R, ys + 190, (zc + D / 2) / 2], [Math.PI / 2, 0, 0]), shape: "cyl" },
    ]),
    // four short splayed legs under the corners
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => p([80, ys - 40, 80], [sx * (W / 2 - 110), (ys - 40) / 2, sz * (D / 2 - 120)], [sz * -0.12, 0, sx * 0.12])),
    ),
  ];
  const parts: CustomPart[] = [{ id: "A", name: "Armchair", size: [W, H, D], pos: c, pieces, material: "board" }];
  return {
    parts,
    steps: [
      {
        title: "Lift the armchair out and set it down",
        detail: "It's moulded in one piece, so there is nothing to put together. Stand it on level ground; the hole in the seat lets rain drain away.",
        add: ["A"],
        from: { A: [0, 200, 0] },
      },
      {
        title: "Stack them when you don't need them",
        detail: "Lift one chair straight down onto another, seat on seat.",
      },
    ],
  };
}

const family: Family = {
  names: ["SKARPÖ", "SKARPO"],
  recipe(s) {
    if (/^skarpo-armchair/.test(s.slug ?? "")) return armchair(s);
    return null;
  },
};
export default family;
