import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * IDÅSEN, read from the desk underframe's manual (the desk with A-shaped legs set by hand from 65 to 79 cm, no motor).
 * The telescopic beam slides together and is bolted at the length for the top, the two columns and the end brackets
 * are screwed to its ends, and the whole frame is laid on the top, face down on a rug, and bolted to it. The A legs
 * slide over the columns at the chosen height and are bolted through, the feet screw into their ends, the cable net
 * clips under the top, and two people turn the desk over.
 * The drawer unit on castors, from its manual: the two side shells click onto the bottom frame and its two rear
 * posts, the rails across the top and the tray floor are screwed in, the runners go on lying on its back, then
 * upside down the castors and the back panel. Each drawer is a steel box of three sheets hooked together, with a
 * bottom dropped in, set on its front and screwed, then the runner couplings, label holder and handle go on; the
 * deep file drawer also gets a support wheel. Both slide onto the runners last.
 * The sit/stand underframe with motors, from its manual: the beam slides together and is bolted at length upside
 * down, the motor columns and end brackets go on its ends, the A legs slide over the columns' feet and are bolted,
 * the feet go in and it is turned over; the cables plug into the control box, the cable net goes under the top
 * (sold separately), the top is screwed to the brackets and the control panel under its front edge.
 * The cabinet with sliding glass doors, from its manual: steel panels that click together standing, the sides onto
 * the two leg frames, the top pressed on, four rivets, the two back halves slid in, the floor panel, grommets, the
 * wall fittings, twelve shelf clips and three shelves, then the two glass doors hung in their tracks.
 */

const TOP_T = 25;
const BEAM_H = 40, BEAM_D = 80;
const COL = 50;

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

function desk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const yU = H - TOP_T; // underside of the top
  const yB = yU - BEAM_H / 2; // beam centre
  const xc = W / 2 - 110; // columns and legs
  const xe = xc + COL / 2 + 20; // beam ends
  const xj = W / 2 > 700 ? 280 : 200; // where the beam's sections meet
  const parts: CustomPart[] = [
    { id: "BEAM_L", name: "Beam end", size: [xe - xj, BEAM_H - 4, BEAM_D - 6], pos: [-(xe + xj) / 2, yB, 0], material: "metal" },
    { id: "BEAM_C", name: "Beam centre", size: [2 * xj, BEAM_H, BEAM_D], pos: [0, yB, 0], material: "metal" },
    { id: "BEAM_R", name: "Beam end", size: [xe - xj, BEAM_H - 4, BEAM_D - 6], pos: [(xe + xj) / 2, yB, 0], material: "metal" },
  ];
  const colY0 = 140, colY1 = yU - BEAM_H;
  const cols = ["COL_L", "COL_R"];
  [-1, 1].forEach((sx, i) => parts.push({ id: cols[i], name: "Column", size: [COL, colY1 - colY0, COL], pos: [sx * xc, (colY0 + colY1) / 2, 0], shape: "cyl", material: "metal" }));
  const brackets = ["BR_L", "BR_R"];
  const brD = D - 160;
  [-1, 1].forEach((sx, i) => parts.push({ id: brackets[i], name: "End bracket", size: [30, BEAM_H, brD], pos: [sx * (xe + 15), yB, 0], material: "metal" }));
  parts.push({ id: "TOP", name: "Table top", size: [W, TOP_T, D], pos: [0, H - TOP_T / 2, 0], material: "board" });
  // each A leg: a sleeve over the column, two struts splayed to the feet and a bar across low down
  const legs = ["LEG_L", "LEG_R"];
  const yS0 = 110, yS1 = Math.min(400, colY1 - 40); // sleeve
  const zFoot = D / 2 - 70, yBar = 110;
  const ang = Math.atan2(zFoot, yS1 - 20);
  const strutLen = Math.hypot(zFoot, yS1 - 20);
  const legC: Vec3 = [0, (yS1 + 15) / 2, 0];
  const legPieces: PartPiece[] = [
    { shape: "cyl", size: [COL + 12, yS1 - yS0, COL + 12], pos: [0, (yS0 + yS1) / 2 - legC[1], 0] },
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [36, strutLen, 36], pos: [0, (yS1 + 20) / 2 - legC[1], (sz * zFoot) / 2], rot: [-sz * ang, 0, 0] })),
    { shape: "box", size: [30, 30, 2 * zFoot * ((yS1 - yBar) / (yS1 - 20))], pos: [0, yBar - legC[1], 0] },
  ];
  [-1, 1].forEach((sx, i) => parts.push({ id: legs[i], name: "A leg", size: [56, yS1 - 15, 2 * zFoot + 56], pos: [sx * xc, legC[1], 0], pieces: legPieces, material: "metal" }));
  // the cable net hangs under the top, behind the beam
  const netW = 2 * xc - 260, netD = 200, netH = 60, zNet = -(BEAM_D / 2 + 20 + netD / 2);
  parts.push({
    id: "NET",
    name: "Cable net",
    size: [netW, netH, netD],
    pos: [0, yU - netH / 2, zNet],
    pieces: [
      { shape: "box", size: [netW, 3, netD], pos: [0, -netH / 2 + 1.5, 0] },
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [netW, netH, 3], pos: [0, 0, (sz * (netD - 3)) / 2] })),
    ],
    material: "metal",
  });

  const joints = [-1, 1].flatMap((j) => [j * (xj - 40), j * (xj + 40)].flatMap((x) => [yB - 10, yB + 10].map((y): Vec3 => [x, y, BEAM_D / 2])));
  // two through each side wall of the beam end, going in towards the column
  const colScrews = (sx: number, i: number) => [-1, 1].map((sz) => fx("screw", [yB - 12, yB + 12].map((y): Vec3 => [sx * xc, y, sz * (BEAM_D / 2 - 3)]), [0, 0, -sz], i ? "BEAM_R" : "BEAM_L", { len: 12, dia: 6, mate: cols[i] }));
  const brScrews = (sx: number, i: number) => fx("screw", [-14, 14].map((z): Vec3 => [sx * (xe + 30), yB, z]), [-sx, 0, 0], brackets[i], { len: 12, dia: 6, mate: i ? "BEAM_R" : "BEAM_L" });
  const topBolts = (sx: number, i: number) => fx("bolt", [-1, 1].flatMap((sz) => [brD / 2 - 30, brD / 2 - 90].map((z): Vec3 => [sx * (xe + 15), yB - BEAM_H / 2, sz * z])), [0, 1, 0], brackets[i], { len: 20, dia: 6, mate: "TOP" });
  const feet = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xc, 0, sz * zFoot]));
  const netPts = [-0.4, 0, 0.4].flatMap((t) => [-1, 1].map((sz): Vec3 => [t * netW, yU, zNet + (sz * (netD - 10)) / 2]));

  const steps: CustomStep[] = [
    {
      title: "Slide the beam together",
      detail: "Lay the three parts of the beam upside down on a rug and push the two ends into the middle one.",
      add: ["BEAM_C", "BEAM_L", "BEAM_R"],
      from: { BEAM_L: [-260, 0, 0], BEAM_R: [260, 0, 0] },
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: `Bolt it at the length for a ${Math.round(W / 10)} cm top`,
      detail: "Four bolts through each joint, with a nut on the inside. The holes for the longer top are the outer ones.",
      fix: [fx("bolt", joints, [0, 0, -1], "BEAM_C", { len: 20, dia: 6 }), fx("nut", joints.map((p): Vec3 => [p[0], p[1], -BEAM_D / 2]), [0, 0, -1], "BEAM_C", { dia: 10 })],
      tools: ["allen"],
    },
    { title: "Turn the beam over and fit the columns", detail: "Push one column into the bracket at each end, the flat side to the end.", add: cols },
    { title: "Screw the columns to the beam", detail: "Four screws for each, two through each side of the beam end.", fix: [...colScrews(-1, 0), ...colScrews(1, 1)], tools: ["allen"] },
    { title: "Screw on the end brackets", detail: "One across each end of the beam, two screws each. Their curved edges face out.", add: brackets, fix: [brScrews(-1, 0), brScrews(1, 1)], tools: ["allen"] },
    {
      title: "Lay the frame on the top and bolt it on",
      detail: "Put the top face down on the rug, lay the frame on it columns up and line up the holes. Four bolts through each bracket.",
      add: ["TOP"],
      fix: [topBolts(-1, 0), topBolts(1, 1)],
      tools: ["allen"],
      from: { TOP: [0, -260, 0] },
    },
    { title: "Slide the A legs over the columns", detail: "Pick the height first: the same hole on both legs. The legs only go on one way round.", add: legs, from: { LEG_L: [0, -300, 0], LEG_R: [0, -300, 0] } },
    {
      title: "Bolt the legs at that height",
      detail: "A washer on each bolt, two through each leg into its column. Tighten them firmly.",
      fix: [-1, 1].flatMap((sx, i) =>
        [-1, 1].flatMap((sz) => {
          const p: Vec3 = [sx * xc, 300, sz * (COL / 2 + 6)];
          return [fx("washer", [p], [0, 0, -sz], legs[i], { dia: 16 }), fx("bolt", [p], [0, 0, -sz], legs[i], { len: 20, dia: 8, mate: cols[i] })];
        }),
      ),
      tools: ["allen"],
    },
    { title: "Screw a foot into each end of the legs", detail: "Turn them in by hand until they stop.", fix: [fx("foot", feet, [0, 1, 0], undefined, { dia: 56, len: 20 })] },
    {
      title: "Clip the cable net under the top",
      detail: "Push the six holders into the holes behind the beam, hook the net on and knock in the six pins.",
      add: ["NET"],
      fix: [fx("clip", netPts, [0, 1, 0], "NET", { name: "Net holder", mate: "TOP" }), fx("nail", netPts.map((p): Vec3 => [p[0] + 25, p[1], p[2]]), [0, 1, 0], "NET", { name: "Pin", len: 14, dia: 5, mate: "TOP" })],
      tools: ["hammer"],
    },
    { title: "Turn the desk over and level it", detail: "Lift it together onto its feet. Turn the feet to stop it rocking.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

// ---------- the sit/stand underframe with motors ----------

function sitStand(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const yU = H; // underside of the top, at the lowest height
  const yB = yU - BEAM_H / 2;
  const xc = W / 2 - 130;
  const xe = xc + 40;
  const xj = 320;
  const CD = 70; // the motor columns
  const parts: CustomPart[] = [
    { id: "BEAM_L", name: "Beam end", size: [xe - xj, BEAM_H - 4, BEAM_D - 6], pos: [-(xe + xj) / 2, yB, 0], material: "metal" },
    { id: "BEAM_C", name: "Beam centre", size: [2 * xj, BEAM_H, BEAM_D], pos: [0, yB, 0], material: "metal" },
    { id: "BEAM_R", name: "Beam end", size: [xe - xj, BEAM_H - 4, BEAM_D - 6], pos: [(xe + xj) / 2, yB, 0], material: "metal" },
  ];
  const cols = ["COL_L", "COL_R"], brackets = ["BR_L", "BR_R"], legs = ["LEG_L", "LEG_R"];
  const yS1 = 360; // the top of the A legs' sleeves
  const colY0 = yS1 - 60, colY1 = yB - BEAM_H / 2;
  [-1, 1].forEach((sx, i) =>
    parts.push({
      id: cols[i],
      name: "Motor column",
      size: [CD + 10, colY1 - colY0, CD + 10],
      pos: [sx * xc, (colY0 + colY1) / 2, 0],
      material: "metal",
      // the column steps in where its inner tube comes out
      pieces: [
        { shape: "cyl", size: [CD + 10, (colY1 - colY0) * 0.55, CD + 10], pos: [0, -(colY1 - colY0) * 0.225, 0] },
        { shape: "cyl", size: [CD, (colY1 - colY0) * 0.45, CD], pos: [0, (colY1 - colY0) * 0.275, 0] },
      ],
    }),
  );
  const brD = D - 120;
  [-1, 1].forEach((sx, i) => parts.push({ id: brackets[i], name: "End bracket", size: [40, 12, brD], pos: [sx * (xe + 20), yU - 6, 0], material: "metal" }));
  // each A leg: a sleeve round the column's foot, two struts down to the feet and a bar across low down
  const zFoot = D / 2 - 60, yBar = 120;
  const ang = Math.atan2(zFoot, yS1 - 20);
  const strutLen = Math.hypot(zFoot, yS1 - 20);
  const legC: Vec3 = [0, (yS1 + 15) / 2, 0];
  const legPieces: PartPiece[] = [
    { shape: "cyl", size: [CD + 24, 120, CD + 24], pos: [0, yS1 - 60 - legC[1], 0] },
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [40, strutLen, 40], pos: [0, (yS1 + 20) / 2 - legC[1], (sz * zFoot) / 2], rot: [-sz * ang, 0, 0] })),
    { shape: "box", size: [32, 32, 2 * zFoot * ((yS1 - yBar) / (yS1 - 20))], pos: [0, yBar - legC[1], 0] },
  ];
  [-1, 1].forEach((sx, i) => parts.push({ id: legs[i], name: "A leg", size: [64, yS1 - 15, 2 * zFoot + 60], pos: [sx * xc, legC[1], 0], pieces: legPieces, material: "metal" }));
  const TW = 1600, TD = 800;
  parts.push({ id: "TOP", name: "Table top", size: [TW, TOP_T, TD], pos: [0, yU + TOP_T / 2, 0], material: "board", extra: true });
  const netW = 2 * xc - 300, netD = 200, netH = 60, zNet = -(BEAM_D / 2 + 30 + netD / 2);
  parts.push({
    id: "NET",
    name: "Cable net",
    size: [netW, netH, netD],
    pos: [0, yU - netH / 2, zNet],
    pieces: [
      { shape: "box", size: [netW, 3, netD], pos: [0, -netH / 2 + 1.5, 0] },
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [netW, netH, 3], pos: [0, 0, (sz * (netD - 3)) / 2] })),
    ],
    material: "metal",
  });
  const joints = [-1, 1].flatMap((j) => [j * (xj - 40), j * (xj + 40)].flatMap((x) => [yB - 10, yB + 10].map((y): Vec3 => [x, y, BEAM_D / 2])));
  const colBolts = (sx: number, i: number) =>
    [-1, 1].map((sz) => fx("bolt", [xc - 20, xc + 20].map((x): Vec3 => [sx * x, yB, sz * (BEAM_D / 2 - 3)]), [0, 0, -sz], i ? "BEAM_R" : "BEAM_L", { len: 12, dia: 6, mate: cols[i] }));
  const netPts = [-0.4, 0, 0.4].flatMap((t) => [-1, 1].map((sz): Vec3 => [t * netW, yU, zNet + (sz * (netD - 10)) / 2]));
  const feet = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xc, 0, sz * zFoot]));
  const steps: CustomStep[] = [
    { title: "Slide the beam together", detail: "On a rug, upside down. Push the two ends into the middle section.", add: ["BEAM_C", "BEAM_L", "BEAM_R"], from: { BEAM_L: [-260, 0, 0], BEAM_R: [260, 0, 0] }, pose: "-y", warnings: ["floor"] },
    {
      title: "Bolt it at the length for the top",
      detail: "Eight bolts through the joints, each with a nut inside. The holes for a 160 x 80 top are the outer ones; a 120 x 70 top takes four.",
      fix: [fx("bolt", joints, [0, 0, -1], "BEAM_C", { len: 16, dia: 6 }), fx("nut", joints.map((p): Vec3 => [p[0], p[1], -BEAM_D / 2]), [0, 0, -1], "BEAM_C", { dia: 10 })],
      tools: ["allen"],
    },
    { title: "Push the motor columns into the beam ends", detail: "Turn the beam the other way up first. Each column's bracket slides into an end, the cable side to the back.", add: cols, from: { COL_L: [-260, 0, 0], COL_R: [260, 0, 0] } },
    { title: "Bolt the columns to the beam", detail: "Four bolts for each, two through each side of the beam end.", fix: [...colBolts(-1, 0), ...colBolts(1, 1)], tools: ["allen"] },
    {
      title: "Screw on the end brackets",
      detail: "One across each end of the beam, two screws each.",
      add: brackets,
      fix: [-1, 1].map((sx, i) => fx("screw", [-20, 20].map((z): Vec3 => [sx * (xe + 20), yU, z]), [0, -1, 0], brackets[i], { len: 10, dia: 6, mate: i ? "BEAM_R" : "BEAM_L" })),
      tools: ["screwdriver"],
    },
    { title: "Push the A legs onto the columns", detail: "Over the end of each column as far as they go.", add: legs, from: { LEG_L: [0, -300, 0], LEG_R: [0, -300, 0] } },
    {
      title: "Bolt each leg to its column",
      detail: "Two bolts in each, through the top of the leg's sleeve.",
      fix: [-1, 1].map((sx, i) => fx("bolt", [-15, 15].map((x): Vec3 => [sx * xc + x, yS1 - 120, 0]), [0, 1, 0], legs[i], { len: 16, dia: 8, mate: cols[i] })),
      tools: ["allen"],
    },
    { title: "Screw in the feet and turn it over", detail: "One foot into each end of the legs, by hand. Then turn the frame onto its feet together.", fix: [fx("foot", feet, [0, 1, 0], undefined, { dia: 60, len: 20 })], people: 2, warnings: ["two"] },
    {
      title: "Plug the motor cables into the control box",
      detail: "Each column's cable into its socket in the control box in the beam, until it clicks.",
      fix: [fx("connector", [-1, 1].map((sx): Vec3 => [sx * 120, yB, -BEAM_D / 2]), [0, 0, 1], "BEAM_C", { name: "Motor cable", len: 20, dia: 12 })],
      pose: "+y",
    },
    { title: "Plug in the power supply", detail: "Its cable into the control box, then clip the box's cover shut. Use the plug for your country.", fix: [fx("connector", [[0, yB, -BEAM_D / 2]], [0, 0, 1], "BEAM_C", { name: "Power supply", len: 40, dia: 30 })] },
    { title: "Clip the cable into the beam", detail: "Press it into the clips along the beam so nothing hangs loose." },
    {
      title: "Fit the cable net under the top",
      detail: "Lay the top face down on a rug. Push in the six holders, hook the net on and tap in the six pins.",
      fix: [fx("clip", netPts, [0, 1, 0], "NET", { name: "Net holder", mate: "TOP" }), fx("nail", netPts.map((p): Vec3 => [p[0] + 25, p[1], p[2]]), [0, 1, 0], "NET", { name: "Pin", len: 14, dia: 5, mate: "TOP" })],
      wait: ["TOP", "NET"],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Raise the frame a little", detail: "Plug it into the wall and press the up switch on the control cable until the columns rise." },
    { title: "Lay the top on the frame", detail: "Face up, centred on the end brackets. Lift it together.", add: ["TOP", "NET"], from: { TOP: [0, 300, 0], NET: [0, 300, 0] }, people: 2, warnings: ["two"] },
    {
      title: "Screw the top to the end brackets",
      detail: "Four screws up through each bracket.",
      fix: [-1, 1].map((sx, i) => fx("screw", [-1, 1].flatMap((sz) => [brD / 2 - 30, brD / 2 - 90].map((z): Vec3 => [sx * (xe + 20), yU - 12, sz * z])), [0, 1, 0], brackets[i], { len: 20, dia: 6, mate: "TOP" })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the control panel under the front edge",
      detail: "Two wood screws, where your right hand falls.",
      fix: [
        fx("connector", [[W / 2 - 300, yU, TD / 2 - 60]], [0, 1, 0], "TOP", { name: "Control panel", len: 25, dia: 60 }),
        fx("screw", [[W / 2 - 320, yU - 20, TD / 2 - 60], [W / 2 - 280, yU - 20, TD / 2 - 60]], [0, 1, 0], undefined, { len: 30, dia: 4, name: "Wood screw", mate: "TOP" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Reset it and level the feet", detail: "Hold the down switch until it stops at the bottom and jogs. Then turn the feet so it stands steady. It takes 75 kg at most." },
  ];
  return { parts, steps };
}

// ---------- the cabinet with sliding glass doors ----------

/** A glass door: a slim steel frame round a pane, built where it hangs. */
function glassDoor(id: string, x0: number, x1: number, y0: number, y1: number, z: number): CustomPart {
  const w = x1 - x0, h = y1 - y0, f = 30, t = 18;
  return {
    id,
    name: "Glass door",
    size: [w, h, t],
    pos: [(x0 + x1) / 2, (y0 + y1) / 2, z],
    material: "glass",
    pieces: [
      { shape: "box", size: [w - 2 * f, h - 2 * f, 5], pos: [0, 0, 0] },
      { shape: "box", size: [w, f, t], pos: [0, h / 2 - f / 2, 0], material: "metal" },
      { shape: "box", size: [w, f, t], pos: [0, -h / 2 + f / 2, 0], material: "metal" },
      { shape: "box", size: [f, h - 2 * f, t], pos: [-w / 2 + f / 2, 0, 0], material: "metal" },
      { shape: "box", size: [f, h - 2 * f, t], pos: [w / 2 - f / 2, 0, 0], material: "metal" },
    ],
  };
}

function cabinet(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const LEG = 100, ST = 20; // legs, steel panels
  const yB = LEG + 40; // top of the base rails
  const xs = W / 2 - ST / 2;
  const legFrame = (id: string, z: number): CustomPart => ({
    id,
    name: "Leg frame",
    size: [W, yB, 30],
    pos: [0, yB / 2, z],
    material: "metal",
    pieces: [
      { shape: "box", size: [W - 60, 40, 30], pos: [0, yB / 2 - 20, 0] },
      ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [30, yB, 30], pos: [g * (W / 2 - 15), 0, 0] })),
    ],
  });
  const shelfYs = [0.3, 0.52, 0.74].map((f) => Math.round(yB + f * (H - yB)));
  const yD0 = yB + 25, yD1 = H - 30; // the doors
  const parts: CustomPart[] = [
    legFrame("FL", D / 2 - 15),
    ...[-1, 1].map((g, i): CustomPart => ({ id: i ? "SR" : "SL", name: "Side panel", size: [ST, H - ST - LEG, D], pos: [g * xs, (LEG + H - ST) / 2, 0], material: "metal" })),
    legFrame("BL", -D / 2 + 15),
    { id: "TOP", name: "Top", size: [W, ST, D], pos: [0, H - ST / 2, 0], material: "metal" },
    ...[-1, 1].map((g, i): CustomPart => ({ id: i ? "BK2" : "BK1", name: "Back panel", size: [W / 2 - ST, H - ST - yB, 3], pos: [(g * W) / 4 - g * (ST / 2), (yB + H - ST) / 2, -D / 2 + 3], material: "metal" })),
    { id: "FLR", name: "Floor panel", size: [W - 2 * ST, 20, D - 40], pos: [0, yB + 10, 0], material: "metal" },
    ...shelfYs.map((y, i): CustomPart => ({ id: `SH${i + 1}`, name: "Shelf", size: [W - 2 * ST - 6, 20, D - 90], pos: [0, y + 10, -20], material: "metal" })),
    glassDoor("D1", -W / 2 + ST, 30, yD0, yD1, D / 2 - 45),
    glassDoor("D2", -30, W / 2 - ST, yD0, yD1, D / 2 - 15),
  ];
  const sides = ["SL", "SR"];
  const both = [-1, 1];
  const steps: CustomStep[] = [
    { title: "Click a side panel onto the front leg frame", detail: "On a rug. Hook the panel's bottom corner over the leg and press until it clicks.", add: ["FL", "SL"], from: { SL: [0, 300, 0] }, warnings: ["floor"] },
    { title: "Click on the other side panel", detail: "The same way at the other end of the frame.", add: ["SR"], from: { SR: [0, 300, 0] } },
    { title: "Click in the back leg frame", detail: "Push it onto the back corners of both sides until both ends click. The rail goes at the bottom.", add: ["BL"], from: { BL: [0, 0, -300] } },
    { title: "Press the top on", detail: "Lower it onto the sides and press down at all four corners until they click.", add: ["TOP"], from: { TOP: [0, 300, 0] }, people: 2, warnings: ["two"] },
    {
      title: "Push in the four rivets",
      detail: "Through the bottom of each side into the leg frames, two each side.",
      fix: sides.map((id, i) => fx("clip", both.map((sz): Vec3 => [both[i] * (W / 2 - ST), LEG + 20, sz * (D / 2 - 15)]), [both[i], 0, 0], id, { name: "Plastic rivet", len: 14, dia: 8 })),
    },
    { title: "Slide in the right back panel", detail: "Into the grooves at the back, its edge into the side's slot.", add: ["BK2"], from: { BK2: [0, 0, -300] } },
    { title: "Slide in the left back panel", detail: "The same on the other side, until the two halves meet.", add: ["BK1"], from: { BK1: [0, 0, -300] } },
    { title: "Press the back panels up under the top", detail: "Push the top edge into the rail under the top at four places." },
    { title: "Hook the backs to the top rail", detail: "Bend the two tabs in the middle over the rail." },
    { title: "Hook the outer corners", detail: "The two tabs at the ends, the same way." },
    { title: "Drop in the floor panel", detail: "Lay it on the base rails and press it down at the back until both sides click.", add: ["FLR"], from: { FLR: [0, 0, 400] } },
    {
      title: "Fit the cable grommets",
      detail: "The round one into the hole in the floor panel, the two oval ones into the holes in the back.",
      fix: [
        fx("cap", [[W / 4, yB + 20, -D / 2 + 80]], [0, -1, 0], "FLR", { name: "Round grommet", len: 6, dia: 60 }),
        fx("cap", both.map((g): Vec3 => [(g * W) / 4, H - 200, -D / 2 + 1]), [0, 0, -1], undefined, { name: "Oval grommet", len: 6, dia: 50 }),
      ],
    },
    {
      title: "Fit the wall fittings on the back",
      detail: "Clip a fitting into each hole at the top of the back. If it won't go on a wall, push the two caps into the holes instead.",
      fix: [fx("bracket", both.map((g): Vec3 => [g * (W / 2 - 100), H - 70, -D / 2]), [0, 0, 1], "TOP", { name: "Wall fitting", len: 10, dia: 40 })],
    },
    { title: "Stand it against the wall and level it", detail: "Turn the feet under the legs until it stands level and the doors will run true.", warnings: ["tip"] },
    {
      title: "Screw it to the wall",
      detail: "Mark through the fittings, drill, then one screw in each. Plugs and screws for your wall are not included.",
      fix: [
        fx("plug", both.map((g): Vec3 => [g * (W / 2 - 100), H - 70, -D / 2 - 10]), [0, 0, -1], undefined, { len: 40, dia: 8 }),
        fx("screw", both.map((g): Vec3 => [g * (W / 2 - 100), H - 70, -D / 2 + 2]), [0, 0, -1], undefined, { len: 50, dia: 5 }),
      ],
      wall: true,
      warnings: ["wall", "tip"],
      tools: ["drill", "screwdriver"],
    },
    {
      title: "Hook in the shelf clips",
      detail: "Twelve clips, four for each shelf at the same height on both sides.",
      fix: sides.map((id, i) => fx("pin", shelfYs.flatMap((y) => [-D / 2 + 60, D / 2 - 110].map((z): Vec3 => [both[i] * (W / 2 - ST), y - 5, z])), [both[i], 0, 0], id, { name: "Shelf clip", len: 16, dia: 6 })),
    },
    { title: "Lay in the three shelves", detail: "Tilt each one in and rest it on its four clips.", add: shelfYs.map((_, i) => `SH${i + 1}`), from: Object.fromEntries(shelfYs.map((_, i) => [`SH${i + 1}`, [0, 0, 400] as Vec3])) },
    {
      title: "Screw a guide onto each door",
      detail: "Lay the doors on a rug. One guide on the top of each, one screw.",
      fix: [
        fx("clip", [[-W / 4, yD1, D / 2 - 45], [W / 4, yD1, D / 2 - 15]], [0, -1, 0], undefined, { name: "Door guide", len: 10, dia: 30 }),
        fx("screw", [[-W / 4, yD1 + 4, D / 2 - 45]], [0, -1, 0], "D1", { len: 14, dia: 4 }),
        fx("screw", [[W / 4, yD1 + 4, D / 2 - 15]], [0, -1, 0], "D2", { len: 14, dia: 4 }),
      ],
      wait: ["D1", "D2"],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Unlock the rollers", detail: "Slide the four roller catches at the bottom of the doors to open." },
    {
      title: "Hang the doors",
      detail: "Top first into the top track, then lower the rollers into the bottom track. The back one first.",
      add: ["D1", "D2"],
      from: { D1: [0, 0, 300], D2: [0, 0, 300] },
      people: 2,
      warnings: ["two"],
    },
    { title: "Lock the rollers", detail: "Push the catches up on both doors until they click." },
    { title: "Slide the doors to check", detail: "They should run the full width and click shut at the ends." },
  ];
  return { parts, steps };
}

// ---------- the drawer unit on castors ----------

const SHELL = 18; // side shells
const CAST_H = 60;
const SMALL_SCREW: HwDef = { kind: "screw", len: 8, dia: 4 };
const PAN_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };

function unitDims(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xi = W / 2 - SHELL; // inside of the shells
  const trayY = H - 110;
  const fw = 2 * xi - 4; // drawer fronts sit between the shells
  const zf = D / 2 - 10; // front faces' centre
  const dd = D - 70; // drawer box depth
  const dw = 2 * xi - 26; // drawer box width, runners either side
  const drawers = [
    { key: "S", y0: trayY - 125, fh: 115, bh: 90 },
    { key: "F", y0: CAST_H + 20, fh: trayY - 125 - CAST_H - 25, bh: trayY - 125 - CAST_H - 70 },
  ];
  return { W, H, D, xi, trayY, fw, zf, dd, dw, drawers };
}

function carcass(s: ProductSpec): CustomParams {
  const { W, H, D, xi, trayY, drawers } = unitDims(s);
  const parts: CustomPart[] = [
    { id: "BASE", name: "Bottom frame", size: [2 * xi, 25, D - 20], pos: [0, CAST_H + 12.5, 0], material: "metal" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `POST${i}`, name: "Rear post", size: [20, trayY - CAST_H - 25, 20], pos: [sx * (xi - 10), (CAST_H + 25 + trayY) / 2, -(D / 2 - 40)], material: "metal" })),
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `SIDE${i}`, name: "Side shell", size: [SHELL, H - CAST_H, D], pos: [sx * (W / 2 - SHELL / 2), (CAST_H + H) / 2, 0], material: "metal" })),
    { id: "RAIL_F", name: "Top rail", size: [2 * xi, 40, 20], pos: [0, H - 20, D / 2 - 10], material: "metal" },
    { id: "RAIL_B", name: "Top rail", size: [2 * xi, 40, 20], pos: [0, H - 20, -(D / 2 - 10)], material: "metal" },
    { id: "TRAY", name: "Tray floor", size: [2 * xi, 15, D - 40], pos: [0, trayY, 0], material: "metal" },
    { id: "BACK", name: "Back panel", size: [2 * xi, trayY - 7.5 - CAST_H - 25, 6], pos: [0, (trayY - 7.5 + CAST_H + 25) / 2, -(D / 2 - 6)], material: "metal" },
  ];
  const sides = ["SIDE0", "SIDE1"];
  const shellScrews = (y: number, z: number) => [-1, 1].map((sx, i) => fx("screw", [[sx * (W / 2 - SHELL), y, z]], [sx, 0, 0], undefined, { ...SMALL_SCREW, mate: sides[i] }));
  const panScrews = (y: number, z: number) => [-1, 1].map((sx, i) => fx("screw", [[sx * (W / 2 - SHELL), y, z]], [sx, 0, 0], undefined, { ...PAN_SCREW, mate: sides[i] }));
  const runnerAt = (sx: number, y: number): Vec3 => [sx * (xi - 6), y, 0];
  const runners = (sx: number, i: number) => [
    fx("runner", drawers.map((d) => runnerAt(sx, d.y0 + 10)), [0, 1, 0], sides[i], { len: D - 70, dia: 40 }),
    fx("screw", drawers.flatMap((d) => [-1, 1].map((sz): Vec3 => [sx * xi, d.y0 + 20, sz * (D / 2 - 60)])), [sx, 0, 0], sides[i], { len: 10, dia: 5 }),
  ];
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (xi - 35), CAST_H, sz * (D / 2 - 45)]));
  const steps: CustomStep[] = [
    {
      title: "Click the rear posts into the bottom frame",
      detail: "Lay the frame on a rug. Each post clicks into a back corner.",
      add: ["BASE", "POST0", "POST1"],
      warnings: ["floor"],
    },
    { title: "Click a side shell onto the frame", detail: "Lower it over the frame's edge until both pegs click into place.", add: ["SIDE0"], from: { SIDE0: [0, 300, 0] } },
    { title: "Lower the other side shell on", detail: "The same way, on the other side.", add: ["SIDE1"], from: { SIDE1: [0, 300, 0] } },
    { title: "Screw the shells to the posts", detail: "One small screw at the top of each post, then bend the two tabs at the bottom over.", fix: shellScrews(trayY - 40, -(D / 2 - 40)), tools: ["screwdriver"] },
    { title: "Fit the front top rail", detail: "Hook it in under the top edge and swing it up into place.", add: ["RAIL_F"] },
    { title: "Screw it to the shells", detail: "One screw at each end.", fix: panScrews(H - 20, D / 2 - 10), tools: ["screwdriver"] },
    { title: "Drop in the back top rail and screw it", detail: "One small screw at each end.", add: ["RAIL_B"], fix: shellScrews(H - 20, -(D / 2 - 10)), tools: ["screwdriver"] },
    { title: "Fit the tray floor", detail: "Slide it in at the back, under the top rails, and swing the front up.", add: ["TRAY"] },
    { title: "Screw the tray floor in", detail: "One screw through each shell.", fix: panScrews(trayY, 0), tools: ["screwdriver"] },
    { title: "Lay it on its back and screw on the left runners", detail: "Both runners on this side, two screws each, wheels at the front.", fix: runners(-1, 0), pose: "+z" },
    { title: "Screw on the right runners", detail: "The same on the other side. The runners are marked left and right.", fix: runners(1, 1) },
    { title: "Turn it upside down and screw in the castor plates", detail: "One screw in each corner of the bottom frame.", fix: [fx("screw", corners.map((p): Vec3 => [p[0] + 20, p[1], p[2]]), [0, 1, 0], "BASE", PAN_SCREW)], pose: "-y", tools: ["screwdriver"] },
    { title: "Screw in the castors", detail: "Turn each one in by hand, then tighten with the spanner.", fix: [fx("castor", corners, [0, 1, 0], "BASE", { len: CAST_H, dia: 50 })], tools: ["wrench"] },
    { title: "Slide in the back panel", detail: "Down the grooves at the back of the shells, as far as the tray floor.", add: ["BACK"], from: { BACK: [0, -320, 0] } },
    { title: "Press in the four rivets", detail: "Through the back panel into the posts, two each side.", fix: [fx("clip", [-1, 1].flatMap((sx) => [0.3, 0.75].map((t): Vec3 => [sx * (xi - 10), CAST_H + 25 + t * (trayY - CAST_H - 25), -(D / 2)])), [0, 0, 1], "BACK", { name: "Plastic rivet", len: 14, dia: 8 })] },
  ];
  return { parts, steps };
}

/** One drawer, built on its front in its own scene, then left to slide in with the other one at the end. */
function unitDrawer(b: PlanBuilder, s: ProductSpec, d: ReturnType<typeof unitDims>["drawers"][number], file: boolean) {
  const { D, fw, zf, dd, dw } = unitDims(s);
  const scene = file ? "file" : "drawer";
  const zb = zf - 10; // back of the front
  const yb = d.y0 + 25; // underside of the box
  const front = b.place(b.part("Drawer front", [fw, d.fh, 20]), [0, d.y0 + d.fh / 2, zf]);
  const sideT = b.part(file ? "File drawer side" : "Drawer side", [10, d.bh, dd], { material: "metal" });
  const sides = [-1, 1].map((g) => b.place(sideT, [g * (dw / 2 - 5), yb + d.bh / 2, zb - dd / 2]));
  const back = b.place(b.part(file ? "File drawer back" : "Drawer back", [dw - 20, d.bh, 10], { material: "metal" }), [0, yb + d.bh / 2, zb - dd + 5]);
  const bottom = b.place(b.part(file ? "File drawer bottom" : "Drawer bottom", [dw - 20, 6, dd - 10], { material: "metal" }), [0, yb + 3, zb - dd / 2 - 5]);
  const wheel = file ? b.place(b.part("Support wheel", [40, 45, 40], { material: "metal" }), [0, yb - 22.5, zb - dd + 40]) : undefined;
  const all = [front, ...sides, back, bottom, ...(wheel ? [wheel] : [])];
  const c0: Vec3 = [0, yb + d.bh / 2, zb - dd / 2];
  const stage = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
  };
  const st = (title: string, detail: string, body: () => void, o: { tools?: ("screwdriver" | "wrench")[]; pose?: "-z" | "-y" | "+z" } = {}) =>
    b.step({ title, detail, tools: o.tools, scene, pose: o.pose ?? "+z", kind: "drawer" }, body);
  const tabs = file ? 6 : 4;
  const boxScrews: FitOpts[] = [-1, 1].flatMap((g) => Array.from({ length: tabs / 2 }, (_, k) => ({ on: sides[g < 0 ? 0 : 1], at: [g * (dw / 2 - 10), yb + ((k + 1) * d.bh) / (tabs / 2 + 1), zb] as Vec3, dir: [0, 0, 1] as Vec3, mate: front })));
  // each coupling is held by two short screws from below, through its plate into the drawer bottom
  const couplings: FitOpts[] = [-1, 1].map((g) => ({ on: bottom, at: [g * (dw / 2 - 30), yb, zb - 80], dir: [0, 1, 0], hole: false }));
  const couplingScrews: FitOpts[] = [-1, 1].flatMap((g) => [-24, 24].map((dz): FitOpts => ({ on: bottom, at: [g * (dw / 2 - 30), yb - 10, zb - 80 + dz], dir: [0, 1, 0] })));
  const name = file ? "the file drawer" : "the small drawer";

  st(`Hook a side onto the back of ${name}`, "Slide the hooks on the side's edge into the slots in the back and push it down.", () => {
    stage(back, [0, 0, -200]);
    b.then(0.1);
    stage(sides[0], [-200, 0, 0]);
  });
  st("Hook on the other side and turn it round", "The same at the other end of the back, so the three sheets make a U.", () => stage(sides[1], [200, 0, 0]));
  st("Drop the bottom in", "From the open front, down onto the ledges inside.", () => stage(bottom, [0, 220, 0]));
  st(`Press the ${tabs} tabs down`, "Push each tab under the bottom's edge so it can't lift.", () => b.wait(0.4));
  st("Set the box on the front", "Lay the front face down on the rug and stand the box on it, inside the rim.", () => stage(front, [0, 0, 200]), { pose: "-z" });
  st("Screw the box to the front", `${tabs} small screws through the box's flanges into the front.`, () => b.fits(SMALL_SCREW, boxScrews, 0.08), { tools: ["screwdriver"], pose: "-z" });
  st("Screw on the runner couplings", "Turn the drawer upside down. One under each front corner, the left and right ones are marked.", () => {
    b.fits({ kind: "clip", len: 40, dia: 30, name: "Runner coupling" }, couplings, 0.15);
    b.then(0.1);
    b.fits({ kind: "screw", len: 14, dia: 4 }, couplingScrews, 0.1);
  }, { tools: ["screwdriver"], pose: "-y" });
  st("Clip in the label holder", "Window first, then the card and the frame, pressed into the square hole in the front.", () => b.fit({ kind: "clip", len: 6, dia: 40, name: "Label holder" }, { on: front, at: [-fw / 2 + 50, d.y0 + d.fh - 45, zf + 10], dir: [0, 0, -1], hole: false }), { pose: "+z" });
  st("Screw on the handle", "Two screws from inside the front.", () => {
    b.fit(HW.handle, { on: front, at: [40, d.y0 + d.fh - 45, zf + 10], dir: [0, 0, -1], hole: false });
    b.then(0.1);
    b.fits({ kind: "screw", len: 10, dia: 4 }, [-50, 130].map((x): FitOpts => ({ on: front, at: [x, d.y0 + d.fh - 45, zf - 10], dir: [0, 0, 1] })), 0.1);
  }, { tools: ["screwdriver"], pose: "+z" });
  if (wheel)
    st("Screw the support wheel under the back", "Turn the drawer over again. Two screws through its plate into the bottom.", () => {
      stage(wheel, [0, -160, 0]);
      b.then(0.1);
      b.fits(PAN_SCREW, [-12, 12].map((x): FitOpts => ({ on: wheel, at: [x, yb - 6, zb - dd + 40], dir: [0, 1, 0], mate: bottom })), 0.1);
    }, { tools: ["screwdriver"], pose: "-y" });
  void D;
  return all;
}

function buildUnit(b: PlanBuilder, s: ProductSpec) {
  buildCustom(b, { ...s, custom: carcass(s) });
  const dims = unitDims(s);
  const file = unitDrawer(b, s, dims.drawers[1], true);
  const small = unitDrawer(b, s, dims.drawers[0], false);
  b.step({ title: "Slide the drawers onto the runners", detail: "Pull the runners out, set each drawer on them and push it in until the couplings click. The deep one goes at the bottom.", kind: "drawer", pose: "+y" }, () => {
    for (const set of [file, small]) {
      b.stagger(0);
      for (const k of set) b.add(k, [0, 0, 420]);
      b.wait(0.25);
    }
  });
}

const family: Family = {
  names: ["IDÅSEN", "IDASEN"],
  recipe(s) {
    if (/sliding glass doors/i.test(s.variant)) return cabinet(s);
    if (/^underframe sit\/stand/i.test(s.variant)) return sitStand(s);
    if (s.archetype !== "table" || !/desk/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    // the sit/stand desk with a motor has its own manual
    if (/sit|stand|electric/i.test(s.variant)) return null;
    return desk(s);
  },
  build(b, s) {
    if (!/drawer unit/i.test(`${s.variant} ${s.slug?.replace(/-/g, " ") ?? ""}`)) return false;
    buildUnit(b, s);
    return true;
  },
};
export default family;
