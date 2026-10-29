import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * MARKUS, read from the office chair's manual (the same one for every colour). Five castors click into the star
 * base, the gas lift loses its cap and drops into the hub. With the seat upside down on a rug, the tilt mechanism
 * is bolted on: two flange bolts at the back and two long bolts with washers at the front, snug first and then
 * tightened. The tall mesh back slides its bracket onto the mechanism's arm and takes three flange bolts, also
 * snug first. Two people lower the seat onto the gas lift, and the two loop armrests are bolted to the sides of the
 * seat with the last four long bolts. The set with a floor protector just adds the mat under it.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const FLANGE = { len: 16, dia: 8, name: "Flange bolt" };
const LONG = { len: 35, dia: 8 };

function recipe(s: ProductSpec): CustomParams | null {
  if (!/markus/i.test(s.slug ?? s.name) || !/chair/i.test(s.variant)) return null;
  const mat = /floor protector/i.test(`${s.variant} ${s.slug ?? ""}`) || /armrests/i.test(s.slug ?? "");
  // IKEA's measures for the chair: 62 wide, 60 deep, 129 high at its lowest, seat 46 high, 53 wide, 47 deep
  const H = 1290, seatTop = 460, seatT = 80, seatW = 530, seatD = 470;
  const R = 320; // star base reach
  const angles = Array.from({ length: 5 }, (_, i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const dirOf = (a: number): [number, number] => [Math.cos(a), -Math.sin(a)];
  const baseY = 95;
  const basePieces: PartPiece[] = [
    { shape: "cyl", size: [80, 70, 80], pos: [0, 0, 0] },
    ...angles.map((a): PartPiece => {
      const [dx, dz] = dirOf(a);
      return { shape: "box", size: [R - 20, 26, 40], pos: [(dx * (R + 20)) / 2, -8, (dz * (R + 20)) / 2], rot: [0, a, 0] };
    }),
  ];
  const seatY0 = seatTop - seatT;
  const mechY0 = seatY0 - 50;
  const zSeat = 20;
  const backZ = zSeat - seatD / 2 - 40;
  const backY0 = seatTop + 10;
  const backH = H - backY0;
  const backPieces: PartPiece[] = [
    { shape: "box", size: [500, backH - 160, 20], pos: [0, -80, 0], material: "fiber" },
    { shape: "box", size: [30, backH - 160, 40], pos: [-235, -80, 0] },
    { shape: "box", size: [30, backH - 160, 40], pos: [235, -80, 0] },
    { shape: "box", size: [470, 160, 60], pos: [0, backH / 2 - 80, 0], material: "soft" },
    { shape: "box", size: [440, 110, 50], pos: [0, -backH / 2 + 230, 16], material: "soft" },
  ];
  const brkPieces: PartPiece[] = [
    { shape: "box", size: [70, 40, 200], pos: [0, -120, 50] }, // the sleeve that slides over the mechanism's arm
    { shape: "box", size: [70, 260, 16], pos: [0, 0, -50] },
  ];
  // the mechanism, with its arm reaching back into the back bracket's sleeve
  const armZ = backZ + 12, mz1Body = zSeat - 20 + 130, mz0Body = zSeat - 20 - 130;
  const mecZ = (armZ + mz1Body) / 2;
  const mecPieces: PartPiece[] = [
    { shape: "box", size: [220, 50, 260], pos: [0, 0, zSeat - 20 - mecZ] },
    { shape: "box", size: [50, 20, mz0Body - armZ], pos: [0, -23, (mz0Body + armZ) / 2 - mecZ] },
  ];
  const armY = 690;
  const armPieces = (sx: number): PartPiece[] => [
    { shape: "box", size: [40, 30, 300], pos: [0, 115, 0] },
    { shape: "box", size: [30, 230, 30], pos: [0, 0, 135] },
    { shape: "box", size: [30, 200, 30], pos: [0, 15, -135] },
    { shape: "box", size: [60, 30, 120], pos: [-sx * 30, -115, 0] },
  ];
  const armX = seatW / 2 + 30;
  const parts: CustomPart[] = [
    { id: "BASE", name: "Star base", size: [2 * R, 70, 2 * R], pos: [0, baseY, 0], pieces: basePieces, material: "metal" },
    { id: "GAS", name: "Gas lift", size: [50, mechY0 - 90 + 20, 50], pos: [0, (mechY0 + 20 + 90) / 2, 0], shape: "cyl", material: "metal" },
    { id: "MEC", name: "Tilt mechanism", size: [220, 50, mz1Body - armZ], pos: [0, mechY0 + 25, mecZ], pieces: mecPieces, material: "metal" },
    { id: "SEAT", name: "Seat", size: [seatW, seatT, seatD], pos: [0, seatY0 + seatT / 2, zSeat], material: "soft" },
    { id: "BRK", name: "Back bracket", size: [70, 260, 116], pos: [0, mechY0 + 130 - 8, backZ + 58], pieces: brkPieces, material: "metal" },
    { id: "BACK", name: "Backrest", size: [500, backH, 60], pos: [0, backY0 + backH / 2, backZ - 30], pieces: backPieces, material: "soft" },
    { id: "AL", name: "Armrest", size: [60, 260, 300], pos: [-armX, armY - 115, zSeat], pieces: armPieces(-1), material: "metal" },
    { id: "AR", name: "Armrest", size: [60, 260, 300], pos: [armX, armY - 115, zSeat], pieces: armPieces(1), material: "metal" },
  ];
  if (mat) parts.push({ id: "MAT", name: "Floor protector", size: [1000, 3, 1200], pos: [0, 1.5, 0], material: "glass" });

  const tips: Vec3[] = angles.map((a) => [dirOf(a)[0] * R, baseY - 35, dirOf(a)[1] * R]);
  const mz0 = zSeat - 20 - 100, mz1 = zSeat - 20 + 100;
  const backBolts: Vec3[] = [[-80, mechY0, mz0], [80, mechY0, mz0]];
  const frontBolts: Vec3[] = [[-80, mechY0, mz1], [80, mechY0, mz1]];
  const brkBolts: Vec3[] = [-40, 0, 40].map((dz) => [35, mechY0 + 2, backZ + 60 + dz] as Vec3);
  const armBolts = (sx: number): Vec3[] => [-60, 60].map((dz) => [sx * (armX - 30 - 30), seatY0 + 30, zSeat + dz] as Vec3);
  const steps: CustomStep[] = [
    {
      title: "Click the castors into the base",
      detail: "Lay the base upside down on a rug. Push each castor's pin into the end of a leg until it clicks home.",
      add: ["BASE"],
      fix: [at("castor", tips, [0, 1, 0], "BASE", undefined, { len: 58, dia: 50 })],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Pull the cap off the gas lift", detail: "The plastic cap on its thin end only protects it in the box, so throw it away.", pose: "+y" },
    { title: "Push the gas lift into the base", detail: "Stand the base on its castors and drop the lift into the hub, thick end down.", add: ["GAS"], from: { GAS: [0, 360, 0] } },
    {
      title: "Bolt the mechanism under the seat",
      detail: "Lay the seat upside down on the rug and set the mechanism on it, lever to the right. Two flange bolts at the back, only snug.",
      add: ["SEAT", "MEC"],
      fix: [at("bolt", backBolts, [0, 1, 0], "MEC", "SEAT", FLANGE)],
      tools: ["allen"],
      warnings: ["loose"],
      from: { SEAT: [0, 500, 0], MEC: [0, 620, 0] },
    },
    {
      title: "Add the two long bolts at the front",
      detail: "Each with its washer, also only snug.",
      fix: [at("washer", frontBolts, [0, 1, 0], "MEC", undefined, { len: 1.5, dia: 18 }), at("bolt", frontBolts, [0, 1, 0], "MEC", "SEAT", LONG)],
      tools: ["allen"],
      warnings: ["loose"],
    },
    { title: "Tighten the four mechanism bolts", detail: "Now firmly, the two at the back and the two at the front.", tools: ["allen"], kind: "bolts" },
    {
      title: "Slide the back onto the mechanism",
      detail: "Push the bracket under the back down over the mechanism's arm as far as it goes.",
      add: ["BRK", "BACK"],
      from: { BRK: [0, 320, 0], BACK: [0, 320, 0] },
    },
    {
      title: "Bolt the back bracket on",
      detail: "Three flange bolts through the side of the bracket, only snug for now.",
      fix: [at("bolt", brkBolts, [-1, 0, 0], "BRK", "MEC", FLANGE)],
      tools: ["allen"],
      warnings: ["loose"],
    },
    { title: "Tighten the back bracket bolts", detail: "All three, firmly.", tools: ["allen"], kind: "bolts" },
    {
      title: "Lower the seat onto the gas lift together",
      detail: "Hold it by the seat and the back, straight above the base, and press it down onto the lift.",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Bolt on the armrests",
      detail: "Two long bolts into each side of the seat, tightened with the Allen key.",
      add: ["AL", "AR"],
      fix: [at("bolt", armBolts(-1), [1, 0, 0], "AL", "SEAT", LONG), at("bolt", armBolts(1), [-1, 0, 0], "AR", "SEAT", LONG)],
      tools: ["allen"],
    },
  ];
  if (mat) steps.push({ title: "Lay the floor protector and roll the chair onto it", detail: "Smooth side up, where you'll sit at the desk.", add: ["MAT"], from: { MAT: [0, 0, 900] } });
  return { parts, steps };
}

const family: Family = { names: ["MARKUS"], recipe };
export default family;
