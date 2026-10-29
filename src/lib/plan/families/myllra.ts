import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * MYLLRA, read from IKEA's manuals.
 *
 * Cot (UK, 70 x 140) and crib (US, 70 x 132) share one manual. The drawer box goes together first: a bottom frame of
 * two rails and two end boards on dowels, the two inner walls on dowels and cam locks, a runner on each wall, the
 * two top boards and the back panel on cam pins and cam locks. Each end panel takes a curved bottom shell on cam
 * pins. Two people stand the box on its end on the first end panel, slide the middle panel down its grooves, lower
 * the other end on, lock it, screw in the legs, turn it over and lock the first end. The drawer is built on its
 * front, hung on the runners, then the base supports go in at the chosen height, the base is bolted on, the two
 * slatted sides slide in and are bolted through the end panels.
 */

const box = (size: Vec3, pos: Vec3, rot?: Vec3, material?: PartPiece["material"]): PartPiece => ({ shape: "box", size, pos, ...(rot ? { rot } : {}), ...(material ? { material } : {}) });
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
/** One fix per way in (the custom builder takes ten fixes a step), each point going in the given direction. */
function fx(kind: CustomFix["kind"], list: [Vec3, Vec3][], o: Partial<CustomFix> = {}): CustomFix[] {
  const by = new Map<string, { dir: Vec3; at: Vec3[] }>();
  for (const [p, d] of list) {
    const k = d.join(",");
    if (!by.has(k)) by.set(k, { dir: d, at: [] });
    by.get(k)!.at.push(p);
  }
  return [...by.values()].map(({ dir, at }) => ({ kind, count: at.length, at, dir, ...o }));
}

/* ---------- cot and crib ---------- */

function cot(s: ProductSpec): CustomParams {
  const crib = /crib/.test(s.slug ?? "") || s.bed?.mattressL === 132;
  // IKEA's own sizes: the cot is 144 x 79 x 97 cm, the crib 138 x 79 x 101; length runs left to right
  const ml = crib ? 1320 : 1400, mw = 700;
  const L = crib ? 1380 : 1440, W = 790, H = crib ? 1010 : 970;
  const T = 20, LEG = 70, R = 110, BT = 18;
  const xs = L / 2 - R; // where each curved shell starts
  const xi = L / 2 - T; // inside face of an end panel
  const DW = (crib ? 1090 : 1150) + 32; // the drawer box, outside
  const xw = DW / 2 + 13 + BT / 2; // inner walls, either side of the drawer
  const topY = LEG + BT + 215; // top of the inner walls
  const zb = -W / 2 + BT; // in front of the back panel
  const zf = W / 2 - BT; // behind the drawer front
  const baseY = crib ? 600 : 560;
  const parts: CustomPart[] = [];
  const P = (p: CustomPart) => parts.push(p);
  const sid = (g: number) => (g < 0 ? 0 : 1);

  // the drawer box
  const pl0 = xw - 90;
  for (const g of [-1, 1]) P({ id: `P${sid(g)}`, name: "Bottom end board", size: [xs - pl0, BT, zf - zb], pos: [(g * (xs + pl0)) / 2, LEG + BT / 2, (zb + zf) / 2], material: "board" });
  for (const gz of [-1, 1]) P({ id: `BR${sid(gz)}`, name: "Bottom rail", size: [2 * pl0, BT, 80], pos: [0, LEG + BT / 2, gz < 0 ? zb + 40 : zf - 40], material: "board" });
  for (const g of [-1, 1]) P({ id: `WA${sid(g)}`, name: "Inner wall", size: [BT, topY - LEG - BT, zf - zb], pos: [g * xw, (LEG + BT + topY) / 2, (zb + zf) / 2], material: "board" });
  const ry = LEG + BT + 45, rz = zf - 250;
  for (const g of [-1, 1]) P({ id: `RN${sid(g)}`, name: "Drawer runner", size: [14, 40, 480], pos: [g * (xw - BT / 2 - 7), ry, rz], material: "metal" });
  const mz = (zb + W / 2) / 2; // the middle panel sits between the two top boards
  const tb = [zb, mz - 60, mz + 60, W / 2];
  P({ id: "TB0", name: "Top board", size: [2 * xi, BT, tb[1] - tb[0]], pos: [0, topY + BT / 2, (tb[0] + tb[1]) / 2], material: "board" });
  P({ id: "TB1", name: "Top board", size: [2 * xi, BT, tb[3] - tb[2]], pos: [0, topY + BT / 2, (tb[2] + tb[3]) / 2], material: "board" });
  const lowEnd = LEG + R; // where the end panels start, above the shells
  P({
    id: "BP",
    name: "Back panel",
    size: [2 * xi, topY - LEG, BT],
    pos: [0, (LEG + topY) / 2, -W / 2 + BT / 2],
    material: "board",
    pieces: [box([2 * xs, topY - LEG, BT], [0, 0, 0]), ...[-1, 1].map((g) => box([xi - xs, topY - lowEnd, BT], [(g * (xi + xs)) / 2, (lowEnd + topY) / 2 - (LEG + topY) / 2, 0]))],
  });
  // the curved shells under the end panels: a quarter circle, from the floor line up to the end panel
  const NA = 6;
  const shell = (g: number): CustomPart => {
    const cx = g * (L / 2 - R / 2), cy = LEG + R / 2;
    const Rm = R - T / 2;
    const pieces = range(NA).map((i) => {
      const a = ((i + 0.5) / NA) * (Math.PI / 2);
      const seg = ((Math.PI / 2) * R) / NA + 4;
      return box([seg, T, W], [g * (xs + Rm * Math.sin(a)) - cx, LEG + R - Rm * Math.cos(a) - cy, 0], [0, 0, g * a]);
    });
    return { id: `C${sid(g)}`, name: "Curved shell", size: [R, R, W], pos: [cx, cy, 0], material: "board", pieces };
  };
  const end = (g: number): CustomPart => ({ id: `E${sid(g)}`, name: "End panel", size: [T, H - lowEnd, W], pos: [g * (L / 2 - T / 2), (lowEnd + H) / 2, 0], material: "board" });
  P(shell(-1));
  P(end(-1));
  P({ id: "FB", name: "Middle panel", size: [2 * xi, 4, 120], pos: [0, topY + 9, mz], material: "fiber" });
  P(shell(1));
  P(end(1));
  const legAt = [-1, 1].flatMap((g) => [-1, 1].map((gz): Vec3 => [g * (xs - 45), LEG / 2, gz * (W / 2 - 80)]));
  legAt.forEach((p, i) => P({ id: `LG${i}`, name: "Leg", size: [45, LEG, 45], pos: p, shape: "cyl", material: "wood" }));

  // the drawer
  const dfW = 2 * (xs - 5), dfB = LEG + 6, dfT = topY - 3;
  P({ id: "DF", name: "Drawer front", size: [dfW, dfT - dfB, BT], pos: [0, (dfB + dfT) / 2, W / 2 - BT / 2], material: "board" });
  const dd = 500, dz = zf - dd / 2, dh = 180, dy = LEG + 20 + dh / 2;
  for (const g of [-1, 1]) P({ id: `DS${sid(g)}`, name: "Drawer side", size: [16, dh, dd], pos: [g * (DW / 2 - 8), dy, dz], material: "board" });
  P({ id: "DB", name: "Drawer bottom", size: [DW - 32, 4, dd - 8], pos: [0, LEG + 34, dz + 4], material: "fiber" });
  P({ id: "DK", name: "Drawer back", size: [DW - 32, dh, 16], pos: [0, dy, zf - dd + 8], material: "board" });
  P({ id: "DR", name: "Drawer rail", size: [DW - 40, 16, 16], pos: [0, LEG + 24, zf - dd + 40], material: "metal" });

  // the bed
  const bw = W - 2 * 30 - 10;
  P({
    id: "BA",
    name: "Base",
    size: [2 * xi - 6, 30, bw],
    pos: [0, baseY, 0],
    material: "board",
    pieces: [box([2 * xi - 6, 30, 40], [0, 0, -bw / 2 + 20]), box([2 * xi - 6, 30, 40], [0, 0, bw / 2 - 20]), box([40, 30, bw - 80], [-xi + 23, 0, 0]), box([40, 30, bw - 80], [xi - 23, 0, 0]), box([2 * xi - 86, 4, bw - 80], [0, 10, 0], undefined, "fiber")],
  });
  const sideY0 = topY + BT, sideLen = 2 * xi;
  const nSp = Math.floor((sideLen - 60) / 79);
  const sideOf = (gz: number): CustomPart => {
    const cy = (sideY0 + H) / 2;
    const spH = H - 50 - (sideY0 + 40);
    return {
      id: `SS${sid(gz)}`,
      name: "Slatted side",
      size: [sideLen, H - sideY0, 30],
      pos: [0, cy, gz * (W / 2 - 15)],
      material: "wood",
      pieces: [
        box([sideLen, 50, 30], [0, H - 25 - cy, 0]),
        box([sideLen, 40, 30], [0, sideY0 + 20 - cy, 0]),
        ...spread(-sideLen / 2 + 50, sideLen / 2 - 50, nSp).map((x): PartPiece => ({ shape: "cyl", size: [24, spH, 24], pos: [x, sideY0 + 40 + spH / 2 - cy, 0] })),
      ],
    };
  };
  P(sideOf(-1));
  P(sideOf(1));
  P({ id: "M", name: "Mattress", size: [ml, 100, mw], pos: [0, baseY + 15 + 50, 0], material: "soft", extra: true });

  // fittings, in the finished cot
  const zz = [-1, 1].map((t) => t * 250);
  const CAMPIN = { len: 30, dia: 8 }, CAM = { dia: 15 }, DOWEL = { len: 30, dia: 8 };
  const railDowels = fx("dowel", [-1, 1].flatMap((g) => [-1, 1].flatMap((gz) => [-12, 12].map((dz): [Vec3, Vec3] => [[g * pl0, LEG + BT / 2, (gz < 0 ? zb + 40 : zf - 40) + dz], [-g, 0, 0]]))), DOWEL);
  const wallDowels = [-1, 1].flatMap((g) => fx("dowel", spread(zb + 60, zf - 60, 6).map((z): [Vec3, Vec3] => [[g * xw, LEG + BT, z], [0, -1, 0]]), { ...DOWEL, on: `P${sid(g)}` }));
  const plinthPins = [-1, 1].flatMap((g) => fx("camScrew", zz.map((z): [Vec3, Vec3] => [[g * xw, LEG + BT, z + 40], [0, -1, 0]]), { ...CAMPIN, on: `P${sid(g)}` }));
  const wallCams = fx("cam", [-1, 1].flatMap((g) => zz.map((z): [Vec3, Vec3] => [[g * (xw - BT / 2), LEG + BT + 30, z + 40], [g, 0, 0]])), CAM);
  const runnerScrews = fx("screw", [-1, 1].flatMap((g) => [rz - 180, rz + 180].map((z): [Vec3, Vec3] => [[g * (xw - BT / 2 - 14), ry, z], [g, 0, 0]])), { len: 14, dia: 4 });
  const tbZ = [(tb[0] + tb[1]) / 2, (tb[2] + tb[3]) / 2];
  const topDowels = fx("dowel", [-1, 1].flatMap((g) => tbZ.flatMap((z) => [-60, 60].map((dz): [Vec3, Vec3] => [[g * xw, topY, z + dz], [0, 1, 0]]))), DOWEL);
  const topPins = fx("camScrew", [-1, 1].flatMap((g) => tbZ.map((z): [Vec3, Vec3] => [[g * xw, topY, z], [0, 1, 0]])), CAMPIN);
  const topCams = fx("cam", [-1, 1].flatMap((g) => tbZ.map((z): [Vec3, Vec3] => [[g * (xw - BT / 2), topY - 30, z], [g, 0, 0]])), CAM);
  const backPins = fx("camScrew", [-1, 1].map((g): [Vec3, Vec3] => [[g * xw, (LEG + topY) / 2, zb], [0, 0, -1]]), CAMPIN);
  const backCams = fx("cam", [-1, 1].map((g): [Vec3, Vec3] => [[g * (xw - BT / 2), (LEG + topY) / 2, zb + 30], [g, 0, 0]]), CAM);
  // one end panel with its shell: four pins in the shell, five dowels and two pins in the panel, two cam locks
  const endFix = (g: number): CustomFix[] => [
    ...fx("camScrew", zz.map((z): [Vec3, Vec3] => [[g * (L / 2 - T / 2), lowEnd, z], [0, -1, 0]]), { ...CAMPIN, on: `C${sid(g)}` }),
    ...fx("camScrew", zz.map((z): [Vec3, Vec3] => [[g * xs, LEG + T / 2, z], [g, 0, 0]]), { ...CAMPIN, on: `C${sid(g)}` }),
    ...fx("dowel", spread(-W / 2 + 80, W / 2 - 80, 5).map((z): [Vec3, Vec3] => [[g * (L / 2 - T / 2), lowEnd, z], [0, 1, 0]]), { ...DOWEL, on: `E${sid(g)}` }),
    ...fx("camScrew", zz.map((z): [Vec3, Vec3] => [[g * xi, topY + BT / 2, z], [g, 0, 0]]), { ...CAMPIN, on: `E${sid(g)}` }),
    ...fx("cam", zz.map((z): [Vec3, Vec3] => [[g * (L / 2 - T), lowEnd + 30, z], [-g, 0, 0]]), CAM),
  ];
  // locking an end panel to the box: two cams in the bottom end board for the shell, two in the top boards for the panel
  const endLock = (g: number) => fx("cam", [...zz.map((z): [Vec3, Vec3] => [[g * (xs - 30), LEG + BT, z], [0, -1, 0]]), ...tbZ.map((z): [Vec3, Vec3] => [[g * (xi - 30), topY + BT, z], [0, -1, 0]])], CAM);
  const legFix = fx("glide", legAt.map(([x, , z]): [Vec3, Vec3] => [[x, 0, z], [0, 1, 0]]), { name: "Leg glide", len: 6, dia: 40 });
  const dfPins = fx("camScrew", [-1, 1].flatMap((g) => [dy - 50, dy + 50].map((y): [Vec3, Vec3] => [[g * (DW / 2 - 8), y, zf], [0, 0, 1]])), { ...CAMPIN, on: "DF" });
  const dsDowels = fx("dowel", [-1, 1].flatMap((g) => [dy - 20, dy + 20].map((y): [Vec3, Vec3] => [[g * (DW / 2 - 8), y, zf], [0, 0, -1]])), DOWEL);
  const smallCam = (pts: [Vec3, Vec3][]) => fx("cam", pts, { dia: 12, name: "Small cam lock" });
  const frontCams = smallCam([-1, 1].flatMap((g) => [dy - 50, dy + 50].map((y): [Vec3, Vec3] => [[g * (DW / 2 - 16), y, zf - 30], [g, 0, 0]])));
  const backConn = fx("dowel", [-1, 1].flatMap((g) => [dy - 50, dy + 50].map((y): [Vec3, Vec3] => [[g * (DW / 2), y, zf - dd + 8], [-g, 0, 0]])), { name: "Back connector", len: 40, dia: 8 });
  const backDrawerCams = smallCam([-1, 1].flatMap((g) => [dy - 50, dy + 50].map((y): [Vec3, Vec3] => [[g * (DW / 2 - 16), y, zf - dd + 30], [g, 0, 0]])));
  const supports = fx("pin", [-1, 1].flatMap((g) => [-1, 1].map((gz): [Vec3, Vec3] => [[g * xi, baseY - 25, gz * (W / 2 - 130)], [g, 0, 0]])), { name: "Base support", len: 60, dia: 8 });
  const baseBolts = fx("bolt", [-1, 1].flatMap((g) => [-1, 1].map((gz): [Vec3, Vec3] => [[g * (xi - 25), baseY + 15, gz * (W / 2 - 130)], [0, -1, 0]])), { len: 20, dia: 6 });
  const railY = [H - 25, sideY0 + 20];
  const sideNuts = fx("nut", [-1, 1].flatMap((g) => [-1, 1].flatMap((gz) => railY.map((y): [Vec3, Vec3] => [[g * (xi - 30), y + 15, gz * (W / 2 - 15)], [0, -1, 0]]))), { name: "Barrel nut", len: 14, dia: 10 });
  const sideBolts = fx("bolt", [-1, 1].flatMap((g) => [-1, 1].flatMap((gz) => railY.map((y): [Vec3, Vec3] => [[g * (L / 2), y, gz * (W / 2 - 15)], [-g, 0, 0]]))), { len: 90, dia: 6 });
  const midY = (sideY0 + H) / 2;
  const sleeves = fx("connector", [-1, 1].flatMap((g) => [-1, 1].map((gz): [Vec3, Vec3] => [[g * (xi - 20), midY, gz * (W / 2 - 15)], [g, 0, 0]])), { name: "Sleeve nut", len: 20, dia: 10 });
  const sleeveScrews = fx("screw", [-1, 1].flatMap((g) => [-1, 1].map((gz): [Vec3, Vec3] => [[g * (L / 2), midY, gz * (W / 2 - 15)], [-g, 0, 0]])), { len: 16, dia: 6 });

  const steps: CustomStep[] = [
    {
      title: "Dowel the bottom frame of the drawer box",
      detail: "On a rug. Dowels into the ends of the two rails, then press the rails between the two end boards.",
      add: ["P0", "P1", "BR0", "BR1"],
      fix: railDowels,
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Tap dowels and cam pins into the end boards", detail: "Six dowels along each end board and two cam pins, screwed in by hand.", fix: [...wallDowels, ...plinthPins], tools: ["hammer"] },
    { title: "Press the inner walls down onto them", detail: "Holes for the runners face in.", add: ["WA0", "WA1"] },
    { title: "Turn the cam locks", detail: "Four of them, arrow towards the pin, turned clockwise until the wall pulls tight.", fix: wallCams },
    { title: "Screw a runner to each wall", detail: "The two runners are different: check the drawing on each before you screw it on. Two screws each.", add: ["RN0", "RN1"], fix: runnerScrews, tools: ["screwdriver"] },
    { title: "Dowel the top boards and lay them on", detail: "Four dowels and two cam pins into each board, then press both onto the walls with the groove edges facing each other.", add: ["TB0", "TB1"], fix: [...topDowels, ...topPins], tools: ["hammer"] },
    { title: "Lock the top boards", detail: "Four cam locks in the tops of the walls.", fix: topCams },
    { title: "Fit the back panel", detail: "Two cam pins into it, slide it on from the end with its curved corners down, then two cam locks.", add: ["BP"], fix: [...backPins, ...backCams] },
    {
      title: "Build the first end panel",
      detail: "On the rug: four cam pins into the curved shell, five dowels and two cam pins into the end panel, slide the shell onto it and turn two cam locks.",
      add: ["C0", "E0"],
      fix: endFix(-1),
      tools: ["hammer"],
      // the built end comes in on a slant, along its own dowels and onto the box's pins at once
      from: { C0: [-300, 300, 0], E0: [-300, 300, 0] },
    },
    {
      title: "Stand the box on its end on the end panel",
      detail: "Do it together. Lower the box straight down so the pins go into their holes. Don't use a hammer from now on.",
      pose: "+x",
      people: 2,
      warnings: ["two"],
    },
    { title: "Slide the middle panel down its grooves", detail: "It goes between the two top boards, smooth side out.", add: ["FB"], from: { FB: [300, 0, 0] } },
    {
      title: "Build the other end and lower it on",
      detail: "Pins, dowels and shell as before. Lay it on top so every pin and dowel finds its hole.",
      add: ["C1", "E1"],
      fix: endFix(1),
      from: { C1: [300, 300, 0], E1: [300, 300, 0] },
    },
    { title: "Lock this end", detail: "Four cam locks: two in the top boards and two in the bottom end board.", fix: endLock(1) },
    { title: "Screw in the legs", detail: "Four legs into the bottom end boards by hand, with a glide pushed into each foot.", add: ["LG0", "LG1", "LG2", "LG3"], fix: legFix },
    { title: "Turn it over and lock the first end", detail: "Together, onto the end you just locked. Four more cam locks.", fix: endLock(-1), pose: "-x", people: 2, warnings: ["two"] },
    { title: "Stand the cot up", detail: "Together, onto its legs.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Build the drawer on its front",
      detail: "Lay the drawer front face down on a rug. Four cam pins into it, a dowel in the front end of each side, then stand the sides on it.",
      add: ["DF", "DS0", "DS1"],
      fix: [...dfPins, ...dsDowels],
      // the front first, then the sides pushed straight onto its pins
      from: { DF: [0, 0, -250], DS0: [0, 0, -350], DS1: [0, 0, -350] },
      warnings: ["floor"],
    },
    { title: "Lock the sides to the front", detail: "Four small cam locks.", fix: frontCams },
    { title: "Slide the bottom into the grooves", detail: "Smooth side up, all the way down to the front.", add: ["DB"], from: { DB: [0, 0, -300] } },
    { title: "Fit the drawer back", detail: "Press it onto the sides, then push the four connectors through the sides into it.", add: ["DK"], fix: backConn },
    { title: "Lock the back", detail: "Four small cam locks.", fix: backDrawerCams },
    { title: "Screw the rail under the drawer", detail: "One screw at each end. It keeps the drawer running straight.", add: ["DR"], fix: fx("screw", [-1, 1].map((g): [Vec3, Vec3] => [[g * (DW / 2 - 24), LEG + 24, zf - dd + 40], [g, 0, 0]]), { len: 10, dia: 4 }), tools: ["screwdriver"] },
    { title: "Screw on the two knobs", detail: "One screw from the back of the front into each knob.", fix: fx("knob", [-0.3, 0.3].map((t): [Vec3, Vec3] => [[t * dfW, (dfB + dfT) / 2, W / 2], [0, 0, -1]]), { dia: 45 }), tools: ["screwdriver"] },
    { title: "Hang the drawer on the runners", detail: "Pull both runners all the way out, set the drawer on them and push it home. Use the adjusters at the front to even the gaps." },
    { title: "Push in the base supports", detail: "Four of them into the end panels, at the height for your baby's age: the top holes for a newborn, lower once your baby can sit up.", fix: supports },
    { title: "Lay the base on the supports", detail: "Mesh side up, its corners over the supports.", add: ["BA"], from: { BA: [0, 300, 0] } },
    { title: "Bolt the base to the supports", detail: "One bolt down through each corner, tightened with the Allen key.", fix: baseBolts, tools: ["allen"] },
    { title: "Slide the slatted sides in", detail: "One at the front and one at the back, between the end panels and onto the drawer box.", add: ["SS0", "SS1"], from: { SS0: [0, 0, -300], SS1: [0, 0, 300] } },
    { title: "Push the barrel nuts into the sides", detail: "Eight of them, into the holes at the ends of the rails, slot towards the end panel.", fix: sideNuts, tools: ["flathead"] },
    { title: "Bolt the sides through the end panels", detail: "Eight long bolts, tightened with the Allen key. Check none stick out inside the cot.", fix: sideBolts, tools: ["allen"] },
    { title: "Screw the sides to the end panels in the middle", detail: "Push a sleeve nut into each side from inside, then a short screw through the end panel into it.", fix: [...sleeves, ...sleeveScrews], tools: ["allen"] },
    { title: "Lay the mattress in", detail: "It should fit snugly, with no gap wider than two fingers at the sides and ends.", add: ["M"] },
  ];
  return { parts, steps };
}

/* ---------- changing table ---------- */

function changingTable(): CustomParams {
  // IKEA's size is 85 x 97 x 79 cm: the carcass, with the changing top sticking out past its left side
  const T = 18, LEG = 80, R = 100;
  const xl = -345, xr = 425, xt = -425; // carcass sides, left end of the top
  const zb = -395, zf = 287, zt = 395; // back, behind the drawer fronts, front of the top
  const Hl = 850, H = 970;
  const parts: CustomPart[] = [];
  const P = (id: string, name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: PartPiece["material"] = "board", extra: Partial<CustomPart> = {}) =>
    parts.push({ id, name, size: [x1 - x0, y1 - y0, z1 - z0], pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], material, ...extra });
  const legX = [xl + R + 40, xr - R - 40], legZ = [zb + 60, zf - 50];
  legX.forEach((x, i) => legZ.forEach((z, j) => P(`LG${i}${j}`, "Leg", x - 22, x + 22, 0, LEG, z - 22, z + 22, "wood", { shape: "cyl" })));
  P("BB", "Bottom board", xl + R, xr - R, LEG, LEG + T, zb, zf);
  const yw = 340;
  P("WI0", "Inner wall", xl + R, xl + R + T, LEG + T, yw, zb, zf);
  P("WI1", "Inner wall", xr - R - T, xr - R, LEG + T, yw, zb, zf);
  P("RN0", "Drawer runner", xl + R + T, xl + R + T + 14, 140, 180, zf - 470, zf - 10, "metal");
  P("RN1", "Drawer runner", xr - R - T - 14, xr - R - T, 140, 180, zf - 470, zf - 10, "metal");
  P("ST0", "Strip", xl + T, xr - T, yw, yw + T, zb, zb + 150);
  P("ST1", "Strip", xl + T, xr - T, yw, yw + T, zf - 150, zf);
  // the side panels, each standing on a curved shell
  const shell = (id: string, g: number, xEdge: number) => {
    const xs = xEdge - g * R, NA = 6, Rm = R - T / 2;
    const cx = xEdge - (g * R) / 2, cy = LEG + R / 2;
    const pieces = range(NA).map((i) => {
      const a = ((i + 0.5) / NA) * (Math.PI / 2);
      return box([((Math.PI / 2) * R) / NA + 4, T, zf - zb], [xs + g * Rm * Math.sin(a) - cx, LEG + R - Rm * Math.cos(a) - cy, 0], [0, 0, g * a]);
    });
    parts.push({ id, name: "Curved shell", size: [R, R, zf - zb], pos: [cx, cy, (zb + zf) / 2], material: "board", pieces });
  };
  shell("CL", -1, xl);
  P("SL", "Side panel", xl, xl + T, LEG + R, Hl, zb, zf + T);
  P("RU0", "Drawer runner", xl + T, xl + T + 14, 420, 460, zf - 470, zf - 10, "metal");
  P("RP0", "Board runner", xl + T, xl + T + 14, 600, 620, zf - 420, zf - 10, "metal");
  shell("CR", 1, xr);
  P("SR", "Side panel", xr - T, xr, LEG + R, H, zb, zf + T);
  P("RU1", "Drawer runner", xr - T - 14, xr - T, 420, 460, zf - 470, zf - 10, "metal");
  P("RP1", "Board runner", xr - T - 14, xr - T, 600, 620, zf - 420, zf - 10, "metal");
  P("BR", "Back rail", xl + T, xr - T, Hl - 50, Hl, zb, zb + T);
  P("BK", "Back panel", xl, xr, LEG + T, Hl, zb - 4, zb, "fiber");
  P("SH", "Shelf", xl + T, xr - T, 582, 600, zb + T, zf - 40);
  P("TP", "Changing top", xt, xr - T, Hl, Hl + T, zb, zt);
  // the pull-out board above the top drawer: a board in a frame of four strips
  const px0 = xl + T + 14, px1 = xr - T - 14, pz0 = zb + 90;
  P("PO", "Pull-out board", px0, px1, 603, 628, pz0, zf + T, "board", {
    pieces: [box([px1 - px0, 25, 30], [0, 0, (zf + T - pz0) / 2 - 15]), box([px1 - px0, 25, 30], [0, 0, -(zf + T - pz0) / 2 + 15]), box([30, 25, zf + T - pz0 - 60], [-(px1 - px0) / 2 + 15, 0, 0]), box([30, 25, zf + T - pz0 - 60], [(px1 - px0) / 2 - 15, 0, 0]), box([px1 - px0 - 60, 12, zf + T - pz0 - 60], [0, 6, 0])],
  });
  // two drawers: the bottom one between the inner walls, the top one between the side panels
  const dr = [
    { y0: 100, y1: 336, bx0: xl + R + T + 14, bx1: xr - R - T - 14, by0: 110, by1: 300 },
    { y0: 342, y1: 578, bx0: xl + T + 14, bx1: xr - T - 14, by0: 370, by1: 560 },
  ];
  const dd = 470;
  dr.forEach((d, i) => {
    P(`DF${i}`, "Drawer front", xl + T + 2, xr - T - 2, d.y0, d.y1, zf, zf + T);
    P(`DS${i}0`, "Drawer side", d.bx0, d.bx0 + 16, d.by0, d.by1, zf - dd, zf);
    P(`DS${i}1`, "Drawer side", d.bx1 - 16, d.bx1, d.by0, d.by1, zf - dd, zf);
    P(`DB${i}`, "Drawer bottom", d.bx0 + 16, d.bx1 - 16, d.by0 + 10, d.by0 + 14, zf - dd + 16, zf, "fiber");
    P(`DK${i}`, "Drawer back", d.bx0 + 16, d.bx1 - 16, d.by0, d.by1, zf - dd, zf - dd + 16);
    P(`DR${i}`, "Drawer rail", d.bx0 + 20, d.bx1 - 20, d.by0 - 8, d.by0, zf - dd + 30, zf - dd + 46, "metal");
  });
  const rimY = Hl + T, rimH = 100;
  P("RB", "Back guard", xt, xr - T, rimY, rimY + rimH, zb, zb + T);
  P("RL", "End guard", xt, xt + T, rimY, rimY + rimH, zb + T, zt - T);
  P("RF", "Front guard", xt, xr - T, rimY, rimY + rimH, zt - T, zt);

  const D = { len: 30, dia: 8 }, PIN = { len: 30, dia: 8 }, CAM = { dia: 15 }, SCR = { len: 14, dia: 4 };
  const n = (kind: CustomFix["kind"], count: number, to: string[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count, to, ...o });
  const runnerScrews = (ids: string[], k: number) => ids.flatMap((id) => {
    const p = parts.find((q) => q.id === id)!;
    const g = p.pos[0] < 40 ? 1 : -1; // screwed out towards the panel behind it
    const x = p.pos[0] + (g * -p.size[0]) / 2;
    return fx("screw", spread(p.pos[2] - p.size[2] / 2 + 40, p.pos[2] + p.size[2] / 2 - 40, k).map((z): [Vec3, Vec3] => [[x, p.pos[1], z], [-g, 0, 0]]), SCR);
  });
  const drawerIds = (k: string) => [0, 1].map((i) => `${k}${i}`);
  const sides = ["DS00", "DS01", "DS10", "DS11"];
  // dowels and cam pins in the inside faces of the side panels, where the box's boards meet them (none at the shelf: it slides in)
  const dowelSpots: [number, number][] = [[349, zb + 40], [349, zb + 110], [349, zf - 110], [349, zf - 40], [349, -150], [349, 60], [815, zb + 9]];
  const pinSpots: [number, number][] = [[840, zb + 9], [349, zb + 75], [349, zf - 75]];
  const sidePts = (kind: CustomFix["kind"], spots: [number, number][], o: Partial<CustomFix>): CustomFix[] =>
    [-1, 1].flatMap((g) => fx(kind, spots.map(([y, z]): [Vec3, Vec3] => [[g < 0 ? xl + T : xr - T, y, z], [g, 0, 0]]), { ...o, on: g < 0 ? "SL" : "SR" }));
  const steps: CustomStep[] = [
    { title: "Screw the legs into the bottom board", detail: "Lay the bottom board upside down on a rug and turn the four legs in by hand.", add: ["BB", "LG00", "LG01", "LG10", "LG11"], pose: "-y", warnings: ["floor"] },
    { title: "Push a glide into each leg", detail: "Into the hole in the foot, until it sits flat.", fix: fx("glide", legX.flatMap((x) => legZ.map((z): [Vec3, Vec3] => [[x, 0, z], [0, 1, 0]])), { name: "Leg glide", len: 6, dia: 40 }) },
    { title: "Turn it over and screw in the cam pins", detail: "Four cam pins into the top of the bottom board, by hand.", fix: [n("camScrew", 4, ["BB"], PIN)], pose: "+y" },
    { title: "Tap dowels into the bottom board", detail: "Four along each end, where the inner walls stand.", fix: [n("dowel", 8, ["BB"], D)], tools: ["hammer"] },
    { title: "Press the inner walls onto the bottom board", detail: "Holes for the runners face in.", add: ["WI0", "WI1"] },
    { title: "Lock the inner walls", detail: "Four cam locks, arrow towards the pin, turned clockwise.", fix: [n("cam", 4, ["WI0", "WI1"], CAM)] },
    { title: "Screw a runner to the left wall", detail: "The two runners are different: match each to the drawing. Two screws, then pull it out to reach the third hole.", add: ["RN0"], fix: runnerScrews(["RN0"], 3) },
    { title: "Screw the other runner to the right wall", detail: "Three screws, the same way.", add: ["RN1"], fix: runnerScrews(["RN1"], 3) },
    { title: "Screw cam pins into the two strips", detail: "Two in each, by hand.", fix: [n("camScrew", 4, ["ST0", "ST1"], PIN)] },
    { title: "Lay the strips on top of the walls", detail: "One at the back and one at the front, cam pins down. Check which edge faces out.", add: ["ST0", "ST1"] },
    { title: "Lock the strips", detail: "Four cam locks in the walls.", fix: [n("cam", 4, ["ST0", "ST1"], CAM)] },
    { title: "Tap dowels into the side panels", detail: "Lay both side panels flat on the rug, inside up. Fourteen dowels into their edges.", fix: sidePts("dowel", dowelSpots, { ...D }), tools: ["hammer"], warnings: ["floor"] },
    { title: "Screw in the side panels' cam pins", detail: "Six of them, by hand.", fix: sidePts("camScrew", pinSpots, PIN) },
    { title: "Screw the runner stops to the side panels", detail: "One small screw each, at the front.", fix: fx("screw", [[xl + T, 440, zf - 20], [xr - T, 440, zf - 20]].map((p, i): [Vec3, Vec3] => [p as Vec3, [i ? 1 : -1, 0, 0]]), SCR) },
    { title: "Screw the drawer runners to the side panels", detail: "One on each panel, six screws each, wheel at the front.", add: ["RU0", "RU1"], fix: runnerScrews(["RU0", "RU1"], 6), tools: ["screwdriver"] },
    { title: "Screw on the runners for the pull-out board", detail: "Higher up on each panel, three screws each.", add: ["RP0", "RP1"], fix: runnerScrews(["RP0", "RP1"], 3), tools: ["screwdriver"] },
    { title: "Tap dowels into the curved shells", detail: "Three into the edge of each shell that meets a side panel.", fix: [n("dowel", 6, ["CL", "CR"], D)], tools: ["hammer"] },
    { title: "Screw cam pins into the shells", detail: "Two in each, in the edge that meets the bottom board.", fix: [n("camScrew", 4, ["CL", "CR"], PIN)] },
    { title: "Slide the shells onto the side panels", detail: "Push them along until the dowels are all the way in. No hammer.", add: ["CL", "SL", "CR", "SR"] },
    { title: "Lock the shells", detail: "Four cam locks, two in each side panel.", fix: [n("cam", 4, ["CL", "CR"], CAM)] },
    { title: "Stand the drawer box on a side panel", detail: "Together. Lay the left side panel flat and lower the box onto it so the pins go in. No hammer from here on.", pose: "+x", people: 2, warnings: ["two"] },
    { title: "Fit the back rail", detail: "Two dowels into its ends, then push it into the side panel at the top back.", add: ["BR"], fix: [n("dowel", 2, ["BR"], D)] },
    { title: "Slide the back panel down its grooves", detail: "Smooth side out.", add: ["BK"], from: { BK: [300, 0, 0] } },
    { title: "Lay the other side panel on top", detail: "Together, so every pin and dowel finds its hole." },
    { title: "Lock this side", detail: "Six double cam locks.", fix: [n("cam", 6, ["SR"], { ...CAM, name: "Double cam lock" })] },
    { title: "Turn it over and lock the first side", detail: "Together. Four cam locks.", fix: [n("cam", 4, ["SL"], CAM)], pose: "-x", people: 2, warnings: ["two"] },
    { title: "Stand it up and fit the shelf", detail: "Three dowels in its back edge, four shelf supports in the side panels, then slide it in from the front.", add: ["SH"], fix: [
      // the dowels stand out of its back edge, so it slides in along them; the supports go in the side panels under it
      ...fx("dowel", [-250, 0, 250].map((x): [Vec3, Vec3] => [[40 + x, 591, zb + T], [0, 0, 1]]), { ...D, on: "SH" }),
      ...[-1, 1].flatMap((g) => fx("pin", [zb + 80, zf - 80].map((z): [Vec3, Vec3] => [[g < 0 ? xl + T : xr - T, 578, z], [g, 0, 0]]), { name: "Shelf support", len: 20, dia: 10, on: g < 0 ? "SL" : "SR" })),
    ], pose: "+y", from: { SH: [0, 0, 400] } },
    { title: "Dowel the changing top", detail: "Seven dowels and four cam pins in its edges.", fix: [n("dowel", 7, ["TP"], D), n("camScrew", 4, ["TP"], PIN)] },
    { title: "Lower the changing top on", detail: "Onto the left side panel and against the right one, overhanging on the left.", add: ["TP"], from: { TP: [0, 300, 0] } },
    { title: "Fix the top from underneath", detail: "Six screws up through the brackets inside the top of the carcass.", fix: [n("screw", 6, ["TP"], { len: 16, dia: 6 })], tools: ["screwdriver"] },
    { title: "Screw the back panel on", detail: "Four screws through it into the back rail.", fix: fx("screw", spread(xl + 80, xr - 80, 4).map((x): [Vec3, Vec3] => [[x, Hl - 25, zb - 4], [0, 0, 1]]), { len: 16, dia: 4 }), tools: ["screwdriver"] },
    { title: "Screw the wall fitting to the back rail", detail: "Two screws.", fix: fx("screw", [-1, 1].map((t): [Vec3, Vec3] => [[40 + t * 200, Hl - 25, zb + T], [0, 0, -1]]), { len: 16, dia: 6 }), tools: ["screwdriver"] },
    {
      title: "Fix it to the wall",
      detail: "Push it against the wall, mark and drill two holes, push in the plugs, then two long screws with spacers through the back rail. The wall plugs and screws come in the box.",
      fix: [
        ...fx("plug", [-1, 1].map((t): [Vec3, Vec3] => [[40 + t * 260, Hl - 25, zb - 20], [0, 0, -1]]), { included: true }),
        ...fx("spacer", [-1, 1].map((t): [Vec3, Vec3] => [[40 + t * 260, Hl - 25, zb - 4], [0, 0, -1]]), { len: 12, dia: 25 }),
        ...fx("screw", [-1, 1].map((t): [Vec3, Vec3] => [[40 + t * 260, Hl - 25, zb + T], [0, 0, -1]]), { len: 100, dia: 5, included: true }),
      ],
      tools: ["drill", "pencil", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Dowel the frame of the pull-out board",
      detail: "Eight dowels join the four strips round the board.",
      add: ["PO"],
      // two in each end of the side strips, into the front and back strips
      fix: [px0 + 15, px1 - 15].flatMap((x) => fx("dowel", [609, 621].flatMap((y): [Vec3, Vec3][] => [[[x, y, pz0 + 30], [0, 0, 1]], [[x, y, zf + T - 30], [0, 0, -1]]]), { ...D, on: "PO" })),
      from: { PO: [0, 0, 500] },
    },
    { title: "Screw in its cam pins and lock it", detail: "Nine cam pins and nine small cam locks.", fix: [n("camScrew", 9, ["PO"], PIN), n("cam", 9, ["PO"], { dia: 12, name: "Small cam lock" })] },
    { title: "Screw the slides under the pull-out board", detail: "Three screws each side, then push it in on its runners.", fix: fx("screw", [-1, 1].flatMap((g) => [0.2, 0.5, 0.8].map((t): [Vec3, Vec3] => [[g < 0 ? px0 + 10 : px1 - 10, 603, pz0 + t * (zf - pz0)], [0, 1, 0]])), SCR), tools: ["screwdriver"] },
    {
      title: "Fit cam pins into the drawer fronts",
      detail: "Build both drawers the same way. Lay each front face down, four cam pins in it.",
      add: drawerIds("DF"),
      fix: dr.flatMap((d, i) => fx("camScrew", [d.bx0 + 8, d.bx1 - 8].flatMap((x) => [d.by0 + 70, d.by1 - 70].map((y): [Vec3, Vec3] => [[x, y, zf], [0, 0, 1]])), { ...PIN, on: `DF${i}` })),
      from: { DF0: [0, 0, 300], DF1: [0, 0, 300] },
      repeat: 2,
      warnings: ["floor"],
    },
    {
      title: "Tap dowels into the drawer sides and stand them on",
      detail: "Three dowels into the front end of each side, then press the sides onto the front.",
      add: sides,
      fix: dr.flatMap((d, i) => [d.bx0 + 8, d.bx1 - 8].flatMap((x, j) => fx("dowel", [d.by0 + 30, (d.by0 + d.by1) / 2, d.by1 - 30].map((y): [Vec3, Vec3] => [[x, y, zf], [0, 0, -1]]), { ...D, on: `DS${i}${j}` }))),
      from: Object.fromEntries(sides.map((id) => [id, [0, 0, -300] as Vec3])),
      repeat: 2,
    },
    { title: "Lock the sides to the fronts", detail: "Four small cam locks in each drawer.", fix: [n("cam", 8, sides, { dia: 12, name: "Small cam lock" })], repeat: 2 },
    { title: "Slide the bottoms in", detail: "Into the grooves, smooth side up.", add: drawerIds("DB"), repeat: 2 },
    { title: "Fit the backs with their connectors", detail: "Press each back on, then push four connectors through the sides into it and lock it with four small cam locks.", add: drawerIds("DK"), fix: [n("dowel", 8, drawerIds("DK"), { name: "Back connector", len: 40, dia: 8 }), n("cam", 8, drawerIds("DK"), { dia: 12, name: "Small cam lock" })], repeat: 2 },
    { title: "Screw the drawer runners on", detail: "Three screws on each side of each drawer, near the bottom edge.", fix: [n("screw", 12, sides, SCR)], tools: ["screwdriver"], repeat: 2 },
    { title: "Screw the rail under each drawer", detail: "One screw at each end, through its brackets.", add: drawerIds("DR"), fix: [n("screw", 4, drawerIds("DR"), { len: 10, dia: 4 })], tools: ["screwdriver"], repeat: 2 },
    { title: "Screw on the knobs", detail: "One screw from the back of each front.", fix: fx("knob", dr.map((d): [Vec3, Vec3] => [[40, (d.y0 + d.y1) / 2, zf + T], [0, 0, -1]]), { dia: 45 }), tools: ["screwdriver"] },
    { title: "Screw the drawer stops to the backs", detail: "Two small screws in each drawer back.", fix: [n("screw", 4, drawerIds("DK"), { len: 12, dia: 4 })], tools: ["screwdriver"] },
    { title: "Hang the drawers on their runners", detail: "Pull the runners out, set each drawer on, push it home. Use the adjusters to even the gaps." },
    {
      title: "Screw cam pins into the guards",
      detail: "Six cam pins along the bottom edges of the back guard and the end guard.",
      // the guards wait beside the cot until they go on
      wait: ["RB", "RL"],
      fix: [
        ...fx("camScrew", spread(xt + 100, xr - T - 100, 4).map((x): [Vec3, Vec3] => [[x, rimY, zb + T / 2], [0, 1, 0]]), { ...PIN, on: "RB" }),
        ...fx("camScrew", spread(zb + T + 100, zt - T - 100, 2).map((z): [Vec3, Vec3] => [[xt + T / 2, rimY, z], [0, 1, 0]]), { ...PIN, on: "RL" }),
      ],
    },
    { title: "Fit the guards round the changing top", detail: "Back guard first, then the end guard and the front guard slid on from the side.", add: ["RB", "RL", "RF"], from: { RB: [0, 300, 0], RL: [0, 300, 0], RF: [-300, 0, 0] } },
    { title: "Lock the guards", detail: "Two cam locks and four double cam locks from inside.", fix: [n("cam", 2, ["RF"], CAM), n("cam", 4, ["RB", "RL"], { ...CAM, name: "Double cam lock" })] },
    {
      title: "Screw the connecting plates on",
      detail: "Two plates join the front guard to the end guard, three screws each. Keep the spare brackets: they turn the guard into a wall shelf later.",
      fix: [n("plate", 2, ["RF", "RL"], { name: "Connecting plate", len: 3, dia: 50 }), n("screw", 6, ["RF", "RL"], { len: 12, dia: 5 })],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["MYLLRA"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/myllra-(cot|crib)-drawer/.test(slug)) return cot(s);
    if (/myllra-changing-table/.test(slug)) return changingTable();
    return null;
  },
};
export default family;
