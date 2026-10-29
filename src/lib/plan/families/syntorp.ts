import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * SYNTORP, read from the bar stool's manual. The seat lies upside down on a table: the backrest's plate is screwed
 * under it with three screws and its cover flap folded over, then each armrest with two screws and its flap. The
 * base is two leg pieces pushed onto two cross tubes, laid on the seat and held by four long Allen bolts, then the
 * footrest ring goes over the legs with four screws, and the bolts get a last turn with the other Allen key.
 */

const TUBE = 20;

/** A round tube from a to b, as a piece of a part centred at c. */
function seg(a: Vec3, b: Vec3, c: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const h = Math.hypot(d[0], d[2]);
  const rot: Vec3 = [0, h ? Math.atan2(-d[2], d[0]) : 0, -Math.atan2(h, d[1])];
  return { shape: "cyl", size: [dia, Math.hypot(...d), dia], pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]], rot };
}

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 60 wide, 56 deep, 101 high, seat 42 x 41 at 66
  const W = Math.round(s.size.w * 10) || 600, H = Math.round(s.size.h * 10) || 1010;
  const D = Math.round(s.size.d * 10) || 560;
  const yS = (s.seat?.seatH ? s.seat.seatH * 10 : 0) || 660;
  const sw = 420, sd = 410, st = 70, yU = yS - st; // seat cushion, its underside
  const yR = yU - TUBE / 2 - 2; // the base's top rails
  const xt = 175, zt = 165, xf = 225, zf = 215; // leg tops and feet
  const legAt = (y: number) => [xt + ((xf - xt) * (yR - y)) / yR, zt + ((zf - zt) * (yR - y)) / yR];
  const yF = 260; // footrest ring

  const plate = (x: number, z: number, w: number, d: number, c: Vec3): PartPiece => ({ shape: "box", size: [w, 4, d], pos: [x - c[0], yU - 2 - c[1], z - c[2]], material: "metal" });
  const bc: Vec3 = [0, (yU + H) / 2, -D / 2 + 70];
  const back: CustomPart = {
    id: "B",
    name: "Backrest",
    size: [440, H - yU, 140],
    pos: bc,
    material: "soft",
    pieces: [
      { shape: "box", size: [440, 330, 70], pos: [0, H - 165 - bc[1], -D / 2 + 50 - bc[2]], rot: [-0.12, 0, 0] },
      { shape: "box", size: [90, H - 330 - yU + 20, 4], pos: [0, (yU + H - 330) / 2 + 10 - bc[1], -sd / 2 + 20 - bc[2]], material: "metal" },
      plate(0, -sd / 2 + 80, 120, 140, bc),
    ],
  };
  const arms = [-1, 1].map((sx, i): CustomPart => {
    const c: Vec3 = [sx * (W / 2 - 140), yU + 140, -60];
    return {
      id: `A${i + 1}`,
      name: "Armrest",
      size: [280, 300, 300],
      pos: c,
      material: "soft",
      pieces: [
        { shape: "box", size: [70, 280, 290], pos: [sx * (W / 2 - 45) - c[0], yU + 160 - c[1], -60 - c[2]], rot: [0, sx * 0.35, sx * 0.08] },
        plate(sx * 160, -60, 110, 80, c),
        { shape: "box", size: [W / 2 - 200, 4, 50], pos: [sx * (W / 4 + 50) - c[0], yU - 2 - c[1], -60 - c[2]], material: "metal" },
      ],
    };
  });
  const legSide = (id: string, sx: number): CustomPart => {
    const c: Vec3 = [sx * (xt + xf) / 2, yR / 2, 0];
    return {
      id,
      name: "Leg frame",
      size: [xf - xt + TUBE, yR + TUBE / 2, 2 * zf + TUBE],
      pos: c,
      material: "metal",
      pieces: [
        ...[-1, 1].map((sz) => seg([sx * xt, yR, sz * zt], [sx * xf, 0, sz * zf], c)),
        seg([sx * xt, yR, -zt], [sx * xt, yR, zt], c),
        ...[-1, 1].map((sz) => seg([sx * xt, yR, sz * 90], [sx * (xt - 40), yR, sz * 90], c, TUBE + 4)),
      ],
    };
  };
  const cross = (id: string, sz: number): CustomPart => ({ id, name: "Cross tube", shape: "cyl", size: [2 * (xt - 40), TUBE, TUBE], pos: [0, yR, sz * 90], material: "metal" });
  const [xr, zr] = legAt(yF);
  // the ring's cut corners pass just inside the legs, touching them, so each corner screws into its leg
  const k = (40 - TUBE * Math.SQRT2) / 2;
  const rx = xr + k, rz = zr + k;
  const ring: CustomPart = {
    id: "R",
    name: "Footrest ring",
    size: [2 * rx + TUBE, TUBE, 2 * rz + TUBE],
    pos: [0, yF, 0],
    material: "metal",
    pieces: [
      ...[-1, 1].map((sx) => seg([sx * rx, 0, -rz + 40], [sx * rx, 0, rz - 40], [0, 0, 0])),
      ...[-1, 1].map((sz) => seg([-rx + 40, 0, sz * rz], [rx - 40, 0, sz * rz], [0, 0, 0])),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => seg([sx * rx, 0, sz * (rz - 40)], [sx * (rx - 40), 0, sz * rz], [0, 0, 0]))),
    ],
  };
  const seat: CustomPart = { id: "S", name: "Seat", size: [sw, st, sd], pos: [0, yU + st / 2, 0], material: "soft" };
  const parts: CustomPart[] = [seat, back, ...arms, legSide("L1", -1), legSide("L2", 1), cross("C1", -1), cross("C2", 1), ring];

  const up: Vec3 = [0, 1, 0];
  const bolts = [-1, 1].map((sx, i): CustomFix => ({ kind: "bolt", count: 2, len: 50, dia: 6, at: [-1, 1].map((sz): Vec3 => [sx * xt, yR - TUBE / 2, sz * 90]), dir: up, on: `L${i + 1}`, mate: "S" }));
  return {
    parts,
    steps: [
      {
        title: "Screw the backrest under the seat",
        detail: "Lay the seat upside down on a table with a cloth under it. Three screws through the backrest's plate, with the smaller Allen key.",
        add: ["S", "B"],
        fix: [{ kind: "screw", count: 3, len: 16, dia: 6, at: [[-35, yU - 4, -sd / 2 + 50], [35, yU - 4, -sd / 2 + 50], [0, yU - 4, -sd / 2 + 120]], dir: up, on: "B", mate: "S" }],
        tools: ["allen"],
        pose: "-y",
      },
      { title: "Fold the backrest flap over the plate", detail: "Press the hook and loop strip down so it holds." },
      {
        title: "Screw on the armrests",
        detail: "Two screws through each armrest's plate into the seat.",
        add: ["A1", "A2"],
        fix: [-1, 1].map((sx, i): CustomFix => ({ kind: "screw", count: 2, len: 16, dia: 6, at: [-95, -25].map((z): Vec3 => [sx * 160, yU - 4, z]), dir: up, on: `A${i + 1}`, mate: "S" })),
        tools: ["allen"],
      },
      { title: "Fold the armrest flaps over", detail: "One on each side, pressed down flat." },
      {
        title: "Push the leg frames onto the cross tubes",
        detail: "The tubes slide into the sleeves on both leg frames. Turn them so the holes line up with the holes in the sleeves.",
        add: ["L1", "C1", "C2", "L2"],
        from: { L1: [-250, 0, 0], L2: [250, 0, 0] },
      },
      {
        title: "Bolt the base to the seat",
        detail: "Lay it on the seat and turn the four long bolts in by hand first, through the sleeves into the seat.",
        fix: bolts,
        tools: ["allen"],
      },
      {
        title: "Screw on the footrest ring",
        detail: "Lower it over the legs, flat side down, and fit a screw into each leg.",
        add: ["R"],
        fix: [-1, 1].flatMap((sx, i) => [-1, 1].map((sz): CustomFix => ({ kind: "screw", count: 1, len: 20, dia: 6, at: [[sx * (rx - 20 + TUBE / 2 / Math.SQRT2), yF, sz * (rz - 20 + TUBE / 2 / Math.SQRT2)]], dir: [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2], on: "R", mate: `L${i + 1}` }))),
        tools: ["allen"],
      },
      { title: "Tighten the four bolts", detail: "Give each one a last firm turn with the larger Allen key.", tools: ["allen"] },
      { title: "Turn it over", detail: "Stand it on its feet and check it doesn't rock.", pose: "+y" },
    ],
  };
}

const family: Family = { names: ["SYNTORP"], recipe };
export default family;
