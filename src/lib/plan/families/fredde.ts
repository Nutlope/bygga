import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FREDDE gaming desk, read from its manual. Built lying on its back on a rug: cam studs in both steel side frames,
 * the low back rail bolted to one frame (bolt in the rail's end, a sleeve across the frame catches it), the back
 * panel on the studs and cam-locked, the second frame, the two side panels with their shelves, the front rail lifted
 * in by two people, then the desk top on dowels and cam bolts. Stood up by two people, the upper part goes on: hook-on
 * brackets, the monitor shelf, the bars, the top shelf, side panels in the loops, the side shelves, cable grommets
 * and four headphone hooks.
 */

const fx = (kind: CustomFix["kind"], on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at, ...o });

/** One part drawn as boxes placed where they sit in the product; its box and centre are worked out from them. */
function compound(id: string, name: string, abs: PartPiece[]): CustomPart {
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of abs)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p.pos[k] - p.size[k] / 2);
      hi[k] = Math.max(hi[k], p.pos[k] + p.size[k] / 2);
    }
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  const size = [0, 1, 2].map((k) => hi[k] - lo[k]) as Vec3;
  return { id, name, size, pos, material: "metal", pieces: abs.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] as Vec3 })) };
}

function gamingDesk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = 740, H = 1460;
  const t = 25, bt = 18; // steel tube, boards
  const xf = W / 2 - 60, xi = xf - t / 2; // frame centre line, its inner face
  const zF = D / 2 - 40, zB = -D / 2 + 25, zU = -160; // front leg, back leg, upper front post
  const yD = 715, yTop = yD + 25; // desk underside and top
  const frame = (sx: number, id: string) =>
    compound(id, "Side frame", [
      { shape: "box", size: [t, yD, t], pos: [sx * xf, yD / 2, zF] },
      { shape: "box", size: [t, H, t], pos: [sx * xf, H / 2, zB] },
      { shape: "box", size: [t, t, zF - zU + t], pos: [sx * xf, yD - t / 2, (zF + zU) / 2] },
      { shape: "box", size: [t, H - yD, t], pos: [sx * xf, (H + yD) / 2, zU] },
      { shape: "box", size: [t, t, zU - zB], pos: [sx * xf, H - t / 2, (zU + zB) / 2] },
    ]);
  const inner = 2 * xi;
  const yR = 180, yBP = (490 + yD) / 2, hBP = yD - 490;
  const kz0 = zB + t / 2, kd = 600; // the low shelves run forward from the back rail
  const notchZ = zU + t / 2 + 5, nx = xi - 5;
  const deskOutline: [number, number][] = [
    [-nx, -D / 2 + 20], [nx, -D / 2 + 20], [nx, notchZ], [W / 2, notchZ], [W / 2, D / 2],
    [150, D / 2], [110, D / 2 - 60], [-260, D / 2 - 60], [-300, D / 2], [-W / 2, D / 2], [-W / 2, notchZ], [-nx, notchZ],
  ];
  const dz = (-D / 2 + 20 + D / 2) / 2;
  const yMS = 1000, yTS = 1380, sz = (zB + zU) / 2, sdp = zU - zB + 70;
  const yBar = 1335;
  const ssW = 270;
  const parts: CustomPart[] = [
    frame(-1, "SL"),
    frame(1, "SR"),
    { id: "RA", name: "Back rail", size: [inner, t, t], pos: [0, yR, zB], material: "metal" },
    { id: "BP", name: "Back panel", size: [inner, hBP, bt], pos: [0, yBP, zB] },
    { id: "PL", name: "Side panel", size: [bt, 420, zF - zB - t], pos: [-xi + bt / 2, 270, (zF + zB) / 2] },
    { id: "KL", name: "Low shelf", size: [400, bt, kd], pos: [-xi + bt + 200, yR, kz0 + kd / 2] },
    { id: "PR", name: "Side panel", size: [bt, 420, zF - zB - t], pos: [xi - bt / 2, 270, (zF + zB) / 2] },
    { id: "KR", name: "Low shelf", size: [400, bt, kd], pos: [xi - bt - 200, yR, kz0 + kd / 2] },
    { id: "RC", name: "Front rail", size: [inner, t, t], pos: [0, yD - t / 2 - 30, zF], material: "metal" },
    { id: "DT", name: "Desk top", size: [W, 25, D - 20], pos: [0, yD + 12.5, dz], pieces: [{ shape: "slab", outline: deskOutline.map(([x, z]) => [x, z - dz]), round: 18, size: [W, 25, D - 20], pos: [0, 0, 0] }] },
    { id: "CB", name: "Cable bar", size: [inner, 40, 20], pos: [0, yTop + 30, zB], material: "metal" },
    { id: "MS", name: "Monitor shelf", size: [inner, bt, sdp], pos: [0, yMS, sz + 35] },
    { id: "BB", name: "Back bar", size: [inner, t, t], pos: [0, yBar, zB], material: "metal" },
    { id: "FB", name: "Front bar", size: [inner, t, t], pos: [0, yBar, zU], material: "metal" },
    { id: "TS", name: "Top shelf", size: [inner, bt, sdp], pos: [0, yTS, sz + 35] },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: i ? "SPR" : "SPL", name: "Loop panel", size: [8, H - yTop - 2 * t, zU - zB - t], pos: [sx * xf, (H + yTop) / 2, sz] })),
    ...[-1, 1].map((sx, i): CustomPart => ({ id: i ? "SSR" : "SSL", name: "Side shelf", size: [ssW, bt, 200], pos: [sx * (xf + t / 2 + ssW / 2), 1150, sz] })),
  ];
  for (const p of parts) p.material ??= "board";

  const SIDE = (sx: number) => (sx < 0 ? "SL" : "SR");
  const ys = [530, 660];
  const panelYs = [150, 390];
  // cam studs go into the frames: two at the back panel, four at the side panel (two in each leg)
  const studsBP = (sx: number): Vec3[] => ys.map((y) => [sx * xi, y, zB]);
  const studsP = (sx: number): { at: Vec3; dir: Vec3 }[] => [
    ...panelYs.map((y) => ({ at: [sx * (xi - bt / 2), y, zF - t / 2] as Vec3, dir: [0, 0, 1] as Vec3 })),
    ...panelYs.map((y) => ({ at: [sx * (xi - bt / 2), y, zB + t / 2] as Vec3, dir: [0, 0, -1] as Vec3 })),
  ];
  const studs = (sx: number): CustomFix[] => [
    fx("camScrew", SIDE(sx), [sx, 0, 0], studsBP(sx), { mate: "BP", name: "Cam stud", len: 20 }),
    ...[1, -1].map((dz2) => fx("camScrew", SIDE(sx), [0, 0, dz2], studsP(sx).filter((p) => p.dir[2] === dz2).map((p) => p.at), { mate: sx < 0 ? "PL" : "PR", name: "Cam stud", len: 20 })),
  ];
  const camBP = (sx: number) => fx("cam", "BP", [0, 0, -1], ys.map((y) => [sx * (xi - 30), y, zB + bt / 2] as Vec3));
  const camP = (sx: number) => fx("cam", sx < 0 ? "PL" : "PR", [sx, 0, 0], studsP(sx).map((p) => [sx * (xi - bt), p.at[1], p.at[2] - p.dir[2] * 30] as Vec3));
  const railBolt = (sx: number, rail: string, y: number, z: number) => fx("bolt", SIDE(sx), [-sx, 0, 0], [[sx * (xf + t / 2), y, z]], { mate: rail, len: 40, dia: 6 });
  const sleeve = (sx: number, y: number, z: number) => fx("nut", SIDE(sx), [0, 0, -1], [[sx * xf, y, z + t / 2]], { name: "Sleeve", len: 25, dia: 10 });
  const shelfScrews = (id: string, y: number): Vec3[] => [-1, 1].flatMap((sx) => [-1, 1].map((k) => [sx * (xi - 40), y - bt / 2, sz + 35 + k * 50] as Vec3));
  const brackets = (y: number): Vec3[] => [-1, 1].map((sx) => [sx * (xi - 20), y - bt / 2, sz + 35]);
  const steps: CustomStep[] = [
    {
      title: "Screw the cam studs into the side frames",
      detail: "Lay both frames flat on a rug. Six in each frame: two in the back leg, four for the side panel.",
      fix: [...studs(-1), ...studs(1)],
      wait: ["SR"],
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Bolt the back rail to one frame",
      detail: "Drop a bolt into the slot at the rail's end so its thread sticks out, then push the end into the frame's hole.",
      add: ["SL", "RA"],
      fix: [railBolt(-1, "RA", yR, zB)],
      tools: ["allen"],
    },
    {
      title: "Turn a sleeve onto the bolt",
      detail: "Push the sleeve into the hole across the frame and turn it by hand until it catches the bolt.",
      fix: [sleeve(-1, yR, zB)],
      warnings: ["hand"],
    },
    { title: "Slide the back panel onto the studs", detail: "Holes for the cam locks facing up, its long edge along the back legs.", add: ["BP"] },
    { title: "Lock the back panel to the frame", detail: "Two cam locks, turned clockwise until they pull tight.", fix: [camBP(-1)], tools: ["screwdriver"] },
    {
      title: "Put on the other frame",
      detail: "Onto the free ends of the rail and the back panel. Bolt the rail the same way and turn a sleeve onto it.",
      add: ["SR"],
      fix: [railBolt(1, "RA", yR, zB), sleeve(1, yR, zB)],
      tools: ["allen"],
    },
    { title: "Lock the back panel to the second frame", detail: "Two more cam locks.", fix: [camBP(1)], tools: ["screwdriver"] },
    {
      title: "Screw each low shelf to its side panel",
      detail: "On a table, three long screws through each panel into the end of its shelf. One pair for each side.",
      fix: [
        fx("screw", "PL", [1, 0, 0], [-200, 0, 200].map((z) => [-xi, yR, kz0 + kd / 2 + z] as Vec3), { mate: "KL", len: 50, dia: 5 }),
        fx("screw", "PR", [-1, 0, 0], [-200, 0, 200].map((z) => [xi, yR, kz0 + kd / 2 + z] as Vec3), { mate: "KR", len: 50, dia: 5 }),
      ],
      wait: ["PL", "KL", "PR", "KR"],
      from: { PL: [0, 220, 260], KL: [0, 220, 260], PR: [0, 220, 260], KR: [0, 220, 260] },
      tools: ["screwdriver"],
    },
    {
      title: "Fit the side panels into the frames",
      detail: "Tilt each one in between the legs of its frame so the studs go into its edges, shelf facing in.",
      add: ["PL", "KL", "PR", "KR"],
      from: { PL: [0, 220, 260], KL: [0, 220, 260], PR: [0, 220, 260], KR: [0, 220, 260] },
    },
    { title: "Lock the side panels", detail: "Four cam locks in each, by the legs.", fix: [camP(-1), camP(1)], tools: ["screwdriver"] },
    {
      title: "Lift the front rail in together",
      detail: "A bolt in each end and the two cable clips on it, then hold it between the front legs while the other pushes the ends home.",
      add: ["RC"],
      from: { RC: [0, 0, 260] },
      fix: [railBolt(-1, "RC", yD - t / 2 - 30, zF), railBolt(1, "RC", yD - t / 2 - 30, zF), fx("clip", "RC", [0, 1, 0], [-1, 1].map((k) => [k * 300, yD - 30, zF] as Vec3), { name: "Cable clip", len: 30, dia: 20 })],
      tools: ["allen"],
      people: 2,
    },
    {
      title: "Turn the sleeves onto the front rail's bolts",
      detail: "One in each front leg. Then tighten both rails' bolts with the long Allen key.",
      fix: [sleeve(-1, yD - t / 2 - 30, zF), sleeve(1, yD - t / 2 - 30, zF)],
      tools: ["allen"],
    },
    {
      title: "Get the desk top ready",
      detail: "Lay it face down. Tap the two inserts in, then screw in the five cam bolts along its back edge.",
      fix: [
        fx("plug", "DT", [0, 1, 0], [-1, 1].map((sx) => [sx * xf, yD, 150] as Vec3), { name: "Insert", included: true, len: 12, dia: 10 }),
        fx("camScrew", "DT", [0, 1, 0], [-500, -250, 0, 250, 500].map((x) => [x, yD, zB] as Vec3), { mate: "BP" }),
      ],
      wait: ["DT"],
      tools: ["hammer", "screwdriver"],
    },
    { title: "Tap two dowels into the back panel", detail: "Into the holes along its top edge.", fix: [fx("dowel", "BP", [0, -1, 0], [-375, 375].map((x) => [x, yD, zB] as Vec3), { mate: "DT" })], tools: ["hammer"] },
    { title: "Swing the desk top in", detail: "Its notches go round the upright tubes. Press it onto the dowels and cam bolts.", add: ["DT"] },
    { title: "Lock the desk top", detail: "Five cam locks in the back panel, just under the top.", fix: [fx("cam", "BP", [0, 0, -1], [-500, -250, 0, 250, 500].map((x) => [x, yD - 30, zB + bt / 2] as Vec3))], tools: ["screwdriver"] },
    {
      title: "Screw the frames to the desk top",
      detail: "One screw up through each frame's top tube into the insert.",
      fix: [-1, 1].map((sx) => fx("screw", SIDE(sx), [0, 1, 0], [[sx * xf, yD - t, 150]], { mate: "DT", len: 40, dia: 6 })),
      tools: ["allen"],
    },
    {
      title: "Press the caps onto the leg ends",
      detail: "One on the end of each of the four legs.",
      fix: [-1, 1].map((sx) => fx("cap", SIDE(sx), [0, 1, 0], [zF, zB].map((z) => [sx * xf, 0, z] as Vec3), { name: "Leg cap", len: 8, dia: 30 })),
    },
    { title: "Stand it up together", detail: "Tip it up onto its legs between two of you.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Tighten the rails", detail: "With two Allen keys, one on each side, tighten the bolts of the back rail." },
    {
      title: "Screw the low shelves to the back rail",
      detail: "One long screw from the back through the rail into each shelf.",
      fix: [-1, 1].map((sx) => fx("screw", "RA", [0, 0, 1], [[sx * (xi - bt - 200), yR, zB - t / 2]], { mate: sx < 0 ? "KL" : "KR", len: 70, dia: 5 })),
      tools: ["screwdriver"],
    },
    {
      title: "Hook on the brackets for the monitor shelf",
      detail: "One on the inside of each upright loop, in the slots at the height you want. Push it down until it locks.",
      fix: [fx("angle", "SL", [0, 1, 0], brackets(yMS).slice(0, 1), { name: "Shelf bracket", len: 60, dia: 40 }), fx("angle", "SR", [0, 1, 0], brackets(yMS).slice(1), { name: "Shelf bracket", len: 60, dia: 40, twist: Math.PI })],
    },
    { title: "Hang the cable bar at the back", detail: "Its ends drop into the slots in the back legs, just over the desk.", add: ["CB"], from: { CB: [0, 200, 0] } },
    { title: "Lay the monitor shelf on its brackets", detail: "Tilt it in between the loops, back edge first, and lower it on.", add: ["MS"], from: { MS: [0, 240, 120] } },
    {
      title: "Hook on the brackets for the top shelf",
      detail: "Near the top of each loop, the same way.",
      fix: [fx("angle", "SL", [0, 1, 0], brackets(yTS).slice(0, 1), { name: "Shelf bracket", len: 60, dia: 40 }), fx("angle", "SR", [0, 1, 0], brackets(yTS).slice(1), { name: "Shelf bracket", len: 60, dia: 40, twist: Math.PI })],
    },
    { title: "Drop in the back bar", detail: "Between the back legs, under the top shelf.", add: ["BB"], from: { BB: [0, 200, 0] } },
    { title: "Drop in the front bar", detail: "Between the front posts of the loops, holes facing forward for the hooks.", add: ["FB"], from: { FB: [0, 200, 0] } },
    { title: "Lay the top shelf on its brackets", detail: "Tilt it in over the bars and lower it on.", add: ["TS"], from: { TS: [0, 240, 120] } },
    {
      title: "Screw the shelves to their brackets",
      detail: "Two screws up through each bracket.",
      fix: [fx("screw", "MS", [0, 1, 0], shelfScrews("MS", yMS), { len: 14, dia: 4 }), fx("screw", "TS", [0, 1, 0], shelfScrews("TS", yTS), { len: 14, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Hang the right loop panel", detail: "Two hooks on its edge go into the slots in the loop.", add: ["SPR"], from: { SPR: [200, 0, 0] } },
    { title: "Hang the left loop panel", detail: "The same way on the other side.", add: ["SPL"], from: { SPL: [-200, 0, 0] } },
    {
      title: "Hook on the side shelf brackets",
      detail: "On the outside of each loop, at the height you want.",
      fix: [-1, 1].map((sx) => fx("angle", SIDE(sx), [0, 1, 0], [[sx * (xf + t / 2 + 20), 1150 - bt / 2, sz]], { name: "Side bracket", len: 60, dia: 40, twist: sx < 0 ? Math.PI : 0 })),
    },
    { title: "Lay the side shelves on", detail: "One on each bracket.", add: ["SSL", "SSR"] },
    {
      title: "Screw the side shelves on",
      detail: "Two screws up through each bracket.",
      fix: [-1, 1].map((sx, i) => fx("screw", i ? "SSR" : "SSL", [0, 1, 0], [-40, 40].map((k) => [sx * (xf + t / 2 + 60), 1150 - bt / 2, sz + k] as Vec3), { len: 14, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Press in the large cable grommets",
      detail: "Into the two holes at the back of the desk top.",
      fix: [fx("cap", "DT", [0, -1, 0], [-1, 1].map((sx) => [sx * 450, yTop, -D / 2 + 90] as Vec3), { name: "Large grommet", len: 10, dia: 58 })],
    },
    {
      title: "Press in the small cable grommets",
      detail: "Into the holes near the front corners.",
      fix: [fx("cap", "DT", [0, -1, 0], [[-W / 2 + 70, yTop, D / 2 - 70], [W / 2 - 110, yTop, D / 2 - 70]], { name: "Small grommet", len: 10, dia: 44 })],
    },
    {
      title: "Screw the headphone hooks onto the front bar",
      detail: "Four hooks, each held by a bolt from the back of the bar.",
      fix: [
        fx("knob", "FB", [0, 0, -1], [-450, -150, 150, 450].map((x) => [x, yBar, zU + t / 2] as Vec3), { name: "Headphone hook", len: 40, dia: 26 }),
        fx("bolt", "FB", [0, 0, 1], [-450, -150, 150, 450].map((x) => [x, yBar, zU - t / 2] as Vec3), { len: 30, dia: 5 }),
      ],
      tools: ["allen"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["FREDDE"],
  recipe(s) {
    if (/gaming desk/i.test(s.variant)) return gamingDesk(s);
    return null;
  },
};
export default family;
