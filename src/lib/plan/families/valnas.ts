import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * VALNÄS, read from its manuals. The coffee table and the trolley share one oak base: four round legs with dowels
 * and connector pins, two long and two short rails with cross nuts, the short pair dropped over the long pair where
 * they cross, set screws to lock each joint and one bolt through the middle. The coffee table's top is bolted on
 * upside down, then brass sleeves and floor pads go on the feet. The trolley is built upside down on its castors,
 * with the lower tray slid on before the last leg; the top tray is loose and lifts off. The sofa is a seat frame
 * with the backrest on four studs and the rolled armrests on three studs each, all done up with washers and star
 * knobs, then four legs, the fixed cover and the cushions.
 */

type P = CustomPart;
const sx = [-1, 1] as const;

/** A flat oval, as a box with a half disc at each end. */
const oval = (L: number, T: number, Dd: number, y = 0, material: P["material"] = "wood"): PartPiece[] => [
  { shape: "box", size: [L - Dd, T, Dd], pos: [0, y, 0], material },
  { shape: "halfcyl", size: [Dd, T, Dd / 2], pos: [-(L - Dd) / 2 - Dd / 4, y, 0], rot: [0, -Math.PI / 2, 0], material },
  { shape: "halfcyl", size: [Dd, T, Dd / 2], pos: [(L - Dd) / 2 + Dd / 4, y, 0], rot: [0, Math.PI / 2, 0], material },
];

/** The raised edge round an oval tray, as straight walls and short segments round each end. */
function ovalRim(L: number, Dd: number, h: number, t: number, y: number): PartPiece[] {
  const r = Dd / 2 - t / 2, cx = (L - Dd) / 2, n = 9;
  const out: PartPiece[] = sx.map((z) => ({ shape: "box", size: [L - Dd, h, t], pos: [0, y, z * r], material: "wood" }));
  for (const side of sx)
    for (let i = 0; i < n; i++) {
      const th = -Math.PI / 2 + (Math.PI * (i + 0.5)) / n;
      const a = side > 0 ? th : Math.PI - th;
      const seg = 2 * r * Math.sin(Math.PI / (2 * n)) * 1.08;
      out.push({ shape: "box", size: [t, h, seg], pos: [side * cx + r * Math.cos(a), y, r * Math.sin(a)], rot: [0, -a, 0], material: "wood" });
    }
  return out;
}

/* ---------- the oak cross base ---------- */

interface Base {
  parts: P[];
  legs: { id: string; x: number; z: number; n: Vec3 }[]; // n: from the leg towards the middle
  rails: { id: string; axis: "x" | "z"; y: number; half: number }[];
  yU: number; // top of the upper rails
  joint: (leg: string, rail: string) => Vec3; // where a rail meets a leg (on the leg's face)
}

function crossBase(xL: number, zL: number, legD: number, yLegs: [number, number], legPieces: PartPiece[] | undefined, upper: [number, number], lower: [number, number], railT: number): Base {
  const parts: P[] = [];
  const legs = [
    { id: "La", x: -xL, z: 0, n: [1, 0, 0] as Vec3 },
    { id: "Lb", x: xL, z: 0, n: [-1, 0, 0] as Vec3 },
    { id: "Lc", x: 0, z: -zL, n: [0, 0, 1] as Vec3 },
    { id: "Ld", x: 0, z: zL, n: [0, 0, -1] as Vec3 },
  ];
  const lh = yLegs[1] - yLegs[0];
  for (const l of legs) parts.push({ id: l.id, name: "Leg", size: [legD, lh, legD], pos: [l.x, yLegs[0] + lh / 2, l.z], shape: legPieces ? undefined : "cyl", material: "wood", pieces: legPieces });
  const rails: Base["rails"] = [];
  const rail = (id: string, name: string, axis: "x" | "z", ys: [number, number]) => {
    const half = (axis === "x" ? xL : zL) - legD / 2;
    const h = ys[1] - ys[0], y = (ys[0] + ys[1]) / 2;
    parts.push({ id, name, size: axis === "x" ? [2 * half, h, railT] : [railT, h, 2 * half], pos: [0, y, 0], material: "wood" });
    rails.push({ id, axis, y, half });
  };
  rail("RLu", "Long rail", "x", upper);
  rail("RLl", "Long rail", "x", lower);
  rail("RSu", "Short rail", "z", upper);
  rail("RSl", "Short rail", "z", lower);
  const joint = (leg: string, r: string): Vec3 => {
    const l = legs.find((q) => q.id === leg)!, rr = rails.find((q) => q.id === r)!;
    return [l.x + (l.n[0] * legD) / 2, rr.y, l.z + (l.n[2] * legD) / 2];
  };
  return { parts, legs, rails, yU: upper[1], joint };
}

const railsOf = (legId: string) => (legId === "La" || legId === "Lb" ? ["RLu", "RLl"] : ["RSu", "RSl"]);
const across = (n: Vec3): Vec3 => [n[2], 0, n[0]]; // sideways along the leg's face
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

/** Dowels and connector pins into the legs: one of each at every rail joint, side by side. */
function legFits(b: Base): CustomFix[] {
  const dowel: Vec3[] = [], pin: Vec3[] = [];
  const dirs: Vec3[] = [];
  for (const l of b.legs)
    for (const r of railsOf(l.id)) {
      const p = b.joint(l.id, r);
      dowel.push(add(p, across(l.n), 12));
      pin.push(add(p, across(l.n), -12));
      dirs.push(l.n);
    }
  // each fix holds one direction, so one fix per leg
  return b.legs.flatMap((l, i) => [
    { kind: "dowel", count: 2, len: 30, dia: 8, at: dowel.slice(i * 2, i * 2 + 2), dir: [-l.n[0], 0, -l.n[2]] as Vec3, on: l.id },
    { kind: "camScrew", count: 2, len: 45, dia: 7, name: "Connector pin", at: pin.slice(i * 2, i * 2 + 2), dir: [-l.n[0], 0, -l.n[2]] as Vec3, on: l.id },
  ]);
}

/** Cross nuts in the rail tops near their ends (and the set screws that lock them later, at the same holes). */
function nutPoint(b: Base, rail: string, end: -1 | 1): Vec3 {
  const r = b.rails.find((q) => q.id === rail)!;
  const top = r.y + (b.parts.find((p) => p.id === rail)!.size[1]) / 2;
  const u = end * (r.half - 28);
  return r.axis === "x" ? [u, top, 0] : [0, top, u];
}
const nuts = (b: Base, list: [string, -1 | 1][]): CustomFix[] =>
  list.map(([r, e]) => ({ kind: "nut", count: 1, len: 14, dia: 10, name: "Cross nut", at: [nutPoint(b, r, e)], dir: [0, -1, 0] as Vec3, on: r }));
const setScrews = (b: Base, list: [string, -1 | 1][]): CustomFix => ({
  kind: "screw",
  count: list.length,
  len: 10,
  dia: 6,
  name: "Set screw",
  at: list.map(([r, e]) => nutPoint(b, r, e)),
  dir: [0, -1, 0],
  on: list[0][0],
});
const ends = (rails: string[], es: (-1 | 1)[]): [string, -1 | 1][] => rails.flatMap((r) => es.map((e) => [r, e] as [string, -1 | 1]));

/* ---------- coffee table ---------- */

function coffee(): CustomParams {
  const W = 1180, Dd = 720, H = 500, T = 20;
  const yTop = H - T;
  const b = crossBase(W / 2 - 90, Dd / 2 - 70, 42, [0, yTop], undefined, [yTop - 50, yTop], [110, 150], 24);
  const parts: P[] = [...b.parts, { id: "TOP", name: "Table top", size: [W, T, Dd], pos: [0, H - T / 2, 0], material: "wood", pieces: oval(W, T, Dd) }];
  const xL = W / 2 - 90, zL = Dd / 2 - 70;
  const steps: CustomStep[] = [
    { title: "Tap the dowels into the legs", detail: "Lay the four legs on a rug. Two dowels in each, in the small side holes.", wait: ["La", "Lb", "Lc", "Ld"], fix: legFits(b).filter((f) => f.kind === "dowel"), tools: ["hammer"], warnings: ["floor"] },
    {
      title: "Screw the connector pins into the legs",
      detail: "By hand with the Allen key, not a drill, until the shoulder meets the wood.",
      fix: legFits(b).filter((f) => f.kind === "camScrew"),
      tools: ["allen"],
    },
    { title: "Push the cross nuts into the rails", detail: "Into the holes on top, near each end, slot turned towards the end.", add: ["RLu", "RLl"], wait: ["RSu", "RSl"], fix: nuts(b, ends(["RLu", "RLl", "RSu", "RSl"], [-1, 1])), from: { RLu: [0, 300, 0], RLl: [0, 300, 0] } },
    {
      title: "Join the long rails to two legs and lock them",
      add: ["La", "Lb"],
      detail: "Push the pins and dowels of the two end legs into the long rails, notches facing up on the lower rail. A set screw into each cross nut pulls the joint tight.",
      fix: [setScrews(b, ends(["RLu", "RLl"], [-1, 1]))],
      tools: ["allen"],
    },
    {
      title: "Drop the short rails over the long ones",
      detail: "Their notches slot down over the long rails where they cross. Then push on the other two legs and lock them the same way.",
      add: ["RSu", "RSl", "Lc", "Ld"],
      from: { RSu: [0, 300, 0], RSl: [0, 300, 0] },
      fix: [setScrews(b, ends(["RSu", "RSl"], [-1, 1]))],
      tools: ["allen"],
    },
    { title: "Bolt the upper rails together", detail: "One short bolt down through the middle, where they cross.", fix: [{ kind: "bolt", count: 1, len: 50, dia: 6, name: "Short bolt", at: [[0, yTop, 0]], dir: [0, -1, 0], on: "RSu", mate: "RLu" }], tools: ["allen"] },
    {
      title: "Turn the base over and tap in two dowels",
      detail: "Into the holes on the upper rails, to line up the top.",
      fix: [{ kind: "dowel", count: 2, len: 30, dia: 8, at: sx.map((s) => [s * 200, yTop, 0] as Vec3), dir: [0, -1, 0], on: "RLu", mate: "TOP" }],
      pose: "-y",
      tools: ["hammer"],
    },
    { title: "Set the base on the top", detail: "Lay the top face down on the rug and lower the base onto it, dowels into their holes.", add: ["TOP"], warnings: ["floor"] },
    {
      title: "Bolt the top on",
      detail: "Five long bolts down through the rails into the top. Tighten them evenly.",
      fix: [
        {
          kind: "bolt",
          count: 5,
          len: 55,
          dia: 6,
          name: "Long bolt",
          at: [[-(xL - 100), yTop - 50, 0], [xL - 100, yTop - 50, 0], [0, yTop - 50, -(zL - 90)], [0, yTop - 50, zL - 90], [90, yTop - 50, 0]],
          dir: [0, 1, 0],
          on: "RLu",
          mate: "TOP",
        },
      ],
      tools: ["allen"],
    },
    {
      title: "Slide the brass sleeves onto the feet",
      detail: "Push each one down over the end of a leg until it stops.",
      fix: [{ kind: "cap", count: 4, len: 55, dia: 46, name: "Brass sleeve", at: b.legs.map((l) => [l.x, 0, l.z] as Vec3), dir: [0, 1, 0], on: "La" }],
    },
    {
      title: "Tap the floor pads into the legs",
      detail: "Over a scrap of card so the hammer doesn't mark the brass. Then turn the table over together.",
      fix: [{ kind: "glide", count: 4, len: 8, dia: 40, name: "Floor pad", at: b.legs.map((l) => [l.x, 0, l.z] as Vec3), dir: [0, 1, 0], on: "La" }],
      tools: ["hammer"],
    },
    { title: "Turn it the right way up", detail: "Lift it by the top, not the base.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- trolley ---------- */

function trolley(): CustomParams {
  const W = 760, Dd = 560, H = 610, legD = 44;
  const xL = W / 2 - legD / 2, zL = Dd / 2 - legD / 2;
  // the leg with its brass sleeve and castor, upright: from the floor to the top
  const legPieces: PartPiece[] = [
    { shape: "cyl", size: [legD, H - 150, legD], pos: [0, 75, 0], material: "wood" },
    { shape: "cyl", size: [legD + 2, 90, legD + 2], pos: [0, -H / 2 + 125, 0], material: "metal" },
    { shape: "box", size: [30, 50, 40], pos: [0, -H / 2 + 60, 0], material: "metal" },
    { shape: "cyl", size: [70, 26, 70], pos: [0, -H / 2 + 35, 0], rot: [0, 0, Math.PI / 2], material: "metal" },
  ];
  const upper: [number, number] = [H - 140, H - 100];
  const lower: [number, number] = [190, 230];
  const b = crossBase(xL, zL, legD, [0, H], legPieces, upper, lower, 24);
  const tL = W - 2 * legD - 12, tD = Dd - 2 * legD - 12;
  const tray = (id: string, name: string, y0: number): P => ({
    id,
    name,
    size: [tL, 70, tD],
    pos: [0, y0 + 35, 0],
    material: "wood",
    pieces: [...oval(tL, 10, tD, -30), ...ovalRim(tL, tD, 60, 8, 5)],
  });
  const parts: P[] = [...b.parts, tray("LT", "Lower tray", lower[1]), tray("TT", "Top tray", upper[1])];
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the legs",
      detail: "Lay the four legs on a rug, castors up. Two dowels in each, in the small side holes.",
      wait: ["La", "Lb", "Lc", "Ld"],
      fix: legFits(b).filter((f) => f.kind === "dowel"),
      tools: ["hammer"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Screw the connector pins into the legs", detail: "By hand with the Allen key, not a drill.", fix: legFits(b).filter((f) => f.kind === "camScrew"), tools: ["allen"] },
    { title: "Push the cross nuts into the long rails", detail: "Into the holes near each end, slot towards the end.", add: ["RLu", "RLl"], fix: nuts(b, ends(["RLu", "RLl"], [-1, 1])), from: { RLu: [0, -300, 0], RLl: [0, -300, 0] } },
    { title: "Join the long rails to two legs", detail: "Pins and dowels into the rail ends, castors still up.", add: ["La", "Lb"], fix: [setScrews(b, ends(["RLu", "RLl"], [-1, 1]))], tools: ["allen"] },
    {
      title: "Drop the short rails over the long ones",
      detail: "Notches slot together where they cross.",
      add: ["RSu", "RSl"],
      from: { RSu: [0, -300, 0], RSl: [0, -300, 0] },
    },
    { title: "Push cross nuts into the short rails", detail: "One in each, at the end nearest you.", fix: nuts(b, [["RSu", -1], ["RSl", -1]]) },
    { title: "Push a third leg on and lock it", detail: "Two set screws into the cross nuts.", add: ["Lc"], fix: [setScrews(b, [["RSu", -1], ["RSl", -1]])], tools: ["allen"] },
    { title: "Bolt the upper rails together", detail: "The short bolt, through the middle where they cross.", fix: [{ kind: "bolt", count: 1, len: 50, dia: 6, name: "Short bolt", at: [[0, upper[0], 0]], dir: [0, 1, 0], on: "RSu", mate: "RLu" }], tools: ["allen"] },
    {
      title: "Tap two dowels into the lower rails",
      detail: "One in each rail, to line up the lower tray.",
      fix: [{ kind: "dowel", count: 2, len: 30, dia: 8, at: [[150, lower[1], 0], [0, lower[1], 120]], dir: [0, -1, 0], on: "RLl", mate: "LT" }],
      tools: ["hammer"],
    },
    { title: "Slide the lower tray on", detail: "In from the open side, over the rails, until it sits on the dowels.", add: ["LT"], from: { LT: [0, 0, 500] } },
    { title: "Bolt the middle of the tray", detail: "One long bolt through the crossing into the tray.", fix: [{ kind: "bolt", count: 1, len: 70, dia: 6, name: "Long bolt", at: [[0, lower[0], 40]], dir: [0, 1, 0], on: "RLl", mate: "LT" }], tools: ["allen"] },
    {
      title: "Bolt the tray to the rails",
      detail: "Four more long bolts, one near each end of the rails.",
      fix: [{ kind: "bolt", count: 4, len: 70, dia: 6, name: "Long bolt", at: [[-(xL - 90), lower[0], 0], [xL - 90, lower[0], 0], [0, lower[0], -(zL - 90)], [0, lower[0], zL - 90]], dir: [0, 1, 0], on: "RLl", mate: "LT" }],
      tools: ["allen"],
    },
    { title: "Push cross nuts into the free rail ends", detail: "The last two, in the short rails.", fix: nuts(b, [["RSu", 1], ["RSl", 1]]) },
    { title: "Push the last leg on and lock it", detail: "Two set screws into the cross nuts.", add: ["Ld"], fix: [setScrews(b, [["RSu", 1], ["RSl", 1]])], tools: ["allen"] },
    {
      title: "Press the pads under the top tray",
      detail: "Lay it upside down: eight pads, each pushed into its two holes. They protect the table you set it on.",
      add: ["TT"],
      fix: [
        {
          kind: "glide",
          count: 8,
          len: 10,
          dia: 30,
          name: "Tray pad",
          at: Array.from({ length: 8 }, (_, i) => { const a = (Math.PI * 2 * i) / 8; return [Math.cos(a) * (tL / 2 - 70), upper[1], Math.sin(a) * (tD / 2 - 60)] as Vec3; }),
          dir: [0, 1, 0],
          on: "TT",
        },
      ],
      from: { TT: [0, -500, 0] },
    },
    { title: "Turn the trolley over and set the top tray on", detail: "Stand it on its castors. The tray rests on the upper rails, so you can lift it off to carry.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- sofas ---------- */

function sofa(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, Dd = 940;
  const seatW = W - 460, armW = 230;
  const yLeg = 140, yDeck = 360, yBack = 710;
  const zBack = -Dd / 2, backT = 180;
  const half = seatW / 2;
  const armPieces: PartPiece[] = [
    { shape: "box", size: [armW, 320, Dd - 30], pos: [0, -48, 0], material: "soft" },
    { shape: "cyl", size: [200, Dd - 30, 200], pos: [10, 102, 0], rot: [Math.PI / 2, 0, 0], material: "soft" },
  ];
  const legPieces: PartPiece[] = [
    { shape: "cyl", size: [58, 60, 58], pos: [0, 40, 0], material: "wood" },
    { shape: "cyl", size: [44, 80, 44], pos: [0, -30, 0], material: "wood" },
  ];
  const parts: P[] = [
    { id: "SEAT", name: "Seat frame", size: [seatW, yDeck - yLeg, Dd], pos: [0, (yLeg + yDeck) / 2, 0], material: "soft" },
    { id: "BACK", name: "Backrest frame", size: [seatW, yBack - yDeck, backT], pos: [0, (yDeck + yBack) / 2, zBack + backT / 2], material: "soft" },
    ...sx.map((x): P => ({ id: `A${x < 0 ? "l" : "r"}`, name: "Armrest", size: [armW, 420, Dd - 20], pos: [x * (half + armW / 2), yLeg + 210, 0], material: "soft", pieces: x < 0 ? armPieces.map((p) => ({ ...p, pos: [-p.pos[0], p.pos[1], p.pos[2]] as Vec3 })) : armPieces })),
    ...sx.flatMap((x) => sx.map((z): P => ({ id: `L${x < 0 ? "l" : "r"}${z < 0 ? "b" : "f"}`, name: "Leg", size: [58, yLeg, 58], pos: [x * (half + armW / 2 - 20), yLeg / 2, z * (Dd / 2 - 90)], material: "wood", pieces: legPieces }))),
    ...sx.map((x): P => ({ id: `C${x < 0 ? "l" : "r"}`, name: "Seat cushion", size: [half - 6, 130, Dd - backT - 50], pos: [(x * half) / 2, yDeck + 65, zBack + backT + 10 + (Dd - backT - 50) / 2], material: "soft" })),
    ...sx.map((x): P => ({ id: `K${x < 0 ? "l" : "r"}`, name: "Back cushion", size: [half - 10, 400, 190], pos: [(x * half) / 2, yDeck + 130 + 200, zBack + backT + 95], rot: [-0.16, 0, 0], material: "soft" })),
  ];
  const backStuds: Vec3[] = [-0.4, -0.14, 0.14, 0.4].map((t) => [t * seatW, yDeck, zBack + backT / 2] as Vec3);
  const armStuds = (x: -1 | 1): Vec3[] => [-260, 40, 300].map((z) => [x * half, yLeg + 130, z] as Vec3);
  const knob = { len: 18, dia: 36, name: "Star knob" };
  const washer = { len: 2, dia: 20 };
  const steps: CustomStep[] = [
    {
      title: "Screw four studs into the seat frame",
      detail: "By hand, into the holes along the top at the back, until each stops.",
      add: ["SEAT"],
      fix: [{ kind: "stud", count: 4, len: 70, dia: 8, at: backStuds, dir: [0, -1, 0], on: "SEAT", mate: "BACK" }],
      people: 2,
    },
    { title: "Lower the backrest onto the studs", detail: "Two of you, one at each end. Every stud goes through its hole.", add: ["BACK"], people: 2, warnings: ["two"] },
    {
      title: "Fix the backrest with washers and knobs",
      detail: "A washer, then a star knob, on each stud. Turn them up hard by hand.",
      fix: [
        { kind: "washer", count: 4, ...washer, at: backStuds, dir: [0, -1, 0], on: "BACK" },
        { kind: "nut", count: 4, ...knob, at: backStuds, dir: [0, -1, 0], on: "BACK" },
      ],
    },
    {
      title: "Screw three studs into each armrest and push them on",
      detail: "Studs into the inside face of each armrest, then one of you holds the frame while the other pushes the armrest on.",
      add: ["Al", "Ar"],
      fix: sx.map((x) => ({ kind: "stud" as const, count: 3, len: 70, dia: 8, at: armStuds(x), dir: [x, 0, 0] as Vec3, on: `A${x < 0 ? "l" : "r"}`, mate: "SEAT" })),
      from: { Al: [-450, 0, 0], Ar: [450, 0, 0] },
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Lay it on its back and fix the armrests",
      detail: "Reach in under the seat frame: a washer and a star knob on each of the six studs.",
      fix: sx.flatMap((x) => [
        { kind: "washer" as const, count: 3, ...washer, at: armStuds(x), dir: [x, 0, 0] as Vec3, on: "SEAT" },
        { kind: "nut" as const, count: 3, ...knob, at: armStuds(x), dir: [x, 0, 0] as Vec3, on: "SEAT" },
      ]),
      pose: "+z",
      people: 2,
      warnings: ["floor"],
    },
    { title: "Screw in the legs", detail: "One under each corner, by hand until tight.", add: ["Llb", "Llf", "Lrb", "Lrf"] },
    { title: "Stand it up and pull the cover over the back", detail: "Start at the backrest and work the cover down over the seat.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Ease the cover over the armrests", detail: "Smooth it round the rolls so the seams sit along the edges." },
    { title: "Fasten the cover underneath", detail: "Tip the sofa forward a little and press the touch-and-close strips together under the frame.", people: 2 },
    { title: "Zip the covers onto the seat cushions", detail: "Push the corners of the filling right into the corners of the cover first." },
    { title: "Zip the covers onto the back cushions", detail: "The zip goes at the bottom, facing the back." },
    { title: "Lay in the seat cushions", detail: "Zips to the back.", add: ["Cl", "Cr"] },
    { title: "Set the back cushions in place", detail: "Lean them against the backrest, on top of the seat cushions.", add: ["Kl", "Kr"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["VALNÄS", "VALNAS"],
  recipe(s) {
    const v = `${s.variant} ${s.slug ?? ""}`.toLowerCase();
    const r = /coffee/.test(v) ? coffee() : /trolley/.test(v) ? trolley() : s.archetype === "sofa" && /seat sofa/.test(v) ? sofa(s) : null;
    for (const st of r?.steps ?? []) for (const f of st.fix ?? []) f.count = f.at?.length ?? f.count;
    return r;
  },
};
export default family;
