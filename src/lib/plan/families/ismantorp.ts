import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, Vec3 } from "../../types";

/**
 * ISMANTORP, read from the armchair's manual. Each side is one bent steel tube (front leg, armrest loop and back
 * leg). Standing in the packaging, two rails are pushed into one side and bolted loosely, then the other side goes
 * on. On a table, the back pad is unzipped, the back hoop is laid in it and screwed to it with four short screws, and
 * the cover is zipped shut. The hoop's ends are bolted to the back legs with wedge nuts, the oval seat ring is
 * screwed onto the rails, all eight long bolts are tightened and the seat cushion is laid on.
 */

const TUBE = 25;
const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

/** A tube from a to b, as a piece of a part centred at c. */
function tube(a: Vec3, b: Vec3, c: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  return {
    shape: "cyl",
    size: [dia, len + dia * 0.6, dia],
    pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]],
    rot: [Math.atan2(d[2], d[1]), 0, Math.asin(-d[0] / len)],
  };
}
const path = (pts: Vec3[], c: Vec3): PartPiece[] => pts.slice(1).map((p, i) => tube(pts[i], p, c));

function armchair(): CustomParams {
  // IKEA: 72 wide, 66 deep, 71 high, seat 43 high, 59 wide and 46 deep
  const W = 720, H = 710, ySeat = 430;
  const xs = W / 2 - TUBE / 2 - 5;
  const yRail = 330, yRing = 345, tRing = 25, tCush = ySeat - yRing - tRing;
  // a side tube in the y-z plane: front leg, up over the armrest and down the back leg
  const side: [number, number][] = [
    [300, 0],
    [262, 520],
    [190, 595],
    [40, 585],
    [-110, 500],
    [-180, 450],
    [-290, 0],
  ];
  const zAt = (y: number, a: [number, number], b: [number, number]) => a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
  const zFront = zAt(yRail, side[0], side[1]), zBack = zAt(yRail, side[6], side[5]);

  const parts: CustomPart[] = [];
  for (const [id, sx] of [["SL", -1], ["SR", 1]] as const) {
    const c: Vec3 = [sx * xs, 300, 0];
    parts.push({ id, name: "Side frame", size: [TUBE, 600, 620], pos: c, material: "metal", pieces: path(side.map(([z, y]) => [sx * xs, y, z] as Vec3), c) });
  }
  const railLen = 2 * xs - TUBE;
  parts.push(
    { id: "RF", name: "Rail", shape: "cyl", size: [railLen, 20, 20], pos: [0, yRail, zFront], material: "metal" },
    { id: "RB", name: "Rail", shape: "cyl", size: [railLen, 20, 20], pos: [0, yRail, zBack], material: "metal" },
  );

  // the back hoop: its ends run down inside the back legs, then it arches over the back pad, leaning back
  const xh = xs - TUBE, yh0 = 400, yh1 = 470, zh = zAt(yh1, side[6], side[5]) + 5;
  const hoop: Vec3[] = [[-xh, yh0, zAt(yh0, side[6], side[5]) + 5]];
  for (let i = 0; i <= 12; i++) {
    const t = (Math.PI * i) / 12;
    const up = Math.sin(t);
    hoop.push([-xh * Math.cos(t), yh1 + (H - TUBE / 2 - yh1) * up, zh - 110 * up]);
  }
  hoop.push([xh, yh0, hoop[0][2]]);
  const hc: Vec3 = [0, (yh0 + H) / 2, zh - 55];
  parts.push({ id: "H", name: "Back hoop", size: [2 * xh + TUBE, H - yh0, 150], pos: hc, material: "metal", pieces: path(hoop, hc) });
  const lean = -Math.atan2(110, H - yh1);
  const padY = 575;
  parts.push({ id: "P", name: "Back pad", size: [2 * xh - 160, 230, 45], pos: [0, padY, zh - (110 * (padY - yh1)) / (H - TUBE / 2 - yh1)], rot: [lean, 0, 0], material: "soft" });

  // the oval seat ring on the rails, and the cushion on it
  const rw = 2 * xs - 2 * TUBE - 10, rd = zFront - zBack + 30, rz = (zFront + zBack) / 2;
  parts.push({
    id: "SR1",
    name: "Seat ring",
    size: [rw, tRing, rd],
    pos: [0, yRing + tRing / 2, rz],
    material: "metal",
    pieces: [
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [rw - 60, tRing, 30], pos: [0, 0, sz * (rd / 2 - 15)] })),
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [30, tRing, rd - 60], pos: [sx * (rw / 2 - 15), 0, 0] })),
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [60, tRing, 60], pos: [sx * (rw / 2 - 30), 0, sz * (rd / 2 - 30)] }))),
    ],
  });
  parts.push({ id: "C", name: "Seat cushion", size: [590, tCush, 470], pos: [0, yRing + tRing + tCush / 2, rz], material: "soft" });

  const LONG = { len: 45, dia: 6 };
  const railBolts = (sx: number): CustomFix[] =>
    (["RF", "RB"] as const).map((r) => at("bolt", [[sx * (xs + TUBE / 2), yRail, r === "RF" ? zFront : zBack]], [-sx, 0, 0], sx < 0 ? "SL" : "SR", r, LONG));
  const hoopPts = (sx: number): Vec3[] => [yh0 + 15, yh1 - 15].map((y) => [sx * (xs + TUBE / 2), y, zAt(y, side[6], side[5])] as Vec3);
  // through the hoop's plates on the back of the pad, into the pad's frame
  const padZ = (y: number) => zh - (110 * (y - yh1)) / (H - TUBE / 2 - yh1);
  const padScrews: Vec3[] = [-1, 1].flatMap((sx) => [475, 615].map((y) => [sx * (xh - 100), y, padZ(y) - 26] as Vec3));
  const ringScrews: Vec3[] = [-1, 1].flatMap((sx) => [zFront, zBack].map((z) => [sx * (rw / 2 - 60), yRing + tRing, z] as Vec3));
  const OFF: Vec3 = [0, 0, -700];

  return {
    parts,
    steps: [
      {
        title: "Push the rails into a side frame",
        detail: "Stand the side frame in the packaging. Push both rails in and turn a long bolt into each, only loosely for now.",
        add: ["SL", "RF", "RB"],
        fix: railBolts(-1),
        tools: ["allen"],
        from: { RF: [500, 0, 0], RB: [500, 0, 0] },
      },
      { title: "Bolt on the other side frame", detail: "Push it onto the free rail ends and fit two more long bolts loosely.", add: ["SR"], fix: railBolts(1), tools: ["allen"], from: { SR: [400, 0, 0] } },
      { title: "Unzip the back pad", detail: "Lay it face down on a table and open its zip all the way round.", wait: ["P"], from: { P: OFF } },
      {
        title: "Screw the back hoop into the pad",
        detail: "Lay the hoop on the pad so its plates sit over the holes. Four short screws, first turned in loosely, then tightened until their heads sit flush.",
        fix: [at("bolt", padScrews, [0, 0, 1], "H", "P", { len: 12, dia: 6, name: "Short screw" })],
        tools: ["allen"],
        wait: ["H"],
        from: { H: OFF },
      },
      { title: "Zip the cover shut", detail: "Close the zip all the way round so the hoop's plates are inside." },
      {
        title: "Bolt the back to the back legs",
        detail: "Slide the hoop's ends down inside the back legs. A wedge nut goes in behind each hole, then a long bolt through the leg into it.",
        add: ["H", "P"],
        fix: [-1, 1].flatMap((sx) => [
          at("nut", hoopPts(sx).map((p) => [sx * (xh - TUBE / 2), p[1], p[2]] as Vec3), [sx, 0, 0], "H", undefined, { name: "Wedge nut", dia: 10 }),
          at("bolt", hoopPts(sx), [-sx, 0, 0], sx < 0 ? "SL" : "SR", "H", LONG),
        ]),
        tools: ["allen"],
        from: { H: OFF, P: OFF },
      },
      {
        title: "Screw the seat ring onto the rails",
        detail: "Lay the ring on the rails with its holes over theirs. Four short screws, heads flush with the ring.",
        add: ["SR1"],
        fix: [at("bolt", ringScrews, [0, -1, 0], "SR1", undefined, { len: 12, dia: 6, name: "Short screw" })],
        tools: ["allen"],
        from: { SR1: [0, 300, 0] },
      },
      { title: "Tighten all the long bolts", detail: "Go round all eight until their heads sit flush with the tubes.", tools: ["allen"] },
      { title: "Lay the seat cushion on", detail: "The strap underneath goes at the back.", add: ["C"], from: { C: [0, 300, 0] } },
    ],
  };
}

const family: Family = {
  names: ["ISMANTORP"],
  recipe(s) {
    if (/armchair/i.test(s.variant) || /ismantorp-armchair/.test(s.slug ?? "")) return armchair();
    return null;
  },
};
export default family;
