import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * TAXÅSKLINT, read from the bed frame's manual. The headboard panel goes between its two posts on dowels and three
 * long bolts a side, and a bracket for the centre beam is screwed to it and to the footboard (which comes in one
 * piece). Dowels go into the side rails' head ends and four steel straps are screwed to them, then the rails are
 * bolted to the footboard, the headboard is bolted on, the centre beam drops into its brackets and the straps are
 * screwed to it, square. Two wooden wedges lock the rails' ends through the foot posts, slat holders and grip strips
 * go on, and the two slat rolls are unrolled.
 */

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 143 wide, 200 long, headboard 76 high, footboard 39; mattress 135 x 190
  const mw = 1350, ml = 1900;
  const W = mw + 80, Lb = ml + 100, Hh = 760, Hf = 390;
  const post = 55, t = 22, railH = 150;
  const xP = W / 2 - post / 2, xIn = mw / 2, xR = xIn + t / 2;
  const zHead = -Lb / 2, zHP = zHead + post / 2, zHin = zHead + post; // head posts, their inner face
  const zFoot = Lb / 2 - 15, zFP = zFoot - post / 2; // foot posts (the rails' ends stick out 15 past them)
  const yLo = 230, yHi = yLo + railH, yR = (yLo + yHi) / 2;
  const zPanel = zHP, zPanelIn = zPanel + t / 2, zFrail = zFP, zFrailIn = zFrail - t / 2;
  const ySlat = 325, beamH = 70, yBeam = ySlat - beamH / 2;
  const beamL = zFrailIn - zPanelIn, zBeam = (zFrailIn + zPanelIn) / 2;

  const footboard: PartPiece[] = [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [post, Hf, post], pos: [sx * xP, 0, 0] })),
    { shape: "box", size: [2 * (xP - post / 2), railH, t], pos: [0, yR - Hf / 2, 0] },
  ];
  // a side rail with the ledge along its inside that the slats and the straps sit on
  const railPieces = (sx: number): PartPiece[] => [
    { shape: "box", size: [t, railH, Lb / 2 - zHin], pos: [0, 0, 0] },
    { shape: "box", size: [30, 25, Lb / 2 - zHin], pos: [-sx * (t / 2 + 15), ySlat - 12.5 - yR, 0] },
  ];
  const strapEnd = (sx: number, sz: number): Vec3 => [sx * 15, ySlat - 2, sz * 700];
  const strap = (id: string, sx: number, sz: number): CustomPart => {
    const a: Vec3 = [sx * xIn, ySlat - 2, 0], b = strapEnd(sx, sz);
    const dx = b[0] - a[0], dz = b[2] - a[2];
    return { id, name: "Steel strap", size: [Math.hypot(dx, dz), 3, 25], pos: [(a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2], rot: [0, Math.atan2(-dz, dx), 0], material: "metal" };
  };
  const nSlats = 17, pitch = ml / nSlats;
  const slatRoll = (id: string, sx: number): CustomPart => ({
    id,
    name: "Slat roll",
    size: [xIn - 25, 8, ml],
    pos: [(sx * (xIn + 25)) / 2, ySlat + 4, zBeam],
    pieces: Array.from({ length: nSlats }, (_, i): PartPiece => ({ shape: "box", size: [xIn - 25, 8, 63], pos: [0, 0, -ml / 2 + pitch / 2 + i * pitch] })),
    material: "wood",
  });
  const parts: CustomPart[] = [
    { id: "HB", name: "Headboard panel", size: [2 * (xP - post / 2), Hh - 20 - yLo, t], pos: [0, (yLo + Hh - 20) / 2, zPanel], material: "wood" },
    { id: "P1", name: "Headboard post", size: [post, Hh, post], pos: [-xP, Hh / 2, zHP], material: "wood" },
    { id: "P2", name: "Headboard post", size: [post, Hh, post], pos: [xP, Hh / 2, zHP], material: "wood" },
    { id: "FB", name: "Footboard", size: [W, Hf, post], pos: [0, Hf / 2, zFP], pieces: footboard, material: "wood" },
    { id: "S1", name: "Side rail", size: [t, railH, Lb / 2 - zHin], pos: [-xR, yR, (zHin + Lb / 2) / 2], material: "wood", pieces: railPieces(-1) },
    strap("T1", -1, -1),
    strap("T2", -1, 1),
    { id: "S2", name: "Side rail", size: [t, railH, Lb / 2 - zHin], pos: [xR, yR, (zHin + Lb / 2) / 2], material: "wood", pieces: railPieces(1) },
    strap("T3", 1, -1),
    strap("T4", 1, 1),
    { id: "CB", name: "Centre beam", size: [50, beamH, beamL], pos: [0, yBeam, zBeam], material: "wood" },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `W${i + 1}`, name: "Wedge", size: [30, 90, 12], pos: [sx * xR, yR + 10, zFoot + 8], material: "wood" })),
    slatRoll("R1", -1),
    slatRoll("R2", 1),
    { id: "M", name: "Your mattress", size: [mw, 180, ml], pos: [0, ySlat + 8 + 90, zBeam], material: "soft", extra: true },
  ];

  const ys = [350, 500, 650];
  const barrel = { kind: "nut" as const, name: "Barrel nut", len: 14, dia: 10 };
  const side = (sx: number) => (sx < 0 ? "S1" : "S2");
  const steps = [
    {
      title: "Push the headboard posts onto the panel",
      detail: "Lay the panel and posts flat on a rug. Tap three dowels into each end of the panel and push a post onto each end.",
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "dowel", count: 3, at: ys.map((y): Vec3 => [sx * (xP - post / 2), y, zPanel]), dir: [sx, 0, 0], on: "HB", mate: sx < 0 ? "P1" : "P2" })),
      wait: ["HB", "P1", "P2"],
      from: { HB: [0, 0, -500], P1: [0, 0, -500], P2: [0, 0, -500] },
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Bolt the posts to the panel",
      detail: "Drop the barrel nuts into the panel's holes, slots facing the bolts, then turn three long bolts through each post into them.",
      fix: [
        { ...barrel, count: 6, at: [-1, 1].flatMap((sx) => ys.map((y): Vec3 => [sx * (xP - post / 2 - 40), y, zPanelIn])), dir: [0, 0, -1], on: "HB" },
        ...[-1, 1].map((sx): CustomFix => ({ kind: "bolt", name: "Long bolt", count: 3, len: 110, dia: 6, at: ys.map((y): Vec3 => [sx * (W / 2), y, zPanel]), dir: [-sx, 0, 0], on: sx < 0 ? "P1" : "P2", mate: "HB" })),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw a beam bracket to the headboard",
      detail: "Turn the headboard over. The bracket goes in the middle of the panel's inside face, at the bottom edge.",
      fix: [
        { kind: "angle", name: "Beam bracket", count: 1, at: [[0, yBeam, zPanelIn]], dir: [0, 0, -1], on: "HB" },
        { kind: "screw", count: 2, len: 12, dia: 6, at: [-30, 30].map((x): Vec3 => [x, yBeam + 20, zPanelIn]), dir: [0, 0, -1], on: "HB" },
      ],
    },
    {
      title: "Screw the other bracket to the footboard",
      detail: "Same place on the footboard: in the middle of its inside face, two screws.",
      fix: [
        { kind: "angle", name: "Beam bracket", count: 1, at: [[0, yBeam, zFrailIn]], dir: [0, 0, 1], on: "FB" },
        { kind: "screw", count: 2, len: 12, dia: 6, at: [-30, 30].map((x): Vec3 => [x, yBeam + 20, zFrailIn]), dir: [0, 0, 1], on: "FB" },
      ],
      wait: ["FB"],
      from: { FB: [0, 0, 500] },
    },
    {
      title: "Tap dowels into the side rails",
      detail: "Two in the head end of each rail: the end without the slot.",
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "dowel", count: 2, at: [yLo + 25, yHi - 25].map((y): Vec3 => [sx * xR, y, zHin]), dir: [0, 0, -1], on: side(sx), mate: sx < 0 ? "P1" : "P2" })),
      wait: ["S1", "S2"],
      from: { S1: [-500, 0, 0], S2: [500, 0, 0] },
      tools: ["hammer"],
    },
    {
      title: "Screw the steel straps to the side rails",
      detail: "Two straps on each rail, one screw at the middle of the rail's inside ledge. Let their other ends hang loose.",
      fix: [-1, 1].flatMap((sx) => [-1, 1].map((sz): CustomFix => ({ kind: "screw", count: 1, len: 16, dia: 4, at: [[sx * (xIn - 15), ySlat, sz * 20]], dir: [0, -1, 0], on: side(sx) }))),
      wait: ["T1", "T2", "T3", "T4"],
      from: { T1: [-500, 0, 0], T2: [-500, 0, 0], T3: [500, 0, 0], T4: [500, 0, 0] },
    },
    ...[-1, 1].map((sx) => ({
      title: sx < 0 ? "Bolt a side rail to the footboard" : "Bolt the other side rail on",
      detail:
        sx < 0
          ? "Push the rail's slotted end through the foot post. Drop two barrel nuts into the footboard and turn two bolts in with the Allen key."
          : "The same at the other foot post: two barrel nuts and two bolts.",
      add: sx < 0 ? ["FB", "S1", "T1", "T2"] : ["S2", "T3", "T4"],
      fix: [
        { ...barrel, count: 2, at: [yR - 20, yR + 20].map((y): Vec3 => [sx * (xIn - 40), y, zFrailIn]), dir: [0, 0, 1] as Vec3, on: "FB" },
        { kind: "bolt" as const, name: "Bolt", count: 2, len: 90, dia: 6, at: [yR - 20, yR + 20].map((y): Vec3 => [sx * (xR + t / 2), y, zFrail]), dir: [-sx, 0, 0] as Vec3, on: side(sx), mate: "FB" },
      ],
      people: 2 as const,
    })),
    {
      title: "Bolt the headboard to the rails",
      detail: "Push the rails' dowels into the posts. Drop two barrel nuts into each rail and turn two bolts through each post.",
      add: ["HB", "P1", "P2"],
      fix: [
        ...[-1, 1].map((sx): CustomFix => ({ ...barrel, count: 2, at: [yR - 20, yR + 20].map((y): Vec3 => [sx * xIn, y, zHin + 40]), dir: [sx, 0, 0], on: side(sx) })),
        ...[-1, 1].map((sx): CustomFix => ({ kind: "bolt", name: "Bolt", count: 2, len: 90, dia: 6, at: [yR - 20, yR + 20].map((y): Vec3 => [sx * xR, y, zHead]), dir: [0, 0, 1], on: sx < 0 ? "P1" : "P2", mate: side(sx) })),
      ],
      people: 2,
    },
    { title: "Lay the centre beam in its brackets", detail: "Its ends drop into the brackets on the headboard and the footboard.", add: ["CB"] },
    {
      title: "Screw the beam into the brackets",
      detail: "Two screws at each end. Check that the frame is square before you tighten them.",
      fix: [-1, 1].map((sz): CustomFix => ({ kind: "screw", count: 2, len: 16, dia: 6, at: [-12, 12].map((x): Vec3 => [x, ySlat, zBeam + sz * (beamL / 2 - 25)]), dir: [0, -1, 0], on: "CB" })),
      check: "square",
    },
    {
      title: "Screw the straps to the centre beam",
      detail: "Pull each strap tight and screw its loose end to the top of the beam. The straps make a diamond, so the frame stays square.",
      fix: [{ kind: "screw", count: 4, len: 16, dia: 6, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => strapEnd(sx, sz))), dir: [0, -1, 0], on: "CB" }],
      check: "square",
    },
    {
      title: "Knock the wedges into the foot posts",
      detail: "One through the slot in each rail end in front of the foot posts, pushed down until it is tight.",
      add: ["W1", "W2"],
      from: { W1: [0, 200, 0], W2: [0, 200, 0] },
    },
    {
      title: "Press the slat holders onto the centre beam",
      detail: "The two double holders go at the ends of the beam.",
      fix: [{ kind: "clip", name: "Double slat holder", count: 2, at: [-1, 1].map((sz): Vec3 => [0, ySlat, zBeam + sz * (ml / 2 - 30)]), on: "CB" }],
    },
    {
      title: "Press the slat holders onto the side rails",
      detail: "One at each end of both rails' inside ledges.",
      fix: [{ kind: "clip", name: "Slat holder", count: 4, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (xIn - 10), ySlat, zBeam + sz * (ml / 2 - 30)])) }],
    },
    {
      title: "Stick the grip strips on the centre beam",
      detail: "Peel off the backing and press three strips along the top of the beam. Trim the last one to fit, don't overlap them.",
      fix: [{ kind: "clip", name: "Wide grip strip", count: 3, at: [-600, 0, 600].map((z): Vec3 => [0, ySlat, z]), on: "CB" }],
    },
    {
      title: "Stick the grip strips on the side rails",
      detail: "Three narrow strips along each rail's ledge, end to end.",
      fix: [{ kind: "clip", name: "Narrow grip strip", count: 6, at: [-1, 1].flatMap((sx) => [-600, 0, 600].map((z): Vec3 => [sx * (xIn - 10), ySlat, z])) }],
    },
    {
      title: "Unroll the slats",
      detail: "Lay each roll with its slats arching up, and tuck the end slats under the holders.",
      add: ["R1", "R2"],
    },
    { title: "Lay your mattress on", detail: "A 135 x 190 cm mattress fits inside the frame.", add: ["M"] },
  ];
  return { parts, steps } as CustomParams;
}

const family: Family = { names: ["TAXÅSKLINT", "TAXASKLINT"], recipe };
export default family;
