import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * MATCHSPEL, read from the gaming chair's manual. Upside down on a rug the five castors click into the base; stood up,
 * the gas lift loses its cap and drops into the hub. The headrest cushion slides onto its bar and clicks down, two
 * bolts go part way into the top of the backrest, the headrest is bolted onto them and they are tightened, then a cap
 * covers them. With the seat upside down on a table the mechanism is bolted on, the backrest's bar slides into the
 * mechanism and takes three bolts, and each armrest takes three bolts into the side of the seat. Last, the seat is
 * pressed onto the gas lift. The base, the headrest and the backrest are each built on their own until they join.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function part(id: string, name: string, abs: PartPiece[], lo: Vec3, hi: Vec3, material: CustomPart["material"]): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

const LONG = { name: "Allen bolt", len: 35, dia: 6 };
const SHORT = { name: "Button bolt", len: 16, dia: 6 };

function chair(s: ProductSpec): CustomParams {
  // IKEA: 66 wide and deep, 120 high with the seat at its lowest (47 cm); the seat 54 wide and 48 deep
  const W = s.size.w * 10, H = s.size.h * 10;
  const R = W / 2 - 30, baseY = 95;
  const angles = Array.from({ length: 5 }, (_, i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
  const dirOf = (a: number): [number, number] => [Math.cos(a), -Math.sin(a)];
  const arm = (a: number): PartPiece => {
    const [dx, dz] = dirOf(a);
    return { shape: "box", size: [R - 30, 30, 50], pos: [(dx * (R + 30)) / 2, -5, (dz * (R + 30)) / 2], rot: [0, a, 0] };
  };
  const seatTop = 470, seatT = 100, seatW = 540, seatD = 480, zSeat = 20;
  const yS = seatTop - seatT, mech0 = yS - 50;
  const zSb = zSeat - seatD / 2; // back edge of the seat
  // the backrest: a mesh frame leaning back a little, on a steel bar that runs forward under the seat
  const yB0 = 530, yB1 = H - 160, zB = zSb - 50, lean = 0.08;
  const backAbs: PartPiece[] = [
    { shape: "box", size: [490, yB1 - yB0, 40], pos: [0, (yB0 + yB1) / 2, zB - ((yB1 - yB0) / 2) * lean], rot: [-lean, 0, 0] },
    { shape: "box", size: [60, 30, zSeat - 90 - (zB - 20)], pos: [0, mech0 + 25, (zSeat - 90 + zB - 20) / 2], material: "metal" },
    { shape: "box", size: [60, yB0 - mech0 + 30, 30], pos: [0, (mech0 + yB0 + 30) / 2, zB - 20], material: "metal" },
  ];
  const zTop = zB - (yB1 - yB0) * lean;
  const hy0 = yB1 - 40, hz = zTop - 25;
  const armAt = (sx: number): CustomPart => {
    const x = sx * (seatW / 2 + 20);
    const abs: PartPiece[] = [
      { shape: "box", size: [16, 80, 170], pos: [sx * (seatW / 2 + 8), yS + 40, zSeat - 30] },
      { shape: "box", size: [40, 240, 40], pos: [x, seatTop + 60, zSeat - 30] },
      { shape: "box", size: [90, 30, 250], pos: [x, seatTop + 195, zSeat - 10] },
    ];
    return part(sx < 0 ? "ARM_L" : "ARM_R", "Armrest", abs, [Math.min(x - 45, sx * seatW / 2), yS, zSeat - 135], [Math.max(x + 45, sx * seatW / 2), seatTop + 210, zSeat + 115], "board");
  };
  const parts: CustomPart[] = [
    { id: "BASE", name: "Star base", size: [2 * R, 70, 2 * R], pos: [0, baseY, 0], pieces: [{ shape: "cyl", size: [70, 70, 70], pos: [0, 0, 0] }, ...angles.map(arm)], material: "board" },
    { id: "GAS", name: "Gas lift", shape: "cyl", size: [50, mech0 - baseY - 35 + 20, 50], pos: [0, (mech0 + 20 + baseY + 35) / 2, 0], material: "metal" },
    // the bar lies flat against the back of the backrest where its two bolts go in
    part("HBAR", "Headrest bar", [{ shape: "box", size: [50, 220, 16], pos: [0, hy0 + 40, hz + 15], rot: [0.15, 0, 0] }], [-25, hy0 - 70, hz - 10], [25, hy0 + 150, hz + 40], "metal"),
    { id: "HPAD", name: "Headrest", size: [290, 120, 70], pos: [0, H - 60, hz - 5], material: "soft" },
    part("BACK", "Backrest", backAbs, [-245, mech0 + 10, zTop - 25], [245, yB1, zSeat - 90], "soft"),
    { id: "SEAT", name: "Seat", size: [seatW, seatT, seatD], pos: [0, yS + seatT / 2, zSeat], material: "soft" },
    { id: "MECH", name: "Mechanism", size: [250, 50, 240], pos: [0, mech0 + 25, zSeat - 20], material: "metal" },
    armAt(1),
    armAt(-1),
  ];
  const tips: Vec3[] = angles.map((a) => [dirOf(a)[0] * R, baseY - 35, dirOf(a)[1] * R]);
  const mechBolts: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * 100, mech0 + 10, zSeat - 20 + sz * 95]));
  const barBolts: Vec3[] = [[-18, mech0, zSeat - 120], [18, mech0, zSeat - 120], [0, mech0, zSeat - 160]];
  const armBolts = (sx: number) =>
    fx("bolt", [-60, 0, 60].map((dz): Vec3 => [sx * (seatW / 2 + 16), yS + 40, zSeat - 30 + dz]), [-sx, 0, 0], sx < 0 ? "ARM_L" : "ARM_R", { ...LONG, mate: "SEAT" });
  const steps: CustomStep[] = [
    {
      title: "Click the castors into the base",
      detail: "Lay the base upside down on a rug and push a castor into each arm until it clicks.",
      add: ["BASE"],
      fix: [fx("castor", tips, [0, 1, 0], "BASE", { len: 58, dia: 50 })],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Pull the cap off the gas lift", detail: "It only protects the lift in the box, so recycle it." },
    { title: "Stand the base up and drop in the gas lift", detail: "Thick end down into the hub, straight in. No tools.", add: ["GAS"], pose: "+y", from: { GAS: [0, 360, 0] } },
    { title: "Slide the cushion onto the headrest bar", detail: "Its clip goes over the end of the bar.", add: ["HBAR", "HPAD"], from: { HPAD: [0, 0, 160] } },
    { title: "Press the cushion down", detail: "Push it down onto the bar until it clicks." },
    {
      title: "Turn two bolts into the top of the backrest",
      detail: "Stand the backrest up and turn the two short bolts into the bracket at the top, only part way.",
      add: ["BACK"],
      fix: [fx("bolt", [[-15, yB1 - 60, zTop - 25], [15, yB1 - 60, zTop - 25]], [0, 0, 1], "BACK", { name: "Allen bolt", len: 20, dia: 6 })],
      tools: ["allen"],
      warnings: ["loose"],
    },
    {
      title: "Bolt the headrest on",
      detail: "Hook its bar over the two bolts, then fit two button bolts through the bar.",
      fix: [fx("bolt", [[-15, hy0 - 20, hz - 2], [15, hy0 - 20, hz - 2]], [0, 0, 1], "HBAR", { ...SHORT, mate: "BACK" })],
      tools: ["allen"],
    },
    { title: "Tighten the first two bolts", detail: "Now turn them in fully with the Allen key.", tools: ["allen"] },
    { title: "Press on the cover cap", detail: "It clips over the two bolts on the back.", fix: [fx("cap", [[0, yB1 - 60, zTop - 47]], [0, 0, 1], "BACK", { name: "Cover cap", len: 10, dia: 40 })] },
    {
      title: "Bolt the mechanism under the seat",
      detail: "Lay the seat upside down on a table, front away from the edge. Four button bolts, lever on the right-hand side.",
      add: ["SEAT", "MECH"],
      fix: [fx("bolt", mechBolts, [0, 1, 0], "MECH", { ...SHORT, mate: "SEAT" })],
      tools: ["allen"],
      pose: "-y",
    },
    {
      title: "Slide the backrest bar into the mechanism",
      detail: "Push the bar in from behind until its holes line up, the backrest hanging over the table edge. Three long bolts.",
      fix: [fx("bolt", barBolts, [0, 1, 0], "MECH", { ...LONG, mate: "BACK" })],
      tools: ["allen"],
    },
    { title: "Bolt on the right armrest", detail: "Its bracket against the side of the seat, three long bolts.", add: ["ARM_R"], fix: [armBolts(1)], tools: ["allen"] },
    { title: "Bolt on the left armrest", detail: "The same on the other side.", add: ["ARM_L"], fix: [armBolts(-1)], tools: ["allen"] },
    { title: "Lower the seat onto the gas lift", detail: "Turn the seat over and press it straight down onto the lift. Sit on it once, firmly, to lock it.", pose: "+y" },
  ];
  return { parts, steps };
}

type CustomStep = CustomParams["steps"][number];

/** Parts built on their own are shown in their own scene before step `join`, and come into `target` at `join`. */
function apart(b: PlanBuilder, r: CustomParams, ids: string[], scene: string, steps: number[], join: number, off: Vec3, target = "main") {
  for (const i of steps) if (b.steps[i]) b.steps[i].scene = scene;
  for (const id of ids) {
    const p = r.parts.find((q) => q.id === id)!;
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
    if (!it) continue;
    const before = it.states.filter((st) => st.step < join).map((st) => (st.scene === "main" ? { ...st, scene } : st));
    const after = it.states.filter((st) => st.step > join && st.scene !== "main");
    it.states = [...before, { step: join, scene: target, pos: it.final.pos, rot: it.final.rot, from: off, delay: 0.2 }, ...after];
  }
}

const family: Family = {
  names: ["MATCHSPEL"],
  build(b: PlanBuilder, s: ProductSpec) {
    if (!/chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = chair(s);
    buildCustom(b, { ...s, custom: r });
    const idx = (re: RegExp) => r.steps.findIndex((x) => re.test(x.title));
    const head = idx(/headrest on/), bar = idx(/backrest bar/), seat = idx(/onto the gas lift/);
    apart(b, r, ["HBAR", "HPAD"], "head", [idx(/cushion onto/), idx(/cushion down/)], head, [0, 260, 0], "back");
    apart(b, r, ["BACK", "HBAR", "HPAD"], "back", [idx(/two bolts into/), head, idx(/first two/), idx(/cover cap/)], bar, [0, -300, 0]);
    apart(b, r, ["BASE", "GAS"], "base", [0, 1, 2], seat, [0, -420, 0]);
    return true;
  },
};
export default family;
