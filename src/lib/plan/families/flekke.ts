import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, ProductSpec, Vec3 } from "../../types";

/*
 * FLEKKE daybed frame with 2 drawers, read from IKEA's manual (three bags: the daybed, the pull-out bed, the drawers).
 * Daybed: the back panel and the two end panels go together on dowels, wrench-driven cam bolts and big cam locks,
 * a metal rail is screwed between the ends at the front on two brackets, and the upper backrest and the tall upper
 * end are lowered on (cam bolts, dowels, cam locks) and joined at the corner with three long screws. It is laid on
 * its back for the slat rail and the two centre supports (each on an L plate), stood up, and twelve slats go in,
 * a pin at the back and a screw at the front of each, then five clips.
 * Pull-out bed: built on the rug, a long panel with its slat rail, two ends, four beams carrying the eight castors,
 * the other long panel, four runners inside, thirteen slats; two people push it under the daybed.
 * Drawers: front, sides, a support rod, the bottom slid in, the back, knock-in bolts, a stop pad, runners and two
 * corner brackets each, then they slide into the pull-out bed.
 * IKEA's sizes: 207 long, 91 deep, 86 high, for two 80 x 200 mattresses; drawers 82 x 70 x 14 inside.
 */

const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: PartMaterial = "board"): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
});
const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const spread = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));

function daybed(s: ProductSpec): CustomParams {
  const mattresses = /mattress/i.test(`${s.variant} ${s.slug ?? ""}`);
  const L = 2070, D = 910, H = 860, T = 18;
  const X = L / 2, Z = D / 2, xi = X - T; // outer and inner faces of the ends
  const EH = 420, SY = 390, ST = 18; // end panels 42 high, slats from 39 cm
  const zb = -Z + T; // inside face of the back panel

  const parts: CustomPart[] = [
    box("B", "Back panel", [-xi, 0, -Z], [xi, EH, zb]),
    box("EL", "End panel", [-X, 0, -Z], [-xi, EH, Z]),
    box("ER", "End panel", [xi, 0, -Z], [X, EH, Z]),
    box("FR", "Front rail", [-xi, SY - 30, Z - 30], [xi, SY, Z], "metal"),
    box("UB", "Backrest", [-X, EH, -Z], [xi, H, zb]),
    {
      // its top slopes down towards the front in three steps
      ...box("UE", "Upper end panel", [xi, EH, -Z], [X, H, Z]),
      pieces: [
        { shape: "box", size: [T, H - EH, 360], pos: [0, 0, -Z + 180] },
        { shape: "box", size: [T, H - EH - 80, 300], pos: [0, -40, -Z + 510] },
        { shape: "box", size: [T, H - EH - 170, D - 660], pos: [0, -85, -Z + 660 + (D - 660) / 2] },
      ],
    },
    box("RB", "Slat rail", [-xi, SY - 30, zb], [xi, SY, zb + 30], "metal"),
    // against the back panel, under the slat rail
    box("C0", "Centre support", [-360, 0, zb], [-320, SY - 30, zb + 40], "wood"),
    box("C1", "Centre support", [320, 0, zb], [360, SY - 30, zb + 40], "wood"),
  ];
  const slatX = spread(-xi + 90, xi - 90, 12);
  slatX.forEach((x, i) => parts.push(box(`S${i}`, "Slat", [x - 35, SY, zb + 10], [x + 35, SY + ST, Z - 10], "wood")));

  // the pull-out bed under it, on castors, its slats below the daybed's
  const PX = X - 50, PY0 = 60, PY1 = 330, PZ0 = -380, PZ1 = Z - 15;
  const px = PX - T;
  parts.push(
    box("PB", "Long panel", [-PX, PY0, PZ0], [PX, PY1, PZ0 + T]),
    box("PRB", "Slat rail", [-px, PY1 - 30, PZ0 + T], [px, PY1, PZ0 + T + 30], "metal"),
    box("PE0", "Pull-out end", [-PX, PY0, PZ0 + T], [-px, PY1, PZ1]),
    box("PE1", "Pull-out end", [px, PY0, PZ0 + T], [PX, PY1, PZ1]),
  );
  const beamX = [-px, -27, 9, px - T];
  beamX.forEach((x, i) => parts.push(box(`PD${i}`, "Castor beam", [x, PY0, PZ0 + T], [x + T, PY1 - 30, PZ1 - T], "board")));
  parts.push(
    box("PF", "Long panel", [-PX, PY1 - 60, PZ1 - T], [PX, PY1, PZ1]),
    box("PRF", "Slat rail", [-px, PY1 - 30, PZ1 - T - 30], [px, PY1, PZ1 - T], "metal"),
  );
  const pSlatX = spread(-px + 60, px - 60, 13);
  pSlatX.forEach((x, i) => parts.push(box(`P${i}`, "Slat", [x - 35, PY1, PZ0 + T + 10], [x + 35, PY1 + 14, PZ1 - T - 10], "wood")));

  // two drawers, one each side of the middle beams
  const bays = [(-px + T - 27) / 2, (27 + px - T) / 2];
  const dw = 450, dy0 = 80, dy1 = 240, dz0 = PZ0 + 50, dz1 = PZ1 - T - 2;
  bays.forEach((cx, i) => {
    parts.push(
      box(`DF${i}`, "Drawer front", [cx - 470, PY0 + 6, PZ1 - T], [cx + 470, PY1 - 66, PZ1]),
      box(`DS${i}a`, "Drawer side", [cx - dw, dy0, dz0], [cx - dw + 16, dy1, dz1]),
      box(`DS${i}b`, "Drawer side", [cx + dw - 16, dy0, dz0], [cx + dw, dy1, dz1]),
      box(`DR${i}`, "Support rod", [cx - 6, dy0, dz0], [cx + 6, dy0 + 6, dz1], "metal"),
      box(`DB${i}`, "Drawer bottom", [cx - dw + 8, dy0 + 6, dz0 + 8], [cx + dw - 8, dy0 + 10, dz1], "fiber"),
      box(`DK${i}`, "Drawer back", [cx - dw + 16, dy0 + 10, dz0], [cx + dw - 16, dy1, dz0 + 16]),
    );
  });
  if (mattresses)
    for (const k of [0, 1]) {
      parts.push({ ...box(`M${k}`, "Mattress", [-1000, SY + ST + k * 120, zb + 5], [1000, SY + ST + (k + 1) * 120, zb + 805], "soft"), extra: true });
    }

  const backFace = (y: number, x: number): Vec3 => [x, y, zb];
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the back panel",
      detail: "Lay the back panel and both end panels on a rug first. Two dowels go into each end of the back panel.",
      add: ["B"],
      fix: [-1, 1].map((g) => fix("dowel", [100, EH - 100].map((y): Vec3 => [g * xi, y, -Z + T / 2]), [g, 0, 0], { on: "B" })),
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Screw the cam bolts into the end panels",
      detail: "Drive them in with the spanner until they stop at the mark, no further.",
      add: ["EL", "ER"],
      fix: [-1, 1].map((g) => fix("camScrew", [100, EH - 100].map((y): Vec3 => [g * xi, y, -Z + 60]), [-g, 0, 0], { len: 48, dia: 8, on: g < 0 ? "EL" : "ER" })),
      tools: ["wrench"],
      from: { EL: [-300, 0, 0], ER: [300, 0, 0] },
    },
    {
      title: "Join the end panels to the back panel",
      detail: "Push the cam locks into the back panel, arrows to the edge, then turn each one until it pulls tight.",
      fix: [fix("cam", [-1, 1].flatMap((g) => [100, EH - 100].map((y): Vec3 => [g * (xi - 30), y, zb])), [0, 0, -1], { name: "Cam lock", len: 16, dia: 25, on: "B" })],
      tools: ["allen"],
    },
    {
      title: "Screw the front rail between the end panels",
      detail: "Screw a bracket onto each end panel first, then lay the rail on the brackets and screw it down.",
      add: ["FR"],
      fix: [
        ...[-1, 1].map((g) => fix("angle", [[g * xi, SY - 40, Z - 20]], [-g, 0, 0], { name: "Rail bracket", len: 40, dia: 30, on: g < 0 ? "EL" : "ER" })),
        // one through each bracket into the end panel, one down through the rail into the bracket
        ...[-1, 1].map((g) => fix("screw", [[g * (xi - 2), SY - 65, Z - 20]], [g, 0, 0], { len: 14, dia: 4, on: g < 0 ? "EL" : "ER" })),
        fix("screw", [-1, 1].map((g): Vec3 => [g * (xi - 20), SY, Z - 15]), [0, -1, 0], { len: 14, dia: 4, on: "FR" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Push in the cam locks for the upper panels",
      detail: "Two in the top edge of the back panel and two in the right-hand end panel.",
      fix: [
        fix("cam", [-500, 500].map((x) => backFace(EH - 30, x)), [0, 0, -1], { name: "Cam lock", len: 16, dia: 25, on: "B" }),
        fix("cam", [-Z + 160, Z - 160].map((z): Vec3 => [xi, EH - 30, z]), [1, 0, 0], { name: "Cam lock", len: 16, dia: 25, on: "ER" }),
      ],
    },
    {
      title: "Lower the backrest onto the back panel",
      detail: "Drive two cam bolts into its bottom edge with the spanner and tap in three dowels, then lower it on.",
      add: ["UB"],
      fix: [
        fix("camScrew", [-500, 500].map((x): Vec3 => [x, EH, -Z + T / 2]), [0, -1, 0], { len: 48, dia: 8, on: "UB" }),
        fix("dowel", [-800, 0, 800].map((x): Vec3 => [x, EH, -Z + T / 2]), [0, -1, 0], { on: "UB" }),
      ],
      tools: ["wrench", "hammer"],
      from: { UB: [0, 300, 0] },
    },
    {
      title: "Lower the upper end panel on",
      detail: "Two cam bolts and three dowels in its bottom edge the same way, then lower it onto the right-hand end.",
      add: ["UE"],
      fix: [
        fix("camScrew", [-Z + 160, Z - 160].map((z): Vec3 => [X - T / 2, EH, z]), [0, -1, 0], { len: 48, dia: 8, on: "UE" }),
        fix("dowel", [-Z + 60, 0, Z - 60].map((z): Vec3 => [X - T / 2, EH, z]), [0, -1, 0], { on: "UE" }),
      ],
      tools: ["wrench", "hammer"],
      from: { UE: [0, 300, 0] },
    },
    {
      title: "Turn the four cam locks",
      detail: "Clockwise until each one pulls its panel down tight.",
      kind: "cams",
      tools: ["allen"],
    },
    {
      title: "Screw the backrest to the upper end panel",
      detail: "Three long screws through the end panel into the end of the backrest.",
      fix: [fix("screw", [EH + 80, (EH + H) / 2, H - 80].map((y): Vec3 => [X, y, -Z + T / 2]), [-1, 0, 0], { len: 70, dia: 6, on: "UE", mate: "UB" })],
      tools: ["allen"],
    },
    { title: "Lay it on its back", detail: "Two people, onto a rug, so the backrest lies flat.", pose: "+z", people: 2, warnings: ["two", "floor"] },
    {
      title: "Screw the slat rail to the back panel",
      detail: "Two screws at the ends and eight along it, through the holes in the rail.",
      add: ["RB"],
      fix: [fix("screw", spread(-xi + 40, xi - 40, 10).map((x): Vec3 => [x, SY - 30, zb + 15]), [0, 1, 0], { len: 14, dia: 4, on: "RB" })],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the two centre supports",
      detail: "Pick the two short slats. Stand each one against the back panel under the slat rail, then screw its L plate to the back panel and to the slat.",
      add: ["C0", "C1"],
      fix: [
        fix("plate", [-340, 340].map((x): Vec3 => [x, 0, zb + 20]), [0, 1, 0], { name: "L plate", len: 3, dia: 60 }),
        fix("screw", [-340, 340].flatMap((x): Vec3[] => [[x - 12, 20, zb + 2], [x + 12, 20, zb + 2]]), [0, 0, -1], { len: 16, dia: 4, on: "B" }),
        ...[-340, 340].map((x, i) => fix("screw", [30, 70].map((y): Vec3 => [x - 22, y, zb + 20]), [1, 0, 0], { len: 14, dia: 4, on: `C${i}` })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Stand it up", detail: "Lift it by the end panels, one person at each end.", pose: "+y", people: 2 },
    {
      title: "Lay in the twelve slats",
      detail: "Twelve of the long slats are for the daybed. Push a pin into one end of each, set it into the back rail, and screw the other end to the front rail.",
      add: slatX.map((_, i) => `S${i}`),
      fix: [
        fix("pin", slatX.map((x): Vec3 => [x, SY, zb + 15]), [0, -1, 0], { name: "Slat pin", len: 10, dia: 8 }),
        fix("screw", slatX.map((x): Vec3 => [x, SY + ST, Z - 15]), [0, -1, 0], { len: 14, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Hammer in the five clips",
      detail: "Along the top of the front rail. They keep the mattress from sliding off.",
      fix: [fix("clip", spread(-xi + 100, xi - 100, 5).map((x): Vec3 => [x, SY, Z - 15]), [0, -1, 0], { name: "Clip", len: 14, dia: 20 })],
      tools: ["hammer"],
      warnings: ["hand"],
    },
    // the pull-out bed
    {
      title: "Screw a slat rail onto a long panel",
      detail: "This is the pull-out bed, built on the rug lying on its back. Ten screws through the rail.",
      add: ["PB", "PRB"],
      fix: [fix("screw", spread(-px + 40, px - 40, 10).map((x): Vec3 => [x, PY1 - 15, PZ0 + T]), [0, 0, -1], { len: 14, dia: 4, on: "PRB" })],
      tools: ["screwdriver"],
      from: { PB: [0, 0, -300], PRB: [0, 300, 0] },
    },
    {
      title: "Fit the two pull-out ends",
      detail: "Cam bolts into the long panel and the ends, dowels in, then stand the ends on and turn the four cam locks.",
      add: ["PE0", "PE1"],
      fix: [
        fix("camScrew", [-1, 1].flatMap((g) => [PY0 + 50, PY1 - 50].flatMap((y): Vec3[] => [[g * (px + T / 2), y, PZ0 + T], [g * (px + T / 2), y, PZ1 - 40]])), [0, 0, -1], { len: 34, dia: 6 }),
        fix("dowel", [-1, 1].flatMap((g) => [PY0 + 100, (PY0 + PY1) / 2, PY1 - 100, PY1 - 140].map((y): Vec3 => [g * (px + T / 2), y, PZ0 + T])), [0, 0, -1]),
        fix("cam", [-1, 1].flatMap((g) => [PY0 + 50, PY1 - 50].map((y): Vec3 => [g * px, y, PZ0 + 50])), [1, 0, 0], { dia: 15 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the castors onto the four beams",
      detail: "Two castors on each beam, two screws each. Tap four dowels into each beam end, then stand the beams in and turn their cam locks.",
      add: beamX.map((_, i) => `PD${i}`),
      fix: [
        fix("castor", beamX.flatMap((x): Vec3[] => [[x + T / 2, PY0, PZ0 + 100], [x + T / 2, PY0, PZ1 - 100]]), [0, 1, 0], { len: 60, dia: 50 }),
        fix("screw", beamX.flatMap((x): Vec3[] => [[x + T / 2, PY0, PZ0 + 75], [x + T / 2, PY0, PZ0 + 125], [x + T / 2, PY0, PZ1 - 75], [x + T / 2, PY0, PZ1 - 125]]), [0, 1, 0], { len: 16, dia: 4 }),
        fix("dowel", beamX.flatMap((x) => [PY0 + 50, PY0 + 110, PY1 - 110, PY1 - 60].map((y): Vec3 => [x + T / 2, y, PZ0 + T])), [0, 0, -1]),
        fix("cam", beamX.map((x): Vec3 => [x + T / 2, PY1 - 50, PZ0 + 50]), [1, 0, 0], { dia: 15 }),
      ],
      tools: ["screwdriver"],
      // the beams go in along their dowels, from the front
      from: Object.fromEntries(beamX.map((_, i) => [`PD${i}`, [0, 0, 400] as Vec3])),
    },
    {
      title: "Fit the other long panel",
      detail: "Screw its slat rail on, drive in eight cam bolts, lower it onto the beams and ends, then turn the eight cam locks.",
      add: ["PF", "PRF"],
      fix: [
        fix("screw", spread(-px + 40, px - 40, 10).map((x): Vec3 => [x, PY1 - 15, PZ1 - T]), [0, 0, 1], { len: 14, dia: 4, on: "PRF" }),
        fix("camScrew", [...beamX.map((x) => x + T / 2), -px - T / 2, px + T / 2, -px - T / 2, px + T / 2].map((x, i): Vec3 => [x, i < 6 ? PY1 - 30 : PY0 + 50, PZ1 - T]), [0, 0, 1], { len: 34, dia: 6 }),
        fix("cam", [...beamX.map((x) => x + T / 2), -px - T / 2, px + T / 2, -px - T / 2, px + T / 2].map((x, i): Vec3 => [x, i < 6 ? PY1 - 30 : PY0 + 50, PZ1 - 60]), [1, 0, 0], { dia: 15 }),
      ],
      tools: ["screwdriver"],
      from: { PF: [0, 0, 300], PRF: [0, 0, 300] },
    },
    {
      title: "Screw the four runners inside",
      detail: "Stand the pull-out bed on its castors. One runner on each side of both drawer spaces, three screws each.",
      fix: [
        ...beamX.map((x, i) => fix("runner", [[i % 2 ? x : x + T, (dy0 + dy1) / 2, (dz0 + dz1) / 2]], [i % 2 ? 1 : -1, 0, 0], { len: 650, dia: 30, on: `PD${i}` })),
        ...beamX.map((x, i) => fix("screw", [-250, 40, 250].map((dz): Vec3 => [i % 2 ? x - 2 : x + T + 2, (dy0 + dy1) / 2, (dz0 + dz1) / 2 + dz]), [i % 2 ? 1 : -1, 0, 0], { len: 12, dia: 4, on: `PD${i}` })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the beams to the slat rails",
      detail: "Four screws at each long panel, through the rails into the top of the beams.",
      fix: [fix("screw", beamX.flatMap((x): Vec3[] => [[x + T / 2, PY1 - 30, PZ0 + T + 15], [x + T / 2 + 8, PY1 - 30, PZ1 - 39]]), [0, -1, 0], { len: 14, dia: 4 })], // the front ones clear of the cam bolts
      tools: ["screwdriver"],
    },
    {
      title: "Lay in the thirteen slats",
      detail: "Push the pins into the slats first, then set them into the holes in both rails.",
      add: pSlatX.map((_, i) => `P${i}`),
      fix: [fix("pin", [...pSlatX.map((x): Vec3 => [x, PY1, PZ0 + T + 15]), ...pSlatX.slice(0, 5).map((x): Vec3 => [x, PY1, PZ1 - T - 15])], [0, -1, 0], { name: "Slat pin", len: 10, dia: 8 })],
    },
    {
      title: "Push the pull-out bed under the daybed",
      detail: "One person at each end. Hook it onto the daybed's rail and push it in until it stops.",
      people: 2,
      warnings: ["two"],
    },
    // the drawers, both at once
    {
      title: "Start the drawers on their fronts",
      detail: "Lay both fronts face down on the rug. Tap in the dowels and drive in the cam bolts, four of each per front.",
      add: ["DF0", "DF1"],
      fix: [
        fix("dowel", bays.flatMap((cx) => [-1, 1].flatMap((g) => [dy0 + 30, dy1 - 30].map((y): Vec3 => [cx + g * (dw - 8), y + 6, PZ1 - T]))), [0, 0, -1]),
        fix("camScrew", bays.flatMap((cx) => [-1, 1].flatMap((g) => [dy0 + 50, dy1 - 50].map((y): Vec3 => [cx + g * (dw - 8), y, PZ1 - T]))), [0, 0, -1], { len: 34, dia: 6 }),
      ],
      tools: ["screwdriver", "hammer"],
      from: { DF0: [0, 0, 400], DF1: [0, 0, 400] },
      repeat: 2,
    },
    {
      title: "Stand the sides on the fronts",
      detail: "Push the cam locks into the sides and turn them clockwise.",
      add: ["DS0a", "DS0b", "DS1a", "DS1b"],
      fix: [fix("cam", bays.flatMap((cx) => [-1, 1].flatMap((g) => [dy0 + 50, dy1 - 50].map((y): Vec3 => [cx + g * (dw - 16), y, dz1 - 40]))), [1, 0, 0], { dia: 15 })],
      tools: ["screwdriver"],
      from: Object.fromEntries(["DS0a", "DS0b", "DS1a", "DS1b"].map((id) => [id, [0, 0, 400] as Vec3])),
    },
    {
      title: "Slide in the support rods and bottoms",
      detail: "Screw the rod to the middle of each front, then slide the bottom into the grooves over it, smooth side up.",
      add: ["DR0", "DR1", "DB0", "DB1"],
      fix: [fix("screw", bays.map((cx): Vec3 => [cx, dy0 + 3, dz1]), [0, 0, -1], { len: 12, dia: 4 })],
      tools: ["screwdriver"],
      from: { DR0: [0, 0, -500], DR1: [0, 0, -500], DB0: [0, 0, -700], DB1: [0, 0, -700] },
    },
    {
      title: "Fit the drawer backs",
      detail: "Lay each back on, tap in its four knock-in bolts, screw the rod to it and press on the stop pad.",
      add: ["DK0", "DK1"],
      fix: [
        fix("bolt", bays.flatMap((cx) => [-1, 1].flatMap((g) => [dy0 + 40, dy1 - 40].map((y): Vec3 => [cx + g * (dw - 8), y, dz0]))), [0, 0, 1], { name: "Knock-in bolt", len: 34, dia: 8 }),
        fix("screw", bays.map((cx): Vec3 => [cx, dy0, dz0 + 8]), [0, 1, 0], { len: 12, dia: 4 }), // up through the rod into the back
        fix("glide", bays.map((cx): Vec3 => [cx, dy1, dz0 + 8]), [0, -1, 0], { name: "Stop pad", len: 3, dia: 20 }),
      ],
      tools: ["hammer", "screwdriver"],
    },
    {
      title: "Screw the runners onto the drawers",
      detail: "One on each side, three screws each, wheel at the back. Then push in two corner brackets at the front.",
      fix: [
        ...[-1, 1].map((g) => fix("runner", bays.map((cx): Vec3 => [cx + g * dw, (dy0 + dy1) / 2, (dz0 + dz1) / 2]), [g, 0, 0], { len: 650, dia: 30 })),
        ...[-1, 1].map((g) => fix("screw", bays.flatMap((cx) => [-220, 80, 220].map((dz): Vec3 => [cx + g * dw, (dy0 + dy1) / 2, (dz0 + dz1) / 2 + dz])), [-g, 0, 0], { len: 12, dia: 4 })),
        fix("angle", bays.flatMap((cx) => [-1, 1].map((g): Vec3 => [cx + g * (dw - 30), dy0 + 20, dz1 - 20])), [0, -1, 0], { name: "Corner bracket", len: 30, dia: 25 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Slide the drawers in",
      detail: "Set the drawer runners onto the ones in the bed and push until they close.",
      kind: "drawer",
    },
  ];
  if (mattresses) steps.push({ title: "Lay the mattresses on", detail: "Both lie on the daybed; pull the bed out to sleep two side by side.", add: ["M0", "M1"] });
  return { parts, steps };
}

const family: Family = {
  names: ["FLEKKE"],
  recipe(s) {
    if (!/day-?bed/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return daybed(s);
  },
};
export default family;
