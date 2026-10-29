import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, Vec3 } from "../../types";

/**
 * HEMLINGBY 2-seat sofa, read from its manual (still sold in Australia). The back gets three studs screwed into its
 * underside and is lowered onto the seat; the sofa is laid on its back and the studs nutted from underneath with the
 * box spanner. Each armrest gets three studs in its inner side, is pushed onto the seat and nutted from inside the
 * frame, then the four legs screw in and it is stood up. Nine studs, washers and nuts in all.
 */

// IKEA's measures: 145 wide, 71.5 deep, 71.5 high, seat 42 high and 137 wide, arms 61 high, 14.5 under
const W = 1450, D = 715, H = 715, SEAT = 420, ARM = 610, UNDER = 145, SW = 1370;
const AW = (W - SW) / 2, BT = 190; // arm width, back thickness

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const STUD = { len: 70, dia: 8, name: "Threaded stud" };
const WASHER = { len: 2, dia: 20 };
const NUT = { len: 7, dia: 8 };

function sofa(): CustomParams {
  const xs = SW / 2;
  const zb = -D / 2 + BT / 2;
  const parts: CustomPart[] = [
    { id: "S", name: "Seat", size: [SW, SEAT - UNDER, D], pos: [0, (SEAT + UNDER) / 2, 0], material: "soft" },
    { id: "B", name: "Back", size: [SW, H - SEAT, BT], pos: [0, (H + SEAT) / 2, zb], material: "soft" },
    { id: "AL", name: "Armrest", size: [AW, ARM - UNDER, D], pos: [-xs - AW / 2, (ARM + UNDER) / 2, 0], material: "soft" },
    { id: "AR", name: "Armrest", size: [AW, ARM - UNDER, D], pos: [xs + AW / 2, (ARM + UNDER) / 2, 0], material: "soft" },
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz, j): CustomPart => ({ id: `L${sx < 0 ? 0 : 1}${j}`, name: "Leg", shape: "cyl", size: [50, UNDER, 50], pos: [sx * (xs - 70), UNDER / 2, sz * (D / 2 - 70)], material: "wood" })),
    ),
  ];
  const backStuds: Vec3[] = [-450, 0, 450].map((x) => [x, SEAT, zb]);
  const backNuts: Vec3[] = backStuds.map((p) => [p[0], SEAT - 60, p[2]]);
  const armStuds = (sx: number): Vec3[] => [[sx * xs, 300, -200], [sx * xs, 300, 200], [sx * xs, 200, 0]];
  const armNuts = (sx: number): Vec3[] => armStuds(sx).map((p) => [p[0] - sx * 60, p[1], p[2]]);
  const legs = parts.filter((p) => p.name === "Leg").map((p) => p.id);
  const steps: CustomStep[] = [
    {
      title: "Screw three studs into the bottom of the back",
      detail: "By hand, until they stop.",
      fix: [fx("stud", backStuds, [0, -1, 0], { ...STUD, on: "B", mate: "S" })],
      add: ["S"],
      wait: ["B"],
    },
    { title: "Lower the back onto the seat", detail: "The studs go down through the holes at the back of the seat.", add: ["B"], from: { B: [0, 400, 0] } },
    { title: "Lay the sofa on its back", detail: "On a rug, so you can reach under the seat. Push the back hard against the seat so they line up.", pose: "+z", warnings: ["floor"] },
    {
      title: "Nut the back on from underneath",
      detail: "A washer and a nut on each stud, tightened with the box spanner. The back's lower edge sits flush with the seat's.",
      fix: [fx("washer", backNuts, [0, 1, 0], { ...WASHER, on: "S" }), fx("nut", backNuts, [0, 1, 0], { ...NUT, on: "S", mate: "B" })],
      tools: ["wrench"],
    },
    {
      title: "Screw three studs into each armrest",
      detail: "Into the inner side, by hand.",
      fix: [-1, 1].map((sx) => fx("stud", armStuds(sx), [sx, 0, 0], { ...STUD, on: sx < 0 ? "AL" : "AR", mate: "S" })),
      wait: ["AL", "AR"],
    },
    {
      title: "Bolt the armrests on",
      detail: "Push each one onto the side of the seat, studs through the frame, then a washer and a nut on each from inside with the box spanner.",
      add: ["AL", "AR"],
      from: { AL: [-350, 0, 0], AR: [350, 0, 0] },
      fix: [-1, 1].flatMap((sx) => [fx("washer", armNuts(sx), [-sx, 0, 0], { ...WASHER, on: "S" }), fx("nut", armNuts(sx), [-sx, 0, 0], { ...NUT, on: "S", mate: sx < 0 ? "AL" : "AR" })]),
      tools: ["wrench"],
    },
    { title: "Screw in the legs", detail: "Four, clockwise by hand until each one is snug.", add: legs },
    { title: "Stand the sofa up", detail: "Lift it by the frame, never by the legs.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["HEMLINGBY"],
  recipe(s) {
    return /hemlingby-2-seat-sofa/.test(s.slug ?? "") ? sofa() : null;
  },
};
export default family;
