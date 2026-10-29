import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BAGGBODA, read from the side table's manual. A steel tube loop stands at the front and one at the back; four
 * straight rails run between them, two under the top and two under the shelf, each held at both ends by a long
 * connector bolt through the loop. Upside down, the top is bolted on through the upper rails (with washers); on its
 * side, the shelf slides in and is bolted through the lower rails.
 */

const TUBE = 25;
const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

function table(s: ProductSpec): CustomParams {
  // IKEA: 71 long, 50 wide, 47 high
  const W = Math.round(s.size.w * 10) || 710, D = Math.round(s.size.d * 10) || 500, H = Math.round(s.size.h * 10) || 470;
  const T = 18, ST = 16, r = TUBE / 2;
  const yTop = H - T - r; // loops' top tube and the upper rails
  const yLow = 180; // lower rails, under the shelf
  const xv = W / 2 - r, xu = W / 2 - 50;
  const zl = D / 2 - r, railL = D - 2 * TUBE;
  const loop = (id: string, sz: number): CustomPart => {
    const c: Vec3 = [0, (H - T) / 2, sz * zl];
    const p = (shape: "cyl", size: Vec3, pos: Vec3, rot?: Vec3): PartPiece => ({ shape, size, pos: [pos[0], pos[1] - c[1], 0], rot });
    return {
      id,
      name: "Tube frame",
      size: [W, H - T, TUBE],
      pos: c,
      material: "metal",
      pieces: [
        ...[-1, 1].map((sx) => p("cyl", [TUBE, H - T - 2 * TUBE, TUBE], [sx * xv, (H - T) / 2, 0])),
        p("cyl", [TUBE, W - 2 * TUBE, TUBE], [0, yTop, 0], [0, 0, Math.PI / 2]),
        p("cyl", [TUBE, W - 2 * TUBE, TUBE], [0, r, 0], [0, 0, Math.PI / 2]),
      ],
    };
  };
  const rail = (id: string, x: number, y: number): CustomPart => ({ id, name: "Rail", shape: "cyl", size: [TUBE, TUBE, railL], pos: [x, y, 0], material: "metal" });
  const parts: CustomPart[] = [
    loop("F", 1),
    rail("U1", -xu, yTop),
    rail("B1", -xv, yLow),
    rail("U2", xu, yTop),
    rail("B2", xv, yLow),
    loop("K", -1),
    { id: "T", name: "Table top", size: [W - 20, T, D], pos: [0, H - T / 2, 0], material: "board" },
    { id: "S", name: "Shelf", size: [2 * xv, ST, D - 2 * TUBE], pos: [0, yLow + r + ST / 2, 0], material: "board" },
  ];
  const ends = (ids: [string, number, number][], sz: number) =>
    ids.map(([id, x, y]) => at("bolt", [[x, y, sz * (zl + r)]], [0, 0, -sz], sz > 0 ? "F" : "K", id, { name: "Connector bolt", len: 45, dia: 6 }));
  const left: [string, number, number][] = [["U1", -xu, yTop], ["B1", -xv, yLow]];
  const right: [string, number, number][] = [["U2", xu, yTop], ["B2", xv, yLow]];
  const zq = railL / 2 - 60;
  const under = (x: number, y: number): Vec3[] => [[x, y, -zq], [x, y, zq]];
  return {
    parts,
    steps: [
      {
        title: "Bolt two rails to a tube frame",
        detail: "Stand the frame on a rug and push the rails into its holes on one side. Use the long connector bolts, not the short ones.",
        add: ["F", "U1", "B1"],
        fix: ends(left, 1),
        tools: ["allen"],
        warnings: ["floor"],
      },
      {
        title: "Bolt the other two rails on",
        detail: "Same on the other side of the frame, with the holes in the rails facing the same way as the first two.",
        add: ["U2", "B2"],
        fix: ends(right, 1),
        tools: ["allen"],
      },
      {
        title: "Fit the second tube frame",
        detail: "Push it onto the free ends of the four rails and bolt each one on.",
        add: ["K"],
        fix: ends([...left, ...right], -1),
        tools: ["allen"],
      },
      {
        title: "Bolt the top on through the upper rails",
        detail: "Lay the top face down on the rug and set the frame on it upside down. A washer goes under each short bolt.",
        add: ["T"],
        fix: [
          // bolts listed first: a washer may share its bolt's point, not the other way round
          at("bolt", [...under(-xu, yTop - r), ...under(xu, yTop - r)], [0, 1, 0], "U1", "T", { len: 20, dia: 6 }),
          at("washer", [...under(-xu, yTop - r), ...under(xu, yTop - r)], [0, 1, 0], "U1", undefined, { len: 1.5, dia: 16 }),
        ],
        tools: ["allen"],
        pose: "-y",
      },
      {
        title: "Slide the shelf in and bolt it on",
        detail: "Lay the table on its side. Slide the shelf in onto the lower rails and bolt it on from underneath.",
        add: ["S"],
        fix: [at("bolt", [...under(-xv, yLow - r), ...under(xv, yLow - r)], [0, 1, 0], "B1", "S", { len: 20, dia: 6 })],
        tools: ["allen"],
        pose: "+x",
        from: { S: [-500, 0, 0] },
      },
      { title: "Stand the table up", detail: "Turn it onto its feet and check it stands without rocking.", pose: "+y" },
    ],
  };
}

const family: Family = {
  names: ["BAGGBODA"],
  recipe(s) {
    if (/side table/i.test(s.variant) || /baggboda-side-table/.test(s.slug ?? "")) return table(s);
    return null;
  },
};
export default family;
