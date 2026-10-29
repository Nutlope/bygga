import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * PERJOHAN, from IKEA's stool and bench manuals: solid pine, held by wooden dowels and Allen screws. The front and
 * back walls of the box get dowels in their ends and are screwed to one end panel, grooves facing in, while it all
 * lies on a rug. Turned onto that end panel, the bench's two rails under the seat drop onto their dowels, the
 * bottom slides down the grooves, and the second end panel goes on top and is screwed. Stood up, the two seat planks
 * go onto dowels in the end panels and are screwed down; the bench is turned over last to screw the rails to the seat.
 */

const SCREW = { kind: "bolt" as const, name: "Allen screw", len: 60, dia: 6 };
const DOWEL = { kind: "dowel" as const, len: 30, dia: 8 };

function recipe(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const bench = W > 700;
  const st = 20; // seat planks
  const sideH = H - st;
  const pt = 22; // end panels
  const inset = bench ? 50 : 35; // the seat reaches past the end panels
  const sx = W / 2 - inset - pt / 2; // end panel centre
  const inner = sx - pt / 2; // inside face of the end panels
  const sideD = D - 20;
  const arch = 70; // the cut-out between the feet
  const side: PartPiece[] = [
    { shape: "box", size: [pt, sideH - arch, sideD - 20], pos: [0, arch / 2, 0] },
    { shape: "box", size: [pt, arch, 80], pos: [0, -sideH / 2 + arch / 2, -sideD / 2 + 40] },
    { shape: "box", size: [pt, arch, 80], pos: [0, -sideH / 2 + arch / 2, sideD / 2 - 40] },
  ];
  const wt = 18, wy0 = 70, wy1 = 250;
  const wz = sideD / 2 - 20 - wt / 2; // the walls sit just inside the end panels' edges
  const bt = 16, by = wy0 + 20;
  const rh = 60, rz = sideD / 2 - 20 - wt / 2;

  const parts: CustomPart[] = [
    { id: "L", name: "End panel", size: [pt, sideH, sideD], pos: [-sx, sideH / 2, 0], pieces: side, material: "wood" },
    { id: "R", name: "End panel", size: [pt, sideH, sideD], pos: [sx, sideH / 2, 0], pieces: side, material: "wood" },
    { id: "F", name: "Front wall", size: [2 * inner, wy1 - wy0, wt], pos: [0, (wy0 + wy1) / 2, wz], material: "wood" },
    { id: "K", name: "Back wall", size: [2 * inner, wy1 - wy0, wt], pos: [0, (wy0 + wy1) / 2, -wz], material: "wood" },
    { id: "B", name: "Bottom", size: [2 * inner, bt, 2 * wz - wt], pos: [0, by, 0], material: "wood" },
    { id: "S0", name: "Seat plank", size: [W, st, D / 2], pos: [0, H - st / 2, -D / 4], material: "wood" },
    { id: "S1", name: "Seat plank", size: [W, st, D / 2], pos: [0, H - st / 2, D / 4], material: "wood" },
  ];
  if (bench) {
    parts.push({ id: "A0", name: "Rail", size: [2 * inner, rh, wt], pos: [0, sideH - rh / 2, rz], material: "wood" });
    parts.push({ id: "A1", name: "Rail", size: [2 * inner, rh, wt], pos: [0, sideH - rh / 2, -rz], material: "wood" });
  }
  const ends = [-1, 1];
  // dowels in both ends of a board, two at each end, standing out toward the end panels
  const endDowels = (id: string, y0: number, y1: number, z: number, n = 2): CustomFix[] =>
    ends.map((e) => ({ ...DOWEL, count: n, on: id, dir: [-e, 0, 0] as Vec3, at: (n === 1 ? [(y0 + y1) / 2] : [y0 + (y1 - y0) * 0.25, y0 + (y1 - y0) * 0.75]).map((y) => [e * inner, y, z] as Vec3) }));
  const sideScrews = (e: number, id: string): CustomFix => ({
    ...SCREW,
    count: 4,
    on: id,
    dir: [-e, 0, 0],
    at: [wz, -wz].flatMap((z) => [wy0 + 50, wy1 - 50].map((y) => [e * (sx + pt / 2), y, z] as Vec3)),
  });
  const wallDowels = [...endDowels("F", wy0, wy1, wz), ...endDowels("K", wy0, wy1, -wz)];
  const turnSlide = (x: number): Vec3 => [x, 0, 0];

  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the walls",
      detail: "Lay the front and back walls on a rug. Two dowels in each end.",
      fix: wallDowels,
      tools: ["hammer"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Fit the walls to one end panel",
      detail: "The grooves along their bottom edges face each other, ready for the bottom.",
      add: ["L", "F", "K"],
    },
    {
      title: "Screw the end panel to the walls",
      detail: "Two screws into each wall, with the Allen key. Don't tighten them all the way yet.",
      fix: [sideScrews(-1, "L")],
    },
  ];
  if (bench) {
    steps.push(
      {
        title: "Tap the dowels into the rails",
        detail: "Two dowels in each end of both rails.",
        fix: [...endDowels("A0", sideH - rh, sideH, rz), ...endDowels("A1", sideH - rh, sideH, -rz)],
        tools: ["hammer"],
        pose: "+x",
        people: 2,
        warnings: ["two"],
      },
      {
        title: "Push the rails into the end panel",
        detail: "Stood on its end panel. They go at the top, where the seat will be, with the holes facing out.",
        add: ["A0", "A1"],
        from: { A0: turnSlide(420), A1: turnSlide(420) },
      },
    );
  }
  steps.push(
    {
      title: "Tap the dowels into the bottom",
      detail: "One in each end.",
      fix: endDowels("B", by - 1, by + 1, 0, 1),
      tools: ["hammer"],
      pose: "+x",
    },
    {
      title: "Slide the bottom down the grooves",
      detail: "Between the two walls, all the way down until its dowels meet the end panel.",
      add: ["B"],
      from: { B: turnSlide(500) },
    },
    { title: "Fit the other end panel on top", detail: "Over all the dowels, then press it down evenly.", add: ["R"], from: { R: turnSlide(260) } },
    { title: "Screw the end panel to the walls", detail: "Two screws into each wall. Now tighten the screws at both ends.", fix: [sideScrews(1, "R")] },
    {
      title: "Stand it up and tap dowels into the end panels",
      detail: "Two in the top of each end panel.",
      fix: ends.map((e) => ({ ...DOWEL, count: 2, on: e < 0 ? "L" : "R", dir: [0, 1, 0] as Vec3, at: [-1, 1].map((z) => [e * sx, sideH, z * (sideD / 4)] as Vec3) })),
      tools: ["hammer"],
      pose: "+y",
      ...(bench ? { people: 2 as const } : {}),
    },
    {
      title: "Lay the seat planks on",
      detail: "Their edges slot together, and the cut-outs meet to make the handle in the middle.",
      add: ["S0", "S1"],
    },
    {
      title: "Screw the seat down",
      detail: "One screw down through each plank into each end panel.",
      fix: [{ ...SCREW, count: 4, dir: [0, -1, 0], at: ends.flatMap((e) => [-1, 1].map((z) => [e * sx, H, z * (sideD / 2 - 30)] as Vec3)) }], // outside the dowels
    },
  );
  if (bench) {
    steps.push({
      title: "Turn it over and screw the rails to the seat",
      detail: "Upside down on the rug. Two screws through each rail into the seat.",
      fix: [{ ...SCREW, count: 4, dir: [0, 1, 0], at: [rz, -rz].flatMap((z) => [-W / 6, W / 6].map((x) => [x, sideH - rh, z] as Vec3)) }],
      pose: "-y",
      people: 2,
      warnings: ["floor"],
    });
  }
  return { parts, steps };
}

const family: Family = {
  names: ["PERJOHAN"],
  recipe(s) {
    if (!/stool|bench/i.test(`${s.slug} ${s.variant}`)) return null;
    return recipe(s);
  },
};
export default family;
