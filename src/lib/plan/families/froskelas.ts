import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FRÖSKELÅS, read from its manuals.
 *
 * Storage unit: four steel posts take a foot each, lying on a rug the top and bottom shelves are screwed between two
 * of them and the other two go on top. Stood up, the two middle shelves hook onto the posts and are screwed, the cross
 * brace goes on the back, the feet are levelled, and two perforated strips fix it to the wall (or the desk).
 *
 * Gaming desk: the two side frames are joined by the long stretcher and the cable tray (bolts and cam locks), the tray
 * bottom drops in, and the frame is turned upside down onto the desktop, which has its brackets and cam pins in.
 * Turned over by two people, the uprights are bolted to the back legs, the rails, centre panel and headset holder go
 * on, then the two middle pegboards, the cup holders, the hooks and the two side pegboards on their clamp arms.
 */

type Kind = CustomFix["kind"];
const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const box = (id: string, name: string, lo: Vec3, hi: Vec3, material: CustomPart["material"] = "metal"): CustomPart => ({
  id,
  name,
  size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
  pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2],
  material,
});
const tubeY = (id: string, name: string, x: number, z: number, y0: number, y1: number, d = 25): CustomPart => ({ id, name, size: [d, y1 - y0, d], pos: [x, (y0 + y1) / 2, z], shape: "cyl", material: "metal" });
const sides = [-1, 1] as const;
const SCREW = { len: 12, dia: 6 };
const BOLT = { len: 30, dia: 6 };

function storage(s: ProductSpec): CustomParams {
  // IKEA: 63 wide, 35 deep, 141 high; shelves 56 wide
  const W = Math.round(s.size.w * 10) || 630, D = Math.round(s.size.d * 10) || 350, H = Math.round(s.size.h * 10) || 1410;
  const xp = W / 2 - 13, zp = D / 2 - 13;
  const sw = 2 * (xp - 12.5), sd = D - 20; // the shelf's end flanges meet the posts
  const ys = [90, 470, 840, H - 30]; // shelf tops, bottom first
  const parts: CustomPart[] = [];
  const postId = (sx: number, sz: number) => `P${sx < 0 ? "l" : "r"}${sz < 0 ? "b" : "f"}`;
  sides.forEach((sx) => sides.forEach((sz) => parts.push(tubeY(postId(sx, sz), "Post", sx * xp, sz * zp, 15, H))));
  ys.forEach((y, k) => {
    const pieces: PartPiece[] = [
      { shape: "box", size: [sw, 2, sd], pos: [0, 9, 0] },
      ...sides.map((g): PartPiece => ({ shape: "box", size: [sw, 20, 2], pos: [0, 0, g * (sd / 2 - 1)] })),
      ...sides.map((g): PartPiece => ({ shape: "box", size: [2, 20, sd], pos: [g * (sw / 2 - 1), 0, 0] })),
    ];
    parts.push({ id: `S${k}`, name: "Shelf", size: [sw, 20, sd], pos: [0, y - 10, 0], pieces, material: "metal" });
  });
  // the cross brace on the back, between the second shelf and the top
  const dx = 2 * xp, dy = ys[3] - ys[1];
  const ang = Math.atan2(dy, dx), len = Math.hypot(dx, dy);
  const brace = (id: string, sgn: number): CustomPart => ({
    id,
    name: "Cross brace",
    size: [dx, dy, 4],
    pos: [0, (ys[1] + ys[3]) / 2, -zp],
    pieces: [{ shape: "cyl", size: [5, len, 5], pos: [0, 0, sgn * 2], rot: [0, 0, sgn * (Math.PI / 2 - ang)] }],
    material: "metal",
  });
  parts.push(brace("X0", 1), brace("X1", -1));

  // through the post into the shelf's end flange
  const shelfScrews = (k: number) => sides.flatMap((sx) => sides.map((sz) => [sx * (xp + 12.5), ys[k] - 10, sz * zp] as Vec3));
  const screwFix = (ks: number[]) => sides.map((sx) => at("screw", ks.flatMap((k) => shelfScrews(k).filter((p) => Math.sign(p[0]) === sx)), [-sx, 0, 0], undefined, undefined, SCREW));
  const steps: CustomStep[] = [
    {
      title: "Screw a foot into each post",
      detail: "Lay the posts on a rug and turn a foot into the bottom end of each, by hand.",
      add: [postId(-1, -1), postId(-1, 1), postId(1, -1), postId(1, 1)],
      fix: [at("foot", sides.flatMap((sx) => sides.map((sz) => [sx * xp, 0, sz * zp] as Vec3)), [0, 1, 0], undefined, undefined, { name: "Adjustable foot", len: 15, dia: 30 })],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw the top and bottom shelves to two posts",
      detail: "Stand both shelves on edge between the two posts lying on the rug. Two screws into each shelf end.",
      add: ["S0", "S3"],
      fix: [screwFix([0, 3])[0]],
      tools: ["allen"],
    },
    { title: "Lay the other two posts on", detail: "Line them up with the free shelf ends and screw them on, two screws a shelf end.", fix: [screwFix([0, 3])[1]], tools: ["allen"] },
    { title: "Stand it up and hook in the middle shelves", detail: "Hook each shelf onto the posts at its height. The hooks go over the post, lip down.", add: ["S1", "S2"], pose: "+y", from: { S1: [0, 0, 400], S2: [0, 0, 400] } },
    { title: "Screw the middle shelves", detail: "Eight screws, two at each end of both shelves.", fix: screwFix([1, 2]), tools: ["allen"] },
    {
      title: "Screw the cross brace onto the back",
      detail: "Its four ends go to the back posts, at the top and at the second shelf. One screw in each.",
      add: ["X0", "X1"],
      fix: [at("screw", sides.flatMap((sx) => [ys[1], ys[3]].map((y) => [sx * xp, y - 30, -zp - 12] as Vec3)), [0, 0, 1], undefined, undefined, { len: 10, dia: 5 })],
      from: { X0: [0, 0, -300], X1: [0, 0, -300] },
      tools: ["screwdriver"],
    },
    { title: "Level it", detail: "Turn the feet until it stands steady.", warnings: ["tip"] },
    {
      title: "Screw the wall strips to the back posts",
      detail: "One strip on each back post near the top, with a screw and washer.",
      fix: [
        at("strap", sides.map((sx) => [sx * xp, H - 80, -zp - 12] as Vec3), [0, 0, 1], undefined, undefined, { name: "Wall strip", len: 200, dia: 20 }),
        // the screw first so the washer stacks on it rather than pushing it off the post
        at("screw", sides.map((sx) => [sx * xp, H - 120, -zp - 14] as Vec3), [0, 0, 1], undefined, undefined, { len: 10, dia: 5, included: true }),
        at("washer", sides.map((sx) => [sx * xp, H - 120, -zp - 14] as Vec3), [0, 0, 1], undefined, undefined, { len: 1.5, dia: 14 }),
      ],
      tools: ["screwdriver"],
      wall: false,
    },
    {
      title: "Fix it to the wall",
      detail: "Mark through the strips, drill two holes and screw the strips to the wall. Wall screws and plugs aren't included: pick ones made for your wall. It can also clip onto the desk instead.",
      fix: [
        at("plug", sides.map((sx) => [sx * xp, H - 120, -D / 2 - 40] as Vec3), [0, 0, -1], undefined, undefined, { len: 35, dia: 8 }),
        at("screw", sides.map((sx) => [sx * xp, H - 120, -D / 2 - 2] as Vec3), [0, 0, -1], undefined, undefined, { len: 50, dia: 5 }),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

function desk(s: ProductSpec): CustomParams {
  // IKEA: 144 wide, 71 deep, 72 high to the desktop, 141 to the top of the pegboards
  const W = Math.round(s.size.w * 10) || 1440, D = Math.round(s.size.d * 10) || 710;
  const Ht = 720, HT = 1410;
  const T = 25;
  const xf = W / 2 - 60, zf = D / 2 - 50, zb = -D / 2 + 40;
  const yTop = Ht - T;
  const parts: CustomPart[] = [];
  sides.forEach((sx) => {
    const i = sx < 0 ? 0 : 1;
    const c: Vec3 = [sx * xf, yTop / 2, (zf + zb) / 2];
    const rel = (p: Vec3): Vec3 => [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    const pieces: PartPiece[] = [
      { shape: "cyl", size: [30, yTop, 30], pos: rel([sx * xf, yTop / 2, zf]) },
      { shape: "cyl", size: [30, yTop, 30], pos: rel([sx * xf, yTop / 2, zb]) },
      { shape: "cyl", size: [30, zf - zb, 30], pos: rel([sx * xf, yTop - 15, (zf + zb) / 2]), rot: [Math.PI / 2, 0, 0] },
      { shape: "cyl", size: [25, zf - zb, 25], pos: rel([sx * xf, 200, (zf + zb) / 2]), rot: [Math.PI / 2, 0, 0] },
    ];
    parts.push({ id: `F${i}`, name: "Side frame", size: [30, yTop, zf - zb + 30], pos: c, pieces, material: "metal" });
  });
  parts.push({ id: "ST", name: "Stretcher", size: [25, 2 * xf - 30, 25], pos: [0, 200, zb], shape: "cyl", material: "metal", rot: [0, 0, Math.PI / 2] });
  parts.push(box("CT", "Cable tray", [-(xf - 15), yTop - 150, zb - 10], [xf - 15, yTop - 10, zb + 8], "board"));
  parts.push(box("CB", "Cable tray bottom", [-(xf - 15), yTop - 168, zb + 8], [xf - 15, yTop - 150, zb + 160], "board"));
  // the desktop, with the opening at the back for cables
  const notch = 500, nd = 80;
  const topPieces: PartPiece[] = [
    { shape: "box", size: [W, T, D - nd], pos: [0, 0, nd / 2] },
    ...sides.map((g): PartPiece => ({ shape: "box", size: [(W - notch) / 2, T, nd], pos: [g * (W / 2 - (W - notch) / 4), 0, -D / 2 + nd / 2] })),
  ];
  parts.push({ id: "DT", name: "Desktop", size: [W, T, D], pos: [0, Ht - T / 2, 0], pieces: topPieces, material: "board" });
  sides.forEach((sx) => parts.push(tubeY(`U${sx < 0 ? 0 : 1}`, "Upright", sx * xf, zb, Ht, HT, 30)));
  parts.push({ id: "RL", name: "Pegboard rail", size: [20, 2 * xf - 30, 20], pos: [0, Ht + 120, zb], shape: "cyl", material: "metal", rot: [0, 0, Math.PI / 2] });
  parts.push(box("CP", "Centre panel", [-80, Ht + 60, zb - 20], [80, HT - 60, zb - 2], "board"));
  const pw = (2 * xf - 30 - 160) / 2 - 10;
  sides.forEach((sx) => parts.push(box(`PB${sx < 0 ? 0 : 1}`, "Pegboard", [sx < 0 ? -80 - 5 - pw : 85, HT - 620, zb - 24], [sx < 0 ? -85 : 85 + pw, HT - 60, zb - 20], "board")));
  // the side pegboards fold forward on their clamp arms
  sides.forEach((sx) => parts.push(box(`PS${sx < 0 ? 0 : 1}`, "Side pegboard", [sx * (xf + 30) - 2, HT - 620, zb + 20], [sx * (xf + 30) + 2, HT - 60, zb + 420], "board")));
  sides.forEach((sx) => parts.push({ id: `CH${sx < 0 ? 0 : 1}`, name: "Cup holder", size: [80, 60, 80], pos: [sx * (W / 2 - 90), Ht - 30, zf - 40], shape: "cyl", material: "metal" }));

  const frameBolt = (sx: number, y: number, z: number): Vec3 => [sx * (xf - 15), y, z];
  const steps: CustomStep[] = [
    { title: "Screw the connectors into the side frames", detail: "Two in the back leg of each frame, by hand.", add: ["F0", "F1"], fix: sides.map((sx) => at("camScrew", [yTop - 110, yTop - 50].map((y) => frameBolt(sx, y, zb)), [sx, 0, 0], `F${sx < 0 ? 0 : 1}`, "CT", { len: 20 })), tools: ["screwdriver"], warnings: ["floor"] },
    { title: "Bolt the stretcher to one side frame", detail: "Lay the frame on a rug. One Allen bolt through the frame into the stretcher's end.", add: ["ST"], fix: [at("bolt", [[-xf - 15, 200, zb]], [1, 0, 0], "F0", "ST", BOLT)], tools: ["allen"], pose: "+x" },
    { title: "Fit the cable tray and lock it", detail: "Push it onto the connectors on the frame, then turn two cam locks.", add: ["CT"], fix: [at("cam", [yTop - 110, yTop - 50].map((y) => [-(xf - 40), y, zb] as Vec3), [0, 0, 1], "CT", "F0", { dia: 15 })], tools: ["screwdriver"] },
    {
      title: "Put the other side frame on",
      detail: "Onto the stretcher and the tray's connectors. One bolt into the stretcher and two cam locks in the tray.",
      fix: [at("bolt", [[xf + 15, 200, zb]], [-1, 0, 0], "F1", "ST", BOLT), at("cam", [yTop - 110, yTop - 50].map((y) => [xf - 40, y, zb] as Vec3), [0, 0, 1], "CT", "F1", { dia: 15 })],
      tools: ["allen", "screwdriver"],
    },
    {
      title: "Lower the tray bottom in",
      detail: "Stand the frame up. Lower the tray bottom in together, then two bolts through the back legs into the tray and two dowels where it meets the tray.",
      add: ["CB"],
      pose: "+y",
      fix: [...sides.map((sx) => at("bolt", [[sx * (xf + 15), yTop - 120, zb]], [-sx, 0, 0], `F${sx < 0 ? 0 : 1}`, "CT", BOLT)), at("dowel", [-200, 200].map((x) => [x, yTop - 150, zb + 8] as Vec3), [0, 0, -1], "CB", "CT", { len: 30, dia: 8 })],
      people: 2,
      warnings: ["two"],
      tools: ["allen", "hammer"],
    },
    {
      title: "Fit the brackets and cam pins under the desktop",
      detail: "Lay the desktop upside down on a rug. Four brackets screwed on near the corners, and four cam pins.",
      add: ["DT"],
      pose: "-y",
      fix: [
        at("angle", sides.flatMap((sx) => [zb, zf].map((z) => [sx * (xf - 40), yTop, z] as Vec3)), [0, 1, 0], "DT", undefined, { name: "Bracket", len: 40, dia: 30 }),
        at("camScrew", [-300, -100, 100, 300].map((x) => [x, yTop, zb + 20] as Vec3), [0, 1, 0], "DT", "CT", { len: 20 }),
      ],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Lower the frame onto the desktop",
      detail: "Upside down, legs up. Turn four cam locks in the tray, two bolts through the frames, and six screws through the brackets and the tray into the top.",
      fix: [
        at("cam", [-300, -100, 100, 300].map((x) => [x, yTop - 30, zb + 8] as Vec3), [0, 0, -1], "CT", undefined, { dia: 15 }),
        at("bolt", sides.map((sx) => [sx * xf, yTop - 15, (zf + zb) / 2] as Vec3), [0, 1, 0], undefined, "DT", BOLT),
        // clear of the cable opening in the desktop and of the cam pins
        at("screw", [-560, -450, -360, 360, 450, 560].map((x) => [x, yTop - 10, zb + 4] as Vec3), [0, 1, 0], "CT", "DT", { len: 16, dia: 4 }),
      ],
      tools: ["allen", "screwdriver"],
    },
    {
      title: "Turn it over and bolt on the uprights",
      detail: "Turn the desk over together. Push an upright into the top of each back leg and fix it with two bolts.",
      add: ["U0", "U1"],
      pose: "+y",
      fix: sides.map((sx) => at("bolt", [Ht + 30, Ht + 80].map((y) => [sx * (xf + 15), y, zb] as Vec3), [-sx, 0, 0], `U${sx < 0 ? 0 : 1}`, undefined, BOLT)),
      people: 2,
      warnings: ["two"],
      tools: ["allen"],
    },
    {
      title: "Bolt the pegboard rail between the uprights",
      detail: "Clamp it on at the height in the picture, two bolts at each end.",
      add: ["RL"],
      fix: sides.map((sx) => at("bolt", [[sx * (xf - 15), Ht + 120, zb]], [sx, 0, 0], "RL", `U${sx < 0 ? 0 : 1}`, BOLT)),
      tools: ["allen"],
    },
    {
      title: "Screw the centre panel to the rail",
      detail: "Four screws, then the headset holder on top with two more.",
      add: ["CP"],
      fix: [at("screw", [-40, 40].flatMap((x) => [Ht + 100, Ht + 140].map((y) => [x, y, zb - 20] as Vec3)), [0, 0, 1], "CP", "RL", { len: 16, dia: 4 }), at("hook", [[0, HT - 60, zb - 11]], [0, -1, 0], "CP", undefined, { name: "Headset holder", len: 60, dia: 40 })],
      tools: ["screwdriver"],
    },
    {
      title: "Hang the middle pegboards",
      detail: "Four pegs in each, through the board into the uprights and the centre panel.",
      add: ["PB0", "PB1"],
      fix: [at("pin", sides.flatMap((sx) => [HT - 560, HT - 120].flatMap((y) => [sx * 100, sx * (xf - 30)].map((x) => [x, y, zb - 24] as Vec3))), [0, 0, 1], undefined, undefined, { name: "Pegboard peg", len: 20, dia: 10 })],
      from: { PB0: [0, 0, 300], PB1: [0, 0, 300] },
    },
    { title: "Push in the cup holders", detail: "Into the round holes at the front corners of the desktop.", add: ["CH0", "CH1"], from: { CH0: [0, 200, 0], CH1: [0, 200, 0] } },
    {
      title: "Hang the side pegboards on their clamp arms",
      detail: "Clamp an arm round each upright, top and bottom, and push four pegs through each side pegboard into its arms. Swing them out or fold them forward.",
      add: ["PS0", "PS1"],
      fix: [
        at("clamp", sides.flatMap((sx) => [HT - 560, HT - 120].map((y) => [sx * xf, y, zb] as Vec3)), [0, -1, 0], undefined, undefined, { name: "Clamp arm", len: 40, dia: 40 }),
        at("pin", sides.flatMap((sx) => [HT - 560, HT - 120].flatMap((y) => [zb + 80, zb + 360].map((z) => [sx * (xf + 32), y, z] as Vec3))), [-1, 0, 0], undefined, undefined, { name: "Pegboard peg", len: 20, dia: 10 }),
      ],
      tools: ["allen"],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["FRÖSKELÅS", "FROSKELAS"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/froskelas-storage-unit/.test(slug)) return storage(s);
    if (/froskelas-gaming-desk/.test(slug)) return desk(s);
    return null;
  },
};
export default family;
