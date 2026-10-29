import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * MULLSJÖ, read from the desk's and the swivel chair's manuals.
 * Desk: the top lies upside down while the cable tray is riveted under it, the two leg frames are joined by the long
 * rails, and the whole frame is bolted to the top with fourteen bolts. The riser is built on its own (back and ends
 * on dowels and two cam locks, dowels into both edges), stood on the desk over two dowelled supports and bolted
 * from below. The storage unit (two trays screwed to two legs) hooks onto either leg frame, inside or outside.
 * Swivel chair: see swivelChair.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
/** One fix per host, mate and direction, since a step takes at most ten fixes. */
function grouped(kind: CustomFix["kind"], list: { p: Vec3; dir: Vec3; on?: string; mate?: string }[], o: Partial<CustomFix> = {}): CustomFix[] {
  const groups = new Map<string, CustomFix>();
  for (const f of list) {
    const key = `${f.on}|${f.mate}|${f.dir.join(",")}`;
    const g = groups.get(key);
    if (g) {
      g.at!.push(f.p);
      g.count++;
    } else groups.set(key, at(kind, [f.p], f.dir, f.on, f.mate, o));
  }
  return [...groups.values()];
}
const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });
const SIDES = [-1, 1] as const;

function desk(): CustomParams {
  // IKEA: 135 wide, 70 deep, 76 high (85 with the riser), 159 wide with the storage unit outside
  const W = 1350, D = 700, H = 760, TT = 25;
  const yU = H - TT; // underside of the top
  const xf = W / 2 - 35, zl = D / 2 - 40, L = 30; // leg frames and their round legs
  const yLow = 170;
  const frame = (sx: number): CustomPart => ({
    id: sx < 0 ? "FL" : "FR",
    name: "Leg frame",
    size: [L, yU - 12, 2 * zl + L],
    pos: [sx * xf, (yU + 12) / 2, 0],
    material: "metal",
    pieces: [
      ...SIDES.map((sz): PartPiece => ({ shape: "cyl", size: [L, yU - 12, L], pos: [0, 0, sz * zl] })),
      box([L, L, 2 * zl - L], [0, yU - L / 2 - (yU + 12) / 2, 0]),
      box([L, L, 2 * zl - L], [0, yLow - (yU + 12) / 2, 0]),
    ],
  });
  const railY = yU - 25;
  const parts: CustomPart[] = [
    { id: "T", name: "Desk top", size: [W, TT, D], pos: [0, H - TT / 2, 0], material: "board" },
    {
      id: "C",
      name: "Cable tray",
      size: [1000, 60, 120],
      pos: [0, yU - 30, -180],
      material: "metal",
      pieces: [box([1000, 2, 120], [0, -29, 0]), box([1000, 60, 2], [0, 0, 59]), box([1000, 60, 2], [0, 0, -59])],
    },
    frame(-1),
    frame(1),
    ...SIDES.map((sz): CustomPart => ({ id: sz < 0 ? "RB" : "RF", name: "Long rail", size: [2 * xf - L, 50, 20], pos: [0, railY, sz * zl], material: "metal" })),
  ];

  // the riser, standing at the back of the top
  const RW = 1250, RD = 250, RH = 90, t = 18;
  const zr = -D / 2 + RD / 2;
  const yr = H + (RH - t) / 2; // middle of the walls
  const xe = RW / 2 - t / 2;
  const zb = -D / 2 + t / 2;
  const xs = 300, zs = -D / 2 + t + 75;
  parts.push(
    { id: "UB", name: "Riser back", size: [RW - 2 * t, RH - t, t], pos: [0, yr, zb], material: "board" },
    ...SIDES.map((sx): CustomPart => ({ id: sx < 0 ? "UL" : "UR", name: "Riser end", size: [t, RH - t, RD], pos: [sx * xe, yr, zr], material: "board" })),
    { id: "UT", name: "Riser top", size: [RW, t, RD], pos: [0, H + RH - t / 2, zr], material: "board" },
    ...SIDES.map((sx): CustomPart => ({ id: sx < 0 ? "SL" : "SR", name: "Support", size: [t, RH - t, 150], pos: [sx * xs, yr, zs], material: "board" })),
  );

  // the storage unit, hooked outside the right leg frame
  const xu = xf + L / 2 + 245; // its legs
  const zu = 230;
  const tray = (id: string, y: number): CustomPart => {
    const w = xu - L / 2 - (xf + L / 2), d = 2 * zu, lip = 40;
    return {
      id,
      name: "Tray",
      size: [w, lip, d],
      pos: [xf + L / 2 + w / 2, y + lip / 2, 0],
      material: "metal",
      pieces: [box([w, 2, d], [0, -lip / 2 + 1, 0]), ...SIDES.map((s) => box([w, lip, 2], [0, 0, s * (d / 2 - 1)])), ...SIDES.map((s) => box([2, lip, d - 4], [s * (w / 2 - 1), 0, 0]))],
    };
  };
  const yTray = [600, 150];
  parts.push(
    ...SIDES.map((sz): CustomPart => ({ id: sz < 0 ? "LB" : "LF", name: "Storage leg", shape: "cyl", size: [L, 680, L], pos: [xu, 12 + 340, sz * zu], material: "metal" })),
    tray("P1", yTray[0]),
    tray("P2", yTray[1]),
  );

  const rivets = [-450, -150, 150, 450].flatMap((x) => SIDES.map((s): Vec3 => [x, yU - 2, -180 + s * 40]));
  const railBolts = SIDES.flatMap((sx) => SIDES.flatMap((sz) => [railY - 12, railY + 12].map((y): Vec3 => [sx * (xf - L / 2), y, sz * zl])));
  const topBolts: { p: Vec3; on: string }[] = [
    ...SIDES.flatMap((sx) => [-200, 0, 200].map((z) => ({ p: [sx * xf, yU - L, z] as Vec3, on: sx < 0 ? "FL" : "FR" }))),
    ...SIDES.flatMap((sz) => [-450, -150, 150, 450].map((x) => ({ p: [x, railY - 25, sz * zl] as Vec3, on: sz < 0 ? "RB" : "RF" }))),
  ];
  const legFeet = SIDES.flatMap((sx) => SIDES.map((sz): Vec3 => [sx * xf, 0, sz * zl]));
  const pair = (x: number, y: number, z: number, axis: 0 | 2): Vec3[] => SIDES.map((s): Vec3 => (axis === 0 ? [x + s * 60, y, z] : [x, y, z + s * 60]));
  const edgeDowels = (y: number) => [
    ...SIDES.flatMap((sx) => pair(sx * xe, y, zr, 2).map((p) => ({ p, on: sx < 0 ? "UL" : "UR" }))),
    ...SIDES.map((sx) => ({ p: [sx * 300, y, zb] as Vec3, on: "UB" })),
  ];
  const dowels = (list: { p: Vec3; on: string }[], dir: Vec3, mate: string) => grouped("dowel", list.map((d) => ({ ...d, dir, mate })));

  const steps: CustomStep[] = [
    {
      title: "Rivet the cable tray under the top",
      detail: "Lay the top upside down on a rug. Push a sleeve through each hole in the tray into the top, then press a pin into each sleeve until it's flush.",
      add: ["T", "C"],
      fix: [at("clip", rivets, [0, 1, 0], "C", "T", { name: "Rivet sleeve", len: 10, dia: 10 }), at("pin", rivets, [0, 1, 0], "C", "T", { name: "Rivet pin", len: 12, dia: 5 })],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt the long rails between the leg frames",
      detail: "Two bolts in each end of each rail. Turn them in with the Allen key but leave them a little loose for now.",
      add: ["FL", "FR", "RB", "RF"],
      fix: grouped("bolt", railBolts.map((p) => ({ p, dir: [p[0] < 0 ? 1 : -1, 0, 0] as Vec3, on: p[0] < 0 ? "FL" : "FR", mate: p[2] < 0 ? "RB" : "RF" })), { len: 30, dia: 6 }),
      tools: ["allen"],
    },
    {
      title: "Bolt the frame to the top",
      detail: "Stand the frame on the top so every hole meets one in the top. Fourteen bolts, all turned in loosely first.",
      fix: grouped("bolt", topBolts.map((b) => ({ p: b.p, dir: [0, 1, 0] as Vec3, on: b.on, mate: "T" })), { len: 60, dia: 6 }),
      tools: ["allen"],
    },
    { title: "Tighten the fourteen bolts", detail: "Once they're all in, go round and tighten them until the heads sit flat.", tools: ["allen"] },
    { title: "Tighten the rail bolts", detail: "Now tighten the eight bolts in the long rails, so the frame stands square.", tools: ["allen"], check: "square" },
    {
      title: "Screw a foot into each leg",
      detail: "Turn them in by hand until they stop. You can adjust them later to level the desk.",
      fix: [at("foot", legFeet, [0, 1, 0], undefined, undefined, { len: 12, dia: 30 })],
    },
    {
      title: "Tap dowels into the ends of the riser back",
      detail: "Turn the desk over onto its feet first. Two dowels go into each end of the back board.",
      fix: SIDES.flatMap((sx) => [yr - 20, yr + 20].map((y) => at("dowel", [[sx * (xe - t / 2), y, zb]], [sx, 0, 0], "UB", sx < 0 ? "UL" : "UR"))),
      add: ["UB"],
      tools: ["hammer"],
      pose: "+y",
      people: 2,
    },
    {
      title: "Screw a cam pin into each riser end",
      detail: "Into the hole on the inside face, near the back edge. Screw it in until it stops.",
      fix: SIDES.map((sx) => at("camScrew", [[sx * (xe - t / 2), yr, zb]], [sx, 0, 0], sx < 0 ? "UL" : "UR", "UB", { len: 34 })),
      tools: ["screwdriver"],
    },
    { title: "Push the ends onto the back", detail: "The cam pins and dowels go into the holes in the ends of the back.", add: ["UL", "UR"] },
    {
      title: "Turn the cam locks",
      detail: "One in each end of the back, arrow towards the pin. Turn it clockwise until it pulls the joint tight.",
      fix: SIDES.map((sx) => at("cam", [[sx * (xe - t / 2 - 30), yr, zb + t / 2]], [0, 0, -1], "UB", undefined, { dia: 15 })),
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the top edges",
      detail: "Two in each end and two in the back.",
      fix: dowels(edgeDowels(H + RH - t), [0, 1, 0], "UT"),
      tools: ["hammer"],
    },
    { title: "Fit the riser top", detail: "Lay it on the dowels and press it down evenly all along.", add: ["UT"] },
    {
      title: "Tap dowels into the bottom edges",
      detail: "Two more in each end and two in the back. These go into the desk top.",
      fix: dowels(edgeDowels(H), [0, -1, 0], "T"),
      tools: ["hammer"],
    },
    {
      title: "Push the two supports into the desk top",
      detail: "Tap two dowels into the holes for each support near the back of the top, then press the supports onto them.",
      add: ["SL", "SR"],
      fix: SIDES.flatMap((sx) => SIDES.map((s) => at("dowel", [[sx * xs, H, zs + s * 45]], [0, 1, 0], "T", sx < 0 ? "SL" : "SR"))),
      tools: ["hammer"],
    },
    {
      title: "Bolt the riser to the desk from below",
      detail: "Lower the riser onto the dowels and supports. Four long bolts go up through the top: two into the ends, two into the supports.",
      fix: [...SIDES.map((sx) => at("bolt", [[sx * xe, yU, zr]], [0, 1, 0], "T", sx < 0 ? "UL" : "UR", { len: 100, dia: 6 })), ...SIDES.map((sx) => at("bolt", [[sx * xs, yU, zs]], [0, 1, 0], "T", sx < 0 ? "SL" : "SR", { len: 100, dia: 6 }))],
      tools: ["allen"],
    },
    {
      title: "Push the trays onto the storage legs",
      detail: "Lay the two legs on the floor and press the trays onto them, both with their lips the same way.",
      add: ["LB", "LF", "P1", "P2"],
    },
    {
      title: "Screw the trays to the legs",
      detail: "One screw through the bracket at each corner where a tray meets a leg.",
      fix: yTray.flatMap((y, i) => SIDES.map((sz) => at("screw", [[xu - L / 2 - 2, y + 20, sz * (zu - 8)]], [1, 0, 0], i ? "P2" : "P1", sz < 0 ? "LB" : "LF", { len: 12, dia: 5 }))),
      tools: ["screwdriver"],
    },
    {
      title: "Screw a foot into each storage leg",
      detail: "By hand, all the way in.",
      fix: [at("foot", SIDES.map((sz): Vec3 => [xu, 0, sz * zu]), [0, 1, 0], undefined, undefined, { len: 12, dia: 30 })],
    },
    {
      title: "Hook the storage unit onto the desk",
      detail: "Hang the trays on the rails of a leg frame, so the legs stand outside it. It fits on either side, inside or outside the frame.",
    },
    {
      title: "Hang the hook on the frame",
      detail: "Push it down over the top rail of a leg frame, for headphones or a bag.",
      fix: [at("hook", [[-xf - L / 2, yU - 40, 120]], [1, 0, 0], "FL", undefined, { name: "Hook", len: 60, dia: 30 })],
    },
  ];
  return { parts, steps };
}

interface Bit {
  piece: PartPiece;
  lo: Vec3;
  hi: Vec3;
}
/** A straight round tube between two points. */
function tb(a: Vec3, b: Vec3, dia: number): Bit {
  const d: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const r = dia / 2;
  return {
    piece: { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(d[2], d[1]), 0, Math.asin(-d[0] / len)] },
    lo: [0, 1, 2].map((k) => Math.min(a[k], b[k]) - r) as Vec3,
    hi: [0, 1, 2].map((k) => Math.max(a[k], b[k]) + r) as Vec3,
  };
}
const bit = (size: Vec3, pos: Vec3, shape: "box" | "cyl" = "box"): Bit => ({
  piece: { shape, size, pos },
  lo: [pos[0] - size[0] / 2, pos[1] - size[1] / 2, pos[2] - size[2] / 2],
  hi: [pos[0] + size[0] / 2, pos[1] + size[1] / 2, pos[2] + size[2] / 2],
});
function assemble(id: string, name: string, bits: Bit[], material: CustomPart["material"]): CustomPart {
  const lo = [0, 1, 2].map((k) => Math.min(...bits.map((b) => b.lo[k]))) as Vec3;
  const hi = [0, 1, 2].map((k) => Math.max(...bits.map((b) => b.hi[k]))) as Vec3;
  const pos = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3;
  return {
    id,
    name,
    size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
    pos,
    material,
    pieces: bits.map((b) => ({ ...b.piece, pos: [b.piece.pos[0] - pos[0], b.piece.pos[1] - pos[1], b.piece.pos[2] - pos[2]] as Vec3 })),
  };
}

/**
 * Swivel chair: the seat shell lies upside down on a rug while the tube frame (arms and back posts) is screwed to it,
 * then the back shell is screwed to the back posts. The gas lift goes into the four-legged base and the seat onto
 * the lift. The back and seat cushions click on, the armrest pads are screwed on from below, and sitting down once
 * locks the lift.
 */
function swivelChair(): CustomParams {
  // IKEA: 67 wide, 67 deep, 91 high with the seat at its highest (54 cm)
  const T = 22;
  const seat = 540, yPan = seat - 50; // top of the seat shell, under the cushion
  const yRail = yPan - 50 - T / 2;
  const xa = 310, xr = 220, ya = 670, xb = 150, zb = -262;
  const base = assemble("B", "Base", [
    bit([70, 90, 70], [0, 315, 0], "cyl"),
    ...SIDES.flatMap((sx) => SIDES.flatMap((sz) => [tb([0, 320, 0], [sx * 250, 300, sz * 250], 26), tb([sx * 250, 300, sz * 250], [sx * 270, 25, sz * 270], 26), bit([36, 25, 36], [sx * 270, 12, sz * 270], "cyl")])),
  ], "metal");
  const frame = assemble("F", "Frame", [
    ...SIDES.flatMap((sx) => [
      tb([sx * xr, yRail, -200], [sx * xr, yRail, 190], T),
      tb([sx * xr, yRail, 190], [sx * xa, yRail + 40, 220], T),
      tb([sx * xa, yRail + 40, 220], [sx * xa, ya, 220], T),
      tb([sx * xa, ya, 220], [sx * xa, ya, -170], T),
      tb([sx * xa, ya, -170], [sx * xa, yRail + 40, -200], T),
      tb([sx * xa, yRail + 40, -200], [sx * xr, yRail, -200], T),
      // the back posts run up behind the whole back shell
      tb([sx * xb, yRail, zb], [sx * xb, 870, zb], T),
    ]),
    tb([-xr, yRail, -200], [xr, yRail, -200], T),
    tb([-xb, yRail, zb], [xb, yRail, zb], T),
    ...SIDES.map((sx) => tb([sx * xb, yRail, zb], [sx * xb, yRail, -200], T)),
  ], "metal");
  const pan = assemble("S", "Seat shell", [bit([480, 50, 450], [0, yPan - 25, -10]), bit([200, 40, 200], [0, yPan - 70, 0])], "board");
  const lift: CustomPart = { id: "G", name: "Gas lift", shape: "cyl", size: [50, yPan - 90 - 340, 50], pos: [0, (yPan - 90 + 340) / 2, 0], material: "metal" };
  const zs = zb + T / 2 + 15;
  const back: CustomPart = { id: "K", name: "Back shell", size: [440, 290, 30], pos: [0, 760, zs], material: "board" };
  const backPad: CustomPart = { id: "P", name: "Back cushion", size: [460, 310, 50], pos: [0, 760, zs + 40], material: "soft" };
  const seatPad: CustomPart = { id: "C", name: "Seat cushion", size: [490, 50, 460], pos: [0, seat - 25, 0], material: "soft" };
  const arms = SIDES.map((sx): CustomPart => ({ id: sx < 0 ? "AL" : "AR", name: "Armrest pad", size: [50, 16, 320], pos: [sx * xa, ya + T / 2 + 8, 30], material: "board" }));
  const parts = [pan, frame, back, base, lift, backPad, seatPad, ...arms];

  const SCREW = { len: 16, dia: 6 };
  const steps: CustomStep[] = [
    {
      title: "Screw the frame to the seat shell",
      detail: "Lay the seat shell upside down on a rug and set the frame over it, arms down. Two screws through each side rail.",
      add: ["S", "F"],
      fix: SIDES.map((sx) => at("screw", [-120, 120].map((z): Vec3 => [sx * xr, yRail - T / 2, z]), [0, 1, 0], "F", "S", SCREW)),
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw the back shell to the back posts",
      detail: "Turn it the right way up. Hold the shell against the two posts and fix it with two screws in each.",
      add: ["K"],
      fix: SIDES.map((sx) => at("screw", [690, 830].map((y): Vec3 => [sx * xb, y, zb - T / 2]), [0, 0, 1], "F", "K", SCREW)),
      tools: ["allen"],
      pose: "+y",
    },
    {
      title: "Push the gas lift into the base",
      detail: "Stand the base on its feet and drop the narrow end of the lift into the hole in the middle.",
      add: ["B", "G"],
    },
    { title: "Lower the seat onto the gas lift", detail: "Line up the hole under the seat with the top of the lift and push it down.", from: { S: [0, 300, 0], F: [0, 300, 0], K: [0, 300, 0] } },
    {
      title: "Click the back cushion on",
      detail: "Hook it over the top of the back shell and press it down until all eight clips catch.",
      add: ["P"],
      from: { P: [0, 120, 150] },
    },
    {
      title: "Slide the seat cushion on until it clicks",
      detail: "Lay it on the seat shell slightly forward, then push it back so all nine clips catch.",
      add: ["C"],
      from: { C: [0, 60, 200] },
    },
    {
      title: "Screw the armrest pads on",
      detail: "Two screws up through each armrest tube into its pad.",
      add: ["AL", "AR"],
      fix: SIDES.map((sx) => at("screw", [-80, 140].map((z): Vec3 => [sx * xa, ya - T / 2, z]), [0, 1, 0], "F", sx < 0 ? "AL" : "AR", { len: 14, dia: 5 })),
      tools: ["screwdriver"],
    },
    { title: "Sit down to lock the seat", detail: "Sit on it once, firmly. Your weight pushes the seat tight onto the gas lift." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["MULLSJÖ", "MULLSJO"],
  recipe(s: ProductSpec) {
    const slug = s.slug ?? "";
    if (/mullsjo-desk/.test(slug)) return desk();
    if (/mullsjo-swivel-chair/.test(slug)) return swivelChair();
    return null;
  },
};
export default family;
