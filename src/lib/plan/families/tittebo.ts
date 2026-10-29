import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, ProductSpec, Vec3 } from "../../types";

/**
 * TITTEBO roll-front cabinet, from its manual. It stands on the worktop under the wall cabinets, with no bottom and
 * no back. Lying on one side on a rug, the top panel and the two front rails go onto that side on dowels and cam
 * bolts, the other side goes on, and the four foot bolts screw into the sides' foot blocks. Upside down, the roll
 * front slides into the sides' grooves; stood up, its spring roller is screwed under the top and hooked to it, a stop
 * goes in, and the top cover and plinth clip on. On the worktop the feet are turned out to meet the wall cabinet,
 * then the shelf goes in.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 61 wide, 30 deep; it fills a 70 to 74.3 cm gap between worktop and wall cabinet
  const W = s.size.w * 10 || 610, D = s.size.d * 10 || 300, H = 720;
  const t = 18, sx = W / 2 - t / 2, ix = W / 2 - t, iw = 2 * ix;
  const foot = 20, sideH = H - foot - 30; // the sides stand on their foot bolts; the top cover sits on them
  const sTop = foot + sideH;
  const ty = sTop - t / 2; // the top panel, flush with the sides' top
  const rz = D / 2 - t / 2; // the front rails
  const hy = sTop - 150, by = foot + 50; // header rail under the roller, bottom rail
  const dz = rz - t / 2 - 8; // the roll front runs in grooves just behind the rails
  const parts: CustomPart[] = [
    { id: "SL", name: "Side panel", size: [t, sideH, D], pos: [-sx, foot + sideH / 2, 0], material: "board" },
    { id: "SR", name: "Side panel", size: [t, sideH, D], pos: [sx, foot + sideH / 2, 0], material: "board" },
    { id: "TP", name: "Top panel", size: [iw, t, D], pos: [0, ty, 0], material: "board" },
    { id: "HR", name: "Front rail", size: [iw, 60, t], pos: [0, hy, rz], material: "board" },
    { id: "BR", name: "Front rail", size: [iw, 60, t], pos: [0, by, rz], material: "board" },
    { id: "DR", name: "Roll front", size: [iw - 4, hy - 30 - by, 10], pos: [0, (hy - 30 + by) / 2, dz], material: "board" },
    { id: "RO", name: "Spring roller", size: [iw - 40, 70, 70], pos: [0, ty - t / 2 - 35, -D / 2 + 60], shape: "cyl", material: "metal" },
    { id: "TC", name: "Top cover", size: [W, 30, D], pos: [0, sTop + 15, 0], material: "metal" },
    { id: "PL", name: "Plinth", size: [W, 50, 12], pos: [0, 25, D / 2 + 6], material: "metal" },
    { id: "SH", name: "Shelf", size: [iw - 4, t, D - 60], pos: [0, 360, -20], material: "board" },
  ];
  const side = (g: number) => (g < 0 ? "SL" : "SR");
  // cam bolts in each side: two for the top panel, one for each front rail
  const bolts = (g: number): Vec3[] => [[g * ix, ty, -80], [g * ix, ty, 80], [g * ix, hy, rz], [g * ix, by, rz]];
  const camsTop = (g: number): Vec3[] => [-80, 80].map((z): Vec3 => [g * (ix - 34), ty - t / 2, z]);
  const camsRail = (g: number): Vec3[] => [hy, by].map((y): Vec3 => [g * (ix - 34), y, rz - t / 2]);
  const pins = (y: number): Vec3[] => [-1, 1].flatMap((g) => [-110, 70].map((z): Vec3 => [g * ix, y, z]));
  return {
    parts,
    steps: [
      {
        title: "Screw the cam bolts into the sides",
        detail: "Lay both sides on a rug, inside up. Four cam bolts in each, until they stop.",
        add: ["SL", "SR"],
        fix: [-1, 1].map((g) => fx("camScrew", bolts(g), [g, 0, 0], side(g))),
        tools: ["screwdriver"],
        pose: "+x",
        warnings: ["floor"],
        wait: ["SR"],
      },
      { title: "Peel the film off the top panel", detail: "Both sides, before it goes on." },
      {
        title: "Tap the dowels into the top panel",
        detail: "Two into each end.",
        fix: [-1, 1].map((g) => fx("dowel", [-140, 140].map((z): Vec3 => [g * ix, ty, z]), [-g, 0, 0], "TP", { len: 30, dia: 8, mate: side(g) })),
        tools: ["hammer"],
        wait: ["TP"],
      },
      { title: "Stand the top panel on the side", detail: "Dowels and the bolt heads into their holes.", add: ["TP"] },
      { title: "Lock it with two cams", detail: "The black ones. Turn each one clockwise until it grips.", fix: [fx("cam", camsTop(-1), [0, 1, 0], "TP")], tools: ["screwdriver"] },
      {
        title: "Push the dowels into the front rails",
        detail: "The thin ones, one into each end of both rails.",
        fix: [-1, 1].flatMap((g) => [fx("dowel", [[g * ix, hy + 18, rz]], [-g, 0, 0], "HR", { len: 25, dia: 6, mate: side(g) }), fx("dowel", [[g * ix, by + 18, rz]], [-g, 0, 0], "BR", { len: 25, dia: 6, mate: side(g) })]),
        wait: ["HR", "BR"],
      },
      { title: "Stand the front rails on the side", detail: "One just under the top panel, the other at the foot of the side.", add: ["HR", "BR"] },
      { title: "Lock them with two cams", detail: "The white ones this time.", fix: [fx("cam", camsRail(-1), [0, 0, -1], "HR")], tools: ["screwdriver"] },
      { title: "Lower the other side on", detail: "Line up all the bolts and dowels, then press it down.", add: ["SR"], from: { SR: [400, 0, 0] } },
      {
        title: "Lock that side with four cams",
        detail: "Black in the top panel, white in the rails.",
        fix: [fx("cam", camsTop(1), [0, 1, 0], "TP"), fx("cam", camsRail(1), [0, 0, -1], "HR")],
        tools: ["screwdriver"],
      },
      {
        title: "Screw in the foot bolts",
        detail: "One into each foot block under the sides, by hand. They set the height later.",
        fix: [-1, 1].map((g) => fx("foot", [-1, 1].map((k): Vec3 => [g * sx, foot, k * (D / 2 - 40)]), [0, 1, 0], side(g), { name: "Foot bolt", len: 20, dia: 10 })),
      },
      {
        title: "Slide the roll front into the grooves",
        detail: "Wipe it clean, turn the cabinet upside down and feed the roll front into both grooves from the open end, flat side out.",
        add: ["DR"],
        pose: "-y",
        from: { DR: [0, -600, 0] },
      },
      {
        title: "Screw the spring roller under the top",
        detail: "Stand it up. Four screws through the roller's brackets into the top panel.",
        add: ["RO"],
        fix: [fx("screw", [-1, 1].flatMap((g) => [-20, 20].map((dz): Vec3 => [g * (iw / 2 - 30), ty - t / 2 - 2, -D / 2 + 60 + dz])), [0, 1, 0], "RO", { len: 14, dia: 4, mate: "TP" })],
        tools: ["screwdriver"],
        pose: "+y",
      },
      {
        title: "Hook the roll front to the roller",
        detail: "Roll it up, hook its top edge onto the roller's strap and fix it with one screw.",
        fix: [fx("screw", [[0, hy - 40, dz + 5]], [0, 0, -1], "DR", { len: 10, dia: 4 })],
        tools: ["screwdriver"],
      },
      { title: "Fit the stop", detail: "Click it into the groove so the roll front can't run up too far.", fix: [fx("clip", [[-ix + 6, hy - 20, dz]], [1, 0, 0], "SL", { name: "Stop" })] },
      { title: "Clip the top cover on", detail: "Over the top, front edge first, then press it down at the back.", add: ["TC"], from: { TC: [0, 200, 0] } },
      { title: "Screw the top cover down", detail: "Two screws at the back.", fix: [fx("screw", [-1, 1].map((g): Vec3 => [g * 200, sTop + 30, -D / 2 + 30]), [0, -1, 0], "TC", { len: 14, dia: 4, mate: "TP" })], tools: ["screwdriver"] },
      { title: "Peel the film off the roll front", detail: "Pull it off slowly from one corner." },
      { title: "Clip the plinth on", detail: "Along the foot of the front, hooked over the bottom rail.", add: ["PL"], from: { PL: [0, 0, 200] } },
      {
        title: "Fit it under the wall cabinets",
        detail: "Stand it on the worktop and turn the foot bolts out with the spanner until the top cover presses gently against the wall cabinet.",
        tools: ["wrench"],
        warnings: ["tip"],
      },
      { title: "Push in the shelf pins", detail: "Four, at the height you want, the same on both sides.", fix: [fx("pin", pins(360 - t / 2 - 4), [0, -1, 0], "SH")] },
      { title: "Lay the shelf on", detail: "Push it to the back onto the pins.", add: ["SH"], from: { SH: [0, 0, 300] } },
    ],
  };
}

const family: Family = { names: ["TITTEBO"], recipe };
export default family;
