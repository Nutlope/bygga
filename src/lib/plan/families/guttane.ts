import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * GUTTANE, read from its manual (one manual for the coffee table and the side table). Each end comes as a leg frame
 * already glued up: two tapered legs and a short rail. The long rail takes a dowel in each end and is pushed between
 * the two frames, all upside down on a rug; a barrel nut drops into each end of the rail and a long Allen bolt goes
 * through each frame into it. The frame is then lowered onto the upside-down top (lipped on its long edges) and
 * screwed on with eight Allen screws, four per end. Felt pads go under the legs before it is turned over.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

function recipe(s: ProductSpec): CustomParams | null {
  if (!/guttane/i.test(s.slug ?? s.name)) return null;
  // IKEA's measures: 116 or 58 long, 39 wide, 32 high
  const W = s.size.w * 10, D = 390, H = 320;
  const topT = 22, lip = 12, lipW = 28;
  const topY0 = H - lip - topT; // underside of the top
  const L = 45; // leg, square at the top
  const inset = W > 800 ? 85 : 50;
  const xl = W / 2 - inset - L / 2; // leg centres
  const zl = D / 2 - 40 - L / 2;
  const railH = 60, railT = 22;
  const legH = topY0;

  const frame: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [L, legH, L], pos: [0, 0, sz * zl] })),
    { shape: "box", size: [railT, railH, 2 * zl - L], pos: [0, legH / 2 - railH / 2, 0] },
  ];
  const railLen = 2 * xl - railT;
  const railY = topY0 - railH / 2;
  const parts: CustomPart[] = [
    { id: "R", name: "Long rail", size: [railLen, railH, railT], pos: [0, railY, 0], material: "wood" },
    { id: "E1", name: "Leg frame", size: [railT, legH, 2 * zl + L], pos: [-xl, legH / 2, 0], pieces: frame, material: "wood" },
    { id: "E2", name: "Leg frame", size: [railT, legH, 2 * zl + L], pos: [xl, legH / 2, 0], pieces: frame, material: "wood" },
    {
      id: "TOP",
      name: "Table top",
      size: [W, topT + lip, D],
      pos: [0, topY0 + (topT + lip) / 2, 0],
      pieces: [
        { shape: "box", size: [W, topT, D], pos: [0, -lip / 2, 0] },
        ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [W, lip, lipW], pos: [0, topT / 2, sz * (D / 2 - lipW / 2)] })),
      ],
      material: "wood",
    },
  ];

  const ends = [-1, 1];
  const railEnd = (sx: number): Vec3 => [sx * railLen / 2, railY, 0];
  const nuts = ends.map((sx): Vec3 => [sx * (railLen / 2 - 35), railY - railH / 2, 0]);
  const bolts = ends.map((sx): Vec3 => [sx * (xl + railT / 2), railY - 18, 0]); // below the dowel, level with the barrel nut
  const screwsAt = (sx: number): Vec3[] => [-zl, -zl / 2, zl / 2, zl].map((z) => [sx * xl, topY0 - 25, z]);
  const feet = ends.flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, 0, sz * zl]));

  const steps: CustomStep[] = [
    {
      title: "Tap a dowel into each end of the long rail",
      detail: "Lay the rail on a rug. One dowel goes into the middle hole at each end.",
      add: ["R"],
      fix: ends.map((sx) => at("dowel", [railEnd(sx)], [-sx, 0, 0], "R")),
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Push a leg frame onto each end",
      detail: "Turn the frames legs up, with the rail's round holes facing up, and press the dowels home.",
      add: ["E1", "E2"],
      pose: "-y",
    },
    {
      title: "Drop the barrel nuts into the rail",
      detail: "One in each round hole near the ends. Turn the slot so it lines up with the bolt hole.",
      fix: [at("nut", nuts, [0, 1, 0], "R", undefined, { len: 14, dia: 10, name: "Barrel nut" })],
      tools: ["flathead"],
    },
    {
      title: "Bolt the leg frames to the rail",
      detail: "One long bolt through each frame into its barrel nut. Hold the nut's slot steady with a screwdriver and tighten.",
      fix: ends.map((sx, i) => at("bolt", [bolts[i]], [-sx, 0, 0], sx < 0 ? "E1" : "E2", "R", { len: 90, dia: 6 })),
      tools: ["allen", "flathead"],
    },
    {
      title: "Lower the frame onto the top",
      detail: "Lay the top upside down on the rug, then set the frame on it with the holes lined up.",
      add: ["TOP"],
      from: { TOP: [0, -260, 0] },
    },
    {
      title: "Screw the frame to the top",
      detail: "Four screws through each leg frame into the top. Tighten them all with the Allen key.",
      fix: ends.map((sx) => at("bolt", screwsAt(sx), [0, 1, 0], sx < 0 ? "E1" : "E2", "TOP", { len: 40, dia: 6, name: "Allen screw" })),
      tools: ["allen"],
    },
    {
      title: "Stick a felt pad under each leg",
      detail: "Press each one on firmly, in the middle of the leg's end.",
      fix: [at("glide", feet, [0, 1, 0], undefined, undefined, { len: 4, dia: 30, name: "Felt pad" })],
    },
    { title: "Turn the table over", detail: "Lift it by the top, not the legs, and stand it on its feet.", pose: "+y", kind: "flip" },
  ];
  return { parts, steps };
}

const family: Family = { names: ["GUTTANE"], recipe };
export default family;
