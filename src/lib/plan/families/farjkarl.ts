import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FÄRJKARL, read from its manuals. The bookcase, the cabinet and the glass-door cabinet share one carcass: dowels in
 * the ends of both framed sides and a cam bolt near their front, a front rail low down cammed between them, then the
 * bottom panel laid onto the rail (one cam bolt and four screws through the sides on the bookcase, five cam bolts on
 * the cabinets). It is stood up for the two back halves to slide down their grooves, the top goes on (screwed on the
 * bookcase and the glass-door cabinet, cammed on the cabinet) and the back is clipped in. A separate plinth frame on
 * four leg brackets is screwed under the bottom, and the turned legs are bolted into the brackets with nuts. Two
 * spacer fittings at the top hold it to the wall. Then the shelves, and the doors on clip hinges, or on the bookcase
 * a brass rail across the top compartment.
 */

type Kind = CustomFix["kind"];
type Model = "bookcase" | "cabinet" | "glass";
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const G = [-1, 1] as const;
const r = (n: number) => Math.round(n);

const OV = 15; // the top overhangs the carcass at the sides and front
const TT = 25, ST = 30, PT = 20, BT = 20; // top, sides, plinth boards, bottom
const PH = 60; // plinth frame
const RH = 70, RT = 20; // front rail
const LD = 55; // legs
const DOWEL = { len: 30, dia: 8 };
const CAMB = { len: 34, dia: 7 };
const CAM = { len: 13, dia: 15 };
const SCREW = { len: 50, dia: 5, name: "Long screw" };
const PSCREW = { len: 70, dia: 5, name: "Long screw" };
const BSCREW = { len: 14, dia: 5 };
const SMALL = { len: 12, dia: 3.5 };

interface Cfg {
  model: Model;
  legH: number; // legs below the plinth
  shelves: number;
  clips: number; // back clips per side
}

const CFG: Record<Model, Cfg> = {
  bookcase: { model: "bookcase", legH: 250, shelves: 3, clips: 5 },
  cabinet: { model: "cabinet", legH: 250, shelves: 2, clips: 4 },
  glass: { model: "glass", legH: 430, shelves: 2, clips: 5 },
};

const legPieces = (h: number): PartPiece[] => [
  { shape: "box", size: [LD, 90, LD], pos: [0, h / 2 - 45, 0] },
  { shape: "cyl", size: [LD - 6, 24, LD - 6], pos: [0, h / 2 - 102, 0] },
  { shape: "cyl", size: [LD - 12, h - 190, LD - 12], pos: [0, -h / 2 + 76 + (h - 190) / 2, 0] },
  { shape: "cyl", size: [LD - 22, 76, LD - 22], pos: [0, -h / 2 + 38, 0] },
];

/** A framed panel (side or door) as pieces: two stiles and two rails round an opening, for glass to sit in. */
function framePieces(size: Vec3, across: 0 | 2, stile: number, top: number, bottom: number): PartPiece[] {
  const [sx, sy, sz] = size;
  const w = across === 2 ? sz : sx; // the width the stiles divide
  const at = (u: number, y: number): Vec3 => (across === 2 ? [0, y, u] : [u, y, 0]);
  const sz3 = (wu: number, h: number): Vec3 => (across === 2 ? [sx, h, wu] : [wu, h, sz]);
  return [
    { shape: "box", size: sz3(stile, sy), pos: at(-w / 2 + stile / 2, 0) },
    { shape: "box", size: sz3(stile, sy), pos: at(w / 2 - stile / 2, 0) },
    { shape: "box", size: sz3(w - 2 * stile, top), pos: at(0, sy / 2 - top / 2) },
    { shape: "box", size: sz3(w - 2 * stile, bottom), pos: at(0, -sy / 2 + bottom / 2) },
  ];
}

function recipe(s: ProductSpec, c: Cfg): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const glass = c.model === "glass";
  const doors = c.model !== "bookcase";
  const Wc = W - 2 * OV, Dc = D - OV;
  const z0 = -D / 2, zf = z0 + Dc;
  const yb = c.legH + PH, yt = H - TT;
  const xs = Wc / 2 - ST / 2, xi = Wc / 2 - ST;
  const Hs = yt - yb;
  const zc = (z0 + zf) / 2;
  // the front rail sits flush on the bookcase, set back behind the doors on the cabinets
  const zr = doors ? zf - 22 - RT / 2 : zf - RT / 2;
  const yr = yb + RH / 2;
  const yB = yb + RH + BT / 2; // bottom panel, resting on the rail
  const zBf = zr + RT / 2; // bottom panel's front edge
  const zBb = z0 + 14;

  const parts: CustomPart[] = [];
  const P = (p: CustomPart) => parts.push(p);
  for (const [i, sx] of G.entries()) {
    const id = i ? "SR" : "SL";
    const size: Vec3 = [ST, r(Hs), r(Dc)];
    P({ id, name: "Side panel", size, pos: [r(sx * xs), r((yb + yt) / 2), r(zc)], material: "board", ...(glass ? { pieces: framePieces(size, 2, 60, 80, 120) } : {}) });
    if (glass) P({ id: i ? "GR" : "GL", name: "Side glass", size: [6, r(Hs - 200), r(Dc - 120)], pos: [r(sx * xs), r(yb + 120 + (Hs - 200) / 2), r(zc)], material: "glass" });
  }
  P({ id: "R", name: "Front rail", size: [r(2 * xi), RH, RT], pos: [0, r(yr), r(zr)], material: "board" });
  P({ id: "B", name: "Bottom panel", size: [r(2 * xi), BT, r(zBf - zBb)], pos: [0, r(yB), r((zBf + zBb) / 2)], material: "board" });
  for (const [i, sx] of G.entries()) P({ id: `K${i + 1}`, name: "Back panel", size: [r(xi), r(Hs), 4], pos: [r((sx * xi) / 2), r((yb + yt) / 2), r(z0 + 10)], material: "fiber" });
  P({ id: "T", name: "Top", size: [r(W), TT, r(D)], pos: [0, r(H - TT / 2), 0], material: "board" });
  // plinth frame: front and back rails between two end pieces
  const yP = c.legH + PH / 2;
  // on the cabinets the plinth's front sits back under the front rail, behind the doors
  const zp = doors ? zr + RT / 2 : zf, zpc = (z0 + zp) / 2;
  P({ id: "PF", name: "Plinth rail", size: [r(Wc - 2 * PT), PH, PT], pos: [0, r(yP), r(zp - PT / 2)], material: "board" });
  P({ id: "PB", name: "Plinth rail", size: [r(Wc - 2 * PT), PH, PT], pos: [0, r(yP), r(z0 + PT / 2)], material: "board" });
  for (const [i, sx] of G.entries()) P({ id: i ? "PR" : "PL", name: "Plinth end", size: [PT, PH, r(zp - z0)], pos: [r(sx * (Wc / 2 - PT / 2)), r(yP), r(zpc)], material: "board" });
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const lx = Wc / 2 - PT - LD / 2 - 6;
  const lz = (sz: number) => (sz < 0 ? z0 + PT + LD / 2 + 6 : zp - PT - LD / 2 - 6);
  const legLen = c.legH + PH - 5;
  corners.forEach(([sx, sz], i) => P({ id: `G${i + 1}`, name: "Leg", size: [LD, legLen, LD], pos: [r(sx * lx), r(legLen / 2), r(lz(sz))], material: "board", pieces: legPieces(legLen) }));
  // shelves, evenly up the inside
  const inBot = yb + RH + BT;
  const shelfY = (k: number) => inBot + ((yt - inBot) * k) / (c.shelves + 1);
  const ShT = glass ? 6 : 18;
  const shZb = z0 + 16, shZf = doors ? zf - 26 : zf - 10;
  for (let k = 1; k <= c.shelves; k++)
    P({ id: `H${k}`, name: glass ? "Glass shelf" : "Shelf", size: [r(2 * xi - 4), ShT, r(shZf - shZb)], pos: [0, r(shelfY(k) + ShT / 2), r((shZb + shZf) / 2)], material: glass ? "glass" : "board" });
  // doors
  const Wd = xi - 2, Hd = yt - yb - 8;
  const yD = (yb + yt) / 2;
  if (doors)
    for (const [i, sx] of G.entries()) {
      const size: Vec3 = [r(Wd), r(Hd), 20];
      P({ id: `D${i + 1}`, name: glass ? "Glass door" : "Door", size, pos: [r((sx * (xi + 2)) / 2), r(yD), r(zf - 10)], material: "board", ...(glass ? { pieces: framePieces(size, 0, 60, 70, 90) } : {}) });
      if (glass) P({ id: `E${i + 1}`, name: "Door glass", size: [r(Wd - 120), r(Hd - 160), 4], pos: [r((sx * (xi + 2)) / 2), r(yD - 10), r(zf - 10)], material: "glass" });
    }
  // the bookcase's brass rail across the top compartment
  const yRod = yt - 160;
  if (!doors) P({ id: "Q", name: "Front rail rod", size: [r(2 * xi), 12, 12], pos: [0, r(yRod), r(zf - 40)], shape: "cyl", material: "metal" });

  /* ---------- fittings ---------- */
  const sideId = (sx: number) => (sx < 0 ? "SL" : "SR");
  const endZ = [z0 + 60, zf - 60];
  const sideDowelsTop = (sx: number) => fx("dowel", endZ.map((z): Vec3 => [r(sx * xs), yt, r(z)]), [0, -1, 0], { ...DOWEL, on: sideId(sx), mate: "T" });
  const sideDowelsBot = (sx: number) => fx("dowel", endZ.map((z): Vec3 => [r(sx * xs), yb, r(z)]), [0, 1, 0], { ...DOWEL, on: sideId(sx), mate: sx < 0 ? "PL" : "PR" });
  const sideCamBolts = G.map((sx) => fx("camScrew", [[r(sx * xi), r(yr), r(zr)]], [sx, 0, 0], { ...CAMB, on: sideId(sx), mate: "R" }));
  const railDowels = G.map((sx) => fx("dowel", [yb + 15, yb + RH - 15].map((y): Vec3 => [r(sx * xi), y, r(zr)]), [-sx, 0, 0], { ...DOWEL, on: "R", mate: sideId(sx) }));
  const railCams = fx("cam", G.map((sx): Vec3 => [r(sx * (xi - 30)), r(yr), r(zr - RT / 2)]), [0, 0, 1], { ...CAM, on: "R" });
  // bottom joints: cam bolts in its underside or ends, cam locks in the rail and the sides
  const botZ = [zBb + 70, zBf - 70];
  const steps: CustomStep[] = [];
  const S = (st: CustomStep) => steps.push(st);

  S({
    title: "Tap the dowels into the ends of the sides",
    detail: "Lay both sides on a rug, inside face up. Two dowels go into each end.",
    add: glass ? ["SL", "GL", "SR", "GR"] : ["SL", "SR"],
    fix: [sideDowelsTop(-1), sideDowelsTop(1), sideDowelsBot(-1), sideDowelsBot(1)],
    tools: ["hammer"],
    pose: "+z",
    warnings: ["floor"],
  });
  S({ title: "Screw a cam bolt into each side", detail: "Into the hole near the bottom front corner, on the inside face.", fix: sideCamBolts, tools: ["screwdriver"] });
  if (doors) {
    const plates = G.map((sx) => fx("plate", [yb + 140, yt - 140].map((y): Vec3 => [r(sx * xi), r(y), r(zf - 40)]), [sx, 0, 0], { name: "Hinge plate", len: 40, dia: 30, on: sideId(sx) }));
    S({ title: "Screw on the hinge plates", detail: "Two on the inside of each side, by the front edge. Their screws are already in them.", fix: plates, tools: ["screwdriver"] });
  }
  S({ title: "Tap four dowels into the front rail", detail: "Two into each end.", fix: railDowels, tools: ["hammer"] });
  if (doors) {
    const catches: Vec3[] = G.map((sx): Vec3 => [sx * 60, yb + RH, r(zr + 4)]);
    S({
      title: "Screw the door catches onto the rail",
      detail: "Two catches on the middle of the top edge, their tongues facing forwards, two screws in each. Stick a bumper under each tongue.",
      fix: [
        fx("clip", catches, [0, -1, 0], { name: "Door catch", len: 8, dia: 40, on: "R" }),
        fx("screw", catches.flatMap(([x, y, z]): Vec3[] => [[x - 12, y, z], [x + 12, y, z]]), [0, -1, 0], { ...SMALL, on: "R" }),
        fx("glide", catches.map(([x, y, z]): Vec3 => [x, y + 8, z + 14]), [0, -1, 0], { name: "Bumper", len: 2, dia: 14 }),
      ],
      tools: ["screwdriver"],
    });
  }
  S({
    title: "Fit the rail between the sides",
    detail: "Turn the sides up onto their back edges, push the rail onto the dowels at the bottom front and turn the two cam locks clockwise.",
    add: ["R"],
    fix: [railCams],
    tools: ["screwdriver"],
  });
  if (c.model === "bookcase") {
    S({ title: "Screw a cam bolt into the bottom panel", detail: "Into the middle hole along its front edge, on the underside.", fix: [fx("camScrew", [[0, yb + RH, r(zr)]], [0, 1, 0], { ...CAMB, on: "B", mate: "R" })], tools: ["screwdriver"] });
    S({ title: "Lay the bottom panel on the rail", detail: "Swing it in at the bottom end so the cam bolt drops into the rail, then turn the cam lock in the rail.", add: ["B"], fix: [fx("cam", [[0, r(yr), r(zr - RT / 2)]], [0, 0, 1], { ...CAM, on: "R" })], tools: ["screwdriver"] });
    S({
      title: "Screw the sides to the bottom",
      detail: "Two long screws through each side into the bottom panel, with the Allen key. Use the shorter of the two long screws here.",
      fix: G.map((sx) => fx("screw", botZ.map((z): Vec3 => [r(sx * (Wc / 2)), r(yB), r(z)]), [-sx, 0, 0], { ...SCREW, on: sideId(sx), mate: "B" })),
      tools: ["allen"],
    });
  } else {
    const bolts: Vec3[] = [...G.flatMap((sx) => botZ.map((z): Vec3 => [r(sx * xi), r(yB), r(z)])), [0, yb + RH, r(zr)]];
    S({ title: "Screw five cam bolts into the bottom panel", detail: "Two into each end and one in the middle of the front edge, underneath.", fix: [fx("camScrew", bolts, [0, 1, 0], { ...CAMB, on: "B" })], tools: ["screwdriver"] });
    S({
      title: "Fit the bottom panel",
      detail: "Swing it in onto the rail and between the sides, then turn all five cam locks: two in each side and one in the rail.",
      add: ["B"],
      fix: [
        ...G.map((sx) => fx("cam", botZ.map((z): Vec3 => [r(sx * xi), r(yB - 30), r(z)]), [sx, 0, 0], { ...CAM, on: sideId(sx) })),
        fx("cam", [[0, r(yr), r(zr - RT / 2)]], [0, 0, 1], { ...CAM, on: "R" }),
      ],
      tools: ["screwdriver"],
    });
  }
  S({
    title: "Stand it up and slide in the back",
    detail: "The two halves go down the grooves from the top, one at a time, until they sit in the bottom panel's groove.",
    add: ["K1", "K2"],
    pose: "+y",
    people: 2,
    from: { K1: [0, 500, 0], K2: [0, 500, 0] },
    warnings: ["two"],
  });
  if (c.model === "cabinet") {
    const topZ = [z0 + 100, zf - 100];
    S({
      title: "Put the top on with four cam locks",
      detail: "Screw four cam bolts into the top's underside first, then lower it onto the dowels and turn the cam locks in the sides.",
      add: ["T"],
      fix: [
        fx("camScrew", G.flatMap((sx) => topZ.map((z): Vec3 => [r(sx * xs), yt, r(z)])), [0, 1, 0], { ...CAMB, on: "T" }),
        ...G.map((sx) => fx("cam", topZ.map((z): Vec3 => [r(sx * xi), yt - 25, r(z)]), [sx, 0, 0], { ...CAM, on: sideId(sx) })),
      ],
      tools: ["screwdriver"],
    });
  } else {
    S({
      title: "Screw the top on",
      detail: "Lower it onto the dowels, then four long screws down through it into the sides.",
      add: ["T"],
      fix: [fx("screw", G.flatMap((sx) => [z0 + 90, zf - 90].map((z): Vec3 => [r(sx * xs), H, r(z)])), [0, -1, 0], { ...SCREW, on: "T" })],
      tools: ["allen"],
    });
  }
  // back clips along the sides, the top and the bottom
  const n = c.clips;
  const clipAt: Vec3[] = [
    ...G.flatMap((sx) => Array.from({ length: n }, (_, k): Vec3 => [r(sx * (xi + 6)), r(yb + 80 + ((Hs - 160) * k) / (n - 1)), r(z0 + 4)])),
    ...G.map((sx): Vec3 => [r((sx * xi) / 2), yt - 8, r(z0 + 4)]),
    ...G.map((sx): Vec3 => [r((sx * xi) / 2), r(yB), r(z0 + 4)]),
  ];
  S({
    title: `Clip the back in with ${clipAt.length} clips`,
    detail: "Push each clip into its hole so it grips the back, then press a cover into it.",
    fix: [fx("clip", clipAt, [0, 0, 1], { name: "Back clip", len: 14, dia: 12 }), fx("cap", clipAt.map(([x, y, z]): Vec3 => [x, y, z - 4]), [0, 0, 1], { name: "Clip cover", len: 6, dia: 12 })],
    pose: c.model === "bookcase" ? "-z" : "+y",
    warnings: c.model === "bookcase" ? ["floor"] : undefined,
  });
  // plinth frame
  // built beside the carcass, then laid on it as one frame
  const frame = ["PF", "PB", "PL", "PR"];
  const aside = Object.fromEntries(frame.map((id) => [id, [Wc + 300, 0, 0] as Vec3]));
  const pr = (id: string, z: number) => G.map((sx) => fx("dowel", [[r(sx * (Wc / 2 - PT)), r(yP), r(z)]], [-sx, 0, 0], { ...DOWEL, on: id }));
  S({ title: "Tap the dowels into the plinth rails", detail: "Build the plinth frame on the floor. One dowel into each end of both long rails.", fix: [...pr("PF", zp - PT / 2), ...pr("PB", z0 + PT / 2)], tools: ["hammer"], wait: frame, from: aside });
  // set in from the corner far enough that their screws clear the dowels there
  const brk = (sx: number, sz: number): Vec3 => [r(sx * (Wc / 2 - PT - 30)), r(yP), r(sz < 0 ? z0 + PT + 30 : zp - PT - 30)];
  const brkScrews = (sz: number, side: "rail" | "end") =>
    fx("screw", G.flatMap((sx) => [-1, 1].map((k): Vec3 => {
      const p = brk(sx, sz);
      return side === "rail" ? [p[0] + k * 12, p[1] + 14, sz < 0 ? z0 + PT : zp - PT] : [sx < 0 ? -Wc / 2 + PT : Wc / 2 - PT, p[1] + 14, p[2] + k * 12];
    })), side === "rail" ? [0, 0, sz] : [-1, 0, 0], { ...BSCREW, on: side === "rail" ? (sz < 0 ? "PB" : "PF") : undefined });
  S({
    title: "Screw a leg bracket to each end of the rails",
    detail: "Two screws through each bracket into the rail, the bracket's open side facing the corner.",
    fix: [fx("angle", corners.map(([sx, sz]) => brk(sx, sz)), [0, 1, 0], { name: "Leg bracket", len: 80, dia: 70 }), brkScrews(-1, "rail"), brkScrews(1, "rail")],
    tools: ["screwdriver"],
  });
  S({
    title: "Fit the plinth ends",
    detail: "Push them onto the dowels, then two screws through each bracket into the end.",
    fix: [
      fx("screw", corners.filter(([sx]) => sx < 0).flatMap(([sx, sz]) => [-1, 1].map((k): Vec3 => [-Wc / 2 + PT, brk(sx, sz)[1] + 14, brk(sx, sz)[2] + k * 12])), [-1, 0, 0], { ...BSCREW, on: "PL" }),
      fx("screw", corners.filter(([sx]) => sx > 0).flatMap(([sx, sz]) => [-1, 1].map((k): Vec3 => [Wc / 2 - PT, brk(sx, sz)[1] + 14, brk(sx, sz)[2] + k * 12])), [1, 0, 0], { ...BSCREW, on: "PR" }),
    ],
    tools: ["screwdriver"],
  });
  const plinthScrews = c.model === "bookcase" ? 6 : 8;
  const along = [-1, 0, 1].flatMap((t) => [zp - PT / 2, z0 + PT / 2].map((z): Vec3 => [r(t * (Wc / 2 - 120)), c.legH, r(z)]));
  const psAt: Vec3[] = plinthScrews === 6 ? along : [...along, ...G.map((sx): Vec3 => [r(sx * (Wc / 2 - PT / 2)), c.legH, r(zpc)])];
  S({
    title: "Screw the plinth frame under the bottom",
    detail: `Lay it on the bottom end of the carcass, onto the dowels, and drive ${plinthScrews} long screws through it with the Allen key. Use the longest screws here.`,
    add: frame,
    from: Object.fromEntries(frame.map((id) => [id, [0, -400, 0] as Vec3])), // onto the dowels in the sides
    fix: [fx("screw", psAt, [0, 1, 0], { ...PSCREW, mate: "B" })],
    tools: ["allen"],
    pose: c.model === "bookcase" ? "-z" : "-y",
  });
  // legs
  const legIds = corners.map((_, i) => `G${i + 1}`);
  const diag = ([sx, sz]: [number, number]): Vec3 => [sx * 0.71, 0, sz * 0.71];
  const rodAt = ([sx, sz]: [number, number]): Vec3[] => [yP - 14, yP + 14].map((y): Vec3 => [r(sx * lx), r(y), r(lz(sz))]);
  S({
    title: "Get the legs ready",
    detail: "Screw an adjustable foot into the bottom of each leg, drop a barrel nut into the top and screw two threaded rods in through the side holes.",
    add: legIds,
    fix: [
      fx("foot", corners.map(([sx, sz]): Vec3 => [r(sx * lx), 0, r(lz(sz))]), [0, 1, 0], { name: "Adjustable foot", len: 20, dia: 30 }),
      fx("connector", corners.map(([sx, sz]): Vec3 => [r(sx * lx), legLen, r(lz(sz))]), [0, -1, 0], { name: "Barrel nut", len: 40, dia: 10 }),
      ...corners.map((cn, i) => fx("stud", rodAt(cn), [-diag(cn)[0], 0, -diag(cn)[2]], { name: "Threaded rod", len: 60, dia: 8, on: legIds[i] })),
    ],
    tools: ["screwdriver"],
  });
  const nutAt = (cn: [number, number]): Vec3[] => {
    const b = brk(cn[0], cn[1]);
    return [yP - 14, yP + 14].map((y): Vec3 => [b[0], r(y), b[2]]);
  };
  const legNuts = (cs: number[]) =>
    cs.flatMap((i) => [
      fx("washer", nutAt(corners[i]), diag(corners[i]), { len: 2, dia: 18 }),
      fx("washer", nutAt(corners[i]), diag(corners[i]), { len: 2, dia: 14, name: "Spring washer" }),
      fx("nut", nutAt(corners[i]), diag(corners[i]), { len: 6, dia: 8 }),
    ]);
  S({ title: "Bolt on the legs at one end", detail: "The rods go through the bracket. A washer, a spring washer and a nut on each, tightened with the spanner.", fix: legNuts([0, 2]), tools: ["wrench"] });
  S({ title: "Bolt on the other two legs", detail: "The same way, then check all eight nuts are tight.", fix: legNuts([1, 3]), tools: ["wrench"] });
  // wall fixing
  const wallAt: Vec3[] = G.map((sx): Vec3 => [r(sx * xs), yt - 40, r(z0)]);
  S({
    title: "Push a wall spacer into each back corner",
    detail: "Into the holes at the top of the sides, at the back.",
    fix: [fx("connector", wallAt, [0, 0, 1], { name: "Wall spacer", len: 30, dia: 40 })],
  });
  S({ title: "Stand it up", detail: "Together, lifting it by the carcass, not by the legs.", pose: "+y", people: 2, warnings: ["two"] });
  S({
    title: "Screw the knobs onto the spacers",
    detail: "By hand, a few turns each.",
    fix: [fx("knob", wallAt.map(([x, y, z]): Vec3 => [x, y, z - 20]), [0, 0, 1], { name: "Spacer knob", len: 20, dia: 30 })],
  });
  S({ title: "Push it against the wall", detail: "Turn the knobs until the top stands the same distance from the wall as the legs, so it stands straight past the skirting board.", warnings: ["wall"] });
  S({ title: "Level it on the feet", detail: "Turn the four feet under the legs until it stands steady and level.", tools: ["level"] });
  S({
    title: "Screw it to the wall",
    detail: "A screw through the cup washer in each spacer into the wall, then click the covers on. Wall screws and plugs aren't included: pick ones made for your wall.",
    fix: [
      fx("plug", wallAt.map(([x, y, z]): Vec3 => [x, y, z - 60]), [0, 0, -1]),
      fx("washer", wallAt.map(([x, y, z]): Vec3 => [x, y, z - 26]), [0, 0, -1], { name: "Cup washer", len: 4, dia: 24, included: true }),
      fx("screw", wallAt.map(([x, y, z]): Vec3 => [x, y, z - 28]), [0, 0, -1], { len: 50, dia: 5 }),
      fx("cap", wallAt.map(([x, y, z]): Vec3 => [x, y, z - 22]), [0, 0, -1], { name: "Cover", len: 6, dia: 30 }),
    ],
    tools: ["drill", "screwdriver", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  });
  // shelves
  const supZ = [shZb + 40, shZf - 40];
  const supports = G.map((sx) =>
    fx("pin", Array.from({ length: c.shelves }, (_, k) => supZ.map((z): Vec3 => [r(sx * xi), r(shelfY(k + 1)), r(z)])).flat(), [sx, 0, 0], { name: "Shelf support", len: 16, dia: 6, on: sideId(sx) }),
  );
  S({
    title: `Push in the ${supports.reduce((a, f) => a + f.count, 0)} shelf supports`,
    detail: glass ? "Four for each glass shelf, at the same height on both sides. Slip a rubber sleeve onto each one." : "Four for each shelf, at the same height on both sides.",
    fix: glass ? [...supports, ...G.map((sx) => fx("cap", supports[sx < 0 ? 0 : 1].at!.map(([x, y, z]): Vec3 => [x - sx * 8, y, z]), [sx, 0, 0], { name: "Rubber sleeve", len: 8, dia: 8 }))] : supports,
  });
  const shelfIds = Array.from({ length: c.shelves }, (_, k) => `H${k + 1}`);
  S({
    title: glass ? "Lay in the glass shelves" : "Lay in the shelves",
    detail: glass ? "Tilt each one in and lower it flat onto its four supports. Handle the glass by its edges." : "Tilt each one in and lower it flat onto its four supports.",
    add: shelfIds,
    warnings: glass ? ["hand"] : undefined,
  });
  if (!doors) {
    const hold = G.map((sx): Vec3 => [r(sx * xi), yRod, r(zf - 40)]);
    S({
      title: "Screw on the rail holders",
      detail: "One on the inside of each side, near the front of the top compartment, two screws each.",
      fix: [
        ...G.map((sx, i) => fx("clip", [hold[i]], [sx, 0, 0], { name: "Rail holder", len: 16, dia: 26, on: sideId(sx) })),
        ...G.map((sx, i) => fx("screw", [[hold[i][0], hold[i][1] + 10, hold[i][2]], [hold[i][0], hold[i][1] - 10, hold[i][2]]], [sx, 0, 0], { ...SMALL, on: sideId(sx) })),
      ],
      tools: ["screwdriver"],
    });
    S({ title: "Click the rail into the holders", detail: "Press each end in until it clicks.", add: ["Q"] });
  } else {
    S({ title: "Screw in the door stop", detail: "Into the hole in the middle of the bottom panel's front edge, where the doors meet.", fix: [fx("stud", [[0, r(yB + BT / 2), r(zBf - 12)]], [0, -1, 0], { name: "Door stop", len: 20, dia: 8, on: "B" })], tools: ["screwdriver"] });
    const hy = [yb + 140, yt - 140];
    const doorIds = glass ? ["D1", "E1", "D2", "E2"] : ["D1", "D2"];
    const hingeAt = (y: number): Vec3[] => G.map((sx): Vec3 => [r(sx * (xi - 30)), r(y), zf - 20]);
    S({
      title: "Screw the top hinges onto the doors",
      detail: "Lay the doors face down on a rug. The hinge cup goes into the hole near the top, two screws each.",
      add: doorIds,
      fix: [fx("hinge", hingeAt(hy[1]), [0, 0, 1], { len: 50, dia: 35 })],
      from: Object.fromEntries(doorIds.map((id) => [id, [0, 0, 500] as Vec3])),
      tools: ["screwdriver"],
      warnings: ["floor"],
    });
    S({ title: "Screw the bottom hinges onto the doors", detail: "The other kind of hinge goes into the bottom holes, two screws each.", fix: [fx("hinge", hingeAt(hy[0]), [0, 0, 1], { len: 50, dia: 35 })], tools: ["screwdriver"] });
    S({ title: "Click the doors onto the hinge plates", detail: "Hook each hinge's back end onto its plate, then press the front until it clicks. Adjust the screws on the hinges until the gaps are even.", tools: ["screwdriver"] });
    const pull: Vec3[] = G.map((sx): Vec3 => [sx * 45, r(yD + 40), zf + 4]); // clear of its screw's head
    S({
      title: "Screw on the handles",
      detail: "One on each door by the meeting edge, a screw through from the inside.",
      fix: [fx("handle", pull, [0, 0, -1], { name: "Drop handle", len: 50, dia: 20, to: ["D1", "D2"] }), fx("screw", pull.map(([x, y]): Vec3 => [x, y, zf - 20]), [0, 0, 1], { len: 25, dia: 4 })],
      tools: ["screwdriver"],
    });
  }
  return { parts, steps };
}

function modelOf(s: ProductSpec): Model | null {
  const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
  if (/glass-door|glass door/.test(v)) return "glass";
  if (/bookcase/.test(v)) return "bookcase";
  if (/cabinet/.test(v)) return "cabinet";
  return null;
}

const family: Family = {
  names: ["FÄRJKARL", "FARJKARL"],
  recipe(s) {
    const m = modelOf(s);
    return m ? recipe(s, CFG[m]) : null;
  },
};
export default family;
