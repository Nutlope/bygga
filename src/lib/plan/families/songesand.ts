import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "../builder";
import { buildCustom } from "../custom";

/**
 * SONGESAND, read from its manuals. The nightstand is a cabinet with a door under an open shelf: the sides are
 * fixed to the bottom and the plinth with cam locks while it stands upside down, the back slides down into grooves,
 * the top goes on with cam locks, the back is clipped, then the door is hung on two hinges and the shelf drops onto
 * four pins in the open space at the top. The beds are built from their manuals too: the queen and 160 from the
 * queen's, the twin with storage boxes from its own (a one-panel headboard on double cam bolts, side rails on round
 * connectors, a ready-made footboard, a top cap, a centre bar) and the box set's (two boxes built on their fronts).
 * The chests of 4 and 6 drawers follow the US 4- and 6-drawer dressers' manuals. The wardrobe has no manual we
 * could find and keeps its old guide.
 */

type Fx = Omit<CustomFix, "count" | "at"> & { at: Vec3[] };
const fx = (f: Fx): CustomFix => ({ ...f, count: f.at.length });

function nightstand(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 16, TT = 20; // panels, top
  const Wc = W - 24, Dc = D - 15; // the carcass under the top's overhang
  const zc = -7.5; // carcass centre front to back (the top overhangs at the front)
  const zF = zc + Dc / 2, zB = zc - Dc / 2;
  const xS = Wc / 2 - T / 2;
  const xIn = Wc / 2 - T;
  const hs = H - TT; // sides' height
  const P = 60; // plinth
  const yB = P + T / 2; // bottom panel centre
  const yShelf = Math.round(H * 0.72);
  const yDoorTop = yShelf - T / 2 - 4;
  const iw = 2 * xIn;
  const dTop = yDoorTop, dBot = P + 2;
  const doorH = dTop - dBot, doorW = iw - 4, dt = 18;
  const rail = 60;
  const doorPieces: PartPiece[] = [
    { shape: "box", size: [doorW, rail, dt], pos: [0, doorH / 2 - rail / 2, 0] },
    { shape: "box", size: [doorW, rail, dt], pos: [0, -doorH / 2 + rail / 2, 0] },
    { shape: "box", size: [rail, doorH - 2 * rail, dt], pos: [-doorW / 2 + rail / 2, 0, 0] },
    { shape: "box", size: [rail, doorH - 2 * rail, dt], pos: [doorW / 2 - rail / 2, 0, 0] },
    { shape: "box", size: [doorW - 2 * rail, doorH - 2 * rail, 8], pos: [0, 0, -4] },
  ];
  const parts: CustomPart[] = [
    { id: "bottom", name: "Bottom", size: [iw, T, Dc - 10], pos: [0, yB, zc + 5] },
    { id: "plinth", name: "Plinth", size: [iw, P, T], pos: [0, P / 2, zF - T / 2 - 6] },
    { id: "L", name: "Side panel", size: [T, hs, Dc], pos: [-xS, hs / 2, zc] },
    { id: "R", name: "Side panel", size: [T, hs, Dc], pos: [xS, hs / 2, zc] },
    { id: "back", name: "Back panel", size: [iw + 12, hs - P, 3], pos: [0, P + (hs - P) / 2, zB + 12], material: "fiber" },
    { id: "top", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0] },
    { id: "door", name: "Door", size: [doorW, doorH, dt], pos: [0, (dTop + dBot) / 2, zF - dt / 2], pieces: doorPieces },
    { id: "shelf", name: "Shelf", size: [iw - 2, T, Dc - 30], pos: [0, yShelf, zc + 5] },
  ];
  const zs = (Dc - 10) / 2 - 50;
  const zPl = zF - T / 2 - 6;
  const sx2 = [-1, 1];
  const camBolts = (sx: number) =>
    fx({ kind: "camScrew", at: [...[-zs, zs].map((z) => [sx * xIn, yB, zc + 5 + z] as Vec3), [sx * xIn, P / 2 - 12, zPl] as Vec3], dir: [sx, 0, 0], on: sx < 0 ? "L" : "R" });
  const steps: CustomStep[] = [
    {
      title: "Tap dowels into the bottom and the plinth",
      detail: "Lay both on a rug. Two dowels into each end of the bottom, one into each end of the plinth.",
      add: ["bottom", "plinth"],
      fix: [
        fx({ kind: "dowel", at: sx2.flatMap((sx) => [-zs, zs].map((z) => [sx * xIn, yB, zc + 5 + z] as Vec3)), dir: [-1, 0, 0], on: "bottom" }),
        fx({ kind: "dowel", at: sx2.map((sx) => [sx * xIn, P / 2 + 12, zPl] as Vec3), dir: [-1, 0, 0], on: "plinth" }),
      ].map((f) => ({ ...f, dir: undefined })),
      tools: ["hammer"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw cam bolts into a side and fit it",
      detail: "Three bolts near the bottom end of each side. With it all upside down, push one side's bolts into the bottom's holes and turn the two cam locks.",
      add: ["L"],
      fix: [camBolts(-1), fx({ kind: "cam", at: [-zs, zs].map((z) => [-xIn + 30, yB - T / 2, zc + 5 + z] as Vec3), dir: [0, 1, 0], dia: 15, on: "bottom" })],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the plinth and lock it",
      detail: "Onto the dowels at the front, then one cam lock from behind.",
      fix: [fx({ kind: "cam", at: [[-xIn + 30, P / 2 - 12, zPl - T / 2]], dir: [0, 0, 1], dia: 15, on: "plinth" })],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the other side",
      detail: "Turn the frame over onto the first side, then push the second side onto the dowels and turn its three cam locks.",
      add: ["R"],
      fix: [
        camBolts(1),
        fx({ kind: "cam", at: [-zs, zs].map((z) => [xIn - 30, yB - T / 2, zc + 5 + z] as Vec3), dir: [0, 1, 0], dia: 15, on: "bottom" }),
        fx({ kind: "cam", at: [[xIn - 30, P / 2 - 12, zPl - T / 2]], dir: [0, 0, 1], dia: 15, on: "plinth" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Push the back guides into the sides",
      detail: "Two into the back edge of each side, pegs into the holes. Then turn the frame the right way up.",
      fix: sx2.map((sx) => fx({ kind: "clip", name: "Back guide", len: 40, dia: 12, at: [P + 80, hs - 80].map((y) => [sx * xS, y, zB] as Vec3), dir: [0, 0, 1], on: sx < 0 ? "L" : "R" })),
    },
    {
      title: "Slide the back down into the grooves",
      detail: "From the top, smooth side facing in, all the way down onto the bottom.",
      add: ["back"],
      pose: "+y",
      from: { back: [0, 420, 0] },
    },
    {
      title: "Tap dowels into the tops of the sides",
      detail: "Two in each.",
      fix: sx2.map((sx) => fx({ kind: "dowel", at: [-1, 1].map((k) => [sx * xS, hs, zc + k * (Dc / 2 - 60)] as Vec3), dir: [0, -1, 0], on: sx < 0 ? "L" : "R" })),
      tools: ["hammer"],
    },
    {
      title: "Screw the cam bolts into the top",
      detail: "Four, into the holes on its underside.",
      fix: [fx({ kind: "camScrew", at: sx2.map((sx) => [sx * xS, hs, zc] as Vec3).flatMap((p) => [-1, 1].map((k) => [p[0], p[1], zc + k * (Dc / 2 - 110)] as Vec3)), dir: [0, 1, 0], on: "top" })],
      tools: ["screwdriver"],
    },
    {
      title: "Put the top on and lock it",
      detail: "Down onto the dowels and bolts, then turn the four cam locks inside the sides.",
      add: ["top"],
      fix: [fx({ kind: "cam", at: sx2.flatMap((sx) => [-1, 1].map((k) => [sx * xIn, hs - 30, zc + k * (Dc / 2 - 110)] as Vec3)), dir: [-1, 0, 0], dia: 15 })].map((f) => ({
        ...f,
        dir: undefined,
      })),
      tools: ["screwdriver"],
    },
    {
      title: "Fix the back to the bottom",
      detail: "Push the two plastic fasteners through the back into the bottom until they click.",
      fix: [fx({ kind: "clip", name: "Push fastener", len: 20, dia: 8, at: [-1, 1].map((k) => [k * (iw / 2 - 60), yB, zB + 10] as Vec3), dir: [0, 0, 1], on: "bottom" })],
    },
    {
      title: "Clip the back to the sides",
      detail: "Six clips through the back into the guides, three down each side, then press a wedge into each one.",
      fix: [fx({ kind: "clip", name: "Back clip", len: 14, dia: 12, at: sx2.flatMap((sx) => [P + 80, (P + hs) / 2, hs - 80].map((y) => [sx * (xIn + 2), y, zB + 10] as Vec3)), dir: [0, 0, 1] })],
    },
    {
      title: "Screw the hinge plates to the side",
      detail: "Inside the right-hand side at the front, two screws each.",
      fix: [
        fx({ kind: "plate", name: "Mounting plate", len: 12, dia: 36, at: [dBot + 90, dTop - 90].map((y) => [xIn, y, zF - 40] as Vec3), dir: [1, 0, 0], on: "R" }),
        fx({ kind: "screw", len: 14, dia: 4, at: [dBot + 90, dTop - 90].flatMap((y) => [-16, 16].map((dy) => [xIn, y + dy, zF - 40] as Vec3)), dir: [1, 0, 0], on: "R" }),
      ],
      tools: ["screwdriver"],
      pose: "+y",
    },
    {
      title: "Screw the hinges into the door",
      detail: "Lay the door face down. Each hinge cup into its hole, two screws each.",
      add: ["door"],
      fix: [
        fx({ kind: "hinge", at: [dBot + 90, dTop - 90].map((y) => [doorW / 2 - 25, y, zF - dt] as Vec3), dir: [0, 0, 1], on: "door" }),
        fx({ kind: "screw", len: 14, dia: 4, at: [dBot + 90, dTop - 90].flatMap((y) => [-22, 22].map((dy) => [doorW / 2 - 25, y + dy, zF - dt] as Vec3)), dir: [0, 0, 1], on: "door" }),
      ],
      tools: ["screwdriver"],
      from: { door: [0, 0, 400] },
    },
    { title: "Click the door onto the plates", detail: "Hook each hinge arm over its plate and press until it clicks. Turn the hinge screws to line the door up.", kind: "hinges" },
    {
      title: "Screw on the handle",
      detail: "Two screws from the inside of the door, on the side away from the hinges.",
      fix: [fx({ kind: "handle", len: 128, dia: 12, at: [[-doorW / 2 + 40, (dTop + dBot) / 2, zF]], dir: [0, 0, -1], on: "door", twist: Math.PI / 2 }), fx({ kind: "screw", len: 25, dia: 4, at: [-64, 64].map((dy) => [-doorW / 2 + 40, (dTop + dBot) / 2 + dy, zF - dt] as Vec3), dir: [0, 0, 1], on: "door" })],
      tools: ["screwdriver"],
    },
    {
      title: "Push in the shelf pins",
      detail: "Four, at the bottom of the open space at the top, two in each side.",
      fix: [fx({ kind: "pin", dia: 5, at: sx2.flatMap((sx) => [-1, 1].map((k) => [sx * xIn, yShelf - T / 2 - 3, zc + 5 + k * (Dc / 2 - 60)] as Vec3)), dir: [-1, 0, 0] })].map((f) => ({ ...f, dir: undefined })),
    },
    { title: "Slide the shelf in", detail: "Onto the pins from the front, then turn each pin a quarter so it locks the shelf.", add: ["shelf"], from: { shelf: [0, 0, 300] } },
  ];
  return { parts, steps: splitSides(steps) };
}

/**
 * The bed frame: the headboard is built lying on its back (panels, rails, then the posts with cam locks), stood
 * against the wall, and the side rails are bolted to it through the posts and locked with big round connectors
 * inside the rails. Two people bolt the footboard on the same way, the cap goes on top of the headboard, then the
 * slat supports, the centre beam on its leg and the slats.
 */
function bed(s: ProductSpec): CustomParams {
  const queen = /queen/.test(s.slug ?? "");
  // IKEA's page for the queen: 165 x 208; the 160 x 200 is 167 x 207
  const W = queen ? 1650 : s.size.w * 10, L = queen ? 2080 : s.size.d * 10;
  const HH = (s.bed?.headH ?? 95) * 10, FH = 410;
  const PS = 70; // posts and footboard legs
  const xP = W / 2 - PS / 2, zH = -L / 2 + PS / 2, zFt = L / 2 - PS / 2;
  const yR0 = 200, yR1 = 380, yR = (yR0 + yR1) / 2; // side rails: 20 cm free under them
  const cap = 22, yTop = HH - cap;
  const iw = W - 2 * PS; // between the posts
  const yP0 = yR1, yP1 = yTop - 100; // infill panels
  const pw = iw / 2, stile = 45;
  const panel = (sx: number, id: string): CustomPart => ({
    id,
    name: "Headboard panel",
    size: [pw, yP1 - yP0, 16],
    pos: [sx * pw / 2, (yP0 + yP1) / 2, zH],
    pieces: [
      { shape: "box", size: [pw - stile, yP1 - yP0, 12], pos: [-sx * stile / 2, 0, 0] },
      { shape: "box", size: [stile, yP1 - yP0, 22], pos: [sx * (stile / 2 - pw / 2), 0, 0] },
    ],
  });
  const xRail = W / 2 - 25;
  const ySl = yR1 - 50; // slat supports, top
  const nSlats = s.bed?.slats ?? 17;
  const slatL = 2 * (xRail - 11) - 20;
  const slatZ = (i: number) => -L / 2 + PS + 60 + ((L - 2 * PS - 120) * i) / (nSlats - 1);
  const parts: CustomPart[] = [
    panel(-1, "pL"),
    panel(1, "pR"),
    { id: "lower", name: "Lower headboard rail", size: [iw, yR1 - yR0, 22], pos: [0, yR, zH], material: "wood" },
    { id: "upper", name: "Upper headboard rail", size: [iw, 100, 22], pos: [0, yTop - 50, zH], material: "wood" },
    { id: "postL", name: "Headboard post", size: [PS, yTop, PS], pos: [-xP, yTop / 2, zH], material: "wood" },
    { id: "postR", name: "Headboard post", size: [PS, yTop, PS], pos: [xP, yTop / 2, zH], material: "wood" },
    { id: "sideL", name: "Side rail", size: [22, yR1 - yR0, L - 2 * PS], pos: [-xRail, yR, 0], material: "wood" },
    { id: "sideR", name: "Side rail", size: [22, yR1 - yR0, L - 2 * PS], pos: [xRail, yR, 0], material: "wood" },
    {
      id: "foot",
      name: "Footboard",
      size: [W, FH, PS],
      pos: [0, FH / 2, zFt],
      material: "wood",
      pieces: [
        { shape: "box", size: [PS, FH, PS], pos: [-xP, 0, 0] },
        { shape: "box", size: [PS, FH, PS], pos: [xP, 0, 0] },
        { shape: "box", size: [iw, FH - yR0 + 20, 22], pos: [0, (yR0 - 20) / 2, 0] },
      ],
    },
    { id: "cap", name: "Headboard top", size: [W + 20, cap, 100], pos: [0, HH - cap / 2, zH], material: "wood" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `sup${i}`, name: "Slat support", size: [25, 25, L - 2 * PS - 20], pos: [sx * (xRail - 11 - 12.5), ySl - 12.5, 0], material: "metal" })),
    { id: "beam", name: "Centre beam", size: [50, 40, L - 2 * PS - 20], pos: [0, ySl - 20, 0], material: "metal" },
    { id: "leg", name: "Centre leg", size: [40, ySl - 40, 40], pos: [0, (ySl - 40) / 2, 0], shape: "cyl", material: "metal" },
    ...Array.from({ length: nSlats }, (_, i): CustomPart => ({ id: `sl${i}`, name: "Slat", size: [slatL, 10, 64], pos: [0, ySl + 5, slatZ(i)], material: "wood" })),
  ];
  const slats = parts.filter((p) => p.name === "Slat").map((p) => p.id);
  const sx2 = [-1, 1];
  const ends = (y: number, n: number) => Array.from({ length: n }, (_, i) => -iw / 2 + (iw * (i + 0.5)) / n).map((x) => [x, y, zH] as Vec3);
  const railBolts = (z: number, dz: number, on: string): CustomFix =>
    fx({ kind: "bolt", len: 90, dia: 8, at: sx2.flatMap((sx) => [yR - 45, yR + 45].map((y) => [sx * xRail, y, z] as Vec3)), dir: [0, 0, dz], on });
  const connectors = (zEnd: number): CustomFix =>
    fx({ kind: "cam", name: "Bed connector", len: 18, dia: 34, at: sx2.flatMap((sx) => [yR - 45, yR + 45].map((y) => [sx * (xRail - 11), y, zEnd] as Vec3)), dir: [0, 0, 0] });
  const conn = (zEnd: number): CustomFix[] => sx2.map((sx) => ({ ...connectors(zEnd), at: connectors(zEnd).at!.filter((p) => Math.sign(p[0]) === sx), count: 2, dir: [sx, 0, 0] as Vec3 }));
  const zcH = -L / 2 + PS + 50, zcF = L / 2 - PS - 50;
  const supScrews = sx2.map((sx) => fx({ kind: "screw", len: 16, dia: 4, at: Array.from({ length: 8 }, (_, i) => [sx * (xRail - 11), ySl - 12, -L / 2 + PS + 40 + ((L - 2 * PS - 80) * i) / 7] as Vec3), dir: [sx, 0, 0], on: `sup${sx < 0 ? 0 : 1}` }));
  const steps: CustomStep[] = [
    {
      title: "Tap dowels into the headboard panels",
      detail: "Lay both panels on a rug, face down. Dowels into the holes along their top and bottom edges.",
      add: ["pL", "pR"],
      fix: [
        fx({ kind: "dowel", at: ends(yP0, 8), dir: [0, 1, 0] }),
        fx({ kind: "dowel", at: ends(yP1, 8), dir: [0, -1, 0] }),
      ],
      tools: ["hammer"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Screw the cam bolts into the panels",
      detail: "One into each edge of each panel, by hand until they stop.",
      fix: [
        ...["pL", "pR"].flatMap((on, i) => [yP0, yP1].map((y) => fx({ kind: "camScrew", at: [[ends(y, 2)[i][0] - 100, y, zH]], dir: [0, y === yP0 ? 1 : -1, 0], on }))),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the lower rail and lock it",
      detail: "Push it onto the dowels and bolts along the panels' bottom edges, then turn the two cam locks in the rail.",
      add: ["lower"],
      fix: [fx({ kind: "cam", dia: 15, at: ends(yP0, 2).map((p) => [p[0] - 100, yP0 - 30, zH + 11] as Vec3), dir: [0, 0, -1], on: "lower" })],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the upper rail and lock it",
      detail: "Turn the headboard round, then the same along the top edges.",
      add: ["upper"],
      fix: [fx({ kind: "cam", dia: 15, at: ends(yP1, 2).map((p) => [p[0] - 100, yP1 + 30, zH + 11] as Vec3), dir: [0, 0, -1], on: "upper" })],
      tools: ["screwdriver"],
    },
    {
      title: "Put bolts and dowels into the rail ends",
      detail: "A cam bolt into each end of both rails, and the dowels beside them.",
      fix: [
        ...sx2.flatMap((sx) => [
          fx({ kind: "camScrew", at: [[sx * iw / 2, yR - 40, zH]], dir: [-sx, 0, 0], on: "lower" }),
          fx({ kind: "camScrew", at: [[sx * iw / 2, yTop - 50, zH]], dir: [-sx, 0, 0], on: "upper" }),
          fx({ kind: "dowel", at: [yR + 30, yR + 70].map((y) => [sx * iw / 2, y, zH] as Vec3), dir: [-sx, 0, 0], on: "lower" }),
          fx({ kind: "dowel", at: [[sx * iw / 2, yTop - 25, zH]], dir: [-sx, 0, 0], on: "upper" }),
        ]),
      ],
      tools: ["screwdriver", "hammer"],
    },
    {
      title: "Fit the posts and lock them",
      detail: "One on each end, onto the dowels and bolts. Turn the two cam locks in each post.",
      add: ["postL", "postR"],
      fix: sx2.map((sx) => fx({ kind: "cam", dia: 15, at: [[sx * xP, yR - 40, zH + PS / 2], [sx * xP, yTop - 50, zH + PS / 2]], dir: [0, 0, -1], on: sx < 0 ? "postL" : "postR" })),
      tools: ["screwdriver"],
    },
    {
      title: "Push the rail guides into the posts",
      detail: "One plastic guide on the inside of each post, where the side rail will meet it.",
      fix: sx2.map((sx) => fx({ kind: "clip", name: "Rail guide", len: 40, dia: 14, at: [[sx * (xP - PS / 2), yR, zH + PS / 2]], dir: [0, 0, -1], on: sx < 0 ? "postL" : "postR" })),
    },
    {
      title: "Stand the headboard against the wall",
      detail: "Two of you lift it upright. Leave a little room behind it to reach the bolts.",
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Fit the connectors and dowels in the side rails",
      detail: "Two dowels into each end, then press a round connector into each of the eight big holes on the inside, arrow towards the end.",
      add: ["sideL", "sideR"],
      fix: [
        fx({ kind: "dowel", at: sx2.map((sx) => [sx * xRail, yR, -L / 2 + PS] as Vec3), dir: [0, 0, 1] }),
        fx({ kind: "dowel", at: sx2.map((sx) => [sx * xRail, yR, L / 2 - PS] as Vec3), dir: [0, 0, -1] }),
        ...conn(-L / 2 + PS + 40),
        ...conn(L / 2 - PS - 40),
      ],
      people: 2,
      // they go on along their dowels, from the foot end towards the posts
      from: { sideL: [0, 0, 400], sideR: [0, 0, 400] },
    },
    {
      title: "Bolt the side rails to the headboard",
      detail: "Through the posts into the connectors, two bolts each side. Turn the connectors with a screwdriver to pull the joint tight.",
      fix: [{ ...railBolts(-L / 2, 1, "postL"), on: undefined }],
      tools: ["allen", "screwdriver"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Bolt on the footboard",
      detail: "Push its two rail guides in first. One of you holds it while the other drives the bolts into the connectors and turns them tight.",
      add: ["foot"],
      fix: [
        fx({ kind: "clip", name: "Rail guide", len: 40, dia: 14, at: sx2.map((sx) => [sx * (xP - PS / 2), yR, zFt - PS / 2] as Vec3), dir: [0, 0, 1], on: "foot" }),
        { ...railBolts(L / 2, -1, "foot") },
      ],
      tools: ["allen", "screwdriver"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Put the top on the headboard",
      detail: "Tap the dowels into the tops of the posts and the upper rail, screw three cam bolts into the top, press it on and turn the three cam locks from behind.",
      add: ["cap"],
      fix: [
        fx({ kind: "dowel", at: [-xP, -iw / 3, -iw / 8, iw / 6, iw / 3, xP].map((x) => [x, yTop, zH] as Vec3), dir: [0, -1, 0] }),
        fx({ kind: "camScrew", at: [-iw / 4, iw / 12, iw / 2.5].map((x) => [x, yTop, zH] as Vec3), dir: [0, 1, 0], on: "cap" }),
        fx({ kind: "cam", dia: 15, at: [-iw / 4, iw / 12, iw / 2.5].map((x) => [x, yTop - 30, zH - 11] as Vec3), dir: [0, 0, 1], on: "upper" }),
      ],
      tools: ["hammer", "screwdriver"],
    },
    {
      title: "Press the cover caps on",
      detail: "Over the bolt heads and holes on the outside of the posts and the headboard.",
      fix: [fx({ kind: "cap", len: 2, dia: 14, at: [...sx2.flatMap((sx) => [yR - 45, yR + 45].map((y) => [sx * xRail, y, -L / 2 - 1] as Vec3)), ...sx2.flatMap((sx) => [yR - 45, yR + 45].map((y) => [sx * xRail, y, L / 2 + 1] as Vec3)), [0, yTop - 50, zH - 12]], dir: [0, 0, 1] })],
    },
    {
      title: "Screw the slat supports to the side rails",
      detail: "Choose the height for your mattress first. Eight screws along each rail.",
      add: ["sup0", "sup1"],
      fix: supScrews,
      tools: ["screwdriver"],
    },
    {
      title: "Screw the beam brackets to the headboard and footboard",
      detail: "One in the middle of each, two screws each.",
      fix: [
        fx({ kind: "angle", name: "Beam bracket", len: 40, dia: 30, at: [[0, ySl - 20, zH + 11]], dir: [0, 0, -1], on: "lower" }),
        fx({ kind: "angle", name: "Beam bracket", len: 40, dia: 30, at: [[0, ySl - 20, zFt - 11]], dir: [0, 0, 1], on: "foot" }),
        fx({ kind: "screw", len: 16, dia: 4, at: [-30, 30].map((x) => [x, ySl - 30, zH + 11] as Vec3), dir: [0, 0, -1], on: "lower" }),
        fx({ kind: "screw", len: 16, dia: 4, at: [-30, 30].map((x) => [x, ySl - 30, zFt - 11] as Vec3), dir: [0, 0, 1], on: "foot" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the centre beam on its leg",
      detail: "Pull the beam out to length, set its ends in the brackets, clip the leg on under the middle and screw the ends down.",
      add: ["beam", "leg"],
      fix: [fx({ kind: "screw", len: 12, dia: 5, at: [zcH, zcF].flatMap((z) => [-12, 12].map((x) => [x, ySl, z + Math.sign(z) * 40] as Vec3)), dir: [0, -1, 0], on: "beam" })],
      tools: ["screwdriver"],
      check: "square",
    },
    {
      title: "Roll out the slats",
      detail: "Across the supports and the beam, then fix the end slats with a screw at each end so they can't move.",
      add: slats,
      fix: [fx({ kind: "screw", len: 16, dia: 4, at: [slatZ(0), slatZ(1), slatZ(nSlats - 2), slatZ(nSlats - 1)].flatMap((z) => sx2.map((sx) => [sx * (xRail - 11 - 12.5), ySl + 10, z] as Vec3)), dir: [0, -1, 0] })],
      tools: ["screwdriver"],
      people: 2,
    },
  ];
  return { parts, steps: splitSides(steps) };
}

/** Fittings given without a direction are split by side: dowels go into the panel's end, pins and cam locks into the side. */
function splitSides(steps: CustomStep[]): CustomStep[] {
  return steps.map((st) => {
    const fix: CustomFix[] = [];
    for (const f of st.fix ?? []) {
      if (f.dir || !f.at) {
        fix.push(f);
        continue;
      }
      for (const sx of [-1, 1]) {
        const at = f.at.filter((p) => Math.sign(p[0]) === sx);
        if (at.length) fix.push({ ...f, at, count: at.length, dir: [f.kind === "dowel" ? -sx : sx, 0, 0] });
      }
    }
    return { ...st, fix };
  });
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

/**
 * The twin bed with storage boxes (its own manual): the headboard lies on its back while the panel, the two rails and
 * the posts go together on double cam bolts, then it stands against the wall and the side rails and the ready-made
 * footboard are pulled on with round connectors. A cap goes on top, then the slat rails, the centre bar and the base.
 * IKEA's page: 109 x 96 x 196 cm.
 */
function twinBed(s: ProductSpec): CustomParams {
  const W = 1090, L = 1960;
  const xP = W / 2 - 30, iw = W - 120;
  const zH = -L / 2 + 20, zF = L / 2 - 20;
  const xR = xP, xIn = xR - 11;
  const ySl = 315, xSl = xIn - 12.5;
  const bl = 1880, nSl = 17;
  const parts: CustomPart[] = [
    { id: "panel", name: "Headboard panel", size: [iw, 440, 16], pos: [0, 600, zH] },
    { id: "lower", name: "Lower headboard rail", size: [iw, 140, 22], pos: [0, 310, zH] },
    { id: "upper", name: "Upper headboard rail", size: [iw, 120, 22], pos: [0, 880, zH] },
    { id: "postL", name: "Headboard post", size: [60, 940, 40], pos: [-xP, 470, zH] },
    { id: "postR", name: "Headboard post", size: [60, 940, 40], pos: [xP, 470, zH] },
    { id: "sideL", name: "Side rail", size: [22, 180, L - 80], pos: [-xR, 290, 0] },
    { id: "sideR", name: "Side rail", size: [22, 180, L - 80], pos: [xR, 290, 0] },
    {
      id: "foot",
      name: "Footboard",
      size: [W, 410, 40],
      pos: [0, 205, zF],
      pieces: [
        { shape: "box", size: [60, 410, 40], pos: [-xP, 0, 0] },
        { shape: "box", size: [60, 410, 40], pos: [xP, 0, 0] },
        { shape: "box", size: [iw, 300, 20], pos: [0, 55, 0] },
      ],
    },
    { id: "cap", name: "Headboard top", size: [W + 20, 20, 80], pos: [0, 950, zH] },
    { id: "railL", name: "Slat rail", size: [25, 25, L - 100], pos: [-xSl, ySl - 12.5, 0], material: "metal" },
    { id: "railR", name: "Slat rail", size: [25, 25, L - 100], pos: [xSl, ySl - 12.5, 0], material: "metal" },
    { id: "bar", name: "Centre bar", size: [2 * (xIn - 25), 15, 30], pos: [0, ySl - 7.5, 0], material: "metal" },
    {
      id: "base",
      name: "Slatted base",
      size: [960, 8, bl],
      pos: [0, ySl + 4, 0],
      material: "wood",
      pieces: range(nSl).map((i): PartPiece => ({ shape: "box", size: [960, 8, 60], pos: [0, 0, -bl / 2 + 30 + (i * (bl - 60)) / (nSl - 1)] })),
    },
  ];
  const sx2 = [-1, 1];
  const DB = { kind: "camScrew", len: 44, dia: 7, name: "Double cam bolt" } as const;
  const PCAM = { kind: "cam", len: 12, dia: 17 } as const; // the two in the panel are a different cam
  const CAM = { kind: "cam", len: 13, dia: 15 } as const;
  const camF = (on: string, at: Vec3[], back = false): CustomFix => fx({ ...CAM, on, at, dir: [0, 0, back ? 1 : -1] });
  const endBolts = (on: string, y: number) => fx({ ...DB, on, at: sx2.map((g) => [g * (iw / 2), y, zH] as Vec3), dir: [0, 0, 0] });
  // the bolts in the rail ends point into the rail from each end, so they're split by side
  const ends = (f: CustomFix): CustomFix[] => sx2.map((g) => ({ ...f, at: f.at!.filter((p) => Math.sign(p[0]) === g), count: f.at!.filter((p) => Math.sign(p[0]) === g).length, dir: [-g, 0, 0] as Vec3 }));
  const railCams = (on: string, ys: number[]) => camF(on, sx2.flatMap((g) => ys.map((y) => [g * (iw / 2 - 30), y, zH + 11] as Vec3)));
  const connY = [245, 335];
  const steps: CustomStep[] = [
    {
      title: "Tap dowels into the headboard panel",
      detail: "Lay it on a rug. Four along the bottom edge and four along the top edge.",
      add: ["panel"],
      fix: [
        fx({ kind: "dowel", on: "panel", at: spread(-400, 400, 4).map((x) => [x, 380, zH] as Vec3), dir: [0, 1, 0] }),
        fx({ kind: "dowel", on: "panel", at: spread(-400, 400, 4).map((x) => [x, 820, zH] as Vec3), dir: [0, -1, 0] }),
      ],
      tools: ["hammer"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Fit the double cam bolts into the panel",
      detail: "One in each long edge, held by a cam lock in the panel.",
      fix: [
        fx({ ...DB, on: "panel", at: [[-150, 380, zH]], dir: [0, 1, 0] }),
        fx({ ...DB, on: "panel", at: [[150, 820, zH]], dir: [0, -1, 0] }),
        fx({ ...PCAM, on: "panel", at: [[-150, 410, zH + 8], [150, 790, zH + 8]], dir: [0, 0, -1] }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Fit double cam bolts into the ends of the lower rail",
      detail: "One in each end, each held by a cam lock.",
      fix: [...ends(endBolts("lower", 345)), railCams("lower", [345])],
      tools: ["screwdriver"],
      wait: ["lower"],
    },
    { title: "Push the lower rail onto the panel", detail: "Onto the dowels and the bolt along the panel's bottom edge.", add: ["lower"], from: { lower: [0, -300, 0] } },
    { title: "Lock the cam lock", detail: "The one in the rail, over the panel's bolt.", fix: [camF("lower", [[-150, 350, zH + 11]])], tools: ["screwdriver"] },
    { title: "Turn it round and fit the upper rail", detail: "Onto the dowels and the bolt along the top edge.", add: ["upper"], from: { upper: [0, 300, 0] } },
    { title: "Lock the cam lock", fix: [camF("upper", [[150, 850, zH + 11]])], tools: ["screwdriver"] },
    {
      title: "Fit the other double cam bolts into the rail ends",
      detail: "One more in each end of the lower rail, one in each end of the upper rail, each with its cam lock.",
      fix: [...ends(endBolts("lower", 275)), ...ends(endBolts("upper", 900)), railCams("lower", [275]), railCams("upper", [900])],
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the rail ends",
      detail: "Two in each end of the lower rail, one in each end of the upper rail.",
      fix: [...ends(fx({ kind: "dowel", on: "lower", at: sx2.flatMap((g) => [250, 310].map((y) => [g * (iw / 2), y, zH] as Vec3)), dir: [0, 0, 0] })), ...ends(fx({ kind: "dowel", on: "upper", at: sx2.map((g) => [g * (iw / 2), 860, zH] as Vec3), dir: [0, 0, 0] }))],
      tools: ["hammer"],
    },
    { title: "Push the posts onto the rail ends", detail: "Both at once, onto the bolts and dowels.", add: ["postL", "postR"], from: { postL: [-300, 0, 0], postR: [300, 0, 0] } },
    { title: "Lock the cam locks", detail: "Four in the posts, over the lower rail's bolts.", fix: sx2.map((g) => camF(g < 0 ? "postL" : "postR", [275, 345].map((y) => [g * xP, y, zH + 20] as Vec3))), tools: ["screwdriver"] },
    { title: "Press the glides under the posts", detail: "One into the bottom end of each post.", fix: [fx({ kind: "glide", name: "Glide", len: 8, dia: 40, at: sx2.map((g) => [g * xP, 0, zH] as Vec3), dir: [0, 1, 0] })] },
    { title: "Turn it over and lock the last cam locks", detail: "One in each post, over the upper rail's bolts.", fix: sx2.map((g) => camF(g < 0 ? "postL" : "postR", [[g * xP, 900, zH - 20]], true)), tools: ["screwdriver"], pose: "-z" },
    {
      title: "Tap the dowels into the side rails",
      detail: "Two in each end.",
      fix: sx2.flatMap((g) => [-1, 1].map((e) => fx({ kind: "dowel", len: 40, dia: 10, on: g < 0 ? "sideL" : "sideR", at: [270, 310].map((y) => [g * xR, y, e * (L / 2 - 40)] as Vec3), dir: [0, 0, e] }))),
      tools: ["hammer"],
      pose: "+y",
      wait: ["sideL", "sideR"],
    },
    {
      title: "Press the connectors into the side rails",
      detail: "Two into the big holes at each end, arrow towards the end of the rail.",
      fix: sx2.map((g) => fx({ kind: "cam", name: "Bed connector", len: 18, dia: 34, on: g < 0 ? "sideL" : "sideR", at: [-1, 1].flatMap((e) => connY.map((y) => [g * xIn, y, e * (L / 2 - 80)] as Vec3)), dir: [g, 0, 0] })),
    },
    {
      title: "Stand the headboard against the wall and screw in the connector bolts",
      detail: "Two of you lift it upright. Two bolts into the inside face of each post, by hand.",
      fix: sx2.map((g) => fx({ kind: "stud", name: "Connector bolt", len: 45, dia: 8, on: g < 0 ? "postL" : "postR", at: connY.map((y) => [g * xR, y, -L / 2 + 40] as Vec3), dir: [0, 0, -1] })),
      people: 2,
      warnings: ["two", "wall"],
    },
    { title: "Fit a side rail to the headboard", detail: "Push it onto the dowels and bolts, then turn both connectors with the Allen key until the joint pulls tight.", add: ["sideL"], tools: ["allen"], people: 2, from: { sideL: [-300, 0, 300] } },
    { title: "Fit the other side rail", detail: "The same way, two connectors.", add: ["sideR"], tools: ["allen"], people: 2, from: { sideR: [300, 0, 300] } },
    { title: "Press the glides under the footboard", detail: "One into the bottom of each leg.", fix: [fx({ kind: "glide", name: "Glide", len: 8, dia: 40, on: "foot", at: sx2.map((g) => [g * xP, 0, zF] as Vec3), dir: [0, 1, 0] })], wait: ["foot"] },
    { title: "Screw the connector bolts into the footboard", detail: "Two into the inside of each leg.", fix: [fx({ kind: "stud", name: "Connector bolt", len: 45, dia: 8, on: "foot", at: sx2.flatMap((g) => connY.map((y) => [g * xR, y, L / 2 - 40] as Vec3)), dir: [0, 0, 1] })] },
    { title: "Push the footboard onto the side rails", detail: "Two of you: onto the dowels and bolts at the same time on both sides.", add: ["foot"], people: 2, warnings: ["two"], from: { foot: [0, 0, 500] } },
    { title: "Tighten the connectors at the foot", detail: "Turn each of the four with the Allen key until the joints are tight.", tools: ["allen"], kind: "cams" },
    {
      title: "Tap the plastic dowels into the top of the headboard",
      detail: "Five, along the top edge.",
      fix: [
        fx({ kind: "dowel", name: "Plastic dowel", len: 30, dia: 10, on: "upper", at: [-240, 0, 240].map((x) => [x, 940, zH] as Vec3), dir: [0, -1, 0] }),
        ...sx2.map((g) => fx({ kind: "dowel", name: "Plastic dowel", len: 30, dia: 10, on: g < 0 ? "postL" : "postR", at: [[g * xP, 940, zH]], dir: [0, -1, 0] })),
      ],
      tools: ["hammer"],
    },
    { title: "Screw the cam bolts into the top", detail: "Two, into the holes on its underside.", fix: [fx({ kind: "camScrew", len: 30, dia: 6, on: "cap", at: [-120, 120].map((x) => [x, 940, zH] as Vec3), dir: [0, 1, 0] })], tools: ["screwdriver"], wait: ["cap"] },
    { title: "Put the top on the headboard", detail: "Down onto the dowels, flush at the back.", add: ["cap"], from: { cap: [0, 300, 0] } },
    { title: "Lock the cam locks", detail: "Two, from the back of the upper rail.", fix: [camF("upper", [-120, 120].map((x) => [x, 915, zH - 11] as Vec3), true)], tools: ["screwdriver"] },
    {
      title: "Press the cover caps on",
      detail: "Over the holes on the outside of the posts and along the back of the top.",
      fix: [
        ...sx2.map((g) => fx({ kind: "cap", len: 2, dia: 14, on: g < 0 ? "postL" : "postR", at: [275, 345].map((y) => [g * (xP + 30), y, zH] as Vec3), dir: [-g, 0, 0] })),
        fx({ kind: "cap", len: 2, dia: 14, on: "cap", at: [-300, 0, 300].map((x) => [x, 950, zH - 40] as Vec3), dir: [0, 0, 1] }),
      ],
    },
    {
      title: "Screw the slat rails to the side rails",
      detail: "Eight screws along each rail, the flat flange at the top facing in.",
      add: ["railL", "railR"],
      fix: sx2.map((g) => fx({ kind: "screw", len: 16, dia: 4, on: g < 0 ? "railL" : "railR", mate: g < 0 ? "sideL" : "sideR", at: spread(-(L / 2 - 120), L / 2 - 120, 8).map((z) => [g * (xIn - 2), ySl - 14, z] as Vec3), dir: [g, 0, 0] })),
      tools: ["screwdriver"],
      from: { railL: [200, 0, 0], railR: [-200, 0, 0] },
    },
    { title: "Pull the centre bar out and lay it across", detail: "Slide it out until its ends rest on both slat rails, half way along the bed.", add: ["bar"], from: { bar: [0, 250, 0] } },
    { title: "Screw the ends of the centre bar down", detail: "One screw at each end, into the slat rails.", fix: [fx({ kind: "screw", len: 10, dia: 4, on: "bar", at: sx2.map((g) => [g * (xIn - 37), ySl, 0] as Vec3), dir: [0, -1, 0] })], tools: ["screwdriver"] },
    { title: "Lock its length", detail: "One more screw in the middle, where the two halves overlap.", fix: [fx({ kind: "screw", len: 10, dia: 4, on: "bar", at: [[0, ySl, 0]], dir: [0, -1, 0] })], tools: ["screwdriver"], check: "square" },
    {
      title: "Fit the slat holders at the ends of the rails",
      detail: "One at each end of both slat rails, a screw up from underneath into each.",
      fix: [
        fx({ kind: "clip", name: "Slat holder", len: 30, dia: 25, at: sx2.flatMap((g) => [-1, 1].map((e) => [g * xSl, ySl, e * (L / 2 - 80)] as Vec3)), dir: [0, -1, 0] }),
        fx({ kind: "screw", len: 12, dia: 6, at: sx2.flatMap((g) => [-1, 1].map((e) => [g * xSl, ySl - 25, e * (L / 2 - 80)] as Vec3)), dir: [0, 1, 0] }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Lay in the slatted base", detail: "Curved side up, the end slats tucked under the holders.", add: ["base"], from: { base: [0, 300, 0] } },
  ];
  void s;
  return { parts, steps };
}

/**
 * The box set: a wide box with a divider and a narrow one, built side by side on their fronts. Dowels go into the
 * uprights, cam bolts into the fronts, the uprights stand on them; the castor bars and cross pieces go in on dowels,
 * the hardboard bottoms slide down the grooves, the backs go on with their own cam bolts and every joint is locked.
 */
function twinBoxes(b: PlanBuilder) {
  const xo = 1090 / 2 - 30 + 11 - 5; // fronts just in from the side rail's outer face
  const BD = 680, ft = 16;
  const xc = xo - BD / 2; // middle of the box, side to side
  const yLo = 58, yHi = 195; // underside of the box sides (above the castors), top
  const sh = yHi - yLo, inner = BD - 2 * ft;
  const T = (name: string, size: Vec3, material?: "fiber" | "wood") => b.part(name, size, { material });
  const boxes = [
    { z0: -910, z1: 290, divider: true },
    { z0: 310, z1: 910, divider: false },
  ];
  const frontT = boxes.map((x) => T("Box front", [ft, 180, x.z1 - x.z0]));
  const backT = boxes.map((x) => T("Box back", [ft, sh, x.z1 - x.z0]));
  const upT = T("Box side", [inner, sh, 16]);
  const barT = T("Castor bar", [inner, 25, 40]);
  const fronts = boxes.map((x, i) => b.place(frontT[i], [xo - ft / 2, 105, (x.z0 + x.z1) / 2]));
  const backs = boxes.map((x, i) => b.place(backT[i], [xo - BD + ft / 2, (yLo + yHi) / 2, (x.z0 + x.z1) / 2]));
  const upZ = [boxes[0].z0 + 8, (boxes[0].z0 + boxes[0].z1) / 2, boxes[0].z1 - 8, boxes[1].z0 + 8, boxes[1].z1 - 8];
  const ups = upZ.map((z, i) => (i === 1 ? b.place(T("Divider", [inner, yHi - yLo - 28, 16]), [xc, (yLo + 28 + yHi) / 2, z]) : b.place(upT, [xc, (yLo + yHi) / 2, z])));
  const barZ = [upZ[0] + 36, upZ[1] + 36, upZ[2] - 36, upZ[3] + 36, upZ[4] - 36];
  const bars = barZ.map((z) => b.place(barT, [xc, yLo + 12.5, z]));
  const crossZ: [number, number][] = [[barZ[0], barZ[1]], [barZ[1], barZ[2]], [barZ[3], barZ[4]]];
  const crosses = crossZ.map(([a, c]) => b.place(T("Cross piece", [40, 25, c - a - 20]), [xc, yLo + 12.5, (a + c) / 2]));
  const sheets = boxes.map((x) => b.place(T("Box bottom", [inner, 3, x.z1 - x.z0 - 2 * ft - 20], "fiber"), [xc, yLo + 26.5, (x.z0 + x.z1) / 2]));
  const frontOf = (z: number) => fronts[z < 300 ? 0 : 1], backOf = (z: number) => backs[z < 300 ? 0 : 1];

  const c0: Vec3 = [xc, (yLo + yHi) / 2, 0];
  const stage = (k: string, off: Vec3 = [0, 0, 0], from?: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0] + off[0], it.final.pos[1] - c0[1] + off[1], it.final.pos[2] - c0[2] + off[2]], it.final.rot, from);
  };
  const xF = xo - ft, xB = xo - BD + ft;
  const upY = [yLo + 40, yHi - 40];
  const BOLT: HwDef = { kind: "camScrew", len: 30, dia: 6 };
  const CAM: HwDef = { kind: "cam", len: 12, dia: 14 };
  const CASTOR_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
  const DOWEL: HwDef = { kind: "dowel", len: 32, dia: 8 };
  const midBar = bars[1];
  const st = (title: string, detail: string, kind: "dowels" | "cams" | "join" | "screws" | "legs" | "general", body: () => void, tools?: ("hammer" | "screwdriver")[]) =>
    b.step({ title, detail, kind, tools, scene: "boxes", pose: "-x", warnings: [] }, body);
  const away: Vec3 = [-900, 0, 0];

  st("Tap the dowels into the box sides", "Two into each end of all five sides and the divider.", "dowels", () => {
    b.stagger(0.1);
    for (const k of ups) stage(k, away, [0, 200, 0]);
    b.then(0.15);
    const dy = (i: number) => (i === 1 ? [yLo + 70, yHi - 25] : [yLo + 60, yHi - 60]);
    b.fits(DOWEL, ups.flatMap((k, i) => [xF, xB].flatMap((x) => dy(i).map((y): FitOpts => ({ on: k, at: [x, y, upZ[i]], dir: [x === xF ? -1 : 1, 0, 0], mate: x === xF ? frontOf(upZ[i]) : backOf(upZ[i]) })))), 0.03);
  }, ["hammer"]);
  const frontBolts: FitOpts[] = [...ups.flatMap((k, i) => upY.map((y): FitOpts => ({ on: frontOf(upZ[i]), at: [xF, Math.max(y, i === 1 ? yLo + 60 : 0), upZ[i]], dir: [1, 0, 0], mate: k, mateHole: 4 }))), { on: fronts[0], at: [xF, yLo + 12.5, barZ[1]], dir: [1, 0, 0], mate: midBar, mateHole: 4 }];
  st("Screw the cam bolts into the fronts", "Lay both fronts face down on a rug. Eleven bolts, by hand: no drill.", "cams", () => {
    b.stagger(0.2);
    for (const k of fronts) stage(k, [0, 0, 0], [-200, 0, 0]);
    b.then(0.15);
    b.fits(BOLT, frontBolts, 0.06);
  }, ["screwdriver"]);
  st("Stand the sides on the fronts", "Push each one onto its bolts and dowels, the divider in the middle of the wide box.", "join", () => {
    b.stagger(0.15);
    for (const k of ups) stage(k, [0, 0, 0], [-300, 0, 0]);
  });
  const camAt = (x: number) => ups.flatMap((k, i) => upY.map((y): FitOpts => ({ on: k, at: [x, Math.max(y, i === 1 ? yLo + 60 : 0), upZ[i] + (i === 4 || i === 2 ? -8 : 8)], dir: [0, 0, i === 4 || i === 2 ? 1 : -1] })));
  st("Lock the cam locks", "Ten of them, near the fronts, turned clockwise.", "cams", () => b.fits(CAM, camAt(xF - 30), 0.06), ["screwdriver"]);
  const castorPts = bars.flatMap((k, i) => (i === 1 ? [xc] : [xF - 90, xB + 90]).map((x) => ({ k, x, z: barZ[i] })));
  st("Screw the castors onto the bars", "Nine castors, two screws each: two on every bar but one, which takes one in the middle.", "legs", () => {
    b.stagger(0.1);
    for (const k of bars) stage(k, [0, -250, 0], [0, 200, 0]);
    b.then(0.15);
    b.fits(HW.castor, castorPts.map((p): FitOpts => ({ on: p.k, at: [p.x, yLo, p.z], dir: [0, 1, 0], hole: false })), 0.08);
    b.then(0.1);
    b.fits(CASTOR_SCREW, castorPts.flatMap((p) => [-16, 16].map((dx): FitOpts => ({ on: p.k, at: [p.x + dx, yLo, p.z], dir: [0, 1, 0] }))), 0.03);
  }, ["screwdriver"]);
  const barDowels = bars.flatMap((k, i) => [xF, xB].flatMap((x) => [-10, 10].map((dz): FitOpts => ({ on: k, at: [x, yLo + 12.5, barZ[i] + dz], dir: [x === xF ? -1 : 1, 0, 0], mate: x === xF ? frontOf(barZ[i]) : backOf(barZ[i]) }))));
  const crossDowels = crosses.flatMap((k, i) => crossZ[i].flatMap((z, e) => [-8, 8].map((dx): FitOpts => ({ on: k, at: [xc + dx, yLo + 12.5, z + (e ? -20 : 20)], dir: [0, 0, e ? 1 : -1], mate: bars[[0, 1, 1, 2, 3, 4][i * 2 + e]] }))));
  st("Tap the dowels into the bars and cross pieces", "Thirty-two: two into each end of every piece.", "dowels", () => {
    b.stagger(0.1);
    for (const k of crosses) stage(k, [0, -250, 0], [0, 200, 0]);
    b.then(0.15);
    b.fits(DOWEL, [...barDowels, ...crossDowels], 0.02);
  }, ["hammer"]);
  st("Fit the bars and cross pieces into the wide box", "Each bar goes in beside a side, castors out; the cross pieces join them in the middle.", "join", () => {
    b.stagger(0.2);
    for (const k of [bars[0], crosses[0], bars[1], crosses[1], bars[2]]) stage(k, [0, 0, 0], [-250, 0, 0]);
  });
  st("Lock the middle bar", "One cam lock, near the front.", "cams", () => b.fit(CAM, { on: midBar, at: [xF - 30, yLo + 25, barZ[1]], dir: [0, -1, 0] }), ["screwdriver"]);
  st("Fit the bars and cross piece into the narrow box", "The same way.", "join", () => {
    b.stagger(0.2);
    for (const k of [bars[3], crosses[2], bars[4]]) stage(k, [0, 0, 0], [-250, 0, 0]);
  });
  st("Slide the bottoms down the grooves", "Smooth side in, one into each box, until they rest on the bars.", "general", () => {
    b.stagger(0.25);
    for (const k of sheets) stage(k, [0, 0, 0], [-600, 0, 0]);
  });
  const backBolts: FitOpts[] = [...ups.flatMap((k, i) => upY.map((y): FitOpts => ({ on: backOf(upZ[i]), at: [xB, Math.max(y, i === 1 ? yLo + 60 : 0), upZ[i]], dir: [-1, 0, 0], mate: k, mateHole: 4 }))), { on: backs[0], at: [xB, yLo + 12.5, barZ[1]], dir: [-1, 0, 0], mate: midBar, mateHole: 4 }];
  st("Screw the cam bolts into the backs", "Eleven more, by hand.", "cams", () => {
    b.stagger(0.2);
    for (const k of backs) stage(k, [-300, 0, 0], [0, 200, 0]);
    b.then(0.15);
    b.fits(BOLT, backBolts, 0.06);
  }, ["screwdriver"]);
  st("Put the backs on", "Press each one down onto the dowels and bolts along the sides and bars.", "join", () => {
    b.stagger(0.25);
    for (const k of backs) stage(k, [0, 0, 0], [-250, 0, 0]);
  });
  st("Lock the cam locks", "One in the middle bar, then the ten in the sides near the backs.", "cams", () => {
    b.fit(CAM, { on: midBar, at: [xB + 30, yLo + 25, barZ[1]], dir: [0, -1, 0] });
    b.then(0.1);
    b.fits(CAM, camAt(xB + 30), 0.06);
  }, ["screwdriver"]);
  b.step({ title: "Roll the boxes under the bed", detail: "Stand them on their castors and push them in from the side; the narrow one goes at the foot end.", kind: "drawer" }, () => {
    b.stagger(0.3);
    for (const g of [[fronts[0], backs[0], ...ups.slice(0, 3), ...bars.slice(0, 3), crosses[0], crosses[1], sheets[0]], [fronts[1], backs[1], ...ups.slice(3), ...bars.slice(3), crosses[2], sheets[1]]]) {
      b.stagger(0);
      for (const k of g) b.add(k, [700, 0, 0]);
      b.wait(0.3);
    }
  });
}

/** The chests' sizes, shared by the carcass recipe and the drawers. */
function chestGeo(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const cols = W > 1200 ? 2 : 1;
  const n = cols === 2 ? 3 : 4; // drawers in a column
  const T = 16, TT = 20, P = 70, RT = 60, RM = cols === 2 ? 64 : 40; // panels, top, plinth, top rail, rails between drawers
  const hs = H - TT;
  const Dc = D - 20, zc = -10; // the carcass under the top's overhang at the front
  const zF = zc + Dc / 2, zB = zc - Dc / 2;
  const colW = (W - 2 * T - (cols - 1) * T) / cols;
  const cx = (c: number) => -W / 2 + T + colW / 2 + c * (colW + T);
  const oh = (hs - RT - P - (n - 1) * RM) / n; // drawer opening
  const yOpen = (r: number) => P + r * (oh + RM); // bottom of opening r, from the floor up
  return { W, H, D, cols, n, T, TT, P, RT, RM, hs, Dc, zc, zF, zB, colW, cx, oh, yOpen };
}

/**
 * The chests' drawers, built on the floor beside it: a front lying face down takes four cam bolts, the sides stand
 * on it and lock with cams, the bottom slides down the grooves, the back swings in onto dowels and is held with
 * cam bolts and cams, then the runners and the handle. One is shown; the rest are built the same way.
 */
function chestDrawers(b: PlanBuilder, s: ProductSpec) {
  const { cols, n, colW, cx, oh, yOpen, zF, Dc } = chestGeo(s);
  const dd = Dc - 70, st = 12, sh = Math.round(oh - 50);
  const zs = zF - 18 - dd / 2, zBk = zF - 18 - dd + 6, bw = colW - 26 - 2 * st;
  const frontT = b.part("Drawer front", [colW - 4, oh - 4, 18]);
  const sideT = b.part("Drawer side", [st, sh, dd]);
  const bottomT = b.part("Drawer bottom", [bw + 10, 3, dd - 20], { material: "fiber" });
  const backT = b.part("Drawer back", [bw, sh - 22, st]);
  const drs: { x: number; yb: number }[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < n; r++) drs.push({ x: cx(c), yb: yOpen(r) });
  const sideX = (x: number, g: number) => x + g * (colW / 2 - 13 - st / 2);
  const all = drs.map((d) => ({
    d,
    front: b.place(frontT, [d.x, d.yb + oh / 2, zF - 9]),
    sides: [-1, 1].map((g) => b.place(sideT, [sideX(d.x, g), d.yb + 10 + sh / 2, zs])),
    bottom: b.place(bottomT, [d.x, d.yb + 20, zs + 2]),
    back: b.place(backT, [d.x, d.yb + 32 + (sh - 22) / 2, zBk]),
  }));
  type One = (typeof all)[number];
  const yLo = (d: One["d"]) => d.yb + 35, yHi = (d: One["d"]) => d.yb + 10 + sh - 25;
  const yB1 = (d: One["d"]) => d.yb + 47, yB2 = (d: One["d"]) => d.yb + 32 + sh - 22 - 30; // back dowels
  const yC1 = (d: One["d"]) => d.yb + 74, yC2 = (d: One["d"]) => d.yb + 32 + sh - 22 - 5; // back cam bolts
  const runY = (d: One["d"]) => d.yb + 22;
  const CB: HwDef = { kind: "camScrew", len: 34, dia: 7 };
  const CAM: HwDef = { kind: "cam", len: 12, dia: 15 };
  const DW: HwDef = { kind: "dowel", len: 30, dia: 8 };
  const RUN: HwDef = { kind: "runner", len: dd - 20, dia: 20, name: "Drawer runner" };
  const SCR: HwDef = { kind: "screw", len: 12, dia: 4 };
  const HSCR: HwDef = { kind: "screw", len: 25, dia: 4 };
  const HANDLE: HwDef = { kind: "handle", len: 128, dia: 12 };
  const fits = (x: One) => ({
    frontBolts: [-1, 1].flatMap((g) => [yLo(x.d), yHi(x.d)].map((y): FitOpts => ({ on: x.front, at: [sideX(x.d.x, g), y, zF - 18], dir: [0, 0, 1], mate: x.sides[g < 0 ? 0 : 1] }))),
    frontCams: [-1, 1].flatMap((g) => [yLo(x.d), yHi(x.d)].map((y): FitOpts => ({ on: x.sides[g < 0 ? 0 : 1], at: [sideX(x.d.x, g) - (g * st) / 2, y, zF - 48], dir: [g, 0, 0] }))),
    dowels: [-1, 1].flatMap((g) => [yB1(x.d), yB2(x.d)].map((y): FitOpts => ({ on: x.sides[g < 0 ? 0 : 1], at: [sideX(x.d.x, g) - (g * st) / 2, y, zBk], dir: [g, 0, 0], mate: x.back }))),
    backBolts: [-1, 1].flatMap((g) => [yC1(x.d), yC2(x.d)].map((y): FitOpts => ({ on: x.sides[g < 0 ? 0 : 1], at: [sideX(x.d.x, g) - (g * st) / 2, y, zBk], dir: [g, 0, 0], mate: x.back }))),
    backCams: [-1, 1].flatMap((g) => [yC1(x.d), yC2(x.d)].map((y): FitOpts => ({ on: x.back, at: [x.d.x + g * (bw / 2 - 30), y, zBk + st / 2], dir: [0, 0, -1] }))),
    runners: [-1, 1].map((g): FitOpts => ({ on: x.sides[g < 0 ? 0 : 1], at: [sideX(x.d.x, g) + g * 7, runY(x.d), zs], dir: [-g, 0, 0], hole: false })),
    runnerScrews: [-1, 1].flatMap((g) => [-1, 1].map((e): FitOpts => ({ on: x.sides[g < 0 ? 0 : 1], at: [sideX(x.d.x, g) + g * 10, runY(x.d), zs + e * (dd / 2 - 80)], dir: [-g, 0, 0] }))),
    handle: [{ on: x.front, at: [x.d.x, x.d.yb + oh / 2, zF], dir: [0, 0, -1], hole: false } as FitOpts],
    handleScrews: [-64, 64].map((dx): FitOpts => ({ on: x.front, at: [x.d.x + dx, x.d.yb + oh / 2, zF - 18], dir: [0, 0, 1] })),
  });
  const x0 = all[0], f0 = fits(x0);
  const c0: Vec3 = [x0.d.x, x0.d.yb + oh / 2, zs];
  const stage = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
  };
  const N = all.length;
  const st2 = (title: string, detail: string, kind: "cams" | "dowels" | "drawer" | "screws" | "join", body: () => void, tools?: ("screwdriver" | "hammer")[]) =>
    b.step({ title, detail, kind, tools, scene: "drawer", pose: "-z" }, body);
  st2("Screw the cam bolts into a drawer front", "Lay it face down on a rug. Four bolts into its back, by hand.", "cams", () => {
    stage(x0.front, [0, 0, 200]);
    b.then(0.15);
    b.fits(CB, f0.frontBolts, 0.08);
  }, ["screwdriver"]);
  st2("Stand the sides on and lock them", "Grooves facing in, onto the bolts. Turn two cam locks in each side.", "cams", () => {
    b.stagger(0.2);
    for (const k of x0.sides) stage(k, [0, 0, -260]);
    b.then(0.15);
    b.fits(CAM, f0.frontCams, 0.08);
  }, ["screwdriver"]);
  st2("Slide the bottom in", "Down the grooves in the sides until it reaches the front.", "drawer", () => stage(x0.bottom, [0, 0, -420]));
  st2("Tap dowels into the sides", "Two into the inside of each side at the open end.", "dowels", () => b.fits(DW, f0.dowels, 0.08), ["hammer"]);
  st2("Swing the back in", "Hook one end onto its dowels, swing the other in, then push two cam bolts through each side into it.", "join", () => {
    stage(x0.back, [220, 0, -220]);
    b.then(0.15);
    b.fits(CB, f0.backBolts, 0.08);
  }, ["screwdriver"]);
  st2("Lock the back", "Four cam locks in it, turned clockwise.", "cams", () => b.fits(CAM, f0.backCams, 0.08), ["screwdriver"]);
  st2("Screw the runners on", "One along the bottom of each side, two screws each, wheel at the back.", "screws", () => {
    b.fits(RUN, f0.runners, 0.15);
    b.then(0.1);
    b.fits(SCR, f0.runnerScrews, 0.06);
  }, ["screwdriver"]);
  b.step({ title: "Screw on the handle", detail: "Stand the drawer on its bottom. Two screws from the inside of the front.", kind: "screws", tools: ["screwdriver"], scene: "drawer", pose: "+y" }, () => {
    b.fits(HANDLE, f0.handle, 0.15);
    b.then(0.1);
    b.fits(HSCR, f0.handleScrews, 0.08);
  });
  // the rest, finished beside the first one
  b.step({ title: `Build the other ${N - 1} drawers the same way`, detail: "Front, sides, bottom, back, runners and handle, in the same order.", kind: "drawer", scene: "drawer", pose: "+y" }, () => {
    all.slice(1).forEach((x, j) => {
      const i = j + 1;
      const off: Vec3 = [(i % 2) * (colW + 80), Math.floor(i / 2) * (oh + 40), 0];
      b.stagger(0);
      for (const k of [x.front, ...x.sides, x.bottom, x.back]) {
        const it = b.partItem(k);
        b.stage(k, [it.final.pos[0] - x.d.x + off[0], it.final.pos[1] - x.d.yb - oh / 2 + off[1], it.final.pos[2] - zs + off[2]], it.final.rot);
      }
      const f = fits(x);
      const list: [HwDef, FitOpts[]][] = [[CB, [...f.frontBolts, ...f.backBolts]], [CAM, [...f.frontCams, ...f.backCams]], [DW, f.dowels], [RUN, f.runners], [SCR, f.runnerScrews], [HANDLE, f.handle], [HSCR, f.handleScrews]];
      for (const [def, l] of list) for (const op of l) b.preset(def, op);
      b.wait(0.15);
    });
  });
  b.step({ title: "Slide the drawers in", detail: "Onto the runners, all the way in until they click. Fill the bottom drawers first.", kind: "drawer" }, () => {
    for (const x of all) {
      b.stagger(0);
      for (const k of [x.front, ...x.sides, x.bottom, x.back]) b.add(k, [0, 0, 600]);
      b.wait(0.2);
    }
  });
}

/**
 * The chests of 4 and 6 drawers (US manuals of the 4- and 6-drawer dressers): built lying on the left side. Runners
 * and cam bolts go into the sides (and the 6's middle divider) first, the rails stand on the lying side on a dowel
 * and a cam lock at each end, the back panels (the 4's) drop in between, the other side goes on top, then it is
 * stood up, the top goes on dowels and cam locks with the wall brackets under it. Each drawer is a front with cam
 * bolts, two sides on cams, a bottom slid in, a back on dowels and cams, runners and a handle.
 */
function chest(s: ProductSpec): CustomParams {
  const { W, H, D, cols, n, T, TT, P, RT, RM, hs, Dc, zc, zF, zB, colW, cx, oh, yOpen } = chestGeo(s);
  const walls = cols === 2 ? ["L", "V", "R"] : ["L", "R"];
  const wallX = (i: number) => (i === 0 ? -W / 2 + T / 2 : i === walls.length - 1 ? W / 2 - T / 2 : 0);
  const zBR = zB + 10 + T / 2; // back rails stand in front of the back
  const parts: CustomPart[] = [];
  const add = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) => parts.push({ id, name, size, pos, ...o });
  add("L", "Side panel", [T, hs, Dc], [wallX(0), hs / 2, zc]);
  add("R", "Side panel", [T, hs, Dc], [wallX(walls.length - 1), hs / 2, zc]);
  if (cols === 2) add("V", "Divider", [T, hs, Dc - 10], [0, hs / 2, zc + 5]);
  add("top", "Top", [W, TT, D], [0, H - TT / 2, 0]);
  // rails: for each column, a top rail, rails between the drawers and a plinth at the front, a top and a bottom rail at the back
  type Rail = { id: string; c: number; y: number; h: number; z: number; front: boolean; under?: boolean };
  const rails: Rail[] = [];
  for (let c = 0; c < cols; c++) {
    rails.push({ id: `ft${c}`, c, y: hs - RT / 2, h: RT, z: zF - T / 2, front: true });
    for (let r = 1; r < n; r++) rails.push({ id: `fm${c}${r}`, c, y: yOpen(r) - RM / 2, h: RM, z: zF - T / 2, front: true, under: true });
    rails.push({ id: `fp${c}`, c, y: P / 2, h: P, z: zF - T / 2, front: true, under: true });
    rails.push({ id: `bt${c}`, c, y: hs - RT / 2, h: RT, z: zBR, front: false });
    rails.push({ id: `bb${c}`, c, y: P / 2, h: P, z: zBR, front: false });
  }
  for (const r of rails) add(r.id, r.front ? (r.id.startsWith("fp") ? "Plinth" : "Front rail") : "Back rail", [colW, r.h, T], [cx(r.c), r.y, r.z]);
  // the 4's back is four panels on dowels between the sides, the 6's one hardboard slid down grooves
  const nb = cols === 1 ? 4 : 0;
  const bh = (hs - RT - P) / Math.max(1, nb);
  for (let i = 0; i < nb; i++) add(`bk${i}`, "Back panel", [colW, bh - 2, 10], [cx(0), P + bh * (i + 0.5), zB + 5]);
  if (cols === 2) add("back", "Back panel", [W - 2 * T + 16, hs - 10, 3], [0, (hs - 10) / 2 + 5, zB + 6], { material: "fiber" });

  // drawers (built in their own scene, see chestDrawers)
  const dd = Dc - 70;
  type Dr = { i: number; c: number; r: number; x: number; yb: number };
  const drs: Dr[] = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < n; r++) drs.push({ i: drs.length, c, r, x: cx(c), yb: yOpen(r) });

  // ---------- fittings ----------
  const wallOf = (c: number, g: number) => walls[g < 0 ? c : c + 1];
  const faceX = (c: number, g: number) => cx(c) + g * (colW / 2); // the inner face of a column's wall
  // a rail end: a dowel above the middle, the cam bolt below it in the wall, the cam lock in the rail beside it
  // the dowel above the middle of a rail end, the cam bolt below; the right column's sit further out where both
  // columns meet the divider, so the two faces' fittings don't share a spot
  const off = (r: Rail, g: number) => (cols === 2 && r.c === 1 && g < 0 ? 27.5 : 11.5);
  const railDowels = (list: Rail[]): CustomFix[] => list.flatMap((r) => [-1, 1].map((g) => fx({ kind: "dowel", at: [[faceX(r.c, g), r.y + off(r, g), r.z]], dir: [-g, 0, 0], on: r.id, mate: wallOf(r.c, g) })));
  const railBolts = (wall: string, list: Rail[]): CustomFix => {
    const at: Vec3[] = [];
    for (const r of list) for (const g of [-1, 1]) if (wallOf(r.c, g) === wall) at.push([faceX(r.c, g), r.y - off(r, g), r.z]);
    const x = at[0][0], g = x < wallX(walls.indexOf(wall)) ? 1 : -1;
    return fx({ kind: "camScrew", at, dir: [g, 0, 0], on: wall });
  };
  const railCams = (wall: string, list: Rail[]): CustomFix[] =>
    list.flatMap((r) => [-1, 1].filter((g) => wallOf(r.c, g) === wall).map((g) => fx({ kind: "cam", dia: 15, at: [[faceX(r.c, g) - g * 30, r.y - off(r, g), r.front ? r.z - T / 2 : r.z + T / 2]], dir: [0, 0, r.front ? 1 : -1], on: r.id })));
  const panelDowels = (): CustomFix[] => range(nb).flatMap((i) => [-1, 1].map((g) => fx({ kind: "dowel", at: [[faceX(0, g), P + bh * (i + 0.5), zB + 5]], dir: [-g, 0, 0], on: `bk${i}`, mate: g < 0 ? "L" : "R" })));
  const runnerY = (d: Dr) => d.yb + 22;
  const zRun = zF - Dc / 2 - 15, runLen = Dc - 60;
  const carcassRunners = (wall: string, only?: number): CustomFix[] => {
    const pts: { x: number; g: number; y: number }[] = [];
    for (const d of drs) for (const g of [-1, 1]) if (wallOf(d.c, g) === wall && (only === undefined || g === only)) pts.push({ x: faceX(d.c, g), g, y: runnerY(d) });
    return [
      fx({ kind: "runner", name: "Drawer runner", len: runLen, dia: 20, at: pts.map((p) => [p.x - p.g * 5, p.y, zRun] as Vec3), dir: [pts[0].g, 0, 0], on: wall }),
      fx({ kind: "screw", len: 12, dia: 4, at: pts.flatMap((p) => [-1, 0, 1].map((e) => [p.x - p.g * 8, p.y, zRun + e * (runLen / 2 - 40)] as Vec3)), dir: [pts[0].g, 0, 0], on: wall }),
    ];
  };
  const wallRails = (wall: string) => rails.filter((r) => wallOf(r.c, -1) === wall || wallOf(r.c, 1) === wall);
  const front = rails.filter((r) => r.front), back = rails.filter((r) => !r.front);
  const stops = rails.filter((r) => r.under || r.id.startsWith("bb")).map((r) => [cx(r.c), r.y + r.h / 2, r.front ? r.z - 20 : r.z] as Vec3);
  const xT = (W / 2 - T / 2);
  const topXs = cols === 2 ? [-xT, 0, xT] : [-xT, xT];
  const topDowels = fx({ kind: "dowel", at: [...topXs.flatMap((x) => [-1, 1].map((k) => [x, hs, zc + k * (Dc / 2 - 50)] as Vec3)), ...(cols === 1 ? [-1, 1].map((k) => [k * colW / 4, hs, zBR] as Vec3) : [])], dir: [0, -1, 0] });
  const topBolts = fx({ kind: "camScrew", at: topXs.flatMap((x) => [-1, 1].map((k) => [x, hs, zc + k * (Dc / 2 - 110)] as Vec3)), dir: [0, 1, 0], on: "top" });
  const topCams = topXs.flatMap((x, i) =>
    (x === 0 ? [-1] : [Math.sign(x)]).map((g) => fx({ kind: "cam", dia: 15, at: [-1, 1].map((k) => [x - g * T / 2, hs - 30, zc + k * (Dc / 2 - 110)] as Vec3), dir: [g, 0, 0], on: walls[i] })),
  );
  const bx = [-1, 1].map((g) => g * (W / 2 - 120));
  const brackets: Vec3[] = bx.map((x) => [x, H - TT, -D / 2 + 6]);
  const sides2 = ["L", "R"];
  const steps: CustomStep[] = [];
  const push = (st: CustomStep) => steps.push(st);
  const inner = cols === 2;

  push({
    title: "Screw the runners onto a side",
    detail: `Lay the left side on a rug, inside up. ${n} runners, three screws each. They are marked CL and CR: keep them to the side shown.`,
    add: ["L"],
    fix: carcassRunners("L"),
    tools: ["screwdriver"],
    pose: "+x",
    warnings: ["floor"],
  });
  push({
    title: "Screw the cam bolts into the sides",
    detail: inner ? "By hand until they stop, into both sides and both faces of the divider. Screw the runners onto the right side and both faces of the divider the same way." : `${front.length + back.length} in each side, by hand until they stop. Screw the runners onto the right side the same way.`,
    fix: [railBolts("L", rails), railBolts("R", rails), ...(inner ? [railBolts("V", rails.filter((r) => r.c === 0)), railBolts("V", rails.filter((r) => r.c === 1))] : []), ...carcassRunners("R"), ...(inner ? [...carcassRunners("V", 1), ...carcassRunners("V", -1)] : [])],
    wait: inner ? ["R", "V"] : ["R"],
    tools: ["screwdriver"],
  });
  const col0 = rails.filter((r) => r.c === 0), col1 = rails.filter((r) => r.c === 1);
  push({
    title: "Tap dowels into the rails" + (nb ? " and back panels" : ""),
    detail: `One into each end${nb ? " of every rail and back panel" : ""}.`,
    fix: [...railDowels(rails), ...panelDowels()],
    wait: [...rails.map((r) => r.id), ...range(nb).map((i) => `bk${i}`)],
    tools: ["hammer"],
  });
  push({ title: inner ? "Stand the left column's rails on the side" : "Stand the front rails on the side", detail: "Dowel ends down into the holes, the plinth at the bottom.", add: (inner ? col0 : front).filter((r) => r.front).map((r) => r.id) });
  push({ title: "Stand the back rails on", detail: "One at the top and one at the bottom, behind the front ones.", add: (inner ? col0 : back).filter((r) => !r.front).map((r) => r.id) });
  push({ title: "Lock the rails to the side", detail: "One cam lock in the end of each rail, arrow towards the bolt, turned clockwise.", fix: railCams("L", rails), tools: ["screwdriver"] });
  if (nb) push({ title: "Drop the back panels in", detail: "Four of them, between the back rails, onto the dowel holes.", add: range(nb).map((i) => `bk${i}`) });
  if (inner) {
    push({ title: "Lay the divider on", detail: "Runners facing up, onto the rails' dowels. Then turn its cam locks.", add: ["V"], fix: railCams("V", col0), tools: ["screwdriver"] });
    push({ title: "Stand the right column's rails on the divider", detail: "The same way as the first column.", add: col1.map((r) => r.id) });
  }
  push({ title: "Lay the other side on top", detail: "Runners facing down, onto all the dowels. Then lock every rail with its cam lock.", add: ["R"], fix: railCams("R", rails), tools: ["screwdriver"], people: 2, warnings: ["two"] });
  if (inner) push({ title: "Lock the right column's rails to the divider", detail: "Its cam locks, turned clockwise.", fix: railCams("V", col1), tools: ["screwdriver"] });
  const corner = range(cols).flatMap((c) => [-1, 1].map((g) => ({ x: faceX(c, g) - g * 20, g, c })));
  push({
    title: "Screw the corner brackets on",
    detail: "Inside, where the bottom back rail meets each wall: one screw into the rail and one into the wall.",
    fix: [
      fx({ kind: "angle", name: "Corner bracket", len: 30, dia: 24, at: corner.map((p) => [p.x, P, zBR] as Vec3), dir: [0, -1, 0] }),
      fx({ kind: "screw", len: 12, dia: 4, at: corner.map((p) => [p.x - p.g * 25, P + 2, zBR] as Vec3), dir: [0, -1, 0] }),
      ...corner.map((p) => fx({ kind: "screw", len: 12, dia: 4, at: [[faceX(p.c, p.g) - p.g * 2, P + 25, zBR]], dir: [p.g, 0, 0], on: wallOf(p.c, p.g) })),
    ],
    tools: ["screwdriver"],
  });
  push({ title: "Stand it up together", detail: "Lift it onto its plinth, don't drag it by one corner.", pose: "+y", people: 2, warnings: ["two"] });
  push({ title: "Push in the drawer stops", detail: "One on the rail under each drawer and one on each bottom back rail, pegs into the holes.", fix: [fx({ kind: "clip", name: "Drawer stop", len: 20, dia: 12, at: stops, dir: [0, -1, 0] })] });
  if (inner) {
    push({ title: "Slide the back down into the grooves", detail: "From the top, smooth side facing in, all the way down.", add: ["back"], from: { back: [0, 500, 0] } });
    push({ title: "Clip the back on", detail: "Clips through the back into the rails and the divider, then press a wedge into each.", fix: [fx({ kind: "clip", name: "Back clip", len: 14, dia: 12, at: [...range(cols).flatMap((c) => [cx(c) - colW / 4, cx(c) + colW / 4].flatMap((x) => [P / 2, hs - RT / 2].map((y) => [x, y, zB + 7] as Vec3))), ...[-1, 1].flatMap((g) => [0.3, 0.6].map((f) => [g * 2, hs * f, zB + 7] as Vec3))], dir: [0, 0, 1] })] });
  }
  push({
    title: "Prepare the top",
    detail: `Upside down on the rug: the two wall brackets at the back, one screw each, then ${topBolts.at!.length} cam bolts.`,
    fix: [fx({ kind: "angle", name: "Wall bracket", len: 80, dia: 30, at: brackets, dir: [0, 1, 0], on: "top" }), fx({ kind: "screw", len: 12, dia: 4, at: brackets.map((p) => [p[0], p[1], p[2] + 25] as Vec3), dir: [0, 1, 0], on: "top" }), topBolts],
    wait: ["top"],
    tools: ["screwdriver"],
  });
  push({ title: "Tap dowels into the top edges", detail: `${topDowels.at!.length} of them, into the tops of the sides${inner ? " and the divider" : " and the back rail"}.`, fix: [topDowels], tools: ["hammer"] });
  push({ title: "Put the top on and lock it", detail: "Down onto the dowels and bolts, then turn the cam locks inside.", add: ["top"], fix: topCams, tools: ["screwdriver"] });
  const wall: Vec3[] = bx.map((x) => [x, H - TT - 30, -D / 2 - 2]);
  push({
    title: "Screw it to the wall",
    detail: "Push it against the wall, mark through the brackets, drill and fix them. Screws and plugs for your wall aren't included.",
    fix: [fx({ kind: "plug", len: 35, dia: 8, at: wall.map((p) => [p[0], p[1], p[2] - 40] as Vec3), dir: [0, 0, -1] }), fx({ kind: "screw", len: 50, dia: 5, at: wall, dir: [0, 0, -1] })],
    tools: ["drill", "screwdriver", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  });

  return { parts, steps: splitSides(steps) };
}

const family: Family = {
  names: ["SONGESAND"],
  build(b, s) {
    if (/songesand-chest-[46]-drawers/.test(s.slug ?? "")) {
      buildCustom(b, { ...s, custom: chest(s) });
      chestDrawers(b, s);
      return true;
    }
    if (!/songesand-bed-frame-2-storage-boxes-twin/.test(s.slug ?? "")) return false;
    buildCustom(b, { ...s, custom: twinBed(s) });
    twinBoxes(b);
    return true;
  },
  recipe(s) {
    const slug = s.slug ?? "";
    if (/songesand-nightstand/.test(slug)) return nightstand(s);
    if (/songesand-bed-frame-(160-x-200|queen)/.test(slug)) return bed(s);
    return null;
  },
};
export default family;
