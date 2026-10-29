import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, PartPiece, ProductSpec, Vec3 } from "../../types";

/**
 * MANDAL bed frame with storage, read from its manuals (the 120 cm one, and the US one used for the 160 cm frames).
 * It is built upside down on a rug: the birch top frame (four boards slotted together) gets twelve hinged pins, the
 * two end panels drop onto them, a long divider goes between them and the end panels swing up and are cam-locked,
 * then the cross divider halves and a support block. The white plinth goes on last: two side rails, each a board
 * screwed to a bar, hooked onto the end panels, and two cross bars with a block that rests on the divider. Felt
 * pads under it, two people turn it over, the runners go on and the slatted base is laid in. Four drawers, two on
 * each long side, are built on their front: sides, back with long connector bolts, a stop, the bottom slid in,
 * runners screwed on, then pushed in. The frame with headboard adds MANDAL's wall-hung slatted headboard, with
 * its six little shelves, hung on two wall screws by two people.
 */

const T = 18;
const HF = 265; // IKEA: 26.5 cm high
const RT = 22; // top frame board thickness
const RW = 90; // top frame board width
const PH = 60; // plinth
const PI = 70; // plinth set in from the long sides

const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });

interface Bed {
  W: number;
  L: number;
  us: boolean; // the US manual (AA-261173): a few counts differ
  head: boolean;
}

function bedOf(s: ProductSpec): Bed | null {
  const slug = s.slug ?? "";
  if (!/^mandal-bed-frame-/.test(slug)) return null;
  const head = /headboard/.test(slug);
  const queen = /queen/.test(slug);
  // IKEA's pages give the frame as the mattress's width and 202 cm long; the US Queen takes a 160 x 200 mattress
  const mw = queen ? 160 : (s.bed?.mattressW ?? s.size.w);
  return { W: mw * 10, L: 2020, us: queen || head, head };
}

function recipe(s: ProductSpec, bed: Bed): CustomParams {
  const { W, L, us } = bed;
  const ch = HF - RT - PH; // carcass height between plinth and top frame
  const yc = PH + ch / 2;
  const yr = HF - RT; // underside of the top frame
  const birch = "wood" as const;
  const parts: CustomPart[] = [];
  const add = (id: string, name: string, size: Vec3, pos: Vec3, material: CustomPart["material"] = "board", o: Partial<CustomPart> = {}) =>
    parts.push({ id, name, size, pos, material, ...o });

  // top frame, slotted together
  for (const [i, sx] of [-1, 1].entries()) add(`RL${i}`, "Top frame, long board", [RW, RT, L], [sx * (W / 2 - RW / 2), HF - RT / 2, 0], birch);
  for (const [i, sz] of [-1, 1].entries()) add(`RS${i}`, "Top frame, short board", [W - 2 * RW, RT, RW], [0, HF - RT / 2, sz * (L / 2 - RW / 2)], birch);
  // end panels, the long divider and the cross divider halves
  for (const [i, sz] of [-1, 1].entries()) add(`E${i}`, "End panel", [W, ch, T], [0, yc, sz * (L / 2 - T / 2)], birch);
  add("CD", "Long divider", [T, ch, L - 2 * T], [0, yc, 0]);
  const xl = W / 2 - T / 2 - T - 2;
  for (const [i, sx] of [-1, 1].entries()) add(`X${i}`, "Cross divider", [xl, ch, T], [sx * (T / 2 + xl / 2), yc, 0]);
  add("BK", "Support block", [70, PH, 70], [0, PH / 2, 0], "wood");
  // the plinth: side boards on bars, two cross bars with a block each
  const xs = W / 2 - PI - T / 2;
  const xb = W / 2 - PI - T - 20;
  for (const [i, sx] of [-1, 1].entries()) add(`PS${i}`, "Plinth side rail", [T, PH, L - 60], [sx * xs, PH / 2, 0]);
  for (const [i, sx] of [-1, 1].entries()) add(`PB${i}`, "Plinth bar", [40, 40, L - 60], [sx * xb, PH - 20, 0], "wood");
  const cbw = 2 * (xb - 20);
  for (const [i, sz] of [-1, 1].entries()) add(`CB${i}`, "Cross bar", [cbw, 40, 40], [0, 20, sz * (L / 4)], "wood");
  for (const [i, sz] of [-1, 1].entries()) add(`BB${i}`, "Bar block", [60, PH - 40, 60], [0, 40 + (PH - 40) / 2, sz * (L / 4)], "wood");
  // slatted base, laid into the top frame
  const sw = W - 2 * RW, sl = L - 2 * RW;
  const n = Math.round(sl / 70);
  const slats: PartPiece[] = Array.from({ length: n }, (_, k) => ({ shape: "box", size: [sw, RT - 4, 50], pos: [0, -2, -sl / 2 + 25 + ((sl - 50) * k) / (n - 1)] }));
  slats.push(...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [30, 6, sl], pos: [sx * (sw / 2 - 40), RT / 2 - 3, 0], material: "fiber" })));
  add("SL", "Slatted bed base", [sw, RT, sl], [0, HF - RT / 2, 0], birch, { pieces: slats });

  // drawers: two on each long side, between the end panels and the cross divider
  const fw = L / 2 - 1.5 * T - 12;
  const fh = ch - 16;
  const bw = fw - 30;
  const hb = ch - 40;
  const yb = PH + 12;
  const xin = T / 2 + 10; // back of a drawer, clear of the long divider
  const dd = W / 2 - T - xin;
  const drawers: { sx: number; hz: number; k: number }[] = [];
  for (const hz of [1, -1]) for (const sx of [1, -1]) drawers.push({ sx, hz, k: drawers.length });
  for (const { sx, hz, k } of drawers) {
    const zc = hz * (T / 2 + 6 + fw / 2);
    add(`DF${k}`, "Drawer front", [T, fh, fw], [sx * (W / 2 - T / 2), PH + 8 + fh / 2, zc], hz > 0 ? birch : "board");
    for (const [j, e] of [-1, 1].entries()) add(`DS${k}${j}`, "Drawer side", [dd, hb, 15], [sx * (xin + dd / 2), yb + hb / 2, zc + e * (bw / 2 - 7.5)]);
    add(`DB${k}`, "Drawer back", [15, hb, bw - 30], [sx * (xin + 7.5), yb + hb / 2, zc]);
    add(`DT${k}`, "Drawer bottom", [dd - 15, 4, bw - 30], [sx * (xin + 15 + (dd - 15) / 2), yb + 2, zc], "fiber");
  }

  /* ---------- fittings ---------- */
  const zE = (sz: number) => sz * (L / 2 - T / 2);
  const pinXs = [-W / 2 + 60, -W / 4, -40, 40, W / 4, W / 2 - 60];
  const ringPins = [-1, 1].flatMap((sz) => pinXs.map((x): Vec3 => [x, yr, zE(sz)]));
  const ringCams = [-1, 1].flatMap((sz) => pinXs.map((x): Vec3 => [x + 25, yr, sz * (L / 2 - RW / 2)]));
  const boltsPer = us ? 2 : 3;
  const endBolts = [-1, 1].flatMap((sz) => (boltsPer === 3 ? [-xs, 0, xs] : [-xs, xs]).map((x): Vec3 => [x, PH, zE(sz)]));
  const lockN = us ? 14 : 16;
  const endCams = [-1, 1].flatMap((sz) => pinXs.map((x): Vec3 => [x, yr - 30, sz * (L / 2 - T)]));
  const divCams: Vec3[] = [[T / 2, yr - 30, -L / 2 + T + 40], [T / 2, yr - 30, L / 2 - T - 40], [-T / 2, yr - 30, -L / 2 + T + 40], [-T / 2, yr - 30, L / 2 - T - 40]].slice(0, lockN - 12) as Vec3[];
  const plinthPins = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [-15, 15].map((dx): Vec3 => [sx * xb + dx, PH, sz * (L / 2 - 30)])));
  const barDowels = us ? 2 : 4;
  const barScrews = us ? 2 : 4;
  const perBar = (k: number) => [-1, 1].flatMap((sz) => (k === 2 ? [-20] : [-25, 25]).map((dx): Vec3 => [dx, 40, sz * (L / 4)]));
  const runnerPts = drawers.map(({ hz, sx }): Vec3 => [sx * (W / 2 - T - dd / 2), yb + hb / 2, hz * (L / 2 - T)]);
  const runnerScrews = (side: number) =>
    drawers.filter((d) => d.sx === side).map(({ sx, hz }) => fx("screw", [-0.35, 0, 0.35].flatMap((t) => [-20, 20].map((dy): Vec3 => [sx * (W / 2 - T - dd / 2) + t * dd, yb + hb / 2 + dy, hz * (L / 2 - T)])), [0, 0, hz], { len: 14, dia: 4 }));
  const runners = (side: number) =>
    drawers.filter((d) => d.sx === side).map((d) => fx("runner", [runnerPts[d.k]], [0, 0, d.hz], { len: Math.round((dd - 40) / 10) * 10, dia: 20, twist: Math.PI / 2 }));
  const felt: Vec3[] = [
    ...[-1, 1].flatMap((sx) => [-1, -0.33, 0.33, 1].map((t): Vec3 => [sx * xs, 0, t * (L / 2 - 60)])),
    ...[-1, 1].map((sz): Vec3 => [0, 0, sz * (L / 4)]),
  ];
  const ds = (k: number) => [`DS${k}0`, `DS${k}1`];
  const d0 = drawers[0];
  type D = (typeof drawers)[number];
  const zOf = (d: D) => d.hz * (T / 2 + 6 + fw / 2);
  const frontBolts = (d: D) =>
    fx("camScrew", [-1, 1].flatMap((e) => [yb + 30, yb + hb - 30].map((y): Vec3 => [d.sx * (W / 2 - T), y, zOf(d) + e * (bw / 2 - 7.5)])), [-d.sx, 0, 0], { on: `DF${d.k}` });
  const sideCams = (d: D) => [-1, 1].map((e, j) => fx("cam", [yb + 30, yb + hb - 30].map((y): Vec3 => [d.sx * (W / 2 - T - 30), y, zOf(d) + e * (bw / 2)]), [0, 0, -e], { on: `DS${d.k}${j}` }));
  const backBolts = (d: D) =>
    [-1, 1].map((e, j) => fx("bolt", [yb + 30, yb + hb - 30].map((y): Vec3 => [d.sx * (xin + 7.5), y, zOf(d) + e * bw / 2]), [0, 0, -e], { len: 50, dia: 7, name: "Connector bolt", on: `DS${d.k}${j}`, mate: `DB${d.k}` }));
  const stopScrews = (d: D) => fx("screw", [-60, 60].map((dz): Vec3 => [d.sx * (xin + 15), yb + 6, zOf(d) + dz]), [0, 1, 0], { len: 16, dia: 3.5, on: `DT${d.k}` });
  const drawerRunner = (d: D) => {
    const ze = zOf(d) + d.hz * (bw / 2);
    return fx("screw", [-0.35, 0, 0.35].flatMap((t) => [-20, 20].map((dy): Vec3 => [d.sx * (xin + dd / 2) + t * dd, yb + hb / 2 + dy, ze])), [0, 0, -d.hz], { len: 14, dia: 4, on: `DS${d.k}${d.hz > 0 ? 1 : 0}` });
  };
  const rest = drawers.slice(1);

  const steps: CustomStep[] = [
    {
      title: "Slot the top frame together",
      detail: "Face down on a rug or the box: the bed is built upside down. Slide the ends of the boards into each other until they sit flush.",
      add: ["RL0", "RL1", "RS0", "RS1"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Push the hinged pins into the top frame",
      detail: "Twelve, six along each short end. Fold each one up so it stands straight.",
      fix: [0, 1].map((i) => fx("camScrew", ringPins.slice(i * 6, i * 6 + 6), [0, 1, 0], { name: "Hinged pin", len: 50, dia: 6, on: `RS${i}` })),
    },
    { title: "Lock the pins with cam locks", detail: "One beside each pin, turned clockwise until the pin is held tight.", fix: [0, 1].map((i) => fx("cam", ringCams.slice(i * 6, i * 6 + 6), [0, 1, 0], { on: `RS${i}` })), tools: ["screwdriver"] },
    {
      title: "Screw the cam bolts into the end panels",
      detail: "Into the holes along the edge that ends up at the bottom. Turn them in until they stop.",
      fix: [fx("camScrew", endBolts, [0, 1, 0])],
      tools: ["screwdriver"],
    },
    { title: "Stand the end panels on the pins", detail: "One at each short end, the cam bolts facing up. Let them lean outwards for now.", add: ["E0", "E1"] },
    {
      title: "Put the long divider in between",
      detail: "Two large dowels in its ends. Lower it into the middle, then swing the end panels up against it.",
      add: ["CD"],
      fix: [fx("dowel", [-1, 1].map((sz): Vec3 => [0, yc, sz * (L / 2 - T)]), [0, 0, 1], { len: 40, dia: 10, on: "CD" })],
    },
    {
      title: `Lock the end panels with ${lockN} cam locks`,
      detail: "Arrow towards the edge. Turn each one clockwise until it pulls the joint tight.",
      fix: [fx("cam", endCams, [0, 0, 1]), fx("cam", divCams, [1, 0, 0])],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the end panels to the top frame",
      detail: "Four screws, one in each corner of the top frame, where the boards overlap.",
      fix: [fx("screw", [-1, 1].flatMap((sz) => [-1, 1].map((sx): Vec3 => [sx * (W / 2 - 20), yr, sz * (L / 2 - 20)])), [0, 1, 0], { len: 20, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the cross divider halves",
      detail: "One each side of the long divider, on a dowel each, then a cam lock in each.",
      add: ["X0", "X1"],
      fix: [fx("dowel", [-1, 1].map((sx): Vec3 => [sx * (T / 2), yc, 0]), [1, 0, 0], { len: 30, dia: 8 }), fx("cam", [-1, 1].map((sx): Vec3 => [sx * (T / 2 + 40), yr - 30, 0]), [0, 0, 1])],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the support block onto the middle",
      detail: "Where the dividers cross. One long screw down through it.",
      add: ["BK"],
      fix: [fx("screw", [[0, 0, 0]], [0, 1, 0], { len: 90, dia: 5, on: "BK" })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the plinth bars",
      detail: "Two in each bar, for the plinth boards.",
      fix: [-1, 1].map((sx, i) => fx("dowel", [-0.2, 0.2].map((t): Vec3 => [sx * (xb + 20), PH - 20, t * L]), [-sx, 0, 0], { on: `PB${i}`, len: 30, dia: 8 })),
      tools: ["hammer"],
    },
    {
      title: "Bolt each plinth board onto its bar",
      detail: "Three long connector bolts each, with the Allen key.",
      add: ["PB0", "PB1", "PS0", "PS1"],
      fix: [-1, 1].map((sx, i) => fx("bolt", [-0.4, 0, 0.4].map((t): Vec3 => [sx * (W / 2 - PI), PH - 20, t * L]), [-sx, 0, 0], { len: 50, dia: 7, name: "Connector bolt", on: `PS${i}`, mate: `PB${i}` })),
      tools: ["allen"],
    },
    {
      title: "Hook the plinth rails onto the end panels",
      detail: "Two hinged pins in each end of the bars, locked with cam locks, then lay both rails on the end panels.",
      fix: [fx("camScrew", plinthPins, [0, 1, 0], { name: "Hinged pin", len: 50, dia: 6 }), ...[-1, 1].map((sx) => fx("cam", plinthPins.filter((p) => Math.sign(p[0]) === sx).map((p): Vec3 => [sx * (xb - 20), PH - 20, p[2] - Math.sign(p[2]) * 40]), [sx, 0, 0]))],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the rails to the end panels",
      detail: "Eight cam locks, two in each end of the rails.",
      fix: [fx("cam", plinthPins.map((p): Vec3 => [p[0], PH + 30, Math.sign(p[2]) * (L / 2 - T)]), [0, 0, 1])],
      tools: ["screwdriver"],
    },
    {
      title: "Put the blocks on the cross bars",
      detail: `${barDowels} dowels, then ${barScrews} long screws up through each bar into its block.`,
      add: ["CB0", "CB1", "BB0", "BB1"],
      fix: [fx("dowel", perBar(barDowels).map((p): Vec3 => [p[0], 40, p[2] + 15]), [0, 1, 0], { len: 30, dia: 8 }), fx("screw", perBar(barScrews).map((p): Vec3 => [p[0], 0, p[2]]), [0, 1, 0], { len: 90, dia: 5 })],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the cross bars across the plinth",
      detail: "The blocks rest on the long divider. Two dowels and a cam bolt in each end, then lock them with four cam locks.",
      fix: [
        fx("camScrew", [-1, 1].flatMap((sz) => [-1, 1].map((sx): Vec3 => [sx * (cbw / 2), 20, sz * (L / 4)])), [1, 0, 0]),
        fx("cam", [-1, 1].flatMap((sz) => [-1, 1].map((sx): Vec3 => [sx * (xb), 20, sz * (L / 4) + 30])), [0, 1, 0]),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the blocks to the divider",
      detail: "One long connector bolt down through each cross bar and block.",
      fix: [fx("bolt", [-1, 1].map((sz): Vec3 => [barScrews === 2 ? 20 : 0, 0, sz * (L / 4)]), [0, 1, 0], { len: 50, dia: 7, name: "Connector bolt" })],
      tools: ["allen"],
    },
    { title: "Stick the felt pads on", detail: "Ten, under the plinth rails and the cross bars, so it won't scratch the floor.", fix: [fx("glide", felt, [0, 1, 0], { name: "Felt pad" })] },
    { title: "Turn the bed over together", detail: "Lift it by the frame, one of you at each end, and set it down on the plinth.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Screw the runners in on this side",
      detail: "One for each drawer, six screws each, on the end panel and the cross divider.",
      fix: [...runners(1), ...runnerScrews(1)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the runners in on the other side",
      detail: "The same: two runners, six screws each.",
      fix: [...runners(-1), ...runnerScrews(-1)],
      tools: ["screwdriver"],
    },
    { title: "Lay the slatted base in", detail: "Unroll it into the top frame, the straps facing down, until it rests on the frame all round.", add: ["SL"] },
    {
      title: "Fix the slats with the strips",
      detail: "Push the two strips over the slat ends and press the six clips down into the frame.",
      fix: [fx("clip", [-1, 1].flatMap((sz) => [-1, 0, 1].map((t): Vec3 => [t * (sw / 2 - 60), HF, sz * (sl / 2 - 20)])), [0, -1, 0])],
    },
    {
      title: "Screw the cam bolts into a drawer front",
      detail: "Lay the front face down on the rug. Four bolts in its back.",
      fix: [frontBolts(d0)],
      pose: "+y",
      tools: ["screwdriver"],
    },
    { title: "Push the drawer sides onto them", detail: "One at each end, the grooves facing in and down.", add: [`DF${d0.k}`, ...ds(0)] },
    { title: "Lock the sides with four cam locks", fix: sideCams(d0), tools: ["screwdriver"] },
    {
      title: "Bolt on the drawer back",
      detail: "Four long connector bolts through the sides into its ends.",
      add: [`DB${d0.k}`],
      fix: backBolts(d0),
      tools: ["allen"],
    },
    { title: "Slide the bottom in", detail: "Along the grooves, smooth side up, then screw the stop into the back to hold it.", add: [`DT${d0.k}`], fix: [stopScrews(d0)], tools: ["screwdriver"] },
    { title: "Screw the runner onto the drawer", detail: "Six small screws along the side.", fix: [drawerRunner(d0)], tools: ["screwdriver"] },
    {
      title: "Build the other three drawers the same way",
      detail: "Bolts in the front, sides and cams, the back, the bottom and its stop, then the runner.",
      add: rest.flatMap((d) => [`DF${d.k}`, ...ds(d.k), `DB${d.k}`, `DT${d.k}`]),
      from: Object.fromEntries(rest.map((d) => [`DF${d.k}`, [d.sx * 300, 0, 0] as Vec3])),
      fix: rest.flatMap((d) => [frontBolts(d), ...sideCams(d), ...backBolts(d), stopScrews(d), drawerRunner(d)]),
      tools: ["screwdriver", "allen"],
    },
    { title: "Slide the drawers in", detail: "Rest the runners on the ones in the bed and push each drawer in until it closes. Two on each long side.", check: "square" },
  ];
  return { parts, steps };
}

/** The wall-hung headboard, 240 cm wide, with six little shelves at its ends. */
function headboard(bed: Bed, base: CustomParams): CustomParams {
  const { L } = bed;
  const HW = 2400, HH = 900, HD = 30, y0 = 150;
  const zh = -L / 2 - 60 - HD / 2;
  const n = 23;
  const gap = (HH - n * 30) / (n - 1);
  const slats: PartPiece[] = Array.from({ length: n }, (_, k) => ({ shape: "box", size: [HW, 30, HD - 8], pos: [0, -HH / 2 + 15 + k * (30 + gap), 4] }));
  slats.push(...[-0.42, -0.14, 0.14, 0.42].map((t): PartPiece => ({ shape: "box", size: [40, HH, 8], pos: [t * HW, 0, -HD / 2 + 4], material: "metal" })));
  const parts: CustomPart[] = [...base.parts, { id: "HB", name: "Headboard", size: [HW, HH, HD], pos: [0, y0 + HH / 2, zh], material: "wood", pieces: slats }];
  const shelfYs = [y0 + 300, y0 + 480, y0 + 660];
  const shelves: string[] = [];
  for (const [i, sx] of [-1, 1].entries())
    shelfYs.forEach((y, j) => {
      const id = `HS${i}${j}`;
      shelves.push(id);
      parts.push({ id, name: "Shelf", size: [220, 16, 170], pos: [sx * (HW / 2 - 130), y, zh + HD / 2 + 85], material: "board" });
    });
  const back = zh - HD / 2;
  const wall: Vec3[] = [-980, 980].map((x): Vec3 => [x, y0 + HH - 120, back]);
  const steps: CustomStep[] = [
    ...base.steps,
    {
      title: "Screw the hangers onto the back of the headboard",
      detail: "Easiest with it face down on a rug. A keyhole plate at the top of each outer rail, two screws each.",
      add: ["HB"],
      fix: [fx("bracket", wall.map((p): Vec3 => [p[0], p[1], back]), [0, 0, 1], { name: "Keyhole plate" }), fx("screw", wall.flatMap((p) => [-15, 15].map((dx): Vec3 => [p[0] + dx, p[1] - 20, back])), [0, 0, 1], { len: 16, dia: 4 })],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Screw the two bumpers on at the bottom",
      detail: "A washer under each one. They hold the bottom off the wall.",
      fix: [
        fx("washer", [-980, 980].map((x): Vec3 => [x, y0 + 80, back]), [0, 0, 1]),
        fx("glide", [-980, 980].map((x): Vec3 => [x, y0 + 80, back - 2]), [0, 0, 1], { name: "Bumper" }),
        fx("screw", [-980, 980].map((x): Vec3 => [x, y0 + 80, back - 12]), [0, 0, 1], { len: 30, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the six shelves",
      detail: "Three at each end, slid in between the slats. A bar behind each one and two bolts through it, with the Allen key.",
      add: shelves,
      fix: [fx("bolt", shelves.flatMap((id) => {
        const p = parts.find((q) => q.id === id)!.pos;
        return [-50, 50].map((dx): Vec3 => [p[0] + dx, p[1], back]);
      }), [0, 0, 1], { len: 40, dia: 6, name: "Connector bolt" })],
      tools: ["allen"],
    },
    {
      title: "Mark the wall for the two screws",
      detail: "Level, 196 cm apart, at the height of the hangers. Centre them on where the bed will stand.",
      tools: ["level", "pencil", "tape"],
      warnings: ["wall"],
    },
    {
      title: "Put the wall screws in",
      detail: "Drill, plug and drive in two screws, leaving their heads out for the hangers. They aren't included: pick ones made for your wall.",
      fix: [fx("plug", wall.map((p): Vec3 => [p[0], p[1], back - 40]), [0, 0, -1]), fx("screw", wall.map((p): Vec3 => [p[0], p[1], back - 36]), [0, 0, -1], { len: 50, dia: 5 })],
      tools: ["drill", "screwdriver"],
      wall: true,
    },
    { title: "Hang the headboard together", detail: "Lift it by both ends, hook the keyholes over the screws and slide it down until it sits.", people: 2, warnings: ["two", "wall"] },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["MANDAL"],
  recipe(s) {
    const bed = bedOf(s);
    if (!bed) return null;
    const r = recipe(s, bed);
    return bed.head ? headboard(bed, r) : r;
  },
};
export default family;
