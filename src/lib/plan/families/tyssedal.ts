import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * TYSSEDAL, read from the bedside table's manual. The two side frames come made (two legs, a wide apron and a low
 * rail). Both get cam bolts and one a runner each; then the table is built lying on its left side: the back apron and
 * back rail on dowels, the shelf slid into the rails' grooves, the front rail, and the right side frame on top, all
 * on cam locks. Standing, the front strip is screwed under the top and the top goes on six dowels and six cam locks.
 * The drawer is a front with cam bolts, sides on long dowels, a bottom in grooves and a back on plastic cam bolts;
 * it gets its knob and two clips and rides on the runners.
 */

type K = CustomFix["kind"];
const fx = (kind: K, at: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, mate, ...o });
const CAMB = { len: 34, dia: 7 };
const CAM = { len: 12, dia: 15 };

function recipe(s: ProductSpec): CustomParams {
  // IKEA: 51 wide, 40 deep, 59 high; drawer 37 x 33 inside; 16 free under the shelf
  const W = (s.size.w || 51) * 10, D = (s.size.d || 40) * 10, H = (s.size.h || 59) * 10;
  const tt = 20, yT = H - tt; // underside of the top
  const L = 40, lx = W / 2 - 15 - L / 2, lz = D / 2 - 15 - L / 2; // legs, set in under the top's edge
  const xi = lx - L / 2, zi = lz; // between the legs; the aprons and rails line up with the legs
  const ax = lx + L / 2 - 3 - 9; // side apron, just in from the legs' outside
  const yA0 = 400, yA1 = yT, yA = (yA0 + yA1) / 2;
  const yR0 = 160, yR1 = 240, yR = (yR0 + yR1) / 2;
  const sideFrame = (sx: number): CustomPart => ({
    id: sx < 0 ? "SL" : "SR",
    name: "Side frame",
    size: [L + 3, yT, D - 30],
    pos: [sx * (lx + 1.5), yT / 2, 0],
    material: "wood",
    pieces: [
      ...[-1, 1].map((sz) => ({ shape: "box" as const, size: [L, yT, L] as Vec3, pos: [-sx * 1.5, 0, sz * lz] as Vec3 })),
      { shape: "box", size: [18, yA1 - yA0, 2 * lz - L], pos: [sx * (ax - lx - 1.5), yA - yT / 2, 0] },
      { shape: "box", size: [18, yR1 - yR0, 2 * lz - L], pos: [sx * (ax - lx - 1.5), yR - yT / 2, 0] },
    ],
  });
  const zR = zi; // back and front pieces sit in line with the legs
  const ain = ax - 9; // the side apron's inside face, where the runner goes
  // drawer: closed, its front in the opening under the strip
  const dfz0 = D / 2 - 15 - 18, dfz1 = D / 2 - 15 + 3;
  const dfy0 = yA0 + 2, dfy1 = yT - 25;
  const dsx = xi - 9 + 6 - 6 - 3, dy0 = dfy0 + 10, dy1 = dfy1 - 25, dz0 = -lz + 10;
  const parts: CustomPart[] = [
    sideFrame(-1),
    { id: "BA", name: "Back apron", size: [2 * xi, yA1 - yA0, 18], pos: [0, yA, -zR] },
    { id: "BR", name: "Back rail", size: [2 * xi, yR1 - yR0, 18], pos: [0, yR, -zR] },
    { id: "SH", name: "Shelf", size: [2 * xi, 12, 2 * (zR - 9)], pos: [0, yR + 5, 0] },
    { id: "FR", name: "Front rail", size: [2 * xi, yR1 - yR0, 18], pos: [0, yR, zR] },
    sideFrame(1),
    { id: "F", name: "Front strip", size: [2 * xi, 22, 30], pos: [0, yT - 11, zR] },
    { id: "T", name: "Table top", size: [W, tt, D], pos: [0, H - tt / 2, 0] },
    { id: "DF", name: "Drawer front", size: [2 * xi - 4, dfy1 - dfy0, dfz1 - dfz0], pos: [0, (dfy0 + dfy1) / 2, (dfz0 + dfz1) / 2] },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: i ? "DR" : "DL", name: "Drawer side", size: [12, dy1 - dy0, dfz0 - dz0], pos: [sx * (dsx - 6), (dy0 + dy1) / 2, (dfz0 + dz0) / 2] })),
    { id: "DB", name: "Drawer bottom", size: [2 * (dsx - 12), 4, dfz0 - dz0 - 12], pos: [0, dy0 + 12, (dfz0 + dz0 + 12) / 2], material: "fiber" },
    { id: "DK", name: "Drawer back", size: [2 * (dsx - 12), dy1 - dy0 - 16, 12], pos: [0, (dy0 + 16 + dy1) / 2, dz0 + 6] },
  ];
  const side = (sx: number) => (sx < 0 ? "SL" : "SR");
  // where the back apron, back rail and front rail meet each side: one cam bolt in the leg, a cam lock in the piece
  const joints = (sx: number) => [
    { y: yA, z: -zR, id: "BA", cz: -1 },
    { y: yR, z: -zR, id: "BR", cz: -1 },
    { y: yR, z: zR, id: "FR", cz: 1 },
  ].map((j) => ({ ...j, x: sx * xi, sx }));
  const camBolts = (sx: number) => fx("camScrew", joints(sx).map((j): Vec3 => [j.x, j.y, j.z]), [sx, 0, 0], side(sx), undefined, CAMB);
  const camLocks = (sx: number, ids: string[]) => {
    const js = joints(sx).filter((j) => ids.includes(j.id));
    return js.map((j) => fx("cam", [[sx * (xi - 34), j.y, j.z - j.cz * 9]], [0, 0, j.cz], j.id, undefined, CAM));
  };
  const dowels = (id: string, ys: number[], z: number) => [-1, 1].map((sx) => fx("dowel", ys.map((y): Vec3 => [sx * xi, y, z]), [sx, 0, 0], id, undefined, { len: 30, dia: 8 }));
  const runY = (dy0 + dy1) / 2;
  const topPts: Vec3[] = [...[-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * lx, yT, sz * lz])), ...[-1, 1].map((sx): Vec3 => [sx * ax, yT, 0])];
  const topCams: { at: Vec3; dir: Vec3 }[] = [
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ at: [sx * ax, yT, sz * 80] as Vec3, dir: [sx, 0, 0] as Vec3 }))),
    ...[-1, 1].map((sx) => ({ at: [sx * 110, yT, -zR] as Vec3, dir: [0, 0, -1] as Vec3 })),
  ];
  const steps: CustomStep[] = [
    {
      title: "Screw cam bolts into both side frames",
      detail: "Lay both frames on a rug, insides up. Three in each, turned in until they stop.",
      add: ["SL"],
      fix: [camBolts(-1), camBolts(1)],
      wait: ["SR"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw a runner inside each frame",
      detail: "The marked runners go left and right, flat along the wide apron, two screws each.",
      fix: [-1, 1].flatMap((sx) => [
        fx("runner", [[sx * ain, runY, 0]], [-sx, 0, 0], side(sx), undefined, { len: 340, dia: 20 }),
        fx("screw", [-100, 100].map((z): Vec3 => [sx * ain, runY, z]), [sx, 0, 0], side(sx), undefined, { len: 16, dia: 4 }),
      ]),
      tools: ["screwdriver"],
    },
    {
      title: "Stand the back apron and back rail on the left frame",
      detail: "Two dowels in each end of the apron, one in each end of the rail. Press them into the frame.",
      add: ["BA", "BR"],
      fix: [...dowels("BA", [yA - 45, yA + 45], -zR), ...dowels("BR", [yR], -zR)],
    },
    { title: "Lock them with two cam locks", detail: "Arrow towards the bolt, then turn clockwise.", fix: camLocks(-1, ["BA", "BR"]), tools: ["screwdriver"] },
    { title: "Slide the shelf into the rail's groove", detail: "Smooth side up, all the way to the back rail.", add: ["SH"], from: { SH: [0, 0, 400] } },
    { title: "Fit the front rail", detail: "One dowel in each end, then press it onto the frame and over the shelf's edge.", add: ["FR"], fix: dowels("FR", [yR], zR), from: { FR: [300, 0, 0] } },
    { title: "Lock the front rail", detail: "One cam lock.", fix: camLocks(-1, ["FR"]), tools: ["screwdriver"] },
    { title: "Lower the right frame on top", detail: "Its bolts go into the holes in the apron and rails, the runner on the inside.", add: ["SR"] },
    { title: "Lock the right frame", detail: "Three cam locks.", fix: camLocks(1, ["BA", "BR", "FR"]), tools: ["screwdriver"] },
    { title: "Stand the frame up", detail: "Turn it onto its legs.", pose: "+y" },
    {
      title: "Screw cam bolts into the top",
      detail: "Lay the top upside down on the rug. Six in the marked holes.",
      fix: [fx("camScrew", topCams.map((c) => c.at), [0, 1, 0], "T", undefined, CAMB)],
      wait: ["T"],
    },
    { title: "Tap dowels into the front strip", detail: "One in each end hole.", fix: [fx("dowel", [-1, 1].map((sx): Vec3 => [sx * (xi - 30), yT, zR]), [0, 1, 0], "F", "T", { len: 20, dia: 8 })], wait: ["F"] },
    {
      title: "Screw the strip under the top and set the top on",
      detail: "Press the strip onto the top's front edge and fix it with two screws. Then tap six dowels into the frame and lower the top onto them.",
      add: ["F", "T"],
      fix: [fx("dowel", topPts, [0, -1, 0], undefined, "T", { len: 30, dia: 8 }), fx("screw", [-1, 1].map((sx): Vec3 => [sx * 100, yT - 22, zR]), [0, 1, 0], "F", "T", { len: 30, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Lock the top with six cam locks", detail: "In the side aprons and the back apron, just under the top.", fix: topCams.map((c) => fx("cam", [[c.at[0] - c.dir[0] * 9, yT - 25, c.at[2] - c.dir[2] * 9]], c.dir, undefined, undefined, CAM)), tools: ["screwdriver"] },
    {
      title: "Screw cam bolts into the drawer front",
      detail: "Lay the front face down on the rug. Two at each end.",
      add: ["DF"],
      fix: [fx("camScrew", [-1, 1].flatMap((sx) => [dy0 + 30, dy1 - 30].map((y): Vec3 => [sx * (dsx - 6), y, dfz0])), [0, 0, 1], "DF", undefined, CAMB)],
    },
    {
      title: "Fit the drawer sides",
      detail: "Two long dowels in each side, grooves facing in and down, then press them onto the front.",
      add: ["DL", "DR"],
      fix: [-1, 1].map((sx, i) => fx("dowel", [dy0 + 12, dy1 - 12].map((y): Vec3 => [sx * (dsx - 6), y, dfz0]), [0, 0, 1], i ? "DR" : "DL", "DF", { len: 40, dia: 8 })),
    },
    { title: "Lock the sides with four cam locks", detail: "Turn each one clockwise until it holds.", fix: [-1, 1].map((sx, i) => fx("cam", [dy0 + 30, dy1 - 30].map((y): Vec3 => [sx * (dsx - 12), y, dfz0 - 30]), [sx, 0, 0], i ? "DR" : "DL", undefined, CAM)), tools: ["screwdriver"] },
    { title: "Slide in the drawer bottom", detail: "Along the grooves in both sides until it meets the front.", add: ["DB"], from: { DB: [0, 0, -350] } },
    { title: "Push the back down between the sides", detail: "The bottom goes into the back's groove.", add: ["DK"] },
    {
      title: "Push plastic cam bolts into the sides",
      detail: "Two in each side, through into the back.",
      fix: [-1, 1].map((sx, i) => fx("camScrew", [dy0 + 30, dy1 - 30].map((y): Vec3 => [sx * dsx, y, dz0 + 6]), [-sx, 0, 0], i ? "DR" : "DL", "DK", { name: "Plastic cam bolt", len: 40, dia: 8 })),
    },
    { title: "Lock the back with four cam locks", detail: "One beside each plastic cam bolt.", fix: [fx("cam", [-1, 1].flatMap((sx) => [dy0 + 30, dy1 - 30].map((y): Vec3 => [sx * 100, y, dz0 + 12])), [0, 0, -1], "DK", undefined, CAM)], tools: ["screwdriver"] },
    {
      title: "Screw on the knob",
      detail: "The screw goes through from inside the drawer.",
      fix: [fx("knob", [[0, (dfy0 + dfy1) / 2, dfz1]], [0, 0, -1], "DF"), fx("screw", [[0, (dfy0 + dfy1) / 2, dfz0]], [0, 0, 1], "DF", undefined, { len: 25, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Set the drawer on the runners",
      detail: "Pull both runners out, lower the drawer onto them and push it in. Two clips under the front catch the runners.",
      fix: [fx("clip", [-1, 1].map((sx): Vec3 => [sx * (dsx - 30), dy0, dfz0 - 30]), [0, 1, 0], "DB", undefined, { name: "Runner clip", len: 30, dia: 12 })],
    },
    { title: "Check the clips have caught", detail: "Pull the drawer out a little: it should stay on the runners." },
    { title: "Line up the drawer front", detail: "Turn the wheels on the clips until the front sits level under the strip." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["TYSSEDAL"],
  recipe(s) {
    if (!/bedside/i.test(`${s.variant} ${s.slug ?? ""}`)) return null;
    return recipe(s);
  },
};
export default family;
