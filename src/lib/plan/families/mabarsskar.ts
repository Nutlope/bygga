import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * MÅBÄRSSKÄR, read from the coffee table's manual. Two bent steel loops carry an oval steel tray: each loop stands on a
 * floor bar at one end of the tray, its legs pass the tray's rim there and lean in to a high arch, so the two arches
 * cross above the middle. On a rug with the tray stood on its end, the first loop is screwed to the tray's brackets
 * with two countersunk screws; the second loop goes on with two pan-head screws, then two more countersunk ones.
 * Upright, the tray is pressed down and every screw tightened.
 */

const TUBE = 16;

function tube(a: Vec3, b: Vec3): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  return { shape: "cyl", size: [TUBE, len + TUBE * 0.6, TUBE], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(d[2], d[1]), 0, -Math.atan2(d[0], Math.hypot(d[1], d[2]))] };
}

function part(id: string, name: string, abs: PartPiece[], lo: Vec3, hi: Vec3, material: PartMaterial): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

function table(s: ProductSpec): CustomParams {
  // IKEA: 61 long, 41 wide, 71 high (to the top of the arches)
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const rEnd = D / 2, xc = W / 2 - rEnd; // the oval as a stadium: two round ends and a straight middle
  const yT0 = 375, yT1 = 410, rim = 14;
  const zl = 150; // legs, from the middle
  const xRim = xc + Math.sqrt(rEnd * rEnd - zl * zl); // the rim where the legs pass it
  const loop = (sx: number) => {
    const xF = sx * (W / 2 - 15), xL = sx * (xRim + 14), yL = (yT0 + yT1) / 2;
    // above the tray the legs lean in, so the arch's top ends up just past the middle
    const top: [number, number] = [-sx * 60, H - TUBE / 2];
    const v: [number, number] = [top[0] - xL, top[1] - yL];
    const vl = Math.hypot(...v), u: [number, number] = [v[0] / vl, v[1] / vl];
    const c: [number, number] = [top[0] - u[0] * zl, top[1] - u[1] * zl];
    const arch: Vec3[] = Array.from({ length: 7 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      return [c[0] + u[0] * zl * Math.sin(a), c[1] + u[1] * zl * Math.sin(a), -zl * Math.cos(a)];
    });
    const abs: PartPiece[] = [tube([xF, TUBE / 2, -zl], [xF, TUBE / 2, zl])];
    for (const sz of [-1, 1]) {
      abs.push(tube([xF, TUBE / 2, sz * zl], [xL, yL, sz * zl]), tube([xL, yL, sz * zl], [c[0], c[1], sz * zl]));
      abs.push({ shape: "box", size: [30, 26, 24], pos: [sx * (xRim + 4), yL, sz * zl], material: "metal" });
    }
    for (let i = 0; i < 6; i++) abs.push(tube(arch[i], arch[i + 1]));
    const xs = [xF, xL, c[0], top[0]];
    return part(sx > 0 ? "LA" : "LB", "Leg loop", abs, [Math.min(...xs) - 20, 0, -zl - 10], [Math.max(...xs) + 20, H, zl + 10], "metal");
  };
  const tray: PartPiece[] = [
    { shape: "box", size: [2 * xc, rim, D], pos: [0, yT0 + rim / 2, 0] },
    { shape: "cyl", size: [D, rim, D], pos: [-xc, yT0 + rim / 2, 0] },
    { shape: "cyl", size: [D, rim, D], pos: [xc, yT0 + rim / 2, 0] },
    { shape: "box", size: [2 * xc, yT1 - yT0, 4], pos: [0, (yT0 + yT1) / 2, D / 2 - 2] },
    { shape: "box", size: [2 * xc, yT1 - yT0, 4], pos: [0, (yT0 + yT1) / 2, -D / 2 + 2] },
  ];
  const parts: CustomPart[] = [part("TRAY", "Tray", tray, [-W / 2, yT0, -D / 2], [W / 2, yT1, D / 2], "metal"), loop(1), loop(-1)];
  const screws = (sx: number, dy: number, o: Partial<CustomFix>): CustomFix => ({
    kind: "screw",
    count: 2,
    at: [-1, 1].map((sz): Vec3 => [sx * (xRim - 6), (yT0 + yT1) / 2 + dy, sz * zl]),
    dir: [sx, 0, 0],
    on: "TRAY",
    mate: sx > 0 ? "LA" : "LB",
    len: 12,
    dia: 5,
    ...o,
  });
  return {
    parts,
    steps: [
      {
        title: "Screw the first loop to the tray",
        detail: "Stand the tray on its end on a rug. Hold the loop's brackets against the tray's rim and drive two countersunk screws from inside the tray, not tight yet.",
        add: ["TRAY", "LA"],
        fix: [screws(1, 0, { name: "Countersunk screw" })],
        tools: ["screwdriver"],
        pose: "+x",
        warnings: ["floor"],
      },
      {
        title: "Fit the second loop",
        detail: "Push it through from the other side so its arch crosses the first one. One pan-head screw in each bracket.",
        add: ["LB"],
        fix: [screws(-1, -11.5, { name: "Pan-head screw" })],
        tools: ["screwdriver"],
      },
      { title: "Add the last two countersunk screws", detail: "Into the second hole of each of its brackets, not tight yet.", fix: [screws(-1, 11.5, { name: "Countersunk screw" })], tools: ["screwdriver"] },
      { title: "Stand the table up and press the tray down", detail: "Turn it onto its floor bars and press the tray down so it sits level on all four brackets.", pose: "+y" },
      { title: "Tighten all six screws", detail: "Keep pressing on the tray while you do. The countersunk heads end up flush with the rim.", tools: ["screwdriver"] },
    ],
  };
}

const family: Family = {
  names: ["MÅBÄRSSKÄR", "MABARSSKAR"],
  recipe: (s) => (/table/i.test(`${s.variant} ${s.slug ?? ""}`) ? table(s) : null),
};
export default family;
