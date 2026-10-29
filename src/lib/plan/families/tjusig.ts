import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, PartPiece, Vec3 } from "../../types";

/**
 * TJUSIG, read from IKEA's manuals for the 79 cm hat rack, the 108 cm bench with shoe storage and the 79 cm shoe
 * rack. All three are two wooden ends with steel tubes between them, built standing on one end.
 * Hat rack: five hooks screwed to the hook rail, an arm dowelled onto its upright, the front rail bolted into the arm
 * through a barrel nut, the hook rail and four tubes pushed in, a cardboard spacer over the tube ends, the other arm
 * and upright on and bolted, the hook rail bolted at both ends and the arms screwed down, then four wall screws.
 * Bench: two lower rails dowelled and bolted to one end frame, the upper back rail and eight tubes stood in it, the
 * spacer, the other end frame dowelled and bolted on, the back rail bolted at both ends, and the seat screwed on
 * from underneath. Shoe rack: two ladders of crossbars and tubes bolted together, the uprights dowelled and screwed
 * on, the middle tubes pushed in, and a plate that joins two racks stacked on top of each other.
 */

const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const S = [-1, 1];
const BARREL = { name: "Barrel nut", len: 14, dia: 10 };
const DOWEL = { len: 30, dia: 8 };

/* ---------------------------------------------------------------- hat rack */

function hatRack(): CustomParams {
  const W = 790, H = 250, D = 320;
  const ex = W / 2 - 14; // ends, centre
  const ix = ex - 14; // inside face of the ends
  const L = 2 * ix;
  const yT = H - 20; // the shelf
  const tubeZ = [-100, -40, 20, 80];
  const zU = -D / 2 + 20;
  const parts: CustomPart[] = [
    { id: "HR", name: "Hook rail", size: [L, 40, 25], pos: [0, 30, -D / 2 + 12.5], material: "wood" },
    ...S.map((sx, i): CustomPart => ({ id: `A${i}`, name: "Arm", size: [28, 40, D], pos: [sx * ex, yT, 0], material: "wood" })),
    ...S.map((sx, i): CustomPart => ({ id: `U${i}`, name: "Upright", size: [28, yT - 20, 40], pos: [sx * ex, (yT - 20) / 2, zU], material: "wood" })),
    { id: "FR", name: "Front rail", size: [L, 30, 30], pos: [0, yT + 5, D / 2 - 20], material: "wood" },
    ...tubeZ.map((z, k): CustomPart => ({ id: `T${k}`, name: "Tube", size: [L, 20, 20], pos: [0, yT + 5, z], shape: "cyl", material: "metal" })),
  ];
  const hookX = [-300, -150, 0, 150, 300];
  const steps: CustomStep[] = [
    {
      title: "Screw the five hooks to the hook rail",
      detail: "One screw through each hook, evenly along the rail.",
      add: ["HR"],
      fix: [
        fx("hook", hookX.map((x) => pt(x, 30, -D / 2 + 25)), [0, 0, -1], { on: "HR" }),
        fx("screw", hookX.map((x) => pt(x, 40, -D / 2 + 26)), [0, 0, -1], { len: 16, dia: 3.5, on: "HR" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Dowel an arm onto its upright",
      detail: "Two dowels in the top of the upright, the arm pressed down on them. Check the marked ends match.",
      add: ["A0", "U0"],
      fix: [fx("dowel", [-10, 10].map((d) => pt(-ex, yT - 20, zU + d)), [0, -1, 0], { on: "U0", mate: "A0", ...DOWEL })],
      // the upright slides in along the floor, then the arm goes onto its dowels
      from: { U0: [0, -250, 0], A0: [0, 250, 0] },
      pose: "+x",
      tools: ["hammer"],
    },
    {
      title: "Push the front rail into the arm",
      detail: "Drop a barrel nut into the hole near the rail's end, slot along the rail.",
      add: ["FR"],
      fix: [fx("nut", [pt(-ix + 25, yT + 20, D / 2 - 20)], [0, -1, 0], { on: "FR", ...BARREL })],
      tools: ["flathead"],
    },
    {
      title: "Bolt the arm to the front rail",
      detail: "A long bolt through the arm into the barrel nut.",
      fix: [fx("bolt", [pt(-W / 2, yT + 5, D / 2 - 20)], [1, 0, 0], { len: 80, dia: 6 })],
      tools: ["allen"],
    },
    { title: "Push the hook rail into the upright", detail: "Into the hole low on the upright, hooks pointing away from the wall." },
    { title: "Push in the first tube", detail: "Into the hole next to the front rail.", add: ["T3"], warnings: ["hand"] },
    { title: "Push in the other three tubes", detail: "All the way into their holes.", add: ["T2", "T1", "T0"] },
    { title: "Slide the cardboard spacer over the tube ends", detail: "It holds them in line while the other arm goes on." },
    {
      title: "Dowel the other arm onto its upright",
      detail: "Beside the rack, the same way as the first: the dowel in the top of the upright, the arm pressed onto it.",
      wait: ["U1", "A1"],
      fix: [fx("dowel", [pt(ex, yT - 20, zU)], [0, -1, 0], { on: "U1", mate: "A1", ...DOWEL })],
      from: { U1: [0, -250, 0], A1: [0, 250, 0] },
      tools: ["hammer"],
    },
    {
      title: "Press them down over the rail and the tubes",
      detail: "Both together, over the front rail, the four tubes and the hook rail, until they sit on the spacer.",
      add: ["A1", "U1"],
    },
    {
      title: "Drop in the second barrel nut",
      detail: "Into the other end of the front rail, slot along the rail.",
      fix: [fx("nut", [pt(ix - 25, yT + 20, D / 2 - 20)], [0, -1, 0], { on: "FR", ...BARREL })],
      tools: ["flathead"],
    },
    {
      title: "Bolt the second arm to the front rail",
      detail: "The long bolt through the arm into the nut. Then pull off the cardboard spacer.",
      fix: [fx("bolt", [pt(W / 2, yT + 5, D / 2 - 20)], [-1, 0, 0], { len: 80, dia: 6 })],
      tools: ["allen"],
    },
    {
      title: "Bolt the hook rail to both uprights",
      detail: "Lay the rack down. One short bolt through each upright into the end of the hook rail.",
      fix: S.map((sx) => fx("bolt", [pt(sx * (W / 2), 30, -D / 2 + 12.5)], [-sx, 0, 0], { len: 30, dia: 6 })),
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Screw the uprights to the arms",
      detail: "One screw through each upright at the top, into the arm.",
      fix: S.map((sx) => fx("screw", [pt(sx * ix, yT - 35, zU + 10)], [sx, 0, 0], { len: 30, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw it to the wall",
      detail: "Two screws through each upright, level across. Wall plugs and screws aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", S.flatMap((sx) => [70, 170].map((y) => pt(sx * ex, y, -D / 2 - 30))), [0, 0, -1]),
        fx("screw", S.flatMap((sx) => [70, 170].map((y) => pt(sx * ex, y, zU + 20))), [0, 0, -1], { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "level", "pencil"],
      wall: true,
      warnings: ["wall"],
    },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- bench with shoe storage */

function bench(): CustomParams {
  const W = 1080, H = 500, D = 340, ST = 20;
  const FH = H - ST; // end frames
  const ex = W / 2 - 20 - 20; // end frames, centre (the seat overhangs a little)
  const ix = ex - 20;
  const L = 2 * ix;
  const LZ = D / 2 - 30;
  const bars = [130, 300, FH - 20];
  const frame: PartPiece[] = [
    ...S.map((sz): PartPiece => ({ shape: "box", size: [40, FH, 40], pos: [0, 0, sz * LZ] })),
    ...bars.map((y): PartPiece => ({ shape: "box", size: [40, 40, 2 * LZ - 40], pos: [0, y - FH / 2, 0] })),
  ];
  const yR = 70; // lower rails
  const tubeZ = [-90, -30, 30, 90];
  const parts: CustomPart[] = [
    ...S.map((sx, i): CustomPart => ({ id: `E${i}`, name: "End frame", size: [40, FH, 2 * LZ + 40], pos: [sx * ex, FH / 2, 0], pieces: frame, material: "board" })),
    ...S.map((sz, i): CustomPart => ({ id: `R${i}`, name: "Lower rail", size: [L, 40, 25], pos: [0, yR, sz * LZ], material: "board" })),
    { id: "UB", name: "Back rail", size: [L, 40, 25], pos: [0, FH - 20, -LZ], material: "board" },
    ...[bars[0], bars[1]].flatMap((y, l) => tubeZ.map((z, k): CustomPart => ({ id: `T${l}${k}`, name: "Tube", size: [L, 20, 20], pos: [0, y, z], shape: "cyl", material: "metal" }))),
    { id: "SE", name: "Seat", size: [W, ST, D], pos: [0, H - ST / 2, 0], material: "board" },
  ];
  const railEnd = (sx: number) => S.map((sz) => pt(sx * ix, yR, sz * LZ));
  const steps: CustomStep[] = [
    {
      title: "Push the two lower rails onto an end frame",
      detail: "A dowel in the end of each rail, into the holes low on the frame's legs.",
      add: ["E0", "R0", "R1"],
      fix: [fx("dowel", railEnd(-1).map((p) => pt(p[0], p[1] + 10, p[2])), [1, 0, 0], DOWEL)],
      tools: ["hammer"],
    },
    {
      title: "Bolt the rails to the end frame",
      detail: "A barrel nut in each rail, slot along the rail, then a long bolt through the leg into it.",
      fix: [
        fx("nut", railEnd(-1).map((p) => pt(p[0] + 35, p[1] + 20, p[2])), [0, -1, 0], BARREL),
        fx("bolt", railEnd(-1).map((p) => pt(-ex - 20, p[1], p[2])), [1, 0, 0], { len: 100, dia: 6 }),
      ],
      tools: ["flathead", "allen"],
    },
    {
      title: "Stand it on the end frame and fit the back rail",
      detail: "Two dowels in the end of the back rail, then push it into the frame's top back corner. Hold it upright.",
      add: ["UB"],
      fix: [fx("dowel", [-12, 12].map((dz) => pt(-ix, FH - 20, -LZ + dz)), [1, 0, 0], { on: "UB", ...DOWEL })],
      pose: "+x",
      tools: ["hammer"],
    },
    { title: "Stand two tubes in the end frame", detail: "Smooth end down into the holes.", add: ["T00", "T10"] },
    { title: "Stand in the other six tubes", detail: "Four in each level.", add: ["T01", "T02", "T03", "T11", "T12", "T13"] },
    { title: "Fold out the cardboard spacer", detail: "It comes in the box, punched with a hole for each tube." },
    { title: "Press the spacer onto the tube ends", detail: "It holds them upright and in line for the next step." },
    {
      title: "Put the other end frame on",
      detail: "Dowels in the free ends of the three rails, then lower the frame over the tubes and the rails.",
      add: ["E1"],
      fix: [
        fx("dowel", railEnd(1).map((p) => pt(p[0], p[1] + 10, p[2])), [-1, 0, 0], DOWEL),
        fx("dowel", [-12, 12].map((dz) => pt(ix, FH - 20, -LZ + dz)), [-1, 0, 0], { on: "UB", ...DOWEL }),
      ],
      tools: ["hammer"],
    },
    {
      title: "Bolt the rails to the second end frame",
      detail: "Barrel nuts in the rails, long bolts through the legs.",
      fix: [
        fx("nut", railEnd(1).map((p) => pt(p[0] - 35, p[1] + 20, p[2])), [0, -1, 0], BARREL),
        fx("bolt", railEnd(1).map((p) => pt(ex + 20, p[1], p[2])), [-1, 0, 0], { len: 100, dia: 6 }),
      ],
      tools: ["flathead", "allen"],
    },
    {
      title: "Bolt the back rail to the top of the frame",
      detail: "Two short bolts through the end frame into the back rail.",
      fix: [fx("bolt", [-12, 12].map((dz) => pt(ex + 20, FH - 20, -LZ + dz)), [-1, 0, 0], { len: 40, dia: 6 })],
      tools: ["allen"],
    },
    { title: "Pull off the cardboard spacer", detail: "Tear it away from the tubes and throw it out." },
    {
      title: "Lay it down and bolt the other end of the back rail",
      detail: "Two more short bolts, through the first end frame.",
      fix: [fx("bolt", [-12, 12].map((dz) => pt(-ex - 20, FH - 20, -LZ + dz)), [1, 0, 0], { len: 40, dia: 6 })],
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Screw the seat on from underneath",
      detail: "Lay the seat face down and the frame upside down on it, flush at the back. Seven screws up through the frames and the back rail.",
      add: ["SE"],
      fix: [
        fx("screw", S.flatMap((sx) => [-90, 90].map((z) => pt(sx * ex, FH - 40, z))), [0, 1, 0], { len: 50, dia: 5 }),
        fx("screw", [-300, 0, 300].map((x) => pt(x, FH - 40, -LZ)), [0, 1, 0], { len: 50, dia: 5 }),
      ],
      tools: ["allen"],
      pose: "-y",
    },
    { title: "Turn the bench over", pose: "+y", detail: "Stand it on its legs." },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- shoe rack */

function shoeRack(): CustomParams {
  const W = 790, H = 370, D = 320;
  const UX = W / 2 - 20, UZ = D / 2 - 20; // uprights, centre
  const cx = UX; // crossbars run between the uprights, front to back
  const cl = 2 * UZ - 40;
  const ix = cx - 15;
  const L = 2 * ix;
  const levels = [110, 290];
  const zs = [-110, -55, 0, 55, 110];
  const outer = [0, 4]; // the ladder tubes, front and back
  const parts: CustomPart[] = [
    ...levels.flatMap((y, l) => S.map((sx, i): CustomPart => ({ id: `C${l}${i}`, name: "Crossbar", size: [30, 40, cl], pos: [sx * cx, y, 0], material: "wood" }))),
    ...levels.flatMap((y, l) => zs.map((z, k): CustomPart => ({ id: `T${l}${k}`, name: "Tube", size: [L, 18, 18], pos: [0, y + 5, z], shape: "cyl", material: "metal" }))),
    ...S.flatMap((sx, i) => S.map((sz, j): CustomPart => ({ id: `U${i}${j}`, name: "Upright", size: [40, H, 40], pos: [sx * UX, H / 2, sz * UZ], material: "wood" }))),
  ];
  const ladder = (l: number) => [`C${l}0`, `C${l}1`, ...outer.map((k) => `T${l}${k}`)];
  const mids = (l: number) => [1, 2, 3].map((k) => `T${l}${k}`);
  const steps: CustomStep[] = [
    {
      title: "Lay out the two ladders",
      detail: "Two crossbars and two tubes for each, the crossbars' marks facing the same way and the tubes' plugged ends at the crossbars.",
      add: [...ladder(0), ...ladder(1)],
      warnings: ["floor"],
    },
    {
      title: "Bolt the tubes to the crossbars",
      detail: "A bolt through each crossbar into the end of each tube, eight in all.",
      fix: levels.flatMap((y) => S.map((sx) => fx("bolt", outer.map((k) => pt(sx * (cx + 15), y + 5, zs[k])), [-sx, 0, 0], { len: 30, dia: 6 }))),
      tools: ["allen"],
    },
    {
      title: "Tap dowels into two uprights",
      detail: "Two in the inside face of each, where the crossbars go.",
      add: ["U00", "U01"],
      fix: S.map((sz, j) => fx("dowel", levels.map((y) => pt(-UX, y, sz * (UZ - 20))), [0, 0, sz], { on: `U0${j}`, len: 30, dia: 8 })),
      tools: ["hammer"],
    },
    {
      title: "Screw the uprights onto the crossbars",
      detail: "Press them onto the ends of the left crossbars, one screw at an angle through each upright.",
            // up at an angle from the upright's inside face into the underside of the crossbar's end
      fix: S.map((sz) => fx("screw", [pt(-UX, levels[0] - 30, sz * (UZ - 15))], [0, Math.SQRT1_2, -sz * Math.SQRT1_2], { len: 50, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Stand it on the left end and push in the middle tubes",
      detail: "Three tubes into each level's crossbar, between the first two.",
      add: [...mids(0), ...mids(1)],
      pose: "+x",
    },
    {
      title: "Dowel the first right-hand upright on",
      detail: "Two dowels in its inside face, then press it onto the ends of the right crossbars.",
      add: ["U10"],
      fix: [fx("dowel", levels.map((y) => pt(UX, y, -(UZ - 20))), [0, 0, -1], { on: "U10", len: 30, dia: 8 })],
      tools: ["hammer"],
    },
    {
      title: "Dowel the second right-hand upright on",
      detail: "The same way, at the other edge.",
      add: ["U11"],
      fix: [fx("dowel", levels.map((y) => pt(UX, y, UZ - 20)), [0, 0, 1], { on: "U11", len: 30, dia: 8 })],
      tools: ["hammer"],
    },
    {
      title: "Screw the right uprights to the crossbars",
      detail: "One long screw through each upright into the end of the lower crossbar.",
      fix: S.map((sz) => fx("screw", [pt(UX, levels[0] - 10, sz * (UZ + 20))], [0, 0, -sz], { len: 60, dia: 4 })),
      tools: ["screwdriver"],
    },
    { title: "Stand the rack on its feet", detail: "Turn it the right way up.", pose: "+y" },
    {
      title: "Screw the upper crossbars to the uprights",
      detail: "Four long screws, one through each upright into the end of the upper crossbar.",
      fix: S.flatMap((sx) => S.map((sz) => fx("screw", [pt(sx * UX, levels[1] - 10, sz * (UZ + 20))], [0, 0, -sz], { len: 60, dia: 4 }))),
      tools: ["screwdriver"],
    },
    {
      title: "Keep the plate for stacking",
      detail: "The flat plate and two small screws join two racks when you stand one on another: across the back, one screw into an upright of each rack.",
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["TJUSIG"],
  recipe(s) {
    switch (s.slug) {
      case "tjusig-hat-rack-79":
        return hatRack();
      case "tjusig-bench-shoe-storage-108-x-34-x-50":
        return bench();
      case "tjusig-shoe-rack-79-x-32-x-37":
        return shoeRack();
    }
    return null;
  },
};
export default family;
