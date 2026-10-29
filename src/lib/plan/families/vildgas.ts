import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, Vec3 } from "../../types";

/**
 * VILDGÅS, read from the junior chair's manual. Two bent side frames (front leg, seat rail and back leg in one
 * steel tube) are bolted together by a front rail, the back uprights (held with nuts), a back rail and the foot
 * rest, all loosely; the plastic backrest slides down over the uprights and takes two screws, then the eight bolts
 * are tightened. With the chair upside down on a table the seat hooks in at the back, clicks in at the front and
 * takes four screws. Last, a non-slip strip is stuck on the foot rest.
 */

const TUBE = 20;

/** A round tube from a to b. */
function tube(a: Vec3, b: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const h = Math.hypot(d[0], d[2]);
  const [ux, uz] = h > 1e-6 ? [d[0] / h, d[2] / h] : [1, 0];
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-uz, ux), -Math.acos(d[1] / len)] };
}

/** One part drawn as tubes between points (finished-product mm): its box is their extent. */
function frame(id: string, name: string, runs: [Vec3, Vec3][], dia = TUBE): CustomPart {
  const pts = runs.flat();
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])) - dia / 2);
  const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])) + dia / 2);
  lo[1] = Math.max(0, lo[1]);
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
  const rel = (p: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  return { id, name, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: c, pieces: runs.map(([a, b]) => tube(rel(a), rel(b), dia)), material: "metal" };
}

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, ...o });

function chair(): CustomParams {
  // IKEA: 46 wide, 49 deep, 79 high; seat 33 x 28 at 55 high
  const H = 790, yR = 520; // top of the bent frames, under the seat
  const xT = 170, xF = 220; // frame half-width at the top and at the feet
  const zF = 140, zB = -140, zfF = 235, zfB = -235; // seat rail ends and feet, front and back
  const parts: CustomPart[] = [];
  const sides = [-1, 1];
  sides.forEach((sx, i) =>
    parts.push(
      frame(`F${i}`, "Side frame", [
        [[sx * xF, 0, zfF], [sx * xT, yR, zF]],
        [[sx * xT, yR, zF], [sx * xT, yR, zB]],
        [[sx * xT, yR, zB], [sx * xF, 0, zfB]],
      ]),
    ),
  );
  const rail = (id: string, name: string, y: number, z: number, x: number) => frame(id, name, [[[-x + TUBE / 2, y, z], [x - TUBE / 2, y, z]]]);
  parts.push(rail("RF", "Front rail", yR, zF - 20, xT));
  // the back uprights: a U whose bottom bar bolts between the frames
  const zU = zB + 10, yU0 = yR - 40, yU1 = 720;
  parts.push(frame("U", "Back uprights", [[[-xT + TUBE / 2, yU0, zU], [xT - TUBE / 2, yU0, zU]], [[-xT + 30, yU0, zU], [-xT + 30, yU1, zU]], [[xT - 30, yU0, zU], [xT - 30, yU1, zU]]]));
  parts.push(rail("RB", "Back rail", yR, zB + 60, xT));
  // the foot rest runs between the front legs, 25 cm up
  const yFoot = 250, tF = yFoot / yR;
  const xFoot = xF + (xT - xF) * tF, zFoot = zfF + (zF - zfF) * tF;
  parts.push(rail("FR", "Foot rest", yFoot, zFoot, xFoot));
  parts.push({ id: "B", name: "Backrest", size: [330, 215, 24], pos: [0, H - 108, zU - 4], material: "board" });
  parts.push({ id: "S", name: "Seat", size: [330, 30, 300], pos: [0, yR + TUBE / 2 + 15, 10], material: "board" });
  parts.push({ id: "N", name: "Non-slip strip", size: [2 * xFoot - 80, 2, 18], pos: [0, yFoot + TUBE / 2 + 1, zFoot], material: "soft" });

  const bolt = { len: 30, dia: 6 };
  const ends = (y: number, z: number, x: number): [Vec3[], Vec3[]] => [[[-x - TUBE / 2, y, z]], [[x + TUBE / 2, y, z]]];
  const pairBolts = (id: string, y: number, z: number, x: number): CustomFix[] => {
    const [l, r] = ends(y, z, x);
    return [at("bolt", l, [1, 0, 0], id, bolt), at("bolt", r, [-1, 0, 0], id, bolt)];
  };
  const screw = { len: 12, dia: 4 };
  return {
    parts,
    steps: [
      {
        title: "Join the side frames with the front rail",
        detail: "The rail curves down in the middle. Turn a bolt in at each end with the Allen key, but don't tighten them yet.",
        add: ["F0", "F1", "RF"],
        fix: pairBolts("RF", yR, zF - 20, xT),
        tools: ["allen"],
      },
      {
        title: "Bolt the back uprights between the frames",
        detail: "Hold each nut on the inside with the spanner while you turn the bolt. Leave them a little loose.",
        add: ["U"],
        fix: [...pairBolts("U", yU0, zU, xT), at("nut", [[-xT + TUBE / 2 + 4, yU0, zU]], [-1, 0, 0], "U"), at("nut", [[xT - TUBE / 2 - 4, yU0, zU]], [1, 0, 0], "U")],
        tools: ["allen", "wrench"],
      },
      {
        title: "Fit the back rail",
        detail: "It curves the other way from the front rail. One bolt at each end, still loose.",
        add: ["RB"],
        fix: pairBolts("RB", yR, zB + 60, xT),
        tools: ["allen"],
      },
      {
        title: "Fit the foot rest between the front legs",
        detail: "Line up the holes with your finger, then a bolt at each end.",
        add: ["FR"],
        fix: pairBolts("FR", yFoot, zFoot, xFoot),
        tools: ["allen"],
      },
      { title: "Slide the backrest down over the uprights", detail: "Push it all the way down so its holes line up with the holes in the uprights.", add: ["B"], from: { B: [0, 260, 0] } },
      {
        title: "Screw the backrest to the uprights",
        detail: "One screw on each side, from the back.",
        fix: [at("screw", [[-xT + 30, 690, zU - TUBE / 2]], [0, 0, 1], "U", { ...screw, mate: "B" }), at("screw", [[xT - 30, 690, zU - TUBE / 2]], [0, 0, 1], "U", { ...screw, mate: "B" })],
        tools: ["screwdriver"],
      },
      {
        title: "Tighten all eight bolts",
        detail: "Press the frame down on the floor so it stands square, then tighten every bolt until its head sits flush.",
        tools: ["allen"],
        check: "square",
      },
      {
        title: "Hook the seat in at the back",
        detail: "Turn the chair upside down on a table with the backrest over the edge. Slide the seat in so its two back hooks catch the back rail.",
        add: ["S"],
        pose: "-y",
        from: { S: [0, 0, -200] },
        warnings: ["floor"],
      },
      { title: "Click the front of the seat onto the rail", detail: "Press the clip at the front down over the front rail until it snaps." },
      {
        title: "Screw the seat to the frames",
        detail: "Four screws, two through the brackets on each side.",
        fix: sides.map((sx) => at("screw", [[sx * xT, yR - TUBE / 2, 50], [sx * xT, yR - TUBE / 2, -50]], [0, 1, 0], sx < 0 ? "F0" : "F1", { ...screw, mate: "S" })),
        tools: ["screwdriver"],
      },
      {
        title: "Stick the strip on the foot rest",
        detail: "Turn the chair onto its feet. Wipe the foot rest clean and dry, peel off the backing and press the strip on, centred between the legs.",
        add: ["N"],
        pose: "+y",
      },
    ],
  };
}

const family: Family = {
  names: ["VILDGÅS", "VILDGAS"],
  recipe: (s) => (/junior/i.test(`${s.variant} ${s.slug ?? ""}`) ? chair() : null),
};
export default family;
