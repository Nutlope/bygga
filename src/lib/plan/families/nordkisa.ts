import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * NORDKISA, read from the bedside table's and the dressing table's manuals. Both are bamboo frames held by long
 * Allen screws: each side frame is two legs with rails, and the shelves are screwed between them through the legs.
 * The bedside table is built lying on one side frame (three shelves, then the other frame on top), stood up, and
 * its top goes onto dowels in the legs and is screwed from below. The dressing table is built upside down: the niche
 * back and divider are dowelled and screwed onto the shelf, the side frames and back stretcher are screwed on, the
 * feet go in, and the top (with cam pins) is dowelled on the right way up and held by cam locks. Both drawers are
 * open at both ends: two sides screwed to two ends, the bottom slid into the grooves.
 *
 * Open wardrobe with sliding door: built lying on its back. Slatted shelves are dowelled and screwed between the
 * left ladder frame and the middle one, the slatted back of the closed side goes underneath, two plain shelves and
 * the slatted bench shelf go in, then the right frame. The bottom is dowelled and screwed onto the frames' ends and
 * the leg frame (two end frames joined by two long rails, feet screwed in) is screwed under it. Stood up by two, the
 * rest of the screws go in, the clothes rail hangs between the middle and right frames, the top goes on dowels, the
 * door is hooked into its track and the top is screwed down. A strap ties it to the wall.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });
const SIDES = [-1, 1] as const;
const BOLT = { len: 50, dia: 6 };
const LEG = 35;

/** A side frame: front and back legs, a rail under the top and a low rail, all along z. */
function sideFrame(sx: number, x: number, zl: number, yTop: number, rail: { y0: number; y1: number }, low: { y: number; h: number }): CustomPart {
  const yc = yTop / 2;
  return {
    id: sx < 0 ? "EL" : "ER",
    name: "Side frame",
    size: [LEG, yTop, 2 * zl + LEG],
    pos: [sx * x, yc, 0],
    material: "wood",
    pieces: [
      ...SIDES.map((sz) => box([LEG, yTop, LEG], [0, 0, sz * zl])),
      box([20, rail.y1 - rail.y0, 2 * zl - LEG], [-sx * 7.5, (rail.y0 + rail.y1) / 2 - yc, 0]), // flush with the legs' inner faces
      box([20, low.h, 2 * zl - LEG], [-sx * 7.5, low.y - yc, 0]),
    ],
  };
}

/** A drawer open at both ends: two sides, two ends with a finger hole, a bottom in grooves. */
function drawer(W: number, H: number, D: number, x0: number, y0: number): { parts: CustomPart[]; steps: CustomStep[] } {
  const t = 12;
  const xs = (W - t) / 2, ze = D / 2 - t / 2, yc = y0 + H / 2;
  const parts: CustomPart[] = [
    ...SIDES.map((s): CustomPart => ({ id: s < 0 ? "DS1" : "DS2", name: "Drawer side", size: [t, H, D], pos: [x0 + s * xs, yc, 0], material: "wood" })),
    ...SIDES.map((s): CustomPart => ({ id: s < 0 ? "DE1" : "DE2", name: "Drawer end", size: [W - 2 * t, H, t], pos: [x0, yc, s * ze], material: "wood" })),
    { id: "DB", name: "Drawer bottom", size: [W - 2 * t, 5, D - 2 * t], pos: [x0, y0 + 12, 0], material: "fiber" },
  ];
  const screws = (side: number, end: number) =>
    at("screw", [y0 + 30, y0 + H - 45].map((y): Vec3 => [x0 + side * (W / 2), y, end * ze]), [-side, 0, 0], side < 0 ? "DS1" : "DS2", end < 0 ? "DE1" : "DE2", { len: 16, dia: 4 });
  const steps: CustomStep[] = [
    {
      title: "Screw a drawer side to one end",
      detail: "The grooves for the bottom face in and line up. Two small screws.",
      add: ["DS1", "DE1"],
      fix: [screws(-1, -1)],
      tools: ["screwdriver"],
    },
    { title: "Screw on the other end", detail: "Two more screws, grooves lined up with the first end.", add: ["DE2"], fix: [screws(-1, 1)], tools: ["screwdriver"] },
    { title: "Slide the bottom into the grooves", detail: "Push it in all the way until it meets the side.", add: ["DB"], from: { DB: [W, 0, 0] } },
    { title: "Screw on the other side", detail: "Two screws into each end.", add: ["DS2"], fix: [screws(1, -1), screws(1, 1)], tools: ["screwdriver"] },
  ];
  return { parts, steps };
}

function bedside(): CustomParams {
  // IKEA: 40 wide, 40 deep, 67 high
  const W = 400, D = 400, H = 670, TT = 18;
  const yTop = H - TT;
  const xl = W / 2 - LEG / 2, zl = D / 2 - LEG / 2;
  const xi = xl - LEG / 2; // inner faces of the legs
  const rail = { y0: yTop - 50, y1: yTop };
  const ySl = 160, yMid = 380, yUp = 540, ST = 18;
  const slats: PartPiece[] = [
    ...SIDES.map((s) => box([30, 20, D], [s * (xi - 15), 0, 0])),
    ...Array.from({ length: 7 }, (_, i) => box([2 * xi - 60, 14, 36], [0, 3, -D / 2 + 30 + (i * (D - 60)) / 6])),
  ];
  const dr = drawer(2 * xi - 10, yUp - ST / 2 - (yMid + ST / 2) - 10, D, 0, yMid + ST / 2 + 1);
  const parts: CustomPart[] = [
    sideFrame(-1, xl, zl, yTop, rail, { y: 120, h: 40 }),
    { id: "S1", name: "Slatted shelf", size: [2 * xi, 20, D], pos: [0, ySl, 0], material: "wood", pieces: slats },
    { id: "S2", name: "Shelf", size: [2 * xi, ST, D], pos: [0, yMid, 0], material: "wood" },
    { id: "S3", name: "Shelf", size: [2 * xi, ST, D], pos: [0, yUp, 0], material: "wood" },
    sideFrame(1, xl, zl, yTop, rail, { y: 120, h: 40 }),
    { id: "T", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    ...dr.parts,
  ];
  const shelfBolts = (sx: number, id: string, y: number) => at("bolt", SIDES.map((sz): Vec3 => [sx * (W / 2), y, sz * zl]), [-sx, 0, 0], sx < 0 ? "EL" : "ER", id, BOLT);
  const steps: CustomStep[] = [
    {
      title: "Screw the slatted shelf to a side frame",
      detail: "Lay the side frame on a rug, rails up. Two screws go through the legs into the end of the shelf.",
      add: ["EL", "S1"],
      fix: [shelfBolts(-1, "S1", ySl)],
      tools: ["allen"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Screw on the middle shelf", detail: "The same way, two screws through the legs.", add: ["S2"], fix: [shelfBolts(-1, "S2", yMid)], tools: ["allen"] },
    { title: "Screw on the upper shelf", detail: "Two more screws. All three shelves stand at right angles to the frame.", add: ["S3"], fix: [shelfBolts(-1, "S3", yUp)], tools: ["allen"] },
    { title: "Lay the other side frame on top", detail: "Its rails face the same way as the first one's, the holes over the ends of the shelves.", add: ["ER"] },
    {
      title: "Screw the second frame to the shelves",
      detail: "Six screws, two into each shelf.",
      fix: [shelfBolts(1, "S1", ySl), shelfBolts(1, "S2", yMid), shelfBolts(1, "S3", yUp)],
      tools: ["allen"],
    },
    {
      title: "Stand it up and tap dowels into the legs",
      detail: "One dowel in the top of each leg.",
      fix: SIDES.map((sx) => at("dowel", SIDES.map((sz): Vec3 => [sx * xl, yTop, sz * zl]), [0, 1, 0], sx < 0 ? "EL" : "ER", "T")),
      tools: ["hammer"],
      pose: "+y",
    },
    { title: "Press the top onto the dowels", detail: "Line up the holes underneath and push it down evenly.", add: ["T"] },
    {
      title: "Screw the top on from below",
      detail: "Two screws up through each top rail into the top.",
      fix: SIDES.map((sx) => at("bolt", [-80, 80].map((z): Vec3 => [sx * xl, rail.y0, z]), [0, 1, 0], sx < 0 ? "EL" : "ER", "T", BOLT)),
      tools: ["allen"],
    },
    ...dr.steps,
    { title: "Slide the drawer in", detail: "From the front or the back: it opens to both sides. Don't pull it all the way out, it has no stop." },
  ];
  return { parts, steps };
}

function dressingTable(): CustomParams {
  // IKEA: 76 wide, 47 deep, 76 high
  const W = 760, D = 470, H = 760, TT = 18;
  const yTop = H - TT;
  const xl = W / 2 - LEG / 2, zl = D / 2 - LEG / 2;
  const xi = xl - LEG / 2;
  const yS0 = 600, ST = 18; // the shelf under the niche and the drawer
  const rail = { y0: yS0, y1: yTop };
  const ySt = 230;
  const xd = -40, t = 18; // the divider, niche on the left
  const hB = yTop - (yS0 + ST);
  const yB = yS0 + ST + hB / 2;
  const dr = drawer(xi - (xd + t / 2) - 10, hB - 12, D, (xi + xd + t / 2) / 2, yS0 + ST + 1);
  const parts: CustomPart[] = [
    { id: "B", name: "Niche back", size: [xd - t / 2 + xi, hB, t], pos: [(-xi + xd - t / 2) / 2, yB, -D / 2 + t / 2], material: "wood" },
    { id: "V", name: "Divider", size: [t, hB, D], pos: [xd, yB, 0], material: "wood" },
    { id: "S", name: "Shelf", size: [2 * xi, ST, D], pos: [0, yS0 + ST / 2, 0], material: "wood" },
    sideFrame(-1, xl, zl, yTop, rail, { y: 200, h: 40 }),
    { id: "R", name: "Back stretcher", size: [2 * xi, 40, 25], pos: [0, ySt, -zl], material: "wood" },
    sideFrame(1, xl, zl, yTop, rail, { y: 200, h: 40 }),
    { id: "T", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    ...dr.parts,
  ];
  const yE = yS0 + ST / 2;
  const zB = -D / 2 + t / 2;
  const frameBolts = (sx: number) => [
    at("bolt", [-1, 1].map((sz): Vec3 => [sx * (W / 2), yE, sz * (zl - 60)]), [-sx, 0, 0], sx < 0 ? "EL" : "ER", "S", BOLT),
  ];
  // the top's six cam pins and dowels: two over each side rail, one over the niche back, one over the divider
  const topPts: { p: Vec3; on: string }[] = [
    ...SIDES.flatMap((sx) => [-100, 100].map((z) => ({ p: [sx * (xi + 10), yTop, z] as Vec3, on: sx < 0 ? "EL" : "ER" }))),
    { p: [(-xi + xd) / 2, yTop, zB], on: "B" },
    { p: [xd, yTop, 0], on: "V" },
  ];
  const steps: CustomStep[] = [
    { title: "Tap a dowel into the end of the niche back", detail: "Into the end that meets the divider.", add: ["B"], fix: [at("dowel", [[xd - t / 2, yB, zB]], [1, 0, 0], "B", "V")], tools: ["hammer"], pose: "-y" },
    {
      title: "Screw the divider to the niche back",
      detail: "One long screw through the divider into the end of the back. They make an L.",
      add: ["V"],
      fix: [at("bolt", [[xd + t / 2, yB + 30, zB]], [-1, 0, 0], "V", "B", BOLT)],
      tools: ["allen"],
    },
    {
      title: "Tap dowels into the edges",
      detail: "One into the back and two into the divider, on the edge that goes against the shelf.",
      fix: [at("dowel", [[(-xi + xd) / 2, yS0 + ST, zB]], [0, -1, 0], "B", "S"), at("dowel", [-120, 120].map((z): Vec3 => [xd, yS0 + ST, z]), [0, -1, 0], "V", "S")],
      tools: ["hammer"],
    },
    { title: "Lay the shelf on the dowels", detail: "The whole table is built upside down from here, on a rug.", add: ["S"], warnings: ["floor"] },
    {
      title: "Screw the shelf to the back and divider",
      detail: "Four long screws through the shelf, two into each board.",
      fix: [at("bolt", [-200, -100].map((x): Vec3 => [x, yS0, zB]), [0, 1, 0], "S", "B", BOLT), at("bolt", [-50, 50].map((z): Vec3 => [xd, yS0, z]), [0, 1, 0], "S", "V", BOLT)],
      tools: ["allen"],
    },
    {
      title: "Tap dowels into the ends",
      detail: "Three into each end of the shelf and one into the end of the niche back.",
      fix: [
        ...SIDES.map((sx) => at("dowel", [-120, 0, 120].map((z): Vec3 => [sx * xi, yE, z]), [sx, 0, 0], "S", sx < 0 ? "EL" : "ER")),
        at("dowel", [[-xi, yB, zB]], [-1, 0, 0], "B", "EL"),
      ],
      tools: ["hammer"],
    },
    {
      title: "Screw on the left side frame",
      detail: "Two screws through the rail into the shelf and one into the niche back.",
      add: ["EL"],
      fix: [...frameBolts(-1), at("bolt", [[-W / 2, yB, zB]], [1, 0, 0], "EL", "B", BOLT)],
      tools: ["allen"],
    },
    {
      title: "Screw the stretcher to the back leg",
      detail: "One screw through the leg into the end of the stretcher. It goes between the two back legs.",
      add: ["R"],
      fix: [at("bolt", [[-W / 2, ySt, -zl]], [1, 0, 0], "EL", "R", BOLT)],
      tools: ["allen"],
    },
    {
      title: "Screw on the right side frame",
      detail: "Two screws into the shelf and one into the stretcher.",
      add: ["ER"],
      fix: [...frameBolts(1), at("bolt", [[W / 2, ySt, -zl]], [-1, 0, 0], "ER", "R", BOLT)],
      tools: ["allen"],
    },
    {
      title: "Screw a foot into each leg",
      detail: "By hand. Turn them later to steady the table.",
      fix: [at("foot", SIDES.flatMap((sx) => SIDES.map((sz): Vec3 => [sx * xl, 0, sz * zl])), [0, 1, 0], undefined, undefined, { len: 14, dia: 22 })],
    },
    {
      title: "Turn the table over and tap dowels into the frame",
      detail: "Stand it on its feet. Six dowels go into the top edges: two in each side rail, one in the niche back, one in the divider.",
      fix: topPts.map((q) => at("dowel", [[q.p[0] + (q.on === "B" ? 60 : 0), q.p[1], q.p[2] + (q.on === "B" ? 0 : q.on === "V" ? 80 : 50)]], [0, 1, 0], q.on, "T")),
      tools: ["hammer"],
      pose: "+y",
    },
    {
      title: "Screw cam pins into the top and lower it on",
      detail: "Six cam pins go into the holes under the top. Lower it so the dowels and pins find their holes.",
      add: ["T"],
      fix: [at("camScrew", topPts.map((q) => q.p), [0, 1, 0], "T", undefined, { len: 34 })],
      tools: ["screwdriver"],
    },
    {
      title: "Turn the cam locks",
      detail: "One beside each cam pin, arrow towards it. Turn each one clockwise until the top is pulled tight.",
      fix: [
        ...SIDES.map((sx) => at("cam", [-100, 100].map((z): Vec3 => [sx * xi, yTop - 25, z]), [-sx, 0, 0], sx < 0 ? "EL" : "ER", undefined, { dia: 15 })),
        at("cam", [[(-xi + xd) / 2, yTop - 25, zB + t / 2]], [0, 0, -1], "B", undefined, { dia: 15 }),
        at("cam", [[xd + t / 2, yTop - 25, 0]], [-1, 0, 0], "V", undefined, { dia: 15 }),
      ],
      tools: ["screwdriver"],
    },
    ...dr.steps,
    { title: "Slide the drawer in", detail: "From the front or the back: it opens to both sides. Don't pull it all the way out, it has no stop." },
  ];
  return { parts, steps };
}


/** A flat panel of slats between two edge bars: slats along `along` ("x" across, "y" up), the bars at its ends. */
function slatted(size: Vec3, along: "x" | "y" | "z", n: number): PartPiece[] {
  const [w, h, d] = size;
  if (along === "y") {
    // a standing back: bars top and bottom, slats upright
    const g = (w - 20) / n;
    return [
      box([w, 30, d], [0, h / 2 - 15, 0]),
      box([w, 30, d], [0, -h / 2 + 15, 0]),
      ...Array.from({ length: n }, (_, i) => box([g * 0.55, h - 60, d * 0.7], [-w / 2 + 10 + g * (i + 0.5), 0, 0])),
    ];
  }
  // a shelf: bars front and back, slats running side to side
  const g = (d - 60) / n;
  return [
    box([w, h, 30], [0, 0, -d / 2 + 15]),
    box([w, h, 30], [0, 0, d / 2 - 15]),
    ...Array.from({ length: n }, (_, i) => box([w, h * 0.7, g * 0.55], [0, 0, -d / 2 + 30 + g * (i + 0.5)])),
  ];
}

/** A ladder frame: two stiles, front and back, with rungs between them. */
function ladder(id: string, name: string, x: number, y0: number, y1: number, zl: number, rungs: number[]): CustomPart {
  const h = y1 - y0, yc = (y0 + y1) / 2, P = 30;
  return {
    id,
    name,
    size: [P, h, 2 * zl + P],
    pos: [x, yc, 0],
    material: "wood",
    pieces: [...SIDES.map((sz) => box([P, h, P], [0, 0, sz * zl])), ...rungs.map((y) => box([P, P, 2 * zl - P], [0, y - yc, 0]))],
  };
}

function openWardrobe(): CustomParams {
  // IKEA: 120 wide, 47 deep, 186 high; the door covers the closed left side
  const W = 1200, D = 470, H = 1860;
  const T = 20, P = 30;
  const yB = 150, yF0 = yB + T, yF1 = H - T; // bottom board on the legs, frames between bottom and top
  const zl = 205; // stile centres
  const xL = -W / 2 + P / 2, xM = 55, xR = W / 2 - P / 2;
  const li = xL + P / 2, mi = xM - P / 2, mo = xM + P / 2, ri = xR - P / 2; // inner faces
  const yA = 1420, yS = 1050, yC = 680, yP1 = 400, yP2 = 1700; // shelf centres
  const ends = [yF0 + P / 2, yF1 - P / 2];
  const sw = mi - li, sx = (li + mi) / 2; // the closed side's inside
  const rw = ri - mo, rx = (mo + ri) / 2;
  const sd = 2 * zl; // shelves reach the middle of the stiles, the back sits behind them
  const zBk = -(sd / 2) - 7.5;
  const hBk = (yF1 - yF0) / 2;
  const yRail = 1800, hx0 = mo + 15, hx1 = ri - 15;
  const legX = W / 2 - 30, legZ = D / 2 - 40, LG = 40;
  const doorW = mi - (xL - P / 2) + 10, doorH = yF1 - yF0 - 30, zDoor = zl + P / 2 + 13;
  const shelf = (id: string, name: string, w: number, x: number, y: number, slats: boolean): CustomPart => ({
    id, name, size: [w, T, sd], pos: [x, y, 0], material: "wood", ...(slats ? { pieces: slatted([w, T, sd], "z", 8) } : {}),
  });
  const legFrame = (id: string, s: number): CustomPart => ({
    id, name: "Leg frame", size: [LG, yB, 2 * legZ + LG], pos: [s * legX, yB / 2, 0], material: "wood",
    pieces: [...SIDES.map((sz) => box([LG, yB, LG], [0, 0, sz * legZ])), box([LG, 40, 2 * legZ - LG], [0, yB / 2 - 20, 0])],
  });
  const parts: CustomPart[] = [
    ladder("FL", "Left frame", xL, yF0, yF1, zl, [...ends, yC, yS, yA]),
    shelf("SA", "Slatted shelf", sw, sx, yA, true),
    shelf("SB", "Slatted shelf", sw, sx, yS, true),
    ladder("FM", "Middle frame", xM, yF0, yF1, zl, [...ends, yC, yS, yA]),
    shelf("SC", "Slatted shelf", sw, sx, yC, true),
    { id: "BK1", name: "Slatted back", size: [sw, hBk, 15], pos: [sx, yF0 + hBk / 2, zBk], material: "wood", pieces: slatted([sw, hBk, 15], "y", 12) },
    { id: "BK2", name: "Slatted back", size: [sw, hBk, 15], pos: [sx, yF0 + hBk * 1.5, zBk], material: "wood", pieces: slatted([sw, hBk, 15], "y", 12) },
    shelf("P1", "Plain shelf", sw, sx, yP1, false),
    shelf("P2", "Plain shelf", sw, sx, yP2, false),
    shelf("RB", "Slatted bench shelf", rw, rx, yC, true),
    ladder("FR", "Right frame", xR, yF0, yF1, zl, [...ends, yC, 1250, 1500]),
    { id: "BT", name: "Bottom", size: [W, T, D], pos: [0, yB + T / 2, 0], material: "wood" },
    legFrame("LF1", -1),
    legFrame("LF2", 1),
    ...SIDES.map((sz, i): CustomPart => ({ id: `LR${i}`, name: "Long rail", size: [2 * legX - LG, 50, 25], pos: [0, yB - 25, sz * legZ], material: "wood" })),
    ...SIDES.map((s, i): CustomPart => ({ id: `CH${i}`, name: "Rail holder", size: [30, 45, 30], pos: [s < 0 ? mo + 15 : ri - 15, yF1 - 22.5, 0], material: "wood" })),
    { id: "CR", name: "Clothes rail", size: [25, hx1 - hx0 - 30, 25], pos: [rx, yRail, 0], shape: "cyl", material: "wood", rot: [0, 0, Math.PI / 2] },
    { id: "TP", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0], material: "wood" },
    { id: "DR", name: "Sliding door", size: [doorW, doorH, 22], pos: [(xL - P / 2 + mi + 10) / 2, yF0 + 15 + doorH / 2, zDoor], material: "wood", pieces: slatted([doorW, doorH, 22], "y", 16) },
  ];
  // the long Allen screws, through a frame's stile into the end of a shelf
  const zs = zl - 7;
  const thru = (frame: "FL" | "FM" | "FR", into: string, y: number, zz: number[] = [-zs, zs], fromRight = false): CustomFix => {
    const x = frame === "FL" ? xL - P / 2 : frame === "FR" ? xR + P / 2 : fromRight ? mo : mi;
    const dir: Vec3 = frame === "FL" || (frame === "FM" && !fromRight) ? [1, 0, 0] : [-1, 0, 0];
    return at("bolt", zz.map((z): Vec3 => [x, y, z]), dir, frame, into, BOLT);
  };
  const endDowels = (id: string, y: number, zz: number[]) => [
    at("dowel", zz.map((z): Vec3 => [li, y, z]), [-1, 0, 0], id, "FL"),
    at("dowel", zz.map((z): Vec3 => [mi, y, z]), [1, 0, 0], id, "FM"),
  ];
  const fx = [xL, xM, xR];
  const topPts = (y: number) => fx.flatMap((x) => [-zl, 0, zl].map((z): Vec3 => [x, y, z]));
  const steps: CustomStep[] = [
    { title: "Tap dowels into the ends of a slatted shelf", detail: "Three in each end. Peel off any protective film first.", fix: endDowels("SA", yA, [-120, 0, 120]), wait: ["SA"], tools: ["hammer"] },
    { title: "Tap dowels into the second slatted shelf", detail: "Two in each end, the bars of the slats facing the same way as on the first.", fix: endDowels("SB", yS, [-100, 100]), wait: ["SB"], tools: ["hammer"] },
    {
      title: "Screw the first shelf to the left frame",
      detail: "Lay the frame on its back edge on a rug. Check the slats face up and the holes face in, then two long screws through the stiles.",
      add: ["FL", "SA"],
      fix: [thru("FL", "SA", yA)],
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Tap dowels into the third slatted shelf", detail: "Two in each end.", fix: endDowels("SC", yC, [-100, 100]), wait: ["SC"], tools: ["hammer"] },
    { title: "Fit the middle frame onto the shelf", detail: "Press it onto the dowels and drive two screws through its stiles.", add: ["FM"], fix: [thru("FM", "SA", yA, undefined, true)], tools: ["allen"] },
    {
      title: "Slide in the other two slatted shelves",
      detail: "Ease each one between the frames onto the dowels in the left frame, then four screws through the left frame.",
      add: ["SB", "SC"],
      fix: [thru("FL", "SB", yS), thru("FL", "SC", yC)],
      tools: ["allen"],
    },
    {
      title: "Join the two halves of the slatted back",
      detail: "Four dowels in the edge of one half, then press the other half on so they make one long panel.",
      add: ["BK1", "BK2"],
      fix: [at("dowel", [-220, -75, 75, 220].map((dx): Vec3 => [sx + dx, yF0 + hBk, zBk]), [0, 1, 0], "BK1", "BK2")],
      wait: ["BK1", "BK2"],
      tools: ["hammer"],
    },
    { title: "Slide the back under the frame", detail: "Lift the frame a little and slide the back in under it, slats down, so it sits between the two frames.", add: ["BK1", "BK2"], from: { BK1: [0, 0, -260], BK2: [0, 0, -260] }, people: 2, warnings: ["two"] },
    {
      title: "Tap dowels into the plain shelves",
      detail: "Four along the back edge of each one: they go into the slatted back.",
      fix: [at("dowel", [-200, -70, 70, 200].map((dx): Vec3 => [sx + dx, yP1, -sd / 2]), [0, 0, -1], "P1", "BK1"), at("dowel", [-200, -70, 70, 200].map((dx): Vec3 => [sx + dx, yP2, -sd / 2]), [0, 0, -1], "P2", "BK2")],
      wait: ["P1", "P2"],
      tools: ["hammer"],
    },
    {
      title: "Fit the plain shelves",
      detail: "Lower each one onto the back's dowels, the holes in its ends towards the frames, then two screws through the left frame into each.",
      add: ["P1", "P2"],
      from: { P1: [0, 0, 250], P2: [0, 0, 250] },
      fix: [thru("FL", "P1", yP1), thru("FL", "P2", yP2)],
      tools: ["allen"],
    },
    { title: "Slide in the slatted bench shelf", detail: "On the other side of the middle frame, at the height of the lowest slatted shelf.", add: ["RB"], from: { RB: [300, 0, 0] } },
    {
      title: "Screw on the right frame",
      detail: "Two screws through it into the bench shelf, two through the middle frame into the bench and two into the shelf beside it.",
      add: ["FR"],
      fix: [thru("FR", "RB", yC), thru("FM", "RB", yC), thru("FM", "SB", yS, undefined, true)],
      tools: ["allen"],
    },
    {
      title: "Tap dowels into the frames' bottom ends",
      detail: "Two in each frame.",
      fix: fx.map((x, i) => at("dowel", [-100, 100].map((z): Vec3 => [x, yF0, z]), [0, -1, 0], ["FL", "FM", "FR"][i], "BT")),
      tools: ["hammer"],
    },
    { title: "Swing the bottom onto the dowels", detail: "Hold it upright against the frames' ends and push it on evenly.", add: ["BT"], from: { BT: [0, -250, 0] } },
    {
      title: "Screw the bottom to the frames",
      detail: "Nine long screws through the bottom, three into each frame.",
      fix: [at("bolt", topPts(yB), [0, 1, 0], "BT", undefined, BOLT)],
      tools: ["allen"],
    },
    {
      title: "Join the leg frames with the long rails",
      detail: "Four screws, one through each leg into the end of a rail. The holes for the dowels face up.",
      add: ["LF1", "LF2", "LR0", "LR1"],
      wait: ["LF1", "LF2", "LR0", "LR1"],
      fix: SIDES.map((s, i) => at("bolt", SIDES.map((sz): Vec3 => [s * (legX + LG / 2), yB - 25, sz * legZ]), [-s, 0, 0], `LF${i}`, undefined, BOLT)),
      tools: ["allen"],
    },
    {
      title: "Screw a foot into each leg",
      detail: "By hand, all the way in. Turn them later to level the wardrobe.",
      fix: [at("foot", SIDES.flatMap((s) => SIDES.map((sz): Vec3 => [s * legX, 0, sz * legZ])), [0, 1, 0], undefined, undefined, { len: 14, dia: 30 })],
    },
    {
      title: "Turn the base over and tap in the dowels",
      detail: "Two in the top of each leg frame and two in each long rail.",
      fix: [
        ...SIDES.map((s, i) => at("dowel", [-120, 120].map((z): Vec3 => [s * legX, yB, z]), [0, 1, 0], `LF${i}`, "BT")),
        ...SIDES.map((sz, i) => at("dowel", [-300, 300].map((x): Vec3 => [x, yB, sz * legZ]), [0, 1, 0], `LR${i}`, "BT")),
      ],
      tools: ["hammer"],
    },
    { title: "Push the base onto the bottom", detail: "Its dowels go into the holes in the bottom.", add: ["LF1", "LF2", "LR0", "LR1"], from: { LF1: [0, -300, 0], LF2: [0, -300, 0], LR0: [0, -300, 0], LR1: [0, -300, 0] } },
    {
      title: "Screw the base to the bottom",
      detail: "Ten screws up through the rails into the bottom. Then stand the wardrobe up together.",
      fix: [
        ...SIDES.map((s, i) => at("bolt", [-80, 80].map((z): Vec3 => [s * legX, yB - 40, z]), [0, 1, 0], `LF${i}`, "BT", BOLT)),
        ...SIDES.map((sz, i) => at("bolt", [-400, 0, 400].map((x): Vec3 => [x, yB - 40, sz * legZ]), [0, 1, 0], `LR${i}`, "BT", BOLT)),
      ],
      tools: ["allen"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Stand it up and drive the last screws",
      detail: "Seven more: through the middle frame into the shelves beside it, and one through the left frame into the foot of the back.",
      fix: [
        thru("FM", "SC", yC, undefined, true),
        thru("FM", "P1", yP1, undefined, true),
        thru("FM", "P2", yP2, undefined, true),
        at("bolt", [[xL - P / 2, yF0 + 15, zBk]], [1, 0, 0], "FL", "BK1", BOLT),
      ],
      tools: ["allen"],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw the clothes rail between its holders",
      detail: "One screw through each holder into an end of the rail.",
      add: ["CH0", "CH1", "CR"],
      wait: ["CH0", "CH1", "CR"],
      fix: SIDES.map((s, i) => at("bolt", [[s < 0 ? mo : ri, yRail, 0]], [-s, 0, 0], `CH${i}`, "CR", BOLT)),
      tools: ["allen"],
    },
    {
      title: "Screw the rail to the frames",
      detail: "The holders go against the top rungs of the middle and right frames. One screw through each frame.",
      add: ["CH0", "CH1", "CR"],
      from: { CH0: [0, -250, 0], CH1: [0, -250, 0], CR: [0, -250, 0] },
      fix: [at("bolt", [[xM - P / 2, yF1 - 15, 0]], [1, 0, 0], "FM", "CH0", BOLT), at("bolt", [[xR + P / 2, yF1 - 15, 0]], [-1, 0, 0], "FR", "CH1", BOLT)],
      tools: ["allen"],
    },
    {
      title: "Tap dowels into the tops of the frames",
      detail: "Two in each frame.",
      fix: fx.map((x, i) => at("dowel", [-100, 100].map((z): Vec3 => [x, yF1, z]), [0, 1, 0], ["FL", "FM", "FR"][i], "TP")),
      tools: ["hammer"],
    },
    { title: "Lay the top on", detail: "Press it down onto the dowels, front edge over the door's side.", add: ["TP"] },
    {
      title: "Hook the door into the top",
      detail: "Tilt the door in at the front of the closed side, lift its two hooks into the track under the top and let it hang. Its foot goes in the guide at the bottom.",
      add: ["DR"],
      from: { DR: [0, 0, 300] },
      fix: [at("hook", [-1, 1].map((k): Vec3 => [(xL - P / 2 + mi + 10) / 2 + k * (doorW / 2 - 80), yF1 - 15, zDoor]), [0, 1, 0], "DR", undefined, { name: "Door hook", len: 20, dia: 20 })],
      warnings: ["hand"],
    },
    {
      title: "Screw the top down",
      detail: "Nine screws down through the top into the frames. Use a step stool, not the wardrobe, to reach.",
      fix: [at("bolt", topPts(H), [0, -1, 0], "TP", undefined, BOLT)],
      tools: ["allen"],
    },
    {
      title: "Tie it to the wall",
      detail: "Screw the strap under the top at the back, then to the wall with a plug and screw. Wall screws and plugs depend on your wall.",
      fix: [
        at("strap", [[xM, H - T - 10, -D / 2 - 2]], [0, 0, -1], "TP", undefined, { len: 110, dia: 20 }),
        at("screw", [[xM, H - T, -D / 2 + 30]], [0, 1, 0], "TP", undefined, { len: 12, dia: 4, included: true }),
        at("washer", [[xM, H - T - 10, -D / 2 - 3], [xM, H - T - 10, -D / 2 - 6]], [0, 0, -1], undefined, undefined, { dia: 12 }),
        at("plug", [[xM, H - T - 10, -D / 2 - 40]], [0, 0, -1]),
        at("screw", [[xM, H - T - 10, -D / 2 - 6]], [0, 0, -1], undefined, undefined, { len: 50, dia: 5 }),
      ],
      tools: ["screwdriver", "drill", "pencil"],
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["NORDKISA"],
  recipe(s: ProductSpec) {
    const slug = s.slug ?? "";
    if (/bedside-table/.test(slug)) return bedside();
    if (/dressing-table/.test(slug)) return dressingTable();
    if (/open-wardrobe/.test(slug)) return openWardrobe();
    return null;
  },
};
export default family;
