import type { ProductSpec, Vec3, PartPiece } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "../builder";
import { rotate } from "../math";
import type { Family } from "./family";

/*
 * MALM, read from IKEA's manuals.
 *
 * Chests (2 and 4 drawers checked; 3 drawers follows the 4-drawer one): two sides with the cabinet runners already
 * on them are laid flat and take cam bolts and plastic glides. One side lies on the floor and the rails stand in it
 * on dowels and cam locks (the wide chests screw their plinth rail on with two L plates), then the other side goes on
 * top. The top takes cam bolts (and the wall brackets) upside down, goes on with dowels and cam locks, and the
 * hardboard back is nailed on with the chest on its front. Each drawer is built on its front: cam bolts, dowels and
 * sides, the bottom slid into the grooves, the back screwed on, then upside down for the runners.
 */

const t = 16;

// fittings, sized so different ones stay apart in the list
const ANGLE_SCREW: HwDef = { kind: "screw", len: 13, dia: 5 };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const WALL_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 35, dia: 8 };
const BACK_SCREW: HwDef = { kind: "screw", len: 50, dia: 6 };
const BOTTOM_SCREW: HwDef = { kind: "screw", len: 8, dia: 4 };
const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const ROD_SCREW: HwDef = { kind: "screw", len: 15, dia: 3.5 };

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) =>
  range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

function chestCount(s: ProductSpec) {
  const m = /chest of (\d+) drawers/i.exec(s.variant);
  const n = m ? Number(m[1]) : 0;
  // the wide chest of 6 drawers is two columns with a middle panel: buildChest6
  if (n < 2 || n > 4 || s.size.w > 100) return 0;
  return n;
}

function buildChest(b: PlanBuilder, s: ProductSpec, n: number) {
  const W = s.size.w * 10,
    H = s.size.h * 10,
    D = s.size.d * 10;
  // the narrow chest dowels its plinth in like a rail, has no glides on the plinth, no tilt stop and no wall brackets
  const wide = W >= 600;
  const topY = H - t; // underside of the top
  const sx = W / 2 - 3 - t / 2; // side centres: the top overhangs them a little
  const xi = W / 2 - 3 - t; // inner faces of the sides
  const zb = -D / 2 + 2,
    zf = D / 2 - 10; // back and front edges of the sides
  const sideD = zf - zb,
    sideZ = (zf + zb) / 2;
  const P = wide ? 40 : 60; // plinth height
  const pitch = (topY - P) / n;
  const slotB = (i: number) => P + i * pitch;
  const fh = pitch - t - 6;
  const ybox = (i: number) => slotB(i) + 13; // underside of a drawer box
  const xs = xi - 19; // drawer side centres, clear of the runners
  const dd = zf - t - (zb + t + 25); // drawer depth behind the front
  const zd = zf - t - dd / 2;
  const zBack = zf - t - dd; // back of a drawer
  const sh = Math.min(fh - 40, 160);
  const runLen = Math.round((dd - 20) / 10) * 10;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 20 };

  // sides, with the cabinet runners already screwed on at the factory
  const side = (name: string, sign: -1 | 1) => {
    const pieces: PartPiece[] = [
      { shape: "box", size: [t, topY, sideD], pos: [0, topY / 2, sideZ] },
    ];
    for (const i of range(n))
      pieces.push({
        shape: "box",
        size: [10, 18, runLen],
        pos: [-sign * (t / 2 + 5), ybox(i) - 10, zf - 30 - runLen / 2],
        material: "metal",
      });
    const { type, mid } = b.compound(name, pieces);
    return b.place(type, [sign * sx + mid[0], mid[1], mid[2]]);
  };
  const sides = [side("Left side", -1), side("Right side", 1)];
  const topT = b.part("Top panel", [W, t, D]);
  const top = b.place(topT, [0, H - t / 2, 0]);

  // rails across the front: one under the top and one between each pair of drawers
  const zr = zf - 20 - 25;
  const railT = b.part("Rail", [2 * xi, t, 50]);
  const railY = range(n).map((i) => slotB(i + 1) - t / 2);
  const rails = railY.map((y) => b.place(railT, [0, y, zr]));
  const zp = zf - 20 - t / 2;
  const plinthT = b.part("Plinth rail", [2 * xi, P, t]);
  const plinth = b.place(plinthT, [0, P / 2, zp]);
  const BR = wide ? 160 : 80;
  const yBR = 10 + BR / 2,
    zBR = zb + t / 2;
  const backRailT = b.part("Back rail", [2 * xi, BR, t]);
  const backRail = b.place(backRailT, [0, yBR, zBR]);
  const backT = b.part("Back panel", [W - 6, H - 12, 3], { material: "fiber" });
  const back = b.place(backT, [0, 10 + (H - 12) / 2, zb - 1.5]);

  // where each joint between the sides is made: its dowels, its cam bolt (in the side) and its cam lock
  interface Joint {
    key: string;
    dowels: [number, number][]; // y, z
    bolt: [number, number];
    cam: (sg: number) => FitOpts;
  }
  const railJoint = (k: string, y: number): Joint => ({
    key: k,
    dowels: [[y, zr + 12]],
    bolt: [y, zr - 12],
    cam: (sg) => ({
      on: k,
      at: [sg * (xi - 25), y + t / 2, zr - 12],
      dir: [0, -1, 0],
    }),
  });
  const rj = rails.map((k, i) => railJoint(k, railY[i]));
  const plinthJ: Joint = {
    key: plinth,
    dowels: [[P * 0.7, zp]],
    bolt: [P * 0.3, zp],
    cam: (sg) => ({
      on: plinth,
      at: [sg * (xi - 25), P * 0.3, zp - t / 2],
      dir: [0, 0, 1],
    }),
  };
  const backJ: Joint = {
    key: backRail,
    dowels: wide
      ? [
          [yBR - BR * 0.35, zBR],
          [yBR + BR * 0.35, zBR],
        ]
      : [[yBR + BR * 0.25, zBR]],
    bolt: [wide ? yBR : yBR - BR * 0.2, zBR],
    cam: (sg) => ({
      on: backRail,
      at: [sg * (xi - 25), wide ? yBR : yBR - BR * 0.2, zBR + t / 2],
      dir: [0, 0, -1],
    }),
  };
  const joints = wide ? [...rj, backJ] : [...rj, plinthJ, backJ];
  const sg = (i: number) => (i === 0 ? -1 : 1);
  const bolts = (si: number, js: Joint[]): FitOpts[] =>
    js.map((j) => ({
      on: sides[si],
      at: [sg(si) * xi, j.bolt[0], j.bolt[1]],
      dir: [sg(si), 0, 0],
      mate: j.key,
      mateHole: 4,
    }));
  const dowels = (js: Joint[]): FitOpts[] =>
    js.flatMap((j) =>
      [0, 1].flatMap((si) =>
        j.dowels.map(([y, z]): FitOpts => ({
          on: j.key,
          at: [sg(si) * xi, y, z],
          dir: [-sg(si), 0, 0],
          mate: sides[si],
        })),
      ),
    );
  const cams = (si: number, js: Joint[]) => js.map((j) => j.cam(sg(si)));

  // the top: cam bolts in its underside, dowels in the tops of the sides, cam locks in the sides
  const topZ = [zf - 50, zb + 50];
  const topDowelZ = [sideZ + 70, sideZ - 70];

  /* ---------- the carcass ---------- */

  b.step(
    {
      title: "Screw the cam bolts into both sides",
      detail:
        "Lay the sides on something soft, inside faces up. The runners are already on them.",
      tools: ["screwdriver"],
      scene: "prep",
      kind: "cams",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.2);
      b.stage(
        sides[0],
        [0, 14, -(D / 2 + 60)],
        [0, 0, Math.PI / 2],
        [0, 160, 0],
      );
      b.stage(sides[1], [0, 14, D / 2 + 60], [0, 0, -Math.PI / 2], [0, 160, 0]);
      b.then(0.2);
      b.fits(HW.camScrew, [...bolts(0, joints), ...bolts(1, joints)], 0.06);
    },
  );
  b.step(
    {
      title: "Push the glides into the bottom edges",
      detail: "Two in each side, at the front and the back.",
      scene: "prep",
      kind: "general",
    },
    () => {
      const list: FitOpts[] = [];
      for (const si of [0, 1])
        for (const z of [zf - 40, zb + 40])
          list.push({
            on: sides[si],
            at: [sg(si) * sx, 0, z],
            dir: [0, 1, 0],
            hole: false,
          });
      b.fits(HW.glide, list, 0.12);
    },
  );

  const plates: FitOpts[] = [-1, 1].map((g) => ({
    on: plinth,
    at: [g * (xi - 14), P / 2, zp - t / 2],
    dir: [0, 0, 1],
    hole: false,
    twist: g < 0 ? Math.PI : 0,
  }));
  if (wide) {
    b.step(
      {
        title: "Screw the L plates onto the plinth rail",
        detail:
          "One at each end, on the back face, with the bent edge flush with the end.",
        tools: ["screwdriver"],
        scene: "plinth",
        kind: "screws",
      },
      () => {
        b.stage(plinth, [0, t / 2, 0], [Math.PI / 2, 0, 0], [0, 140, 0]);
        b.then(0.15);
        b.fits(HW.angle, plates, 0.15);
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const g of [-1, 1])
          for (const dy of [-9, 9])
            sc.push({
              on: plinth,
              at: [g * (xi - 24), P / 2 + dy, zp - t / 2],
              dir: [0, 0, 1],
            });
        b.fits(ANGLE_SCREW, sc, 0.1);
      },
    );
    b.step(
      {
        title: "Push two glides into the plinth rail",
        detail: "They go in its bottom edge, near the ends.",
        scene: "plinth",
        kind: "general",
      },
      () =>
        b.fits(
          HW.glide,
          [-1, 1].map((g) => ({
            on: plinth,
            at: [g * (xi - 60), 0, zp],
            dir: [0, 1, 0],
            hole: false,
          })),
          0.15,
        ),
    );
    b.step(
      {
        title: "Lay one side down and screw the plinth rail to it",
        detail:
          "The runners face up. The L plate sits against the inside of the side, at the bottom front.",
        tools: ["screwdriver"],
        pose: "+x",
        kind: "screws",
        warnings: ["floor"],
      },
      () => {
        b.add(sides[0], [260, 0, 0]);
        b.then(0.15);
        b.add(plinth, [320, 0, 0]);
        b.then(0.1);
        b.fits(
          ANGLE_SCREW,
          [-9, 9].map((dy) => ({
            on: sides[0],
            at: [-xi, P / 2 + dy, zp - t / 2 - 14],
            dir: [-1, 0, 0],
          })),
          0.12,
        );
      },
    );
  }

  const first = wide ? rj : joints;
  b.step(
    {
      title: wide
        ? "Tap the dowels into the rails"
        : "Tap the dowels into the rails and the plinth",
      detail: "One in each end. Tap them in gently until they stop.",
      tools: ["hammer"],
      scene: "rails",
      kind: "dowels",
    },
    () => {
      b.stagger(0.12);
      first.forEach((j, i) => {
        const it = b.partItem(j.key);
        const sz = b.parts.find((p) => p.id === it.ref)!.size;
        const flat = sz[1] > sz[2] ? [Math.PI / 2, 0, 0] : [0, 0, 0];
        b.stage(
          j.key,
          [0, Math.min(sz[1], sz[2]) / 2, (i - (first.length - 1) / 2) * 140],
          flat as Vec3,
          [0, 120, 0],
        );
      });
      b.then(0.15);
      b.fits(HW.dowel, dowels(first), 0.05);
    },
  );
  b.step(
    {
      title: wide
        ? "Stand the rails in the side"
        : "Lay one side down and stand the rails in it",
      detail:
        "The runners face up. Push each rail down onto its dowel and cam bolt.",
      pose: "+x",
      kind: "join",
      warnings: wide ? [] : ["floor"],
    },
    () => {
      if (!wide) {
        b.add(sides[0], [260, 0, 0]);
        b.then(0.15);
      }
      b.stagger(0.2);
      for (const j of first) b.add(j.key, [300, 0, 0]);
    },
  );
  b.step(
    {
      title: "Lock the cam locks",
      detail:
        "Drop each one in with the arrow pointing at the bolt, then turn it clockwise until it bites.",
      tools: ["screwdriver"],
      pose: "+x",
      kind: "cams",
    },
    () => b.fits(HW.cam, cams(0, first), 0.12),
  );
  if (wide) {
    b.step(
      {
        title: "Tap the dowels into the back rail",
        detail: "Two in each end. It's the plain board without a finish.",
        tools: ["hammer"],
        scene: "rails",
        kind: "dowels",
      },
      () => {
        b.stage(backRail, [0, t / 2, 0], [Math.PI / 2, 0, 0], [0, 120, 0]);
        b.then(0.15);
        b.fits(HW.dowel, dowels([backJ]), 0.08);
      },
    );
    b.step(
      {
        title: "Stand the back rail in and lock it",
        detail: "It goes at the bottom of the back edge.",
        tools: ["screwdriver"],
        pose: "+x",
        kind: "cams",
      },
      () => {
        b.add(backRail, [300, 0, 0]);
        b.then(0.15);
        b.fits(HW.cam, cams(0, [backJ]), 0.12);
      },
    );
  }
  b.step(
    {
      title: "Lower the other side onto the rails",
      detail:
        "Its cam bolts go into the holes at the ends of the rails. Press it down evenly.",
      pose: "+x",
      kind: "join",
    },
    () => b.add(sides[1], [420, 0, 0]),
  );
  if (wide)
    b.step(
      {
        title: "Screw the L plate to this side",
        detail: "Two screws through the plate into the side.",
        tools: ["screwdriver"],
        pose: "+x",
        kind: "screws",
      },
      () =>
        b.fits(
          ANGLE_SCREW,
          [-9, 9].map((dy) => ({
            on: sides[1],
            at: [xi, P / 2 + dy, zp - t / 2 - 14],
            dir: [1, 0, 0],
          })),
          0.12,
        ),
    );
  b.step(
    {
      title: wide
        ? "Lock the cam locks on this side"
        : "Turn it over and lock the cam locks",
      detail: "Arrow towards the bolt, then a clockwise turn.",
      tools: ["screwdriver"],
      pose: wide ? "+x" : "-x",
      kind: "cams",
    },
    () => b.fits(HW.cam, cams(1, joints), 0.12),
  );

  // the top, upside down
  const topBolts: FitOpts[] = [];
  for (const si of [0, 1])
    for (const z of topZ)
      topBolts.push({
        on: top,
        at: [sg(si) * sx, topY, z],
        dir: [0, 1, 0],
        mate: sides[si],
        mateHole: 4,
      });
  const bx = [-W / 4, W / 4];
  b.step(
    {
      title: "Screw the cam bolts into the top",
      detail: "Lay the top upside down on something soft.",
      tools: ["screwdriver"],
      scene: "top",
      kind: "cams",
      warnings: ["face"],
    },
    () => {
      b.stage(top, [0, t / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
      b.then(0.15);
      b.fits(HW.camScrew, topBolts, 0.12);
    },
  );
  if (wide)
    b.step(
      {
        title: "Screw the wall brackets under the top",
        detail:
          "Near the back edge. Leave the screws a little loose so the brackets can slide.",
        tools: ["screwdriver"],
        scene: "top",
        kind: "screws",
      },
      () => {
        b.fits(
          HW.bracket,
          bx.map((x) => ({
            on: top,
            at: [x, topY, zb + 22],
            dir: [0, 1, 0],
            hole: false,
          })),
          0.2,
        );
        b.then(0.1);
        b.fits(
          HW.washer,
          bx.map((x) => ({
            on: top,
            at: [x, topY - 3, zb + 44],
            dir: [0, 1, 0],
            hole: false,
          })),
          0.15,
        );
        b.then(0.05);
        b.fits(
          BRACKET_SCREW,
          bx.map((x) => ({
            on: top,
            at: [x, topY - 3, zb + 44],
            dir: [0, 1, 0],
          })),
          0.15,
        );
      },
    );
  b.step(
    {
      title: "Stand it up and put the top on",
      detail:
        "Tap two dowels into the top of each side, then lower the top onto them.",
      tools: ["hammer"],
      pose: "+y",
      kind: "join",
    },
    () => {
      const list: FitOpts[] = [];
      for (const si of [0, 1])
        for (const z of topDowelZ)
          list.push({
            on: sides[si],
            at: [sg(si) * sx, topY, z],
            dir: [0, -1, 0],
            mate: top,
          });
      b.fits(HW.dowel, list, 0.08);
      b.then(0.2);
      b.add(top, [0, 300, 0]);
    },
  );
  b.step(
    {
      title: "Lock the top with cam locks",
      detail: "Two in each side, just under the top.",
      tools: ["screwdriver"],
      kind: "cams",
    },
    () => {
      const list: FitOpts[] = [];
      for (const si of [0, 1])
        for (const z of topZ)
          list.push({
            on: sides[si],
            at: [sg(si) * xi, topY - 25, z],
            dir: [sg(si), 0, 0],
          });
      b.fits(HW.cam, list, 0.12);
    },
  );

  // the back, nailed on with the chest on its front
  b.step(
    {
      title: "Lay it on its front",
      detail: "On the flattened box, so the front edges don't get scratched.",
      pose: "-z",
      kind: "flip",
      warnings: ["floor"],
    },
    () => {},
  );
  const zn = zb - 3;
  const nailOn = (k: string, x: number, y: number): FitOpts => ({
    on: k,
    at: [x, y, zn],
    dir: [0, 0, 1],
    hole: false,
  });
  b.step(
    {
      title: "Lay the back panel on and nail the corners",
      detail:
        "Push it into one top corner and nail it, then the other top corner, then the middle of the bottom edge. That squares the chest.",
      tools: ["hammer"],
      pose: "-z",
      kind: "nails",
      check: "square",
    },
    () => {
      b.add(back, [0, 0, -340]);
      b.then(0.25);
      b.fits(
        HW.nail,
        [
          nailOn(sides[0], -sx, H - 40),
          nailOn(sides[1], sx, H - 40),
          nailOn(backRail, 0, yBR),
        ],
        0.4,
      );
    },
  );
  b.step(
    {
      title: "Nail the back panel all round",
      detail:
        "Along both sides, the top and the back rail, keeping the nails straight.",
      tools: ["hammer"],
      pose: "-z",
      kind: "nails",
    },
    () => {
      const list: FitOpts[] = [];
      for (const si of [0, 1])
        for (const y of spread(60, H - 110, 8))
          list.push(nailOn(sides[si], sg(si) * sx, y));
      for (const x of spread(-W / 2 + 60, W / 2 - 60, 6))
        list.push(nailOn(top, x, H - t / 2));
      for (const x of spread(-xi + 50, xi - 50, 6).filter((_, i) => i !== 2))
        list.push(nailOn(backRail, x, yBR));
      b.fits(HW.nail, list, 0.05);
    },
  );
  b.step(
    {
      title: "Stand it up",
      detail: wide
        ? "Stand it where it will go, against the wall."
        : "Turn it upright on a flat floor.",
      pose: "+y",
      kind: "standup",
    },
    () => {},
  );

  // wall fixing, before the drawers go in
  if (wide) {
    const wy = topY - 26;
    b.step(
      {
        title: "Mark the wall through the brackets",
        detail:
          "Push the chest against the wall and mark through the slot in each bracket.",
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
        detail:
          "Move the chest away first. Plugs suit solid walls; use fixings made for your wall if it's different.",
        tools: ["drill", "hammer"],
        kind: "anchor",
        wall: true,
        warnings: ["wall"],
      },
      () =>
        b.fits(
          WALL_PLUG,
          bx.map((x) => ({ at: [x, wy, -D / 2 - 1], dir: [0, 0, -1] as Vec3 })),
          0.2,
        ),
    );
    b.step(
      {
        title: "Screw it to the wall",
        detail:
          "Push it back, put a washer on each screw and screw through the brackets. Then tighten the bracket screws under the top.",
        tools: ["screwdriver"],
        kind: "anchor",
        wall: true,
        warnings: ["tip"],
      },
      () => {
        b.fits(
          HW.washer,
          bx.map((x) => ({ at: [x, wy, zb + 6], dir: [0, 0, -1] as Vec3 })),
          0.15,
        );
        b.then(0.05);
        b.fits(
          WALL_SCREW,
          bx.map((x) => ({ at: [x, wy, zb + 8], dir: [0, 0, -1] as Vec3 })),
          0.2,
        );
      },
    );
  }

  chestDrawers(b, {
    rows: n,
    cols: [0],
    hw: xi,
    xs,
    fh,
    sh,
    dd,
    zf,
    zd,
    zBack,
    runLen,
    slotB,
    ybox,
    rod: wide,
  });
  return true;
}

interface DrawerGrid {
  rows: number;
  cols: number[]; // centre of each column of drawers
  hw: number; // half the opening width of a column
  xs: number; // drawer side centres, from the column centre
  fh: number;
  sh: number;
  dd: number;
  zf: number;
  zd: number;
  zBack: number;
  runLen: number;
  slotB: (i: number) => number;
  ybox: (i: number) => number;
  rod: boolean;
}

/** The MALM drawers: one is built on its front step by step, the rest the same, then they all slide in. */
function chestDrawers(b: PlanBuilder, g: DrawerGrid) {
  const { xs, fh, sh, dd, zf, zd, zBack, runLen, slotB, ybox } = g;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 20 };

  const frT = b.part("Drawer front", [2 * g.hw - 4, fh, t]);
  const dsT = b.part("Drawer side", [12, sh, dd]);
  const dbtT = b.part("Drawer bottom", [2 * xs, 3, dd - 12], {
    material: "fiber",
  });
  const dbT = b.part("Drawer back", [2 * xs - 12, sh - 14, 12]);
  const rodT = g.rod
    ? b.part("Tilt stop rod", [8, 2 * xs + 10, 8], {
        shape: "cyl",
        material: "metal",
      })
    : "";
  interface Drawer {
    front: string;
    sides: string[];
    bottom: string;
    back: string;
    rod?: string;
    y: number;
    cx: number;
  }
  const drawers: Drawer[] = range(g.rows).flatMap((i) =>
    g.cols.map((cx) => {
      const y = ybox(i);
      return {
        y,
        cx,
        front: b.place(frT, [cx, slotB(i) + 3 + fh / 2, zf - t / 2]),
        sides: [-1, 1].map((k) => b.place(dsT, [cx + k * xs, y + sh / 2, zd])),
        bottom: b.place(dbtT, [cx, y + 10, zf - t - (dd - 12) / 2]),
        back: b.place(dbT, [cx, y + 14 + (sh - 14) / 2, zBack + 6]),
        rod: g.rod
          ? b.place(rodT, [cx, y - 6, zBack + 30], [0, 0, Math.PI / 2])
          : undefined,
      };
    }),
  );
  const n = drawers.length;
  const fitsOf = (d: Drawer) => {
    const per = (fn: (g: number, side: string) => FitOpts[]) =>
      [-1, 1].flatMap((k) => fn(k, d.sides[k < 0 ? 0 : 1]));
    return {
      bolts: per((g, sd) =>
        [d.y + 25, d.y + sh - 25].map((y): FitOpts => ({
          on: d.front,
          at: [d.cx + g * xs, y, zf - t],
          dir: [0, 0, 1],
          mate: sd,
          mateHole: 4,
        })),
      ),
      dowels: per((g, sd) =>
        [d.y + sh * 0.4, d.y + sh * 0.62].map((y): FitOpts => ({
          on: d.front,
          at: [d.cx + g * xs, y, zf - t],
          dir: [0, 0, 1],
          mate: sd,
        })),
      ),
      cams: per((g, sd) =>
        [d.y + 25, d.y + sh - 25].map((y): FitOpts => ({
          on: sd,
          at: [d.cx + g * (xs - 6), y, zf - t - 30],
          dir: [g, 0, 0],
        })),
      ),
      backScrews: per((g, sd) =>
        [0.3, 0.75].map((k): FitOpts => ({
          on: sd,
          at: [d.cx + g * (xs + 6), d.y + 14 + (sh - 14) * k, zBack + 6],
          dir: [-g, 0, 0],
          mate: d.back,
        })),
      ),
      bottomScrews: [-1, 1].map((g): FitOpts => ({
        on: d.bottom,
        at: [d.cx + g * (xs - 40), d.y + 8.5, zBack + 6],
        dir: [0, 1, 0],
        mate: d.back,
      })),
      runners: per((g, sd) => [
        {
          on: sd,
          at: [d.cx + g * xs, d.y, zf - t - 10 - runLen / 2],
          dir: [0, 1, 0],
          hole: false,
        },
      ]),
      runnerScrews: per((g, sd) => [
        { on: sd, at: [d.cx + g * xs, d.y - 2, zf - t - 40], dir: [0, 1, 0] },
        { on: sd, at: [d.cx + g * xs, d.y - 2, zf - t - runLen + 20], dir: [0, 1, 0] },
        { on: sd, at: [d.cx + g * (xs + 6), d.y + 8, zf - t - 70], dir: [-g, 0, 0] },
      ]),
      rodScrews: d.rod
        ? per((g, sd) => [
            {
              on: sd,
              at: [d.cx + g * (xs + 6), d.y + 6, zBack + 30],
              dir: [-g, 0, 0],
            },
          ])
        : [],
    };
  };
  const d0 = drawers[0];
  const c0: Vec3 = [d0.cx, d0.y + sh / 2, zd];
  const rel = (k: string): Vec3 => {
    const it = b.partItem(k);
    return [
      it.final.pos[0] - c0[0],
      it.final.pos[1] - c0[1],
      it.final.pos[2] - c0[2],
    ];
  };
  const stage = (k: string, from: Vec3) =>
    b.stage(k, rel(k), b.partItem(k).final.rot, from);
  const rep = n > 1 ? n : undefined;
  const f0 = fitsOf(d0);
  const dstep = (
    title: string,
    detail: string,
    body: () => void,
    o: {
      tools?: ("screwdriver" | "hammer")[];
      kind?: "dowels" | "cams" | "drawer" | "screws" | "runners";
      pose?: "-z" | "-y";
    } = {},
  ) =>
    b.step(
      {
        title,
        detail,
        tools: o.tools,
        scene: "drawer",
        pose: o.pose ?? "-z",
        repeat: rep,
        kind: o.kind ?? "drawer",
      },
      body,
    );

  dstep(
    "Screw the cam bolts into a drawer front",
    "Lay the front face down on something soft.",
    () => {
      stage(d0.front, [0, 0, -160]);
      b.then(0.15);
      b.fits(HW.camScrew, f0.bolts, 0.1);
    },
    { tools: ["screwdriver"], kind: "cams" },
  );
  dstep(
    "Tap in the dowels and stand the sides on the front",
    "The grooves face inwards, at the bottom. Stick the warning label inside one side.",
    () => {
      b.fits(HW.dowel, f0.dowels, 0.08);
      b.then(0.15);
      b.stagger(0.25);
      for (const sd of d0.sides) stage(sd, [0, 0, -300]);
    },
    { tools: ["hammer"], kind: "dowels" },
  );
  dstep(
    "Lock the sides with cam locks",
    "Arrow towards the bolt, then a clockwise turn.",
    () => b.fits(HW.cam, f0.cams, 0.12),
    { tools: ["screwdriver"], kind: "cams" },
  );
  dstep(
    "Slide in the drawer bottom",
    "Smooth side in. It runs down the grooves until it reaches the front.",
    () => stage(d0.bottom, [0, 0, -420]),
  );
  dstep(
    "Put the drawer back on",
    "The notch in its edge goes at the bottom, over the drawer bottom.",
    () => stage(d0.back, [0, 0, -260]),
  );
  dstep(
    "Screw the back to the sides",
    "Two long screws through each side, then two small ones up through the bottom into the back.",
    () => {
      b.fits(BACK_SCREW, f0.backScrews, 0.12);
      b.then(0.1);
      b.fits(BOTTOM_SCREW, f0.bottomScrews, 0.15);
    },
    { tools: ["screwdriver"], kind: "screws" },
  );
  dstep(
    "Turn it upside down and fit the runners",
    "The left and right runners are marked. Press each onto the bottom edge of its side, wheel at the back, and screw it on.",
    () => {
      b.fits(RUNNER, f0.runners, 0.25);
      b.then(0.1);
      b.fits(RUNNER_SCREW, f0.runnerScrews, 0.08);
    },
    { tools: ["screwdriver"], kind: "runners", pose: "-y" },
  );
  if (d0.rod)
    dstep(
      "Clip on the tilt stop",
      "Screw in the two screws, clip the rod onto them and turn it until it locks.",
      () => {
        b.fits(ROD_SCREW, f0.rodScrews, 0.15);
        b.then(0.15);
        stage(d0.rod!, [0, -160, 0]);
      },
      { tools: ["screwdriver"], kind: "drawer", pose: "-y" },
    );

  b.step(
    {
      title:
        n > 2
          ? `Slide in all ${n} drawers`
          : n === 2
            ? "Slide in both drawers"
            : "Slide in the drawer",
      detail:
        "Rest the runners on the ones in the chest and push until it closes. Only open one drawer at a time.",
      kind: "drawer",
      warnings: ["tip"],
    },
    () => {
      for (const [i, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of [
          d.front,
          ...d.sides,
          d.bottom,
          d.back,
          ...(d.rod ? [d.rod] : []),
        ])
          b.add(k, [0, 0, 520]);
        if (i > 0) {
          const f = fitsOf(d);
          const all: [HwDef, FitOpts[]][] = [
            [HW.camScrew, f.bolts],
            [HW.dowel, f.dowels],
            [HW.cam, f.cams],
            [BACK_SCREW, f.backScrews],
            [BOTTOM_SCREW, f.bottomScrews],
            [RUNNER, f.runners],
            [RUNNER_SCREW, f.runnerScrews],
            [ROD_SCREW, f.rodScrews],
          ];
          for (const [def, list] of all) for (const o of list) b.preset(def, o);
        }
        b.wait(0.22);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
  return true;
}

/* ---------- the chest of 6 drawers ---------- */

/*
 * The wide chest of 6 drawers (its own manual): two columns of three with a middle panel. The left half is built on
 * the left side lying on the floor: runners and cam bolts in the side, the plinth rail on two L plates, the rails and
 * back rail stood in on dowels, then the middle panel on top. The right half is built the same way on the right side,
 * and the left half is lifted onto it. Standing, the top goes on dowels and cam bolts; upside down it gets six glides,
 * and on its front two hardboard backs are nailed on. The drawers are the same as the other chests'.
 */
const MID_CAM: HwDef = { kind: "cam", len: 15, dia: 20, name: "Double cam lock" };
const BIG_TOP_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 10 };
const CAB_RUNNER = (len: number): HwDef => ({ kind: "runner", len, dia: 20, name: "Cabinet runner" });
const CAB_RUNNER_SCREW: HwDef = { kind: "screw", len: 11, dia: 4 };

function buildChest6(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10,
    H = s.size.h * 10,
    D = s.size.d * 10;
  const n = 3;
  const topY = H - t;
  const sx = W / 2 - 3 - t / 2;
  const xi = W / 2 - 3 - t;
  const mx = t / 2; // faces of the middle panel
  const zb = -D / 2 + 2,
    zf = D / 2 - 10;
  const sideD = zf - zb,
    sideZ = (zf + zb) / 2;
  const P = 40;
  const pitch = (topY - P) / n;
  const slotB = (i: number) => P + i * pitch;
  const fh = pitch - t - 6;
  const ybox = (i: number) => slotB(i) + 13;
  const hw = (xi - mx) / 2; // half a column's opening
  const cols = [-1, 1].map((g) => g * (mx + hw));
  const xs = hw - 19;
  const dd = zf - t - (zb + t + 25);
  const zd = zf - t - dd / 2;
  const zBack = zf - t - dd;
  const sh = Math.min(fh - 40, 160);
  const runLen = Math.round((dd - 20) / 10) * 10;
  const runZ = zf - 30 - runLen / 2;

  // panels with runners on them from the factory: the right side and the middle panel's left face
  const withRunners = (name: string, x: number, face: number) => {
    const pieces: PartPiece[] = [{ shape: "box", size: [t, topY, sideD], pos: [0, topY / 2, sideZ] }];
    for (const i of range(n))
      pieces.push({ shape: "box", size: [10, 18, runLen], pos: [face * (t / 2 + 5), ybox(i) - 10, runZ], material: "metal" });
    const { type, mid } = b.compound(name, pieces);
    return b.place(type, [x + mid[0], mid[1], mid[2]]);
  };
  const left = b.place(b.part("Left side", [t, topY, sideD]), [-sx, topY / 2, sideZ]);
  const middle = withRunners("Middle panel", 0, -1);
  const right = withRunners("Right side", sx, -1);
  const top = b.place(b.part("Top panel", [W, t, D]), [0, H - t / 2, 0]);

  const zr = zf - 20 - 25;
  const zp = zf - 20 - t / 2;
  const BR = 160;
  const yBR = 10 + BR / 2,
    zBR = zb + t / 2;
  const railT = b.part("Rail", [2 * hw, t, 50]);
  const plinthT = b.part("Plinth rail", [2 * hw, P, t]);
  const backRailT = b.part("Back rail", [2 * hw, BR, t]);
  const railY = range(n).map((i) => slotB(i + 1) - t / 2);
  const column = cols.map((cx) => ({
    cx,
    rails: railY.map((y) => b.place(railT, [cx, y, zr])),
    plinth: b.place(plinthT, [cx, P / 2, zp]),
    backRail: b.place(backRailT, [cx, yBR, zBR]),
  }));
  const backT = b.part("Back panel", [W / 2 - 4, H - 12, 3], { material: "fiber" });
  const backs = [-1, 1].map((g) => b.place(backT, [g * (W / 4 - 1), 10 + (H - 12) / 2, zb - 1.5]));

  interface End {
    x: number; // the panel face this end meets
    s: number; // outwards, from the rail to the panel
    panel: string;
  }
  interface Joint {
    key: string;
    dowel: [number, number];
    bolt: [number, number];
    camY: number;
    camZ: number;
    camDir: Vec3;
  }
  const ends = (c: number): End[] =>
    c === 0
      ? [
          { x: -xi, s: -1, panel: left },
          { x: -mx, s: 1, panel: middle },
        ]
      : [
          { x: mx, s: -1, panel: middle },
          { x: xi, s: 1, panel: right },
        ];
  const joints = (c: number): Joint[] => [
    ...column[c].rails.map((k, i) => ({ key: k, dowel: [railY[i], zr + 12] as [number, number], bolt: [railY[i], zr - 12] as [number, number], camY: railY[i] + t / 2, camZ: zr - 12, camDir: [0, -1, 0] as Vec3 })),
    { key: column[c].backRail, dowel: [yBR + BR * 0.25, zBR], bolt: [yBR - BR * 0.2, zBR], camY: yBR - BR * 0.2, camZ: zBR + t / 2, camDir: [0, 0, -1] },
  ];
  const bolts = (e: End, js: Joint[]): FitOpts[] => js.map((j) => ({ on: e.panel, at: [e.x, j.bolt[0], j.bolt[1]], dir: [e.s, 0, 0], mate: j.key, mateHole: 4 }));
  const dowels = (c: number): FitOpts[] =>
    joints(c).flatMap((j) => ends(c).map((e): FitOpts => ({ on: j.key, at: [e.x, j.dowel[0], j.dowel[1]], dir: [e.s, 0, 0], mate: e.panel })));
  const cams = (e: End, js: Joint[]): FitOpts[] => js.map((j) => ({ on: j.key, at: [e.x - e.s * 25, j.camY, j.camZ], dir: j.camDir }));
  const plates = (c: number): FitOpts[] => ends(c).map((e) => ({ on: column[c].plinth, at: [e.x - e.s * 14, P / 2, zp - t / 2], dir: [0, 0, 1], hole: false, twist: e.s < 0 ? Math.PI : 0 }));
  const plateScrews = (c: number): FitOpts[] => ends(c).flatMap((e) => [-9, 9].map((dy): FitOpts => ({ on: column[c].plinth, at: [e.x - e.s * 24, P / 2 + dy, zp - t / 2], dir: [0, 0, 1] })));
  const plateToPanel = (e: End): FitOpts[] => [{ on: e.panel, at: [e.x, P / 2, zp - t / 2 - 14], dir: [e.s, 0, 0] }];
  const plinthGlides = (c: number): FitOpts[] => [-1, 1].map((g) => ({ on: column[c].plinth, at: [column[c].cx + g * (hw - 60), 0, zp], dir: [0, 1, 0], hole: false }));
  const runners = (on: string, x: number, d: number) => ({
    runners: range(n).map((i): FitOpts => ({ on, at: [x, ybox(i) - 10, runZ], dir: [d, 0, 0], hole: false })),
    screws: range(n).flatMap((i) => [zf - 50, zf - 10 - runLen].map((z): FitOpts => ({ on, at: [x, ybox(i) - 10, z], dir: [d, 0, 0] }))),
  });
  const RUN = CAB_RUNNER(runLen);
  const [eL, eML] = ends(0);
  const [eMR, eR] = ends(1);
  const people = 2 as const;

  /* ---------- the left half, on the left side ---------- */
  b.step(
    { title: "Screw the runners onto the left side", detail: "Lay it on a rug, inside up. Three runners, wheel at the front, two screws each.", tools: ["screwdriver"], pose: "+x", kind: "runners", warnings: ["floor"] },
    () => {
      b.add(left, [260, 0, 0]);
      b.then(0.15);
      const r = runners(left, -xi, -1);
      b.fits(RUN, r.runners, 0.15);
      b.then(0.05);
      b.fits(CAB_RUNNER_SCREW, r.screws, 0.05);
    },
  );
  b.step({ title: "Screw the cam bolts into the left side", detail: "Four, into the holes along the front and the bottom of the back.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () =>
    b.fits(HW.camScrew, bolts(eL, joints(0)), 0.08),
  );
  const plinthPrep = (c: number, scene: string) => {
    b.step({ title: "Screw the L plates onto a plinth rail", detail: "One at each end, on the back face, bent edge flush with the end. Two screws each.", tools: ["screwdriver"], scene, kind: "screws" }, () => {
      b.stage(column[c].plinth, [0, t / 2, 0], [Math.PI / 2, 0, 0], [0, 140, 0]);
      b.then(0.15);
      b.fits(HW.angle, plates(c), 0.15);
      b.then(0.1);
      b.fits(ANGLE_SCREW, plateScrews(c), 0.1);
    });
    b.step({ title: "Push two glides into the plinth rail", detail: "Into its bottom edge, near the ends.", scene, kind: "general" }, () => b.fits(HW.glide, plinthGlides(c), 0.15));
  };
  plinthPrep(0, "plinth");
  b.step({ title: "Screw the plinth rail to the side", detail: "Bottom front, the L plate against the inside of the side. One screw.", tools: ["screwdriver"], pose: "+x", kind: "screws" }, () => {
    b.add(column[0].plinth, [320, 0, 0]);
    b.then(0.1);
    b.fits(ANGLE_SCREW, plateToPanel(eL), 0.12);
  });
  const railPrep = (c: number, scene: string) =>
    b.step({ title: "Tap the dowels into the rails", detail: "One into each end of the three rails and the back rail. Use the small dowels.", tools: ["hammer"], scene, kind: "dowels" }, () => {
      b.stagger(0.12);
      joints(c).forEach((j, i) => {
        const it = b.partItem(j.key);
        const sz = b.parts.find((p) => p.id === it.ref)!.size;
        const flat = sz[1] > sz[2] ? [Math.PI / 2, 0, 0] : [0, 0, 0];
        b.stage(j.key, [0, Math.min(sz[1], sz[2]) / 2, (i - 1.5) * 140], flat as Vec3, [0, 120, 0]);
      });
      b.then(0.15);
      b.fits(HW.dowel, dowels(c), 0.05);
    });
  railPrep(0, "rails");
  b.step({ title: "Stand the rails in the side and lock them", detail: "Push each onto its dowel and cam bolt, then turn the four cam locks clockwise.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => {
    b.stagger(0.2);
    for (const j of joints(0)) b.add(j.key, [300, 0, 0]);
    b.then(0.15);
    b.fits(HW.cam, cams(eL, joints(0)), 0.12);
  });
  b.step({ title: "Screw the cam bolts into the middle panel", detail: "Four, on the face with the runners already on it.", tools: ["screwdriver"], scene: "middle", kind: "cams" }, () => {
    b.stage(middle, [0, 14, 0], [0, 0, -Math.PI / 2], [0, 160, 0]);
    b.then(0.15);
    b.fits(HW.camScrew, bolts(eML, joints(0)), 0.08);
  });
  b.step({ title: "Lower the middle panel onto the rails", detail: "Runners facing down, onto the dowels at the ends of the rails.", pose: "+x", kind: "join" }, () => b.add(middle, [420, 0, 0]));
  b.step({ title: "Lock it and screw on the L plate", detail: "Four cam locks, then one screw through the L plate into the middle panel.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => {
    b.fits(HW.cam, cams(eML, joints(0)), 0.12);
    b.then(0.1);
    b.fits(ANGLE_SCREW, plateToPanel(eML), 0.12);
  });
  b.step({ title: "Stand it up and screw the runners onto the middle panel", detail: "On its free face: three runners, two screws each.", tools: ["screwdriver"], pose: "+y", kind: "runners" }, () => {
    const r = runners(middle, mx, -1);
    b.fits(RUN, r.runners, 0.15);
    b.then(0.05);
    b.fits(CAB_RUNNER_SCREW, r.screws, 0.05);
  });
  b.step({ title: "Screw four cam bolts into the middle panel", detail: "On the same face, for the rails of the right half.", tools: ["screwdriver"], pose: "+y", kind: "cams" }, () =>
    b.fits(HW.camScrew, bolts(eMR, joints(1)), 0.08),
  );

  /* ---------- the right half, on the right side ---------- */
  const R = "right";
  const here = (k: string) => {
    const it = b.partItem(k);
    b.stage(k, it.final.pos, it.final.rot);
  };
  b.step({ title: "Screw the cam bolts into the right side", detail: "Lay it on the rug, inside up. Four cam bolts.", tools: ["screwdriver"], scene: R, pose: "-x", kind: "cams", warnings: ["floor"] }, () => {
    here(right);
    b.then(0.15);
    b.fits(HW.camScrew, bolts(eR, joints(1)), 0.08);
  });
  plinthPrep(1, "plinth2");
  b.step({ title: "Screw the other plinth rail to the right side", detail: "One screw through the L plate, bottom front.", tools: ["screwdriver"], scene: R, pose: "-x", kind: "screws" }, () => {
    here(column[1].plinth);
    b.then(0.1);
    b.fits(ANGLE_SCREW, plateToPanel(eR), 0.12);
  });
  railPrep(1, "rails2");
  b.step({ title: "Stand the rails in the right side and lock them", detail: "Onto the dowels and cam bolts, then four cam locks.", tools: ["screwdriver"], scene: R, pose: "-x", kind: "cams" }, () => {
    b.stagger(0.2);
    for (const j of joints(1)) here(j.key);
    b.then(0.15);
    b.fits(HW.cam, cams(eR, joints(1)), 0.12);
  });
  const halfL = [left, middle, top, ...column[0].rails, column[0].plinth, column[0].backRail].filter((k) => k !== top);
  const halfR = [right, ...column[1].rails, column[1].plinth, column[1].backRail];
  b.step({ title: "Lift the left half onto the right half", detail: "Together: middle panel down, onto the dowels of the right half's rails.", pose: "-x", people, kind: "join", warnings: ["two"] }, () => {
    b.stagger(0);
    for (const k of halfR) b.add(k);
    b.then(0.1);
    for (const k of halfL) b.add(k, [-420, 0, 0]);
  });
  b.step({ title: "Lock the rails to the middle panel", detail: "Three cam locks, then one screw through the L plate.", tools: ["screwdriver"], pose: "-x", kind: "cams" }, () => {
    b.fits(HW.cam, cams(eMR, joints(1)).slice(0, n), 0.12);
    b.then(0.1);
    b.fits(ANGLE_SCREW, plateToPanel(eMR), 0.12);
  });

  /* ---------- the top ---------- */
  const topZ = [zf - 50, zb + 50];
  const topDowelZ = [sideZ + 70, sideZ - 70];
  const topX = [-sx, 0, sx];
  const bx = [-W / 4, W / 4];
  b.step({ title: "Screw the cam bolts into the top", detail: "Lay it upside down on something soft. Six: over each side and over the middle panel.", tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["face"] }, () => {
    b.stage(top, [0, t / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
    b.then(0.15);
    b.fits(
      HW.camScrew,
      topX.flatMap((x, i) => (i === 1 ? [topZ[0], topZ[1]] : topZ).map((z): FitOpts => ({ on: top, at: [x, topY, z], dir: [0, 1, 0], mate: i === 0 ? left : i === 1 ? middle : right, mateHole: 4 }))),
      0.1,
    );
  });
  b.step({ title: "Screw the wall brackets under the top", detail: "Near the back edge, a screw and a washer in each. Leave them a little loose.", tools: ["screwdriver"], scene: "top", kind: "screws" }, () => {
    b.fits(HW.bracket, bx.map((x) => ({ on: top, at: [x, topY, zb + 22], dir: [0, 1, 0], hole: false })), 0.2);
    b.then(0.1);
    b.fits(HW.washer, bx.map((x) => ({ on: top, at: [x, topY - 3, zb + 44], dir: [0, 1, 0], hole: false })), 0.15);
    b.then(0.05);
    b.fits(BRACKET_SCREW, bx.map((x) => ({ on: top, at: [x, topY - 3, zb + 44], dir: [0, 1, 0] })), 0.15);
  });
  b.step({ title: "Stand it up and tap in the dowels for the top", detail: "Together. Two big dowels into the middle panel, two small ones into the top of each side.", tools: ["hammer"], pose: "+y", people, kind: "dowels", warnings: ["two"] }, () => {
    b.fits(BIG_TOP_DOWEL, topDowelZ.map((z) => ({ on: middle, at: [0, topY, z], dir: [0, -1, 0], mate: top })), 0.1);
    b.then(0.05);
    b.fits(HW.dowel, [-sx, sx].flatMap((x, i) => topDowelZ.map((z): FitOpts => ({ on: i ? right : left, at: [x, topY, z], dir: [0, -1, 0], mate: top }))), 0.08);
  });
  b.step({ title: "Put the top on", detail: "Lower it onto the dowels, cam bolts into the holes.", pose: "+y", kind: "join" }, () => b.add(top, [0, 300, 0]));
  b.step({ title: "Lock the top", detail: "Four cam locks in the sides, then the two double cam locks in the middle panel.", tools: ["screwdriver"], kind: "cams" }, () => {
    b.fits(HW.cam, [-1, 1].flatMap((g, i) => topZ.map((z): FitOpts => ({ on: i ? right : left, at: [g * xi, topY - 25, z], dir: [g, 0, 0] }))), 0.12);
    b.then(0.1);
    b.fits(MID_CAM, topZ.map((z) => ({ on: middle, at: [-mx, topY - 25, z], dir: [1, 0, 0] })), 0.15);
  });
  b.step({ title: "Turn it upside down", detail: "Lock the last cam lock, on the back rail at the middle panel.", tools: ["screwdriver"], pose: "-y", people, kind: "cams", warnings: ["two", "floor"] }, () =>
    b.fits(HW.cam, cams(eMR, joints(1)).slice(n), 0.12),
  );
  b.step({ title: "Push in the glides", detail: "Two under each side and two under the middle panel, front and back.", pose: "-y", kind: "general" }, () =>
    b.fits(HW.glide, topX.flatMap((x, i) => [zf - 40, zb + 40].map((z): FitOpts => ({ on: [left, middle, right][i], at: [x, 0, z], dir: [0, 1, 0], hole: false }))), 0.1),
  );

  /* ---------- the backs ---------- */
  const zn = zb - 3;
  const nail = (k: string, x: number, y: number): FitOpts => ({ on: k, at: [x, y, zn], dir: [0, 0, 1], hole: false });
  b.step({ title: "Lay it on its front and put the backs on", detail: "Push each hardboard back into its corner and nail its corners first: the outer top, the middle top, then the back rail. That squares it.", tools: ["hammer"], pose: "-z", people, kind: "nails", check: "square" }, () => {
    b.stagger(0.25);
    for (const k of backs) b.add(k, [0, 0, -340]);
    b.then(0.2);
    b.fits(
      HW.nail,
      [-1, 1].flatMap((g, c) => [nail(c ? right : left, g * sx, H - 40), nail(middle, g * 4, H - 40), nail(column[c].backRail, column[c].cx, yBR)]),
      0.25,
    );
  });
  b.step({ title: "Nail the backs all round", detail: "54 nails along the sides, the middle panel, the top and the back rails, keeping them straight.", tools: ["hammer"], pose: "-z", kind: "nails" }, () => {
    const list: FitOpts[] = [];
    for (const c of [0, 1]) {
      const g = c ? 1 : -1;
      for (const y of spread(80, H - 110, 7)) list.push(nail(c ? right : left, g * sx, y), nail(middle, g * 4, y));
      for (const x of spread(column[c].cx - hw + 30, column[c].cx + hw - 30, 7)) list.push(nail(top, x, H - t / 2));
      for (const x of spread(column[c].cx - hw + 50, column[c].cx + hw - 50, 7).filter((_, i) => i !== 3)) list.push(nail(column[c].backRail, x, yBR));
    }
    b.fits(HW.nail, list, 0.03);
  });

  /* ---------- the wall ---------- */
  const wy = topY - 26;
  b.step({ title: "Stand it against the wall and mark the brackets", detail: "Together. Mark through the slot in each bracket, then move it away.", tools: ["pencil"], pose: "+y", people, kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {});
  b.step({ title: "Drill the holes and push in the plugs", detail: "Plugs suit solid walls; use fixings made for your wall if it's different.", tools: ["drill", "hammer"], kind: "anchor", wall: true, warnings: ["wall"] }, () =>
    b.fits(WALL_PLUG, bx.map((x) => ({ at: [x, wy, -D / 2 - 1], dir: [0, 0, -1] as Vec3 })), 0.2),
  );
  b.step({ title: "Screw it to the wall", detail: "Push it back, a washer on each screw, through the brackets. Then tighten the bracket screws under the top.", tools: ["screwdriver"], kind: "anchor", wall: true, warnings: ["tip"] }, () => {
    b.fits(HW.washer, bx.map((x) => ({ at: [x, wy, zb + 6], dir: [0, 0, -1] as Vec3 })), 0.15);
    b.then(0.05);
    b.fits(WALL_SCREW, bx.map((x) => ({ at: [x, wy, zb + 8], dir: [0, 0, -1] as Vec3 })), 0.2);
  });

  chestDrawers(b, { rows: n, cols, hw, xs, fh, sh, dd, zf, zd, zBack, runLen, slotB, ybox, rod: true });
  return true;
}

/* ---------- beds ---------- */

/*
 * The high bed frame (single and double manuals): glides and double cam bolts go into the end rails and dowels into
 * the side rails while they lie flat, the four rails are joined with cam locks, the headboard stands on big dowels
 * and hanger bolts with nuts, then the metal slat rails, the telescopic cross braces (and a centre beam on the wide
 * beds) go in and the slats are held down with clips. Storage boxes are built on their fronts and roll in last.
 */
const BIG_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 10 };
const HANGER: HwDef = { kind: "legScrew", len: 60, dia: 8 };
const LEDGE_SCREW: HwDef = { kind: "screw", len: 16, dia: 5 };
const BRACE_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const HOLDER_SCREW: HwDef = { kind: "screw", len: 10, dia: 6 };
const BOX_SCREW: HwDef = { kind: "screw", len: 30, dia: 4 };
const CASTOR_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const WEDGE: HwDef = { kind: "clip", len: 14, dia: 22 };
const HOLDER: HwDef = { kind: "clip", len: 30, dia: 40 };
const CASTOR: HwDef = { kind: "castor", len: 40, dia: 40 };

function bedBoxes(s: ProductSpec) {
  const m = /w (\d) storage boxes/i.exec(s.variant);
  return m ? Number(m[1]) : 0;
}

function buildBed(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10,
    L = s.size.d * 10,
    H = s.size.h * 10;
  const bed = s.bed ?? {};
  const mw = (bed.mattressW ?? s.size.w - 16) * 10,
    ml = (bed.mattressL ?? s.size.d - 9) * 10;
  const wide = mw >= 1200; // the double manual: a centre beam, two cross braces, more glides and dowels
  const boxes = bedBoxes(s);
  const T = 40; // the frame rails
  const RH = 380,
    SB = 190; // top of the frame, underside of the side rails (room for the boxes)
  const zh = -L / 2 + T,
    zfo = L / 2 - T; // inner faces of the head and foot rails
  const sx = W / 2 - T / 2,
    xin = W / 2 - T;
  const LY = 287.5; // centre of the slat rails
  const sg = (i: number) => (i === 0 ? -1 : 1);

  const endT = b.part("End rail", [W, RH, T]);
  const head = b.place(endT, [0, RH / 2, -L / 2 + T / 2]);
  const foot = b.place(endT, [0, RH / 2, L / 2 - T / 2]);
  const sideT = b.part("Side rail", [T, RH - SB, L - 2 * T]);
  const sides = [0, 1].map((i) =>
    b.place(sideT, [sg(i) * sx, (RH + SB) / 2, 0]),
  );
  const hbT = b.part("Headboard", [W, H - RH, 18]);
  const hb = b.place(hbT, [0, RH + (H - RH) / 2, -L / 2 + 9]);
  const ledgeT = b.part("Slat rail", [25, 25, L - 2 * T - 20], {
    material: "metal",
  });
  const ledges = [0, 1].map((i) =>
    b.place(ledgeT, [sg(i) * (xin - 12.5), LY, 0]),
  );
  let beam = "";
  if (wide) {
    const legZ = 300;
    const { type, mid } = b.compound(
      "Centre beam",
      [
        {
          shape: "box",
          size: [40, 25, L - 2 * T],
          pos: [0, LY, 0],
          material: "metal",
        },
        {
          shape: "cyl",
          size: [30, LY - 12.5, 30],
          pos: [0, (LY - 12.5) / 2, legZ],
          material: "metal",
        },
      ],
      { material: "metal" },
    );
    beam = b.place(type, mid);
  }
  // telescopic cross braces under the slats, corner to corner
  const bx = xin - 12.5,
    bz = L / 2 - T - 40;
  const braceLen = Math.hypot(2 * bx, 2 * bz);
  const braceT = b.part("Cross brace", [20, 2, braceLen], {
    material: "metal",
  });
  const angle = Math.atan2(2 * bx, 2 * bz);
  const braces = (wide ? [1, -1] : [1]).map((g, i) =>
    b.place(braceT, [0, LY - 14 - i * 3, 0], [0, g * angle, 0]),
  );
  const slatsIn = boxes > 0; // the bundles with storage boxes come with LURÖY slats; the frame alone doesn't
  const nSlats = Math.round((L - 2 * T) / 115);
  const slatW = W - 2 * T - 10,
    slatL = L - 2 * T - 30;
  const slatPieces: PartPiece[] = range(nSlats).map((i) => ({
    shape: "box",
    size: [slatW, 8, 70],
    pos: [0, 0, -slatL / 2 + 35 + (i * (slatL - 70)) / (nSlats - 1)],
    material: "wood",
  }));
  const { type: slatT, mid: slatMid } = b.compound("Slatted base", slatPieces, {
    material: "wood",
    extra: !slatsIn,
  });
  const slats = b.place(slatT, [
    slatMid[0],
    LY + 12.5 + 4 + slatMid[1],
    slatMid[2],
  ]);
  const withMattress = /mattress/i.test(s.variant);
  const mattress = withMattress
    ? b.place(b.part("Mattress", [mw, 200, ml], { material: "soft" }), [
        0,
        LY + 12.5 + 8 + 100,
        0,
      ])
    : "";

  const people = 2 as const;
  // glides under the end rails
  const gx = wide ? [-W / 2 + 60, 0, W / 2 - 60] : [-W / 2 + 60, W / 2 - 60];
  b.step(
    {
      title: "Tap the glides into the end rails",
      detail:
        "Lay the rails on something soft, inside faces up. The glides go in the bottom edges.",
      tools: ["hammer"],
      scene: "prep",
      kind: "general",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.18);
      b.stage(
        head,
        [0, T / 2, -L / 2 + RH / 2],
        [-Math.PI / 2, 0, 0],
        [0, 160, 0],
      );
      b.stage(
        foot,
        [0, T / 2, -L / 2 + RH * 1.5 + 80],
        [Math.PI / 2, 0, 0],
        [0, 160, 0],
      );
      b.stage(
        sides[0],
        [-(W / 2 + 200), T / 2, 0],
        [0, 0, Math.PI / 2],
        [0, 160, 0],
      );
      b.stage(
        sides[1],
        [W / 2 + 200, T / 2, 0],
        [0, 0, -Math.PI / 2],
        [0, 160, 0],
      );
      b.then(0.2);
      const list: FitOpts[] = [];
      for (const [k, z] of [
        [head, -L / 2 + T / 2],
        [foot, L / 2 - T / 2],
      ] as [string, number][])
        for (const x of gx)
          list.push({ on: k, at: [x, 0, z], dir: [0, 1, 0], hole: false });
      b.fits(HW.glide, list, 0.1);
    },
  );
  const boltY = [SB + 50, RH - 50];
  const endBolts: FitOpts[] = [];
  for (const [k, z, d] of [
    [head, zh, -1],
    [foot, zfo, 1],
  ] as [string, number, number][])
    for (const i of [0, 1])
      for (const y of boltY)
        endBolts.push({
          on: k,
          at: [sg(i) * sx, y, z],
          dir: [0, 0, d],
          mate: sides[i],
          mateHole: 4,
        });
  b.step(
    {
      title: "Screw the cam bolts into the end rails",
      detail:
        "Two at each end of both rails. Use the spanner and screw them in until the collar touches the board.",
      tools: ["wrench"],
      scene: "prep",
      kind: "cams",
    },
    () => b.fits(HW.camScrew, endBolts, 0.08),
  );
  const dowelY = [SB + 20, (SB + RH) / 2, RH - 20];
  b.step(
    {
      title: "Tap the dowels into the side rails",
      detail: "Three in each end. Use the shorter dowels here.",
      tools: ["hammer"],
      scene: "prep",
      kind: "dowels",
    },
    () => {
      const list: FitOpts[] = [];
      for (const i of [0, 1])
        for (const [z, d] of [
          [zh, 1],
          [zfo, -1],
        ] as [number, number][])
          for (const y of dowelY)
            list.push({
              on: sides[i],
              at: [sg(i) * sx, y, z],
              dir: [0, 0, d],
              mate: z < 0 ? head : foot,
            });
      b.fits(HW.dowel, list, 0.05);
    },
  );
  b.step(
    {
      title: "Join the side rails to the end rails",
      detail:
        "Stand the end rails up and push the side rails onto the bolts and dowels. Do this together.",
      people,
      kind: "join",
      warnings: ["two"],
    },
    () => {
      b.stagger(0.3);
      b.add(head, [0, 0, -300]);
      b.add(foot, [0, 0, 300]);
      b.then(0.15);
      for (const i of [0, 1]) b.add(sides[i], [sg(i) * 360, 0, 0]);
    },
  );
  b.step(
    {
      title: "Lock the cam locks",
      detail:
        "Two in each corner, on the inside of the side rails. Turn them with the Allen key until they're tight.",
      tools: ["allen"],
      kind: "cams",
    },
    () => {
      const list: FitOpts[] = [];
      for (const i of [0, 1])
        for (const z of [zh + 40, zfo - 40])
          for (const y of boltY)
            list.push({
              on: sides[i],
              at: [sg(i) * xin, y, z],
              dir: [sg(i), 0, 0],
            });
      b.fits(HW.cam, list, 0.08);
    },
  );
  const hx = spread(-W / 2 + 120, W / 2 - 120, wide ? 4 : 3);
  const dx = spread(-W / 2 + 70, W / 2 - 70, wide ? 5 : 3);
  b.step(
    {
      title: "Tap the big dowels into the head rail",
      detail: "Along its top edge. These are the thicker dowels.",
      tools: ["hammer"],
      kind: "dowels",
    },
    () =>
      b.fits(
        BIG_DOWEL,
        dx.map((x) => ({
          on: head,
          at: [x, RH, -L / 2 + 9],
          dir: [0, -1, 0],
          mate: hb,
        })),
        0.1,
      ),
  );
  b.step(
    {
      title: "Screw the hanger bolts into the headboard",
      detail:
        "Lay it on a table with the bottom edge sticking out. Screw them in with the spanner, machine thread out.",
      tools: ["wrench"],
      scene: "headboard",
      kind: "bolts",
    },
    () => {
      b.stage(hb, [0, 9, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
      b.then(0.15);
      b.fits(
        HANGER,
        hx.map((x) => ({
          on: hb,
          at: [x, RH, -L / 2 + 9],
          dir: [0, 1, 0],
          mate: head,
        })),
        0.12,
      );
    },
  );
  b.step(
    {
      title: "Stand the headboard on the head rail",
      detail:
        "Lower it onto the dowels together. From inside the rail, push a plastic wedge in under each bolt and tighten a nut with the spanner.",
      tools: ["wrench"],
      people,
      kind: "bolts",
      warnings: ["two"],
    },
    () => {
      b.add(hb, [0, 400, 0]);
      b.then(0.2);
      b.fits(
        WEDGE,
        hx.map((x) => ({
          on: head,
          at: [x, RH - 40, zh],
          dir: [0, 0, -1],
          hole: false,
        })),
        0.1,
      );
      b.then(0.1);
      b.fits(
        HW.nut,
        hx.map((x) => ({
          on: head,
          at: [x, RH - 40, zh - 6],
          dir: [0, 1, 0],
          hole: false,
        })),
        0.1,
      );
    },
  );
  b.step(
    {
      title: "Screw the slat rails to the side rails",
      detail:
        "There are two heights: the upper holes for a thinner mattress, the lower ones for a thicker one.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.stagger(0.3);
      for (const i of [0, 1]) b.add(ledges[i], [sg(i) * -200, 0, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      for (const i of [0, 1])
        for (const z of spread(-(L / 2 - T - 60), L / 2 - T - 60, 8))
          list.push({
            on: ledges[i],
            at: [sg(i) * (xin - 25), LY + 6, z],
            dir: [sg(i), 0, 0],
            mate: sides[i],
          });
      b.fits(LEDGE_SCREW, list, 0.05);
    },
  );
  if (wide)
    b.step(
      {
        title: "Screw the centre beam brackets to the end rails",
        detail:
          "One in the middle of each rail, on the inside, at the same height as the slat rails.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.fits(
          HW.angle,
          [
            { on: head, at: [0, LY - 12.5, zh], dir: [0, 0, -1], hole: false },
            { on: foot, at: [0, LY - 12.5, zfo], dir: [0, 0, 1], hole: false },
          ],
          0.2,
        );
        b.then(0.1);
        const sc: FitOpts[] = [];
        for (const [k, z, d] of [
          [head, zh, -1],
          [foot, zfo, 1],
        ] as [string, number, number][])
          for (const x of [-22, 22])
            sc.push({ on: k, at: [x, LY - 30, z], dir: [0, 0, d] });
        b.fits(LEDGE_SCREW, sc, 0.1);
      },
    );
  const braceEnds = (g: number) => [
    [g * bx, -bz],
    [-g * bx, bz],
  ];
  b.step(
    {
      title: wide
        ? "Screw the cross braces under the slat rails"
        : "Screw the cross brace under the slat rails",
      detail: "Pull each brace out to length first. It goes corner to corner.",
      tools: ["screwdriver"],
      kind: "screws",
      check: "square",
    },
    () => {
      b.stagger(0.3);
      for (const k of braces) b.add(k, [0, -160, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      (wide ? [1, -1] : [1]).forEach((g) => {
        for (const [x, z] of braceEnds(g))
          for (const dz of [-14, 14])
            list.push({
              on: ledges[x < 0 ? 0 : 1],
              at: [x, LY - 12.5, z + dz],
              dir: [0, 1, 0],
            });
      });
      if (!wide)
        list.push({
          on: braces[0],
          at: [0, LY - 13, 0],
          dir: [0, 1, 0],
          hole: false,
        });
      b.fits(BRACE_SCREW, list, 0.1);
    },
  );
  if (wide) {
    b.step(
      {
        title: "Lock the length of the braces",
        detail:
          "Measure both diagonals of the frame. When they match, put two screws in the middle of each brace.",
        tools: ["screwdriver", "tape"],
        kind: "square",
        check: "square",
        warnings: ["square"],
      },
      () =>
        b.fits(
          BRACE_SCREW,
          [-1, 1].flatMap((g) =>
            [-60, 60].map((d): FitOpts => ({
              on: braces[g < 0 ? 1 : 0],
              at: [
                g * d * Math.sin(angle),
                LY - 14 - (g < 0 ? 3 : 0) + 1,
                d * Math.cos(angle),
              ],
              dir: [0, 1, 0],
              hole: false,
            })),
          ),
          0.12,
        ),
    );
    b.step(
      {
        title: "Lay the centre beam on its brackets",
        detail: "Turn its foot until it just touches the floor.",
        kind: "join",
      },
      () => b.add(beam, [0, 260, 0]),
    );
  }
  // slat holders at both ends of each rail (and both sides of the centre beam)
  const holderX = wide
    ? [-(xin - 12.5), -30, 30, xin - 12.5]
    : [-(xin - 12.5), xin - 12.5];
  const holders: FitOpts[] = [];
  for (const z of [-(L / 2 - T - 30), L / 2 - T - 30])
    for (const x of holderX)
      holders.push({
        on: x < -40 ? ledges[0] : x > 40 ? ledges[1] : beam,
        at: [x, LY + 12.5, z],
        dir: [0, -1, 0],
        hole: false,
      });
  b.step(
    {
      title: "Clip the slat holders onto the rails",
      detail: "Screw each one down. They hold the ends of the slats in place.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.fits(HOLDER, holders, 0.1);
      b.then(0.1);
      b.fits(
        HOLDER_SCREW,
        holders.map((o) => ({
          ...o,
          at: [o.at[0], o.at[1] + 3, o.at[2]] as Vec3,
          hole: undefined,
        })),
        0.08,
      );
    },
  );
  b.step(
    {
      title: "Roll out the slats",
      detail: slatsIn
        ? "Start at the head end and tuck the end slats under the holders."
        : "The slats are sold separately. Start at the head end and tuck the end slats under the holders.",
      kind: "slats",
    },
    () => b.add(slats, [0, 200, -400]),
  );
  if (mattress)
    b.step(
      {
        title: "Lay the mattress on",
        detail: "Take the plastic off first and let it settle for a few hours.",
        people,
        kind: "general",
        warnings: ["two"],
      },
      () => b.add(mattress, [0, 300, 0]),
    );
  if (boxes) storageBoxes(b, { W, L, T, n: boxes });
  return true;
}

/** MALM storage boxes for the high bed: front face down, sides, back, bottom, then castors upside down. */
function storageBoxes(
  b: PlanBuilder,
  o: { W: number; L: number; T: number; n: number },
) {
  const { W, L, T, n } = o;
  const lb = (L - 2 * T - 60) / 2,
    BD = 560;
  const xo = W / 2; // the box fronts are flush with the side rails
  const frT = b.part("Box front", [18, 160, lb]);
  const sdT = b.part("Box side", [BD - 34, 130, 16]);
  const bkT = b.part("Box back", [16, 130, lb]);
  const btT = b.part("Box bottom", [BD - 30, 3, lb - 20], {
    material: "fiber",
  });
  interface Box {
    g: number;
    zc: number;
    front: string;
    sides: string[];
    back: string;
    bottom: string;
  }
  const slots: [number, number][] =
    n >= 4
      ? [
          [1, -1],
          [1, 1],
          [-1, -1],
          [-1, 1],
        ]
      : [
          [1, -1],
          [1, 1],
        ];
  const all: Box[] = slots.map(([g, k]) => {
    const zc = k * (lb / 2 + 15);
    return {
      g,
      zc,
      front: b.place(frT, [g * (xo - 9), 105, zc]),
      sides: [-1, 1].map((e) =>
        b.place(sdT, [
          g * (xo - 18 - (BD - 34) / 2),
          105,
          zc + e * (lb / 2 - 8),
        ]),
      ),
      back: b.place(bkT, [g * (xo - BD + 8), 105, zc]),
      bottom: b.place(btT, [g * (xo - 18 - (BD - 34) / 2), 47, zc]),
    };
  });
  const xF = (x: Box) => x.g * (xo - 18),
    xB = (x: Box) => x.g * (xo - BD + 16);
  const fitsOf = (x: Box) => {
    const ends = [-1, 1];
    const zIn = (e: number) => x.zc + e * (lb / 2 - 16);
    return {
      frontBolts: ends.flatMap((e, i) =>
        [70, 140].map((y): FitOpts => ({
          on: x.front,
          at: [xF(x), y, x.zc + e * (lb / 2 - 8)],
          dir: [x.g, 0, 0],
          mate: x.sides[i],
          mateHole: 4,
        })),
      ),
      dowels: ends.flatMap((e, i) => [
        {
          on: x.sides[i],
          at: [xF(x), 105, x.zc + e * (lb / 2 - 8)] as Vec3,
          dir: [-x.g, 0, 0] as Vec3,
          mate: x.front,
        },
        {
          on: x.sides[i],
          at: [xB(x), 105, x.zc + e * (lb / 2 - 8)] as Vec3,
          dir: [x.g, 0, 0] as Vec3,
          mate: x.back,
        },
      ]),
      frontCams: ends.flatMap((e, i) =>
        [70, 140].map((y): FitOpts => ({
          on: x.sides[i],
          at: [xF(x) - x.g * 30, y, zIn(e)],
          dir: [0, 0, e],
        })),
      ),
      backBolts: ends.flatMap((e, i) =>
        [70, 140].map((y): FitOpts => ({
          on: x.back,
          at: [xB(x), y, x.zc + e * (lb / 2 - 8)],
          dir: [-x.g, 0, 0],
          mate: x.sides[i],
          mateHole: 4,
        })),
      ),
      backCams: ends.flatMap((e, i) =>
        [70, 140].map((y): FitOpts => ({
          on: x.sides[i],
          at: [xB(x) + x.g * 30, y, zIn(e)],
          dir: [0, 0, e],
        })),
      ),
      screws: [
        ...spread(x.zc - lb / 2 + 60, x.zc + lb / 2 - 60, 4).map(
          (z): FitOpts => ({
            on: x.bottom,
            at: [xF(x) + x.g * 1, 45.5, z],
            dir: [0, 1, 0],
            mate: x.front,
          }),
        ),
        ...spread(x.zc - lb / 2 + 80, x.zc + lb / 2 - 80, 3).map(
          (z): FitOpts => ({
            on: x.bottom,
            at: [xB(x) - x.g * 1.5, 45.5, z],
            dir: [0, 1, 0],
            mate: x.back,
          }),
        ),
        ...ends.map((e, i): FitOpts => ({
          on: x.bottom,
          at: [x.g * (xo - BD / 2), 45.5, x.zc + e * (lb / 2 - 8)],
          dir: [0, 1, 0],
          mate: x.sides[i],
        })),
      ],
      castors: [xF(x) - x.g * 50, xB(x) + x.g * 50].flatMap((cx) =>
        ends.map((e): FitOpts => ({
          on: x.bottom,
          at: [cx, 44, x.zc + e * (lb / 2 - 60)],
          dir: [0, 1, 0],
          hole: false,
        })),
      ),
      castorScrews: [xF(x) - x.g * 50, xB(x) + x.g * 50].flatMap((cx) =>
        ends.flatMap((e) =>
          [-16, 16].map((dz): FitOpts => ({
            on: x.bottom,
            at: [cx, 44, x.zc + e * (lb / 2 - 60) + dz],
            dir: [0, 1, 0],
          })),
        ),
      ),
    };
  };
  const x0 = all[0];
  const c0: Vec3 = [x0.g * (xo - BD / 2), 105, x0.zc];
  const stage = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(
      k,
      [
        it.final.pos[0] - c0[0],
        it.final.pos[1] - c0[1],
        it.final.pos[2] - c0[2],
      ],
      it.final.rot,
      from,
    );
  };
  const f0 = fitsOf(x0);
  const rep = all.length;
  const step = (
    title: string,
    detail: string,
    kind: "cams" | "dowels" | "drawer" | "screws" | "legs",
    body: () => void,
    pose: "-x" | "+x" | "-y" = "-x",
    tools?: ("screwdriver" | "hammer" | "allen")[],
  ) =>
    b.step(
      { title, detail, scene: "box", pose, repeat: rep, kind, tools },
      body,
    );
  step(
    "Screw the cam bolts into a box front",
    "Lay the front face down on something soft.",
    "cams",
    () => {
      stage(x0.front, [-200, 0, 0]);
      b.then(0.15);
      b.fits(HW.camScrew, f0.frontBolts, 0.1);
    },
    "-x",
    ["screwdriver"],
  );
  step(
    "Tap the dowels into the box sides",
    "One in each end.",
    "dowels",
    () => {
      b.stagger(0.2);
      for (const k of x0.sides) stage(k, [300, 0, 0]);
      b.then(0.15);
      b.fits(HW.dowel, f0.dowels, 0.1);
    },
    "-x",
    ["hammer"],
  );
  step(
    "Lock the sides to the front",
    "Push the sides onto the bolts, then turn the cam locks clockwise.",
    "cams",
    () => b.fits(HW.cam, f0.frontCams, 0.1),
    "-x",
    ["screwdriver"],
  );
  step(
    "Put the back on",
    "Screw the cam bolts into the back first, then press it onto the dowels.",
    "cams",
    () => {
      b.fits(HW.camScrew, f0.backBolts, 0.08);
      b.then(0.15);
      stage(x0.back, [-260, 0, 0]);
    },
    "-x",
    ["screwdriver"],
  );
  step(
    "Lock the back with cam locks",
    "Arrow towards the bolt, then a clockwise turn.",
    "cams",
    () => b.fits(HW.cam, f0.backCams, 0.1),
    "-x",
    ["screwdriver"],
  );
  step(
    "Turn it over and slide in the bottom",
    "It runs in the grooves. Screw it to the front, the back and the sides.",
    "screws",
    () => {
      stage(x0.bottom, [0, 0, -500]);
      b.then(0.2);
      b.fits(BOX_SCREW, f0.screws, 0.06);
    },
    "-y",
    ["screwdriver"],
  );
  step(
    "Screw on the castors",
    "One near each corner, two screws each.",
    "legs",
    () => {
      b.fits(CASTOR, f0.castors, 0.15);
      b.then(0.1);
      b.fits(CASTOR_SCREW, f0.castorScrews, 0.04);
    },
    "-y",
    ["screwdriver"],
  );
  b.step(
    {
      title:
        all.length > 2
          ? `Roll all ${all.length} boxes under the bed`
          : "Roll the boxes under the bed",
      detail: "Lift the front a little to get the castors past the side rail.",
      kind: "drawer",
    },
    () => {
      for (const [i, x] of all.entries()) {
        b.stagger(0);
        for (const k of [x.front, ...x.sides, x.back, x.bottom])
          b.add(k, [x.g * 700, 0, 0]);
        if (i > 0) {
          const f = fitsOf(x);
          const list: [HwDef, FitOpts[]][] = [
            [HW.camScrew, [...f.frontBolts, ...f.backBolts]],
            [HW.dowel, f.dowels],
            [HW.cam, [...f.frontCams, ...f.backCams]],
            [BOX_SCREW, f.screws],
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

/* ---------- the ottoman bed ---------- */

/*
 * The ottoman bed (single and double manuals): the four box panels lie flat and take double cam bolts and dowels,
 * the floor rails are cam-locked under the side panels, then the box is stood up and joined with big cam locks. The
 * headboard stands on big dowels and hanger bolts with wedges and nuts, plastic corner feet with glides are screwed
 * into the corners, and the frame supports, threaded inserts and the two gas lift fittings go in. The steel lid frame
 * is bolted together on the floor (the double adds a centre and a cross tube), laid on the lift fittings by two people
 * and bolted, lifted to fit the gas spring bolts and the strap, then closed. The slats click into holders on the
 * frame, and the floor panels go into the box last.
 */
const CORNER_BOLT: HwDef = { kind: "camScrew", len: 50, dia: 8 };
const BIG_CAM: HwDef = { kind: "cam", len: 15, dia: 25 };
const FOOT_GLIDE: HwDef = { kind: "glide", len: 12, dia: 40 };
const GLIDE_SCREW: HwDef = { kind: "screw", len: 10, dia: 3.5 };
const BOX_SCREW_OT: HwDef = { kind: "screw", len: 16, dia: 5 };
const SUPPORT: HwDef = {
  kind: "angle",
  len: 60,
  dia: 40,
  name: "Frame support",
};
const FOOT_SUPPORT: HwDef = {
  kind: "angle",
  len: 80,
  dia: 50,
  name: "Centre support",
};
const INSERT: HwDef = {
  kind: "nut",
  len: 16,
  dia: 10,
  name: "Threaded insert",
};
const SLEEVE: HwDef = { kind: "spacer", len: 20, dia: 14, name: "Sleeve" };
const BUSH: HwDef = { kind: "spacer", len: 8, dia: 12, name: "Bush" };
const LIFT_BOLT: HwDef = { kind: "bolt", len: 80, dia: 8 };
const SPRING_BOLT: HwDef = { kind: "bolt", len: 35, dia: 8 };
const FRAME_BOLT: HwDef = { kind: "bolt", len: 50, dia: 6 };
const TUBE_BOLT: HwDef = {
  kind: "bolt",
  len: 30,
  dia: 6,
  name: "Shoulder bolt",
};
const BAR_BOLT: HwDef = { kind: "bolt", len: 12, dia: 6 };
const STRAP_BOLT: HwDef = { kind: "bolt", len: 25, dia: 6 };
const CATCH_BOLT: HwDef = { kind: "bolt", len: 15, dia: 6 };
const LIFT_STRAP: HwDef = {
  kind: "strap",
  len: 300,
  dia: 40,
  name: "Lift strap",
};
const CATCH: HwDef = { kind: "clip", len: 60, dia: 25, name: "Strap catch" };
const SLAT_HOLDER: HwDef = {
  kind: "clip",
  len: 20,
  dia: 50,
  name: "Slat holder",
};
const FLOOR_PAD: HwDef = { kind: "cap", len: 4, dia: 25, name: "Pad" };

function buildOttoman(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10,
    L = s.size.d * 10,
    H = s.size.h * 10;
  const mw = (s.bed?.mattressW ?? s.size.w - 16) * 10,
    ml = (s.bed?.mattressL ?? s.size.d - 9) * 10;
  const wide = mw >= 1200; // the double manual: a centre and a cross tube, two rows of slats, more fittings
  const TS = 40,
    TE = 40,
    BOT = 12,
    BH = 380; // panel thicknesses, the glides, the top of the box
  const xi = W / 2 - TS,
    zi = L / 2 - TE; // inner faces of the sides and the ends
  const sxc = W / 2 - TS / 2,
    ez = L / 2 - TE / 2;
  const sg = (i: number) => (i === 0 ? -1 : 1);
  const people = 2 as const;

  // the box
  const sideH = BH - 32;
  const sideT = b.part("Side panel", [TS, sideH, 2 * zi]);
  const sides = [0, 1].map((i) =>
    b.place(sideT, [sg(i) * sxc, 32 + sideH / 2, 0]),
  );
  const railT = b.part("Floor rail", [75, 20, 2 * zi]);
  const rails = [0, 1].map((i) =>
    b.place(railT, [sg(i) * (W / 2 - 37.5), 22, 0]),
  );
  const endT = b.part("End panel", [W, BH - BOT, TE]);
  const head = b.place(endT, [0, BOT + (BH - BOT) / 2, -ez]);
  const foot = b.place(endT, [0, BOT + (BH - BOT) / 2, ez]);
  const hb = b.place(b.part("Headboard", [W, H - BH, TE]), [
    0,
    BH + (H - BH) / 2,
    -ez,
  ]);
  const feetT = b.part("Corner foot", [60, 70, 60]);
  const fxs = xi - 65,
    fzs = zi - 30;
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
  const feet = corners.map(([gx, gz]) =>
    b.place(feetT, [gx * fxs, BOT + 35, gz * fzs]),
  );

  // the floor: three panels on the rail ledges, the end ones notched round the corner feet
  const fw = 2 * xi - 6,
    fl = (2 * zi - 12) / 3,
    fy = 35;
  const nW = 100,
    nD = 70;
  const { type: endFloorT } = b.compound(
    "Floor panel",
    [
      { shape: "box", size: [fw - 2 * nW, 6, fl], pos: [0, 0, 0] },
      {
        shape: "box",
        size: [nW, 6, fl - nD],
        pos: [-(fw - nW) / 2, 0, nD / 2],
      },
      { shape: "box", size: [nW, 6, fl - nD], pos: [(fw - nW) / 2, 0, nD / 2] },
    ],
    { material: "fiber" },
  );
  const midFloorT = b.part("Middle floor panel", [fw, 6, fl], {
    material: "fiber",
  });
  const fz = (i: number) => -zi + 3 + fl / 2 + i * (fl + 3);
  const floors = [
    b.place(endFloorT, [0, fy, fz(0)]),
    b.place(midFloorT, [0, fy, fz(1)]),
    b.place(endFloorT, [0, fy, fz(2)], [0, Math.PI, 0]),
  ];

  // the gas lift fittings: a channel on the side panel, the folded arms and the top arm under the frame
  const mz0 = -zi + 60,
    mLen = 520,
    mzc = mz0 + mLen / 2;
  const liftFitting = (name: string, g: number) => {
    const strut = (
      y0: number,
      z0: number,
      y1: number,
      z1: number,
      d: number,
      shape: "box" | "cyl",
    ): PartPiece => {
      const len = Math.hypot(y1 - y0, z1 - z0);
      const a = Math.atan2(-(y1 - y0), z1 - z0);
      return shape === "cyl"
        ? {
            shape,
            size: [d, len, d],
            pos: [0, (y0 + y1) / 2, (z0 + z1) / 2],
            rot: [a + Math.PI / 2, 0, 0],
            material: "metal",
          }
        : {
            shape,
            size: [d, d, len],
            pos: [0, (y0 + y1) / 2, (z0 + z1) / 2],
            rot: [a, 0, 0],
            material: "metal",
          };
    };
    const pieces: PartPiece[] = [
      {
        shape: "box",
        size: [30, 50, mLen],
        pos: [0, 110, mzc],
        material: "metal",
      },
      {
        shape: "box",
        size: [20, 14, mLen],
        pos: [-g * 6, 327, mzc],
        material: "metal",
      },
      strut(135, mz0 + mLen - 30, 320, mz0 + 40, 16, "box"),
      strut(120, mz0 + 40, 320, mz0 + mLen - 120, 22, "cyl"),
    ];
    const { type, mid } = b.compound(name, pieces, { material: "metal" });
    return b.place(type, [g * (xi - 15) + mid[0], mid[1], mid[2]]);
  };
  const lifts = [
    liftFitting("Left lift fitting", -1),
    liftFitting("Right lift fitting", 1),
  ];

  // the lid frame
  const fx = xi - 6,
    fzz = zi - 6,
    FY = 350;
  const sideTubeT = b.part("Frame side tube", [30, 30, 2 * fzz], {
    material: "metal",
  });
  const tubes = [0, 1].map((i) =>
    b.place(sideTubeT, [sg(i) * (fx - 15), FY, 0]),
  );
  const endTubeT = b.part("Frame end tube", [2 * fx - 60, 30, 30], {
    material: "metal",
  });
  const endTubes = [-1, 1].map((g) =>
    b.place(endTubeT, [0, FY, g * (fzz - 15)]),
  );
  const centre = wide
    ? b.place(
        b.part("Centre tube", [30, 30, 2 * fzz - 60], { material: "metal" }),
        [0, FY, 0],
      )
    : "";
  const cross = wide
    ? b.place(
        b.part("Cross tube", [2 * fx - 60, 20, 30], { material: "metal" }),
        [0, FY - 25, 0],
      )
    : "";
  const barLen = 2 * fx - 220;
  const { type: stopT, mid: stopMid } = b.compound(
    "Mattress stop",
    [
      {
        shape: "cyl",
        size: [10, barLen, 10],
        pos: [0, 60, 0],
        rot: [0, 0, Math.PI / 2],
        material: "metal",
      },
      {
        shape: "cyl",
        size: [10, 90, 10],
        pos: [-barLen / 2, 15, 0],
        material: "metal",
      },
      {
        shape: "cyl",
        size: [10, 90, 10],
        pos: [barLen / 2, 15, 0],
        material: "metal",
      },
    ],
    { material: "metal" },
  );
  const stop = b.place(stopT, [stopMid[0], FY + 15 + stopMid[1], fzz + 6]);
  const { type: hbarT, mid: hbarMid } = b.compound(
    "Head end bar",
    [
      {
        shape: "cyl",
        size: [8, barLen, 8],
        pos: [0, -60, 0],
        rot: [0, 0, Math.PI / 2],
        material: "metal",
      },
      {
        shape: "cyl",
        size: [8, 90, 8],
        pos: [-barLen / 2, -15, 0],
        material: "metal",
      },
      {
        shape: "cyl",
        size: [8, 90, 8],
        pos: [barLen / 2, -15, 0],
        material: "metal",
      },
    ],
    { material: "metal" },
  );
  const hbar = b.place(hbarT, [hbarMid[0], FY - 15 + hbarMid[1], -fzz - 4]);
  const frameParts = [
    ...tubes,
    ...endTubes,
    ...(wide ? [centre, cross] : []),
    stop,
    hbar,
  ];

  // the slats: one row on the single, two (each side of the centre tube) on the double
  const nSlats = ml >= 1990 ? 17 : 16;
  const rowsX: [number, number][] = wide
    ? [
        [-(fx - 15), 0],
        [0, fx - 15],
      ]
    : [[-(fx - 15), fx - 15]];
  const slatLen = rowsX[0][1] - rowsX[0][0] + 40;
  const slatT = b.part("Slat", [slatLen, 8, 53], { material: "wood" });
  const slatZ = spread(-(fzz - 60), fzz - 60, nSlats);
  const slats: { key: string; x0: number; x1: number; z: number }[] = [];
  for (const [x0, x1] of rowsX)
    for (const z of slatZ)
      slats.push({
        key: b.place(slatT, [(x0 + x1) / 2, FY + 15 + 8 + 4, z]),
        x0,
        x1,
        z,
      });
  const matW = Math.min(mw, 2 * fx - 20),
    matL = Math.min(ml, 2 * fzz - 30);
  const mattress = b.place(
    b.part("Your mattress", [matW, 180, matL], {
      material: "soft",
      extra: true,
    }),
    [0, FY + 15 + 16 + 90, 0],
  );

  // the lid lifted at the foot end, turning about the head end of the frame
  const lift = -0.6;
  const pivot: Vec3 = [0, FY + 15, -fzz];
  const raise = (keys: string[]) => {
    for (const k of keys) {
      const it = b.partItem(k);
      const p = it.final.pos;
      const r = rotate(
        [p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]],
        [lift, 0, 0],
      );
      b.stage(
        k,
        [pivot[0] + r[0], pivot[1] + r[1], pivot[2] + r[2]],
        [it.final.rot[0] + lift, it.final.rot[1], it.final.rot[2]],
      );
    }
  };

  // parts lying flat on the rug: inside faces up, each moved with the parts already joined to it
  const flat = new Map<string, { pos: Vec3; rot: Vec3 }>();
  const lay = (k: string, pos: Vec3, rot: Vec3) => flat.set(k, { pos, rot });
  lay(head, [0, TE / 2, -(zi + 420)], [-Math.PI / 2, 0, 0]);
  lay(foot, [0, TE / 2, zi + 420], [Math.PI / 2, 0, 0]);
  lay(sides[0], [-260, TS / 2, 0], [0, 0, Math.PI / 2]);
  lay(sides[1], [260, TS / 2, 0], [0, 0, -Math.PI / 2]);
  lay(rails[0], [-W / 2 - 120, 10, 0], [0, 0, 0]);
  lay(rails[1], [W / 2 + 120, 10, 0], [0, 0, 0]);
  const stageFlat = (k: string) => {
    const f = flat.get(k)!;
    b.stage(k, f.pos, f.rot, [0, 160, 0]);
  };
  const withSide = (rail: string, side: string) => {
    const f = flat.get(side)!;
    const r = b.partItem(rail).final.pos,
      sp = b.partItem(side).final.pos;
    const d = rotate([r[0] - sp[0], r[1] - sp[1], r[2] - sp[2]], f.rot);
    b.stage(rail, [f.pos[0] + d[0], f.pos[1] + d[1], f.pos[2] + d[2]], f.rot);
  };

  // the corner joints: a double cam bolt in the end panel, two dowels in the side, a big cam lock in the side
  const jy = [32 + sideH * 0.2, 32 + sideH * 0.5, 32 + sideH * 0.8];
  const endOf = (gz: number) => (gz < 0 ? head : foot);
  const cornerBolts = corners.map(([gx, gz]): FitOpts => ({
    on: endOf(gz),
    at: [gx * sxc, jy[1], gz * zi],
    dir: [0, 0, gz],
    mate: sides[gx < 0 ? 0 : 1],
    mateHole: 4,
  }));
  const cornerDowels: FitOpts[] = corners.flatMap(([gx, gz]) =>
    [jy[0], jy[2]].map((y): FitOpts => ({
      on: sides[gx < 0 ? 0 : 1],
      at: [gx * sxc, y, gz * zi],
      dir: [0, 0, -gz],
      mate: endOf(gz),
    })),
  );
  const railDowels: FitOpts[] = [0, 1].flatMap((i) =>
    [-1, 1].flatMap((gz) =>
      [-18, 18].map((dx): FitOpts => ({
        on: rails[i],
        at: [sg(i) * (W / 2 - 37.5) + dx, 22, gz * zi],
        dir: [0, 0, -gz],
        mate: endOf(gz),
      })),
    ),
  );
  const railZ = spread(-zi + 200, zi - 200, 4);
  const railBolts: FitOpts[] = [0, 1].flatMap((i) =>
    railZ.map((z): FitOpts => ({
      on: rails[i],
      at: [sg(i) * sxc, 32, z],
      dir: [0, -1, 0],
      mate: sides[i],
      mateHole: 4,
    })),
  );
  const railCams: FitOpts[] = [0, 1].flatMap((i) =>
    railZ.map((z): FitOpts => ({
      on: sides[i],
      at: [sg(i) * xi, 32 + 30, z],
      dir: [sg(i), 0, 0],
    })),
  );
  const bigCams = (gz: number): FitOpts[] =>
    [0, 1].map((i) => ({
      on: sides[i],
      at: [sg(i) * xi, jy[1], gz * (zi - 35)],
      dir: [sg(i), 0, 0],
    }));

  /* ---------- the box ---------- */

  b.step(
    {
      title: "Lay the box panels out on a rug",
      detail:
        "Inside faces up, on the flattened box or a rug so they don't get scratched.",
      scene: "prep",
      kind: "general",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.18);
      for (const k of [head, foot, ...sides, ...rails]) stageFlat(k);
    },
  );
  b.step(
    {
      title: "Screw the double cam bolts into the end panels",
      detail:
        "Two in each panel, near the ends. Use the spanner and stop when the collar meets the board.",
      tools: ["wrench"],
      scene: "prep",
      kind: "cams",
    },
    () => b.fits(CORNER_BOLT, cornerBolts, 0.12),
  );
  b.step(
    {
      title: "Tap the dowels into the side panels and rails",
      detail: "Two in each end. Use the short dowels here, not the thick ones.",
      tools: ["hammer"],
      scene: "prep",
      kind: "dowels",
    },
    () => b.fits(HW.dowel, [...cornerDowels, ...railDowels], 0.05),
  );
  b.step(
    {
      title: "Screw the cam bolts into the floor rails",
      detail: "Four along each rail.",
      tools: ["screwdriver"],
      scene: "prep",
      kind: "cams",
    },
    () => b.fits(HW.camScrew, railBolts, 0.08),
  );
  b.step(
    {
      title: "Push the rails onto the side panels",
      detail:
        "The cam bolts go into the holes in the bottom edge of each side panel.",
      scene: "prep",
      kind: "join",
    },
    () => {
      b.stagger(0.3);
      withSide(rails[0], sides[0]);
      withSide(rails[1], sides[1]);
    },
  );
  b.step(
    {
      title: "Lock the rails with cam locks",
      detail:
        "Drop each one in with the arrow towards the bolt and turn it clockwise.",
      tools: ["screwdriver"],
      scene: "prep",
      kind: "cams",
    },
    () => b.fits(HW.cam, railCams, 0.08),
  );
  b.step(
    {
      title: "Join the side panels to the head panel",
      detail:
        "Push a big cam lock into each side, stand the panels up and push the sides onto the bolts. Turn the cams with the Allen key.",
      tools: ["allen"],
      kind: "cams",
    },
    () => {
      b.add(head, [0, 0, -300]);
      b.then(0.15);
      b.stagger(0.25);
      for (const i of [0, 1]) {
        b.add(sides[i], [sg(i) * 300, 0, 0]);
        b.add(rails[i], [sg(i) * 300, 0, 0]);
      }
      b.then(0.15);
      b.fits(BIG_CAM, bigCams(-1), 0.15);
    },
  );
  b.step(
    {
      title: "Put the foot panel on and lock it",
      detail:
        "Big cam locks in the other ends of the sides, then push the foot panel on and turn them.",
      tools: ["allen"],
      kind: "cams",
    },
    () => {
      b.add(foot, [0, 0, 300]);
      b.then(0.15);
      b.fits(BIG_CAM, bigCams(1), 0.15);
    },
  );

  // the headboard
  const nh = wide ? 4 : 3;
  const hx = spread(-W / 2 + 160, W / 2 - 160, nh);
  const dx = spread(-W / 2 + 80, W / 2 - 80, wide ? 5 : 3);
  b.step(
    {
      title: "Tap the big dowels into the head panel",
      detail: "Along its top edge. These are the thick dowels.",
      tools: ["hammer"],
      kind: "dowels",
    },
    () =>
      b.fits(
        BIG_DOWEL,
        dx.map((x): FitOpts => ({
          on: head,
          at: [x, BH, -ez],
          dir: [0, -1, 0],
          mate: hb,
        })),
        0.1,
      ),
  );
  b.step(
    {
      title: "Screw the hanger bolts into the headboard",
      detail:
        "Lay it on a table with the bottom edge over the side. Screw them in with the spanner, machine thread out.",
      tools: ["wrench"],
      scene: "headboard",
      kind: "bolts",
    },
    () => {
      b.stage(hb, [0, TE / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]);
      b.then(0.15);
      b.fits(
        HANGER,
        hx.map((x): FitOpts => ({
          on: hb,
          at: [x, BH, -ez],
          dir: [0, 1, 0],
          mate: head,
        })),
        0.12,
      );
    },
  );
  b.step(
    {
      title: "Stand the headboard on the head panel",
      detail:
        "Lower it onto the dowels. From inside, push a wedge under each bolt and tighten a nut onto it with the spanner.",
      tools: ["wrench"],
      kind: "bolts",
    },
    () => {
      b.add(hb, [0, 400, 0]);
      b.then(0.2);
      b.fits(
        WEDGE,
        hx.map((x): FitOpts => ({
          on: head,
          at: [x, BH - 40, -zi],
          dir: [0, 0, -1],
          hole: false,
        })),
        0.1,
      );
      b.then(0.1);
      b.fits(
        HW.nut,
        hx.map((x): FitOpts => ({
          on: head,
          at: [x, BH - 40, -zi - 6],
          dir: [0, 1, 0],
          hole: false,
        })),
        0.1,
      );
    },
  );

  // the corner feet
  b.step(
    {
      title: "Screw a glide under each corner foot",
      detail: "One small screw through the middle of each glide.",
      tools: ["screwdriver"],
      scene: "feet",
      kind: "screws",
    },
    () => {
      b.stagger(0.15);
      feet.forEach((k, i) =>
        b.stage(k, [(i - 1.5) * 160, 35, 0], [0, 0, 0], [0, 140, 0]),
      );
      b.then(0.15);
      const list = feet.map((k, i): FitOpts => ({
        on: k,
        at: [corners[i][0] * fxs, BOT, corners[i][1] * fzs],
        dir: [0, 1, 0],
        hole: false,
      }));
      b.fits(FOOT_GLIDE, list, 0.1);
      b.then(0.1);
      b.fits(
        GLIDE_SCREW,
        list.map((o) => ({
          ...o,
          at: [o.at[0], o.at[1] - 4, o.at[2]] as Vec3,
          hole: undefined,
        })),
        0.1,
      );
    },
  );
  b.step(
    {
      title: "Screw the corner feet into the corners",
      detail:
        "Tip the box to slide each foot in under the corner, then screw it to the end panel and the rail.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.stagger(0.2);
      for (const k of feet) b.add(k, [0, 260, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      feet.forEach((k, i) => {
        const [gx, gz] = corners[i];
        for (const d of [-15, 15]) {
          list.push({
            on: k,
            at: [gx * fxs + d, BOT + 45, gz * (zi - 6)],
            dir: [0, 0, gz],
            mate: endOf(gz),
          });
          list.push({
            on: k,
            at: [gx * (xi - 41), 22, gz * fzs + d],
            dir: [gx, 0, 0],
            mate: rails[gx < 0 ? 0 : 1],
          });
        }
      });
      b.fits(BOX_SCREW_OT, list, 0.05);
    },
  );
  const supZ = wide ? [-0.1 * zi, 0.6 * zi] : [0.3 * zi];
  b.step(
    {
      title: wide
        ? "Screw the four frame supports to the sides"
        : "Screw the frame supports to the sides",
      detail: "Near the top edge, ledge inwards. The lid frame rests on them.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      const sup: FitOpts[] = [];
      for (const i of [0, 1])
        for (const z of supZ)
          sup.push({
            on: sides[i],
            at: [sg(i) * xi, FY - 25, z],
            dir: [sg(i), 0, 0],
            hole: false,
          });
      b.fits(SUPPORT, sup, 0.15);
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const o of sup)
        for (const [dy, dz] of [
          [-12, -14],
          [-12, 14],
          [-40, -14],
          [-40, 14],
        ])
          sc.push({
            on: o.on,
            at: [o.at[0] - o.dir[0] * 4, o.at[1] + dy, o.at[2] + dz],
            dir: o.dir,
          });
      b.fits(BOX_SCREW_OT, sc, 0.04);
    },
  );
  b.step(
    {
      title: "Screw the centre support inside the foot panel",
      detail: "In the middle, just under the top edge.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.fits(
        FOOT_SUPPORT,
        [{ on: foot, at: [0, FY - 25, zi], dir: [0, 0, 1], hole: false }],
        0.15,
      );
      b.then(0.1);
      b.fits(
        BOX_SCREW_OT,
        [
          [-30, -14],
          [30, -14],
          [-30, -45],
          [30, -45],
        ].map(([x, dy]): FitOpts => ({
          on: foot,
          at: [x, FY - 25 + dy, zi - 4],
          dir: [0, 0, 1],
        })),
        0.06,
      );
    },
  );

  // the lift fittings
  const insZ = mz0 + 60;
  b.step(
    {
      title: "Screw the threaded inserts into the sides",
      detail:
        "One in each side panel, in the hole near the head end. Never open a lift fitting by hand: the spring is strong.",
      tools: ["allen"],
      kind: "bolts",
      warnings: ["hand"],
    },
    () =>
      b.fits(
        INSERT,
        [0, 1].map((i): FitOpts => ({
          on: sides[i],
          at: [sg(i) * xi, 110, insZ],
          dir: [sg(i), 0, 0],
        })),
        0.2,
      ),
  );
  const liftBolts = (i: number) =>
    [insZ, mz0 + mLen - 60].map((z): FitOpts => ({
      on: lifts[i],
      at: [sg(i) * (xi - 30), 110, z],
      dir: [sg(i), 0, 0],
      mate: sides[i],
    }));
  for (const i of [0, 1])
    b.step(
      {
        title:
          i === 0
            ? "Bolt the left lift fitting to its side"
            : "Bolt the right lift fitting to its side",
        detail:
          i === 0
            ? "The fittings are marked L and R. Push a sleeve into each hole, then the long bolts through the fitting."
            : "The same way, with the fitting marked R.",
        tools: ["allen"],
        kind: "bolts",
      },
      () => {
        b.add(lifts[i], [sg(i) * -260, 160, 0]);
        b.then(0.15);
        b.fits(
          SLEEVE,
          liftBolts(i).map((o) => ({
            ...o,
            at: [sg(i) * xi, 110, o.at[2]] as Vec3,
            hole: false,
            mate: undefined,
          })),
          0.12,
        );
        b.then(0.1);
        b.fits(LIFT_BOLT, liftBolts(i), 0.12);
      },
    );
  b.step(
    {
      title: "Screw the lift fittings to the sides",
      detail: "Five screws along the bottom of each one.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      const list: FitOpts[] = [];
      for (const i of [0, 1])
        for (const z of spread(mz0 + 110, mz0 + mLen - 110, 5))
          list.push({
            on: lifts[i],
            at: [sg(i) * (xi - 30), 95, z],
            dir: [sg(i), 0, 0],
            mate: sides[i],
          });
      b.fits(BOX_SCREW_OT, list, 0.06);
    },
  );

  /* ---------- the lid frame ---------- */

  const FD = FY - 50; // the frame is put together on the floor
  const frameFlat = (k: string, from: Vec3 = [0, 140, 0]) => {
    const it = b.partItem(k);
    b.stage(
      k,
      [it.final.pos[0], it.final.pos[1] - FD, it.final.pos[2]],
      it.final.rot,
      from,
    );
  };
  b.step(
    {
      title: "Lay out the frame tubes",
      detail:
        "Turn each tube so the row of small holes is on top. They hold the slats.",
      scene: "frame",
      kind: "general",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.15);
      for (const k of [...tubes, ...endTubes, ...(wide ? [centre] : [])])
        frameFlat(k);
    },
  );
  const tubeJoints: FitOpts[] = [];
  for (const i of [0, 1])
    for (const g of [-1, 1])
      tubeJoints.push({
        on: tubes[i],
        at: [sg(i) * fx, FY, g * (fzz - 15)],
        dir: [-sg(i), 0, 0],
        mate: endTubes[g < 0 ? 0 : 1],
      });
  if (wide)
    for (const g of [-1, 1])
      for (const dx of [-8, 8])
        tubeJoints.push({
          on: endTubes[g < 0 ? 0 : 1],
          at: [dx, FY, g * fzz],
          dir: [0, 0, -g],
          mate: centre,
        });
  b.step(
    {
      title: "Bolt the frame together",
      detail:
        "Shoulder bolts through the side tubes into the ends of the end tubes. Tighten them with the Allen key.",
      tools: ["allen"],
      scene: "frame",
      kind: "bolts",
    },
    () => b.fits(TUBE_BOLT, tubeJoints, 0.1),
  );
  if (wide)
    b.step(
      {
        title: "Bolt the cross tube on and turn the frame over",
        detail:
          "One bolt at each end and two where it crosses the centre tube. Then turn the frame over so it's underneath.",
        tools: ["allen"],
        scene: "frame",
        kind: "bolts",
      },
      () => {
        frameFlat(cross, [0, 200, 0]);
        b.then(0.15);
        const list: FitOpts[] = [-1, 1].map((g): FitOpts => ({
          on: cross,
          at: [g * (fx - 15), FY - 35, 0],
          dir: [0, 1, 0],
          mate: tubes[g < 0 ? 0 : 1],
        }));
        for (const dz of [-8, 8])
          list.push({
            on: cross,
            at: [0, FY - 35, dz],
            dir: [0, 1, 0],
            mate: centre,
          });
        b.fits(TUBE_BOLT, list, 0.12);
      },
    );
  b.step(
    {
      title: "Screw the bars onto the ends of the frame",
      detail:
        "The mattress stop goes at the foot end, bent upwards, and the other bar at the head end. Two bolts each.",
      tools: ["allen"],
      scene: "frame",
      kind: "bolts",
    },
    () => {
      frameFlat(stop, [0, 0, 200]);
      frameFlat(hbar, [0, 0, -200]);
      b.then(0.15);
      const list: FitOpts[] = [];
      for (const x of [-barLen / 2, barLen / 2]) {
        list.push({
          on: stop,
          at: [x, FY, fzz + 6],
          dir: [0, 0, -1],
          mate: endTubes[1],
        });
        list.push({
          on: hbar,
          at: [x, FY, -fzz - 4],
          dir: [0, 0, 1],
          mate: endTubes[0],
        });
      }
      b.fits(BAR_BOLT, list, 0.1);
    },
  );
  b.step(
    {
      title: "Lay the frame on the lift fittings",
      detail:
        "Lift it in together and bolt it down onto the top arms, three bolts each side.",
      tools: ["allen"],
      people,
      kind: "bolts",
      warnings: ["two"],
    },
    () => {
      b.stagger(0);
      for (const k of frameParts) b.add(k, [0, 400, 0]);
      b.wait(1.1);
      b.stagger(0.12);
      const list: FitOpts[] = [];
      for (const i of [0, 1])
        for (const z of spread(mz0 + 80, mz0 + mLen - 80, 3))
          list.push({
            on: tubes[i],
            at: [sg(i) * (fx - 15), FY + 15, z],
            dir: [0, -1, 0],
            mate: lifts[i],
          });
      b.fits(FRAME_BOLT, list, 0.12);
    },
  );
  b.step(
    {
      title: "Lift the frame and push in the bushes",
      detail:
        "Hold the foot end up. One bush goes into the free hole at the end of each gas spring.",
      kind: "bolts",
      warnings: ["hand"],
    },
    () => {
      raise(frameParts);
      b.then(0.2);
      b.fits(
        BUSH,
        [0, 1].map((i): FitOpts => ({
          on: lifts[i],
          at: [sg(i) * (xi - 30), 320, mz0 + mLen - 120],
          dir: [sg(i), 0, 0],
          hole: false,
        })),
        0.2,
      );
    },
  );
  b.step(
    {
      title: "Bolt the gas springs to the arms",
      detail:
        "One short bolt through each spring and bush. Keep holding the frame until both are in.",
      tools: ["allen"],
      kind: "bolts",
    },
    () =>
      b.fits(
        SPRING_BOLT,
        [0, 1].map((i): FitOpts => ({
          on: lifts[i],
          at: [sg(i) * (xi - 40), 320, mz0 + mLen - 120],
          dir: [sg(i), 0, 0],
        })),
        0.2,
      ),
  );
  b.step(
    {
      title: "Tighten the bolts on the lift arms",
      detail:
        "Six in all, three on each fitting. The bushes should sit flush, not stick out.",
      tools: ["allen"],
      kind: "bolts",
    },
    () => {},
  );
  b.step(
    {
      title: "Fit the strap and its catch",
      detail:
        "Screw the strap under the foot end of the frame and the catch onto the centre support in the foot panel.",
      tools: ["allen"],
      kind: "screws",
    },
    () => {
      b.fits(
        LIFT_STRAP,
        [
          {
            on: endTubes[1],
            at: [0, FY - 15, fzz - 15],
            dir: [0, 1, 0],
            hole: false,
          },
        ],
        0.2,
      );
      b.then(0.05);
      b.fits(
        STRAP_BOLT,
        [-20, 20].map((x): FitOpts => ({
          on: endTubes[1],
          at: [x, FY - 15, fzz - 15],
          dir: [0, 1, 0],
        })),
        0.12,
      );
      b.then(0.1);
      b.fits(
        CATCH,
        [{ on: foot, at: [0, FY - 22, zi - 25], dir: [0, -1, 0], hole: false }],
        0.2,
      );
      b.then(0.05);
      b.fits(
        CATCH_BOLT,
        [-18, 18].map((x): FitOpts => ({
          on: foot,
          at: [x, FY - 20, zi - 25],
          dir: [0, -1, 0],
        })),
        0.12,
      );
    },
  );
  b.step(
    {
      title: "Pull the frame down together",
      detail:
        "One of you pulls the strap while the other guides the frame down until it clicks into the catch.",
      people,
      kind: "join",
      warnings: ["two", "hand"],
    },
    () => {
      b.stagger(0);
      for (const k of frameParts) b.add(k);
    },
  );
  if (wide)
    b.step(
      {
        title: "Tuck the strap in",
        detail:
          "Fold the loose end of the strap down between the frame and the foot panel.",
        kind: "general",
      },
      () => {},
    );

  /* ---------- slats, mattress and floor ---------- */

  const holderFits = (sl: (typeof slats)[number]) =>
    [sl.x0, sl.x1].map((x): FitOpts => ({
      on: sl.key,
      at: [x + (x === sl.x0 ? -5 : 5), FY + 19, sl.z],
      dir: [0, -1, 0],
      hole: false,
    }));
  const s0 = slats[0];
  b.step(
    {
      title: "Click a holder onto each end of the slats",
      detail: "Curved side up. Every slat takes two holders.",
      scene: "slats",
      repeat: slats.length,
      kind: "slats",
    },
    () => {
      b.stage(s0.key, [0, 4, 0], [0, 0, 0], [0, 140, 0]);
      b.then(0.15);
      b.fits(SLAT_HOLDER, holderFits(s0), 0.2);
    },
  );
  b.step(
    {
      title: "Click the slats into the frame",
      detail: wide
        ? "Two rows, one each side of the centre tube. Push each holder into its hole in the tubes."
        : "Push each holder into its hole in the side tubes, curved side up.",
      kind: "slats",
    },
    () => {
      for (const [i, sl] of slats.entries()) {
        b.stagger(0);
        b.add(sl.key, [0, 200, 0]);
        if (i > 0) for (const o of holderFits(sl)) b.preset(SLAT_HOLDER, o);
        b.wait(0.05);
      }
    },
  );
  const lidAll = [...frameParts, ...slats.map((x) => x.key)];
  b.step(
    {
      title: "Lay your mattress on",
      detail:
        "Your mattress is sold separately. It should fit between the mattress stop and the headboard.",
      people,
      kind: "general",
      warnings: ["two"],
    },
    () => b.add(mattress, [0, 300, 0]),
  );
  b.step(
    {
      title: "Open it with the strap",
      detail:
        "Pull the strap and the lid rises on its own. Don't lift the bed by the slats or let children play inside.",
      kind: "general",
      warnings: ["hand"],
    },
    () => raise([...lidAll, mattress]),
  );
  const padsPer = (wide ? 24 : 18) / 3;
  const padFits = (k: string): FitOpts[] => {
    const z = b.partItem(k).final.pos[2];
    const list: FitOpts[] = [];
    for (const g of [-1, 1])
      for (const dz of spread(-fl / 2 + 100, fl / 2 - 100, padsPer / 2))
        list.push({
          on: k,
          at: [g * (xi - 20), fy - 3, z + dz],
          dir: [0, 1, 0],
          hole: false,
        });
    return list;
  };
  b.step(
    {
      title: "Press the pads under the floor panels",
      detail: `${padsPer} under each panel, along the two ends that rest on the rails.`,
      scene: "floor",
      repeat: 3,
      kind: "general",
    },
    () => {
      b.stage(floors[0], [0, 3, 0], [Math.PI, 0, 0], [0, 140, 0]);
      b.then(0.15);
      b.fits(FLOOR_PAD, padFits(floors[0]), 0.08);
    },
  );
  b.step(
    {
      title: "Lay the floor panels in and close the lid",
      detail:
        "Pads down, notched corners round the feet. Then pull the strap down to close it.",
      kind: "general",
    },
    () => {
      b.stagger(0.25);
      for (const [i, k] of floors.entries()) {
        b.add(k, [0, 300, 0]);
        if (i > 0) for (const o of padFits(k)) b.preset(FLOOR_PAD, o);
      }
      b.then(0.3);
      b.stagger(0);
      for (const k of [...lidAll, mattress]) b.add(k);
    },
  );
  return true;
}

/* ---------- the dressing table ---------- */

/*
 * Built upside down on its top: hanger bolts in the top, runners on the legs while they lie flat, the legs stood
 * on big dowels and fixed with wedges and nuts, glides in their ends and the wall brackets under the top. Turned
 * over, the glass goes on with three clips at the back, then it's fixed to the wall and the drawer slides in.
 */
const GLASS_CLIP: HwDef = { kind: "angle", len: 20, dia: 16 };
const GLASS_SCREW: HwDef = { kind: "screw", len: 14, dia: 3.5 };
const STOP_SCREW: HwDef = { kind: "screw", len: 16, dia: 3.5 };

function buildDressing(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10,
    H = s.size.h * 10,
    D = s.size.d * 10;
  const LT = 50,
    TT = 40; // legs and top are thick boards
  const ty = H - TT; // underside of the top
  const lx = W / 2 - LT / 2,
    lin = W / 2 - LT;
  const sg = (i: number) => (i === 0 ? -1 : 1);
  const top = b.place(b.part("Top", [W, TT, D]), [0, H - TT / 2, 0]);
  const legT = b.part("Leg panel", [LT, ty, D]);
  const legs = [0, 1].map((i) => b.place(legT, [sg(i) * lx, ty / 2, 0]));
  const glass = b.place(b.part("Glass top", [W - 60, 4, D - 60]), [
    0,
    H + 2,
    0,
  ]);
  // the drawer hangs on runners under the top
  const FH = 110,
    fz = D / 2 - 9;
  const xs = lin - 19,
    dd = D - 18 - 40,
    sh = FH - 30;
  const yb = ty - 10 - FH + 12; // underside of the drawer box
  const front = b.place(b.part("Drawer front", [2 * lin - 4, FH, 18]), [
    0,
    ty - 6 - FH / 2,
    fz,
  ]);
  const dside = b.part("Drawer side", [12, sh, dd]);
  const dsides = [-1, 1].map((g) =>
    b.place(dside, [g * xs, yb + sh / 2, fz - 9 - dd / 2]),
  );
  const dback = b.place(b.part("Drawer back", [2 * xs + 12, sh, 12]), [
    0,
    yb + sh / 2,
    fz - 9 - dd - 6,
  ]);
  const dbottom = b.place(
    b.part("Drawer bottom", [2 * xs, 3, dd - 6], { material: "fiber" }),
    [0, yb + 8, fz - 9 - dd / 2],
  );
  const runY = yb + 20,
    runLen = Math.round((dd - 20) / 10) * 10;
  const RUN: HwDef = { kind: "runner", len: runLen, dia: 20 };
  const boltZ = [-D / 4, D / 4];

  b.step(
    {
      title: "Screw the hanger bolts into the top",
      detail:
        "Lay the top face down on something soft. Use the spanner and leave the machine thread sticking out.",
      tools: ["wrench"],
      pose: "-y",
      kind: "bolts",
      warnings: ["face"],
    },
    () => {
      b.add(top, [0, -260, 0]);
      b.then(0.2);
      const list: FitOpts[] = [];
      for (const i of [0, 1])
        for (const z of boltZ)
          list.push({
            on: top,
            at: [sg(i) * lx, ty, z],
            dir: [0, 1, 0],
            mate: legs[i],
          });
      b.fits(HANGER, list, 0.12);
    },
  );
  b.step(
    {
      title: "Screw the runners onto the legs",
      detail:
        "Lay the legs flat, inside faces up. The runners go near the top end, open end to the front.",
      tools: ["screwdriver"],
      scene: "prep",
      kind: "runners",
    },
    () => {
      b.stagger(0.2);
      b.stage(
        legs[0],
        [0, LT / 2, -(D / 2 + 50)],
        [0, 0, Math.PI / 2],
        [0, 160, 0],
      );
      b.stage(
        legs[1],
        [0, LT / 2, D / 2 + 50],
        [0, 0, -Math.PI / 2],
        [0, 160, 0],
      );
      b.then(0.15);
      b.fits(
        RUN,
        [0, 1].map((i): FitOpts => ({
          on: legs[i],
          at: [sg(i) * lin, runY, fz - 9 - runLen / 2 - 10],
          dir: [sg(i), 0, 0],
          hole: false,
        })),
        0.2,
      );
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const i of [0, 1])
        for (const dz of [-runLen / 3, runLen / 3])
          sc.push({
            on: legs[i],
            at: [sg(i) * (lin - 6), runY, fz - 9 - runLen / 2 - 10 + dz],
            dir: [sg(i), 0, 0],
          });
      b.fits(RUNNER_SCREW, sc, 0.1);
    },
  );
  b.step(
    {
      title: "Stand the legs on the top",
      detail:
        "Tap a big dowel into each end of the top, then push the legs down over the dowels and bolts.",
      tools: ["hammer"],
      pose: "-y",
      kind: "join",
    },
    () => {
      b.fits(
        BIG_DOWEL,
        [0, 1].map((i): FitOpts => ({
          on: top,
          at: [sg(i) * lx, ty, 0],
          dir: [0, 1, 0],
          mate: legs[i],
        })),
        0.2,
      );
      b.then(0.2);
      b.stagger(0.3);
      for (const k of legs) b.add(k, [0, -320, 0]);
    },
  );
  b.step(
    {
      title: "Tighten the legs with wedges and nuts",
      detail:
        "Push a wedge into each hole on the inside of the legs, then tighten a nut onto the bolt with the spanner.",
      tools: ["wrench"],
      pose: "-y",
      kind: "bolts",
    },
    () => {
      const w: FitOpts[] = [],
        nuts: FitOpts[] = [];
      for (const i of [0, 1])
        for (const z of boltZ) {
          w.push({
            on: legs[i],
            at: [sg(i) * lin, ty - 40, z],
            dir: [sg(i), 0, 0],
            hole: false,
          });
          nuts.push({
            on: legs[i],
            at: [sg(i) * lx, ty - 40, z],
            dir: [0, -1, 0],
            hole: false,
          });
        }
      b.fits(WEDGE, w, 0.12);
      b.then(0.1);
      b.fits(HW.nut, nuts, 0.12);
    },
  );
  b.step(
    {
      title: "Tap the glides into the legs",
      detail: "Two in the end of each leg.",
      tools: ["hammer"],
      pose: "-y",
      kind: "general",
    },
    () => {
      const list: FitOpts[] = [];
      for (const i of [0, 1])
        for (const z of [-D / 2 + 50, D / 2 - 50])
          list.push({
            on: legs[i],
            at: [sg(i) * lx, 0, z],
            dir: [0, 1, 0],
            hole: false,
          });
      b.fits(HW.glide, list, 0.12);
    },
  );
  const bx = [-(lin - 40), lin - 40];
  b.step(
    {
      title: "Screw the wall brackets under the top",
      detail: "At the back, next to each leg. A washer goes under each screw.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.fits(
        HW.bracket,
        bx.map((x): FitOpts => ({
          on: top,
          at: [x, ty, -D / 2 + 22],
          dir: [0, 1, 0],
          hole: false,
        })),
        0.2,
      );
      b.then(0.1);
      b.fits(
        HW.washer,
        bx.map((x): FitOpts => ({
          on: top,
          at: [x, ty - 3, -D / 2 + 44],
          dir: [0, 1, 0],
          hole: false,
        })),
        0.15,
      );
      b.fits(
        BRACKET_SCREW,
        bx.map((x): FitOpts => ({
          on: top,
          at: [x, ty - 3, -D / 2 + 44],
          dir: [0, 1, 0],
        })),
        0.15,
      );
    },
  );
  b.step(
    {
      title: "Turn it over and peel off the film",
      detail:
        "Turn it onto its legs, then pull the protective film off the top and the legs.",
      pose: "+y",
      kind: "standup",
    },
    () => {},
  );
  b.step(
    {
      title: "Lay the glass on the top",
      detail: "Lower it flat into the recess. Handle glass with care.",
      kind: "join",
      warnings: ["hand"],
    },
    () => b.add(glass, [0, 240, 0]),
  );
  const cx = [-W / 3, 0, W / 3];
  b.step(
    {
      title: "Fix the glass clips at the back",
      detail:
        "Three clips along the back edge stop the glass sliding. One screw in each.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.fits(
        GLASS_CLIP,
        cx.map((x): FitOpts => ({
          on: top,
          at: [x, H - 4, -D / 2],
          dir: [0, 0, 1],
          hole: false,
        })),
        0.15,
      );
      b.then(0.1);
      b.fits(
        GLASS_SCREW,
        cx.map((x): FitOpts => ({
          on: top,
          at: [x, H - 18, -D / 2],
          dir: [0, 0, 1],
        })),
        0.15,
      );
    },
  );
  const wy = ty - 26;
  b.step(
    {
      title: "Mark the wall through the brackets",
      detail: "Push it against the wall and mark through the slots.",
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
      detail:
        "Move it away first. Use fixings made for your wall if it isn't solid.",
      tools: ["drill", "hammer"],
      kind: "anchor",
      wall: true,
      warnings: ["wall"],
    },
    () =>
      b.fits(
        WALL_PLUG,
        bx.map((x) => ({
          at: [x, wy, -D / 2 - 1] as Vec3,
          dir: [0, 0, -1] as Vec3,
        })),
        0.2,
      ),
  );
  b.step(
    {
      title: "Screw it to the wall",
      detail:
        "A washer on each screw, through the bracket slot. Then tighten the bracket screws.",
      tools: ["screwdriver"],
      kind: "anchor",
      wall: true,
      warnings: ["tip"],
    },
    () => {
      b.fits(
        HW.washer,
        bx.map((x) => ({
          at: [x, wy, -D / 2 + 6] as Vec3,
          dir: [0, 0, -1] as Vec3,
        })),
        0.15,
      );
      b.fits(
        WALL_SCREW,
        bx.map((x) => ({
          at: [x, wy, -D / 2 + 8] as Vec3,
          dir: [0, 0, -1] as Vec3,
        })),
        0.2,
      );
    },
  );

  // the drawer, built on its back
  const c0: Vec3 = [0, yb + sh / 2, fz - 9 - dd / 2];
  const stage = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(
      k,
      [
        it.final.pos[0] - c0[0],
        it.final.pos[1] - c0[1],
        it.final.pos[2] - c0[2],
      ],
      it.final.rot,
      from,
    );
  };
  const zBk = fz - 9 - dd - 6;
  const dstep = (
    title: string,
    detail: string,
    kind: "cams" | "dowels" | "drawer" | "screws",
    body: () => void,
    tools?: ("screwdriver" | "hammer")[],
    pose: "+z" | "-y" = "+z",
  ) => b.step({ title, detail, scene: "drawer", pose, kind, tools }, body);
  dstep(
    "Screw the cam bolts into the drawer back",
    "Lay it flat, holes up.",
    "cams",
    () => {
      stage(dback, [0, 0, -160]);
      b.then(0.15);
      b.fits(
        HW.camScrew,
        [-1, 1].map((g): FitOpts => ({
          on: dback,
          at: [g * xs, yb + sh / 2, zBk + 6],
          dir: [0, 0, -1],
          mate: dsides[g < 0 ? 0 : 1],
          mateHole: 4,
        })),
        0.15,
      );
    },
    ["screwdriver"],
  );
  dstep(
    "Tap in the dowels and stand the sides on it",
    "The grooves face inwards, at the bottom.",
    "dowels",
    () => {
      b.fits(
        HW.dowel,
        [-1, 1].map((g): FitOpts => ({
          on: dback,
          at: [g * xs, yb + sh * 0.75, zBk + 6],
          dir: [0, 0, -1],
          mate: dsides[g < 0 ? 0 : 1],
        })),
        0.15,
      );
      b.then(0.15);
      b.stagger(0.25);
      for (const k of dsides) stage(k, [0, 0, 260]);
    },
    ["hammer"],
  );
  dstep(
    "Lock the sides with cam locks",
    "Arrow towards the bolt, then a clockwise turn.",
    "cams",
    () =>
      b.fits(
        HW.cam,
        [-1, 1].map((g): FitOpts => ({
          on: dsides[g < 0 ? 0 : 1],
          at: [g * (xs - 6), yb + sh / 2, zBk + 40],
          dir: [g, 0, 0],
        })),
        0.15,
      ),
    ["screwdriver"],
  );
  dstep(
    "Slide in the drawer bottom",
    "It runs down the grooves until it reaches the back.",
    "drawer",
    () => stage(dbottom, [0, 0, 420]),
  );
  dstep(
    "Screw on the drawer front",
    "Four long screws, two through the front end of each side into the front.",
    "screws",
    () => {
      stage(front, [0, 0, 260]);
      b.then(0.15);
      const list: FitOpts[] = [];
      for (const g of [-1, 1])
        for (const y of [yb + sh * 0.3, yb + sh * 0.75])
          list.push({
            on: dsides[g < 0 ? 0 : 1],
            // from the hole near the front end of the side, along it into the back of the front
            at: [g * xs, y, fz - 9 - 32],
            dir: [0, 0, 1],
            mate: front,
          });
      b.fits(BACK_SCREW, list, 0.12);
    },
    ["screwdriver"],
  );
  dstep(
    "Turn it over and push in the corner clips",
    "One in each corner under the drawer bottom.",
    "drawer",
    () => {
      const list: FitOpts[] = [];
      for (const g of [-1, 1])
        for (const z of [fz - 30, zBk + 30])
          list.push({
            on: dbottom,
            at: [g * (xs - 20), yb + 6.5, z],
            dir: [0, 1, 0],
            hole: false,
          });
      b.fits(HW.clip, list, 0.12);
    },
    undefined,
    "-y",
  );
  b.step(
    {
      title: "Slide the drawer in",
      detail:
        "Rest it on the runners and push it in. Fix the runner stops at the back with one screw each side.",
      tools: ["screwdriver"],
      kind: "drawer",
    },
    () => {
      b.stagger(0);
      for (const k of [front, ...dsides, dback, dbottom]) b.add(k, [0, 0, 520]);
      b.then(0.3);
      b.fits(
        STOP_SCREW,
        [0, 1].map((i): FitOpts => ({
          on: legs[i],
          at: [sg(i) * lin, runY, zBk + 20],
          dir: [sg(i), 0, 0],
        })),
        0.2,
      );
    },
  );
  return true;
}

const family: Family = {
  names: ["MALM"],
  build(b, s) {
    const n = chestCount(s);
    if (n) return buildChest(b, s, n);
    if (/chest of 6 drawers/i.test(s.variant) && s.size.w >= 150) return buildChest6(b, s);
    // the high bed frame (and the bed frames sold without "high" in their name, which are the same frame)
    if (s.archetype === "bed" && /^bed frame/i.test(s.variant))
      return buildBed(b, s);
    if (/^ottoman bed/i.test(s.variant)) return buildOttoman(b, s);
    if (/^dressing table/i.test(s.variant)) return buildDressing(b, s);
    return false;
  },
};

export default family;
