import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * GUNDE, read from the folding stool's manual. The stool comes assembled: the manual only shows opening it, legs
 * apart, then pressing the seat down at both ends until its two catches click, with fingers kept clear of the
 * hinges. The folding chair has no manual: it is sold assembled, so its guide only unfolds it.
 */

const TUBE = 18;

/** A round tube from a to b in the y-z plane, as a piece of the part centred at c. */
function tubeYZ(a: Vec3, b: Vec3, c: Vec3): PartPiece {
  const dy = b[1] - a[1], dz = b[2] - a[2];
  return { shape: "cyl", size: [TUBE, Math.hypot(dy, dz), TUBE], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot: [Math.atan2(dz, dy), 0, 0] };
}

function stool(s: ProductSpec): CustomParams {
  // IKEA: 34 wide, 32 deep, 45 high, seat 30 x 29
  const W = Math.round(s.size.w * 10) || 340, D = Math.round(s.size.d * 10) || 320, H = Math.round(s.size.h * 10) || 450;
  const sw = 300, sd = 290, st = 24;
  const ySeat = H - st;
  const c: Vec3 = [0, H / 2, 0];
  const xo = W / 2 - TUBE / 2, xi = xo - TUBE - 2;
  const zf = D / 2 - TUBE / 2;
  const frame: PartPiece[] = [
    // two crossing legs a side, the outer pair and the inner pair, with a rail along the floor at each end
    ...[-1, 1].flatMap((sx) => [tubeYZ([sx * xo, 0, -zf], [sx * xo, ySeat, zf - 30], c), tubeYZ([sx * xi, 0, zf], [sx * xi, ySeat, -zf + 30], c)]),
    { shape: "cyl", size: [TUBE, 2 * xo, TUBE], pos: [0, TUBE / 2 - c[1], -zf], rot: [0, 0, Math.PI / 2] },
    { shape: "cyl", size: [TUBE, 2 * xi, TUBE], pos: [0, TUBE / 2 - c[1], zf], rot: [0, 0, Math.PI / 2] },
    { shape: "box", size: [sw, st, sd], pos: [0, ySeat + st / 2 - c[1], 0], material: "board" },
    { shape: "box", size: [90, 4, 24], pos: [0, H + 1 - c[1], -sd / 2 + 40], material: "metal" },
  ];
  const parts: CustomPart[] = [{ id: "S", name: "Folding stool", size: [W, H, D], pos: c, pieces: frame, material: "metal" }];
  return {
    parts,
    steps: [
      {
        title: "Unfold the stool",
        detail: "It comes assembled. Hold it by the seat and let the legs swing apart until they stand on the floor.",
        add: ["S"],
        from: { S: [0, 200, 0] },
        warnings: ["hand"],
      },
      {
        title: "Press the seat down until it clicks",
        detail: "Push down at both ends of the seat: the two catches underneath click shut and lock it open. Keep your fingers away from the hinges.",
        warnings: ["hand"],
      },
    ],
  };
}


/**
 * The folding chair: a long frame from a loop on the floor at the front up into the backrest, a shorter frame from
 * a loop at the back up under the front of the seat, crossing it at the pivots, and the seat hinged between them.
 */
function chair(s: ProductSpec): CustomParams {
  // IKEA: 41 wide, 45 deep, 78 high, seat 45 high
  const W = Math.round(s.size.w * 10) || 410, D = Math.round(s.size.d * 10) || 450, H = Math.round(s.size.h * 10) || 780;
  const ys = 450, st = 30;
  const xo = W / 2 - TUBE / 2 - 20, xi = xo - TUBE - 4;
  const zf = D / 2 - TUBE / 2, zb = -D / 2 + TUBE / 2;
  const cB: Vec3 = [0, H / 2, 0], cI: Vec3 = [0, (ys - 20) / 2, 0];
  const main: PartPiece[] = [
    // each side: up from the front loop to the back of the seat, then straight up into the backrest
    ...[-1, 1].flatMap((g) => [tubeYZ([g * xo, TUBE / 2, zf], [g * xo, ys - 10, zb + 30], cB), tubeYZ([g * xo, ys - 10, zb + 30], [g * xo, H - 40, zb + 20], cB)]),
    { shape: "cyl", size: [TUBE, 2 * xo, TUBE], pos: [0, TUBE / 2 - cB[1], zf], rot: [0, 0, Math.PI / 2] },
  ];
  const inner: PartPiece[] = [
    ...[-1, 1].map((g) => tubeYZ([g * xi, TUBE / 2, zb], [g * xi, ys - 30, zf - 40], cI)),
    { shape: "cyl", size: [TUBE, 2 * xi, TUBE], pos: [0, TUBE / 2 - cI[1], zb], rot: [0, 0, Math.PI / 2] },
  ];
  const parts: CustomPart[] = [
    { id: "F", name: "Chair frame", size: [W - 40, H, D], pos: cB, pieces: main, material: "metal" },
    { id: "B", name: "Backrest", size: [W, 190, 24], pos: [0, H - 95, zb + 26], material: "board" },
    { id: "I", name: "Front leg frame", size: [2 * xi + TUBE, ys - 20, D], pos: cI, pieces: inner, material: "metal" },
    { id: "S", name: "Seat", size: [W - 40, st, D - 90], pos: [0, ys - st / 2, 10], material: "board" },
  ];
  return {
    parts,
    steps: [
      { title: "Take the folded chair out of the box", detail: "It comes assembled, with nothing to screw together. Stand it on the front loop of its frame.", add: ["F", "B"] },
      { title: "Swing the other legs out", detail: "Pull the bottom of the inner frame towards the back until both loops stand on the floor.", add: ["I"], from: { I: [0, 60, 300] }, warnings: ["hand"] },
      { title: "Press the seat down", detail: "Push it down flat until it rests on the frame. To fold the chair, lift the front edge of the seat; keep your fingers clear of the joints.", add: ["S"], from: { S: [0, 300, -150] }, warnings: ["hand"] },
    ],
  };
}

const family: Family = {
  names: ["GUNDE"],
  recipe(s) {
    if (/gunde-folding-stool/.test(s.slug ?? "")) return stool(s);
    if (/gunde-folding-chair/.test(s.slug ?? "")) return chair(s);
    return null;
  },
};
export default family;
