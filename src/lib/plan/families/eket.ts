import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * EKET, read from its manuals. Every frame is four mitred panels that click together on the pegs and slots in their
 * edges, so there are no loose fittings in the box itself. It is built lying on its front on a rug: two panels into a
 * corner, the third onto them, the back slid along the grooves from the open end, the last panel clicked on. Then it is
 * stood up with the top (sticker 1) up, the back pushed down into its groove and locked with clips and wedges round the
 * edge. Fittings that go inside a panel (push openers, drawer runners, the cable ring) go on before it is clicked in.
 * A frame on the floor is fixed to the wall through two fittings in its top back corners; a wall cabinet hangs on the
 * suspension rail sold with it. Doors, shelves and drawers follow, each from its own manual.
 */

type Kind = "open" | "glass" | "door" | "doors2" | "media" | "four" | "drawers" | "drawers35";
interface G {
  W: number;
  H: number;
  D: number;
  t: number;
  kind: Kind;
  rail: boolean; // hung on the suspension rail sold with it
  big: boolean;
}

const T = 16; // panel thickness
const runYOf = (g: { t: number; H: number }, k: number) => g.t + k * ((g.H - 2 * g.t) / 2) + 40; // drawer runner k, from the bottom
const BT = 3; // back

function kindOf(s: ProductSpec): G | null {
  const slug = s.slug ?? "";
  const v = s.variant.toLowerCase();
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  let kind: Kind | null = null;
  let rail = false;
  // the 70 x 70 one is the cabinet with two doors and a shelf, in white, on its rail
  if (/wall-mounted-shelving-unit/.test(slug)) (kind = W >= 600 && H >= 600 ? "doors2" : "open"), (rail = true);
  else if (/glass/.test(slug) || /glass/.test(v) || slug === "eket-cabinet") (kind = "glass"), (rail = true);
  else if (/2-doors/.test(slug)) (kind = "doors2"), (rail = true);
  else if (/shlf-door/.test(slug)) (kind = "door"), (rail = true);
  else if (/media-shelf/.test(slug)) kind = "media";
  else if (/combination|4-compartments/.test(slug)) kind = "four";
  else if (/2-drawers/.test(slug)) kind = W >= 600 ? "drawers" : "drawers35";
  else if (/^eket-cabinet-35-x-25-x-35$/.test(slug)) kind = "open";
  if (!kind) return null;
  return { W, H, D, t: T, kind, rail, big: W >= 600 };
}

const fx = (kind: CustomFix["kind"], on: string | undefined, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });

function recipeOf(g: G): CustomParams {
  const { W, H, D, t, kind } = g;
  const Wi = W - 2 * t, Hi = H - 2 * t;
  const zBack = -D / 2 + 10; // the back runs in grooves 10 mm in from the back edges
  const parts: CustomPart[] = [
    { id: "T", label: "1", name: "Top panel", size: [W, t, D], pos: [0, H - t / 2, 0], material: "board" },
    { id: "L", name: "Side panel", size: [t, Hi, D], pos: [-W / 2 + t / 2, H / 2, 0], material: "board" },
    { id: "R", name: "Side panel", size: [t, Hi, D], pos: [W / 2 - t / 2, H / 2, 0], material: "board" },
    { id: "K", name: "Back panel", size: [Wi + 12, Hi + 12, BT], pos: [0, H / 2, zBack], material: "fiber" },
    { id: "B", name: "Bottom panel", size: [W, t, D], pos: [0, t / 2, 0], material: "board" },
  ];
  const steps: CustomStep[] = [];
  const pre = new Set<string>();
  const zIn = zBack + BT / 2; // inside face of the back
  const Din = D / 2 - zIn;

  // fittings that go on a panel before it is clicked in
  const ySh = H / 2; // shelf (door cabinets, media shelf)
  if (kind === "door" || kind === "media") {
    // a push opener on the inside of the left side, in front, at the height the door or flap closes
    const y = kind === "door" ? H / 2 : ySh - t / 2 - 40;
    const x = -W / 2 + t;
    steps.push({
      title: "Fit the push opener to a side panel",
      detail: "Screw its holder to the inside of the side, near the front edge, then click the opener into the holder, its tip to the front.",
      add: ["L"],
      fix: [
        fx("clip", "L", [[x, y, D / 2 - 70]], [-1, 0, 0], { name: "Opener holder", len: 16, dia: 30 }),
        fx("screw", "L", [[x + 2, y, D / 2 - 86], [x + 2, y, D / 2 - 54]], [-1, 0, 0], { len: 12, dia: 3.5 }),
        fx("stud", "L", [[x + 10, y, D / 2 - 70]], [0, 0, -1], { name: "Push opener", len: 60, dia: 14 }),
      ],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    });
    pre.add("L");
  }
  if (kind === "doors2") {
    // one push opener for each door, under the top panel near the middle
    const pts: Vec3[] = [[-70, H - t - 8, D / 2 - 70], [70, H - t - 8, D / 2 - 70]];
    steps.push({
      title: "Fit the two push openers to the top panel",
      detail: "Screw each holder to the inside of the top, either side of the middle, then click an opener into each, tips to the front.",
      add: ["T"],
      fix: [
        fx("clip", "T", pts, [0, 1, 0], { name: "Opener holder", len: 16, dia: 30 }),
        fx("screw", "T", pts.flatMap((p) => [[p[0], H - t, p[2] - 16], [p[0], H - t, p[2] + 16]] as Vec3[]), [0, 1, 0], { len: 12, dia: 3.5 }),
        fx("stud", "T", pts.map((p) => [p[0], p[1] - 2, p[2]] as Vec3), [0, 0, -1], { name: "Push opener", len: 60, dia: 14 }),
      ],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    });
    pre.add("T");
  }
  if (kind === "media") {
    steps.push({
      title: "Press the cable ring into the top panel",
      detail: "Into the round hole at the back. Then click the top onto the side, the pegs on the side's edge into the slots.",
      add: ["T"],
      fix: [fx("clip", "T", [[W / 2 - 130, H, -D / 2 + 80]], [0, -1, 0], { name: "Cable ring", len: 14, dia: 70 })],
    });
    pre.add("T");
  }
  if (kind === "drawers" || kind === "drawers35") {
    const per = kind === "drawers" ? 2 : 3;
    const len = D - 40;
    const pts: { side: "L" | "R"; p: Vec3; d: Vec3 }[] = [];
    for (const side of ["L", "R"] as const)
      for (let k = 0; k < 2; k++) {
        const x = side === "L" ? -W / 2 + t : W / 2 - t;
        pts.push({ side, p: [x, runYOf(g, k), D / 2 - 20 - len / 2], d: [side === "L" ? -1 : 1, 0, 0] });
      }
    const screws = (side: "L" | "R") =>
      pts.filter((r) => r.side === side).flatMap((r) => Array.from({ length: per }, (_, i) => [r.p[0] - r.d[0] * 8, r.p[1], r.p[2] - len / 2 + 30 + (i * (len - 60)) / (per - 1)] as Vec3));
    steps.push({
      title: "Screw the runners onto both side panels",
      detail: `Two runners on the inside of each side, open ends to the front. ${per} screws hold each one.`,
      add: ["L", "R"],
      fix: [
        fx("runner", "L", pts.filter((r) => r.side === "L").map((r) => r.p), [-1, 0, 0], { len, dia: 20 }),
        fx("runner", "R", pts.filter((r) => r.side === "R").map((r) => r.p), [1, 0, 0], { len, dia: 20 }),
        fx("screw", "L", screws("L"), [-1, 0, 0], { len: 12, dia: 3.5 }),
        fx("screw", "R", screws("R"), [1, 0, 0], { len: 12, dia: 3.5 }),
      ],
      tools: ["screwdriver"],
      pose: kind === "drawers35" ? "-y" : "-z",
      warnings: ["floor"],
    });
    pre.add("L").add("R");
  }

  // the frame: lying on its front, or upside down on its top for the small drawer unit
  const pose = kind === "drawers35" ? "-y" : "-z";
  const how =
    kind === "drawers35"
      ? "Stand them on the rug, the top upside down."
      : "Stand them on their front edges on a rug.";
  const click = "Drop the pegs on one edge into the slots in the other and press down along the joint until it clicks.";
  const people = g.big ? 2 : 1;
  const join = (title: string, detail: string, add: string[]): CustomStep => ({ title, detail, add, pose, people: steps.length < 2 ? people : 1, warnings: ["floor"] });
  const left = ["T", "L", "R"].filter((id) => !pre.has(id));
  if (left.length === 3) {
    steps.push(join("Click a side panel onto the top panel", `The top is the panel with the sticker marked 1. ${how} ${click}`, ["T", "L"]));
  } else if (left.join() === "T,R") {
    steps.push(join("Click the top panel onto the side", `The top is the panel with the sticker marked 1. ${how} ${click}`, ["T"]));
  } else if (left.join() === "L,R") {
    steps.push(join("Click a side panel onto the top panel", `${how} ${click}`, ["L"]));
  } else if (left.join() === "T") {
    steps.push(join("Click the top panel onto the sides", `The top is the panel with the sticker marked 1. ${how} ${click}`, ["T"]));
  }
  if (kind === "four") {
    const hw = (Wi - t) / 2;
    parts.push(
      { id: "V", name: "Divider", size: [t, Hi, Din], pos: [0, H / 2, zIn + Din / 2], material: "board" },
      { id: "S1", name: "Half shelf", size: [hw, t, Din], pos: [-(t / 2 + hw / 2), H / 2, zIn + Din / 2], material: "board" },
      { id: "S2", name: "Half shelf", size: [hw, t, Din], pos: [t / 2 + hw / 2, H / 2, zIn + Din / 2], material: "board" },
    );
    steps.push({
      title: "Click the half shelves onto the divider",
      detail: "One on each side of it, in the middle, so they make a cross. Then click the cross onto the top panel.",
      add: ["V", "S1", "S2"],
    });
  }
  const rest = ["L", "R"].filter((id) => !pre.has(id) && !steps.some((st) => st.add?.includes(id)));
  if (rest.length) steps.push(join("Click on the other side panel", `The same way, at the other end of the top. ${kind === "four" ? "Its slots take the pegs on the end of the shelf." : ""}`.trim(), rest));
  steps.push({
    title: "Slide the back panel along the grooves",
    detail: `${W >= 600 && H >= 600 ? "Unfold it flat first. " : ""}${kind === "drawers35" ? "Push it down" : "Push it in from the open end"}, good side in, in the grooves of both sides and the top. Its edges go into the grooves, not past them.`,
    add: ["K"],
    from: { K: [0, -(H + 120), 0] },
  });
  steps.push({
    title: "Click the bottom panel on",
    detail: "Over the end of the back panel and onto both sides. Press down along the joints until they click.",
    add: ["B"],
    from: { B: [0, -220, 0] },
  });
  steps.push({
    title: people === 2 ? "Stand it up together" : "Stand it up",
    detail: "Turn it over so the top, with sticker 1, is up. Push the back panel down until it sits all the way in the groove in the bottom.",
    pose: "+y",
    people,
    warnings: people === 2 ? ["two"] : [],
  });
  const clips = backClips(g, zBack);
  steps.push({
    title: "Lock the back panel with the clips",
    detail: `${clips.length} clips go into the holes round the back edge. Press a wedge into each clip so the back can't slide out.`,
    fix: [
      fx("clip", undefined, clips.map((c) => c.at), [0, 0, 1], { name: "Back clip", len: 14, dia: 12 }),
      fx("cap", undefined, clips.map((c) => [c.at[0], c.at[1], c.at[2] - 3] as Vec3), [0, 0, 1], { name: "Clip wedge", len: 8, dia: 10 }),
    ],
  });

  const inner = { parts, steps, zIn, Din, ySh };
  if (kind === "glass") glassDoor(g, inner);
  if (!g.rail) wallFix(g, inner);
  else rail(g, inner);
  if (kind === "door" || kind === "doors2") {
    shelf(g, inner);
    pivotDoors(g, inner, kind === "doors2" ? 2 : 1);
  }
  if (kind === "media") mediaFlap(g, inner);
  return { parts, steps };
}

interface Inner {
  parts: CustomPart[];
  steps: CustomStep[];
  zIn: number;
  Din: number;
  ySh: number;
}

/** Clips round the back edge: one in the middle of a 35 cm edge, three along a 70 cm one. */
function backClips(g: G, zBack: number): { at: Vec3 }[] {
  const { W, H, t } = g;
  const n = (len: number) => (len >= 600 ? 3 : 1);
  const out: { at: Vec3 }[] = [];
  const z = zBack - 4;
  const along = (len: number, k: number) => Array.from({ length: k }, (_, i) => -len / 2 + ((i + 1) * len) / (k + 1));
  for (const x of along(W - 2 * t, n(W))) out.push({ at: [x, H - t - 4, z] }, { at: [x, t + 4, z] });
  for (const y of along(H - 2 * t, n(H))) out.push({ at: [-W / 2 + t + 4, H / 2 + y, z] }, { at: [W / 2 - t - 4, H / 2 + y, z] });
  return out;
}

/** A frame on the floor: two fittings in the top back corners, spacer caps for the skirting, screwed to the wall. */
function wallFix(g: G, o: Inner) {
  const { W, H, D, t } = g;
  const y = H - t - 28;
  const pts: Vec3[] = [[-(W / 2 - t - 24), y, -D / 2 + 8], [W / 2 - t - 24, y, -D / 2 + 8]];
  o.steps.push({
    title: "Push the wall fittings into the top corners",
    detail: "One in each top back corner, its pegs into the holes in the side, screw hole facing the wall. They stop it tipping over.",
    fix: [fx("spacer", "L", [pts[0]], [-1, 0, 0], { name: "Wall fitting", len: 36, dia: 40 }), fx("spacer", "R", [pts[1]], [1, 0, 0], { name: "Wall fitting", len: 36, dia: 40 })],
    warnings: ["tip"],
  });
  o.steps.push({
    title: "Turn the spacer caps onto the fittings",
    detail: "By hand, from behind. Turn them out further if a skirting board keeps the frame away from the wall at the bottom.",
    fix: [fx("cap", undefined, pts.map((p) => [p[0], p[1], -D / 2 - 6] as Vec3), [0, 0, 1], { name: "Spacer cap", len: 18, dia: 36 })],
  });
  o.steps.push({
    title: "Screw it to the wall",
    detail: "Push it against the wall, mark through the fittings and drill. A washer goes under each screw head. Wall screws and plugs aren't included: pick ones made for your wall.",
    fix: [
      fx("plug", undefined, pts.map((p) => [p[0], p[1], -D / 2 - 40] as Vec3), [0, 0, -1], { len: 35, dia: 8 }),
      fx("washer", undefined, pts.map((p) => [p[0], p[1], -D / 2 + 24] as Vec3), [0, 0, -1], { len: 2, dia: 20 }),
      fx("screw", undefined, pts.map((p) => [p[0], p[1], -D / 2 + 22] as Vec3), [0, 0, -1], { len: 50, dia: 5 }),
    ],
    tools: ["drill", "screwdriver", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  });
  o.steps.push({
    title: "Press the cover caps on",
    detail: "From inside the frame, over the screw heads.",
    fix: [fx("cap", undefined, pts.map((p) => [p[0], p[1], -D / 2 + 30] as Vec3), [0, 0, -1], { name: "Cover cap", len: 8, dia: 26 })],
  });
}

/** The suspension rail's own manual: brackets in the top back corners, the rail on the wall, the frame hooked on. */
function rail(g: G, o: Inner) {
  const { W, H, D, t } = g;
  const y = H - t - 30;
  const z = o.zIn + 22;
  const br: Vec3[] = [[-(W / 2 - t - 30), y, z], [W / 2 - t - 30, y, z]];
  const n = W >= 600 ? 3 : 2;
  const len = W - 40;
  o.parts.push({ id: "RAIL", name: "Suspension rail", size: [len, 40, 8], pos: [0, H - 34, -D / 2 - 4], material: "metal" });
  o.steps.push({
    title: "Fit the hanging brackets in the top corners",
    detail: "Turn a levelling bolt into each bracket first, not all the way. Then push the brackets into the top back corners, one each side.",
    fix: [
      fx("angle", "L", [br[0]], [0, 0, -1], { name: "Hanging bracket", len: 60, dia: 50 }),
      fx("angle", "R", [br[1]], [0, 0, -1], { name: "Hanging bracket", len: 60, dia: 50 }),
      fx("bolt", "T", br.map((p) => [p[0], H - t, p[2]] as Vec3), [0, 1, 0], { name: "Levelling bolt", len: 16, dia: 6 }),
    ],
    tools: ["allen"],
  });
  const sc = (sx: number): Vec3[] => [-12, 12].map((dy) => [sx * (W / 2 - t), y + dy, z + 6] as Vec3);
  o.steps.push({
    title: "Screw the brackets to the sides",
    detail: "Two screws through each bracket into the side panel.",
    fix: [fx("screw", "L", sc(-1), [-1, 0, 0], { len: 12, dia: 4 }), fx("screw", "R", sc(1), [1, 0, 0], { len: 12, dia: 4 })],
    tools: ["screwdriver"],
  });
  const xs = n === 3 ? [-len / 2 + 40, 0, len / 2 - 40] : [-len / 2 + 40, len / 2 - 40];
  const wy = H - 34;
  o.steps.push({
    title: "Screw the rail to the wall",
    detail: `Tape the drilling template up where the frame goes, level it and mark the ${n} holes. Leave at least 5 cm free above the frame. Drill, then screw the rail on with a spacer under each screw. Wall screws and plugs aren't included: pick ones made for your wall.`,
    add: ["RAIL"],
    from: { RAIL: [0, 260, 0] },
    fix: [
      fx("plug", "RAIL", xs.map((x) => [x, wy, -D / 2 - 40] as Vec3), [0, 0, -1], { len: 35, dia: 8 }),
      fx("washer", "RAIL", xs.map((x) => [x, wy, -D / 2] as Vec3), [0, 0, -1], { name: "Rail spacer", len: 4, dia: 24 }),
      fx("screw", "RAIL", xs.map((x) => [x, wy, -D / 2 + 2] as Vec3), [0, 0, -1], { len: 50, dia: 5 }),
    ],
    tools: ["drill", "level", "pencil", "screwdriver"],
    wall: true,
    warnings: ["wall"],
  });
  const two = W >= 600 && H >= 600;
  o.steps.push({
    title: two ? "Hang it on the rail together" : "Hang it on the rail",
    detail: "Lift it a little above the rail, push it to the wall and lower it so both brackets hook over the rail and click.",
    people: two ? 2 : 1,
    kind: "anchor",
    wall: true,
    warnings: two ? ["wall", "two"] : ["wall"],
  });
  o.steps.push({
    title: "Level it",
    detail: "Turn the levelling bolts through the holes in the top with the Allen key until it hangs straight.",
    tools: ["allen", "level"],
  });
}

/** The glass door's own manual: hinge holes marked, two hinges screwed on, pads on the glass, the door clipped on, the knob. */
function glassDoor(g: G, o: Inner) {
  const { W, H, D, t } = g;
  const x = -W / 2 + t;
  const ys = [t + 45, H - t - 45];
  o.parts.push({ id: "G", name: "Glass door", size: [W - 2 * t - 4, H - 2 * t - 4, 5], pos: [0, H / 2, D / 2 - 4], material: "glass" });
  const hinge = (y: number, name: string): CustomFix[] => [
    fx("hinge", "L", [[x, y, D / 2 - 14]], [-1, 0, 0], { name, len: 40, dia: 26 }),
    fx("screw", "L", [[x, y - 10, D / 2 - 26], [x, y + 10, D / 2 - 26]], [-1, 0, 0], { len: 14, dia: 3.5 }),
  ];
  o.steps.push({ title: "Screw on the lower hinge", detail: "Hinges go on the left. Hold the template inside the front edge of the left side and press the two holes in with a screwdriver, then screw the hinge on, its clamp to the front.", fix: hinge(ys[0], "Lower hinge"), tools: ["screwdriver"] });
  o.steps.push({ title: "Screw on the upper hinge", detail: "Mark its holes with the template the same way, at the top, then screw it on.", fix: hinge(ys[1], "Upper hinge"), tools: ["screwdriver"] });
  const xr = W / 2 - t - 18;
  o.steps.push({
    title: "Stick the pads on and clip the door on",
    detail: "Wipe the glass clean, stick the two clear pads inside its right-hand corners, then slide its left edge into both hinge clamps and tighten them.",
    add: ["G"],
    from: { G: [-40, 0, 360] },
    fix: [fx("glide", "G", [[xr, ys[1], D / 2 - 7], [xr, ys[0], D / 2 - 7]], [0, 0, 1], { name: "Clear pad", len: 2, dia: 12 })],
    tools: ["screwdriver"],
    warnings: ["hand"],
  });
  const kp: Vec3 = [W / 2 - t - 30, H / 2, D / 2 - 1.5];
  o.steps.push({
    title: "Screw on the knob",
    detail: "The screw goes through the hole in the glass from inside, with the washer against the glass. Don't overtighten.",
    fix: [
      fx("knob", "G", [kp], [0, 0, -1], { len: 22, dia: 18 }),
      fx("washer", "G", [[kp[0], kp[1], D / 2 - 7]], [0, 0, 1], { len: 1.5, dia: 12 }),
      fx("screw", "G", [[kp[0], kp[1], D / 2 - 8]], [0, 0, 1], { len: 16, dia: 4 }),
    ],
    tools: ["screwdriver"],
  });
}

function shelf(g: G, o: Inner) {
  const { W, t } = g;
  const Ds = o.Din - 22; // clear of the door
  const z = o.zIn + Ds / 2;
  o.parts.push({ id: "SH", name: "Shelf", size: [W - 2 * t - 2, t, Ds], pos: [0, o.ySh, z], material: "board" });
  const pins = (sx: number): Vec3[] => [z - Ds / 2 + 40, z + Ds / 2 - 40].map((zz) => [sx * (W / 2 - t), o.ySh - t / 2, zz] as Vec3);
  o.steps.push({
    title: "Put in the shelf pins and the shelf",
    detail: "Four pins at the height you want, two in each side. Lay the shelf on them.",
    fix: [fx("pin", "L", pins(-1), [-1, 0, 0]), fx("pin", "R", pins(1), [1, 0, 0])],
    add: ["SH"],
    from: { SH: [0, 0, 400] },
  });
}

/** Doors that turn on pins in their top and bottom edges, in hinge arms pressed into the top and bottom panels. */
function pivotDoors(g: G, o: Inner, n: 1 | 2) {
  const { W, H, D, t } = g;
  const Wi = W - 2 * t;
  const dw = n === 1 ? Wi - 4 : (Wi - 7) / 2;
  const doors = n === 1 ? [{ id: "DR", x: 0, hx: W / 2 - t - 22 }] : [{ id: "DL", x: -(1.5 + dw / 2), hx: -(W / 2 - t - 22) }, { id: "DR", x: 1.5 + dw / 2, hx: W / 2 - t - 22 }];
  for (const d of doors) o.parts.push({ id: d.id, name: "Door", size: [dw, H - 2 * t - 4, 16], pos: [d.x, H / 2, D / 2 - 8], material: "board" });
  const zh = D / 2 - 26;
  o.steps.push({
    title: n === 1 ? "Press in the hinge bushings" : "Press in the four hinge bushings",
    detail: n === 1 ? "Into the holes at the front right corner of the top and bottom panels, from inside." : "Into the holes at both front corners of the top and bottom panels, from inside.",
    fix: [
      fx("spacer", "B", doors.map((d) => [d.hx, t, zh] as Vec3), [0, -1, 0], { name: "Hinge bushing", len: 10, dia: 14 }),
      fx("spacer", "T", doors.map((d) => [d.hx, H - t, zh] as Vec3), [0, 1, 0], { name: "Hinge bushing", len: 10, dia: 14 }),
    ],
  });
  o.steps.push({
    title: "Push the hinge arms into the bushings",
    detail: "One at the top and one at the bottom for each door, the arms pointing to the front.",
    fix: [
      fx("hinge", "B", doors.map((d) => [d.hx, t + 6, zh + 8] as Vec3), [0, -1, 0], { name: "Hinge arm", len: 44, dia: 16 }),
      fx("hinge", "T", doors.map((d) => [d.hx, H - t - 6, zh + 8] as Vec3), [0, 1, 0], { name: "Hinge arm", len: 44, dia: 16 }),
    ],
  });
  // the stop screw sits where the push opener meets the door
  const stops: Vec3[] = n === 1 ? [[-(W / 2 - t - 30), H / 2, D / 2 - 16]] : [[-70, H - t - 30, D / 2 - 16], [70, H - t - 30, D / 2 - 16]];
  const yp = (H - 2 * t - 4) / 2;
  const fixes: CustomFix[] = [
    fx("washer", undefined, stops, [0, 0, 1], { len: 1.5, dia: 14 }),
    fx("screw", undefined, stops.map((p) => [p[0], p[1], p[2] - 1] as Vec3), [0, 0, 1], { len: 16, dia: 4 }),
    fx("stud", undefined, doors.map((d) => [d.hx, H / 2 + yp, D / 2 - 8] as Vec3), [0, -1, 0], { name: "Upper pivot pin", len: 26, dia: 8 }),
    fx("stud", undefined, doors.map((d) => [d.hx, H / 2 - yp, D / 2 - 8] as Vec3), [0, 1, 0], { name: "Lower pivot pin", len: 26, dia: 8 }),
  ];
  if (n === 2) fixes.push(fx("glide", undefined, [[-3, H - t - 40, D / 2 - 16], [3, H - t - 40, D / 2 - 16]].map((p) => p as Vec3), [0, 0, 1], { name: "Door bumper", len: 3, dia: 10 }));
  o.steps.push({
    title: n === 1 ? "Fit the stop and the pins to the door" : "Fit the stops, pins and bumpers to the doors",
    detail:
      n === 1
        ? "Lay the door face down. Screw the stop and its washer in where the push opener will meet it, and press a pin into each end of the hinge edge."
        : "Lay the doors face down. A stop screw and washer where each push opener meets it, a pin in each end of the hinge edge, and the two bumpers by the edges where the doors meet.",
    add: doors.map((d) => d.id),
    from: Object.fromEntries(doors.map((d) => [d.id, [0, 0, 420] as Vec3])),
    fix: fixes,
    tools: ["screwdriver"],
  });
  o.steps.push({
    title: n === 1 ? "Hang the door" : "Hang the doors",
    detail: "Set the bottom pin into the lower arm, then swing the upper arm over the top pin until it clicks. A light push opens it.",
    kind: "doors",
  });
}

/** The media shelf's flap: hinges and a stop on the flap, hinge plates in the sides, clicked on, then the shelf and the cable cover. */
function mediaFlap(g: G, o: Inner) {
  const { W, D, t } = g;
  const top = o.ySh - t / 2 - 2;
  const fh = top - t - 2;
  o.parts.push({ id: "FL", name: "Flap", size: [W - 2 * t - 4, fh, 16], pos: [0, t + 2 + fh / 2, D / 2 - 8], material: "board" });
  const hx = W / 2 - t - 24;
  const hy = t + 26;
  o.steps.push({
    title: "Fit the hinges to the flap",
    detail: "Lay it face down. Click a hinge onto each bottom corner, the left one and the right one, then two screws through each.",
    add: ["FL"],
    from: { FL: [0, 0, 420] },
    fix: [
      fx("hinge", "FL", [[-hx, hy, D / 2 - 18], [hx, hy, D / 2 - 18]], [0, 0, 1], { name: "Flap hinge", len: 40, dia: 30 }),
      fx("screw", "FL", [-hx - 10, -hx + 10, hx - 10, hx + 10].map((x) => [x, hy, D / 2 - 16] as Vec3), [0, 0, 1], { len: 14, dia: 4 }),
    ],
    tools: ["screwdriver"],
  });
  o.steps.push({
    title: "Screw the stop onto the flap",
    detail: "Near its top left corner, with the washer under the head, where the push opener meets it.",
    fix: [
      fx("washer", "FL", [[-(W / 2 - t - 30), top - 40, D / 2 - 16]], [0, 0, 1], { len: 1.5, dia: 14 }),
      fx("screw", "FL", [[-(W / 2 - t - 30), top - 40, D / 2 - 17]], [0, 0, 1], { len: 16, dia: 4 }),
    ],
    tools: ["screwdriver"],
  });
  const plate = (sx: number): CustomFix[] => [
    fx("clip", sx < 0 ? "L" : "R", [[sx * (W / 2 - t - 3), hy, D / 2 - 40]], [sx, 0, 0], { name: sx < 0 ? "Hinge plate, left" : "Hinge plate, right", len: 6, dia: 40 }),
    fx("screw", sx < 0 ? "L" : "R", [-24, 24].map((dy) => [sx * (W / 2 - t - 6), hy + dy, D / 2 - 40] as Vec3), [sx, 0, 0], { len: 14, dia: 4 }),
  ];
  o.steps.push({
    title: "Screw the hinge plates inside the sides",
    detail: "The plate marked L on the left side, R on the right, at the bottom front. Two screws each.",
    fix: [...plate(-1), ...plate(1)],
    tools: ["screwdriver"],
  });
  o.steps.push({
    title: "Click the flap onto the plates",
    detail: "Hold it level, push each hinge onto its plate until it clicks, then fold it up. A light push opens it.",
    kind: "doors",
  });
  shelf(g, o);
  o.steps.push({
    title: "Put the cable cover in the ring",
    detail: "Press it into the ring in the top. Its slot lets the cables through.",
    fix: [fx("cap", "T", [[W / 2 - 130, g.H + 4, -D / 2 + 80]], [0, -1, 0], { name: "Cable cover", len: 10, dia: 60 })],
  });
}

interface Drawer {
  i: number;
  y: number; // bottom of the drawer box
  bw: number; // box width
  bd: number; // box depth (without the front)
  bh: number;
  zf: number; // back face of the front
  sx: (s: number) => number; // centre of the left (-1) or right (1) side
  k: { front: string; a: string; b: string; back: string; bottom: string };
  off: Vec3; // where it is built: on the floor in front of the frame
}

/** Both drawers, built on the floor in front of the frame and slid in at the end. */
function drawerBoxes(b: PlanBuilder, g: G, zIn: number, st: number): Drawer[] {
  const { W, H, D, t } = g;
  const Hi = H - 2 * t;
  const fh = (Hi - 6) / 2;
  const zf = D / 2 - 16;
  const bd = Math.round(zf - zIn - 20);
  const bw = W - 2 * t - 30;
  const bh = Math.round(fh - 40);
  const frontT = b.part("Drawer front", [W - 2 * t - 4, fh, 16], { material: "board" });
  const sideT = b.part("Drawer side", [st, bh, bd], { material: "board" });
  const backT = b.part("Drawer back", [bw - 2 * st, bh, st], { material: "board" });
  const botT = b.part("Drawer bottom", [bw - 2 * st + 10, 3, bd - st], { material: "fiber" });
  return [0, 1].map((i) => {
    const fy = t + 2 + fh / 2 + i * (fh + 2);
    const y = t + 18 + i * (Hi / 2);
    const k = {
      front: b.place(frontT, [0, fy, D / 2 - 8]),
      a: b.place(sideT, [-bw / 2 + st / 2, y + bh / 2, zf - bd / 2]),
      b: b.place(sideT, [bw / 2 - st / 2, y + bh / 2, zf - bd / 2]),
      back: b.place(backT, [0, y + bh / 2, zf - bd + st / 2]),
      bottom: b.place(botT, [0, y + 10, zf - (bd - st) / 2]),
    };
    const off: Vec3 = [(i ? 1 : -1) * (W / 2 + 40), -(t + 2 + i * (fh + 2)), D / 2 + 160 + bd - zf];
    return { i, y, bw, bd, bh, zf, sx: (s: number) => s * (bw / 2 - st / 2), k, off };
  });
}

function stageAll(b: PlanBuilder, ds: Drawer[], pick: (d: Drawer) => string[], from: Vec3 = [0, 160, 0]) {
  b.stagger(0.12);
  for (const d of ds)
    for (const key of pick(d)) {
      const f = b.partItem(key).final;
      b.stage(key, [f.pos[0] + d.off[0], f.pos[1] + d.off[1], f.pos[2] + d.off[2]], f.rot, from);
    }
  b.then(0.12);
}

function slideIn(b: PlanBuilder, ds: Drawer[], detail: string) {
  b.step({ title: "Slide the drawers in", detail, kind: "drawer" }, () => {
    b.stagger(0.3);
    for (const d of ds) {
      b.stagger(0);
      for (const key of Object.values(d.k)) b.add(key, [0, 0, 380]);
      b.stagger(0.3);
      b.then(0.1);
    }
  });
}

/** The 70 cm unit's drawers: box clicked together, bottom slid in, front knocked on, runner locks under it, the sync rods. */
function drawers70(b: PlanBuilder, g: G, zIn: number) {
  const { W, D, t } = g;
  const st = 12;
  const ds = drawerBoxes(b, g, zIn, st);
  b.step({ title: "Click the drawer sides onto the backs", detail: "For both drawers, on the floor. Press each corner together until it clicks.", kind: "join", warnings: ["floor"] }, () =>
    stageAll(b, ds, (d) => [d.k.back, d.k.a, d.k.b]),
  );
  b.step({ title: "Slide the bottoms into the grooves", detail: "All the way down, good side up.", kind: "join" }, () => stageAll(b, ds, (d) => [d.k.bottom], [0, 0, -260]));
  b.step({ title: "Knock the fronts on", detail: "Push four fittings into the front ends of the sides, lay the front on and knock it down onto them with a hammer.", kind: "nails", tools: ["hammer"] }, () => {
    const list: FitOpts[] = ds.flatMap((d) => [-1, 1].flatMap((s) => [d.y + 20, d.y + d.bh - 20].map((y) => ({ on: s < 0 ? d.k.a : d.k.b, at: [d.sx(s), y, d.zf] as Vec3, dir: [0, 0, -1] as Vec3 }))));
    b.fits({ kind: "dowel", len: 24, dia: 6, name: "Push-in fitting" }, list, 0.05);
    b.then(0.1);
    stageAll(b, ds, (d) => [d.k.front], [0, 0, 200]);
  });
  const lx = (s: number, d: Drawer) => s * (d.bw / 2 - 40);
  b.step({ title: "Screw the runner locks under the fronts", detail: "One under each front corner of each drawer, two screws each. They hold the drawer on its runners.", kind: "screws", tools: ["screwdriver"] }, () => {
    b.fits({ kind: "clip", len: 16, dia: 40, name: "Runner lock" }, ds.flatMap((d) => [-1, 1].map((s) => ({ on: d.k.bottom, at: [lx(s, d), d.y + 8.5, d.zf - 40] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const }))), 0.08);
    b.then(0.1);
    b.fits({ kind: "screw", len: 12, dia: 3.5 }, ds.flatMap((d) => [-1, 1].flatMap((s) => [-12, 12].map((dz) => ({ on: d.k.bottom, at: [lx(s, d), d.y + 8.5, d.zf - 40 + dz] as Vec3, dir: [0, 1, 0] as Vec3 })))), 0.04);
  });
  const rl = (W - 2 * t - 40) / 2;
  b.step({ title: "Join the sync rods and clip them in", detail: "Pull the runners out. Push two rods into a joiner for each drawer, then clip the ends into the backs of the runners.", kind: "runners" }, () => {
    b.fits({ kind: "stud", len: rl, dia: 5, name: "Sync rod" }, ds.flatMap((d) => [-1, 1].map((j) => ({ at: [j * 3, runYOf(g, d.i), -D / 2 + 60] as Vec3, dir: [-j, 0, 0] as Vec3 }))), 0.08);
    b.then(0.1);
    b.fits({ kind: "connector", len: 40, dia: 10, name: "Rod joiner" }, ds.map((d) => ({ at: [0, runYOf(g, d.i), -D / 2 + 60] as Vec3, dir: [0, 1, 0] as Vec3 })), 0.08);
  });
  slideIn(b, ds, "Lay each drawer on its pulled-out runners and push down at the back until both sides click. A light push on the front opens it.");
}

/** The 35 cm unit's drawers: cam bolts in the front, rails on the sides, dowels, cam locks, bottom, back screwed on. */
function drawers35(b: PlanBuilder, g: G, zIn: number) {
  const st = 14;
  const ds = drawerBoxes(b, g, zIn, st);
  const ys = (d: Drawer) => [d.y + 25, d.y + d.bh - 25];
  b.step({ title: "Screw the cam bolts into the drawer fronts", detail: "Lay both fronts face down on the floor. Four cam bolts in each, in the holes near the ends.", kind: "cams", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    stageAll(b, ds, (d) => [d.k.front]);
    b.fits(HW.camScrew, ds.flatMap((d) => [-1, 1].flatMap((s) => ys(d).map((y) => ({ on: d.k.front, at: [d.sx(s), y, d.zf] as Vec3, dir: [0, 0, 1] as Vec3 })))), 0.05);
  });
  b.step({ title: "Screw the rails onto the drawer sides", detail: "One rail along the bottom of each side, two screws each.", kind: "runners", tools: ["screwdriver"] }, () => {
    stageAll(b, ds, (d) => [d.k.a, d.k.b]);
    const rl = ds[0].bd - 20;
    b.fits({ kind: "runner", len: rl, dia: 16, name: "Drawer rail" }, ds.flatMap((d) => [-1, 1].map((s) => ({ on: s < 0 ? d.k.a : d.k.b, at: [s * (d.bw / 2), d.y + 14, d.zf - d.bd / 2] as Vec3, dir: [-s, 0, 0] as Vec3, hole: false as const }))), 0.08);
    b.then(0.1);
    b.fits({ kind: "screw", len: 10, dia: 3.5 }, ds.flatMap((d) => [-1, 1].flatMap((s) => [-d.bd / 3, d.bd / 3].map((dz) => ({ on: s < 0 ? d.k.a : d.k.b, at: [s * (d.bw / 2), d.y + 14, d.zf - d.bd / 2 + dz] as Vec3, dir: [-s, 0, 0] as Vec3 })))), 0.04);
  });
  b.step({ title: "Tap a dowel into the back end of each side", detail: "Halfway in, so the back can sit on them. Then stand the sides on the cam bolts in the front.", kind: "dowels", tools: ["hammer"] }, () => {
    b.fits(HW.dowel, ds.flatMap((d) => [-1, 1].map((s) => ({ on: s < 0 ? d.k.a : d.k.b, at: [d.sx(s), d.y + d.bh / 2, d.zf - d.bd] as Vec3, dir: [0, 0, 1] as Vec3 }))), 0.06);
  });
  b.step({ title: "Turn the cam locks", detail: "Four in each drawer, in the sides over the cam bolts. Turn each one clockwise until it pulls tight.", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(HW.cam, ds.flatMap((d) => [-1, 1].flatMap((s) => ys(d).map((y) => ({ on: s < 0 ? d.k.a : d.k.b, at: [s * (d.bw / 2 - st), y, d.zf - 30] as Vec3, dir: [s, 0, 0] as Vec3 })))), 0.06);
  });
  b.step({ title: "Slide the bottoms into the grooves", detail: "Good side in, all the way to the front.", kind: "join" }, () => stageAll(b, ds, (d) => [d.k.bottom], [0, 0, -260]));
  b.step({ title: "Screw the backs on", detail: "Lay each back onto the dowels, then four screws through it into the sides.", kind: "screws", tools: ["screwdriver"] }, () => {
    stageAll(b, ds, (d) => [d.k.back], [0, 0, -200]);
    b.fits({ kind: "screw", len: 40, dia: 5 }, ds.flatMap((d) => [-1, 1].flatMap((s) => ys(d).map((y) => ({ on: d.k.back, at: [d.sx(s), y, d.zf - d.bd] as Vec3, dir: [0, 0, 1] as Vec3 })))), 0.05);
  });
  slideIn(b, ds, "Line the rails up with the runners and push each drawer in until it clicks. A light push on the front opens it.");
}

const family: Family = {
  names: ["EKET"],
  // the drawer units: the frame from the recipe, then the drawers built on the floor in front of it
  build(b, s) {
    const g = kindOf(s);
    if (!g || (g.kind !== "drawers" && g.kind !== "drawers35")) return false;
    const r = recipeOf(g);
    buildCustom(b, { ...s, custom: r });
    const zIn = -g.D / 2 + 10 + BT / 2;
    if (g.kind === "drawers") drawers70(b, g, zIn);
    else drawers35(b, g, zIn);
    return true;
  },
  recipe(s) {
    const g = kindOf(s);
    if (!g || g.kind === "drawers" || g.kind === "drawers35") return null;
    return recipeOf(g);
  },
};
export default family;
