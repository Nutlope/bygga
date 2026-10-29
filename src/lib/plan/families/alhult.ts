import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * ÅLHULT, read from its manuals. Tables and the bench share one frame: four rails joined at the corners by big
 * steel corner brackets, two small screws into each rail, then the frame is turned upside down onto the top lying
 * face down and screwed to it with long screws straight through the rails. Each leg gets a barrel nut in its top
 * and two threaded rods, which go through the corner bracket and are tightened with nuts and the box spanner.
 * The bench adds a middle bar on cam locks. Extendable tables have two top halves that slide on steel slide
 * brackets, two cross bars on cam locks, two short centre bars on dowels, and a leaf stored under the top.
 * The chair is two side frames joined by two seat rails on dowels and long screws, four back slats held by a top
 * rail, and the padded seat screwed on through four angle brackets.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

const T = 26; // top
const OV = 25; // the top overhangs the legs
const LG = 48; // square legs
const AH = 70; // rails
const AT = 20;
const IN = 6; // rails sit in from the legs' outer faces
const S2 = Math.SQRT1_2;

const BRACKET = { name: "Corner bracket", len: 110, dia: 60 };
const SMALL = { len: 14, dia: 6 }; // the stubby screws into the brackets
const LONG = { len: 90, dia: 5 }; // through the rails into the top
const BARREL = { name: "Barrel nut", len: 30, dia: 10 };
const ROD = { name: "Threaded rod", len: 60, dia: 8 };

const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));

/** The frame and legs every table and the bench share, in finished-product mm. */
function frameOf(s: ProductSpec, gap = 0) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const yTop = H - T - gap; // the underside of the frame's top edge
  const yA = yTop - AH / 2;
  const zr = D / 2 - OV - IN - AT / 2; // long rails
  const xr = W / 2 - OV - IN - AT / 2; // short rails
  const zIn = zr - AT / 2; // inner faces
  const xIn = xr - AT / 2;
  const lx = W / 2 - OV - LG / 2, lz = D / 2 - OV - LG / 2;
  const Lx = W - 2 * OV - 2 * LG, Lz = D - 2 * OV - 2 * LG;
  const parts: CustomPart[] = [
    ...[-1, 1].map((sz, i): CustomPart => ({ id: `R${i}`, name: "Long rail", size: [Lx, AH, AT], pos: [0, yA, sz * zr], material: "wood" })),
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `E${i}`, name: "Short rail", size: [AT, AH, Lz], pos: [sx * xr, yA, 0], material: "wood" })),
    ...corners.map(([sx, sz], i): CustomPart => ({ id: `L${i}`, name: "Leg", size: [LG, yTop, LG], pos: [sx * lx, yTop / 2, sz * lz], material: "wood" })),
  ];
  const rail = (sz: number) => (sz < 0 ? "R0" : "R1");
  const end = (sx: number) => (sx < 0 ? "E0" : "E1");
  const brackets = (): CustomFix =>
    fx("angle", corners.map(([sx, sz]) => [sx * (xIn - 28), yA, sz * (zIn - 28)] as Vec3), [0, 0, 1], { ...BRACKET });
  const longScrews = (): CustomFix[] =>
    corners.map(([sx, sz]) => fx("screw", [-1, 1].map((k) => [sx * (W / 2 - OV - LG - 22), yA + k * 18, sz * zIn] as Vec3), [0, 0, sz], { ...SMALL, on: rail(sz) }));
  const endScrews = (): CustomFix[] =>
    corners.map(([sx, sz]) => fx("screw", [-1, 1].map((k) => [sx * xIn, yA + k * 18, sz * (D / 2 - OV - LG - 22)] as Vec3), [sx, 0, 0], { ...SMALL, on: end(sx) }));
  // two threaded rods go into each leg's chamfered inner corner and through the bracket
  const rodAt = (sx: number, sz: number, k: number, out = 0): Vec3 => [sx * (lx - LG * 0.35 - out * S2), yA + k * 16, sz * (lz - LG * 0.35 - out * S2)];
  const legSteps = (): CustomStep[] => [
    {
      title: "Fit the bolts into the legs",
      detail: "Drop a barrel nut into the hole in the top of each leg, its slot turned so the rods can go in. Screw two threaded rods into each leg through the barrel nut.",
      add: corners.map((_, i) => `L${i}`),
      from: Object.fromEntries(corners.map(([sx, sz], i) => [`L${i}`, [sx * 160, 0, sz * 160] as Vec3])),
      fix: [
        ...corners.map(([sx, sz], i) => fx("pin", [[sx * lx, yTop, sz * lz]], [0, -1, 0], { ...BARREL, on: `L${i}` })),
        ...corners.map(([sx, sz], i) => fx("stud", [-1, 1].map((k) => rodAt(sx, sz, k)), [sx * S2, 0, sz * S2], { ...ROD, on: `L${i}` })),
      ],
      tools: ["flathead"],
    },
    {
      title: "Bolt the legs to the corner brackets",
      detail: "Push each leg into its corner so the rods go through the bracket. A washer and a nut on each rod, tightened with the box spanner.",
      fix: [
        ...corners.map(([sx, sz], i) => fx("washer", [-1, 1].map((k) => rodAt(sx, sz, k, 34)), [sx * S2, 0, sz * S2], { on: `L${i}`, dia: 8 })),
        ...corners.map(([sx, sz], i) => fx("nut", [-1, 1].map((k) => rodAt(sx, sz, k, 38)), [sx * S2, 0, sz * S2], { on: `L${i}`, dia: 8 })),
      ],
      tools: ["wrench"],
    },
    {
      title: "Push the floor protectors into the legs",
      detail: "Press one into the hole at the end of each leg until its flange sits flat.",
      fix: [fx("glide", corners.map(([sx, sz]) => [sx * lx, 0, sz * lz] as Vec3), [0, 1, 0], { name: "Floor protector", dia: 40 })],
    },
  ];
  return { W, D, H, yTop, yA, zr, xr, zIn, xIn, lx, lz, Lx, Lz, parts, brackets, longScrews, endScrews, legSteps };
}

/* ---------- fixed tables ---------- */

function tableRecipe(s: ProductSpec): CustomParams {
  const f = frameOf(s);
  const { W, D, H, yTop, zr, xr, Lx, Lz } = f;
  const parts: CustomPart[] = [...f.parts, { id: "T", name: "Table top", size: [W, T, D], pos: [0, H - T / 2, 0] }];
  // long screws straight down through the rails: two near the ends of each, one more in the middle of the long ones on the long table
  const n = W >= 1100 ? 10 : 8;
  const through: Vec3[] = [
    ...[-1, 1].flatMap((sz) => [-1, 1].map((k) => [k * (Lx / 2 - 50), yTop - AH, sz * zr] as Vec3)),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((k) => [sx * xr, yTop - AH, k * (Lz / 2 - 50)] as Vec3)),
    ...(n === 10 ? [-1, 1].map((sz) => [0, yTop - AH, sz * zr] as Vec3) : []),
  ];
  const steps: CustomStep[] = [
    {
      title: "Tap a dowel into two of the rails",
      detail: "Lay the two long rails on a rug, the edge with the single middle hole up. One dowel in each.",
      add: ["R0", "R1"],
      fix: [-1, 1].map((sz) => fx("dowel", [[0, yTop, sz * zr]], [0, -1, 0], { on: sz < 0 ? "R0" : "R1" })),
      warnings: ["floor"],
    },
    {
      title: "Screw a corner bracket to each end",
      detail: "Two screws hold each bracket to the rail. Check the bracket's notches face the way the drawing shows.",
      fix: [f.brackets(), ...f.longScrews()],
      tools: ["screwdriver"],
    },
    {
      title: "Stand the rails up and screw on the short rails",
      detail: "Dowels up. Fit each short rail between the brackets, the edge with the holes up, and screw it on with two screws at each end.",
      add: ["E0", "E1"],
      fix: f.endScrews(),
      tools: ["screwdriver"],
    },
    {
      title: "Turn the frame onto the top and screw it on",
      detail: "Lay the top face down on a rug and turn the frame over onto it, dowels into the holes. Long screws straight down through the rails.",
      add: ["T"],
      fix: [fx("screw", through, [0, 1, 0], { ...LONG })],
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    ...f.legSteps(),
    {
      title: "Turn the table the right way up",
      detail: W >= 1000 ? "Lift it together by the frame, not by the legs, and set it down on all four at once." : "Lift it by the frame, not by the legs, and set it down on all four at once.",
      pose: "+y",
      people: W >= 1000 ? 2 : 1,
    },
  ];
  return { parts, steps };
}

/* ---------- extendable tables ---------- */

const LEAF = 500;
const LT = 22; // the leaf
const GAP = 3; // the top halves ride on slide brackets just above the frame

function extendableRecipe(s: ProductSpec): CustomParams {
  const f = frameOf(s, GAP);
  const { W, D, H, yTop, zr, zIn, xIn, Lx } = f;
  const small = W < 1500; // the 120/170 table, with slide strips in its short rails too and four slide brackets
  const zInner = 2 * zIn;
  const yLeaf = H - T - GAP - LT / 2;
  const barH = 56;
  const yBar = yLeaf - LT / 2 - barH / 2;
  const XC = LEAF / 2 - 30; // cross bars, under the stored leaf
  const mLen = xIn - (XC + AT / 2);
  const parts: CustomPart[] = [
    ...f.parts,
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `C${i}`, name: "Cross bar", size: [AT, barH, zInner], pos: [sx * XC, yBar, 0], material: "wood" })),
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `M${i}`, name: "Centre bar", size: [mLen, barH, AT], pos: [sx * (XC + AT / 2 + mLen / 2), yBar, 0], material: "wood" })),
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `H${i}`, name: "Top half", size: [W / 2, T, D], pos: [(sx * W) / 4, H - T / 2, 0] })),
    { id: "F", name: "Extension leaf", size: [LEAF, LT, zInner - 10], pos: [0, yLeaf, 0] },
  ];
  const sl = small ? 4 : 8;
  const slideX = small ? [-1, 1].map((sx) => (sx * W) / 4) : [-1, 1].flatMap((sx) => [-1, 1].map((k) => sx * (W / 4 + k * (W / 10))));
  const slides: Vec3[] = slideX.flatMap((x) => [-1, 1].map((sz) => [x, H - T, sz * (zIn - 16)] as Vec3));
  const half = (x: number) => (x < 0 ? "H0" : "H1");
  const steps: CustomStep[] = [
    {
      title: "Lay the long rails on a rug",
      detail: "Inner faces up, as in the drawing. Keep the short rails beside them.",
      // they take their fittings lying apart and tip onto the cross bars later
      wait: ["R0", "R1"],
      from: { R0: [0, 0, -300], R1: [0, 0, 300] },
      warnings: ["floor"],
    },
    {
      title: "Screw a corner bracket to each end",
      detail: "Two screws hold each bracket to the rail.",
      fix: [f.brackets(), ...f.longScrews()],
      tools: ["screwdriver"],
    },
    {
      title: "Screw in the stop screws",
      detail: "Two in each long rail, in the holes near the middle. They stop the top halves when you pull them apart.",
      fix: [-1, 1].map((sz) => fx("screw", [-1, 1].map((k) => [k * (XC + 90), yTop - 18, sz * zIn] as Vec3), [0, 0, sz], { name: "Stop screw", len: 18, dia: 8, on: sz < 0 ? "R0" : "R1" })),
      tools: ["screwdriver"],
    },
    {
      title: "Push the slide strips into the long rails",
      detail: "Two in each rail, into the grooves along the top edge, all the way in.",
      fix: [-1, 1].map((sz) => fx("clip", [-1, 1].map((k) => [k * (Lx / 2 - 80), yTop - 10, sz * zIn] as Vec3), [0, 0, sz], { name: "Slide strip", len: 60, dia: 10, on: sz < 0 ? "R0" : "R1" })),
    },
    ...(small
      ? [
          {
            title: "Push the slide strips into the short rails",
            detail: "Lay the short rails beside the frame, inner faces up. Two strips in each, into the grooves.",
            wait: ["E0", "E1"],
            from: { E0: [-300, 0, 0], E1: [300, 0, 0] },
            fix: [-1, 1].map((sx) => fx("clip", [-1, 1].map((k) => [sx * xIn, yTop - 10, k * (zIn / 2)] as Vec3), [sx, 0, 0], { name: "Slide strip", len: 60, dia: 10, on: sx < 0 ? "E0" : "E1" })),
          } as CustomStep,
        ]
      : []),
    {
      title: "Screw the cam bolts into the cross bars",
      detail: "One in each end of both bars, until the collar stops at the wood. Tap a dowel in beside each.",
      fix: [-1, 1].flatMap((sx, i) =>
        [-1, 1].flatMap((sz) => [
          fx("camScrew", [[sx * XC, yBar - 10, sz * zIn]], [0, 0, -sz], { on: `C${i}` }),
          fx("dowel", [[sx * XC, yBar + 18, sz * zIn]], [0, 0, -sz], { on: `C${i}` }),
        ]),
      ),
      wait: ["C0", "C1"],
      from: { C0: [0, 260, 0], C1: [0, 260, 0] },
      tools: ["screwdriver"],
    },
    {
      title: "Fit the cross bars between the long rails",
      detail: "Lay the bars between the rails, big holes towards the ends of the table, then tip each rail onto their cam bolts and dowels.",
      add: ["C0", "C1", "R0", "R1"],
      from: { C0: [0, 260, 0], C1: [0, 260, 0], R0: [0, 0, -300], R1: [0, 0, 300] },
    },
    {
      title: "Lock the cam locks",
      detail: "Two in each long rail, over the cross bars, arrow towards the bolt. Turn clockwise until it pulls tight.",
      fix: [-1, 1].map((sz) => fx("cam", [-1, 1].map((sx) => [sx * XC, yTop, sz * zr] as Vec3), [0, -1, 0], { on: sz < 0 ? "R0" : "R1" })),
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the centre bars",
      detail: "Two in each end of both short centre bars.",
      add: ["M0", "M1"],
      fix: [-1, 1].flatMap((sx, i) =>
        [-1, 1].map((e) => {
          const x = e < 0 ? sx * (XC + AT / 2) : sx * xIn;
          return fx("dowel", [-1, 1].map((k) => [x, yBar + k * 14, 0] as Vec3), [e < 0 ? sx : -sx, 0, 0], { on: `M${i}` });
        }),
      ),
      from: { M0: [-240, 0, 0], M1: [240, 0, 0] },
    },
    {
      title: "Fit the short rails and screw them to the brackets",
      detail: "Swing each short rail onto the dowels of its centre bar and into the brackets, then two screws at each end.",
      add: ["E0", "E1"],
      fix: f.endScrews(),
      tools: ["screwdriver"],
      check: "square",
    },
    {
      title: "Screw a stop block under each top half",
      detail: "Lay both halves face down on a rug, side by side, the way the drawing shows. Two screws for each block.",
      add: ["H0", "H1"],
      fix: [-1, 1].map((sx) => fx("screw", [-1, 1].map((k) => [sx * (W / 2 - OV - LG - 140), H - T, k * 20] as Vec3), [0, 1, 0], { len: 16, dia: 4, on: sx < 0 ? "H0" : "H1" })),
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Push the halves together and lock them",
      detail: "The pins in one half go into the holes in the other. Flip both table locks over and press them down until they click.",
    },
    {
      title: "Lay the frame on the halves and push in the sliders",
      detail: "Frame upside down, centred on the halves. Push one slider into the slot at each end until it stops.",
      fix: [-1, 1].map((sx) => fx("clip", [[sx * (xIn - 40), H - T, 0]], [-sx, 0, 0], { name: "Slider", len: 40, dia: 20, on: sx < 0 ? "H0" : "H1" })),
    },
    {
      title: "Screw on the slide brackets",
      detail: "Hook each bracket over the flange of the long rail, then two screws into the top half. Don't screw them into the frame.",
      fix: [
        ...[-1, 1].map((sx) => fx("angle", slides.filter((p) => p[0] * sx > 0), [0, 1, 0], { name: "Slide bracket", len: 30, dia: 120, on: half(sx) })),
        ...[-1, 1].map((sx) => fx("screw", slides.filter((p) => p[0] * sx > 0).flatMap((p) => [-1, 1].map((k) => [p[0] + k * 40, H - T, p[2]] as Vec3)), [0, 1, 0], { ...SMALL, on: half(sx) })),
      ],
      tools: ["screwdriver"],
    },
    ...f.legSteps(),
    {
      title: "Clip the stops onto the leaf",
      detail: "Four stops on the underside of the leaf, near the corners, pressed in until they sit flat.",
      add: ["F"],
      from: { F: [0, 300, 0] },
      fix: [fx("pin", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (LEAF / 2 - 50), yLeaf - LT / 2, sz * (zInner / 2 - 60)] as Vec3)), [0, 1, 0], { name: "Leaf stop", len: 30, dia: 14, on: "F" })],
    },
    {
      title: "Turn the table over",
      detail: "Lift it together by the frame and set it on its legs. Open the two table locks.",
      pose: "+y",
      people: 2,
    },
    {
      title: "Store the leaf under the top",
      detail: "Pull the halves apart, lay the leaf in on its stops, push the halves back together over it and click the locks shut. To use the leaf, lift it out and lay it between the halves.",
      warnings: ["hand"],
    },
  ];
  return { parts, steps };
}

/* ---------- bench ---------- */

function benchRecipe(s: ProductSpec): CustomParams {
  const f = frameOf(s);
  const { W, D, H, yTop, yA, zr, zIn, Lx } = f;
  const parts: CustomPart[] = [
    ...f.parts,
    { id: "C", name: "Middle bar", size: [AT, AH, 2 * zIn], pos: [0, yA, 0], material: "wood" },
    { id: "T", name: "Seat", size: [W, T, D], pos: [0, H - T / 2, 0] },
  ];
  const steps: CustomStep[] = [
    {
      title: "Screw a cam bolt into each long rail",
      detail: "Lay the long rails on a rug, inner faces up. One bolt in the middle hole of each.",
      // they lie apart for their fittings and are pushed onto the middle bar after
      wait: ["R0", "R1"],
      from: { R0: [0, 0, -300], R1: [0, 0, 300] },
      fix: [-1, 1].map((sz) => fx("camScrew", [[0, yA, sz * zIn]], [0, 0, sz], { on: sz < 0 ? "R0" : "R1" })),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Screw a corner bracket to each end", detail: "Two screws hold each bracket to the rail.", fix: [f.brackets(), ...f.longScrews()], tools: ["screwdriver"] },
    { title: "Lay the middle bar between the rails", detail: "On the rug between them, the holes for the cam locks facing up.", add: ["C"], from: { C: [0, 240, 0] } },
    {
      title: "Push the rails onto the middle bar",
      detail: "Stand the rails up either side of the bar and push them onto its ends over the cam bolts.",
      add: ["R0", "R1"],
      from: { R0: [0, 0, -300], R1: [0, 0, 300] },
    },
    { title: "Screw on the short rails", detail: "Into the brackets at each end, two screws in each.", add: ["E0", "E1"], fix: f.endScrews(), tools: ["screwdriver"] },
    {
      title: "Lock the cam locks",
      detail: "One at each end of the middle bar, arrow towards the bolt. Turn clockwise until it pulls tight.",
      fix: [fx("cam", [-1, 1].map((sz) => [0, yA + AH / 2, sz * (zIn - 24)] as Vec3), [0, -1, 0], { on: "C" })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the frame",
      detail: "Two in the top edge of each long rail. Then turn the frame over.",
      fix: [-1, 1].map((sz) => fx("dowel", [-1, 1].map((k) => [k * (Lx / 4), yTop, sz * zr] as Vec3), [0, -1, 0], { on: sz < 0 ? "R0" : "R1" })),
    },
    { title: "Lay the frame on the seat", detail: "Lay the seat face down on a rug and turn the frame onto it, dowels into the holes.", add: ["T"], pose: "-y", warnings: ["floor"] },
    {
      title: "Screw the frame to the seat",
      detail: "Four long screws straight down through the long rails, near their ends.",
      fix: [fx("screw", [-1, 1].flatMap((sz) => [-1, 1].map((k) => [k * (Lx / 2 - 50), yTop - AH, sz * zr] as Vec3)), [0, 1, 0], { ...LONG })],
      tools: ["screwdriver"],
    },
    ...f.legSteps(),
    { title: "Turn the bench the right way up", detail: "Lift it by the frame and set it down on all four legs at once.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- chair ---------- */

function chairRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const lg = 38; // pine legs
  const yRail = 440; // top of the seat rails
  const rh = 60, rt = 22;
  const xs = W / 2 - lg / 2;
  const zF = D / 2 - lg / 2; // front legs
  const zB = -D / 2 + 90; // back legs below the seat
  const yBend = yRail + 20;
  const lean = 71; // the back legs lean back above the seat
  const th = Math.atan2(lean, H - yBend);
  const upper = Math.hypot(H - yBend, lean);
  const zTop = zB - lean;
  const inner = W - 2 * lg; // between the side frames
  const yR = yRail - rh / 2;
  const sideLen = zF - zB - lg;
  const frame: PartPiece[] = [
    { shape: "box", size: [lg, yBend, lg], pos: [0, yBend / 2, zB] },
    { shape: "box", size: [lg, upper, lg], pos: [0, (yBend + H) / 2, zB - lean / 2], rot: [-th, 0, 0] },
    { shape: "box", size: [lg, yRail, lg], pos: [0, yRail / 2, zF] },
    { shape: "box", size: [rt, rh, sideLen], pos: [0, yR, (zF + zB) / 2] },
    { shape: "box", size: [rt, 40, sideLen], pos: [0, 150, (zF + zB) / 2] },
  ];
  // pieces are drawn from the part's centre
  const fc: Vec3 = [0, H / 2, (D / 2 + -D / 2) / 2];
  const rel = frame.map((p) => ({ ...p, pos: [p.pos[0] - fc[0], p.pos[1] - fc[1], p.pos[2] - fc[2]] as Vec3 }));
  const zFr = zF - lg / 2 + rt / 2 + 4; // front seat rail, just behind the leg's front face
  const zBr = zB; // back seat rail, in line with the back legs
  const slatH = 430;
  const slatTop = yRail + slatH * Math.cos(th);
  const slatZ = zBr - (slatH / 2) * Math.sin(th);
  const gap = (inner - 4 * 40) / 5;
  const slatX = [0, 1, 2, 3].map((i) => -inner / 2 + gap + 20 + i * (gap + 40));
  const trH = 70;
  const yTr = Math.max(slatTop + trH / 2, H - trH / 2);
  const zTr = zB - lean * ((yTr - yBend) / (H - yBend));
  const seatZ0 = zB + lg / 2 + 2, seatZ1 = D / 2;
  const parts: CustomPart[] = [
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `SF${i}`, name: "Side frame", size: [lg, H, D], pos: [sx * xs, fc[1], fc[2]], pieces: rel, material: "wood" })),
    { id: "FR", name: "Seat rail", size: [inner, rh, rt], pos: [0, yR, zFr], material: "wood" },
    { id: "BR", name: "Back seat rail", size: [inner, rh, rt + 6], pos: [0, yR, zBr], material: "wood" },
    ...slatX.map((x, i): CustomPart => ({ id: `S${i}`, name: "Back slat", size: [40, slatH, 15], pos: [x, yRail + (slatH / 2) * Math.cos(th), slatZ], rot: [-th, 0, 0], material: "wood" })),
    { id: "TR", name: "Top rail", size: [inner, trH, 26], pos: [0, yTr, zTr], rot: [-th, 0, 0], material: "wood" },
    { id: "SE", name: "Seat", size: [W - 12, 55, seatZ1 - seatZ0], pos: [0, yRail + 27.5, (seatZ0 + seatZ1) / 2], material: "soft" },
  ];
  const bz = [zB + 90, zF - 90];
  const bx = (sx: number) => sx * (inner / 2);
  const steps: CustomStep[] = [
    {
      title: "Screw the angle brackets onto the side frames",
      detail: "Lay both side frames on a rug, inner side up. Two brackets on the seat rail of each, one screw each, the upright part flat against the rail.",
      add: ["SF0"],
      fix: [
        ...[-1, 1].map((sx, i) => fx("angle", bz.map((z) => [bx(sx), yRail - 14, z] as Vec3), [sx, 0, 0], { on: `SF${i}`, len: 40, dia: 30 })),
        ...[-1, 1].map((sx, i) => fx("screw", bz.map((z) => [bx(sx), yRail - 40, z] as Vec3), [sx, 0, 0], { on: `SF${i}`, len: 16, dia: 4 })),
      ],
      pose: "+x",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Tap the dowels in and stand the seat rails in one side",
      detail: "Two dowels in each end of both seat rails. Push them into the side frame lying on the rug, the back rail with its slots facing up the back.",
      add: ["FR", "BR"],
      fix: [
        ...[-1, 1].flatMap((sx) => fx("dowel", [-1, 1].map((k) => [sx * (inner / 2), yR + k * 15, zFr] as Vec3), [-sx, 0, 0], { on: "FR" })),
        ...[-1, 1].flatMap((sx) => fx("dowel", [-1, 1].map((k) => [sx * (inner / 2), yR + k * 15, zBr] as Vec3), [-sx, 0, 0], { on: "BR" })),
      ],
      from: { FR: [300, 0, 0], BR: [300, 0, 0] },
    },
    {
      title: "Lay the other side on and screw it",
      detail: "Onto the dowels. One long screw through the frame into each rail, with the Allen key.",
      add: ["SF1"],
      fix: [fx("bolt", [zFr, zBr].map((z) => [W / 2, yR, z] as Vec3), [-1, 0, 0], { name: "Screw", len: 80, dia: 6, on: "SF1" })],
      from: { SF1: [320, 0, 0] },
      tools: ["allen"],
    },
    {
      title: "Turn the chair over and screw the first side",
      detail: "Two more long screws, the same way.",
      fix: [fx("bolt", [zFr, zBr].map((z) => [-W / 2, yR, z] as Vec3), [1, 0, 0], { name: "Screw", len: 80, dia: 6, on: "SF0" })],
      pose: "-x",
      tools: ["allen"],
    },
    {
      title: "Stand it up and push the slats in",
      detail: "Push the four slats down into the slots in the back seat rail.",
      add: ["S0", "S1", "S2", "S3"],
      pose: "+y",
      from: { S0: [0, 300, 0], S1: [0, 300, 0], S2: [0, 300, 0], S3: [0, 300, 0] },
    },
    { title: "Space the slats with the strip", detail: "Hook the plastic spacer strip over the tops of the slats so they stand evenly apart. Keep it for later." },
    {
      title: "Screw on the top rail",
      detail: "Press it down over the slats, then one long screw through each back leg into its end. Tighten by hand with the Allen key, not a drill.",
      add: ["TR"],
      fix: [-1, 1].map((sx, i) => fx("bolt", [[sx * (W / 2), yTr, zTr]], [-sx, 0, 0], { name: "Screw", len: 70, dia: 6, on: `SF${i}` })),
      from: { TR: [0, 260, 0] },
      tools: ["allen"],
    },
    { title: "Take the spacer strip out", detail: "Pull it out from under the top rail. The slats stay where it held them." },
    {
      title: "Screw the seat on",
      detail: "Lay the seat face down on a table with a cloth on it and turn the chair upside down onto it. One screw up through each angle bracket into the seat.",
      add: ["SE"],
      fix: [fx("bolt", [-1, 1].flatMap((sx) => bz.map((z) => [bx(sx) - sx * 24, yRail, z] as Vec3)), [0, 1, 0], { name: "Screw", len: 16, dia: 6 })],
      pose: "-y",
      tools: ["allen"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["ÅLHULT", "ALHULT"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^alhult-extendable-table/.test(slug)) return extendableRecipe(s);
    if (/^alhult-table/.test(slug)) return tableRecipe(s);
    if (/^alhult-bench/.test(slug)) return benchRecipe(s);
    if (/^alhult-chair/.test(slug)) return chairRecipe(s);
    return null;
  },
};
export default family;
