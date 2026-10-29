import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FRYKSÅS, read from its manuals. Handwoven rattan over bent frames, joined with machine screws and an Allen key.
 * The armchair and the footstool are built upside down: a rattan shell on a rug, two bent leg frames screwed under
 * it with washers, two cross rails bolted between the frames with sleeve bolts, everything tightened at the end.
 * The storage unit on castors is built on its side: shelves screwed to one side frame, the other side frame lowered
 * on, the woven basket slid in, and the castors pushed in two at a time with it upside down.
 * The desk is built on its side too: the two halves of the back screen joined, stood on one side frame with the
 * desk top, the other side frame laid on, bolted, then stood up and the top bolted to both sides.
 * The cabinet is built lying on one woven side frame: shelves, back panels and back rails stood on it, the other
 * side laid on, then the bottom with its plinth slid onto the end and the top lowered on once it stands. The TV bench
 * is built upright from the plinth: bottom, dividers, woven end frames, shelves, back and top, then the doors.
 */

type Kind = CustomFix["kind"];
const PI = Math.PI;
const fx = (kind: Kind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const r1 = (n: number) => Math.round(n * 10) / 10;

// a round tube as a piece: along y unless turned
const tubeY = (dia: number, len: number, pos: Vec3): PartPiece => ({ shape: "cyl", size: [dia, len, dia], pos });
const tubeX = (dia: number, len: number, pos: Vec3): PartPiece => ({ shape: "cyl", size: [dia, len, dia], pos, rot: [0, 0, PI / 2] });
const tubeZ = (dia: number, len: number, pos: Vec3): PartPiece => ({ shape: "cyl", size: [dia, len, dia], pos, rot: [PI / 2, 0, 0] });

/** A part drawn as pieces placed in product coordinates: works out its box and moves the pieces relative to it. */
function built(id: string, name: string, pieces: PartPiece[], material: CustomPart["material"], lo?: Vec3, hi?: Vec3): CustomPart {
  const ext = (p: PartPiece): [Vec3, Vec3] => {
    let s: Vec3 = p.size;
    if (p.shape === "cyl" && p.rot) s = p.rot[2] ? [p.size[1], p.size[0], p.size[2]] : p.rot[0] ? [p.size[0], p.size[2], p.size[1]] : s;
    return [p.pos.map((v, i) => v - s[i] / 2) as Vec3, p.pos.map((v, i) => v + s[i] / 2) as Vec3];
  };
  const boxes = pieces.map(ext);
  const L = lo ?? ([0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[0][i]))) as Vec3);
  const H = hi ?? ([0, 1, 2].map((i) => Math.max(...boxes.map((b) => b[1][i]))) as Vec3);
  const mid = L.map((v, i) => r1((v + H[i]) / 2)) as Vec3;
  return {
    id,
    name,
    size: L.map((v, i) => r1(H[i] - v)) as Vec3,
    pos: mid,
    material,
    pieces: pieces.map((p) => ({ ...p, pos: p.pos.map((v, i) => r1(v - mid[i])) as Vec3 })),
  };
}

/* ---------- armchair and footstool ---------- */

const LEG = 22; // white steel tube
const SCREW = { len: 20, dia: 6 }; // through the leg frame plate into the shell
const SLEEVE = { name: "Sleeve bolt", len: 45, dia: 8 };
const WASHER = { len: 2, dia: 14 };

interface Seat {
  id: string;
  W: number;
  D: number;
  z0: number; // centre, front to back
  seatY: number; // top of the seat
  chair: boolean;
}

/** The rattan shell: a dished seat, and on the chair a tall back and the arms rolled up out of it. */
function shell(o: Seat): CustomPart {
  const { W, D, z0, seatY } = o;
  const t = 30;
  const p: PartPiece[] = [];
  if (o.chair) {
    p.push({ shape: "box", size: [W - 330, t, 520], pos: [0, seatY - t / 2, z0 + 80] });
    p.push({ shape: "box", size: [W - 190, 30, 70], pos: [0, seatY - 40, z0 + 360], rot: [0.5, 0, 0] }); // the rolled front lip
    // the back curves round the sitter: a middle panel and two wings turned forward
    p.push({ shape: "box", size: [W - 420, 520, t], pos: [0, seatY + 230, z0 - 320], rot: [-0.3, 0, 0] });
    for (const sx of [-1, 1]) p.push({ shape: "box", size: [260, 460, t], pos: [sx * (W / 2 - 160), seatY + 200, z0 - 250], rot: [-0.25, -sx * 0.7, 0] });
    for (const sx of [-1, 1]) p.push({ shape: "box", size: [50, 130, 520], pos: [sx * (W / 2 - 60), seatY + 60, z0 + 60], rot: [0, 0, sx * 0.2] });
  } else {
    p.push({ shape: "box", size: [W - 40, t, D - 40], pos: [0, seatY - t / 2, z0] });
    for (const sz of [-1, 1]) p.push({ shape: "box", size: [W - 40, 60, 40], pos: [0, seatY + 5, z0 + sz * (D / 2 - 20)] });
    for (const sx of [-1, 1]) p.push({ shape: "box", size: [40, 50, D - 80], pos: [sx * (W / 2 - 20), seatY, z0] });
  }
  return built(o.id, o.chair ? "Seat shell" : "Footstool shell", p, "wood");
}

/** One bent leg frame: a top bar under the shell and a leg down from each end. */
function legFrame(id: string, x: number, yTop: number, zf: number, zb: number): CustomPart {
  const yb = yTop - LEG / 2;
  return built(id, "Leg frame", [tubeZ(LEG, zf - zb + LEG, [x, yb, (zf + zb) / 2]), tubeY(LEG, yb, [x, yb / 2, zf]), tubeY(LEG, yb, [x, yb / 2, zb])], "metal");
}

function seatRecipe(o: Seat, cushion: boolean) {
  const { id, z0, seatY } = o;
  const xl = o.chair ? 240 : o.W / 2 - 70;
  const zf = z0 + (o.chair ? 250 : o.D / 2 - 60), zb = z0 - (o.chair ? 290 : o.D / 2 - 60);
  const yTop = seatY - 30;
  const yRail = 110;
  const parts: CustomPart[] = [shell(o), legFrame(`${id}L`, -xl, yTop, zf, zb), legFrame(`${id}R`, xl, yTop, zf, zb)];
  const railLen = 2 * xl - LEG;
  parts.push({ id: `${id}F`, name: "Cross rail", size: [railLen, LEG, LEG], pos: [0, yRail, zf], shape: "cyl", material: "metal" });
  parts.push({ id: `${id}B`, name: "Cross rail", size: [railLen, LEG, LEG], pos: [0, yRail, zb], shape: "cyl", material: "metal" });
  if (cushion) parts.push({ id: `${id}C`, name: o.chair ? "Seat cushion" : "Footstool cushion", size: o.chair ? [500, 40, 440] : [o.W - 140, 40, o.D - 120], pos: [0, seatY + 20, z0 + (o.chair ? 70 : 0)], material: "soft" });

  // two screws with washers through each frame's top bar into the shell
  const zs = [zf - 90, zb + 90];
  const frameFix = (side: "L" | "R") => {
    const x = side === "L" ? -xl : xl;
    const at = zs.map((z) => [x, yTop - LEG, z] as Vec3);
    return [fx("washer", at, [0, 1, 0], { ...WASHER, on: `${id}${side}` }), fx("screw", at, [0, 1, 0], { ...SCREW, on: `${id}${side}`, mate: id })];
  };
  const railFix = (rail: "F" | "B") => {
    const z = rail === "F" ? zf : zb;
    return [fx("bolt", [[-xl - LEG / 2, yRail, z]], [1, 0, 0], { ...SLEEVE, on: `${id}L`, mate: `${id}${rail}` }), fx("bolt", [[xl + LEG / 2, yRail, z]], [-1, 0, 0], { ...SLEEVE, on: `${id}R`, mate: `${id}${rail}` })];
  };
  const what = o.chair ? "seat shell" : "footstool";
  const steps: CustomStep[] = [
    {
      title: o.chair ? "Lay the seat shell upside down on a rug" : "Lay the footstool shell upside down on a rug",
      detail: o.chair ? "The back points away from you. The two leg frames are a pair: check the plates face the shell before you start." : "Check which way is the front first: it is the longer edge, as the drawing shows.",
      add: [id],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw on a leg frame",
      detail: "Its plates sit flat on the shell. A washer under each screw head, turned in loosely for now.",
      add: [`${id}L`],
      fix: frameFix("L"),
      tools: ["allen"],
    },
    { title: "Screw on the other leg frame", detail: "The same way: two screws and two washers, loose.", add: [`${id}R`], fix: frameFix("R"), tools: ["allen"] },
    {
      title: "Bolt in a cross rail",
      detail: "It goes between the two front legs. A sleeve bolt through each leg into the rail end, loose.",
      add: [`${id}F`],
      fix: railFix("F"),
      tools: ["allen"],
    },
    { title: "Bolt in the other cross rail", detail: "Between the back legs, with two more sleeve bolts.", add: [`${id}B`], fix: railFix("B"), tools: ["allen"] },
    {
      title: "Tighten everything",
      detail: `All four screws under the ${what} and all four sleeve bolts, now that every part is in.`,
      tools: ["allen"],
    },
    { title: o.chair ? "Turn the chair over" : "Turn the footstool over", detail: "Stand it on its feet and check it doesn't rock.", pose: "+y" },
  ];
  if (cushion) steps.push({ title: o.chair ? "Lay the cushion on the seat" : "Lay the cushion on the footstool", detail: "Ties or straps at the back, round the frame.", add: [`${id}C`] });
  return { parts, steps };
}

// IKEA's own measures: the armchair 89 x 84 x 85, seat height 37; the footstool goes in front of it
const CHAIR = { W: 890, D: 850, seatY: 370 };
const STOOL = { W: 600, D: 460, H: 400 };

function armchair(s: ProductSpec): CustomParams {
  const slug = s.slug ?? "";
  const foot = /footstool/.test(slug) || !!s.sofa?.foot;
  const cushion = /cushion|footstool/.test(slug);
  const zc = foot ? -(STOOL.D + 200) / 2 : 0;
  const a = seatRecipe({ id: "S", W: CHAIR.W, D: CHAIR.D, z0: zc, seatY: CHAIR.seatY, chair: true }, cushion);
  if (!foot) return a;
  const f = seatRecipe({ id: "T", W: STOOL.W, D: STOOL.D, z0: zc + CHAIR.D / 2 + 200 + STOOL.D / 2, seatY: STOOL.H, chair: false }, cushion);
  f.steps[0].title = "Build the footstool the same way: lay its shell upside down";
  return { parts: [...a.parts, ...f.parts], steps: [...a.steps, ...f.steps] };
}

/* ---------- storage unit on castors ---------- */

function storage(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 24; // rattan-wrapped tube
  const yc = 80; // the frames start above the castors
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;
  const yTop = H - T / 2;
  const yWeave = 300; // woven up to here, spindles above
  const side = (id: string, sx: number) => {
    const x = sx * xs;
    const p: PartPiece[] = [
      tubeY(T, yTop - yc, [x, (yTop + yc) / 2, -zs]),
      tubeY(T, yTop - yc, [x, (yTop + yc) / 2, zs]),
      tubeZ(T, 2 * zs, [x, yTop, 0]),
      { shape: "box", size: [8, yWeave - yc - 20, 2 * zs - T], pos: [x, (yWeave + yc) / 2, 0] },
      tubeZ(14, 2 * zs - T, [x, yWeave, 0]),
    ];
    for (let i = 1; i <= 7; i++) p.push(tubeY(8, yTop - yWeave - 20, [x, (yTop + yWeave) / 2, -zs + (2 * zs * i) / 8]));
    return built(id, "Side frame", p, "wood", [x - T / 2, yc, -D / 2], [x + T / 2, H, D / 2]);
  };
  const st = 18;
  const iw = W - 2 * T;
  const yShelf = [Math.round(H * 0.6), Math.round(H * 0.84)];
  const parts: CustomPart[] = [side("L", -1), side("R", 1)];
  yShelf.forEach((y, i) => parts.push({ id: `S${i}`, name: "Shelf", size: [iw, st, D - 2 * T], pos: [0, y, 0], material: "wood" }));
  const yb = yc + 40;
  parts.push(
    built(
      "K",
      "Woven basket",
      [
        { shape: "box", size: [iw, 16, D - 2 * T], pos: [0, yb, 0] },
        { shape: "box", size: [iw, yShelf[0] - st / 2 - yb - 8, 14], pos: [0, (yShelf[0] - st / 2 + yb + 8) / 2, -D / 2 + T + 7] },
      ],
      "wood",
    ),
  );
  const shelfScrews = (i: number, sx: number) => fx("screw", [-1, 1].map((sz) => [sx * (W / 2), yShelf[i], sz * (D / 2 - 90)] as Vec3), [-sx, 0, 0], { len: 30, dia: 4, on: sx < 0 ? "L" : "R", mate: `S${i}` });
  const castor = (sz: number) => [-1, 1].map((sx) => fx("castor", [[sx * xs, yc, sz * zs]], [0, 1, 0], { on: sx < 0 ? "L" : "R" }));
  const steps: CustomStep[] = [
    {
      title: "Lay a side frame on the rug and screw a shelf to it",
      detail: "The frame lies flat with its holes up. Two screws through the frame into the shelf end.",
      add: ["L", "S0"],
      fix: [shelfScrews(0, -1)],
      pose: "+x",
      tools: ["allen"],
      warnings: ["floor"],
    },
    { title: "Screw the other shelf on", detail: "The same way, two screws, at the upper holes.", add: ["S1"], fix: [shelfScrews(1, -1)], tools: ["allen"] },
    {
      title: "Lower the other side frame on",
      detail: "Handles at the same end as the first frame. Four screws, two into each shelf.",
      add: ["R"],
      fix: [shelfScrews(0, 1), shelfScrews(1, 1)],
      tools: ["allen"],
    },
    {
      title: "Slide in the woven basket",
      detail: "Its tall side goes to the back. Four screws through its frame into the side frame.",
      add: ["K"],
      fix: [fx("screw", [[xs + T / 2, yb, -D / 4], [xs + T / 2, yb, D / 4], [xs + T / 2, yShelf[0] - 60, -D / 2 + T + 7], [xs + T / 2, yb + 80, -D / 2 + T + 7]], [-1, 0, 0], { len: 30, dia: 4, on: "R", mate: "K" })],
      tools: ["allen"],
    },
    {
      title: "Turn it upside down and push in two castors",
      detail: "Two of the same kind at one end. Push each one into its leg until it clicks.",
      fix: castor(1),
      pose: "-y",
    },
    { title: "Push in the other two castors", detail: "Then turn it the right way up onto its wheels.", fix: castor(-1) },
    { title: "Stand it on its wheels", detail: "Check all four turn freely.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- desk ---------- */

function desk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const H = 1050; // the screen stands above the top: IKEA's total height
  const yTop = 760; // top of the desk top
  const T = 25;
  const yBack = 420; // the back screen starts here
  const ySide = 380;
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;
  const yHi = H - T / 2;
  const sideFrame = (id: string, sx: number) => {
    const x = sx * xs;
    const p: PartPiece[] = [tubeY(T, yHi, [x, yHi / 2, -zs]), tubeY(T, yHi, [x, yHi / 2, zs]), tubeZ(T, 2 * zs, [x, yHi, 0]), tubeZ(T - 5, 2 * zs, [x, ySide, 0])];
    for (let i = 1; i <= 9; i++) p.push(tubeY(8, yHi - ySide, [x, (yHi + ySide) / 2, -zs + (2 * zs * i) / 10]));
    for (const y of [ySide + 150, yHi - 160]) p.push(tubeZ(8, 2 * zs, [x, y, 0]));
    return built(id, "Side frame", p, "wood", [x - T / 2, 0, -D / 2], [x + T / 2, H, D / 2]);
  };
  const backHalf = (id: string, sx: number) => {
    const x0 = sx * T, x1 = sx * (W / 2 - T); // from the join to the side frame
    const xm = (x0 + x1) / 2, len = Math.abs(x1 - x0);
    const z = -zs;
    const xe = sx * (T / 2);
    // a post at each end: the one by the join, and the one the side frame is bolted into
    const xo = sx * (W / 2 - 1.5 * T);
    const p: PartPiece[] = [tubeX(T, len, [xm, yHi, z]), tubeX(T - 5, len, [xm, yBack, z]), tubeY(T, yHi - yBack, [xe, (yHi + yBack) / 2, z]), tubeY(T, yHi - yBack, [xo, (yHi + yBack) / 2, z])];
    for (let i = 1; i <= 9; i++) p.push(tubeY(8, yHi - yBack, [x0 + ((x1 - x0) * i) / 10, (yHi + yBack) / 2, z]));
    for (const y of [yBack + 150, yHi - 160]) p.push(tubeX(8, len, [xm, y, z]));
    return built(id, sx < 0 ? "Back screen, left" : "Back screen, right", p, "wood", [Math.min(0, x1), yBack - T / 2, -D / 2], [Math.max(0, x1), H, -D / 2 + T]);
  };
  const tt = 22;
  const parts: CustomPart[] = [
    backHalf("BL", -1),
    backHalf("BR", 1),
    sideFrame("L", -1),
    sideFrame("R", 1),
    { id: "P", name: "Desk top", size: [W - 2 * T, tt, D - T], pos: [0, yTop - tt / 2, T / 2], material: "wood" },
  ];
  const bolt = (on: string, mate: string, pts: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}) => fx("bolt", pts, dir, { len: 30, dia: 6, on, mate, ...o });
  const xL = -W / 2, xR = W / 2;
  const steps: CustomStep[] = [
    {
      title: "Join the two halves of the back screen",
      detail: "Lay them flat on a rug and push the two connectors into the tube ends, then slide the halves together.",
      add: ["BL", "BR"],
      fix: [fx("connector", [[0, yHi, -zs], [0, yBack, -zs]], [1, 0, 0], { name: "Tube connector", len: 60, dia: 18, on: "BL", mate: "BR" })],
      pose: "-z",
      warnings: ["floor"],
    },
    {
      title: "Screw the threaded pins into a side frame",
      detail: "Two pins, into the holes in its back post, with a screwdriver until they stop.",
      add: ["L"],
      fix: [fx("stud", [[xL + T, yHi - 120, -zs], [xL + T, yBack + 80, -zs]], [-1, 0, 0], { name: "Threaded pin", len: 40, dia: 8, on: "L" })],
      tools: ["screwdriver"],
      pose: "+x",
    },
    {
      title: "Stand the back screen on the side frame",
      detail: "The side frame lies on the rug. Lower the back so its tube ends drop over the pins.",
    },
    {
      title: "Lower the desk top in",
      detail: "Its edge sits against the back screen, the holes over the pins in the side frame.",
      add: ["P"],
    },
    {
      title: "Bolt the side frame on together",
      detail: "One of you holds it all steady while the other turns in three bolts with the Allen key.",
      fix: [bolt("L", "BL", [[xL, yHi - 60, -zs], [xL, yBack + 40, -zs]], [1, 0, 0]), bolt("L", "P", [[xL, yTop - tt / 2, 0]], [1, 0, 0])],
      tools: ["allen"],
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Lay the other side frame on",
      detail: "Straight down onto the ends of the back screen and the desk top.",
      add: ["R"],
    },
    {
      title: "Bolt it to the back screen",
      detail: "Two short bolts with washers, top and bottom.",
      fix: [bolt("R", "BR", [[xR, yHi - 60, -zs], [xR, yBack + 40, -zs]], [-1, 0, 0], { len: 16 })],
      tools: ["allen"],
    },
    {
      title: "Turn it over and bolt the first side the same way",
      detail: "Two more short bolts into the back screen.",
      fix: [bolt("L", "BL", [[xL, yHi - 200, -zs], [xL, yBack + 160, -zs]], [1, 0, 0], { len: 16 })],
      pose: "-x",
      tools: ["allen"],
    },
    {
      title: "Stand it up and bolt the top to the sides",
      detail: "Drop a barrel nut into each end of the desk top, slot up, then a long bolt through each side frame into it.",
      fix: [
        fx("nut", [[xL + T + 40, yTop, D / 4], [xR - T - 40, yTop, D / 4]], [0, -1, 0], { name: "Barrel nut", len: 18, dia: 10, on: "P" }),
        bolt("L", "P", [[xL, yTop - tt / 2, D / 4]], [1, 0, 0], { len: 70 }),
        bolt("R", "P", [[xR, yTop - tt / 2, D / 4]], [-1, 0, 0], { len: 70 }),
      ],
      pose: "+y",
      tools: ["allen", "screwdriver"],
    },
  ];
  return { parts, steps };
}


/* ---------- cabinet and TV bench: chipboard boxes with woven rattan ends and doors ---------- */

const CAM_A = { name: "Cam lock", dia: 15, len: 12 }; // the low one
const CAM_B = { name: "Cam lock, tall", dia: 15, len: 16 };
const box = (lo: Vec3, hi: Vec3): { size: Vec3; pos: Vec3 } => ({ size: lo.map((v, i) => r1(hi[i] - v)) as Vec3, pos: lo.map((v, i) => r1((v + hi[i]) / 2)) as Vec3 });
const board = (id: string, name: string, lo: Vec3, hi: Vec3, material: CustomPart["material"] = "board"): CustomPart => ({ id, name, ...box(lo, hi), material });

/** A woven panel in a wooden frame (an end or a door): four bars round a thinner sheet of rattan. n is the axis it faces. */
function woven(id: string, name: string, lo: Vec3, hi: Vec3, n: 0 | 2): CustomPart {
  const { size, pos } = box(lo, hi);
  const u = n === 0 ? 2 : 0; // across
  const bar = 36;
  const pc = (sz: Vec3, at: Vec3): PartPiece => ({ shape: "box", size: sz, pos: at });
  const S = (a: number, b: number, c: number): Vec3 => (n === 0 ? [c, b, a] : [a, b, c]); // (across, up, thickness)
  const P = (a: number, b: number, c: number): Vec3 => (n === 0 ? [c, b, a] : [a, b, c]);
  const wU = size[u], h = size[1], t = size[n];
  const pieces: PartPiece[] = [
    pc(S(bar, h, t), P(-wU / 2 + bar / 2, 0, 0)),
    pc(S(bar, h, t), P(wU / 2 - bar / 2, 0, 0)),
    pc(S(wU - 2 * bar, bar, t), P(0, h / 2 - bar / 2, 0)),
    pc(S(wU - 2 * bar, bar, t), P(0, -h / 2 + bar / 2, 0)),
    pc(S(wU - 2 * bar, h - 2 * bar, t * 0.4), P(0, 0, 0)),
  ];
  return { id, name, size, pos, material: "wood", pieces };
}

const pts = (xs: number[], ys: number[], zs: number[]): Vec3[] => xs.flatMap((x) => ys.flatMap((y) => zs.map((z) => [x, y, z] as Vec3)));
const on = (kind: Kind, host: string, mate: string | undefined, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => fx(kind, at, dir, { on: host, ...(mate ? { mate } : {}), ...o });

function cabinet(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 40, tb = 25, yP = 90; // end frames, top and bottom, plinth height
  const yB = yP + tb, yT = H - tb;
  const zB = -D / 2, zF = D / 2 - 20; // the carcass, doors in front of it
  const xi = W / 2 - T;
  const ts = 18;
  const room = (yT - yB - 2 * ts) / 3;
  const yS = [yB + room + ts / 2, yB + 2 * room + 1.5 * ts].map(Math.round);
  const zr = zB + 18, zp = zr + 3; // back rails, back panels in front of them
  const parts: CustomPart[] = [
    woven("L", "Side frame", [-W / 2, yB, zB], [-xi, yT, zF], 0),
    woven("R", "Side frame", [xi, yB, zB], [W / 2, yT, zF], 0),
    board("S1", "Shelf", [-xi, yS[0] - ts / 2, zp], [xi, yS[0] + ts / 2, zF]),
    board("S2", "Shelf", [-xi, yS[1] - ts / 2, zp], [xi, yS[1] + ts / 2, zF]),
    board("P2", "Back panel", [-xi, yS[0] + ts / 2, zr], [xi, yS[1] - ts / 2, zp], "fiber"),
    board("RB", "Back rail", [-xi, yB, zB], [xi, yB + 60, zr]),
    board("RT", "Back rail", [-xi, yT - 60, zB], [xi, yT, zr]),
    board("P1", "Back panel", [-xi, yB + 60, zr], [xi, yS[0] - ts / 2, zp], "fiber"),
    board("K1", "Leg block", [-W / 2 + 50, 10, -D / 2 + 30], [-W / 2 + 100, yP, D / 2 - 30], "wood"),
    board("K2", "Leg block", [W / 2 - 100, 10, -D / 2 + 30], [W / 2 - 50, yP, D / 2 - 30], "wood"),
    board("KR", "Plinth rail", [-W / 2 + 100, 30, -9], [W / 2 - 100, yP, 9], "wood"),
    board("B", "Bottom", [-W / 2, yP, -D / 2], [W / 2, yB, D / 2]),
    board("P3", "Back panel", [-xi, yS[1] + ts / 2, zr], [xi, yT - 60, zp], "fiber"),
    board("T", "Top", [-W / 2, yT, -D / 2], [W / 2, H, D / 2]),
    woven("G1", "Door", [-W / 2, yB + 2, zF], [-1.5, yT - 2, D / 2], 2),
    woven("G2", "Door", [1.5, yB + 2, zF], [W / 2, yT - 2, D / 2], 2),
  ];
  const zc = [zp + 70, zF - 60]; // two fittings across a joint, back and front
  const sides: [string, number][] = [["L", -1], ["R", 1]];
  // the shelves and rails meet the end frames: dowels in their ends, a cam bolt in the frame, a cam lock in the board
  const shelfDowels = sides.flatMap(([, sx]) => [0, 1].map((i) => on("dowel", `S${i + 1}`, undefined, [-sx, 0, 0], pts([sx * xi], [yS[i]], [zp + 40, zF - 30]))));
  const railDowels = sides.flatMap(([, sx]) => [["RB", yB + 30], ["RT", yT - 30]].map(([id, y]) => on("dowel", id as string, undefined, [-sx, 0, 0], pts([sx * xi], [(y as number) - 15, (y as number) + 15], [zB + 9]))));
  const frameBolts = (side: string, sx: number) => [
    ...[0, 1].map((i) => on("camScrew", side, `S${i + 1}`, [sx, 0, 0], pts([sx * xi], [yS[i]], zc), { len: 34 })),
    ...[["RB", yB + 30], ["RT", yT - 30]].map(([id, y]) => on("camScrew", side, id as string, [sx, 0, 0], [[sx * xi, y as number, zB + 9]], { len: 34 })),
  ];
  const endDowels = sides.flatMap(([id, sx]) => [on("dowel", id, undefined, [0, 1, 0], pts([sx * (W / 2 - T / 2)], [yB], [zB + 60, zF - 60])), on("dowel", id, undefined, [0, -1, 0], pts([sx * (W / 2 - T / 2)], [yT], [zB + 60, zF - 60]))]);
  const shelfCams = [0, 1].map((i) => on("cam", `S${i + 1}`, undefined, [0, -1, 0], pts([-xi + 30, xi - 30], [yS[i] + ts / 2], zc), CAM_B));
  const railCams = ["RB", "RT"].map((id) => on("cam", id, undefined, [0, 0, 1], pts([-xi + 30, xi - 30], [id === "RB" ? yB + 30 : yT - 30], [zB]), CAM_A));
  // the plinth: feet, then the rail between the leg blocks, then all of it under the bottom
  const xk = W / 2 - 75;
  const feet = [on("foot", "K1", undefined, [0, 1, 0], pts([-xk], [10], [-D / 2 + 60, D / 2 - 60]), { name: "Adjustable foot" }), on("foot", "K2", undefined, [0, 1, 0], pts([xk], [10], [-D / 2 + 60, D / 2 - 60]), { name: "Adjustable foot" })];
  const kBolts = [on("camScrew", "K1", "KR", [-1, 0, 0], [[-W / 2 + 100, 60, 0]], { len: 34 }), on("camScrew", "K2", "KR", [1, 0, 0], [[W / 2 - 100, 60, 0]], { len: 34 })];
  const kDowels = [on("dowel", "K1", undefined, [-1, 0, 0], [[-W / 2 + 100, 60, 0]].map(([x, y, z]) => [x, y - 25, z] as Vec3)), on("dowel", "K2", undefined, [1, 0, 0], [[W / 2 - 100, 35, 0]])];
  const kCams = on("cam", "KR", undefined, [0, 1, 0], [[-W / 2 + 130, yP, 0], [W / 2 - 130, yP, 0]], CAM_B);
  const bBolts = on("camScrew", "B", undefined, [0, 1, 0], [...pts([-xk, xk], [yP], [-D / 2 + 70, D / 2 - 70]), [0, yP, 0]], { len: 34 });
  const bDowels = on("dowel", "B", undefined, [0, 1, 0], pts([-xk, xk], [yP], [-D / 2 + 130, D / 2 - 130]));
  const plinthCams = [on("cam", "K1", undefined, [1, 0, 0], pts([-W / 2 + 50], [yP - 30], [-D / 2 + 70, D / 2 - 70]), CAM_B), on("cam", "K2", undefined, [-1, 0, 0], pts([W / 2 - 50], [yP - 30], [-D / 2 + 70, D / 2 - 70]), CAM_B), on("cam", "KR", undefined, [0, 0, -1], [[0, yP - 30, 9]], CAM_B)];
  // the bottom and the top take cam bolts that go into the end frames and the back rails
  const capBolts = (id: string, y: number, dir: number) => on("camScrew", id, undefined, [0, dir, 0], [...pts([-W / 2 + T / 2, W / 2 - T / 2], [y], [zB + 120, zF - 120]), [0, y, zB + 9]], { len: 34 });
  const capCams = (y: number) => sides.map(([id, sx]) => on("cam", id, undefined, [sx, 0, 0], pts([sx * xi], [y], [zB + 120, zF - 120]), CAM_A));
  const capRailCam = (id: string, y: number) => on("cam", id, undefined, [0, 0, 1], [[0, y, zB]], CAM_A);
  const hingeAt = (sx: number) => pts([sx * (W / 2 - T / 2)], [yB + 120, (yB + yT) / 2, yT - 120], [zF]);
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into both side frames",
      detail: "Lay both frames flat on a rug, inner side up. Six in each, by hand or with a screwdriver until they stop.",
      fix: [...frameBolts("L", -1), ...frameBolts("R", 1)],
      wait: ["R"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Tap dowels into the ends of the side frames", detail: "Two in each end. Not in the holes by the cam bolts.", fix: endDowels, tools: ["hammer"] },
    { title: "Tap dowels into the shelves", detail: "Two in each end of both shelves. The edge with the groove goes to the back.", fix: shelfDowels, wait: ["S1", "S2"], tools: ["hammer"] },
    { title: "Stand the shelves on a side frame", detail: "The side frame lies on the rug. Each shelf goes onto two dowels and two cam bolts, grooves to the back.", add: ["S1", "S2"] },
    { title: "Slide a back panel in between the shelves", detail: "Smooth side in. Push it down the grooves until it meets the side frame.", add: ["P2"] },
    { title: "Tap dowels into the back rails", detail: "Two in each end of both rails.", fix: railDowels, wait: ["RB", "RT"], tools: ["hammer"] },
    { title: "Stand a back rail at each end", detail: "Onto the dowels and the cam bolt at each end of the side frame, the groove facing in.", add: ["RB", "RT"] },
    { title: "Lay the other side frame on", detail: "Lower it so every dowel and cam bolt finds its hole.", add: ["R"] },
    { title: "Lock the shelves with cam locks", detail: "Eight tall cam locks, two in each shelf end. Turn each one clockwise until it pulls tight.", fix: shelfCams, tools: ["screwdriver"] },
    { title: "Lock the back rails with cam locks", detail: "Four low cam locks, one in each rail end.", fix: railCams, tools: ["screwdriver"] },
    { title: "Slide in a back panel at one end", detail: "Smooth side in, along the grooves until it stops against the shelf.", add: ["P1"] },
    { title: "Screw the feet into the leg blocks", detail: "Two in each, from underneath. Turn them all the way in for now.", fix: feet, wait: ["K1", "K2", "KR", "B"], from: { K1: [0, 0, 500], K2: [0, 0, 500], KR: [0, 0, 500], B: [0, 0, 500] } },
    { title: "Screw cam bolts into the leg blocks", detail: "One in the inner face of each.", fix: kBolts },
    { title: "Tap a dowel into each leg block", detail: "Next to the cam bolt.", fix: kDowels, tools: ["hammer"] },
    { title: "Push the plinth rail between the leg blocks", detail: "Its cam lock holes face up. Press it onto the dowel and cam bolt at each end." },
    { title: "Lock the plinth rail", detail: "Two tall cam locks, one at each end of the rail.", fix: [kCams], tools: ["screwdriver"] },
    { title: "Screw cam bolts into the underside of the bottom", detail: "Lay the bottom with the right side down. Five bolts.", fix: [bBolts] },
    { title: "Tap dowels into the underside of the bottom", detail: "Four, beside the cam bolts.", fix: [bDowels], tools: ["hammer"] },
    { title: "Lower the plinth onto the bottom", detail: "Upside down, onto the five cam bolts and four dowels." },
    { title: "Lock the plinth to the bottom", detail: "Five tall cam locks: two in each leg block and one in the rail.", fix: plinthCams, tools: ["screwdriver"] },
    { title: "Turn the bottom over and screw in its cam bolts", detail: "Five in the top face, along the edges and at the back.", fix: [capBolts("B", yB, 1)] },
    {
      title: "Slide the bottom onto the end of the frame",
      detail: "The plinth faces out. Push it straight onto the dowels in the side frames and the cam bolts into their holes.",
      add: ["K1", "K2", "KR", "B"],
      from: { K1: [0, -500, 0], K2: [0, -500, 0], KR: [0, -500, 0], B: [0, -500, 0] },
    },
    { title: "Lock the bottom to the side frames", detail: "Four low cam locks, two in each side frame.", fix: capCams(yB + 30), tools: ["screwdriver"] },
    { title: "Lock the bottom to the back rail", detail: "Turn the frame so the back faces you. One more low cam lock in the rail.", fix: [capRailCam("RB", yB + 30)], tools: ["screwdriver"] },
    { title: "Slide in the last back panel", detail: "At the open end, smooth side in, down to the shelf.", add: ["P3"] },
    { title: "Stand the cabinet up", detail: "Two of you, lifting it onto its feet. Don't rest it on the plinth's corners.", pose: "+y", people: 2 },
    { title: "Screw cam bolts into the underside of the top", detail: "Lay the top right side down on a rug. Five bolts.", fix: [capBolts("T", yT, -1)], wait: ["T"] },
    {
      title: "Screw the push opener holders under the top",
      detail: "Two holders, 22 mm in from the front edge, two short screws each.",
      fix: [on("screw", "T", undefined, [0, 1, 0], pts([-60, -30, 30, 60], [yT], [zF - 22]), { len: 12, dia: 3.5 })],
      tools: ["screwdriver"],
    },
    { title: "Click the push openers into the holders", detail: "Push each one in until it clicks. Don't press on the plunger.", fix: [on("connector", "T", undefined, [0, 1, 0], pts([-45, 45], [yT], [zF - 22]), { name: "Push opener", len: 60, dia: 16 })] },
    { title: "Lower the top on", detail: "Onto the dowels and cam bolts in the side frames.", add: ["T"] },
    { title: "Lock the top to the side frames", detail: "Four low cam locks.", fix: capCams(yT - 30), tools: ["screwdriver"] },
    { title: "Lock the top to the back rail", detail: "Turn the cabinet round. One low cam lock in the top rail.", fix: [capRailCam("RT", yT - 30)], tools: ["screwdriver"] },
    {
      title: "Clip the back panels to the side frames",
      detail: "Eight clips round the edges of the back. Push the base in, then click the clip into it.",
      fix: [on("clip", "L", undefined, [1, 0, 0], pts([-xi], [yB + 200, yS[0] + 150, yS[1] + 150, yT - 200], [zp]), { name: "Back panel clip" }), on("clip", "R", undefined, [-1, 0, 0], pts([xi], [yB + 200, yS[0] + 150, yS[1] + 150, yT - 200], [zp]), { name: "Back panel clip" })],
    },
    {
      title: "Hang the doors",
      detail: "The hinges are on the doors. Push each one onto its plate in the side frame until it clicks.",
      add: ["G1", "G2"],
      fix: [on("hinge", "G1", "L", [0, 0, -1], hingeAt(-1)), on("hinge", "G2", "R", [0, 0, -1], hingeAt(1))],
    },
    {
      title: "Screw the hinges to the side frames",
      detail: "Open the doors. Two screws through each hinge plate into the inside of the frame.",
      fix: sides.map(([id, sx]) => on("screw", id, undefined, [sx, 0, 0], hingeAt(sx).flatMap(([, y]) => [[sx * xi, y - 16, zF - 40], [sx * xi, y + 16, zF - 40]] as Vec3[]), { len: 16, dia: 3.5 })),
      tools: ["screwdriver"],
    },
    {
      title: "Fit the door stop screws",
      detail: "A screw with a washer into the front edge of each side frame, near the top, for the push openers to meet the doors evenly.",
      fix: [on("washer", "L", undefined, [0, 0, -1], [[-W / 2 + T / 2, yT - 40, zF]]), on("washer", "R", undefined, [0, 0, -1], [[W / 2 - T / 2, yT - 40, zF]]), ...sides.map(([id, sx]) => on("screw", id, undefined, [0, 0, -1], [[sx * (W / 2 - T / 2), yT - 40, zF]], { len: 12, dia: 3.5 }))],
      tools: ["screwdriver"],
    },
    {
      title: "Fix the wall brackets to the top rail",
      detail: "Two, at the back, then level the cabinet with the feet.",
      fix: [on("bracket", "RT", undefined, [0, 0, 1], pts([-W / 4, W / 4], [yT - 30], [zB]), { name: "Wall fitting", included: true })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw it to the wall",
      detail: "Use the plugs and screws that suit your wall. Turn the knobs to pull the cabinet snug to the wall.",
      fix: [
        on("plug", "RT", undefined, [0, 0, 1], pts([-W / 4, W / 4], [yT - 30], [zB - 40]), { included: true }),
        on("screw", "RT", undefined, [0, 0, -1], pts([-W / 4, W / 4], [yT - 30], [zB]), { len: 70, dia: 5, included: true }),
        on("knob", "RT", undefined, [0, 0, -1], pts([-W / 4, W / 4], [yT - 30], [zB + 10]), { name: "Adjuster knob" }),
      ],
      wall: true,
      tools: ["drill"],
    },
    { title: "Press the covers on", detail: "One over each wall fitting.", fix: [on("cap", "RT", undefined, [0, 0, -1], pts([-W / 4, W / 4], [yT - 30], [zB + 20]), { len: 8, dia: 40 })] },
  ];
  return { parts, steps };
}


function tvBench(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 40, tb = 25, yP = 70;
  const yB = yP + tb, yT = H - tb;
  const xi = W / 2 - T;
  const tv = 18;
  const zk = -D / 2 + 5; // the back panel sits in grooves at the very back
  const zF = D / 2 - 20; // the doors are set in front of the dividers
  const room = 520; // the two closed ends; the open middle takes what is left
  const xv = xi - room - tv / 2;
  const ySh = Math.round((yB + yT) / 2);
  const parts: CustomPart[] = [
    board("KR", "Plinth rail", [-W / 2 + 105, 10, 40], [W / 2 - 105, yP, 58], "wood"),
    board("K1", "Leg block", [-W / 2 + 55, 10, -D / 2 + 30], [-W / 2 + 105, yP, D / 2 - 30], "wood"),
    board("K2", "Leg block", [W / 2 - 105, 10, -D / 2 + 30], [W / 2 - 55, yP, D / 2 - 30], "wood"),
    board("B", "Bottom", [-W / 2, yP, -D / 2], [W / 2, yB, D / 2]),
    board("V1", "Divider", [-xv - tv / 2, yB, zk], [-xv + tv / 2, yT, zF]),
    board("V2", "Divider", [xv - tv / 2, yB, zk], [xv + tv / 2, yT, zF]),
    woven("L", "End frame", [-W / 2, yB, -D / 2], [-xi, yT, D / 2], 0),
    woven("R", "End frame", [xi, yB, -D / 2], [W / 2, yT, D / 2], 0),
    board("S1", "Shelf", [-xi, ySh - tv / 2, zk], [-xv - tv / 2, ySh + tv / 2, zF - 20]),
    board("S2", "Shelf", [-xv + tv / 2, ySh - tv / 2, zk], [xv - tv / 2, ySh + tv / 2, zF - 20]),
    board("S3", "Shelf", [xv + tv / 2, ySh - tv / 2, zk], [xi, ySh + tv / 2, zF - 20]),
    board("P", "Back panel", [-xi, yB, -D / 2], [xi, yT, zk], "fiber"),
    board("T", "Top", [-W / 2, yT, -D / 2], [W / 2, H, D / 2]),
    woven("G1", "Door", [-xi, yB + 2, zF], [-xv - tv / 2 - 2, yT - 2, D / 2], 2),
    woven("G2", "Door", [xv + tv / 2 + 2, yB + 2, zF], [xi, yT - 2, D / 2], 2),
  ];
  const xk = W / 2 - 80;
  const zz = [-D / 2 + 70, D / 2 - 70];
  const ym = (yB + yT) / 2;
  const sideX = (sx: number) => sx * (W / 2 - T / 2);
  // the top and bottom meet the end frames and the dividers at these points
  const xsEnds = [-1, 1].map(sideX);
  const hingeAt = (sx: number) => pts([sx * xi], [yB + 60, ym, yT - 60], [zF - 30]);
  const steps: CustomStep[] = [
    { title: "Screw a foot into the plinth rail", detail: "In the middle, from underneath. All the way in for now.", add: ["KR"], fix: [on("foot", "KR", undefined, [0, 1, 0], [[0, 10, 49]], { name: "Adjustable foot" })], pose: "-y", warnings: ["floor"] },
    { title: "Screw two feet into each leg block", detail: "From underneath, all the way in.", fix: ["K1", "K2"].map((id, i) => on("foot", id, undefined, [0, 1, 0], pts([(i ? 1 : -1) * xk], [10], zz), { name: "Adjustable foot" })), wait: ["K1", "K2"] },
    { title: "Screw a cam bolt into each leg block", detail: "In the inner face, where the rail goes.", fix: [on("camScrew", "K1", "KR", [-1, 0, 0], [[-W / 2 + 105, 50, 49]], { len: 34 }), on("camScrew", "K2", "KR", [1, 0, 0], [[W / 2 - 105, 50, 49]], { len: 34 })] },
    { title: "Tap a dowel into each leg block", detail: "Next to the cam bolt.", fix: [on("dowel", "K1", undefined, [-1, 0, 0], [[-W / 2 + 105, 25, 49]]), on("dowel", "K2", undefined, [1, 0, 0], [[W / 2 - 105, 25, 49]])], tools: ["hammer"] },
    { title: "Push the rail between the leg blocks", detail: "Feet up. Onto the dowel and cam bolt at each end, the cam lock holes facing you.", add: ["K1", "K2"], from: { K1: [-300, 0, 0], K2: [300, 0, 0] } },
    { title: "Lock the rail to the leg blocks", detail: "Two tall cam locks, one at each end.", fix: [on("cam", "KR", undefined, [0, 1, 0], [[-W / 2 + 135, yP, 49], [W / 2 - 135, yP, 49]], CAM_B)], tools: ["screwdriver"] },
    { title: "Screw cam bolts into the underside of the bottom", detail: "Lay the bottom right side down on a rug. Six bolts.", fix: [on("camScrew", "B", undefined, [0, 1, 0], [...pts([-xk, xk], [yP], zz), [-W / 4, yP, 49], [W / 4, yP, 49]], { len: 34 })], wait: ["B"] },
    { title: "Tap dowels into the underside of the bottom", detail: "Four, two at each end.", fix: [on("dowel", "B", undefined, [0, 1, 0], pts([-xk, xk], [yP], [-D / 2 + 130, D / 2 - 130]))], tools: ["hammer"] },
    { title: "Put the plinth on the bottom", detail: "Both upside down: the plinth goes onto the six cam bolts and four dowels.", add: ["B"], from: { B: [0, -400, 0] } },
    {
      title: "Lock the plinth to the bottom",
      detail: "Six tall cam locks: two in each leg block and two in the rail.",
      fix: [on("cam", "K1", undefined, [1, 0, 0], pts([-W / 2 + 55], [yP - 25], zz), CAM_B), on("cam", "K2", undefined, [-1, 0, 0], pts([W / 2 - 55], [yP - 25], zz), CAM_B), on("cam", "KR", undefined, [0, 0, -1], [[-W / 4, yP - 25, 58], [W / 4, yP - 25, 58]], CAM_B)],
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into both dividers",
      detail: "Two in the bottom edge and two in the top edge of each.",
      fix: ["V1", "V2"].flatMap((id, i) => [on("dowel", id, undefined, [0, 1, 0], pts([(i ? 1 : -1) * xv], [yB], [zk + 60, zF - 60])), on("dowel", id, undefined, [0, -1, 0], pts([(i ? 1 : -1) * xv], [yT], [zk + 60, zF - 60]))]),
      wait: ["V1", "V2"],
      tools: ["hammer"],
    },
    { title: "Turn it over and stand the dividers on the bottom", detail: "The plinth goes down onto its feet. Each divider onto its two dowels, front edges forward.", add: ["V1", "V2"], pose: "+y" },
    {
      title: "Lay it on its back and screw the dividers on",
      detail: "Four screws through the bottom, two into each divider, with the Allen key.",
      fix: ["V1", "V2"].map((id, i) => on("bolt", "B", id, [0, 1, 0], pts([(i ? 1 : -1) * xv], [yP], [-60, 60]), { name: "Connector screw", len: 50, dia: 7 })),
      pose: "+z",
      tools: ["allen"],
    },
    { title: "Stand it up and screw cam bolts into the bottom", detail: "Four, at the ends, for the end frames.", fix: [on("camScrew", "B", undefined, [0, 1, 0], pts(xsEnds, [yB], [-D / 2 + 70, D / 2 - 70]), { len: 34 })], pose: "+y" },
    { title: "Tap dowels into the ends of the bottom", detail: "Two at each end, next to the cam bolts.", fix: [on("dowel", "B", undefined, [0, 1, 0], pts(xsEnds, [yB], [-D / 2 + 140, D / 2 - 140]))], tools: ["hammer"] },
    { title: "Lower the end frames on", detail: "Each one onto two dowels and two cam bolts, the grooves facing in.", add: ["L", "R"] },
    { title: "Lock the end frames", detail: "Four low cam locks, two in each frame.", fix: [-1, 1].map((sx) => on("cam", sx < 0 ? "L" : "R", undefined, [sx, 0, 0], pts([sx * xi], [yB + 30], [-D / 2 + 70, D / 2 - 70]), CAM_A)), tools: ["screwdriver"] },
    {
      title: "Screw in the shelf supports",
      detail: "Twelve, four for each shelf, at the same height in every space.",
      fix: [
        on("pin", "L", undefined, [-1, 0, 0], pts([-xi], [ySh - tv / 2], [zk + 50, zF - 70]), { name: "Shelf support" }),
        on("pin", "V1", undefined, [1, 0, 0], pts([-xv - tv / 2], [ySh - tv / 2], [zk + 50, zF - 70]), { name: "Shelf support" }),
        on("pin", "V1", undefined, [-1, 0, 0], pts([-xv + tv / 2], [ySh - tv / 2], [zk + 50, zF - 70]), { name: "Shelf support" }),
        on("pin", "V2", undefined, [1, 0, 0], pts([xv - tv / 2], [ySh - tv / 2], [zk + 50, zF - 70]), { name: "Shelf support" }),
        on("pin", "V2", undefined, [-1, 0, 0], pts([xv + tv / 2], [ySh - tv / 2], [zk + 50, zF - 70]), { name: "Shelf support" }),
        on("pin", "R", undefined, [1, 0, 0], pts([xi], [ySh - tv / 2], [zk + 50, zF - 70]), { name: "Shelf support" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Lay the shelves on the supports", detail: "One in each space, the notches under them over the supports.", add: ["S1", "S2", "S3"], from: { S1: [0, 0, 400], S2: [0, 0, 400], S3: [0, 0, 400] } },
    { title: "Slide the back panel down the grooves", detail: "Smooth side in, cable holes at the top. Down until it meets the bottom.", add: ["P"], from: { P: [0, 500, 0] } },
    {
      title: "Fix the back panel to the dividers",
      detail: "Two fittings into each divider: push the sleeve through the back, then the pin into it.",
      fix: [-1, 1].flatMap((sx) => [on("clip", sx < 0 ? "V1" : "V2", undefined, [0, 0, 1], pts([sx * xv], [yB + 90, yT - 90], [-D / 2]), { name: "Back fitting sleeve" }), on("clip", sx < 0 ? "V1" : "V2", undefined, [0, 0, 1], pts([sx * xv], [yB + 90, yT - 90], [-D / 2 - 2]), { name: "Back fitting pin" })]),
    },
    { title: "Tap dowels into the tops of the end frames", detail: "Two in each.", fix: [-1, 1].map((sx) => on("dowel", sx < 0 ? "L" : "R", undefined, [0, -1, 0], pts([sideX(sx)], [yT], [-D / 2 + 140, D / 2 - 140]))), tools: ["hammer"] },
    {
      title: "Screw cam bolts into the underside of the top",
      detail: "Lay the top right side down on a rug. Eight bolts.",
      fix: [on("camScrew", "T", undefined, [0, -1, 0], [...pts(xsEnds, [yT], [-D / 2 + 70, D / 2 - 70]), ...pts([-xv, xv], [yT], [zk + 120, zF - 120])], { len: 34 })],
      wait: ["T"],
    },
    {
      title: "Screw the push opener holders under the top",
      detail: "One over each door, 22 mm in from the front edge, two short screws each.",
      fix: [on("screw", "T", undefined, [0, 1, 0], pts([-(xi + xv) / 2 - 15, -(xi + xv) / 2 + 15, (xi + xv) / 2 - 15, (xi + xv) / 2 + 15], [yT], [zF - 22]), { len: 12, dia: 3.5 })],
      tools: ["screwdriver"],
    },
    { title: "Click the push openers into the holders", detail: "Push each one in until it clicks. Don't press on the plunger.", fix: [on("connector", "T", undefined, [0, 1, 0], pts([-(xi + xv) / 2, (xi + xv) / 2], [yT], [zF - 22]), { name: "Push opener", len: 60, dia: 16 })] },
    { title: "Lower the top on together", detail: "Two of you, straight down onto the eight dowels. Mind your fingers.", add: ["T"], people: 2 },
    {
      title: "Lock the top",
      detail: "Eight low cam locks: two in each end frame and two in each divider.",
      fix: [
        ...[-1, 1].map((sx) => on("cam", sx < 0 ? "L" : "R", undefined, [sx, 0, 0], pts([sx * xi], [yT - 30], [-D / 2 + 70, D / 2 - 70]), CAM_A)),
        ...[-1, 1].map((sx) => on("cam", sx < 0 ? "V1" : "V2", undefined, [1, 0, 0], pts([sx * xv - tv / 2], [yT - 30], [zk + 120, zF - 120]), CAM_A)),
      ],
      tools: ["screwdriver"],
    },
    { title: "Lock the shelves on their supports", detail: "Turn each of the twelve supports a quarter turn so it grips the shelf.", tools: ["screwdriver"] },
    { title: "Hang the doors", detail: "The hinges are on the doors. Push each one onto its plate in the end frame until it clicks.", add: ["G1", "G2"], fix: [on("hinge", "G1", "L", [0, 0, -1], pts([-xi + 30], [yB + 60, ym, yT - 60], [zF])), on("hinge", "G2", "R", [0, 0, -1], pts([xi - 30], [yB + 60, ym, yT - 60], [zF]))] },
    {
      title: "Screw the hinges to the end frames",
      detail: "Open the doors. Two screws through each hinge plate.",
      fix: [-1, 1].map((sx) => on("screw", sx < 0 ? "L" : "R", undefined, [sx, 0, 0], hingeAt(sx).flatMap(([x, y, z]) => [[x, y - 16, z], [x, y + 16, z]] as Vec3[]), { len: 16, dia: 3.5 })),
      tools: ["screwdriver"],
    },
    {
      title: "Fit the door stop screws",
      detail: "A screw with a washer into the front edge of each divider, for the doors to rest on.",
      fix: [on("washer", "V1", undefined, [0, 0, -1], [[-xv, yT - 40, zF]]), on("washer", "V2", undefined, [0, 0, -1], [[xv, yT - 40, zF]]), on("screw", "V1", undefined, [0, 0, -1], [[-xv, yT - 40, zF]], { len: 12, dia: 3.5 }), on("screw", "V2", undefined, [0, 0, -1], [[xv, yT - 40, zF]], { len: 12, dia: 3.5 })],
      tools: ["screwdriver"],
    },
    { title: "Level it with the feet", detail: "Turn the five feet until the doors line up and the bench stands firm.", tools: [] },
    {
      title: "Fix the wall fittings to the back",
      detail: "Two, on the end frames near the top.",
      fix: [-1, 1].map((sx) => on("bracket", sx < 0 ? "L" : "R", undefined, [0, 0, 1], [[sx * (xi + T / 2), yT - 60, -D / 2]], { name: "Wall fitting", included: true })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw it to the wall",
      detail: "Use the plugs and screws that suit your wall, then turn the knobs to pull it snug.",
      fix: [
        on("plug", "L", undefined, [0, 0, 1], [[-(xi + T / 2), yT - 60, -D / 2 - 40], [xi + T / 2, yT - 60, -D / 2 - 40]], { included: true }),
        on("screw", "L", undefined, [0, 0, -1], [[-(xi + T / 2), yT - 60, -D / 2]], { len: 70, dia: 5, included: true }),
        on("screw", "R", undefined, [0, 0, -1], [[xi + T / 2, yT - 60, -D / 2]], { len: 70, dia: 5, included: true }),
        on("knob", "L", undefined, [0, 0, -1], [[-(xi + T / 2), yT - 60, -D / 2 + 10], [xi + T / 2, yT - 60, -D / 2 + 10]], { name: "Adjuster knob" }),
      ],
      wall: true,
      tools: ["drill"],
    },
    { title: "Press the covers on", detail: "One over each wall fitting.", fix: [on("cap", "L", undefined, [0, 0, -1], [[-(xi + T / 2), yT - 60, -D / 2 + 20], [xi + T / 2, yT - 60, -D / 2 + 20]], { len: 8, dia: 40 })] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["FRYKSÅS", "FRYKSAS"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/armchair|footstool/.test(slug)) return armchair(s);
    if (/storage-unit-on-castors/.test(slug)) return storage(s);
    if (/desk/.test(slug)) return desk(s);
    if (/cabinet/.test(slug)) return cabinet(s);
    if (/tv-bench/.test(slug)) return tvBench(s);
    return null;
  },
};
export default family;
