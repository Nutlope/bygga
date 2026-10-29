import type { Family } from "./family";
import type { PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rotate } from "../math";

/**
 * ENHET, read from its manuals. Two quite different builds share the name.
 *
 * The open frames (base, high, wall and wash-basin frames) are steel: two welded side frames are laid flat on a
 * rug, rails stand up in their corners on plastic end caps, the second side frame goes on top, and the frame is
 * turned upside down and back to press every joint home. The shelf rails then click onto knobs on the side
 * frames, two corner brackets at the back take the wall screws, and the shelves drop in on clips.
 *
 * The white cabinets are boards that click together with no tools: base units and wash-stands go together upside
 * down (back and sides first, then the rails or bottom), wall and tall units lying on their front (sides with
 * their wall brackets, top and bottom, back slid in and locked with expanders). Every one hangs on two or four
 * wall brackets inside the back corners. Doors, drawers and shelves follow, in each manual's order. The fridge
 * cabinet is built the same way but stands on legs, with a half back and a shelf with an air grille.
 */

const T = 20; // steel tube
const KNOB: HwDef = { kind: "pin", len: 14, dia: 12 };
const END_CAP: HwDef = { kind: "connector", len: 20, dia: 24 };
const CLIP: HwDef = { kind: "clip", len: 6, dia: 18 };
const COVER: HwDef = { kind: "cap", len: 6, dia: 46 };
const PEG: HwDef = { kind: "cap", len: 12, dia: 20 };

interface Step {
  title: string;
  detail?: string;
  kind?: StepKind;
  pose?: Pose;
  tools?: ToolId[];
  people?: 1 | 2;
  warnings?: WarnId[];
  wall?: boolean;
  repeat?: number;
  check?: "square";
  scene?: string;
}

/** A step, with "general" as the default kind. */
function step(b: PlanBuilder, st: Step, body: () => void = () => {}) {
  b.step({ kind: "general", ...st }, body);
}

/** Where a part sits when it moves with another one that is staged somewhere else. */
const along = (child: Vec3, parentFinal: Vec3, parentStaged: Vec3, rot: Vec3): Vec3 => {
  const v = rotate([child[0] - parentFinal[0], child[1] - parentFinal[1], child[2] - parentFinal[2]], rot);
  return [parentStaged[0] + v[0], parentStaged[1] + v[1], parentStaged[2] + v[2]];
};

/* ---------------------------------------------------------------- steel frames */

interface FrameOpts {
  leg: number; // posts below the bottom ring
  levels: number[]; // inner rings (y of the rail centre), bottom up
  shelves: ("bottom" | "top" | number)[]; // rings that carry a shelf (number = index into levels)
  clips: number; // shelf clips, spread over the shelves
  lowBrackets: boolean; // corner brackets at the bottom back corners too
  bracketsFirst: boolean; // the wall frame clicks its brackets in before the knobs
  wallAt: "low" | "top"; // where the wall screws go: every bracket, or only the top ones
  topPegs?: number; // the wash-basin frame: pegs on top that locate the basin
  lyingRails?: boolean; // the US manuals press the caps home and click the shelf rails in with it on its back
  shelvesAt?: "beforeWall" | "afterWall" | "end";
  bottomBoard?: number; // the wall shelf frame: a board screwed under it, this deep (mm), sticking out in front
  supports?: number; // the wall shelf frame: supports clipped onto the top rails before the top board
  catches?: number; // the wall shelf frame: catches screwed to the wall under the board
}

/** One corner bracket in the back plane: a plate in the corner and a diagonal strip. sx, sy: which way it points. */
function bracketPieces(cx: number, cy: number, z: number, sx: number, sy: number): PartPiece[] {
  const d = 34;
  return [
    { shape: "box", size: [d, d, 3], pos: [cx + (sx * d) / 2, cy + (sy * d) / 2, z] },
    { shape: "box", size: [96, 16, 3], pos: [cx + sx * 34, cy + sy * 34, z], rot: [0, 0, sx * sy > 0 ? -Math.PI / 4 : Math.PI / 4] },
  ];
}

function buildFrame(b: PlanBuilder, s: ProductSpec, o: FrameOpts) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const xs = (sx: number) => sx * (W / 2 - T / 2);
  const zr = D / 2 - T / 2;
  const yTop = H - T / 2, yBot = o.leg + T / 2;
  const levels = o.levels;

  // the side frames: two posts, a top and bottom rail and a rung at each shelf level, welded in one piece
  const sidePieces = (sx: number): PartPiece[] => [
    { shape: "box", size: [T, H, T], pos: [xs(sx), H / 2, -zr] },
    { shape: "box", size: [T, H, T], pos: [xs(sx), H / 2, zr] },
    ...[yTop, yBot, ...levels].map((y): PartPiece => ({ shape: "box", size: [T, T, D - 2 * T], pos: [xs(sx), y, 0] })),
  ];
  // the two side frames are the same piece of steel, the right one placed mirrored
  const side = b.compound("Side frame", sidePieces(-1), { material: "metal" });
  const L = b.place(side.type, side.mid);
  const R = b.place(side.type, [-side.mid[0], side.mid[1], side.mid[2]]);

  const railT = b.part("Rail", [W - 2 * T, T, T], { material: "metal" });
  const rails = [
    b.place(railT, [0, yTop, -zr]),
    b.place(railT, [0, yBot, -zr]),
    b.place(railT, [0, yBot, zr]),
    b.place(railT, [0, yTop, zr]),
  ];
  const shelfRailT = b.part("Shelf rail", [W - 2 * T, T, T], { material: "metal" });
  const shelfRails = levels.map((y) => [b.place(shelfRailT, [0, y, -zr]), b.place(shelfRailT, [0, y, zr])]);

  // corner brackets in the back plane, at the top (and the bottom) of each back post
  const zb = -zr;
  const xi = W / 2 - T;
  const yHi = H - T, yLo = o.leg + T;
  const brackets: { key: string; at: Vec3; sx: number }[] = [];
  const bracket = (sx: number, low: boolean) => {
    const c = b.compound("Corner bracket", bracketPieces(sx * xi, low ? yLo : yHi, zb, -sx, low ? 1 : -1), { material: "metal" });
    const key = b.place(c.type, c.mid);
    brackets.push({ key, at: [sx * (xi - 24), low ? yLo + 24 : yHi - 24, zb], sx });
    return key;
  };
  const brL = [bracket(-1, false), ...(o.lowBrackets ? [bracket(-1, true)] : [])];
  const brR = [bracket(1, false), ...(o.lowBrackets ? [bracket(1, true)] : [])];

  const shelfT = b.part("Shelf", [W - 2 * T, 8, D - 2 * T]);
  const ringY = (k: "bottom" | "top" | number) => (k === "bottom" ? yBot : k === "top" ? yTop : levels[k]);
  const shelves = o.shelves.map((k) => ({ key: b.place(shelfT, [0, ringY(k) + T / 2 - 4, 0]), y: ringY(k) + T / 2 }));

  // the second side frame lies on the rug behind the first until it goes on top, its inside face up
  const flip: Vec3 = [0, Math.PI, 0];
  const rFinal = b.partItem(R).final.pos;
  const rStaged: Vec3 = [xs(-1), H / 2, rFinal[2] - D - 120];
  const stagedWithR = (key: string) => along(b.partItem(key).final.pos, rFinal, rStaged, flip);

  const knobPts = (sx: number) =>
    levels.flatMap((y) => [-zr, zr].map((z): FitOpts => ({ on: sx < 0 ? L : R, at: [sx * (W / 2 - T), y, z], dir: [sx, 0, 0] })));
  const knobs = () => {
    step(b, {
      title: "Push the shelf knobs into the side frames",
      detail: `${o.bracketsFirst ? "" : "Lay both side frames flat on a rug, inside faces up. "}One knob goes into each end of every middle rung, ${levels.length * 4} in all.`,
      pose: "+x",
      warnings: ["floor"],
    }, () => {
      layOut();
      b.fits(KNOB, knobPts(-1), 0.08);
      b.fits(KNOB, knobPts(1), 0.08);
    });
  };
  let laid = false;
  const layOut = () => {
    if (laid) return;
    laid = true;
    b.add(L, [0, 0, 0]);
    b.stage(R, rStaged, flip);
    b.then(0.1);
  };
  const bracketStep = () => {
    step(b, {
      title: o.lowBrackets ? "Click the corner brackets into the frames" : "Click a corner bracket into each frame",
      detail: (o.bracketsFirst || !levels.length ? "Lay both side frames flat on a rug, inside faces up. " : "") +
        (o.lowBrackets
          ? "One at the top and one at the bottom of each back post: hook it into the slots, then push it along until it clicks."
          : "One at the top of each back post: hook it into the slots, then push it along until it clicks."),
      pose: "+x",
      warnings: ["floor"],
    }, () => {
      layOut();
      b.stagger(0.2);
      for (const k of brL) b.add(k, [80, 0, 0]);
      for (const k of brR) b.stage(k, stagedWithR(k), flip, [80, 0, 0]);
    });
  };
  if (o.bracketsFirst || !levels.length) {
    bracketStep();
    if (levels.length) knobs();
  } else {
    knobs();
    bracketStep();
  }

  // rails stand up in the corners of the frame on the rug, an end cap on each joint
  const capAt = (rail: string, sx: number): FitOpts => {
    const p = b.partItem(rail).final.pos;
    return { on: sx < 0 ? L : R, at: [sx * (W / 2), p[1], p[2]], dir: [-sx, 0, 0], mate: rail };
  };
  step(b, {
    title: "Stand the first rail in its corner",
    detail: "In the corner with the bracket. Slide an end cap over the joint so it holds the rail.",
    pose: "+x",
  }, () => {
    b.add(rails[0], [380, 0, 0]);
    b.then(0.1);
    b.fit(END_CAP, capAt(rails[0], -1));
  });
  step(b, {
    title: "Stand the other three rails up",
    detail: "One in each corner, each with its end cap.",
    pose: "+x",
  }, () => {
    b.stagger(0.25);
    for (const r of rails.slice(1)) b.add(r, [380, 0, 0]);
    b.then(0.1);
    b.fits(END_CAP, rails.slice(1).map((r) => capAt(r, -1)), 0.1);
  });
  step(b, {
    title: "Lay the second side frame on top",
    detail: "Inside face down, knobs in. Guide the rail ends into its corners and the bracket over the rail.",
    pose: "+x",
    people: H > 1200 ? 2 : 1,
    warnings: H > 1200 ? ["two"] : [],
  }, () => {
    b.add(R);
    for (const k of brR) b.add(k);
  });
  step(b, {
    title: "Fit the end caps on top",
    detail: "One over each of the four joints.",
    pose: "+x",
  }, () => {
    b.fits(END_CAP, rails.map((r) => capAt(r, 1)), 0.1);
  });
  if (o.lyingRails) {
    step(b, {
      title: "Lay it on its back and press the caps home",
      detail: "Press each of the eight end caps until it sits flush.",
      pose: "+z",
      kind: "flip",
      warnings: ["floor"],
    });
    if (levels.length)
      step(b, {
        title: "Click the shelf rails onto the knobs",
        detail: "A front and a back rail at each middle rung. Hook them over the knobs and push until they click.",
        pose: "+z",
        kind: "shelves",
      }, () => {
        b.stagger(0.2);
        for (const pair of shelfRails) for (const k of pair) b.add(k, [0, 0, 200]);
      });
    step(b, {
      title: "Stand it up",
      detail: "Lift it upright where it will stand.",
      pose: "+y",
      kind: "standup",
      people: H > 1200 ? 2 : 1,
      warnings: H > 1200 ? ["two"] : [],
    });
  } else {
    step(b, {
      title: "Turn it upside down and press it together",
      detail: "Stand it on its top on two pieces of the packaging. Press down on each corner until the caps sit flush.",
      pose: "-y",
      kind: "flip",
      warnings: ["floor"],
    });
    step(b, {
      title: "Stand it up and press again",
      detail: "Turn it the right way up and press each corner down the same way.",
      pose: "+y",
      kind: "standup",
    });
    if (levels.length)
      step(b, {
        title: levels.length > 1 ? "Click the shelf rails onto the knobs" : "Click the two shelf rails onto the knobs",
        detail: "A front and a back rail at each middle rung. Hook them over the knobs and press down until they click.",
        kind: "shelves",
      }, () => {
        b.stagger(0.2);
        for (const pair of shelfRails) for (const k of pair) b.add(k, [0, 160, 0]);
      });
  }

  // shelves drop in and are held by clips under their edges
  const per = Math.floor(o.clips / shelves.length), extra = o.clips - per * shelves.length;
  const clips: FitOpts[] = [];
  shelves.forEach((sh, i) => {
    const n = per + (i < extra ? 1 : 0);
    const pts: [number, number][] = [[-1, 1], [1, 1], [-1, -1], [1, -1], [0, 1], [0, -1]];
    for (const [px, pz] of pts.slice(0, n)) clips.push({ on: sh.key, at: [px * (W / 2 - T - 40), sh.y, pz * (D / 2 - T - 4)], dir: [0, 0, -pz], hole: false });
  });
  const shelfStep = () => step(b, {
    title: shelves.length > 1 ? "Put the shelves in and clip them" : "Put the shelf in and clip it",
    detail: `Lay each shelf on its ring, then slide the clips over the edge until they click, ${o.clips} in all.`,
    kind: "shelves",
  }, () => {
    b.stagger(0.25);
    for (const sh of shelves) b.add(sh.key, [0, 220, 0]);
    b.then(0.1);
    b.fits(CLIP, clips, 0.06);
  });
  const board = o.bottomBoard ? b.place(b.part("Bottom board", [W, 12, o.bottomBoard]), [0, 6, o.bottomBoard / 2 - D / 2]) : "";
  const beforeWall = () => {
    if (board)
      step(b, {
        title: "Screw the bottom board on",
        detail: "Turn the frame over onto the board, line it up at the back and turn in the four screws by hand.",
        pose: "-y",
        tools: ["screwdriver"],
        kind: "screws",
      }, () => {
        b.add(board, [0, -200, 0]);
        b.then(0.1);
        b.fits(HW.screwS, [-1, 1].flatMap((sx) => [-1, 1].map((sz): FitOpts => ({ on: board, at: [sx * (W / 2 - T - 30), 12 + T, sz * (D / 2 - T / 2)], dir: [0, -1, 0] }))), 0.08);
      });
    if (o.supports)
      step(b, {
        title: "Clip the supports onto the top rails",
        detail: `Turn it the right way up. Push the ${o.supports} supports into the slots along the inside of the top rails.`,
        pose: "+y",
        kind: "standup",
      }, () => b.fits(KNOB, Array.from({ length: o.supports! }, (_, i): FitOpts => {
        const sz = i % 2 ? 1 : -1, k = Math.floor(i / 2), n = Math.ceil(o.supports! / 2);
        return { on: sz < 0 ? rails[0] : rails[3], at: [-W / 2 + T + ((W - 2 * T) * (k + 1)) / (n + 1), yTop, sz * (D / 2 - T)], dir: [0, 0, sz] };
      }), 0.08));
    if (o.shelvesAt === "beforeWall") shelfStep();
  };
  beforeWall();

  // the wall: a screw through the bracket's hole into the wall, after marking and drilling
  const wallBr = o.wallAt === "low" ? brackets : brackets.filter((x) => x.at[1] > H / 2);
  step(b, {
    title: "Screw it to the wall",
    detail: `Mark through the ${wallBr.length > 2 ? "brackets" : "two brackets"} and drill. Wall screws aren't included: pick ones made for your wall.`,
    tools: ["drill", "screwdriver", "pencil", "level"],
    kind: "anchor",
    wall: true,
    warnings: ["wall", "tip"],
  }, () => {
    b.stagger(0.15);
    for (const x of wallBr) b.fit(HW.plug, { at: [x.at[0], x.at[1], -D / 2], dir: [0, 0, -1] });
    b.then(0.1);
    for (const x of wallBr) b.fit(HW.wallScrew, { on: x.key, at: [x.at[0], x.at[1], zb + 2], dir: [0, 0, -1] });
  });
  if (o.shelvesAt === "afterWall") shelfStep();
  step(b, {
    title: "Line it up and tighten",
    detail: "The slots in the brackets let it slide a little. Get it level, then tighten the screws.",
    tools: ["screwdriver", "level"],
    kind: "anchor",
  });
  step(b, {
    title: o.lowBrackets ? "Click the covers onto the brackets" : "Click the two covers onto the brackets",
    detail: "Push each one over its bracket until it clicks.",
  }, () => {
    b.fits(COVER, brackets.map((x) => ({ on: x.key, at: [x.at[0], x.at[1], zb + 2], dir: [0, 0, -1], hole: false })), 0.12);
  });

  if (!o.shelvesAt || o.shelvesAt === "end") shelfStep();
  if (o.catches)
    step(b, {
      title: "Screw the catches to the wall",
      detail: "Under the board at the front corners, so it can't lift off its screws. Wall screws aren't included.",
      tools: ["screwdriver", "drill"],
      kind: "anchor",
      wall: true,
    }, () => {
      const pts = [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 60), -10, -D / 2]);
      b.fits(HW.angle, pts.map((p): FitOpts => ({ at: p, dir: [0, 0, -1], hole: false })), 0.12);
      b.then(0.05);
      b.fits(HW.wallScrew, pts.map((p): FitOpts => ({ at: [p[0], p[1], p[2] + 2], dir: [0, 0, -1] })), 0.12);
    });
  if (o.topPegs)
    step(b, {
      title: "Push the pegs into the top",
      detail: "Into the holes at the top of the front posts. They keep the wash-basin from sliding.",
    }, () => {
      b.fits(PEG, [-1, 1].slice(0, o.topPegs).map((sx): FitOpts => ({ on: sx < 0 ? L : R, at: [xs(sx), H, zr], dir: [0, -1, 0] })), 0.1);
    });
  return { W, H, D, L, R };
}

/* ---------------------------------------------------------------- board cabinets */

const PT = 16; // panels
const BT = 8; // the back, a board that clicks in
const FT = 18; // doors and drawer fronts
const BRACKET_SCREW: HwDef = { kind: "screw", len: 13, dia: 4 };
const EXPANDER: HwDef = { kind: "connector", len: 20, dia: 12 };
const JOINER: HwDef = { kind: "stud", len: 30, dia: 7 };
const ROD: HwDef = { kind: "clamp", len: 60, dia: 8 };
const SUPPORT: HwDef = { kind: "pin", len: 16, dia: 5 };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 10 };
const BR_COVER: HwDef = { kind: "cap", len: 4, dia: 40 };
const HANG_CLIP: HwDef = { kind: "clip", len: 12, dia: 16 };
const SPACER: HwDef = { kind: "washer", len: 10, dia: 20 };
const DRAWER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };

type Bottom = "panel" | "strip" | "strips" | "drawers";

interface CabOpts {
  how: "upside" | "lying"; // base units go together upside down, wall and tall ones lying on their front
  bottom?: Bottom; // upside-down units: what closes the bottom
  fixedShelf?: boolean; // tall units: a shelf in the middle that clicks in like the top
  brackets: 2 | 4; // wall brackets screwed inside the top (and bottom) back corners
  expanders: number; // plastic expanders and pins that lock the back (or the bottom) in
  hangClips?: number; // lying units: clips on the back edge that steady them on the wall
  spacers?: boolean; // the wall screws go through spacer sleeves
  doors: number; // doors in the box (0 when they're sold separately)
  mirror?: boolean;
  hinges?: number; // per door
  bumpers: number;
  shelves: number;
  supports: number;
  drawers: number; // drawer boxes
  fronts?: boolean; // the drawers come with fronts
  runnersFirst?: boolean; // runners go on the sides before the box is built
  shelfStrip?: boolean; // wash-stands: a shelf with a strip along its back, round the pipes
  rods?: "early" | "late"; // two steel rods into the sides, before the front rail or after the bottom
  angles?: "before" | "after"; // angle brackets at the top front, before or after the top rail
  wallRail?: boolean; // the US wall cabinet: a rail on dowels under the top, clicked in between top and bottom
}

function buildCabinet(b: PlanBuilder, s: ProductSpec, o: CabOpts) {
  const W = s.size.w * 10, H = s.size.h * 10;
  const hasFront = o.doors > 0 || (o.drawers > 0 && !!o.fronts);
  const D = s.size.d * 10 - (hasFront ? FT : 0);
  const up = o.how === "upside";
  const xi = W / 2 - PT; // inside face of a side
  const iw = W - 2 * PT;

  const sideT = b.part("Side panel", [PT, H, D]);
  const sideL = b.place(sideT, [-W / 2 + PT / 2, H / 2, 0]);
  const sideR = b.place(sideT, [W / 2 - PT / 2, H / 2, 0]);

  // the back: full height between the sides on a base unit, in grooves between top and bottom on the others
  const backH = up ? H : H - 2 * PT;
  const backZ = up ? -D / 2 + BT / 2 : -D / 2 + 8 + BT / 2;
  const back = b.place(b.part("Back panel", [iw, backH, BT]), [0, H / 2, backZ]);
  const inD = D / 2 - (backZ + BT / 2); // depth in front of the back

  let top: string | undefined, bottom: string | undefined, mid: string | undefined;
  const strips: string[] = [];
  let backStrip: string | undefined;
  let railTop: string | undefined;
  let wallRail: string | undefined;
  if (up) {
    const front = 80;
    if (o.bottom === "panel") {
      strips.push(b.place(b.part("Front rail", [iw, PT, front]), [0, PT / 2, D / 2 - front / 2]));
      bottom = b.place(b.part("Bottom panel", [iw, PT, inD - front]), [0, PT / 2, D / 2 - front - (inD - front) / 2]);
    } else if (o.bottom === "drawers") {
      bottom = b.place(b.part("Bottom panel", [iw, PT, inD]), [0, PT / 2, D / 2 - inD / 2]);
    } else {
      strips.push(b.place(b.part("Front rail", [iw, PT, front]), [0, PT / 2, D / 2 - front / 2]));
      if (o.bottom === "strips") backStrip = b.place(b.part("Back rail", [iw, 90, PT]), [0, PT + 4 + 45, D / 2 - inD + PT / 2 + 40]); // sits on the rods
    }
    railTop = b.place(b.part("Top rail", [iw, 30, 20], { material: "metal" }), [0, H - 15, D / 2 - 30]);
  } else {
    const panelT = b.part("Top and bottom panel", [iw, PT, D]);
    top = b.place(panelT, [0, H - PT / 2, 0]);
    bottom = b.place(panelT, [0, PT / 2, 0]);
    if (o.fixedShelf) mid = b.place(b.part("Fixed shelf", [iw, PT, inD]), [0, Math.round(H / 2), D / 2 - inD / 2]);
    if (o.wallRail) wallRail = b.place(b.part("Wall rail", [iw, 60, PT]), [0, H - PT - 30, backZ + BT / 2 + PT / 2]);
  }

  // wall brackets inside the top back corners (and the bottom ones on tall units)
  const brT = b.part("Wall bracket", [44, 56, 30], { material: "metal" });
  const brZ = backZ + BT / 2 + 15;
  const brPos: Vec3[] = [-1, 1].flatMap((sx) => {
    const x = sx * (xi - 22);
    const yTop = H - (up ? 0 : PT) - 34;
    return o.brackets === 4 ? [[x, yTop, brZ] as Vec3, [x, (up ? 0 : PT) + 34, brZ] as Vec3] : [[x, yTop, brZ] as Vec3];
  });
  const brackets = brPos.map((p) => ({ key: b.place(brT, p), at: p, side: p[0] < 0 ? sideL : sideR }));
  const rFinal = b.partItem(sideR).final.pos;
  const rStaged: Vec3 = [rFinal[0] + 260, rFinal[1], rFinal[2]];
  const bracketScrews = (list: typeof brackets): FitOpts[] =>
    list.flatMap((br) => [-14, 14].map((dz): FitOpts => {
      const sx = br.at[0] < 0 ? -1 : 1;
      return { on: br.key, at: [sx * (xi - 4), br.at[1], br.at[2] + dz], dir: [sx, 0, 0], mate: br.side };
    }));

  // shelves on supports, drawers on runners
  const shelfY = (i: number) => Math.round((H * (i + 1)) / (o.shelves + 1));
  const shelfYs = mid ? spreadAround(H, o.shelves, PT) : Array.from({ length: o.shelves }, (_, i) => shelfY(i));
  const shelfT = o.shelves ? b.part("Shelf", [iw - 2, PT, inD - 20]) : "";
  const shelves = shelfYs.map((y) => ({ key: b.place(shelfT, [0, y, D / 2 - (inD - 20) / 2 - 10]), y }));
  let shelfStrip: string | undefined;
  if (o.shelfStrip && shelves.length) shelfStrip = b.place(b.part("Shelf back rail", [iw - 2, 70, PT]), [0, shelves[0].y + PT / 2 + 35, D / 2 - inD + 10 - PT / 2 + 0.01]);

  const drawers: { key: string; y: number; h: number; front?: string }[] = [];
  if (o.drawers) {
    const y0 = up ? PT + 4 : PT + 4, y1 = H - (up ? 40 : PT + 4);
    const hh = (y1 - y0) / o.drawers;
    const dw = iw - 26, dd = inD - 30;
    for (let i = 0; i < o.drawers; i++) {
      const h = hh - 14;
      const yb = y0 + i * hh;
      const z0 = D / 2 - dd;
      const pieces: PartPiece[] = [
        { shape: "box", size: [dw, 10, dd], pos: [0, yb + 5, z0 + dd / 2] },
        { shape: "box", size: [12, h - 10, dd], pos: [-dw / 2 + 6, yb + h / 2 + 5, z0 + dd / 2], material: "metal" },
        { shape: "box", size: [12, h - 10, dd], pos: [dw / 2 - 6, yb + h / 2 + 5, z0 + dd / 2], material: "metal" },
        { shape: "box", size: [dw - 24, h - 10, 12], pos: [0, yb + h / 2 + 5, z0 + 6] },
        { shape: "box", size: [dw - 24, h - 10, 12], pos: [0, yb + h / 2 + 5, D / 2 - 6] },
      ];
      if (o.fronts) pieces.push({ shape: "box", size: [W - 4, hh - 4, FT], pos: [0, y0 + i * hh + (hh - 4) / 2, D / 2 + FT / 2] });
      const c = b.compound("Drawer", pieces);
      drawers.push({ key: b.place(c.type, c.mid), y: yb, h });
    }
  }

  const doorW = o.doors === 2 ? W / 2 - 3 : W - 4;
  const doorH = H - 4;
  const doorT = o.doors ? b.part(o.mirror ? "Mirror door" : "Door", [doorW, doorH, FT]) : "";
  const doors = Array.from({ length: o.doors }, (_, i) => b.place(doorT, [o.doors === 2 ? (i ? 1 : -1) * (W / 4) : 0, H / 2, D / 2 + FT / 2]));

  /* ---- steps */
  let pendingRunnersR: { runners: FitOpts[]; screws: FitOpts[] } | null = null;
  const runnerY = (d: { y: number }) => d.y + 24;
  const runnerFits = (sides: ("L" | "R")[]): { runners: FitOpts[]; screws: FitOpts[] } => {
    const runners: FitOpts[] = [], screws: FitOpts[] = [];
    for (const d of drawers)
      for (const sd of sides) {
        const sx = sd === "L" ? -1 : 1, on = sd === "L" ? sideL : sideR;
        const zc = D / 2 - inD / 2;
        runners.push({ on, at: [sx * xi, runnerY(d), zc], dir: [sx, 0, 0], hole: false });
        for (const z of [-inD / 3, inD / 3]) screws.push({ on, at: [sx * (xi - 6), runnerY(d), zc + z], dir: [sx, 0, 0], hole: false });
      }
    return { runners, screws };
  };
  const RUNNER: HwDef = { kind: "runner", len: Math.round(inD - 40), dia: 40 };

  if (up) {
    if (o.runnersFirst && drawers.length)
      step(b, {
        title: "Screw the runners to the sides",
        detail: "Lay both sides on a rug, inside up. Each runner sits on its marks, front end to the front edge, two screws each.",
        pose: "+x",
        tools: ["screwdriver"],
        kind: "runners",
        warnings: ["floor"],
      }, () => {
        b.add(sideL);
        b.then(0.1);
        const f = runnerFits(["L", "R"]);
        b.fits(RUNNER, f.runners.filter((r) => r.on === sideL), 0.15);
        b.fits(DRAWER_SCREW, f.screws.filter((r) => r.on === sideL), 0.05);
        // the other side's runners go on the same way: shown on it when it's added
        pendingRunnersR = { runners: f.runners.filter((r) => r.on === sideR), screws: f.screws.filter((r) => r.on === sideR) };
      });
    step(b, {
      title: "Click the back onto a side",
      detail: "Upside down on a rug: stand the side and the back on their top edges. Push the back's hooks into the side's slots and press down until it clicks.",
      pose: "-y",
      warnings: ["floor"],
    }, () => {
      if (!b.partItem(sideL).states.length) b.add(sideL, [-220, 0, 0]);
      b.add(back, [0, 0, -220]);
    });
    step(b, {
      title: "Click the other side on",
      detail: "The same way at the other end of the back. Upside down, the top edges stand on the rug.",
      pose: "-y",
    }, () => {
      b.add(sideR, [220, 0, 0]);
      if (pendingRunnersR) {
        b.then(0.05);
        b.fits(RUNNER, pendingRunnersR.runners, 0.15);
        b.fits(DRAWER_SCREW, pendingRunnersR.screws, 0.05);
      }
    });
    if (o.rods === "early") {
      step(b, {
        title: "Push the two rods into the sides",
        detail: "Into the slots at the bottom edge, one in each side, then press them down into place.",
        pose: "-y",
      }, () => {
        b.fits(ROD, [-1, 1].map((sx): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * xi, PT, -D / 2 + 60], dir: [sx, 0, 0] })), 0.15);
      });
    }
    if (o.bottom === "panel" || o.bottom === "strip" || o.bottom === "strips") {
      step(b, {
        title: "Click the front rail in",
        detail: "Across the bottom at the front: hook its ends into the sides and press until each end clicks.",
        pose: "-y",
        kind: "join",
      }, () => {
        b.add(strips[0], [0, -200, 0]);
      });
    }
    if (o.bottom === "panel" || o.bottom === "drawers") {
      step(b, {
        title: "Slide the bottom panel in",
        detail: o.bottom === "panel"
          ? "Push it in from the back until it meets the front rail."
          : "Lay it on and press until the four hooks click.",
        pose: "-y",
      }, () => {
        b.add(bottom!, [0, o.bottom === "panel" ? 0 : -200, o.bottom === "panel" ? -300 : 0]);
      });
    }
    if (o.rods === "late") {
      step(b, {
        title: "Push the two rods into the sides",
        detail: "Into the slots at the back, one in each side, then press them down into place.",
        pose: "-y",
      }, () => {
        b.fits(ROD, [-1, 1].map((sx): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * xi, PT + 40, -D / 2 + 60], dir: [sx, 0, 0] })), 0.15);
      });
    }
    if (o.bottom === "panel") {
      const pts: FitOpts[] = [];
      for (const sx of [-1, 1])
        for (const z of [-D / 2 + 60, -D / 2 + inD * 0.55]) pts.push({ on: bottom!, at: [sx * (xi - 30), 0, z], dir: [0, 1, 0], mate: sideL });
      for (const sx of [-1, 1]) for (const dx of [0.25, 0.42]) pts.push({ on: strips[0], at: [sx * iw * dx, 0, D / 2 - 40], dir: [0, 1, 0] });
      step(b, {
        title: "Lock the bottom with the expanders",
        detail: `Push an expander into each hole, then press a pin into it to spread it, ${o.expanders} in all.`,
        pose: "-y",
      }, () => b.fits(EXPANDER, pts.slice(0, o.expanders), 0.08));
    }
    step(b, {
      title: "Turn it the right way up",
      detail: "It now stands on its bottom with the open top up.",
      pose: "+y",
      kind: "standup",
    });
    if (o.bottom === "strips" && backStrip) {
      step(b, {
        title: "Fit the back rail low at the back",
        detail: "Turn the two connecting screws into the rods at the bottom of the sides, then slide the rail down onto them.",
        tools: ["screwdriver"],
      }, () => {
        const bs = b.partItem(backStrip!).final.pos;
        // they stand up out of the rods in the bottom edges, and the rail drops onto them
        b.fits(HW.camScrew, [-1, 1].map((sx): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * (iw / 2 - 30), bs[1] - 45, bs[2]], dir: [0, -1, 0] })), 0.12);
        b.then(0.1);
        b.add(backStrip!, [0, 260, 0]);
      });
      step(b, {
        title: "Lock the back rail",
        detail: "Turn the two cam locks clockwise until they grip.",
        tools: ["screwdriver"],
        kind: "cams",
      }, () => {
        const bs = b.partItem(backStrip!).final.pos;
        b.fits(HW.cam, [-1, 1].map((sx): FitOpts => ({ on: backStrip!, at: [sx * (iw / 2 - 30), bs[1], bs[2] + PT / 2], dir: [0, 0, -1] })), 0.12);
      });
    }
    step(b, {
      title: "Screw the wall brackets in",
      detail: "Inside the top back corners, two screws each. They take the cabinet's weight on the wall.",
      tools: ["screwdriver"],
      kind: "screws",
    }, () => {
      b.stagger(0.2);
      for (const br of brackets) b.add(br.key, [0, 0, 120]);
      b.then(0.1);
      b.fits(BRACKET_SCREW, bracketScrews(brackets), 0.06);
    });
    if (o.angles === "before") angleStep();
    step(b, {
      title: "Hook the top rail in",
      detail: "Across the top at the front. Hook one end into its side, then swing the other end down until it clicks.",
      kind: "join",
    }, () => b.add(railTop!, [0, 220, 0]));
    step(b, {
      title: "Fit the two connecting screws",
      detail: "Into the front holes near the top of the sides. They join it to the cabinet next to it.",
      tools: ["screwdriver"],
    }, () => b.fits(JOINER, [-1, 1].map((sx): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * (W / 2), H - 60, D / 2 - 40], dir: [-sx, 0, 0] })), 0.12));
    if (o.angles === "after") angleStep();
  } else {
    step(b, {
      title: o.brackets === 4 ? "Screw the wall brackets to the sides" : "Screw a wall bracket to each side",
      detail: `Lay both sides on a rug, inside up. Each bracket goes in the ${o.brackets === 4 ? "corners at the back" : "top back corner"}, two screws each.`,
      pose: "-z",
      tools: ["screwdriver"],
      kind: "screws",
      warnings: ["floor"],
    }, () => {
      b.add(sideL);
      b.stage(sideR, rStaged, [0, 0, 0]);
      b.then(0.1);
      b.stagger(0.2);
      for (const br of brackets) {
        if (br.side === sideL) b.add(br.key, [0, 0, 120]);
        else b.stage(br.key, along(br.at, rFinal, rStaged, [0, 0, 0]), [0, 0, 0], [0, 0, 120]);
      }
      b.then(0.1);
      b.fits(BRACKET_SCREW, bracketScrews(brackets), 0.05);
    });
    if (wallRail) {
      step(b, {
        title: "Click the top onto one side",
        detail: "Hook it into the side's slots and press until it clicks.",
        pose: "-z",
        kind: "join",
      }, () => b.add(top!, [0, 200, 0]));
      step(b, {
        title: "Tap the dowels into the rail",
        detail: "Two in each end.",
        pose: "-z",
        tools: ["hammer"],
        kind: "dowels",
      }, () => {
        const p = b.partItem(wallRail!).final.pos;
        b.fits(HW.dowel, [-1, 1].flatMap((sx) => [-15, 15].map((dy): FitOpts => ({ on: wallRail!, at: [sx * (iw / 2), p[1] + dy, p[2]], dir: [-sx, 0, 0] }))), 0.1);
      });
      step(b, {
        title: "Fit the rail under the top",
        detail: "Push its dowels into the side, at the back under the top.",
        pose: "-z",
        kind: "join",
      }, () => b.add(wallRail!, [200, 0, 0]));
      step(b, {
        title: "Click the bottom onto the side",
        detail: "Hook it into the slots and press until it clicks.",
        pose: "-z",
        kind: "join",
      }, () => b.add(bottom!, [0, -200, 0]));
    } else
      step(b, {
        title: "Click the top and bottom onto one side",
        detail: "Hook each panel into the side's slots and press until it clicks.",
        pose: "-z",
        kind: "join",
      }, () => {
        b.add(top!, [0, 200, 0]);
        b.add(bottom!, [0, -200, 0]);
      });
    if (mid)
      step(b, {
        title: "Click the fixed shelf in",
        detail: "Into the slots halfway up the same side.",
        pose: "-z",
        kind: "join",
      }, () => b.add(mid!, [260, 0, 0]));
    step(b, {
      title: "Click the other side on",
      detail: "Line up every hook with its slot, then press along the edge until they all click.",
      pose: "-z",
      kind: "join",
    }, () => {
      b.add(sideR);
      for (const br of brackets) if (br.side === sideR) b.add(br.key);
    });
    step(b, {
      title: "Slide the back panel in",
      detail: "Into the grooves from the open end, all the way, so it's flush.",
      pose: "-z",
    }, () => b.add(back, [0, H + 100, 0]));
    const ex: FitOpts[] = [];
    const perSide = Math.round(o.expanders / 2);
    for (const sx of [-1, 1])
      for (let i = 0; i < perSide; i++) {
        const y = PT + 40 + ((H - 2 * PT - 80) * i) / Math.max(1, perSide - 1);
        ex.push({ on: back, at: [sx * (iw / 2 - 20), y, -D / 2], dir: [0, 0, 1], mate: sx < 0 ? sideL : sideR });
      }
    step(b, {
      title: "Lock the back with the expanders",
      detail: `Push an expander into each hole along the back's edges, then press a pin into it, ${o.expanders} in all.`,
      pose: "-z",
    }, () => b.fits(EXPANDER, ex, 0.06));
    if (o.hangClips)
      step(b, {
        title: "Push the clips onto the back edge",
        detail: "They steady the cabinet against the wall.",
        pose: "-z",
      }, () => b.fits(HANG_CLIP, Array.from({ length: o.hangClips! }, (_, i): FitOpts => {
        const sx = i % 2 ? 1 : -1, low = i >= 2;
        return { on: low ? bottom! : top!, at: [sx * (iw / 2 - 40), low ? PT / 2 : H - PT / 2, -D / 2], dir: [0, 0, 1], hole: false };
      }), 0.1));
    step(b, {
      title: "Stand it up",
      detail: "Lift it upright onto its bottom.",
      pose: "+y",
      kind: "standup",
      people: H > 1500 ? 2 : 1,
      warnings: H > 1500 ? ["two"] : [],
    });
  }

  // the wall: screws into the wall where the brackets hang, then the brackets pull it in and level it
  const wallBr = brackets;
  step(b, {
    title: up ? "Screw it to the wall" : "Hang it on the wall",
    detail: `Mark the ${wallBr.length} bracket positions with a level and drill. Wall screws aren't included: pick ones made for your wall.`,
    tools: ["drill", "screwdriver", "pencil", "level"],
    kind: "anchor",
    wall: true,
    people: !up && H > 1500 ? 2 : 1,
    warnings: ["wall", "tip"],
  }, () => {
    b.stagger(0.15);
    for (const x of wallBr) b.fit(HW.plug, { at: [x.at[0], x.at[1], -D / 2 - 2], dir: [0, 0, -1] });
    b.then(0.1);
    if (o.spacers) {
      for (const x of wallBr) b.fit(SPACER, { at: [x.at[0], x.at[1], -D / 2 + 6], dir: [0, 0, -1], hole: false });
      b.then(0.1);
    }
    for (const x of wallBr) b.fit(HW.wallScrew, { on: x.key, at: [x.at[0], x.at[1], x.at[2]], dir: [0, 0, -1] });
  });
  step(b, {
    title: "Level it with the bracket screws",
    detail: "Turn the screws in the brackets to raise it and pull it against the wall.",
    tools: ["screwdriver", "level"],
    kind: "anchor",
  });
  step(b, {
    title: "Click the covers onto the brackets",
    detail: "Push each one over its bracket until it clicks.",
  }, () => b.fits(BR_COVER, brackets.map((br): FitOpts => ({ on: br.key, at: [br.at[0], br.at[1], br.at[2] + 15], dir: [0, 0, -1], hole: false })), 0.12));

  if (o.shelfStrip && shelves.length && shelfStrip) {
    step(b, {
      title: "Fit the rail to the back of the shelf",
      detail: "Two connecting screws in the shelf, the rail slid on, then the cam locks turned to grip.",
      tools: ["screwdriver"],
      kind: "cams",
      scene: "shelf",
      warnings: ["floor"],
    }, () => {
      const sp = b.partItem(shelves[0].key).final.pos, rp = b.partItem(shelfStrip!).final.pos;
      const lift: Vec3 = [0, PT / 2 - sp[1], 0];
      b.stage(shelves[0].key, [0, PT / 2, 0], [0, 0, 0], [0, 160, 0]);
      b.stage(shelfStrip!, [rp[0] - sp[0], rp[1] + lift[1], rp[2] - sp[2]], [0, 0, 0], [0, 160, 0]);
    });
  }
  // a wash-stand's shelf goes in before its door, the wall cabinets' after
  if (o.doors && !o.shelfStrip) doorSteps(b, o, doors, W, H, D, doorW);
  if (o.supports && shelves.length) {
    const sp: FitOpts[] = [];
    const k = Math.max(2, Math.round(o.supports / (2 * shelves.length)));
    const zs = Array.from({ length: k }, (_, i) => -inD / 2 + 30 + ((inD - 70) * i) / (k - 1));
    for (const sh of shelves)
      for (const sx of [-1, 1])
        for (const z of zs) sp.push({ on: sx < 0 ? sideL : sideR, at: [sx * xi, sh.y - PT / 2 - 3, D / 2 - inD / 2 + z], dir: [sx, 0, 0] });
    step(b, {
      title: shelves.length > 1 ? "Put the shelves in" : "Put the shelf in",
      detail: `Screw the shelf supports into the holes at the height you want, ${o.supports} in all, then lay the shelf on and press it down until it clicks.`,
      kind: "shelves",
      tools: ["screwdriver"],
    }, () => {
      b.fits(SUPPORT, sp.slice(0, o.supports), 0.06);
      b.then(0.1);
      b.stagger(0.25);
      for (const sh of shelves) b.add(sh.key, [0, 0, 320]);
      if (shelfStrip) b.add(shelfStrip, [0, 0, 320]);
    });
  }
  if (o.doors && o.shelfStrip) doorSteps(b, o, doors, W, H, D, doorW);
  if (drawers.length) drawerSteps(b, o, drawers, W, inD, runnerFits, RUNNER, !!o.runnersFirst);

  function angleStep() {
    step(b, {
      title: "Screw the angle brackets in",
      detail: "One in each top front corner. They hold the worktop or the wash-basin later.",
      tools: ["screwdriver"],
      kind: "screws",
    }, () => {
      b.fits(HW.angle, [-1, 1].map((sx): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * xi, H - 30, D / 2 - 60], dir: [sx, 0, 0], hole: false })), 0.12);
      b.then(0.05);
      b.fits(BRACKET_SCREW, [-1, 1].map((sx): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * (xi - 3), H - 30, D / 2 - 60], dir: [sx, 0, 0] })), 0.12);
    });
  }
}

/** Tall units with a fixed shelf in the middle: the loose shelves spread over the two halves. */
function spreadAround(H: number, n: number, t: number) {
  const half = n > 1 ? Math.ceil(n / 2) : 1;
  const lower = Array.from({ length: n - (n > 1 ? half : 0) }, (_, i) => Math.round(t + ((H / 2 - t) * (i + 1)) / (n - half + 1)));
  const upper = Array.from({ length: n > 1 ? half : n }, (_, i) => Math.round(H / 2 + ((H / 2 - t) * (i + 1)) / (half + 1)));
  return [...lower, ...upper];
}

/** Hinges onto the doors on the floor, the doors clicked onto their plates, and the bumpers. */
function doorSteps(b: PlanBuilder, o: CabOpts, doors: string[], W: number, H: number, D: number, doorW: number) {
  const n = doors.length;
  const per = o.hinges ?? 2;
  const ys = Array.from({ length: per }, (_, i) => (per === 1 ? H / 2 : 110 + (i * (H - 220)) / (per - 1)));
  const hingeX = (i: number) => (n === 2 && i === 1 ? 1 : -1);
  const tall = H > 1500;
  step(b, {
    title: n > 1 ? "Screw the hinges onto the doors" : "Screw the hinges onto the door",
    detail: `Lay ${n > 1 ? "the doors" : "the door"} face down on the rug. Press each hinge into its hole and turn in its two screws, ${per * n} hinges in all.`,
    tools: ["screwdriver"],
    scene: "doors",
    kind: "hinges",
    warnings: ["floor"],
  }, () => {
    b.stagger(0.2);
    doors.forEach((d, i) => b.stage(d, [(i - (n - 1) / 2) * (doorW + 80), FT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]));
    b.then(0.1);
    const hinges: FitOpts[] = [];
    doors.forEach((d, i) => {
      const sx = hingeX(i);
      const x = n === 2 ? (i ? 1 : -1) * (W / 4) + sx * (doorW / 2 - 22) : sx * (W / 2 - 24);
      for (const y of ys) hinges.push({ on: d, at: [x, y, D / 2], dir: [0, 0, 1], twist: sx > 0 ? Math.PI : 0 });
    });
    b.fits(HW.hinge, hinges, 0.1);
  });
  step(b, {
    title: n > 1 ? "Hang the doors" : "Hang the door",
    detail: "Hold it against the cabinet and push each hinge onto its plate until it clicks.",
    kind: "doors",
    people: tall || n === 1 ? 2 : 1,
    warnings: tall || n === 1 ? ["two"] : [],
  }, () => {
    b.stagger(0.35);
    for (const d of doors) b.add(d, [0, 0, 380]);
  });
  step(b, {
    title: n > 1 ? "Line up the doors" : "Line up the door",
    detail: "Turn the hinge screws a little until the gaps look even.",
    tools: ["screwdriver"],
    kind: "doors",
  });
  if (o.bumpers)
    step(b, {
      title: "Stick the bumpers on",
      detail: `Inside ${n > 1 ? "each door" : "the door"}, on the opening side, ${o.bumpers} in all. They stop it banging shut.`,
    }, () => {
      const pts: FitOpts[] = [];
      doors.forEach((d, i) => {
        const p = b.partItem(d).final.pos;
        const sx = -hingeX(i);
        for (const y of [80, H - 80]) pts.push({ on: d, at: [p[0] + sx * (doorW / 2 - 20), y, D / 2], dir: [0, 0, 1], hole: false });
      });
      b.fits(BUMPER, pts.slice(0, o.bumpers), 0.1);
    });
}

/** Drawer boxes built on the floor, the runners on the sides (unless they went on first), then each drawer slid in. */
function drawerSteps(
  b: PlanBuilder,
  o: CabOpts,
  drawers: { key: string; y: number; h: number }[],
  W: number,
  inD: number,
  runnerFits: (sides: ("L" | "R")[]) => { runners: FitOpts[]; screws: FitOpts[] },
  RUNNER: HwDef,
  runnersDone: boolean,
) {
  const n = drawers.length;
  step(b, {
    title: n > 1 ? "Build the drawers" : "Build the drawer",
    detail: o.fronts
      ? "Click the sides onto the bottom, slide the back down between them, then fix the front with its connecting screws and cam locks."
      : "Click the sides onto the back, slide the bottom in, then click the inner front on.",
    scene: "drawers",
    repeat: n > 1 ? n : undefined,
    warnings: ["floor"],
  }, () => {
    b.stagger(0.3);
    drawers.forEach((d, i) => {
      const ref = b.partItem(d.key).ref;
      const size = b.parts.find((p) => p.id === ref)!.size;
      b.stage(d.key, [(i - (n - 1) / 2) * (W + 60), size[1] / 2, 0], [0, 0, 0], [0, 160, 0]);
    });
  });
  if (!runnersDone) {
    const f = runnerFits(["L", "R"]);
    step(b, {
      title: "Screw the runners to the sides",
      detail: `One pair for each drawer, front end to the front edge, ${f.screws.length} screws in all.`,
      tools: ["screwdriver"],
      kind: "runners",
    }, () => {
      b.fits(RUNNER, f.runners, 0.12);
      b.then(0.05);
      b.fits(DRAWER_SCREW, f.screws, 0.04);
    });
  }
  step(b, {
    title: n > 1 ? "Slide the drawers in" : "Slide the drawer in",
    detail: "Pull the runners out, set the drawer on them and push it in until it clicks. Start with the bottom one.",
    kind: "drawer",
  }, () => {
    b.stagger(0.4);
    for (const d of drawers) b.add(d.key, [0, 0, inD + 80]);
  });
}

/* ---------------------------------------------------------------- the fridge/freezer cabinet */

const LEG_H = 125; // the manual sets each leg to 125 mm under the cabinet
const LOCK: HwDef = { kind: "clip", len: 40, dia: 10, name: "Bottom lock" };
const LEG_BOLT: HwDef = { kind: "screw", len: 12, dia: 6 };
const LEG_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const LEG_COVER: HwDef = { kind: "cap", len: 70, dia: 40, name: "Leg cover" };
const HANG_PLATE: HwDef = { kind: "plate", len: 8, dia: 40, name: "Hanging plate" };
const HINGE_PLATE: HwDef = { kind: "plate", len: 10, dia: 36, name: "Mounting plate" };
const GRILLE_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const SHELF_SUPPORT: HwDef = { kind: "pin", len: 14, dia: 12, name: "Shelf support" };

/**
 * The tall cabinet a fridge/freezer is built into, read from its two manuals (the same steps; the newer one has a
 * different grille). It goes together lying on its front like the other tall ENHET units, but the bottom sits
 * raised on four legs screwed inside the sides, the top has a cut-out at the back for air, and the back only
 * closes the upper half, down to a rail. The hinges come in the box for doors sold separately; the shelf with
 * its grille goes in over the fridge, at the height the fridge's own instructions give.
 */
function buildFridge(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const y0 = LEG_H; // underside of the sides
  const xi = W / 2 - PT, iw = W - 2 * PT;
  const lift = 80; // the bottom stands this far up the sides, over the leg plates
  const yBot = y0 + lift + PT / 2;
  const backZ = -D / 2 + 8 + BT / 2;
  const yRail = y0 + Math.round(H * 0.48);
  const railH = 90;

  const sideT = b.part("Side panel", [PT, H, D]);
  const sideL = b.place(sideT, [-W / 2 + PT / 2, y0 + H / 2, 0]);
  const sideR = b.place(sideT, [W / 2 - PT / 2, y0 + H / 2, 0]);
  const bottom = b.place(b.part("Bottom panel", [iw, PT, D]), [0, yBot, 0]);
  // the top: open at the back between two corner tabs, so warm air from the fridge can rise
  const cut = 70;
  const yTop = y0 + H - PT / 2;
  const topC = b.compound("Top panel", [
    { shape: "box", size: [iw, PT, D - cut], pos: [0, yTop, cut / 2] },
    { shape: "box", size: [90, PT, cut], pos: [-iw / 2 + 45, yTop, -D / 2 + cut / 2] },
    { shape: "box", size: [90, PT, cut], pos: [iw / 2 - 45, yTop, -D / 2 + cut / 2] },
  ]);
  const top = b.place(topC.type, topC.mid);
  const rail = b.place(b.part("Back rail", [iw, railH, PT]), [0, yRail, backZ]);
  const backLo = yRail + railH / 2, backHi = y0 + H - PT;
  const back = b.place(b.part("Back panel", [iw, backHi - backLo, BT]), [0, (backLo + backHi) / 2, backZ]);

  // wall brackets inside the back corners, over the bottom and under the top
  const brT = b.part("Wall bracket", [44, 56, 30], { material: "metal" });
  const brZ = backZ + BT / 2 + 15;
  const brPos: Vec3[] = [-1, 1].flatMap((sx) => [[sx * (xi - 22), y0 + H - PT - 34, brZ] as Vec3, [sx * (xi - 22), yBot + PT / 2 + 34, brZ] as Vec3]);
  const brackets = brPos.map((p) => ({ key: b.place(brT, p), at: p, side: p[0] < 0 ? sideL : sideR }));
  const rFinal = b.partItem(sideR).final.pos;
  const rStaged: Vec3 = [rFinal[0] + 260, rFinal[1], rFinal[2]];
  const bracketScrews: FitOpts[] = brackets.flatMap((br) => [-14, 14].map((dz): FitOpts => {
    const sx = br.at[0] < 0 ? -1 : 1;
    return { on: br.key, at: [sx * (xi - 4), br.at[1], br.at[2] + dz], dir: [sx, 0, 0], mate: br.side };
  }));

  // legs: a square tube on a plate, screwed to the inside of each side under the bottom
  const lz = D / 2 - 60;
  const legC = b.compound("Leg", [
    { shape: "box", size: [5, lift - 4, 60], pos: [-xi + 2.5, y0 + lift / 2, 0], material: "metal" },
    { shape: "box", size: [36, y0 + 60 - 14, 36], pos: [-xi + 5 + 18, 14 + (y0 + 60 - 14) / 2, 0] },
    { shape: "cyl", size: [44, 14, 44], pos: [-xi + 5 + 18, 7, 0] },
  ]);
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({
    key: b.place(legC.type, [sx * -legC.mid[0], legC.mid[1], sz * lz], sx < 0 ? [0, 0, 0] : [0, Math.PI, 0]),
    sx,
    z: sz * lz,
  })));
  const legX = xi - 5 - 18;

  // strips on the bottom that the fridge stands between
  const stripL = D - 140;
  const stripT = b.part("Strip", [40, 18, stripL]);
  const strips = [-1, 1].map((sx) => ({ key: b.place(stripT, [sx * (xi - 70), yBot + PT / 2 + 9, 30]), sx }));

  // the shelf over the fridge, with the air grille along its back edge
  const yShelf = y0 + Math.round(H * 0.8);
  const shelfD = D - 100;
  const shelf = b.place(b.part("Shelf", [iw - 2, PT, shelfD]), [0, yShelf, D / 2 - 10 - shelfD / 2]);
  const grilleD = D / 2 - 10 - shelfD - (backZ + BT / 2);
  const grille = b.place(b.part("Air grille", [iw - 2, 14, grilleD]), [0, yShelf, D / 2 - 10 - shelfD - grilleD / 2]);

  // doors sold separately: a tall one over a short one, hinged on the left and left standing open, so the
  // finished cabinet shows its inside the way the photo does
  const split = y0 + Math.round(H * 0.365);
  const open: Vec3 = [0, -(95 * Math.PI) / 180, 0];
  const hingeAxis: Vec3 = [-W / 2 + 2, 0, D / 2];
  const swung = (p: Vec3): Vec3 => {
    const v = rotate([p[0] - hingeAxis[0], 0, p[2] - hingeAxis[2]], open);
    return [hingeAxis[0] + v[0], p[1], hingeAxis[2] + v[2]];
  };
  const door = (name: string, lo: number, hi: number) =>
    b.place(b.part(name, [W - 4, hi - lo - 3, FT], { extra: true }), swung([0, (lo + hi) / 2, D / 2 + FT / 2]), open);
  const upper = door("Upper door", split, y0 + H);
  const lower = door("Lower door", y0, split);
  const hingeYs = [0.96, 0.69, 0.4, 0.33, 0.04].map((f) => y0 + Math.round(H * f));
  const doorOf = (y: number) => (y > split ? upper : lower);

  /* ---- steps */
  step(b, {
    title: "Screw the wall brackets to the sides",
    detail: "Lay both sides on a rug, inside up. One bracket at each end of the back edge, two screws each.",
    pose: "-z",
    tools: ["screwdriver"],
    kind: "screws",
    warnings: ["floor"],
  }, () => {
    b.add(sideL);
    b.stage(sideR, rStaged, [0, 0, 0]);
    b.then(0.1);
    b.stagger(0.2);
    for (const br of brackets) {
      if (br.side === sideL) b.add(br.key, [0, 0, 120]);
      else b.stage(br.key, along(br.at, rFinal, rStaged, [0, 0, 0]), [0, 0, 0], [0, 0, 120]);
    }
    b.then(0.1);
    b.fits(BRACKET_SCREW, bracketScrews, 0.05);
  });
  step(b, {
    title: "Click the bottom onto one side",
    detail: "Stand the side on its front edge. Push the bottom's three hooks into the slots near the lower end, then press down until it clicks.",
    pose: "-z",
    kind: "join",
  }, () => b.add(bottom, [0, -220, 0]));
  step(b, {
    title: "Click the top on",
    detail: "At the other end of the side, with its cut-out at the back edge. Press until it clicks.",
    pose: "-z",
    kind: "join",
  }, () => b.add(top, [0, 220, 0]));
  step(b, {
    title: "Click the other side on",
    detail: "Lower it onto the hooks of the top and bottom, then press along both ends until they click.",
    pose: "-z",
    kind: "join",
  }, () => {
    b.add(sideR);
    for (const br of brackets) if (br.side === sideR) b.add(br.key);
  });
  step(b, {
    title: "Fit the two bottom locks",
    detail: "Turn one into the hole inside each side, just above the bottom at the back, then press it flat.",
    pose: "-z",
  }, () => b.fits(LOCK, [-1, 1].map((sx): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * xi, yBot + PT / 2 + 6, -D / 2 + 90], dir: [sx, 0, 0] })), 0.15));
  step(b, {
    title: "Click the back rail in",
    detail: "Halfway along the back: hook it into both sides, slide it along, then lift until it clicks.",
    pose: "-z",
    kind: "join",
  }, () => b.add(rail, [0, 0, -220]));
  step(b, {
    title: "Slide the back panel in",
    detail: "Into the grooves from the top end, past the cut-out, until it meets the rail.",
    pose: "-z",
  }, () => b.add(back, [0, H * 0.55, 0]));
  const ex: FitOpts[] = [];
  for (const sx of [-1, 1]) {
    ex.push({ on: back, at: [sx * (iw / 2 - 20), backHi - 40, -D / 2], dir: [0, 0, 1], mate: sx < 0 ? sideL : sideR });
    ex.push({ on: back, at: [sx * (iw / 2 - 20), backLo + 30, -D / 2], dir: [0, 0, 1], mate: sx < 0 ? sideL : sideR });
    ex.push({ on: rail, at: [sx * (iw / 2 - 20), yRail, -D / 2], dir: [0, 0, 1], mate: sx < 0 ? sideL : sideR });
  }
  step(b, {
    title: "Lock the back with the expanders",
    detail: "Push an expander into each hole, then press a pin into it to spread it, 6 in all.",
    pose: "-z",
  }, () => b.fits(EXPANDER, ex, 0.06));
  step(b, {
    title: "Push the clips onto the back edges",
    detail: "One at each end of both sides. They steady the cabinet against the wall.",
    pose: "-z",
  }, () => b.fits(HANG_CLIP, [-1, 1].flatMap((sx) => [y0 + H - 60, yBot + 40].map((y): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * (W / 2 - PT / 2), y, -D / 2], dir: [0, 0, 1], hole: false }))), 0.1));
  step(b, {
    title: "Screw the legs on",
    detail: "Take the legs out of their box. Each plate goes inside a side, under the bottom: one bolt through the plate's middle hole for now.",
    pose: "-z",
    tools: ["screwdriver"],
    kind: "legs",
  }, () => {
    b.stagger(0.2);
    for (const l of legs) b.add(l.key, [0, -200, 0]);
    b.then(0.1);
    b.fits(LEG_BOLT, legs.map((l): FitOpts => ({ on: l.key, at: [l.sx * xi, y0 + 50, l.z], dir: [l.sx, 0, 0], mate: l.sx < 0 ? sideL : sideR })), 0.08);
  });
  step(b, {
    title: "Fit the second screw in each leg",
    detail: "Lower down in the plate, so the leg can't turn.",
    pose: "-z",
    tools: ["screwdriver"],
    kind: "legs",
  }, () => b.fits(LEG_SCREW, legs.map((l): FitOpts => ({ on: l.key, at: [l.sx * xi, y0 + 18, l.z], dir: [l.sx, 0, 0], mate: l.sx < 0 ? sideL : sideR })), 0.08));
  step(b, {
    title: "Set the legs to 125 mm",
    detail: "Turn each foot with the spanner until it stands 125 mm out from the bottom of the side.",
    pose: "-z",
    tools: ["wrench", "tape"],
    kind: "legs",
  });
  step(b, {
    title: "Slide the covers over the legs",
    detail: "Only if no plinth goes on: push one over each leg and tape it in place. Under a plinth they aren't needed.",
    pose: "-z",
    kind: "legs",
  }, () => b.fits(LEG_COVER, legs.map((l): FitOpts => ({ on: l.key, at: [l.sx * legX, 50, l.z], dir: [0, 1, 0], hole: false })), 0.1));
  step(b, {
    title: "Stand it up",
    detail: "Lift it together onto its legs, without dragging it on them. Level it with the spanner on the feet.",
    pose: "+y",
    kind: "standup",
    people: 2,
    tools: ["wrench", "level"],
    warnings: ["two"],
  });
  step(b, {
    title: "Mark the bracket holes on the wall",
    detail: "Stand it where it will go, level, and mark through each of the four brackets.",
    tools: ["pencil", "level"],
    kind: "anchor",
    wall: true,
    warnings: ["wall"],
  });
  step(b, {
    title: "Put the wall screws in",
    detail: "Move the cabinet away, drill at the marks and turn in four screws, heads left out. Wall screws aren't included: pick ones made for your wall.",
    tools: ["drill", "screwdriver"],
    kind: "anchor",
    wall: true,
    warnings: ["wall", "tip"],
  }, () => {
    b.stagger(0.15);
    for (const x of brackets) b.fit(HW.plug, { at: [x.at[0], x.at[1], -D / 2 - 2], dir: [0, 0, -1] });
    b.then(0.1);
    for (const x of brackets) b.fit(HW.wallScrew, { at: [x.at[0], x.at[1], -D / 2 + 4], dir: [0, 0, -1] });
  });
  step(b, {
    title: "Hang it on the wall screws",
    detail: "Push the cabinet back so each screw head goes through its bracket, slip a hanging plate over it, then line the cabinet up and tighten.",
    tools: ["screwdriver"],
    kind: "anchor",
    people: 2,
    warnings: ["two", "wall"],
  }, () => b.fits(HANG_PLATE, brackets.map((br): FitOpts => ({ on: br.key, at: [br.at[0], br.at[1], br.at[2] - 6], dir: [0, 0, -1], hole: false })), 0.12));
  step(b, {
    title: "Click the covers onto the brackets",
    detail: "Push each one over its bracket until it clicks.",
  }, () => b.fits(BR_COVER, brackets.map((br): FitOpts => ({ on: br.key, at: [br.at[0], br.at[1], br.at[2] + 15], dir: [0, 0, -1], hole: false })), 0.12));
  step(b, {
    title: "Screw the hinges onto the doors",
    detail: "The doors are sold separately. Lay them face down, press each hinge into its hole and turn in two screws: three on the tall door, two on the short one.",
    tools: ["screwdriver"],
    scene: "doors",
    kind: "hinges",
    warnings: ["floor"],
  }, () => {
    b.stagger(0.2);
    b.stage(upper, [-(W / 2 + 40), FT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.stage(lower, [W / 2 + 40, FT / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    // points on the closed door's inside face, turned with it
    const dir = rotate([0, 0, 1], open);
    const x = -W / 2 + 24;
    b.fits(HW.hinge, hingeYs.map((y): FitOpts => ({ on: doorOf(y), at: swung([x, y, D / 2]), dir })), 0.1);
    b.then(0.05);
    b.fits(BRACKET_SCREW, hingeYs.flatMap((y) => [-22, 22].map((dy): FitOpts => ({ on: doorOf(y), at: swung([x - 6, y + dy, D / 2 + 2]), dir, hole: false }))), 0.04);
  });
  step(b, {
    title: "Screw the mounting plates to the left side",
    detail: "Five plates on the front edge inside, at the holes that match the hinges. Turn in both screws on each.",
    tools: ["screwdriver"],
    kind: "hinges",
  }, () => b.fits(HINGE_PLATE, hingeYs.map((y): FitOpts => ({ on: sideL, at: [-xi, y, D / 2 - 37], dir: [-1, 0, 0], hole: false })), 0.1));
  step(b, {
    title: "Hang the doors",
    detail: "Hook each hinge onto its plate and turn the screw to lock it. Then turn the hinge screws until the gaps look even.",
    tools: ["screwdriver"],
    kind: "doors",
  }, () => {
    b.stagger(0.35);
    b.add(upper, [0, 0, 380]);
    b.add(lower, [0, 0, 380]);
  });
  step(b, {
    title: "Stick the bumpers on",
    detail: "Inside each door, near the edge that opens. They stop it banging shut.",
  }, () => b.fits(BUMPER, [upper, lower].map((d): FitOpts => {
    const p = b.partItem(d).final.pos;
    return { on: d, at: swung([W / 2 - 24, p[1], D / 2]), dir: rotate([0, 0, 1], open), hole: false };
  }), 0.1));
  step(b, {
    title: "Tap the dowels into the strips",
    detail: "Two in each strip, then turn the strips over.",
    tools: ["hammer"],
    scene: "strips",
    kind: "dowels",
    warnings: ["floor"],
  }, () => {
    b.stagger(0.2);
    strips.forEach((st) => b.stage(st.key, [st.sx * 120, 9, 0], [0, 0, Math.PI], [0, 160, 0]));
    b.then(0.1);
    b.fits(HW.dowel, strips.flatMap((st) => [-1, 1].map((dz): FitOpts => {
      const p = b.partItem(st.key).final.pos;
      return { on: st.key, at: [p[0], p[1] - 9, p[2] + dz * (stripL / 2 - 40)], dir: [0, -1, 0], mate: bottom };
    })), 0.1);
  });
  step(b, {
    title: "Push the strips into the bottom",
    detail: "One along each side, dowels down. The fridge stands between them.",
    kind: "join",
  }, () => {
    b.stagger(0.25);
    for (const st of strips) b.add(st.key, [0, 220, 0]);
  });
  step(b, {
    title: "Screw the grille onto the shelf",
    detail: "Along the shelf's back edge, two screws. It lets the warm air from the fridge out through the top.",
    tools: ["screwdriver"],
    scene: "shelf",
    kind: "screws",
    warnings: ["floor"],
  }, () => {
    const sp = b.partItem(shelf).final.pos, gp = b.partItem(grille).final.pos;
    b.stage(shelf, [0, PT / 2, 0], [0, 0, 0], [0, 160, 0]);
    b.then(0.1);
    b.stage(grille, [0, PT / 2, gp[2] - sp[2]], [0, 0, 0], [0, 160, 0]);
    b.then(0.1);
    b.fits(GRILLE_SCREW, [-1, 1].map((sx): FitOpts => ({ on: grille, at: [sx * 150, yShelf + 7, gp[2] + 10], dir: [0, -1, 0], mate: shelf })), 0.12);
  });
  const zs = [-D / 2 + 130, D / 2 - 160, D / 2 - 50];
  step(b, {
    title: "Put the shelf in over the fridge",
    detail: "Build the fridge in by its own instructions. Screw the six shelf supports in just over it, three in each side, then press the shelf on until it clicks.",
    tools: ["screwdriver"],
    kind: "shelves",
  }, () => {
    b.fits(SHELF_SUPPORT, [-1, 1].flatMap((sx) => zs.map((z): FitOpts => ({ on: sx < 0 ? sideL : sideR, at: [sx * xi, yShelf - PT / 2 - 6, z], dir: [sx, 0, 0] }))), 0.06);
    b.then(0.1);
    b.add(shelf, [0, 0, 340]);
    b.add(grille, [0, 0, 340]);
  });
}

/* ---------------------------------------------------------------- which build */

const slugOf = (s: ProductSpec) => s.slug ?? "";

function frameOpts(s: ProductSpec): FrameOpts | null {
  const slug = slugOf(s);
  const H = s.size.h * 10;
  // the US sizes (in inches) follow a newer manual: brackets at the top only, shelf rails in while it lies on its back
  const us = /-45-5-|-30-5-|-61-x-30-5-/.test(slug);
  if (/enhet-base-fr-w-shelves/.test(slug)) {
    const leg = 50;
    return { leg, levels: [Math.round(leg + (H - leg) * 0.5)], shelves: ["bottom", 0], clips: us ? 12 : 8, lowBrackets: false, bracketsFirst: false, wallAt: "top", lyingRails: us };
  }
  if (/enhet-high-fr-w-shelves/.test(slug)) {
    const leg = 20, lo = leg + T / 2, hi = H - T / 2;
    const n = 4;
    return { leg, levels: Array.from({ length: n }, (_, i) => Math.round(lo + ((hi - lo) * (i + 1)) / (n + 1))), shelves: ["bottom", 0, 1, 2, 3], clips: 12, lowBrackets: !us, bracketsFirst: false, wallAt: us ? "top" : "low", lyingRails: us };
  }
  if (/enhet-base-frame-for-washbasin/.test(slug)) {
    return { leg: 0, levels: [Math.round(H * 0.5)], shelves: ["bottom", 0], clips: 4, lowBrackets: true, bracketsFirst: false, wallAt: "low", topPegs: 2 };
  }
  if (/enhet-wall-frame-shelves|enhet-mirror-cabinet-60-x-17-x-75/.test(slug)) {
    return { leg: 0, levels: [Math.round(H * 0.45)], shelves: ["bottom", 0, "top"], clips: 6, lowBrackets: false, bracketsFirst: true, wallAt: "top", shelvesAt: "afterWall" };
  }
  if (/enhet-wall-shelf-frame/.test(slug)) {
    return { leg: 12, levels: [], shelves: ["top"], clips: 2, lowBrackets: false, bracketsFirst: true, wallAt: "top", shelvesAt: "beforeWall", bottomBoard: s.size.d * 10, supports: 6, catches: 2 };
  }
  return null;
}

const BASE = { how: "upside", brackets: 2, expanders: 0, doors: 0, bumpers: 0, shelves: 0, supports: 0, drawers: 0 } as const;
const LYING = { how: "lying", brackets: 2, expanders: 8, doors: 0, bumpers: 0, shelves: 2, supports: 8, drawers: 0 } as const;
const WASH_DOOR: CabOpts = { ...BASE, bottom: "strips", rods: "early", doors: 1, hinges: 2, bumpers: 2, shelves: 1, supports: 4, shelfStrip: true };
const WASH_DRAWERS: CabOpts = { ...BASE, bottom: "strip", rods: "early", runnersFirst: true, drawers: 2, fronts: true };

/** Which manual a board cabinet follows, and the cabinet's own size when a wash-basin sits on it (cm). */
function cabOpts(s: ProductSpec): { o: CabOpts; size?: { w: number; h: number; d: number } } | null {
  const slug = slugOf(s);
  if (/enhet-base-cb-w-shelf/.test(slug)) return { o: { ...BASE, bottom: "panel", expanders: 8, angles: "before", shelves: 1, supports: 6 } };
  if (/enhet-base-cb-w-3-drawers/.test(slug)) return { o: { ...BASE, bottom: "drawers", rods: "late", angles: "before", drawers: 3 } };
  if (/enhet-base-cb-f-sink/.test(slug)) return { o: { ...BASE, bottom: "strip", angles: "before" } };
  if (/enhet-sink-cabinet-door/.test(slug)) return { o: { ...BASE, bottom: "strips", rods: "early", angles: "after", doors: 1, hinges: 2, bumpers: 2 } };
  if (/enhet-wash-stand-door-|enhet-tvallen-wash-stnd-w-door-/.test(slug)) return { o: WASH_DOOR, size: /tvallen/.test(slug) ? { w: 40, h: 60, d: 42 } : undefined };
  if (/enhet-wash-stand-doors|enhet-bathroom-vanity-doors|enhet-tvallen-wash-stnd-w-doors/.test(slug))
    return { o: { ...WASH_DOOR, doors: 2, bumpers: 2 }, size: /tvallen/.test(slug) ? { w: 60, h: 60, d: 42 } : undefined };
  if (/enhet-wash-stand-drawers|enhet-tvallen-wash-stnd-w-drawers/.test(slug)) return { o: WASH_DRAWERS, size: /tvallen/.test(slug) ? { w: 60, h: 60, d: 42 } : undefined };
  if (/enhet-base-cb-f-washbasin-w-2-drawers|enhet-bathroom-vanity-2-drawers/.test(slug)) return { o: { ...BASE, bottom: "strip", rods: "late", drawers: 2 } };
  if (/enhet-wall-cb-w-2-shelves-45-5/.test(slug)) return { o: { ...LYING, wallRail: true } };
  if (/enhet-wall-cb-w-2-shelves/.test(slug)) return { o: { ...LYING, hangClips: 2 } };
  if (/enhet-wall-cabinet-door|enhet-mirror-cabinet-door-/.test(slug)) return { o: { ...LYING, hangClips: 4, spacers: true, doors: 1, hinges: 2, bumpers: 2, mirror: /mirror/.test(slug) } };
  if (/enhet-mirror-cabinet-doors/.test(slug)) return { o: { ...LYING, hangClips: 4, spacers: true, doors: 2, hinges: 2, bumpers: 2, mirror: true } };
  if (/enhet-high-cb-w-4-shelves/.test(slug)) return { o: { ...LYING, fixedShelf: true, brackets: 4, expanders: 6, hangClips: 2, shelves: 3, supports: 12 } };
  if (/enhet-high-cabinet-door/.test(slug)) return { o: { ...LYING, fixedShelf: true, brackets: 4, expanders: 6, hangClips: 4, spacers: true, doors: 1, hinges: 3, bumpers: 2, shelves: 3, supports: 12 } };
  return null;
}

/** The anthracite mirror cabinet: a mirror that hangs on the wall frame's top rail and slides along it. */
function mirrorSteps(b: PlanBuilder, frame: { w: number; h: number; d: number }) {
  const W = frame.w * 10, H = frame.h * 10, D = frame.d * 10;
  const mw = Math.round(W / 2), mh = H - 30;
  const mirror = b.place(b.part("Mirror", [mw, mh, 6], { material: "board" }), [W / 2 - mw / 2 - 10, H / 2 - 5, D / 2 + 14]);
  const back = D / 2 + 11;
  step(b, {
    title: "Screw the hangers onto the mirror",
    detail: "Lay the mirror face down on the rug. Two hangers along the top edge and the guides at the bottom, two screws each.",
    scene: "mirror",
    tools: ["screwdriver"],
    kind: "screws",
    warnings: ["floor"],
  }, () => {
    b.stage(mirror, [0, 3, 0], [-Math.PI / 2, 0, 0], [0, 160, 0]);
    b.then(0.1);
    const xm = W / 2 - mw / 2 - 10;
    const top = [-1, 1].map((sx): FitOpts => ({ on: mirror, at: [xm + sx * (mw / 2 - 60), H - 40, back], dir: [0, 0, 1], hole: false }));
    const low = [-1, 1].map((sx): FitOpts => ({ on: mirror, at: [xm + sx * (mw / 2 - 60), 40, back], dir: [0, 0, 1], hole: false }));
    b.fits(HW.hook, top, 0.15);
    b.fits(HW.angle, low, 0.15);
    b.then(0.05);
    b.fits(HW.screwS, [...top, ...low].flatMap((p) => [-12, 12].map((dx): FitOpts => ({ ...p, at: [p.at[0] + dx, p.at[1], p.at[2]] }))), 0.04);
  });
  step(b, {
    title: "Hang the mirror on the top rail",
    detail: "Hook the hangers over the front top rail, then swing the bottom in so the guides catch the bottom rail.",
    kind: "join",
  }, () => b.add(mirror, [0, 120, 160]));
  step(b, {
    title: "Fit the stops under the bottom rail",
    detail: "Three stops click into the bottom rail so the mirror can't lift off.",
  }, () => b.fits(HW.clip, [0, 1, 2].map((i): FitOpts => ({ at: [-W / 2 + 60 + ((W - 120) * i) / 2, -2, D / 2 - 10], dir: [0, 1, 0], hole: false })), 0.12));
}

/** TVÄLLEN: the wash-basin sits on top, fitted by its own manual. */
function basinStep(b: PlanBuilder, s: ProductSpec, under: { w: number; h: number; d: number }) {
  const W = s.size.w * 10, Hc = under.h * 10;
  const D = Math.max(s.size.d, under.d) * 10;
  const zf = (under.d * 10) / 2, zb = zf - D; // front edge in line with the cabinet's
  const y = Hc + 25;
  // a rim round a sunk bowl, with the tap deck at the back
  const bw = W - 90, bd = D - 150, bz = zf - 45 - bd / 2;
  const pieces: PartPiece[] = [
    { shape: "box", size: [W, 50, 45], pos: [0, y, zf - 22.5] },
    { shape: "box", size: [W, 50, 105], pos: [0, y, zb + 52.5] },
    { shape: "box", size: [45, 50, D - 150], pos: [-W / 2 + 22.5, y, bz] },
    { shape: "box", size: [45, 50, D - 150], pos: [W / 2 - 22.5, y, bz] },
    { shape: "box", size: [bw, 10, bd], pos: [0, y - 85, bz] },
    { shape: "box", size: [bw, 90, 8], pos: [0, y - 40, zf - 45 - 4] },
    { shape: "box", size: [bw, 90, 8], pos: [0, y - 40, zb + 105 + 4] },
    { shape: "box", size: [8, 90, bd], pos: [-bw / 2 + 4, y - 40, bz] },
    { shape: "box", size: [8, 90, bd], pos: [bw / 2 - 4, y - 40, bz] },
    { shape: "cyl", size: [30, 130, 30], pos: [0, y + 90, zb + 50], material: "metal" },
  ];
  const c = b.compound("Wash-basin", pieces);
  const basin = b.place(c.type, c.mid);
  step(b, {
    title: "Set the wash-basin on top",
    detail: "Fit the tap and the water trap first, as the wash-basin's own instructions show, then lower it on and screw it to the wall.",
    people: 2,
    warnings: ["two", "wall"],
    tools: ["screwdriver", "drill", "level"],
    wall: true,
  }, () => b.add(basin, [0, 260, 0]));
}

const family: Family = {
  names: ["ENHET"],
  build(b, s) {
    const tvallen = /tvallen/.test(slugOf(s));
    if (/enhet-tvallen-open-wash-stand/.test(slugOf(s))) {
      const under = { w: 60, h: 60, d: 40 };
      buildFrame(b, { ...s, size: under }, frameOpts({ ...s, slug: "enhet-base-frame-for-washbasin" })!);
      basinStep(b, s, under);
      return true;
    }
    if (/enhet-wall-shelf-frame/.test(slugOf(s))) {
      // the frame stands back from the board's front edge
      buildFrame(b, { ...s, size: { ...s.size, d: s.size.d - 8 } }, frameOpts(s)!);
      return true;
    }
    if (/enhet-mirror-cabinet-60-x-17-x-75/.test(slugOf(s))) {
      const frame = { w: s.size.w, h: s.size.h, d: 15 };
      buildFrame(b, { ...s, size: frame }, frameOpts(s)!);
      mirrorSteps(b, frame);
      return true;
    }
    if (/enhet-high-cabinet-for-fridge-freezer/.test(slugOf(s))) {
      buildFridge(b, s);
      return true;
    }
    const f = frameOpts(s);
    if (f) {
      buildFrame(b, s, f);
      return true;
    }
    const c = cabOpts(s);
    if (c) {
      const size = c.size ?? s.size;
      buildCabinet(b, { ...s, size }, c.o);
      if (tvallen) basinStep(b, s, size);
      return true;
    }
    return false;
  },
};
export default family;
