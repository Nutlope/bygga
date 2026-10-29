import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";
import { rotate } from "../math";

/**
 * SMYGA, read from IKEA's bed frame manuals (90x200 and the US twin), the storage box manual and the desk manual.
 *
 * Bed: the headboard and footboard come made up. A dowel goes in each end of the two side rails, the rails are
 * bolted to the headboard legs (barrel nuts dropped into the rails, two long bolts a corner), then the footboard
 * the same way. The loose slats are laid on the ledges and each end is pinned down with a plastic pin (32 on the
 * 90x200, 28 on the twin). The storage version adds two boxes on castors, built upside down: cam bolts, dowels,
 * push-in cam pins and cam locks for the frame, two bottom halves slid in and screwed, five castors.
 *
 * Desk: built upside down. The gallery (back and two curved sides) is joined with cam bolts and the top screwed on,
 * then the apron frame (back rail, two drawer guides, two front pieces and the sides on corner brackets) is
 * dowelled and screwed under the top. Each leg gets a cross dowel and two hanger bolts and is bolted into its
 * corner bracket with a nut and washer. Runners, the drawer, its knob and two cable covers finish it.
 */

const sg = (i: number) => (i === 0 ? -1 : 1);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/* ---------------------------------------------------------------- bed */

const LEG = 45;
const RAIL_LO = 260; // 26 cm free under the bed
const RAIL_H = 150;
const RAIL_T = 18;
const LEDGE_TOP = 330;
const SLAT_T = 15;

interface Bed {
  W: number;
  L: number;
  mW: number;
  mL: number;
  slats: number;
}

function bedOf(s: ProductSpec): Bed {
  const mW = (s.bed?.mattressW ?? 90) * 10;
  const mL = (s.bed?.mattressL ?? 200) * 10;
  const twin = mL < 1950;
  // IKEA: 90x200 is 97 x 208, the twin 103 x 198
  return { mW, mL, W: mW + (twin ? 60 : 70), L: mL + (twin ? 70 : 80), slats: twin ? 14 : 16 };
}

function bedRecipe(s: ProductSpec): CustomParams {
  const { W, L, mW, mL, slats } = bedOf(s);
  const xl = W / 2 - LEG / 2;
  const zH = -L / 2 + LEG / 2, zF = L / 2 - LEG / 2;
  const span = W - 2 * LEG;

  // the headboard: two legs, a solid lower panel, a rail and a row of eight bars under the top rail
  const HH = 930;
  const head: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [LEG, HH, LEG], pos: [g * xl, 0, 0], material: "board" })),
    { shape: "box", size: [span, 290, 18], pos: [0, 415 - HH / 2, 0] },
    { shape: "box", size: [span, 40, 26], pos: [0, 580 - HH / 2, 0] },
    ...range(8).map((i): PartPiece => ({ shape: "box", size: [22, 250, 22], pos: [-span / 2 + ((i + 0.5) * span) / 8, 725 - HH / 2, 0] })),
    { shape: "box", size: [span, 70, 30], pos: [0, 885 - HH / 2, 0] },
  ];
  // the footboard: two legs and a framed panel
  const FH = 680;
  const foot: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [LEG, FH, LEG], pos: [g * xl, 0, 0], material: "board" })),
    { shape: "box", size: [span, 30, 30], pos: [0, 275 - FH / 2, 0] },
    { shape: "box", size: [span, 300, 18], pos: [0, 440 - FH / 2, 0] },
    { shape: "box", size: [span, 70, 30], pos: [0, 625 - FH / 2, 0] },
  ];
  const railX = W / 2 - 6 - RAIL_T / 2;
  const railLen = L - 2 * LEG;
  const ledgeX = railX - RAIL_T / 2 - 12;
  const parts: CustomPart[] = [
    { id: "H", name: "Headboard", size: [W, HH, LEG], pos: [0, HH / 2, zH], pieces: head, material: "board" },
    { id: "F", name: "Footboard", size: [W, FH, LEG], pos: [0, FH / 2, zF], pieces: foot, material: "board" },
  ];
  // each side rail comes with its slat ledge fixed along the inside
  for (const [i, g] of [-1, 1].entries()) {
    parts.push({
      id: `R${i}`,
      name: "Side rail",
      size: [RAIL_T + 24, RAIL_H, railLen],
      pos: [g * (railX - 12), RAIL_LO + RAIL_H / 2, 0],
      pieces: [
        { shape: "box", size: [RAIL_T, RAIL_H, railLen], pos: [g * 12, 0, 0] },
        { shape: "box", size: [24, 30, railLen - 20], pos: [-g * 9, LEDGE_TOP - 15 - (RAIL_LO + RAIL_H / 2), 0], material: "wood" },
      ],
    });
  }
  const slatW = 2 * (railX - RAIL_T / 2) - 4;
  const slatZ = (k: number) => -railLen / 2 + 60 + ((railLen - 120) * k) / (slats - 1);
  for (const k of range(slats)) parts.push({ id: `S${k}`, name: "Slat", size: [slatW, SLAT_T, 70], pos: [0, LEDGE_TOP + SLAT_T / 2, slatZ(k)], material: "wood" });
  parts.push({ id: "M", name: "Your mattress", size: [mW, 160, mL], pos: [0, LEDGE_TOP + SLAT_T + 80, 0], material: "soft", extra: true });

  const dowels = (i: number): CustomFix => ({
    kind: "dowel",
    count: 2,
    len: 30,
    dia: 8,
    on: `R${i}`,
    at: [-1, 1].map((g): Vec3 => [sg(i) * railX, RAIL_LO + RAIL_H / 2, g * (railLen / 2)]),
    dir: [0, 0, 1],
  });
  const ys = [RAIL_LO + 40, RAIL_LO + RAIL_H - 40];
  // barrel nuts go into the rail from the inside, across the bolt's path
  const nuts = (g: number): CustomFix[] =>
    [0, 1].map((i) => ({
      kind: "nut",
      name: "Barrel nut",
      count: 2,
      len: 15,
      dia: 10,
      on: `R${i}`,
      at: ys.map((y): Vec3 => [sg(i) * (railX - RAIL_T / 2), y, g * (railLen / 2 - 30)]),
      dir: [sg(i), 0, 0],
    }));
  const bolts = (g: number, on: string): CustomFix => ({
    kind: "bolt",
    count: 4,
    len: 110,
    dia: 6,
    on,
    at: [0, 1].flatMap((i) => ys.map((y): Vec3 => [sg(i) * railX, y, g * (L / 2)])),
    dir: [0, 0, -g],
  });
  const pins: CustomFix = {
    kind: "pin",
    name: "Slat pin",
    count: slats * 2,
    len: 30,
    dia: 6,
    at: range(slats).flatMap((k) => [-1, 1].map((g): Vec3 => [g * ledgeX, LEDGE_TOP + SLAT_T, slatZ(k)])),
    dir: [0, -1, 0],
  };

  const steps: CustomStep[] = [
    {
      title: "Tap a dowel into each end of the side rails",
      detail: "Lay both rails on a rug, ledge up. One dowel in the end hole of each end; the two holes beside it take the bolts.",
      fix: [dowels(0), dowels(1)],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the side rails to the headboard",
      detail: "The ledges face in. Drop a barrel nut in each hole with its slot facing the bolt, then two bolts through each leg. Leave them a little loose.",
      add: ["H"],
      fix: [...nuts(-1), bolts(-1, "H")],
      tools: ["flathead", "allen"],
      people: 2,
    },
    {
      title: "Bolt on the footboard",
      detail: "Barrel nuts in the foot ends of the rails and two bolts through each leg. Now tighten all eight bolts.",
      add: ["F"],
      fix: [...nuts(1), bolts(1, "F")],
      tools: ["flathead", "allen"],
      people: 2,
      check: "square",
    },
    {
      title: "Lay the slats on the ledges",
      detail: "Turn each slat flat onto the ledges, one at each pair of holes, from the head to the foot.",
      add: range(slats).map((k) => `S${k}`),
      kind: "slats",
    },
    {
      title: "Pin down both ends of every slat",
      detail: "Tap each pin through the slat into the ledge, with a scrap of wood between the hammer and the pin so its head doesn't split.",
      fix: [pins],
      tools: ["hammer"],
      kind: "slats",
    },
    { title: "Lay your mattress on", detail: "Check the bolts again after a week or two.", add: ["M"], people: 2, kind: "cushions" },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- storage boxes */

const BX = 880, BZ = 930, BT = 16;
const CAM_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const CAM: HwDef = { kind: "cam", len: 13, dia: 15 };
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const CAM_PIN: HwDef = { kind: "camScrew", len: 34, dia: 8, name: "Push-in cam pin" };
const BOX_SCREW: HwDef = { kind: "screw", len: 40, dia: 4 };
const CASTOR: HwDef = { kind: "castor", len: 40, dia: 40 };
const CASTOR_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };

/** Two boxes on castors pushed under the bed from the open side, each built upside down on the floor first. */
function boxSteps(b: PlanBuilder, s: ProductSpec) {
  const { W, L } = bedOf(s);
  const x0 = W / 2 - 10 - BX / 2;
  const gap = (L - 2 * LEG - 2 * BZ) / 3;
  const zs = [-(BZ / 2 + gap / 2), BZ / 2 + gap / 2];
  const ym = (h0: number, h1: number) => (h0 + h1) / 2;
  const endT = b.part("Box end", [BT, 220, BZ]);
  const sideT = b.part("Box side", [BX - 2 * BT, 184, BT]);
  const botT = b.part("Box bottom", [BX - 2 * BT, BT, BZ / 2]);
  const boxes = zs.map((z0) => ({
    z0,
    back: b.place(endT, [x0 - BX / 2 + BT / 2, ym(30, 250), z0]),
    front: b.place(endT, [x0 + BX / 2 - BT / 2, ym(30, 250), z0]),
    sides: [-1, 1].map((g) => b.place(sideT, [x0, ym(56, 240), z0 + g * (BZ / 2 - BT / 2)])),
    bottoms: [-1, 1].map((g) => b.place(botT, [x0, 48, z0 + (g * BZ) / 4])),
  }));
  // upside down, side by side on the floor in their own scene
  const flip: Vec3 = [Math.PI, 0, 0];
  const show = (keys: string[], i: number, from: Vec3 = [0, 200, 0]) => {
    const pivot: Vec3 = [x0, 125, boxes[i].z0];
    const at: Vec3 = [(i - 0.5) * (BX + 250), 125, 0];
    for (const k of keys) {
      const it = b.partItem(k);
      const p = rotate([it.final.pos[0] - pivot[0], it.final.pos[1] - pivot[1], it.final.pos[2] - pivot[2]], flip);
      b.stage(k, [p[0] + at[0], p[1] + at[1], p[2] + at[2]], flip, from);
    }
  };
  const scene = "boxes";
  const both = (f: (bx: (typeof boxes)[number]) => FitOpts[]) => boxes.flatMap(f);
  const yA = 90, yB = 200; // the two fitting heights in the frame
  const ins = BZ / 2 - BT / 2;
  const fx = x0 + BX / 2 - BT, bx = x0 - BX / 2 + BT; // inner faces of the front and back
  const zSide = (bxx: (typeof boxes)[number], g: number) => bxx.z0 + g * ins;

  b.step({ title: "Screw the cam bolts into a box end", detail: "Two boxes come in the pack; build both the same way. Four cam bolts into the inside face of one end panel.", tools: ["screwdriver"], scene, kind: "cams" }, () => {
    b.stagger(0.2);
    boxes.forEach((bxx, i) => show([bxx.front], i));
    b.then(0.15);
    b.fits(CAM_BOLT, both((bxx) => [-1, 1].flatMap((g) => [yA, yB].map((y): FitOpts => ({ on: bxx.front, at: [fx, y, zSide(bxx, g)], dir: [1, 0, 0] })))), 0.05);
  });
  b.step({ title: "Tap the dowels into the box sides", detail: "Two in one end of each side panel, the end that meets the panel with the cam bolts.", tools: ["hammer"], scene, kind: "dowels" }, () => {
    b.stagger(0.2);
    // they slide onto the end along its cam bolts
    boxes.forEach((bxx, i) => show(bxx.sides, i, [-250, 0, 0]));
    b.then(0.15);
    b.fits(DOWEL, both((bxx) => [-1, 1].flatMap((g) => [yA + 30, yB - 30].map((y): FitOpts => ({ on: bxx.sides[g < 0 ? 0 : 1], at: [fx, y, zSide(bxx, g)], dir: [1, 0, 0], mate: bxx.front })))), 0.05);
  });
  b.step({ title: "Join the sides to the other end", detail: "Push the cam pins through the end panel into the sides, then turn a cam lock in each side to grip them.", tools: ["flathead"], scene, kind: "cams" }, () => {
    b.stagger(0.2);
    boxes.forEach((bxx, i) => show([bxx.back], i));
    b.then(0.15);
    b.fits(CAM_PIN, both((bxx) => [-1, 1].flatMap((g) => [yA, yB].map((y): FitOpts => ({ on: bxx.back, at: [bx - BT, y, zSide(bxx, g)], dir: [1, 0, 0], mate: bxx.sides[g < 0 ? 0 : 1] })))), 0.05);
    b.then(0.1);
    b.fits(CAM, both((bxx) => [-1, 1].flatMap((g) => [yA, yB].map((y): FitOpts => ({ on: bxx.sides[g < 0 ? 0 : 1], at: [bx + 30, y, zSide(bxx, g) - g * (BT / 2)], dir: [0, 0, g] })))), 0.05);
  });
  b.step({ title: "Lock the end with the cam bolts", detail: "Fit the end on the dowels with the grooves in line, then turn the four cam locks clockwise.", tools: ["flathead"], scene, kind: "cams" }, () => {
    b.fits(CAM, both((bxx) => [-1, 1].flatMap((g) => [yA, yB].map((y): FitOpts => ({ on: bxx.sides[g < 0 ? 0 : 1], at: [fx - 30, y, zSide(bxx, g) - g * (BT / 2)], dir: [0, 0, g] })))), 0.05);
  });
  b.step({ title: "Slide in the first bottom half", detail: "Into the grooves of both end panels, pushed right up to one side.", scene, kind: "join" }, () => {
    b.stagger(0.25);
    boxes.forEach((bxx, i) => show([bxx.bottoms[0]], i));
  });
  b.step({ title: "Tap the dowels into its edge", detail: "Four dowels along the free edge, for the second half to sit on.", tools: ["hammer"], scene, kind: "dowels" }, () =>
    b.fits(DOWEL, both((bxx) => [-0.36, -0.12, 0.12, 0.36].map((f): FitOpts => ({ on: bxx.bottoms[0], at: [x0 + f * (BX - 2 * BT), 48, bxx.z0], dir: [0, 0, 1], mate: bxx.bottoms[1] }))), 0.04),
  );
  b.step({ title: "Slide in the second bottom half", detail: "Press it onto the dowels until the two halves meet with no gap.", scene, kind: "join" }, () => {
    b.stagger(0.25);
    boxes.forEach((bxx, i) => show([bxx.bottoms[1]], i));
  });
  b.step({ title: "Screw the bottom to the frame", detail: "Ten screws through the bottom into the edges of the two sides, five along each.", tools: ["allen"], scene, kind: "screws" }, () => {
    const pts = (bxx: (typeof boxes)[number]): FitOpts[] =>
      [-1, 1].flatMap((g) => [-0.4, -0.2, 0, 0.2, 0.4].map((f): FitOpts => ({ on: bxx.bottoms[g < 0 ? 0 : 1], at: [x0 + f * BX, 40, zSide(bxx, g)], dir: [0, 1, 0], mate: bxx.sides[g < 0 ? 0 : 1] })));
    b.fits(BOX_SCREW, both(pts), 0.04);
  });
  const castorAt = (bxx: (typeof boxes)[number]): Vec3[] => [
    ...[-1, 1].flatMap((gx) => [-1, 1].map((gz): Vec3 => [x0 + gx * (BX / 2 - 80), 40, bxx.z0 + gz * (BZ / 2 - 80)])),
    [x0, 40, bxx.z0],
  ];
  b.step({ title: "Screw on the five castors", detail: "One near each corner and one in the middle, two screws each.", tools: ["screwdriver"], scene, kind: "screws" }, () => {
    b.fits(CASTOR, both((bxx) => castorAt(bxx).map((at): FitOpts => ({ on: bxx.bottoms[at[2] <= bxx.z0 ? 0 : 1], at, dir: [0, 1, 0], hole: false }))), 0.06);
    b.then(0.1);
    b.fits(CASTOR_SCREW, both((bxx) => castorAt(bxx).flatMap((at) => [-14, 14].map((d): FitOpts => ({ on: bxx.bottoms[at[2] <= bxx.z0 ? 0 : 1], at: [at[0] + d, 40, at[2] + (at[2] === bxx.z0 ? 20 : 0)], dir: [0, 1, 0] })))), 0.03);
  });
  b.step({ title: "Push the boxes under the bed", detail: "Turn them over onto their castors and roll them in from the side. The raised ends stop them going too far.", kind: "drawer" }, () => {
    b.stagger(0.3);
    for (const bxx of boxes) for (const k of [bxx.back, bxx.front, ...bxx.sides, ...bxx.bottoms]) b.add(k, [600, 0, 0]);
  });
}

/* ---------------------------------------------------------------- desk */

function deskRecipe(s: ProductSpec): CustomParams & { drawerParts: CustomPart[]; drawer: DeskDrawer } {
  void s;
  const TW = 1220, TD = 600, TT = 22, TY = 740; // top surface 74 cm up
  const GH = 90, GT = 18; // gallery
  const AY0 = 640, AY1 = TY - TT, AH = AY1 - AY0, AT = 18; // apron, 64 cm free under it
  const ay = (AY0 + AY1) / 2;
  const FX = 585, FZ = 280; // frame outside, set in from the top's edge
  const OX = 335; // drawer opening
  const GX = OX + AT / 2; // drawer guides
  const LS = 42;
  const lx = FX - AT - LS / 2, lz = FZ - AT - LS / 2;
  const gy = TY + GH / 2;
  const sideLen = 560;
  // the curved side of the gallery, stepped down toward the front
  const sidePieces: PartPiece[] = [
    { shape: "box", size: [GT, GH, 380], pos: [0, 0, -sideLen / 2 + 190] },
    { shape: "box", size: [GT, 62, 90], pos: [0, -14, -sideLen / 2 + 425] },
    { shape: "box", size: [GT, 30, 90], pos: [0, -30, -sideLen / 2 + 515] },
  ];
  const parts: CustomPart[] = [
    ...[-1, 1].map((g, i): CustomPart => ({ id: `GS${i}`, name: "Gallery side", size: [GT, GH, sideLen], pos: [g * (TW / 2 - GT / 2), gy, -TD / 2 + sideLen / 2], pieces: sidePieces })),
    { id: "GB", name: "Gallery back", size: [TW - 2 * GT, GH, GT], pos: [0, gy, -TD / 2 + GT / 2] },
    { id: "T", name: "Desk top", size: [TW, TT, TD], pos: [0, TY - TT / 2, 0] },
    { id: "BA", name: "Back rail", size: [2 * FX, AH, AT], pos: [0, ay, -FZ + AT / 2] },
    ...[-1, 1].map((g, i): CustomPart => ({ id: `DG${i}`, name: "Drawer guide", size: [AT, AH, 2 * FZ - 2 * AT], pos: [g * GX, ay, 0] })),
    ...[-1, 1].map((g, i): CustomPart => ({ id: `FR${i}`, name: "Front rail", size: [FX - OX, AH, AT], pos: [g * (OX + FX) / 2, ay, FZ - AT / 2] })),
    ...[-1, 1].map((g, i): CustomPart => ({ id: `SA${i}`, name: "Side rail", size: [AT, AH, 2 * FZ - 2 * AT], pos: [g * (FX - AT / 2), ay, 0] })),
    ...[-1, 1].flatMap((gx, i) => [-1, 1].map((gz, j): CustomPart => ({ id: `L${i}${j}`, name: "Leg", size: [LS, AY1, LS], pos: [gx * lx, AY1 / 2, gz * lz], material: "board" }))),
  ];
  // the drawer, inside the opening on its runners
  const dz0 = -FZ + AT + 40, dz1 = FZ - AT;
  const dLen = dz1 - dz0;
  const DS = OX - 13; // outside of the drawer sides, a runner's width in from the guides
  const dy0 = AY0 + 6, dh = 66;
  const drawerParts: CustomPart[] = [
    { id: "DF", name: "Drawer front", size: [2 * OX - 4, AH - 4, AT], pos: [0, ay, FZ - AT / 2] },
    ...[-1, 1].map((g, i): CustomPart => ({ id: `DS${i}`, name: "Drawer side", size: [14, dh, dLen], pos: [g * (DS - 7), dy0 + dh / 2, (dz0 + dz1) / 2] })),
    { id: "DB", name: "Drawer bottom", size: [2 * DS - 28, 4, dLen - 14], pos: [0, dy0 + 10, (dz0 + dz1) / 2 + 3], material: "fiber" },
    { id: "DK", name: "Drawer back", size: [2 * DS - 28, dh - 14, 14], pos: [0, dy0 + 14 + (dh - 14) / 2, dz0 + 7] },
  ];

  const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const legs = [0, 1].flatMap((i) => [0, 1].map((j) => ({ id: `L${i}${j}`, sx: sg(i), sz: sg(j) })));
  const diag = (sx: number, sz: number): Vec3 => [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2];
  const legIn = (l: (typeof legs)[number], y: number, d = 0): Vec3 => [l.sx * (lx - LS / 2 + 6 - d), y, l.sz * (lz - LS / 2 + 6 - d)];
  const brk = (l: (typeof legs)[number]): Vec3 => [l.sx * (lx - LS / 2 - 18), ay, l.sz * (lz - LS / 2 - 18)];

  const steps: CustomStep[] = [
    {
      title: "Screw a cam bolt into each gallery side",
      detail: "Lay the top's upstands on a rug. One cam bolt in the inside face at the back end of each curved side.",
      add: ["GS0", "GS1"],
      fix: [0, 1].map((i): CustomFix => ({ kind: "camScrew", count: 1, on: `GS${i}`, at: [pt(sg(i) * (TW / 2 - GT), gy, -TD / 2 + GT / 2 + 4)], dir: [sg(i), 0, 0] })),
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
      from: { GS0: [-200, 0, 0], GS1: [200, 0, 0] },
    },
    {
      title: "Tap the dowels into the gallery back",
      detail: "One in each end. Use the middle size of dowel.",
      fix: [0, 1].map((i): CustomFix => ({ kind: "dowel", count: 1, len: 30, dia: 8, on: "GB", at: [pt(sg(i) * (TW / 2 - GT), gy + 20, -TD / 2 + GT / 2)], dir: [sg(i), 0, 0] })),
      tools: ["hammer"],
    },
    { title: "Fit the back between the two sides", detail: "Push it onto the cam bolts with the dowels in their holes.", add: ["GB"] },
    {
      title: "Lock the gallery with the cam locks",
      detail: "One in each end of the back, turned clockwise until it pulls the joint tight.",
      fix: [{ kind: "cam", count: 2, on: "GB", at: [-1, 1].map((g) => pt(g * (TW / 2 - GT - 30), gy, -TD / 2 + GT)), dir: [0, 0, -1] }],
      tools: ["flathead"],
    },
    {
      title: "Tap six dowels into the gallery's edge",
      detail: "Into the edge that meets the top: two in the back and two in each side.",
      fix: [{ kind: "dowel", count: 6, len: 30, dia: 8, at: [pt(-300, TY, -TD / 2 + GT / 2), pt(300, TY, -TD / 2 + GT / 2), ...[-1, 1].flatMap((g) => [-200, 40].map((z) => pt(g * (TW / 2 - GT / 2), TY, z)))], dir: [0, -1, 0] }],
      tools: ["hammer"],
    },
    {
      title: "Screw the top onto the gallery",
      detail: "Lay the top face down on the dowels, then eight screws through it into the gallery. Keep the screws straight so they don't come out of the surface.",
      add: ["T"],
      fix: [{ kind: "screw", count: 8, len: 35, dia: 4, on: "T", at: [...[-450, -150, 150, 450].map((x) => pt(x, TY - TT, -TD / 2 + GT / 2)), ...[-1, 1].flatMap((g) => [-150, 60].map((z) => pt(g * (TW / 2 - GT / 2), TY - TT, z)))], dir: [0, 1, 0] }],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the cam bolts into the back rail and front pieces",
      detail: "Two in the back rail where the drawer guides meet it, one in each short front piece.",
      fix: [
        { kind: "camScrew", count: 2, on: "BA", at: [-1, 1].map((g) => pt(g * GX, ay, -FZ + AT)), dir: [0, 0, -1] },
        ...[0, 1].map((i): CustomFix => ({ kind: "camScrew", count: 1, on: `FR${i}`, at: [pt(sg(i) * GX + sg(i) * 4, ay, FZ - AT)], dir: [0, 0, 1] })),
      ],
      tools: ["screwdriver"],
      wait: ["BA", "FR0", "FR1"],
      from: { BA: [0, 0, -300], FR0: [0, 0, 300], FR1: [0, 0, 300] },
    },
    {
      title: "Tap the big dowels into the drawer guides",
      detail: "One in each end of both guides.",
      // each goes into its end of the guide, the back one forwards and the front one backwards
      fix: [0, 1].flatMap((i) => [-1, 1].map((g): CustomFix => ({ kind: "dowel", count: 1, len: 40, dia: 10, on: `DG${i}`, at: [pt(sg(i) * GX, ay + 25, g * (FZ - AT))], dir: [0, 0, -g] }))),
      tools: ["hammer"],
      wait: ["DG0", "DG1"],
      from: { DG0: [0, 0, 300], DG1: [0, 0, 300] },
    },
    {
      title: "Fit the drawer guides between the back rail and the front pieces",
      detail: "The cam bolts go into the holes in the guides' faces.",
      add: ["BA", "DG0", "DG1", "FR0", "FR1"],
      from: { BA: [0, 0, -300], DG0: [0, 0, 300], DG1: [0, 0, 300], FR0: [0, 0, 300], FR1: [0, 0, 300] },
    },
    {
      title: "Lock the guides with the cam locks",
      detail: "Four cam locks, one at each end of both guides, turned clockwise.",
      fix: [0, 1].map((i): CustomFix => ({ kind: "cam", count: 2, on: `DG${i}`, at: [-1, 1].map((g) => pt(sg(i) * (GX + AT / 2), ay, g * (FZ - AT - 30))), dir: [-sg(i), 0, 0] })),
      tools: ["flathead"],
    },
    {
      title: "Screw a leg bracket into each corner",
      detail: "Four brackets: each one screwed to the end of the back rail or a front piece with two screws.",
      fix: [
        { kind: "angle", name: "Leg bracket", count: 4, len: 90, dia: 60, at: legs.map(brk), dir: [0, 1, 0] },
        ...[-1, 1].map((gz): CustomFix => ({ kind: "screw", count: 4, len: 16, dia: 4, at: legs.filter((l) => l.sz === gz).flatMap((l) => [-18, 18].map((dy) => pt(l.sx * (lx - LS / 2 - 30), ay + dy, l.sz * (FZ - AT)))), dir: [0, 0, gz] })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the two side rails",
      detail: "The side with the knob holes goes on whichever end you want the knobs. Two screws through each bracket into the rail.",
      add: ["SA0", "SA1"],
      fix: [0, 1].map((i): CustomFix => ({ kind: "screw", count: 4, len: 16, dia: 4, on: `SA${i}`, at: [-1, 1].flatMap((g) => [-18, 18].map((dy) => pt(sg(i) * (FX - AT), ay + dy, g * (lz - LS / 2 - 30)))), dir: [sg(i), 0, 0] })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the knobs onto a side rail",
      detail: "Three knobs on the outside, each held by a screw from the inside. You can hang small things on them later.",
      fix: [
        { kind: "knob", count: 3, on: "SA1", at: [-120, 0, 120].map((z) => pt(FX, ay, z)), dir: [-1, 0, 0] },
        { kind: "screw", name: "Knob screw", count: 3, len: 35, dia: 4, on: "SA1", at: [-120, 0, 120].map((z) => pt(FX - AT - 5, ay, z)), dir: [1, 0, 0] },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the big dowels into the frame",
      detail: "Eight along the edge that meets the top: two in the back rail, one in each front piece, two in each side rail.",
      fix: [
        {
          kind: "dowel",
          count: 8,
          len: 40,
          dia: 10,
          at: [pt(-300, AY1, -FZ + AT / 2), pt(300, AY1, -FZ + AT / 2), ...[-1, 1].map((g) => pt(g * (FX - 120), AY1, FZ - AT / 2)), ...[-1, 1].flatMap((g) => [-120, 120].map((z) => pt(g * (FX - AT / 2), AY1, z)))],
          dir: [0, 1, 0],
        },
      ],
      tools: ["hammer"],
    },
    {
      title: "Turn the frame onto the top and screw it down",
      detail: "Line the dowels up with the holes in the top, then thirteen long screws through the frame into the top.",
      fix: [
        {
          kind: "screw",
          count: 13,
          len: 70,
          dia: 5,
          at: [
            ...[-400, 0, 400].map((x) => pt(x, AY0, -FZ + AT / 2)),
            ...[-1, 1].flatMap((g) => [OX + 50, FX - 90].map((x) => pt(g * x, AY0, FZ - AT / 2))),
            ...[-1, 1].flatMap((g) => [-150, 150].map((z) => pt(g * (FX - AT / 2), AY0, z))),
            ...[-1, 1].map((g) => pt(g * GX, AY0, -60)),
            pt(0, AY0, FZ - AT / 2 - 600 + AT),
          ].slice(0, 13),
          dir: [0, 1, 0],
        },
      ],
      tools: ["allen"],
      people: 2,
    },
    {
      title: "Fit the cross dowels and hanger bolts in the legs",
      detail: "Push a cross dowel into the hole in each leg with its slot lined up, then screw two hanger bolts into the angled corner until they stop in it.",
      fix: [
        ...legs.map((l): CustomFix => ({ kind: "connector", name: "Cross dowel", count: 1, len: 40, dia: 10, on: l.id, at: [pt(l.sx * (lx + LS / 2), AY1 - 60, l.sz * lz)], dir: [-l.sx, 0, 0] })),
        ...legs.map((l): CustomFix => ({ kind: "stud", name: "Hanger bolt", count: 2, len: 60, dia: 8, on: l.id, at: [AY1 - 90, AY1 - 30].map((y) => legIn(l, y)), dir: diag(l.sx, l.sz) })),
      ],
    },
    {
      title: "Bolt the legs into the brackets",
      detail: "Put each leg in its corner with the bolts through the bracket, then a washer and a nut on each. Tighten with the box spanner.",
      add: legs.map((l) => l.id),
      fix: [
        { kind: "washer", count: 8, len: 2, dia: 16, at: legs.flatMap((l) => [AY1 - 90, AY1 - 30].map((y) => legIn(l, y, 24))), dir: [0, -1, 0] },
        { kind: "nut", count: 8, len: 6, dia: 13, at: legs.flatMap((l) => [AY1 - 90, AY1 - 30].map((y) => legIn(l, y, 26))), dir: [0, -1, 0] },
      ],
      tools: ["wrench"],
    },
    {
      title: "Screw the drawer runners onto the guides",
      detail: "One on the inside of each guide, wheel at the front, two screws each.",
      fix: [
        ...[0, 1].map((i): CustomFix => ({ kind: "runner", name: "Drawer runner", count: 1, len: 420, dia: 20, on: `DG${i}`, at: [pt(sg(i) * OX, AY0 + 16, 10)], dir: [-sg(i), 0, 0] })),
        ...[0, 1].map((i): CustomFix => ({ kind: "screw", count: 2, len: 12, dia: 4, on: `DG${i}`, at: [-150, 150].map((z) => pt(sg(i) * OX, AY0 + 16, z)), dir: [sg(i), 0, 0] })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Stand the desk on its legs", detail: "Two of you lift it over, so the legs don't take the weight on one corner.", pose: "+y", people: 2, kind: "standup" },
  ];
  return { parts, steps, drawerParts, drawer: { ay, FZ, AT, DS, dy0, dz0, dz1, TW, TD, TY } };
}

type DeskDrawer = { ay: number; FZ: number; AT: number; DS: number; dy0: number; dz0: number; dz1: number; TW: number; TD: number; TY: number };

/** The drawer, built face down on the floor as the manual does it, then pushed onto the runners; the cable covers last. */
function deskDrawerSteps(b: PlanBuilder, parts: CustomPart[], d: DeskDrawer) {
  const { ay, FZ, AT, DS, dy0, dz0, dz1, TW, TD, TY } = d;
  const key = (id: string) => {
    const p = parts.find((x) => x.id === id)!;
    return b.place(b.part(p.name, p.size, { material: p.material ?? "board" }), p.pos);
  };
  const DF = key("DF"), DSs = [key("DS0"), key("DS1")], DB = key("DB"), DK = key("DK");
  const scene = "drawer";
  // face down: the front lies on the floor and the drawer is built upwards from it, its back at the top
  const face: Vec3 = [Math.PI / 2, 0, 0];
  const pivot: Vec3 = [0, ay, FZ];
  const lay = (keys: string[], up = 0, from: Vec3 | undefined = [0, 250, 0]) => {
    for (const k of keys) {
      const it = b.partItem(k);
      const q = rotate([it.final.pos[0] - pivot[0], it.final.pos[1] - pivot[1], it.final.pos[2] - pivot[2]], face);
      b.stage(k, [q[0], q[1] + up, q[2]], face, from);
    }
  };
  const step = (title: string, detail: string, body: () => void, o: { tools?: ("hammer" | "flathead" | "screwdriver")[]; kind?: "cams" | "dowels" | "join" | "screws" | "drawer" | "general"; main?: boolean } = {}) =>
    b.step({ title, detail, kind: o.kind ?? "general", tools: o.tools, scene: o.main ? undefined : scene, pose: o.main ? "+y" : undefined }, body);
  const sides = (f: (k: string, g: number) => FitOpts[]) => DSs.flatMap((k, i) => f(k, sg(i)));

  step("Screw the cam bolts into the drawer front", "Lay the front face down on a rug: two cam bolts in the inside face, one near each end.", () => {
    lay([DF]);
    b.then(0.15);
    b.fits(CAM_BOLT, [-1, 1].map((g): FitOpts => ({ on: DF, at: [g * (DS - 7), ay, FZ - AT], dir: [0, 0, 1] })), 0.1);
  }, { tools: ["screwdriver"], kind: "cams" });
  step("Tap the small dowels into the drawer sides", "One in the front end of each side.", () => {
    lay(DSs, 260);
    b.then(0.15);
    b.fits({ kind: "dowel", len: 25, dia: 6 }, sides((k, g) => [{ on: k, at: [g * (DS - 7), dy0 + 20, dz1], dir: [0, 0, -1], mate: DF }]), 0.1);
  }, { tools: ["hammer"], kind: "dowels" });
  step("Stand the sides on the front", "Grooves facing in and toward the bottom edge, dowels and cam bolts in their holes.", () => lay(DSs, 0, undefined), { kind: "join" });
  step("Lock the sides with the cam locks", "One in each side near the front, turned clockwise.", () =>
    b.fits(CAM, sides((k, g) => [{ on: k, at: [g * (DS - 14), ay, dz1 - 30], dir: [g, 0, 0] }]), 0.1),
  { tools: ["flathead"], kind: "cams" });
  step("Slide in the drawer bottom", "Smooth side up, down the grooves until it meets the front.", () => lay([DB], 0, [0, 400, 0]), { kind: "join" });
  step("Lower the back onto the bottom", "Tilt it in over the end of the bottom, between the sides.", () => lay([DK], 0, [0, 250, 0]), { kind: "join" });
  step("Hammer the expanding dowels in", "One through each side into the back.", () =>
    b.fits({ kind: "dowel", len: 35, dia: 8, name: "Expanding dowel" }, sides((k, g) => [{ on: k, at: [g * DS, dy0 + 40, dz0 + 7], dir: [-g, 0, 0], mate: DK }]), 0.15),
  { tools: ["hammer"], kind: "dowels" });
  step("Screw the runner parts onto the drawer", "Click each one onto the bottom edge of a side, then two screws at the back.", () =>
    b.fits({ kind: "screw", len: 12, dia: 4 }, sides((k, g) => [dz0 + 20, dz0 + 80].map((z): FitOpts => ({ on: k, at: [g * DS, dy0 + 10, z], dir: [-g, 0, 0] }))), 0.08),
  { tools: ["screwdriver"], kind: "screws" });
  step("Screw the knob onto the drawer front", "The screw goes in from the inside.", () => {
    b.fit({ kind: "knob", len: 25, dia: 30 }, { on: DF, at: [0, ay, FZ], dir: [0, 0, -1], hole: false });
    b.fit({ kind: "screw", len: 25, dia: 4, name: "Knob screw" }, { on: DF, at: [0, ay, FZ - AT], dir: [0, 0, 1] });
  }, { tools: ["screwdriver"], kind: "screws" });
  step("Push the drawer onto the runners", "Tilt it in at the front, lower it onto the runners and push until it closes softly.", () => {
    b.stagger(0.05);
    for (const k of [DF, ...DSs, DB, DK]) b.add(k, [0, 0, 450]);
  }, { kind: "drawer", main: true });
  const top = b.items.find((i) => i.kind === "part" && b.parts.find((t) => t.id === i.ref)?.name === "Desk top")?.key;
  step("Press in the cable covers", "One in each hole at the back corners of the top.", () =>
    b.fits({ kind: "cap", len: 12, dia: 60, name: "Cable cover" }, [-1, 1].map((g): FitOpts => ({ on: top, at: [g * (TW / 2 - 110), TY, -TD / 2 + 90], dir: [0, -1, 0], hole: false })), 0.15),
  { main: true });
}

/* ---------------------------------------------------------------- family */

const isBed = (s: ProductSpec) => s.archetype === "bed" && /bed frame/i.test(s.variant);
const isDesk = (s: ProductSpec) => s.archetype === "table" && /desk/i.test(s.variant);
const withStorage = (s: ProductSpec) => /storage/i.test(s.variant) || /storage/.test(s.slug ?? "");

const family: Family = {
  names: ["SMYGA"],
  recipe(s) {
    if (isBed(s) && !withStorage(s)) return bedRecipe(s);
    return null;
  },
  build(b, s) {
    if (isDesk(s)) {
      const { drawerParts, drawer, ...custom } = deskRecipe(s);
      buildCustom(b, { ...s, custom });
      deskDrawerSteps(b, drawerParts, drawer);
      return true;
    }
    if (!isBed(s) || !withStorage(s)) return false;
    buildCustom(b, { ...s, custom: bedRecipe(s) });
    boxSteps(b, s);
    return true;
  },
};
export default family;
