import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, Vec3 } from "../../types";

/**
 * FROST drying rack, in/outdoor. It comes in one piece, folded flat, and IKEA has no assembly manual for it: the two
 * wire leg frames open out into an X and the two wings fold out at the top. The guide shows only that, nothing to
 * screw.
 */

const R = 8; // wire, as drawn

/** A straight rod from a to b, as a cylinder turned to lie along it, relative to c. */
function rod(a: Vec3, b: Vec3, c: Vec3, dia = R): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const rz = -Math.atan2(d[0], Math.hypot(d[1], d[2]));
  const rx = Math.atan2(d[2], d[1]);
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot: [rx, 0, rz], material: "metal" };
}

function wire(id: string, name: string, rods: [Vec3, Vec3][]): CustomPart {
  const all = rods.flat();
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((p) => p[k])) - R / 2);
  const hi = [0, 1, 2].map((k) => Math.max(...all.map((p) => p[k])) + R / 2);
  const c = lo.map((v, k) => (v + hi[k]) / 2) as Vec3;
  return { id, name, size: lo.map((v, k) => hi[k] - v) as Vec3, pos: c, pieces: rods.map(([a, b]) => rod(a, b, c)), material: "metal" };
}

function rack(): CustomParams {
  const L = 1340, H = 930, D = 590;
  const zs = D / 2 - 10;
  const foot = 400, top = 260, yTop = H - 40;
  // a ladder of wire leaning from its feet on one side to its top on the other, with bars across it
  const leg = (id: string, sx: number): CustomPart => {
    const at = (f: number, z: number): Vec3 => [sx * (-foot + (foot + top) * f), yTop * f, z];
    const rods: [Vec3, Vec3][] = [
      [at(0, -zs), at(1, -zs)],
      [at(0, zs), at(1, zs)],
      ...[0.04, 0.2, 0.36, 0.52, 0.68, 0.84, 1].map((f): [Vec3, Vec3] => [at(f, -zs), at(f, zs)]),
    ];
    return wire(id, "Leg frame", rods);
  };
  // a flat grid of wires along the length, hinged at the top of a leg frame
  const wing = (id: string, sx: number): CustomPart => {
    const x0 = sx * 10, x1 = (sx * L) / 2;
    const y = H - 10;
    const rods: [Vec3, Vec3][] = [
      [[x0, y, -zs], [x1, y, -zs]],
      [[x0, y, zs], [x1, y, zs]],
      [[x1, y, -zs], [x1, y, zs]],
      ...Array.from({ length: 9 }, (_, i): [Vec3, Vec3] => {
        const z = -zs + ((i + 1) * 2 * zs) / 10;
        return [[x0, y, z], [x1, y, z]];
      }),
    ];
    return wire(id, "Wing", rods);
  };
  const parts = [leg("LA", -1), leg("LB", 1), wing("WA", -1), wing("WB", 1)];
  return {
    parts,
    steps: [
      {
        title: "Stand it up and open the legs",
        detail: "It comes folded flat. Pull the two leg frames apart until they cross in an X and all four feet stand on the floor.",
        add: ["LA", "LB"],
        from: { LA: [-200, 0, 0], LB: [200, 0, 0] },
      },
      {
        title: "Fold the wings out",
        detail: "Lift each wing over and let it rest level on top of its leg frame. Fold them back down again to store it.",
        add: ["WA", "WB"],
        from: { WA: [0, 300, 0], WB: [0, 300, 0] },
      },
    ],
  };
}

const family: Family = {
  names: ["FROST"],
  recipe: (s) => (/drying rack/i.test(s.variant) ? rack() : null),
};
export default family;
