import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * LÄRANDE desk with pull-out storage unit, read from its manual. First the pull-out unit, built lying on its big
 * front panel: six short strips stand on it on dowels and cam bolts, the bottom (with two castors) and two shelves
 * slide into their grooves and the back panel goes on with plastic pins and cam locks. Then the open pedestal: two
 * sides with the drawer runners and a short back panel on cam locks, plastic feet underneath. The steel leg frame
 * takes two cross tubes on long bolts, which bolt into the pedestal's inner side; a top panel is screwed onto the
 * pedestal, the desk top goes on with dowels and cam locks, and six bolts hold it to the steel frame. Last the unit
 * hooks onto the runners. Drawn with the pedestal on the left, the manual's first way round.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, on: string | undefined, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at, ...o });
const CAM_BOLT = { len: 34, dia: 6 };

function recipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 1200, D = Math.round(s.size.d * 10) || 580, H = Math.round(s.size.h * 10) || 740;
  const T = 18, TT = 20, yT = H - TT; // boards, the desk top and its underside
  const yP = yT - T; // the pedestal's top panel sits on the sides
  const xo = -W / 2 + T / 2, pw = 406, xi = -W / 2 + pw - T / 2; // pedestal sides
  const dz = D - 20, yF0 = 10; // pedestal depth, on its feet
  const ux = (xo + xi) / 2, uw = xi - xo - T - 8; // the unit between the sides
  const zF = dz / 2 - T / 2, zK = zF - T / 2 - 409 - T / 2; // unit front and back panels
  const sl = zF - T / 2 - (zK + T / 2), sz = (zF - T / 2 + zK + T / 2) / 2; // strips run from front to back
  const ys = [60, 280, 480]; // undersides of the unit's bottom and shelves
  const xs = [-1, 1].map((k) => ux + k * (uw / 2 - T / 2)); // the strips
  const pwIn = uw - 2 * T; // panels between the strips
  const R = 12.5; // steel tube radius
  const xR = W / 2 - 20 - R, zR = dz / 2 - 30;
  const yBar = [yT - 30, 250];
  const zBar = -zR;
  const parts: CustomPart[] = [
    { id: "F", name: "Front panel", size: [uw, 660, T], pos: [ux, 20 + 330, zF], material: "board" },
    ...ys.flatMap((y, i) => xs.map((x, j): CustomPart => ({ id: `L${i}${j}`, name: "Strip", size: [T, 60, sl], pos: [x, y + 21, sz], material: "board" }))),
    { id: "B", name: "Bottom", size: [pwIn, T, sl], pos: [ux, ys[0] + T / 2, sz], material: "board" },
    ...[1, 2].map((k): CustomPart => ({ id: `S${k}`, name: "Shelf", size: [pwIn, T, sl], pos: [ux, ys[k] + T / 2, sz], material: "board" })),
    { id: "K", name: "Back panel", size: [uw, 520, T], pos: [ux, ys[0] + 260, zK], material: "board" },
    { id: "PO", name: "Outer side", size: [T, yP - yF0, dz], pos: [xo, (yP + yF0) / 2, 0], material: "board" },
    { id: "PI", name: "Inner side", size: [T, yP - yF0, dz], pos: [xi, (yP + yF0) / 2, 0], material: "board" },
    { id: "PB", name: "Pedestal back", size: [xi - xo - T, 300, T], pos: [ux, yP - 150, -dz / 2 + T / 2], material: "board" },
    {
      id: "FR",
      name: "Leg frame",
      size: [2 * R, yT, 2 * zR + 2 * R],
      pos: [xR, yT / 2, 0],
      shape: "box",
      material: "metal",
      pieces: [
        ...[-1, 1].map((k) => ({ shape: "cyl" as const, size: [2 * R, yT, 2 * R] as Vec3, pos: [0, 0, k * zR] as Vec3 })),
        ...[R, yT - R].map((y) => ({ shape: "cyl" as const, size: [2 * R, 2 * zR, 2 * R] as Vec3, pos: [0, y - yT / 2, 0] as Vec3, rot: [Math.PI / 2, 0, 0] as Vec3 })),
      ],
    },
    ...yBar.map((y, i): CustomPart => ({ id: `CB${i}`, name: "Cross tube", size: [xR - R - (xi + T / 2), 2 * R, 2 * R], pos: [(xR - R + xi + T / 2) / 2, y, zBar], shape: "cyl", material: "metal" })),
    { id: "P", name: "Pedestal top", size: [pw, T, dz], pos: [-W / 2 + pw / 2, yP + T / 2, 0], material: "board" },
    { id: "T", name: "Desk top", size: [W, TT, D], pos: [0, yT + TT / 2, 0], material: "board" },
  ];
  const strips = (i: number) => [0, 1].map((j) => `L${i}${j}`);
  const stripY = (i: number) => ys[i] + 21;
  const camBolts = fx("camScrew", "F", [0, 0, 1], ys.flatMap((_, i) => xs.map((x) => [x, stripY(i), zF - T / 2] as Vec3)), CAM_BOLT);
  const stripDowels = (i: number) => xs.map((x, j) => fx("dowel", `L${i}${j}`, [0, 0, 1], [-20, 20].map((d) => [x, stripY(i) + d, zF - T / 2] as Vec3), { mate: "F" }));
  const stripLocks = (i: number) => xs.map((x, j) => fx("cam", `L${i}${j}`, [j ? -1 : 1, 0, 0], [[x - (j ? -1 : 1) * (T / 2), stripY(i), zF - T / 2 - 26]], { dia: 12 }));
  const backLocks = ys.flatMap((_, i) => xs.map((x, j) => fx("cam", `L${i}${j}`, [j ? -1 : 1, 0, 0], [[x - (j ? -1 : 1) * (T / 2), stripY(i), zK + T / 2 + 26]], { dia: 12 })));
  const sideBolts = [fx("camScrew", "PO", [-1, 0, 0], [yP - 60, yP - 240].map((y) => [xo + T / 2, y, -dz / 2 + T / 2] as Vec3), CAM_BOLT), fx("camScrew", "PI", [1, 0, 0], [yP - 60, yP - 240].map((y) => [xi - T / 2, y, -dz / 2 + T / 2] as Vec3), CAM_BOLT)];
  const topScrews = fx("screw", "P", [0, -1, 0], [xo, xi].flatMap((x) => [-200, 0, 200].map((z) => [x, yP + T, z] as Vec3)), { len: 50, dia: 5 });
  const topDowels = fx("dowel", "P", [0, 1, 0], [-W / 2 + 90, -W / 2 + 316].flatMap((x) => [-180, 0, 180].map((z) => [x, yT, z] as Vec3)), { mate: "T" });
  const deskCams = [-W / 2 + 90, -W / 2 + 316].flatMap((x) => [-120, 120].map((z): Vec3 => [x, yT, z]));
  const frameBolts: Vec3[] = [...[-200, 0, 200].map((z): Vec3 => [xR, yT - 2 * R, z]), ...[-80, 160, 400].map((x): Vec3 => [x, yT - 2 * R, zBar])];
  const steps: CustomStep[] = [
    { title: "Screw the cam bolts into the front panel", detail: "Lay the big front panel of the unit face down on a rug. Six bolts, by hand.", add: ["F"], fix: [camBolts], pose: "-z", tools: ["screwdriver"], warnings: ["floor"] },
    { title: "Tap the dowels into two strips", detail: "Two in one end of each.", fix: stripDowels(0), wait: strips(0), from: Object.fromEntries(strips(0).map((id) => [id, [0, 0, -300] as Vec3])), tools: ["hammer"] },
    { title: "Stand the two strips on the front panel", detail: "At the bottom end, grooves facing each other.", add: strips(0), from: Object.fromEntries(strips(0).map((id) => [id, [0, 0, -300] as Vec3])) },
    { title: "Lock the two strips", detail: "Cam lock in, arrow to the bolt, then turn clockwise.", fix: stripLocks(0), tools: ["screwdriver"] },
    { title: "Tap the dowels into the bottom", detail: "Two in each side edge.", fix: [-1, 1].map((k) => fx("dowel", "B", [-k, 0, 0], [-120, 120].map((d) => [ux + k * (pwIn / 2), ys[0] + T / 2, sz + d] as Vec3))), wait: ["B"], tools: ["hammer"] },
    {
      title: "Screw the castors under the bottom",
      detail: "Near the back edge, two screws each.",
      fix: [
        fx("castor", "B", [0, 1, 0], [-1, 1].map((k) => [ux + k * 110, ys[0], zK + 80] as Vec3), { len: 60, dia: 50 }),
        fx("screw", "B", [0, 1, 0], [-1, 1].flatMap((k) => [-15, 15].map((d) => [ux + k * 110 + d, ys[0], zK + 80] as Vec3)), { len: 14, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Slide the bottom in", detail: "Down the grooves of the two strips, castors facing out.", add: ["B"], from: { B: [0, 0, -380] } },
    { title: "Tap the dowels into four more strips", detail: "Two in one end of each, like before.", fix: [...stripDowels(1), ...stripDowels(2)], wait: [...strips(1), ...strips(2)], from: Object.fromEntries([...strips(1), ...strips(2)].map((id) => [id, [0, 0, -300] as Vec3])), tools: ["hammer"] },
    { title: "Stand the four strips on the front panel", detail: "Two pairs, grooves facing each other.", add: [...strips(1), ...strips(2)], from: Object.fromEntries([...strips(1), ...strips(2)].map((id) => [id, [0, 0, -300] as Vec3])) },
    { title: "Lock the four strips", detail: "Four cam locks.", fix: [...stripLocks(1), ...stripLocks(2)], tools: ["screwdriver"] },
    { title: "Slide in the two shelves", detail: "Down the grooves, smooth side up.", add: ["S1", "S2"], from: { S1: [0, 0, -380], S2: [0, 0, -380] } },
    {
      title: "Put the back panel on",
      detail: "Lay it over the ends of the strips and push a plastic pin through each of its six holes.",
      add: ["K"],
      from: { K: [0, 0, -260] },
      fix: [fx("pin", "K", [0, 0, 1], ys.flatMap((_, i) => xs.map((x) => [x, stripY(i), zK - T / 2] as Vec3)), { name: "Plastic pin", len: 30, dia: 6 })],
    },
    { title: "Lock the back panel", detail: "Six cam locks in the strips, turned until they grip the pins.", fix: backLocks, tools: ["screwdriver"] },
    { title: "Stand it up and push in the glides", detail: "Two under the bottom edge of the front panel.", fix: [fx("glide", "F", [0, 1, 0], [-1, 1].map((k) => [ux + k * 140, 20, zF] as Vec3), { name: "Glide" })], pose: "+y" },
    { title: "Clip the handle on", detail: "Over the cut-out in the top edge of the front panel. Press it down until it sits flat.", fix: [fx("handle", "F", [0, -1, 0], [[ux, 680, zF]], { len: 40, dia: 60 })] },
    { title: "Screw the cam bolts into the pedestal sides", detail: "Two near the back of each side, by hand.", fix: sideBolts, wait: ["PO", "PI"], from: { PO: [-300, 0, 0], PI: [300, 0, 0] }, tools: ["screwdriver"] },
    {
      title: "Screw the runners onto the sides",
      detail: "One on the inside of each side, near the bottom, two screws each.",
      fix: [
        fx("runner", "PO", [-1, 0, 0], [[xo + T / 2, 45, 0]], { len: 400, dia: 30 }),
        fx("runner", "PI", [1, 0, 0], [[xi - T / 2, 45, 0]], { len: 400, dia: 30 }),
        fx("screw", "PO", [-1, 0, 0], [-120, 120].map((z) => [xo + T / 2 + 6, 45, z] as Vec3), { len: 12, dia: 4 }),
        fx("screw", "PI", [1, 0, 0], [-120, 120].map((z) => [xi - T / 2 - 6, 45, z] as Vec3), { len: 12, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Tap the dowels into the pedestal back", detail: "One in each end.", fix: [-1, 1].map((k) => fx("dowel", "PB", [-k, 0, 0], [[ux + k * ((xi - xo - T) / 2), yP - 150, -dz / 2 + T / 2]])), wait: ["PB"], from: { PB: [0, 0, -300] }, tools: ["hammer"] },
    { title: "Join the sides with the back", detail: "Push the back onto one side, then press the other side on.", add: ["PB", "PO", "PI"], from: { PB: [0, 0, -300], PO: [-300, 0, 0], PI: [300, 0, 0] } },
    { title: "Lock the back", detail: "Four cam locks in the back panel.", fix: [-1, 1].map((k) => fx("cam", "PB", [0, 0, -1], [yP - 60, yP - 240].map((y) => [ux + k * ((xi - xo - T) / 2 - 26), y, -dz / 2 + T] as Vec3), { dia: 15 })), tools: ["screwdriver"] },
    { title: "Push the feet into the sides", detail: "Two under each side.", fix: [fx("glide", "PO", [0, 1, 0], [-1, 1].map((k) => [xo, yF0, k * (dz / 2 - 40)] as Vec3), { name: "Foot" }), fx("glide", "PI", [0, 1, 0], [-1, 1].map((k) => [xi, yF0, k * (dz / 2 - 40)] as Vec3), { name: "Foot" })] },
    { title: "Screw the plate onto the inner side", detail: "On the outside of the inner side, at the back, two screws.", fix: [fx("plate", "PI", [-1, 0, 0], [[xi + T / 2, (yBar[0] + yBar[1]) / 2, zBar]], { len: 60, dia: 40 }), fx("screw", "PI", [-1, 0, 0], [yBar[0] - 60, yBar[1] + 60].map((y) => [xi + T / 2, y, zBar] as Vec3), { len: 12, dia: 4 })], tools: ["screwdriver"] },
    { title: "Stick the felt pads under the leg frame", detail: "One under each end of the bottom tube.", fix: [fx("glide", "FR", [0, 1, 0], [-1, 1].map((k) => [xR, 0, k * (zR - 40)] as Vec3), { name: "Felt pad" })], wait: ["FR"], from: { FR: [300, 0, 0] } },
    {
      title: "Bolt the cross tubes to the leg frame",
      detail: "The flat ends against the frame, then a long bolt through the back tube into each.",
      add: ["FR", "CB0", "CB1"],
      from: { FR: [300, 0, 0], CB0: [0, 0, -250], CB1: [0, 0, -250] },
      fix: [fx("bolt", "FR", [-1, 0, 0], yBar.map((y) => [xR + R, y, zBar] as Vec3), { len: 90, dia: 6 })],
      tools: ["allen"],
    },
    { title: "Bolt the tubes to the pedestal", detail: "From inside the pedestal, one bolt through the inner side into each tube.", fix: [fx("bolt", "PI", [1, 0, 0], yBar.map((y) => [xi - T / 2, y, zBar] as Vec3), { len: 40, dia: 6, mate: undefined })], tools: ["allen"] },
    { title: "Screw the top panel onto the pedestal", detail: "Six screws down into the sides.", add: ["P"], from: { P: [0, 240, 0] }, fix: [topScrews], tools: ["allen"] },
    { title: "Tap the dowels into the top panel", detail: "Six, along both sides.", fix: [topDowels], tools: ["hammer"] },
    { title: "Screw the cam bolts into the desk top", detail: "Lay it face down. Four bolts on the pedestal end.", fix: [fx("camScrew", "T", [0, 1, 0], deskCams, CAM_BOLT)], wait: ["T"], from: { T: [0, 300, 0] }, tools: ["screwdriver"] },
    { title: "Lay the desk top on", detail: "Two people. Onto the dowels and bolts, then over the steel frame.", add: ["T"], from: { T: [0, 300, 0] }, people: 2 },
    { title: "Lock the desk top", detail: "Four cam locks under the pedestal top.", fix: [fx("cam", "P", [0, 1, 0], deskCams.map(([x, , z]) => [x, yP, z + 40] as Vec3), { dia: 15 })], tools: ["screwdriver"] },
    { title: "Bolt the steel frame to the top", detail: "Six bolts up through the frame's top tube and the cross tube.", fix: [fx("bolt", undefined, [0, 1, 0], frameBolts, { len: 35, dia: 6, mate: "T" })], tools: ["allen"] },
    { title: "Pull the runners out", detail: "All the way to the front." },
    { title: "Hook the unit onto the runners", detail: "Back end first, then lower the front until both hooks catch, and push it in." },
    {
      title: "Screw the unit to the runners",
      detail: "A bracket at the front of each runner, two screws each.",
      fix: [
        fx("angle", "B", [-1, 0, 0], [[xo + T / 2 + 2, 60, zF - 40]], { len: 30, dia: 20 }),
        fx("angle", "B", [1, 0, 0], [[xi - T / 2 - 2, 60, zF - 40]], { len: 30, dia: 20 }),
        fx("screw", "F", [0, 0, 1], [xo + T / 2 + 10, xi - T / 2 - 10].flatMap((x) => [50, 70].map((y) => [x, y, zF - T / 2 - 4] as Vec3)), { len: 12, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Press the caps into the side", detail: "Over the two holes on the outside of the pedestal.", fix: [fx("cap", "PO", [1, 0, 0], [-1, 1].map((k) => [-W / 2, yP - 150, k * 200] as Vec3), { len: 8, dia: 14 })] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["LÄRANDE", "LARANDE"],
  recipe(s: ProductSpec) {
    if (!/pull-out-storage/.test(s.slug ?? "")) return null;
    return recipe(s);
  },
};
export default family;
