import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { rotate } from "../math";

/**
 * LÖPARBANA, read from the gaming chair's manual. The base comes first, upside down: five loose arms slide into the
 * hub, two screws each, and five castors click in; stood up, the gas lift drops in. The seat lies upside down on a
 * table: the mechanism is bolted on, the steel back frame's bracket slides into the mechanism and takes four bolts
 * with lock washers, and two screws hold the frame to the seat ring. The seat goes onto the gas lift and is sat on
 * once, then six more bolts and screws fix the frame at its sides, its arm supports and under the seat, the two
 * armrest pads are screwed on and the headrest cushion slides onto the top. The base stands aside until it is joined.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string | undefined, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

/** A round tube from a to b, in product coordinates. */
function tube(a: Vec3, b: Vec3, dia: number): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const u = d.map((v) => v / len);
  return { shape: "cyl", size: [dia, len + dia * 0.6, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(u[2], u[1]), 0, Math.asin(-u[0])] };
}

/** A part from pieces placed in product coordinates. */
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

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 66 wide and deep, 129 high with the seat at its highest (54 cm); the seat 48 wide and 48 deep
  const W = s.size.w * 10;
  const H = 1290, seatTop = 540, seatT = 80, seatW = 480, seatD = 480;
  const R = W / 2 - 25;
  const armD = 32, castor = 58, yArm = castor + armD / 2;
  const angles = [0, 1, 2, 3, 4].map((i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const dirOf = (a: number): [number, number] => [Math.cos(a), -Math.sin(a)];
  const hubTop = 150;
  const zs = 20;
  const ySeat0 = seatTop - seatT, ring = ySeat0 - 10, yMech0 = ring - 50;
  const zb = zs - seatD / 2 - 40; // back frame uprights
  const xa = seatW / 2 + 40, yArmrest = 720;
  const parts: CustomPart[] = [
    { id: "HUB", name: "Hub", size: [70, hubTop - 40, 70], pos: [0, (hubTop + 40) / 2, 0], shape: "cyl", material: "metal" },
    ...angles.map((a, i): CustomPart => {
      const [dx, dz] = dirOf(a);
      return abs(`A${i + 1}`, "Base arm", [tube([dx * 40, yArm, dz * 40], [dx * R, yArm, dz * R], armD)], "metal");
    }),
    {
      id: "SEAT",
      name: "Seat",
      size: [seatW + 20, seatT + 20, seatD + 20],
      pos: [0, ySeat0 + seatT / 2 - 10, zs],
      material: "soft",
      pieces: [
        { shape: "box", size: [seatW, seatT, seatD], pos: [0, 10, 0] },
        { shape: "cyl", size: [seatW + 20, 20, seatD + 20], pos: [0, -seatT / 2, 0], material: "metal" },
      ],
    },
    { id: "MECH", name: "Mechanism", size: [200, 50, 240], pos: [0, yMech0 + 25, zs - 10], material: "metal" },
    abs(
      "FRAME",
      "Back frame",
      [
        ...[-1, 1].flatMap((sx): PartPiece[] => [
          tube([sx * 60, yMech0 + 10, zs - 90], [sx * (seatW / 2 - 20), ring - 15, zb + 40], 22),
          tube([sx * (seatW / 2 - 20), ring - 15, zb + 40], [sx * (seatW / 2 - 10), 700, zb], 22),
          tube([sx * (seatW / 2 - 10), 700, zb], [sx * 150, H - 15, zb - 60], 22),
          tube([sx * (seatW / 2 - 20), ring, zs + 60], [sx * xa, yArmrest - 18, zs + 40], 22),
          tube([sx * xa, yArmrest - 18, zs + 40], [sx * (seatW / 2 - 10), 700, zb + 10], 22),
        ]),
        tube([-150, H - 15, zb - 60], [150, H - 15, zb - 60], 22),
        { shape: "box", size: [seatW - 30, 560, 70], pos: [0, 860, zb - 5], rot: [-0.08, 0, 0], material: "soft" },
        { shape: "box", size: [80, 14, 160], pos: [0, yMech0 + 3, zs - 140] },
      ],
      "metal",
    ),
    { id: "PADL", name: "Armrest pad", size: [80, 36, 260], pos: [-xa, yArmrest, zs - 20], material: "soft" },
    { id: "PADR", name: "Armrest pad", size: [80, 36, 260], pos: [xa, yArmrest, zs - 20], material: "soft" },
    { id: "HEAD", name: "Headrest cushion", size: [270, 150, 90], pos: [0, H - 120, zb - 30], material: "soft" },
  ];
  const armIds = angles.map((_, i) => `A${i + 1}`);
  const aside: Vec3 = [-760, 0, 0];
  const armScrews = angles.map((a, i) => {
    const [dx, dz] = dirOf(a);
    return fx("bolt", [60, 95].map((r): Vec3 => [dx * r, castor, dz * r]), [0, 1, 0], `A${i + 1}`, { name: "Allen screw", len: 12, dia: 6, mate: "HUB" });
  });
  const castors = angles.map((a, i) => fx("castor", [[dirOf(a)[0] * (R - 15), castor, dirOf(a)[1] * (R - 15)]], [0, 1, 0], `A${i + 1}`, { len: castor, dia: 50 }));
  const mechBolts = [-1, 1].flatMap((sx) => [zs - 90, zs + 70].map((z): Vec3 => [sx * 75, yMech0 + 50, z]));
  const bracket: Vec3[] = [-1, 1].flatMap((sx) => [zs - 120, zs - 75].map((z): Vec3 => [sx * 25, yMech0, z]));
  const BIG = { name: "Allen bolt", len: 20, dia: 8 };
  const steps: CustomStep[] = [
    {
      title: "Slide the five arms into the hub",
      detail: "Lay the hub upside down on a rug and push each arm into its socket, screw holes up.",
      wait: ["HUB", ...armIds],
      from: Object.fromEntries(["HUB", ...armIds].map((id) => [id, aside])),
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Screw each arm to the hub", detail: "Two screws in each arm, tightened with the long Allen key.", fix: armScrews, tools: ["allen"] },
    { title: "Click a castor into each arm", detail: "Push the pin into the hole at the end until it clicks.", fix: castors },
    {
      title: "Stand the base up and drop in the gas lift",
      detail: "Thick end down, straight into the hub.",
      fix: [fx("gasLift", [[0, hubTop, 0]], [0, -1, 0], "HUB", { len: Math.round(yMech0 - hubTop + 40), dia: 50 })],
      pose: "+y",
    },
    {
      title: "Bolt the mechanism under the seat",
      detail: "Lay the seat upside down on a table, lever to the right. Four bolts, tightened with the long Allen key.",
      add: ["SEAT", "MECH"],
      fix: [fx("bolt", mechBolts, [0, 1, 0], "MECH", { ...BIG, mate: "SEAT" })],
      tools: ["allen"],
      pose: "-y",
    },
    {
      title: "Bolt the back frame to the mechanism",
      detail: "Slide the frame's bracket into the back of the mechanism. Four bolts, each with a lock washer under its head.",
      add: ["FRAME"],
      // the lock washers stack on the bolts, so the bolts are listed first
      fix: [fx("bolt", bracket, [0, 1, 0], "FRAME", { ...BIG, mate: "MECH" }), fx("washer", bracket, [0, 1, 0], "FRAME", { len: 2, dia: 14 })],
      tools: ["allen"],
      from: { FRAME: [0, 0, -360] },
    },
    {
      title: "Screw the frame to the seat ring",
      detail: "Two screws with the short Allen key, one on each side where the tubes cross the ring.",
      fix: [fx("bolt", [-1, 1].map((sx): Vec3 => [sx * (seatW / 2 - 20), ring - 15, zb + 50]), [0, 1, 0], "FRAME", { name: "Allen screw", len: 12, dia: 6, mate: "SEAT" })],
      tools: ["allen"],
    },
    {
      title: "Lower the seat onto the gas lift",
      detail: "Turn it over and press it straight down onto the lift in the base.",
      add: ["HUB", ...armIds],
      pose: "+y",
      from: Object.fromEntries(["HUB", ...armIds].map((id) => [id, [0, -360, 0] as Vec3])),
    },
    { title: "Sit on it once", detail: "Firmly, so your weight locks the seat onto the lift." },
    {
      title: "Bolt the frame at its sides",
      detail: "One long bolt into each side of the back frame, with the short Allen key.",
      fix: [-1, 1].map((sx) => fx("bolt", [[sx * (seatW / 2 + 1), 700, zb]], [-sx, 0, 0], "FRAME", { name: "Allen bolt", len: 40, dia: 6 })),
      tools: ["allen"],
    },
    {
      title: "Bolt the tops of the arm supports",
      detail: "One long bolt down into each support, short Allen key.",
      fix: [fx("bolt", [-1, 1].map((sx): Vec3 => [sx * xa, yArmrest - 7, zs + 40]), [0, -1, 0], "FRAME", { name: "Allen bolt", len: 40, dia: 6 })],
      tools: ["allen"],
    },
    {
      title: "Screw the arm supports under the seat",
      detail: "Two screws up into the ring, with the long Allen key.",
      fix: [fx("bolt", [-1, 1].map((sx): Vec3 => [sx * (seatW / 2 - 20), ring - 10, zs + 60]), [0, 1, 0], "FRAME", { name: "Allen screw", len: 12, dia: 6, mate: "SEAT" })],
      tools: ["allen"],
    },
    {
      title: "Screw on the armrest pads",
      detail: "Two screws up through each support into its pad, short Allen key.",
      add: ["PADL", "PADR"],
      fix: [-1, 1].map((sx) => fx("bolt", [zs - 80, zs + 40].map((z): Vec3 => [sx * xa, yArmrest - 18, z]), [0, 1, 0], "FRAME", { name: "Allen screw", len: 16, dia: 6, mate: sx < 0 ? "PADL" : "PADR" })),
      tools: ["allen"],
      from: { PADL: [0, 220, 0], PADR: [0, 220, 0] },
    },
    { title: "Slide on the headrest cushion", detail: "Down over the top of the frame, then fasten its straps at the back.", add: ["HEAD"], from: { HEAD: [0, 300, 0] } },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["LÖPARBANA", "LOPARBANA"],
  recipe(s) {
    if (!/gaming chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return recipe(s);
  },
};
export default family;
