import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BRÄNNBOLL. The side table, read from its manual: Built upside down on the steel rim: the two leg frames push onto the
 * rim's four stubs and are locked with grub screws, the castors are bolted into the forked legs, then the board
 * slides in onto the leg frames' crossbars and is screwed up from below and bolted to the rim's brackets.
 */

const fx = (kind: CustomFix["kind"], at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, ...o });
const UP: Vec3 = [0, 1, 0];
const TUBE = 25;

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 69 long, 39 wide, 40 high
  const W = s.size.w * 10 || 690, D = s.size.d * 10 || 390, H = s.size.h * 10 || 400;
  const r = TUBE / 2;
  const ringY = H - r;
  const lx = W / 2 - 60, lz = D / 2 - r; // legs, under the rim's long sides
  const stubLo = H - 80; // where the legs meet the rim's stubs
  const barY = stubLo - 35; // the leg frames' crossbars, under the board
  const bt = 18, by = barY + 10; // board underside
  const bw = W - 60, bd = 2 * lz - TUBE - 6;
  const wheel = 70;

  const ring: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [W - TUBE, TUBE, TUBE], pos: [0, 0, sz * lz] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [TUBE, TUBE, D - TUBE], pos: [sx * (W / 2 - r), 0, 0] })),
    // stubs down at the four corners, the legs push onto them
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [TUBE - 3, ringY - stubLo, TUBE - 3], pos: [sx * lx, -(ringY - stubLo) / 2, sz * lz] }))),
  ];
  const legFrame = (id: string, sx: number, foot: number): CustomPart => {
    const h = stubLo - foot, mid = foot + h / 2;
    return {
      id,
      name: foot ? "Leg frame with castor forks" : "Leg frame",
      size: [TUBE, h, D],
      pos: [sx * lx, mid, 0],
      material: "metal",
      pieces: [
        ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [TUBE, h, TUBE], pos: [0, 0, sz * lz] })),
        { shape: "box", size: [20, 20, 2 * lz], pos: [0, barY - mid, 0] },
      ],
    };
  };
  const parts: CustomPart[] = [
    { id: "R", name: "Rim", size: [W, H - stubLo, D], pos: [0, (H + stubLo) / 2, 0], pieces: ring.map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] + ringY - (H + stubLo) / 2, p.pos[2]] as Vec3 })), material: "metal" },
    legFrame("L", 1, 0),
    legFrame("C", -1, wheel),
    { id: "B", name: "Board", size: [bw, bt, bd], pos: [0, by + bt / 2, 0], material: "board" },
  ];

  return {
    parts,
    steps: [
      {
        title: "Push the plain leg frame onto the rim",
        detail: "Lay the rim upside down on a rug. Check the two square pads sit in their slots in the crossbar, then push the legs onto the stubs.",
        add: ["R", "L"],
        pose: "-y",
        warnings: ["floor"],
      },
      { title: "Push the leg frame with forks on", detail: "The pads go the same way, flat in the crossbar.", add: ["C"] },
      {
        title: "Lock the legs with grub screws",
        detail: "One in the inside of each leg, just below the rim. Turn them in with the small Allen key until they stop.",
        fix: [-1, 1].map((sz) => fx("screw", [-1, 1].map((sx): Vec3 => [sx * lx, stubLo - 12, sz * (lz - r)]), { name: "Grub screw", dir: [0, 0, sz], len: 8, dia: 6 })),
        tools: ["allen"],
      },
      {
        title: "Bolt a castor into each fork",
        detail: "Push the wheel into the fork, put the bolt through and tighten a cap nut on each end with both Allen keys.",
        fix: [
          fx("castor", [-1, 1].map((sz): Vec3 => [-lx, wheel, sz * lz]), { dir: UP, on: "C", len: wheel, dia: wheel }),
          fx("stud", [-1, 1].map((sz): Vec3 => [-lx, wheel / 2, sz * lz]), { name: "Axle bolt", dir: [1, 0, 0], len: 40, dia: 8 }),
          fx("nut", [-1, 1].flatMap((sz): Vec3[] => [[-lx - 18, wheel / 2, sz * lz], [-lx + 18, wheel / 2, sz * lz]]), { name: "Cap nut", dir: [1, 0, 0], len: 10, dia: 12 }),
        ],
        tools: ["allen"],
      },
      {
        title: "Slide the board in",
        detail: "Face down, in between the rim and the crossbars, until its holes line up with the crossbars.",
        add: ["B"],
        from: { B: [W, 0, 0] },
      },
      {
        title: "Screw the crossbars to the board",
        detail: "Two countersunk screws through each crossbar. Leave them a little loose for now.",
        fix: [fx("screw", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * lx, barY - 10, sz * (bd / 2 - 50)])), { dir: UP, on: "B", len: 30, dia: 6 })],
        tools: ["allen"],
      },
      {
        title: "Bolt the board on at the corners",
        detail: "A short bolt through each square washer into the board. Then tighten the four crossbar screws too.",
        fix: [fx("bolt", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (lx - 45), by, sz * (bd / 2 - 30)])), { dir: UP, on: "B", len: 16, dia: 6 })],
        tools: ["allen"],
      },
      { title: "Turn the table over", detail: "Stand it on its feet and castors.", pose: "+y" },
    ],
  };
}


/**
 * The shelving unit on castors, from its own manual (the version with the slatted divider, as in the photo). Lying on
 * its back, the divider's pegs go into the two boards, an end frame is bolted on at each side, then upside down the
 * four castors are screwed into the tube ends and tightened with the spanner. Stood up, plugs close the spare holes.
 */
function shelving(s: ProductSpec): CustomParams {
  const W = s.size.w * 10 || 560, D = s.size.d * 10 || 400, H = s.size.h * 10 || 620;
  const T = 20, r = T / 2;
  const fx0 = W / 2 - r, fz = D / 2 - r; // the end frames' tubes
  const foot = 100; // the castors' height, up to the tube ends
  const bt = 20, bw = 2 * (fx0 - r), bd = D - 20;
  const lowY = foot + 70, topY = H - 70; // the boards' top faces
  const bys = [lowY - bt / 2, topY - bt / 2];
  const fh = H - foot, fm = foot + fh / 2;
  const frame: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [T, fh - T, T], pos: [0, -T / 2, sz * fz] })),
    { shape: "box", size: [T, T, D], pos: [0, fh / 2 - r, 0] }, // the handle over the top
    ...bys.map((y): PartPiece => ({ shape: "box", size: [T, T, 2 * fz], pos: [0, y - fm, 0] })),
    { shape: "box", size: [2, bys[1] - bys[0] - T, 2 * fz - T], pos: [0, (bys[0] + bys[1]) / 2 - fm, 0] }, // pegboard
  ];
  const board = (y: number): PartPiece[] => [
    { shape: "box", size: [bw, bt - 6, bd], pos: [0, -3, 0] },
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [bw, 6, 3], pos: [0, bt / 2 - 3, sz * (bd / 2 - 1.5)] })),
  ];
  const vh = bys[1] - bys[0] - bt, vd = bd - 40;
  const divider: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "box", size: [10, vh, 10], pos: [0, 0, sz * (vd / 2 - 5)] })),
    ...Array.from({ length: 14 }, (_, i): PartPiece => ({ shape: "cyl", size: [5, vd - 20, 5], pos: [0, -vh / 2 + 15 + (i * (vh - 30)) / 13, 0], rot: [Math.PI / 2, 0, 0] })),
  ];
  const parts: CustomPart[] = [
    { id: "B", name: "Board", size: [bw, bt, bd], pos: [0, bys[0], 0], material: "metal", pieces: board(bys[0]) },
    { id: "V", name: "Slatted divider", size: [10, vh, vd], pos: [0, (bys[0] + bys[1]) / 2, 0], material: "metal", pieces: divider },
    { id: "T", name: "Board", size: [bw, bt, bd], pos: [0, bys[1], 0], material: "metal", pieces: board(bys[1]) },
    { id: "E0", name: "End frame", size: [T, fh, D], pos: [-fx0, fm, 0], material: "metal", pieces: frame },
    { id: "E1", name: "End frame", size: [T, fh, D], pos: [fx0, fm, 0], material: "metal", pieces: frame },
  ];
  const bz = fz - 70;
  const bolts = (g: number): CustomFix =>
    fx("bolt", bys.flatMap((y) => [-1, 1].map((sz): Vec3 => [g * (W / 2), y, sz * bz])), { len: 40, dia: 6, dir: [-g, 0, 0], on: g < 0 ? "E0" : "E1" });
  const ends = (g: number): Vec3[] => [-1, 1].map((sz): Vec3 => [g * fx0, foot, sz * fz]);
  return {
    parts,
    steps: [
      {
        title: "Fit the divider between the boards",
        detail: "Lay it all on its back on a rug. The divider's four pegs push into the holes in the two boards.",
        add: ["B", "V", "T"],
        pose: "+z",
        warnings: ["floor"],
      },
      { title: "Bolt on one end frame", detail: "Two bolts into each board. Check the bolt heads sit flush in their recesses.", add: ["E0"], fix: [bolts(-1)], tools: ["allen"] },
      { title: "Bolt on the other end frame", detail: "Four more bolts the same way, then tighten all eight.", add: ["E1"], fix: [bolts(1)], tools: ["allen"] },
      {
        title: "Screw in the castors",
        detail: "Turn the unit upside down. The two with brakes go at one end. Screw each one into a tube end by hand.",
        fix: [
          fx("castor", ends(1), { name: "Castor with brake", dir: UP, len: foot, dia: 75, on: "E1" }),
          fx("castor", ends(-1), { dir: UP, len: foot, dia: 75, on: "E0" }),
        ],
        pose: "-y",
      },
      { title: "Tighten the castors", detail: "Hold each one and tighten its nut with the spanner.", tools: ["wrench"] },
      {
        title: "Plug the spare holes",
        detail: "Stand it on its castors and push a plastic plug into each of the four empty holes in the end frames.",
        fix: [-1, 1].map((g) => fx("cap", [-1, 1].map((sz): Vec3 => [g * (fx0 - 1), (bys[0] + bys[1]) / 2, sz * bz]), { name: "Plastic plug", dir: [-g, 0, 0], on: g < 0 ? "E0" : "E1" })),
        pose: "+y",
      },
    ],
  };
}

const family: Family = { names: ["BRÄNNBOLL"], recipe: (s) => (/shelving-unit/.test(s.slug ?? "") ? shelving(s) : recipe(s)) };
export default family;
