import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * FABRIKÖR, read from the 57x150 glass-door cabinet's manual. A powder-coated steel frame: four splayed legs with
 * adjustable feet, joined in pairs by two rails that cross in an X, a base tray on top, four corner posts bolted
 * down through the tray into the legs, three glass panels dropped into the posts and held by tabs you bend over,
 * a top tray bolted on from the sides, a wall strap, the floor plate, shelf supports and two glass shelves, and the
 * glass door hung on two hinge pins by two people. Twenty Allen bolts in all.
 *
 * The 81x113 cabinet has its own manual: four full-height posts with feet, built lying on its front. The base tray
 * is bolted between the front posts, the back posts go on from above, then it's stood up, the top bolted on and the
 * middle post fitted between the doors. Two side panes and two back panes drop into the posts' tabs, the catch is
 * screwed to the right door, both doors hang on hinge pins, and two glass shelves rest on ten supports.
 * Eighteen Allen bolts in all.
 */

const LEG = 38;
const POST = 30;
const BOLT = { len: 20, dia: 6 };

/** Turn that stands a y-axis part along the direction from a to b. */
function along(a: Vec3, b: Vec3) {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const u = d.map((v) => v / len);
  return { len, pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] as Vec3, rot: [Math.atan2(u[2], u[1]), 0, Math.asin(-u[0])] as Vec3 };
}

function recipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  // the cabinet body is narrower than the splayed legs
  const BW = W - 50, BD = D - 50;
  const legTop = Math.round(H * 0.28);
  const trayH = 40;
  const body0 = legTop + trayH;
  const topT = 30;
  const body1 = H - topT;
  const parts: CustomPart[] = [];

  /* ---------- legs and rails ---------- */
  const corners: [number, number][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  const cid = (sx: number, sz: number) => `${sz > 0 ? "F" : "B"}${sx < 0 ? "L" : "R"}`;
  const legTopAt = (sx: number, sz: number): Vec3 => [sx * (BW / 2 - 30), legTop, sz * (BD / 2 - 30)];
  const legBotAt = (sx: number, sz: number): Vec3 => [sx * (W / 2 - LEG / 2), 0, sz * (D / 2 - LEG / 2)];
  for (const [sx, sz] of corners) {
    const g = along(legBotAt(sx, sz), legTopAt(sx, sz));
    parts.push({ id: `L${cid(sx, sz)}`, name: "Leg", size: [LEG, g.len, LEG], pos: g.pos, rot: g.rot, shape: "cyl", material: "metal" });
  }
  const railY = Math.round(legTop * 0.36);
  const legAt = (sx: number, sz: number, y: number): Vec3 => {
    const a = legBotAt(sx, sz), b = legTopAt(sx, sz), t = y / legTop;
    return [a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t];
  };
  const rail = (id: string, from: [number, number], to: [number, number]): CustomPart => {
    const a = legAt(from[0], from[1], railY), b = legAt(to[0], to[1], railY);
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const len = Math.hypot(dx, dz) - LEG;
    return { id, name: "Cross rail", size: [len, 25, 25], pos: [(a[0] + b[0]) / 2, railY, (a[2] + b[2]) / 2], rot: [0, Math.atan2(-dz, dx), 0], material: "metal" };
  };
  parts.push(rail("R1", [-1, 1], [1, -1]), rail("R2", [1, 1], [-1, -1]));
  // a bolt through each leg into the end of its rail, with a lock washer under the head
  const railBolts = (pairs: [number, number][]): CustomFix[] => {
    const at: Vec3[] = [], dirs: Vec3[] = [];
    for (const [sx, sz] of pairs) {
      const p = legAt(sx, sz, railY);
      const n = Math.hypot(p[0], p[2]);
      at.push([p[0] + (p[0] / n) * (LEG / 2), railY, p[2] + (p[2] / n) * (LEG / 2)]);
      dirs.push([-p[0] / n, 0, -p[2] / n]);
    }
    return at.flatMap((q, i) => [
      { kind: "washer" as const, name: "Lock washer", count: 1, len: 1.5, dia: 12, at: [q], dir: dirs[i], on: `L${cid(...pairs[i])}` },
      { kind: "bolt" as const, count: 1, ...BOLT, at: [q], dir: dirs[i], on: `L${cid(...pairs[i])}` },
    ]);
  };

  /* ---------- trays, posts, glass ---------- */
  const tray = (y0: number, h: number, up: boolean): PartPiece[] => [
    { shape: "box", size: [BW, 3, BD], pos: [0, up ? y0 + 1.5 : y0 + h - 1.5, 0] },
    { shape: "box", size: [BW, h, 3], pos: [0, y0 + h / 2, BD / 2 - 1.5] },
    { shape: "box", size: [BW, h, 3], pos: [0, y0 + h / 2, -BD / 2 + 1.5] },
    { shape: "box", size: [3, h, BD - 6], pos: [BW / 2 - 1.5, y0 + h / 2, 0] },
    { shape: "box", size: [3, h, BD - 6], pos: [-BW / 2 + 1.5, y0 + h / 2, 0] },
  ];
  const piecesAt = (ps: PartPiece[], c: Vec3) => ps.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  const baseC: Vec3 = [0, legTop + trayH / 2, 0];
  parts.push({ id: "T0", name: "Base tray", size: [BW, trayH, BD], pos: baseC, material: "metal", pieces: piecesAt(tray(legTop, trayH, false), baseC) });
  const postH = body1 - body0;
  // the posts run on up inside the top's rim, where its side bolts go into them
  const postLen = H - 3 - body0;
  const postAt = (sx: number, sz: number): Vec3 => [sx * (BW / 2 - POST / 2), body0 + postLen / 2, sz * (BD / 2 - POST / 2)];
  parts.push({ id: "PFL", name: "Hinge post", size: [POST, postLen, POST], pos: postAt(-1, 1), material: "metal" });
  parts.push({ id: "PBL", name: "Back post", size: [POST, postLen, POST], pos: postAt(-1, -1), material: "metal" });
  parts.push({ id: "PBR", name: "Back post", size: [POST, postLen, POST], pos: postAt(1, -1), material: "metal" });
  parts.push({ id: "PFR", name: "Lock post", size: [POST, postLen, POST], pos: postAt(1, 1), shape: "cyl", material: "metal" });
  const gh = postH - 20, gy = body0 + postH / 2;
  parts.push({ id: "GL", name: "Side glass", size: [5, gh, BD - 2 * POST], pos: [-BW / 2 + 12, gy, 0], material: "glass" });
  parts.push({ id: "GB", name: "Back glass", size: [BW - 2 * POST, gh, 5], pos: [0, gy, -BD / 2 + 12], material: "glass" });
  parts.push({ id: "GR", name: "Side glass", size: [5, gh, BD - 2 * POST], pos: [BW / 2 - 12, gy, 0], material: "glass" });
  const topC: Vec3 = [0, body1 + topT / 2, 0];
  parts.push({ id: "T1", name: "Top", size: [BW, topT, BD], pos: topC, material: "metal", pieces: piecesAt(tray(body1, topT, false), topC) });
  parts.push({ id: "FP", name: "Floor plate", size: [BW - 2 * POST, 4, BD - 2 * POST], pos: [0, body0 + 2, 0], material: "metal" });
  const shelfY = [body0 + postH * 0.34, body0 + postH * 0.67];
  shelfY.forEach((y, i) => parts.push({ id: `S${i}`, name: "Glass shelf", size: [BW - 2 * POST - 4, 6, BD - 2 * POST - 4], pos: [0, y, 0], material: "glass" }));
  // the door: a steel frame round a pane, between the front posts
  const dw = BW - 2 * POST - 4, dh = postH - 8, fr = 26;
  const door: PartPiece[] = [
    { shape: "box", size: [fr, dh, 18], pos: [-dw / 2 + fr / 2, 0, 0], material: "metal" },
    { shape: "box", size: [fr, dh, 18], pos: [dw / 2 - fr / 2, 0, 0], material: "metal" },
    { shape: "box", size: [dw - 2 * fr, fr, 18], pos: [0, dh / 2 - fr / 2, 0], material: "metal" },
    { shape: "box", size: [dw - 2 * fr, fr, 18], pos: [0, -dh / 2 + fr / 2, 0], material: "metal" },
    { shape: "box", size: [dw - 2 * fr, dh - 2 * fr, 5], pos: [0, 0, 0], material: "glass" },
  ];
  parts.push({ id: "DR", name: "Glass door", size: [dw, dh, 18], pos: [0, gy, BD / 2 - 9], material: "metal", pieces: door });

  /* ---------- fittings ---------- */
  const postBolts = (ids: [number, number][], second: boolean): CustomFix[] =>
    ids.map(([sx, sz]) => {
      const p = postAt(sx, sz);
      const off = second ? 9 : -9;
      return { kind: "bolt", count: 1, ...BOLT, at: [[p[0], body0 + 6, p[2] + off * sz]], dir: [0, -1, 0], on: `P${cid(sx, sz)}`, mate: "T0" };
    });
  const tabs = "Bend the eight tabs on the posts over its edges by hand, so it can't fall out.";
  const topBolts: Vec3[] = [];
  const topDirs: Vec3[] = [];
  for (const [sx, sz] of corners) {
    topBolts.push([sx * (BW / 2), body1 + 8, sz * (BD / 2 - POST / 2)]);
    topDirs.push([-sx, 0, 0]);
    // the back-left corner's back hole takes the wall strap later
    if (!(sx < 0 && sz < 0)) {
      topBolts.push([sx * (BW / 2 - POST / 2), body1 + 22, sz * (BD / 2)]);
      topDirs.push([0, 0, -sz]);
    }
  }
  const strapAt: Vec3 = [-(BW / 2 - POST / 2), body1 + 22, -BD / 2];
  const supports: Vec3[] = shelfY.flatMap((y) => corners.map(([sx, sz]) => [sx * (BW / 2 - POST), y - 8, sz * (BD / 2 - POST - 10)] as Vec3));
  const hinge = (top: boolean): Vec3 => [-(BW / 2 - POST / 2), top ? body1 : body0, BD / 2 - 9];

  const steps: CustomStep[] = [
    {
      title: "Screw a foot into each leg",
      detail: "Turn each adjustable foot into the bottom of its leg by hand, all the way in for now.",
      add: ["LFL", "LFR", "LBL", "LBR"],
      fix: [{ kind: "foot", count: 4, len: 20, dia: 30, at: corners.map(([sx, sz]) => legBotAt(sx, sz)), dir: [0, 1, 0] }],
    },
    {
      title: "Bolt a rail between two opposite legs",
      detail: "The rail's notch faces down. A lock washer under each bolt head; leave them a little loose.",
      add: ["R1"],
      fix: railBolts([[-1, 1], [1, -1]]),
      tools: ["allen"],
    },
    {
      title: "Bolt the other rail and cross the pairs",
      detail: "This rail's notch faces up. Slot the two notches into each other so the rails cross in an X.",
      add: ["R2"],
      fix: railBolts([[1, 1], [-1, -1]]),
      tools: ["allen"],
    },
    { title: "Set the base tray on the legs", detail: "Line the holes in its corners up with the holes in the leg tops.", add: ["T0"] },
    {
      title: "Bolt the hinge post to the front left corner",
      detail: "The post with the two hinge sockets, sockets facing forward. One bolt for now.",
      add: ["PFL"],
      fix: postBolts([[-1, 1]], false),
      tools: ["allen"],
    },
    { title: "Bolt on the two back posts", detail: "The posts with the rows of shelf holes. One bolt in each.", add: ["PBL", "PBR"], fix: postBolts([[-1, -1], [1, -1]], false), tools: ["allen"] },
    { title: "Bolt on the front right post", detail: "The round one, where the door locks. One bolt.", add: ["PFR"], fix: postBolts([[1, 1]], false), tools: ["allen"] },
    {
      title: "Add a second bolt at each corner and tighten",
      detail: "Then tighten all eight post bolts and the four rail bolts in the legs.",
      fix: postBolts(corners, true),
      tools: ["allen"],
      check: "square",
    },
    { title: "Lower in the left glass panel", detail: `From above, into the slots in the posts and the tray. ${tabs}`, add: ["GL"], warnings: ["hand"] },
    { title: "Lower in the back glass panel", detail: tabs, add: ["GB"], warnings: ["hand"] },
    { title: "Lower in the right glass panel", detail: tabs, add: ["GR"], warnings: ["hand"] },
    {
      title: "Bolt on the top",
      detail: "Seven bolts in from the sides. Leave the back hole in the left corner empty: the wall strap goes there.",
      add: ["T1"],
      fix: topBolts.map((p, i) => ({ kind: "bolt" as const, count: 1, ...BOLT, at: [p], dir: topDirs[i], on: "T1" })),
      tools: ["allen"],
    },
    {
      title: "Strap it to the wall",
      detail: "Mark and drill the wall level with the top. Bolt the strap to the empty hole, then screw it to the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "strap", count: 1, at: [strapAt], dir: [0, 0, 1], on: "T1" },
        { kind: "bolt", count: 1, ...BOLT, at: [strapAt], dir: [0, 0, 1], on: "T1" },
        { kind: "plug", count: 1, at: [[strapAt[0], strapAt[1] + 30, -BD / 2 - 40]], dir: [0, 0, -1] },
        { kind: "screw", count: 1, len: 50, dia: 5, at: [[strapAt[0], strapAt[1] + 30, -BD / 2 - 6]], dir: [0, 0, -1] },
      ],
      tools: ["allen", "drill", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    { title: "Lay the floor plate in", detail: "It rests in the base tray.", add: ["FP"] },
    { title: "Level it with the feet", detail: "Turn the feet in or out until the cabinet stands steady and the door gap looks even.", check: "square" },
    {
      title: "Push in the shelf supports",
      detail: "Four for each shelf, at the same height in all four posts.",
      fix: [{ kind: "pin", name: "Shelf support", count: 8, len: 16, dia: 12, at: supports, dir: [0, -1, 0] }],
    },
    { title: "Lay the glass shelves on the supports", detail: "Hold each by its edges and lower it in flat.", add: ["S0", "S1"], warnings: ["hand"] },
    {
      title: "Hang the door on its hinge pins",
      detail: "One of you holds the door in place while the other pushes a pin with its washer up through the bottom socket and down through the top one.",
      add: ["DR"],
      fix: [
        { kind: "washer", count: 2, len: 1.5, dia: 12, at: [hinge(false), hinge(true)], dir: [0, 1, 0], on: "PFL" },
        { kind: "pin", name: "Hinge pin", count: 1, len: 30, dia: 6, at: [hinge(false)], dir: [0, 1, 0], on: "PFL", mate: "DR" },
        { kind: "pin", name: "Hinge pin", count: 1, len: 30, dia: 6, at: [hinge(true)], dir: [0, -1, 0], on: "PFL", mate: "DR" },
      ],
      people: 2,
    },
    {
      title: "Lock the door with the key",
      detail: "Two keys come with it; keep the spare somewhere safe.",
      fix: [{ kind: "knob", name: "Key", count: 1, len: 30, dia: 20, at: [[BW / 2 - POST - 30, gy, BD / 2]], dir: [0, 0, -1], on: "DR" }],
    },
  ];
  return { parts, steps };
}


/* ---------------------------------------------------------------- 81x113, two doors */

function wide(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const P = POST, foot = 25;
  const yT0 = 150, tH = 40; // the base tray, its flat side up
  const yB = yT0 + tH; // the bottom of the glass space
  const yTop = H - 40; // the top rim
  const xp = W / 2 - P / 2, zp = D / 2 - P / 2;
  const corners: [number, number][] = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  const pid = (sx: number, sz: number) => `P${sz > 0 ? "F" : "B"}${sx < 0 ? "L" : "R"}`;
  const tray = (y0: number, h: number, w: number, d: number): PartPiece[] => [
    { shape: "box", size: [w, 3, d], pos: [0, y0 + h - 1.5, 0] },
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [w, h, 3], pos: [0, y0 + h / 2, g * (d / 2 - 1.5)] })),
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [3, h, d - 6], pos: [g * (w / 2 - 1.5), y0 + h / 2, 0] })),
  ];
  const piecesAt = (ps: PartPiece[], c: Vec3) => ps.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] as Vec3 }));
  const postLen = H - 3 - foot;
  const parts: CustomPart[] = corners.map(([sx, sz]): CustomPart => ({
    id: pid(sx, sz),
    name: sz > 0 ? "Front post" : "Back post",
    size: [P, postLen, P],
    pos: [sx * xp, foot + postLen / 2, sz * zp],
    material: "metal",
  }));
  const c0: Vec3 = [0, yT0 + tH / 2, 0];
  parts.push({ id: "T0", name: "Base tray", size: [W - 2 * P, tH, D], pos: c0, material: "metal", pieces: piecesAt(tray(yT0, tH, W - 2 * P, D), c0) });
  const c1: Vec3 = [0, (yTop + H) / 2, 0];
  parts.push({ id: "T1", name: "Top", size: [W, H - yTop, D], pos: c1, material: "metal", pieces: piecesAt(tray(yTop, H - yTop, W, D), c1) });
  // the middle post runs from inside the base tray up inside the top's rim, between the doors
  const mY0 = yT0 + 2, mY1 = H - 3;
  parts.push({ id: "M", name: "Middle post", size: [P, mY1 - mY0, 20], pos: [0, (mY0 + mY1) / 2, D / 2 - 10], material: "metal" });
  const gh = yTop - yB - 10, gy = (yTop + yB) / 2;
  [-1, 1].forEach((g, i) => parts.push({ id: `GS${i}`, name: "Side glass", size: [5, gh, D - 2 * P], pos: [g * xp, gy, 0], material: "glass" }));
  const bw = (W - 2 * P) / 2 - 2;
  [-1, 1].forEach((g, i) => parts.push({ id: `GB${i}`, name: "Back glass", size: [bw, gh, 5], pos: [g * (bw / 2 + 1), gy, -zp], material: "glass" }));
  const shelfY = [yB + (yTop - yB) / 3, yB + (2 * (yTop - yB)) / 3];
  shelfY.forEach((y, i) => parts.push({ id: `S${i}`, name: "Glass shelf", size: [W - 2 * P - 4, 6, D - 2 * P - 4], pos: [0, y, 0], material: "glass" }));
  // the doors: a steel frame round a pane, each between a corner post and the middle post
  const dw = W / 2 - P - P / 2 - 6, dh = yTop - yB - 8, fr = 26, dz = D / 2 - 12;
  const doorPieces: PartPiece[] = [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [fr, dh, 18], pos: [g * (dw / 2 - fr / 2), 0, 0], material: "metal" })),
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [dw - 2 * fr, fr, 18], pos: [0, g * (dh / 2 - fr / 2), 0], material: "metal" })),
    { shape: "box", size: [dw - 2 * fr, dh - 2 * fr, 5], pos: [0, 0, 0], material: "glass" },
  ];
  const dx = (W / 2 - P + P / 2) / 2;
  [-1, 1].forEach((g, i) => parts.push({ id: `D${i}`, name: "Glass door", size: [dw, dh, 18], pos: [g * dx, gy, dz], material: "metal", pieces: doorPieces }));

  const bolt = (on: string, pts: Vec3[], dir: Vec3): CustomFix => ({ kind: "bolt", count: pts.length, ...BOLT, at: pts, dir, on });
  const feet = (ids: [number, number][]): CustomFix[] => ids.map(([sx, sz]) => ({ kind: "foot", count: 1, len: 20, dia: 30, at: [[sx * xp, 0, sz * zp]], dir: [0, 1, 0], on: pid(sx, sz) }));
  // two bolts through each post into the end of the base tray
  const trayBolts = (sz: number): CustomFix[] => [-1, 1].map((sx) => bolt(pid(sx, sz), [156, 184].map((y): Vec3 => [sx * (W / 2), y, sz * zp]), [-sx, 0, 0]));
  const topBolts: CustomFix[] = corners.flatMap(([sx, sz]) => [bolt("T1", [[sx * (W / 2), H - 30, sz * zp]], [-sx, 0, 0]), bolt("T1", [[sx * xp, H - 14, sz * (D / 2)]], [0, 0, -sz])]);
  const hinge = (sx: number, top: boolean): Vec3 => [sx * (xp - P / 2 - 4), top ? yTop - 4 : yB + 4, dz];
  const hang = (i: number): CustomFix[] => {
    const sx = i ? 1 : -1;
    return [
      { kind: "washer", count: 2, len: 1.5, dia: 12, at: [hinge(sx, false), hinge(sx, true)], dir: [0, 1, 0], on: `D${i}` },
      { kind: "pin", name: "Hinge pin", count: 1, len: 30, dia: 6, at: [hinge(sx, false)], dir: [0, 1, 0], on: `D${i}` },
      { kind: "pin", name: "Hinge pin", count: 1, len: 30, dia: 6, at: [hinge(sx, true)], dir: [0, -1, 0], on: `D${i}` },
    ];
  };
  const supports: Vec3[] = shelfY.flatMap((y) => [...corners.map(([sx, sz]) => [sx * (xp - P / 2 - 4), y - 8, sz * (zp - P / 2 - 4)] as Vec3), [0, y - 8, D / 2 - 26] as Vec3]);
  const catchX = 30, catchY = gy + dh / 2;
  const tabs = (n: number) => `Bend the ${n} tabs on the posts over its edges by hand, so it can't fall out.`;
  const steps: CustomStep[] = [
    {
      title: "Screw a foot into each front post",
      detail: "Lay the two front posts on a rug, hinge sockets facing each other, and turn a foot into the bottom of each by hand.",
      add: ["PFL", "PFR"],
      fix: feet([[-1, 1], [1, 1]]),
      pose: "-z",
      warnings: ["floor"],
    },
    { title: "Bolt the base tray to the front posts", detail: "Flat side towards the top of the posts. Two bolts through each post; leave them a little loose.", add: ["T0"], fix: trayBolts(1), tools: ["allen"], from: { T0: [0, 0, -250] } },
    {
      title: "Screw a foot into each back post",
      detail: "The back posts are the ones with rows of shelf holes.",
      fix: feet([[-1, -1], [1, -1]]),
      wait: ["PBL", "PBR"],
      from: { PBL: [-450, 0, 0], PBR: [450, 0, 0] },
    },
    { title: "Bolt on the back posts", detail: "One of you holds each post on the tray's ends while the other puts in two bolts.", add: ["PBL", "PBR"], fix: trayBolts(-1), tools: ["allen"], people: 2, from: { PBL: [0, 0, -300], PBR: [0, 0, -300] } },
    { title: "Stand it up and put the top on", detail: "Lift it upright together, then lower the top onto the four posts.", add: ["T1"], pose: "+y", people: 2, from: { T1: [0, 250, 0] } },
    { title: "Bolt the top to the posts", detail: "Two bolts at each corner, one from the side and one from the front or back.", fix: topBolts, tools: ["allen"] },
    {
      title: "Bolt in the middle post",
      detail: "Between the doors at the front, its slot at the bottom. One bolt into the top and one into the base tray.",
      add: ["M"],
      fix: [bolt("T1", [[0, H - 22, D / 2]], [0, 0, -1]), bolt("T0", [[0, yT0 + 20, D / 2]], [0, 0, -1])],
      tools: ["allen"],
      from: { M: [0, 0, 300] },
    },
    { title: "Fit the two side panes", detail: `Tilt each in from the front and stand it in the slots of its side. ${tabs(14)}`, add: ["GS0", "GS1"], from: { GS0: [150, 0, 450], GS1: [-150, 0, 450] }, warnings: ["hand"] },
    { title: "Fit the two back panes", detail: `They meet in the middle of the back. ${tabs(16)}`, add: ["GB0", "GB1"], from: { GB0: [-30, 0, 500], GB1: [30, 0, 500] }, warnings: ["hand"] },
    {
      title: "Screw the catch onto the right door",
      detail: "Lay both doors face down. The catch goes on top of the right door's free edge, ball facing up, with two screws.",
      fix: [
        { kind: "clip", name: "Door catch", count: 1, len: 40, dia: 14, at: [[catchX + 20, catchY, dz]], dir: [0, -1, 0], on: "D1" },
        { kind: "screw", count: 2, len: 10, dia: 3.5, at: [[catchX + 4, catchY, dz], [catchX + 36, catchY, dz]], dir: [0, -1, 0], on: "D1" },
      ],
      tools: ["screwdriver"],
      wait: ["D0", "D1"],
      from: { D0: [0, 0, 400], D1: [0, 0, 400] },
    },
    { title: "Hang the left door", detail: "One of you holds the door while the other pushes a pin with its washer up into the bottom socket and down into the top one.", add: ["D0"], fix: hang(0), people: 2 },
    { title: "Hang the right door", detail: "The same way, on the right front post.", add: ["D1"], fix: hang(1), people: 2 },
    { title: "Level it with the feet", detail: "Turn the four feet with the Allen key until the doors close evenly.", tools: ["allen"] },
    { title: "Tighten every bolt", detail: "All eighteen, now that the cabinet stands square.", tools: ["allen"], check: "square" },
    { title: "Push in the shelf supports", detail: "Five for each shelf: one in each corner post and one in the middle post, at the same height.", fix: [{ kind: "pin", name: "Shelf support", count: supports.length, len: 16, dia: 12, at: supports, dir: [0, -1, 0] }] },
    { title: "Lay the glass shelves on the supports", detail: "Hold each by its edges and lower it in flat.", add: ["S0", "S1"], warnings: ["hand"] },
    {
      title: "Fix it to the wall",
      detail: "One screw through the hole at the back of the top into the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        { kind: "plug", count: 1, at: [[0, H - 20, -D / 2 - 40]], dir: [0, 0, -1] },
        { kind: "screw", count: 1, len: 50, dia: 5, at: [[0, H - 20, -D / 2 + 30]], dir: [0, 0, -1] },
      ],
      tools: ["drill", "pencil", "screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    { title: "Lock the doors with the key", detail: "Keep the key somewhere safe.", fix: [{ kind: "knob", name: "Key", count: 1, len: 30, dia: 20, at: [[-30, gy, D / 2 - 3]], dir: [0, 0, -1], on: "D0" }] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["FABRIKÖR", "FABRIKOR"],
  recipe(s) {
    // the 57x150 cabinet stands on splayed legs with one door; the 81x113 has posts to the floor and two doors
    if (s.size.w > 65 && s.size.h < 130) return wide(s);
    if (s.size.w > 65 || s.size.h < 130) return null;
    return recipe(s);
  },
};
export default family;
