import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * BISSA, read from the 2 and 3 compartment manuals (the same build, counts by compartment). Chipboard, no back
 * panel. It is built lying on its side: cam bolts and the pivot fittings go in a side, the three rails (plinth,
 * back bottom and back top) take dowels and stand in it on cam locks, the other side goes on, then it stands upside
 * down on the top panel (dowels and four cam locks) and takes four nail-on glides. Each tilting compartment is a
 * front with two plastic brackets (six screws), a shoe board and a strip (two screws each); with the cabinet on its
 * back they drop onto the pivots and are held by a bushing and screw each side. Stood up, it is screwed to the wall
 * (screws and plugs in the box) and two stop screws go in for each compartment.
 */

const T = 16;
const RAIL = 70;
const BIG = { len: 13, dia: 4 }; // the bracket and pivot screws
const SMALL = { len: 12, dia: 3 };

function recipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const n = H > 1100 ? 3 : 2;
  const sideH = H - T;
  const xi = W / 2 - T; // inside face of a side
  const parts: CustomPart[] = [];
  for (const [id, sx] of [["SL", -1], ["SR", 1]] as const) parts.push({ id, name: "Side", size: [T, sideH, D], pos: [sx * (W / 2 - T / 2), sideH / 2, 0] });
  parts.push({ id: "TP", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0] });
  const rails: { id: string; y: number; z: number }[] = [
    { id: "RP", y: RAIL / 2 + 10, z: D / 2 - 40 },
    { id: "RB", y: RAIL / 2 + 60, z: -D / 2 + T / 2 },
    { id: "RT", y: sideH - RAIL / 2, z: -D / 2 + T / 2 },
  ];
  for (const r of rails) parts.push({ id: r.id, name: r.id === "RP" ? "Plinth" : "Back rail", size: [2 * xi, RAIL, T], pos: [0, r.y, r.z] });

  // the compartments, from the bottom up, closed
  const y0 = RAIL + 20, hc = (sideH - y0) / n;
  const comp = (i: number) => {
    const yb = y0 + i * hc;
    const zf = D / 2 - T / 2;
    const bh = hc * 0.78, bd = D - 50;
    const bz = zf - T / 2 - bd / 2;
    const bracket: PartPiece[] = [
      { shape: "box", size: [6, bh, 20], pos: [0, 0, bd / 2 - 10] },
      { shape: "box", size: [6, 20, bd], pos: [0, -bh / 2 + 10, 0] },
      { shape: "box", size: [6, 20, Math.hypot(bh, bd)], pos: [0, 0, 0], rot: [Math.atan2(bh, bd), 0, 0] },
    ];
    const ang = Math.atan2(bh * 0.7, bd);
    return [
      { id: `F${i}`, name: "Front", size: [2 * xi - 4, hc - 4, T], pos: [0, yb + hc / 2, zf] },
      ...[-1, 1].map((sx) => ({ id: `K${i}${sx < 0 ? "L" : "R"}`, name: "Bracket", size: [6, bh, bd], pos: [sx * (xi - 8), yb + bh / 2 + 6, bz], pieces: bracket, material: "fiber" as const })),
      { id: `B${i}`, name: "Shoe board", size: [2 * xi - 22, 6, Math.hypot(bd, bh * 0.7) - 20], pos: [0, yb + bh * 0.4, bz], rot: [ang, 0, 0] as Vec3, material: "fiber" as const },
      { id: `L${i}`, name: "Shoe strip", size: [2 * xi - 22, 40, 8], pos: [0, yb + bh * 0.82, bz - bd / 2 + 30] },
    ] as CustomPart[];
  };
  const comps = Array.from({ length: n }, (_, i) => comp(i));
  comps.forEach((c) => parts.push(...c));

  /* ---------- fittings ---------- */
  const railEnd = (sx: number, r: (typeof rails)[number]): Vec3 => [sx * xi, r.y, r.z];
  const camBolts = (sx: number): CustomFix => ({ kind: "camScrew", count: 3, at: rails.map((r) => railEnd(sx, r)), dir: [sx, 0, 0], on: sx < 0 ? "SL" : "SR" });
  // cam locks sit in the rails' inside faces
  const cams = (sx: number): CustomFix[] =>
    rails.map((r) => ({ kind: "cam", count: 1, at: [[sx * (xi - 34), r.y, r.z + (r.id === "RP" ? -T / 2 : T / 2)]], dir: [0, 0, r.id === "RP" ? 1 : -1], on: r.id }));
  const pivots = (sx: number): CustomFix[] => {
    const at = comps.map((_, i) => [sx * xi, y0 + i * hc + 30, D / 2 - 45] as Vec3);
    const id = sx < 0 ? "SL" : "SR";
    return [
      { kind: "hook", name: "Pivot fitting", count: n, len: 16, dia: 20, at, dir: [sx, 0, 0], on: id },
      { kind: "screw", count: n, len: 10, dia: 3.5, at: at.map((p) => [p[0], p[1] - 12, p[2]] as Vec3), dir: [sx, 0, 0], on: id },
    ];
  };
  const dowels: CustomFix[] = rails.map((r) => ({ kind: "dowel", count: 2, at: [-18, 18].map((dy) => [-xi, r.y + dy, r.z] as Vec3), dir: [-1, 0, 0], on: r.id }));
  const topPts = [-1, 1].flatMap((sx) => [-D / 2 + 50, D / 2 - 50].map((z) => [sx * (W / 2 - T / 2), sideH, z] as Vec3));
  const compFix = (i: number) => {
    const c = comps[i];
    const f = c[0], kl = c[1], kr = c[2], bd = c[3], st = c[4];
    const fz = f.pos[2] - T / 2;
    return {
      brackets: { kind: "screw" as const, count: 6, ...BIG, at: [kl, kr].flatMap((k) => [0.15, 0.5, 0.85].map((t) => [k.pos[0], f.pos[1] - f.size[1] / 2 + 15 + (f.size[1] - 30) * t * 0.8, fz - 2] as Vec3)), dir: [0, 0, 1] as Vec3, on: `F${i}` },
      // one screw through each bracket from outside into the board's or strip's end
      board: [kl, kr].map((k): CustomFix => ({ kind: "screw", count: 1, ...SMALL, at: [[k.pos[0] + Math.sign(k.pos[0]) * 3, bd.pos[1], bd.pos[2]]], dir: [-Math.sign(k.pos[0]), 0, 0], on: k.id, mate: `B${i}` })),
      strip: [kl, kr].map((k): CustomFix => ({ kind: "screw", count: 1, ...SMALL, at: [[k.pos[0] + Math.sign(k.pos[0]) * 3, st.pos[1], st.pos[2]]], dir: [-Math.sign(k.pos[0]), 0, 0], on: k.id, mate: `L${i}` })),
    };
  };
  const bushings = comps.flatMap((_, i) => [-1, 1].map((sx) => [sx * (xi - 6), y0 + i * hc + 30, D / 2 - 45] as Vec3));
  const stops = comps.flatMap((_, i) => [-1, 1].map((sx) => [sx * xi, y0 + (i + 1) * hc - 40, D / 2 - 70] as Vec3));
  const wallAt = [-1, 1].map((sx) => [sx * (xi - 70), sideH - RAIL / 2, -D / 2] as Vec3);

  const later = comps.slice(1);
  const steps: CustomStep[] = [
    {
      title: "Lay a side on a rug and fit its cam bolts",
      detail: `Inside face up. Screw in three cam bolts, then tap in the ${n} pivot fittings near the front edge and screw each one down.`,
      add: ["SL"],
      fix: [camBolts(-1), ...pivots(-1)],
      tools: ["screwdriver", "hammer"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Tap the dowels into the rails and stand them in the side",
      detail: "Two dowels in one end of each rail. The plinth goes at the front, the two back rails along the back edge.",
      add: ["RP", "RB", "RT"],
      fix: dowels,
      tools: ["hammer"],
    },
    { title: "Lock the cam locks in the rails", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", fix: cams(-1), tools: ["screwdriver"] },
    {
      title: "Fit the other side's cam bolts and pivots and lower it on",
      detail: "The same three cam bolts and pivot fittings as the first side, then press it down onto the rails.",
      add: ["SR"],
      fix: [camBolts(1), ...pivots(1)],
      tools: ["screwdriver", "hammer"],
    },
    { title: "Lock its cam locks", detail: "Three more, one in the other end of each rail.", fix: cams(1), tools: ["screwdriver"] },
    {
      title: "Stand it upside down on the top",
      detail: "Screw the cam bolts and tap the dowels into the top panel, lay it on the rug and lower the cabinet onto it.",
      add: ["TP"],
      fix: [
        { kind: "camScrew", count: 4, at: topPts, dir: [0, -1, 0], on: "TP" },
        { kind: "dowel", count: 4, at: topPts.map((p) => [p[0], p[1], p[2] + (p[2] > 0 ? 30 : -30)] as Vec3), dir: [0, -1, 0], on: "TP" },
      ],
      pose: "-y",
      tools: ["screwdriver", "hammer"],
    },
    { title: "Lock the top's cam locks", detail: "Four, inside the sides near the top.", fix: [{ kind: "cam", count: 4, at: topPts.map((p) => [p[0] - Math.sign(p[0]) * 9, p[1] - 34, p[2]] as Vec3), dir: [-1, 0, 0] }], tools: ["screwdriver"] },
    {
      title: "Tap the glides into the sides",
      detail: "Two under each side, near the front and back.",
      fix: [{ kind: "glide", name: "Nail-on glide", count: 4, len: 8, dia: 20, at: [-1, 1].flatMap((sx) => [-D / 2 + 30, D / 2 - 30].map((z) => [sx * (W / 2 - T / 2), 0, z] as Vec3)), dir: [0, 1, 0] }],
      tools: ["hammer"],
    },
    {
      title: "Lay it on its back and screw the brackets to a front",
      detail: "Front face down. The two brackets are a pair: right and left as the drawing shows. Three screws each.",
      add: ["F0", "K0L", "K0R"],
      fix: [compFix(0).brackets],
      pose: "+z",
      tools: ["screwdriver"],
      from: { F0: [0, 0, 500], K0L: [0, 0, 600], K0R: [0, 0, 600] },
    },
    { title: "Slot in the shoe board and screw it", detail: "The wide board, into the slots in both brackets. One screw each side.", add: ["B0"], fix: compFix(0).board, tools: ["screwdriver"], from: { B0: [0, 0, 500] } },
    { title: "Slot in the shoe strip and screw it", detail: "The narrow strip, at the back of the brackets. One screw each side.", add: ["L0"], fix: compFix(0).strip, tools: ["screwdriver"], from: { L0: [0, 0, 500] } },
    {
      title: n > 2 ? "Build the other compartments the same way" : "Build the other compartment the same way",
      detail: "Brackets, shoe board and strip, then check each bracket's slot sits on its pivot.",
      add: later.flat().map((p) => p.id),
      fix: later.flatMap((_, j) => {
        const f = compFix(j + 1);
        return [f.brackets, ...f.board, ...f.strip];
      }),
      tools: ["screwdriver"],
      repeat: n - 1,
    },
    {
      title: "Lock each compartment onto its pivots",
      detail: "A bushing in each bracket over the pivot, then a screw through it. Don't use a drill.",
      fix: [
        ...[-1, 1].map((sx): CustomFix => ({ kind: "spacer", name: "Bushing", count: n, len: 6, dia: 14, at: bushings.filter((p) => Math.sign(p[0]) === sx), dir: [sx, 0, 0] })),
        ...[-1, 1].map((sx): CustomFix => ({ kind: "screw", count: n, ...BIG, at: bushings.filter((p) => Math.sign(p[0]) === sx).map((p) => [p[0] - sx * 2, p[1], p[2]] as Vec3), dir: [sx, 0, 0] })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Stand it up and screw it to the wall",
      detail: "Two screws with washers through the top back rail. The plugs in the box suit solid walls; pick others for your wall if needed.",
      fix: [
        { kind: "plug", count: 2, at: wallAt.map((p) => [p[0], p[1], p[2] - 30] as Vec3), dir: [0, 0, -1], included: true },
        { kind: "washer", count: 2, at: wallAt.map((p) => [p[0], p[1], p[2] + T] as Vec3), dir: [0, 0, -1], on: "RT" },
        { kind: "screw", count: 2, len: 60, dia: 5, at: wallAt.map((p) => [p[0], p[1], p[2] + T + 1] as Vec3), dir: [0, 0, -1], on: "RT", included: true },
      ],
      pose: "+y",
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Screw in the stops",
      detail: "Tilt each compartment open. One small screw each side, where the drawing shows, stops it opening too far.",
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: n, ...SMALL, at: stops.filter((p) => Math.sign(p[0]) === sx), dir: [sx, 0, 0] })),
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["BISSA"],
  recipe(s) {
    if (!/shoe/i.test(`${s.variant} ${s.slug}`)) return null;
    return recipe(s);
  },
};
export default family;
