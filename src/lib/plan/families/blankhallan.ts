import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BLANKHÄLLAN bedside table, read from its manual. The drawer box comes first, on a rug: cam bolts and dowels into
 * the bottom, the back on, runners screwed inside both sides, the sides and then the top on cam bolts and cam locks.
 * The round top is laid upside down and the two steel frames are bolted under it; turned over, the box is screwed
 * onto the frames' rails and the frames take their second bolts. The drawer is built on dowels, plastic dowels and
 * cam locks, gets its runners and slides in, and two stops go in behind it.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

function recipe(s: ProductSpec): CustomParams | null {
  if (!/bedside|table/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
  // IKEA's measures: 45 across, 61 high, 26 free under the box; drawer 21.8 x 23 inside
  const DIA = 450, H = 610, TT = 18, t = 12;
  const X = 146, Z = 140, Y0 = 265, Y1 = 415; // the drawer box's outside
  const xi = X - t, yb = Y0 + t, yt = Y1 - t;
  const parts: CustomPart[] = [];
  parts.push({ id: "BB", name: "Box bottom", size: [2 * xi, t, 2 * Z - t], pos: [0, Y0 + t / 2, t / 2], material: "board" });
  parts.push({ id: "BK", name: "Box back", size: [2 * xi, yt - yb, t], pos: [0, (yb + yt) / 2, -Z + t / 2], material: "board" });
  parts.push({ id: "SL", name: "Box side", size: [t, yt - Y0, 2 * Z], pos: [-X + t / 2, (Y0 + yt) / 2, 0], material: "board" });
  parts.push({ id: "SR", name: "Box side", size: [t, yt - Y0, 2 * Z], pos: [X - t / 2, (Y0 + yt) / 2, 0], material: "board" });
  parts.push({ id: "BT", name: "Box top", size: [2 * X, t, 2 * Z], pos: [0, Y1 - t / 2, 0], material: "board" });

  // two steel frames: two uprights on a floor runner, a rail under the box, a plate at each top
  const FX = X + 8, FZ = 150, tube = 16, topY = H - TT;
  const frame = (id: string, sx: number): CustomPart => {
    const cy = topY / 2;
    const pieces: PartPiece[] = [
      ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [tube, topY - 10, tube], pos: [0, 5, sz * FZ] })),
      { shape: "box", size: [tube, tube, 2 * FZ + 30], pos: [0, 8 - cy, 0] },
      { shape: "box", size: [tube + 6, tube, 2 * FZ], pos: [-sx * 8, Y0 - 8 - cy, 0] },
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [40, 4, 50], pos: [-sx * 10, topY - 2 - cy, sz * (FZ - 12)] })),
    ];
    return { id, name: "Frame", size: [tube + 22, topY, 2 * FZ + 30], pos: [sx * FX - sx * 3, cy, 0], pieces, material: "metal" };
  };
  parts.push(frame("FL", -1), frame("FR", 1));
  parts.push({ id: "TOP", name: "Table top", size: [DIA, TT, DIA], pos: [0, H - TT / 2, 0], shape: "cyl", material: "board" });

  // the drawer: a front as big as the box's face, sides, back and a hardboard bottom
  const dx = 121, dz0 = -112, dz1 = Z, dy0 = Y0 + 14, dy1 = dy0 + 75;
  parts.push({ id: "DF", name: "Drawer front", size: [2 * X, Y1 - Y0, 16], pos: [0, (Y0 + Y1) / 2, Z + 8], material: "board" });
  parts.push({ id: "DL", name: "Drawer side", size: [t, dy1 - dy0, dz1 - dz0], pos: [-dx + t / 2, (dy0 + dy1) / 2, (dz0 + dz1) / 2], material: "board" });
  parts.push({ id: "DR", name: "Drawer side", size: [t, dy1 - dy0, dz1 - dz0], pos: [dx - t / 2, (dy0 + dy1) / 2, (dz0 + dz1) / 2], material: "board" });
  parts.push({ id: "DB", name: "Drawer bottom", size: [2 * (dx - t), 3, dz1 - dz0 - t], pos: [0, dy0 + 8, (dz0 + t + dz1) / 2], material: "fiber" });
  parts.push({ id: "DK", name: "Drawer back", size: [2 * (dx - t), dy1 - dy0 - 12, t], pos: [0, (dy0 + 12 + dy1) / 2, dz0 + t / 2], material: "board" });

  const CAMB = { len: 34, dia: 6 }, CAM = { dia: 15 };
  const runY = (dy0 + dy1) / 2;
  const steps: CustomStep[] = [
    {
      title: "Fit cam bolts and dowels into the box bottom",
      detail: "Lay it on a rug. Screw the two cam bolts in by hand along the back edge and tap two dowels into each end.",
      add: ["BB"],
      fix: [
        at("camScrew", [-1, 1].map((sx) => [sx * 90, yb, -Z + 18] as Vec3), [0, -1, 0], "BB", "BK", CAMB),
        at("dowel", [-1, 1].flatMap((sx) => [-100, 100].map((z) => [sx * xi, Y0 + t / 2, z] as Vec3)), [1, 0, 0], "BB"),
      ],
      tools: ["screwdriver", "hammer"],
      warnings: ["floor"],
    },
    { title: "Push the back onto the bottom", detail: "Its holes go over the two cam bolts.", add: ["BK"] },
    { title: "Lock the back with two cam locks", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", fix: [at("cam", [-1, 1].map((sx) => [sx * 90, yb + 20, -Z + t] as Vec3), [0, 0, -1], "BK", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Screw a runner inside each side panel",
      detail: "The marked runners go left and right. Two screws each, pressing the runner flat against the panel.",
      add: ["SL", "SR"],
      fix: [-1, 1].flatMap((sx) => [
        at("runner", [[sx * xi, runY, 10]], [sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, { len: 240, dia: 20 }),
        at("screw", [-80, 100].map((z) => [sx * (xi - 2), runY, z] as Vec3), [sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, { len: 12, dia: 4 }),
      ]),
      from: { SL: [-400, 0, 0], SR: [400, 0, 0] },
      tools: ["screwdriver"],
    },
    {
      title: "Screw cam bolts into both sides",
      detail: "Two in each, by hand, near the bottom edge.",
      fix: [-1, 1].map((sx) => at("camScrew", [-40, 40].map((z) => [sx * xi, Y0 + t / 2, z] as Vec3), [-sx, 0, 0], sx < 0 ? "SL" : "SR", "BB", CAMB)),
      tools: ["screwdriver"],
    },
    { title: "Press the sides onto the bottom and back", detail: "Dowels and cam bolts into their holes, the runners on the inside." },
    { title: "Lock the sides with four cam locks", detail: "They go into the bottom, next to each side.", fix: [at("cam", [-1, 1].flatMap((sx) => [-40, 40].map((z) => [sx * (xi - 22), yb, z] as Vec3)), [0, -1, 0], "BB", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Screw six cam bolts into the box top",
      detail: "Two along each side edge and two along the back edge, by hand.",
      fix: [at("camScrew", [...[-1, 1].flatMap((sx) => [-80, 80].map((z) => [sx * (X - t / 2), Y1 - t, z] as Vec3)), ...[-1, 1].map((sx) => [sx * 60, Y1 - t, -Z + t / 2] as Vec3)], [0, 1, 0], "BT", undefined, CAMB)],
      tools: ["screwdriver"],
    },
    { title: "Lower the top onto the box", detail: "Every bolt into its hole.", add: ["BT"] },
    {
      title: "Lock the top with six cam locks",
      detail: "Four in the sides and two in the back.",
      fix: [
        at("cam", [-1, 1].flatMap((sx) => [-80, 80].map((z) => [sx * (X - t / 2), yt - 18, z] as Vec3)), [0, -1, 0], undefined, undefined, CAM),
        at("cam", [-1, 1].map((sx) => [sx * 60, yt - 18, -Z + t / 2] as Vec3), [0, 0, 1], "BK", undefined, CAM),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the two frames under the table top",
      detail: "Lay the top upside down on the rug and stand the frames in it. One bolt through each top plate for now.",
      add: ["TOP", "FL", "FR"],
      fix: [at("bolt", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (FX - 10), topY, sz * (FZ - 4)] as Vec3)), [0, 1, 0], undefined, "TOP", { len: 12, dia: 6 })],
      tools: ["allen"],
      pose: "-y",
    },
    {
      title: "Turn it over and screw the box onto the frames",
      detail: "The box rests on the rails under it. Four countersunk bolts up through the rails into the sides.",
      fix: [-1, 1].map((sx) => at("bolt", [-100, 100].map((z) => [sx * (X - 6), Y0 - 12, z] as Vec3), [0, 1, 0], sx < 0 ? "FL" : "FR", sx < 0 ? "SL" : "SR", { len: 20, dia: 6 })),
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Put in the last four bolts at the top",
      detail: "One more through each top plate, then tighten all of them. The caps go flat, not tilted.",
      fix: [at("bolt", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (FX - 10), topY, sz * (FZ - 26)] as Vec3)), [0, 1, 0], undefined, "TOP", { len: 12, dia: 6 })],
      tools: ["allen"],
    },
    {
      title: "Tap dowels into the drawer sides",
      detail: "One into the front end of each, grooves facing in.",
      add: ["DL", "DR"],
      fix: [-1, 1].map((sx) => at("dowel", [[sx * (dx - t / 2), runY, dz1]], [0, 0, -1], sx < 0 ? "DL" : "DR", "DF")),
      from: { DL: [0, 0, 420], DR: [0, 0, 420] },
      tools: ["hammer"],
    },
    {
      title: "Join the sides to the drawer front",
      detail: "Press the front onto the dowels, then push a plastic dowel through each side into the front.",
      add: ["DF"],
      fix: [at("dowel", [-1, 1].map((sx) => [sx * dx, runY + 20, dz1 - 6] as Vec3), [0, 0, 1], undefined, "DF", { name: "Plastic dowel", len: 40, dia: 8 })],
    },
    { title: "Lock the front with two cam locks", detail: "One in each side, turned clockwise.", fix: [at("cam", [-1, 1].map((sx) => [sx * (dx - t / 2), runY - 20, dz1 - 30] as Vec3), [0, -1, 0], undefined, undefined, CAM)], tools: ["screwdriver"] },
    { title: "Slide in the drawer bottom", detail: "Painted side up, along the grooves of both sides.", add: ["DB"], from: { DB: [0, 0, -300] } },
    {
      title: "Screw cam bolts and two small screws into the drawer back",
      detail: "The cam bolts go in the ends, the small screws along the bottom edge.",
      fix: [
        at("camScrew", [-1, 1].map((sx) => [sx * (dx - t), runY, dz0 + t / 2] as Vec3), [-1, 0, 0], "DK", undefined, CAMB),
        at("screw", [-1, 1].map((sx) => [sx * 50, dy0 + 12, dz0 + t / 2] as Vec3), [0, 1, 0], "DK", undefined, { len: 10, dia: 6 }),
      ],
      wait: ["DK"],
      tools: ["screwdriver"],
    },
    { title: "Push the back down between the sides", detail: "Stand the drawer on its front. The bottom goes into the back's groove.", add: ["DK"] },
    { title: "Lock the back with two cam locks", detail: "One in each side.", fix: [at("cam", [-1, 1].map((sx) => [sx * (dx - t / 2), runY - 20, dz0 + 30] as Vec3), [0, -1, 0], undefined, undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Screw the drawer runners onto the drawer",
      detail: "Two screws in each, by hand with the screwdriver, not a drill.",
      fix: [-1, 1].flatMap((sx) => [
        at("runner", [[sx * dx, runY, 10]], [-sx, 0, 0], sx < 0 ? "DL" : "DR", undefined, { len: 240, dia: 14 }),
        at("screw", [-80, 100].map((z) => [sx * (dx + 2), runY, z] as Vec3), [-sx, 0, 0], sx < 0 ? "DL" : "DR", undefined, { len: 14, dia: 4 }),
      ]),
      tools: ["screwdriver"],
    },
    { title: "Slide the drawer in", detail: "Lift it onto the runners at an angle, then push it level until it closes." },
    {
      title: "Push in the two drawer stops",
      detail: "Pull the drawer out, press each stop into its hole at the back of a runner and push its pin in to lock it.",
      fix: [
        at("clip", [-1, 1].map((sx) => [sx * xi, runY, dz0 + 20] as Vec3), [-1, 0, 0], undefined, undefined, { name: "Drawer stop", len: 14, dia: 12 }),
        at("pin", [-1, 1].map((sx) => [sx * xi, runY, dz0 + 20] as Vec3), [-1, 0, 0], undefined, undefined, { name: "Stop pin", len: 10, dia: 6 }),
      ],
    },
  ];
  return { parts, steps };
}

const family: Family = { names: ["BLANKHÄLLAN", "BLANKHALLAN"], recipe };
export default family;
