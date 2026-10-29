import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * NYHAMN 3-seat sofa-bed, read from its three manuals (frame, pocket sprung mattress, cover). Frame: two legs are
 * bolted under the slatted seat, the base is built from two side frames, a front rail, the two link arms and a back
 * rail with cone brackets, and the seat is laid on it and locked with the sliding catches. The back hinges click up,
 * two people lower the slatted back onto them, it is bolted on, and the link arms are bolted to it. The mattress is
 * strapped on, then the cover goes on with the sofa folded flat into a bed, and it is clicked back up into a sofa.
 * IKEA: 200 wide, 97 deep, 90 high, seat at 31; bed 140 x 200.
 */

/** Euler angles (x then z) that turn a part's y axis onto d. */
function along(d: Vec3): Vec3 {
  const n = Math.hypot(...d);
  const [x, y, z] = [d[0] / n, d[1] / n, d[2] / n];
  return [Math.atan2(z, y), 0, Math.atan2(-x, Math.hypot(y, z))];
}

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
const LONG = { len: 70, dia: 8 }, MID = { len: 45, dia: 8 }, SHORT = { len: 12, dia: 8 };

function recipe(s: ProductSpec): CustomParams {
  const SW = 1800; // seat and back, between the side frames
  const t = 40;
  const xS = 955, yT = 140; // side frames: tube centre
  const zF = 250, zB = -200, zLegB = -440, zEnd = -470;
  const ySeat = 170, zSeat = 115, seatD = 700;
  const tilt = 0.25;
  const backBot: Vec3 = [0, 200, -250];
  const backL = 680;
  const backC: Vec3 = [0, backBot[1] + (backL / 2) * Math.cos(tilt), backBot[2] - (backL / 2) * Math.sin(tilt)];
  const sideFrame = (sx: number): CustomPart => {
    const c: Vec3 = [sx * (xS - 12), 180, (zEnd + zF + 30) / 2];
    const p = (x: number, y: number, z: number): Vec3 => [x - c[0], y - c[1], z - c[2]];
    const pieces: PartPiece[] = [
      { shape: "box", size: [t, t, zF + 30 - zEnd], pos: p(sx * xS, yT, (zEnd + zF + 30) / 2) },
      { shape: "box", size: [t, yT - t / 2, t], pos: p(sx * xS, (yT - t / 2) / 2, zLegB) },
      { shape: "box", size: [t, yT - t / 2, t], pos: p(sx * xS, (yT - t / 2) / 2, zF) },
      // the hinge upright the back sits on, folded down until step ten
      { shape: "box", size: [30, 200, 40], pos: p(sx * (xS - 35), yT + 120, backBot[2]) },
    ];
    return { id: sx < 0 ? "S1" : "S2", name: "Side frame", size: [t + 30 + 5, 360, zF + 30 - zEnd], pos: c, material: "metal", pieces };
  };
  const linkLo: Vec3 = [0, yT, -300], linkHi: Vec3 = [0, 480, backBot[2] - (480 - backBot[1]) * Math.tan(tilt) - 25];
  const link = (sx: number): CustomPart => {
    const v: Vec3 = [0, linkHi[1] - linkLo[1], linkHi[2] - linkLo[2]];
    return {
      id: sx < 0 ? "L1" : "L2",
      name: "Link arm",
      size: [25, Math.hypot(...v), 30],
      pos: [sx * (xS + 35), (linkLo[1] + linkHi[1]) / 2, (linkLo[2] + linkHi[2]) / 2],
      rot: along(v),
      material: "metal",
    };
  };
  const nrm: Vec3 = [0, Math.sin(tilt), Math.cos(tilt)];
  const mC: Vec3 = [0, 545, -60];
  const mBack: Vec3 = [0, backC[1] + 70 + 80 * nrm[1], backC[2] + 80 * nrm[2] + 15];
  const mattress: PartPiece[] = [
    { shape: "box", size: [SW, 120, seatD], pos: [0, 250 - mC[1], zSeat - mC[2]] },
    { shape: "box", size: [SW, 560, 120], pos: [0, mBack[1] - mC[1], mBack[2] - mC[2]], rot: [-tilt, 0, 0] },
  ];
  const parts: CustomPart[] = [
    { id: "SD", name: "Seat frame", size: [SW, t, seatD], pos: [0, ySeat, zSeat], material: "wood" },
    { id: "FL1", name: "Leg", size: [t, ySeat - t / 2, t], pos: [-SW / 2 + 30, (ySeat - t / 2) / 2, zSeat + seatD / 2 - 30], material: "metal" },
    { id: "FL2", name: "Leg", size: [t, ySeat - t / 2, t], pos: [SW / 2 - 30, (ySeat - t / 2) / 2, zSeat + seatD / 2 - 30], material: "metal" },
    sideFrame(-1),
    sideFrame(1),
    { id: "R1", name: "Rail", size: [2 * (xS - t / 2), 30, 30], pos: [0, yT, zF], material: "metal" },
    link(-1),
    link(1),
    { id: "R2", name: "Rail", size: [2 * (xS - t / 2), 30, 30], pos: [0, yT, zB], material: "metal" },
    { id: "BK", name: "Back frame", size: [SW, backL, t], pos: backC, rot: [-tilt, 0, 0], material: "wood" },
    { id: "MT", name: "Mattress", size: [SW, 710, 900], pos: mC, material: "soft", pieces: mattress },
  ];
  const sides = [-1, 1];
  const sId = (sx: number) => (sx < 0 ? "S1" : "S2");
  const lId = (sx: number) => (sx < 0 ? "L1" : "L2");
  const legAt = (sx: number): Vec3 => [sx * (SW / 2 - 30), ySeat - t / 2, zSeat + seatD / 2 - 30];
  const pivot = (sx: number): Vec3 => [sx * (xS + 50), yT, linkLo[2]];
  const top = (sx: number): Vec3 => [sx * (xS + 50), linkHi[1] - 20, linkHi[2] + 10];
  const pivotFix = (at: (sx: number) => Vec3, mate: (sx: number) => string, on: (sx: number) => string): CustomFix[] => [
    ...sides.map((sx) => fx("bolt", [at(sx)], [-sx, 0, 0], on(sx), { mate: mate(sx), ...LONG })),
    fx("washer", sides.flatMap((sx) => [at(sx), [at(sx)[0] - sx * 30, at(sx)[1], at(sx)[2]] as Vec3]), [-1, 0, 0], on(-1), { len: 4, dia: 20 }),
    fx("nut", sides.map((sx): Vec3 => [sx * (xS - 30), at(sx)[1], at(sx)[2]]), [1, 0, 0], on(-1), { len: 8, dia: 13 }),
  ];
  const steps: CustomStep[] = [
    {
      title: "Set the legs on the seat frame",
      detail: "Lay the slatted seat upside down on a rug and stand a leg in each front corner, its plate over the holes.",
      wait: ["SD", "FL1", "FL2"],
      from: { SD: [0, 0, 700], FL1: [0, 0, 700], FL2: [0, 0, 700] },
      warnings: ["floor"],
    },
    {
      title: "Bolt the legs on",
      detail: "Two bolts in each leg, a nut on the inside of each pair. Tighten with the Allen key.",
      fix: [
        ...sides.map((sx) => fx("bolt", [-1, 1].map((d): Vec3 => [legAt(sx)[0] + d * 12, legAt(sx)[1], legAt(sx)[2]]), [0, 1, 0], sx < 0 ? "FL1" : "FL2", { mate: "SD", ...MID })),
        fx("nut", sides.map((sx): Vec3 => [legAt(sx)[0], ySeat + t / 2, legAt(sx)[2] - 15]), [0, -1, 0], "SD", { len: 8, dia: 13 }),
      ],
      tools: ["allen"],
    },
    {
      title: "Bolt the front rail between the side frames",
      detail: "The side frames stand on their legs, hinge uprights on the inside. One long bolt through each end.",
      add: ["S1", "S2", "R1"],
      fix: sides.map((sx) => fx("bolt", [[sx * (xS + t / 2), yT, zF]], [-sx, 0, 0], sId(sx), { mate: "R1", ...LONG })),
    },
    {
      title: "Bolt the link arms to the side frames",
      detail: "Outside each frame: bolt, washer, arm, washer, then the nut held with the spanner while you turn the bolt.",
      add: ["L1", "L2"],
      fix: pivotFix(pivot, lId, sId),
      tools: ["allen", "wrench"],
    },
    {
      title: "Bolt on the back rail with the cone brackets",
      detail: "A bracket on each end of the rail, cone pointing up. One long bolt through each into the side frame.",
      add: ["R2"],
      fix: [
        fx("connector", sides.map((sx): Vec3 => [sx * (xS - 90), yT + 15, zB]), [0, -1, 0], "R2", { name: "Cone bracket", len: 30, dia: 30 }),
        ...sides.map((sx) => fx("bolt", [[sx * (xS + t / 2), yT, zB]], [-sx, 0, 0], sId(sx), { mate: "R2", ...LONG })),
      ],
    },
    { title: "Slide the catches open", detail: "Push the catch on top of each side frame towards the back, the right way round." },
    {
      title: "Lay the seat on the base",
      detail: "Turn it the right way up, legs at the front, and lower it so the cones go into the holes under the seat.",
      add: ["SD", "FL1", "FL2"],
      from: { SD: [0, 300, 0], FL1: [0, 300, 0], FL2: [0, 300, 0] },
    },
    { title: "Slide the catches shut", detail: "Push both catches forward over the seat frame until they stop." },
    {
      title: "Screw the catches down",
      detail: "One short bolt in each, with the Allen key.",
      // each catch sits on top of its side frame tube, the bolt goes down into the tube
      fix: [fx("bolt", sides.map((sx): Vec3 => [sx * xS, yT + t / 2, 0]), [0, -1, 0], "S1", SHORT)],
      tools: ["allen"],
    },
    { title: "Click the back hinges up", detail: "Lift each hinge upright at the back until it clicks." },
    { title: "Check the seat moves", detail: "Lift the front of the seat, push it back, and check both cones sit in their holes. Then lower it again." },
    {
      title: "Lower the back onto the hinges together",
      detail: "Slats facing forwards. Slide its lower ends down over the hinge uprights.",
      add: ["BK"],
      from: { BK: [0, 500, -100] },
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Bolt the back to the hinges",
      detail: "Two bolts in each side, nuts held with the spanner.",
      fix: [
        ...sides.map((sx) => fx("bolt", [240, 290].map((y): Vec3 => [sx * (xS - 50), y, backBot[2] - (y - backBot[1]) * Math.tan(tilt)]), [sx, 0, 0], "BK", { mate: sId(sx), ...MID })),
        fx("nut", sides.flatMap((sx) => [240, 290].map((y): Vec3 => [sx * (xS - 20), y, backBot[2] - (y - backBot[1]) * Math.tan(tilt)])), [-1, 0, 0], "S1", { len: 8, dia: 13 }),
      ],
      tools: ["allen", "wrench"],
    },
    {
      title: "Bolt the link arms to the back",
      detail: "Swing each arm up against the back frame. Bolt, washer, arm, washer and nut, as before.",
      fix: pivotFix(top, () => "BK", lId),
      tools: ["allen", "wrench"],
    },
    {
      title: "Strap the mattress on",
      detail: "Lay it over the seat and back, then pull the two straps round the seat frame and the two at the top round the back.",
      add: ["MT"],
      from: { MT: [0, 500, 300] },
    },
    { title: "Fold it flat into a bed", detail: "Lift the front of the seat until it clicks, then lower the back flat. The cover goes on this way." },
    { title: "Pull the cover over the mattress", detail: "Unzip it, pull each half over its end of the mattress and smooth the corners." },
    { title: "Zip the two halves together", detail: "Close the long zip across the middle of the bed, then tuck the flap in." },
    { title: "Fold it back into a sofa", detail: "Lift the back until it clicks, then let it settle into the sofa position." },
    { title: "Fasten the cover under the frame", detail: "Kneel behind it and press the four strips onto the frame underneath." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["NYHAMN"],
  recipe(s) {
    if (!/3-seat-sofa-bed|3-seat sofa-bed/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
    return recipe(s);
  },
};
export default family;
