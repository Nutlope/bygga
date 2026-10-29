import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * RIMFORSA, read from the work bench's manual (the build with the steel shelf in the middle and the grid at the
 * bottom, standing free and clipped to the floor). The two welded end frames get a drop-in side bar each, then the
 * frame is bolted together upside down: two long shelf rails, the grid's back and front rails and four braces.
 * Stood up, the grid slides in behind a front trim, the steel shelf goes on its centre support, the top rails,
 * the divider and four runners go in, and the bamboo top is bolted on from below. Feet, floor clips, the two
 * drawers (front and handle screwed to a steel tray) and six hooks finish it.
 */

type Opts = { len?: number; dia?: number; name?: string };
const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Opts = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const SIDES = [-1, 1] as const;
const BOLT = { len: 12, dia: 6 };

/** The grid shelf: bars front to back on two cross bars. */
const grid = (w: number, d: number): PartPiece[] => {
  const n = Math.round(w / 34);
  return [
    ...Array.from({ length: n }, (_, i): PartPiece => ({ shape: "cyl", size: [6, d, 6], pos: [-w / 2 + 17 + i * ((w - 34) / (n - 1)), 3, 0], rot: [Math.PI / 2, 0, 0] })),
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [w, 6, 10], pos: [0, -3, sz * (d / 2 - 5)] })),
  ];
};

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 120 long, 63.5 wide, 92 high (90 to 94 on the feet)
  const W = s.size.w * 10 || 1200, D = s.size.d * 10 || 635, H = s.size.h * 10 || 920;
  const tT = 45, ty = H - tT; // underside of the top
  const leg = 40, foot = 30;
  const xl = W / 2 - 40, zl = D / 2 - 40; // leg centres
  const r = 30; // rail section
  const len = 2 * xl - leg; // rails between the end frames
  const yGrid = 215, yMid = 475, yTop = ty - r / 2; // rail centres
  const apron0 = 700; // end frames' side plate, under the top
  const zt = zl - 15; // top rails sit back from the legs' faces
  const run0 = -250, run1 = 250;

  // an end frame: two legs, a side plate at the top and a bar at grid height, welded in one piece
  const frameH = ty - foot, fy = (ty + foot) / 2;
  const endFrame = (id: string, sx: number): CustomPart => ({
    id,
    name: "End frame",
    size: [leg, frameH, 2 * zl + leg],
    pos: [sx * xl, fy, 0],
    material: "metal",
    pieces: [
      ...SIDES.map((sz): PartPiece => ({ shape: "box", size: [leg, frameH, leg], pos: [0, 0, sz * zl] })),
      { shape: "box", size: [10, ty - apron0, 2 * zl - leg], pos: [-sx * 15, (ty + apron0) / 2 - fy, 0] },
      { shape: "box", size: [r, r, 2 * zl - leg], pos: [0, yGrid - fy, 0] },
    ],
  });
  const rail = (id: string, name: string, y: number, z: number, h = r): CustomPart => ({ id, name, size: [len, h, r], pos: [0, y, z], material: "metal" });
  const bay = (sx: number) => ({ x0: sx * 17, x1: sx * (xl - leg / 2 - 12) }); // a drawer bay, divider face to runner
  const parts: CustomPart[] = [
    endFrame("E1", -1),
    endFrame("E2", 1),
    ...SIDES.map((sx, i): CustomPart => ({ id: `SB${i + 1}`, name: "Side bar", size: [r, r, 2 * zl - leg], pos: [sx * xl, yMid, 0], material: "metal" })),
    rail("R1", "Shelf rail", yMid, zl),
    rail("R2", "Shelf rail", yMid, -zl),
    rail("R3", "Grid rail", yGrid, -zl),
    rail("R4", "Grid rail", yGrid, zl),
  ];
  // four braces from low on the legs up to the grid rails, front and back
  const braceAng = Math.atan2(yGrid - r / 2 - 110, 120);
  SIDES.forEach((sz, j) =>
    SIDES.forEach((sx, i) =>
      parts.push({ id: `BR${j * 2 + i + 1}`, name: "Brace", shape: "cyl", size: [6, Math.hypot(120, yGrid - r / 2 - 110), 6], pos: [sx * (xl - leg / 2 - 60), (110 + yGrid - r / 2) / 2, sz * zl], rot: [0, 0, sx * (Math.PI / 2 - braceAng)], material: "metal" }),
    ),
  );
  parts.push(
    { id: "G", name: "Grid shelf", size: [len - 10, 12, 2 * zl - 2 * r + 20], pos: [0, yGrid + r / 2 + 6, 0], material: "metal", pieces: grid(len - 10, 2 * zl - 2 * r + 20) },
    { id: "FT", name: "Front trim", size: [len, 20, 10], pos: [0, yGrid + r / 2 + 10, zl + r / 2 + 5], material: "metal" },
    { id: "SS", name: "Shelf support", size: [20, 12, 2 * zl - r], pos: [0, yMid + r / 2 - 6, 0], material: "metal" },
    { id: "SH", name: "Steel shelf", size: [len, 5, 2 * zl + r], pos: [0, yMid + r / 2 + 2.5, 0], material: "metal" },
    rail("TB", "Top rail", yTop, -zt),
    rail("TF", "Top rail", yTop, zt),
    { id: "DV", name: "Divider", size: [10, ty - apron0, 2 * zt - r], pos: [0, (ty + apron0) / 2, 0], material: "metal" },
  );
  SIDES.forEach((sx, i) => {
    const { x0, x1 } = bay(sx);
    parts.push(
      { id: `RD${i + 1}`, name: "Runner", size: [12, 40, run1 - run0], pos: [x0 - sx * 6, 760, (run0 + run1) / 2], material: "metal" },
      { id: `RE${i + 1}`, name: "Runner", size: [12, 40, run1 - run0], pos: [x1 + sx * 6, 760, (run0 + run1) / 2], material: "metal" },
    );
  });
  parts.push({ id: "TOP", name: "Bamboo top", size: [W, tT, D], pos: [0, ty + tT / 2, 0], material: "wood" });
  const fz0 = zl + leg / 2 - 15; // drawer fronts' back face, flush with the legs
  SIDES.forEach((sx, i) => {
    const { x0, x1 } = bay(sx);
    const cx = (x0 + x1) / 2;
    parts.push(
      { id: `DT${i + 1}`, name: "Drawer tray", size: [Math.abs(x1 - x0), 120, fz0 - run0], pos: [cx, 790, (fz0 + run0) / 2], material: "metal" },
      { id: `DF${i + 1}`, name: "Drawer front", size: [xl - leg / 2 - 4, 195, 15], pos: [sx * ((xl - leg / 2) / 2), ty - 2 - 97.5, fz0 + 7.5], material: "metal" },
      { id: `DH${i + 1}`, name: "Handle", size: [380, 14, 24], pos: [sx * ((xl - leg / 2) / 2), ty - 50, fz0 + 15 + 12], material: "metal" },
    );
  });

  const legs: Vec3[] = SIDES.flatMap((sx) => SIDES.map((sz) => [sx * xl, 0, sz * zl] as Vec3));
  const endBolts = (y: number, z: number, mate: string): CustomFix[] => SIDES.map((sx, i) => at("bolt", [[sx * (xl - leg / 2), y, z]], [sx, 0, 0], mate, `E${i + 1}`, BOLT));
  const steps: CustomStep[] = [
    {
      title: "Drop a side bar into each end frame",
      detail: "Lay both end frames flat on a rug. The bar's slotted ends go down into the frame's brackets.",
      add: ["E1", "E2", "SB1", "SB2"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt the side bars in",
      detail: "One bolt at each end of each bar. Tighten them with the Allen key.",
      fix: SIDES.map((sx, i) => at("bolt", SIDES.map((sz) => [sx * xl, yMid, sz * (zl - leg / 2)] as Vec3), [0, 0, 1], `SB${i + 1}`, `E${i + 1}`, BOLT)),
      tools: ["allen"],
    },
    {
      title: "Bolt a shelf rail to one end frame",
      detail: "Stand the end frame upside down, feet up. Check which way the rail's bracket faces before you bolt it.",
      add: ["R1"],
      fix: [at("bolt", [[-xl + leg / 2, yMid, zl]], [-1, 0, 0], "R1", "E1", BOLT)],
      tools: ["allen"],
    },
    { title: "Bolt the second shelf rail on", detail: "On the other side of the same end frame.", add: ["R2"], fix: [at("bolt", [[-xl + leg / 2, yMid, -zl]], [-1, 0, 0], "R2", "E1", BOLT)], tools: ["allen"] },
    { title: "Bolt on the other end frame", detail: "Fit it on the free ends of both rails, one bolt in each.", fix: [at("bolt", [[xl - leg / 2, yMid, zl], [xl - leg / 2, yMid, -zl]], [1, 0, 0], "E2", undefined, BOLT)], tools: ["allen"] },
    { title: "Bolt the back grid rail between the frames", detail: "Lower it into the brackets near the feet, one bolt at each end.", add: ["R3"], fix: endBolts(yGrid, -zl, "R3"), tools: ["allen"] },
    { title: "Bolt the front grid rail in", detail: "The same way, at the front.", add: ["R4"], fix: endBolts(yGrid, zl, "R4"), tools: ["allen"] },
    {
      title: "Bolt the braces to the grid rails",
      detail: "Two at the front and two at the back. The bent end goes to the rail.",
      add: ["BR1", "BR2", "BR3", "BR4"],
      fix: [at("bolt", SIDES.flatMap((sz) => SIDES.map((sx) => [sx * (xl - leg / 2 - 120), yGrid - r / 2, sz * zl] as Vec3)), [0, 1, 0], undefined, undefined, BOLT)],
      tools: ["allen"],
    },
    { title: "Bolt the braces to the legs", detail: "One bolt through the flat end of each into its leg.", fix: [at("bolt", SIDES.flatMap((sz) => SIDES.map((sx) => [sx * (xl - leg / 2), 110, sz * zl] as Vec3)), [0, 0, -1], undefined, undefined, BOLT)], tools: ["allen"] },
    { title: "Turn it over and slide the grid in", detail: "Stand the frame on its feet. Push the grid in from the front until it sits on both grid rails.", add: ["G"], pose: "+y", from: { G: [0, 0, 600] } },
    {
      title: "Screw the front trim on",
      detail: "It holds the grid in. One small screw at each end.",
      add: ["FT"],
      fix: SIDES.map((sx, i) => at("screw", [[sx * (xl + leg / 2), yGrid + r / 2 + 10, zl + r / 2 + 5]], [-sx, 0, 0], `E${i + 1}`, "FT", { len: 8, dia: 4 })),
      tools: ["screwdriver"],
    },
    { title: "Clip in the shelf support", detail: "Its ends drop into the slots in the middle of both shelf rails.", add: ["SS"] },
    { title: "Lay the steel shelf on", detail: "Tip it in at an angle, then lower it flat onto the rails and the support.", add: ["SH"] },
    { title: "Bolt the back top rail between the frames", detail: "Two bolts at each end.", add: ["TB"], fix: [at("bolt", SIDES.flatMap((sx) => [yTop - 8, yTop + 8].map((y) => [sx * (xl - leg / 2), y, -zt] as Vec3)), [0, 0, -1], "TB", undefined, BOLT)], tools: ["allen"] },
    { title: "Turn it round and bolt on the front top rail", detail: "Two bolts at each end, as at the back.", add: ["TF"], fix: [at("bolt", SIDES.flatMap((sx) => [yTop - 8, yTop + 8].map((y) => [sx * (xl - leg / 2), y, zt] as Vec3)), [0, 0, 1], "TF", undefined, BOLT)], tools: ["allen"] },
    {
      title: "Screw the divider in",
      detail: "Hang it from the top rails in the middle. Three screws through its top.",
      add: ["DV"],
      fix: [at("screw", [-200, 0, 200].map((z) => [0, ty, z] as Vec3), [0, -1, 0], "DV", undefined, { len: 10, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the left runners",
      detail: "One on the end frame and one on the divider. Use the holes marked 2 at the front and 3 at the back.",
      add: ["RE1", "RD1"],
      fix: [at("screw", [-150, 150].map((z) => [-(xl - leg / 2 - 10), 760, z] as Vec3), [-1, 0, 0], "RE1", "E1", { len: 10, dia: 4 }), at("screw", [-150, 150].map((z) => [-5, 760, z] as Vec3), [1, 0, 0], "RD1", "DV", { len: 10, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the right runners",
      detail: "The same way in the right bay.",
      add: ["RE2", "RD2"],
      fix: [at("screw", [-150, 150].map((z) => [xl - leg / 2 - 10, 760, z] as Vec3), [1, 0, 0], "RE2", "E2", { len: 10, dia: 4 }), at("screw", [-150, 150].map((z) => [5, 760, z] as Vec3), [-1, 0, 0], "RD2", "DV", { len: 10, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the top on and bolt it from below",
      detail: "Two people lift it on. Eight bolts go up through the top rails into the bamboo, by hand first.",
      add: ["TOP"],
      fix: [at("bolt", SIDES.flatMap((sz) => [-450, -150, 150, 450].map((x) => [x, ty - r, sz * zt] as Vec3)), [0, 1, 0], undefined, "TOP", { len: 50, dia: 6 })],
      people: 2,
      tools: ["allen"],
    },
    { title: "Tighten the top's bolts", detail: "All eight, with the small Allen key.", tools: ["allen"] },
    { title: "Push the feet into the legs", detail: "One in the bottom of each leg.", fix: [at("foot", legs.map((p) => [p[0], foot, p[2]] as Vec3), [0, 1, 0], undefined, undefined, { len: 30, dia: 30 })] },
    { title: "Slide the foot covers on", detail: "Push each cover up over its foot until it sits on the leg.", fix: [at("cap", legs.map((p) => [p[0], foot + 20, p[2]] as Vec3), [0, 1, 0], undefined, undefined, { name: "Foot cover", len: 40, dia: 42 })] },
    { title: "Set the bench level", detail: "Turn the feet with the spanner. Leave at least 2 cm of each foot showing.", tools: ["wrench", "level"] },
    {
      title: "Mark where the floor clips go",
      detail: "With the bench where it will stand, slide a clip over each foot and draw round it.",
      fix: [at("clip", legs.map((p) => [p[0], 0, p[2]] as Vec3), [0, -1, 0], undefined, undefined, { name: "Floor clip", len: 10, dia: 50 })],
      tools: ["pencil"],
    },
    {
      title: "Screw the clips to the floor",
      detail: "Move the bench aside first. Floor screws aren't included: pick ones made for your floor, and check for pipes and underfloor heating.",
      // through the hole near the clip's edge (one in its middle would sit on the clip's own point and be moved off it)
      fix: [at("plug", legs.map((p) => [p[0], -30, p[2] - 23] as Vec3), [0, -1, 0], undefined, undefined, { name: "Floor plug" }), at("screw", legs.map((p) => [p[0], 4, p[2] - 23] as Vec3), [0, -1, 0], undefined, undefined, { len: 40, dia: 5 })],
      tools: ["drill", "screwdriver"],
    },
    { title: "Slide the bench onto the clips", detail: "Each foot goes into its clip from the side.", warnings: ["two"], people: 2 },
    { title: "Lower the feet into the clips", detail: "Turn each foot down with the spanner until it locks in its clip.", tools: ["wrench"] },
    {
      title: "Screw the fronts onto the drawer trays",
      detail: "Five screws through the tray's front edge into each front.",
      add: ["DT1", "DT2", "DF1", "DF2"],
      fix: SIDES.map((sx, i) => at("screw", [-200, -100, 0, 100, 200].map((dx) => [sx * ((xl - leg / 2) / 2) + dx, 760, fz0] as Vec3), [0, 0, 1], `DT${i + 1}`, `DF${i + 1}`, { len: 12, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the handles",
      detail: "Two long screws from inside each front, with a washer under each.",
      add: ["DH1", "DH2"],
      fix: SIDES.map((sx, i) => at("screw", [-170, 170].map((dx) => [sx * ((xl - leg / 2) / 2) + dx, ty - 50, fz0] as Vec3), [0, 0, 1], `DF${i + 1}`, `DH${i + 1}`, { len: 40, dia: 4 })),
      tools: ["screwdriver"],
    },
    { title: "Pull the runners out", detail: "All four, as far as they go." },
    { title: "Set the drawers on the runners", detail: "The hooks at the back of each tray catch on the runners, then lower the front until it clicks." },
    { title: "Check the drawer catches", detail: "Press the catch under each runner's front in. Pull a drawer out to check it holds." },
    { title: "Hang the hooks on the right end", detail: "Six hooks over the top edge of the side plate.", fix: [at("hook", [-200, -120, -40, 40, 120, 200].map((z) => [xl + 5, ty - 5, z] as Vec3), [0, -1, 0], "E2", undefined, { len: 60, dia: 6 })] },
    { title: "Peel the film off the steel shelf", detail: "Pull it off slowly from one corner." },
  ];
  return { parts, steps };
}

const family: Family = { names: ["RIMFORSA"], recipe };
export default family;
