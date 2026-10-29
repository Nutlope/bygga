import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * EKENABBEN, read from its manuals. Both are built on two aspen side frames: square posts with rails on dowels,
 * screwed through the posts, lying on a rug.
 *
 * Open shelving unit: ten rails make two ladders of five, twenty screws hold them, then the five white shelves are
 * bolted between the ladders lying on their side (two bolts at each end of every shelf), four feet go in, and it is
 * fixed to the wall with two angle brackets.
 *
 * Cabinet: two frames of two posts and two rails, four screws and four feet. Push openers clip into holders on the
 * bottom. With the first frame on the floor the bottom and the top are bolted to it and the second frame bolted on.
 * Stood up, the back slides down, the white side panels slide into the frames and are held with expanding sleeves and
 * pins, and the two doors drop onto pivot pins in the bottom and click into the hinge clips at the top.
 */

type Kind = CustomFix["kind"];
const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: CustomPart["material"] = "wood"): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
});
const P = 36; // post
const BOLT = { len: 70, dia: 6 };
const SCREW = { len: 50, dia: 6 };
const FOOT = { name: "Adjustable foot", len: 20, dia: 28 };
const sides = [-1, 1] as const;
const fr = (sx: number) => (sx < 0 ? 0 : 1);

function shelving(s: ProductSpec): CustomParams {
  // IKEA: frame 70 wide, 34 deep, 154 high; five shelves
  const W = Math.round(s.size.w * 10) || 700, D = Math.round(s.size.d * 10) || 340, H = Math.round(s.size.h * 10) || 1540;
  const X = W / 2, Z = D / 2;
  const xp = X - P / 2, zp = Z - P / 2;
  const n = 5;
  const RH = 40; // rail
  const yTop = (k: number) => Math.round(150 + (k * (H - 30 - 150)) / (n - 1)); // shelf top, bottom one first
  const parts: CustomPart[] = [];
  sides.forEach((sx) => {
    [-1, 1].forEach((sz) => parts.push(box(`P${fr(sx)}${sz < 0 ? "b" : "f"}`, "Post", [sx * xp - P / 2, 12, sz * zp - P / 2], [sx * xp + P / 2, H, sz * zp + P / 2])));
    for (let k = 0; k < n; k++) parts.push(box(`R${fr(sx)}${k}`, "Rail", [sx * xp - 14, yTop(k) - RH, -zp + P / 2], [sx * xp + 14, yTop(k), zp - P / 2]));
  });
  for (let k = 0; k < n; k++) parts.push(box(`S${k}`, "Shelf", [-(xp - 14), yTop(k) - 18, -Z + 10], [xp - 14, yTop(k), Z - 10], "board"));
  const rails = (sx: number) => Array.from({ length: n }, (_, k) => `R${fr(sx)}${k}`);
  const posts = (sx: number, sz?: number) => (sz === undefined ? [-1, 1] : [sz]).map((z) => `P${fr(sx)}${z < 0 ? "b" : "f"}`);
  const railEnds = (sx: number, sz: number, dy: number) => Array.from({ length: n }, (_, k) => [sx * xp, yTop(k) - RH / 2 + dy, sz * (zp - P / 2)] as Vec3);
  const shelfBolts = (sx: number, sz: number) => Array.from({ length: n }, (_, k) => [sx * (xp + 14), yTop(k) - 9, sz * (Z - 70)] as Vec3);

  const steps: CustomStep[] = [
    {
      title: "Tap dowels into both ends of every rail",
      detail: "Two in each end of the ten rails.",
      add: [...rails(-1), ...rails(1)],
      fix: sides.flatMap((sx) => [-1, 1].map((sz) => at("dowel", [...railEnds(sx, sz, -12), ...railEnds(sx, sz, 12)], [0, 0, -sz], undefined, undefined, { len: 30, dia: 8 }))),
      tools: ["hammer"],
    },
    {
      title: "Push the rails into the posts",
      detail: "Two ladders on a rug: two posts and five rails each, the holes for the shelves facing in.",
      add: [...posts(-1), ...posts(1)],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw the ladders together",
      detail: "One screw through the post into the end of each rail, twenty in all.",
      fix: sides.flatMap((sx) => [-1, 1].map((sz) => at("screw", railEnds(sx, sz, 0).map((p) => [p[0], p[1], sz * Z] as Vec3), [0, 0, -sz], posts(sx, sz)[0], undefined, SCREW))),
      tools: ["allen"],
    },
    {
      title: "Bolt the shelves to one ladder",
      detail: "Slide the five shelves in between the ladders, white side up, ends on the rails. One bolt through the rail into each shelf, at the front.",
      add: Array.from({ length: n }, (_, k) => `S${k}`),
      // in from the front, between the two ladders, so they don't pass through the rails
      from: Object.fromEntries(Array.from({ length: n }, (_, k) => [`S${k}`, [0, 0, 500] as Vec3])),
      fix: [at("bolt", shelfBolts(-1, 1), [1, 0, 0], undefined, undefined, BOLT)],
      tools: ["allen"],
    },
    { title: "Bolt the back of the shelves", detail: "Five more bolts at the back of the same ladder.", fix: [at("bolt", shelfBolts(-1, -1), [1, 0, 0], undefined, undefined, BOLT)], tools: ["allen"] },
    {
      title: "Turn it over and bolt the other ladder",
      detail: "Ten bolts through the second ladder's rails into the shelf ends.",
      fix: [at("bolt", [...shelfBolts(1, 1), ...shelfBolts(1, -1)], [-1, 0, 0], undefined, undefined, BOLT)],
      pose: "-x",
      tools: ["allen"],
    },
    { title: "Screw a foot into each post", detail: "Into the hole in the bottom end, by hand.", fix: [at("foot", sides.flatMap((sx) => [-1, 1].map((sz) => [sx * xp, 0, sz * zp] as Vec3)), [0, 1, 0], undefined, undefined, FOOT)] },
    { title: "Stand it up and level it", detail: "Turn the feet until it stands steady and straight.", pose: "+y", warnings: ["tip"] },
    {
      title: "Fix it to the wall",
      detail: "Screw an angle bracket with a washer to the back of each rear post at the top, then screw the brackets to the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        at("angle", sides.map((sx) => [sx * xp, H - 60, -Z] as Vec3), [0, 0, 1], undefined, undefined, { name: "Wall bracket", len: 40, dia: 30 }),
        at("washer", sides.map((sx) => [sx * xp, H - 60, -Z] as Vec3), [0, 0, 1], undefined, undefined, { len: 1.5, dia: 12 }),
        at("screw", sides.map((sx) => [sx * xp, H - 60, -Z] as Vec3), [0, 0, 1], undefined, undefined, { len: 16, dia: 4, included: true }),
        at("plug", sides.map((sx) => [sx * (xp + 30), H - 60, -Z - 40] as Vec3), [0, 0, -1], undefined, undefined, { len: 35, dia: 8 }),
        at("screw", sides.map((sx) => [sx * (xp + 30), H - 60, -Z - 2] as Vec3), [0, 0, -1], undefined, undefined, { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

function cabinet(s: ProductSpec): CustomParams {
  // IKEA: 70 wide, 35 deep, 51 high, 12 free under it
  const W = Math.round(s.size.w * 10) || 700, D = Math.round(s.size.d * 10) || 350, H = Math.round(s.size.h * 10) || 510;
  const X = W / 2, Z = D / 2;
  const xp = X - P / 2, zp = Z - P / 2;
  const xi = X - P; // inside face of the frames
  const yb = 120, yt = H - 36; // bottom and top panels (top face of the top panel)
  const parts: CustomPart[] = [];
  sides.forEach((sx) => {
    const f = fr(sx);
    [-1, 1].forEach((sz) => parts.push(box(`P${f}${sz < 0 ? "b" : "f"}`, "Post", [sx * xp - P / 2, 10, sz * zp - P / 2], [sx * xp + P / 2, H, sz * zp + P / 2])));
    parts.push(box(`RT${f}`, "Rail", [sx * xp - 14, H - 40, -zp + P / 2], [sx * xp + 14, H, zp - P / 2]));
    parts.push(box(`RL${f}`, "Rail", [sx * xp - 14, yb, -zp + P / 2], [sx * xp + 14, yb + 40, zp - P / 2]));
  });
  parts.push(
    box("BT", "Bottom", [-xi, yb + 11, -Z + 6], [xi, yb + 29, Z - 4], "board"),
    box("TP", "Top", [-xi, yt - 18, -Z + 6], [xi, yt, Z - 4], "board"),
    box("BK", "Back panel", [-xi, yb + 29, -Z + 6], [xi, yt - 18, -Z + 14], "board"),
  );
  sides.forEach((sx) => parts.push(box(`SP${fr(sx)}`, "Side panel", [sx * xp - 4, yb + 40, -zp + P / 2], [sx * xp + 4, H - 40, zp - P / 2], "board")));
  const dw = xi - 2, dh = yt - 18 - (yb + 29) - 6;
  sides.forEach((sx) => parts.push(box(`DR${fr(sx)}`, "Door", [sx < 0 ? -xi : 2, yb + 32, Z - 22], [sx < 0 ? -2 : xi, yb + 32 + dh, Z - 4], "board")));

  const railEnds = (sx: number, y: number, dy: number) => [-1, 1].map((sz) => [sx * xp, y + dy, sz * (zp - P / 2)] as Vec3);
  const frameBolts = (sx: number, y: number) => [-1, 1].map((sz) => [sx * X, y, sz * (Z - 90)] as Vec3);
  const panelPins = (sx: number) => [-1, 1].flatMap((sz) => [yb + 90, H - 90].map((y) => [sx * xp, y, sz * (zp - P / 2)] as Vec3));

  const steps: CustomStep[] = [
    {
      title: "Tap dowels into the ends of the rails",
      detail: "Two in each end of all four rails.",
      add: ["RT0", "RL0", "RT1", "RL1"],
      fix: sides.flatMap((sx) => [yb + 20, H - 20].flatMap((y) => [-1, 1].map((sz) => at("dowel", [railEnds(sx, y, -12)[sz < 0 ? 0 : 1], railEnds(sx, y, 12)[sz < 0 ? 0 : 1]], [0, 0, -sz], undefined, undefined, { len: 30, dia: 8 })))),
      tools: ["hammer"],
    },
    {
      title: "Push the rails into one post of each frame",
      detail: "Lay the posts on a rug. The rail with the groove on top goes at the upper end.",
      add: [`P0b`, `P1b`],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Push the other posts on", detail: "Two frames of two posts and two rails.", add: [`P0f`, `P1f`] },
    {
      title: "Screw each top corner",
      detail: "One screw through the top rail into each post. Use the shorter screws with the coarse thread.",
      // a little out from the post's middle, clear of the rail's dowels
      fix: sides.flatMap((sx) => [-1, 1].map((sz) => at("screw", [[sx * xp, H, sz * (zp + 6)]], [0, -1, 0], `P${fr(sx)}${sz < 0 ? "b" : "f"}`, undefined, SCREW))),
      tools: ["allen"],
    },
    { title: "Screw a foot into each post", detail: "Into the bottom end, by hand.", fix: [at("foot", sides.flatMap((sx) => [-1, 1].map((sz) => [sx * xp, 0, sz * zp] as Vec3)), [0, 1, 0], undefined, undefined, FOOT)] },
    {
      title: "Screw the push opener holders onto the bottom",
      detail: "Two holders at the front, in the middle where the doors meet, two screws each.",
      fix: [
        at("plate", [-60, 60].map((x) => [x, yb + 29, Z - 40] as Vec3), [0, -1, 0], "BT", undefined, { name: "Push opener holder", len: 10, dia: 30 }),
        at("screw", [-80, -40, 40, 80].map((x) => [x, yb + 29, Z - 40] as Vec3), [0, -1, 0], "BT", undefined, { len: 12, dia: 3.5 }),
      ],
      tools: ["screwdriver"],
      pose: "+y",
      wait: ["BT"],
    },
    { title: "Click the push openers in", detail: "Push each one into its holder until it clicks, plunger to the front.", fix: [at("clip", [-60, 60].map((x) => [x, yb + 40, Z - 30] as Vec3), [0, 0, -1], "BT", undefined, { name: "Push opener", len: 50, dia: 16 })] },
    {
      title: "Bolt the bottom to the first frame",
      detail: "Lay the frame on a rug. Slide the bottom's end into the groove of the lower rail and turn two bolts through the rail into it.",
      add: ["BT"],
      fix: [at("bolt", frameBolts(-1, yb + 20), [1, 0, 0], "RL0", "BT", BOLT)],
      tools: ["allen"],
      pose: "+x",
    },
    { title: "Bolt the top to the same frame", detail: "Into the groove of the top rail, two more bolts.", add: ["TP"], fix: [at("bolt", frameBolts(-1, yt - 9), [1, 0, 0], "RT0", "TP", BOLT)], tools: ["allen"] },
    {
      title: "Bolt the second frame on",
      detail: "Lower it onto the ends of the bottom and the top, then four bolts.",
      fix: [at("bolt", [...frameBolts(1, yb + 20), ...frameBolts(1, yt - 9)], [-1, 0, 0], undefined, undefined, BOLT)],
      tools: ["allen"],
    },
    {
      title: "Stand it up and screw in the threaded sleeves",
      detail: "Four sleeves into the holes on the inside of the front posts, flush with the wood.",
      pose: "+y",
      fix: sides.map((sx) => at("connector", [yb + 70, H - 80].map((y) => [sx * (xp - P / 2), y, zp] as Vec3), [sx, 0, 0], `P${fr(sx)}f`, undefined, { name: "Threaded sleeve", len: 12, dia: 10 })),
      tools: ["screwdriver"],
    },
    { title: "Slide the back panel down", detail: "From above, in the grooves of the back posts, white side out.", add: ["BK"], from: { BK: [0, 400, 0] } },
    {
      title: "Fit the door stops",
      detail: "A sleeve and a stop pin at each front corner of the top and the bottom.",
      fix: [
        at("clip", sides.flatMap((sx) => [yb + 29, yt - 18].map((y) => [sx * (xi - 40), y, Z - 30] as Vec3)), [0, -1, 0], undefined, undefined, { name: "Sleeve", len: 8, dia: 10 }),
        at("pin", sides.flatMap((sx) => [yb + 29, yt - 18].map((y) => [sx * (xi - 40), y, Z - 30] as Vec3)), [0, -1, 0], undefined, undefined, { name: "Door stop", len: 10, dia: 12 }),
      ],
    },
    {
      title: "Pin the back panel",
      detail: "An expanding sleeve and then a pin through each back post into the panel, two a side.",
      fix: [
        at("clip", sides.flatMap((sx) => [yb + 90, yt - 70].map((y) => [sx * xi, y, -Z + 10] as Vec3)), [1, 0, 0], undefined, "BK", { name: "Expanding sleeve", len: 12, dia: 10 }),
        at("pin", sides.flatMap((sx) => [yb + 90, yt - 70].map((y) => [sx * xi, y, -Z + 10] as Vec3)), [1, 0, 0], undefined, "BK", { name: "Locking pin", len: 20, dia: 6 }),
      ],
    },
    {
      title: "Slide the side panels into the frames",
      detail: "From the outside, into the grooves, until they sit flat inside the frame.",
      add: ["SP0", "SP1"],
      from: { SP0: [-300, 0, 0], SP1: [300, 0, 0] },
    },
    {
      title: "Pin the side panels",
      detail: "Four expanding sleeves and pins in each frame, through the posts into the panel.",
      fix: sides.flatMap((sx) => [
        at("clip", panelPins(sx), [0, 0, 1], undefined, `SP${fr(sx)}`, { name: "Expanding sleeve", len: 12, dia: 10 }),
        at("pin", panelPins(sx), [0, 0, 1], undefined, `SP${fr(sx)}`, { name: "Locking pin", len: 20, dia: 6 }),
      ]),
      repeat: 2,
    },
    { title: "Push the door pivots into the bottom", detail: "One near each front corner.", fix: [at("pin", sides.map((sx) => [sx * (xi - 18), yb + 29, Z - 13] as Vec3), [0, -1, 0], "BT", undefined, { name: "Door pivot", len: 16, dia: 8 })] },
    { title: "Stand the doors on the pivots", detail: "The hole in the bottom corner of each door drops over its pivot.", add: ["DR0", "DR1"], from: { DR0: [0, 0, 300], DR1: [0, 0, 300] } },
    {
      title: "Click the doors into the top",
      detail: "Push the hinge clip at the top of each door up until it clicks into the hole under the top. Press a door to open it.",
      fix: [at("hinge", sides.map((sx) => [sx * (xi - 18), yt - 18, Z - 13] as Vec3), [0, 1, 0], undefined, undefined, { name: "Hinge clip", len: 30, dia: 20 })],
    },
    { title: "Level the cabinet", detail: "Turn the feet until it stands steady and the doors line up.", kind: "general" },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["EKENABBEN"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/open-shelving-unit/.test(slug)) return shelving(s);
    if (/ekenabben-cabinet/.test(slug)) return cabinet(s);
    return null;
  },
};
export default family;
