import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * MOSSJÖN, read from the two wall cabinets' and the 2-door cabinet's manuals. A steel frame of posts between a
 * bottom and a top frame, screwed together, with framed ribbed-glass sides and doors that turn on pivots (a pin
 * at the bottom, a bolt down through the top frame). The wall cabinets hang on two triangular brackets clipped into
 * the top frame, on two screws in the wall, locked with clips and covered. The 2-door cabinet is built on its back
 * from two ladders and depth rails, stands on four feet with two open shelves under it and is strapped to the wall.
 */

const F = 20; // frame tube
const tube = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });

/** A flat rectangle of tubes, as seen from above, centred on its own middle. */
function ring(W: number, D: number): PartPiece[] {
  return [
    tube([W, F, F], [0, 0, -(D / 2 - F / 2)]),
    tube([W, F, F], [0, 0, D / 2 - F / 2]),
    tube([F, F, D - 2 * F], [-(W / 2 - F / 2), 0, 0]),
    tube([F, F, D - 2 * F], [W / 2 - F / 2, 0, 0]),
  ];
}

/** A framed ribbed-glass panel: a thin steel frame round the glass. */
function glassPanel(id: string, name: string, size: Vec3, pos: Vec3): CustomPart {
  const thin = size.indexOf(Math.min(...size));
  const [a, b] = [0, 1, 2].filter((k) => k !== thin);
  const bars: PartPiece[] = [];
  for (const k of [a, b]) {
    const other = k === a ? b : a;
    for (const sgn of [-1, 1]) {
      const sz: Vec3 = [...size];
      sz[other] = 14;
      const p: Vec3 = [0, 0, 0];
      p[other] = sgn * (size[other] / 2 - 7);
      bars.push({ shape: "box", size: sz, pos: p, material: "metal" });
    }
  }
  const glass: Vec3 = [...size];
  glass[a] -= 20;
  glass[b] -= 20;
  glass[thin] = 4;
  return { id, name, size, pos, material: "glass", pieces: [...bars, { shape: "box", size: glass, pos: [0, 0, 0], material: "glass" }] };
}

// ---------- the wall cabinets ----------

function wallCabinet(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const tall = H > 700;
  const TT = 15; // top lid
  const yTF = H - TT - F / 2, yBF = F / 2;
  const yFloor = tall ? 260 : F + 8; // the cabinet's floor: over an open shelf on the tall one
  const xp = W / 2 - F / 2, zp = D / 2 - F / 2;
  const boxLo = yFloor + 8, boxHi = yTF - F / 2; // the glass box
  const boxH = boxHi - boxLo, boxY = (boxLo + boxHi) / 2;
  const parts: CustomPart[] = [
    { id: "TF", name: "Top frame", size: [W, F, D], pos: [0, yTF, 0], material: "metal", pieces: ring(W, D) },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `WB${i}`, name: "Wall bracket", size: [50, 50, 50], pos: [sx * (W / 2 - F - 25), yTF - F / 2 - 25, -(D / 2 - F - 25)], material: "metal", pieces: [{ shape: "box", size: [66, 50, 3], pos: [0, 0, 0], rot: [0, sx * Math.PI / 4, 0] }] })),
    { id: "BF", name: "Bottom frame", size: [W, F, D], pos: [0, yBF, 0], material: "metal", pieces: ring(W, D) },
  ];
  const postH = yTF - yBF - F;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => parts.push({ id: `P${i}`, name: "Post", size: [F, postH, F], pos: [sx * xp, (yTF + yBF) / 2, sz * zp], material: "metal" }));
  if (tall) parts.push({ id: "OS", name: "Shelf", size: [W - 2 * F, 15, D - 2 * F], pos: [0, F + 8, 0], material: "metal" });
  parts.push({ id: "FL", name: tall ? "Cabinet floor" : "Bottom shelf", size: [W - 2 * F, 15, D - 2 * F], pos: [0, yFloor, 0], material: "metal" });
  parts.push(glassPanel("SL", "Side panel", [10, boxH, D - 2 * F], [-xp, boxY, 0]));
  parts.push(glassPanel("SR", "Side panel", [10, boxH, D - 2 * F], [xp, boxY, 0]));
  parts.push(glassPanel("DR", "Door", [W - 2 * F - 4, boxH, 10], [0, boxY, D / 2 - 10]));
  parts.push({ id: "TP", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "metal" });
  parts.push({ id: "BK", name: "Back panel", size: [W - 2 * F, boxH, 3], pos: [0, boxY, -(D / 2 - 6)], material: "metal" });
  const nShelves = tall ? 3 : 1;
  const shelfY = (i: number) => boxLo + (boxH * (i + 1)) / (nShelves + 1);
  for (let i = 0; i < nShelves; i++) parts.push({ id: `GS${i}`, name: "Glass shelf", size: [W - 2 * F - 6, 6, D - 2 * F - 10], pos: [0, shelfY(i), 0], material: "glass" });

  // the door turns on its left edge: a pin in the bottom, a bolt down through the top frame
  const xh = -(W / 2 - F - 20), zh = D / 2 - 10;
  const xHandle = W / 2 - F - 30;
  const brackets = [0, 1].map((i) => parts.find((p) => p.id === `WB${i}`)!.pos);
  const ys = (n: number) => Array.from({ length: n }, (_, i) => boxLo + 40 + ((boxH - 80) * i) / Math.max(1, n - 1));
  const sideFixes: CustomFix[] = [-1, 1].map((sx) => ({ kind: "screw", count: 4, len: 10, dia: 4, at: [-1, 1].flatMap((sz) => ys(2).map((y) => [sx * (W / 2), y, sz * (zp - 20)] as Vec3)), dir: [-sx, 0, 0] }));
  const backN = tall ? 6 : 4;
  const backAt: Vec3[] = [-1, 1].flatMap((sx) => ys(backN / 2).map((y) => [sx * (W / 2 - F - 8), y, -D / 2] as Vec3));
  const plates = tall ? [boxLo + 10, boxHi - 10] : [boxLo + 10];
  const pins: CustomFix[] = Array.from({ length: nShelves }, (_, i) => ({
    kind: "pin",
    name: "Shelf support",
    count: 4,
    at: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - F), shelfY(i) - 5, sz * (zp - 2)] as Vec3)),
    dir: [1, 0, 0],
    on: "P0",
  }));
  const handle: CustomStep = {
    title: "Fit the handle to the door",
    detail: "Slide it onto the door frame on the side away from the pivots and fix it with two screws.",
    add: ["DR"],
    from: { DR: [0, 0, 300] },
    fix: [
      { kind: "handle", count: 1, at: [[xHandle, boxY, D / 2 - 5]], dir: [0, 0, -1], on: "DR", twist: Math.PI / 2 },
      { kind: "screw", count: 2, len: 8, dia: 4, at: [boxY - 40, boxY + 40].map((y) => [xHandle, y, D / 2 - 4] as Vec3), dir: [0, 0, -1] },
    ],
    tools: ["screwdriver"],
  };
  const pivotBottom: CustomStep[] = [
    {
      title: "Fit the lower pivot into the door",
      detail: "A washer and a screw in the bottom corner on the pivot side. Lay the door on a rug for this.",
      add: ["DR"],
      fix: [
        { kind: "washer", count: 1, at: [[xh, boxLo, zh]], dir: [0, 1, 0], on: "DR" },
        { kind: "screw", count: 1, len: 12, dia: 4, at: [[xh, boxLo, zh]], dir: [0, 1, 0], on: "DR" },
      ],
      from: { DR: [0, 0, 300] },
    },
    {
      title: "Push the pivot pin into the frame",
      detail: "With its washer, into the front corner under the door's pivot.",
      fix: [{ kind: "pin", name: "Pivot pin", count: 1, at: [[xh, boxLo - 4, zh]], dir: [0, -1, 0], on: "FL" }, { kind: "washer", count: 1, at: [[xh, boxLo - 2, zh]], dir: [0, -1, 0], on: "FL" }],
    },
    {
      title: "Set the door on its pin and bolt the top pivot",
      detail: "Hold the door upright on the pin and screw the pivot bolt down through the top frame with the long Allen key.",
      fix: [{ kind: "bolt", name: "Pivot bolt", count: 1, len: 30, dia: 6, at: [[xh, yTF + F / 2, zh]], dir: [0, -1, 0], on: "TF", mate: "DR" }],
      tools: ["allen"],
    },
  ];
  const steps: CustomStep[] = [
    { title: "Clip the wall brackets into the top frame", detail: "One in each back corner, marked I and II. Slide them in until they click.", add: ["TF", "WB0", "WB1"], warnings: ["floor"] },
    { title: "Push the back posts onto the bottom frame", detail: "The hole in each post faces inwards, as on the drawing.", add: ["BF", "P0", "P1"] },
    { title: "Screw them on from below", detail: "One countersunk bolt up into each post.", fix: [{ kind: "bolt", count: 2, len: 12, dia: 6, at: [-1, 1].map((sx) => [sx * xp, 0, -zp] as Vec3), dir: [0, 1, 0] }], tools: ["allen"] },
    { title: "Push on the front posts", detail: "Holes facing inwards again.", add: ["P2", "P3"] },
    { title: "Screw the front posts on", detail: "One screw through the side of the frame into each.", fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 1, len: 10, dia: 4, at: [[sx * (W / 2), yBF, zp]], dir: [-sx, 0, 0] })), tools: ["screwdriver"] },
    { title: "Lower the top frame onto the posts", detail: "The brackets hook over the back posts." },
    { title: "Bolt the top frame to the back posts", detail: "One countersunk bolt down into each.", fix: [{ kind: "bolt", count: 2, len: 12, dia: 6, at: [-1, 1].map((sx) => [sx * xp, yTF + F / 2, -zp] as Vec3), dir: [0, -1, 0] }], tools: ["allen"] },
    { title: "Screw the top frame to the front posts", detail: "One screw through the side into each.", fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 1, len: 10, dia: 4, at: [[sx * (W / 2), yTF, zp]], dir: [-sx, 0, 0] })), tools: ["screwdriver"] },
    {
      title: tall ? "Screw on the two door stops" : "Screw on the door stop",
      detail: "Choose which side the door opens first: the stop goes on the side away from the pivots.",
      fix: [
        { kind: "clip", name: "Door stop", count: plates.length, at: plates.map((y) => [W / 2 - F, y, zp] as Vec3), dir: [-1, 0, 0], on: "P3" },
        { kind: "screw", count: plates.length, len: 10, dia: 4, at: plates.map((y) => [W / 2 - F - 4, y + 25, zp] as Vec3), dir: [1, 0, 0] },
      ],
      tools: ["screwdriver"],
    },
    ...(tall ? [{ title: "Turn the open shelf in at the bottom", detail: "Tilt it in between the posts and lay it on the bottom frame.", add: ["OS"] }] : []),
    { title: tall ? "Drop in the cabinet floor" : "Drop in the bottom shelf", detail: "Folded edges down, onto the frame.", add: ["FL"] },
    { title: "Slide in the side panels", detail: "Between the posts, the screw holes towards the frame.", add: ["SL", "SR"] },
    { title: "Screw the side panels on", detail: "Four screws through each side panel's frame.", fix: sideFixes, tools: ["screwdriver"] },
    ...(tall ? [handle] : []),
    ...pivotBottom,
    { title: "Lay the top on", detail: "Hook it over the front edge, then press the back down.", add: ["TP"] },
    { title: "Screw the top on at the back", detail: "Two screws.", fix: [{ kind: "screw", count: 2, len: 10, dia: 4, at: [-1, 1].map((sx) => [sx * (W / 2 - 40), H - TT / 2, -D / 2] as Vec3), dir: [0, 0, 1] }], tools: ["screwdriver"] },
    ...(tall ? [] : [{ title: "Screw in the shelf supports", detail: "Four, into the posts at the height you want, with the small Allen key.", fix: pins, tools: ["allen" as const] }]),
    { title: "Slide the back panel on", detail: "Down behind the posts into the brackets' slots.", add: ["BK"], from: { BK: [0, 0, -300] } },
    { title: "Screw the back panel on", detail: `${backN} screws through the back into the posts.`, fix: [{ kind: "screw", count: backN, len: 10, dia: 4, at: backAt, dir: [0, 0, 1] }], tools: ["screwdriver"] },
    { title: "Free the hanging hooks", detail: "Turn the adjusting screw in each wall bracket back, so the hooks can drop over the wall screws." },
    ...(tall ? [] : [handle]),
    {
      title: "Hang it on two screws in the wall",
      detail: "Two screws, level and as far apart as the brackets, with at least 25 mm left sticking out. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 2, at: brackets.map((p) => [p[0], p[1], -D / 2 - 12] as Vec3), dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 50, dia: 5, at: brackets.map((p) => [p[0], p[1], -D / 2 - 10] as Vec3), dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver", "level", "pencil"],
      wall: true,
      warnings: ["wall"],
    },
    {
      title: "Adjust and lock the brackets",
      detail: "Turn the adjusting screws until it hangs level and tight to the wall, then push a locking clip into each.",
      fix: [{ kind: "clip", name: "Locking clip", count: 2, at: brackets, dir: [0, 0, -1] }],
      tools: ["screwdriver", "level"],
    },
    { title: "Click the covers onto the brackets", detail: "One over each bracket.", fix: [{ kind: "cap", name: "Bracket cover", count: 2, at: brackets.map((p) => [p[0], p[1], p[2] + 10] as Vec3), dir: [0, 0, -1] }] },
    ...(tall ? [{ title: "Screw in the shelf supports", detail: "Four for each shelf, into the posts at the heights you want.", fix: pins, tools: ["allen" as const] }] : []),
    { title: tall ? "Lay in the glass shelves" : "Lay in the glass shelf", detail: "On the supports, one corner at a time.", add: Array.from({ length: nShelves }, (_, i) => `GS${i}`) },
  ];
  return { parts, steps };
}

// ---------- the 2-door cabinet ----------

function doorCabinet(s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const FOOT = 15, TT = 15;
  const levels = [166, 448, 653, H - TT - F / 2]; // the two open shelves, the cabinet floor, the top frame
  const yLo = FOOT, yHi = H - TT;
  const xp = W / 2 - F / 2, zp = D / 2 - F / 2;
  const ladder = (id: string, name: string, z: number): CustomPart => ({
    id,
    name,
    size: [W, yHi - yLo, F],
    pos: [0, (yLo + yHi) / 2, z],
    material: "metal",
    pieces: [
      tube([F, yHi - yLo, F], [-xp, 0, 0]),
      tube([F, yHi - yLo, F], [xp, 0, 0]),
      ...levels.map((y) => tube([W - 2 * F, F, F], [0, y - (yLo + yHi) / 2, 0])),
    ],
  });
  const parts: CustomPart[] = [ladder("BL", "Back frame", -zp)];
  levels.forEach((y, k) => [-1, 1].forEach((sx, i) => parts.push({ id: `R${k}${i}`, name: "Depth rail", size: [F, F, D - 2 * F], pos: [sx * xp, y, 0], material: "metal" })));
  parts.push(ladder("FR", "Front frame", zp));
  const boxLo = levels[2] + F / 2 + 8, boxHi = levels[3] - F / 2;
  const boxH = boxHi - boxLo, boxY = (boxLo + boxHi) / 2;
  parts.push({ id: "S0", name: "Shelf", size: [W - 2 * F, 15, D - 2 * F], pos: [0, levels[0] + F / 2 + 7, 0], material: "metal" });
  parts.push({ id: "S1", name: "Shelf", size: [W - 2 * F, 15, D - 2 * F], pos: [0, levels[1] + F / 2 + 7, 0], material: "metal" });
  parts.push({ id: "FL", name: "Cabinet floor", size: [W - 2 * F, 15, D - 2 * F], pos: [0, levels[2] + F / 2 + 7, 0], material: "metal" });
  parts.push(glassPanel("SL", "Side panel", [10, boxH, D - 2 * F], [-xp, boxY, 0]));
  parts.push(glassPanel("SR", "Side panel", [10, boxH, D - 2 * F], [xp, boxY, 0]));
  const dw = (W - 2 * F - 6) / 2;
  parts.push(glassPanel("D0", "Door", [dw, boxH, 10], [-(dw / 2 + 2), boxY, D / 2 - 10]));
  parts.push(glassPanel("D1", "Door", [dw, boxH, 10], [dw / 2 + 2, boxY, D / 2 - 10]));
  parts.push({ id: "TP", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "metal", pieces: [{ shape: "box", size: [W, 4, D], pos: [0, -TT / 2 + 2, 0] }, ...ring(W, D).map((p) => ({ ...p, size: [p.size[0], TT, p.size[2]] as Vec3, pos: [p.pos[0], 0, p.pos[2]] as Vec3 }))] });
  parts.push({ id: "BK", name: "Back panel", size: [W - 2 * F, boxH, 3], pos: [0, boxY, -(D / 2 - 6)], material: "metal" });
  const shelfY = (i: number) => boxLo + (boxH * (i + 1)) / 3;
  for (let i = 0; i < 2; i++) parts.push({ id: `GS${i}`, name: "Glass shelf", size: [W - 2 * F - 6, 6, D - 2 * F - 10], pos: [0, shelfY(i), 0], material: "glass" });

  const rails = (ks: number[]) => ks.flatMap((k) => [`R${k}0`, `R${k}1`]);
  const xh = (i: number) => (i ? 1 : -1) * (W / 2 - F - 20), zh = D / 2 - 10;
  const sideScrew = (sx: number, n: number): CustomFix => ({ kind: "screw", count: n, len: 10, dia: 4, at: Array.from({ length: n }, (_, j) => [sx * (W / 2), boxLo + 40 + ((boxH - 80) * j) / Math.max(1, n - 1), j % 2 ? zp - 20 : -(zp - 20)] as Vec3), dir: [-sx, 0, 0] });
  const shelfScrews = (y: number): CustomFix => ({ kind: "screw", count: 4, len: 10, dia: 4, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - F - 30), y - 8, sz * (zp - 30)] as Vec3)), dir: [0, 1, 0] });
  const steps: CustomStep[] = [
    {
      title: "Push depth rails into the back frame",
      detail: "Lay the back frame on a rug. Push a rail into each post at the top and at the cabinet floor.",
      add: ["BL", ...rails([2, 3])],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Push in the rails for the open shelves", detail: "Two more at each of the lower two levels.", add: rails([0, 1]) },
    { title: "Screw the rails to the back frame", detail: "Four screws through the posts at the lower levels.", fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 2, len: 10, dia: 4, at: [0, 1].map((k) => [sx * (W / 2), levels[k], -zp] as Vec3), dir: [-sx, 0, 0] })), tools: ["screwdriver"] },
    { title: "Lay the front frame on", detail: "Onto the free ends of all eight rails.", add: ["FR"], from: { FR: [0, 0, 400] } },
    { title: "Bolt the top rails", detail: "One countersunk bolt down through each top corner.", fix: [{ kind: "bolt", count: 2, len: 12, dia: 6, at: [-1, 1].map((sx) => [sx * xp, levels[3] + F / 2, zp] as Vec3), dir: [0, -1, 0] }], tools: ["allen"] },
    { title: "Screw the front frame on", detail: "Two screws through the posts into the cabinet floor rails.", fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 1, len: 10, dia: 4, at: [[sx * (W / 2), levels[2], zp]], dir: [-sx, 0, 0] })), tools: ["screwdriver"] },
    { title: "Screw in the feet", detail: "One into the bottom of each post, by hand.", fix: [{ kind: "foot", name: "Adjustable foot", count: 4, len: 20, dia: 8, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xp, 0, sz * zp] as Vec3)), dir: [0, 1, 0] }] },
    { title: "Slide in the open shelves", detail: "Folded edges down, between the rails.", add: ["S0", "S1"] },
    { title: "Screw the lower shelf on and stand it up", detail: "Four screws up through the rails. Then stand it up together.", fix: [shelfScrews(parts.find((p) => p.id === "S0")!.pos[1])], pose: "+y", people: 2, tools: ["screwdriver"] },
    { title: "Screw the other shelf on", detail: "Four screws again.", fix: [shelfScrews(parts.find((p) => p.id === "S1")!.pos[1])], tools: ["screwdriver"] },
    { title: "Drop in the cabinet floor", detail: "Onto the rails at the third level.", add: ["FL"] },
    { title: "Slide in the side panels", detail: "Between the posts, the screw holes towards the frame.", add: ["SL", "SR"] },
    { title: "Screw the side panels on", detail: "Through the panel frames into the posts.", fix: [sideScrew(-1, 4), sideScrew(1, 3)], tools: ["screwdriver"] },
    {
      title: "Fit the lower pivots into the doors",
      detail: "A washer and a screw in the bottom outer corner of each door.",
      add: ["D0", "D1"],
      fix: [
        { kind: "washer", count: 2, at: [0, 1].map((i) => [xh(i), boxLo, zh] as Vec3), dir: [0, 1, 0] },
        { kind: "washer", count: 2, at: [0, 1].map((i) => [xh(i), boxHi, zh] as Vec3), dir: [0, -1, 0] },
        { kind: "screw", count: 4, len: 12, dia: 4, at: [0, 1].flatMap((i) => [[xh(i), boxLo, zh], [xh(i), boxHi, zh]] as Vec3[]), dir: [0, 1, 0] },
      ],
      from: { D0: [0, 0, 300], D1: [0, 0, 300] },
    },
    {
      title: "Fit the handles to the doors",
      detail: "Slide one onto the inner edge of each door and fix it with two screws.",
      fix: [
        { kind: "handle", count: 2, at: [-1, 1].map((sx) => [sx * 30, boxY, D / 2 - 5] as Vec3), dir: [0, 0, -1], twist: Math.PI / 2 },
        { kind: "screw", count: 4, len: 8, dia: 4, at: [-1, 1].flatMap((sx) => [boxY - 40, boxY + 40].map((y) => [sx * 30, y, D / 2 - 4] as Vec3)), dir: [0, 0, -1] },
      ],
      tools: ["screwdriver"],
    },
    { title: "Push the pivot pins into the floor", detail: "With a washer each, in both front corners.", fix: [{ kind: "pin", name: "Pivot pin", count: 2, at: [0, 1].map((i) => [xh(i), boxLo - 4, zh] as Vec3), dir: [0, -1, 0], on: "FL" }, { kind: "washer", count: 2, at: [0, 1].map((i) => [xh(i), boxLo - 2, zh] as Vec3), dir: [0, -1, 0], on: "FL" }] },
    { title: "Set the doors on their pins", detail: "Tilt each door in at the top and lower it onto its pin." },
    { title: "Bolt the top pivots", detail: "One pivot bolt down through the top frame into each door, with the long Allen key.", fix: [{ kind: "bolt", name: "Pivot bolt", count: 2, len: 30, dia: 6, at: [0, 1].map((i) => [xh(i), levels[3] + F / 2 + 3, zh] as Vec3), dir: [0, -1, 0] }], tools: ["allen"] },
    { title: "Lay the top on", detail: "Hook it over the front edge, then press the back down.", add: ["TP"] },
    { title: "Screw the top on", detail: "Two screws at the back and two at the sides.", fix: [{ kind: "screw", count: 4, len: 10, dia: 4, at: [[-(W / 2 - 40), H - TT / 2, -D / 2], [W / 2 - 40, H - TT / 2, -D / 2], [-W / 2, H - TT / 2, 0], [W / 2, H - TT / 2, 0]], dir: [0, 0, 1] }], tools: ["screwdriver"] },
    { title: "Slide the back panel on", detail: "Down behind the posts.", add: ["BK"], from: { BK: [0, 0, -300] } },
    { title: "Screw the back panel on", detail: "Eight screws into the posts.", fix: [{ kind: "screw", count: 8, len: 10, dia: 4, at: [-1, 1].flatMap((sx) => Array.from({ length: 4 }, (_, j) => [sx * (W / 2 - F - 8), boxLo + 40 + ((boxH - 80) * j) / 3, -D / 2] as Vec3)), dir: [0, 0, 1] }], tools: ["screwdriver"] },
    { title: "Mark the wall for the strap", detail: "Stand it where it will go and mark the wall just above the top at the back.", tools: ["pencil"] },
    { title: "Mark the side too", detail: "Mark where the side meets the wall, so the strap lines up with the frame.", tools: ["pencil"] },
    {
      title: "Screw the strap to the wall",
      detail: "Move the cabinet away and screw the strap to the wall at your mark. Wall screws aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 1, at: [[0, H - 30, -D / 2 - 40]], dir: [0, 0, -1] },
        { kind: "screw", count: 1, len: 50, dia: 5, at: [[0, H - 30, -D / 2 - 38]], dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Fix the strap to the cabinet",
      detail: "Push it back to the wall and screw the strap to the back of the frame with the washer.",
      fix: [{ kind: "strap", count: 1, at: [[0, levels[3], -D / 2 - 20]], dir: [0, 0, 1], on: "BL" }, { kind: "washer", count: 1, at: [[0, levels[3], -D / 2]], dir: [0, 0, 1], on: "BL" }, { kind: "screw", count: 1, len: 10, dia: 4, at: [[0, levels[3], -D / 2]], dir: [0, 0, 1] }],
      tools: ["screwdriver"],
      wall: true,
    },
    { title: "Adjust the doors", detail: "Turn the screw in each door's pivot until the doors line up and close evenly.", tools: ["screwdriver"] },
    {
      title: "Screw in the shelf supports",
      detail: "Four for each shelf, into the posts at the heights you want.",
      fix: [0, 1].map((i): CustomFix => ({ kind: "pin", name: "Shelf support", count: 4, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - F), shelfY(i) - 5, sz * (zp - 2)] as Vec3)), dir: [1, 0, 0], on: "BL" })),
      tools: ["allen"],
    },
    { title: "Lay in the glass shelves", detail: "On the supports, one corner at a time.", add: ["GS0", "GS1"] },
    { title: "Level it with the feet", detail: "Turn the feet until it stands level and the doors close evenly.", tools: ["level"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["MOSSJÖN"],
  recipe(s) {
    const v = `${s.variant} ${s.slug ?? ""}`;
    if (/wall cabinet/i.test(v)) return wallCabinet(s);
    if (/2 doors/i.test(v)) return doorCabinet(s);
    return null;
  },
};
export default family;
