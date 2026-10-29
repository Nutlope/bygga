import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, HwKind, PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * IVAR, read from its manuals.
 * Side unit: each side is a ladder of solid pine, rungs knocked into two uprights and locked with wooden pegs
 * (6, 8 or 10 by height). Two people stand the ladders up, the shelves drop onto metal pins, a steel cross brace is
 * screwed across the back and each ladder is strapped to the wall.
 * The rest are their own kits: a pair of framed doors hung on the side unit's front uprights, a steel cabinet with
 * mesh doors (on the floor or hung in a side unit), the pine cabinet with doors, the pine 2x2 shelving unit (alone
 * or stacked on the cabinet), the cabinet with sliding doors, the box shelf with divider and the storage box on wheels.
 */

const PEG: HwDef = { kind: "dowel", len: 40, dia: 6 };
const UX = 30; // upright, across the unit
const UZ = 44; // upright, front to back
const RUNG = 20;
const ST = 20; // side unit shelf
const T = 18; // pine panels of the cabinets and the 2x2 unit

type Recipe = { parts: CustomPart[]; steps: CustomStep[] };

const fx = (kind: HwKind, at: Vec3[], dir: Vec3, on: string, more: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, on, ...more });
const box = (id: string, name: string, size: Vec3, pos: Vec3, more: Partial<CustomPart> = {}): CustomPart => ({ id, name, size, pos, ...more });
const ids = (pre: string, n: number) => Array.from({ length: n }, (_, i) => `${pre}${i}`);

function shelvesOf(s: ProductSpec) {
  const p = s.shelf;
  if (!p) return 4;
  return Math.max(2, (p.shelves ?? 3) + (p.fixedShelf ? 1 : 0) + 1);
}

/** One ladder: its rungs, from the bottom up. 124 cm has three, 179 four, 226 five, so two pegs each give 6/8/10. */
function rungYs(H: number) {
  const n = H < 1500 ? 3 : H < 2000 ? 4 : 5;
  const lo = 70, hi = H - 50;
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
}

interface SideOpts {
  ys?: number[]; // shelf centres, bottom up
  brace?: [number, number]; // the heights the cross brace spans
}

/* ---------------- side unit ---------------- */

function sideUnit(s: ProductSpec, o: SideOpts = {}) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const ys = rungYs(H);
  const xSide = (sx: number) => sx * (W / 2 - UX / 2);
  const zUp = (sz: number) => sz * (D / 2 - UZ / 2);
  const parts: CustomPart[] = [];
  for (const [si, sx] of [-1, 1].entries()) {
    for (const [ui, sz] of [-1, 1].entries()) parts.push(box(`U${si}${ui}`, "Upright", [UX, H, UZ], [xSide(sx), H / 2, zUp(sz)], { material: "wood" }));
    ys.forEach((y, k) => parts.push(box(`R${si}${k}`, "Rung", [RUNG, 45, D - 2 * UZ], [xSide(sx), y, 0], { material: "wood" })));
  }
  // shelves between the ladders, from the bottom one just above the lowest rung to the top one under the top rung
  const n = o.ys?.length ?? shelvesOf(s);
  const y0 = 110, y1 = H - 70;
  const sy = o.ys ?? Array.from({ length: n }, (_, i) => y0 + ((y1 - y0) * i) / (n - 1));
  sy.forEach((y, i) => parts.push(box(`S${i}`, "Shelf", [W - 2 * UX, ST, D], [0, y, 0], { material: "wood" })));
  // the cross brace across the back, corner to corner over the back uprights
  const mid = Math.floor((n - 1) / 2);
  const [ya, yb] = o.brace ?? [sy[mid] + 40, sy[Math.min(n - 1, mid + 1)] - 40];
  const span = W - UX, rise = yb - ya;
  const len = Math.hypot(span, rise), ang = Math.atan2(rise, span);
  const rods: PartPiece[] = [
    { shape: "box", size: [len, 4, 4], pos: [0, 0, 0], rot: [0, 0, ang] },
    { shape: "box", size: [len, 4, 4], pos: [0, 0, 0], rot: [0, 0, -ang] },
  ];
  parts.push(box("X", "Cross brace", [span, rise, 4], [0, (ya + yb) / 2, -D / 2 - 2], { pieces: rods, material: "metal" }));

  // pegs go through the upright's outer face into the rung's tongue
  const pegs = (si: number, ui: number) =>
    fx("dowel", ys.map((y) => [(si ? 1 : -1) * (W / 2), y, zUp(ui ? 1 : -1)] as Vec3), [si ? -1 : 1, 0, 0], `U${si}${ui}`, { len: PEG.len, dia: PEG.dia });
  const rungs = (si: number) => ys.map((_, k) => `R${si}${k}`);
  const pins = (si: number, ui: number) => {
    const sx = si ? 1 : -1;
    return fx("pin", sy.map((y) => [sx * (W / 2 - UX), y - ST / 2 - 3, zUp(ui ? 1 : -1)] as Vec3), [sx, 0, 0], `U${si}${ui}`, { dia: 6 });
  };
  const steps: CustomStep[] = [
    {
      title: "Knock the rungs into an upright",
      detail: "Lay the upright on a rug, holes up. Tap each rung's tongue into its slot, with a scrap of wood under the hammer.",
      add: ["U00", ...rungs(0)],
      tools: ["hammer"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Knock the pegs in", detail: "Pointed end first, through the upright and the rung's tongue, until they sit flush.", fix: [pegs(0, 0)], tools: ["hammer"] },
    { title: "Knock the second upright onto the rungs", detail: "Turn the ladder over first so the pegged upright lies on the rug.", add: ["U01"], tools: ["hammer"] },
    { title: "Peg the second upright", detail: "The same as the first, one peg at each rung.", fix: [pegs(0, 1)], tools: ["hammer"] },
    {
      title: "Build the other side unit the same way",
      detail: "Rungs into one upright, pegs, then the second upright and its pegs.",
      add: ["U10", "U11", ...rungs(1)],
      fix: [pegs(1, 0), pegs(1, 1)],
      tools: ["hammer"],
      pose: "-x",
    },
    {
      title: "Stand the sides up and put the shelves in",
      detail: "One of you holds the sides upright. Push four pins in level for each shelf, then press the shelf down onto them until it clicks.",
      add: sy.map((_, i) => `S${i}`),
      fix: [pins(0, 0), pins(0, 1), pins(1, 0), pins(1, 1)],
      people: 2,
      pose: "+y",
      warnings: ["two"],
    },
    {
      title: "Screw on the cross brace",
      detail: "Across the back, one screw into each back upright at its four ends. It keeps the shelving from leaning.",
      add: ["X"],
      fix: [fx("screw", [-1, 1].flatMap((sx) => [ya, yb].map((y) => [xSide(sx), y, -D / 2 - 3] as Vec3)), [0, 0, 1], "X", { len: 16, dia: 4 })],
      tools: ["screwdriver"],
      people: 2,
      check: "square",
    },
  ];
  return { parts, steps, W, H, D, sy, zUp, back: [parts.find((p) => p.id === "U00")!.pos, parts.find((p) => p.id === "U10")!.pos] };
}

/** A strap on top of each back upright, screwed down with a washer, its other end on a screw in the wall. */
function strapStep(b: PlanBuilder, s: ProductSpec, backs: Vec3[]) {
  const H = s.size.h * 10, D = s.size.d * 10;
  const keys = backs.map((p) => b.items.find((it) => it.kind === "part" && it.final.pos.every((v, i) => Math.abs(v - p[i]) < 0.5))?.key);
  if (keys.some((k) => !k)) return;
  b.step(
    {
      title: "Strap it to the wall",
      detail: "One strap on top of each side, screwed down through a washer, the other end screwed to the wall. Wall screws aren't included: pick ones made for your wall.",
      tools: ["screwdriver", "drill", "pencil"],
      kind: "anchor",
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      b.stagger(0.2);
      backs.forEach((p, i) => b.fit(HW.strap, { on: keys[i], at: [p[0], H, p[2]], dir: [0, -1, 0], travel: 60 }));
      b.then(0.1);
      backs.forEach((p, i) => b.fit(HW.washer, { on: keys[i], at: [p[0], H + 2, p[2]], dir: [0, -1, 0], hole: false }));
      b.then(0.05);
      backs.forEach((p, i) => b.fit({ kind: "screw", len: 16, dia: 4 }, { on: keys[i], at: [p[0], H + 3, p[2]], dir: [0, -1, 0] }));
      b.then(0.1);
      for (const p of backs) b.fit(HW.plug, { at: [p[0], H - 20, -D / 2 - 40], dir: [0, 0, -1] });
      b.then(0.05);
      for (const p of backs) b.fit(HW.washer, { at: [p[0], H - 20, -D / 2 - 36], dir: [0, 0, -1], hole: false });
      for (const p of backs) b.fit(HW.wallScrew, { at: [p[0], H - 20, -D / 2 - 34], dir: [0, 0, -1] });
    },
  );
}

/* ---------------- IVAR door pair on the side unit ---------------- */

/** A framed door: pine stiles and rails round a woven panel, with a rail across the middle. */
function frameDoor(w: number, h: number, t: number): PartPiece[] {
  const f = 45;
  return [
    { shape: "box", size: [f, h, t], pos: [-w / 2 + f / 2, 0, 0], material: "wood" },
    { shape: "box", size: [f, h, t], pos: [w / 2 - f / 2, 0, 0], material: "wood" },
    { shape: "box", size: [w - 2 * f, f, t], pos: [0, h / 2 - f / 2, 0], material: "wood" },
    { shape: "box", size: [w - 2 * f, f, t], pos: [0, -h / 2 + f / 2, 0], material: "wood" },
    { shape: "box", size: [w - 2 * f, 35, t], pos: [0, 0, 0], material: "wood" },
    { shape: "box", size: [w - 2 * f, h - 2 * f, 4], pos: [0, 0, -2], material: "fiber" },
  ];
}

function doorUnit(s: ProductSpec): Recipe & { back: Vec3[] } {
  const H = s.size.h * 10;
  // the doors close over the top 83 cm of a 124 cm unit; taller units carry more open shelves above them
  const yT = Math.min(H, 1240) - 70;
  const doorH = 830;
  const yL = yT + ST / 2 - doorH + ST / 2;
  const ys = [110, yL, (yL + yT) / 2, yT];
  if (H > 1600) ys.push(...(H > 2000 ? [1700, H - 70] : [H - 70]));
  const u = sideUnit(s, { ys, brace: [150, yL - 40] });
  const { W, D, parts, steps } = u;
  const nd = W < 600 ? 1 : 2;
  const dw = (W - UX) / nd - 3;
  const dy = (yL - ST / 2 + yT + ST / 2) / 2;
  const doors = ids("G", nd);
  const dx = (i: number) => (nd === 1 ? 0 : (i ? 1 : -1) * (W - UX) / 4);
  doors.forEach((id, i) => parts.push(box(id, "Door", [dw, doorH, 20], [dx(i), dy, D / 2 + 11], { pieces: frameDoor(dw, doorH, 20), material: "wood" })));
  // the hinges sit on the outer edge of each door, on the inner face of the front upright beside it
  const hy = [dy + doorH / 2 - 110, dy - doorH / 2 + 110];
  const sides = nd === 1 ? [-1] : [-1, 1];
  const plates = sides.flatMap((sx) => hy.map((y) => [sx * (W / 2 - UX), y, u.zUp(1)] as Vec3));
  const up = (sx: number) => (sx < 0 ? "U01" : "U11");
  const hinge = (sx: number) => (W - UX) / 2 * sx - sx * 32;
  steps.push(
    {
      title: "Screw the hinge plates to the front uprights",
      detail: "On the inside face of each front upright, one near the top of the doors and one near the bottom. One screw holds each plate.",
      fix: [
        ...sides.map((sx) => fx("plate", plates.filter((p) => Math.sign(p[0]) === sx), [sx, 0, 0], up(sx), { name: "Hinge plate", len: 40, dia: 20 })),
        ...sides.map((sx) => fx("screw", hy.map((y) => [sx * (W / 2 - UX), y + 28, u.zUp(1)] as Vec3), [sx, 0, 0], up(sx), { len: 16, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the hinges onto the doors",
      detail: "Lay the doors face down. Press each hinge cup into its hole and fix it with two screws.",
      wait: doors,
      fix: doors.flatMap((id, i) => {
        const sx = nd === 1 ? -1 : i ? 1 : -1;
        const x = hinge(sx);
        return [
          fx("hinge", hy.map((y) => [x, y, D / 2 + 1] as Vec3), [0, 0, 1], id),
          fx("screw", hy.flatMap((y) => [y + 30, y - 30].map((yy) => [x, yy, D / 2 + 1] as Vec3)), [0, 0, 1], id, { len: 12, dia: 4 }),
        ];
      }),
      tools: ["screwdriver"],
    },
    {
      title: nd === 1 ? "Click the door onto its plates" : "Click the doors onto their plates",
      detail: "Hook each hinge arm over its plate and press until it clicks.",
      add: doors,
      from: Object.fromEntries(doors.map((id) => [id, [0, 0, 300] as Vec3])),
    },
    {
      title: "Line the doors up",
      detail: "Turn the hinge screws to move each door up, down or sideways until the gaps are even.",
      tools: ["screwdriver"],
    },
  );
  return { parts, steps, back: u.back };
}

/* ---------------- steel cabinet with mesh doors ---------------- */

const SH = 12; // folded steel sides, as drawn

function meshCabinet(W: number, H: number, D: number, y0: number, x0 = 0) {
  const P = 25; // back corner posts
  const inner = W - 2 * SH;
  const yb = y0 + 70; // top of the bottom tray
  const yt = y0 + H - 15; // underside of the top
  const back = (yt - yb) / 2;
  const parts: CustomPart[] = [
    box("CB", "Bottom", [inner, 20, D - 12], [x0, yb - 10, -6], { material: "metal" }),
    box("CP0", "Back post", [P, yt - yb, P], [x0 - inner / 2 + P / 2, (yb + yt) / 2, -D / 2 + P / 2], { material: "metal" }),
    box("CP1", "Back post", [P, yt - yb, P], [x0 + inner / 2 - P / 2, (yb + yt) / 2, -D / 2 + P / 2], { material: "metal" }),
    box("CS0", "Side panel", [SH, H - 15, D], [x0 - W / 2 + SH / 2, y0 + (H - 15) / 2, 0], { material: "metal" }),
    box("CS1", "Side panel", [SH, H - 15, D], [x0 + W / 2 - SH / 2, y0 + (H - 15) / 2, 0], { material: "metal" }),
    box("CK0", "Lower back panel", [inner - 2 * P, back, 6], [x0, yb + back / 2, -D / 2 + P / 2], { material: "metal" }),
    box("CK1", "Upper back panel", [inner - 2 * P, back, 6], [x0, yb + back * 1.5, -D / 2 + P / 2], { material: "metal" }),
    box("CT", "Top", [W, 15, D], [x0, y0 + H - 7.5, 0], { material: "metal" }),
    box("CL", "Plinth", [inner, 70, 12], [x0, y0 + 35, D / 2 - 6], { material: "metal" }),
    box("CF", "Shelf", [inner, 15, D - 50], [x0, (yb + yt) / 2, 0], { material: "metal" }),
  ];
  const dw = inner / 2 - 3, dh = yt - yb - 6;
  const mesh = (w: number): PartPiece[] => [
    { shape: "box", size: [30, dh, 18], pos: [-w / 2 + 15, 0, 0] },
    { shape: "box", size: [30, dh, 18], pos: [w / 2 - 15, 0, 0] },
    { shape: "box", size: [w - 60, 30, 18], pos: [0, dh / 2 - 15, 0] },
    { shape: "box", size: [w - 60, 30, 18], pos: [0, -dh / 2 + 15, 0] },
    { shape: "box", size: [w - 60, 24, 18], pos: [0, 0, 0] },
    { shape: "box", size: [w - 60, dh - 60, 2], pos: [0, 0, 0], material: "fiber" },
  ];
  for (const i of [0, 1]) parts.push(box(`CD${i}`, "Mesh door", [dw, dh, 18], [x0 + (i ? 1 : -1) * (inner / 4), (yb + yt) / 2, D / 2 - 9], { pieces: mesh(dw), material: "metal" }));
  const sx = (i: number) => x0 + (i ? 1 : -1) * (W / 2);
  const steps: CustomStep[] = [
    {
      title: "Click the back posts onto the bottom",
      detail: "Lay the bottom on a rug and push a post into each back corner until it clicks.",
      add: ["CB", "CP0", "CP1"],
      from: { CP0: [0, 350, 0], CP1: [0, 350, 0] },
      warnings: ["floor"],
    },
    {
      title: "Lower the side panels onto the bottom",
      detail: "Stand it up. Each side's lugs drop into the slots at the bottom's corners.",
      add: ["CS0", "CS1"],
      from: { CS0: [0, 400, 0], CS1: [0, 400, 0] },
    },
    {
      title: "Slide the lower back panel down between the posts",
      detail: "Its folded edge faces in. Push it down until it sits on the bottom.",
      add: ["CK0"],
      from: { CK0: [0, 500, 0] },
    },
    {
      title: "Bend the tabs and screw the posts to the sides",
      detail: "Twist the four tabs at the back and the two at the bottom with a flat screwdriver, then one screw through each side into each post, low down.",
      fix: [0, 1].map((i) => fx("screw", [yb + 60, yb + back - 60].map((y) => [sx(i), y, -D / 2 + 12] as Vec3), [i ? -1 : 1, 0, 0], `CS${i}`, { len: 16, dia: 5 })),
      tools: ["flathead", "screwdriver"],
    },
    {
      title: "Slide the upper back panel down on top",
      detail: "Then twist its four side tabs and the two along the bottom edge, like the first one.",
      add: ["CK1"],
      from: { CK1: [0, 500, 0] },
      tools: ["flathead"],
    },
    {
      title: "Screw the two wall brackets to the back posts",
      detail: "At the top of each post, two screws each.",
      fix: [
        ...[0, 1].map((i) => fx("angle", [[x0 + (i ? 1 : -1) * (inner / 2 - P / 2), yt - 60, -D / 2 - 1]], [0, 0, 1], `CP${i}`, { name: "Wall bracket", len: 40, dia: 30 })),
        ...[0, 1].map((i) => fx("screw", [yt - 25, yt - 95].map((y) => [x0 + (i ? 1 : -1) * (inner / 2 - P / 2), y, -D / 2 - 2] as Vec3), [0, 0, 1], `CP${i}`, { len: 10, dia: 5 })),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the top on and slide it forward",
      detail: "Its hooks drop into the slots along the sides, then it slides forward to lock. Twist the two tabs at the back and the three along the front.",
      add: ["CT"],
      from: { CT: [0, 250, -40] },
      tools: ["flathead"],
    },
  ];
  return { parts, steps, yb, yt, inner, dw, dh, P };
}

function meshFinish(c: ReturnType<typeof meshCabinet>, W: number, D: number, x0: number, floor: boolean): CustomStep[] {
  const { yb, yt, inner } = c;
  const yf = (yb + yt) / 2;
  const sup = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [x0 + sx * (inner / 2), yf - 12, sz * (D / 2 - 40)] as Vec3));
  return [
    ...(floor
      ? [
          {
            title: "Tilt the plinth in at the bottom front",
            detail: "Hook its top edge under the bottom, swing it down and twist the tab to hold it.",
            add: ["CL"],
            from: { CL: [0, 0, 250] as Vec3 },
            tools: ["flathead" as const],
          },
        ]
      : []),
    {
      title: "Hook in the shelf supports",
      detail: "Four supports in the slots of the sides, all at the same height.",
      fix: [0, 1].map((i) => fx("clip", sup.filter((p) => (p[0] > x0) === !!i), [i ? 1 : -1, 0, 0], `CS${i}`, { name: "Shelf support" })),
    },
    {
      title: "Put the shelf in and lock it",
      detail: "Tilt it in and lay it on the supports, then push a lock clip down over each support.",
      add: ["CF"],
      fix: [fx("clip", sup.map((p) => [p[0] - Math.sign(p[0] - x0) * 20, yf + 7.5, p[2]] as Vec3), [0, -1, 0], "CF", { name: "Shelf lock" })],
    },
    {
      title: "Push the door pins into the bottom",
      detail: "One in each front corner of the bottom, pressed in by hand only.",
      fix: [fx("pin", [-1, 1].map((sx) => [x0 + sx * (inner / 2 - 15), yb, D / 2 - 15] as Vec3), [0, -1, 0], "CB", { name: "Door pin", len: 14, dia: 8 })],
    },
    {
      title: "Stand the doors on the pins and click them in at the top",
      detail: "Set each door on its pin, then push the hinge catch at its top corner up into the top until it clicks.",
      add: ["CD0", "CD1"],
      from: { CD0: [0, 0, 300], CD1: [0, 0, 300] },
      fix: [0, 1].map((i) => fx("hinge", [[x0 + (i ? 1 : -1) * (inner / 2 - 15), yt - 30, D / 2 - 9]], [0, 1, 0], `CD${i}`, { name: "Hinge catch", len: 40, dia: 16 })),
    },
    {
      title: "Press the door stops in",
      detail: "Four rubber stops into the slots along the front edges of the top and the bottom, two for each door.",
      fix: [
        fx("clip", [-1, 1].map((sx) => [x0 + sx * (inner / 4), yt + 7.5, D / 2] as Vec3), [0, 0, -1], "CT", { name: "Door stop" }),
        fx("clip", [-1, 1].map((sx) => [x0 + sx * (inner / 4), yb - 10, D / 2 - 12] as Vec3), [0, 0, -1], "CB", { name: "Door stop" }),
      ],
    },
  ];
}

function meshStandalone(s: ProductSpec): Recipe {
  const W = 800, H = s.size.h * 10, D = s.size.d * 10;
  const c = meshCabinet(W, H, D, 0);
  const steps = [...c.steps];
  steps.push(...meshFinish(c, W, D, 0, true).slice(0, 1));
  steps.push({
    title: "Fix it to the wall",
    detail: "Hang a keyhole plate on each bracket and screw it to the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
    fix: [
      fx("bracket", [-1, 1].map((sx) => [sx * (c.inner / 2 - c.P / 2), c.yt - 60, -D / 2 - 6] as Vec3), [0, 0, 1], "CP0", { name: "Keyhole plate", len: 30, dia: 20 }),
      fx("plug", [-1, 1].map((sx) => [sx * (c.inner / 2 - c.P / 2), c.yt - 60, -D / 2 - 40] as Vec3), [0, 0, -1], "CP0"),
      fx("screw", [-1, 1].map((sx) => [sx * (c.inner / 2 - c.P / 2), c.yt - 60, -D / 2 + 15] as Vec3), [0, 0, -1], "CP0", { len: 50, dia: 5 }),
    ].map((f) => ({ ...f, on: undefined })),
    tools: ["screwdriver", "drill", "pencil"],
    wall: true,
    warnings: ["wall", "tip"],
  });
  steps.push(...meshFinish(c, W, D, 0, true).slice(1));
  return { parts: c.parts, steps };
}

/** The mesh cabinet hung in a side unit, on four hangers screwed to the uprights, under the top shelf. */
function meshInUnit(s: ProductSpec): Recipe & { back: Vec3[] } {
  const H = s.size.h * 10, D = s.size.d * 10;
  const cw = 800, ch = 830;
  const cy0 = H - 70 - ST / 2 - 5 - ch;
  const u = sideUnit(s, { ys: [110, H - 70], brace: [150, cy0 - 30] });
  const c = meshCabinet(cw, ch, D, cy0);
  const parts = [...u.parts, ...c.parts.filter((p) => p.id !== "CL")];
  const W = u.W;
  const hy = cy0 + 40;
  const hangers = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * (W / 2 - UX), hy, u.zUp(sz)] as Vec3));
  const upOf = (p: Vec3) => `U${p[0] > 0 ? 1 : 0}${p[2] > 0 ? 1 : 0}`;
  const steps: CustomStep[] = [
    ...u.steps,
    {
      title: "Screw the cabinet hangers to the uprights",
      detail: "One on the inside face of each upright, at the height of the cabinet's bottom, one screw each.",
      fix: [
        ...hangers.map((p) => fx("bracket", [p], [Math.sign(p[0]), 0, 0], upOf(p), { name: "Cabinet hanger", len: 40, dia: 20 })),
        ...hangers.map((p) => fx("screw", [[p[0], p[1] + 30, p[2]]], [Math.sign(p[0]), 0, 0], upOf(p), { len: 20, dia: 4 })),
      ],
      tools: ["screwdriver"],
    },
    { ...c.steps[0], title: "Build the cabinet: click the back posts onto the bottom", detail: "Build the frame on a rug in front of the shelving, then set it on the hangers." },
    ...c.steps.slice(1),
    {
      title: "Screw the cabinet to the hangers",
      detail: "One screw through each hanger into the cabinet's side.",
      fix: hangers.map((p) => fx("screw", [[p[0] - Math.sign(p[0]) * 1, p[1] + 60, p[2] * 0.8]], [-Math.sign(p[0]), 0, 0], p[0] > 0 ? "CS1" : "CS0", { len: 20, dia: 4 })),
      tools: ["screwdriver"],
    },
    ...meshFinish(c, cw, D, 0, false),
  ];
  return { parts, steps, back: u.back };
}

/* ---------------- pine cabinet with doors ---------------- */

/** The pine carcass: top and bottom on dowels, a side with connector screws, the back slid into its grooves, the other side. */
function pineCarcass(W: number, H: number, D: number, y0: number, pre: string) {
  const id = (k: string) => pre + k;
  const parts: CustomPart[] = [
    box(id("T"), "Top", [W - 2 * T, T, D], [0, y0 + H - T / 2, 0], { material: "wood" }),
    box(id("B"), "Bottom", [W - 2 * T, T, D], [0, y0 + T / 2, 0], { material: "wood" }),
    box(id("S0"), "Side", [T, H, D], [-W / 2 + T / 2, y0 + H / 2, 0], { material: "wood" }),
    box(id("K"), "Back panel", [W - 2 * T, H - 2 * T, 6], [0, y0 + H / 2, -D / 2 + 15], { material: "fiber" }),
    box(id("S1"), "Side", [T, H, D], [W / 2 - T / 2, y0 + H / 2, 0], { material: "wood" }),
  ];
  const ends = [y0 + H - T / 2, y0 + T / 2];
  const dowels = [-1, 1].flatMap((sx) => ends.flatMap((y) => [-1, 1].map((sz) => [sx * (W / 2 - T), y, sz * (D / 2 - 60)] as Vec3)));
  const screws = (sx: number) => ends.flatMap((y) => [-1, 1].map((sz) => [sx * (W / 2), y, sz * (D / 2 - 120)] as Vec3));
  const CONN = { name: "Connector screw", len: 50, dia: 6 };
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the top and the bottom",
      detail: "Two into each end, on a rug.",
      add: [id("T"), id("B")],
      fix: [id("T"), id("B")].flatMap((p, i) => [-1, 1].map((sx) => fx("dowel", dowels.filter((d) => d[1] === ends[i] && Math.sign(d[0]) === sx), [-sx, 0, 0], p))),
      tools: ["hammer"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Fit a side onto the dowels",
      detail: "Then two connector screws into each end with the Allen key.",
      add: [id("S0")],
      fix: [fx("bolt", screws(-1), [1, 0, 0], id("S0"), CONN)],
      tools: ["allen"],
    },
    {
      title: "Slide the back panel into its grooves",
      detail: "From the open side, painted face in, all the way to the side.",
      add: [id("K")],
      from: { [id("K")]: [W, 0, 0] },
    },
    {
      title: "Fit the other side",
      detail: "Onto the dowels, then two connector screws into each end. Stand the cabinet up.",
      add: [id("S1")],
      fix: [fx("bolt", screws(1), [-1, 0, 0], id("S1"), CONN)],
      tools: ["allen"],
    },
  ];
  return { parts, steps };
}

function pineCabinet(s: ProductSpec, y0: number, wall: boolean, pre = ""): Recipe {
  const W = 800, H = 830, D = s.size.d * 10;
  const c = pineCarcass(W, H, D, y0, pre);
  const id = (k: string) => pre + k;
  const parts = [...c.parts];
  const inner = W - 2 * T;
  for (const [i, y] of [y0 + H / 3, y0 + (2 * H) / 3].entries()) parts.push(box(id(`F${i}`), "Shelf", [inner - 2, T, D - 20], [0, y, 8], { material: "wood" }));
  for (const i of [0, 1]) parts.push(box(id(`D${i}`), "Door", [W / 2 - 2, H - 4, T], [(i ? 1 : -1) * (W / 4), y0 + H / 2, D / 2 + T / 2], { material: "wood" }));
  const hy = [y0 + 110, y0 + H - 110];
  const plates = (sx: number) => hy.map((y) => [sx * (W / 2 - T), y, D / 2 - 40] as Vec3);
  const steps = [...c.steps];
  steps.push({
    title: "Screw the hinge plates to the sides",
    detail: "Two on the inside of each side at the front, two screws each.",
    fix: [-1, 1].flatMap((sx) => [
      fx("plate", plates(sx), [sx, 0, 0], id(sx < 0 ? "S0" : "S1"), { name: "Hinge plate", len: 40, dia: 20 }),
      fx("screw", plates(sx).flatMap((p) => [p[1] + 28, p[1] - 28].map((y) => [p[0], y, p[2]] as Vec3)), [sx, 0, 0], id(sx < 0 ? "S0" : "S1"), { len: 14, dia: 4 }),
    ]),
    tools: ["screwdriver"],
    pose: "+y",
  });
  if (wall)
    steps.push({
      title: "Hang it on the wall",
      detail: "Two screws through the top of the back into the wall, with one of you holding it level. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", [-1, 1].map((sx) => [sx * (W / 2 - 90), y0 + H - 45, -D / 2 - 30] as Vec3), [0, 0, -1], id("K")),
        fx("screw", [-1, 1].map((sx) => [sx * (W / 2 - 90), y0 + H - 45, -D / 2 + 12] as Vec3), [0, 0, -1], id("K"), { len: 50, dia: 5 }),
      ],
      tools: ["screwdriver", "drill", "level", "pencil"],
      people: 2,
      wall: true,
      warnings: ["wall", "two"],
    });
  const doors = [id("D0"), id("D1")];
  const hx = (sx: number) => sx * (W / 2 - 40);
  steps.push(
    {
      title: "Screw the hinges onto the doors",
      detail: "Doors face down on a rug. Press each hinge cup in and fix it with two screws.",
      wait: doors,
      fix: doors.flatMap((d, i) => {
        const sx = i ? 1 : -1;
        return [
          fx("hinge", hy.map((y) => [hx(sx), y, D / 2] as Vec3), [0, 0, 1], d),
          fx("screw", hy.flatMap((y) => [y + 30, y - 30].map((yy) => [hx(sx), yy, D / 2] as Vec3)), [0, 0, 1], d, { len: 12, dia: 4 }),
        ];
      }),
      tools: ["screwdriver"],
    },
    {
      title: "Click the doors onto the hinge plates",
      detail: "Hook each hinge over its plate and press until it clicks.",
      add: doors,
      from: Object.fromEntries(doors.map((d) => [d, [0, 0, 300] as Vec3])),
    },
    {
      title: "Put the shelves in on their pins",
      detail: "Four pins for each shelf, at the same height on both sides.",
      add: [id("F0"), id("F1")],
      fix: [0, 1].flatMap((i) =>
        [-1, 1].map((sx) => fx("pin", [-1, 1].map((sz) => [sx * (W / 2 - T), y0 + (H * (i + 1)) / 3 - T / 2 - 3, sz * (D / 2 - 60)] as Vec3), [sx, 0, 0], id(sx < 0 ? "S0" : "S1"), { len: 16, dia: 5 })),
      ),
    },
    { title: "Line the doors up", detail: "Turn the hinge screws until the gaps between the doors are even.", tools: ["screwdriver"] },
  );
  return { parts, steps };
}

/* ---------------- pine 2x2 shelving unit ---------------- */

function cubeUnit(s: ProductSpec, y0: number, pre = "", lying = true) {
  const W = 800, H = 830, D = s.size.d * 10;
  const id = (k: string) => pre + k;
  const yM = y0 + H / 2;
  const vh = H / 2 - 1.5 * T;
  const parts: CustomPart[] = [
    box(id("M"), "Middle shelf", [W - 2 * T, T, D], [0, yM, 0], { material: "wood" }),
    box(id("V0"), "Divider", [T, vh, D], [0, y0 + T + vh / 2, 0], { material: "wood" }),
    box(id("V1"), "Divider", [T, vh, D], [0, yM + T / 2 + vh / 2, 0], { material: "wood" }),
    box(id("S0"), "Side", [T, H - 2 * T, D], [-W / 2 + T / 2, yM, 0], { material: "wood" }),
    box(id("S1"), "Side", [T, H - 2 * T, D], [W / 2 - T / 2, yM, 0], { material: "wood" }),
    box(id("T"), "Top", [W, T, D], [0, y0 + H - T / 2, 0], { material: "wood" }),
    box(id("B"), "Bottom", [W, T, D], [0, y0 + T / 2, 0], { material: "wood" }),
  ];
  const CONN = { name: "Connector screw", len: 50, dia: 6 };
  // dowels and connector screws apart, and clear of the cabinet's own screws when it stands on one
  const zs = [-1, 1].map((sz) => sz * (D / 2 - 60));
  const zc = [-1, 1].map((sz) => sz * (D / 2 - 90));
  const edgeX = [-W / 2 + T / 2, 0, W / 2 - T / 2];
  const edgeOf = (x: number, top: boolean) => (x === 0 ? id(top ? "V1" : "V0") : id(x < 0 ? "S0" : "S1"));
  const steps: CustomStep[] = [
    {
      title: "Fit the dowels and the connector rod in the middle shelf",
      detail: "A long dowel into the top face and one into the bottom, then screw the rod into the hole between them.",
      add: [id("M")],
      fix: [
        fx("dowel", [[0, yM + T / 2, -60]], [0, -1, 0], id("M"), { len: 40, dia: 8 }),
        fx("dowel", [[0, yM - T / 2, -60]], [0, 1, 0], id("M"), { len: 40, dia: 8 }),
        fx("connector", [[0, yM + T / 2, 60]], [0, -1, 0], id("M"), { name: "Connector rod", len: 110, dia: 6 }),
      ],
      tools: ["screwdriver"],
      ...(lying ? { pose: "+z" as const, warnings: ["floor" as const] } : {}),
    },
    {
      title: "Push a divider onto each face of the middle shelf",
      detail: "One above and one below, over the dowel and the rod.",
      add: [id("V0"), id("V1")],
    },
    {
      title: "Tighten the connector nuts",
      detail: "One in each divider, turned onto the rod with a screwdriver until the cross is tight.",
      fix: [fx("nut", [[-T / 2, yM + T / 2 + 40, 60], [-T / 2, yM - T / 2 - 40, 60]], [1, 0, 0], id("V1"), { name: "Connector nut", len: 12, dia: 12 })],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the sides to the middle shelf",
      detail: "Two dowels into each end of the shelf, then each side on, with two connector screws.",
      fix: [-1, 1].map((sx) => fx("dowel", zs.map((z) => [sx * (W / 2 - T), yM, z] as Vec3), [-sx, 0, 0], id("M"))),
      tools: ["allen"],
    },
    {
      title: "Screw the sides on",
      detail: "Two connector screws through each side into the shelf's end.",
      add: [id("S0"), id("S1")],
      fix: [-1, 1].map((sx) => fx("bolt", zc.map((z) => [sx * (W / 2), yM, z] as Vec3), [-sx, 0, 0], id(sx < 0 ? "S0" : "S1"), CONN)),
      tools: ["allen"],
    },
    {
      title: "Tap twelve dowels into the edges",
      detail: "Two into each end of the sides and the dividers.",
      fix: [true, false].flatMap((top) => edgeX.map((x) => fx("dowel", zs.map((z) => [x, top ? y0 + H - T : y0 + T, z] as Vec3), [0, top ? -1 : 1, 0], edgeOf(x, top)))),
      tools: ["hammer"],
    },
    {
      title: "Fit the top and the bottom",
      detail: "Onto the dowels, then six connector screws through each into the sides and dividers.",
      add: [id("T"), id("B")],
      fix: [true, false].map((top) => fx("bolt", edgeX.flatMap((x) => zc.map((z) => [x, top ? y0 + H : y0, z] as Vec3)), [0, top ? -1 : 1, 0], id(top ? "T" : "B"), CONN)),
      tools: ["allen"],
    },
  ];
  return { parts, steps, W, H, D };
}

/** The 2x2 unit on the wall: two brackets under the top at the back, keyhole plates, screws into the wall, covers. */
function cubeWall(y0: number, W: number, H: number, D: number, pre: string): CustomStep[] {
  const id = (k: string) => pre + k;
  const xs = [-1, 1].map((sx) => sx * (W / 2 - T - 50));
  const y = y0 + H - T;
  return [
    {
      title: "Screw the wall brackets under the top",
      detail: "In the top two corners at the back, two screws each.",
      fix: [
        fx("angle", xs.map((x) => [x, y, -D / 2 + 25] as Vec3), [0, 1, 0], id("T"), { name: "Wall bracket", len: 40, dia: 30 }),
        fx("screw", xs.flatMap((x) => [x - 25, x + 25].map((xx) => [xx, y, -D / 2 + 45] as Vec3)), [0, 1, 0], id("T"), { len: 14, dia: 4 }),
      ],
      tools: ["screwdriver"],
      pose: "+y",
    },
    {
      title: "Hang it on the wall",
      detail: "Screw the keyhole plates to the wall where the brackets meet it, hang the unit on them and snap the covers on. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("bracket", xs.map((x) => [x, y - 30, -D / 2 - 4] as Vec3), [0, 0, 1], id("T"), { name: "Keyhole plate", len: 30, dia: 20 }),
        fx("plug", xs.map((x) => [x, y - 30, -D / 2 - 40] as Vec3), [0, 0, -1], id("T")),
        fx("screw", xs.map((x) => [x, y - 30, -D / 2 - 6] as Vec3), [0, 0, -1], id("T"), { len: 50, dia: 5 }),
        fx("cap", xs.map((x) => [x, y - 15, -D / 2 + 30] as Vec3), [0, 0, -1], id("T"), { name: "Cover" }),
      ],
      tools: ["screwdriver", "drill", "pencil", "level"],
      people: 2,
      wall: true,
      warnings: ["wall", "two"],
    },
  ];
}

function cubeAlone(s: ProductSpec): Recipe {
  const c = cubeUnit(s, 0);
  return { parts: c.parts, steps: [...c.steps, ...cubeWall(0, c.W, c.H, c.D, "")] };
}

/** 80x166: the pine cabinet on the floor and the 2x2 unit on top, pinned and plated together at the back. */
function cubeOnCabinet(s: ProductSpec): Recipe {
  const cab = pineCabinet(s, 0, false, "c");
  const cube = cubeUnit(s, 830, "", false);
  const D = s.size.d * 10, W = 800;
  const join = [-1, 1].map((sx) => sx * (W / 2 - T / 2));
  const steps: CustomStep[] = [
    ...cab.steps,
    {
      title: "Push two pins into the top of the cabinet",
      detail: "They keep the shelving unit in line on top.",
      fix: [fx("pin", join.map((x) => [x * 0.9, 830, 0] as Vec3), [0, -1, 0], "cT", { name: "Guide pin", len: 16, dia: 6 })],
    },
    ...cube.steps.map((st, i) => (i === 0 ? { ...st, detail: "Build the shelving unit on a rug next to the cabinet. " + st.detail } : st)),
    {
      title: "Join the two at the back",
      detail: "Lift the shelving unit onto the pins together, then a joining plate across each back corner, two screws each.",
      fix: [
        ...join.map((x) => fx("plate", [[x, 830, -D / 2]], [0, 0, 1], x < 0 ? "cS0" : "cS1", { name: "Joining plate", len: 70, dia: 30 })),
        ...join.map((x) => fx("screw", [[x, 800, -D / 2 - 1], [x, 870, -D / 2 - 1]], [0, 0, 1], x < 0 ? "cS0" : "cS1", { len: 14, dia: 4 })),
      ],
      people: 2,
      tools: ["screwdriver"],
      warnings: ["two"],
    },
    ...cubeWall(830, W, 830, D, ""),
  ];
  return { parts: [...cab.parts, ...cube.parts], steps };
}

/* ---------------- cabinet with sliding doors ---------------- */

function slidingCabinet(s: ProductSpec): Recipe {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const c = pineCarcass(W, H, D, 0, "");
  const parts = [...c.parts];
  const inner = W - 2 * T;
  const fy = [H / 3, (2 * H) / 3];
  fy.forEach((y, i) => parts.push(box(`F${i}`, "Shelf", [inner - 2, T, D - 60], [0, y, -12], { material: "wood" })));
  const dw = inner / 2 + 15, dh = H - 2 * T - 8;
  const dz = [D / 2 - 34, D / 2 - 14];
  const dx = [-inner / 2 + dw / 2, inner / 2 - dw / 2];
  for (const i of [0, 1]) parts.push(box(`G${i}`, "Sliding door", [dw, dh, 12], [dx[i], H / 2, dz[i]], { material: "wood" }));
  const ends = (i: number) => [-1, 1].map((k) => dx[i] + k * (dw / 2 - 70));
  const topY = H / 2 + dh / 2, botY = H / 2 - dh / 2;
  const fits = (kind: HwKind, name: string, y: number, dir: Vec3) =>
    [0, 1].flatMap((i) => [
      fx(kind, ends(i).map((x) => [x, y, dz[i]] as Vec3), dir, `G${i}`, { name, len: 12, dia: 24 }),
      fx("screw", ends(i).flatMap((x) => [x - 26, x + 26].map((xx) => [xx, y, dz[i] - 3] as Vec3)), dir, `G${i}`, { len: 12, dia: 4 }),
    ]);
  const steps: CustomStep[] = [
    ...c.steps,
    {
      title: "Put the shelves in on their pins",
      detail: "Four pins for each shelf, level on both sides.",
      add: ["F0", "F1"],
      fix: fy.flatMap((y) => [-1, 1].map((sx) => fx("pin", [-1, 1].map((sz) => [sx * (W / 2 - T), y - T / 2 - 3, -12 + sz * (D / 2 - 70)] as Vec3), [sx, 0, 0], sx < 0 ? "S0" : "S1", { len: 16, dia: 5 }))),
      pose: "+y",
    },
    {
      title: "Screw the rollers onto the top of the doors",
      detail: "Two on each door's top edge, two screws each.",
      wait: ["G0", "G1"],
      fix: fits("roller", "Door roller", topY, [0, -1, 0]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the guides onto the bottom of the doors",
      detail: "Two on each door's bottom edge, two screws each.",
      fix: fits("clip", "Door guide", botY, [0, 1, 0]),
      tools: ["screwdriver"],
    },
    {
      title: "Hang the back door, then the front door",
      detail: "Tilt each door in, lift its rollers into the top track and set its guides into the bottom one, then push the lock on each roller until it clicks.",
      add: ["G0", "G1"],
      from: { G0: [0, 0, 300], G1: [0, 0, 300] },
    },
    { title: "Level the doors", detail: "Turn the roller adjusters until both doors hang straight and the gap is even.", tools: ["screwdriver"] },
    {
      title: "Fix it to the wall",
      detail: "Two screws through the top of the back into the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        fx("plug", [-1, 1].map((sx) => [sx * (W / 2 - 90), H - 45, -D / 2 - 30] as Vec3), [0, 0, -1], "K"),
        fx("screw", [-1, 1].map((sx) => [sx * (W / 2 - 90), H - 45, -D / 2 + 12] as Vec3), [0, 0, -1], "K", { len: 50, dia: 5 }),
      ],
      tools: ["screwdriver", "drill", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

/* ---------------- box shelf with divider ---------------- */

function boxShelf(s: ProductSpec): Recipe {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const lip = 70, t = 16;
  const inner = W - 2 * t;
  // a side: tall at the back, sloping down to the low front board it butts against; a flat board stood on edge
  const pc = t + (H - t) / 2;
  const zs = -t / 2; // the sides stop at the front board's back face
  const topAt = (z: number) => H - ((H - lip) * (z + D / 2)) / (D - t);
  const upright = (outline: [number, number][]): PartPiece => ({ shape: "slab", size: [H - t, t, D - t], pos: [0, 0, 0], outline, rot: [0, 0, Math.PI / 2] });
  const half = (D - t) / 2;
  const side = (sx: number): CustomPart =>
    box(`S${sx < 0 ? 0 : 1}`, "Side", [t, H - t, D - t], [sx * (W / 2 - t / 2), pc, zs], {
      pieces: [upright([[t - pc, -half], [H - pc, -half], [lip - pc, half], [t - pc, half]])],
      material: "wood",
    });
  const zb = -D / 2 + t, zf = D / 2 - t;
  const parts: CustomPart[] = [
    box("L", "Front", [W, lip - t, t], [0, t + (lip - t) / 2, D / 2 - t / 2], { material: "wood" }),
    side(-1),
    side(1),
    box("K", "Back", [inner, H - t, t], [0, pc, -D / 2 + t / 2], { material: "wood" }),
    box("B", "Bottom", [W, t, D], [0, t / 2, 0], { material: "wood" }),
    box("V", "Divider", [t, H - t, zf - zb], [0, pc, (zb + zf) / 2], {
      pieces: [{ ...upright([[t - pc, -(zf - zb) / 2], [topAt(zb) - 20 - pc, -(zf - zb) / 2], [topAt(zf) - 10 - pc, (zf - zb) / 2], [t - pc, (zf - zb) / 2]]), size: [H - t, t, zf - zb] }],
      material: "wood",
    }),
  ];
  const CONN = { name: "Connector screw", len: 50, dia: 6 };
  const xs = (sx: number) => sx * (W / 2 - t / 2);
  const steps: CustomStep[] = [
    {
      title: "Screw two cam bolts into the front",
      detail: "Lay the low front board face down on a rug and screw a bolt into the hole near each end.",
      add: ["L"],
      fix: [fx("camScrew", [-1, 1].map((sx) => [xs(sx), t + 15, D / 2 - t] as Vec3), [0, 0, 1], "L")],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    {
      title: "Tap a dowel into each side",
      detail: "Into the hole in its low front edge.",
      wait: ["S0", "S1"],
      fix: [-1, 1].map((sx) => fx("dowel", [[xs(sx), lip - 14, D / 2 - t]], [0, 0, -1], sx < 0 ? "S0" : "S1")),
      tools: ["hammer"],
    },
    {
      title: "Push the sides onto the front and lock the cams",
      detail: "Each side goes over its bolt and dowel. Turn the cam lock until it grips the bolt.",
      add: ["S0", "S1"],
      fix: [-1, 1].map((sx) => fx("cam", [[sx * (W / 2 - t), t + 15, D / 2 - t - 25]], [sx, 0, 0], sx < 0 ? "S0" : "S1")),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the back on",
      detail: "Between the tall ends of the sides, two connector screws through each side into it.",
      add: ["K"],
      fix: [-1, 1].map((sx) => fx("bolt", [H * 0.35, H * 0.8].map((y) => [sx * (W / 2), y, -D / 2 + t / 2] as Vec3), [-sx, 0, 0], sx < 0 ? "S0" : "S1", CONN)),
      tools: ["allen"],
    },
    {
      title: "Turn it over and screw the bottom on",
      detail: "Upside down on the rug, the bottom over it, then five connector screws up into the sides, the back and the front.",
      add: ["B"],
      fix: [
        fx(
          "bolt",
          [
            [xs(-1), 0, -30],
            [xs(1), 0, -30],
            [-inner / 4, 0, -D / 2 + t / 2],
            [inner / 4, 0, -D / 2 + t / 2],
            [0, 0, D / 2 - t / 2],
          ],
          [0, 1, 0],
          "B",
          CONN,
        ),
      ],
      tools: ["allen"],
      pose: "-y",
    },
    {
      title: "Clip the divider holders on and slide the divider in",
      detail: "Turn it the right way up. Two wire holders in the middle of the back and the front, then the divider slides down into them.",
      fix: [
        fx("clip", [[0, H * 0.55, -D / 2 + t]], [0, 0, -1], "K", { name: "Divider holder" }),
        fx("clip", [[0, t + 30, D / 2 - t]], [0, 0, 1], "L", { name: "Divider holder" }),
      ],
      add: ["V"],
      from: { V: [0, 300, 0] },
      pose: "+y",
    },
    {
      title: "Set it on a shelf of the shelving unit",
      detail: "It sits on four shelf pins in the uprights, like a shelf.",
    },
  ];
  return { parts, steps };
}

/* ---------------- storage box on wheels, in a side unit ---------------- */

function storageBox(W: number, D: number): Recipe {
  const L = W - 2 * UX - 60; // clear of the uprights
  const BD = D - 30;
  const et = 18, wh = 50, bh = 200;
  const y0 = wh;
  const inn = L - 2 * et;
  const rail = 40, slat = 30, gap = 10;
  const parts: CustomPart[] = [
    box("XB", "Box bottom", [inn, 15, BD - 2 * et], [0, y0 + 7.5, 0], { material: "wood" }),
    box("XR0", "Rail", [inn, rail, et], [0, y0 + rail / 2, -BD / 2 + et / 2], { material: "wood" }),
    box("XR1", "Rail", [inn, rail, et], [0, y0 + rail / 2, BD / 2 - et / 2], { material: "wood" }),
    box("XE0", "End panel", [et, bh, BD], [-L / 2 + et / 2, y0 + bh / 2, 0], { material: "wood" }),
  ];
  const slats: string[] = [];
  const sy = (k: number) => y0 + rail + gap + slat / 2 + k * (slat + gap);
  for (const [face, n] of [[1, 4], [-1, 3]] as const)
    for (let k = 0; k < n; k++) {
      const id = `XL${slats.length}`;
      slats.push(id);
      parts.push(box(id, "Slat", [inn, slat, et], [0, face > 0 ? sy(k) : sy(k) + (k ? 10 * k : 0) + 5, face * (BD / 2 - et / 2)], { material: "wood" }));
    }
  parts.push(box("XE1", "End panel", [et, bh, BD], [L / 2 - et / 2, y0 + bh / 2, 0], { material: "wood" }));
  const pos = (id: string) => parts.find((p) => p.id === id)!.pos;
  const SCREW = { name: "Long screw", len: 60, dia: 4 };
  // the screw heads sit just proud of the end panel, so they never share a point with the dowels behind them
  const sxo = (sx: number) => sx * (L / 2 + 5);
  const scr = (sx: number): Vec3[] => [
    [sxo(sx), y0 + 7.5, 60],
    [sxo(sx), y0 + rail / 2, -BD / 2 + et / 2],
    [sxo(sx), y0 + rail / 2, BD / 2 - et / 2],
    [sxo(sx), pos("XL3")[1], BD / 2 - et / 2],
    [sxo(sx), pos("XL6")[1], -BD / 2 + et / 2],
  ];
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the box bottom",
      detail: "Four along each long edge and one in each end.",
      add: ["XB"],
      fix: [
        ...[-1, 1].map((sz) => fx("dowel", [-0.375, -0.125, 0.125, 0.375].map((k) => [k * inn, y0 + 7.5, sz * (BD / 2 - et)] as Vec3), [0, 0, -sz], "XB")),
        ...[-1, 1].map((sx) => fx("dowel", [[sx * (inn / 2), y0 + 7.5, 0]], [-sx, 0, 0], "XB")),
      ],
      tools: ["hammer"],
      pose: "+y",
      warnings: ["floor"],
    },
    {
      title: "Tap the dowels into the ends of the rails",
      detail: "Two in each end.",
      wait: ["XR0", "XR1"],
      fix: ["XR0", "XR1"].flatMap((id) => [-1, 1].map((sx) => fx("dowel", [-15, 15].map((dy) => [sx * (inn / 2), pos(id)[1] + dy, pos(id)[2]] as Vec3), [-sx, 0, 0], id))),
      tools: ["hammer"],
    },
    {
      title: "Push the rails onto the long edges of the bottom",
      add: ["XR0", "XR1"],
    },
    {
      title: "Stand it on an end panel",
      detail: "Lay one end panel on the rug, holes up, and push the bottom and rails down into it.",
      add: ["XE0"],
      pose: "+x",
    },
    {
      title: "Tap the dowels into the slats",
      detail: "Two in each end of every slat.",
      wait: slats,
      fix: slats.flatMap((id) => [-1, 1].map((sx) => fx("dowel", [-8, 8].map((dy) => [sx * (inn / 2), pos(id)[1] + dy, pos(id)[2]] as Vec3), [-sx, 0, 0], id))),
      tools: ["hammer"],
    },
    {
      title: "Push the slats into the end panel",
      detail: "Four at the front and three at the back, smooth face out.",
      add: slats,
    },
    {
      title: "Put the other end panel on and screw it",
      detail: "Over all the dowels, then five long screws into the bottom, the rails and two slats.",
      add: ["XE1"],
      fix: [fx("screw", scr(1), [-1, 0, 0], "XE1", SCREW)],
      tools: ["screwdriver"],
    },
    {
      title: "Turn it over and screw the first end",
      detail: "The same five long screws.",
      fix: [fx("screw", scr(-1), [1, 0, 0], "XE0", SCREW)],
      tools: ["screwdriver"],
      pose: "-x",
    },
    {
      title: "Screw the castors on",
      detail: "Upside down, one under each corner of the end panels, two screws each.",
      fix: [
        ...[-1, 1].map((sx) => fx("castor", [-1, 1].map((sz) => [sx * (L / 2 - et / 2), y0, sz * (BD / 2 - 60)] as Vec3), [0, 1, 0], sx < 0 ? "XE0" : "XE1")),
        ...[-1, 1].map((sx) => fx("screw", [-1, 1].flatMap((sz) => [-1, 1].map((k) => [sx * (L / 2 - et / 2), y0, sz * (BD / 2 - 60) + k * 24] as Vec3)), [0, 1, 0], sx < 0 ? "XE0" : "XE1", { len: 16, dia: 4 })),
      ],
      tools: ["screwdriver"],
      pose: "-y",
    },
  ];
  return { parts, steps };
}

function boxUnit(s: ProductSpec): Recipe & { back: Vec3[] } {
  const H = s.size.h * 10;
  const lo = 320, hi = H - 70, n = H < 1500 ? 3 : 4;
  const ys = Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
  const u = sideUnit(s, { ys, brace: [ys[0] + 40, ys[1] - 40] });
  const bx = storageBox(u.W, u.D);
  return {
    parts: [...bx.parts, ...u.parts],
    steps: [
      ...bx.steps,
      ...u.steps.map((st, i) => (i === 0 ? { ...st, detail: "Push the box aside first. " + st.detail } : st)),
      { title: "Roll the box in under the bottom shelf", detail: "It runs on its castors between the side units." },
    ],
    back: u.back,
  };
}

/* ---------------- which guide is which ---------------- */

const MESH = /ivar-cabinet-doors-(80-x-83|160-x-30-x-83)/;
const MESH_IN_UNIT = /ivar-cabinet-doors-89-x-30-x-124/;
const DOORS = /ivar-shelving-unit-doors-/;
const WALL_CAB = /ivar-wall-cabinet-doors-/;
const CUBE = /ivar-shelving-unit-80-x-30-x-83/;
const CUBE_ON_CAB = /ivar-shelving-unit-80-x-30-x-166/;
const SLIDING = /ivar-cabinet-sliding-doors-/;
const BOX_SHELF = /ivar-box-shelf-divider-/;
const BOX_UNIT = /ivar-shelving-unit-storage-box-/;

function run(b: PlanBuilder, s: ProductSpec, r: Recipe & { back?: Vec3[] }) {
  buildCustom(b, { ...s, custom: { parts: r.parts, steps: r.steps } });
  if (r.back) strapStep(b, s, r.back);
  return true;
}

const family: Family = {
  names: ["IVAR"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (MESH.test(slug)) return run(b, s, meshStandalone(s));
    if (MESH_IN_UNIT.test(slug)) return run(b, s, meshInUnit(s));
    if (DOORS.test(slug)) return run(b, s, doorUnit(s));
    if (WALL_CAB.test(slug)) return run(b, s, pineCabinet(s, 0, true));
    if (CUBE.test(slug)) return run(b, s, cubeAlone(s));
    if (CUBE_ON_CAB.test(slug)) return run(b, s, cubeOnCabinet(s));
    if (SLIDING.test(slug)) return run(b, s, slidingCabinet(s));
    if (BOX_SHELF.test(slug)) return run(b, s, boxShelf(s));
    if (BOX_UNIT.test(slug)) return run(b, s, boxUnit(s));
    if (s.archetype !== "shelf" || s.shelf?.style !== "bookcase") return false;
    const u = sideUnit(s);
    return run(b, s, { parts: u.parts, steps: u.steps, back: u.back });
  },
};
export default family;
