import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * KARSKÄR, read from the chair's and the two extendable tables' manuals.
 * The chair comes as two side frames (front leg, back leg, side rail and stretcher in one piece). The front and back
 * seat rails get seat brackets and dowels, go between the side frames with the chair on its side, and four long
 * bolts through the side frames lock them. The backrest clicks onto the back legs and is bolted, and the frame is
 * set upside down on the seat and screwed through the brackets.
 * The table is built upside down on its top: a slide frame (dowels, cams, four corner brackets) laid on the two top
 * halves, stop blocks and leaf rails screwed on, then four legs bolted to the corner brackets with threaded rods
 * and nuts, and an H of stretchers held with cams. Two people for the stretchers and turning it over.
 */

// ---------- chair ----------

const LEG = 38;

function chair(s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const seatTop = 450, seatT = 18, yA = seatTop - seatT; // the seat rails' top edge
  const xs = W / 2 - LEG / 2, zf = D / 2 - LEG / 2, zb = -zf;
  const cy = H / 2;
  const side = (id: string, sx: number): CustomPart => ({
    id,
    name: "Side frame",
    size: [LEG, H, D],
    pos: [sx * xs, cy, 0],
    material: "wood",
    pieces: [
      { shape: "box", size: [LEG, H - 10, LEG], pos: [0, (H - 10) / 2 - cy, zb] },
      { shape: "box", size: [LEG, yA, LEG], pos: [0, yA / 2 - cy, zf] },
      { shape: "box", size: [22, 70, D - 2 * LEG], pos: [0, yA - 35 - cy, 0] },
      { shape: "box", size: [22, 32, D - 2 * LEG], pos: [0, 170 - cy, 0] },
    ],
  });
  const railLen = W - 2 * LEG;
  const rail = (id: string, name: string, z: number): CustomPart => ({ id, name, size: [railLen, 70, 22], pos: [0, yA - 35, z], material: "wood" });
  const zRail = zf - 8;
  const parts: CustomPart[] = [
    side("SL", -1),
    side("SR", 1),
    rail("AF", "Front seat rail", zRail),
    rail("AB", "Back seat rail", -zRail),
    { id: "B", name: "Backrest", size: [W + 20, 250, 16], pos: [0, H - 125, zb + LEG / 2 + 8], material: "wood" },
  ];
  // the seat runs from just in front of the back legs to the front edge
  const z0 = zb + LEG / 2 + 2, z1 = D / 2;
  parts.push({ id: "S", name: "Seat", size: [W, seatT, z1 - z0], pos: [0, seatTop - seatT / 2, (z0 + z1) / 2], material: "wood" });

  const xe = railLen / 2;
  const endDowels = (id: string, dy: number[], len: number, dia: number): CustomFix[] =>
    [-1, 1].map((sx) => ({ kind: "dowel", count: dy.length, len, dia, at: dy.map((d) => [sx * xe, yA - 35 + d, id === "AF" ? zRail : -zRail] as Vec3), dir: [-sx, 0, 0], on: id }));
  const brackets: CustomFix[] = ["AF", "AB"].map((id) => ({
    kind: "clip",
    name: "Seat bracket",
    count: 2,
    at: [-1, 1].map((sx) => [sx * 100, yA, (id === "AF" ? 1 : -1) * (zRail - 11)] as Vec3),
    dir: [0, -1, 0],
    on: id,
  }));
  const longBolts: CustomFix[] = [-1, 1].map((sx) => ({
    kind: "bolt",
    count: 2,
    len: 70,
    dia: 6,
    at: [zRail, -zRail].map((z) => [sx * (W / 2), yA - 35, z] as Vec3),
    dir: [-sx, 0, 0],
    on: sx < 0 ? "SL" : "SR",
  }));
  const steps: CustomStep[] = [
    {
      title: "Push the seat brackets into the seat rails",
      detail: "Two in the top edge of each rail, pressed in by hand until they sit flat.",
      add: ["AF", "AB"],
      fix: brackets,
      warnings: ["floor"],
    },
    { title: "Tap the small dowels into the rail ends", detail: "Two in each end of the front rail and one in each end of the back rail.", fix: [...endDowels("AF", [-18, 18], 30, 8), ...endDowels("AB", [-18], 30, 8)] },
    { title: "Tap the big dowels into the back rail", detail: "One more in each end, next to the small one.", fix: endDowels("AB", [18], 40, 10) },
    {
      title: "Lay a side frame down and push in the back rail",
      detail: "Lie the side frame on the rug, holes up. The rail's curve faces the right way, as on the drawing.",
      add: ["SL", "AB"],
      pose: "+x",
    },
    { title: "Push in the front rail", detail: "Brackets on the inside, towards the seat.", add: ["AF"] },
    { title: "Press the other side frame on", detail: "Line up all the dowels and press down evenly until it sits tight.", add: ["SR"], from: { SR: [400, 0, 0] } },
    {
      title: "Tap dowels into the front legs",
      detail: "One in the top of each front leg. They go into the seat at the end.",
      fix: [-1, 1].map((sx) => ({ kind: "dowel", count: 1, len: 30, dia: 8, at: [[sx * xs, yA, zf] as Vec3], dir: [0, -1, 0], on: sx < 0 ? "SL" : "SR" })),
    },
    {
      title: "Stand it up and bolt the side frames on",
      detail: "Four long bolts through the side frames into the rail ends. Slide the key into its handle for grip, and tighten until the heads sit flush.",
      fix: longBolts,
      pose: "+y",
      tools: ["allen"],
    },
    { title: "Hook the backrest onto the back legs", detail: "Tilt it in and fit its two catches into the slots at the top of the legs.", add: ["B"], from: { B: [0, 260, 0] } },
    { title: "Press the backrest down until it clicks", detail: "Push down one side, then the other, until both catches lock." },
    {
      title: "Bolt the backrest from behind",
      detail: "One short bolt through each back leg into the backrest.",
      fix: [-1, 1].map((sx) => ({ kind: "bolt", count: 1, len: 20, dia: 6, at: [[sx * xs, H - 125, zb - LEG / 2] as Vec3], dir: [0, 0, 1], on: sx < 0 ? "SL" : "SR", mate: "B" })),
    },
    {
      title: "Press down on the frame and tighten again",
      detail: "Put your weight on the frame with all four legs on the floor, then give the four long bolts a last turn.",
      tools: ["allen"],
      check: "square",
    },
    {
      title: "Set the frame upside down on the seat",
      detail: "Lay the seat face down on a rug on a table, then lower the frame onto it so the front leg dowels find their holes.",
      add: ["S"],
      pose: "-y",
      from: { S: [0, -260, 0] },
    },
    {
      title: "Screw the seat on through the brackets",
      detail: "One screw up through each bracket into the seat.",
      fix: [{ kind: "screw", count: 4, len: 16, dia: 4, at: brackets.flatMap((b) => b.at!.map((p) => [p[0], yA, p[2] - Math.sign(p[2]) * 6] as Vec3)), dir: [0, 1, 0] }],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

// ---------- extendable table ----------

function table(s: ProductSpec) {
  const big = s.size.w >= 200;
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const TT = 30, yTop = H - TT; // underside of the top
  const AT = 22, AH = 90; // apron board
  const xf = W / 2 - (big ? 330 : 160), zf = D / 2 - 30; // outer faces of the slide frame
  const LS = 60; // leg
  const xl = xf - AT - LS / 2, zl = zf - AT - LS / 2;
  const yA = yTop - AH / 2;
  const leaf = big ? 600 : 600 / 2 + 300; // a butterfly leaf, folded in two under the top
  const parts: CustomPart[] = [
    { id: "T0", name: "Table top half", size: [W / 2, TT, D], pos: [-W / 4, H - TT / 2, 0], material: "wood" },
    { id: "T1", name: "Table top half", size: [W / 2, TT, D], pos: [W / 4, H - TT / 2, 0], material: "wood" },
    { id: "LF", name: "Extension leaf, folded", size: [leaf / 2, 2 * TT, D - 160], pos: [0, yTop - TT, 0], material: "wood" },
    { id: "AS0", name: "Long frame rail", size: [2 * xf, AH, AT], pos: [0, yA, -(zf - AT / 2)], material: "wood" },
    { id: "AS1", name: "Long frame rail", size: [2 * xf, AH, AT], pos: [0, yA, zf - AT / 2], material: "wood" },
    { id: "AE0", name: "End frame rail", size: [AT, AH, 2 * (zf - AT)], pos: [-(xf - AT / 2), yA, 0], material: "wood" },
    { id: "AE1", name: "End frame rail", size: [AT, AH, 2 * (zf - AT)], pos: [xf - AT / 2, yA, 0], material: "wood" },
  ];
  const xc = leaf / 4 + 60;
  for (const [i, sx] of [-1, 1].entries()) parts.push({ id: `X${i}`, name: "Cross rail", size: [AT, AH - 20, 2 * (zf - AT)], pos: [sx * xc, yA + 10, 0], material: "wood" });
  for (const [i, sx] of [-1, 1].entries())
    for (const [j, sz] of [-1, 1].entries()) parts.push({ id: `L${i}${j}`, name: "Leg", size: [LS, yTop, LS], pos: [sx * xl, yTop / 2, sz * zl], material: "wood" });
  const yS = 230;
  for (const [i, sx] of [-1, 1].entries()) parts.push({ id: `E${i}`, name: "End stretcher", size: [40, 60, 2 * zl - LS], pos: [sx * xl, yS, 0], material: "wood" });
  parts.push({ id: "M", name: "Long stretcher", size: [2 * xl - 40, 60, 40], pos: [0, yS, 0], material: "wood" });

  const longRails = ["AS0", "AS1"], ends = ["AE0", "AE1"], cross = ["X0", "X1"];
  const legs = ["L00", "L01", "L10", "L11"];
  const zIn = zf - AT;
  const legPos = (k: number) => parts.find((p) => p.id === legs[k])!.pos;
  const sgn = (k: number) => [Math.sign(legPos(k)[0]), Math.sign(legPos(k)[2])] as const;
  const r2 = Math.SQRT1_2;
  // the legs hang in the corner brackets on two threaded rods each, a washer and a nut on each rod inside the bracket
  const rodAt = (k: number, out: number): Vec3[] => {
    const [sx, sz] = sgn(k), p = legPos(k);
    return [yTop - 25, yTop - 65].map((y) => [p[0] - sx * out, y, p[2] - sz * out] as Vec3);
  };
  const legFix = (k: number): CustomFix[] => {
    const [sx, sz] = sgn(k);
    const dir: Vec3 = [sx * r2, 0, sz * r2];
    const p = legPos(k);
    return [
      { kind: "connector", name: "Barrel nut", count: 1, at: [[p[0], yTop - 45, p[2]]], dir: [0, -1, 0], on: legs[k] },
      { kind: "stud", name: "Threaded rod", count: 2, len: 90, dia: 8, at: rodAt(k, LS / 2), dir, on: legs[k] },
      { kind: "washer", count: 2, at: rodAt(k, LS / 2 + 30), dir, on: legs[k] },
      { kind: "nut", count: 2, dia: 8, at: rodAt(k, LS / 2 + 34), dir, on: legs[k] },
    ];
  };
  const side = (z: number) => (z < 0 ? "AS0" : "AS1");
  const endDowels = (id: string): CustomFix => {
    const z = id === "AS0" ? -zIn : zIn;
    return { kind: "dowel", count: 4, len: 30, dia: 8, at: [-1, 1].flatMap((sx) => [-20, 20].map((d) => [sx * (xf - AT / 2), yA + d, z] as Vec3)), dir: [0, 0, Math.sign(z) || 1], on: id };
  };
  const crossDowels = (id: string): CustomFix => {
    const x = id === "X0" ? -xc : xc;
    return { kind: "dowel", count: 2, len: 30, dia: 8, at: [-1, 1].map((sz) => [x, yA + 30, sz * zIn] as Vec3), dir: [0, 0, 1], on: id };
  };
  const camBolts = (id: string): CustomFix => {
    const z = id === "AS0" ? -zIn : zIn;
    return { kind: "camScrew", count: 2, at: [-1, 1].map((sx) => [sx * xc, yA - 5, z] as Vec3), dir: [0, 0, Math.sign(z)], on: id };
  };
  const guideAt = (i: number) => [-1, 1].map((sx) => [sx * (xf - 200), yTop, (i ? 1 : -1) * (zIn + AT / 2)] as Vec3);
  const bracketAt = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (xl - LS / 2 - 25), yTop - 45, sz * (zl - LS / 2 - 25)] as Vec3));
  const nRails = big ? 8 : 4;
  const railAt = Array.from({ length: nRails }, (_, i) => {
    const sx = i % 2 ? 1 : -1, row = Math.floor(i / 2);
    const z = (row % 2 ? 1 : -1) * (zIn - 150 - Math.floor(row / 2) * 200);
    return [sx * (xc + 60), yTop, z] as Vec3;
  });
  const blockAt = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (xf - 120), yTop, sz * (zIn - 60)] as Vec3));
  const pairs = (pts: Vec3[]) => pts.flatMap((p) => [-15, 15].map((d) => [p[0] + d, p[1] - 4, p[2]] as Vec3));
  const steps: CustomStep[] = [
    {
      title: "Tap the small dowels into the frame rails",
      detail: "Two in each end of the long rails, one in each end of the cross rails. Use the small ones here.",
      add: ["AS0"],
      fix: [...longRails.map(endDowels), ...cross.map(crossDowels)],
      pose: "-y",
      warnings: ["floor"],
      // the cross rails and the other long rail take their fittings beside the build and come in along them
      wait: ["AS1", ...cross],
      from: { AS0: [0, 0, -300], AS1: [0, 0, 400], X0: [0, 0, 300], X1: [0, 0, 300] },
    },
    { title: "Screw the cam bolts into the long rails", detail: "Two in the inside face of each long rail, where the cross rails meet it.", fix: longRails.map(camBolts) },
    {
      title: "Screw the slide guides onto the long rails",
      detail: "Two on each rail, one small screw each.",
      fix: [
        ...longRails.map((id, i): CustomFix => ({ kind: "clip", name: "Slide guide", count: 2, at: guideAt(i), dir: [0, -1, 0], on: id })),
        ...longRails.map((id, i): CustomFix => ({ kind: "screw", count: 2, len: 12, dia: 3.5, at: guideAt(i).map((p) => [p[0], p[1] + 3, p[2]] as Vec3), dir: [0, -1, 0], on: id })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the corner brackets onto the long rails",
      detail: "One at each end, two screws each into the long rail.",
      fix: [
        ...[-1, 1].map((sz): CustomFix => ({ kind: "angle", name: "Corner bracket", count: 2, at: bracketAt.filter((p) => Math.sign(p[2]) === sz), dir: [0, 0, sz], on: side(sz) })),
        ...[-1, 1].map((sz): CustomFix => ({ kind: "screw", count: 4, len: 16, dia: 4, at: bracketAt.filter((p) => Math.sign(p[2]) === sz).flatMap((p) => [-1, 1].map((d) => [p[0] - Math.sign(p[0]) * 20, p[1] + d * 18, sz * zIn] as Vec3)), dir: [0, 0, sz], on: side(sz) })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Push the cross rails between the long rails",
      detail: "Onto the dowels and cam bolts of one long rail, then press the other long rail onto their free ends.",
      add: [...cross, "AS1"],
      from: { AS1: [0, 0, 400], X0: [0, 0, 300], X1: [0, 0, 300] },
    },
    { title: "Lock the cams", detail: "Four cams in the cross rails, turned clockwise until they grip the bolts.", fix: [{ kind: "cam", count: 4, to: cross }], tools: ["screwdriver"] },
    { title: "Push the end rails on", detail: "Onto the dowels at both ends of the frame.", add: ends },
    {
      title: "Screw the end rails to the corner brackets",
      detail: "Two screws through each bracket into the end rail.",
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 4, len: 16, dia: 4, at: bracketAt.filter((p) => Math.sign(p[0]) === sx).flatMap((p) => [-1, 1].map((d) => [sx * (xf - AT), p[1] + d * 18, p[2] - Math.sign(p[2]) * 20] as Vec3)), dir: [sx, 0, 0] })),
      tools: ["screwdriver"],
    },
    { title: "Lay the top halves face down and lock them", detail: "On a rug, the two halves edge to edge. Press both latches underneath closed.", add: ["T0", "T1", "LF"], warnings: ["floor"] },
    {
      title: "Lay the frame on the top together",
      detail: "Fit the slide guides into the runners on the underside, then slide the frame along until it sits centred.",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw on the stop blocks",
      detail: "Four blocks with two screws each. They stop the halves sliding off the frame.",
      fix: [
        ...[-1, 1].map((sx): CustomFix => ({ kind: "clip", name: "Stop block", count: 2, at: blockAt.filter((p) => Math.sign(p[0]) === sx), dir: [0, 1, 0], on: sx < 0 ? "T0" : "T1" })),
        { kind: "screw", count: 8, len: 16, dia: 4, at: pairs(blockAt), dir: [0, 1, 0] },
      ],
      tools: ["screwdriver"],
    },
    { title: "Slide the halves together", detail: "Check they run smoothly on the frame before you go on." },
    {
      title: "Screw on the leaf rails",
      detail: `${nRails} metal rails, two screws each, where the leaf rests when it is out.`,
      fix: [
        ...[-1, 1].map((sx): CustomFix => ({ kind: "runner", name: "Leaf rail", count: nRails / 2, at: railAt.filter((p) => Math.sign(p[0]) === sx), dir: [0, 1, 0], on: sx < 0 ? "T0" : "T1" })),
        { kind: "screw", count: 2 * nRails, len: 16, dia: 4, at: pairs(railAt), dir: [0, 1, 0] },
      ],
      tools: ["screwdriver"],
    },
    { title: "Fit the barrel nuts and rods into the legs", detail: "Drop a barrel nut into each leg with its slot facing the rod hole, then screw two threaded rods into it by hand." },
    { title: "Screw a cam bolt into each leg", detail: "In the inside face, where the end stretcher meets it." },
    { title: "Tap the big dowels into the stretchers", detail: "One in each end of the three stretchers." },
    { title: "Screw cam bolts into the end stretchers", detail: "One in the middle of each, for the long stretcher." },
    { title: "Bolt the first leg into its corner", detail: "Rods through the corner bracket, a washer and nut on each, tightened with the box spanner.", add: ["L00"], fix: legFix(0), tools: ["wrench"] },
    {
      title: "Push an end stretcher onto it",
      detail: "Onto the dowel and cam bolt in the leg.",
      add: ["E0"],
      fix: [{ kind: "dowel", count: 1, len: 40, dia: 10, to: ["E0"] }, { kind: "camScrew", count: 1, to: ["E0"] }],
    },
    { title: "Bolt on the second leg", detail: "Onto the other end of the stretcher, then the rods, washers and nuts.", add: ["L01"], fix: [{ kind: "dowel", count: 1, len: 40, dia: 10, to: ["L01"] }, { kind: "camScrew", count: 1, to: ["L01"] }, ...legFix(1)], tools: ["wrench"] },
    { title: "Bolt on the third leg", detail: "At the other end of the frame, the same way.", add: ["L10"], fix: legFix(2), tools: ["wrench"] },
    {
      title: "Fit the long stretcher together",
      detail: "One of you holds it level while the other pushes it onto the end stretcher.",
      add: ["M"],
      fix: [{ kind: "dowel", count: 1, len: 40, dia: 10, to: ["M"] }, { kind: "camScrew", count: 1, to: ["M"] }],
      people: 2,
    },
    {
      title: "Fit the other end stretcher",
      detail: "Onto the third leg and the end of the long stretcher at the same time.",
      add: ["E1"],
      fix: [{ kind: "dowel", count: 2, len: 40, dia: 10, to: ["E1"] }, { kind: "camScrew", count: 2, to: ["E1"] }],
      people: 2,
      // it meets the leg along its length and the long stretcher across it, so it goes on at an angle onto both
      from: { E1: [250, 0, 250] },
    },
    { title: "Bolt on the last leg", detail: "Press it onto the stretcher, then the rods through the bracket, washers and nuts.", add: ["L11"], fix: [{ kind: "dowel", count: 1, len: 40, dia: 10, to: ["L11"] }, { kind: "camScrew", count: 1, to: ["L11"] }, ...legFix(3)], tools: ["wrench"], people: 2 },
    { title: "Lock the stretcher cams", detail: "Six cams, turned clockwise until they grip.", fix: [{ kind: "cam", count: 6, to: ["E0", "E1", "M"] }], tools: ["screwdriver"] },
    { title: "Tap the glides onto the legs", detail: "One on each leg end, with a gentle tap.", fix: [{ kind: "glide", name: "Glide", count: 4, at: legs.map((_, k) => [legPos(k)[0], 0, legPos(k)[2]] as Vec3), dir: [0, 1, 0] }], tools: ["hammer"] },
    { title: "Turn it over together and unlock the top", detail: "Lift by the frame, never by the top. Open both latches underneath.", pose: "+y", people: 2 },
    {
      title: "Screw in the two leaf stops",
      detail: "Pull the halves apart and screw a stop into each marked hole in the frame.",
      fix: [{ kind: "stud", name: "Leaf stop", count: 2, len: 20, dia: 8, at: [-1, 1].map((sz) => [0, yTop, sz * (zIn - 80)] as Vec3), dir: [0, -1, 0], on: "LF" }],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["KARSKÄR"],
  recipe(s) {
    const v = `${s.variant} ${s.slug ?? ""}`;
    if (/chair/i.test(v)) return chair(s);
    if (/extendable table/i.test(v)) return table(s);
    return null;
  },
};
export default family;
