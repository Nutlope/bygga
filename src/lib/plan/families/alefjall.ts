import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * ALEFJÄLL, read from the office chair's manual. Upside down on a rug, the loose fifth arm slides into the base's
 * hub and takes five screws, and the five castors push into the arms; stood up, the hub cover goes on and the gas
 * lift, its cap thrown away, drops into the hub. With the seat upside down, the mechanism is bolted on, by hand and
 * then tight. The steel frame that carries the armrests and the back lies upside down on the rug: the two armrest
 * pads are screwed on, the back's plate slides into the frame's bracket and the height knob goes in. The frame goes
 * onto the upside-down seat, its bracket over the mechanism, with four more bolts, and the seat is lowered onto the
 * gas lift. The base, and the frame with the back, are built on their own until they join the seat.
 */

const T = 22; // steel tube
const BOLT = { name: "Allen bolt", len: 16, dia: 8 };

function part(id: string, name: string, abs: PartPiece[], lo: Vec3, hi: Vec3, material: CustomPart["material"]): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

/** A round tube from a to b. */
function tube(a: Vec3, b: Vec3): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  return { shape: "cyl", size: [T, len, T], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(d[2], d[1]), 0, -Math.atan2(d[0], Math.hypot(d[1], d[2]))] };
}

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string | undefined, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function chair(s: ProductSpec): CustomParams {
  // IKEA: 64 wide and deep, 95 high with the seat at its highest (56 cm); the seat 51 wide and 42 deep
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = 950, seatTop = 560, seatT = 100, seatW = 510, seatD = 420;
  const R = Math.min(W, D) / 2 - 20; // reach of the base's arms
  const baseY = 95;
  const angles = Array.from({ length: 5 }, (_, i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const dirOf = (a: number): [number, number] => [Math.cos(a), -Math.sin(a)];
  const arm = (a: number): PartPiece => {
    const [dx, dz] = dirOf(a);
    return { shape: "box", size: [R - 30, 30, 50], pos: [(dx * (R + 30)) / 2, -5, (dz * (R + 30)) / 2], rot: [0, a, 0] };
  };
  const loose = angles[0];
  const seatY0 = seatTop - seatT, mechY0 = seatY0 - 50;
  const zSeat = 30, zBackSeat = zSeat - seatD / 2;
  const xa = seatW / 2 + 25; // the frame's side tubes
  const yArm = 690, yLow = seatY0 - 20;
  const zBr = zBackSeat - 45; // the back bracket
  const frameAbs: PartPiece[] = [-1, 1].flatMap((sx): PartPiece[] => [
    tube([sx * xa, yLow, zSeat + 120], [sx * xa, yArm, zSeat + 100]),
    tube([sx * xa, yArm, zSeat + 110], [sx * xa, yArm, zBackSeat + 20]),
    tube([sx * xa, yArm, zBackSeat + 20], [sx * (xa - 40), yLow, zBr]),
    tube([sx * xa, yLow, zSeat + 120], [sx * xa, yLow, zSeat - 60]),
    tube([sx * xa, yLow, zSeat - 60], [sx * 40, yLow, zBr]),
  ]);
  frameAbs.push(
    { shape: "box", size: [80, 12, 200], pos: [0, mechY0 - 6, zBr + 100] },
    { shape: "box", size: [70, 300, 26], pos: [0, yLow + 130, zBr] },
  );
  const parts: CustomPart[] = [
    { id: "BASE", name: "Star base", size: [2 * R, 70, 2 * R], pos: [0, baseY, 0], pieces: [{ shape: "cyl", size: [70, 70, 70], pos: [0, 0, 0] }, ...angles.slice(1).map(arm)], material: "metal" },
    part("ARM5", "Base arm", [{ ...arm(loose), pos: [0, baseY - 5, -(R + 30) / 2] }], [-25, baseY - 20, -R], [25, baseY + 10, -30], "metal"),
    { id: "COVER", name: "Hub cover", size: [130, 40, 130], pos: [0, baseY + 35 + 10, 0], shape: "cyl", material: "board" },
    { id: "GAS", name: "Gas lift", size: [50, mechY0 - baseY - 35 + 20, 50], pos: [0, (mechY0 + 20 + baseY + 35) / 2, 0], shape: "cyl", material: "metal" },
    { id: "SEAT", name: "Seat", size: [seatW, seatT, seatD], pos: [0, seatY0 + seatT / 2, zSeat], material: "soft" },
    { id: "MEC", name: "Tilt mechanism", size: [220, 50, 260], pos: [0, mechY0 + 25, zSeat - 10], material: "metal" },
    part("FRAME", "Armrest frame", frameAbs, [-xa - T / 2, mechY0 - 12, zBr - 13], [xa + T / 2, yArm + T / 2, zSeat + 131], "metal"),
    { id: "PAD_L", name: "Armrest pad", size: [80, 40, 260], pos: [-xa, yArm + T / 2 + 20, zSeat - 50], material: "soft" },
    { id: "PAD_R", name: "Armrest pad", size: [80, 40, 260], pos: [xa, yArm + T / 2 + 20, zSeat - 50], material: "soft" },
    { id: "BACK", name: "Backrest", size: [480, H - 600, 90], pos: [0, (600 + H) / 2, zBr - 13 - 45], material: "soft" },
  ];
  const tips: Vec3[] = angles.map((a) => [dirOf(a)[0] * R, baseY - 35, dirOf(a)[1] * R]);
  const hub: Vec3[] = angles.map((a) => [dirOf(a)[0] * 45, baseY - 20, dirOf(a)[1] * 45]);
  const mz0 = zSeat - 10 - 100, mz1 = zSeat - 10 + 100;
  const mecBolts: Vec3[] = [-1, 1].flatMap((sx) => [mz0, mz1].map((z): Vec3 => [sx * 80, mechY0, z]));
  const frameBolts: Vec3[] = [-1, 1].flatMap((sx) => [zBr + 130, zBr + 180].map((z): Vec3 => [sx * 25, mechY0 - 12, z]));
  const padScrews = (sx: number) => fx("screw", [zSeat - 140, zSeat + 40].map((z): Vec3 => [sx * xa, yArm - T / 2, z]), [0, 1, 0], "FRAME", { name: "Allen screw", len: 20, dia: 6, mate: sx < 0 ? "PAD_L" : "PAD_R" });
  const steps: CustomStep[] = [
    {
      title: "Slide the loose arm into the base",
      detail: "Lay the base upside down on a rug and push the fifth arm into its slot in the hub, all the way in.",
      add: ["BASE", "ARM5"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw the arm in place",
      detail: "Five small screws into the hub with the short Allen key. Use the flat-headed ones, not the domed ones.",
      fix: [fx("screw", hub, [0, 1, 0], "BASE", { name: "Allen screw", len: 12, dia: 6, mate: "ARM5" })],
      tools: ["allen"],
    },
    {
      title: "Push the castors into the arms",
      detail: "Pin first, wheels up, into the end of each arm until it clicks home.",
      fix: [fx("castor", tips.slice(1), [0, 1, 0], "BASE", { len: 58, dia: 50 }), fx("castor", tips.slice(0, 1), [0, 1, 0], "ARM5", { len: 58, dia: 50 })],
    },
    { title: "Turn the base over and fit the hub cover", detail: "Stand it on its castors and drop the cover over the hub.", add: ["COVER"], pose: "+y", from: { COVER: [0, 240, 0] } },
    { title: "Pull the cap off the gas lift", detail: "The plastic cap on its thin end only protects it in the box, so recycle it." },
    { title: "Drop the gas lift into the hub", detail: "Thick end down, straight in. No tools.", add: ["GAS"], from: { GAS: [0, 360, 0] } },
    {
      title: "Bolt the mechanism under the seat by hand",
      detail: "Close the seat's zip, lay it upside down on the rug and set the mechanism on it, lever to the right. Four bolts, just turned in with your fingers.",
      add: ["SEAT", "MEC"],
      fix: [fx("bolt", mecBolts, [0, 1, 0], "MEC", { ...BOLT, mate: "SEAT" })],
      pose: "-y",
      warnings: ["loose"],
    },
    { title: "Tighten the mechanism bolts", detail: "All four, firmly, with the long Allen key.", tools: ["allen"] },
    {
      title: "Screw the armrest pads onto the frame",
      detail: "Lay the frame upside down on the rug with a pad under each arm. Two countersunk screws up through each arm.",
      add: ["FRAME", "PAD_L", "PAD_R"],
      fix: [padScrews(-1), padScrews(1)],
      tools: ["allen"],
      warnings: ["floor"],
    },
    { title: "Slide the backrest onto the frame", detail: "Push the plate on the back of the backrest into the frame's bracket as far as it goes.", add: ["BACK"], from: { BACK: [0, 300, 0] } },
    {
      title: "Screw in the height knob",
      detail: "Through the bracket into the plate, by hand. It sets the height of the back later.",
      fix: [fx("knob", [[0, 660, zBr - 13]], [0, 0, 1], "FRAME", { name: "Height knob", len: 25, dia: 34, mate: "BACK" })],
    },
    { title: "Set the frame on the seat", detail: "Turn the frame over onto the upside-down seat, its bracket over the back of the mechanism, the backrest hanging down." },
    {
      title: "Bolt the frame to the mechanism",
      detail: "Four bolts through the bracket into the mechanism, tightened with the long Allen key.",
      fix: [fx("bolt", frameBolts, [0, 1, 0], "FRAME", { ...BOLT, mate: "MEC" })],
      tools: ["allen"],
    },
    { title: "Lower the seat onto the gas lift", detail: "Turn the seat over and press it straight down onto the lift in the base. Sit on it once, firmly, to lock it.", pose: "+y" },
  ];
  return { parts, steps };
}

/** Parts built on their own (the base, or the frame with its back) are shown in their own scene for steps `from` to `until`, and come in at `join`. */
function apart(b: PlanBuilder, r: CustomParams, ids: string[], scene: string, from: number, until: number, join: number, off: Vec3) {
  for (let i = from; i < until; i++) if (b.steps[i]) b.steps[i].scene = scene;
  for (const id of ids) {
    const p = r.parts.find((q) => q.id === id)!;
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
    if (!it) continue;
    it.states = it.states.filter((st) => st.step < join).map((st) => ({ ...st, scene }));
    it.states.push({ step: join, scene: "main", pos: it.final.pos, rot: it.final.rot, from: off, delay: 0.2 });
  }
}

const family: Family = {
  names: ["ALEFJÄLL", "ALEFJALL"],
  build(b, s) {
    if (!/chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = chair(s);
    buildCustom(b, { ...s, custom: r });
    const idx = (re: RegExp) => r.steps.findIndex((x) => re.test(x.title));
    apart(b, r, ["BASE", "ARM5", "COVER", "GAS"], "base", 0, idx(/mechanism under the seat/), idx(/onto the gas lift/), [0, -420, 0]);
    apart(b, r, ["FRAME", "PAD_L", "PAD_R", "BACK"], "frame", idx(/armrest pads/), idx(/frame on the seat/), idx(/frame on the seat/), [0, 320, 0]);
    return true;
  },
};
export default family;
