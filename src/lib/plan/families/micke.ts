import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, CustomStep, PartMaterial, ProductSpec, Vec3 } from "../../types";

/**
 * MICKE, read from IKEA's manuals for the 73 and 142 desks: one full-height side panel, a white steel leg frame
 * at the other end and one drawer (two on the 142, with a middle panel between them) under the top. The drawers are
 * built first: cam bolts in the front, the sides doweled and cam-locked to it, the bottom slid in, the back screwed
 * on and the runners fitted. Then the shelf, back panel and top strip are doweled together, the side panel and
 * drawer walls get cam bolts and runners and are locked on, the leg frame is screwed to the back with a steel strip,
 * and the whole frame is turned upside down onto the top and cam-locked. The drawer unit with drop-file storage has
 * its own manual: a carcass with no bottom on five castors, three small drawers and a file drawer with hanging frames.
 * The 105 desk (a cupboard with a small drawer, a wide drawer and the leg frame) and the corner workstation (a corner
 * desk and its add-on unit) each have their own manual too.
 */

type Kind = CustomFix["kind"];
const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const P = (id: string, name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: PartMaterial = "board"): CustomPart => ({
  id,
  name,
  size: [x1 - x0, y1 - y0, z1 - z0],
  pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  material,
});

const DOWEL = { len: 30, dia: 8 };
const CAM_BOLT = { len: 34, dia: 7 };
const CAM = { len: 13, dia: 15 };
const RUNNER = { len: 420, dia: 36, name: "Drawer runner" };
const SMALL = { len: 12, dia: 4 };
const LONG = { len: 60, dia: 6, name: "Long screw" };

function desk(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = 750, T = 25, D = 500;
  const n = W > 1000 ? 2 : 1;
  const yT = H - T, zb = -D / 2, zf = D / 2;
  const xa = -W / 2 + 18; // the side panel's inner face
  const xb = W / 2 - 60; // the right drawer wall's outer face
  const xl = W / 2 - 37.5; // the leg frame's inner face
  const yS = 572; // the shelf under the drawers
  const bay = (xb - 18 - xa - 18 * (n - 1)) / n;
  const bayX = (i: number): [number, number] => [xa + i * (bay + 18), xa + i * (bay + 18) + bay];
  const walls = Array.from({ length: n }, (_, i) => (i < n - 1 ? `MP${i}` : "DW")); // the wall at the right of each bay
  const wallX = (i: number) => bayX(i)[1]; // its left face

  const parts: CustomPart[] = [
    P("SP", "Side panel", -W / 2, xa, 0, yT, zb, zf),
    P("SH", "Shelf", xa, xb, yS, yS + 18, zb + 18, zf - 20),
    P("BP", "Back panel", xa, xl, yS, yT - 18, zb, zb + 18),
    P("TS", "Top strip", xa, xl, yT - 18, yT, zb, zb + 80),
    P("TOP", "Desk top", -W / 2, W / 2, yT, H, zb, zf),
  ];
  walls.forEach((id, i) => parts.push(P(id, id === "DW" ? "Drawer wall" : "Middle panel", wallX(i), wallX(i) + 18, yS + 18, yT, zb + 18, zf - 20)));
  parts.push({
    id: "LF",
    name: "Leg frame",
    size: [25, yT, D - 50],
    pos: [xl + 12.5, yT / 2, 0],
    material: "metal",
    pieces: [
      { shape: "box", size: [25, yT, 25], pos: [0, 0, -(D - 50) / 2 + 12.5] },
      { shape: "box", size: [25, yT, 25], pos: [0, 0, (D - 50) / 2 - 12.5] },
      { shape: "box", size: [25, 25, D - 50], pos: [0, -yT / 2 + 12.5, 0] },
      { shape: "box", size: [25, 25, D - 50], pos: [0, yT / 2 - 12.5, 0] },
    ],
  });

  // the drawers: a front, two sides, a bottom and a back, on runners 13 mm wide each side
  const dy0 = yS + 30, dy1 = yT - 25, dz0 = zb + 30, dz1 = zf - 38;
  const drawer = (i: number) => {
    const [a, b] = bayX(i);
    const s0 = a + 13, s1 = b - 13;
    parts.push(P(`DF${i}`, "Drawer front", a + 2, b - 2, yS + 22, yT - 4, dz1, dz1 + 18));
    parts.push(P(`DL${i}`, "Drawer side", s0, s0 + 12, dy0, dy1, dz0, dz1));
    parts.push(P(`DR${i}`, "Drawer side", s1 - 12, s1, dy0, dy1, dz0, dz1));
    parts.push(P(`DB${i}`, "Drawer back", s0 + 12, s1 - 12, dy0 + 10, dy1, dz0, dz0 + 12));
    parts.push(P(`DT${i}`, "Drawer bottom", s0 + 12, s1 - 12, dy0 + 4, dy0 + 7, dz0 + 12, dz1, "fiber"));
    return { s0, s1, a, b };
  };
  const dr = Array.from({ length: n }, (_, i) => drawer(i));
  const each = (f: (d: (typeof dr)[number], i: number) => CustomFix[]) => dr.flatMap((d, i) => f(d, i));
  const yM = (dy0 + dy1) / 2;

  const steps: CustomStep[] = [
    {
      title: n > 1 ? "Screw two cam bolts into each drawer front" : "Screw two cam bolts into the drawer front",
      detail: "Lay it face down on a rug. Into the holes near the ends, by hand until they stop.",
      fix: each((d, i) => [at("camScrew", [[d.s0 + 6, yM, dz1], [d.s1 - 6, yM, dz1]], [0, 0, 1], `DF${i}`, undefined, CAM_BOLT)]),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Tap a dowel into each drawer side and stand it on the front",
      detail: "The dowel goes into the front end of each side. Holes for the cam locks face in.",
      fix: each((d, i) => [at("dowel", [[d.s0 + 6, dy1 - 25, dz1]], [0, 0, -1], `DL${i}`, `DF${i}`, DOWEL), at("dowel", [[d.s1 - 6, dy1 - 25, dz1]], [0, 0, -1], `DR${i}`, `DF${i}`, DOWEL)]),
      tools: ["hammer"],
    },
    {
      title: "Turn the cam locks in the drawer sides",
      detail: "Arrow towards the bolt, then clockwise until the side pulls tight against the front.",
      fix: each((d, i) => [at("cam", [[d.s0 + 12, yM, dz1 - 34]], [-1, 0, 0], `DL${i}`, undefined, CAM), at("cam", [[d.s1 - 12, yM, dz1 - 34]], [1, 0, 0], `DR${i}`, undefined, CAM)]),
      tools: ["screwdriver"],
    },
    { title: n > 1 ? "Slide the bottoms into the grooves" : "Slide the bottom into the grooves", detail: "Smooth side up, all the way to the front.", add: dr.map((_, i) => `DT${i}`) },
    { title: n > 1 ? "Fit the backs onto the drawers" : "Fit the back onto the drawer", detail: "It sits between the sides, over the end of the bottom.", add: dr.map((_, i) => `DB${i}`) },
    {
      title: "Screw the back to the sides",
      detail: "One screw through each side into the end of the back.",
      fix: each((d, i) => [at("screw", [[d.s0, yM, dz0 + 6]], [1, 0, 0], `DL${i}`, `DB${i}`, { len: 25, dia: 4 }), at("screw", [[d.s1, yM, dz0 + 6]], [-1, 0, 0], `DR${i}`, `DB${i}`, { len: 25, dia: 4 })]),
      tools: ["screwdriver"],
    },
    {
      title: n > 1 ? "Clip the inner runners onto the drawers" : "Clip the inner runners onto the drawer",
      detail: "One along the bottom edge of each side, the wheel at the back.",
      fix: each((d, i) => [at("runner", [[d.s0, dy0 + 10, (dz0 + dz1) / 2]], [1, 0, 0], `DL${i}`, undefined, RUNNER), at("runner", [[d.s1, dy0 + 10, (dz0 + dz1) / 2]], [-1, 0, 0], `DR${i}`, undefined, RUNNER)]),
    },
    {
      title: "Screw the runners to the drawer sides",
      detail: "Two small screws in each.",
      fix: each((d, i) => [at("screw", [[d.s0, dy0 + 10, dz0 + 80], [d.s0, dy0 + 10, dz1 - 80]], [1, 0, 0], `DL${i}`, undefined, SMALL), at("screw", [[d.s1, dy0 + 10, dz0 + 80], [d.s1, dy0 + 10, dz1 - 80]], [-1, 0, 0], `DR${i}`, undefined, SMALL)]),
      tools: ["screwdriver"],
    },
  ];

  // the frame
  const xs = n > 1 ? [-W / 4, 0, W / 4] : [-W / 6, W / 6];
  const shelfDowels = n > 1 ? [-W / 3, -W / 9, W / 9, W / 3] : [-W / 5, W / 5];
  const wallFix = (kind: Kind, f: (x: number, id: string) => [Vec3[], Vec3], o: { len?: number; dia?: number; name?: string }) => walls.map((id, i) => {
    const [pts, dir] = f(wallX(i), id);
    return at(kind, pts, dir, id, undefined, o);
  });
  steps.push(
    {
      title: "Tap dowels into the shelf and stand the back panel on it",
      detail: "Lay the shelf on a rug. The back panel stands on the dowels along its back edge.",
      add: ["SH", "BP"],
      fix: [at("dowel", shelfDowels.map((x) => [x, yS + 18, zb + 9] as Vec3), [0, -1, 0], "SH", "BP", DOWEL)],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Tap dowels into the back panel and fit the top strip",
      detail: "Along its top edge, then press the strip on, its wide side to the front.",
      add: ["TS"],
      fix: [at("dowel", shelfDowels.map((x) => [x, yT - 18, zb + 9] as Vec3), [0, -1, 0], "BP", "TS", DOWEL)],
      tools: ["hammer"],
    },
    {
      title: n > 1 ? "Screw cam bolts into the side panel and the drawer walls" : "Screw cam bolts into the side panel and the drawer wall",
      detail: "Four in each, into the holes on their inner faces and bottom edges.",
      fix: [
        at("camScrew", [[xa, yS + 9, -150], [xa, yS + 9, 150], [xa, 650, zb + 9], [xa, yT - 9, zb + 40]], [-1, 0, 0], "SP", undefined, CAM_BOLT),
        ...wallFix("camScrew", (x) => [[[x + 9, yS + 18, -150], [x + 9, yS + 18, 0], [x + 9, yS + 18, 150], [x + 9, 650, zb + 18]], [0, 1, 0]], CAM_BOLT),
      ],
      tools: ["screwdriver"],
    },
    {
      title: n > 1 ? "Screw the outer runners to the side panel and the walls" : "Screw the outer runners to the side panel and the wall",
      detail: "Wheel at the front, two small screws in each.",
      fix: [
        ...dr.flatMap((d, i) => [
          at("runner", [[d.a, dy0 + 10, (dz0 + dz1) / 2]], [-1, 0, 0], i === 0 ? "SP" : walls[i - 1], undefined, RUNNER),
          at("runner", [[d.b, dy0 + 10, (dz0 + dz1) / 2]], [1, 0, 0], walls[i], undefined, RUNNER),
        ]),
        ...dr.flatMap((d, i) => [
          at("screw", [[d.a, dy0 + 10, dz0 + 60], [d.a, dy0 + 10, dz1 - 60]], [-1, 0, 0], i === 0 ? "SP" : walls[i - 1], undefined, SMALL),
          at("screw", [[d.b, dy0 + 10, dz0 + 60], [d.b, dy0 + 10, dz1 - 60]], [1, 0, 0], walls[i], undefined, SMALL),
        ]),
      ],
      tools: ["screwdriver"],
    },
    {
      title: n > 1 ? "Push the side panel and the walls onto the shelf" : "Push the side panel and the wall onto the shelf",
      detail: "Two dowels in the shelf's end go into the side panel. The walls stand on the shelf, in front of the back panel.",
      fix: [at("dowel", [[xa, yS + 9, -60], [xa, yS + 9, 60]], [1, 0, 0], "SH", "SP", DOWEL)],
      tools: ["hammer"],
    },
    {
      title: "Turn the cam locks",
      detail: "In the shelf, the back panel and the top strip, each clockwise until the joint pulls tight.",
      fix: [
        at("cam", [[xa + 34, yS + 18, -150], [xa + 34, yS + 18, 150]], [0, -1, 0], "SH", undefined, CAM),
        at("cam", [[xa + 34, 650, zb + 18]], [0, 0, -1], "BP", undefined, CAM),
        at("cam", [[xa + 34, yT, zb + 40]], [0, -1, 0], "TS", undefined, CAM),
        ...walls.map((_, i) => at("cam", [[wallX(i) - 25, yS + 18, -150], [wallX(i) - 25, yS + 18, 0], [wallX(i) - 25, yS + 18, 150]], [0, -1, 0], "SH", undefined, CAM)),
        ...walls.map((_, i) => at("cam", [[wallX(i) - 25, 650, zb + 18]], [0, 0, -1], "BP", undefined, CAM)),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the top edges",
      detail: n > 1 ? "Two in the side panel and two in the drawer wall at the end." : "Two in the side panel, two in the drawer wall.",
      fix: [at("dowel", [[-W / 2 + 9, yT, -150], [-W / 2 + 9, yT, 150]], [0, -1, 0], "SP", "TOP", DOWEL), at("dowel", [[xb - 9, yT, -150], [xb - 9, yT, 150]], [0, -1, 0], "DW", "TOP", DOWEL), ...(n > 1 ? [at("dowel", [[wallX(0) + 9, yT, 120]], [0, -1, 0], walls[0], "TOP", DOWEL)] : [])],
      tools: ["hammer"],
    },
    {
      title: "Screw the leg frame to the back with the steel strip",
      detail: "Hold the strip inside the frame's top bar and turn the three long screws through it into the back panel and the top strip.",
      add: ["LF"],
      fix: [at("plate", [[xl, 650, zb + 22]], [-1, 0, 0], "BP", "LF", { len: 4, dia: 40, name: "Steel strip" }), at("screw", [[xl + 25, yT - 9, zb + 40], [xl + 25, 680, zb + 9], [xl + 25, 610, zb + 9]], [-1, 0, 0], "LF", undefined, LONG)],
      tools: ["allen"],
    },
    {
      title: "Screw cam bolts into the underside of the top",
      detail: "Lay the top face down on a rug, then screw the bolts into the marked holes.",
      fix: [at("camScrew", [[-W / 2 + 9, yT, -60], [-W / 2 + 9, yT, 60], ...walls.flatMap((_, i) => [[wallX(i) + 9, yT, -60], [wallX(i) + 9, yT, 60]] as Vec3[])], [0, 1, 0], "TOP", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
      from: { TOP: [0, -400, 0] },
    },
    { title: "Turn the frame upside down onto the top", detail: "Lower it so every dowel and bolt finds its hole, the leg frame at the end with the cable hole.", people: 2, warnings: ["two"] },
    {
      title: "Lock the top on with cam locks",
      detail: "In the side panel and each wall, near the top edge.",
      fix: [at("cam", [[xa, yT - 34, -60], [xa, yT - 34, 60]], [-1, 0, 0], "SP", undefined, CAM), ...walls.map((id, i) => at("cam", [[wallX(i), yT - 34, -60], [wallX(i), yT - 34, 60]], [1, 0, 0], id, undefined, CAM))],
      tools: ["screwdriver"],
    },
    { title: "Stick the two glides under the side panel", fix: [at("glide", [[-W / 2 + 9, 0, -200], [-W / 2 + 9, 0, 200]], [0, 1, 0], "SP", undefined, { len: 4, dia: 30, name: "Glide" })] },
    {
      title: "Stand it up and fit the two bumpers at the back",
      detail: "They keep the top clear of the wall. One on the side panel, one on the leg frame.",
      fix: [at("glide", [[-W / 2 + 9, 650, zb], [xl + 12.5, 650, zb + 25]], [0, 0, 1], undefined, undefined, { len: 10, dia: 20, name: "Bumper" })],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    { title: n > 1 ? "Slide the drawers in" : "Slide the drawer in", detail: "Rest the drawer's runners on the outer ones, tilted down at the front, and push it in until it drops into place." },
    {
      title: "Push in the cable outlet and stick on the felt pads",
      detail: "The outlet goes in the hole at the back of the top. The pads go on the back of the drawer front, so it closes softly.",
      fix: [
        at("cap", [[W / 2 - 80, H, zb + 80]], [0, -1, 0], "TOP", undefined, { len: 15, dia: 60, name: "Cable outlet" }),
        at("glide", dr.flatMap((d) => (n > 1 ? [yS + 40] : [yS + 40, yT - 30]).flatMap((y) => [[d.a + 20, y, dz1], [d.b - 20, y, dz1]] as Vec3[])), [0, 0, 1], undefined, undefined, { len: 2, dia: 10, name: "Felt pad" }),
      ],
    },
  );
  return finish({ parts, steps });
}

/* ---------- the 105 desk: a cupboard with a small drawer at one end, a wide drawer and the leg frame ---------- */

/** One drawer of a MICKE desk in the bay between a and b: a front set in, two sides, a back and a bottom in grooves. */
function deskDrawer(parts: CustomPart[], k: string, a: number, b: number, yS: number, yT: number, zb: number, zf: number) {
  const dy0 = yS + 30, dy1 = yT - 25, dz0 = zb + 30, dz1 = zf - 38;
  const s0 = a + 13, s1 = b - 13;
  parts.push(P(`DF${k}`, "Drawer front", a + 2, b - 2, yS + 22, yT - 4, dz1, dz1 + 18));
  parts.push(P(`DL${k}`, "Drawer side", s0, s0 + 12, dy0, dy1, dz0, dz1));
  parts.push(P(`DR${k}`, "Drawer side", s1 - 12, s1, dy0, dy1, dz0, dz1));
  parts.push(P(`DB${k}`, "Drawer back", s0 + 12, s1 - 12, dy0 + 10, dy1, dz0, dz0 + 12));
  parts.push(P(`DT${k}`, "Drawer bottom", s0 + 12, s1 - 12, dy0 + 4, dy0 + 7, dz0 + 12, dz1, "fiber"));
  return { k, a, b, s0, s1, dy0, dy1, dz0, dz1, yM: (dy0 + dy1) / 2 };
}

const GLIDE2 = { len: 12, dia: 24, name: "Glide" };
const HEX = { len: 3, dia: 30, name: "Hexagonal pad" };

/**
 * IKEA's manual for the 105 desk: both drawers first, then the drawer shelf, back panel and top strip doweled into
 * one rail, the drawer wall and the cupboard's inner side locked onto its ends, the cupboard's back, bottom and outer
 * side added, the leg frame screwed up under the drawer wall, and the frame turned onto the top. Then the door,
 * two shelves and the pads.
 */
function desk105(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = 750, T = 25, D = 500;
  const yT = H - T, zb = -D / 2, zf = D / 2;
  const xo = -W / 2 + 18; // the outer side's inner face
  const xi0 = -W / 2 + 332, xi1 = xi0 + 18; // the cupboard's inner side
  const xw = W / 2 - 18; // the drawer wall's inner face, at the end of the desk
  const yS = 572; // the drawer shelf
  const yB = 50; // the cupboard bottom
  const yC = 520; // top of the cupboard's back panel and door, under the small drawer's opening
  const parts: CustomPart[] = [
    P("SH", "Drawer shelf", xi1, xw, yS, yS + 18, zb + 18, zf - 20),
    P("BP", "Back panel", xi1, xw, yS + 18, yT - 18, zb, zb + 18),
    P("TS", "Top strip", xi1, xw, yT - 18, yT, zb, zb + 80),
    P("DW", "Drawer wall", xw, W / 2, yS, yT, zb, zf),
    P("IS", "Inner side", xi0, xi1, 0, yT, zb, zf),
    P("CB", "Cupboard back", xo, xi0, yB, yC, zb, zb + 18),
    P("CF", "Cupboard bottom", xo, xi0, yB, yB + 18, zb + 18, zf - 18),
    P("OS", "Outer side", -W / 2, xo, 0, yT, zb, zf),
    P("TOP", "Desk top", -W / 2, W / 2, yT, H, zb, zf),
    P("DR", "Door", xo + 2, xi0 - 2, yB + 20, yC + 5, zf - 18, zf),
    P("SH1", "Shelf", xo, xi0, 200, 218, zb + 18, zf - 22),
    P("SH2", "Shelf", xo, xi0, 360, 378, zb + 18, zf - 22),
  ];
  const lx = W / 2 - 12.5, lz = D - 50, lh = yS;
  parts.push({
    id: "LF",
    name: "Leg frame",
    size: [25, lh, lz],
    pos: [lx, lh / 2, 0],
    material: "metal",
    pieces: [
      { shape: "box", size: [25, lh, 25], pos: [0, 0, -lz / 2 + 12.5] },
      { shape: "box", size: [25, lh, 25], pos: [0, 0, lz / 2 - 12.5] },
      { shape: "box", size: [25, 25, lz], pos: [0, -lh / 2 + 12.5, 0] },
      { shape: "box", size: [25, 25, lz], pos: [0, lh / 2 - 12.5, 0] },
    ],
  });
  const dr = [deskDrawer(parts, "0", xi1, xw, yS, yT, zb, zf), deskDrawer(parts, "1", xo, xi0, yS, yT, zb, zf)];
  const each = (f: (d: (typeof dr)[number]) => CustomFix[]) => dr.flatMap(f);
  const yRail = dr[0].dy0 + 10;

  const steps: CustomStep[] = [
    {
      title: "Screw two cam bolts into each drawer front",
      detail: "One wide drawer and one small one. Lay the fronts face down on a rug and turn the bolts in by hand.",
      fix: each((d) => [at("camScrew", [[d.s0 + 6, d.yM, d.dz1], [d.s1 - 6, d.yM, d.dz1]], [0, 0, 1], `DF${d.k}`, undefined, CAM_BOLT)]),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Tap a dowel into each drawer side and stand it on the front",
      detail: "The dowel goes into the front end of each side. Holes for the cam locks face in.",
      fix: each((d) => [at("dowel", [[d.s0 + 6, d.dy1 - 25, d.dz1]], [0, 0, -1], `DL${d.k}`, `DF${d.k}`, DOWEL), at("dowel", [[d.s1 - 6, d.dy1 - 25, d.dz1]], [0, 0, -1], `DR${d.k}`, `DF${d.k}`, DOWEL)]),
      tools: ["hammer"],
    },
    {
      title: "Turn the cam locks in the drawer sides",
      detail: "Arrow towards the bolt, then clockwise until the side pulls tight against the front.",
      fix: each((d) => [at("cam", [[d.s0 + 12, d.yM, d.dz1 - 34]], [-1, 0, 0], `DL${d.k}`, undefined, { len: 11, dia: 12 }), at("cam", [[d.s1 - 12, d.yM, d.dz1 - 34]], [1, 0, 0], `DR${d.k}`, undefined, { len: 11, dia: 12 })]),
      tools: ["screwdriver"],
    },
    { title: "Slide the bottoms into the grooves", detail: "Turn each drawer over. Smooth side up, all the way to the front.", add: ["DT0", "DT1"] },
    { title: "Fit the backs onto the drawers", detail: "Each back sits between the sides, over the end of the bottom.", add: ["DB0", "DB1"] },
    {
      title: "Screw the backs to the sides",
      detail: "One screw through each side into the end of the back.",
      fix: each((d) => [at("screw", [[d.s0, d.yM, d.dz0 + 6]], [1, 0, 0], `DL${d.k}`, `DB${d.k}`, { len: 25, dia: 4 }), at("screw", [[d.s1, d.yM, d.dz0 + 6]], [-1, 0, 0], `DR${d.k}`, `DB${d.k}`, { len: 25, dia: 4 })]),
      tools: ["screwdriver"],
    },
    {
      title: "Clip the inner runners onto the drawers",
      detail: "One along the bottom edge of each side, the wheel at the back.",
      fix: each((d) => [at("runner", [[d.s0, yRail, (d.dz0 + d.dz1) / 2]], [1, 0, 0], `DL${d.k}`, undefined, RUNNER), at("runner", [[d.s1, yRail, (d.dz0 + d.dz1) / 2]], [-1, 0, 0], `DR${d.k}`, undefined, RUNNER)]),
    },
    {
      title: "Screw the runners to the drawer sides",
      detail: "Two small screws in each.",
      fix: each((d) => [at("screw", [[d.s0, yRail, d.dz0 + 80], [d.s0, yRail, d.dz1 - 80]], [1, 0, 0], `DL${d.k}`, undefined, SMALL), at("screw", [[d.s1, yRail, d.dz0 + 80], [d.s1, yRail, d.dz1 - 80]], [-1, 0, 0], `DR${d.k}`, undefined, SMALL)]),
      tools: ["screwdriver"],
    },
    {
      title: "Tap two dowels into the drawer shelf and stand the back panel on it",
      detail: "Lay the shelf on a rug. The back panel stands on the dowels along its back edge.",
      add: ["SH", "BP"],
      fix: [at("dowel", [[xi1 + 150, yS + 18, zb + 9], [xw - 150, yS + 18, zb + 9]], [0, -1, 0], "SH", "BP", DOWEL)],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Tap two dowels into the back panel and press the top strip on",
      detail: "Its wide side goes to the front.",
      add: ["TS"],
      fix: [at("dowel", [[xi1 + 150, yT - 18, zb + 9], [xw - 150, yT - 18, zb + 9]], [0, -1, 0], "BP", "TS", DOWEL)],
      tools: ["hammer"],
    },
    {
      title: "Screw cam bolts into the drawer wall and the cupboard's inner side",
      detail: "Four in each, into the holes facing the drawer.",
      fix: [
        at("camScrew", [[xw, yS + 9, -150], [xw, yS + 9, 100], [xw, 650, zb + 9], [xw, yT - 9, zb + 40]], [1, 0, 0], "DW", undefined, CAM_BOLT),
        at("camScrew", [[xi1, yS + 9, -150], [xi1, yS + 9, 100], [xi1, 650, zb + 9], [xi1, yT - 9, zb + 40]], [-1, 0, 0], "IS", undefined, CAM_BOLT),
      ],
      tools: ["screwdriver"],
      wait: ["DW", "IS"],
    },
    {
      title: "Screw the outer runners for the wide drawer to them",
      detail: "One on each, wheel at the front, two small screws in each.",
      fix: [
        at("runner", [[xw, yRail, 0]], [1, 0, 0], "DW", undefined, RUNNER),
        at("runner", [[xi1, yRail, 0]], [-1, 0, 0], "IS", undefined, RUNNER),
        at("screw", [[xw, yRail, zb + 90], [xw, yRail, zf - 90]], [1, 0, 0], "DW", undefined, SMALL),
        at("screw", [[xi1, yRail, zb + 90], [xi1, yRail, zf - 90]], [-1, 0, 0], "IS", undefined, SMALL),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Push the drawer wall and the inner side onto the rail",
      detail: "A dowel in each end of the shelf. The bolts go into the holes in the ends of the shelf, back panel and strip.",
      add: ["DW", "IS"],
      fix: [at("dowel", [[xw, yS + 9, -40]], [-1, 0, 0], "SH", "DW", DOWEL), at("dowel", [[xi1, yS + 9, -40]], [1, 0, 0], "SH", "IS", DOWEL)],
      tools: ["hammer"],
    },
    {
      title: "Turn the eight cam locks",
      detail: "In the shelf, the back panel and the top strip, each clockwise until the joint pulls tight.",
      fix: [xw - 34, xi1 + 34].flatMap((x) => [
        at("cam", [[x, yS + 18, -150], [x, yS + 18, 100]], [0, -1, 0], "SH", undefined, CAM),
        at("cam", [[x, 650, zb + 18]], [0, 0, -1], "BP", undefined, CAM),
        at("cam", [[x, yT, zb + 40]], [0, -1, 0], "TS", undefined, CAM),
      ]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the outer runners for the small drawer on",
      detail: "One on the other face of the inner side, one inside the outer side. Two small screws in each.",
      fix: [
        at("runner", [[xi0, yRail, 0]], [1, 0, 0], "IS", undefined, RUNNER),
        at("runner", [[xo, yRail, 0]], [-1, 0, 0], "OS", undefined, RUNNER),
        at("screw", [[xi0, yRail, zb + 90], [xi0, yRail, zf - 90]], [1, 0, 0], "IS", undefined, SMALL),
        at("screw", [[xo, yRail, zb + 90], [xo, yRail, zf - 90]], [-1, 0, 0], "OS", undefined, SMALL),
      ],
      tools: ["screwdriver"],
      wait: ["OS"],
    },
    {
      title: "Screw the two hinge plates inside the outer side",
      detail: "Near its front edge, the marked side up. Two screws in each.",
      fix: [
        at("plate", [[xo, 120, zf - 40], [xo, 460, zf - 40]], [-1, 0, 0], "OS", undefined, { len: 12, dia: 36, name: "Mounting plate" }),
        at("screw", [[xo, 104, zf - 40], [xo, 136, zf - 40], [xo, 444, zf - 40], [xo, 476, zf - 40]], [-1, 0, 0], "OS", undefined, { len: 14, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw cam bolts in for the cupboard back",
      detail: "Two into the inner side and two into the outer side, near their back edges.",
      fix: [
        at("camScrew", [[xi0, 150, zb + 9], [xi0, 440, zb + 9]], [1, 0, 0], "IS", undefined, CAM_BOLT),
        at("camScrew", [[xo, 150, zb + 9], [xo, 440, zb + 9]], [-1, 0, 0], "OS", undefined, CAM_BOLT),
      ],
      tools: ["screwdriver"],
    },
    { title: "Push the cupboard back onto the inner side", detail: "Raw edge down. The bolts go into the holes in its end.", add: ["CB"] },
    {
      title: "Turn its two cam locks",
      fix: [at("cam", [[xi0 - 34, 150, zb + 18], [xi0 - 34, 440, zb + 18]], [0, 0, -1], "CB", undefined, CAM)],
      tools: ["screwdriver"],
    },
    {
      title: "Tap four dowels into the cupboard bottom and fit it",
      detail: "Two in each end, raw edge to the back. Push one end onto the inner side.",
      add: ["CF"],
      fix: [at("dowel", [[xi0, yB + 9, -120], [xi0, yB + 9, 120]], [-1, 0, 0], "CF", "IS", DOWEL), at("dowel", [[xo, yB + 9, -120], [xo, yB + 9, 120]], [1, 0, 0], "CF", "OS", DOWEL)],
      tools: ["hammer"],
    },
    { title: "Fit the outer side", detail: "Onto the dowels of the bottom and the bolts of the back.", add: ["OS"] },
    {
      title: "Turn the two cam locks at the outer side",
      fix: [at("cam", [[xo + 34, 150, zb + 18], [xo + 34, 440, zb + 18]], [0, 0, -1], "CB", undefined, CAM)],
      tools: ["screwdriver"],
    },
    {
      title: "Tap six dowels into the top edges",
      detail: "Two in each side and two in the drawer wall.",
      fix: [-W / 2 + 9, xi0 + 9, W / 2 - 9].map((x) => at("dowel", [[x, yT, -150], [x, yT, 150]], [0, -1, 0], undefined, "TOP", DOWEL)),
      tools: ["hammer"],
    },
    {
      title: "Screw the leg frame under the drawer wall",
      detail: "Three long screws up through the frame's top bar into the wall. Fit the steel strip onto the Allen key for more grip.",
      add: ["LF"],
      from: { LF: [0, -250, 0] },
      fix: [at("screw", [[lx, lh - 25, -150], [lx, lh - 25, 0], [lx, lh - 25, 150]], [0, 1, 0], "LF", "DW", LONG)],
      tools: ["allen"],
    },
    {
      title: "Screw six cam bolts into the underside of the top",
      detail: "Lay the top face down on a rug, then screw the bolts into the marked holes.",
      add: ["TOP"],
      fix: [at("camScrew", [-W / 2 + 9, xi0 + 9, W / 2 - 9].flatMap((x) => [[x, yT, -60], [x, yT, 60]] as Vec3[]), [0, 1, 0], "TOP", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
      from: { TOP: [0, -400, 0] },
    },
    { title: "Turn the frame upside down onto the top", detail: "Lower it so every dowel and bolt finds its hole, the drawer wall at the end with the cable hole.", people: 2, warnings: ["two"] },
    {
      title: "Lock the top on with six cam locks",
      detail: "Two in each side and two in the drawer wall, near the top edge.",
      fix: [
        at("cam", [[xo, yT - 34, -60], [xo, yT - 34, 60]], [-1, 0, 0], "OS", undefined, CAM),
        at("cam", [[xi0, yT - 34, -60], [xi0, yT - 34, 60]], [1, 0, 0], "IS", undefined, CAM),
        at("cam", [[xw, yT - 34, -60], [xw, yT - 34, 60]], [1, 0, 0], "DW", undefined, CAM),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Push the four glides into the cupboard sides",
      detail: "Into the pairs of holes in the bottom edges, front and back.",
      fix: [at("glide", [-W / 2 + 9, xi0 + 9].flatMap((x) => [[x, 0, -200], [x, 0, 200]] as Vec3[]), [0, 1, 0], undefined, undefined, GLIDE2)],
    },
    {
      title: "Stick the two pads under the leg frame",
      detail: "Use the hexagonal pads, not the round ones.",
      fix: [at("glide", [[lx, 0, -lz / 2 + 12.5], [lx, 0, lz / 2 - 12.5]], [0, 1, 0], "LF", undefined, HEX)],
    },
    { title: "Stand the desk up and slide the drawers in", detail: "Rest each drawer's runners on the outer ones, tilted down at the front, and push it in until it drops into place.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Screw the two hinges onto the door",
      detail: "Lay it face down. Two small screws in each hinge.",
      wait: ["DR"],
      fix: [
        at("hinge", [[xo + 25, 120, zf - 18], [xo + 25, 460, zf - 18]], [0, 0, 1], "DR", undefined, { len: 50, dia: 35 }),
        at("screw", [[xo + 25, 98, zf - 18], [xo + 25, 142, zf - 18], [xo + 25, 438, zf - 18], [xo + 25, 482, zf - 18]], [0, 0, 1], "DR", undefined, SMALL),
      ],
      tools: ["screwdriver"],
    },
    { title: "Hang the door", detail: "Slide each hinge onto its plate until it clicks, then tighten the screw. The hinge screws line the door up.", add: ["DR"], from: { DR: [0, 0, 350] }, tools: ["screwdriver"] },
    {
      title: "Push in eight shelf pins and lay the two shelves on them",
      detail: "At the heights you want, level on both sides.",
      add: ["SH1", "SH2"],
      fix: [200, 360].flatMap((y) => [at("pin", [[xo, y - 4, zb + 60], [xo, y - 4, zf - 70]], [-1, 0, 0], "OS", undefined), at("pin", [[xi0, y - 4, zb + 60], [xi0, y - 4, zf - 70]], [1, 0, 0], "IS", undefined)]),
    },
    {
      title: "Stick the two door bumpers on",
      detail: "On the front edge of the inner side, where the door closes.",
      fix: [at("glide", [[xi0 + 9, 120, zf], [xi0 + 9, 460, zf]], [0, 0, -1], "IS", undefined, { len: 2, dia: 10, name: "Bumper" })],
    },
    {
      title: "Push in the cable outlet and stick on the felt pads",
      detail: "The outlet goes in the hole at the back of the top. The pads go on the back of the drawer fronts, so they close softly.",
      fix: [
        at("cap", [[W / 2 - 250, H, zb + 90]], [0, -1, 0], "TOP", undefined, { len: 15, dia: 60, name: "Cable outlet" }),
        at("glide", dr.flatMap((d) => [[d.a + 20, yS + 40, d.dz1], [d.b - 20, yS + 40, d.dz1]] as Vec3[]), [0, 0, 1], undefined, undefined, { len: 2, dia: 10, name: "Felt pad" }),
      ],
    },
  ];
  return finish({ parts, steps });
}

/* ---------- corner workstation: a corner desk built on its top, then the add-on unit on it ---------- */

/**
 * IKEA's manual for the corner workstation, in two packages. The desk: a rail (bottom board, middle board and top
 * strip doweled together) locked to the side panel, a long board locked to the end panel, both laid on the face-down
 * top and cam-locked, the corner leg and the leg frame screwed on, glides and pads, stood up. The add-on unit: a
 * corner post, a top of three pieces on two inner uprights, a column at each end with its own top and outer upright,
 * a flap compartment and shelves on the left, shelves on the right, and two back panels screwed on from behind.
 */
function cornerWorkstation(): CustomParams {
  const yT = 725, H = 750, top = 1420;
  const t = 18;
  // the desk: the corner at the back left, one wing along the back wall to the side panel, one along the left wall
  // to the end panel over the leg frame
  const arc: [number, number][] = Array.from({ length: 13 }, (_, i) => {
    const a = -Math.PI / 2 - (i / 12) * (Math.PI / 2);
    return [350 + 350 * Math.cos(a), 350 + 350 * Math.sin(a)];
  });
  const lh = 585, lw = 450;
  const parts: CustomPart[] = [
    P("BS", "Rail bottom board", -51, 482, lh, lh + t, -110, -10),
    P("BW", "Rail middle board", -51, 482, lh + t, yT - t, -69, -51),
    P("BT", "Rail top strip", -51, 482, yT - t, yT, -110, -10),
    P("SP", "Side panel", 482, 500, 0, yT, -500, 0),
    P("EP", "End panel", -500, 0, lh, yT, 482, 500),
    P("LB", "Long board", -69, -51, lh, yT, -110, 482),
    {
      id: "TOP",
      name: "Desk top",
      size: [1000, 25, 1000],
      pos: [0, yT + 12.5, 0],
      pieces: [{ shape: "slab", size: [1000, 25, 1000], pos: [0, 0, 0], outline: [[-500, -500], [500, -500], [500, 0], ...arc, [0, 500], [-500, 500]] }],
    },
    P("PO", "Corner leg", -51, -1, 0, yT, -10, 40),
    {
      id: "LF",
      name: "Leg frame",
      size: [lw, lh, 25],
      pos: [-250, lh / 2, 487.5],
      material: "metal",
      pieces: [
        { shape: "box", size: [25, lh, 25], pos: [-lw / 2 + 12.5, 0, 0] },
        { shape: "box", size: [25, lh, 25], pos: [lw / 2 - 12.5, 0, 0] },
        { shape: "box", size: [lw, 25, 25], pos: [0, -lh / 2 + 12.5, 0] },
        { shape: "box", size: [lw, 25, 25], pos: [0, lh / 2 - 12.5, 0] },
      ],
    },
  ];
  // the add-on unit, 200 deep along both walls: middle top over the corner, a column at each end
  const yU = 1402, yC = 1384; // under the middle top; under the column tops
  parts.push(
    P("HP", "Post", -260, -210, H, yU, -260, -210),
    {
      id: "TC",
      name: "Corner top",
      size: [400, t, 400],
      pos: [-300, yU + t / 2, -300],
      pieces: [{ shape: "slab", size: [400, t, 400], pos: [0, 0, 0], outline: [[-200, -200], [200, -200], [200, 0], [0, 200], [-200, 200]] }],
    },
    P("TB", "Top piece", -100, 232, yU, top, -500, -300),
    P("TA", "Top piece", -500, -300, yU, top, -100, 232),
    P("RI", "Inner upright", 214, 232, H, yU, -500, -300),
    P("LI", "Inner upright", -500, -300, H, yU, 214, 232),
    P("CTL", "Column top", -500, -300, yC, yU, 232, 500),
    P("TR", "Tray", -500, -450, H, H + 50, 232, 482),
    P("LO", "Outer upright", -500, -300, H, yC, 482, 500),
    P("CTR", "Column top", 232, 500, yC, yU, -500, -300),
    P("RO", "Outer upright", 482, 500, H, yC, -500, -300),
    P("RS1", "Shelf", 232, 482, 960, 978, -500, -303),
    P("RS2", "Shelf", 232, 482, 1160, 1178, -500, -303),
    P("FB", "Flap bottom", -440, -302, 760, 778, 234, 480),
    P("FF", "Flap front", -320, -302, 778, 960, 234, 480),
    P("LS1", "Shelf", -500, -303, 1010, 1028, 232, 482),
    P("LS2", "Shelf", -500, -303, 1190, 1208, 232, 482),
    P("BKL", "Back panel", -503, -500, yT, top, -503, 500, "fiber"),
    P("BKB", "Back panel", -500, 500, yT, top, -503, -500, "fiber"),
  );

  const LONG7 = { len: 60, dia: 6, name: "Long screw" };
  const HW105 = { len: 12, dia: 4 }; // the hutch's small screws
  const TINY = { len: 16, dia: 3.5 }; // back panel screws
  const steps: CustomStep[] = [
    {
      title: "Tap three dowels into the rail bottom board and stand the middle board on it",
      detail: "Start with the first package. Lay the boards on a rug; the middle board stands on the dowels along the centre line.",
      add: ["BS", "BW"],
      fix: [at("dowel", [40, 215, 390].map((x): Vec3 => [x, lh + t, -60]), [0, -1, 0], "BS", "BW", DOWEL)],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Tap three dowels into the middle board and press the top strip on",
      add: ["BT"],
      fix: [at("dowel", [40, 215, 390].map((x): Vec3 => [x, yT - t, -60]), [0, -1, 0], "BW", "BT", DOWEL)],
      tools: ["hammer"],
    },
    {
      title: "Screw four cam bolts into the side panel",
      detail: "Into the holes near its top edge, on the inside.",
      fix: [at("camScrew", [[482, lh + 9, -90], [482, 630, -60], [482, 680, -60], [482, yT - 9, -90]], [1, 0, 0], "SP", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      wait: ["SP"],
    },
    { title: "Slide the rail onto the side panel", detail: "The bolts go into the holes in the rail's end.", add: ["SP"] },
    {
      title: "Turn the four cam locks in the rail",
      fix: [
        at("cam", [[448, lh + t, -90]], [0, -1, 0], "BS", undefined, CAM),
        at("cam", [[448, 630, -51], [448, 680, -51]], [0, 0, -1], "BW", undefined, CAM),
        at("cam", [[448, yT - t, -90]], [0, 1, 0], "BT", undefined, CAM),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw three cam bolts into the end panel",
      detail: "On its inside face, in the row of holes near one end.",
      add: ["EP"],
      fix: [at("camScrew", [610, 655, 700].map((y): Vec3 => [-60, y, 482]), [0, 0, 1], "EP", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
    },
    { title: "Push the long board onto the end panel", detail: "The bolts go into the holes in the board's end.", add: ["LB"] },
    {
      title: "Turn the three cam locks in the long board",
      fix: [at("cam", [610, 655, 700].map((y): Vec3 => [-51, y, 448]), [-1, 0, 0], "LB", undefined, CAM)],
      tools: ["screwdriver"],
    },
    {
      title: "Tap four dowels into the top edges",
      detail: "Two in the end panel, two in the side panel.",
      fix: [at("dowel", [[-400, yT, 491], [-150, yT, 491]], [0, -1, 0], "EP", "TOP", DOWEL), at("dowel", [[491, yT, -400], [491, yT, -150]], [0, -1, 0], "SP", "TOP", DOWEL)],
      tools: ["hammer"],
    },
    {
      title: "Screw six cam bolts into the underside of the top",
      detail: "Lay the top face down on a rug.",
      add: ["TOP"],
      fix: [at("camScrew", [[491, yT, -300], [491, yT, -60], [-450, yT, 491], [-250, yT, 491], [-60, yT, 100], [-60, yT, 350]], [0, 1, 0], "TOP", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
      from: { TOP: [0, -400, 0] },
    },
    { title: "Turn the end panel and long board over onto the top", detail: "Lower them so the dowels and bolts find their holes, the end panel at the end of the left wing." },
    {
      title: "Screw a cam bolt into the long board",
      detail: "Into the hole in its side where the rail meets it.",
      fix: [at("camScrew", [[-51, 655, -60]], [-1, 0, 0], "LB", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
    },
    { title: "Turn the side panel and rail over onto the top", detail: "The rail's end goes onto the bolt in the long board, the side panel onto its dowels and bolts." },
    {
      title: "Lock the side panel and end panel with four cam locks",
      fix: [at("cam", [[482, yT - 34, -300], [482, yT - 34, -60]], [1, 0, 0], "SP", undefined, CAM), at("cam", [[-450, yT - 34, 482], [-250, yT - 34, 482]], [0, 0, 1], "EP", undefined, CAM)],
      tools: ["screwdriver"],
    },
    {
      title: "Turn the three cam locks in the long board and the rail",
      fix: [at("cam", [[-51, yT - 34, 100], [-51, yT - 34, 350]], [-1, 0, 0], "LB", undefined, CAM), at("cam", [[-17, 655, -51]], [0, 0, -1], "BW", undefined, CAM)],
      tools: ["screwdriver"],
    },
    {
      title: "Tap two dowels into the corner leg and stand it on the top",
      detail: "In the corner between the long board and the rail.",
      add: ["PO"],
      fix: [at("dowel", [[-36, yT, 15], [-16, yT, 15]], [0, -1, 0], "PO", "TOP", DOWEL)],
      tools: ["hammer"],
    },
    {
      title: "Screw the long board to the leg and the rail",
      detail: "Four long screws through the long board. Fit the steel strip onto the Allen key for more grip.",
      fix: [at("screw", [[-69, 620, 15], [-69, 690, 15], [-69, lh + 9, -90], [-69, yT - 9, -90]], [1, 0, 0], "LB", undefined, LONG7)],
      tools: ["allen"],
    },
    {
      title: "Screw the leg frame onto the end panel",
      detail: "Three long screws through the frame's top bar into the edge of the end panel.",
      add: ["LF"],
      fix: [at("screw", [-400, -250, -100].map((x): Vec3 => [x, lh - 25, 487.5]), [0, 1, 0], "LF", "EP", LONG7)],
      tools: ["allen"],
    },
    {
      title: "Push the three glides in",
      detail: "Two into the bottom edge of the side panel, one into the end of the leg.",
      fix: [at("glide", [[491, 0, -450], [491, 0, -50], [-26, 0, 15]], [0, 1, 0], undefined, undefined, GLIDE2)],
    },
    { title: "Stick the two pads under the leg frame", detail: "Use the hexagonal pads, not the round ones.", fix: [at("glide", [[-475 + 12.5, 0, 487.5], [-25 - 12.5, 0, 487.5]], [0, 1, 0], "LF", undefined, HEX)] },
    {
      title: "Cover the spare holes in the side panel",
      detail: "Six round stickers over the holes that are left on its inside.",
      fix: [at("cap", [-400, -250, -100].flatMap((z): Vec3[] => [[482, 300, z], [482, 340, z]]), [1, 0, 0], "SP", undefined, { len: 1, dia: 14, name: "Cover sticker" })],
    },
    {
      title: "Stand the desk up and push in the cable outlet",
      fix: [at("cap", [[-150, H, -150]], [0, -1, 0], "TOP", undefined, { len: 15, dia: 60, name: "Cable outlet" })],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Stand the post in the corner of the desk",
      detail: "Now the second package. Two dowels into the desk top, two into the top of the post.",
      add: ["HP"],
      fix: [at("dowel", [[-245, H, -235], [-225, H, -235]], [0, -1, 0], "TOP", "HP", DOWEL), at("dowel", [[-245, yU, -235], [-225, yU, -235]], [0, -1, 0], "HP", "TC", DOWEL)],
      tools: ["hammer"],
    },
    {
      title: "Screw four cam bolts into the desk top",
      detail: "Where the four uprights will stand.",
      fix: [at("camScrew", [[-400, H, 491], [-400, H, 223], [223, H, -400], [491, H, -400]], [0, -1, 0], "TOP", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw a cam bolt into each straight top piece",
      detail: "Underneath, near the end away from the corner.",
      fix: [at("camScrew", [[-400, yU, 223]], [0, 1, 0], "TA", undefined, CAM_BOLT), at("camScrew", [[223, yU, -400]], [0, 1, 0], "TB", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      wait: ["TA", "TB"],
    },
    {
      title: "Join the three top pieces",
      detail: "Two dowels in each end of the corner piece, then press the straight pieces on.",
      fix: [at("dowel", [[-100, yU + 9, -460], [-100, yU + 9, -340]], [-1, 0, 0], "TC", "TB", DOWEL), at("dowel", [[-460, yU + 9, -100], [-340, yU + 9, -100]], [0, 0, -1], "TC", "TA", DOWEL)],
      tools: ["hammer"],
      wait: ["TC"],
    },
    {
      title: "Lock the right inner upright under the top",
      detail: "Its top edge onto the bolt under the straight piece, then turn the cam lock.",
      fix: [at("cam", [[214, yU - 34, -400]], [1, 0, 0], "RI", undefined, CAM)],
      tools: ["screwdriver"],
      wait: ["RI"],
    },
    {
      title: "Lower the top onto the post",
      detail: "The upright goes onto its bolt in the desk top at the same time.",
      add: ["TC", "TA", "TB", "RI"],
      from: { TC: [0, 300, 0], TA: [0, 300, 0], TB: [0, 300, 0], RI: [0, 300, 0] },
      people: 2,
      warnings: ["two"],
    },
    { title: "Turn the cam lock at the foot of the upright", fix: [at("cam", [[214, H + 34, -400]], [1, 0, 0], "RI", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Fit the left inner upright",
      detail: "Tilt it in: its top under the end of the left top piece, then swing the foot onto its bolt.",
      add: ["LI"],
      from: { LI: [0, 0, 250] },
    },
    { title: "Turn the two cam locks in the upright", detail: "One at the top, one at the foot.", fix: [at("cam", [[-400, yU - 34, 214], [-400, H + 34, 214]], [0, 0, 1], "LI", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Screw two cam bolts in for the left column top",
      detail: "One into the upright's outer face near the top, one under the column top near its outer end.",
      fix: [at("camScrew", [[-400, yC + 9, 232]], [0, 0, -1], "LI", undefined, CAM_BOLT), at("camScrew", [[-400, yC, 491]], [0, 1, 0], "CTL", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      wait: ["CTL"],
    },
    { title: "Tap three dowels into the end of the column top", fix: [at("dowel", [-470, -440, -330].map((x): Vec3 => [x, yC + 9, 232]), [0, 0, 1], "CTL", "LI", DOWEL)], tools: ["hammer"] },
    { title: "Slide the column top and the tray in", detail: "The column top onto the upright's dowels and bolt, the tray along the back on the desk top.", add: ["CTL", "TR"] },
    { title: "Turn the cam lock in the column top", fix: [at("cam", [[-400, yU, 266]], [0, -1, 0], "CTL", undefined, CAM)], tools: ["screwdriver"] },
    { title: "Fit the left outer upright", detail: "Tilt its top under the column top's bolt, then swing the foot onto its bolt and the tray's end.", add: ["LO"], from: { LO: [0, 0, 250] } },
    { title: "Turn its two cam locks", fix: [at("cam", [[-400, yC - 34, 482], [-400, H + 34, 482]], [0, 0, 1], "LO", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Screw two cam bolts in for the right column top",
      detail: "The same way: one into the upright, one under the column top.",
      fix: [at("camScrew", [[232, yC + 9, -400]], [-1, 0, 0], "RI", undefined, CAM_BOLT), at("camScrew", [[491, yC, -400]], [0, 1, 0], "CTR", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      wait: ["CTR"],
    },
    { title: "Tap three dowels into its end", fix: [at("dowel", [-470, -440, -330].map((z): Vec3 => [232, yC + 9, z]), [1, 0, 0], "CTR", "RI", DOWEL)], tools: ["hammer"] },
    { title: "Slide the right column top in", add: ["CTR"] },
    { title: "Turn the cam lock in the column top", fix: [at("cam", [[266, yU, -400]], [0, -1, 0], "CTR", undefined, CAM)], tools: ["screwdriver"] },
    { title: "Fit the right outer upright", detail: "Tilt it in under the column top, then onto the bolt in the desk top.", add: ["RO"], from: { RO: [250, 0, 0] } },
    { title: "Turn its two cam locks", fix: [at("cam", [[482, yC - 34, -400], [482, H + 34, -400]], [1, 0, 0], "RO", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Push in eight shelf pins and lay the right shelves on them",
      add: ["RS1", "RS2"],
      fix: [960, 1160].flatMap((y) => [at("pin", [[232, y - 4, -460], [232, y - 4, -340]], [-1, 0, 0], "RI", undefined), at("pin", [[482, y - 4, -460], [482, y - 4, -340]], [1, 0, 0], "RO", undefined)]),
    },
    {
      title: "Screw a flap fitting onto the flap bottom",
      detail: "Three small screws through its foot.",
      wait: ["FB", "FF"],
      fix: [at("hinge", [[-380, 769, 234]], [0, 0, 1], "FB", undefined, { len: 160, dia: 40, name: "Flap fitting" }), at("screw", [-420, -380, -340].map((x): Vec3 => [x, 778, 250]), [0, -1, 0], "FB", undefined, HW105)],
      tools: ["screwdriver"],
    },
    { title: "Slide on the flap front and the second fitting", fix: [at("hinge", [[-380, 769, 480]], [0, 0, -1], "FB", undefined, { len: 160, dia: 40, name: "Flap fitting" })] },
    { title: "Screw the second fitting on", detail: "Three small screws again.", fix: [at("screw", [-420, -380, -340].map((x): Vec3 => [x, 778, 464]), [0, -1, 0], "FB", undefined, HW105)], tools: ["screwdriver"] },
    { title: "Screw the fittings to the flap front", detail: "One screw through each fitting into the end of the front.", fix: [at("screw", [[-311, 900, 234]], [0, 0, 1], "FF", undefined, TINY), at("screw", [[-311, 900, 480]], [0, 0, -1], "FF", undefined, TINY)], tools: ["screwdriver"] },
    {
      title: "Screw the pivot bushings into the left column",
      detail: "One on each upright, low down near the front.",
      fix: [
        at("spacer", [[-330, 900, 232]], [0, 0, -1], "LI", undefined, { len: 6, dia: 14, name: "Bushing" }),
        at("spacer", [[-330, 900, 482]], [0, 0, 1], "LO", undefined, { len: 6, dia: 14, name: "Bushing" }),
        at("screw", [[-330, 900, 232]], [0, 0, -1], "LI", undefined, HW105),
        at("screw", [[-330, 900, 482]], [0, 0, 1], "LO", undefined, HW105),
      ],
      tools: ["screwdriver"],
    },
    { title: "Slide the flap compartment into the column", detail: "Open the fittings outwards so they pass the bushings, then push it back to the tray.", add: ["FB", "FF"], from: { FB: [300, 0, 0], FF: [300, 0, 0] } },
    {
      title: "Screw the fittings to the uprights",
      detail: "One screw at the back of each fitting.",
      fix: [at("screw", [[-420, 790, 232]], [0, 0, -1], "LI", undefined, TINY), at("screw", [[-420, 790, 482]], [0, 0, 1], "LO", undefined, TINY)],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the two stop screws and close the flap",
      fix: [at("stud", [[-330, 960, 232]], [0, 0, -1], "LI", undefined, { len: 14, dia: 8, name: "Stop screw" }), at("stud", [[-330, 960, 482]], [0, 0, 1], "LO", undefined, { len: 14, dia: 8, name: "Stop screw" })],
      tools: ["screwdriver"],
    },
    {
      title: "Push in eight shelf pins and lay the left shelves on them",
      add: ["LS1", "LS2"],
      fix: [1010, 1190].flatMap((y) => [at("pin", [[-460, y - 4, 232], [-340, y - 4, 232]], [0, 0, -1], "LI", undefined), at("pin", [[-460, y - 4, 482], [-340, y - 4, 482]], [0, 0, 1], "LO", undefined)]),
    },
    { title: "Fit the left back panel", detail: "Magnetic side to the front, behind the left column and the corner.", add: ["BKL"], from: { BKL: [-300, 0, 0] } },
    {
      title: "Screw it on from behind",
      detail: "Eleven screws, into the desk top, the uprights, the tops and the post side of the corner.",
      fix: [at("screw", ([[737, 400], [737, 100], [737, -300], [900, 491], [1250, 491], [900, 223], [1250, 223], [yC + 9, 360], [yU + 9, 100], [yU + 9, -150], [yU + 9, -400]] as [number, number][]).map(([y, z]): Vec3 => [-503, y, z]), [1, 0, 0], "BKL", undefined, TINY)],
      tools: ["screwdriver"],
    },
    { title: "Fit the right back panel", detail: "Magnetic side to the front, behind the right column and the corner.", add: ["BKB"], from: { BKB: [0, 0, -300] } },
    {
      title: "Screw it on from behind",
      detail: "Eleven screws again.",
      fix: [at("screw", ([[737, 400], [737, 100], [737, -300], [900, 491], [1250, 491], [900, 223], [1250, 223], [yC + 9, 360], [yU + 9, 100], [yU + 9, -150], [yU + 9, -400]] as [number, number][]).map(([y, x]): Vec3 => [x, y, -503]), [0, 0, 1], "BKB", undefined, TINY)],
      tools: ["screwdriver"],
    },
  ];
  return finish({ parts, steps });
}

/* ---------- drawer unit with drop-file storage ---------- */

const RAIL_SCREW = { len: 10, dia: 4, name: "Runner screw" };
const PUSH = { len: 40, dia: 8, name: "Push-in fastener" };

function drawerUnit(s: ProductSpec): CustomParams {
  // IKEA: 35 wide, 50 deep, 75 high; on five castors, one of them under the file drawer
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10, T = 18;
  const y0 = 58, yT = H - T; // the sides stand on the castors; underside of the top
  const xa = -W / 2 + T, xb = W / 2 - T, zb = -D / 2, zf = D / 2;
  const zr = zb + 18; // the back rails' back face, in front of the back panel
  const parts: CustomPart[] = [
    P("SL", "Side panel", -W / 2, xa, y0, yT, zb, zf),
    P("SR", "Side panel", xb, W / 2, y0, yT, zb, zf),
    P("BR0", "Back rail", xa, xb, y0, y0 + 100, zr, zr + 18),
    P("BR1", "Back rail", xa, xb, 330, 400, zr, zr + 18),
    P("BK", "Back panel", xa, xb, y0 + 10, yT, zb + 6, zb + 9, "fiber"),
    P("TOP", "Top", -W / 2, W / 2, yT, H, zb, zf),
  ];
  // three small drawers and the file drawer: fronts set in between the sides, boxes on runners 13 mm each side
  const s0 = xa + 13, s1 = xb - 13, dz0 = zb + 35, dz1 = zf - 18;
  const fronts: [number, number][] = [[615, 722], [485, 595], [355, 465], [62, 335]];
  const box = fronts.map(([a, b], i) => {
    const file = i === 3;
    const by0 = file ? 76 : a + 10, by1 = file ? 300 : b - 20;
    parts.push(P(`DF${i}`, file ? "File drawer front" : "Drawer front", xa + 2, xb - 2, a, b, dz1, zf));
    parts.push(P(`DL${i}`, file ? "File drawer side" : "Drawer side", s0, s0 + 12, by0, by1, dz0, dz1));
    parts.push(P(`DR${i}`, file ? "File drawer side" : "Drawer side", s1 - 12, s1, by0, by1, dz0, dz1));
    parts.push(P(`DT${i}`, file ? "File drawer bottom" : "Drawer bottom", s0 + 12, s1 - 12, by0 + 4, by0 + 7, dz0 + 12, dz1, "fiber"));
    parts.push(P(`DB${i}`, file ? "File drawer back" : "Drawer back", s0 + 12, s1 - 12, by0 + 10, by1, dz0, dz0 + 12));
    return { by0, by1, ym: (by0 + by1) / 2, rail: by0 + 12 };
  });
  const small = [0, 1, 2];
  const each = (ids: number[], f: (i: number) => CustomFix[]) => ids.flatMap(f);
  const sideOf = (sx: number) => (sx < 0 ? "SL" : "SR");
  const inner = (sx: number) => (sx < 0 ? xa : xb);
  const fileRail = box[3].by1 - 25;

  const steps: CustomStep[] = [
    {
      title: "Screw four cam bolts into the side panels",
      detail: "Lay both sides on a rug, inside up. Two into each, near the back edge.",
      fix: [-1, 1].map((sx) => at("camScrew", [[inner(sx), y0 + 50, zr + 9], [inner(sx), 365, zr + 9]], [-sx, 0, 0], sideOf(sx), undefined, CAM_BOLT)),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Pull the drop-file runners apart", detail: "Slide each runner out to its stop, press the catch and take the inner part off. It goes on the file drawer later." },
    {
      title: "Screw the drop-file runners to the sides",
      detail: "The outer parts, low down on each side. Three small screws in each, sliding the runner to reach them.",
      fix: [
        ...[-1, 1].map((sx) => at("runner", [[inner(sx), fileRail, 0]], [-sx, 0, 0], sideOf(sx), undefined, { len: 420, dia: 30, name: "Drop-file runner" })),
        // the screws go out through the runner into the side
        ...[-1, 1].map((sx) => at("screw", [-150, 40, 150].map((z): Vec3 => [inner(sx), fileRail, z]), [sx, 0, 0], sideOf(sx), undefined, { len: 12, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the drawer runners to the sides",
      detail: "Three on each side, wheel at the front. Two runner screws in each.",
      fix: [
        ...[-1, 1].map((sx) => at("runner", small.map((i): Vec3 => [inner(sx), box[i].rail, 0]), [-sx, 0, 0], sideOf(sx), undefined, RUNNER)),
        ...[-1, 1].map((sx) => at("screw", small.flatMap((i): Vec3[] => [[inner(sx), box[i].rail, -150], [inner(sx), box[i].rail, 170]]), [sx, 0, 0], sideOf(sx), undefined, RAIL_SCREW)),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Join the sides with the two back rails",
      detail: "Dowels in the rails' ends, then press one side on each end. Cam lock holes face in.",
      add: ["BR0", "BR1"],
      fix: [-1, 1].flatMap((sx) => [at("dowel", [[inner(sx), y0 + 50, zr + 9]], [sx, 0, 0], "BR0", sideOf(sx), DOWEL), at("dowel", [[inner(sx), 365, zr + 9]], [sx, 0, 0], "BR1", sideOf(sx), DOWEL)]),
      tools: ["hammer"],
    },
    {
      title: "Turn the cam locks in the rails",
      detail: "Four of them, arrow towards the bolt, then clockwise until tight.",
      fix: [-1, 1].flatMap((sx) => [at("cam", [[inner(sx) - sx * 34, y0 + 50, zr + 18]], [0, 0, -1], "BR0", undefined, { len: 13, dia: 15 }), at("cam", [[inner(sx) - sx * 34, 365, zr + 18]], [0, 0, -1], "BR1", undefined, { len: 13, dia: 15 })]),
      tools: ["screwdriver"],
    },
    { title: "Slide the back panel down into the grooves", detail: "Smooth white side to the front, all the way down to the bottom rail.", add: ["BK"], from: { BK: [0, 700, 0] } },
    { title: "Tap dowels into the top edges of the sides", detail: "Two in each.", fix: [-1, 1].map((sx) => at("dowel", [[sx * (W / 2 - 9), yT, -150], [sx * (W / 2 - 9), yT, 150]], [0, -1, 0], sideOf(sx), "TOP", DOWEL)), tools: ["hammer"] },
    {
      title: "Screw four cam bolts into the top",
      detail: "Lay it face down on the rug and screw them into the holes near the ends.",
      fix: [at("camScrew", [-1, 1].flatMap((sx) => [[sx * (W / 2 - 9), yT, -60], [sx * (W / 2 - 9), yT, 60]] as Vec3[]), [0, 1, 0], "TOP", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      wait: ["TOP"],
      warnings: ["floor"],
    },
    {
      title: "Put the top on and lock it",
      detail: "Press it onto the dowels and bolts, then turn the four cam locks in the sides.",
      add: ["TOP"],
      fix: [-1, 1].map((sx) => at("cam", [[inner(sx), yT - 34, -60], [inner(sx), yT - 34, 60]], [-sx, 0, 0], sideOf(sx), undefined, { len: 13, dia: 15 })),
      tools: ["screwdriver"],
      from: { TOP: [0, 350, 0] },
    },
    {
      title: "Clip the back panel to the sides",
      detail: "Four clips at the back, each pushed through its hole and locked with its wedge.",
      fix: [
        at("clip", [-1, 1].flatMap((sx) => [[inner(sx), 200, zb + 8], [inner(sx), 640, zb + 8]] as Vec3[]), [0, 0, -1], "BK", undefined, { len: 18, dia: 14, name: "Back clip" }),
        at("clip", [-1, 1].flatMap((sx) => [[inner(sx), 200, zb + 12], [inner(sx), 640, zb + 12]] as Vec3[]), [0, 0, -1], "BK", undefined, { len: 10, dia: 12, name: "Clip wedge" }),
      ],
    },
    {
      title: "Turn it upside down and knock in the castor sockets",
      detail: "One into the bottom edge of each side, near the corners. Tap them flush.",
      fix: [at("spacer", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (W / 2 - 9), y0, sz * (D / 2 - 40)])), [0, 1, 0], undefined, undefined, { len: 30, dia: 14, name: "Castor socket" })],
      pose: "-y",
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Click the two front castors in",
      detail: "A pin into each front socket until it clicks, then the castor onto the pin until it clicks.",
      fix: [
        at("stud", [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 9), y0, D / 2 - 40]), [0, 1, 0], undefined, undefined, { len: 40, dia: 8, name: "Castor pin" }),
        at("castor", [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 9), y0, D / 2 - 40]), [0, 1, 0], undefined, undefined, { len: 58, dia: 45, name: "Castor with brake" }),
      ],
    },
    {
      title: "Click the two back castors in",
      detail: "The same way at the back.",
      fix: [
        at("stud", [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 9), y0, -D / 2 + 40]), [0, 1, 0], undefined, undefined, { len: 40, dia: 8, name: "Castor pin" }),
        at("castor", [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 9), y0, -D / 2 + 40]), [0, 1, 0], undefined, undefined, { len: 58, dia: 45 }),
      ],
    },
    {
      title: "Screw two cam bolts into each small drawer front",
      detail: "Stand the unit up. Lay the three fronts face down on the rug; the bolts go near the ends.",
      fix: each(small, (i) => [at("camScrew", [[s0 + 6, box[i].ym, dz1], [s1 - 6, box[i].ym, dz1]], [0, 0, 1], `DF${i}`, undefined, CAM_BOLT)]),
      pose: "+y",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Stand the drawer sides on the fronts",
      detail: "A dowel in the front end of each side first, then press it into the front.",
      add: small.flatMap((i) => [`DL${i}`, `DR${i}`]),
      fix: each(small, (i) => [at("dowel", [[s0 + 6, box[i].by1 - 20, dz1]], [0, 0, 1], `DL${i}`, `DF${i}`, DOWEL), at("dowel", [[s1 - 6, box[i].by1 - 20, dz1]], [0, 0, 1], `DR${i}`, `DF${i}`, DOWEL)]),
      tools: ["hammer"],
    },
    {
      title: "Turn the cam locks in the drawer sides",
      detail: "Clockwise until each side pulls tight against its front.",
      fix: each(small, (i) => [at("cam", [[s0 + 12, box[i].ym, dz1 - 34]], [-1, 0, 0], `DL${i}`, undefined, CAM), at("cam", [[s1 - 12, box[i].ym, dz1 - 34]], [1, 0, 0], `DR${i}`, undefined, CAM)]),
      tools: ["screwdriver"],
    },
    { title: "Slide the bottoms into the grooves", detail: "Turn each drawer over first. White side up, all the way to the front.", add: small.map((i) => `DT${i}`) },
    {
      title: "Knock the backs on",
      detail: "The back sits on the end of the bottom. Two push-in fasteners through the sides into each back.",
      add: small.map((i) => `DB${i}`),
      fix: each(small, (i) => [at("nail", [[s0, box[i].ym, dz0 + 6]], [1, 0, 0], `DL${i}`, `DB${i}`, PUSH), at("nail", [[s1, box[i].ym, dz0 + 6]], [-1, 0, 0], `DR${i}`, `DB${i}`, PUSH)]),
      tools: ["hammer"],
    },
    { title: "Clip the inner runners onto the drawers", detail: "One along the bottom edge of each side, wheel at the back.", fix: each(small, (i) => [-1, 1].map((sx) => at("runner", [[sx < 0 ? s0 : s1, box[i].rail, 0]], [sx, 0, 0], sx < 0 ? `DL${i}` : `DR${i}`, undefined, RUNNER))) },
    { title: "Screw the runners to the drawer sides", detail: "Two runner screws in each.", fix: each(small, (i) => [-1, 1].map((sx) => at("screw", [[sx < 0 ? s0 : s1, box[i].rail, -120], [sx < 0 ? s0 : s1, box[i].rail, 150]], [-sx, 0, 0], sx < 0 ? `DL${i}` : `DR${i}`, undefined, RAIL_SCREW))), tools: ["screwdriver"] },
    { title: "Slide the three drawers in", detail: "Set the drawer's runners on the ones in the unit, tilt the front down a little and push it in until it drops into place." },
    {
      title: "Screw four cam bolts into the file drawer front",
      detail: "Face down on the rug.",
      fix: [at("camScrew", [[s0 + 6, 130], [s0 + 6, 250], [s1 - 6, 130], [s1 - 6, 250]].map(([x, y]): Vec3 => [x, y, dz1]), [0, 0, 1], "DF3", undefined, CAM_BOLT)],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Stand the file drawer's sides on the front",
      detail: "Two dowels in the end of each side first.",
      add: ["DL3", "DR3"],
      fix: [at("dowel", [[s0 + 6, 100, dz1], [s0 + 6, 280, dz1]], [0, 0, 1], "DL3", "DF3", DOWEL), at("dowel", [[s1 - 6, 100, dz1], [s1 - 6, 280, dz1]], [0, 0, 1], "DR3", "DF3", DOWEL)],
      tools: ["hammer"],
    },
    { title: "Turn the four cam locks", fix: [at("cam", [[s0 + 12, 130, dz1 - 34], [s0 + 12, 250, dz1 - 34]], [-1, 0, 0], "DL3", undefined, CAM), at("cam", [[s1 - 12, 130, dz1 - 34], [s1 - 12, 250, dz1 - 34]], [1, 0, 0], "DR3", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Slide the bottom in and knock the back on",
      detail: "Bottom into the grooves, then the back over its end with four push-in fasteners through the sides.",
      add: ["DT3", "DB3"],
      fix: [at("nail", [[s0, 130, dz0 + 6], [s0, 250, dz0 + 6]], [1, 0, 0], "DL3", "DB3", PUSH), at("nail", [[s1, 130, dz0 + 6], [s1, 250, dz0 + 6]], [-1, 0, 0], "DR3", "DB3", PUSH)],
      tools: ["hammer"],
    },
    {
      title: "Screw the castor bracket under the front",
      detail: "Turn the drawer upside down. Two screws into the front, one into the bottom.",
      fix: [
        at("plate", [[0, 62, zf - 30]], [0, 1, 0], "DF3", undefined, { len: 50, dia: 30, name: "Castor bracket" }),
        at("screw", [[-25, 62, zf - 9], [25, 62, zf - 9]], [0, 1, 0], "DF3", undefined, { len: 14, dia: 5 }),
        at("screw", [[0, 62, zf - 4]], [0, 1, 0], "DF3", undefined, { len: 16, dia: 4 }),
      ],
      pose: "-y",
      tools: ["screwdriver"],
    },
    { title: "Click the last castor onto the bracket", detail: "Press it onto the bracket's pin until it clicks.", fix: [at("castor", [[0, 62, zf - 30]], [0, 1, 0], "DF3", undefined, { len: 58, dia: 45 })] },
    {
      title: "Screw the drop-file runners to the drawer",
      detail: "Stand it up. The inner parts along the top of the sides, three small screws in each.",
      fix: [
        ...[-1, 1].map((sx) => at("runner", [[sx < 0 ? s0 : s1, fileRail, 0]], [sx, 0, 0], sx < 0 ? "DL3" : "DR3", undefined, { len: 420, dia: 30, name: "Drop-file runner" })),
        ...[-1, 1].map((sx) => at("screw", [-115, 75, 185].map((z): Vec3 => [sx < 0 ? s0 : s1, fileRail, z]), [-sx, 0, 0], sx < 0 ? "DL3" : "DR3", undefined, { len: 12, dia: 4 })),
      ],
      pose: "+y",
      tools: ["screwdriver"],
    },
    { title: "Push the four frame holders into the sides", detail: "Two near the top edge of each side.", fix: [at("clip", [-1, 1].flatMap((sx) => [-150, 150].map((z): Vec3 => [sx < 0 ? s0 + 12 : s1 - 12, box[3].by1 - 10, z])), [0, 0, 1], undefined, undefined, { len: 25, dia: 12, name: "Frame holder" })] },
    { title: "Hang the two file frames in", detail: "Snap each wire frame into a holder on both sides.", fix: [at("hook", [-150, 150].map((z): Vec3 => [0, box[3].by1 + 10, z]), [0, -1, 0], "DT3", undefined, { len: 250, dia: 20, name: "File frame" })] },
    { title: "Slide the file drawer in", detail: "Set it on the runners and push it in. To take it out, pull it all the way and lift the catches on the runners." },
  ];
  return finish({ parts, steps });
}

/** Parts that first show up holding their dowels or bolts are listed on the last step too, so none is added twice. */
function finish(c: CustomParams): CustomParams {
  const added = new Set(c.steps.flatMap((st) => st.add ?? []));
  const rest = c.parts.filter((p) => !added.has(p.id)).map((p) => p.id);
  const last = c.steps[c.steps.length - 1];
  last.add = [...(last.add ?? []), ...rest];
  return c;
}

function recipe(s: ProductSpec): CustomParams | null {
  const v = s.variant.toLowerCase();
  if (/^desk/.test(v) && (s.size.w < 80 || s.size.w > 130)) return desk(s);
  if (/^desk/.test(v)) return desk105(s);
  if (/corner workstation/.test(v)) return cornerWorkstation();
  if (/drawer unit with drop-file/.test(v)) return drawerUnit(s);
  return null;
}

const family: Family = { names: ["MICKE"], recipe };
export default family;
