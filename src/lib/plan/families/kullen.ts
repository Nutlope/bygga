import type { Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "../builder";
import type { Family } from "./family";

/*
 * KULLEN chests, read from IKEA's manuals (2, 5 and 6 drawers).
 *
 * The carcass has no bottom: two sides (and the 6-drawer's divider) carry plastic runners, held apart by a plinth,
 * a rail over each drawer (its recessed top edge is the grip) and, on the hardboard-backed chests, a rail across the
 * back under the top. The runners go on first. The 2-drawer chest is built on a side lying flat, the 6-drawer on its
 * front round the divider, the 5-drawer on a side with a back of three boards in grooves. The top takes cam bolts,
 * goes on with dowels and cam locks, the hardboard back is nailed on with the chest on its front, and glides are
 * tapped into the feet. The 5 and 6 drawer chests have an interlock (one drawer opens at a time) and a wall fixing.
 * Each drawer is built on its front: dowels and cam bolts, the sides, cam locks, the bottom slid in, the back held
 * with ribbed pins. Pushed in, each drawer gets two stop screws so it can't be pulled right out.
 */

const t = 16; // boards
const P = 60; // plinth
const G = 30; // the rail over each drawer
const HB = 3; // hardboard back
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const LR = [-1, 1] as const;

const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const CONFIRMAT: HwDef = { kind: "screw", len: 50, dia: 7, name: "Connector screw" };
const ROD_SCREW: HwDef = { kind: "screw", len: 13, dia: 4.2 };
const BAR_SCREW: HwDef = { kind: "screw", len: 11, dia: 3.5 };
const STOP: HwDef = { kind: "screw", len: 8, dia: 10, name: "Drawer stop" };
const PIN: HwDef = { kind: "nail", len: 40, dia: 6, name: "Ribbed pin" };
const GLIDE: HwDef = { kind: "glide", len: 6, dia: 40, name: "Glide" };
const BAR: HwDef = { kind: "clip", len: 70, dia: 14, name: "Interlock bar" };
const CAM_TOP: HwDef = { ...HW.cam, dia: 15 };
const CAM_DRAWER: HwDef = { kind: "cam", len: 12, dia: 12 };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const WALL_SCREW: HwDef = { kind: "screw", len: 60, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 35, dia: 8 };

interface Cfg {
  W: number;
  H: number;
  D: number;
  cols: 1 | 2;
  levels: number[]; // drawer heights from the bottom, the grip rail included
  manual: 2 | 5 | 6;
}

function cfgOf(s: ProductSpec): Cfg | null {
  const slug = s.slug ?? "";
  // sizes from the manuals and IKEA's pages (the 5-drawer chest is 70 x 112)
  if (slug === "kullen-chest-2-drawers") return { W: 350, H: 490, D: 400, cols: 1, levels: [236, 178], manual: 2 };
  if (slug === "kullen-chest-5-drawers") return { W: 700, H: 1120, D: 400, cols: 1, levels: [228, 228, 228, 180, 180], manual: 5 };
  if (slug === "kullen-chest-6-drawers") return { W: 1400, H: 720, D: 400, cols: 2, levels: [232, 232, 180], manual: 6 };
  return null;
}

interface Drawer {
  i: number; // level
  c: number; // column centre
  small: boolean;
  y0: number; // bottom of the box sides
  sh: number;
  front: string;
  sides: string[];
  bottom: string;
  back: string;
  xo: number;
  zBk: number;
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  const c = cfgOf(s);
  if (!c) return false;
  const { W, H, D, cols, manual } = c;
  const boards = manual === 5; // a back of boards in grooves instead of nailed hardboard
  const zf = D / 2;
  const xs = W / 2 - t / 2, xi = W / 2 - t; // side centres and inner faces
  const Wb = cols === 1 ? W - 2 * t : (W - 3 * t) / 2;
  const bays = cols === 1 ? [0] : [-(t / 2 + Wb / 2), t / 2 + Wb / 2];
  const yT = H - t;
  const backFront = boards ? -D / 2 + 18 : -D / 2 + HB + t; // the back's (or back rail's) front face
  const rodZ = backFront + 6;
  const backLimit = backFront + 14; // where the drawers stop
  let pose: Pose = "+y";
  const st = (o: { title: string; detail?: string; tools?: ToolId[]; pose?: Pose; scene?: string; kind?: StepKind; people?: 1 | 2; warnings?: WarnId[]; repeat?: number; wall?: boolean }, body: () => void) => {
    const side = !!o.scene && o.scene !== "main";
    if (o.pose && !side) pose = o.pose;
    return b.step({ title: o.title, detail: o.detail, tools: o.tools ?? [], people: o.people ?? 1, pose: side ? (o.pose ?? "+y") : pose, warnings: o.warnings ?? [], kind: o.kind ?? "general", scene: o.scene, repeat: o.repeat, wall: o.wall }, body);
  };

  // ---------- parts ----------
  const types = new Map<string, string>();
  const part = (name: string, size: Vec3, o: { shape?: "box" | "cyl"; material?: "board" | "fiber" | "metal" } = {}) => {
    const k = [name, ...size.map(Math.round), o.shape ?? "", o.material ?? ""].join("|");
    if (!types.has(k)) types.set(k, b.part(name, size, o));
    return types.get(k)!;
  };
  const Ds = boards ? D : D - HB;
  const zs = boards ? 0 : HB / 2;
  const sideT = part("Side panel", [t, yT, Ds]);
  const sides = LR.map((g) => b.place(sideT, [g * xs, yT / 2, zs]));
  const top = b.place(part("Top panel", [W, t, D]), [0, H - t / 2, 0]);
  const zp = zf - 10 - t / 2;
  const plinth = b.place(part("Plinth", [W - 2 * t, P, t]), [0, P / 2, zp]);
  // level bottoms and tops
  const lv: { y0: number; y1: number }[] = [];
  let y = P;
  for (const h of c.levels) {
    lv.push({ y0: y, y1: y + h });
    y += h;
  }
  const zg = zf - 22 - t / 2; // grip rails stand back from the fronts
  const gripT = part("Front rail", [Wb, G, t]);
  const grips = bays.map((cx) => lv.map((l) => b.place(gripT, [cx, l.y1 - G / 2, zg])));
  const zbr = -D / 2 + HB + t / 2;
  const backRail = boards ? "" : b.place(part("Back rail", [W - 2 * t, 80, t]), [0, yT - 40, zbr]);
  let divider = "";
  if (cols === 2) {
    const zBackEdge = backFront, zFrontUp = zf - 2, zFrontLow = zp - t / 2;
    const cp = b.compound("Divider", [
      { shape: "box", size: [t, yT - P, zFrontUp - zBackEdge], pos: [0, P + (yT - P) / 2, (zFrontUp + zBackEdge) / 2] },
      { shape: "box", size: [t, P, zFrontLow - zBackEdge], pos: [0, P / 2, (zFrontLow + zBackEdge) / 2] },
    ]);
    divider = b.place(cp.type, cp.mid);
  }
  // the back
  const backParts: string[] = [];
  let strip = "";
  if (boards) {
    const sH = 80, bh = (yT - sH) / 3, zb = -D / 2 + 14;
    const boardT = part("Back board", [W - 2 * t + 16, bh, 8]);
    for (const k of range(3)) backParts.push(b.place(boardT, [0, bh * k + bh / 2, zb]));
    strip = b.place(part("Back strip", [W - 2 * t + 16, sH, 8]), [0, yT - sH / 2, zb]);
  } else {
    backParts.push(b.place(part("Back panel", [W - 2, yT - 2, HB], { material: "fiber" }), [0, yT / 2, -D / 2 + HB / 2]));
  }
  const rods = manual === 2 ? [] : bays.map((cx) => b.place(part("Interlock rod", [8, yT - P - 40, 8], { shape: "cyl", material: "metal" }), [cx - Wb / 2 + 8, P + (yT - P) / 2, rodZ]));

  // drawers
  const smallH = Math.min(...c.levels);
  const drawers: Drawer[] = [];
  for (const cx of bays) {
    for (const [i, l] of lv.entries()) {
      const fh = l.y1 - l.y0 - G - 4;
      const sh = fh - 50;
      const yb = l.y0 + 22;
      const xo = Wb / 2 - 14;
      const dd = zf - 16 - backLimit;
      const small = c.levels[i] === smallH && c.levels.some((h) => h !== smallH);
      const tag = small ? "Small" : c.levels.some((h) => h !== smallH) ? "Large" : "";
      const name = (n: string) => (tag ? `${n} (${tag.toLowerCase()})` : n);
      const zBk = zf - 16 - dd + 6;
      drawers.push({
        i,
        c: cx,
        small,
        y0: yb,
        sh,
        xo,
        zBk,
        front: b.place(part(name("Drawer front"), [Wb - 4, fh, 16]), [cx, l.y1 - G - 2 - fh / 2, zf - 8]),
        sides: LR.map((g) => b.place(part(name("Drawer side"), [12, sh, dd]), [cx + g * xo, yb + sh / 2, zf - 16 - dd / 2])),
        bottom: b.place(part(name("Drawer bottom"), [2 * xo, 3, dd - 4], { material: "fiber" }), [cx, yb + 12, zf - 16 - dd / 2 - 2]),
        back: b.place(part(name("Drawer back"), [2 * xo - 12, sh - 16, 12]), [cx, yb + 16 + (sh - 16) / 2, zBk]),
      });
    }
  }

  // ---------- fittings ----------
  const dz = (len: number) => [-len / 2 + 30, len / 2 - 30];
  const runLen = Math.round((zf - 16 - backLimit - 40) / 10) * 10;
  const RUNNER: HwDef = { kind: "runner", len: runLen, dia: 20 };
  const zRun = zf - 30 - runLen / 2;
  /** Runners on a panel face at x, facing the bay on side -g of the face (g points into the panel). */
  const runnersOn = (panel: string, x: number, g: number) => {
    b.fits(RUNNER, lv.map((l): FitOpts => ({ on: panel, at: [x, l.y0 + 22 + 30, zRun], dir: [g, 0, 0], hole: false })), 0.12);
    b.fits(RUNNER_SCREW, lv.flatMap((l) => dz(runLen).map((d): FitOpts => ({ on: panel, at: [x - g * 2, l.y0 + 52, zRun + d], dir: [g, 0, 0] }))), 0.03);
  };
  const sideScene = (title: string, detail: string) =>
    st({ title, detail, tools: ["screwdriver"], scene: "prep", kind: "runners", warnings: ["floor"], pose: "+y" }, () => {
      b.stagger(0.2);
      b.stage(sides[0], [0, t / 2, -(D / 2 + 60)], [0, 0, Math.PI / 2], [0, 160, 0]);
      b.stage(sides[1], [0, t / 2, D / 2 + 60], [0, 0, -Math.PI / 2], [0, 160, 0]);
      b.then(0.2);
      runnersOn(sides[0], -xi, -1);
      runnersOn(sides[1], xi, 1);
    });
  /** Rails laid out flat in their own scene. */
  const railScene = (title: string, detail: string, rails: string[], dowels: FitOpts[]) =>
    st({ title, detail, tools: ["hammer"], scene: "rails", kind: "dowels", pose: "+y" }, () => {
      b.stagger(0.12);
      rails.forEach((k, n) => {
        const it = b.partItem(k);
        const h = it.final.pos;
        b.stage(k, [h[0], t / 2, (n - (rails.length - 1) / 2) * 140], [Math.PI / 2, 0, 0], [0, 140, 0]);
      });
      b.then(0.15);
      b.fits(HW.dowel, dowels, 0.04);
    });
  /** Dowels in the ends of a rail at its middle height: n per end, into the sides (or the divider). */
  const railDowels = (rail: string, n: number, ends: { x: number; g: number }[], mate: (g: number) => string): FitOpts[] => {
    const it = b.partItem(rail);
    const [, ry, rz] = it.final.pos;
    const h = b.parts.find((p) => p.id === it.ref)!.size[1];
    const ys = n === 1 ? [ry] : n === 2 ? [ry - h / 4, ry + h / 4] : [ry - h / 3, ry, ry + h / 3];
    return ends.flatMap(({ x, g }) => ys.map((yy): FitOpts => ({ on: rail, at: [x, yy, rz], dir: [-g, 0, 0], mate: mate(g) })));
  };
  const toSides = (g: number) => sides[g < 0 ? 0 : 1];
  const sideEnds = LR.map((g) => ({ x: g * xi, g }));
  const confirmats = (rails: string[], which: number[] = [0, 1]) =>
    rails.flatMap((r) => which.map((i): FitOpts => {
      const p = b.partItem(r).final.pos;
      const g = LR[i];
      return { on: sides[i], at: [g * W / 2, p[1], p[2]], dir: [-g, 0, 0], mate: r };
    }));
  const allGrips = grips.flat();

  // the top: cam bolts underneath, dowels in the sides' (and divider's) top edges, cam locks
  const panelsUp = cols === 2 ? [{ k: sides[0], x: -xs, g: -1 }, { k: divider, x: 0, g: 1 }, { k: sides[1], x: xs, g: 1 }] : [{ k: sides[0], x: -xs, g: -1 }, { k: sides[1], x: xs, g: 1 }];
  const nTop = manual === 2 ? 1 : 2;
  const camZ = nTop === 1 ? [-D / 2 + 70] : [-D / 2 + 70, zf - 70];
  const dowelZ = nTop === 1 ? [zf - 60] : [-D / 6, D / 6];
  const topBolts = panelsUp.flatMap((p) => camZ.map((z): FitOpts => ({ on: top, at: [p.x, yT, z], dir: [0, 1, 0], mate: p.k, mateHole: 4 })));
  const topDowels = panelsUp.flatMap((p) => dowelZ.map((z): FitOpts => ({ on: p.k, at: [p.x, yT, z], dir: [0, -1, 0], mate: top })));
  const topCams = panelsUp.flatMap((p) => camZ.map((z): FitOpts => ({ on: p.k, at: [p.x - p.g * (t / 2), yT - 25, z], dir: [p.g, 0, 0] })));
  const wallX = [-(xi - 60), xi - 60];
  const topScene = (body: () => void, title = "Screw the cam bolts into the top", detail = "Lay the top upside down on something soft.") =>
    st({ title, detail, tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["face"], pose: "+y" }, () => {
      b.stage(top, [0, t / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
      b.then(0.15);
      body();
    });
  const topSteps = (pos: Pose, from: Vec3) => {
    topScene(() => b.fits(HW.camScrew, topBolts, 0.1));
    if (manual !== 2)
      topScene(
        () => {
          b.fits(HW.bracket, wallX.map((x): FitOpts => ({ on: top, at: [x, yT, -D / 2 + 30], dir: [0, 1, 0], hole: false })), 0.2);
          b.fits(HW.washer, wallX.map((x): FitOpts => ({ on: top, at: [x, yT - 3, -D / 2 + 30], dir: [0, 1, 0], hole: false })), 0.15);
          b.fits(BRACKET_SCREW, wallX.map((x): FitOpts => ({ on: top, at: [x, yT - 4, -D / 2 + 30], dir: [0, 1, 0] })), 0.15);
        },
        "Screw the wall brackets under the top",
        "One at each back corner, with a washer under the screw. Leave them a little loose.",
      );
    st({ title: manual === 2 ? "Tap a dowel into each side's top edge" : "Tap the dowels into the top edges", detail: cols === 2 ? "Two in each side and two in the divider." : manual === 2 ? "Near the front corner." : "Two in each side.", tools: ["hammer"], kind: "dowels", pose: pos }, () =>
      b.fits(HW.dowel, topDowels, 0.1),
    );
    st({ title: "Put the top on", detail: "Push it onto the dowels and cam bolts.", kind: "join", people: W > 1000 ? 2 : 1 }, () => b.add(top, from));
    st({ title: "Lock the top with cam locks", detail: "Arrow towards the bolt, then a clockwise turn.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM_TOP, topCams, 0.1));
  };

  const nailBack = () => {
    const back = backParts[0];
    const xN = W / 2 - t / 2, yN = yT - 40;
    const corners: Vec3[] = [
      [-xN, 20, -D / 2],
      [xN, yN, -D / 2],
      [-xN, yN, -D / 2],
      [xN, 20, -D / 2],
    ];
    const on = (p: Vec3): FitOpts => ({ on: back, at: p, dir: [0, 0, 1] });
    st({ title: "Lay the back panel on", detail: "Smooth side out, lined up with the sides along one edge.", kind: "join", pose: "-z" }, () => b.add(back, [0, 0, -300]));
    st({ title: "Nail one corner", detail: "Line the panel up with the corner marks first. Hold the nail with the nail holder.", tools: ["hammer"], kind: "nails" }, () => b.fits(HW.nail, [on(corners[0])], 0.2));
    st({ title: manual === 6 ? "Square it up and nail the other corners" : "Square it up and nail two more corners", detail: "Push the carcass until the panel lines up with every edge.", tools: ["hammer"], kind: "nails", warnings: ["square"] }, () =>
      b.fits(HW.nail, corners.slice(1, manual === 6 ? 4 : 3).map(on), 0.2),
    );
    // the rest round the edges (and down the divider)
    const pts: Vec3[] = [];
    const edge = (n: number, x0: number, x1: number, y0: number, y1: number) => range(n).forEach((k) => pts.push([x0 + ((x1 - x0) * (k + 1)) / (n + 1), y0 + ((y1 - y0) * (k + 1)) / (n + 1), -D / 2]));
    const rest = manual === 6 ? 50 : 25;
    const mid = manual === 6 ? 12 : 0;
    const left = rest - mid;
    const ySide = Math.round(left * 0.3), xEdge = Math.round((left - 2 * ySide) / 2);
    edge(ySide, -xN, -xN, 20, yN);
    edge(ySide, xN, xN, 20, yN);
    edge(xEdge, -xN, xN, yN, yN);
    edge(left - 2 * ySide - xEdge, -xN, xN, P / 2, P / 2);
    if (mid) edge(mid, 0, 0, 20, yN);
    st({ title: "Nail the rest of the back", detail: mid ? "Every 10 cm or so round the edges, and a row down the divider." : "Every 10 cm or so round the edges and along the plinth.", tools: ["hammer"], kind: "nails" }, () => b.fits(HW.nail, pts.map(on), 0.02));
  };
  const panelsAll = cols === 2 ? [{ k: sides[0], x: -xs }, { k: divider, x: 0 }, { k: sides[1], x: xs }] : [{ k: sides[0], x: -xs }, { k: sides[1], x: xs }];
  const glides = (pos: Pose) =>
    st({ title: "Tap the glides into the feet", detail: cols === 2 ? "Two under each side and two under the divider." : "Two under each side, front and back.", tools: ["hammer"], kind: "general", pose: pos }, () =>
      b.fits(GLIDE, panelsAll.flatMap((p) => [-D / 2 + 50, zf - 50].map((z): FitOpts => ({ on: p.k, at: [p.x, 0, z], dir: [0, 1, 0] }))), 0.1),
    );
  const rodSteps = () =>
    st({ title: cols === 2 ? "Fit the interlock rods" : "Fit the interlock rod", detail: "It runs up the back of the drawer space. Two screws through each end into the side.", tools: ["screwdriver"], kind: "screws" }, () => {
      for (const [k, cx] of bays.entries()) {
        b.add(rods[k], [0, 0, -260]);
        b.then(0.1);
        const x = cx - Wb / 2;
        const yr = b.partItem(rods[k]).final.pos[1], hr = yT - P - 40;
        b.fits(ROD_SCREW, [yr - hr / 2 + 10, yr - hr / 2 + 30, yr + hr / 2 - 30, yr + hr / 2 - 10].map((yy): FitOpts => ({ on: sides[k], at: [x + 2, yy, rodZ], dir: [-1, 0, 0] })), 0.08);
      }
    });
  const wallSteps = () => {
    const wy = yT - 50;
    st({ title: "Stand it up against the wall and mark through the brackets", detail: "Loosen the bracket screws, slide the brackets out against the wall and mark through the slots.", tools: ["screwdriver", "pencil"], pose: "+y", kind: "anchor", wall: true, warnings: ["wall", "tip"], people: 2 }, () => {});
    st({ title: "Drill the holes and push in the plugs", detail: "Move the chest away first. Use fixings made for your wall if it isn't solid.", tools: ["drill", "hammer"], kind: "anchor", wall: true, warnings: ["wall"] }, () =>
      b.fits(WALL_PLUG, wallX.map((x) => ({ at: [x, wy, -D / 2 - 1] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.2),
    );
    st({ title: "Screw it to the wall", detail: "A washer on each screw, through the bracket slot. Then tighten the bracket screws.", tools: ["screwdriver"], kind: "anchor", wall: true, warnings: ["tip"] }, () => {
      b.fits(HW.washer, wallX.map((x) => ({ at: [x, wy, -D / 2 + 6] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.15);
      b.fits(WALL_SCREW, wallX.map((x) => ({ at: [x, wy, -D / 2 + 8] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.2);
    });
  };

  // ---------- the carcass, as each manual does it ----------
  const gripsOf = (bay: number) => grips[bay];
  if (manual === 2) {
    sideScene("Screw the runners onto both sides", "Lay the sides on something soft, inside up. Two screws in each runner, its pegs in the holes.");
    const [low, high] = gripsOf(0);
    railScene("Tap the dowels into the rails", "Two in each end of the plinth and the top front rail, one in each end of the others.", [plinth, high, backRail, low], [
      ...railDowels(plinth, 2, sideEnds, toSides),
      ...railDowels(high, 2, sideEnds, toSides),
      ...railDowels(backRail, 1, sideEnds, toSides),
      ...railDowels(low, 1, sideEnds, toSides),
    ]);
    st({ title: "Lay a side down and stand two rails in it", detail: "The plinth and the back rail, raw edges hidden inside.", pose: "+x", kind: "join", warnings: ["floor"] }, () => {
      b.add(sides[0], [-200, 0, 0]);
      b.then(0.15);
      b.add(plinth, [300, 0, 0]);
      b.add(backRail, [300, 0, 0]);
    });
    st({ title: "Stand the front rails in it", detail: "The finished edge of each faces the front.", kind: "join" }, () => {
      b.add(low, [300, 0, 0]);
      b.add(high, [300, 0, 0]);
    });
    st({ title: "Put the other side on", detail: "Press it down onto all the dowels.", kind: "join" }, () => b.add(sides[1], [300, 0, 0]));
    st({ title: "Turn it onto its front and screw the sides on", detail: "One connector screw through each side into the plinth and one into the back rail, with the Allen key.", pose: "-z", tools: ["allen"], kind: "screws", warnings: ["floor"] }, () =>
      b.fits(CONFIRMAT, confirmats([plinth, backRail]), 0.12),
    );
    st({ title: "Screw the cam bolts into the top", detail: "Lay the top upside down on something soft. One at each back corner.", tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["face"] }, () => {
      b.stage(top, [0, t / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
      b.then(0.15);
      b.fits(HW.camScrew, topBolts, 0.1);
    });
    st({ title: "Tap a dowel into each side's top edge", detail: "Near the front corner.", tools: ["hammer"], kind: "dowels" }, () => b.fits(HW.dowel, topDowels, 0.1));
    st({ title: "Put the top on", detail: "Push it onto the dowels and cam bolts.", kind: "join" }, () => b.add(top, [0, 300, 0]));
    st({ title: "Lock the top with cam locks", detail: "Arrow towards the bolt, then a clockwise turn.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM_TOP, topCams, 0.1));
    nailBack();
    glides("-z");
  } else if (manual === 6) {
    const divX = (g: number) => g * (t / 2);
    const plinthStud: FitOpts = { on: divider, at: [0, P / 2, zp - t / 2], dir: [0, 0, 1], mate: plinth, mateHole: 4 };
    const railStud: FitOpts = { on: divider, at: [0, yT - 40, zbr + t / 2], dir: [0, 0, 1], mate: backRail, mateHole: 4 };
    st({ title: "Screw two cam bolts into the divider", detail: "Lay it flat. One at the bottom front corner, one at the top back corner.", tools: ["screwdriver"], scene: "divider", kind: "cams", warnings: ["floor"] }, () => {
      b.stage(divider, [0, t / 2, 0], [0, 0, Math.PI / 2], [0, 160, 0]);
      b.then(0.15);
      b.fits(HW.camScrew, [plinthStud, { ...railStud, dir: [0, 0, -1] }], 0.12);
    });
    st({ title: "Screw the runners onto the divider", detail: "Three runners, two screws in each, pegs in the holes.", tools: ["screwdriver"], scene: "divider", kind: "runners" }, () => runnersOn(divider, t / 2, -1));
    st({ title: "Turn it over and do the other face", detail: "Three more runners.", tools: ["screwdriver"], scene: "divider", kind: "runners" }, () => {
      b.stage(divider, [0, t / 2, 0], [0, 0, -Math.PI / 2], [0, 200, 0]);
      b.then(0.15);
      runnersOn(divider, -t / 2, 1);
    });
    st({ title: "Stand the divider on the plinth", detail: "Lay the plinth flat on the floor, front down, and push the divider's bolt into its hole.", pose: "-z", kind: "join", warnings: ["floor"] }, () => {
      b.add(plinth, [0, 0, 200]);
      b.then(0.15);
      b.add(divider, [0, 0, -300]);
    });
    st({ title: "Lock it with a cam lock", detail: "In the plinth's top edge, arrow towards the bolt, then turn.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM_TOP, [{ on: plinth, at: [0, P, zp], dir: [0, -1, 0] }], 0.1));
    railScene("Tap the dowels into the front rails", "Two in each end of all six.", allGrips, allGrips.flatMap((r) => {
      const cx = b.partItem(r).final.pos[0];
      const gs = Math.sign(cx);
      return railDowels(r, 2, [{ x: gs * xi, g: gs }, { x: divX(gs), g: -gs }], (g) => (g === gs ? toSides(gs) : divider));
    }));
    st({ title: "Push three rails onto the divider", detail: "On the left, finished edges towards the floor.", kind: "join" }, () => {
      b.stagger(0.18);
      for (const r of gripsOf(0)) b.add(r, [-300, 0, 0]);
    });
    st({ title: "Put the back rail on the divider", detail: "Across the top of the divider, over its cam bolt.", kind: "join" }, () => b.add(backRail, [0, 0, -300]));
    st({ title: "Lock it with a cam lock", detail: "In the rail's top edge.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM_TOP, [{ on: backRail, at: [0, yT, zbr], dir: [0, -1, 0] }], 0.1));
    st({ title: "Push on the other three rails and tap in the long rails' dowels", detail: "One dowel in each end of the plinth and the back rail.", tools: ["hammer"], kind: "dowels" }, () => {
      b.stagger(0.18);
      for (const r of gripsOf(1)) b.add(r, [300, 0, 0]);
      b.then(0.15);
      b.fits(HW.dowel, [...railDowels(plinth, 1, sideEnds, toSides), ...railDowels(backRail, 1, sideEnds, toSides)], 0.08);
    });
    sideScene("Screw the runners onto the sides", "Lay both sides inside up. Three runners on each, two screws in each runner.");
    st({ title: "Put the left side on", detail: "Push it onto the dowels of all the rails.", kind: "join" }, () => b.add(sides[0], [-300, 0, 0]));
    st({ title: "Screw it to the plinth and the back rail", detail: "Two connector screws, with the Allen key.", tools: ["allen"], kind: "screws" }, () => b.fits(CONFIRMAT, confirmats([plinth, backRail], [0]), 0.12));
    st({ title: "Put the right side on", detail: "The same way.", kind: "join" }, () => b.add(sides[1], [300, 0, 0]));
    st({ title: "Screw it on too", detail: "Two more connector screws.", tools: ["allen"], kind: "screws" }, () => b.fits(CONFIRMAT, confirmats([plinth, backRail], [1]), 0.12));
    rodSteps();
    topSteps("-z", [0, 300, 0]);
    nailBack();
    glides("-z");
    wallSteps();
  } else {
    // the 5-drawer chest
    const [g0, g1, g2, g3, g4] = gripsOf(0);
    sideScene("Screw the runners onto both sides", "Lay the sides on something soft, inside up. Five runners on each, two screws in each.");
    const camRails = [plinth, g4, g2, strip];
    const sideBolts = camRails.flatMap((r) => LR.map((g, i): FitOpts => {
      const p = b.partItem(r).final.pos;
      return { on: sides[i], at: [g * xi, p[1], p[2]], dir: [g, 0, 0], mate: r, mateHole: 4 };
    }));
    st({ title: "Screw the cam bolts into the sides", detail: "Four in each side, in the holes along the front and the back.", tools: ["screwdriver"], scene: "prep", kind: "cams" }, () => b.fits(HW.camScrew, sideBolts, 0.08));
    const rails = [plinth, g0, g1, g2, g3, g4];
    railScene("Tap the dowels into the rails", "Two in each end of the plinth and the two top rails, one in each end of the others.", rails, [
      ...railDowels(plinth, 2, sideEnds, toSides),
      ...railDowels(g4, 2, sideEnds, toSides),
      ...railDowels(g3, 2, sideEnds, toSides),
      ...[g0, g1, g2].flatMap((r) => railDowels(r, 1, sideEnds, toSides)),
    ]);
    st({ title: "Lay a side down and stand the top rail in it", detail: "On something soft. Finished edge to the front.", pose: "+x", kind: "join", warnings: ["floor"] }, () => {
      b.add(sides[0], [-200, 0, 0]);
      b.then(0.15);
      b.add(g4, [300, 0, 0]);
    });
    st({ title: "Stand the other rails in it", detail: "The plinth at the bottom, the rails between.", kind: "join" }, () => {
      b.stagger(0.15);
      for (const r of [g3, g2, g1, g0, plinth]) b.add(r, [300, 0, 0]);
    });
    const backDowels = [...backParts, strip].flatMap((k, n) => railDowels(k, n < 3 ? 2 : 1, LR.map((g) => ({ x: g * (xi + 4), g })), toSides));
    st({ title: "Tap the dowels into the back boards", detail: "Two in each end of the three boards, one in each end of the strip.", tools: ["hammer"], scene: "back", kind: "dowels" }, () => {
      b.stagger(0.12);
      [...backParts, strip].forEach((k, n) => b.stage(k, [0, 4, (n - 1.5) * 300], [Math.PI / 2, 0, 0], [0, 140, 0]));
      b.then(0.15);
      b.fits(HW.dowel, backDowels, 0.04);
    });
    st({ title: "Slide the back boards into the groove", detail: "Bottom board first, then the others and the strip at the top.", kind: "join" }, () => {
      b.stagger(0.2);
      for (const k of [...backParts, strip]) b.add(k, [300, 0, 0]);
    });
    st({ title: "Put the other side on", detail: "Together: one on each end, pressing it down onto every dowel and bolt.", people: 2, kind: "join" }, () => b.add(sides[1], [300, 0, 0]));
    const railCams = camRails.flatMap((r) => LR.map((g): FitOpts => {
      const p = b.partItem(r).final.pos;
      const back = r === strip ? 4 : t / 2;
      return { on: r, at: [g * (xi - 30), p[1], p[2] - back], dir: [0, 0, 1] };
    }));
    st({ title: "Lock the cam locks", detail: "Eight in all, on the inside of the rails. Arrow towards the bolt, then turn.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM_TOP, railCams, 0.06));
    st({ title: "Lay it on its back and screw in the bottom rail", detail: "One connector screw through each side into the lowest front rail.", pose: "+z", tools: ["allen"], kind: "screws", warnings: ["floor"] }, () => b.fits(CONFIRMAT, confirmats([g0]), 0.12));
    glides("+z");
    st({ title: "Stand it up", detail: "Lift it onto its feet.", pose: "+y", kind: "standup" }, () => {});
    rodSteps();
    topSteps("+y", [0, 300, 0]);
    wallSteps();
  }

  // ---------- drawers ----------
  const c0 = (d: Drawer): Vec3 => [d.c, d.y0 + d.sh / 2, zf - 16 - (zf - 16 - backLimit) / 2];
  const fitsOf = (d: Drawer) => {
    const nd = d.small ? 1 : 2;
    const per = (fn: (g: number, sd: string) => FitOpts[]) => LR.flatMap((g, i) => fn(g, d.sides[i]));
    const ys = nd === 1 ? [d.y0 + d.sh / 2] : [d.y0 + d.sh * 0.35, d.y0 + d.sh * 0.65];
    return {
      dowels: per((g, sd) => ys.map((yy): FitOpts => ({ on: sd, at: [d.c + g * d.xo, yy, zf - 16], dir: [0, 0, -1], mate: d.front }))),
      bolts: per((g, sd) => [{ on: d.front, at: [d.c + g * d.xo, d.y0 + (nd === 1 ? 25 : d.sh / 2), zf - 16], dir: [0, 0, 1], mate: sd, mateHole: 4 }]),
      cams: per((g) => [{ on: d.sides[g < 0 ? 0 : 1], at: [d.c + g * (d.xo - 6), d.y0 + (nd === 1 ? 25 : d.sh / 2), zf - 46], dir: [g, 0, 0] }]),
      pins: per((g, sd) => [0.25, 0.75].map((k): FitOpts => ({ on: sd, at: [d.c + g * (d.xo + 6), d.y0 + 16 + (d.sh - 16) * k, d.zBk], dir: [-g, 0, 0], mate: d.back, mateHole: 3 }))),
      bar: [{ on: d.sides[0], at: [d.c - d.xo, d.y0, d.zBk + 30], dir: [0, 1, 0], hole: false }] as FitOpts[],
      barScrews: [-6, 66].map((dz2): FitOpts => ({ on: d.sides[0], at: [d.c - d.xo, d.y0 + 1, d.zBk + dz2], dir: [0, 1, 0] })),
      stops: per((g, sd) => [{ on: sd, at: [d.c + g * d.xo, d.y0 + d.sh, d.zBk + 40], dir: [0, -1, 0] }]),
    };
  };
  const groups: Drawer[][] = [];
  for (const d of drawers) {
    const gIdx = groups.findIndex((g) => g[0].small === d.small);
    if (gIdx < 0) groups.push([d]);
    else groups[gIdx].push(d);
  }
  // the 2-drawer manual builds its two drawers side by side, the 5-drawer both kinds side by side, the 6-drawer
  // the small ones first and then the large ones
  groups.sort((a, b2) => (a[0].small === b2[0].small ? 0 : a[0].small ? -1 : 1));
  const batches: Drawer[][][] = manual === 6 ? groups.map((g) => [g]) : [groups];
  const firsts = new Set<Drawer>();
  for (const [bi, batch] of batches.entries()) {
    const scene = `drawers${bi}`;
    const shown = batch.map((g) => g[0]);
    shown.forEach((d) => firsts.add(d));
    const ox = (n: number) => (n - (shown.length - 1) / 2) * (Wb + 160);
    const stage = (d: Drawer, n: number, k: string, from?: Vec3, away = 0) => {
      const it = b.partItem(k);
      const m = c0(d);
      b.stage(k, [it.final.pos[0] - m[0] + ox(n), it.final.pos[1] - m[1], it.final.pos[2] - m[2] - away], it.final.rot, from);
    };
    const counts = batch.map((g) => g.length);
    const total = counts.reduce((a, n) => a + n, 0);
    const what =
      batch.length === 1
        ? total > 1
          ? `Build all ${total} ${batch[0][0].small ? "small" : "large"} drawers this way.`
          : ""
        : batch.map((g) => `${g.length} ${g[0].small ? "small" : "large"}`).join(" and ");
    const say = (s1: string) => (batch.length > 1 && total > 2 ? `${s1} Build ${what} drawers the same way.` : batch.length === 1 && what ? `${s1} ${what}` : s1);
    const rep = batch.length === 1 && total > 1 ? total : undefined;
    const dst = (title: string, detail: string, body: () => void, o: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
      st({ title, detail: say(detail), tools: o.tools, scene, pose: o.pose ?? "-z", repeat: rep, kind: o.kind ?? "drawer" }, body);
    const fx = shown.map(fitsOf);
    dst(
      "Tap the dowels into the drawer sides",
      shown.length > 1 ? "Into the front end of each side: one each for the small drawer, two for the large one." : shown[0].small ? "One in the front end of each side." : "Two in the front end of each side.",
      () => {
        b.stagger(0.15);
        shown.forEach((d, n) => d.sides.forEach((k) => stage(d, n, k, [0, 160, 0], 320)));
        b.then(0.15);
        for (const f of fx) b.fits(HW.dowel, f.dowels, 0.08);
      },
      { tools: ["hammer"], kind: "dowels", pose: "+y" },
    );
    dst(
      "Screw the cam bolts into the drawer front",
      "Lay the front face down on something soft. One near each end.",
      () => {
        shown.forEach((d, n) => stage(d, n, d.front, [0, 0, -160]));
        b.then(0.15);
        for (const f of fx) b.fits(HW.camScrew, f.bolts, 0.1);
      },
      { tools: ["screwdriver"], kind: "cams" },
    );
    dst("Stand the sides on the front", "Grooves facing out, onto the dowels and bolts.", () => {
      b.stagger(0.15);
      shown.forEach((d, n) => d.sides.forEach((k) => stage(d, n, k)));
    }, { kind: "join" });
    dst("Lock the sides with cam locks", "One in each side, arrow towards the bolt, then turn.", () => {
      for (const f of fx) b.fits(CAM_DRAWER, f.cams, 0.12);
    }, { tools: ["screwdriver"], kind: "cams" });
    dst("Slide in the drawer bottom", "Smooth side up, down the grooves until it reaches the front.", () => shown.forEach((d, n) => stage(d, n, d.bottom, [0, 0, -420])));
    dst("Put the drawer back on", "Its lower edge goes over the bottom.", () => shown.forEach((d, n) => stage(d, n, d.back, [0, 0, -260])), { kind: "join" });
    dst("Tap in the ribbed pins", "Two through each side into the back.", () => {
      for (const f of fx) b.fits(PIN, f.pins, 0.1);
    }, { tools: ["hammer"], kind: "nails" });
    if (manual !== 2)
      dst("Turn it over and fit the interlock bar", "Under the back of the drawer on the left: one screw, clip the bar on, turn it, then the screw in its bracket.", () => {
        for (const f of fx) {
          b.fits(BAR, f.bar, 0.2);
          b.then(0.1);
          b.fits(BAR_SCREW, f.barScrews, 0.15);
        }
      }, { tools: ["screwdriver"], kind: "screws", pose: "-y" });
  }
  const presetFits = (d: Drawer) => {
    const f = fitsOf(d);
    const list: [HwDef, FitOpts[]][] = [
      [HW.dowel, f.dowels],
      [HW.camScrew, f.bolts],
      [CAM_DRAWER, f.cams],
      [PIN, f.pins],
    ];
    if (manual !== 2) list.push([BAR, f.bar], [BAR_SCREW, f.barScrews]);
    for (const [def, l] of list) for (const op of l) b.preset(def, op);
  };
  const slide = (d: Drawer) => {
    b.stagger(0);
    for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, -40, 520]);
    if (!firsts.has(d)) presetFits(d);
    b.wait(0.25);
  };
  // the drawers go in from the bottom up
  const order = [...drawers].sort((a, b2) => a.i - b2.i || a.c - b2.c);
  if (manual === 2) {
    for (const d of order) {
      st({ title: d.i === 0 ? "Stand it up and push in the large drawer" : "Push in the small drawer", detail: "Tilt it, set the back onto the runners and push it in.", pose: "+y", kind: "drawer" }, () => slide(d));
      st({ title: "Screw in the drawer stops", detail: "Pull the drawer half out. One in the top edge of each side at the back, screwed right down.", tools: ["screwdriver"], kind: "screws" }, () => b.fits(STOP, fitsOf(d).stops, 0.15));
    }
  } else {
    st({ title: "Push in the drawers", detail: "Small ones at the top. Tilt each, set it onto its runners and push it in. Open one at a time.", pose: "+y", kind: "drawer", warnings: ["tip"] }, () => {
      for (const d of order) slide(d);
    });
    b.steps[b.steps.length - 1].quiet = true;
    st({ title: "Screw in the drawer stops", detail: "Pull each drawer half out: one in the top edge of each side at the back, screwed right down.", tools: ["screwdriver"], kind: "screws" }, () => {
      for (const d of order) b.fits(STOP, fitsOf(d).stops, 0.05);
    });
  }
  return true;
}

const family: Family = {
  names: ["KULLEN"],
  build,
};

export default family;
