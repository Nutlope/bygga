import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * GURSKEN, read from its manuals. Everything is built lying on its front on a rug, with the panels joined by wooden
 * dowels and long Allen screws through the sides; the folded hardboard back is laid on top and nailed with the
 * plastic nail guide, then it is stood up and hooked to the wall on two brackets screwed onto the top.
 * The chest has no bottom: three drawers run on plastic rails screwed inside the sides, and each drawer is held
 * together with cam locks at the front and plastic pins at the back. The wardrobes have a fixed shelf, a plinth,
 * a clothes rail and doors on clip hinges; the 2-door one adds a board at the bottom of the back.
 * The bedside table has no manual we could find and keeps its old guide.
 */

type Fx = Omit<CustomFix, "count" | "at"> & { at: Vec3[] };
const fx = (f: Fx): CustomFix => ({ ...f, count: f.at.length });
const SX = [-1, 1];
const T = 16, BK = 3, P = 60;
const SCREW = { kind: "bolt", name: "Connector screw", len: 50, dia: 6 } as const;
const WALL_SCREW = { kind: "screw", len: 50, dia: 5 } as const;

/** Dowels in both ends of a panel: each end's go in towards the panel's middle. */
const ends = (f: Fx): CustomFix[] =>
  SX.map((sx) => ({ ...f, at: f.at.filter((p) => Math.sign(p[0]) === sx) }))
    .filter((g) => g.at.length)
    .map((g) => fx({ ...g, dir: [-Math.sign(g.at[0][0]), 0, 0] }));

/** Nails every ~150 mm round the edge of the back, plus a row along the middle where it is folded. */
function backNails(x0: number, x1: number, y0: number, y1: number, z: number, n: number): Vec3[] {
  const pts: Vec3[] = [];
  const edge = (a: Vec3, b: Vec3, k: number) => {
    for (let i = 0; i < k; i++) {
      const t = (i + 0.5) / k;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z]);
    }
  };
  const w = x1 - x0, h = y1 - y0;
  const per = Math.max(1, Math.round((n * w) / (2 * (w + h))));
  const up = Math.max(1, Math.round((n - 2 * per) / 2));
  edge([x0 + 8, y1 - 8, z], [x1 - 8, y1 - 8, z], per);
  edge([x0 + 8, y0 + 8, z], [x1 - 8, y0 + 8, z], per);
  edge([x0 + 8, y0 + 8, z], [x0 + 8, y1 - 8, z], up);
  edge([x1 - 8, y0 + 8, z], [x1 - 8, y1 - 8, z], n - 2 * per - up);
  return pts;
}

function chest(s: ProductSpec): CustomParams {
  // IKEA's page: 69 x 67 x 38 (the guide without a page lists it taller, but it is the same chest and manual)
  void s;
  const W = 690, H = 670, D = 380;
  const zB = -D / 2 + BK, zF = D / 2, zc = (zB + zF) / 2, Dc = zF - zB;
  const xS = W / 2 - T / 2, xIn = W / 2 - T, iw = 2 * xIn;
  const slot = (H - T - P) / 3;
  const zRail = zB + T / 2, zPl = zF - T / 2 - 10;
  const dxS = xIn - 8; // drawer sides, centre
  const dD = 330; // drawer sides, front to back
  const zDF = zF - 8, zDs = zF - T - dD / 2, zDb = zF - T - dD + 6;
  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [T, H, Dc], pos: [-xS, H / 2, zc] },
    { id: "R", name: "Side panel", size: [T, H, Dc], pos: [xS, H / 2, zc] },
    { id: "top", name: "Top", size: [iw, T, Dc], pos: [0, H - T / 2, zc] },
    { id: "rail", name: "Back rail", size: [iw, P, T], pos: [0, P / 2, zRail] },
    { id: "plinth", name: "Plinth", size: [iw, P, T], pos: [0, P / 2, zPl] },
    { id: "back", name: "Back panel", size: [W - 4, H - 4, BK], pos: [0, H / 2, zB - BK / 2], material: "fiber" },
  ];
  const y0 = (i: number) => P + i * slot; // drawer i from the bottom
  const dr = (i: number) => ({ f: `f${i}`, l: `sl${i}`, r: `sr${i}`, b: `bk${i}`, bt: `bt${i}` });
  for (let i = 0; i < 3; i++) {
    const k = dr(i), y = y0(i);
    parts.push(
      { id: k.f, name: "Drawer front", size: [iw - 4, slot - 4, T], pos: [0, y + slot / 2, zDF] },
      { id: k.l, name: "Drawer side", size: [12, 150, dD], pos: [-dxS, y + 100, zDs] },
      { id: k.r, name: "Drawer side", size: [12, 150, dD], pos: [dxS, y + 100, zDs] },
      { id: k.bt, name: "Drawer bottom", size: [2 * dxS - 6, 3, dD - 8], pos: [0, y + 38, zDs + 4], material: "fiber" },
      { id: k.b, name: "Drawer back", size: [2 * dxS - 12, 120, 12], pos: [0, y + 115, zDb] },
    );
  }
  const yRun = (i: number) => y0(i) + 70;
  const zRun = zF - T - dD / 2;
  const runners = SX.map((sx) =>
    fx({ kind: "runner", name: "Drawer rail", len: dD, dia: 20, at: [0, 1, 2].map((i) => [sx * xIn, yRun(i), zRun] as Vec3), dir: [sx, 0, 0], on: sx < 0 ? "L" : "R" }),
  );
  const runScrews = SX.map((sx) =>
    fx({ kind: "screw", len: 12, dia: 3.5, at: [0, 1, 2].flatMap((i) => [-120, 120].map((dz) => [sx * xIn, yRun(i), zRun + dz] as Vec3)), dir: [sx, 0, 0], on: sx < 0 ? "L" : "R" }),
  );
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  const topScrews = (sx: number) => fx({ ...SCREW, at: [-110, 110].map((dz) => [sx * W / 2, H - T / 2, zc + dz] as Vec3), dir: [-sx, 0, 0], on: side(sx), mate: "top" });
  const railScrew = (sx: number, id: "rail" | "plinth") => fx({ ...SCREW, at: [[sx * W / 2, P / 2 - 12, id === "rail" ? zRail : zPl]], dir: [-sx, 0, 0], on: side(sx), mate: id });
  const xBr = xIn - 70, zBr = zB + 25;

  // one drawer, the bottom one first, then the other two the same way
  const drawerFix = (i: number) => {
    const k = dr(i), y = y0(i);
    const ym = y + 100;
    return {
      bolts: fx({ kind: "camScrew", at: SX.flatMap((sx) => [-45, 45].map((dy) => [sx * dxS, ym + dy, zF - T] as Vec3)), dir: [0, 0, 1], on: k.f }),
      dowels: SX.map((sx) => fx({ kind: "dowel", at: [[sx * dxS, ym, zF - T]], dir: [0, 0, -1], on: sx < 0 ? k.l : k.r })),
      cams: SX.map((sx) => fx({ kind: "cam", dia: 15, at: [-45, 45].map((dy) => [sx * (dxS - 6), ym + dy, zF - T - 30] as Vec3), dir: [sx, 0, 0], on: sx < 0 ? k.l : k.r })),
      pins: SX.map((sx) => fx({ kind: "clip", name: "Plastic pin", len: 30, dia: 8, at: [-30, 30].map((dy) => [sx * (dxS + 6), y + 115 + dy, zDb] as Vec3), dir: [-sx, 0, 0], on: sx < 0 ? k.l : k.r, mate: k.b })),
      knob: fx({ kind: "knob", dia: 32, at: [[0, y + slot / 2, zF + 4]], dir: [0, 0, -1], on: k.f }),
      knobScrew: fx({ kind: "screw", len: 25, dia: 4, at: [[0, y + slot / 2, zF - T - 4]], dir: [0, 0, 1], on: k.f }),
      stops: SX.map((sx) => fx({ kind: "stud", name: "Drawer stop", len: 10, dia: 12, at: [[sx * (dxS + 6), yRun(i), zDb + 15]], dir: [-sx, 0, 0], on: sx < 0 ? k.l : k.r })),
    };
  };
  const d0 = drawerFix(0);
  const rest = [1, 2].map(drawerFix);
  const steps: CustomStep[] = [
    {
      title: "Screw the drawer rails inside both sides",
      detail: "Lay the sides on a rug, inside face up. Three rails on each, two small screws in each rail, open ends to the front.",
      add: ["L", "R"],
      fix: [...runners, ...runScrews],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    {
      title: "Tap dowels into the ends of the top",
      detail: "Two in each end.",
      add: ["top"],
      fix: SX.map((sx) => fx({ kind: "dowel", at: [-110, 110].map((dz) => [sx * xIn, H - T / 2, zc + dz + 40] as Vec3), dir: [-sx, 0, 0], on: "top" })),
      tools: ["hammer"],
    },
    {
      title: "Screw the wall brackets onto the top",
      detail: "At both back corners, the upright leg along the back edge. One screw and a washer in each.",
      fix: [
        fx({ kind: "bracket", at: SX.map((sx) => [sx * xBr, H, zBr] as Vec3), dir: [0, -1, 0], on: "top" }),
        fx({ kind: "washer", at: SX.map((sx) => [sx * xBr, H + 2, zBr + 20] as Vec3), dir: [0, -1, 0], on: "top" }),
        fx({ kind: "screw", len: 16, dia: 4, at: SX.map((sx) => [sx * xBr, H, zBr + 20] as Vec3), dir: [0, -1, 0], on: "top" }),
      ],
      tools: ["screwdriver"],
      wall: false,
    },
    {
      title: "Screw the top to one side",
      detail: "Stand both on their front edges, rails facing in. Push the top onto the side's holes and turn two screws in with the Allen key.",
      fix: [topScrews(-1)],
      tools: ["allen"],
    },
    {
      title: "Tap dowels into the back rail and the plinth",
      detail: "One in each end of both.",
      add: ["rail", "plinth"],
      fix: (["rail", "plinth"] as const).flatMap((id) => ends({ kind: "dowel", at: SX.map((sx) => [sx * xIn, P / 2 + 12, id === "rail" ? zRail : zPl] as Vec3), on: id })),
      tools: ["hammer"],
    },
    { title: "Screw the back rail to the side", detail: "At the bottom end, along the back edge. One screw.", fix: [railScrew(-1, "rail")], tools: ["allen"] },
    { title: "Screw the plinth to the side", detail: "At the bottom end, along the front edge on the floor. One screw.", fix: [railScrew(-1, "plinth")], tools: ["allen"] },
    {
      title: "Push on the other side and screw it",
      detail: "Rails facing in, onto all the dowels at once. Four screws: two into the top, one into the rail and one into the plinth.",
      fix: [topScrews(1), railScrew(1, "rail"), railScrew(1, "plinth")],
      tools: ["allen"],
      check: "square",
    },
    { title: "Lay the back on", detail: "Unfold it and lay it on, smooth side down. Line it up with the edges so the frame is square.", add: ["back"], check: "square" },
    {
      title: "Nail the back at the top",
      detail: "Hold the plastic nail guide against the edge so each nail goes straight into the panel, not past it. Two nails in the middle, then one at each corner.",
      fix: [fx({ kind: "nail", at: [[-30, H - 10, zB - BK], [30, H - 10, zB - BK], [-W / 2 + 10, H - 10, zB - BK], [W / 2 - 10, H - 10, zB - BK]], dir: [0, 0, 1], on: "back" })],
      tools: ["hammer"],
    },
    {
      title: "Nail the rest of the back",
      detail: "Fifteen more, spaced along the sides, the top and the back rail, always with the guide.",
      fix: [fx({ kind: "nail", at: backNails(-W / 2 + 2, W / 2 - 2, 0, H - 40, zB - BK, 15), dir: [0, 0, 1], on: "back" })],
      tools: ["hammer"],
    },
    {
      title: "Turn it over and tap in the felt pads",
      detail: "Stand it on its top on the rug. One pad into the bottom edge of each side, front and back.",
      fix: [fx({ kind: "glide", len: 6, dia: 20, at: SX.flatMap((sx) => [zB + 25, zF - 25].map((z) => [sx * xS, 0, z] as Vec3)), dir: [0, 1, 0] })],
      tools: ["hammer"],
      pose: "-y",
    },
    {
      title: "Stand it against the wall and mark the holes",
      detail: "Turn it the right way up, push it to the wall and mark through the slot in each bracket. Then pull it away.",
      tools: ["pencil"],
      pose: "+y",
      wall: true,
    },
    {
      title: "Screw it to the wall",
      detail: "Drill and plug the marks, push it back and screw through the brackets with a washer on each screw. The plugs suit solid walls; for other walls pick fixings made for them.",
      fix: [
        fx({ kind: "plug", at: SX.map((sx) => [sx * xBr, H + 35, zB - BK - 4] as Vec3), dir: [0, 0, -1] }),
        fx({ kind: "washer", at: SX.map((sx) => [sx * xBr, H + 35, zB - BK + 2] as Vec3), dir: [0, 0, -1], on: "top" }),
        fx({ ...WALL_SCREW, at: SX.map((sx) => [sx * xBr, H + 35, zB - BK + 2] as Vec3), dir: [0, 0, -1], on: "top" }),
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Screw the cam bolts into a drawer front",
      detail: "Lay it face down. Four bolts into the holes near the ends, by hand until they stop.",
      add: [dr(0).f],
      fix: [d0.bolts],
      tools: ["screwdriver"],
      from: {},
    },
    { title: "Tap a dowel into each drawer side", detail: "Into the front end, the one nearest the groove.", add: [dr(0).l, dr(0).r], fix: d0.dowels, tools: ["hammer"], from: { [dr(0).l]: [0, 0, -300], [dr(0).r]: [0, 0, -300] } },
    { title: "Fix the sides to the front", detail: "Onto the bolts and the dowels, grooves facing in, then turn the four cam locks clockwise.", fix: d0.cams, tools: ["screwdriver"] },
    { title: "Slide in the drawer bottom", detail: "From the back, along the grooves until it stops in the front.", add: [dr(0).bt] },
    { title: "Put the drawer back in", detail: "Between the sides at the back, resting on top of the bottom.", add: [dr(0).b] },
    { title: "Tap in the plastic pins", detail: "Two through each side into the back.", fix: d0.pins, tools: ["hammer"] },
    { title: "Screw on the knob", detail: "The screw goes in from inside the drawer.", fix: [d0.knob, d0.knobScrew], tools: ["screwdriver"] },
    { title: "Push in the drawer stops", detail: "One at the back of each side, at the rail groove.", fix: d0.stops },
    {
      title: "Build the other two drawers",
      detail: "The same way, step by step.",
      add: [1, 2].flatMap((i) => [dr(i).f, dr(i).l, dr(i).r, dr(i).bt, dr(i).b]),
      // each arrives built, in one piece, and slides in from the front
      from: Object.fromEntries([1, 2].flatMap((i) => [dr(i).f, dr(i).l, dr(i).r, dr(i).bt, dr(i).b]).map((k) => [k, [0, 0, 400] as Vec3])),
      repeat: 2,
    },
    { title: "Slide the drawers in", detail: "Each one onto its rails, all the way in.", kind: "drawer" },
    { title: "Turn the drawer stops", detail: "Pull each drawer half out and turn both stops with a screwdriver so they stand out and catch the rails.", tools: ["screwdriver"] },
  ];
  // the other two drawers: every fitting counted, in as few groups as the builder takes
  const more = rest.flatMap((r) => [r.bolts, ...r.dowels, ...r.cams, ...r.pins, r.knob, r.knobScrew, ...r.stops]);
  const merged = new Map<string, CustomFix>();
  for (const f of more) {
    const key = `${f.kind}|${f.name ?? ""}|${f.dir?.join(",")}`;
    const m = merged.get(key);
    if (m) merged.set(key, { ...m, at: [...m.at!, ...f.at!], count: m.count + f.count, on: undefined, mate: undefined });
    else merged.set(key, { ...f, on: undefined, mate: undefined });
  }
  steps.find((s) => s.title === "Build the other two drawers")!.fix = [...merged.values()];
  return { parts, steps: steps.map(({ from, ...s }) => (from && Object.keys(from).length ? { ...s, from } : s)) };
}

function wardrobe(s: ProductSpec): CustomParams {
  const two = /2 doors/i.test(s.variant);
  const W = two ? 595 : 494, H = two ? 1855 : 1857, D = 550;
  const zB = -D / 2 + BK, zF = D / 2, Dc = zF - zB, zc = (zB + zF) / 2;
  const DT = 16; // doors sit between the sides, so the panels behind them are set back
  const xS = W / 2 - T / 2, xIn = W / 2 - T, iw = 2 * xIn;
  const di = Dc - DT - 2, zi = zB + di / 2; // panels behind the doors
  const yBot = P + T / 2, yTop = H - T / 2, yShelf = H - T - 260 - T / 2, yRail = yShelf - T / 2 - 55;
  const zPl = zF - DT - 4 - T / 2;
  const dBot = P + 3, dTop = H - 3, dH = dTop - dBot;
  const nD = two ? 2 : 1;
  const dW = (iw - 3 - (nD - 1) * 3) / nD;
  const doorX = (i: number) => (nD === 1 ? 0 : (i === 0 ? -1 : 1) * (dW / 2 + 1.5));
  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [T, H, Dc], pos: [-xS, H / 2, zc] },
    { id: "R", name: "Side panel", size: [T, H, Dc], pos: [xS, H / 2, zc] },
    { id: "top", name: "Top and bottom", size: [iw, T, di], pos: [0, yTop, zi] },
    { id: "bottom", name: "Top and bottom", size: [iw, T, di], pos: [0, yBot, zi] },
    { id: "shelf", name: "Shelf", size: [iw, T, di], pos: [0, yShelf, zi] },
    { id: "plinth", name: "Plinth", size: [iw, P, T], pos: [0, P / 2, zPl] },
    ...(two ? [{ id: "board", name: "Back board", size: [iw, 480, T], pos: [0, P + T + 240, zB + T / 2] } as CustomPart] : []),
    { id: "back", name: "Back panel", size: [W - 4, H - P - 4, BK], pos: [0, P + (H - P) / 2, zB - BK / 2], material: "fiber" },
    { id: "rail", name: "Clothes rail", size: [iw - 4, 20, 20], pos: [0, yRail, zi + 20], shape: "cyl", material: "metal" },
    ...Array.from({ length: nD }, (_, i): CustomPart => ({ id: `door${i}`, name: "Door", size: [dW, dH, DT], pos: [doorX(i), (dTop + dBot) / 2, zF - DT / 2] })),
  ];
  // hinges on the left of the single door (its knob is on the right), on the outer edge of each of the two
  const hingeSides = two ? [-1, 1] : [-1];
  const ys = [dBot + 110, (dBot + dTop) / 2, dTop - 110];
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  const zPlate = zF - DT - 40;
  const plates = hingeSides.map((sx) => fx({ kind: "plate", name: "Mounting plate", len: 12, dia: 36, at: ys.map((y) => [sx * xIn, y, zPlate] as Vec3), dir: [sx, 0, 0], on: side(sx) }));
  const plateScrews = hingeSides.map((sx) => fx({ kind: "screw", len: 12, dia: 4, at: ys.flatMap((y) => [-16, 16].map((dy) => [sx * xIn, y + dy, zPlate] as Vec3)), dir: [sx, 0, 0], on: side(sx) }));
  const doorOf = (sx: number) => (two ? (sx < 0 ? "door0" : "door1") : "door0");
  const hx = (sx: number) => sx * (xIn - 1.5 - 22);
  const hinges = hingeSides.map((sx) => fx({ kind: "hinge", at: ys.map((y) => [hx(sx), y, zF - DT] as Vec3), dir: [0, 0, 1], on: doorOf(sx) }));
  const hingeScrews = hingeSides.map((sx) => fx({ kind: "screw", len: 12, dia: 4, at: ys.flatMap((y) => [-22, 22].map((dy) => [hx(sx), y + dy, zF - DT] as Vec3)), dir: [0, 0, 1], on: doorOf(sx) }));
  const knobXs = two ? [-50, 50] : [dW / 2 - 40];
  const yKnob = 950;
  const bufX = two ? [-xIn + 60, xIn - 60] : [xIn - 60];
  const zBuf = zi + di / 2 - 8;
  const screw2 = (sx: number, y: number, mate: string) => fx({ ...SCREW, at: [-1, 1].map((k) => [sx * W / 2, y, zi + k * (di / 2 - 70)] as Vec3), dir: [-sx, 0, 0], on: side(sx), mate });
  const xBr = Math.min(xIn - 70, 170), zBr = zB + 25;
  const steps: CustomStep[] = [
    {
      title: two ? "Screw the hinge plates inside both sides" : "Screw the hinge plates inside the left side",
      detail: two
        ? "Lay the sides on a rug, inside face up. Three plates on each, along the front edge, two screws in each."
        : "Lay it on a rug, inside face up. Three plates along the front edge, two screws in each. You can hang the door on the other side instead: then put them on that side.",
      add: two ? ["L", "R"] : ["L"],
      fix: [...plates, ...plateScrews],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    {
      title: "Tap the door buffers into the top and bottom",
      detail: two ? "Two into each, near the front corners on the inside face." : "One into each, near the front corner on the knob side, on the inside face.",
      add: ["top", "bottom"],
      fix: [
        fx({ kind: "clip", name: "Door buffer", len: 12, dia: 10, at: bufX.map((x) => [x, yTop - T / 2, zBuf] as Vec3), dir: [0, 1, 0], on: "top" }),
        fx({ kind: "clip", name: "Door buffer", len: 12, dia: 10, at: bufX.map((x) => [x, yBot + T / 2, zBuf] as Vec3), dir: [0, -1, 0], on: "bottom" }),
      ],
      tools: ["hammer"],
    },
    {
      title: "Tap dowels into the top and bottom",
      detail: "Two into each end of both.",
      fix: (["top", "bottom"] as const).flatMap((id) => ends({ kind: "dowel", at: SX.flatMap((sx) => [-1, 1].map((k) => [sx * xIn, id === "top" ? yTop : yBot, zi + k * (di / 2 - 40)] as Vec3)), on: id })),
      tools: ["hammer"],
    },
    { title: "Screw the top to one side", detail: "Stand them on their front edges on the rug. Two screws with the Allen key.", fix: [screw2(-1, yTop, "top")], tools: ["allen"] },
    { title: "Screw the bottom to the same side", detail: "Two screws, only loosely for now: the plinth has to go in under it.", fix: [screw2(-1, yBot, "bottom")], tools: ["allen"] },
    {
      title: "Tap dowels into the shelf",
      detail: "Three into each end.",
      add: ["shelf"],
      fix: ends({ kind: "dowel", at: SX.flatMap((sx) => [-1, 0, 1].map((k) => [sx * xIn, yShelf, zi + k * (di / 2 - 50)] as Vec3)), on: "shelf" }),
      tools: ["hammer"],
    },
    { title: "Screw the shelf to the side", detail: "Near the top end, holes facing the top. Two screws.", fix: [screw2(-1, yShelf, "shelf")], tools: ["allen"] },
    { title: "Tap dowels into the plinth", detail: "Two into each end.", wait: ["plinth"], fix: ends({ kind: "dowel", at: SX.flatMap((sx) => [-15, 15].map((dy) => [sx * xIn, P / 2 + dy, zPl] as Vec3)), on: "plinth" }), tools: ["hammer"] },
    { title: "Slide the plinth in under the bottom", detail: "Along the floor, onto the side's holes at the front.", add: ["plinth"], from: { plinth: [350, 0, 0] } },
    { title: "Fit the other side together", detail: "One of you holds the frame while the other pushes the side onto all the dowels.", add: ["R"], people: 2, warnings: ["two"] },
    { title: "Screw the side to the bottom", detail: "Two screws at the bottom end.", fix: [screw2(1, yBot, "bottom")], tools: ["allen"] },
    { title: "Screw it to the top and the shelf", detail: "Four screws at the top end.", fix: [screw2(1, yTop, "top"), screw2(1, yShelf, "shelf")], tools: ["allen"] },
    ...(two
      ? [
          { title: "Lay the back board in", detail: "Into the bottom of the frame, flush with the back edges.", add: ["board"], from: { board: [0, 0, -400] as Vec3 } },
          {
            title: "Screw the back board on",
            detail: "Two screws through each side.",
            fix: SX.map((sx) => fx({ ...SCREW, at: [-150, 150].map((dy) => [sx * W / 2, P + T + 240 + dy, zB + T / 2] as Vec3), dir: [-sx, 0, 0], on: side(sx), mate: "board" })),
            tools: ["allen"],
          } as CustomStep,
        ]
      : []),
    { title: "Tighten the screws at the bottom", detail: "The ones you left loose in the first side. Turn them in flush, not deeper.", tools: ["allen"], check: "square" },
    { title: "Lay the back on", detail: two ? "Unfold it and lay it on, smooth side down. Line it up with the edges so the frame is square." : "Smooth side down. Line it up with the edges so the frame is square.", add: ["back"], from: { back: [0, 0, -500] }, check: "square" },
    {
      title: "Nail the back down one half",
      detail: "Hold the plastic nail guide against the edge so each nail goes straight into the panel, not past it.",
      fix: [fx({ kind: "nail", at: backNails(-W / 2 + 2, W / 2 - 2, P, H - 2, zB - BK, 30).slice(0, 15), dir: [0, 0, 1], on: "back" })],
      tools: ["hammer"],
    },
    { title: "Nail the rest of the back", detail: "Fifteen more, also into the shelf, always with the guide.", fix: [fx({ kind: "nail", at: backNails(-W / 2 + 2, W / 2 - 2, P, H - 2, zB - BK, 30).slice(15), dir: [0, 0, 1], on: "back" })], tools: ["hammer"] },
    {
      title: "Tap the feet into the bottom of the sides",
      detail: "Two into each side, front and back.",
      fix: [fx({ kind: "glide", name: "Plastic foot", len: 8, dia: 20, at: SX.flatMap((sx) => [zB + 50, zF - 50].map((z) => [sx * xS, 0, z] as Vec3)), dir: [0, 1, 0] })],
      tools: ["hammer"],
    },
    { title: "Stand it up together", detail: "Lift it upright where it will stand, then mark the wall along its top edge.", pose: "+y", people: 2, tools: ["pencil"], warnings: ["two"] },
    {
      title: "Mark the bracket holes on the wall",
      detail: "Move the wardrobe away. Hold each bracket to the wall with its flat leg on the line and mark through the slot.",
      tools: ["pencil", "level"],
      wall: true,
    },
    {
      title: "Screw the brackets to the wall",
      detail: "Drill and plug the marks, then a screw and washer through each bracket. The plugs suit solid walls; for other walls pick fixings made for them.",
      fix: [
        fx({ kind: "bracket", at: SX.map((sx) => [sx * xBr, H, zBr] as Vec3), dir: [0, -1, 0] }),
        fx({ kind: "plug", at: SX.map((sx) => [sx * xBr, H + 35, zB - BK - 4] as Vec3), dir: [0, 0, -1] }),
        fx({ kind: "washer", at: SX.map((sx) => [sx * xBr, H + 35, zB - BK + 2] as Vec3), dir: [0, 0, -1] }),
        fx({ ...WALL_SCREW, at: SX.map((sx) => [sx * xBr, H + 35, zB - BK + 2] as Vec3), dir: [0, 0, -1] }),
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall"],
    },
    {
      title: "Push it back and screw the brackets to the top",
      detail: "Slide it under the brackets against the wall. From a step stool, one screw and washer through each bracket into the top.",
      fix: [
        fx({ kind: "washer", at: SX.map((sx) => [sx * xBr, H + 2, zBr + 20] as Vec3), dir: [0, -1, 0], on: "top" }),
        fx({ kind: "screw", len: 16, dia: 4, at: SX.map((sx) => [sx * xBr, H, zBr + 20] as Vec3), dir: [0, -1, 0], on: "top" }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Screw the rail holders under the shelf",
      detail: "One on each side, one screw each.",
      fix: [
        ...SX.map((sx) => fx({ kind: "hook", name: "Rail holder", len: 40, dia: 24, at: [[sx * xIn, yRail, zi + 20]], dir: [sx, 0, 0], on: side(sx) })),
        ...SX.map((sx) => fx({ kind: "screw", len: 12, dia: 4, at: [[sx * xIn, yRail + 18, zi + 20]], dir: [sx, 0, 0], on: side(sx) })),
      ],
      tools: ["screwdriver"],
    },
    { title: "Drop the clothes rail in", detail: "Into the two holders.", add: ["rail"], from: { rail: [0, 120, 0] } },
    {
      title: two ? "Screw the hinges onto the doors" : "Screw the hinges onto the door",
      detail: "Lay it face down. Each hinge cup into its hole, two screws each.",
      add: Array.from({ length: nD }, (_, i) => `door${i}`),
      from: Object.fromEntries(Array.from({ length: nD }, (_, i) => [`door${i}`, [0, 0, 500] as Vec3])),
      fix: [...hinges, ...hingeScrews],
      tools: ["screwdriver"],
    },
    ...(two ? [] : [{ title: "Screw on the knob", detail: "On the edge away from the hinges, the screw from behind.", fix: [fx({ kind: "knob", dia: 32, at: knobXs.map((x) => [x, yKnob, zF + 4] as Vec3), dir: [0, 0, -1], on: "door0" }), fx({ kind: "screw", len: 25, dia: 4, at: knobXs.map((x) => [x, yKnob, zF - DT - 4] as Vec3), dir: [0, 0, 1], on: "door0" })], tools: ["screwdriver"] } as CustomStep]),
    {
      title: two ? "Clip the doors on" : "Clip the door on",
      detail: "Hook each hinge arm onto its plate and press until it clicks, then tighten the screw on each arm.",
      kind: "hinges",
      tools: ["screwdriver"],
    },
    ...(two
      ? [{ title: "Screw on the knobs", detail: "Near the middle edges, the screw from behind.", fix: [fx({ kind: "knob", dia: 32, at: knobXs.map((x) => [x, yKnob, zF + 4] as Vec3), dir: [0, 0, -1] }), fx({ kind: "screw", len: 25, dia: 4, at: knobXs.map((x) => [x, yKnob, zF - DT - 4] as Vec3), dir: [0, 0, 1] })], tools: ["screwdriver"] } as CustomStep]
      : []),
    { title: two ? "Line up the doors" : "Line up the door", detail: "Turn the hinge screws: one moves it up and down, one in and out, one sideways, until the gaps are even.", tools: ["screwdriver"] },
  ];
  // the doors show up with their hinges; nothing else arrives in the steps without parts
  return { parts, steps: steps.map(({ from, ...st }) => (from && Object.keys(from).length ? { ...st, from } : st)) };
}

const family: Family = {
  names: ["GURSKEN"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^gursken-chest-3-drawers/.test(slug)) return chest(s);
    if (/^gursken-wardrobe/.test(slug)) return wardrobe(s);
    return null;
  },
};
export default family;
