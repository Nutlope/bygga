import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, Vec3 } from "../../types";

/**
 * INNDYR, read from the storage bench's manual. The box is built standing: three battens with dowels in their ends
 * are screwed between the back and the front panel (long screws turned with the Allen key), dowels go into the panel
 * ends, then one end panel is screwed on, the bottom slides in over the battens and the other end goes on. Two air
 * vents press into the bottom; upside down, four legs screw in by hand. A lid hinge goes inside each end at the back,
 * two people pull the fabric cover over the box and fasten its edges under the bottom and inside the top, then the
 * padded lid is screwed to the hinges and the two lid stays click on.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

function bench(): CustomParams {
  // IKEA: 122 wide, 51 deep, 47 high (seat height)
  const W = 1220, D = 510, H = 470;
  const C = 5; // the fabric cover over the box
  const Wb = W - 20, Db = D - 20; // the box inside its cover, under a lid that overhangs a little
  const T = 15, yLeg = 60, hLid = 90;
  const yBox1 = H - hLid, hBox = yBox1 - yLeg;
  const yMid = yLeg + hBox / 2;
  const xEnd = Wb / 2 - T / 2, zLong = Db / 2 - T / 2;
  const xIn = Wb / 2 - T, zIn = Db / 2 - T;
  const hBat = 22, yBat = yLeg + hBat / 2;
  const batX = [-(xIn - 35), 0, xIn - 35];

  const parts: CustomPart[] = [
    ...batX.map((x, i): CustomPart => ({ id: `T${i + 1}`, name: "Batten", size: [70, hBat, 2 * zIn], pos: [x, yBat, 0] })),
    { id: "B", name: "Long panel", size: [2 * xIn, hBox, T], pos: [0, yMid, -zLong] },
    { id: "F", name: "Long panel", size: [2 * xIn, hBox, T], pos: [0, yMid, zLong] },
    { id: "E1", name: "End panel", size: [T, hBox, Db], pos: [-xEnd, yMid, 0] },
    { id: "P", name: "Bottom", size: [2 * xIn, 3, 2 * zIn], pos: [0, yLeg + hBat + 1.5, 0], material: "fiber" },
    { id: "E2", name: "End panel", size: [T, hBox, Db], pos: [xEnd, yMid, 0] },
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz, j): CustomPart => ({ id: `L${sx < 0 ? 1 + j : 3 + j}`, name: "Leg", size: [50, yLeg, 50], pos: [sx * (xIn - 35), yLeg / 2, sz * (zIn - 45)], material: "wood" }))),
  ];

  // the cover: four walls of fabric round the box, with a flap under the bottom edge
  const cw = Wb + 2 * C, cd = Db + 2 * C;
  const wall = (size: Vec3, p: Vec3): PartPiece => ({ shape: "box", size, pos: p });
  parts.push({
    id: "CV",
    name: "Cover",
    size: [cw, hBox + 4, cd],
    pos: [0, yMid - 2, 0],
    material: "soft",
    pieces: [
      ...[-1, 1].map((sz) => wall([cw, hBox + 4, C], [0, 0, sz * (cd / 2 - C / 2)])),
      ...[-1, 1].map((sx) => wall([C, hBox + 4, cd - 2 * C], [sx * (cw / 2 - C / 2), 0, 0])),
    ],
  });
  parts.push({ id: "LID", name: "Padded lid", size: [W, hLid, D], pos: [0, yBox1 + hLid / 2, 0], material: "soft" });

  // the dowel sits beside the long screw in each batten end
  const batEnds = (x: number): Vec3[] => [-1, 1].map((sz) => [x + 20, yBat, sz * zIn] as Vec3);
  const panelEnds = (z: number, sx: number): Vec3[] => [yLeg + 60, yBox1 - 60].map((y) => [sx * xIn, y, z] as Vec3);
  const endScrews = (sx: number): Vec3[] => [-1, 1].flatMap((sz) => [yLeg + 100, yBox1 - 100].map((y) => [sx * Wb / 2, y, sz * zLong] as Vec3));
  const SCREW = { len: 50, dia: 6, name: "Long screw" };
  const hingeAt = (sx: number): Vec3 => [sx * xIn, yBox1 - 40, -zIn + 60];

  return {
    parts,
    steps: [
      {
        title: "Tap the dowels into the battens",
        detail: "One in each end of all three battens.",
        fix: batX.flatMap((x, i) => batEnds(x).map((p) => at("dowel", [p], [0, 0, -Math.sign(p[2])], `T${i + 1}`, p[2] < 0 ? "B" : "F"))),
        tools: ["hammer"],
        wait: ["T1", "T2", "T3"],
        from: { T1: [0, 0, 300], T2: [0, 0, 300], T3: [0, 0, 300] },
      },
      {
        title: "Screw the battens to the back panel",
        detail: "Stand the back panel on its long edge, holes at the bottom. One long screw through it into each batten.",
        add: ["B", "T1", "T2", "T3"],
        fix: [at("bolt", batX.map((x) => [x - 15, yBat, -Db / 2] as Vec3), [0, 0, 1], "B", undefined, SCREW)],
        tools: ["allen"],
        warnings: ["floor"],
        from: { B: [0, 0, -300] },
      },
      {
        title: "Screw on the front panel",
        detail: "Push it onto the dowels at the other ends of the battens, then three more long screws.",
        add: ["F"],
        fix: [at("bolt", batX.map((x) => [x - 15, yBat, Db / 2] as Vec3), [0, 0, -1], "F", undefined, SCREW)],
        tools: ["allen"],
      },
      {
        title: "Tap the dowels into the panel ends",
        detail: "Two in each end of both long panels.",
        fix: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => at("dowel", panelEnds(sz * zLong, sx), [-sx, 0, 0], sz < 0 ? "B" : "F", sx < 0 ? "E1" : "E2"))),
        tools: ["hammer"],
      },
      {
        title: "Screw on one end panel",
        detail: "Press it onto the dowels, then four long screws into the ends of the long panels.",
        add: ["E1"],
        fix: [at("bolt", endScrews(-1), [1, 0, 0], "E1", undefined, SCREW)],
        tools: ["allen"],
      },
      { title: "Slide the bottom in", detail: "From the open end, holes the way the drawing shows, until it rests on all three battens.", add: ["P"], from: { P: [900, 0, 0] } },
      {
        title: "Screw on the other end panel",
        detail: "Same as the first: onto the dowels, four long screws.",
        add: ["E2"],
        fix: [at("bolt", endScrews(1), [-1, 0, 0], "E2", undefined, SCREW)],
        tools: ["allen"],
      },
      {
        title: "Press the air vents into the bottom",
        detail: "One in each round hole.",
        fix: [at("cap", [-1, 1].map((sx) => [sx * 300, yLeg + hBat + 3, 0] as Vec3), [0, -1, 0], "P", undefined, { name: "Air vent", dia: 50 })],
      },
      {
        title: "Turn it over and screw in the legs",
        detail: "Turn each leg clockwise by hand until it is tight against the bottom. Then turn the box back up.",
        add: ["L1", "L2", "L3", "L4"],
        pose: "-y",
        warnings: ["floor"],
      },
      {
        title: "Screw a lid hinge inside each end",
        detail: "At the back, tight under the top edge. Two screws each with the small Allen key.",
        fix: [-1, 1].flatMap((sx) => [
          at("plate", [hingeAt(sx)], [-sx, 0, 0], sx < 0 ? "E1" : "E2", undefined, { name: "Lid hinge", len: 6, dia: 40 }),
          at("bolt", [-15, 15].map((dz) => [sx * xIn, hingeAt(sx)[1] - 25, hingeAt(sx)[2] + dz] as Vec3), [sx, 0, 0], sx < 0 ? "E1" : "E2", undefined, { len: 12, dia: 6, name: "Screw" }),
        ]),
        tools: ["allen"],
        pose: "+y",
      },
      {
        title: "Pull the cover over the box",
        detail: "Two people, one at each end. Ease it down evenly so the seams sit on the corners.",
        add: ["CV"],
        people: 2,
        warnings: ["two"],
        from: { CV: [0, 500, 0] },
      },
      { title: "Fasten the cover under the bottom", detail: "Turn the box upside down and press the cover's edge into place all the way round.", pose: "-y" },
      { title: "Tuck the top edge in", detail: "Stand it up, fold the top edge of the cover over the rim and press it in all the way round.", pose: "+y" },
      {
        title: "Screw the lid to the hinges",
        detail: "Rest the lid open on the back edge and fix each hinge's top plate with two screws.",
        add: ["LID"],
        fix: [-1, 1].map((sx) => at("bolt", [-25, 25].map((dz) => [sx * (xIn - 30), yBox1, hingeAt(sx)[2] + dz] as Vec3), [0, 1, 0], "LID", undefined, { len: 12, dia: 6, name: "Screw" })),
        tools: ["allen"],
        from: { LID: [0, 400, -200] },
      },
      {
        title: "Click the lid stays on",
        detail: "One at each end, from the ball on the hinge to the ball on the end panel. Press each end on until it clicks.",
        fix: [-1, 1].map((sx) => at("gasLift", [[sx * (xIn - 20), yBox1 - 150, -zIn + 150]], [0, 1, 0], sx < 0 ? "E1" : "E2", undefined, { name: "Lid stay", len: 200, dia: 18 })),
      },
    ],
  };
}

const family: Family = {
  names: ["INNDYR"],
  recipe(s) {
    if (/bench/i.test(s.variant) || /inndyr-storage-bench/.test(s.slug ?? "")) return bench();
    return null;
  },
};
export default family;
