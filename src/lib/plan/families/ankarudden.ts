import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, HwKind, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/*
 * ANKARUDDEN, read from IKEA's manuals for the chest of 4 drawers, the chest of 6 drawers with 2 inner drawers and
 * the wardrobe with sliding doors.
 *
 * The carcass is built lying down: the 4-drawer chest on its left side, the 6-drawer chest and the wardrobe on their
 * backs. Cam bolts and drawer runners go on the sides (and the divider) first, the rails and back boards are pushed
 * onto dowels in the side on the floor and locked, and the other side closes it. Plastic foot strips press under the
 * bottom edges, it's stood up, the top goes on dowels and cam bolts with the wall brackets already under it, and it's
 * fixed to the wall. Every drawer is the same: the sides stand on the back, the bottom slides down the grooves, the
 * front goes on connecting dowels and cam locks, runners are screwed on, and a grip strip is locked on top of the front.
 * The wardrobe adds a divider, a fixed shelf over two drawers, a hardboard back, door tracks, two sliding doors, two
 * clothes rails and three shelves.
 */

const T = 16;
const S = [-1, 1];
const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const DOWEL = { len: 30, dia: 8 };
const CAM = { name: "Cam lock" };
const FOOT = { name: "Foot strip", len: 8, dia: 40 };

/* ---------------------------------------------------------------- drawers */

const D_CAM_BOLT: HwDef = { kind: "camScrew", len: 24, dia: 6, name: "Cam bolt (drawer)" };
const D_CONNECT: HwDef = { kind: "camScrew", len: 30, dia: 8, name: "Connecting dowel" };
const D_CAM: HwDef = { kind: "cam", len: 10, dia: 12, name: "Cam lock (drawer)" };
const D_RUNNER: HwDef = { kind: "runner", len: 400, dia: 30, name: "Drawer runner" };
const D_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const D_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const D_STRIP_BOLT: HwDef = { kind: "camScrew", len: 24, dia: 6, name: "Cam bolt (grip strip)" };
const D_WIRE: HwDef = { kind: "clip", len: 10, dia: 60, name: "Wire stiffener" };

export interface AnkDrawer {
  front: string;
  strip?: string;
  sides: string[];
  back: string;
  bottom: string;
  cx: number;
  y0: number; // underside of the box
  bh: number; // box height
  bw: number; // box width over the sides
  zb: number; // back face of the back
  zf: number; // back face of the front
  fy: number; // centre of the front panel
  fh: number; // height of the front panel (without the strip)
  fw: number;
  runY: number;
  wire: boolean;
  rs: number; // runner screws on each side
}

/** One drawer in the opening `ow` wide and `oh` high (bottom at `yb`), its front's face at `zFace`, box `dd` deep. */
export function ankDrawer(b: PlanBuilder, o: { cx: number; yb: number; ow: number; oh: number; zFace: number; dd: number; boxH?: number; strip?: boolean; wire?: boolean; runnerScrews?: number; types: Map<string, string> }): AnkDrawer {
  const type = (name: string, size: Vec3, material?: "fiber") => {
    const k = `${name}|${size.map(Math.round).join("x")}`;
    let t = o.types.get(k);
    if (!t) o.types.set(k, (t = b.part(name, size, { material })));
    return t;
  };
  const ft = 16, strip = o.strip ?? true, sh = strip ? 22 : 0;
  const fw = o.ow - 4, fh = o.oh - 4 - sh;
  const fy = o.yb + 2 + fh / 2;
  const zf = o.zFace - ft;
  const bw = o.ow - 26;
  const bh = o.boxH ?? Math.min(fh - 40, 200);
  const y0 = o.yb + 20;
  const zb = zf - o.dd;
  const front = b.place(type("Drawer front", [fw, fh, ft]), [o.cx, fy, o.zFace - ft / 2]);
  const st = strip ? b.place(type("Grip strip", [fw, sh, 30]), [o.cx, fy + fh / 2 + sh / 2, o.zFace - 15]) : undefined;
  const sides = S.map((g) => b.place(type("Drawer side", [12, bh, o.dd - 12]), [o.cx + g * (bw / 2 - 6), y0 + bh / 2, zb + 12 + (o.dd - 12) / 2]));
  const back = b.place(type("Drawer back", [bw, bh, 12]), [o.cx, y0 + bh / 2, zb + 6]);
  const bottom = b.place(type("Drawer bottom", [bw - 16, 4, o.dd - 20], "fiber"), [o.cx, y0 + 10, zb + 12 + (o.dd - 20) / 2]);
  return { front, strip: st, sides, back, bottom, cx: o.cx, y0, bh, bw, zb, zf, fy, fh, fw, runY: y0 + 30, wire: o.wire ?? false, rs: o.runnerScrews ?? 3 };
}

function drawerFits(d: AnkDrawer) {
  const xs = d.bw / 2 - 6;
  const ys = [d.y0 + 25, d.y0 + d.bh - 25];
  const side = (g: number) => d.sides[g < 0 ? 0 : 1];
  const zFront = d.zf + 16;
  const fTop = d.fy + d.fh / 2;
  const sx = [-1, 0, 1].map((k) => d.cx + k * (d.fw / 2 - 60));
  return {
    backBolts: S.flatMap((g) => ys.map((y): FitOpts => ({ on: d.back, at: [d.cx + g * xs, y, d.zb + 12], dir: [0, 0, -1], mate: side(g) }))),
    backCams: S.flatMap((g) => ys.map((y): FitOpts => ({ on: side(g), at: [d.cx + g * (xs - 6), y, d.zb + 40], dir: [g, 0, 0] }))),
    wire: d.wire ? [{ on: d.bottom, at: [d.cx, d.y0 + 8, (d.zb + d.zf) / 2], dir: [0, -1, 0], hole: false } as FitOpts] : [],
    connectors: S.flatMap((g) => ys.map((y): FitOpts => ({ on: side(g), at: [d.cx + g * xs, y, d.zf], dir: [0, 0, -1], mate: d.front }))),
    frontCams: S.flatMap((g) => ys.map((y): FitOpts => ({ on: side(g), at: [d.cx + g * (xs - 6), y, d.zf - 30], dir: [g, 0, 0] }))),
    runners: S.map((g): FitOpts => ({ on: side(g), at: [d.cx + g * (xs + 6), d.runY, (d.zb + d.zf) / 2], dir: [-g, 0, 0], hole: false })),
    runnerScrews: S.flatMap((g) => (d.rs === 2 ? [d.zb + 50, d.zf - 50] : [d.zb + 50, (d.zb + d.zf) / 2 + 40, d.zf - 50]).map((z): FitOpts => ({ on: side(g), at: [d.cx + g * (xs + 6), d.runY, z], dir: [-g, 0, 0] }))),
    dowels: d.strip ? [-1, 1].map((k): FitOpts => ({ on: d.front, at: [d.cx + k * (d.fw / 2 - 30), fTop, zFront - 8], dir: [0, -1, 0], mate: d.strip })) : [],
    stripBolts: d.strip ? sx.map((x): FitOpts => ({ on: d.strip!, at: [x + 20, fTop, zFront - 8], dir: [0, 1, 0], mate: d.front })) : [],
    stripCams: d.strip ? sx.map((x): FitOpts => ({ on: d.front, at: [x + 20, fTop - 30, zFront - 16], dir: [0, 0, 1] })) : [],
  };
}

type Fits = ReturnType<typeof drawerFits>;
const FIT_DEFS: [keyof Fits, HwDef][] = [
  ["backBolts", D_CAM_BOLT],
  ["backCams", D_CAM],
  ["wire", D_WIRE],
  ["connectors", D_CONNECT],
  ["frontCams", D_CAM],
  ["runners", D_RUNNER],
  ["runnerScrews", D_SCREW],
  ["dowels", D_DOWEL],
  ["stripBolts", D_STRIP_BOLT],
  ["stripCams", D_CAM],
];

/** The drawer steps, shown on the first drawer of a group and repeated for the rest. Drawers go in afterwards. */
export function ankDrawerSteps(b: PlanBuilder, ds: AnkDrawer[], o: { scene: string; label?: string }) {
  if (!ds.length) return;
  const d0 = ds[0];
  const f = drawerFits(d0);
  const rel = (k: string): Vec3 => {
    const p = b.partItem(k).final.pos;
    return [p[0] - d0.cx, p[1] - (d0.fy - d0.fh / 2) + 4, p[2]];
  };
  const stage = (k: string, from?: Vec3) => b.stage(k, rel(k), [0, 0, 0], from);
  const sc = { scene: o.scene };
  const what = o.label ?? "drawer";
  b.step({ title: `Screw the cam bolts into the ${what} back`, detail: "Lay it on a rug, inside up. Four cam bolts, two near each end.", kind: "cams", tools: ["screwdriver"], warnings: ["floor"], ...sc }, () => {
    stage(d0.back, [0, 160, 0]);
    b.then(0.1);
    b.fits(D_CAM_BOLT, f.backBolts, 0.08);
  });
  b.step({ title: "Stand the sides on the back", detail: "Grooves inside and at the bottom, onto the cam bolts.", kind: "join", ...sc }, () => {
    for (const k of d0.sides) stage(k, [0, 0, 260]);
  });
  b.step({ title: "Lock the sides", detail: "Four cam locks, arrow towards the bolt, then turn clockwise.", kind: "cams", tools: ["screwdriver"], ...sc }, () => b.fits(D_CAM, f.backCams, 0.08));
  b.step({ title: "Slide in the drawer bottom", detail: d0.wire ? "Down the grooves in the sides, then clip the wire stiffener under it." : "Down the grooves in the sides, all the way to the back.", kind: "join", ...sc }, () => {
    stage(d0.bottom, [0, 0, 420]);
    if (f.wire.length) {
      b.then(0.1);
      b.fits(D_WIRE, f.wire);
    }
  });
  b.step({ title: "Put on the front", detail: "Push the connecting dowels into the ends of the sides, then lay the front on them.", kind: "join", ...sc }, () => {
    b.fits(D_CONNECT, f.connectors, 0.08);
    b.then(0.1);
    stage(d0.front, [0, 0, 260]);
  });
  b.step({ title: "Lock the front", detail: "Four cam locks in the sides, near the front.", kind: "cams", tools: ["screwdriver"], ...sc }, () => b.fits(D_CAM, f.frontCams, 0.08));
  b.step({ title: "Screw the runners onto the drawer", detail: `Turn the drawer the right way up. The marks show which runner goes on which side; ${d0.rs === 2 ? "two" : "three"} screws each.`, kind: "runners", tools: ["screwdriver"], ...sc }, () => {
    b.fits(D_RUNNER, f.runners, 0.15);
    b.then(0.05);
    b.fits(D_SCREW, f.runnerScrews, 0.05);
  });
  if (d0.strip) {
    b.step({ title: "Tap two dowels into the top of the front", detail: "And screw three cam bolts into the underside of the grip strip.", kind: "dowels", tools: ["hammer", "screwdriver"], ...sc }, () => {
      b.fits(D_DOWEL, f.dowels, 0.1);
      b.then(0.05);
      stage(d0.strip!, [0, 160, 0]);
      b.then(0.05);
      b.fits(D_STRIP_BOLT, f.stripBolts, 0.08);
    });
    b.step({ title: "Lock the grip strip on", detail: "Press it down onto the front, then three cam locks from the inside.", kind: "cams", tools: ["screwdriver"], ...sc }, () => b.fits(D_CAM, f.stripCams, 0.08));
  }
  if (ds.length > 1) {
    const n = ds.length - 1;
    b.step({ title: n === 1 ? `Build the other ${what} the same way` : `Build the other ${n} ${what}s the same way`, detail: "Every one goes together like the first.", kind: "drawer", ...sc }, () => {
      b.stagger(0.12);
      ds.slice(1).forEach((d, i) => {
        const dx = (i + 1) * (d0.fw + 120);
        for (const k of [d.front, ...(d.strip ? [d.strip] : []), ...d.sides, d.back, d.bottom]) {
          const p = b.partItem(k).final.pos;
          b.stage(k, [p[0] - d.cx + dx, p[1] - (d0.fy - d0.fh / 2) + 4, p[2]], [0, 0, 0]);
        }
        const fd = drawerFits(d);
        for (const [key, def] of FIT_DEFS) for (const x of fd[key]) b.preset(def, x);
      });
    });
  }
  return f;
}

/** Push every drawer in (the first of each group was shown; the rest get their fittings preset). */
export function ankDrawersIn(b: PlanBuilder, groups: AnkDrawer[][], title: string, detail: string) {
  b.step({ title, detail, kind: "drawer", warnings: ["tip"] }, () => {
    for (const g of groups)
      for (const d of g) {
        b.stagger(0);
        for (const k of [d.front, ...(d.strip ? [d.strip] : []), ...d.sides, d.back, d.bottom]) b.add(k, [0, 0, 520]);
        b.wait(0.15);
      }
  });
}

/* ---------------------------------------------------------------- shared carcass bits */

const runner = (x: number, y: number, d: number, on: string, z = 10): CustomFix[] => [
  fx("runner", [pt(x, y, z)], [d, 0, 0], { len: 400, dia: 30, name: "Drawer runner", on }),
  fx("screw", [-150, 10, 170].map((dz) => pt(x, y, z + dz)), [d, 0, 0], { len: 12, dia: 4, on }),
];

function wallSteps(o: { yTop: number; zBack: number; xs: number[] }): CustomStep[] {
  const { yTop, zBack, xs } = o;
  return [
    { title: "Push it against the wall", detail: "Where it's going to stand. Mark the wall through the slots of the brackets, then pull it away again.", tools: ["pencil"], warnings: ["wall"] },
    {
      title: "Drill and plug the holes",
      detail: "Use the plugs in the box for brick or concrete. For other walls, pick plugs and screws made for them.",
      fix: [fx("plug", xs.map((x) => pt(x, yTop - 30, zBack - 30)), [0, 0, -1], { included: true })],
      tools: ["drill"],
      wall: true,
    },
    {
      title: "Screw the brackets to the wall",
      detail: "Push it back, then a screw with a washer through each bracket into the wall.",
      fix: [
        fx("washer", xs.map((x) => pt(x, yTop - 30, zBack - 2)), [0, 0, -1], { included: true }),
        fx("screw", xs.map((x) => pt(x, yTop - 30, zBack)), [0, 0, -1], { len: 50, dia: 5, included: true }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
}

/** Two wall brackets screwed under the back of the top, each with a screw and a washer. */
const topBrackets = (xs: number[], yt: number, zBack: number): CustomFix[] => [
  fx("angle", xs.map((x) => pt(x, yt, zBack + 20)), [0, 1, 0], { name: "Wall bracket", len: 50, dia: 30, on: "TP", twist: Math.PI }),
  fx("washer", xs.map((x) => pt(x, yt - 2, zBack + 40)), [0, 1, 0], { on: "TP" }),
  fx("screw", xs.map((x) => pt(x, yt - 3, zBack + 40)), [0, 1, 0], { len: 12, dia: 4, on: "TP" }),
];

/* ---------------------------------------------------------------- chest of 4 drawers */

function chest4(b: PlanBuilder, s: ProductSpec) {
  const W = 800, H = 1070, D = 480, PL = 50, rows = 4;
  const xo = W / 2 - T / 2, xi = W / 2 - T;
  const yb = PL + T, yt = H - T;
  const hb = (yt - PL) / 2;
  const zF = D / 2 - 26 - T / 2; // rails behind the drawer fronts
  const zB = -D / 2 + T / 2;
  const pitch = (yt - yb) / rows;
  const runY = (r: number) => yb + r * pitch + 50;
  const parts: CustomPart[] = [
    { id: "SL", name: "Side", size: [T, yt, D], pos: [-xo, yt / 2, 0] },
    { id: "SR", name: "Side", size: [T, yt, D], pos: [xo, yt / 2, 0] },
    { id: "BT", name: "Bottom", size: [W - 2 * T, T, D - T], pos: [0, PL + T / 2, T / 2] },
    { id: "PF", name: "Plinth rail", size: [W - 2 * T, PL, T], pos: [0, PL / 2, zF] },
    { id: "PB", name: "Back rail", size: [W - 2 * T, PL, T], pos: [0, PL / 2, zB] },
    { id: "MR", name: "Back stiffener", size: [W - 2 * T, 30, 10], pos: [0, PL + hb, zB + T / 2 + 5], material: "metal" },
    { id: "K0", name: "Back board", size: [W - 2 * T, hb, T], pos: [0, PL + hb / 2, zB] },
    { id: "K1", name: "Back board", size: [W - 2 * T, hb, T], pos: [0, PL + hb * 1.5, zB] },
    { id: "TR", name: "Top rail", size: [W - 2 * T, 40, T], pos: [0, yt - 20, zF] },
    { id: "TP", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0] },
  ];
  const sideBolts = (sx: number, on: string) =>
    fx("camScrew", [pt(sx * xi, PL + T / 2, -140), pt(sx * xi, PL + T / 2, 140), pt(sx * xi, PL / 2, zF), pt(sx * xi, PL / 2, zB), ...[0, 1].flatMap((k) => [-60, 60].map((dy) => pt(sx * xi, PL + hb * (k + 0.5) + dy, zB)))], [sx, 0, 0], { on });
  const endDowels = (id: string, y: number, z: number[], sides = S) => sides.map((sx) => fx("dowel", z.map((zz) => pt(sx * xi, y, zz)), [-sx, 0, 0], { on: id, ...DOWEL }));
  const cams = (sx: number, list: [string, Vec3, Vec3][]) => list.map(([on, p, d]) => fx("cam", [p], d, { on, ...CAM }));
  const sideCams = (sx: number) =>
    cams(sx, [
      ["BT", pt(sx * (xi - 34), yb, -100), [0, -1, 0]],
      ["BT", pt(sx * (xi - 34), yb, 100), [0, -1, 0]],
      ["PF", pt(sx * (xi - 34), PL / 2, zF - T / 2), [0, 0, 1]],
      ["PB", pt(sx * (xi - 34), PL / 2, zB + T / 2), [0, 0, -1]],
      ...[0, 1].flatMap((k) => [-60, 60].map((dy): [string, Vec3, Vec3] => [`K${k}`, pt(sx * (xi - 34), PL + hb * (k + 0.5) + dy, zB + T / 2), [0, 0, -1]])),
    ]);
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into both sides",
      detail: "Lay the sides on a rug, inside up. Eight in each, by hand until they stop.",
      add: ["SL"],
      fix: [sideBolts(-1, "SL"), sideBolts(1, "SR")],
      wait: ["SR"],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw the drawer runners inside the sides",
      detail: "Four on each side, three screws each. The marks show which runners are for the left side and which for the right.",
      fix: [0, 1, 2, 3].flatMap((r) => [...runner(-xi, runY(r), -1, "SL"), ...runner(xi, runY(r), 1, "SR")]),
      tools: ["screwdriver"],
    },
    { title: "Tap four dowels into the bottom", detail: "Two in each end.", fix: endDowels("BT", PL + T / 2, [-60, 60]), wait: ["BT"], tools: ["hammer"] },
    { title: "Stand the bottom in the side", detail: "Onto the dowels and cam bolts of the side on the floor.", add: ["BT"] },
    { title: "Lock the bottom", detail: "Two cam locks, arrow towards the bolt, then turn clockwise.", fix: cams(-1, [["BT", pt(-(xi - 34), yb, -100), [0, -1, 0]], ["BT", pt(-(xi - 34), yb, 100), [0, -1, 0]]]), tools: ["screwdriver"] },
    { title: "Tap two dowels into the plinth rail", detail: "One in each end.", fix: endDowels("PF", PL / 2 - 10, [zF]), wait: ["PF"], tools: ["hammer"] },
    { title: "Fit the plinth rail and lock it", detail: "Into the side at the front, under the bottom. One cam lock.", add: ["PF"], fix: cams(-1, [["PF", pt(-(xi - 34), PL / 2, zF - T / 2), [0, 0, 1]]]), tools: ["screwdriver"] },
    { title: "Tap two dowels into the back rail", detail: "One in each end.", fix: endDowels("PB", PL / 2 - 10, [zB]), wait: ["PB"], tools: ["hammer"] },
    { title: "Fit the back rail and lock it", detail: "Into the side at the back, under the bottom. One cam lock.", add: ["PB"], fix: cams(-1, [["PB", pt(-(xi - 34), PL / 2, zB + T / 2), [0, 0, -1]]]), tools: ["screwdriver"] },
    {
      title: "Screw the back stiffener to the side",
      detail: "Halfway up at the back, where the two back boards will meet. One screw through its bracket.",
      add: ["MR"],
      fix: [fx("screw", [pt(-xi, PL + hb + 8, zB + T / 2 + 5)], [-1, 0, 0], { len: 12, dia: 4, on: "SL" })],
      tools: ["screwdriver"],
    },
    { title: "Tap the dowels into the back boards", detail: "Two in each end of both boards.", fix: [...endDowels("K0", PL + hb / 2, [zB]), ...endDowels("K1", PL + hb * 1.5, [zB])].flatMap((f) => [{ ...f, at: f.at!.map((p) => pt(p[0], p[1] - 90, p[2])) }, { ...f, at: f.at!.map((p) => pt(p[0], p[1] + 90, p[2])) }]), wait: ["K0", "K1"], tools: ["hammer"] },
    { title: "Stand the back boards in the side", detail: "One above the other, onto the dowels and cam bolts.", add: ["K0", "K1"] },
    { title: "Lock the back boards", detail: "Four cam locks.", fix: cams(-1, [0, 1].flatMap((k) => [-60, 60].map((dy): [string, Vec3, Vec3] => [`K${k}`, pt(-(xi - 34), PL + hb * (k + 0.5) + dy, zB + T / 2), [0, 0, -1]]))), tools: ["screwdriver"] },
    { title: "Lay the other side on", detail: "Together: down onto all the dowels and cam bolts at once.", add: ["SR"], people: 2 },
    { title: "Lock the other side", detail: "Eight cam locks, the same as on the first side.", fix: sideCams(1), tools: ["screwdriver"] },
    { title: "Screw the stiffener to this side", detail: "One screw through its other bracket.", fix: [fx("screw", [pt(xi, PL + hb + 8, zB + T / 2 + 5)], [1, 0, 0], { len: 12, dia: 4, on: "SR" })], tools: ["screwdriver"] },
    {
      title: "Stand it up and press in the foot strips",
      detail: "Five, under the bottom edges of the sides and the plinth rail.",
      fix: [fx("glide", [...S.flatMap((sx) => [-180, 180].map((z) => pt(sx * xo, 0, z))), pt(0, 0, zF)], [0, 1, 0], FOOT)],
      pose: "+y",
      people: 2,
    },
    { title: "Fit the top rail", detail: "Four dowels in its top edge first, then set it in at the front between the sides.", add: ["TR"], fix: [fx("dowel", [-300, -100, 100, 300].map((x) => pt(x, yt, zF)), [0, -1, 0], { on: "TR", ...DOWEL })], tools: ["hammer"] },
    { title: "Tap the dowels into the sides", detail: "Two in the top edge of each side.", fix: S.map((sx, i) => fx("dowel", [-160, 120].map((z) => pt(sx * xo, yt, z)), [0, -1, 0], { on: i ? "SR" : "SL", ...DOWEL })), tools: ["hammer"] },
    { title: "Screw four cam bolts under the top", detail: "Lay the top upside down. Two near each end.", fix: [fx("camScrew", S.flatMap((sx) => [-60, 160].map((z) => pt(sx * xo, yt, z))), [0, 1, 0], { on: "TP" })], wait: ["TP"], tools: ["screwdriver"] },
    { title: "Screw the wall brackets under the top", detail: "At the back, one near each end, with a screw and a washer.", fix: topBrackets([-260, 260], yt, -D / 2), tools: ["screwdriver"] },
    { title: "Put the top on", detail: "Onto the dowels and the top rail's dowels.", add: ["TP"] },
    { title: "Lock the top", detail: "Four cam locks, inside the sides near the top.", fix: S.map((sx, i) => fx("cam", [-60, 160].map((z) => pt(sx * xi, yt - 34, z)), [sx, 0, 0], { on: i ? "SR" : "SL", ...CAM })), tools: ["screwdriver"] },
    ...wallSteps({ yTop: yt, zBack: -D / 2, xs: [-260, 260] }),
  ];
  buildCustom(b, { ...s, custom: { parts, steps } });
  const types = new Map<string, string>();
  const ds = [0, 1, 2, 3].map((r) => ankDrawer(b, { cx: 0, yb: yb + r * pitch, ow: W - 2 * T, oh: pitch, zFace: D / 2, dd: D - T - 40, wire: true, types }));
  ankDrawerSteps(b, ds, { scene: "drawer" });
  ankDrawersIn(b, [ds], "Push the drawers in", "Line each up with its runners and push it all the way in. Start at the bottom.");
}

/* ---------------------------------------------------------------- chest of 6 drawers */

function chest6(b: PlanBuilder, s: ProductSpec) {
  const W = 1390, H = 870, D = 480, PL = 50, rows = 3;
  const xo = W / 2 - T / 2, xi = W / 2 - T;
  const yt = H - T;
  const zF = D / 2 - 26 - T / 2;
  const zB = -D / 2 + T / 2;
  const cw = (W - 3 * T) / 2;
  const hb = (yt - 40 - PL) / 2;
  const pitch = (yt - PL) / rows;
  const runY = (r: number) => PL + r * pitch + 50;
  const parts: CustomPart[] = [
    { id: "SL", name: "Side", size: [T, yt, D], pos: [-xo, yt / 2, 0] },
    { id: "SR", name: "Side", size: [T, yt, D], pos: [xo, yt / 2, 0] },
    { id: "DV", name: "Divider", size: [T, yt, zF - T / 2 - (zB + T / 2)], pos: [0, yt / 2, (zF - T / 2 + zB + T / 2) / 2] },
    { id: "PF", name: "Plinth rail", size: [W - 2 * T, PL, T], pos: [0, PL / 2, zF] },
    { id: "TF", name: "Top front rail", size: [W - 2 * T, 40, T], pos: [0, yt - 20, zF] },
    { id: "PB", name: "Back rail", size: [W - 2 * T, PL, T], pos: [0, PL / 2, zB] },
    { id: "TB", name: "Top back rail", size: [W - 2 * T, 40, T], pos: [0, yt - 20, zB] },
    { id: "K0", name: "Back board", size: [W - 2 * T, hb, T], pos: [0, PL + hb / 2, zB] },
    { id: "K1", name: "Back board", size: [W - 2 * T, hb, T], pos: [0, PL + hb * 1.5, zB] },
    { id: "TP", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0] },
  ];
  const ys = { PF: PL / 2, TF: yt - 20, PB: PL / 2, TB: yt - 20, K0: PL + hb / 2, K1: PL + hb * 1.5 } as Record<string, number>;
  const zs = { PF: zF, TF: zF, PB: zB, TB: zB, K0: zB, K1: zB } as Record<string, number>;
  const ids = ["PF", "TF", "PB", "TB", "K0", "K1"];
  const sideBolts = (sx: number, on: string) =>
    fx("camScrew", ids.flatMap((id) => (id[0] === "K" ? [-70, 70].map((dy) => pt(sx * xi, ys[id] + dy, zs[id])) : [pt(sx * xi, ys[id] + 8, zs[id])])), [sx, 0, 0], { on });
  const dowels = (id: string, dy: number[]) => S.map((sx) => fx("dowel", dy.map((d) => pt(sx * xi, ys[id] + d, zs[id])), [-sx, 0, 0], { on: id, ...DOWEL }));
  const camsFor = (sx: number, list: string[]) =>
    list.map((id) => {
      const inward: Vec3 = zs[id] > 0 ? [0, 0, 1] : [0, 0, -1];
      const face = zs[id] + (zs[id] > 0 ? -T / 2 : T / 2);
      const pts = id[0] === "K" ? [-70, 70].map((dy) => pt(sx * (xi - 34), ys[id] + dy, face)) : [pt(sx * (xi - 34), ys[id] + 8, face)];
      return fx("cam", pts, inward, { on: id, ...CAM });
    });
  const longScrews = (id: string) => fx("bolt", [pt(0, ys[id] + (id === "PF" ? 0 : 0), zF + T / 2)], [0, 0, -1], { len: 80, dia: 6, name: "Long connecting screw", on: id });
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into both sides",
      detail: "Lay them on a rug, inside up. Eight in each, by hand until they stop.",
      add: ["SL"],
      fix: [sideBolts(-1, "SL"), sideBolts(1, "SR")],
      wait: ["SR"],
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Screw the drawer runners inside the sides", detail: "Three on each side, three screws each. Check the marks for left and right.", fix: [0, 1, 2].flatMap((r) => [...runner(-xi, runY(r), -1, "SL"), ...runner(xi, runY(r), 1, "SR")]), tools: ["screwdriver"] },
    { title: "Screw the drawer runners onto the divider", detail: "Three on each face, three screws each.", fix: [0, 1, 2].flatMap((r) => [...runner(-T / 2, runY(r), 1, "DV", -20), ...runner(T / 2, runY(r), -1, "DV", -20)]), wait: ["DV"], tools: ["screwdriver"] },
    { title: "Tap the dowels into the front rails", detail: "Two in each end of the plinth rail and the top front rail.", fix: [...dowels("PF", [-12, 12]), ...dowels("TF", [-12, 12])].map((f) => ({ ...f, at: f.at!.map((p) => pt(p[0], p[1] - 4, p[2])) })), wait: ["PF", "TF"], tools: ["hammer"] },
    {
      title: "Screw the front rails to the divider and push them onto the side",
      detail: "One long screw through each rail into the divider's front edge, then push the dowels into the side on the floor.",
      add: ["PF", "TF", "DV"],
      fix: [longScrews("PF"), longScrews("TF")],
      from: { PF: [500, 0, 0], TF: [500, 0, 0], DV: [500, 0, 0] },
      tools: ["screwdriver"],
    },
    { title: "Lock the front rails", detail: "One cam lock in each.", fix: camsFor(-1, ["PF", "TF"]), tools: ["screwdriver"] },
    { title: "Tap the dowels into the back rails", detail: "Two in each end of both.", fix: [...dowels("PB", [-16, 16]), ...dowels("TB", [-12, 12])].map((f) => ({ ...f, at: f.at!.map((p) => pt(p[0], p[1] - 4, p[2])) })), wait: ["PB", "TB"], tools: ["hammer"] },
    { title: "Fit the back rails", detail: "Into the side, at the bottom and the top of the back.", add: ["PB", "TB"] },
    { title: "Lock the back rails", detail: "One cam lock in each.", fix: camsFor(-1, ["PB", "TB"]), tools: ["screwdriver"] },
    { title: "Tap the dowels into the back boards", detail: "Two in each end of both boards.", fix: [...dowels("K0", [-110, 110]), ...dowels("K1", [-110, 110])], wait: ["K0", "K1"], tools: ["hammer"] },
    { title: "Slide the back boards in", detail: "From the open end, behind the divider, onto the side's dowels.", add: ["K0", "K1"] },
    { title: "Lock the back boards", detail: "Four cam locks.", fix: camsFor(-1, ["K0", "K1"]), tools: ["screwdriver"] },
    { title: "Put on the other side", detail: "Together: push it onto all the dowels and cam bolts.", add: ["SR"], people: 2 },
    { title: "Lock the other side", detail: "Eight cam locks.", fix: camsFor(1, ids), tools: ["screwdriver"] },
    {
      title: "Press in the foot strips",
      detail: "Six, under the bottom edges of the sides and the divider, front and back.",
      fix: [fx("glide", [-xo, 0, xo].flatMap((x) => [-150, 150].map((z) => pt(x, 0, z))), [0, 1, 0], FOOT)],
    },
    {
      title: "Stand it up and tap in the dowels for the top",
      detail: "Four in the top edge of each top rail, two in each side and four in the divider.",
      fix: [
        ...["TF", "TB"].map((id) => fx("dowel", [-450, -150, 150, 450].map((x) => pt(x, yt, zs[id])), [0, -1, 0], { on: id, ...DOWEL })),
        ...S.map((sx, i) => fx("dowel", [-60, 60].map((z) => pt(sx * xo, yt, z)), [0, -1, 0], { on: i ? "SR" : "SL", ...DOWEL })),
        fx("dowel", [-120, -40, 40, 120].map((z) => pt(0, yt, z - 13)), [0, -1, 0], { on: "DV", ...DOWEL }),
      ],
      pose: "+y",
      people: 2,
      tools: ["hammer"],
    },
    {
      title: "Screw six cam bolts under the top",
      detail: "Lay the top upside down: two over each side and two over the divider.",
      fix: [fx("camScrew", [-xo, 0, xo].flatMap((x) => [-150, 150].map((z) => pt(x, yt, z))), [0, 1, 0], { on: "TP" })],
      wait: ["TP"],
      tools: ["screwdriver"],
    },
    { title: "Screw the wall brackets under the top", detail: "At the back, one near each end, with a screw and a washer.", fix: topBrackets([-400, 400], yt, -D / 2), tools: ["screwdriver"] },
    { title: "Put the top on", detail: "Onto all the dowels.", add: ["TP"], people: 2 },
    {
      title: "Lock the top",
      detail: "Six cam locks: inside the sides and both faces of the divider, near the top.",
      fix: [
        ...S.map((sx, i) => fx("cam", [-150, 150].map((z) => pt(sx * xi, yt - 34, z)), [sx, 0, 0], { on: i ? "SR" : "SL", ...CAM })),
        fx("cam", [pt(-T / 2, yt - 34, -150), pt(T / 2, yt - 34, 150)], [1, 0, 0], { on: "DV", ...CAM }),
      ],
      tools: ["screwdriver"],
    },
    ...wallSteps({ yTop: yt, zBack: -D / 2, xs: [-400, 400] }),
  ];
  buildCustom(b, { ...s, custom: { parts, steps } });
  const types = new Map<string, string>();
  const cx = (c: number) => (c ? 1 : -1) * (T / 2 + cw / 2);
  // the top row's boxes are low: an inner drawer runs above each one, behind the tall front
  const inner = [0, 1].map((c) => ankDrawer(b, { cx: cx(c), yb: yt - 110, ow: cw - 30, oh: 110, zFace: D / 2 - 30, dd: D - T - 80, boxH: 70, strip: false, types }));
  const top = [0, 1].map((c) => ankDrawer(b, { cx: cx(c), yb: PL + 2 * pitch, ow: cw, oh: pitch, zFace: D / 2, dd: D - T - 40, boxH: 110, wire: true, types }));
  const low = [0, 1].flatMap((r) => [0, 1].map((c) => ankDrawer(b, { cx: cx(c), yb: PL + r * pitch, ow: cw, oh: pitch, zFace: D / 2, dd: D - T - 40, wire: true, types })));
  ankDrawerSteps(b, inner, { scene: "inner", label: "inner drawer" });
  ankDrawerSteps(b, top, { scene: "top-drawer" });
  ankDrawerSteps(b, low, { scene: "drawer" });
  b.step({ title: "Slide in the inner drawers", detail: "Into the top of each half, then screw in the four stops so they pull out no more than 18 cm.", kind: "drawer", tools: ["screwdriver"] }, () => {
    for (const d of inner) for (const k of [d.front, ...d.sides, d.back, d.bottom]) b.add(k, [0, 0, 480]);
    b.then(0.1);
    b.fits({ kind: "screw", len: 10, dia: 4, name: "Stop screw" }, inner.flatMap((d) => S.map((g): FitOpts => ({ at: [d.cx + g * (d.bw / 2 - 20), yt, -D / 2 + 60], dir: [0, 1, 0] }))), 0.1);
  });
  ankDrawersIn(b, [low, top], "Push the drawers in", "Each onto its runners, all the way in. The low top-row drawers go at the top, under the inner drawers.");
}

/* ---------------------------------------------------------------- wardrobe with sliding doors */

function wardrobe(b: PlanBuilder, s: ProductSpec) {
  const W = 980, H = 1900, D = 600, PL = 60;
  const xo = W / 2 - T / 2, xi = W / 2 - T;
  const yt = H - T, yb = PL + T;
  const zDoor = [D / 2 - 14, D / 2 - 40]; // front and back door
  const zC = D / 2 - 60; // carcass parts stop here, the doors run in front
  const zB = -D / 2 + 10;
  const dep = zC - (zB + 2);
  const zm = (zC + zB + 2) / 2;
  const yS = 340; // fixed shelf over the drawers
  const dvx = 40; // the divider sits a little right of the middle
  const parts: CustomPart[] = [
    { id: "SL", name: "Side", size: [T, H, D], pos: [-xo, H / 2, 0] },
    { id: "SR", name: "Side", size: [T, H, D], pos: [xo, H / 2, 0] },
    { id: "BT", name: "Bottom", size: [W - 2 * T, T, D - 20], pos: [0, PL + T / 2, -10] },
    { id: "PF", name: "Plinth", size: [W - 2 * T, PL, T], pos: [0, PL / 2, D / 2 - 20 - T / 2] },
    { id: "FS", name: "Fixed shelf", size: [W - 2 * T, T, D / 2 - (zB + 2)], pos: [0, yS + T / 2, (D / 2 + zB + 2) / 2] },
    { id: "DD", name: "Drawer divider", size: [T, yS - yb, D / 2 - 20 - (zB + 2)], pos: [0, (yS + yb) / 2, (D / 2 - 20 + zB + 2) / 2] },
    { id: "DV", name: "Divider", size: [T, yt - yS - T, dep], pos: [dvx, (yt + yS + T) / 2, zm] },
    { id: "TP", name: "Top", size: [W - 2 * T, T, D - 20], pos: [0, yt + T / 2, -10] },
    ...S.map((sx, i): CustomPart => ({ id: `B${i}`, name: "Back panel", size: [W / 2 - T + 4, H - PL - 4, 3], pos: [sx * (W / 4 - T / 2 + 1), (H + PL) / 2, zB], material: "fiber" })),
    { id: "UT", name: "Upper door track", size: [W - 2 * T, 20, 56], pos: [0, yt - 10, D / 2 - 28], material: "metal" },
    { id: "LT", name: "Lower door track", size: [W - 2 * T, 8, 56], pos: [0, yS + T + 4, D / 2 - 28], material: "metal" },
    ...[0, 1].map((k): CustomPart => {
      const x0 = k ? dvx + T / 2 : -xi, x1 = k ? xi : dvx - T / 2;
      return { id: `R${k}`, name: "Clothes rail", size: [x1 - x0 - 4, 25, 25], pos: [(x0 + x1) / 2, yt - 80, zm], shape: "cyl", material: "metal" };
    }),
    ...[0, 1, 2].map((k): CustomPart => ({ id: `L${k}`, name: "Shelf", size: [xi - dvx - T / 2 - 2, T, dep - 20], pos: [(xi + dvx + T / 2) / 2, yS + 340 + k * 330, zm - 10] })),
    { id: "DB", name: "Sliding door", size: [W / 2 - T + 20, yt - 20 - (yS + T + 8), 18], pos: [-(W / 4 - T / 2 - 10), (yt - 20 + yS + T + 8) / 2, zDoor[1]] },
    { id: "DF", name: "Sliding door", size: [W / 2 - T + 20, yt - 20 - (yS + T + 8), 18], pos: [W / 4 - T / 2 - 10, (yt - 20 + yS + T + 8) / 2, zDoor[0]] },
  ];
  const yOf: Record<string, number> = { BT: PL + T / 2, PF: PL / 2, FS: yS + T / 2, TP: yt + T / 2 };
  const zOf: Record<string, number[]> = { BT: [-160, 160], PF: [D / 2 - 20 - T / 2], FS: [-160, 160], TP: [-160, 160] };
  const sideBolts = (sx: number, on: string, ids: string[]) => fx("camScrew", ids.flatMap((id) => zOf[id].map((z) => pt(sx * xi, yOf[id], z + 40))), [sx, 0, 0], { on });
  const dowels = (id: string) => S.map((sx) => fx("dowel", zOf[id].map((z) => pt(sx * xi, yOf[id], z)), [-sx, 0, 0], { on: id, ...DOWEL }));
  const cams = (sx: number, ids: string[]) =>
    ids.map((id) => {
      const up = id !== "TP";
      const face = id === "PF" ? D / 2 - 20 - T : 0;
      if (id === "PF") return fx("cam", [pt(sx * (xi - 34), PL / 2, face)], [0, 0, 1], { on: id, ...CAM });
      return fx("cam", zOf[id].map((z) => pt(sx * (xi - 34), up ? yOf[id] + T / 2 : yOf[id] - T / 2, z + 40)), [0, up ? -1 : 1, 0], { on: id, ...CAM });
    });
  const ids = ["TP", "FS", "BT", "PF"];
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into both sides",
      detail: "Lay them on a rug, inside up. Seven in each, by hand until they stop.",
      add: ["SL"],
      fix: [sideBolts(-1, "SL", ids), sideBolts(1, "SR", ids)],
      wait: ["SR"],
      tools: ["screwdriver"],
      pose: "-z",
      warnings: ["floor"],
    },
    {
      title: "Screw the drawer runners in",
      detail: "One low on each side and one on each face of the drawer divider, three screws each.",
      fix: [...runner(-xi, yb + 50, -1, "SL", 40), ...runner(xi, yb + 50, 1, "SR", 40), ...runner(-T / 2, yb + 50, 1, "DD", 40), ...runner(T / 2, yb + 50, -1, "DD", 40)],
      wait: ["DD"],
      tools: ["screwdriver"],
    },
    { title: "Tap the dowels into the panels", detail: "Two in each end of the top, the fixed shelf and the bottom, one in each end of the plinth.", fix: [...dowels("TP"), ...dowels("FS"), ...dowels("BT"), ...dowels("PF")], wait: ["TP", "FS", "BT", "PF"], tools: ["hammer"] },
    { title: "Push the fixed shelf onto the side", detail: "Onto the side's dowels and cam bolts, then stand the two dividers against it.", add: ["FS", "DD", "DV"], from: { FS: [600, 0, 0], DD: [600, 0, 0], DV: [600, 0, 0] } },
    {
      title: "Screw the drawer divider and the divider to the fixed shelf",
      detail: "Two long screws through the shelf into each: the drawer divider below, the divider above.",
      fix: [
        fx("bolt", [-100, 100].map((z) => pt(0, yS + T, zm + z)), [0, -1, 0], { len: 80, dia: 6, name: "Long connecting screw", on: "FS" }),
        fx("bolt", [-100, 100].map((z) => pt(dvx, yS, zm + z)), [0, 1, 0], { len: 80, dia: 6, name: "Long connecting screw", on: "FS" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Fit the top, the bottom and the plinth", detail: "All onto the dowels and cam bolts of the side.", add: ["TP", "BT", "PF"] },
    { title: "Lock them to the side", detail: "Seven cam locks, arrow towards the bolt.", fix: cams(-1, ids), tools: ["screwdriver"] },
    {
      title: "Screw the dividers to the top and the bottom",
      detail: "Long screws through the top into the divider and through the bottom into the drawer divider.",
      fix: [
        fx("bolt", [-100, 100].map((z) => pt(dvx, yt + T, zm + z)), [0, -1, 0], { len: 80, dia: 6, name: "Long connecting screw", on: "TP" }),
        fx("bolt", [-100, 100].map((z) => pt(0, PL, zm + z)), [0, 1, 0], { len: 80, dia: 6, name: "Long connecting screw", on: "BT" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Put on the other side", detail: "Together: onto all the dowels and cam bolts.", add: ["SR"], people: 2 },
    { title: "Lock the other side", detail: "Seven cam locks.", fix: cams(1, ids), tools: ["screwdriver"] },
    { title: "Slide the back panels in", detail: "Both halves along the grooves, smooth side out.", add: ["B0", "B1"], from: { B0: [0, 1500, 0], B1: [0, 1500, 0] } },
    {
      title: "Fix the back with the connectors",
      detail: "Fourteen along the shelf, the dividers and the edges: push each sleeve in, then its pin.",
      fix: [
        fx("clip", [...[-xo, xo].flatMap((x) => [500, 1100, 1700].map((y) => pt(x, y, zB - 2))), ...[-300, 300].map((x) => pt(x, yS + T / 2, zB - 2)), ...[700, 1200, 1700].map((y) => pt(dvx, y, zB - 2)), pt(0, 200, zB - 2), ...[-300, 300].map((x) => pt(x, yt + 8, zB - 2)), pt(0, yt + 8, zB - 2)], [0, 0, 1], { name: "Back connector sleeve", len: 12, dia: 10 }),
        fx("clip", [...[-xo, xo].flatMap((x) => [500, 1100, 1700].map((y) => pt(x, y, zB - 3))), ...[-300, 300].map((x) => pt(x, yS + T / 2, zB - 3)), ...[700, 1200, 1700].map((y) => pt(dvx, y, zB - 3)), pt(0, 200, zB - 3), ...[-300, 300].map((x) => pt(x, yt + 8, zB - 3)), pt(0, yt + 8, zB - 3)], [0, 0, 1], { name: "Back connector pin", len: 14, dia: 8 }),
      ],
    },
    { title: "Screw the wall brackets on top", detail: "At the back, one near each end, with a screw and a washer.", fix: topBrackets([-300, 300], H, -D / 2 + 10).map((f) => ({ ...f, dir: [0, -1, 0] as Vec3 })), tools: ["screwdriver"] },
    { title: "Stand it up", detail: "Together, and mind the ceiling: stand it up next to where it goes.", pose: "+y", people: 2, warnings: ["two"] },
    {
      title: "Press in the foot strips",
      detail: "Tip it back a little at a time: six, under the sides and the plinth.",
      fix: [fx("glide", [...S.flatMap((sx) => [-200, 200].map((z) => pt(sx * xo, 0, z))), ...[-200, 200].map((x) => pt(x, 0, D / 2 - 20 - T / 2))], [0, 1, 0], FOOT)],
      people: 2,
    },
    ...wallSteps({ yTop: H + 20, zBack: -D / 2, xs: [-300, 300] }),
    { title: "Press the door tracks in", detail: "The upper track under the top and the lower track along the front of the fixed shelf, along their whole length.", add: ["UT", "LT"] },
    { title: "Clip in the rail holders", detail: "Two in each compartment, near the top.", fix: [fx("clip", [pt(-xi, yt - 80, zm), pt(dvx - T / 2, yt - 80, zm)], [1, 0, 0], { name: "Rail holder", len: 30, dia: 30 }), fx("clip", [pt(dvx + T / 2, yt - 80, zm), pt(xi, yt - 80, zm)], [-1, 0, 0], { name: "Rail holder", len: 30, dia: 30 })] },
    { title: "Drop the clothes rails in", detail: "One in each compartment.", add: ["R0", "R1"] },
    {
      title: "Push in the shelf pins",
      detail: "Twelve in the right compartment, four at the height of each shelf.",
      fix: [0, 1, 2].flatMap((k) => [fx("pin", [-150, 150].map((z) => pt(dvx + T / 2, yS + 340 + k * 330 - T / 2 - 4, zm + z)), [-1, 0, 0]), fx("pin", [-150, 150].map((z) => pt(xi, yS + 340 + k * 330 - T / 2 - 4, zm + z)), [1, 0, 0])]).map((f) => ({ ...f, dir: [f.at![0][0] > dvx + 20 ? 1 : -1, 0, 0] as Vec3 })),
    },
    { title: "Lay the shelves on the pins", detail: "Three of them.", add: ["L0", "L1", "L2"] },
    {
      title: "Fit the door wheels and guides",
      detail: "Lay the doors on a rug. Two guides in the top edge and two wheels in the bottom edge of each, pushed in until they click.",
      fix: [
        ...[["DB", 1], ["DF", 0]].flatMap(([id, k]) => {
          const p = parts.find((x) => x.id === id)!;
          const top = p.pos[1] + p.size[1] / 2, bot = p.pos[1] - p.size[1] / 2;
          return [
            fx("clip", [-1, 1].map((g) => pt(p.pos[0] + g * (p.size[0] / 2 - 60), top, zDoor[k as number])), [0, -1, 0], { name: "Top guide", len: 20, dia: 16, on: id as string }),
            fx("castor", [-1, 1].map((g) => pt(p.pos[0] + g * (p.size[0] / 2 - 60), bot, zDoor[k as number])), [0, 1, 0], { name: "Door wheel", len: 20, dia: 24, on: id as string }),
          ];
        }),
      ],
      wait: ["DB", "DF"],
      warnings: ["floor"],
    },
    { title: "Hang the back door", detail: "Top into the upper track's back groove, then lift and swing the bottom in until the wheels click onto the lower track.", add: ["DB"], from: { DB: [0, 0, 400] } },
    { title: "Hang the front door", detail: "The same in the front grooves.", add: ["DF"], from: { DF: [0, 0, 400] } },
    { title: "Adjust the doors", detail: "Turn the four wheel screws until the doors hang straight and meet the sides evenly.", tools: ["screwdriver"], check: "square" },
    {
      title: "Screw the door stops in",
      detail: "One on each side under the top, two screws each, so the doors stop before they hit the sides.",
      fix: [...S.map((sx, i) => fx("clip", [pt(sx * xi, yt - 40, D / 2 - 30)], [sx, 0, 0], { name: "Door stop", len: 30, dia: 20, on: i ? "SR" : "SL" })), ...S.map((sx, i) => fx("screw", [-80, -40].map((dz) => pt(sx * xi, yt - 40, D / 2 + dz)), [sx, 0, 0], { len: 12, dia: 4, on: i ? "SR" : "SL" }))],
      tools: ["screwdriver"],
    },
  ];
  buildCustom(b, { ...s, custom: { parts, steps } });
  const types = new Map<string, string>();
  const cw = W / 2 - T - T / 2;
  const ds = S.map((sx) => ankDrawer(b, { cx: sx * (T / 2 + cw / 2), yb, ow: cw, oh: yS - yb, zFace: D / 2, dd: D / 2 - 16 - zB - 30, types }));
  ankDrawerSteps(b, ds, { scene: "drawer" });
  ankDrawersIn(b, [ds], "Push the drawers in", "Onto their runners under the fixed shelf, all the way in.");
}

const family: Family = {
  names: ["ANKARUDDEN"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (slug === "ankarudden-chest-4-drawers-80-x-48-x-107") return chest4(b, s), true;
    if (slug === "ankarudden-chest-6-drawers-139-x-48-x-87") return chest6(b, s), true;
    if (slug === "ankarudden-wardrobe-sliding-doors-98-x-60-x-190") return wardrobe(b, s), true;
    return false;
  },
};
export default family;
