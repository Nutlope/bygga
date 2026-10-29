import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * LANESUND, read from its four manuals. Every piece is built lying on its front on a rug, with connectors already in
 * the panels: the boards hook onto each other through keyhole fittings and are pressed down until they lock. The back
 * panels slide in from the open bottom and are held with clips and push pins, two long screws fix the bottom, then a
 * plinth frame (dowels and cam locks) goes on with brackets, levelling feet and glides. Two people stand it up, it is
 * levelled with the spanner and held to the wall on two adjustable spacers. The glass-door cabinet and the sideboard
 * add glass doors on pin hinges, door stops, bumpers and bar handles; the sideboard hangs two drawers from battens
 * under its top. The TV bench is open at the back: two rails between the sides, locked with cam locks, and a slotted
 * bracket on the wall instead of spacers.
 */

type Kind = "bookcase" | "cabinet" | "sideboard" | "tv";

const T = 20; // carcass boards
const TOP = 25; // the moulded top
const PL = 80; // plinth
const PR = 18; // plinth rails
const DOOR = 20;

interface Geo {
  kind: Kind;
  W: number;
  H: number;
  D: number;
  Wc: number; // carcass, outside the sides
  Wp: number; // plinth
  zb: number; // back edge of the boards, in front of the back panels
  zf: number; // front edge of the sides
  zi: number; // front edge of the shelves, behind the doors
  cols: number;
  colW: number;
  colX: (c: number) => number; // middle of a column
  y0: number; // top of the bottom board
  y1: number; // underside of the top
}

function geoOf(s: ProductSpec, kind: Kind): Geo {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const Wc = W - 30;
  const cols = kind === "tv" ? 3 : 2;
  const colW = (Wc - 2 * T - (cols - 1) * T) / cols;
  const colX = (c: number) => -Wc / 2 + T + colW / 2 + c * (colW + T);
  const zf = D / 2 - 20;
  return { kind, W, H, D, Wc, Wp: Wc + 10, zb: -D / 2 + 10, zf, zi: zf - DOOR - 4, cols, colW, colX, y0: PL + T, y1: H - TOP };
}

/** A glass door: a slim dark frame round a pane. */
function doorPart(id: string, w: number, h: number, pos: Vec3): CustomPart {
  const f = 34;
  const pieces: PartPiece[] = [
    { shape: "box", size: [f, h, DOOR], pos: [-w / 2 + f / 2, 0, 0], material: "metal" },
    { shape: "box", size: [f, h, DOOR], pos: [w / 2 - f / 2, 0, 0], material: "metal" },
    { shape: "box", size: [w - 2 * f, f, DOOR], pos: [0, h / 2 - f / 2, 0], material: "metal" },
    { shape: "box", size: [w - 2 * f, f, DOOR], pos: [0, -h / 2 + f / 2, 0], material: "metal" },
    { shape: "box", size: [w - 2 * f, h - 2 * f, 4], pos: [0, 0, 0], material: "glass" },
  ];
  return { id, name: "Glass door", size: [w, h, DOOR], pos, material: "glass", pieces };
}

interface Door {
  id: string;
  hs: number; // -1 hinged on its left, 1 on its right
  wallX: number; // the inner face it hangs on
  x0: number;
  x1: number;
}

function recipe(s: ProductSpec, kind: Kind): CustomParams {
  const g = geoOf(s, kind);
  const { W, H, D, Wc, Wp, zb, zf, zi, cols, colW, colX, y0, y1 } = g;
  const tv = kind === "tv";
  const sideboard = kind === "sideboard";
  const tall = kind === "bookcase" || kind === "cabinet";
  const parts: CustomPart[] = [];
  const part = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) => parts.push({ id, name, size, pos, material: "board", ...o });
  const xs = Wc / 2 - T / 2;
  const inH = y1 - y0;

  // carcass
  part("top", "Top", [W, TOP, D], [0, H - TOP / 2, 0]);
  for (const [id, sx] of [["sL", -1], ["sR", 1]] as const) part(id, "Side panel", [T, H - TOP - PL, zf + D / 2], [sx * xs, PL + (H - TOP - PL) / 2, (zf - D / 2) / 2]);
  part("bot", "Bottom", [Wc - 2 * T, T, zf - zb], [0, PL + T / 2, (zf + zb) / 2]);
  const divX = (k: number) => colX(k) + colW / 2 + T / 2;
  const divs = Array.from({ length: cols - 1 }, (_, k) => `dv${k}`);
  // the dividers stop behind the doors where the doors meet over them
  divs.forEach((id, k) => part(id, "Divider", [T, inH, zf - zb], [divX(k), y0 + inH / 2, (zf + zb) / 2]));
  const yMid = y0 + inH / 2;
  const fixed = tall ? Array.from({ length: cols }, (_, c) => `fx${c}`) : [];
  fixed.forEach((id, c) => part(id, "Fixed shelf", [colW, T, zi - zb], [colX(c), yMid, (zi + zb) / 2]));
  const backs = tv ? [] : Array.from({ length: cols }, (_, c) => `bk${c}`);
  backs.forEach((id, c) => part(id, "Back panel", [colW + T, H - TOP - PL - 4, 4], [colX(c), PL + 2 + (H - TOP - PL - 4) / 2, -D / 2 + 7], { material: "fiber" }));
  const rails = tv ? ["rU", "rL"] : [];
  if (tv) {
    part("rU", "Back rail", [Wc - 2 * T, 80, T], [0, y1 - 40, zb + T / 2 - 10]);
    part("rL", "Back rail", [Wc - 2 * T, 80, T], [0, y0 + 40, zb + T / 2 - 10]);
  }
  // battens under the sideboard's top: the drawers hang from them
  const battens = sideboard ? ["bt0", "bt1", "bt2", "bt3"] : [];
  const btX = [-(Wc / 2 - T - 15), divX(0) - T / 2 - 15, divX(0) + T / 2 + 15, Wc / 2 - T - 15];
  battens.forEach((id, i) => part(id, "Drawer batten", [30, 30, zi - zb - 20], [btX[i], y1 - 15, (zi + zb) / 2 - 10], { material: "wood" }));

  // plinth
  const zpf = zf + 5, zpb = -D / 2;
  part("pF", "Long plinth rail", [Wp, PL, PR], [0, PL / 2, zpf - PR / 2]);
  part("pB", "Long plinth rail", [Wp, PL, PR], [0, PL / 2, zpb + PR / 2]);
  for (const [id, sx] of [["pL", -1], ["pR", 1]] as const) part(id, "Short plinth rail", [PR, PL, zpf - zpb - 2 * PR], [sx * (Wp / 2 - PR / 2), PL / 2, (zpf + zpb) / 2]);

  // shelves on supports
  const shelfD = zi - zb - 6;
  const shelves: { id: string; c: number; y: number; glass?: boolean }[] = [];
  const yDrawer = y1 - 130; // the sideboard's drawers take the top of each column
  for (let c = 0; c < cols; c++) {
    if (tall) {
      shelves.push({ id: `sh${c}a`, c, y: y0 + (yMid - T / 2 - y0) / 2 });
      shelves.push({ id: `sh${c}b`, c, y: yMid + T / 2 + (y1 - yMid - T / 2) / 2, glass: kind === "cabinet" });
    } else shelves.push({ id: `sh${c}`, c, y: sideboard ? y0 + (yDrawer - y0) / 2 : y0 + inH / 2 });
  }
  for (const sh of shelves) part(sh.id, sh.glass ? "Glass shelf" : "Shelf", [colW - 4, sh.glass ? 6 : 18, shelfD], [colX(sh.c), sh.y, zb + 3 + shelfD / 2], sh.glass ? { material: "glass" } : {});

  // the sideboard's drawers: a front, two sides, a back and a hardboard bottom each
  const drawers = sideboard ? [0, 1] : [];
  const dw = colW - 40, dh = 110, dd = zi - zb - 30;
  const dzF = zi - 2 - T / 2; // middle of the drawer front
  const dL = dd - T; // drawer sides, behind the front
  const dzB = dzF - T / 2 - dL; // back end of the box
  const dyB = y1 - 15 - dh; // bottom of the drawer box
  for (const c of drawers) {
    const x = colX(c);
    part(`df${c}`, "Drawer front", [dw + 20, dh + 10, T], [x, dyB + dh / 2, dzF]);
    const zs = dzB + dL / 2;
    part(`dsL${c}`, "Drawer side", [14, dh, dL], [x - dw / 2 + 7, dyB + dh / 2, zs]);
    part(`dsR${c}`, "Drawer side", [14, dh, dL], [x + dw / 2 - 7, dyB + dh / 2, zs]);
    part(`db${c}`, "Drawer bottom", [dw - 28, 3, dL - 14], [x, dyB + 10, zs + 7], { material: "fiber" });
    part(`dk${c}`, "Drawer back", [dw - 28, dh - 20, 14], [x, dyB + 12 + (dh - 20) / 2, dzB + 7]);
  }

  // doors
  const doors: Door[] = [];
  const openX = (c: number): [number, number] => [colX(c) - colW / 2, colX(c) + colW / 2];
  if (kind === "cabinet") {
    doors.push({ id: "d0", hs: -1, wallX: openX(0)[0], x0: openX(0)[0], x1: openX(0)[1] });
    doors.push({ id: "d1", hs: 1, wallX: openX(1)[1], x0: openX(1)[0], x1: openX(1)[1] });
  } else if (sideboard) {
    for (let c = 0; c < 2; c++) {
      const [a, b] = openX(c);
      doors.push({ id: `d${c}a`, hs: -1, wallX: a, x0: a, x1: (a + b) / 2 });
      doors.push({ id: `d${c}b`, hs: 1, wallX: b, x0: (a + b) / 2, x1: b });
    }
  } else if (tv) {
    doors.push({ id: "d0", hs: -1, wallX: openX(0)[0], x0: openX(0)[0], x1: openX(0)[1] });
    doors.push({ id: "d2", hs: 1, wallX: openX(2)[1], x0: openX(2)[0], x1: openX(2)[1] });
  }
  const dy0 = y0 + 2, dy1 = y1 - 2;
  for (const d of doors) parts.push(doorPart(d.id, d.x1 - d.x0 - 4, dy1 - dy0, [(d.x0 + d.x1) / 2, (dy0 + dy1) / 2, zf - DOOR / 2]));

  // ---------- fittings ----------
  const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
  const spread = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));
  const zBack = -D / 2 + 5;
  const pins = (pts: Vec3[], on?: string): CustomFix[] => [
    fix("plug", pts, [0, 0, 1], { name: "Plastic sleeve", included: true, len: 12, dia: 8, on }),
    fix("cap", pts, [0, 0, 1], { name: "Push pin", len: 12, dia: 12 }),
  ];
  const backPins: Vec3[] = backs.flatMap((_, c) => [
    ...[-1, 1].map((k) => [colX(c) + (k * colW) / 4, PL + T / 2, zBack] as Vec3),
    ...(tall ? [-1, 1].map((k) => [colX(c) + (k * colW) / 4, yMid, zBack] as Vec3) : []),
  ]);
  const lines = [-xs, ...divs.map((_, k) => divX(k)), xs];
  const nClip = tall ? 6 : 4;
  const clipPts: Vec3[] = lines.flatMap((x) => spread(PL + 120, H - TOP - 120, nClip).map((y) => [x, y, zBack] as Vec3));
  const longScrewFix: CustomFix[] = [-1, 1].map((sx) => fix("screw", [[sx * (Wc / 2), PL + T / 2, (zb + zf) / 2]], [-sx, 0, 0], { name: "Connector screw", len: 50, dia: 7, on: sx < 0 ? "sL" : "sR", mate: "bot" }));
  const spacerAt: Vec3[] = [-1, 1].map((sx) => [sx * xs, y1 - 40, -D / 2] as Vec3);

  // plinth fittings
  const xe = Wp / 2 - PR / 2;
  const zIn = (z: number, sz: number) => z - sz * PR; // inner face of a long rail
  const dowelEnds: CustomFix[] = [-1, 1].flatMap((sx) =>
    [-1, 1].map((sz): CustomFix => ({ kind: "dowel", count: 1, len: 30, dia: 8, at: [[sx * xe, PL / 2 + 20, sz > 0 ? zIn(zpf, 1) : zIn(zpb, -1)]], dir: [0, 0, sz], on: sx < 0 ? "pL" : "pR", mate: sz > 0 ? "pF" : "pB" })),
  );
  const camBolts: CustomFix[] = [
    fix("camScrew", [-1, 1].map((sx) => [sx * xe, PL / 2 - 15, zIn(zpf, 1)] as Vec3), [0, 0, 1], { on: "pF", len: 34 }),
    fix("camScrew", [-1, 1].map((sx) => [sx * xe, PL / 2 - 15, zIn(zpb, -1)] as Vec3), [0, 0, -1], { on: "pB", len: 34 }),
  ];
  const cams = (sz: number): CustomFix[] => [-1, 1].map((sx) => fix("cam", [[sx * (Wp / 2 - PR), PL / 2 - 15, sz > 0 ? zIn(zpf, 1) - 30 : zIn(zpb, -1) + 30]], [-sx, 0, 0], { on: sx < 0 ? "pL" : "pR", dia: 15 }));
  const topDowels = fix(
    "dowel",
    [...spread(-Wp / 2 + 80, Wp / 2 - 80, 4).map((x) => [x, PL, zpf - PR / 2] as Vec3), ...spread(-Wp / 2 + 80, Wp / 2 - 80, 4).map((x) => [x, PL, zpb + PR / 2] as Vec3)],
    [0, -1, 0],
    { len: 30, dia: 8, mate: "bot" },
  );
  const brX = spread(-Wp / 2 + 200, Wp / 2 - 200, 3);
  const brackets: Vec3[] = [...brX.map((x) => [x, PL - 20, zIn(zpf, 1)] as Vec3), ...[-1, 1].map((k) => [k * Wp * 0.25, PL - 20, zIn(zpb, -1)] as Vec3)];
  const bracketFix: CustomFix[] = [
    fix("angle", brackets, [0, 0, 1], { name: "Plinth bracket", len: 40, dia: 30 }),
    ...pins(brackets.map((p) => [p[0], p[1] - 8, p[2]] as Vec3)),
  ];
  const bracketTop: CustomFix[] = pins(brackets.map((p) => [p[0], PL, p[2] + (p[2] > 0 ? -20 : 20)] as Vec3)).map((f) => ({ ...f, dir: [0, 1, 0] as Vec3, mate: "bot" }));
  const feet = fix("foot", [[-Wp / 2 + 50, 0, zpf - 40], [Wp / 2 - 50, 0, zpf - 40], [0, 0, zpb + 40]], [0, 1, 0], { name: "Levelling foot", len: 30, dia: 24 });
  const glides = fix("glide", [[-Wp / 2 + 50, 0, zpb + 40], [Wp / 2 - 50, 0, zpb + 40], [0, 0, zpf - 40]], [0, 1, 0], { name: "Glide", len: 6, dia: 20 });

  // shelf supports: two on each wall of the column, under the front and back of the shelf
  const supports = (list: typeof shelves): CustomFix[] =>
    list.flatMap((sh) =>
      [-1, 1].map((sx) =>
        fix(
          "pin",
          [zb + 40, zb + shelfD - 30].map((z) => [colX(sh.c) + (sx * colW) / 2, sh.y - (sh.glass ? 3 : 9) - 5, z] as Vec3),
          [sx, 0, 0],
          { name: "Shelf support", len: 16, dia: 10 },
        ),
      ),
    );

  // ---------- steps ----------
  const steps: CustomStep[] = [];
  const push = (st: CustomStep) => steps.push(st);
  const chunk = (st: CustomStep, fixes: CustomFix[]) => {
    for (let i = 0; i < fixes.length; i += 10) push({ ...st, fix: fixes.slice(i, i + 10), add: i ? [] : st.add });
  };
  const keyhole = "The connectors are already in the panels: push the pegs into the keyholes, then press down until it locks.";

  if (tall) {
    push({ title: "Hook a fixed shelf onto the divider", detail: `Stand the divider on its long edge on a rug. ${keyhole}`, add: ["dv0", "fx0"], pose: "-z", warnings: ["floor"] });
    push({ title: "Hook the other fixed shelf onto a side", detail: "The same way, on the side with the holes facing in.", add: ["sR", "fx1"] });
    push({ title: "Join them to the other side", detail: "Hook the free end of each fixed shelf into the side and the divider next to it.", add: ["sL"] });
    push({ title: "Hook the top on together", detail: "One of you holds the panels upright while the other lowers the top onto their ends.", add: ["top"], people: 2, warnings: ["two"] });
    push({ title: "Hook the bottom on", detail: "Onto the other ends of the sides and the divider.", add: ["bot"] });
  } else if (sideboard) {
    push({
      title: "Screw the battens under the top",
      detail: "Lay the top upside down on a rug. Three screws through each batten, grooves facing the way the drawings show.",
      add: ["top", ...battens],
      fix: [fix("screw", battens.flatMap((id, i) => spread(zb + 40, zi - 60, 3).map((z) => [btX[i], y1 - 30, z] as Vec3)), [0, 1, 0], { len: 30, dia: 4, to: ["top"] })],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    });
    push({ title: "Hook a side onto the top", detail: `Stand the top on its back edge. ${keyhole}`, add: ["sR"], pose: "-z" });
    push({ title: "Hook on the other side", detail: "The same way at the other end.", add: ["sL"] });
    push({ title: "Hook the divider into the middle", detail: "Between the two middle battens.", add: divs });
    push({ title: "Hook the bottom on together", detail: "One of you holds the frame while the other presses the bottom onto the sides and the divider.", add: ["bot"], people: 2, warnings: ["two"] });
  } else {
    push({ title: "Hook the dividers onto the top", detail: `Lay the top upside down on a rug, then stand the dividers on it. ${keyhole}`, add: ["top", ...divs], pose: "-y", warnings: ["floor"] });
    push({ title: "Screw the cam bolts into the sides", detail: "Four into the inside face of each side, by hand until they stop.", fix: [-1, 1].map((sx) => fix("camScrew", [y1 - 25, y1 - 55, y0 + 25, y0 + 55].map((y) => [sx * (Wc / 2 - T), y, zb + 10] as Vec3), [-sx, 0, 0], { on: sx < 0 ? "sL" : "sR", len: 34 })), tools: ["screwdriver"] });
    push({ title: "Tap a dowel into each end of the rails", detail: "One dowel in the middle hole of each end.", fix: [-1, 1].flatMap((sx) => rails.map((id) => fix("dowel", [[sx * (Wc / 2 - T), id === "rU" ? y1 - 40 : y0 + 40, zb + T / 2 - 10]], [sx, 0, 0], { on: id, len: 30, dia: 8 }))), tools: ["hammer"] });
    push({
      title: "Join the rails to the sides",
      detail: "Rails into one side, two cam locks at each end, then the other side onto their free ends. Turn each lock clockwise.",
      add: ["sL", "sR"],
      fix: [-1, 1].flatMap((sx) => rails.map((id) => fix("cam", [-20, 20].map((dy) => [sx * (Wc / 2 - T - 30), (id === "rU" ? y1 - 40 : y0 + 40) + dy, zb + T - 10] as Vec3), [0, 0, -1], { on: id, dia: 15 }))),
      tools: ["screwdriver"],
      pose: "-z",
    });
    push({ title: "Lay the frame over the top together", detail: "Turn the sides and rails over and lower them onto the top, the dividers between the rails.", people: 2, warnings: ["two"] });
    push({ title: "Hook the bottom on together", detail: `Onto the ends of the sides and the dividers. ${keyhole}`, add: ["bot"], people: 2 });
    push({ title: "Screw the top to the upper rail", detail: "Eight screws with the Allen key, down through the rail into the top.", fix: [fix("screw", spread(-Wc / 2 + 120, Wc / 2 - 120, 8).map((x) => [x, y1 - 80, zb - 10 + T / 2] as Vec3), [0, 1, 0], { on: "rU", mate: "top", len: 30, dia: 6 })], tools: ["allen"] });
    push({ title: "Fix the lower rail to the bottom", detail: "One bracket in the middle, a sleeve and a push pin into each part.", fix: [fix("angle", [[0, y0 + 10, zb + 10]], [0, -1, 0], { name: "Plinth bracket", len: 40, dia: 30 }), ...pins([[0, y0 + 2, zb + 15]]).map((f) => ({ ...f, dir: [0, -1, 0] as Vec3 })), ...pins([[0, y0 + 30, zb + 4]])] });
  }

  if (backs.length) {
    push({ title: "Slide the back panels in", detail: "Into the grooves from the open bottom end, smooth side facing in, until they reach the top.", add: backs, from: Object.fromEntries(backs.map((id) => [id, [0, -Math.min(700, H * 0.6), 0] as Vec3])), pose: "-z" });
    push({ title: "Push pins through the back", detail: `A plastic sleeve into each of the ${backPins.length} holes, then a pin pressed into it.`, fix: pins(backPins) });
    push({
      title: "Clip the back panels in",
      detail: `${clipPts.length} clips along the edges of the back, each with its wedge pushed in until it holds.`,
      fix: [fix("clip", clipPts, [0, 0, 1], { name: "Back clip", len: 20, dia: 14 }), fix("cap", clipPts, [0, 0, 1], { name: "Clip wedge", len: 8, dia: 12 })],
    });
    push({ title: "Screw the sides to the bottom", detail: "One long screw through each side into the end of the bottom, with the Allen key.", fix: longScrewFix, tools: ["allen"] });
  }
  if (tall) push({ title: "Screw in the wall spacer bases", detail: "Into the back edge of each side, just under the top.", fix: [fix("connector", spacerAt, [0, 0, 1], { name: "Wall spacer base", len: 25, dia: 40 })] });

  // plinth
  push({ title: "Tap dowels into the short plinth rails", detail: "One into each end, on a rug.", add: ["pL", "pR"], fix: dowelEnds, tools: ["hammer"], warnings: ["floor"] });
  push({ title: "Screw cam bolts into the long rails", detail: "One near each end, by hand.", fix: camBolts, tools: ["screwdriver"] });
  push({ title: "Join the front rail and lock it", detail: "Press it onto the dowels of both short rails and turn the two cam locks clockwise.", add: ["pF"], fix: cams(1), tools: ["screwdriver"] });
  push({ title: "Join the back rail and lock it", detail: "The same at the other side of the frame.", add: ["pB"], fix: cams(-1), tools: ["screwdriver"] });
  push({ title: "Tap dowels into the top of the plinth", detail: "Eight along the top edges of the long rails.", fix: [topDowels], tools: ["hammer"] });
  push({ title: "Fit the plinth onto the bottom", detail: "Line the dowels up with the holes and press it on.", kind: "join" });
  push({ title: "Fix the plinth with the brackets", detail: "Five brackets inside the plinth: a sleeve and a pin through each into the rail.", fix: bracketFix });
  push({ title: "Pin the brackets to the bottom", detail: "Another sleeve and pin through each bracket, up into the bottom.", fix: bracketTop });
  push({ title: "Screw in the levelling feet", detail: "Three, into the plinth, by hand.", fix: [feet] });
  push({ title: "Press in the glides", detail: "Their two pegs go into the holes on the underside of the plinth.", fix: [glides] });
  if (sideboard) push({ title: "Screw in the wall spacer bases", detail: "Into the back edge of each side, just under the top.", fix: [fix("connector", spacerAt, [0, 0, 1], { name: "Wall spacer base", len: 25, dia: 40 })] });
  push({ title: "Stand it up together", detail: "Lift it upright between you, don't drag it up by one end.", pose: "+y", people: 2, warnings: ["two"] });
  push({ title: "Level it", detail: "Set it where it will stand and turn the feet with the spanner until a level on top reads true.", tools: ["wrench", "level"] });

  // wall
  if (tv) {
    const at: Vec3[] = [-1, 1].map((sx) => [sx * (Wc / 2 - 200), y1 - 1, -D / 2 + 30] as Vec3);
    push({
      title: "Screw the wall brackets under the top",
      detail: "Two slotted brackets at the back, a washer under each screw.",
      fix: [fix("angle", at, [0, 1, 0], { name: "Wall bracket", len: 60, dia: 30, on: "top" }), fix("washer", at.map((p) => [p[0], p[1] - 4, p[2]] as Vec3), [0, 1, 0]), fix("screw", at.map((p) => [p[0], p[1] - 5, p[2]] as Vec3), [0, 1, 0], { len: 16, dia: 4, on: "top" })],
      tools: ["screwdriver"],
    });
    const wall: Vec3[] = at.map((p) => [p[0], p[1] - 30, -D / 2 - 2]);
    push({
      title: "Screw it to the wall",
      detail: "Slide each bracket out to the wall, mark, drill and screw through the slot with a washer. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [fix("plug", wall.map((p) => [p[0], p[1], p[2] - 40] as Vec3), [0, 0, -1], { len: 35, dia: 8 }), fix("washer", wall, [0, 0, -1]), fix("screw", wall.map((p) => [p[0], p[1], p[2] + 1] as Vec3), [0, 0, -1], { len: 50, dia: 5 })],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    });
  } else {
    push({ title: "Screw the spacers onto their bases", detail: "One on each base at the back, by hand.", fix: [fix("spacer", spacerAt.map((p) => [p[0], p[1], p[2] - 26] as Vec3), [0, 0, 1], { name: "Wall spacer", len: 25, dia: 34 })] });
    push({ title: "Turn the spacers out to the wall", detail: "Push it back against the wall, then turn each spacer until it touches. They bridge the skirting board so it stands straight." });
    const wall: Vec3[] = spacerAt.map((p) => [p[0], p[1], p[2] - 52]);
    push({
      title: "Screw it to the wall",
      detail: "One screw with a washer through each spacer. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [fix("plug", wall.map((p) => [p[0], p[1], p[2] - 40] as Vec3), [0, 0, -1], { len: 35, dia: 8 }), fix("washer", wall, [0, 0, -1], { len: 2, dia: 20 }), fix("screw", wall.map((p) => [p[0], p[1], p[2] + 1] as Vec3), [0, 0, -1], { len: 50, dia: 5 })],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    });
  }
  if (tv) {
    const stops = doors.map((d): Vec3 => [d.hs < 0 ? d.x1 - 30 : d.x0 + 30, y1 - 10, zf - DOOR - 12]);
    push({ title: "Screw in the door stops", detail: "One under the top behind the free edge of each door opening.", fix: [fix("angle", stops, [0, 1, 0], { name: "Door stop", len: 30, dia: 20 }), fix("screw", stops.map((p) => [p[0], y1 - 2, p[2] - 24] as Vec3), [0, 1, 0], { len: 12, dia: 4 })], tools: ["screwdriver"] });
  }

  // shelves
  const wood = shelves.filter((sh) => !sh.glass), glass = shelves.filter((sh) => sh.glass);
  chunk({ title: "Push in the shelf supports", detail: `${shelves.length * 4} supports, four for each shelf, at the same height on both walls.` }, supports(shelves));
  push({ title: wood.length > 1 ? "Lay the shelves on" : "Lay the shelf on", detail: "Each one rests on its four supports, the notches over them.", add: wood.map((sh) => sh.id) });
  if (glass.length) push({ title: "Lay the glass shelves on", detail: "Into the upper compartments. Lower them gently onto the supports.", add: glass.map((sh) => sh.id), warnings: ["hand"] });

  // drawers
  if (drawers.length) {
    const both = <T,>(f: (c: number, x: number) => T[]) => drawers.flatMap((c) => f(c, colX(c)));
    const sideOf = (c: number, sx: number) => (sx < 0 ? `dsL${c}` : `dsR${c}`);
    push({
      title: "Screw the cam bolts into the drawer fronts",
      detail: "Lay both fronts face down on a rug. Four bolts into the back of each, by hand.",
      fix: drawers.map((c) => fix("camScrew", [-1, 1].flatMap((sx) => [-25, 25].map((dy) => [colX(c) + sx * (dw / 2 - 7), dyB + dh / 2 + dy, dzF - T / 2] as Vec3)), [0, 0, 1], { on: `df${c}`, len: 34 })),
      tools: ["screwdriver"],
    });
    push({ title: "Stand the drawer sides on the bolts", detail: "Two sides on each front, the grooves facing in.", add: both((c) => [`dsL${c}`, `dsR${c}`]) });
    push({ title: "Lock the cams in the sides", detail: "Two in each side, turned clockwise.", fix: both((c, x) => [-1, 1].map((sx) => fix("cam", [-25, 25].map((dy) => [x + sx * (dw / 2 - 14), dyB + dh / 2 + dy, dzF - T / 2 - 30] as Vec3), [sx, 0, 0], { on: sideOf(c, sx), dia: 15 }))), tools: ["screwdriver"] });
    push({ title: "Slide in the drawer bottoms", detail: "Into the grooves in the sides and front.", add: both((c) => [`db${c}`]), from: Object.fromEntries(drawers.map((c) => [`db${c}`, [0, 0, -300] as Vec3])) });
    push({
      title: "Screw on the drawer backs",
      detail: "Lay each back over its bottom, then two long screws through each side into it.",
      add: both((c) => [`dk${c}`]),
      fix: both((c, x) => [-1, 1].map((sx) => fix("screw", [-30, 0].map((dy) => [x + sx * (dw / 2), dyB + dh / 2 + dy, dzB + 7] as Vec3), [-sx, 0, 0], { on: sideOf(c, sx), mate: `dk${c}`, len: 40, dia: 4 }))),
      tools: ["screwdriver"],
    });
    push({ title: "Screw in the drawer stops", detail: "One screw near the back of each side. Leave its head standing out: it stops the drawer.", fix: both((c, x) => [-1, 1].map((sx) => fix("screw", [[x + sx * (dw / 2), dyB + dh - 15, dzB + 30]], [-sx, 0, 0], { name: "Stop screw", len: 12, dia: 5, on: sideOf(c, sx) }))), tools: ["screwdriver"] });
    push({ title: "Slide the drawers in", detail: "Their sides run in the grooves of the battens under the top. Push them in until they stop." });
  }

  // doors
  if (doors.length) {
    const hy = [dy0 + 110, dy1 - 110];
    const hingeFix: CustomFix[] = [];
    const doorScrews: Vec3[] = [], wallScrews: { p: Vec3; hs: number }[] = [];
    for (const d of doors) {
      hingeFix.push(fix("hinge", hy.map((y) => [d.wallX, y, zf - DOOR - 4] as Vec3), [d.hs, 0, 0], { on: d.id, len: 60, dia: 30 }));
      for (const y of hy) {
        for (const dy of [-16, 16]) {
          doorScrews.push([d.wallX - d.hs * 22, y + dy, zf - DOOR]);
          wallScrews.push({ p: [d.wallX, y + dy, zf - DOOR - 22], hs: d.hs });
        }
      }
    }
    const nD = doors.length;
    push({
      title: nD > 1 ? "Screw the hinges onto the doors" : "Screw the hinges onto the door",
      detail: "Lay each door face down on a rug. Two hinges on its back by the hinge edge, two screws in each. Use the screws marked for the doors.",
      add: doors.map((d) => d.id),
      fix: [...hingeFix.slice(0, 8), fix("screw", doorScrews, [0, 0, 1], { name: "Hinge screw", len: 12, dia: 5 })],
      tools: ["screwdriver"],
      from: Object.fromEntries(doors.map((d) => [d.id, [0, 0, 420] as Vec3])),
    });
    const wl = wallScrews.filter((w) => w.hs < 0), wr = wallScrews.filter((w) => w.hs > 0);
    push({
      title: nD > 1 ? "Hang the doors together" : "Hang the door together",
      detail: "One of you holds the door in place while the other screws each hinge to the inside of the cabinet.",
      fix: [fix("screw", wl.map((w) => w.p), [-1, 0, 0], { name: "Hinge screw", len: 12, dia: 5 }), fix("screw", wr.map((w) => w.p), [1, 0, 0], { name: "Hinge screw", len: 12, dia: 5 })].filter((f) => f.count),
      tools: ["screwdriver"],
      people: 2,
      warnings: ["two"],
    });
    if (!tv) {
      // the cabinet has a stop above and below each door, the sideboard one on the bottom
      const stops: Vec3[] = doors.flatMap((d) => (tall ? [y1 - 10, y0 + 10] : [y0 + 10]).map((y) => [d.hs < 0 ? d.x1 - 30 : d.x0 + 30, y, zf - DOOR - 12] as Vec3));
      const tops = stops.filter((p) => p[1] > yMid), bots = stops.filter((p) => p[1] < yMid);
      push({
        title: "Screw in the door stops",
        detail: tall ? "Under the top and on the bottom, behind the free edge of each door." : "On the bottom, behind the free edge of each door.",
        fix: [
          fix("angle", tops, [0, 1, 0], { name: "Door stop", len: 30, dia: 20 }),
          fix("angle", bots, [0, -1, 0], { name: "Door stop", len: 30, dia: 20 }),
          fix("screw", tops.map((p) => [p[0], y1 - 2, p[2] - 24] as Vec3), [0, 1, 0], { len: 12, dia: 4 }),
          fix("screw", bots.map((p) => [p[0], y0 + 2, p[2] - 24] as Vec3), [0, -1, 0], { len: 12, dia: 4 }),
        ],
        tools: ["screwdriver"],
      });
    }
    const bump: Vec3[] = doors.flatMap((d) => (tall ? [dy1 - 30, dy0 + 30] : [dy1 - 30]).map((y) => [d.hs < 0 ? d.x1 - 30 : d.x0 + 30, y, zf - DOOR] as Vec3));
    push({
      title: tall ? "Screw the bumpers into the doors" : nD > 1 ? "Screw a bumper into each door" : "Screw a bumper into the door",
      detail: tall ? "On the back, at the top and bottom corners of the free edge. Turn until it stops, don't overtighten." : "On the back, at the top corner of the free edge. Turn until it stops, don't overtighten.",
      fix: [fix("washer", bump, [0, 0, 1], { name: "Bumper", len: 6, dia: 12 }), fix("screw", bump.map((p) => [p[0], p[1], p[2] - 1] as Vec3), [0, 0, 1], { len: 16, dia: 4 })],
      tools: ["screwdriver"],
    });
    const hx = (d: Door) => (d.hs < 0 ? d.x1 - 17 : d.x0 + 17); // on the frame stile, not the glass
    const hdY = dy0 + (dy1 - dy0) * (tall ? 0.48 : 0.5);
    push({
      title: nD > 1 ? "Screw on the handles" : "Screw on the handle",
      detail: "Two screws from the back of each door into its handle.",
      fix: [
        ...doors.map((d) => fix("handle", [[hx(d), hdY, zf]], [0, 0, -1], { on: d.id, len: Math.min(200, (dy1 - dy0) * 0.35), dia: 14, twist: Math.PI / 2 })),
        fix("screw", doors.flatMap((d) => [-60, 60].map((dy) => [hx(d), hdY + dy, zf - DOOR] as Vec3)), [0, 0, 1], { len: 30, dia: 4 }),
      ],
      tools: ["screwdriver"],
    });
    push({ title: "Line up the doors", detail: "If the gaps aren't even, turn the levelling feet with the spanner until the doors meet straight." });
  }
  return { parts, steps };
}

const family: Family = {
  names: ["LANESUND"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/lanesund-bookcase/.test(slug)) return recipe(s, "bookcase");
    if (/lanesund-glass-door-cabinet/.test(slug)) return recipe(s, "cabinet");
    if (/lanesund-sideboard/.test(slug)) return recipe(s, "sideboard");
    if (/lanesund-tv-bench/.test(slug)) return recipe(s, "tv");
    return null;
  },
};
export default family;
