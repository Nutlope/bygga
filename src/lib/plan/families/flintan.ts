import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * FLINTAN office chair, read from IKEA's manuals (the chair's, and the pair of armrests sold with it).
 * The five legs are pushed into the hub on a rug and screwed from above, the base is turned over for the castors,
 * and the gas lift (cap off) is stood in it. The seat lies upside down: the mechanism goes on with four bolts,
 * put in by hand and then tightened. The backrest gets its bracket with four bolts, the bracket slides onto the
 * mechanism with three more, and the seat is pressed onto the gas lift. Armrests: each pad is screwed to its arm
 * with two screws, then the chair goes on its side and each arm is bolted under the seat with four bolts.
 * IKEA's sizes: 71 x 71 cm, 103 high at the lowest seat (45 cm), seat 46 x 49, armrests from 69 cm.
 */

const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: PartMaterial = "board"): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
});
/** One part drawn as boxes given in finished-product mm. */
function boxes(id: string, name: string, list: [Vec3, Vec3, PartMaterial?][], material: PartMaterial): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...list.map((b) => b[0][k]))) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(...list.map((b) => b[1][k]))) as Vec3;
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const pieces: PartPiece[] = list.map(([a, b, m]) => ({
    shape: "box",
    size: [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    pos: [(a[0] + b[0]) / 2 - pos[0], (a[1] + b[1]) / 2 - pos[1], (a[2] + b[2]) / 2 - pos[2]],
    ...(m ? { material: m } : {}),
  }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos, material, pieces };
}
const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

function chair(s: ProductSpec): CustomParams {
  const arms = /armrest/i.test(`${s.variant} ${s.slug ?? ""}`);
  const R = 330, AY0 = 70, AY1 = 110; // the legs reach 33 cm out, castors under them
  const SY = 450, MY = 345; // top of the seat, underside of the mechanism
  const angles = [0, 1, 2, 3, 4].map((i) => (i * 2 * Math.PI) / 5);
  const parts: CustomPart[] = [{ id: "H", name: "Hub", shape: "cyl", material: "metal", size: [80, 60, 80], pos: [0, 95, 0] }];
  angles.forEach((a, i) =>
    parts.push({ id: `L${i}`, name: "Leg", material: "metal", size: [50, AY1 - AY0, R - 30], pos: [Math.sin(a) * (R + 30) / 2, (AY0 + AY1) / 2, Math.cos(a) * (R + 30) / 2], rot: [0, a, 0] }),
  );
  parts.push(
    { id: "G", name: "Gas lift", shape: "cyl", material: "metal", size: [50, MY - 110, 50], pos: [0, (MY + 110) / 2, 0] },
    box("S", "Seat", [-235, MY + 35, -220], [235, SY, 270], "soft"),
    box("M", "Mechanism", [-90, MY, -130], [90, MY + 35, 100], "metal"),
    boxes("K", "Backrest bracket", [[[-40, MY - 20, -270], [40, MY, -130]], [[-40, MY - 20, -290], [40, 560, -270]]], "metal"),
  );
  // a mesh back in a frame, leaning back a little
  const by0 = 500, by1 = 1030, bz = -300;
  const back = boxes("B", "Backrest", [
    [[-240, by0, bz - 15], [-215, by1, bz + 15]],
    [[215, by0, bz - 15], [240, by1, bz + 15]],
    [[-215, by1 - 40, bz - 15], [215, by1, bz + 15]],
    [[-215, by0, bz - 15], [215, by0 + 60, bz + 15]],
    [[-215, by0 + 60, bz - 4], [215, by1 - 40, bz + 4], "fiber"],
  ], "board");
  back.rot = [-0.1, 0, 0];
  parts.push(back);
  if (arms)
    for (const [i, g] of [[0, -1], [1, 1]] as const)
      parts.push(
        boxes(`A${i}`, "Armrest", [
          [[Math.min(g * 90, g * 270), MY - 25, -60], [Math.max(g * 90, g * 270), MY - 5, 20]],
          [[Math.min(g * 250, g * 275), MY - 5, -40], [Math.max(g * 250, g * 275), 665, 0]],
          [[Math.min(g * 232, g * 293), 665, -150], [Math.max(g * 232, g * 293), 690, 110]],
        ], "board"),
      );

  const ends = angles.map((a): Vec3 => [Math.sin(a) * (R - 20), AY0, Math.cos(a) * (R - 20)]);
  const steps: CustomStep[] = [
    {
      title: "Push the legs into the hub",
      detail: "On a rug. Each leg slides into its slot in the hub until it stops.",
      add: ["H", ...angles.map((_, i) => `L${i}`)],
      warnings: ["floor"],
    },
    {
      title: "Screw the legs to the hub",
      detail: "One screw down through the hub into each leg. Use the small screws here, not the bolts.",
      fix: [fix("screw", angles.map((a): Vec3 => [Math.sin(a) * 30, 125, Math.cos(a) * 30]), [0, -1, 0], { len: 12, dia: 6, on: "H" })],
      tools: ["allen"],
    },
    {
      title: "Push in the castors",
      detail: "Turn the base over and press each castor in until it snaps home, then stand the base on its castors.",
      pose: "-y",
      fix: [fix("castor", ends, [0, 1, 0], { len: 60, dia: 50 })],
    },
    { title: "Take the cap off the gas lift", detail: "Pull the plastic cap off its top and throw it away.", pose: "+y" },
    { title: "Stand the gas lift in the base", detail: "Narrow end up. It just sits in the hole for now.", add: ["G"], from: { G: [0, 300, 0] } },
    {
      title: "Bolt the mechanism under the seat",
      detail: "Lay the seat upside down on a soft surface, lever to the right as you look at its front. Turn the four bolts in by hand first.",
      add: ["S", "M"],
      fix: [fix("bolt", [-1, 1].flatMap((g) => [-110, 80].map((z): Vec3 => [g * 75, MY, z])), [0, 1, 0], { len: 16, dia: 8, on: "M" })],
      from: { S: [0, 300, 0], M: [0, -300, 0] },
    },
    { title: "Tighten the four bolts", detail: "With the Allen key, until the mechanism sits flat.", tools: ["allen"], kind: "bolts" },
    {
      title: "Bolt the bracket to the backrest",
      detail: "Four bolts through the bracket into the bottom of the backrest frame.",
      add: ["B", "K"],
      // from the bracket's face, back into the foot of the leaning backrest
      fix: [fix("bolt", [-1, 1].flatMap((g) => [520, 550].map((y): Vec3 => [g * 24, y, -262])), [0, 0, -1], { len: 16, dia: 8, on: "K" })],
      tools: ["allen"],
    },
    {
      title: "Bolt the backrest to the mechanism",
      detail: "Slide the bracket into the back of the mechanism and fix it with three bolts.",
      fix: [fix("bolt", [-20, 0, 20].map((x, i): Vec3 => [x, MY - 20, -150 + i * 0]), [0, 1, 0], { len: 16, dia: 8, on: "K" })],
      tools: ["allen"],
    },
    {
      title: "Press the seat onto the gas lift",
      detail: "Set the mechanism over the top of the gas lift and push down hard. Sitting on it locks it for good.",
      people: 1,
    },
  ];
  if (arms)
    steps.push(
      {
        title: "Screw the pads onto the armrests",
        detail: "Two screws from below through each arm into its pad.",
        add: ["A0", "A1"],
        fix: [fix("screw", [-1, 1].flatMap((g) => [-100, 60].map((z): Vec3 => [g * 262, 665, z])), [0, 1, 0], { len: 12, dia: 6 })],
        tools: ["allen"],
      },
      {
        title: "Bolt the left armrest under the seat",
        detail: "Lay the chair on its side. Four bolts through the arm into the seat.",
        pose: "-x",
        fix: [fix("bolt", [-200, -120].flatMap((x) => [-40, 0].map((z): Vec3 => [x, MY - 25, z])), [0, 1, 0], { len: 16, dia: 6, on: "A0" })],
        tools: ["allen"],
      },
      {
        title: "Bolt the right armrest on",
        detail: "Turn the chair onto its other side and fix the second arm the same way, then stand it up.",
        pose: "+x",
        fix: [fix("bolt", [120, 200].flatMap((x) => [-40, 0].map((z): Vec3 => [x, MY - 25, z])), [0, 1, 0], { len: 16, dia: 6, on: "A1" })],
        tools: ["allen"],
      },
      { title: "Stand the chair up", detail: "Check both arms are tight before you sit.", pose: "+y" },
    );
  return { parts, steps };
}

const family: Family = {
  names: ["FLINTAN"],
  recipe(s) {
    if (!/office chair/i.test(`${s.variant} ${s.slug ?? ""}`.replace(/-/g, " "))) return null;
    return chair(s);
  },
};
export default family;
