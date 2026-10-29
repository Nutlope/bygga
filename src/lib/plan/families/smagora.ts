import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * SMÅGÖRA, read from its manuals. The shelf unit and the wardrobe are put together lying on a side with cam bolts,
 * cam locks and dowels, the back slid into grooves before the second side goes on, and both are fixed to the wall.
 * The desk's three rails are bolted between the sides with long bolts and barrel nuts, the upstand is built onto the
 * top while it lies upside down, and the top goes on with cam locks. The cot and the crib are two spindle sides
 * bolted between two ends with barrel nuts, stood on one end to bolt the other, then the base goes in.
 * The changing table is a bookshelf put together lying on a side, with a tray of rims and two floor boards bolted
 * on top with two plates, and two brackets under the tray screwed to the wall.
 */

type Fx = Omit<CustomFix, "count" | "at"> & { at: Vec3[] };
const fx = (f: Fx): CustomFix => ({ ...f, count: f.at.length });
const sx2 = [-1, 1];

function keyAt(b: PlanBuilder, pos: Vec3) {
  return b.items.find((x) => x.kind === "part" && x.final.pos.every((v, i) => Math.abs(v - pos[i]) < 0.5))?.key;
}

/** The shelf unit, standing on the floor and fixed to the wall (it can also hang, or join the changing table). */
function shelfUnit(s: ProductSpec): CustomParams {
  const W = s.size.w * 10 || 290, H = s.size.h * 10 || 880, D = s.size.d * 10 || 250;
  const T = 16, G = 3; // panels, glides
  const xs = W / 2 - T / 2, iw = W - 2 * T;
  const zB = -D / 2 + 8; // back, in grooves
  const pd = D / 2 - (zB + 2); // panels run from the back to the front
  const pz = D / 2 - pd / 2;
  const yBot = G + 30, yTop = H - T / 2;
  const ys = [yBot, yBot + (yTop - yBot) / 3, yBot + (2 * (yTop - yBot)) / 3, yTop];
  const ids = ["bottom", "S1", "S2", "top"];
  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [T, H - G, D], pos: [-xs, G + (H - G) / 2, 0] },
    { id: "R", name: "Side panel", size: [T, H - G, D], pos: [xs, G + (H - G) / 2, 0] },
    ...ids.map((id, i): CustomPart => ({ id, name: i === 0 ? "Bottom" : i === 3 ? "Top" : "Shelf", size: [iw, T, pd], pos: [0, ys[i], pz] })),
    { id: "back", name: "Back panel", size: [iw, yTop - yBot, 3], pos: [0, (yTop + yBot) / 2, zB], material: "fiber" },
  ];
  const zk = (k: number) => pz + k * (pd / 2 - 40);
  const zd = (k: number) => pz + k * (pd / 2 - 90);
  const bolts = (side: number) => fx({ kind: "camScrew", len: 30, dia: 8, at: ys.flatMap((y) => sx2.map((k) => [side * (iw / 2), y, zk(k)] as Vec3)), dir: [side, 0, 0], on: side < 0 ? "L" : "R" });
  const dowels = (list: string[]) =>
    list.flatMap((id) => sx2.map((e) => fx({ kind: "dowel", at: sx2.map((k) => [e * (iw / 2), ys[ids.indexOf(id)], zd(k)] as Vec3), dir: [-e, 0, 0], on: id })));
  const cams = (side: number) => fx({ kind: "cam", dia: 15, at: ys.flatMap((y, i) => sx2.map((k) => [side * (iw / 2 - 30), y + (i === 3 ? -T / 2 : T / 2), zk(k)] as Vec3)), dir: [0, 0, 0] });
  const camFix = (side: number): CustomFix[] => {
    const c = cams(side);
    // the top's locks are turned from underneath, the others from above
    const up = c.at!.filter((p) => p[1] < yTop - 1), dn = c.at!.filter((p) => p[1] < yTop - 1 === false);
    return [{ ...c, at: up, count: up.length, dir: [0, -1, 0] }, { ...c, at: dn, count: dn.length, dir: [0, 1, 0] }];
  };
  const wx = [-iw / 2 + 30, iw / 2 - 30], wy = H - T - 30;
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into a side",
      detail: "Lay it on a rug, inside face up. Eight bolts, two at each row of holes.",
      add: ["L"],
      fix: [bolts(-1)],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Tap dowels into the top and bottom and stand them on the side", detail: "Two dowels into each end, then push them onto the cam bolts at the ends.", add: ["top", "bottom"], fix: dowels(["top", "bottom"]), tools: ["hammer"] },
    { title: "Tap dowels into the shelves and stand them on the side", detail: "Two dowels into each end, then onto the middle cam bolts.", add: ["S1", "S2"], fix: dowels(["S1", "S2"]), tools: ["hammer"] },
    { title: "Turn the cam locks", detail: "Eight, arrow towards the bolt, then clockwise until tight.", fix: camFix(-1), tools: ["screwdriver"] },
    { title: "Slide the back into the grooves", detail: "Smooth side facing in, from the open side, all the way along.", add: ["back"], from: { back: [400, 0, 0] } },
    { title: "Put the other side on", detail: "Screw its eight cam bolts in first, then lower it so every bolt finds its hole.", add: ["R"], fix: [bolts(1)], tools: ["screwdriver"] },
    { title: "Turn the cam locks", detail: "The eight on this side.", fix: camFix(1), tools: ["screwdriver"] },
    {
      title: "Tap the glides under the sides",
      detail: "Two under each side, at the bottom end, flat face out.",
      fix: [fx({ kind: "glide", name: "Glide", len: G, dia: 14, at: sx2.flatMap((k) => sx2.map((j) => [k * xs, 0, j * (D / 2 - 30)] as Vec3)), dir: [0, 1, 0] })],
      tools: ["hammer"],
    },
    {
      title: "Stand it up and screw in the wall brackets",
      detail: "One inside each top corner at the back, two screws each.",
      fix: [
        fx({ kind: "bracket", len: 40, dia: 36, at: wx.map((x) => [x, wy, zB + 20] as Vec3), dir: [0, 1, 0], on: "top" }),
        fx({ kind: "screw", len: 12, dia: 4, at: wx.flatMap((x) => [-10, 10].map((dx) => [x + dx, H - T, zB + 30] as Vec3)), dir: [0, 1, 0], on: "top" }),
      ],
      tools: ["screwdriver"],
      pose: "+y",
    },
    {
      title: "Mark the wall and put the screws in",
      detail: "Mark through the brackets, drill, then a plug, a spacer and a screw for each, left 1 cm out. Pick screws made for your wall.",
      fix: [
        fx({ kind: "plug", at: wx.map((x) => [x, wy, -D / 2 - 2] as Vec3), dir: [0, 0, -1] }),
        fx({ kind: "spacer", name: "Wall spacer", len: 10, dia: 24, at: wx.map((x) => [x, wy, -D / 2 + 4] as Vec3), dir: [0, 0, -1] }),
        fx({ kind: "screw", len: 50, dia: 5, at: wx.map((x) => [x, wy, -D / 2 + 12] as Vec3), dir: [0, 0, -1] }),
      ],
      tools: ["pencil", "drill", "screwdriver"],
      wall: true,
    },
    {
      title: "Hang it on the screws",
      detail: "Slide a keyhole plate into each bracket, hook it over the screws and tighten until it sits level. Snap the covers on.",
      fix: [
        fx({ kind: "plate", name: "Keyhole plate", len: 4, dia: 30, at: wx.map((x) => [x, wy, zB + 4] as Vec3), dir: [0, 0, -1] }),
        fx({ kind: "cap", name: "Bracket cover", len: 30, dia: 40, at: wx.map((x) => [x, wy, zB + 40] as Vec3), dir: [0, 0, -1] }),
      ],
      tools: ["screwdriver", "level"],
      wall: true,
      warnings: ["tip"],
    },
  ];
  return { parts, steps };
}

/** The wardrobe: lying on a side, the top and bottom with their shaped rails between the sides, back, doors on six hinges. */
function wardrobe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10 || 800, H = s.size.h * 10 || 1870, D = s.size.d * 10 || 500;
  const T = 18, G = 3;
  const xs = W / 2 - T / 2, iw = W - 2 * T;
  const zB = -D / 2 + 10;
  const zF = D / 2;
  const P = 110; // plinth under the bottom
  const C = 80; // crown rail over the top
  const yBot = G + P + T / 2, yTop = H - C - T / 2;
  const pd = zF - (zB + 2) - T; // top and bottom stop behind their rails
  const pz = zB + 2 + pd / 2;
  // the crown rises in the middle, the plinth stands on its two ends with an arch between
  const wave = (h: number, up: boolean): PartPiece[] =>
    up
      ? [
          { shape: "box", size: [iw, h * 0.6, T], pos: [0, -h * 0.2, 0] },
          { shape: "box", size: [iw * 0.5, h * 0.4, T], pos: [0, h * 0.3, 0] },
        ]
      : [
          { shape: "box", size: [iw, h * 0.5, T], pos: [0, h * 0.25, 0] },
          { shape: "box", size: [iw * 0.15, h * 0.5, T], pos: [-iw * 0.425, -h * 0.25, 0] },
          { shape: "box", size: [iw * 0.15, h * 0.5, T], pos: [iw * 0.425, -h * 0.25, 0] },
        ];

  const dh = yTop - T / 2 - (yBot + T / 2) - 4, dw = (iw - 6) / 2, dy = (yTop + yBot) / 2;
  const zd = zF - T / 2; // the doors sit between the sides
  const parts: CustomPart[] = [
    { id: "bottom", name: "Bottom", size: [iw, T, pd], pos: [0, yBot, pz] },
    { id: "top", name: "Top", size: [iw, T, pd], pos: [0, yTop, pz] },
    { id: "plinth", name: "Plinth", size: [iw, P, T], pos: [0, G + P / 2 + T / 2, zF - T / 2], pieces: wave(P, false) },
    { id: "crown", name: "Crown rail", size: [iw, C + T / 2, T], pos: [0, H - (C + T / 2) / 2, zF - T / 2], pieces: wave(C + T / 2, true) },
    { id: "L", name: "Side panel", size: [T, H - G, D], pos: [-xs, G + (H - G) / 2, 0] },
    { id: "R", name: "Side panel", size: [T, H - G, D], pos: [xs, G + (H - G) / 2, 0] },
    { id: "back0", name: "Back panel", size: [iw, (yTop - yBot) / 2, 3], pos: [0, yBot + (yTop - yBot) / 4, zB], material: "fiber" },
    { id: "back1", name: "Back panel", size: [iw, (yTop - yBot) / 2, 3], pos: [0, yBot + (3 * (yTop - yBot)) / 4, zB], material: "fiber" },
    { id: "shelfLo", name: "Shelf", size: [iw - 2, T, pd - 30], pos: [0, yBot + 260, pz - 15] },
    { id: "shelfHi", name: "Shelf", size: [iw - 2, T, pd - 30], pos: [0, yTop - 300, pz - 15] },
    { id: "rail", name: "Clothes rail", size: [iw - 4, 20, 20], pos: [0, yTop - 380, -20], shape: "cyl", material: "metal" },
    { id: "DL", name: "Door", size: [dw, dh, T], pos: [-dw / 2 - 1.5, dy, zd] },
    { id: "DR", name: "Door", size: [dw, dh, T], pos: [dw / 2 + 1.5, dy, zd] },
  ];
  const zk = (k: number) => pz + k * (pd / 2 - 45);
  const rows = [yBot, yTop];
  // each side: two bolts into the top, two into the bottom, one into the crown rail
  const bolts = (side: number) =>
    fx({ kind: "camScrew", len: 30, dia: 8, at: [...rows.flatMap((y) => sx2.map((k) => [side * (iw / 2), y, zk(k)] as Vec3)), [side * (iw / 2), H - C / 2, zF - T / 2] as Vec3], dir: [side, 0, 0], on: side < 0 ? "L" : "R" });
  const endDowels = sx2.flatMap((e) => [
    fx({ kind: "dowel", at: rows.flatMap((y) => sx2.map((k) => [e * (iw / 2), y, pz + k * (pd / 2 - 100)] as Vec3)), dir: [-e, 0, 0] }),
    fx({ kind: "dowel", at: [[e * (iw / 2), G + P / 2, zF - T / 2]], dir: [-e, 0, 0], on: "plinth" }),
  ]);
  const sideCams = (side: number) =>
    fx({ kind: "cam", dia: 15, at: [...rows.flatMap((y, i) => sx2.map((k) => [side * (iw / 2 - 30), y + (i ? -T / 2 : T / 2), zk(k)] as Vec3)), [side * (iw / 2 - 30), H - C / 2, zF - T] as Vec3], dir: [0, 0, 0] });
  const camFix = (side: number): CustomFix[] => {
    const c = sideCams(side);
    const a = c.at!.filter((p) => p[1] < H / 2), b = c.at!.filter((p) => p[1] > H / 2 && p[1] < yTop), r = c.at!.filter((p) => p[1] > yTop);
    return [
      { ...c, at: a, count: a.length, dir: [0, -1, 0] },
      { ...c, at: b, count: b.length, dir: [0, 1, 0] },
      { ...c, at: r, count: r.length, dir: [0, 0, 1] },
    ];
  };
  const glides = (side: number) => fx({ kind: "glide", name: "Glide", len: G, dia: 14, at: sx2.map((j) => [side * xs, 0, j * (D / 2 - 40)] as Vec3), dir: [0, 1, 0], on: side < 0 ? "L" : "R" });
  const clipPts: Vec3[] = [...sx2.flatMap((k) => [0.15, 0.4, 0.6, 0.85].map((t) => [k * (iw / 2 - 10), yBot + (yTop - yBot) * t, zB - 2] as Vec3))];
  const wx = [-iw / 2 + 40, iw / 2 - 40], wy = yTop + T / 2;
  const hy = [dy + dh / 2 - 120, dy, dy - dh / 2 + 120];
  const steps: CustomStep[] = [
    {
      title: "Push the cam bolts into the top and the bottom",
      detail: "Lay them on a rug. Two into the front edge of each, for the shaped rails.",
      add: ["top", "bottom"],
      fix: [fx({ kind: "camScrew", len: 30, dia: 8, at: [yTop, yBot].flatMap((y) => [-iw / 4, iw / 4].map((x) => [x, y, zF - T] as Vec3)), dir: [0, 0, -1] })],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Fit the crown rail and the plinth",
      detail: "Two dowels into each rail, then push the crown rail onto the top and the plinth onto the bottom.",
      add: ["crown", "plinth"],
      fix: [fx({ kind: "dowel", at: [[-iw / 2 + 60, yTop, zF - T] as Vec3, [iw / 2 - 60, yTop, zF - T] as Vec3, [-iw / 2 + 60, yBot, zF - T] as Vec3, [iw / 2 - 60, yBot, zF - T] as Vec3], dir: [0, 0, 1] })],
      tools: ["hammer"],
    },
    {
      title: "Lock the rails on",
      detail: "Four cam locks, in the rails' back faces. Arrow towards the bolt, then clockwise.",
      fix: [fx({ kind: "cam", dia: 15, at: [yTop, yBot].flatMap((y) => [-iw / 4, iw / 4].map((x) => [x, y + (y === yTop ? T + 20 : -T - 20), zF - T] as Vec3)), dir: [0, 0, 1] })],
      tools: ["screwdriver"],
    },
    { title: "Tap dowels into the ends", detail: "Two into each end of the top and the bottom, one into each end of the plinth.", fix: endDowels, tools: ["hammer"] },
    {
      title: "Fit the first side",
      detail: "Screw five cam bolts into it and tap two glides into its bottom edge. Lay it on the rug and stand the top and bottom on it.",
      add: ["L"],
      fix: [bolts(-1), glides(-1)],
      tools: ["screwdriver", "hammer"],
    },
    { title: "Turn the cam locks", detail: "Five, arrow towards the bolt, then clockwise until tight.", fix: camFix(-1), tools: ["screwdriver"] },
    { title: "Slide the backs into the grooves", detail: "Smooth side facing in, one after the other, until they meet in the middle.", add: ["back0", "back1"], from: { back0: [900, 0, 0], back1: [900, 0, 0] } },
    { title: "Put the other side on", detail: "Five cam bolts and two glides into it first, then lower it onto the top and bottom.", add: ["R"], fix: [bolts(1), glides(1)], tools: ["screwdriver", "hammer"], people: 2, warnings: ["two"] },
    { title: "Turn the cam locks", detail: "The five on this side.", fix: camFix(1), tools: ["screwdriver"] },
    {
      title: "Clip the backs on",
      detail: "Turn it onto its front. Push the eight clips through the backs into the sides, then press a wedge into each.",
      fix: [fx({ kind: "clip", name: "Back clip", len: 14, dia: 12, at: clipPts, dir: [0, 0, 1] }), fx({ kind: "cap", name: "Clip wedge", len: 8, dia: 10, at: clipPts, dir: [0, 0, 1] })],
      pose: "-z",
    },
    {
      title: "Stand it up and screw on the wall brackets",
      detail: "Lift it upright together. One bracket on top of the top panel at each back corner, a washer under each screw.",
      fix: [
        fx({ kind: "angle", name: "Wall bracket", len: 60, dia: 30, at: wx.map((x) => [x, wy, zB + 30] as Vec3), dir: [0, -1, 0], on: "top" }),
        fx({ kind: "washer", at: wx.map((x) => [x, wy + 3, zB + 40] as Vec3), dir: [0, -1, 0] }),
        fx({ kind: "screw", len: 16, dia: 4, at: wx.map((x) => [x, wy + 4, zB + 40] as Vec3), dir: [0, -1, 0], on: "top" }),
      ],
      tools: ["screwdriver"],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw it to the wall",
      detail: "Mark through the brackets, drill and plug, then a washer and a screw in each. Pick plugs and screws made for your wall.",
      fix: [
        fx({ kind: "plug", at: wx.map((x) => [x, wy + 20, -D / 2 - 2] as Vec3), dir: [0, 0, -1] }),
        fx({ kind: "washer", at: wx.map((x) => [x, wy + 20, -D / 2 + 2] as Vec3), dir: [0, 0, -1] }),
        fx({ kind: "screw", len: 50, dia: 5, at: wx.map((x) => [x, wy + 20, -D / 2 + 3] as Vec3), dir: [0, 0, -1] }),
      ],
      tools: ["pencil", "drill", "screwdriver"],
      wall: true,
      warnings: ["tip"],
    },
    {
      title: "Fit the shelf supports",
      detail: "Four screwed in for the low shelf, four pushed in for the top shelf.",
      fix: [
        fx({ kind: "pin", name: "Shelf support", len: 16, dia: 12, at: sx2.flatMap((k) => [-1, 1].map((j) => [k * (iw / 2), yBot + 260 - T / 2 - 4, pz - 15 + j * (pd / 2 - 60)] as Vec3)), dir: [0, 0, 0] }),
        fx({ kind: "pin", len: 16, dia: 5, at: sx2.flatMap((k) => [-1, 1].map((j) => [k * (iw / 2), yTop - 300 - T / 2 - 4, pz - 15 + j * (pd / 2 - 60)] as Vec3)), dir: [0, 0, 0] }),
      ].flatMap((f) => sx2.map((k) => { const at = f.at!.filter((p) => Math.sign(p[0]) === k); return { ...f, at, count: at.length, dir: [k, 0, 0] as Vec3 }; })),
      tools: ["screwdriver"],
    },
    {
      title: "Put the shelves in and lock the top one",
      detail: "Lay each shelf on its supports. Screw the four catches over the top shelf so it can't lift.",
      add: ["shelfLo", "shelfHi"],
      fix: [
        fx({ kind: "clip", name: "Shelf catch", len: 20, dia: 14, at: sx2.flatMap((k) => [-1, 1].map((j) => [k * (iw / 2 - 2), yTop - 300 + T / 2 + 6, pz - 15 + j * (pd / 2 - 60)] as Vec3)), dir: [0, -1, 0] }),
        fx({ kind: "screw", len: 12, dia: 4, at: sx2.flatMap((k) => [-1, 1].map((j) => [k * (iw / 2), yTop - 300 + T / 2 + 10, pz - 15 + j * (pd / 2 - 60) + 12] as Vec3)), dir: [0, 0, 0] }),
      ].flatMap((f) => sx2.map((k) => { const at = f.at!.filter((p) => Math.sign(p[0]) === k); return { ...f, at, count: at.length, dir: (f.kind === "screw" ? [k, 0, 0] : [0, -1, 0]) as Vec3 }; })),
      tools: ["screwdriver"],
    },
    {
      title: "Hang the clothes rail",
      detail: "Screw a rail holder inside each side under the top shelf, then press the rail down into them.",
      add: ["rail"],
      fix: [
        ...sx2.map((k) => fx({ kind: "hook", name: "Rail holder", len: 40, dia: 30, at: [[k * (iw / 2), yTop - 380, -20]], dir: [k, 0, 0], on: k < 0 ? "L" : "R" })),
        ...sx2.map((k) => fx({ kind: "screw", len: 16, dia: 4, at: [[k * (iw / 2), yTop - 350, -20]], dir: [k, 0, 0], on: k < 0 ? "L" : "R" })),
      ],
      from: { rail: [0, 200, 0] },
      tools: ["screwdriver"],
    },
    {
      title: "Screw the hinge plates to the sides",
      detail: "Three inside each side at the front, two screws each.",
      fix: sx2.flatMap((k) => [
        fx({ kind: "plate", name: "Mounting plate", len: 12, dia: 36, at: hy.map((y) => [k * (iw / 2), y, zF - 40] as Vec3), dir: [k, 0, 0], on: k < 0 ? "L" : "R" }),
        fx({ kind: "screw", len: 14, dia: 4, at: hy.flatMap((y) => [-16, 16].map((dy2) => [k * (iw / 2), y + dy2, zF - 40] as Vec3)), dir: [k, 0, 0], on: k < 0 ? "L" : "R" }),
      ]),
      tools: ["screwdriver"],
    },
    {
      title: "Screw the hinges into the doors",
      detail: "Lay the doors face down. Three hinges on each, near the outer edge, two screws each.",
      add: ["DL", "DR"],
      from: { DL: [0, 0, 500], DR: [0, 0, 500] },
      fix: sx2.flatMap((k) => [
        fx({ kind: "hinge", at: hy.map((y) => [k * (iw / 2 - 25), y, zF - T] as Vec3), dir: [0, 0, 1], on: k < 0 ? "DL" : "DR" }),
        fx({ kind: "screw", len: 14, dia: 4, at: hy.flatMap((y) => [-22, 22].map((dy2) => [k * (iw / 2 - 25), y + dy2, zF - T] as Vec3)), dir: [0, 0, 1], on: k < 0 ? "DL" : "DR" }),
      ]),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Hang the doors", detail: "Hook each hinge onto its plate and press until it clicks. Turn the hinge screws to line the doors up.", kind: "hinges", people: 2, warnings: ["two"] },
    {
      title: "Fit the knobs and the door buffers",
      detail: "A knob on each door near the middle, screwed from inside. Then press the four buffers in where the doors close.",
      fix: [
        ...sx2.map((k) => fx({ kind: "knob", at: [[k * 60, dy + 60, zF + 6]], dir: [0, 0, -1], on: k < 0 ? "DL" : "DR" })),
        fx({ kind: "screw", len: 30, dia: 4, at: sx2.map((k) => [k * 60, dy + 60, zF - T] as Vec3), dir: [0, 0, 1] }),
        fx({ kind: "glide", name: "Door buffer", len: 3, dia: 10, at: [yBot + T / 2, yTop - T / 2].flatMap((y) => sx2.map((k) => [k * (iw / 2 - 40), y, zF - T - 4] as Vec3)), dir: [0, 0, -1] }),
      ],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps };
}

interface Cot {
  L: number; // outside length
  Wd: number;
  H: number;
  crib: boolean;
}

/** Cot and crib: two spindle sides between two ends, with the base on hooks (cot) or hangers (crib). */
function cot(c: Cot): CustomParams {
  const { L, Wd, H, crib } = c;
  const PT = 40; // end posts
  const Lin = L - 2 * PT;
  const xe = L / 2 - PT / 2;
  const zr = Wd / 2 - 12 - 8; // rails sit inside the posts
  const yR0 = 200, yR1 = H - 120; // spindle sides: bottom and top rail
  const yBase = crib ? 380 : 420;
  const rail = 40;
  const spindles = 16;
  const sideH = yR1 - yR0 + rail;
  const sidePieces: PartPiece[] = [
    { shape: "box", size: [Lin, rail, 24], pos: [0, sideH / 2 - rail / 2, 0] },
    { shape: "box", size: [Lin, rail, 24], pos: [0, -sideH / 2 + rail / 2, 0] },
    ...Array.from({ length: spindles }, (_, i): PartPiece => ({ shape: "cyl", size: [22, sideH - 2 * rail, 22], pos: [-Lin / 2 + ((i + 0.5) * Lin) / spindles, 0, 0] })),
  ];
  const endPieces: PartPiece[] = [
    ...sx2.map((k): PartPiece => ({ shape: "box", size: [PT, H - 30, PT], pos: [0, -15, k * (Wd / 2 - PT / 2)] })),
    { shape: "box", size: [20, H - 160, Wd - 2 * PT], pos: [0, 50, 0] },
    { shape: "box", size: [PT, 40, Wd - 2 * PT], pos: [0, H / 2 - 40, 0] },
    { shape: "box", size: [PT, 60, Wd * 0.5], pos: [0, H / 2 - 10, 0] },
  ];
  const basePieces: PartPiece[] = [
    ...sx2.map((k): PartPiece => ({ shape: "box", size: [Lin - 4, 40, 25], pos: [0, 0, k * (Wd / 2 - 20 - 12.5 - 20)] })),
    ...Array.from({ length: 14 }, (_, i): PartPiece => ({ shape: "box", size: [60, 10, Wd - 100], pos: [-Lin / 2 + 50 + (i * (Lin - 100)) / 13, 15, 0] })),
  ];
  const parts: CustomPart[] = [
    { id: "E1", name: crib ? "End panel" : "End panel", size: [PT, H, Wd], pos: [-xe, H / 2, 0], pieces: endPieces },
    { id: "S1", name: "Spindle side", size: [Lin, sideH, 24], pos: [0, (yR0 + yR1) / 2, -zr], pieces: sidePieces },
    { id: "S2", name: "Spindle side", size: [Lin, sideH, 24], pos: [0, (yR0 + yR1) / 2, zr], pieces: sidePieces },
    { id: "E2", name: "End panel", size: [PT, H, Wd], pos: [xe, H / 2, 0], pieces: endPieces },
    { id: "base", name: "Bed base", size: [Lin - 4, 40, Wd - 2 * 20 - 24], pos: [0, yBase, 0], pieces: basePieces, material: "wood" },
  ];
  const ry = [yR1, yR0];
  const ends = (e: number) => ry.flatMap((y) => sx2.map((k) => [e * (Lin / 2), y, k * zr] as Vec3));
  const dowels = sx2.map((e) => fx({ kind: "dowel", len: 30, dia: 10, at: ends(e), dir: [-e, 0, 0] }));
  const bolts = (e: number) => [
    fx({ kind: "bolt", name: "Bolt", len: 100, dia: 6, at: ry.flatMap((y) => sx2.map((k) => [e * (L / 2), y, k * zr] as Vec3)), dir: [-e, 0, 0], on: e < 0 ? "E1" : "E2" }),
    ...sx2.map((k) => fx({ kind: "nut", name: "Barrel nut", len: 14, dia: 10, at: ry.map((y) => [e * (Lin / 2 - 50), y, k * (zr - 12)] as Vec3), dir: [0, 0, k], on: k < 0 ? "S1" : "S2" })),
  ];
  const xIn = Lin / 2;
  const corners = (y: number) => sx2.flatMap((e) => sx2.map((k) => [e * xIn, y, k * (Wd / 2 - PT - 30)] as Vec3));
  const steps: CustomStep[] = [
    {
      title: "Tap dowels into the spindle sides and push them into one end",
      detail: "One dowel into each rail end, on a rug. Then push one end of both sides into the end panel.",
      add: ["E1", "S1", "S2"],
      fix: [dowels[0], dowels[1]],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    { title: "Bolt the sides to the end", detail: "A barrel nut into each rail, slot facing the bolt, then the bolts through the end panel. Not too tight yet.", fix: bolts(-1), tools: ["allen", "flathead"] },
    { title: "Stand it on that end and put the other end on", detail: "Lower the second end onto the dowels.", add: ["E2"], pose: "+x", people: 2, warnings: ["two"] },
    { title: "Bolt on the second end", detail: "Barrel nuts first, then the four bolts.", fix: bolts(1), tools: ["allen", "flathead"] },
  ];
  if (crib) {
    const pegs = (e: number) => fx({ kind: "stud", name: "Hanger peg", len: 20, dia: 8, at: sx2.map((k) => [e * xIn, yBase - 60, k * (Wd / 2 - PT - 30)] as Vec3), dir: [e, 0, 0], on: e < 0 ? "E1" : "E2" });
    steps[2] = {
      title: "Stand it on that end and hang the base on",
      detail: "Bolt a hanger to each corner of the base. Screw two pegs into the end, then hook the base's hangers over them.",
      add: ["base"],
      fix: [
        ...sx2.map((e) => fx({ kind: "hook", name: "Base hanger", len: 80, dia: 20, at: sx2.map((k) => [e * (xIn - 10), yBase - 40, k * (Wd / 2 - PT - 30)] as Vec3), dir: [0, 1, 0], on: "base" })),
        fx({ kind: "bolt", len: 30, dia: 6, at: corners(yBase + 20).map((p) => [p[0] - Math.sign(p[0]) * 10, p[1], p[2]] as Vec3), dir: [0, -1, 0], on: "base" }),
        pegs(-1),
      ],
      tools: ["allen"],
      pose: "+x",
      people: 2,
      warnings: ["two"],
    };
    steps[3] = { title: "Put the other end on and bolt it", detail: "Two pegs into it for the hangers, lower it onto the dowels, then the barrel nuts and four bolts.", add: ["E2"], fix: [pegs(1), ...bolts(1)], tools: ["allen", "flathead"] };
    steps.push(
      { title: "Tap in the base locks and stand it up", detail: "Four, into the holes inside the ends, with a hammer. Then turn it upright together.", fix: [fx({ kind: "clip", name: "Base lock", len: 20, dia: 24, at: corners(yBase - 20), dir: [0, 0, 0] })].flatMap((f) => sx2.map((e) => { const at = f.at!.filter((p) => Math.sign(p[0]) === e); return { ...f, at, count: at.length, dir: [e, 0, 0] as Vec3 }; })), tools: ["hammer"], pose: "+y", people: 2, warnings: ["two"] },
      { title: "Screw on the side locks", detail: "One at each end of the bottom rails, through the lock into the post.", fix: [fx({ kind: "clip", name: "Side lock", len: 20, dia: 16, at: ends(-1).concat(ends(1)).filter((p) => p[1] === yR0).map((p) => [p[0], p[1] + 30, p[2] * 1.06] as Vec3), dir: [0, 0, 0] })].flatMap((f) => sx2.map((k) => { const at = f.at!.filter((p) => Math.sign(p[2]) === k); return { ...f, at, count: at.length, dir: [0, 0, -k] as Vec3 }; })).concat([fx({ kind: "screw", len: 16, dia: 4, at: ends(-1).concat(ends(1)).filter((p) => p[1] === yR0).map((p) => [p[0], p[1] + 30, p[2] * 1.06] as Vec3), dir: [0, 0, 0] })].flatMap((f) => sx2.map((k) => { const at = f.at!.filter((p) => Math.sign(p[2]) === k); return { ...f, at, count: at.length, dir: [0, 0, -k] as Vec3 }; }))), tools: ["screwdriver"] },
    );
  } else {
    steps.push(
      {
        title: "Tap in the base supports and stand it up",
        detail: "Four, into the holes inside the ends, with a hammer. Then turn it upright together.",
        fix: sx2.map((e) => fx({ kind: "clip", name: "Base support", len: 20, dia: 30, at: sx2.map((k) => [e * xIn, yBase - 20, k * (Wd / 2 - PT - 30)] as Vec3), dir: [e, 0, 0], on: e < 0 ? "E1" : "E2" })),
        tools: ["hammer"],
        pose: "+y",
        people: 2,
        warnings: ["two"],
      },
      {
        title: "Push the hooks into the ends",
        detail: "Four, into the holes for the height you want, threaded end inwards.",
        fix: sx2.map((e) => fx({ kind: "hook", name: "Base hook", len: 60, dia: 12, at: sx2.map((k) => [e * xIn, yBase - 26, k * (Wd / 2 - PT - 60)] as Vec3), dir: [e, 0, 0], on: e < 0 ? "E1" : "E2" })),
      },
      { title: "Lower the base in", detail: "Slats up, so its corners rest on the hooks.", add: ["base"], from: { base: [0, 500, 0] } },
      { title: "Bolt the base to the hooks", detail: "One bolt down through each corner into its hook.", fix: [fx({ kind: "bolt", len: 20, dia: 6, at: corners(yBase + 20).map((p) => [p[0] - Math.sign(p[0]) * 20, p[1], p[2]] as Vec3), dir: [0, -1, 0], on: "base" })], tools: ["allen"] },
      {
        title: "Screw on the side locks",
        detail: "One at each end of the bottom rails, through the lock into the post.",
        fix: sx2.flatMap((k) => [
          // on the outside of the bottom rail: the lock, and its screw beside it into the rail
          fx({ kind: "clip", name: "Side lock", len: 20, dia: 16, at: sx2.map((e) => [e * (Lin / 2 - 42), yR0 - 8, k * (zr + 12)] as Vec3), dir: [0, 0, -k], on: k < 0 ? "S1" : "S2" }),
          fx({ kind: "screw", len: 16, dia: 4, at: sx2.map((e) => [e * (Lin / 2 - 20), yR0 + 8, k * (zr + 14)] as Vec3), dir: [0, 0, -k], on: k < 0 ? "S1" : "S2" }),
        ]),
        tools: ["screwdriver"],
      },
    );
  }
  steps.push({ title: "Tighten all the bolts", detail: "All eight in the ends, now that everything sits square. Check again now and then.", tools: ["allen"], check: "square" });
  return { parts, steps };
}

/** The desk frame (rails bolted between the sides); the top and upstand are built apart and put on after. */
function deskGeo(s: ProductSpec) {
  const W = s.size.w * 10 || 930, H = s.size.h * 10 || 880, D = s.size.d * 10 || 510;
  const T = 18, G = 4, TT = 22;
  const yT0 = 696; // underside of the top
  const xs = W / 2 - T / 2, iw = W - 2 * T;
  const Ds = D - 10;
  const zs = -D / 2 + Ds / 2;
  return { W, H, D, T, G, TT, yT0, xs, iw, Ds, zs };
}

function deskFrame(s: ProductSpec): CustomParams {
  const { D, T, G, yT0, xs, iw, Ds, zs } = deskGeo(s);
  const apron: PartPiece[] = [
    { shape: "box", size: [iw, 50, T], pos: [0, 25, 0] },
    { shape: "box", size: [iw * 0.2, 50, T], pos: [-iw * 0.4, -25, 0] },
    { shape: "box", size: [iw * 0.2, 50, T], pos: [iw * 0.4, -25, 0] },
  ];
  const rails = [
    { id: "apron", name: "Front rail", h: 100, z: D / 2 - 40, y: yT0 - 50, d: 1 },
    { id: "backTop", name: "Back rail", h: 80, z: -D / 2 + 20, y: yT0 - 40, d: 1 },
    { id: "lower", name: "Lower rail", h: 160, z: -D / 2 + 100, y: 380, d: 2 },
  ];
  const parts: CustomPart[] = [
    ...rails.map((r): CustomPart => ({ id: r.id, name: r.name, size: [iw, r.h, T], pos: [0, r.y, r.z], pieces: r.id === "apron" ? apron : undefined })),
    { id: "L", name: "Side panel", size: [T, yT0 - G, Ds], pos: [-xs, G + (yT0 - G) / 2, zs] },
    { id: "R", name: "Side panel", size: [T, yT0 - G, Ds], pos: [xs, G + (yT0 - G) / 2, zs] },
  ];
  const dowels = sx2.flatMap((e) =>
    rails.map((r) => fx({ kind: "dowel", at: (r.d === 2 ? [r.y - r.h / 4, r.y + r.h / 4] : [r.y]).map((y) => [e * (iw / 2), y, r.z] as Vec3), dir: [-e, 0, 0], on: r.id })),
  );
  const bolts = (e: number): CustomFix[] => [
    fx({ kind: "bolt", name: "Connector bolt", len: 90, dia: 6, at: rails.flatMap((r) => [-r.h / 2 + 20, r.h / 2 - 20].map((dy) => [e * (iw / 2 + T), r.y + dy, r.z] as Vec3)), dir: [-e, 0, 0], on: e < 0 ? "L" : "R" }),
    fx({ kind: "nut", name: "Barrel nut", len: 14, dia: 10, at: rails.flatMap((r) => [-r.h / 2 + 20, r.h / 2 - 20].map((dy) => [e * (iw / 2 - 45), r.y + dy, r.z - T / 2] as Vec3)), dir: [0, 0, 1] }),
  ];
  const glides = (e: number) => fx({ kind: "glide", name: "Glide", len: G, dia: 14, at: sx2.map((k) => [e * xs, 0, zs + k * (Ds / 2 - 40)] as Vec3), dir: [0, 1, 0], on: e < 0 ? "L" : "R" });
  const steps: CustomStep[] = [
    {
      title: "Tap the glides into the sides",
      detail: "Lay the sides on a rug. Two glides into the bottom edge of each, with a hammer.",
      add: ["L"],
      fix: [glides(-1)],
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Tap dowels into the rails and push them into a side",
      detail: "Two dowels into each end of the lower rail, one into each end of the others. One of you holds the side upright.",
      add: rails.map((r) => r.id),
      fix: dowels,
      tools: ["hammer"],
      people: 2,
      warnings: ["two"],
    },
    { title: "Bolt the rails to the side", detail: "A barrel nut into each rail, slot towards the bolt, then six long bolts through the side with the Allen key.", fix: bolts(-1), tools: ["allen", "flathead"] },
    { title: "Fit the other side", detail: "Its glides in first, then onto the dowels at the other ends of the rails.", add: ["R"], fix: [glides(1)], people: 2, warnings: ["two"] },
    { title: "Bolt it on", detail: "Six more barrel nuts and bolts. Tighten them all.", fix: bolts(1), tools: ["allen", "flathead"], check: "square" },
  ];
  return { parts, steps };
}

const CAM_BOLT: HwDef = { kind: "camScrew", len: 30, dia: 8 };
const ALLEN_SCREW: HwDef = { kind: "bolt", len: 40, dia: 6, name: "Allen screw" };

/** The top and its upstand, built upside down on a table, then turned over onto the frame. */
function deskTop(b: PlanBuilder, s: ProductSpec) {
  const { W, H, D, T, TT, yT0, xs, iw, Ds, zs } = deskGeo(s);
  const yT1 = yT0 + TT;
  const uh = H - yT1, ed = 90;
  const top = b.place(b.part("Top", [W, TT, D]), [0, yT0 + TT / 2, 0]);
  const board = b.place(b.compound("Upstand", [
    { shape: "box", size: [W - 2 * T, uh * 0.7, T], pos: [0, -uh * 0.15, 0] },
    { shape: "box", size: [(W - 2 * T) * 0.5, uh * 0.3, T], pos: [0, uh * 0.35, 0] },
    { shape: "box", size: [(W - 2 * T) * 0.12, uh * 0.3, T], pos: [-(W - 2 * T) * 0.44, uh * 0.35, 0] },
    { shape: "box", size: [(W - 2 * T) * 0.12, uh * 0.3, T], pos: [(W - 2 * T) * 0.44, uh * 0.35, 0] },
  ]).type, [0, yT1 + uh / 2, -D / 2 + T / 2]);
  const endT = b.part("Upstand end", [T, uh - 20, ed]);
  const ends = sx2.map((k) => b.place(endT, [k * (W / 2 - T / 2), yT1 + (uh - 20) / 2, -D / 2 + ed / 2]));
  const all = [top, board, ...ends];
  const c0: Vec3 = [0, yT0, 0];
  const stage = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
  };
  const yU = yT1 + uh / 2 - 20;
  b.step({ title: "Screw the cam bolts into the upstand", detail: "Lay it on a rug. One at each end of its front face.", scene: "top", kind: "cams", tools: ["screwdriver"], warnings: ["floor"] }, () => {
    stage(board, [0, 160, 0]);
    b.then(0.15);
    b.fits(CAM_BOLT, sx2.map((k): FitOpts => ({ on: board, at: [k * (W / 2 - T - 40), yU, -D / 2 + T], dir: [0, 0, -1] })), 0.1);
  });
  b.step({ title: "Fit the end pieces", detail: "Two dowels into each end of the upstand, then push an end piece onto each.", scene: "top", kind: "dowels", tools: ["hammer"] }, () => {
    b.fits(HW.dowel, sx2.flatMap((k) => [yU - 40, yU + 30].map((y): FitOpts => ({ on: board, at: [k * (W / 2 - T), y, -D / 2 + T / 2], dir: [-k, 0, 0], mate: ends[k < 0 ? 0 : 1] }))), 0.08);
    b.then(0.15);
    ends.forEach((e, i) => stage(e, [sx2[i] * 200, 0, 0])); // along the dowels
  });
  b.step({ title: "Lock the end pieces", detail: "One cam lock in each, arrow towards the bolt, then clockwise.", scene: "top", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(HW.cam, sx2.map((k): FitOpts => ({ on: ends[k < 0 ? 0 : 1], at: [k * (W / 2 - T), yU, -D / 2 + T + 30], dir: [k, 0, 0] })), 0.1);
  });
  b.step({ title: "Screw the upstand to the top", detail: "Lay the top face down on a table with its back edge against the upstand. Four Allen screws through the top into it.", scene: "top", kind: "bolts", tools: ["allen"] }, () => {
    stage(top, [0, -160, 0]);
    b.then(0.15);
    b.fits(ALLEN_SCREW, [...[-W / 4, W / 4].map((x): Vec3 => [x, yT0, -D / 2 + T / 2]), ...sx2.map((k): Vec3 => [k * (W / 2 - T / 2), yT0, -D / 2 + ed / 2])].map((at): FitOpts => ({ on: top, at, dir: [0, 1, 0] })), 0.1);
  });
  // ten cam bolts under the top: three over each side, two over each rail
  const rails: [number, number][] = [[-W / 4, D / 2 - 40], [W / 4, D / 2 - 40], [-W / 4, -D / 2 + 20], [W / 4, -D / 2 + 20]];
  const sides: [number, number][] = sx2.flatMap((k) => [-1, 0, 1].map((j): [number, number] => [k * xs, zs + j * (Ds / 2 - 50)]));
  const pts: [number, number][] = [...sides, ...rails];
  b.step({ title: "Screw the cam bolts into the top", detail: "Turn it upside down. Ten, into the holes on its underside.", scene: "top", kind: "cams", tools: ["screwdriver"], pose: "-y" }, () => {
    b.fits(CAM_BOLT, pts.map(([x, z]): FitOpts => ({ on: top, at: [x, yT0, z], dir: [0, 1, 0] })), 0.06);
  });
  const sideKeys = sx2.map((k) => keyAt(b, [k * xs, 4 + (yT0 - 4) / 2, zs]));
  const railKeys = [keyAt(b, [0, yT0 - 50, D / 2 - 40]), keyAt(b, [0, yT0 - 40, -D / 2 + 20])];
  const hostOf = (x: number, z: number) => (Math.abs(Math.abs(x) - xs) < 1 ? sideKeys[x < 0 ? 0 : 1] : railKeys[z > 0 ? 0 : 1]);
  b.step({ title: "Tap dowels into the frame and put the top on", detail: "Ten dowels into the top edges of the sides and rails. Turn the top over and lower it on together.", kind: "join", tools: ["hammer"], people: 2, warnings: ["two"], pose: "+y" }, () => {
    b.fits(HW.dowel, pts.map(([x, z]): FitOpts => ({ on: hostOf(x, z), at: [x + (Math.abs(Math.abs(x) - xs) < 1 ? 0 : 60), yT0, z + (Math.abs(Math.abs(x) - xs) < 1 ? 25 : 0)], dir: [0, -1, 0] })), 0.05);
    b.then(0.15);
    b.stagger(0);
    for (const k of all) b.add(k, [0, 320, 0]);
  });
  b.step({ title: "Turn the cam locks", detail: "Ten, inside the sides and the rails just under the top. Arrow towards the bolt, then clockwise.", kind: "cams", tools: ["screwdriver"] }, () => {
    b.fits(
      HW.cam,
      pts.map(([x, z]): FitOpts => {
        const side = Math.abs(Math.abs(x) - xs) < 1;
        return side ? { on: hostOf(x, z), at: [x - Math.sign(x) * (T / 2), yT0 - 30, z], dir: [Math.sign(x), 0, 0] } : { on: hostOf(x, z), at: [x, yT0 - 30, z - (z > 0 ? T / 2 : -T / 2)], dir: [0, 0, z > 0 ? 1 : -1] };
      }),
      0.05,
    );
  });
  b.step({ title: "Press in the cable grommet", detail: "Into the round hole at the back of the top.", kind: "general" }, () => {
    b.fit({ kind: "cap", len: 20, dia: 60, name: "Cable grommet" }, { on: top, at: [0, yT0 + TT, -D / 2 + 70], dir: [0, -1, 0], hole: false });
  });
  b.step({ title: "Fit the bag knob to a side", detail: "On whichever side you like: the pin from inside, the knob from outside, joined with the screw.", kind: "screws", tools: ["screwdriver"] }, () => {
    const at: Vec3 = [xs + T / 2, yT0 - 150, zs + Ds / 2 - 80];
    b.fit({ ...HW.knob, len: 30, dia: 34, name: "Bag knob" }, { on: sideKeys[1], at, dir: [-1, 0, 0], hole: false });
    b.fit({ kind: "screw", len: 25, dia: 4 }, { on: sideKeys[1], at: [at[0] + 30, at[1], at[2]], dir: [-1, 0, 0] });
    b.fit({ kind: "stud", len: 20, dia: 8, name: "Knob pin" }, { on: sideKeys[1], at: [xs - T / 2, at[1], at[2]], dir: [1, 0, 0] });
  });
}

/** The changing table: a bookshelf built lying on a side, then a tray with rims screwed together and bolted on top. */
function changingTable(s: ProductSpec): CustomParams {
  // IKEA: 60 wide, 81 deep and 103 high with the tray; the bookshelf alone is 40 deep and 90 high
  const W = Math.min(s.size.w, s.size.d) * 10 || 600, T = 16, G = 3; // the catalog has 81 as the width; it is the depth
  const Hb = 900, z0 = -405, z1 = z0 + 400; // the bookshelf stands against the wall, the tray reaches forward
  const xs = W / 2 - T / 2, xi = W / 2 - T;
  const yBot = 80, ySh = 480, yTop = Hb - T;
  const yF = Hb + T, yR = 1030; // the tray's floor boards lie on the bookshelf, the rims stand on them
  const zT1 = -z0; // the tray's front edge
  const zM = z0 + 400, zA = zT1 - 100; // floor, middle board and front board, back to front
  const B = (id: string, name: string, x0: number, x1: number, y0: number, y1: number, za: number, zb: number, material?: CustomPart["material"]): CustomPart => ({
    id,
    name,
    size: [x1 - x0, y1 - y0, zb - za],
    pos: [(x0 + x1) / 2, (y0 + y1) / 2, (za + zb) / 2],
    ...(material ? { material } : {}),
  });
  const rimPieces = (): PartPiece[] => {
    const L = zT1 - z0, yc = (yF + yR) / 2, y1 = yF + 60;
    return [
      { shape: "box", size: [T, y1 - yF, L], pos: [0, (yF + y1) / 2 - yc, 0] },
      { shape: "box", size: [T, yR - y1, L * 0.55], pos: [0, (y1 + yR) / 2 - yc, -L / 2 + L * 0.275] },
      { shape: "box", size: [T, (yR - y1) * 0.5, L * 0.45], pos: [0, y1 + (yR - y1) * 0.25 - yc, L / 2 - L * 0.225] },
    ];
  };
  const parts: CustomPart[] = [
    B("L", "Side panel", -W / 2, -xi, G, yTop, z0, z1),
    B("R", "Side panel", xi, W / 2, G, yTop, z0, z1),
    B("PL", "Plinth", -xi, xi, G + 10, yBot + T / 2, z1 - T, z1), // in front of the bottom's edge
    B("BOT", "Bottom", -xi, xi, yBot - T / 2, yBot + T / 2, z0 + 8, z1 - T),
    B("FOOT", "Back support", -T / 2, T / 2, G, yBot - T / 2, z0 + 8, z0 + 200),
    B("SH", "Shelf", -xi, xi, ySh, ySh + T, z0 + 8, z1),
    B("BK", "Back panel", -xi, xi, yBot - T / 2, yTop, z0 + 5, z0 + 8, "fiber"),
    B("TOP", "Top", -W / 2, W / 2, yTop, Hb, z0, z1),
    B("TB", "Tray back rim", -xi, xi, yF, yR - 30, z0, z0 + T),
    { id: "TL", name: "Tray side rim", size: [T, yR - yF, zT1 - z0], pos: [-xs, (yF + yR) / 2, (z0 + zT1) / 2], pieces: rimPieces() },
    { id: "TR", name: "Tray side rim", size: [T, yR - yF, zT1 - z0], pos: [xs, (yF + yR) / 2, (z0 + zT1) / 2], pieces: rimPieces() },
    B("TF", "Tray floor", -W / 2, W / 2, Hb, yF, z0, zM),
    B("TA", "Tray front board", -W / 2, W / 2, Hb, yF, zA, zT1),
    B("TG", "Tray middle board", -xi, xi, Hb, yF, zM, zA),
  ];
  const side = (sx: number) => (sx < 0 ? "L" : "R");
  const tray = ["TB", "TL", "TR", "TF", "TA", "TG"];
  const aside = Object.fromEntries(tray.map((id) => [id, [800, 0, 0] as Vec3]));
  const zs = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * (i + 0.5)) / n);
  const bolts = (sx: number, y: number, n: number) => zs(z0 + 30, z1 - 30, n).map((z): Vec3 => [sx * xi, y, z]);
  const camAt = (y: number, zz: number[], up: boolean, on: string): CustomFix[] => sx2.map((sx) => fx({ kind: "cam", on, dir: [0, up ? 1 : -1, 0], at: zz.map((z): Vec3 => [sx * (xi - 34), y, z]) }));
  const DOW = { len: 30, dia: 8 };
  const LONG = { len: 50, dia: 7, name: "Allen screw" };
  const steps: CustomStep[] = [
    {
      title: "Screw ten cam bolts into the side panels",
      detail: "Lay both sides on a rug, inside up. Five in each, by hand until they stop.",
      wait: ["L", "R"],
      fix: sx2.map((sx) => fx({ kind: "camScrew", on: side(sx), dir: [-sx, 0, 0], at: [...bolts(sx, yBot, 2), ...bolts(sx, ySh + T / 2, 2), [sx * xi, yBot - 30, z1 - 8]], len: 34, dia: 7 })),
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    { title: "Push the glides into the bottom of the sides", detail: "Two in each side's bottom edge.", fix: sx2.map((sx) => fx({ kind: "glide", on: side(sx), dir: [0, 1, 0], at: [[sx * xs, G, z0 + 50], [sx * xs, G, z1 - 50]], len: 3, dia: 20, name: "Glide" })) },
    { title: "Tap six dowels into the bottom", detail: "Two along the front edge for the plinth, two in each end.", add: ["BOT"], fix: [fx({ kind: "dowel", on: "BOT", mate: "PL", dir: [0, 0, 1], at: [[-150, yBot, z1 - T], [150, yBot, z1 - T]], ...DOW }), ...sx2.map((sx) => fx({ kind: "dowel", on: "BOT", mate: side(sx), dir: [sx, 0, 0], at: [[sx * xi, yBot, z0 + 80], [sx * xi, yBot, z1 - 80]], ...DOW }))], tools: ["hammer"] },
    { title: "Screw four cam bolts in", detail: "Two into the back of the plinth, two into the bottom's underside.", fix: [fx({ kind: "camScrew", on: "PL", mate: "BOT", dir: [0, 0, 1], at: [[-200, yBot, z1 - T], [200, yBot, z1 - T]], len: 34, dia: 7 }), fx({ kind: "camScrew", on: "BOT", dir: [0, 1, 0], at: [[0, yBot - T / 2, z0 + 60], [0, yBot - T / 2, z0 + 160]], len: 34, dia: 7 })], tools: ["screwdriver"] , wait: ["PL"] },
    { title: "Push the plinth onto the bottom", detail: "Along the front edge, curved edge down.", add: ["PL"] },
    { title: "Lock it with two cam locks", detail: "In the bottom, clockwise until tight.", fix: [fx({ kind: "cam", on: "BOT", dir: [0, -1, 0], at: [[-200, yBot + T / 2, z1 - T - 34], [200, yBot + T / 2, z1 - T - 34]] })], tools: ["screwdriver"] },
    { title: "Tap a dowel into the back support", detail: "Into its top edge.", fix: [fx({ kind: "dowel", on: "FOOT", mate: "BOT", dir: [0, -1, 0], at: [[0, yBot - T / 2, z0 + 110]], ...DOW })], tools: ["hammer"], wait: ["FOOT"] },
    { title: "Push a glide into its bottom", fix: [fx({ kind: "glide", on: "FOOT", dir: [0, 1, 0], at: [[0, G, z0 + 110]], len: 3, dia: 20, name: "Glide" })] },
    { title: "Stand the back support under the bottom", detail: "At the middle of the back edge, onto the bolts.", add: ["FOOT"], from: { FOOT: [0, -250, 0] } },
    { title: "Lock it with two cam locks", detail: "In the back support, one each side of the bolts.", fix: [fx({ kind: "cam", on: "FOOT", dir: [1, 0, 0], at: [[-T / 2, yBot - 40, z0 + 60], [-T / 2, yBot - 40, z0 + 160]] })], tools: ["screwdriver"] },
    { title: "Stand the bottom on one side panel", detail: "Lay the left side flat and push the bottom onto its dowels and bolts.", pose: "+x", add: ["L"] },
    { title: "Turn three cam locks", detail: "Two in the bottom, one in the plinth.", fix: [fx({ kind: "cam", on: "BOT", dir: [0, -1, 0], at: bolts(-1, yBot + T / 2, 2).map((p): Vec3 => [-(xi - 34), p[1], p[2]]) }), fx({ kind: "cam", on: "PL", dir: [0, 0, 1], at: [[-(xi - 34), yBot - 30, z1 - T]] })], tools: ["screwdriver"] },
    { title: "Tap four dowels into the shelf", detail: "Two in each end.", fix: sx2.map((sx) => fx({ kind: "dowel", on: "SH", mate: side(sx), dir: [sx, 0, 0], at: [[sx * xi, ySh + T / 2, z0 + 80], [sx * xi, ySh + T / 2, z1 - 80]], ...DOW })), tools: ["hammer"], wait: ["SH"] },
    { title: "Push the shelf into the side panel", add: ["SH"] },
    { title: "Lock it with two cam locks", fix: camAt(ySh, bolts(-1, 0, 2).map((p) => p[2]), false, "SH").slice(0, 1), tools: ["screwdriver"] },
    { title: "Put the other side panel on", detail: "Line it up over all the dowels and bolts and press it down.", add: ["R"], people: 2, warnings: ["two"] },
    { title: "Turn five cam locks", detail: "Two in the bottom, one in the plinth, two in the shelf.", fix: [fx({ kind: "cam", on: "BOT", dir: [0, -1, 0], at: bolts(1, yBot + T / 2, 2).map((p): Vec3 => [xi - 34, p[1], p[2]]) }), fx({ kind: "cam", on: "PL", dir: [0, 0, 1], at: [[xi - 34, yBot - 30, z1 - T]] }), ...camAt(ySh, bolts(1, 0, 2).map((p) => p[2]), false, "SH").slice(1)], tools: ["screwdriver"] },
    { title: "Stand it up and slide the back in", detail: "Down the grooves at the back, cut-outs at the top.", add: ["BK"], pose: "+y", from: { BK: [0, 700, 0] } },
    { title: "Screw the back on", detail: "Six screws: two into the bottom, two into the shelf, two into the back support.", fix: [fx({ kind: "screw", on: "BK", dir: [0, 0, 1], at: [[-150, yBot, z0 + 5], [150, yBot, z0 + 5], [-150, ySh + 8, z0 + 5], [150, ySh + 8, z0 + 5], [0, 40, z0 + 5], [0, 65, z0 + 5]], len: 16, dia: 4 })], tools: ["screwdriver"] },
    { title: "Tap dowels into the top edges of the sides", detail: "Two in each.", fix: sx2.map((sx) => fx({ kind: "dowel", on: side(sx), mate: "TOP", dir: [0, -1, 0], at: [[sx * xs, yTop, z0 + 60], [sx * xs, yTop, z1 - 60]], ...DOW })), tools: ["hammer"] },
    { title: "Screw four cam bolts into the top", detail: "Lay it face down; two near each end.", fix: [fx({ kind: "camScrew", on: "TOP", dir: [0, 1, 0], at: sx2.flatMap((sx) => [[sx * xs, yTop, z0 + 120], [sx * xs, yTop, z1 - 120]] as Vec3[]), len: 34, dia: 7 })], tools: ["screwdriver"], wait: ["TOP"] },
    { title: "Put the top on", add: ["TOP"], from: { TOP: [0, 300, 0] } },
    { title: "Lock the top with four cam locks", detail: "In the sides, just under the top.", fix: sx2.map((sx) => fx({ kind: "cam", on: side(sx), dir: [-sx, 0, 0], at: [[sx * xi, yTop - 34, z0 + 120], [sx * xi, yTop - 34, z1 - 120]] })), tools: ["screwdriver"] },
    { title: "Tap dowels into the tray's back rim", detail: "Now the tray. Two in each end of the back rim.", fix: sx2.map((sx) => fx({ kind: "dowel", on: "TB", mate: sx < 0 ? "TL" : "TR", dir: [sx, 0, 0], at: [[sx * xi, yF + 25, z0 + 8], [sx * xi, yR - 60, z0 + 8]], ...DOW })), wait: tray, from: aside, tools: ["hammer"] },
    { title: "Screw the side rims to the back rim", detail: "One long screw through each side rim, with the Allen key.", fix: sx2.map((sx) => fx({ kind: "bolt", on: sx < 0 ? "TL" : "TR", mate: "TB", dir: [-sx, 0, 0], at: [[sx * (W / 2), (yF + yR - 30) / 2, z0 + 8]], ...LONG })), tools: ["allen"] },
    { title: "Tap nine dowels into the rims", detail: "Turn the frame upside down, shaped edges on the floor. Three dowels in the edge of each rim.", fix: [fx({ kind: "dowel", on: "TB", mate: "TF", dir: [0, 1, 0], at: [[-150, yF, z0 + 8], [150, yF, z0 + 8], [0, yF, z0 + 8]], ...DOW }), ...sx2.flatMap((sx) => [fx({ kind: "dowel", on: sx < 0 ? "TL" : "TR", mate: "TF", dir: [0, 1, 0], at: [[sx * xs, yF, -300], [sx * xs, yF, -150]], ...DOW }), fx({ kind: "dowel", on: sx < 0 ? "TL" : "TR", mate: "TA", dir: [0, 1, 0], at: [[sx * xs, yF, zT1 - 50]], ...DOW })])], tools: ["hammer"] },
    { title: "Screw the tray floor on", detail: "Lay it over the rims' edges, onto the dowels, and drive six long screws through it into the rims.", fix: [fx({ kind: "bolt", on: "TF", dir: [0, 1, 0], at: [[-xs, Hb, -320], [-xs, Hb, -100], [xs, Hb, -320], [xs, Hb, -100], [-240, Hb, z0 + 8], [240, Hb, z0 + 8]], ...LONG })], tools: ["allen"] },
    { title: "Screw the front board on", detail: "Across the front ends of the rims, two long screws through it.", fix: [fx({ kind: "bolt", on: "TA", dir: [0, 1, 0], at: sx2.map((sx): Vec3 => [sx * xs, Hb, zT1 - 30]), ...LONG })], tools: ["allen"] },
    { title: "Fit the middle board", detail: "Two dowels into the floor's front edge, then press the middle board onto them.", fix: [fx({ kind: "dowel", on: "TF", mate: "TG", dir: [0, 0, -1], at: [[-150, Hb + T / 2, zM], [150, Hb + T / 2, zM]], ...DOW })], tools: ["hammer"] },
    {
      title: "Screw the two wall brackets under the tray",
      detail: "Turn the tray over. A washer and a screw for each bracket, its upright against the back rim.",
      fix: [fx({ kind: "angle", on: "TF", dir: [0, 1, 0], at: [[-150, Hb, z0 + 30], [150, Hb, z0 + 30]], len: 80, dia: 30, name: "Wall bracket", included: true }), fx({ kind: "washer", on: "TF", dir: [0, 1, 0], at: [[-150, Hb - 2, z0 + 60], [150, Hb - 2, z0 + 60]] }), fx({ kind: "screw", on: "TF", dir: [0, 1, 0], at: [[-150, Hb - 2, z0 + 60], [150, Hb - 2, z0 + 60]], len: 16, dia: 4 })],
      tools: ["screwdriver"],
    },
    { title: "Lay the tray on the bookshelf", detail: "Turn it right way up and set it on, flush with the back.", add: tray, from: Object.fromEntries(tray.map((id) => [id, [0, 400, 0] as Vec3])) },
    { title: "Bolt the tray on with the two plates", detail: "From underneath: each plate takes one bolt into the bookshelf top and one into a tray rim.", fix: [fx({ kind: "plate", on: "TOP", dir: [0, 1, 0], at: [[-xi + 40, yTop, -260], [xi - 40, yTop, -260]], len: 60, dia: 20, name: "Joining plate" }), fx({ kind: "bolt", on: "TOP", dir: [0, 1, 0], at: sx2.flatMap((sx) => [[sx * (xi - 40), yTop, -290], [sx * (xi - 40), yTop, -230]] as Vec3[]), len: 12, dia: 6, name: "Short bolt" })], tools: ["allen"] },
    { title: "Mark the wall through the brackets", detail: "Push the changing table against the wall, mark through both brackets.", tools: ["pencil", "level"], warnings: ["wall", "tip"] },
    { title: "Move it away and drill the holes", detail: "Pick plugs and screws made for your wall if the ones in the box don't suit it.", tools: ["drill"] },
    { title: "Push the wall plugs in", detail: "Tap them flush with the wall.", fix: [fx({ kind: "plug", dir: [0, 0, -1], at: [[-150, yF - 40, z0 - 2], [150, yF - 40, z0 - 2]], included: true })], tools: ["hammer"], wall: true },
    {
      title: "Screw it to the wall",
      detail: "Push it back, then a washer and a long screw through each bracket.",
      fix: [fx({ kind: "washer", on: "TF", dir: [0, 0, -1], at: [[-150, yF - 40, z0 + 2], [150, yF - 40, z0 + 2]] }), fx({ kind: "screw", on: "TF", dir: [0, 0, -1], at: [[-150, yF - 40, z0 + 2], [150, yF - 40, z0 + 2]], len: 50, dia: 5, included: true })],
      tools: ["screwdriver"],
      wall: true,
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["SMÅGÖRA", "SMAGORA", "SMÅGORA"],
  build(b, s) {
    if (!/smagora-desk/.test(s.slug ?? "")) return false;
    buildCustom(b, { ...s, custom: deskFrame(s) });
    deskTop(b, s);
    return true;
  },
  recipe(s) {
    const slug = s.slug ?? "";
    if (/smagora-shelf-unit/.test(slug)) return shelfUnit(s);
    if (/smagora-wardrobe/.test(slug)) return wardrobe(s);
    if (/smagora-cot/.test(slug)) return cot({ L: 1440, Wd: 750, H: 790, crib: false });
    if (/smagora-crib/.test(slug)) return cot({ L: 1370, Wd: 750, H: 830, crib: true });
    if (/smagora-changing-table/.test(slug)) return changingTable(s);
    return null;
  },
};
export default family;
