import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * HÅKANSKÄR coffee table, read from its manual. A steel frame of two open end frames and three rails, then two slatted
 * acacia panels: 18 small bolts in all, tightened with the Allen key in the box. The manual builds it stood on its
 * long front edge (it is reversible: tall or low): the three rails slide onto one end frame, one bolt each, the other
 * end frame goes on with three more, the front panel drops onto the rail tabs with six bolts, then the frame is turned
 * so the top panel goes in the same way. The low table's bottom and back are open.
 * IKEA's sizes: 80 long, 64 wide, 43 high.
 */

const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const box = (size: Vec3, pos: Vec3, c: Vec3 = [0, 0, 0]): PartPiece => ({ shape: "box", size, pos: [pos[0] - c[0], pos[1] - c[1], pos[2] - c[2]] });

function recipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 800, H = Math.round(s.size.h * 10) || 430, D = Math.round(s.size.d * 10) || 640;
  const t = 25; // square steel tube
  const xe = W / 2 - t / 2, ye = H - t / 2, ze = D / 2 - t / 2;
  const L = W - 2 * t;
  const parts: CustomPart[] = [];
  for (const [i, sx] of [[0, -1], [1, 1]] as const)
    parts.push({
      id: `E${i}`,
      name: "End frame",
      size: [t, H, D],
      pos: [sx * xe, H / 2, 0],
      material: "metal",
      pieces: [
        box([t, t, D], [0, t / 2 - H / 2, 0]),
        box([t, t, D], [0, H / 2 - t / 2, 0]),
        box([t, H - 2 * t, t], [0, 0, -ze]),
        box([t, H - 2 * t, t], [0, 0, ze]),
      ],
    });
  const xs = [-L / 2 + 120, 0, L / 2 - 120];
  // rails with the tabs the panels are bolted to
  const rail = (id: string, y: number, z: number, tabs: [Vec3, Vec3][]): CustomPart => {
    const c: Vec3 = [0, y, z];
    return { id, name: "Rail", size: [L, t, t], pos: c, material: "metal", pieces: [box([L, t, t], c, c), ...tabs.map(([sz, p]) => box(sz, p, c))] };
  };
  const zIn = ze - t / 2, yIn = ye - t / 2; // the rails' inner faces
  parts.push(
    rail("R1", t / 2, ze, xs.map((x): [Vec3, Vec3] => [[40, 30, 3], [x, t + 10, zIn - 22]])),
    rail("R2", ye, ze, [...xs.map((x): [Vec3, Vec3] => [[40, 50, 3], [x, yIn - 25, zIn - 22]]), ...xs.map((x): [Vec3, Vec3] => [[40, 3, 30], [x, yIn - 22, zIn - 15]])]),
    rail("R3", ye, -ze, xs.map((x): [Vec3, Vec3] => [[40, 3, 30], [x, yIn - 22, -zIn + 15]])),
  );
  // slatted panels: seven slats down the front, eight across the top
  const pt = 20;
  const fy0 = t + 2, fy1 = H - t - pt - 4;
  const fz = zIn - 2 - pt / 2;
  const fh = (fy1 - fy0) / 7;
  const fc: Vec3 = [0, (fy0 + fy1) / 2, fz];
  parts.push({
    id: "P1",
    name: "Front panel",
    size: [L - 10, fy1 - fy0, pt],
    pos: fc,
    material: "wood",
    pieces: Array.from({ length: 7 }, (_, k) => box([L - 10, fh - 6, pt], [0, fy0 + fh * (k + 0.5), fz], fc)),
  });
  const ty = yIn - 2 - pt / 2;
  const tz0 = -zIn + 2, tz1 = fz + pt / 2;
  const tw = (tz1 - tz0) / 8;
  const tc: Vec3 = [0, ty, (tz0 + tz1) / 2];
  parts.push({
    id: "P2",
    name: "Top panel",
    size: [L - 10, pt, tz1 - tz0],
    pos: tc,
    material: "wood",
    pieces: Array.from({ length: 8 }, (_, k) => box([L - 10, pt, tw - 6], [0, ty, tz0 + tw * (k + 0.5)], tc)),
  });

  const bolt = { len: 12, dia: 6 };
  const jointBolt = (rid: string, sx: number, y: number, z: number, dz: number) => fix("bolt", [[sx * (L / 2 - 15), y, z]], [0, 0, dz], { ...bolt, on: rid, mate: sx < 0 ? "E0" : "E1" });
  const ends = (sx: number) => [jointBolt("R1", sx, t / 2, zIn, 1), jointBolt("R2", sx, ye, zIn, 1), jointBolt("R3", sx, ye, -zIn, -1)];
  const [r1a, r2a, r3a] = ends(-1);
  return {
    parts,
    steps: [
      {
        title: "Slide a rail onto an end frame",
        detail: "Stand the end frame up on a rug and push the rail onto its corner stub, tabs facing in. One bolt, tightened with the Allen key.",
        add: ["E0", "R1"],
        fix: [r1a],
        tools: ["allen"],
        pose: "-z",
        warnings: ["floor"],
      },
      { title: "Fit the second rail", detail: "Onto the other bottom corner of the same frame, tabs facing in. One bolt.", add: ["R2"], fix: [r2a], tools: ["allen"] },
      { title: "Fit the top rail", detail: "Onto the top corner at the back. One bolt from underneath.", add: ["R3"], fix: [r3a], tools: ["allen"] },
      {
        title: "Fit the other end frame",
        detail: "Push it onto the free ends of all three rails at once, then a bolt in each.",
        add: ["E1"],
        fix: ends(1),
        tools: ["allen"],
        check: "square",
      },
      {
        title: "Bolt in the first slatted panel",
        detail: "Lower it into the bottom of the frame onto the six tabs, then a bolt through each tab.",
        add: ["P1"],
        from: { P1: [0, 0, 300] },
        fix: [fix("bolt", [t + 10, yIn - 38].flatMap((y) => xs.map((x): Vec3 => [x, y, zIn - 22])), [0, 0, 1], { ...bolt, mate: "P1" })],
        tools: ["allen"],
      },
      {
        title: "Turn it and bolt in the second panel",
        detail: "Roll the frame over so its open side is up, lay the other panel in on the tabs and bolt it the same way.",
        add: ["P2"],
        from: { P2: [0, 300, 0] },
        fix: [fix("bolt", [-zIn + 15, zIn - 15].flatMap((z) => xs.map((x): Vec3 => [x, yIn - 22, z])), [0, 1, 0], { ...bolt, mate: "P2" })],
        tools: ["allen"],
        pose: "-y",
      },
      { title: "Stand it up", detail: "Slats on top for a low table, or turned onto its slatted side for a higher one.", pose: "+y" },
    ],
  };
}

const family: Family = {
  names: ["HÅKANSKÄR", "HAKANSKAR"],
  recipe(s) {
    if (!/coffee-table|coffee table/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
    return recipe(s);
  },
};
export default family;
