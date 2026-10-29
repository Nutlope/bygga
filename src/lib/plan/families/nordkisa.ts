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

const family: Family = {
  names: ["NORDKISA"],
  recipe(s: ProductSpec) {
    const slug = s.slug ?? "";
    if (/bedside-table/.test(slug)) return bedside();
    if (/dressing-table/.test(slug)) return dressingTable();
    return null;
  },
};
export default family;
