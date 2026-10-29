import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * TEODORES, read from the chair's manual. Each side is one steel frame: a front leg, the seat rail, a back leg and
 * the upright that rises into the backrest. A plastic strip clicks into each upright and two threaded spacers screw
 * into it. The backrest shell slides down onto one side, the other side is pushed up into it, and the front and back
 * rails are held between the sides by a bolt at each end, by hand. Two small screws hold the backrest to the
 * uprights, then the four bolts are tightened with the chair standing on its four feet. The seat slides in from the
 * front, its front is pressed down until its clips catch the rails, and upside down on a table edge four screws with
 * plastic bushes go up through the side rails into it.
 */

const T = 22; // steel tube
const BOLT = { name: "Allen bolt", len: 40, dia: 6 };

function part(id: string, name: string, abs: PartPiece[], lo: Vec3, hi: Vec3, material: CustomPart["material"]): CustomPart {
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const pieces = abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces, material };
}

/** A square tube from a to b in one side's plane (leaning front to back only). */
function bar(a: Vec3, b: Vec3): PartPiece {
  const dy = b[1] - a[1], dz = b[2] - a[2];
  return { shape: "box", size: [T, Math.hypot(dy, dz), T], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(dz, dy), 0, 0] };
}

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string | undefined, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function chair(s: ProductSpec): CustomParams {
  // IKEA: 46 wide, 53 deep, 80 high, seat 45 high
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const xs = W / 2 - T / 2, xi = xs - T / 2;
  const yR = 420; // seat rails
  const zf = D / 2 - T / 2 - 4, zbF = -D / 2 + T / 2 + 4, zb = zbF + 40; // front leg, back foot, back leg top
  const upTop = H - 20, lean = 25;
  const zUp = (y: number) => zb - (lean * (y - yR)) / (upTop - yR);
  const ang = Math.atan2(lean, upTop - yR);
  const side = (id: string, sx: number): CustomPart => {
    const x = sx * xs;
    return part(
      id,
      "Side frame",
      [bar([x, 0, zf], [x, yR + T / 2, zf]), bar([x, yR, zf + T / 2], [x, yR, zb - T / 2]), bar([x, 0, zbF], [x, yR, zb]), bar([x, yR, zb], [x, upTop, zUp(upTop)])],
      [x - T / 2, 0, zbF - T / 2],
      [x + T / 2, upTop, zf + T / 2],
      "metal",
    );
  };
  const yB0 = 560, yB = (yB0 + H) / 2;
  const yS = 690;
  const strip = (id: string, sx: number): CustomPart => ({ id, name: "Back strip", size: [10, 170, 16], pos: [sx * (xi - 4), yS, zUp(yS)], rot: [-ang, 0, 0], material: "board" });
  const rail = (id: string, name: string, z: number): CustomPart => ({ id, name, size: [2 * xi, 30, 40], pos: [0, yR - 10, z], material: "board" });
  const zRf = zf - 30, zRb = zb + 28;
  const seatY0 = yR + T / 2;
  const parts: CustomPart[] = [
    side("SIDE_L", -1),
    side("SIDE_R", 1),
    strip("STRIP_L", -1),
    strip("STRIP_R", 1),
    { id: "BACK", name: "Backrest", size: [W, H - yB0, 40], pos: [0, yB, zUp(yB)], rot: [-ang, 0, 0], material: "board" },
    rail("RAIL_F", "Front rail", zRf),
    rail("RAIL_B", "Back rail", zRb),
    { id: "SEAT", name: "Seat", size: [W - 10, 26, zf + T / 2 + 14 - (zb + T / 2 + 14)], pos: [0, seatY0 + 13, (zf + zb + T + 28) / 2], material: "board" },
  ];

  const spacers = (sx: number) => fx("spacer", [600, 650].map((y): Vec3 => [sx * xi, y, zUp(y)]), [sx, 0, 0], sx < 0 ? "SIDE_L" : "SIDE_R", { name: "Threaded spacer", len: 30, dia: 10 });
  const railBolts = (id: string, z: number) => [-1, 1].map((sx) => fx("bolt", [[sx * (xs + T / 2), yR - 10, z]], [-sx, 0, 0], sx < 0 ? "SIDE_L" : "SIDE_R", { ...BOLT, mate: id }));
  const seatPts: Vec3[] = [-1, 1].flatMap((sx) => [-90, 160].map((z): Vec3 => [sx * xs, yR - T / 2, z]));
  const bySide = (pts: Vec3[], sx: number) => pts.filter((p) => Math.sign(p[0]) === sx);
  return {
    parts,
    steps: [
      {
        title: "Click a back strip into each side",
        detail: "Cut the two strips apart and lay both sides on a rug. Match the square and round marks on each strip to the holes in its upright, and press it in until it clicks.",
        add: ["SIDE_L", "SIDE_R", "STRIP_L", "STRIP_R"],
        warnings: ["floor"],
      },
      {
        title: "Screw two spacers into each upright",
        detail: "Into the holes on the inside of the upright, beside the strip. Turn them in with the big Allen key until they sit flat.",
        fix: [spacers(-1), spacers(1)],
        tools: ["allen"],
      },
      { title: "Slide the backrest down onto one side", detail: "Its channel goes over the strip on the upright. Push it down as far as it goes.", add: ["BACK"], from: { BACK: [0, 320, 0] } },
      { title: "Push the other side up into the backrest", detail: "Its upright slides into the backrest's other channel, strip first, all the way up." },
      {
        title: "Fit the front rail between the sides",
        detail: "Push it up between the front of the seat rails until it sits flush. One bolt through each side, turned in by hand.",
        add: ["RAIL_F"],
        fix: railBolts("RAIL_F", zRf),
        from: { RAIL_F: [0, -220, 0] },
        warnings: ["loose"],
      },
      {
        title: "Fit the back rail the same way",
        detail: "Push it up between the sides at the back, then two more bolts by hand.",
        add: ["RAIL_B"],
        fix: railBolts("RAIL_B", zRb),
        from: { RAIL_B: [0, -220, 0] },
        warnings: ["loose"],
      },
      {
        title: "Screw the backrest to the uprights",
        detail: "One small screw through the back of each upright into the backrest, with a screwdriver, not a drill.",
        fix: [-1, 1].map((sx) => fx("screw", [[sx * xs, 720, zUp(720) - T / 2]], [0, 0, 1], sx < 0 ? "SIDE_L" : "SIDE_R", { len: 16, dia: 3.5, mate: "BACK" })),
        tools: ["screwdriver"],
      },
      {
        title: "Stand it up and tighten the four bolts",
        detail: "First check that all four feet touch the floor and the chair doesn't rock, then tighten each bolt firmly.",
        tools: ["allen"],
        check: "square",
      },
      {
        title: "Slide the seat in from the front",
        detail: "Tilt it and push its back edge in under the backrest, over the back rail, until it stops.",
        add: ["SEAT"],
        from: { SEAT: [0, 120, 300] },
      },
      { title: "Press the front of the seat down", detail: "Push down at the front until its four clips snap over the rails." },
      {
        title: "Screw the seat on from underneath",
        detail: "Lay the chair upside down on a table, the backrest over the edge. A plastic bush, then a screw, at each of the four holes in the side rails. Use a screwdriver, not a drill.",
        fix: [-1, 1].flatMap((sx) => [
          // the screw first: the bush then shares its point instead of pushing it aside
          fx("screw", bySide(seatPts, sx), [0, 1, 0], sx < 0 ? "SIDE_L" : "SIDE_R", { len: 20, dia: 4, mate: "SEAT" }),
          fx("washer", bySide(seatPts, sx), [0, 1, 0], sx < 0 ? "SIDE_L" : "SIDE_R", { name: "Plastic bush", len: 6, dia: 14 }),
        ]),
        pose: "-y",
        tools: ["screwdriver"],
      },
    ],
  };
}

/** The second side lies on the rug beside the first until it is pushed up into the backrest. */
function holdSide(b: PlanBuilder, r: CustomParams, ids: string[], until: number) {
  for (const id of ids) {
    const p = r.parts.find((q) => q.id === id)!;
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
    const first = it?.states[0];
    if (!it || !first) continue;
    it.states = [{ ...first, pos: [p.pos[0] + 300, p.pos[1], p.pos[2]] }, { ...first, step: until, pos: it.final.pos, from: [300, 0, 0], delay: 0.2 }, ...it.states.slice(1)];
  }
}

const family: Family = {
  names: ["TEODORES"],
  build(b, s) {
    if (!/chair/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = chair(s);
    buildCustom(b, { ...s, custom: r });
    holdSide(b, r, ["SIDE_R", "STRIP_R"], r.steps.findIndex((x) => /other side up/.test(x.title)));
    return true;
  },
};
export default family;
