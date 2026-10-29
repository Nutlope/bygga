import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * KRITTER (children's furniture), read from its three manuals.
 * Chair: two dowels in the top rail, the backrest splat slides into its slot and pegs onto the seat. Lying on its
 * side, the seat goes onto one ready-made side frame, the other frame on top, three screws through each side.
 * Table: a bracket on each of the four rails, the rails screwed into a frame, the frame screwed to the top lying
 * upside down. A cross dowel and a threaded rod go into each leg, a wedge into each bracket, then each leg is held
 * in its corner with a washer and nut.
 * Bed: the slat supports are screwed to the side rails, glides go into the legs, the rails are bolted into cross
 * dowels at the foot and then the head, four slat stops are screwed on, two wires brace the frame underneath and
 * the slatted base is rolled out. The guard rail's fittings come in the box but its steps aren't in the manual.
 */

const PI = Math.PI;

function chair(): CustomParams {
  const FX = 120; // side frames, middle of the legs
  const IN = 105; // inside faces of the frames
  const frame: PartPiece[] = [
    { shape: "box", size: [30, 530, 30], pos: [0, 0, -130] },
    { shape: "box", size: [30, 300, 30], pos: [0, -115, 130] },
    { shape: "box", size: [20, 50, 230], pos: [0, -10, 0] },
    { shape: "cyl", size: [18, 230, 18], pos: [0, -155, 0], rot: [PI / 2, 0, 0] },
  ];
  const seat: PartPiece[] = [
    { shape: "box", size: [2 * IN, 18, 282], pos: [0, 26, 0] },
    { shape: "box", size: [2 * IN, 50, 18], pos: [0, -10, 132] },
    { shape: "box", size: [2 * IN, 50, 18], pos: [0, -10, -132] },
  ];
  const parts: CustomPart[] = [
    { id: "T", name: "Top rail", size: [2 * IN, 60, 22], pos: [0, 495, -130], material: "wood" },
    { id: "P", name: "Backrest", size: [90, 165, 14], pos: [0, 382.5, -130], material: "board" },
    { id: "S", name: "Seat", size: [2 * IN, 70, 282], pos: [0, 265, 4], material: "wood", pieces: seat },
    { id: "L", name: "Side frame", size: [30, 530, 290], pos: [-FX, 265, 0], material: "wood", pieces: frame },
    { id: "R", name: "Side frame", size: [30, 530, 290], pos: [FX, 265, 0], material: "wood", pieces: frame },
  ];
  // one dowel out of each end of the top rail, going in towards the middle
  const dowels = [-1, 1].map((sx): CustomFix => ({ kind: "dowel", count: 1, len: 30, dia: 8, at: [[sx * IN, 495, -130]], dir: [-sx, 0, 0], on: "T" }));
  const screws = (sx: number): CustomFix => ({
    kind: "screw",
    name: "Allen screw",
    count: 3,
    len: 50,
    dia: 6,
    at: ([[495, -130], [255, -130], [255, 130]] as const).map(([y, z]): Vec3 => [sx * 135, y, z]),
    dir: [-sx, 0, 0],
    on: sx < 0 ? "L" : "R",
  });
  const steps: CustomStep[] = [
    { title: "Tap two dowels into the top rail", detail: "One into each end, halfway in.", fix: dowels, tools: ["hammer"] },
    { title: "Slide the backrest into the top rail", detail: "Its plain edge goes into the slot under the rail, the pegs point down.", add: ["P"], from: { P: [0, -200, 0] } },
    {
      title: "Push the backrest onto the seat",
      detail: "Lay the seat on its side on a rug and press the backrest's pegs into the holes at its back edge.",
      add: ["S"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Set it onto a side frame", detail: "Lay one side frame flat, holes up, and lower the seat and top rail into its holes.", add: ["L"], from: { L: [-260, 0, 0] } },
    { title: "Lay the other side frame on top", detail: "Line up every hole and dowel before you press it down.", add: ["R"] },
    { title: "Screw this side on", detail: "Three screws through the frame: the top rail, the back and the front of the seat.", fix: [screws(1)], tools: ["allen"] },
    { title: "Turn it over and screw the other side", detail: "Three more screws, the same way.", fix: [screws(-1)], tools: ["allen"], pose: "-x" },
    { title: "Stand it up", detail: "Check every screw is tight.", pose: "+y" },
  ];
  return { parts, steps };
}

function table(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const LT = 40, TT = 20, AH = 60, AT = 18, OV = 15;
  const lx = W / 2 - OV - LT / 2, lz = D / 2 - OV - LT / 2; // legs, middle
  const ix = lx - LT / 2, iz = lz - LT / 2; // legs' inner faces
  const ya = H - TT - AH / 2;
  const parts: CustomPart[] = [
    { id: "AF", name: "Long rail", size: [2 * ix, AH, AT], pos: [0, ya, lz + LT / 2 - AT / 2], material: "wood" },
    { id: "AB", name: "Long rail", size: [2 * ix, AH, AT], pos: [0, ya, -(lz + LT / 2 - AT / 2)], material: "wood" },
    { id: "AL", name: "Short rail", size: [AT, AH, 2 * iz], pos: [-(lx + LT / 2 - AT / 2), ya, 0], material: "wood" },
    { id: "AR", name: "Short rail", size: [AT, AH, 2 * iz], pos: [lx + LT / 2 - AT / 2, ya, 0], material: "wood" },
    { id: "T", name: "Table top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "board" },
  ];
  const corners = [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ] as const;
  const legId = (sx: number, sz: number) => `L${sx}${sz}`;
  for (const [sx, sz] of corners) parts.push({ id: legId(sx, sz), name: "Leg", size: [LT, H - TT, LT], pos: [sx * lx, (H - TT) / 2, sz * lz], material: "wood" });
  // a bracket on one end of each rail, going round: front rail at the right, right rail at the back, and so on
  const own = ["AF", "AR", "AB", "AL"];
  const other = ["AR", "AB", "AL", "AF"];
  const bx = ix - 14, bz = iz - 14;
  const brackets: Vec3[] = corners.map(([sx, sz]) => [sx * bx, ya, sz * bz]);
  const longFace = lz + LT / 2 - AT; // inner face of a long rail
  const shortFace = lx + LT / 2 - AT;
  const screwInto = (id: string, sx: number, sz: number): Vec3 => (id === "AF" || id === "AB" ? [sx * (ix - 28), ya, sz * longFace] : [sx * shortFace, ya, sz * (iz - 28)]);
  const dirInto = (id: string, sx: number, sz: number): Vec3 => (id === "AF" || id === "AB" ? [0, 0, sz] : [sx, 0, 0]);
  const SHORT = { kind: "screw" as const, len: 12, dia: 4 };
  const r2 = Math.SQRT1_2;
  const steps: CustomStep[] = [
    {
      title: "Screw a bracket onto each rail",
      detail: "One bracket at one end of each of the four rails, one short screw in each.",
      add: ["AF", "AR", "AB", "AL"],
      fix: [
        { kind: "angle", name: "Corner bracket", count: 4, len: 70, dia: 40, at: brackets, dir: [0, 1, 0] },
        ...corners.map(([sx, sz], i): CustomFix => ({ ...SHORT, count: 1, at: [screwInto(own[i], sx, sz)], dir: dirInto(own[i], sx, sz), on: own[i] })),
      ],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw the rails into a frame",
      detail: "The free end of each rail goes into the next bracket, one short screw each. The rails' grooves all face the same way.",
      fix: corners.map(([sx, sz], i): CustomFix => ({ ...SHORT, count: 1, at: [screwInto(other[i], sx, sz)], dir: dirInto(other[i], sx, sz), on: other[i] })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the frame to the top",
      detail: "Lay the top face down on the flattened box and centre the frame on it. Two long screws through each rail.",
      add: ["T"],
      from: { T: [0, 0, 500] },
      fix: [
        {
          kind: "screw",
          count: 8,
          len: 30,
          dia: 4,
          at: [
            // from the bottom of a deep counterbore, so the tip bites into the top
            ...[-1, 1].flatMap((sz) => [-1, 1].map((d): Vec3 => [d * ix * 0.5, H - TT - 26, sz * (lz + LT / 2 - AT / 2)])),
            ...[-1, 1].flatMap((sx) => [-1, 1].map((d): Vec3 => [sx * (lx + LT / 2 - AT / 2), H - TT - 26, d * iz * 0.5])),
          ],
          dir: [0, 1, 0],
        },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the bolts into the legs",
      detail: "Push a cross dowel into the hole in the top of each leg, slot up. Screw the threaded rod into the corner hole until it catches the dowel, turning the slot with a flat screwdriver to line it up.",
      fix: [
        ...corners.map(([sx, sz]): CustomFix => ({ kind: "legScrew", name: "Threaded rod", count: 1, len: 70, dia: 8, at: [[sx * ix, ya, sz * iz]], dir: [sx * r2, 0, sz * r2], on: legId(sx, sz) })),
        ...corners.map(([sx, sz]): CustomFix => ({ kind: "nut", name: "Cross dowel", count: 1, len: 20, dia: 10, at: [[sx * lx, H - TT - 30, sz * lz]], dir: [0, -1, 0], on: legId(sx, sz) })),
      ],
      tools: ["flathead"],
      wait: corners.map(([sx, sz]) => legId(sx, sz)),
    },
    {
      title: "Push a wedge into each bracket",
      detail: "Into the slot in the corner of the bracket, with its hole lined up.",
      fix: [{ kind: "spacer", name: "Wedge", count: 4, len: 20, dia: 30, at: corners.map(([sx, sz]): Vec3 => [sx * (bx + 4), ya, sz * (bz + 4)]), dir: [0, 1, 0] }],
    },
    {
      title: "Bolt the legs into the corners",
      detail: "Each threaded rod goes through its bracket. A washer and a nut on each, then tighten with a spanner until the leg sits firm.",
      add: corners.map(([sx, sz]) => legId(sx, sz)),
      // the washers and nuts go onto rods pointing out of each corner
      fix: corners.flatMap(([sx, sz]): CustomFix[] => [
        { kind: "washer", count: 1, len: 1.5, dia: 18, at: [[sx * (bx - 6), ya, sz * (bz - 6)]], dir: [sx * r2, 0, sz * r2] },
        { kind: "nut", count: 1, len: 7, dia: 8, at: [[sx * (bx - 10), ya, sz * (bz - 10)]], dir: [sx * r2, 0, sz * r2] },
      ]),
      tools: ["wrench"],
    },
    { title: "Turn it over", detail: "Lift it by the top, not by the legs.", pose: "+y" },
  ];
  return { parts, steps };
}

function slatRoll(w: number, len: number): PartPiece[] {
  const n = 13;
  const pitch = (len - 70) / (n - 1);
  return [
    ...Array.from({ length: n }, (_, i): PartPiece => ({ shape: "box", size: [w, 9, 70], pos: [0, 2, -len / 2 + 35 + i * pitch] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [24, 4, len], pos: [sx * (w / 2 - 110), -4, 0], material: "fiber" })),
  ];
}

function bed(): CustomParams {
  const W = 750, L = 1650, HH = 680, FH = 480;
  const LG = 45; // legs
  const xl = W / 2 - LG / 2, zh = -L / 2 + LG / 2, zf = L / 2 - LG / 2;
  const ri = W / 2 - LG / 2 - 11; // side rails, middle
  const z0 = zh + LG / 2, z1 = zf - LG / 2;
  const rIn = ri - 11; // inside face of the side rails
  const yr0 = 220, yr1 = 350;
  const ySup = 275; // top of the slat support's flange
  const endPieces = (h: number, panelY: number, panelH: number, low: number): PartPiece[] => {
    const span = W - 2 * LG;
    return [
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [LG, h, LG], pos: [sx * xl, 0, 0] })),
      { shape: "box", size: [span, 60, 24], pos: [0, h / 2 - 50, 0] },
      { shape: "box", size: [span, panelH, 12], pos: [0, panelY - h / 2, 0], material: "board" },
      { shape: "box", size: [span, 40, 24], pos: [0, panelY - panelH / 2 - 20 - h / 2, 0] },
      { shape: "box", size: [span, 100, 24], pos: [0, low - h / 2, 0] },
    ];
  };
  const parts: CustomPart[] = [
    { id: "SR-1", name: "Side rail", size: [22, yr1 - yr0, z1 - z0], pos: [-ri, (yr0 + yr1) / 2, 0], material: "wood" },
    { id: "SR1", name: "Side rail", size: [22, yr1 - yr0, z1 - z0], pos: [ri, (yr0 + yr1) / 2, 0], material: "wood" },
  ];
  const sup = (sx: number): CustomPart => ({
    id: `SP${sx}`,
    name: "Slat support",
    size: [22, 25, z1 - z0 - 20],
    pos: [sx * (rIn - 11), ySup - 12.5, 0],
    material: "metal",
    pieces: [
      { shape: "box", size: [2, 25, z1 - z0 - 20], pos: [sx * 10, 0, 0] },
      { shape: "box", size: [22, 2, z1 - z0 - 20], pos: [0, 11.5, 0] },
    ],
  });
  parts.push(sup(-1), sup(1));
  parts.push({ id: "F", name: "Footboard", size: [W, FH, LG], pos: [0, FH / 2, zf], material: "wood", pieces: endPieces(FH, FH - 140, 110, 300) });
  parts.push({ id: "H", name: "Headboard", size: [W, HH, LG], pos: [0, HH / 2, zh], material: "wood", pieces: endPieces(HH, HH - 160, 160, 300) });
  // two wires in a V under the slats: both meet in the middle of the left rail
  const wz = z1 - 120;
  const wl = Math.hypot(2 * (rIn - 20), wz);
  const ang = Math.atan2(2 * (rIn - 20), wz);
  for (const sz of [-1, 1])
    parts.push({ id: `W${sz}`, name: "Brace wire", size: [4, 4, wl], pos: [0, ySup - 30, (sz * wz) / 2], rot: [0, sz * ang, 0], material: "metal" });
  parts.push({ id: "SL", name: "Slatted bed base", size: [2 * rIn - 6, 14, z1 - z0 - 30], pos: [0, ySup + 7, 0], material: "wood", pieces: slatRoll(2 * rIn - 6, z1 - z0 - 30) });

  const supScrews = (sx: number): CustomFix => ({
    kind: "screw",
    count: 11,
    len: 16,
    dia: 4,
    at: Array.from({ length: 11 }, (_, i): Vec3 => [sx * (rIn - 1), ySup - 12, z0 + 60 + ((z1 - z0 - 120) * i) / 10]),
    dir: [sx, 0, 0],
    on: `SP${sx}`,
    mate: `SR${sx}`,
  });
  const glides: CustomFix = { kind: "glide", name: "Glide", count: 4, len: 10, dia: 30, at: [zh, zf].flatMap((z) => [-1, 1].map((sx): Vec3 => [sx * xl, 0, z])), dir: [0, 1, 0] };
  const bolts = (sz: number): CustomFix[] => [
    ...[-1, 1].map((sx): CustomFix => ({ kind: "nut", name: "Cross dowel", count: 1, len: 20, dia: 10, at: [[sx * rIn, 300, sz * (z1 - 60)]], dir: [sx, 0, 0], on: `SR${sx}` })),
    { kind: "bolt", count: 2, len: 90, dia: 6, at: [-1, 1].map((sx): Vec3 => [sx * ri, 300, (sz * L) / 2]), dir: [0, 0, -sz], on: sz < 0 ? "H" : "F" },
  ];
  const stops: Vec3[] = [-1, 1].flatMap((sx) => [z0 + 30, z1 - 30].map((z): Vec3 => [sx * (rIn - 12), ySup, z]));
  const wireAt: Vec3[] = [[-(rIn - 20), ySup - 30, 0], [rIn - 20, ySup - 30, -wz], [rIn - 20, ySup - 30, wz]];
  const steps: CustomStep[] = [
    {
      title: "Screw the slat supports to the side rails",
      detail: "Along the inside of each rail, its flange pointing in. Eleven screws in each.",
      add: ["SR-1", "SR1", "SP-1", "SP1"],
      fix: [supScrews(-1), supScrews(1)],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Push the glides into the legs", detail: "Lay the headboard and footboard down and press a glide into the bottom of each leg.", add: ["F", "H"], fix: [glides] },
    {
      title: "Bolt the side rails to the footboard",
      detail: "Slide the rail ends into the footboard's legs, slat supports facing in. Push a cross dowel into each rail, slot towards the end, then turn a long bolt through the leg into it.",
      fix: bolts(1),
      tools: ["allen", "flathead"],
    },
    {
      title: "Bolt on the headboard",
      detail: "Slide it onto the free rail ends, a cross dowel in each rail and a long bolt through each leg. Then tighten all four.",
      fix: bolts(-1),
      tools: ["allen", "flathead"],
      check: "square",
    },
    {
      title: "Screw on the slat stops",
      detail: "One near each end of the slat supports, a small bolt from underneath.",
      fix: [
        { kind: "clip", name: "Slat stop", count: 4, len: 20, dia: 25, at: stops, dir: [0, -1, 0] },
        { kind: "screw", count: 4, len: 10, dia: 6, at: stops.map((p): Vec3 => [p[0], ySup - 25, p[2]]), dir: [0, 1, 0] },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the brace wires underneath",
      detail: "Both wires join in the middle of one rail and run to the ends of the other. A screw and nut at each point, tightened with a spanner.",
      add: ["W-1", "W1"],
      fix: [
        { kind: "screw", count: 3, len: 12, dia: 5, at: wireAt.map((p): Vec3 => [p[0], ySup, p[2]]), dir: [0, -1, 0] },
        { kind: "nut", count: 3, len: 6, dia: 5, at: wireAt.map((p): Vec3 => [p[0], ySup - 36, p[2]]), dir: [0, 1, 0] },
      ],
      tools: ["screwdriver", "wrench"],
    },
    { title: "Roll out the slats", detail: "Lay the slatted base on the supports, its ends tucked under the slat stops.", add: ["SL"], from: { SL: [0, 300, 0] } },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["KRITTER"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^kritter-children-s-chair/.test(slug)) return chair();
    if (/^kritter-children-s-table/.test(slug)) return table(s);
    if (/^kritter-kids-bed-frame/.test(slug)) return bed();
    return null;
  },
};
export default family;
