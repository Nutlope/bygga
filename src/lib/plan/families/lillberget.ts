import type { Family } from "./family";
import type { ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";

/**
 * LILLBERGET, read from IKEA's manuals. The chests of 3 and 5 drawers are built lying on the right side: the runners
 * and cam bolts go on both sides first, the plinth is screwed in with two corner brackets, the rails stand in on one
 * dowel and one cam each, then the other side goes on top. The top takes the wall brackets and cam bolts, the back
 * is a strip and two or three boards that slide down the grooves on dowels, held with two long screws. The drawer
 * interlock (only one drawer opens at a time) clips inside the right side, then the chest goes on its back for the
 * catches and the foot pads. The chest of 6 drawers is two such columns either side of a middle panel, built lying
 * on its front, with two hardboard backs held by plastic rivets. The nightstand is built on its side too: a front
 * rail and a back board between the sides, a bottom panel slid in, a plinth on three brackets and the top.
 * Every drawer is built on its front: cam dowels, sides, bottom, back, pins and cams, then its half of the runners.
 */

const t = 18;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

const RUN_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const BRK_SCREW: HwDef = { kind: "screw", len: 13, dia: 5 };
const CORNER: HwDef = { kind: "angle", len: 40, dia: 36, name: "Corner bracket" };
const WB_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const WALL_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 35, dia: 8 };
const BACK_SCREW: HwDef = { kind: "screw", len: 50, dia: 6, name: "Long back screw" };
const BOX: HwDef = { kind: "connector", len: 60, dia: 40, name: "Interlock box" };
const BOX_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const LATCH: HwDef = { kind: "clip", len: 24, dia: 16, name: "Interlock latch" };
const STOP: HwDef = { kind: "clip", len: 10, dia: 12, name: "Stop" };
const CATCH_CLIP: HwDef = { kind: "clip", len: 16, dia: 14, name: "Catch clip" };
const PAD: HwDef = { kind: "glide", len: 10, dia: 24, name: "Foot pad" };
const RIVET: HwDef = { kind: "clip", len: 14, dia: 10, name: "Rivet sleeve" };
const RIVET_PIN: HwDef = { kind: "clip", len: 16, dia: 6, name: "Rivet pin" };
// drawers
const CAM_DOWEL: HwDef = { kind: "camScrew", len: 30, dia: 6, name: "Cam dowel" };
const DCAM: HwDef = { kind: "cam", len: 12, dia: 12 };
const PIN: HwDef = { kind: "dowel", len: 30, dia: 8, name: "Plastic pin" };
const WIRE: HwDef = { kind: "clip", len: 60, dia: 6, name: "Wire stop" };
const CATCH: HwDef = { kind: "clip", len: 30, dia: 20, name: "Drawer catch" };
const D_SCREW: HwDef = { kind: "screw", len: 8, dia: 4 };
const D_STOP: HwDef = { kind: "screw", len: 12, dia: 10, name: "Drawer stop" };

interface Drawer {
  front: string;
  sides: [string, string];
  bottom: string;
  back: string;
  x: number; // column centre
  y: number; // underside of the box
  bx: number; // half width of the box, to the outside of its sides
}

/** The drawers: their parts, built on their fronts in their own scene, then slid in. */
function drawerKit(b: PlanBuilder, o: { cols: { xa: number; xb: number }[]; slots: { c: number; y0: number; y1: number }[]; zf: number; zBack: number; small?: boolean }) {
  const { zf, zBack } = o;
  const gap = 13; // runner space each side
  const c0 = o.cols[0];
  const fw = c0.xb - c0.xa - 4;
  const fh = o.slots[0].y1 - o.slots[0].y0 - 4;
  const bx = (c0.xb - c0.xa) / 2 - gap;
  const sh = Math.min(fh - 50, o.small ? 110 : 170);
  const dd = zf - t - zBack;
  const runLen = Math.round((dd - 30) / 10) * 10;
  const frontT = b.compound(
    "Drawer front",
    [
      { shape: "box", size: [fw, fh - 22, t], pos: [0, -11, 0] },
      { shape: "box", size: [fw, 22, 10], pos: [0, fh / 2 - 11, -4] },
    ],
  );
  const dsT = b.part("Drawer side", [12, sh, dd]);
  const dbtT = b.part("Drawer bottom", [2 * bx - 12, 3, dd - 14], { material: "fiber" });
  const dbT = b.part("Drawer back", [2 * bx - 24, sh - 14, 12]);
  const drawers: Drawer[] = o.slots.map((sl) => {
    const col = o.cols[sl.c];
    const x = (col.xa + col.xb) / 2;
    const y = sl.y0 + 22;
    const fy = sl.y0 + 2 + fh / 2;
    return {
      x,
      y,
      bx,
      front: b.place(frontT.type, [x + frontT.mid[0], fy + frontT.mid[1], zf - t / 2 + frontT.mid[2]]),
      sides: [-1, 1].map((g) => b.place(dsT, [x + g * (bx - 6), y + sh / 2, zf - t - dd / 2])) as [string, string],
      bottom: b.place(dbtT, [x, y + 10, zf - t - (dd - 14) / 2 - 2]),
      back: b.place(dbT, [x, y + 14 + (sh - 14) / 2, zBack + 6]),
    };
  });
  const RUNNER_D: HwDef = { kind: "runner", len: runLen, dia: 20, name: "Runner, drawer part" };
  const RUNNER_C: HwDef = { kind: "runner", len: runLen, dia: 20, name: "Runner, cabinet part" };
  const fitsOf = (d: Drawer) => {
    const per = (fn: (g: number, sd: string) => FitOpts[]) => [-1, 1].flatMap((g) => fn(g, d.sides[g < 0 ? 0 : 1]));
    const xs = (g: number) => d.x + g * (d.bx - 6);
    return {
      camDowels: per((g, sd) => [d.y + 25, d.y + sh - 25].map((y): FitOpts => ({ on: d.front, at: [xs(g), y, zf - t], dir: [0, 0, -1], mate: sd, mateHole: 4 }))),
      cams: per((g, sd) => [d.y + 25, d.y + sh - 25].map((y): FitOpts => ({ on: sd, at: [d.x + g * (d.bx - 12), y, zf - t - 30], dir: [g, 0, 0] }))),
      wire: [{ on: d.back, at: [d.x, d.y + sh, zBack + 6], dir: [0, -1, 0] } as FitOpts],
      catch: [{ on: d.sides[1], at: [d.x + d.bx, d.y + sh / 2, zBack + 30], dir: [-1, 0, 0] } as FitOpts],
      pins: per((g, sd) => [0.3, 0.75].map((k): FitOpts => ({ on: sd, at: [d.x + g * d.bx, d.y + 14 + (sh - 14) * k, zBack + 6], dir: [-g, 0, 0], mate: d.back }))),
      backCams: per((g, sd) => [0.3, 0.75].map((k): FitOpts => ({ on: sd, at: [d.x + g * (d.bx - 6), d.y + sh, zBack + 30 + 40 * k], dir: [0, -1, 0] }))),
      runners: per((g, sd) => [{ on: sd, at: [d.x + g * d.bx, d.y + 4, zf - t - 10 - runLen / 2], dir: [-g, 0, 0], hole: false }]),
      runnerScrews: per((g, sd) => [zf - t - 40, zf - t - runLen + 20].map((z): FitOpts => ({ on: sd, at: [d.x + g * d.bx, d.y + 6, z], dir: [-g, 0, 0] }))),
    };
  };
  return { drawers, fitsOf, RUNNER_C, RUNNER_D, runLen, sh, dd };
}

type Kit = ReturnType<typeof drawerKit>;

/** The drawer steps, shown on the first drawer and repeated for the others, then all of them slid in. */
function drawerSteps(b: PlanBuilder, k: Kit, o: { wire: boolean; catch: boolean; pins: "back" | "screws"; stops?: boolean; runners?: false }) {
  const d0 = k.drawers[0];
  const n = k.drawers.length;
  const c0: Vec3 = [d0.x, d0.y + k.sh / 2, 0];
  const rel = (key: string): Vec3 => {
    const it = b.partItem(key);
    return [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]];
  };
  const stage = (key: string, from: Vec3) => b.stage(key, rel(key), b.partItem(key).final.rot, from);
  const f0 = k.fitsOf(d0);
  const rep = n > 1 ? n : undefined;
  const dstep = (title: string, detail: string, body: () => void, x: { tools?: ("screwdriver" | "hammer")[]; kind?: "cams" | "drawer" | "screws" | "runners" | "dowels"; pose?: "-z" | "-y" | "+y" } = {}) =>
    b.step({ title, detail, tools: x.tools, scene: "drawer", pose: x.pose ?? "-z", repeat: rep, kind: x.kind ?? "drawer" }, body);

  dstep(
    "Screw the cam dowels into a drawer front",
    "Lay the front face down on a rug, the handle edge away from you. Four of them, by hand or with a screwdriver.",
    () => {
      stage(d0.front, [0, 0, -160]);
      b.then(0.15);
      b.fits(CAM_DOWEL, f0.camDowels, 0.1);
    },
    { tools: ["screwdriver"], kind: "cams" },
  );
  dstep("Push the sides onto the front", "The grooves face inwards and down.", () => {
    b.stagger(0.25);
    for (const sd of d0.sides) stage(sd, [0, 0, -300]);
  });
  dstep("Lock the sides with cam locks", "Arrow towards the cam dowel, then a clockwise turn.", () => b.fits(DCAM, f0.cams, 0.12), { tools: ["screwdriver"], kind: "cams" });
  dstep("Slide in the drawer bottom", "Down the grooves until it reaches the front.", () => stage(d0.bottom, [0, 0, -420]));
  if (o.wire)
    dstep("Tap the wire stop into the drawer back", "Both ends in the holes of its top edge, the bend pointing the way the drawing shows. Tap it gently.", () => {
      const r = rel(d0.back);
      b.stage(d0.back, [r[0], r[1], r[2] - 320], b.partItem(d0.back).final.rot, [0, 0, -200]);
      b.then(0.15);
      b.fits(WIRE, f0.wire, 0.1);
    }, { tools: ["hammer"] });
  dstep("Put the drawer back on", "Its edges go into the grooves in the sides, over the drawer bottom.", () => stage(d0.back, [0, 0, o.wire ? -320 : -260]));
  if (o.catch) dstep("Clip the catch into the right side", "In the hole near the back. It works the interlock in the chest.", () => b.fits(CATCH, f0.catch, 0.1));
  dstep(
    "Push in the pins and lock them",
    o.pins === "screws" ? "Two pins through each side into the back, two cam locks on top, then the two small screws up through the bottom." : "Two pins through each side into the back, then a cam lock on top of each.",
    () => {
      b.fits(PIN, f0.pins, 0.1);
      b.then(0.12);
      b.fits(DCAM, f0.backCams, 0.1);
      if (o.pins === "screws") {
        b.then(0.1);
        b.fits(D_SCREW, [-60, 60].map((dx): FitOpts => ({ on: d0.bottom, at: [d0.x + dx, d0.y + 8.5, (b.partItem(d0.back).final.pos[2])], dir: [0, 1, 0], mate: d0.back })), 0.12);
      }
    },
    { tools: ["screwdriver"], kind: "cams" },
  );
  if (o.runners !== false) dstep(
    "Turn it over and screw on the runners",
    "The drawer half of each runner on the bottom edge of a side, two screws in each.",
    () => {
      b.fits(k.RUNNER_D, f0.runners, 0.25);
      b.then(0.1);
      b.fits(RUN_SCREW, f0.runnerScrews, 0.08);
    },
    { tools: ["screwdriver"], kind: "runners", pose: "-y" },
  );
  b.step(
    {
      title: n > 2 ? `Slide in all ${n} drawers` : n === 2 ? "Slide in both drawers" : "Slide in the drawer",
      detail: n > 1 ? "Start at the top. Rest the runners on the ones in the chest and push until it closes. Only one drawer opens at a time." : "Rest its runners on the ones in the cabinet and push until it closes.",
      kind: "drawer",
      warnings: ["tip"],
    },
    () => {
      for (const [i, d] of [...k.drawers].reverse().entries()) {
        b.stagger(0);
        for (const key of [d.front, ...d.sides, d.bottom, d.back]) b.add(key, [0, 0, 520]);
        if (d !== d0) {
          const f = k.fitsOf(d);
          const all: [HwDef, FitOpts[]][] = [
            [CAM_DOWEL, f.camDowels],
            [DCAM, f.cams],
            [PIN, f.pins],
            [DCAM, f.backCams],
          ];
          if (o.runners !== false) all.push([k.RUNNER_D, f.runners], [RUN_SCREW, f.runnerScrews]);
          if (o.wire) all.push([WIRE, f.wire]);
          if (o.catch) all.push([CATCH, f.catch]);
          for (const [def, list] of all) for (const x of list) b.preset(def, x);
        }
        b.wait(i ? 0.22 : 0.3);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
  if (o.stops) {
    b.step(
      { title: "Screw the drawer stops into the sides", detail: "Pull the drawer out, then one stop in the top edge of each side at the back, so it can't come right out.", tools: ["screwdriver"], kind: "screws" },
      () => b.fits(D_STOP, [-1, 1].map((g): FitOpts => ({ on: d0.sides[g < 0 ? 0 : 1], at: [d0.x + g * (d0.bx - 6), d0.y + k.sh, b.partItem(d0.back).final.pos[2] + 20], dir: [0, -1, 0] })), 0.2),
    );
  }
}

/** The wall fixing every chest has: two brackets under the top at the back, plugs and screws in the wall. */
function wallSteps(b: PlanBuilder, top: string, xs: number[], topY: number, zb: number) {
  const wy = topY - 26;
  b.step(
    {
      title: "Push it against the wall and mark the holes",
      detail: "Mark through the slot in each bracket, then move the chest away.",
      tools: ["pencil"],
      kind: "anchor",
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {},
  );
  b.step(
    {
      title: "Drill the holes and push in the plugs",
      detail: "The plugs suit solid walls. For a hollow or wooden wall, use fixings made for it.",
      tools: ["drill", "hammer"],
      kind: "anchor",
      wall: true,
      warnings: ["wall"],
    },
    () => b.fits(WALL_PLUG, xs.map((x) => ({ at: [x, wy, zb - 36], dir: [0, 0, -1] as Vec3 })), 0.2),
  );
  b.step(
    {
      title: "Screw it to the wall",
      detail: "Push it back, a washer on each screw, through the brackets into the plugs. Then tighten the bracket screws under the top.",
      tools: ["screwdriver"],
      kind: "anchor",
      wall: true,
      warnings: ["tip"],
    },
    () => {
      b.fits(HW.washer, xs.map((x) => ({ on: top, at: [x, wy, zb + 6], dir: [0, 0, -1] as Vec3, hole: false as const })), 0.15);
      b.then(0.05);
      b.fits(WALL_SCREW, xs.map((x) => ({ at: [x, wy, zb + 8], dir: [0, 0, -1] as Vec3 })), 0.2);
    },
  );
}

function chest(b: PlanBuilder, s: ProductSpec, n: number, cols: 1 | 2) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const topY = H - t;
  const sx = W / 2 - 2 - t / 2, xi = W / 2 - 2 - t;
  const zb = -D / 2, zf = D / 2 - 2;
  const sideD = zf - zb, sideZ = (zf + zb) / 2;
  const P = 70; // plinth height
  const colB = cols === 1 ? [{ xa: -xi, xb: xi }] : [{ xa: -xi, xb: -t / 2 }, { xa: t / 2, xb: xi }];
  const yb = P, yt = topY - 50;
  const pitch = (yt - yb) / n;

  // the panels between the columns: the sides and, on the wide chest, the middle panel
  const sideT = b.part("Side panel", [t, topY, sideD]);
  const sides = [b.place(sideT, [-sx, topY / 2, sideZ]), b.place(sideT, [sx, topY / 2, sideZ])];
  const mid = cols === 2 ? b.place(b.part("Middle panel", [t, topY, sideD]), [0, topY / 2, sideZ]) : "";
  const top = b.place(b.part("Top panel", [W, t, D]), [0, H - t / 2, 0]);

  interface Col {
    xa: number;
    xb: number;
    x: number;
    w: number;
    left: string; // panel on each side and the x of its inner face
    right: string;
    rails: string[];
    topRail: string;
    plinth: string;
  }
  const zr = zf - t - 2 - 30;
  const zp = zf - t / 2 - 30;
  const columns: Col[] = colB.map((c, i) => {
    const w = c.xb - c.xa, x = (c.xa + c.xb) / 2;
    const railT = b.part("Rail", [w, t, 60]);
    const topRailT = b.part("Top rail", [w, 50, t]);
    const plinthT = b.part("Plinth", [w, P - 10, t]);
    return {
      ...c,
      x,
      w,
      left: i === 0 ? sides[0] : mid,
      right: i === colB.length - 1 ? sides[1] : mid,
      rails: range(n).map((r) => b.place(railT, [x, yb + r * pitch + t / 2, zr])),
      topRail: b.place(topRailT, [x, topY - 25, zf - t / 2]),
      plinth: b.place(plinthT, [x, 10 + (P - 10) / 2, zp]),
    };
  });

  // backs: a strip and boards in the grooves (narrow chests), or a hardboard sheet per column (the wide one)
  const zBk = zb + 12;
  const backs: string[] = [];
  let strip = "";
  if (cols === 1) {
    const bw = 2 * xi + 16;
    strip = b.place(b.part("Back strip", [bw, 80, 8]), [0, topY - 40, zBk]);
    const k = n >= 5 ? 3 : 2;
    const bh = (topY - 80 - 10) / k;
    const boardT = b.part("Back board", [bw, bh, 8]);
    for (const i of range(k)) backs.push(b.place(boardT, [0, topY - 80 - bh / 2 - i * bh, zBk]));
  } else {
    const sheetT = b.part("Back panel", [columns[0].w + 16, topY - 10, 3], { material: "fiber" });
    for (const c of columns) backs.push(b.place(sheetT, [c.x, 10 + (topY - 10) / 2, zBk]));
  }

  const kit = drawerKit(b, {
    cols: colB,
    slots: columns.flatMap((_, c) => range(n).map((r) => ({ c, y0: yt - (r + 1) * pitch, y1: yt - r * pitch }))),
    zf,
    zBack: zBk + 20,
  });

  // where the fittings go
  const panelX = (key: string) => b.partItem(key).final.pos[0];
  const faceOf = (col: Col, g: -1 | 1) => ({ key: g < 0 ? col.left : col.right, x: g < 0 ? col.xa : col.xb });
  const railJoint = (col: Col, r: string | "top", g: -1 | 1) => {
    const f = faceOf(col, g);
    if (r === "top") {
      const y = topY - 25;
      return {
        dowel: { on: col.topRail, at: [f.x, y + 12, zf - t / 2], dir: [g, 0, 0], mate: f.key } as FitOpts,
        bolt: { on: f.key, at: [f.x, y - 12, zf - t / 2], dir: [-g, 0, 0], mate: col.topRail, mateHole: 4 } as FitOpts,
        cam: { on: col.topRail, at: [f.x - g * 25, y - 12, zf - t], dir: [0, 0, 1] } as FitOpts,
      };
    }
    const y = b.partItem(r).final.pos[1];
    return {
      dowel: { on: r, at: [f.x, y, zr + 15], dir: [g, 0, 0], mate: f.key } as FitOpts,
      bolt: { on: f.key, at: [f.x, y, zr - 15], dir: [-g, 0, 0], mate: r, mateHole: 4 } as FitOpts,
      cam: { on: r, at: [f.x - g * 25, y + t / 2, zr - 15], dir: [0, -1, 0] } as FitOpts,
    };
  };
  const joints = (col: Col, g: -1 | 1) => [...col.rails.map((r) => railJoint(col, r, g)), railJoint(col, "top", g)];
  const bracketsOf = (col: Col) => [-1, 1].map((g) => ({ on: col.plinth, at: [col.x + g * (col.w / 2 - 20), P / 2 + 5, zp - t / 2] as Vec3, dir: [0, 0, 1] as Vec3, hole: false as const, twist: g < 0 ? Math.PI : 0 }));
  const bracketScrews = (col: Col) => [-1, 1].flatMap((g) => [-1, 1].map((k): FitOpts => ({ on: col.plinth, at: [col.x + g * (col.w / 2 - 28), P / 2 + 5 + k * 10, zp - t / 2], dir: [0, 0, 1] })));
  const plinthToPanel = (col: Col, g: -1 | 1) => {
    const f = faceOf(col, g);
    return [-1, 1].map((k): FitOpts => ({ on: f.key, at: [f.x, P / 2 + 5 + k * 10, zp - t / 2 - 18], dir: [g, 0, 0] }));
  };
  const runnerZ = zf - t - 10 - kit.runLen / 2;
  const runnersOn = (col: Col, g: -1 | 1) => {
    const f = faceOf(col, g);
    const ds = kit.drawers.filter((d) => Math.abs(d.x - col.x) < 1);
    return {
      runners: ds.map((d): FitOpts => ({ on: f.key, at: [f.x, d.y + 4, runnerZ], dir: [g, 0, 0], hole: false })),
      screws: ds.flatMap((d) => [-kit.runLen / 2 + 30, 0, kit.runLen / 2 - 30].map((dz): FitOpts => ({ on: f.key, at: [f.x - g * 6, d.y + 4, runnerZ + dz], dir: [g, 0, 0] }))),
    };
  };
  const topXs = cols === 1 ? [-sx, sx] : [-sx, 0, sx];
  const topBolts: FitOpts[] = topXs.flatMap((x) => [zf - 60, zb + 60].map((z): FitOpts => ({ on: top, at: [x, topY, z], dir: [0, 1, 0], mate: [...sides, mid].find((k) => k && Math.abs(panelX(k) - x) < 1)!, mateHole: 4 })));
  const topBoltsUsed = topBolts;
  const topDowels: FitOpts[] = topXs.flatMap((x) => [sideZ + 60, sideZ - 60].map((z): FitOpts => ({ on: [...sides, mid].find((k) => k && Math.abs(panelX(k) - x) < 1)!, at: [x, topY, z], dir: [0, -1, 0], mate: top })));
  const topCams: FitOpts[] = topBoltsUsed.map((o) => {
    const x = o.at[0];
    const g = x < -1 ? 1 : x > 1 ? -1 : 1;
    return { on: o.mate!, at: [x + g * t / 2, topY - 25, o.at[2]], dir: [-g, 0, 0] };
  });
  const bx = cols === 1 ? [-W / 4, W / 4] : [-W / 3, W / 3];
  const wbracket = () => {
    b.fits(HW.bracket, bx.map((x) => ({ on: top, at: [x, topY, zb + 22] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.2);
    b.then(0.1);
    b.fits(HW.washer, bx.map((x) => ({ on: top, at: [x, topY - 3, zb + 44] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })), 0.15);
    b.then(0.05);
    b.fits(WB_SCREW, bx.map((x) => ({ on: top, at: [x, topY - 3, zb + 44] as Vec3, dir: [0, 1, 0] as Vec3 })), 0.15);
  };
  const ilX = (col: Col) => col.xb;
  const interlock = (col: Col) => {
    const ds = kit.drawers.filter((d) => Math.abs(d.x - col.x) < 1);
    const zl = zr - 60;
    return {
      box: { on: col.right, at: [ilX(col), yb + 40, zl], dir: [1, 0, 0], hole: false } as FitOpts,
      boxScrew: { on: col.right, at: [ilX(col) - 4, yb + 60, zl], dir: [1, 0, 0] } as FitOpts,
      latches: ds.flatMap((d) => [d.y + 20, d.y + kit.sh - 20].map((y): FitOpts => ({ on: col.right, at: [ilX(col), y, zl], dir: [1, 0, 0], hole: false }))),
      stops: ds.flatMap((d) => [d.y + 20, d.y + kit.sh - 20].map((y): FitOpts => ({ on: col.right, at: [ilX(col), y, zl - 30], dir: [1, 0, 0], hole: false }))),
      clips: col.rails.map((r): FitOpts => ({ on: r, at: [col.xb - 50, b.partItem(r).final.pos[1] + t / 2, zr], dir: [0, -1, 0], hole: false })),
      clipStops: col.rails.map((r): FitOpts => ({ on: r, at: [col.xb - 90, b.partItem(r).final.pos[1] + t / 2, zr], dir: [0, -1, 0], hole: false })),
    };
  };
  const pads: FitOpts[] = [
    ...[...sides, ...(mid ? [mid] : [])].flatMap((k) => (cols === 1 ? [zf - 40, zb + 40] : [zf - 40, sideZ, zb + 40]).map((z): FitOpts => ({ on: k, at: [panelX(k), 0, z], dir: [0, 1, 0], hole: false }))),
    ...(cols === 1 ? [-1, 1].map((g): FitOpts => ({ on: columns[0].plinth, at: [g * (columns[0].w / 2 - 60), 10, zp], dir: [0, 1, 0], hole: false })) : []),
  ];

  /* ---------- the carcass ---------- */

  const sg = (i: number): -1 | 1 => (i ? 1 : -1);
  const allPanels = [...sides, ...(mid ? [mid] : [])];
  // laid flat, inside face up
  const staged = (k: string, i: number, count: number) => b.stage(k, [(i - (count - 1) / 2) * (topY + 80), t / 2, 0], [0, 0, panelX(k) > 1 ? -Math.PI / 2 : Math.PI / 2], [0, 160, 0]);

  b.step(
    {
      title: cols === 1 ? "Screw the runners onto both sides" : "Screw the runners onto the sides and the middle panel",
      detail: cols === 1 ? "Lay the sides on a rug, inside faces up. The runners are marked: CR on the right side, CL on the left. Three screws in each." : "Lay the panels on a rug. The runners marked CR go on the left side and the left face of the middle panel, CL on the rest. Three screws in each.",
      tools: ["screwdriver"],
      scene: "prep",
      kind: "runners",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.2);
      allPanels.forEach((k, i) => staged(k, i, allPanels.length));
      b.then(0.2);
      const list = columns.flatMap((c) => [runnersOn(c, -1), runnersOn(c, 1)]);
      b.fits(kit.RUNNER_C, list.flatMap((l) => l.runners), 0.08);
      b.then(0.1);
      b.fits(RUN_SCREW, list.flatMap((l) => l.screws), 0.02);
    },
  );
  b.step(
    {
      title: cols === 1 ? "Screw the cam bolts into both sides" : "Screw the cam bolts into the panels",
      detail: "Into the small holes by the front edge, by hand until they stop.",
      tools: ["screwdriver"],
      scene: "prep",
      kind: "cams",
    },
    () => b.fits(HW.camScrew, columns.flatMap((c) => [-1, 1].flatMap((g) => joints(c, g as -1 | 1).map((j) => j.bolt))), 0.05),
  );

  const lieOn = cols === 1 ? ("-x" as const) : ("-z" as const);
  const plinthSteps = () => {
    b.step(
      {
        title: cols === 1 ? "Screw the corner brackets onto the plinth" : "Screw the corner brackets onto both plinths",
        detail: "One at each end of the back face, two screws each, the bent edge flush with the end.",
        tools: ["screwdriver"],
        scene: "plinth",
        kind: "screws",
      },
      () => {
        columns.forEach((c, i) => b.stage(c.plinth, [c.x, t / 2, (i - (columns.length - 1) / 2) * 200], [Math.PI / 2, 0, 0], [0, 140, 0]));
        b.then(0.15);
        b.fits(CORNER, columns.flatMap(bracketsOf), 0.15);
        b.then(0.1);
        b.fits(BRK_SCREW, columns.flatMap(bracketScrews), 0.08);
      },
    );
  };
  // narrow chests: the right side on the floor, the plinth and rails stand in it
  if (cols === 1) {
    const col = columns[0];
    plinthSteps();
    b.step(
      {
        title: "Lay the right side down and screw the plinth to it",
        detail: "Runners up. The bracket sits against the inside of the side, at the bottom front.",
        tools: ["screwdriver"],
        pose: lieOn,
        kind: "screws",
        warnings: ["floor"],
      },
      () => {
        b.add(sides[1], [-260, 0, 0]);
        b.then(0.15);
        b.add(col.plinth, [-300, 0, 0]);
        b.then(0.1);
        b.fits(BRK_SCREW, plinthToPanel(col, 1), 0.12);
      },
    );
  }
  const railsIn = (col: Col, g: -1 | 1, firstCol: boolean) => {
    const j = joints(col, g);
    const away: Vec3 = cols === 1 ? [-300, 0, 0] : [0, 0, 300];
    b.step(
      { title: "Tap a dowel into each rail", detail: `${n} rails, one dowel in each end.`, tools: ["hammer"], scene: "rails", kind: "dowels", repeat: !firstCol ? undefined : cols === 2 ? 2 : undefined },
      () => {
        b.stagger(0.12);
        col.rails.forEach((r, i) => b.stage(r, [0, t / 2, (i - (n - 1) / 2) * 120], [0, 0, 0], [0, 120, 0]));
        b.then(0.15);
        b.fits(HW.dowel, col.rails.flatMap((r) => [-1, 1].map((gg) => railJoint(col, r, gg as -1 | 1).dowel)), 0.05);
      },
    );
    b.step(
      {
        title: cols === 1 ? "Stand the rails in the side" : "Lay the rails in against the panel",
        detail: "Push each one onto its dowel and cam bolt, the cam holes facing the back.",
        pose: lieOn,
        kind: "join",
      },
      () => {
        b.stagger(0.2);
        for (const r of col.rails) b.add(r, away);
      },
    );
    b.step({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then a clockwise turn until it bites.", tools: ["screwdriver"], pose: lieOn, kind: "cams" }, () =>
      b.fits(HW.cam, j.slice(0, n).map((x) => x.cam), 0.12),
    );
    b.step(
      { title: "Fit the top rail", detail: "Tap a dowel into each end, push it in at the top front with its finished face out, and lock its cam.", tools: ["hammer", "screwdriver"], pose: lieOn, kind: "join" },
      () => {
        b.fits(HW.dowel, [-1, 1].map((gg) => railJoint(col, "top", gg as -1 | 1).dowel), 0.1);
        b.then(0.15);
        b.add(col.topRail, away);
        b.then(0.1);
        b.fits(HW.cam, [j[n].cam], 0.12);
      },
    );
  };

  if (cols === 1) {
    railsIn(columns[0], 1, true);
    b.step(
      { title: "Lower the left side onto the rails", detail: "Its cam bolts go into the holes in the rail ends. Press it down evenly.", pose: lieOn, kind: "join", people: 2, warnings: ["two"] },
      () => b.add(sides[0], [300, 0, 0]),
    );
    b.step({ title: "Lock the cam locks on this side", detail: "Four of them, arrow towards the bolt.", tools: ["screwdriver"], pose: lieOn, kind: "cams" }, () =>
      b.fits(HW.cam, joints(columns[0], -1).map((x) => x.cam), 0.12),
    );
    b.step({ title: "Screw the plinth bracket to this side", detail: "Two screws through the bracket into the side.", tools: ["screwdriver"], pose: lieOn, kind: "screws" }, () =>
      b.fits(BRK_SCREW, plinthToPanel(columns[0], -1), 0.12),
    );
  } else {
    plinthSteps();
    b.step(
      {
        title: "Stand the left side on its front edge and screw a plinth to it",
        detail: "The chest is built lying on its front. Runners facing right, two screws through the bracket.",
        tools: ["screwdriver"],
        pose: lieOn,
        kind: "screws",
        warnings: ["floor"],
      },
      () => {
        b.add(sides[0], [-260, 0, 0]);
        b.then(0.15);
        b.add(columns[0].plinth, [0, 0, 300]);
        b.then(0.1);
        b.fits(BRK_SCREW, plinthToPanel(columns[0], -1), 0.12);
      },
    );
    railsIn(columns[0], -1, true);
    b.step(
      { title: "Push the middle panel onto the rails", detail: "Its cam bolts go into the rail ends. Lock the four cams and screw the plinth bracket to it.", tools: ["screwdriver"], pose: lieOn, kind: "cams", people: 2, warnings: ["two"] },
      () => {
        b.add(mid, [300, 0, 0]);
        b.then(0.15);
        b.fits(HW.cam, joints(columns[0], 1).map((x) => x.cam), 0.1);
        b.then(0.1);
        b.fits(BRK_SCREW, plinthToPanel(columns[0], 1), 0.12);
      },
    );
    b.step(
      { title: "Screw the second plinth to the middle panel", detail: "The same way, on the right of the middle panel.", tools: ["screwdriver"], pose: lieOn, kind: "screws" },
      () => {
        b.add(columns[1].plinth, [0, 0, 300]);
        b.then(0.1);
        b.fits(BRK_SCREW, plinthToPanel(columns[1], -1), 0.12);
      },
    );
    railsIn(columns[1], -1, false);
    b.step(
      { title: "Push the right side onto the rails", detail: "Lock the four cams and screw the plinth bracket to it.", tools: ["screwdriver"], pose: lieOn, kind: "cams", people: 2, warnings: ["two"] },
      () => {
        b.add(sides[1], [300, 0, 0]);
        b.then(0.15);
        b.fits(HW.cam, joints(columns[1], 1).map((x) => x.cam), 0.1);
        b.then(0.1);
        b.fits(BRK_SCREW, plinthToPanel(columns[1], 1), 0.12);
      },
    );
  }

  // the top: wall brackets and cam bolts while it lies upside down, then dowels and cams
  b.step(
    { title: "Screw the wall brackets under the top", detail: "Lay the top upside down. Near the back edge, a washer under each screw; leave them a little loose.", tools: ["screwdriver"], scene: "top", kind: "screws", warnings: ["face"] },
    () => {
      b.stage(top, [0, t / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
      b.then(0.15);
      wbracket();
    },
  );
  b.step({ title: "Screw the cam bolts into the top", detail: "By hand until they stop.", tools: ["screwdriver"], scene: "top", kind: "cams" }, () => b.fits(HW.camScrew, topBoltsUsed, 0.12));
  b.step(
    { title: "Tap the dowels in and push the top on", detail: cols === 1 ? "Two dowels in the top edge of each side, then slide the top onto them and its cam bolts." : "A dowel in the top edge of each panel, then push the top onto them.", tools: ["hammer"], pose: lieOn, kind: "join" },
    () => {
      b.fits(HW.dowel, topDowels, 0.08);
      b.then(0.2);
      b.add(top, cols === 1 ? [0, 300, 0] : [0, 300, 0]);
    },
  );
  b.step({ title: "Lock the top with cam locks", detail: "Just under the top, in the sides.", tools: ["screwdriver"], pose: lieOn, kind: "cams" }, () => b.fits(HW.cam, topCams, 0.1));

  // the back
  if (cols === 1) {
    const pieces = [strip, ...backs];
    const dowelsOf = (k: string, i: number): FitOpts[] => {
      const it = b.partItem(k);
      const sz = b.parts.find((p) => p.id === it.ref)!.size;
      const y = it.final.pos[1] + sz[1] / 2;
      return [-1, 1].map((g): FitOpts => ({ on: k, at: [g * (xi - 80), y, zBk], dir: [0, -1, 0], mate: i ? pieces[i - 1] : top }));
    };
    b.step(
      { title: "Tap the dowels into the back pieces", detail: "Two in the top edge of the strip and of each board.", tools: ["hammer"], scene: "back", kind: "dowels" },
      () => {
        b.stagger(0.15);
        pieces.forEach((k, i) => b.stage(k, [0, 4, (i - (pieces.length - 1) / 2) * 260], [-Math.PI / 2, 0, 0], [0, 120, 0]));
        b.then(0.15);
        b.fits(HW.dowel, pieces.flatMap((k, i) => dowelsOf(k, i)), 0.06);
      },
    );
    b.step({ title: "Slide the strip in under the top", detail: "Down the grooves in both sides from the open bottom end, all the way to the top.", pose: lieOn, kind: "join" }, () => b.add(strip, [0, -500, 0]));
    b.step(
      { title: "Slide the back boards in after it", detail: "Finished side out. Each one pushes onto the dowels of the one before.", pose: lieOn, kind: "join" },
      () => {
        b.stagger(0.3);
        for (const k of backs) b.add(k, [0, -600, 0]);
      },
    );
    b.step(
      { title: "Put in the two long back screws", detail: "Through the bottom board at each corner, a few turns only for now.", tools: ["allen"], pose: lieOn, kind: "screws" },
      () => b.fits(BACK_SCREW, [-1, 1].map((g): FitOpts => ({ on: backs[backs.length - 1], at: [g * (xi + 9), 40, zBk - 4], dir: [0, 0, 1], mate: sides[g < 0 ? 0 : 1] })), 0.2),
    );
  } else {
    b.step(
      { title: "Slide the two back panels in", detail: "Into the grooves, one for each half, smooth side out.", pose: lieOn, kind: "join", warnings: ["square"] },
      () => {
        b.stagger(0.3);
        for (const k of backs) b.add(k, [0, -700, 0]);
      },
    );
    b.step(
      { title: "Fix the back panels with the rivets", detail: "Push a sleeve through each hole, then press its pin in until it's flush.", pose: lieOn, kind: "general" },
      () => {
        const pts = backs.flatMap((k) => {
          const x = b.partItem(k).final.pos[0];
          return [-1, 1].map((g): FitOpts => ({ on: k, at: [x + g * 120, 30, zBk - 2], dir: [0, 0, 1] }));
        });
        b.fits(RIVET, pts, 0.12);
        b.then(0.1);
        b.fits(RIVET_PIN, pts.map((p) => ({ ...p, at: [p.at[0], p.at[1], p.at[2] - 1] as Vec3 })), 0.12);
      },
    );
  }

  // the drawer interlock, inside the right-hand panel of each column, through the open front
  b.step(
    { title: "Screw the interlock box inside the right side", detail: "The box marked R, at the bottom front, one screw.", tools: ["screwdriver"], pose: cols === 1 ? lieOn : "+z", kind: "screws" },
    () => {
      for (const c of columns) {
        const il = interlock(c);
        b.fit(BOX, il.box);
        b.then(0.1);
        b.fit(BOX_SCREW, il.boxScrew);
      }
    },
  );
  b.step(
    { title: "Clip the interlock latches into the holes", detail: "Up the front of the side, each one pushed in until it clicks, the cord running through them.", pose: cols === 1 ? lieOn : "+z", kind: "general" },
    () => b.fits(LATCH, columns.flatMap((c) => interlock(c).latches), 0.08),
  );
  b.step({ title: "Push in the stops", detail: "Behind the latches, one in each hole.", pose: cols === 1 ? lieOn : "+z", kind: "general" }, () => b.fits(STOP, columns.flatMap((c) => interlock(c).stops), 0.06));
  if (cols === 1)
    b.step({ title: "Tighten the long back screws", detail: "All the way in with the Allen key, the washer flat on the board.", tools: ["allen"], pose: lieOn, kind: "screws" }, () => {});
  b.step(
    { title: "Turn it onto its back and clip on the catches", detail: "A catch clip and a stop on each rail, by the right-hand side.", pose: "+z", kind: "general", warnings: ["floor"] },
    () => {
      b.fits(CATCH_CLIP, columns.flatMap((c) => interlock(c).clips), 0.1);
      b.then(0.1);
      b.fits(STOP, columns.flatMap((c) => interlock(c).clipStops), 0.08);
    },
  );
  b.step({ title: "Push the foot pads into the bottom edges", detail: cols === 1 ? "Two under each side and two under the plinth." : "Three under each panel.", pose: "+z", kind: "general" }, () => b.fits(PAD, pads, 0.1));
  b.step({ title: "Stand it up", detail: "Lift it with two people, by the sides.", kind: "standup", people: 2, warnings: ["two"] }, () => {});
  wallSteps(b, top, bx, topY, zb);
  drawerSteps(b, kit, { wire: true, catch: true, pins: "back" });
  void spread;
  return true;
}

function nightstand(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const topY = H - t;
  const sx = W / 2 - 2 - t / 2, xi = W / 2 - 2 - t;
  const zb = -D / 2, zf = D / 2 - 2;
  const sideD = zf - zb, sideZ = (zf + zb) / 2;
  const P = 60;
  const sideT = b.part("Side panel", [t, topY, sideD]);
  const sides = [b.place(sideT, [-sx, topY / 2, sideZ]), b.place(sideT, [sx, topY / 2, sideZ])];
  const top = b.place(b.part("Top panel", [W, t, D]), [0, H - t / 2, 0]);
  const railY = topY - 25;
  const rail = b.place(b.part("Top rail", [2 * xi, 50, t]), [0, railY, zf - t / 2]);
  const backT = b.part("Back panel", [2 * xi, topY - P - 10, t]);
  const back = b.place(backT, [0, P + 10 + (topY - P - 10) / 2, zb + t / 2]);
  const bottom = b.place(b.part("Bottom panel", [2 * xi + 16, 8, sideD - t - 20]), [0, P + 4, zb + t + (sideD - t - 20) / 2]);
  const plinth = b.place(b.part("Plinth", [2 * xi, P - 10, t]), [0, 10 + (P - 10) / 2, zf - t / 2 - 30]);
  const slotTop = railY - 25;
  const kit = drawerKit(b, { cols: [{ xa: -xi, xb: xi }], slots: [{ c: 0, y0: slotTop - 170, y1: slotTop }], zf, zBack: zb + t + 10, small: true });
  const d0 = kit.drawers[0];
  const runZ = zf - t - 10 - kit.runLen / 2;
  const PLASTIC_RUNNER: HwDef = { kind: "runner", len: kit.runLen, dia: 20, name: "Plastic runner" };

  const sg = (i: number) => (i ? 1 : -1);
  b.step(
    { title: "Screw a runner onto each side", detail: "Lay the sides on a rug, inside faces up. Two screws in each runner.", tools: ["screwdriver"], scene: "prep", kind: "runners", warnings: ["floor"] },
    () => {
      b.stagger(0.2);
      sides.forEach((k, i) => b.stage(k, [(i - 0.5) * (topY + 80), t / 2, 0], [0, 0, i ? -Math.PI / 2 : Math.PI / 2], [0, 160, 0]));
      b.then(0.2);
      b.fits(PLASTIC_RUNNER, [0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * xi, d0.y + 4, runZ], dir: [sg(i), 0, 0], hole: false })), 0.15);
      b.then(0.1);
      b.fits(RUN_SCREW, [0, 1].flatMap((i) => [-1, 1].map((k): FitOpts => ({ on: sides[i], at: [sg(i) * (xi - 6), d0.y + 4, runZ + k * (kit.runLen / 2 - 30)], dir: [sg(i), 0, 0] }))), 0.1);
    },
  );
  const joint = (k: string, i: number, y: number, z: number, camDir: Vec3, camAt: Vec3) => ({
    bolt: { on: sides[i], at: [sg(i) * xi, y, z], dir: [-sg(i), 0, 0], mate: k, mateHole: 4 } as FitOpts,
    cam: { on: k, at: camAt, dir: camDir } as FitOpts,
  });
  const backYs = [P + 60, topY - 60];
  const railJ = (i: number) => joint(rail, i, railY - 12, zf - t / 2, [0, 0, 1], [sg(i) * (xi - 25), railY - 12, zf - t]);
  const backJ = (i: number) => backYs.map((y) => joint(back, i, y, zb + t / 2, [0, 0, -1], [sg(i) * (xi - 25), y, zb + t]));
  b.step({ title: "Screw the cam bolts into both sides", detail: "Three in each, by hand until they stop.", tools: ["screwdriver"], scene: "prep", kind: "cams" }, () =>
    b.fits(HW.camScrew, [0, 1].flatMap((i) => [railJ(i).bolt, ...backJ(i).map((j) => j.bolt)]), 0.08),
  );
  const dowelsBack = [0, 1].flatMap((i) => [P + 120, topY - 120].map((y): FitOpts => ({ on: back, at: [sg(i) * xi, y, zb + t / 2], dir: [sg(i), 0, 0], mate: sides[i] })));
  const dowelsRail = [0, 1].map((i): FitOpts => ({ on: rail, at: [sg(i) * xi, railY + 12, zf - t / 2], dir: [sg(i), 0, 0], mate: sides[i] }));
  b.step({ title: "Tap the dowels into the back and the top rail", detail: "Two in each edge of the back, one in each end of the rail.", tools: ["hammer"], scene: "rails", kind: "dowels" }, () => {
    b.stage(back, [0, t / 2, -200], [Math.PI / 2, 0, 0], [0, 120, 0]);
    b.stage(rail, [0, t / 2, 160], [Math.PI / 2, 0, 0], [0, 120, 0]);
    b.then(0.15);
    b.fits(HW.dowel, [...dowelsBack, ...dowelsRail], 0.06);
  });
  b.step({ title: "Lay the right side down and stand the rail in it", detail: "Runner up. Push the rail onto its dowel and lock its cam.", tools: ["screwdriver"], pose: "-x", kind: "join", warnings: ["floor"] }, () => {
    b.add(sides[1], [-260, 0, 0]);
    b.then(0.15);
    b.add(rail, [-300, 0, 0]);
    b.then(0.1);
    b.fit(HW.cam, railJ(1).cam);
  });
  b.step({ title: "Stand the back in and lock it", detail: "Finished side out, two cam locks.", tools: ["screwdriver"], pose: "-x", kind: "cams" }, () => {
    b.add(back, [-300, 0, 0]);
    b.then(0.1);
    b.fits(HW.cam, backJ(1).map((j) => j.cam), 0.12);
  });
  b.step({ title: "Lower the left side on and lock it", detail: "Its cam bolts go into the rail and the back. Three cam locks.", tools: ["screwdriver"], pose: "-x", kind: "cams" }, () => {
    b.add(sides[0], [300, 0, 0]);
    b.then(0.15);
    b.fits(HW.cam, [railJ(0).cam, ...backJ(0).map((j) => j.cam)], 0.12);
  });
  b.step({ title: "Turn it upside down and slide in the bottom", detail: "Down the grooves from the front until it meets the back.", pose: "-y", kind: "join", warnings: ["floor"] }, () => b.add(bottom, [0, 0, 400]));
  b.step({ title: "Fix the bottom with the rivets", detail: "Two at the front edge: push in the sleeve, then press its pin in flush.", pose: "-y", kind: "general" }, () => {
    const pts = [-1, 1].map((g): FitOpts => ({ on: bottom, at: [g * (xi - 60), P, zf - t - 40], dir: [0, 1, 0] }));
    b.fits(RIVET, pts, 0.12);
    b.then(0.1);
    b.fits(RIVET_PIN, pts.map((p) => ({ ...p, at: [p.at[0], p.at[1] - 1, p.at[2]] as Vec3 })), 0.12);
  });
  b.step({ title: "Push the foot pads into the sides", detail: "Two in the bottom edge of each side.", pose: "-y", kind: "general" }, () =>
    b.fits(PAD, [0, 1].flatMap((i) => [zf - 40, zb + 40].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * sx, 0, z], dir: [0, 1, 0], hole: false }))), 0.1),
  );
  const brX = [-(xi - 50), 0, xi - 50];
  b.step({ title: "Fit the plinth's pads and brackets", detail: "Two pads in its bottom edge, then three brackets on its back face, one screw each.", tools: ["screwdriver"], scene: "plinth", kind: "screws" }, () => {
    b.stage(plinth, [0, t / 2, 0], [Math.PI / 2, 0, 0], [0, 140, 0]);
    b.then(0.15);
    b.fits(PAD, [-1, 1].map((g): FitOpts => ({ on: plinth, at: [g * (xi - 60), 10, zf - t / 2 - 30], dir: [0, 1, 0], hole: false })), 0.12);
    b.then(0.1);
    b.fits({ ...CORNER, name: "Plinth bracket" }, brX.map((x): FitOpts => ({ on: plinth, at: [x, P - 10, zf - t - 30], dir: [0, 0, 1], hole: false })), 0.12);
    b.then(0.1);
    b.fits(BRK_SCREW, brX.map((x): FitOpts => ({ on: plinth, at: [x, P - 25, zf - t - 30], dir: [0, 0, 1] })), 0.1);
  });
  b.step({ title: "Screw the plinth under the bottom", detail: "At the front, set back from the edge. One screw through each bracket.", tools: ["screwdriver"], pose: "-y", kind: "screws" }, () => {
    b.add(plinth, [0, -260, 0]);
    b.then(0.15);
    b.fits(BRK_SCREW, brX.map((x): FitOpts => ({ on: plinth, at: [x, P, zf - t - 45], dir: [0, 1, 0], mate: bottom })), 0.12);
  });
  const topBolts = [0, 1].flatMap((i) => [zf - 60, zb + 60].map((z): FitOpts => ({ on: top, at: [sg(i) * sx, topY, z], dir: [0, 1, 0], mate: sides[i], mateHole: 4 })));
  b.step({ title: "Screw the cam bolts into the top", detail: "Lay it upside down on a rug, by hand until they stop.", tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["face"] }, () => {
    b.stage(top, [0, t / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
    b.then(0.15);
    b.fits(HW.camScrew, topBolts, 0.12);
  });
  b.step({ title: "Stand it up and put the top on", detail: "Tap two dowels into the top of each side, then lower the top onto them.", tools: ["hammer"], kind: "join" }, () => {
    b.fits(HW.dowel, [0, 1].flatMap((i) => [sideZ + 60, sideZ - 60].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * sx, topY, z], dir: [0, -1, 0], mate: top }))), 0.08);
    b.then(0.2);
    b.add(top, [0, 300, 0]);
  });
  b.step({ title: "Lock the top with cam locks", detail: "Two in each side, just under the top.", tools: ["screwdriver"], kind: "cams" }, () =>
    b.fits(HW.cam, topBolts.map((o, i): FitOpts => ({ on: sides[i < 2 ? 0 : 1], at: [o.at[0] + (i < 2 ? t / 2 : -t / 2), topY - 25, o.at[2]], dir: [i < 2 ? -1 : 1, 0, 0] })), 0.12),
  );
  b.step({ title: "Clip in the catches and stops", detail: "Inside the right side, under the top rail: three clips, each with its stop.", kind: "general" }, () => {
    const pts = [0, 1, 2].map((k): FitOpts => ({ on: sides[1], at: [xi, d0.y + kit.sh - 10, zf - t - 40 - k * 30], dir: [1, 0, 0], hole: false }));
    b.fits(CATCH_CLIP, pts, 0.1);
    b.then(0.1);
    b.fits(STOP, pts.map((p) => ({ ...p, at: [p.at[0], p.at[1] - 16, p.at[2]] as Vec3 })), 0.1);
  });
  drawerSteps(b, kit, { wire: false, catch: false, pins: "screws", stops: true, runners: false });
  return true;
}

const family: Family = {
  names: ["LILLBERGET"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (/nightstand/.test(slug)) return nightstand(b, s);
    const m = /chest-(\d+)-drawers/.exec(slug);
    if (!m) return false;
    const n = Number(m[1]);
    if (n === 6) return chest(b, s, 3, 2);
    if (n === 3 || n === 5) return chest(b, s, n, 1);
    return false;
  },
};
export default family;
