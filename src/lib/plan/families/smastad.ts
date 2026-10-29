import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * SMÅSTAD, read from its manuals. Most of the range is a PLATSA frame (60, 120 or 180 high) or an UPPFÖRA frame
 * with SMÅSTAD fronts. A PLATSA frame goes together lying on its front: top, bottom and the other side click onto a
 * side, the back slides in and is locked with eight rivets, two wall spacers go into the top, LÄTTHET feet screw into
 * the bottom, then it is stood up (two people for the tall ones), the spacer caps screw on and two screws through
 * washers fix it to the wall. The low ones get a SMÅSTAD top on four sleeves and click pins. An UPPFÖRA frame starts
 * with its plinth (dowels, four feet), the bottom is screwed onto it, then top and sides hook together lying on their
 * back, the back slides in, the base is pushed in and the back is clipped on standing up; its wall screws are in the
 * box. HJÄLPA shelves and rails, KONSTRUERA drawers (built standing on their front panel, runners screwed on
 * upside down), the UPPFÖRA plinth drawer on castors and HJÄLPA soft-closing hinges follow their own manuals.
 * The bench is cam-locked upside down; the wall storage is a small frame that hangs on a LÄTTHET rail. The changing
 * table/desk is its own frame (bottom, shelf and divider, then the sides lying on its back, two backs, four feet),
 * screwed to the wall, with a rimmed tray that slides onto two brackets: high for changing, low for the desk, which
 * also gets two KONSTRUERA drawers.
 */

const FEET = 10; // LÄTTHET adjustable feet under a PLATSA frame
const DOOR = 20;

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
const many = (n: number, one: string, more: string) => (n === 1 ? one : more);
const fixAt = (d: HwDef, at: Vec3[], dir: Vec3, on?: string, mate?: string): CustomFix => ({ kind: d.kind, len: d.len, dia: d.dia, count: at.length, at, dir, on, mate });

// frames
const RIVET_PLUG: HwDef = { kind: "clip", len: 12, dia: 8 };
const RIVET_PIN: HwDef = { kind: "clip", len: 16, dia: 5 };
const SPACER: HwDef = { kind: "stud", len: 22, dia: 30 }; // a wall spacer: no kind of its own
const SPACER_CAP: HwDef = { kind: "cap", len: 18, dia: 26 };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 22 };
const COVER: HwDef = { kind: "cap", len: 6, dia: 20 };
const FOOT: HwDef = { kind: "foot", len: 20, dia: 30 };
const FOOT_PAD: HwDef = { kind: "glide", len: 3, dia: 40 };
const TOP_SLEEVE: HwDef = { kind: "nut", len: 14, dia: 12 };
const TOP_WASHER: HwDef = { kind: "washer", len: 2, dia: 20 };
const TOP_PIN: HwDef = { kind: "clip", len: 40, dia: 7 };
const U_DOWEL: HwDef = HW.dowel;
const U_FOOT: HwDef = { kind: "foot", len: 30, dia: 24 };
const U_SCREW: HwDef = { kind: "screw", len: 50, dia: 6 };
const U_CLIP: HwDef = { kind: "clip", len: 14, dia: 14 };
const U_CLIP_PIN: HwDef = { kind: "clip", len: 10, dia: 6 };
const U_PLUG: HwDef = { kind: "plug", len: 50, dia: 8 }; // in the UPPFÖRA box
const U_WALL_SCREW: HwDef = { kind: "screw", len: 80, dia: 5 };
// inside
const SHELF_PIN: HwDef = { kind: "pin", len: 16, dia: 6 };
const RAIL_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const RAIL_WASHER: HwDef = { kind: "washer", len: 1.5, dia: 12 };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 9 };
// KONSTRUERA drawer
const D_STOP: HwDef = { kind: "clip", len: 10, dia: 16 };
const D_PIN: HwDef = { kind: "camScrew", len: 30, dia: 6 };
const D_CAM: HwDef = { kind: "cam", len: 12, dia: 15 };
const D_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const D_SMALL: HwDef = { kind: "screw", len: 8, dia: 3.5 };
// UPPFÖRA plinth drawer
const P_CASTOR: HwDef = { kind: "castor", len: 24, dia: 28 };
const P_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const P_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const P_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };

function keyAt(b: PlanBuilder, pos: Vec3) {
  return b.items.find((x) => x.kind === "part" && x.final.pos.every((v, i) => Math.abs(v - pos[i]) < 0.5))?.key;
}

type StepOpts = { title: string; detail?: string; kind?: StepKind; tools?: ToolId[]; pose?: Pose; scene?: string; people?: 1 | 2; repeat?: number; warnings?: WarnId[]; wall?: boolean };
const step = (b: PlanBuilder, o: StepOpts, body: () => void = () => {}) =>
  b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);

/* ---------- what each frame guide holds ---------- */

type Rail = { kind: "fixed" | "adjust" | "susp"; y: number };

interface Unit {
  sys: "platsa" | "uppfora";
  W: number;
  D: number; // whole depth, fronts included
  df: number; // frame depth
  fh: number; // height of the fronts
  t: number; // panel thickness
  fy: number; // bottom of the fronts: the feet under a PLATSA frame, the plinth under an UPPFÖRA one
  top: boolean; // a SMÅSTAD top
  shelves: number[]; // top face of each shelf, from fy
  rails: Rail[]; // from fy
  drawers: number[]; // front heights, from the bottom up
  doors: 0 | 2 | 4;
}

interface Geo {
  z0: number;
  zf: number; // front edge of the frame
  xi: number; // inner face of a side
  floor: number; // inside bottom
  ceil: number; // underside of the top panel
  H: number; // top of the frame
}

const U_PLINTH = 160; // an UPPFÖRA frame's bottom panel sits on a plinth this high

function unitOf(s: ProductSpec): Unit | null {
  const slug = s.slug ?? "";
  if (!/^smastad-(platsa|uppfora)-|^smastad-wardrobe-/.test(slug)) return null;
  const up = slug.startsWith("smastad-uppfora");
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  if (Math.abs(W - 600) > 5) return null;
  const fh = [600, 1200, 1800].reduce((a, c) => (Math.abs(c - (H - (up ? U_PLINTH : FEET))) < Math.abs(a - (H - (up ? U_PLINTH : FEET))) ? c : a));
  const top = !up && fh < 1800;
  const n3 = [300, 150, 150], n6 = [300, 300, 150, 150, 150, 150];
  let shelves: number[] = [];
  let rails: Rail[] = [];
  let drawers: number[] = [];
  let doors: 0 | 2 | 4 = 0;
  if (/chest-3|3-drawer/.test(slug)) drawers = n3;
  else if (/chest-6|6-drawer/.test(slug)) drawers = n6;
  else if (slug.includes("cabinet")) {
    shelves = [fh / 2];
    doors = 2;
  } else if (slug.includes("bookcase")) {
    drawers = fh === 1200 ? (up ? [300, 300] : n3) : up ? [300, 300, 300, 300] : n6;
    shelves = [fh - 600, fh - 300];
  } else if (slug.includes("wardrobe")) {
    if (fh === 1800) {
      doors = 4;
      shelves = [900];
      const t = up ? 18 : 16;
      rails = slug.startsWith("smastad-wardrobe-")
        ? [{ kind: "fixed", y: fh - t - 70 }, { kind: "fixed", y: 900 - 18 - 70 }]
        : [{ kind: "susp", y: fh - t - 90 }, { kind: "adjust", y: 900 - 18 - 70 }];
    } else {
      doors = 2;
      shelves = [300, 600, 900];
    }
  } else return null;
  return { sys: up ? "uppfora" : "platsa", W, D, df: D - DOOR, fh, t: up ? 18 : 16, fy: up ? U_PLINTH : FEET, top, shelves, rails, drawers, doors };
}

function geoOf(u: Unit): Geo {
  const z0 = -u.D / 2;
  return { z0, zf: z0 + u.df, xi: u.W / 2 - u.t, floor: u.sys === "platsa" ? u.fy + u.t : u.fy, ceil: u.fy + u.fh - u.t, H: u.fy + u.fh };
}

/* ---------- the PLATSA frame ---------- */

function platsaFrame(u: Unit, g: Geo): CustomParams {
  const { W, fh, df, t } = u;
  const y0 = u.fy;
  const pd = df - 3, zm = g.z0 + 3 + pd / 2;
  const tall = fh >= 1200;
  const side = (sx: number): CustomPart => ({ id: sx < 0 ? "L" : "R", name: "Side panel", size: [t, fh, pd], pos: [sx * (W / 2 - t / 2), y0 + fh / 2, zm], material: "board" });
  const parts: CustomPart[] = [
    side(-1),
    { id: "T", name: "Top and bottom panel", size: [W - 2 * t, t, pd], pos: [0, y0 + fh - t / 2, zm], material: "board" },
    { id: "B", name: "Top and bottom panel", size: [W - 2 * t, t, pd], pos: [0, y0 + t / 2, zm], material: "board" },
    side(1),
    { id: "K", name: "Back panel", size: [W, fh, 3], pos: [0, y0 + fh / 2, g.z0 + 1.5], material: "fiber" },
  ];
  const xs = spread(-W / 2 + 50, W / 2 - 80, 4);
  const rows: [number, string][] = [[y0 + fh - t / 2, "T"], [y0 + t / 2, "B"]];
  const sx2 = [-W / 2 + 120, W / 2 - 120];
  const feet = (y: number) => [-1, 1].flatMap((sx) => [g.z0 + 60, g.zf - 60].map((z): Vec3 => [sx * (W / 2 - 50), y, z]));
  const steps: CustomStep[] = [
    {
      title: "Click the top panel onto a side panel",
      detail: tall
        ? "Together, on a rug: hold the side on its front edge and push the top down onto its fittings until it clicks."
        : "On a rug, with the side on its front edge. Push the top down onto its fittings until it clicks.",
      add: ["L", "T"],
      pose: "-z",
      people: tall ? 2 : 1,
      warnings: tall ? ["two", "floor"] : ["floor"],
    },
    { title: "Click on the bottom panel", detail: "Same way, at the other end of the side.", add: ["B"] },
    { title: "Click on the other side panel", detail: "Line up its fittings with both panels and press it down until both ends click.", add: ["R"] },
    { title: "Slide in the back panel", detail: "White side in. Push it along the grooves from the open end until it stops.", add: ["K"], from: { K: [0, Math.min(700, fh * 0.6), 0] } },
    {
      title: "Lock the back with the rivets",
      detail: "Push a plug into each hole along the top and bottom, then press a pin into each one.",
      fix: [...rows.map(([y, mate]) => fixAt(RIVET_PLUG, xs.map((x): Vec3 => [x, y, g.z0]), [0, 0, 1], "K", mate)), fixAt(RIVET_PIN, rows.flatMap(([y]) => xs.map((x): Vec3 => [x + 30, y, g.z0])), [0, 0, 1], "K")],
    },
    { title: "Press the wall spacers into the top", detail: "Into the two holes in its back edge.", fix: [fixAt(SPACER, sx2.map((x): Vec3 => [x, y0 + fh - t / 2, g.z0]), [0, 0, 1], "T")] },
    {
      title: "Screw the feet into the bottom",
      detail: "Screw a pad onto each foot first, then turn the four feet into the holes near the corners by hand.",
      fix: [fixAt(FOOT_PAD, feet(1.5), [0, 1, 0], "B"), fixAt(FOOT, feet(y0), [0, 1, 0], "B")],
    },
    {
      title: tall ? "Stand it up together" : "Stand it up",
      detail: tall ? "Lift it from the top end while the other person keeps the bottom on the floor. Don't drag it up by one corner." : "Lift it upright, don't drag it up by one corner.",
      pose: "+y",
      people: tall ? 2 : 1,
      warnings: tall ? ["two"] : [],
    },
    { title: "Screw the caps onto the spacers", detail: "Turn them on by hand at the back of the top.", fix: [fixAt(SPACER_CAP, sx2.map((x): Vec3 => [x, y0 + fh - t / 2, g.z0 - 24]), [0, 0, 1], "T")] },
    { title: "Push it against the wall", detail: "Turn the caps in or out until it stands straight and clear of the skirting board.", warnings: ["tip"] },
    { title: "Level it on the feet", detail: "Turn each foot by hand until it stands level and doesn't rock.", tools: ["level"] },
  ];
  return { parts, steps };
}

/* ---------- the UPPFÖRA frame: plinth and bottom first, then the box round it ---------- */

function uppforaFrame(u: Unit, g: Geo): CustomParams {
  const { W, fh, df, t } = u;
  const H = g.H, z0 = g.z0;
  const PH = 132;
  const yb = FEET + PH; // underside of the bottom panel
  const py = FEET + PH / 2;
  const pd = df - 3, zm = z0 + 3 + pd / 2;
  const xp = W / 2 - t - t / 2;
  const plD = pd - 20; // the plinth sides stop short of the drawer front
  const zpf = z0 + 3 + plD; // front end of the plinth sides
  const tall = fh >= 1200;
  const parts: CustomPart[] = [
    { id: "PB", name: "Plinth back", size: [W - 4 * t, PH, t], pos: [0, py, z0 + 3 + t / 2], material: "board" },
    { id: "PC", name: "Plinth rail", size: [W - 4 * t, 60, t], pos: [0, yb - 30, z0 + 3 + t * 1.5], material: "board" },
    { id: "PL", name: "Plinth side", size: [t, PH, plD], pos: [-xp, py, z0 + 3 + plD / 2], material: "board" },
    { id: "PR", name: "Plinth side", size: [t, PH, plD], pos: [xp, py, z0 + 3 + plD / 2], material: "board" },
    { id: "BT", name: "Bottom panel", size: [W - 2 * t, t, pd], pos: [0, yb + t / 2, zm], material: "board" },
    { id: "SL", name: "Side panel", size: [t, H - FEET, df], pos: [-(W / 2 - t / 2), FEET + (H - FEET) / 2, z0 + df / 2], material: "board" },
    { id: "TP", name: "Top panel", size: [W - 2 * t, t, pd], pos: [0, H - t / 2, zm], material: "board" },
    { id: "SR", name: "Side panel", size: [t, H - FEET, df], pos: [W / 2 - t / 2, FEET + (H - FEET) / 2, z0 + df / 2], material: "board" },
    { id: "BK", name: "Back panel", size: [W - 2 * t + 12, H - yb - t, 3], pos: [0, yb + t + (H - yb - t) / 2, z0 + 1.5], material: "fiber" },
  ];
  const xj = W / 2 - 2 * t; // where the plinth rails meet the plinth sides
  const rail = (id: string, ys: number[], z: number) =>
    [-1, 1].map((sx) => fixAt(U_DOWEL, ys.map((y): Vec3 => [sx * xj, y, z]), [sx, 0, 0], id, sx < 0 ? "PL" : "PR"));
  const footPts = (sx: number): Vec3[] => [z0 + 3 + 40, zpf - 40].map((z): Vec3 => [sx * xp, FEET, z]);
  const screwPts = (sx: number): Vec3[] => [z0 + 3 + 70, zpf - 70].map((z): Vec3 => [sx * xp, yb + t, z]);
  const clips = tall ? 3 : 5;
  const clipRows: [number, string][] = [[H - t / 2, "TP"], [yb + t / 2, "BT"]];
  const clipXs = spread(-W / 2 + 90, W / 2 - 90, clips);
  const sx2 = [-W / 2 + 120, W / 2 - 120];
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the plinth rails",
      detail: "Lay the plinth back and the rail on a rug. Two dowels in each end.",
      fix: [...rail("PB", [py - 35, py + 35], z0 + 3 + t / 2), ...rail("PC", [yb - 45, yb - 15], z0 + 3 + t * 1.5)],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Push the plinth sides onto them", detail: "The holes for the feet face down.", add: ["PL", "PR"] },
    { title: "Turn it over and screw in the feet", detail: "Four feet, one near each end of the plinth sides. Turn them in by hand.", pose: "-y", fix: [fixAt(U_FOOT, footPts(-1), [0, 1, 0], "PL"), fixAt(U_FOOT, footPts(1), [0, 1, 0], "PR")] },
    {
      title: "Turn it back and tap in two dowels",
      detail: "One into the top of each plinth side, at the front end.",
      pose: "+y",
      fix: [fixAt(U_DOWEL, [[-xp, yb, zpf - 30]], [0, 1, 0], "PL", "BT"), fixAt(U_DOWEL, [[xp, yb, zpf - 30]], [0, 1, 0], "PR", "BT")],
      tools: ["hammer"],
    },
    { title: "Lay the bottom panel on", detail: "Onto the dowels, flush with the plinth at the back.", add: ["BT"] },
    {
      title: "Screw the bottom panel to the plinth",
      detail: "Four long screws down into the plinth sides, with the Allen key.",
      fix: [fixAt(U_SCREW, screwPts(-1), [0, -1, 0], "BT", "PL"), fixAt(U_SCREW, screwPts(1), [0, -1, 0], "BT", "PR")],
      tools: ["allen"],
    },
    {
      title: "Hook the top panel onto a side panel",
      detail: "Lay the side on a rug on its back edge, the warning label inside. Push the top's three fittings into the keyholes and press down until it locks.",
      add: ["SL", "TP"],
      pose: "+z",
      people: tall ? 2 : 1,
      warnings: tall ? ["two", "floor"] : ["floor"],
    },
    { title: "Hook on the other side panel", detail: "Three fittings again. Press it down until it locks.", add: ["SR"] },
    { title: "Slide in the back panel", detail: "White side in, along the grooves in both sides, until it reaches the top.", add: ["BK"], from: { BK: [0, -Math.min(600, H * 0.4), 0] } },
    { title: "Push the base into the frame", detail: "Plinth first, into the open end, until the bottom's fittings drop into the keyholes in both sides. The back rests on the bottom panel." },
    {
      title: tall ? "Stand it up together and clip on the back" : "Stand it up and clip on the back",
      detail: "Push a clip through each hole in the back, then a pin into each clip until it clicks.",
      pose: "+y",
      people: tall ? 2 : 1,
      warnings: tall ? ["two"] : [],
      fix: [...clipRows.map(([y, mate]) => fixAt(U_CLIP, clipXs.map((x): Vec3 => [x, y, z0]), [0, 0, 1], "BK", mate)), fixAt(U_CLIP_PIN, clipRows.flatMap(([y]) => clipXs.map((x): Vec3 => [x + 24, y, z0])), [0, 0, 1], "BK")],
    },
    { title: "Press the wall spacers into the top", detail: "Into the two holes in its back edge.", fix: [fixAt(SPACER, sx2.map((x): Vec3 => [x, H - t / 2, z0]), [0, 0, 1], "TP")] },
    { title: "Screw the caps onto the spacers", detail: "By hand.", fix: [fixAt(SPACER_CAP, sx2.map((x): Vec3 => [x, H - t / 2, z0 - 24]), [0, 0, 1], "TP")] },
    { title: "Push it against the wall", detail: "Turn the caps in or out until it stands straight and clear of the skirting board.", warnings: ["tip"] },
    { title: "Level it on the feet", detail: "Turn the four feet with the spanner until it stands level and steady.", tools: ["wrench", "level"] },
  ];
  return { parts, steps };
}

/* ---------- the wall, drawn by hand so the plug, washer, screw and cover share a hole ---------- */

function wallStep(b: PlanBuilder, host: string, pts: Vec3[], o: { two: boolean; included: boolean }) {
  step(
    b,
    {
      title: "Fix it to the wall",
      detail: o.included
        ? "Mark and drill two holes through the back near the top, tap in the plugs, then the screws through washers. Click the covers on. The plugs suit solid walls: for others, use fixings made for your wall."
        : "Two screws through washers, through the back near the top, then click the covers on. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: o.included ? ["screwdriver", "drill", "pencil", "hammer"] : ["screwdriver", "drill", "pencil"],
      kind: "anchor",
      wall: true,
      people: o.two ? 2 : 1,
      warnings: ["wall", "tip"],
    },
    () => {
      b.stagger(0.12);
      for (const at of pts) b.fit(o.included ? U_PLUG : HW.plug, { at: [at[0], at[1], at[2] - 30], dir: [0, 0, -1] });
      b.then(0.1);
      for (const at of pts) b.fit(WASHER, { on: host, at, dir: [0, 0, -1], hole: false });
      b.then(0.05);
      for (const at of pts) b.fit(o.included ? U_WALL_SCREW : HW.wallScrew, { on: host, at: [at[0], at[1], at[2] + 2], dir: [0, 0, -1], hole: false });
      b.then(0.1);
      for (const at of pts) b.fit(COVER, { on: host, at: [at[0], at[1], at[2] + 4], dir: [0, 0, -1], hole: false });
    },
  );
}

/* ---------- the SMÅSTAD top: sleeves, washers, then pins clicked up from inside ---------- */

function topSteps(b: PlanBuilder, u: Unit, g: Geo, frameTop: string) {
  const Y = g.H;
  const top = b.place(b.part("Top", [u.W, 20, u.D]), [0, Y + 10, 0]);
  const pts = (y: number): Vec3[] => [-1, 1].flatMap((sx) => [g.z0 + 70, g.zf - 70].map((z): Vec3 => [sx * (u.W / 2 - u.t - 50), y, z]));
  step(b, { title: "Screw the sleeves into the top of the frame", detail: "Four, into the holes near the corners. Turn them in by hand.", kind: "screws" }, () =>
    b.fits(TOP_SLEEVE, pts(Y).map((at) => ({ on: frameTop, at, dir: [0, -1, 0] as Vec3 })), 0.12),
  );
  step(b, { title: "Put a washer on each sleeve", detail: "They keep the top from rubbing on the frame." }, () =>
    b.fits(TOP_WASHER, pts(Y + 2).map((at) => ({ on: frameTop, at, dir: [0, -1, 0] as Vec3, hole: false as const })), 0.12),
  );
  step(b, { title: "Lay the top on", detail: "Rest its back edge on the frame, then fold it down onto the sleeves. Flush at the back and the sides.", kind: "join" }, () => b.add(top, [0, 260, -260]));
  step(b, { title: "Click the pins in from below", detail: "From inside, push a pin up through each corner of the frame's top into its sleeve until it clicks." }, () =>
    b.fits(TOP_PIN, pts(Y - u.t - 34).map((at) => ({ on: frameTop, at, dir: [0, 1, 0] as Vec3, mate: top })), 0.15),
  );
}

/* ---------- shelves and rails ---------- */

function insideRecipe(u: Unit, g: Geo): CustomParams | null {
  const parts: CustomPart[] = [];
  const steps: CustomStep[] = [];
  const zr = g.z0 + 3 + (u.df - 3) / 2;
  const sd = u.df - 25;
  if (u.shelves.length) {
    const sid = (i: number) => `S${i}`;
    u.shelves.forEach((y, i) => parts.push({ id: sid(i), name: "Shelf", size: [2 * g.xi - 4, 18, sd], pos: [0, u.fy + y - 9, g.z0 + 3 + sd / 2], material: "board" }));
    const pins = (y: number): Vec3[] => [-1, 1].flatMap((sx) => [g.z0 + 60, g.z0 + sd - 40].map((z): Vec3 => [sx * g.xi, u.fy + y - 18 - 4, z]));
    steps.push({
      title: many(u.shelves.length, "Put in the shelf", "Put in the shelves"),
      detail: "Push four supports into the holes at the height you want, the same hole on each side, then lay the shelf on.",
      add: u.shelves.map((_, i) => sid(i)),
      fix: u.shelves.map((y, i) => fixAt(SHELF_PIN, pins(y), [0, -1, 0], sid(i))),
    });
  }
  const rail = (r: Rail, i: number, w: number): CustomPart => ({ id: `RL${i}`, name: r.kind === "adjust" ? "Adjustable clothes rail" : "Clothes rail", size: [w, 25, 25], pos: [0, u.fy + r.y, zr], shape: "cyl", material: "metal" });
  const fixed = u.rails.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "fixed");
  if (fixed.length) {
    for (const { r, i } of fixed) {
      parts.push(rail(r, i, 2 * g.xi - 12));
      for (const sx of [-1, 1]) parts.push({ id: `RL${i}${sx < 0 ? "a" : "b"}`, name: "Rail holder", size: [6, 60, 30], pos: [sx * (g.xi - 3), u.fy + r.y + 8, zr], material: "metal" });
    }
    steps.push({
      title: "Screw on the rail holders",
      detail: "One on each side for each rail, two screws in each.",
      add: fixed.flatMap(({ i }) => [`RL${i}a`, `RL${i}b`]),
      fix: fixed.flatMap(({ r, i }) => [-1, 1].map((sx) => fixAt(RAIL_SCREW, [[sx * (g.xi - 6), u.fy + r.y + 28, zr], [sx * (g.xi - 6), u.fy + r.y - 12, zr]], [sx, 0, 0], `RL${i}${sx < 0 ? "a" : "b"}`))),
      tools: ["screwdriver"],
    });
    steps.push({ title: many(fixed.length, "Lift the rail into the holders", "Lift the rails into the holders"), detail: "Drop each end into its holder.", add: fixed.map(({ i }) => `RL${i}`), from: Object.fromEntries(fixed.map(({ i }) => [`RL${i}`, [0, 0, 400] as Vec3])) });
  }
  for (const { r, i } of u.rails.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "susp")) {
    parts.push(rail(r, i, 2 * g.xi - 60));
    const xb = g.xi - 60;
    for (const sx of [-1, 1]) parts.push({ id: `RL${i}${sx < 0 ? "a" : "b"}`, name: "Rail bracket", size: [24, g.ceil - (u.fy + r.y) + 12, 30], pos: [sx * xb, (g.ceil + u.fy + r.y - 12) / 2, zr], material: "metal" });
    const pts = (sx: number): Vec3[] => [-10, 10].map((dz): Vec3 => [sx * xb, g.ceil, zr + dz]);
    steps.push({
      title: "Screw the rail brackets under the top",
      detail: "Two screws through washers into each bracket, up into the top panel.",
      add: [`RL${i}a`, `RL${i}b`],
      fix: [-1, 1].flatMap((sx) => [fixAt(RAIL_WASHER, pts(sx).map((p): Vec3 => [p[0], p[1] - 4, p[2]]), [0, 1, 0], `RL${i}${sx < 0 ? "a" : "b"}`), fixAt(RAIL_SCREW, pts(sx).map((p): Vec3 => [p[0], p[1] - 6, p[2]]), [0, 1, 0], `RL${i}${sx < 0 ? "a" : "b"}`)]),
      tools: ["screwdriver"],
    });
    steps.push({ title: "Hang the rail in the brackets", detail: "Push it through both brackets until it sits in the middle.", add: [`RL${i}`], from: { [`RL${i}`]: [300, 0, 0] } });
  }
  for (const { r, i } of u.rails.map((r, i) => ({ r, i })).filter((x) => x.r.kind === "adjust")) {
    parts.push(rail(r, i, 2 * g.xi - 2));
    steps.push({
      title: "Fit the adjustable rail",
      detail: "Pull it out until both ends touch the sides, at the height you want, then one screw through each end.",
      add: [`RL${i}`],
      fix: [fixAt(RAIL_SCREW, [-1, 1].map((sx): Vec3 => [sx * (g.xi - 8), u.fy + r.y, zr]), [0, -1, 0], `RL${i}`)],
      tools: ["screwdriver"],
    });
  }
  return parts.length ? { parts, steps } : null;
}

/* ---------- KONSTRUERA drawers: rails in the frame, each box built on its front panel, then slid in ---------- */

interface Drawer {
  i: number;
  fh: number;
  yf: number; // front's bottom
  yb: number; // box bottom
  bh: number;
  keys: { IF: string; SL: string; SR: string; BT: string; BK: string; FR: string };
}

function drawerSteps(b: PlanBuilder, u: Unit, g: Geo, sides: [string, string]) {
  const n = u.drawers.length;
  if (!n) return;
  const bw = 2 * g.xi - 26;
  const dd = u.df - 50;
  const zFront = g.zf - 6, zBack = zFront - dd, zm = (zFront + zBack) / 2;
  const iw = bw - 24; // front panel and back go between the sides
  const types = new Map<string, string>();
  const type = (name: string, size: Vec3, material: "board" | "fiber" = "board") => {
    const k = `${name}|${size.join("x")}`;
    if (!types.has(k)) types.set(k, b.part(name, size, { material }));
    return types.get(k)!;
  };
  let y = u.fy;
  const made: Drawer[] = u.drawers.map((fh, i) => {
    const yf = y;
    y += fh;
    const yb = (i === 0 ? g.floor : yf) + 22;
    const bh = fh >= 300 ? 230 : 100;
    const keys = {
      IF: b.place(type("Drawer front panel", [iw, bh, 16]), [0, yb + bh / 2, zFront - 8]),
      SL: b.place(type("Drawer side", [12, bh, dd]), [-(bw / 2 - 6), yb + bh / 2, zm]),
      SR: b.place(type("Drawer side", [12, bh, dd]), [bw / 2 - 6, yb + bh / 2, zm]),
      BT: b.place(type("Drawer bottom", [iw + 10, 3, dd - 24], "fiber"), [0, yb + 10, zm - 4]),
      BK: b.place(type("Drawer back", [iw, bh - 14, 16], "board"), [0, yb + 14 + (bh - 14) / 2, zBack + 8]),
      FR: b.place(type("Drawer front", [u.W - 4, fh - 4, DOOR]), [0, yf + fh / 2, g.zf + DOOR / 2 + 1]),
    };
    return { i, fh, yf, yb, bh, keys };
  });
  const frameRail: HwDef = { kind: "runner", len: Math.round((dd - 10) / 10) * 10, dia: 20 };
  const boxRunner: HwDef = { kind: "runner", len: Math.round((dd - 30) / 10) * 10, dia: 16 };
  const runZ = spread(zBack + 40, zFront - 40, 3);
  const fits = (d: Drawer) => ({
    stops: [-1, 1].map((sx): FitOpts => ({ on: d.keys.IF, at: [sx * (iw / 2 - 60), d.yb + 6, zFront - 16], dir: [0, 0, 1], hole: false })),
    pins: [-1, 1].flatMap((sx) => [0.3, 0.75].map((k): FitOpts => ({ on: sx < 0 ? d.keys.SL : d.keys.SR, at: [sx * (bw / 2 - 12), d.yb + d.bh * k, zBack + 8], dir: [-sx, 0, 0], mate: d.keys.BK }))),
    cams: [-1, 1].flatMap((sx) => [0.3, 0.75].map((k): FitOpts => ({ on: d.keys.BK, at: [sx * (iw / 2 - 28), d.yb + d.bh * k, zBack], dir: [0, 0, 1] }))),
    small: [-1, 1].map((sx): FitOpts => ({ on: d.keys.BT, at: [sx * (iw / 4), d.yb + 8.5, zBack + 8], dir: [0, 1, 0], mate: d.keys.BK })),
    runners: [-1, 1].map((sx): FitOpts => ({ on: sx < 0 ? d.keys.SL : d.keys.SR, at: [sx * (bw / 2 - 6), d.yb, zm], dir: [0, 1, 0], hole: false })),
    runnerScrews: [-1, 1].flatMap((sx) => runZ.map((z): FitOpts => ({ on: sx < 0 ? d.keys.SL : d.keys.SR, at: [sx * (bw / 2 - 6), d.yb - 4, z], dir: [0, 1, 0] }))),
  });
  // the frame's own rails, one pair per drawer
  step(b, { title: many(n, "Screw the drawer rails into the frame", "Screw the drawer rails into the frame"), detail: "One on each side for every drawer, three screws in each, in the holes the drawer's manual numbers.", kind: "runners", tools: ["screwdriver"] }, () => {
    for (const d of made) {
      b.fits(frameRail, [-1, 1].map((sx) => ({ on: sides[sx < 0 ? 0 : 1], at: [sx * g.xi, d.yb - 2, zm] as Vec3, dir: [sx, 0, 0] as Vec3, hole: false as const })), 0.1);
      b.fits(D_SCREW, [-1, 1].flatMap((sx) => runZ.map((z) => ({ on: sides[sx < 0 ? 0 : 1], at: [sx * (g.xi - 6), d.yb - 2, z] as Vec3, dir: [sx, 0, 0] as Vec3 }))), 0.04);
    }
  });

  // one of each size is built in the drawer scene, standing on its front panel
  const shown = [...new Map(made.map((d) => [d.fh, d])).values()];
  const offs = shown.map((_, i) => (i - (shown.length - 1) / 2) * (bw + 220));
  const c0 = (d: Drawer): Vec3 => [0, d.yb + d.bh / 2, zm];
  const stage = (d: Drawer, i: number, k: string, from?: Vec3) => {
    const it = b.partItem(k);
    const c = c0(d);
    b.stage(k, [it.final.pos[0] - c[0] + offs[i], it.final.pos[1] - c[1] + d.bh / 2 + 4, it.final.pos[2] - c[2]], it.final.rot, from);
  };
  const fs = shown.map(fits);
  const rep = n > 1 ? n : undefined;
  const dstep = (o: StepOpts, body: () => void) => step(b, { kind: "drawer", scene: "drawer", pose: "-z", repeat: rep, ...o }, body);
  const each = (fn: (d: Drawer, i: number) => void) => shown.forEach((d, i) => fn(d, i));
  dstep({ title: "Press the stops into the drawer front panel", detail: "Lay it on a rug, inside face up. Push each stop into its hole and slide it along until it locks.", warnings: ["floor"] }, () => {
    each((d, i) => stage(d, i, d.keys.IF, [0, 0, -200]));
    b.then(0.15);
    each((_, i) => b.fits(D_STOP, fs[i].stops, 0.12));
  });
  dstep({ title: "Push the sides onto the front panel", detail: "Grooves facing in and down. Press each side onto the fittings until it clicks.", kind: "join" }, () => {
    b.stagger(0.2);
    each((d, i) => [d.keys.SL, d.keys.SR].forEach((k, j) => stage(d, i, k, [(j ? 1 : -1) * 120, 0, -300])));
  });
  dstep({ title: "Slide in the drawer bottom", detail: "Along the grooves in both sides, all the way down to the front panel." }, () => each((d, i) => stage(d, i, d.keys.BT, [0, 0, -420])));
  dstep({ title: "Lay the back on and lock it", detail: "Two pins through each side into the back, then turn the cam locks in the back until they pull tight.", tools: ["screwdriver"], kind: "cams" }, () => {
    each((d, i) => stage(d, i, d.keys.BK, [0, 0, -260]));
    b.then(0.15);
    each((_, i) => b.fits(D_PIN, fs[i].pins, 0.08));
    b.then(0.05);
    each((_, i) => b.fits(D_CAM, fs[i].cams, 0.1));
  });
  dstep({ title: "Screw the bottom to the back", detail: "Two small screws through the bottom into the back.", tools: ["screwdriver"], kind: "screws" }, () => each((_, i) => b.fits(D_SMALL, fs[i].small, 0.15)));
  dstep({ title: "Screw the runners onto the drawer", detail: "Turn it upside down. Each runner clicks onto the bottom edge of its side, then three screws.", tools: ["screwdriver"], kind: "runners", pose: "-y" }, () => {
    each((_, i) => b.fits(boxRunner, fs[i].runners, 0.25));
    b.then(0.1);
    each((_, i) => b.fits(D_SCREW, fs[i].runnerScrews, 0.06));
  });
  step(b, { title: n > 1 ? `Slide in all ${n} drawers` : "Slide the drawer in", detail: "Rest its runners on the rails in the frame and push it in until it closes softly.", kind: "drawer", warnings: ["tip"] }, () => {
    for (const d of made) {
      b.stagger(0);
      for (const k of [d.keys.IF, d.keys.SL, d.keys.SR, d.keys.BT, d.keys.BK]) b.add(k, [0, 0, 520]);
      if (!shown.includes(d)) {
        const f = fits(d);
        const all: [HwDef, FitOpts[]][] = [[D_STOP, f.stops], [D_PIN, f.pins], [D_CAM, f.cams], [D_SMALL, f.small], [boxRunner, f.runners], [D_SCREW, f.runnerScrews]];
        for (const [def, l] of all) for (const x of l) b.preset(def, x);
      }
      b.wait(0.2);
    }
  });
  step(b, { title: many(n, "Click on the drawer front", "Click on the drawer fronts"), detail: "Hold each front against its drawer and press it on until it clicks. Line up the gaps, then fit the knobs you chose.", kind: "join" }, () => {
    b.stagger(0.25);
    for (const d of made) b.add(d.keys.FR, [0, 0, 300]);
  });
}

/* ---------- the UPPFÖRA plinth drawer, on four castors ---------- */

function plinthDrawer(b: PlanBuilder, u: Unit, g: Geo) {
  const { W, t } = u;
  const pw = W - 4 * t - 2 * t - 8; // between the plinth sides
  const pdd = u.df - 3 - 20 - 60;
  const zF = g.zf - 1; // front face of the drawer front
  const zFr = zF - 9; // its centre
  const zBk = zFr - 9 - pdd;
  const zm = (zFr - 9 + zBk) / 2;
  const yR = 24, yS = 44, sh = 84;
  const part = (name: string, size: Vec3, pos: Vec3, material: "board" | "fiber" = "board") => b.place(b.part(name, size, { material }), pos);
  const front = part("Plinth drawer front", [W - 2 * t - 4, 120, 18], [0, 14 + 60, zFr]);
  const sideL = part("Plinth drawer side", [16, sh, pdd], [-(pw / 2 - 8), yS + sh / 2, zm]);
  const sideR = b.place(b.parts[b.parts.length - 1].id, [pw / 2 - 8, yS + sh / 2, zm]);
  const railL = part("Castor rail", [30, yS - yR, pdd - 20], [-(pw / 2 - 31), (yR + yS) / 2, zm]);
  const railR = b.place(b.parts[b.parts.length - 1].id, [pw / 2 - 31, (yR + yS) / 2, zm]);
  const bottom = part("Plinth drawer bottom", [pw - 32, 3, pdd - 20], [0, yS + 6, zm], "fiber");
  const back = part("Plinth drawer back", [pw - 32, sh - 10, 16], [0, yS + 10 + (sh - 10) / 2, zBk + 8]);
  const all = [front, sideL, sideR, railL, railR, bottom, back];
  const c: Vec3 = [0, 70, zm];
  const stage = (k: string, from?: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c[0], it.final.pos[1] - c[1] + 80, it.final.pos[2] - c[2]], it.final.rot, from);
  };
  const ps = (o: StepOpts, body: () => void) => step(b, { kind: "drawer", scene: "plinth", ...o }, body);
  const cz = spread(zBk + 40, zFr - 60, 2);
  ps({ title: "Join the sides to the plinth drawer front", detail: "Lay the front face down on a rug. A cam bolt in each end, then the sides onto them and turn the cam locks.", pose: "-z", tools: ["screwdriver"], kind: "cams", warnings: ["floor"] }, () => {
    stage(front, [0, 0, 200]);
    b.then(0.1);
    b.fits(P_BOLT, [-1, 1].map((sx) => ({ on: front, at: [sx * (pw / 2 - 8), yS + sh / 2, zFr - 9] as Vec3, dir: [0, 0, -1] as Vec3, mate: sx < 0 ? sideL : sideR })), 0.15);
    b.then(0.1);
    stage(sideL, [-120, 0, -200]);
    stage(sideR, [120, 0, -200]);
    b.then(0.1);
    b.fits(D_CAM, [-1, 1].map((sx) => ({ on: sx < 0 ? sideL : sideR, at: [sx * (pw / 2 - 16), yS + sh / 2, zFr - 40] as Vec3, dir: [sx, 0, 0] as Vec3 })), 0.15);
  });
  ps({ title: "Screw the castors onto the rails", detail: "Two castors on each rail, two screws in each castor.", pose: "+y", tools: ["screwdriver"], kind: "screws" }, () => {
    stage(railL, [0, 200, 0]);
    stage(railR, [0, 200, 0]);
    b.then(0.1);
    b.fits(P_CASTOR, [-1, 1].flatMap((sx) => cz.map((z) => ({ on: sx < 0 ? railL : railR, at: [sx * (pw / 2 - 31), yR, z] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const }))), 0.12);
    b.then(0.05);
    b.fits(P_SCREW, [-1, 1].flatMap((sx) => cz.flatMap((z) => [-8, 8].map((dz) => ({ on: sx < 0 ? railL : railR, at: [sx * (pw / 2 - 31), yR, z + dz] as Vec3, dir: [0, 1, 0] as Vec3 })))), 0.05);
  });
  ps({ title: "Tap dowels into the rails and fit them", detail: "Two dowels in the front end of each rail. Push the rails onto the front, inside the sides, castors down.", pose: "-z", tools: ["hammer"], kind: "dowels" }, () => {
    b.fits(P_DOWEL, [-1, 1].flatMap((sx) => [-6, 6].map((dx) => ({ on: sx < 0 ? railL : railR, at: [sx * (pw / 2 - 31) + dx, (yR + yS) / 2, zFr - 9] as Vec3, dir: [0, 0, 1] as Vec3, mate: front }))), 0.08);
  });
  ps({ title: "Slide in the plinth drawer bottom", detail: "Along the grooves in the sides, down to the front." }, () => stage(bottom, [0, 0, -400]));
  ps({ title: "Fit the back", detail: "Dowels and a cam bolt into each end of the back, press it on between the sides, then turn the cam locks.", tools: ["screwdriver", "hammer"], kind: "cams" }, () => {
    b.fits(P_DOWEL, [-1, 1].map((sx) => ({ on: back, at: [sx * (pw / 2 - 16), yS + 20, zBk + 8] as Vec3, dir: [sx, 0, 0] as Vec3, mate: sx < 0 ? sideL : sideR })), 0.1);
    b.fits(P_BOLT, [-1, 1].map((sx) => ({ on: back, at: [sx * (pw / 2 - 16), yS + sh - 24, zBk + 8] as Vec3, dir: [sx, 0, 0] as Vec3, mate: sx < 0 ? sideL : sideR })), 0.1);
    b.then(0.1);
    stage(back, [0, 0, -260]);
    b.then(0.1);
    b.fits(D_CAM, [-1, 1].map((sx) => ({ on: sx < 0 ? sideL : sideR, at: [sx * (pw / 2 - 16), yS + sh - 24, zBk + 34] as Vec3, dir: [sx, 0, 0] as Vec3 })), 0.15);
  });
  step(b, { title: "Roll the drawer into the plinth", detail: "Castors on the floor, between the plinth sides, until the front lines up with the frame.", kind: "drawer" }, () => {
    b.stagger(0);
    for (const k of all) b.add(k, [0, 0, 560]);
  });
}

/* ---------- doors on HJÄLPA soft-closing hinges ---------- */

function doorSteps(b: PlanBuilder, u: Unit, g: Geo) {
  const n = u.doors;
  if (!n) return;
  const dw = u.W / 2 - 3;
  const rows = n === 4 ? [u.fy, u.fy + u.fh / 2] : [u.fy];
  const dh = n === 4 ? u.fh / 2 : u.fh;
  const doors = rows.flatMap((y0) => [-1, 1].map((sx) => ({ sx, y0, x: (sx * u.W) / 4 })));
  const ref = b.part("Door", [dw, dh - 3, DOOR]);
  const keys = doors.map((d) => b.place(ref, [d.x, d.y0 + dh / 2, g.zf + DOOR / 2 + 1]));
  const zIn = g.zf + 1;
  const hy = (d: (typeof doors)[number]) => spread(d.y0 + 90, d.y0 + dh - 90, dh > 1200 ? 3 : 2);
  const hinges: FitOpts[] = doors.flatMap((d, i) => hy(d).map((y) => ({ on: keys[i], at: [d.sx * (u.W / 2 - 25), y, zIn] as Vec3, dir: [0, 0, 1] as Vec3, twist: d.sx < 0 ? 0 : Math.PI })));
  const bumpers: FitOpts[] = doors.flatMap((d, i) => [d.y0 + 40, d.y0 + dh - 40].map((y) => ({ on: keys[i], at: [d.sx * 24, y, zIn] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const })));
  const stage = () => {
    b.stagger(0.15);
    keys.forEach((k, i) => b.stage(k, [(i - (n - 1) / 2) * (dw + 80), DOOR / 2, 0], [Math.PI / 2, 0, 0]));
    b.then(0.15);
  };
  step(b, { title: many(n, "Screw the hinges into the door", "Screw the hinges into the doors"), detail: "Lay them face down on a rug. Press each hinge into its cup and tighten its two screws.", kind: "hinges", tools: ["screwdriver"], scene: "doors", warnings: ["floor"] }, () => {
    stage();
    b.fits(HW.hinge, hinges, 0.08);
  });
  step(b, { title: "Push a bumper into each door", detail: "Into the small holes at the free edge, so the door closes quietly.", scene: "doors" }, () => b.fits(BUMPER, bumpers, 0.08));
  step(b, { title: many(n, "Hang the door", "Hang the doors"), detail: "Hold each door to the frame, hook its hinges onto the plates on the side and tighten the screws.", kind: "doors", tools: ["screwdriver"], people: dh >= 1200 ? 2 : 1 }, () => {
    b.stagger(0.3);
    for (const k of keys) b.add(k, [0, 0, 360]);
  });
  step(b, { title: many(n, "Adjust the door", "Adjust the doors"), detail: "Turn the hinge screws until the gaps are even and every door closes flush.", tools: ["screwdriver"] });
}

/* ---------- a whole frame guide ---------- */

function buildUnit(b: PlanBuilder, s: ProductSpec, u: Unit) {
  const g = geoOf(u);
  const frame = u.sys === "platsa" ? platsaFrame(u, g) : uppforaFrame(u, g);
  buildCustom(b, { ...s, custom: frame });
  const pos = (id: string) => frame.parts.find((p) => p.id === id)!.pos;
  const back = keyAt(b, pos(u.sys === "platsa" ? "K" : "BK"));
  const top = keyAt(b, pos(u.sys === "platsa" ? "T" : "TP"));
  const sideL = keyAt(b, pos(u.sys === "platsa" ? "L" : "SL"));
  const sideR = keyAt(b, pos(u.sys === "platsa" ? "R" : "SR"));
  if (back) wallStep(b, back, [-1, 1].map((sx): Vec3 => [sx * (u.W / 2 - 90), g.H - u.t - 40, g.z0 + 3]), { two: u.fh >= 1200, included: u.sys === "uppfora" });
  if (u.top && top) topSteps(b, u, g, top);
  const inside = insideRecipe(u, g);
  if (inside) buildCustom(b, { ...s, custom: inside });
  if (sideL && sideR) drawerSteps(b, u, g, [sideL, sideR]);
  if (u.sys === "uppfora") plinthDrawer(b, u, g);
  doorSteps(b, u, g);
}

/* ---------- the bench: cam-locked, built upside down ---------- */

function benchRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = 18, FT = 20; // feet and their brackets under the sides
  const sh = H - t - FT;
  const rh = 120, zr = -D / 2 + 30 + t / 2;
  const xs = W / 2 - t / 2, xin = W / 2 - t;
  const parts: CustomPart[] = [
    { id: "SL", name: "Side panel", size: [t, sh, D], pos: [-xs, FT + sh / 2, 0], material: "board" },
    { id: "SR", name: "Side panel", size: [t, sh, D], pos: [xs, FT + sh / 2, 0], material: "board" },
    { id: "RL", name: "Back rail", size: [W - 2 * t, rh, t], pos: [0, H - t - rh / 2, zr], material: "board" },
    { id: "TP", name: "Seat", size: [W, t, D], pos: [0, H - t / 2, 0], material: "board" },
  ];
  const yr = [H - t - rh + 30, H - t - 30];
  const sidePins = (sx: number) => fixAt(HW.camScrew, yr.map((y): Vec3 => [sx * xin, y, zr]), [-sx, 0, 0], sx < 0 ? "SL" : "SR", "RL");
  const railCams = (sx: number) => fixAt(HW.cam, yr.map((y): Vec3 => [sx * (xin - 30), y, zr + t / 2]), [0, 0, -1], "RL");
  const topPins: Vec3[] = [...[-1, 1].flatMap((sx) => [-D / 2 + 90, D / 2 - 90].map((z): Vec3 => [sx * xs, H - t, z])), [-W / 4, H - t, zr], [W / 4, H - t, zr]];
  const bracket = (sx: number, z: number): Vec3 => [sx * xs, FT, z];
  const bz = [-D / 2 + 45, D / 2 - 45];
  const brackets = [-1, 1].flatMap((sx) => bz.map((z) => bracket(sx, z)));
  const steps: CustomStep[] = [
    { title: "Screw the cam bolts into the sides", detail: "Lay both sides on a rug. Two bolts in each, near the back of the top end, by hand until they stop.", fix: [sidePins(-1), sidePins(1)], warnings: ["floor"] },
    { title: "Fit the back rail between the sides", detail: "Holes for the cam locks facing out to the back.", add: ["RL"] },
    { title: "Lock the rail to the sides", detail: "Arrow towards the bolt, then turn each cam lock clockwise until it pulls tight.", fix: [railCams(-1), railCams(1)] },
    {
      title: "Screw the cam bolts into the seat",
      detail: "Lay the seat face down on the rug. Six bolts, by hand: two at each end and two for the rail.",
      fix: [fixAt(HW.camScrew, topPins, [0, 1, 0], "TP")],
      pose: "-y",
      from: { TP: [0, 500, 0] }, // it waits beside the sides, bolts up
      wait: ["TP"],
      warnings: ["floor"],
    },
    { title: "Lower the sides onto the seat", detail: "Turn the sides and rail upside down and set them on the bolts. Then lock the two cam locks in the rail.", add: ["TP"], fix: [fixAt(HW.cam, [[-W / 4, H - t - 28, zr + t / 2], [W / 4, H - t - 28, zr + t / 2]], [0, 0, -1], "RL")] },
    { title: "Lock the sides to the seat", detail: "Two cam locks in each side, turned until they pull tight.", fix: [-1, 1].map((sx) => fixAt(HW.cam, [-D / 2 + 90, D / 2 - 90].map((z): Vec3 => [sx * xin, H - t - 28, z]), [sx, 0, 0], sx < 0 ? "SL" : "SR")) },
    {
      title: "Screw the foot brackets onto the sides",
      detail: "One at each end of both sides, one screw into the end of the side.",
      fix: [-1, 1].flatMap((sx) => [fixAt({ kind: "angle", len: 40, dia: 30 }, bz.map((z) => bracket(sx, z)), [0, 1, 0], sx < 0 ? "SL" : "SR"), fixAt(HW.screwS, bz.map((z): Vec3 => [sx * xs, FT - 2, z - Math.sign(z) * 24]), [0, 1, 0], sx < 0 ? "SL" : "SR")]), // beside the bracket's corner
      tools: ["screwdriver"],
    },
    {
      title: "Screw the brackets to the sides",
      detail: "Two more screws through each bracket into the side.",
      fix: [-1, 1].map((sx) => fixAt(HW.screwS, bz.flatMap((z) => [-10, 10].map((dz): Vec3 => [sx * (W / 2), FT + 22, z + dz])), [-sx, 0, 0], sx < 0 ? "SL" : "SR")),
      tools: ["screwdriver"],
    },
    { title: "Slide the covers over the brackets", detail: "Push each cover on from the end until it covers the bracket.", fix: [fixAt({ kind: "cap", len: 24, dia: 50 }, brackets.map((p): Vec3 => [p[0], FT + 10, p[2]]), [0, 1, 0])] },
    { title: "Screw in the feet", detail: "One into each bracket, by hand.", fix: [fixAt({ kind: "foot", len: 20, dia: 30 }, brackets.map((p): Vec3 => [p[0], 0, p[2]]), [0, 1, 0])] },
    { title: "Turn it over and level it", detail: "Stand it on its feet, then turn the feet until it doesn't rock.", pose: "+y", tools: ["level"] },
  ];
  return { parts, steps };
}

/* ---------- the wall storage: a small frame hung on a rail ---------- */

function wallRecipe(s: ProductSpec, cab: boolean): { frame: CustomParams; inside: CustomParams | null; W: number; H: number; D: number; df: number } {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const t = 16;
  const df = cab ? D - DOOR : D;
  const z0 = -D / 2, zf = z0 + df;
  const pd = df - 3, zm = z0 + 3 + pd / 2;
  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [t, H, pd], pos: [-(W / 2 - t / 2), H / 2, zm], material: "board" },
    { id: "T", name: "Top and bottom panel", size: [W - 2 * t, t, pd], pos: [0, H - t / 2, zm], material: "board" },
    { id: "R", name: "Side panel", size: [t, H, pd], pos: [W / 2 - t / 2, H / 2, zm], material: "board" },
    { id: "B", name: "Top and bottom panel", size: [W - 2 * t, t, pd], pos: [0, t / 2, zm], material: "board" },
    { id: "K", name: "Back panel", size: [W, H, 3], pos: [0, H / 2, z0 + 1.5], material: "fiber" },
    { id: "RAIL", name: "Suspension rail", size: [W - 60, 40, 8], pos: [0, H - 60, z0 - 4], material: "metal" },
  ];
  const xs = spread(-W / 2 + 50, W / 2 - 80, 4);
  const rows: [number, string][] = [[H - t / 2, "T"], [t / 2, "B"]];
  const hang = [-1, 1].map((sx): Vec3 => [sx * (W / 2 - t - 30), H - t - 40, z0 + 3]);
  const railPts = [-1, 0, 1].map((k): Vec3 => [k * (W / 2 - 80), H - 60, z0 - 8]);
  const steps: CustomStep[] = [
    { title: "Click the top panel onto a side panel", detail: "On a rug, with the side on its front edge. Push the top down onto its fittings until it clicks.", add: ["L", "T"], pose: "-z", warnings: ["floor"] },
    { title: "Click on the other side panel", detail: "Line up its fittings with the top and press it down until it clicks.", add: ["R"] },
    { title: "Click in the bottom panel", detail: "Between the sides at the open end, until both ends click.", add: ["B"] },
    { title: "Slide in the back panel", detail: "White side in, along the grooves until it stops.", add: ["K"], from: { K: [0, 400, 0] } },
    {
      title: "Lock the back with the rivets",
      detail: "Push a plug into each hole along the top and bottom, then press a pin into each one.",
      fix: [...rows.map(([y, mate]) => fixAt(RIVET_PLUG, xs.map((x): Vec3 => [x, y, z0]), [0, 0, 1], "K", mate)), fixAt(RIVET_PIN, rows.flatMap(([y]) => xs.map((x): Vec3 => [x + 30, y, z0])), [0, 0, 1], "K")],
    },
    { title: "Stand it up", detail: "Upright, the open front towards you.", pose: "+y" },
    {
      title: "Screw the hanging fittings into the top corners",
      detail: "Left and right are marked. Two screws in each, tight against the top and the side.",
      fix: [fixAt({ kind: "hook", len: 50, dia: 30 }, hang, [0, 0, -1], "K"), ...[-1, 1].map((sx) => fixAt(HW.screwS, [-12, 12].map((dy): Vec3 => [sx * (W / 2 - t), H - t - 40 + dy, z0 + 30]), [sx, 0, 0], sx < 0 ? "L" : "R"))],
      tools: ["screwdriver"],
    },
    { title: "Mark where it goes on the wall", detail: "Hold it up together where you want it and mark along the top. Use the paper template to mark the rail's holes.", people: 2, tools: ["pencil", "level"] },
    {
      title: "Screw the rail to the wall",
      detail: "Level, on the marks. Wall screws and plugs aren't included: pick ones made for your wall.",
      add: ["RAIL"],
      fix: [fixAt(HW.plug, railPts.map((p): Vec3 => [p[0], p[1], p[2] - 26]), [0, 0, -1]), fixAt(HW.wallScrew, railPts, [0, 0, -1], "RAIL")],
      from: { RAIL: [0, 0, 300] },
      tools: ["drill", "screwdriver", "level"],
      wall: true,
      warnings: ["wall"],
    },
    { title: "Hang it on the rail", detail: "Lift it over the rail and lower it until both fittings hook on.", people: 2, warnings: ["two", "wall"] },
    { title: "Adjust it level", detail: "Turn the screws in the fittings with the Allen key to raise, lower or pull it in to the wall.", tools: ["allen", "level"] },
    {
      title: "Fix the bottom to the wall",
      detail: "Two screws through washers, through the back near the bottom, then click the covers on. Wall screws and plugs aren't included.",
      fix: [-1, 1].flatMap((sx): CustomFix[] => [
        fixAt(HW.plug, [[sx * (W / 2 - 90), t + 40, z0 - 26]], [0, 0, -1]),
        fixAt(WASHER, [[sx * (W / 2 - 90), t + 40, z0 + 3]], [0, 0, -1], "K"),
        fixAt(HW.wallScrew, [[sx * (W / 2 - 90), t + 40, z0 + 5]], [0, 0, -1], "K"),
        fixAt(COVER, [[sx * (W / 2 - 90), t + 40, z0 + 7]], [0, 0, -1], "K"),
      ]),
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall"],
    },
  ];
  let inside: CustomParams | null = null;
  if (cab) {
    const sd = df - 25;
    inside = {
      parts: [{ id: "S", name: "Shelf", size: [W - 2 * t - 4, 16, sd], pos: [0, H / 2, z0 + 3 + sd / 2], material: "board" }],
      steps: [
        {
          title: "Put in the shelf",
          detail: "Four supports into the holes at the height you want, then lay the shelf on.",
          add: ["S"],
          fix: [fixAt(SHELF_PIN, [-1, 1].flatMap((sx) => [z0 + 50, z0 + sd - 30].map((z): Vec3 => [sx * (W / 2 - t), H / 2 - 12, z])), [0, -1, 0], "S")],
        },
      ],
    };
  }
  return { frame: { parts, steps }, inside, W, H, D, df };
}

function buildWall(b: PlanBuilder, s: ProductSpec, cab: boolean) {
  const r = wallRecipe(s, cab);
  buildCustom(b, { ...s, custom: r.frame });
  if (r.inside) buildCustom(b, { ...s, custom: r.inside });
  if (cab) {
    const u: Unit = { sys: "platsa", W: r.W, D: r.D, df: r.df, fh: r.H, t: 16, fy: 0, top: false, shelves: [], rails: [], drawers: [], doors: 2 };
    doorSteps(b, u, geoOf(u));
  }
}

/* ---------- the changing table/desk: one frame, the tray high for changing or low for a desk ---------- */

function changingRecipe(s: ProductSpec, desk: boolean): CustomParams {
  // IKEA: 90 wide, 79 deep with the tray, 100 high
  const W = s.size.w * 10 || 900, H = s.size.h * 10 || 1000, T = 18;
  const zb = -395, zf = 175, zT = 395; // the frame's back and front, the tray's front edge
  const xi = W / 2 - T, xd = 170; // the sides' inner faces, the divider's left face
  const y0 = 20, yS = 600; // the bottom's underside (on feet), the fixed shelf's underside
  const yF = desk ? 660 : 882; // the tray floor's underside, on its two brackets
  const B = (id: string, name: string, x0: number, x1: number, ya: number, yb: number, za: number, zc: number, material?: CustomPart["material"]): CustomPart => ({
    id,
    name,
    size: [x1 - x0, yb - ya, zc - za],
    pos: [(x0 + x1) / 2, (ya + yb) / 2, (za + zc) / 2],
    ...(material ? { material } : {}),
  });
  const parts: CustomPart[] = [
    B("SL", "Side panel", -W / 2, -xi, y0, H, zb, zf),
    B("SR", "Side panel", xi, W / 2, y0, H, zb, zf),
    B("BOT", "Bottom", -xi, xi, y0, y0 + T, zb + 8, zf),
    B("SH", "Shelf", -xi, xi, yS, yS + T, zb + 8, zf),
    B("DIV", "Divider", xd, xd + T, y0 + T, yS, zb + 8, zf),
    B("BKL", "Lower back", -xi, xi, y0 + T, yS, zb, zb + 8),
    B("BKU", "Upper back", -xi, xi, yS + T, H, zb, zb + T),
    B("CS", "Shelf", xd + T, xi, 300, 300 + T, zb + 8, zf - 10),
    B("TF", "Tray floor", -xi + 2, xi - 2, yF, yF + T, zb + T, zT),
    B("TL", "Tray side", -xi + 2, -xi + 2 + T, yF + T, yF + T + 70, zb + T, zT),
    B("TR", "Tray side", xi - 2 - T, xi - 2, yF + T, yF + T + 70, zb + T, zT),
    B("TB", "Tray back", -xi + 2 + T, xi - 2 - T, yF + T, yF + T + 70, zb + T, zb + 2 * T),
    B("TA", "Tray front lip", -xi + 2 + T, xi - 2 - T, yF + T, yF + T + 30, zT - T, zT),
  ];
  const side = (sx: number) => (sx < 0 ? "SL" : "SR");
  const tray = ["TF", "TL", "TR", "TB", "TA"];
  const ym = (a: number, b: number) => (a + b) / 2;
  const BOLT = { len: 34, dia: 7 };
  const steps: CustomStep[] = [
    {
      title: "Screw four cam bolts into the bottom and the shelf",
      detail: "Lay both on a rug. Two in each, in the holes for the divider.",
      add: ["BOT", "SH"],
      fix: [fixAt({ kind: "camScrew", ...BOLT }, [[xd + 9, y0 + T, -250], [xd + 9, y0 + T, 50]], [0, -1, 0], "BOT"), fixAt({ kind: "camScrew", ...BOLT }, [[xd + 9, yS, -250], [xd + 9, yS, 50]], [0, 1, 0], "SH")],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Fit the divider between them", detail: "Its cam holes face the right-hand side. Push it onto the bolts.", add: ["DIV"] },
    { title: "Lock the divider with four cam locks", fix: [fixAt({ kind: "cam", len: 13, dia: 15 }, [[xd + T, y0 + T + 34, -250], [xd + T, y0 + T + 34, 50], [xd + T, yS - 34, -250], [xd + T, yS - 34, 50]], [-1, 0, 0], "DIV")], tools: ["screwdriver"] },
    {
      title: "Screw eight cam bolts into the side panels",
      detail: "Four in each: two for the bottom, two for the shelf.",
      fix: [-1, 1].map((sx) => fixAt({ kind: "camScrew", ...BOLT }, [[sx * xi, y0 + 9, -300], [sx * xi, y0 + 9, 100], [sx * xi, yS + 9, -300], [sx * xi, yS + 9, 100]], [-sx, 0, 0], side(sx))),
      tools: ["screwdriver"],
      wait: ["SL", "SR"],
    },
    { title: "Push the sides on", detail: "Lay the frame on its back and press a side onto each end over the bolts.", add: ["SL", "SR"], pose: "+z" },
    {
      title: "Lock the sides with eight cam locks",
      detail: "Four in the bottom, four in the shelf.",
      fix: [-1, 1].flatMap((sx) => [fixAt({ kind: "cam", len: 15, dia: 20 }, [[sx * (xi - 34), y0 + T, -300], [sx * (xi - 34), y0 + T, 100]], [0, -1, 0], "BOT"), fixAt({ kind: "cam", len: 15, dia: 20 }, [[sx * (xi - 34), yS + T, -300], [sx * (xi - 34), yS + T, 100]], [0, -1, 0], "SH")]),
      tools: ["screwdriver"],
    },
    { title: "Screw two cam bolts into the shelf's back edge", detail: "For the lower back.", fix: [fixAt({ kind: "camScrew", ...BOLT }, [[-250, yS + 9, zb + 8], [250, yS + 9, zb + 8]], [0, 0, 1], "SH")], tools: ["screwdriver"] },
    { title: "Turn it over and slide the lower back in", detail: "Lying on its front, slide the back along the grooves in the sides, up to the shelf.", add: ["BKL"], pose: "-z", from: { BKL: [0, -500, 0] } },
    { title: "Lock the back with two cam locks", fix: [fixAt({ kind: "cam", len: 13, dia: 15 }, [[-250, yS - 34, zb], [250, yS - 34, zb]], [0, 0, 1], "BKL")], tools: ["screwdriver"] },
    { title: "Screw the back to the bottom", detail: "Four screws along its lower edge.", fix: [fixAt({ kind: "screw", len: 16, dia: 4 }, [-300, -100, 100, 300].map((x): Vec3 => [x, y0 + 9, zb]), [0, 0, 1], "BKL", "BOT")], tools: ["screwdriver"] },
    {
      title: "Screw in the four feet",
      detail: "Turn it upside down. A plate and an adjustable foot under each corner of the bottom.",
      fix: [{ ...fixAt({ kind: "glide", len: 3, dia: 40 }, [-1, 1].flatMap((sx) => [zb + 60, zf - 60].map((z): Vec3 => [sx * (xi - 40), y0, z])), [0, 1, 0], "BOT"), name: "Foot plate" }, fixAt({ kind: "foot", len: 20, dia: 30 }, [-1, 1].flatMap((sx) => [zb + 60, zf - 60].map((z): Vec3 => [sx * (xi - 40), y0, z])), [0, 1, 0], "BOT")],
      pose: "-y",
    },
    {
      title: "Stand it up and screw on the upper back",
      detail: "Lower it in from above, behind the shelf, then four long screws through the sides.",
      add: ["BKU"],
      fix: [-1, 1].map((sx) => fixAt({ kind: "bolt", len: 50, dia: 7 }, [[sx * (W / 2), yS + 100, zb + 9], [sx * (W / 2), H - 60, zb + 9]], [-sx, 0, 0], side(sx), "BKU")),
      pose: "+y",
      tools: ["allen"],
      from: { BKU: [0, 400, 0] },
    },
    ...([
          {
            title: "Screw six shelf holders into the right compartment",
            detail: "Three on each side of it, at the height you want the shelf.",
            // each holder sits just under the shelf, its screw below it into the panel
            fix: [[xd + T, 1, "DIV"], [xi, -1, "SR"]].flatMap(([x, k, on]) => [{ ...fixAt({ kind: "clip", len: 20, dia: 14 }, [-250, -50, 120].map((z): Vec3 => [+x, 293, z]), [-k, 0, 0], `${on}`), name: "Shelf holder" }, fixAt({ kind: "screw", len: 12, dia: 3.5 }, [-250, -50, 120].map((z): Vec3 => [+x, 269, z]), [-k, 0, 0], `${on}`)]),
            tools: ["screwdriver"],
          },
          { title: "Lay the shelf on the holders", detail: "Press it down until each holder clicks over its edge.", add: ["CS"], from: { CS: [0, 0, 400] } },
        ] as CustomStep[]),
    { title: "Level it", detail: "Turn the four feet until it stands level, with the spirit level on the shelf.", tools: ["level"] },
    { title: "Mark the wall", detail: "Push it against the wall and mark through the two holes in the upper back.", tools: ["pencil"], warnings: ["wall", "tip"] },
    { title: "Move it away and drill the holes", detail: "Pick plugs to suit your wall: the ones in the box are for solid walls.", tools: ["drill"] },
    { title: "Push the wall plugs in", fix: [{ ...fixAt({ kind: "plug", len: 50, dia: 8 }, [[-300, H - 100, zb - 2], [300, H - 100, zb - 2]], [0, 0, -1]), included: true }], tools: ["hammer"], wall: true },
    {
      title: "Screw it to the wall",
      detail: "A spacer behind each hole (break off pieces to suit the skirting), then a washer and a long screw.",
      fix: [fixAt({ kind: "spacer", len: 18, dia: 30 }, [[-300, H - 100, zb - 1], [300, H - 100, zb - 1]], [0, 0, -1], "BKU"), fixAt({ kind: "washer", len: 2, dia: 22 }, [[-300, H - 100, zb + T], [300, H - 100, zb + T]], [0, 0, -1], "BKU"), { ...fixAt({ kind: "screw", len: 80, dia: 5 }, [[-300, H - 100, zb + T], [300, H - 100, zb + T]], [0, 0, -1], "BKU"), included: true }],
      tools: ["screwdriver"],
      wall: true,
    },
    { title: "Click the cover caps on", detail: "Over both screw heads.", fix: [fixAt({ kind: "cap", len: 6, dia: 24 }, [[-300, H - 100, zb + T + 2], [300, H - 100, zb + T + 2]], [0, 0, -1], "BKU")] },
    { title: "Tap two dowels into the tray's front lip", detail: "Now the tray. One in each end.", fix: [-1, 1].map((sx) => fixAt({ kind: "dowel", len: 40, dia: 10 }, [[sx * (xi - 2 - T), yF + T + 15, zT - 9]], [sx, 0, 0], "TA", sx < 0 ? "TL" : "TR")), wait: tray, from: Object.fromEntries(tray.map((id) => [id, [0, 0, 700] as Vec3])), tools: ["hammer"] },
    { title: "Screw the tray sides to the back", detail: "One screw through each side into the back, with the Allen key.", fix: [-1, 1].map((sx) => fixAt({ kind: "bolt", len: 50, dia: 7 }, [[sx * (xi - 2), ym(yF + T, yF + T + 70), zb + 1.5 * T]], [-sx, 0, 0], sx < 0 ? "TL" : "TR", "TB")), tools: ["allen"] },
    { title: "Screw the floor on from below", detail: "Seven screws up through the floor into the sides and the back.", fix: [fixAt({ kind: "bolt", len: 50, dia: 7 }, [[-xi + 11, yF, -250], [-xi + 11, yF, 50], [-xi + 11, yF, 300], [xi - 11, yF, -250], [xi - 11, yF, 50], [xi - 11, yF, 300], [0, yF, zb + 1.5 * T]], [0, 1, 0], "TF")], tools: ["allen"] },
    {
      title: desk ? "Screw the tray brackets on at desk height" : "Screw the tray brackets on at the top",
      detail: desk ? "Inside both sides, in the lower holes for a desk your child can sit at. Two screws in each." : "Inside both sides, in the top holes for changing. Two screws in each.",
      fix: [-1, 1].flatMap((sx) => [{ ...fixAt({ kind: "angle", len: 300, dia: 30 }, [[sx * xi, yF, -150]], [sx, 0, 0], side(sx)), name: "Tray bracket" }, fixAt({ kind: "screw", len: 12, dia: 5 }, [[sx * xi, yF - 15, -250], [sx * xi, yF - 15, -50]], [sx, 0, 0], side(sx))]),
      tools: ["screwdriver"],
    },
    { title: "Slide the tray in onto the brackets", detail: "From the front, all the way to the back.", add: tray, from: Object.fromEntries(tray.map((id) => [id, [0, 0, 500] as Vec3])) },
    { title: "Lock the tray with two screws", detail: "Down through the floor into the brackets. Check it can't slide forward.", fix: [fixAt({ kind: "screw", len: 10, dia: 4 }, [[-xi + 11, yF + T, -150], [xi - 11, yF + T, -150]], [0, -1, 0], "TF")], tools: ["screwdriver"] },
  ];
  if (!desk) return { parts, steps };
  // the desk adds two KONSTRUERA drawers in the left compartment, a small one over a deep one
  const x0 = -xi, x1 = xd, bw = x1 - x0 - 26, cx = (x0 + x1) / 2, dz0 = zb + 30, dz1 = zf - 6;
  const fronts: [number, number][] = [[y0 + 2, 330], [334, 500]];
  fronts.forEach(([a, b], i) => {
    const yb = (i ? a : y0 + T) + 22, bh = b - a > 250 ? 230 : 100;
    parts.push(
      B(`DP${i}`, "Drawer front panel", cx - bw / 2 + 12, cx + bw / 2 - 12, yb, yb + bh, dz1 - 16, dz1),
      B(`DL${i}`, "Drawer side", cx - bw / 2, cx - bw / 2 + 12, yb, yb + bh, dz0, dz1),
      B(`DR${i}`, "Drawer side", cx + bw / 2 - 12, cx + bw / 2, yb, yb + bh, dz0, dz1),
      B(`DT${i}`, "Drawer bottom", cx - bw / 2 + 12, cx + bw / 2 - 12, yb + 8, yb + 11, dz0 + 16, dz1 - 16, "fiber"),
      B(`DB${i}`, "Drawer back", cx - bw / 2 + 12, cx + bw / 2 - 12, yb + 14, yb + bh, dz0, dz0 + 16),
      B(`DF${i}`, "Drawer front", x0 + 2, x1 + T - 2, a, b - 4, zf + 1, zf + 21),
    );
  });
  const dd = [0, 1];
  const dY = (i: number) => parts.find((p) => p.id === `DL${i}`)!.pos[1] - parts.find((p) => p.id === `DL${i}`)!.size[1] / 2;
  const dH = (i: number) => parts.find((p) => p.id === `DL${i}`)!.size[1];
  const sxs = (i: number, sx: number) => (sx < 0 ? `DL${i}` : `DR${i}`);
  const rz = [dz0 + 40, (dz0 + dz1) / 2, dz1 - 40];
  const rm = (dz0 + dz1) / 2 + 25; // a runner's middle, clear of its middle screw
  const drawerSteps: CustomStep[] = [
    { title: "Screw the drawer rails into the left compartment", detail: "One on each side for both drawers, three screws in each, in the holes the drawer leaflet numbers.", fix: dd.flatMap((i) => [fixAt({ kind: "runner", len: 400, dia: 20 }, [[x0, dY(i) - 2, rm]], [-1, 0, 0], "SL"), fixAt({ kind: "runner", len: 400, dia: 20 }, [[x1, dY(i) - 2, rm]], [1, 0, 0], "DIV"), fixAt({ kind: "screw", len: 12, dia: 4 }, rz.map((z): Vec3 => [x0, dY(i) - 2, z]), [-1, 0, 0], "SL"), fixAt({ kind: "screw", len: 12, dia: 4 }, rz.map((z): Vec3 => [x1, dY(i) - 2, z]), [1, 0, 0], "DIV")]), tools: ["screwdriver"] },
    { title: "Press the stops into the drawer front panels", detail: "Lay them on a rug, inside face up. Push each stop in and slide it along until it locks.", fix: dd.map((i) => fixAt({ kind: "clip", len: 10, dia: 16 }, [-1, 1].map((sx): Vec3 => [cx + sx * (bw / 2 - 60), dY(i) + 6, dz1 - 16]), [0, 0, 1], `DP${i}`)), wait: dd.flatMap((i) => [`DP${i}`, `DL${i}`, `DR${i}`, `DT${i}`, `DB${i}`]), from: Object.fromEntries(dd.flatMap((i) => [`DP${i}`, `DL${i}`, `DR${i}`, `DT${i}`, `DB${i}`].map((id) => [id, [0, 0, 600] as Vec3]))), warnings: ["floor"] },
    { title: "Push the sides onto the front panels", detail: "Grooves facing in and down, until they click." },
    { title: "Slide in the drawer bottoms", detail: "Along the grooves, down to the front panel." },
    { title: "Lay the backs on and lock them", detail: "Two pins through each side into the back, then turn the cam locks in the back.", fix: dd.flatMap((i) => [fixAt({ kind: "camScrew", len: 30, dia: 6 }, [-1, 1].flatMap((sx) => [0.3, 0.75].map((k): Vec3 => [cx + sx * (bw / 2 - 12), dY(i) + dH(i) * k, dz0 + 8])), [1, 0, 0], `DB${i}`), fixAt({ kind: "cam", len: 12, dia: 15 }, [-1, 1].flatMap((sx) => [0.3, 0.75].map((k): Vec3 => [cx + sx * (bw / 2 - 40), dY(i) + dH(i) * k, dz0])), [0, 0, 1], `DB${i}`)]), tools: ["screwdriver"] },
    { title: "Screw the bottoms to the backs", detail: "Two small screws in each.", fix: dd.map((i) => fixAt({ kind: "screw", len: 8, dia: 3.5 }, [-1, 1].map((sx): Vec3 => [cx + sx * bw / 4, dY(i) + 8, dz0 + 8]), [0, 1, 0], `DT${i}`)), tools: ["screwdriver"] },
    { title: "Screw the runners onto the drawers", detail: "Upside down: each runner clicks onto its side, then three screws.", fix: dd.flatMap((i) => [-1, 1].flatMap((sx) => [fixAt({ kind: "runner", len: 380, dia: 16 }, [[cx + sx * (bw / 2 - 6), dY(i), rm]], [0, 1, 0], sxs(i, sx)), fixAt({ kind: "screw", len: 12, dia: 4 }, [dz0 + 70, rm - 55, dz1 - 70].map((z): Vec3 => [cx + sx * (bw / 2 - 6), dY(i) - 4, z]), [0, 1, 0], sxs(i, sx))])), tools: ["screwdriver"] },
    { title: "Slide both drawers in", detail: "Rest the runners on the rails and push until they close softly.", add: dd.flatMap((i) => [`DP${i}`, `DL${i}`, `DR${i}`, `DT${i}`, `DB${i}`]) },
    { title: "Click on the drawer fronts", detail: "Press each front on until it clicks, then line up the gaps.", add: ["DF0", "DF1"], from: { DF0: [0, 0, 300], DF1: [0, 0, 300] } },
  ];
  return { parts, steps: [...steps, ...drawerSteps] };
}

const family: Family = {
  names: ["SMÅSTAD"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (slug === "smastad-bench-90-x-50-x-48") {
      buildCustom(b, { ...s, custom: benchRecipe(s) });
      return true;
    }
    if (slug === "smastad-wall-storage-60-x-30-x-60" || slug === "smastad-wall-cabinet-60-x-32-x-60") {
      buildWall(b, s, slug.includes("cabinet"));
      return true;
    }
    if (slug === "smastad-changing-table-desk-90-x-79-x-100" || slug === "smastad-desk-90-x-79-x-100") {
      buildCustom(b, { ...s, custom: changingRecipe(s, slug === "smastad-desk-90-x-79-x-100") });
      return true;
    }
    const u = unitOf(s);
    if (!u) return false;
    buildUnit(b, s, u);
    return true;
  },
};
export default family;
