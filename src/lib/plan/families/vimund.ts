import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * VIMUND, read from the child's desk chair manual. The five legs push into the hub and take a long screw each;
 * upside down, the five castors click in; stood up, the round footrest drops over the hub and the gas lift, its cap
 * off, goes in. The backrest lies face down while the steel loop's bracket is screwed to it with four screws, and
 * a cover clicks over the bracket. The seat lies upside down on a table: the mechanism takes four screws, the
 * loop's other end goes onto it with two screws and two small ones, a cover goes over that and the lever screws in.
 * The seat then goes onto the gas lift. The base, and the loop with the backrest, are built on their own first.
 */

const T = 20; // steel tube
const SCREW = { name: "Allen screw", len: 12, dia: 6 };

function part(id: string, name: string, abs: PartPiece[], lo: Vec3, hi: Vec3, material: CustomPart["material"]): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

/** A round tube from a to b. */
function tube(a: Vec3, b: Vec3, dia = T): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(d[2], d[1]), 0, -Math.atan2(d[0], Math.hypot(d[1], d[2]))] };
}

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string | undefined, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function chair(s: ProductSpec): CustomParams {
  // IKEA: 62 wide, 59 deep, 86 high with the seat at its highest (51 cm); the seat 41 wide and 37 deep
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const R = Math.min(W, D) / 2 - 30; // reach of a leg
  const legY = 150, tipY = 85;
  const seatTop = 510, seatT = 70, seatW = 410, seatD = 370, zSeat = 30;
  const seatY0 = seatTop - seatT, mechY0 = seatY0 - 30;
  const angles = Array.from({ length: 5 }, (_, i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const dirOf = (a: number): [number, number] => [Math.cos(a), -Math.sin(a)];
  const legs = angles.map((ang, i) => {
    const [dx, dz] = dirOf(ang);
    const p0: Vec3 = [dx * 40, legY, dz * 40], p1: Vec3 = [dx * (R - 30), legY, dz * (R - 30)], p2: Vec3 = [dx * R, tipY, dz * R];
    const lo: Vec3 = [Math.min(p0[0], p2[0]) - T / 2, tipY - T / 2, Math.min(p0[2], p2[2]) - T / 2];
    const hi: Vec3 = [Math.max(p0[0], p2[0]) + T / 2, legY + T / 2, Math.max(p0[2], p2[2]) + T / 2];
    return part(`LEG${i}`, "Leg", [tube(p0, p1), tube(p1, p2)], lo, hi, "metal");
  });
  // the steel loop: across behind the backrest, down both sides, forward under the seat to the mechanism
  const xl = 150, zB = -seatD / 2 + zSeat - 60, yTop = 700, yBend = 460, zLow = zSeat - 100, yLow = mechY0 - 12;
  const loop: PartPiece[] = [
    tube([-xl, yTop, zB], [xl, yTop, zB]),
    ...[-1, 1].flatMap((sx) => [tube([sx * xl, yTop, zB], [sx * xl, yBend, zB]), tube([sx * xl, yBend, zB], [sx * xl, yLow, zLow])]),
    tube([-xl, yLow, zLow], [xl, yLow, zLow]),
    // the bracket welded to the top bar, flat against the backrest, where its four screws go through
    { shape: "box", size: [90, 50, 4], pos: [0, yTop, zB + T / 2 - 2] },
  ];
  const backT = 50, zBack = zB + T / 2 + backT / 2;
  const tips: Vec3[] = angles.map((a) => [dirOf(a)[0] * R, tipY - T / 2, dirOf(a)[1] * R]);
  const hubScrews: Vec3[] = angles.map((a) => [dirOf(a)[0] * 45, legY + 40, dirOf(a)[1] * 45]);
  const mz0 = zSeat - 60, mz1 = zSeat + 60;
  const parts: CustomPart[] = [
    { id: "HUB", name: "Hub", size: [70, 150, 70], pos: [0, 175, 0], shape: "cyl", material: "metal" },
    ...legs,
    { id: "FOOT", name: "Footrest", size: [440, 20, 440], pos: [0, 260, 0], shape: "cyl", material: "board" },
    { id: "GAS", name: "Gas lift", size: [30, mechY0 - 250, 30], pos: [0, (mechY0 + 250) / 2, 0], shape: "cyl", material: "metal" },
    { id: "BACK", name: "Backrest", size: [400, H - 590, backT], pos: [0, (590 + H) / 2, zBack], material: "soft" },
    part("LOOP", "Back frame", loop, [-xl - T / 2, yLow - T / 2, zB - T / 2], [xl + T / 2, yTop + T / 2, zLow + T / 2], "metal"),
    { id: "BCOV", name: "Bracket cover", size: [70, 50, 25], pos: [0, yTop, zB - T / 2 - 12], material: "board" },
    { id: "SEAT", name: "Seat", size: [seatW, seatT, seatD], pos: [0, seatY0 + seatT / 2, zSeat], material: "soft" },
    { id: "MEC", name: "Mechanism", size: [170, 30, 170], pos: [0, mechY0 + 15, zSeat], material: "metal" },
    { id: "MCOV", name: "Mechanism cover", size: [90, 30, 40], pos: [0, yLow - T / 2 - 15, zLow], material: "board" },
  ];
  const backScrews: Vec3[] = [-1, 1].flatMap((sx) => [-15, 15].map((dy): Vec3 => [sx * 25, yTop + dy, zB + T / 2 - 4]));
  const mecScrews: Vec3[] = [-1, 1].flatMap((sx) => [mz0, mz1].map((z): Vec3 => [sx * 70, mechY0, z]));
  const steps: CustomStep[] = [
    { title: "Push the legs into the hub", detail: "All five, each one as far as it goes into its socket.", add: ["HUB", ...legs.map((l) => l.id)] },
    { title: "Screw each leg to the hub", detail: "Five long screws down through the hub into the legs, tightened with the Allen key.", fix: [fx("screw", hubScrews, [0, -1, 0], "HUB", { name: "Allen screw", len: 40, dia: 6 })], tools: ["allen"] },
    {
      title: "Click the castors into the legs",
      detail: "Turn the base upside down and push a castor's pin into the end of each leg until it clicks.",
      fix: legs.map((l, i) => fx("castor", [tips[i]], [0, 1, 0], l.id, { len: 50, dia: 45 })),
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Drop the footrest over the hub", detail: "Stand the base on its castors and lower the round footrest onto it.", add: ["FOOT"], pose: "+y", from: { FOOT: [0, 260, 0] } },
    { title: "Pull the cap off the gas lift", detail: "The plastic cap only protects it in the box, so recycle it." },
    { title: "Put the gas lift into the hub", detail: "Thick end down, straight in. No tools.", add: ["GAS"], from: { GAS: [0, 320, 0] } },
    {
      title: "Screw the back frame to the backrest",
      detail: "Lay the backrest face down and set the frame's bracket over its holes. Four screws, the round-headed ones.",
      add: ["BACK", "LOOP"],
      fix: [fx("screw", backScrews, [0, 0, 1], "LOOP", { ...SCREW, mate: "BACK" })],
      tools: ["allen"],
      pose: "-z",
      warnings: ["floor"],
    },
    { title: "Click the cover over the bracket", detail: "Press it straight down until it clicks.", add: ["BCOV"] },
    {
      title: "Screw the mechanism under the seat",
      detail: "Lay the seat upside down on a table and set the mechanism on it, lever hole to the right. Four round-headed screws.",
      add: ["SEAT", "MEC"],
      fix: [fx("screw", mecScrews, [0, 1, 0], "MEC", { ...SCREW, mate: "SEAT" })],
      tools: ["allen"],
      pose: "-y",
    },
    {
      title: "Screw the back frame onto the mechanism",
      detail: "Its lower bar goes over the back of the mechanism, the backrest hanging over the table edge. Two round-headed screws.",
      fix: [fx("screw", [-1, 1].map((sx): Vec3 => [sx * 50, yLow - T / 2, zLow]), [0, 1, 0], "LOOP", { ...SCREW, mate: "MEC" })],
      tools: ["allen"],
    },
    {
      title: "Add the two small screws",
      detail: "The short ones, either side of the first two.",
      fix: [fx("screw", [-1, 1].map((sx): Vec3 => [sx * 110, yLow - T / 2, zLow]), [0, 1, 0], "LOOP", { name: "Allen screw", len: 8, dia: 5, mate: "MEC" })],
      tools: ["allen"],
    },
    { title: "Press the cover over the frame's bracket", detail: "Push it on from below until it sits flat.", add: ["MCOV"] },
    {
      title: "Screw in the lever",
      detail: "Into the right-hand side of the mechanism, by hand. It raises and lowers the seat later.",
      fix: [fx("knob", [[85, mechY0 + 15, zSeat + 40]], [-1, 0, 0], "MEC", { name: "Lever", len: 90, dia: 20 })],
    },
    { title: "Set the seat onto the gas lift", detail: "Turn the seat over and press it straight down onto the lift in the base. Sit on it once to lock it.", pose: "+y" },
  ];
  return { parts, steps };
}

/** Parts built on their own (the base, or the loop with the backrest) are shown in their own scene for steps `from` to `until`, and come in at `join`. */
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
  names: ["VIMUND"],
  build(b, s) {
    if (!/chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = chair(s);
    buildCustom(b, { ...s, custom: r });
    const idx = (re: RegExp) => r.steps.findIndex((x) => re.test(x.title));
    const base = ["HUB", "LEG0", "LEG1", "LEG2", "LEG3", "LEG4", "FOOT", "GAS"];
    apart(b, r, base, "base", 0, idx(/frame to the backrest/), idx(/onto the gas lift/), [0, -420, 0]);
    apart(b, r, ["BACK", "LOOP", "BCOV"], "back", idx(/frame to the backrest/), idx(/mechanism under/), idx(/frame onto the mechanism/), [0, 320, 0]);
    return true;
  },
};
export default family;
