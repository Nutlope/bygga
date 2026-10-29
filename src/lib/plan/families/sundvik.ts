import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * SUNDVIK children's furniture, read from IKEA's manuals.
 *
 * Table: four rails take a corner bracket each and are screwed into a frame, the frame is screwed to the top lying
 * face down, and each leg gets a barrel nut and a threaded rod that bolts through its bracket with a washer and nut.
 * Chair: two ready-made side frames (legs and rails in one). Built on its side: the backrest on dowels and the two
 * cross rails go into one side, the other side goes on top, three long screws each side, and the seat is screwed on
 * from below with the chair upside down.
 * Rocking chair: the back (three slats between two rails) is doweled together, stood into a side frame lying on the
 * floor with the seat, then the other side goes on and three bolts with barrel nuts lock each side.
 * Cot (UK) and crib (US): dowels in the slatted sides, bolts and barrel nuts through one end, then on its end for the
 * other one; the base rests on four supports at the height for the baby's age, and four stops are screwed on.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
const box = (size: Vec3, pos: Vec3, rot?: Vec3): PartPiece => ({ shape: "box", size, pos, ...(rot ? { rot } : {}) });

/* ---------- children's table ---------- */

function table(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const TT = 20, LG = 40, RT = 18, RH = 60, OV = 30;
  const fx = W / 2 - OV, fz = D / 2 - OV; // outside of the frame
  const ry = H - TT - RH / 2;
  const lx = fx - RT - LG / 2, lz = fz - RT - LG / 2;
  const parts: CustomPart[] = [
    { id: "T", name: "Table top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    { id: "R0", name: "Long rail", size: [2 * fx, RH, RT], pos: [0, ry, -fz + RT / 2], material: "wood" },
    { id: "R1", name: "Long rail", size: [2 * fx, RH, RT], pos: [0, ry, fz - RT / 2], material: "wood" },
    { id: "R2", name: "Short rail", size: [RT, RH, 2 * fz - 2 * RT], pos: [-fx + RT / 2, ry, 0], material: "wood" },
    { id: "R3", name: "Short rail", size: [RT, RH, 2 * fz - 2 * RT], pos: [fx - RT / 2, ry, 0], material: "wood" },
    ...[-1, 1].flatMap((gx, i) => [-1, 1].map((gz, j): CustomPart => ({ id: `L${i}${j}`, name: "Leg", size: [LG, H - TT, LG], pos: [gx * lx, (H - TT) / 2, gz * lz], material: "wood" }))),
  ];
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const cIn = (gx: number, gz: number, d = 0): Vec3 => [gx * (fx - RT - d), ry, gz * (fz - RT - d)];
  // each bracket spans the inside of a corner, screwed to both rails
  const bracketAt = corners.map(([gx, gz]): Vec3 => { const p = cIn(gx, gz, 30); return [p[0], ry - RH / 2 + 8, p[2]]; });
  const railScrews = (alongX: boolean): CustomFix[] =>
    corners.flatMap(([gx, gz]) =>
      [-12, 12].map((dy): CustomFix => {
        const at: Vec3 = alongX ? [gx * (fx - RT - 45), ry + dy, gz * (fz - RT)] : [gx * (fx - RT), ry + dy, gz * (fz - RT - 45)];
        return { kind: "screw", count: 1, len: 12, dia: 4, at: [at], dir: alongX ? [0, 0, gz] : [gx, 0, 0] };
      }),
    );
  const legs = ["L00", "L10", "L01", "L11"]; // in the same order as corners
  // the threaded rod goes into the leg's inside corner at 45 degrees and through its bracket
  const diag = (gx: number, gz: number): Vec3 => [gx * Math.SQRT1_2, 0, gz * Math.SQRT1_2];
  const inner = (gx: number, gz: number, d: number): Vec3 => [gx * (lx - LG / 2 - d), ry, gz * (lz - LG / 2 - d)];
  const perCorner = (kind: CustomFix["kind"], d: number, o: Partial<CustomFix>): CustomFix[] => corners.map(([gx, gz], i) => ({ kind, ...o, count: 1, at: [inner(gx, gz, d)], dir: diag(gx, gz), on: legs[i] }));
  const steps: CustomStep[] = [
    {
      title: "Screw a corner bracket onto each rail",
      detail: "Lay the four rails on a rug. One bracket at one end of each, two short screws, the bracket's hole facing in.",
      add: ["R0", "R1", "R2", "R3"],
      fix: [{ kind: "angle", name: "Corner bracket", count: 4, len: 40, dia: 30, at: bracketAt, dir: [0, 1, 0] }, ...railScrews(true)],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Screw the rails together into a frame", detail: "Each bracket's free arm against the next rail, two short screws into it.", fix: railScrews(false), check: "square" },
    {
      title: "Screw the frame to the underside of the top",
      detail: "Lay the top face down on the rug, centre the frame on it and drive the eight long screws up through the rails.",
      add: ["T"],
      fix: [{ kind: "screw", count: 8, len: 50, dia: 4, at: [...[-1, 1].flatMap((gz) => [-0.5, 0.5].map((t): Vec3 => [t * fx, ry - RH / 2, gz * (fz - RT / 2)])), ...[-1, 1].flatMap((gx) => [-0.4, 0.4].map((t): Vec3 => [gx * (fx - RT / 2), ry - RH / 2, t * fz]))], dir: [0, 1, 0] }],
      from: { T: [0, -300, 0] },
    },
    {
      title: "Fit a barrel nut and a threaded rod to each leg",
      detail: "Push the barrel nut into the hole in the outside of the leg, slot facing the corner, then turn the rod into the inside corner until it stops.",
      fix: [
        ...corners.map(([gx, gz], i): CustomFix => ({ kind: "nut", name: "Barrel nut", count: 1, len: 20, dia: 10, at: [[gx * (lx + LG / 2), ry, gz * lz]], dir: [-gx, 0, 0], on: legs[i] })),
        ...perCorner("legScrew", 0, { name: "Threaded rod", len: 70, dia: 8 }),
      ],
    },
    {
      title: "Bolt the legs into the corners",
      detail: "Push each rod through its bracket, then a washer and a nut. Tighten with the spanner so the leg pulls tight into the corner.",
      add: legs,
      fix: [...perCorner("washer", 30, { dia: 16 }).map((f) => ({ ...f, on: undefined })), ...perCorner("nut", 32, { len: 6, dia: 8 }).map((f) => ({ ...f, on: undefined }))],
      tools: ["wrench"],
      from: Object.fromEntries(legs.map((k) => [k, [0, -300, 0] as Vec3])),
    },
    { title: "Turn the table over", detail: "Stand it on its legs and check it doesn't rock.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- children's chair ---------- */

function chair(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const SH = (s.seat?.seatH ?? 29) * 10;
  const L = 30, ST = 20; // leg section, seat thickness
  const lx = W / 2 - L / 2, lz = D / 2 - L / 2;
  const fh = SH - ST; // front legs stop under the seat
  const railY = fh - 30;
  const side = (g: number): CustomPart => ({
    id: `F${g < 0 ? 0 : 1}`,
    name: "Side frame",
    size: [L, H, D],
    pos: [g * lx, H / 2, 0],
    material: "wood",
    pieces: [
      box([L, H, L], [0, 0, -lz]),
      box([L, fh, L], [0, fh / 2 - H / 2, lz]),
      box([L - 8, 50, D - 2 * L], [0, railY - H / 2, 0]),
      box([L - 8, 30, D - 2 * L], [0, 90 - H / 2, 0]),
    ],
  });
  const crossW = W - 2 * L;
  const backY = SH + (H - SH) * 0.62;
  const zc0 = -D / 2 + L + 11; // the back cross rail, just in front of the back legs and under the seat
  const parts: CustomPart[] = [
    side(-1),
    side(1),
    { id: "B", name: "Backrest", size: [crossW, (H - SH) * 0.55, 18], pos: [0, backY, -lz], material: "wood" },
    { id: "C0", name: "Cross rail", size: [crossW, 50, 22], pos: [0, railY, zc0], material: "wood" },
    { id: "C1", name: "Cross rail", size: [crossW, 50, 22], pos: [0, railY, lz], material: "wood" },
    { id: "S", name: "Seat", size: [W, ST, D - L], pos: [0, SH - ST / 2, L / 2], material: "wood" },
  ];
  const sideScrews = (g: number): CustomFix => ({ kind: "screw", count: 3, len: 70, dia: 6, at: [[g * W / 2, backY, -lz], [g * W / 2, railY, zc0], [g * W / 2, railY, lz]], dir: [-g, 0, 0] });
  const steps: CustomStep[] = [
    {
      title: "Push the backrest into one side frame",
      detail: "Lay a side frame on a rug, inside up. Tap the dowels into the backrest's ends and press it into the top of the back leg.",
      add: ["F0", "B"],
      fix: [-1, 1].map((g): CustomFix => ({ kind: "dowel", count: 2, len: 30, dia: 8, at: [-30, 30].map((dy): Vec3 => [g * (crossW / 2), backY + dy, -lz]), dir: [g, 0, 0], on: "B" })),
      pose: "+x",
      warnings: ["floor"],
      tools: ["hammer"],
    },
    { title: "Stand the two cross rails in", detail: "One at the back and one at the front, on their dowels, holes facing out.", add: ["C0", "C1"], from: { C0: [-300, 0, 0], C1: [-300, 0, 0] } },
    { title: "Put the other side frame on top", detail: "Line it up over the backrest and both rails, then press it down.", add: ["F1"], from: { F1: [300, 0, 0] } },
    { title: "Screw this side on", detail: "Three long screws: one into the backrest and one into each rail.", fix: [sideScrews(1)], tools: ["allen"] },
    { title: "Turn it over and screw the other side", detail: "Three more long screws in the same places.", fix: [sideScrews(-1)], tools: ["allen"], pose: "-x" },
    {
      title: "Screw the seat on from underneath",
      detail: "Lay the seat face down and stand the chair upside down on it. Four screws up through the cross rails into the seat.",
      add: ["S"],
      fix: [{ kind: "screw", count: 4, len: 60, dia: 5, at: [-1, 1].flatMap((gz) => [-1, 1].map((gx): Vec3 => [gx * crossW * 0.3, railY - 25, gz < 0 ? zc0 : lz])), dir: [0, 1, 0] }],
      pose: "-y",
      tools: ["screwdriver"],
      from: { S: [0, -250, 0] },
    },
    { title: "Stand the chair up", detail: "Check it stands steady on all four legs.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- rocking chair ---------- */

function rocker(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const SH = (s.sofa?.seatH ?? 29) * 10;
  const L = 32, AY = SH + 140; // leg section, armrest height
  const lx = W / 2 - L / 2;
  const legZ = [-120, 130]; // back and front legs
  // the rocker: a shallow arc under both legs
  const NA = 9, seg = D / NA + 6, sag = 70;
  const arcY = (z: number) => 20 + sag * (2 * z / D) ** 2;
  const arc: PartPiece[] = range(NA).map((i) => {
    const z = -D / 2 + (i + 0.5) * (D / NA);
    const slope = (2 * sag * 2 * z) / (D * D / 2);
    return box([L - 6, 28, seg], [0, arcY(z) - H / 2, z], [-Math.atan(slope), 0, 0]);
  });
  const side = (g: number): CustomPart => ({
    id: `F${g < 0 ? 0 : 1}`,
    name: "Side frame",
    size: [L, H, D],
    pos: [g * lx, H / 2, 0],
    material: "wood",
    pieces: [
      ...arc,
      box([L, H - 40, L], [0, 20, legZ[0]], [0.12, 0, 0]),
      box([L, AY - 40, L], [0, (AY - 40) / 2 + 40 - H / 2, legZ[1]]),
      box([L, 24, 330], [0, AY - H / 2, 40]),
      box([L - 8, 45, legZ[1] - legZ[0]], [0, SH - 40 - H / 2, (legZ[0] + legZ[1]) / 2]),
    ],
  });
  const cw = W - 2 * L;
  const zb = legZ[0] - 20; // the back leans a little
  const parts: CustomPart[] = [
    { id: "T", name: "Back top rail", size: [cw, 80, 22], pos: [0, H - 60, zb - 40], material: "wood", rot: [0.12, 0, 0] },
    { id: "U", name: "Back bottom rail", size: [cw, 40, 22], pos: [0, SH + 60, zb + 5], material: "wood", rot: [0.12, 0, 0] },
    ...spread(-cw / 3, cw / 3, 3).map((x, i): CustomPart => ({ id: `B${i}`, name: "Back slat", size: [45, H - 100 - SH - 80, 15], pos: [x, (H - 100 + SH + 80) / 2, zb - 20], material: "wood", rot: [0.12, 0, 0] })),
    side(-1),
    side(1),
    { id: "S", name: "Seat", size: [cw, 20, 280], pos: [0, SH - 10, 20], material: "wood" },
  ];
  const slats = ["B0", "B1", "B2"];
  const bolts = (g: number): CustomFix[] => [
    { kind: "bolt", count: 3, len: 70, dia: 6, at: [[g * W / 2, H - 60, zb - 40], [g * W / 2, SH + 60, zb + 5], [g * W / 2, SH - 10, 120]], dir: [-g, 0, 0] },
    { kind: "nut", name: "Barrel nut", count: 3, len: 14, dia: 10, at: [[g * (cw / 2 - 30), H - 60 + 40, zb - 40], [g * (cw / 2 - 30), SH + 60 + 20, zb + 5], [g * (cw / 2 - 30), SH, 120]], dir: [0, -1, 0] },
  ];
  const steps: CustomStep[] = [
    {
      title: "Dowel the back slats between the back rails",
      detail: "On a rug. Short dowels in both ends of the three slats, then press the two rails on.",
      add: ["T", "U", ...slats],
      fix: [{ kind: "dowel", count: 6, len: 30, dia: 8, to: slats }],
      pose: "+z",
      warnings: ["floor"],
      tools: ["hammer"],
    },
    { title: "Tap the long dowels into the ends of the back rails", detail: "Two in each end of the back.", fix: [-1, 1].map((g): CustomFix => ({ kind: "dowel", count: 2, len: 40, dia: 8, at: [[g * cw / 2, H - 60, zb - 40], [g * cw / 2, SH + 60, zb + 5]], dir: [g, 0, 0], on: "T" })), tools: ["hammer"] },
    { title: "Stand the back into a side frame", detail: "Lay one side frame on the rug, inside up, and press the back's dowels into its holes.", add: ["F0"], pose: "+x", from: { F0: [-300, 0, 0] } },
    { title: "Put the seat in", detail: "Long dowels in both ends of the seat first, then press it into the side frame.", add: ["S"], fix: [-1, 1].map((g): CustomFix => ({ kind: "dowel", count: 2, len: 40, dia: 8, at: [-60, 100].map((z): Vec3 => [g * cw / 2, SH - 10, z]), dir: [g, 0, 0], on: "S" })), tools: ["hammer"] },
    { title: "Put the other side frame on and bolt it", detail: "Line it up over all the dowels. Barrel nuts into the holes on the inside, then three bolts through the side.", add: ["F1"], fix: bolts(1), tools: ["allen"], from: { F1: [300, 0, 0] } },
    { title: "Turn it over and bolt the first side", detail: "Three more barrel nuts and bolts. Tighten all six firmly.", fix: bolts(-1), tools: ["allen"], pose: "-x" },
    { title: "Stand it on its rockers", detail: "Check it rocks evenly and the bolts are tight.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- cot and crib ---------- */

function cot(s: ProductSpec, crib: boolean): CustomParams {
  // IKEA's own sizes: the cot is 145 x 76 x 85 cm, the crib 138 x 76 x 88; length runs left to right
  const ml = (s.bed?.mattressL ?? 140) * 10, mw = (s.bed?.mattressW ?? 70) * 10;
  const L = ml + (crib ? 60 : 50), W = mw + 60, H = crib ? 880 : 850;
  const P = 45; // corner posts
  const px = L / 2 - P / 2, pz = W / 2 - P / 2;
  const sideLen = L - 2 * P;
  const topY = H - 50, botY = 240;
  const end = (g: number): CustomPart => ({
    id: `E${g < 0 ? 0 : 1}`,
    name: "End panel",
    size: [P, H, W],
    pos: [g * px, H / 2, 0],
    material: "wood",
    pieces: [
      box([P, H, P], [0, 0, -pz]),
      box([P, H, P], [0, 0, pz]),
      box([30, 70, W - 2 * P], [0, H / 2 - 35, 0]),
      box([30, 70, W - 2 * P], [0, botY - H / 2, 0]),
      { shape: "box", size: [14, H - 70 - botY - 35, W - 2 * P], pos: [0, (H - 70 + botY + 35) / 2 - H / 2, 0], material: "board" },
    ],
  });
  const nSlat = Math.round(sideLen / 70);
  const sidePieces: PartPiece[] = [
    box([sideLen, 40, 30], [0, topY, 0]),
    box([sideLen, 40, 30], [0, botY, 0]),
    ...spread(-sideLen / 2 + 50, sideLen / 2 - 50, nSlat).map((x) => box([22, topY - botY - 40, 20], [x, (topY + botY) / 2, 0])),
  ];
  const sideOf = (g: number): CustomPart => ({ id: `S${g < 0 ? 0 : 1}`, name: "Cot side", size: [sideLen, topY - botY + 40, 30], pos: [0, (topY + botY) / 2, g * pz], material: "wood", pieces: sidePieces.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] - (topY + botY) / 2, p.pos[2]] as Vec3 })) });
  const baseY = 430; // the upper height, for a newborn
  const nb = 9;
  const base: CustomPart = {
    id: "B",
    name: "Cot base",
    size: [sideLen - 10, 40, W - 2 * P - 10],
    pos: [0, baseY, 0],
    material: "wood",
    pieces: [
      box([sideLen - 10, 40, 30], [0, 0, -(W - 2 * P - 40) / 2]),
      box([sideLen - 10, 40, 30], [0, 0, (W - 2 * P - 40) / 2]),
      ...spread(-(sideLen - 100) / 2, (sideLen - 100) / 2, nb).map((x) => box([80, 14, W - 2 * P - 70], [x, 10, 0])),
    ],
  };
  const parts: CustomPart[] = [sideOf(-1), sideOf(1), end(-1), end(1), base, { id: "M", name: "Mattress", size: [ml, 100, mw], pos: [0, baseY + 20 + 50, 0], material: "soft", extra: true }];
  const sides = ["S0", "S1"];
  const endBolts = (g: number): CustomFix[] => [
    { kind: "bolt", count: 4, len: 80, dia: 6, at: [-1, 1].flatMap((gz) => [topY, botY].map((y): Vec3 => [g * L / 2, y, gz * pz])), dir: [-g, 0, 0] },
    { kind: "nut", name: "Barrel nut", count: 4, len: 14, dia: 10, at: [-1, 1].flatMap((gz) => [topY, botY].map((y): Vec3 => [g * (sideLen / 2 - 40), y - 20, gz * pz])), dir: [0, 1, 0] },
  ];
  const supportsFix: CustomFix[] = [-1, 1].map((g) => ({ kind: "pin", name: "Base support", count: 2, len: 40, dia: 8, at: [-1, 1].map((gz): Vec3 => [g * (L / 2 - P), baseY - 25, gz * (W / 2 - P - 80)]), dir: [g, 0, 0] }));
  // down through the corners of the base's two long rails
  const baseBolts: CustomFix = { kind: "bolt", count: 4, len: 30, dia: 6, at: [-1, 1].flatMap((g) => [-1, 1].map((gz): Vec3 => [g * (sideLen / 2 - 25), baseY + 20, gz * ((W - 2 * P - 40) / 2)])), dir: [0, -1, 0], on: "B" };
  const stopAt = (gz: number, d: number) => [-1, 1].map((g): Vec3 => [g * (sideLen / 2 - 30), botY - 40, gz * (pz + d)]);
  const stops: CustomFix[] = [-1, 1].flatMap((gz): CustomFix[] => [
    { kind: "clip", name: "Side stop", count: 2, len: 30, dia: 25, at: stopAt(gz, 15), dir: [0, 0, -gz] },
    { kind: "screw", count: 2, len: 14, dia: 4, at: stopAt(gz, 17), dir: [0, 0, -gz] },
  ]);
  const dowelFix: CustomFix[] = [-1, 1].map((g) => ({ kind: "dowel", count: 4, len: 40, dia: 8, at: [-1, 1].flatMap((gz) => [topY, botY].map((y): Vec3 => [g * sideLen / 2, y + 10, gz * pz])), dir: [-g, 0, 0] }));
  const steps: CustomStep[] = [
    { title: "Tap the dowels into the cot sides", detail: "Two in each end of both slatted sides.", add: sides, fix: dowelFix, tools: ["hammer"] },
    { title: "Bolt the sides to one end panel", detail: "One of you holds the sides up. Barrel nuts into the holes under the rails, slot toward the bolt, then four bolts through the end's posts.", add: ["E0"], fix: endBolts(-1), tools: ["allen"], people: 2, warnings: ["two"], from: { E0: [-300, 0, 0] } },
  ];
  const otherEnd: CustomStep = { title: "Stand it on that end and bolt on the other one", detail: "Lay the second end panel on top, push it onto the dowels, then barrel nuts and four bolts as before.", add: ["E1"], fix: endBolts(1), tools: ["allen"], pose: "+x", from: { E1: [300, 0, 0] } };
  if (crib) {
    steps.push(
      { title: "Screw the base supports into the base", detail: "One near each corner of the frame under the base.", fix: [baseBolts], tools: ["allen"], wait: ["B"] },
      { title: "Stand it on its end and slide the base in", detail: "Hook the base onto the supports at the height for your baby's age: the upper one for a newborn, the lower one once your child can sit or pull up.", add: ["B"], fix: supportsFix, pose: "+x", from: { B: [300, 0, 0] } },
      otherEnd,
    );
  } else {
    steps.push(
      otherEnd,
      { title: "Stand it up and push in the base supports", detail: "Into the holes inside both end panels: the upper holes for a newborn, the lower ones once your child can sit or pull up.", fix: supportsFix, pose: "+y" },
      { title: "Lay the base on the supports", detail: "Slats facing up. Check it sits flat on all four.", add: ["B"], from: { B: [0, 300, 0] } },
      { title: "Bolt the base to the supports", detail: "One short bolt down through each corner of the base.", fix: [baseBolts], tools: ["allen"] },
    );
  }
  steps.push({ title: "Screw on the four side stops", detail: "Outside the cot, under each end of the slatted sides. They keep the sides from lifting out.", fix: stops, tools: ["screwdriver"], pose: "+y" });
  steps.push({ title: "Lay the mattress in", detail: "It should fit snugly with no gap wider than two fingers at the sides.", add: ["M"] });
  return { parts, steps };
}


/* ---------- extendable bed ---------- */

function bed(s: ProductSpec): CustomParams {
  const mw = (s.bed?.mattressW ?? 80) * 10, ml = (s.bed?.mattressL ?? 200) * 10;
  // IKEA's sizes: 92 (80 cm mattress) or 108 (97 cm) wide, 7 cm longer than the mattress pulled all the way out
  const W = mw + (mw > 900 ? 110 : 120), L = ml + 70;
  const P = 45, HH = 810, FH = 660, T = 18;
  const B0 = 200, B1 = 330; // the side boards' bottom and top edge
  const zH = -L / 2 + P / 2, zF = L / 2 - P / 2;
  const zM = -L / 2 + P + 1100; // where the head half ends, at the middle legs
  const xS = W / 2 - T / 2, xF = W / 2 - T - T / 2, xM = W / 2 - 2 * T - P / 2, xL = xM - P / 2 - 15;
  const endOf = (id: string, name: string, h: number, z: number): CustomPart => ({
    id,
    name,
    size: [W, h, P],
    pos: [0, h / 2, z],
    material: "wood",
    pieces: [
      box([P, h, P], [-W / 2 + P / 2, 0, 0]),
      box([P, h, P], [W / 2 - P / 2, 0, 0]),
      box([W - 2 * P, 60, 30], [0, h / 2 - 30, 0]),
      box([W - 2 * P, 70, 30], [0, B1 + 60 - h / 2, 0]),
      { shape: "box", size: [W - 2 * P, h - 60 - B1 - 95, 14], pos: [0, (h - 60 + B1 + 95) / 2 - h / 2, 0], material: "board" },
    ],
  });
  const headLen = zM + L / 2 - P;
  const sideHead = (g: number): CustomPart => ({
    id: `H${g < 0 ? 0 : 1}`,
    name: "Head side board",
    size: [T, 470 - B0, headLen],
    pos: [g * xS, (470 + B0) / 2, -L / 2 + P + headLen / 2],
    material: "board",
    pieces: [box([T, B1 - B0, headLen], [0, (B1 + B0) / 2 - (470 + B0) / 2, 0]), box([T, 470 - B1, 360], [0, (470 + B1) / 2 - (470 + B0) / 2, -headLen / 2 + 180])],
  });
  const footLen = L / 2 - P - (zM - 300);
  const parts: CustomPart[] = [
    sideHead(-1),
    sideHead(1),
    ...[-1, 1].map((g, i): CustomPart => ({ id: `M${i}`, name: "Middle leg", size: [P, B1, P], pos: [g * xM, B1 / 2, zM - P / 2], material: "wood" })),
    endOf("E", "Headboard", HH, zH),
    ...[-1, 1].map((g, i): CustomPart => ({ id: `R${i}`, name: "Slat ledge", size: [25, 35, zM - P - (-L / 2 + P)], pos: [g * xL, 262, (zM - P + -L / 2 + P) / 2], material: "wood" })),
    { id: "C", name: "Cross board", size: [2 * (xM - P / 2), 100, T], pos: [0, 250, zM - P / 2], material: "board" },
    ...[-1, 1].map((g, i): CustomPart => ({ id: `F${i}`, name: "Foot side board", size: [T, B1 - B0, footLen], pos: [g * xF, (B0 + B1) / 2, L / 2 - P - footLen / 2], material: "board" })),
    endOf("G", "Footboard", FH, zF),
  ];
  const nS = 17, baseLen = L - 2 * P - 20;
  parts.push({
    id: "S",
    name: "Slatted base",
    size: [W - 2 * T - 30, 8, baseLen],
    pos: [0, 284, 0],
    material: "wood",
    pieces: [...spread(-baseLen / 2 + 35, baseLen / 2 - 35, nS).map((z) => box([W - 2 * T - 30, 8, 60], [0, 0, z])), { shape: "box", size: [30, 3, baseLen], pos: [-(W / 2 - 80), -5, 0], material: "fiber" }, { shape: "box", size: [30, 3, baseLen], pos: [W / 2 - 80, -5, 0], material: "fiber" }],
  });
  parts.push({ id: "X", name: "Mattress", size: [mw, 120, ml], pos: [0, 288 + 4 + 60, 0], material: "soft", extra: true });
  const sides = (f: (g: number) => Vec3[]) => [-1, 1].flatMap(f);
  // one fix per direction (and host), so each point goes in its own way
  const fx = (kind: CustomFix["kind"], pts: Vec3[], dir: (p: Vec3) => Vec3, o: Partial<CustomFix> = {}, on?: (p: Vec3) => string): CustomFix[] => {
    const key = (p: Vec3) => `${dir(p).join(",")}|${on?.(p) ?? ""}`;
    return [...new Set(pts.map(key))].map((k) => {
      const at = pts.filter((p) => key(p) === k);
      return { kind, ...o, count: at.length, at, dir: dir(at[0]), ...(on ? { on: on(at[0]) } : {}) };
    });
  };
  const sx = (p: Vec3): Vec3 => [Math.sign(p[0]), 0, 0];
  const nx = (p: Vec3): Vec3 => [-Math.sign(p[0]), 0, 0];
  const LONG = { len: 40, dia: 8 }, SHORT = { len: 30, dia: 8 }, BOLT = { len: 100, dia: 6 }, NUT = { name: "Barrel nut", len: 14, dia: 10 };
  const steps: CustomStep[] = [
    { title: "Tap the dowels into the head side boards", detail: "On a rug. Two of the long dowels in each end of both boards.", add: ["H0", "H1"], fix: [...fx("dowel", sides((g) => [[g * xS, 240, -L / 2 + P], [g * xS, 300, -L / 2 + P]]), () => [0, 0, -1], LONG), ...fx("dowel", sides((g) => [[g * xS, 240, zM], [g * xS, 300, zM]]), () => [0, 0, 1], LONG)], tools: ["hammer"], warnings: ["floor"] },
    { title: "Bolt a middle leg to the end of each side board", detail: "Barrel nut into the leg, slot toward the bolt, then one long bolt through the board.", add: ["M0", "M1"], fix: [...fx("nut", sides((g) => [[g * xM, B1, zM - P / 2]]), () => [0, -1, 0], NUT), ...fx("bolt", sides((g) => [[g * W / 2, 265, zM - P / 2]]), nx, BOLT)], tools: ["allen"] },
    { title: "Push the side boards onto the headboard", detail: "Stand the headboard up and press both boards onto its dowels, curved ends at the top.", add: ["E"], from: { E: [0, 0, -300] }, people: 2, warnings: ["two"] },
    { title: "Bolt the side boards to the headboard", detail: "Barrel nuts into the boards from the inside, then two long bolts through each post.", fix: [...fx("nut", sides((g) => [[g * (xS - T / 2), 240, -L / 2 + P + 40], [g * (xS - T / 2), 300, -L / 2 + P + 40]]), sx, NUT), ...fx("bolt", sides((g) => [[g * (W / 2 - P / 2), 240, -L / 2], [g * (W / 2 - P / 2), 300, -L / 2]]), () => [0, 0, 1], BOLT)], tools: ["allen"] },
    { title: "Tap the dowels into the slat ledges", detail: "Long dowels in one end of both ledges.", add: ["R0", "R1"], fix: fx("dowel", sides((g) => [[g * xL - 6, 262, -L / 2 + P], [g * xL + 6, 262, -L / 2 + P]]), () => [0, 0, -1], LONG), tools: ["hammer"] },
    { title: "Bolt the cross board to the other end of the ledges", detail: "Short dowels in the board first, then a barrel nut in each ledge and a long bolt through the board.", add: ["C"], fix: [...fx("dowel", sides((g) => [[g * (xM - P / 2), 205, zM - P / 2], [g * (xM - P / 2), 290, zM - P / 2]]), sx, SHORT), ...fx("nut", sides((g) => [[g * xL, 279, zM - P - 40]]), () => [0, -1, 0], NUT), ...fx("bolt", sides((g) => [[g * xL, 262, zM - P / 2 + T / 2]]), () => [0, 0, -1], BOLT)], tools: ["allen", "hammer"] },
    { title: "Turn the head end over and fit the ledges in", detail: "Upside down on the rug. The cross board goes between the middle legs on two long dowels.", fix: fx("dowel", sides((g) => [[g * (xM - P / 2), 240, zM - P / 2]]), sx, LONG, () => "C"), pose: "-y", warnings: ["floor"] },
    { title: "Bolt the middle legs to the cross board", detail: "Use the two silver barrel nuts here, one in each end of the cross board.", fix: [...fx("nut", sides((g) => [[g * (xM - P / 2 - 30), 300, zM - P / 2]]), () => [0, -1, 0], { ...NUT, dia: 12 }), ...fx("bolt", sides((g) => [[g * (xM + P / 2), 250, zM - P / 2]]), nx, BOLT)], tools: ["allen"] },
    { title: "Stand it up and bolt the ledges to the headboard", detail: "A barrel nut in each ledge, then a long bolt through the headboard's bottom rail.", fix: [...fx("nut", sides((g) => [[g * xL, 279, -L / 2 + P + 40]]), () => [0, -1, 0], NUT), ...fx("bolt", sides((g) => [[g * xL, 262, -L / 2]]), () => [0, 0, 1], BOLT)], pose: "+y", tools: ["allen"] },
    { title: "Slide the foot side boards in", detail: "Inside the head side boards. Pull them out to the length you want and lock each with two short bolts.", add: ["F0", "F1"], fix: fx("bolt", sides((g) => [[g * W / 2, 265, zM - 100], [g * W / 2, 265, zM - 240]]), nx, { len: 30, dia: 6 }), tools: ["allen"], from: { F0: [0, 0, 400], F1: [0, 0, 400] } },
    { title: "Tap a short dowel into each foot side board", detail: "In the free end, for the footboard.", fix: fx("dowel", sides((g) => [[g * xF, 265, L / 2 - P]]), () => [0, 0, 1], SHORT, (p) => (p[0] < 0 ? "F0" : "F1")), tools: ["hammer"] },
    { title: "Push the footboard on", detail: "Four long dowels in its posts first, then press it onto the side boards.", add: ["G"], fix: fx("dowel", sides((g) => [[g * xF, 225, L / 2 - P], [g * xF, 305, L / 2 - P]]), () => [0, 0, -1], LONG), from: { G: [0, 0, 300] }, tools: ["hammer"] },
    { title: "Bolt the footboard on", detail: "Barrel nuts into the side boards from the inside, then two long bolts through each post.", fix: [...fx("nut", sides((g) => [[g * (xF - T / 2), 225, L / 2 - P - 40], [g * (xF - T / 2), 305, L / 2 - P - 40]]), sx, NUT), ...fx("bolt", sides((g) => [[g * xF, 225, L / 2], [g * xF, 305, L / 2]]), () => [0, 0, -1], BOLT)], tools: ["allen"] },
    { title: "Tap in the four slat stops", detail: "Into the holes along the top of the foot side boards, with a hammer.", fix: fx("pin", sides((g) => [[g * xF, B1, zM - 280], [g * xF, B1, L / 2 - 150]]), () => [0, -1, 0], { name: "Slat stop", len: 25, dia: 10 }), tools: ["hammer"] },
    { title: "Lay the slatted base in", detail: "Unroll it along the ledges and push the straps at both ends over the stops, so it opens and closes with the bed.", add: ["S"], from: { S: [0, 300, 0] } },
    { title: "Lay the mattress on", detail: "Extend the bed when your child grows: move the short bolts to the next holes.", add: ["X"] },
  ];
  return { parts, steps };
}

/* ---------- wardrobe ---------- */

/**
 * The wardrobe, from its manual: two side frames lie on a rug and take their cam bolts, dowels, runner fittings and
 * feet; on its side, the four rails and two shelves stand in the left frame, the bottom slides in and the right frame
 * goes on top. The clothes rail and the back go in, then it stands up for the crown (three mouldings round the top
 * panel, with the wall brackets), the hinge plates, the wall fixing, the two doors, the drawer and the knobs.
 */
function wardrobe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const P = 45, cr = 60, Hc = H - cr; // posts, crown height, top of the carcass
  const xP = W / 2 - P / 2, zP = D / 2 - P / 2, xi = W / 2 - P, iw = 2 * xi;
  const yBot = 160, yTop = Hc - 80; // the bottom rails' top, the top rails' underside
  const yS2 = 440, yS1 = Hc - 330, yRod = yS1 - 60; // lower shelf, upper shelf, clothes rail
  const zF = D / 2 - 12.5, zB = -zF; // the front and back rails
  const side = (id: string, sx: number): CustomPart => ({
    id,
    name: "Side frame",
    size: [P, Hc, D],
    pos: [sx * xP, Hc / 2, 0],
    material: "board",
    pieces: [
      box([P, Hc, P], [0, 0, zP]),
      box([P, Hc, P], [0, 0, -zP]),
      box([22, 70, D - 2 * P], [0, Hc / 2 - 35, 0]),
      box([22, 80, D - 2 * P], [0, 120 - Hc / 2, 0]),
      { shape: "box", size: [12, Hc - 70 - yBot, D - 2 * P], pos: [0, (yBot + Hc - 70) / 2 - Hc / 2, 0], material: "fiber" },
    ],
  });
  const rail = (id: string, name: string, y: number, z: number): CustomPart => ({ id, name, size: [iw, 80, 25], pos: [0, y, z], material: "board" });
  const dW = xi - 4, dY0 = yS2 + 12, dY1 = yTop - 3;
  const door = (id: string, sx: number): CustomPart => ({ id, name: "Door", size: [dW, dY1 - dY0, 20], pos: [sx * (dW / 2 + 2), (dY0 + dY1) / 2, D / 2 - 10], material: "board" });
  // the drawer fills the gap between the bottom rail and the lower shelf
  const dfH = yS2 - 9 - yBot - 6, dfY = yBot + 3 + dfH / 2, dbD = D - 80, dsX = xi - 28, dsY = yBot + 20 + 90, dzB = D / 2 - 20 - dbD;
  const parts: CustomPart[] = [
    side("SL", -1),
    side("SR", 1),
    rail("FT", "Top rail", Hc - 40, zF),
    rail("BT", "Top rail", Hc - 40, zB),
    rail("FB", "Bottom rail", 120, zF),
    rail("BB", "Bottom rail", 120, zB),
    { id: "S1", name: "Shelf", size: [iw, 18, D - 60], pos: [0, yS1 + 9, 5], material: "board" },
    { id: "S2", name: "Shelf", size: [iw, 18, D - 60], pos: [0, yS2 + 9, 5], material: "board" },
    { id: "BP", name: "Bottom", size: [iw, 18, D - 50], pos: [0, yBot - 9, 0], material: "board" },
    { id: "R", name: "Clothes rail", size: [iw, 25, 25], pos: [0, yRod, 0], shape: "cyl", material: "metal" },
    { id: "K", name: "Back panel", size: [iw + 10, yTop - yBot, 4], pos: [0, (yTop + yBot) / 2, -D / 2 + 30], material: "fiber" },
    { id: "T", name: "Top panel", size: [W, 18, D], pos: [0, Hc + 9, 0], material: "board" },
    { id: "MF", name: "Front moulding", size: [W + 40, cr, 30], pos: [0, Hc + cr / 2, D / 2 + 5], material: "board" },
    ...[-1, 1].map((sx): CustomPart => ({ id: sx < 0 ? "ML" : "MR", name: "Side moulding", size: [30, cr, D - 10], pos: [sx * (W / 2 + 5), Hc + cr / 2, -15], material: "board" })),
    door("D1", -1),
    door("D2", 1),
    { id: "DF", name: "Drawer front", size: [iw - 6, dfH, 20], pos: [0, dfY, D / 2 - 10], material: "board" },
    ...[-1, 1].map((sx): CustomPart => ({ id: sx < 0 ? "DL" : "DR", name: "Drawer side", size: [15, 180, dbD], pos: [sx * dsX, dsY, D / 2 - 20 - dbD / 2], material: "board" })),
    { id: "DB", name: "Drawer bottom", size: [2 * dsX - 15, 4, dbD - 15], pos: [0, dsY - 80, D / 2 - 20 - dbD / 2], material: "fiber" },
    { id: "DK", name: "Drawer back", size: [2 * dsX - 15, 160, 15], pos: [0, dsY + 10, dzB + 7.5], material: "board" },
  ];
  const SX = [-1, 1] as const;
  const sid = (sx: number) => (sx < 0 ? "SL" : "SR");
  const fit = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
  const CAMBOLT = { len: 34, dia: 7 }, CAM = { len: 13, dia: 15 }, DOWEL = { len: 30, dia: 8 };
  // the side frames' joints: the four rails (cam bolt above, dowel below) and the shelves
  const railJoints = (sx: number) => [[Hc - 40, zF], [Hc - 40, zB], [120, zF], [120, zB]].map(([y, z]) => [sx * xi, y, z] as Vec3);
  const shelfZ = [-(D / 2 - 110), D / 2 - 110];
  const sideBolts = (sx: number, shelves: number[]) => fit("camScrew", [...railJoints(sx).map((p) => [p[0], p[1] + 20, p[2]] as Vec3), ...shelves.flatMap((y) => shelfZ.map((z) => [sx * xi, y + 9, z] as Vec3))], [sx, 0, 0], { on: sid(sx), ...CAMBOLT });
  const sideDowels = (sx: number) => fit("dowel", [...railJoints(sx).map((p) => [p[0], p[1] - 20, p[2]] as Vec3), [sx * xi, yBot - 9, 0]], [sx, 0, 0], { on: sid(sx), ...DOWEL });
  const railCams = (sx: number, ids: string[]) =>
    ids.map((id) => {
      const z = id.startsWith("F") ? zF : zB, y = id.endsWith("T") ? Hc - 40 : 120;
      return fit("cam", [[sx * (xi - 30), y + 20, z - Math.sign(z) * 12.5]], [0, 0, Math.sign(z)], { on: id, ...CAM });
    });
  const shelfCams = (sx: number, ids: string[]) => ids.map((id) => fit("cam", shelfZ.map((z) => [sx * (xi - 30), (id === "S1" ? yS1 : yS2) + 18, z] as Vec3), [0, -1, 0], { on: id, ...CAM }));
  const hy = [dY0 + 100, dY0 + 400, dY1 - 400, dY1 - 100];
  const topBolts = [-xi + 100, 0, xi - 100].flatMap((x) => [zF, zB].map((z) => [x, Hc, z] as Vec3));
  const knobs: Vec3[] = [[-30, (dY0 + dY1) / 2, 0], [30, (dY0 + dY1) / 2, 0], [0, dfY, 0]];
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the left side frame",
      detail: "Lay both side frames on a rug, inside up. Eight bolts in the left one, by hand until they stop.",
      add: ["SL"],
      wait: ["SR"],
      fix: [sideBolts(-1, [yS1, yS2])],
      pose: "+x",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Screw the cam bolts into the right side frame", detail: "Six in the right one: the rails and the lower shelf.", fix: [sideBolts(1, [yS2])], tools: ["screwdriver"] },
    { title: "Tap the dowels into both frames", detail: "Ten in all, five in each frame: below each rail's cam bolt and one for the bottom.", fix: [sideDowels(-1), sideDowels(1)], tools: ["hammer"] },
    {
      title: "Screw on the runner brackets",
      detail: "Four, two inside each frame at the drawer's height, front and back.",
      fix: SX.map((sx) => fit("clip", [D / 2 - 80, -D / 2 + 80].map((z) => [sx * xi, yBot + 60, z] as Vec3), [sx, 0, 0], { on: sid(sx), name: "Runner bracket", len: 30, dia: 30 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the runner wheels on",
      detail: "The one marked L on the left frame, R on the right, at the front. Two screws each.",
      fix: [
        ...SX.map((sx) => fit("roller", [[sx * xi, yBot + 30, D / 2 - 60]], [sx, 0, 0], { on: sid(sx), name: "Runner wheel", len: 20, dia: 30 })),
        ...SX.map((sx) => fit("screw", [-15, 15].map((dz) => [sx * xi, yBot + 50, D / 2 - 60 + dz] as Vec3), [sx, 0, 0], { on: sid(sx), len: 12, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Screw in the feet", detail: "One into the bottom of each front post, by hand.", fix: SX.map((sx) => fit("foot", [[sx * xP, 0, zP]], [0, 1, 0], { on: sid(sx), len: 25, dia: 30 })) },
    { title: "Stand the four rails in the left frame", detail: "Onto the dowels and the cam bolts, two at the top and two at the bottom.", add: ["FT", "BT", "FB", "BB"], from: { FT: [300, 0, 0], BT: [300, 0, 0], FB: [300, 0, 0], BB: [300, 0, 0] } },
    { title: "Lock three of them", detail: "Turn the cam locks clockwise until they're tight.", fix: railCams(-1, ["FT", "BT", "FB"]), tools: ["screwdriver"] },
    { title: "Stand the two shelves in and lock them", detail: "The upper one near the top, the lower one above the drawer. Two cam locks each.", add: ["S1", "S2"], fix: shelfCams(-1, ["S1", "S2"]), from: { S1: [300, 0, 0], S2: [300, 0, 0] }, tools: ["screwdriver"] },
    { title: "Slide the bottom in", detail: "Into the groove along the bottom rails, onto its dowel.", add: ["BP"], from: { BP: [300, 0, 0] } },
    { title: "Lower the right frame on top", detail: "Onto all the dowels and cam bolts at once. One of you guides each end.", add: ["SR"], from: { SR: [350, 0, 0] }, people: 2, warnings: ["two"] },
    { title: "Lock the rails on this side", detail: "Three cam locks, clockwise.", fix: railCams(1, ["FT", "BT", "FB"]), tools: ["screwdriver"] },
    { title: "Lock the last rail and the shelf", detail: "Four more cam locks: the back bottom rail at both ends and the lower shelf.", fix: [...railCams(-1, ["BB"]), ...railCams(1, ["BB"]), ...shelfCams(1, ["S2"])], tools: ["screwdriver"] },
    {
      title: "Screw the holders onto the clothes rail",
      detail: "One into each end of the rail.",
      fix: SX.map((sx) => fit("hook", [[sx * xi, yRod, 0]], [-sx, 0, 0], { on: "R", name: "Rail holder", len: 30, dia: 25 })),
      wait: ["R"],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the clothes rail",
      detail: "Under the upper shelf. A bolt with a washer through each side frame into its holder.",
      add: ["R"],
      from: { R: [0, -300, 0] },
      fix: [...SX.map((sx) => fit("washer", [[sx * (W / 2 - 11), yRod, 0]], [-sx, 0, 0], { len: 1.5, dia: 16 })), ...SX.map((sx) => fit("bolt", [[sx * (W / 2 - 11), yRod, 0]], [-sx, 0, 0], { on: sid(sx), len: 40, dia: 6 }))],
      tools: ["allen"],
    },
    { title: "Slide the back panel in", detail: "From the top end, along the grooves, finished side facing in.", add: ["K"], from: { K: [0, 600, 0] } },
    { title: "Stand the wardrobe up", detail: "Lift it onto its feet together.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Screw the cam bolts into the side mouldings",
      detail: "Lay the three crown mouldings on the rug. One bolt into the front end of each side moulding.",
      fix: SX.map((sx) => fit("camScrew", [[sx * (W / 2 + 5), Hc + 30, D / 2 - 20]], [0, 0, -1], { on: sx < 0 ? "ML" : "MR", ...CAMBOLT })),
      wait: ["MF", "ML", "MR", "T"],
      // the crown is put together beside the wardrobe, all its pieces moved aside together
      from: { MF: [W + 300, 0, 0], ML: [W + 300, 0, 0], MR: [W + 300, 0, 0], T: [W + 300, 0, 0] },
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Tap the dowels into the mouldings",
      detail: "Six: two at each corner joint and two along the front.",
      fix: [...SX.map((sx) => fit("dowel", [Hc + 12, Hc + 48].map((y) => [sx * (W / 2 + 5), y, D / 2 - 20] as Vec3), [0, 0, -1], { on: sx < 0 ? "ML" : "MR", ...DOWEL })), fit("dowel", [-W / 4, W / 4].map((x) => [x, Hc + 30, D / 2 - 10] as Vec3), [0, 0, 1], { on: "MF", ...DOWEL })],
      tools: ["hammer"],
    },
    { title: "Join the mouldings into a crown", detail: "Push the front moulding onto both side pieces and turn its two cam locks.", fix: [fit("cam", SX.map((sx) => [sx * (W / 2 - 25), Hc + 30, D / 2 - 10] as Vec3), [0, 0, 1], { on: "MF", ...CAM })], tools: ["screwdriver"] },
    {
      title: "Screw the top panel into the crown",
      detail: "Turn the crown over and lay the top panel inside it. Four long screws through the panel's edges.",
      fix: [fit("screw", [[-W / 4, Hc + 18, D / 2 - 5], [W / 4, Hc + 18, D / 2 - 5], [-(W / 2 - 5), Hc + 18, 0], [W / 2 - 5, Hc + 18, 0]], [0, -1, 0], { on: "T", len: 40, dia: 5 })],
      tools: ["allen"],
    },
    {
      title: "Screw on the wall brackets",
      detail: "Two, on top of the panel at the back, each with a screw and a washer. Leave them loose in their slots.",
      fix: [fit("angle", SX.map((sx) => [sx * (xi - 80), Hc + 18, -D / 2 + 20] as Vec3), [0, -1, 0], { on: "T", name: "Wall bracket", len: 50, dia: 30 }), fit("washer", SX.map((sx) => [sx * (xi - 80), Hc + 22, -D / 2 + 50] as Vec3), [0, -1, 0], { on: "T", len: 1.5, dia: 12 }), fit("screw", SX.map((sx) => [sx * (xi - 80), Hc + 22, -D / 2 + 50] as Vec3), [0, -1, 0], { on: "T", len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Screw the cam bolts under the top", detail: "Six, three along the front edge and three along the back.", fix: [fit("camScrew", topBolts, [0, 1, 0], { on: "T", ...CAMBOLT })], tools: ["screwdriver"] },
    { title: "Lower the top onto the wardrobe", detail: "Its cam bolts go into the top rails. Two of you, one at each end.", add: ["T", "MF", "ML", "MR"], from: { T: [0, 400, 0], MF: [0, 400, 0], ML: [0, 400, 0], MR: [0, 400, 0] }, people: 2, warnings: ["two"] },
    {
      title: "Lock the top on",
      detail: "Six cam locks inside the top rails.",
      fix: [fit("cam", [-xi + 100, 0, xi - 100].map((x) => [x + 30, Hc - 20, zF - 12.5] as Vec3), [0, 0, 1], { on: "FT", ...CAM }), fit("cam", [-xi + 100, 0, xi - 100].map((x) => [x + 30, Hc - 20, zB + 12.5] as Vec3), [0, 0, -1], { on: "BT", ...CAM })],
      tools: ["screwdriver"],
    },
    { title: "Screw the top down at the back", detail: "Two long screws through the top into the back posts.", fix: [fit("screw", SX.map((sx) => [sx * xP, Hc + 18, -zP] as Vec3), [0, -1, 0], { on: "T", len: 60, dia: 5 })], tools: ["allen"] },
    { title: "Screw on the drawer stops", detail: "Two small screws into the top of the front bottom rail.", fix: [fit("screw", SX.map((sx) => [sx * (xi - 60), yBot, zF] as Vec3), [0, -1, 0], { on: "FB", name: "Drawer stop", len: 16, dia: 4 })], tools: ["screwdriver"] },
    { title: "Push in the plastic pins", detail: "Two under the upper shelf and two under the lower one, at the front, so the shelves can't tip.", fix: SX.map((sx) => fit("pin", [yS1, yS2].map((y) => [sx * xi, y - 4, D / 2 - 80] as Vec3), [sx, 0, 0], { on: sid(sx) })) },
    {
      title: "Click the hinge plates into the front posts",
      detail: "Sixteen, eight up each post, in pairs where the hinges go. Press until they click.",
      fix: SX.map((sx) => fit("plate", hy.flatMap((y) => [y - 16, y + 16].map((yy) => [sx * xi, yy, D / 2 - 25] as Vec3)), [sx, 0, 0], { on: sid(sx), name: "Hinge plate", len: 10, dia: 20 })),
    },
    { title: "Level it with the feet", detail: "Turn the two front feet until it stands level and doesn't rock.", tools: ["level"] },
    {
      title: "Fix it to the wall",
      detail: "Mark through the brackets, drill, plug and screw them to the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [fit("plug", SX.map((sx) => [sx * (xi - 80), Hc + 40, -D / 2 - 4] as Vec3), [0, 0, -1]), fit("screw", SX.map((sx) => [sx * (xi - 80), Hc + 40, -D / 2 + 2] as Vec3), [0, 0, -1], { len: 50, dia: 5 })],
      wall: true,
      tools: ["drill", "screwdriver", "pencil"],
      warnings: ["wall", "tip"],
    },
    { title: "Screw the hinges onto the left door", detail: "Lay it face down. Four hinges along its outer edge.", fix: [fit("hinge", hy.map((y) => [-(xi - 20), y, D / 2 - 20] as Vec3), [0, 0, 1], { on: "D1" })], tools: ["screwdriver"], wait: ["D1", "D2"] },
    { title: "Screw the hinges onto the right door", detail: "The same way, along its outer edge.", fix: [fit("hinge", hy.map((y) => [xi - 20, y, D / 2 - 20] as Vec3), [0, 0, 1], { on: "D2", twist: Math.PI })], tools: ["screwdriver"] },
    { title: "Clip the doors on", detail: "Hook each hinge onto its plate and press until it clicks. Turn the hinge screws to even out the gaps.", add: ["D1", "D2"], from: { D1: [0, 0, 300], D2: [0, 0, 300] }, kind: "hinges", tools: ["screwdriver"] },
    { title: "Screw the cam bolts into the drawer front", detail: "Lay it face down. Four bolts, two near each end.", fix: [fit("camScrew", SX.flatMap((sx) => [dsY - 40, dsY + 40].map((y) => [sx * dsX, y, D / 2 - 20] as Vec3)), [0, 0, 1], { on: "DF", ...CAMBOLT })], wait: ["DF"], from: { DF: [0, 0, 400] }, tools: ["screwdriver"] },
    {
      title: "Push the drawer sides onto the front",
      detail: "Grooves facing in, then turn the four cam locks in the sides.",
      add: ["DF", "DL", "DR"],
      from: { DF: [0, 0, 400], DL: [0, 0, 400], DR: [0, 0, 400] },
      fix: SX.map((sx) => fit("cam", [dsY - 40, dsY + 40].map((y) => [sx * (dsX - 7.5), y, D / 2 - 50] as Vec3), [sx, 0, 0], { on: sx < 0 ? "DL" : "DR", ...CAM })),
      tools: ["screwdriver"],
    },
    { title: "Slide the bottom in", detail: "Along the grooves until it reaches the front.", add: ["DB"], from: { DB: [0, 0, -300] } },
    {
      title: "Screw the back on",
      detail: "Between the sides, over the bottom. Two screws through each side.",
      add: ["DK"],
      from: { DK: [0, 0, -300] },
      fix: SX.map((sx) => fit("screw", [dsY - 30, dsY + 50].map((y) => [sx * (dsX + 7.5), y, dzB + 7.5] as Vec3), [-sx, 0, 0], { on: sx < 0 ? "DL" : "DR", len: 30, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the runners onto the drawer sides",
      detail: "One on each side, three screws each.",
      fix: SX.map((sx) => fit("screw", [-0.3, 0, 0.3].map((f) => [sx * (dsX + 7.5), dsY - 70, D / 2 - 20 - dbD / 2 + f * dbD] as Vec3), [-sx, 0, 0], { on: sx < 0 ? "DL" : "DR", len: 12, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the knobs",
      detail: "One on each door near the middle and one on the drawer, each screw from behind.",
      fix: [fit("knob", knobs.map((p) => [p[0], p[1], D / 2 + 4] as Vec3), [0, 0, -1], { dia: 30 }), fit("screw", knobs.map((p) => [p[0], p[1], D / 2 - 24] as Vec3), [0, 0, 1], { len: 30, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Slide the drawer in", detail: "Onto the runner wheels, all the way in. Check the doors close evenly.", kind: "drawer" },
  ];
  return { parts, steps };
}

/* ---------- changing table / chest of drawers ---------- */

/**
 * The changing table, from its manual. Both side frames lie on a rug for their glides, bolts, dowels and runners.
 * On its left side, the two bottom rails stand in, the shelf hooks onto its bolts, the two back boards and the bottom
 * go in and the right frame goes on top; screws join the back to the shelf. The changing top is put together
 * upside down beside it: the leaf with its short rails on long bolts, the back rail and two side rails on cam bolts,
 * the base board screwed under them, the folding hinges, cam bolts and wall brackets. It goes on the chest, is fixed
 * to the wall and locked open, then the two drawers are built on their fronts and slide in on metal runners.
 * IKEA's sizes are 78 wide, 79 deep (54 with the leaf folded in) and 99 high.
 */
function changing(): CustomParams {
  const Wc = 760, P = 45, Dc = 520, Hc = 870; // the chest
  const xP = Wc / 2 - P / 2, xi = Wc / 2 - P, iw = 2 * xi, zP = Dc / 2 - P / 2;
  const RT = 30, rx = xi + RT / 2; // the frames' rails, flush with the inside of the posts
  const yB = 250, yS = 660, T = 18; // top of the bottom, underside of the shelf
  const side = (id: string, g: number): CustomPart => ({
    id,
    name: "Side frame",
    size: [P, Hc, Dc],
    pos: [g * xP, Hc / 2, 0],
    material: "wood",
    pieces: [
      box([P, Hc, P], [0, 0, zP]),
      box([P, Hc, P], [0, 0, -zP]),
      box([RT, 70, Dc - 2 * P], [g * (rx - xP), Hc / 2 - 35, 0]),
      box([RT, 80, Dc - 2 * P], [g * (rx - xP), 210 - Hc / 2, 0]),
      { shape: "box", size: [12, Hc - 70 - yB, Dc - 2 * P], pos: [0, (yB + Hc - 70) / 2 - Hc / 2, 0], material: "board" },
    ],
  });
  const yR = 202; // the bottom rails' centre
  const kH = (Hc - 10 - yB) / 2, kT = 15, zK = -zP; // two back boards, one above the other, in the posts' grooves
  const zSB = zK + kT / 2; // the shelf stops at the back boards
  // the changing top: base board over the chest, the leaf in front of it, rails round three sides
  const TW = 780, RW = 18, RH = 100, zSplit = 270, zFront = 520, zBack = -270;
  const yT = Hc + T, xr = TW / 2 - RW / 2, xl = TW / 2 - RW;
  const parts: CustomPart[] = [
    side("SL", -1),
    side("SR", 1),
    { id: "RF", name: "Bottom rail", size: [iw, 60, 22], pos: [0, yR, zP], material: "wood" },
    { id: "RB", name: "Bottom rail", size: [iw, 60, 22], pos: [0, yR, -zP], material: "wood" },
    { id: "SH", name: "Shelf", size: [iw, T, Dc / 2 - 5 - zSB], pos: [0, yS + T / 2, (Dc / 2 - 5 + zSB) / 2], material: "board" },
    { id: "K1", name: "Back board", size: [iw, kH, kT], pos: [0, yB + kH / 2, zK], material: "wood" },
    { id: "K2", name: "Back board", size: [iw, kH, kT], pos: [0, yB + kH * 1.5, zK], material: "wood" },
    { id: "BT", name: "Bottom", size: [iw, T, Dc - 10], pos: [0, yB - T / 2, 0], material: "board" },
    { id: "LB", name: "Leaf", size: [2 * xl, T, zFront - zSplit], pos: [0, Hc + T / 2, (zSplit + zFront) / 2], material: "board" },
    ...[-1, 1].map((g): CustomPart => ({ id: g < 0 ? "LL" : "LR", name: "Leaf side rail", size: [RW, RH + T, zFront - zSplit], pos: [g * xr, Hc + (RH + T) / 2, (zSplit + zFront) / 2], material: "wood" })),
    { id: "TB", name: "Back rail", size: [TW, RH, RW], pos: [0, yT + RH / 2, zBack + RW / 2], material: "wood" },
    ...[-1, 1].map((g): CustomPart => ({ id: g < 0 ? "TL" : "TR", name: "Side rail", size: [RW, RH, zSplit - zBack - RW], pos: [g * xr, yT + RH / 2, (zSplit + zBack + RW) / 2], material: "wood" })),
    { id: "BB", name: "Base board", size: [TW, T, zSplit - zBack], pos: [0, Hc + T / 2, (zSplit + zBack) / 2], material: "board" },
  ];
  // the drawers: two openings between the bottom and the shelf, fronts flush with the front posts
  const dh = (yS - yB) / 2, sT = 15, xs = xi - 13 - sT / 2, sH = 150, dD = 450, zF = Dc / 2 - 20, zDB = zF - dD;
  const dz = (zF + zDB) / 2;
  const drawers = [0, 1].map((i) => {
    const y0 = yB + i * dh, ys = y0 + 20 + sH / 2;
    const k = (n: string) => `${n}${i}`;
    parts.push(
      { id: k("DF"), name: "Drawer front", size: [iw - 4, dh - 4, 20], pos: [0, y0 + dh / 2, Dc / 2 - 10], material: "wood" },
      ...[-1, 1].map((g): CustomPart => ({ id: k(g < 0 ? "DL" : "DR"), name: "Drawer side", size: [sT, sH, dD], pos: [g * xs, ys, dz], material: "board" })),
      { id: k("DB"), name: "Drawer bottom", size: [2 * xs - sT, 4, dD - 10], pos: [0, y0 + 30, dz], material: "fiber" },
      { id: k("DK"), name: "Drawer back", size: [2 * xs - sT, sH - 20, sT], pos: [0, ys + 10, zDB + sT / 2], material: "board" },
    );
    return { y0, ys, run: y0 + 40, front: k("DF"), sides: [k("DL"), k("DR")] as [string, string], bottom: k("DB"), back: k("DK") };
  });
  const G = [-1, 1] as const;
  const sid = (g: number) => (g < 0 ? "SL" : "SR");
  const fit = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
  const CB = { len: 34, dia: 7 }, LCB = { len: 44, dia: 7, name: "Long cam bolt" }, CAM = { len: 13, dia: 15 }, DOW = { len: 30, dia: 8 };
  const inner = (g: number, y: number, z: number): Vec3 => [g * xi, y, z];
  // the frames' joints: a cam bolt and a dowel at each rail end, each back board and the bottom
  const boltsShort = (g: number) => fit("camScrew", [inner(g, yR + 15, zP), inner(g, yR + 15, -zP)], [g, 0, 0], { on: sid(g), ...CB });
  const boltsLong = (g: number) => fit("camScrew", [inner(g, yB + kH - 60, zK), inner(g, Hc - 70, zK), inner(g, yB - T / 2, -150), inner(g, yB - T / 2, 150)], [g, 0, 0], { on: sid(g), ...LCB });
  const frameDowels = (g: number) =>
    fit("dowel", [inner(g, yR - 15, zP), inner(g, yR - 15, -zP), inner(g, yB + 60, zK), inner(g, yB + 180, zK), inner(g, yB + kH + 90, zK), ...[-220, 0, 220].map((z) => inner(g, yB - T / 2, z))], [g, 0, 0], { on: sid(g), ...DOW });
  const hookAt = (g: number) => [-180, 180].map((z) => inner(g, yS + T / 2, z));
  const railCams = (g: number) => [fit("cam", [[g * (xi - 30), yR + 15, zP - 11]], [0, 0, 1], { on: "RF", ...CAM }), fit("cam", [[g * (xi - 30), yR + 15, -zP + 11]], [0, 0, -1], { on: "RB", ...CAM })];
  const backCams = (g: number) => [fit("cam", [[g * (xi - 30), yB + kH - 60, zK + kT / 2]], [0, 0, -1], { on: "K1", ...CAM }), fit("cam", [[g * (xi - 30), Hc - 70, zK + kT / 2]], [0, 0, -1], { on: "K2", ...CAM })];
  const bottomCams = (g: number) => fit("cam", [-150, 150].map((z): Vec3 => [g * (xi - 30), yB, z]), [0, -1, 0], { on: "BT", ...CAM });
  const runY = drawers.map((d) => d.run);
  // the changing top's fittings
  const leafZ = [zSplit + 50, zFront - 50], leafDowelZ = [zSplit + 110, zFront - 100];
  const topBoltZ = [-170, 0, 170];
  const tl = (g: number) => (g < 0 ? "TL" : "TR"), ll = (g: number) => (g < 0 ? "LL" : "LR");
  const wallAt = (y: number, z: number) => G.map((g): Vec3 => [g * 250, y, z]);
  const D = drawers;
  const dAll = <T,>(f: (d: (typeof D)[number]) => T[]) => D.flatMap(f);
  const wait = (ids: string[]) => Object.fromEntries(ids.map((k) => [k, [0, 0, 650] as Vec3]));
  const aside = (ids: string[]) => Object.fromEntries(ids.map((k) => [k, [TW + 250, 0, 0] as Vec3]));
  const steps: CustomStep[] = [
    {
      title: "Tap the glides into the legs",
      detail: "Lay both side frames on a rug, inside up. One glide into the foot of each leg.",
      add: ["SL"],
      wait: ["SR"],
      from: { SR: [-450, 0, 700] },
      fix: G.map((g) => fit("glide", [[g * xP, 0, zP], [g * xP, 0, -zP]], [0, 1, 0], { on: sid(g), len: 8, dia: 22 })),
      pose: "+x",
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Screw in the short cam bolts", detail: "Two in each frame, at the bottom rail holes. By hand until they stop.", fix: G.map(boltsShort), tools: ["screwdriver"] },
    { title: "Screw in the hook bolts for the shelf", detail: "Two in each frame, leaving the heads out so the shelf's hooks can slip over them.", fix: G.map((g) => fit("stud", hookAt(g), [g, 0, 0], { on: sid(g), name: "Hook bolt", len: 20, dia: 10 })), tools: ["screwdriver"] },
    { title: "Screw in the long cam bolts", detail: "Four in each frame: two for the back boards and two for the bottom.", fix: G.map(boltsLong), tools: ["screwdriver"] },
    { title: "Tap in the dowels", detail: "Eight in each frame. Tap gently so they don't split the wood.", fix: G.map(frameDowels), tools: ["hammer"] },
    {
      title: "Screw the runners into the frames",
      detail: "Two in each frame, the one marked R on the right frame and L on the left, wheel at the front. Two screws each.",
      fix: [
        ...G.map((g) => fit("runner", runY.map((y) => inner(g, y, dz)), [g, 0, 0], { on: sid(g), name: "Cabinet runner", len: 460, dia: 30 })),
        ...G.map((g) => fit("screw", runY.flatMap((y) => [-1, 1].map((sz) => inner(g, y, sz * (zP - 12)))), [g, 0, 0], { on: sid(g), len: 12, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Stand the two bottom rails in the left frame", detail: "Onto their dowels and cam bolts, one at the front and one at the back.", add: ["RF", "RB"], from: { RF: [400, 0, 0], RB: [400, 0, 0] } },
    { title: "Lock the rails", detail: "Turn the two cam locks clockwise until they pull tight.", fix: railCams(-1), tools: ["screwdriver"] },
    { title: "Hook the shelf on", detail: "Slide it in from the top end of the frame until its two hooks drop over the hook bolts.", add: ["SH"], from: { SH: [0, 500, 0] } },
    { title: "Tighten the hook bolts", detail: "Turn the two bolts through the hooks so the shelf is pulled tight against the frame.", tools: ["screwdriver"] },
    {
      title: "Join the two back boards",
      detail: "Two dowels in the edge of one board, then press the other one onto them.",
      fix: [fit("dowel", [-200, 200].map((x): Vec3 => [x, yB + kH, zK]), [0, -1, 0], { on: "K1", mate: "K2", ...DOW })],
      wait: ["K1", "K2"],
      from: { K1: [0, 0, -500], K2: [0, 0, -500] },
      tools: ["hammer"],
    },
    { title: "Push the back into the left frame", detail: "Along the grooves in the back post, onto the dowels and bolts.", add: ["K1", "K2"], from: { K1: [400, 0, 0], K2: [400, 0, 0] } },
    { title: "Lock the back", detail: "Two cam locks, one in each board.", fix: backCams(-1), tools: ["screwdriver"] },
    {
      title: "Put the bottom in",
      detail: "Two dowels in its free end first, then push it onto the frame over the bottom rails.",
      fix: [fit("dowel", [-100, 100].map((z): Vec3 => [xi, yB - T / 2, z]), [-1, 0, 0], { on: "BT", ...DOW })],
      add: ["BT"],
      from: { BT: [400, 0, 0] },
      tools: ["hammer"],
    },
    { title: "Lock the bottom", detail: "Two cam locks, clockwise.", fix: [bottomCams(-1)], tools: ["screwdriver"] },
    { title: "Lower the right frame on top", detail: "Onto all the dowels and bolts at once, the shelf's hooks over its hook bolts.", add: ["SR"], from: { SR: [400, 0, 0] }, people: 2, warnings: ["two"] },
    { title: "Tighten the hook bolts on this side", detail: "The two bolts through the shelf's hooks, as before.", tools: ["screwdriver"] },
    { title: "Lock the right frame", detail: "Six cam locks: the rails, the back boards and the bottom.", fix: [...railCams(1), ...backCams(1), bottomCams(1)], tools: ["screwdriver"] },
    {
      title: "Screw the back to the shelf",
      detail: "Four screws through the back board into the shelf's back edge.",
      fix: [fit("screw", [-240, -80, 80, 240].map((x): Vec3 => [x, yS + T / 2, zK - kT / 2]), [0, 0, 1], { on: "K2", mate: "SH", len: 40, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Stand the chest up", detail: "Lift it onto its legs together.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Push the leaf's side rails on",
      detail: "Lay the leaf on the rug and tap two dowels into each end, then press the short side rails on, angled ends at the back.",
      fix: G.map((g) => fit("dowel", leafDowelZ.map((z): Vec3 => [g * xl, Hc + T / 2, z]), [-g, 0, 0], { on: "LB", mate: ll(g), ...DOW })),
      wait: ["LB", "LL", "LR"],
      from: aside(["LB", "LL", "LR"]),
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the side rails to the leaf",
      detail: "Barrel nuts into the leaf from below, slot toward the bolt, then a long bolt through each rail into it. Two each side.",
      fix: [
        ...G.map((g) => fit("nut", leafZ.map((z): Vec3 => [g * (xl - 40), Hc, z]), [0, 1, 0], { on: "LB", name: "Barrel nut", len: 14, dia: 10 })),
        ...G.map((g) => fit("bolt", leafZ.map((z): Vec3 => [g * TW / 2, Hc + T / 2, z]), [-g, 0, 0], { on: ll(g), mate: "LB", len: 80, dia: 6 })),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw the cam bolts into the back rail",
      detail: "One near each end, on the side with the warning label. By hand until they stop.",
      fix: [fit("camScrew", G.map((g): Vec3 => [g * xr, yT + RH / 2 + 15, zBack + RW]), [0, 0, -1], { on: "TB", ...LCB })],
      wait: ["TB", "TL", "TR"],
      from: aside(["TB", "TL", "TR"]),
      tools: ["screwdriver"],
    },
    {
      title: "Push the side rails onto the back rail",
      detail: "Two dowels in each end of the back rail first, then press the side rails on, angled ends at the front.",
      fix: G.map((g) => fit("dowel", [yT + 25, yT + RH - 20].map((y): Vec3 => [g * xr, y, zBack + RW]), [0, 0, -1], { on: "TB", mate: tl(g), ...DOW })),
      tools: ["hammer"],
    },
    { title: "Lock the corners", detail: "One cam lock inside each side rail, clockwise.", fix: G.map((g) => fit("cam", [[g * xl, yT + RH / 2 + 15, zBack + RW + 30]], [g, 0, 0], { on: tl(g), ...CAM })), tools: ["screwdriver"] },
    {
      title: "Tap the long dowels into the rails",
      detail: "Turn the rails over so their bottom edges face up. Three long dowels in the back rail and two in each side rail.",
      fix: [
        fit("dowel", [-250, 0, 250].map((x): Vec3 => [x, yT, zBack + RW / 2]), [0, 1, 0], { on: "TB", mate: "BB", len: 50, dia: 10 }),
        ...G.map((g) => fit("dowel", [-120, 160].map((z): Vec3 => [g * xr, yT, z]), [0, 1, 0], { on: tl(g), mate: "BB", len: 50, dia: 10 })),
      ],
      tools: ["hammer"],
    },
    {
      title: "Screw the base board onto the rails",
      detail: "Lay it on the dowels and drive six long screws through it into the rails with the Allen key, then turn the top over.",
      fix: [
        fit("screw", [-200, 200].map((x): Vec3 => [x, Hc, zBack + RW / 2]), [0, 1, 0], { on: "BB", mate: "TB", len: 70, dia: 5 }),
        ...G.map((g) => fit("screw", [-160, 200].map((z): Vec3 => [g * xr, Hc, z]), [0, 1, 0], { on: "BB", mate: tl(g), len: 70, dia: 5 })),
      ],
      wait: ["BB"],
      from: aside(["BB"]),
      tools: ["allen"],
    },
    { title: "Fit the folding hinges", detail: "Line the leaf up in front of the base board and set a hinge over each joint between the rails.", fix: G.map((g) => fit("hinge", [[g * xr, yT + RH, zSplit]], [0, -1, 0], { on: tl(g), mate: ll(g), name: "Folding hinge", len: 90, dia: 30 })) },
    {
      title: "Screw the hinges on",
      detail: "A sleeve nut from the inside and a screw from the outside, two per hinge. Check the leaf folds in and out freely.",
      fix: [
        ...G.map((g) => fit("nut", [[g * xl, yT + 50, zSplit - 40], [g * xl, yT + 50, zSplit + 40]], [g, 0, 0], { on: tl(g), name: "Sleeve nut", len: 15, dia: 8 })),
        ...G.map((g) => fit("screw", [[g * TW / 2, yT + 50, zSplit - 40], [g * TW / 2, yT + 50, zSplit + 40]], [-g, 0, 0], { on: tl(g), len: 16, dia: 6 })),
      ],
      tools: ["allen"],
    },
    { title: "Screw the cam bolts under the base board", detail: "Turn the top upside down again. Three along each side, by hand.", fix: [fit("camScrew", G.flatMap((g) => topBoltZ.map((z): Vec3 => [g * rx, Hc, z])), [0, 1, 0], { on: "BB", ...CB })], tools: ["screwdriver"] },
    {
      title: "Screw on the wall brackets",
      detail: "Two, under the base board at the back, each with a screw and a washer. Leave them loose in their slots.",
      fix: [fit("angle", wallAt(Hc, zBack + 15), [0, 1, 0], { on: "BB", name: "Wall bracket", len: 60, dia: 30, included: true }), fit("washer", wallAt(Hc - 2, zBack + 40), [0, 1, 0], { on: "BB", len: 1.5, dia: 12 }), fit("screw", wallAt(Hc - 2, zBack + 40), [0, 1, 0], { on: "BB", len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Lower the top onto the chest",
      detail: "The right way up, its cam bolts into the holes in the side frames. One of you at each end.",
      add: ["BB", "TB", "TL", "TR", "LB", "LL", "LR"],
      from: Object.fromEntries(["BB", "TB", "TL", "TR", "LB", "LL", "LR"].map((k) => [k, [0, 400, 0] as Vec3])),
      people: 2,
      warnings: ["two"],
    },
    { title: "Lock the top on", detail: "Six cam locks inside the top rails of the side frames.", fix: G.map((g) => fit("cam", topBoltZ.map((z): Vec3 => [g * xi, Hc - 25, z]), [g, 0, 0], { on: sid(g), ...CAM })), tools: ["screwdriver"] },
    {
      title: "Fix it to the wall",
      detail: "Push the chest against the wall, mark through the brackets, drill, then plug and screw them on with the washers. Pick plugs made for your wall if the ones in the box don't suit it.",
      fix: [fit("plug", wallAt(yT + 40, zBack - 6), [0, 0, -1], { len: 35, dia: 8, included: true }), fit("washer", wallAt(yT + 40, zBack + 2), [0, 0, -1], { len: 1.5, dia: 16 }), fit("screw", wallAt(yT + 40, zBack + 2), [0, 0, -1], { len: 50, dia: 5, included: true })],
      wall: true,
      tools: ["drill", "screwdriver", "pencil"],
      warnings: ["wall", "tip"],
    },
    {
      title: "Lock the leaf open",
      detail: "Screw a locking plate over each hinge from the inside. To use it as a chest later, fold the leaf in and lock it the same way.",
      fix: [...G.map((g) => fit("plate", [[g * xl, yT + 60, zSplit]], [g, 0, 0], { on: tl(g), name: "Locking plate", len: 60, dia: 20 })), ...G.map((g) => fit("screw", [[g * xl, yT + 60, zSplit - 20]], [g, 0, 0], { on: tl(g), len: 10, dia: 6 }))],
      tools: ["allen"],
    },
    {
      title: "Screw the cam bolts into the drawer fronts",
      detail: "Lay both fronts face down on the rug. Four bolts in each, by hand.",
      fix: dAll((d) => G.map((g, j) => fit("camScrew", [d.ys - 40, d.ys + 40].map((y): Vec3 => [g * xs, y, zF]), [0, 0, 1], { on: d.front, mate: d.sides[j], len: 30, dia: 7, name: "Drawer cam bolt" }))),
      wait: D.map((d) => d.front),
      from: wait(D.map((d) => d.front)),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Stand the sides on the fronts",
      detail: "Two dowels in the front end of each side, then press the sides onto the dowels and bolts, grooves facing in.",
      fix: dAll((d) => G.map((g, j) => fit("dowel", [d.ys - 60, d.ys + 60].map((y): Vec3 => [g * xs, y, zF]), [0, 0, -1], { on: d.sides[j], mate: d.front, len: 25, dia: 8 }))),
      wait: dAll((d) => d.sides),
      from: wait(dAll((d) => d.sides)),
      tools: ["hammer"],
    },
    {
      title: "Lock the sides",
      detail: "Two cam locks in each side, clockwise.",
      fix: dAll((d) => G.map((g, j) => fit("cam", [d.ys - 40, d.ys + 40].map((y): Vec3 => [g * (xs - sT / 2), y, zF - 28]), [g, 0, 0], { on: d.sides[j], len: 12, dia: 15, name: "Drawer cam lock" }))),
      tools: ["screwdriver"],
    },
    { title: "Slide in the drawer bottoms", detail: "Down the grooves in the sides until each one reaches its front.", wait: D.map((d) => d.bottom), from: wait(D.map((d) => d.bottom)) },
    { title: "Set the backs on", detail: "Lay each back across the ends of its sides, over the bottom.", wait: D.map((d) => d.back), from: wait(D.map((d) => d.back)) },
    {
      title: "Push in the back fittings",
      detail: "Four in each drawer, through the sides into the back.",
      fix: dAll((d) => G.map((g, j) => fit("nail", [d.ys - 30, d.ys + 50].map((y): Vec3 => [g * (xs + sT / 2), y, zDB + sT / 2]), [-g, 0, 0], { on: d.sides[j], mate: d.back, name: "Push-in fitting", len: 35, dia: 6 }))),
      tools: ["screwdriver"],
    },
    {
      title: "Lock the backs",
      detail: "Press a small cam into each hole in the back and turn it until it grips the fitting.",
      fix: D.map((d) => fit("cam", G.flatMap((g) => [d.ys - 30, d.ys + 50].map((y): Vec3 => [g * (xs - sT / 2 - 25), y, zDB])), [0, 0, 1], { on: d.back, len: 10, dia: 12, name: "Small cam lock" })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the runners onto the drawers",
      detail: "One on each side, three screws each, wheel at the back.",
      fix: [
        ...dAll((d) => G.map((g, j) => fit("runner", [[g * (xs + sT / 2), d.run, dz]], [-g, 0, 0], { on: d.sides[j], name: "Drawer runner", len: 440, dia: 30 }))),
        ...dAll((d) => G.map((g, j) => fit("screw", [-150, 15, 180].map((z): Vec3 => [g * (xs + sT / 2), d.run, z]), [-g, 0, 0], { on: d.sides[j], len: 12, dia: 4 }))),
      ],
      tools: ["screwdriver"],
    },
    { title: "Screw on the drawer stops", detail: "One in the middle of each back's top edge. It stops the drawer coming all the way out.", fix: D.map((d) => fit("clip", [[0, d.ys + 10 + (sH - 20) / 2, zDB + sT / 2]], [0, -1, 0], { on: d.back, name: "Drawer stop", len: 25, dia: 20 })), tools: ["screwdriver"] },
    {
      title: "Screw on the knobs",
      detail: "One on each front, the screw and washer from inside the drawer.",
      fix: [
        ...D.map((d) => fit("knob", [[0, d.y0 + dh / 2, Dc / 2]], [0, 0, -1], { on: d.front, len: 25, dia: 30 })),
        ...D.map((d) => fit("washer", [[0, d.y0 + dh / 2, zF - 2]], [0, 0, 1], { on: d.front, len: 1.5, dia: 12 })),
        // the knob isn't a part, so the screw is drawn ending inside the front
        ...D.map((d) => fit("screw", [[0, d.y0 + dh / 2, zF - 8]], [0, 0, 1], { on: d.front, len: 26, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Slide the drawers in",
      detail: "Onto the runners until they click past the stops. Keep them shut while children are around, and never let them climb on it.",
      add: dAll((d) => [d.front, ...d.sides, d.bottom, d.back]),
      from: Object.fromEntries(dAll((d) => [d.front, ...d.sides, d.bottom, d.back]).map((k) => [k, [0, 0, 500] as Vec3])),
      kind: "drawer",
      warnings: ["tip"],
    },
  ];
  return { parts, steps };
}

function recipe(s: ProductSpec): CustomParams | null {
  const slug = s.slug ?? "";
  if (/changing-table/.test(slug)) return changing();
  if (/sundvik-wardrobe/.test(slug)) return wardrobe(s);
  if (/children-s-table/.test(slug)) return table(s);
  if (/children-s-chair/.test(slug)) return chair(s);
  if (/rocking-chair/.test(slug)) return rocker(s);
  if (/sundvik-cot-/.test(slug)) return cot(s, false);
  if (/sundvik-crib-/.test(slug)) return cot(s, true);
  if (/extendable-bed|ext-bed-frame/.test(slug)) return bed(s);
  return null;
}

const family: Family = {
  names: ["SUNDVIK"],
  recipe,
};
export default family;
