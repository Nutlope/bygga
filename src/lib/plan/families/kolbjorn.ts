import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";
import { rotate } from "../math";

/*
 * KOLBJÖRN, read from IKEA's manuals (the 80x81 and 80x45 shelving units, the 80x81 cabinet and the 90x161 cabinet).
 * Everything is powder-coated steel: four open steel legs with a screw-in foot each, and pressed trays for the bottom,
 * the top and the shelves, all fixed with short Allen screws through the legs (16 on a shelving unit). Shelving units
 * are started upside down: the bottom tray is screwed between the legs, then it's turned over and the top goes on.
 * A loose shelf rests on four steel hooks clipped into the legs' slots. The cabinet adds side and back panels that
 * hook into the legs, doors on pivot hinges in plastic bushes, a catch plate and magnets. The 90x161 cabinet is built
 * lying on its back from two side frames, three back panels and a divider, stood up for its top, then gets shelves,
 * hook rails and three doors. Each unit is fixed to the wall with two plastic spacers under the top's back edge.
 * Stacked sets (two shelving units, or a shelving unit on the cabinet) use the upper unit's feet as joining bolts,
 * screwed up through the lower top into its legs.
 */

const LW = 40; // a leg across the front (x)
const FZ = 40; // front leg, front to back
const BZ = 25; // back leg, front to back
const FOOT = 12; // the adjustable foot under each leg
const TOP = 40; // the top tray's rim
const TRAY = 30; // the bottom tray's rim
const SH = 25; // a loose shelf
const D = 350; // every KOLBJÖRN is 35 cm deep
const DOOR_T = 18;
const DOOR_Z = D / 2 - DOOR_T / 2;

const ALLEN = { kind: "bolt" as const, len: 10, dia: 6, name: "Allen screw" };
const SCREW = { kind: "screw" as const, len: 8, dia: 4 };
const RAIL_SCREW = { kind: "screw" as const, len: 10, dia: 5 };
const FOOT_HW: HwDef = { kind: "foot", len: 30, dia: 30 };
const BUSH: HwDef = { kind: "cap", len: 8, dia: 12, name: "Hinge bush" };
const PIVOT: HwDef = { kind: "hinge", len: 40, dia: 20 };
const CATCH: HwDef = { kind: "plate", len: 40, dia: 24, name: "Catch plate" };
const CATCH_SCREW: HwDef = { kind: "screw", len: 10, dia: 3.5 };
const MAGNET: HwDef = { kind: "washer", len: 6, dia: 16, name: "Magnet" };
const MAGNET_SCREW: HwDef = { kind: "screw", len: 13, dia: 3.5 };
const SPACER: HwDef = { kind: "spacer", len: 18, dia: 30 };
const CAP: HwDef = { kind: "cap", len: 4, dia: 14 };

type Pt = { p: Vec3; d: Vec3 };
const same = (a: Vec3, b: Vec3) => a.every((v, i) => v === b[i]);

/** One fix per direction (a recipe fix has a single way in), for points that go in different ways. */
function fixes(base: Omit<CustomFix, "count" | "at" | "dir">, pts: Pt[]): CustomFix[] {
  const out: CustomFix[] = [];
  for (const { p, d } of pts) {
    const f = out.find((o) => same(o.dir!, d));
    if (f) {
      f.at!.push(p);
      f.count++;
    } else out.push({ ...base, count: 1, at: [p], dir: d });
  }
  return out;
}

interface Frame {
  key: string;
  W: number;
  y0: number; // where its legs stand: the floor (with feet) or the top of the unit below
  top: number; // top surface of its top tray
  feet: boolean;
}
type Corner = [number, number]; // sx, sz
const CORNERS: Corner[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
const BACK = CORNERS.filter((c) => c[1] < 0);
const FRONT = CORNERS.filter((c) => c[1] > 0);
const legX = (f: Frame, sx: number) => sx * (f.W / 2 - LW / 2);
const legZ = (sz: number) => (sz > 0 ? D / 2 - FZ / 2 : -D / 2 + BZ / 2);
const legId = (f: Frame, [sx, sz]: Corner) => `${f.key}L${sz > 0 ? "F" : "B"}${sx > 0 ? "R" : "L"}`;

/** Four legs: the top tray's corners drop over their ends, so they run up inside its rim. */
function legs(f: Frame): CustomPart[] {
  const y0 = f.y0 + (f.feet ? FOOT : 0), y1 = f.top - 4;
  return CORNERS.map((c) => ({
    id: legId(f, c),
    name: c[1] > 0 ? "Front leg" : "Back leg",
    size: [LW, y1 - y0, c[1] > 0 ? FZ : BZ] as Vec3,
    pos: [legX(f, c[0]), (y0 + y1) / 2, legZ(c[1])] as Vec3,
    material: "metal" as const,
  }));
}

/** Allen screws at one level: through each leg's side (`side`) and front or back face (`face`) into the tray's rim. */
function legScrews(f: Frame, y: number, corners: Corner[], which: "side" | "face" | "both", dy = 0): Pt[] {
  const out: Pt[] = [];
  for (const [sx, sz] of corners) {
    if (which !== "face") out.push({ p: [sx * (f.W / 2), y - dy, legZ(sz)], d: [-sx, 0, 0] });
    if (which !== "side") out.push({ p: [legX(f, sx), y + dy, sz * (D / 2)], d: [0, 0, -sz] });
  }
  return out;
}
const screws = (pts: Pt[]) => fixes(ALLEN, pts);

const feetAt = (f: Frame, corners: Corner[], y: number): CustomFix => ({
  ...FOOT_HW,
  count: corners.length,
  at: corners.map(([sx, sz]) => [legX(f, sx), y, legZ(sz)] as Vec3),
  dir: [0, 1, 0],
});
const feetFix = (f: Frame, corners = CORNERS) => feetAt(f, corners, f.y0 + FOOT);

const tray = (id: string, name: string, W: number, y: number, h: number, depth = D, z = 0): CustomPart => ({ id, name, size: [W, h, depth], pos: [0, y + h / 2, z], material: "metal" });

/** The four hooks a loose shelf rests on, clipped into the slots on the legs' inner faces just under it. */
function hooks(f: Frame, y: number): CustomFix[] {
  return [-1, 1].map((sx) => ({
    kind: "clip",
    name: "Shelf hook",
    count: 2,
    at: [-1, 1].map((sz) => [sx * (f.W / 2 - LW), y - 8, legZ(sz)] as Vec3),
    dir: [sx, 0, 0],
    len: 40,
    dia: 20,
  }));
}

/* ---------- steps drawn straight onto the builder (after the recipe parts) ---------- */

interface BStep {
  title: string;
  detail: string;
  kind: StepKind;
  tools?: ToolId[];
  warnings?: WarnId[];
  people?: 1 | 2;
  scene?: string;
  wall?: boolean;
  check?: "square";
}
const put = (b: PlanBuilder, def: HwDef, pts: Vec3[], dir: Vec3, on?: string, gap = 0.08) => b.fits(def, pts.map((at) => ({ at, dir, on, hole: false })), gap);

function levelStep(b: PlanBuilder, after?: () => void) {
  b.step({ title: "Level it with the feet", detail: "Stand it where it goes and turn the feet in or out until the top is level and it doesn't rock.", kind: "legs", tools: ["level"] }, () => after?.());
}

/** Two plastic spacers between the top's back edge and the wall, a wall screw through each. */
function wallStep(b: PlanBuilder, f: Frame, under: number, title = "Fix it to the wall") {
  const xs = [-1, 1].map((sx) => sx * (f.W / 2 - 110));
  const y = f.top - under;
  b.step(
    {
      title,
      detail: "Snap each spacer to the thickness your skirting board needs, then screw through the back edge of the top into the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "screwdriver", "pencil"],
      warnings: ["wall", "tip"],
      wall: true,
    },
    () => {
      b.stagger(0.2);
      put(b, HW.plug, xs.map((x) => [x, y, -D / 2 - 30]), [0, 0, -1]);
      b.then(0.1);
      put(b, SPACER, xs.map((x) => [x, y, -D / 2]), [0, 0, -1]);
      b.then(0.1);
      put(b, HW.wallScrew, xs.map((x) => [x, y, -D / 2 + 12]), [0, 0, -1]);
    },
  );
}

function capsStep(b: PlanBuilder, f: Frame) {
  b.step({ title: "Press the caps into the top", detail: "One into the hole at each corner. They're left out only where another unit stands on top.", kind: "general" }, () =>
    put(b, CAP, CORNERS.map(([sx, sz]) => [legX(f, sx), f.top, legZ(sz)]), [0, -1, 0]),
  );
}

/* ---------- doors ---------- */

interface Door {
  key: string;
  pos: Vec3;
  pivot: number; // x of its hinge pins
  free: number; // x of its edge without hinges
}

/** A door with its knob (part of the door, not a fitting), placed shut. */
function makeDoor(b: PlanBuilder, name: string, w: number, h: number, x: number, y: number, hingeSide: number, knob: boolean): Door {
  const pieces: PartPiece[] = [{ shape: "box", size: [w, h, DOOR_T], pos: [0, 0, 0] }];
  if (knob) pieces.push({ shape: "cyl", size: [14, 12, 14], pos: [-hingeSide * (w / 2 - 30), 40, DOOR_T / 2 + 6], rot: [Math.PI / 2, 0, 0] });
  const { type, mid } = b.compound(name, pieces, { material: "metal" });
  const pos: Vec3 = [x + mid[0], y + mid[1], DOOR_Z + mid[2]];
  return { key: b.place(type, pos), pos, pivot: x + hingeSide * (w / 2 - 16), free: x - hingeSide * (w / 2 - 20) };
}

/** Swung open on its pins, about 100 degrees, so the inside can be reached. */
function openDoor(b: PlanBuilder, d: Door) {
  const pivot: Vec3 = [d.pivot, d.pos[1], DOOR_Z];
  const v: Vec3 = [d.pos[0] - pivot[0], 0, d.pos[2] - pivot[2]];
  let rot: Vec3 = [0, 1.75, 0];
  if (rotate(v, rot)[2] < 0) rot = [0, -1.75, 0];
  const r = rotate(v, rot);
  b.stage(d.key, [pivot[0] + r[0], d.pos[1], pivot[2] + r[2]], rot);
}

/** Pins clipped into a door's top and bottom corner on its hinge side; the pins drop into the bushes. */
function pins(b: PlanBuilder, d: Door, y0: number, y1: number) {
  put(b, PIVOT, [[d.pivot, y1, DOOR_Z]], [0, -1, 0], d.key);
  put(b, PIVOT, [[d.pivot, y0, DOOR_Z]], [0, 1, 0], d.key);
}

function bushes(b: PlanBuilder, xs: number[], y0: number, y1: number, detail: string) {
  b.step({ title: "Press the hinge bushes in", detail, kind: "hinges" }, () => {
    put(b, BUSH, xs.map((x) => [x, y0, DOOR_Z]), [0, -1, 0]);
    b.then(0.05);
    put(b, BUSH, xs.map((x) => [x, y1, DOOR_Z]), [0, 1, 0]);
  });
}

interface Built {
  parts: CustomPart[];
  steps: CustomStep[];
}
const custom = (b: PlanBuilder, s: ProductSpec, r: Built) => buildCustom(b, { ...s, custom: { parts: r.parts, steps: r.steps } });

/* ---------- the shelving unit ---------- */

/** A shelving unit: bottom and top trays screwed to the legs, and on the tall one a loose shelf on four hooks. */
function shelving(f: Frame, o: { order: "81" | "45" | "again"; mid: boolean }): Built {
  const H = f.top - f.y0;
  const bot = f.y0 + 95;
  const midY = f.y0 + Math.round(H * 0.52);
  const L = legs(f);
  const ids = (cs: Corner[]) => cs.map((c) => legId(f, c));
  const parts: CustomPart[] = [...L, tray(`${f.key}B`, "Bottom shelf", f.W, bot, TRAY), tray(`${f.key}T`, "Top", f.W, f.top - TOP, TOP)];
  if (o.mid) parts.push(tray(`${f.key}S`, "Shelf", f.W - 2 * LW - 2, midY, SH, D - 10, -5));
  const yB = bot + TRAY / 2, yT = f.top - TOP / 2;
  const topStep: CustomStep = {
    title: "Put the top on and screw it to the legs",
    detail: "Its corners drop over the ends of the legs. Two screws into each leg, one from the side and one from the front or back.",
    add: [`${f.key}T`],
    fix: screws(legScrews(f, yT, CORNERS, "both", 6)),
    tools: ["allen"],
  };
  const shelfSteps: CustomStep[] = o.mid
    ? [
        {
          title: "Clip the shelf hooks into the legs",
          detail: "One in each leg at the height you want, all four in the same row of slots. Hook it in and push it down until it locks.",
          fix: hooks(f, midY),
        },
        { title: "Lay the shelf on the hooks", detail: "Tilt it in between the legs, then lower it flat onto all four hooks.", add: [`${f.key}S`] },
      ]
    : [];

  if (o.order === "again") {
    return {
      parts,
      steps: [
        {
          title: "Build the second unit the same way",
          detail: "Bottom shelf upside down on the floor, legs screwed on, then turn it over. Leave its feet in the bag: they join the two units later.",
          add: [...ids(CORNERS), `${f.key}B`],
          fix: screws([...legScrews(f, yB, BACK, "both", 6), ...legScrews(f, yB, FRONT, "both", 6)]),
          tools: ["allen"],
        },
        topStep,
        ...shelfSteps,
      ],
    };
  }

  const steps: CustomStep[] = [];
  if (o.order === "81") {
    steps.push({
      title: f.feet ? "Screw a foot into each leg" : "Lay out the four legs",
      detail: f.feet ? "Turn them in by hand, all the way. You level the unit with them at the end." : "Keep the four feet aside: they join this unit to the one under it.",
      add: ids(CORNERS),
      fix: f.feet ? [feetFix(f)] : [],
      pose: "-y",
    });
    steps.push({
      title: "Screw the bottom shelf to the back legs",
      detail: "Lay it upside down on a rug between the legs, rim up. One screw into each back leg, hand tight for now.",
      add: [`${f.key}B`],
      fix: screws(legScrews(f, yB, BACK, "side")),
      tools: ["allen"],
      pose: "-y",
    });
  } else {
    steps.push({
      title: "Screw two legs to the bottom shelf",
      detail: "Lay the shelf upside down on a rug, rim up. One screw into each back leg, hand tight for now.",
      add: [`${f.key}B`, ...ids(BACK)],
      fix: screws(legScrews(f, yB, BACK, "side")),
      tools: ["allen"],
      pose: "-y",
    });
  }
  steps.push({
    title: "Screw on the front legs",
    detail: "Two screws into each, one from the side and one from the front.",
    add: ids(FRONT),
    fix: screws(legScrews(f, yB, FRONT, "both")),
    tools: ["allen"],
    pose: "-y",
  });
  steps.push({
    title: "Turn it over and add two more screws",
    detail: "Stand it on its legs and screw through the back of each back leg into the shelf.",
    fix: screws(legScrews(f, yB, BACK, "face")),
    tools: ["allen"],
    pose: "+y",
  });
  steps.push(topStep);
  if (o.order === "45") {
    steps.push({ title: "Tighten all the screws", detail: "Go round all sixteen with the Allen key now that the unit stands square.", tools: ["allen"], check: "square" });
    steps.push({
      title: "Screw a foot into each leg",
      detail: "Tip the unit onto its back to reach them, or leave them out if it will stand on another KOLBJÖRN.",
      fix: [feetFix(f)],
    });
  }
  steps.push(...shelfSteps);
  return { parts, steps };
}

/* ---------- the 80x81 cabinet ---------- */

interface Cab80 {
  frame: Built; // legs to top
  shelf: Built; // hooks and the shelf, fitted with the doors open
  doorY: [number, number];
  pivots: number[];
}

/** The 80x81 cabinet: two side frames hooked onto the legs, the bottom, a back in two halves, the top. */
function cabinet80(f: Frame): Cab80 {
  const W = f.W, k = f.key;
  const bot = f.y0 + 150, panelY0 = bot + TRAY, panelY1 = f.top - TOP;
  const zIn0 = -D / 2 + BZ, zIn1 = D / 2 - FZ;
  const shelfY = f.y0 + 470;
  const sidePanel = (sx: number): CustomPart => ({ id: `${k}P${sx > 0 ? "R" : "L"}`, name: "Side panel", size: [3, panelY1 - panelY0, zIn1 - zIn0], pos: [sx * (W / 2 - 1.5), (panelY0 + panelY1) / 2, (zIn0 + zIn1) / 2], material: "metal" });
  const backHalf = (sx: number): CustomPart => ({ id: `${k}K${sx > 0 ? "R" : "L"}`, name: "Back panel half", size: [W / 2 - LW, panelY1 - panelY0, 3], pos: [sx * ((W / 2 - LW) / 2), (panelY0 + panelY1) / 2, -D / 2 + 1.5], material: "metal" });
  const yB = bot + TRAY / 2, yT = f.top - TOP / 2;
  const frame: Built = {
    parts: [...legs(f), sidePanel(-1), sidePanel(1), tray(`${k}B`, "Bottom", W, bot, TRAY), backHalf(-1), backHalf(1), tray(`${k}T`, "Top", W, f.top - TOP, TOP)],
    steps: [
      {
        title: "Screw a foot into each leg",
        detail: "Turn them in by hand, all the way. You level the cabinet with them at the end.",
        add: legs(f).map((p) => p.id),
        fix: f.feet ? [feetFix(f)] : [],
        pose: "-y",
      },
      {
        title: "Hook a side panel between each pair of legs",
        detail: "One front and one back leg per side. Push the panel's tabs into the slots on both legs and press until they click.",
        add: [`${k}PL`, `${k}PR`],
        pose: "-y",
      },
      { title: "Slide the bottom in between the sides", detail: "Rim up, as it lies upside down. Its tabs go into the slots at the foot of each leg.", add: [`${k}B`], pose: "-y" },
      {
        title: "Screw the bottom to the legs",
        detail: "Six screws: two into each back leg and one into the side of each front leg.",
        fix: screws([...legScrews(f, yB, BACK, "both"), ...legScrews(f, yB, FRONT, "side")]),
        tools: ["allen"],
        pose: "-y",
      },
      { title: "Turn it over and add two more screws", detail: "Through the front of each front leg into the bottom.", fix: screws(legScrews(f, yB, FRONT, "face")), tools: ["allen"], pose: "+y" },
      {
        title: "Screw the back halves together and slide the back in",
        detail: "Three screws along the overlap, then lower the back down behind the sides until its hooks catch in the back legs.",
        add: [`${k}KL`, `${k}KR`],
        fix: [{ ...SCREW, count: 3, at: [0.25, 0.5, 0.75].map((t) => [0, panelY0 + t * (panelY1 - panelY0), -D / 2] as Vec3), dir: [0, 0, 1] }],
        tools: ["screwdriver"],
      },
      { title: "Fold the tabs over at the bottom", detail: "Bend the eight tabs along the bottom over the side and back panels with a screwdriver, so they can't lift out.", tools: ["flathead"] },
      { title: "Put the top on", detail: "Its corners drop over the ends of the legs. Fold the eight tabs under it over the panels, the same as at the bottom.", add: [`${k}T`], tools: ["flathead"] },
      { title: "Screw the top to the legs", detail: "Two screws into each leg, one from the side and one from the front or back.", fix: screws(legScrews(f, yT, CORNERS, "both", 6)), tools: ["allen"] },
    ],
  };
  const shelf: Built = {
    parts: [tray(`${k}S`, "Shelf", W - 2 * LW - 2, shelfY, SH, zIn1 - zIn0 + 10, (zIn0 + zIn1) / 2 - 10)],
    steps: [
      { title: "Clip the shelf hooks into the legs", detail: "One in each leg, all four in the same row of slots. Hook it in and push it down until it locks.", fix: hooks(f, shelfY) },
      { title: "Lay the shelf on the hooks", detail: "Tilt it in through the doors and lower it flat onto all four hooks.", add: [`${k}S`] },
    ],
  };
  const pivot = W / 2 - LW - 16;
  return { frame, shelf, doorY: [panelY0, panelY1], pivots: [-pivot, pivot] };
}

/** Doors on, catch and magnets fitted with them open, then the shelf; the doors close for the level step. */
function build80(b: PlanBuilder, s: ProductSpec, f: Frame) {
  const c = cabinet80(f);
  custom(b, s, c.frame);
  const [y0, y1] = c.doorY;
  bushes(b, c.pivots, y0, y1, "One into the top and one into the bottom at each front corner, where the doors pivot.");
  const w = f.W / 2 - LW - 1, h = y1 - y0 - 12;
  const doors = [-1, 1].map((sx) => makeDoor(b, "Door", w, h, sx * (w / 2 + 1), (y0 + y1) / 2, sx, true));
  b.step({ title: "Clip the hinges into the doors", detail: "Lay the doors face down. One hinge clips into the top and one into the bottom corner on each door's outer edge.", kind: "hinges", scene: "doors", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    doors.forEach((d, i) => b.stage(d.key, [(i - 0.5) * (w + 80), DOOR_T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]));
    b.then(0.1);
    for (const d of doors) pins(b, d, y0 + 6, y1 - 6);
  });
  b.step({ title: "Hang the doors", detail: "Hold each door in its opening and push the hinge pins up and down into the bushes.", kind: "doors" }, () => {
    b.stagger(0.35);
    for (const d of doors) b.add(d.key, [0, 0, 380]);
  });
  b.step({ title: "Screw the catch plate inside the left door", detail: "Open both doors. The plate goes at the top of the left door's free edge and holds it while the right one closes.", kind: "screws", tools: ["screwdriver"] }, () => {
    for (const d of doors) openDoor(b, d);
    b.then(0.2);
    const d = doors[0];
    put(b, CATCH, [[d.free, y1 - 50, D / 2 - DOOR_T]], [0, 0, 1], d.key);
    b.then(0.05);
    put(b, CATCH_SCREW, [[d.free, y1 - 50, D / 2 - DOOR_T - 2]], [0, 0, 1], d.key);
  });
  b.step({ title: "Screw the two magnets into the right door", detail: "Top and bottom of its free edge, on the inside. They keep the doors shut.", kind: "screws", tools: ["screwdriver"] }, () => {
    const d = doors[1];
    const ys = [y0 + 50, y1 - 50];
    put(b, MAGNET, ys.map((y) => [d.free, y, D / 2 - DOOR_T]), [0, 0, 1], d.key);
    b.then(0.05);
    put(b, MAGNET_SCREW, ys.map((y) => [d.free, y, D / 2 - DOOR_T - 2]), [0, 0, 1], d.key);
  });
  custom(b, s, c.shelf);
  return () => {
    for (const d of doors) b.add(d.key);
  };
}

/* ---------- the 90x161 cabinet ---------- */

/** Built lying on its back: shelves on the left behind one door, hook rails on the right behind two. */
function build90(b: PlanBuilder, s: ProductSpec, W: number, H: number) {
  const f: Frame = { key: "", W, y0: 0, top: H, feet: true };
  const bot = 160, panelY0 = bot + TRAY, panelY1 = H - TOP;
  const zIn0 = -D / 2 + BZ, zIn1 = D / 2 - FZ;
  const inner = W / 2 - LW;
  const doorW = (2 * inner - 4) / 3;
  const doorX = [-1, 0, 1].map((i) => i * (doorW + 2));
  const divX = -inner + doorW + 1;
  const backW = (2 * inner) / 3;
  const panelH = panelY1 - panelY0, panelC = (panelY0 + panelY1) / 2;
  const railYs = [H - 220, H - 760];
  const railX0 = divX + 22, railX1 = W / 2 - 3; // out to the right side panel, where its end is screwed
  const railZ = -40;
  const shelfYs = [0.3, 0.52, 0.74].map((t) => Math.round(panelY0 + t * panelH));
  const leftW = divX - 2 + inner;
  const parts: CustomPart[] = [
    ...legs(f),
    ...[-1, 1].map((sx) => ({ id: `P${sx > 0 ? "R" : "L"}`, name: "Side panel", size: [3, panelH, zIn1 - zIn0] as Vec3, pos: [sx * (W / 2 - 1.5), panelC, (zIn0 + zIn1) / 2] as Vec3, material: "metal" as const })),
    tray("B", "Vented bottom", W, bot, TRAY),
    ...[0, 1, 2].map((i) => ({ id: `K${i}`, name: i === 1 ? "Middle back panel" : "Back panel", size: [backW, panelH, 3] as Vec3, pos: [-inner + backW * (i + 0.5), panelC, -D / 2 + 1.5] as Vec3, material: "metal" as const })),
    { id: "V", name: "Divider", size: [3, panelH, zIn1 - zIn0 + 10], pos: [divX, panelC, (zIn0 + zIn1) / 2 - 5], material: "metal" },
    tray("T", "Top", W, H - TOP, TOP),
    ...railYs.map((y, i) => ({ id: `Q${i}`, name: "Rail bracket", size: [20, 50, 40] as Vec3, pos: [divX + 11.5, y, railZ] as Vec3, material: "metal" as const })),
    ...railYs.map((y, i) => ({ id: `R${i}`, name: "Hook rail", size: [railX1 - railX0, 24, 20] as Vec3, pos: [(railX0 + railX1) / 2, y, railZ] as Vec3, material: "metal" as const })),
    ...shelfYs.map((y, i) => tray(`S${i}`, "Shelf", leftW - 2, y, SH, zIn1 - zIn0, (zIn0 + zIn1) / 2 - 10)),
  ];
  const left = CORNERS.filter((c) => c[0] < 0), right = CORNERS.filter((c) => c[0] > 0);
  const yB = bot + TRAY / 2, yT = H - TOP / 2;
  const bottomScrews = (cs: Corner[]): Pt[] => [...legScrews(f, yB, cs, "side"), ...legScrews(f, yB, cs.filter((c) => c[1] > 0), "face")];
  const seam = (x: number, n: number): CustomFix => ({ ...SCREW, count: n, at: Array.from({ length: n }, (_, i) => [x, panelY0 + ((i + 1) * panelH) / (n + 1), -D / 2] as Vec3), dir: [0, 0, 1] });
  const hookXs = [
    [0.2, 0.5, 0.8],
    [0.3, 0.7],
  ].map((ts) => ts.map((t) => railX0 + t * (railX1 - railX0)));
  const steps: CustomStep[] = [
    {
      title: "Screw a foot into two of the legs",
      detail: "The front and back leg for the left side. Lay them on a rug and turn the feet in by hand, all the way.",
      add: [legId(f, [-1, 1]), legId(f, [-1, -1])],
      fix: [feetFix(f, left)],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Clip a side panel between the two legs", detail: "Slide each leg onto the panel's edge, push the tabs into the slots and fold them over.", add: ["PL"], pose: "+z" },
    { title: "Hook the vented bottom onto the legs", detail: "Its tabs go into the slots near the feet.", add: ["B"], pose: "+z" },
    { title: "Screw the bottom to the legs", detail: "Three screws, two into the front leg and one into the back leg.", fix: screws(bottomScrews(left)), tools: ["allen"], pose: "+z" },
    {
      title: "Join two back panels and clip them on",
      detail: "Screw the middle panel to one of the outer ones with two screws, then hook them onto the side and the bottom and fold the tabs over.",
      add: ["K0", "K1"],
      fix: [seam(-inner + backW, 2)],
      tools: ["screwdriver"],
      pose: "+z",
    },
    { title: "Slide the divider in", detail: "From the open end, along the edge of the middle panel, until it clicks into the bottom.", add: ["V"], pose: "+z" },
    { title: "Screw the back to the divider", detail: "Four screws through the back panel into the divider's edge.", fix: [seam(divX, 4)], tools: ["screwdriver"], pose: "+z" },
    {
      title: "Screw on the angle bracket",
      detail: "Under the divider at the front of the bottom. It keeps the divider from moving sideways.",
      fix: [
        { kind: "angle", count: 1, at: [[divX + 2, panelY0, zIn1 - 20]], dir: [0, -1, 0], on: "B", len: 30, dia: 24 },
        { ...SCREW, count: 1, at: [[divX + 12, panelY0, zIn1 - 20]], dir: [0, -1, 0], on: "B" },
      ],
      tools: ["screwdriver"],
      pose: "+z",
    },
    {
      title: "Build the other side frame",
      detail: "Feet into the last two legs, then clip the second side panel between them the same way.",
      add: [legId(f, [1, 1]), legId(f, [1, -1]), "PR"],
      fix: [feetFix(f, right)],
      pose: "+z",
    },
    { title: "Clip on the last back panel and close the cabinet", detail: "Hook the panel onto the new side, then fit the side onto the bottom and the back so the tabs go into their slots.", add: ["K2"], pose: "+z" },
    { title: "Screw the bottom to the new legs", detail: "Three screws, the same as on the first side.", fix: screws(bottomScrews(right)), tools: ["allen"], pose: "+z" },
    { title: "Screw the back panels together", detail: "Four screws along the seam between the last panel and the middle one.", fix: [seam(inner - backW, 4)], tools: ["screwdriver"], pose: "+z" },
    { title: "Stand it up and put the top on", detail: "Lift it upright together. The top's corners drop over the ends of the legs.", add: ["T"], people: 2, pose: "+y", warnings: ["two"] },
    {
      title: "Screw the top to the legs",
      detail: "Three screws into each leg.",
      fix: screws(CORNERS.flatMap((c) => [...legScrews(f, yT, [c], "both", 6), { p: [c[0] * (W / 2), yT + 8, legZ(c[1]) + 8], d: [-c[0], 0, 0] } as Pt])),
      tools: ["allen"],
    },
    { title: "Screw the top to the divider", detail: "One screw down through the top into the divider.", fix: [{ ...SCREW, count: 1, at: [[divX, H, 0]], dir: [0, -1, 0], on: "T" }], tools: ["screwdriver"] },
    {
      title: "Tighten all the screws and fold the tabs",
      detail: "Go round all eighteen Allen screws now it stands square. Then turn the ten tabs at the bottom and fold the ten under the top over the panels.",
      tools: ["allen", "flathead"],
      check: "square",
    },
    {
      title: "Screw the rail brackets to the divider",
      detail: "One at each height, on the right side of the divider. Two screws each.",
      add: ["Q0", "Q1"],
      fix: [{ ...RAIL_SCREW, count: 4, at: railYs.flatMap((y) => [y - 14, y + 14].map((yy) => [divX + 22, yy, railZ] as Vec3)), dir: [-1, 0, 0] }],
      tools: ["screwdriver"],
    },
    {
      title: "Slide the hooks onto the rails",
      detail: "Three on one rail, two on the other. They slide along, so space them however you like.",
      add: ["R0", "R1"],
      fix: hookXs.map((xs, i) => ({ kind: "hook", name: "Large hook", count: xs.length, at: xs.map((x) => [x, railYs[i] - 12, railZ + 10] as Vec3), dir: [0, 1, 0], on: `R${i}`, len: 90, dia: 30 })),
    },
    {
      title: "Screw the rails in",
      detail: "One end on its bracket, the other to the right side. Two screws at each end.",
      fix: [
        { ...RAIL_SCREW, count: 2, at: railYs.map((y) => [railX0 + 10, y + 12, railZ] as Vec3), dir: [0, -1, 0] },
        { ...RAIL_SCREW, count: 2, at: railYs.map((y) => [railX1 - 6, y, railZ] as Vec3), dir: [1, 0, 0] },
      ],
      tools: ["screwdriver"],
    },
    { title: "Hang the shelves in the left side", detail: "Each one hooks into the slots at the back and front and drops into place.", add: shelfYs.map((_, i) => `S${i}`) },
  ];
  custom(b, s, { parts, steps });

  // the doors, fitted lying face down, then hung: the left one on the outer edge, the middle one on the divider
  const h = panelH - 12;
  const doors = [
    makeDoor(b, "Door", doorW, h, doorX[0], panelC, -1, true),
    makeDoor(b, "Middle door", doorW, h, doorX[1], panelC, -1, true),
    makeDoor(b, "Door", doorW, h, doorX[2], panelC, 1, false),
  ];
  const flat = (i: number) => b.stage(doors[i].key, [(i - 1) * (doorW + 80), DOOR_T / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
  b.step({ title: "Screw the catch plate onto the middle door", detail: "Lay the doors face down on a rug. The plate goes at the top of the middle door's free edge.", kind: "screws", tools: ["screwdriver"], scene: "doors", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    [0, 1, 2].forEach(flat);
    b.then(0.1);
    const d = doors[1];
    put(b, CATCH, [[d.free, panelY1 - 50, D / 2 - DOOR_T]], [0, 0, 1], d.key);
    b.then(0.05);
    put(b, CATCH_SCREW, [[d.free, panelY1 - 50, D / 2 - DOOR_T - 2]], [0, 0, 1], d.key);
  });
  b.step({ title: "Screw the magnets onto the other two doors", detail: "Two on each, at the top and bottom of the edge without hinges.", kind: "screws", tools: ["screwdriver"], scene: "doors" }, () => {
    const pts = [doors[0], doors[2]].flatMap((d) => [panelY0 + 50, panelY1 - 50].map((y) => ({ d, p: [d.free, y, D / 2 - DOOR_T] as Vec3 })));
    for (const { d, p } of pts) put(b, MAGNET, [p], [0, 0, 1], d.key);
    b.then(0.05);
    for (const { d, p } of pts) put(b, MAGNET_SCREW, [[p[0], p[1], p[2] - 2]], [0, 0, 1], d.key);
  });
  bushes(b, doors.map((d) => d.pivot), panelY0, panelY1, "Three into the top and three into the bottom, where the doors pivot.");
  b.step({ title: "Hang the middle door", detail: "Clip a hinge into its top and bottom corner on the divider side, then push the pins up and down into the bushes.", kind: "doors" }, () => {
    pins(b, doors[1], panelY0 + 6, panelY1 - 6);
    b.then(0.1);
    b.add(doors[1].key, [0, 0, 380]);
  });
  b.step({ title: "Hang the two outer doors", detail: "The same way, with the hinges on their outer edges.", kind: "doors" }, () => {
    for (const i of [0, 2]) pins(b, doors[i], panelY0 + 6, panelY1 - 6);
    b.then(0.1);
    b.stagger(0.35);
    for (const i of [0, 2]) b.add(doors[i].key, [0, 0, 380]);
  });
  levelStep(b);
  wallStep(b, f, TOP + 20);
}

/* ---------- stacks ---------- */

/** The upper unit's feet, screwed up through the lower unit's top into its legs. */
const stackStep = (lower: Frame, upper: Frame, title: string, detail: string): CustomStep => ({
  title,
  detail,
  fix: [feetAt(upper, CORNERS, lower.top - TOP)],
  people: 2,
  warnings: ["two"],
  tools: ["flathead"],
});

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const text = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
  const W = Math.round(s.size.w * 10);
  const H = Math.round(s.size.h * 10);
  const cabinet = /cabinet/.test(text);
  const shelvingUnit = /shelving/.test(text);
  if (W !== 800 && W !== 900) return false;

  if (cabinet && W === 900) {
    build90(b, s, 900, 1610);
    return true;
  }
  const UNIT = 810;
  const lower: Frame = { key: "", W: 800, y0: 0, top: UNIT, feet: true };
  const upper: Frame = { key: "U", W: 800, y0: UNIT, top: 2 * UNIT - FOOT, feet: false };

  if (cabinet && shelvingUnit) {
    // the shelving unit stands on the cabinet, its feet screwed up through the cabinet's top
    const close = build80(b, s, lower);
    levelStep(b, close);
    const u = shelving(upper, { order: "81", mid: true });
    custom(b, s, {
      parts: u.parts,
      steps: [
        ...u.steps.map((st) => ({ ...st, pose: "+y" as const, detail: st.pose === "-y" ? `${st.detail} Build it upside down on the floor, next to the cabinet.` : st.detail })),
        stackStep(lower, upper, "Lift the shelving unit onto the cabinet", "Together, legs onto the corners of the cabinet's top. From inside the cabinet, screw a foot up through each hole in the top into the legs."),
      ],
    });
    capsStep(b, upper);
    wallStep(b, lower, TOP + 20, "Fix the cabinet to the wall");
    wallStep(b, upper, TOP / 2, "Fix the shelving unit to the wall");
    return true;
  }
  if (cabinet) {
    const close = build80(b, s, lower);
    levelStep(b, close);
    wallStep(b, lower, TOP + 20);
    capsStep(b, lower);
    return true;
  }
  if (!shelvingUnit) return false;
  if (H > 1200) {
    // two 80x81 units stacked
    const a = shelving(lower, { order: "81", mid: true });
    const u = shelving(upper, { order: "again", mid: true });
    custom(b, s, {
      parts: [...a.parts, ...u.parts],
      steps: [
        ...a.steps,
        { title: "Level it with the feet", detail: "Stand it where it goes and turn the feet until the top is level and it doesn't rock.", tools: ["level"] },
        ...u.steps,
        stackStep(lower, upper, "Lift the second unit onto the first", "Together, legs onto the corners of the lower top. From underneath, screw a foot up through each hole in the lower top into the legs."),
      ],
    });
    capsStep(b, upper);
    wallStep(b, lower, TOP / 2, "Fix the lower unit to the wall");
    wallStep(b, upper, TOP / 2, "Fix the upper unit to the wall");
    return true;
  }
  const tall = H > 600;
  const f: Frame = { key: "", W: 800, y0: 0, top: tall ? UNIT : 450, feet: true };
  custom(b, s, shelving(f, { order: tall ? "81" : "45", mid: tall }));
  if (tall) {
    levelStep(b);
    wallStep(b, f, TOP / 2);
    capsStep(b, f);
  } else {
    capsStep(b, f);
    levelStep(b);
    wallStep(b, f, TOP / 2);
  }
  return true;
}

const family: Family = {
  names: ["KOLBJÖRN", "KOLBJORN"],
  build,
};
export default family;
