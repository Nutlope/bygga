import type { Pose, ProductSpec, StepKind, ToolId, Vec3 } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "../builder";
import type { Family } from "./family";

/*
 * STORKLINTA, read from IKEA's manuals.
 *
 * Chests (2, 3, 4, 5 and both 6 drawer manuals): the carcass clicks together without tools. The runners are screwed
 * onto the sides lying flat, then, with the chest lying on its front, a side stands up, the bottom clicks into it,
 * the other side and the top (with its wall brackets) click on and the board back slides down grooves in the sides.
 * Turned onto its back, the plinth rail is screwed in with two L brackets, plastic stops go in the front edges and,
 * on the chests of 3 or more, the interlock (only one drawer opens at a time) is clipped inside. Each drawer is built
 * on its front: the sides click into the front, the bottom slides in, the back goes on with cam pins and cam locks,
 * then the runners. The bedside table adds a glass top held by two clips.
 *
 * The US 2-drawer chest and nightstand (one manual) go together the older way, with dowels, cam bolts and cam locks.
 */

const t = 16;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

// fittings, sized so different ones stay apart in the list
const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const EURO_SCREW: HwDef = { kind: "screw", len: 10, dia: 5 };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const LOCK_SCREW: HwDef = { kind: "screw", len: 8, dia: 5 };
const WALL_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 35, dia: 8 };
const U_BRACKET: HwDef = { kind: "angle", len: 50, dia: 30 };
const RIVET: HwDef = { kind: "clip", len: 30, dia: 10 };
const RIVET_PIN: HwDef = { kind: "stud", len: 30, dia: 5 };
const LOCK_BOX: HwDef = { kind: "connector", len: 90, dia: 50 };
const CABLE_CLIP: HwDef = { kind: "clip", len: 22, dia: 14 };
const CAP: HwDef = { kind: "cap", len: 8, dia: 14 };
const STOP: HwDef = { kind: "clip", len: 16, dia: 18 };
const FRONT_L: HwDef = { kind: "clip", len: 60, dia: 30 };
const FRONT_BAR: HwDef = { kind: "clip", len: 70, dia: 14 };
const ROD: HwDef = { kind: "hook", len: 90, dia: 20 };
const CATCH: HwDef = { kind: "clip", len: 40, dia: 24 };
const GLASS_CLIP: HwDef = { kind: "angle", len: 20, dia: 16 };
const GLASS_SCREW: HwDef = { kind: "screw", len: 14, dia: 3.5 };

/* ---------- the click-together chests ---------- */

interface Cfg {
  cols: 1 | 2;
  levels: number; // drawer heights in a column
  split: boolean; // the top level holds two small drawers either side of a divider
  interlock: boolean;
  backPieces: number; // back boards per bay, joined with dowels
  wall: 1 | 2;
  uBrackets: boolean; // the brackets under the top that hold the back
  midRail: boolean; // the tall narrow chest has a rail across the back at mid height
  steelRail: boolean; // a steel rail under the small drawers
  stops: number; // two-part drawer stops
  frontL: number;
  frontBar: number;
  glass: boolean;
}

function clickCfg(s: ProductSpec): Cfg | null {
  const v = s.variant;
  const base: Cfg = { cols: 1, levels: 2, split: false, interlock: false, backPieces: 1, wall: 1, uBrackets: false, midRail: false, steelRail: false, stops: 4, frontL: 2, frontBar: 2, glass: false };
  if (/^bedside table with glass top/i.test(v)) return { ...base, glass: true };
  const m = /^chest of (\d) drawers/i.exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  const lock = { ...base, interlock: true, uBrackets: true };
  if (n === 2) return base;
  if (n === 3 || n === 4) return { ...lock, levels: n, backPieces: 2, wall: 2, stops: n };
  if (n === 5) return { ...lock, levels: 5, midRail: true, stops: 5 };
  if (n === 6 && s.size.w < 100) return { ...lock, levels: 5, split: true, backPieces: 3, wall: 2, steelRail: true, stops: 5 };
  if (n === 6) return { ...lock, cols: 2, levels: 3, uBrackets: false, wall: 2, stops: 8, frontL: 4, frontBar: 3 };
  return null;
}

interface Cell {
  bay: number;
  level: number;
  x0: number;
  x1: number;
  small: boolean;
}
interface Drawer {
  cell: Cell;
  y: number; // underside of the box
  xs: number[]; // drawer side centres
  front: string;
  sides: string[];
  bottom: string;
  back: string;
}

function buildClick(b: PlanBuilder, s: ProductSpec, c: Cfg) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const P = 40; // plinth height
  const yB = P + t, yT = H - t; // top of the bottom panel, underside of the top
  const zf = D / 2;
  const zBack = -D / 2 + 16; // front face of the back boards
  const backZ = -D / 2 + 12;
  const pitch = (yT - yB) / c.levels;
  const slot = (i: number) => yB + i * pitch;
  const fh = pitch - 6;
  const sh = Math.min(fh - 40, 160);
  const zLimit = zBack + (c.midRail ? t : 0) + 10;
  const dd = zf - 18 - zLimit;
  const runLen = Math.round((dd - 40) / 10) * 10;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 20 };
  const yBox = (i: number) => slot(i) + 13;
  const zRun = zf - 30 - runLen / 2;

  // the upright panels: two sides, and the middle panel of the wide chest
  const vx = c.cols === 2 ? [-(W / 2 - t / 2), 0, W / 2 - t / 2] : [-(W / 2 - t / 2), W / 2 - t / 2];
  const sideT = b.part("Side panel", [t, H - t, D]);
  const midT = c.cols === 2 ? b.part("Middle panel", [t, H - t, D]) : "";
  const verts = vx.map((x, i) => b.place(i === 1 && c.cols === 2 ? midT : sideT, [x, (H - t) / 2, 0]));
  const sides = [verts[0], verts[verts.length - 1]];
  const bays: [number, number][] = c.cols === 2 ? [[-W / 2 + t, -t / 2], [t / 2, W / 2 - t]] : [[-W / 2 + t, W / 2 - t]];
  const bw = bays[0][1] - bays[0][0];
  const bcx = bays.map(([a, z]) => (a + z) / 2);
  const top = b.place(b.part("Top panel", [W, t, D]), [0, H - t / 2, 0]);
  const bottomT = b.part("Bottom panel", [bw, t, D - 16]);
  const bottoms = bcx.map((x) => b.place(bottomT, [x, P + t / 2, 8]));
  const zp = zf - 20 - t / 2;
  const plinthT = b.part("Plinth rail", [bw, P, t]);
  const plinths = bcx.map((x) => b.place(plinthT, [x, P / 2, zp]));
  const hp = (yT - P) / c.backPieces;
  const backT = b.part(c.backPieces > 1 ? "Back board" : "Back panel", [bw, hp, 8]);
  const backs = bcx.map((x) => range(c.backPieces).map((j) => b.place(backT, [x, P + hp * (j + 0.5), backZ])));
  const backAt = (bay: number, y: number) => backs[bay][Math.max(0, Math.min(c.backPieces - 1, Math.floor((y - P) / hp)))];
  const midRail = c.midRail ? b.place(b.part("Back rail", [bw, 80, t]), [0, H / 2, zBack + t / 2]) : "";
  const ySplit = slot(c.levels - 1);
  const divider = c.split ? b.place(b.part("Divider", [t, yT - ySplit, zf - 20 - zBack]), [0, (ySplit + yT) / 2, (zf - 20 + zBack) / 2]) : "";
  const steel = c.steelRail ? b.place(b.part("Steel rail", [2 * (W / 2 - t), 15, 40], { material: "metal" }), [0, ySplit - 7.5, zf - 40]) : "";

  // which panel each inner face belongs to
  const faceOf = (x: number, y: number): { key: string; dir: number } => {
    if (divider && Math.abs(Math.abs(x) - t / 2) < 1 && y > ySplit) return { key: divider, dir: x > 0 ? -1 : 1 };
    const i = vx.findIndex((v) => Math.abs(Math.abs(x - v) - t / 2) < 1);
    return { key: verts[i], dir: x > vx[i] ? -1 : 1 };
  };

  // the drawer cells, bottom to top
  const cells: Cell[] = [];
  for (const [bay, [x0, x1]] of bays.entries())
    for (const level of range(c.levels)) {
      if (c.split && level === c.levels - 1) {
        cells.push({ bay, level, x0, x1: -t / 2, small: true });
        cells.push({ bay, level, x0: t / 2, x1, small: true });
      } else cells.push({ bay, level, x0, x1, small: false });
    }

  /* ---------- runners on the sides ---------- */

  const cabRunner = (cl: Cell, x: number) => {
    const f = faceOf(x, yBox(cl.level));
    const y = yBox(cl.level) - 6;
    return {
      runner: { on: f.key, at: [x, y, zRun] as Vec3, dir: [-f.dir, 0, 0] as Vec3, hole: false as const },
      screws: [-runLen / 2 + 30, 0, runLen / 2 - 30].map((dz): FitOpts => ({ on: f.key, at: [x - f.dir * 2, y, zRun + dz], dir: [f.dir, 0, 0] })),
      key: f.key,
    };
  };
  const runnersOn = (key: string) => {
    const list = cells.flatMap((cl) => [cabRunner(cl, cl.x0), cabRunner(cl, cl.x1)]).filter((r) => r.key === key);
    return { runners: list.map((r) => r.runner), screws: list.flatMap((r) => r.screws) };
  };
  // the panels lie flat, inside faces up; the middle panel shows its left face first
  const lay = (key: string, x: number, z: number, faceRight: boolean) =>
    b.stage(key, [0, t / 2, z], [0, 0, faceRight ? -Math.PI / 2 : Math.PI / 2], [0, 160, 0]);
  const gapZ = D + 120;
  b.step(
    {
      title: c.cols === 2 ? "Screw the runners onto the sides and the middle panel" : "Screw the runners onto both sides",
      detail: "Lay the panels on something soft, inside faces up. The runners are marked for the left and right; the wheel goes at the front.",
      tools: ["screwdriver"],
      scene: "prep",
      kind: "runners",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.2);
      lay(sides[0], vx[0], -gapZ / 2 * (c.cols === 2 ? 2 : 1), false);
      lay(sides[1], vx[vx.length - 1], gapZ / 2 * (c.cols === 2 ? 2 : 1), true);
      if (c.cols === 2) lay(verts[1], 0, 0, true);
      b.then(0.2);
      for (const k of verts) {
        const r = runnersOn(k);
        const left = c.cols === 2 && k === verts[1] ? r.runners.filter((o) => o.at[0] < 0) : r.runners;
        const ls = c.cols === 2 && k === verts[1] ? r.screws.filter((o) => o.at[0] < 0) : r.screws;
        b.fits(RUNNER, left, 0.12);
        b.then(0.05);
        b.fits(RUNNER_SCREW, ls, 0.03);
      }
    },
  );
  if (c.cols === 2) {
    b.step(
      {
        title: "Turn the middle panel over and screw on its other runners",
        detail: "These are for the right-hand drawers.",
        tools: ["screwdriver"],
        scene: "prep",
        kind: "runners",
      },
      () => {
        lay(verts[1], 0, 0, false);
        b.then(0.15);
        const r = runnersOn(verts[1]);
        b.fits(RUNNER, r.runners.filter((o) => o.at[0] > 0), 0.12);
        b.then(0.05);
        b.fits(RUNNER_SCREW, r.screws.filter((o) => o.at[0] > 0), 0.03);
      },
    );
  }

  /* ---------- the carcass, lying on its front ---------- */

  const up: Vec3 = [0, 0, -1]; // with the back facing up, "above" is behind the chest
  const lift = (d: number): Vec3 => [up[0] * d, up[1] * d, up[2] * d];
  b.step(
    {
      title: "Stand a side up and click the bottom into it",
      detail: "The chest is built lying on its front. Stand the side on its front edge, push the bottom onto the fittings and press down until it clicks.",
      pose: "-z",
      kind: "join",
      warnings: ["floor"],
    },
    () => {
      b.add(sides[0], lift(260));
      b.then(0.15);
      b.add(bottoms[0], [260, 0, 0]);
    },
  );
  if (c.cols === 2) {
    b.step(
      { title: "Click the middle panel onto the bottom", detail: "Press it down at the top and the bottom until both fittings click.", pose: "-z", kind: "join" },
      () => b.add(verts[1], [300, 0, -200]),
    );
    b.step(
      { title: "Click the second bottom into the middle panel", detail: "Same as the first one: push it on and press down.", pose: "-z", kind: "join" },
      () => b.add(bottoms[1], [300, 0, 0]),
    );
  }
  if (midRail)
    b.step(
      { title: "Click the back rail into the side", detail: "It goes halfway up, at the back edge, next to the groove for the back.", pose: "-z", kind: "join" },
      () => b.add(midRail, [260, 0, 0]),
    );
  b.step(
    {
      title: "Click the other side on",
      detail: "Line its fittings up with the bottom and press it down until it clicks.",
      pose: "-z",
      kind: "join",
    },
    () => b.add(sides[1], [200, 0, -260]),
  );

  // the top, upside down, takes the wall brackets (and the brackets that hold the back)
  const wallX = c.wall === 1 ? [0] : c.cols === 2 ? [-W / 4, W / 4] : [-(W / 2 - t - 70), W / 2 - t - 70];
  const uX = c.uBrackets ? (c.wall === 1 ? [-(bw / 2 - 50), bw / 2 - 50] : [-W / 8, W / 8]) : [];
  const topScene = () => {
    b.stage(top, [0, t / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
    if (divider) {
      const it = b.partItem(divider);
      b.stage(divider, [0, t / 2 - (it.final.pos[1] - (H - t / 2)), it.final.pos[2]], [0, 0, Math.PI], [0, -200, 0]);
    }
  };
  if (c.split) {
    const div = (faceRight: boolean) => b.stage(divider, [0, t / 2, 0], [0, 0, faceRight ? -Math.PI / 2 : Math.PI / 2], [0, 160, 0]);
    const r = runnersOn(divider);
    b.step(
      { title: "Screw a runner onto the divider", detail: "Lay it flat. One runner on this face, for the right-hand small drawer.", tools: ["screwdriver"], scene: "divider", kind: "runners" },
      () => {
        div(false);
        b.then(0.15);
        b.fits(RUNNER, r.runners.filter((o) => o.at[0] > 0), 0.12);
        b.fits(RUNNER_SCREW, r.screws.filter((o) => o.at[0] > 0), 0.05);
      },
    );
    b.step(
      { title: "Turn it over and screw on the other runner", detail: "This one is for the left-hand small drawer.", tools: ["screwdriver"], scene: "divider", kind: "runners" },
      () => {
        div(true);
        b.then(0.15);
        b.fits(RUNNER, r.runners.filter((o) => o.at[0] < 0), 0.12);
        b.fits(RUNNER_SCREW, r.screws.filter((o) => o.at[0] < 0), 0.05);
      },
    );
    b.step(
      { title: "Click the divider onto the top", detail: "Lay the top upside down. The divider stands in the middle, its runners along the length.", scene: "top", kind: "join", warnings: ["face"] },
      () => topScene(),
    );
  }
  b.step(
    {
      title: c.wall === 1 ? "Screw the wall bracket under the top" : "Screw the wall brackets under the top",
      detail: c.split ? "Near the back edge, either side. A washer under each screw; leave them a little loose." : "Lay the top upside down on something soft. A washer goes under each screw; leave them a little loose.",
      tools: ["screwdriver"],
      scene: "top",
      kind: "screws",
      warnings: c.split ? [] : ["face"],
    },
    () => {
      if (!c.split) {
        topScene();
        b.then(0.15);
      }
      b.fits(HW.bracket, wallX.map((x): FitOpts => ({ on: top, at: [x, yT, -D / 2 + 22], dir: [0, 1, 0], hole: false })), 0.2);
      b.then(0.1);
      b.fits(HW.washer, wallX.map((x): FitOpts => ({ on: top, at: [x, yT - 3, -D / 2 + 44], dir: [0, 1, 0], hole: false })), 0.15);
      b.fits(BRACKET_SCREW, wallX.map((x): FitOpts => ({ on: top, at: [x, yT - 3, -D / 2 + 44], dir: [0, 1, 0] })), 0.15);
    },
  );
  if (c.uBrackets)
    b.step(
      {
        title: "Screw the two back brackets under the top",
        detail: "Their hooks point to the back edge. The back panel slides in under them later.",
        tools: ["screwdriver"],
        scene: "top",
        kind: "screws",
      },
      () => {
        b.fits(U_BRACKET, uX.map((x): FitOpts => ({ on: top, at: [x, yT, zBack + 14], dir: [0, 1, 0], hole: false })), 0.2);
        b.then(0.1);
        b.fits(EURO_SCREW, uX.map((x): FitOpts => ({ on: top, at: [x, yT - 2, zBack + 26], dir: [0, 1, 0] })), 0.15);
      },
    );
  b.step(
    {
      title: "Click the top onto the sides",
      detail: c.split ? "The divider goes in between the sides. Press down at each corner until it clicks." : "Press down at each corner until it clicks.",
      pose: "-z",
      kind: "join",
    },
    () => {
      b.stagger(0);
      b.add(top, [0, 260, -200]);
      if (divider) b.add(divider, [0, 260, -200]);
    },
  );

  // the back slides down the grooves from the bottom end
  if (c.backPieces > 1)
    b.step(
      {
        title: c.backPieces > 2 ? "Join the back boards with dowels" : "Join the two back boards with dowels",
        detail: "Tap the dowels into the edge of one board and push the next one on. Lay them flat to do it.",
        tools: ["hammer"],
        scene: "back",
        kind: "dowels",
      },
      () => {
        b.stagger(0.2);
        const bk = backs[0];
        const it0 = b.partItem(bk[0]);
        for (const k of bk) {
          const it = b.partItem(k);
          b.stage(k, [0, 4, -(it.final.pos[1] - it0.final.pos[1]) - hp], [Math.PI / 2, 0, 0], [0, 120, 0]);
        }
        b.then(0.15);
        const list: FitOpts[] = [];
        for (const j of range(c.backPieces - 1)) for (const dx of [-bw / 4, bw / 4]) list.push({ on: bk[j], at: [bcx[0] + dx, P + hp * (j + 1), backZ], dir: [0, 1, 0], mate: bk[j + 1] });
        b.fits(HW.dowel, list, 0.1);
      },
    );
  b.step(
    {
      title: c.cols === 2 ? "Slide the back panels down the grooves" : c.backPieces > 1 ? "Slide the back down the grooves" : "Slide the back panel down the grooves",
      detail: c.uBrackets
        ? "Feed it in at the bottom end and push it all the way to the top, under the brackets."
        : c.cols === 2
          ? "One in each half, from the bottom end, pushed all the way to the top."
          : "Feed it in at the bottom end and push it all the way to the top.",
      pose: "-z",
      kind: "join",
    },
    () => {
      b.stagger(0.25);
      for (const bk of backs) {
        b.stagger(0);
        for (const k of bk) b.add(k, [0, -(H + 100), 0]);
        b.wait(0.3);
      }
    },
  );
  if (!c.interlock) {
    b.step(
      {
        title: "Push the drawer stops into the back",
        detail: "Snap the two halves of each stop together first, then push them into the holes in the back.",
        pose: "-z",
        kind: "general",
      },
      () => {
        const list: FitOpts[] = [];
        for (const [bay, [x0, x1]] of bays.entries())
          for (const i of range(c.levels)) for (const x of [x0 + 50, x1 - 50]) list.push({ on: backAt(bay, slot(i) + pitch / 2), at: [x, slot(i) + pitch / 2, zBack - 8], dir: [0, 0, 1], hole: 3 });
        b.fits(STOP, list, 0.12);
        b.then(0.05);
        b.fits(CAP, list.map((o) => ({ ...o, at: [o.at[0], o.at[1], zBack + 2] as Vec3, hole: false as const })), 0.1);
      },
    );
  }
  b.step(
    {
      title: "Fix the back to the bottom with the plastic rivets",
      detail: "Push each sleeve through the back into the bottom, then push its pin in until it's flush.",
      pose: "-z",
      kind: "general",
    },
    () => {
      const list: FitOpts[] = [];
      for (const [bay, x] of bcx.entries()) for (const dx of [-bw / 4, bw / 4]) list.push({ on: backs[bay][0], at: [x + dx, P + t / 2, -D / 2 + 8], dir: [0, 0, 1], mate: bottoms[bay], mateHole: 4 });
      b.fits(RIVET, list, 0.12);
      b.then(0.05);
      b.fits(RIVET_PIN, list.map((o) => ({ ...o, mate: undefined })), 0.12);
    },
  );

  /* ---------- on its back: plinth, stops, interlock ---------- */

  const plate = (pi: number, g: number): FitOpts => ({ on: plinths[pi], at: [bcx[pi] + g * (bw / 2 - 14), P / 2, zp - t / 2], dir: [0, 0, 1], hole: false, twist: g < 0 ? Math.PI : 0 });
  b.step(
    {
      title: c.cols === 2 ? "Screw the L brackets onto the plinth rails" : "Screw the L brackets onto the plinth rail",
      detail: "One at each end, on the back face, with the bent edge flush with the end.",
      tools: ["screwdriver"],
      scene: "plinth",
      kind: "screws",
    },
    () => {
      b.stagger(0.2);
      plinths.forEach((k, i) => b.stage(k, [0, t / 2, (i - (plinths.length - 1) / 2) * 180], [Math.PI / 2, 0, 0], [0, 140, 0]));
      b.then(0.15);
      const pl = plinths.flatMap((_, i) => [-1, 1].map((g) => plate(i, g)));
      b.fits(HW.angle, pl, 0.15);
      b.then(0.1);
      b.fits(EURO_SCREW, pl.map((o) => ({ ...o, at: [o.at[0] - Math.sign(o.at[0] - bcx[plinths.indexOf(o.on!)]) * 6, o.at[1], o.at[2]] as Vec3, hole: undefined, twist: undefined })), 0.1);
    },
  );
  if (steel)
    b.step(
      {
        title: "Turn it onto its back and screw in the steel rail",
        detail: "It goes across the front under the small drawers. Two screws at each end.",
        tools: ["screwdriver"],
        pose: "+z",
        kind: "screws",
        warnings: ["floor"],
      },
      () => {
        b.add(steel, [0, 0, 300]);
        b.then(0.15);
        const xi = W / 2 - t;
        const list: FitOpts[] = [];
        for (const g of [-1, 1]) for (const dz of [-10, 10]) list.push({ on: steel, at: [g * (xi - 4), ySplit - 7.5, zf - 40 + dz], dir: [g, 0, 0], mate: sides[g < 0 ? 0 : 1] });
        b.fits(EURO_SCREW, list, 0.1);
      },
    );
  b.step(
    {
      title: steel ? (c.cols === 2 ? "Screw the plinth rails in" : "Screw the plinth rail in") : c.cols === 2 ? "Turn it onto its back and screw the plinth rails in" : "Turn it onto its back and screw the plinth rail in",
      detail: "It sits under the bottom, set back from the front edge. One screw through each L bracket into the panel next to it.",
      tools: ["screwdriver"],
      pose: "+z",
      kind: "screws",
      warnings: steel ? [] : ["floor"],
    },
    () => {
      b.stagger(0.25);
      for (const k of plinths) b.add(k, [0, 0, 300]);
      b.then(0.15);
      const list: FitOpts[] = [];
      for (const [i, [x0, x1]] of bays.entries())
        for (const [x, g] of [[x0, -1], [x1, 1]] as [number, number][]) list.push({ on: faceOf(x, 10).key, at: [x, P / 2, zp - t / 2 - 14], dir: [g, 0, 0], mate: plinths[i] });
      b.fits(EURO_SCREW, list.map((o) => ({ ...o, mate: undefined })), 0.12);
    },
  );
  b.step(
    {
      title: "Push the plastic stops into the front edges",
      detail: "The angled ones go low down, just above the bottom; the straight ones higher up. They stop the drawer fronts.",
      pose: "+z",
      kind: "general",
    },
    () => {
      const faces = bays.flatMap(([x0, x1]) => [x0, x1]);
      const L = faces.slice(0, c.frontL).map((x): FitOpts => {
        const f = faceOf(x, yB + 30);
        return { on: f.key, at: [x, yB + 30, zf - 25], dir: [-f.dir, 0, 0], hole: 3 };
      });
      const bars = vx.slice(0, c.frontBar).map((v, i): FitOpts => {
        const x = i === 0 ? v + t / 2 : v - t / 2;
        const f = faceOf(x, H * 0.55);
        return { on: f.key, at: [x, H * 0.55, zf - 25], dir: [-f.dir, 0, 0], hole: 3 };
      });
      b.fits(FRONT_L, L, 0.15);
      b.then(0.1);
      b.fits(FRONT_BAR, bars, 0.15);
    },
  );
  if (c.interlock) {
    // the interlock runs up the inside of the left panel of each bay, near the back
    const zl = zBack + 25;
    const box = bays.map(([x0]): FitOpts => ({ on: faceOf(x0, yB + 60).key, at: [x0, yB + 60, zl], dir: [-1, 0, 0], hole: false }));
    const clipsY = range(c.levels).flatMap((i) => [slot(i) + 30, slot(i) + pitch - 40]);
    const clips = bays.flatMap(([x0]) => clipsY.map((y): FitOpts => ({ on: faceOf(x0, Math.min(y, ySplit - 1)).key, at: [x0, y, zl], dir: [-1, 0, 0], hole: 3 })));
    const firstClips = bays.map((_, i) => clips[i * clipsY.length]);
    const restClips = clips.filter((o) => !firstClips.includes(o));
    b.step(
      {
        title: c.cols === 2 ? "Screw the interlock units inside" : "Screw the interlock unit inside",
        detail: "Low down on the inside of the left-hand panel, next to the back. It lets only one drawer open at a time, so the chest can't tip.",
        tools: ["screwdriver"],
        pose: "+z",
        kind: "screws",
        warnings: ["tip"],
      },
      () => {
        b.fits(LOCK_BOX, box, 0.2);
        b.then(0.1);
        b.fits(LOCK_SCREW, box.map((o) => ({ ...o, at: [o.at[0] + 2, o.at[1] + 30, o.at[2]] as Vec3, hole: undefined })), 0.15);
      },
    );
    b.step(
      {
        title: "Clip the end of the cable into its hole",
        detail: "The first clip goes in the hole just above the unit.",
        pose: "+z",
        kind: "general",
      },
      () => b.fits(CABLE_CLIP, firstClips, 0.2),
    );
    b.step(
      {
        title: `Clip the cable into the other ${restClips.length} holes`,
        detail: "Work up the panel, keeping the cable straight and tight against it.",
        pose: "+z",
        kind: "general",
      },
      () => b.fits(CABLE_CLIP, restClips, 0.06),
    );
    const caps = clips.map((o) => ({ ...o, at: [o.at[0] + 8, o.at[1], o.at[2]] as Vec3, hole: false as const }));
    const stopList: FitOpts[] = [];
    for (const [bay] of bays.entries()) {
      const ys = spread(slot(0) + pitch / 2, slot(c.levels - 1) + pitch / 2, c.stops / c.cols);
      for (const y of ys) stopList.push({ on: backAt(bay, y), at: [bcx[bay] - (c.split && y > ySplit ? bw / 4 : 0), y, zBack], dir: [0, 0, -1], hole: 3 });
    }
    const capFirst = c.cols === 2; // the wide chest's manual fits the stops before the caps
    const capStep = () =>
      b.step(
        { title: `Push a cap onto each clip`, detail: `All ${caps.length} of them, so the drawers run smoothly past.`, pose: "+z", kind: "general" },
        () => b.fits(CAP, caps, 0.05),
      );
    if (!capFirst) capStep();
    b.step(
      {
        title: "Fit the drawer stops in the back",
        detail: "Snap the two halves of each stop together, then push it into its hole in the back.",
        pose: "+z",
        kind: "general",
      },
      () => {
        b.fits(STOP, stopList, 0.12);
        b.then(0.05);
        b.fits(CAP, stopList.map((o) => ({ ...o, at: [o.at[0], o.at[1], o.at[2] + 8] as Vec3, hole: false as const })), 0.1);
      },
    );
    if (capFirst) capStep();
  }
  if (c.uBrackets)
    b.step(
      {
        title: "Screw the back to the brackets under the top",
        detail: "One screw through each bracket into the back.",
        tools: ["screwdriver"],
        pose: "+z",
        kind: "screws",
      },
      () => b.fits(EURO_SCREW, uX.map((x): FitOpts => ({ on: backAt(0, yT - 20), at: [x, yT - 24, zBack], dir: [0, 0, -1] })), 0.15),
    );

  // wall fixing, before the drawers go in
  const wy = yT - 26;
  b.step(
    {
      title: c.wall === 1 ? "Stand it up and mark the wall through the bracket" : "Stand it up and mark the wall through the brackets",
      detail: "Loosen the bracket screw, slide the bracket out against the wall and mark through its slot.",
      tools: ["screwdriver", "pencil"],
      pose: "+y",
      kind: "anchor",
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {},
  );
  b.step(
    {
      title: c.wall === 1 ? "Drill the hole and push in the plug" : "Drill the holes and push in the plugs",
      detail: "Move the chest away first. The plugs suit solid walls; use fixings made for your wall if it's different.",
      tools: ["drill", "hammer"],
      kind: "anchor",
      wall: true,
      warnings: ["wall"],
    },
    () => b.fits(WALL_PLUG, wallX.map((x) => ({ at: [x, wy, -D / 2 - 1] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.2),
  );
  b.step(
    {
      title: "Screw it to the wall",
      detail: "Push it back, put a washer on each screw and screw it through the bracket. Then tighten the bracket screws under the top.",
      tools: ["screwdriver"],
      kind: "anchor",
      wall: true,
      warnings: ["tip"],
    },
    () => {
      b.fits(HW.washer, wallX.map((x) => ({ at: [x, wy, -D / 2 + 6] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.15);
      b.then(0.05);
      b.fits(WALL_SCREW, wallX.map((x) => ({ at: [x, wy, -D / 2 + 8] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.2);
    },
  );

  /* ---------- the drawers ---------- */

  const frT = (w: number) => b.part("Drawer front", [w, fh, 18]);
  const frontTypes = new Map<number, string>();
  const dsT = b.part("Drawer side", [12, sh, dd]);
  const bottomTypes = new Map<number, string>(), backTypes = new Map<number, string>();
  const typeFor = (m: Map<number, string>, w: number, make: (w: number) => string) => {
    const k = Math.round(w);
    if (!m.has(k)) m.set(k, make(w));
    return m.get(k)!;
  };
  const drawers: Drawer[] = cells.map((cl) => {
    const cw = cl.x1 - cl.x0, cx = (cl.x0 + cl.x1) / 2;
    const xo = cw / 2 - 19;
    const y = yBox(cl.level);
    return {
      cell: cl,
      y,
      xs: [cx - xo, cx + xo],
      front: b.place(typeFor(frontTypes, cw - 4, frT), [cx, slot(cl.level) + 3 + fh / 2, zf - 9]),
      sides: [-1, 1].map((g) => b.place(dsT, [cx + g * xo, y + sh / 2, zf - 18 - dd / 2])),
      bottom: b.place(typeFor(bottomTypes, 2 * xo, (w) => b.part("Drawer bottom", [w, 3, dd - 2], { material: "fiber" })), [cx, y + 10, zf - 18 - (dd - 2) / 2]),
      back: b.place(typeFor(backTypes, 2 * xo - 12, (w) => b.part("Drawer back", [w, sh - 14, 12])), [cx, y + 14 + (sh - 14) / 2, zf - 18 - dd + 6]),
    };
  });
  const fitsOf = (d: Drawer) => {
    const cx = (d.xs[0] + d.xs[1]) / 2;
    const zBk = zf - 18 - dd + 6;
    const per = <T>(fn: (g: number, side: string, x: number) => T[]) => [-1, 1].flatMap((g, i) => fn(g, d.sides[i], d.xs[i]));
    return {
      rod: c.interlock && !d.cell.small ? [{ on: d.back, at: [cx, d.y + 14, zBk], dir: [0, 1, 0], hole: 2 } as FitOpts] : [],
      catch: c.interlock ? [{ on: d.sides[0], at: [d.xs[0] - 6, d.y + sh * 0.3, zBk - 20], dir: [1, 0, 0], hole: false } as FitOpts] : [],
      pins: per((g, sd, x) => [0.3, 0.75].map((k): FitOpts => ({ on: sd, at: [x + g * 6, d.y + 14 + (sh - 14) * k, zBk], dir: [-g, 0, 0], mate: d.back, mateHole: 4 }))),
      cams: per((g, _sd, x) => [0.3, 0.75].map((k): FitOpts => ({ on: d.back, at: [x - g * 30, d.y + 14 + (sh - 14) * k, zBk - 6], dir: [0, 0, 1] }))),
      runners: per((_g, sd, x) => [{ on: sd, at: [x, d.y, zf - 18 - 10 - runLen / 2], dir: [0, 1, 0], hole: false } as FitOpts]),
      runnerScrews: per((g, sd, x) => [-runLen / 2 + 30, 0, runLen / 2 - 30].map((dz): FitOpts => ({ on: sd, at: [x + g * 6, d.y + 6, zf - 28 - runLen / 2 + dz], dir: [-g, 0, 0] }))),
    };
  };
  const all: [HwDef, (f: ReturnType<typeof fitsOf>) => FitOpts[]][] = [
    [ROD, (f) => f.rod],
    [CATCH, (f) => f.catch],
    [HW.camScrew, (f) => f.pins],
    [HW.cam, (f) => f.cams],
    [RUNNER, (f) => f.runners],
    [RUNNER_SCREW, (f) => f.runnerScrews],
  ];

  // the small drawers of the tall 6 drawer chest are built first, without the interlock rod
  const groups = c.split ? [drawers.filter((d) => d.cell.small), drawers.filter((d) => !d.cell.small)] : [drawers];
  const built = new Set<Drawer>();
  for (const grp of groups) {
    const d0 = grp[0];
    built.add(d0);
    const c0: Vec3 = [(d0.xs[0] + d0.xs[1]) / 2, d0.y + sh / 2, zf - 18 - dd / 2];
    const sceneName = c.split ? (d0.cell.small ? "small drawer" : "drawer") : "drawer";
    const stage = (k: string, from: Vec3) => {
      const it = b.partItem(k);
      b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
    };
    const f0 = fitsOf(d0);
    const rep = grp.length > 1 ? grp.length : undefined;
    const small = c.split && d0.cell.small;
    const dstep = (title: string, detail: string, body: () => void, o: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
      b.step({ title, detail, tools: o.tools, scene: sceneName, pose: o.pose ?? "-z", repeat: rep, kind: o.kind ?? "drawer" }, body);
    dstep(
      small ? "Click the sides of a small drawer onto its front" : "Click the drawer sides onto a front",
      "Lay the front face down on something soft. Push each side onto the fittings and press down until it clicks.",
      () => {
        stage(d0.front, [0, 0, -160]);
        b.then(0.2);
        b.stagger(0.3);
        for (const sd of d0.sides) stage(sd, [0, 0, -300]);
      },
      { kind: "join" },
    );
    dstep("Slide in the drawer bottom", "Smooth side in. It runs down the grooves until it reaches the front.", () => stage(d0.bottom, [0, 0, -420]));
    if (f0.rod.length)
      dstep(
        "Tap the interlock rod into the drawer back",
        "Its two legs go into the holes in the bottom edge. Tap until it sits flat, and no further.",
        () => {
          stage(d0.back, [0, 0, -260]);
          b.then(0.15);
          b.fits(ROD, f0.rod, 0.2);
        },
        { tools: ["hammer"], kind: "general" },
      );
    dstep(
      "Put the drawer back on",
      "The notch in its edge goes at the bottom, over the drawer bottom.",
      () => {
        if (!f0.rod.length) stage(d0.back, [0, 0, -260]);
      },
      { kind: "join" },
    );
    if (f0.catch.length) dstep("Clip the catch into the drawer side", "In the round hole at the back of the left side. It works with the interlock in the chest.", () => b.fits(CATCH, f0.catch, 0.2));
    dstep("Push the cam pins in through the sides", "Two in each side, into the back.", () => b.fits(HW.camScrew, f0.pins, 0.1), { kind: "cams" });
    dstep("Lock the cam locks", "Arrow towards the pin, then turn clockwise until it bites.", () => b.fits(HW.cam, f0.cams, 0.12), { tools: ["screwdriver"], kind: "cams" });
    dstep(
      "Turn it upright and screw on the runners",
      "The left and right runners are marked. Press each onto the bottom edge of its side and screw it on with three screws.",
      () => {
        b.fits(RUNNER, f0.runners, 0.25);
        b.then(0.1);
        b.fits(RUNNER_SCREW, f0.runnerScrews, 0.06);
      },
      { tools: ["screwdriver"], kind: "runners", pose: "+y" },
    );
  }

  const n = drawers.length;
  b.step(
    {
      title: n > 2 ? `Slide in all ${n} drawers` : "Slide in both drawers",
      detail: c.interlock ? "Rest the runners on the ones in the chest and push until it closes. Only one drawer opens at a time now." : "Rest the runners on the ones in the chest and push until it closes. Open one drawer at a time.",
      kind: "drawer",
      warnings: ["tip"],
    },
    () => {
      for (const d of drawers) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 520]);
        if (!built.has(d)) {
          const f = fitsOf(d);
          for (const [def, get] of all) for (const o of get(f)) b.preset(def, o);
        }
        b.wait(0.2);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;

  if (c.glass) {
    const glass = b.place(b.part("Glass top", [W - 20, 4, D - 20], { material: "glass" }), [0, H + 2, 0]);
    b.step(
      { title: "Lay the glass on the top", detail: "Centre it, with the same gap all round. Handle glass with care.", kind: "join", warnings: ["hand"] },
      () => b.add(glass, [0, 240, 0]),
    );
    const gx = [-W / 4, W / 4];
    b.step(
      {
        title: "Screw the two glass clips on at the back",
        detail: "Each clip hooks over the glass and is screwed into the back edge of the top.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.fits(GLASS_CLIP, gx.map((x): FitOpts => ({ on: top, at: [x, H - 4, -D / 2], dir: [0, 0, 1], hole: false })), 0.15);
        b.then(0.1);
        b.fits(GLASS_SCREW, gx.map((x): FitOpts => ({ on: top, at: [x, H - t / 2, -D / 2], dir: [0, 0, 1] })), 0.15);
      },
    );
  }
  return true;
}

/* ---------- the US 2-drawer chest and nightstand ---------- */

function buildCam(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const P = 40, yB = P + t, yT = H - t, zf = D / 2, zBack = -D / 2 + 16, backZ = -D / 2 + 12;
  const levels = 2;
  const pitch = (yT - yB) / levels;
  const slot = (i: number) => yB + i * pitch;
  const fh = pitch - 6, sh = Math.min(fh - 40, 160);
  const dd = zf - 18 - (zBack + 10);
  const runLen = Math.round((dd - 40) / 10) * 10;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 20 };
  const yBox = (i: number) => slot(i) + 13;
  const zRun = zf - 30 - runLen / 2;
  const sx = W / 2 - t / 2, xi = W / 2 - t;
  const sg = (i: number) => (i === 0 ? -1 : 1);
  const sideT = b.part("Side panel", [t, H - t, D]);
  const sides = [0, 1].map((i) => b.place(sideT, [sg(i) * sx, (H - t) / 2, 0]));
  const top = b.place(b.part("Top panel", [W, t, D]), [0, H - t / 2, 0]);
  const bottom = b.place(b.part("Bottom panel", [2 * xi, t, D - 16]), [0, P + t / 2, 8]);
  const zp = zf - 20 - t / 2;
  const plinth = b.place(b.part("Plinth rail", [2 * xi, P, t]), [0, P / 2, zp]);
  const back = b.place(b.part("Back panel", [2 * xi, yT - P, 8]), [0, P + (yT - P) / 2, backZ]);

  b.step(
    { title: "Screw the runners onto both sides", detail: "Lay the sides on something soft, inside faces up. The runners are marked for the left and right.", tools: ["screwdriver"], scene: "prep", kind: "runners", warnings: ["floor"] },
    () => {
      b.stagger(0.2);
      b.stage(sides[0], [0, t / 2, -(D / 2 + 60)], [0, 0, Math.PI / 2], [0, 160, 0]);
      b.stage(sides[1], [0, t / 2, D / 2 + 60], [0, 0, -Math.PI / 2], [0, 160, 0]);
      b.then(0.2);
      for (const i of [0, 1])
        for (const lv of range(levels)) {
          const y = yBox(lv) - 6, x = sg(i) * xi;
          b.fits(RUNNER, [{ on: sides[i], at: [x, y, zRun], dir: [sg(i), 0, 0], hole: false }], 0.1);
          b.fits(RUNNER_SCREW, [-runLen / 2 + 30, 0, runLen / 2 - 30].map((dz): FitOpts => ({ on: sides[i], at: [x - sg(i) * 2, y, zRun + dz], dir: [sg(i), 0, 0] })), 0.03);
        }
    },
  );
  const bottomBolts: FitOpts[] = [];
  for (const i of [0, 1]) for (const z of [-D / 4, D / 4]) bottomBolts.push({ on: sides[i], at: [sg(i) * xi, P + t / 2, z], dir: [-sg(i), 0, 0], mate: bottom, mateHole: 4 });
  b.step(
    { title: "Screw the cam bolts into the sides", detail: "Two in each side, in the holes near the bottom end.", tools: ["screwdriver"], scene: "prep", kind: "cams" },
    () => b.fits(HW.camScrew, bottomBolts, 0.1),
  );
  const wallX = [-(xi - 50), xi - 50];
  b.step(
    {
      title: "Screw the wall brackets onto the sides",
      detail: "One at the top back corner of each side, with a washer under the screw. Leave them a little loose.",
      tools: ["screwdriver"],
      scene: "prep",
      kind: "screws",
    },
    () => {
      b.fits(HW.bracket, wallX.map((x, i): FitOpts => ({ on: sides[i], at: [x, yT - 70, -D / 2 + 22], dir: [0, 1, 0], hole: false })), 0.2);
      b.fits(HW.washer, wallX.map((x, i): FitOpts => ({ on: sides[i], at: [sg(i) * (xi - 3), yT - 70, -D / 2 + 44], dir: [sg(i), 0, 0], hole: false })), 0.15);
      b.fits(BRACKET_SCREW, wallX.map((_x, i): FitOpts => ({ on: sides[i], at: [sg(i) * (xi - 3), yT - 70, -D / 2 + 44], dir: [sg(i), 0, 0] })), 0.15);
    },
  );
  b.step(
    { title: "Tap the dowels into the bottom panel", detail: "Two in each end.", tools: ["hammer"], scene: "bottom", kind: "dowels" },
    () => {
      b.stage(bottom, [0, t / 2, 0], [0, 0, 0], [0, 160, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      for (const i of [0, 1]) for (const z of [-D / 2 + 60, D / 2 - 60]) list.push({ on: bottom, at: [sg(i) * xi, P + t / 2, z], dir: [-sg(i), 0, 0], mate: sides[i] });
      b.fits(HW.dowel, list, 0.1);
    },
  );
  const sideCams = (i: number): FitOpts[] => [-D / 4, D / 4].map((z) => ({ on: bottom, at: [sg(i) * (xi - 30), P + t, z], dir: [0, -1, 0] }));
  b.step(
    { title: "Lay a side down and stand the bottom on it", detail: "Push the bottom onto the dowels and bolts, then turn its two cam locks clockwise.", tools: ["screwdriver"], pose: "+x", kind: "cams", warnings: ["floor"] },
    () => {
      b.add(sides[0], [-260, 0, 0]);
      b.then(0.15);
      b.add(bottom, [-260, 0, 0]);
      b.then(0.15);
      b.fits(HW.cam, sideCams(0), 0.12);
    },
  );
  b.step(
    { title: "Stand it up and put the other side on", detail: "Push it onto the dowels and bolts, then lock the two cam locks.", tools: ["screwdriver"], kind: "cams" },
    () => {
      b.add(sides[1], [300, 0, 0]);
      b.then(0.15);
      b.fits(HW.cam, sideCams(1), 0.12);
    },
  );
  const plates = [-1, 1].map((g): FitOpts => ({ on: plinth, at: [g * (xi - 14), P / 2, zp - t / 2], dir: [0, 0, 1], hole: false, twist: g < 0 ? Math.PI : 0 }));
  b.step(
    { title: "Screw the L brackets onto the plinth rail", detail: "One at each end, on the back face.", tools: ["screwdriver"], scene: "plinth", kind: "screws" },
    () => {
      b.stage(plinth, [0, t / 2, 0], [Math.PI / 2, 0, 0], [0, 140, 0]);
      b.then(0.15);
      b.fits(HW.angle, plates, 0.15);
      b.fits(EURO_SCREW, plates.map((o) => ({ ...o, at: [o.at[0] - Math.sign(o.at[0]) * 6, o.at[1], o.at[2]] as Vec3, hole: undefined, twist: undefined })), 0.1);
    },
  );
  b.step(
    { title: "Screw the plinth rail in under the bottom", detail: "Push it up under the front of the bottom and screw each bracket to a side.", tools: ["screwdriver"], kind: "screws" },
    () => {
      b.add(plinth, [0, -200, 0]);
      b.then(0.15);
      b.fits(EURO_SCREW, [0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * xi, P / 2, zp - t / 2 - 14], dir: [sg(i), 0, 0] })), 0.12);
    },
  );
  b.step(
    { title: "Slide the back panel down the grooves", detail: "Feed it in at the top and push it down to the bottom.", kind: "join" },
    () => b.add(back, [0, H, 0]),
  );
  b.step(
    { title: "Fix the back to the bottom with the plastic rivets", detail: "Push each sleeve through the back into the bottom, then push its pin in.", kind: "general" },
    () => {
      const list = [-xi / 2, xi / 2].map((x): FitOpts => ({ on: back, at: [x, P + t / 2, -D / 2 + 8], dir: [0, 0, 1], mate: bottom, mateHole: 4 }));
      b.fits(RIVET, list, 0.12);
      b.fits(RIVET_PIN, list.map((o) => ({ ...o, mate: undefined })), 0.12);
    },
  );
  b.step(
    { title: "Push the plastic stops into the front edges", detail: "The straight ones high up, the angled ones low down just above the bottom.", kind: "general" },
    () => {
      b.fits(FRONT_BAR, [0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * xi, H * 0.55, zf - 25], dir: [sg(i), 0, 0], hole: 3 })), 0.15);
      b.fits(FRONT_L, [0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * xi, yB + 30, zf - 25], dir: [sg(i), 0, 0], hole: 3 })), 0.15);
    },
  );
  const topZ = [zf - 50, -D / 2 + 60];
  b.step(
    { title: "Tap the dowels into the tops of the sides", detail: "Two in each side.", tools: ["hammer"], kind: "dowels" },
    () => {
      const list: FitOpts[] = [];
      for (const i of [0, 1]) for (const z of [D / 6, -D / 6]) list.push({ on: sides[i], at: [sg(i) * sx, yT, z], dir: [0, -1, 0], mate: top });
      b.fits(HW.dowel, list, 0.1);
    },
  );
  const topBolts: FitOpts[] = [];
  for (const i of [0, 1]) for (const z of topZ) topBolts.push({ on: top, at: [sg(i) * sx, yT, z], dir: [0, 1, 0], mate: sides[i], mateHole: 4 });
  b.step(
    { title: "Screw the cam bolts into the top", detail: "Lay the top upside down on something soft.", tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["face"] },
    () => {
      b.stage(top, [0, t / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
      b.then(0.15);
      b.fits(HW.camScrew, topBolts, 0.1);
    },
  );
  b.step({ title: "Put the top on", detail: "Lower it onto the dowels and bolts.", kind: "join" }, () => b.add(top, [0, 300, 0]));
  b.step(
    { title: "Lock the top with cam locks", detail: "Two in each side, just under the top. Arrow towards the bolt, then a clockwise turn.", tools: ["screwdriver"], kind: "cams" },
    () => b.fits(HW.cam, [0, 1].flatMap((i) => topZ.map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, yT - 25, z], dir: [sg(i), 0, 0] }))), 0.12),
  );
  b.step(
    { title: "Turn it round and push the drawer stops into the back", detail: "Snap the two halves of each stop together, then push them into the holes.", pose: "-z", kind: "general" },
    () => {
      const list: FitOpts[] = [];
      for (const i of range(levels)) for (const x of [-(xi - 50), xi - 50]) list.push({ on: back, at: [x, slot(i) + pitch / 2, zBack - 8], dir: [0, 0, 1], hole: 3 });
      b.fits(STOP, list, 0.12);
      b.fits(CAP, list.map((o) => ({ ...o, at: [o.at[0], o.at[1], zBack + 2] as Vec3, hole: false as const })), 0.1);
    },
  );
  const wy = yT - 96;
  b.step(
    { title: "Stand it up and mark the wall through the brackets", detail: "Loosen the bracket screws, slide the brackets out against the wall and mark through the slots.", tools: ["screwdriver", "pencil"], pose: "+y", kind: "anchor", wall: true, warnings: ["wall", "tip"] },
    () => {},
  );
  b.step(
    { title: "Drill the holes and push in the plugs", detail: "Move it away first. Use fixings made for your wall if it isn't solid.", tools: ["drill", "hammer"], kind: "anchor", wall: true, warnings: ["wall"] },
    () => b.fits(WALL_PLUG, wallX.map((x) => ({ at: [x, wy, -D / 2 - 1] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.2),
  );
  b.step(
    { title: "Screw it to the wall", detail: "A washer on each screw, through the bracket slot. Then tighten the bracket screws.", tools: ["screwdriver"], kind: "anchor", wall: true, warnings: ["tip"] },
    () => {
      b.fits(HW.washer, wallX.map((x) => ({ at: [x, wy, -D / 2 + 6] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.15);
      b.fits(WALL_SCREW, wallX.map((x) => ({ at: [x, wy, -D / 2 + 8] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.2);
    },
  );

  // the drawers, built on their fronts with cam bolts and dowels
  const xo = xi - 19;
  const frT = b.part("Drawer front", [2 * xi - 4, fh, 18]);
  const dsT = b.part("Drawer side", [12, sh, dd]);
  const btT = b.part("Drawer bottom", [2 * xo, 3, dd - 2], { material: "fiber" });
  const bkT = b.part("Drawer back", [2 * xo - 12, sh - 14, 12]);
  const zBk = zf - 18 - dd + 6;
  const drawers = range(levels).map((i) => {
    const y = yBox(i);
    return {
      y,
      front: b.place(frT, [0, slot(i) + 3 + fh / 2, zf - 9]),
      sides: [-1, 1].map((g) => b.place(dsT, [g * xo, y + sh / 2, zf - 18 - dd / 2])),
      bottom: b.place(btT, [0, y + 10, zf - 18 - (dd - 2) / 2]),
      back: b.place(bkT, [0, y + 14 + (sh - 14) / 2, zBk]),
    };
  });
  type Dr = (typeof drawers)[number];
  const fitsOf = (d: Dr) => {
    const per = (fn: (g: number, sd: string) => FitOpts[]) => [-1, 1].flatMap((g, i) => fn(g, d.sides[i]));
    return {
      bolts: per((g, sd) => [d.y + 30, d.y + sh - 30].map((y): FitOpts => ({ on: d.front, at: [g * xo, y, zf - 18], dir: [0, 0, 1], mate: sd, mateHole: 4 }))),
      dowels: per((g, sd) => [d.y + sh / 2].concat([d.y + sh * 0.7]).map((y): FitOpts => ({ on: sd, at: [g * xo, y, zf - 18], dir: [0, 0, -1], mate: d.front }))),
      cams: per((g, sd) => [d.y + 30, d.y + sh - 30].map((y): FitOpts => ({ on: sd, at: [g * (xo - 6), y, zf - 48], dir: [g, 0, 0] }))),
      pins: per((g, sd) => [0.3, 0.75].map((k): FitOpts => ({ on: sd, at: [g * (xo + 6), d.y + 14 + (sh - 14) * k, zBk], dir: [-g, 0, 0], mate: d.back, mateHole: 4 }))),
      backCams: per((g) => [0.3, 0.75].map((k): FitOpts => ({ on: d.back, at: [g * (xo - 30), d.y + 14 + (sh - 14) * k, zBk - 6], dir: [0, 0, 1] }))),
      runners: per((_g, sd) => [{ on: sd, at: [_g * xo, d.y, zf - 28 - runLen / 2], dir: [0, 1, 0], hole: false }]),
      screws: per((g, sd) => [-runLen / 2 + 30, 0, runLen / 2 - 30].map((dz): FitOpts => ({ on: sd, at: [g * (xo + 6), d.y + 6, zf - 28 - runLen / 2 + dz], dir: [-g, 0, 0] }))),
    };
  };
  const d0 = drawers[0];
  const c0: Vec3 = [0, d0.y + sh / 2, zf - 18 - dd / 2];
  const stage = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
  };
  const f0 = fitsOf(d0);
  const dstep = (title: string, detail: string, body: () => void, o: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
    b.step({ title, detail, tools: o.tools, scene: "drawer", pose: o.pose ?? "-z", repeat: 2, kind: o.kind ?? "drawer" }, body);
  dstep("Screw the cam bolts into a drawer front", "Lay the front face down on something soft.", () => {
    stage(d0.front, [0, 0, -160]);
    b.then(0.15);
    b.fits(HW.camScrew, f0.bolts, 0.1);
  }, { tools: ["screwdriver"], kind: "cams" });
  dstep("Tap the dowels into the drawer sides", "Two in the front end of each side.", () => {
    b.stagger(0.2);
    for (const sd of d0.sides) stage(sd, [0, 0, -300]);
    b.then(0.15);
    b.fits(HW.dowel, f0.dowels, 0.08);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Lock the sides to the front", "Push the sides down onto the bolts and dowels, then turn the cam locks clockwise.", () => b.fits(HW.cam, f0.cams, 0.12), { tools: ["screwdriver"], kind: "cams" });
  dstep("Slide in the drawer bottom", "Smooth side in. It runs down the grooves until it reaches the front.", () => stage(d0.bottom, [0, 0, -420]));
  dstep("Put the drawer back on", "The notch in its edge goes at the bottom, over the drawer bottom.", () => stage(d0.back, [0, 0, -260]), { kind: "join" });
  dstep("Fix the back with cam pins and cam locks", "Two pins through each side into the back, then lock them from inside.", () => {
    b.fits(CAM_PIN, f0.pins, 0.1);
    b.then(0.1);
    b.fits(HW.cam, f0.backCams, 0.12);
  }, { tools: ["screwdriver"], kind: "cams" });
  dstep("Turn it upright and screw on the runners", "Press each runner onto the bottom edge of its side and screw it on with three screws.", () => {
    b.fits(RUNNER, f0.runners, 0.25);
    b.then(0.1);
    b.fits(RUNNER_SCREW, f0.screws, 0.06);
  }, { tools: ["screwdriver"], kind: "runners", pose: "+y" });
  b.step(
    { title: "Slide in both drawers", detail: "Rest the runners on the ones in the chest and push until it closes. Open one drawer at a time.", kind: "drawer", warnings: ["tip"] },
    () => {
      for (const [i, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 520]);
        if (i > 0) {
          const f = fitsOf(d);
          const list: [HwDef, FitOpts[]][] = [
            [HW.camScrew, f.bolts],
            [HW.dowel, f.dowels],
            [HW.cam, [...f.cams, ...f.backCams]],
            [CAM_PIN, f.pins],
            [RUNNER, f.runners],
            [RUNNER_SCREW, f.screws],
          ];
          for (const [def, l] of list) for (const op of l) b.preset(def, op);
        }
        b.wait(0.2);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
  return true;
}

/* ---------- beds ---------- */

/*
 * The bed frame (single and double manuals): glides and cam bolts go into the end rails, dowels and cam locks into
 * the side rails, then two people join the four rails. The headboard stands on big dowels and hanger bolts with
 * wedges and nuts. The steel slat rails are screwed on (two heights), the telescopic cross braces go underneath
 * (a diamond round a centre beam on the double), slat holders and anti-slip strips go on, and the slats roll out.
 * Storage boxes are built on their fronts and roll in under the side rails.
 */
const BIG_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 10 };
const HANGER: HwDef = { kind: "legScrew", len: 60, dia: 8 };
const RAIL_SCREW: HwDef = { kind: "bolt", len: 40, dia: 6 };
const BEAM_BRACKET: HwDef = { kind: "angle", len: 80, dia: 60 };
const BEAM_SCREW: HwDef = { kind: "screw", len: 16, dia: 5 };
const BRACE_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const WEDGE: HwDef = { kind: "clip", len: 14, dia: 22 };
const HOLDER: HwDef = { kind: "clip", len: 30, dia: 40 };
const BIG_HOLDER: HwDef = { kind: "clip", len: 30, dia: 60 };
const CAM_PIN: HwDef = { kind: "camScrew", len: 28, dia: 7 };
const BOX_BOLT: HwDef = { kind: "bolt", len: 50, dia: 5 };
const CASTOR_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const CASTOR: HwDef = { kind: "castor", len: 40, dia: 40 };

function bedBoxes(s: ProductSpec) {
  const m = /with (\d) storage boxes/i.exec(s.variant);
  return m ? Number(m[1]) : 0;
}

function buildBed(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, L = s.size.d * 10, H = s.size.h * 10;
  const mw = (s.bed?.mattressW ?? s.size.w - 16) * 10;
  const wide = mw >= 1200;
  const boxes = bedBoxes(s);
  const T = 40;
  const RH = 380, SB = 190; // top of the frame, underside of the side rails (room for the boxes)
  const zh = -L / 2 + T, zfo = L / 2 - T; // inner faces of the head and foot rails
  const sx = W / 2 - T / 2, xin = W / 2 - T;
  const LY = 287.5; // centre of the slat rails
  const sg = (i: number) => (i === 0 ? -1 : 1);
  const people = 2 as const;

  const endT = b.part("End rail", [W, RH, T]);
  const head = b.place(endT, [0, RH / 2, -L / 2 + T / 2]);
  const foot = b.place(endT, [0, RH / 2, L / 2 - T / 2]);
  const sideT = b.part("Side rail", [T, RH - SB, L - 2 * T]);
  const sides = [0, 1].map((i) => b.place(sideT, [sg(i) * sx, (RH + SB) / 2, 0]));
  const hb = b.place(b.part("Headboard", [W, H - RH, 18]), [0, RH + (H - RH) / 2, -L / 2 + 9]);
  const railLen = L - 2 * T - 20;
  const ledgeT = b.part("Slat rail", [25, 25, railLen], { material: "metal" });
  const ledges = [0, 1].map((i) => b.place(ledgeT, [sg(i) * (xin - 12.5), LY, 0]));
  const beam = wide ? b.place(b.part("Centre beam", [40, 25, L - 2 * T], { material: "metal" }), [0, LY, 0]) : "";
  const bx = xin - 12.5;
  // the braces hang just under the rails: corner to corner on the single, a diamond on the double
  const braceEnds: [number, number, number, number][] = wide
    ? [[0, zh + 20, -bx, -150], [0, zh + 20, bx, -150], [0, zfo - 20, -bx, 150], [0, zfo - 20, bx, 150]]
    : [[-bx, zh + 40, bx, zfo - 40], [bx, zh + 40, -bx, zfo - 40]];
  const braces = braceEnds.map(([x0, z0, x1, z1], i) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const k = b.part("Cross brace", [20, 2, Math.round(len)], { material: "metal" });
    return b.place(k, [(x0 + x1) / 2, LY - 14 - (i % 2) * 3, (z0 + z1) / 2], [0, Math.atan2(x1 - x0, z1 - z0), 0]);
  });
  // anti-slip strips stuck along the top of the rails
  const segLen = (railLen - 120) / 3;
  const stripT = b.part("Anti-slip strip", [25, 1, Math.round(segLen)], { material: "soft" });
  const strips = [0, 1].flatMap((i) => [-1, 0, 1].map((k) => b.place(stripT, [sg(i) * (xin - 12.5), LY + 13, k * (segLen + 20)])));
  const beamStripT = wide ? b.part("Anti-slip strip", [40, 1, Math.round(segLen)], { material: "soft" }) : "";
  const beamStrips = wide ? [-1, 0, 1].map((k) => b.place(beamStripT, [0, LY + 13, k * (segLen + 20)])) : [];
  const slatsIn = boxes > 0; // the bundles with storage boxes come with a slatted base; the frame alone doesn't
  const nSlats = Math.round((L - 2 * T) / 115);
  const slatW = W - 2 * T - 10, slatL = L - 2 * T - 40;
  const { type: slatT, mid: slatMid } = b.compound(
    "Slatted base",
    range(nSlats).map((i) => ({ shape: "box" as const, size: [slatW, 8, 70] as Vec3, pos: [0, 0, -slatL / 2 + 35 + (i * (slatL - 70)) / (nSlats - 1)] as Vec3, material: "wood" as const })),
    { material: "wood", extra: !slatsIn },
  );
  const slats = b.place(slatT, [slatMid[0], LY + 13.5 + 4 + slatMid[1], slatMid[2]]);

  const gx = wide ? [-W / 2 + 60, 0, W / 2 - 60] : [-W / 2 + 60, W / 2 - 60];
  b.step(
    {
      title: "Push the glides into the end rails",
      detail: "Lay the rails on something soft, inside faces up. The glides go in the bottom edges.",
      scene: "prep",
      kind: "general",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.18);
      b.stage(head, [0, T / 2, -L / 2 + RH / 2], [-Math.PI / 2, 0, 0], [0, 160, 0]);
      b.stage(foot, [0, T / 2, -L / 2 + RH * 1.5 + 80], [Math.PI / 2, 0, 0], [0, 160, 0]);
      b.stage(sides[0], [-(W / 2 + 200), T / 2, 0], [0, 0, Math.PI / 2], [0, 160, 0]);
      b.stage(sides[1], [W / 2 + 200, T / 2, 0], [0, 0, -Math.PI / 2], [0, 160, 0]);
      b.then(0.2);
      const list: FitOpts[] = [];
      for (const [k, z] of [[head, -L / 2 + T / 2], [foot, L / 2 - T / 2]] as [string, number][]) for (const x of gx) list.push({ on: k, at: [x, 0, z], dir: [0, 1, 0], hole: false });
      b.fits(HW.glide, list, 0.1);
    },
  );
  const boltY = [SB + 50, RH - 50];
  const endBolts: FitOpts[] = [];
  for (const [k, z, d] of [[head, zh, -1], [foot, zfo, 1]] as [string, number, number][])
    for (const i of [0, 1]) for (const y of boltY) endBolts.push({ on: k, at: [sg(i) * sx, y, z], dir: [0, 0, d], mate: sides[i], mateHole: 4 });
  b.step(
    {
      title: "Screw the cam bolts into the end rails",
      detail: "Two at each end of both rails. Use the spanner and screw them in until the collar touches the board.",
      tools: ["wrench"],
      scene: "prep",
      kind: "cams",
    },
    () => b.fits(HW.camScrew, endBolts, 0.08),
  );
  b.step(
    {
      title: "Tap the dowels into the side rails",
      detail: "One in each end. Use the short dowels here; the thick ones are for the headboard.",
      tools: ["hammer"],
      scene: "prep",
      kind: "dowels",
    },
    () => {
      const list: FitOpts[] = [];
      for (const i of [0, 1]) for (const [z, d] of [[zh, 1], [zfo, -1]] as [number, number][]) list.push({ on: sides[i], at: [sg(i) * sx, (SB + RH) / 2, z], dir: [0, 0, d], mate: z < 0 ? head : foot });
      b.fits(HW.dowel, list, 0.1);
    },
  );
  const cams: FitOpts[] = [];
  for (const i of [0, 1]) for (const z of [zh + 40, zfo - 40]) for (const y of boltY) cams.push({ on: sides[i], at: [sg(i) * xin, y, z], dir: [sg(i), 0, 0] });
  b.step(
    {
      title: "Push the cam locks into the side rails",
      detail: "Two at each end, on the inside face, with the arrow pointing at the end of the rail.",
      scene: "prep",
      kind: "cams",
    },
    () => b.fits(HW.cam, cams, 0.08),
  );
  b.step(
    {
      title: "Join a side rail to the head and foot rails",
      detail: "Stand the end rails up and push the side rail onto the bolts and dowels, then turn its four cam locks with the crank. Do this together.",
      tools: ["allen"],
      people,
      kind: "join",
      warnings: ["two"],
    },
    () => {
      b.stagger(0.3);
      b.add(head, [0, 0, -300]);
      b.add(foot, [0, 0, 300]);
      b.then(0.15);
      b.add(sides[0], [-360, 0, 0]);
    },
  );
  b.step(
    {
      title: "Fit the other side rail",
      detail: "Push it on the same way and turn the cam locks until they're tight.",
      tools: ["allen"],
      people,
      kind: "join",
      warnings: ["two"],
    },
    () => b.add(sides[1], [360, 0, 0]),
  );
  const hx = spread(-W / 2 + 120, W / 2 - 120, wide ? 4 : 3);
  const dx = spread(-W / 2 + 70, W / 2 - 70, wide ? 5 : 3);
  b.step(
    {
      title: "Tap the big dowels into the head rail",
      detail: "Along its top edge. These are the thick dowels.",
      tools: ["hammer"],
      kind: "dowels",
    },
    () => b.fits(BIG_DOWEL, dx.map((x) => ({ on: head, at: [x, RH, -L / 2 + 9], dir: [0, -1, 0], mate: hb })), 0.1),
  );
  b.step(
    {
      title: "Screw the hanger bolts into the headboard",
      detail: "Lay it on a table with the bottom edge sticking out. Screw them in with the spanner, machine thread out, wood thread fully in.",
      tools: ["wrench"],
      scene: "headboard",
      kind: "bolts",
    },
    () => {
      b.stage(hb, [0, 9, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
      b.then(0.15);
      b.fits(HANGER, hx.map((x) => ({ on: hb, at: [x, RH, -L / 2 + 9], dir: [0, 1, 0], mate: head })), 0.12);
    },
  );
  b.step(
    {
      title: "Stand the headboard on the head rail",
      detail: "Lower it onto the dowels together. From inside the rail, push a plastic wedge in under each bolt and tighten a nut with the spanner.",
      tools: ["wrench"],
      people,
      kind: "bolts",
      warnings: ["two"],
    },
    () => {
      b.add(hb, [0, 400, 0]);
      b.then(0.2);
      b.fits(WEDGE, hx.map((x) => ({ on: head, at: [x, RH - 40, zh], dir: [0, 0, -1], hole: false })), 0.1);
      b.then(0.1);
      b.fits(HW.nut, hx.map((x) => ({ on: head, at: [x, RH - 40, zh - 6], dir: [0, 1, 0], hole: false })), 0.1);
    },
  );
  // the slat rails: four screws through the L brackets first, then twelve more
  const lz = wide ? [-150, 150] : [zh + 40, zfo - 40];
  const lPlates: FitOpts[] = [];
  for (const i of [0, 1]) for (const z of lz) lPlates.push({ on: ledges[i], at: [sg(i) * (xin - 25), LY - 12.5, z], dir: [sg(i), 0, 0], hole: false });
  b.step(
    {
      title: "Screw the slat rails on with the L brackets",
      detail: "There are two heights: the upper holes for a thinner mattress, the lower ones for a thicker one. One screw through each L bracket, turned with the crank.",
      tools: ["allen"],
      kind: "screws",
    },
    () => {
      b.stagger(0.3);
      for (const i of [0, 1]) b.add(ledges[i], [sg(i) * -200, 0, 0]);
      b.then(0.15);
      b.fits(HW.angle, lPlates, 0.12);
      b.then(0.1);
      b.fits(RAIL_SCREW, lPlates.map((o) => ({ ...o, mate: sides[o.at[0] < 0 ? 0 : 1], hole: undefined })), 0.1);
    },
  );
  b.step(
    {
      title: "Screw in the rest of the slat rail screws",
      detail: "Six more along each rail.",
      tools: ["allen"],
      kind: "screws",
    },
    () => {
      const list: FitOpts[] = [];
      for (const i of [0, 1]) for (const z of spread(-(railLen / 2 - 60), railLen / 2 - 60, 6)) list.push({ on: ledges[i], at: [sg(i) * (xin - 25), LY + 6, z + 20], dir: [sg(i), 0, 0], mate: sides[i] });
      b.fits(RAIL_SCREW, list, 0.05);
    },
  );
  const beamBr: FitOpts[] = wide ? [{ on: head, at: [0, LY - 12.5, zh], dir: [0, 0, -1], hole: false }, { on: foot, at: [0, LY - 12.5, zfo], dir: [0, 0, 1], hole: false }] : [];
  if (wide)
    b.step(
      {
        title: "Screw the centre beam brackets to the end rails",
        detail: "One in the middle of each rail, on the inside, two screws each.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.fits(BEAM_BRACKET, beamBr, 0.2);
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const [k, z, d] of [[head, zh, -1], [foot, zfo, 1]] as [string, number, number][]) for (const x of [-30, 30]) sc.push({ on: k, at: [x, LY - 30, z], dir: [0, 0, d] });
        b.fits(BEAM_SCREW, sc, 0.1);
      },
    );
  b.step(
    {
      title: wide ? "Screw the four cross braces in" : "Screw the two cross braces in",
      detail: wide
        ? "Pull each one out to length first. They run from the centre brackets to the L brackets and make a diamond."
        : "Pull each one out to length first. They cross from corner to corner, screwed to the L brackets.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.stagger(0.3);
      for (const k of braces) b.add(k, [0, -160, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      braceEnds.forEach(([x0, z0, x1, z1], i) => {
        if (wide) list.push({ on: braces[i], at: [x0, LY - 14, z0], dir: [0, 1, 0], mate: z0 < 0 ? head : foot });
        list.push({ on: braces[i], at: [x1, LY - 14, z1], dir: [0, 1, 0] });
        if (!wide) list.push({ on: braces[i], at: [x0, LY - 14, z0], dir: [0, 1, 0] });
      });
      b.fits(BRACE_SCREW, list, 0.1);
    },
  );
  b.step(
    {
      title: "Square the frame and lock the braces",
      detail: wide ? "Check the diamond is even and the diagonals match, then put a screw in the middle of each brace." : "Measure both diagonals. When they match, put a screw in the middle of each brace.",
      tools: ["screwdriver", "tape"],
      kind: "square",
      check: "square",
      warnings: ["square"],
    },
    () =>
      b.fits(
        BRACE_SCREW,
        braceEnds.map(([x0, z0, x1, z1], i): FitOpts => ({ on: braces[i], at: [(x0 + x1) / 2, LY - 13 - (i % 2) * 3, (z0 + z1) / 2], dir: [0, 1, 0], hole: false })),
        0.12,
      ),
  );
  if (wide)
    b.step({ title: "Lay the centre beam on its brackets", detail: "Its ends drop into the brackets on the head and foot rails.", kind: "join" }, () => b.add(beam, [0, 260, 0]));
  const hz = [-(L / 2 - T - 30), L / 2 - T - 30];
  b.step(
    {
      title: "Push the slat holders onto the rails",
      detail: "One at each end of both slat rails. They hold the end slats down.",
      kind: "general",
    },
    () => {
      const list: FitOpts[] = [];
      for (const z of hz) for (const i of [0, 1]) list.push({ on: ledges[i], at: [sg(i) * (xin - 12.5), LY + 12.5, z], dir: [0, -1, 0], hole: 4 });
      b.fits(HOLDER, list, 0.12);
    },
  );
  if (wide)
    b.step(
      { title: "Push the wide holders onto the centre beam", detail: "One at each end.", kind: "general" },
      () => b.fits(BIG_HOLDER, hz.map((z): FitOpts => ({ on: beam, at: [0, LY + 12.5, z], dir: [0, -1, 0], hole: 4 })), 0.15),
    );
  b.step(
    {
      title: "Stick the anti-slip strips on the slat rails",
      detail: "Three on each rail. Peel off the backing, press them down between the holders and cut off any extra.",
      kind: "general",
    },
    () => {
      b.stagger(0.12);
      for (const k of strips) b.add(k, [0, 120, 0]);
    },
  );
  if (wide)
    b.step(
      { title: "Stick the wide strips on the centre beam", detail: "Three of them, the same way. The wider strips are for the beam only.", kind: "general" },
      () => {
        b.stagger(0.15);
        for (const k of beamStrips) b.add(k, [0, 120, 0]);
      },
    );
  b.step(
    {
      title: "Roll out the slats",
      detail: slatsIn ? "Start at the head end and tuck the end slats under the holders." : "The slats are sold separately. Start at the head end and tuck the end slats under the holders.",
      kind: "slats",
    },
    () => b.add(slats, [0, 200, -400]),
  );
  if (boxes) storageBoxes(b, { W, L, T, n: boxes, wide });
  return true;
}

/** STORKLINTA storage boxes: front face down, sides on cam bolts, back on cam pins, bottom screwed, castors. */
function storageBoxes(b: PlanBuilder, o: { W: number; L: number; T: number; n: number; wide: boolean }) {
  const { W, L, T, n, wide } = o;
  const lb = (L - 2 * T - 60) / 2, BD = 560;
  const xo = W / 2;
  const YB = 38.5; // the bottom, just under the sides and the back
  const frT = b.part("Box front", [18, 160, lb]);
  const sdT = b.part("Box side", [BD - 34, 130, 16]);
  const bkT = b.part("Box back", [16, 130, lb]);
  const btT = b.part("Box bottom", [BD - 10, 3, lb - 4], { material: "fiber" });
  interface Box {
    g: number;
    zc: number;
    front: string;
    sides: string[];
    back: string;
    bottom: string;
  }
  const slots: [number, number][] = n >= 4 ? [[1, -1], [1, 1], [-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  const all: Box[] = slots.map(([g, k]) => {
    const zc = k * (lb / 2 + 15);
    return {
      g,
      zc,
      front: b.place(frT, [g * (xo - 9), 105, zc]),
      sides: [-1, 1].map((e) => b.place(sdT, [g * (xo - 18 - (BD - 34) / 2), 105, zc + e * (lb / 2 - 8)])),
      back: b.place(bkT, [g * (xo - BD + 8), 105, zc]),
      // under the sides and the back, its front edge in a groove in the front
      bottom: b.place(btT, [g * (xo - (BD + 10) / 2), YB, zc]),
    };
  });
  const xF = (x: Box) => x.g * (xo - 18), xB = (x: Box) => x.g * (xo - BD + 16);
  const fitsOf = (x: Box) => {
    const ends = [-1, 1];
    const zIn = (e: number) => x.zc + e * (lb / 2 - 16);
    const zs = (e: number) => x.zc + e * (lb / 2 - 8);
    const nf = wide ? 4 : 3, nb = wide ? 3 : 2;
    return {
      frontBolts: ends.flatMap((e, i) => [70, 140].map((y): FitOpts => ({ on: x.front, at: [xF(x), y, zs(e)], dir: [x.g, 0, 0], mate: x.sides[i], mateHole: 4 }))),
      dowels: ends.flatMap((e, i) => [
        { on: x.sides[i], at: [xF(x), 105, zs(e)] as Vec3, dir: [-x.g, 0, 0] as Vec3, mate: x.front },
        { on: x.sides[i], at: [xB(x), 105, zs(e)] as Vec3, dir: [x.g, 0, 0] as Vec3, mate: x.back },
      ]),
      frontCams: ends.flatMap((e) => [70, 140].map((y): FitOpts => ({ on: x.sides[e < 0 ? 0 : 1], at: [xF(x) - x.g * 30, y, zIn(e)], dir: [0, 0, e] }))),
      backPins: ends.flatMap((e, i) => [70, 140].map((y): FitOpts => ({ on: x.back, at: [xB(x), y, zs(e)], dir: [-x.g, 0, 0], mate: x.sides[i], mateHole: 4 }))),
      backCams: ends.flatMap((e) => [70, 140].map((y): FitOpts => ({ on: x.sides[e < 0 ? 0 : 1], at: [xB(x) + x.g * 30, y, zIn(e)], dir: [0, 0, e] }))),
      screws: [
        ...spread(x.zc - lb / 2 + 60, x.zc + lb / 2 - 60, nf).map((z): FitOpts => ({ on: x.bottom, at: [x.g * (xo - 13), YB - 1.5, z], dir: [0, 1, 0], mate: x.front })),
        ...spread(x.zc - lb / 2 + 80, x.zc + lb / 2 - 80, nb).map((z): FitOpts => ({ on: x.bottom, at: [x.g * (xo - BD + 8), YB - 1.5, z], dir: [0, 1, 0], mate: x.back })),
        ...ends.map((e, i): FitOpts => ({ on: x.bottom, at: [x.g * (xo - BD / 2), YB - 1.5, zs(e)], dir: [0, 1, 0], mate: x.sides[i] })),
      ],
      castors: [xF(x) - x.g * 50, xB(x) + x.g * 50].flatMap((cx) => ends.map((e): FitOpts => ({ on: x.bottom, at: [cx, YB - 1.5, x.zc + e * (lb / 2 - 60)], dir: [0, 1, 0], hole: false }))),
      castorScrews: [xF(x) - x.g * 50, xB(x) + x.g * 50].flatMap((cx) => ends.flatMap((e) => [-16, 16].map((dz): FitOpts => ({ on: x.bottom, at: [cx, YB - 1.5, x.zc + e * (lb / 2 - 60) + dz], dir: [0, 1, 0] })))),
    };
  };
  const x0 = all[0];
  const c0: Vec3 = [x0.g * (xo - BD / 2), 105, x0.zc];
  const stage = (k: string, from: Vec3, off: Vec3 = [0, 0, 0]) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0] + off[0], it.final.pos[1] - c0[1] + off[1], it.final.pos[2] - c0[2] + off[2]], it.final.rot, from);
  };
  const f0 = fitsOf(x0);
  const rep = all.length;
  const step = (title: string, detail: string, kind: StepKind, body: () => void, pose: Pose = "-x", tools?: ToolId[]) =>
    b.step({ title, detail, scene: "box", pose, repeat: rep, kind, tools }, body);
  step("Screw the cam bolts into a box front", "Lay the front face down on something soft. Two at each end.", "cams", () => {
    stage(x0.front, [-200, 0, 0]);
    b.then(0.15);
    b.fits(HW.camScrew, f0.frontBolts, 0.1);
  }, "-x", ["screwdriver"]);
  step("Tap the dowels into the box sides", "One in each end of both sides.", "dowels", () => {
    b.stagger(0.2);
    x0.sides.forEach((k, i) => stage(k, [-300, 0, 0], [-300, 0, (i ? 1 : -1) * 120]));
    b.then(0.15);
    b.fits(HW.dowel, f0.dowels, 0.1);
  }, "-x", ["hammer"]);
  step("Stand the sides on the front", "Push each one down onto its bolts and dowel.", "join", () => {
    b.stagger(0.25);
    for (const k of x0.sides) stage(k, [-200, 0, 0]);
  });
  step("Lock the sides with cam locks", "Arrow towards the bolt, then a clockwise turn.", "cams", () => b.fits(HW.cam, f0.frontCams, 0.1), "-x", ["screwdriver"]);
  step("Put the back on with the cam pins", "Push the four cam pins into the back, then press it down onto the sides.", "join", () => {
    stage(x0.back, [-260, 0, 0]);
    b.then(0.15);
    b.fits(CAM_PIN, f0.backPins, 0.1);
  });
  step("Lock the back with cam locks", "Arrow towards the pin, then a clockwise turn.", "cams", () => b.fits(HW.cam, f0.backCams, 0.1), "-x", ["screwdriver"]);
  step("Turn it over and slide in the bottom", "It runs in the grooves, smooth side in.", "drawer", () => stage(x0.bottom, [0, 0, -500]), "-y");
  step(`Screw the bottom on`, `${f0.screws.length} screws, turned in with the Allen key. Keep them straight.`, "screws", () => b.fits(BOX_BOLT, f0.screws, 0.06), "-y", ["allen"]);
  step("Screw on the castors", "One near each corner, two screws each.", "legs", () => {
    b.fits(CASTOR, f0.castors, 0.15);
    b.then(0.1);
    b.fits(CASTOR_SCREW, f0.castorScrews, 0.04);
  }, "-y", ["screwdriver"]);
  b.step(
    {
      title: all.length > 2 ? `Roll all ${all.length} boxes under the bed` : "Roll the boxes under the bed",
      detail: "Lift the front a little to get the castors past the side rail.",
      kind: "drawer",
    },
    () => {
      for (const [i, x] of all.entries()) {
        b.stagger(0);
        for (const k of [x.front, ...x.sides, x.back, x.bottom]) b.add(k, [x.g * 700, 0, 0]);
        if (i > 0) {
          const f = fitsOf(x);
          const list: [HwDef, FitOpts[]][] = [
            [HW.camScrew, f.frontBolts],
            [CAM_PIN, f.backPins],
            [HW.dowel, f.dowels],
            [HW.cam, [...f.frontCams, ...f.backCams]],
            [BOX_BOLT, f.screws],
            [CASTOR, f.castors],
            [CASTOR_SCREW, f.castorScrews],
          ];
          for (const [def, l] of list) for (const op of l) b.preset(def, op);
        }
        b.wait(0.25);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
}

const family: Family = {
  names: ["STORKLINTA"],
  build(b, s) {
    const c = clickCfg(s);
    if (c) return buildClick(b, s, c);
    if (/^(2-drawer chest|nightstand)/i.test(s.variant)) return buildCam(b, s);
    if (s.archetype === "bed" && /^bed frame/i.test(s.variant)) return buildBed(b, s);
    return false;
  },
};

export default family;
