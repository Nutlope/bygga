import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * LISABO, read from its manuals. The tables, the coffee table and the desk share one leg joint: the top comes with
 * a frame and a plastic bracket in each corner, the top lies upside down on a rug, each leg is pushed down into its
 * bracket and slid in until it clicks, and a ribbed wedge is pressed in behind it and tightened with the key that
 * comes in the box. Dining tables then get a floor protector knocked into each leg. The desk has glides on its legs
 * first and a drawer that runs on two wooden rails screwed under the top. The chair is two leg frames slotted into
 * a cross, joined with screws, then the backrest and the padded seat are bolted on.
 */

const WEDGE = { kind: "clamp" as const, len: 44, dia: 18, name: "Leg wedge" };
const SPLAY = 0.06; // radians the legs lean out, both ways

interface Top {
  W: number;
  H: number;
  D: number;
  T: number; // top thickness
  A: number; // frame under the top, how deep
  inset: number; // frame in from the edge
  round: boolean;
  gap?: number; // desk: an opening in the front of the frame this wide for the drawer
}

const FT = 18; // frame rails, thick

/** The frame's outer size: in from the edges, or a square inside a round top. */
const frameOf = (t: Top) => (t.round ? { fw: t.W / Math.SQRT2 - 40, fd: t.W / Math.SQRT2 - 40 } : { fw: t.W - 2 * t.inset, fd: t.D - 2 * t.inset });

/** The top with its frame underneath, as one part: it comes in one piece with the leg brackets in its corners. */
function topPart(t: Top): CustomPart {
  const { W, H, D, T, A, round } = t;
  const { fw, fd } = frameOf(t), ft = FT;
  const yMid = H - (T + A) / 2;
  const slabY = (A + T) / 2 - T / 2;
  const frameY = slabY - T / 2 - A / 2;
  const pieces: PartPiece[] = [
    round ? { shape: "cyl", size: [W, T, W], pos: [0, slabY, 0] } : { shape: "box", size: [W, T, D], pos: [0, slabY, 0] },
    { shape: "box", size: [fw, A, ft], pos: [0, frameY, -fd / 2 + ft / 2] },
    { shape: "box", size: [ft, A, fd - 2 * ft], pos: [-fw / 2 + ft / 2, frameY, 0] },
    { shape: "box", size: [ft, A, fd - 2 * ft], pos: [fw / 2 - ft / 2, frameY, 0] },
  ];
  if (t.gap) {
    const side = (fw - t.gap) / 2;
    for (const sx of [-1, 1]) pieces.push({ shape: "box", size: [side, A, ft], pos: [sx * (fw / 2 - side / 2), frameY, fd / 2 - ft / 2] });
  } else pieces.push({ shape: "box", size: [fw, A, ft], pos: [0, frameY, fd / 2 - ft / 2] });
  return { id: "top", name: round ? "Round table top" : "Table top", size: [W, T + A, D], pos: [0, yMid, 0], material: "board", pieces };
}

interface Leg {
  id: string;
  sx: number;
  sz: number;
  top: Vec3; // where the leg's top end meets the top, finished product
  foot: Vec3; // where its foot meets the floor
}

/** Four legs, their tops in the corners of the frame, leaning out a little both ways like IKEA's photos. */
function legs(t: Top, dia: number): { parts: CustomPart[]; legs: Leg[] } {
  const { H, T } = t;
  const yTop = H - T;
  const L = yTop / Math.cos(SPLAY);
  const lean = Math.tan(SPLAY) * yTop;
  // in the inside corners of the frame, where the brackets are
  const { fw, fd } = frameOf(t);
  const hx = fw / 2 - FT - dia / 2 - 2;
  const hz = fd / 2 - FT - dia / 2 - 2;
  const out: Leg[] = [];
  const parts: CustomPart[] = [];
  for (const sz of [-1, 1])
    for (const sx of [-1, 1]) {
      const id = `leg${out.length}`;
      const top: Vec3 = [sx * hx, yTop, sz * hz];
      const foot: Vec3 = [sx * (hx + lean), 0, sz * (hz + lean)];
      out.push({ id, sx, sz, top, foot });
      parts.push({
        id,
        name: "Leg",
        size: [dia, L, dia],
        pos: [(top[0] + foot[0]) / 2, yTop / 2 + 3, (top[2] + foot[2]) / 2],
        rot: [-sz * SPLAY, 0, sx * SPLAY],
        shape: "cyl",
        material: "wood",
      });
    }
  return { parts, legs: out };
}

const wedges = (ls: Leg[], dia: number): CustomFix => ({
  ...WEDGE,
  count: ls.length,
  // pressed into the bracket on the inside corner of each leg, towards the top
  at: ls.map((l) => [l.top[0] - l.sx * (dia / 2 + 14), l.top[1] - 34, l.top[2] - l.sz * (dia / 2 + 14)] as Vec3),
  dir: [0, 1, 0],
  on: "top",
});

const feet = (ls: Leg[], name: string, len: number, dia: number): CustomFix => ({
  kind: "glide",
  name,
  count: ls.length,
  len,
  dia,
  at: ls.map((l) => l.foot),
  dir: [0, 1, 0],
});

const legSteps = (ls: Leg[]): CustomStep => ({
  title: "Push the legs into the corner brackets",
  detail: "Lay the top upside down on a rug. Push each leg down into its bracket, then slide it in towards the corner until it clicks.",
  add: ls.map((l) => l.id),
  pose: "-y",
  warnings: ["floor"],
  from: Object.fromEntries(ls.map((l) => [l.id, [0, -260, 0] as Vec3])),
});

function diningTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const round = !!s.table?.round;
  const t: Top = { W, H, D, T: 22, A: 55, inset: round ? 0 : 50, round };
  const dia = 52;
  const { parts: legParts, legs: ls } = legs(t, dia);
  const big = W >= 1400;
  return {
    parts: [topPart(t), ...legParts],
    steps: [
      { title: "Lay the top upside down", detail: "On a rug or the flattened box, so the surface doesn't get scratched.", add: ["top"], pose: "-y", warnings: ["floor"] },
      legSteps(ls),
      {
        title: "Press a wedge in behind each leg",
        detail: "Ribbed side towards the leg, square in the bracket. A wedge pushed in crooked won't hold.",
        fix: [wedges(ls, dia)],
      },
      {
        title: "Tighten the wedges with the key",
        detail: "Turn each one by hand first, then finish with the key from the box until the leg sits firm.",
        tools: ["wrench"],
      },
      { title: "Knock in the floor protectors", detail: "One into the end of each leg, tapped flat with the hammer.", fix: [feet(ls, "Floor protector", 12, 26)], tools: ["hammer"] },
      {
        title: big ? "Turn the table over together" : "Turn the table over",
        detail: "Lift it by the top, not the legs, and set it down on all four feet.",
        pose: "+y",
        people: big ? 2 : 1,
        warnings: big ? ["two"] : [],
      },
    ],
  };
}

function coffeeTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t: Top = { W, H, D, T: 20, A: 50, inset: 45, round: false };
  const dia = 44;
  const { parts: legParts, legs: ls } = legs(t, dia);
  return {
    parts: [topPart(t), ...legParts],
    steps: [
      { title: "Lay the top upside down", detail: "On a rug or the flattened box, so the surface doesn't get scratched.", add: ["top"], pose: "-y", warnings: ["floor"] },
      legSteps(ls),
      {
        title: "Wedge and tighten each leg",
        detail: "Press a wedge into the bracket behind each leg, ribbed side to the leg, turn it by hand, then tighten it with the Allen key.",
        fix: [wedges(ls, dia)],
        tools: ["allen"],
      },
      { title: "Turn the table over", detail: "Set it on its feet. If it wobbles later, give the wedges another turn with the Allen key.", pose: "+y" },
    ],
  };
}

function desk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  // the drawer: 56 x 35 x 6 cm inside, its front in an opening in the front of the frame
  const dw = 600, dd = 380, dh = 76, bt = 15, ft = 18;
  const t: Top = { W, H, D, T: 22, A: dh + 4, inset: 45, round: false, gap: dw + 6 };
  const dia = 44;
  const { parts: legParts, legs: ls } = legs(t, dia);
  const yU = H - t.T; // underside of the top
  const y0 = yU - 2 - dh; // drawer bottom edge
  const zF = D / 2 - t.inset; // front face of the frame
  const zBack = zF - dd; // drawer back face: the front, the sides and the back make up the depth
  const yc = y0 + dh / 2;
  const sideL = dd - ft - bt;
  const sideZ = zF - ft - sideL / 2;
  const rx = dw / 2 - bt + 28; // rails, just outside the drawer sides
  const railL = D - 2 * t.inset - 2 * 18;
  const parts: CustomPart[] = [
    topPart(t),
    ...legParts,
    { id: "front", name: "Drawer front", size: [dw, dh, ft], pos: [0, yc, zF - ft / 2], material: "board" },
    { id: "sideL", name: "Drawer side", size: [bt, dh - 4, sideL], pos: [-(dw / 2 - 20 - bt / 2), yc, sideZ], material: "board" },
    { id: "sideR", name: "Drawer side", size: [bt, dh - 4, sideL], pos: [dw / 2 - 20 - bt / 2, yc, sideZ], material: "board" },
    { id: "bottom", name: "Drawer bottom", size: [dw - 40 - 2 * bt + 12, 3, sideL], pos: [0, y0 + 10, sideZ], material: "fiber" },
    { id: "back", name: "Drawer back", size: [dw - 40, dh - 14, bt], pos: [0, yc + 4, zBack + bt / 2], material: "board" },
    { id: "railL", name: "Drawer rail", size: [26, dh, railL], pos: [-rx, yU - dh / 2, 0], material: "wood" },
    { id: "railR", name: "Drawer rail", size: [26, dh, railL], pos: [rx, yU - dh / 2, 0], material: "wood" },
  ];
  const xs = dw / 2 - 20 - bt / 2;
  const camY = yc;
  const railScrew = (side: number, end: number, len: number, dia2: number): CustomFix => ({
    kind: "screw",
    count: 1,
    len,
    dia: dia2,
    at: [[side * rx, yU - dh, end * (railL / 2 - 30)]],
    dir: [0, 1, 0],
    on: side < 0 ? "railL" : "railR",
    mate: "top",
  });
  return {
    parts,
    steps: [
      { title: "Lay the top upside down", detail: "On a rug or the flattened box, so the surface doesn't get scratched.", add: ["top"], pose: "-y", warnings: ["floor"] },
      {
        ...legSteps(ls),
        title: "Press in the glides and push the legs into the brackets",
        detail: "First press a glide into the foot end of each leg. Then push each leg down into its bracket and slide it into the corner until it clicks.",
        fix: [feet(ls, "Glide", 10, 24)],
      },
      { title: "Press a wedge in behind each leg", detail: "Ribbed side towards the leg, square in the bracket.", fix: [wedges(ls, dia)] },
      { title: "Tighten the wedges with the key", detail: "By hand first, then with the key from the box until each leg sits firm.", tools: ["wrench"] },
      {
        title: "Screw cam bolts into the drawer front",
        detail: "Lay the front face down on the rug. Two bolts at each end, turned in until they stop.",
        add: ["front"],
        fix: [{ kind: "camScrew", count: 4, at: [-1, 1].flatMap((sx) => [-1, 1].map((sy) => [sx * xs, camY + sy * 20, zF - ft] as Vec3)), dir: [0, 0, 1], on: "front", len: 34 }],
        from: { front: [0, -300, 0] },
      },
      { title: "Fit the drawer sides onto the bolts", detail: "Grooves on the inside, facing each other.", add: ["sideL", "sideR"] },
      {
        title: "Turn the cam locks",
        detail: "Push one into each hole in the sides, arrow towards the bolt, and turn it until it pulls the side tight.",
        fix: [{ kind: "cam", count: 4, at: [-1, 1].flatMap((sx) => [-1, 1].map((sy) => [sx * (xs - bt / 2), camY + sy * 20, zF - ft - 24] as Vec3)), dir: [-1, 0, 0], dia: 15 }],
        tools: ["screwdriver"],
      },
      { title: "Slide in the drawer bottom", detail: "Along the grooves in the sides, smooth side up, all the way to the front.", add: ["bottom"], from: { bottom: [0, 0, -360] } },
      { title: "Fit the drawer back", detail: "Down over the ends of the sides, so it closes the bottom in.", add: ["back"] },
      {
        title: "Screw the back to the sides",
        detail: "Two screws at each end.",
        fix: [{ kind: "screw", count: 4, len: 30, dia: 4, at: [-1, 1].flatMap((sx) => [-1, 1].map((sy) => [sx * xs, yc + 4 + sy * 18, zBack] as Vec3)), dir: [0, 0, 1], on: "back" }],
      },
      {
        title: "Turn in the two drawer stops",
        detail: "Into the holes at the top of the back, leaving the heads out. They stop the drawer coming all the way out.",
        fix: [{ kind: "screw", name: "Stop screw", count: 2, len: 10, dia: 5, at: [-1, 1].map((sx) => [sx * (dw / 2 - 80), y0 + dh - 4, zBack] as Vec3), dir: [0, 0, 1], on: "back" }],
      },
      {
        title: "Screw the first rail under the top",
        detail: "One long screw at the back end and one shorter one at the front. Check which screw goes where before you drive it.",
        add: ["railL"],
        fix: [railScrew(-1, -1, 50, 4), railScrew(-1, 1, 40, 4)],
      },
      {
        title: "Fit the second rail with one screw",
        detail: "Only the front screw for now, and leave it a little loose so the rail can swing.",
        add: ["railR"],
        fix: [railScrew(1, 1, 40, 4)],
      },
      {
        title: "Slide the drawer onto the rails",
        detail: "Swing the loose rail out, set the drawer on the first rail, then swing the second one back against it.",
        kind: "join",
      },
      { title: "Screw down the back of the second rail", detail: "One long screw.", fix: [railScrew(1, -1, 50, 4)] },
      { title: "Tighten the front screw", detail: "The one you left loose, until its head sits flush. Check that the drawer runs freely." },
      { title: "Turn the desk over", detail: "Lift it by the top, not the legs.", pose: "+y" },
    ],
  };
}

function chair(s: ProductSpec): CustomParams {
  // IKEA's page: 46 wide, 51 deep, 80 high, seat 45 x 39 at 48 high
  void s;
  const W = 460, D = 510, H = 800;
  const SH = 480, ST = 55; // seat top and thickness
  const rY = SH - ST - 40; // rail centre height
  const leg = 38;
  const xL = W / 2 - leg / 2 - 4;
  const zF = D / 2 - 40, zB = -D / 2 + 60;
  const xIn = xL - leg / 2 - 11;
  // a side frame: back leg (rising to the backrest, leaning back), front leg and the rail between, plus its cross rail
  const backLow = rY + 20; // the back leg bends here, under the seat
  const lean = Math.atan2(50, H - backLow); // the back leg above it, leaning back
  const upY = (backLow + H) / 2, upZ = zB - 25;
  const legZ = (y: number) => upZ - (y - upY) * Math.tan(lean); // the back leg's centre at height y
  const frame = (sx: number): CustomPart => {
    const lowLen = Math.hypot(backLow, 60);
    const upLen = Math.hypot(H - backLow, 50);
    const cross = Math.hypot(2 * xIn, zF - zB - 60);
    const ang = Math.atan2(zF - zB - 60, 2 * xIn);
    const pieces: PartPiece[] = [
      { shape: "box", size: [leg, lowLen, leg], pos: [0, backLow / 2 - H / 2, zB - 30], rot: [Math.atan2(60, backLow), 0, 0] },
      { shape: "box", size: [leg - 6, upLen, leg - 6], pos: [0, upY - H / 2, upZ], rot: [-lean, 0, 0] },
      { shape: "box", size: [leg, rY + 20, leg], pos: [0, (rY + 20) / 2 - H / 2, zF], rot: [-0.05, 0, 0] },
      { shape: "box", size: [22, 60, zF - zB - leg], pos: [-sx * 30, rY - H / 2, (zF + zB) / 2] },
      // its cross rail, from the back of this side to the front of the other, under the seat
      { shape: "box", size: [cross, 50, 22], pos: [-sx * xL, rY - 6 - H / 2, (zF + zB) / 2], rot: [0, sx * ang, 0] },
    ];
    return { id: sx < 0 ? "frameL" : "frameR", name: "Leg frame", size: [leg, H, D - 30], pos: [sx * xL, H / 2, 0], material: "wood", pieces };
  };
  const yB = H - 110; // backrest centre
  const parts: CustomPart[] = [
    frame(-1),
    frame(1),
    { id: "back", name: "Backrest", size: [W - 30, 190, 16], pos: [0, yB, legZ(yB) + (leg - 6) / 2 + 9], rot: [-lean, 0, 0], material: "wood" },
    { id: "seat", name: "Seat", size: [450, ST, 390], pos: [0, SH - ST / 2, 15], material: "soft" },
  ];
  // the free end of each cross rail is screwed through the other frame's side rail, near the front leg
  const sideScrews = (sx: number): CustomFix => ({
    kind: "screw",
    name: "Frame screw",
    count: 2,
    len: 40,
    dia: 6,
    at: [-12, 12].map((dy) => [sx * (xL - 19), rY + dy, zF - 70] as Vec3),
    dir: [-sx, 0, 0],
    on: sx < 0 ? "frameL" : "frameR",
  });
  const backBolts: CustomFix = {
    kind: "bolt",
    count: 4,
    len: 30,
    dia: 6,
    at: [-1, 1].flatMap((sx) => [-40, 40].map((dy) => [sx * xL, yB + dy, legZ(yB + dy) - (leg - 6) / 2] as Vec3)),
    dir: [0, 0, 1],
    on: "back",
  };
  const seatBolts: Vec3[] = [
    [-xIn + 8, rY - 30, zB + 40],
    [xIn - 8, rY - 30, zB + 40],
    [-xIn + 8, rY - 30, zF - 70],
    [xIn - 8, rY - 30, zF - 70],
    // the middle two go up through the cross rails, 7 cm either side of where they cross
    ...[-70, 70].map((x): Vec3 => [x, rY - 30, (zF + zB) / 2 + 70 * ((zF - zB - 60) / (2 * xIn))]),
  ];
  return {
    parts,
    steps: [
      {
        title: "Slot the two leg frames together",
        detail: "Their cross rails meet under the seat in a halving joint. Check the slots face each other before you press them home.",
        add: ["frameL", "frameR"],
        from: { frameL: [-300, 0, 0], frameR: [300, 0, 0] },
      },
      {
        title: "Turn in the frame screws",
        detail: "Two at each end of the cross rails, through the side rails, with the Allen key. Leave the heads standing out a little.",
        fix: [sideScrews(-1), sideScrews(1)],
        tools: ["allen"],
      },
      { title: "Tighten the frame screws", detail: "All four, until the heads sit flush with the wood.", tools: ["allen"] },
      {
        title: "Bolt on the backrest",
        detail: "Two bolts through each back leg into the backrest, hand tight for now.",
        add: ["back"],
        fix: [backBolts],
        tools: ["allen"],
      },
      { title: "Tighten the backrest bolts", detail: "Until the heads sit flat against the legs.", tools: ["allen"] },
      {
        title: "Bolt on the seat",
        detail: "Lay the seat face down on a table with something soft under it, set the frame upside down on it and drive the six long bolts.",
        add: ["seat"],
        fix: [{ kind: "bolt", count: 6, len: 70, dia: 6, at: seatBolts, dir: [0, 1, 0], on: "seat" }],
        tools: ["allen"],
        pose: "-y",
        from: { seat: [0, -200, 0] },
      },
      { title: "Tighten the seat bolts and stand it up", detail: "All six until they stop, then turn the chair the right way up.", tools: ["allen"], pose: "+y" },
    ],
  };
}

const family: Family = {
  names: ["LISABO"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/lisabo-chair/.test(slug)) return chair(s);
    if (/lisabo-desk/.test(slug)) return desk(s);
    if (/lisabo-coffee-table/.test(slug)) return coffeeTable(s);
    if (/lisabo-table/.test(slug)) return diningTable(s);
    return null;
  },
};
export default family;
