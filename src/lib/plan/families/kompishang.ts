import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * KOMPISHÄNG desk and side table: solid pine tops on folding powder-coated steel frames. IKEA sells both ready
 * assembled (their pages have no assembly instructions), so the guides only unfold them: the desk's legs fold out
 * from under the top and lock with their braces, the side table's top tips up level on its frame.
 */

/** A round rod from a to b (mm, relative to its part's centre). */
function rod(a: Vec3, b: Vec3, d: number): PartPiece {
  const v: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...v);
  return { shape: "cyl", size: [d, len, d], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(v[2], v[1]), 0, Math.asin(-v[0] / len)] };
}

function desk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const tt = 25, yT = H - tt, tube = 25, lx = W / 2 - 60, lz = D / 2 - 50;
  // each end frame: two legs joined by a rail under the top and a folding brace up to the apron
  const frame = (id: string, sx: -1 | 1): CustomPart => ({
    id,
    name: "Leg frame",
    size: [80, yT, D - 60],
    pos: [sx * lx, yT / 2, 0],
    material: "metal",
    pieces: [
      ...[-1, 1].map((sz) => rod([0, -yT / 2, sz * lz], [0, yT / 2 - tube / 2, sz * lz], tube)),
      rod([0, yT / 2 - tube / 2, -lz], [0, yT / 2 - tube / 2, lz], tube),
      rod([0, yT / 2 - 230, lz], [-sx * 70, yT / 2 - 12, lz - 40], 12),
    ],
  });
  const top: CustomPart = {
    id: "T",
    name: "Desk top",
    size: [W, tt + 60, D],
    pos: [0, H - (tt + 60) / 2, 0],
    material: "wood",
    pieces: [
      { shape: "box", size: [W, tt, D], pos: [0, 30, 0] },
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [W - 220, 60, 20], pos: [0, -tt / 2, sz * (D / 2 - 40)], material: "metal" })),
    ],
  };
  return {
    parts: [top, frame("A", -1), frame("B", 1)],
    steps: [
      { title: "Lay the folded desk upside down", detail: "It comes assembled. Lay it top down on a rug, the legs folded flat against the underside.", add: ["T"], pose: "-y", warnings: ["floor"] },
      { title: "Fold out the legs at one end", detail: "Swing the leg frame up until it stands straight, then push its brace until it clicks into place.", add: ["A"], from: { A: [0, 0, -300] } },
      { title: "Fold out the other end", detail: "The same way. Check both braces have clicked.", add: ["B"], from: { B: [0, 0, -300] } },
      { title: "Turn the desk over together", detail: "Stand it on its feet. To fold it, press the braces open and fold the legs in.", pose: "+y", people: 2, warnings: ["two"] },
    ],
  };
}

function sideTable(s: ProductSpec): CustomParams {
  const Dd = s.size.w * 10, H = s.size.h * 10;
  const tt = 22, yT = H - tt, tube = 20, R = Dd / 2 - 40;
  const ring: PartPiece[] = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * 2 * Math.PI, c = ((i + 1) / 16) * 2 * Math.PI;
    return rod([R * Math.cos(a), -yT / 2 + 10, R * Math.sin(a)], [R * Math.cos(c), -yT / 2 + 10, R * Math.sin(c)], tube);
  });
  const frame: CustomPart = {
    id: "F",
    name: "Frame",
    size: [2 * R + tube, yT, 2 * R + tube],
    pos: [0, yT / 2, 0],
    material: "metal",
    pieces: [
      ...ring,
      ...[-1, 1].map((sz) => rod([R * 0.8, -yT / 2 + 10, sz * R * 0.6], [R * 0.8, yT / 2 - 20, sz * R * 0.3], tube)),
      rod([R * 0.8, yT / 2 - 20, -R * 0.3], [R * 0.8, yT / 2 - 20, R * 0.3], tube),
      rod([R * 0.8, yT / 2 - 20, 0], [-R * 0.3, yT / 2 - 10, 0], 14),
    ],
  };
  const top: CustomPart = { id: "T", name: "Table top", size: [Dd, tt, Dd], pos: [0, H - tt / 2, 0], material: "wood", pieces: [{ shape: "cyl", size: [Dd, tt, Dd], pos: [0, 0, 0] }] };
  return {
    parts: [frame, top],
    steps: [
      { title: "Stand the folded table up", detail: "It comes assembled, with the top folded down beside the frame. Stand it on its ring.", add: ["F"] },
      { title: "Tip the top up level", detail: "Lift it until it lies flat and the bracket underneath locks. To fold it, release the bracket and let the top down.", add: ["T"], from: { T: [-220, -200, 0] } },
    ],
  };
}

const family: Family = {
  names: ["KOMPISHÄNG", "KOMPISHANG"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^kompishang-desk/.test(slug)) return desk(s);
    if (/^kompishang-side-table/.test(slug)) return sideTable(s);
    return null;
  },
};
export default family;
