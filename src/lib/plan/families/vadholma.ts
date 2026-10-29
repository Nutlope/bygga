import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * VADHOLMA, from IKEA's manuals. The ash open storage and drawer unit are one carcass: cam bolts and dowels in
 * the two sides, the top and bottom pushed onto one side lying on the floor and locked with cams, the back slid
 * into its grooves, the other side on top. Two hanging fittings go into the top corners and the unit is screwed
 * to the wall through them; the open storage gets two shelves on wire supports, the drawer unit two drawers on
 * runners. The 126 cm kitchen island is built standing on one end: the back panel and the two slatted shelves go
 * into the end frame on the floor, the top rails follow, the other end frame goes on top and everything is bolted
 * with barrel nuts; standing up, the oak worktop goes on with cam bolts and cams. The rack adds two J posts, a
 * shelf, a top bar and hooks. The 79 cm island has its own manual (drawer, towel rail, feet, wall bracket).
 */

const T = 18; // ash panels

const dowel = (at: Vec3[], dir: Vec3, on: string, mate?: string): CustomFix => ({ kind: "dowel", count: at.length, at, dir, on, mate, len: 30, dia: 8 });
const cams = (at: Vec3[], dir: Vec3, on: string): CustomFix => ({ kind: "cam", count: at.length, at, dir, on });
const camBolts = (at: Vec3[], dir: Vec3, on: string, mate?: string): CustomFix => ({ kind: "camScrew", count: at.length, at, dir, on, mate });

/* ---------- the ash carcass (open storage, drawer unit) ---------- */

function carcass(s: ProductSpec, what: "open" | "drawers"): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const iw = W - 2 * T, xs = W / 2 - T;
  const parts: CustomPart[] = [
    { id: "L", name: "Side", size: [T, H, D], pos: [-W / 2 + T / 2, H / 2, 0], material: "wood" },
    { id: "R", name: "Side", size: [T, H, D], pos: [W / 2 - T / 2, H / 2, 0], material: "wood" },
    { id: "top", name: "Top", size: [iw, T, D], pos: [0, H - T / 2, 0], material: "wood" },
    { id: "bot", name: "Bottom", size: [iw, T, D], pos: [0, T / 2, 0], material: "wood" },
    { id: "back", name: "Back panel", size: [iw, H - 2 * T, 6], pos: [0, H / 2, -D / 2 + 14], material: "fiber" },
  ];
  // cam bolts near the front and back edges, dowels between them, at the height of the top and bottom
  const ys = [H - T / 2, T / 2], zc = [-D / 2 + 50, D / 2 - 50], zd = [-D / 2 + 110, D / 2 - 110];
  const sideFits = (id: "L" | "R") => {
    const sx = id === "L" ? -1 : 1, x = sx * xs, d: Vec3 = [-sx, 0, 0];
    return [camBolts(ys.flatMap((y) => zc.map((z) => [x, y, z] as Vec3)), d, id), dowel(ys.flatMap((y) => zd.map((z) => [x, y, z] as Vec3)), d, id)];
  };
  const camsAt = (sx: number): CustomFix[] => [
    cams(zc.map((z) => [sx * (xs - 32), H - T, z] as Vec3), [0, 1, 0], "top"),
    cams(zc.map((z) => [sx * (xs - 32), T, z] as Vec3), [0, -1, 0], "bot"),
  ];
  const steps: CustomStep[] = [
    { title: "Fit the cam bolts and dowels in the left side", detail: "Lay it on a rug, inside up. Four cam bolts screwed in by hand, four dowels tapped in.", add: ["L"], fix: sideFits("L"), pose: "+x", warnings: ["floor"], tools: ["screwdriver", "hammer"] },
    { title: "Push the top and bottom onto the side", detail: "Their cam holes face the inside and the grooves for the back line up.", add: ["top", "bot"] },
    { title: "Turn the four cam locks", detail: "Arrows toward the edge, then a half turn clockwise.", fix: camsAt(-1), tools: ["screwdriver"] },
    { title: "Slide the back panel into the grooves", detail: "Finished side facing in, all the way down to the far end.", add: ["back"] },
    { title: "Fit the other side and lower it on", detail: "Cam bolts and dowels in the right side the same way, then set it down onto the top, bottom and back.", add: ["R"], fix: sideFits("R"), tools: ["screwdriver", "hammer"] },
    { title: "Turn the last four cam locks", fix: camsAt(1), tools: ["screwdriver"] },
  ];

  // two hanging fittings in the top corners, then two screws through them into the wall
  const hx = [-1, 1].map((sx) => sx * (xs - 25)), hz = -D / 2 + 40;
  steps.push(
    {
      title: "Screw a hanging fitting into each top corner",
      detail: "Stand the unit up. Push each fitting into the back corner under the top and fix it with its screw, then drill a 10 mm hole in the top above it to reach the adjuster.",
      pose: "+y",
      fix: [
        { kind: "connector", name: "Hanging fitting", count: 2, len: 50, dia: 40, at: hx.map((x) => [x, H - T - 30, hz] as Vec3), dir: [0, 1, 0], on: "top" },
        { kind: "screw", count: 2, len: 14, dia: 4, at: hx.map((x) => [x, H - T, hz] as Vec3), dir: [0, 1, 0], on: "top" },
      ],
      tools: ["screwdriver", "drill"],
    },
    {
      title: "Screw it to the wall",
      detail: "Hold it level against the wall and screw through each hanging fitting with a cup washer, then press on the covers. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 2, at: hx.map((x) => [x, H - T - 50, -D / 2 - 30] as Vec3), dir: [0, 0, -1] },
        { kind: "washer", name: "Cup washer", count: 2, len: 3, dia: 24, at: hx.map((x) => [x, H - T - 50, -D / 2 + 30] as Vec3), dir: [0, 0, -1], on: "back" },
        { kind: "screw", count: 2, len: 50, dia: 5, at: hx.map((x) => [x, H - T - 50, -D / 2 + 32] as Vec3), dir: [0, 0, -1], on: "back" },
        { kind: "cap", count: 2, at: hx.map((x) => [x, H - T - 50, -D / 2 + 36] as Vec3), dir: [0, 0, -1], on: "back" },
      ],
      wall: true,
      warnings: ["wall", "tip"],
      tools: ["level", "drill", "screwdriver"],
    },
  );

  if (what === "open") {
    const sy = [1, 2].map((i) => T + ((H - 2 * T) * i) / 3);
    sy.forEach((y, i) => parts.push({ id: `S${i}`, name: "Shelf", size: [iw - 2, T, D - 34], pos: [0, y, 8], material: "wood" }));
    steps.push(
      { title: "Clip the wire shelf supports into the sides", detail: "Hook both ends of each wire into the holes at the height you want, two wires per shelf.", fix: [-1, 1].map((sx): CustomFix => ({ kind: "pin", name: "Wire shelf support", count: 2, at: sy.map((y) => [sx * xs, y - T / 2 - 3, 8] as Vec3), dir: [sx, 0, 0], on: sx < 0 ? "L" : "R", len: 6, dia: 5 })) },
      { title: "Slide in the shelves", detail: "Push each one in over its wires until it sits flat on them.", add: ["S0", "S1"] },
    );
    return { parts, steps };
  }

  // two drawers, each a front with two sides, a back and a bottom, on a pair of runners
  const ih = H - 2 * T, gap = 4, fh = (ih - 3 * gap) / 2, bd = D - 50, dh = fh - 40;
  const runY: number[] = [];
  for (let i = 0; i < 2; i++) {
    const y0 = T + gap + i * (fh + gap), id = (k: string) => `${k}${i}`;
    const zf = D / 2 - T / 2, zb = D / 2 - T - bd, sw = iw - 2 * 14 - 8, by = y0 + 14 + dh / 2;
    parts.push(
      { id: id("F"), name: "Drawer front", size: [iw - 2 * gap, fh, T], pos: [0, y0 + fh / 2, zf], material: "wood" },
      { id: id("DL"), name: "Drawer side", size: [14, dh, bd], pos: [-sw / 2 - 7, by, D / 2 - T - bd / 2], material: "board" },
      { id: id("DR"), name: "Drawer side", size: [14, dh, bd], pos: [sw / 2 + 7, by, D / 2 - T - bd / 2], material: "board" },
      { id: id("DB"), name: "Drawer back", size: [sw, dh, 14], pos: [0, by, zb + 7], material: "board" },
      { id: id("DF"), name: "Drawer bottom", size: [sw, 6, bd - 14], pos: [0, y0 + 17, D / 2 - T - (bd - 14) / 2], material: "fiber" },
    );
    runY.push(y0 + 10);
  }
  // a runner inside each side for each drawer, two screws in each
  const rz = D / 2 - T - bd / 2, rl = bd - 20;
  const runners: CustomFix[] = [-1, 1].map((sx) => ({ kind: "runner", count: 2, len: rl, dia: 20, at: runY.map((y) => [sx * xs, y, rz] as Vec3), dir: [sx, 0, 0], on: sx < 0 ? "L" : "R" }));
  const rscrews: CustomFix[] = [-1, 1].map((sx) => ({ kind: "screw", count: 4, len: 14, dia: 4, at: runY.flatMap((y) => [-1, 1].map((k) => [sx * (xs - 12), y, rz + k * (rl / 2 - 40)] as Vec3)), dir: [sx, 0, 0], on: sx < 0 ? "L" : "R" }));
  steps.push({ title: "Screw the runners inside the sides", detail: "Two pairs, one for each drawer. Two screws in each runner, the runner's open end to the front.", fix: [...runners, ...rscrews], tools: ["screwdriver"] });
  const drawer = (i: number): CustomStep[] => {
    const id = (k: string) => `${k}${i}`;
    const fz = D / 2 - T, fy = T + gap + i * (fh + gap) + 14 + dh / 2;
    const sx = (iw - 2 * 14 - 8) / 2 + 7;
    return [
      {
        title: i ? "Build the second drawer the same way" : "Fit cam bolts and dowels in the drawer front",
        detail: i ? "Front face down, sides on, cams, bottom, back." : "Lay the front face down on a rug. Two cam bolts and four dowels along its inside, then push the sides onto them.",
        // all along the cam bolts: the sides come in through the opening, then the front closes onto them
        add: [id("DL"), id("DR"), id("F")],
        from: { [id("DL")]: [0, 0, 350], [id("DR")]: [0, 0, 350], [id("F")]: [0, 0, 350] },
        fix: [
          camBolts([-1, 1].map((k) => [k * sx, fy, fz] as Vec3), [0, 0, 1], id("F")),
          dowel([-1, 1].flatMap((k) => [-1, 1].map((j) => [k * sx, fy + j * (dh / 2 - 25), fz] as Vec3)), [0, 0, 1], id("F")),
          cams([[-sx - 7, fy, fz - 34]], [1, 0, 0], id("DL")),
          cams([[sx + 7, fy, fz - 34]], [-1, 0, 0], id("DR")),
        ],
        tools: ["screwdriver", "hammer"],
      },
      { title: i ? "Slide in its bottom and screw on the back" : "Slide in the bottom and screw on the back", detail: "Bottom into the grooves of the sides and front, then the back over it with two long screws on each side, using the Allen key.", add: [id("DF"), id("DB")], fix: [-1, 1].map((k): CustomFix => ({ kind: "bolt", count: 2, len: 40, dia: 5, at: [-1, 1].map((j) => [k * (sx + 7), fy + j * (dh / 2 - 20), D / 2 - T - bd + 7] as Vec3), dir: [-k, 0, 0], on: id(k < 0 ? "DL" : "DR"), mate: id("DB") })) },
      { title: i ? "Clip its runner locks on and push it in" : "Clip the runner locks under the front and push the drawer in", detail: "One lock under each front corner, screwed in. Pull the runners out, set the drawer on them and push it home until it clicks.", fix: [{ kind: "clip", name: "Runner lock", count: 2, at: [-1, 1].map((k) => [k * (sx - 20), T + gap + i * (fh + gap) + 10, D / 2 - T - 40] as Vec3), dir: [0, 1, 0] }] },
    ];
  };
  steps.push(...drawer(0), ...drawer(1));
  return { parts, steps };
}

/* ---------- the kitchen island, 126 cm ---------- */

function island(s: ProductSpec, rack: boolean): CustomParams {
  const W = 1260, D = 790, TT = 40, FH = 860; // worktop, frame height
  const FX = W / 2 - 30, LW = 45, FZ = D / 2 - 35; // end frames' outer faces, leg size, legs' outer faces
  const ix = FX - LW, lz = FZ - LW / 2, rl = 2 * (FZ - LW);
  const endRails = [FH - 30, 440, 120];
  const endFrame = (id: string, sx: number): CustomPart => ({
    id,
    name: "End frame",
    size: [LW, FH, 2 * FZ],
    pos: [sx * (FX - LW / 2), FH / 2, 0],
    material: "wood",
    pieces: [
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [LW, FH, LW], pos: [0, 0, sz * lz] })),
      ...endRails.map((y): PartPiece => ({ shape: "box", size: [LW, 60, rl], pos: [0, y - FH / 2, 0] })),
    ],
  });
  const zp = -(FZ - LW) - 0; // back panel's back face, against the back legs
  const pz = zp + 9, sz0 = zp + 18, sz1 = FZ - LW, sd = sz1 - sz0, szc = (sz0 + sz1) / 2;
  const shelfY = [125, 445];
  const slats = 14;
  const shelf = (id: string, y: number): CustomPart => ({
    id,
    name: "Slatted shelf",
    size: [2 * ix, 50, sd],
    pos: [0, y, szc],
    material: "wood",
    pieces: [
      ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [2 * ix, 50, 30], pos: [0, 0, k * (sd / 2 - 15)] })),
      ...[-1, 1].map((k): PartPiece => ({ shape: "box", size: [30, 50, sd - 60], pos: [k * (ix - 15), 0, 0] })),
      ...Array.from({ length: slats }, (_, i): PartPiece => ({ shape: "box", size: [48, 16, sd - 60], pos: [-ix + 60 + ((2 * ix - 120) * i) / (slats - 1), 17, 0] })),
    ],
  });
  const rz = FZ - LW / 2 - 8;
  const parts: CustomPart[] = [
    { id: "P", name: "Back panel", size: [2 * ix, 650, 18], pos: [0, 475, pz], material: "board" },
    endFrame("EL", -1),
    shelf("S0", shelfY[0]),
    shelf("S1", shelfY[1]),
    { id: "RF", name: "Top rail", size: [2 * ix, 60, 30], pos: [0, FH - 30, rz], material: "wood" },
    { id: "RB", name: "Top rail", size: [2 * ix, 60, 30], pos: [0, FH - 30, -rz], material: "wood" },
    endFrame("ER", 1),
    { id: "TOP", name: "Worktop", size: [W, TT, D], pos: [0, FH + TT / 2, 0], material: "wood" },
  ];
  const BOLT = { kind: "bolt" as const, len: 60, dia: 6 };
  const LONG = { kind: "bolt" as const, len: 100, dia: 6 };
  const BARREL = { kind: "nut" as const, name: "Barrel nut", len: 14, dia: 10 };
  const ANGLE = { kind: "angle" as const, len: 40, dia: 40, name: "Angle plate" };
  const shelfDowels = (id: string, y: number) => [-1, 1].map((sx) => dowel([-1, 1].map((k) => [sx * ix, y, szc + k * (sd / 2 - 15)] as Vec3), [sx, 0, 0], id));
  const shelfBolts = (id: string, y: number): CustomFix => ({ ...BOLT, count: 3, at: [-150, 0, 150].map((dz) => [-FX, y, szc + dz] as Vec3), dir: [1, 0, 0], on: "EL", mate: id });
  // each plate sits on the shelf against the panel: one screw down into the shelf, one back into the panel
  const angles = (id: string, y: number): CustomFix[] => [
    { ...ANGLE, count: 2, at: [-300, 300].map((x) => [x, y + 25, sz0] as Vec3), dir: [0, -1, 0], on: id, mate: "P" },
    { kind: "screw", count: 2, len: 16, dia: 4, at: [-300, 300].map((x) => [x, y + 25, sz0 + 20] as Vec3), dir: [0, -1, 0], on: id },
    { kind: "screw", count: 2, len: 16, dia: 4, at: [-300, 300].map((x) => [x, y + 50, sz0] as Vec3), dir: [0, 0, -1], on: "P" },
  ];
  const topPts: Vec3[] = [-450, -200, 200, 450].flatMap((x) => [rz, -rz].map((z) => [x, FH, z] as Vec3));
  const steps: CustomStep[] = [
    { title: "Tap three dowels into each end of the back panel", detail: "Lay the panel on a rug while you do it.", add: ["P"], fix: [-1, 1].map((sx) => dowel([300, 475, 650].map((y) => [sx * ix, y, pz] as Vec3), [sx, 0, 0], "P")), pose: "+x", tools: ["hammer"], warnings: ["floor"] },
    { title: "Stand the back panel in an end frame", detail: "Lay the end frame flat on the rug and push the panel's dowels into its holes, along the back legs.", add: ["EL"] },
    { title: "Tap dowels into the bottom shelf and lower it in", detail: "Two dowels in each end. One of you holds the panel while the other lowers the shelf in front of it.", add: ["S0"], fix: shelfDowels("S0", shelfY[0]), people: 2, tools: ["hammer"] },
    { title: "Bolt the bottom shelf to the end frame", detail: "Three bolts through the end frame, tightened with the Allen key in its holder.", fix: [shelfBolts("S0", shelfY[0])] },
    { title: "Screw two angle plates between the shelf and the panel", fix: angles("S0", shelfY[0]), tools: ["screwdriver"] },
    { title: "Fit the middle shelf the same way", detail: "Two dowels in each end, lower it in together.", add: ["S1"], fix: shelfDowels("S1", shelfY[1]), people: 2, tools: ["hammer"] },
    { title: "Bolt the middle shelf to the end frame", fix: [shelfBolts("S1", shelfY[1])] },
    { title: "Tap dowels into the top rails and push them in", detail: "Two dowels in one end of each rail, into the top of the end frame at the front and back.", add: ["RF", "RB"], fix: ["RF", "RB"].map((id) => dowel([-15, 15].map((dy) => [-ix, FH - 30 + dy, id === "RF" ? rz : -rz] as Vec3), [-1, 0, 0], id)), tools: ["hammer"] },
    { title: "Lay the second end frame on top", detail: "Lower it together so all the dowels and rail ends go into its holes.", add: ["ER"], people: 2 },
    {
      title: "Bolt the second end frame to the shelves",
      detail: "Push a barrel nut into each hole in the shelf rails, slot facing the bolt, then turn a long bolt into each through the end frame.",
      fix: [
        { ...BARREL, count: 4, at: shelfY.flatMap((y) => [-1, 1].map((k) => [ix - 40, y + 25, szc + k * (sd / 2 - 15)] as Vec3)), dir: [0, -1, 0] },
        { ...LONG, count: 4, at: shelfY.flatMap((y) => [-1, 1].map((k) => [FX, y, szc + k * (sd / 2 - 15)] as Vec3)), dir: [-1, 0, 0], on: "ER" },
      ],
      tools: ["allen", "screwdriver"],
    },
    { title: "Stand the island up together", detail: "Lift it by the end frames.", pose: "+y", people: 2, kind: "standup" },
    {
      title: "Bolt the top rails to the end frames",
      detail: "A barrel nut into the top of each rail end, then a long bolt through the end frame into it.",
      fix: [
        { ...BARREL, count: 4, at: [-1, 1].flatMap((sx) => [rz, -rz].map((z) => [sx * (ix - 40), FH, z] as Vec3)), dir: [0, -1, 0] },
        ...[-1, 1].map((sx): CustomFix => ({ ...LONG, count: 2, at: [rz, -rz].map((z) => [sx * FX, FH - 30, z] as Vec3), dir: [-sx, 0, 0], on: sx < 0 ? "EL" : "ER" })),
      ],
      tools: ["allen", "screwdriver"],
    },
    { title: "Screw two angle plates between the middle shelf and the panel", fix: angles("S1", shelfY[1]), tools: ["screwdriver"] },
    { title: "Tap five dowels into the top of the frame", detail: "One in each end frame and three along the top rails.", fix: [{ kind: "dowel", count: 5, len: 30, dia: 8, at: [[-(FX - LW / 2), FH, 0], [FX - LW / 2, FH, 0], [0, FH, rz], [-300, FH, -rz], [300, FH, -rz]], dir: [0, 1, 0] }], tools: ["hammer"] },
    { title: "Screw cam bolts into the worktop and lay it on", detail: "Eight cam bolts into the holes underneath, then lower the worktop onto the dowels together.", add: ["TOP"], fix: [camBolts(topPts, [0, 1, 0], "TOP")], people: 2, tools: ["screwdriver"] },
    { title: "Lock the worktop with eight cams", detail: "Push a cam into each hole on the inside of the top rails and turn it clockwise.", fix: [cams(topPts.filter((p) => p[2] > 0).map((p) => [p[0], FH - 20, rz - 15] as Vec3), [0, 0, 1], "RF"), cams(topPts.filter((p) => p[2] < 0).map((p) => [p[0], FH - 20, -rz + 15] as Vec3), [0, 0, -1], "RB")], tools: ["screwdriver"] },
  ];
  if (!rack) return { parts, steps };

  // the rack: two J posts bolted to the end frames, a shelf, a top bar and hooks
  const PX = FX + 14, PD = 28, SY = 1560, TOPY = 1930;
  const post = (id: string, sx: number): CustomPart => ({
    id,
    name: "Rack post",
    size: [PD, SY - 220, PD],
    pos: [sx * PX, (SY + 220) / 2, 0],
    shape: "cyl",
    material: "metal",
  });
  parts.push(
    post("JL", -1),
    post("JR", 1),
    { id: "RS", name: "Rack shelf", size: [2 * PX + PD, 24, 220], pos: [0, SY + 12, 0], material: "metal" },
    {
      id: "TB",
      name: "Top bar",
      size: [2 * PX + PD, TOPY - SY - 24, PD],
      pos: [0, (SY + 24 + TOPY) / 2, 0],
      material: "metal",
      pieces: [
        ...[-1, 1].map((sx): PartPiece => ({ shape: "cyl", size: [PD, TOPY - SY - 24, PD], pos: [sx * PX, 0, 0] })),
        { shape: "cyl", size: [PD, 2 * PX, PD], pos: [0, (TOPY - SY - 24) / 2 - PD / 2, 0], rot: [0, 0, Math.PI / 2] },
      ],
    },
  );
  const postBolts = (sx: number): CustomFix[] => [
    { kind: "nut", name: "Sleeve nut", count: 2, len: 20, dia: 10, at: [440, FH - 30].map((y) => [sx * FX, y, 0] as Vec3), dir: [-sx, 0, 0], on: sx < 0 ? "EL" : "ER" },
    { kind: "bolt", count: 2, len: 30, dia: 6, at: [440, FH - 30].map((y) => [sx * (PX + PD / 2), y, 0] as Vec3), dir: [-sx, 0, 0], on: sx < 0 ? "JL" : "JR" },
  ];
  steps.push(
    { title: "Bolt the left post to the end frame", detail: "Push the two sleeve nuts into the holes in the end frame, then bolt the post on through them with the Allen key.", add: ["JL"], fix: postBolts(-1), tools: ["allen"] },
    { title: "Bolt the right post on the same way", add: ["JR"], fix: postBolts(1), tools: ["allen"] },
    { title: "Lower the rack shelf onto the posts", detail: "Its sockets slide down over the post tops.", add: ["RS"] },
    { title: "Screw the shelf to the posts", detail: "Two small screws into each post with the Allen key.", fix: [-1, 1].map((sx): CustomFix => ({ kind: "bolt", count: 2, len: 10, dia: 5, at: [-40, 40].map((z) => [sx * (PX + PD / 2), SY + 12, z] as Vec3), dir: [-sx, 0, 0], on: "RS" })), tools: ["allen"] },
    { title: "Lower the top bar onto the shelf", add: ["TB"] },
    { title: "Screw the top bar on", detail: "Two small screws on each side.", fix: [-1, 1].map((sx): CustomFix => ({ kind: "bolt", count: 2, len: 10, dia: 5, at: [SY + 50, SY + 90].map((y) => [sx * (PX + PD / 2), y, 0] as Vec3), dir: [-sx, 0, 0], on: "TB" })), tools: ["allen"] },
    { title: "Hang the ten hooks on the shelf rail", fix: [{ kind: "hook", count: 10, at: Array.from({ length: 10 }, (_, i) => [-PX + 80 + ((2 * PX - 160) * i) / 9, SY, 100] as Vec3), dir: [0, 1, 0] }] },
  );
  return { parts, steps };
}

/* ---------- the kitchen island, 79 cm ---------- */

// Its own manual: two ready-made end frames take adjustable feet; built on its back, the back rail and the two
// slatted shelves go into one end frame on dowels and long bolts with barrel nuts, then lying on that frame the other
// one goes on top. Standing, the towel rail is screwed to the right end frame, the drawer runners inside both, and the
// oak worktop goes on with dowels, cam bolts and cams; a bracket under the worktop fixes it to the wall. The drawer
// is built on its front (cam bolts, sides, a middle support bar, the bottom, the back on push-in connectors), gets
// runner locks and a handle, and slides in on the runners.
function island79(): CustomParams {
  const W = 790, D = 625, H = 900, TT = 60, FH = H - TT;
  const lx = W / 2 - 10 - 22.5, lz = D / 2 - 10 - 22.5, LW = 45; // leg centres
  const ix = lx - LW / 2, iz = lz - LW / 2; // inner faces of the legs
  const yTR = FH - 40; // end frames' top rails and the back rail, centre
  const shelfTop = [500, 245];
  const endFrame = (id: string, sx: number): CustomPart => ({
    id,
    name: "End frame",
    size: [LW, FH, 2 * lz + LW],
    pos: [sx * lx, FH / 2, 0],
    material: "wood",
    pieces: [
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [LW, FH, LW], pos: [0, 0, sz * lz] })),
      { shape: "box", size: [20, 80, 2 * iz], pos: [0, yTR - FH / 2, 0] },
      ...shelfTop.map((y): PartPiece => ({ shape: "box", size: [20, 50, 2 * iz], pos: [0, y - 25 - FH / 2, 0] })),
    ],
  });
  const shelf = (id: string, top: number): CustomPart => ({
    id,
    name: "Slatted shelf",
    size: [2 * ix, 60, 2 * lz + 20],
    pos: [0, top - 30, 0],
    material: "wood",
    pieces: [
      ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [2 * ix, 60, 20], pos: [0, 0, sz * lz] })),
      ...Array.from({ length: 7 }, (_, i): PartPiece => ({ shape: "box", size: [70, 18, 2 * lz - 20], pos: [-ix + 50 + (i * (2 * ix - 100)) / 6, 21, 0] })),
    ],
  });
  // the drawer, under the worktop between the end frames' top rails
  const dy = FH - 65, dfz = lz + LW / 2 - 10, dd = 480, dsx = ix - 10 - 22, dz = dfz - 10 - dd / 2;
  const parts: CustomPart[] = [
    endFrame("E0", -1),
    endFrame("E1", 1),
    { id: "BR", name: "Back rail", size: [2 * ix, 80, 20], pos: [0, yTR, -lz], material: "wood" },
    shelf("S0", shelfTop[0]),
    shelf("S1", shelfTop[1]),
    { id: "TR", name: "Towel rail", size: [20, 20, 2 * lz - 60], pos: [W / 2 + 30, yTR - 10, 0], shape: "cyl", material: "metal" },
    { id: "WT", name: "Worktop", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    { id: "DF", name: "Drawer front", size: [2 * ix - 4, 110, 20], pos: [0, dy, dfz], material: "wood" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `DS${i}`, name: "Drawer side", size: [16, 90, dd], pos: [sx * dsx, dy, dz], material: "wood" })),
    { id: "DB", name: "Drawer bottom", size: [2 * dsx - 16, 4, dd - 20], pos: [0, dy - 38, dz + 5], material: "fiber" },
    { id: "BAR", name: "Support bar", size: [20, 6, dd - 30], pos: [0, dy - 43, dz + 5], material: "metal" },
    { id: "DK", name: "Drawer back", size: [2 * dsx - 16, 90, 16], pos: [0, dy, dfz - 10 - dd + 8], material: "wood" },
  ];
  const S = [-1, 1];
  const ef = (sx: number) => (sx < 0 ? "E0" : "E1");
  const NUT = { name: "Barrel nut", len: 14, dia: 10 };
  const BOLT = { len: 100, dia: 6 };
  // the back rail and each shelf rail meet a leg: dowels in the end, a bolt through the leg into a barrel nut
  const brDowels = (sx: number) => dowel([yTR - 30, yTR + 30].map((y) => [sx * ix, y, -lz] as Vec3), [-sx, 0, 0], "BR", ef(sx));
  const brNuts = (sx: number): CustomFix => ({ kind: "nut", count: 2, at: [yTR - 14, yTR + 14].map((y) => [sx * (ix - 40), y, -lz + 10] as Vec3), dir: [0, 0, -1], on: "BR", ...NUT });
  const brBolts = (sx: number): CustomFix => ({ kind: "bolt", count: 2, at: [yTR - 14, yTR + 14].map((y) => [sx * (lx + LW / 2), y, -lz] as Vec3), dir: [-sx, 0, 0], on: ef(sx), mate: "BR", ...BOLT });
  const shDowels = (id: string, top: number): CustomFix[] =>
    S.map((sx) => dowel(S.flatMap((sz) => [-24, 8, 24].map((dy2) => [sx * ix, top - 30 + dy2, sz * lz] as Vec3)), [-sx, 0, 0], id, ef(sx)));
  const shNuts = (sx: number): CustomFix => ({ kind: "nut", count: 4, at: shelfTop.flatMap((t) => S.map((sz) => [sx * (ix - 40), t - 38, sz * (lz - 10)] as Vec3)), dir: [0, 1, 0], ...NUT });
  const shBolts = (sx: number): CustomFix => ({ kind: "bolt", count: 4, at: shelfTop.flatMap((t) => S.map((sz) => [sx * (lx + LW / 2), t - 38, sz * lz] as Vec3)), dir: [-sx, 0, 0], on: ef(sx), ...BOLT });
  const runY = dy - 10;
  const away = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, [0, 0, 700] as Vec3]));
  const drawerIds = ["DF", "DS0", "DS1", "BAR", "DB", "DK"];
  const steps: CustomStep[] = [
    {
      title: "Screw the feet into the end frames",
      detail: "One adjustable foot into the bottom of each leg, turned in by hand.",
      add: ["E0"],
      wait: ["E1"],
      fix: [{ kind: "foot", count: 4, len: 30, dia: 30, at: S.flatMap((sx) => S.map((sz) => [sx * lx, 0, sz * lz] as Vec3)), dir: [0, 1, 0] }],
      warnings: ["floor"],
    },
    { title: "Tap four dowels into the back rail", detail: "Two into each end.", fix: [brDowels(-1), brDowels(1)], tools: ["hammer"], wait: ["BR"] },
    {
      title: "Turn an end frame on its side and fit the back rail",
      detail: "Its back legs on the rug. The rail's dowels go into the holes at the top of the back leg; the holes for the drawer runners face in.",
      add: ["BR"],
      pose: "+z",
    },
    { title: "Push two barrel nuts into the rail", detail: "Slot towards the bolt holes, so the bolts can catch them.", fix: [brNuts(-1)], tools: ["flathead"] },
    { title: "Bolt the rail to the leg", detail: "Two long bolts through the leg, tightened with the Allen key.", fix: [brBolts(-1)], tools: ["allen"] },
    { title: "Tap twelve dowels into each shelf", detail: "Three into each end of both rails.", fix: [...shDowels("S0", shelfTop[0]), ...shDowels("S1", shelfTop[1])], tools: ["hammer"], wait: ["S0", "S1"] },
    { title: "Fit the two shelves into the end frame", detail: "Slats facing up, into the holes in the legs.", add: ["S0", "S1"], from: { S0: [500, 0, 0], S1: [500, 0, 0] } },
    { title: "Bolt the shelves on", detail: "A barrel nut in each rail end, then four bolts through the legs.", fix: [shNuts(-1), shBolts(-1)], tools: ["allen", "flathead"] },
    { title: "Stand it on the end frame", detail: "Tip it so the end frame lies flat on the rug and the shelves and rail point up.", pose: "+x" },
    {
      title: "Bolt on the other end frame",
      detail: "Feet the same way as the first. Lower it onto all the dowels, then six barrel nuts and six bolts.",
      add: ["E1"],
      fix: [brNuts(1), shNuts(1), brBolts(1), shBolts(1)],
      tools: ["allen", "flathead"],
    },
    {
      title: "Stand it up and drill for the towel rail",
      detail: "Clamp a piece of scrap wood inside the top rail of the right end frame, then drill the two marked holes with a 5 mm bit so the wood doesn't split.",
      pose: "+y",
      tools: ["drill"],
      people: 2,
    },
    {
      title: "Screw on the towel rail",
      detail: "Two screws from inside the top rail, a spacer behind each end.",
      add: ["TR"],
      fix: [
        { kind: "washer", name: "Spacer", count: 2, len: 6, dia: 20, at: [-1, 1].map((sz) => [W / 2 + 8, yTR - 10, sz * (lz - 30)] as Vec3), dir: [-1, 0, 0], on: "TR" },
        { kind: "screw", count: 2, len: 45, dia: 5, at: [-1, 1].map((sz) => [lx - 10, yTR - 10, sz * (lz - 30)] as Vec3), dir: [1, 0, 0], on: "E1", mate: "TR" },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the drawer runners inside the end frames",
      detail: "One on each side, two screws in each, the stop end to the back.",
      fix: [
        ...S.map((sx): CustomFix => ({ kind: "runner", count: 1, len: dd - 40, dia: 20, at: [[sx * (lx - 10), runY, dz]], dir: [sx, 0, 0], on: ef(sx) })),
        ...S.map((sx): CustomFix => ({ kind: "screw", count: 2, len: 14, dia: 4, at: [-1, 1].map((k) => [sx * (lx - 10), runY, dz + k * (dd / 2 - 60)] as Vec3), dir: [sx, 0, 0], on: ef(sx) })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Tap six dowels into the top of the frame",
      detail: "Two into each end frame and two into the back rail.",
      fix: [
        ...S.map((sx) => dowel([-60, 60].map((z) => [sx * lx, FH, z] as Vec3), [0, -1, 0], ef(sx), "WT")),
        dowel([-100, 100].map((x) => [x, FH, -lz] as Vec3), [0, -1, 0], "BR", "WT"),
      ],
      tools: ["hammer"],
    },
    {
      title: "Screw six cam bolts into the worktop",
      detail: "Lay it upside down on a rug, by hand into the holes along the edges.",
      fix: [camBolts([...S.flatMap((sx) => [-150, 150].map((z) => [sx * lx, FH, z] as Vec3)), ...[-200, 200].map((x) => [x, FH, -lz] as Vec3)], [0, 1, 0], "WT")],
      tools: ["screwdriver"],
      wait: ["WT"],
    },
    {
      title: "Lay the worktop on",
      detail: "Lift it together, cam bolts down, and lower it straight onto the dowels. Mind your fingers at the edges.",
      add: ["WT"],
      people: 2,
      warnings: ["two", "hand"],
    },
    {
      title: "Lock the worktop",
      detail: "Six cam locks in the top rails and the back rail, arrow towards the bolt, then turn clockwise.",
      fix: [
        ...S.map((sx) => cams([-150, 150].map((z) => [sx * (lx - 10), FH - 25, z] as Vec3), [sx, 0, 0], ef(sx))),
        cams([-200, 200].map((x) => [x, FH - 25, -lz + 10] as Vec3), [0, 0, -1], "BR"),
      ],
      tools: ["screwdriver"],
    },
    { title: "Level it with the feet", detail: "Push it where it will stand and turn the four feet until it stands level and doesn't rock.", tools: ["level"] },
    { title: "Mark the wall under the worktop", detail: "With the back against the wall, draw a line on the wall along the underside of the worktop.", tools: ["pencil"], wall: true },
    {
      title: "Screw the wall bracket to the wall",
      detail: "Pull the island away. Hold the bracket's upright leg on the line and screw it on with the washer. The wall screw and plug aren't included: pick ones made for your wall.",
      fix: [
        { kind: "bracket", name: "Wall bracket", count: 1, len: 60, dia: 30, at: [[0, FH - 20, -D / 2 - 2]], dir: [0, 0, -1] },
        { kind: "plug", count: 1, at: [[0, FH - 40, -D / 2 - 30]], dir: [0, 0, -1] },
        { kind: "washer", count: 1, at: [[0, FH - 40, -D / 2 + 1]], dir: [0, 0, -1], included: true },
        { kind: "screw", count: 1, len: 50, dia: 5, at: [[0, FH - 40, -D / 2 + 2]], dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver", "level"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Push it back and screw the bracket to the worktop",
      detail: "Slide the island against the wall so the bracket's flat leg goes under the worktop, then one screw up through the slot.",
      fix: [{ kind: "screw", count: 1, len: 16, dia: 4, at: [[0, FH, -D / 2 + 20]], dir: [0, 1, 0], on: "WT" }],
      tools: ["screwdriver"],
      wall: true,
    },
    {
      title: "Screw two cam bolts into the drawer front",
      detail: "Lay it face down on a rug, one bolt near each end.",
      fix: [camBolts(S.map((sx) => [sx * dsx, dy, dfz - 10] as Vec3), [0, 0, 1], "DF", undefined)],
      tools: ["screwdriver"],
      wait: ["DF"],
      from: away(["DF"]),
    },
    {
      title: "Screw a small screw into the middle of the front",
      detail: "Not all the way: leave the head standing out so the support bar can hook onto it.",
      fix: [{ kind: "screw", count: 1, len: 12, dia: 4, at: [[0, dy - 43, dfz - 10]], dir: [0, 0, 1], on: "DF" }],
      tools: ["screwdriver"],
    },
    {
      title: "Tap a dowel into each drawer side",
      detail: "Into the front end, next to the groove.",
      fix: S.map((sx, i) => dowel([[sx * dsx, dy + 25, dfz - 10]], [0, 0, -1], `DS${i}`, "DF")),
      tools: ["hammer"],
      wait: ["DS0", "DS1"],
      from: away(["DS0", "DS1"]),
    },
    { title: "Push the sides onto the front", detail: "Grooves facing in, onto the dowels and cam bolts.", repeat: 2 },
    {
      title: "Lock the sides",
      detail: "One cam lock in each side, then turn clockwise.",
      fix: S.map((sx, i) => cams([[sx * (dsx + 8), dy, dfz - 45]], [-sx, 0, 0], `DS${i}`)),
      tools: ["screwdriver"],
    },
    { title: "Hook the support bar onto the screw", detail: "Its hook end over the screw head in the middle of the front.", wait: ["BAR"], from: away(["BAR"]) },
    { title: "Slide in the drawer bottom", detail: "Down the grooves in the sides and front, over the support bar.", wait: ["DB"], from: away(["DB"]) },
    { title: "Lay the back on", detail: "Between the sides at the open end, notched edge over the bottom.", wait: ["DK"], from: away(["DK"]) },
    {
      title: "Fix the back with four connectors",
      detail: "Two through each side into the back, knocked in with a hammer.",
      fix: S.map((sx, i): CustomFix => ({ kind: "bolt", name: "Push-in connector", count: 2, len: 40, dia: 8, at: [-22, 22].map((d) => [sx * (dsx + 8), dy + d, dfz - 10 - dd + 8] as Vec3), dir: [-sx, 0, 0], on: `DS${i}`, mate: "DK" })),
      tools: ["hammer"],
    },
    {
      title: "Screw the support bar to the back",
      detail: "One small screw through its bent end.",
      fix: [{ kind: "screw", count: 1, len: 12, dia: 4, at: [[0, dy - 40, dfz - 10 - dd + 16]], dir: [0, 1, 0], on: "DK" }],
      tools: ["screwdriver"],
    },
    {
      title: "Clip a runner lock under each front corner",
      detail: "Into the two holes under the bottom of each side, at the front.",
      fix: S.map((sx, i): CustomFix => ({ kind: "clip", name: "Runner lock", count: 1, len: 40, dia: 20, at: [[sx * dsx, dy - 45, dfz - 60]], dir: [0, 1, 0], on: `DS${i}` })),
    },
    {
      title: "Turn it over and drill for the handle",
      detail: "Clamp scrap wood behind the front, then drill the two marked holes with a 5 mm bit.",
      tools: ["drill"],
    },
    {
      title: "Screw on the handle",
      detail: "Two screws from inside the drawer.",
      fix: [
        { kind: "handle", count: 1, len: 96, dia: 20, at: [[0, dy, dfz + 10]], dir: [0, 0, -1], on: "DF" },
        { kind: "screw", count: 2, len: 45, dia: 5, at: S.map((sx) => [sx * 48, dy, dfz - 10] as Vec3), dir: [0, 0, 1], on: "DF" },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Pull out the runners and set the drawer on",
      detail: "Lay it on the pulled-out runners so the locks are over their ends.",
      add: drawerIds,
      from: Object.fromEntries(drawerIds.map((id) => [id, [0, 0, 1120] as Vec3])),
    },
    { title: "Push it in until it clicks", detail: "The locks catch the runners. Turn the wheel on each lock if the front needs lifting to sit level.", kind: "drawer", tools: ["screwdriver"] },
  ];
  return { parts, steps };
}

function recipe(s: ProductSpec): CustomParams | null {
  const v = `${s.slug ?? ""} ${s.variant}`.toLowerCase();
  if (/open-storage|open storage/.test(v)) return carcass(s, "open");
  if (/drawer-unit|drawer unit/.test(v)) return carcass(s, "drawers");
  if (/island/.test(v) && s.size.w >= 120) return island(s, /rack/.test(v));
  if (s.slug === "vadholma-kitchen-island-79-x-63-x-90") return island79();
  return null;
}

const family: Family = { names: ["VADHOLMA"], recipe };
export default family;
