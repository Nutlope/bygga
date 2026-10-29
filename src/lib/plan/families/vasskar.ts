import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * VASSKÄR shoe rack, read from its manual: two slatted shelves bolted between two bamboo side frames, standing on
 * its legs (two bolts for each shelf end), then turned over for the four glides tapped into the legs. The dowels,
 * plates and screws in the bag are only for stacking a second rack on top.
 */

const fx = (kind: CustomFix["kind"], on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at, ...o });

function shoeRack(s: ProductSpec): CustomParams {
  // the page: 60 wide, 35 high, 30 deep, 12 cm free under the bottom shelf
  const W = s.size.w * 10, H = 350, D = 300;
  const L = 30, r = 30, rt = 20; // legs, shelf rails (height, thickness)
  const xl = W / 2 - L / 2, zl = D / 2 - L / 2;
  const ys = [120 + r / 2, H - 15 - r / 2]; // rail centres, bottom shelf first
  const inner = W - 2 * L;
  const slats = 11;
  const shelf: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [inner, r, rt], pos: [0, 0, sz * zl] })),
    ...Array.from({ length: slats }, (_, i): PartPiece => ({ shape: "box", size: [28, 12, 2 * zl - rt], pos: [-inner / 2 + 20 + ((inner - 40) * i) / (slats - 1), r / 2 - 6, 0] })),
  ];
  const side: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [L, H, L], pos: [0, 0, sz * zl] })),
    ...ys.map((y): PartPiece => ({ shape: "box", size: [rt, r, 2 * zl - L], pos: [0, y - H / 2, 0] })),
  ];
  const parts: CustomPart[] = [
    { id: "SL", name: "Side frame", size: [L, H, D], pos: [-xl, H / 2, 0], pieces: side, material: "wood" },
    { id: "SR", name: "Side frame", size: [L, H, D], pos: [xl, H / 2, 0], pieces: side, material: "wood" },
    // a shelf's box is as deep as its rails reach
    { id: "TS", name: "Slatted shelf", size: [inner, r, 2 * zl + rt], pos: [0, ys[1], 0], pieces: shelf, material: "wood" },
    { id: "BS", name: "Slatted shelf", size: [inner, r, 2 * zl + rt], pos: [0, ys[0], 0], pieces: shelf, material: "wood" },
  ];
  const bolts = (sx: number, y: number): Vec3[] => [-1, 1].map((sz) => [sx * (W / 2), y, sz * zl]);
  const bolt = { len: 60, dia: 6 };
  const steps: CustomStep[] = [
    {
      title: "Bolt the top shelf to a side frame",
      detail: "Stand the frame on its legs. Two bolts go through the legs into the ends of the shelf's rails, slats facing up.",
      add: ["SL", "TS"],
      fix: [fx("bolt", "SL", [1, 0, 0], bolts(-1, ys[1]), { mate: "TS", ...bolt })],
      tools: ["allen"],
    },
    {
      title: "Bolt on the bottom shelf",
      detail: "The same way, two bolts lower down. Don't tighten them fully yet.",
      add: ["BS"],
      fix: [fx("bolt", "SL", [1, 0, 0], bolts(-1, ys[0]), { mate: "BS", ...bolt })],
      tools: ["allen"],
    },
    {
      title: "Bolt on the other side frame",
      detail: "Four bolts through its legs into both shelves. Check it stands square, then tighten all eight.",
      add: ["SR"],
      fix: [fx("bolt", "SR", [-1, 0, 0], [...bolts(1, ys[1]), ...bolts(1, ys[0])], { mate: "TS", ...bolt })],
      tools: ["allen"],
      check: "square",
    },
    { title: "Turn it upside down", detail: "Onto a rug, so the leg ends face up.", pose: "-y", warnings: ["floor"] },
    {
      title: "Tap a glide into each leg",
      detail: "Into the hole in the end of each leg, with a few light taps of the hammer.",
      fix: [-1, 1].map((sx) => fx("glide", sx < 0 ? "SL" : "SR", [0, 1, 0], [-1, 1].map((sz) => [sx * xl, 0, sz * zl] as Vec3), { name: "Glide", len: 6, dia: 20 })),
      tools: ["hammer"],
    },
    {
      title: "Turn it the right way up",
      detail: "Done. The four dowels, two plates and four screws are only for stacking a second rack on top and fixing the pair to the wall.",
      pose: "+y",
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["VASSKÄR", "VASSKAR"],
  recipe(s) {
    if (/shoe rack/i.test(s.variant)) return shoeRack(s);
    return null;
  },
};
export default family;
