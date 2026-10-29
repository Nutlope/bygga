import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BÅRSLÖV, read from its manuals.
 * The 3-seat sofa-bed starts with its pull-out bed frame: two end pieces, a rail, slats, the other rail, corner
 * plates and bolts, then four feet. The upholstered base gets its lift arms and is emptied, the backrest is bolted
 * on with one long bolt and two angle brackets, the back gets two feet, and the bed frame is lowered in and screwed.
 * Pulled out once, its hooks and the seat deck go on; the armrests hang on studs with wing nuts, then the cushions.
 * The version with a chaise longue joins two seat bases with wing bolts, gives the chaise box its feet, catch and
 * lid strap, hangs the armrests on, bolts the backrest between them, fixes the chaise to the end, and slides the
 * pull-out bed on its castors in under the seat. Its manual builds the chaise on either side; this guide has it left.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const soft = (id: string, name: string, size: Vec3, pos: Vec3, extra: Partial<CustomPart> = {}): CustomPart => ({ id, name, size, pos, material: "soft", ...extra });
const AW = 185; // armrest

function armrests(W: number, D: number, y0: number, h: number, z0: number): CustomPart[] {
  return [-1, 1].map((sx, i) => soft(`A${i + 1}`, "Armrest", [AW, h, D], [sx * (W / 2 - AW / 2), y0 + h / 2, z0]));
}

function backCushions(Wi: number, y0: number, z: number): CustomPart[] {
  const w = Wi / 3 - 10;
  return [-1, 0, 1].map((k, i) => soft(`Q${i + 1}`, "Back cushion", [w, 420, 170], [k * (w + 10), y0 + 210, z], { rot: [-0.12, 0, 0] }));
}

function sofaBed(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const Wi = W - 2 * AW;
  const zb = -D / 2, zf = D / 2; // back, front
  const kd = 200; // backrest depth
  const ft = 60; // feet
  const yB = 380; // top of the base
  const parts: CustomPart[] = [];
  // the pull-out bed frame, inside the base
  const fh = 200, fz0 = zb + kd + 40, fz1 = zf - 40, fd = fz1 - fz0, fzc = (fz0 + fz1) / 2;
  const fw = Wi - 80;
  const fy = ft + fh / 2;
  parts.push(
    { id: "E1", name: "Bed frame end", size: [40, fh, fd], pos: [-fw / 2 + 20, fy, fzc], material: "wood" },
    { id: "E2", name: "Bed frame end", size: [40, fh, fd], pos: [fw / 2 - 20, fy, fzc], material: "wood" },
    { id: "R1", name: "Bed frame rail", size: [fw - 80, 80, 30], pos: [0, ft + fh - 40, fz0 + 15], material: "wood" },
    { id: "R2", name: "Bed frame rail", size: [fw - 80, 80, 30], pos: [0, ft + fh - 40, fz1 - 15], material: "wood" },
  );
  const slatX = [-0.3, -0.1, 0.1, 0.3].map((f) => f * fw);
  slatX.forEach((x, i) => parts.push({ id: `S${i + 1}`, name: "Slat", size: [50, 20, fd - 60], pos: [x, ft + fh - 10, fzc], material: "wood" }));
  // the upholstered base round it: front, back and two ends
  const bh = yB - ft;
  const bz0 = zb + kd, bzc = (bz0 + zf) / 2, bd = zf - bz0;
  parts.push({
    id: "B",
    name: "Base",
    size: [Wi, bh, bd],
    pos: [0, ft + bh / 2, bzc],
    material: "soft",
    pieces: [
      { shape: "box", size: [Wi, bh, 30], pos: [0, 0, -bd / 2 + 15] },
      { shape: "box", size: [Wi, bh - 120, 30], pos: [0, 60, bd / 2 - 15] },
      { shape: "box", size: [30, bh, bd - 60], pos: [-Wi / 2 + 15, 0, 0] },
      { shape: "box", size: [30, bh, bd - 60], pos: [Wi / 2 - 15, 0, 0] },
    ],
  });
  const kh = 750 - yB + 40;
  parts.push(soft("K", "Backrest", [Wi, kh, kd], [0, yB - 40 + kh / 2, zb + kd / 2]));
  parts.push({ id: "P", name: "Seat deck", size: [Wi - 60, 20, bd - 40], pos: [0, yB - 10, bzc], material: "board" });
  parts.push(...armrests(W, D, 40, 550, 0));
  parts.push(soft("C", "Seat cushion", [Wi, 80, bd - 40], [0, yB + 40, bzc]));
  parts.push(...backCushions(Wi, yB + 40, zb + kd + 60));

  const ends = [-1, 1];
  const xe = fw / 2 - 20;
  const yr = ft + fh - 40; // middle of the rails
  // two screws in through each end into the end of the rail, either side of the corner bolt
  const railScrews = (z: number, rail: string): CustomFix[] =>
    ends.map((sx) => fx("screw", [[sx * (fw / 2), yr - 28, z], [sx * (fw / 2), yr + 28, z]], [-sx, 0, 0], { len: 50, dia: 6, on: sx < 0 ? "E1" : "E2", mate: rail }));
  const steps: CustomStep[] = [
    {
      title: "Stand the two bed frame ends up",
      detail: "On a rug, about the width of the sofa apart, with the hooks facing in.",
      add: ["E1", "E2"],
      warnings: ["floor"],
    },
    {
      title: "Screw the first rail onto them",
      detail: "Two screws in through each end. Check the holes face the right way before you start.",
      add: ["R1"],
      fix: railScrews(fz0 + 15, "R1"),
      tools: ["allen"],
    },
    {
      title: "Push in the slats and screw them to the rail",
      detail: "Two screws in each slat.",
      add: ["S1", "S2", "S3", "S4"],
      fix: [fx("screw", slatX.flatMap((x) => [[x - 12, ft + fh, fz0 + 15], [x + 12, ft + fh, fz0 + 15]] as Vec3[]), [0, -1, 0], { len: 30, dia: 6, on: "S1", mate: "R1" })],
      tools: ["allen"],
    },
    { title: "Turn the frame round together", detail: "Lift it by the two ends so the slats don't bend.", people: 2, warnings: ["two"] },
    {
      title: "Screw on the second rail",
      detail: "Two screws through each end and two into each slat.",
      add: ["R2"],
      fix: [
        ...railScrews(fz1 - 15, "R2"),
        fx("screw", slatX.flatMap((x) => [[x - 12, ft + fh, fz1 - 15], [x + 12, ft + fh, fz1 - 15]] as Vec3[]), [0, -1, 0], { len: 30, dia: 6, on: "R2", to: ["S1", "S2", "S3", "S4"] }),
      ],
      tools: ["allen"],
    },
    {
      title: "Bolt the corners tight",
      detail: "One plate on top of each end, then two bolts across each corner. Tighten everything now.",
      fix: [
        fx("plate", ends.map((sx) => [sx * xe, ft + fh, fzc] as Vec3), [0, -1, 0], { len: 4, dia: 80, on: "E1", to: ["E1", "E2"] }),
        ...ends.map((sx, i) => fx("bolt", [[sx * (xe + 20), yr, fz0 + 15], [sx * (xe + 20), yr, fz1 - 15]], [-sx, 0, 0], { len: 60, dia: 6, on: `E${i + 1}` })),
      ],
      tools: ["allen"],
    },
    {
      title: "Click the feet onto the bed frame",
      detail: "Four square feet at the corners, then stick a felt pad under each.",
      fix: [fx("foot", ends.flatMap((sx) => [[sx * xe, 0, fz0 + 60], [sx * xe, 0, fz1 - 60]] as Vec3[]), [0, 1, 0], { len: ft, dia: 60, name: "Foot", to: ["E1", "E2"] })],
    },
    {
      title: "Lay out the base and fit its lift arms",
      detail: "Put the base on the rug, open side up. Fit the bar and bolt on the two arms, two bolts each.",
      add: ["B"],
      fix: ends.map((sx) => fx("bolt", [[sx * (Wi / 2 - 30), ft + 150, bz0 + 120], [sx * (Wi / 2 - 30), ft + 150, bz0 + 180]], [sx, 0, 0], { len: 20, dia: 8, on: "B" })),
      tools: ["allen"],
      from: { B: [0, 0, 400] },
    },
    { title: "Take out everything packed inside the base", detail: "The cushions and loose parts come out now; keep them to one side." },
    {
      title: "Bolt the backrest to the base",
      detail: "Lay it along the back edge. One long bolt through the middle, with the long Allen key.",
      add: ["K"],
      fix: [fx("bolt", [[0, yB - 20, zb]], [0, 0, 1], { len: 150, dia: 8, on: "K", mate: "B" })],
      tools: ["allen"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw an angle bracket into each back corner",
      detail: "Two screws into the backrest, two into the base, on both sides.",
      fix: [fx("angle", ends.map((sx) => [sx * (Wi / 2 - 40), yB - 40, bz0] as Vec3), [0, 0, -1], { len: 70, dia: 40, on: "B", mate: "K" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the two back feet on",
      detail: "Under the backrest, then a felt pad under each.",
      fix: [fx("foot", ends.map((sx) => [sx * (Wi / 2 - 120), ft, zb + kd / 2] as Vec3), [0, 1, 0], { len: ft, dia: 50, name: "Back foot", on: "K" })],
      tools: ["screwdriver"],
    },
    {
      title: "Lower the bed frame into the base",
      detail: "Together. Tip it in so the hooks on its ends drop into the slots, then screw and bolt it in place.",
      // through the base's end and into the bed frame's end just inside it
      fix: ends.map((sx, i) => fx("screw", [[sx * (Wi / 2), fy, fz0 + 100], [sx * (Wi / 2), fy, fz1 - 100]], [-sx, 0, 0], { len: 50, dia: 6, on: "B", mate: `E${i + 1}` })),
      tools: ["allen"],
      people: 2,
      warnings: ["two"],
      pose: "+y",
    },
    {
      title: "Cut the ties and pull the bed out once",
      detail: "Snip the two transport ties, then pull the frame forward and check it runs freely. Hook the mechanism into its slots and screw it.",
      tools: ["screwdriver"],
    },
    {
      title: "Lay the seat deck on and click it in",
      detail: "Together, holding it by the edges. Press the four studs until they click.",
      add: ["P"],
      fix: [fx("clip", ends.flatMap((sx) => [[sx * (Wi / 2 - 100), yB, bz0 + 80], [sx * (Wi / 2 - 100), yB, zf - 80]] as Vec3[]), [0, -1, 0], { len: 12, dia: 14, name: "Stud", on: "P", mate: "B" })],
      people: 2,
    },
    {
      title: "Hang the armrests on",
      detail: "Screw three studs into each armrest by hand, push them through the base and the backrest, then fit a washer and a wing nut on each.",
      add: ["A1", "A2"],
      fix: [
        ...ends.map((sx, i) => fx("stud", [[sx * (Wi / 2), 250, -200], [sx * (Wi / 2), 250, 250], [sx * (Wi / 2), 550, zb + kd / 2]], [-sx, 0, 0], { len: 60, dia: 8, on: `A${i + 1}` })),
        ...ends.map((sx) => fx("nut", [[sx * (Wi / 2 - 30), 250, -200], [sx * (Wi / 2 - 30), 250, 250], [sx * (Wi / 2 - 30), 550, zb + kd / 2]], [sx, 0, 0], { len: 20, dia: 30, name: "Wing nut", to: ["B"] })),
      ],
      warnings: ["hand"],
    },
    { title: "Push the seat cushion in", detail: "Slide it in from the front until it meets the backrest.", add: ["C"] },
    { title: "Put the back cushions on", detail: "Shake them into shape first, then stand them against the backrest.", add: ["Q1", "Q2", "Q3"] },
  ];
  return { parts, steps };
}

function chaiseSofa(s: ProductSpec): CustomParams {
  const W = s.size.w * 10;
  const D = 1530; // IKEA: 153 cm deep with the chaise
  const Ds = 1000; // the sofa part
  const Wi = W - 2 * AW;
  const zb = -D / 2, zs = zb + Ds; // back, front of the sofa part
  const kd = 200, ft = 60;
  const yd = 260, yS = 440; // seat decks: bottom, top
  const parts: CustomPart[] = [];
  const bd = Ds - kd;
  const bzc = zb + kd + bd / 2;
  // two sprung seat decks side by side, joined with wing bolts
  parts.push(soft("B1", "Seat base", [Wi / 2, yS - yd, bd], [-Wi / 4, (yd + yS) / 2, bzc]), soft("B2", "Seat base", [Wi / 2, yS - yd, bd], [Wi / 4, (yd + yS) / 2, bzc]));
  // the chaise box in front of the left end, with its sprung lid
  const cw = 900, cx = -Wi / 2 + cw / 2;
  const cz0 = zs - 40, cd = D / 2 - cz0;
  const box: PartPiece[] = [
    { shape: "box", size: [cw, yS - ft - 60, cd], pos: [0, -30, 0] },
    { shape: "box", size: [cw, 60, cd], pos: [0, (yS - ft) / 2 - 30, 0] },
  ];
  parts.push({ id: "C", name: "Chaise longue", size: [cw, yS - ft, cd], pos: [cx, ft + (yS - ft) / 2, cz0 + cd / 2], material: "soft", pieces: box });
  parts.push(...armrests(W, Ds, ft, 560, zb + Ds / 2));
  const kh = 730 - yd;
  parts.push(soft("K", "Backrest", [Wi, kh, kd], [0, yd + kh / 2, zb + kd / 2]));
  // the pull-out bed, on castors under the right seat deck
  const pw = Wi - cw - 40, px = Wi / 2 - pw / 2 - 20, ph = yd - 40;
  parts.push({ id: "U", name: "Pull-out bed", size: [pw, ph, bd - 40], pos: [px, 20 + ph / 2, bzc], material: "soft" });
  parts.push(...backCushions(Wi, yS, zb + kd + 60));

  const ends = [-1, 1];
  const xa = Wi / 2; // armrest inner face
  const steps: CustomStep[] = [
    {
      title: "Lay the two seat bases side by side",
      detail: "Upside down on a rug, the ends with the holes facing each other.",
      add: ["B1", "B2"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Screw the wing knobs onto the bolts", detail: "Two bolts, knob turned on by hand until the thread stops.", warnings: ["hand"] },
    {
      title: "Join the seat bases with the wing bolts",
      detail: "Through both frames with a washer each side, then a wing nut. Hand tight.",
      fix: [fx("bolt", [[0, (yd + yS) / 2, bzc - 200], [0, (yd + yS) / 2, bzc + 200]], [1, 0, 0], { len: 80, dia: 8, name: "Wing bolt", on: "B1", mate: "B2" }), fx("nut", [[40, (yd + yS) / 2, bzc - 200], [40, (yd + yS) / 2, bzc + 200]], [-1, 0, 0], { len: 20, dia: 30, name: "Wing nut", on: "B2" })],
      warnings: ["hand"],
    },
    {
      title: "Open the chaise lid and tip the box on its side",
      detail: "Turn the seat bases back over first. Lift the chaise lid until it stays up, then lay the box over on the rug, away from the sofa.",
      add: ["C"],
      pose: "+y",
      from: { C: [0, 0, 900] },
    },
    {
      title: "Click the feet onto the chaise",
      detail: "Five feet, then stick a felt pad under each.",
      fix: [fx("foot", [[cx - cw / 2 + 60, ft, cz0 + 60], [cx + cw / 2 - 60, ft, cz0 + 60], [cx - cw / 2 + 60, ft, D / 2 - 60], [cx + cw / 2 - 60, ft, D / 2 - 60], [cx, ft, cz0 + cd / 2]], [0, -1, 0], { len: ft, dia: 60, name: "Foot", on: "C" })],
    },
    {
      title: "Screw the hook bracket on and stand the box up",
      detail: "Two screws. Then tip the box back onto its feet and fix the lid strap inside.",
      fix: [fx("hook", [[cx + cw / 2, 250, cz0 + 60]], [-1, 0, 0], { len: 40, dia: 20, on: "C" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw two studs into each armrest",
      detail: "By hand, into the inside face. Use the short studs here, not the long ones.",
      add: ["A1", "A2"],
      fix: ends.map((sx, i) => fx("stud", [[sx * xa, (yd + yS) / 2, bzc - 200], [sx * xa, (yd + yS) / 2, bzc + 200]], [-sx, 0, 0], { len: 60, dia: 8, on: `A${i + 1}`, to: ["B1", "B2"].slice(i, i + 1) })),
      from: { A1: [-300, 0, 0], A2: [300, 0, 0] },
      warnings: ["hand"],
    },
    {
      title: "Fit the armrests to the seat base",
      detail: "Push the studs through the end holes and fix each with a washer and a wing nut. Then click two feet under each armrest.",
      fix: [
        ...ends.map((sx) => fx("nut", [[sx * (xa - 40), (yd + yS) / 2, bzc - 200], [sx * (xa - 40), (yd + yS) / 2, bzc + 200]], [sx, 0, 0], { len: 20, dia: 30, name: "Wing nut" })),
        fx("foot", ends.flatMap((sx) => [[sx * (W / 2 - AW / 2), 0, zb + 80], [sx * (W / 2 - AW / 2), 0, zs - 80]] as Vec3[]), [0, 1, 0], { len: ft, dia: 60, name: "Foot", to: ["A1", "A2"] }),
      ],
    },
    {
      title: "Screw the hook onto the right armrest",
      detail: "Two screws. The chaise longue hooks onto it later if you build it on this side instead.",
      fix: [fx("hook", [[xa, 200, zs - 40]], [-1, 0, 0], { len: 40, dia: 20, on: "A2" })],
      tools: ["screwdriver"],
    },
    {
      title: "Lower the backrest between the armrests",
      detail: "Screw four studs into the seat bases by hand first, then lower the backrest onto them.",
      add: ["K"],
      fix: [fx("stud", [-0.4, -0.15, 0.15, 0.4].map((f) => [f * Wi, yd, zb + kd / 2] as Vec3), [0, 1, 0], { len: 80, dia: 8, to: ["K"] })],
      people: 2,
      warnings: ["two", "hand"],
    },
    {
      title: "Bolt the armrests to the backrest",
      detail: "One long bolt through each armrest, then a wing nut on each of the four studs underneath.",
      fix: [
        ...ends.map((sx, i) => fx("bolt", [[sx * (W / 2), 550, zb + kd / 2]], [-sx, 0, 0], { len: 120, dia: 8, on: `A${i + 1}`, mate: "K" })),
        fx("nut", [-0.4, -0.15, 0.15, 0.4].map((f) => [f * Wi, yd - 10, zb + kd / 2] as Vec3), [0, 1, 0], { len: 20, dia: 30, name: "Wing nut", to: ["B1", "B2"] }),
      ],
      tools: ["allen"],
    },
    {
      title: "Fix the chaise longue to the sofa",
      detail: "Two studs into the seat base, push the chaise onto them, then a washer and a wing nut on each. Two long bolts through the chaise into the armrest, and one more from inside the box.",
      fix: [
        fx("stud", [[cx - 200, 300, zs], [cx + 200, 300, zs]], [0, 0, 1], { len: 50, dia: 8, on: "B1", mate: "C" }),
        fx("nut", [[cx - 200, 300, zs + 40], [cx + 200, 300, zs + 40]], [0, 0, -1], { len: 20, dia: 30, name: "Wing nut", on: "C" }),
        fx("bolt", [[-W / 2 + AW, 200, zs + 60], [-W / 2 + AW, 360, zs + 60], [cx, ft + 60, cz0 + 40]], [1, 0, 0], { len: 120, dia: 8, to: ["C", "A1"] }),
      ],
      tools: ["allen"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw the castors onto the pull-out bed",
      detail: "Turn it upside down. Four castors, two screws in each.",
      add: ["U"],
      fix: [
        fx(
          "castor",
          ends.flatMap((sx) => [[px + sx * (pw / 2 - 60), 20, bzc - (bd - 40) / 2 + 60], [px + sx * (pw / 2 - 60), 20, bzc + (bd - 40) / 2 - 60]] as Vec3[]),
          [0, 1, 0],
          { len: 20, dia: 40, on: "U" },
        ),
      ],
      tools: ["screwdriver"],
      from: { U: [0, 0, 900] },
    },
    {
      title: "Slide the pull-out bed in under the seat",
      detail: "Fit the two hinge links first. Lift the front of the sofa while a helper slides the bed in, then let the rollers drop into place.",
      people: 2,
      warnings: ["two"],
    },
    { title: "Put the back cushions on", detail: "Shake them into shape first, then stand them against the backrest.", add: ["Q1", "Q2", "Q3"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["BÅRSLÖV", "BARSLOV"],
  recipe(s) {
    const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
    if (/chaise/.test(v)) return chaiseSofa(s);
    if (/sofa-bed|sofa bed/.test(v)) return sofaBed(s);
    return null;
  },
};
export default family;
