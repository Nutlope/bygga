import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * MACKAPÄR, read from its manuals.
 * Shoe rack: white metal trays on round tubes. A stud goes into one end of each tube by hand, the long tubes are
 * bolted up through the bottom tray, the top tray goes onto their studs, then upside down the legs screw into the
 * bottom bolts and a flat bolt closes each leg.
 * Coat rack with shoe storage: the same tubes and trays, built lying on its back from the top down: two side frames
 * with studs, short tubes and the top tray, the long tubes, the shoe shelf, the bottom tray and the legs. Standing,
 * it is screwed to the wall under the top tray, then the hooks are riveted onto two rails that click in.
 * Shoe cabinet (the sliding door one sold in the US at 80 x 35 x 102): a panel carcass on dowels and cam locks,
 * three legs, tilting shoe shelves on pegs, a middle divider, top and bottom door rails and two sliding doors.
 */

const TR = 40; // trays, rim height
const TUBE = 25;

/** A tray: a rim round a mesh with a bar across the middle, its top at yTop. */
function tray(id: string, name: string, W: number, D: number, yTop: number): CustomPart {
  const r = 15;
  const pieces: PartPiece[] = [
    { shape: "box", size: [W, TR, r], pos: [0, 0, D / 2 - r / 2] },
    { shape: "box", size: [W, TR, r], pos: [0, 0, -D / 2 + r / 2] },
    { shape: "box", size: [r, TR, D - 2 * r], pos: [-W / 2 + r / 2, 0, 0] },
    { shape: "box", size: [r, TR, D - 2 * r], pos: [W / 2 - r / 2, 0, 0] },
    { shape: "box", size: [W - 2 * r, 2, D - 2 * r], pos: [0, TR / 2 - 4, 0], material: "fiber" },
    { shape: "box", size: [r, 10, D - 2 * r], pos: [0, TR / 2 - 9, 0] },
  ];
  return { id, name, size: [W, TR, D], pos: [0, yTop - TR / 2, 0], material: "metal", pieces };
}

const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));

function tubes(prefix: string, name: string, xt: number, zt: number, y0: number, y1: number): CustomPart[] {
  return corners.map(([sx, sz]) => ({ id: `${prefix}${sx}${sz}`, name, size: [TUBE, y1 - y0, TUBE], pos: [sx * xt, (y0 + y1) / 2, sz * zt], shape: "cyl", material: "metal" }));
}

const STUD = { kind: "stud" as const, name: "Threaded stud", len: 30, dia: 8 };
const FLAT = { kind: "bolt" as const, name: "Flat bolt", len: 16, dia: 8 };

function at4(xt: number, zt: number, y: number): Vec3[] {
  return corners.map(([sx, sz]): Vec3 => [sx * xt, y, sz * zt]);
}

function shoeRack(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const xt = W / 2 - 28, zt = D / 2 - 28;
  const yb = 140, yt = H; // tops of the two trays
  const parts: CustomPart[] = [tray("B", "Shelf", W, D, yb), ...tubes("T", "Long tube", xt, zt, yb, yt - TR), tray("S", "Shelf", W, D, yt), ...tubes("L", "Leg", xt, zt, 0, yb - TR)];
  const ids = (p: string) => corners.map(([sx, sz]) => `${p}${sx}${sz}`);
  const steps: CustomStep[] = [
    {
      title: "Bolt the long tubes onto the bottom shelf",
      detail: "First turn a stud into one end of each of the eight tubes by hand until it stops. Push a connector bolt up through each corner of a shelf and turn a long tube onto it, stud end up.",
      add: ["B", ...ids("T")],
      fix: [
        { ...STUD, count: 4, at: at4(xt, zt, yt - TR), dir: [0, -1, 0] },
        { kind: "bolt", name: "Connector bolt", count: 4, len: 16, dia: 8, at: at4(xt, zt, yb - TR + 26), dir: [0, 1, 0], on: "B" },
      ],
      warnings: ["floor"],
    },
    { title: "Lower the top shelf onto the studs", detail: "Every stud goes through a corner hole. Turn the tubes until the shelf sits tight.", add: ["S"] },
    {
      title: "Turn it over and screw on the legs",
      detail: "Each short tube turns by its stud into the connector bolt under the bottom shelf.",
      add: ids("L"),
      fix: [{ ...STUD, count: 4, at: at4(xt, zt, yb - TR), dir: [0, -1, 0] }],
      pose: "-y",
    },
    { title: "Screw a flat bolt into each leg", detail: "Into the open end, with a flat screwdriver. They are the feet.", fix: [{ ...FLAT, count: 4, at: at4(xt, zt, 0), dir: [0, 1, 0] }], tools: ["flathead"] },
    { title: "Turn it over", detail: "To stack a second rack on top, take its legs off and screw its tubes onto this one instead.", pose: "+y" },
  ];
  return { parts, steps };
}

function coatRack(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const xt = W / 2 - 28, zt = D / 2 - 28;
  const y1 = 140, y2 = 400, yf0 = 1180, yf1 = 1880;
  const fh = yf1 - yf0;
  const rungY = fh / 2 - 30;
  const frame = (sx: number): CustomPart => ({
    id: `F${sx}`,
    name: "Side frame",
    size: [TUBE, fh, 2 * zt + TUBE],
    pos: [sx * xt, (yf0 + yf1) / 2, 0],
    material: "metal",
    pieces: [
      ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [TUBE, fh, TUBE], pos: [0, 0, sz * zt] })),
      ...[-1, 1].map((sy): PartPiece => ({ shape: "cyl", size: [18, 2 * zt - TUBE, 18], pos: [0, sy * rungY, 0], rot: [Math.PI / 2, 0, 0] })),
    ],
  });
  const railLen = 2 * xt - 18;
  const rail = (id: string, y: number): CustomPart => ({ id, name: "Hook rail", size: [railLen, 18, 18], pos: [0, y, 0], shape: "cyl", material: "metal" });
  const parts: CustomPart[] = [
    frame(-1),
    frame(1),
    ...tubes("U", "Short tube", xt, zt, yf1, H - TR),
    tray("T", "Shelf", W, D, H),
    ...tubes("L", "Long tube", xt, zt, y2, yf0),
    tray("S", "Shelf", W, D, y2),
    ...tubes("M", "Middle tube", xt, zt, y1, y2 - TR),
    tray("B", "Shelf", W, D, y1),
    ...tubes("G", "Leg", xt, zt, 0, y1 - TR),
    rail("R1", yf0 + fh / 2 + rungY),
    rail("R2", yf0 + fh / 2 - rungY),
  ];
  const ids = (p: string) => corners.map(([sx, sz]) => `${p}${sx}${sz}`);
  const hookX = [-0.36, -0.12, 0.12, 0.36].map((t) => t * railLen);
  const hooks = (id: string, y: number): CustomFix[] => [
    { kind: "hook", count: 4, len: 55, dia: 22, at: hookX.map((x): Vec3 => [x, y - 9, 0]), dir: [0, 1, 0], on: id },
    { kind: "clip", name: "Rivet", count: 4, len: 10, dia: 8, at: hookX.map((x): Vec3 => [x, y + 9, 0]), dir: [0, -1, 0], on: id },
  ];
  const yR1 = yf0 + fh / 2 + rungY, yR2 = yf0 + fh / 2 - rungY;
  const wallAt: Vec3[] = [-1, 1].map((sx): Vec3 => [sx * 200, H - TR / 2, -D / 2]);
  const steps: CustomStep[] = [
    {
      title: "Screw the studs into the side frames",
      detail: "Lay both frames on a rug. A stud into both ends of each tube, by hand until it stops.",
      fix: [-1, 1].flatMap((sx): CustomFix[] =>
        // pins kind, so the frames show up as they get their studs
        [yf0, yf1].map((y): CustomFix => ({ ...STUD, kind: "legScrew", count: 2, at: [-1, 1].map((sz): Vec3 => [sx * xt, y, sz * zt]), dir: [0, y === yf0 ? 1 : -1, 0], on: `F${sx}` })),
      ),
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Turn the short tubes onto the top studs", detail: "The shortest four tubes, one on each tube end at the top of the frames.", add: ids("U") },
    { title: "Bolt on the top shelf", detail: "A flat bolt through each corner into the short tubes, tightened with a flat screwdriver.", add: ["T"], fix: [{ ...FLAT, count: 4, at: at4(xt, zt, H - TR + 8), dir: [0, -1, 0], on: "T" }], tools: ["flathead"] }, // down through the tray's corner plate into the tube
    {
      title: "Screw the long tubes onto the frames",
      detail: "Turn a stud into one end of each long tube first. The plain end goes onto the frame's stud.",
      add: ids("L"),
      fix: [{ ...STUD, count: 4, at: at4(xt, zt, y2), dir: [0, 1, 0] }],
    },
    {
      title: "Fit the shoe shelf and the middle tubes",
      detail: "Turn a stud into one end of each middle tube. Push the shelf onto the long tubes' studs and turn a middle tube onto each one.",
      add: ["S", ...ids("M")],
      fix: [{ ...STUD, count: 4, at: at4(xt, zt, y1), dir: [0, 1, 0] }],
    },
    {
      title: "Fit the bottom shelf and the legs",
      detail: "A flat bolt into one end of each leg. Push the shelf onto the studs and turn a leg onto each one.",
      add: ["B", ...ids("G")],
      fix: [{ ...FLAT, count: 4, at: at4(xt, zt, 0), dir: [0, 1, 0] }],
      tools: ["flathead"],
    },
    { title: "Stand it up together", detail: "Tip it up onto its legs, close to the wall where it will stand.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Screw it to the wall",
      detail: "Two screws through the back of the top shelf. Put the spacers behind it if there's a skirting board. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "spacer", name: "Wall spacer", count: 2, len: 12, dia: 20, included: true, at: wallAt.map((p): Vec3 => [p[0], p[1], p[2] - 6]), dir: [0, 0, -1] },
        { kind: "plug", count: 2, len: 35, dia: 8, at: wallAt.map((p): Vec3 => [p[0], p[1], p[2] - 40]), dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 50, dia: 5, at: wallAt.map((p): Vec3 => [p[0], p[1], p[2] + 15]), dir: [0, 0, -1], on: "T" },
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Rivet the hooks on and click the rails in",
      detail: "Four hooks on each rail, a rivet pressed through each. Then click one rail under the top shelf and one across the middle of the frames.",
      add: ["R1", "R2"],
      fix: [...hooks("R1", yR1), ...hooks("R2", yR2)],
      from: { R1: [0, 0, 400], R2: [0, 0, 400] },
    },
    {
      title: "Hang the two loose hooks",
      detail: "Their straps go round the side frames wherever you want them.",
      fix: [{ kind: "hook", count: 2, len: 55, dia: 22, at: [-1, 1].map((sx): Vec3 => [sx * (xt + TUBE / 2), yR1 - 60, 0]), dir: [0, -1, 0] }],
    },
  ];
  return { parts, steps };
}

/** The sliding door shoe cabinet (US, 80 x 35 x 102): panels on dowels and cam locks, legs, tilted shelves, two doors on tracks. */
function shoeCabinet(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 18, LEG = 100;
  const y0 = LEG, yb = y0 + T, yt = H - T; // carcass bottom, inside bottom and inside top
  const xs = W / 2 - T / 2, xi = W / 2 - T;
  const ih = yt - yb;
  const zD1 = D / 2 - 35, zD2 = D / 2 - 13; // the two door tracks
  const dw = xi + 10, dh = ih - 16;
  const shelfYs = [0.25, 0.5, 0.75].map((t) => Math.round(yb + ih * t));
  const parts: CustomPart[] = [
    { id: "BOT", name: "Top and bottom", size: [W, T, D], pos: [0, y0 + T / 2, 0] },
    { id: "SL", name: "Side panel", size: [T, ih, D], pos: [-xs, (yb + yt) / 2, 0] },
    { id: "SR", name: "Side panel", size: [T, ih, D], pos: [xs, (yb + yt) / 2, 0] },
    { id: "BK", name: "Back panel", size: [2 * xi + 8, ih, 3], pos: [0, (yb + yt) / 2, -D / 2 + 12], material: "fiber" },
    { id: "TOP", name: "Top and bottom", size: [W, T, D], pos: [0, H - T / 2, 0] },
    ...[-1, 0, 1].map((k): CustomPart => ({ id: `LG${k}`, name: "Leg", size: [30, LEG, 30], pos: [k * (xi - 40), LEG / 2, D / 2 - 45], shape: "cyl", material: "metal" })),
    ...shelfYs.map((y, i): CustomPart => ({ id: `SH${i}`, name: "Shoe shelf", size: [2 * xi - 4, 16, 250], pos: [0, y, -D / 2 + 140], rot: [0.26, 0, 0] })),
    { id: "PO", name: "Middle post", size: [20, ih, 10], pos: [0, (yb + yt) / 2, zD1 - 22], material: "metal" },
    ...[zD1, zD2].map((z, i): CustomPart => ({ id: `TT${i}`, name: "Top track", size: [2 * xi, 8, 14], pos: [0, yt - 4, z], material: "metal" })),
    ...[zD1, zD2].map((z, i): CustomPart => ({ id: `BT${i}`, name: "Bottom track", size: [2 * xi, 8, 14], pos: [0, yb + 4, z], material: "metal" })),
    { id: "D1", name: "Sliding door", size: [dw, dh, 16], pos: [-xi + dw / 2, (yb + yt) / 2, zD1] },
    { id: "D2", name: "Sliding door", size: [dw, dh, 16], pos: [xi - dw / 2, (yb + yt) / 2, zD2] },
  ];
  const sides = [-1, 1];
  const sideId = (sx: number) => (sx < 0 ? "SL" : "SR");
  const camBolts = (id: string, y: number, dy: number): CustomFix => ({
    kind: "camScrew",
    count: 4,
    at: sides.flatMap((sx) => [-80, 80].map((z): Vec3 => [sx * xs, y, z])),
    dir: [0, dy, 0],
    on: id,
  });
  const camLocks = (y: number): CustomFix[] => sides.map((sx): CustomFix => ({ kind: "cam", count: 2, at: [-80, 80].map((z): Vec3 => [sx * xi, y, z]), dir: [sx, 0, 0], on: sideId(sx) }));
  const dowels: CustomFix[] = sides.flatMap((sx) => [yb, yt].map((y): CustomFix => ({ kind: "dowel", count: 3, at: [-140, 0, 140].map((z): Vec3 => [sx * xs, y, z]), dir: [0, y === yb ? 1 : -1, 0], on: sideId(sx) })));
  const legAt = [-1, 0, 1].map((k): Vec3 => [k * (xi - 40), y0, D / 2 - 45]);
  const SCREW = { kind: "screw" as const, len: 15, dia: 4 };
  const wallAt: Vec3[] = sides.map((sx): Vec3 => [sx * (xi - 30), yt - 30, -D / 2 + 14]);
  const runners = (id: string, x0: number, z: number): CustomFix[] => {
    const xsR = [x0 - dw / 2 + 50, x0 + dw / 2 - 50];
    return [
      { kind: "roller", name: "Top runner", count: 2, at: xsR.map((x): Vec3 => [x, yt - 8, z]), dir: [0, -1, 0], on: id },
      { kind: "roller", name: "Bottom runner", count: 2, at: xsR.map((x): Vec3 => [x, yb + 8, z]), dir: [0, 1, 0], on: id },
      { kind: "clip", name: "Runner pin", count: 8, len: 12, dia: 6, at: [yt - 12, yb + 12].flatMap((y) => xsR.flatMap((x) => [-12, 12].map((d): Vec3 => [x + d, y, z + 8]))), dir: [0, 0, -1], on: id },
    ];
  };
  const steps: CustomStep[] = [
    { title: "Screw the cam bolts into the bottom", detail: "Four into the bottom panel by hand, and four the same way into the top panel for later.", fix: [camBolts("BOT", yb, -1)], tools: ["screwdriver"], warnings: ["floor"] },
    { title: "Tap the dowels into the sides", detail: "Three into each end of both side panels, then stand the sides on the bottom panel.", fix: dowels, tools: ["hammer"] },
    { title: "Lock the sides to the bottom", detail: "Arrow towards the edge, then turn each cam lock until it pulls tight.", add: ["BOT", "SL", "SR"], fix: camLocks(yb + 30) },
    { title: "Slide in the back panel", detail: "Down into the grooves in the sides, white side in, until it sits in the bottom groove.", add: ["BK"], from: { BK: [0, 700, 0] } },
    { title: "Fit the top and lock it", detail: "Press it onto the dowels, then four more cam locks.", add: ["TOP"], fix: [camBolts("TOP", yt, 1), ...camLocks(yt - 30)] },
    {
      title: "Press in the back clips",
      detail: "Eight clips through the holes along the back edges of the sides, until they click.",
      fix: [{ kind: "clip", name: "Back clip", count: 8, len: 14, dia: 10, at: sides.flatMap((sx) => [0.1, 0.37, 0.63, 0.9].map((t): Vec3 => [sx * xs, yb + ih * t, -D / 2])), dir: [0, 0, 1] }],
    },
    {
      title: "Turn it upside down and screw on the leg plates",
      detail: "On a rug. Three plates along the front of the bottom, four screws in each.",
      fix: [
        { kind: "plate", count: 3, len: 50, dia: 50, at: legAt, dir: [0, 1, 0], on: "BOT" },
        { ...SCREW, count: 12, at: legAt.flatMap((p) => [[-17, -17], [17, -17], [17, 17], [-17, 17]].map(([dx, dz]): Vec3 => [p[0] + dx, y0 - 2, p[2] + dz])), dir: [0, 1, 0], on: "BOT" },
      ],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Screw the legs on", detail: "Each leg turns onto its plate by hand, and a flat foot bolt goes into its end.", add: ["LG-1", "LG0", "LG1"], fix: [{ kind: "bolt", name: "Foot bolt", count: 3, len: 16, dia: 8, at: legAt.map((p): Vec3 => [p[0], 0, p[2]]), dir: [0, 1, 0] }], tools: ["flathead"] },
    { title: "Screw on the two back feet", detail: "One adjustable foot in each back corner of the bottom.", fix: [{ kind: "foot", name: "Adjustable foot", count: 2, at: sides.map((sx): Vec3 => [sx * (xi - 30), y0, -D / 2 + 40]), dir: [0, 1, 0], on: "BOT" }] },
    { title: "Stand it up and level it", detail: "Turn the feet until it stands steady and level, close to the wall.", pose: "+y", tools: ["level"] },
    {
      title: "Screw it to the wall",
      detail: "Two screws with washers through the top of the back, then click the covers on. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 2, at: wallAt.map((p): Vec3 => [p[0], p[1], p[2] - 40]), dir: [0, 0, -1] },
        { kind: "washer", count: 2, len: 2, dia: 20, included: true, at: wallAt, dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 50, dia: 5, at: wallAt.map((p): Vec3 => [p[0], p[1], p[2] + 2]), dir: [0, 0, -1] },
        { kind: "cap", name: "Cover", count: 2, len: 8, dia: 30, included: true, at: wallAt.map((p): Vec3 => [p[0], p[1], p[2] + 10]), dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Push in the track stops",
      detail: "Four small pegs into the sides, by the front at the top and bottom.",
      fix: sides.map((sx): CustomFix => ({ kind: "clip", name: "Track stop", count: 2, len: 8, dia: 8, at: [yb + 10, yt - 10].map((y): Vec3 => [sx * xi, y, D / 2 - 50]), dir: [sx, 0, 0], on: sideId(sx) })),
    },
    {
      title: "Push in the shelf supports",
      detail: "Twelve of them, two each side for every shelf. Use the holes for sloping shelves, or the level ones for big shoes.",
      fix: sides.map((sx): CustomFix => ({ kind: "pin", name: "Shelf support", count: 6, at: shelfYs.flatMap((y) => [-D / 2 + 40, D / 2 - 120].map((z): Vec3 => [sx * xi, y - 30, z])), dir: [sx, 0, 0], on: sideId(sx) })),
    },
    { title: "Lay in the shoe shelves", detail: "Lip at the front edge facing up, resting on all four supports.", add: ["SH0", "SH1", "SH2"], from: { SH0: [0, 0, 400], SH1: [0, 0, 400], SH2: [0, 0, 400] } },
    { title: "Hook the middle post in at the top", detail: "Its top plate slides into the slot under the top panel.", add: ["PO"], from: { PO: [0, 0, 300] } },
    { title: "Screw the post to the bottom", detail: "Two screws through its foot plate.", fix: [{ ...SCREW, count: 2, at: [-12, 12].map((dx): Vec3 => [dx, yb, zD1 - 22]), dir: [0, -1, 0], on: "PO" }], tools: ["screwdriver"] },
    { title: "Push the top tracks up into the top", detail: "Both tracks clip into the grooves under the top panel.", add: ["TT0", "TT1"], from: { TT0: [0, -200, 0], TT1: [0, -200, 0] } },
    {
      title: "Slide in the bottom tracks",
      detail: "From the front, into the grooves of the bottom panel, then press them down along their length until they sit flat.",
      add: ["BT0", "BT1"],
      from: { BT0: [0, 0, 300], BT1: [0, 0, 300] },
    },
    { title: "Screw in the door stops", detail: "One block inside each side, at the top by the front, two screws each.", fix: [...sides.map((sx): CustomFix => ({ kind: "spacer", name: "Door stop", count: 1, len: 20, dia: 30, at: [[sx * xi, yt - 40, zD2]], dir: [sx, 0, 0], on: sideId(sx) })), ...sides.map((sx): CustomFix => ({ ...SCREW, count: 2, at: [-24, 24].map((dy): Vec3 => [sx * xi, yt - 40 + dy, zD2]), dir: [sx, 0, 0], on: sideId(sx) }))], tools: ["screwdriver"] },
    {
      title: "Fit the runners and hang the back door",
      detail: "Two runners at the top and two at the bottom of each door, two pins pressed into each. Tilt the door into the back track at the top, lower it onto the bottom track and click the locks shut.",
      add: ["D1"],
      fix: runners("D1", -xi + dw / 2, zD1),
      from: { D1: [0, 0, 400] },
      people: 2,
    },
    { title: "Hang the front door", detail: "The same way, into the front tracks, and click its locks shut.", add: ["D2"], fix: runners("D2", xi - dw / 2, zD2), from: { D2: [0, 0, 400] }, people: 2 },
    { title: "Adjust the doors", detail: "Turn the wheel on each bottom runner until the doors hang level and close against the stops." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["MACKAPÄR", "MACKAPAR"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^mackapar-shoe-rack/.test(slug)) return shoeRack(s);
    if (/^mackapar-coat-rack/.test(slug)) return coatRack(s);
    if (/^mackapar-shoe-cabinet/.test(slug)) return shoeCabinet(s);
    return null;
  },
};
export default family;
