import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FJÄLKINGE, read from the shelving unit's manual. The steel frame is built lying on its back on a rug: the welded
 * bottom frame is bolted to the two back uprights, then the front uprights, then the top frame goes on (two bolts in
 * every joint, sixteen in all). Four adjustable feet screw into the bottom frame and the unit is stood up by two
 * people. Pads go on the bottom frame's corners for the bottom shelf, which slides in, and on the top frame's for the
 * top shelf, which is laid in. Two wall brackets screw onto the top frame, the feet level it, the brackets are fixed
 * to the wall, and sixteen clips hold the four loose shelves.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const S = [-1, 1] as const;

const TUBE = 25; // square steel tube
const FH = 30; // the end frames' tubes are this tall
const FOOT = 15; // the feet lift it this much
const SH = 18; // shelves

const BOLT = { len: 60, dia: 6 };
const CLIP = { len: 20, dia: 6, name: "Shelf clip" };
const PAD = { len: 2, dia: 14, name: "Pad" };
const FOOT_HW = { len: 25, dia: 28, name: "Adjustable foot" };
const BRACKET = { len: 60, dia: 40 };
const BRACKET_SCREW = { len: 10, dia: 4 };

/** A welded rectangle of tube that fits between the four uprights of a W x D unit, as pieces about its middle. */
function rect(W: number, D: number): PartPiece[] {
  return [
    ...S.map((sz): PartPiece => ({ shape: "box", size: [W - 2 * TUBE, FH, TUBE], pos: [0, 0, sz * (D / 2 - TUBE / 2)] })),
    ...S.map((sx): PartPiece => ({ shape: "box", size: [TUBE, FH, D - 2 * TUBE], pos: [sx * (W / 2 - TUBE / 2), 0, 0] })),
  ];
}

function unit(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const yB = FOOT + FH / 2, yT = H - FH / 2; // the frames' middles
  const uy0 = FOOT, uy1 = H; // the uprights run the full height, the frames between them
  const ux = W / 2 - TUBE / 2, uz = D / 2 - TUBE / 2;
  const parts: CustomPart[] = [
    { id: "B", name: "Bottom frame", size: [W, FH, D], pos: [0, yB, 0], material: "metal", pieces: rect(W, D) },
    { id: "T", name: "Top frame", size: [W, FH, D], pos: [0, yT, 0], material: "metal", pieces: rect(W, D) },
    { id: "U1", name: "Upright", size: [TUBE, uy1 - uy0, TUBE], pos: [-ux, (uy0 + uy1) / 2, -uz], material: "metal" },
    { id: "U2", name: "Upright", size: [TUBE, uy1 - uy0, TUBE], pos: [ux, (uy0 + uy1) / 2, -uz], material: "metal" },
    { id: "U3", name: "Upright", size: [TUBE, uy1 - uy0, TUBE], pos: [-ux, (uy0 + uy1) / 2, uz], material: "metal" },
    { id: "U4", name: "Upright", size: [TUBE, uy1 - uy0, TUBE], pos: [ux, (uy0 + uy1) / 2, uz], material: "metal" },
  ];
  const sw = W - 2 * TUBE - 4, sd = D - 2 * TUBE - 4;
  // the bottom and top shelves rest on the frames' inner ledges, the loose ones on clips
  const shelf = (id: string, y: number): CustomPart => ({ id, name: "Shelf", size: [sw, SH, sd], pos: [0, y, 0] });
  const free = [1, 2, 3, 4].map((k) => Math.round(FOOT + FH + ((H - 2 * FH - FOOT) * k) / 5));
  parts.push(shelf("S0", FOOT + FH + SH / 2 - 8), shelf("S5", H - SH / 2), ...free.map((y, k) => shelf(`S${k + 1}`, y + SH / 2)));
  const ups = ["U1", "U2", "U3", "U4"];
  const xyz = (u: string) => parts.find((p) => p.id === u)!.pos;
  // two bolts in each corner, from outside through the upright into the frame: one along the side, one along the end
  const bolts = (u: string, frame: "B" | "T") => {
    const [x, , z] = xyz(u);
    const y = frame === "B" ? yB : yT;
    const sx = Math.sign(x), sz = Math.sign(z);
    return [
      fx("bolt", [[sx * (W / 2), y - 7, z]], [-sx, 0, 0], { ...BOLT, on: u, mate: frame }),
      fx("bolt", [[x, y + 7, sz * (D / 2)]], [0, 0, -sz], { ...BOLT, on: u, mate: frame }),
    ];
  };
  const clips = ups.map((u) => {
    const [x, , z] = xyz(u);
    return fx("pin", free.map((y): Vec3 => [x - Math.sign(x) * (TUBE / 2), y, z]), [Math.sign(x), 0, 0], { ...CLIP, on: u });
  });
  const pads = (frame: "B" | "T") => {
    const y = frame === "B" ? FOOT + FH : H - SH;
    return fx("glide", S.flatMap((sx) => S.map((sz): Vec3 => [sx * (W / 2 - TUBE - 20), y, sz * (D / 2 - TUBE - 20)])), [0, -1, 0], { ...PAD, on: frame });
  };
  const feet = ups.map((u) => {
    const [x, , z] = xyz(u);
    return fx("foot", [[x, FOOT, z]], [0, 1, 0], { ...FOOT_HW, on: u });
  });
  const wallX = [-(W / 2 - 120), W / 2 - 120];
  const brackets = fx("bracket", wallX.map((x): Vec3 => [x, H - FH, -D / 2 + TUBE / 2]), [0, 1, 0], { ...BRACKET, on: "T" });
  const bracketScrews = fx("screw", wallX.map((x): Vec3 => [x, H - FH - 2, -D / 2 + TUBE / 2]), [0, 1, 0], { ...BRACKET_SCREW, on: "T" });
  const wy = H - FH - 40;
  return {
    parts,
    steps: [
      {
        title: "Bolt the bottom frame onto a back upright",
        detail: "Lay the upright on a rug, its row of holes facing in, and stand the frame on its end. Two bolts, with the Allen key.",
        add: ["U1", "B"],
        fix: bolts("U1", "B"),
        tools: ["allen"],
        pose: "+z",
        warnings: ["floor"],
      },
      {
        title: "Bolt on the other back upright",
        detail: "One holds the frame while the other fits the upright. Two bolts.",
        add: ["U2"],
        fix: bolts("U2", "B"),
        tools: ["allen"],
        people: 2,
      },
      {
        title: "Bolt on the front uprights",
        detail: "Two bolts in each. Keep the rows of holes facing in.",
        add: ["U3", "U4"],
        fix: [...bolts("U3", "B"), ...bolts("U4", "B")],
        tools: ["allen"],
      },
      {
        title: "Bolt the top frame on",
        detail: "Onto the free ends of all four uprights, two bolts in each corner. Then tighten every bolt.",
        add: ["T"],
        fix: ups.flatMap((u) => bolts(u, "T")),
        tools: ["allen"],
      },
      { title: "Screw the feet into the uprights", detail: "One into the bottom of each, turned in by hand.", fix: feet },
      { title: "Stand it up", detail: "Together, lifting it by the frame.", pose: "+y", people: 2, warnings: ["two"] },
      { title: "Stick the pads onto the bottom frame", detail: "One on the inner ledge at each corner.", fix: [pads("B")] },
      { title: "Slide in the bottom shelf", detail: "Tilt it in between the uprights and lay it on the pads.", add: ["S0"], from: { S0: [0, 0, 400] } },
      { title: "Stick the pads onto the top frame", detail: "One at each corner.", fix: [pads("T")] },
      { title: "Lay the top shelf in", detail: "From above, onto the pads.", add: ["S5"] },
      { title: "Screw the wall brackets onto the top frame", detail: "One near each back corner, one screw each. Leave them loose for now.", fix: [brackets, bracketScrews], tools: ["screwdriver"] },
      { title: "Level it with the feet", detail: "Against the wall where it will stand, turn the feet until the top is level.", tools: ["level"], warnings: ["tip"] },
      {
        title: "Fix it to the wall",
        detail: "Mark through the brackets, drill, plug and screw them to the wall, then tighten the bracket screws. Screws and plugs aren't included: use ones made for your wall.",
        fix: [fx("plug", wallX.map((x): Vec3 => [x, wy, -D / 2 - 1]), [0, 0, -1]), fx("screw", wallX.map((x): Vec3 => [x, wy, -D / 2 + 4]), [0, 0, -1], { len: 50, dia: 5 })],
        tools: ["drill", "screwdriver", "pencil"],
        warnings: ["wall", "tip"],
        wall: true,
      },
      { title: "Clip in the shelf clips", detail: "Four at each shelf height, hooked into the uprights' holes and pushed down.", fix: clips },
      { title: "Lay the shelves on the clips", detail: "Tilt each one in and lower it onto its four clips. The joining clip in the box links two units side by side.", add: ["S1", "S2", "S3", "S4"] },
    ],
  };
}

const family: Family = {
  names: ["FJÄLKINGE", "FJALKINGE"],
  recipe(s) {
    if (/^fjalkinge-shelving-unit/.test(s.slug ?? "")) return unit(s);
    return null;
  },
};
export default family;
