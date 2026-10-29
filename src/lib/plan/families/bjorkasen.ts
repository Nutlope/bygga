import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, Vec3 } from "../../types";

/**
 * BJÖRKÅSEN, read from the laptop stand's manual. The bent base tube lies on its front while the two telescopic
 * uprights are pushed into its stubs and bolted, one Allen bolt each. Stood up, the top's two hinge brackets are
 * pushed down over the uprights and screwed on, and the cup holder clips onto an upright. The top tilts and the
 * uprights slide in steps with the push buttons on each side.
 */

const TUBE = 25;
const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

function stand(): CustomParams {
  // IKEA: 46 wide, 35 deep, 60 to 70 high (65 in the middle)
  const W = 460, D = 350, H = 650;
  const xu = W / 2 - 25, zu = -D / 2 + 60; // the uprights
  const stub = 120, yBr = H - 60;
  const bc: Vec3 = [0, stub / 2, (zu + D / 2) / 2];
  const rel = (p: Vec3): Vec3 => [p[0] - bc[0], p[1] - bc[1], p[2] - bc[2]];
  const basePieces: PartPiece[] = [
    { shape: "cyl", size: [TUBE, 2 * xu, TUBE], pos: rel([0, TUBE / 2, zu]), rot: [0, 0, Math.PI / 2] },
    ...[-1, 1].flatMap((sx): PartPiece[] => [
      { shape: "cyl", size: [TUBE, D / 2 - zu, TUBE], pos: rel([sx * xu, TUBE / 2, (zu + D / 2) / 2]), rot: [Math.PI / 2, 0, 0] },
      { shape: "cyl", size: [TUBE + 4, stub, TUBE + 4], pos: rel([sx * xu, stub / 2, zu]) },
    ]),
  ];
  const tc: Vec3 = [0, (yBr - 30 + H) / 2, 0];
  const topPieces: PartPiece[] = [
    { shape: "box", size: [W, 25, D - 50], pos: [0, H - 12.5 - tc[1], 25] },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [34, 70, 40], pos: [sx * xu, yBr - tc[1], zu], material: "metal" })),
  ];
  const parts: CustomPart[] = [
    { id: "B", name: "Base tube", size: [2 * xu + TUBE + 4, stub, D / 2 - zu + TUBE], pos: bc, pieces: basePieces, material: "metal" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `U${i + 1}`, name: "Upright", shape: "cyl", size: [TUBE - 4, yBr - stub + 30, TUBE - 4], pos: [sx * xu, (stub - 30 + yBr) / 2 + 15, zu], material: "metal" })),
    { id: "T", name: "Top", size: [W, H - yBr + 35, D], pos: tc, pieces: topPieces, material: "board" },
    { id: "C", name: "Cup holder", shape: "cyl", size: [80, 60, 80], pos: [xu + 55, yBr - 70, zu], material: "board" },
  ];
  return {
    parts,
    steps: [
      {
        title: "Bolt the uprights into the base tube",
        detail: "Lay the base on its front on a rug. Push each upright into a stub with its holes lined up, then one bolt through the stub with the Allen key.",
        add: ["B", "U1", "U2"],
        fix: [-1, 1].map((sx, i) => at("bolt", [[sx * (xu + TUBE / 2 + 2), stub - 10, zu]], [-sx, 0, 0], "B", `U${i + 1}`, { len: 45, dia: 6 })),
        tools: ["allen"],
        pose: "-z",
        warnings: ["floor"],
      },
      {
        title: "Push the top onto the uprights",
        detail: "Stand the base on the floor, runners pointing forward, and press both hinge brackets down over the tops of the uprights.",
        add: ["T"],
        from: { T: [0, 250, 0] },
        pose: "+y",
      },
      {
        title: "Screw the brackets on",
        detail: "One small screw through each bracket into its upright.",
        fix: [-1, 1].map((sx, i) => at("screw", [[sx * (xu + 17), yBr - 20, zu]], [-sx, 0, 0], "T", `U${i + 1}`, { len: 10, dia: 5 })),
        tools: ["screwdriver"],
      },
      {
        title: "Clip on the cup holder",
        detail: "Press it onto either upright until it clicks. To tilt the top or change the height, press in the buttons on both sides at once.",
        add: ["C"],
        from: { C: [150, 0, 0] },
      },
    ],
  };
}

const family: Family = {
  names: ["BJÖRKÅSEN", "BJORKASEN"],
  recipe(s) {
    if (/laptop stand/i.test(s.variant) || /bjorkasen-laptop-stand/.test(s.slug ?? "")) return stand();
    return null;
  },
};
export default family;
