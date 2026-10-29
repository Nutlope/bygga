import type { Family } from "./family";
import type { CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * YNGVAR, read from the bar stool's manual. The steel frame comes welded in one piece with its backrest on. The seat
 * lies upside down on a table with the frame on it, back hanging over the edge; a plastic spacer goes on at each of
 * four points of the ring under the seat and a bolt through each, by hand, then the four are tightened crosswise with
 * the Allen key. The dining chair comes assembled: its manual only shows how to stack it (five high at most, never
 * twisted round), so its guide unpacks it and stacks it.
 */

const TUBE = 20;

/** A round tube from a to b (any direction), as a piece of a part centred on c. */
function tube(a: Vec3, b: Vec3, c: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot: [Math.atan2(d[2], d[1]), 0, -Math.asin(d[0] / len)] };
}

function barStool(s: ProductSpec): CustomParams {
  // IKEA: seat 75 high, 99 high at the back, 53 wide, 51 deep
  const H = Math.round(s.size.h * 10) || 990, seatY = 750, seatT = 35, under = seatY - seatT;
  const gap = 10, yRing = under - gap - TUBE / 2;
  const xt = 140, zt = 135, xf = 200, zf = 195, yFoot = 280;
  const lerp = (y: number, a: number, b: number) => b + ((a - b) * y) / yRing;
  const c: Vec3 = [0, H / 2, -25];
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz): [number, number] => [sx, sz]));
  const ring = (y: number, x: number, z: number): PartPiece[] => [
    ...[-1, 1].map((sz) => tube([-x, y, sz * z], [x, y, sz * z], c)),
    ...[-1, 1].map((sx) => tube([sx * x, y, -z], [sx * x, y, z], c)),
  ];
  const yB0 = H - 90, zB = -zt - 110;
  const pieces: PartPiece[] = [
    ...corners.map(([sx, sz]) => tube([sx * xf, 0, sz * zf], [sx * xt, yRing, sz * zt], c)),
    ...ring(yRing, xt, zt),
    ...ring(yFoot, lerp(yFoot, xt, xf), lerp(yFoot, zt, zf)),
    // two uprights from the back of the ring to the curved backrest
    ...[-1, 1].map((sx) => tube([sx * 90, yRing, -zt], [sx * 120, yB0 + 20, zB + 20], c)),
    { shape: "box", size: [280, 90, 18], pos: [0, yB0 + 45 - c[1], zB - c[2]], material: "wood" },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [150, 90, 18], pos: [sx * 195 - c[0], yB0 + 45 - c[1], zB + 32 - c[2]], rot: [0, -sx * 0.45, 0], material: "wood" })),
  ];
  const parts: CustomPart[] = [
    { id: "SEAT", name: "Seat", size: [400, seatT, 400], pos: [0, seatY - seatT / 2, 0], shape: "cyl", material: "wood" },
    { id: "FRAME", name: "Frame with backrest", size: [530, H, 460], pos: c, pieces, material: "metal" },
  ];
  const pts: Vec3[] = [[0, yRing, zt], [0, yRing, -zt], [xt, yRing, 0], [-xt, yRing, 0]];
  return {
    parts,
    steps: [
      {
        title: "Bolt the frame to the seat by hand",
        detail: "Lay the seat upside down on a table with the backrest hanging over the edge. A spacer at each of the four holes, then a bolt through the frame into the seat, turned by hand.",
        add: ["SEAT", "FRAME"],
        fix: [
          { kind: "spacer", count: 4, at: pts.map((p): Vec3 => [p[0], under - gap / 2, p[2]]), dir: [0, 1, 0], on: "SEAT", name: "Spacer", len: gap, dia: 22 },
          { kind: "bolt", count: 4, at: pts.map((p): Vec3 => [p[0], yRing - TUBE / 2, p[2]]), dir: [0, 1, 0], on: "FRAME", mate: "SEAT", len: 30, dia: 6 },
        ],
        pose: "-y",
        from: { FRAME: [0, -300, 0] },
        tools: [],
      },
      { title: "Tighten the bolts crosswise", detail: "With the Allen key, a little at a time: front, back, then the two sides.", tools: ["allen"], kind: "bolts" },
    ],
  };
}

/** A crescent of a ring round the back of the seat, as [x, z] corners: outer edge one way, inner edge back. */
function arc(rx: number, rz: number, t: number, a0: number, a1: number, n = 14): [number, number][] {
  const pt = (a: number, d: number): [number, number] => [Math.round((rx - d) * Math.cos(a)), Math.round((rz - d) * Math.sin(a))];
  const as = Array.from({ length: n + 1 }, (_, i) => a0 + ((a1 - a0) * i) / n);
  return [...as.map((a) => pt(a, 0)), ...as.reverse().map((a) => pt(a, t))];
}

function chair(s: ProductSpec): CustomParams {
  // IKEA: 71 high at the back, seat 45 high, 53 wide, 51 deep
  const H = Math.round(s.size.h * 10) || 710, seatY = 450, seatT = 30, yRing = seatY - seatT - TUBE / 2;
  const xt = 145, zt = 140, xf = 225, zf = 205;
  const c: Vec3 = [0, H / 2, 0];
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz): [number, number] => [sx, sz]));
  const rx = 255, rz = 250, band = 80;
  const zUp = (x: number) => -rz * Math.sqrt(1 - (x / rx) ** 2);
  const pieces: PartPiece[] = [
    ...corners.map(([sx, sz]) => tube([sx * xf, 0, sz * zf], [sx * xt, yRing, sz * zt], c)),
    ...[-1, 1].map((sz) => tube([-xt, yRing, sz * zt], [xt, yRing, sz * zt], c)),
    ...[-1, 1].map((sx) => tube([sx * xt, yRing, -zt], [sx * xt, yRing, zt], c)),
    ...[-1, 1].map((sx) => tube([sx * 110, yRing, -zt], [sx * 150, H - band, zUp(150) + 8], c)),
    { shape: "slab", size: [2 * rx, band, rz], pos: [0, H - band / 2 - c[1], 0], outline: arc(rx, rz, 14, Math.PI + 0.45, 2 * Math.PI - 0.45), round: 4 },
    { shape: "cyl", size: [420, seatT, 420], pos: [0, seatY - seatT / 2 - c[1], 0] },
  ];
  return {
    parts: [{ id: "CH", name: "Chair", size: [2 * xf + TUBE, H, 2 * zf + TUBE], pos: c, pieces, material: "metal" }],
    steps: [
      { title: "Unpack the chair", detail: "It comes ready assembled, so there is nothing to put together. Cut the wrapping open carefully so the knife can't scratch it.", add: ["CH"] },
      { title: "Stack the chairs if you need to", detail: "Up to five, each one lowered straight onto the one below. Never twist a stack round to move it." },
    ],
  };
}

const recipe = (s: ProductSpec) => (/yngvar-bar-stool/.test(s.slug ?? "") ? barStool(s) : /yngvar-chair/.test(s.slug ?? "") ? chair(s) : null);

/** The recipe, with each step's tools as the manual shows them (the bolts go in by hand first). */
function build(b: PlanBuilder, s: ProductSpec): boolean {
  const r = recipe(s);
  if (!r) return false;
  const start = b.steps.length;
  buildCustom(b, { ...s, custom: r });
  r.steps.forEach((st, i) => {
    const bs = b.steps[start + i];
    if (bs && st.tools && bs.title === st.title) bs.tools = [...st.tools];
  });
  return true;
}

const family: Family = { names: ["YNGVAR"], recipe, build };
export default family;
