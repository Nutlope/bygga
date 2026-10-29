import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";
import type { HwDef, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";
import { rotate } from "../math";

/**
 * VILHATTEN, read from the manual for the wardrobe with 2 doors and 2 drawers. The carcass is built lying on its
 * front: drawer runners go on the right side and the low divider first, the divider is joined to the fixed shelf on
 * twin-thread connectors and cam locks and to the bottom with Allen screws, then the left side, the front plinth and
 * back rail on dowels, the right side and the top, all with long Allen screws. The fold-out back slides into grooves
 * and takes rivets and clips, glides go under it, and it's stood up, fixed to the wall with the kit in the box, and
 * gets its clothes rail and bumpers. Seven hinges go on the doors (four on the tall left one), then the two drawers
 * are built face down (sides on connectors and cams, bottom in grooves, back on plastic dowels) and slid in.
 */

const W = 980, H = 1900, T = 16;
const DEP = 550, Z0 = -284, Z1 = Z0 + DEP; // carcass back and front edges; the doors add 16 at the front
const ZI = Z0 + 14; // inner panels stop short of the back, which runs in grooves
const ZM = (ZI + Z1) / 2;
const xs = W / 2 - T / 2, inner = W / 2 - T;
const PL = 70, yBot = PL + T, ySh = 560; // plinth height, top of the bottom, underside of the fixed shelf
const DOOR_T = 16, DOOR_Z = Z1 + 1 + DOOR_T / 2;
const yRail = H - T - 70;

const ALLEN = { len: 50, dia: 7, name: "Allen screw" };
const DOWEL = { len: 30, dia: 8 };
const CONNECTOR = { len: 30, dia: 6, name: "Connector bolt" };
const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, ...o });
const put = (b: PlanBuilder, def: HwDef, pts: Vec3[], dir: Vec3, on?: string, gap = 0.06) => b.fits(def, pts.map((p) => ({ at: p, dir, on, hole: false })), gap);

/* the drawers: fronts in front of the right-hand compartment, boxes on runners between the divider and the right side */
const DRAWERS = [72, 317].map((y0) => {
  const fh = 241, box0 = y0 + 25;
  return { y0, fh, box0, box1: box0 + 150, runnerY: box0 + 20 };
});
const BX0 = T / 2 + 13, BX1 = inner - 13; // the drawer box, inside the runners
const BZ0 = Z1 - 480; // back of the drawer box
const FX0 = 1.5, FX1 = W / 2, FCX = (FX0 + FX1) / 2;

function carcass(): { parts: CustomPart[]; steps: CustomStep[] } {
  const wide = W - 2 * T, deep = Z1 - ZI;
  const parts: CustomPart[] = [
    { id: "RS", name: "Side", size: [T, H, DEP], pos: [xs, H / 2, (Z0 + Z1) / 2] },
    { id: "DV", name: "Divider", size: [T, ySh - yBot, deep], pos: [0, (ySh + yBot) / 2, ZM] },
    { id: "SH", name: "Fixed shelf", size: [wide, T, deep], pos: [0, ySh + T / 2, ZM] },
    { id: "BT", name: "Bottom", size: [wide, T, deep], pos: [0, PL + T / 2, ZM] },
    { id: "LS", name: "Side", size: [T, H, DEP], pos: [-xs, H / 2, (Z0 + Z1) / 2] },
    { id: "PF", name: "Plinth", size: [wide, PL, T], pos: [0, PL / 2, Z1 - 20 - T / 2] },
    { id: "PB", name: "Back rail", size: [wide, PL, T], pos: [0, PL / 2, ZI + T / 2] },
    { id: "TP", name: "Top", size: [wide, T, deep], pos: [0, H - T / 2, ZM] },
    { id: "BK", name: "Back panel", size: [wide + 16, H - 8 - 40, 3], pos: [0, (H - 8 + 40) / 2, Z0 + 10], material: "fiber" },
    { id: "RL", name: "Clothes rail", size: [wide - 6, 25, 25], pos: [0, yRail, ZM - 20], shape: "cyl", material: "metal" },
  ];
  const zs3 = [ZI + 90, ZM, Z1 - 70];
  const zsScrew = [ZI + 40, ZM + 60, Z1 - 30];
  const endDowels = (id: string, y: number, zs: number[]) => [-1, 1].map((sx) => at("dowel", zs.map((z) => [sx * inner, y, z] as Vec3), [sx, 0, 0], { ...DOWEL, on: id }));
  const sideScrews = (sx: number, pts: [number, number][], mate?: string) => at("bolt", pts.map(([y, z]) => [sx * (W / 2), y, z] as Vec3), [-sx, 0, 0], { ...ALLEN, on: sx < 0 ? "LS" : "RS", ...(mate ? { mate } : {}) });
  const runnerPts = (x: number) => DRAWERS.map((d) => [x, d.runnerY, Z1 - 250] as Vec3);
  const runnerScrews = (x: number) => DRAWERS.flatMap((d) => [Z1 - 50, Z1 - 180, Z1 - 320, Z1 - 450].map((z) => [x, d.runnerY, z] as Vec3));
  const brackets: Vec3[] = [-1, 1].map((sx) => [sx * 250, PL - 12, Z1 - 20 - T - 12]);
  const glide = { len: 8, dia: 20, name: "Glide" };
  const fitPts = [-1, 1].map((sx) => [sx * (inner - 25), H - T - 45, Z0 + 30] as Vec3);
  const wallPts = fitPts.map((p) => [p[0], p[1], Z0 - 20] as Vec3);
  const holderPts = [-1, 1].map((sx) => [sx * inner, yRail, ZM - 20] as Vec3);

  const steps: CustomStep[] = [
    {
      title: "Screw the drawer runners onto the right side and the divider",
      detail: "Lay both panels on a rug. The runners marked for the cabinet: two on the side, two on the divider, four screws each.",
      fix: [
        at("runner", runnerPts(inner), [1, 0, 0], { on: "RS", len: 480, dia: 40 }),
        at("runner", runnerPts(T / 2), [-1, 0, 0], { on: "DV", len: 480, dia: 40 }),
        at("screw", runnerScrews(inner - 4), [1, 0, 0], { on: "RS", len: 12, dia: 3.5 }),
        at("screw", runnerScrews(T / 2 + 4), [-1, 0, 0], { on: "DV", len: 12, dia: 3.5 }),
      ],
      wait: ["RS", "DV"],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    {
      title: "Tap five dowels into the divider",
      detail: "Two in its top end and three in its bottom end.",
      fix: [
        at("dowel", [ZM - 150, ZM + 150].map((z) => [0, ySh, z] as Vec3), [0, -1, 0], { ...DOWEL, on: "DV" }),
        at("dowel", [ZM - 180, ZM, ZM + 180].map((z) => [0, yBot, z] as Vec3), [0, 1, 0], { ...DOWEL, on: "DV" }),
      ],
      wait: ["DV"],
      tools: ["hammer"],
    },
    {
      title: "Screw two connector bolts into the fixed shelf",
      detail: "Into the holes in the middle of its underside, by hand or with the screwdriver, until they stop.",
      fix: [at("camScrew", [ZM - 60, ZM + 60].map((z) => [0, ySh, z] as Vec3), [0, 1, 0], { ...CONNECTOR, on: "SH" })],
      from: { SH: [0, 300, 0] },
      tools: ["screwdriver"],
    },
    { title: "Push the divider onto the shelf", detail: "The connector bolts and dowels go into its top end; the runners face right.", add: ["DV"], from: { DV: [0, -300, 0] } },
    {
      title: "Lock the divider with two cam locks",
      detail: "Drop each cam in with its arrow pointing at the bolt, then turn it clockwise until it's tight.",
      fix: [at("cam", [ZM - 60, ZM + 60].map((z) => [T / 2, ySh - 30, z] as Vec3), [-1, 0, 0], { on: "DV" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the bottom onto the divider",
      detail: "Three Allen screws up through the bottom into the divider's end.",
      add: ["BT"],
      fix: [at("bolt", [ZM - 100, ZM + 90, ZM + 220].map((z) => [0, PL, z] as Vec3), [0, 1, 0], { ...ALLEN, on: "BT", mate: "DV" })],
      tools: ["allen"],
    },
    { title: "Tap the dowels into the shelf and the bottom", detail: "Three in each end of both panels, twelve in all.", fix: [...endDowels("SH", ySh + T / 2, zs3), ...endDowels("BT", PL + T / 2, zs3)], tools: ["hammer"] },
    {
      title: "Screw on the left side",
      detail: "Push it onto the dowels, then six Allen screws through it, three into the shelf and three into the bottom.",
      add: ["LS"],
      fix: [sideScrews(-1, zsScrew.flatMap((z) => [[ySh + T / 2, z], [PL + T / 2, z]] as [number, number][]))],
      tools: ["allen"],
    },
    {
      title: "Screw the two angle brackets under the bottom",
      detail: "Near the front edge, one screw each. They hold the plinth later.",
      fix: [at("angle", brackets, [0, 1, 0], { on: "BT", len: 30, dia: 24 }), at("screw", brackets.map((p) => [p[0], PL, p[2] - 6] as Vec3), [0, 1, 0], { on: "BT", len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the plinth and the back rail",
      detail: "Two in each end of both rails.",
      fix: ["PF", "PB"].flatMap((id) => [-1, 1].map((sx) => at("dowel", [14, 56].map((y) => [sx * inner, y, id === "PF" ? Z1 - 20 - T / 2 : ZI + T / 2] as Vec3), [sx, 0, 0], { ...DOWEL, on: id }))),
      wait: ["PF", "PB"],
      tools: ["hammer"],
    },
    { title: "Push the plinth onto the left side", detail: "At the bottom of the front, with its groove facing in.", add: ["PF"] },
    { title: "Fit the back rail and the right side", detail: "The rail goes in at the back, groove to the back. Then lay the right side on, runners inside.", add: ["PB", "RS"] },
    {
      title: "Screw the right side on",
      detail: "Six Allen screws: two into the shelf, two into the bottom and one into each rail.",
      fix: [sideScrews(1, [[ySh + T / 2, zsScrew[0]], [ySh + T / 2, zsScrew[2]], [PL + T / 2, zsScrew[0]], [PL + T / 2, zsScrew[2]], [PL / 2, Z1 - 20 - T / 2], [PL / 2, ZI + T / 2]])],
      tools: ["allen"],
    },
    {
      title: "Screw the brackets to the plinth",
      detail: "One screw through each bracket into the back of the plinth.",
      fix: [at("screw", brackets.map((p) => [p[0], PL - 30, Z1 - 20 - T] as Vec3), [0, 0, 1], { on: "PF", len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Tap the dowels into the top", detail: "Three in each end.", fix: endDowels("TP", H - T / 2, zs3), wait: ["TP"], tools: ["hammer"] },
    {
      title: "Fit the top and screw it on",
      detail: "Push it onto both sides, then three Allen screws through each side into it.",
      add: ["TP"],
      fix: [-1, 1].map((sx) => sideScrews(sx, zsScrew.map((z) => [H - T / 2, z] as [number, number]))),
      tools: ["allen"],
    },
    {
      title: "Slide the back panel into the grooves",
      detail: "Unfold it flat, then slide it in from the bottom end. Measure both diagonals: when they're equal the wardrobe is square.",
      add: ["BK"],
      from: { BK: [0, -900, 0] },
      check: "square",
    },
    {
      title: "Push four rivets through the back into the bottom",
      detail: "Push each sleeve in, then press its pin in until it's flush.",
      fix: [at("clip", [-350, -120, 120, 350].map((x) => [x, PL + T / 2, Z0 + 8.5] as Vec3), [0, 0, 1], { on: "BK", mate: "BT", len: 20, dia: 8, name: "Rivet" })],
    },
    {
      title: "Clip the two halves of the back together",
      detail: "Eight clips along the fold, pressed in until they snap.",
      fix: [at("clip", [700, 950, 1200, 1450, 1650, 1800, 820, 1330].map((y, i) => [i % 2 ? 35 : -35, y, Z0 + 8.5] as Vec3), [0, 0, 1], { on: "BK", len: 12, dia: 14, name: "Back clip" })],
    },
    {
      title: "Press the glides into the bottom edges",
      detail: "Two under each side and two under the plinth.",
      fix: [at("glide", [...[-1, 1].flatMap((sx) => [Z0 + 50, Z1 - 50].map((z) => [sx * xs, 0, z] as Vec3)), ...[-300, 300].map((x) => [x, 0, Z1 - 20 - T / 2] as Vec3)], [0, 1, 0], glide)],
    },
    {
      title: "Stand it up and screw on the wall fittings",
      detail: "Lift it up together from the top end. Screw a wall fitting into each top back corner.",
      fix: [-1, 1].map((sx, i) => at("connector", [fitPts[i]], [sx, 0, 0], { on: sx < 0 ? "LS" : "RS", len: 40, dia: 34, name: "Wall fitting" })),
      tools: ["screwdriver"],
      pose: "+y",
      people: 2,
    },
    {
      title: "Screw a spacer onto each fitting if there's a skirting board",
      detail: "They hold the top as far from the wall as the skirting board holds the bottom. Skip this with no skirting board.",
      fix: [at("spacer", fitPts.map((p) => [p[0], p[1], Z0 - 4] as Vec3), [0, 0, 1], { on: "BK", len: 20, dia: 30, name: "Spacer", included: true })],
    },
    { title: "Push the wardrobe against the wall", detail: "Where it will stand, upright and square to the wall." },
    { title: "Check it touches the wall at the bottom", detail: "No gap behind the bottom, or it will lean forward when the doors are open." },
    { title: "Mark the wall through the fittings", detail: "Two marks, one through the hole in each fitting.", tools: ["pencil"], wall: true },
    { title: "Move the wardrobe away from the wall", detail: "Far enough to drill.", people: 2 },
    {
      title: "Drill the holes and push in the plugs",
      detail: "The plugs in the box suit solid walls; for other walls, use plugs made for them.",
      fix: [at("plug", wallPts, [0, 0, -1], { on: "BK", included: true, len: 50, dia: 8 })],
      tools: ["drill"],
      wall: true,
    },
    {
      title: "Screw the fittings to the wall",
      detail: "Push the wardrobe back. A washer on each long screw, through the fitting into the plug, then snap the cover caps on.",
      fix: [
        at("washer", fitPts.map((p) => [p[0], p[1], p[2] + 12] as Vec3), [0, 0, -1], { on: "BK", len: 2, dia: 18 }),
        at("screw", fitPts.map((p) => [p[0], p[1], p[2] + 12] as Vec3), [0, 0, -1], { on: "BK", len: 100, dia: 5, included: true, name: "Wall screw" }),
        at("cap", fitPts.map((p) => [p[0], p[1], p[2] + 14] as Vec3), [0, 0, -1], { on: "BK", len: 4, dia: 24 }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["tip"],
    },
    {
      title: "Screw the rail holders in",
      detail: "One on each side near the top, one screw each.",
      fix: [-1, 1].flatMap((sx, i) => [
        at("clip", [holderPts[i]], [sx, 0, 0], { on: sx < 0 ? "LS" : "RS", len: 40, dia: 30, name: "Rail holder" }),
        at("screw", [[holderPts[i][0], holderPts[i][1] + 14, holderPts[i][2]]], [sx, 0, 0], { on: sx < 0 ? "LS" : "RS", len: 13, dia: 4 }),
      ]),
      tools: ["screwdriver"],
    },
    { title: "Drop the clothes rail into the holders", detail: "Press it down into both until it sits.", add: ["RL"], from: { RL: [0, 120, 0] } },
    {
      title: "Stick the bumpers on the shelf's front edge",
      detail: "Four of them, so the doors and drawers close softly.",
      fix: [at("glide", [-400, -60, 60, 400].map((x) => [x, ySh + T / 2, Z1] as Vec3), [0, 0, -1], { on: "SH", len: 2, dia: 10, name: "Bumper" })],
    },
  ];
  return { parts, steps };
}

function doorsAndDrawers(b: PlanBuilder) {
  const HINGE: HwDef = { kind: "hinge", len: 50, dia: 35 };
  const KNOB: HwDef = { kind: "knob", len: 25, dia: 28 };
  const KNOB_SCREW: HwDef = { kind: "screw", len: 40, dia: 4 };

  // doors: the left one runs the full height, the right one stops above the drawers
  const doors = [
    { x0: -W / 2, x1: -1.5, y0: PL + 2, y1: H - 2, hinge: -1, ys: [180, 720, 1300, 1780] },
    { x0: 1.5, x1: W / 2, y0: ySh + 3, y1: H - 2, hinge: 1, ys: [700, 1240, 1780] },
  ].map((d) => {
    const w = d.x1 - d.x0, h = d.y1 - d.y0;
    const key = b.place(b.part("Door", [w, h, DOOR_T]), [(d.x0 + d.x1) / 2, (d.y0 + d.y1) / 2, DOOR_Z]);
    return { ...d, w, key, cx: (d.x0 + d.x1) / 2 };
  });
  const hingeX = (d: (typeof doors)[number]) => (d.hinge < 0 ? d.x0 + 45 : d.x1 - 45);
  const freeX = (d: (typeof doors)[number]) => (d.hinge < 0 ? d.x1 - 40 : d.x0 + 40);
  b.step(
    { title: "Screw the hinges onto the doors", detail: "Lay the doors face down on a rug. Four hinges on the tall door, three on the short one, arms over the outer edge.", kind: "hinges", tools: ["screwdriver"], scene: "doors", warnings: ["floor"] },
    () => {
      b.stagger(0.2);
      doors.forEach((d, i) => b.stage(d.key, [(i - 0.5) * (d.w + 100), DOOR_T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]));
      b.then(0.1);
      for (const d of doors) put(b, HINGE, d.ys.map((y) => [hingeX(d), y, DOOR_Z - DOOR_T / 2] as Vec3), [0, 0, 1], d.key, 0.05);
    },
  );
  b.step(
    { title: "Hang the doors", detail: "Hold each door in place and screw its hinges to the inside of the side. Line the doors up with the hinge screws.", kind: "doors", tools: ["screwdriver"] },
    () => {
      b.stagger(0.35);
      for (const d of doors) b.add(d.key, [0, 0, 380]);
    },
  );
  b.step({ title: "Screw a knob on each door", detail: "Near the edges where the doors meet, with a screw from the inside.", kind: "screws", tools: ["screwdriver"] }, () => {
    for (const d of doors) put(b, KNOB, [[freeX(d), 1000, DOOR_Z + DOOR_T / 2]], [0, 0, -1], d.key);
    b.then(0.05);
    for (const d of doors) put(b, KNOB_SCREW, [[freeX(d), 1000, DOOR_Z - DOOR_T / 2]], [0, 0, 1], d.key);
  });

  // drawers: built face down beside each other, then stood up for the knob and slid in
  const tFront = b.part("Drawer front", [FX1 - FX0, DRAWERS[0].fh, DOOR_T]);
  const tSide = b.part("Drawer side", [T, 150, Z1 - BZ0]);
  const tBottom = b.part("Drawer bottom", [BX1 - BX0 - 2 * T + 16, 3, Z1 - BZ0 - 10], { material: "fiber" });
  const tBack = b.part("Drawer back", [BX1 - BX0 - 2 * T, 138, T]);
  const ds = DRAWERS.map((d, i) => {
    const base: Vec3 = [(i - 0.5) * 620, 0, 0];
    const O: Vec3 = [FCX, d.y0 + d.fh / 2, DOOR_Z + DOOR_T / 2]; // the front's face lies on the floor
    const keys = {
      front: b.place(tFront, [FCX, d.y0 + d.fh / 2, DOOR_Z]),
      sides: [BX0 + T / 2, BX1 - T / 2].map((x) => b.place(tSide, [x, d.box0 + 75, (BZ0 + Z1) / 2])),
      bottom: b.place(tBottom, [(BX0 + BX1) / 2, d.box0 + 10, (BZ0 + Z1) / 2 - 5]),
      back: b.place(tBack, [(BX0 + BX1) / 2, d.box0 + 12 + 69, BZ0 + T / 2]),
    };
    const down = (p: Vec3): Vec3 => {
      const r = rotate([p[0] - O[0], p[1] - O[1], p[2] - O[2]], [Math.PI / 2, 0, 0]);
      return [r[0] + base[0], r[1], r[2] + base[2]];
    };
    const up = (p: Vec3): Vec3 => [p[0] - FCX + base[0], p[1] - d.y0, p[2] - Z1];
    return { ...d, base, keys, down, up, all: [keys.front, ...keys.sides, keys.bottom, keys.back] };
  });
  const finalPos = (k: string) => b.partItem(k).final.pos;
  const FLAT: Vec3 = [Math.PI / 2, 0, 0];
  const sideX = [BX0, BX1]; // outer faces of the drawer sides
  const scene = "drawer";
  b.step(
    { title: "Screw four connector bolts into each drawer front", detail: "Lay the fronts face down on a rug. Two bolts near each end, until they stop.", kind: "screws", tools: ["screwdriver"], scene, warnings: ["floor"] },
    () => {
      b.stagger(0.2);
      for (const d of ds) b.stage(d.keys.front, d.down(finalPos(d.keys.front)), FLAT, [0, 160, 0]);
      b.then(0.1);
      for (const d of ds) put(b, { kind: "camScrew", ...CONNECTOR }, [BX0 + T / 2, BX1 - T / 2].flatMap((x) => [d.box0 + 30, d.box0 + 120].map((y) => [x, y, Z1 + 1] as Vec3)), [0, 0, -1], d.keys.front);
    },
  );
  b.step({ title: "Push the sides onto the bolts", detail: "Grooves facing in and down, towards the front.", kind: "join", scene }, () => {
    b.stagger(0.2);
    for (const d of ds) for (const k of d.keys.sides) b.stage(k, d.down(finalPos(k)), FLAT, [0, 220, 0]);
  });
  b.step({ title: "Lock the sides with four cam locks", detail: "Arrow towards the bolt, then turn clockwise until tight.", kind: "cams", tools: ["screwdriver"], scene }, () => {
    for (const d of ds)
      sideX.forEach((x, j) =>
        put(b, { kind: "cam", len: 13, dia: 15 }, [d.box0 + 30, d.box0 + 120].map((y) => [x, y, Z1 - 25] as Vec3), [j ? -1 : 1, 0, 0], d.keys.sides[j]),
      );
  });
  b.step({ title: "Slide the bottom into the grooves", detail: "Smooth side up, all the way down to the front.", kind: "join", scene }, () => {
    b.stagger(0.25);
    for (const d of ds) b.stage(d.keys.bottom, d.down(finalPos(d.keys.bottom)), FLAT, [0, 0, 420]);
  });
  b.step({ title: "Knock the drawer stop into each back", detail: "Lay the back flat. Tap the wire stop into the holes in its top edge with a hammer, until it's fully down.", kind: "general", tools: ["hammer"], scene }, () => {
    b.stagger(0.2);
    for (const d of ds) {
      const p = d.down(finalPos(d.keys.back));
      b.stage(d.keys.back, [p[0], T / 2, 420], FLAT, [0, 160, 0]);
    }
    b.then(0.1);
    for (const d of ds) put(b, { kind: "hook", len: 30, dia: 24, name: "Drawer stop" }, [[(BX0 + BX1) / 2, d.box0 + 12 + 138, BZ0 + T / 2]], [0, -1, 0], d.keys.back);
  });
  b.step({ title: "Fit the back between the sides", detail: "Over the bottom, then push four plastic dowels through the sides into it.", kind: "dowels", scene }, () => {
    b.stagger(0.2);
    for (const d of ds) b.stage(d.keys.back, d.down(finalPos(d.keys.back)), FLAT, [0, 0, -260]);
    b.then(0.1);
    for (const d of ds)
      sideX.forEach((x, j) => put(b, { kind: "dowel", len: 35, dia: 8, name: "Plastic dowel" }, [d.box0 + 45, d.box0 + 115].map((y) => [x, y, BZ0 + T / 2] as Vec3), [j ? -1 : 1, 0, 0], d.keys.sides[j]));
  });
  b.step({ title: "Lock the back with four cam locks", detail: "Into the back, over the dowels; turn each clockwise until tight.", kind: "cams", tools: ["screwdriver"], scene }, () => {
    for (const d of ds) put(b, { kind: "cam", len: 13, dia: 15 }, [BX0 + T + 22, BX1 - T - 22].flatMap((x) => [d.box0 + 45, d.box0 + 115].map((y) => [x, y, BZ0] as Vec3)), [0, 0, 1], d.keys.back);
  });
  b.step({ title: "Screw the runners onto the drawer sides", detail: "The runners marked for the drawer: hook each onto the front end, then two screws.", kind: "runners", tools: ["screwdriver"], scene }, () => {
    for (const d of ds) sideX.forEach((x, j) => put(b, { kind: "runner", len: 470, dia: 40 }, [[x, d.runnerY, (BZ0 + Z1) / 2]], [j ? -1 : 1, 0, 0], d.keys.sides[j]));
    b.then(0.05);
    for (const d of ds) sideX.forEach((x, j) => put(b, { kind: "screw", len: 12, dia: 3.5 }, [Z1 - 60, BZ0 + 60].map((z) => [x + (j ? 4 : -4), d.runnerY, z] as Vec3), [j ? -1 : 1, 0, 0], d.keys.sides[j]));
  });
  b.step({ title: "Screw a knob onto each drawer", detail: "Stand the drawer up. One screw from the inside of the front, in the middle.", kind: "screws", tools: ["screwdriver"], scene }, () => {
    b.stagger(0.05);
    for (const d of ds) for (const k of d.all) b.stage(k, d.up(finalPos(k)), [0, 0, 0]);
    b.then(0.1);
    for (const d of ds) put(b, KNOB, [[FCX, d.y0 + d.fh / 2, DOOR_Z + DOOR_T / 2]], [0, 0, -1], d.keys.front);
    b.then(0.05);
    for (const d of ds) put(b, KNOB_SCREW, [[FCX, d.y0 + d.fh / 2, DOOR_Z - DOOR_T / 2]], [0, 0, 1], d.keys.front);
  });
  b.step({ title: "Slide the drawers in", detail: "Rest the runners on the runners in the wardrobe and push until the drawer closes.", kind: "drawer" }, () => {
    b.stagger(0.04);
    for (const d of ds) {
      for (const k of d.all) b.add(k, [0, 0, 460]);
      b.then(0.2);
    }
  });
}

const family: Family = {
  names: ["VILHATTEN"],
  build(b: PlanBuilder, s: ProductSpec) {
    const text = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
    if (!/wardrobe/.test(text) || !/2 doors/.test(text) || !/2 drawers/.test(text) || Math.abs(s.size.w - 98) > 2) return false;
    const { parts, steps } = carcass();
    buildCustom(b, { ...s, custom: { parts, steps } });
    doorsAndDrawers(b);
    return true;
  },
};
export default family;
