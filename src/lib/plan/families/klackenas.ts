import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * KLACKENÄS, read from the sideboard's manual. The cabinet is built upside down on a rug: cam bolts in the top, the
 * two sides and the divider locked onto it, the back slid down into the grooves, the bottom locked on. Lying on its
 * front, the back is riveted to the divider and clipped all round. The plinth is a separate frame (cam locks, dowels,
 * eight angle brackets) screwed under the cabinet while it's upside down. Standing, wall spacers and two wall
 * adjusters go on the back and it is fixed to the wall. Then come the runners, the two drawers, the shelves on pins
 * and the two doors on hinges.
 */

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 120 wide, 97 high, 41 deep
  const W = s.size.w * 10 || 1200, H = s.size.h * 10 || 970, D = s.size.d * 10 || 410;
  const t = 18, fT = 20, ph = 70; // boards, fronts, plinth height
  const cD = D - fT; // cabinet depth behind the fronts
  const zc = -fT / 2; // cabinet centre
  const zBack = -D / 2, zFront = D / 2 - fT;
  const yB = ph + t / 2, yT = H - t / 2, sH = H - ph - 2 * t, yS = ph + t + sH / 2;
  const xs = W / 2 - t / 2;
  const cell = (W - 3 * t) / 2, xc = t / 2 + cell / 2; // each half, centre at +-xc
  const pw = W - 60, px = pw / 2 - t / 2, pz0 = zFront - 40, pz1 = zBack + 20; // plinth, set in
  const dTop = H - t - 10, dH = 160, dY = dTop - dH / 2; // drawer boxes
  const dW = cell - 26, dDp = cD - 40;
  const frontH = 230, doorH = H - ph - frontH - 8;
  const fz = D / 2 - fT / 2;
  const box: PartPiece[] = [
    { shape: "box", size: [dW - 30, 8, dDp - 15], pos: [0, -dH / 2 + 12, 0] },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [15, dH, dDp], pos: [sx * (dW / 2 - 7.5), 0, 0] })),
    { shape: "box", size: [dW - 30, dH - 20, 15], pos: [0, 10, -dDp / 2 + 7.5] },
    { shape: "box", size: [dW - 30, dH, 15], pos: [0, 0, dDp / 2 - 7.5] },
  ];
  const parts: CustomPart[] = [
    { id: "TP", name: "Top", size: [W, t, cD], pos: [0, yT, zc], material: "board" },
    { id: "SL", name: "Side panel", size: [t, sH, cD], pos: [-xs, yS, zc], material: "board" },
    { id: "SR", name: "Side panel", size: [t, sH, cD], pos: [xs, yS, zc], material: "board" },
    { id: "DV", name: "Divider", size: [t, sH, cD - 18], pos: [0, yS, zc + 9], material: "board" },
    { id: "BK", name: "Back panel", size: [W - 2 * t + 16, sH, 4], pos: [0, yS, zBack + 8], material: "fiber" },
    { id: "BT", name: "Bottom", size: [W, t, cD], pos: [0, yB, zc], material: "board" },
    { id: "PF", name: "Plinth rail", size: [pw, ph, t], pos: [0, ph / 2, pz0 - t / 2], material: "board" },
    { id: "PB", name: "Plinth rail", size: [pw, ph, t], pos: [0, ph / 2, pz1 + t / 2], material: "board" },
    { id: "PE1", name: "Plinth end", size: [t, ph, pz0 - pz1 - 2 * t], pos: [-px, ph / 2, (pz0 + pz1) / 2], material: "board" },
    { id: "PE2", name: "Plinth end", size: [t, ph, pz0 - pz1 - 2 * t], pos: [px, ph / 2, (pz0 + pz1) / 2], material: "board" },
    { id: "D1", name: "Drawer", size: [dW, dH, dDp], pos: [-xc, dY, zc + 10], material: "board", pieces: box },
    { id: "D2", name: "Drawer", size: [dW, dH, dDp], pos: [xc, dY, zc + 10], material: "board", pieces: box },
    { id: "F1", name: "Drawer front", size: [W / 2 - 2, frontH, fT], pos: [-W / 4, H - frontH / 2, fz], material: "wood" },
    { id: "F2", name: "Drawer front", size: [W / 2 - 2, frontH, fT], pos: [W / 4, H - frontH / 2, fz], material: "wood" },
    { id: "SH1", name: "Shelf", size: [cell - 2, t, cD - 40], pos: [-xc, ph + t + 300, zc + 10], material: "board" },
    { id: "SH2", name: "Shelf", size: [cell - 2, t, cD - 40], pos: [xc, ph + t + 300, zc + 10], material: "board" },
    { id: "DR1", name: "Door", size: [W / 2 - 2, doorH, fT], pos: [-W / 4, ph + 4 + doorH / 2, fz], material: "wood" },
    { id: "DR2", name: "Door", size: [W / 2 - 2, doorH, fT], pos: [W / 4, ph + 4 + doorH / 2, fz], material: "wood" },
  ];
  const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
  const zz = [zc - cD / 2 + 70, zc + cD / 2 - 70];
  const xsDv = [-xs, 0, xs];
  // cabinet cams: bolts in the top and bottom faces, locks in the sides and the divider just inside them
  const camBolts = (on: "TP" | "BT"): CustomFix => {
    const y = on === "TP" ? yT - t / 2 : yB + t / 2;
    return fx("camScrew", xsDv.flatMap((x) => zz.map((z): Vec3 => [x, y, z])), on === "TP" ? [0, 1, 0] : [0, -1, 0], on, { len: 34 });
  };
  const sideLocks = (top: boolean): CustomFix[] =>
    [-1, 1].map((sx) => fx("cam", zz.map((z): Vec3 => [sx * (xs - t / 2), top ? yT - t / 2 - 34 : yB + t / 2 + 34, z]), [sx, 0, 0], sx < 0 ? "SL" : "SR", { dia: 15 }));
  const divLocks = (top: boolean) =>
    fx("cam", zz.map((z, i): Vec3 => [i ? t / 2 : -t / 2, top ? yT - t / 2 - 34 : yB + t / 2 + 34, z]), [1, 0, 0], "DV", { dia: 15, name: "Spring cam lock" });
  // plinth: angle brackets on the inside of the rails and ends, under the cabinet's bottom
  // each against a piece's inside face: its points, the way its screws go in, and the piece
  const brackets: { at: Vec3[]; dir: Vec3; on: string }[] = [
    { at: [-400, 0, 400].map((x): Vec3 => [x, ph - 10, pz0 - t - 3]), dir: [0, 0, 1], on: "PF" },
    { at: [-400, 0, 400].map((x): Vec3 => [x, ph - 10, pz1 + t + 3]), dir: [0, 0, -1], on: "PB" },
    { at: [[-(px - t / 2 - 3), ph - 10, (pz0 + pz1) / 2]], dir: [-1, 0, 0], on: "PE1" },
    { at: [[px - t / 2 - 3, ph - 10, (pz0 + pz1) / 2]], dir: [1, 0, 0], on: "PE2" },
  ];
  const plinth = ["PF", "PB", "PE1", "PE2"];
  const backClips: Vec3[] = [
    ...[-450, -225, 0, 225, 450].flatMap((x): Vec3[] => [[x, ph + t + 4, zBack + 2], [x, H - t - 4, zBack + 2]]),
    ...[-1, 1].flatMap((sx) => [ph + 300, H - 300].map((y): Vec3 => [sx * (xs - t / 2 - 4), y, zBack + 2])),
  ];
  const runners: [number, number, string][] = [[-xs + t / 2, -1, "SL"], [-t / 2, 1, "DV"], [t / 2, -1, "DV"], [xs - t / 2, 1, "SR"]];
  const yRun = dY - dH / 2 + 15;
  const walls = runners; // the same four faces carry the shelf pins
  const dx = [-xc, xc];
  const steps: CustomStep[] = [
    { title: "Screw the cam bolts into the top", detail: "Lay the top upside down on a rug. Two bolts where each side goes and two for the divider.", add: ["TP"], fix: [camBolts("TP")], pose: "-y", warnings: ["floor"] },
    { title: "Stand the sides on the top", detail: "Their holes for the cam locks face in, and the grooves for the back line up.", add: ["SL", "SR"] },
    { title: "Lock the sides", detail: "Cam locks in, arrows towards the edge, and turn them clockwise.", fix: sideLocks(true) },
    {
      title: "Slide the divider in",
      detail: "Two more cam bolts into the top first. Slide it in from the front, its front edge flush with the sides.",
      add: ["DV"],
      fix: [fx("camScrew", [[-60, yT - t / 2, zc], [60, yT - t / 2, zc]], [0, 1, 0], "TP", { len: 34 })],
    },
    { title: "Lock the divider", detail: "These are the spring cam locks. Turn them clockwise.", fix: [divLocks(true)] },
    { title: "Slide the back panel into the grooves", detail: "Smooth side in, all the way down to the top.", add: ["BK"], from: { BK: [0, -700, 0] } },
    { title: "Screw the cam bolts into the bottom", detail: "Six of them, as in the top.", fix: [camBolts("BT")], wait: ["BT"] },
    { title: "Lay the bottom on", detail: "Over the cam bolts, with the back panel in its groove.", add: ["BT"], from: { BT: [0, -400, 0] } },
    { title: "Lock the bottom", detail: "Four cam locks in the sides and two spring cam locks in the divider.", fix: [...sideLocks(false), divLocks(false)] },
    {
      title: "Rivet the back to the divider",
      detail: "Lay the cabinet on its front. Push each sleeve through the back into the divider, then press its pin in.",
      fix: [fx("clip", [[0, yS - 200, zBack + 2], [0, yS + 200, zBack + 2]], [0, 0, 1], "BK", { name: "Plastic rivet", mate: "DV" })],
      pose: "-z",
    },
    { title: "Clip the back panel all round", detail: "Fourteen clips over the edge of the back into the top, bottom and sides.", fix: [fx("clip", backClips, [0, 0, 1], "BK", { name: "Back clip" })] },
    {
      title: "Screw cam bolts into the plinth rails",
      detail: "Two in each long rail, near the ends, on the inside.",
      fix: [-1, 1].flatMap((sx) => [fx("camScrew", [[sx * px, ph / 2, pz0 - t]], [0, 0, 1], "PF", { len: 34 }), fx("camScrew", [[sx * px, ph / 2, pz1 + t]], [0, 0, -1], "PB", { len: 34 })]),
      wait: plinth,
    },
    {
      title: "Tap dowels into the plinth ends",
      detail: "One into each end of the two short pieces.",
      fix: [-1, 1].map((sx) => fx("dowel", [[sx * px, 20, pz0 - t], [sx * px, 20, pz1 + t]], [0, 0, 1], sx < 0 ? "PE1" : "PE2")),
      tools: ["hammer"],
    },
    {
      title: "Join the ends to the front rail",
      detail: "Push them onto the rail's cam bolts and dowels, then turn a cam lock in each.",
      fix: [-1, 1].map((sx) => fx("cam", [[sx * px, ph, pz0 - t - 30]], [0, -1, 0], sx < 0 ? "PE1" : "PE2", { dia: 15 })),
    },
    {
      title: "Fit the back rail",
      detail: "Onto the other ends, and lock it the same way.",
      fix: [-1, 1].map((sx) => fx("cam", [[sx * px, ph, pz1 + t + 30]], [0, -1, 0], sx < 0 ? "PE1" : "PE2", { dia: 15 })),
    },
    {
      title: "Screw the angle brackets into the plinth",
      detail: "Eight brackets on the inside, flush with the top edge.",
      fix: [
        ...brackets.map((g) => fx("angle", g.at, g.dir, g.on, { len: 30, dia: 20 })),
        ...brackets.map((g) => fx("screw", g.at.map((p): Vec3 => [p[0], p[1] - 25, p[2]]), g.dir, g.on, { len: 15, dia: 4 })),
      ],
    },
    {
      title: "Tap four dowels into the plinth's top edge",
      detail: "Two in each long rail.",
      fix: [fx("dowel", [-350, 350].map((x): Vec3 => [x, ph, pz0 - t / 2]), [0, -1, 0], "PF"), fx("dowel", [-350, 350].map((x): Vec3 => [x, ph, pz1 + t / 2]), [0, -1, 0], "PB")],
      tools: ["hammer"],
    },
    {
      title: "Set the plinth on the bottom",
      detail: "Turn the cabinet upside down again and push the plinth's dowels into the holes in the bottom.",
      add: plinth,
      from: Object.fromEntries(plinth.map((id) => [id, [0, -300, 0]])) as Record<string, Vec3>,
      pose: "-y",
    },
    { title: "Screw the brackets to the bottom", detail: "Eight screws, one through each bracket.", fix: [fx("screw", brackets.flatMap((g) => g.at.map((p): Vec3 => [p[0] - g.dir[0] * 12, ph - 3, p[2] - g.dir[2] * 12])), [0, 1, 0], "BT", { len: 15, dia: 4 })] },
    {
      title: "Press the wall spacers onto the back",
      detail: "Six of them, on the back edges of the sides and the divider, so the back stays clear of the wall.",
      fix: [fx("glide", [-xs, 0, xs].flatMap((x) => [ph + 150, H - 150].map((y): Vec3 => [x, y, zBack])), [0, 0, 1], "BK", { name: "Wall spacer", len: 8, dia: 20 })],
    },
    {
      title: "Fit the two wall adjusters",
      detail: "Turn the cabinet over. Screw the adjusters onto the back of the top, then push a wheel onto each.",
      fix: [
        fx("connector", [-1, 1].map((sx): Vec3 => [sx * 450, H - 40, zBack]), [0, 0, 1], "BK", { name: "Wall adjuster", len: 20, dia: 30 }),
        fx("knob", [-1, 1].map((sx): Vec3 => [sx * 450, H - 40, zBack - 20]), [0, 0, 1], "BK", { name: "Adjuster wheel", dia: 30 }),
      ],
      pose: "+y",
      people: 2,
    },
    { title: "Push it against the wall and level it", detail: "Turn the wheels until the cabinet stands straight and its back is parallel to the wall.", tools: ["level"] },
    {
      title: "Fix it to the wall",
      detail: "Through both adjusters. Use screws and plugs that suit your wall; they aren't included.",
      fix: [
        fx("plug", [-1, 1].map((sx): Vec3 => [sx * 450, H - 40, zBack - 30]), [0, 0, -1], "TP", { len: 40, dia: 8 }),
        fx("screw", [-1, 1].map((sx): Vec3 => [sx * 450, H - 40, zBack]), [0, 0, -1], "TP", { len: 50, dia: 5 }),
        fx("washer", [-1, 1].map((sx): Vec3 => [sx * 450, H - 40, zBack + 2]), [0, 0, -1], "TP", { dia: 12, included: true }),
      ],
      wall: true,
      warnings: ["tip"],
      tools: ["drill"],
    },
    {
      title: "Screw the drawer runners into the cabinet",
      detail: "Two screws each, in the front holes of the sides and the divider. All four the same height.",
      fix: [
        ...runners.map(([x, sx, on]) => fx("runner", [[x, yRun, zc + 10]], [sx, 0, 0], on, { len: 350 })),
        ...runners.map(([x, sx, on]) => fx("screw", [[x, yRun, zc - 100], [x, yRun, zc + 120]], [sx, 0, 0], on, { len: 12, dia: 4 })),
      ],
    },
    {
      title: "Screw the cam bolts into the drawer bottoms",
      detail: "Four in each. Build both drawers side by side.",
      fix: [0, 1].map((i) => fx("camScrew", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [dx[i] + sx * (dW / 2 - 40), dY - dH / 2 + 16, zc + 10 + sz * (dDp / 2 - 50)])), [0, -1, 0], `D${i + 1}`, { len: 34 })),
      wait: ["D1", "D2"],
      repeat: 2,
    },
    {
      title: "Fit the drawer sides",
      detail: "Dowels into the sides, push them onto the bottom's cam bolts, then turn the cam locks.",
      fix: [
        ...[0, 1].map((i) => fx("dowel", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [dx[i] + sx * (dW / 2 - 7), dY + 30, zc + 10 + sz * (dDp / 2)])), [0, 0, -1], `D${i + 1}`)),
        ...[0, 1].map((i) => fx("cam", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [dx[i] + sx * (dW / 2 - 15), dY - dH / 2 + 30, zc + 10 + sz * (dDp / 2 - 50)])), [-1, 0, 0], `D${i + 1}`, { dia: 15 })),
      ],
      repeat: 2,
    },
    { title: "Slide the drawer backs in", detail: "Down into the sides' grooves, onto the bottom." },
    {
      title: "Nail on the drawer box fronts",
      detail: "Four nails each, through the front into the sides and bottom.",
      fix: [0, 1].map((i) => fx("nail", [-1, 1].flatMap((sx) => [-40, 40].map((y): Vec3 => [dx[i] + sx * (dW / 2 - 8), dY + y, zc + 10 + dDp / 2])), [0, 0, -1], `D${i + 1}`, { len: 30, dia: 2 })),
      tools: ["hammer"],
    },
    {
      title: "Clip the runner catches under the drawers",
      detail: "One at each front corner.",
      fix: [0, 1].map((i) => fx("clip", [-1, 1].map((sx): Vec3 => [dx[i] + sx * (dW / 2 - 40), dY - dH / 2, zc + 10 + dDp / 2 - 40]), [0, 1, 0], `D${i + 1}`, { name: "Runner catch" })),
    },
    { title: "Slide the drawers in", detail: "Pull the runners out, set each drawer on them and push it home until it clicks.", add: ["D1", "D2"], from: { D1: [0, 0, 600], D2: [0, 0, 600] } },
    {
      title: "Click the drawer fronts on",
      detail: "Hook them onto the front fittings and press until they click. The fittings adjust the gaps.",
      add: ["F1", "F2"],
      fix: [0, 1].map((i) => fx("clip", [-1, 1].map((sx): Vec3 => [dx[i] + sx * (dW / 2 - 60), dY, D / 2 - fT]), [0, 0, -1], `F${i + 1}`, { name: "Front fitting" })),
    },
    {
      title: "Put in the shelf pins and shelves",
      detail: "Four pins in each half, at the same height, then lay the shelves on them.",
      add: ["SH1", "SH2"],
      fix: walls.map(([x, sx, on]) => fx("pin", [-1, 1].map((sz): Vec3 => [x, ph + t + 300 - t / 2 - 3, zc + 10 + sz * (cD / 2 - 60)]), [sx, 0, 0], on, { len: 12, dia: 5 })),
    },
    {
      title: "Screw the hinges onto the doors",
      detail: "Two on each door, into the cups on the hinge side.",
      fix: [-1, 1].map((sx, i) => fx("hinge", [ph + 120, ph + doorH - 120].map((y): Vec3 => [sx * (W / 2 - 50), y, D / 2 - fT]), [0, 0, 1], `DR${i + 1}`)),
      wait: ["DR1", "DR2"],
    },
    { title: "Hang the doors", detail: "Click each hinge onto its plate on the side.", add: ["DR1", "DR2"], from: { DR1: [0, 0, 400], DR2: [0, 0, 400] } },
    { title: "Adjust the doors", detail: "Turn the hinge screws until the gaps are even and the doors close flush.", tools: ["screwdriver"] },
  ];
  return { parts, steps };
}

const family: Family = { names: ["KLACKENÄS"], recipe };
export default family;
