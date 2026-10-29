import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, Vec3 } from "../../types";

/**
 * VASSHOLMEN, read from the chair's manual. The woven seat and back come in one piece on their steel frame. With it
 * upside down on a rug, the two side leg frames push onto the pins under the back corners and take one bolt with a
 * spring washer and a washer at each leg; the cross stretcher slides in between the side stretchers and is bolted
 * from both sides, then the four leg bolts are tightened.
 */

const TUBE = 25;

/** A round tube from a to b. */
function tube(a: Vec3, b: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const h = Math.hypot(d[0], d[2]);
  const [ux, uz] = h > 1e-6 ? [d[0] / h, d[2] / h] : [1, 0];
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-uz, ux), -Math.acos(d[1] / len)] };
}

/** One part drawn from tubes between points and boxes (finished-product mm): its box is their extent. */
function frame(id: string, name: string, runs: [Vec3, Vec3][], boxes: PartPiece[] = [], dia = TUBE): CustomPart {
  const pts = runs.flat();
  for (const bx of boxes) for (const s of [-1, 1]) pts.push([bx.pos[0] + (s * bx.size[0]) / 2, bx.pos[1] + (s * bx.size[1]) / 2, bx.pos[2] + (s * bx.size[2]) / 2]);
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])) - dia / 2);
  const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])) + dia / 2);
  lo[1] = Math.max(0, lo[1]);
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const rel = (p: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  const pieces: PartPiece[] = [...runs.map(([a, b]) => tube(rel(a), rel(b), dia)), ...boxes.map((bx) => ({ ...bx, pos: rel(bx.pos) }))];
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material: "metal" };
}

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, ...o });

function chair(): CustomParams {
  // IKEA: 58 wide, 60 deep, 92 high; seat 46 x 46 at 46 high
  const H = 920, yS = 460;
  const xS = 230; // seat frame half-width
  const zSF = 230, zSB = -210; // seat frame front and back
  const yL = yS - 30; // tops of the legs, under the seat frame
  const xL = 250, zLF = 285, zLB = -290; // feet
  const yX = 180; // stretchers
  const zTop = -290; // top of the back, leaning back

  const seatBack = frame(
    "SB",
    "Seat and back",
    [
      ...[-1, 1].flatMap((sx): [Vec3, Vec3][] => [
        [[sx * xS, yS - 15, zSF], [sx * xS, yS - 15, zSB]],
        [[sx * xS, yS - 15, zSB], [sx * xS, H - 20, zTop]],
      ]),
      [[-xS, yS - 15, zSF], [xS, yS - 15, zSF]],
      [[-xS, H - 20, zTop], [xS, H - 20, zTop]],
    ],
    [
      { shape: "box", size: [2 * xS - 10, 26, zSF - zSB - 10], pos: [0, yS - 2, (zSF + zSB) / 2], material: "soft" },
      { shape: "box", size: [2 * xS - 30, 330, 22], pos: [0, H - 210, zTop + 30], rot: [-0.12, 0, 0], material: "soft" },
    ],
  );
  const parts: CustomPart[] = [seatBack];
  const lean = (y: number, z0: number, z1: number) => z0 + ((z1 - z0) * y) / yL;
  const sides = [-1, 1];
  sides.forEach((sx, i) => {
    const zf = lean(yX, zLF, zSF - 25), zb = lean(yX, zLB, zSB + 15), xx = xL + ((xS - xL) * yX) / yL;
    parts.push(
      frame(`L${i}`, "Leg frame", [
        [[sx * xL, 0, zLF], [sx * xS, yL, zSF - 25]],
        [[sx * xL, 0, zLB], [sx * xS, yL, zSB + 15]],
        [[sx * xx, yX, zf], [sx * xx, yX, zb]],
      ]),
    );
  });
  const xX = xL + ((xS - xL) * yX) / yL;
  parts.push(frame("X", "Cross stretcher", [[[-xX + TUBE / 2, yX, 0], [xX - TUBE / 2, yX, 0]]]));

  const tops = sides.flatMap((sx) => [[sx * xS, yS - 15 - TUBE / 2, zSF - 25], [sx * xS, yS - 15 - TUBE / 2, zSB + 15]] as Vec3[]);
  const legBolt = (kind: CustomFix["kind"], o: Partial<CustomFix>) => sides.map((sx, i) => at(kind, tops.filter((p) => Math.sign(p[0]) === sx), [0, -1, 0], "SB", { mate: `L${i}`, ...o }));
  const ends = sides.map((sx) => [sx * (xX + TUBE / 2), yX, 0] as Vec3);
  const sideBolt = (kind: CustomFix["kind"], o: Partial<CustomFix>) => sides.map((sx, i) => at(kind, [ends[i]], [-sx, 0, 0], `L${i}`, { mate: "X", ...o }));
  return {
    parts,
    steps: [
      {
        title: "Push the leg frames onto the pins",
        detail: "Lay the seat upside down on a rug. Each leg frame's back leg goes over the pin under a back corner of the seat.",
        add: ["SB", "L0", "L1"],
        from: { L0: [0, 260, 0], L1: [0, 260, 0] },
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Bolt the top of each leg to the seat frame",
        detail: "A spring washer, then a flat washer, on each short bolt. Turn them in with the Allen key, but don't tighten yet.",
        // bolts first: the engine stacks each washer onto the bolt already at its point
        fix: [...legBolt("bolt", { len: 20, dia: 6 }), ...legBolt("washer", { name: "Spring washer", len: 2, dia: 10 }), ...legBolt("washer", { len: 1.5, dia: 14 })],
        tools: ["allen"],
      },
      { title: "Slide the cross stretcher between the leg frames", detail: "Lower it in between them from above, holes facing out and lined up with the holes in the side stretchers.", add: ["X"], from: { X: [0, -300, 0] } },
      {
        title: "Bolt the cross stretcher from each side",
        detail: "A washer on each long bolt, one through each side stretcher. Tighten them.",
        fix: [...sideBolt("bolt", { len: 45, dia: 6 }), ...sideBolt("washer", { len: 1.5, dia: 14 })],
        tools: ["allen"],
      },
      { title: "Tighten the four leg bolts", detail: "Now that the stretcher holds the legs square, tighten each one firmly.", tools: ["allen"], check: "square" },
      { title: "Turn the chair over", detail: "Stand it on its feet and check it doesn't rock. Tighten the bolts again after a couple of weeks.", pose: "+y" },
    ],
  };
}

const family: Family = {
  names: ["VASSHOLMEN"],
  recipe: (s) => (/chair/i.test(`${s.variant} ${s.slug ?? ""}`) ? chair() : null),
};
export default family;
