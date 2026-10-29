import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * EKEDALEN, read from IKEA's manuals (the products are no longer sold in the UK or US; their manuals still are).
 *
 * Chair: built upside down on a rug. The front rail's corner blocks are bolted up into the two side rails (barrel
 * nuts), the front legs are pushed onto the blocks' dowel holes and locked with a turn-in connector each. The back
 * frame lies on its back, the back rail is bolted to its legs, the front half is lowered onto it and its side rails
 * locked with two more connectors. The upholstered seat takes four clips, is pressed in from below, a stop is
 * screwed in at the back and the clips are pushed until they click.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const shift = (ps: PartPiece[], c: Vec3): PartPiece[] => ps.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));

/* ---------------------------------------------------------------- chair */

function chair(s: ProductSpec): CustomParams {
  // IKEA: 45 wide, 51 deep, 95 high, seat 47 high
  const W = Math.round(s.size.w * 10) || 450, D = Math.round(s.size.d * 10) || 510, H = Math.round(s.size.h * 10) || 950;
  const L = 40; // legs, square
  const yR0 = 400, yR1 = 470; // the side rails and the back rail, the seat sits on them
  const yB0 = 330; // the front corner blocks, under the side rails
  const xl = W / 2 - L / 2, zf = D / 2 - L / 2, zb = -D / 2 + L / 2;
  const bz0 = -D / 2 + L, bz1 = bz0 + 45; // the back rail, its ends in front of the back legs
  const xr = W / 2 - 11; // side rails, 22 thick
  const g2 = [-1, 1];
  const side = (g: number) => (g < 0 ? "0" : "1");

  // back frame: two legs up into the backrest, a curved bottom rail, vertical slats and a top rail
  const cBF: Vec3 = [0, H / 2, zb + 10];
  const back: PartPiece[] = [
    ...g2.map((g): PartPiece => ({ shape: "box", size: [L, H, L], pos: [g * xl, H / 2, zb] })),
    { shape: "box", size: [2 * xl - L, 70, 24], pos: [0, H - 45, zb + 4] },
    { shape: "box", size: [2 * xl - L, 60, 24], pos: [0, yR1 + 110, zb + 4] },
    ...[-2, -1, 0, 1, 2].map((k): PartPiece => ({ shape: "box", size: [28, H - 80 - (yR1 + 140), 14], pos: [k * ((2 * xl - L) / 6), (H - 80 + yR1 + 140) / 2, zb + 2] })),
  ];
  const cF: Vec3 = [0, (yB0 + yR0) / 2, zf];
  const front: PartPiece[] = [
    { shape: "box", size: [2 * xl - L, yR0 - yB0, 22], pos: [0, (yB0 + yR0) / 2, D / 2 - 11] },
    ...g2.map((g): PartPiece => ({ shape: "box", size: [L, yR0 - yB0, L], pos: [g * xl, (yB0 + yR0) / 2, zf] })),
  ];
  const parts: CustomPart[] = [
    { id: "F", name: "Front rail", size: [W, yR0 - yB0, L], pos: cF, pieces: shift(front, cF), material: "wood" },
    ...g2.map((g): CustomPart => ({ id: `R${side(g)}`, name: "Side rail", size: [22, yR1 - yR0, D / 2 - bz1], pos: [g * xr, (yR0 + yR1) / 2, (D / 2 + bz1) / 2], material: "wood" })),
    ...g2.map((g): CustomPart => ({ id: `L${side(g)}`, name: "Front leg", size: [L, yB0, L], pos: [g * xl, yB0 / 2, zf], material: "wood" })),
    { id: "B", name: "Back frame", size: [W, H, L + 20], pos: cBF, pieces: shift(back, cBF), material: "wood" },
    { id: "K", name: "Back rail", size: [W, yR1 - yR0, bz1 - bz0], pos: [0, (yR0 + yR1) / 2, (bz0 + bz1) / 2], material: "wood" },
    { id: "S", name: "Seat", size: [W - 10, 45, D - L - 5], pos: [0, yR1 + 22.5, (L + 5) / 2], material: "soft" },
  ];
  const steps: CustomStep[] = [
    {
      title: "Bolt the front rail to the side rails",
      detail: "Lay the parts upside down on a rug. A barrel nut in each side rail, slot towards the hole, then a long bolt through each corner block into it.",
      add: ["F", "R0", "R1"],
      fix: [
        ...g2.map((g) => fx("nut", [[g * (xr + 11), yR0 + 35, zf]], [-g, 0, 0], { name: "Barrel nut", len: 14, dia: 10, on: `R${side(g)}` })),
        fx("bolt", g2.map((g): Vec3 => [g * xl + g * 4, yB0, zf]), [0, 1, 0], { len: 100, dia: 6, on: "F" }),
      ],
      tools: ["flathead", "allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Push the front legs onto the corner blocks",
      detail: "The thick dowel goes in the big hole, the thin one in the small hole. Push them all the way in.",
      add: ["L0", "L1"],
    },
    {
      title: "Lock the front legs",
      detail: "Hook a connector into the slot on the inside of each leg and turn it tight with the Allen key.",
      fix: g2.map((g) => fx("connector", [[g * (xl - L / 2), yB0 - 40, zf]], [g, 0, 0], { name: "Leg connector", len: 30, dia: 14, on: `L${side(g)}` })),
      tools: ["allen"],
    },
    {
      title: "Bolt the back rail to the back legs",
      detail: "Lay the back frame on its back on the rug. A barrel nut in each back leg, then a bolt through each end of the rail into it.",
      fix: [
        ...g2.map((g) => fx("nut", [[g * (xl + L / 2), (yR0 + yR1) / 2, zb]], [-g, 0, 0], { name: "Barrel nut", len: 14, dia: 10, on: "B" })),
        fx("bolt", g2.map((g): Vec3 => [g * (xl + 4), (yR0 + yR1) / 2, bz1]), [0, 0, -1], { len: 70, dia: 6, on: "K" }),
      ],
      tools: ["flathead", "allen"],
      pose: "+z",
      wait: ["B", "K"],
      from: { B: [-650, 0, 0], K: [-650, 0, 0] },
    },
    {
      title: "Join the two halves",
      detail: "Lower the front half onto the back frame so the dowels in the ends of the side rails go into the back rail.",
      add: ["B", "K"],
      from: { B: [0, 0, -250], K: [0, 0, -250] },
    },
    {
      title: "Lock the side rails",
      detail: "One connector on the inside of each rail, hooked in and turned tight like the front ones.",
      fix: g2.map((g) => fx("connector", [[g * (xr - 11), (yR0 + yR1) / 2, bz1 + 40]], [g, 0, 0], { name: "Leg connector", len: 30, dia: 14, on: `R${side(g)}` })),
      tools: ["allen"],
    },
    {
      title: "Push the clips into the seat",
      detail: "Lay the seat face down. One clip in each pair of holes near the corners, its hook towards the edge.",
      fix: [fx("clip", g2.flatMap((gx) => g2.map((gz): Vec3 => [gx * (xr - 50), yR1, (L + 5) / 2 + gz * ((D - L) / 2 - 80)])), [0, 1, 0], { name: "Seat clip", len: 30, dia: 20, on: "S" })],
      wait: ["S"],
      from: { S: [-650, 0, 0] },
    },
    {
      title: "Press the frame down onto the seat",
      detail: "Hold the chair upside down over the seat and push it down so the clips go in between the rails.",
      add: ["S"],
      pose: "-y",
      from: { S: [0, 220, 0] },
    },
    {
      title: "Screw the seat stop on at the back",
      detail: "Its flat side against the back rail, one screw.",
      fix: [
        fx("clip", [[0, yR1 + 4, bz1 + 12]], [0, -1, 0], { name: "Seat stop", len: 20, dia: 24, on: "K" }),
        fx("screw", [[0, yR1, bz1 - 22]], [0, -1, 0], { len: 16, dia: 4, on: "K" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Click the clips shut", detail: "Push each of the four clips over the rail until it clicks. Then turn the chair the right way up.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["EKEDALEN"],
  recipe(s) {
    if (s.archetype === "seat" && /chair/i.test(s.variant)) return chair(s);
    return null;
  },
};
export default family;
