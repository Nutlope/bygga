import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * HÄGERNÄS stool, read from its manual. Two leg frames (two legs and a rail, glued at the factory) and two loose rails.
 * Dowels go into the ends of the loose rails, six seat brackets screw into the four rails by hand, then upside down
 * the loose rails go between the frames and four long bolts pull them tight. Stood up, a dowel goes into the top of
 * each leg, and upside down again the frame is lowered onto the seat and the brackets are screwed to it.
 * IKEA's sizes: 32 x 32 cm, 45 high.
 */

const fix = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

function recipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 320, H = Math.round(s.size.h * 10) || 450;
  const T = 20, L = 38, rt = 18, rh = 80;
  const yS = H - T; // underside of the seat, top of the legs and rails
  const xl = W / 2 - 10 - L / 2; // leg centres
  const yr = yS - rh / 2;
  const span = 2 * xl - L; // a rail between two legs
  const parts: CustomPart[] = [];
  for (const [i, sx] of [[0, -1], [1, 1]] as const) {
    const c: Vec3 = [sx * xl, yS / 2, 0];
    const pieces: PartPiece[] = [
      { shape: "box", size: [L, yS, L], pos: [0, 0, -xl] },
      { shape: "box", size: [L, yS, L], pos: [0, 0, xl] },
      { shape: "box", size: [rt, rh, span], pos: [0, yr - c[1], 0] },
    ];
    parts.push({ id: `F${i}`, name: "Leg frame", size: [L, yS, 2 * xl + L], pos: c, material: "wood", pieces });
  }
  for (const [i, sz] of [[0, -1], [1, 1]] as const) parts.push({ id: `R${i}`, name: "Rail", size: [span, rh, rt], pos: [0, yr, sz * xl], material: "wood" });
  parts.push({ id: "S", name: "Seat", size: [W, T, W], pos: [0, H - T / 2, 0], material: "wood" });

  const xIn = xl - rt / 2; // inner faces of the rails
  const railDowels = [0, 1].flatMap((i) =>
    [-1, 1].map((sx) => fix("dowel", [yr - 18, yr + 18].map((y): Vec3 => [sx * (span / 2), y, (i ? 1 : -1) * xl]), [sx, 0, 0], { on: `R${i}` })),
  );
  const bracketsLoose = [0, 1].map((i) => fix("stud", [[0, yS - 12, (i ? 1 : -1) * xIn]], [0, 0, i ? 1 : -1], { on: `R${i}`, len: 20, dia: 20, name: "Seat bracket" }));
  const bracketsFrame = [0, 1].map((i) => fix("stud", [-60, 60].map((z): Vec3 => [(i ? 1 : -1) * xIn, yS - 12, z]), [i ? 1 : -1, 0, 0], { on: `F${i}`, len: 20, dia: 20, name: "Seat bracket" }));
  const bolts = [-1, 1].flatMap((sx) => [0, 1].map((i) => fix("bolt", [[sx * (xl + L / 2), yr, (i ? 1 : -1) * xl]], [-sx, 0, 0], { on: sx < 0 ? "F0" : "F1", mate: `R${i}`, len: 70, dia: 6 })));
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, yS, sz * xl]));
  const screws: Vec3[] = [
    [0, yS, -xIn + 14],
    [0, yS, xIn - 14],
    ...[-1, 1].flatMap((sx) => [-60, 60].map((z): Vec3 => [sx * (xIn - 14), yS, z])),
  ];
  return {
    parts,
    steps: [
      {
        title: "Tap the dowels into the loose rails",
        detail: "Lay the two loose rails on a rug. Two dowels go into each end, eight in all.",
        fix: railDowels,
        wait: ["R0", "R1"],
        tools: ["hammer"],
        warnings: ["floor"],
      },
      {
        title: "Screw a seat bracket into each loose rail",
        detail: "Into the hole on the inside face, near the top edge, by hand until it sits tight.",
        fix: bracketsLoose,
      },
      {
        title: "Screw two seat brackets into each leg frame",
        detail: "Into the holes on the inside of the frame's rail, by hand.",
        fix: bracketsFrame,
        wait: ["F0", "F1"],
      },
      {
        title: "Bolt the rails between the leg frames",
        detail: "Upside down on the rug. Push the rails' dowels into the legs, then a long bolt through each leg into a rail. Tighten them with the Allen key.",
        add: ["F0", "F1", "R0", "R1"],
        fix: bolts,
        tools: ["allen"],
        pose: "-y",
        check: "square",
      },
      {
        title: "Tap a dowel into the top of each leg",
        detail: "Turn the frame the right way up first.",
        fix: [0, 1].map((i) => fix("dowel", corners.filter((c) => (c[0] > 0) === (i === 1)), [0, -1, 0], { on: `F${i}`, mate: "S" })),
        tools: ["hammer"],
        pose: "+y",
      },
      {
        title: "Lower the frame onto the seat",
        detail: "Lay the seat upside down on the rug and turn the frame over onto it, so the dowels find their holes.",
        add: ["S"],
        from: { S: [0, 300, 0] },
        pose: "-y",
      },
      {
        title: "Screw the brackets to the seat",
        detail: "Six screws, one through each bracket into the seat.",
        fix: [fix("screw", screws, [0, 1, 0], { len: 16, dia: 4, mate: "S" })],
        tools: ["screwdriver"],
      },
      { title: "Stand it up", detail: "It stacks on another HÄGERNÄS stool.", pose: "+y" },
    ],
  };
}

/*
 * HÄGERNÄS chair, read from its manual. Two side frames (back leg, front leg, seat rail and low stretcher, glued at
 * the factory) and four cross pieces: the top back rail, the middle back slat and the front and back seat rails.
 * Seat brackets screw into the seat rails by hand, sixteen dowels go into the ends of the cross pieces, which stand
 * in one side frame lying on the rug; the other frame goes on top and three long bolts go through each frame.
 * Upside down on a table the middle stretcher drops in between the low stretchers on two more bolts, then the frame
 * is lowered onto the seat and the four brackets are screwed to it.
 * IKEA's sizes: seat 40 x 41 cm, 45 high, the chair 87 high.
 */
function chairRecipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 460, D = Math.round(s.size.d * 10) || 530, H = Math.round(s.size.h * 10) || 870;
  const L = 38, rt = 20, rh = 70, T = 20;
  const seatW = W - 30, frameW = seatW - 30;
  const xl = frameW / 2 - L / 2; // side frame centres
  const inner = frameW - 2 * L; // between the frames
  const yS = 450 - T; // underside of the seat, top of the front legs and seat rails
  const zF = D / 2 - 15 - L / 2; // front legs, the seat overhangs them a little
  const zB = -D / 2 + 110; // back legs at the seat
  const zFoot = -D / 2 + L / 2; // back legs splay back to the floor
  const lean = 40; // the back leans back a little above the seat
  const thLo = Math.atan2(zB - zFoot, yS), lenLo = Math.hypot(zB - zFoot, yS);
  const thUp = Math.atan2(lean, H - yS), lenUp = Math.hypot(lean, H - yS);
  const zAt = (y: number) => (y <= yS ? zFoot + ((zB - zFoot) * y) / yS : zB - (lean * (y - yS)) / (H - yS));
  const yR = yS - rh / 2, yLow = 150;
  const fc: Vec3 = [0, H / 2, 0];
  const rel = (p: PartPiece): PartPiece => ({ ...p, pos: [p.pos[0] - fc[0], p.pos[1] - fc[1], p.pos[2] - fc[2]] });
  const frame: PartPiece[] = [
    { shape: "box", size: [L, lenLo, L], pos: [0, yS / 2, (zFoot + zB) / 2], rot: [thLo, 0, 0] },
    { shape: "box", size: [L, lenUp, L], pos: [0, (yS + H) / 2, zB - lean / 2], rot: [-thUp, 0, 0] },
    { shape: "box", size: [L, yS, L], pos: [0, yS / 2, zF] },
    { shape: "box", size: [rt, rh, zF - zB - L], pos: [0, yR, (zF + zB) / 2] },
    { shape: "box", size: [rt, 40, zF - zAt(yLow) - L], pos: [0, yLow, (zF + zAt(yLow)) / 2] },
  ].map((p) => rel(p as PartPiece));
  const yTR = H - 70, yMS = 640;
  const zFR = zF - L / 2 + rt / 2 + 4, zBR = zB;
  const zMX = (zF + zAt(yLow)) / 2;
  const parts: CustomPart[] = [
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `F${i}`, name: "Side frame", size: [L, H, D], pos: [sx * xl, fc[1], fc[2]], pieces: frame, material: "wood" })),
    { id: "TR", name: "Top back rail", size: [inner, 100, 22], pos: [0, yTR, zAt(yTR)], rot: [-thUp, 0, 0], material: "wood" },
    { id: "MS", name: "Back slat", size: [inner, 70, 20], pos: [0, yMS, zAt(yMS)], rot: [-thUp, 0, 0], material: "wood" },
    { id: "BR", name: "Back seat rail", size: [inner, rh, rt], pos: [0, yR, zBR], material: "wood" },
    { id: "FR", name: "Front seat rail", size: [inner, rh, rt], pos: [0, yR, zFR], material: "wood" },
    { id: "MX", name: "Middle stretcher", size: [frameW - rt, 40, rt], pos: [0, yLow, zMX], material: "wood" },
    { id: "S", name: "Seat", size: [seatW, T, D / 2 - (zB + L / 2)], pos: [0, yS + T / 2, (D / 2 + zB + L / 2) / 2], material: "wood" },
  ];
  const bx = [-90, 90];
  const brackets = [
    fix("stud", bx.map((x): Vec3 => [x, yS - 12, zFR - rt / 2]), [0, 0, 1], { on: "FR", len: 20, dia: 20, name: "Seat bracket" }),
    fix("stud", bx.map((x): Vec3 => [x, yS - 12, zBR + rt / 2]), [0, 0, -1], { on: "BR", len: 20, dia: 20, name: "Seat bracket" }),
  ];
  const ends: [string, number, number][] = [["TR", yTR, 30], ["MS", yMS, 18], ["BR", yR, 20], ["FR", yR, 20]];
  const dowels = ends.flatMap(([id, y, k]) =>
    [-1, 1].map((sx) => fix("dowel", [-k, k].map((dy): Vec3 => [sx * (inner / 2), y + dy, zAt(y + dy) + (id === "FR" ? zFR - zAt(y) : id === "BR" ? zBR - zAt(y) : 0)]), [-sx, 0, 0], { on: id })),
  );
  const side = (sx: number, i: number) =>
    fix("bolt", ([[yTR, zAt(yTR)], [yR, zBR], [yR, zFR]] as const).map(([y, z]): Vec3 => [sx * (frameW / 2), y, z]), [-sx, 0, 0], { on: `F${i}`, len: 70, dia: 6 });
  const screws: Vec3[] = [
    ...bx.map((x): Vec3 => [x, yS, zFR - rt / 2 - 14]),
    ...bx.map((x): Vec3 => [x, yS, zBR + rt / 2 + 14]),
  ];
  return {
    parts,
    steps: [
      {
        title: "Screw the seat brackets into the seat rails",
        detail: "Lay the two seat rails on a rug. Two brackets in each, turned in by hand until they sit tight.",
        fix: brackets,
        wait: ["FR", "BR"],
        warnings: ["floor"],
      },
      {
        title: "Stand the back and seat rails in one side frame",
        detail: "Lay a side frame on the rug, holes up. Two dowels in each end of the four rails, then push them into the frame, the brackets facing in.",
        add: ["F0", "TR", "MS", "BR", "FR"],
        fix: dowels,
        from: { TR: [300, 0, 0], MS: [300, 0, 0], BR: [300, 0, 0], FR: [300, 0, 0] },
        pose: "+x",
        tools: ["hammer"],
      },
      {
        title: "Lay the other side frame on and bolt it",
        detail: "Onto the dowels. Three long bolts through the frame into the rails, tightened with the Allen key.",
        add: ["F1"],
        fix: [side(1, 1)],
        from: { F1: [320, 0, 0] },
        tools: ["allen"],
      },
      {
        title: "Turn the chair over and bolt the first side",
        detail: "Three more long bolts, the same way.",
        fix: [side(-1, 0)],
        pose: "-x",
        tools: ["allen"],
      },
      {
        title: "Bolt in the middle stretcher",
        detail: "Turn the chair upside down on a table with a cloth on it. Press the stretcher down between the low side rails and put a long bolt in from each side.",
        add: ["MX"],
        fix: [-1, 1].map((sx, i) => fix("bolt", [[sx * (xl + rt / 2), yLow, zMX]], [-sx, 0, 0], { on: `F${i}`, mate: "MX", len: 70, dia: 6 })),
        from: { MX: [0, -250, 0] },
        pose: "-y",
        tools: ["allen"],
      },
      {
        title: "Lower the frame onto the seat",
        detail: "Lay the seat face down on the cloth and turn the frame onto it. Check it overhangs the same on both sides.",
        add: ["S"],
        from: { S: [0, 250, 0] },
      },
      {
        title: "Screw the brackets to the seat",
        detail: "One screw through each of the four brackets into the seat.",
        fix: [fix("screw", screws, [0, 1, 0], { len: 16, dia: 4, mate: "S" })],
        tools: ["screwdriver"],
      },
      { title: "Stand it up", detail: "Tighten the bolts again after a couple of weeks.", pose: "+y" },
    ],
  };
}

const family: Family = {
  names: ["HÄGERNÄS", "HAGERNAS"],
  recipe(s) {
    const t = `${s.slug ?? ""} ${s.variant}`;
    if (/stool/i.test(t)) return recipe(s);
    if (/chair/i.test(t)) return chairRecipe(s);
    return null;
  },
};
export default family;
