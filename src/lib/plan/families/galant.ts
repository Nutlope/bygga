import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, ProductSpec, Vec3 } from "../../types";

/**
 * GALANT, read from its manuals. Every carcass goes together with cam bolts screwed into the sides, wooden dowels
 * and cam locks, with a finished back that slides into grooves, so it can stand in the middle of a room. The drawer
 * units on castors are built lying on their left side, turned upside down for the castors and given an interlock bar
 * so only one drawer opens at a time; their drawers have steel sides that click onto runners already in the carcass,
 * and the shallow top tray is a wooden box on cam locks. The 80 cm drawer unit and the cabinets stand on a steel
 * plinth frame clicked together from rails and corner pieces, bolted under the bottom and levelled on screw feet.
 * The cabinet with doors is built lying on its back and gets clip hinges; the sliding door cabinet is built upright
 * on its frame, with a middle divider, two backs, tracks top and bottom and doors hung on rollers.
 */

type Fx = Omit<CustomFix, "count" | "at"> & { at: Vec3[] };
const fx = (f: Fx): CustomFix => ({ ...f, count: f.at.length });
const SX = [-1, 1];
const T = 18;
const CAM = { kind: "cam", dia: 15 } as const;
const SMALL_CAM = { kind: "cam", name: "Small cam lock", dia: 12 } as const;
const BOLT = { kind: "camScrew", len: 34 } as const;
const SHORT_BOLT = { kind: "camScrew", name: "Short cam bolt", len: 24, dia: 6 } as const;
const DOWEL = { kind: "dowel", len: 30, dia: 8 } as const;
const SMALL_DOWEL = { kind: "dowel", len: 25, dia: 6 } as const;
const SCREW = { kind: "screw", len: 12, dia: 3.5 } as const;
const HSCREW = { kind: "screw", name: "Handle screw", len: 20, dia: 4 } as const;

interface Box {
  W: number;
  H: number;
  D: number;
  yb: number; // underside of the bottom panel
  xi: number; // inside face of the sides
  zF: number;
  zB: number;
}

const boxOf = (s: ProductSpec, yb: number): Box => {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  return { W, H, D, yb, xi: W / 2 - T, zF: D / 2, zB: -D / 2 };
};

/** Sides from the bottom to under the top, bottom between them, top on them, finished back in grooves between them. */
function carcass(b: Box, backs = 1): CustomPart[] {
  const { W, H, D, yb, xi, zB } = b;
  const hs = H - T - yb;
  const parts: CustomPart[] = [
    { id: "L", name: "Side panel", size: [T, hs, D], pos: [-(W / 2 - T / 2), yb + hs / 2, 0] },
    { id: "R", name: "Side panel", size: [T, hs, D], pos: [W / 2 - T / 2, yb + hs / 2, 0] },
    { id: "bottom", name: "Bottom", size: [2 * xi, T, D - 20], pos: [0, yb + T / 2, 10] },
    { id: "top", name: "Top", size: [W, T, D], pos: [0, H - T / 2, 0] },
  ];
  const bw = (2 * xi - (backs - 1) * T) / backs;
  for (let i = 0; i < backs; i++)
    parts.push({ id: backs === 1 ? "back" : `back${i}`, name: "Back panel", size: [bw, hs - T, T], pos: [-xi + bw / 2 + i * (bw + T), yb + T + (hs - T) / 2, zB + 10] });
  return parts;
}

// fitting points along the joints
const edgeZ = (b: Box, n: number) => Array.from({ length: n }, (_, i) => b.zB + 60 + ((b.D - 120) * i) / Math.max(1, n - 1));
const bottomJoint = (b: Box, sx: number, n: number): Vec3[] => edgeZ(b, n).map((z) => [sx * b.xi, b.yb + T / 2, z]);
const topJoint = (b: Box, sx: number, n: number): Vec3[] => edgeZ(b, n).map((z) => [sx * (b.W / 2 - T / 2), b.H - T, z]);
const camIn = (pts: Vec3[], sx: number, dy = 0): Vec3[] => pts.map((p) => [sx * (Math.abs(p[0]) - 30), p[1] + dy, p[2]]);

/** A drawer with steel sides that click onto the carcass runners: front, two steel sides, bottom and back. */
function steelDrawer(id: string, b: Box, y0: number, fh: number): CustomPart[] {
  const fw = 2 * b.xi - 4, dd = b.D - 60, sh = Math.min(fh - 40, 130);
  const z0 = b.zF - T; // back of the front
  const xs = b.xi - 20;
  return [
    { id: `${id}f`, name: "Drawer front", size: [fw, fh, T], pos: [0, y0 + fh / 2, b.zF - T / 2] },
    { id: `${id}l`, name: "Drawer side", size: [14, sh, dd], pos: [-xs, y0 + 20 + sh / 2, z0 - dd / 2], material: "metal" },
    { id: `${id}r`, name: "Drawer side", size: [14, sh, dd], pos: [xs, y0 + 20 + sh / 2, z0 - dd / 2], material: "metal" },
    { id: `${id}bt`, name: "Drawer bottom", size: [2 * xs - 14, 12, dd - 12], pos: [0, y0 + 26, z0 - dd / 2 - 6] },
    { id: `${id}bk`, name: "Drawer back", size: [2 * xs - 14, sh - 14, 12], pos: [0, y0 + 32 + (sh - 14) / 2, z0 - dd + 6] },
  ];
}
const ids = (id: string, ks: string[]) => ks.map((k) => id + k);
const STEEL = ["f", "l", "r", "bt", "bk"];

function steelDrawerFix(id: string, b: Box, y0: number, fh: number) {
  const dd = b.D - 60, z0 = b.zF - T, xs = b.xi - 20;
  const yh = y0 + fh - 30;
  return {
    clips: fx({ kind: "clip", name: "Back clip", len: 14, dia: 12, at: SX.map((sx) => [sx * (xs - 7), y0 + 80, z0 - dd + 6] as Vec3), dir: [0, 0, 1], on: `${id}bk` }),
    screws: fx({ ...SCREW, at: [-1, 1].flatMap((k) => [-0.3, 0.3].map((t) => [t * xs * 2, y0 + 20, z0 - dd + 6 + k * 0] as Vec3)).slice(0, 4), dir: [0, 1, 0], on: `${id}bt`, mate: `${id}bk` }),
    fittings: fx({ kind: "connector", name: "Front fitting", len: 40, dia: 20, at: SX.map((sx) => [sx * (xs - 10), y0 + 60, z0] as Vec3), dir: [0, 0, 1], on: `${id}f` }),
    stud: fx({ kind: "stud", name: "Stop stud", len: 20, dia: 6, at: [[0, y0 + 30, z0]], dir: [0, 0, 1], on: `${id}f` }),
    handle: fx({ kind: "handle", len: 200, dia: 20, at: [[0, yh, b.zF]], dir: [0, 0, -1], on: `${id}f` }),
    hscrews: fx({ ...HSCREW, at: [-90, 90].map((x) => [x, yh, z0] as Vec3), dir: [0, 0, 1], on: `${id}f` }),
    catches: fx({ kind: "clip", name: "Runner catch", len: 30, dia: 14, at: SX.map((sx) => [sx * (b.xi - 2), y0 + 40, b.zF - 60] as Vec3), dir: [1, 0, 0] }),
  };
}

/** The four steel drawer steps the manuals show, for the first drawer, then the rest the same way. */
function steelDrawerSteps(list: { id: string; y0: number; fh: number }[], b: Box): CustomStep[] {
  const [first, ...rest] = list;
  const f = steelDrawerFix(first.id, b, first.y0, first.fh);
  const steps: CustomStep[] = [
    { title: "Click the back onto the drawer sides", detail: "Lay the steel sides on the table, then push the back into them until both ends click.", add: ids(first.id, ["l", "r", "bk"]), fix: [f.clips] },
    { title: "Slide in the bottom and screw it to the back", detail: "Along the grooves in the sides, then four screws up through it into the back.", add: [`${first.id}bt`], fix: [f.screws], tools: ["screwdriver"] },
    { title: "Fit the front", detail: "Screw the two fittings and the stop stud into the back of the front, then push the sides onto them until they click.", add: [`${first.id}f`], fix: [f.fittings, f.stud], tools: ["screwdriver"] },
    { title: "Screw on the handle", detail: "Two screws from behind.", fix: [f.handle, f.hscrews], tools: ["screwdriver"] },
  ];
  if (rest.length) {
    const fs = rest.map((r) => steelDrawerFix(r.id, b, r.y0, r.fh));
    const merge = (k: keyof ReturnType<typeof steelDrawerFix>): CustomFix => {
      const at = fs.flatMap((x) => x[k].at!);
      return { ...fs[0][k], at, count: at.length, on: undefined, mate: undefined };
    };
    steps.push({
      title: rest.length === 1 ? "Build the other drawer" : `Build the other ${rest.length} drawers`,
      detail: "The same way.",
      add: rest.flatMap((r) => ids(r.id, STEEL)),
      fix: (["clips", "screws", "fittings", "stud", "handle", "hscrews"] as const).map(merge),
      repeat: rest.length,
      tools: ["screwdriver"],
    });
  }
  const catches = list.map((r) => steelDrawerFix(r.id, b, r.y0, r.fh).catches);
  const at = catches.flatMap((c) => c.at!);
  steps.push(
    { title: "Click the catches onto the runners", detail: "One at the front of each runner, so the drawers lock on.", fix: SX.map((sx) => ({ ...catches[0], at: at.filter((p) => Math.sign(p[0]) === sx), count: at.filter((p) => Math.sign(p[0]) === sx).length, dir: [sx, 0, 0] as Vec3 })) },
    { title: "Put the drawers in", detail: "Pull each runner out, lay the drawer on it and push it in until it clicks at both sides. Start from the bottom.", kind: "drawer" },
    { title: "Line up the fronts", detail: "Turn the wheels on the front fittings to move a front up, down or sideways until the gaps are even.", tools: ["screwdriver"] },
  );
  return steps;
}

/** The shallow wooden tray at the top of the castor units: back, two sides, bottom, front, on two short runners. */
function tray(b: Box, y0: number, fh: number): CustomPart[] {
  const fw = 2 * b.xi - 4, dd = b.D - 80, th = 12, sh = fh - 30;
  const z0 = b.zF - T, xs = b.xi - 20;
  return [
    { id: "tk", name: "Tray back", size: [2 * xs - 2 * th, sh, th], pos: [0, y0 + 15 + sh / 2, z0 - dd + th / 2] },
    { id: "tl", name: "Tray side", size: [th, sh, dd], pos: [-xs + th / 2, y0 + 15 + sh / 2, z0 - dd / 2] },
    { id: "tr", name: "Tray side", size: [th, sh, dd], pos: [xs - th / 2, y0 + 15 + sh / 2, z0 - dd / 2] },
    { id: "tb", name: "Tray bottom", size: [2 * xs - 2 * th + 10, 4, dd - th], pos: [0, y0 + 22, z0 - dd / 2 + th / 2], material: "fiber" },
    { id: "tf", name: "Tray front", size: [fw, fh, T], pos: [0, y0 + fh / 2, b.zF - T / 2] },
  ];
}

function traySteps(b: Box, y0: number, fh: number): CustomStep[] {
  const dd = b.D - 80, z0 = b.zF - T, xs = b.xi - 20, th = 12, ym = y0 + 15 + (fh - 30) / 2;
  const zk = z0 - dd + th / 2;
  return [
    {
      title: "Screw the short cam bolts into the tray sides",
      detail: "Two in each, at the front end. Lay the parts out on the table.",
      add: ["tl", "tr"],
      fix: SX.map((sx) => fx({ ...SHORT_BOLT, at: [[sx * (xs - th / 2), ym, z0 - 2]], dir: [0, 0, -1], on: sx < 0 ? "tl" : "tr" })).concat(SX.map((sx) => fx({ ...SHORT_BOLT, at: [[sx * (xs - th / 2), ym, zk + th]], dir: [0, 0, 1], on: sx < 0 ? "tl" : "tr" }))),
      tools: ["screwdriver"],
    },
    { title: "Fix the back between the sides", detail: "A dowel in each end of the back, then turn the two small cam locks.", add: ["tk"], fix: [fx({ ...SMALL_DOWEL, at: SX.map((sx) => [sx * (xs - th), ym + 15, zk] as Vec3), dir: [0, 0, 0], on: "tk" }), fx({ ...SMALL_CAM, at: SX.map((sx) => [sx * (xs - th - 25), ym, zk] as Vec3), dir: [0, 0, 1], on: "tk" })].map((f, i) => (i === 0 ? { ...f, dir: undefined } : f)), tools: ["screwdriver"] },
    { title: "Slide in the tray bottom", detail: "Along the grooves, from the open front.", add: ["tb"] },
    { title: "Fit the tray front", detail: "Two dowels into it, push it onto the sides and turn its two small cam locks.", add: ["tf"], from: { tf: [0, 0, 300] }, fix: [fx({ ...SMALL_DOWEL, at: SX.map((sx) => [sx * (xs - th / 2), ym + 15, z0] as Vec3), dir: [0, 0, -1], on: "tf" }), fx({ ...SMALL_CAM, at: SX.map((sx) => [sx * (xs - th / 2 - 30), ym, z0 - 1] as Vec3), dir: [0, 0, -1], on: "tf" })], tools: ["screwdriver"] },
    { title: "Screw the stop brackets under the sides", detail: "One at the back of each side, one screw each.", fix: [fx({ kind: "angle", name: "Stop bracket", len: 30, dia: 24, at: SX.map((sx) => [sx * (xs - th / 2), y0 + 15, zk + 40] as Vec3), dir: [0, 1, 0] }), fx({ ...SCREW, at: SX.map((sx) => [sx * (xs - th / 2), y0 + 15, zk + 40] as Vec3), dir: [0, 1, 0] })], tools: ["screwdriver"] },
    { title: "Screw on the tray handle", detail: "Two screws from behind.", fix: [fx({ kind: "handle", len: 200, dia: 20, at: [[0, y0 + fh / 2, b.zF]], dir: [0, 0, -1], on: "tf" }), fx({ ...HSCREW, at: [-90, 90].map((x) => [x, y0 + fh / 2, z0] as Vec3), dir: [0, 0, 1], on: "tf" })], tools: ["screwdriver"] },
    {
      title: "Fit the tray runners and slide the tray in",
      detail: "Pull the two short runners forward, lay the tray on them and push it in. Then press the two stops onto the runners.",
      fix: [fx({ kind: "stud", name: "Tray stop", len: 30, dia: 12, at: SX.map((sx) => [sx * (b.xi - 2), y0 + 10, b.zF - 120] as Vec3), dir: [0, 1, 0] })],
      kind: "drawer",
    },
  ];
}

/** The castor units: carcass on its left side, castors upside down, interlock bar, drawers. */
function pedestal(s: ProductSpec, file: boolean): CustomParams {
  const b = boxOf(s, 70);
  const { W, H, yb, xi, zB, zF } = b;
  const yIn = yb + T, top = H - T;
  const trayH = 90, gap = 3;
  const yTray = top - gap - trayH;
  const parts: CustomPart[] = [...carcass(b), ...tray(b, yTray, trayH)];
  const drawers = file ? [{ id: "d0", y0: yIn + gap, fh: yTray - gap - yIn - gap }] : [0, 1].map((i) => ({ id: `d${i}`, y0: yIn + gap + i * ((yTray - yIn - gap) / 2), fh: (yTray - yIn - gap) / 2 - gap }));
  for (const d of drawers) parts.push(...steelDrawer(d.id, b, d.y0, d.fh));
  parts.push({ id: "bar", name: "Interlock bar", size: [20, yTray - yIn - 20, 20], pos: [xi - 30, (yIn + yTray) / 2, zB + 60], material: "metal" });
  if (file) parts.push(...SX.map((sx, i): CustomPart => ({ id: `rail${i}`, name: "File rail", size: [10, 10, b.D - 120], pos: [sx * (xi - 50), drawers[0].y0 + drawers[0].fh - 40, -20], shape: "cyl", material: "metal" })));
  const castXZ: [number, number][] = SX.flatMap((sx) => [zB + 60, zF - 60].map((z) => [sx * (W / 2 - 50), z] as [number, number]));
  const steps: CustomStep[] = [
    {
      title: "Screw the cam bolts into the sides",
      detail: "Lay both sides on a rug, runners up. Four bolts in each, by hand until they stop.",
      add: ["L"],
      fix: [fx({ ...BOLT, at: [...bottomJoint(b, -1, 2), ...topJoint(b, -1, 2)].map((p) => [-W / 2 + T / 2, p[1], p[2]] as Vec3), dir: [0, 0, 0], on: "L" })].map((f) => ({ ...f, dir: [1, 0, 0] as Vec3 })),
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Stand the bottom on the side", detail: "A dowel into each end of its edge, then press it onto the side's bolts.", add: ["bottom"], fix: [fx({ ...DOWEL, at: [zB + 40, zF - 40].map((z) => [-xi, yb + T / 2, z] as Vec3), dir: [1, 0, 0], on: "bottom" })], tools: ["hammer"] },
    { title: "Lock the bottom with three cam locks", detail: "Arrow towards the bolt, then turn each one clockwise.", fix: [fx({ ...CAM, at: camIn(bottomJoint(b, -1, 3), -1), dir: [0, 1, 0], on: "bottom" })], tools: ["screwdriver"] },
    { title: "Slide the back down into the grooves", detail: "Finished side out. It goes all the way down to the bottom.", add: ["back"] },
    { title: "Lock the back with a small cam lock", detail: "The small ones from the bag, not the big ones.", fix: [fx({ ...SMALL_CAM, at: [[0, yb + T + 40, zB + 30]], dir: [0, 0, -1], on: "back" })], tools: ["screwdriver"] },
    {
      title: "Lay the other side on",
      detail: "Screw its four cam bolts in first and tap two dowels into the bottom, then lower it on, runners down.",
      add: ["R"],
      fix: [fx({ ...BOLT, at: [...bottomJoint(b, 1, 2), ...topJoint(b, 1, 2)].map((p) => [W / 2 - T / 2, p[1], p[2]] as Vec3), dir: [-1, 0, 0], on: "R" }), fx({ ...DOWEL, at: [zB + 40, zF - 40].map((z) => [xi, yb + T / 2, z] as Vec3), dir: [-1, 0, 0], on: "bottom" })],
      people: 2,
      warnings: ["two"],
    },
    { title: "Lock the back to it", detail: "One small cam lock.", fix: [fx({ ...SMALL_CAM, at: [[xi - 40, top - 40, zB + 30]], dir: [0, 0, -1], on: "back" })], tools: ["screwdriver"] },
    { title: "Lock the bottom to it", detail: "Three cam locks.", fix: [fx({ ...CAM, at: camIn(bottomJoint(b, 1, 3), 1), dir: [0, 1, 0], on: "bottom" })], tools: ["screwdriver"] },
    { title: "Screw the cam bolts into the top", detail: "Six, into the holes on its underside.", fix: [fx({ ...BOLT, at: SX.flatMap((sx) => topJoint(b, sx, 3)), dir: [0, 1, 0], on: "top" })], tools: ["screwdriver"] },
    { title: "Push the top on", detail: "Four dowels into the tops of the sides, then slide the top onto them.", add: ["top"], fix: [fx({ ...DOWEL, at: SX.flatMap((sx) => [zB + 30, zF - 30].map((z) => [sx * (W / 2 - T / 2), top, z] as Vec3)), dir: [0, -1, 0] })], tools: ["hammer"] },
    { title: "Lock the top with six cam locks", detail: "Three inside each side, near the top. Then turn the unit upside down on the rug.", fix: SX.map((sx) => fx({ ...CAM, at: topJoint(b, sx, 3).map((p) => [sx * xi, p[1] - 30, p[2]] as Vec3), dir: [sx, 0, 0] })), tools: ["screwdriver"] },
    {
      title: "Screw the castor plates under the bottom",
      detail: "One at each corner, four screws each.",
      fix: [
        fx({ kind: "plate", name: "Castor plate", len: 4, dia: 50, at: castXZ.map(([x, z]) => [x, yb, z] as Vec3), dir: [0, 1, 0], on: "bottom" }),
        fx({ ...SCREW, at: castXZ.flatMap(([x, z]) => [[-14, -14], [14, -14], [14, 14], [-14, 14]].map(([dx, dz]) => [x + dx, yb, z + dz] as Vec3)), dir: [0, 1, 0], on: "bottom" }),
      ],
      tools: ["screwdriver"],
      pose: "-y",
    },
    { title: "Click the castors in", detail: "Push each castor's pin into its plate until it clicks.", fix: [fx({ kind: "castor", at: castXZ.map(([x, z]) => [x, yb, z] as Vec3), dir: [0, 1, 0] })] },
    {
      title: "Fit the interlock bar",
      detail: "Stand it up. Hook the bar into the back of the right side, then press its top fitting into place: only one drawer can then be opened at a time.",
      add: ["bar"],
      fix: [fx({ kind: "connector", name: "Bar fitting", len: 30, dia: 20, at: [[xi - 30, yTray - 10, zB + 60]], dir: [1, 0, 0], on: "R" }), fx({ ...SCREW, at: [[xi, yTray - 30, zB + 60], [xi, yIn + 30, zB + 60]], dir: [1, 0, 0], on: "R" })],
      pose: "+y",
      tools: ["screwdriver"],
    },
  ];
  const df = steelDrawerSteps(drawers, b);
  if (file) {
    // the drop file drawer: a fifth castor under its front, and two hanging rails across it
    const d = drawers[0];
    df.splice(4, 0,
      { title: "Click the support castor under the front", detail: "Into the bracket under the drawer front, until it clicks.", fix: [fx({ kind: "castor", name: "Support castor", at: [[0, d.y0, zF - 60]], dir: [0, 1, 0], on: "d0f" })] },
      { title: "Click the file rails in", detail: "Into the holders for your paper size, A4 or letter, one on each side.", add: ["rail0", "rail1"], fix: [fx({ kind: "clip", name: "Rail holder", len: 20, dia: 14, at: SX.flatMap((sx) => [-200, 160].map((z) => [sx * (xi - 50), d.y0 + d.fh - 40, z] as Vec3)), dir: [0, -1, 0] })] },
    );
  }
  steps.push(...df, ...traySteps(b, yTray, trayH));
  return { parts, steps: fixDirs(steps) };
}

/** A dowel or cam whose way in was left open goes in from the nearer side. */
function fixDirs(steps: CustomStep[]): CustomStep[] {
  return steps.map((st) => ({
    ...st,
    fix: st.fix?.flatMap((f) => {
      if (f.dir && f.dir.some((v) => v)) return [f];
      return SX.map((sx) => ({ ...f, at: f.at!.filter((p) => Math.sign(p[0] || 1) === sx) }))
        .filter((g) => g.at.length)
        .map((g) => ({ ...g, count: g.at.length, dir: [-Math.sign(g.at[0][0] || 1), 0, 0] as Vec3 }));
    }),
  }));
}

/** The steel plinth frame: rails clicked into corner pieces (and T pieces on the wide cabinet), bolted under the bottom. */
function plinth(b: Box, mid: boolean): { parts: CustomPart[]; nodes: Vec3[] } {
  const L = b.W - 40, Dp = b.D - 60, t = 30, y = b.yb / 2 + 5;
  const parts: CustomPart[] = [];
  const long = mid ? 2 : 1;
  for (const sz of [-1, 1])
    for (let i = 0; i < long; i++) {
      const len = L / long - 50;
      parts.push({ id: `pl${sz < 0 ? "b" : "f"}${i}`, name: "Plinth rail", size: [len, t, 20], pos: [-L / 2 + (L / long) * (i + 0.5), y, sz * (Dp / 2)], material: "metal" });
    }
  const xs = mid ? [-L / 2, 0, L / 2] : [-L / 2, L / 2];
  xs.forEach((x, i) => parts.push({ id: `ps${i}`, name: "Short plinth rail", size: [20, t, Dp - 50], pos: [x, y, 0], material: "metal" }));
  const nodes = xs.flatMap((x) => [-1, 1].map((sz) => [x, y, sz * (Dp / 2)] as Vec3));
  return { parts, nodes };
}

function plinthSteps(b: Box, p: { parts: CustomPart[]; nodes: Vec3[] }, pose: "+z" | "-y" | "+y"): CustomStep[] {
  const top = b.yb;
  return [
    {
      title: "Click the plinth frame together",
      detail: `Push the rails into the corner pieces${p.nodes.length > 4 ? " and the two middle pieces" : ""} until they click.`,
      add: p.parts.map((x) => x.id),
      fix: [fx({ kind: "connector", name: "Corner piece", len: 40, dia: 50, at: p.nodes, dir: [0, 1, 0] })],
      pose,
    },
    {
      title: "Bolt the frame under the bottom",
      detail: "Through each corner piece into the bottom, by hand, then push a pin into each corner.",
      fix: [fx({ kind: "bolt", len: 30, dia: 8, at: p.nodes.map((n) => [n[0], top - 12, n[2]] as Vec3), dir: [0, 1, 0] }), fx({ kind: "pin", name: "Locking pin", len: 50, dia: 6, at: p.nodes.map((n) => [n[0] + 15, top - 10, n[2]] as Vec3), dir: [0, 1, 0] })],
      tools: ["allen"],
    },
    { title: "Screw in the feet", detail: "One into the underside of each corner piece, by hand.", fix: [fx({ kind: "foot", len: 20, dia: 40, at: p.nodes.map((n) => [n[0], 0, n[2]] as Vec3), dir: [0, 1, 0] })], warnings: ["hand"] },
  ];
}

/** The 80 cm drawer unit: on its side, then on its back, plinth frame, four steel drawers. */
function drawerUnit(s: ProductSpec): CustomParams {
  const b = boxOf(s, 60);
  const { W, H, yb, xi, zB, zF } = b;
  const yIn = yb + T, top = H - T, gap = 3;
  const fh = (top - yIn - 5 * gap) / 4;
  const drawers = [0, 1, 2, 3].map((i) => ({ id: `d${i}`, y0: yIn + gap + i * (fh + gap), fh }));
  const p = plinth(b, false);
  const parts: CustomPart[] = [...carcass(b), ...p.parts, ...drawers.flatMap((d) => steelDrawer(d.id, b, d.y0, d.fh))];
  parts.push(...SX.map((sx, i): CustomPart => ({ id: `bar${i}`, name: "Interlock bar", size: [20, top - yIn - 20, 20], pos: [sx * (xi - 30), (yIn + top) / 2, zB + 60], material: "metal" })));
  const steps: CustomStep[] = [
    { title: "Screw the cam bolts into the sides", detail: "Lay both sides on a rug, runners up. Four bolts in each, by hand.", add: ["L"], fix: [fx({ ...BOLT, at: [...bottomJoint(b, -1, 2), ...topJoint(b, -1, 2)].map((q) => [-W / 2 + T / 2, q[1], q[2]] as Vec3), dir: [1, 0, 0], on: "L" })], tools: ["screwdriver"], pose: "+x", warnings: ["floor"] },
    { title: "Stand the bottom on the side", detail: "A dowel into each end of its edge, then press it on.", add: ["bottom"], fix: [fx({ ...DOWEL, at: [zB + 40, zF - 40].map((z) => [-xi, yb + T / 2, z] as Vec3), dir: [1, 0, 0], on: "bottom" })], tools: ["hammer"] },
    { title: "Lock it with two cam locks", detail: "Arrow towards the bolt, then turn clockwise.", fix: [fx({ ...CAM, at: camIn(bottomJoint(b, -1, 2), -1), dir: [0, 1, 0], on: "bottom" })], tools: ["screwdriver"] },
    { title: "Turn it onto its back and slide the back in", detail: "Two small dowels in the back's edge, then push it along the grooves.", add: ["back"], fix: [fx({ ...SMALL_DOWEL, at: [[-xi + 2, yb + T + 100, zB + 10], [-xi + 2, top - 100, zB + 10]], dir: [1, 0, 0], on: "back" })], pose: "+z", tools: ["hammer"] },
    { title: "Lock the back with two small cam locks", detail: "The small ones from the bag.", fix: [fx({ ...SMALL_CAM, at: [[-xi + 40, yb + T + 100, zB + 20], [-xi + 40, top - 100, zB + 20]], dir: [0, 0, -1], on: "back" })], tools: ["screwdriver"] },
    { title: "Push on the other side", detail: "Screw its four cam bolts in, a dowel into each end of the bottom, then push it on.", add: ["R"], fix: [fx({ ...BOLT, at: [...bottomJoint(b, 1, 2), ...topJoint(b, 1, 2)].map((q) => [W / 2 - T / 2, q[1], q[2]] as Vec3), dir: [-1, 0, 0], on: "R" }), fx({ ...DOWEL, at: [zB + 40, zF - 40].map((z) => [xi, yb + T / 2, z] as Vec3), dir: [-1, 0, 0], on: "bottom" })] },
    { title: "Lock the back and the bottom to it", detail: "Two small cam locks in the back, two cam locks in the bottom.", fix: [fx({ ...SMALL_CAM, at: [[xi - 40, yb + T + 100, zB + 20], [xi - 40, top - 100, zB + 20]], dir: [0, 0, -1], on: "back" }), fx({ ...CAM, at: camIn(bottomJoint(b, 1, 2), 1), dir: [0, 1, 0], on: "bottom" })], tools: ["screwdriver"] },
    {
      title: "Fit the interlock bars under the top",
      detail: "Lay the top face down. Press the two bar fittings into their holes, then hook the bars in and turn them flat.",
      add: ["top"],
      fix: [fx({ kind: "connector", name: "Bar fitting", len: 30, dia: 20, at: SX.map((sx) => [sx * (xi - 30), top, zB + 60] as Vec3), dir: [0, 1, 0], on: "top" })],
      tools: ["screwdriver"],
    },
    { title: "Screw the cam bolts into the top", detail: "Four, into the holes on its underside.", fix: [fx({ ...BOLT, at: SX.flatMap((sx) => topJoint(b, sx, 2)), dir: [0, 1, 0], on: "top" })], tools: ["screwdriver"] },
    { title: "Push the top on and lock it", detail: "Dowels into the sides, slide the top on with the bars going down the inside, then turn four cam locks.", add: ["bar0", "bar1"], fix: [fx({ ...DOWEL, at: SX.flatMap((sx) => [zB + 30, zF - 30].map((z) => [sx * (W / 2 - T / 2), top, z] as Vec3)), dir: [0, -1, 0] }), ...SX.map((sx) => fx({ ...CAM, at: topJoint(b, sx, 2).map((q) => [sx * xi, q[1] - 30, q[2]] as Vec3), dir: [sx, 0, 0] }))], tools: ["screwdriver"] },
    ...plinthSteps(b, p, "+z"),
    { title: "Stand it up together", detail: "Onto its feet. Turn the feet to level it.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Fix the bag hook", detail: "Two plastic discs and the hook under the top at the side, one screw each.", fix: [fx({ kind: "hook", name: "Bag hook", len: 40, dia: 30, at: [[W / 2 - 60, top, zF - 80]], dir: [0, 1, 0], on: "top" }), fx({ kind: "screw", len: 16, dia: 4, at: [[W / 2 - 60, top, zF - 80], [-W / 2 + 60, top, zF - 80]], dir: [0, 1, 0], on: "top" })], tools: ["allen"] },
    ...steelDrawerSteps(drawers, b),
  ];
  return { parts, steps };
}

/** The cabinet with doors: lying on its back, plinth frame, shelves on pins, two doors on clip hinges. */
function cabinet(s: ProductSpec): CustomParams {
  const b = boxOf(s, 60);
  const { W, H, yb, xi, zB, zF } = b;
  const top = H - T;
  const p = plinth(b, false);
  const yS = [yb + T + (top - yb - T) / 3, yb + T + (2 * (top - yb - T)) / 3];
  const dw = (2 * xi - 7) / 2, dTop = H - 3, dBot = yb + 3, dh = dTop - dBot;
  const parts: CustomPart[] = [
    ...carcass(b),
    ...p.parts,
    ...yS.map((y, i): CustomPart => ({ id: `sh${i}`, name: "Shelf", size: [2 * xi - 2, T, b.D - 60], pos: [0, y, 0] })),
    ...SX.map((sx, i): CustomPart => ({ id: `door${i}`, name: "Door", size: [dw, dh, T], pos: [sx * (dw / 2 + 1.5), (dTop + dBot) / 2, zF + T / 2] })),
  ];
  const hy = [dBot + 100, (dBot + dTop) / 2, dTop - 100];
  const steps: CustomStep[] = [
    { title: "Screw the cam bolts into the sides", detail: "Lay them on a rug, inside face up. Four in each, by hand.", add: ["L"], fix: [fx({ ...BOLT, at: [...bottomJoint(b, -1, 2), ...topJoint(b, -1, 2)].map((q) => [-W / 2 + T / 2, q[1], q[2]] as Vec3), dir: [1, 0, 0], on: "L" })], tools: ["screwdriver"], pose: "+z", warnings: ["floor"] },
    { title: "Push the bottom onto a side", detail: "Stand the side on its back edge. A dowel into each end of the bottom's edge, then push it on.", add: ["bottom"], fix: [fx({ ...DOWEL, at: [zB + 40, zF - 40].map((z) => [-xi, yb + T / 2, z] as Vec3), dir: [1, 0, 0], on: "bottom" })], tools: ["hammer"] },
    { title: "Lock it with two cam locks", detail: "Arrow towards the bolt, then turn clockwise.", fix: [fx({ ...CAM, at: camIn(bottomJoint(b, -1, 2), -1), dir: [0, 1, 0], on: "bottom" })], tools: ["screwdriver"] },
    { title: "Click the cord outlet into the back", detail: "The two rings from both sides of the hole, until they click.", add: ["back"], fix: [fx({ kind: "cap", name: "Cord outlet", len: 10, dia: 60, at: [[xi - 120, yb + T + 120, zB + 1]], dir: [0, 0, 1], on: "back" })] },
    { title: "Slide the back into the grooves", detail: "Two small dowels go into its edge first. Finished side down, towards the floor.", fix: [fx({ ...SMALL_DOWEL, at: [[-xi + 2, yb + T + 150, zB + 10], [-xi + 2, top - 150, zB + 10]], dir: [1, 0, 0], on: "back" })], tools: ["hammer"] },
    { title: "Lock the back with two small cam locks", detail: "The small ones from the bag.", fix: [fx({ ...SMALL_CAM, at: [[-xi + 40, yb + T + 150, zB + 20], [-xi + 40, top - 150, zB + 20]], dir: [0, 0, -1], on: "back" })], tools: ["screwdriver"] },
    {
      title: "Push on the other side",
      detail: "Screw its four cam bolts in, dowels into the bottom, then push it on and turn the two cam locks in the bottom.",
      add: ["R"],
      fix: [
        fx({ ...BOLT, at: [...bottomJoint(b, 1, 2), ...topJoint(b, 1, 2)].map((q) => [W / 2 - T / 2, q[1], q[2]] as Vec3), dir: [-1, 0, 0], on: "R" }),
        fx({ ...DOWEL, at: [zB + 40, zF - 40].map((z) => [xi, yb + T / 2, z] as Vec3), dir: [-1, 0, 0], on: "bottom" }),
        fx({ ...CAM, at: camIn(bottomJoint(b, 1, 2), 1), dir: [0, 1, 0], on: "bottom" }),
      ],
      people: 2,
      warnings: ["two"],
      tools: ["screwdriver"],
    },
    // the top goes on last, down onto the ends of both sides, as the manual shows
    { title: "Screw the cam bolts into the top", detail: "Four, into the holes on its underside.", fix: [fx({ ...BOLT, at: SX.flatMap((sx) => topJoint(b, sx, 2)), dir: [0, 1, 0], on: "top" })], tools: ["screwdriver"], wait: ["top"] },
    {
      title: "Push the top on and lock it",
      detail: "Dowels into the ends of both sides, push the top on, then turn the four cam locks.",
      add: ["top"],
      from: { top: [0, 350, 0] },
      fix: [fx({ ...DOWEL, at: SX.flatMap((sx) => [zB + 30, zF - 30].map((z) => [sx * (W / 2 - T / 2), top, z] as Vec3)), dir: [0, -1, 0] }), ...SX.map((sx) => fx({ ...CAM, at: topJoint(b, sx, 2).map((q) => [sx * xi, q[1] - 30, q[2]] as Vec3), dir: [sx, 0, 0] }))],
      tools: ["screwdriver", "hammer"],
    },
    ...plinthSteps(b, p, "+z"),
    { title: "Stand it up together", detail: "Onto its feet. Turn the feet to level it.", pose: "+y", people: 2, warnings: ["two"] },
    { title: "Fix the bag hook", detail: "Two plastic discs and the hook under the top at the side, one screw each.", fix: [fx({ kind: "hook", name: "Bag hook", len: 40, dia: 30, at: [[W / 2 - 60, top, zF - 80]], dir: [0, 1, 0], on: "top" }), fx({ kind: "screw", len: 16, dia: 4, at: [[W / 2 - 60, top, zF - 80], [-W / 2 + 60, top, zF - 80]], dir: [0, 1, 0], on: "top" })], tools: ["allen"] },
    { title: "Push in the shelf pins", detail: "Four for each shelf, at the same height on both sides.", fix: [fx({ kind: "pin", at: yS.flatMap((y) => SX.flatMap((sx) => [zB + 60, zF - 80].map((z) => [sx * xi, y - T / 2 - 3, z] as Vec3))), dir: [0, 0, 0] })].map((f) => ({ ...f, dir: undefined })) },
    { title: "Lay the shelves on the pins", detail: "Tilt each one in and lower it flat.", add: ["sh0", "sh1"] },
    {
      title: "Screw the hinges onto the doors",
      detail: "Lay them face down. Three hinges on each, along the outer edge, two screws each.",
      add: ["door0", "door1"],
      from: { door0: [0, 0, 500], door1: [0, 0, 500] },
      fix: [fx({ kind: "hinge", at: SX.flatMap((sx) => hy.map((y) => [sx * (2 * dw - 25 + 1.5), y, zF] as Vec3)).map((q) => [Math.sign(q[0]) * (xi - 25), q[1], q[2]] as Vec3), dir: [0, 0, 1] }), fx({ ...SCREW, at: SX.flatMap((sx) => hy.flatMap((y) => [-22, 22].map((d) => [sx * (xi - 25), y + d, zF] as Vec3))), dir: [0, 0, 1] })],
      tools: ["screwdriver"],
    },
    { title: "Screw on the handles", detail: "On the edges that meet in the middle, two screws each from behind.", fix: [fx({ kind: "handle", len: 200, dia: 20, at: SX.map((sx) => [sx * 40, (dBot + dTop) / 2, zF + T] as Vec3), dir: [0, 0, -1], twist: Math.PI / 2 }), fx({ ...HSCREW, at: SX.flatMap((sx) => [-90, 90].map((d) => [sx * 40, (dBot + dTop) / 2 + d, zF] as Vec3)), dir: [0, 0, 1] })], tools: ["screwdriver"] },
    { title: "Screw the mounting plates inside the sides", detail: "Three on each side at the front, level with the hinges.", fix: SX.map((sx) => fx({ kind: "plate", name: "Mounting plate", len: 12, dia: 36, at: hy.map((y) => [sx * xi, y, zF - 40] as Vec3), dir: [sx, 0, 0] })), tools: ["screwdriver"] },
    { title: "Click the doors on", detail: "Hook each hinge arm over its plate and press until it clicks. Turn the hinge screws to even out the gaps.", kind: "hinges", tools: ["screwdriver"] },
  ];
  return { parts, steps: fixDirs(steps) };
}

/** The sliding door cabinet: built upright on its frame, with a middle divider, two backs, tracks and two doors on rollers. */
function sliding(s: ProductSpec): CustomParams {
  const b = boxOf(s, 60);
  const { W, H, yb, xi, zB, zF } = b;
  const top = H - T, hs = top - yb - T;
  const p = plinth(b, true);
  const zIn = zF - 60; // the doors run in front of the shelves
  const parts: CustomPart[] = [
    ...carcass(b, 2),
    ...p.parts,
    { id: "div", name: "Divider", size: [T, hs, b.D - 80], pos: [0, yb + T + hs / 2, -30] },
  ];
  const sw = xi - T / 2 - 2;
  const yS = [yb + T + hs / 3, yb + T + (2 * hs) / 3];
  yS.forEach((y, j) => SX.forEach((sx, i) => parts.push({ id: `sh${j}${i}`, name: "Shelf", size: [sw - 2, T, b.D - 120], pos: [sx * (T / 2 + sw / 2 + 1), y, -40] })));
  const dw = xi + 15, dh = top - yb - T - 10;
  parts.push(
    { id: "doorB", name: "Sliding door", size: [dw, dh, T], pos: [-xi + dw / 2, yb + T + 5 + dh / 2, zIn + 10] },
    { id: "doorF", name: "Sliding door", size: [dw, dh, T], pos: [xi - dw / 2, yb + T + 5 + dh / 2, zIn + 32] },
    { id: "trackB", name: "Bottom track", size: [2 * xi - 20, 6, 50], pos: [0, yb + T + 3, zIn + 21], material: "metal" },
    { id: "trackT", name: "Top track", size: [2 * xi - 20, 10, 50], pos: [0, top - 5, zIn + 21], material: "metal" },
  );
  const steps: CustomStep[] = [
    ...plinthSteps(b, p, "+y").slice(0, 1),
    { title: "Screw in the feet", detail: "One under each corner and middle piece, by hand.", fix: [fx({ kind: "foot", len: 20, dia: 40, at: p.nodes.map((n) => [n[0], 0, n[2]] as Vec3), dir: [0, 1, 0] })], warnings: ["hand"] },
    {
      title: "Screw the bottom track onto the bottom",
      detail: "Along the front edge, six screws. Then lay the bottom on the frame.",
      add: ["bottom", "trackB"],
      fix: [fx({ ...SCREW, at: [-0.4, -0.25, -0.1, 0.1, 0.25, 0.4].map((t) => [t * 2 * xi, yb + T + 6, zIn + 21] as Vec3), dir: [0, -1, 0], on: "trackB", mate: "bottom" })],
      tools: ["screwdriver"],
    },
    { title: "Bolt the frame under the bottom", detail: "Six bolts up through the frame pieces, then a pin into each.", fix: [fx({ kind: "bolt", len: 30, dia: 8, at: p.nodes.map((n) => [n[0], yb - 12, n[2]] as Vec3), dir: [0, 1, 0] }), fx({ kind: "pin", name: "Locking pin", len: 50, dia: 6, at: p.nodes.map((n) => [n[0] + 15, yb - 10, n[2]] as Vec3), dir: [0, 1, 0] })], tools: ["allen"] },
    { title: "Stand the divider on the bottom", detail: "Two dowels and two stud bolts into its lower end, then onto the middle of the bottom and turn two cam locks.", add: ["div"], fix: [fx({ ...DOWEL, at: [[0, yb + T, -150], [0, yb + T, 100]], dir: [0, -1, 0], on: "div" }), fx({ kind: "camScrew", name: "Stud bolt", len: 40, at: [[0, yb + T, -50], [0, yb + T, 140]], dir: [0, -1, 0], on: "div" }), fx({ ...CAM, at: [[30, yb + T / 2, -50], [30, yb + T / 2, 140]], dir: [0, 1, 0], on: "bottom" })], tools: ["screwdriver"] },
    { title: "Click the cord outlets into the backs", detail: "Two rings in each hole, from both sides.", add: ["back0", "back1"], fix: [fx({ kind: "cap", name: "Cord outlet", len: 10, dia: 60, at: SX.map((sx) => [sx * (xi / 2), yb + T + 120, zB + 1] as Vec3), dir: [0, 0, 1] })] },
    { title: "Fix the backs to the divider", detail: "A dowel into the divider's back edge for each, push the backs on and turn four small cam locks.", fix: [fx({ kind: "dowel", name: "Long dowel", len: 80, dia: 8, at: [[0, yb + T + hs / 2, zB + 10]], dir: [0, 0, 1], on: "div" }), fx({ ...SMALL_CAM, at: SX.flatMap((sx) => [yb + T + 150, top - 150].map((y) => [sx * 40, y, zB + 20] as Vec3)), dir: [0, 0, -1] })], tools: ["screwdriver"] },
    {
      title: "Fit both sides together",
      detail: "Eight cam bolts into each side first, then push them onto the bottom and the backs, dowels in, and turn four cam locks and four small ones.",
      add: ["L", "R"],
      fix: [
        ...SX.map((sx) => fx({ ...BOLT, at: [...bottomJoint(b, sx, 3), ...topJoint(b, sx, 3)].map((q) => [sx * (W / 2 - T / 2), q[1], q[2]] as Vec3).filter((_, i) => i % 3 !== 1), dir: [-sx, 0, 0], on: sx < 0 ? "L" : "R" })),
        fx({ ...DOWEL, at: SX.flatMap((sx) => [zB + 40, zF - 40].map((z) => [sx * xi, yb + T / 2, z] as Vec3)), dir: [0, 0, 0] }),
        ...SX.map((sx) => fx({ ...CAM, at: camIn(bottomJoint(b, sx, 2), sx), dir: [0, 1, 0], on: "bottom" })),
        fx({ ...SMALL_CAM, at: SX.flatMap((sx) => [yb + T + 150, top - 150].map((y) => [sx * (xi - 40), y, zB + 20] as Vec3)), dir: [0, 0, -1] }),
      ],
      people: 2,
      warnings: ["two"],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the top track and the cam bolts into the top",
      detail: "Lay the top face down. Eight cam bolts into its underside, then the track along the front with sixteen screws.",
      add: ["top", "trackT"],
      fix: [fx({ ...BOLT, at: [...SX.flatMap((sx) => topJoint(b, sx, 3)), [0, top, -100], [0, top, 120]], dir: [0, 1, 0], on: "top" }), fx({ ...SCREW, at: Array.from({ length: 16 }, (_, i) => [-xi + 40 + ((2 * xi - 80) * i) / 15, top - 10, zIn + 21] as Vec3), dir: [0, 1, 0], on: "trackT", mate: "top" })],
      tools: ["screwdriver"],
    },
    {
      title: "Lift the top on together and lock it",
      detail: "Dowels into the sides and the divider, lower the top on, then turn six cam locks inside the sides.",
      fix: [fx({ ...DOWEL, at: [...SX.flatMap((sx) => [zB + 30, zF - 30].map((z) => [sx * (W / 2 - T / 2), top, z] as Vec3)), [0, top, -150], [0, top, 100]], dir: [0, -1, 0] }), ...SX.map((sx) => fx({ ...CAM, at: topJoint(b, sx, 3).map((q) => [sx * xi, q[1] - 30, q[2]] as Vec3), dir: [sx, 0, 0] }))],
      people: 2,
      warnings: ["two"],
      tools: ["screwdriver"],
    },
    { title: "Push in the shelf pins and lay the shelves in", detail: "Four pins for each of the four shelves.", add: parts.filter((x) => x.name === "Shelf").map((x) => x.id), fix: [fx({ kind: "pin", at: yS.flatMap((y) => [-xi, -T / 2, T / 2, xi].flatMap((x) => [zB + 60, zF - 150].map((z) => [x, y - T / 2 - 3, z] as Vec3))), dir: [0, -1, 0] })] },
    { title: "Fix the bag hook", detail: "Two plastic discs and the hook under the top at the side, one screw each.", fix: [fx({ kind: "hook", name: "Bag hook", len: 40, dia: 30, at: [[W / 2 - 60, top, zB + 80]], dir: [0, 1, 0], on: "top" }), fx({ kind: "screw", len: 16, dia: 4, at: [[W / 2 - 60, top, zB + 80], [-W / 2 + 60, top, zB + 80]], dir: [0, 1, 0], on: "top" })], tools: ["allen"] },
    {
      title: "Screw the handles and rollers onto the doors",
      detail: "Lay each door face down. A recessed handle on its outer edge, then a roller at each top corner and a guide at each bottom corner, four screws each.",
      add: ["doorB", "doorF"],
      from: { doorB: [0, 0, 600], doorF: [0, 0, 600] },
      fix: [
        fx({ kind: "handle", name: "Recessed handle", len: 180, dia: 20, at: [[-xi + 40, yb + T + dh / 2, zIn + 19], [xi - 40, yb + T + dh / 2, zIn + 41]], dir: [0, 0, -1], twist: Math.PI / 2 }),
        fx({ kind: "roller", at: [[-xi + 60, yb + T + dh, zIn + 10], [-xi + dw - 60, yb + T + dh, zIn + 10], [xi - dw + 60, yb + T + dh, zIn + 32], [xi - 60, yb + T + dh, zIn + 32]], dir: [0, -1, 0] }),
        fx({ kind: "clip", name: "Bottom guide", len: 30, dia: 30, at: [[-xi + 60, yb + T + 5, zIn + 10], [-xi + dw - 60, yb + T + 5, zIn + 10], [xi - dw + 60, yb + T + 5, zIn + 32], [xi - 60, yb + T + 5, zIn + 32]], dir: [0, 1, 0] }),
        fx({ ...SCREW, name: "Roller screw", at: [[-xi + 60, zIn + 21], [-xi + dw - 60, zIn + 21], [xi - dw + 60, zIn + 43], [xi - 60, zIn + 43]].flatMap(([x, z]) => [...[-12, 12].flatMap((d) => [-20, -50].map((dy) => [x + d, yb + T + dh + dy, z] as Vec3)), ...[-12, 12].map((d) => [x + d, yb + T + 30, z] as Vec3)]), dir: [0, 0, -1] }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Hang the back door", detail: "Lift its rollers into the rear track at the top, then swing the bottom in and press it down until the guides click.", kind: "general" },
    { title: "Hang the front door", detail: "The same way, in the front track. Slide both to check they run and close softly.", kind: "general" },
    { title: "Fit the door stops and level it", detail: "Four screws for the stops in the top track, then turn the feet until both doors hang straight.", fix: [fx({ ...SCREW, at: [-xi + 30, -10, 10, xi - 30].map((x) => [x, top, zIn + 20] as Vec3), dir: [0, 1, 0], on: "top" })], tools: ["screwdriver"] },
  ];
  return { parts, steps: fixDirs(steps) };
}

const family: Family = {
  names: ["GALANT"],
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^galant-drawer-unit-on-castors/.test(slug)) return pedestal(s, false);
    if (/^galant-drawer-unit-drop-file/.test(slug)) return pedestal(s, true);
    if (/^galant-drawer-unit-80/.test(slug)) return drawerUnit(s);
    if (/^galant-cabinet-doors/.test(slug)) return cabinet(s);
    if (/^galant-cabinet-sliding/.test(slug)) return sliding(s);
    return null;
  },
};
export default family;
