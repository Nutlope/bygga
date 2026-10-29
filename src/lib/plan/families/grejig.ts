import type { Family } from "./family";
import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";

/**
 * GREJIG shoe rack, read from its manual: one steel wire shelf with a folding leg frame at each end, sold folded.
 * Turned upside down, both leg frames swing out until they click; up to three racks stack on each other. Nothing
 * to screw.
 */

/** Euler angles (x then z) that turn a part's y axis onto d. */
function along(d: Vec3): Vec3 {
  const n = Math.hypot(...d);
  const [x, y, z] = [d[0] / n, d[1] / n, d[2] / n];
  return [Math.atan2(z, y), 0, Math.atan2(-x, Math.hypot(y, z))];
}

function wire(a: Vec3, b: Vec3, dia: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return { shape: "cyl", size: [dia, Math.hypot(...d), dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: along(d) };
}

function build(b: PlanBuilder, s: ProductSpec) {
  const W = Math.round(s.size.w * 10) || 580, D = Math.round(s.size.d * 10) || 270, H = Math.round(s.size.h * 10) || 170;
  const yS = H - 6; // the shelf's rim
  const xr = W / 2 - 4, zr = D / 2 - 4;
  const shelf: PartPiece[] = [
    wire([-xr, yS, -zr], [xr, yS, -zr], 7),
    wire([-xr, yS, zr], [xr, yS, zr], 7),
    wire([-xr, yS, -zr], [-xr, yS, zr], 7),
    wire([xr, yS, -zr], [xr, yS, zr], 7),
  ];
  for (let k = 1; k < 8; k++) {
    const z = -zr + (2 * zr * k) / 8;
    shelf.push(wire([-xr, yS - 3, z], [xr, yS - 3, z], 4));
  }
  for (let k = 1; k < 22; k++) {
    const x = -xr + (2 * xr * k) / 22;
    shelf.push(wire([x, yS + 2, -zr], [x, yS + 2, zr], 3));
  }
  const S = b.compound("Shelf", shelf, { material: "metal" });
  const shelfKey = b.place(S.type, S.mid);
  // each leg frame hangs from a hinge bar under the end of the shelf and splays in a little to its feet
  const yH = yS - 10;
  const legs = ([-1, 1] as const).map((g) => {
    const xh = g * (W / 2 - 18), xf = g * (W / 2 - 40), zl = D / 2 - 16;
    const pieces: PartPiece[] = [wire([xh, yH, -zl], [xh, yH, zl], 6), wire([xf, 5, -zl], [xf, 5, zl], 6)];
    for (const sz of [-1, 1]) pieces.push(wire([xh, yH, sz * zl], [xf, 5, sz * zl], 6));
    const L = b.compound("Leg frame", pieces, { material: "metal" });
    const key = b.place(L.type, L.mid);
    // folded flat under the shelf: turned a quarter about the hinge bar
    const c = -g * (Math.PI / 2);
    const v: Vec3 = [L.mid[0] - xh, L.mid[1] - yH, 0];
    const folded: Vec3 = [xh + v[0] * Math.cos(c) - v[1] * Math.sin(c), yH + v[0] * Math.sin(c) + v[1] * Math.cos(c), L.mid[2]];
    return { key, folded, rot: [0, 0, c] as Vec3 };
  });
  b.step({ title: "Lay the rack upside down", detail: "Lay it on a rug with the legs folded flat against the shelf.", kind: "general", pose: "-y", warnings: ["floor"] }, () => {
    b.add(shelfKey);
    for (const l of legs) b.stage(l.key, l.folded, l.rot);
  });
  b.step({ title: "Fold out both leg frames", detail: "Swing each one up until it clicks into place. Pull on it to check it's locked.", kind: "legs", pose: "-y" }, () => {
    for (const l of legs) b.add(l.key);
  });
  b.step({ title: "Turn it over", detail: "Stand it on its feet. Up to three racks stack on top of each other, no more. Don't sit or stand on it.", kind: "general", pose: "+y" }, () => b.wait(0.4));
  return true;
}

const family: Family = {
  names: ["GREJIG"],
  build(b, s) {
    if (!/shoe rack/i.test(s.variant)) return false;
    return build(b, s);
  },
};
export default family;
