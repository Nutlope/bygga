import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { rotate } from "../math";

/**
 * UTKLASSNING, read from the gaming chair's manual. The one-piece star base lies upside down for its five castors,
 * then stands up for the gas lift (its cap pulled off first). The back is built on its own: the lumbar plate is
 * screwed to the steel spine with two small screws, the mesh back is pressed on, the headrest slides into the top,
 * two bolts go in loosely at the top and two at the bottom bracket, the top ones are tightened and capped. Then the
 * seat lies upside down on a table: three bolts for each armrest, four for the mechanism, the spine's bracket slides
 * into the mechanism and takes three more, and the seat goes onto the gas lift. Base and back wait beside the seat
 * until they are joined.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string | undefined, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

/** A round tube from a to b, in product coordinates. */
function tube(a: Vec3, b: Vec3, dia: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const u = d.map((v) => v / len);
  return { shape: "cyl", size: [dia, len + dia * 0.4, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(u[2], u[1]), 0, Math.asin(-u[0])] };
}

/** A part made of pieces placed in product coordinates. */
function abs(id: string, name: string, pieces: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pieces)
    for (const a of [-1, 1])
      for (const b of [-1, 1])
        for (const k of [-1, 1]) {
          const v = rotate([(a * p.size[0]) / 2, (b * p.size[1]) / 2, (k * p.size[2]) / 2], p.rot ?? [0, 0, 0]);
          for (let i = 0; i < 3; i++) {
            lo[i] = Math.min(lo[i], p.pos[i] + v[i]);
            hi[i] = Math.max(hi[i], p.pos[i] + v[i]);
          }
        }
  const c = lo.map((v, i) => (v + hi[i]) / 2) as Vec3;
  return { id, name, size: lo.map((v, i) => hi[i] - v) as Vec3, pos: c, material, pieces: pieces.map((p) => ({ ...p, pos: p.pos.map((v, i) => v - c[i]) as Vec3 })) };
}

// the fittings, as the manual's fittings page shows them
const LONG_BOLT = { name: "Allen bolt", len: 20, dia: 6 }; // 9 of them: armrests and back
const BUTTON = { name: "Button-head bolt", len: 14, dia: 6 }; // 6: back bracket and mechanism
const CAP_BOLT = { name: "Socket bolt", len: 22, dia: 6 }; // 2: top of the spine
const SMALL = { len: 12, dia: 4 }; // 2: lumbar plate

function chair(s: ProductSpec): CustomParams {
  // IKEA: 68 wide (armrests), 61 deep, 125 high with the seat at its lowest (47 cm); seat 50 wide, 42 deep
  const W = s.size.w * 10;
  const castor = 58, yLeg = castor + 18, R = 315, hubTop = 150;
  const seatTop = 470, seatT = 80, seatW = 500, seatD = 480, zs = 30;
  const ySeat0 = seatTop - seatT, yMech0 = ySeat0 - 50;
  const zSpine = -300, yBack0 = seatTop + 40, yBack1 = 1100;
  const xArm = W / 2 - 45, yPad = 650;
  const angles = [0, 1, 2, 3, 4].map((i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const dirOf = (a: number): [number, number] => [Math.cos(a), -Math.sin(a)];
  const tips = angles.map((a): Vec3 => [dirOf(a)[0] * (R - 15), castor, dirOf(a)[1] * (R - 15)]);

  const parts: CustomPart[] = [
    abs(
      "BASE",
      "Star base",
      [
        { shape: "cyl", size: [76, hubTop - 50, 76], pos: [0, (hubTop + 50) / 2, 0] },
        ...angles.map((a) => tube([dirOf(a)[0] * 30, yLeg + 30, dirOf(a)[1] * 30], [dirOf(a)[0] * R, yLeg, dirOf(a)[1] * R], 34)),
      ],
      "metal",
    ),
    abs(
      "SPINE",
      "Back spine",
      [
        // the flat bracket reaches into the slot at the back of the mechanism
        { shape: "box", size: [70, 14, 200], pos: [0, yMech0 + 7, -130] },
        tube([0, yMech0 + 7, -225], [0, yBack0 - 20, zSpine], 30),
        { shape: "box", size: [60, yBack1 - yBack0 + 40, 24], pos: [0, (yBack0 + yBack1) / 2, zSpine] },
        { shape: "box", size: [70, 60, 40], pos: [0, yBack0 + 20, zSpine + 8] },
      ],
      "metal",
    ),
    { id: "LUMB", name: "Lumbar plate", size: [300, 130, 14], pos: [0, 680, zSpine + 19], material: "metal" },
    {
      id: "BACK",
      name: "Mesh back",
      size: [480, yBack1 - yBack0, 50],
      pos: [0, (yBack0 + yBack1) / 2, zSpine + 51],
      material: "soft",
      pieces: [
        { shape: "box", size: [480, 330, 50], pos: [0, -(yBack1 - yBack0) / 2 + 165, 0] },
        { shape: "box", size: [400, 140, 50], pos: [0, -(yBack1 - yBack0) / 2 + 400, 0] },
        { shape: "box", size: [340, yBack1 - yBack0 - 470, 50], pos: [0, (yBack1 - yBack0) / 2 - (yBack1 - yBack0 - 470) / 2, 0] },
      ],
    },
    {
      id: "HEAD",
      name: "Headrest",
      size: [280, 250, 50],
      pos: [0, 1125, zSpine + 20],
      material: "soft",
      pieces: [
        { shape: "cyl", size: [280, 50, 170], pos: [0, 40, 0], rot: [Math.PI / 2, 0, 0] },
        { shape: "box", size: [40, 120, 20], pos: [0, -65, -15], material: "metal" },
      ],
    },
    {
      id: "SEAT",
      name: "Seat",
      size: [seatW, seatT, seatD],
      pos: [0, ySeat0 + seatT / 2, zs],
      material: "soft",
      pieces: [
        { shape: "box", size: [seatW, seatT - 15, seatD], pos: [0, 7.5, 0] },
        { shape: "box", size: [seatW - 30, 15, seatD - 30], pos: [0, -seatT / 2 + 7.5, 0], material: "metal" },
      ],
    },
    ...[-1, 1].map((sx, i) =>
      abs(
        `ARM${i}`,
        "Armrest",
        [
          { shape: "box", size: [150, 12, 140], pos: [sx * 180, ySeat0 - 6, zs - 40] },
          { shape: "box", size: [30, yPad - ySeat0, 50], pos: [sx * (seatW / 2 + 22), (yPad + ySeat0) / 2 - 6, zs - 60] },
          { shape: "box", size: [90, 30, 250], pos: [sx * xArm, yPad + 15, zs - 40], material: "soft" },
        ],
        "metal",
      ),
    ),
    { id: "MECH", name: "Mechanism", size: [220, 50, 240], pos: [0, yMech0 + 25, zs - 10], material: "metal" },
  ];

  const base = ["BASE"], back = ["SPINE", "LUMB", "BACK", "HEAD"];
  const baseAside: Vec3 = [-800, 0, 0], backAside: Vec3 = [800, 0, 0];
  const asideOf = (ids: string[], off: Vec3) => Object.fromEntries(ids.map((id) => [id, off]));
  const armBolts = [-1, 1].map((sx, i) => fx("bolt", [[sx * 140, zs - 80], [sx * 220, zs - 80], [sx * 180, zs + 10]].map(([x, z]): Vec3 => [x, ySeat0 - 12, z]), [0, 1, 0], `ARM${i}`, { ...LONG_BOLT, mate: "SEAT" }));
  const mechBolts = [-1, 1].flatMap((sx) => [zs - 100, zs + 80].map((z): Vec3 => [sx * 80, yMech0 + 50, z]));
  const backBolts: Vec3[] = [[-20, yMech0, -45], [20, yMech0, -45], [0, yMech0, -85]];
  const top = 1060;

  const steps: CustomStep[] = [
    {
      title: "Click a castor into each leg of the base",
      detail: "Lay the base upside down on a rug and push each castor's pin straight into a leg until it clicks.",
      fix: [fx("castor", tips, [0, 1, 0], "BASE", { len: castor, dia: 50 })],
      wait: base,
      from: asideOf(base, baseAside),
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Pull the cap off the gas lift", detail: "It only protects the top in the box; recycle it." },
    {
      title: "Stand the base up and drop in the gas lift",
      detail: "Thick end down, straight into the hole in the middle. No tools.",
      fix: [fx("gasLift", [[0, hubTop, 0]], [0, -1, 0], "BASE", { len: yMech0 - hubTop + 40, dia: 50 })],
      pose: "+y",
    },
    {
      title: "Screw the lumbar plate to the spine",
      detail: "Lay the curved steel spine on a rug. Two small screws through the plate, with the screwdriver.",
      fix: [fx("screw", [-1, 1].map((sx): Vec3 => [sx * 60, 680, zSpine + 26]), [0, 0, -1], "LUMB", { ...SMALL, mate: "SPINE" })],
      wait: ["SPINE", "LUMB"],
      from: asideOf(["SPINE", "LUMB"], backAside),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Press the mesh back onto the spine", detail: "Line its frame up over the spine and lumbar plate and press down until it sits flat.", wait: ["BACK"], from: asideOf(["BACK"], backAside) },
    { title: "Slide the headrest into the top of the spine", detail: "Push its stem in until the clip catches.", wait: ["HEAD"], from: asideOf(["HEAD"], backAside) },
    {
      title: "Turn two bolts into the top of the spine",
      detail: "From the back, with the Allen key, only part of the way: leave the heads standing out for now.",
      fix: [fx("bolt", [-1, 1].map((sx): Vec3 => [sx * 14, top, zSpine - 12]), [0, 0, 1], "SPINE", { ...CAP_BOLT, mate: "BACK" })],
      tools: ["allen"],
    },
    {
      title: "Bolt the bottom of the back to the spine",
      detail: "Two button-head bolts through the bracket at the bottom of the spine, tightened with the Allen key.",
      fix: [fx("bolt", [-1, 1].map((sx): Vec3 => [sx * 18, yBack0 + 20, zSpine - 12]), [0, 0, 1], "SPINE", { ...BUTTON, mate: "BACK" })],
      tools: ["allen"],
    },
    { title: "Tighten the two top bolts", detail: "Now turn them all the way in, until the heads sit flush with the spine.", tools: ["allen"] },
    { title: "Press the cover cap over them", detail: "It clips over both bolt heads.", fix: [fx("cap", [[0, top, zSpine - 12]], [0, 0, 1], "SPINE", { name: "Cover cap", len: 8, dia: 30 })] },
    {
      title: "Bolt the armrests under the seat",
      detail: "Lay the seat upside down on a table with a rug on it. Three bolts through each armrest's plate.",
      add: ["SEAT", "ARM0", "ARM1"],
      fix: armBolts,
      pose: "-y",
      tools: ["allen"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the mechanism to the seat",
      detail: "Its lever to the right of the seat. Four button-head bolts.",
      add: ["MECH"],
      fix: [fx("bolt", mechBolts, [0, 1, 0], "MECH", { ...BUTTON, mate: "SEAT" })],
      tools: ["allen"],
    },
    {
      title: "Slide the back into the mechanism and bolt it",
      detail: "Push the spine's flat bracket into the back of the mechanism, then three bolts, tightened firmly.",
      add: back,
      fix: [fx("bolt", backBolts, [0, 1, 0], "SPINE", { ...LONG_BOLT, mate: "MECH" })],
      tools: ["allen"],
    },
    {
      title: "Lower the seat onto the gas lift",
      detail: "Turn the chair over and press it straight down onto the lift, then sit on it once: your weight locks it in place.",
      add: base,
      pose: "+y",
      from: asideOf(base, [0, -400, 0]),
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["UTKLASSNING"],
  recipe(s) {
    if (!/gaming chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return chair(s);
  },
};
export default family;
