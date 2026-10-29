import type { Family } from "./family";
import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";

/**
 * NORRUDDEN guest bed, read from its manual: it comes in one piece, a steel frame in two halves hinged in the
 * middle, folded with its mattress inside and the leg frames folded flat. The four castors go on the hinge plates at
 * the fold, each with a washer and a cap nut. The leg frames of the top half swing out until their four latches
 * click, the bundle is turned over and the other half's legs swing out, the strap is undone and the top half is
 * lifted up and laid out flat. To store it, the same in reverse: fold it, strap it and stand it on its castors.
 * IKEA: 80 x 193, 30 high.
 */

/** Euler angles (x then z) that turn a part's y axis onto d. */
function along(d: Vec3): Vec3 {
  const n = Math.hypot(...d);
  const [x, y, z] = [d[0] / n, d[1] / n, d[2] / n];
  return [Math.atan2(z, y), 0, Math.atan2(-x, Math.hypot(y, z))];
}

function rod(a: Vec3, b: Vec3, dia: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  return { shape: "cyl", size: [dia, Math.hypot(...d), dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: along(d) };
}

/** Where a point ends up turned by c about the z axis through pivot p. */
function spin(v: Vec3, p: [number, number], c: number): Vec3 {
  const x = v[0] - p[0], y = v[1] - p[1];
  return [p[0] + x * Math.cos(c) - y * Math.sin(c), p[1] + x * Math.sin(c) + y * Math.cos(c), v[2]];
}

function build(b: PlanBuilder, s: ProductSpec) {
  const L = Math.round(s.size.w * 10) || 1930, Wd = Math.round(s.size.d * 10) || 800, H = Math.round(s.size.h * 10) || 300;
  const h = L / 2;
  const MT = 100; // mattress
  const yR = H - MT - 25; // the frame's side rails
  const zr = Wd / 2 - 15;
  const xLeg = h - 230; // the leg frames hang from the rails this far out from the middle
  const yHinge = yR - 12;
  const half = (g: 1 | -1) => {
    const pieces: PartPiece[] = [
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [h - 10, 25, 25], pos: [(g * h) / 2, yR, sz * zr] })),
      { shape: "box", size: [25, 25, 2 * zr + 25], pos: [g * (h - 17), yR, 0] },
      { shape: "box", size: [h - 40, 4, 2 * zr - 20], pos: [(g * h) / 2, yR + 12, 0] },
      // the hinge plates at the fold, which take the castors
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [90, 80, 5], pos: [g * 50, yR - 45, sz * (zr + 15)] })),
      { shape: "box", size: [h - 6, MT, Wd - 10], pos: [(g * h) / 2, H - MT / 2, 0], material: "soft" },
    ];
    return b.compound(g < 0 ? "Head half" : "Foot half", pieces, { material: "metal" });
  };
  const legs = (g: 1 | -1) => {
    const xt = g * xLeg, xf = g * (xLeg + 70), zl = zr - 20;
    const pieces: PartPiece[] = [rod([xt, yHinge, -zl], [xt, yHinge, zl], 18), rod([xf, 10, -zl], [xf, 10, zl], 18)];
    for (const sz of [-1, 1]) pieces.push(rod([xt, yHinge, sz * zl], [xf, 10, sz * zl], 18));
    return b.compound("Leg frame", pieces, { material: "metal" });
  };
  const HH = half(-1), HF = half(1), LH = legs(-1), LF = legs(1);
  const kH = b.place(HH.type, HH.mid), kF = b.place(HF.type, HF.mid);
  const kLH = b.place(LH.type, LH.mid), kLF = b.place(LF.type, LF.mid);
  // the foot half folds over onto the head half, mattress to mattress, about the hinge at the mattress's top
  const fold: [number, number] = [0, H];
  const legFold = (m: Vec3, g: number): { pos: Vec3; c: number } => ({ pos: spin(m, [g * xLeg, yHinge], (g * Math.PI) / 2), c: (g * Math.PI) / 2 });
  const lhFolded = legFold(LH.mid, -1);
  const lfFlat = legFold(LF.mid, 1);
  const fFolded = spin(HF.mid, fold, Math.PI);
  const fUp = spin(HF.mid, fold, Math.PI / 2);
  // castors: two on each half's hinge plates, stems through from the fold side
  const yC = yR - 55;
  const castorAt = (g: number, sz: number): Vec3 => [g * 75, yC, sz * (zr + 18)];
  b.step({ title: "Fit the castors to the folded bed", detail: "Lay it flat on a rug. Each castor's stem goes through a hinge plate at the fold, then a washer and a cap nut, tightened with the spanner.", kind: "legs", tools: ["wrench"], warnings: ["floor"] }, () => {
    b.add(kH);
    b.stage(kF, fFolded, [0, 0, Math.PI]);
    b.stage(kLH, lhFolded.pos, [0, 0, lhFolded.c]);
    b.stage(kLF, spin(lfFlat.pos, fold, Math.PI), [0, 0, lfFlat.c + Math.PI]);
    b.then(0.1);
    for (const [g, part] of [[-1, kH], [1, kF]] as const)
      for (const sz of [-1, 1]) {
        const p = castorAt(g, sz);
        const dir: Vec3 = [-g, 0, 0];
        b.fit({ kind: "castor", len: 50, dia: 45 }, { on: part, at: p, dir, hole: false });
        b.fit({ kind: "washer", len: 2, dia: 16 }, { on: part, at: [p[0] - g * 8, p[1], p[2]], dir });
        b.fit({ kind: "nut", len: 8, dia: 13, name: "Cap nut" }, { on: part, at: [p[0] - g * 12, p[1], p[2]], dir });
      }
  });
  b.step({ title: "Swing out the legs on the top half", detail: "Lift each leg frame up until both latches click. Keep fingers clear of the hinges.", kind: "legs", warnings: ["hand"] }, () => {
    b.stage(kLF, spin(LF.mid, fold, Math.PI), [0, 0, Math.PI]);
  });
  b.step({ title: "Turn it over and swing out the other legs", detail: "Stand it on the legs you just opened, then lift the other leg frame until its latches click.", kind: "legs", pose: "-y", warnings: ["hand"] }, () => b.add(kLH));
  b.step({ title: "Undo the strap", detail: "Pull open the strap that holds the two halves together.", kind: "general", pose: "+y" }, () => b.wait(0.4));
  b.step({ title: "Lift the top half up", detail: "Hold it by its end and swing it up over the hinge.", kind: "general" }, () => {
    b.stage(kF, fUp, [0, 0, Math.PI / 2]);
    b.stage(kLF, spin(LF.mid, fold, Math.PI / 2), [0, 0, Math.PI / 2]);
  });
  b.step({ title: "Lay it out flat", detail: "Lower it on the other side until it stands on its legs. Straighten the mattress.", kind: "general" }, () => {
    b.add(kF);
    b.add(kLF);
  });
  b.step({ title: "Fold it away when it's not in use", detail: "Lift one half over onto the other, close the strap, press the latches and fold the legs flat, then stand it on its castors.", kind: "general" }, () => b.wait(0.4));
  return true;
}

const family: Family = {
  names: ["NORRUDDEN"],
  build(b, s) {
    if (!/guest bed/i.test(s.variant)) return false;
    return build(b, s);
  },
};
export default family;
