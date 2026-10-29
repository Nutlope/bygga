import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * GONATT cot (and the US crib) with drawer, read from IKEA's manuals; both go together the same way.
 * The slatted base gets its dowels on a rug. One end panel takes the fixed side, the front side and the rail under
 * it, each on a long bolt into a barrel nut. The base gets its four supports, the cot is stood on that end and the
 * base goes in at its upper height (two supports into the end's holes), the back panel slides down behind the drawer
 * space and the other end is lowered on and bolted the same way. Still on its end, four glides go under the end
 * panels and four drawer stops are screwed in; stood up, the front side gets its four extra bolts and caps.
 * The drawer: cam bolts and dowels, the sides and the bottom on cam locks, the other long panel, ten screws through
 * it, five castors and three knobs.
 * IKEA's sizes: the cot is 143 x 75 x 112 cm for a 70 x 140 mattress, the crib 136 x 75 x 112 for 70 x 132.
 */

interface Bit {
  piece: PartPiece;
  lo: Vec3;
  hi: Vec3;
}
const bx = (lo: Vec3, hi: Vec3, material?: PartMaterial): Bit => ({
  piece: { shape: "box", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], ...(material ? { material } : {}) },
  lo,
  hi,
});
function assemble(id: string, name: string, bits: Bit[], material: PartMaterial, extra?: boolean): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...bits.map((b) => b.lo[k]))) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(...bits.map((b) => b.hi[k]))) as Vec3;
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  return {
    id,
    name,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    pos,
    material,
    ...(extra ? { extra } : {}),
    pieces: bits.map((b) => ({ ...b.piece, pos: [b.piece.pos[0] - pos[0], b.piece.pos[1] - pos[1], b.piece.pos[2] - pos[2]] as Vec3 })),
  };
}
const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: PartMaterial = "board"): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
});
const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const spread = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));

function cot(s: ProductSpec): CustomParams {
  const crib = /crib/i.test(`${s.variant} ${s.slug ?? ""}`);
  const ml = crib ? 1320 : 1400, mw = 700;
  const T = 15, L = ml + 2 * T + (crib ? 10 : 0), W = 750, H = 1120;
  const X = L / 2, xi = X - T, Z = W / 2, zi = mw / 2;
  const DY0 = 40, DY1 = 300, RY = 380, TOP = 900; // drawer, the rail over it, the top of the sides
  const BY = 540; // top of the slats at the upper height, for a newborn

  // end panels: arched at the top, a cut-out between the feet
  const end = (id: string, g: number) => {
    const x0 = g < 0 ? -X : xi, x1 = g < 0 ? -xi : X;
    return assemble(id, "End panel", [
      bx([x0, 0, -Z], [x1, 70, -Z + 130]),
      bx([x0, 0, Z - 130], [x1, 70, Z]),
      bx([x0, 70, -Z], [x1, H - Z, Z]),
      // the round top: half a disc as wide as the end, stood upright with its flat edge down
      { piece: { shape: "halfcyl", size: [W, T, W / 2], pos: [(x0 + x1) / 2, H - Z / 2, 0], rot: [-Math.PI / 2, 0, -Math.PI / 2] }, lo: [x0, H - Z, -Z], hi: [x1, H, Z] },
    ], "board");
  };
  const side = (id: string, name: string, g: number) => {
    const z0 = g < 0 ? -Z : zi, z1 = g < 0 ? -zi : Z;
    const bits = [bx([-xi, RY, z0], [xi, RY + 40, z1]), bx([-xi, TOP - 40, z0], [xi, TOP, z1])];
    for (const x of spread(-xi + 60, xi - 60, crib ? 17 : 18)) bits.push(bx([x - 14, RY + 40, z0 + 2], [x + 14, TOP - 40, z1 - 2]));
    return assemble(id, name, bits, "wood");
  };
  const bars = [-zi + 20, 0, zi - 20];
  const base = assemble("B", "Slatted base", [
    ...bars.map((z) => bx([-xi + 5, BY - 40, z - 20], [xi - 5, BY - 16, z + 20])),
    ...spread(-xi + 50, xi - 50, crib ? 12 : 13).map((x) => bx([x - 30, BY - 16, -zi + 5], [x + 30, BY, zi - 5])),
  ], "wood");
  const parts: CustomPart[] = [
    base,
    end("E0", -1),
    side("S0", "Back side", -1),
    side("S1", "Front side", 1),
    box("F", "Front rail", [-xi, DY1, zi], [xi, RY, Z]),
    box("P", "Back panel", [-xi, DY0 + 20, -Z], [xi, RY, -Z + 12], "fiber"),
    end("E1", 1),
  ];
  // the drawer runs on castors under the base
  const dx = xi - 8, dz0 = -Z + 30, dz1 = Z - 18;
  parts.push(
    box("DF", "Drawer front", [-dx, DY0, dz1], [dx, DY1 - 10, Z]),
    box("DK", "Drawer back", [-dx + 18, DY0 + 30, dz0], [dx - 18, DY1 - 40, dz0 + 16]),
    box("DS0", "Drawer side", [-dx, DY0 + 30, dz0], [-dx + 18, DY1 - 40, dz1]),
    box("DS1", "Drawer side", [dx - 18, DY0 + 30, dz0], [dx, DY1 - 40, dz1]),
    box("DB", "Drawer bottom", [-dx + 18, DY0 + 30, dz0 + 16], [dx - 18, DY0 + 46, dz1]),
  );
  parts.push({ ...box("M", "Mattress", [-ml / 2, BY, -mw / 2], [ml / 2, BY + 100, mw / 2], "soft"), extra: true });

  const yy = [RY + 20, TOP - 20];
  const knobX = [-0.66, 0, 0.66].map((t) => t * dx);
  const castX = [-dx + 100, -dx / 2, 0, dx / 2, dx - 100];
  const endBolts = (g: number): CustomFix[] => [
    fix("nut", [...yy.map((y): Vec3 => [g * (xi - 40), y, -(Z + zi) / 2]), [g * (xi - 40), TOP - 20, (Z + zi) / 2], [g * (xi - 40), (DY1 + RY) / 2, (Z + zi) / 2]], [0, -1, 0], { name: "Barrel nut", len: 14, dia: 10 }),
    fix("bolt", [...yy.map((y): Vec3 => [g * X, y, -(Z + zi) / 2]), [g * X, TOP - 20, (Z + zi) / 2], [g * X, (DY1 + RY) / 2, (Z + zi) / 2]], [-g, 0, 0], { len: 100, dia: 6, on: g < 0 ? "E0" : "E1" }),
  ];
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the slatted base",
      detail: "Lay both slat sections and the three bars on a rug. Use the longer dowels here.",
      // the base waits on the rug until it is dropped into the end panel
      wait: ["B"],
      fix: [-1, 1].map((g) => fix("dowel", [-zi + 20, zi - 20].flatMap((z): Vec3[] => [[g * (xi - 5), BY - 28, z - 8], [g * (xi - 5), BY - 28, z + 8]]), [-g, 0, 0], { on: "B" })),
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the sides and front rail to one end",
      detail: "Push a barrel nut into each rail end, slot toward the hole, and turn a long bolt through the end panel into it. The front rail goes under the front side.",
      add: ["E0", "S0", "S1", "F"],
      fix: endBolts(-1),
      tools: ["allen", "flathead"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Fit the four base supports",
      detail: "Hook each support into a corner of the base and bolt it on. The hooks face out.",
      fix: [
        ...[-1, 1].map((g) => fix("pin", [-1, 1].map((h): Vec3 => [g * (xi - 5), BY - 28, h * (zi - 60)]), [g, 0, 0], { name: "Base support", len: 60, dia: 10, on: "B" })),
        fix("bolt", [-1, 1].flatMap((g) => [-1, 1].map((h): Vec3 => [g * (xi - 40), BY, h * (zi - 60)])), [0, -1, 0], { len: 20, dia: 6, on: "B" }),
      ],
      tools: ["allen"],
    },
    {
      title: "Stand it on its end and drop the base in",
      detail: "Rest the end panel on the rug. The supports go into the upper holes for a newborn, the lower ones once your baby can sit up.",
      pose: "+x",
      add: ["B"],
      from: { B: [400, 0, 0] },
      people: 2,
      warnings: ["two", "floor"],
    },
    { title: "Slide in the back panel", detail: "Down the grooves at the back, below the fixed side, smooth side out.", add: ["P"], from: { P: [400, 0, 0] } },
    {
      title: "Bolt the other end panel on",
      detail: "Barrel nuts into the rail ends, lower the end onto them and the base supports, then four long bolts. Now tighten all eight.",
      add: ["E1"],
      fix: endBolts(1),
      tools: ["allen", "flathead"],
      from: { E1: [300, 0, 0] },
    },
    {
      title: "Press the glides under the end panels",
      detail: "Two under each end, at the feet.",
      fix: [fix("glide", [-1, 1].flatMap((g) => [-1, 1].map((h): Vec3 => [g * (X - T / 2), 0, h * (Z - 65)])), [0, 1, 0], { name: "Glide", len: 8, dia: 40 })],
    },
    {
      title: "Screw in the drawer stops",
      detail: "One on the inside of each end panel, low down at the front.",
      fix: [
        ...[-1, 1].map((g) => fix("clip", [DY0 + 60, DY1 - 60].map((y): Vec3 => [g * xi, y, Z - 50]), [-g, 0, 0], { name: "Drawer stop", len: 20, dia: 20, on: g < 0 ? "E0" : "E1" })),
        // through the stop's back end into the end panel
        ...[-1, 1].map((g) => fix("screw", [DY0 + 60, DY1 - 60].map((y): Vec3 => [g * xi, y, Z - 74]), [g, 0, 0], { len: 16, dia: 4, on: g < 0 ? "E0" : "E1" })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Stand it up and lock the front side",
      detail: "A bolt through each end into the front side, top and bottom, then press a cap over each one.",
      pose: "+y",
      people: 2,
      fix: [
        ...[-1, 1].map((g) => fix("bolt", [RY + 70, RY + 150].map((y): Vec3 => [g * X, y, (Z + zi) / 2]), [-g, 0, 0], { len: 30, dia: 6, on: g < 0 ? "E0" : "E1" })),
        ...[-1, 1].map((g) => fix("cap", [RY + 70, RY + 150].map((y): Vec3 => [g * X, y, (Z + zi) / 2]), [-g, 0, 0], { name: "Cover cap", len: 6, dia: 20, on: g < 0 ? "E0" : "E1" })),
      ],
      tools: ["allen"],
    },
    // the drawer, built on the rug
    {
      title: "Start the drawer on its front",
      detail: "Lay the front face down on a rug. Screw the cam bolts into it and into the back, and tap the short dowels into the sides.",
      add: ["DF", "DS0", "DS1"],
      fix: [
        fix("camScrew", [-1, 1].flatMap((g) => [DY0 + 60, DY0 + 110, DY1 - 120, DY1 - 70].map((y): Vec3 => [g * (dx - 9), y, dz1])), [0, 0, -1], { len: 34, dia: 6, on: "DF" }),
        fix("dowel", [-1, 1].flatMap((g) => [DY0 + 90, DY1 - 90].map((y): Vec3 => [g * (dx - 9), y, dz0])), [0, 0, -1], { len: 30, dia: 6 }),
        fix("cam", [-1, 1].flatMap((g) => [DY0 + 60, DY1 - 70].map((y): Vec3 => [g * (dx - 18), y, dz1 - 30])), [1, 0, 0], { dia: 15 }),
      ],
      tools: ["screwdriver", "hammer"],
      from: { DF: [0, 0, 400], DS0: [0, 0, 400], DS1: [0, 0, 400] },
    },
    {
      title: "Slide the bottom in and fit the back",
      detail: "The bottom slides into the grooves; turn its four cam locks, then lower the back on and turn the last four.",
      add: ["DB", "DK"],
      fix: [
        fix("cam", [-0.6, -0.2, 0.2, 0.6].map((t): Vec3 => [t * dx, DY0 + 46, dz1 - 30]), [0, 1, 0], { dia: 15 }),
        fix("cam", [-1, 1].flatMap((g) => [DY0 + 60, DY1 - 70].map((y): Vec3 => [g * (dx - 18), y, dz0 + 30])), [1, 0, 0], { dia: 15 }),
        fix("camScrew", [-0.6, -0.2, 0.2, 0.6].map((t): Vec3 => [t * dx, DY0 + 38, dz1]), [0, 0, -1], { len: 34, dia: 6, on: "DF" }),
      ],
      tools: ["screwdriver"],
      from: { DB: [0, 0, -500], DK: [0, 0, -400] },
    },
    {
      title: "Screw the back to the sides and bottom",
      detail: "Ten long screws through the back panel.",
      fix: [fix("screw", [...[-1, 1].flatMap((g) => [DY0 + 60, (DY0 + DY1) / 2, DY1 - 60].map((y): Vec3 => [g * (dx - 9), y, dz0])), ...[-0.6, -0.2, 0.2, 0.6].map((t): Vec3 => [t * dx, DY0 + 38, dz0])], [0, 0, 1], { len: 50, dia: 5, on: "DK" })],
      tools: ["allen"],
    },
    {
      title: "Screw the castors under the drawer",
      detail: "Turn it upside down. Two screws for each of the five castors.",
      fix: [
        fix("castor", castX.map((x): Vec3 => [x, DY0 + 30, x === 0 ? 0 : (dz0 + dz1) / 2 + (Math.abs(x) > dx / 2 ? 150 : -150)]), [0, 1, 0], { len: 30, dia: 30 }),
        fix("screw", castX.flatMap((x): Vec3[] => [[x - 20, DY0 + 30, 0], [x + 20, DY0 + 30, 0]]), [0, 1, 0], { len: 12, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the knobs and push the drawer in",
      detail: "A screw through the front into each of the three knobs. The drawer stops keep it from coming all the way out.",
      fix: [fix("knob", knobX.map((x): Vec3 => [x, (DY0 + DY1) / 2, Z]), [0, 0, -1], { len: 30, dia: 50, on: "DF" }), fix("screw", knobX.map((x): Vec3 => [x, (DY0 + DY1) / 2, Z - 23]), [0, 0, 1], { len: 30, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Lay the mattress in", detail: "It should fit snugly, with no gap wider than two fingers at the sides.", add: ["M"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["GONATT"],
  recipe(s) {
    if (!/\b(cot|crib)\b/i.test(`${s.variant} ${(s.slug ?? "").replace(/-/g, " ")}`)) return null;
    return cot(s);
  },
};
export default family;
