import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * RIDSPÖ, read from the desk's manual. The frame is built upside down: the back and side rails are joined with two
 * corner brackets, the middle divider goes on dowels, the back legs bolt into the brackets (hanger bolts and nuts)
 * and the front legs go on dowels and cam locks. A front rail, three steel footrests, runner packers, glides, a cable
 * tray, a hook and four runners follow. The frame is stood on the top on a rug and screwed down, the two back
 * upstands are bolted on, and the two drawers are built (cam locks, a bottom stay, a bottom and a pegged back).
 */

type Opts = { len?: number; dia?: number; name?: string };
const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Opts = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const SIDES = [-1, 1] as const;

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 140 wide, 70 deep, 77 high, 88 to the top of the upstands, 63 free under the rails, drawers 55 x 41 inside
  const W = s.size.w * 10 || 1400, D = s.size.d * 10 || 700, H = s.size.h * 10 || 770;
  const tT = 22, ty = H - tT; // underside of the top
  const ay0 = 630, ay = (ay0 + ty) / 2, aH = ty - ay0; // rails
  const t = 18, L = 44; // rail board, leg
  const xs = 638, zl = D / 2 - 50; // leg centres
  const xIn = xs - t / 2; // inner face of a side rail
  const zIn = -zl + t / 2; // inner face of the back rail
  const pk = 20; // runner packer
  const open0 = t / 2, open1 = xIn - pk; // a drawer opening, from the divider to the packer
  const dx = (open0 + open1) / 2; // drawer centre
  const fz = zl - 10; // drawer front's centre
  const dy0 = 645, dy1 = 735, sideT = 12, bz0 = -165; // drawer box
  const rz0 = -150, rz1 = 270; // runners

  const parts: CustomPart[] = [];
  const box = (id: string, name: string, size: Vec3, pos: Vec3, material: CustomPart["material"] = "board", extra: Partial<CustomPart> = {}) =>
    parts.push({ id, name, size, pos, material, ...extra });
  const leg = (id: string, x: number, z: number) => box(id, "Leg", [L, ty, L], [x, ty / 2, z], "wood", { shape: "cyl" });

  box("BA", "Back rail", [2 * (xs - L / 2), aH, t], [0, ay, -zl]);
  SIDES.forEach((sx, i) => box(`SA${i + 1}`, "Side rail", [t, aH, 2 * (zl - L / 2)], [sx * xs, ay, 0]));
  // the divider runs from the back rail to just behind the front edge, over the front rail
  const dvz1 = zl - 2;
  box("DV", "Divider", [t, aH, dvz1 + zl - t / 2], [0, ay, (-zl + t / 2 + dvz1) / 2]);
  leg("L3", -xs, -zl);
  leg("L4", xs, -zl);
  leg("L1", -xs, zl);
  leg("L2", xs, zl);
  SIDES.forEach((sx, i) => box(`PK${i + 1}`, "Runner packer", [pk, 50, rz1 - rz0], [sx * (xIn - pk / 2), 675, (rz0 + rz1) / 2], "wood"));
  box("FR", "Front rail", [2 * (xs - L / 2), 15, 20], [0, ay0 - 7.5, zl - 10], "metal");
  SIDES.forEach((sx, i) => box(`SS${i + 1}`, "Side footrest", [22, 22, 2 * (zl - L / 2)], [sx * xs, 230, 0], "metal", { shape: "cyl" }));
  box("BS", "Back footrest", [2 * (xs - L / 2), 22, 22], [0, 280, -zl], "metal", { shape: "cyl" });
  box("CT", "Cable tray", [300, 50, 60], [300, 700, zIn + 30], "metal");
  box("HK", "Hook", [20, 70, 20], [xs + t / 2 + 10, 665, 180], "metal");
  SIDES.forEach((sx, i) => {
    box(`RI${i + 1}`, "Runner", [12, 40, rz1 - rz0], [sx * (open0 + 6), 670, (rz0 + rz1) / 2], "metal");
    box(`RO${i + 1}`, "Runner", [12, 40, rz1 - rz0], [sx * (open1 - 6), 670, (rz0 + rz1) / 2], "metal");
  });
  box("TOP", "Desk top", [W, tT, D], [0, ty + tT / 2, 0]);
  // two upstands along the back edge, each wrapping round its end of the top
  const upH = 880 - H, uw = W / 2 - 5, ret = 150;
  SIDES.forEach((sx, i) => {
    const pieces: PartPiece[] = [
      { shape: "box", size: [uw, upH, 15], pos: [-sx * 7.5, (tT + 40) / 2, -ret / 2 + 7.5] },
      { shape: "box", size: [15, upH + tT + 40, ret], pos: [sx * (uw / 2), 0, 0] },
    ];
    box(`UP${i + 1}`, "Upstand", [uw + 15, upH + tT + 40, ret], [sx * (uw / 2 + 12.5), H - tT - 40 + (upH + tT + 40) / 2, -D / 2 + ret / 2], "board", { pieces });
  });
  SIDES.forEach((sx, i) => {
    const n = i + 1, cx = sx * dx;
    box(`DF${n}`, "Drawer front", [open1 - open0 - 4, aH - 4, t], [cx, ay, fz]);
    SIDES.forEach((ex, j) => box(`DS${n}${j}`, "Drawer side", [sideT, dy1 - dy0, fz - t / 2 - bz0], [cx + ex * (dx - open0 - 12 - sideT / 2), (dy0 + dy1) / 2, (fz - t / 2 + bz0) / 2]));
    const inW = 2 * (dx - open0 - 12 - sideT);
    box(`ST${n}`, "Bottom stay", [15, 6, fz - t / 2 - bz0 - 12], [cx, dy0 - 3, (fz - t / 2 + bz0 + 12) / 2], "metal");
    box(`DB${n}`, "Drawer bottom", [inW, 4, fz - t / 2 - bz0 - 12], [cx, dy0 + 6, (fz - t / 2 + bz0 + 12) / 2], "fiber");
    box(`DK${n}`, "Drawer back", [inW, dy1 - dy0 - 12, sideT], [cx, (dy0 + 12 + dy1) / 2, bz0 + sideT / 2]);
  });
  box("TR", "Tray", [300, 30, 240], [-420, H - 15, -20], "metal");
  box("CL", "Cable lid", [120, 4, 40], [380, H + 2, -D / 2 + 100], "board");

  const ys = [665, 713];
  const legEnd = (x: number, z: number): Vec3 => [x, 0, z];
  const legs: [number, number][] = [[-xs, -zl], [xs, -zl], [-xs, zl], [xs, zl]];
  const drawers = (f: (cx: number, n: number) => CustomFix[]) => SIDES.flatMap((sx, i) => f(sx * dx, i + 1));

  const steps: CustomStep[] = [
    {
      title: "Join the back and side rails with corner brackets",
      detail: "Lay the rails upside down on a rug. Four screws hold each bracket, two into each rail.",
      add: ["BA", "SA1", "SA2"],
      fix: [
        at("angle", SIDES.map((sx) => [sx * (xIn - 25), ay, zIn + 25] as Vec3), [0, 0, -1], "BA", undefined, { len: 90, dia: 50 }),
        ...SIDES.map((sx, i) => at("screw", ys.map((y) => [sx * xIn, y, zIn + 45] as Vec3), [sx, 0, 0], `SA${i + 1}`, undefined, { len: 16, dia: 4 })),
        at("screw", SIDES.flatMap((sx) => ys.map((y) => [sx * (xIn - 45), y, zIn] as Vec3)), [0, 0, -1], "BA", undefined, { len: 16, dia: 4 }),
      ],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Push the divider onto the back rail",
      detail: "Tap two dowels into the back rail's middle holes, then push the divider on.",
      add: ["DV"],
      fix: [at("dowel", ys.map((y) => [0, y, zIn] as Vec3), [0, 0, 1], "BA", "DV")],
      tools: ["hammer"],
    },
    {
      title: "Fit the bolts into both back legs",
      detail: "Drop a barrel nut into the top of each leg, slot first, then screw two threaded rods into its side holes by hand. These are legs 3 and 4.",
      fix: [
        at("nut", [[-xs, ty - 30, -zl], [xs, ty - 30, -zl]], [0, -1, 0], undefined, undefined, { name: "Barrel nut", len: 30, dia: 10 }),
        ...SIDES.map((sx, i) => at("legScrew", ys.map((y) => [sx * (xs - 16), y, -zl + 16] as Vec3), [sx * 0.7, 0, -0.7], `L${i + 3}`, undefined, { name: "Threaded rod", len: 60, dia: 8 })),
      ],
      wait: ["L3", "L4"],
    },
    {
      title: "Bolt the back legs into the corners",
      detail: "The rods go through the bracket. Put a spring washer and a nut on each and tighten them with the box spanner.",
      add: ["L3", "L4"],
      fix: [
        ...SIDES.map((sx, i) => at("washer", ys.map((y) => [sx * (xIn - 30), y, zIn + 30] as Vec3), [sx * 0.7, 0, -0.7], `L${i + 3}`, undefined, { name: "Spring washer", dia: 8 })),
        ...SIDES.map((sx, i) => at("nut", ys.map((y) => [sx * (xIn - 34), y, zIn + 34] as Vec3), [sx * 0.7, 0, -0.7], `L${i + 3}`, undefined, { dia: 8 })),
      ],
      tools: ["wrench"],
    },
    {
      title: "Tap dowels into the front ends of the side rails",
      detail: "Two in each end.",
      fix: SIDES.map((sx, i) => at("dowel", ys.map((y) => [sx * xs, y, zl - L / 2] as Vec3), [0, 0, 1], `SA${i + 1}`, i ? "L2" : "L1")),
      tools: ["hammer"],
    },
    {
      title: "Push a cam lock into each side rail",
      detail: "Into the big hole near the front, arrow pointing to the end.",
      fix: [at("cam", SIDES.map((sx) => [sx * xIn, ay, zl - L / 2 - 30] as Vec3), [-1, 0, 0], undefined, undefined, { dia: 15 })],
    },
    {
      title: "Screw a cam bolt into each front leg",
      detail: "Legs 1 and 2. Use the short cam bolts here, by hand until they stop.",
      fix: SIDES.map((sx, i) => at("camScrew", [[sx * xs, ay, zl - L / 2]], [0, 0, 1], `L${i + 1}`, `SA${i + 1}`, { len: 30 })),
      wait: ["L1", "L2"],
    },
    { title: "Push the front legs on", detail: "The dowels and cam bolt go into the front end of each side rail.", add: ["L1", "L2"] },
    { title: "Tighten the cam locks", detail: "Turn each one clockwise with the Allen key until the leg pulls tight.", tools: ["allen"] },
    {
      title: "Screw the runner packers inside the side rails",
      detail: "Three screws in each.",
      add: ["PK1", "PK2"],
      fix: SIDES.map((sx, i) => at("screw", [-90, 60, 210].map((z) => [sx * (xIn - pk), 675, z] as Vec3), [sx, 0, 0], `PK${i + 1}`, `SA${i + 1}`, { len: 40, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Lay the front rail on and screw it to the divider",
      detail: "One screw into the divider's front end.",
      add: ["FR"],
      fix: [at("screw", [[0, ay0 - 15, zl - 10]], [0, 1, 0], "FR", "DV", { len: 30, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the front rail to the front legs",
      detail: "One bolt through each leg into the rail's end. Use the long bolts.",
      fix: SIDES.map((sx, i) => at("bolt", [[sx * (xs + L / 2), ay0 - 7.5, zl - 10]], [-sx, 0, 0], `L${i + 1}`, "FR", { len: 40, dia: 6 })),
      tools: ["allen"],
    },
    {
      title: "Bolt the side footrests between the legs",
      detail: "The holes in the footrest face in. Two long bolts each, one through each leg.",
      add: ["SS1", "SS2"],
      fix: SIDES.flatMap((sx, i) => SIDES.map((sz) => at("bolt", [[sx * xs, 230, sz * (zl + L / 2)]], [0, 0, -sz], undefined, `SS${i + 1}`, { len: 40, dia: 6 }))),
      tools: ["allen"],
    },
    {
      title: "Bolt the back footrest between the back legs",
      detail: "Use the two round-headed bolts.",
      add: ["BS"],
      fix: SIDES.map((sx) => at("bolt", [[sx * (xs + L / 2), 280, -zl]], [-sx, 0, 0], undefined, "BS", { len: 30, dia: 6 })),
      tools: ["allen"],
    },
    { title: "Tighten the back leg nuts again", detail: "Check all four nuts on the brackets are tight, with the spring washers flat.", tools: ["wrench"] },
    {
      title: "Tap a glide into each leg",
      detail: "Into the hole in the end of the leg, with the hammer.",
      fix: [at("glide", legs.map(([x, z]) => legEnd(x, z)), [0, 1, 0], undefined, undefined, { name: "Glide", len: 8, dia: 30 })],
      tools: ["hammer"],
    },
    {
      title: "Turn the frame over and tap in the top dowels",
      detail: "Eight dowels in the top edges of the rails and the divider.",
      fix: [
        at("dowel", [-450, 0, 450].map((x) => [x, ty, -zl] as Vec3), [0, 1, 0], "BA", "TOP"),
        ...SIDES.map((sx, i) => at("dowel", [-150, 150].map((z) => [sx * xs, ty, z] as Vec3), [0, 1, 0], `SA${i + 1}`, "TOP")),
        at("dowel", [[0, ty, 0]], [0, 1, 0], "DV", "TOP"),
      ],
      tools: ["hammer"],
      pose: "+y",
    },
    {
      title: "Screw the cable tray to the back rail",
      detail: "Inside the frame, right of the divider. Two screws.",
      add: ["CT"],
      fix: [at("screw", [200, 400].map((x) => [x, 715, zIn + 2] as Vec3), [0, 0, -1], "CT", "BA", { len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the hook to the right side rail",
      detail: "On the outside, hook pointing back. Two screws.",
      add: ["HK"],
      fix: [at("screw", [650, 690].map((y) => [xs + t / 2 + 20, y, 180] as Vec3), [-1, 0, 0], "HK", "SA2", { len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the four runners",
      detail: "Each side of each opening, front ends to the front. Three screws in each, through the holes the drawing marks.",
      add: ["RI1", "RO1", "RI2", "RO2"],
      fix: SIDES.flatMap((sx, i) => [
        // clear of the packer's own screws
        at("screw", [-120, 30, 240].map((z) => [sx * open0, 670, z] as Vec3), [-sx, 0, 0], `RI${i + 1}`, "DV", { len: 12, dia: 4 }),
        at("screw", [-120, 30, 240].map((z) => [sx * open1, 670, z] as Vec3), [sx, 0, 0], `RO${i + 1}`, `PK${i + 1}`, { len: 12, dia: 4 }),
      ]),
      tools: ["screwdriver"],
    },
    {
      title: "Lower the frame onto the top",
      detail: "Lay the top face down on a rug, then turn the frame upside down onto it so the dowels find their holes.",
      add: ["TOP"],
      pose: "-y",
      people: 2,
      warnings: ["floor", "two"],
    },
    {
      title: "Screw the frame to the top",
      detail: "Thirteen long screws, down through the rails and the divider.",
      fix: [
        at("screw", [-500, -250, 0, 250, 500].map((x) => [x, ay0, -zl] as Vec3), [0, 1, 0], "BA", "TOP", { len: 140, dia: 5 }),
        ...SIDES.map((sx, i) => at("screw", [-220, 0, 220].map((z) => [sx * xs, ay0, z] as Vec3), [0, 1, 0], `SA${i + 1}`, "TOP", { len: 140, dia: 5 })),
        at("screw", [-150, 150].map((z) => [0, ay0, z] as Vec3), [0, 1, 0], "DV", "TOP", { len: 140, dia: 5 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Turn the desk over and bolt on the upstands",
      detail: "Push a barrel nut into each hole, slot showing, and hold it straight with a flat screwdriver while you turn the bolt in. Three bolts for each upstand.",
      add: ["UP1", "UP2"],
      fix: [
        ...SIDES.map((sx, i) => at("bolt", [200, 500].map((x) => [sx * x, ty, -D / 2 + 8] as Vec3), [0, 1, 0], "TOP", `UP${i + 1}`, { len: 50, dia: 6 })),
        ...SIDES.map((sx, i) => at("bolt", [[sx * (W / 2 + 15), ty + tT / 2, -D / 2 + 80]], [-sx, 0, 0], `UP${i + 1}`, "TOP", { len: 50, dia: 6 })),
        at("nut", [...SIDES.flatMap((sx) => [200, 500].map((x) => [sx * x, H + 20, -D / 2 + 8] as Vec3)), ...SIDES.map((sx) => [sx * (W / 2 - 40), ty + tT / 2, -D / 2 + 80] as Vec3)], [0, -1, 0], undefined, undefined, { name: "Barrel nut", len: 14, dia: 10 }),
      ],
      tools: ["allen", "flathead"],
      pose: "+y",
      people: 2,
    },
    {
      title: "Screw the cam bolts into the drawer fronts",
      detail: "Lay each front face down on a rug. Four long cam bolts in each, by hand.",
      add: ["DF1", "DF2"],
      fix: drawers((cx, n) => [at("camScrew", SIDES.flatMap((ex) => [670, 710].map((y) => [cx + ex * (dx - open0 - 12 - sideT / 2), y, fz - t / 2] as Vec3)), [0, 0, 1], `DF${n}`, undefined, { len: 34 })]),
      warnings: ["floor"],
    },
    {
      title: "Push the drawer sides onto the cam bolts",
      detail: "Holes for the cam locks face in.",
      add: ["DS10", "DS11", "DS20", "DS21"],
      from: { DS10: [0, 0, -250], DS11: [0, 0, -250], DS20: [0, 0, -250], DS21: [0, 0, -250] },
    },
    {
      title: "Lock the sides with cam locks",
      detail: "Two in each side. Turn them clockwise until the side pulls tight to the front.",
      fix: drawers((cx) => [at("cam", SIDES.flatMap((ex) => [670, 710].map((y) => [cx + ex * (dx - open0 - 12 - sideT), y, fz - t / 2 - 34] as Vec3)), [0, 0, -1], undefined, undefined, { dia: 15 })]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the bottom stay to the drawer front",
      detail: "One screw through its bent foot, in the middle of the front. Leave it hanging down for now.",
      add: ["ST1", "ST2"],
      // through the stay's bent-up foot into the back of the front
      fix: drawers((cx, n) => [at("screw", [[cx, dy0 - 3, fz - t / 2 - 4]], [0, 0, 1], `ST${n}`, `DF${n}`, { len: 14, dia: 4 })]),
      tools: ["screwdriver"],
    },
    { title: "Slide in the drawer bottoms", detail: "Down the grooves in the sides, into the groove of the front.", add: ["DB1", "DB2"], from: { DB1: [0, 300, 0], DB2: [0, 300, 0] } },
    {
      title: "Peg the drawer backs on",
      detail: "Two pegs through each side into the back's ends. Tap them in with the hammer.",
      add: ["DK1", "DK2"],
      fix: drawers((cx, n) => SIDES.map((ex) => at("dowel", [670, 715].map((y) => [cx + ex * (dx - open0 - 12), y, bz0 + sideT / 2] as Vec3), [-ex, 0, 0], undefined, `DK${n}`, { name: "Ribbed peg", len: 40, dia: 6 }))),
      tools: ["hammer"],
    },
    {
      title: "Screw the stay to the drawer back",
      detail: "Swing it up under the bottom and screw its other end to the back.",
      fix: drawers((cx, n) => [at("screw", [[cx, dy0 - 6, bz0 + sideT]], [0, 1, 0], `ST${n}`, `DK${n}`, { len: 14, dia: 4 })]),
      tools: ["screwdriver"],
    },
    { title: "Slide the drawers onto the runners", detail: "Pull the runners out, lay each drawer on them and push it in until the catches under the front click." },
    { title: "Fit the tray and the cable lid", detail: "Drop the tray into the hole on the left and press the lid into the slot at the back.", add: ["TR", "CL"] },
  ];
  return { parts, steps };
}

const family: Family = { names: ["RIDSPÖ", "RIDSPO"], recipe };
export default family;
