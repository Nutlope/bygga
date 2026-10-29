import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * TORNVIKEN, read from its manuals. The 20 cm open wall cabinet is a cam-locked box: cam bolts and dowels go into
 * the bottom and top, the sides are lowered onto the bottom and locked with four cams, the back slides down in the
 * grooves, the top goes on with four more cams. Its two suspension fittings click together into one, which is pushed
 * into the top at the back and screwed, the cabinet hangs on two wall screws with washers (not included), caps go
 * over them, and the two shelves rest on four bent wire supports.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const r = (n: number) => Math.round(n);

const T = 18; // board
const BK = 8; // back, in grooves

/** The suspension fitting under the top at the back, and hanging the cabinet on it. */
function hang(H: number, z0: number): CustomStep[] {
  const fit: Vec3 = [0, H - T - 30, z0 + 10];
  const wall: Vec3[] = [-1, 1].map((sx) => [r(sx * 40), H - T - 30, z0 - 2]);
  return [
    { title: "Click the two suspension fittings together", detail: "Halves I and II slide into each other and click: they become one fitting." },
    {
      title: "Fit the suspension fitting under the top",
      detail: "Lay the cabinet on its back. Push the fitting's pegs into the holes under the top at the back, screw it on, and drill through for the wall screws.",
      fix: [fx("bracket", [fit], [0, 1, 0], { name: "Suspension fitting", len: 60, dia: 40, on: "P" }), fx("screw", [-1, 1].map((sx) => [sx * 25, H - T, z0 + 30] as Vec3), [0, 1, 0], { len: 16, dia: 4, on: "P" })],
      tools: ["screwdriver", "drill"],
      pose: "+z",
      warnings: ["floor"],
      wall: false,
    },
    {
      title: "Hang it on the wall",
      detail: "Two screws with washers through the fitting into the wall, then press a cap over each. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", wall.map((p) => [p[0], p[1], z0 - 40] as Vec3), [0, 0, -1], { len: 35, dia: 8 }),
        fx("washer", wall.map((p) => [p[0], p[1], z0 + 12] as Vec3), [0, 0, -1], { len: 2, dia: 24 }),
        fx("screw", wall.map((p) => [p[0], p[1], z0 + 14] as Vec3), [0, 0, -1], { len: 50, dia: 5 }),
        fx("cap", wall.map((p) => [p[0], p[1], z0 + 20] as Vec3), [0, 0, -1], { len: 10, dia: 20, included: true }),
      ],
      tools: ["drill", "screwdriver", "level", "pencil"],
      pose: "+y",
      wall: true,
      warnings: ["wall"],
    },
  ];
}

function openCabinet(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = 366;
  const z0 = -D / 2, zf = D / 2;
  const iw = W - 2 * T;
  const zBack = z0 + 10 + BK / 2;
  const parts: CustomPart[] = [
    { id: "B", name: "Bottom", size: [iw, T, D - 2], pos: [0, T / 2, 1], material: "board" },
    { id: "L", name: "Side", size: [T, H, D], pos: [-(W - T) / 2, H / 2, 0], material: "board" },
    { id: "R", name: "Side", size: [T, H, D], pos: [(W - T) / 2, H / 2, 0], material: "board" },
    { id: "K", name: "Back", size: [iw + 16, H - 2 * T + 16, BK], pos: [0, H / 2, zBack], material: "board" },
    { id: "P", name: "Top", size: [iw, T, D - 2], pos: [0, H - T / 2, 1], material: "board" },
  ];
  const shelfY = [1, 2].map((k) => r((H * k) / 3));
  const sd = zf - (zBack + BK / 2) - 4;
  shelfY.forEach((y, i) => parts.push({ id: `S${i}`, name: "Shelf", size: [iw - 4, T, r(sd)], pos: [0, y, r(zf - 2 - sd / 2)], material: "board" }));

  // two cam bolts and three dowels in each end of the bottom and the top
  const ends = (y: number, dy: number) => ({
    bolts: [-1, 1].flatMap((sx) => [z0 + 60, zf - 50].map((z) => [sx * (iw / 2), y, r(z)] as Vec3)),
    dowels: [-1, 1].flatMap((sx) => [z0 + 30, 0, zf - 25].map((z) => [sx * (iw / 2), y + dy, r(z)] as Vec3)),
    cams: [-1, 1].flatMap((sx) => [z0 + 60, zf - 50].map((z) => [sx * (W / 2), y, r(z)] as Vec3)),
  });
  const lo = ends(T / 2, 0), hi = ends(H - T / 2, 0);
  const into = (pts: Vec3[], kind: Kind, o: Partial<CustomFix>, on: string, mate?: (p: Vec3) => string): CustomFix[] =>
    [-1, 1].map((sx) => {
      const mine = pts.filter((p) => Math.sign(p[0]) === sx);
      return fx(kind, mine, [sx, 0, 0], { ...o, on, mate: mate ? mate(mine[0]) : sx < 0 ? "L" : "R" });
    });
  const cams = (pts: Vec3[], mate: string): CustomFix[] =>
    [-1, 1].map((sx) => {
      const mine = pts.filter((p) => Math.sign(p[0]) === sx);
      return fx("cam", mine, [-sx, 0, 0], { on: sx < 0 ? "L" : "R", mate });
    });
  const steps: CustomStep[] = [
    {
      title: "Screw cam bolts into the bottom",
      detail: "Sort the panels first: the sides have the groove for the back. Two cam bolts in each end of the bottom, by hand.",
      add: ["B"],
      fix: into(lo.bolts, "camScrew", {}, "B"),
      tools: ["screwdriver"],
    },
    { title: "Tap in the dowels", detail: "Three in each end of the bottom.", fix: into(lo.dowels, "dowel", { len: 30, dia: 8 }, "B"), tools: ["hammer"] },
    { title: "Lower the sides onto the bottom", detail: "Grooves at the back, facing each other. The cam bolts and dowels go into the holes in their ends.", add: ["L", "R"], from: { L: [0, 300, 0], R: [0, 300, 0] } },
    { title: "Lock the bottom with four cams", detail: "Push the cams into the holes on the sides, arrows to the edge, and turn them clockwise until tight.", fix: cams(lo.cams, "B"), tools: ["screwdriver"] },
    { title: "Slide the back down into the grooves", detail: "Smooth side to the front, all the way down to the bottom.", add: ["K"], from: { K: [0, 500, 0] } },
    {
      title: "Put the top on",
      detail: "Cam bolts and dowels into its ends first, the same as the bottom, then press it down onto the sides.",
      add: ["P"],
      fix: [...into(hi.bolts, "camScrew", {}, "P"), ...into(hi.dowels, "dowel", { len: 30, dia: 8 }, "P")],
      tools: ["screwdriver", "hammer"],
    },
    { title: "Lock the top with four cams", detail: "Turn them clockwise until the joints close up.", fix: cams(hi.cams, "P"), tools: ["screwdriver"] },
    ...hang(H, z0),
    {
      title: "Hook in the shelf supports",
      detail: "Each bent wire goes into a front and a back hole on one side, at the height you want the shelf.",
      fix: shelfY.flatMap((y) => [-1, 1].map((sx) => fx("pin", [[sx * (iw / 2), y - T / 2 - 4, 0]], [-sx, 0, 0], { name: "Shelf support", len: 300, dia: 4, on: sx < 0 ? "L" : "R" }))),
    },
    { title: "Slide in the shelves", detail: "Push each one in over its supports until it stops against the back.", add: ["S0", "S1"], from: { S0: [0, 0, 350], S1: [0, 0, 350] } },
  ];
  return { parts, steps };
}

/** A bottle rail: a strip with two round notches cut in its top edge, as three teeth on a base. */
function rail(w: number, h: number): CustomPart["pieces"] {
  const base = h * 0.45, tooth = h - base, mid = w * 0.24, end = w * 0.12;
  return [
    { shape: "box", size: [w, base, T], pos: [0, -h / 2 + base / 2, 0] },
    { shape: "box", size: [mid, tooth, T], pos: [0, h / 2 - tooth / 2, 0] },
    ...[-1, 1].map((sx) => ({ shape: "box" as const, size: [end, tooth, T] as Vec3, pos: [sx * (w / 2 - end / 2), h / 2 - tooth / 2, 0] as Vec3 })),
  ];
}

/**
 * The 23 cm cabinet as the wine rack (the manual's first build): three shelves and the bottom each get a notched
 * bottle rail on a cam, the shelves stand between the sides with the cabinet on its side, the sides then stand on
 * the bottom with cams, the back slides down, the top goes on with cams, and it hangs like the 20 cm cabinet.
 */
function wineCabinet(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = 366;
  const z0 = -D / 2, zf = D / 2;
  const iw = W - 2 * T;
  const zBack = z0 + 10 + BK / 2;
  const sz0 = z0 + 20, sd = zf - 2 - sz0, szc = r(sz0 + sd / 2);
  const c = (H - 2 * T - 3 * T) / 4; // four equal openings
  const shelfY = [1, 2, 3].map((i) => r(T + i * c + (i - 1) * T + T / 2));
  const RH = 70, zR = zf - 30;
  const parts: CustomPart[] = [];
  shelfY.forEach((y, i) => parts.push({ id: `S${i + 1}`, name: "Shelf", size: [iw, T, r(sd)], pos: [0, y, szc], material: "board" }));
  shelfY.forEach((y, i) => parts.push({ id: `G${i + 1}`, name: "Bottle rail", size: [iw, RH, T], pos: [0, y + T / 2 + RH / 2, zR], material: "board", pieces: rail(iw, RH) }));
  parts.push(
    { id: "L", name: "Side", size: [T, H - 2 * T, D], pos: [-(W - T) / 2, H / 2, 0], material: "board" },
    { id: "R", name: "Side", size: [T, H - 2 * T, D], pos: [(W - T) / 2, H / 2, 0], material: "board" },
    { id: "B", name: "Bottom", size: [W, T, D], pos: [0, T / 2, 0], material: "board" },
    { id: "G0", name: "Bottle rail", size: [iw, RH, T], pos: [0, T + RH / 2, zR], material: "board", pieces: rail(iw, RH) },
    { id: "K", name: "Back", size: [iw + 16, H - 2 * T + 16, BK], pos: [0, H / 2, zBack], material: "board" },
    { id: "P", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0], material: "board" },
  );
  const SHORT_BOLT = { len: 15, dia: 6, name: "Short cam bolt" };
  const DOWEL = { len: 30, dia: 8 };
  const sides = [-1, 1];
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  const ys = [0, 1, 2];
  const ends = (y: number) => sides.flatMap((sx) => [z0 + 60, zf - 60].map((z) => [sx * ((W - T) / 2), y, r(z)] as Vec3));
  const sideCams = (y: number, mate: string): CustomFix[] =>
    sides.map((sx) => fx("cam", [z0 + 60, zf - 60].map((z) => [sx * (W / 2), y, r(z)] as Vec3), [-sx, 0, 0], { on: side(sx), mate }));
  const endDowels = (y: number, dy: number, mate: string): CustomFix[] =>
    sides.map((sx) => fx("dowel", [z0 + 50, 0, zf - 50].map((z) => [sx * ((W - T) / 2), y, r(z)] as Vec3), [0, dy, 0], { ...DOWEL, on: side(sx), mate }));
  const y2 = shelfY[1];

  const steps: CustomStep[] = [
    {
      title: "Screw a short cam bolt into each shelf",
      detail: "Sort the panels first: the sides and the bottom have the groove for the back. One bolt in each shelf, near the front edge, by hand.",
      add: ["S1", "S2", "S3"],
      fix: ys.map((i) => fx("camScrew", [[0, shelfY[i] + T / 2, zR]], [0, -1, 0], { ...SHORT_BOLT, on: `S${i + 1}`, mate: `G${i + 1}` })),
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the ends of the shelves",
      detail: "Two in each end of all three shelves.",
      fix: ys.flatMap((i) => sides.map((sx) => fx("dowel", [-90, 90].map((z) => [sx * (iw / 2), shelfY[i], szc + z] as Vec3), [-sx, 0, 0], { ...DOWEL, on: `S${i + 1}`, mate: side(sx) }))),
      tools: ["hammer"],
    },
    {
      title: "Press a bottle rail onto each shelf",
      detail: "Two dowels in the bottom edge of each rail first, then press it down over the cam bolt, notches up.",
      add: ["G1", "G2", "G3"],
      fix: ys.map((i) => fx("dowel", [-55, 55].map((x) => [x, shelfY[i] + T / 2, zR] as Vec3), [0, 1, 0], { ...DOWEL, on: `G${i + 1}`, mate: `S${i + 1}` })),
      tools: ["hammer"],
    },
    {
      title: "Lock the rails with a cam each",
      detail: "Push the cam into the hole at the back of the rail and turn it clockwise until the rail pulls tight.",
      fix: ys.map((i) => fx("cam", [[0, shelfY[i] + T / 2 + 22, zR - T / 2]], [0, 0, 1], { on: `G${i + 1}` })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw a cam bolt into each side",
      detail: "Into the inside face, at the middle shelf's holes. Then lay the left side flat on a rug, inside up, groove at the back.",
      add: ["L"],
      wait: ["R"],
      fix: sides.map((sx) => fx("camScrew", [[sx * (iw / 2), y2, szc]], [sx, 0, 0], { on: side(sx), mate: "S2" })),
      from: { L: [-350, 0, 0] },
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Stand the shelves in the side and lock the middle one",
      detail: "The middle shelf goes on its cam bolt first, rails to the front edge, and gets a cam. The other two only sit on their dowels.",
      fix: [fx("cam", [[-(iw / 2 - 34), y2 + T / 2, szc]], [0, -1, 0], { on: "S2" })],
      tools: ["screwdriver"],
    },
    {
      title: "Lower the other side on and lock it",
      detail: "Guide all the dowels into its holes, then turn the middle shelf's second cam.",
      add: ["R"],
      fix: [fx("cam", [[iw / 2 - 34, y2 + T / 2, szc]], [0, -1, 0], { on: "S2" })],
      from: { R: [350, 0, 0] },
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the ends of the sides",
      detail: "Three in each end, top and bottom, twelve in all.",
      fix: [...endDowels(T, 1, "B"), ...endDowels(H - T, -1, "P")],
      tools: ["hammer"],
    },
    {
      title: "Fit the last bottle rail on the bottom",
      detail: "A short cam bolt into the bottom near its front edge, two dowels into the rail, then press the rail on and lock it with a cam.",
      add: ["B", "G0"],
      fix: [
        fx("camScrew", [[0, T, zR]], [0, -1, 0], { ...SHORT_BOLT, on: "B", mate: "G0" }),
        fx("dowel", [-55, 55].map((x) => [x, T, zR] as Vec3), [0, 1, 0], { ...DOWEL, on: "G0", mate: "B" }),
        fx("cam", [[0, T + 22, zR - T / 2]], [0, 0, 1], { on: "G0" }),
      ],
      tools: ["screwdriver", "hammer"],
    },
    {
      title: "Screw cam bolts into the bottom and the top",
      detail: "Four in each, two at each end, where the sides will stand.",
      wait: ["P"],
      fix: [
        ...sides.map((sx) => fx("camScrew", ends(T).filter((p) => Math.sign(p[0]) === sx), [0, -1, 0], { on: "B", mate: side(sx) })),
        ...sides.map((sx) => fx("camScrew", ends(H - T).filter((p) => Math.sign(p[0]) === sx), [0, 1, 0], { on: "P", mate: side(sx) })),
      ],
      tools: ["screwdriver"],
      pose: "+y",
    },
    {
      title: "Stand the sides on the bottom and lock them",
      detail: "Lift the sides with the shelves up and lower them onto the bottom's cam bolts and dowels. Four cams through the outside of the sides.",
      fix: sideCams(T + 30, "B"),
      tools: ["screwdriver"],
    },
    { title: "Slide the back down into the grooves", detail: "Smooth side to the front, all the way down into the groove in the bottom.", add: ["K"], from: { K: [0, 600, 0] } },
    {
      title: "Put the top on and lock it",
      detail: "Press it down onto the dowels, then turn four cams through the outside of the sides.",
      add: ["P"],
      fix: sideCams(H - T - 30, "P"),
      tools: ["screwdriver"],
    },
    ...hang(H, z0),
  ];
  return { parts, steps };
}

/**
 * The kitchen island, its own manual. A long back panel runs down the middle with the two oak shelves on its front
 * face (dowels, cam bolts and cams, built with the panel lying flat). Two people stand it on end for the first end
 * frame and turn it upside down onto its top. The back gets a flat worktop rail, a top rail and a bottom rail
 * screwed to the panel; the front gets three rails, each on dowels with a cam at the frame. The second end frame
 * goes on with seven cams, four angle brackets hold the shelves to the front rails, and the feet go in. Upright,
 * the oak worktop goes on dowels and cam bolts, is locked with seven cams and screwed up through the back rail.
 */
function island(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 30; // worktop
  const yT = H - TT; // top of the frame
  const LEG = 45;
  const XB = W / 2 - 20, XI = XB - LEG; // outside and inside of the end frames
  const ZB = D / 2 - 20;
  const zK = -50, KT = 18; // the back panel, a little behind the middle
  const iw = 2 * XI;
  const yS = [229, 549]; // shelf centres
  const sz0 = zK + KT / 2, sz1 = ZB - 20, szc = (sz0 + sz1) / 2;
  const RH = 70, zF = ZB - 10, zTB = -ZB + 10;
  const yF = [185, 505, yT - RH / 2]; // the front rails, bottom to top
  const yBB = 185, zBB = zK - KT / 2 - 10;
  const zTS = -ZB + 20 + 50;
  const fl = 870 / 2;
  const parts: CustomPart[] = [];
  const box = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) => parts.push({ id, name, size: size.map(r) as Vec3, pos: pos.map(r) as Vec3, material: "board", ...o });
  box("K", "Back panel", [iw, yT - 150, KT], [0, (150 + yT) / 2, zK]);
  yS.forEach((y, i) => box(`S${i}`, "Shelf", [iw, 18, sz1 - sz0], [0, y, szc], { material: "wood" }));
  const frame = (sx: number) => {
    const ix = -sx * 11.5; // rails flush with the inside of the legs
    return box(sx < 0 ? "FL" : "FR", "End frame", [LEG, yT, ZB * 2], [sx * (XB - LEG / 2), yT / 2, 0], {
      pieces: [
        ...[-1, 1].map((sz) => ({ shape: "box" as const, size: [LEG, yT, LEG] as Vec3, pos: [0, 0, sz * (ZB - LEG / 2)] as Vec3 })),
        { shape: "box", size: [22, 80, ZB * 2 - 2 * LEG], pos: [ix, yT / 2 - 40, 0] },
        { shape: "box", size: [22, 80, ZB * 2 - 2 * LEG], pos: [ix, 190 - fl, 0] },
        { shape: "box", size: [22, yT - 80 - 230, 40], pos: [ix, (230 + yT - 80) / 2 - fl, zK] },
        { shape: "box", size: [10, yT - 80 - 230, ZB * 2 - 2 * LEG], pos: [ix, (230 + yT - 80) / 2 - fl, 0] },
      ],
    });
  };
  frame(1);
  box("TS", "Worktop rail", [iw, 18, 100], [0, yT - 9, zTS]);
  box("TB", "Back rail", [iw, RH, 20], [0, yT - RH / 2, zTB]);
  box("BB", "Bottom back rail", [iw, RH, 20], [0, yBB, zBB]);
  [2, 1, 0].forEach((i) => box(`F${i}`, "Front rail", [iw, RH, 20], [0, yF[i], zF]));
  frame(-1);
  box("W", "Worktop", [W, TT, D], [0, H - TT / 2, 0], { material: "wood" });

  const DOWEL = { len: 30, dia: 8 };
  const frameOf = (sx: number) => (sx < 0 ? "FL" : "FR");
  // the seven joints at each end frame: one cam bolt in the frame, one cam in the panel or rail
  const joints = (sx: number) => [
    { id: "K", at: [sx * XI, 400, zK] as Vec3, cam: [sx * (XI - 34), 400, zK + KT / 2] as Vec3, dir: [0, 0, -1] as Vec3 },
    ...yS.map((y, i) => ({ id: `S${i}`, at: [sx * XI, y, szc] as Vec3, cam: [sx * (XI - 34), y + 9, szc] as Vec3, dir: [0, -1, 0] as Vec3 })),
    { id: "TB", at: [sx * XI, yT - RH / 2, zTB] as Vec3, cam: [sx * (XI - 34), yT - RH / 2, zTB + 10] as Vec3, dir: [0, 0, -1] as Vec3 },
    ...[0, 1, 2].map((i) => ({ id: `F${i}`, at: [sx * XI, yF[i], zF] as Vec3, cam: [sx * (XI - 34), yF[i], zF - 10] as Vec3, dir: [0, 0, 1] as Vec3 })),
  ];
  const bolts = (sx: number): CustomFix[] => joints(sx).map((j) => fx("camScrew", [j.at], [sx, 0, 0], { on: frameOf(sx), mate: j.id }));
  const cams = (sx: number, ids: string[]): CustomFix[] => joints(sx).filter((j) => ids.includes(j.id)).map((j) => fx("cam", [j.cam], j.dir, { on: j.id }));
  const endDowels = (id: string, pts: [number, number][]): CustomFix[] => [-1, 1].map((sx) => fx("dowel", pts.map(([y, z]) => [sx * XI, y, z] as Vec3), [-sx, 0, 0], { ...DOWEL, on: id, mate: frameOf(sx) }));
  const front = (i: number, title: string, detail: string): CustomStep => ({
    title,
    detail,
    add: [`F${i}`],
    fix: endDowels(`F${i}`, [[yF[i], zF]]),
    // slid in from the open end, along its dowels and onto the frame's cam bolt
    from: { [`F${i}`]: [-320, 0, 0] },
    tools: ["hammer"],
  });
  const brackets: Vec3[] = yS.flatMap((y) => [-300, 300].map((x) => [x, y - 9 - 15, zF - 10 - 12] as Vec3));
  const topDowels: Vec3[] = [
    ...[-450, -150, 150, 450].map((x) => [x, yT, zF] as Vec3),
    ...[-450, -150, 150, 450].map((x) => [x, yT, zTB] as Vec3),
  ];
  const topJoints: { id: string; at: Vec3; cam: Vec3; dir: Vec3 }[] = [
    ...[-400, 0, 400].map((x) => ({ id: "F2", at: [x, yT, zF] as Vec3, cam: [x, yT - 34, zF - 10] as Vec3, dir: [0, 0, 1] as Vec3 })),
    ...[-300, 300].map((x) => ({ id: "K", at: [x, yT, zK] as Vec3, cam: [x, yT - 34, zK + KT / 2] as Vec3, dir: [0, 0, -1] as Vec3 })),
    ...[-300, 300].map((x) => ({ id: "TB", at: [x + 60, yT, zTB] as Vec3, cam: [x + 60, yT - 34, zTB + 10] as Vec3, dir: [0, 0, -1] as Vec3 })),
  ];

  const steps: CustomStep[] = [
    {
      title: "Tap dowels into the ends of the back panel",
      detail: "Lay it flat on a rug, front face up. Three in each short end.",
      add: ["K"],
      fix: endDowels("K", [250, 510, 770].map((y) => [y, zK] as [number, number])),
      tools: ["hammer"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Screw eight cam bolts into the back panel",
      detail: "Into its front face, four in each row of holes for the shelves, by hand until they stop.",
      fix: yS.map((y, i) => fx("camScrew", [-420, -140, 140, 420].map((x) => [x, y, zK + KT / 2] as Vec3), [0, 0, -1], { on: "K", mate: `S${i}` })),
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the shelves",
      detail: "Two in each end and one in the back edge of each shelf. Then turn the shelves over.",
      wait: ["S0", "S1"],
      fix: yS.flatMap((y, i) => [
        ...[-1, 1].map((sx) => fx("dowel", [sz0 + 80, sz1 - 80].map((z) => [sx * XI, y, z] as Vec3), [-sx, 0, 0], { ...DOWEL, on: `S${i}`, mate: frameOf(sx) })),
        fx("dowel", [[0, y, sz0]], [0, 0, 1], { ...DOWEL, on: `S${i}`, mate: "K" }),
      ]),
      tools: ["hammer"],
    },
    {
      title: "Press the shelves onto the back panel",
      detail: "Stand them on their back edges in the two rows of holes and press them right down.",
      add: ["S0", "S1"],
      from: { S0: [0, 0, 300], S1: [0, 0, 300] },
    },
    {
      title: "Lock the shelves with eight cams",
      detail: "Four in each shelf, near its back edge. Turn each clockwise until the shelf pulls tight to the panel.",
      fix: yS.map((y, i) => fx("cam", [-420, -140, 140, 420].map((x) => [x, y + 9, sz0 + 34] as Vec3), [0, -1, 0], { on: `S${i}` })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw seven cam bolts into an end frame",
      detail: "Into the inside of the frame: the back panel, the two shelves, the back rail and the three front rails each meet one.",
      wait: ["FR"],
      fix: bolts(1),
      tools: ["screwdriver"],
    },
    {
      title: "Stand it on end and put the frame on",
      detail: "Two of you lift the panel and shelves onto one end. Lower the frame onto the top end, over the dowels and bolts.",
      add: ["FR"],
      from: { FR: [300, 0, 0] },
      pose: "+x",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Lock the panel and shelves to the frame",
      detail: "Three cams: one in the back panel and one in each shelf.",
      fix: cams(1, ["K", "S0", "S1"]),
      tools: ["screwdriver"],
    },
    {
      title: "Turn it upside down",
      detail: "Two of you tip it over onto the rug so it rests on the top edges, the frame's legs pointing up.",
      pose: "-y",
      people: 2,
      warnings: ["two", "floor"],
    },
    {
      title: "Push in the worktop rail at the back",
      detail: "Two dowels in each end first. It lies flat behind the back panel, level with the top.",
      add: ["TS"],
      fix: endDowels("TS", [[yT - 9, zTS - 25], [yT - 9, zTS + 25]]),
      from: { TS: [-300, 0, 0] },
      tools: ["hammer"],
    },
    {
      title: "Push in the back rail and lock it",
      detail: "A dowel in each end first. It stands on edge along the back, outside the worktop rail. One cam at the frame.",
      add: ["TB"],
      fix: [...endDowels("TB", [[yT - RH / 2, zTB]]), ...cams(1, ["TB"])],
      from: { TB: [-300, 0, 0] },
      tools: ["hammer", "screwdriver"],
    },
    {
      title: "Screw the bottom rail to the back panel",
      detail: "Two short dowels in its face first (not the long ones). Push it against the back of the panel at the floor end and drive three screws through it.",
      add: ["BB"],
      fix: [
        fx("dowel", [-300, 300].map((x) => [x, yBB, zK - KT / 2] as Vec3), [0, 0, -1], { len: 20, dia: 8, name: "Short dowel", on: "BB", mate: "K" }),
        fx("screw", [-400, 0, 400].map((x) => [x, yBB, zBB - 10] as Vec3), [0, 0, 1], { len: 30, dia: 5, on: "BB", mate: "K" }),
      ],
      from: { BB: [0, 0, -300] },
      tools: ["hammer", "screwdriver"],
    },
    front(2, "Push in the top front rail", "Turn it round so the shelves face you. A dowel in each end of the rail, then push it in level with the top."),
    front(1, "Push in the middle front rail", "A dowel in each end. It goes under the front edge of the middle shelf."),
    front(0, "Push in the bottom front rail", "A dowel in each end. It goes under the front edge of the bottom shelf."),
    { title: "Lock the front rails to the frame", detail: "One cam at the end of each rail.", fix: cams(1, ["F0", "F1", "F2"]), tools: ["screwdriver"] },
    {
      title: "Screw seven cam bolts into the other end frame",
      detail: "The same holes as the first frame.",
      wait: ["FL"],
      fix: bolts(-1),
      tools: ["screwdriver"],
    },
    {
      title: "Lower the second frame on",
      detail: "Guide the dowels of the panel, shelves and rails into its holes and press it down evenly.",
      add: ["FL"],
      from: { FL: [-300, 0, 0] },
    },
    {
      title: "Lock everything to the second frame",
      detail: "Seven cams: the back panel, both shelves, the back rail and the three front rails.",
      fix: cams(-1, ["K", "S0", "S1", "TB", "F0", "F1", "F2"]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the shelves to the front rails",
      detail: "Four angle brackets, two under each shelf: one screw into the rail and one into the shelf. Fit them the right way round.",
      fix: [
        fx("angle", brackets, [0, 0, 1], { len: 30, dia: 24, name: "Angle bracket", on: "F0" }),
        fx("screw", brackets.map((p) => [p[0] - 8, p[1] - 6, zF - 10] as Vec3), [0, 0, 1], { len: 12, dia: 4 }),
        fx("screw", brackets.map((p) => [p[0] + 8, p[1] + 15, p[2] - 6] as Vec3), [0, 1, 0], { len: 12, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Push the feet into the legs",
      detail: "One plastic foot pressed into the end of each leg.",
      fix: [-1, 1].map((sx) => fx("glide", [-1, 1].map((sz) => [sx * (XB - LEG / 2), 0, sz * (ZB - LEG / 2)] as Vec3), [0, 1, 0], { name: "Plastic foot", len: 10, dia: 35, on: frameOf(sx) })),
    },
    {
      title: "Stand it up and tap dowels into the top edges",
      detail: "Two of you turn it the right way up. Ten dowels: four along the front rail, four along the back rail and one in each frame.",
      fix: [
        fx("dowel", topDowels.slice(0, 4), [0, -1, 0], { ...DOWEL, on: "F2", mate: "W" }),
        fx("dowel", topDowels.slice(4), [0, -1, 0], { ...DOWEL, on: "TB", mate: "W" }),
        ...[-1, 1].map((sx) => fx("dowel", [[sx * (XI + 11.5), yT, 0]], [0, -1, 0], { ...DOWEL, on: frameOf(sx), mate: "W" })),
      ],
      pose: "+y",
      people: 2,
      tools: ["hammer"],
      warnings: ["two"],
    },
    {
      title: "Screw seven cam bolts into the worktop",
      detail: "Lay it upside down on a rug. Into the holes on its underside, by hand until they stop.",
      wait: ["W"],
      fix: [fx("camScrew", topJoints.map((j) => j.at), [0, 1, 0], { on: "W" })],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the worktop on",
      detail: "Two of you turn it over and lower it onto the dowels and into the cam holes, overhanging evenly all round.",
      add: ["W"],
      from: { W: [0, 400, 0] },
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Lock the worktop with seven cams",
      detail: "Three in the front rail, two in the back panel and two in the back rail.",
      fix: topJoints.map((j) => fx("cam", [j.cam], j.dir, { on: j.id, mate: "W" })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the worktop down at the back",
      detail: "Two screws up through the flat worktop rail into the worktop.",
      fix: [fx("screw", [-400, 400].map((x) => [x, yT - 18, zTS] as Vec3), [0, 1, 0], { len: 30, dia: 5, on: "TS", mate: "W" })],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["TORNVIKEN"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/open-cabinet-20-x/.test(slug)) return openCabinet(s);
    if (/open-cabinet-23-x/.test(slug)) return wineCabinet(s);
    if (/kitchen-island/.test(slug)) return island(s);
    return null;
  },
};
export default family;
