import type { Family } from "./family";
import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";

/**
 * DALFRED bar stool, read from its manual. Four square legs are screwed to a round top hub and a lower hub, two at a
 * time with two long screws each. Upside down, the footrest ring drops over the legs and four shorter screws go
 * through it into the legs. The seat gets a steel plate with a socket screwed under it (five small screws), the frame
 * stood up gets the nut housing on its top hub (four screws), the threaded spindle is tapped into the seat's socket,
 * an end stop is tapped onto its other end, and the seat is screwed down into the frame. Turning the seat sets the
 * height, 63 to 74 cm.
 */

const LONG: HwDef = { kind: "screw", len: 70, dia: 6, name: "Long screw" };
const RING_SCREW: HwDef = { kind: "screw", len: 40, dia: 6 };
const PLATE_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const HOUSING_SCREW: HwDef = { kind: "screw", len: 25, dia: 4 };
const END_STOP: HwDef = { kind: "cap", len: 20, dia: 30, name: "End stop" };

const r = (n: number) => Math.round(n * 10) / 10;

function stool(b: PlanBuilder, s: ProductSpec) {
  // IKEA: 50 x 50 footprint, seat 30 across, 63 to 74 high; drawn a little above the lowest height
  const foot = (s.size.w * 10 || 500) / 2 - 20;
  const ySeat = 680, seatT = 30, seatD = 300;
  const L = 38; // leg section
  const yTopHub = 545, yLowHub = 415, yRing = 250, yLegTop = 580;
  const rTop = 79; // leg centre at its top, from the middle
  const lean = Math.atan2(foot - rTop, yLegTop);
  const legR = (y: number) => rTop + ((yLegTop - y) / yLegTop) * (foot - rTop); // leg centre at a height

  // the legs, in a cross: two along x, two along z
  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const legLen = Math.hypot(foot - rTop, yLegTop);
  const legRef = b.part("Leg", [L, r(legLen), L], { material: "wood" });
  const legs = dirs.map(([dx, dz]) => {
    const rc = legR(yLegTop / 2);
    const rot: Vec3 = dx ? [0, 0, dx * lean] : [-dz * lean, 0, 0];
    return b.place(legRef, [r(dx * rc), yLegTop / 2, r(dz * rc)], rot);
  });
  const topHub = b.place(b.part("Top hub", [136, 50, 136], { material: "wood", shape: "cyl" }), [0, yTopHub, 0]);
  const lowHub = b.place(b.part("Lower hub", [2 * (legR(yLowHub) - L / 2), 30, 2 * (legR(yLowHub) - L / 2)], { material: "wood", shape: "cyl" }), [0, yLowHub, 0]);

  // the footrest ring, touching the inside faces of the legs
  const tube = 16, R = legR(yRing) - L / 2 - tube / 2;
  const seg: PartPiece[] = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { shape: "cyl", size: [tube, r((2 * Math.PI * R) / 16 + 2), tube], pos: [r(R * Math.cos(a)), 0, r(R * Math.sin(a))], rot: [0, Math.PI / 2 - a, Math.PI / 2] };
  });
  const ringT = b.compound("Footrest ring", seg, { material: "metal" });
  const ring = b.place(ringT.type, [ringT.mid[0], yRing + ringT.mid[1], ringT.mid[2]]);

  // the seat, its plate and socket, the spindle, and the nut housing on the top hub
  const seat = b.place(b.part("Seat", [seatD, seatT, seatD], { material: "wood", shape: "cyl" }), [0, ySeat - seatT / 2, 0]);
  const yPlate = ySeat - seatT; // underside of the seat
  const plateT = b.compound(
    "Seat plate",
    [
      { shape: "cyl", size: [180, 8, 180], pos: [0, -4, 0] },
      { shape: "cyl", size: [50, 40, 50], pos: [0, -28, 0] },
    ],
    { material: "metal" },
  );
  const plate = b.place(plateT.type, [plateT.mid[0], yPlate + plateT.mid[1], plateT.mid[2]]);
  const ySpin0 = 300, ySpin1 = yPlate - 10;
  const spindle = b.place(b.part("Threaded spindle", [28, ySpin1 - ySpin0, 28], { material: "metal", shape: "cyl" }), [0, (ySpin0 + ySpin1) / 2, 0]);
  const yHub1 = yTopHub + 25;
  const housingT = b.compound(
    "Nut housing",
    [
      { shape: "cyl", size: [90, 5, 90], pos: [0, 2.5, 0] },
      { shape: "cyl", size: [44, 50, 44], pos: [0, 30, 0] },
    ],
    { material: "metal" },
  );
  const housing = b.place(housingT.type, [housingT.mid[0], yHub1 + housingT.mid[1], housingT.mid[2]]);

  // two long screws through each leg, from outside, into the top hub and the lower hub
  const legScrews = (i: number): FitOpts[] => {
    const [dx, dz] = dirs[i];
    return [yTopHub, yLowHub].map((y) => {
      const ro = legR(y) + L / 2 + 1;
      return { on: legs[i], at: [r(dx * ro), y, r(dz * ro)] as Vec3, dir: [-dx, 0, -dz] as Vec3, mate: y === yTopHub ? topHub : lowHub };
    });
  };
  const ringScrews: FitOpts[] = dirs.map(([dx, dz], i) => ({ on: ring, at: [r(dx * (R - tube / 2)), yRing, r(dz * (R - tube / 2))] as Vec3, dir: [dx, 0, dz] as Vec3, mate: legs[i] }));
  // the seat and what goes under it are built on their own, upside down (the step's pose turns them over)
  const here = (k: string): Vec3 => b.partItem(k).final.pos;
  const around = (n: number, rad: number, y: number, a0 = 0): Vec3[] => Array.from({ length: n }, (_, i) => [r(rad * Math.cos(a0 + (i * 2 * Math.PI) / n)), y, r(rad * Math.sin(a0 + (i * 2 * Math.PI) / n))] as Vec3);

  b.step({ title: "Screw two legs to the hubs", detail: "On a rug, the two hubs between the legs. Two long screws through each leg, one into each hub, with the Allen key.", kind: "screws", tools: ["allen"], pose: "+z", scene: "main", warnings: ["floor"] }, () => {
    b.stagger(0.25);
    b.add(topHub, [0, 0, 200]);
    b.add(lowHub, [0, 0, 200]);
    b.then(0.1);
    b.add(legs[0], [200, 0, 0]);
    b.add(legs[1], [-200, 0, 0]);
    b.then(0.1);
    b.fits(LONG, [...legScrews(0), ...legScrews(1)], 0.1);
  });
  b.step({ title: "Screw on the other two legs", detail: "The same way, across the first pair: two long screws each.", kind: "screws", tools: ["allen"], pose: "-y", scene: "main" }, () => {
    b.stagger(0.25);
    b.add(legs[2], [0, 0, 200]);
    b.add(legs[3], [0, 0, -200]);
    b.then(0.1);
    b.fits(LONG, [...legScrews(2), ...legScrews(3)], 0.1);
  });
  b.step({ title: "Drop the footrest ring over the legs", detail: "With the frame upside down it slides down the legs until it sits against them. Four shorter screws through the ring into the legs.", kind: "screws", tools: ["allen"], pose: "-y", scene: "main" }, () => {
    b.add(ring, [0, -300, 0]);
    b.then(0.12);
    b.fits(RING_SCREW, ringScrews, 0.1);
  });
  b.step({ title: "Tighten the screws in the lower hub", detail: "Give the four screws through the legs into the lower hub a last firm turn.", kind: "screws", tools: ["allen"], pose: "-y", scene: "main" }, () => {});

  b.step({ title: "Screw the plate under the seat", detail: "Seat face down on a rug, the socket pointing up. Five small screws.", kind: "screws", tools: ["screwdriver"], pose: "-y", scene: "seat", warnings: ["floor"] }, () => {
    b.stage(seat, here(seat), [0, 0, 0], [0, -160, 0]);
    b.then(0.1);
    b.stage(plate, here(plate), [0, 0, 0], [0, -160, 0]);
    b.then(0.1);
    b.fits(PLATE_SCREW, around(5, 70, yPlate - 8, Math.PI / 2).map((at): FitOpts => ({ on: plate, at, dir: [0, 1, 0], mate: seat })), 0.08);
  });
  b.step({ title: "Stand the frame up and screw on the nut housing", detail: "Over the hole in the top hub. Four screws through its flange.", kind: "screws", tools: ["screwdriver"], pose: "+y", scene: "main" }, () => {
    b.add(housing, [0, 200, 0]);
    b.then(0.1);
    b.fits(HOUSING_SCREW, around(4, 35, yHub1 + 5, Math.PI / 4).map((at): FitOpts => ({ on: housing, at, dir: [0, -1, 0], mate: topHub })), 0.08);
  });
  b.step({ title: "Tap the spindle into the seat's socket", detail: "Smooth end first, with a hammer, until it stops.", kind: "general", tools: ["hammer"], pose: "-y", scene: "seat" }, () => {
    b.stage(spindle, here(spindle), [0, 0, 0], [0, -200, 0]);
  });
  b.step({ title: "Tap the end stop onto the spindle", detail: "Onto its free end, with a rubber mallet or a hammer over a piece of wood. It stops the seat coming off.", kind: "general", tools: ["hammer"], pose: "-y", scene: "seat" }, () => {
    b.fit(END_STOP, { on: spindle, at: [0, ySpin0, 0], dir: [0, 1, 0], hole: false });
  });
  b.step({ title: "Screw the seat into the frame", detail: "Spindle down into the nut housing, then turn the seat clockwise. Turn it on or back to set the height you want.", kind: "join", pose: "+y", scene: "main" }, () => {
    b.stagger(0);
    for (const k of [seat, plate, spindle]) b.add(k, [0, 300, 0], { spin: Math.PI * 2 });
  });
}

const family: Family = {
  names: ["DALFRED"],
  build(b, s) {
    if (!/bar stool/i.test(s.variant) && !/dalfred-bar-stool/.test(s.slug ?? "")) return false;
    stool(b, s);
    return true;
  },
};
export default family;
