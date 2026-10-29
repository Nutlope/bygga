import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, Vec3 } from "../../types";

/*
 * SOTENÄS armchair, read from IKEA's manual (two people). The steel underframe is three tubes: a side hoop pushes
 * into each end of the bent floor bar and is held by one short screw. The seat lies upside down, the frame is turned
 * over onto it and four long screws go through the hoops' top bars into the seat, turned in by hand first; then all
 * six screws are tightened, heads flat.
 * IKEA's sizes: 86 wide, 81 deep, 68 high, seat 32 high, 67 x 54.
 */

const TUBE = 22;
const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

/** A rod from a to b, as a piece of a part centred at c. */
function rod(a: Vec3, b: Vec3, c: Vec3): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  return {
    shape: "cyl",
    size: [TUBE, len, TUBE],
    pos: [(a[0] + b[0]) / 2 - c[0], (a[1] + b[1]) / 2 - c[1], (a[2] + b[2]) / 2 - c[2]],
    rot: [Math.atan2(d[2], d[1]), 0, Math.asin(-d[0] / len)],
  };
}
/** A bent tube through the points, as one part. */
function tube(id: string, name: string, pts: Vec3[]): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])) - TUBE / 2) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])) + TUBE / 2) as Vec3;
  const c = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, material: "metal", pieces: pts.slice(1).map((p, i) => rod(pts[i], p, c)) };
}

function armchair(): CustomParams {
  const y0 = TUBE / 2, yT = 230 - TUBE / 2; // floor tubes, hoops' top bars under the seat
  const HX = 260, ZF = 200, ZB = -120, ZJ = -200; // hoops, their front and back, where they meet the floor bar
  const hoop = (id: string, g: number) =>
    tube(id, "Side hoop", [[g * HX, y0, ZJ - 40], [g * HX, y0, ZF], [g * HX, yT, ZF], [g * HX, yT, ZB], [g * HX, y0, ZB]]);
  const sc: Vec3 = [0, 455, -5];
  const seat: CustomPart = {
    id: "S",
    name: "Seat",
    size: [860, 450, 810],
    pos: sc,
    material: "soft",
    pieces: [
      { shape: "box", size: [860, 120, 560], pos: [0, 290 - sc[1], 80 - sc[2]] },
      { shape: "box", size: [640, 110, 60], pos: [0, 290 - sc[1], 385 - sc[2]] },
      { shape: "box", size: [800, 420, 130], pos: [0, 470 - sc[1], -290 - sc[2]], rot: [-0.35, 0, 0] },
    ],
  };
  const joint = (g: number): Vec3 => [g * HX, y0 + TUBE / 2, ZJ - 20]; // down through the bar into the hoop's end inside it
  const top = (g: number): Vec3[] => [ZF - 60, ZB + 60].map((z): Vec3 => [g * HX, yT - TUBE / 2, z]);
  return {
    parts: [
      tube("F", "Floor bar", [[-HX, y0, ZJ], [-HX + 60, y0, -380], [HX - 60, y0, -380], [HX, y0, ZJ]]),
      hoop("L", -1),
      hoop("R", 1),
      seat,
    ],
    steps: [
      {
        title: "Push a side hoop into the floor bar",
        detail: "Slide the hoop's end into the bar until the holes line up. Hold the tubes straight, don't lever them.",
        add: ["F", "L"],
        warnings: ["floor"],
      },
      { title: "Screw the joint", detail: "One short screw, head flat with the tube.", fix: [fix("screw", [joint(-1)], [0, -1, 0], { on: "F", mate: "L", len: 16, dia: 6 })], tools: ["allen"] },
      { title: "Push the other hoop into the bar", detail: "The same at the other end of the floor bar.", add: ["R"] },
      { title: "Screw that joint", detail: "The second short screw.", fix: [fix("screw", [joint(1)], [0, -1, 0], { on: "F", mate: "R", len: 16, dia: 6 })], tools: ["allen"] },
      {
        title: "Lay the frame on the upside-down seat",
        detail: "Seat upside down on a rug, then turn the frame over onto it. Turn the four long screws through the hoops into the seat by hand.",
        add: ["S"],
        fix: [-1, 1].map((g) => fix("screw", top(g), [0, 1, 0], { on: g < 0 ? "L" : "R", mate: "S", len: 60, dia: 6 })),
        pose: "-y",
        people: 2,
        warnings: ["two"],
        from: { S: [0, 300, 0] },
      },
      { title: "Tighten the four long screws", detail: "With the Allen key, until each head sits flat in its hole, not tilted.", tools: ["allen"] },
      { title: "Tighten the two short screws", detail: "The ones at the floor bar joints, the same way.", tools: ["allen"] },
      { title: "Turn the chair over", detail: "Together, onto its frame.", pose: "+y", people: 2 },
    ],
  };
}

const family: Family = {
  names: ["SOTENÄS", "SOTENAS"],
  recipe(s) {
    if (/armchair/i.test(`${s.variant} ${s.slug ?? ""}`)) return armchair();
    return null;
  },
};
export default family;
