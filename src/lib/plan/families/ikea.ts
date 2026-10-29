import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, PartItem, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import { buildCustom } from "../custom";

/**
 * Products whose name starts with "IKEA" (IKEA PS, IKEA PS 2026, IKEA PS LÖMSK): unrelated designs that share only
 * the brand word, so each one is its own recipe, read from its own manual and picked by its slug. Products with no
 * manual (the folding chair, the side table, the rattan footstool) come assembled: their guides only unpack them.
 */

/** Parts built on their own (a drawer, a seat, a side laid out on the rug): shown moved by `off` until recipe step `until`, where they move into place from `from`. */
interface Aside {
  ids: string[];
  until: number;
  off: Vec3;
  rot?: Vec3; // turned about its own centre while aside (a panel laid inside face up)
  from: Vec3;
  later?: { at: number; off: Vec3 }[]; // moved again (when the work around them turns over), still aside
}
type R = CustomParams & { aside?: Aside[] };
const mm = (cm: number) => cm * 10;

function part(id: string, name: string, size: Vec3, pos: Vec3, material: PartMaterial = "board", o: Partial<CustomPart> = {}): CustomPart {
  return { id, name, size, pos, material, ...o };
}
/** A disc or drum standing up: drawn from one cylinder piece so it isn't laid down like a rail. */
function disc(id: string, name: string, dia: number, h: number, pos: Vec3, material: PartMaterial = "board"): CustomPart {
  return part(id, name, [dia, h, dia], pos, material, { pieces: [{ shape: "cyl", size: [dia, h, dia], pos: [0, 0, 0] }] });
}
function fix(kind: HwKind, at: Vec3[], dir: Vec3, on?: string, mate?: string, len?: number, dia?: number): CustomFix {
  return { kind, count: at.length, at, dir, on, mate, len, dia };
}
const UP: Vec3 = [0, 1, 0];
const DOWN: Vec3 = [0, -1, 0];

/* ---------- IKEA PS 2026 chair: two leg frames slotted across each other under a round seat ---------- */

function chair(s: ProductSpec): R {
  const H = mm(s.size.h);
  const seatTop = mm(s.seat?.seatH ?? 47);
  const st = 50, sd = 380, r = 208, lw = 35, rh = 60, rt = 30;
  const zc = 40; // the seat sits forward, so the back cushion fits behind it
  const yb = seatTop - st;
  const bd = 170, by = H - bd / 2;
  const railY = yb - rh / 2;
  const parts: CustomPart[] = [
    part("S", "Seat", [sd, st, sd], [0, yb + st / 2, zc], "soft", { pieces: [{ shape: "cyl", size: [sd, st, sd], pos: [0, 0, 0] }] }),
    part("FX", "Leg frame", [2 * r + lw, yb, lw], [0, yb / 2, zc], "wood", {
      pieces: [
        { shape: "box", size: [lw, yb, lw], pos: [-r, 0, 0] },
        { shape: "box", size: [lw, yb, lw], pos: [r, 0, 0] },
        { shape: "box", size: [2 * r - lw, rh, rt], pos: [0, railY - yb / 2, 0] },
      ],
    }),
    part("FZ", "Leg frame with back post", [lw, by, 2 * r + lw], [0, by / 2, zc], "wood", {
      pieces: [
        { shape: "box", size: [lw, yb, lw], pos: [0, yb / 2 - by / 2, r] },
        { shape: "box", size: [lw, by, lw], pos: [0, 0, -r] },
        { shape: "box", size: [rt, rh, 2 * r - lw], pos: [0, railY - by / 2, 0] },
      ],
    }),
    part("P", "Cross plate", [220, 3, 220], [0, yb - rh - 1.5, zc], "metal", {
      pieces: [
        { shape: "box", size: [220, 3, 40], pos: [0, 0, 0] },
        { shape: "box", size: [40, 3, 220], pos: [0, 0, 0] },
      ],
    }),
    part("B", "Back cushion", [360, bd, bd], [0, by, zc - r], "soft", { shape: "cyl" }),
  ];
  const yp = yb - rh - 3;
  const along = [-95, -60, 60, 95];
  const steps: CustomStep[] = [
    {
      title: "Set the leg frames on the upside-down seat",
      detail: "Lay the seat top down on a cloth on a table. Slot the two leg frames into each other across the middle and stand them on it, the long leg at the back.",
      add: ["S", "FX", "FZ"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw the cross plate over the joint",
      detail: "It lies over the middle where the rails cross, two screws in each arm.",
      add: ["P"],
      fix: [
        fix("screw", along.map((x) => [x, yp, zc] as Vec3), UP, "P", "FX", 16, 4),
        fix("screw", along.map((z) => [0, yp, zc + z] as Vec3), UP, "P", "FZ", 16, 4),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the frame to the seat",
      detail: "Four long bolts go through the rails into the seat, one near each leg.",
      fix: [
        fix("bolt", [-1, 1].map((sx) => [sx * 140, yb - rh, zc] as Vec3), UP, "FX", "S", 90, 6),
        fix("bolt", [-1, 1].map((sz) => [0, yb - rh, zc + sz * 140] as Vec3), UP, "FZ", "S", 90, 6),
      ],
      tools: ["allen"],
    },
    {
      title: "Turn it over and push the back cushion onto the post",
      detail: "The top of the post goes into the hole under the cushion.",
      add: ["B"],
      pose: "+y",
    },
    {
      title: "Screw the back cushion to the post",
      detail: "Lift the flap at the back of the cover to reach the two holes.",
      fix: [fix("screw", [-1, 1].map((sx) => [sx * 22, by, zc - r - bd / 2] as Vec3), [0, 0, 1], "B", "FZ", 12, 4)],
      tools: ["screwdriver"],
    },
    { title: "Pull the covers straight", detail: "Tuck the seat cover's edge under all the way round, then roll the back cushion until its zips face down." },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS 2026 table, round: a steel frame bolted under the top, legs bolted into its corners ---------- */

function roundTable(s: ProductSpec): R {
  const D = mm(s.size.w), H = mm(s.size.h);
  const tt = 25, yt = H - tt;
  const c = Math.round(D * 0.3); // legs at the corners of a square under the top
  const ld = 30, rh = 50, rw = 20;
  const parts: CustomPart[] = [
    disc("T", "Table top", D, tt, [0, yt + tt / 2, 0], "board"),
    ...[-1, 1].map((sz, i) => part(`L${i}`, "Long rail", [2 * c - ld, rh, rw], [0, yt - rh / 2, sz * c], "metal")),
    ...[-1, 1].map((sx, i) => part(`S${i}`, "Short rail", [rw, rh, 2 * c - ld - 2 * rw], [sx * c, yt - rh / 2, 0], "metal")),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => part(`G${sx}${sz}`, "Leg", [ld, yt, ld], [sx * (c + ld / 2 + 4), yt / 2, sz * (c + ld / 2 + 4)], "metal", { shape: "cyl" }))),
  ];
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * c, yt - rh / 2, sz * c] as Vec3));
  const legBolt = (sx: number, sz: number): Vec3 => [sx * (c - 20), yt - rh / 2, sz * (c - 20)];
  const steps: CustomStep[] = [
    {
      title: "Screw the long rails under the top",
      detail: "Lay the top face down on a rug. Two bolts in each rail, through the holes into the top.",
      add: ["T", "L0", "L1"],
      fix: [fix("bolt", [-1, 1].flatMap((sz) => [-1, 1].map((sx) => [sx * (c - 90), yt - rh, sz * c] as Vec3)), UP, undefined, "T", 30, 6)],
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Clip the corner brackets onto the rail ends",
      detail: "One at each end, pushed on until it clicks.",
      fix: [fix("angle", corners, [0, 0, 1], undefined, undefined, 60, 40)],
    },
    { title: "Fit the short rails onto the brackets", detail: "Push each end onto its bracket until it clicks.", add: ["S0", "S1"] },
    {
      title: "Bolt the legs into the corners",
      detail: "A spring washer under each bolt head, through the bracket into the leg. Only turn them in by hand for now.",
      add: ["G-1-1", "G-11", "G1-1", "G11"],
      fix: [
        fix("washer", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => legBolt(sx, sz))), [1, 0, 1], undefined, undefined, 2, 12),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => fix("bolt", [legBolt(sx, sz)], [sx, 0, sz], undefined, `G${sx}${sz}`, 40, 8))),
      ],
    },
    { title: "Tighten the leg bolts with the box spanner", detail: "Firmly, all four, while the legs stand straight.", tools: ["wrench"] },
    { title: "Turn the table over together", detail: "Lift it by the top, not by the legs.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS 2026 folding table: legs already hinged under the top, folded out into an X at each end ---------- */

function foldingTable(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const tt = 25, yt = H - tt, lw = 40;
  const xe = W / 2 - 160;
  const zt = D / 2 - 60, zf = D / 2 + 20;
  const L = Math.hypot(zt + zf, yt), a = Math.atan2(zt + zf, yt);
  const legs: CustomPart[] = [];
  for (const [i, sx] of [-1, 1].entries())
    for (const [j, k] of [-1, 1].entries())
      legs.push(part(`G${i}${j}`, "Leg", [lw, L, lw], [sx * xe + k * (lw / 2 + 1), yt / 2, (k * (zt - zf)) / 2], "wood", { rot: [k * a, 0, 0] }));
  const parts: CustomPart[] = [part("T", "Table top", [W, tt, D], [0, yt + tt / 2, 0], "wood"), ...legs];
  const yc = (yt * zf) / (zt + zf);
  const steps: CustomStep[] = [
    {
      title: "Lay the top upside down and fold out the legs",
      detail: "Together, on a rug. Swing each pair of legs out from under the top until they cross.",
      add: ["T", "G00", "G01", "G10", "G11"],
      from: { G00: [0, -300, 0], G01: [0, -300, 0], G10: [0, -300, 0], G11: [0, -300, 0] },
      pose: "-y",
      people: 2,
      warnings: ["two", "floor"],
    },
    {
      title: "Screw a knob bolt through each crossing",
      detail: "Through both legs where they cross, by hand until it's firm.",
      fix: [-1, 1].map((sx, i) => fix("stud", [[sx * (xe + lw + 2), yc, 0]], [-sx, 0, 0], `G${i}1`, `G${i}0`, 80, 8)),
    },
    { title: "Turn the table over together", detail: "Stand it on its legs and check it doesn't rock.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS 2026 bench: built upside down, two end frames, a slid-in seat and rockers bolted on last ---------- */

function bench(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const lw = 45, xf = Math.round(W * 0.35), zl = D / 2 - lw / 2;
  const ys = 300; // seat rails
  const rockH = 60, rockT = 45;
  const flatW = 520, tilt = 0.15;
  const legY0 = 88;
  const frame = (sx: number, i: number) =>
    part(`F${i}`, "End frame", [lw, H - legY0, D], [sx * xf, (H + legY0) / 2, 0], "wood", {
      pieces: [
        { shape: "box", size: [lw, H - legY0, lw], pos: [0, 0, -zl] },
        { shape: "box", size: [lw, H - legY0, lw], pos: [0, 0, zl] },
        { shape: "box", size: [lw, lw, D - 2 * lw], pos: [0, (H - legY0) / 2 - lw / 2, 0] },
        { shape: "box", size: [lw, 60, D - 2 * lw], pos: [0, ys - (H + legY0) / 2, 0] },
      ],
    });
  const railL = 2 * xf - lw;
  const endLen = (W - flatW) / 2;
  const rocker = (sz: number, i: number) =>
    part(`K${i}`, "Rocker", [W, 120, rockT], [0, 50, sz * zl], "wood", {
      pieces: [
        { shape: "box", size: [flatW, rockH, rockT], pos: [0, -20, 0] },
        { shape: "box", size: [endLen + 10, rockH, rockT], pos: [-(flatW / 2 + endLen / 2), -20 + (endLen / 2) * tilt, 0], rot: [0, 0, -tilt] },
        { shape: "box", size: [endLen + 10, rockH, rockT], pos: [flatW / 2 + endLen / 2, -20 + (endLen / 2) * tilt, 0], rot: [0, 0, tilt] },
      ],
    });
  const parts: CustomPart[] = [
    frame(-1, 0),
    frame(1, 1),
    ...[-1, 1].map((sz, i) => part(`R${i}`, "Seat rail", [railL, 60, 30], [0, ys, sz * (zl - 5)], "wood")),
    part("S", "Seat", [railL, 20, D - 2 * lw - 10], [0, ys + 20, 0], "wood"),
    rocker(-1, 0),
    rocker(1, 1),
  ];
  const xi = xf - lw / 2;
  const bolts = (sx: number, f: string) => [
    fix("bolt", [-1, 1].map((sz) => [sx * (xf + lw / 2), ys, sz * (zl - 5)] as Vec3), [-sx, 0, 0], f, undefined, 100, 6),
    fix("nut", [-1, 1].map((sz) => [sx * (xi - 50), ys - 30, sz * (zl - 5)] as Vec3), UP, undefined, undefined, 20, 10),
  ];
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the end frames",
      detail: "Three in each frame: one where each seat rail meets it and one in the middle rail.",
      fix: [-1, 1].map((sx, i) =>
        fix("dowel", [[sx * xi, ys, -(zl - 5)], [sx * xi, ys, zl - 5], [sx * xi, ys, 0]], [-sx, 0, 0], `F${i}`, undefined, 30, 8),
      ),
      tools: ["hammer"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt the seat rails to one end frame",
      detail: "Upside down on a rug. Drop a barrel nut into each rail with its slot showing the way the bolt goes, then turn the bolts in.",
      add: ["F0", "R0", "R1"],
      fix: bolts(-1, "F0"),
      tools: ["allen", "flathead"],
    },
    { title: "Slide the seat in between the rails", detail: "Its edges run in the grooves along the rails.", add: ["S"], from: { S: [W * 0.6, 0, 0] } },
    { title: "Bolt on the other end frame", detail: "Barrel nuts in first, then two bolts.", add: ["F1"], fix: bolts(1, "F1"), tools: ["allen", "flathead"] },
    {
      title: "Lift it onto a table and press the seat down",
      detail: "Still upside down. Push the seat down at both ends so it sits flat on the end frames.",
    },
    {
      title: "Screw the seat to the end frames",
      detail: "Two screws at each end, through the middle rail of the frame into the seat.",
      fix: [-1, 1].map((sx, i) => fix("screw", [-60, 60].map((z) => [sx * xf, ys - 30, z] as Vec3), UP, `F${i}`, "S", 30, 4)),
      tools: ["screwdriver"],
    },
    {
      title: "Bolt the rockers to the legs",
      detail: "Curve facing away from the bench. One long bolt through the rocker into each leg.",
      add: ["K0", "K1"],
      fix: [-1, 1].map((sz, i) => fix("bolt", [-1, 1].map((sx) => [sx * xf, legY0 - rockH, sz * zl] as Vec3), UP, `K${i}`, undefined, 110, 8)),
      tools: ["allen"],
    },
    {
      title: "Stick the grip strips under the rockers",
      detail: "Two on each rocker, one either side of the middle, so it rocks without sliding.",
      fix: [fix("glide", [-1, 1].flatMap((sz) => [-1, 1].map((sx) => [sx * 170, 0, sz * zl] as Vec3)), UP, undefined, undefined, 2, 40)],
    },
    { title: "Turn it over", detail: "Stand it on the rockers.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS 2026 table with drawer: the drawer box first, then two leg frames on the upside-down top ---------- */

function drawerTable(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const tt = 25, yt = H - tt, lw = 50;
  const xl = W / 2 - lw / 2, zl = D / 2 - lw / 2;
  const rh = 100, rt = 25, xr = W / 2 - rt / 2;
  const frame = (sx: number, i: number) =>
    part(`F${i}`, "Leg frame", [lw, yt, D], [sx * xl, yt / 2, 0], "wood", {
      pieces: [
        { shape: "box", size: [lw, yt, lw], pos: [0, 0, -zl] },
        { shape: "box", size: [lw, yt, lw], pos: [0, 0, zl] },
        { shape: "box", size: [rt, rh, D - 2 * lw], pos: [sx * (xr - xl), yt / 2 - rh / 2, 0] },
      ],
    });
  // the drawer runs front to back between the frames, its front flush with the legs
  const dt = 16, dh = 88, yd0 = yt - rh, ydc = yd0 + dh / 2;
  const dw = 2 * (W / 2 - lw) - 6, dz0 = -D / 2 + lw, dz1 = D / 2;
  const dzc = (dz0 + dz1) / 2, dd = dz1 - dz0;
  const parts: CustomPart[] = [
    part("DF", "Drawer front", [dw, dh, dt], [0, ydc, dz1 - dt / 2], "wood"),
    part("DB", "Drawer back", [dw, dh, dt], [0, ydc, dz0 + dt / 2], "wood"),
    ...[-1, 1].map((sx, i) => part(`DS${i}`, "Drawer side", [dt, dh, dd - 2 * dt], [sx * (dw / 2 - dt / 2), ydc, dzc], "wood")),
    part("DO", "Drawer bottom", [dw - 2 * dt + 8, 4, dd - 2 * dt + 8], [0, yd0 + 12, dzc], "fiber"),
    part("T", "Table top", [W, tt, D], [0, yt + tt / 2, 0], "wood"),
    frame(-1, 0),
    frame(1, 1),
    ...[-1, 1].map((sx, i) => part(`M${i}`, "Runner strip", [40, 3, D - 2 * lw], [sx * (W / 2 - lw - 4), yd0 - 1.5, 0], "metal")),
  ];
  const camPins = (z: number, on: string) =>
    fix("camScrew", [-1, 1].flatMap((sx) => [ydc - 22, ydc + 22].map((y) => [sx * (dw / 2 - dt / 2), y, z] as Vec3)), [0, 0, z > 0 ? 1 : -1], on, undefined, 34, 7);
  const cams = (z: number) => [-1, 1].map((sx, i) => fix("cam", [ydc - 22, ydc + 22].map((y) => [sx * (dw / 2 - dt), y, z] as Vec3), [-sx, 0, 0], `DS${i}`, undefined, 13, 15));
  const zFi = dz1 - dt, zBi = dz0 + dt;
  const boltZ = Array.from({ length: 8 }, (_, i) => -D / 2 + lw + 25 + ((D - 2 * lw - 50) * i) / 7);
  const steps: CustomStep[] = [
    {
      title: "Screw the cam pins into the drawer front and back",
      detail: "Lay both on a rug, inside face up. Four pins in each, by hand until they stop.",
      fix: [camPins(zFi, "DF"), camPins(zBi, "DB")],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    { title: "Stand the drawer sides on the front", detail: "Onto the cam pins, grooves facing in.", add: ["DF", "DS0", "DS1"] },
    { title: "Turn the cam locks", detail: "Arrow towards the pin, then a half turn clockwise.", fix: cams(zFi - 30), tools: ["screwdriver"] },
    { title: "Slide the bottom into the grooves", detail: "Smooth side up, all the way to the front.", add: ["DO"], from: { DO: [0, 0, 400] } },
    { title: "Fit the drawer back onto the sides", detail: "Press it down onto the cam pins.", add: ["DB"] },
    { title: "Lock the back on", detail: "Turn the cam locks clockwise until they pull tight.", fix: cams(zBi + 30), tools: ["screwdriver"] },
    {
      title: "Tap the dowels into the leg frames",
      detail: "Two in the top of each frame's rail.",
      fix: [-1, 1].map((sx, i) => fix("dowel", [-1, 1].map((sz) => [sx * xr, yt, sz * (D / 2 - lw - 60)] as Vec3), UP, `F${i}`, "T", 30, 8)),
      tools: ["hammer"],
      pose: "+y",
    },
    {
      title: "Stand the leg frames on the upside-down top",
      detail: "Lay the top face down on a rug and push each frame onto its dowels, rails on the outside.",
      add: ["T", "F0", "F1"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw in the two drawer stops",
      detail: "Into the holes near the back of the top. They stop the drawer coming all the way out.",
      fix: [fix("stud", [-1, 1].map((sx) => [sx * (dw / 2 - 60), yt, -D / 2 + lw + 20] as Vec3), UP, "T", undefined, 15, 10)],
      tools: ["screwdriver"],
    },
    {
      title: "Lay the drawer in, upside down",
      detail: "Between the frames, its front flush with the front legs. Leave the same gap at each side.",
      kind: "drawer",
    },
    {
      title: "Bolt the frames to the top",
      detail: "Eight long bolts through each rail into the top.",
      fix: [-1, 1].map((sx, i) => fix("bolt", boltZ.map((z) => [sx * xr, yt - rh, z] as Vec3), UP, `F${i}`, "T", 110, 6)),
      tools: ["allen"],
    },
    {
      title: "Screw on the runner strips",
      detail: "One under each rail, three screws each. The drawer runs on them.",
      add: ["M0", "M1"],
      fix: [-1, 1].map((sx, i) => fix("screw", [-1, 0, 1].map((t) => [sx * (W / 2 - lw - 4), yd0 - 3, (t * (D - 2 * lw - 60)) / 2] as Vec3), UP, `M${i}`, `F${i}`, 16, 4)),
      tools: ["screwdriver"],
    },
    {
      title: "Tap a glide into each leg",
      detail: "Into the hole in the end of the leg.",
      fix: [fix("glide", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xl, 0, sz * zl] as Vec3)), UP, undefined, undefined, 4, 30)],
      tools: ["hammer"],
    },
    { title: "Turn the table over", detail: "Then pull the drawer out and push it back to check it runs.", pose: "+y" },
  ];
  const drawer = ["DF", "DB", "DS0", "DS1", "DO"];
  return { parts, steps, aside: [{ ids: drawer, until: 9, off: [W + 200, -yd0, 0], from: [0, -300, 0], later: [{ at: 7, off: [W + 200, H - dh - yd0, 0] }] }] };
}

/* ---------- IKEA PS 2026 bedside table: built lying on one side, the flip-down door on two pins ---------- */

function bedside(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const t = 18, g = 10; // glides under the sides
  const xs = W / 2 - t / 2, iw = W - 2 * t;
  const ytop = H - t;
  const yb = 245; // the box's bottom shelf
  const parts: CustomPart[] = [
    ...[-1, 1].map((sx, i) => part(`S${i}`, "Side panel", [t, ytop - g, D], [sx * xs, (ytop + g) / 2, 0], "wood")),
    part("B", "Back panel", [iw, ytop - yb - t, t], [0, (ytop + yb + t) / 2, -D / 2 + t / 2], "wood"),
    part("F", "Shelf", [iw, t, D - 2 * t], [0, yb + t / 2, 0], "wood"),
    part("O", "Door", [iw - 4, ytop - yb - t - 4, t], [0, (ytop + yb + t) / 2, D / 2 - t / 2], "wood"),
    part("T", "Top", [W, t, D], [0, ytop + t / 2, 0], "wood"),
  ];
  const zB = -D / 2 + t / 2;
  const yBack = (ytop + yb + t) / 2;
  const pinAt = (sx: number): Vec3 => [sx * (iw / 2), yb + t + 12, D / 2 - t / 2];
  const sideCamPins = (sx: number, i: number) =>
    fix("camScrew", [[sx * (iw / 2), yBack + 60, zB], [sx * (iw / 2), yBack - 60, zB], [sx * (iw / 2), yb + t / 2, -D / 4], [sx * (iw / 2), yb + t / 2, D / 4]], [sx, 0, 0], `S${i}`, undefined, 34, 7);
  const cams = (sx: number, on: string, pts: Vec3[]) => fix("cam", pts.map((p) => [sx * (iw / 2 - 30), p[1], p[2]] as Vec3), [0, 0, 1], on, undefined, 13, 15);
  const backCams = (sx: number) => cams(sx, "B", [[0, yBack + 60, zB], [0, yBack - 60, zB]]);
  const shelfCams = (sx: number) => fix("cam", [-D / 4, D / 4].map((z) => [sx * (iw / 2 - 30), yb + t, z] as Vec3), DOWN, "F", undefined, 13, 15);
  const steps: CustomStep[] = [
    {
      title: "Tap a dowel into each side panel",
      detail: "Lay both sides on a rug, inside face up.",
      fix: [-1, 1].map((sx, i) => fix("dowel", [[sx * (iw / 2), yBack, zB]], [sx, 0, 0], `S${i}`, "B", 30, 8)),
      tools: ["hammer"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Screw the cam pins into the sides", detail: "Four in each side, by hand until they stop.", fix: [sideCamPins(-1, 0), sideCamPins(1, 1)], tools: ["screwdriver"] },
    {
      title: "Screw the glides into the bottom edges",
      detail: "Two under each side panel.",
      fix: [fix("glide", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, g, sz * (D / 2 - 40)] as Vec3)), UP, undefined, undefined, 10, 20)],
    },
    { title: "Stand the back panel on one side", detail: "Lay one side flat, then push the back panel down onto its cam pins and dowel.", add: ["S0", "B"] },
    { title: "Lock the back panel on", detail: "Two cam locks, turned clockwise.", fix: [backCams(-1)], tools: ["screwdriver"] },
    {
      title: "Tap two dowels into the shelf",
      detail: "Into its back edge.",
      fix: [fix("dowel", [-1, 1].map((sx) => [sx * (iw / 4), yb + t / 2, -D / 2 + t] as Vec3), [0, 0, -1], "F", "B", 30, 8)],
      tools: ["hammer"],
      wait: ["F"],
    },
    // it goes in at a slant: down onto the cam pins and back onto the dowels at once
    { title: "Fit the shelf and lock it", detail: "Onto the cam pins and the dowels in the back, then turn its two cam locks.", add: ["F"], fix: [shelfCams(-1)], tools: ["screwdriver"], from: { F: [220, 0, 220] } },
    {
      title: "Push a pin and washer in for the door",
      detail: "Into the hole at the front of the side, just above the shelf.",
      fix: [fix("pin", [pinAt(-1)], [-1, 0, 0], "S0", undefined, 30, 6), fix("washer", [pinAt(-1)], [-1, 0, 0], undefined, undefined, 2, 12)],
    },
    {
      title: "Screw the catch plate onto the door",
      detail: "Inside the door at the top, the round hole over the hole in the door.",
      fix: [fix("clip", [[0, ytop - 22, D / 2 - t]], [0, 0, 1], "O", undefined, 6, 30), fix("screw", [[0, ytop - 22, D / 2 - t]], [0, 0, 1], "O", undefined, 12, 4)],
      tools: ["screwdriver"],
    },
    { title: "Fit the door onto the pin", detail: "Its bottom corner hole over the pin, finger hole at the top.", add: ["O"] },
    {
      title: "Push the second pin and washer into the door",
      detail: "Into the hole in its other bottom corner. The other side goes over it.",
      fix: [fix("pin", [pinAt(1)], [-1, 0, 0], "O", undefined, 30, 6), fix("washer", [pinAt(1)], [-1, 0, 0], undefined, undefined, 2, 12)],
    },
    {
      title: "Fit the other side and stand it up",
      detail: "Press it on over the pin, the dowel and the cam pins, lock its four cams, then stand the table up.",
      add: ["S1"],
      fix: [backCams(1), shelfCams(1)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the catch under the top",
      detail: "Lay the top upside down. Two screws, with the catch at the front edge. Don't overtighten them.",
      add: ["T"],
      fix: [fix("clip", [[0, ytop, D / 2 - 30]], DOWN, "T", undefined, 30, 20), fix("screw", [-14, 14].map((x) => [x, ytop, D / 2 - 30] as Vec3), UP, "T", undefined, 12, 4)],
      tools: ["screwdriver"],
      pose: "+y",
    },
    {
      title: "Screw the cam pins into the top",
      detail: "Four, one near each corner of its underside.",
      fix: [fix("camScrew", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, ytop, sz * (D / 2 - 60)] as Vec3)), DOWN, "T", undefined, 34, 7)],
      tools: ["screwdriver"],
    },
    {
      title: "Lock the top on",
      detail: "Press it down onto the sides and turn the four cam locks inside.",
      add: ["T"],
      fix: [-1, 1].map((sx, i) => fix("cam", [-1, 1].map((sz) => [sx * (iw / 2), ytop - 30, sz * (D / 2 - 60)] as Vec3), [-sx, 0, 0], `S${i}`, undefined, 13, 15)),
      tools: ["screwdriver"],
    },
    { title: "Close the door until it clicks", detail: "Push it shut at the top. Press again to open it." },
  ];
  return {
    parts,
    steps,
    aside: [
      { ids: ["S1"], until: 11, off: [-2 * xs, 0, D + 120], rot: [0, Math.PI, 0], from: [300, 0, 0] },
      { ids: ["T"], until: 14, off: [W + 150, -ytop, 0], from: [0, 300, 0] },
    ],
  };
}

/* ---------- IKEA PS 2026 shelving unit: two ladders joined by rails, lying on their back, the shelves pushed through ---------- */

function shelving(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const xl = Math.round(W * 0.31), uw = 40, zu = D / 2 - uw / 2;
  const st = 25;
  const tops = [0.217, 0.441, 0.671, 0.897].map((f) => Math.round(H * f));
  const rungs = [60, ...tops.map((y) => y - st - 15), ...tops.slice(0, 3).map((y, i) => Math.round((y + tops[i + 1] - st) / 2)), H - 20].sort((a, b) => a - b);
  const rungPieces = (): PartPiece[] => rungs.map((y) => ({ shape: "box", size: [uw, 30, D - 2 * uw], pos: [0, y - H / 2, 0] }));
  const ladder = (sx: number, i: number) =>
    part(`L${i}`, "Ladder", [uw, H, D], [sx * xl, H / 2, 0], "wood", {
      pieces: [{ shape: "box", size: [uw, H, uw], pos: [0, 0, -zu] }, { shape: "box", size: [uw, H, uw], pos: [0, 0, zu] }, ...rungPieces()],
    });
  const rail = (y: number, i: number) => part(`R${i}`, "Rail", [2 * xl - uw, 40, 30], [0, y, -zu], "wood");
  const yr = [rungs[0] + 40, H - 60];
  const parts: CustomPart[] = [
    rail(yr[0], 0),
    rail(yr[1], 1),
    ladder(-1, 0),
    ladder(1, 1),
    ...tops.map((y, i) => part(`S${i}`, "Shelf", [W, st, D - 10], [0, y - st / 2, 0], "wood")),
    part("X", "Cross wire", [2 * xl - uw, tops[2] - tops[0] - 60, 2], [0, (tops[0] + tops[2]) / 2, -D / 2 + 4], "metal", {
      pieces: (() => {
        const w = 2 * xl - uw, h = tops[2] - tops[0] - 60, len = Math.hypot(w, h), ang = Math.atan2(h, w);
        return [
          { shape: "box", size: [len, 3, 3], pos: [0, 0, 0], rot: [0, 0, ang] },
          { shape: "box", size: [len, 3, 3], pos: [0, 0, 0], rot: [0, 0, -ang] },
        ] as PartPiece[];
      })(),
    }),
  ];
  const xi = xl - uw / 2;
  const railEnd = (sx: number, ri: number): Vec3 => [sx * xi, yr[ri], -zu];
  const shelfJoint = (sx: number, i: number): Vec3 => [sx * xl, tops[i] - st, 0];
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the rails",
      detail: "Lay both rails on a rug. One dowel in each end.",
      fix: [0, 1].map((ri) => fix("dowel", [-1, 1].map((sx) => railEnd(sx, ri)), [1, 0, 0], `R${ri}`, undefined, 30, 8)),
      tools: ["hammer"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Bolt one rail to a ladder",
      detail: "Stand the ladder on its edge. One bolt through the back upright into the end of the rail.",
      add: ["L0", "R0"],
      fix: [fix("bolt", [[-xl - uw / 2, yr[0] - 12, -zu]], [1, 0, 0], "L0", "R0", 90, 6)],
      tools: ["allen"],
    },
    { title: "Bolt on the second rail", detail: "At the other end of the same ladder.", add: ["R1"], fix: [fix("bolt", [[-xl - uw / 2, yr[1] - 12, -zu]], [1, 0, 0], "L0", "R1", 90, 6)], tools: ["allen"] },
    {
      title: "Bolt the second ladder onto the rails",
      detail: "Holes facing the first ladder. One bolt into each rail.",
      add: ["L1"],
      fix: [fix("bolt", [0, 1].map((ri) => [xl + uw / 2, yr[ri] - 12, -zu] as Vec3), [-1, 0, 0], "L1", undefined, 90, 6)],
      tools: ["allen"],
    },
    {
      title: "Tap the dowels into the rungs",
      detail: "One in each rung a shelf rests on, eight in all.",
      fix: [-1, 1].map((sx, i) => fix("dowel", tops.map((_, k) => shelfJoint(sx, k)), UP, `L${i}`, undefined, 30, 8)),
      tools: ["hammer"],
    },
    {
      title: "Push the shelves through the ladders",
      detail: "Each one slides through both ladders and onto its dowels. Keep the red ends on the same side.",
      add: ["S0", "S1", "S2", "S3"],
      from: { S0: [-W * 0.7, 0, 0], S1: [-W * 0.7, 0, 0], S2: [-W * 0.7, 0, 0], S3: [-W * 0.7, 0, 0] },
    },
    {
      title: "Screw the ladders to the shelves and rails",
      detail: "Through the back uprights: one screw into each shelf and one more into each rail end.",
      fix: [
        ...[-1, 1].map((sx, i) => fix("screw", tops.map((y) => [sx * (xl + uw / 2), y - st / 2, -zu] as Vec3), [-sx, 0, 0], `L${i}`, undefined, 60, 5)),
        ...[-1, 1].map((sx, i) => fix("screw", [0, 1].map((ri) => [sx * (xl + uw / 2), yr[ri] + 12, -zu] as Vec3), [-sx, 0, 0], `L${i}`, undefined, 60, 5)),
      ],
      tools: ["allen"],
    },
    {
      title: "Stick the felt pads under the uprights",
      detail: "One on the bottom end of each upright.",
      fix: [fix("glide", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xl, 0, sz * zu] as Vec3)), UP, undefined, undefined, 3, 30)],
    },
    { title: "Stand it up together", detail: "Lift it by the ladders, not by the shelves.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Screw the shelves down onto the rungs",
      detail: "One screw up through each rung into the shelf above it.",
      fix: [-1, 1].map((sx, i) => fix("screw", tops.map((y) => [sx * xl, y - st - 30, D / 4] as Vec3), UP, `L${i}`, undefined, 60, 5)),
      tools: ["allen"],
    },
    {
      title: "Screw the cross wire across the back",
      detail: "Unfold it into an X and screw each end to a back upright. It keeps the shelving from leaning.",
      add: ["X"],
      fix: [-1, 1].map((sx, i) => fix("screw", [tops[0] + 30, tops[2] - 30].map((y) => [sx * xi, y, -D / 2 + 4] as Vec3), [sx, 0, 0], `L${i}`, undefined, 16, 4)),
      tools: ["screwdriver"],
      check: "square",
    },
    {
      title: "Fix it to the wall",
      detail: "Screw a wall fitting to the top of each back upright, then screw them to the wall. Wall plugs and screws aren't included: pick ones made for your wall.",
      fix: [
        fix("bracket", [-1, 1].map((sx) => [sx * xl, H, -zu] as Vec3), DOWN, undefined, undefined, 50, 40),
        fix("screw", [-1, 1].map((sx) => [sx * xl, H - 10, -zu] as Vec3), DOWN, undefined, undefined, 30, 4),
        fix("plug", [-1, 1].map((sx) => [sx * xl, H - 20, -D / 2] as Vec3), [0, 0, -1]),
        fix("washer", [-1, 1].map((sx) => [sx * xl, H - 20, -D / 2 + 2] as Vec3), [0, 0, -1], undefined, undefined, 2, 16),
        fix("screw", [-1, 1].map((sx) => [sx * xl, H - 20, -D / 2 + 3] as Vec3), [0, 0, -1], undefined, undefined, 50, 5),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS 2026 stool: a toothed post under the seat clamps beside a toothed post on the base ---------- */

function stool(s: ProductSpec): R {
  const H = mm(s.size.h), Dd = mm(s.size.w);
  const st = 45, bt = 55, pw = 54, pd = 70;
  const ys = H - st;
  const parts: CustomPart[] = [
    disc("S", "Seat", Dd, st, [0, ys + st / 2, 0], "wood"),
    part("U", "Seat post", [pw, 250, pd], [-pw / 2, ys - 125, 0], "wood"),
    // the strap wraps both posts, its two ends running on past them to hold the lever's pivot bolt
    part("C", "Clamp strap", [2 * pw + 56, 60, pd + 12], [20, 250, 0], "soft", {
      pieces: [
        { shape: "box", size: [2 * pw + 56, 60, 5], pos: [0, 0, pd / 2 + 3] },
        { shape: "box", size: [2 * pw + 56, 60, 5], pos: [0, 0, -pd / 2 - 3] },
        { shape: "box", size: [5, 60, pd + 12], pos: [pw - 15, 0, 0] },
      ],
    }),
    part("V", "Lever", [26, 110, 34], [pw + 22, 240, 12], "wood"),
    part("P", "Base plate", [200, 3, 200], [0, bt + 1.5, 0], "metal", { pieces: [{ shape: "cyl", size: [200, 3, 200], pos: [0, 0, 0] }] }),
    part("L", "Base post", [pw, 280, pd], [pw / 2, bt + 3 + 140, 0], "wood"),
    disc("B", "Base", Dd, bt, [0, bt / 2, 0], "wood"),
  ];
  const steps: CustomStep[] = [
    {
      title: "Push the barrel nut into the seat post",
      detail: "Into the hole across the top of the post, its slot facing up.",
      add: ["U"],
      fix: [fix("nut", [[-pw, ys - 40, 0]], [1, 0, 0], "U", undefined, 30, 10)],
      tools: ["flathead"],
    },
    { title: "Set the seat on the post", detail: "The square end of the post fits the square recess under the seat.", add: ["S"] },
    {
      title: "Bolt the seat to the post",
      detail: "Two bolts with spring washers down through the seat.",
      fix: [
        fix("washer", [-1, 1].map((sz) => [-pw / 2, H, sz * 18] as Vec3), DOWN, undefined, undefined, 2, 12),
        fix("bolt", [-1, 1].map((sz) => [-pw / 2, H, sz * 18] as Vec3), DOWN, "S", "U", 80, 6),
      ],
      tools: ["allen"],
    },
    {
      title: "Screw the strap onto the seat post",
      detail: "Stand the seat upside down on a rug. Two screws through the strap into the side of the post.",
      add: ["C"],
      fix: [fix("screw", [-1, 1].map((sz) => [-pw - 8, 250, sz * 18] as Vec3), [1, 0, 0], "C", "U", 20, 4)],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt the lever onto the strap",
      detail: "Through the loop at the end of the strap, one Allen key on each end.",
      add: ["V"],
      fix: [fix("bolt", [[pw + 22, 250, -pd / 2 - 6]], [0, 0, 1], "V", "C", 90, 6)],
      tools: ["allen"],
    },
    {
      title: "Fix the base plate to the base post",
      detail: "One bolt and two screws through the plate into the end of the post. Use a hand screwdriver, not a drill.",
      add: ["L", "P"],
      fix: [fix("bolt", [[pw / 2, bt, 0]], UP, "P", "L", 50, 8), fix("screw", [-1, 1].map((sz) => [pw / 2, bt, sz * 26] as Vec3), UP, "P", "L", 30, 4)],
      tools: ["allen", "screwdriver"],
      pose: "+y",
    },
    {
      title: "Screw the post onto the base",
      detail: "Four screws through the plate into the base.",
      add: ["B"],
      fix: [fix("screw", [0, 1, 2, 3].map((k) => [Math.cos((k * Math.PI) / 2 + Math.PI / 4) * 75, bt + 3, Math.sin((k * Math.PI) / 2 + Math.PI / 4) * 75] as Vec3), DOWN, "P", "B", 20, 4)],
      tools: ["screwdriver"],
    },
    {
      title: "Slide the seat post down beside the base post",
      detail: "Lever up, so the strap goes over the base post and the teeth meet.",
    },
    { title: "Press the lever down to lock it", detail: "The teeth hold the seat at that height. Lift the lever to move it." },
    {
      title: "Screw in the stop screw",
      detail: "With its washer, into the hole near the top of the base post. It stops the seat coming off.",
      fix: [fix("washer", [[pw, ys - 255 - 40, 0]], [-1, 0, 0], undefined, undefined, 2, 12), fix("screw", [[pw, ys - 255 - 40, 0]], [-1, 0, 0], "L", undefined, 20, 4)],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps, aside: [{ ids: ["S", "U", "C", "V"], until: 7, off: [-Dd - 100, -150, 0], from: [0, 300, 0] }] };
}

/* ---------- IKEA PS 2026 trolley: castors under the bottom tray, then trays and rod sections screwed up the middle ---------- */

function trolley(s: ProductSpec): R {
  const H = mm(s.size.h), Dd = mm(s.size.w);
  const ch = 75, th = 90, rd = 20;
  const trays = [
    { d: Dd, y: ch },
    { d: Math.round(Dd * 0.86), y: Math.round(H * 0.38) },
    { d: Math.round(Dd * 0.78), y: Math.round(H * 0.62) },
    { d: Math.round(Dd * 0.55), y: H - th },
  ];
  const parts: CustomPart[] = trays.map((t, i) => disc(`T${i}`, i === 3 ? "Top tray" : "Tray", t.d, th, [0, t.y + th / 2, 0], "metal"));
  for (let i = 0; i < 3; i++) {
    const y0 = trays[i].y + th, y1 = trays[i + 1].y;
    parts.push(part(`R${i}`, "Rod", [rd, y1 - y0, rd], [0, (y0 + y1) / 2, 0], "metal", { shape: "cyl" }));
  }
  const castors = Array.from({ length: 5 }, (_, k) => [Math.cos((k * 2 * Math.PI) / 5) * (Dd / 2 - 60), ch, Math.sin((k * 2 * Math.PI) / 5) * (Dd / 2 - 60)] as Vec3);
  const steps: CustomStep[] = [
    {
      title: "Screw the castors under the bottom tray",
      detail: "Turn the tray upside down. Screw each castor in by hand, then tighten it with the spanner. The two with brakes go opposite each other.",
      add: ["T0"],
      fix: [fix("castor", castors, DOWN, "T0")],
      tools: ["wrench"],
      pose: "-y",
    },
    {
      title: "Bolt the first rod into the bottom tray",
      detail: "Turn the tray over. One bolt from underneath, up into the rod.",
      add: ["R0"],
      fix: [fix("bolt", [[0, ch, 0]], UP, "T0", "R0", 20, 8)],
      tools: ["allen"],
      pose: "+y",
    },
    { title: "Slide the next tray onto the rod", detail: "Its threaded socket goes under it, onto the rod.", add: ["T1"] },
    { title: "Screw on the next rod", detail: "Into the socket through the middle of the tray, by hand until the tray is held tight.", add: ["R1"] },
    { title: "Slide on the third tray and screw on the last rod", detail: "The same way, by hand.", add: ["T2", "R2"] },
    { title: "Screw the top tray onto the rod", detail: "Turn the whole tray until it sits tight.", add: ["T3"] },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS 2026 easy chair: a chrome frame bolted upside down, then two inflatable cushions ---------- */

function easyChair(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const td = 25, xr = W / 2 - td / 2, zr = D / 2 - td / 2;
  const ys = 230; // seat ring
  const xsr = xr - 40, zsr = zr - 70;
  const ringPieces = (x: number, z: number): PartPiece[] => [
    { shape: "box", size: [2 * x + td, td, td], pos: [0, 0, -z] },
    { shape: "box", size: [2 * x + td, td, td], pos: [0, 0, z] },
    { shape: "box", size: [td, td, 2 * z - td], pos: [-x, 0, 0] },
    { shape: "box", size: [td, td, 2 * z - td], pos: [x, 0, 0] },
  ];
  const bd = 230, by = H - bd / 2, zb = -zsr + 10;
  const parts: CustomPart[] = [
    part("A", "Seat frame", [2 * xsr + td, ys + td / 2 - 30, 2 * zsr + td], [0, (ys + td / 2 + 30) / 2, 0], "metal", {
      pieces: [
        ...ringPieces(xsr, zsr).map((p) => ({ ...p, pos: [p.pos[0], ys - (ys + td / 2 + 30) / 2, p.pos[2]] as Vec3 })),
        { shape: "box", size: [td, ys - 30, td], pos: [-xsr, -td / 2, zsr] },
        { shape: "box", size: [td, ys - 30, td], pos: [xsr, -td / 2, zsr] },
      ],
    }),
    ...[-1, 1].map((sx, i) =>
      part(`P${i}`, "Back post", [td, by + bd / 2 - 30, bd + 20], [sx * (xsr + td), (by + bd / 2 + 30) / 2, zb], "metal", {
        pieces: [
          { shape: "box", size: [td, by - 30, td], pos: [0, -(bd / 2) / 2 - 2, 0] },
          { shape: "box", size: [td, bd + 20, td], pos: [0, by - (by + bd / 2 + 30) / 2, -bd / 2 - td / 2 + 10] },
          { shape: "box", size: [td, bd + 20, td], pos: [0, by - (by + bd / 2 + 30) / 2, bd / 2 + td / 2 - 10] },
          { shape: "box", size: [td, td, bd + 20], pos: [0, by + bd / 2 - (by + bd / 2 + 30) / 2 - td / 2, 0] },
        ],
      }),
    ),
    part("G", "Base ring", [W, 30, D], [0, 15, 0], "metal", { pieces: ringPieces(xr, zr).map((p) => ({ ...p, size: [p.size[0], 30, p.size[2]] as Vec3 })) }),
    part("C", "Back cushion", [2 * xsr + td, bd, bd], [0, by, zb], "soft", { shape: "cyl" }),
    part("Q", "Seat cushion", [2 * xsr - 10, mm(s.sofa?.seatH ?? 45) - ys - td / 2, 2 * zsr], [0, (mm(s.sofa?.seatH ?? 45) + ys + td / 2) / 2, 20], "soft"),
  ];
  const postFoot = (sx: number): Vec3 => [sx * (xsr + td), 30, zb];
  const steps: CustomStep[] = [
    {
      title: "Bolt the back posts to the seat frame",
      detail: "Lay the seat frame upside down on a cloth on a table, the hoops hanging over the edge. Turn the two bolts in loosely.",
      add: ["A", "P0", "P1"],
      fix: [-1, 1].map((sx, i) => fix("bolt", [[sx * (xsr + td + td / 2), ys, zb]], [-sx, 0, 0], `P${i}`, "A", 60, 8)),
      tools: ["allen"],
      pose: "-y",
      warnings: ["loose"],
    },
    {
      title: "Lay the base ring on and screw it to the back posts",
      detail: "Two screws, loosely for now.",
      add: ["G"],
      fix: [fix("screw", [-1, 1].map(postFoot), UP, "G", undefined, 16, 6)],
      tools: ["allen"],
    },
    {
      title: "Screw the base ring to the front legs",
      detail: "Four screws, still loosely.",
      fix: [fix("screw", [-1, 1].flatMap((sx) => [-12, 12].map((dz) => [sx * xsr, 30, zsr + dz] as Vec3)), UP, "G", "A", 16, 6)],
      tools: ["allen"],
    },
    { title: "Tighten all the bolts and screws", detail: "Six screws and the two bolts, now that the frame sits square.", tools: ["allen"], check: "square" },
    {
      title: "Thread the back cushion through the hoops",
      detail: "Turn the frame over. Slide the flat back cushion through both hoops and line it up in the middle.",
      add: ["C"],
      from: { C: [-W, 0, 0] },
      pose: "+y",
    },
    { title: "Pump up the back cushion", detail: "Open the cover, push the pump's hose onto the valve and pump with your foot until it is firm. Close the valve, then the zip." },
    { title: "Pump up the seat cushion", detail: "The same way: hose on the valve, pump until firm, valve shut, cover zipped." },
    { title: "Lay the seat cushion on the frame", detail: "Zip underneath, its front edge to the front.", add: ["Q"] },
    { title: "Press the cushions into shape", detail: "Push down in the middle of the seat so it settles evenly." },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS LÖMSK: bearings under the shell, the swivel and base clicked on face down, then the hood ---------- */

function lomsk(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h);
  const bd = 450, bt = 25, ph = 160;
  const sh = H - bt - ph - 10, sy = bt + ph + sh / 2;
  // the egg-shaped shell, drawn as a stack of round slices
  const n = 9, hb = sh / 2, slice = sh / n;
  const shell: PartPiece[] = Array.from({ length: n }, (_, i) => {
    const y = -hb + (i + 0.5) * slice;
    const d = Math.max(120, W * Math.sqrt(1 - (y / hb) ** 2));
    return { shape: "cyl", size: [d, slice + 1, d], pos: [0, y, 0] };
  });
  // the hood: a curved canopy over the top of the opening
  const hr = W / 2 + 10, hy = 120, hz = 90;
  const hood: PartPiece[] = [-0.15, 0.2, 0.55, 0.9].map((t) => ({
    shape: "box",
    size: [W * 0.7, 18, 160],
    pos: [0, hr * Math.cos(t) - hy, hr * Math.sin(t) - hz],
    rot: [t, 0, 0],
  }));
  const parts: CustomPart[] = [
    part("A", "Shell", [W, sh, W], [0, sy, 0], "board", { pieces: shell }),
    disc("Q", "Swivel ring", 300, 40, [0, bt + ph - 20, 0], "board"),
    disc("C", "Centre post", 160, ph - 40, [0, bt + (ph - 40) / 2, 0], "board"),
    disc("B", "Base", bd, bt, [0, bt / 2, 0], "board"),
    part("O", "Hood", [W * 0.7, 200, 330], [0, sy + hy, hz], "soft", { pieces: hood }),
    part("M", "Seat cushion", [380, 40, 380], [0, sy - 60, W / 2 - 150], "soft", { pieces: [{ shape: "cyl", size: [380, 40, 380], pos: [0, 0, 0], rot: [0.9, 0, 0] }] }),
  ];
  const ring = (r: number, n: number, y: number) => Array.from({ length: n }, (_, k) => [Math.cos((k * 2 * Math.PI) / n) * r, y, Math.sin((k * 2 * Math.PI) / n) * r] as Vec3);
  const ySh = sy - sh / 2;
  const steps: CustomStep[] = [
    {
      title: "Click the bearings into the bottom of the shell",
      detail: "Lay the shell face down on a rug. Push each pin and ring into its holder and click the eight holders in.",
      add: ["A", "M"],
      fix: [fix("clip", ring(120, 8, ySh), UP, "A", undefined, 20, 22), fix("washer", ring(120, 8, ySh - 1), UP, undefined, undefined, 3, 18), fix("stud", ring(120, 8, ySh - 2), UP, "A", undefined, 14, 6)],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Fit the swivel ring over the bearings", detail: "Its ribbed side towards the shell.", add: ["Q"] },
    { title: "Click the centre post into the ring", detail: "Line up its tabs, then press until all four click.", add: ["C"] },
    { title: "Lay the base on", detail: "Centred over the post, holes lined up.", add: ["B"] },
    { title: "Screw in the first screw", detail: "One screw through the base into the post, so it can't slip.", fix: [fix("screw", [[0, 0, 40]], UP, "B", "C", 20, 4)], tools: ["screwdriver"] },
    {
      title: "Screw the base to the post",
      detail: "Seven more screws round the middle.",
      fix: [fix("screw", ring(55, 7, 0), UP, "B", "C", 20, 4)],
      tools: ["screwdriver"],
    },
    {
      title: "Stand it up and clip the hood on",
      detail: "Hook both ends of the hood into the slots at the sides of the opening.",
      add: ["O"],
      pose: "+y",
    },
    {
      title: "Bolt the hood on at one side",
      detail: "Hold the sleeve with one key and turn the bolt with the other.",
      fix: [fix("bolt", [[-W * 0.4, sy + 60, 60]], [1, 0, 0], "O", "A", 30, 6)],
      tools: ["allen"],
    },
    { title: "Bolt it on at the other side", detail: "The same way.", fix: [fix("bolt", [[W * 0.4, sy + 60, 60]], [-1, 0, 0], "O", "A", 30, 6)], tools: ["allen"] },
    { title: "Fasten the hood's fabric", detail: "Pull the fabric over the back edge and clip its strip into the slot." },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS 2026 chair-bed: a steel loop threaded under the folded foam body, two holders and two feet ---------- */

function chairBed(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const seatTop = mm(s.sofa?.seatH ?? 41);
  const tube = 25, yb = tube + 5;
  const baseH = 200, backD = 280;
  const parts: CustomPart[] = [
    part("A", "Base cushion", [W, baseH, D - 20], [0, yb + baseH / 2, 0], "soft"),
    part("B", "Seat cushion", [W, seatTop - yb - baseH, D - 20 - backD], [0, (seatTop + yb + baseH) / 2, backD / 2], "soft"),
    part("C", "Back cushion", [W, H - yb - baseH, backD], [0, (H + yb + baseH) / 2, -(D - 20) / 2 + backD / 2], "soft"),
    ...[-1, 1].map((sx, i) =>
      part(`T${i}`, "Tube half", [W / 2 - 40, tube, D - 80], [sx * (W / 4 - 20), tube / 2 + 2, 0], "metal", {
        pieces: [
          { shape: "box", size: [W / 2 - 40, tube, tube], pos: [0, 0, -(D - 80) / 2 + tube / 2] },
          { shape: "box", size: [W / 2 - 40, tube, tube], pos: [0, 0, (D - 80) / 2 - tube / 2] },
          { shape: "box", size: [tube, tube, D - 80], pos: [sx * (W / 4 - 20 - tube / 2), 0, 0] },
        ],
      }),
    ),
    ...[-1, 1].map((sx, i) => part(`H${i}`, "Holder", [50, 40, 60], [sx * (W / 2 - 70), 22, D / 2 - 90], "board")),
    ...[-1, 1].map((sx, i) => part(`K${i}`, "Foot", [60, 30, 140], [sx * (W / 2 - 70), 15, -D / 2 + 110], "board")),
  ];
  const steps: CustomStep[] = [
    {
      title: "Lay the chair on its back and thread the tube halves through the loops",
      detail: "On a rug, with the bottom facing you. Push each half through the fabric loops under the chair.",
      add: ["A", "B", "C", "T0", "T1"],
      pose: "+z",
      warnings: ["floor"],
    },
    {
      title: "Join the two halves",
      detail: "Push the ends into each other at both joins until the holes line up. Keep your fingers out of the joins.",
      fix: [fix("connector", [-1, 1].map((sz) => [0, 15, sz * ((D - 80) / 2 - tube / 2)] as Vec3), [1, 0, 0], "T0", "T1", 60, 30)],
      warnings: ["hand"],
    },
    {
      title: "Bolt the tube to the chair",
      detail: "Two bolts, one through each side of the tube into the base.",
      fix: [-1, 1].map((sx, i) => fix("bolt", [[sx * (W / 2 - 40), 15, 0]], UP, `T${i}`, "A", 20, 6)),
      tools: ["allen"],
    },
    {
      title: "Screw on the two holders",
      detail: "Over the tube at the front corners, one screw each.",
      add: ["H0", "H1"],
      fix: [-1, 1].map((sx, i) => fix("screw", [[sx * (W / 2 - 70), 2, D / 2 - 90]], UP, `H${i}`, "A", 30, 4)),
      tools: ["screwdriver"],
    },
    {
      title: "Screw on the two feet",
      detail: "At the back corners, one screw each. The curved side faces the back.",
      add: ["K0", "K1"],
      fix: [-1, 1].map((sx, i) => fix("screw", [[sx * (W / 2 - 70), 0, -D / 2 + 110]], UP, `K${i}`, "A", 30, 4)),
      tools: ["screwdriver"],
    },
    { title: "Stand it up and fold up the back", detail: "Turn it onto its feet, then lift the back cushion upright.", pose: "+y" },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS 2026 3-seat sofa-bed: a pine frame on four legs, slats, a backrest, then the mattress and cushions ---------- */

function sofaBed(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const ld = 70, lh = 200, bw = 50, bh = 80;
  const xe = W / 2 - ld / 2, ze = D / 2 - ld / 2 - 40;
  const yBeam = 150;
  const seatTop = mm(s.sofa?.seatH ?? 41);
  const slatT = 20, yS = yBeam + bh / 2;
  const postH = 720 - lh;
  const end = (sx: number, i: number) =>
    part(`E${i}`, "End frame", [ld, 720, 2 * ze + ld], [sx * xe, 360, 0], "wood", {
      pieces: [
        { shape: "cyl", size: [ld, lh, ld], pos: [0, lh / 2 - 360, -ze] },
        { shape: "cyl", size: [ld, lh, ld], pos: [0, lh / 2 - 360, ze] },
        { shape: "box", size: [bw, bh, 2 * ze - ld], pos: [0, yBeam - 360, 0] },
        { shape: "box", size: [bw, postH, 80], pos: [0, lh + postH / 2 - 360, -ze] },
      ],
    });
  const xi = xe - bw / 2;
  const railL = 2 * xi;
  const zr = ze - 20;
  const slatZ = [-0.33, -0.11, 0.11, 0.33].map((f) => Math.round(f * 2 * ze));
  const parts: CustomPart[] = [
    end(-1, 0),
    end(1, 1),
    ...[-1, 1].map((sz, i) => part(`R${i}`, "Long rail", [railL, bh, 40], [0, yBeam, sz * zr], "wood")),
    part("M", "Middle rail", [bw, bh, 2 * zr - 40], [0, yBeam, 0], "wood"),
    ...slatZ.map((z, i) => part(`S${i}`, "Slat", [2 * xe + 30, slatT, 180], [0, yS + slatT / 2, z], "wood")),
    part("K", "Backrest", [W - 40, 170, 25], [0, 640, -ze - 52], "wood"),
    part("T", "Mattress", [W - 2 * ld - 20, seatTop - yS - slatT, 2 * ze + ld - 20], [0, (seatTop + yS + slatT) / 2, 0], "soft"),
    ...[-1, 1].map((sx, i) => part(`C${i}`, "Back cushion", [W / 2 - ld - 40, 260, 200], [sx * (W / 4 - ld / 2 + 10), seatTop + 130, -ze + 80], "soft", { shape: "cyl" })),
  ];
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  const slatScrews = (ids: number[]) =>
    ids.map((i) => fix("screw", [-1, 1].flatMap((sx) => [-50, 50].map((dz) => [sx * xe, yS + slatT, slatZ[i] + dz] as Vec3)), DOWN, `S${i}`, undefined, 40, 5));
  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the end frames",
      detail: "Lay them on a rug, inside face up. Two where each long rail meets, eight in all.",
      fix: [-1, 1].map((sx, i) => fix("dowel", [-1, 1].flatMap((sz) => [yBeam - 20, yBeam + 20].map((y) => [sx * xi, y, sz * zr] as Vec3)), [-sx, 0, 0], `E${i}`, undefined, 30, 8)),
      tools: ["hammer"],
      warnings: ["floor"],
    },
    {
      title: "Push the glides into the legs",
      detail: "One into the bottom of each leg.",
      fix: [fix("glide", corners.map(([sx, sz]) => [sx * xe, 0, sz * ze] as Vec3), UP, undefined, undefined, 6, 40)],
    },
    {
      title: "Tap two dowels into the middle rail",
      detail: "One in each end.",
      fix: [fix("dowel", [-1, 1].map((sz) => [0, yBeam, sz * (zr - 20)] as Vec3), [0, 0, 1], "M", undefined, 30, 8)],
      tools: ["hammer"],
    },
    {
      title: "Screw the middle rail between the long rails",
      detail: "One screw through each long rail into the end of the middle rail.",
      add: ["R0", "R1", "M"],
      fix: [-1, 1].map((sz, i) => fix("screw", [[0, yBeam, sz * (zr + 20)]], [0, 0, -sz], `R${i}`, "M", 60, 5)),
      tools: ["allen"],
    },
    {
      title: "Push the barrel nuts into the long rails",
      detail: "Two at each end, slots lined up with the bolt holes.",
      fix: [fix("nut", corners.flatMap(([sx, sz]) => [yBeam - 20, yBeam + 20].map((y) => [sx * (xi - 50), y, sz * zr] as Vec3)).slice(0, 8), UP, undefined, undefined, 20, 10)],
      tools: ["flathead"],
    },
    {
      title: "Bolt the end frames to the rails",
      detail: "Two long bolts at each corner, the back posts at the back.",
      add: ["E0", "E1"],
      fix: [-1, 1].map((sx, i) => fix("bolt", [-1, 1].flatMap((sz) => [yBeam - 20, yBeam + 20].map((y) => [sx * (xe + ld / 2), y, sz * zr] as Vec3)), [-sx, 0, 0], `E${i}`, undefined, 100, 6)),
      tools: ["allen"],
      check: "square",
    },
    {
      title: "Stick the felt pads on the rails",
      detail: "Twelve along the tops of the rails, where the slats will lie, so they don't creak.",
      fix: [
        fix(
          "glide",
          [-1, 1].flatMap((sz) => [-0.4, -0.13, 0.13, 0.4].map((f) => [f * railL, yBeam + bh / 2, sz * zr] as Vec3)).concat([-0.3, -0.1, 0.1, 0.3].map((f) => [0, yBeam + bh / 2, f * 2 * zr] as Vec3)),
          DOWN,
          undefined,
          undefined,
          3,
          30,
        ),
      ],
    },
    { title: "Screw down the first slat", detail: "At the front, two screws at each end into the end frame's beam.", add: ["S3"], fix: slatScrews([3]), tools: ["allen"] },
    { title: "Screw down the two middle slats", detail: "Spaced evenly, the marks on the rails show where.", add: ["S1", "S2"], fix: slatScrews([1, 2]), tools: ["allen"] },
    { title: "Screw down the last slat", detail: "At the back, against the back posts.", add: ["S0"], fix: slatScrews([0]), tools: ["allen"] },
    {
      title: "Tap the dowels into the back posts",
      detail: "Two in each post, on the front face near the top.",
      fix: [-1, 1].map((sx, i) => fix("dowel", [600, 680].map((y) => [sx * xe, y, -ze - 40] as Vec3), [0, 0, -1], `E${i}`, "K", 30, 8)),
      tools: ["hammer"],
    },
    {
      title: "Screw the backrest onto the posts",
      detail: "Onto the dowels, then two screws into each post from the back.",
      add: ["K"],
      fix: [-1, 1].map((sx, i) => fix("screw", [600, 680].map((y) => [sx * xe, y, -ze - 65] as Vec3), [0, 0, 1], "K", `E${i}`, 60, 5)),
      tools: ["allen"],
    },
    { title: "Lay the mattress on the slats", detail: "Unpack it and let it fill out first: it can take up to 72 hours to reach its full shape.", add: ["T"], people: 2, warnings: ["two"] },
    { title: "Pull the cover over the mattress", detail: "Corners first, then smooth it along the sides." },
    { title: "Fasten the cover under the frame", detail: "Press the tabs onto the strips under the long rails all the way round." },
    { title: "Fill the back cushions and lay them on", detail: "Unroll each cushion into its cover and zip it, then set them against the backrest.", add: ["C0", "C1"], repeat: 2 },
  ];
  // the end frames wait to the sides while the rails go together between them
  const out = (sx: number, i: number): Aside => ({ ids: [`E${i}`], until: 5, off: [sx * 350, 0, 0], from: [sx * 300, 0, 0] });
  return { parts, steps, aside: [out(-1, 0), out(1, 1)] };
}

/* ---------- IKEA PS 2026 cabinet, pine: the carcass lying on its side, a plinth under the bottom, top, doors, shelves ---------- */

function pineCabinet(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const t = 18, ph = 80, y0 = ph + t, y1 = H - t, Hs = y1 - y0, ym = (y0 + y1) / 2;
  const dz = D - t, zc = -t / 2, zb = -D / 2 + t / 2, zf = D / 2 - t;
  const xs = W / 2 - t / 2, xi = W / 2 - t, iw = W - 2 * t;
  const pz0 = -D / 2 + 30, pz1 = zf - 40; // the plinth, set in from the front
  const px = W / 2 - 30 - t / 2;
  const shelfY = [0.28, 0.5, 0.72].map((f) => Math.round(y0 + Hs * f));
  const hd = H - t - ph - 4, yd = (ph + H - t) / 2;
  const parts: CustomPart[] = [
    ...[-1, 1].map((sx, i) => part(`S${i}`, "Side panel", [t, Hs, dz], [sx * xs, ym, zc], "wood")),
    part("B0", "Back panel", [iw, Hs / 2, t], [0, y0 + Hs / 4, zb], "wood"),
    part("B1", "Back panel", [iw, Hs / 2, t], [0, y1 - Hs / 4, zb], "wood"),
    part("R0", "Rail", [iw, t, 80], [0, y1 - t / 2, zf - 40], "wood"),
    part("R1", "Rail", [iw, t, 80], [0, y0 + t / 2, zf - 40], "wood"),
    part("P", "Plinth front", [2 * px - t, ph, t], [0, ph / 2, pz1 - t / 2], "wood"),
    ...[-1, 1].map((sx, i) => part(`Q${i}`, "Plinth side", [t, ph, pz1 - pz0], [sx * px, ph / 2, (pz0 + pz1) / 2], "wood")),
    part("F", "Bottom panel", [W, t, dz], [0, ph + t / 2, zc], "wood"),
    part("T", "Top panel", [W, t, dz], [0, H - t / 2, zc], "wood"),
    ...[-1, 1].map((sx, i) => part(`O${i}`, "Door", [W / 2 - 3, hd, t], [sx * (W / 4), yd, D / 2 - t / 2], "wood")),
    ...shelfY.map((y, i) => part(`H${i}`, "Shelf", [iw - 2, t, dz - t - 20], [0, y, zc - t / 2 - 10], "wood")),
  ];
  const zs = [-dz / 2 + 60, zc, dz / 2 - 80];
  // eight in the first side: three for each back half and one for each rail; the other side only takes the rails
  const pinsS0: [number, number][] = [...[ym - Hs / 4, ym + Hs / 4].flatMap((y) => [-80, 0, 80].map((dy) => [y + dy, zb] as [number, number])), [y1 - t / 2, zf - 40], [y0 + t / 2, zf - 40]];
  const sidePt = (sx: number, y: number, z: number): Vec3 => [sx * xi, y, z];
  const camsIn = (on: string, pts: Vec3[], dir: Vec3) => fix("cam", pts, dir, on, undefined, 13, 15);
  const edgeDowels = (y: number) => [-1, 1].flatMap((sx) => [zs[0], zs[2]].map((z) => [sx * xs, y, z] as Vec3));
  const steps: CustomStep[] = [
    {
      title: "Screw the cam pins into the side panels",
      detail: "Lay both sides on a rug, inside face up. Eight in one side, two in the other.",
      fix: [
        fix("camScrew", pinsS0.map(([y, z]) => sidePt(-1, y, z)), [-1, 0, 0], "S0", undefined, 34, 7),
        fix("camScrew", [sidePt(1, y1 - t / 2, zf - 40), sidePt(1, y0 + t / 2, zf - 40)], [1, 0, 0], "S1", undefined, 34, 7),
      ],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Tap the small dowels into the back panels",
      detail: "Into the long edge where the two halves meet. Use the short dowels.",
      fix: [fix("dowel", [-iw / 3, -iw / 9, iw / 9, iw / 3].map((x) => [x, ym, zb] as Vec3), [0, -1, 0], "B0", "B1", 25, 6)],
      tools: ["hammer"],
    },
    {
      title: "Stand the back panels in the side and lock them",
      detail: "Push them together onto the dowels, then down onto the cam pins. Six cam locks, three in each half.",
      add: ["S0", "B0", "B1"],
      fix: [camsIn("B0", [-80, 0, 80].map((dy) => [-xi + 30, y0 + Hs / 4 + dy, zb] as Vec3), [0, 0, 1]), camsIn("B1", [-80, 0, 80].map((dy) => [-xi + 30, y1 - Hs / 4 + dy, zb] as Vec3), [0, 0, 1])],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the small dowels into the rails",
      detail: "Two in each end of both rails.",
      fix: [0, 1].map((i) => fix("dowel", [-1, 1].flatMap((sx) => [-20, 20].map((dz2) => [sx * (iw / 2), i ? y0 + t / 2 : y1 - t / 2, zf - 40 + dz2] as Vec3)), [1, 0, 0], `R${i}`, undefined, 25, 6)),
      tools: ["hammer"],
    },
    {
      title: "Push the rails into the side and lock them",
      detail: "One at each end of the side, at the front. One cam lock in each.",
      add: ["R0", "R1"],
      fix: [0, 1].map((i) => camsIn(`R${i}`, [[-xi + 30, i ? y0 + t : y1 - t, zf - 40]], [0, i ? -1 : 1, 0])),
      tools: ["screwdriver"],
    },
    {
      title: "Swing the other side on and lock it",
      detail: "Lower it onto the back panels and the rail ends, then turn the two cam locks in the rails.",
      add: ["S1"],
      fix: [0, 1].map((i) => camsIn(`R${i}`, [[xi - 30, i ? y0 + t : y1 - t, zf - 40]], [0, i ? -1 : 1, 0])),
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the ends of the sides",
      detail: "Two at the top and two at the bottom of each side.",
      fix: [fix("dowel", [...edgeDowels(y1), ...edgeDowels(y0)], UP, undefined, undefined, 40, 8)],
      tools: ["hammer"],
    },
    {
      title: "Tap two dowels into the plinth front",
      detail: "One in each end.",
      fix: [fix("dowel", [-1, 1].map((sx) => [sx * (px - t / 2), ph / 2, pz1 - t / 2] as Vec3), [1, 0, 0], "P", undefined, 40, 8)],
      tools: ["hammer"],
      pose: "+y",
    },
    {
      title: "Screw a cam pin into each plinth side",
      detail: "Into the inside face near the front end.",
      fix: [-1, 1].map((sx, i) => fix("camScrew", [[sx * (px - t / 2), ph / 2, pz1 - t - 40]], [sx, 0, 0], `Q${i}`, undefined, 34, 7)),
      tools: ["screwdriver"],
    },
    {
      title: "Join the plinth sides to the front",
      detail: "Onto the dowels, then turn the two cam locks in the front.",
      add: ["P", "Q0", "Q1"],
      fix: [camsIn("P", [-1, 1].map((sx) => [sx * (px - 50), ph / 2, pz1 - t] as Vec3), [0, 0, 1])],
      tools: ["screwdriver"],
    },
    {
      title: "Tap the dowels into the top of the plinth",
      detail: "Two in the front and two in each side.",
      fix: [
        fix("dowel", [-1, 1].map((sx) => [sx * (px / 2), ph, pz1 - t / 2] as Vec3), UP, "P", "F", 40, 8),
        ...[-1, 1].map((sx, i) => fix("dowel", [pz0 + 60, pz1 - 80].map((z) => [sx * px, ph, z] as Vec3), UP, `Q${i}`, "F", 40, 8)),
      ],
      tools: ["hammer"],
    },
    {
      title: "Screw the cam pins under the bottom panel",
      detail: "Four, into the holes along its edges.",
      add: ["F"],
      fix: [fix("camScrew", [[-px / 2, ph, pz1 - 50], [px / 2, ph, pz1 - 50], [-px, ph, (pz0 + pz1) / 2], [px, ph, (pz0 + pz1) / 2]], DOWN, "F", undefined, 34, 7)],
      tools: ["screwdriver"],
      pose: "-y",
    },
    {
      title: "Fit the plinth onto the bottom panel",
      detail: "Upside down, onto the dowels and cam pins, then turn its four cam locks.",
      fix: [
        camsIn("P", [-1, 1].map((sx) => [sx * (px / 2), ph - 30, pz1 - t] as Vec3), [0, 0, 1]),
        ...[-1, 1].map((sx, i) => camsIn(`Q${i}`, [[sx * (px - t / 2), ph - 30, (pz0 + pz1) / 2]], [-sx, 0, 0])),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Turn it over and screw in the cam pins",
      detail: "Five in the top of the bottom panel, for the carcass.",
      fix: [fix("camScrew", [[-xs, y0, zs[1]], [xs, y0, zs[1]], [-xs, y0, zs[2]], [xs, y0, zs[2]], [0, y0, zb]], UP, "F", undefined, 34, 7)],
      tools: ["screwdriver"],
      pose: "+y",
    },
    {
      title: "Fit the carcass onto the bottom panel",
      detail: "Lay the carcass on its back and push the bottom panel on, then turn the five cam locks.",
      fix: [
        ...[-1, 1].map((sx, i) => camsIn(`S${i}`, [zs[1], zs[2]].map((z) => [sx * xi, y0 + 30, z] as Vec3), [-sx, 0, 0])),
        camsIn("B0", [[0, y0 + 30, zb + t / 2]], [0, 0, -1]),
      ],
      tools: ["screwdriver"],
      pose: "+z",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Stick the felt pads under the plinth and stand it up",
      detail: "One under each corner of the plinth, then lift it upright together.",
      fix: [fix("glide", [-1, 1].flatMap((sx) => [pz0 + 30, pz1 - 30].map((z) => [sx * px, 0, z] as Vec3)), UP, undefined, undefined, 3, 30)],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Screw the cam pins under the top panel",
      detail: "Five, the same as the bottom.",
      fix: [fix("camScrew", [[-xs, y1, zs[1]], [xs, y1, zs[1]], [-xs, y1, zs[2]], [xs, y1, zs[2]], [0, y1, zb]], DOWN, "T", undefined, 34, 7)],
      tools: ["screwdriver"],
    },
    {
      title: "Fit the top panel and lock it",
      detail: "Onto the dowels and cam pins, then turn the five cam locks.",
      add: ["T"],
      fix: [...[-1, 1].map((sx, i) => camsIn(`S${i}`, [zs[1], zs[2]].map((z) => [sx * xi, y1 - 30, z] as Vec3), [-sx, 0, 0])), camsIn("B1", [[0, y1 - 30, zb + t / 2]], [0, 0, -1])],
      tools: ["screwdriver"],
    },
    {
      title: "Fix it to the wall",
      detail: "Two screws with washers through the top of the back into the wall. Wall plugs and screws aren't included: pick ones made for your wall.",
      fix: [
        fix("plug", [-1, 1].map((sx) => [sx * (W / 4), y1 - 40, -D / 2] as Vec3), [0, 0, -1]),
        fix("washer", [-1, 1].map((sx) => [sx * (W / 4), y1 - 40, zb + t / 2] as Vec3), [0, 0, -1], "B1", undefined, 2, 16),
        fix("screw", [-1, 1].map((sx) => [sx * (W / 4), y1 - 40, zb + t / 2 + 1] as Vec3), [0, 0, -1], "B1", undefined, 50, 5),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Screw the hinges onto the doors",
      detail: "Lay the doors on a rug, inside up. Two hinges on each, near the outer edge.",
      add: ["O0", "O1"],
      fix: [-1, 1].map((sx, i) => fix("hinge", [yd - hd / 2 + 120, yd + hd / 2 - 120].map((y) => [sx * (W / 2 - 40), y, D / 2 - t] as Vec3), [0, 0, 1], `O${i}`)),
      tools: ["screwdriver"],
    },
    {
      title: "Hang the doors",
      detail: "Clip each hinge onto its plate inside the side, then turn the screws until the gaps look even.",
      tools: ["screwdriver"],
      kind: "doors",
    },
    {
      title: "Push in the shelf pins",
      detail: "Four for each shelf, at the same height on both sides.",
      fix: [-1, 1].map((sx, i) => fix("pin", shelfY.flatMap((y) => [zb + 80, zf - 80].map((z) => [sx * xi, y - t / 2 - 3, z] as Vec3)), [sx, 0, 0], `S${i}`, undefined, 16, 5)),
    },
    { title: "Lay the shelves on the pins", detail: "Tilt each one in, then lower it flat.", add: ["H0", "H1", "H2"] },
  ];
  const carcass = ["S0", "S1", "B0", "B1", "R0", "R1"];
  return {
    parts,
    steps,
    aside: [
      // the second side lies on the rug beside the first until it swings on; then the whole carcass waits aside for the plinth
      { ids: ["S1"], until: 5, off: [-2 * xs, 0, D + 120], rot: [0, Math.PI, 0], from: [300, 0, 0] },
      { ids: carcass, until: 14, off: [W + 300, -y0, 0], from: [0, 300, 0] },
      { ids: ["O0", "O1"], until: 20, off: [0, t / 2 - yd, hd / 2 + D], rot: [-Math.PI / 2, 0, 0], from: [0, 0, 300] },
    ],
  };
}

/* ---------- IKEA PS cabinet, steel: frames hooked together on their legs, panels dropped in, doors on pins ---------- */

function steelCabinet(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const lh = 100, tb = 20, pt = 8; // legs, frame tube, sheet steel
  const yb = lh + tb, yt = H - pt, hf = yt - lh; // the frames run from the base rails to under the top
  const xe = W / 2 - pt - tb / 2, ze = D / 2 - pt - tb / 2;
  const rect = (w: number, h: number): PartPiece[] => [
    { shape: "box", size: [tb, tb, w], pos: [0, h / 2 - tb / 2, 0] },
    { shape: "box", size: [tb, tb, w], pos: [0, -h / 2 + tb / 2, 0] },
    { shape: "box", size: [tb, h, tb], pos: [0, 0, -w / 2 + tb / 2] },
    { shape: "box", size: [tb, h, tb], pos: [0, 0, w / 2 - tb / 2] },
  ];
  const legFrame = (sz: number, id: string) =>
    part(id, "Leg frame", [2 * xe + tb, lh + tb, tb], [0, (lh + tb) / 2, sz * ze], "metal", {
      pieces: [
        { shape: "box", size: [tb, lh + tb, tb], pos: [-xe, 0, 0] },
        { shape: "box", size: [tb, lh + tb, tb], pos: [xe, 0, 0] },
        { shape: "box", size: [2 * xe - tb, tb, tb], pos: [0, lh / 2, 0] },
      ],
    });
  const frame = (x: number, id: string, name: string) => part(id, name, [tb, hf, 2 * ze + tb], [x, lh + hf / 2, 0], "metal", { pieces: rect(2 * ze + tb, hf) });
  const cw = W / 2 - pt - tb; // each compartment
  const yd = (yb + yt) / 2, hd = yt - yb - 6;
  const parts: CustomPart[] = [
    frame(0, "M", "Middle frame"),
    part("G", "Door stop", [tb, hd, 10], [0, yd, ze + tb / 2 + 5], "metal"),
    legFrame(1, "LF"),
    legFrame(-1, "LB"),
    frame(xe, "E1", "End frame"),
    frame(-xe, "E0", "End frame"),
    ...[-1, 1].map((sx, i) => part(`P${i}`, "Side panel", [pt, hf, D], [sx * (W / 2 - pt / 2), lh + hf / 2, 0], "metal")),
    ...[-1, 1].map((sx, i) => part(`K${i}`, "Back panel", [cw, hf - tb, pt], [sx * (cw / 2 + tb / 2), lh + tb + (hf - tb) / 2, -ze - tb / 2 - pt / 2 + pt], "metal")),
    ...[-1, 1].map((sx, i) => part(`F${i}`, "Bottom", [cw, pt, 2 * ze - tb], [sx * (cw / 2 + tb / 2), yb + pt / 2, 0], "metal")),
    part("T", "Top", [W, pt, D], [0, H - pt / 2, 0], "metal"),
    ...[-1, 1].map((sx, i) => part(`H${i}`, "Shelf", [cw - 10, pt, 2 * ze - tb - 10], [sx * (cw / 2 + tb / 2), Math.round(yb + (yt - yb) * 0.5), 0], "metal")),
    ...[-1, 1].map((sx, i) => part(`O${i}`, "Door", [W / 2 - 8, hd, pt], [sx * (W / 4), yd, D / 2 + pt / 2], "metal")),
  ];
  const hinge = (sx: number, y: number): Vec3 => [sx * (W / 2 - 14), y, D / 2 + pt / 2];
  const ysh = Math.round(yb + (yt - yb) * 0.5) - pt;
  const steps: CustomStep[] = [
    {
      title: "Hook the middle frame onto the front leg frame",
      detail: "Its foot drops into the slot in the middle of the rail. Then turn the door stop into the slot at the front of the middle frame.",
      add: ["LF", "M", "G"],
    },
    { title: "Hook on the back leg frame", detail: "The other foot of the middle frame drops into its slot.", add: ["LB"] },
    { title: "Click on one end frame", detail: "Press it down over the ends of both leg frames until it clicks.", add: ["E1"] },
    { title: "Click on the other end frame and hang a side panel", detail: "Hook the side panel over the top of the first end frame and press it down until it clicks.", add: ["E0", "P1"] },
    { title: "Drop in the first back panel", detail: "Slide it down into the channels at the back, then swing it in at the bottom.", add: ["K0"] },
    { title: "Drop in the second back panel", detail: "The same way, into the other half.", add: ["K1"] },
    {
      title: "Lock the back panels",
      detail: "Bend the tabs over with a flat screwdriver, two at each end frame.",
      fix: [fix("clip", [-1, 1].flatMap((sx) => [yb + 60, yt - 60].map((y) => [sx * (xe - tb / 2), y, -ze] as Vec3)), [0, 0, -1], undefined, undefined, 12, 10)],
      tools: ["flathead"],
    },
    { title: "Lay in the first bottom", detail: "Hook its back edge under the rail, then swing it down flat.", add: ["F0"] },
    { title: "Lay in the second bottom", detail: "The same way, in the other half.", add: ["F1"] },
    { title: "Hang the other side panel", detail: "Hook it over the top of the end frame and swing it down until it clicks.", add: ["P0"] },
    { title: "Lower the top on", detail: "Hook it on at the back, then lower the front until the slots catch the frames.", add: ["T"] },
    {
      title: "Fix it to the wall",
      detail: "Two screws through the holes at the top of the back. Wall plugs and screws aren't included: pick ones made for your wall.",
      fix: [
        fix("plug", [-1, 1].map((sx) => [sx * (W / 4), yt - 60, -D / 2] as Vec3), [0, 0, -1]),
        fix("screw", [-1, 1].map((sx) => [sx * (W / 4), yt - 60, -D / 2 + pt] as Vec3), [0, 0, -1], undefined, undefined, 50, 5),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    {
      title: "Hang the shelves on the clips",
      detail: "Three clips for each shelf: two on the end frame, one on the middle frame. Then lay the shelf on them.",
      add: ["H0", "H1"],
      fix: [
        fix("clip", [-1, 1].flatMap((sx) => [-ze + 60, ze - 60].map((z) => [sx * (xe - tb / 2), ysh, z] as Vec3)), [0, -1, 0], undefined, undefined, 25, 12),
        fix("clip", [-1, 1].map((sx) => [sx * (tb / 2), ysh, 0] as Vec3), [0, -1, 0], undefined, undefined, 25, 12),
      ],
    },
    {
      title: "Hang the doors on the top pins",
      detail: "Push a pin down through the top hinge hole of each door.",
      add: ["O0", "O1"],
      fix: [fix("pin", [-1, 1].map((sx) => hinge(sx, yt)), DOWN, undefined, undefined, 30, 6)],
    },
    {
      title: "Fit the bottom pins with their washers",
      detail: "A washer between the door and the frame, then push the pin up into the hinge.",
      fix: [fix("washer", [-1, 1].map((sx) => hinge(sx, yb)), UP, undefined, undefined, 2, 12), fix("pin", [-1, 1].map((sx) => hinge(sx, yb - 2)), UP, undefined, undefined, 30, 6)],
    },
  ];
  return { parts, steps };
}

/* ---------- IKEA PS 2026 glass-door cabinet: built on its side from two mesh side frames and four rails, then stood up ---------- */

function glassCabinet(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const tb = 20, ft = 30, pt = 15;
  const yb = 150, yt = H - pt - tb / 2; // bottom and top rails
  const xs = W / 2 - tb / 2, zp = D / 2 - tb / 2;
  const fh = H - pt - ft, fy = ft + fh / 2;
  const sideFrame = (sx: number, i: number) =>
    part(`S${i}`, "Side frame", [tb, fh, D], [sx * xs, fy, 0], "metal", {
      pieces: [
        { shape: "box", size: [tb, fh, tb], pos: [0, 0, -zp] },
        { shape: "box", size: [tb, fh, tb], pos: [0, 0, zp] },
        { shape: "box", size: [tb, tb, D - 2 * tb], pos: [0, yb - fy, 0] },
        { shape: "box", size: [tb, tb, D - 2 * tb], pos: [0, yt - fy, 0] },
        { shape: "box", size: [3, yt - yb - tb, D - 2 * tb], pos: [0, (yb + yt) / 2 - fy, 0] },
      ],
    });
  const iw = W - 2 * tb, ih = yt - yb - tb, ym = (yb + yt) / 2;
  const shelfY = [0.27, 0.5, 0.73].map((f) => Math.round(yb + (yt - yb) * f));
  const rail = (y: number, sz: number, id: string) => part(id, "Rail", [iw, tb, tb], [0, y, sz * zp], "metal");
  const parts: CustomPart[] = [
    sideFrame(-1, 0),
    rail(yb, -1, "R0"),
    rail(yb, 1, "R1"),
    rail(yt, -1, "R2"),
    rail(yt, 1, "R3"),
    part("F", "Bottom panel", [iw, pt, D - 2 * tb], [0, yb + tb / 2 + pt / 2, 0], "metal"),
    sideFrame(1, 1),
    part("T", "Top panel", [W, pt, D], [0, H - pt / 2, 0], "metal"),
    ...[-1, 1].map((sx, i) => part(`K${i}`, "Back mesh", [iw / 2, ih, 3], [sx * (iw / 4), ym, -zp + tb / 2 + 2], "metal")),
    ...shelfY.map((y, i) => part(`G${i}`, "Glass shelf", [iw - 20, 6, D - 2 * tb - 20], [0, y, 0], "glass")),
    ...[-1, 1].map((sx, i) => part(`O${i}`, "Glass door", [W / 2 - 4, ih, 8], [sx * (W / 4), ym, D / 2 + 4], "glass")),
  ];
  const railEnds = (sx: number) => [yb, yt].flatMap((y) => [-1, 1].map((sz) => [sx * (W / 2 - tb), y, sz * zp] as Vec3));
  const shelfSupport = shelfY.flatMap((y) => [-1, 1].map((sx) => [sx * (iw / 2), y - 4, zp - 40] as Vec3));
  const steps: CustomStep[] = [
    {
      title: "Push the rails into one side frame",
      detail: "Lay the side frame on a rug and push a rail into each corner, slots the way the drawing shows.",
      add: ["S0", "R0", "R1", "R2", "R3"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Screw the rails to the side frame", detail: "One screw in each corner.", fix: [fix("screw", railEnds(-1), [1, 0, 0], "S0", undefined, 12, 6)], tools: ["screwdriver"] },
    { title: "Slide in the bottom panel", detail: "Into the bottom rails, from the end, until it stops.", add: ["F"], from: { F: [0, 0, D + 200] } },
    { title: "Lay the other side frame on", detail: "Over the ends of the four rails.", add: ["S1"] },
    { title: "Screw it to the rails", detail: "Four screws, one in each corner.", fix: [fix("screw", railEnds(1), [-1, 0, 0], "S1", undefined, 12, 6)], tools: ["screwdriver"] },
    {
      title: "Screw the feet into the posts",
      detail: "One under each corner post, by hand.",
      fix: [fix("foot", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xs, ft, sz * zp] as Vec3)), UP, undefined, undefined, 30, 40)],
    },
    {
      title: "Stand it up together and fix the bottom panel",
      detail: "Lift it upright, then one screw through the bottom panel into the front rail.",
      fix: [fix("screw", [[0, yb + tb / 2 + pt, zp - 30]], DOWN, "F", "R1", 10, 4)],
      tools: ["screwdriver"],
      pose: "+y",
      people: 2,
      warnings: ["two"],
    },
    {
      title: "Slide on the top panel and screw it down",
      detail: "From the front along the top rails, then one screw at the back.",
      add: ["T"],
      from: { T: [0, 0, D + 200] },
      fix: [fix("screw", [[0, H, -zp]], DOWN, "T", "R2", 10, 4)],
      tools: ["screwdriver"],
    },
    { title: "Turn it round and slide in the back mesh", detail: "Both halves drop into the channels from the top, then swing in at the bottom.", add: ["K0", "K1"] },
    {
      title: "Screw the corner pieces to the back",
      detail: "Three along the middle of the back, one screw each, to hold the two halves.",
      fix: [fix("angle", shelfY.map((y) => [0, y, -zp + tb / 2 + 4] as Vec3), [0, 0, -1], undefined, undefined, 30, 30), fix("screw", shelfY.map((y) => [0, y + 6, -zp + tb / 2 + 6] as Vec3), [0, 0, -1], undefined, undefined, 10, 4)],
      tools: ["screwdriver"],
    },
    {
      title: "Clip the plates on at the top",
      detail: "The wide plate in the middle of the back, the two small ones at the front corners, until they click.",
      fix: [fix("clip", [[0, yt, -zp], [-iw / 2 + 30, yt, zp], [iw / 2 - 30, yt, zp]], DOWN, undefined, undefined, 30, 40)],
    },
    { title: "Screw the back to the top", detail: "One screw through the middle plate.", fix: [fix("screw", [[0, yt + tb / 2, -zp + 10]], DOWN, "T", undefined, 10, 4)], tools: ["screwdriver"] },
    {
      title: "Screw the back to the bottom",
      detail: "Two screws through the bottom rail into the back mesh.",
      fix: [fix("screw", [-1, 1].map((sx) => [sx * (iw / 4), yb, -zp] as Vec3), [0, 0, 1], "R0", undefined, 10, 4)],
      tools: ["screwdriver"],
    },
    {
      title: "Screw in the shelf supports",
      detail: "Two for each shelf, on the front posts. The flat side faces up.",
      fix: [fix("clip", shelfSupport, [0, -1, 0], undefined, undefined, 30, 20), fix("screw", shelfSupport.map((p) => [p[0], p[1] - 4, p[2]] as Vec3), [0, 1, 0], undefined, undefined, 10, 4)],
      tools: ["screwdriver"],
    },
    { title: "Lay the glass shelves on", detail: "Each one rests on two supports and a corner piece. Carry the glass with both hands.", add: ["G0", "G1", "G2"], warnings: ["hand"] },
    {
      title: "Put a washer on each door pin",
      detail: "Over the pins on the hinge side of the frame, three for each door.",
      fix: [fix("washer", [-1, 1].flatMap((sx) => [yb + 60, ym, yt - 60].map((y) => [sx * xs, y, zp + tb / 2] as Vec3)), DOWN, undefined, undefined, 2, 12)],
    },
    { title: "Level the feet", detail: "Turn each foot in or out until the cabinet stands straight and doesn't rock.", tools: ["level"] },
    {
      title: "Fix it to the wall",
      detail: "Screw a wall fitting to the top of each back post, then screw them to the wall. Wall plugs and screws aren't included: pick ones made for your wall.",
      fix: [
        fix("bracket", [-1, 1].map((sx) => [sx * xs, yt, -zp] as Vec3), [0, 0, -1], undefined, undefined, 40, 30),
        fix("screw", [-1, 1].map((sx) => [sx * xs, yt - 6, -zp - tb / 2] as Vec3), [0, 0, 1], undefined, undefined, 10, 4),
        fix("plug", [-1, 1].map((sx) => [sx * xs, yt - 40, -D / 2] as Vec3), [0, 0, -1]),
        fix("screw", [-1, 1].map((sx) => [sx * xs, yt - 40, -D / 2 + 2] as Vec3), [0, 0, -1], undefined, undefined, 50, 5),
      ],
      tools: ["drill", "screwdriver", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    { title: "Hang the doors", detail: "Lift each door onto its pins from above, both hands on the frame.", add: ["O0", "O1"], warnings: ["hand"] },
    {
      title: "Screw on the door catches",
      detail: "One at the top and one at the bottom, where the two doors meet.",
      fix: [fix("clip", [yb + tb, yt - tb].map((y) => [0, y, zp] as Vec3), [0, 0, -1], undefined, undefined, 20, 16)],
      tools: ["screwdriver"],
    },
  ];
  return { parts, steps, aside: [{ ids: ["S1"], until: 3, off: [-2 * xs, 0, D + 150], rot: [0, Math.PI, 0], from: [300, 0, 0] }] };
}

/* ---------- sold assembled (no manual): the folding chair, the rattan footstool and the side table ---------- */

/** A round rod from a to b (mm, relative to its part's centre), drawn as one cylinder. */
function rod(a: Vec3, b: Vec3, d: number): PartPiece {
  const v: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...v);
  return { shape: "cyl", size: [d, len, d], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(v[2], v[1]), 0, Math.asin(-v[0] / len)] };
}

/** The folding chair: birch back legs with the backrest across their tops, black front legs, the seat hinged between. */
function psFoldingChair(s: ProductSpec): R {
  const W = mm(s.size.w), H = mm(s.size.h), D = mm(s.size.d);
  const yS = mm(s.seat?.seatH ?? 46), xb = W / 2 - 15, xf = xb - 30;
  const back = (sx: number): PartPiece => ({ shape: "box", size: [28, Math.hypot(H, 70), 36], pos: [sx * xb, 0, -D / 2 + 70], rot: [-Math.atan2(70, H), 0, 0] });
  const front = (sx: number): PartPiece => {
    const a: Vec3 = [sx * xf, -H / 2, D / 2 - 40], b: Vec3 = [sx * xf, yS - 30 - H / 2, -D / 2 + 110];
    return { shape: "box", size: [24, Math.hypot(b[1] - a[1], b[2] - a[2]), 30], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [Math.atan2(b[2] - a[2], b[1] - a[1]), 0, 0] };
  };
  const parts: CustomPart[] = [
    part("F", "Back frame", [W, H, D], [0, H / 2, 0], "wood", { pieces: [back(-1), back(1), { shape: "box", size: [2 * xb - 28, 40, 24], pos: [0, 140 - H / 2, -D / 2 + 100] }] }),
    part("K", "Backrest", [2 * xb + 28, 120, 22], [0, H - 70, -D / 2 + 50], "board"),
    part("L", "Front legs", [2 * xf + 24, yS, D], [0, yS / 2, 0], "metal", { pieces: ([front(-1), front(1), { shape: "box", size: [2 * xf - 24, 24, 24], pos: [0, 140 - H / 2, D / 2 - 40 - ((D - 150) * 140) / (yS - 30)] }] as PartPiece[]).map((p) => ({ ...p, pos: [p.pos[0], p.pos[1] + H / 2 - yS / 2, p.pos[2]] as Vec3 })) }),
    part("S", "Seat", [2 * xf - 30, 20, D - 150], [0, yS - 10, 10], "board"),
  ];
  const steps: CustomStep[] = [
    { title: "Take the folded chair out of the box", detail: "It comes assembled, with nothing to screw together. Stand it on its feet, still folded.", add: ["F", "K", "L"], from: { F: [0, 300, 0], K: [0, 300, 0], L: [0, 300, 0] } },
    { title: "Unfold it and press the seat down", detail: "Pull the front legs away from the back, then push the seat down until it lies flat and the frame locks.", add: ["S"], from: { S: [0, 260, -200] } },
    { title: "Check it stands steady", detail: "All four feet should touch the floor. To fold it, lift the front edge of the seat." },
  ];
  return { parts, steps };
}

/** The rattan footstool comes made: a woven drum and its domed lid, with room to store things inside. */
function psOttoman(s: ProductSpec): R {
  const Dd = mm(s.size.w), H = mm(s.size.h);
  const hb = Math.round(H * 0.45);
  const parts: CustomPart[] = [
    part("B", "Woven base", [Dd - 60, hb, Dd - 60], [0, hb / 2, 0], "wood", { pieces: [{ shape: "cyl", size: [Dd - 110, 30, Dd - 110], pos: [0, 15 - hb / 2, 0] }, { shape: "cyl", size: [Dd - 60, hb - 30, Dd - 60], pos: [0, 15, 0] }] }),
    part("T", "Lid", [Dd, H - hb, Dd], [0, (H + hb) / 2, 0], "wood", { pieces: [{ shape: "cyl", size: [Dd, (H - hb) * 0.6, Dd], pos: [0, -(H - hb) * 0.2, 0] }, { shape: "cyl", size: [Dd - 120, (H - hb) * 0.4, Dd - 120], pos: [0, (H - hb) * 0.3, 0] }] }),
  ];
  const steps: CustomStep[] = [
    { title: "Unpack the footstool", detail: "It comes ready made, so there is nothing to put together. Take the lid off and remove the packing from inside.", add: ["B"] },
    { title: "Put the lid back on", detail: "Lower it straight down so it sits evenly on the woven rim.", add: ["T"], from: { T: [0, 300, 0] } },
  ];
  return { parts, steps };
}

/** The side table folds flat: a split top with a carrying handle, on two tube leg frames that swing out. */
function psSideTable(s: ProductSpec): R {
  const W = mm(s.size.w), D = mm(s.size.d), H = mm(s.size.h);
  const t = 4, yT = H - t, hh = 200, tube = 14;
  const frame = (id: string, sx: number) =>
    part(id, "Leg frame", [W, yT, D], [0, yT / 2, 0], "metal", {
      pieces: [
        ...[-1, 1].map((sz) => rod([sx * 40, yT / 2, sz * (D / 2 - 40)], [sx * (W / 2 - 10), -yT / 2 + tube / 2, sz * (D / 2 - 20)], tube)),
        rod([sx * (W / 2 - 10), -yT / 2 + tube / 2, -(D / 2 - 20)], [sx * (W / 2 - 10), -yT / 2 + tube / 2, D / 2 - 20], tube),
        rod([sx * 40, yT / 2 - 8, -(D / 2 - 40)], [sx * 40, yT / 2 - 8, D / 2 - 40], tube),
      ],
    });
  const parts: CustomPart[] = [
    frame("A", -1),
    frame("B", 1),
    part("T", "Top", [W, t, D], [0, H - t / 2, 0], "metal", { pieces: [-1, 1].map((sx) => ({ shape: "box", size: [W / 2 - 3, t, D], pos: [sx * (W / 4 + 1.5), 0, 0] })) }),
    part("G", "Handle", [160, hh, tube], [0, H + hh / 2, 0], "metal", { pieces: [rod([-70, -hh / 2, 0], [-30, hh / 2 - tube / 2, 0], tube), rod([70, -hh / 2, 0], [30, hh / 2 - tube / 2, 0], tube), rod([-30, hh / 2 - tube / 2, 0], [30, hh / 2 - tube / 2, 0], tube)] }),
  ];
  const steps: CustomStep[] = [
    { title: "Take the folded table out of the box", detail: "It comes assembled. Hold it by the handle, the legs folded together under the top.", add: ["T", "G", "A"], from: { T: [0, 300, 0], G: [0, 300, 0], A: [0, 300, 0] } },
    { title: "Swing the legs apart", detail: "Pull the two leg frames away from each other until the top halves lie flat and level.", add: ["B"], from: { B: [-180, 0, 0] } },
    { title: "Check it stands steady", detail: "Both feet rest flat on the floor. To carry it, lift it by the handle and the legs fold together." },
  ];
  return { parts, steps };
}

const BY_SLUG: Record<string, (s: ProductSpec) => R | null> = {
  "ikea-ps-2026-folding-chair": psFoldingChair,
  "ikea-ps-2026-ottoman-storage": psOttoman,
  "ikea-ps-2026-side-table-50-x-40": psSideTable,
  "ikea-ps-2026-chair": chair,
  "ikea-ps-2026-table-96": roundTable,
  "ikea-ps-2026-table-156-x-75": foldingTable,
  "ikea-ps-2026-bench-127": bench,
  "ikea-ps-2026-table-drawer-70-x-70": drawerTable,
  "ikea-ps-2026-bedside-table-30-x-30-x-50": bedside,
  "ikea-ps-2026-shelving-unit-160-x-35-x-161": shelving,
  "ikea-ps-2026-stool": stool,
  "ikea-ps-2026-trolley-89-x-48": trolley,
  "ikea-ps-2026-easy-chair": easyChair,
  "ikea-ps-lomsk-children-s-swivel-armchair": lomsk,
  "ikea-ps-2026-chair-bed": chairBed,
  "ikea-ps-2026-3-seat-sofa-bed": sofaBed,
  "ikea-ps-2026-cabinet-80-x-46-x-140": pineCabinet,
  "ikea-ps-cabinet-119-x-63": steelCabinet,
  "ikea-ps-2026-glass-door-cabinet-73-x-36-x-160": glassCabinet,
};

function recipeOf(s: ProductSpec): R | null {
  const f = BY_SLUG[s.slug ?? ""];
  return f ? f(s) : null;
}

const family: Family = {
  names: ["IKEA"],
  // a recipe with parts built on their own: the custom builder draws it, then those parts are moved aside until they join
  build(b, s) {
    const r = recipeOf(s);
    if (!r?.aside?.length) return false;
    const { aside, ...custom } = r;
    const n0 = b.items.filter((it) => it.kind === "part").length, s0 = b.steps.length;
    buildCustom(b, { ...s, custom });
    const items = b.items.filter((it): it is PartItem => it.kind === "part").slice(n0);
    for (const a of aside) {
      const at = s0 + a.until;
      for (const id of a.ids) {
        const it = items[custom.parts.findIndex((p) => p.id === id)];
        if (!it) continue;
        for (const st of it.states)
          if (st.step < at) {
            st.pos = [st.pos[0] + a.off[0], st.pos[1] + a.off[1], st.pos[2] + a.off[2]];
            if (a.rot) st.rot = a.rot;
          }
        const scene = it.states[0]?.scene ?? "main";
        const moved = (o: Vec3): Vec3 => [it.final.pos[0] + o[0], it.final.pos[1] + o[1], it.final.pos[2] + o[2]];
        for (const m of a.later ?? []) it.states.push({ step: s0 + m.at, scene, pos: moved(m.off), rot: it.final.rot, delay: 0 });
        it.states.push({ step: at, scene, pos: it.final.pos, rot: it.final.rot, from: a.from, delay: 0.2 });
      }
    }
    return true;
  },
  recipe(s) {
    const r = recipeOf(s);
    if (!r) return null;
    const { aside: _aside, ...custom } = r;
    void _aside;
    return custom;
  },
};
export default family;
