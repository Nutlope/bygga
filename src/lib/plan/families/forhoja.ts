import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FÖRHÖJA kitchen trolley (solid birch), read from its manual. Each slatted shelf is ten numbered slats pressed
 * between two rails and held with two screws. The drawer frame (back rail, front rail, two runners and a divider)
 * goes together on its own dowels. The trolley is then built lying on its plain end: the shelves and the drawer frame
 * stand on that end frame on dowels (8 + 4), the end frame with the wheels goes on top and six long Allen screws go
 * through each end. Stood up, the top goes on with two cam bolts and cam locks and four screws through the end rails,
 * and the two drawers slide in (they pull out from both sides).
 * IKEA: 100 x 43 x 90 cm.
 */

const LEG = 45;
const r = (n: number) => Math.round(n);

function trolley(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 1000, D = Math.round(s.size.d * 10) || 430, H = Math.round(s.size.h * 10) || 900;
  const T = 28, yT = H - T; // top thickness, its underside
  const lx = W / 2 - 80, lz = D / 2 - 30; // leg centres
  const inX = lx - LEG / 2; // inside faces of the legs
  const railL = 2 * inX, rz = lz; // long rails run between the legs, in line with them
  const shelfY = [150, 480];

  const parts: CustomPart[] = [];
  for (const [id, sx] of [["EL", -1], ["ER", 1]] as const) {
    const c: Vec3 = [sx * lx, yT / 2, 0];
    const pieces: PartPiece[] = [
      { shape: "box", size: [LEG, yT, LEG], pos: [0, 0, -lz] },
      { shape: "box", size: [LEG, yT, LEG], pos: [0, 0, lz] },
      { shape: "box", size: [LEG, 60, 2 * lz - LEG], pos: [0, yT - 30 - yT / 2, 0] },
    ];
    // the wheels sit outside the legs at the left end
    if (sx < 0) for (const z of [-lz, lz]) pieces.push({ shape: "cyl", size: [80, 20, 80], pos: [-LEG / 2 - 12, 40 - yT / 2, z], rot: [0, 0, Math.PI / 2], material: "board" });
    parts.push({ id, name: sx < 0 ? "End frame with wheels" : "End frame", size: [LEG + (sx < 0 ? 44 : 0), yT, D - 60 + LEG], pos: c, material: "wood", pieces });
  }
  shelfY.forEach((y, k) => {
    for (const sz of [-1, 1]) parts.push({ id: `R${k}${sz < 0 ? "b" : "f"}`, name: "Shelf rail", size: [railL, 45, 22], pos: [0, y, sz * rz], material: "wood" });
    for (let i = 0; i < 10; i++) {
      const x = -railL / 2 + railL * (i + 0.5) / 10;
      parts.push({ id: `S${k}_${i}`, name: "Slat", size: [45, 20, 2 * rz - 22], pos: [x, y + 12, 0], material: "wood" });
    }
  });
  // the drawer frame, under the top
  const yD = yT - 90;
  parts.push(
    { id: "DB", name: "Back rail", size: [railL, 90, 20], pos: [0, yT - 45, -rz], material: "wood" },
    { id: "DF", name: "Front rail", size: [railL, 30, 20], pos: [0, yD + 15, rz], material: "wood" },
    { id: "U1", name: "Drawer runner", size: [20, 30, 2 * rz - 20], pos: [-inX + 10, yD + 15, 0], material: "wood" },
    { id: "U2", name: "Drawer runner", size: [20, 30, 2 * rz - 20], pos: [inX - 10, yD + 15, 0], material: "wood" },
    { id: "DV", name: "Divider", size: [20, 90, 2 * rz - 20], pos: [0, yT - 45, 0], material: "wood" },
  );
  parts.push({
    id: "TOP",
    name: "Table top",
    size: [W, T + 25, D],
    pos: [0, H - (T + 25) / 2, 0],
    material: "wood",
    pieces: [
      { shape: "box", size: [W, T, D], pos: [0, 12.5, 0] },
      // two battens across the underside, just inside the end rails
      { shape: "box", size: [40, 25, 2 * rz - 20], pos: [-inX + 20, -T / 2, 0] },
      { shape: "box", size: [40, 25, 2 * rz - 20], pos: [inX - 20, -T / 2, 0] },
    ],
  });
  // on the runners, under the top's battens, from the back rail's face to just past the front rail
  const dw = inX - 30, dh = 55;
  for (const [id, sx] of [["DR1", -1], ["DR2", 1]] as const)
    parts.push({ id, name: "Drawer", size: [dw, dh, 2 * rz], pos: [(sx * (inX + 10)) / 2, yD + 30 + dh / 2, 10], material: "wood" });

  const shelfIds = (k: number) => [`R${k}b`, ...Array.from({ length: 10 }, (_, i) => `S${k}_${i}`)];
  const rails = shelfY.flatMap((_, k) => [`R${k}b`, `R${k}f`]);
  const endPts = (sx: number, ys: number[], zs: number[]) => ys.flatMap((y) => zs.map((z): Vec3 => [sx * inX, y, z]));
  // dowels: two in each rail end, one above the other
  const shelfDowels = (sx: number): CustomFix[] =>
    rails.map((r) => {
      const k = Number(r[1]), z = r[2] === "b" ? -rz : rz;
      return { kind: "dowel", count: 2, at: endPts(sx, [shelfY[k] - 10, shelfY[k] + 10], [z]), dir: [sx, 0, 0], on: r, mate: sx < 0 ? "EL" : "ER" };
    });
  const frameDowels = (sx: number): CustomFix[] => [
    { kind: "dowel", count: 2, at: endPts(sx, [yT - 70, yT - 25], [-rz]), dir: [sx, 0, 0], on: "DB", mate: sx < 0 ? "EL" : "ER" },
    { kind: "dowel", count: 2, at: [[sx * inX, yD + 3.5, rz], [sx * inX, yD + 26.5, rz]], dir: [sx, 0, 0], on: "DF", mate: sx < 0 ? "EL" : "ER" },
  ];
  const longScrews = (sx: number): CustomFix => ({
    kind: "bolt",
    name: "Long screw",
    count: 6,
    len: 90,
    dia: 6,
    at: [...shelfY.flatMap((y) => [-rz, rz].map((z): Vec3 => [sx * (lx + LEG / 2), y, z])), [sx * (lx + LEG / 2), yT - 45, -rz], [sx * (lx + LEG / 2), yD + 15, rz]],
    dir: [-sx, 0, 0],
    on: sx < 0 ? "EL" : "ER",
  });

  return {
    parts,
    steps: [
      {
        title: "Press ten slats into a shelf rail",
        detail: "Keep the slats in their numbered order and the rail's two-hole edge facing the right way. Do it for both shelves.",
        add: [...shelfIds(0), ...shelfIds(1)],
        pose: "+z",
        warnings: ["floor"],
      },
      {
        title: "Press on the second rail",
        detail: "Turn the shelf over and press the other rail onto the free slat ends, again for both shelves.",
        add: ["R0f", "R1f"],
      },
      {
        title: "Screw the rails to the middle slat",
        detail: "Lay each shelf flat. One small screw through each rail into the middle slat.",
        fix: shelfY.flatMap((y, k) => [-1, 1].map((sz): CustomFix => ({ kind: "screw", count: 1, len: 35, dia: 4, at: [[r(-railL / 2 + railL * 0.55), y + 5, sz * (rz + 11)]], dir: [0, 0, -sz], on: `R${k}${sz < 0 ? "b" : "f"}`, mate: `S${k}_5` }))),
        tools: ["screwdriver"],
        pose: "+y",
      },
      {
        title: "Fit the drawer frame together",
        detail: "Its dowels are already in. Push the two runners and the divider into the back rail, then put the front rail on.",
        add: ["DB", "U1", "U2", "DV", "DF"],
      },
      {
        title: "Stand the shelves on the plain end frame",
        detail: "Lay the end frame without wheels on a rug, holes up, and push the shelves in on end. Then tap two dowels into the top of each rail.",
        add: ["ER"],
        fix: shelfDowels(-1),
        pose: "-x",
        tools: ["hammer"],
        warnings: ["floor"],
      },
      {
        title: "Add the drawer frame",
        detail: "Push it into the top of the end frame next to the shelves, then tap two dowels into the free end of each of its rails.",
        fix: frameDowels(-1),
        tools: ["hammer"],
      },
      {
        title: "Put the end frame with wheels on top",
        detail: "Lower it onto all the dowels, then put six long screws through it, with the Allen key in its long handle.",
        add: ["EL"],
        fix: [longScrews(-1)],
        tools: ["allen"],
        people: 2,
      },
      { title: "Turn the trolley over", detail: "Roll it onto its other end with a helper, wheels now on the floor side.", pose: "+x", people: 2 },
      { title: "Screw through the other end", detail: "Six long screws again, through the plain end frame.", fix: [longScrews(1)], tools: ["allen"] },
      {
        title: "Screw two cam bolts into the top",
        detail: "Stand the trolley up. Lay the top face down on a rug and turn the cam bolts into the two holes in the middle.",
        fix: [{ kind: "camScrew", count: 2, len: 30, at: [[0, yT, -rz / 2], [0, yT, rz / 2]], dir: [0, 1, 0], on: "TOP", mate: "DV" }],
        wait: ["TOP"],
        tools: ["screwdriver"],
        pose: "+y",
      },
      {
        title: "Lay the top on",
        detail: "Lower the top onto the frame so the cam bolts go into the divider.",
        add: ["TOP"],
        from: { TOP: [0, 300, 0] },
      },
      {
        title: "Turn the cam locks",
        detail: "Two in the divider, turned clockwise with a screwdriver until they pull the top down tight.",
        fix: [{ kind: "cam", count: 2, dia: 15, at: [[10, yT - 20, -rz / 2], [10, yT - 20, rz / 2]], dir: [-1, 0, 0], on: "DV" }],
        tools: ["screwdriver"],
      },
      {
        title: "Screw the top to the end frames",
        detail: "Two screws through each end rail into the batten under the top.",
        fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 2, len: 35, dia: 4, at: [-1, 1].map((sz): Vec3 => [sx * (lx + LEG / 2), yT - 20, sz * 100]), dir: [-sx, 0, 0], on: sx < 0 ? "EL" : "ER", mate: "TOP" })),
        tools: ["screwdriver"],
      },
      { title: "Slide in the drawers", detail: "One each side of the divider. They run on the runners and pull out from either side.", add: ["DR1", "DR2"], from: { DR1: [0, 0, 450], DR2: [0, 0, 450] } },
    ],
  };
}

const family: Family = {
  names: ["FÖRHÖJA", "FORHOJA"],
  recipe(s) {
    if (/^forhoja-kitchen-trolley/.test(s.slug ?? "")) return trolley(s);
    return null;
  },
};
export default family;
