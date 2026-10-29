import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "../builder";
import { rotate } from "../math";
import { buildCustom } from "../custom";
import { hemnesBeds } from "./_hemnes-beds";
import { hemnesTables } from "./_hemnes-tables";
import { hemnesCabinets } from "./_hemnes-cabinets";
import { hemnesStorage } from "./_hemnes-storage";

/*
 * HEMNES, read from IKEA's manuals.
 *
 * The chests are solid wood frames: each side is two corner posts with a panel between them (dowels, cam bolts in
 * the posts, cam locks in the panel), plastic feet in the post ends, and on the wider chests a spacer board on the
 * inside that carries the cabinet runners. One side lies on a rug, the front rails and the back rail stand in it on
 * dowels and cam bolts, then the other side goes on top. The top takes cam bolts upside down, goes on with dowels,
 * screws up through the top rails and cam locks, and the hardboard back is nailed on with the chest on its front.
 * A fabric strap from the box holds it to the wall. Each drawer is built on its front: dowels in the sides, cam bolts
 * in the front, the sides stood on it and locked, the bottom slid in, the back tapped on with ring nails, then runners
 * and knobs.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

// fittings, sized so different ones stay apart in the list
const DOWEL: HwDef = { kind: "dowel", len: 40, dia: 8 };
const SMALL_DOWEL: HwDef = { kind: "dowel", len: 25, dia: 6 };
const DRAWER_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const CAM_BOLT: HwDef = HW.camScrew;
const CAM: HwDef = HW.cam;
const FOOT: HwDef = { kind: "glide", len: 6, dia: 30 };
const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const DRAWER_RUNNER_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const TOP_SCREW: HwDef = { kind: "screw", len: 60, dia: 6 };
const NAIL: HwDef = HW.nail;
const RING_NAIL: HwDef = { kind: "nail", len: 34, dia: 2.5 };
const SUPPORT_SCREW: HwDef = { kind: "screw", len: 13, dia: 3.5 };
const KNOB_SCREW: HwDef = { kind: "screw", len: 32, dia: 4 };
const KNOB: HwDef = HW.knob;
const STRAP: HwDef = { kind: "strap", len: 160, dia: 25 };
const STRAP_SCREW: HwDef = { kind: "screw", len: 13, dia: 4.2 };
const WALL_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 40, dia: 8 };
const WASHER: HwDef = HW.washer;
const runnerDef = (len: number): HwDef => ({ kind: "runner", len: Math.round(len / 10) * 10, dia: 20 });

type StepOpts = {
  title: string;
  detail?: string;
  tools?: ToolId[];
  pose?: Pose;
  scene?: string;
  kind?: StepKind;
  warnings?: WarnId[];
  people?: 1 | 2;
  repeat?: number;
  check?: "square";
  wall?: boolean;
};
const step = (b: PlanBuilder, o: StepOpts, body: () => void = () => {}) =>
  b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);

/** Show parts lying in another scene: turned by `rot` about `pivot`, then moved to `at`. */
function stageGroup(b: PlanBuilder, keys: string[], pivot: Vec3, rot: Vec3, at: Vec3, from: Vec3 = [0, 160, 0]) {
  for (const k of keys) {
    const it = b.partItem(k);
    const p = rotate([it.final.pos[0] - pivot[0], it.final.pos[1] - pivot[1], it.final.pos[2] - pivot[2]], rot);
    b.stage(k, [p[0] + at[0], p[1] + at[1], p[2] + at[2]], rot, from);
  }
}

/* ---------- drawers ---------- */

interface DrawerBox {
  x: number; // centre
  y0: number; // bottom of the opening
  w: number; // opening width
  h: number; // opening height
  zf: number; // front face of the front
  zBack: number; // how far back the box may go
  knobs: 1 | 2;
}
interface Drawer {
  box: DrawerBox;
  front: string;
  sides: [string, string];
  bottom: string;
  back: string;
  support?: string;
  liners?: [string, string];
  ys: number;
  sh: number;
  xs: number;
  dd: number;
}

/**
 * HEMNES drawers: built on their fronts. Each distinct size is shown being built once (with "do this for each"),
 * and every drawer slides in at the end with its fittings already in place.
 */
function drawers(b: PlanBuilder, list: DrawerBox[], o: { support?: boolean; names?: string; liners?: boolean; tray?: boolean } = {}) {
  if (!list.length) return;
  const ft = 18, st = 14;
  const made: Drawer[] = list.map((box) => {
    const fw = box.w - 4, fh = box.h - 4;
    const xs = box.w / 2 - 13 - st / 2; // side centres, clear of the runners
    const sh = Math.max(60, Math.min(fh - 30, 220));
    const dd = Math.round((box.zf - ft - box.zBack) / 10) * 10;
    const ys = box.y0 + 14; // underside of the box
    const zd = box.zf - ft - dd / 2;
    const frT = b.part("Drawer front", [fw, fh, ft]);
    const sdT = b.part("Drawer side", [st, sh, dd]);
    const btT = b.part("Drawer bottom", [2 * xs - 4, 3, dd - 16], { material: "fiber" });
    const bkT = b.part("Drawer back", [2 * xs - st, sh - 16, st]);
    const d: Drawer = {
      box,
      xs,
      sh,
      dd,
      ys,
      front: b.place(frT, [box.x, box.y0 + 2 + fh / 2, box.zf - ft / 2]),
      sides: [b.place(sdT, [box.x - xs, ys + sh / 2, zd]), b.place(sdT, [box.x + xs, ys + sh / 2, zd])],
      bottom: b.place(btT, [box.x, ys + 10, zd - 6]),
      back: b.place(bkT, [box.x, ys + 16 + (sh - 16) / 2, box.zf - ft - dd + st / 2]),
    };
    if (o.liners) {
      const lT = b.part("Liner board", [8, sh - 60, dd - 40]);
      d.liners = [b.place(lT, [box.x - xs + st / 2 + 4, ys + 16 + (sh - 60) / 2, zd]), b.place(lT, [box.x + xs - st / 2 - 4, ys + 16 + (sh - 60) / 2, zd])];
    }
    if (o.support && box.w > 700) d.support = b.place(b.part("Bottom support rail", [24, 10, dd - 20], { material: "metal" }), [box.x, ys + 3.5, zd]);
    return d;
  });

  const fitsOf = (d: Drawer) => {
    const { box, xs, ys, sh, dd } = d;
    const zIn = box.zf - ft; // back face of the front
    const per = <T>(fn: (g: -1 | 1, side: string) => T[]) => [...fn(-1, d.sides[0]), ...fn(1, d.sides[1])];
    const zBk = zIn - dd + st / 2;
    const nails = box.h > 260 ? [0.2, 0.5, 0.8] : [0.3, 0.7];
    const kx = box.knobs === 2 ? [box.x - box.w * 0.27, box.x + box.w * 0.27] : [box.x];
    const ky = box.y0 + box.h / 2;
    const runLen = dd - 20;
    return {
      dowels: per((g, sd) => [ys + sh * 0.35, ys + sh * 0.65].map((y): FitOpts => ({ on: sd, at: [box.x + g * xs, y, zIn], dir: [0, 0, -1], mate: d.front }))),
      bolts: per((g, sd) => [ys + 20, ys + sh - 20].map((y): FitOpts => ({ on: d.front, at: [box.x + g * xs, y, zIn], dir: [0, 0, 1], mate: sd, mateHole: 4 }))),
      cams: per((g, sd) => [ys + 20, ys + sh - 20].map((y): FitOpts => ({ on: sd, at: [box.x + g * (xs - st / 2), y, zIn - 28], dir: [g, 0, 0] }))),
      nails: per((g, sd) => nails.map((k): FitOpts => ({ on: sd, at: [box.x + g * (xs + st / 2), ys + 16 + (sh - 16) * k, zBk], dir: [-g, 0, 0], mate: d.back }))),
      support: d.support
        ? [zIn - 30, zIn - dd + 30].map((z): FitOpts => ({ on: d.support!, at: [box.x, ys - 1.5, z], dir: [0, 1, 0], mate: d.bottom }))
        : [],
      runners: per((g, sd) => [{ on: sd, at: [box.x + g * xs, ys, zIn - 10 - runLen / 2], dir: [0, 1, 0], hole: false } as FitOpts]),
      runnerScrews: per((g, sd) => [zIn - 40, zIn - runLen + 20].map((z): FitOpts => ({ on: sd, at: [box.x + g * xs, ys - 2, z], dir: [0, 1, 0] }))),
      knobScrews: kx.map((x): FitOpts => ({ on: d.front, at: [x, ky, zIn - 4], dir: [0, 0, 1], mate: d.front })),
      knobs: kx.map((x): FitOpts => ({ on: d.front, at: [x, ky, box.zf], dir: [0, 0, -1], hole: false })),
      liners: d.liners
        ? per((g) => [0.25, 0.75].map((k): FitOpts => ({ on: d.liners![g < 0 ? 0 : 1], at: [box.x + g * (xs - st / 2 - 8), ys + 16 + (sh - 60) / 2, zIn - 20 - (dd - 40) * k], dir: [g, 0, 0], mate: d.sides[g < 0 ? 0 : 1] })))
        : [],
      runLen,
    };
  };

  // one of each size is built on screen
  const kinds = new Map<string, Drawer[]>();
  for (const d of made) {
    const k = `${Math.round(d.box.w)}x${Math.round(d.box.h)}`;
    kinds.set(k, [...(kinds.get(k) ?? []), d]);
  }
  const groups = [...kinds.values()];
  const n = made.length;
  const shown = groups.map((g) => g[0]);
  const many = n > 1;
  const word = o.names ?? "drawer";
  const rep = many ? n : undefined;
  const c0 = (d: Drawer): Vec3 => [d.box.x, d.ys + d.sh / 2, d.box.zf - ft - d.dd / 2];
  const keysOf = (d: Drawer) => [d.front, ...d.sides, d.bottom, d.back, ...(d.support ? [d.support] : []), ...(d.liners ?? [])];
  // the shown drawers lie side by side in the drawer scene
  const offs = shown.map((_, i) => (i - (shown.length - 1) / 2) * (Math.max(...shown.map((d) => d.box.w)) + 200));
  const stage = (d: Drawer, i: number, k: string, from?: Vec3, shift: Vec3 = [0, 0, 0]) => {
    const it = b.partItem(k);
    const c = c0(d);
    b.stage(k, [it.final.pos[0] - c[0] + offs[i] + shift[0], it.final.pos[1] - c[1] + shift[1], it.final.pos[2] - c[2] + shift[2]], it.final.rot, from);
  };
  const fs = shown.map(fitsOf);
  const each = (fn: (d: Drawer, i: number) => void) => shown.forEach((d, i) => fn(d, i));
  const dstep = (title: string, detail: string, body: () => void, x: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
    step(b, { title, detail, tools: x.tools, scene: "drawer", pose: x.pose ?? "-z", repeat: rep, kind: x.kind ?? "drawer" }, body);

  dstep(
    many ? `Tap the dowels into the ${word} sides` : `Tap the dowels into the ${word} sides`,
    "Two in the front end of each side. The grooves for the bottom face in and down.",
    () => {
      b.stagger(0.2);
      each((d, i) => d.sides.forEach((sd, j) => stage(d, i, sd, [0, 0, -300], [(j ? 1 : -1) * 90, 0, -60])));
      b.then(0.15);
      each((_, i) => b.fits(DRAWER_DOWEL, fs[i].dowels, 0.06));
    },
    { tools: ["hammer"], kind: "dowels" },
  );
  dstep(
    "Screw the cam bolts into the drawer front",
    "Lay the front face down on a rug. Screw the bolts in by hand until they stop.",
    () => {
      each((d, i) => stage(d, i, d.front, [0, 0, -160]));
      b.then(0.15);
      each((_, i) => b.fits(CAM_BOLT, fs[i].bolts, 0.08));
    },
    { tools: ["screwdriver"], kind: "cams" },
  );
  dstep("Stand the sides on the front", "Push the dowels and bolts into their holes. Grooves facing each other.", () => {
    b.stagger(0.2);
    each((d, i) => d.sides.forEach((sd) => stage(d, i, sd)));
  });
  b.steps[b.steps.length - 1].kind = "join";
  dstep("Lock the cam locks", "Arrow towards the bolt, then turn each one clockwise until it pulls tight.", () => each((_, i) => b.fits(CAM, fs[i].cams, 0.1)), {
    tools: ["screwdriver"],
    kind: "cams",
  });
  dstep("Slide in the drawer bottom", "Smooth side up. It runs down the grooves until it reaches the front.", () => {
    each((d, i) => stage(d, i, d.bottom, [0, 0, -420]));
  });
  dstep(
    "Tap on the drawer back",
    shown.length > 1 ? "It sits on the drawer bottom. Ring nails through each side into it: three each side on the deep drawer, two on the others." : "It sits on the drawer bottom. Tap the ring nails through the sides into it.",
    () => {
      each((d, i) => stage(d, i, d.back, [0, 0, -260]));
      b.then(0.15);
      each((_, i) => b.fits(RING_NAIL, fs[i].nails, 0.1));
    },
    { tools: ["hammer"], kind: "nails" },
  );
  if (shown.some((d) => d.support))
    dstep(
      "Screw the support rail under the bottom",
      "It runs from front to back under the middle of the bottom and stops it sagging.",
      () => {
        each((d, i) => {
          if (d.support) stage(d, i, d.support, [0, -160, 0]);
        });
        b.then(0.15);
        each((_, i) => b.fits(SUPPORT_SCREW, fs[i].support, 0.12));
      },
      { tools: ["screwdriver"], kind: "screws", pose: "-y" },
    );
  if (shown.some((d) => d.liners))
    dstep(
      "Screw the liner boards inside the sides",
      "Arrows pointing up. Two screws through each board into the side.",
      () => {
        b.stagger(0.2);
        each((d, i) => d.liners?.forEach((k) => stage(d, i, k, [0, 300, 0])));
        b.then(0.15);
        each((_, i) => b.fits(SUPPORT_SCREW, fs[i].liners, 0.12));
      },
      { tools: ["screwdriver"], kind: "screws", pose: "+y" },
    );
  dstep(
    "Fit the runners on the drawer",
    "Left and right runners are marked. Press each onto the bottom edge of its side, then two screws.",
    () => {
      each((d, i) => b.fits(runnerDef(fs[i].runLen), fs[i].runners, 0.25));
      b.then(0.1);
      each((_, i) => b.fits(DRAWER_RUNNER_SCREW, fs[i].runnerScrews, 0.08));
    },
    { tools: ["screwdriver"], kind: "runners", pose: "-y" },
  );
  dstep(
    shown.every((d) => d.box.knobs === 1) ? "Screw on the knob" : "Screw on the knobs",
    "The screw goes in from inside the drawer. Snug is enough.",
    () => {
      each((_, i) => b.fits(KNOB, fs[i].knobs, 0.2));
      b.then(0.05);
      each((_, i) => b.fits(KNOB_SCREW, fs[i].knobScrews, 0.15));
    },
    { tools: ["screwdriver"], kind: "screws", pose: "+y" },
  );

  let tray: string[] = [];
  if (o.tray && made[0].liners) {
    // a small tray that rests on the liner boards of the top drawer
    const d = made[0];
    const L = 2 * d.xs - 14 - 20, TD = 140, TH = 50, tt = 10;
    const yb = d.ys + 16 + d.sh - 60;
    const zc = d.box.zf - ft - 40 - TD / 2;
    const longT = b.part("Tray side", [L, TH, tt]);
    const endT = b.part("Tray end", [tt, TH, TD - 2 * tt]);
    const botT = b.part("Tray bottom", [L - 2 * tt, 3, TD - 2 * tt], { material: "fiber" });
    const x = d.box.x;
    const sideA = b.place(longT, [x, yb + TH / 2, zc - TD / 2 + tt / 2]);
    const sideB = b.place(longT, [x, yb + TH / 2, zc + TD / 2 - tt / 2]);
    const ends = [-1, 1].map((g) => b.place(endT, [x + g * (L / 2 - tt / 2), yb + TH / 2, zc]));
    const bot = b.place(botT, [x, yb + 8, zc]);
    tray = [sideA, sideB, ...ends, bot];
    const tc: Vec3 = [x, yb + TH / 2, zc];
    const ts = (k: string, from?: Vec3) => {
      const it = b.partItem(k);
      b.stage(k, [it.final.pos[0] - tc[0], it.final.pos[1] - tc[1], it.final.pos[2] - tc[2]], it.final.rot, from);
    };
    const tScrews = (k: string, zz: number): FitOpts[] => [-1, 1].map((g) => ({ on: k, at: [x + g * (L / 2 - tt / 2), yb + TH / 2, zz], dir: [0, 0, zz < zc ? 1 : -1], mate: ends[g < 0 ? 0 : 1] }));
    step(b, { title: "Screw the tray ends to one tray side", detail: "One screw into each end.", tools: ["screwdriver"], scene: "tray", kind: "screws" }, () => {
      ts(sideA, [0, 160, 0]);
      for (const k of ends) ts(k, [0, 160, 0]);
      b.then(0.15);
      b.fits(SUPPORT_SCREW, tScrews(sideA, zc - TD / 2), 0.15);
    });
    step(b, { title: "Slide in the tray bottom and close it with the other side", detail: "The bottom runs in the grooves. Two more screws hold the second side.", tools: ["screwdriver"], scene: "tray", kind: "screws" }, () => {
      ts(bot, [0, 0, 260]);
      b.then(0.15);
      ts(sideB, [0, 0, 200]);
      b.then(0.1);
      b.fits(SUPPORT_SCREW, tScrews(sideB, zc + TD / 2), 0.15);
    });
  }

  step(
    b,
    {
      title: n > 2 ? `Slide in all ${n} ${word}s` : n === 2 ? `Slide in both ${word}s` : `Slide in the ${word}`,
      detail: "Rest the drawer runners on the ones in the frame and push until it closes. Only open one at a time.",
      kind: "drawer",
      warnings: ["tip"],
    },
    () => {
      for (const d of made) {
        b.stagger(0);
        for (const k of keysOf(d)) b.add(k, [0, 0, 520]);
        if (!shown.includes(d)) {
          const f = fitsOf(d);
          const all: [HwDef, FitOpts[]][] = [
            [DRAWER_DOWEL, f.dowels],
            [CAM_BOLT, f.bolts],
            [CAM, f.cams],
            [RING_NAIL, f.nails],
            [SUPPORT_SCREW, f.support],
            [SUPPORT_SCREW, f.liners],
            [runnerDef(f.runLen), f.runners],
            [DRAWER_RUNNER_SCREW, f.runnerScrews],
            [KNOB, f.knobs],
            [KNOB_SCREW, f.knobScrews],
          ];
          for (const [def, l] of all) for (const x of l) b.preset(def, x);
        }
        b.wait(0.22);
      }
      if (tray.length) {
        b.then(0.2);
        b.stagger(0);
        for (const k of tray) b.add(k, [0, 260, 0]);
      }
    },
  );
}

/* ---------- the post frame ---------- */

interface PostFrame {
  W: number;
  H: number;
  D: number;
  P: number; // post section
  legH: number; // floor to the underside of the bottom rail
  topT: number;
  ovS: number; // top overhang at the sides
  ovF: number; // and at the front
  spacer: boolean; // boards inside the side panels that carry the runners
  openings: number[]; // drawer openings, top first
  midRail: number; // rail height between drawers
  topRail: number;
  botRail: number;
  backRail: number;
  backSheets: 1 | 2;
  knobs: 1 | 2;
  postBolts: number; // cam bolts joining each post to its panel
  topPanel: boolean; // the top is also bolted to the middle of each side panel
  topScrews: number; // up through each of the top rail and the back rail
  roundNails: [number, number, number]; // per post, along the back rail, along the bottom
  liners?: boolean; // the drawers take a liner board inside each side
  tray?: boolean; // a small tray for the top drawer
  cols?: 1 | 2; // two columns of drawers on a middle frame
  topSplit?: boolean; // the top opening of each column holds two small drawers
}

function postChest(b: PlanBuilder, s: ProductSpec, f: PostFrame) {
  const { W, H, D, P, legH, topT } = f;
  const postH = H - topT;
  const xo = W / 2 - f.ovS; // outer face of the posts
  const xi = xo - P; // inner face
  const xp = xo - P / 2;
  const zf = D / 2 - f.ovF, zb = -D / 2 + 3;
  const zpf = zf - P / 2, zpb = zb + P / 2;
  const sg = (i: number) => (i === 0 ? -1 : 1);

  // the sides: two posts, a panel between them and (on the wide chests) a spacer board inside
  const postT = b.part("Corner post", [P, postH, P], { material: "wood" });
  const panelT = 16, panelX = xo - 16;
  const panelH = postH - legH;
  const panelD = zpf - zpb - P + 20;
  const sidePanelT = b.part("Side panel", [panelT, panelH, panelD]);
  // never a zero-thickness board where the panel already meets the runner line
  const spT = Math.max(2, panelX - panelT / 2 - xi);
  const spacerT = f.spacer ? b.part("Spacer board", [spT, panelH - 20, panelD - 24]) : "";
  const panelY = legH + panelH / 2;
  const posts = [0, 1].map((i) => [b.place(postT, [sg(i) * xp, postH / 2, zpf]), b.place(postT, [sg(i) * xp, postH / 2, zpb])]);
  const panels = [0, 1].map((i) => b.place(sidePanelT, [sg(i) * panelX, panelY, (zpf + zpb) / 2]));
  const spacers = f.spacer ? [0, 1].map((i) => b.place(spacerT, [sg(i) * (xi + spT / 2), panelY, (zpf + zpb) / 2])) : [];
  const sideKeys = (i: number) => [...posts[i], panels[i], ...(f.spacer ? [spacers[i]] : [])];

  // rails: across the front (top, between the drawers, bottom) and one at the top of the back
  const railD = 40;
  const zr = zf - railD / 2;
  const tops = postH;
  const railYs: { y: number; h: number }[] = [{ y: tops - f.topRail / 2, h: f.topRail }];
  let y = tops - f.topRail;
  const ops: { y0: number; h: number }[] = [];
  f.openings.forEach((h, i) => {
    ops.push({ y0: y - h, h });
    y -= h;
    const rh = i === f.openings.length - 1 ? f.botRail : f.midRail;
    railYs.push({ y: y - rh / 2, h: rh });
    y -= rh;
  });
  const two = f.cols === 2;
  const MS = 45; // the middle frame's stiles
  const split = (i: number) => two && i > 0 && i < railYs.length - 1;
  const halfW = xi - MS / 2;
  // a rail between the drawers of a two-column chest comes in two halves, one each side of the middle frame
  const railParts = railYs.map((r, i) => {
    const name = i === 0 ? "Top rail" : i === railYs.length - 1 ? "Bottom rail" : "Front rail";
    if (!split(i)) {
      const k = b.place(b.part(name, [2 * xi, r.h, railD], { material: "wood" }), [0, r.y, zr]);
      return [k, k];
    }
    const t = b.part(name, [halfW, r.h, railD], { material: "wood" });
    return [b.place(t, [-xi + halfW / 2, r.y, zr]), b.place(t, [xi - halfW / 2, r.y, zr])];
  });
  const rails = railParts.map((p) => p[0]);
  const railsR = railParts.map((p) => p[1]);
  const backRailY = tops - f.backRail / 2;
  const backRail = b.place(b.part("Back rail", [2 * xi, f.backRail, 20], { material: "wood" }), [0, backRailY, zb + 10]);
  const top = b.place(b.part("Top", [W, topT, D]), [0, H - topT / 2, 0]);
  const sheetW = f.backSheets === 2 ? xo + 6 : 2 * xo - 6;
  const backH = postH - legH - 4;
  const backT = b.part("Back panel", [sheetW, backH, 3], { material: "fiber" });
  const backs = f.backSheets === 2 ? [b.place(backT, [-xo + sheetW / 2, legH + backH / 2, zb - 1.5]), b.place(backT, [xo - sheetW / 2, legH + backH / 2, zb - 1.5])] : [b.place(backT, [0, legH + backH / 2, zb - 1.5])];

  // runners in the frame, one each side of every opening
  const runLen = Math.round((zf - zb - 60) / 10) * 10;
  const runner = runnerDef(runLen);
  const runnerOn = (i: number) => (f.spacer ? spacers[i] : panels[i]);
  const xRun = f.spacer ? xi : panelX - panelT / 2; // the face the runners screw onto
  const runners = (i: number): FitOpts[] => ops.map((o) => ({ on: runnerOn(i), at: [sg(i) * xRun, o.y0 + 8, zf - 20 - runLen / 2], dir: [sg(i), 0, 0], hole: false }));
  const runnerScrews = (i: number): FitOpts[] => ops.flatMap((o) => [zf - 50, zf - runLen + 10].map((z): FitOpts => ({ on: runnerOn(i), at: [sg(i) * xRun, o.y0 + 8, z], dir: [sg(i), 0, 0] })));

  // the middle frame of a two-column chest: front and back stiles with a bar under each opening carrying runners
  const stileB = railYs[railYs.length - 1].y + f.botRail / 2, stileT = tops - f.topRail;
  const mid = two
    ? {
        front: b.place(b.part("Middle stile", [MS, stileT - stileB, railD], { material: "wood" }), [0, (stileT + stileB) / 2, zr]),
        back: b.place(b.part("Middle stile", [MS, tops - f.backRail - legH, 20], { material: "wood" }), [0, (tops - f.backRail + legH) / 2, zb + 10]),
        bars: ops.map((o) => b.place(b.part("Runner bar", [MS, 20, zr - railD / 2 - (zb + 20)], { material: "wood" }), [0, o.y0 - 2, (zr - railD / 2 + zb + 20) / 2])),
      }
    : null;
  const midRunners: FitOpts[] = mid ? ops.flatMap((o, k) => [-1, 1].map((g): FitOpts => ({ on: mid.bars[k], at: [g * (MS / 2), o.y0 + 8, zf - 20 - runLen / 2], dir: [-g, 0, 0], hole: false }))) : [];
  const midRunnerScrews: FitOpts[] = mid ? ops.flatMap((o, k) => [-1, 1].flatMap((g) => [zf - 50, zf - runLen + 10].map((z): FitOpts => ({ on: mid.bars[k], at: [g * (MS / 2), o.y0 + 8, z], dir: [-g, 0, 0] })))) : [];
  // small dividers between the two little drawers at the top of each column
  const colW = two ? halfW : 2 * xi;
  const colX = (c: number) => (two ? (c ? 1 : -1) * (MS / 2 + halfW / 2) : 0);
  // they reach forward under the rails (just behind the drawer fronts), where the long screws hold them
  const smalls = f.topSplit ? [0, 1].map((c) => b.place(b.part("Small divider", [18, ops[0].h, zf - 20 - (zb + 24)], { material: "board" }), [colX(c), ops[0].y0 + ops[0].h / 2, (zf - 20 + zb + 24) / 2])) : [];

  // where the side joins: posts and panel
  const panelYs = spread(legH + 60, postH - 60, f.postBolts);
  const postBolts = (i: number): FitOpts[] =>
    posts[i].flatMap((p, j) => panelYs.map((yy): FitOpts => ({ on: p, at: [sg(i) * panelX, yy, j === 0 ? zpf - P / 2 : zpb + P / 2], dir: [0, 0, j === 0 ? 1 : -1], mate: panels[i], mateHole: 4 })));
  const panelDowels = (i: number): FitOpts[] =>
    posts[i].flatMap((p, j) => [legH + panelH * 0.3, legH + panelH * 0.7].map((yy): FitOpts => ({ on: p, at: [sg(i) * panelX, yy, j === 0 ? zpf - P / 2 : zpb + P / 2], dir: [0, 0, j === 0 ? 1 : -1], mate: panels[i] })));
  const panelCams = (i: number): FitOpts[] =>
    [zpf - P / 2 - 30, zpb + P / 2 + 30].flatMap((z) => panelYs.map((yy): FitOpts => ({ on: panels[i], at: [sg(i) * (panelX - panelT / 2), yy, z], dir: [sg(i), 0, 0] })));
  const feet = (i: number): FitOpts[] => posts[i].map((p, j) => ({ on: p, at: [sg(i) * xp, 0, j === 0 ? zpf : zpb], dir: [0, 1, 0], hole: false }));
  const spacerDowels = (i: number): FitOpts[] =>
    f.spacer
      ? [legH + 150, postH - 150].flatMap((yy) => [zpf - P / 2 - 60, zpb + P / 2 + 60].map((z): FitOpts => ({ on: spacers[i], at: [sg(i) * (panelX - panelT / 2), yy, z], dir: [-sg(i), 0, 0], mate: panels[i] })))
      : [];

  // rails into the sides: a cam bolt and a dowel in the post at each end, a cam lock in the rail
  const railJ = (k: string, yy: number, z: number, dz: number, inFront: boolean) => ({ k, yy, z, dz, inFront });
  const joints = [...rails.map((k, i) => railJ(k, railYs[i].y, zr, 10, true)), railJ(backRail, backRailY, zb + 10, f.backRail > 60 ? f.backRail / 4 : 8, false)];
  const jk = (j: (typeof joints)[number], i: number) => (i === 1 && rails.includes(j.k) ? railsR[rails.indexOf(j.k)] : j.k);
  const railBolts = (i: number): FitOpts[] => joints.map((j) => ({ on: posts[i][j.inFront ? 0 : 1], at: [sg(i) * xi, j.yy - (j.inFront ? 0 : j.dz), j.inFront ? j.z - j.dz : j.z], dir: [sg(i), 0, 0], mate: jk(j, i), mateHole: 4 }));
  const railDowels = (i: number, js = joints): FitOpts[] => js.map((j) => ({ on: jk(j, i), at: [sg(i) * xi, j.yy + (j.inFront ? 0 : j.dz), j.inFront ? j.z + j.dz : j.z], dir: [-sg(i), 0, 0], mate: posts[i][j.inFront ? 0 : 1] }));
  const railCams = (i: number, js = joints): FitOpts[] =>
    js.map((j): FitOpts =>
      j.inFront
        ? { on: jk(j, i), at: [sg(i) * (xi - 28), j.yy + railYs[rails.indexOf(j.k)].h / 2, j.z - j.dz], dir: [0, -1, 0] }
        : { on: jk(j, i), at: [sg(i) * (xi - 28), j.yy - j.dz, j.z + 10], dir: [0, 0, -1] },
    );

  // the top: cam bolts in its underside, dowels in the side tops, screws up through the top rail and back rail
  const zm = (zpf + zpb) / 2;
  const topJ = (i: number) => [
    { k: posts[i][0], x: xp, zb: zpf - 10, zd: zpf + 10, xc: xi },
    ...(f.topPanel ? [{ k: panels[i], x: panelX, zb: zm, zd: zm + 60, xc: panelX - panelT / 2 }] : []),
    { k: posts[i][1], x: xp, zb: zpb + 10, zd: zpb - 10, xc: xi },
  ];
  const topBolts: FitOpts[] = [0, 1].flatMap((i) => topJ(i).map((j): FitOpts => ({ on: top, at: [sg(i) * j.x, tops, j.zb], dir: [0, 1, 0], mate: j.k, mateHole: 4 })));
  const topDowels: FitOpts[] = [0, 1].flatMap((i) => topJ(i).map((j): FitOpts => ({ on: j.k, at: [sg(i) * j.x, tops, j.zd], dir: [0, -1, 0], mate: top })));
  const topCams: FitOpts[] = [0, 1].flatMap((i) => topJ(i).map((j): FitOpts => ({ on: j.k, at: [sg(i) * j.xc, tops - 26, j.zb], dir: [sg(i), 0, 0] })));
  const nTopScrews = f.topScrews;
  const topScrews: FitOpts[] = [
    ...spread(-xi * 0.6, xi * 0.6, nTopScrews).map((x): FitOpts => ({ on: rails[0], at: [x, tops - f.topRail, zr], dir: [0, 1, 0], mate: top })),
    ...spread(-xi * 0.6, xi * 0.6, nTopScrews).map((x): FitOpts => ({ on: backRail, at: [x, tops - f.backRail, zb + 10], dir: [0, 1, 0], mate: top })),
  ];

  /* --- the two sides, on a rug --- */
  const pivot = (i: number): Vec3 => [sg(i) * xp, postH / 2, 0];
  const lay = (i: number): Vec3 => [(i === 0 ? -1 : 1) * (D / 2 + 80), P / 2, 0];
  const layRot = (i: number): Vec3 => [0, Math.PI / 2, i === 0 ? Math.PI / 2 : -Math.PI / 2];
  const off = (i: number, dz: number): Vec3 => {
    const r = rotate([0, 0, dz], layRot(i));
    const l = lay(i);
    return [l[0] + r[0], l[1] + r[1], l[2] + r[2]];
  };
  step(
    b,
    { title: "Screw the cam bolts into the four corner posts", detail: "Lay them on a rug, marked ends together. Screw each bolt in by hand until it stops.", tools: ["screwdriver"], scene: "side", kind: "cams", warnings: ["floor"] },
    () => {
      b.stagger(0.12);
      // the back post lies a little apart until the panel is on the front one
      for (const i of [0, 1]) {
        stageGroup(b, [posts[i][0]], pivot(i), layRot(i), lay(i));
        stageGroup(b, [posts[i][1]], pivot(i), layRot(i), off(i, -400));
      }
      b.then(0.15);
      b.fits(CAM_BOLT, [...postBolts(0), ...postBolts(1)], 0.05);
    },
  );
  step(
    b,
    { title: "Join each side panel to its two posts", detail: "Tap the dowels into the posts. Push the panel onto the front post, then push the back post onto the panel.", tools: ["hammer"], scene: "side", kind: "dowels" },
    () => {
      b.fits(DOWEL, [...panelDowels(0), ...panelDowels(1)], 0.06);
      b.then(0.15);
      for (const i of [0, 1]) stageGroup(b, [panels[i]], pivot(i), layRot(i), lay(i), rotate([0, 0, -200], layRot(i)));
      b.then(0.1);
      for (const i of [0, 1]) stageGroup(b, [posts[i][1]], pivot(i), layRot(i), lay(i), [0, 0, 0]);
    },
  );
  step(b, { title: "Lock the cam locks in the side panels", detail: "Arrow towards the bolt, then turn clockwise until each one pulls tight.", tools: ["screwdriver"], scene: "side", kind: "cams" }, () =>
    b.fits(CAM, [...panelCams(0), ...panelCams(1)], 0.06),
  );
  step(b, { title: "Push the feet into the ends of the posts", detail: "Into the bottom end of each post. Press them in until they sit flat.", scene: "side" }, () => b.fits(FOOT, [...feet(0), ...feet(1)], 0.15));
  if (f.spacer) {
    step(
      b,
      { title: "Press the spacer boards onto the side panels", detail: "Push the small dowels into one face of each board, turn it over and press it onto the panel, between the posts.", scene: "side", kind: "dowels" },
      () => {
        for (const i of [0, 1]) stageGroup(b, [spacers[i]], pivot(i), layRot(i), lay(i));
        b.then(0.1);
        b.fits(SMALL_DOWEL, [...spacerDowels(0), ...spacerDowels(1)], 0.08);
      },
    );
  }
  for (const i of [0, 1]) {
    step(
      b,
      {
        title: i === 0 ? "Screw the runners onto the left side" : "Screw the runners onto the right side",
        detail: "The runners are marked L and R. Wheel end at the front, two screws in each.",
        tools: ["screwdriver"],
        scene: "side",
        kind: "runners",
      },
      () => {
        b.fits(runner, runners(i), 0.2);
        b.then(0.1);
        b.fits(RUNNER_SCREW, runnerScrews(i), 0.06);
      },
    );
  }
  step(b, { title: "Screw in the cam bolts for the rails", detail: "Into the inside faces of the posts, by hand until they stop.", tools: ["screwdriver"], scene: "side", kind: "cams" }, () =>
    b.fits(CAM_BOLT, [...railBolts(0), ...railBolts(1)], 0.06),
  );

  /* --- the frame, lying on its left side --- */
  const front = joints.filter((j) => j.inFront), backJ = joints.filter((j) => !j.inFront);
  step(
    b,
    { title: "Lay the left side down and stand the front rails in it", detail: "Inside face up. Tap a dowel into the end of each rail, then push it onto its dowel hole and bolt.", tools: ["hammer"], pose: "+x", kind: "join", warnings: ["floor"] },
    () => {
      b.stagger(0.12);
      for (const k of sideKeys(0)) b.add(k, [300, 0, 0]);
      b.then(0.15);
      b.fits(DOWEL, railDowels(0, front), 0.06);
      b.then(0.1);
      b.stagger(0.2);
      for (const j of front) b.add(j.k, [300, 0, 0]);
    },
  );
  step(b, { title: "Lock the rails with cam locks", detail: "One in each rail, next to the side.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(CAM, railCams(0, front), 0.12));
  step(b, { title: "Stand the back rail in", detail: "It goes at the top of the back posts, with a dowel and a cam lock like the others.", tools: ["hammer", "screwdriver"], pose: "+x", kind: "join" }, () => {
    b.fits(DOWEL, railDowels(0, backJ), 0.1);
    b.then(0.1);
    b.add(backRail, [300, 0, 0]);
    b.then(0.1);
    b.fits(CAM, railCams(0, backJ), 0.1);
  });
  if (mid) {
    const midKeys = [mid.front, mid.back, ...mid.bars];
    const midDowels: FitOpts[] = mid.bars.flatMap((k, i) => [
      { on: k, at: [0, ops[i].y0 - 2, zr - railD / 2], dir: [0, 0, -1], mate: mid.front },
      { on: k, at: [0, ops[i].y0 - 2, zb + 20], dir: [0, 0, 1], mate: mid.back },
    ]);
    const midBolts: FitOpts[] = mid.bars.map((k, i) => ({ on: mid.front, at: [0, ops[i].y0 - 2, zr - railD / 2], dir: [0, 0, 1], mate: k, mateHole: 4 }));
    step(b, { title: "Put the middle frame together", detail: "On a rug: the runner bars go between the two stiles on dowels and cam bolts.", tools: ["hammer", "screwdriver"], scene: "mid", kind: "join" }, () => {
      // flat on the rug: the bars push onto the front stile along their dowels, then the back stile goes on
      const mp: Vec3 = [0, (tops + legH) / 2, 0], mr: Vec3 = [0, Math.PI / 2, Math.PI / 2];
      const along = (dz: number): Vec3 => rotate([0, 0, dz], mr);
      const at0 = (dz: number): Vec3 => { const a = along(dz); return [a[0], MS / 2 + a[1], a[2]]; };
      b.stagger(0.12);
      stageGroup(b, [mid.front], mp, mr, at0(0), along(200));
      stageGroup(b, mid.bars, mp, mr, at0(-260));
      stageGroup(b, [mid.back], mp, mr, at0(-520));
      b.then(0.15);
      b.fits(CAM_BOLT, midBolts, 0.06);
      b.fits(DOWEL, midDowels, 0.06);
      b.then(0.15);
      stageGroup(b, mid.bars, mp, mr, at0(0), [0, 0, 0]);
      b.then(0.1);
      stageGroup(b, [mid.back], mp, mr, at0(0), [0, 0, 0]);
    });
    step(b, { title: "Screw the runners onto the middle frame", detail: "A runner on each face of every bar, two screws each.", tools: ["screwdriver"], scene: "mid", kind: "runners" }, () => {
      b.fits(runner, midRunners, 0.15);
      b.then(0.1);
      b.fits(RUNNER_SCREW, midRunnerScrews, 0.05);
    });
    const halves = railYs.map((_, i) => i).filter(split);
    step(
      b,
      { title: "Lower the middle frame onto the rails", detail: "Dowels into the ends of the short rails, then press the frame on. Two people make this easier.", tools: ["hammer"], pose: "+x", kind: "join", people: 2 },
      () => {
        b.fits(DOWEL, halves.map((i): FitOpts => ({ on: rails[i], at: [-MS / 2, railYs[i].y, zr], dir: [1, 0, 0], mate: mid.front })), 0.08);
        b.then(0.15);
        b.stagger(0.05);
        for (const k of midKeys) b.add(k, [300, 0, 0]);
        b.then(0.1);
        b.fits(CAM, mid.bars.map((k, i): FitOpts => ({ on: mid.front, at: [0, ops[i].y0 + 10, zr], dir: [0, -1, 0] })), 0.1);
      },
    );
    step(b, { title: "Stand the right-hand rails on the middle frame", detail: "A dowel in each, pushed into the middle stile.", tools: ["hammer"], pose: "+x", kind: "join" }, () => {
      b.fits(DOWEL, halves.map((i): FitOpts => ({ on: railsR[i], at: [MS / 2, railYs[i].y, zr], dir: [-1, 0, 0], mate: mid.front })), 0.08);
      b.then(0.15);
      for (const i of halves) b.add(railsR[i], [300, 0, 0]);
    });
  }
  step(
    b,
    { title: "Lower the right side onto the rails", detail: "Tap dowels into the free rail ends first. Two people make this easier: press it down evenly.", tools: ["hammer"], pose: "+x", kind: "join", people: 2 },
    () => {
      b.fits(DOWEL, railDowels(1), 0.06);
      b.then(0.15);
      b.stagger(0.05);
      for (const k of sideKeys(1)) b.add(k, [420, 0, 0]);
    },
  );
  step(b, { title: "Lock the cam locks on this side", detail: "Arrow towards the bolt, then a clockwise turn.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(CAM, railCams(1), 0.1));

  if (smalls.length) {
    const y0 = ops[0].y0;
    step(b, { title: "Fit the small dividers", detail: "Screw a runner onto each face of both, then stand them on the bar below and screw them in with the long screws.", tools: ["screwdriver", "allen"], pose: "+y", kind: "runners" }, () => {
      b.stagger(0.2);
      for (const k of smalls) b.add(k, [0, 300, 0]);
      b.then(0.15);
      const rn: FitOpts[] = [], rs: FitOpts[] = [], ls: FitOpts[] = [];
      smalls.forEach((k, c) => {
        for (const g of [-1, 1]) {
          rn.push({ on: k, at: [colX(c) + g * 9, y0 + 8, zf - 20 - runLen / 2], dir: [-g, 0, 0], hole: false });
          for (const z of [zf - 50, zf - runLen + 10]) rs.push({ on: k, at: [colX(c) + g * 9, y0 + 8, z], dir: [-g, 0, 0] });
        }
        ls.push({ on: rails[0], at: [colX(c), tops, zf - 30], dir: [0, -1, 0], mate: k });
        ls.push({ on: c ? railsR[1] : rails[1], at: [colX(c), y0 - f.midRail, zf - 30], dir: [0, 1, 0], mate: k });
      });
      b.fits(runner, rn, 0.12);
      b.fits(RUNNER_SCREW, rs, 0.05);
      b.fits(TOP_SCREW, ls, 0.12);
    });
  }
  if (two)
    step(b, { title: "Screw the middle foot under the bottom rail", detail: "Turn it down until it just touches the floor, so the long rail can't sag.", kind: "legs" }, () =>
      b.fit({ kind: "foot", len: 40, dia: 36 }, { on: rails[rails.length - 1], at: [0, legH, zr], dir: [0, 1, 0] }),
    );

  /* --- the top --- */
  step(b, { title: "Screw the cam bolts into the top", detail: "Lay the top upside down on a rug.", tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["face"] }, () => {
    b.stage(top, [0, topT / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
    b.then(0.15);
    b.fits(CAM_BOLT, topBolts, 0.08);
  });
  step(
    b,
    { title: "Stand the frame up and put the top on", detail: "Tap the dowels into the tops of the sides, then lower the top onto them.", tools: ["hammer"], pose: "+y", kind: "join", people: 2 },
    () => {
      b.fits(DOWEL, topDowels, 0.08);
      b.then(0.2);
      b.add(top, [0, 300, 0]);
    },
  );
  step(b, { title: "Screw the top down through the rails", detail: "Long screws up through the top rail and the back rail, with the Allen key.", tools: ["allen"], kind: "screws" }, () => b.fits(TOP_SCREW, topScrews, 0.15));
  step(b, { title: "Lock the top with cam locks", detail: "In the sides, just under the top.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, topCams, 0.1));

  /* --- the back --- */
  const zn = zb - 3;
  const nailOn = (k: string, x: number, yy: number): FitOpts => ({ on: k, at: [x, yy, zn], dir: [0, 0, 1], hole: false });
  const corner = (i: number) => nailOn(posts[i][1], sg(i) * xp, postH - 60);
  const round: FitOpts[] = [
    ...[0, 1].flatMap((i) => spread(legH + 60, postH - 200, f.roundNails[0]).map((yy) => nailOn(posts[i][1], sg(i) * xp, yy))),
    ...spread(-xi + 60, xi - 60, f.roundNails[1]).map((x) => nailOn(backRail, x, backRailY)),
    ...spread(-xi + 60, xi - 60, f.roundNails[2]).map((x) => nailOn(backs[x < 0 || f.backSheets === 1 ? 0 : 1], x, legH + 6)),
  ];
  step(b, { title: "Lay it on its front", detail: "On the flattened box, so the front edges don't get scratched.", pose: "-z", kind: "flip", people: 2, warnings: ["floor", "two"] });
  if (f.backSheets === 2) {
    step(b, { title: "Lay the first back panel on", detail: "Into one corner, with its edge in the middle. A nail at the top corner holds it.", tools: ["hammer"], pose: "-z", kind: "nails" }, () => {
      b.add(backs[0], [0, 0, -340]);
      b.then(0.2);
      b.fit(NAIL, corner(0));
    });
    step(b, { title: "Lay the second back panel on", detail: "Its edge overlaps the first one in the middle. Nail its top corner.", tools: ["hammer"], pose: "-z", kind: "nails", check: "square" }, () => {
      b.add(backs[1], [0, 0, -340]);
      b.then(0.2);
      b.fit(NAIL, corner(1));
    });
  } else {
    step(b, { title: "Lay the back panel on", detail: "Line it up with one top corner and nail it there.", tools: ["hammer"], pose: "-z", kind: "nails" }, () => {
      b.add(backs[0], [0, 0, -340]);
      b.then(0.2);
      b.fit(NAIL, corner(0));
    });
    step(b, { title: "Square it up and nail the other corner", detail: "Push the frame until the panel lines up with the other top corner too.", tools: ["hammer"], pose: "-z", kind: "nails", check: "square" }, () => b.fit(NAIL, corner(1)));
  }
  step(b, { title: "Nail the back panel all round", detail: "Into the posts, the back rail and along the bottom, keeping the nails straight.", tools: ["hammer"], pose: "-z", kind: "nails" }, () =>
    b.fits(NAIL, round, 0.05),
  );
  step(b, { title: "Stand it up", detail: "Turn it upright where it will go, against the wall.", pose: "+y", kind: "standup", people: 2, warnings: ["two"] });

  wallStrap(b, { x: 0, y: backRailY, z: zb, on: backRail, wallY: H + 40 });

  drawers(
    b,
    ops.flatMap((o, k) =>
      (two ? [0, 1] : [0]).flatMap((c) =>
        k === 0 && f.topSplit
          ? [-1, 1].map((g) => ({ x: colX(c) + (g * (colW / 2 + 9)) / 2, y0: o.y0, w: colW / 2 - 9, h: o.h, zf, zBack: zb + 24, knobs: 1 as const }))
          : [{ x: colX(c), y0: o.y0, w: colW, h: o.h, zf, zBack: zb + 24, knobs: f.knobs }],
      ),
    ),
    { support: true, liners: f.liners, tray: f.tray },
  );
  void s;
}

/** The fabric strap in the box: marked, drilled and screwed to the wall, then screwed to the back rail. */
function wallStrap(b: PlanBuilder, o: { x: number; y: number; z: number; on: string; wallY: number }) {
  const wy = o.wallY;
  step(b, { title: "Mark the wall", detail: "Push it against the wall and mark the top edge, then a hole 4 cm above the mark, in line with the middle.", tools: ["pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] });
  step(
    b,
    { title: "Screw the strap to the wall", detail: "Move it away, drill, push in the plug and screw the strap on with a washer. The plug suits solid walls; use fixings made for yours if it's different.", tools: ["drill", "screwdriver"], kind: "anchor", wall: true, warnings: ["wall"] },
    () => {
      b.fit(WALL_PLUG, { at: [o.x, wy, o.z - 1], dir: [0, 0, -1] });
      b.then(0.1);
      b.fit(STRAP, { at: [o.x, wy - 10, o.z - 3], dir: [0, 0, -1], hole: false });
      b.then(0.05);
      b.fit(WASHER, { at: [o.x, wy, o.z - 4], dir: [0, 0, -1], hole: false });
      b.fit(WALL_SCREW, { at: [o.x, wy, o.z - 5], dir: [0, 0, -1] });
    },
  );
  step(b, { title: "Screw the strap to the frame", detail: "Push it back to the wall and screw the other end of the strap to the back rail, with a washer.", tools: ["screwdriver"], kind: "anchor", wall: true, warnings: ["tip"] }, () => {
    b.fit(WASHER, { on: o.on, at: [o.x, o.y, o.z], dir: [0, 0, 1], hole: false });
    b.fit(STRAP_SCREW, { on: o.on, at: [o.x, o.y, o.z - 1], dir: [0, 0, 1] });
  });
}

/* ---------- board drawers (wash-stands) ---------- */

interface BoardBox {
  x: number;
  y0: number; // bottom of the opening
  w: number;
  h: number;
  zf: number; // front face
  zBack: number;
  knobs: 1 | 2;
  plates: number; // L plates holding the bottom
}

/**
 * The wash-stand drawers: built on their backs. Cam bolts go into the back, the sides stand on it on dowels and are
 * locked, the bottom slides in, the front goes on with dowels and cam locks, L plates screw the bottom to front and
 * back, then the knob. They click onto full-extension runners already in the frame.
 */
function boardDrawers(b: PlanBuilder, list: BoardBox[], o: { insert?: boolean; light?: boolean; mini?: boolean } = {}) {
  const ft = 20, st = 16;
  const made = list.map((box) => {
    const fw = box.w - 4, fh = box.h - 4;
    const dd = Math.round((box.zf - box.zBack) / 10) * 10;
    const xs = box.w / 2 - 14 - st / 2;
    const sh = Math.max(80, fh - 40);
    const ys = box.y0 + 20;
    const zc = box.zf - dd / 2;
    const front = b.place(b.part("Drawer front", [fw, fh, ft]), [box.x, box.y0 + 2 + fh / 2, box.zf - ft / 2]);
    const sdT = b.part("Drawer side", [st, sh, dd - ft - st]);
    const sides = [-1, 1].map((g) => b.place(sdT, [box.x + g * xs, ys + sh / 2, zc - st / 2 + ft / 2 - ft / 2]));
    const back = b.place(b.part("Drawer back", [2 * xs + st, sh, st]), [box.x, ys + sh / 2, box.zf - dd + st / 2]);
    const bottom = b.place(b.part("Drawer bottom", [2 * xs - st, 12, dd - ft - st]), [box.x, ys + 6, zc]);
    return { box, front, sides, back, bottom, xs, sh, ys, dd, zc };
  });
  type M = (typeof made)[number];
  const fitsOf = (d: M) => {
    const { box, xs, sh, ys, dd } = d;
    const zB = box.zf - dd + st; // inside face of the back
    const zF = box.zf - ft; // inside face of the front
    const per = (fn: (g: -1 | 1, k: string) => FitOpts[]) => [...fn(-1, d.sides[0]), ...fn(1, d.sides[1])];
    const kx = box.knobs === 2 ? [box.x - box.w * 0.27, box.x + box.w * 0.27] : [box.x];
    const two = o.light ? [ys + sh / 2] : [ys + 25, ys + sh - 25];
    if (o.mini)
      return {
        bolts: per((g, k) => [{ on: d.back, at: [box.x + g * xs, ys + sh / 2, zB], dir: [0, 0, -1], mate: k, mateHole: 4 }]),
        dowels: per((g, k) => [{ on: k, at: [box.x + g * xs, ys + sh * 0.75, zB], dir: [0, 0, 1], mate: d.back }]),
        cams: per((g, k) => [{ on: k, at: [box.x + g * (xs - st / 2), ys + sh / 2, zB + 28], dir: [g, 0, 0] }]),
        frontBolts: [] as FitOpts[],
        frontCams: [] as FitOpts[],
        frontScrews: per((g, k) => [ys + sh * 0.3, ys + sh * 0.7].map((y): FitOpts => ({ on: k, at: [box.x + g * (xs + st / 2), y, zF - st / 2], dir: [-g, 0, 0], mate: d.front }))),
        plates: [] as FitOpts[],
        plateScrews: [] as FitOpts[],
        knobs: kx.map((x): FitOpts => ({ on: d.front, at: [x, box.y0 + box.h / 2, box.zf], dir: [0, 0, -1], hole: false })),
        knobScrews: kx.map((x): FitOpts => ({ on: d.front, at: [x, box.y0 + box.h / 2, zF - 2], dir: [0, 0, 1] })),
      };
    if (o.light)
      return {
        bolts: per((g, k) => [{ on: d.back, at: [box.x + g * xs, ys + sh / 2, zB], dir: [0, 0, -1], mate: k, mateHole: 4 }]),
        dowels: [
          ...per((g, k) => [{ on: k, at: [box.x + g * xs, ys + sh * 0.75, zB], dir: [0, 0, 1], mate: d.back }]),
          ...per((g, k) => [{ on: k, at: [box.x + g * xs, ys + sh * 0.75, zF], dir: [0, 0, -1], mate: d.front }]),
        ] as FitOpts[],
        cams: per((g, k) => [{ on: k, at: [box.x + g * (xs - st / 2), ys + sh / 2, zB + 28], dir: [g, 0, 0] }]),
        frontBolts: per((g, k) => [{ on: d.front, at: [box.x + g * xs, ys + sh / 2, zF], dir: [0, 0, 1], mate: k, mateHole: 4 }]),
        frontCams: per((g, k) => [{ on: k, at: [box.x + g * (xs - st / 2), ys + sh / 2, zF - 28], dir: [g, 0, 0] }]),
        plates: [{ on: d.bottom, at: [box.x, ys + 12, zB + 10], dir: [0, -1, 0], hole: false }, { on: d.bottom, at: [box.x, ys + 12, zF - 10], dir: [0, -1, 0], hole: false }] as FitOpts[],
        plateScrews: [{ on: d.bottom, at: [box.x, ys + 12, zB + 18], dir: [0, -1, 0] }, { on: d.bottom, at: [box.x, ys + 12, zF - 18], dir: [0, -1, 0] }, { on: d.back, at: [box.x, ys + 20, zB], dir: [0, 0, -1] }, { on: d.front, at: [box.x, ys + 20, zF], dir: [0, 0, 1] }] as FitOpts[],
        knobs: kx.map((x): FitOpts => ({ on: d.front, at: [x, box.y0 + box.h / 2, box.zf], dir: [0, 0, -1], hole: false })),
        knobScrews: kx.map((x): FitOpts => ({ on: d.front, at: [x, box.y0 + box.h / 2, zF - 2], dir: [0, 0, 1] })),
      };
    void two;
    return {
      bolts: per((g, k) => [ys + 25, ys + sh - 25].map((y): FitOpts => ({ on: d.back, at: [box.x + g * xs, y, zB], dir: [0, 0, -1], mate: k, mateHole: 4 }))),
      dowels: per((g, k) => [ys + sh * 0.5].map((y): FitOpts => ({ on: k, at: [box.x + g * xs, y, zB], dir: [0, 0, 1], mate: d.back }))).concat(
        per((g, k) => [ys + sh * 0.3, ys + sh * 0.7].map((y): FitOpts => ({ on: k, at: [box.x + g * xs, y, zF], dir: [0, 0, -1], mate: d.front }))),
      ).concat(per((g, k) => [{ on: k, at: [box.x + g * xs, ys + sh * 0.8, zB], dir: [0, 0, 1], mate: d.back }])),
      cams: per((g, k) => [ys + 25, ys + sh - 25].map((y): FitOpts => ({ on: k, at: [box.x + g * (xs - st / 2), y, zB + 28], dir: [g, 0, 0] }))),
      frontBolts: per((g, k) => [{ on: d.front, at: [box.x + g * xs, ys + sh / 2, zF], dir: [0, 0, 1], mate: k, mateHole: 4 }]),
      frontCams: per((g, k) => [{ on: k, at: [box.x + g * (xs - st / 2), ys + sh / 2, zF - 28], dir: [g, 0, 0] }]),
      plates: spread(box.x - xs * 0.5, box.x + xs * 0.5, Math.max(1, box.plates / 2)).flatMap((x): FitOpts[] => [
        { on: d.bottom, at: [x, ys + 12, zB + 10], dir: [0, -1, 0], hole: false },
        { on: d.bottom, at: [x, ys + 12, zF - 10], dir: [0, -1, 0], hole: false },
      ]),
      plateScrews: spread(box.x - xs * 0.5, box.x + xs * 0.5, Math.max(1, box.plates / 2)).flatMap((x): FitOpts[] => [
        { on: d.bottom, at: [x, ys + 12, zB + 18], dir: [0, -1, 0] },
        { on: d.back, at: [x, ys + 20, zB], dir: [0, 0, -1] },
        { on: d.bottom, at: [x, ys + 12, zF - 18], dir: [0, -1, 0] },
        { on: d.front, at: [x, ys + 20, zF], dir: [0, 0, 1] },
      ]),
      knobs: kx.map((x): FitOpts => ({ on: d.front, at: [x, box.y0 + box.h / 2, box.zf], dir: [0, 0, -1], hole: false })),
      knobScrews: kx.map((x): FitOpts => ({ on: d.front, at: [x, box.y0 + box.h / 2, zF - 2], dir: [0, 0, 1] })),
    };
  };
  const n = made.length;
  const rep = n > 1 ? n : undefined;
  const d0 = made[0];
  const f0 = fitsOf(d0);
  const c0: Vec3 = [d0.box.x, d0.ys + d0.sh / 2, d0.zc];
  const stage = (k: string, from?: Vec3, shift: Vec3 = [0, 0, 0]) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0] + shift[0], it.final.pos[1] - c0[1] + shift[1], it.final.pos[2] - c0[2] + shift[2]], it.final.rot, from);
  };
  const dstep = (title: string, detail: string, body: () => void, x: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
    step(b, { title, detail, tools: x.tools, scene: "drawer", pose: x.pose ?? "+z", repeat: rep, kind: x.kind ?? "drawer" }, body);
  dstep("Screw the cam bolts into the drawer back", "Lay it flat on a rug, inside face up. By hand until they stop.", () => {
    stage(d0.back, [0, 0, -160]);
    b.then(0.15);
    b.fits(CAM_BOLT, f0.bolts, 0.08);
  }, { tools: ["screwdriver"], kind: "cams" });
  dstep("Stand the sides on the back", "Tap the dowels into the sides first, then push them onto the dowels and bolts.", () => {
    b.fits(DRAWER_DOWEL, f0.dowels.filter((x) => x.mate === d0.back), 0.08);
    b.then(0.15);
    for (const k of d0.sides) stage(k, [0, 0, 260]);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Lock the cam locks", "Arrow towards the bolt, then a clockwise turn.", () => b.fits(CAM, f0.cams, 0.1), { tools: ["screwdriver"], kind: "cams" });
  dstep("Slide in the drawer bottom", "It runs down the grooves in the sides until it meets the back.", () => stage(d0.bottom, [0, 0, 380]));
  const fsc = (f0 as { frontScrews?: FitOpts[] }).frontScrews;
  if (fsc)
    dstep("Screw the front on", "Hold it against the sides and screw through each side into it, two screws a side.", () => {
      stage(d0.front, [0, 0, 260]);
      b.then(0.15);
      b.fits(SUPPORT_SCREW, fsc, 0.1);
    }, { tools: ["screwdriver"], kind: "screws" });
  else dstep("Put the front on", "Cam bolts into the front and dowels into the sides, then press it on and lock both cam locks.", () => {
    b.fits(CAM_BOLT, f0.frontBolts, 0.1);
    b.fits(DRAWER_DOWEL, f0.dowels.filter((x) => x.mate === d0.front), 0.08);
    b.then(0.15);
    stage(d0.front, [0, 0, 260]);
    b.then(0.1);
    b.fits(CAM, f0.frontCams, 0.12);
  }, { tools: ["hammer", "screwdriver"], kind: "join" });
  if (f0.plates.length) dstep("Screw the L plates under the bottom", "Turn it over. They hold the bottom to the front and the back.", () => {
    b.fits({ kind: "angle", len: 30, dia: 20 }, f0.plates, 0.12);
    b.then(0.05);
    b.fits(SUPPORT_SCREW, f0.plateScrews, 0.1);
  }, { tools: ["screwdriver"], kind: "screws", pose: "-y" });
  dstep(d0.box.knobs === 2 ? "Screw on the knobs" : "Screw on the knob", "The screw goes in from inside the drawer.", () => {
    b.fits(KNOB, f0.knobs, 0.2);
    b.then(0.05);
    b.fits(KNOB_SCREW, f0.knobScrews, 0.15);
  }, { tools: ["screwdriver"], kind: "screws", pose: "+y" });
  let insert: string[] = [];
  if (o.insert) {
    const d = d0;
    const L = 2 * d.xs - st - 10, ih = 60;
    const z = d.box.zf - ft - 120;
    const a = b.place(b.part("Insert board", [L, ih, 12]), [d.box.x, d.ys + 12 + ih / 2, z]);
    const c = b.place(b.part("Insert divider", [12, ih, 180]), [d.box.x, d.ys + 12 + ih / 2, z - 96]);
    insert = [a, c];
    step(b, { title: "Screw the insert together", detail: "Two screws through the long board into the short one, then two more to hold it in the drawer.", tools: ["screwdriver"], scene: "drawer", pose: "+y", kind: "screws" }, () => {
      stage(a, [0, 200, 0]);
      stage(c, [0, 200, 0]);
      b.then(0.15);
      b.fits({ kind: "screw", len: 30, dia: 4 }, [{ on: a, at: [d.box.x - 0, d.ys + 30, z + 6], dir: [0, 0, -1], mate: c }, { on: a, at: [d.box.x, d.ys + 55, z + 6], dir: [0, 0, -1], mate: c }, { on: d.bottom, at: [d.box.x - L / 3, d.ys, z], dir: [0, 1, 0], mate: a }, { on: d.bottom, at: [d.box.x + L / 3, d.ys, z], dir: [0, 1, 0], mate: a }], 0.12);
    });
  }
  step(b, { title: n > 1 ? "Click the drawers onto the runners" : "Click the drawer onto the runners", detail: "Pull the runners out, set the drawer on them and push it back until both clips click.", kind: "drawer" }, () => {
    for (const [i, d] of made.entries()) {
      b.stagger(0);
      for (const k of [d.back, ...d.sides, d.bottom, d.front, ...(i === 0 ? insert : [])]) b.add(k, [0, 0, 520]);
      if (i > 0) {
        const f = fitsOf(d);
        const all: [HwDef, FitOpts[]][] = [
          [CAM_BOLT, [...f.bolts, ...f.frontBolts]],
          [DRAWER_DOWEL, f.dowels],
          [CAM, [...f.cams, ...f.frontCams]],
          [{ kind: "angle", len: 30, dia: 20 }, f.plates],
          [SUPPORT_SCREW, [...f.plateScrews, ...((f as { frontScrews?: FitOpts[] }).frontScrews ?? [])]],
          [KNOB, f.knobs],
          [KNOB_SCREW, f.knobScrews],
        ];
        for (const [def, l] of all) for (const x of l) b.preset(def, x);
      }
      b.wait(0.22);
    }
  });
}

/* ---------- wash-stands ---------- */

/*
 * Wash-stand with 2 drawers (60, 80 and 100 manuals, the same frame): each side is two posts, two side rails on
 * dowels with long screws and a panel slid into the grooves; the hanging brackets and the full-extension runners
 * are screwed on while it lies on the rug. The left side stays down while the five rails stand in it, the right
 * side goes on, then two adjustable feet at the front. It hangs on four wall plates (wall screws not included) and
 * the basin sits on the posts.
 */
function washStand(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10;
  const basin = /orrsj|rutsj/i.test(s.name) ? (/rutsj/i.test(s.name) ? 120 : 60) : 0;
  const H = s.size.h * 10 - basin;
  const r = new Recipe();
  const P = 45;
  const xo = W / 2 - (basin ? 10 : 0), xp = xo - P / 2, xi = xo - P;
  const zf = D / 2 - (basin ? 20 : 0), zb = -D / 2 + (basin ? 10 : 0);
  const zpf = zf - P / 2, zpb = zb + P / 2, zm = (zpf + zpb) / 2;
  const legH = 110, botRail = 50, topRail = 70, midRail = 45;
  const sideD = zpf - zpb - P;
  const g = (L: string) => (L === "L" ? -1 : 1);
  for (const L of ["L", "R"]) {
    r.part(`pf${L}`, "Post", [P, H, P], [g(L) * xp, H / 2, zpf], { material: "wood" });
    r.part(`pb${L}`, "Post", [P, H, P], [g(L) * xp, H / 2, zpb], { material: "wood" });
    r.part(`st${L}`, "Side rail", [P - 10, 70, sideD], [g(L) * (xp + 5), H - 35, zm], { material: "wood" });
    r.part(`sb${L}`, "Side rail", [P - 10, 70, sideD], [g(L) * (xp + 5), legH + 35, zm], { material: "wood" });
    r.part(`sp${L}`, "Side panel", [12, H - legH - 140, sideD + 16], [g(L) * (xo - 14), legH + 70 + (H - legH - 140) / 2, zm]);
  }
  const avail = H - topRail - midRail - botRail - legH;
  const h1 = Math.round(avail * 0.42), h2 = avail - h1;
  const zr = zf - 10;
  r.part("rt", "Front rail", [2 * xi, topRail, 20], [0, H - topRail / 2, zr], { material: "wood" });
  r.part("rm", "Front rail", [2 * xi, midRail, 20], [0, H - topRail - h1 - midRail / 2, zr], { material: "wood" });
  r.part("rb", "Front rail", [2 * xi, botRail, 20], [0, legH + botRail / 2, zr], { material: "wood" });
  r.part("bt", "Back rail", [2 * xi, 90, 18], [0, H - 45, zb + 9], { material: "wood" });
  r.part("bb", "Back board", [2 * xi, 160, 16], [0, legH + 80, zb + 8]);
  const side = (L: string) => [`pf${L}`, `pb${L}`, `st${L}`, `sb${L}`, `sp${L}`];
  const sx = (L: string) => g(L) * (xp + 5);
  const railDowels = (L: string) => [
    at("dowel", `st${L}`, [0, 0, -1], [[sx(L), H - 35, zpf - P / 2]], `pf${L}`, sized(DRAWER_DOWEL)),
    at("dowel", `st${L}`, [0, 0, 1], [[sx(L), H - 35, zpb + P / 2]], `pb${L}`, sized(DRAWER_DOWEL)),
    at("dowel", `sb${L}`, [0, 0, -1], [[sx(L), legH + 35, zpf - P / 2]], `pf${L}`, sized(DRAWER_DOWEL)),
    at("dowel", `sb${L}`, [0, 0, 1], [[sx(L), legH + 35, zpb + P / 2]], `pb${L}`, sized(DRAWER_DOWEL)),
  ];
  const longScrews = (L: string) => [
    at("screw", `pf${L}`, [0, 0, -1], [[sx(L), H - 35, zpf + P / 2]], `st${L}`, sized(TOP_SCREW)),
    at("screw", `pf${L}`, [0, 0, -1], [[sx(L), legH + 35, zpf + P / 2]], `sb${L}`, sized(TOP_SCREW)),
  ];
  const yDr = [H - topRail - h1, legH + botRail];
  const runLen = Math.round((sideD - 20) / 10) * 10;
  const xr = xo - 20; // inside face of the side panel, where the runners screw on
  // the brackets sit on the back posts between the back rail and the back board, clear of their bolts
  const hangY = [H - 130, legH + 200];
  const hangers = (L: string) => [
    at("angle", `pb${L}`, [g(L), 0, 0], hangY.map((y): Vec3 => [g(L) * xi, y, zpb]), undefined, { len: 70, dia: 50 }),
    at("screw", `pb${L}`, [g(L), 0, 0], hangY.flatMap((y): Vec3[] => [[g(L) * xi, y - 24, zpb], [g(L) * xi, y + 24, zpb]]), undefined, sized(RUNNER_SCREW)),
  ];
  const runners = (L: string) => [
    at("runner", `sp${L}`, [g(L), 0, 0], yDr.map((y): Vec3 => [g(L) * xr, y + 12, zm]), undefined, { len: runLen, dia: 30 }),
    at("screw", `sp${L}`, [g(L), 0, 0], yDr.flatMap((y): Vec3[] => [[g(L) * xr, y + 12, zm + runLen / 2 - 40], [g(L) * xr, y + 12, zm - runLen / 2 + 40]]), undefined, sized(RUNNER_SCREW)),
  ];
  // each rail end: a cam bolt below and a dowel above, far enough apart not to share a hole
  const rails = [
    { id: "rt", y: H - topRail / 2, h: topRail, z: zr, n: 1, post: "pf", o: 15 },
    { id: "rm", y: H - topRail - h1 - midRail / 2, h: midRail, z: zr, n: 1, post: "pf", o: 12 },
    { id: "rb", y: legH + botRail / 2, h: botRail, z: zr, n: 1, post: "pf", o: 12 },
    { id: "bt", y: H - 45, h: 90, z: zb + 9, n: 1, post: "pb", o: 20 },
    { id: "bb", y: legH + 80, h: 160, z: zb + 8, n: 2, post: "pb", o: 45 },
  ];
  const camBolts = (L: string) => rails.map((q) => at("camScrew", `${q.post}${L}`, [g(L), 0, 0], q.n === 2 ? [[g(L) * xi, q.y - q.o, q.z], [g(L) * xi, q.y + q.o, q.z]] : [[g(L) * xi, q.y - q.o, q.z]], q.id, { len: 34 }));
  const dowelsIn = (L: string, ids: string[]) => rails.filter((q) => ids.includes(q.id)).map((q) => at("dowel", q.id, [-g(L), 0, 0], [[g(L) * xi, q.n === 2 ? q.y : q.y + q.o, q.z]], `${q.post}${L}`, sized(DRAWER_DOWEL)));
  const cams = (L: string) =>
    rails.map((q) => at("cam", q.id, q.n === 2 || q.id === "bt" ? [0, 0, -1] : [0, -1, 0], q.n === 2 ? [[g(L) * (xi - 26), q.y - q.o, q.z + 8], [g(L) * (xi - 26), q.y + q.o, q.z + 8]] : q.id === "bt" ? [[g(L) * (xi - 26), q.y - q.o, q.z + 9]] : [[g(L) * (xi - 26), q.y + q.h / 2, q.z]], undefined, { dia: 15 }));

  r.step({
    title: "Join the side rails to the posts",
    detail: "Do both sides on a rug. Tap the dowels into the rails, push them into the front post, slide the panel into the grooves, then push the back post on and drive the two long screws.",
    add: side("L"),
    fix: [...railDowels("L"), ...longScrews("L")],
    from: { pfL: [0, 0, 260], stL: [0, 0, -260], sbL: [0, 0, -260], spL: [0, 0, -320], pbL: [0, 0, -380] },
    tools: ["hammer", "allen"],
    pose: "+x",
    repeat: 2,
    warnings: ["floor"],
  });
  r.step({ title: "Screw the hanging brackets to the back posts", detail: "Two on each side, on the inside. They hold it to the wall later.", fix: hangers("L"), tools: ["screwdriver"], pose: "+x", repeat: 2 });
  r.step({ title: "Screw the runners onto the sides", detail: "Two on each side, the ones marked for that side, two screws in each.", fix: runners("L"), tools: ["screwdriver"], pose: "+x", repeat: 2 });
  r.step({ title: "Screw in the cam bolts", detail: "Six in each side, into the inside faces of the posts, by hand.", fix: camBolts("L"), tools: ["screwdriver"], pose: "+x", repeat: 2 });
  r.step({ title: "Stand the front rails in the left side", detail: "It stays on the rug. A dowel in each rail end, then push it on.", add: ["rt", "rm", "rb"], fix: dowelsIn("L", ["rt", "rm", "rb"]), tools: ["hammer"], pose: "+x" });
  r.step({ title: "Stand the back rail and the back board in", detail: "The board goes at the bottom, with its plain side facing out.", add: ["bt", "bb"], fix: dowelsIn("L", ["bt", "bb"]), tools: ["hammer"], pose: "+x" });
  r.step({ title: "Lock the cam locks", detail: "Six of them. Arrow towards the bolt, then a clockwise turn.", fix: cams("L"), tools: ["screwdriver"], pose: "+x" });
  r.step({
    title: "Lower the right side on",
    detail: "It has its rails, brackets, runners and bolts like the left one. Dowels in the free rail ends, then press it on evenly.",
    add: side("R"),
    fix: [...railDowels("R"), ...longScrews("R"), ...hangers("R"), ...runners("R"), ...camBolts("R"), ...dowelsIn("R", rails.map((q) => q.id))],
    tools: ["hammer"],
    pose: "+x",
  });
  r.step({ title: "Lock the cam locks on this side", detail: "Six again, arrow towards the bolt.", fix: cams("R"), tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Stand it up and screw in the feet", detail: "The two adjustable feet go into the bottom of the front posts.", fix: [at("foot", "pfL", [0, 1, 0], [[-xp, 0, zpf]]), at("foot", "pfR", [0, 1, 0], [[xp, 0, zpf]])], pose: "+y", kind: "legs" });
  r.step({
    title: "Hang it on the wall",
    detail: "Screw the four wall plates on at the height in the drawing (screws not included: pick ones for your wall), hang the brackets on them and turn the feet down to the floor.",
    fix: [at("bracket", "pbL", [0, 0, -1], hangY.map((y): Vec3 => [-xi + 20, y, zb - 2]), undefined, { len: 40, dia: 30 }), at("bracket", "pbR", [0, 0, -1], hangY.map((y): Vec3 => [xi - 20, y, zb - 2]), undefined, { len: 40, dia: 30 })],
    wall: true,
    tools: ["drill", "screwdriver", "level", "pencil"],
    warnings: ["wall", "tip"],
  });
  buildCustom(b, { ...s, custom: r.get() });

  const wide = W >= 900;
  boardDrawers(
    b,
    [
      { x: 0, y0: H - topRail - h1, w: 2 * xi, h: h1, zf, zBack: zb + 40 + (basin ? 0 : 0), knobs: wide ? 2 : 1, plates: wide ? 4 : 2 },
      { x: 0, y0: legH + botRail, w: 2 * xi, h: h2, zf, zBack: zb + 30, knobs: wide ? 2 : 1, plates: wide ? 4 : 2 },
    ],
    { insert: true },
  );
  if (basin) basinSteps(b, s, { W, D, H, total: s.size.h * 10, rutsjon: /rutsj/i.test(s.name), tap: /tap/i.test(s.variant) });
  return true;
}

/*
 * Open wash-stands (82 cm with a top and one drawer; the US ones with two or four drawers under the basin): the
 * sides are ladders of two posts and two rails on dowels; the left one lies on a rug, the rails and the slatted
 * shelf stand in it on cam bolts, the right one goes on, then four adjustable feet. The runners screw to the side
 * rails, the top (when there is one) takes cam bolts and the two hanging brackets upside down, and it is fixed to
 * the wall before the drawers click in.
 */
function openStand(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10;
  const us = /bathroom-vanity-with|orrsjon/.test(s.slug ?? "") || /orrsj/i.test(s.name);
  const bowl = /v.stersj/i.test(s.name);
  const total = s.size.h * 10;
  const H = us ? total - 55 : bowl ? 760 : total;
  const cols = W > 1100 ? 2 : 1;
  const rows = us ? 2 : 1;
  const topPanel = !us;
  const r = new Recipe();
  const P = 45, topT = topPanel ? 20 : 0;
  const postH = H - topT;
  const xo = W / 2 - (topPanel ? 10 : 15), xp = xo - P / 2, xi = xo - P;
  const zf = D / 2 - (topPanel ? 15 : 30), zb = -D / 2 + (topPanel ? 5 : 15);
  const zpf = zf - P / 2, zpb = zb + P / 2, zm = (zpf + zpb) / 2;
  const sideD = zpf - zpb - P;
  const g = (L: string) => (L === "L" ? -1 : 1);
  const shelfY = 140, railH = 40, topRail = topPanel ? 0 : 60;
  const drH = topPanel ? 190 : Math.round((postH * 0.55 - topRail - railH * rows) / rows);
  // the top side rail is a wide board as deep as the drawers: their runners screw onto it
  const stH = topPanel ? drH : postH - (postH - topRail - rows * (drH + railH)) - railH;
  const stY = postH - stH / 2;
  for (const L of ["L", "R"]) {
    r.part(`pf${L}`, "Post", [P, postH, P], [g(L) * xp, postH / 2, zpf], { material: "wood" });
    r.part(`pb${L}`, "Post", [P, postH, P], [g(L) * xp, postH / 2, zpb], { material: "wood" });
    r.part(`st${L}`, "Side rail", [P - 10, stH, sideD], [g(L) * xp, stY, zm], { material: "wood" });
    r.part(`sb${L}`, "Side rail", [P - 10, 50, sideD], [g(L) * xp, shelfY - 25, zm], { material: "wood" });
  }
  const zr = zf - 10;
  const fr: { id: string; y: number; h: number }[] = [];
  if (!topPanel) fr.push({ id: "ft", y: postH - topRail / 2, h: topRail });
  let y = postH - topRail;
  const ops: number[] = [];
  for (let i = 0; i < rows; i++) {
    y -= drH;
    ops.push(y);
    y -= railH;
    fr.push({ id: `fr${i}`, y: y + railH / 2, h: railH });
  }
  for (const q of fr) r.part(q.id, "Front rail", [2 * xi, q.h, 20], [0, q.y, zr], { material: "wood" });
  r.part("bt", "Back rail", [2 * xi, 90, 20], [0, postH - 45, zb + 10], { material: "wood" });
  const slats = Math.max(6, Math.round((2 * xi) / 70));
  const shD = zpf - zpb + P - 20;
  r.part("sh", "Slatted shelf", [2 * xi, 22, shD], [0, shelfY + 11, zm], {
    material: "wood",
    pieces: [
      { shape: "box", size: [30, 22, shD], pos: [-xi + 15, 0, 0] },
      { shape: "box", size: [30, 22, shD], pos: [xi - 15, 0, 0] },
      ...range(slats).map((i) => ({ shape: "box" as const, size: [2 * xi - 60, 16, 50] as Vec3, pos: [0, 3, -shD / 2 + 25 + (i * (shD - 50)) / (slats - 1)] as Vec3 })),
    ],
  });
  if (cols === 2) r.part("mid", "Middle post", [P, postH - topRail - (y - 0) + railH, 40], [0, (y + postH - topRail) / 2, zr - 10], { material: "wood" });
  if (topPanel) r.part("top", "Top", [W, topT, D], [0, H - topT / 2, 0]);
  const side = (L: string) => [`pf${L}`, `pb${L}`, `st${L}`, `sb${L}`];
  const ladder = (L: string) => [
    at("dowel", `st${L}`, [0, 0, -1], [[g(L) * xp, stY, zpf - P / 2]], `pf${L}`, sized(DRAWER_DOWEL)),
    at("dowel", `st${L}`, [0, 0, 1], [[g(L) * xp, stY, zpb + P / 2]], `pb${L}`, sized(DRAWER_DOWEL)),
    at("dowel", `sb${L}`, [0, 0, -1], [[g(L) * xp, shelfY - 25, zpf - P / 2]], `pf${L}`, sized(DRAWER_DOWEL)),
  ];
  const bolts = (L: string) => [
    at("camScrew", `pf${L}`, [g(L), 0, 0], fr.map((q): Vec3 => [g(L) * xi, q.y, zr]), undefined, { len: 34 }),
    at("camScrew", `pb${L}`, [g(L), 0, 0], [[g(L) * xi, postH - 45, zb + 10]], "bt", { len: 34 }),
    at("camScrew", `sb${L}`, [g(L), 0, 0], [zm - 120, zm, zm + 120].map((z): Vec3 => [g(L) * xi, shelfY - 25, z]), "sh", { len: 34 }),
  ];
  const cams = (L: string) => [
    at("cam", "bt", [0, 0, -1], [[g(L) * (xi - 26), postH - 45, zb + 20]], undefined, { dia: 15 }),
    ...fr.map((q) => at("cam", q.id, [0, -1, 0], [[g(L) * (xi - 26), q.y + q.h / 2, zr]], undefined, { dia: 15 })),
    at("cam", "sh", [0, -1, 0], [zm - 120, zm, zm + 120].map((z): Vec3 => [g(L) * (xi - 15), shelfY + 22, z]), undefined, { dia: 15 }),
  ];
  const runLen = Math.round((sideD - 10) / 10) * 10;
  const runners = (L: string) => [
    at("runner", `st${L}`, [g(L), 0, 0], ops.map((yy): Vec3 => [g(L) * (xi + 5), yy + 15, zm]), undefined, { len: runLen, dia: 30 }),
    at("screw", `st${L}`, [g(L), 0, 0], ops.flatMap((yy): Vec3[] => [[g(L) * (xi + 5), yy + 15, zm - runLen / 2 + 40], [g(L) * (xi + 5), yy + 15, zm + runLen / 2 - 40]]), undefined, sized(RUNNER_SCREW)),
  ];
  r.step({
    title: "Put the two side ladders together",
    detail: "Do both on a rug: tap the dowels into the rails, push them into the front post, then press the back post on.",
    add: side("L"),
    fix: ladder("L"),
    from: { pfL: [0, 0, 260], stL: [0, 0, -260], sbL: [0, 0, -260], pbL: [0, 0, -380] },
    tools: ["hammer"],
    pose: "+x",
    repeat: 2,
    warnings: ["floor"],
  });
  r.step({ title: "Screw in the cam bolts", detail: "Into the inside faces of the posts and the bottom rails, by hand.", fix: bolts("L"), tools: ["screwdriver"], pose: "+x", repeat: 2 });
  r.step({
    title: "Tap the dowels into the slatted shelf",
    detail: "Two in each end of its frame.",
    fix: [-1, 1].map((gg) => at("dowel", "sh", [-gg, 0, 0], [[gg * xi, shelfY + 11, zm - 60], [gg * xi, shelfY + 11, zm + 60]], undefined, sized(DRAWER_DOWEL))),
    tools: ["hammer"],
    pose: "+x",
  });
  r.step({ title: "Stand the rails in the left side", detail: "It stays on the rug. Push each rail onto its bolts.", add: [...fr.map((q) => q.id), "bt"], pose: "+x" });
  r.step({ title: "Stand the slatted shelf in", detail: "Its ends go onto the bolts in the bottom rail.", add: ["sh"], pose: "+x" });
  r.step({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then a clockwise turn.", fix: cams("L"), tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Lower the right side on", detail: "It has its dowels and bolts in like the left one. Press it down evenly.", add: side("R"), fix: [...ladder("R"), ...bolts("R")], from: { pfR: [300, 0, 0], pbR: [300, 0, 0], stR: [300, 0, 0], sbR: [300, 0, 0] }, pose: "+x" });
  r.step({ title: "Lock the cam locks on this side", detail: "Arrow towards the bolt, then a clockwise turn.", fix: cams("R"), tools: ["screwdriver"], pose: "+x" });
  if (cols === 2) r.step({ title: "Fit the middle post", detail: "Between the front rails, on its dowels, with a screw at each end.", add: ["mid"], fix: [at("screw", "fr" + (rows - 1), [0, 1, 0], [[0, y, zr]], "mid", sized(TOP_SCREW))], tools: ["allen"] });
  r.step({ title: "Screw in the adjustable feet", detail: "One under each post, by hand.", fix: ["L", "R"].flatMap((L) => [at("foot", `pf${L}`, [0, 1, 0], [[g(L) * xp, 0, zpf]]), at("foot", `pb${L}`, [0, 1, 0], [[g(L) * xp, 0, zpb]])]), pose: "+y", kind: "legs" });
  const midRunners = cols === 2 ? [-1, 1].flatMap((gg) => [at("runner", "mid", [-gg, 0, 0], ops.map((yy): Vec3 => [gg * P / 2, yy + 15, zm]), undefined, { len: runLen, dia: 30 }), at("screw", "mid", [-gg, 0, 0], ops.map((yy): Vec3 => [gg * P / 2, yy + 15, zr - 30]), undefined, sized(RUNNER_SCREW))]) : [];
  r.step({ title: "Screw on the runners", detail: "One on each side under each drawer, two screws each. Left and right are marked.", fix: [...runners("L"), ...runners("R"), ...midRunners], tools: ["screwdriver"] });
  if (topPanel) {
    const tb = [-1, 1].flatMap((gg) => [zpf - 10, zm, zpb + 10].map((z): Vec3 => [gg * xp, postH, z]));
    r.step({
      title: "Put the top on",
      detail: "Screw six cam bolts and the two hanging brackets under the top, tap six dowels into the posts and rails, then lower it on and lock it.",
      add: ["top"],
      fix: [
        at("camScrew", "top", [0, 1, 0], tb, undefined, { len: 24, dia: 6 }),
        at("angle", "top", [0, 1, 0], [[-xi / 2, postH, zb + 30], [xi / 2, postH, zb + 30]], undefined, { len: 70, dia: 50 }),
        at("screw", "top", [0, 1, 0], [[-xi / 2 - 15, postH, zb + 40], [-xi / 2 + 15, postH, zb + 40], [xi / 2 - 15, postH, zb + 40], [xi / 2 + 15, postH, zb + 40]], undefined, sized(RUNNER_SCREW)),
        at("dowel", "stL", [0, -1, 0], [[-xp, postH, zm + 40]], "top", sized(DRAWER_DOWEL)),
        at("dowel", "stR", [0, -1, 0], [[xp, postH, zm + 40]], "top", sized(DRAWER_DOWEL)),
        at("dowel", "pfL", [0, -1, 0], [[-xp, postH, zpf + 10], [xp, postH, zpf + 10], [-xp, postH, zpb - 10], [xp, postH, zpb - 10]], "top", sized(DRAWER_DOWEL)),
        at("cam", "stL", [-1, 0, 0], [[-xi, postH - 25, zpf - 10], [-xi, postH - 25, zm], [-xi, postH - 25, zpb + 10]], undefined, { dia: 15 }),
        at("cam", "stR", [1, 0, 0], [[xi, postH - 25, zpf - 10], [xi, postH - 25, zm], [xi, postH - 25, zpb + 10]], undefined, { dia: 15 }),
      ],
      tools: ["screwdriver", "hammer"],
      people: 2,
    });
    r.step({
      title: "Hang it on the wall",
      detail: "Screw the two wall plates on level (screws not included: pick ones for your wall), hang the brackets on them and turn the feet down to the floor.",
      fix: [at("bracket", "bt", [0, 0, -1], [[-xi / 2, postH - 30, zb - 2], [xi / 2, postH - 30, zb - 2]], undefined, { len: 40, dia: 30 })],
      wall: true,
      tools: ["drill", "level", "pencil"],
      warnings: ["wall", "tip"],
    });
  } else {
    r.step({
      title: "Fix it to the wall",
      detail: "Two L brackets on the back rail, two screws and washers each. Wall screws and plugs from the box suit solid walls.",
      fix: [
        at("angle", "bt", [0, 0, 1], [[-xi / 2, postH - 20, zb], [xi / 2, postH - 20, zb]], undefined, { len: 80, dia: 40 }),
        at("washer", "bt", [0, 0, -1], [[-xi / 2 - 15, postH + 30, zb - 2], [-xi / 2 + 15, postH + 30, zb - 2], [xi / 2 - 15, postH + 30, zb - 2], [xi / 2 + 15, postH + 30, zb - 2]]),
        at("screw", "bt", [0, 0, 1], [[-xi / 2, postH - 30, zb - 2], [xi / 2, postH - 30, zb - 2]], undefined, { len: 12, dia: 3.5 }),
      ],
      wall: true,
      tools: ["drill", "screwdriver", "level"],
      warnings: ["wall", "tip"],
    });
  }
  buildCustom(b, { ...s, custom: r.get() });
  const cw = cols === 2 ? xi - 20 : 2 * xi;
  const boxes: BoardBox[] = [];
  for (const y0 of ops) for (let c = 0; c < cols; c++) boxes.push({ x: cols === 2 ? (c ? 1 : -1) * (cw / 2 + 20) : 0, y0: y0 + 2, w: cw, h: drH - 4, zf, zBack: zb + 30, knobs: W > 700 && cols === 1 ? 2 : 1, plates: 2 });
  boardDrawers(b, boxes, { light: true });
  if (us || bowl) basinSteps(b, s, { W, D, H, total, rutsjon: false, tap: /tap/i.test(s.variant) });
  return true;
}

/** The basin from its own box: sealed onto the stand, the tap and the water trap fitted. Drawn simply. */
function basinSteps(b: PlanBuilder, s: ProductSpec, o: { W: number; D: number; H: number; total: number; rutsjon: boolean; tap: boolean }) {
  const bh = o.total - o.H;
  // a countertop bowl (VÄSTERSJÖN) sits on the top; the others cover the whole stand
  const basin = /v.stersj/i.test(s.name)
    ? b.place(b.part("Wash-basin", [Math.min(o.W, o.D) * 0.85, bh, Math.min(o.W, o.D) * 0.85], { shape: "cyl", material: "board" }), [0, o.H + bh / 2, 0])
    : b.place(b.part("Wash-basin", [o.W, bh, o.D], { material: "board" }), [0, o.H + bh / 2, 0]);
  step(b, { title: "Lay the wash-basin on", detail: "Two people. It comes in its own box with its own instructions: run a bead of silicone along the posts first, then lower it on square.", people: 2, kind: "join", warnings: ["two"] }, () => {
    b.add(basin, [0, 300, 0]);
  });
  if (o.tap)
    step(b, { title: "Fit the tap", detail: "The mixer tap is in its own box. Fit it in the basin's hole and connect the flexible hoses before the trap.", tools: ["wrench"], kind: "general" }, () =>
      b.fit({ kind: "connector", len: 120, dia: 30 }, { on: basin, at: [0, o.total, -o.D / 2 + 70], dir: [0, -1, 0], hole: false }),
    );
  step(b, { title: "Connect the water trap", detail: "The trap from its own box goes under the plug hole, behind the top drawer. Get a plumber if you're unsure.", tools: ["wrench"], kind: "general" }, () =>
    b.fit({ kind: "connector", len: 200, dia: 40 }, { on: basin, at: [0, o.H, -40], dir: [0, 1, 0], hole: false }),
  );
  void s;
}

/* ---------- the products ---------- */

function chest(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const v = s.variant.toLowerCase();
  if (/chest of 3 drawers/.test(v) || s.slug === "hemnes-3-drawers") {
    // openings: two equal ones and a deep one at the bottom
    const avail = H - 20 - 110 - 40 - 50 - 2 * 20;
    const small = Math.round(avail * 0.29);
    postChest(b, s, {
      ...{ W, H, D, P: 45, legH: 110, topT: 20, ovS: 22, ovF: 14, spacer: true, openings: [small, small, avail - 2 * small], midRail: 20, topRail: 40, botRail: 50, backRail: 80 },
      ...{ backSheets: 2, knobs: 2, postBolts: 3, topPanel: true, topScrews: 2, roundNails: [3, 6, 4] },
    });
    return true;
  }
  if (/chest of 8 drawers/.test(v)) {
    const avail = H - 20 - 110 - 40 - 50 - 2 * 20;
    const small = Math.round(avail * 0.24);
    const big = Math.round((avail - small) / 2);
    postChest(b, s, {
      ...{ W, H, D, P: 45, legH: 110, topT: 20, ovS: 22, ovF: 14, spacer: true, openings: [small, big, avail - small - big], midRail: 20, topRail: 40, botRail: 50, backRail: 80 },
      ...{ backSheets: 2, knobs: 2, postBolts: 3, topPanel: true, topScrews: 2, roundNails: [4, 8, 6], cols: 2, topSplit: true },
    });
    return true;
  }
  if (/2-drawer chest/.test(v)) {
    const avail = H - 20 - 90 - 30 - 40 - 20;
    const small = Math.round(avail * 0.45);
    postChest(b, s, {
      ...{ W, H, D, P: 42, legH: 90, topT: 20, ovS: 16, ovF: 12, spacer: false, openings: [small, avail - small], midRail: 20, topRail: 30, botRail: 40, backRail: 70 },
      ...{ backSheets: 1, knobs: 1, postBolts: 2, topPanel: false, topScrews: 1, roundNails: [4, 3, 3], liners: true, tray: true },
    });
    return true;
  }
  return false;
}

/* ---------- recipes ---------- */

class Recipe {
  parts: CustomPart[] = [];
  steps: CustomStep[] = [];
  part(id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) {
    this.parts.push({ id, name, size, pos, ...o });
    return id;
  }
  step(st: CustomStep) {
    this.steps.push(st);
  }
  get(): CustomParams {
    // the custom builder takes ten fittings a step: share the rest over copies of the same step
    const out: CustomStep[] = [];
    for (const st0 of this.steps) {
      const st = (st0.fix?.length ?? 0) > 10 ? { ...st0, fix: merge(st0.fix!) } : st0;
      const f = st.fix ?? [];
      if (f.length <= 10) out.push(st);
      else for (let i = 0; i < f.length; i += 10) out.push({ ...st, fix: f.slice(i, i + 10), add: i ? [] : st.add });
    }
    for (const st of out) for (const f of st.fix ?? []) if (f.at) f.count = f.at.length;
    return { parts: this.parts, steps: out };
  }
}
/** Fittings of the same kind, size and direction in one list; each then goes into the part nearest its point. */
function merge(fix: CustomFix[]): CustomFix[] {
  const groups = new Map<string, CustomFix>();
  for (const f of fix) {
    if (!f.at) {
      groups.set(`${groups.size}`, f);
      continue;
    }
    const k = `${f.kind}|${f.len}|${f.dia}|${(f.dir ?? [0, -1, 0]).join(",")}`;
    const g = groups.get(k);
    if (!g) groups.set(k, { ...f, at: [...f.at] });
    else {
      g.at!.push(...f.at);
      if (g.on !== f.on) g.on = undefined;
      if (g.mate !== f.mate) g.mate = undefined;
    }
  }
  return [...groups.values()];
}
/** Fittings at exact points: kind, the part they go into, the way they go in, the part their other end meets. */
const at = (kind: CustomFix["kind"], on: string | undefined, dir: Vec3, pts: Vec3[], mate?: string, o: { len?: number; dia?: number } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const sized = (def: HwDef) => ({ len: def.len, dia: def.dia });

/* ---------- bookcase ---------- */

/*
 * Bookcase 90 x 197: each side is a ready-made frame of two posts and panels. Both lie on a rug for their cam bolts,
 * side rails and adjustable feet; the left one then stays down while the rails and the fixed shelf stand in it, the
 * right one goes on top, and the top is screwed on from inside the top rails. The two back panels slide into the
 * grooves and are held with clips, then it stands up, is fixed to the wall with two L brackets and gets its shelves.
 */
function bookcase(s: ProductSpec): CustomParams | null {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  if (W < 700) return null; // only the 90 wide manual was checked
  const r = new Recipe();
  const topT = 22, P = 45, ov = 10;
  const postH = H - topT;
  const xo = W / 2 - ov, xp = xo - P / 2, xi = xo - P;
  const zf = D / 2 - ov, zb = -D / 2 + 3;
  const zpf = zf - P / 2, zpb = zb + P / 2, zm = (zpf + zpb) / 2;
  const legH = 70, plinth = 80, topRail = 60, midY = Math.round(H * 0.5), midRail = 60;
  const sideD = zpf - zpb - P;
  const sides = [-1, 1].map((g) => {
    const L = g < 0 ? "L" : "R";
    r.part(`pf${L}`, "Corner post", [P, postH, P], [g * xp, postH / 2, zpf], { material: "wood" });
    r.part(`pb${L}`, "Corner post", [P, postH, P], [g * xp, postH / 2, zpb], { material: "wood" });
    const lowH = midY - midRail / 2 - (legH + plinth);
    const upH = postH - (midY + midRail / 2);
    r.part(`lo${L}`, "Lower side panel", [16, lowH, sideD + 16], [g * (xo - 16), legH + plinth + lowH / 2, zm]);
    r.part(`up${L}`, "Upper side panel", [16, upH, sideD + 16], [g * (xo - 16), midY + midRail / 2 + upH / 2, zm]);
    r.part(`sr${L}`, "Side rail", [P - 10, midRail, sideD], [g * (xo - P / 2 - 5), midY, zm], { material: "wood" });
    r.part(`br${L}`, "Side rail", [P - 10, plinth, sideD], [g * (xo - P / 2 - 5), legH + plinth / 2, zm], { material: "wood" });
    return L;
  });
  void sides;
  const zr = zf - 10, zbr = zb + 10;
  r.part("fp", "Plinth", [2 * xi, plinth, 20], [0, legH + plinth / 2, zr], { material: "wood" });
  r.part("bp", "Back plinth", [2 * xi, plinth, 20], [0, legH + plinth / 2, zbr], { material: "wood" });
  r.part("ft", "Top rail", [2 * xi, topRail, 20], [0, postH - topRail / 2, zr], { material: "wood" });
  r.part("bt", "Top rail", [2 * xi, topRail, 20], [0, postH - topRail / 2, zbr], { material: "wood" });
  // in front of the back panels, which run behind it from the plinth to the top rail
  r.part("fx", "Fixed shelf", [2 * xi, 20, zf - zb - 26], [0, midY, (zf + zb + 26) / 2]);
  r.part("top", "Top", [W, topT, D], [0, H - topT / 2, 0], { material: "wood" });
  const bkW = xi, bkH = postH - topRail - (legH + plinth);
  r.part("bk1", "Back panel", [bkW, bkH, 4], [-xi / 2, legH + plinth + bkH / 2, zb + 24], { material: "wood" });
  r.part("bk2", "Back panel", [bkW, bkH, 4], [xi / 2, legH + plinth + bkH / 2, zb + 24], { material: "wood" });
  r.part("bs", "Bottom shelf", [2 * xi, 18, zf - zb - 50], [0, legH + plinth + 9, (zf + zb) / 2 + 6]);
  const lowSpan = midY - 10 - (legH + plinth + 18), upSpan = postH - topRail - (midY + 10);
  const shelfYs = [legH + plinth + 18 + lowSpan / 3, legH + plinth + 18 + (2 * lowSpan) / 3, midY + 10 + upSpan / 3, midY + 10 + (2 * upSpan) / 3].map(Math.round);
  shelfYs.forEach((y, i) => r.part(`sh${i}`, "Shelf", [2 * xi - 4, 18, zf - zb - 50], [0, y, (zf + zb) / 2 + 6]));

  const side = (L: string) => [`pf${L}`, `pb${L}`, `lo${L}`, `up${L}`];
  const g = (L: string) => (L === "L" ? -1 : 1);
  // cam bolts in the posts for the plinths and top rails, and in the side rails for the fixed shelf
  const postBolts = (L: string) => [
    at("camScrew", `pf${L}`, [g(L), 0, 0], [[g(L) * xi, legH + plinth / 2 - 15, zr], [g(L) * xi, postH - topRail / 2 - 12, zr]], undefined, { len: 34 }),
    at("camScrew", `pb${L}`, [g(L), 0, 0], [[g(L) * xi, legH + plinth / 2 - 15, zbr], [g(L) * xi, postH - topRail / 2 - 12, zbr]], undefined, { len: 34 }),
  ];
  const railDowels = (L: string, ids: string[]) =>
    ids.map((id) => {
      const y = id.endsWith("p") ? legH + plinth / 2 + 15 : postH - topRail / 2 + 12;
      const z = id.startsWith("f") ? zr : zbr;
      return at("dowel", id, [-g(L), 0, 0], [[g(L) * xi, y, z]], id.startsWith("f") ? `pf${L}` : `pb${L}`, sized(DOWEL));
    });
  const railCams = (L: string, ids: string[]) =>
    ids.map((id) => {
      const top = !id.endsWith("p");
      const y = top ? postH - topRail : legH + plinth;
      return at("cam", id, [0, top ? 1 : -1, 0], [[g(L) * (xi - 26), y, id.startsWith("f") ? zr : zbr]], undefined, { dia: 15 });
    });

  const sx = (L: string) => g(L) * (xo - P / 2 - 5);
  const railEnds = (L: string) => [
    at("dowel", `sr${L}`, [0, -1, 0], [[sx(L), midY + midRail / 2, zm]], undefined, sized(DOWEL)),
    at("dowel", `sr${L}`, [0, 0, -1], [[sx(L), midY, zpf - P / 2]], `pf${L}`, sized(DOWEL)),
    at("dowel", `sr${L}`, [0, 0, 1], [[sx(L), midY, zpb + P / 2]], `pb${L}`, sized(DOWEL)),
  ];
  r.step({
    title: "Screw the cam bolts into both sides",
    detail: "Lay both side frames on a rug, inside up. Four bolts in each, by hand until they stop.",
    add: side("L"),
    fix: postBolts("L"),
    repeat: 2,
    pose: "+x",
    warnings: ["floor"],
    tools: ["screwdriver"],
  });
  r.step({
    title: "Tap dowels into the side rails",
    detail: "Three in each: one in each end and one in the top edge for the fixed shelf.",
    repeat: 2,
    fix: railEnds("L"),
    tools: ["hammer"],
    pose: "+x",
  });
  r.step({
    title: "Screw the side rails between the posts",
    detail: "One in the middle of each side and one at the bottom. Long screws through the posts, with the Allen key.",
    add: ["srL", "brL"],
    repeat: 2,
    fix: ["L"].flatMap((L) => [
      at("screw", `pf${L}`, [0, 0, -1], [[g(L) * (xo - P / 2 - 5), midY, zpf + P / 2]], `sr${L}`, sized(TOP_SCREW)),
      at("screw", `pb${L}`, [0, 0, 1], [[g(L) * (xo - P / 2 - 5), midY, zpb - P / 2]], `sr${L}`, sized(TOP_SCREW)),
      at("screw", `pf${L}`, [0, 0, -1], [[g(L) * (xo - P / 2 - 5), legH + plinth / 2, zpf + P / 2]], `br${L}`, sized(TOP_SCREW)),
    ]),
    tools: ["allen"],
    pose: "+x",
  });
  r.step({
    title: "Screw the adjustable feet into the posts",
    detail: "Into the bottom end of each post, by hand. You level them once it stands.",
    repeat: 2,
    fix: ["L"].flatMap((L) => [at("foot", `pf${L}`, [0, 1, 0], [[g(L) * xp, 0, zpf]]), at("foot", `pb${L}`, [0, 1, 0], [[g(L) * xp, 0, zpb]])]),
    pose: "+x",
  });
  r.step({
    title: "Stand the plinths in the left side",
    detail: "The left side stays on the rug, inside up. A dowel in each end, then push them onto the dowel and bolt.",
    add: ["fp", "bp"],
    fix: railDowels("L", ["fp", "bp"]),
    tools: ["hammer"],
    pose: "+x",
  });
  r.step({ title: "Stand the top rails in", detail: "Front and back, at the far end, on a dowel each.", add: ["ft", "bt"], fix: railDowels("L", ["ft", "bt"]), tools: ["hammer"], pose: "+x" });
  r.step({ title: "Lock the four rails", detail: "Arrow towards the bolt, then turn each cam lock clockwise.", fix: railCams("L", ["fp", "bp", "ft", "bt"]), tools: ["screwdriver"], pose: "+x" });
  r.step({
    title: "Stand the fixed shelf on the side rail",
    detail: "Screw two cam bolts into the side rails first. The shelf drops onto the dowel and bolts; lock it with two cam locks.",
    add: ["fx"],
    fix: [
      at("camScrew", "srL", [1, 0, 0], [[-xi, midY, zm - 80], [-xi, midY, zm + 80]], undefined, { len: 34 }),
      at("camScrew", "srR", [-1, 0, 0], [[xi, midY, zm - 80], [xi, midY, zm + 80]], undefined, { len: 34 }),
      at("cam", "fx", [0, -1, 0], [[-xi + 26, midY + 10, zm - 80], [-xi + 26, midY + 10, zm + 80]], undefined, { dia: 15 }),
    ],
    tools: ["screwdriver"],
    pose: "+x",
  });
  r.step({
    title: "Lower the right side on",
    detail: "It has its bolts, rails and feet on like the left one. Tap a dowel into each free rail end, then two people press it down evenly.",
    add: [...side("R"), "srR", "brR"],
    from: Object.fromEntries([...side("R"), "srR", "brR"].map((k) => [k, [360, 0, 0] as Vec3])),
    fix: [
      ...postBolts("R"),
      ...railDowels("R", ["fp", "bp", "ft", "bt"]),
      ...railEnds("R"),
      at("screw", "pfR", [0, 0, -1], [[xo - P / 2 - 5, midY, zpf + P / 2], [xo - P / 2 - 5, legH + plinth / 2, zpf + P / 2]], undefined, sized(TOP_SCREW)),
      at("screw", "pbR", [0, 0, 1], [[xo - P / 2 - 5, midY, zpb - P / 2]], "srR", sized(TOP_SCREW)),
      at("foot", "pfR", [0, 1, 0], [[xp, 0, zpf]]),
      at("foot", "pbR", [0, 1, 0], [[xp, 0, zpb]]),
    ],
    tools: ["hammer"],
    people: 2,
    pose: "+x",
  });
  r.step({
    title: "Lock the cam locks on this side",
    detail: "Four in the rails and two in the fixed shelf.",
    fix: [...railCams("R", ["fp", "bp", "ft", "bt"]), at("cam", "fx", [0, -1, 0], [[xi - 26, midY + 10, zm - 80], [xi - 26, midY + 10, zm + 80]], undefined, { dia: 15 })],
    tools: ["screwdriver"],
    pose: "+x",
  });
  r.step({
    title: "Turn it onto its back and fit the top",
    detail: "Two people. Tap two dowels into the top rails, push the top on, then seven long screws up through the rails.",
    add: ["top"],
    fix: [
      at("dowel", "ft", [0, -1, 0], [[-xi / 2, postH, zr]], "top", sized(DOWEL)),
      at("dowel", "bt", [0, -1, 0], [[xi / 2, postH, zbr]], "top", sized(DOWEL)),
      at("screw", "ft", [0, 1, 0], spread(-xi + 60, xi - 60, 4).map((x): Vec3 => [x, postH - topRail, zr]), "top", sized(TOP_SCREW)),
      at("screw", "bt", [0, 1, 0], spread(-xi + 100, xi - 100, 3).map((x): Vec3 => [x, postH - topRail, zbr]), "top", sized(TOP_SCREW)),
    ],
    tools: ["hammer", "allen"],
    people: 2,
    pose: "+z",
  });
  r.step({
    title: "Slide in the back panels",
    detail: "Turn it onto its front. Two people: the panels slide down the grooves in the posts, one from each side, meeting in the middle.",
    add: ["bk1", "bk2"],
    people: 2,
    pose: "-z",
    from: { bk1: [0, 0, -300], bk2: [0, 0, -300] },
  });
  r.step({
    title: "Clip the back panels in place",
    detail: "Nine clips: three to the fixed shelf, the rest to the top rail and the plinth. A screw in each.",
    fix: [
      // each clip screws onto the rail or the shelf and its lip holds the panel edge
      at("clip", "fx", [0, 1, 0], spread(-xi + 100, xi - 100, 3).map((x): Vec3 => [x, midY - 10, zb + 34]), undefined, { len: 12, dia: 20 }),
      at("clip", "bt", [0, 0, -1], spread(-xi + 100, xi - 100, 3).map((x): Vec3 => [x, postH - topRail + 12, zb + 20]), undefined, { len: 12, dia: 20 }),
      at("clip", "bp", [0, 0, -1], spread(-xi + 100, xi - 100, 3).map((x): Vec3 => [x, legH + plinth - 12, zb + 20]), undefined, { len: 12, dia: 20 }),
      at("screw", "fx", [0, 1, 0], spread(-xi + 100, xi - 100, 3).map((x): Vec3 => [x, midY - 10, zb + 34]), undefined, { len: 12, dia: 3.5 }),
      at("screw", "bt", [0, 0, -1], spread(-xi + 100, xi - 100, 3).map((x): Vec3 => [x, postH - topRail + 12, zb + 20]), undefined, { len: 12, dia: 3.5 }),
      at("screw", "bp", [0, 0, -1], spread(-xi + 100, xi - 100, 3).map((x): Vec3 => [x, legH + plinth - 12, zb + 20]), undefined, { len: 12, dia: 3.5 }),
    ],
    tools: ["screwdriver"],
    pose: "-z",
  });
  r.step({ title: "Stand it up and level the feet", detail: "Two people. Turn the adjustable feet until it stands steady and leans slightly to the wall.", people: 2, pose: "+y", kind: "standup", warnings: ["two"] });
  r.step({
    title: "Fix it to the wall",
    detail: "Two L brackets on top, one screw each into the top rail. Wall screws aren't included: pick ones made for your wall, with a washer.",
    fix: [
      at("angle", "bt", [0, -1, 0], [[-xi / 2, H, zb + 20], [xi / 2, H, zb + 20]], undefined, { len: 80, dia: 40 }),
      at("screw", "bt", [0, -1, 0], [[-xi / 2, H + 2, zb + 30], [xi / 2, H + 2, zb + 30]], undefined, { len: 12, dia: 3.5 }),
      at("washer", "bt", [0, 0, -1], [[-xi / 2, H + 40, zb - 2], [xi / 2, H + 40, zb - 2], [-xi / 2, H + 60, zb - 2], [xi / 2, H + 60, zb - 2]]),
    ],
    wall: true,
    tools: ["screwdriver", "drill"],
    warnings: ["wall", "tip"],
  });
  r.step({
    title: "Lay in the bottom shelf",
    detail: "Push four shelf plugs into the posts above the plinths, then drop the shelf onto them.",
    add: ["bs"],
    fix: [at("pin", "pfL", [-1, 0, 0], [[-xi, legH + plinth - 4, zpf - 30]], undefined, { len: 10, dia: 8 }), at("pin", "pbL", [-1, 0, 0], [[-xi, legH + plinth - 4, zpb + 30]], undefined, { len: 10, dia: 8 }), at("pin", "pfR", [1, 0, 0], [[xi, legH + plinth - 4, zpf - 30]], undefined, { len: 10, dia: 8 }), at("pin", "pbR", [1, 0, 0], [[xi, legH + plinth - 4, zpb + 30]], undefined, { len: 10, dia: 8 })],
  });
  r.step({
    title: "Push in the shelf pins",
    detail: "For each shelf, plugs in the two front posts and supports in the two back posts, at the heights you want.",
    fix: [
      at("pin", "pfL", [-1, 0, 0], shelfYs.map((y): Vec3 => [-xi, y - 13, zpf - 30]), undefined, { len: 10, dia: 8 }),
      at("pin", "pfR", [1, 0, 0], shelfYs.map((y): Vec3 => [xi, y - 13, zpf - 30]), undefined, { len: 10, dia: 8 }),
      at("pin", "pbL", [-1, 0, 0], shelfYs.map((y): Vec3 => [-xi, y - 13, zpb + 30]), undefined, { len: 16, dia: 5 }),
      at("pin", "pbR", [1, 0, 0], shelfYs.map((y): Vec3 => [xi, y - 13, zpb + 30]), undefined, { len: 16, dia: 5 }),
    ],
  });
  r.step({ title: "Lay in the shelves", detail: "Tilt each one in, then lower it onto its four supports.", add: shelfYs.map((_, i) => `sh${i}`) });
  return r.get();
}

/* ---------- ladder-sided pieces: bench, shelf unit ---------- */

interface Ladder {
  r: Recipe;
  xp: number;
  xi: number;
  zpf: number;
  zpb: number;
  zm: number;
  P: number;
  postH: number;
  g: (L: string) => number;
  side: (L: string) => string[];
  /** cam bolts in the posts, dowels in the side rail ends, cam locks in the side rails */
  prep: (L: string) => CustomFix[];
  locks: (L: string) => CustomFix[];
}

/** Two sides, each two posts with side rails between them on cam bolts, dowels and cam locks. */
function ladders(o: { W: number; D: number; postH: number; P: number; ov: number; rails: { y: number; h: number }[] }): Ladder {
  const r = new Recipe();
  const { P, postH } = o;
  const xo = o.W / 2 - o.ov, xp = xo - P / 2, xi = xo - P;
  const zpf = o.D / 2 - o.ov - P / 2, zpb = -o.D / 2 + o.ov + P / 2, zm = (zpf + zpb) / 2;
  const g = (L: string) => (L === "L" ? -1 : 1);
  for (const L of ["L", "R"]) {
    r.part(`pf${L}`, "Post", [P, postH, P], [g(L) * xp, postH / 2, zpf], { material: "wood" });
    r.part(`pb${L}`, "Post", [P, postH, P], [g(L) * xp, postH / 2, zpb], { material: "wood" });
    o.rails.forEach((q, i) => r.part(`s${i}${L}`, "Side rail", [P - 15, q.h, zpf - zpb - P], [g(L) * xp, q.y, zm], { material: "wood" }));
  }
  const side = (L: string) => [`pf${L}`, `pb${L}`, ...o.rails.map((_, i) => `s${i}${L}`)];
  const prep = (L: string) => [
    at("camScrew", `pf${L}`, [0, 0, 1], o.rails.map((q): Vec3 => [g(L) * xp, q.y, zpf - P / 2]), undefined, { len: 34 }),
    at("camScrew", `pb${L}`, [0, 0, -1], o.rails.map((q): Vec3 => [g(L) * xp, q.y, zpb + P / 2]), undefined, { len: 34 }),
    ...o.rails.map((q, i) => at("dowel", `s${i}${L}`, [0, 0, -1], [[g(L) * xp, q.y + q.h / 4, zpf - P / 2]], `pf${L}`, sized(DRAWER_DOWEL))),
    ...o.rails.map((q, i) => at("dowel", `s${i}${L}`, [0, 0, 1], [[g(L) * xp, q.y + q.h / 4, zpb + P / 2]], `pb${L}`, sized(DRAWER_DOWEL))),
  ];
  const locks = (L: string) => [at("cam", undefined, [-g(L), 0, 0], o.rails.flatMap((q): Vec3[] => [[g(L) * (xi + 0), q.y - q.h / 4, zpf - P / 2 - 28], [g(L) * xi, q.y - q.h / 4, zpb + P / 2 + 28]]), undefined, { dia: 15 })];
  return { r, xp, xi, zpf, zpb, zm, P, postH, g, side, prep, locks };
}

/** On the rug: the side rails push into the front post along their dowels, then the back post goes on. */
function ladderFrom(l: Ladder): Record<string, Vec3> {
  const o: Record<string, Vec3> = { pfL: [0, 0, 260], pbL: [0, 0, -420] };
  for (const k of l.side("L")) if (!k.startsWith("p")) o[k] = [0, 0, -260];
  return o;
}

/** Something joined between the two sides: cam bolts in the posts (or side rails), a dowel and a cam lock at each end. */
function between(l: Ladder, L: string, id: string, pts: Vec3[], camUp = true): CustomFix[] {
  const g = l.g(L);
  return [
    at("dowel", id, [-g, 0, 0], pts.map((p): Vec3 => [g * l.xi, p[1] + 10, p[2] + 8]), undefined, sized(DRAWER_DOWEL)),
  ].concat(camUp ? [] : []);
}
const betweenBolts = (l: Ladder, L: string, pts: Vec3[]) => at("camScrew", undefined, [l.g(L), 0, 0], pts.map((p): Vec3 => [l.g(L) * l.xi, p[1] - 8, p[2] - 8]), undefined, { len: 34 });
const betweenCams = (l: Ladder, L: string, pts: Vec3[], dir: Vec3 = [0, -1, 0], dy = 20) => at("cam", undefined, dir, pts.map((p): Vec3 => [l.g(L) * (l.xi - 26), p[1] + dy, p[2] - 8]), undefined, { dia: 15 });

function slatted(id: string, name: string, w: number, d: number, pos: Vec3, n?: number): CustomPart {
  const slats = n ?? Math.max(5, Math.round(w / 70));
  return {
    id,
    name,
    size: [w, 22, d],
    pos,
    material: "wood",
    pieces: [
      { shape: "box", size: [w, 22, 30], pos: [0, 0, -d / 2 + 15] },
      { shape: "box", size: [w, 22, 30], pos: [0, 0, d / 2 - 15] },
      ...range(slats).map((i) => ({ shape: "box" as const, size: [40, 16, d - 60] as Vec3, pos: [-w / 2 + 20 + (i * (w - 40)) / (slats - 1), 3, 0] as Vec3 })),
    ],
  };
}

/*
 * Bench 83: two ladders (posts, two side rails on cam bolts and dowels), the left one lies down while the two top
 * rails and the slatted shelf stand in it, the right one goes on, then the top sits on dowels and is screwed from
 * below with the bench upside down. Four adjustable feet.
 */
function bench(s: ProductSpec): CustomParams | null {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const topT = 25, P = 45, postH = H - topT;
  const l = ladders({ W, D, postH, P, ov: 20, rails: [{ y: postH - 40, h: 70 }, { y: 160, h: 50 }] });
  const { r, xi, zpf, zpb, zm } = l;
  r.part("rf", "Top rail", [2 * xi, 70, 22], [0, postH - 35, zpf + P / 2 - 11], { material: "wood" });
  r.part("rb", "Top rail", [2 * xi, 70, 22], [0, postH - 35, zpb - P / 2 + 11], { material: "wood" });
  r.parts.push(slatted("sh", "Slatted shelf", 2 * xi, zpf - zpb - P, [0, 185 + 11, zm]));
  r.part("top", "Top", [W, topT, D], [0, H - topT / 2, 0], { material: "wood" });
  const railPts: Vec3[] = [[0, postH - 35, zpf + P / 2 - 11], [0, postH - 35, zpb - P / 2 + 11]];
  const shPts: Vec3[] = [[0, 196, zm]];
  r.step({ title: "Put the two side ladders together", detail: "Do both on a rug: cam bolts in the posts, dowels in the side rails, press them together and lock the cam locks.", add: l.side("L"), fix: [...l.prep("L"), ...l.locks("L")], from: ladderFrom(l), tools: ["screwdriver", "hammer"], pose: "+x", repeat: 2, warnings: ["floor"] });
  r.step({ title: "Stand the top rails in the left side", detail: "Cam bolts in the posts, a dowel in each rail end, then push them on and lock.", add: ["rf", "rb"], fix: [betweenBolts(l, "L", railPts), ...between(l, "L", "rf", [railPts[0]]), ...between(l, "L", "rb", [railPts[1]]), betweenCams(l, "L", railPts, [0, 0, 1], 0)], tools: ["screwdriver", "hammer"], pose: "+x" });
  r.step({ title: "Stand the slatted shelf in", detail: "On its dowels and cam bolts, then lock both cam locks.", add: ["sh"], fix: [betweenBolts(l, "L", [[0, 160, zm - 60], [0, 160, zm + 60]]), ...between(l, "L", "sh", [[0, 170, zm - 60], [0, 170, zm + 60]]), betweenCams(l, "L", [[0, 160, zm - 60], [0, 160, zm + 60]], [0, -1, 0], 40)], tools: ["screwdriver", "hammer"], pose: "+x" });
  r.step({
    title: "Lower the right side on",
    detail: "Put together like the left one. Dowels in the free ends, press it on and lock the four cam locks.",
    add: l.side("R"),
    from: Object.fromEntries(l.side("R").map((k) => [k, [300, 0, 0] as Vec3])),
    fix: [...l.prep("R"), ...l.locks("R"), betweenBolts(l, "R", [...railPts, [0, 160, zm - 60], [0, 160, zm + 60]]), ...between(l, "R", "rf", [railPts[0]]), ...between(l, "R", "rb", [railPts[1]]), ...between(l, "R", "sh", [[0, 170, zm - 60], [0, 170, zm + 60]]), betweenCams(l, "R", [...railPts, [0, 160, zm - 60], [0, 160, zm + 60]], [0, -1, 0], 20)],
    tools: ["screwdriver", "hammer"],
    pose: "+x",
  });
  r.step({
    title: "Stand it up and lay the top on",
    detail: "Tap eight dowels into the tops of the posts and rails, then press the top onto them.",
    add: ["top"],
    fix: [at("dowel", undefined, [0, -1, 0], [[-l.xp, postH, zpf], [l.xp, postH, zpf], [-l.xp, postH, zpb], [l.xp, postH, zpb], [-xi / 2, postH, zpf + P / 2 - 11], [xi / 2, postH, zpf + P / 2 - 11], [-xi / 2, postH, zpb - P / 2 + 11], [xi / 2, postH, zpb - P / 2 + 11]], "top", sized(DRAWER_DOWEL))],
    tools: ["hammer"],
    pose: "+y",
  });
  r.step({
    title: "Turn it over and screw the top on",
    detail: "Upside down on a rug. Ten screws up through the rails into the top.",
    fix: [at("screw", undefined, [0, 1, 0], [...spread(-xi + 80, xi - 80, 3).flatMap((x): Vec3[] => [[x, postH - 70, zpf + P / 2 - 11], [x, postH - 70, zpb - P / 2 + 11]]), [-l.xp, postH - 70, zm - 60], [-l.xp, postH - 70, zm + 60], [l.xp, postH - 70, zm - 60], [l.xp, postH - 70, zm + 60]], "top", { len: 40, dia: 4 })],
    tools: ["screwdriver"],
    pose: "-y",
    warnings: ["face"],
  });
  r.step({ title: "Screw in the feet", detail: "One adjustable foot under each post. Turn them until it stands steady.", fix: [at("foot", undefined, [0, 1, 0], [[-l.xp, 0, zpf], [l.xp, 0, zpf], [-l.xp, 0, zpb], [l.xp, 0, zpb]])], pose: "-y", kind: "legs" });
  return r.get();
}

/*
 * Shelf unit 42 x 172: the same ladders with three side rails, the two slatted shelves stand in the left one, the
 * right one goes on, the top goes on with dowels and screws, then four feet, the wall fixing and the shelves on pins.
 */
function shelfUnit(s: ProductSpec): CustomParams | null {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const topT = 20, P = 40, postH = H - topT;
  const l = ladders({ W, D, postH, P, ov: 10, rails: [{ y: postH - 30, h: 60 }, { y: Math.round(postH * 0.45), h: 40 }, { y: 140, h: 50 }] });
  const { r, xi, xp, zpf, zpb, zm } = l;
  const fixY = Math.round(postH * 0.45) + 20;
  r.parts.push(slatted("sb", "Slatted shelf", 2 * xi, zpf - zpb - P, [0, 165 + 11, zm], 6));
  r.parts.push(slatted("sm", "Slatted shelf", 2 * xi, zpf - zpb - P, [0, fixY + 11, zm], 6));
  r.part("rf", "Top rail", [2 * xi, 60, 20], [0, postH - 30, zpf + P / 2 - 10], { material: "wood" });
  r.part("rb", "Top rail", [2 * xi, 60, 20], [0, postH - 30, zpb - P / 2 + 10], { material: "wood" });
  r.part("top", "Top", [W, topT, D], [0, H - topT / 2, 0]);
  const shelfYs = [Math.round(fixY + (postH - 60 - fixY) / 3), Math.round(fixY + (2 * (postH - 60 - fixY)) / 3)];
  shelfYs.forEach((y, i) => r.part(`sh${i}`, "Shelf", [2 * xi - 4, 18, zpf - zpb - P], [0, y, zm]));
  const ends = (y: number): Vec3[] => [[0, y, zm - 50], [0, y, zm + 50]];
  r.step({ title: "Put the two side ladders together", detail: "Do both on a rug: cam bolts in the posts, dowels in the rails, press them together and lock the cam locks.", add: l.side("L"), fix: [...l.prep("L"), ...l.locks("L")], from: ladderFrom(l), tools: ["screwdriver", "hammer"], pose: "+x", repeat: 2, warnings: ["floor"] });
  r.step({ title: "Stand the top rails in the left side", detail: "On their dowels and cam bolts, then lock.", add: ["rf", "rb"], fix: [betweenBolts(l, "L", [[0, postH - 30, zpf + P / 2 - 10], [0, postH - 30, zpb - P / 2 + 10]]), ...between(l, "L", "rf", [[0, postH - 30, zpf + P / 2 - 10]]), ...between(l, "L", "rb", [[0, postH - 30, zpb - P / 2 + 10]]), betweenCams(l, "L", [[0, postH - 30, zpf + P / 2 - 10], [0, postH - 30, zpb - P / 2 + 10]], [0, 0, 1], 0)], tools: ["screwdriver", "hammer"], pose: "+x" });
  r.step({ title: "Tap the slats into the slatted shelves", detail: "Small dowels into both ends of every slat, then press the slats into the frames.", fix: [at("dowel", "sb", [0, 0, 1], range(20).map((i): Vec3 => [-xi + 20 + ((i % 10) * (2 * xi - 40)) / 9, 176, i < 10 ? zm - 120 : zm + 120]), undefined, { len: 20, dia: 5 }), at("dowel", "sm", [0, 0, 1], range(20).map((i): Vec3 => [-xi + 20 + ((i % 10) * (2 * xi - 40)) / 9, fixY + 11, i < 10 ? zm - 120 : zm + 120]), undefined, { len: 20, dia: 5 })], tools: ["hammer"], pose: "+x" });
  r.step({ title: "Stand the slatted shelves in", detail: "Two dowels and two cam bolts each, then lock them.", add: ["sb", "sm"], fix: [betweenBolts(l, "L", [...ends(165), ...ends(fixY)]), ...between(l, "L", "sb", ends(165)), ...between(l, "L", "sm", ends(fixY)), betweenCams(l, "L", [...ends(165), ...ends(fixY)], [0, -1, 0], 30)], tools: ["screwdriver", "hammer"], pose: "+x" });
  r.step({
    title: "Lower the right side on",
    detail: "Put together like the left one. Six dowels in the free ends, press it on, then lock the six cam locks.",
    add: l.side("R"),
    from: Object.fromEntries(l.side("R").map((k) => [k, [300, 0, 0] as Vec3])),
    fix: [...l.prep("R"), ...l.locks("R"), betweenBolts(l, "R", [[0, postH - 30, zpf + P / 2 - 10], [0, postH - 30, zpb - P / 2 + 10], ...ends(165), ...ends(fixY)]), ...between(l, "R", "rf", [[0, postH - 30, zpf + P / 2 - 10]]), ...between(l, "R", "rb", [[0, postH - 30, zpb - P / 2 + 10]]), ...between(l, "R", "sb", ends(165)), ...between(l, "R", "sm", ends(fixY)), betweenCams(l, "R", [[0, postH - 30, zpf + P / 2 - 10], [0, postH - 30, zpb - P / 2 + 10], ...ends(165), ...ends(fixY)], [0, -1, 0], 25)],
    tools: ["screwdriver", "hammer"],
    pose: "+x",
  });
  r.step({
    title: "Put the top on",
    detail: "Turn it onto its back. Five dowels into the top ends, press the top on, then six screws up through the rails.",
    add: ["top"],
    fix: [
      at("dowel", undefined, [0, -1, 0], [[-xp, postH, zpf], [xp, postH, zpf], [-xp, postH, zpb], [xp, postH, zpb], [0, postH, zpf + P / 2 - 10]], "top", sized(DRAWER_DOWEL)),
      at("screw", undefined, [0, 1, 0], [[-xi / 2, postH - 60, zpf + P / 2 - 10], [xi / 2, postH - 60, zpf + P / 2 - 10], [-xi / 2, postH - 60, zpb - P / 2 + 10], [xi / 2, postH - 60, zpb - P / 2 + 10], [-xp, postH - 60, zm], [xp, postH - 60, zm]], "top", { len: 50, dia: 4 }),
    ],
    tools: ["hammer", "screwdriver"],
    pose: "+z",
  });
  r.step({ title: "Screw in the feet and stand it up", detail: "One adjustable foot in each post. Turn them until it stands straight.", fix: [at("foot", undefined, [0, 1, 0], [[-xp, 0, zpf], [xp, 0, zpf], [-xp, 0, zpb], [xp, 0, zpb]])], pose: "+y", kind: "legs" });
  r.step({ title: "Fix it to the wall", detail: "Two screws through the back top rail into the wall. They aren't included: pick ones made for your wall.", fix: [at("screw", "rb", [0, 0, -1], [[-xi / 2, postH - 30, zpb - P / 2], [xi / 2, postH - 30, zpb - P / 2]], undefined, { len: 50, dia: 5 })], wall: true, tools: ["drill", "screwdriver"], warnings: ["wall", "tip"] });
  r.step({
    title: "Put the shelves in on their pins",
    detail: "Four pins for each shelf, at the height you want, then lay the shelf on.",
    add: shelfYs.map((_, i) => `sh${i}`),
    fix: [at("pin", undefined, [1, 0, 0], shelfYs.flatMap((y): Vec3[] => [[-xi, y - 13, zpf - 25], [-xi, y - 13, zpb + 25], [xi, y - 13, zpf - 25], [xi, y - 13, zpb + 25]]), undefined, { len: 16, dia: 5 })],
  });
  return r.get();
}

/*
 * Hat rack 85: built upside down on a table. Two screws go half into the shelf frame and the consoles hook over
 * them, the two uprights stand on dowels and long screws, the eye bolts for the rail go into the consoles, the peg
 * board slides in on dowels, the wall plates are bolted to the uprights, then the rail, its end knobs and the six
 * pegs. It hangs on two wall screws (not included), 806 mm apart, locked with two more screws.
 */
function hatRack(s: ProductSpec): CustomParams | null {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const r = new Recipe();
  const ft = 30, zb = -D / 2;
  const ux = W / 2 - 30, cx = W / 2 - 80;
  r.part("fr", "Shelf frame", [W, ft, D], [0, H - ft / 2, 0], {
    material: "wood",
    pieces: [
      { shape: "box", size: [W, ft, 40], pos: [0, 0, D / 2 - 20] },
      { shape: "box", size: [W, ft, 40], pos: [0, 0, -D / 2 + 20] },
      { shape: "box", size: [40, ft, D - 80], pos: [-W / 2 + 20, 0, 0] },
      { shape: "box", size: [40, ft, D - 80], pos: [W / 2 - 20, 0, 0] },
      { shape: "box", size: [W - 80, 14, D - 80], pos: [0, -8, 0] },
    ],
  });
  for (const g of [-1, 1]) {
    r.part(g < 0 ? "uL" : "uR", "Upright", [40, H - ft, 22], [g * ux, (H - ft) / 2, zb + 11], { material: "wood" });
    r.part(g < 0 ? "cL" : "cR", "Console", [24, 200, 180], [g * cx, H - ft - 100, zb + 22 + 90], {
      material: "metal",
      pieces: [
        { shape: "box", size: [24, 24, 180], pos: [0, 88, 0] },
        { shape: "box", size: [24, 200, 24], pos: [0, 0, -78] },
        { shape: "box", size: [24, 24, 120], pos: [0, -40, -20], rot: [-0.7, 0, 0] },
      ],
    });
  }
  const pbH = 160;
  r.part("pb", "Peg board", [2 * ux - 40, pbH, 18], [0, pbH / 2, zb + 11], { material: "wood" });
  const rodY = H - ft - 130, rodZ = zb + 150;
  r.part("rod", "Rail", [2 * cx + 60, 20, 20], [0, rodY, rodZ], { shape: "cyl", material: "metal" });
  r.step({ title: "Screw two screws half into the shelf frame", detail: "Lay it upside down on a table, on something soft. Leave 6 mm sticking out: the consoles hook over them.", add: ["fr"], fix: [at("screw", "fr", [0, 1, 0], [[-cx, H - ft, zb + 150], [cx, H - ft, zb + 150]], undefined, { len: 16, dia: 4 })], tools: ["screwdriver"], pose: "-y", warnings: ["face"] });
  r.step({ title: "Hook the consoles on and screw them tight", detail: "Slide each one along until it locks, then two screws each.", add: ["cL", "cR"], fix: [at("screw", undefined, [0, 1, 0], [[-cx, H - ft - 3, zb + 60], [-cx, H - ft - 3, zb + 90], [cx, H - ft - 3, zb + 60], [cx, H - ft - 3, zb + 90]], undefined, { len: 14, dia: 4 })], tools: ["screwdriver"], pose: "-y" });
  r.step({ title: "Stand the uprights on the frame", detail: "Two dowels, then a long screw through the frame into each upright.", add: ["uL", "uR"], fix: [at("dowel", undefined, [0, -1, 0], [[-ux, H - ft, zb + 6], [ux, H - ft, zb + 6]], "fr", sized(DOWEL)), at("screw", "fr", [0, -1, 0], [[-ux, H, zb + 14], [ux, H, zb + 14]], undefined, { len: 70, dia: 6 })], tools: ["hammer", "allen"], pose: "-y" });
  r.step({ title: "Screw the eye bolts into the consoles", detail: "With the barrel nuts. The rail runs through the two eyes.", fix: [at("clip", undefined, [0, 1, 0], [[-cx, rodY - 15, rodZ], [cx, rodY - 15, rodZ]], undefined, { len: 40, dia: 22 })], tools: ["allen"], pose: "-y" });
  r.step({ title: "Slide in the peg board", detail: "Two dowels into each end, then push it between the uprights at the bottom.", add: ["pb"], fix: [at("dowel", "pb", [1, 0, 0], [[-ux + 20, pbH * 0.3, zb + 11], [-ux + 20, pbH * 0.7, zb + 11]], undefined, sized(DRAWER_DOWEL)), at("dowel", "pb", [-1, 0, 0], [[ux - 20, pbH * 0.3, zb + 11], [ux - 20, pbH * 0.7, zb + 11]], undefined, sized(DRAWER_DOWEL))], tools: ["hammer"], pose: "-y" });
  r.step({ title: "Bolt the wall plates to the uprights", detail: "On the back of each upright, a bolt and a barrel nut each, then two screws.", fix: [at("bracket", undefined, [0, 0, 1], [[-ux, H - ft - 60, zb], [ux, H - ft - 60, zb]], undefined, { len: 60, dia: 30 }), at("bolt", undefined, [0, 0, 1], [[-ux, H - ft - 50, zb - 2], [ux, H - ft - 50, zb - 2]], undefined, { len: 60, dia: 6 }), at("screw", undefined, [0, 0, 1], [[-ux, 40, zb - 2], [ux, 40, zb - 2]], undefined, { len: 30, dia: 4 })], tools: ["allen", "screwdriver"], pose: "-y" });
  r.step({ title: "Push the rail through and fit its knobs", detail: "Turn it the right way up. A knob screws onto each end of the rail.", add: ["rod"], fix: [at("knob", "rod", [1, 0, 0], [[-cx - 30, rodY, rodZ]]), at("knob", "rod", [-1, 0, 0], [[cx + 30, rodY, rodZ]])], pose: "+y" });
  r.step({ title: "Screw in the six pegs", detail: "Evenly along the peg board, by hand.", fix: [at("knob", "pb", [0, 0, -1], spread(-ux + 70, ux - 70, 6).map((x): Vec3 => [x, pbH / 2, zb + 20]))], pose: "+y" });
  r.step({
    title: "Hang it on the wall",
    detail: "Mark two holes 806 mm apart with a level, drive in screws made for your wall (not included), hang the plates on them and lock with two screws through the uprights.",
    fix: [at("screw", undefined, [0, 0, -1], [[-ux, H - ft - 60, zb - 4], [ux, H - ft - 60, zb - 4]], undefined, { len: 50, dia: 5 }), at("screw", undefined, [0, 0, -1], [[-ux, 40, zb + 22], [ux, 40, zb + 22]], undefined, { len: 50, dia: 4.5 })],
    wall: true,
    tools: ["drill", "level", "pencil", "screwdriver"],
    warnings: ["wall"],
  });
  return r.get();
}

/*
 * Mirror cabinets 63 and 83 (white): a board carcass built lying on its back. Cam bolts go into the left side, the
 * bottom and the fixed shelf go on with dowels and cam locks, the top on dowels, then the right side is screwed on
 * with long screws. The back slides into the grooves (two halves on the wide one), the crown is screwed on top, clips
 * hold the back, and the hanging brackets go in. It hangs on two wall plates; the mirror doors click onto their
 * hinges, then the glass shelves go in on pins.
 */
function mirrorCabinet(s: ProductSpec): CustomParams | null {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  if (W > 1000) return null; // the 120 one has its own manual, not checked
  const doors = /2 doors/i.test(s.variant) ? 2 : 1;
  const r = new Recipe();
  const t = 18, crownH = 40, crownOv = 12;
  const W0 = W - 2 * crownOv, D0 = D - crownOv;
  const bodyH = H - crownH;
  const xs = W0 / 2 - t / 2, xi = W0 / 2 - t;
  const zb = -D / 2, zf = zb + D0 - 20; // the doors sit in front
  const sideD = zf - zb, zc = (zf + zb) / 2;
  const nicheH = 170;
  r.part("sL", "Side", [t, bodyH, sideD], [-xs, bodyH / 2, zc]);
  r.part("sR", "Side", [t, bodyH, sideD], [xs, bodyH / 2, zc]);
  r.part("bot", "Bottom", [2 * xi, t, sideD], [0, t / 2, zc]);
  r.part("fx", "Fixed shelf", [2 * xi, t, sideD], [0, nicheH, zc]);
  r.part("top", "Top", [2 * xi, t, sideD], [0, bodyH - t / 2, zc]);
  r.part("cr", "Crown", [W, crownH, D], [0, H - crownH / 2, 0], { material: "wood" });
  const bkW = doors === 2 ? xi + 4 : 2 * xi + 8;
  const backs = doors === 2 ? ["bk1", "bk2"] : ["bk1"];
  backs.forEach((id, i) => r.part(id, "Back panel", [bkW, bodyH - nicheH - t, 4], [doors === 2 ? (i ? 1 : -1) * (xi / 2) : 0, nicheH + (bodyH - nicheH - t) / 2, zb + 8], { material: "fiber" }));
  const dw = (2 * xi + 2 * t) / doors - 3, dh = bodyH - nicheH - 6;
  const doorIds = range(doors).map((i) => `d${i}`);
  doorIds.forEach((id, i) => r.part(id, "Mirror door", [dw, dh, 22], [doors === 2 ? (i ? 1 : -1) * (dw / 2 + 1.5) : 0, nicheH + 3 + dh / 2, zf + 11], { material: "board" }));
  const shelfYs = spread(nicheH + 200, bodyH - 200, 3).map(Math.round);
  shelfYs.forEach((y, i) => r.part(`g${i}`, "Glass shelf", [2 * xi - 6, 6, sideD - 30], [0, y, zc + 5], { material: "metal" }));
  const zj = [zc - sideD / 4, zc + sideD / 4];
  const zt = [zc - 45, zc + 45]; // the top's dowels, clear of its two screws
  const hingeYs = [nicheH + 90, bodyH - 90];
  const hingeSides = doors === 2 ? [-1, 1] : [1];
  const plates = at("hinge", undefined, [0, 0, -1], hingeSides.flatMap((g) => hingeYs.map((y): Vec3 => [g * (xi - 18), y, zf - 30])), undefined, { len: 50, dia: 35 });
  r.step({ title: "Screw the cam bolts into the left side", detail: "Lay it on a rug, inside up. Four bolts, by hand until they stop.", add: ["sL"], fix: [at("camScrew", "sL", [-1, 0, 0], [...zj.map((z): Vec3 => [-xi, t / 2, z]), ...zj.map((z): Vec3 => [-xi, nicheH, z])], undefined, { len: 34 })], tools: ["screwdriver"], pose: "+z", warnings: ["floor"] });
  r.step({ title: doors === 2 ? "Screw on the hinge plates" : "Screw the hinge plates onto the right side", detail: "Two on each side the doors hang from, at the front edge.", fix: [plates], tools: ["screwdriver"], pose: "+z" });
  r.step({ title: "Fit the bottom and the fixed shelf", detail: "Tap the dowels in, push them onto the left side and lock the four cam locks.", add: ["bot", "fx"], fix: [at("dowel", undefined, [1, 0, 0], [[-xi, t / 2, zc - 30], [-xi, t / 2, zc + 30], [-xi, nicheH, zc - 30], [-xi, nicheH, zc + 30]], undefined, sized(DOWEL)), at("cam", undefined, [0, 1, 0], [...zj.map((z): Vec3 => [-xi + 26, t, z]), ...zj.map((z): Vec3 => [-xi + 26, nicheH + t / 2, z])], undefined, { dia: 15 })], tools: ["hammer", "screwdriver"], pose: "+z" });
  r.step({ title: "Push the top on", detail: "Six dowels: two into each end of the top and one into the free end of the bottom and the shelf.", add: ["top"], fix: [at("dowel", undefined, [1, 0, 0], [[-xi, bodyH - t / 2, zt[0]], [-xi, bodyH - t / 2, zt[1]]], undefined, sized(DOWEL)), at("dowel", undefined, [-1, 0, 0], [[xi, bodyH - t / 2, zt[0]], [xi, bodyH - t / 2, zt[1]], [xi, t / 2, zc - 40], [xi, nicheH, zc - 40]], undefined, sized(DOWEL))], tools: ["hammer"], pose: "+z" });
  r.step({ title: "Screw the right side on", detail: "Four long screws through the side into the bottom, the shelf and the top, with the Allen key.", add: ["sR"], fix: [at("screw", "sR", [-1, 0, 0], [[W0 / 2, t / 2, zc + 10], [W0 / 2, nicheH, zc + 10], [W0 / 2, bodyH - t / 2, zc - 12], [W0 / 2, bodyH - t / 2, zc + 12]], undefined, sized(TOP_SCREW))], tools: ["allen"], pose: "+z" });
  r.step({ title: doors === 2 ? "Slide in the two back panels" : "Slide in the back panel", detail: "Into the grooves from the top, smooth side in.", add: backs, pose: "+z", from: Object.fromEntries(backs.map((id) => [id, [0, 400, 0] as Vec3])) });
  r.step({ title: "Screw the crown on top", detail: "Five long screws up through the top.", add: ["cr"], fix: [at("screw", "top", [0, 1, 0], spread(-xi + 50, xi - 50, 5).map((x): Vec3 => [x, bodyH - t, zc]), "cr", sized(TOP_SCREW))], tools: ["allen"], pose: "+z" });
  r.step({ title: "Clip the back in place", detail: "Turn it onto its front. Four clips hold the back to the fixed shelf.", fix: [at("clip", "fx", [0, 0, 1], spread(-xi + 60, xi - 60, 4).map((x): Vec3 => [x, nicheH + t / 2, zb + 10]), undefined, { len: 12, dia: 20 })], pose: "-z" });
  r.step({ title: "Screw in the hanging brackets", detail: "One in each top back corner, two screws each.", fix: [at("angle", undefined, [0, 1, 0], [[-xi + 30, bodyH - t, zb + 30], [xi - 30, bodyH - t, zb + 30]], undefined, { len: 60, dia: 45 }), at("screw", undefined, [0, 1, 0], [[-xi + 20, bodyH - t, zb + 40], [-xi + 40, bodyH - t, zb + 40], [xi - 20, bodyH - t, zb + 40], [xi - 40, bodyH - t, zb + 40]], undefined, { len: 14, dia: 4 })], tools: ["screwdriver"], pose: "-z" });
  r.step({
    title: "Hang it on the wall",
    detail: "Screw the two wall plates on level, with screws made for your wall (not included). Hang the brackets on them and turn the screws until it hangs straight.",
    fix: [at("bracket", undefined, [0, 0, -1], [[-xi + 30, bodyH - 40, zb - 2], [xi - 30, bodyH - 40, zb - 2]], undefined, { len: 40, dia: 30 })],
    wall: true,
    pose: "+y",
    tools: ["drill", "level", "pencil", "screwdriver"],
    warnings: ["wall"],
  });
  r.step({ title: doors === 2 ? "Click the doors on" : "Click the door on", detail: "Screw the hinges into the cups on the door, then click each hinge onto its plate.", add: doorIds, fix: [at("screw", undefined, [0, 0, -1], doorIds.flatMap((_, i) => hingeYs.map((y): Vec3 => [(doors === 2 ? (i ? 1 : -1) : 1) * (xi - 10), y, zf]))), ...[]], tools: ["screwdriver"] });
  r.step({ title: "Push in the shelf pins and lay in the glass shelves", detail: "A sleeve and a pin in each corner of each shelf. Lay the glass in gently.", add: shelfYs.map((_, i) => `g${i}`), fix: [
    at("pin", undefined, [1, 0, 0], shelfYs.flatMap((y): Vec3[] => [[-xi, y - 5, zc - 40], [-xi, y - 5, zc + 50], [xi, y - 5, zc - 40], [xi, y - 5, zc + 50]]), undefined, { len: 10, dia: 8 }),
    at("pin", undefined, [1, 0, 0], shelfYs.flatMap((y): Vec3[] => [[-xi + 2, y - 4, zc - 40], [-xi + 2, y - 4, zc + 50], [xi - 2, y - 4, zc - 40], [xi - 2, y - 4, zc + 50]]), undefined, { len: 16, dia: 5 }),
  ] });
  r.step({ title: "Stick on the door bumpers", detail: "Little pads inside the sides where the doors close.", fix: [at("glide", undefined, [0, 0, -1], (doors === 2 ? [-1, 1, 1] : [-1, -1]).map((g, i): Vec3 => [g * (xi + t / 2), nicheH + 100 + i * 300, zf]), undefined, { len: 3, dia: 10 })] });
  return r.get();
}

/*
 * Bedside table 46 x 35 (one drawer and a shelf): each side is two legs and a side rail with the drawer runner screwed
 * on. The left side lies down, the back panel and the front rail stand in it on dowels, the shelf on cam bolts, the
 * right side goes on, then felt pads, and the top on dowels and cam locks. The drawer is built on its back, screwed
 * together at the front, and slides onto the runners with two stop screws.
 */
function bedside(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const r = new Recipe();
  const topT = 18, P = 38, ov = 20, postH = H - topT;
  const xo = W / 2 - ov, xp = xo - P / 2, xi = xo - P;
  const zpf = D / 2 - ov - P / 2, zpb = -D / 2 + 5 + P / 2, zm = (zpf + zpb) / 2;
  const apron = 130, shelfY = 170;
  const g = (L: string) => (L === "L" ? -1 : 1);
  for (const L of ["L", "R"]) {
    r.part(`lf${L}`, "Leg", [P, postH, P], [g(L) * xp, postH / 2, zpf], { material: "wood" });
    r.part(`lb${L}`, "Leg", [P, postH, P], [g(L) * xp, postH / 2, zpb], { material: "wood" });
    r.part(`sr${L}`, "Side rail", [18, apron, zpf - zpb - P], [g(L) * (xo - 12), postH - apron / 2, zm], { material: "wood" });
  }
  r.part("bk", "Back panel", [2 * xi, apron, 18], [0, postH - apron / 2, zpb - P / 2 + 9]);
  r.part("fr", "Front rail", [2 * xi, 25, 30], [0, postH - apron + 12, zpf + P / 2 - 15], { material: "wood" });
  r.part("sh", "Shelf", [2 * xi, 18, zpf - zpb + P - 10], [0, shelfY, zm]);
  r.part("top", "Top", [W, topT, D], [0, H - topT / 2, 0], { material: "wood" });
  const side = (L: string) => [`lf${L}`, `lb${L}`, `sr${L}`];
  const runLen = Math.round((zpf - zpb - 40) / 10) * 10;
  const runner = (L: string) => [at("runner", `sr${L}`, [g(L), 0, 0], [[g(L) * (xo - 21), postH - apron + 40, zm]], undefined, { len: runLen, dia: 24 }), at("screw", `sr${L}`, [g(L), 0, 0], [[g(L) * (xo - 21), postH - apron + 40, zm - runLen / 2 + 30], [g(L) * (xo - 21), postH - apron + 40, zm + runLen / 2 - 30]], undefined, sized(RUNNER_SCREW))];
  const bolts = (L: string) => [
    at("camScrew", `lb${L}`, [g(L), 0, 0], [[g(L) * xi, postH - apron / 2, zpb - P / 2 + 9], [g(L) * xi, shelfY, zpb]], undefined, { len: 34 }),
    at("camScrew", `lf${L}`, [g(L), 0, 0], [[g(L) * xi, postH - apron + 12, zpf], [g(L) * xi, shelfY, zpf]], undefined, { len: 34 }),
  ];
  const dowels = (L: string) => [at("dowel", undefined, [-g(L), 0, 0], [[g(L) * xi, postH - apron / 2 + 40, zpb - P / 2 + 9], [g(L) * xi, postH - apron / 2 - 40, zpb - P / 2 + 9], [g(L) * xi, postH - apron + 12, zpf + 8]], undefined, sized(DOWEL))];
  const camsRails = (L: string) => [at("cam", "bk", [0, 0, 1], [[g(L) * (xi - 26), postH - apron / 2, zpb - P / 2 + 18]], undefined, { dia: 15 }), at("cam", "fr", [0, -1, 0], [[g(L) * (xi - 20), postH - apron + 25, zpf + P / 2 - 15]], undefined, { dia: 15 })];
  const camsShelf = (L: string) => [at("cam", "sh", [0, -1, 0], [[g(L) * (xi - 26), shelfY + 9, zpb], [g(L) * (xi - 26), shelfY + 9, zpf]], undefined, { dia: 15 })];
  r.step({ title: "Screw the runners onto the side rails", detail: "Both sides on a rug. Each runner is marked with an arrow to the front; two screws each.", add: side("L"), fix: runner("L"), tools: ["screwdriver"], pose: "+x", repeat: 2, warnings: ["floor"] });
  r.step({ title: "Screw the cam bolts into the legs", detail: "Four in each side, into the inside faces, by hand.", fix: bolts("L"), tools: ["screwdriver"], pose: "+x", repeat: 2 });
  r.step({ title: "Stand the back panel and the front rail in the left side", detail: "Three dowels first, then push them onto the bolts and lock the two cam locks.", add: ["bk", "fr"], fix: [...dowels("L"), ...camsRails("L")], tools: ["hammer", "screwdriver"], pose: "+x" });
  r.step({ title: "Stand the shelf in", detail: "It drops onto its two bolts. Lock it with two cam locks.", add: ["sh"], fix: camsShelf("L"), tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Lower the right side on", detail: "It has its runner and bolts like the left one. Three dowels in the free ends, then press it on.", add: side("R"), fix: [...runner("R"), ...bolts("R"), ...dowels("R")], tools: ["hammer"], pose: "+x" });
  r.step({ title: "Lock the cam locks on this side", detail: "Four of them, arrow towards the bolt.", fix: [...camsRails("R"), ...camsShelf("R")], tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Tap the felt pads under the legs", detail: "One under each leg.", fix: [at("glide", undefined, [0, 1, 0], [[-xp, 0, zpf], [xp, 0, zpf], [-xp, 0, zpb], [xp, 0, zpb]], undefined, { len: 4, dia: 22 })], tools: ["hammer"], pose: "-y" });
  r.step({
    title: "Stand it up and put the top on",
    detail: "Two dowels into the side rails and four cam bolts into the top, then lower it on and lock the four cam locks.",
    add: ["top"],
    fix: [
      at("dowel", undefined, [0, -1, 0], [[-(xo - 12), postH, zm], [xo - 12, postH, zm]], "top", sized(DOWEL)),
      at("camScrew", "top", [0, 1, 0], [[-xp, postH, zpf - 5], [xp, postH, zpf - 5], [-xp, postH, zpb + 5], [xp, postH, zpb + 5]], undefined, { len: 24, dia: 6 }),
      at("cam", undefined, [1, 0, 0], [[-xi, postH - 25, zpf - 5], [-xi, postH - 25, zpb + 5]], undefined, { dia: 15 }),
      at("cam", undefined, [-1, 0, 0], [[xi, postH - 25, zpf - 5], [xi, postH - 25, zpb + 5]], undefined, { dia: 15 }),
    ],
    tools: ["hammer", "screwdriver"],
    pose: "+y",
  });
  buildCustom(b, { ...s, custom: r.get() });
  boardDrawers(b, [{ x: 0, y0: postH - apron + 25, w: 2 * xi, h: apron - 25, zf: zpf + P / 2, zBack: zpb + P / 2 + 10, knobs: 1, plates: 0 }], { mini: true });
  const slide = b.steps[b.steps.length - 1];
  slide.title = "Slide the drawer in";
  slide.detail = "Lift it onto the runners and push it in until it closes.";
  step(b, { title: "Screw in the drawer stops", detail: "Pull the drawer out a little and drive the two stop screws into the runners, so it can't come all the way out.", tools: ["screwdriver"], kind: "screws" }, () => {
    const keys = b.items.filter((it) => it.kind === "part").map((it) => it.key);
    const near = (x: number) => keys.find((k) => Math.abs(b.partItem(k).final.pos[0] - x) < 5 && Math.abs(b.partItem(k).final.pos[1] - (postH - apron / 2)) < 5);
    for (const gg of [-1, 1]) {
      const k = near(gg * (xo - 12));
      if (k) b.fit(STRAP_SCREW, { on: k, at: [gg * (xo - 21), postH - apron + 45, zpb + 40], dir: [gg, 0, 0] });
    }
  });
  return true;
}

/*
 * TV bench 148: post-and-panel sides with a runner each, laid on a rug for their cam bolts; the left one stays down
 * while the front and back rails stand in it, the two dividers (a runner on each face) go in, the right side goes on.
 * Upside down, the bottom goes on with cam bolts, cam locks and long screws; then the top on clips, two L brackets for
 * the wall, the three shelves on pins and the three drawers (built like the chest drawers).
 */
function tvBench(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const r = new Recipe();
  const topT = 25, P = 45, ov = 15, postH = H - topT, legH = 90;
  const xo = W / 2 - ov, xp = xo - P / 2, xi = xo - P;
  const zf = D / 2 - ov, zb = -D / 2 + 3;
  const zpf = zf - P / 2, zpb = zb + P / 2, zm = (zpf + zpb) / 2;
  const g = (L: string) => (L === "L" ? -1 : 1);
  const botT = 18, botY = legH + 60;
  const drH = 150, midY = botY + botT + drH, midH = 30;
  const bayW = (2 * xi - 36) / 3;
  const dx = [-xi + bayW + 9, xi - bayW - 9];
  for (const L of ["L", "R"]) {
    r.part(`pf${L}`, "Corner post", [P, postH, P], [g(L) * xp, postH / 2, zpf], { material: "wood" });
    r.part(`pb${L}`, "Corner post", [P, postH, P], [g(L) * xp, postH / 2, zpb], { material: "wood" });
    r.part(`sp${L}`, "Side panel", [16, postH - legH, zpf - zpb - P + 20], [g(L) * (xo - 16), legH + (postH - legH) / 2, zm]);
  }
  const zr = zf - 10;
  r.part("fb", "Bottom rail", [2 * xi, 60, 20], [0, legH + 30, zr], { material: "wood" });
  r.part("fm", "Front rail", [2 * xi, midH, 20], [0, midY + midH / 2, zr], { material: "wood" });
  r.part("ft", "Top rail", [2 * xi, 40, 20], [0, postH - 20, zr], { material: "wood" });
  r.part("bt", "Back rail", [2 * xi, 80, 20], [0, postH - 40, zb + 10], { material: "wood" });
  r.part("bb", "Back rail", [2 * xi, 60, 20], [0, legH + 30, zb + 10], { material: "wood" });
  dx.forEach((x, i) => r.part(`dv${i}`, "Divider", [18, postH - botY - botT, zr - 10 - (zb + 20)], [x, botY + botT + (postH - botY - botT) / 2, (zr - 10 + zb + 20) / 2]));
  // the bottom rests on the two bottom rails, front and back
  r.part("bot", "Bottom", [2 * xi, botT, zr + 5 - (zb + 5)], [0, botY + botT / 2, (zr + 5 + zb + 5) / 2]);
  r.part("top", "Top", [W, topT, D], [0, H - topT / 2, 0], { material: "wood" });
  const bays = [[-xi, dx[0] - 9], [dx[0] + 9, dx[1] - 9], [dx[1] + 9, xi]];
  const shY = Math.round(midY + midH + (postH - 40 - midY - midH) / 2);
  bays.forEach(([a, c], i) => r.part(`sh${i}`, "Shelf", [c - a - 4, 18, zr - 10 - (zb + 30)], [(a + c) / 2, shY, (zr - 10 + zb + 30) / 2]));
  const side = (L: string) => [`pf${L}`, `pb${L}`, `sp${L}`];
  const runLen = Math.round((zr - zb - 60) / 10) * 10;
  const ry = botY + botT + 8;
  const xr = xo - 24; // inside face of the side panel
  const sideRunner = (L: string) => [at("runner", `sp${L}`, [g(L), 0, 0], [[g(L) * xr, ry, zm]], undefined, { len: runLen, dia: 20 }), at("screw", `sp${L}`, [g(L), 0, 0], [[g(L) * xr, ry, zm - runLen / 2 + 40], [g(L) * xr, ry, zm + runLen / 2 - 40]], undefined, sized(RUNNER_SCREW))];
  const rails = [
    { id: "fb", y: legH + 30, z: zr, post: "pf" },
    { id: "fm", y: midY + midH / 2, z: zr, post: "pf" },
    { id: "ft", y: postH - 20, z: zr, post: "pf" },
    { id: "bt", y: postH - 40, z: zb + 10, post: "pb" },
  ];
  const bolts = (L: string) => rails.map((q) => at("camScrew", `${q.post}${L}`, [g(L), 0, 0], [[g(L) * xi, q.y - 12, q.z]], q.id, { len: 34 }));
  const dowels = (L: string) => [at("dowel", undefined, [-g(L), 0, 0], [...rails.map((q): Vec3 => [g(L) * xi, q.y + 12, q.z]), [g(L) * xi, legH + 30, zb + 10]], undefined, sized(DOWEL))];
  const cams = (L: string) => [at("cam", undefined, [0, -1, 0], rails.map((q): Vec3 => [g(L) * (xi - 26), q.y + (q.id === "bt" ? 40 : q.id === "fm" ? 15 : q.id === "ft" ? 20 : 30), q.z]), undefined, { dia: 15 })];
  r.step({ title: "Screw the runners onto the sides", detail: "Both sides on a rug, inside up. One runner each, wheel at the front, two screws.", add: side("L"), fix: sideRunner("L"), tools: ["screwdriver"], pose: "+x", repeat: 2, warnings: ["floor"] });
  r.step({ title: "Screw in the cam bolts", detail: "Four in each side, into the inside faces of the posts.", fix: bolts("L"), tools: ["screwdriver"], pose: "+x", repeat: 2 });
  r.step({ title: "Stand the rails in the left side", detail: "Three front rails and the two back rails, each on a dowel. Lock the cam locks.", add: ["fb", "fm", "ft", "bt", "bb"], fix: [...dowels("L"), ...cams("L")], tools: ["hammer", "screwdriver"], pose: "+x" });
  r.step({
    title: "Screw the runners onto the dividers",
    detail: "One on each face, at the bottom, two screws each. Then two dowels into the bottom edge of each divider.",
    fix: [
      ...dx.map((x, i) => at("runner", `dv${i}`, [1, 0, 0], [[x - 9, ry, zm]], undefined, { len: runLen, dia: 20 })),
      ...dx.map((x, i) => at("runner", `dv${i}`, [-1, 0, 0], [[x + 9, ry, zm]], undefined, { len: runLen, dia: 20 })),
      at("screw", undefined, [1, 0, 0], dx.flatMap((x): Vec3[] => [[x - 9, ry, zm - runLen / 2 + 40], [x - 9, ry, zm + runLen / 2 - 40]]), undefined, sized(RUNNER_SCREW)),
      at("screw", undefined, [-1, 0, 0], dx.flatMap((x): Vec3[] => [[x + 9, ry, zm - runLen / 2 + 40], [x + 9, ry, zm + runLen / 2 - 40]]), undefined, sized(RUNNER_SCREW)),
      at("dowel", undefined, [0, 1, 0], dx.flatMap((x): Vec3[] => [[x, botY + botT, zm - 100], [x, botY + botT, zm + 100]]), undefined, sized(DRAWER_DOWEL)),
    ],
    tools: ["screwdriver", "hammer"],
    pose: "+x",
  });
  r.step({ title: "Fit the dividers", detail: "They slot between the rails, a cam lock at the top of each.", add: ["dv0", "dv1"], fix: [at("cam", undefined, [0, -1, 0], dx.map((x): Vec3 => [x, postH, zm]), undefined, { dia: 15 })], tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Lower the right side on", detail: "It has its runner and bolts like the left one. Dowels in the free rail ends, then press it on evenly.", add: side("R"), fix: [...sideRunner("R"), ...bolts("R"), ...dowels("R")], tools: ["hammer"], pose: "+x", people: 2 });
  r.step({ title: "Lock the cam locks on this side", detail: "Arrow towards the bolt, then a clockwise turn.", fix: cams("R"), tools: ["screwdriver"], pose: "+x" });
  r.step({
    title: "Turn it upside down and fit the bottom",
    detail: "Screw six cam bolts into the bottom on a rug, lay it in, lock the six cam locks and drive four long screws through the bottom rails.",
    add: ["bot"],
    fix: [
      // cam bolts down into the bottom rails, locked from inside; long screws up through the rails into the bottom
      at("camScrew", "bot", [0, 1, 0], [-1, 1].flatMap((gg): Vec3[] => [[gg * (xi - 60), botY, zr], [gg * (xi - 60), botY, zb + 10]]), undefined, { len: 24, dia: 6 }),
      at("camScrew", "bot", [0, -1, 0], [[dx[0], botY + botT, zm], [dx[1], botY + botT, zm]], undefined, { len: 24, dia: 6 }),
      at("cam", undefined, [0, 0, 1], [-1, 1].map((gg): Vec3 => [gg * (xi - 60), botY - 22, zr - 10]), undefined, { dia: 15 }),
      at("cam", undefined, [0, 0, -1], [-1, 1].map((gg): Vec3 => [gg * (xi - 60), botY - 22, zb + 20]), undefined, { dia: 15 }),
      at("cam", undefined, [0, 0, 1], dx.map((x): Vec3 => [x, botY + botT + 25, zr - 30]), undefined, { dia: 15 }),
      at("screw", undefined, [0, 1, 0], [[-xi / 2, legH, zb + 10], [xi / 2, legH, zb + 10], [-xi / 2, legH, zr], [xi / 2, legH, zr]], "bot", { len: 80, dia: 6 }),
    ],
    tools: ["screwdriver", "allen"],
    pose: "-y",
    people: 2,
  });
  r.step({
    title: "Turn it back over and clip the top on",
    detail: "Lay the top on, then eight clips under it, a screw in each.",
    add: ["top"],
    fix: [at("clip", undefined, [0, 1, 0], [...spread(-xi + 100, xi - 100, 4).map((x): Vec3 => [x, postH, zr - 20]), ...spread(-xi + 100, xi - 100, 4).map((x): Vec3 => [x, postH, zb + 30])], undefined, { len: 12, dia: 20 }), at("screw", undefined, [0, 1, 0], [...spread(-xi + 100, xi - 100, 4).map((x): Vec3 => [x, postH - 2, zr - 24]), ...spread(-xi + 100, xi - 100, 4).map((x): Vec3 => [x, postH - 2, zb + 34])], "top", { len: 16, dia: 4 })],
    tools: ["screwdriver"],
    pose: "+y",
    people: 2,
  });
  r.step({
    title: "Fix it to the wall",
    detail: "Two L brackets on the back rail, then to the wall with washers. Wall screws aren't included: pick ones made for your wall.",
    fix: [at("angle", "bt", [0, 0, 1], [[-xi / 2, postH - 20, zb], [xi / 2, postH - 20, zb]], undefined, { len: 70, dia: 40 }), at("washer", "bt", [0, 0, -1], [[-xi / 2 - 15, postH - 50, zb - 2], [-xi / 2 + 15, postH - 50, zb - 2], [xi / 2 - 15, postH - 50, zb - 2], [xi / 2 + 15, postH - 50, zb - 2]])],
    wall: true,
    tools: ["drill", "screwdriver"],
    warnings: ["wall", "tip"],
  });
  r.step({
    title: "Put the shelves in on their pins",
    detail: "Four pins for each of the three shelves.",
    add: ["sh0", "sh1", "sh2"],
    fix: [at("pin", undefined, [1, 0, 0], bays.flatMap(([a, c]): Vec3[] => [[a, shY - 13, zm - 120], [a, shY - 13, zm + 120], [c, shY - 13, zm - 120], [c, shY - 13, zm + 120]]), undefined, { len: 16, dia: 5 })],
  });
  buildCustom(b, { ...s, custom: r.get() });
  drawers(
    b,
    bays.map(([a, c]) => ({ x: (a + c) / 2, y0: botY + botT, w: c - a, h: drH, zf, zBack: zb + 24, knobs: 1 as const })),
  );
  return true;
}

/*
 * High cabinet with mirror door 49 x 200: built lying on its left side. The hanging brackets and the two front feet
 * go on first, cam bolts into the side, then the plinth rails, the bottom and the fixed shelf stand in it on dowels
 * and cam locks; the right side goes on, the hinge plates and the door stop are screwed on, the back slides in and
 * the crown is screwed on top. It hangs on four wall plates; the mirror door clicks onto three hinges, then sixteen
 * shelf pins, four glass shelves and the knob.
 */
function highCabinet(s: ProductSpec): CustomParams | null {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const r = new Recipe();
  const t = 18, crown = 40, ov = 10;
  const bodyH = H - crown;
  const xs = W / 2 - ov - t / 2, xi = W / 2 - ov - t;
  const zb = -D / 2, zf = D / 2 - ov - 22;
  const zc = (zf + zb) / 2, sD = zf - zb;
  const plinthY = 60, plinthH = 70, botY = plinthY + plinthH, fixY = Math.round(H * 0.47);
  r.part("sL", "Side", [t, bodyH, sD], [-xs, bodyH / 2, zc]);
  r.part("sR", "Side", [t, bodyH, sD], [xs, bodyH / 2, zc]);
  r.part("pf", "Plinth", [2 * xi, plinthH, 18], [0, plinthY + plinthH / 2, zf - 9], { material: "wood" });
  r.part("pb", "Back plinth", [2 * xi, plinthH, 18], [0, plinthY + plinthH / 2, zb + 20], { material: "wood" });
  r.part("bot", "Bottom", [2 * xi, t, sD - 10], [0, botY + t / 2, zc + 5]);
  r.part("fx", "Fixed shelf", [2 * xi, t, sD - 10], [0, fixY, zc + 5]);
  r.part("top", "Top", [2 * xi, t, sD - 10], [0, bodyH - t / 2, zc + 5]);
  r.part("bk", "Back panel", [2 * xi + 10, bodyH - botY - t, 4], [0, botY + t + (bodyH - botY - t) / 2, zb + 8], { material: "fiber" });
  r.part("cr", "Crown", [W, crown, D], [0, H - crown / 2, 0], { material: "wood" });
  r.part("door", "Mirror door", [2 * xi + 2 * t - 4, bodyH - botY - 6, 22], [0, botY + 3 + (bodyH - botY - 6) / 2, zf + 11]);
  const gY = [...spread(botY + 250, fixY - 180, 2), ...spread(fixY + 250, bodyH - 250, 2)].map(Math.round);
  gY.forEach((y, i) => r.part(`g${i}`, "Glass shelf", [2 * xi - 6, 6, sD - 40], [0, y, zc + 5], { material: "metal" }));
  const zj = [zc - sD / 4, zc + sD / 4];
  const pts = (y: number, x: number): Vec3[] => zj.map((z): Vec3 => [x, y, z]);
  r.step({
    title: "Screw the hanging brackets and the feet to the left side",
    detail: "Lay it on a rug, inside up. Two brackets at the back corners, two screws each; the adjustable foot screws into the bottom front.",
    add: ["sL"],
    fix: [at("angle", "sL", [-1, 0, 0], [[-xi, bodyH - 80, zb + 30], [-xi, botY + 80, zb + 30]], undefined, { len: 70, dia: 50 }), at("screw", "sL", [-1, 0, 0], [[-xi, bodyH - 100, zb + 30], [-xi, bodyH - 60, zb + 30], [-xi, botY + 60, zb + 30], [-xi, botY + 100, zb + 30]], undefined, sized(RUNNER_SCREW)), at("foot", "sL", [0, 1, 0], [[-xs, 0, zf - 30]])],
    tools: ["screwdriver"],
    pose: "+x",
    warnings: ["floor"],
  });
  r.step({ title: "Screw the cam bolts into the left side", detail: "Six bolts, by hand until they stop.", fix: [at("camScrew", "sL", [-1, 0, 0], [[-xi, plinthY + plinthH / 2, zf - 9], [-xi, plinthY + plinthH / 2, zb + 20], ...pts(botY + t / 2, -xi), ...pts(fixY, -xi)], undefined, { len: 34 })], tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Stand the two plinths in", detail: "A dowel in the end of each, then push them onto the bolts and lock the cam locks.", add: ["pf", "pb"], fix: [at("dowel", undefined, [1, 0, 0], [[-xi, plinthY + plinthH / 2 + 20, zf - 9], [-xi, plinthY + plinthH / 2 + 20, zb + 20]], undefined, sized(DOWEL)), at("cam", undefined, [0, -1, 0], [[-xi + 26, plinthY + plinthH, zf - 9], [-xi + 26, plinthY + plinthH, zb + 20]], undefined, { dia: 15 })], tools: ["hammer", "screwdriver"], pose: "+x" });
  r.step({ title: "Stand the bottom and the fixed shelf in", detail: "Two dowels in each end of both, push them on and lock the four cam locks.", add: ["bot", "fx"], from: { bot: [300, 0, 0], fx: [300, 0, 0] }, fix: [at("dowel", undefined, [1, 0, 0], [[-xi, botY + t / 2, zc - 20], [-xi, botY + t / 2, zc + 30], [-xi, fixY, zc - 20], [-xi, fixY, zc + 30]], undefined, sized(DOWEL)), at("cam", undefined, [0, 1, 0], [...pts(botY + t, -xi + 26), ...pts(fixY + t / 2, -xi + 26)], undefined, { dia: 15 })], tools: ["hammer", "screwdriver"], pose: "+x" });
  r.step({
    title: "Put the top in and lower the right side on",
    detail: "The right side has its bracket, foot and six bolts like the left one. Dowels in all the free ends, press it down, then lock the six cam locks.",
    add: ["top", "sR"],
    fix: [
      at("camScrew", "sR", [1, 0, 0], [[xi, plinthY + plinthH / 2, zf - 9], [xi, plinthY + plinthH / 2, zb + 20], ...pts(botY + t / 2, xi), ...pts(fixY, xi)], undefined, { len: 34 }),
      at("dowel", undefined, [-1, 0, 0], [[xi, plinthY + plinthH / 2 + 20, zf - 9], [xi, plinthY + plinthH / 2 + 20, zb + 20], [xi, botY + t / 2, zc - 20], [xi, botY + t / 2, zc + 30], [xi, fixY, zc - 20], [xi, fixY, zc + 30]], undefined, sized(DOWEL)),
      at("cam", undefined, [0, -1, 0], [[xi - 26, plinthY + plinthH, zf - 9], [xi - 26, plinthY + plinthH, zb + 20], ...pts(botY + t, xi - 26), ...pts(fixY + t / 2, xi - 26)], undefined, { dia: 15 }),
      at("angle", "sR", [1, 0, 0], [[xi, bodyH - 80, zb + 30], [xi, botY + 80, zb + 30]], undefined, { len: 70, dia: 50 }),
      at("screw", "sR", [1, 0, 0], [[xi, bodyH - 100, zb + 30], [xi, bodyH - 60, zb + 30], [xi, botY + 60, zb + 30], [xi, botY + 100, zb + 30]], undefined, sized(RUNNER_SCREW)),
      at("foot", "sR", [0, 1, 0], [[xs, 0, zf - 30]]),
    ],
    tools: ["hammer", "screwdriver"],
    pose: "+x",
    people: 2,
  });
  r.step({ title: "Screw on the hinge plates and the door stop", detail: "Three plates inside the right side at the front, and the little stop under the top.", fix: [at("hinge", "sR", [0, 0, -1], spread(botY + 150, bodyH - 150, 3).map((y): Vec3 => [xi - 18, y, zf - 30]), undefined, { len: 50, dia: 35 }), at("screw", "top", [0, 1, 0], [[-xi / 2 - 10, bodyH - t, zf - 30], [-xi / 2 + 10, bodyH - t, zf - 30]], undefined, { len: 14, dia: 3.5 })], tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Slide in the back panel", detail: "Into the grooves from the top end, smooth side in.", add: ["bk"], pose: "+x", from: { bk: [0, 500, 0] } });
  r.step({ title: "Screw the crown on", detail: "Four dowels into the top of the cabinet, press the crown on, then five long screws up through the top.", add: ["cr"], fix: [at("dowel", undefined, [0, -1, 0], [[-xs, bodyH, zj[0]], [-xs, bodyH, zj[1]], [xs, bodyH, zj[0]], [xs, bodyH, zj[1]]], "cr", sized(DOWEL)), at("screw", "top", [0, 1, 0], [[-xi / 2, bodyH - t, zj[0]], [xi / 2, bodyH - t, zj[0]], [-xi / 2, bodyH - t, zj[1]], [xi / 2, bodyH - t, zj[1]], [0, bodyH - t, zc]], "cr", sized(TOP_SCREW))], tools: ["hammer", "allen"], pose: "+z" });
  r.step({
    title: "Hang it on the wall",
    detail: "Two people. Screw the four wall plates on level (screws not included: pick ones made for your wall), hang the brackets on them, then turn the feet down to the floor.",
    fix: [at("bracket", undefined, [0, 0, -1], [[-xi + 30, bodyH - 80, zb - 2], [xi - 30, bodyH - 80, zb - 2], [-xi + 30, botY + 80, zb - 2], [xi - 30, botY + 80, zb - 2]], undefined, { len: 40, dia: 30 })],
    wall: true,
    pose: "+y",
    people: 2,
    tools: ["drill", "level", "pencil"],
    warnings: ["wall", "tip"],
  });
  r.step({ title: "Click the door on", detail: "Screw the three hinges into the door's cups, then click each onto its plate from the top down.", add: ["door"], fix: [at("screw", "door", [0, 0, -1], spread(botY + 150, bodyH - 150, 3).map((y): Vec3 => [xi - 10, y, zf]), undefined, { len: 14, dia: 4 })], tools: ["screwdriver"] });
  r.step({ title: "Push in the shelf pins and lay in the glass shelves", detail: "Four pins for each of the four shelves. Lay the glass in gently.", add: gY.map((_, i) => `g${i}`), fix: [at("pin", undefined, [1, 0, 0], gY.flatMap((y): Vec3[] => [[-xi, y - 5, zc - 60], [-xi, y - 5, zc + 70], [xi, y - 5, zc - 60], [xi, y - 5, zc + 70]]), undefined, { len: 16, dia: 5 })] });
  r.step({ title: "Screw on the knob and stick on the bumpers", detail: "The knob screws on from inside the door. Four small pads where the door closes.", fix: [at("knob", "door", [0, 0, -1], [[-xi + 40, botY + (bodyH - botY) * 0.5, zf + 22]]), at("glide", undefined, [0, 0, -1], [[-xs, botY + 100, zf], [-xs, bodyH - 100, zf], [xs, botY + 100, zf], [xs, bodyH - 100, zf]], undefined, { len: 3, dia: 10 })], tools: ["screwdriver"] });
  return r.get();
}

const family: Family = {
  names: ["HEMNES"],
  build(b, s) {
    // guides drawn in the helper files next to this one (beds and benches, desks and tables, cabinets, storage)
    for (const f of [hemnesBeds, hemnesTables, hemnesCabinets, hemnesStorage]) if (f(b, s)) return true;
    if (s.archetype === "drawers" && /chest/i.test(s.variant + s.slug)) return chest(b, s);
    const v = s.variant.toLowerCase();
    if (/wash-?st(an)?d w(ith)? 2 drawers|wash-stnd w drawers/.test(v)) return washStand(b, s);
    if (/open wa?sh-?st/.test(v)) return openStand(b, s);
    if (/^nightstand|^bedside/.test(v)) return bedside(b, s);
    if (/^tv bench/.test(v)) return tvBench(b, s);
    const recipe = /^bookcase/.test(v) ? bookcase(s) : /^bench, 83/.test(v) ? bench(s) : /^shelf unit/.test(v) ? shelfUnit(s) : /^hat rack/.test(v) ? hatRack(s) : /^mirror cabinet/.test(v) ? mirrorCabinet(s) : /^high cabinet/.test(v) ? highCabinet(s) : null;
    if (recipe) {
      buildCustom(b, { ...s, custom: recipe });
      return true;
    }
    return false;
  },
};
export default family;
