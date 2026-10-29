import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomParams, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * GRÅFJÄLLET (anthracite steel tube), read from its five manuals.
 * Room divider: it comes in one piece; lying flat, a foot screws into each of its five posts, then it stands up
 * opened into a zigzag (never flat, it tips).
 * Clothes rack: feet into the four leg tubes, the legs click into the two arched side frames and are locked with
 * a small screw each; lying on its side, the shelf frame is bolted to one side, then the other, and the top rail
 * goes between the arches on two long bolts. Standing, the bench board is bolted onto its rails from below and a
 * bracket under the back holds it to the wall.
 * Dressing table: feet into the legs; the table box lies upside down while the back and front legs push in and are
 * screwed, and the curved foot rail is bolted between them. Turned over, the drawer's packing comes out. The mirror
 * is bolted between the two arch halves, the arch drops into sockets at the back and two grub screws lock it.
 * Bedside table: lying on its back, the cupboard's bottom and top hook into the back frame and are screwed, the
 * front frame goes on top, the two side panels slide in and lock with their catches. Upside down on the top, four
 * screws and the feet. The door gets its top hinge, buffer and stop, then drops onto a pivot pin and clicks in.
 * Wall-mounted bedside table: built upside down on its top: the sides, the back with its wall brackets, the bottom
 * (locked with catches) and the front rail, then the rack frame on the side tubes with two grub screws and pads on
 * the back. Two wall screws, it hangs on hook plates, and the flap gets buffers, its handle and two click hinges.
 */

const T = 18; // tube
const FOOT = { kind: "foot" as const, name: "Adjustable foot", len: 15, dia: 40 };
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** A tube along a curve, as straight pieces: points in the x-y plane (plane "xy") or the z-y plane ("zy"). */
function curve(pts: [number, number][], plane: "xy" | "zy", at: number, d = T): PartPiece[] {
  const out: PartPiece[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [u0, y0] = pts[i - 1], [u1, y1] = pts[i];
    const len = Math.hypot(u1 - u0, y1 - y0) + 2;
    const um = (u0 + u1) / 2, ym = (y0 + y1) / 2;
    if (plane === "xy") out.push({ shape: "box", size: [len, d, d], pos: [um, ym, at], rot: [0, 0, Math.atan2(y1 - y0, u1 - u0)] });
    else out.push({ shape: "box", size: [d, d, len], pos: [at, ym, um], rot: [-Math.atan2(y1 - y0, u1 - u0), 0, 0] });
  }
  return out;
}
/** Points on a circle's arc, angles in radians. */
const arc = (cu: number, cy: number, r: number, a0: number, a1: number, n = 8): [number, number][] =>
  range(n + 1).map((i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cu + r * Math.cos(a), cy + r * Math.sin(a)];
  });
/** Moves pieces drawn about the floor origin so they sit about the part's own centre. */
const about = (ps: PartPiece[], c: Vec3): PartPiece[] => ps.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2] - c[2]] }));
const boxOf = (lo: Vec3, hi: Vec3) => ({ size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] as Vec3, pos: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2] as Vec3 });
/** A part drawn from pieces placed in product coordinates, its box from lo to hi. */
function welded(id: string, name: string, lo: Vec3, hi: Vec3, pieces: PartPiece[], material: CustomPart["material"] = "metal"): CustomPart {
  const b = boxOf(lo, hi);
  return { id, name, size: b.size, pos: b.pos, material, pieces: about(pieces, b.pos) };
}
const tubeY = (x: number, z: number, y0: number, y1: number, d = T): PartPiece => ({ shape: "cyl", size: [d, y1 - y0, d], pos: [x, (y0 + y1) / 2, z] });
const tubeX = (x0: number, x1: number, y: number, z: number, d = T): PartPiece => ({ shape: "cyl", size: [d, x1 - x0, d], pos: [(x0 + x1) / 2, y, z], rot: [0, 0, Math.PI / 2] });
const tubeZ = (x: number, y: number, z0: number, z1: number, d = T): PartPiece => ({ shape: "cyl", size: [d, z1 - z0, d], pos: [x, y, (z0 + z1) / 2], rot: [Math.PI / 2, 0, 0] });

/* ---------------- room divider ---------------- */

function divider(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10;
  const n = 4, pw = W / n, r = pw / 2 - T / 2, fh = 15;
  const top = H - r - T / 2; // where the arches start
  const xs = range(n + 1).map((i) => -W / 2 + T / 2 + ((W - T) * i) / n);
  const pieces: PartPiece[] = [
    ...xs.map((x) => tubeY(x, 0, fh, top)),
    ...range(n).flatMap((i) => curve(arc((xs[i] + xs[i + 1]) / 2, top, (xs[i + 1] - xs[i]) / 2, 0, Math.PI, 10), "xy", 0)),
    ...range(n).map((i): PartPiece => ({ shape: "box", size: [xs[i + 1] - xs[i] - T, top - 250, 2], pos: [(xs[i] + xs[i + 1]) / 2, (top + 200) / 2 + 25, 0], material: "soft" })),
  ];
  const parts = [welded("D", "Room divider", [-W / 2, fh, -T / 2], [W / 2, H, T / 2], pieces)];
  const steps: CustomStep[] = [
    {
      title: "Screw a foot into each post",
      detail: "Lay the divider flat on a rug. Screw the five feet into the bottom ends of the posts by hand.",
      add: ["D"],
      fix: [{ ...FOOT, count: 5, at: xs.map((x): Vec3 => [x, fh, 0]), dir: [0, 1, 0], on: "D" }],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Stand it up", detail: "Lift it by the top of the frame so the hinges don't twist.", pose: "+y" },
    {
      title: "Open it into a zigzag",
      detail: "It only stands with its panels at an angle; set out flat it falls over. Turn the feet until every one touches the floor.",
      warnings: ["tip"],
    },
  ];
  return { parts, steps };
}

/* ---------------- clothes rack ---------------- */

function clothesRack(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const fh = 15;
  const xs = W / 2 - T / 2, zs = D / 2 - T / 2;
  const r = zs; // the arch spans the depth
  const yJ = 950; // where the legs meet the arched frames
  const yA = H - r - T / 2;
  const yShoe = 220, yBench = 500;
  const parts: CustomPart[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push({ id: `L${sx}${sz}`, name: "Leg tube", size: [T, yJ - fh, T], pos: [sx * xs, (yJ + fh) / 2, sz * zs], shape: "cyl", material: "metal" });
  for (const sx of [-1, 1]) {
    const x = sx * xs;
    parts.push(
      welded(`A${sx}`, "Arched side frame", [x - T / 2, yJ, -D / 2], [x + T / 2, H, D / 2], [
        tubeY(x, -zs, yJ, yA),
        tubeY(x, zs, yJ, yA),
        ...curve(arc(0, yA, r, 0, Math.PI, 12), "zy", x),
        tubeZ(x, yJ + 20, -zs, zs, 14),
      ]),
    );
  }
  // the shelf frame: the slatted shoe shelf and the bench rails, welded in one piece between the legs
  const xi = xs - T / 2;
  const slats = range(5).map((i) => -zs + 40 + ((2 * zs - 80) * i) / 4);
  parts.push(
    welded("SF", "Shelf frame", [-xi, yShoe - 8, -zs - 8], [xi, yBench + 8, zs + 8], [
      ...[yShoe, yBench].flatMap((y) => [-1, 1].map((sz) => tubeX(-xi, xi, y, sz * zs, 16))),
      ...[yShoe, yBench].flatMap((y) => [-1, 1].map((sx) => tubeZ(sx * (xi - 8), y, -zs, zs, 16))),
      ...slats.slice(1, -1).map((z) => tubeX(-xi, xi, yShoe, z, 10)),
      ...[-1, 1].map((sx) => tubeY(sx * (xi - 8), 0, yShoe, yBench, 14)),
    ]),
  );
  const yR = H - T / 2;
  parts.push({ id: "R", name: "Top rail", size: [2 * xi, T, T], pos: [0, yR, 0], shape: "cyl", material: "metal" });
  parts.push({ id: "B", name: "Bench shelf", size: [2 * xi, 18, 2 * zs], pos: [0, yBench + 8 + 9, 0] });
  // the wall bracket: a slotted strip under the back of the shoe shelf, its end bent up against the wall
  const zW = -D / 2 - 30;
  parts.push(
    welded("WB", "Wall bracket", [-25, yShoe - 50, zW], [25, yShoe - 8, -zs + 70], [
      { shape: "box", size: [50, 3, -zs + 70 - zW], pos: [0, yShoe - 10, (zW - zs + 70) / 2] },
      { shape: "box", size: [50, 40, 3], pos: [0, yShoe - 30, zW + 1.5] },
    ]),
  );

  const sideBolts = (sx: number): CustomFix => ({
    kind: "bolt",
    count: 4,
    len: 30,
    dia: 6,
    at: [yShoe, yBench].flatMap((y) => [-1, 1].map((sz): Vec3 => [sx * (xs + T / 2), y, sz * zs])),
    dir: [-sx, 0, 0],
    on: "SF",
  });
  const steps: CustomStep[] = [
    {
      title: "Screw a foot into each leg tube",
      detail: "Into the plain end of all four tubes, by hand.",
      add: ["L-1-1", "L-11", "L1-1", "L11"],
      fix: [{ ...FOOT, count: 4, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xs, fh, sz * zs])), dir: [0, 1, 0] }],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Push the legs into the arched frames", detail: "Two into the open ends of each frame, until the spring buttons click out through the holes.", add: ["A-1", "A1"], from: { "A-1": [0, 300, 0], A1: [0, 300, 0] } },
    {
      title: "Lock each joint with a screw",
      detail: "One small screw through the top of each leg, four in all.",
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 2, len: 8, dia: 4, at: [-1, 1].map((sz): Vec3 => [sx * (xs + T / 2), yJ - 15, sz * zs]), dir: [-sx, 0, 0] })),
      tools: ["screwdriver"],
    },
    { title: "Bolt the shelf frame to one side", detail: "Lying on its side on a rug, four bolts through the legs into the shelf frame's ends. Check each head sits flat.", add: ["SF"], fix: [sideBolts(-1)], tools: ["allen"], from: { SF: [300, 0, 0] } },
    { title: "Bolt the other side on", detail: "The same four bolts through the legs on top.", fix: [sideBolts(1)], tools: ["allen"] },
    {
      title: "Bolt the top rail between the arches",
      detail: "One long bolt through the top of each arch into the rail's end.",
      add: ["R"],
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "bolt", count: 1, len: 90, dia: 6, at: [[sx * (xs + T / 2), yR, 0]], dir: [-sx, 0, 0], on: "R" })),
      tools: ["allen"],
    },
    { title: "Stand it up and lay the bench shelf on", detail: "It rests on the upper rails of the shelf frame.", add: ["B"], pose: "+y", from: { B: [0, 300, 0] } },
    {
      title: "Bolt the bench shelf on from below",
      detail: "Four bolts up through the rails into the board.",
      fix: [{ kind: "bolt", count: 4, len: 20, dia: 6, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (xi - 120), yBench - 8, sz * zs])), dir: [0, 1, 0], on: "SF", mate: "B" }],
      tools: ["allen"],
    },
    {
      title: "Screw the wall bracket under the shoe shelf",
      detail: "Two screws through its slots, at the back. Slide it out until its end touches the wall.",
      add: ["WB"],
      fix: [{ kind: "screw", count: 2, len: 10, dia: 6, at: [-1, 1].map((sx): Vec3 => [sx * 12, yShoe - 12, -zs]), dir: [0, 1, 0], on: "WB" }],
      tools: ["allen"],
      from: { WB: [0, -200, 0] },
    },
    {
      title: "Screw the bracket to the wall",
      detail: "Two screws through its end into the wall. Pick screws and plugs made for your wall; they aren't included.",
      fix: [
        { kind: "plug", count: 2, at: [-1, 1].map((sx): Vec3 => [sx * 12, yShoe - 30, zW - 40]), dir: [0, 0, -1] },
        { kind: "screw", count: 2, len: 50, dia: 5, at: [-1, 1].map((sx): Vec3 => [sx * 12, yShoe - 30, zW]), dir: [0, 0, -1], on: "WB" },
      ],
      tools: ["drill", "screwdriver"],
      wall: true,
      warnings: ["tip"],
    },
    { title: "Level it with the feet", detail: "Turn each foot until the rack stands steady." },
  ];
  return { parts, steps };
}

/* ---------------- dressing table ---------------- */

function dressingTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const fh = 15, LT = 22;
  const yT = 780, bh = 140, yB = yT - bh; // top surface, box underside
  const xl = W / 2 - 50, zl = D / 2 - 45;
  const xa = W * 0.28, za = -D / 2 + 30; // the mirror arch's sockets
  const parts: CustomPart[] = [];
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) parts.push({ id: `L${sx}${sz}`, name: "Leg", size: [LT, yB - fh + 40, LT], pos: [sx * xl, (yB + 40 + fh) / 2, sz * zl], shape: "cyl", material: "metal" });
  const dw = 640, dh = 100;
  parts.push(
    welded("BOX", "Table top with drawer case", [-W / 2, yB, -D / 2], [W / 2, yT, D / 2], [
      { shape: "box", size: [W, 24, D], pos: [0, yT - 12, 0], material: "board" },
      { shape: "box", size: [W - 40, bh - 24, 12], pos: [0, yB + (bh - 24) / 2, -D / 2 + 26] },
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [12, bh - 24, D - 40], pos: [sx * (W / 2 - 26), yB + (bh - 24) / 2, 0] })),
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [(W - 40 - dw) / 2, bh - 24, 12], pos: [sx * (dw / 2 + (W - 40 - dw) / 4), yB + (bh - 24) / 2, D / 2 - 26] })),
      { shape: "box", size: [W - 40, 4, D - 40], pos: [0, yB + 2, 0] },
      // the corner sockets the legs push into, screwed through from outside
      ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): PartPiece => ({ shape: "box", size: [34, 40, 6], pos: [sx * xl, yB + 20, sz * (zl + LT / 2 + 3)] }))),
    ]),
  );
  // the sockets stand up out of the top at the back
  parts.push(welded("SK", "Mirror sockets", [-xa - 13, yT, za - 13], [xa + 13, yT + 30, za + 13], [-1, 1].map((sx) => tubeY(sx * xa, za, yT, yT + 30, 26))));
  parts.push({ id: "DR", name: "Drawer", size: [dw, dh, 18], pos: [0, yB + 12 + dh / 2, D / 2 - 26], material: "metal" });
  // the curved foot rail: along both sides and round the back
  const yr = 200, rc = 40, xr = xl - LT / 2 - 8;
  const rail: PartPiece[] = [
    tubeZ(-xr, yr, -zl, zl + 8, 16),
    tubeZ(xr, yr, -zl, zl + 8, 16),
    tubeX(-xr + rc, xr - rc, yr, -zl - rc, 16),
  ];
  // the rounded back corners, drawn flat in the x-z plane at the rail's height
  for (const sx of [-1, 1]) {
    const pts = arc(sx * (xr - rc), -zl, rc, sx < 0 ? Math.PI : 0, sx < 0 ? 1.5 * Math.PI : -0.5 * Math.PI, 4);
    for (let i = 1; i < pts.length; i++) {
      const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
      rail.push({ shape: "box", size: [Math.hypot(x1 - x0, z1 - z0) + 2, 16, 16], pos: [(x0 + x1) / 2, yr, (z0 + z1) / 2], rot: [0, -Math.atan2(z1 - z0, x1 - x0), 0] });
    }
  }
  parts.push(welded("FR", "Foot rail", [-xr - 8, yr - 8, -zl - rc - 8], [xr + 8, yr + 8, zl + 8], rail));
  // the mirror: an oval on a bar, between two arch halves
  const yM = H - 225, mw = 330, mh = 450, zm = za + 22;
  const strips = 17;
  const oval: PartPiece[] = range(strips).map((i) => {
    const y = -mh / 2 + (mh / strips) * (i + 0.5);
    return { shape: "box", size: [Math.max(60, mw * Math.sqrt(1 - (y / (mh / 2)) ** 2)), mh / strips + 1, 10], pos: [0, y, 0], material: "glass" };
  });
  parts.push(welded("MIR", "Mirror", [-mw / 2, yM - mh / 2, zm - 5], [mw / 2, yM + mh / 2, zm + 5], about(oval, [0, -yM, -zm]), "glass"));
  const rA = 120, yC = yM - rA;
  for (const sx of [-1, 1]) {
    const pts: [number, number][] = [[sx * xa, yT], [sx * xa, yC], ...arc(sx * (xa - rA), yC, rA, sx < 0 ? Math.PI : 0, Math.PI / 2, 6).slice(1), [sx * (mw / 2 - 20), yM]];
    parts.push(welded(`AR${sx}`, "Mirror arch half", [Math.min(sx * xa, sx * (mw / 2 - 20)) - T / 2, yT, za - T / 2], [Math.max(sx * xa, sx * (mw / 2 - 20)) + T / 2, yM + T / 2, za + T / 2], curve(pts, "xy", za)));
  }
  parts.push({ id: "BAR", name: "Mirror bar", size: [mw - 40, 16, 16], pos: [0, yM, za], material: "metal" });

  const legScrews = (sz: number): CustomFix[] =>
    [-1, 1].map((sx) => ({ kind: "screw", count: 2, len: 12, dia: 6, at: [yB + 7, yB + 33].map((y): Vec3 => [sx * xl, y, sz * (zl + LT / 2 + 6)]), dir: [0, 0, -sz] as Vec3, on: `L${sx}${sz}` }));
  const steps: CustomStep[] = [
    {
      title: "Screw a foot into each leg",
      detail: "Into the plain end of the four legs, by hand. The two legs with the extra holes are the back ones.",
      add: ["L-1-1", "L1-1", "L-11", "L11"],
      fix: [{ ...FOOT, count: 4, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, fh, sz * zl])), dir: [0, 1, 0] }],
    },
    {
      title: "Push the back legs into the table",
      detail: "Lay the table upside down on a rug. Slide each back leg into its corner and fix it with two screws.",
      add: ["BOX", "DR", "SK"],
      fix: legScrews(-1),
      pose: "-y",
      tools: ["allen"],
      warnings: ["floor"],
      from: { BOX: [0, 300, 0] },
    },
    { title: "Push in the front legs", detail: "Each one has its own corner: match the holes, push it down into the socket and fix it with two screws.", fix: legScrews(1), tools: ["allen"] },
    {
      title: "Bolt the foot rail between the legs",
      detail: "Its curve goes round the back. One bolt through each leg into the rail.",
      add: ["FR"],
      fix: [-1, 1].flatMap((sx) => [-1, 1].map((sz): CustomFix => ({ kind: "bolt", count: 1, len: 30, dia: 6, at: [[sx * (xl + LT / 2), yr, sz * zl]], dir: [-sx, 0, 0], on: `L${sx}${sz}`, mate: "FR" }))),
      tools: ["allen"],
      from: { FR: [0, -300, 0] },
    },
    { title: "Turn it over and pull out the drawer", detail: "Stand the table on its feet and slide the drawer out to its stop.", pose: "+y" },
    { title: "Take out the packing pieces", detail: "Lift the cardboard pieces out of the drawer and the case, and recycle them." },
    { title: "Push the drawer back in", detail: "It should run all the way in without catching." },
    {
      title: "Bolt the mirror between the arch halves",
      detail: "Lay the mirror face down on a soft cloth on the table. One bolt through each arch half into the mirror's bar.",
      add: ["MIR", "BAR", "AR-1", "AR1"],
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "bolt", count: 1, len: 20, dia: 6, at: [[sx * (mw / 2 - 20), yM, za - T / 2]], dir: [0, 0, 1], on: `AR${sx}`, mate: "BAR" })),
      tools: ["allen"],
      warnings: ["face"],
      from: { MIR: [0, 500, 0], BAR: [0, 500, 0], "AR-1": [0, 500, 0], AR1: [0, 500, 0] },
    },
    { title: "Push the arch into the sockets", detail: "Both ends at once, down into the sockets at the back of the table, until the holes line up." },
    {
      title: "Lock the arch with the grub screws",
      detail: "One into each socket from behind. Turn the bolts at the mirror until it holds the tilt you want.",
      fix: [{ kind: "screw", name: "Grub screw", count: 2, len: 10, dia: 6, at: [-1, 1].map((sx): Vec3 => [sx * xa, yT + 15, za - 13]), dir: [0, 0, 1], on: "SK" }],
      tools: ["allen"],
    },
    { title: "Level it with the feet", detail: "Turn the feet until the table stands steady." },
  ];
  return { parts, steps };
}

/* ---------------- bedside table ---------------- */

function bedside(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const fh = 16, tt = 25;
  const yTop = H - tt; // underside of the top
  const xl = W / 2 - 20, zl = D / 2 - 20;
  const y0 = 160, y1 = 457; // the cupboard's bottom and top
  const parts: CustomPart[] = [];
  parts.push({ id: "TOP", name: "Table top", size: [W, tt, D], pos: [0, H - tt / 2, 0] });
  const ladder = (id: string, name: string, sz: number, back: boolean) =>
    welded(id, name, [-xl - 10, fh, sz * zl - 10], [xl + 10, yTop, sz * zl + 10], [
      ...[-1, 1].map((sx) => tubeY(sx * xl, sz * zl, fh, yTop, 20)),
      ...[yTop - 12, y1, y0].map((y) => tubeX(-xl, xl, y, sz * zl, 14)),
      ...(back ? [{ shape: "box", size: [2 * xl - 20, y1 - y0, 3], pos: [0, (y0 + y1) / 2, sz * zl] } as PartPiece] : []),
    ]);
  parts.push(ladder("BF", "Back frame", -1, true), ladder("FF", "Front frame", 1, false));
  const pw = 2 * xl - 20, pd = 2 * zl - 20;
  parts.push({ id: "BOT", name: "Cupboard bottom", size: [pw, 12, pd], pos: [0, y0 + 6, 0], material: "metal" });
  parts.push({ id: "MID", name: "Cupboard top", size: [pw, 12, pd], pos: [0, y1 + 6, 0], material: "metal" });
  for (const sx of [-1, 1]) parts.push({ id: `SP${sx}`, name: "Side panel", size: [4, y1 - y0, pd], pos: [sx * xl, (y0 + y1) / 2, 0], material: "metal" });
  // the door sits in the front frame, hinged on the right
  const dh = y1 - y0 - 12;
  parts.push(
    welded("DOOR", "Door", [-pw / 2, y0 + 8, zl - 8], [pw / 2, y0 + 8 + dh, zl + 8], [
      { shape: "box", size: [pw, dh, 16], pos: [0, y0 + 8 + dh / 2, zl] },
      { shape: "box", size: [12, dh * 0.5, 10], pos: [-pw / 2 + 24, y0 + 8 + dh / 2, zl + 13] },
    ]),
  );
  const panelScrews = (y: number, sz: number): CustomFix => ({ kind: "screw", count: 2, len: 10, dia: 5, at: [-1, 1].map((sx): Vec3 => [sx * (pw / 2 - 30), y, sz * (zl - 10)]), dir: [0, 0, sz] });
  const xh = pw / 2 - 20;
  const steps: CustomStep[] = [
    {
      title: "Hook the cupboard bottom into the back frame",
      detail: "Lay the back frame flat on a rug. Drop the panel's hooks into the slots on the lowest bar.",
      add: ["BF", "BOT"],
      pose: "+z",
      warnings: ["floor"],
      from: { BOT: [0, 0, 250] },
    },
    { title: "Screw it to the frame", detail: "Two screws through the panel's edge into the frame.", fix: [panelScrews(y0 + 6, -1)], tools: ["screwdriver"] },
    { title: "Hook the cupboard top in", detail: "Into the middle bar, the same way.", add: ["MID"], from: { MID: [0, 0, 250] } },
    { title: "Screw it to the frame", detail: "Two more screws.", fix: [panelScrews(y1 + 6, -1)], tools: ["screwdriver"] },
    { title: "Lay the front frame on top", detail: "Its bars over the other ends of the two panels, the hooks in the slots.", add: ["FF"], from: { FF: [0, 0, 300] } },
    { title: "Screw the panels to the front frame", detail: "Two screws in each panel.", fix: [panelScrews(y0 + 6, 1), panelScrews(y1 + 6, 1)], tools: ["screwdriver"] },
    { title: "Slide in a side panel", detail: "Between the frames, its tabs into the slots, until it sits flat.", add: ["SP-1"], from: { "SP-1": [-250, 0, 0] } },
    { title: "Lock it with its catches", detail: "Push each of the four catches in until it locks." },
    { title: "Slide in the other side panel", detail: "The same way, from the other side.", add: ["SP1"], from: { SP1: [250, 0, 0] } },
    { title: "Lock its catches", detail: "All four, until each one locks." },
    {
      title: "Screw the frame onto the top",
      detail: "Lay the top face down on a rug and stand the frame upside down on it. One screw through each leg's top.",
      add: ["TOP"],
      fix: [{ kind: "screw", count: 4, len: 12, dia: 6, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, yTop - 12, sz * zl])), dir: [0, 1, 0], mate: "TOP" }],
      pose: "-y",
      tools: ["allen"],
      from: { TOP: [0, 300, 0] },
    },
    {
      title: "Screw in the feet",
      detail: "One into the end of each leg, by hand. Then turn the table over.",
      fix: [{ ...FOOT, count: 4, at: [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * xl, fh, sz * zl])), dir: [0, 1, 0] }],
    },
    {
      title: "Screw the top hinge onto the door",
      detail: "Lay the door face down. The hinge goes on the top corner of the side you want it to open from, with two screws.",
      add: ["DOOR"],
      fix: [
        { kind: "hinge", count: 1, at: [[xh, y0 + dh - 10, zl - 8]], dir: [0, 0, 1], on: "DOOR" },
        { kind: "screw", count: 2, len: 10, dia: 5, at: [-1, 1].map((d): Vec3 => [xh, y0 + dh - 30 + d * 12, zl - 8]), dir: [0, 0, 1], on: "DOOR" },
      ],
      pose: "+y",
      tools: ["screwdriver"],
      from: { DOOR: [0, 0, 300] },
    },
    {
      title: "Screw the buffer on",
      detail: "One screw with its rubber ring, at the bottom corner on the other side.",
      fix: [
        { kind: "washer", name: "Rubber buffer", count: 1, len: 6, dia: 16, at: [[-xh, y0 + 40, zl - 8]], dir: [0, 0, 1], on: "DOOR" },
        { kind: "screw", count: 1, len: 16, dia: 4, at: [[-xh, y0 + 40, zl - 8]], dir: [0, 0, 1], on: "DOOR" },
      ],
      tools: ["screwdriver"],
    },
    { title: "Press in the door stop", detail: "Into the hole at the top corner on the handle side.", fix: [{ kind: "cap", name: "Door stop", count: 1, len: 8, dia: 14, at: [[-xh, y0 + dh - 20, zl - 8]], dir: [0, 0, 1], on: "DOOR" }] },
    {
      title: "Push the pivot pin into the cupboard bottom",
      detail: "Into the front hole on the hinge side.",
      fix: [{ kind: "pin", name: "Pivot pin", count: 1, len: 14, dia: 6, at: [[xh, y0 + 12, zl - 14]], dir: [0, -1, 0], on: "BOT" }],
    },
    { title: "Set the door on the pin", detail: "Lower the hole in its bottom corner onto the pin." },
    { title: "Click the top hinge in", detail: "Swing the door in and push the hinge up into the cupboard top until it clicks." },
    { title: "Check the door and level it", detail: "It should close against the stop. Turn the feet until the table stands steady." },
  ];
  return { parts, steps };
}

/* ---------------- wall-mounted bedside table ---------------- */

function wallTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const tt = 18, yU = H - tt; // underside of the top
  const yb = yU - 145; // bottom of the box
  const xs = W / 2 - 15, zb = -D / 2 + 10, zf = D / 2 - 10; // box sides, back, front
  const zt = zb + 12; // the side tubes at the back corners
  const yStub = yb - 50;
  const parts: CustomPart[] = [];
  parts.push({ id: "TOP", name: "Top", size: [W, tt, D], pos: [0, H - tt / 2, 0] });
  for (const sx of [-1, 1])
    parts.push(
      welded(`SD${sx}`, "Side", [sx * xs - 10, yStub, zb], [sx * xs + 10, yU, zf], [
        { shape: "box", size: [6, yU - yb, zf - zb - 24], pos: [sx * xs, (yU + yb) / 2, (zf + zb + 24) / 2] },
        tubeY(sx * xs, zt, yStub, yU, 20),
      ]),
    );
  const iw = 2 * xs - 20;
  // the back has the two wall brackets on it
  parts.push(
    welded("BK", "Back", [-iw / 2, yb, zb - 10], [iw / 2, yU, zb + 4], [
      { shape: "box", size: [iw, yU - yb, 4], pos: [0, (yU + yb) / 2, zb + 2] },
      ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [50, 50, 8], pos: [sx * (iw / 2 - 60), yU - 45, zb - 5] })),
    ]),
  );
  parts.push({ id: "BT", name: "Bottom", size: [iw, 8, zf - zb - 30], pos: [0, yb + 4, (zf + zb) / 2 - 8], material: "metal" });
  parts.push({ id: "FR", name: "Front rail", size: [iw, 20, 12], pos: [0, yb + 10, zf - 12], material: "metal" });
  // the rack frame: a C-shaped tube each side, down from the stubs and forward under the box, with slats across
  const yR = 30, rc = 40;
  const rack: PartPiece[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * xs;
    rack.push(tubeY(x, zt, yR + rc, yStub), ...curve(arc(zt + rc, yR + rc, rc, Math.PI, 1.5 * Math.PI, 4), "zy", x), tubeZ(x, yR, zt + rc, zf + 10));
  }
  for (const z of range(5).map((i) => zt + 70 + ((zf - zt - 70) * i) / 4)) rack.push(tubeX(-xs, xs, yR, z, 12));
  parts.push(welded("RK", "Rack frame", [-xs - 10, yR - 10, zt - 10], [xs + 10, yStub, zf + 20], rack));
  const fh = yU - yb - 30;
  parts.push({ id: "FL", name: "Flap", size: [iw + 10, fh, 14], pos: [0, yb + 20 + fh / 2, zf + 7], material: "metal" });
  parts.push({ id: "HD", name: "Handle", size: [iw * 0.55, 10, 16], pos: [0, yU - 18, zf + 20], material: "metal" });

  const zWall = zb - 10;
  const wx = iw / 2 - 60, wy = yU - 45;
  const steps: CustomStep[] = [
    {
      title: "Screw a side onto the top",
      detail: "Lay the top face down on a rug. Two screws through the side's flange into the top.",
      add: ["TOP", "SD-1"],
      fix: [{ kind: "screw", count: 2, len: 12, dia: 5, at: [zb + 60, zf - 40].map((z): Vec3 => [-xs + 15, yU, z]), dir: [0, 1, 0], on: "SD-1", mate: "TOP" }],
      pose: "-y",
      tools: ["screwdriver"],
      warnings: ["floor"],
      from: { "SD-1": [0, -250, 0] },
    },
    {
      title: "Screw on the other side",
      detail: "The same way, two screws.",
      add: ["SD1"],
      fix: [{ kind: "screw", count: 2, len: 12, dia: 5, at: [zb + 60, zf - 40].map((z): Vec3 => [xs - 15, yU, z]), dir: [0, 1, 0], on: "SD1", mate: "TOP" }],
      tools: ["screwdriver"],
      from: { SD1: [0, -250, 0] },
    },
    { title: "Slide the back down over the tubes", detail: "The wall brackets face out. Its edges slide over the tubes at the back of the sides.", add: ["BK"], from: { BK: [0, -250, 0] } },
    {
      title: "Screw the back to the sides",
      detail: "Two screws each side.",
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 2, len: 10, dia: 5, at: [yb + 40, yU - 40].map((y): Vec3 => [sx * (iw / 2), y, zb + 10]), dir: [sx, 0, 0], on: "BK" })),
      tools: ["screwdriver"],
    },
    { title: "Slide the bottom in", detail: "Into the grooves in the sides, from the front, all the way to the back.", add: ["BT"], from: { BT: [0, 0, 260] } },
    { title: "Lock the bottom's catches", detail: "Push each of the four catches in until it locks." },
    { title: "Hook the front rail on", detail: "Its hooks drop into the slots at the front of both sides.", add: ["FR"], from: { FR: [0, -200, 0] } },
    {
      title: "Screw the front rail on",
      detail: "One screw at each end.",
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", count: 1, len: 10, dia: 5, at: [[sx * (iw / 2), yb + 10, zf - 12]], dir: [sx, 0, 0], on: "FR" })),
      tools: ["screwdriver"],
    },
    { title: "Push the rack frame onto the tubes", detail: "Turn it round so the back faces you. The rack's tube ends slide over the tubes sticking out of the sides.", add: ["RK"], from: { RK: [0, -300, 0] } },
    {
      title: "Lock the rack with the grub screws",
      detail: "One into each joint, until it is just below the surface.",
      fix: [-1, 1].map((sx): CustomFix => ({ kind: "screw", name: "Grub screw", count: 1, len: 8, dia: 6, at: [[sx * (xs + 10), yStub + 15, zt]], dir: [-sx, 0, 0], on: "RK" })),
      tools: ["allen"],
    },
    {
      title: "Stick the pads on the back",
      detail: "Two on each back tube, where it will touch the wall. Then turn the table over.",
      fix: [{ kind: "glide", name: "Adhesive pad", count: 4, len: 2, dia: 18, at: [-1, 1].flatMap((sx) => [yb - 20, yR + rc + 20].map((y): Vec3 => [sx * xs, y, zt - 10])), dir: [0, 0, 1], on: "RK" }],
    },
    {
      title: "Mark and drill the wall",
      detail: "Hold it against the wall at the height you want, level it, and mark through the two brackets. Use plugs made for your wall.",
      fix: [{ kind: "plug", count: 2, at: [-1, 1].map((sx): Vec3 => [sx * wx, wy, zWall - 40]), dir: [0, 0, -1] }],
      pose: "+y",
      tools: ["level", "drill", "pencil"],
      wall: true,
    },
    {
      title: "Turn in the wall screws",
      detail: "Leave each head a few millimetres out so the brackets can hang on it. They aren't included.",
      fix: [{ kind: "screw", count: 2, len: 50, dia: 5, at: [-1, 1].map((sx): Vec3 => [sx * wx, wy, zWall]), dir: [0, 0, -1] }],
      tools: ["screwdriver"],
      wall: true,
    },
    {
      title: "Hang it on the screws",
      detail: "Clip a hook plate into each bracket and hang them on the screw heads. Set the height and depth with the bracket screws, then tighten them.",
      fix: [{ kind: "hook", name: "Hook plate", count: 2, len: 30, dia: 24, at: [-1, 1].map((sx): Vec3 => [sx * wx, wy, zb - 9]), dir: [0, 0, -1], on: "BK" }],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["tip"],
    },
    {
      title: "Screw the buffers onto the flap",
      detail: "Lay the flap face down. A screw through each rubber ring, near the top corners.",
      add: ["FL"],
      fix: [
        // the screw first, so the buffer stacks on it rather than pushing it off the flap
        { kind: "screw", count: 2, len: 16, dia: 4, at: [-1, 1].map((sx): Vec3 => [sx * (iw / 2 - 20), yU - 30, zf]), dir: [0, 0, 1], on: "FL" },
        { kind: "washer", name: "Rubber buffer", count: 2, len: 6, dia: 16, at: [-1, 1].map((sx): Vec3 => [sx * (iw / 2 - 20), yU - 30, zf]), dir: [0, 0, 1], on: "FL" },
      ],
      tools: ["screwdriver"],
      from: { FL: [0, 0, 300] },
    },
    {
      title: "Screw the handle on",
      detail: "Along the flap's top edge, two screws from behind.",
      add: ["HD"],
      fix: [{ kind: "screw", count: 2, len: 10, dia: 5, at: [-1, 1].map((sx): Vec3 => [sx * iw * 0.2, yU - 18, zf]), dir: [0, 0, 1], on: "FL", mate: "HD" }],
      tools: ["screwdriver"],
      from: { HD: [0, 0, 200] },
    },
    {
      title: "Click the flap onto the box",
      detail: "Push a hinge onto each bottom corner, then press it into the box until it clicks.",
      fix: [{ kind: "hinge", count: 2, at: [-1, 1].map((sx): Vec3 => [sx * (iw / 2 - 30), yb + 30, zf - 4]), dir: [0, 0, -1], on: "FL" }],
    },
  ];
  return { parts, steps };
}

function recipe(s: ProductSpec): CustomParams | null {
  const slug = s.slug ?? "";
  if (/^grafjallet-room-divider/.test(slug)) return divider(s);
  if (/^grafjallet-clothes-rack/.test(slug)) return clothesRack(s);
  if (/^grafjallet-dressing-table/.test(slug)) return dressingTable(s);
  if (/^grafjallet-wall-mounted-bedside/.test(slug)) return wallTable(s);
  if (/^grafjallet-bedside-table/.test(slug)) return bedside(s);
  return null;
}

const family: Family = {
  names: ["GRÅFJÄLLET", "GRAFJALLET"],
  recipe,
};
export default family;
