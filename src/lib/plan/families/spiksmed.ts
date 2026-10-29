import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * SPIKSMED, read from IKEA's manuals for the 59.5x96 cabinet and the 117x32 media shelf.
 *
 * Cabinet: cam bolts go into the sides and dowels into the top, the fixed shelf and the bottom; door tracks press
 * into the fixed shelf and the bottom, and two wall brackets are screwed under the fixed shelf. With one side on
 * the floor the three panels are locked on one by one, the two sliding doors (a guide screwed on top of each) go
 * into their tracks, and the other side closes it. Upside down, the two back halves slide down the grooves and are
 * held by rivets and clips, nail-on glides go under the sides, then the shelf pins, the shelf and the wall screws.
 * Media shelf: tracks into the top and bottom, wall hangers and cam bolts on the panels, built upside down on the
 * top panel (an end, the divider, the bottom, the door with its guide, the other end), then hung on four screws,
 * the hangers adjusted and covered.
 * Sideboard: runners and cam bolts go on the sides and the divider first; standing on the bottom, the left side,
 * the left shelf (with its door tracks), the divider, the right shelf and the right side are locked on in turn, the
 * back halves slide down their grooves, the doors (a guide on each) go into the tracks and the top closes it. Lying
 * on its front it takes its glides and the back connectors, then it's stood up, fixed to the wall, the loose shelves
 * go on pins and the two drawers are built (front, sides, bottom, back) and slid onto their runners.
 */

const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const S = [-1, 1];
const T = 16; // panels
const CAM_A = { name: "Cam lock" };
const CAM_B = { name: "Cam lock (small)", len: 11, dia: 12 };

/* ---------------------------------------------------------------- cabinet */

function cabinetRecipe(): CustomParams {
  const W = 595, H = 960, D = 320;
  const xi = W / 2 - T; // inside face of the sides
  const zb = -D / 2 + 14; // the back sits in a groove this far in
  const pd = D / 2 - (zb + 2); // depth of the panels in front of the back
  const pz = (D / 2 + zb + 2) / 2;
  const yBot = 20, yFix = 744, yTop = H - T; // bottoms of the bottom, fixed shelf and top
  const TR = 8; // tracks
  const zDoor = [D / 2 - 20, D / 2 - 45]; // front and back track
  const dy0 = yBot + T + TR, dy1 = yFix - TR;
  const dw = 2 * xi / 2 + 15;
  const panel = (id: string, name: string, y: number): CustomPart => ({ id, name, size: [2 * xi, T, pd], pos: [0, y + T / 2, pz], material: "board" });
  const parts: CustomPart[] = [
    ...S.map((sx, i): CustomPart => ({ id: `P${i}`, name: "Side", size: [T, H, D], pos: [sx * (W / 2 - T / 2), H / 2, 0], material: "board" })),
    panel("TP", "Top", yTop),
    panel("FS", "Fixed shelf", yFix),
    panel("BT", "Bottom", yBot),
    ...zDoor.flatMap((z, k) => [
      { id: `TB${k}`, name: "Door track", size: [2 * xi, TR, 12], pos: [0, yBot + T + TR / 2, z], material: "metal" } as CustomPart,
      { id: `TF${k}`, name: "Door track", size: [2 * xi, TR, 12], pos: [0, yFix - TR / 2, z], material: "metal" } as CustomPart,
    ]),
    { id: "DB", name: "Sliding door", size: [dw, dy1 - dy0, T], pos: [-xi + dw / 2, (dy0 + dy1) / 2, zDoor[1]], material: "board" },
    { id: "DF", name: "Sliding door", size: [dw, dy1 - dy0, T], pos: [xi - dw / 2, (dy0 + dy1) / 2, zDoor[0]], material: "board" },
    ...S.map((sx, i): CustomPart => ({ id: `B${i}`, name: "Back half", size: [xi, H - 8, 4], pos: [sx * (xi / 2), H / 2, zb], material: "fiber" })),
    { id: "SH", name: "Shelf", size: [2 * xi - 2, T, 240], pos: [0, 400, zb + 2 + 120], material: "board" },
  ];
  const ends = (id: string, y: number) => S.map((sx) => fx("dowel", [-110, 110].map((z) => pt(sx * xi, y + T / 2, z)), [-sx, 0, 0], { on: id, len: 24, dia: 8 }));
  const camBolts = (i: number) => {
    const sx = i ? 1 : -1;
    return fx("camScrew", [yTop, yFix, yBot].flatMap((y) => [-100, 60].map((z) => pt(sx * xi, y + T / 2, z))), [sx, 0, 0], { on: `P${i}` });
  };
  // cam locks from the hidden face of each panel: under the top, on top of the fixed shelf and the bottom
  const locks = (sx: number, id: string, y: number, up: boolean): CustomFix =>
    fx("cam", [-100, 60].map((z) => pt(sx * (xi - 34), up ? y : y + T, z)), [0, up ? 1 : -1, 0], { on: id, ...CAM_A });
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into a side",
      detail: "Lay both sides on a rug, inside up. Six cam bolts in each, screwed in by hand until they stop. The second side goes on later.",
      add: ["P0"],
      fix: [camBolts(0)],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Tap dowels into the top, the fixed shelf and the bottom",
      detail: "Two in each end of all three panels.",
      add: ["TP", "FS", "BT"],
      fix: [...ends("TP", yTop), ...ends("FS", yFix), ...ends("BT", yBot)],
      tools: ["hammer"],
    },
    {
      title: "Press the door tracks into place",
      detail: "Two tracks along the top of the bottom panel, two under the fixed shelf, pushed into the grooves along their whole length.",
      add: ["TB0", "TB1", "TF0", "TF1"],
    },
    {
      title: "Screw two wall brackets under the fixed shelf",
      detail: "At the back, one near each end, each with a screw and a washer. They fix the cabinet to the wall at the end.",
      fix: [
        fx("angle", S.map((sx) => pt(sx * (xi - 60), yFix, zb + 20)), [0, 1, 0], { name: "Wall bracket", len: 50, dia: 24, on: "FS", twist: Math.PI }),
        fx("washer", S.map((sx) => pt(sx * (xi - 60), yFix - 2, zb + 30)), [0, 1, 0], { on: "FS" }),
        fx("screw", S.map((sx) => pt(sx * (xi - 60), yFix - 3, zb + 30)), [0, 1, 0], { len: 16, dia: 4, on: "FS" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the top to the side",
      detail: "Its dowels into the side lying on the rug. Two cam locks, arrow towards the bolt, then turn clockwise.",
      fix: [locks(-1, "TP", yTop, true)],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the fixed shelf to the side",
      detail: "Tracks facing down, towards the bottom. Two cam locks.",
      fix: [locks(-1, "FS", yFix, false)],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the bottom to the side",
      detail: "Tracks facing up. Two cam locks.",
      fix: [locks(-1, "BT", yBot, false)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw a guide onto the top of each door",
      detail: "Two screws each, on the top edge, so the door runs in the upper track.",
      fix: [
        fx("clip", [pt(-xi + dw / 2, dy1, zDoor[1])], [0, -1, 0], { name: "Door guide", len: 20, dia: 14, on: "DB" }),
        fx("clip", [pt(xi - dw / 2, dy1, zDoor[0])], [0, -1, 0], { name: "Door guide", len: 20, dia: 14, on: "DF" }),
        fx("screw", [-12, 12].map((d) => pt(-xi + dw / 2 + d, dy1, zDoor[1])), [0, -1, 0], { len: 12, dia: 3.5, on: "DB" }),
        fx("screw", [-12, 12].map((d) => pt(xi - dw / 2 + d, dy1, zDoor[0])), [0, -1, 0], { len: 12, dia: 3.5, on: "DF" }),
      ],
      tools: ["screwdriver"],
      wait: ["DB", "DF"],
    },
    {
      title: "Slide the doors into the tracks",
      detail: "From the open side: the back door in the back tracks, the front door in the front ones.",
      add: ["DB", "DF"],
      from: { DB: [600, 0, 0], DF: [600, 0, 0] },
    },
    {
      title: "Lock on the other side",
      detail: "Its cam bolts screwed in first, then press it onto the dowels and turn six cam locks.",
      add: ["P1"],
      fix: [camBolts(1), locks(1, "TP", yTop, true), locks(1, "FS", yFix, false), locks(1, "BT", yBot, false)],
      tools: ["screwdriver"],
    },
    {
      title: "Stand it upside down and slide in the back",
      detail: "Two halves, each down its groove until it reaches the top.",
      add: ["B0", "B1"],
      pose: "-y",
      from: { B0: [0, -900, 0], B1: [0, -900, 0] },
    },
    {
      title: "Fix the back to the fixed shelf",
      detail: "Three plastic rivets through the back into the shelf's back edge: push the sleeve in, then the pin.",
      fix: [
        fx("clip", [-180, 0, 180].map((x) => pt(x, yFix + T / 2, zb - 2)), [0, 0, 1], { name: "Rivet sleeve", len: 14, dia: 8 }),
        fx("clip", [-180, 0, 180].map((x) => pt(x, yFix + T / 2, zb - 3)), [0, 0, 1], { name: "Rivet pin", len: 16, dia: 10 }),
      ],
    },
    {
      title: "Clip the back to the sides",
      detail: "Eight clips along the inside of the sides, each clip with its wedge pushed in behind it.",
      fix: [
        fx("clip", S.flatMap((sx) => [200, 450, 650, 850].map((y) => pt(sx * xi, y, zb + 6))), [0, 0, -1], { name: "Back clip", len: 14, dia: 12 }),
        fx("clip", S.flatMap((sx) => [200, 450, 650, 850].map((y) => pt(sx * (xi - 8), y, zb + 6))), [0, 0, -1], { name: "Clip wedge", len: 10, dia: 8 }),
      ],
    },
    {
      title: "Knock a glide under each corner",
      detail: "Four nail-on glides into the bottom edges of the sides.",
      fix: [fx("glide", S.flatMap((sx) => [-130, 130].map((z) => pt(sx * (W / 2 - T / 2), 0, z))), [0, 1, 0], { name: "Nail-on glide", len: 6, dia: 16 })],
      tools: ["hammer"],
    },
    {
      title: "Turn it over and stick on the cap",
      detail: "Stand it up the right way. Peel the backing off the round cap and press it onto its mark on the top.",
      fix: [fx("cap", [pt(-W / 2 + W / 3, H, 60)], [0, -1, 0], { name: "Cover cap", len: 3, dia: 30 })],
      pose: "+y",
    },
    {
      title: "Push in the shelf pins",
      detail: "Four, at the same height on both sides, behind the doors.",
      fix: S.map((sx) => fx("pin", [-80, 60].map((z) => pt(sx * xi, 400 - T / 2 - 4, z)), [sx, 0, 0])),
    },
    { title: "Lay the shelf on the pins", detail: "Slide one door across to reach in.", add: ["SH"] },
    {
      title: "Fix it to the wall",
      detail: "Screw the two brackets under the fixed shelf to the wall, with a washer under each screw. Wall plugs and screws aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", S.map((sx) => pt(sx * (xi - 60), yFix - 25, -D / 2 - 30)), [0, 0, -1]),
        fx("washer", S.map((sx) => pt(sx * (xi - 60), yFix - 25, -D / 2 + 1)), [0, 0, -1], { included: true }),
        fx("screw", S.map((sx) => pt(sx * (xi - 60), yFix - 25, -D / 2 + 2)), [0, 0, -1], { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- media shelf */

function mediaRecipe(): CustomParams {
  const W = 1170, H = 160, D = 320;
  const xi = W / 2 - T;
  const yTop = H - T;
  const cut = 300; // the cable cut-out in the back edge of the top and bottom, each side of the middle
  const cutD = 40;
  const longPieces: PartPiece[] = [
    { shape: "box", size: [2 * xi, T, D - cutD], pos: [0, 0, cutD / 2] },
    ...S.map((sx): PartPiece => ({ shape: "box", size: [xi - cut, T, cutD], pos: [sx * (cut + (xi - cut) / 2), 0, -D / 2 + cutD / 2] })),
  ];
  const TR = 4;
  const zT = D / 2 - 20;
  const dz = zT;
  const dW = xi - 4;
  const dy0 = T + TR, dy1 = yTop - TR;
  const parts: CustomPart[] = [
    { id: "TP", name: "Top", size: [2 * xi, T, D], pos: [0, yTop + T / 2, 0], pieces: longPieces, material: "board" },
    { id: "BT", name: "Bottom", size: [2 * xi, T, D], pos: [0, T / 2, 0], pieces: longPieces, material: "board" },
    { id: "TT", name: "Door track", size: [2 * xi, TR, 12], pos: [0, yTop - TR / 2, zT], material: "metal" },
    { id: "TB", name: "Door track", size: [2 * xi, TR, 12], pos: [0, T + TR / 2, zT], material: "metal" },
    ...S.map((sx, i): CustomPart => ({ id: `E${i}`, name: "End panel", size: [T, H, D], pos: [sx * (W / 2 - T / 2), H / 2, 0], material: "board" })),
    { id: "DV", name: "Divider", size: [T, yTop - T, D - 60], pos: [0, H / 2, -30], material: "board" },
    { id: "DR", name: "Sliding door", size: [dW, dy1 - dy0, T], pos: [-xi + dW / 2, (dy0 + dy1) / 2, dz], material: "board" },
  ];
  const zh = -D / 2 + cutD + 20; // the hangers sit just in front of the back edge
  const midH = S.map((sx) => pt(sx * 40, yTop, zh));
  const endH = S.map((sx) => pt(sx * xi, H / 2 + 20, zh));
  const steps: CustomStep[] = [
    {
      title: "Press the door tracks into the top and bottom",
      detail: "Lay both long panels on a rug, grooves up, and press a track into each groove along its whole length.",
      add: ["TP", "TT"],
      wait: ["BT"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw two wall hangers to the top",
      detail: "Either side of the middle, two screws each, the plate standing up at the back edge. Clip a keyhole plate into each.",
      fix: [
        fx("angle", midH, [0, 1, 0], { name: "Wall hanger", len: 50, dia: 50, on: "TP", twist: Math.PI }),
        fx("screw", midH.flatMap((p) => [-12, 12].map((d) => pt(p[0] + d, yTop, p[2] + 18))), [0, 1, 0], { len: 12, dia: 4, on: "TP" }),
        fx("clip", midH.map((p) => pt(p[0], yTop - 30, p[2] - 18)), [0, 0, 1], { name: "Keyhole plate", len: 4, dia: 30 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the ends of the top and bottom",
      detail: "Two in each end, eight in all.",
      fix: [
        ...S.map((sx) => fx("dowel", [-100, 100].map((z) => pt(sx * xi, yTop + T / 2, z)), [-sx, 0, 0], { on: "TP", len: 24, dia: 8 })),
        ...S.map((sx) => fx("dowel", [-100, 100].map((z) => pt(sx * xi, T / 2, z)), [-sx, 0, 0], { on: "BT", len: 24, dia: 8 })),
      ],
      tools: ["hammer"],
    },
    {
      title: "Screw in the cam bolts for the divider",
      detail: "Two in the middle of the top and two in the middle of the bottom.",
      fix: [
        fx("camScrew", [-80, 80].map((z) => pt(0, yTop, z - 30)), [0, 1, 0], { on: "TP" }),
        fx("camScrew", [-80, 80].map((z) => pt(0, T, z - 30)), [0, -1, 0], { on: "BT" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw a wall hanger to each end panel",
      detail: "On the inside face near the back, two screws each, and a keyhole plate clipped in.",
      wait: ["E0", "E1"],
      fix: [
        ...S.map((sx, i) => fx("angle", [endH[i]], [sx, 0, 0], { name: "Wall hanger", len: 50, dia: 50, on: `E${i}`, twist: Math.PI / 2 })),
        ...S.map((sx, i) => fx("screw", [-14, 14].map((d) => pt(sx * xi, endH[i][1] + d, zh + 18)), [sx, 0, 0], { len: 12, dia: 4, on: `E${i}` })),
        fx("clip", endH.map((p) => pt(p[0] - Math.sign(p[0]) * 30, p[1], p[2] - 18)), [0, 0, 1], { name: "Keyhole plate", len: 4, dia: 30 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw cam bolts into the end panels",
      detail: "Four in each, two at the top and two at the bottom.",
      fix: S.map((sx, i) => fx("camScrew", [yTop + T / 2, T / 2].flatMap((y) => [-60, 60].map((z) => pt(sx * xi, y, z))), [sx, 0, 0], { on: `E${i}` })),
      tools: ["screwdriver"],
    },
    {
      title: "Push an end panel onto the top",
      detail: "The top lies upside down on the rug, tracks up. Press the end panel onto its dowels.",
      add: ["E0"],
    },
    {
      title: "Lock the end panel to the top",
      detail: "Two cam locks, arrow towards the bolt, then turn clockwise.",
      fix: [fx("cam", [-60, 60].map((z) => pt(-xi + 34, yTop, z)), [0, 1, 0], { on: "TP", ...CAM_A })],
      tools: ["screwdriver"],
    },
    {
      title: "Stand the divider on the top",
      detail: "Four dowels in its ends first, two in each, then press it onto the cam bolts in the middle.",
      add: ["DV"],
      fix: [
        fx("dowel", [-130, 70].map((z) => pt(0, yTop, z)), [0, -1, 0], { on: "DV", len: 24, dia: 8 }),
        fx("dowel", [-130, 70].map((z) => pt(0, T, z)), [0, 1, 0], { on: "DV", len: 24, dia: 8 }),
      ],
      tools: ["hammer"],
    },
    {
      title: "Lock the divider to the top",
      detail: "Two small cam locks in the divider's side.",
      fix: [fx("cam", [-80, 80].map((z) => pt(-T / 2, yTop - 30, z - 30)), [1, 0, 0], { on: "DV", ...CAM_B })],
      tools: ["screwdriver"],
    },
    {
      title: "Lower the bottom onto it",
      detail: "Its dowels and cam bolts into the end panel and the divider.",
      add: ["BT", "TB"],
      from: { BT: [300, -300, 0], TB: [300, -300, 0] },
    },
    {
      title: "Lock the bottom",
      detail: "Two cam locks in the bottom by the end panel, two small ones in the divider.",
      fix: [
        fx("cam", [-60, 60].map((z) => pt(-xi + 34, T, z)), [0, -1, 0], { on: "BT", ...CAM_A }),
        fx("cam", [-80, 80].map((z) => pt(-T / 2, T + 30, z - 30)), [1, 0, 0], { on: "DV", ...CAM_B }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the guide on the door",
      detail: "Hook it over the top edge of the door, in the middle.",
      fix: [fx("clip", [pt(-xi + dW / 2, dy1, dz)], [0, -1, 0], { name: "Door guide", len: 20, dia: 14, on: "DR" })],
      wait: ["DR"],
    },
    {
      title: "Screw the guide down",
      detail: "Two short screws.",
      fix: [fx("screw", [-12, 12].map((d) => pt(-xi + dW / 2 + d, dy1, dz)), [0, -1, 0], { len: 10, dia: 3.5, on: "DR" })],
      wait: ["DR"],
      tools: ["screwdriver"],
    },
    {
      title: "Slide the door into the tracks",
      detail: "From the open end, guide in the upper track.",
      add: ["DR"],
      from: { DR: [900, 0, 0] },
    },
    {
      title: "Push on the other end panel",
      detail: "Onto the dowels in the top and the bottom.",
      add: ["E1"],
    },
    {
      title: "Lock it and turn the shelf over",
      detail: "Four cam locks. Then turn it the right way up.",
      fix: [fx("cam", [yTop, T].flatMap((y) => [-60, 60].map((z) => pt(xi - 34, y, z))), [0, 1, 0], CAM_A)].flatMap((f) =>
        [true, false].map((top) => ({ ...f, at: f.at!.filter((p) => (p[1] > H / 2) === top), count: 2, dir: [0, top ? 1 : -1, 0] as Vec3 })),
      ),
      tools: ["screwdriver"],
      pose: "+y",
    },
    {
      title: "Mark the four screw holes on the wall",
      detail: "Tape the drilling template to the wall, level it, and mark through the four crosses.",
      tools: ["level", "pencil", "tape"],
      wall: true,
    },
    {
      title: "Put in the four wall screws",
      detail: "Drill, plug and screw them in, leaving the heads standing out a few millimetres. Wall plugs and screws aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", [...midH, ...endH.map((p) => pt(p[0] - Math.sign(p[0]) * 30, p[1], p[2]))].map((p) => pt(p[0], H - 40, -D / 2 - 30)), [0, 0, -1]),
        fx("screw", [...midH, ...endH.map((p) => pt(p[0] - Math.sign(p[0]) * 30, p[1], p[2]))].map((p) => pt(p[0], H - 40, -D / 2 - 4)), [0, 0, -1], { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
    },
    {
      title: "Hang the shelf on the screws",
      detail: "Lift it together and lower the four hangers onto the screw heads.",
      people: 2,
      warnings: ["two", "wall"],
    },
    {
      title: "Adjust the hangers",
      detail: "Turn the screws in the hangers to pull it tight against the wall and to level it.",
      tools: ["screwdriver", "level"],
      check: "square",
    },
    {
      title: "Snap on the hanger covers",
      detail: "One over each of the four hangers.",
      fix: [
        fx("cap", midH.map((p) => pt(p[0], yTop - 30, p[2] + 30)), [0, 0, -1], { name: "Hanger cover", len: 4, dia: 50 }),
        fx("cap", endH.map((p) => pt(p[0] - Math.sign(p[0]) * 30, p[1], p[2] + 30)), [0, 0, -1], { name: "Hanger cover", len: 4, dia: 50 }),
      ],
    },
  ];
  return { parts, steps };
}


/* ---------------------------------------------------------------- sideboard */

const SB = { W: 970, H: 795, D: 400 };
const SB_Y0 = 6; // glides under the bottom
const SB_YS = 480; // underside of the fixed shelves over the doors
const SB_CW = SB.W / 2 - T - T / 2; // inside width of each half
const SB_ZB = -SB.D / 2 + 12; // the back halves sit in grooves this far in
const SB_DRAWER_Y = 700; // runner height

function sideboardParts(): CustomPart[] {
  const { W, H, D } = SB;
  const yb = SB_Y0 + T, yt = H - T; // top of the bottom, underside of the top
  const uh = yt - yb;
  const zf = D / 2;
  const dvD = zf - 50 - (SB_ZB + 2);
  const shD = zf - (SB_ZB + 2);
  const half = (sx: number) => sx * (T / 2 + SB_CW / 2);
  const dH = SB_YS - 6 - (yb + 6);
  const zDoor = [zf - 10, zf - 28]; // front and back door
  return [
    { id: "BT", name: "Bottom", size: [W, T, D], pos: [0, SB_Y0 + T / 2, 0] },
    { id: "TB0", name: "Door track", size: [W - 2 * T, 6, 10], pos: [0, yb + 3, zDoor[0]], material: "metal" },
    { id: "TB1", name: "Door track", size: [W - 2 * T, 6, 10], pos: [0, yb + 3, zDoor[1]], material: "metal" },
    { id: "SL", name: "Side", size: [T, uh, D], pos: [-(W / 2 - T / 2), yb + uh / 2, 0] },
    { id: "SR", name: "Side", size: [T, uh, D], pos: [W / 2 - T / 2, yb + uh / 2, 0] },
    { id: "LS", name: "Shelf", size: [SB_CW, T, shD], pos: [half(-1), SB_YS + T / 2, (SB_ZB + 2 + zf) / 2] },
    { id: "RS", name: "Shelf", size: [SB_CW, T, shD], pos: [half(1), SB_YS + T / 2, (SB_ZB + 2 + zf) / 2] },
    ...S.flatMap((sx, i) => zDoor.map((z, k): CustomPart => ({ id: `T${i}${k}`, name: "Upper door track", size: [SB_CW, 6, 10], pos: [half(sx), SB_YS - 3, z], material: "metal" }))),
    { id: "DV", name: "Divider", size: [T, uh, dvD], pos: [0, yb + uh / 2, SB_ZB + 2 + dvD / 2] },
    ...S.map((sx, i): CustomPart => ({ id: `B${i}`, name: "Back half", size: [SB_CW + T, uh, 3], pos: [sx * (SB_CW / 2 + T / 2), yb + uh / 2, SB_ZB], material: "fiber" })),
    { id: "DB", name: "Sliding door", size: [480, dH, T], pos: [-(SB.W / 2 - T) + 240, yb + 6 + dH / 2, zDoor[1]] },
    { id: "DF", name: "Sliding door", size: [480, dH, T], pos: [SB.W / 2 - T - 240, yb + 6 + dH / 2, zDoor[0]] },
    { id: "TP", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0] },
    ...S.map((sx, i): CustomPart => ({ id: `L${i}`, name: "Loose shelf", size: [SB_CW - 2, T, 300], pos: [half(sx), 250, SB_ZB + 2 + 150] })),
  ];
}

function sideboardRecipe(): CustomParams {
  const { W, H, D } = SB;
  const yb = SB_Y0 + T, yt = H - T;
  const xo = W / 2 - T / 2, xi = W / 2 - T;
  const parts = sideboardParts();
  const dz = [-110, 90]; // the two fittings along each joint, front to back
  const ux = [-xo, 0, xo];
  const uid = ["SL", "DV", "SR"];
  const zOf = (i: number) => (i === 1 ? [-120, 60] : dz);
  // the bottom's dowels stick up into the uprights, the top's down into them; cam bolts in the uprights' ends
  const botDowels = ux.map((x, i) => fx("dowel", zOf(i).map((z) => pt(x, yb, z)), [0, -1, 0], { on: "BT", len: 30, dia: 8 }));
  const topDowels = ux.map((x, i) => fx("dowel", zOf(i).map((z) => pt(x, yt, z)), [0, 1, 0], { on: "TP", len: 30, dia: 8 }));
  const camB = (i: number) => [
    fx("camScrew", zOf(i).map((z) => pt(ux[i], yb, z + 40)), [0, 1, 0], { on: uid[i] }),
    fx("camScrew", zOf(i).map((z) => pt(ux[i], yt, z + 40)), [0, -1, 0], { on: uid[i] }),
  ];
  const camL = (y: number, up: boolean, on: string, i: number) =>
    fx("cam", zOf(i).map((z) => pt(ux[i] + (i === 0 ? 34 : i === 2 ? -34 : 34), up ? y + T : y, z + 40)), [0, up ? -1 : 1, 0], { on, ...CAM_A });
  const ys = SB_YS + T / 2;
  const runnerAt = (x: number, d: number, on: string) => fx("runner", [pt(x, SB_DRAWER_Y, 10)], [d, 0, 0], { len: 340, dia: 30, name: "Drawer runner", on });
  const runnerScrews = (x: number, d: number, on: string) => fx("screw", [-120, 140].map((z) => pt(x, SB_DRAWER_Y, z)), [d, 0, 0], { len: 12, dia: 4, on });
  const guideY = SB_YS - 6;
  const steps: CustomStep[] = [
    {
      title: "Press the door tracks into the bottom",
      detail: "Lay the bottom on a rug, grooves up, and push both tracks into their grooves along their whole length.",
      add: ["BT", "TB0", "TB1"],
      warnings: ["floor"],
    },
    {
      title: "Screw a drawer runner inside each side",
      detail: "Near the top, the wheel end at the front. Two screws each.",
      fix: [runnerAt(-xi, -1, "SL"), runnerScrews(-xi, -1, "SL"), runnerAt(xi, 1, "SR"), runnerScrews(xi, 1, "SR")],
      wait: ["SL", "SR"],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the drawer runners onto the divider",
      detail: "One on each face, both wheel ends at the front. Two screws each.",
      fix: [runnerAt(-T / 2, 1, "DV"), runnerScrews(-T / 2, 1, "DV"), runnerAt(T / 2, -1, "DV"), runnerScrews(T / 2, -1, "DV")],
      wait: ["DV"],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the cam bolts into the sides and the divider",
      detail: "Two in the top end and two in the bottom end of each, twelve in all, by hand until they stop.",
      fix: [0, 1, 2].flatMap(camB),
      tools: ["screwdriver"],
    },
    {
      title: "Screw in the cam bolts for the shelves",
      detail: "One in the inside face of each side and one in each face of the divider, at the shelf holes.",
      fix: [
        fx("camScrew", [pt(-xi, ys, 20)], [-1, 0, 0], { on: "SL" }),
        fx("camScrew", [pt(xi, ys, 20)], [1, 0, 0], { on: "SR" }),
        fx("camScrew", [pt(-T / 2, ys, 20)], [1, 0, 0], { on: "DV" }),
        fx("camScrew", [pt(T / 2, ys, 20)], [-1, 0, 0], { on: "DV" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the bottom",
      detail: "Two where each side stands and two in the middle for the divider.",
      fix: botDowels,
      tools: ["hammer"],
    },
    {
      title: "Stand the left side on the bottom",
      detail: "Down onto its dowels and cam bolts, runner inside.",
      add: ["SL"],
    },
    {
      title: "Lock the left side",
      detail: "Two cam locks in the bottom, arrow towards the bolt, then turn clockwise.",
      fix: [camL(SB_Y0, true, "BT", 0)],
      tools: ["screwdriver"],
    },
    {
      title: "Tap two dowels into the left shelf",
      detail: "In the end that meets the side.",
      fix: [fx("dowel", [-100, 120].map((z) => pt(-xi, ys, z)), [1, 0, 0], { on: "LS", len: 30, dia: 8 })],
      wait: ["LS"],
      tools: ["hammer"],
    },
    {
      title: "Push the left shelf into the side",
      detail: "Door tracks underneath, at the front. Its dowels go into the side.",
      add: ["LS", "T00", "T01"],
    },
    {
      title: "Lock the shelf to the side",
      detail: "One cam lock in the top of the shelf.",
      fix: [fx("cam", [pt(-xi + 34, SB_YS + T, 20)], [0, -1, 0], { on: "LS", name: "Cam lock (small)", len: 11, dia: 12 })],
      tools: ["screwdriver"],
    },
    {
      title: "Stand the divider in the middle",
      detail: "Tilt it in so its cam bolt goes into the shelf's end, then lower it onto the dowels in the bottom.",
      add: ["DV"],
      from: { DV: [260, 320, 0] },
    },
    {
      title: "Lock the divider",
      detail: "Two cam locks in the bottom and a small one in the shelf.",
      fix: [camL(SB_Y0, true, "BT", 1), fx("cam", [pt(-T / 2 - 34, SB_YS + T, 20)], [0, -1, 0], { on: "LS", name: "Cam lock (small)", len: 11, dia: 12 })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the long dowels into the divider",
      detail: "Two in its right face, at the shelf holes.",
      fix: [fx("dowel", [-100, 120].map((z) => pt(T / 2, ys, z)), [-1, 0, 0], { on: "DV", len: 40, dia: 8 })],
      tools: ["hammer"],
    },
    {
      title: "Tap two dowels into the right shelf",
      detail: "In the end that meets the right side.",
      fix: [fx("dowel", [-100, 120].map((z) => pt(xi, ys, z)), [-1, 0, 0], { on: "RS", len: 30, dia: 8 })],
      wait: ["RS"],
      tools: ["hammer"],
    },
    {
      title: "Push the right shelf onto the divider",
      detail: "Tracks underneath at the front, onto the long dowels and the cam bolt.",
      add: ["RS", "T10", "T11"],
    },
    {
      title: "Put on the right side",
      detail: "Together: tilt it onto the shelf's dowels, then lower it onto the bottom.",
      add: ["SR"],
      from: { SR: [300, 320, 0] },
      people: 2,
    },
    {
      title: "Lock the right side and the shelf",
      detail: "Two cam locks in the bottom and two small ones in the shelf.",
      fix: [camL(SB_Y0, true, "BT", 2), fx("cam", [pt(xi - 34, SB_YS + T, 20), pt(T / 2 + 34, SB_YS + T, 20)], [0, -1, 0], { on: "RS", name: "Cam lock (small)", len: 11, dia: 12 })],
      tools: ["screwdriver"],
    },
    {
      title: "Slide the back halves down the grooves",
      detail: "One each side of the divider, smooth side out, all the way down to the bottom.",
      add: ["B0", "B1"],
      from: { B0: [0, 820, 0], B1: [0, 820, 0] },
    },
    {
      title: "Screw a guide onto the top of each door",
      detail: "Two screws each, at the top edge, near the end that will stay out of sight.",
      fix: [
        fx("clip", [pt(-xi + 240, guideY, SB.D / 2 - 28)], [0, -1, 0], { name: "Door guide", len: 24, dia: 14, on: "DB" }),
        fx("clip", [pt(xi - 240, guideY, SB.D / 2 - 10)], [0, -1, 0], { name: "Door guide", len: 24, dia: 14, on: "DF" }),
        fx("screw", [-26, 26].map((d) => pt(-xi + 240 + d, guideY, SB.D / 2 - 28)), [0, -1, 0], { len: 12, dia: 4, on: "DB" }),
        fx("screw", [-26, 26].map((d) => pt(xi - 240 + d, guideY, SB.D / 2 - 10)), [0, -1, 0], { len: 12, dia: 4, on: "DF" }),
      ],
      wait: ["DB", "DF"],
      tools: ["screwdriver"],
    },
    {
      title: "Put the doors into the tracks",
      detail: "Guide up into the track under the shelf, then down into the bottom track: the left door at the back, the right door at the front.",
      add: ["DB", "DF"],
      from: { DB: [0, 0, 300], DF: [0, 0, 300] },
    },
    {
      title: "Tap the dowels into the top",
      detail: "Two over each side and two over the divider, on the underside.",
      fix: topDowels,
      wait: ["TP"],
      tools: ["hammer"],
    },
    { title: "Lower the top on", detail: "Onto the dowels and cam bolts of both sides and the divider.", add: ["TP"], people: 2 },
    { title: "Lock the top", detail: "Six cam locks, two over each upright.", fix: ux.map((_, i) => camL(yt, false, "TP", i)), tools: ["screwdriver"] },
    {
      title: "Lay it on its front and knock in the glides",
      detail: "On a rug. One glide under each corner of the bottom.",
      fix: [fx("glide", S.flatMap((sx) => [-160, 160].map((z) => pt(sx * (xo - 20), 0, z))), [0, 1, 0], { name: "Nail-on glide", len: 6, dia: 16 })],
      pose: "-z",
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Press the cable ring into the back",
      detail: "Into the round hole in the right back half.",
      fix: [fx("cap", [pt(xo - 180, 640, SB_ZB - 2)], [0, 0, 1], { name: "Cable grommet", len: 6, dia: 40 })],
      pose: "-z",
    },
    {
      title: "Fix the back halves with the connectors",
      detail: "Twelve along the sides, the divider, the top and the bottom: push each sleeve in, then its pin.",
      fix: [
        fx("clip", [...[-xo, 0, xo].flatMap((x) => [200, 560].map((y) => pt(x, y, SB_ZB - 2))), ...S.flatMap((sx) => [yb - 8, yt + 8].map((y) => pt(sx * 240, y, SB_ZB - 2))), pt(-240, 480, SB_ZB - 2), pt(240, 480, SB_ZB - 2)], [0, 0, 1], { name: "Back connector sleeve", len: 12, dia: 10 }),
        fx("clip", [...[-xo, 0, xo].flatMap((x) => [200, 560].map((y) => pt(x, y, SB_ZB - 3))), ...S.flatMap((sx) => [yb - 8, yt + 8].map((y) => pt(sx * 240, y, SB_ZB - 3))), pt(-240, 480, SB_ZB - 3), pt(240, 480, SB_ZB - 3)], [0, 0, 1], { name: "Back connector pin", len: 14, dia: 8 }),
      ],
      pose: "-z",
    },
    {
      title: "Stand it up and clip in the wall fittings",
      detail: "One inside each side, just under the shelves at the back.",
      fix: S.map((sx) => fx("bracket", [pt(sx * xi, SB_YS - 40, SB_ZB + 24)], [-sx, 0, 0], { name: "Wall fitting", len: 30, dia: 30, on: sx < 0 ? "SL" : "SR" })),
      pose: "+y",
      people: 2,
    },
    {
      title: "Screw a knob onto each wall fitting",
      detail: "Turn it on by hand. It sets the gap to the wall.",
      fix: [fx("knob", S.map((sx) => pt(sx * (xi - 20), SB_YS - 40, SB_ZB + 24)), [0, 0, 1], { name: "Adjuster knob", len: 20, dia: 26 })],
    },
    {
      title: "Push it to the wall and set the knobs",
      detail: "Turn the knobs until the sideboard stands straight and its back is clear of the skirting.",
      check: "square",
      tools: ["level"],
    },
    {
      title: "Fix it to the wall",
      detail: "Mark through the fittings, drill, then screw in through each fitting with a washer. Wall plugs and screws aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", S.map((sx) => pt(sx * (xi - 20), SB_YS - 40, -D / 2 - 30)), [0, 0, -1]),
        fx("washer", S.map((sx) => pt(sx * (xi - 20), SB_YS - 40, SB_ZB + 10)), [0, 0, -1], { included: true }),
        fx("screw", S.map((sx) => pt(sx * (xi - 20), SB_YS - 40, SB_ZB + 12)), [0, 0, -1], { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Press on the cover caps",
      detail: "One over each wall fitting.",
      fix: [fx("cap", S.map((sx) => pt(sx * (xi - 20), SB_YS - 40, SB_ZB + 30)), [0, 0, -1], { name: "Cover cap", len: 4, dia: 30 })],
    },
    {
      title: "Push in the shelf pins on the right",
      detail: "Slide the right door across. Four pins, at the same height in the side and the divider.",
      fix: [fx("pin", [-110, 80].map((z) => pt(xi, 250 - T / 2 - 4, z)), [1, 0, 0]), fx("pin", [-110, 80].map((z) => pt(T / 2, 250 - T / 2 - 4, z)), [-1, 0, 0])],
    },
    { title: "Lay the right shelf on the pins", detail: "Tilt it in behind the door and let it down.", add: ["L1"] },
    {
      title: "Push in the shelf pins on the left",
      detail: "Slide the doors the other way. Four more pins.",
      fix: [fx("pin", [-110, 80].map((z) => pt(-xi, 250 - T / 2 - 4, z)), [-1, 0, 0]), fx("pin", [-110, 80].map((z) => pt(-T / 2, 250 - T / 2 - 4, z)), [1, 0, 0])],
    },
    { title: "Lay the left shelf on the pins", detail: "The same on the left.", add: ["L0"] },
  ];
  return { parts, steps };
}

const SB_CAM_BOLT: HwDef = { kind: "camScrew", len: 24, dia: 6, name: "Cam bolt (drawer)" };
const SB_CAM: HwDef = { kind: "cam", len: 10, dia: 12, name: "Cam lock (drawer)" };
const SB_CONNECT: HwDef = { kind: "bolt", len: 30, dia: 6, name: "Connecting bolt" };
const SB_RUNNER: HwDef = { kind: "runner", len: 340, dia: 30, name: "Drawer runner" };
const SB_RUNNER_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const SB_PULL: HwDef = { kind: "handle", len: 60, dia: 14, name: "Pull" };
const SB_PULL_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const SB_STOP: HwDef = { kind: "screw", len: 8, dia: 6, name: "Stop screw" };

interface SbDrawer {
  front: string;
  sides: string[];
  back: string;
  bottom: string;
  cx: number;
}

function sideboard(b: PlanBuilder, s: ProductSpec) {
  buildCustom(b, { ...s, custom: sideboardRecipe() });
  const zf = SB.D / 2;
  const fw = SB_CW - 4, fh = 110, ft = 16;
  const fy = SB.H - T - 4 - fh / 2;
  const sh = 90, dd = 340, bw = SB_CW - 26;
  const y0 = 672;
  const zFront = zf - ft; // back face of the front
  const zb = zFront - dd;
  const xs = bw / 2 - 6;
  const types = {
    front: b.part("Drawer front", [fw, fh, ft]),
    side: b.part("Drawer side", [12, sh, dd]),
    back: b.part("Drawer back", [bw - 24, sh, 12]),
    bottom: b.part("Drawer bottom", [bw - 16, 4, dd - 10], { material: "fiber" }),
  };
  const ds: SbDrawer[] = S.map((sx) => {
    const cx = sx * (T / 2 + SB_CW / 2);
    return {
      cx,
      front: b.place(types.front, [cx, fy, zf - ft / 2]),
      sides: S.map((g) => b.place(types.side, [cx + g * xs, y0 + sh / 2, zb + dd / 2])),
      back: b.place(types.back, [cx, y0 + sh / 2, zb + 6]),
      bottom: b.place(types.bottom, [cx, y0 + 10, zb + 5 + (dd - 10) / 2]),
    };
  });
  const fits = (d: SbDrawer) => {
    const ys = [y0 + 22, y0 + sh - 22];
    const side = (g: number) => d.sides[g < 0 ? 0 : 1];
    return {
      frontBolts: S.flatMap((g) => ys.map((y): FitOpts => ({ on: d.front, at: [d.cx + g * xs, y, zFront], dir: [0, 0, 1], mate: side(g) }))),
      frontCams: S.flatMap((g) => ys.map((y): FitOpts => ({ on: side(g), at: [d.cx + g * (xs - 6), y, zFront - 30], dir: [g, 0, 0] }))),
      backBolts: S.flatMap((g) => ys.map((y): FitOpts => ({ on: side(g), at: [d.cx + g * (xs + 6), y, zb + 6], dir: [-g, 0, 0] }))),
      backCams: S.flatMap((g) => [zb + 6].map((z): FitOpts => ({ on: d.back, at: [d.cx + g * (xs - 30), y0 + sh, z], dir: [0, -1, 0] }))).flatMap((o) => [o, { ...o, at: [o.at[0] - Math.sign(o.at[0] - d.cx) * 30, o.at[1], o.at[2]] as Vec3 }]),
      runners: S.map((g): FitOpts => ({ on: side(g), at: [d.cx + g * (xs + 6), SB_DRAWER_Y, zb + dd / 2], dir: [-g, 0, 0], hole: false })),
      runnerScrews: S.flatMap((g) => [zb + 60, zFront - 60].map((z): FitOpts => ({ on: side(g), at: [d.cx + g * (xs + 6), SB_DRAWER_Y, z], dir: [-g, 0, 0] }))),
      pull: [{ on: d.front, at: [d.cx, fy + fh / 2, zf - 20], dir: [0, -1, 0], hole: false } as FitOpts],
      pullScrews: [-12, 12].map((dx): FitOpts => ({ on: d.front, at: [d.cx + dx, fy + fh / 2, zf - 20], dir: [0, -1, 0] })),
      stops: S.map((g): FitOpts => ({ on: side(g), at: [d.cx + g * xs, y0 + sh, zb + 30], dir: [0, -1, 0] })),
    };
  };
  const d0 = ds[0];
  const f0 = fits(d0);
  // the drawer is built on the floor beside the sideboard, the right way up
  const rel = (k: string): Vec3 => {
    const p = b.partItem(k).final.pos;
    return [p[0] - d0.cx, p[1] - (fy - fh / 2), p[2]];
  };
  const stage = (k: string, from?: Vec3) => b.stage(k, rel(k), [0, 0, 0], from);
  const sc = { scene: "drawer", repeat: 2 };
  b.step({ title: "Screw the cam bolts into the drawer front", detail: "Lay the front face down. Four cam bolts in its inside face, two at each end.", kind: "cams", tools: ["screwdriver"], warnings: ["floor"], ...sc }, () => {
    stage(d0.front, [0, 120, 0]);
    b.then(0.1);
    b.fits(SB_CAM_BOLT, f0.frontBolts, 0.08);
  });
  b.step({ title: "Push the sides onto the front", detail: "Grooves inside and at the bottom, onto the cam bolts.", kind: "join", ...sc }, () => {
    for (const k of d0.sides) stage(k, [0, 0, -220]);
  });
  b.step({ title: "Lock the sides", detail: "Four cam locks, two in each side, arrow towards the bolt.", kind: "cams", tools: ["screwdriver"], ...sc }, () => b.fits(SB_CAM, f0.frontCams, 0.08));
  b.step({ title: "Slide in the drawer bottom", detail: "Into the grooves in the sides and the front, all the way.", kind: "join", ...sc }, () => stage(d0.bottom, [0, 0, -380]));
  b.step({ title: "Fit the back", detail: "Between the sides at the open end, over the bottom.", kind: "join", ...sc }, () => stage(d0.back, [0, 0, -200]));
  b.step({ title: "Screw the connecting bolts into the back", detail: "Through the sides into the back's ends, two each side.", kind: "bolts", tools: ["screwdriver"], ...sc }, () => b.fits(SB_CONNECT, f0.backBolts, 0.08));
  b.step({ title: "Lock the back", detail: "Four cam locks in the top edge of the back, then turn the drawer the right way up.", kind: "cams", tools: ["screwdriver"], ...sc }, () => b.fits(SB_CAM, f0.backCams, 0.08));
  b.step({ title: "Screw the runners onto the drawer", detail: "One on each side, wheel end at the back. Two screws each.", kind: "runners", tools: ["screwdriver"], ...sc }, () => {
    b.fits(SB_RUNNER, f0.runners, 0.15);
    b.then(0.05);
    b.fits(SB_RUNNER_SCREW, f0.runnerScrews, 0.06);
  });
  b.step({ title: "Screw the pull onto the front", detail: "Over the middle of the top edge, two screws from above.", kind: "screws", tools: ["screwdriver"], ...sc }, () => {
    b.fits(SB_PULL, f0.pull);
    b.then(0.05);
    b.fits(SB_PULL_SCREW, f0.pullScrews, 0.08);
  });
  b.step({ title: "Screw in the stop screws", detail: "One in the top edge of each side, near the back, so the drawer can't be pulled right out.", kind: "screws", tools: ["screwdriver"], ...sc }, () => b.fits(SB_STOP, f0.stops, 0.1));
  b.step({ title: "Push the drawers in", detail: "Line the runners up with the ones in the sideboard and push until they click.", kind: "drawer", warnings: ["tip"] }, () => {
    for (const [i, d] of ds.entries()) {
      b.stagger(0);
      for (const k of [d.front, ...d.sides, d.back, d.bottom]) b.add(k, [0, 0, 480]);
      if (i > 0) {
        const f = fits(d);
        for (const [def, list] of [[SB_CAM_BOLT, f.frontBolts], [SB_CAM, f.frontCams], [SB_CONNECT, f.backBolts], [SB_CAM, f.backCams], [SB_RUNNER, f.runners], [SB_RUNNER_SCREW, f.runnerScrews], [SB_PULL, f.pull], [SB_PULL_SCREW, f.pullScrews], [SB_STOP, f.stops]] as [HwDef, FitOpts[]][])
          for (const x of list) b.preset(def, x);
      }
      b.wait(0.2);
    }
  });
  b.step({ title: "Line up the drawer fronts", detail: "Turn the adjusting screws at the front of the runners until both fronts sit level and even.", kind: "general", tools: ["screwdriver"], check: "square" }, () => {});
}

const family: Family = {
  names: ["SPIKSMED"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (slug === "spiksmed-cabinet-59-5-x-96") return cabinetRecipe();
    if (slug === "spiksmed-media-shelf-117-x-32") return mediaRecipe();
    return null;
  },
  build(b, s) {
    if (s.slug !== "spiksmed-sideboard-97-x-40-x-79-5") return false;
    sideboard(b, s);
    return true;
  },
};
export default family;
