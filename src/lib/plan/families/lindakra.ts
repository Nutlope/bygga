import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * LINDÅKRA, read from the sofa-bed's manual (the UK sofa-bed and the US sleeper sofa share it). It is a padded bed
 * base with a lift-up storage lid, a backrest and one armrest, plus a rounded storage pouffe that stands at the open
 * end (as the photo shows: armrest on the left, pouffe on the right; the manual's second half is the mirror image).
 * The backrest lies on the floor and the base stands on its back on it: two long screws and two bolts with washers
 * through the base hold it. Still lying on its back, the base gets four legs and their felt pads, then it is stood
 * up and the armrest is bolted on from inside the storage space with four bolts. The pouffe gets its own four legs
 * and pads upside down, is pushed against the base and hooked to it with two U brackets, its lid goes on, and the
 * two back cushions go on last.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

function recipe(s: ProductSpec): CustomParams | null {
  if (!/lind[aå]kra/i.test(s.slug ?? s.name) || !/sofa/i.test(s.variant)) return null;
  // IKEA's measures: 206 wide, 87 deep, armrest 67 high and 7 wide, seat 43 high, 135 wide, bed 80 x 200, legs 4
  const W = 2060, D = 870;
  const armW = 70, armH = 670, seatH = 430, legH = 40, seatW = 1350, backT = 70;
  const x0 = -W / 2;
  const xa = x0 + armW; // where the base starts
  const xb = xa + seatW; // where the pouffe starts
  const zb = -D / 2 + backT; // front of the backrest
  const z1 = D / 2;
  const boxD = z1 - zb;
  const lidT = 100;
  const pX0 = xb, pX1 = W / 2;
  const pW = pX1 - pX0;
  const r = boxD / 2;
  const pouffePieces = (h: number): PartPiece[] => [
    { shape: "box", size: [pW - r + 2, h, boxD], pos: [-(pW - (pW - r + 2)) / 2, 0, 0] },
    { shape: "halfcyl", size: [boxD, h, r], pos: [pW / 2 - r / 2, 0, 0], rot: [0, Math.PI / 2, 0] },
  ];
  const pBaseH = seatH - lidT - legH;
  const parts: CustomPart[] = [
    { id: "BK", name: "Backrest", size: [seatW, armH - legH, backT], pos: [(xa + xb) / 2, legH + (armH - legH) / 2, -D / 2 + backT / 2], material: "soft" },
    {
      id: "BED",
      name: "Bed base",
      size: [seatW, seatH - legH, boxD],
      pos: [(xa + xb) / 2, legH + (seatH - legH) / 2, (zb + z1) / 2],
      pieces: [
        { shape: "box", size: [seatW, seatH - legH - lidT, boxD], pos: [0, -lidT / 2, 0] },
        { shape: "box", size: [seatW - 6, lidT, boxD - 6], pos: [0, (seatH - legH - lidT) / 2, 0] },
      ],
      material: "soft",
    },
    { id: "ARM", name: "Armrest", size: [armW, armH - legH, D], pos: [x0 + armW / 2, legH + (armH - legH) / 2, 0], material: "soft" },
    { id: "PB", name: "Pouffe", size: [pW, pBaseH, boxD], pos: [(pX0 + pX1) / 2, legH + pBaseH / 2, (zb + z1) / 2], pieces: pouffePieces(pBaseH), material: "soft" },
    { id: "PL", name: "Pouffe lid", size: [pW, lidT, boxD], pos: [(pX0 + pX1) / 2, seatH - lidT / 2, (zb + z1) / 2], pieces: pouffePieces(lidT), material: "soft" },
  ];
  const cw = 620;
  [xa + seatW / 4, xa + (3 * seatW) / 4].forEach((x, i) =>
    parts.push({ id: `C${i}`, name: "Back cushion", size: [cw, 460, 170], pos: [x, seatH + 230, zb + 95], rot: [-0.18, 0, 0], material: "soft" }),
  );

  const inset = 70;
  const bedLegs: Vec3[] = [xa + inset, xb - inset].flatMap((x) => [zb + inset, z1 - inset].map((z) => [x, legH, z] as Vec3));
  const pLegs: Vec3[] = [
    [pX0 + inset, legH, zb + inset],
    [pX0 + inset, legH, z1 - inset],
    [pX1 - r + 60, legH, zb + inset],
    [pX1 - r + 60, legH, z1 - inset],
  ];
  const foot = (pts: Vec3[], on: string) => at("foot", pts, [0, 1, 0], on, undefined, { len: legH, dia: 40, name: "Leg" });
  const pads = (pts: Vec3[], on: string) => at("glide", pts.map((p) => [p[0], 0, p[2]] as Vec3), [0, 1, 0], on, undefined, { len: 3, dia: 34, name: "Felt pad" });
  // from inside the base, through its back frame into the backrest
  const backPts = (xs: number[], y: number) => xs.map((x) => [x, y, zb + 30] as Vec3);
  const screwPts = backPts([xa + 250, xb - 250], legH + 120);
  const boltPts = backPts([xa + 250, xb - 250], seatH - lidT - 60);
  const armPts: Vec3[] = [zb + 120, z1 - 120].flatMap((z) => [legH + 80, seatH - lidT - 60].map((y) => [xa + 20, y, z] as Vec3));
  const washer = (pts: Vec3[], dir: Vec3, on: string) => at("washer", pts, dir, on, undefined, { len: 1.5, dia: 20 });

  const steps: CustomStep[] = [
    {
      title: "Stand the bed base on the backrest",
      detail: "Lay the backrest on a rug, padded side down. Stand the base on its back on the backrest's lower edge, ends lined up.",
      add: ["BK", "BED"],
      pose: "+z",
      warnings: ["floor"],
      from: { BED: [0, 0, 400] },
    },
    {
      title: "Screw the base to the backrest",
      detail: "Lift the lid and put the two long pointed screws, each with a washer, through the lower holes in the back of the base.",
      fix: [at("screw", screwPts, [0, 0, -1], "BED", "BK", { len: 90, dia: 6, name: "Long screw" }), washer(screwPts, [0, 0, -1], "BED")],
      tools: ["allen"],
    },
    {
      title: "Bolt it at the top",
      detail: "Two bolts with washers through the upper holes. These are the blunt ones, not the pointed screws.",
      fix: [at("bolt", boltPts, [0, 0, -1], "BED", "BK", { len: 70, dia: 6 }), washer(boltPts, [0, 0, -1], "BED")],
      tools: ["allen"],
    },
    {
      title: "Screw the legs into the base",
      detail: "Turn the base so you can reach its underside. Four legs, by hand until they are tight.",
      fix: [foot(bedLegs, "BED")],
      warnings: ["hand"],
    },
    {
      title: "Stick a felt pad under each leg",
      detail: "Then stand the base up on its legs, with a helper if you need one.",
      fix: [pads(bedLegs, "BED")],
    },
    {
      title: "Bolt the armrest to the end",
      detail: "Stand the base up and lift the lid. Four bolts with washers from inside the storage space into the armrest.",
      add: ["ARM"],
      fix: [at("bolt", armPts, [-1, 0, 0], "BED", "ARM", { len: 70, dia: 6 }), washer(armPts, [-1, 0, 0], "BED")],
      pose: "+y",
      tools: ["allen"],
    },
    {
      title: "Screw the legs into the pouffe",
      detail: "Lay the pouffe upside down on the rug and screw in its four legs by hand.",
      add: ["PB"],
      fix: [foot(pLegs, "PB")],
      warnings: ["hand"],
      from: { PB: [500, 0, 0] },
    },
    { title: "Stick on the pouffe's felt pads", detail: "One under each leg, then turn the pouffe over.", fix: [pads(pLegs, "PB")] },
    {
      title: "Hook the pouffe to the base",
      detail: "Push it against the open end, lid of the base up. Two U brackets hook over both frames inside.",
      fix: [at("clamp", [[xb, seatH - lidT, zb + 150], [xb, seatH - lidT, z1 - 150]], [0, -1, 0], "BED", "PB", { len: 60, dia: 40, name: "U bracket" })],
    },
    { title: "Lay the lid on the pouffe", detail: "It sits loose on top and lifts off to reach the storage.", add: ["PL"] },
    { title: "Put the back cushions on", detail: "Two cushions, leaning against the backrest.", add: ["C0", "C1"] },
  ];
  return { parts, steps };
}

const family: Family = { names: ["LINDÅKRA", "LINDAKRA"], recipe };
export default family;
