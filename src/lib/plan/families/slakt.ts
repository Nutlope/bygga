import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * SLÄKT, from IKEA's manuals. The bed frame: glides tapped into the headboard and footboard, dowels in the side rail
 * ends, a metal slat rail screwed along each side rail, the rails bolted to both ends with long bolts into barrel nuts,
 * two telescopic straps across the middle, four slat stops and the slatted base rolled out. The bed with 3 storage
 * boxes adds three boxes on castors, each a cam-locked carcass with a drawer on runners; the house accessory slips over
 * the headboard. The bed with storage is a cam-locked unit (open shelves at the head, four drawers) between the
 * headboard and footboard, with the side rails on top, the drawers on runners and a padded headboard hung on brackets.
 * The extendable bed is a head section and a foot section on legs that slide together and are bolted at length.
 * The underbed with storage has its own manual (see underbed below).
 */

/* ---------- helpers: mm, x across the bed, y up, z from the head (-) to the foot (+) ---------- */

type B6 = [number, number, number, number, number, number]; // x0, x1, y0, y1, z0, z1
const pc = (b: B6, shape: "box" | "cyl" = "box"): PartPiece => ({ shape, size: [b[1] - b[0], b[3] - b[2], b[5] - b[4]], pos: [(b[0] + b[1]) / 2, (b[2] + b[3]) / 2, (b[4] + b[5]) / 2] });
const box = (id: string, name: string, b: B6, material: PartMaterial = "board"): CustomPart => {
  const p = pc(b);
  return { id, name, size: p.size, pos: p.pos, material };
};
function compound(id: string, name: string, abs: PartPiece[], material: PartMaterial): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...abs.map((p) => p.pos[k] - p.size[k] / 2)));
  const hi = [0, 1, 2].map((k) => Math.max(...abs.map((p) => p.pos[k] + p.size[k] / 2)));
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const size = [0, 1, 2].map((k) => hi[k] - lo[k]) as Vec3;
  return { id, name, size, pos, material, pieces: abs.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] as Vec3 })) };
}
const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const spread = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));
const UP: Vec3 = [0, 1, 0], DOWN: Vec3 = [0, -1, 0];

/* ---------- the fittings ---------- */

const GLIDE = { kind: "glide", len: 8, dia: 30, name: "Glide" } as const; // nailed in
const DOWEL = { kind: "dowel", len: 30, dia: 8 } as const;
const BIG_DOWEL = { kind: "dowel", len: 40, dia: 10 } as const;
const RAIL_SCREW = { kind: "screw", len: 16, dia: 4 } as const;
const BOLT = { kind: "bolt", len: 100, dia: 6 } as const;
const BARREL = { kind: "nut", len: 14, dia: 10, name: "Barrel nut" } as const;
const SMALL_SCREW = { kind: "screw", len: 10, dia: 5 } as const;
const STRAP_SCREW = { kind: "screw", len: 12, dia: 6 } as const;
const STOP = { kind: "clip", len: 20, dia: 30, name: "Slat stop" } as const;
const CAMBOLT = { kind: "camScrew", len: 34, dia: 7 } as const;
const CAM = { kind: "cam", len: 13, dia: 15 } as const;
const CAP = { kind: "cap", len: 10, dia: 30, name: "Leg cap" } as const;

/* ---------- the bed frame (one manual for 90x200) ---------- */

interface Bed {
  W: number;
  L: number;
  parts: CustomPart[];
  steps: CustomStep[];
}

function bedFrame(head = 780, foot = 570): Bed {
  const W = 960, L = 2060, t = 18, zi = L / 2 - t;
  const ry0 = 360, ry1 = 520, sy0 = 380, sy1 = 405;
  const xr = W / 2 - t / 2, xs = W / 2 - t - 12;
  const parts: CustomPart[] = [
    box("H", "Headboard", [-W / 2, W / 2, 0, head, -L / 2, -zi]),
    box("F", "Footboard", [-W / 2, W / 2, 0, foot, zi, L / 2]),
    box("RL", "Side rail", [-W / 2, -W / 2 + t, ry0, ry1, -zi, zi]),
    box("RR", "Side rail", [W / 2 - t, W / 2, ry0, ry1, -zi, zi]),
    box("SL", "Slat rail", [-W / 2 + t, -W / 2 + t + 25, sy0, sy1, -zi + 15, zi - 15], "metal"),
    box("SR", "Slat rail", [W / 2 - t - 25, W / 2 - t, sy0, sy1, -zi + 15, zi - 15], "metal"),
    ...[-330, 330].map((z, i) => box(`ST${i}`, "Centre strap", [-W / 2 + t + 25, W / 2 - t - 25, sy1 - 10, sy1 + 4, z - 20, z + 20], "metal")),
    compound("SB", "Slatted bed base", spread(-zi + 40, zi - 40, 17).map((z) => pc([-W / 2 + t + 6, W / 2 - t - 6, sy1 + 4, sy1 + 19, z - 30, z + 30])), "wood"),
  ];
  const ends: [string, number][] = [["H", -1], ["F", 1]];
  const glides = (id: string, e: number) => fx(GLIDE.kind, [-1, 1].map((s): Vec3 => [s * (W / 2 - 80), 0, e * (L / 2 - t / 2)]), UP, { ...GLIDE, on: id });
  // a dowel goes into the rail end, so its direction depends on the end: split by end
  const railDowels = (["RL", "RR"] as const).flatMap((id, i) => [-1, 1].map((e) => fx(DOWEL.kind, [390, 490].map((y): Vec3 => [(i ? 1 : -1) * xr, y, e * zi]), [0, 0, -e], { ...DOWEL, on: id, mate: e < 0 ? "H" : "F" })));
  const railScrews = (["SL", "SR"] as const).map((id, i) => fx(RAIL_SCREW.kind, spread(-zi + 120, zi - 120, 8).map((z): Vec3 => [(i ? 1 : -1) * (W / 2 - t - 25), (sy0 + sy1) / 2, z]), [i ? 1 : -1, 0, 0], { ...RAIL_SCREW, on: id, mate: i ? "RR" : "RL" }));
  const endBolts = (end: string, e: number): CustomFix[] => [
    ...(["RL", "RR"] as const).map((id, i) => fx(BARREL.kind, [425, 455].map((y): Vec3 => [(i ? 1 : -1) * (W / 2 - t), y, e * (zi - 50)]), [i ? 1 : -1, 0, 0], { ...BARREL, on: id })),
    ...(["RL", "RR"] as const).map((id, i) => fx(BOLT.kind, [425, 455].map((y): Vec3 => [(i ? 1 : -1) * xr, y, e * (L / 2)]), [0, 0, -e], { ...BOLT, on: end, mate: id })),
  ];
  const strapEnds = [-330, 330].flatMap((z, i) => [-1, 1].map((s) => ({ z, i, s })));
  const steps: CustomStep[] = [
    {
      title: "Tap the glides into the headboard and footboard",
      detail: "Lay both on a rug. Two glides into the bottom edge of each, tapped in with a hammer.",
      add: ["H", "F"],
      fix: ends.map(([id, e]) => glides(id, e)),
      warnings: ["floor"],
      kind: "nails",
      tools: ["hammer"],
    },
    { title: "Tap two dowels into each end of the side rails", detail: "Into the holes in the end edges, about halfway.", fix: railDowels, kind: "dowels", tools: ["hammer"] },
    {
      title: "Screw a slat rail along the inside of each side rail",
      detail: "Eight screws each, in the numbered order, by hand with the screwdriver. A drill can strip the holes.",
      add: ["SL", "SR"],
      fix: railScrews,
      kind: "screws",
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the side rails to the headboard",
      detail: "One of you holds the rails on the headboard's dowels. Drop a barrel nut into each hole inside the rail, slot facing the bolt, then turn the long bolts in through the headboard with the Allen key.",
      fix: endBolts("H", -1),
      people: 2,
      kind: "bolts",
      warnings: ["two"],
      tools: ["allen", "flathead"],
    },
    { title: "Bolt the footboard on", detail: "The same way: barrel nuts in the rails, long bolts through the footboard.", fix: endBolts("F", 1), people: 2, kind: "bolts", warnings: ["two"], tools: ["allen", "flathead"] },
    {
      title: "Screw the two centre straps across the slat rails",
      detail: "Pull each strap out to fit between the rails, then a screw down through each end.",
      add: ["ST0", "ST1"],
      fix: [fx(STRAP_SCREW.kind, strapEnds.map((q): Vec3 => [q.s * xs, sy1 + 4, q.z]), DOWN, { ...STRAP_SCREW, on: "ST0" })],
      kind: "screws",
      tools: ["screwdriver"],
    },
    { title: "Lock each strap at its length", detail: "One screw through the middle, where its two halves overlap.", fix: [fx(STRAP_SCREW.kind, [[0, sy1 + 4, -330], [0, sy1 + 4, 330]], DOWN, { ...STRAP_SCREW })], kind: "screws", tools: ["screwdriver"] },
    {
      title: "Screw the slat stops onto the corners",
      detail: "One on each slat rail at both ends. They keep the slatted base from sliding.",
      fix: [fx(STOP.kind, [-1, 1].flatMap((s) => [-1, 1].map((e): Vec3 => [s * xs, sy1, e * (zi - 30)])), DOWN, { ...STOP }), fx(SMALL_SCREW.kind, [-1, 1].flatMap((s) => [-1, 1].map((e): Vec3 => [s * xs, sy1, e * (zi - 60)])), DOWN, { ...SMALL_SCREW })],
      kind: "screws",
      tools: ["screwdriver"],
    },
    { title: "Roll out the slatted base", detail: "Curved side up, over the slat rails and the straps.", add: ["SB"], kind: "slats", tools: [] },
    { title: "Tuck the end slats under the stops", detail: "At all four corners: push the slat down and slide it under the stop.", kind: "slats", tools: [] },
  ];
  return { W, L, parts, steps };
}

/* ---------- the storage box with castors (built three times) ---------- */

function storageBox(i: number, zc: number, x0: number): { parts: CustomPart[]; groups: CustomStep[][] } {
  const p = `X${i}`;
  const D = 620, Hb = 350, cz = 50, t = 18;
  const x1 = x0 + D - t; // front edge of the carcass, the drawer front covers it
  const z0 = zc - D / 2, z1 = zc + D / 2;
  const id = (s: string) => `${p}${s}`;
  const parts: CustomPart[] = [
    box(id("B"), "Box bottom", [x0, x1, cz, cz + t, z0, z1]),
    box(id("SA"), "Box side", [x0, x1, cz + t, Hb - t, z0, z0 + t]),
    box(id("SB"), "Box side", [x0, x1, cz + t, Hb - t, z1 - t, z1]),
    box(id("K"), "Box back", [x0, x0 + 3, cz + t, Hb - t, z0 + t, z1 - t], "fiber"),
    box(id("T"), "Box top", [x0, x1, Hb - t, Hb, z0, z1]),
    box(id("DS1"), "Drawer side", [x0 + 30, x1, cz + 40, Hb - 60, z0 + 30, z0 + 45]),
    box(id("DS2"), "Drawer side", [x0 + 30, x1, cz + 40, Hb - 60, z1 - 45, z1 - 30]),
    box(id("DK"), "Drawer back", [x0 + 30, x0 + 45, cz + 40, Hb - 60, z0 + 45, z1 - 45]),
    box(id("DB"), "Drawer bottom", [x0 + 45, x1, cz + 40, cz + 43, z0 + 45, z1 - 45], "fiber"),
    box(id("DF"), "Drawer front", [x1, x1 + t, cz + 5, Hb - 5, z0 + 2, z1 - 2]),
  ];
  const sideIn = (s: -1 | 1) => (s < 0 ? z0 + t : z1 - t);
  const sid = (s: -1 | 1) => id(s < 0 ? "SA" : "SB");
  const both = [-1, 1] as const;
  const at2 = (y: number, s: -1 | 1, xs = [x0 + 60, x1 - 60]) => xs.map((x): Vec3 => [x, y, sideIn(s)]);
  const castors = [[x0 + 50, z0 + 60], [x1 - 50, z0 + 60], [x1 - 50, z1 - 60], [x0 + 50, z1 - 60]] as const;
  const CASTOR = { kind: "castor", len: 50, dia: 45, name: "Castor" } as const;
  const LOCKC = { ...CASTOR, name: "Locking castor" } as const;
  const dz = [z0 + 37, z1 - 37];
  const groups: CustomStep[][] = [
    [
      {
        title: "Tap four castor sockets into the box bottom",
        detail: "Lay it on a rug. One into each corner hole, tapped flush with a hammer.",
        add: [id("B")],
        fix: [fx("cap", castors.map(([x, z]): Vec3 => [x, cz, z]), UP, { len: 10, dia: 22, name: "Castor socket", on: id("B") })],
        warnings: ["floor"],
        kind: "nails",
        tools: ["hammer"],
      },
      { title: "Tap dowels into its edges", detail: "Twelve, along the edges the sides and the back stand on.", fix: [...both.map((s) => fx(DOWEL.kind, spread(x0 + 60, x1 - 60, 6).map((x): Vec3 => [x, cz + t, s < 0 ? z0 + t / 2 : z1 - t / 2]), DOWN, { ...DOWEL, on: id("B"), mate: sid(s) }))], kind: "dowels", tools: ["hammer"] },
    ],
    [
      {
        title: "Fit the sides and stand them on the bottom",
        detail: "First two cam bolts, two dowels and a drawer runner (three screws) on each side's inner face, then press them onto the bottom's dowels.",
        add: [id("SA"), id("SB")],
        fix: [
          ...both.map((s) => fx(CAMBOLT.kind, at2(Hb - t - 25, s), [0, 0, s], { ...CAMBOLT, on: sid(s), mate: id("T") })),
          ...both.map((s) => fx(DOWEL.kind, at2(Hb - t, s, [x0 + 120, x1 - 120]), DOWN, { ...DOWEL, on: sid(s), mate: id("T") })),
          ...both.map((s) => fx("runner", [[(x0 + x1) / 2, cz + 70, sideIn(s)]], [0, 0, -s], { len: 520, dia: 30, name: "Drawer runner", on: sid(s), twist: Math.PI / 2 })),
          fx("screw", both.flatMap((s) => spread(x0 + 80, x1 - 80, 3).map((x): Vec3 => [x, cz + 70, sideIn(s)])), [0, 0, 0], { len: 12, dia: 4, on: id("SA") }),
        ],
        kind: "join",
        tools: ["screwdriver"],
      },
      { title: "Turn the cam locks in the bottom", detail: "Four, arrow towards the edge, clockwise until tight.", fix: [fx(CAM.kind, both.flatMap((s) => [x0 + 60, x1 - 60].map((x): Vec3 => [x, cz, s < 0 ? z0 + 60 : z1 - 60])), UP, { ...CAM, on: id("B") })], kind: "cams", tools: ["screwdriver"] },
      { title: "Slide in the back panel", detail: "Down the grooves at the back of the sides.", add: [id("K")], kind: "join", tools: [] },
    ],
    [
      {
        title: "Fit the top",
        detail: "Four cam bolts into its underside first, then lay it on so they drop into the sides.",
        add: [id("T")],
        fix: [fx(CAMBOLT.kind, both.flatMap((s) => [x0 + 60, x1 - 60].map((x): Vec3 => [x, Hb - t, s < 0 ? z0 + 9 : z1 - 9])), UP, { ...CAMBOLT, on: id("T"), mate: id("SA") })],
        kind: "join",
        tools: [],
      },
      { title: "Turn the cam locks in the sides", detail: "Four, clockwise until each one pulls the top down tight.", fix: [fx(CAM.kind, both.flatMap((s) => at2(Hb - t - 25, s, [x0 + 60, x1 - 60]).map((v): Vec3 => [v[0], v[1], v[2]])), [0, 0, 1], { ...CAM, on: id("SA") })], kind: "cams", tools: ["screwdriver"] },
      {
        title: "Turn the box over and click in four castors",
        detail: "A stem into each socket, then the castor onto it until it clicks. The two with brakes go at the front.",
        fix: [
          fx("stud", castors.map(([x, z]): Vec3 => [x, cz, z]), UP, { len: 30, dia: 10, name: "Castor stem", on: id("B") }),
          fx(CASTOR.kind, castors.filter(([x]) => x < x1 - 60).map(([x, z]): Vec3 => [x, cz, z]), UP, { ...CASTOR, on: id("B") }),
          fx(LOCKC.kind, castors.filter(([x]) => x > x1 - 60).map(([x, z]): Vec3 => [x, cz, z]), UP, { ...LOCKC, on: id("B") }),
        ],
        pose: "-y",
        kind: "general",
        tools: [],
      },
    ],
    [
      {
        title: "Build the drawer box",
        detail: "Stand it up again. Dowels into the drawer sides, then the back between them, held with the four ribbed pins tapped in with a hammer.",
        add: [id("DS1"), id("DS2"), id("DK")],
        fix: [fx(DOWEL.kind, dz.flatMap((z) => [cz + 90, Hb - 110].map((y): Vec3 => [x1, y, z])), [-1, 0, 0], { ...DOWEL, on: id("DS1"), mate: id("DF") }), fx("nail", dz.flatMap((z) => [cz + 90, Hb - 110].map((y): Vec3 => [x0 + 37, y, z < zc ? z0 + 30 : z1 - 30])), [0, 0, 1], { len: 30, dia: 4, name: "Ribbed pin", on: id("DS1"), mate: id("DK") })],
        pose: "+y",
        kind: "join",
        tools: ["hammer"],
      },
      { title: "Slide the drawer bottom into its grooves", add: [id("DB")], kind: "join", tools: [] },
      {
        title: "Fit the drawer front",
        detail: "Four cam bolts into the back of the front, then press it onto the dowels and turn the four cam locks in the sides.",
        add: [id("DF")],
        fix: [fx(CAMBOLT.kind, dz.flatMap((z) => [cz + 60, Hb - 80].map((y): Vec3 => [x1, y, z])), [1, 0, 0], { ...CAMBOLT, on: id("DF"), mate: id("DS1") }), fx(CAM.kind, dz.flatMap((z) => [cz + 60, Hb - 80].map((y): Vec3 => [x1 - 40, y, z < zc ? z0 + 30 : z1 - 30])), [0, 0, 1], { ...CAM, on: id("DS1") })],
        kind: "cams",
        tools: ["screwdriver"],
      },
    ],
    [
      {
        title: "Screw the runners to the drawer",
        detail: "Turn the drawer upside down. One runner along the bottom of each side, three screws each.",
        fix: [fx("screw", [z0 + 30, z1 - 30].flatMap((z) => spread(x0 + 80, x1 - 80, 3).map((x): Vec3 => [x, cz + 45, z])), [0, 0, 0], { len: 12, dia: 4, on: id("DS1") })],
        kind: "runners",
        tools: ["screwdriver"],
      },
      {
        title: "Fit the stabiliser bar and the castor bracket",
        detail: "The bar goes across the back between the runners, two screws; the bracket under the middle of the front, two screws and one small one.",
        fix: [
          // the bar runs across under the drawer; a screw at each end goes up into a drawer side
          fx("stud", [[x0 + 50, cz + 34, z0 + 37]], [0, 0, 1], { len: D - 74, dia: 12, name: "Stabiliser bar", on: id("DB") }),
          fx("plate", [[x1 - 40, cz + 40, zc]], UP, { len: 60, dia: 40, name: "Castor bracket", on: id("DB") }),
          fx("screw", [[x0 + 74, cz + 36, z0 + 37], [x0 + 74, cz + 36, z1 - 37], [x1 - 40, cz + 40, zc - 25], [x1 - 40, cz + 40, zc + 25]], UP, { len: 10, dia: 5, on: id("DB") }),
          fx("screw", [[x1 - 10, cz + 40, zc]], UP, { len: 16, dia: 3.5, on: id("DB") }),
        ],
        kind: "screws",
        tools: ["screwdriver"],
      },
      { title: "Click the last castor into the bracket", fix: [fx(CASTOR.kind, [[x1 - 40, cz - 10, zc]], UP, { ...CASTOR, on: id("DB") })], kind: "general", tools: [] },
      { title: "Slide the drawer into the box", detail: "Turn it the right way up, set its runners on the box's runners and push it in.", kind: "drawer", tools: [] },
    ],
  ];
  return { parts, groups };
}

/** One step for a whole group of steps: the parts and fittings of a box built the same way as the first. */
function merged(title: string, detail: string, list: CustomStep[], from?: CustomStep["from"]): CustomStep {
  const tools = [...new Set(list.flatMap((s) => s.tools ?? []))];
  return { title, detail, add: list.flatMap((s) => s.add ?? []), fix: list.flatMap((s) => s.fix ?? []), kind: "join", tools, ...(from ? { from } : {}) };
}

function withBoxes(): CustomParams {
  const bed = bedFrame();
  // the boxes are built first, so you can see them before the bed goes up over where they stand
  const parts = [...bed.parts], steps: CustomStep[] = [];
  const x0 = bed.W / 2 - 620 + 10;
  const zs = [-640, 0, 640];
  const ords = ["second", "third"];
  zs.forEach((zc, i) => {
    const b = storageBox(i, zc, x0);
    parts.push(...b.parts);
    if (i === 0) {
      steps.push({ title: "Build the first storage box", detail: "Each box has its own bag of fittings. Work on a rug.", kind: "general", tools: [] });
      for (const g of b.groups) steps.push(...g);
    } else {
      const o = ords[i - 1];
      steps.push(
        merged(`Get the ${o} box's bottom ready the same way`, "Four castor sockets and twelve dowels.", b.groups[0]),
        merged(`Stand its sides on and slide in the back`, "Cam bolts, dowels and a runner on each side first, then the four cam locks.", b.groups[1]),
        merged(`Fit its top and castors`, "The top on its cam bolts, then turn the box over and click in the four castors.", b.groups[2]),
        // the sides come in from the back, along the dowels that join them to the front
        merged(`Build the ${o} box's drawer`, "The sides, back and bottom, then the front on its cam bolts.", b.groups[3], { [`X${i}DS1`]: [-300, 0, 0], [`X${i}DS2`]: [-300, 0, 0] }),
        merged(`Fit its runners, bar and castor, and slide it in`, "The same way as the first drawer.", b.groups[4]),
      );
    }
  });
  steps.push({ title: "Roll the boxes aside and build the bed", detail: "The bed has its own manual and fittings: keep the boxes' bags apart.", pose: "+y", kind: "general", tools: [] });
  steps.push(...bed.steps);
  steps.push({ title: "Roll the boxes under the bed", detail: "Fronts out. Lock the front castors where you want them to stay.", kind: "general", tools: [] });
  return { parts, steps };
}

/** The bed frame with the felt house slipped over its headboard. */
function withHouse(): CustomParams {
  const bed = bedFrame();
  const W = bed.W, zh = -bed.L / 2;
  const eave = 1130, ridge = 1500, zd = zh + 640;
  const a = Math.atan2(ridge - eave, W / 2 + 20), len = Math.hypot(ridge - eave, W / 2 + 20);
  const roof: CustomPart = {
    id: "HR",
    name: "Roof",
    size: [W + 60, ridge - eave + 20, zd - zh + 30],
    pos: [0, (eave + ridge) / 2, (zh - 20 + zd + 10) / 2],
    material: "soft",
    pieces: [-1, 1].map((s) => ({ shape: "box" as const, size: [len, 16, zd - zh + 30] as Vec3, pos: [(s * (W / 2 + 20)) / 2, 0, 0] as Vec3, rot: [0, 0, -s * a] as Vec3 })),
  };
  const parts = [
    ...bed.parts,
    box("HB", "House back", [-W / 2 - 10, W / 2 + 10, 430, eave, zh - 22, zh + 22], "soft"),
    box("HL", "House side", [-W / 2 - 10, -W / 2 + 6, 520, eave, zh + 22, zd], "soft"),
    box("HS", "House side", [W / 2 - 6, W / 2 + 10, 520, eave, zh + 22, zd], "soft"),
    roof,
  ];
  const steps: CustomStep[] = [
    ...bed.steps,
    { title: "Slip the house's back wall over the headboard", detail: "Open it out and lower it so the headboard goes into its pocket.", add: ["HB"], kind: "join", tools: [] },
    { title: "Fit the left wall", detail: "Fold out its corner flap and push it into the back wall's edge pocket.", add: ["HL"], kind: "join", tools: [] },
    { title: "Fit the right wall", detail: "The same way, flap the right way round.", add: ["HS"], kind: "join", tools: [] },
    { title: "Lower the roof on", detail: "Push its four tabs into the slots at the tops of the walls. Never let a child climb on or hang from it.", add: ["HR"], kind: "join", warnings: ["tip"], tools: [] },
  ];
  return { parts, steps };
}

/* ---------- the bed with storage (shelves at the head, four drawers) ---------- */

function storageBed(twin: boolean, padTop: number): CustomParams {
  const W = twin ? 1030 : 960, L = twin ? 1960 : 2060, t = 18, zi = L / 2 - t;
  const ex = 710; // headboard and footboard panels
  const uy = 300, sy0 = 410, sy1 = 440, ry0 = 300, ry1 = 470;
  const xb = -W / 2 + t, xf = W / 2 - t; // inside the side rails
  const zs = -zi + 380; // the shelf unit's divider
  const zm = (zs + t + zi) / 2; // the divider between the two drawer columns
  const dx0 = xf - 600; // back of the drawer bays
  const parts: CustomPart[] = [
    box("SBt", "Shelf unit bottom", [dx0, xf, 25, 43, -zi, zs]),
    box("SBk", "Shelf unit back", [dx0 - t, dx0, 25, uy - 25, -zi, zs]),
    box("D0", "Divider", [dx0 - t, W / 2, 25, ry0, zs, zs + t]), // the front side rail sits on the dividers
    box("U1", "Bottom rail", [xf - 80, xf, 0, 25, -zi, zi]),
    box("D1", "Divider", [dx0 - t, W / 2, 25, ry0, zm - t / 2, zm + t / 2]),
    box("U4", "Middle rail", [dx0 - t - 60, dx0 - t, uy - 80, uy - 50, zs + t, zi]),
    box("U2", "Bottom rail", [xb, xb + 80, 0, 25, -zi, zi]),
    box("U3", "Top rail", [xb, xb + 80, uy - 25, uy, -zi, zi]),
    box("S1", "Shelf", [dx0, xf, 150, 168, -zi, zs]),
    box("H", "Headboard", [-W / 2, W / 2, 0, ex, -L / 2, -zi]),
    box("RB", "Side rail", [-W / 2, xb, ry0, ry1, -zi, zi]),
    box("RF", "Side rail", [xf, W / 2, ry0, ry1, -zi, zi]),
    box("SL", "Slat rail", [xb, xb + 25, sy0, sy1, -zi + 15, zi - 15], "metal"),
    box("SR", "Slat rail", [xf - 25, xf, sy0, sy1, -zi + 15, zi - 15], "metal"),
    box("F", "Footboard", [-W / 2, W / 2, 0, ex, zi, L / 2]),
    compound("SB", "Slatted bed base", spread(-zi + 40, zi - 40, 17).map((z) => pc([xb + 6, xf - 6, sy1, sy1 + 15, z - 30, z + 30])), "wood"),
    box("PH", "Padded headboard", [-W / 2 + 30, W / 2 - 30, ry1 + 10, padTop, -zi, -zi + 50], "soft"),
  ];
  // four drawers, two columns of two, fronts flush with the side rail
  const cols = [[zs + t, zm - t / 2], [zm + t / 2, zi]];
  const rows = [[25, 158], [162, ry0 - 4]];
  const drawers: string[] = [];
  cols.forEach(([z0, z1], c) =>
    rows.forEach(([y0, y1], r) => {
      const id = `DR${c}${r}`;
      drawers.push(id);
      parts.push(
        compound(id, "Drawer", [
          pc([xf, W / 2, y0 + 2, y1 - 2, z0 + 3, z1 - 3]),
          pc([dx0 + 10, xf, y0 + 20, y1 - 25, z0 + 15, z0 + 30]),
          pc([dx0 + 10, xf, y0 + 20, y1 - 25, z1 - 30, z1 - 15]),
          pc([dx0 + 10, dx0 + 25, y0 + 20, y1 - 25, z0 + 30, z1 - 30]),
          pc([dx0 + 25, xf, y0 + 20, y0 + 23, z0 + 30, z1 - 30]),
        ], "board"),
      );
    }),
  );
  const both = [-1, 1] as const;
  const mid = (a: number, b: number) => (a + b) / 2;
  const dpts = (zc: number) => [dx0 + 80, xf - 80].map((x): Vec3 => [x, 25, zc]); // where a divider meets a rail below it
  const endPts = (z: number, ys = [80, 220]) => ys.map((y): Vec3 => [mid(dx0, xf), y, z]);
  const runnersAt = cols.flatMap(([z0, z1]) => rows.flatMap(([y0]) => [z0, z1].map((z): Vec3 => [mid(dx0, xf), y0 + 30, z])));
  // three screws through each runner into the wall of the bay it lines: a divider, or the footboard at the far end
  const bayScrews = cols.flatMap(([z0, z1]) => ([[z0, -1], [z1, 1]] as const).map(([z, g]) =>
    fx("screw", rows.flatMap(([y0]) => [-200, 30, 200].map((dxs): Vec3 => [mid(dx0, xf) + dxs, y0 + 30, z - g * 2])), [0, 0, g], { len: 12, dia: 4, on: z === zi ? "F" : Math.abs(z - zm) < t ? "D1" : "D0" })));
  const sideBolts = (end: string, e: number): CustomFix[] => [
    ...(["RB", "RF"] as const).map((id, i) => fx(BARREL.kind, [375, 405].map((y): Vec3 => [i ? xf : xb, y, e * (zi - 50)]), [i ? 1 : -1, 0, 0], { ...BARREL, on: id })),
    ...(["RB", "RF"] as const).map((id, i) => fx(BOLT.kind, [375, 405].map((y): Vec3 => [i ? xf + t / 2 : xb - t / 2, y, e * (L / 2)]), [0, 0, -e], { ...BOLT, on: end, mate: id })),
  ];
  const drawerPts = (f: (zc: number, y0: number, y1: number, z0: number, z1: number) => Vec3[]) => cols.flatMap(([z0, z1]) => rows.flatMap(([y0, y1]) => f(mid(z0, z1), y0, y1, z0, z1)));
  const steps: CustomStep[] = [
    { title: "Screw two cam bolts into the shelf unit's bottom", detail: "Lay its panels on a rug. Pick which end the headboard and the drawers go: the unit can be built either way round.", fix: [fx(CAMBOLT.kind, [dx0 + 60, xf - 60].map((x): Vec3 => [x, 43, zs - 9]), DOWN, { ...CAMBOLT, on: "SBt", mate: "D0" })], warnings: ["floor"], kind: "cams", tools: [] },
    { title: "Push the back panel onto it", detail: "On two dowels along the bottom's back edge.", add: ["SBk"], fix: [fx(DOWEL.kind, [-zi + 100, zs - 100].map((z): Vec3 => [dx0 - 9, 25, z]), UP, { ...DOWEL, on: "SBk", mate: "SBt" })], kind: "dowels", tools: [] },
    { title: "Lock it with two cam locks", fix: [fx(CAM.kind, [-zi + 100, zs - 100].map((z): Vec3 => [dx0 - 9, 70, z]), [1, 0, 0], { ...CAM, on: "SBk" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Fit the divider", detail: "Two cam bolts and two dowels in its edges, then stand it on the bottom's cam bolts.", add: ["D0"], fix: [fx(CAMBOLT.kind, [80, 220].map((y): Vec3 => [dx0 - 9, y, zs + 9]), [0, 0, -1], { ...CAMBOLT, on: "D0", mate: "SBk" }), fx(DOWEL.kind, [dx0 + 100, xf - 100].map((x): Vec3 => [x, 43, zs + 9]), DOWN, { ...DOWEL, on: "D0", mate: "SBt" })], kind: "join", tools: [] },
    { title: "Turn the divider's cam locks", fix: [fx(CAM.kind, [dx0 + 60, xf - 60].map((x): Vec3 => [x, 90, zs + t]), [0, 0, -1], { ...CAM, on: "D0" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Stand the shelf unit on the front bottom rail", detail: "Four cam bolts into the top of the rail first: two under the shelf unit, two under the middle divider.", add: ["U1"], fix: [fx(CAMBOLT.kind, [...[zs + 9, zs - 200], ...[zm - 50, zm + 50]].map((z): Vec3 => [xf - 40, 25, z]), DOWN, { ...CAMBOLT, on: "U1", mate: "D0" })], kind: "join", tools: [] },
    { title: "Stand the middle divider on the rail and lock both", detail: "Turn a cam lock at the foot of each divider.", add: ["D1"], fix: [fx(CAM.kind, [[xf - 40, 60, zs + 9], [xf - 40, 60, zm]], [1, 0, 0], { ...CAM, on: "D1" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Fit the middle rail across the back of the bays", detail: "Its cam bolts into the dividers, then two cam locks.", add: ["U4"], fix: [fx(CAM.kind, [[dx0 - 9, uy - 65, zs + 9], [dx0 - 9, uy - 65, zm]], [-1, 0, 0], { ...CAM, on: "D1" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Fit the back bottom rail", detail: "Two cam bolts into it, then lay it under the back of the unit and turn two cam locks.", add: ["U2"], fix: [fx(CAMBOLT.kind, [[xb + 40, 25, zs + 9], [xb + 40, 25, zm]], DOWN, { ...CAMBOLT, on: "U2", mate: "D0" }), fx(CAM.kind, [[dx0 - 9, 50, zs - 30], [dx0 - 9, 50, zm + 30]], [-1, 0, 0], { ...CAM, on: "D0" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Fit the back top rail", detail: "The same way along the top at the back.", add: ["U3"], fix: [fx(CAMBOLT.kind, [[xb + 40, uy - 25, zs + 9], [xb + 40, uy - 25, zm]], UP, { ...CAMBOLT, on: "U3", mate: "D0" }), fx(CAM.kind, [[dx0 - 9, uy - 40, zs - 30], [dx0 - 9, uy - 40, zm + 30]], [-1, 0, 0], { ...CAM, on: "D0" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Slide in the shelf and screw it down", detail: "On its dowel, then four long screws through the back panel and the divider with the Allen key.", add: ["S1"], fix: [fx(DOWEL.kind, [[xf - 100, 159, zs]], [0, 0, -1], { ...DOWEL, on: "S1", mate: "D0" }), fx("screw", [[dx0 - t, 159, -zi + 120], [dx0 - t, 159, zs - 120], [dx0 + 120, 159, zs + t], [xf - 120, 159, zs + t]], [1, 0, 0], { len: 50, dia: 5, on: "S1" })], kind: "screws", tools: ["allen"] },
    { title: "Tap seven dowels into the head end of the unit", detail: "Into the end edges of the rails and the shelf unit, ready for the headboard.", fix: [fx(DOWEL.kind, [[xf - 40, 12, -zi], [xb + 40, 12, -zi], [xb + 40, uy - 12, -zi], [dx0 + 80, 34, -zi], [xf - 80, 34, -zi], [dx0 + 80, 159, -zi], [xf - 80, 159, -zi]], [0, 0, 1], { ...DOWEL, on: "SBt", mate: "H" })], kind: "dowels", tools: [] },
    { title: "Stand the headboard against the unit", detail: "Five cam bolts into its inner face first, on a rug. Then lift it onto the dowels.", add: ["H"], fix: [fx(CAMBOLT.kind, [[xf - 40, 12, -zi], [xb + 40, 12, -zi], [xb + 40, uy - 12, -zi], [dx0 + 80, 34, -zi], [xf - 80, 159, -zi]], [0, 0, -1], { ...CAMBOLT, on: "H", mate: "U1" })], kind: "join", tools: [] },
    { title: "Turn the two cam locks at the headboard", fix: [fx(CAM.kind, [[xf - 40, 25, -zi + 40], [xb + 40, 25, -zi + 40]], DOWN, { ...CAM, on: "U1" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Fit the leg caps and glides", detail: "Two caps under the headboard, pushed in by hand; four glides tapped into the bottom rails.", fix: [fx(CAP.kind, both.map((s): Vec3 => [s * (W / 2 - 80), 0, -L / 2 + t / 2]), UP, { ...CAP, on: "H" }), fx(GLIDE.kind, [[xf - 40, 0, -zi + 100], [xf - 40, 0, zi - 100], [xb + 40, 0, -zi + 100], [xb + 40, 0, zi - 100]], UP, { ...GLIDE })], kind: "nails", tools: ["hammer"] },
    {
      title: "Screw the slat rails along the side rails",
      detail: "Sixteen screws in the numbered order, by hand. Then two dowels into each end of both side rails.",
      add: ["RB", "RF", "SL", "SR"],
      fix: [
        ...(["SL", "SR"] as const).map((id, i) => fx(RAIL_SCREW.kind, spread(-zi + 120, zi - 120, 8).map((z): Vec3 => [i ? xf - 25 : xb + 25, (sy0 + sy1) / 2, z]), [i ? 1 : -1, 0, 0], { ...RAIL_SCREW, on: id, mate: i ? "RF" : "RB" })),
        ...(["RB", "RF"] as const).flatMap((id, i) => both.map((e) => fx(BIG_DOWEL.kind, [340, 440].map((y): Vec3 => [i ? xf + t / 2 : xb - t / 2, y, e * zi]), [0, 0, -e], { ...BIG_DOWEL, on: id, mate: e < 0 ? "H" : "F" }))),
      ],
      kind: "screws",
      tools: ["screwdriver"],
    },
    { title: "Screw the connecting pins into the top rail", detail: "Four pins along the back top rail, and four cam locks in the back side rail above them.", fix: [fx("stud", spread(-zi + 300, zi - 300, 4).map((z): Vec3 => [xb + 40, uy, z]), DOWN, { len: 60, dia: 8, name: "Connecting pin", on: "U3", mate: "RB" }), fx(CAM.kind, spread(-zi + 300, zi - 300, 4).map((z): Vec3 => [xb, uy + 30, z]), [1, 0, 0], { ...CAM, on: "RB" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Lock the back side rail onto the pins", detail: "Lower it on, then turn the four cam locks. Four more cam locks go in the front side rail.", fix: [fx(CAM.kind, spread(-zi + 300, zi - 300, 4).map((z): Vec3 => [xf, uy + 30, z]), [-1, 0, 0], { ...CAM, on: "RF" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Tap dowels into the front side rail", detail: "Into its bottom edge, where it sits on the dividers.", fix: [fx(DOWEL.kind, [[xf + 9, ry0, zs + 9]], UP, { ...DOWEL, on: "RF", mate: "D0" }), fx(DOWEL.kind, [[xf + 9, ry0, zm]], UP, { ...DOWEL, on: "RF", mate: "D1" })], kind: "dowels", tools: [] },
    { title: "Fit the front side rail", detail: "Lay it on the dividers' dowels, turn one cam lock and tap in two more dowels.", fix: [fx(CAM.kind, [[xf - 40, uy - 40, zs - 30]], [1, 0, 0], { ...CAM, on: "D0" }), fx(DOWEL.kind, [[xf + 9, ry1, -zi + 60], [xf + 9, ry1, zi - 60]], DOWN, { ...DOWEL, on: "RF" })], kind: "dowels", tools: ["screwdriver"] },
    { title: "Bolt the side rails to the headboard", detail: "A barrel nut in each hole inside the rails, slot facing the bolt, then the long bolts through the headboard with the hex key.", fix: sideBolts("H", -1), kind: "bolts", tools: ["allen", "flathead"] },
    { title: "Turn the last cam locks along the rails", detail: "Two at the middle divider, then two dowels into the rails' foot ends.", fix: [fx(CAM.kind, [[xf - 40, 25, zm - 60], [xb + 40, uy - 25, zm + 60]], [0, 0, 0], { ...CAM, on: "D1" }), fx(DOWEL.kind, [[xf - 40, 12, zi], [xb + 40, 12, zi]], [0, 0, -1], { ...DOWEL, on: "U1", mate: "F" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Stand the footboard against the foot end", detail: "Three cam bolts into its inner face and two caps under it first, on a rug. Two glides go under the rails' foot ends.", add: ["F"], fix: [fx(CAMBOLT.kind, [[xf - 40, 12, zi], [xb + 40, 12, zi], [xb + 40, uy - 12, zi]], [0, 0, 1], { ...CAMBOLT, on: "F", mate: "U1" }), fx(CAP.kind, both.map((s): Vec3 => [s * (W / 2 - 80), 0, L / 2 - t / 2]), UP, { ...CAP, on: "F" }), fx(GLIDE.kind, [[xf - 40, 0, 0], [xb + 40, 0, 0]], UP, { ...GLIDE })], kind: "join", tools: ["hammer"] },
    { title: "Turn the three cam locks at the footboard", fix: [fx(CAM.kind, [[xf - 40, 25, zi - 40], [xb + 40, 25, zi - 40], [xb + 40, uy - 25, zi - 40]], [0, 0, 0], { ...CAM, on: "U1" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Bolt the side rails to the footboard", detail: "Barrel nuts in the rails, long bolts through the footboard.", fix: sideBolts("F", 1), kind: "bolts", tools: ["allen", "flathead"] },
    { title: "Screw the drawer runners into the bays", detail: "Eight runners, one each side of every drawer, three screws each. Left and right ones are marked.", fix: [fx("runner", runnersAt, [0, 0, 1], { len: 520, dia: 30, name: "Drawer runner", on: "D1", twist: Math.PI / 2 }), ...bayScrews], kind: "runners", tools: ["screwdriver"] },
    {
      title: "Build the four drawers and slide them in",
      detail: "Each one: dowels and ribbed pins join the sides and back, the bottom slides in, the front goes on four cam bolts with four cam locks, then its runners (six screws) and the stabiliser bar (two screws). Push it in on the runners.",
      add: drawers,
      fix: [
        fx(DOWEL.kind, drawerPts((zc, y0, y1, z0, z1) => [z0 + 22, z1 - 22].flatMap((z) => [y0 + 40, y1 - 40].map((y): Vec3 => [dx0 + 17, y, z]))), [-1, 0, 0], { ...DOWEL, len: 30, dia: 8 }),
        fx("nail", drawerPts((zc, y0, y1, z0, z1) => [z0 + 22, z1 - 22].flatMap((z) => [y0 + 60, y1 - 50].map((y): Vec3 => [dx0 + 30, y, z]))), [0, 0, 1], { len: 30, dia: 4, name: "Ribbed pin" }),
        fx(CAMBOLT.kind, drawerPts((zc, y0, y1, z0, z1) => [z0 + 22, z1 - 22].flatMap((z) => [y0 + 40, y1 - 40].map((y): Vec3 => [xf, y, z]))), [1, 0, 0], { ...CAMBOLT }),
        fx(CAM.kind, drawerPts((zc, y0, y1, z0, z1) => [z0 + 22, z1 - 22].flatMap((z) => [y0 + 40, y1 - 40].map((y): Vec3 => [xf - 40, y, z]))), [0, 0, 1], { kind: "cam", len: 13, dia: 15 }),
        // the drawer's runners and its stabiliser bar screw up into the bottom edges of its sides
        fx("screw", drawerPts((zc, y0, y1, z0, z1) => [z0 + 22, z1 - 22].flatMap((z) => [-1, 0, 1].map((k): Vec3 => [mid(dx0, xf) + k * 180, y0 + 16, z]))), UP, { len: 12, dia: 4 }),
        fx("stud", drawerPts((zc, y0, y1, z0) => [[dx0 + 40, y0 + 14, z0 + 22]]), [0, 0, 1], { len: cols[0][1] - cols[0][0] - 50, dia: 12, name: "Stabiliser bar" }),
        fx("screw", drawerPts((zc, y0, y1, z0, z1) => [[dx0 + 64, y0 + 16, z0 + 22], [dx0 + 64, y0 + 16, z1 - 22]]), UP, { len: 10, dia: 5 }),
      ],
      from: Object.fromEntries(drawers.map((d) => [d, [700, 0, 0] as Vec3])),
      kind: "drawer",
      tools: ["screwdriver", "hammer"],
    },
    { title: "Screw the slat stops onto the corners", detail: "One on each slat rail at both ends.", fix: [fx(STOP.kind, [xb + 12, xf - 12].flatMap((x) => both.map((e): Vec3 => [x, sy1, e * (zi - 30)])), DOWN, { ...STOP }), fx(SMALL_SCREW.kind, [xb + 12, xf - 12].flatMap((x) => both.map((e): Vec3 => [x, sy1, e * (zi - 60)])), DOWN, { ...SMALL_SCREW })], kind: "screws", tools: ["screwdriver"] },
    { title: "Roll out the slatted base", detail: "Curved side up, over the slat rails.", add: ["SB"], kind: "slats", tools: [] },
    { title: "Tuck the end slats under the stops", detail: "At all four corners: push the slat down and slide it under the stop.", kind: "slats", tools: [] },
    {
      title: "Screw the headboard brackets on",
      detail: "Two brackets on the inside of the bed's headboard, near its top corners, three screws each with the Allen key. Press a felt strip onto each foot of the padded headboard.",
      fix: [fx("plate", both.map((s): Vec3 => [s * (W / 2 - 150), ex - 120, -zi]), [0, 0, -1], { len: 120, dia: 40, name: "Headboard bracket", on: "H" }), fx("bolt", both.flatMap((s) => [ex - 160, ex - 120, ex - 80].map((y): Vec3 => [s * (W / 2 - 150), y, -zi])), [0, 0, -1], { len: 20, dia: 6, on: "H" })],
      kind: "screws",
      tools: ["allen"],
    },
    { title: "Hang the padded headboard on the brackets", detail: "Lower its plates onto the brackets, then tighten the two bolts on each side.", add: ["PH"], fix: [fx("glide", both.flatMap((s) => [-1, 1].map((k): Vec3 => [s * (W / 2 - 150) + k * 40, ry1 + 10, -zi + 25])), UP, { len: 3, dia: 30, name: "Felt strip", on: "PH" })], kind: "join", tools: ["allen"] },
    { title: "Pull the cover over the padded headboard", detail: "Quilted side to the bed, then fasten its strips along the bottom edge.", kind: "general", tools: [] },
  ];
  return { parts, steps };
}

/* ---------- the underbed with storage (x along its length, front at +z) ---------- */

/**
 * The underbed, from its own manual: a long middle rail screwed onto the middle divider, the two ends on its ends,
 * dowels in the back edges and the back panel screwed on lying front down; then turned onto its back, the cam locks,
 * angle brackets, dowels and the top front rail on cam bolts, a bolt through each end, the bottom front rail and six
 * castors. Stood up: corner braces, the runners, the metal slat rail, the catches that hook it to the bed, two
 * cam-locked drawers on runners, the two support bars, the slatted base and its four stops.
 */
function underbed(s: ProductSpec): CustomParams {
  const L = Math.round(s.size.w * 10) || 2010, D = Math.round(s.size.d * 10) || 950, H = Math.round(s.size.h * 10) || 380;
  const t = 18, y0 = 50; // castors under the boards
  const xi = L / 2 - t; // inside of the ends
  const zbi = -D / 2 + t; // inside of the back
  const zf = D / 2 - t; // back of the top front rail
  const yC0 = 320, yC1 = 350; // the middle rail, on the divider
  const yTF = 300; // the top front rail's lower edge
  const dz0 = -150, dz1 = zf; // the drawers' boxes, front to back
  const bayW = xi - t / 2;
  const both = [-1, 1] as const;
  const bay = (g: number) => g * (t / 2 + bayW / 2);
  const drawer = (g: number): CustomPart => {
    const c = bay(g), sx = bayW / 2 - 26;
    return compound(g < 0 ? "DR1" : "DR2", "Drawer", [
      pc([c - bayW / 2 + 2, c + bayW / 2 - 2, y0 + 6, yTF - 4, zf, D / 2]),
      pc([c - sx - 12, c - sx, 95, 290, dz0 + 12, dz1]),
      pc([c + sx, c + sx + 12, 95, 290, dz0 + 12, dz1]),
      pc([c - sx - 12, c + sx + 12, 95, 290, dz0, dz0 + 12]),
      pc([c - sx, c, 95, 100, dz0 + 12, dz1]),
      pc([c, c + sx, 95, 100, dz0 + 12, dz1]),
    ], "board");
  };
  const parts: CustomPart[] = [
    box("MR", "Middle rail", [-xi, xi, yC0, yC1, -30, 30]),
    box("MD", "Middle divider", [-t / 2, t / 2, y0, yC0, zbi, zf - 40]),
    box("E1", "End panel", [-L / 2, -xi, y0, H, -D / 2, zf]),
    box("E2", "End panel", [xi, L / 2, y0, H, -D / 2, zf]),
    box("BK", "Back panel", [-xi, xi, y0, H, -D / 2, zbi]),
    box("TF", "Top front rail", [-L / 2, L / 2, yTF, H, zf, D / 2]),
    box("BF", "Bottom front rail", [-xi, xi, y0, y0 + 35, zf - 40, zf]),
    box("SR", "Slat rail", [-xi + 20, xi - 20, yC1, yC1 + 8, -20, 20], "metal"),
    ...both.map((g, i): CustomPart => compound(`BAR${i + 1}`, "Support bar", [pc([g * 500 - 15, g * 500 + 15, yC1 + 8, yC1 + 16, zbi, zf]), pc([g * 500 - 15, g * 500 + 15, yC1 - 30, yC1 + 8, zbi, zbi + 4])], "metal")),
    drawer(-1),
    drawer(1),
    compound("SB", "Slatted bed base", spread(-xi + 40, xi - 40, 19).map((x) => pc([x - 30, x + 30, yC1 + 16, yC1 + 30, zbi + 6, zf - 6])), "wood"),
  ];
  const ends = ["E1", "E2"];
  const drawers = ["DR1", "DR2"];
  const yM = (yC0 + yC1) / 2;
  // runners: on the ends and both faces of the divider, screwed through into them
  const faces = [[-xi, -1, "E1"], [-t / 2, 1, "MD"], [t / 2, -1, "MD"], [xi, 1, "E2"]] as const;
  const zr = (dz0 + dz1) / 2;
  const castorAt: [number, number, string][] = [[-xi + 30, -1, "E1"], [t / 2 + 30, -1, "MD"], [xi - 30, 1, "E2"]];
  const steps: CustomStep[] = [
    {
      title: "Screw the middle rail onto the divider",
      detail: "Lay the rail on the divider's top edge, with its rows of holes facing up, and turn in two connector screws with the Allen key.",
      add: ["MD", "MR"],
      fix: [fx("screw", [-200, 200].map((z): Vec3 => [0, yC1, z * 0.1]), DOWN, { len: 50, dia: 7, name: "Connector screw", on: "MR", mate: "MD" })],
      pose: "-z",
      tools: ["allen"],
      kind: "screws",
    },
    {
      title: "Fit a cam bolt and a dowel in each end panel",
      detail: "Lay the end panels on a rug. Into the holes inside each, level with the middle rail.",
      fix: ends.flatMap((id, i) => {
        const x = i ? xi : -xi, d: Vec3 = [i ? -1 : 1, 0, 0];
        return [fx(CAMBOLT.kind, [[x, yM, -15]], d, { ...CAMBOLT, on: id, mate: "MR" }), fx(DOWEL.kind, [[x, yM, 15]], d, { ...DOWEL, on: id, mate: "MR" })];
      }),
      wait: ends,
      warnings: ["floor"],
      kind: "dowels",
    },
    { title: "Push the end panels onto the rail", detail: "One on each end of the middle rail, the cam bolt and dowel into its holes.", add: ends, from: { E1: [-250, 0, 0], E2: [250, 0, 0] }, kind: "join" },
    {
      title: "Tap three dowels into the back edges",
      detail: "One into the back edge of each end panel and the divider.",
      fix: [fx(DOWEL.kind, [[-L / 2 + 9, 200, -D / 2], [0, 200, zbi], [L / 2 - 9, 200, -D / 2]], [0, 0, 1], { ...DOWEL })],
      tools: ["hammer"],
      kind: "dowels",
    },
    {
      title: "Screw the back panel on",
      detail: "Lay it over the back edges, onto the dowels. Six long screws, two into each panel, with the Allen key. Then turn the frame onto its back.",
      add: ["BK"],
      fix: [fx("screw", [-L / 2 + 9, 0, L / 2 - 9].flatMap((x) => [110, 280].map((y): Vec3 => [x, y, -D / 2])), [0, 0, 1], { len: 100, dia: 7, name: "Long screw", on: "BK" })],
      from: { BK: [0, 0, -260] },
      tools: ["allen"],
      kind: "screws",
    },
    {
      title: "Lock the end panels to the middle rail",
      detail: "Turn the two cam locks in the rail's ends.",
      fix: [fx(CAM.kind, both.map((g): Vec3 => [g * (xi - 30), yC1, -15]), DOWN, { ...CAM, on: "MR" })],
      pose: "+z",
      tools: ["screwdriver"],
      kind: "cams",
    },
    {
      title: "Screw in the two angle brackets",
      detail: "One in each back corner, four screws each: two into the end panel and two into the back.",
      fix: [
        fx("angle", both.map((g): Vec3 => [g * (xi - 2), 200, zbi + 2]), [0, 0, -1], { len: 40, dia: 40, name: "Angle bracket", on: "BK" }),
        ...both.map((g, i) => fx("screw", [180, 220].map((y): Vec3 => [g * (xi - 3), y, zbi + 28]), [g, 0, 0], { len: 16, dia: 4, on: ends[i] })),
        fx("screw", both.flatMap((g) => [180, 220].map((y): Vec3 => [g * (xi - 28), y, zbi - 3])), [0, 0, -1], { len: 16, dia: 4, on: "BK" }),
      ],
      tools: ["screwdriver"],
      kind: "screws",
    },
    {
      title: "Tap six dowels into the front edges",
      detail: "Three along the top of each end panel's front edge, ready for the top front rail.",
      fix: [fx(BIG_DOWEL.kind, both.flatMap((g) => [yTF + 15, yTF + 40, H - 15].map((y): Vec3 => [g * (L / 2 - 9), y, zf])), [0, 0, -1], { ...BIG_DOWEL, len: 30, dia: 10 })],
      tools: ["hammer"],
      kind: "dowels",
    },
    {
      title: "Screw four cam bolts into the top front rail",
      detail: "Into its back face, two near each end.",
      fix: both.map((g, i) => fx(CAMBOLT.kind, [yTF + 28, H - 28].map((y): Vec3 => [g * (L / 2 - 9), y, zf]), [0, 0, 1], { ...CAMBOLT, on: "TF", mate: ends[i] })),
      wait: ["TF"],
      kind: "cams",
    },
    {
      title: "Lay the top front rail on and lock it",
      detail: "Onto the dowels and cam bolts, then turn the four cam locks inside the end panels.",
      add: ["TF"],
      from: { TF: [0, 0, 220] },
      fix: ends.map((id, i) => fx(CAM.kind, [yTF + 28, H - 28].map((y): Vec3 => [i ? xi : -xi, y, zf - 30]), [i ? 1 : -1, 0, 0], { ...CAM, on: id })),
      tools: ["screwdriver"],
      kind: "cams",
    },
    {
      title: "Bolt the ends to the middle rail",
      detail: "One bolt through each end panel into the end of the rail, with the Allen key.",
      fix: ends.map((id, i) => fx("bolt", [[i ? L / 2 : -L / 2, yM, 0]], [i ? -1 : 1, 0, 0], { len: 60, dia: 6, on: id, mate: "MR" })),
      tools: ["allen"],
      kind: "bolts",
    },
    {
      title: "Fit the bottom front rail",
      detail: "Slide it in between the end panels, then three connector screws: one through each end and one into the divider.",
      add: ["BF"],
      from: { BF: [0, 0, 200] },
      fix: [
        ...ends.map((id, i) => fx("screw", [[i ? L / 2 : -L / 2, y0 + 17, zf - 20]], [i ? -1 : 1, 0, 0], { len: 50, dia: 7, name: "Connector screw", on: id, mate: "BF" })),
        fx("screw", [[0, y0 + 17, zf]], [0, 0, -1], { len: 50, dia: 7, name: "Connector screw", on: "BF", mate: "MD" }),
      ],
      tools: ["allen"],
      kind: "screws",
    },
    {
      title: "Screw on the six castors",
      detail: "Two on each end panel and two on the divider, at the front and the back, two screws each.",
      fix: [
        fx("castor", castorAt.flatMap(([x]) => both.map((sz): Vec3 => [x, y0, sz * (D / 2 - 110)])), UP, { len: y0, dia: 45 }),
        ...castorAt.map(([x, g, id]) => fx("screw", both.flatMap((sz) => [-20, 20].map((dz): Vec3 => [x - g * 28 + g * 4, y0 + 20, sz * (D / 2 - 110) + dz])), [g, 0, 0], { len: 16, dia: 5, on: id })),
      ],
      tools: ["screwdriver"],
      kind: "screws",
    },
    {
      title: "Stand it up and screw in the corner braces",
      detail: "One across each back corner at the top, four screws each.",
      fix: [
        fx("angle", both.map((g): Vec3 => [g * (xi - 40), yC1 - 10, zbi + 40]), DOWN, { len: 8, dia: 90, name: "Corner brace" }),
        ...both.map((g, i) => fx("screw", [zbi + 50, zbi + 90].map((z): Vec3 => [g * (xi - 3), yC1 - 15, z]), [g, 0, 0], { len: 16, dia: 4, on: ends[i] })),
        fx("screw", both.flatMap((g) => [g * (xi - 50), g * (xi - 90)].map((x): Vec3 => [x, yC1 - 15, zbi + 3])), [0, 0, -1], { len: 16, dia: 4, on: "BK" }),
      ],
      pose: "+y",
      tools: ["screwdriver"],
      kind: "screws",
    },
    {
      title: "Screw in the drawer runners",
      detail: "One on each side of both drawer spaces, three screws each. The left and right ones are marked.",
      fix: [
        ...faces.map(([x, g, id]) => fx("runner", [[x, 110, zr]], [g, 0, 0], { len: dz1 - dz0 - 20, dia: 20, name: "Drawer runner", on: id })),
        ...faces.map(([x, g, id]) => fx("screw", [-200, 0, 200].map((dz): Vec3 => [x - g * 4, 110, zr + dz]), [g, 0, 0], { len: 12, dia: 4, on: id })),
      ],
      tools: ["screwdriver"],
      kind: "runners",
    },
    {
      title: "Screw the slat rail along the middle rail",
      detail: "Eight screws, by hand only so the rail stays straight.",
      add: ["SR"],
      fix: [fx("screw", spread(-xi + 80, xi - 80, 8).map((x): Vec3 => [x, yC1 + 8, 0]), DOWN, { len: 16, dia: 4, on: "SR", mate: "MR" })],
      tools: ["screwdriver"],
      kind: "screws",
    },
    {
      title: "Fit the two catches on the back",
      detail: "Press a catch plate into each hole near the top of the back panel and clip its cover over it.",
      fix: [
        fx("plate", both.map((g): Vec3 => [g * (xi - 200), H - 50, -D / 2]), [0, 0, 1], { len: 6, dia: 50, name: "Catch plate", on: "BK" }),
        fx("cap", both.map((g): Vec3 => [g * (xi - 200), H - 50, -D / 2 - 6]), [0, 0, 1], { len: 6, dia: 60, name: "Catch cover", on: "BK" }),
      ],
      kind: "general",
    },
    {
      title: "Fit the cam bolts in the drawer fronts",
      detail: "Lay both fronts face down on a rug. Four cam bolts in each, two at each end.",
      fix: drawers.map((id, i) => fx(CAMBOLT.kind, both.flatMap((sx) => [130, 250].map((y): Vec3 => [bay(i ? 1 : -1) + sx * (bayW / 2 - 20), y, zf])), [0, 0, 1], { ...CAMBOLT, on: id })),
      wait: drawers,
      pose: "+y",
      warnings: ["floor"],
      kind: "cams",
    },
    {
      title: "Join the sides and back, then lock the front on",
      detail: "Two dowels join the back to the sides. Stand the sides on the front's cam bolts and turn four cam locks.",
      fix: [
        ...drawers.map((id, i) => fx(DOWEL.kind, both.map((sx): Vec3 => [bay(i ? 1 : -1) + sx * (bayW / 2 - 20), 190, dz0 + 12]), [0, 0, -1], { ...DOWEL, on: id })),
        ...drawers.flatMap((id, i) => both.map((sx) => fx(CAM.kind, [130, 250].map((y): Vec3 => [bay(i ? 1 : -1) + sx * (bayW / 2 - 20), y, zf - 30]), [-sx, 0, 0], { ...CAM, on: id }))),
      ],
      tools: ["screwdriver"],
      kind: "cams",
    },
    {
      title: "Screw the back to the sides",
      detail: "Four long screws in each drawer, two through each end of the back.",
      fix: drawers.map((id, i) => fx("screw", both.flatMap((sx) => [140, 240].map((y): Vec3 => [bay(i ? 1 : -1) + sx * (bayW / 2 - 20), y, dz0])), [0, 0, 1], { len: 40, dia: 5, on: id })),
      tools: ["screwdriver"],
      kind: "screws",
    },
    { title: "Slide in the drawer bottoms", detail: "Two halves in each drawer, along the grooves from the back, until they meet in the middle.", kind: "drawer" },
    {
      title: "Screw the runners onto the drawers",
      detail: "Three screws on each side. The parts are marked left and right.",
      fix: drawers.flatMap((id, i) => both.map((sx) => fx("screw", [-200, 0, 200].map((dz): Vec3 => [bay(i ? 1 : -1) + sx * (bayW / 2 - 14), 110, zr + dz]), [-sx, 0, 0], { len: 12, dia: 4, on: id }))),
      tools: ["screwdriver"],
      kind: "runners",
    },
    {
      title: "Hook in the first support bar",
      detail: "Across the frame from the back panel to the front rail, then one screw through its tab into the back.",
      add: ["BAR1"],
      fix: [fx("screw", [[-500, yC1 - 15, zbi + 4]], [0, 0, -1], { len: 14, dia: 5, on: "BAR1", mate: "BK" })],
      tools: ["screwdriver"],
      kind: "screws",
    },
    {
      title: "Hook in the second support bar",
      detail: "The same way in the other half.",
      add: ["BAR2"],
      fix: [fx("screw", [[500, yC1 - 15, zbi + 4]], [0, 0, -1], { len: 14, dia: 5, on: "BAR2", mate: "BK" })],
      tools: ["screwdriver"],
      kind: "screws",
    },
    { title: "Slide in the drawers", detail: "Rest each one on its runners and push it in until it closes.", add: drawers, from: { DR1: [0, 0, 700], DR2: [0, 0, 700] }, kind: "drawer" },
    {
      title: "Screw the caps into the catches",
      detail: "One cap and one grub screw in each catch, with the small Allen key. They set how high it hooks onto the bed.",
      fix: [
        fx("cap", both.map((g): Vec3 => [g * (xi - 200), H - 30, -D / 2 - 10]), [0, -1, 0], { len: 6, dia: 12, name: "Catch cap", on: "BK" }),
        fx("screw", both.map((g): Vec3 => [g * (xi - 200), H - 50, -D / 2 - 5]), [0, 0, 1], { len: 10, dia: 5, name: "Grub screw", on: "BK" }),
      ],
      tools: ["allen"],
      kind: "screws",
    },
    { title: "Lay the slatted base on", detail: "Curved side up, the slats across the frame.", add: ["SB"], kind: "slats" },
    { title: "Clip on the four slat stops", detail: "One over each end slat at the corners, so the base can't slide.", fix: [fx(STOP.kind, both.flatMap((g) => both.map((sz): Vec3 => [g * (xi - 40), yC1 + 30, sz * (D / 2 - 80)])), DOWN, { ...STOP, name: "Slat stop", on: "SB" })], kind: "slats" },
    { title: "Slide it under the bed and lock the catches", detail: "Push it in under the SLÄKT bed, then turn the two catches so they hook onto the bed's frame.", warnings: ["hand"], kind: "general" },
  ];
  return { parts, steps };
}

/* ---------- the extendable bed (head section and foot section) ---------- */

function extendable(): CustomParams {
  const W = 1070, L = 1950, t = 18, zi = L / 2 - t;
  const head = 710, foot = 460, leg = 220, ry0 = 220, ry1 = 380, sy0 = 330, sy1 = 355;
  const xo = W / 2 - t, xin = xo - t; // head rails outside, foot side panels inside them
  const legPanel = (id: string, name: string, z0: number, z1: number, top: number) =>
    compound(id, name, [pc([-W / 2, W / 2, leg - 40, top, z0, z1]), pc([-W / 2, -W / 2 + 110, 0, leg - 40, z0, z1]), pc([W / 2 - 110, W / 2, 0, leg - 40, z0, z1])], "board");
  const footSide = (id: string, s: -1 | 1) =>
    compound(id, "Foot side panel", [pc(s < 0 ? [-xo, -xin, ry0, ry1, -250, zi] : [xin, xo, ry0, ry1, -250, zi]), pc(s < 0 ? [-xo, -xin, 0, ry0, zi - 140, zi] : [xin, xo, 0, ry0, zi - 140, zi])], "board");
  const parts: CustomPart[] = [
    box("HB", "Headboard", [-W / 2, W / 2, leg + 80, head, -L / 2, -zi]),
    legPanel("HU", "Head leg panel", -L / 2, -zi, leg + 80),
    box("HL", "Head side rail", [-W / 2, -xo, ry0, ry1, -zi, 0]),
    box("HR", "Head side rail", [xo, W / 2, ry0, ry1, -zi, 0]),
    box("SL", "Slat rail", [-xo, -xo + 25, sy0, sy1, -zi + 15, -10], "metal"),
    box("SR", "Slat rail", [xo - 25, xo, sy0, sy1, -zi + 15, -10], "metal"),
    footSide("FL", -1),
    footSide("FR", 1),
    legPanel("FU", "Foot panel", zi, L / 2, foot),
    box("CR", "Cross rail", [-xin, xin, ry0, ry0 + 80, 560, 578]),
    ...([-1, 1] as const).flatMap((s) => [[0, zi / 2 - 10], [zi / 2 + 10, zi - 15]].map(([z0, z1], k) => box(`FS${s < 0 ? "L" : "R"}${k}`, "Short slat rail", s < 0 ? [-xin, -xin + 25, sy0, sy1, z0, z1] : [xin - 25, xin, sy0, sy1, z0, z1], "metal"))),
    compound("SB", "Slatted bed base", spread(-zi + 40, zi - 40, 17).map((z) => pc([-xin + 6, xin - 6, sy1, sy1 + 15, z - 30, z + 30])), "wood"),
  ];
  const both = [-1, 1] as const;
  const shortRails = parts.filter((p) => p.name === "Short slat rail").map((p) => p.id);
  const bolts = (end: string, e: number, ids: [string, string], x: number): CustomFix[] => [
    ...ids.map((id, i) => fx(BARREL.kind, [285, 315].map((y): Vec3 => [(i ? 1 : -1) * (x - t / 2), y, e * (zi - 50)]), [i ? 1 : -1, 0, 0], { ...BARREL, on: id })),
    ...ids.map((id, i) => fx(BOLT.kind, [285, 315].map((y): Vec3 => [(i ? 1 : -1) * x, y, e * (L / 2)]), [0, 0, -e], { ...BOLT, on: end, mate: id })),
  ];
  const steps: CustomStep[] = [
    { title: "Screw three cam bolts into the headboard's bottom edge", detail: "Lay it on a rug. Turn them in by hand with the Allen key.", fix: [fx("camScrew", spread(-300, 300, 3).map((x): Vec3 => [x, leg + 80, -L / 2 + t / 2]), UP, { len: 20, dia: 8, name: "Connector bolt", on: "HB", mate: "HU" })], warnings: ["floor"], kind: "cams", tools: ["allen"] },
    { title: "Tap four dowels into it", fix: [fx(DOWEL.kind, [-420, -150, 150, 420].map((x): Vec3 => [x, leg + 80, -L / 2 + t / 2]), UP, { ...DOWEL, on: "HB", mate: "HU" })], kind: "dowels", tools: [] },
    { title: "Join the leg panel to the headboard", detail: "Press three connector housings into the leg panel, push the panels together and turn each housing with the Allen key until the joint closes.", add: ["HU"], fix: [fx("cam", spread(-300, 300, 3).map((x): Vec3 => [x, leg + 50, -L / 2 + t]), [0, 0, -1], { len: 14, dia: 25, name: "Connector housing", on: "HU" })], kind: "cams", tools: ["allen"] },
    { title: "Push two caps under the legs", fix: [fx(CAP.kind, both.map((s): Vec3 => [s * (W / 2 - 55), 0, -L / 2 + t / 2]), UP, { ...CAP, on: "HU" })], kind: "general", tools: [] },
    {
      title: "Get the head side rails ready",
      detail: "Two dowels into the head end of each, then a slat rail along the inside with six screws each.",
      add: ["HL", "HR", "SL", "SR"],
      fix: [
        ...(["HL", "HR"] as const).map((id, i) => fx(DOWEL.kind, [240, 360].map((y): Vec3 => [(i ? 1 : -1) * (xo + t / 2), y, -zi]), [0, 0, 1], { ...DOWEL, on: id, mate: "HB" })),
        ...(["SL", "SR"] as const).map((id, i) => fx("screw", spread(-zi + 80, -80, 6).map((z): Vec3 => [(i ? 1 : -1) * (xo - 25), (sy0 + sy1) / 2, z]), [i ? 1 : -1, 0, 0], { len: 10, dia: 5, on: id, mate: i ? "HR" : "HL" })),
      ],
      kind: "screws",
      tools: ["screwdriver"],
    },
    { title: "Bolt the side rails to the headboard", detail: "One of you holds them on its dowels. Barrel nuts in the rails, long bolts through the leg panel.", fix: bolts("HU", -1, ["HL", "HR"], xo + t / 2), people: 2, kind: "bolts", warnings: ["two"], tools: ["allen", "flathead"] },
    { title: "Screw two slat stops onto the head end", fix: [fx(STOP.kind, both.map((s): Vec3 => [s * (xo - 12), sy1, -zi + 30]), DOWN, { ...STOP }), fx(SMALL_SCREW.kind, both.map((s): Vec3 => [s * (xo - 12), sy1, -zi + 60]), DOWN, { ...SMALL_SCREW })], kind: "screws", tools: ["screwdriver"] },
    {
      title: "Get the foot side panels ready",
      detail: "A cam bolt and two dowels into each one's foot end, and a cap under each leg.",
      add: ["FL", "FR"],
      fix: [
        ...both.map((s) => fx("camScrew", [[s * xin, ry0 + 20, 569]], [s, 0, 0], { len: 34, dia: 7, on: s < 0 ? "FL" : "FR", mate: "CR" })),
        ...(["FL", "FR"] as const).map((id, i) => fx(DOWEL.kind, [240, 360].map((y): Vec3 => [(i ? 1 : -1) * (xin + t / 2), y, zi]), [0, 0, -1], { ...DOWEL, on: id, mate: "FU" })),
        fx(CAP.kind, both.map((s): Vec3 => [s * (xin + t / 2), 0, zi - 70]), UP, { ...CAP, on: "FL" }),
      ],
      kind: "dowels",
      tools: [],
    },
    { title: "Push two caps under the foot panel's legs", add: ["FU"], fix: [fx(CAP.kind, both.map((s): Vec3 => [s * (W / 2 - 55), 0, L / 2 - t / 2]), UP, { ...CAP, on: "FU" })], kind: "general", tools: [] },
    { title: "Bolt the foot side panels to the foot panel", detail: "Barrel nuts in the side panels, long bolts through the foot panel.", fix: bolts("FU", 1, ["FL", "FR"], xin + t / 2), kind: "bolts", tools: ["allen", "flathead"] },
    { title: "Fit the cross rail between the side panels", detail: "A dowel into each end, push it in and turn the two cam locks.", add: ["CR"], fix: [...both.map((s) => fx(DOWEL.kind, [[s * xin, ry0 + 60, 569]], [-s, 0, 0], { ...DOWEL, on: "CR", mate: s < 0 ? "FL" : "FR" })), fx(CAM.kind, both.map((s): Vec3 => [s * (xin - 40), ry0 + 80, 569]), DOWN, { ...CAM, on: "CR" })], kind: "cams", tools: ["screwdriver"] },
    { title: "Slide the foot section into the head section", detail: "The foot side panels go inside the head side rails. Pull it out to the length you want.", kind: "join", people: 2, warnings: ["two"], tools: [] },
    { title: "Bolt the sections together", detail: "Three bolts each side through the head rails into the foot panels, in the holes for the length you chose.", fix: [fx("bolt", both.flatMap((s) => [-200, -120, -40].map((z): Vec3 => [s * (W / 2), 300, z])), [0, 0, 0], { len: 30, dia: 6, on: "HL" })], kind: "bolts", tools: ["allen"] },
    { title: "Screw the four short slat rails into the foot section", detail: "Two along each side panel, three screws each.", add: shortRails, fix: [fx("screw", ([-1, 1] as const).flatMap((s) => [[0, zi / 2 - 10], [zi / 2 + 10, zi - 15]].flatMap(([z0, z1]) => spread(z0 + 60, z1 - 60, 3).map((z): Vec3 => [s * (xin - 25), (sy0 + sy1) / 2, z]))), [0, 0, 0], { len: 10, dia: 5 })], kind: "screws", tools: ["screwdriver"] },
    { title: "Screw two slat stops onto the foot end", fix: [fx(STOP.kind, both.map((s): Vec3 => [s * (xin - 12), sy1, zi - 30]), DOWN, { ...STOP }), fx(SMALL_SCREW.kind, both.map((s): Vec3 => [s * (xin - 12), sy1, zi - 60]), DOWN, { ...SMALL_SCREW })], kind: "screws", tools: ["screwdriver"] },
    { title: "Lay in the slatted base", detail: "Roll it out from the head end, curved side up. Where the sections overlap, the spare slats fold under.", add: ["SB"], kind: "slats", tools: [] },
    { title: "Tuck the end slats under the stops", detail: "At all four corners.", kind: "slats", tools: [] },
  ];
  return { parts, steps };
}

/**
 * Every fitting goes on the part whose face its point sits on (a fitting given without a direction, [0, 0, 0], goes in
 * at right angles to that face), and only marks a hole in its mate when the point touches the mate too.
 */
function aim(c: CustomParams): CustomParams {
  const dist = (p: CustomPart, v: Vec3) => Math.hypot(...([0, 1, 2] as const).map((k) => Math.max(0, Math.abs(v[k] - p.pos[k]) - p.size[k] / 2)));
  for (const st of c.steps) {
    if (!st.fix) continue;
    st.fix = st.fix.flatMap((f) => {
      if (!f.at || !f.dir) return [f];
      const free = f.dir.every((d) => !d);
      const groups = new Map<string, CustomFix>();
      for (const v of f.at) {
        const near = [...c.parts].sort((a, b) => dist(a, v) - dist(b, v));
        // the named part when the point is on it, otherwise the part the point really sits on
        const host = near.find((p) => p.id === f.on && dist(p, v) < 3) ?? (f.on || free ? near[0] : undefined);
        let dir: Vec3 = f.dir;
        if (free && host) {
          const k = ([0, 1, 2] as const).reduce((a, j) => (host.size[j] / 2 - Math.abs(v[j] - host.pos[j]) < host.size[a] / 2 - Math.abs(v[a] - host.pos[a]) ? j : a), 0 as 0 | 1 | 2);
          dir = [0, 0, 0];
          dir[k] = Math.sign(host.pos[k] - v[k]) || 1;
        }
        const mateOk = f.mate && c.parts.some((p) => p.id === f.mate && dist(p, v) < 3);
        const key = `${host?.id}|${dir.join(",")}|${mateOk}`;
        const g = groups.get(key) ?? { ...f, count: 0, at: [], dir, on: host?.id, mate: mateOk ? f.mate : undefined };
        g.at!.push(v);
        g.count = g.at!.length;
        groups.set(key, g);
      }
      return [...groups.values()];
    });
    // a step takes at most ten kinds of fitting: fold together the ones that differ only in where they go
    if (st.fix.length > 10) {
      const m = new Map<string, CustomFix>();
      for (const f of st.fix) {
        const key = JSON.stringify({ ...f, at: undefined, count: undefined });
        const g = m.get(key);
        if (g && g.at && f.at) {
          g.at = [...g.at, ...f.at];
          g.count = g.at.length;
        } else m.set(key, { ...f, at: f.at && [...f.at] });
      }
      st.fix = [...m.values()];
    }
  }
  return c;
}

function recipe(s: ProductSpec): CustomParams | null {
  if (/^underbed/i.test(s.variant)) return underbed(s);
  const r = pick(s);
  return r && aim(r);
}

function pick(s: ProductSpec): CustomParams | null {
  const v = s.variant.toLowerCase();
  if (/^ext/.test(v)) return extendable();
  if (/with storage/.test(v)) return storageBed(/twin/.test(v) || s.size.w > 110, /twin/.test(v) || s.size.w > 110 ? 1060 : 890);
  if (/storage boxes/.test(v)) return withBoxes();
  if (/slatted/.test(v)) {
    const b = bedFrame();
    return { parts: b.parts, steps: b.steps };
  }
  if (/^bed frame,/.test(v)) return withHouse();
  return null;
}

/** The recipe, with each step's tools exactly as the manual shows them. */
function build(b: PlanBuilder, s: ProductSpec): boolean {
  const r = recipe(s);
  if (!r) return false;
  const start = b.steps.length;
  buildCustom(b, { ...s, custom: r });
  r.steps.forEach((st, i) => {
    const bs = b.steps[start + i];
    if (bs && st.tools && bs.title === st.title) bs.tools = [...st.tools];
  });
  return true;
}

const family: Family = { names: ["SLÄKT"], build, recipe };
export default family;
