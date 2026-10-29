import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * KNARREVIK, read from the bedside table's manual. No welds: four steel angle legs are bolted to the folded edges of
 * the top and the shelf, one bolt through each flange at each panel, sixteen in all. With the panels on their edges
 * the first two legs go on with two bolts each, then the table is turned and the rest go in four at a time, loosely.
 * Standing, every bolt is tightened once the legs are straight.
 */

const BOLT = { kind: "bolt" as const, len: 10, dia: 6 };

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 37 wide, 28 deep, 45 high
  const W = s.size.w * 10 || 370, H = s.size.h * 10 || 450, D = s.size.d * 10 || 280;
  const a = 25, t = 2; // angle legs, 25 mm flanges
  const yTop = H - 15, yShelf = 205, edge = 25;
  const legs: { id: string; sx: number; sz: number }[] = [
    { id: "L1", sx: -1, sz: 1 },
    { id: "L2", sx: 1, sz: 1 },
    { id: "L3", sx: -1, sz: -1 },
    { id: "L4", sx: 1, sz: -1 },
  ];
  const parts: CustomPart[] = [
    { id: "T", name: "Top", size: [W - 2 * t, edge, D - 2 * t], pos: [0, yTop, 0], material: "metal" },
    { id: "S", name: "Shelf", size: [W - 2 * t, edge, D - 2 * t], pos: [0, yShelf, 0], material: "metal" },
    ...legs.map(({ id, sx, sz }): CustomPart => ({
      id,
      name: "Leg",
      size: [a, H, a],
      pos: [sx * (W / 2 - a / 2), H / 2, sz * (D / 2 - a / 2)],
      material: "metal",
      pieces: [
        { shape: "box", size: [a, H, t], pos: [0, 0, sz * (a / 2 - t / 2)] },
        { shape: "box", size: [t, H, a], pos: [sx * (a / 2 - t / 2), 0, 0] },
      ],
    })),
  ];
  // one bolt through each flange into the top and the shelf: "z" is the flange facing front or back, "x" the side one
  const flange = (i: number, f: "x" | "z"): CustomFix => {
    const { id, sx, sz } = legs[i];
    // the two bolts at one corner sit a little apart in height, so neither gets pushed off the panel's edge
    const at: Vec3[] = [yTop, yShelf].map((y0) => y0 + (f === "z" ? 6 : -6)).map((y) => (f === "z" ? [sx * (W / 2 - a / 2 - 2), y, sz * (D / 2)] : [sx * (W / 2), y, sz * (D / 2 - a / 2 - 2)]));
    return { ...BOLT, count: 2, at, dir: f === "z" ? [0, 0, -sz] : [-sx, 0, 0], on: id };
  };
  const steps: CustomStep[] = [
    {
      title: "Bolt the first leg to the top and the shelf",
      detail: "Hold both panels on their edges, folded edges in, and put one bolt through the leg into each. Leave them loose.",
      add: ["T", "S", "L1"],
      fix: [flange(0, "z")],
      pose: "-x",
    },
    { title: "Turn it and bolt on the second leg", detail: "Same as the first, at the other end. Still loose.", add: ["L2"], fix: [flange(1, "z")] },
    {
      title: "Bolt on the two back legs",
      detail: "Turn the table upside down. Two bolts in each, loose.",
      add: ["L3", "L4"],
      fix: [flange(2, "z"), flange(3, "z")],
      pose: "-y",
    },
    { title: "Fit the bolts on one side", detail: "Turn it onto its side and put a bolt through each side flange.", fix: [flange(0, "x"), flange(2, "x")], pose: "+x" },
    { title: "Fit the bolts on the other side", detail: "Turn it over. That's all sixteen.", fix: [flange(1, "x"), flange(3, "x")], pose: "-x" },
    {
      title: "Stand it up and tighten every bolt",
      detail: "Check the legs stand straight and the table doesn't rock, then tighten all sixteen.",
      tools: ["allen"],
      pose: "+y",
      check: "square",
    },
  ];
  return { parts, steps };
}

const family: Family = { names: ["KNARREVIK"], recipe };
export default family;
