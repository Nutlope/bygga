import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * ÖRFJÄLL, read from its two manuals: the swivel chair frame and the children's desk chair.
 * Both start with the star base upside down on a rug: the five legs push into the hub and are screwed to it
 * (two screws with washers a leg on the swivel chair, one on the children's), the castors click into the leg ends,
 * and the base is turned over. The column goes into the hub (the swivel chair's gas lift loses its cap first). The
 * seat shell lies face down while the plate under it is screwed on with four screws, then it is pressed down onto
 * the column. The children's chair sets its height by turning the seat.
 * IKEA's sizes: swivel 68 wide, seat 49 x 43 at 47 to 58 cm, 82 to 93 high; children's 53 wide, seat 39 x 34 at
 * 38 to 49 cm, up to 83 high.
 */

type P2 = [number, number];

/** A round tube from a to b in the y-z plane, at x. */
function tubeZY(a: P2, b: P2, x: number, dia: number): PartPiece {
  const dz = b[0] - a[0], dy = b[1] - a[1];
  return { shape: "cyl", size: [dia, Math.hypot(dz, dy) + dia * 0.3, dia], pos: [x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2], rot: [Math.atan2(dz, dy), 0, 0], material: "metal" };
}
/** A round tube from a to b in the x-y plane, at z. */
function tubeXY(a: P2, b: P2, z: number, dia: number): PartPiece {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return { shape: "cyl", size: [dia, Math.hypot(dx, dy) + dia * 0.3, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], rot: [0, 0, Math.atan2(-dx, dy)], material: "metal" };
}

function recipe(s: ProductSpec) {
  const slug = s.slug ?? "";
  if (!/^orfjall-(swivel-chair|children)/.test(slug)) return null;
  const kid = /children/.test(slug);
  const R = kid ? 255 : 330; // base reach
  const Ys = kid ? 380 : 470; // top of the seat, lowest setting
  const SW = kid ? 390 : 490, SD = kid ? 340 : 430;
  const top = kid ? 720 : 820; // top of the back, lowest setting
  const yArm = 85;
  const parts: CustomPart[] = [];

  const angles = Array.from({ length: 5 }, (_, i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const dirOf = (a: number): P2 => [Math.cos(a), -Math.sin(a)];
  parts.push({ id: "HUB", name: "Hub", size: [70, 90, 70], pos: [0, yArm + 10, 0], shape: "cyl", material: "metal" });
  const armL = R - 40;
  angles.forEach((a, i) => {
    const [dx, dz] = dirOf(a);
    const r = 35 + armL / 2;
    parts.push({ id: `A${i}`, name: "Base leg", size: [armL, 32, 42], pos: [dx * r, yArm, dz * r], rot: [0, a, 0], material: "metal" });
  });

  const yMec = Ys - 60; // the plate's top, under the seat cushion
  const gasTop = yMec - 40;
  parts.push({
    id: "GAS",
    name: kid ? "Column" : "Gas lift",
    size: [56, gasTop - (yArm - 30), 56],
    pos: [0, (gasTop + yArm - 30) / 2, 0],
    shape: "cyl",
    material: "metal",
  });
  parts.push({
    id: "MEC",
    name: kid ? "Seat plate" : "Mechanism",
    size: [kid ? 160 : 200, 40, kid ? 160 : 200],
    pos: [0, yMec - 20, 0],
    material: "metal",
    ...(kid ? {} : { pieces: [{ shape: "box" as const, size: [200, 40, 200] as Vec3, pos: [0, 0, 0] as Vec3 }, { shape: "cyl" as const, size: [12, 150, 12] as Vec3, pos: [160, -5, 40] as Vec3, rot: [0, 0, Math.PI / 2] as Vec3 }] }),
  });

  // the seat shell: a white tube running round the seat and up into a loop for the back, with both cushions on it
  const zb = -SD / 2 - 10; // back of the seat
  const xs = SW / 2 + 5;
  const shell: PartPiece[] = [
    { shape: "box", size: [SW - 20, 55, SD - 10], pos: [0, Ys - 28, 10], material: "soft" },
    { shape: "box", size: [SW - 60, (top - Ys) * 0.55, 45], pos: [0, Ys + (top - Ys) * 0.52, zb - 25], rot: [-0.1, 0, 0], material: "soft" },
    tubeXY([-xs + 40, Ys - 40], [xs - 40, Ys - 40], SD / 2 + 10, 20),
    ...[-1, 1].flatMap((sx) => [
      tubeZY([SD / 2 + 10, Ys - 40], [zb, Ys - 40], sx * xs, 20),
      tubeZY([zb, Ys - 40], [zb - 40, top - 70], sx * (xs - 10), 20),
    ]),
    ...Array.from({ length: 6 }, (_, i) => {
      const t0 = (Math.PI * i) / 6, t1 = (Math.PI * (i + 1)) / 6;
      const pt = (t: number): P2 => [(xs - 10) * Math.cos(t), top - 70 + 70 * Math.sin(t)];
      return tubeXY(pt(t0), pt(t1), zb - 40, 20);
    }),
  ];
  parts.push({ id: "SEAT", name: "Seat shell", size: [2 * xs + 20, top - (Ys - 55), SD + 70], pos: [0, (top + Ys - 55) / 2, -15], material: "soft", pieces: shell.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] - (top + Ys - 55) / 2, p.pos[2] + 15] as Vec3 })) });

  const legScrews: Vec3[] = angles.flatMap((a) => (kid ? [55] : [50, 85]).map((r): Vec3 => [dirOf(a)[0] * r, yArm - 16, dirOf(a)[1] * r]));
  const tips: Vec3[] = angles.map((a) => [dirOf(a)[0] * (R - 15), yArm - 16, dirOf(a)[1] * (R - 15)]);
  const plate = kid ? 60 : 75;
  const seatBolts: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * plate, yMec - 40, sz * plate]));

  const legFix: CustomFix[] = kid
    ? [{ kind: "screw", count: 5, len: 16, dia: 6, at: legScrews, dir: [0, 1, 0], on: "HUB" }]
    : [
        // the washers stack on the screws, so the screws are listed first
        { kind: "screw", count: 10, len: 16, dia: 6, at: legScrews, dir: [0, 1, 0], on: "HUB" },
        { kind: "washer", count: 10, len: 1.5, dia: 16, at: legScrews, dir: [0, 1, 0], on: "HUB" },
      ];
  const steps: CustomStep[] = [
    {
      title: "Push the legs into the hub",
      detail: "Lay the base upside down on a rug and push each leg straight into its socket until it stops.",
      add: ["HUB", "A0", "A1", "A2", "A3", "A4"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Screw the legs to the hub", detail: kid ? "One screw in each leg, with the Allen key." : "Two screws with washers in each leg, with the Allen key.", fix: legFix, tools: ["allen"] },
    {
      title: "Push in the castors and turn the base over",
      detail: "Push each castor's pin into the end of a leg until it clicks, then stand the base on its castors.",
      fix: [{ kind: "castor", count: 5, len: 55, dia: 48, at: tips, dir: [0, 1, 0] }],
    },
  ];
  if (!kid) steps.push({ title: "Pull the cap off the gas lift", detail: "The plastic cap on its thin end only protects it in the box.", pose: "+y" });
  steps.push(
    { title: kid ? "Push the column into the hub" : "Push the gas lift into the hub", detail: kid ? "Thick end down, straight in." : "Thick end down, straight in. Don't take it apart: it is under pressure.", add: ["GAS"], pose: "+y" },
    {
      title: kid ? "Screw the plate under the seat" : "Screw the mechanism under the seat",
      detail: kid ? "Lay the seat face down on a rug. Four screws through the plate." : "Lay the seat face down on a rug, the lever to the right. Four screws through the plate.",
      add: ["SEAT", "MEC"],
      fix: [{ kind: "screw", count: 4, len: 20, dia: 6, at: seatBolts, dir: [0, 1, 0], on: "MEC", mate: "SEAT" }],
      tools: ["allen"],
      from: { SEAT: [0, 500, 0], MEC: [0, 650, 0] },
    },
    { title: "Press the seat down onto the column", detail: "Turn the seat over and push the hole in the plate straight down over the top of the column." },
    kid
      ? { title: "Sit down and turn the seat", detail: "Your weight seats the column. Turn the seat to raise or lower it until it clicks at the height you want." }
      : { title: "Sit down once to seat the gas lift", detail: "Your weight locks it. Lift the lever to raise or lower the seat." },
  );
  return { parts, steps };
}

const family: Family = {
  names: ["ÖRFJÄLL", "ORFJALL"],
  recipe,
};
export default family;
