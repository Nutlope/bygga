import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SOLUPPGÅNG. The outdoor stool is sold assembled, with no manual: two eucalyptus leg frames pivot on bolts and
 * cross in an X, and the canvas seat hangs between their top bars. Its guide only opens it out.
 */

/** A leg running from a to b in the x-y plane (mm, relative to the part's middle). */
function legXY(a: Vec3, b: Vec3, t = 32): PartPiece {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return { shape: "box", size: [t, Math.hypot(dx, dy), t], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2]], rot: [0, 0, -Math.atan2(dx, dy)] };
}

function stool(s: ProductSpec): CustomParams {
  // IKEA: 43 long, 38 wide, 40 high, seat 32 x 32.5
  const W = Math.round(s.size.w * 10) || 430, H = Math.round(s.size.h * 10) || 400, D = Math.round(s.size.d * 10) || 380;
  const bar = 36; // the top bars the canvas is wrapped round
  const yb = H - bar / 2;
  const xt = W / 2 - bar / 2, xf = W / 2 - 20; // top bars, feet
  const zo = D / 2 - 16, zi = zo - 34; // outer frame's legs, inner frame's legs
  // one frame: two legs from its top bar on one side down to the floor on the other, a rail low down between them
  const frame = (sx: number, z: number): PartPiece[] => [
    ...[-1, 1].map((g) => legXY([sx * xt, yb, g * z], [-sx * xf, 0, g * z])),
    { shape: "box", size: [bar, bar, 2 * zo + 32], pos: [sx * xt, yb, 0] },
    { shape: "box", size: [28, 44, 2 * z - 32], pos: [-sx * (xf - 60), 70, 0] },
  ];
  const c: Vec3 = [0, H / 2, 0];
  const rel = (ps: PartPiece[]) => ps.map((p): PartPiece => ({ ...p, pos: [p.pos[0], p.pos[1] - c[1], p.pos[2]] }));
  const parts: CustomPart[] = [
    { id: "O", name: "Outer leg frame", size: [W, H, D], pos: c, pieces: rel(frame(-1, zo)), material: "wood" },
    { id: "I", name: "Inner leg frame", size: [W, H, 2 * zi + 32], pos: c, pieces: rel(frame(1, zi)), material: "wood" },
    { id: "S", name: "Canvas seat", size: [2 * xt - bar, 4, 325], pos: [0, H - 6, 0], material: "soft" },
  ];
  return {
    parts,
    steps: [
      { title: "Stand the folded stool on its feet", detail: "It comes assembled, with nothing to screw together: the two leg frames lie together and the canvas hangs loose.", add: ["O"] },
      { title: "Pull the top bars apart", detail: "Hold a top bar in each hand and open the legs until the canvas is pulled tight. Keep your fingers clear of the pivots.", add: ["I", "S"], from: { I: [-200, 0, 0], S: [-100, -120, 0] }, warnings: ["hand"] },
      { title: "Check it stands steady", detail: "All four feet on the floor and the seat taut. To fold it, push the top bars together." },
    ],
  };
}

const family: Family = {
  names: ["SOLUPPGÅNG", "SOLUPPGANG"],
  recipe(s) {
    if (/stool/i.test(s.variant) || /soluppgang-stool/.test(s.slug ?? "")) return stool(s);
    return null;
  },
};
export default family;
