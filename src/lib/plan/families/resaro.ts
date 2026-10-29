import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * RESARÖ mobile drop-leaf table, read from its manual. A pine cart: two ladder side frames joined by four rails on
 * dowels and long bolts into barrel nuts, built lying on its side on a rug. The lower panel (its leaf already hinged
 * on) and two grey shelves go in between, the other side frame closes it, then a wheel on each side frame and two
 * plastic feet at the other end. Standing up, a swing arm on two pivot brackets holds the upper leaf; two box panels
 * stand on the lower panel and the top (its leaf hinged on too) locks onto them and the posts with ten cam locks.
 * Lying on its back again, a gate leg frame is hinged to the end under the lower leaf.
 * Drawn with both leaves up, as on IKEA's photo: 41 cm long folded, 123 cm open.
 */

type Kind = CustomFix["kind"];
const fx = (kind: Kind, on: string | undefined, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at, ...o });

const BOLT = { len: 80, dia: 6 }; // the long Allen bolts
const NUT = { name: "Barrel nut", len: 14, dia: 10 };
const CAM_BOLT = { len: 34, dia: 6 };
const CAM = { dia: 15 };

function recipe(s: ProductSpec): CustomParams {
  const H = 910, L = 410, DZ = 640; // top height, the cart's length and the leaves' width
  const PT = 18, PW = 36, LZ = 225; // panels, posts, the ladders' outer faces
  const zl = LZ - 15, zi = LZ - 30; // ladder centre and inner face
  const xp = L / 2 - PW / 2, xpi = xp - PW / 2; // posts and their inner faces
  const y0 = 20, yTop = H - PT; // posts from just above the floor to under the top
  const yP1 = 700; // the lower panel's underside
  const yRl = 100, yRh = yP1 - 40; // cross rails
  const ladder = (id: string, sz: -1 | 1): CustomPart => {
    const cy = (y0 + yTop) / 2;
    const slat = (y: number, h = 40): PartPiece => ({ shape: "box", size: [2 * xpi, h, 18], pos: [0, y - cy, 0] });
    return {
      id,
      name: "Side frame",
      size: [L, yTop - y0, 30],
      pos: [0, cy, sz * zl],
      material: "wood",
      pieces: [
        ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [PW, yTop - y0, 30], pos: [sx * xp, 0, 0] })),
        slat(yRl, 60),
        ...[230, 360, 490, 620].map((y) => slat(y)),
        slat(yTop - 30, 60),
      ],
    };
  };
  const rails = [-1, 1].flatMap((sx) => [yRl, yRh].map((y) => [sx, y] as const));
  const yS = [140, 420]; // shelves' undersides
  const yB0 = yP1 + PT, boxH = yTop - yB0, zb = zi - 9;
  const parts: CustomPart[] = [
    ladder("LA", -1),
    ...rails.map(([sx, y], i): CustomPart => ({ id: `R${i}`, name: "Rail", size: [PW, 60, 2 * zi], pos: [sx * xp, y, 0], material: "wood" })),
    { id: "P1", name: "Lower panel", size: [L, PT, DZ], pos: [0, yP1 + PT / 2, 0], material: "wood" },
    { id: "L1", name: "Lower leaf", size: [L, PT, DZ], pos: [-L, yP1 + PT / 2, 0], material: "wood" },
    ...yS.map((y, i): CustomPart => ({ id: `S${i}`, name: "Shelf", size: [2 * xpi, PT, 2 * zi], pos: [0, y + PT / 2, 0], material: "board" })),
    ladder("LB", 1),
    ...[-1, 1].map((sz, i): CustomPart => ({ id: `W${i}`, name: "Wheel", size: [120, 30, 120], pos: [xp, 60, sz * (LZ + 15)], shape: "cyl", rot: [Math.PI / 2, 0, 0], material: "metal" })),
    { id: "AR", name: "Leaf support", size: [240, 50, 22], pos: [L / 2 + 120, yTop - 40, zl], material: "wood" },
    ...[-1, 1].map((sz, i): CustomPart => ({ id: `B${i}`, name: "Box panel", size: [2 * xpi, boxH, 18], pos: [0, yB0 + boxH / 2, sz * zb], material: "wood" })),
    { id: "P2", name: "Top", size: [L, PT, DZ], pos: [0, H - PT / 2, 0], material: "wood" },
    { id: "L2", name: "Upper leaf", size: [L, PT, DZ], pos: [L, H - PT / 2, 0], material: "wood" },
    {
      id: "G",
      name: "Gate leg frame",
      size: [380, yP1, 36],
      pos: [-L / 2 - 190, yP1 / 2, zl],
      material: "wood",
      pieces: [
        { shape: "box", size: [36, yP1 - 40, 36], pos: [190 - 18, 20, 0] },
        { shape: "box", size: [36, yP1, 36], pos: [-190 + 18, 0, 0] },
        { shape: "box", size: [380 - 72, 50, 30], pos: [0, 100 - yP1 / 2, 0] },
        { shape: "box", size: [380 - 72, 50, 30], pos: [0, yP1 / 2 - 45, 0] },
      ],
    },
  ];

  const railIds = rails.map((_, i) => `R${i}`);
  const railDowels = rails.flatMap(([sx, y], i) =>
    [-1, 1].map((sz) => fx("dowel", `R${i}`, [0, 0, -sz], [-15, 15].map((dy) => [sx * xp, y + dy, sz * zi] as Vec3))),
  );
  const railBolts = (sz: -1 | 1, id: string) => [
    fx("bolt", id, [0, 0, -sz], rails.map(([sx, y]) => [sx * xp, y, sz * LZ] as Vec3), BOLT),
    fx("nut", undefined, [0, -1, 0], rails.map(([sx, y]) => [sx * xp, y + 30, sz * (zi - 40)] as Vec3), NUT),
  ];
  const wheel = (i: number) => {
    const sz = i ? 1 : -1;
    return [
      fx("bolt", `W${i}`, [0, 0, -sz], [[xp, 60, sz * (LZ + 30)]], { name: "Axle bolt", len: 50, dia: 8, mate: i ? "LB" : "LA" }),
      fx("washer", `W${i}`, [0, 0, -sz], [[xp, 60, sz * (LZ + 1)]], { dia: 24 }),
    ];
  };
  const block = (on: string, y: number): CustomFix[] => [
    fx("connector", on, [0, 1, 0], [[100, y, 0]], { name: "Stop block", len: 40, dia: 60 }),
    fx("screw", on, [0, 1, 0], [[85, y - 20, 0], [115, y - 20, 0]], { len: 30, dia: 4 }),
  ];
  const shelfDowels = yS.flatMap((y, i) => [-1, 1].map((sz) => fx("dowel", `S${i}`, [0, 0, -sz], [-100, 100].map((x) => [x, y + PT / 2, sz * zi] as Vec3))));
  const postTops = [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xp, yTop, sz * zl]));
  const boxBolts = [-1, 1].map((sz, i) => fx("camScrew", "P2", [0, 1, 0], [-110, 0, 110].map((x) => [x, yTop, sz * zb] as Vec3), { ...CAM_BOLT, mate: `B${i}` }));
  const hingeYs = [160, yP1 - 120];
  const hingeScrews = (into: "G" | "LA", sx: -1 | 1) =>
    fx("screw", undefined, [sx, 0, 0], hingeYs.flatMap((y) => [-12, 12].map((dz) => [-L / 2 - sx * 4, y, zl + dz] as Vec3)), { len: 14, dia: 4, name: "Hinge screw", mate: into === "G" ? "G" : "LA" });

  const steps: CustomStep[] = [
    {
      title: "Screw the stop block under the lower panel",
      detail: "The lower panel comes with its leaf hinged on. Lay them face down on a rug and screw the block on, two screws.",
      fix: block("P1", yP1),
      wait: ["P1", "L1"],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Screw the cam bolts into the lower panel", detail: "Two, one over each end rail, by hand.", fix: [fx("camScrew", "P1", [0, 1, 0], [[-xp, yP1, 0], [xp, yP1, 0]], CAM_BOLT)], tools: ["screwdriver"] },
    { title: "Tap the dowels into the rails", detail: "Two in each end of the four short rails, sixteen in all.", fix: railDowels, wait: railIds, from: Object.fromEntries(railIds.map((id) => [id, [0, 0, 320] as Vec3])), tools: ["hammer"] },
    {
      title: "Stand the rails in one side frame",
      detail: "Lay a side frame flat on the rug, posts along the floor, and push the rails onto it: two at each end.",
      add: ["LA", ...railIds],
      from: Object.fromEntries(railIds.map((id) => [id, [0, 0, 320] as Vec3])),
      pose: "+z",
    },
    {
      title: "Bolt the rails to the side frame",
      detail: "A barrel nut into each rail, its slot facing the bolt, then a long bolt through the post into it.",
      fix: railBolts(-1, "LA"),
      tools: ["allen", "flathead"],
    },
    { title: "Bolt a wheel onto the side frame", detail: "On the outside of the post, at the end with the holes. A washer between the wheel and the bolt head.", add: ["W0"], fix: wheel(0), from: { W0: [0, 0, -160] }, tools: ["allen"] },
    { title: "Lay the lower panel in", detail: "Over the top rails, its leaf hanging out at the end without the wheel.", add: ["P1", "L1"], from: { P1: [0, 280, 0], L1: [0, 280, 0] } },
    { title: "Lock the lower panel's cam locks", detail: "Into the holes in the rails, arrow to the bolt, then turn clockwise.", fix: [fx("cam", "R1", [1, 0, 0], [[-xp - PW / 2, yRh + 10, 0]], CAM), fx("cam", "R3", [-1, 0, 0], [[xp + PW / 2, yRh + 10, 0]], CAM)], tools: ["screwdriver"] },
    { title: "Tap the dowels into the shelves", detail: "Two in each end of both grey shelves.", fix: shelfDowels, wait: ["S0", "S1"], from: { S0: [0, 0, 340], S1: [0, 0, 340] }, tools: ["hammer"] },
    { title: "Stand the shelves in", detail: "Onto the dowel holes in the side frame, the lower one near the bottom.", add: ["S0", "S1"], from: { S0: [0, 0, 340], S1: [0, 0, 340] } },
    { title: "Tap two dowels into the lower panel", detail: "Into its edge facing up.", fix: [fx("dowel", "P1", [0, 0, -1], [[-100, yP1 + PT / 2, zi], [100, yP1 + PT / 2, zi]])], tools: ["hammer"] },
    {
      title: "Lay the other side frame on",
      detail: "Press it onto all the dowels, then two bolts into barrel nuts in the lower panel.",
      add: ["LB"],
      from: { LB: [0, 0, 300] },
      fix: [
        fx("nut", "P1", [0, -1, 0], [[-xp + 40, yP1 + PT, zi - 30], [xp - 40, yP1 + PT, zi - 30]], { ...NUT, len: 10, dia: 8 }),
        fx("bolt", "LB", [0, 0, -1], [[-xp + 40, yP1 + PT / 2, LZ], [xp - 40, yP1 + PT / 2, LZ]], { len: 60, dia: 6, mate: "P1" }),
      ],
      tools: ["allen"],
    },
    { title: "Bolt the rails to this side frame", detail: "Four more barrel nuts and long bolts, the same way.", fix: railBolts(1, "LB"), tools: ["allen", "flathead"] },
    { title: "Bolt on the other wheel", detail: "At the same end as the first.", add: ["W1"], fix: wheel(1), from: { W1: [0, 0, 160] }, tools: ["allen"] },
    { title: "Tap the feet into the other end", detail: "One into the bottom of each post at the end without wheels.", fix: [fx("glide", "LA", [0, 1, 0], [-1, 1].map((sz) => [-xp, y0, sz * zl] as Vec3), { name: "Foot" })], tools: ["hammer"] },
    {
      title: "Stand it up and fit the pivot brackets",
      detail: "On the post at the wheel end, near the top: one bracket pointing down, one pointing up.",
      fix: [fx("hinge", "LB", [-1, 0, 0], [[L / 2, yTop - 10, zl], [L / 2, yTop - 70, zl]], { name: "Pivot bracket", len: 30, dia: 30 })],
      pose: "+y",
    },
    { title: "Fit the leaf support", detail: "Its pins go into the brackets. Four small screws hold the brackets.", add: ["AR"], fix: [fx("screw", "LB", [-1, 0, 0], [yTop - 10, yTop - 70].flatMap((y) => [-8, 8].map((dz) => [L / 2 + 6, y, zl + dz] as Vec3)), { len: 12, dia: 4 })], from: { AR: [160, 0, 0] }, tools: ["screwdriver"] },
    { title: "Swing the support in", detail: "Turn it flat against the side frame until the leaf is up." },
    { title: "Screw cam bolts into the tops of the posts", detail: "One in each of the four posts, by hand.", fix: [fx("camScrew", "LA", [0, -1, 0], postTops, CAM_BOLT)].map((f) => ({ ...f, on: undefined })), tools: ["screwdriver"] },
    { title: "Tap the dowels into the box panels", detail: "Four along the bottom edge of each.", fix: [0, 1].map((i) => fx("dowel", `B${i}`, [0, -1, 0], [-120, -40, 40, 120].map((x) => [x, yB0, (i ? 1 : -1) * zb] as Vec3), { mate: "P1" })), wait: ["B0", "B1"], tools: ["hammer"] },
    { title: "Stand the box panels on the lower panel", detail: "One inside each side frame, the handle holes at the top.", add: ["B0", "B1"], from: { B0: [0, 260, 0], B1: [0, 260, 0] } },
    { title: "Screw the stop block under the top", detail: "The top comes with the other leaf hinged on. Two screws, like the first one.", fix: block("P2", yTop), wait: ["P2", "L2"], tools: ["screwdriver"] },
    { title: "Screw cam bolts into the top", detail: "Six on the underside, three over each box panel.", fix: boxBolts, tools: ["screwdriver"] },
    { title: "Lay the top on", detail: "Onto the posts and box panels, its leaf at the wheel end.", add: ["P2", "L2"], from: { P2: [0, 260, 0], L2: [0, 260, 0] } },
    {
      title: "Lock all ten cam locks",
      detail: "Four in the top over the posts, three in each box panel. Arrow to the bolt, then clockwise.",
      fix: [
        fx("cam", "P2", [0, -1, 0], postTops.map(([x, , z]) => [x, H, z] as Vec3), CAM),
        ...[-1, 1].map((sz, i) => fx("cam", `B${i}`, [0, 0, sz], [-110, 0, 110].map((x) => [x, yTop - 26, sz * (zb - 9)] as Vec3), CAM)),
      ],
      tools: ["screwdriver"],
    },
    { title: "Lay it on its back and open the lower leaf", detail: "Two people. Swing the leaf out flat.", pose: "+z", people: 2 },
    {
      title: "Hinge the gate leg frame on",
      detail: "Screw the two hinges to the frame, then to the end of the cart under the lower leaf.",
      add: ["G"],
      from: { G: [-220, 0, 0] },
      fix: [fx("hinge", "G", [1, 0, 0], hingeYs.map((y) => [-L / 2 - 1, y, zl] as Vec3), { len: 50, dia: 30 }), hingeScrews("G", -1)],
      tools: ["screwdriver"],
    },
    { title: "Screw the hinges to the cart", detail: "Two screws in each hinge, into the post.", fix: [hingeScrews("LA", 1)], tools: ["screwdriver"] },
    { title: "Tap the catch into the gate leg", detail: "At its free end, so it clicks against the leaf.", fix: [fx("clip", "G", [0, -1, 0], [[-L / 2 - 362, yP1, zl]], { name: "Catch", len: 20, dia: 30 })], tools: ["hammer"] },
    { title: "Swing the gate leg in and stand it up", detail: "Fold the leaves down when you don't need them; the gate leg folds flat against the end.", pose: "+y", people: 2 },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["RESARÖ", "RESARO"],
  recipe(s: ProductSpec) {
    if (!/drop-leaf/.test(s.slug ?? "")) return null;
    return recipe(s);
  },
};
export default family;
