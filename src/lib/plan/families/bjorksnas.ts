import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * BJÖRKSNÄS (solid birch and birch veneer), read from its manuals.
 * Bedside table: two ready-made side frames (round legs, an upper side rail and a lower rail with holes) get their
 * cam bolts and runners lying on a rug. The back rail goes on with dowels and cam locks, six round slats drop into
 * the lower rail, the other frame goes on top and the slats are screwed from outside. Standing, the top goes on cam
 * bolts. The drawer is a front with cam bolts, two sides, a bottom slid in and a back screwed on, with a leather pull.
 */

function bedside(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 22, LG = 34;
  const xl = W / 2 - 22 - LG / 2, zl = D / 2 - 22 - LG / 2; // legs, middle
  const yTop = H - TT;
  const AH = 150, AT = 20; // upper rails
  const yA = yTop - AH / 2;
  const yR = 190; // the lower rail and the slats
  const frame: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [LG, yTop, LG], pos: [0, 0, sz * zl] })),
    { shape: "box", size: [AT, AH, 2 * zl - LG], pos: [0, yA - yTop / 2, 0] },
    { shape: "box", size: [26, 34, 2 * zl - LG], pos: [0, yR - yTop / 2, 0] },
  ];
  const xi = xl - AT / 2; // inside faces of the side rails
  const slatZ = Array.from({ length: 6 }, (_, i) => -zl + 40 + ((2 * zl - 80) * i) / 5);
  const dw = 2 * xi - 26; // drawer box between the runners
  const dz0 = -zl + 10, dz1 = zl + LG / 2 - 20; // drawer box, back to the back of the front
  const yD = yA;
  const parts: CustomPart[] = [
    { id: "FL", name: "Side frame", size: [LG, yTop, 2 * zl + LG], pos: [-xl, yTop / 2, 0], material: "wood", pieces: frame },
    { id: "BA", name: "Back rail", size: [2 * xi, AH, AT], pos: [0, yA, -zl], material: "wood" },
    ...slatZ.map((z, i): CustomPart => ({ id: `R${i}`, name: i === 0 || i === 5 ? "Shelf rail" : "Slat", size: [2 * (xl - 13), i === 0 || i === 5 ? 26 : 20, i === 0 || i === 5 ? 26 : 20], pos: [0, yR, z], shape: "cyl", material: "wood" })),
    { id: "FR", name: "Side frame", size: [LG, yTop, 2 * zl + LG], pos: [xl, yTop / 2, 0], material: "wood", pieces: frame },
    { id: "TOP", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    { id: "DF", name: "Drawer front", size: [2 * xi - 4, AH - 6, 20], pos: [0, yD, dz1 + 10], material: "wood" },
    ...[-1, 1].map((sx): CustomPart => ({ id: `DS${sx}`, name: "Drawer side", size: [14, 110, dz1 - dz0], pos: [sx * (dw / 2 - 7), yD - 10, (dz0 + dz1) / 2], material: "wood" })),
    { id: "DB", name: "Drawer bottom", size: [dw - 28, 4, dz1 - dz0 - 14], pos: [0, yD - 58, (dz0 + dz1) / 2 + 7], material: "fiber" },
    { id: "DK", name: "Drawer back", size: [dw - 28, 96, 14], pos: [0, yD - 3, dz0 + 7], material: "wood" },
  ];
  const sides = [-1, 1];
  const fid = (sx: number) => (sx < 0 ? "FL" : "FR");
  const camBolt = (sx: number, ys: number[], z: number, on: string): CustomFix => ({ kind: "camScrew", count: ys.length, at: ys.map((y): Vec3 => [sx * xi, y, z]), dir: [-sx, 0, 0], on });
  const camLock = (sx: number, ys: number[], on: string): CustomFix => ({ kind: "cam", count: ys.length, at: ys.map((y): Vec3 => [sx * (xi - 40), y, -zl + AT / 2]), dir: [0, 0, -1], on });
  const backYs = [yA - 45, yA + 45];
  const runner = (sx: number): CustomFix[] => [
    { kind: "runner", count: 1, len: 300, dia: 35, at: [[sx * xi, yD, 0]], dir: [-sx, 0, 0], on: fid(sx) },
    { kind: "screw", count: 2, len: 12, dia: 5, at: [-100, 100].map((z): Vec3 => [sx * (xi - 3), yD, z]), dir: [sx, 0, 0], on: fid(sx) },
  ];
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the side frames",
      detail: "Lay both frames on a rug, rails up. Two into the back of each upper rail.",
      fix: [camBolt(-1, backYs, -zl + 30, "FL")],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw a runner onto each side frame",
      detail: "Inside the upper rail, flush with its front edge, two screws each. The two runners are a left and a right.",
      fix: runner(-1),
      tools: ["screwdriver"],
    },
    {
      title: "Stand the back rail on one frame",
      detail: "Tap two dowels into the frame's upper rail, then push the back rail down onto them and its cam bolts.",
      add: ["FL", "BA"],
      fix: [{ kind: "dowel", count: 2, len: 30, dia: 8, at: [yA - 20, yA + 20].map((y): Vec3 => [-xi, y, -zl]), dir: [-1, 0, 0], on: "FL", mate: "BA" }],
      tools: ["hammer"],
    },
    { title: "Lock the back rail", detail: "Two cam locks, arrow towards the bolt, turned until they pull tight.", fix: [camLock(-1, backYs, "BA")], tools: ["screwdriver"] },
    {
      title: "Stand the two shelf rails in the frame",
      detail: "Into the outer holes of the lower rail, then one screw through the rail into each.",
      add: ["R0", "R5"],
      fix: [{ kind: "screw", count: 2, len: 40, dia: 4, at: [slatZ[0], slatZ[5]].map((z): Vec3 => [-xl - 13, yR, z]), dir: [1, 0, 0], on: "FL" }],
      tools: ["screwdriver"],
    },
    { title: "Drop in the slats", detail: "The four thinner slats go into the holes between them.", add: ["R1", "R2", "R3", "R4"] },
    {
      title: "Lay the other side frame on top",
      detail: "Its cam bolts and runner go in first, as on the first frame. Guide every slat and the back rail into its holes, then press it down.",
      add: ["FR"],
      fix: [camBolt(1, backYs, -zl + 30, "FR"), ...runner(1)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the shelf rails to this frame",
      detail: "One screw through the lower rail into each shelf rail.",
      fix: [{ kind: "screw", count: 2, len: 40, dia: 4, at: [slatZ[0], slatZ[5]].map((z): Vec3 => [xl + 13, yR, z]), dir: [-1, 0, 0], on: "FR" }],
      tools: ["screwdriver"],
    },
    { title: "Lock the back rail to this frame", detail: "Two more cam locks.", fix: [camLock(1, backYs, "BA")], tools: ["screwdriver"] },
    {
      title: "Stand it up and tap in the dowels",
      detail: "Three dowels into the tops of the upper rails, for the top.",
      fix: ([[-xl, 0, "FL"], [xl, 0, "FR"], [0, -zl, "BA"]] as const).map(([x, z, on]): CustomFix => ({ kind: "dowel", count: 1, len: 30, dia: 8, at: [[x, yTop, z]], dir: [0, -1, 0], on, mate: "TOP" })),
      tools: ["hammer"],
      pose: "+y",
    },
    {
      title: "Fit the top",
      detail: "Screw six cam bolts into its underside, turn it over and lower it onto the dowels.",
      add: ["TOP"],
      fix: [{ kind: "camScrew", count: 6, at: [...sides.flatMap((sx) => [-zl + 60, zl - 60].map((z): Vec3 => [sx * xl, yTop, z])), [-120, yTop, -zl], [120, yTop, -zl]], dir: [0, 1, 0], on: "TOP" }],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the top",
      detail: "Six cam locks from inside the upper rails.",
      fix: [
        ...sides.map((sx): CustomFix => ({ kind: "cam", count: 2, at: [-zl + 60, zl - 60].map((z): Vec3 => [sx * xi, yTop - 30, z]), dir: [sx, 0, 0], on: fid(sx) })),
        { kind: "cam", count: 2, at: [-120, 120].map((x): Vec3 => [x, yTop - 30, -zl + AT / 2]), dir: [0, 0, -1], on: "BA" },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the cam bolts into the drawer front",
      detail: "Lay it face down on the rug. Four bolts, two near each end.",
      fix: [{ kind: "camScrew", count: 4, at: sides.flatMap((sx) => [yD - 45, yD + 25].map((y): Vec3 => [sx * (dw / 2 - 7), y, dz1])), dir: [0, 0, 1], on: "DF" }],
      tools: ["screwdriver"],
    },
    { title: "Push the drawer sides onto the front", detail: "Grooves facing in and down.", add: ["DS-1", "DS1"] },
    {
      title: "Lock the drawer sides",
      detail: "Four cam locks, two in each side.",
      fix: sides.map((sx): CustomFix => ({ kind: "cam", count: 2, at: [yD - 45, yD + 25].map((y): Vec3 => [sx * (dw / 2 - 14), y, dz1 - 30]), dir: [sx, 0, 0], on: `DS${sx}` })),
      tools: ["screwdriver"],
    },
    { title: "Slide in the drawer bottom", detail: "Along the grooves until it meets the front.", add: ["DB"], from: { DB: [0, 0, -300] } },
    {
      title: "Screw on the drawer back",
      detail: "Its lower edge over the bottom, two long screws through each side.",
      add: ["DK"],
      fix: sides.map((sx): CustomFix => ({ kind: "screw", count: 2, len: 40, dia: 4, at: [yD - 30, yD + 5].map((y): Vec3 => [sx * (dw / 2), y, dz0 + 7]), dir: [-sx, 0, 0], on: `DS${sx}` })),
      tools: ["screwdriver"],
    },
    {
      title: "Fit the leather pull",
      detail: "Fold the strap, push the bolt through the front from outside and the barrel nut from inside, then tighten.",
      fix: [{ kind: "handle", name: "Leather pull", count: 1, at: [[0, yD + 30, dz1 + 20]], dir: [0, 0, -1], on: "DF" }],
      tools: ["screwdriver"],
    },
    { title: "Slide in the drawer", detail: "Pull the runners out, set the drawer on them and push it in until it closes." },
  ];
  return { parts, steps };
}

interface Drawer {
  id: string;
  x: number; // middle
  w: number; // front width
  y: number; // middle of the front
  straps: number;
}

/** A drawer from its own manual: dowels in the sides, cam bolts in the front and back, the bottom slid in. */
function drawerParts(d: Drawer, h: number, zf: number, zb: number, gap: number): CustomPart[] {
  const bw = d.w - 2 * gap; // the box between its runners
  const hb = h - 40;
  const yb = d.y - h / 2 + 10; // box bottom
  return [
    { id: `${d.id}F`, name: "Drawer front", size: [d.w, h, 20], pos: [d.x, d.y, zf + 10], material: "wood" },
    ...[-1, 1].map((sx): CustomPart => ({ id: `${d.id}S${sx}`, name: "Drawer side", size: [14, hb, zf - zb], pos: [d.x + sx * (bw / 2 - 7), yb + hb / 2, (zf + zb) / 2], material: "wood" })),
    { id: `${d.id}B`, name: "Drawer bottom", size: [bw - 28, 4, zf - zb - 14], pos: [d.x, yb + 10, (zf + zb) / 2 - 7], material: "fiber" },
    { id: `${d.id}K`, name: "Drawer back", size: [bw - 28, hb - 20, 14], pos: [d.x, yb + 10 + (hb - 20) / 2, zb + 7], material: "wood" },
  ];
}

function drawerSteps(ds: Drawer[], h: number, zf: number, zb: number, gap: number, what: string): CustomStep[] {
  const sideX = (d: Drawer, sx: number) => d.x + sx * ((d.w - 2 * gap) / 2 - 7);
  const ys = (d: Drawer) => [d.y - h / 2 + 40, d.y + h / 2 - 50];
  const n = ds.length;
  return [
    {
      title: `Tap the dowels into the ${what} sides`,
      detail: "On a rug, two into each end of every side.",
      fix: ds.flatMap((d) => [-1, 1].map((sx): CustomFix => ({ kind: "dowel", count: 2, at: ys(d).map((y): Vec3 => [sideX(d, sx), y, zf]), dir: [0, 0, -1], on: `${d.id}S${sx}`, mate: `${d.id}F` }))),
      tools: ["hammer"],
      repeat: n > 1 ? n : undefined,
    },
    {
      title: `Stand the sides on the ${what} fronts`,
      detail: "Screw four cam bolts into each front first, lay it face down and push the sides onto the bolts and dowels, grooves facing in.",
      add: ds.flatMap((d) => [`${d.id}F`, `${d.id}S-1`, `${d.id}S1`]),
      fix: ds.map((d): CustomFix => ({ kind: "camScrew", count: 4, at: [-1, 1].flatMap((sx) => ys(d).map((y): Vec3 => [sideX(d, sx), y + 20, zf])), dir: [0, 0, 1], on: `${d.id}F` })),
      tools: ["screwdriver"],
      repeat: n > 1 ? n : undefined,
    },
    {
      title: "Lock the sides to the front",
      detail: "Four cam locks in each drawer, turned until they pull tight.",
      fix: ds.flatMap((d) => [-1, 1].map((sx): CustomFix => ({ kind: "cam", count: 2, at: ys(d).map((y): Vec3 => [sideX(d, sx) - sx * 7, y + 20, zf - 30]), dir: [sx, 0, 0], on: `${d.id}S${sx}` }))),
      tools: ["screwdriver"],
    },
    { title: "Slide in the drawer bottoms", detail: "Down the grooves until they meet the front.", add: ds.map((d) => `${d.id}B`), from: Object.fromEntries(ds.map((d) => [`${d.id}B`, [0, 0, -400] as Vec3])) },
    {
      title: `Fit the ${what} backs`,
      detail: "Four cam bolts in each back. Angle it in between the sides, one end first, then four cam locks.",
      add: ds.map((d) => `${d.id}K`),
      from: Object.fromEntries(ds.map((d) => [`${d.id}K`, [220, 220, 0] as Vec3])),
      fix: [
        ...ds.flatMap((d) => [-1, 1].map((sx): CustomFix => ({ kind: "camScrew", count: 2, at: ys(d).map((y): Vec3 => [sideX(d, sx) - sx * 7, y + 10, zb + 7]), dir: [-sx, 0, 0], on: `${d.id}K` }))),
        ...ds.map((d): CustomFix => ({ kind: "cam", count: 4, at: [-1, 1].flatMap((sx) => ys(d).map((y): Vec3 => [sideX(d, sx) - sx * 7, y + 10, zb + 40])), dir: [1, 0, 0], on: `${d.id}S${-1}` })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: n > 2 ? "Fit two leather pulls to each front" : "Fit a leather pull to each front",
      detail: "Screw the strap to the front through its top hole, fold it down and bolt it through the bottom hole.",
      fix: ds.flatMap((d) =>
        Array.from({ length: d.straps }, (_, i): CustomFix => ({ kind: "handle", name: "Leather pull", count: 1, at: [[d.x + (d.straps === 1 ? 0 : (i ? 1 : -1) * d.w * 0.26), d.y + 20, zf + 20]], dir: [0, 0, -1], on: `${d.id}F` })),
      ),
      tools: ["screwdriver"],
    },
  ];
}

function chest(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 22, LG = 40;
  const xl = W / 2 - 15 - LG / 2, zl = D / 2 - 15 - LG / 2;
  const yTop = H - TT;
  const y0 = 120, yB = y0 + 20; // bottom panel
  const xi = xl - 9; // inside faces of the side panels
  const ri = 60; // top rails
  const frame: PartPiece[] = [
    ...[-1, 1].map((sz): PartPiece => ({ shape: "cyl", size: [LG, yTop, LG], pos: [0, 0, sz * zl] })),
    { shape: "box", size: [18, yTop - y0, 2 * zl - LG], pos: [0, (y0 + yTop) / 2 - yTop / 2, 0] },
  ];
  const rows = 4, gap = 8;
  const fh = (yTop - ri - yB - (rows + 1) * gap) / rows;
  const rowY = (r: number) => yB + gap + fh / 2 + r * (fh + gap); // r from the bottom
  const zf = zl - 20, zb = -zl + 20;
  const big: Drawer[] = [0, 1, 2].map((r) => ({ id: `L${r}`, x: 0, w: 2 * xi - 4, y: rowY(r), straps: 2 }));
  const sw = (2 * xi - 18) / 2 - 4;
  const small: Drawer[] = [-1, 1].map((sx) => ({ id: `M${sx}`, x: sx * (9 + 2 + sw / 2), w: sw, y: rowY(3), straps: 1 }));
  const parts: CustomPart[] = [
    { id: "FL", name: "Side frame", size: [LG, yTop, 2 * zl + LG], pos: [-xl, yTop / 2, 0], material: "wood", pieces: frame },
    { id: "TF", name: "Top rail", size: [2 * xi, ri, 20], pos: [0, yTop - ri / 2, zl], material: "wood" },
    { id: "TB", name: "Top rail", size: [2 * xi, ri, 20], pos: [0, yTop - ri / 2, -zl], material: "wood" },
    { id: "BK", name: "Back panel", size: [2 * xi, yTop - ri - yB, 12], pos: [0, (yTop - ri + yB) / 2, -zl], material: "wood" },
    { id: "BO", name: "Bottom panel", size: [2 * xi, 20, 2 * zl - 30], pos: [0, y0 + 10, 0], material: "wood" },
    { id: "FR", name: "Side frame", size: [LG, yTop, 2 * zl + LG], pos: [xl, yTop / 2, 0], material: "wood", pieces: frame },
    { id: "TOP", name: "Top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "wood" },
    { id: "DV", name: "Divider", size: [18, fh + 2 * gap, 2 * zl - 40], pos: [0, rowY(3), 0], material: "wood" },
    ...big.flatMap((d) => drawerParts(d, fh, zf, zb, 13)),
    ...small.flatMap((d) => drawerParts(d, fh, zf, zb, 13)),
  ];
  const sides = [-1, 1];
  const fid = (sx: number) => (sx < 0 ? "FL" : "FR");
  // one cam bolt in the middle of each rail end, a dowel above and below it
  const railYs = [yTop - ri / 2];
  const camBolts = (sx: number): CustomFix => ({ kind: "camScrew", count: 2, at: [zl, -zl].flatMap((z) => railYs.map((y): Vec3 => [sx * xi, y, z])), dir: [-sx, 0, 0], on: fid(sx) });
  const camLocks = (sx: number): CustomFix[] => [
    { kind: "cam", count: 1, at: railYs.map((y): Vec3 => [sx * (xi - 35), y, zl - 10]), dir: [0, 0, -1], on: "TF" },
    { kind: "cam", count: 1, at: railYs.map((y): Vec3 => [sx * (xi - 35), y, -zl + 10]), dir: [0, 0, 1], on: "TB" },
  ];
  const longScrews = (sx: number): CustomFix => ({ kind: "screw", name: "Long screw", count: 3, len: 70, dia: 6, at: [-zl + 60, 0, zl - 60].map((z): Vec3 => [sx * (xl + 9), y0 + 10, z]), dir: [-sx, 0, 0], on: fid(sx), mate: "BO" });
  const runnerYs = [0, 1, 2, 3].map((r) => rowY(r) - fh / 2 + 25);
  const runners = (sx: number): CustomFix[] => [
    { kind: "runner", count: 4, len: 400, dia: 35, at: runnerYs.map((y): Vec3 => [sx * xi, y, 0]), dir: [-sx, 0, 0], on: fid(sx) },
    { kind: "screw", count: 8, len: 12, dia: 5, at: runnerYs.flatMap((y) => [-150, 150].map((z): Vec3 => [sx * (xi - 3), y, z])), dir: [sx, 0, 0], on: fid(sx) },
  ];
  const wallX = [-1, 1].map((sx) => sx * (xi - 120));
  const steps: CustomStep[] = [
    { title: "Screw the cam bolts into the side frames", detail: "Lay both frames on a rug, inside up. Two in each, by the top.", fix: [camBolts(-1)], tools: ["screwdriver"], pose: "+x", warnings: ["floor"] },
    { title: "Screw the runners onto the side frames", detail: "Four on each frame, two screws in each. The left and right runners are different.", fix: runners(-1), tools: ["screwdriver"] },
    {
      title: "Stand the top rails on one frame",
      detail: "Tap two dowels into the ends of each rail and push them onto the frame's dowel holes and cam bolts.",
      add: ["FL", "TF", "TB"],
      fix: [{ kind: "dowel", count: 4, at: [zl, -zl].flatMap((z) => [yTop - ri / 2 + 23, yTop - ri / 2 - 23].map((y): Vec3 => [-xi, y, z])), dir: [-1, 0, 0], on: "FL" }],
      tools: ["hammer"],
    },
    { title: "Lock the rails and slide in the back", detail: "Two cam locks, then slide the back panel down the grooves.", add: ["BK"], fix: camLocks(-1), from: { BK: [400, 0, 0] }, tools: ["screwdriver"] },
    { title: "Screw in the bottom panel", detail: "Three long screws through the frame into its edge, with the Allen key.", add: ["BO"], fix: [longScrews(-1)], tools: ["allen"] },
    {
      title: "Lay the other frame on together",
      detail: "Its cam bolts and runners go in first. Lower it onto the rails, the back and the bottom.",
      add: ["FR"],
      fix: [camBolts(1), ...runners(1)],
      people: 2,
      warnings: ["two"],
      tools: ["screwdriver"],
    },
    { title: "Lock the rails to this frame", detail: "Two more cam locks.", fix: camLocks(1), tools: ["screwdriver"] },
    { title: "Screw the bottom panel to this frame", detail: "Three long screws, as on the other side.", fix: [longScrews(1)], tools: ["allen"] },
    {
      title: "Screw the feet into the legs",
      detail: "One adjustable foot into the end of each leg.",
      fix: [{ kind: "foot", count: 4, at: sides.flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, 0, sz * zl])), dir: [0, 1, 0] }],
    },
    { title: "Stand it up", detail: "Lift it upright together.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Tap the dowels into the frame",
      detail: "Four dowels into the tops of the side frames, for the top.",
      fix: sides.flatMap((sx) => [zl - 50, -zl + 50].map((z): CustomFix => ({ kind: "dowel", count: 1, at: [[sx * xl, yTop, z]], dir: [0, -1, 0], on: fid(sx), mate: "TOP" }))),
      tools: ["hammer"],
    },
    {
      title: "Lower the top and its divider on together",
      detail: "First, with the top face down on the rug: eight cam bolts into it, the two wall brackets screwed on at the back, and the divider with a runner on each side fixed on two dowels and two cam locks. Then lower it all onto the frame.",
      add: ["TOP", "DV"],
      fix: [
        { kind: "camScrew", count: 8, at: [...sides.flatMap((sx) => [zl - 80, -zl + 80].map((z): Vec3 => [sx * xi, yTop, z])), ...[-1, -0.35, 0.35, 1].map((t): Vec3 => [t * (xi - 80), yTop, -zl])], dir: [0, 1, 0], on: "TOP" },
        { kind: "angle", name: "Wall bracket", count: 2, len: 60, dia: 30, at: wallX.map((x): Vec3 => [x, yTop, -zl - 10]), dir: [0, 1, 0], on: "TOP" },
        { kind: "screw", count: 2, len: 16, dia: 4, at: wallX.map((x): Vec3 => [x, yTop, -zl + 10]), dir: [0, 1, 0], on: "TOP" },
        ...sides.map((sx): CustomFix => ({ kind: "runner", count: 1, len: 400, dia: 35, at: [[sx * 9, runnerYs[3], 0]], dir: [sx, 0, 0], on: "DV" })),
        ...sides.map((sx): CustomFix => ({ kind: "screw", count: 2, len: 12, dia: 5, at: [-150, 150].map((z): Vec3 => [sx * 12, runnerYs[3], z]), dir: [-sx, 0, 0], on: "DV" })),
        { kind: "dowel", count: 2, at: [-80, 80].map((z): Vec3 => [0, yTop, z]), dir: [0, -1, 0], on: "DV", mate: "TOP" },
        { kind: "cam", count: 2, at: [-80, 80].map((z): Vec3 => [9, yTop - 30, z + 30]), dir: [1, 0, 0], on: "DV" },
      ],
      people: 2,
      warnings: ["two"],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the top",
      detail: "Six cam locks from inside the side frames and the back rail.",
      fix: [
        ...sides.map((sx): CustomFix => ({ kind: "cam", count: 2, at: [zl - 80, -zl + 80].map((z): Vec3 => [sx * xi, yTop - 30, z]), dir: [sx, 0, 0], on: fid(sx) })),
        { kind: "cam", count: 2, at: [-0.35, 0.35].map((t): Vec3 => [t * (xi - 80), yTop - 30, -zl + 10]), dir: [0, 0, 1], on: "TB" },
      ],
      tools: ["screwdriver"],
    },
    { title: "Level it", detail: "Turn the feet until it stands steady and level, close to the wall.", tools: ["level"] },
    {
      title: "Screw it to the wall",
      detail: "Mark through the two brackets, drill, and screw them to the wall. The screws and plugs in the box suit most solid and hollow walls; in solid wood use the screws without plugs.",
      fix: [
        { kind: "plug", count: 2, included: true, at: wallX.map((x): Vec3 => [x, yTop - 25, -D / 2 - 40]), dir: [0, 0, -1] },
        { kind: "washer", count: 2, len: 2, dia: 16, at: wallX.map((x): Vec3 => [x, yTop - 25, -zl - 16]), dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 60, dia: 5, included: true, at: wallX.map((x): Vec3 => [x, yTop - 25, -zl - 14]), dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    ...drawerSteps(small, fh, zf, zb, 13, "small drawer"),
    ...drawerSteps(big, fh, zf, zb, 13, "big drawer"),
    {
      title: "Slide in the drawers",
      detail: "Pull each pair of runners out, set the drawer on them and push it in. Clip the two catches under the drawer onto the runners until they click.",
      fix: [...small, ...big].map((d): CustomFix => ({ kind: "clip", name: "Runner catch", count: 2, at: [-1, 1].map((sx): Vec3 => [d.x + sx * (d.w / 2 - 40), d.y - fh / 2 + 6, zf - 30]), dir: [0, 1, 0], on: `${d.id}B` })),
    },
  ];
  return { parts, steps };
}

function slats(w: number, len: number, n: number): PartPiece[] {
  const pitch = (len - 60) / (n - 1);
  return [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [40, 40, len], pos: [sx * (w / 2 - 20), -5, 0] })),
    ...Array.from({ length: n }, (_, i): PartPiece => ({ shape: "box", size: [w - 20, 8, 38], pos: [0, 20, -len / 2 + 30 + i * pitch] })),
  ];
}

/** The bed frame (and the two LÖNSET bases sold with it), standard king 150 x 200. */
function bed(s: ProductSpec): CustomParams {
  // IKEA's page: 158 wide, 214 long (the guide's own size is a little off)
  void s;
  const W = 1580, L = 2140;
  const LG = 45;
  const xl = W / 2 - LG / 2, zh = -L / 2 + LG / 2, zf = L / 2 - LG / 2;
  const xi = xl - LG / 2; // inside of the legs
  const HH = 1090, FH = 550;
  const yr0 = 240, yr1 = 400, yr = (yr0 + yr1) / 2; // side rails and the lower boards
  const ySup = 300; // slat supports, top
  const xr = xi + 11; // side rails, middle
  const span = 2 * xi;
  const spindles = 10;
  const ladder: PartPiece[] = [
    { shape: "cyl", size: [35, span, 35], pos: [0, 62, 0], rot: [0, 0, Math.PI / 2] },
    { shape: "box", size: [span, 30, 25], pos: [0, -65, 0] },
    ...Array.from({ length: spindles }, (_, i): PartPiece => ({ shape: "box", size: [20, 100, 20], pos: [-span / 2 + 80 + ((span - 160) * i) / (spindles - 1), 0, 0] })),
  ];
  const foot: PartPiece[] = [
    ...[-1, 1].map((sx): PartPiece => ({ shape: "cyl", size: [LG, FH, LG], pos: [sx * xl, 0, 0] })),
    { shape: "cyl", size: [35, span, 35], pos: [0, FH - 35 - FH / 2, 0], rot: [0, 0, Math.PI / 2] },
    { shape: "box", size: [span, yr1 - yr0, 22], pos: [0, yr - FH / 2, 0] },
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [25, FH - 52 - yr1, 25], pos: [sx * 250, (yr1 + FH - 52) / 2 - FH / 2, 0] })),
  ];
  const zs0 = zh + LG / 2, zs1 = zf - LG / 2;
  const sup = (sx: number): CustomPart => ({
    id: `SP${sx}`,
    name: "Slat support",
    size: [25, 25, zs1 - zs0 - 40],
    pos: [sx * (xr - 11 - 12.5), ySup - 12.5, 0],
    material: "metal",
    pieces: [
      { shape: "box", size: [2, 25, zs1 - zs0 - 40], pos: [sx * 11.5, 0, 0] },
      { shape: "box", size: [25, 2, zs1 - zs0 - 40], pos: [0, 11.5, 0] },
    ],
  });
  const bw = (2 * (xr - 11) - 60) / 2; // each slatted base
  const parts: CustomPart[] = [
    { id: "HL", name: "Head leg", size: [LG, HH, LG], pos: [-xl, HH / 2, zh], shape: "cyl", material: "wood" },
    { id: "LAD", name: "Headboard ladder", size: [span, 160, 35], pos: [0, HH - 105, zh], material: "wood", pieces: ladder },
    { id: "HB", name: "Headboard rail", size: [span, yr1 - yr0, 22], pos: [0, yr, zh], material: "wood" },
    { id: "HR", name: "Head leg", size: [LG, HH, LG], pos: [xl, HH / 2, zh], shape: "cyl", material: "wood" },
    { id: "SR-1", name: "Side rail", size: [22, yr1 - yr0, zs1 - zs0], pos: [-xr, yr, 0], material: "wood" },
    { id: "SR1", name: "Side rail", size: [22, yr1 - yr0, zs1 - zs0], pos: [xr, yr, 0], material: "wood" },
    { id: "FB", name: "Footboard", size: [W, FH, LG], pos: [0, FH / 2, zf], material: "wood", pieces: foot },
    sup(-1),
    sup(1),
    { id: "CB0", name: "Centre beam", size: [50, 50, (zs1 - zs0) / 2], pos: [0, ySup - 25, -(zs1 - zs0) / 4], material: "metal" },
    { id: "CB1", name: "Centre beam", size: [50, 50, (zs1 - zs0) / 2], pos: [0, ySup - 25, (zs1 - zs0) / 4], material: "metal" },
    ...[-1, 1].map((sz): CustomPart => ({ id: `BL${sz}`, name: "Support leg", size: [30, ySup - 50, 30], pos: [0, (ySup - 50) / 2, sz * 500], shape: "cyl", material: "metal" })),
    ...[-1, 1].map((sx): CustomPart => ({ id: `SL${sx}`, name: "Slatted bed base", size: [bw, 50, zs1 - zs0 - 60], pos: [sx * (bw / 2 + 30), ySup + 25, 0], material: "wood", pieces: slats(bw, zs1 - zs0 - 60, 28) })),
    ...[-1, 1].map((sx): CustomPart => ({ id: `CU${sx}`, name: "Cushion", size: [620, 420, 120], pos: [sx * 330, HH - 260, zh + LG / 2 + 60], material: "soft" })),
  ];
  const legStuds = (sx: number): CustomFix[] => [
    { kind: "camScrew", name: "Cam stud", count: 2, at: [yr - 40, yr + 40].map((y): Vec3 => [sx * xi, y, zh]), dir: [-sx, 0, 0], on: sx < 0 ? "HL" : "HR", mate: "HB" },
    { kind: "camScrew", name: "Cam stud", count: 2, at: [yr - 40, yr + 40].map((y): Vec3 => [sx * xr, y, zh + LG / 2]), dir: [0, 0, -1], on: sx < 0 ? "HL" : "HR" },
  ];
  const legDowels = (sx: number): CustomFix[] => [
    { kind: "dowel", count: 2, at: [yr - 15, yr + 15].map((y): Vec3 => [sx * xi, y, zh]), dir: [-sx, 0, 0], on: sx < 0 ? "HL" : "HR" },
    { kind: "dowel", count: 2, at: [yr0 + 15, yr1 - 15].map((y): Vec3 => [sx * xr, y, zh + LG / 2]), dir: [0, 0, -1], on: sx < 0 ? "HL" : "HR" },
  ];
  const ladderBolts = (sx: number): CustomFix[] => [
    { kind: "bolt", count: 2, len: 120, dia: 8, at: [HH - 43, HH - 170].map((y): Vec3 => [sx * W / 2, y, zh]), dir: [-sx, 0, 0], on: sx < 0 ? "HL" : "HR", mate: "LAD" },
    { kind: "nut", name: "Barrel nut", count: 2, len: 14, dia: 10, at: [HH - 43, HH - 170].map((y): Vec3 => [sx * (xi - 60), y, zh - 20]), dir: [0, 0, 1], on: "LAD" },
  ];
  const boardCams = (sx: number): CustomFix => ({ kind: "cam", count: 2, at: [yr - 40, yr + 40].map((y): Vec3 => [sx * (xi - 30), y, zh + 11]), dir: [0, 0, -1], on: "HB" });
  const railCams = (sx: number, end: number): CustomFix => ({ kind: "cam", count: 2, at: [yr - 40, yr + 40].map((y): Vec3 => [sx * (xr - 11), y, end * (zs1 - 30)]), dir: [sx, 0, 0], on: `SR${sx}` });
  const supScrews = (sx: number): CustomFix => ({ kind: "screw", count: 8, len: 16, dia: 4, at: Array.from({ length: 8 }, (_, i): Vec3 => [sx * (xr - 13), ySup - 14, zs0 + 80 + ((zs1 - zs0 - 160) * i) / 7]), dir: [sx, 0, 0], on: `SP${sx}`, mate: `SR${sx}` });
  const brAt = (z: number): Vec3 => [0, ySup, z];
  const stopAt: Vec3[] = [-1, 1].flatMap((sx) => [zs0 + 60, -500, 500, zs1 - 60].map((z): Vec3 => [sx * (xr - 30), ySup + 2, z]));
  const steps: CustomStep[] = [
    { title: "Screw the cam studs into a head leg", detail: "Lay the headboard parts on a rug. Four studs into one leg, by hand.", fix: legStuds(-1), pose: "+z", warnings: ["floor"] },
    { title: "Tap the dowels into the leg", detail: "Four dowels, next to the studs. The other head leg gets the same studs and dowels before it goes on.", fix: legDowels(-1), tools: ["hammer"] },
    { title: "Slide the ladder onto a leg", detail: "Its two rails push onto the first leg.", add: ["HL", "LAD"] },
    { title: "Bolt the ladder to the leg", detail: "A barrel nut into each rail, slot towards the bolt, then a long bolt through the leg into each.", fix: ladderBolts(-1), tools: ["allen", "flathead"] },
    { title: "Push the headboard rail onto the leg", detail: "Press four cam locks into it first, two at each end, then push it onto the studs and dowels.", add: ["HB"], fix: [boardCams(-1)] },
    { title: "Lock the rail to this leg", detail: "Turn its two cam locks until they pull tight, with the Allen key.", tools: ["allen"] },
    { title: "Fit the other head leg", detail: "Four cam studs and four dowels into it first, then push it onto the free ends of the ladder and the rail.", add: ["HR"], fix: [...legStuds(1), ...legDowels(1)], tools: ["hammer"] },
    { title: "Lock the rail to the second leg", detail: "Two more cam locks.", fix: [boardCams(1)], tools: ["allen"] },
    { title: "Bolt the ladder to the second leg", detail: "Two barrel nuts and two long bolts, as on the first side.", fix: ladderBolts(1), tools: ["allen", "flathead"] },
    {
      title: "Stand the headboard up and hang a side rail on it",
      detail: "Press four cam locks into each side rail, two at each end. One person holds the headboard, the other pushes the rail onto the leg's studs.",
      add: ["SR-1"],
      fix: [railCams(-1, -1)],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    { title: "Lock the rail to the headboard", detail: "Turn its two cam locks until they pull tight.", tools: ["allen"] },
    { title: "Hang the other side rail", detail: "The same way, then lock its two cam locks.", add: ["SR1"], fix: [railCams(1, -1)], people: 2, warnings: ["two"], tools: ["allen"] },
    {
      title: "Fit the footboard",
      detail: "Screw four cam studs into its legs and tap in four dowels, then lift it onto the free ends of the side rails.",
      add: ["FB"],
      fix: [-1, 1].flatMap((sx): CustomFix[] => [
        { kind: "camScrew", name: "Cam stud", count: 2, at: [yr - 40, yr + 40].map((y): Vec3 => [sx * xr, y, zf - LG / 2]), dir: [0, 0, 1], on: "FB" },
        { kind: "dowel", count: 2, at: [yr0 + 15, yr1 - 15].map((y): Vec3 => [sx * xr, y, zf - LG / 2]), dir: [0, 0, 1], on: "FB" },
      ]),
      people: 2,
      warnings: ["two"],
    },
    { title: "Lock the rails to the footboard", detail: "Two cam locks at each end, turned until tight.", fix: [railCams(-1, 1), railCams(1, 1)], tools: ["allen"], check: "square" },
    { title: "Screw on the slat supports", detail: "Inside each side rail at the height you want, eight screws each. Lower for a thick mattress, higher for a thin one.", add: ["SP-1", "SP1"], fix: [supScrews(-1), supScrews(1)], tools: ["screwdriver"] },
    {
      title: "Screw the beam brackets on",
      detail: "One in the middle of the headboard rail and one on the footboard, two screws each.",
      fix: [
        // on the faces of the headboard rail and the footboard's board
        { kind: "angle", name: "Beam bracket", count: 2, len: 80, dia: 60, at: [brAt(zh + 11), brAt(zf - 11)], dir: [0, -1, 0] },
        { kind: "screw", count: 2, len: 16, dia: 4, at: [-25, 25].map((x): Vec3 => [x, ySup - 30, zh + 11]), dir: [0, 0, -1], on: "HB" },
        { kind: "screw", count: 2, len: 16, dia: 4, at: [-25, 25].map((x): Vec3 => [x, ySup - 30, zf - 11]), dir: [0, 0, 1], on: "FB" },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Join the centre beam and lay it in",
      detail: "Slide the two halves into the joint sleeve, push the support legs on and lay the beam into the brackets.",
      add: ["CB0", "CB1", "BL-1", "BL1"],
      fix: [{ kind: "connector", name: "Beam sleeve", count: 1, len: 120, dia: 60, at: [[0, ySup - 25, 0]], dir: [0, 0, 1] }],
    },
    {
      title: "Screw the beam to the brackets",
      detail: "Centre the joint between the rails, then two small screws at each end.",
      fix: [{ kind: "screw", count: 4, len: 10, dia: 5, at: [zs0 + 30, zs0 + 60, zs1 - 60, zs1 - 30].map((z): Vec3 => [0, ySup, z]), dir: [0, -1, 0] }],
      tools: ["screwdriver"],
    },
    {
      title: "Put the slatted bases together",
      detail: "Each base has its own manual: screw its rail halves and cross rails together, then clip every slat into its holders, curved side up.",
      add: ["SL-1", "SL1"],
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 6, len: 40, dia: 6, at: [-1, 1].flatMap((k) => [-600, 0, 600].map((z): Vec3 => [sx * (bw / 2 + 30) + k * (bw / 2 - 20), ySup + 40, z])).slice(0, 6), dir: [0, -1, 0], on: `SL${sx}` })),
      from: { "SL-1": [0, 400, 0], SL1: [0, 400, 0] },
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the slat stops",
      detail: "Eight stops over the edges of the bases, a small bolt through each into the slat support.",
      fix: [
        { kind: "clip", name: "Slat stop", count: 8, len: 20, dia: 25, at: stopAt, dir: [0, -1, 0] },
        // through the stop's end, past the base's edge, into the support's top flange
        { kind: "screw", count: 8, len: 10, dia: 6, at: stopAt.map((p): Vec3 => [p[0], ySup + 6, p[2] + (p[2] > 0 ? -23 : 23)]), dir: [0, -1, 0] },
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Tie on the cushions",
      detail: "Unpack them and let them fill out. Loop the four leather straps over the top rail and through the cushion tabs.",
      add: ["CU-1", "CU1"],
      fix: [{ kind: "clip", name: "Leather strap", count: 4, len: 60, dia: 30, at: [-560, -100, 100, 560].map((x): Vec3 => [x, HH - 43, zh]), dir: [0, -1, 0], on: "LAD" }],
      from: { "CU-1": [0, 0, 400], CU1: [0, 0, 400] },
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["BJÖRKSNÄS", "BJORKSNAS"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^bjorksnas-bedside-table/.test(slug)) return bedside(s);
    if (/^bjorksnas-chest-5-drawers/.test(slug)) return chest(s);
    if (/^bjorksnas-bed-frame/.test(slug)) return bed(s);
    return null;
  },
};
export default family;
