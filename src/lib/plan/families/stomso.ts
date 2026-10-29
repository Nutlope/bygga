import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * STOMSÖ wall-mounted bedside table, read from its manual. It is built upside down on a rug: the top lies face
 * down, one steel side is screwed onto it, the cross brace with its two bumpers clicks into that side, the other
 * side clicks on and is screwed down, and the bottom board is screwed on last. Turned over, a glide strip goes in
 * each runner, it is levelled and hung on two wall screws and locked with two hooks. The drawer is a steel tray:
 * the back slots in, the sides fold up, two screws hold the back and four the wooden front. It slides in last.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

/** A part drawn as pieces given in product coordinates: the pieces are moved to be relative to the part's centre. */
function compound(id: string, name: string, pos: Vec3, pieces: PartPiece[], material: CustomPart["material"]): CustomPart {
  const lo = [0, 1, 2].map((i) => Math.min(...pieces.map((p) => p.pos[i] - p.size[i] / 2)));
  const hi = [0, 1, 2].map((i) => Math.max(...pieces.map((p) => p.pos[i] + p.size[i] / 2)));
  return {
    id,
    name,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    pos,
    material,
    pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]] as Vec3 })),
  };
}

/** Top and bottom boards: square at the back, a gentle wave along the front edge. */
function board(id: string, name: string, W: number, T: number, D: number, y: number): CustomPart {
  const w = W / 2, d = D / 2;
  const front: [number, number][] = [[w, d], [w * 0.55, d], [w * 0.3, d - 8], [0, d - 14], [-w * 0.3, d - 8], [-w * 0.55, d], [-w, d]];
  return { id, name, size: [W, T, D], pos: [0, y, 0], material: "wood", pieces: [{ shape: "slab", size: [W, T, D], pos: [0, 0, 0], outline: [[-w, -d], [w, -d], ...front], round: 6 }] };
}

function recipe(s: ProductSpec): CustomParams | null {
  if (!/bedside/i.test(`${s.slug ?? ""} ${s.variant}`)) return null;
  // IKEA's measures: 36 wide, 29 deep, 20 high; drawer 27 x 24 x 6.5 inside
  const W = 360, D = 290, H = 200, T = 16;
  const xo = W / 2, xi = xo - 6; // outer and inner face of the steel sides
  const zb = -D / 2, zf = D / 2 - 4; // the sides stop just short of the front edge
  const ly0 = 92, ly1 = 102; // the runner ledge folded into each side
  const parts: CustomPart[] = [];
  parts.push(board("TOP", "Top", W, T, D, H - T / 2));
  const side = (id: string, sx: number) =>
    compound(id, "Side", [sx * (xo - 3), H / 2, 0], [
      { shape: "box", size: [6, H - 2 * T, zf - zb], pos: [sx * (xo - 3), H / 2, (zb + zf) / 2] },
      { shape: "box", size: [20, 3, zf - zb], pos: [sx * (xi - 10), H - T - 1.5, (zb + zf) / 2] },
      { shape: "box", size: [20, 3, zf - zb], pos: [sx * (xi - 10), T + 1.5, (zb + zf) / 2] },
      { shape: "box", size: [14, ly1 - ly0, 260], pos: [sx * (xi - 7), (ly0 + ly1) / 2, zb + 135] },
      // the hanging bracket at the back, with its keyhole for the wall screw
      { shape: "box", size: [30, 44, 3], pos: [sx * (xi - 15), H - T - 30, zb + 1.5] },
    ], "board");
  parts.push(side("SL", -1));
  parts.push({ id: "BR", name: "Cross brace", size: [2 * xi, 3, 30], pos: [0, ly0 - 1.5, zb + 20], material: "metal" });
  parts.push(side("SR", 1));
  parts.push(board("BOT", "Bottom board", W, T, D, T / 2));
  // the glide strips lie in the runner ledges
  const strip = (id: string, sx: number): CustomPart => ({ id, name: "Glide strip", size: [14, 2, 250], pos: [sx * (xi - 7), ly1 + 1, zb + 140], material: "soft" });
  parts.push(strip("GL", -1), strip("GR", 1));

  // the drawer: a steel tray whose sides fold up, a steel back and a wooden front
  const dx = 150, dy0 = ly1 + 2, dy1 = dy0 + 72, dz0 = zb + 25, dz1 = zf - 20;
  const dPos: Vec3 = [0, (dy0 + dy1) / 2, (dz0 + dz1) / 2];
  parts.push(
    compound("DB", "Drawer tray", dPos, [
      { shape: "box", size: [2 * dx, 2, dz1 - dz0], pos: [0, dy0 + 1, (dz0 + dz1) / 2] },
      ...[-1, 1].flatMap((sx): PartPiece[] => [
        { shape: "box", size: [2, dy1 - dy0, dz1 - dz0], pos: [sx * (dx + 1), (dy0 + dy1) / 2, (dz0 + dz1) / 2] },
        { shape: "box", size: [xi - 2 - dx - 2, 2, dz1 - dz0], pos: [sx * ((dx + 2 + xi - 2) / 2), dy0 + 1, (dz0 + dz1) / 2] },
      ]),
      { shape: "box", size: [2 * dx, dy1 - dy0, 2], pos: [0, (dy0 + dy1) / 2, dz1 - 1] },
    ], "metal"),
  );
  parts.push(
    compound("DK", "Drawer back", [0, (dy0 + dy1) / 2, dz0 + 6], [
      { shape: "box", size: [2 * dx, dy1 - dy0 - 4, 2], pos: [0, (dy0 + dy1) / 2, dz0 + 1] },
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [2, dy1 - dy0 - 4, 12], pos: [sx * (dx - 1), (dy0 + dy1) / 2, dz0 + 6] })),
    ], "metal"),
  );
  const fy0 = dy0 - 6, fy1 = H - T - 4;
  parts.push({ id: "DF", name: "Drawer front", size: [2 * xi - 4, fy1 - fy0, 16], pos: [0, (fy0 + fy1) / 2, dz1 + 8], material: "wood" });

  const SCR = { len: 18, dia: 4 }; // the same twelve screws all through
  const sideScrews = (sx: number, top: boolean): Vec3[] => [-80, 80].map((z) => [sx * (xi - 10), top ? H - T - 2 : 0, z] as Vec3);
  const hang: Vec3[] = [-1, 1].map((sx) => [sx * (xi - 15), H - T - 30, zb + 3] as Vec3);
  const away = { DB: [0, 0, 400] as Vec3, DK: [0, 0, 400] as Vec3, DF: [0, 0, 400] as Vec3 };
  const steps: CustomStep[] = [
    {
      title: "Screw one side onto the top",
      detail: "Lay the top face down on a rug. Stand the side on it, runner ledge down, and drive two screws through its flange.",
      add: ["TOP", "SL"],
      fix: [at("screw", sideScrews(-1, true), [0, 1, 0], "SL", "TOP", SCR)],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Press the two bumpers into the cross brace",
      detail: "Push each one into its hole until it sits flat.",
      fix: [at("clip", [-100, 100].map((x) => [x, ly0 + 6, zb + 12] as Vec3), [0, -1, 0], "BR", undefined, { name: "Bumper", len: 8, dia: 10 })],
      wait: ["BR"],
    },
    { title: "Click the cross brace into the side", detail: "Slide its end into the back of the runner ledge until it clicks.", add: ["BR"] },
    { title: "Click the other side onto the brace", detail: "The runner ledges face each other. Push until the brace clicks in.", add: ["SR"], from: { SR: [300, 0, 0] } },
    { title: "Screw the second side onto the top", detail: "Two screws through its flange, like the first.", fix: [at("screw", sideScrews(1, true), [0, 1, 0], "SR", "TOP", SCR)], tools: ["screwdriver"] },
    {
      title: "Screw on the bottom board",
      detail: "Lay it on the sides, wavy edge to the front, and drive four screws into the flanges. Then turn it over.",
      add: ["BOT"],
      fix: [at("screw", [...sideScrews(-1, false), ...sideScrews(1, false)], [0, 1, 0], "BOT", undefined, SCR)],
      tools: ["screwdriver"],
    },
    {
      title: "Press a glide strip into each runner",
      detail: "Peel off the backing, push the strip into the back of the ledge and press it down along its length.",
      add: ["GL", "GR"],
      from: { GL: [0, 120, 0], GR: [0, 120, 0] },
      pose: "+y",
    },
    {
      title: "Hold it to the wall and mark the holes",
      detail: "Set a level on the top and mark through the keyhole in each side's bracket.",
      tools: ["level", "pencil"],
      wall: true,
    },
    {
      title: "Drive two wall screws",
      detail: "Leave the heads standing out a few millimetres. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 2, at: hang.map((p) => [p[0], p[1], zb - 40] as Vec3), dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 50, dia: 5, at: hang.map((p) => [p[0], p[1], zb - 4] as Vec3), dir: [0, 0, -1] },
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["wall"],
    },
    {
      title: "Hang it and lock it with the hooks",
      detail: "Lift the keyholes over the screw heads. Clip a hook into each bracket, line the table up, then tighten the hooks.",
      fix: [at("hook", hang, [0, 0, -1], undefined, undefined, { len: 20, dia: 14 })],
      tools: ["screwdriver"],
      wall: true,
    },
    {
      title: "Slot the back into the drawer tray",
      detail: "Lay the tray flat with its edges up and push the back down into the slot at the end.",
      wait: ["DB", "DK"],
      from: away,
    },
    { title: "Fold up the sides of the tray", detail: "Press each side up against the back until both stand straight." },
    {
      title: "Screw the back to the sides",
      detail: "One small screw through each side into the back.",
      fix: [-1, 1].map((sx) => at("screw", [[sx * (dx + 3), (dy0 + dy1) / 2, dz0 + 6]], [-sx, 0, 0], "DB", "DK", { len: 8, dia: 4 })),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the drawer front on",
      detail: "Four screws from inside the tray into the back of the front.",
      fix: [at("screw", [-1, 1].flatMap((sx) => [dy0 + 18, dy1 - 18].map((y) => [sx * 110, y, dz1 - 4] as Vec3)), [0, 0, 1], "DB", "DF", SCR)],
      wait: ["DF"],
      from: { DF: [0, 0, 400] },
      tools: ["screwdriver"],
    },
    {
      title: "Slide the drawer in",
      detail: "Rest its edges on the glide strips and push it in until it stops.",
      add: ["DB", "DK", "DF"],
      from: { DB: [0, 0, 640], DK: [0, 0, 640], DF: [0, 0, 640] },
    },
  ];
  return { parts, steps };
}

const family: Family = { names: ["STOMSÖ", "STOMSO"], recipe };
export default family;
