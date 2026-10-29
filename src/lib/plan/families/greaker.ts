import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * GREÅKER cabinet with drawers, read from its manual. The carcass comes first, lying on its left side: three runners
 * screwed inside each side, then the bottom and the fixed shelf joined to the left side with dowels and cam locks,
 * the right side the same way, four feet (a dowel and a screw each). Stood up, the back slides down its grooves, the
 * top goes on (cam bolts, two magnetic catches under it, dowels in the sides, cam locks) and fourteen two-part
 * clips hold the back. It is fixed to the wall with two brackets. The panel doors get two hinges each (three screws
 * in each leaf), a strike plate and a handle. Each of the three drawers is built with its front face down: cam bolts
 * in the front, dowels in the sides, the bottom slid down the grooves, the back laid on with its wire, push-in
 * bolts and cam locks, then its runners. They roll in on the runners behind the doors, and two bumpers go on the
 * doors. We show the doors standing open so the drawers can be seen going in, as the manual's last picture does.
 * IKEA: 84 x 49 x 101 cm, drawers 72 x 38 inside.
 */

type Fx = Omit<CustomFix, "count" | "at"> & { at: Vec3[] };
const fx = (f: Fx): CustomFix => ({ ...f, count: f.at.length });
const SX = [-1, 1];
const T = 18, TT = 25;
const CAM_BOLT = { kind: "camScrew", len: 34, dia: 7 } as const;
const DOWEL = { kind: "dowel", len: 30, dia: 8 } as const;
const CAM = { kind: "cam", dia: 15 } as const;
const SMALL = { kind: "screw", len: 13, dia: 3.5 } as const;
const OUT = 700; // drawers are built this far in front of the cabinet, doors beside it

/** A panel door: frame round two sunk panels, the small one at the top. */
function doorPieces(w: number, h: number, t: number): PartPiece[] {
  const f = 70, yUp = h / 2 - 250;
  return [
    ...SX.map((sx): PartPiece => ({ shape: "box", size: [f, h, t], pos: [(sx * (w - f)) / 2, 0, 0] })),
    ...[h / 2 - f / 2, yUp, -h / 2 + f / 2].map((y): PartPiece => ({ shape: "box", size: [w - 2 * f, f, t], pos: [0, y, 0] })),
    { shape: "box", size: [w - 2 * f, h / 2 - f - yUp - f / 2, t - 8], pos: [0, (h / 2 - f + yUp + f / 2) / 2, -4] },
    { shape: "box", size: [w - 2 * f, yUp - f / 2 + h / 2 - f, t - 8], pos: [0, (yUp - f / 2 - h / 2 + f) / 2, -4] },
  ];
}

function cabinet(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 840, H = Math.round(s.size.h * 10) || 1010, D = Math.round(s.size.d * 10) || 490;
  const FOOT = 45;
  const xO = W / 2 - 15; // the carcass; the top stands out 15 mm each side
  const xS = xO - T / 2, xIn = xO - T;
  const zB = -D / 2, zF = D / 2 - 25; // sides; doors and the top's front edge stand in front of them
  const zP = zB + 10, zPF = zF - 5, zc = (zP + zPF) / 2, dp = zPF - zP; // bottom, shelf
  const yS0 = FOOT, yS1 = H - TT;
  const yBot = yS0 + T / 2, yShelf = H - TT - 215, slot = (yShelf - T / 2 - (yBot + T / 2)) / 3;
  const zBk = zB + 7;
  const dW = W / 2 - 15 - 1, dH = yS1 - yS0 - 20, DT = 20, yDoor = (yS0 + yS1) / 2;

  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [T, yS1 - yS0, zF - zB], pos: [-xS, (yS0 + yS1) / 2, (zB + zF) / 2] },
    { id: "R", name: "Side panel", size: [T, yS1 - yS0, zF - zB], pos: [xS, (yS0 + yS1) / 2, (zB + zF) / 2] },
    { id: "B", name: "Bottom", size: [2 * xIn, T, dp], pos: [0, yBot, zc] },
    { id: "S", name: "Shelf", size: [2 * xIn, T, dp], pos: [0, yShelf, zc] },
    ...SX.flatMap((sx) => [zB + 35, zF - 35].map((z, k): CustomPart => ({ id: `ft${sx < 0 ? 0 : 1}${k}`, name: "Foot", size: [60, FOOT, 60], pos: [sx * (xO - 30), FOOT / 2, z] }))),
    { id: "BK", name: "Back panel", size: [2 * xIn + 12, yS1 - yS0 - 20, 3], pos: [0, (yS0 + yS1) / 2, zBk], material: "fiber" },
    { id: "T", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0] },
  ];
  const feet = parts.filter((p) => p.name === "Foot").map((p) => p.id);

  // the doors stand open, swung out on hinges at the carcass' outer front corners
  const zHinge = zF + 2;
  SX.forEach((sx, i) =>
    parts.push({ id: `D${i}`, name: "Door", size: [dW, dH, DT], pos: [sx * (xO + DT / 2), yDoor, zHinge + dW / 2], rot: [0, sx * (Math.PI / 2), 0], pieces: doorPieces(dW, dH, DT) }),
  );

  // three drawers, the bottom one first
  const dx = xIn - 13 - 7; // drawer side centres, leaving room for the runners
  const dh = 170, dzF = zF - 20, dDepth = 380;
  const yD = (i: number) => yBot + T / 2 + i * slot + 25;
  const dr = (i: number) => ({ f: `f${i}`, l: `sl${i}`, r: `sr${i}`, bt: `bt${i}`, bk: `bk${i}`, w: `w${i}` });
  for (let i = 0; i < 3; i++) {
    const k = dr(i), y = yD(i);
    parts.push(
      { id: k.f, name: "Drawer front", size: [2 * dx + 14, dh, 16], pos: [0, y + dh / 2, dzF - 8] },
      { id: k.l, name: "Drawer side", size: [14, dh, dDepth], pos: [-dx, y + dh / 2, dzF - 16 - dDepth / 2] },
      { id: k.r, name: "Drawer side", size: [14, dh, dDepth], pos: [dx, y + dh / 2, dzF - 16 - dDepth / 2] },
      { id: k.bt, name: "Drawer bottom", size: [2 * dx - 4, 3, dDepth - 4], pos: [0, y + 15, dzF - 16 - dDepth / 2], material: "fiber" },
      { id: k.bk, name: "Drawer back", size: [2 * dx + 14, dh, 14], pos: [0, y + dh / 2, dzF - 16 - dDepth - 7] },
      { id: k.w, name: "Wire", shape: "cyl", size: [300, 6, 6], pos: [0, y + dh + 3, dzF - 16 - dDepth - 7], material: "metal" },
    );
  }
  const drawerIds = (i: number) => Object.values(dr(i));
  const outFrom = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, [0, 0, OUT] as Vec3]));

  /* ---- fittings ---- */
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  const zJ = [zc - 150, zc + 150];
  const yRun = (i: number) => yD(i) + 40;
  const zRun = dzF - 16 - dDepth / 2;
  const cabRunners = SX.map((sx) => fx({ kind: "runner", len: 400, dia: 30, at: [0, 1, 2].map((i): Vec3 => [sx * xIn, yRun(i), zRun]), dir: [sx, 0, 0], on: side(sx) }));
  const cabRunScrews = SX.map((sx) => fx({ ...SMALL, at: [0, 1, 2].flatMap((i) => [-150, 0, 150].map((dz): Vec3 => [sx * xIn, yRun(i), zRun + dz])), dir: [sx, 0, 0], on: side(sx) }));
  const sideBolts = (sx: number) => fx({ ...CAM_BOLT, at: [yBot, yShelf].flatMap((y) => zJ.map((z): Vec3 => [sx * xIn, y, z])), dir: [sx, 0, 0], on: side(sx) });
  const panelDowels = (sx: number) =>
    fx({ ...DOWEL, at: (["B", "S"] as const).flatMap((id) => [zc - 60, zc + 60].map((z): Vec3 => [sx * xIn, id === "B" ? yBot : yShelf, z])), dir: [-sx, 0, 0] });
  const panelCams = (sx: number, id: "B" | "S") => fx({ ...CAM, at: zJ.map((z): Vec3 => [sx * (xIn - 35), (id === "B" ? yBot : yShelf) + T / 2, z]), dir: [0, -1, 0], on: id });
  const topBolts = fx({ ...CAM_BOLT, at: SX.flatMap((sx) => [zB + 80, zF - 80].map((z): Vec3 => [sx * xS, yS1, z])), dir: [0, 1, 0], on: "T" });
  const topDowels = fx({ ...DOWEL, at: SX.flatMap((sx) => [zB + 150, zF - 150].map((z): Vec3 => [sx * xS, yS1, z])), dir: [0, -1, 0] });
  const topCams = SX.map((sx) => fx({ ...CAM, at: [zB + 80, zF - 80].map((z): Vec3 => [sx * xIn, yS1 - 35, z]), dir: [sx, 0, 0], on: side(sx) }));
  const xCatch = [-60, 60];
  const catches = fx({ kind: "clip", name: "Magnetic catch", len: 20, dia: 30, at: xCatch.map((x): Vec3 => [x, yS1, zF - 25]), dir: [0, 1, 0], on: "T" });
  const catchScrews = fx({ kind: "screw", len: 16, dia: 3.5, at: xCatch.flatMap((x) => [-12, 12].map((d): Vec3 => [x + d, yS1, zF - 25])), dir: [0, 1, 0], on: "T" });
  const backClips: Vec3[] = [
    ...SX.flatMap((sx) => [180, 360, 540, 720, 900].map((y): Vec3 => [sx * xS, y, zBk - 2])),
    ...SX.flatMap((sx) => [yBot, yShelf].map((y): Vec3 => [sx * 200, y, zBk - 2])),
  ];
  const yBr = yS1 - 60, xBr = xIn - 30;

  // doors: open, so their back faces look at the cabinet's sides and their fronts outwards
  const yH = [yS0 + 160, yS1 - 160];
  const hinges = SX.map((sx, i) => fx({ kind: "hinge", at: yH.map((y): Vec3 => [sx * xO, y, zHinge + 15]), dir: [sx, 0, 0], on: `D${i}` }));
  const hingeDoorScrews = SX.map((sx, i) => fx({ kind: "screw", len: 16, dia: 4, at: yH.flatMap((y) => [-35, 0, 35].map((dy): Vec3 => [sx * xO, y + dy, zHinge + 25])), dir: [sx, 0, 0], on: `D${i}` }));
  const hingeSideScrews = SX.map((sx, i) => fx({ kind: "screw", len: 16, dia: 4, at: yH.flatMap((y) => [-50, -25, 50].map((dy): Vec3 => [sx * xS, y + dy, zF])), dir: [0, 0, -1], on: side(sx), mate: `D${i}` }));
  const zFree = zHinge + dW - 40;
  const plates = SX.map((sx, i) => fx({ kind: "plate", name: "Strike plate", len: 2, dia: 40, at: [[sx * (xO + DT / 2), yDoor + dH / 2, zFree - 11]], dir: [0, -1, 0], on: `D${i}` }));
  const plateScrews = SX.map((sx, i) => fx({ kind: "screw", len: 10, dia: 3, at: [[sx * (xO + DT / 2), yDoor + dH / 2, zFree + 12]], dir: [0, -1, 0], on: `D${i}` }));
  const yHandle = yS0 + dH * 0.6;
  const handles = SX.map((sx, i) => fx({ kind: "handle", len: 128, dia: 12, at: [[sx * (xO + DT), yHandle, zFree]], dir: [-sx, 0, 0], on: `D${i}`, twist: Math.PI / 2 }));
  const handleScrews = SX.map((sx, i) => fx({ kind: "screw", len: 40, dia: 4, at: [-64, 64].map((dy): Vec3 => [sx * xO, yHandle + dy, zFree]), dir: [sx, 0, 0], on: `D${i}` }));

  const drawerFix = (i: number) => {
    const k = dr(i), y = yD(i);
    const zFr = dzF - 16, zBkF = dzF - 16 - dDepth;
    return {
      bolts: fx({ ...CAM_BOLT, at: SX.flatMap((sx) => [40, dh - 40].map((dy): Vec3 => [sx * dx, y + dy, zFr])), dir: [0, 0, 1], on: k.f }),
      dowels: SX.map((sx) => fx({ ...DOWEL, at: [[sx * dx, y + dh / 2, zFr], [sx * dx, y + dh / 2, zBkF]], dir: [0, 0, -1], on: sx < 0 ? k.l : k.r })),
      cams: SX.map((sx) => fx({ ...CAM, at: [40, dh - 40].map((dy): Vec3 => [sx * (dx - 7), y + dy, zFr - 30]), dir: [sx, 0, 0], on: sx < 0 ? k.l : k.r })),
      pushBolts: fx({ kind: "camScrew", name: "Push-in bolt", len: 40, dia: 7, at: SX.flatMap((sx) => [40, dh - 40].map((dy): Vec3 => [sx * dx, y + dy, zBkF - 14])), dir: [0, 0, 1], on: k.bk }),
      backCams: SX.map((sx) => fx({ ...CAM, at: [40, dh - 40].map((dy): Vec3 => [sx * (dx - 7), y + dy, zBkF + 30]), dir: [sx, 0, 0], on: sx < 0 ? k.l : k.r })),
      runners: SX.map((sx) => fx({ kind: "runner", len: 380, dia: 30, at: [[sx * (dx + 7), y + 15, zRun]], dir: [-sx, 0, 0], on: sx < 0 ? k.l : k.r })),
      runScrews: SX.map((sx) => fx({ ...SMALL, at: [-150, 0, 150].map((dz): Vec3 => [sx * (dx + 7), y + 15, zRun + dz]), dir: [-sx, 0, 0], on: sx < 0 ? k.l : k.r })),
    };
  };
  const d0 = drawerFix(0);
  const k0 = dr(0);

  const steps: CustomStep[] = [
    {
      title: "Screw the runners inside both sides",
      detail: "Lay the sides on a rug, inside face up. Three runners on each, three screws in each, wheel end to the front.",
      add: ["L"],
      fix: [...cabRunners, ...cabRunScrews],
      wait: ["R"],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Screw the cam bolts into the sides", detail: "Four into the left side for the bottom and the shelf. The right side gets its four later.", fix: [sideBolts(-1)], tools: ["screwdriver"] },
    { title: "Tap the dowels into the bottom and the shelf", detail: "Two into one end of each.", fix: [panelDowels(-1)], tools: ["hammer"], wait: ["B", "S"] },
    { title: "Push the bottom onto the left side", detail: "Its cam holes face up, onto the dowels and the bolts.", add: ["B"] },
    { title: "Turn its two cam locks", detail: "Arrows pointing to the bolts, then turn clockwise until tight.", fix: [panelCams(-1, "B")], tools: ["screwdriver"] },
    { title: "Push the shelf onto the left side", detail: "At the upper row of holes, cam holes facing up.", add: ["S"] },
    { title: "Turn its two cam locks", fix: [panelCams(-1, "S")], tools: ["screwdriver"] },
    { title: "Screw four cam bolts into the right side", fix: [sideBolts(1)], tools: ["screwdriver"] },
    { title: "Tap dowels into the other ends", detail: "Two into the free end of the bottom and two into the shelf.", fix: [panelDowels(1)], tools: ["hammer"] },
    { title: "Push on the right side", detail: "Runners facing in, onto all the dowels and bolts at once.", add: ["R"] },
    { title: "Turn the four cam locks", detail: "Two in the bottom and two in the shelf, at the right side.", fix: [panelCams(1, "B"), panelCams(1, "S")], tools: ["screwdriver"], check: "square" },
    { title: "Tap a dowel into each foot", fix: [fx({ kind: "dowel", len: 40, dia: 10, at: parts.filter((p) => p.name === "Foot").map((p): Vec3 => [p.pos[0] + 15, FOOT, p.pos[2]]), dir: [0, -1, 0] })], tools: ["hammer"], wait: feet },
    {
      title: "Screw the feet under the corners",
      detail: "Each on its dowel under the bottom, then one screw. Stand the cabinet up afterwards.",
      add: feet,
      fix: [fx({ kind: "screw", len: 35, dia: 5, at: parts.filter((p) => p.name === "Foot").map((p): Vec3 => [p.pos[0] - 10, 0, p.pos[2]]), dir: [0, 1, 0] })],
      tools: ["screwdriver"],
    },
    { title: "Slide the back panel down the grooves", detail: "From the top, smooth side to the front, all the way to the bottom.", add: ["BK"], pose: "+y" },
    { title: "Screw the cam bolts into the top", detail: "Four, near the corners on its underside. Lay it face down on a rug.", fix: [topBolts], tools: ["screwdriver"], wait: ["T"] },
    { title: "Screw the magnetic catches under the top", detail: "Two catches near the middle of the front edge, two screws each.", fix: [catches, catchScrews], tools: ["screwdriver"] },
    { title: "Tap dowels into the top of the sides", detail: "Two into each side's top edge.", fix: [topDowels], tools: ["hammer"] },
    { title: "Lay the top on", detail: "Onto the dowels, with the catches at the front.", add: ["T"] },
    { title: "Turn the cam locks at the top", detail: "Four, two in each side, clockwise until tight.", fix: topCams, tools: ["screwdriver"] },
    {
      title: "Clip the back on",
      detail: "Push the fourteen clips through the back into the sides, the bottom and the shelf, then press a pin into each one.",
      fix: [fx({ kind: "clip", name: "Back clip", len: 14, dia: 12, at: backClips, dir: [0, 0, 1] }), fx({ kind: "cap", name: "Clip pin", len: 8, dia: 8, at: backClips.map((p): Vec3 => [p[0], p[1], p[2] - 1]), dir: [0, 0, 1] })],
    },
    {
      title: "Screw the wall brackets inside",
      detail: "One inside each side, high up at the back, one screw and a washer each.",
      fix: [
        ...SX.map((sx) => fx({ kind: "angle", name: "Wall bracket", len: 60, dia: 30, at: [[sx * xIn, yBr, zB + 20]], dir: [sx, 0, 0], on: side(sx) })),
        ...SX.map((sx) => fx({ kind: "washer", at: [[sx * (xIn - 2), yBr, zB + 20]], dir: [sx, 0, 0], on: side(sx) })),
        ...SX.map((sx) => fx({ kind: "screw", len: 16, dia: 4, included: true, at: [[sx * (xIn - 3), yBr, zB + 20]], dir: [sx, 0, 0], on: side(sx) })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Mark the holes on the wall", detail: "Stand it where it goes and mark through the slot in each bracket.", tools: ["pencil"], wall: true },
    { title: "Drill and plug the holes", detail: "Pull the cabinet away first. The plugs suit solid walls; for other walls pick fixings made for them.", fix: [fx({ kind: "plug", at: SX.map((sx): Vec3 => [sx * xBr, yBr, zB - 1]), dir: [0, 0, -1] })], tools: ["drill"], wall: true },
    {
      title: "Screw it to the wall",
      detail: "Push it back and screw through each bracket with a washer.",
      fix: [
        fx({ kind: "washer", at: SX.map((sx): Vec3 => [sx * xBr, yBr, zB + 6]), dir: [0, 0, -1], on: "T" }),
        fx({ kind: "screw", len: 50, dia: 5, at: SX.map((sx): Vec3 => [sx * xBr, yBr, zB + 8]), dir: [0, 0, -1] }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    { title: "Screw the hinges onto the doors", detail: "Lay the doors face down. Two hinges on the outer edge of each, three screws in each leaf.", fix: [...hinges, ...hingeDoorScrews], tools: ["screwdriver"], wait: ["D0", "D1"], from: { D0: [-OUT, 0, 0], D1: [OUT, 0, 0] } },
    { title: "Screw a strike plate onto each door", detail: "On the top edge, near the inner corner, where it meets the catch.", fix: [...plates, ...plateScrews], tools: ["screwdriver"] },
    { title: "Hang the doors", detail: "Hold each door against the front edge of its side and screw the other hinge leaves on, three screws each.", add: ["D0", "D1"], fix: hingeSideScrews, tools: ["screwdriver"], people: 2, warnings: ["two"] },
    { title: "Screw on the handles", detail: "Two screws each, from the back of the door.", fix: [...handles, ...handleScrews], tools: ["screwdriver"] },
    { title: "Screw the cam bolts into a drawer front", detail: "Lay the front face down on a rug. Four bolts near its ends.", fix: [d0.bolts], tools: ["screwdriver"], wait: [k0.f], from: outFrom([k0.f]), warnings: ["floor"] },
    { title: "Tap the dowels into the drawer sides", detail: "One into each end of both sides.", fix: d0.dowels, tools: ["hammer"], wait: [k0.l, k0.r], from: outFrom([k0.l, k0.r]) },
    { title: "Stand the sides on the front", detail: "Onto the dowels and bolts, grooves facing in." },
    { title: "Turn the four cam locks", detail: "Two in each side, near the front.", fix: d0.cams, tools: ["screwdriver"] },
    { title: "Slide the bottom down the grooves", detail: "All the way to the front.", wait: [k0.bt], from: outFrom([k0.bt]) },
    { title: "Tap the wire into the back and lay it on", detail: "Both ends of the wire right down into their holes. Then lay the back on the sides' ends.", wait: [k0.bk, k0.w], from: outFrom([k0.bk, k0.w]), tools: ["hammer"] },
    { title: "Push in the bolts at the back", detail: "Four push-in bolts through the back into the sides.", fix: [d0.pushBolts], tools: ["screwdriver"] },
    { title: "Turn the cam locks at the back", detail: "Four, two in each side.", fix: d0.backCams, tools: ["screwdriver"] },
    { title: "Screw the runners onto the drawer", detail: "One under each side, hooked on at the back, three screws each.", fix: [...d0.runners, ...d0.runScrews], tools: ["screwdriver"] },
    {
      title: "Build the other two drawers",
      detail: "The same way, step by step.",
      wait: [1, 2].flatMap(drawerIds),
      from: outFrom([1, 2].flatMap(drawerIds)),
      repeat: 2,
      tools: ["screwdriver", "hammer"],
    },
    { title: "Roll the drawers in", detail: "Tilt each one onto the runners in the cabinet and push it in.", add: [0, 1, 2].flatMap(drawerIds) },
    {
      title: "Stick the bumpers on the doors",
      detail: "One inside each door, near the bottom corner by the handle.",
      fix: SX.map((sx, i) => fx({ kind: "glide", name: "Bumper", len: 3, dia: 12, at: [[sx * xO, yS0 + 60, zFree]], dir: [sx, 0, 0], on: `D${i}` })),
    },
  ];
  // the other two drawers: every fitting counted, each kept on its own drawer's parts (24 groups, as many as a step takes)
  const more = [1, 2].map(drawerFix).flatMap((r) => [r.bolts, ...r.dowels, ...r.cams, r.pushBolts, ...r.backCams, ...r.runners, ...r.runScrews]);
  steps.find((st) => st.title === "Build the other two drawers")!.fix = more;
  return { parts, steps };
}

const family: Family = {
  names: ["GREÅKER", "GREAKER"],
  recipe(s) {
    if (/cabinet-drawers/.test(s.slug ?? "")) return cabinet(s);
    return null;
  },
};
export default family;
