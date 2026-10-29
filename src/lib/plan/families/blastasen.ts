import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BLÄSTÅSEN bedside table, read from its manual. Each side comes as one frame (front leg, back leg and the rail
 * between them). Both frames lie on a rug: wooden drawer runners are screwed on, cam bolts go in, glides are tapped
 * into the feet and small cam bolts go in the legs for the shelf. The back panel and the front rail stand up on
 * dowels and cam locks, the shelf goes on with its corner cam locks, and the other frame is laid on top and locked.
 * Stood up, the top goes on dowels, cam bolts and cam locks, the drawer stops go in and a strap ties it to the
 * wall. The drawer is built on its front: cam bolts, dowelled sides, cam locks, the bottom and the screwed back.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

function recipe(s: ProductSpec): CustomParams | null {
  if (!/bedside|table/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
  // IKEA's measures: 50 wide, 37 deep, 76 high, 20 free under the shelf; drawer 29 x 27 x 10 inside
  const W = 500, D = 370, H = 760, TT = 18;
  const L = 38, LX = 211, LZ = 146; // legs
  const top0 = H - TT, rail0 = top0 - 140; // the rails under the top
  const xi = LX - L / 2; // inner face of the legs
  const parts: CustomPart[] = [];
  const side = (id: string, sx: number): CustomPart => {
    const cy = top0 / 2;
    const leg = (z: number): PartPiece[] => [
      { shape: "box", size: [L, top0 - 420, L], pos: [0, (top0 + 420) / 2 - cy, z] },
      { shape: "cyl", size: [L - 6, 420, L - 6], pos: [0, 210 - cy, z] },
    ];
    return {
      id,
      name: "Side frame",
      size: [L, top0, 2 * LZ + L],
      pos: [sx * LX, cy, 0],
      pieces: [...leg(-LZ), ...leg(LZ), { shape: "box", size: [20, top0 - rail0, 2 * (LZ - L / 2)], pos: [sx * -4, (top0 + rail0) / 2 - cy, 0] }],
      material: "wood",
    };
  };
  parts.push(side("FL", -1), side("FR", 1));
  const runY = rail0 + 14, rx = LX - 20; // the runners sit against the inside of the side rails
  parts.push({ id: "RL", name: "Drawer runner", size: [20, 22, 2 * LZ - 40], pos: [-rx + 4, runY, 0], material: "wood" });
  parts.push({ id: "RR", name: "Drawer runner", size: [20, 22, 2 * LZ - 40], pos: [rx - 4, runY, 0], material: "wood" });
  parts.push({ id: "BK", name: "Back panel", size: [2 * xi, top0 - rail0, 18], pos: [0, (top0 + rail0) / 2, -LZ - 5], material: "wood" });
  parts.push({ id: "FRL", name: "Front rail", size: [2 * xi, 28, 20], pos: [0, rail0 + 14, LZ + 5], material: "wood" });
  const sh0 = 200;
  parts.push({ id: "SH", name: "Shelf", size: [2 * xi, 18, 2 * LZ + L - 20], pos: [0, sh0 + 9, 0], material: "wood" });
  parts.push({ id: "TOP", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" });

  // the drawer: built on its front, sides on dowels, a hardboard bottom and the back screwed in
  const dx = 159, dy0 = rail0 + 32, dy1 = top0 - 6, dz0 = -LZ + 22, dz1 = LZ + 4;
  parts.push({ id: "DF", name: "Drawer front", size: [2 * xi - 6, dy1 - dy0, 18], pos: [0, (dy0 + dy1) / 2, dz1 + 9], material: "wood" });
  parts.push({ id: "DL", name: "Drawer side", size: [14, dy1 - dy0 - 8, dz1 - dz0], pos: [-dx + 7, (dy0 + dy1) / 2 - 4, (dz0 + dz1) / 2], material: "wood" });
  parts.push({ id: "DR", name: "Drawer side", size: [14, dy1 - dy0 - 8, dz1 - dz0], pos: [dx - 7, (dy0 + dy1) / 2 - 4, (dz0 + dz1) / 2], material: "wood" });
  parts.push({ id: "DB", name: "Drawer bottom", size: [2 * dx - 28, 3, dz1 - dz0 - 14], pos: [0, dy0 + 8, (dz0 + dz1) / 2 + 7], material: "fiber" });
  parts.push({ id: "DK", name: "Drawer back", size: [2 * dx - 28, dy1 - dy0 - 24, 14], pos: [0, (dy0 + dy1) / 2 + 4, dz0 + 7], material: "wood" });

  const CAMB = { len: 34, dia: 6 }, CAM = { dia: 15 };
  const sid = (sx: number) => (sx < 0 ? "FL" : "FR");
  const legs: Vec3[] = [-1, 1].flatMap((sx) => [-LZ, LZ].map((z) => [sx * LX, 0, z] as Vec3));
  const backY = [rail0 + 40, top0 - 40];
  const lockSide = (sx: number, n: "back" | "front"): Vec3[] => (n === "back" ? backY.map((y) => [sx * (xi - 30), y, -LZ - 5] as Vec3) : [[sx * (xi - 30), rail0 + 28, LZ + 5]]);
  const steps: CustomStep[] = [
    {
      title: "Screw the drawer runners onto both side frames",
      detail: "Lay both frames on a rug, rails inside up. Three short screws in each runner.",
      add: ["FL", "RL", "FR", "RR"],
      fix: [-1, 1].map((sx) => at("screw", [-90, 0, 90].map((z) => [sx * (rx - 4), runY, z] as Vec3), [sx, 0, 0], sx < 0 ? "RL" : "RR", sid(sx), { len: 15, dia: 4 })),
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw in the cam bolts",
      detail: "Three in each frame, by hand: two for the back panel and one for the front rail.",
      fix: [-1, 1].map((sx) => at("camScrew", [...backY.map((y) => [sx * xi, y, -LZ - 5] as Vec3), [sx * xi, rail0 + 14, LZ + 5]], [-sx, 0, 0], sid(sx), undefined, CAMB)),
      tools: ["screwdriver"],
    },
    { title: "Tap a glide into each foot", detail: "Gently with a hammer, until it sits flat.", fix: [at("glide", legs, [0, 1, 0], undefined, undefined, { len: 6, dia: 25 })], tools: ["hammer"] },
    {
      title: "Screw the small cam bolts into the legs",
      detail: "One in each leg, low down on the inside, for the shelf. The neck stays out.",
      fix: [at("camScrew", legs.map((p) => [p[0], sh0 + 9, p[2] - Math.sign(p[2]) * (L / 2)] as Vec3), [0, 0, -1], undefined, "SH", { len: 12, dia: 6 })],
      tools: ["screwdriver"],
    },
    { title: "Tap dowels into the back panel", detail: "One in each end.", fix: [...[-1, 1].map((sx) => at("dowel", [[sx * xi, (top0 + rail0) / 2, -LZ - 5]], [-sx, 0, 0], "BK"))], wait: ["BK"], tools: ["hammer"] },
    { title: "Stand the back panel on the lower frame", detail: "Onto its dowel and cam bolts.", add: ["BK"] },
    { title: "Lock it with two cam locks", detail: "Arrow towards the bolt, then turn clockwise.", fix: [at("cam", lockSide(-1, "back"), [0, 0, -1], "BK", undefined, CAM)], tools: ["screwdriver"] },
    { title: "Tap dowels into the front rail", detail: "One in each end.", fix: [...[-1, 1].map((sx) => at("dowel", [[sx * xi, rail0 + 14, LZ + 5]], [-sx, 0, 0], "FRL"))], wait: ["FRL"], tools: ["hammer"] },
    { title: "Stand the front rail on the frame", detail: "The flat side faces the front.", add: ["FRL"] },
    { title: "Lock it with a cam lock", fix: [at("cam", lockSide(-1, "front"), [0, -1, 0], "FRL", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Press cam locks into the shelf and push it onto the leg bolts",
      detail: "One big cam lock in each corner, from below. Then slide the shelf onto the two bolts of the lower frame.",
      add: ["SH"],
      fix: [at("cam", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (xi - 20), sh0, sz * (LZ - 20)] as Vec3)), [0, 1, 0], "SH", undefined, { dia: 20 })],
    },
    { title: "Turn the shelf's two cam locks on this side", detail: "Clockwise until they pull the shelf tight to the legs.", tools: ["screwdriver"] },
    { title: "Lower the other side frame on top", detail: "Its cam bolts and the shelf's bolts go into their holes. Turn the shelf's other two cam locks.", tools: ["screwdriver"] },
    { title: "Lock the frame with three cam locks", detail: "Two in the back panel and one in the front rail.", fix: [at("cam", [...lockSide(1, "back"), ...lockSide(1, "front")], [0, 0, -1], undefined, undefined, CAM)], tools: ["screwdriver"] },
    { title: "Stand it up and tap dowels into the frames", detail: "One into the top of each side rail.", fix: [-1, 1].map((sx) => at("dowel", [[sx * (LX - 4), top0, 0]], [0, -1, 0], sid(sx), "TOP")), tools: ["hammer"], pose: "+y" },
    {
      title: "Screw four cam bolts under the top",
      detail: "Lay the top upside down on the rug and screw them in by hand.",
      fix: [at("camScrew", [-1, 1].flatMap((sx) => [-90, 90].map((z) => [sx * (LX - 4), top0, z] as Vec3)), [0, 1, 0], "TOP", undefined, CAMB)],
      wait: ["TOP"],
      tools: ["screwdriver"],
    },
    { title: "Lower the top onto the frame", detail: "The rounded edge goes to the front.", add: ["TOP"] },
    { title: "Lock the top with four cam locks", detail: "They go in the inside of the side rails.", fix: [at("cam", [-1, 1].flatMap((sx) => [-90, 90].map((z) => [sx * (xi - 4), top0 - 20, z] as Vec3)), [0, -1, 0], undefined, undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Press the drawer stops into the runners",
      detail: "One near the back of each runner.",
      fix: [at("clip", [-1, 1].map((sx) => [sx * (rx - 4), runY + 11, -LZ + 50] as Vec3), [0, -1, 0], undefined, undefined, { name: "Drawer stop", len: 14, dia: 8 })],
    },
    {
      title: "Screw the wall strap to the back panel",
      detail: "Mark where it meets the wall, about 4 cm below the top. The strap and its screw come in the box.",
      fix: [{ kind: "strap", count: 1, at: [[0, top0 - 40, -LZ - 14]], dir: [0, 0, 1], on: "BK" }, at("screw", [[0, top0 - 40, -LZ - 14]], [0, 0, 1], "BK", undefined, { len: 20, dia: 4, included: true })],
      tools: ["screwdriver", "pencil"],
    },
    {
      title: "Fix the strap to the wall",
      detail: "Drill, plug and screw it to the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 1, at: [[0, top0 - 10, -D / 2 - 40]], dir: [0, 0, -1] },
        { kind: "screw", count: 1, len: 50, dia: 5, at: [[0, top0 - 10, -D / 2 - 6]], dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Screw two long cam bolts into the drawer front",
      detail: "Lay it face down on the rug.",
      add: ["DF"],
      fix: [at("camScrew", [-1, 1].map((sx) => [sx * (dx - 7), (dy0 + dy1) / 2, dz1] as Vec3), [0, 0, 1], "DF", undefined, { len: 50, dia: 6 })],
      tools: ["screwdriver"],
    },
    { title: "Tap dowels into the drawer sides", detail: "Two in the front end of each.", fix: [-1, 1].map((sx) => at("dowel", [dy0 + 20, dy1 - 30].map((y) => [sx * (dx - 7), y, dz1] as Vec3), [0, 0, -1], sx < 0 ? "DL" : "DR", "DF")), wait: ["DL", "DR"], tools: ["hammer"] },
    { title: "Push the sides onto the drawer front", detail: "Grooves facing in.", add: ["DL", "DR"] },
    { title: "Lock the sides with two cam locks", fix: [at("cam", [-1, 1].map((sx) => [sx * (dx - 7), (dy0 + dy1) / 2, dz1 - 30] as Vec3), [-1, 0, 0], undefined, undefined, CAM)], tools: ["screwdriver"] },
    { title: "Slide in the drawer bottom", detail: "Down the grooves of both sides, into the groove of the front.", add: ["DB"], from: { DB: [0, 0, -300] } },
    {
      title: "Screw on the drawer back",
      detail: "It sits on top of the bottom. Two long screws through each side.",
      add: ["DK"],
      fix: [-1, 1].map((sx) => at("screw", [dy0 + 25, dy1 - 25].map((y) => [sx * dx, y, dz0 + 7] as Vec3), [-sx, 0, 0], sx < 0 ? "DL" : "DR", "DK", { len: 40, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the knob",
      detail: "The screw goes through the front from the inside.",
      fix: [{ kind: "knob", count: 1, at: [[0, (dy0 + dy1) / 2, dz1 + 18]], dir: [0, 0, -1], on: "DF" }, at("screw", [[0, (dy0 + dy1) / 2, dz1 - 5]], [0, 0, 1], "DF", undefined, { len: 30, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw two stop screws into the drawer back",
      detail: "Near the top of each end. They catch on the stops so the drawer can't fall out.",
      fix: [at("screw", [-1, 1].map((sx) => [sx * (dx - 30), dy1 - 12, dz0] as Vec3), [0, 0, 1], "DK", undefined, { len: 12, dia: 6 })],
      tools: ["screwdriver"],
    },
    { title: "Slide the drawer in", detail: "Its grooves run on the wooden runners." },
    { title: "Check the drawer stops", detail: "Pull the drawer out until it stops, then turn the two screws a little if it catches too early.", tools: ["screwdriver"] },
  ];
  return { parts, steps };
}

const family: Family = { names: ["BLÄSTÅSEN", "BLASTASEN"], recipe };
export default family;
