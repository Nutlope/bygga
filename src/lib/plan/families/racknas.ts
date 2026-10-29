import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * RACKNÄS chest of 3 drawers (wall mounted), read from its manual. Three runners go on each side, and the frame is
 * built lying on its left side: a back rail on dowels and a cam, the top with its back upstand, two more rails, then
 * the right side on top with connector screws. Pads are knocked into the sides' feet, a steel rail is screwed in
 * under the top and the chest is screwed to the wall through it: it has no legs, so it must hang on the wall.
 * The three drawers are built lying on their fronts (cam bolts, sides, hardboard bottom, back board, cams), get a
 * pull ring, and each one slides in and takes two stop screws.
 */

const W = 690, H = 780, D = 400, T = 18;
const XI = W / 2 - T;
const ZB = -D / 2, ZF = D / 2;
const FRONTS = [544, 348, 152]; // drawer fronts' bottoms, top drawer first
const FH = 190;
const CONN = { name: "Connector screw", len: 50, dia: 7 };

function part(id: string, name: string, abs: PartPiece[], material: CustomPart["material"] = "board"): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...abs.map((p) => p.pos[k] - p.size[k] / 2)));
  const hi = [0, 1, 2].map((k) => Math.max(...abs.map((p) => p.pos[k] + p.size[k] / 2)));
  const c = lo.map((v, k) => (v + hi[k]) / 2) as Vec3;
  return {
    id,
    name,
    size: lo.map((v, k) => hi[k] - v) as Vec3,
    pos: c,
    material,
    pieces: abs.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 })),
  };
}
const box = (lo: Vec3, hi: Vec3): PartPiece => ({ shape: "box", size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] });
const panel = (id: string, name: string, lo: Vec3, hi: Vec3, material: CustomPart["material"] = "board"): CustomPart => ({ ...part(id, name, [box(lo, hi)], material), pieces: undefined });
const fx = (kind: CustomFix["kind"], at: Vec3[], dir: Vec3, on: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...o });
const side = (sx: number) => (sx < 0 ? "SL" : "SR");

/** A drawer's parts, numbered i (0 at the top). */
function drawerParts(i: number): CustomPart[] {
  const f0 = FRONTS[i], b0 = f0 + 15, b1 = f0 + 165, xo = 315, t = 12, zb = -175, zf = ZF - T;
  return [
    panel(`DF${i}`, "Drawer front", [-XI + 2, f0, zf], [XI - 2, f0 + FH, ZF]),
    panel(`DL${i}`, "Drawer side", [-xo, b0, zb], [-xo + t, b1, zf]),
    panel(`DR${i}`, "Drawer side", [xo - t, b0, zb], [xo, b1, zf]),
    panel(`DB${i}`, "Drawer bottom", [-xo + 6, b0 + 10, zb + 15], [xo - 6, b0 + 13, zf], "fiber"),
    panel(`DK${i}`, "Drawer back", [-xo + t, b0, zb], [xo - t, b1, zb + 15]),
  ];
}

function chest(): CustomParams {
  const yTop = H - 38; // top panel's underside; it sits 2 cm below the sides' top edge
  const sidePieces = (sx: number): PartPiece[] => {
    const x0 = sx < 0 ? -W / 2 : XI, x1 = sx < 0 ? -XI : W / 2;
    // below the bottom drawer each side narrows to a foot at the back
    return [box([x0, 130, ZB], [x1, H, ZF]), box([x0, 60, ZB], [x1, 130, 140]), box([x0, 0, ZB], [x1, 60, 40])];
  };
  const parts: CustomPart[] = [
    part("SL", "Side panel", sidePieces(-1)),
    part("SR", "Side panel", sidePieces(1)),
    panel("R1", "Back rail", [-XI, 130, ZB], [XI, 210, ZB + T]),
    panel("TOP", "Top panel", [-XI, yTop, ZB + T], [XI, yTop + T, ZF]),
    panel("UP", "Back upstand", [-XI, yTop, ZB], [XI, H, ZB + T]),
    panel("R2", "Front rail", [-XI, 112, 120], [XI, 130, ZF]),
    panel("R3", "Back rail", [-XI, 400, ZB], [XI, 480, ZB + T]),
    panel("RAIL", "Wall rail", [-XI, 690, ZB], [XI, 735, ZB + 16], "metal"),
    ...[0, 1, 2].flatMap(drawerParts),
  ];
  const ids = (k: string) => [0, 1, 2].map((i) => `${k}${i}`);
  const runY = (i: number) => FRONTS[i] + 25;
  const runners = (sx: number): CustomFix[] => [
    fx("runner", [0, 1, 2].map((i): Vec3 => [sx * XI, runY(i), 0]), [sx, 0, 0], side(sx), { len: 350 }),
    fx("screw", [0, 1, 2].flatMap((i) => [-120, 120].map((z): Vec3 => [sx * XI, runY(i), z])), [sx, 0, 0], side(sx), { len: 12, dia: 4 }),
  ];
  const conn = (sx: number, pts: [string, number, number][]) => pts.map(([id, y, z]) => fx("screw", [[sx * (W / 2), y, z]], [-sx, 0, 0], side(sx), { ...CONN, mate: id }));
  const topPts = (): [string, number, number][] => [["TOP", yTop + 9, -60], ["TOP", yTop + 9, 60]];
  const railPts = (): [string, number, number][] => [["R2", 121, 160], ["R3", 440, ZB + 9]];
  const dowelEnds = (id: string, yz: [number, number][]) => [-1, 1].map((sx) => fx("dowel", yz.map(([y, z]): Vec3 => [sx * XI, y, z]), [sx, 0, 0], id, { len: 30, dia: 8, mate: side(sx) }));
  const camR1 = (sx: number) => fx("cam", [[sx * (XI - 30), 170, ZB + T]], [0, 0, -1], "R1");
  const wall: Vec3[] = [-200, 200].map((x): Vec3 => [x, 712, ZB]);

  const drawerSteps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the drawer fronts",
      detail: "Lay each front face down on a rug, four bolts into the holes on the back. Build all three drawers the same way.",
      fix: [0, 1, 2].map((i) => fx("camScrew", [-1, 1].flatMap((sx) => [FRONTS[i] + 50, FRONTS[i] + 130].map((y): Vec3 => [sx * 309, y, ZF - T])), [0, 0, 1], `DF${i}`)),
      add: ids("DF"),
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    { title: "Slide the sides onto the fronts", detail: "Grooves facing in, onto the bolts.", add: [...ids("DL"), ...ids("DR")] },
    {
      title: "Lock the sides with cams",
      detail: "Four per drawer, arrow towards the bolt, turned clockwise.",
      fix: [0, 1, 2].flatMap((i) => [-1, 1].map((sx) => fx("cam", [FRONTS[i] + 50, FRONTS[i] + 130].map((y): Vec3 => [sx * 303, y, ZF - T - 30]), [sx, 0, 0], sx < 0 ? `DL${i}` : `DR${i}`))),
      tools: ["screwdriver"],
    },
    { title: "Slide the bottoms down the grooves", detail: "Smooth side in, all the way to the front.", add: ids("DB") },
    {
      title: "Knock the stiffeners into the back boards",
      detail: "The wire goes into the holes along the back board's bottom edge, hooks down. Tap it in with a hammer.",
      fix: [0, 1, 2].map((i) => fx("clip", [[0, FRONTS[i] + 15, -168]], [0, 1, 0], `DK${i}`, { name: "Bottom stiffener", len: 300, dia: 4 })),
      tools: ["hammer"],
      wait: ids("DK"),
      from: Object.fromEntries(ids("DK").map((k) => [k, [0, 0, -420] as Vec3])),
    },
    { title: "Put the back boards on", detail: "Over the ends of the sides, with the bottom's edge in the groove.", add: ids("DK") },
    {
      title: "Push in the plastic plugs",
      detail: "Four per drawer, through the sides into the back board.",
      fix: [0, 1, 2].flatMap((i) => [-1, 1].map((sx) => fx("dowel", [FRONTS[i] + 50, FRONTS[i] + 130].map((y): Vec3 => [sx * 315, y, -167]), [-sx, 0, 0], sx < 0 ? `DL${i}` : `DR${i}`, { name: "Plastic plug", len: 30, dia: 8, mate: `DK${i}` }))),
    },
    {
      title: "Lock the back boards",
      detail: "Four cams per drawer into the back board, turned until they grip.",
      fix: [0, 1, 2].map((i) => fx("cam", [-1, 1].flatMap((sx) => [FRONTS[i] + 50, FRONTS[i] + 130].map((y): Vec3 => [sx * 280, y, -175])), [0, 0, 1], `DK${i}`)),
      tools: ["screwdriver"],
    },
    {
      title: "Fit the pull rings",
      detail: "Push the two halves of a ring into each front's hole from both sides and twist them together.",
      fix: [0, 1, 2].map((i) => fx("knob", [[0, FRONTS[i] + FH / 2, ZF]], [0, 0, -1], `DF${i}`, { name: "Pull ring", len: 18, dia: 40 })),
      pose: "+y",
    },
  ];
  const slideIn = (i: number, name: string): CustomStep[] => [
    { title: `Slide the ${name} drawer in`, detail: i === 0 ? "Fronts with the same depth go in from the top down. Push it onto the runners until it closes." : "Onto its runners, all the way in." },
    {
      title: "Screw in its two stop screws",
      detail: "Into the holes at the back of the drawer sides, so it can't be pulled all the way out.",
      fix: [-1, 1].map((sx) => fx("screw", [[sx * 309, FRONTS[i] + 165, -150]], [0, -1, 0], sx < 0 ? `DL${i}` : `DR${i}`, { name: "Stop screw", len: 12, dia: 8 })),
      tools: ["screwdriver"],
    },
  ];
  const steps: CustomStep[] = [
    {
      title: "Screw the runners onto the sides",
      detail: "Lay both sides on a rug, inside up. Three runners on each, two screws apiece.",
      add: ["SL"],
      fix: [...runners(-1), ...runners(1)],
      wait: ["SR"],
      from: { SR: [0, 0, -620] },
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw a cam bolt into each side",
      detail: "In the hole near the bottom back corner, by hand until it stops.",
      fix: [-1, 1].map((sx) => fx("camScrew", [[sx * XI, 170, ZB + T / 2]], [sx, 0, 0], side(sx), { mate: "R1" })),
      tools: ["screwdriver"],
    },
    { title: "Tap the dowels into the back rail", detail: "One into each end.", fix: dowelEnds("R1", [[190, ZB + T / 2]]), wait: ["R1"], tools: ["hammer"] },
    { title: "Stand the back rail in the left side", detail: "Its dowel and the cam bolt go into the holes, the cam hole facing the front.", add: ["R1"] },
    { title: "Lock it with a cam", detail: "Arrow towards the bolt, turned clockwise.", fix: [camR1(-1)], tools: ["screwdriver"] },
    {
      title: "Tap the dowels into the top and the rails",
      detail: "Two into each end of the top panel and of both rails: twelve in all.",
      fix: [...dowelEnds("TOP", [[yTop + 9, -130], [yTop + 9, 130]]), ...dowelEnds("R2", [[121, 135], [121, 185]]), ...dowelEnds("R3", [[415, ZB + 9], [465, ZB + 9]])],
      wait: ["TOP", "R2", "R3"],
      tools: ["hammer"],
    },
    {
      title: "Screw the upstand onto the top",
      detail: "Along the top's back edge, its pegs in the holes. Two connector screws through it.",
      add: ["TOP", "UP"],
      fix: [fx("screw", [-200, 200].map((x): Vec3 => [x, yTop + 9, ZB]), [0, 0, 1], "UP", { ...CONN, mate: "TOP" })],
      tools: ["allen"],
    },
    { title: "Screw the top to the left side", detail: "Two connector screws through the side into the top's end.", fix: conn(-1, topPts()), tools: ["allen"] },
    { title: "Fit the two other rails", detail: "One at the front under the bottom drawer, one across the back. A connector screw through the side into each.", add: ["R2", "R3"], fix: conn(-1, railPts()), tools: ["allen"] },
    {
      title: "Lay the right side on top",
      detail: "Runners inside, over all the dowels. Four connector screws through it.",
      add: ["SR"],
      fix: conn(1, [...topPts(), ...railPts()]),
      tools: ["allen"],
    },
    { title: "Lock the back rail's other cam", detail: "Turned clockwise until it's tight.", fix: [camR1(1)], tools: ["screwdriver"] },
    {
      title: "Knock the pads into the feet",
      detail: "Stand the frame up. One pad into the bottom of each side, with a hammer.",
      fix: [-1, 1].map((sx) => fx("glide", [[sx * (W / 2 - T / 2), 0, -80]], [0, 1, 0], side(sx), { name: "Support pad", len: 10, dia: 30 })),
      tools: ["hammer"],
      pose: "+y",
    },
    {
      title: "Screw the wall rail in under the top",
      detail: "Across the back, flush with the back edges. Two screws into each side.",
      add: ["RAIL"],
      fix: [-1, 1].map((sx) => fx("screw", [700, 725].map((y): Vec3 => [sx * XI, y, ZB + 8]), [sx, 0, 0], "RAIL", { len: 12, dia: 4, mate: side(sx) })),
      tools: ["screwdriver"],
    },
    {
      title: "Mark the wall",
      detail: "Hold the chest where it will hang, level, and mark through the rail's two slots. The slots fit studs 40, 50 or 60 cm apart.",
      tools: ["pencil", "level"],
      warnings: ["wall"],
    },
    {
      title: "Screw the chest to the wall",
      detail: "It has no legs, so it must hang on the wall. The screws and plugs in the box suit most walls; ask in store if yours is different.",
      fix: [
        fx("plug", wall, [0, 0, -1], "RAIL", { len: 35, dia: 8, included: true }),
        fx("bracket", wall.map((p): Vec3 => [p[0], p[1], ZB + 16]), [0, 0, -1], "RAIL", { name: "Keyhole plate", included: true }),
        fx("screw", wall, [0, 0, -1], "RAIL", { len: 50, dia: 5, included: true }),
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      people: 2,
      warnings: ["wall", "tip", "two"],
    },
    ...drawerSteps,
    ...slideIn(0, "top"),
    ...slideIn(1, "middle"),
    ...slideIn(2, "bottom"),
  ];
  return { parts, steps };
}

/** Parts built on their own are shown in their own scene for steps `from` to `until`, and come in at `join`. */
function apart(b: PlanBuilder, r: CustomParams, ids: string[], scene: string, from: number, until: number, join: number, off: Vec3) {
  for (let i = from; i < until; i++) if (b.steps[i]) b.steps[i].scene = scene;
  for (const id of ids) {
    const p = r.parts.find((q) => q.id === id)!;
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - p.pos[k]) < 0.5));
    if (!it) continue;
    it.states = it.states.filter((st) => st.step < join).map((st) => ({ ...st, scene }));
    it.states.push({ step: join, scene: "main", pos: it.final.pos, rot: it.final.rot, from: off, delay: 0.2 });
  }
}

const family: Family = {
  names: ["RACKNÄS", "RACKNAS"],
  build(b: PlanBuilder, s: ProductSpec) {
    if (!/chest/i.test(`${s.variant} ${s.slug ?? ""}`)) return false;
    const r = chest();
    buildCustom(b, { ...s, custom: r });
    const from = r.steps.findIndex((x) => /cam bolts into the drawer fronts/.test(x.title));
    const until = r.steps.findIndex((x) => /top drawer in/.test(x.title));
    ["top", "middle", "bottom"].forEach((name, i) => {
      const join = r.steps.findIndex((x) => x.title === `Slide the ${name} drawer in`);
      apart(b, r, ["F", "L", "R", "B", "K"].map((k) => `D${k}${i}`), "drawers", from, until, join, [0, 0, 420]);
    });
    return true;
  },
};
export default family;
