import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, PartPiece, Vec3 } from "../../types";

/**
 * RÖNNINGE, read from IKEA's manuals for the chair, the 75x75 bar table and the trolley (solid birch).
 *
 * Chair: the two side frames come glued (front leg, back leg, seat rail and stretcher). Two brackets are screwed
 * inside each seat rail, two round stretchers and two seat rails are pushed into one side frame lying on the floor,
 * barrel nuts go into their ends and long bolts through the side frame, the other side frame goes on the same way,
 * then the backrest is bolted behind the back legs. Stood on the floor and pressed level, every bolt is tightened,
 * and the chair goes upside down onto the seat to screw the brackets into it.
 * Bar table: a frame of four rails and four corner brackets is screwed together on a rug and screwed under the top,
 * each leg gets a sleeve nut and two studs that go through its corner bracket, the H-shaped footrest is joined with
 * two cam locks and bolted between the legs, then nuts on the studs and a plastic foot under each leg.
 * Trolley: two end frames (two legs, an apron and a rail each, dowels and cam locks), two shelves with their lips,
 * stood between the end frames on their side, a drawer joined on its own, then the frame goes upside down onto the
 * top over the drawer and is screwed to it, and two wheels and two feet go on.
 */

const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const S = [-1, 1];
const BARREL = { name: "Barrel nut", len: 14, dia: 10 };

/* ---------------------------------------------------------------- chair */

function chairRecipe(): CustomParams {
  const LX = 212; // leg centres, across
  const LD = 36; // leg diameter
  const ZF = 200, ZB = -180; // front and back legs
  const TILT = 0.15; // the back legs lean back above the seat
  const YS = 430; // underside of the seat
  const RY = 400; // seat rails, centre
  const SY = 170; // side stretchers
  const CY = 240; // round cross stretchers
  const inner = LX - LD / 2; // inside face of the legs
  const upLen = 350;
  const upC: Vec3 = [0, 440 + (upLen / 2) * Math.cos(TILT), ZB - (upLen / 2) * Math.sin(TILT)];
  const legZ = (y: number) => ZB - (y - 440) * Math.tan(TILT); // back leg centre above the seat
  const side = (g: number, i: number): CustomPart => {
    const pieces: PartPiece[] = [
      { shape: "cyl", size: [LD, YS, LD], pos: [0, YS / 2, ZF] },
      { shape: "cyl", size: [LD, 440, LD], pos: [0, 220, ZB] },
      { shape: "cyl", size: [LD - 2, upLen, LD - 2], pos: upC, rot: [-TILT, 0, 0] },
      { shape: "box", size: [22, 60, ZF - ZB - LD], pos: [0, RY, (ZF + ZB) / 2] },
      { shape: "cyl", size: [24, ZF - ZB - LD, 24], pos: [0, SY, (ZF + ZB) / 2], rot: [Math.PI / 2, 0, 0] },
    ];
    // pieces are drawn about the part's own middle
    const c: Vec3 = [0, 395, -16];
    return {
      id: `F${i}`,
      name: "Side frame",
      size: [LD, 790, 470],
      pos: [g * LX, c[1], c[2]],
      material: "wood",
      pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] })),
    };
  };
  const span = 2 * inner;
  const yBack = 710;
  const parts: CustomPart[] = [
    side(-1, 0),
    side(1, 1),
    { id: "XF", name: "Round stretcher", size: [span, 26, 26], pos: [0, CY, ZF], shape: "cyl", material: "wood" },
    { id: "XB", name: "Round stretcher", size: [span, 26, 26], pos: [0, CY, ZB], shape: "cyl", material: "wood" },
    { id: "RF", name: "Seat rail", size: [span, 60, 22], pos: [0, RY, ZF], material: "wood" },
    { id: "RB", name: "Seat rail", size: [span, 60, 22], pos: [0, RY, ZB], material: "wood" },
    { id: "B", name: "Backrest", size: [480, 120, 18], pos: [0, yBack, legZ(yBack) - LD / 2 - 9], rot: [-TILT, 0, 0], material: "wood" },
    { id: "S", name: "Seat", size: [span, 20, 410], pos: [0, YS + 10, 15], material: "wood" },
  ];
  const zBr = [-90, 110];
  const xBr = inner - 4 - 15; // the bracket's upright tab against the rail, its foot under the seat
  const brackets = (g: number, i: number): CustomFix[] => [
    fx("angle", zBr.map((z) => pt(g * xBr, YS, z)), [0, 1, 0], { name: "Bracket", len: 30, dia: 24, on: `F${i}`, twist: g > 0 ? -Math.PI / 2 : Math.PI / 2 }),
    fx("screw", zBr.map((z) => pt(g * (inner - 4), RY + 5, z)), [g, 0, 0], { len: 16, dia: 4, on: `F${i}` }),
  ];
  // the four cross pieces: a barrel nut in each end from above, a long bolt through the side frame into it
  const cross: [number, number][] = [
    [CY, ZF],
    [CY, ZB],
    [RY, ZF],
    [RY, ZB],
  ];
  const ids = ["XF", "XB", "RF", "RB"];
  const joints = (g: number, i: number): CustomFix[] => [
    ...cross.map(([y, z], k) => fx("nut", [pt(g * (inner - 22), y + 12, z)], [0, -1, 0], { ...BARREL, on: ids[k] })),
    fx("bolt", cross.map(([y, z]) => pt(g * (LX + LD / 2), y, z)), [-g, 0, 0], { len: 80, dia: 6, on: `F${i}` }),
  ];
  const steps: CustomStep[] = [
    {
      title: "Screw two brackets inside a side frame",
      detail: "Lay the side frame flat on a rug, inside up. One screw holds each bracket to the seat rail; its foot points inwards, under where the seat goes.",
      add: ["F0"],
      fix: [...brackets(-1, 0)],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Push a round stretcher into the side frame",
      detail: "The side frame lies on the rug. Turn the stretcher so the hole across its end faces the bolt hole in the leg.",
      add: ["XB"],
    },
    { title: "Push in the second round stretcher", detail: "The same way, at the front leg.", add: ["XF"] },
    { title: "Push in a seat rail", detail: "Curved edge up, holes facing the legs.", add: ["RB"] },
    { title: "Press in the second seat rail", detail: "Press it right down into the front leg by hand.", add: ["RF"] },
    {
      title: "Bolt the cross pieces to the side frame",
      detail: "Drop a barrel nut into each end with its slot along the piece, then turn a long bolt through the leg into it with the Allen key. Leave them loose.",
      fix: joints(-1, 0),
      tools: ["flathead", "allen"],
    },
    {
      title: "Turn it over onto the other side frame",
      detail: "Screw its two brackets on first, then lower the four free ends into its holes.",
      add: ["F1"],
      fix: brackets(1, 1),
      pose: "-x",
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the second side frame",
      detail: "Barrel nuts in the ends again, slots along the pieces, and four long bolts through the legs. Still loose.",
      fix: joints(1, 1),
      tools: ["flathead", "allen"],
    },
    {
      title: "Stand it up and bolt on the backrest",
      detail: "Curved face to the front. Four short bolts through the back legs, two in each.",
      add: ["B"],
      fix: [fx("bolt", S.flatMap((g) => [yBack - 30, yBack + 30].map((y) => pt(g * LX, y, legZ(y) + LD / 2))), [0, 0, -1], { len: 40, dia: 6 })],
      pose: "+y",
      tools: ["allen"],
      from: { B: [0, 0, -300] },
    },
    {
      title: "Press the frame down level",
      detail: "Stand the chair on a flat floor and lean on the seat rails, so all four legs touch the floor.",
      warnings: ["square"],
    },
    {
      title: "Tighten all eight long bolts",
      detail: "Firmly with the Allen key, but stop once they're tight: too hard and the wood splits.",
      tools: ["allen"],
      check: "square",
    },
    {
      title: "Lay the seat on a rug and turn the chair onto it",
      detail: "Seat face down. The brackets' feet rest on its underside, the seat rails around it.",
      add: ["S"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw the brackets to the seat",
      detail: "One screw up through the foot of each bracket. Then turn the chair over.",
      fix: [fx("screw", S.flatMap((g) => zBr.map((z) => pt(g * (xBr - 24), YS, z))), [0, 1, 0], { len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Turn the chair over", detail: "Check the bolts again after a couple of weeks.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- bar table */

function barTableRecipe(): CustomParams {
  const W = 750, H = 1050, TT = 22;
  const L = 330; // leg centres, both ways
  const LD = 40;
  const yT = H - TT; // underside of the top
  const RH = 80, RT = 20; // rails
  const ry = yT - RH / 2;
  const rl = 2 * (L - LD / 2);
  const FY = 280; // footrest
  const parts: CustomPart[] = [
    { id: "RF", name: "Long rail", size: [rl, RH, RT], pos: [0, ry, L], material: "wood" },
    { id: "RB", name: "Long rail", size: [rl, RH, RT], pos: [0, ry, -L], material: "wood" },
    { id: "RL", name: "Short rail", size: [RT, RH, rl - 2 * RT], pos: [-L, ry, 0], material: "wood" },
    { id: "RR", name: "Short rail", size: [RT, RH, rl - 2 * RT], pos: [L, ry, 0], material: "wood" },
    { id: "T", name: "Table top", size: [W, TT, W], pos: [0, H - TT / 2, 0], material: "wood" },
    ...S.flatMap((sz, j) => S.map((sx, i): CustomPart => ({ id: `L${j}${i}`, name: "Leg", size: [LD, yT, LD], pos: [sx * L, yT / 2, sz * L], shape: "cyl", material: "wood" }))),
    { id: "FL", name: "Footrest bar", size: [30, 30, rl], pos: [-L, FY, 0], shape: "cyl", material: "wood" },
    { id: "FR", name: "Footrest bar", size: [30, 30, rl], pos: [L, FY, 0], shape: "cyl", material: "wood" },
    { id: "FM", name: "Footrest cross bar", size: [2 * L - 30, 30, 30], pos: [0, FY, 0], shape: "cyl", material: "wood" },
  ];
  const corners = S.flatMap((sz) => S.map((sx) => [sx, sz] as const));
  const d2 = (sx: number, sz: number): Vec3 => [sx * Math.SQRT1_2, 0, sz * Math.SQRT1_2];
  const cIn = L - 52; // the corner brackets, across the inside corner
  const studYs = [yT - 28, yT - 58];
  const legIn = L - LD / 2 / Math.SQRT2;
  const steps: CustomStep[] = [
    {
      title: "Lay out the long rails and the corner brackets",
      detail: "On a rug, holes up. Each bracket sits against the end of a long rail, its bent tabs facing in.",
      add: ["RF", "RB"],
      fix: [
        ...corners.map(([sx, sz]) => fx("angle", [pt(sx * cIn, ry, sz * cIn)], d2(sx, sz), { name: "Corner bracket", len: 60, dia: 70, on: sz > 0 ? "RF" : "RB" })),
      ],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw each bracket to its long rail",
      detail: "Two screws per bracket.",
      fix: S.map((sz) => fx("screw", S.flatMap((sx) => [-15, 15].map((dy) => pt(sx * (L - 46), ry + dy, sz * (L - RT / 2)))), [0, 0, sz], { len: 14, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Press the short rails onto the brackets",
      detail: "The brackets' tabs slide into the slots in the rail ends. Check the holes on top all face the same way.",
      add: ["RL", "RR"],
    },
    {
      title: "Screw the brackets to the short rails",
      detail: "Two more screws per bracket.",
      fix: S.map((sx) => fx("screw", S.flatMap((sz) => [-15, 15].map((dy) => pt(sx * (L - RT / 2), ry + dy, sz * (L - 46)))), [sx, 0, 0], { len: 14, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the frame under the top",
      detail: "Lay the top face down on the rug, the frame on it, an even overhang all round. Three long screws down through each rail.",
      add: ["T"],
      fix: [
        ...S.map((sz) => fx("screw", [-200, 0, 200].map((x) => pt(x, yT - 30, sz * L)), [0, 1, 0], { len: 45, dia: 5 })),
        ...S.map((sx) => fx("screw", [-200, 0, 200].map((z) => pt(sx * L, yT - 30, z)), [0, 1, 0], { len: 45, dia: 5 })),
      ],
      tools: ["screwdriver"],
      from: { T: [0, -400, 0] },
    },
    {
      title: "Fit a sleeve nut and two studs in each leg",
      detail: "Push the sleeve nut into the top of the leg, holes facing the side holes, then screw two studs into it by hand.",
      add: ["L00", "L01", "L10", "L11"],
      fix: [
        ...corners.map(([sx, sz]) => fx("nut", [pt(sx * L, yT - 25, sz * L)], [0, -1, 0], { name: "Sleeve nut", len: 50, dia: 10, on: `L${(sz + 1) / 2}${(sx + 1) / 2}` })),
        ...corners.map(([sx, sz]) => fx("stud", studYs.map((y) => pt(sx * legIn, y, sz * legIn)), d2(sx, sz), { len: 60, dia: 8, on: `L${(sz + 1) / 2}${(sx + 1) / 2}` })),
      ],
    },
    {
      title: "Push the legs onto the corner brackets",
      detail: "Each leg's studs go through the holes in its bracket, the leg snug in the corner of the frame.",
    },
    {
      title: "Screw a cam bolt into each footrest bar",
      detail: "In the hole in the middle of each long bar.",
      fix: S.map((sx) => fx("camScrew", [pt(sx * (L - 15), FY, 0)], [sx, 0, 0], { on: sx < 0 ? "FL" : "FR", len: 34, dia: 7 })),
      tools: ["screwdriver"],
    },
    { title: "Join the cross bar between them", detail: "Its ends go over the cam bolts.", add: ["FM"] },
    {
      title: "Turn the two cam locks",
      detail: "Arrow towards the cam bolt, then a half turn clockwise to pull the bars tight.",
      fix: [fx("cam", S.map((sx) => pt(sx * (L - 45), FY + 15, 0)), [0, -1, 0], { on: "FM" })],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the footrest between the legs",
      detail: "Ease the legs apart a little and push each bar end into its leg.",
    },
    {
      title: "Bolt the footrest to the legs",
      detail: "A barrel nut into each bar end, slot along the bar, then a long bolt through the leg into it.",
      fix: [
        fx("nut", corners.map(([sx, sz]) => pt(sx * L, FY - 15, sz * (L - 45))), [0, 1, 0], BARREL),
        ...S.map((sz) => fx("bolt", S.map((sx) => pt(sx * L, FY, sz * (L + LD / 2))), [0, 0, -sz], { len: 100, dia: 6 })),
      ],
      tools: ["flathead", "allen"],
    },
    {
      title: "Put a washer and a nut on every stud",
      detail: "Inside each corner bracket: spring washer first, then the nut. Tighten all eight with the box spanner.",
      fix: [
        ...corners.map(([sx, sz]) => fx("washer", studYs.map((y) => pt(sx * (cIn - 6), y, sz * (cIn - 6))), d2(sx, sz), { name: "Spring washer", len: 2, dia: 12 })),
        ...corners.map(([sx, sz]) => fx("nut", studYs.map((y) => pt(sx * (cIn - 8), y, sz * (cIn - 8))), d2(sx, sz), { len: 6, dia: 13 })),
      ],
      tools: ["wrench"],
    },
    {
      title: "Tap a foot into each leg",
      detail: "Into the hole in the end of each leg.",
      fix: [fx("glide", corners.map(([sx, sz]) => pt(sx * L, 0, sz * L)), [0, 1, 0], { name: "Plastic foot", len: 6, dia: 40 })],
      tools: ["hammer"],
    },
    { title: "Turn the table over", detail: "Lift it by the legs, not the top, and stand it on its feet.", pose: "+y", people: 2 },
  ];
  return { parts, steps };
}

/* ---------------------------------------------------------------- trolley */

function trolleyRecipe(): CustomParams {
  const W = 780, D = 390, H = 750, TT = 20;
  const LX = 350, LZ = 155, LD = 40;
  const yT = H - TT; // underside of the top
  const yLeg0 = 20; // the legs stop short of the floor, over a foot or a wheel
  const AT = 24; // aprons and rails, thick
  const ax = LX - 8; // apron centres, inside the legs
  const ix = ax - AT / 2; // inside face of the end frames
  const az = 2 * (LZ - LD / 2);
  const UA0 = 640, LA0 = 160; // bottoms of the end apron and the end rail
  const ST = 18; // shelves
  const sd = 300;
  const yB = UA0; // drawer shelf, bottom
  const yA = LA0; // lower shelf, bottom
  const lipZ = -sd / 2 + 10;
  const DW = 620, DZ0 = -128, DZ1 = 168; // drawer
  const dy0 = yB + ST + 2, dy1 = yT - 2;
  const dh = dy1 - dy0;
  const dsx = DW / 2 - 9;
  const parts: CustomPart[] = [
    ...S.map((sx, i): CustomPart => ({ id: `UA${i}`, name: "End apron", size: [AT, yT - UA0, az], pos: [sx * ax, (UA0 + yT) / 2, 0], material: "wood" })),
    ...S.map((sx, i): CustomPart => ({ id: `LR${i}`, name: "End rail", size: [AT, 60, az], pos: [sx * ax, LA0 + 30, 0], material: "wood" })),
    ...S.flatMap((sx, i) => S.map((sz, j): CustomPart => ({ id: `L${i}${j}`, name: "Leg", size: [LD, yT - yLeg0, LD], pos: [sx * LX, (yT + yLeg0) / 2, sz * LZ], shape: "cyl", material: "wood" }))),
    { id: "SB", name: "Drawer shelf", size: [2 * ix, ST, sd], pos: [0, yB + ST / 2, 0], material: "wood" },
    { id: "SA", name: "Lower shelf", size: [2 * ix, ST, sd], pos: [0, yA + ST / 2, 0], material: "wood" },
    { id: "BL", name: "Back apron", size: [2 * ix, yT - yB - ST, 20], pos: [0, (yB + ST + yT) / 2, lipZ], material: "wood" },
    { id: "AL", name: "Shelf lip", size: [2 * ix, 60, 20], pos: [0, yA + ST + 30, lipZ], material: "wood" },
    ...S.map((sx, i): CustomPart => ({ id: `W${i}`, name: "Drawer guide wire", size: [4, 24, sd - 60], pos: [sx * (ix - 10), yB + ST + 12, 10], material: "metal" })),
    ...S.map((sx, i): CustomPart => ({ id: `DS${i}`, name: "Drawer side", size: [18, dh - 8, DZ1 - 18 - DZ0], pos: [sx * dsx, (dy0 + dy1 - 8) / 2, (DZ0 + DZ1 - 18) / 2], material: "wood" })),
    {
      id: "DF",
      name: "Drawer front",
      size: [DW + 20, dh, 18],
      pos: [0, (dy0 + dy1) / 2, DZ1 - 9],
      material: "wood",
      pieces: [
        { shape: "box", size: [(DW + 20 - 50) / 2, dh, 18], pos: [-(DW + 20 + 50) / 4, 0, 0] },
        { shape: "box", size: [(DW + 20 - 50) / 2, dh, 18], pos: [(DW + 20 + 50) / 4, 0, 0] },
        { shape: "box", size: [50, dh - 22, 18], pos: [0, -11, 0] },
      ],
    },
    { id: "DB", name: "Drawer bottom", size: [DW - 36, 6, DZ1 - 18 - DZ0 - 18], pos: [0, dy0 + 10, (DZ0 + DZ1 - 18 + 18) / 2], material: "fiber" },
    { id: "DK", name: "Drawer back", size: [DW - 36, dh - 8, 18], pos: [0, (dy0 + dy1 - 8) / 2, DZ0 + 9], material: "wood" },
    { id: "T", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
  ];
  const ends = [
    ["UA", (UA0 + yT) / 2],
    ["LR", LA0 + 30],
  ] as const;
  const legId = (sx: number, sz: number) => `L${(sx + 1) / 2}${(sz + 1) / 2}`;
  const steps: CustomStep[] = [
    {
      title: "Screw cam bolts into the end aprons and rails",
      detail: "Two in the inside face of each, by hand or with a screwdriver until they stop.",
      fix: ends.flatMap(([id, y]) => S.map((sx, i) => fx("camScrew", [-80, 80].map((z) => pt(sx * ix, y, z)), [sx, 0, 0], { on: `${id}${i}` }))),
      tools: ["screwdriver"],
    },
    {
      title: "Tap a dowel into each end",
      detail: "Eight dowels, one in each end of the four pieces.",
      fix: ends.flatMap(([id, y]) => S.flatMap((sx, i) => S.map((sz) => fx("dowel", [pt(sx * ax, y, sz * (az / 2))], [0, 0, -sz], { on: `${id}${i}`, len: 30, dia: 8 })))),
      tools: ["hammer"],
    },
    {
      title: "Screw a cam bolt into the top of two legs",
      detail: "The two back legs, into the hole in their top end.",
      fix: S.map((sx) => fx("camScrew", [pt(sx * LX, yT, -LZ)], [0, -1, 0], { on: legId(sx, -1) })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw a cam bolt into the side of each leg",
      detail: "In the hole facing the apron.",
      fix: S.flatMap((sx) => S.map((sz) => fx("camScrew", [pt(sx * LX, (UA0 + yT) / 2 - 20, sz * (LZ - LD / 2))], [0, 0, sz], { on: legId(sx, sz) }))),
      tools: ["screwdriver"],
    },
    {
      title: "Join each end frame",
      detail: "Two legs, an apron at the top and a rail lower down, pushed together on the dowels. Make two.",
      add: ["L00", "L01", "L10", "L11", "UA0", "UA1", "LR0", "LR1"],
      warnings: ["floor"],
    },
    {
      title: "Turn the cam locks in the aprons",
      detail: "Arrow towards the leg, then turn clockwise until tight. Two in each end frame.",
      fix: S.map((sx, i) => fx("cam", S.map((sz) => pt(sx * ix, (UA0 + yT) / 2 - 20, sz * (az / 2 - 30))), [sx, 0, 0], { on: `UA${i}` })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw cam bolts into the back apron and the lip",
      detail: "Two into the bottom edge of each.",
      fix: [
        fx("camScrew", [-200, 200].map((x) => pt(x, yB + ST, lipZ)), [0, 1, 0], { on: "BL" }),
        fx("camScrew", [-200, 200].map((x) => pt(x, yA + ST, lipZ)), [0, 1, 0], { on: "AL" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Tap two dowels into each shelf",
      detail: "Along the back edge, where the apron or the lip goes.",
      add: ["SB", "SA"],
      fix: [
        fx("dowel", [-100, 100].map((x) => pt(x, yB + ST, lipZ)), [0, -1, 0], { on: "SB", len: 30, dia: 8 }),
        fx("dowel", [-100, 100].map((x) => pt(x, yA + ST, lipZ)), [0, -1, 0], { on: "SA", len: 30, dia: 8 }),
      ],
      tools: ["hammer"],
    },
    {
      title: "Press the back apron and the lip onto the shelves",
      detail: "The tall back apron goes on the drawer shelf, the low lip on the lower shelf.",
      add: ["BL", "AL"],
    },
    {
      title: "Turn the cam locks in the shelves",
      detail: "Two in each, from underneath, arrow towards the cam bolt.",
      fix: [
        fx("cam", [-200, 200].map((x) => pt(x, yB, lipZ)), [0, 1, 0], { on: "SB" }),
        fx("cam", [-200, 200].map((x) => pt(x, yA, lipZ)), [0, 1, 0], { on: "SA" }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Push the two guide wires into the drawer shelf",
      detail: "One near each end, their hooked ends down into the holes. The drawer runs between them.",
      add: ["W0", "W1"],
    },
    {
      title: "Tap dowels into the ends of the shelves",
      detail: "Three in each end of both shelves.",
      fix: [
        ...S.map((sx) => fx("dowel", [-100, 0, 100].map((z) => pt(sx * ix, yB + ST / 2, z)), [-sx, 0, 0], { on: "SB", len: 30, dia: 8 })),
        ...S.map((sx) => fx("dowel", [-100, 0, 100].map((z) => pt(sx * ix, yA + ST / 2, z)), [-sx, 0, 0], { on: "SA", len: 30, dia: 8 })),
      ],
      tools: ["hammer"],
    },
    {
      title: "Stand the shelves in one end frame",
      detail: "Lay an end frame on the rug, outside down, and push both shelves into it on their dowels.",
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Lock the shelves to that end frame",
      detail: "Five cam locks: arrow towards each cam bolt, then turn clockwise.",
      fix: [fx("cam", [pt(-(ix - 30), yB + ST, 80), pt(-(ix - 30), yB + ST, -80), pt(-(ix - 30), yA + ST, 80), pt(-(ix - 30), yA + ST, -80), pt(-(ix - 30), yB + ST, 0)], [0, -1, 0])],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the other end frame on top",
      detail: "Its dowels and cam bolts into the free ends of the shelves.",
    },
    {
      title: "Lock the shelves to the second end frame",
      detail: "Five more cam locks, the same way.",
      fix: [fx("cam", [pt(ix - 30, yB + 18, 80), pt(ix - 30, yB + 18, -80), pt(ix - 30, yA + 18, 80), pt(ix - 30, yA + 18, -80), pt(ix - 30, yB + 18, 0)], [0, -1, 0])],
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the top edge of the frame",
      detail: "Eight in all, along the tops of the two end aprons. The top sits on them.",
      fix: [fx("dowel", S.flatMap((sx) => [-90, -30, 30, 90].map((z) => pt(sx * ax, yT - 4, z))), [0, -1, 0], { len: 20, dia: 8 })],
      tools: ["hammer"],
      pose: "+y",
    },
    {
      title: "Tap small dowels into the drawer sides",
      detail: "Two in the front end of each side.",
      fix: S.map((sx, i) => fx("dowel", [dy0 + 10, dy1 - 10].map((y) => pt(sx * dsx, y, DZ1 - 18)), [0, 0, -1], { on: `DS${i}`, len: 25, dia: 6 })),
      tools: ["hammer"],
    },
    {
      title: "Screw two cam bolts into the drawer front",
      detail: "Into the back face, near each end.",
      fix: [fx("camScrew", S.map((sx) => pt(sx * dsx, (dy0 + dy1) / 2, DZ1 - 18)), [0, 0, 1], { on: "DF" })],
      tools: ["screwdriver"],
    },
    {
      title: "Push the sides onto the drawer front",
      detail: "Lay the front face down, the grooves in the sides facing in and down.",
      add: ["DS0", "DS1"],
    },
    {
      title: "Lock the sides to the front",
      detail: "One cam lock in each side, arrow towards the front, then turn.",
      fix: S.map((sx) => fx("cam", [pt(sx * (dsx + 9), (dy0 + dy1) / 2, DZ1 - 40)], [-sx, 0, 0])),
      tools: ["screwdriver"],
    },
    { title: "Slide in the drawer bottom", detail: "Along the grooves in the sides, right down to the front.", add: ["DB"] },
    { title: "Push the drawer back on", detail: "Over the end of the bottom, onto the two sides.", add: ["DK"] },
    {
      title: "Fit the drawer stops and lock the back",
      detail: "Press the two stops into the top edge of the back, then a cam lock in each side by the back.",
      fix: [
        fx("clip", S.map((sx) => pt(sx * 200, dy1 - 8, DZ0 + 9)), [0, -1, 0], { name: "Drawer stop", len: 20, dia: 8, on: "DK" }),
        ...S.map((sx) => fx("cam", [pt(sx * (dsx + 9), (dy0 + dy1) / 2, DZ0 + 30)], [-sx, 0, 0])),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the top face down and fit the stop pegs",
      detail: "On a rug. Screw the two pegs into the holes near the back by hand: they keep the drawer from coming all the way out.",
      add: ["T"],
      fix: [fx("pin", S.map((sx) => pt(sx * 200, yT, DZ0 + 40)), [0, 1, 0], { name: "Stop peg", len: 16, dia: 10, on: "T" })],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Lay the drawer upside down on the top",
      detail: "Front towards the front of the top, the stops behind the pegs.",
    },
    {
      title: "Lower the frame onto the top",
      detail: "Upside down, over the drawer, its dowels into the holes in the top. The drawer shelf rests on the drawer.",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw the back apron to the top",
      detail: "Three long screws down through the drawer shelf and the back apron.",
      fix: [fx("screw", [-200, 0, 200].map((x) => pt(x, yB, lipZ)), [0, 1, 0], { len: 100, dia: 5, on: "SB", mate: "T" })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the lower shelf to the end rails",
      detail: "Six long screws at an angle, through the pre-drilled holes near the ends of the lower shelf.",
      fix: S.map((sx) => fx("screw", [-80, 0, 80].map((z) => pt(sx * (ix - 30), yA, z)), [sx * Math.SQRT1_2, Math.SQRT1_2, 0], { len: 60, dia: 5, on: "SA" })),
      tools: ["screwdriver"],
    },
    {
      title: "Fit the two wheels",
      detail: "Into the slots in the two left-hand legs, each on its axle bolt. Squeeze the leg end while you tighten it with the Allen key.",
      fix: [
        fx("castor", S.map((sz) => pt(-LX, yLeg0, sz * LZ)), [0, 1, 0], { name: "Wheel", len: 40, dia: 50 }),
        fx("bolt", S.map((sz) => pt(-LX - LD / 2, yLeg0 + 12, sz * LZ)), [1, 0, 0], { name: "Axle bolt", len: 45, dia: 6 }),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw a foot under the other two legs",
      detail: "By hand, into the ends of the right-hand legs.",
      fix: [fx("foot", S.map((sz) => pt(LX, yLeg0, sz * LZ)), [0, 1, 0], { name: "Plastic foot", len: yLeg0, dia: 40 })],
    },
    { title: "Turn the trolley over", detail: "Stand it on its wheels and feet and slide the drawer in and out to check it runs.", pose: "+y" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["RÖNNINGE"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (slug === "ronninge-chair") return chairRecipe();
    if (slug === "ronninge-bar-table-75-x-75") return barTableRecipe();
    if (slug === "ronninge-trolley-78-x-39") return trolleyRecipe();
    return null;
  },
};
export default family;
