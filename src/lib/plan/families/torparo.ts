import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * TORPARÖ, read from its manuals. The chair is a steel frame and two plastic shells: each side is one bent tube
 * (front leg, armrest, back leg), the curved front rail and the straight back rail are bolted between them with
 * two flat Allen bolts at each end, then the two back posts are bolted on. The back shell clicks onto the seat
 * shell, the chair goes upside down so the back slides onto the posts, and the seat swings down and clips onto
 * the rails. The table needs no assembly: it comes folded, and its manual only shows unfolding it.
 */

const TUBE = 22;

/** A round tube from a to b, in the y-z plane or the x-y plane. */
function tube(a: Vec3, b: Vec3, dia = TUBE): PartPiece {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const rot: Vec3 = Math.abs(d[0]) < 1e-6 ? [Math.atan2(d[2], d[1]), 0, 0] : [0, 0, Math.atan2(-d[0], d[1])];
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot, material: "metal" };
}

/** A part made of tubes placed in the finished product, centred on their bounds. */
function frame(id: string, name: string, segs: [Vec3, Vec3][], dia = TUBE): CustomPart {
  const pts = segs.flat();
  const lo = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])) - dia / 2);
  const hi = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])) + dia / 2);
  const pos = lo.map((v, i) => (v + hi[i]) / 2) as Vec3;
  const rel = (p: Vec3): Vec3 => [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
  return { id, name, size: hi.map((v, i) => v - lo[i]) as Vec3, pos, pieces: segs.map(([a, b]) => tube(rel(a), rel(b), dia)), material: "metal" };
}

const BOLT = { len: 12, dia: 6 };

function chair(s: ProductSpec): CustomParams {
  // IKEA: 55 wide, 80 high, 54 deep, seat 46 high
  const W = 550, H = Math.min(s.size.h * 10, 800), D = 540;
  const xs = W / 2 - TUBE / 2; // side frames
  const xi = xs - TUBE / 2; // their inner face
  const yArm = 640, yRail = 410;
  const zF = D / 2 - 30, zB = -D / 2 + 20;
  const side = (sx: number): [Vec3, Vec3][] => {
    const x = sx * xs;
    return [
      [[x, 0, zF], [x, yArm, zF - 20]],
      [[x, yArm, zF - 20], [x, yArm, -150]],
      [[x, yArm, -150], [x, 0, zB]],
    ];
  };
  const zRf = 190, zRb = -150; // front and back rail
  const zBackLo = -175, zBackHi = -D / 2 + 10;
  const post = (sx: number): [Vec3, Vec3][] => [[[sx * (xi - 10), yRail + 10, zBackLo], [sx * (xi - 10), H - 40, zBackHi]]];
  const tilt = Math.atan2(zBackLo - zBackHi, H - 40 - (yRail + 10));
  const parts: CustomPart[] = [
    frame("L", "Side frame", side(-1)),
    frame("R", "Side frame", side(1)),
    { id: "F", name: "Front rail", size: [2 * xi, 20, 40], pos: [0, yRail, zRf], material: "metal" },
    { id: "B", name: "Back rail", shape: "cyl", size: [20, 2 * xi, 20], pos: [0, yRail, zRb], rot: [0, 0, Math.PI / 2], material: "metal" },
    frame("PL", "Back post", post(-1), 18),
    frame("PR", "Back post", post(1), 18),
    { id: "S", name: "Seat shell", size: [2 * xi - 20, 30, zRf - zRb + 80], pos: [0, yRail + 35, (zRf + zRb) / 2 + 20], material: "board" },
    {
      id: "K",
      name: "Back shell",
      size: [2 * xi - 10, H - yRail - 80, 20],
      pos: [0, (H + yRail + 80) / 2, (zBackLo + zBackHi) / 2 + 12],
      rot: [-tilt, 0, 0],
      material: "board",
    },
  ];
  const ends = (sx: number, z: number, dir: Vec3, rail: string, side: string): CustomFix => ({
    kind: "bolt",
    count: 2,
    ...BOLT,
    at: [sx * (xi - 10), sx * (xi - 34)].map((x): Vec3 => [x, yRail + (dir[1] < 0 ? 10 : -10), z]),
    dir,
    on: rail,
    mate: side,
  });
  const posts = (sx: number, id: string, side: string): CustomFix => ({
    kind: "bolt",
    count: 2,
    ...BOLT,
    at: [yRail + 20, yRail + 50].map((y): Vec3 => [sx * (xs + TUBE / 2), y, zBackLo - 8]),
    dir: [-sx, 0, 0],
    on: id,
    mate: side,
  });
  const steps: CustomStep[] = [
    {
      title: "Bolt the curved rail to one side frame",
      detail: "The rail bends down in the middle. Push its end onto the bracket and turn in two bolts, loosely for now.",
      add: ["L", "F"],
      fix: [ends(-1, zRf, [0, -1, 0], "F", "L")],
      tools: ["allen"],
    },
    {
      title: "Bolt the straight rail to the same side",
      detail: "Slide it onto the back bracket and turn in two bolts from below. Leave them loose.",
      add: ["B"],
      fix: [ends(-1, zRb, [0, 1, 0], "B", "L")],
      tools: ["allen"],
    },
    {
      title: "Fit the other side frame onto both rails",
      detail: "Two bolts at each rail end, still loose.",
      add: ["R"],
      fix: [ends(1, zRf, [0, -1, 0], "F", "R"), ends(1, zRb, [0, 1, 0], "B", "R")],
      tools: ["allen"],
    },
    { title: "Tighten the four rail joints", detail: "Turn each bolt down until its head sits flat on the bracket.", tools: ["allen"], check: "square" },
    {
      title: "Bolt on the left back post",
      detail: "Its lower end goes inside the side frame at the back rail. Two bolts through the side, flush with the tube.",
      add: ["PL"],
      fix: [posts(-1, "PL", "L")],
      tools: ["allen"],
    },
    { title: "Bolt on the right back post", detail: "The same on the other side, two bolts.", add: ["PR"], fix: [posts(1, "PR", "R")], tools: ["allen"] },
    { title: "Click the back shell onto the seat shell", detail: "On the floor: hook its two tabs into the back edge of the seat and press until all three clips click." },
    {
      title: "Turn the chair upside down and slide the shells on",
      detail: "Slide the back down over both posts and hook the seat's back edge over the back rail, with the seat still tilted up.",
      add: ["K", "S"],
      from: { K: [0, 300, 0], S: [0, 200, 120] },
      pose: "-y",
    },
    { title: "Swing the seat down onto the front rail", detail: "Fold it down until its front edge rests on the curved rail.", warnings: ["hand"] },
    {
      title: "Stand the chair up and press the back home",
      detail: "Push the top of the back down onto the posts, then press both side clips until they snap.",
      pose: "+y",
    },
    { title: "Press the seat down until it clicks", detail: "Press along the front and the sides until all four clips under the seat hold the rails." },
  ];
  return { parts, steps };
}

function table(s: ProductSpec): CustomParams {
  // IKEA: 130 x 74, 75 high
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25;
  const yU = H - tt - TUBE / 2; // the hinge bar under the top
  const top: PartPiece[] = [{ shape: "box", size: [W, 4, D], pos: [0, tt / 2 - 2, 0], material: "metal" }];
  // the edge folded down all round
  top.push(
    { shape: "box", size: [W, tt - 4, 4], pos: [0, -2, -D / 2 + 2], material: "metal" },
    { shape: "box", size: [W, tt - 4, 4], pos: [0, -2, D / 2 - 2], material: "metal" },
    { shape: "box", size: [4, tt - 4, D - 8], pos: [-W / 2 + 2, -2, 0], material: "metal" },
    { shape: "box", size: [4, tt - 4, D - 8], pos: [W / 2 - 2, -2, 0], material: "metal" },
    // two rails under it, the legs and braces hinge on them
    { shape: "box", size: [W - 120, 20, 30], pos: [0, -tt / 2 - 10, -D / 2 + 60], material: "metal" },
    { shape: "box", size: [W - 120, 20, 30], pos: [0, -tt / 2 - 10, D / 2 - 60], material: "metal" },
  );
  const parts: CustomPart[] = [{ id: "T", name: "Table top", size: [W, tt + 20, D], pos: [0, H - tt / 2 - 10, 0], pieces: top, material: "metal" }];
  const zl = D / 2 - 40;
  const legs = (sx: number): [Vec3, Vec3][] => {
    const xt = sx * (W / 2 - 110), xf = sx * (W / 2 - 60);
    const yB = H - 200, xb = xt + ((xf - xt) * (yU - yB)) / yU, xe = sx * (W / 2 - 330);
    return [
      [[xt, yU - 20, -zl], [xt, yU - 20, zl]],
      [[xt, yU - 20, -zl], [xf, 0, -zl]],
      [[xt, yU - 20, zl], [xf, 0, zl]],
      // the folding braces, one each side, from the leg up to the rail under the top
      [[xb, yB, -zl + 20], [xe, yU - 20, -zl + 20]],
      [[xb, yB, zl - 20], [xe, yU - 20, zl - 20]],
    ];
  };
  parts.push(frame("A", "Leg frame", legs(-1)), frame("B", "Leg frame", legs(1)));
  const steps: CustomStep[] = [
    { title: "Lay the folded table upside down on a rug", detail: "The legs come hinged to the top, folded flat against it.", add: ["T"], pose: "-y", warnings: ["floor"] },
    { title: "Swing up both pairs of legs", detail: "Lift each pair until it stands straight up from the top.", add: ["A", "B"] },
    {
      title: "Push the braces until they lock",
      detail: "Press each brace along its slot until it clicks, then check the lock has closed on both sides.",
      warnings: ["hand"],
    },
    { title: "Turn the table the right way up", detail: "To fold it again, open the locks first and keep your fingers clear of the braces.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["TORPARÖ", "TORPARO"],
  recipe(s) {
    const t = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
    if (/chair/.test(t)) return chair(s);
    if (/table/.test(t)) return table(s);
    return null;
  },
};
export default family;
