import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * RENBERGET swivel chair, read from its manual. On a rug, the loose fifth arm slides into the base's hub and takes
 * five screws, and the five castors push into the arms. The tilt mechanism is bolted under the upside-down seat.
 * The gas lift, its cap thrown away, drops into the base and the seat goes onto it. The two loop armrests bolt to
 * the seat's sides, the backrest drops in between them and is bolted through each armrest's back, and all eight
 * armrest bolts are tightened. Drawn with the seat at 49 cm (it goes from 40 to 52).
 */

const BOLT = { name: "Allen bolt", len: 25, dia: 6 };
const T = 26; // armrest tube

function part(id: string, name: string, abs: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...abs.map((p) => p.pos[k] - p.size[k] / 2)));
  const hi = [0, 1, 2].map((k) => Math.max(...abs.map((p) => p.pos[k] + p.size[k] / 2)));
  const c = lo.map((v, k) => (v + hi[k]) / 2) as Vec3;
  return {
    id,
    name,
    size: lo.map((v, k) => hi[k] - v) as Vec3,
    pos: c,
    material,
    pieces: abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 })),
  };
}
const box = (lo: Vec3, hi: Vec3): PartPiece => ({ shape: "box", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] });
const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

const BASE = ["BASE", "ARM5"];

function chair(): CustomParams {
  // IKEA: 59 wide, 65 deep, 108 high with the seat at its highest; the seat 49 wide and 42 deep
  const R = 285, baseY = 95;
  const angles = Array.from({ length: 5 }, (_, i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const dirOf = (a: number): [number, number] => [Math.cos(a), -Math.sin(a)];
  const arm = (a: number): PartPiece => {
    const [dx, dz] = dirOf(a);
    return { shape: "box", size: [R - 30, 30, 45], pos: [(dx * (R + 30)) / 2, -5, (dz * (R + 30)) / 2], rot: [0, a, 0] };
  };
  const seatTop = 490, seatY0 = 390, zSeat = 20, mechY0 = seatY0 - 50;
  const xA = 258, yLo = 430, yHi = 680, zAF = 200, zAB = -230;
  const loop = (sx: number): PartPiece[] => [
    box([sx * xA - T / 2, yLo - T / 2, zAB], [sx * xA + T / 2, yLo + T / 2, zAF]),
    box([sx * xA - T / 2, yHi - T / 2, zAB], [sx * xA + T / 2, yHi + T / 2, zAF - 40]),
    box([sx * xA - T / 2, yLo, zAF - T], [sx * xA + T / 2, yHi, zAF]),
    box([sx * xA - T / 2, yLo, zAB], [sx * xA + T / 2, yHi, zAB + T]),
  ];
  const zBack = zAB + T / 2;
  const parts: CustomPart[] = [
    { id: "BASE", name: "Star base", size: [2 * R, 70, 2 * R], pos: [0, baseY, 0], pieces: [{ shape: "cyl", size: [70, 70, 70], pos: [0, 0, 0] }, ...angles.slice(1).map(arm)], material: "metal" },
    part("ARM5", "Base arm", [{ ...arm(angles[0]), pos: [0, baseY - 5, -(R + 30) / 2] }], "metal"),
    { id: "GAS", name: "Gas lift", size: [50, mechY0 - baseY - 15, 50], pos: [0, (mechY0 + baseY + 15) / 2, 0], shape: "cyl", material: "metal" },
    { id: "SEAT", name: "Seat", size: [490, seatTop - seatY0, 470], pos: [0, (seatTop + seatY0) / 2, zSeat], material: "soft" },
    { id: "MEC", name: "Tilt mechanism", size: [220, 50, 250], pos: [0, mechY0 + 25, zSeat - 20], material: "metal" },
    part("ARML", "Armrest", loop(-1), "metal"),
    part("ARMR", "Armrest", loop(1), "metal"),
    { id: "BACK", name: "Backrest", size: [2 * xA - T, 1050 - seatTop, 90], pos: [0, (1050 + seatTop) / 2, zBack - 45 + T / 2], material: "soft" },
  ];
  const tips: Vec3[] = angles.map((a) => [dirOf(a)[0] * R, baseY - 35, dirOf(a)[1] * R]);
  // the screws go down through the top of the loose arm, in a row out from the hub, into the hub's tongue inside it
  const hub: Vec3[] = [40, 65, 90, 115, 140].map((r): Vec3 => [dirOf(angles[0])[0] * r, baseY + 10, dirOf(angles[0])[1] * r]);
  const mz = [zSeat - 120, zSeat + 80];
  const mecBolts: Vec3[] = [-1, 1].flatMap((sx) => mz.map((z): Vec3 => [sx * 85, mechY0, z]));
  const side = (sx: number) => (sx < 0 ? "ARML" : "ARMR");
  const armBolts = (ys: number, zs: number[], mate: string) => [-1, 1].map((sx) => fx("bolt", zs.map((z): Vec3 => [sx * (xA + T / 2), ys, z]), [-sx, 0, 0], side(sx), { ...BOLT, mate }));
  const steps: CustomStep[] = [
    { title: "Slide the loose arm into the base", detail: "Lay the base on a rug and push the fifth arm into its slot in the hub.", add: ["BASE", "ARM5"], warnings: ["floor"] },
    {
      title: "Screw the arm in place",
      detail: "Five short screws down through the top of the loose arm, next to the hub. Use the short flat-headed ones.",
      fix: [fx("screw", hub, [0, -1, 0], "ARM5", { name: "Allen screw", len: 12, dia: 6, mate: "BASE" })],
      tools: ["allen"],
    },
    {
      title: "Push the castors into the arms",
      detail: "Pin first into the end of each arm, until it clicks all the way home.",
      fix: [fx("castor", tips.slice(1), [0, 1, 0], "BASE", { len: 58, dia: 50 }), fx("castor", tips.slice(0, 1), [0, 1, 0], "ARM5", { len: 58, dia: 50 })],
    },
    {
      title: "Bolt the mechanism under the seat",
      detail: "Lay the seat upside down on the rug and set the mechanism on it, lever to the right. Four bolts, tightened firmly.",
      add: ["SEAT", "MEC"],
      fix: [fx("bolt", mecBolts, [0, 1, 0], "MEC", { ...BOLT, len: 20, mate: "SEAT" })],
      tools: ["allen"],
      pose: "-y",
    },
    { title: "Pull the cap off the gas lift", detail: "It only protects the lift in the box, so recycle it." },
    {
      title: "Put the seat on the gas lift",
      detail: "Drop the lift into the base's hub, thick end down, then set the seat's mechanism over its top and press down.",
      add: ["GAS"],
      pose: "+y",
      from: { GAS: [0, 360, 0] },
    },
    {
      title: "Bolt the armrests to the seat",
      detail: "One on each side, the closed loop to the front. Two bolts through each one's bottom bar, just turned in for now.",
      add: ["ARML", "ARMR"],
      fix: armBolts(yLo, [-90, 110], "SEAT"),
      tools: ["allen"],
      warnings: ["loose"],
    },
    {
      title: "Drop the backrest in between the armrests",
      detail: "Its sides go against the armrests' back bars. One bolt through each, near the top.",
      add: ["BACK"],
      fix: armBolts(640, [zBack], "BACK"),
      tools: ["allen"],
      from: { BACK: [0, 380, 0] },
    },
    { title: "Bolt the backrest lower down", detail: "Tilt the backrest back a little, then one more bolt through each armrest.", fix: armBolts(520, [zBack], "BACK"), tools: ["allen"] },
    { title: "Tighten all eight armrest bolts", detail: "Each one firmly with the Allen key, both sides.", tools: ["allen"] },
  ];
  return { parts, steps };
}

/** Parts built on their own are shown in their own scene for steps `from` to `until`, and come in at `join`. */
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
  names: ["RENBERGET"],
  build(b: PlanBuilder, s: ProductSpec) {
    if (!/chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = chair();
    buildCustom(b, { ...s, custom: r });
    const idx = (re: RegExp) => r.steps.findIndex((x) => re.test(x.title));
    apart(b, r, BASE, "base", 0, idx(/mechanism under the seat/), idx(/seat on the gas lift/), [0, -420, 0]);
    return true;
  },
};
export default family;
