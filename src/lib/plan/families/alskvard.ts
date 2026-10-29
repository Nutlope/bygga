import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * ÄLSKVÄRD, read from the cot's and the crib's manuals (the two build the same way). Feet are knocked into the two
 * end frames while they lie on a rug, the two bottom rails go between them on dowels and long bolts with barrel nuts,
 * four hooks (eye bolts on the crib) hold the slatted base at its top height, then both barred sides drop onto the
 * rails and are bolted to the ends. The front side's lower corners get a screw and sleeve each. Lowering the base and
 * taking a side off later follow the manual's own pages. The changing table follows its own manual below.
 */

function fx(kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on?: string, o: Partial<CustomFix> = {}): CustomFix {
  return { kind, count: at.length, at, dir, on, ...o };
}

const isCot = (s: ProductSpec) => /\b(cot|crib)\b/i.test(`${s.slug ?? ""} ${s.variant}`) && !/changing/i.test(`${s.slug ?? ""} ${s.variant}`);

function cot(s: ProductSpec): CustomParams {
  const crib = /crib/i.test(`${s.slug ?? ""} ${s.variant}`);
  // IKEA's sizes: the mattress plus the frame round it
  const m = `${s.slug ?? ""}`.match(/(\d+)-x-(\d+)/);
  const mw = s.bed?.mattressW ?? (m ? +m[1] : 70), ml = s.bed?.mattressL ?? (m ? +m[2] : 140);
  const L = ml * 10 + 60, D = mw * 10 + 40, H = crib ? 960 : 930;
  const P = 45; // frame posts
  const xe = L / 2 - P / 2; // end frames
  const xi = L / 2 - P; // their inside faces
  const zr = D / 2 - P / 2; // rails and sides
  const sideTop = H - 120;
  const yRail = 160, railH = 60;
  const yBase = crib ? 440 : 420;
  const parts: CustomPart[] = [];
  const endPieces: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [P, H - P / 2, P], pos: [0, -P / 4, sz * zr] })),
    { shape: "cyl", size: [P, D - P, P], pos: [0, H / 2 - P / 2, 0], rot: [Math.PI / 2, 0, 0] },
    { shape: "box", size: [16, H - 160 - P, D - 2 * P], pos: [0, (160 + H - P) / 2 - H / 2, 0] },
  ];
  for (const [i, sx] of [-1, 1].entries()) parts.push({ id: `E${i}`, name: "End frame", size: [P, H, D], pos: [sx * xe, H / 2, 0], pieces: endPieces, material: "wood" });
  for (const [i, sz] of [-1, 1].entries()) parts.push({ id: `R${i}`, name: "Bottom rail", size: [2 * xi, railH, 22], pos: [0, yRail, sz * zr], material: "wood" });
  // the slatted base: two long battens and slats across
  const bw = 2 * xi - 4, bd = D - 2 * P - 4;
  const nSlats = Math.round(bw / 105);
  const basePieces: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [bw, 25, 40], pos: [0, -5, sz * (bd / 2 - 20)] })),
    ...Array.from({ length: nSlats }, (_, k): PartPiece => ({ shape: "box", size: [60, 12, bd], pos: [-bw / 2 + 40 + ((bw - 80) * k) / (nSlats - 1), 12, 0] })),
  ];
  parts.push({ id: "BASE", name: "Slatted base", size: [bw, 35, bd], pos: [0, yBase, 0], pieces: basePieces, material: "wood" });
  // the barred sides: a rail top and bottom and round bars between
  const sy0 = yRail + railH / 2, sh = sideTop - sy0;
  const nBars = Math.round((2 * xi) / 75);
  const sidePieces: PartPiece[] = [
    { shape: "box", size: [2 * xi, 40, 30], pos: [0, -sh / 2 + 20, 0] },
    { shape: "box", size: [2 * xi, 45, 30], pos: [0, sh / 2 - 22, 0] },
    ...Array.from({ length: nBars }, (_, k): PartPiece => ({ shape: "cyl", size: [24, sh - 85, 24], pos: [-xi + ((2 * xi) * (k + 1)) / (nBars + 1), -1, 0] })),
  ];
  for (const [i, sz] of [-1, 1].entries()) parts.push({ id: `S${i}`, name: "Barred side", size: [2 * xi, sh, 30], pos: [0, sy0 + sh / 2, sz * zr], pieces: sidePieces, material: "board" });

  const legFeet = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xe, 0, sz * zr]));
  const end = (sx: number) => (sx < 0 ? "E0" : "E1");
  const railDowels = [-1, 1].flatMap((sz, i) => [-1, 1].map((sx) => fx("dowel", [-12, 12].map((dy): Vec3 => [sx * xi, yRail + dy, sz * zr]), [-sx, 0, 0], `R${i}`)));
  const bolts = (sx: number, ys: number[]) =>
    fx("bolt", ys.flatMap((y) => [-1, 1].map((sz): Vec3 => [sx * (L / 2), y, sz * zr])), [-sx, 0, 0], end(sx), { len: 90, dia: 6, name: "Long bolt" });
  const barrels = (sx: number, ys: { y: number; on: (sz: number) => string }[]) =>
    ys.flatMap(({ y, on }) => [-1, 1].map((sz) => fx("nut", [[sx * (xi - 45), y, sz * zr]], [0, -1, 0], on(sz), { name: "Barrel nut" })));
  const railTop = yRail + railH / 2;
  const hookPts = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xi, yBase - 18, sz * (bd / 2 - 20)]));
  const steps: CustomStep[] = [
    {
      title: "Knock the feet into the end frames",
      detail: "Lay both frames on a rug and tap a foot into the bottom of each leg.",
      fix: [-1, 1].map((sx) => fx("glide", legFeet.filter((p) => Math.sign(p[0]) === sx), [0, 1, 0], end(sx), { name: "Foot" })),
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Tap dowels into the bottom rails", detail: "Two in each end of both rails.", fix: railDowels, tools: ["hammer"], wait: ["R0", "R1"], from: { R0: [600, 0, 0], R1: [600, 0, 0] } },
    { title: "Stand one end frame up", detail: "Feet on the floor, the inside facing the middle of the room.", add: ["E0"] },
    { title: "Push the rails into it", detail: "Press each rail's dowels straight into the holes in the legs.", add: ["R0", "R1"], from: { R0: [400, 0, 0], R1: [400, 0, 0] } },
    {
      title: "Bolt the rails to it",
      detail: "Drop a barrel nut into each rail, slot towards the bolt, then turn the long bolts in through the legs.",
      fix: [...barrels(-1, [{ y: railTop, on: (sz) => (sz < 0 ? "R0" : "R1") }]), bolts(-1, [yRail])],
      tools: ["allen", "flathead"],
    },
    { title: "Fit the other end frame", detail: "Line it up with the dowels and push it on.", add: ["E1"] },
    { title: "Bolt the rails to it", detail: "Barrel nuts first, then the two long bolts.", fix: [...barrels(1, [{ y: railTop, on: (sz) => (sz < 0 ? "R0" : "R1") }]), bolts(1, [yRail])], tools: ["allen", "flathead"] },
    { title: "Tap two dowels into the back rail", detail: "Into the holes along its top edge, for the fixed side.", fix: [fx("dowel", [-1, 1].map((sx): Vec3 => [(sx * L) / 4, railTop, -zr]), [0, -1, 0], "R0")], tools: ["hammer"] },
    {
      title: crib ? "Screw the eye bolts into the end frames" : "Screw the base hooks into the end frames",
      detail: "Four of them, in the top set of holes inside the frames, turned in by hand until they stop. The top height is for a newborn.",
      fix: [-1, 1].map((sx) => fx("hook", hookPts.filter((p) => Math.sign(p[0]) === sx), [sx, 0, 0], end(sx), { name: crib ? "Eye bolt" : "Base hook" })),
    },
    { title: "Lay the base on the hooks", detail: "Slats up, its corners resting on all four.", add: ["BASE"] },
    {
      title: "Bolt the base to the hooks",
      detail: crib ? "A bolt down through each corner of the base and the eye bolt, with a sleeve nut from below." : "A short bolt down through each corner of the base into its hook.",
      fix: crib
        ? [fx("bolt", hookPts.map((p): Vec3 => [p[0] - Math.sign(p[0]) * 20, yBase + 18, p[2]]), [0, -1, 0], "BASE", { len: 40, dia: 6 }), fx("nut", hookPts.map((p): Vec3 => [p[0] - Math.sign(p[0]) * 20, yBase - 30, p[2]]), [0, 1, 0], "BASE", { name: "Sleeve nut" })]
        : [fx("bolt", hookPts.map((p): Vec3 => [p[0] - Math.sign(p[0]) * 20, yBase + 18, p[2]]), [0, -1, 0], "BASE", { len: 25, dia: 6 })],
      tools: ["allen"],
    },
    { title: "Lower both barred sides in", detail: "The fixed side goes onto the dowels on the back rail, the other at the front.", add: ["S0", "S1"], from: { S0: [0, 320, 0], S1: [0, 320, 0] } },
    {
      title: "Bolt the sides to the end frames",
      detail: "Barrel nuts into the sides' rails, then eight long bolts through the frames, two at each corner.",
      fix: [
        ...[-1, 1].flatMap((sx) => barrels(sx, [{ y: sideTop, on: (sz) => (sz < 0 ? "S0" : "S1") }, { y: sy0 + 40, on: (sz) => (sz < 0 ? "S0" : "S1") }])),
        bolts(-1, [sy0 + 20, sideTop - 22]),
        bolts(1, [sy0 + 20, sideTop - 22]),
      ],
      tools: ["allen", "flathead"],
    },
    {
      title: "Screw the sides' lower corners",
      detail: "A sleeve from inside and a screw from outside at each lower corner, through the frame.",
      fix: [-1, 1].flatMap((sx) => [fx("nut", [-1, 1].map((sz): Vec3 => [sx * xi, sy0 + 90, sz * zr]), [sx, 0, 0], end(sx), { name: "Sleeve" }), fx("screw", [-1, 1].map((sz): Vec3 => [sx * (L / 2), sy0 + 90, sz * zr]), [-sx, 0, 0], end(sx), { len: 60, dia: 5 })]),
      tools: ["screwdriver", "allen"],
    },
    { title: "Tighten the side bolts", detail: "Go round the four bolts at the top corners again until the heads sit flush, no further. Check nothing wobbles.", tools: ["allen"], check: "square" },
    {
      title: "Lower the base as your child grows",
      detail: "Once your child can sit up, move the hooks and the base to the lower holes. Later one side can come off; the guard rail and spare fittings in the box are for that.",
      warnings: ["hand"],
    },
  ];
  return { parts, steps };
}

/* ---------- changing table / chest of drawers ---------- */

/**
 * The changing table's own manual: both birch side frames get their glides and cam bolts, two white panels each are
 * dowelled, dropped into them, locked with cams and bolted through the posts, and the runners go on. The carcass is
 * built on the left side lying on the rug: bottom, middle and top panels on cam bolts and cams, the upper back
 * bolted through the post, then the right side goes on from above. Stood up, the plinth is screwed in, the two
 * drawers are built on their fronts and slid in, the back is fixed to the wall, and the changing tray (a rim screwed
 * onto its board) slides on top and is screwed down.
 */
function changing(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, Dt = s.size.d * 10; // the tray reaches over the front
  const D = 580; // the chest itself
  const P = 40; // frame posts and rails
  const xf = W / 2 - P / 2; // side frames
  const xo = W / 2 - P; // their inside face
  const pt = 16, xp = xo - pt / 2, xi = xo - pt; // side panels, lying on the frames' inside
  const zp = D / 2 - P / 2;
  const yB = 160, yM = 600, yT = 862, bt = 18;
  const iw = 2 * xi;
  const parts: CustomPart[] = [];
  const framePieces: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [P, H, P], pos: [0, 0, sz * zp] })),
    { shape: "box", size: [P, P, D - 2 * P], pos: [0, H / 2 - P / 2, 0] },
    { shape: "box", size: [P, P, D - 2 * P], pos: [0, 140 - H / 2, 0] },
  ];
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  for (const sx of [-1, 1]) {
    parts.push({ id: `S${side(sx)}`, name: "Side frame", size: [P, H, D], pos: [sx * xf, H / 2, 0], pieces: framePieces, material: "wood" });
    parts.push({ id: `P${side(sx)}0`, name: "Lower side panel", size: [pt, yM - 120, D], pos: [sx * xp, (120 + yM) / 2, 0] });
    parts.push({ id: `P${side(sx)}1`, name: "Upper side panel", size: [pt, H - 20 - yM, D], pos: [sx * xp, (yM + H - 20) / 2, 0] });
  }
  const panel = (id: string, name: string, y: number) => parts.push({ id, name, size: [iw, bt, D - 20], pos: [0, y + bt / 2, -10] });
  panel("BOT", "Bottom panel", yB);
  panel("MID", "Middle panel", yM);
  panel("TOP", "Top panel", yT);
  parts.push({ id: "UB", name: "Upper back", size: [iw, yT - yM - bt, bt], pos: [0, (yM + bt + yT) / 2, -D / 2 + bt / 2] });
  parts.push({ id: "PL", name: "Plinth", size: [iw + 2 * pt, yB - 40, bt], pos: [0, (40 + yB) / 2, D / 2 - P + bt / 2] });
  // the drawers: a front with its box behind, one part each
  const fw = 2 * (xi - 2), bx = xi - 12 - 6, bl = 480;
  const drawers = [{ id: "D0", yc: 285 }, { id: "D1", yc: 495 }];
  for (const d of drawers)
    parts.push({
      id: d.id,
      name: "Drawer",
      size: [fw, 200, D],
      pos: [0, d.yc, 0],
      pieces: [
        { shape: "box", size: [fw, 200, bt], pos: [0, 0, D / 2 - bt / 2] },
        ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [12, 150, bl], pos: [sx * (bx - 6), -15, D / 2 - bt - bl / 2] })),
        { shape: "box", size: [2 * bx - 24, 150, 12], pos: [0, -15, D / 2 - bt - bl + 6] },
        { shape: "box", size: [2 * bx - 24, 4, bl - 12], pos: [0, -88, D / 2 - bt - bl / 2] },
      ],
    });
  // the changing tray: a board with a rim at the back and sides and a low lip at the front
  const tz0 = -D / 2, tz1 = -D / 2 + Dt, tzc = (tz0 + tz1) / 2;
  const tw = iw, ty = yT + bt;
  // one part: it is put together off to the side and slides on in one piece
  const rimH = 100, ry = ty + bt + rimH / 2;
  const tyc = ty + (bt + rimH) / 2;
  parts.push({
    id: "TR",
    name: "Changing tray",
    size: [tw, bt + rimH, Dt],
    pos: [0, tyc, tzc],
    pieces: [
      { shape: "box", size: [tw, bt, Dt], pos: [0, ty + bt / 2 - tyc, 0] },
      { shape: "box", size: [tw, rimH, bt], pos: [0, ry - tyc, tz0 + bt / 2 - tzc] },
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [bt, rimH, Dt - bt], pos: [sx * (tw / 2 - bt / 2), ry - tyc, bt / 2] })),
      { shape: "box", size: [tw - 2 * bt, 40, bt], pos: [0, ty + bt + 20 - tyc, Dt / 2 - bt / 2] },
    ],
  });

  const both = (f: (sx: number) => CustomFix[]) => [-1, 1].flatMap(f);
  const glides = both((sx) => [fx("glide", [-1, 1].map((sz): Vec3 => [sx * xf, 0, sz * zp]), [0, 1, 0], `S${side(sx)}`, { name: "Glide" })]);
  // cam bolts in each frame's inside face, three each: two on the posts low down, one on the top rail
  const frameBolts: Vec3[] = [[0, 400, -zp], [0, 400, zp], [0, H - P / 2, 0]];
  const camBolts = both((sx) => [fx("camScrew", frameBolts.map((p): Vec3 => [sx * xo, p[1], p[2]]), [sx, 0, 0], `S${side(sx)}`)]);
  const panelDowels = both((sx) => [
    fx("dowel", [[sx * xo, 140, -120], [sx * xo, 140, 120]], [-sx, 0, 0], `P${side(sx)}0`),
    fx("dowel", [[sx * xo, H - P / 2, 160]], [-sx, 0, 0], `P${side(sx)}1`),
  ]);
  const panelCams = both((sx) => [
    fx("cam", [[sx * xi, 400, -zp], [sx * xi, 400, zp]], [sx, 0, 0], `P${side(sx)}0`, { len: 13, dia: 15 }),
    fx("cam", [[sx * xi, H - P / 2, 0]], [sx, 0, 0], `P${side(sx)}1`, { len: 13, dia: 15 }),
  ]);
  const postBolts = both((sx) => [
    fx("bolt", [[sx * (W / 2), 250, -zp], [sx * (W / 2), 250, zp]], [-sx, 0, 0], `S${side(sx)}`, { len: 50, dia: 6, mate: `P${side(sx)}0` }),
    fx("bolt", [[sx * (W / 2), 800, sx * zp]], [-sx, 0, 0], `S${side(sx)}`, { len: 50, dia: 6, mate: `P${side(sx)}1` }),
  ]);
  const railScrews = both((sx) => [
    fx("screw", [[sx * xi, 140, -150], [sx * xi, 140, 150]], [sx, 0, 0], `P${side(sx)}0`, { len: 30, dia: 4 }),
    fx("screw", [[sx * xi, H - P / 2, -150]], [sx, 0, 0], `P${side(sx)}1`, { len: 30, dia: 4 }),
  ]);
  const runnerX = xi - 6;
  const runners = both((sx) => [fx("runner", drawers.map((d): Vec3 => [sx * runnerX, d.yc - 80, 20]), [sx, 0, 0], `P${side(sx)}0`, { len: 450, dia: 30 })]);
  const runnerScrews = both((sx) => [fx("screw", drawers.flatMap((d) => [-180, 0, 180].map((z): Vec3 => [sx * (xi - 8), d.yc - 80, z])), [sx, 0, 0], `P${side(sx)}0`, { len: 12, dia: 4 })]);
  // the carcass panels' ends: two cam bolts in the side panel and two cams in the panel, at each end
  const ends = (y: number) => [-150, 150].map((z) => [y + bt / 2, z] as [number, number]);
  const carcassBolts = both((sx) => [fx("camScrew", [yB, yM, yT].flatMap((y) => ends(y).map(([yy, z]): Vec3 => [sx * xi, yy, z])), [sx, 0, 0], `P${side(sx)}${0}`, {})]).map((f) => ({ ...f, on: undefined, to: undefined }));
  const camsOf = (id: string, y: number) => fx("cam", [-1, 1].flatMap((sx) => ends(y).map(([yy, z]): Vec3 => [sx * (xi - 34), yy + bt / 2, z])), [0, -1, 0], id, { len: 13, dia: 15 });
  const ubBolts = (sx: number) => fx("bolt", [690, 800].map((y): Vec3 => [sx * (W / 2), y, -D / 2 + bt / 2]), [-sx, 0, 0], `S${side(sx)}`, { len: 70, dia: 6, mate: "UB" });
  const drawerFix = (k: "dowel" | "cam" | "screw" | "knob"): CustomFix[] =>
    drawers.flatMap((d) => {
      const zf = D / 2 - bt;
      if (k === "dowel") return [fx("dowel", [-1, 1].flatMap((sx) => [-50, 50].map((dy): Vec3 => [sx * (bx - 6), d.yc - 15 + dy, zf])), [0, 0, -1], d.id)];
      if (k === "cam") return [fx("cam", [-1, 1].flatMap((sx) => [-25, 25].map((dy): Vec3 => [sx * (bx - 20), d.yc - 15 + dy, zf - 30])), [0, 1, 0], d.id, { len: 13, dia: 15 })];
      if (k === "screw") return [-1, 1].map((sx) => fx("screw", [-150, 30, 210].map((z): Vec3 => [sx * (bx + 2), d.yc - 50, z]), [-sx, 0, 0], d.id, { len: 12, dia: 4 }));
      return [fx("knob", [[0, d.yc, D / 2]], [0, 0, -1], d.id, { len: 30, dia: 35 }), fx("screw", [[0, d.yc, D / 2 - bt - 6]], [0, 0, 1], d.id, { len: 30, dia: 4 })];
    });
  const wallPts: Vec3[] = [-1, 1].map((sx): Vec3 => [sx * 300, 800, -D / 2 + bt]);
  const steps: CustomStep[] = [
    { title: "Tap the glides into the side frames", detail: "Lay both frames on a rug, inside up. One glide under each leg.", fix: glides, tools: ["hammer"], wait: ["SL", "SR"], from: { SL: [-600, 0, 0], SR: [600, 0, 0] }, warnings: ["floor"] },
    { title: "Screw cam bolts into the frames", detail: "Three into the inside of each frame, by hand until they stop.", fix: camBolts },
    { title: "Tap dowels into the side panels", detail: "Into the edge holes of all four panels.", fix: panelDowels, tools: ["hammer"], wait: ["PL0", "PL1", "PR0", "PR1"], from: { PL0: [-600, 0, 0], PL1: [-600, 0, 0], PR0: [600, 0, 0], PR1: [600, 0, 0] } },
    { title: "Lay the panels into the left frame", detail: "Lower each panel onto the cam bolts and dowels, show side down. The right frame gets its two the same way.", add: ["SL", "PL0", "PL1"], from: { PL0: [400, 0, 0], PL1: [400, 0, 0] }, pose: "+x" },
    { title: "Lock the panels with the cams", detail: "Six cams, arrow towards the cam bolt, turned clockwise.", fix: panelCams, tools: ["screwdriver"] },
    { title: "Bolt the panels through the posts", detail: "Six long bolts from the outside of the frames. Push the panel tight to the frame before you turn each one in.", fix: postBolts, tools: ["allen"] },
    { title: "Screw the panels to the rails", detail: "Six screws from the inside, through the panels into the frames' rails.", fix: railScrews, tools: ["screwdriver"] },
    { title: "Screw on the drawer runners", detail: "Check the marks: each runner has its own side. Three screws in each, twelve in all.", fix: [...runners, ...runnerScrews], tools: ["screwdriver"] },
    { title: "Screw in the cam bolts for the carcass", detail: "Twelve, six on the inside of each side, where the bottom, middle and top panels meet it.", fix: carcassBolts.map((f, i) => ({ ...f, on: i === 0 ? "PL0" : "PR0" })) },
    { title: "Tap dowels into the bottom and middle panels", detail: "One in each end.", fix: [fx("dowel", [-1, 1].flatMap((sx) => [yB, yM].map((y): Vec3 => [sx * xi, y + bt / 2, 0])), [1, 0, 0], "BOT", {})], tools: ["hammer"], wait: ["BOT", "MID"] },
    { title: "Lower the bottom panel onto the left side", detail: "Front edge to the front of the frame. Turn its two cams at this end.", add: ["BOT"], fix: [camsOf("BOT", yB)], tools: ["screwdriver"] },
    { title: "Lower the middle panel on", detail: "The same way, two cams at this end.", add: ["MID"], fix: [camsOf("MID", yM)], tools: ["screwdriver"] },
    { title: "Fit the upper back and bolt it", detail: "It stands between the middle and the top panel at the back. Two bolts through the back post.", add: ["UB"], fix: [ubBolts(-1)], tools: ["allen"] },
    { title: "Lower the top panel on", detail: "Its cams too.", add: ["TOP"], from: { TOP: [500, 0, 0] }, fix: [camsOf("TOP", yT)], tools: ["screwdriver"] },
    {
      title: "Lower the right side on from above",
      detail: "Together. Guide every cam bolt and dowel into its hole, then turn the cams at this end and bolt the upper back through the post.",
      add: ["SR", "PR0", "PR1"],
      fix: [ubBolts(1)],
      people: 2,
      tools: ["allen", "screwdriver"],
      warnings: ["two"],
      from: { SR: [400, 0, 0], PR0: [400, 0, 0], PR1: [400, 0, 0] },
    },
    {
      title: "Stand it up and screw in the plinth",
      detail: "Two long screws, one through each front post into the plinth's ends.",
      add: ["PL"],
      fix: [-1, 1].map((sx) => fx("screw", [[sx * (W / 2), 100, D / 2 - P + bt / 2]], [-sx, 0, 0], `S${side(sx)}`, { len: 70, dia: 5, mate: "PL" })),
      pose: "+y",
      people: 2,
      tools: ["screwdriver"],
      from: { PL: [0, 0, 400] },
    },
    { title: "Tap dowels into the drawer fronts", detail: "Lay both fronts face down on a rug. Four dowels in each, for the sides.", fix: drawerFix("dowel"), tools: ["hammer"], wait: ["D0", "D1"], warnings: ["floor"] },
    { title: "Fit the sides and back, and lock the cams", detail: "Push the sides onto the dowels, slide the bottom into its grooves and push the back on. Four cams in each drawer.", fix: drawerFix("cam"), tools: ["screwdriver"] },
    { title: "Screw the runners onto the drawers", detail: "Three screws on each side of each drawer.", fix: drawerFix("screw"), tools: ["screwdriver"] },
    { title: "Screw on the knobs", detail: "One in the middle of each front, the screw from inside.", fix: drawerFix("knob"), tools: ["screwdriver"] },
    { title: "Slide the drawers in", detail: "Lift each one onto its runners and push it all the way in.", add: ["D0", "D1"], from: { D0: [0, 0, 500], D1: [0, 0, 500] } },
    {
      title: "Fix it to the wall",
      detail: "Two screws with washers through the upper back, into plugs in the wall. Wall screws and plugs aren't included: pick ones made for your wall. Click the cover caps over the heads.",
      fix: [
        fx("plug", wallPts.map((p): Vec3 => [p[0], p[1], -D / 2 - 2]), [0, 0, -1], undefined, {}),
        fx("washer", wallPts, [0, 0, -1], "UB", {}),
        fx("screw", wallPts, [0, 0, -1], "UB", { len: 50, dia: 5 }),
        fx("cap", wallPts, [0, 0, -1], "UB", { name: "Cover cap" }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Fit the connectors into the rim",
      detail: "Four, into the ends of the side pieces where they meet the back.",
      fix: [fx("connector", [-1, 1].flatMap((sx) => [ry - 25, ry + 25].map((y): Vec3 => [sx * (tw / 2 - bt / 2), y, tz0 + bt])), [0, 0, -1], "TR", { len: 30, dia: 10 })],
      wait: ["TR"],
    },
    { title: "Lock the rim's corners with cams", detail: "Four cams, turned clockwise.", fix: [fx("cam", [-1, 1].flatMap((sx) => [ry - 25, ry + 25].map((y): Vec3 => [sx * (tw / 2 - bt / 2), y, tz0 + 60])), [0, 0, 1], "TR", { len: 13, dia: 15 })], tools: ["screwdriver"] },
    { title: "Bolt the front lip between the sides", detail: "One bolt through each side.", fix: [-1, 1].map((sx) => fx("bolt", [[sx * (tw / 2), ty + bt + 20, tz1 - bt / 2]], [-sx, 0, 0], "TR", { len: 40, dia: 6 })), tools: ["allen"] },
    { title: "Screw the board onto the rim", detail: "Turn the rim over onto the board and put in ten screws, up through the board.", fix: [fx("screw", [...[-1, 1].flatMap((sx) => [-1, -0.33, 0.33, 1].map((k): Vec3 => [sx * (tw / 2 - bt / 2), ty, tzc + k * (Dt / 2 - 60)])), ...[-150, 150].map((x): Vec3 => [x, ty, tz0 + bt / 2])], [0, 1, 0], "TR", { len: 30, dia: 4 })], tools: ["screwdriver"] },
    { title: "Slide the changing tray onto the top", detail: "From the front, until it stops against the frames at the back.", add: ["TR"], from: { TR: [0, 0, 600] } },
    {
      title: "Screw the tray down",
      detail: "Eight screws up through the top panel into the board, three through each side of the rim into the side panels.",
      fix: [
        fx("screw", [-300, -100, 100, 300].flatMap((x) => [-150, 150].map((z): Vec3 => [x, yT, z])), [0, 1, 0], "TOP", { len: 30, dia: 4, mate: "TR" }),
        ...[-1, 1].map((sx) => fx("screw", [-200, 0, 200].map((z): Vec3 => [sx * (tw / 2 - bt), ry, z]), [sx, 0, 0], "TR", { len: 30, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

/** The end frames lie on the rug while their feet go in, then stand up in their own steps. */
function buildCot(b: PlanBuilder, s: ProductSpec) {
  const recipe = cot(s);
  const e = recipe.parts.filter((p) => p.id === "E0" || p.id === "E1");
  const keyOf = (id: string) => {
    const p = recipe.parts.find((q) => q.id === id)!.pos;
    return b.items.find((it) => it.kind === "part" && it.final.pos.every((v, i) => Math.abs(v - p[i]) < 0.5))?.key;
  };
  const step = b.step.bind(b);
  b.step = (def, body) =>
    step(def, () => {
      if (b.steps.length === 1) {
        b.stagger(0.15);
        e.forEach((p, i) => {
          const k = keyOf(p.id);
          if (k) b.stage(k, [(i ? 1 : -1) * (p.size[1] / 2 + 80), p.size[0] / 2, 0], [0, 0, Math.PI / 2], [0, 200, 0]);
        });
        b.then(0.15);
      }
      body();
    });
  try {
    buildCustom(b, { ...s, custom: recipe });
  } finally {
    b.step = step;
  }
}

const family: Family = {
  names: ["ÄLSKVÄRD", "ALSKVARD"],
  recipe(s) {
    return /changing/i.test(`${s.slug ?? ""} ${s.variant}`) ? changing(s) : null;
  },
  build(b, s) {
    if (!isCot(s)) return false;
    buildCot(b, s);
    return true;
  },
};
export default family;
