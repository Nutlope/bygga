import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import type { CustomFix, CustomParams, CustomPart, CustomStep, Pose, ProductSpec, StepKind, ToolId, Vec3 } from "../../types";
import { buildCustom } from "../custom";

/*
 * HEMNES storage read from IKEA's manuals: the 120 mirror cabinet, the sideboard, the two shoe cabinets and the
 * 122 bathroom vanity with drawers. Each one is a recipe, with every fitting at the point the manual shows.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

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
    const k = `${f.kind}|${f.len}|${f.dia}|${f.name}|${(f.dir ?? [0, -1, 0]).join(",")}`;
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

type Fit = { kind: CustomFix["kind"]; len?: number; dia?: number; name?: string; included?: boolean };
/** Fittings at exact points: what, the part they go into, the way they go in, the points, the part their other end meets. */
const at = (f: Fit, on: string | undefined, dir: Vec3, pts: Vec3[], mate?: string): CustomFix => ({ ...f, count: pts.length, at: pts, dir, on, mate });

// fittings, sized so different ones stay apart in the list
const DOWEL: Fit = { kind: "dowel", len: 40, dia: 8 };
const LONG_DOWEL: Fit = { kind: "dowel", len: 70, dia: 8 };
const CAM_BOLT: Fit = { kind: "camScrew", len: 34, dia: 7 };
const CAM: Fit = { kind: "cam", len: 13, dia: 15 };
const ALLEN_SCREW: Fit = { kind: "screw", len: 50, dia: 6 };
const WALL_SCREW: Fit = { kind: "screw", len: 50, dia: 5 };
const WALL_PLUG: Fit = { kind: "plug", len: 40, dia: 8 };


/* ---------- drawers built on their fronts (sideboard, shoe cabinet) ---------- */

interface DrawerBox {
  x: number; // centre of the opening
  y0: number; // bottom of the opening
  w: number;
  h: number;
  zf: number; // front face of the front
  zBack: number; // how far back the box goes
  knobs: 1 | 2;
}
type Made = { box: DrawerBox; front: string; sides: [string, string]; bottom: string; back: string; xs: number; ys: number; sh: number; zF: number; zB: number };
const ft = 18, st = 15;

/** Places the drawer parts (shown later, in their own scene) and returns them. */
function makeDrawers(b: PlanBuilder, list: DrawerBox[]): Made[] {
  return list.map((box) => {
    const fw = box.w - 4, fh = box.h - 4;
    const xs = box.w / 2 - 14 - st / 2;
    const sh = Math.round(Math.min(fh - 30, 160));
    const ys = box.y0 + 14;
    const zF = box.zf - ft, zB = box.zBack;
    const front = b.place(b.part("Drawer front", [fw, fh, ft]), [box.x, box.y0 + 2 + fh / 2, box.zf - ft / 2]);
    const sdT = b.part("Drawer side", [st, sh, zF - zB]);
    const sides = [-1, 1].map((g) => b.place(sdT, [box.x + g * xs, ys + sh / 2, (zF + zB) / 2])) as [string, string];
    const back = b.place(b.part("Drawer back", [2 * xs - st, sh - 14, st]), [box.x, ys + 14 + (sh - 14) / 2, zB + st / 2 + 6]);
    const bottom = b.place(b.part("Drawer bottom", [2 * xs - st + 8, 4, zF - zB - 8]), [box.x, ys + 10, (zF + zB) / 2 - 2]);
    return { box, front, sides, back, bottom, xs, ys, sh, zF, zB };
  });
}

type DrawerFits = { bolts: FitOpts[]; dowels: FitOpts[]; cams: FitOpts[]; pins: FitOpts[]; knobs: FitOpts[]; knobScrews: FitOpts[]; runnerScrews: FitOpts[] };
function drawerFits(d: Made, o: { dowels: boolean }): DrawerFits {
  const { box, xs, ys, sh, zF, zB } = d;
  const two = [ys + sh * 0.3, ys + sh * 0.72];
  const per = (fn: (g: number, k: string) => FitOpts[]) => [...fn(-1, d.sides[0]), ...fn(1, d.sides[1])];
  const kx = box.knobs === 2 ? [box.x - box.w * 0.25, box.x + box.w * 0.25] : [box.x];
  const ky = box.y0 + box.h / 2;
  return {
    bolts: per((g, k) => two.map((y): FitOpts => ({ on: d.front, at: [box.x + g * xs, y, zF], dir: [0, 0, 1], mate: k, mateHole: 4 }))),
    dowels: o.dowels ? per((g, k) => [ys + sh * 0.12, ys + sh * 0.9].map((y): FitOpts => ({ on: k, at: [box.x + g * xs, y, zF], dir: [0, 0, -1], mate: d.front }))) : [],
    cams: per((g, k) => two.map((y): FitOpts => ({ on: k, at: [box.x + g * (xs - st / 2), y, zF - 28], dir: [g, 0, 0] }))),
    pins: per((g, k) => [ys + sh * 0.35, ys + sh * 0.75].map((y): FitOpts => ({ on: k, at: [box.x + g * (xs + st / 2), y, zB + st / 2 + 6], dir: [-g, 0, 0], mate: d.back }))),
    knobs: kx.map((x): FitOpts => ({ on: d.front, at: [x, ky, box.zf], dir: [0, 0, -1], hole: false })),
    knobScrews: kx.map((x): FitOpts => ({ on: d.front, at: [x, ky, zF - 2], dir: [0, 0, 1] })),
    runnerScrews: per((g, k) => [zB + 60, zF - 60].map((z): FitOpts => ({ on: k, at: [box.x + g * (xs + st / 2), ys + 20, z], dir: [-g, 0, 0] }))),
  };
}
const D_DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const D_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const D_CAM: HwDef = { kind: "cam", len: 13, dia: 15 };
const D_PIN: HwDef = { kind: "nail", len: 35, dia: 6, name: "Push-in fitting" };
const D_KNOB: HwDef = { kind: "knob", len: 25, dia: 30 };
const D_KNOB_SCREW: HwDef = { kind: "screw", len: 32, dia: 4 };
const D_RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };

type BStep = { title: string; detail?: string; tools?: ToolId[]; pose?: Pose; kind?: StepKind; repeat?: number; scene?: string };
const bstep = (b: PlanBuilder, o: BStep, body: () => void) => b.step({ kind: "general", warnings: [], ...o }, body);

/**
 * Drawers as the HEMNES sideboard and shoe cabinet manuals build them: the front face down on a rug takes cam bolts,
 * the sides stand on it (on dowels when there are any) and are locked, the bottom slides down the grooves, the back
 * is tapped on with push-in fittings, then the knob and the drawer half of the runners. The first one is shown and
 * the rest are the same.
 */
function frontDrawers(b: PlanBuilder, made: Made[], o: { dowels: boolean; runnerScrews: boolean }) {
  const n = made.length;
  const rep = n > 1 ? n : undefined;
  const d0 = made[0];
  const f0 = drawerFits(d0, o);
  const c0: Vec3 = [d0.box.x, d0.ys + d0.sh / 2, (d0.zF + d0.zB) / 2];
  const stage = (k: string, from?: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
  };
  const dstep = (title: string, detail: string, body: () => void, x: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
    bstep(b, { title, detail, tools: x.tools, scene: "drawer", pose: x.pose ?? "-z", repeat: rep, kind: x.kind ?? "drawer" }, body);
  dstep(n > 1 ? "Screw the cam bolts into a drawer front" : "Screw the cam bolts into the drawer front", "Lay it face down on a rug. By hand until they stop.", () => {
    stage(d0.front, [0, 0, 160]);
    b.then(0.15);
    b.fits(D_BOLT, f0.bolts, 0.08);
  }, { tools: ["screwdriver"], kind: "cams" });
  dstep("Stand the sides on the front", o.dowels ? "Tap the dowels into the front ends of the sides, then push them onto the dowels and bolts." : "Push them onto the bolts, grooves facing in.", () => {
    if (o.dowels) b.fits(D_DOWEL, f0.dowels, 0.08);
    b.then(0.15);
    for (const k of d0.sides) stage(k, [0, 0, -260]);
  }, { tools: o.dowels ? ["hammer"] : [], kind: "dowels" });
  dstep("Lock the cam locks", "Arrow towards the bolt, then turn each one clockwise until it pulls tight.", () => b.fits(D_CAM, f0.cams, 0.1), { tools: ["screwdriver"], kind: "cams" });
  dstep("Slide in the drawer bottom", "Down the grooves in the sides until it reaches the front.", () => stage(d0.bottom, [0, 0, -380]));
  dstep("Tap the back on", "Set it on the sides, then knock in the push-in fittings through the sides.", () => {
    stage(d0.back, [0, 0, -200]);
    b.then(0.15);
    b.fits(D_PIN, f0.pins, 0.1);
  }, { tools: ["hammer"], kind: "join" });
  dstep(d0.box.knobs === 2 ? "Screw on the knobs" : "Screw on the knob", "The screw goes in from inside the drawer.", () => {
    b.fits(D_KNOB, f0.knobs, 0.2);
    b.then(0.05);
    b.fits(D_KNOB_SCREW, f0.knobScrews, 0.15);
  }, { tools: ["screwdriver"], kind: "screws", pose: "+y" });
  dstep("Screw the runners to the drawer", "The drawer half of each runner goes on the bottom edge of the side, wheel at the back.", () => b.fits(D_RUNNER_SCREW, f0.runnerScrews, 0.08), { tools: ["screwdriver"], kind: "runners", pose: "+y" });
}

/** The last step: every drawer slides in on its runners, the ones not shown being built arriving with their fittings. */
function drawersIn(b: PlanBuilder, made: Made[], o: { dowels: boolean }, title: string, detail: string) {
  bstep(b, { title, detail, kind: "drawer" }, () => {
    for (const [i, d] of made.entries()) {
      b.stagger(0);
      for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 520]);
      if (i > 0) {
        const f = drawerFits(d, o);
        const all: [HwDef, FitOpts[]][] = [[D_BOLT, f.bolts], [D_DOWEL, f.dowels], [D_CAM, f.cams], [D_PIN, f.pins], [D_KNOB, f.knobs], [D_KNOB_SCREW, f.knobScrews], [D_RUNNER_SCREW, f.runnerScrews]];
        for (const [def, l] of all) for (const x of l) b.preset(def, x);
      }
      b.wait(0.22);
    }
  });
}

/* ---------- mirror cabinet 120 x 98 ---------- */

/*
 * Mirror cabinet with 2 doors 120 x 98: four uprights (two sides, two dividers) and three fixed shelves, built lying
 * on its back from the right side over to the left. Each shelf goes on with a dowel and a cam lock at the side, and a
 * long dowel and a double cam bolt through each divider into the next shelf. A narrow rail joins the tops of the sides
 * at the front, the bottom goes on with dowels and eight long screws, then it is turned over: the three back panels
 * slide down their grooves and the top goes on with dowels and eleven screws. Clips hold the backs to the shelves, the
 * hanging brackets go in, it hangs on four wall plates over four spacers, and the doors click onto their hinges.
 */
function mirror120(): CustomParams {
  const r = new Recipe();
  const W0 = 1170, bodyH = 950, crownH = 30, t = 18;
  const zb = -80, zf = 50; // the carcass; doors in front of it, the top over both
  const xs = W0 / 2 - t / 2, xi = W0 / 2 - t; // side centres, inner faces
  const xd = 139, xdo = xd + t / 2, xdi = xd - t / 2; // divider centre, its outer and inner faces
  const railH = 50, railT = 18;
  const zdf = zf - railT; // dividers and shelves stop behind the top rail
  const upH = bodyH - t, upY = t + upH / 2;
  const fixY = t + 180 + t / 2; // the fixed shelves, over the open niche at the bottom
  const dc = (zb + zdf) / 2;
  r.part("sL", "Side", [t, upH, zf - zb], [-xs, upY, (zb + zf) / 2]);
  r.part("sR", "Side", [t, upH, zf - zb], [xs, upY, (zb + zf) / 2]);
  r.part("dvL", "Divider", [t, upH, zdf - zb], [-xd, upY, dc]);
  r.part("dvR", "Divider", [t, upH, zdf - zb], [xd, upY, dc]);
  const doorW = xi - xdo, midW = 2 * xdi;
  r.part("shL", "Shelf", [doorW, t, zdf - zb], [-(xi + xdo) / 2, fixY, dc]);
  r.part("shM", "Middle shelf", [midW, t, zdf - zb], [0, fixY, dc]);
  r.part("shR", "Shelf", [doorW, t, zdf - zb], [(xi + xdo) / 2, fixY, dc]);
  r.part("rail", "Top rail", [2 * xi, railH, railT], [0, bodyH - railH / 2, zf - railT / 2]);
  r.part("bot", "Bottom", [W0, t, zf - zb], [0, t / 2, (zb + zf) / 2]);
  const backY0 = fixY + t / 2, backH = bodyH - backY0;
  r.part("bkL", "Back panel", [doorW, backH, 4], [-(xi + xdo) / 2, backY0 + backH / 2, zb + 10], { material: "fiber" });
  r.part("bkM", "Middle back panel", [midW, backH, 4], [0, backY0 + backH / 2, zb + 10], { material: "fiber" });
  r.part("bkR", "Back panel", [doorW, backH, 4], [(xi + xdo) / 2, backY0 + backH / 2, zb + 10], { material: "fiber" });
  r.part("top", "Top", [1200, crownH, 160], [0, bodyH + crownH / 2, 0]);
  // mirror doors: a frame with the mirror set in it, from the outside edge over to the middle of the divider
  const dW = W0 / 2 - xd - 4, dH = bodyH - 4 - (fixY - t / 2), dY = fixY - t / 2 + dH / 2, dX = xd + 2 + dW / 2;
  const door = (id: string, g: number) =>
    r.part(id, "Mirror door", [dW, dH, 20], [g * dX, dY, zf + 10], {
      pieces: [
        { shape: "box", size: [dW, dH, 18], pos: [0, 0, -1], material: "board" },
        { shape: "box", size: [dW - 110, dH - 110, 4], pos: [0, 0, 8], material: "glass" },
      ],
    });
  door("dL", -1);
  door("dR", 1);
  const gY = [420, 600, 780], mY = [450, 700];
  gY.forEach((y, i) => r.part(`gL${i}`, "Glass shelf", [doorW - 4, 6, 100], [-(xi + xdo) / 2, y, dc + 5], { material: "glass" }));
  gY.forEach((y, i) => r.part(`gR${i}`, "Glass shelf", [doorW - 4, 6, 100], [(xi + xdo) / 2, y, dc + 5], { material: "glass" }));
  mY.forEach((y, i) => r.part(`m${i}`, "Shelf", [midW - 4, 16, 100], [0, y, dc + 5]));

  const PLATE: Fit = { kind: "hinge", len: 50, dia: 20, name: "Hinge plate" };
  const HINGE: Fit = { kind: "hinge", len: 100, dia: 35 };
  const ROD: Fit = { kind: "connector", len: 70, dia: 8, name: "Double cam bolt" };
  const hingeY = [fixY + 100, bodyH - 110];
  const zc = -40, zd = 0; // the cam bolts and the dowels along each shelf end
  const railZ = zf - railT / 2, railY = bodyH - railH / 2;

  r.step({ title: "Screw the hinge plates onto the sides", detail: "Lay the four uprights on a rug. Two plates on each side, at the front edge.", add: ["sR"], wait: ["sL"], fix: [at(PLATE, "sL", [-1, 0, 0], hingeY.map((y): Vec3 => [-xi, y, zf - 30])), at(PLATE, "sR", [1, 0, 0], hingeY.map((y): Vec3 => [xi, y, zf - 30]))], tools: ["screwdriver"], pose: "+z", warnings: ["floor"] });
  r.step({ title: "Screw the cam bolts into the sides", detail: "One at the shelf and one at the top of each side, by hand until they stop.", fix: [at(CAM_BOLT, "sL", [-1, 0, 0], [[-xi, fixY, zc], [-xi, railY + 12, railZ]]), at(CAM_BOLT, "sR", [1, 0, 0], [[xi, fixY, zc], [xi, railY + 12, railZ]])], tools: ["screwdriver"], pose: "+z" });
  r.step({ title: "Fit a shelf to the right side", detail: "Stand the right side on its edge. Tap a dowel into the shelf end, push it on and lock the cam.", add: ["shR"], fix: [at(DOWEL, "shR", [-1, 0, 0], [[xi, fixY, zd]], "sR"), at(CAM, "shR", [0, -1, 0], [[xi - 26, fixY + t / 2, zc]])], tools: ["hammer", "screwdriver"], from: { shR: [-300, 0, 0] } });
  r.step({ title: "Fit a long dowel and a double cam bolt", detail: "Both go into the free end of the shelf; the cam lock holds the bolt. They reach through the divider into the next shelf.", fix: [at(LONG_DOWEL, "shR", [1, 0, 0], [[xdo, fixY, zd]], "shM"), at(ROD, "shR", [-1, 0, 0], [[xd, fixY, zc]]), at(CAM, "shR", [0, -1, 0], [[xdo + 26, fixY + t / 2, zc]])], tools: ["hammer", "screwdriver"] });
  r.step({ title: "Slide a divider on", detail: "Over the long dowel and the bolt, grooved side to the back.", add: ["dvR"], from: { dvR: [-250, 0, 0] } });
  r.step({ title: "Push the middle shelf on", detail: "The short shelf. Lock the cam onto the bolt.", add: ["shM"], fix: [at(CAM, "shM", [0, -1, 0], [[xdi - 26, fixY + t / 2, zc]])], tools: ["screwdriver"], from: { shM: [-250, 0, 0] } });
  r.step({ title: "Fit the second long dowel and double cam bolt", detail: "Into the free end of the middle shelf, the cam lock holds the bolt.", fix: [at(LONG_DOWEL, "shM", [1, 0, 0], [[-xdi, fixY, zd]], "shL"), at(ROD, "shM", [-1, 0, 0], [[-xd, fixY, zc]]), at(CAM, "shM", [0, -1, 0], [[-xdi + 26, fixY + t / 2, zc]])], tools: ["hammer", "screwdriver"] });
  r.step({ title: "Slide the other divider on", add: ["dvL"], from: { dvL: [-250, 0, 0] } });
  r.step({ title: "Push the last shelf on", detail: "Lock the cam onto the bolt, then tap a dowel into its free end.", add: ["shL"], fix: [at(CAM, "shL", [0, -1, 0], [[-xdo - 26, fixY + t / 2, zc]]), at(DOWEL, "shL", [1, 0, 0], [[-xi, fixY, zd]], "sL")], tools: ["hammer", "screwdriver"], from: { shL: [-300, 0, 0] } });
  r.step({ title: "Lay the top rail in", detail: "Tap a dowel into each end and push it onto the right side, across the top ends.", add: ["rail"], fix: [at(DOWEL, "rail", [1, 0, 0], [[-xi, railY - 12, railZ]], "sL"), at(DOWEL, "rail", [-1, 0, 0], [[xi, railY - 12, railZ]], "sR")], tools: ["hammer"], from: { rail: [-200, 0, 0] } });
  r.step({ title: "Fit the left side", detail: "Push it onto the dowels and bolts and lock the cam in the shelf.", add: ["sL"], fix: [at(CAM, "shL", [0, -1, 0], [[-xi + 26, fixY + t / 2, zc]])], tools: ["screwdriver"] });
  const ends: [string, number, number[]][] = [["sL", -xs, [-35, 5]], ["dvL", -xd, [-24]], ["dvR", xd, [-24]], ["sR", xs, [-35, 5]]];
  const screwZ: [number, number[]][] = [[-xs, [-62, 32]], [-xd, [-62, 14]], [xd, [-62, 14]], [xs, [-62, 32]]];
  r.step({ title: "Tap the dowels into the bottom ends", detail: "Two in each side, one in each divider.", fix: ends.map(([id, x, zs]) => at(DOWEL, id, [0, 1, 0], zs.map((z): Vec3 => [x, t, z]), "bot")), tools: ["hammer"] });
  r.step({ title: "Screw the bottom on", detail: "Push it onto the dowels, then eight long screws, two into each upright, with the Allen key.", add: ["bot"], fix: [at(ALLEN_SCREW, "bot", [0, 1, 0], screwZ.flatMap(([x, zs]) => zs.map((z): Vec3 => [x, 0, z])))], tools: ["allen"] });
  r.step({ title: "Turn it over and lock the rail", detail: "Lay it on its front. Lock the cam at each end of the top rail.", fix: [at(CAM, "rail", [0, 0, 1], [[-xi + 26, railY + 12, zf - railT], [xi - 26, railY + 12, zf - railT]])], tools: ["screwdriver"], pose: "-z" });
  r.step({ title: "Slide in the back panels", detail: "Down the grooves from the top, the two wide ones first, then the narrow one in the middle.", add: ["bkL", "bkR", "bkM"], from: { bkL: [0, 500, 0], bkR: [0, 500, 0], bkM: [0, 500, 0] } });
  r.step({ title: "Tap the dowels into the top ends", detail: "Two in each side, one in each divider.", fix: ends.map(([id, x, zs]) => at(DOWEL, id, [0, -1, 0], zs.map((z): Vec3 => [x, bodyH, z]), "top")), tools: ["hammer"] });
  r.step({ title: "Push the top on", detail: "Two people. Its back edge lines up with the back of the cabinet.", add: ["top"], people: 2 });
  r.step({ title: "Screw the top on", detail: "Eleven long screws: two into each upright and three into the rail.", fix: [at(ALLEN_SCREW, "top", [0, -1, 0], [...screwZ.flatMap(([x, zs]) => zs.map((z): Vec3 => [x, bodyH + crownH, z])), ...[-380, 0, 380].map((x): Vec3 => [x, bodyH + crownH, railZ])])], tools: ["allen"] });
  r.step({ title: "Clip the backs to the shelves", detail: "Two clips on each shelf, a small screw in each.", fix: [at({ kind: "clip", len: 12, dia: 20 }, undefined, [0, -1, 0], [-1, 0, 1].flatMap((g) => (g ? [-110, 110] : [-60, 60]).map((dx): Vec3 => [g * ((xi + xdo) / 2) + dx, fixY + t / 2, zb + 14]))), at({ kind: "screw", len: 12, dia: 3.5 }, undefined, [0, -1, 0], [-1, 0, 1].flatMap((g) => (g ? [-110, 110] : [-60, 60]).map((dx): Vec3 => [g * ((xi + xdo) / 2) + dx, fixY + t / 2 + 2, zb + 20])))], tools: ["screwdriver"] });
  const bk: [number, number][] = [[-xi, -1], [-xdo, 1], [xdo, -1], [xi, 1]];
  const BRACKET: Fit = { kind: "angle", len: 60, dia: 45, name: "Hanging bracket" };
  const bracketScrews = (g: number) => at({ kind: "screw", len: 11, dia: 5 }, undefined, [g, 0, 0], bk.filter((q) => q[1] === g).flatMap(([x]): Vec3[] => [[x, bodyH - 60, zb + 22], [x, bodyH - 100, zb + 22]]));
  r.step({ title: "Screw in the hanging brackets", detail: "Stand it up. One at the top of each door opening, two screws each.", fix: [at(BRACKET, undefined, [-1, 0, 0], bk.filter((q) => q[1] < 0).map(([x]): Vec3 => [x, bodyH - 80, zb + 30])), at(BRACKET, undefined, [1, 0, 0], bk.filter((q) => q[1] > 0).map(([x]): Vec3 => [x, bodyH - 80, zb + 30])), bracketScrews(-1), bracketScrews(1)], tools: ["screwdriver"], pose: "+y" });
  r.step({
    title: "Fix the wall plates and spacers",
    detail: "Mark the brackets on the wall and hang the plates level. The four spacers go behind the bottom. Use plugs and screws made for your wall (not included).",
    fix: [
      at({ kind: "bracket", len: 40, dia: 30, name: "Wall plate" }, undefined, [0, 0, -1], bk.map(([x]): Vec3 => [x - Math.sign(x) * 15, bodyH - 80, zb - 4])),
      at({ kind: "glide", len: 20, dia: 30, name: "Spacer" }, undefined, [0, 0, -1], [-xs, -xd, xd, xs].map((x): Vec3 => [x, 90, zb - 2])),
      at(WALL_PLUG, undefined, [0, 0, -1], [...bk.map(([x]): Vec3 => [x - Math.sign(x) * 15, bodyH - 80, zb - 22]), ...[-xs, -xd, xd, xs].map((x): Vec3 => [x, 90, zb - 22])]),
      at(WALL_SCREW, undefined, [0, 0, -1], [...bk.map(([x]): Vec3 => [x - Math.sign(x) * 15, bodyH - 80, zb + 2]), ...[-xs, -xd, xd, xs].map((x): Vec3 => [x, 90, zb + 20])]),
    ],
    wall: true,
    tools: ["drill", "level", "pencil", "screwdriver"],
  });
  r.step({ title: "Hang it and set it straight", detail: "Lift it onto the wall plates, then turn the screw in each bracket until it hangs level and tight to the wall.", tools: ["screwdriver", "level"], wall: true });
  r.step({ title: "Stick on the door bumpers", detail: "One under the top rail on each side, where the doors close.", fix: [at({ kind: "glide", len: 3, dia: 10, name: "Bumper" }, "rail", [0, 0, -1], [[-xdo - 40, railY, zf], [xdo + 40, railY, zf]])] });
  r.step({ title: "Screw the hinges onto the doors", detail: "Lay the doors face down on a rug. Two hinges in the cups of each.", wait: ["dL", "dR"], fix: [at(HINGE, "dL", [0, 0, 1], hingeY.map((y): Vec3 => [-W0 / 2 + 2 + 25, y, zf])), at(HINGE, "dR", [0, 0, 1], hingeY.map((y): Vec3 => [W0 / 2 - 2 - 25, y, zf]))], tools: ["screwdriver"] });
  r.step({ title: "Click the doors on", detail: "Slide each hinge onto its plate until it clicks.", add: ["dL", "dR"], from: { dL: [0, 0, 250], dR: [0, 0, 250] } });
  const pins = (x: number, g: number, ys: number[]) => ys.flatMap((y) => [-50, 12].map((z): Vec3 => [x, y - 6, z])).map((p) => ({ p, g }));
  const pinPts = [...pins(-xi, -1, gY), ...pins(-xdo, 1, gY), ...pins(-xdi, -1, mY.map((y) => y - 5)), ...pins(xdi, 1, mY.map((y) => y - 5)), ...pins(xdo, -1, gY), ...pins(xi, 1, gY)];
  r.step({ title: "Push in the shelf pins", detail: "Four for each shelf, all at the same height.", fix: [at({ kind: "pin", len: 10, dia: 5 }, undefined, [-1, 0, 0], pinPts.filter((q) => q.g < 0).map((q) => q.p)), at({ kind: "pin", len: 10, dia: 5 }, undefined, [1, 0, 0], pinPts.filter((q) => q.g > 0).map((q) => q.p))] });
  r.step({ title: "Lay in the middle shelves", add: ["m0", "m1"] });
  r.step({ title: "Lay in the glass shelves", detail: "Three behind each door. Set the glass down gently.", add: [...gY.map((_, i) => `gL${i}`), ...gY.map((_, i) => `gR${i}`)] });
  const faces: [number, number][] = [[-xi, -1], [-xdo, 1], [-xdi, -1], [xdi, 1], [xdo, -1], [xi, 1]];
  const caps = faces.flatMap(([x, g]) => [270, 360, 540, 700, 880].flatMap((y) => [-50, 12].map((z) => ({ p: [x, y, z] as Vec3, g })))).slice(0, 52);
  r.step({ title: "Cap the empty holes", detail: "Press a cap into every shelf hole you aren't using.", fix: [-1, 1].map((g) => at({ kind: "cap", len: 5, dia: 5, name: "Hole cap" }, undefined, [g, 0, 0], caps.filter((c) => c.g === g).map((c) => c.p))) });
  r.step({ title: "Snap the covers onto the brackets", fix: [at({ kind: "cap", len: 30, dia: 30, name: "Bracket cover" }, undefined, [0, 0, -1], bk.map(([x, g]): Vec3 => [x + g * 10, bodyH - 80, zb + 50]))] });
  return r.get();
}


/* ---------- sideboard 157 x 88 ---------- */

/*
 * Sideboard 157 x 88: the three drawers are built first, on their fronts. The drawer section is two dividers with the
 * cabinet runners on them, joined at the back by two rails. Each side is a ready-made frame of two legs and a panel;
 * they take the hinge plates and cam bolts lying down. With it lying on its back: the bottom and its front rail, the
 * right side, the back rail, the drawer section onto the bottom (four long screws from below), the left side and the
 * middle foot. Standing, the top goes on dowels and twelve cam locks; on its front the back panel slides in and is
 * screwed, and the two front feet go under the dividers. Two brackets hold it to the wall, then shelves, doors, knobs
 * and drawers.
 */
function sideboard(b: PlanBuilder): void {
  const H = 880, topT = 30, bodyH = H - topT; // 850
  const xF = 740, xFi = 715, xFr = 720; // side frame centre, leg inner face, rail inner face
  const t = 18, zf = 220, zb = -220;
  const xd = 209, xdi = xd - t / 2, xdo = xd + t / 2; // dividers
  const yB = 140, yBt = yB + t; // bottom board, its top face
  const zBf = 200, zBb = -200; // bottom front and back edges
  const zDv0 = -194; // the dividers' back edge, in front of the back panel
  const dc = (zDv0 + zBf) / 2;

  // drawers first: they are built before the cabinet
  const dh = (bodyH - yBt) / 3;
  const made = makeDrawers(b, range(3).map((i): DrawerBox => ({ x: 0, y0: yBt + i * dh, w: 2 * xdi, h: dh, zf, zBack: -170, knobs: 1 })));
  frontDrawers(b, made, { dowels: true, runnerScrews: true });

  const r = new Recipe();
  const frame = (g: number): CustomPart["pieces"] => [
    { shape: "box", size: [50, bodyH, 50], pos: [0, bodyH / 2, 195], material: "wood" },
    { shape: "box", size: [50, bodyH, 50], pos: [0, bodyH / 2, -195], material: "wood" },
    { shape: "box", size: [40, 60, 340], pos: [g * 5, yB - 10, 0], material: "wood" },
    { shape: "box", size: [40, 70, 340], pos: [g * 5, bodyH - 35, 0], material: "wood" },
    { shape: "box", size: [16, bodyH - 70 - (yB + 20), 340], pos: [g * 10, (yB + 20 + bodyH - 70) / 2, 0], material: "board" },
  ];
  // side frames: pieces relative to a point on the floor at the frame's centre line
  r.part("fL", "Side frame", [50, bodyH, 440], [-xF, 0, 0], { pieces: frame(1) });
  r.part("fR", "Side frame", [50, bodyH, 440], [xF, 0, 0], { pieces: frame(-1) });
  r.part("bot", "Bottom", [2 * xFi, t, zBf - zBb], [0, yB + t / 2, 0]);
  r.part("rf", "Front rail", [2 * xFi, 60, 20], [0, yBt - 30, zf - 10], { material: "wood" });
  r.part("rb", "Back rail", [2 * xFi, 60, 20], [0, yBt - 30, zb + 10], { material: "wood" });
  r.part("dvL", "Divider", [t, bodyH - yBt, zBf - zDv0], [-xd, (yBt + bodyH) / 2, dc]);
  r.part("dvR", "Divider", [t, bodyH - yBt, zBf - zDv0], [xd, (yBt + bodyH) / 2, dc]);
  r.part("drB", "Drawer section rail", [2 * xdi, 60, t], [0, yBt + 30, zDv0 + t / 2], { material: "wood" });
  r.part("drT", "Drawer section rail", [2 * xdi, 60, t], [0, bodyH - 30, zDv0 + t / 2], { material: "wood" });
  r.part("ftM", "Middle foot", [50, yB, 50], [0, yB / 2, -175], { material: "wood" });
  r.part("top", "Top", [1570, topT, 470], [0, bodyH + topT / 2, 0], { material: "wood" });
  r.part("bk", "Back panel", [2 * xFi, bodyH - yBt, 4], [0, (yBt + bodyH) / 2, -198], { material: "fiber" });
  r.part("ftL", "Front foot", [45, yB, 45], [-xd, yB / 2, 175], { material: "wood" });
  r.part("ftR", "Front foot", [45, yB, 45], [xd, yB / 2, 175], { material: "wood" });
  const dW = xFi - xdo - 4, doorX = (xFi + xdo) / 2, doorH = bodyH - yBt - 4;
  const door = (id: string, g: number) =>
    r.part(id, "Door", [dW, doorH, 20], [g * doorX, (yBt + bodyH) / 2, zf - 10], {
      pieces: [
        { shape: "box", size: [dW, doorH, 20], pos: [0, 0, 0], material: "board" },
        { shape: "box", size: [dW - 120, doorH - 120, 4], pos: [0, 0, 9], material: "board" },
      ],
    });
  door("dL", -1);
  door("dR", 1);
  r.part("shL", "Shelf", [dW - 4, t, 360], [-doorX, 500, -10]);
  r.part("shR", "Shelf", [dW - 4, t, 360], [doorX, 500, -10]);

  const L_SCREW: Fit = { kind: "screw", len: 70, dia: 6 };
  const PLATE: Fit = { kind: "hinge", len: 50, dia: 20, name: "Hinge plate" };
  const RUN: Fit = { kind: "runner", len: 380, dia: 30 };
  const PIN: Fit = { kind: "pin", len: 16, dia: 5 };
  const SCREW_S: Fit = { kind: "screw", len: 14, dia: 3.5 };
  const yRun = range(3).map((i) => yBt + i * dh + 34);
  const hingeY = [yBt + 120, bodyH - 120];
  const zRail = zf - 10, zRailB = zb + 10, yRail = yBt - 30;
  const away: Vec3 = [900, 0, 0];

  // the drawer section, built beside the cabinet
  r.step({ title: "Screw the runners onto the dividers", detail: "Lay both dividers on a rug, inside up. Three runners on each, three screws each.", add: ["dvL"], wait: ["dvR"], fix: [at(RUN, "dvL", [-1, 0, 0], yRun.map((y): Vec3 => [-xdi, y, dc])), at(RUN, "dvR", [1, 0, 0], yRun.map((y): Vec3 => [xdi, y, dc])), at(D_RUNNER_SCREW, "dvL", [-1, 0, 0], yRun.flatMap((y) => [dc - 150, dc, dc + 150].map((z): Vec3 => [-xdi, y, z]))), at(D_RUNNER_SCREW, "dvR", [1, 0, 0], yRun.flatMap((y) => [dc - 150, dc, dc + 150].map((z): Vec3 => [xdi, y, z])))], tools: ["screwdriver"], pose: "+x", from: { dvR: away } });
  r.step({ title: "Screw the cam bolts into the right divider", detail: "Four, by hand, near the back edge.", fix: [at(CAM_BOLT, "dvR", [1, 0, 0], [[xdi, yBt + 18, zDv0 + 9], [xdi, yBt + 42, zDv0 + 9], [xdi, bodyH - 42, zDv0 + 9], [xdi, bodyH - 18, zDv0 + 9]])], tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Stand the two rails in the left divider", detail: "Tap two dowels into the end of each rail and push it into the divider.", add: ["drB", "drT"], fix: [at(DOWEL, "drB", [1, 0, 0], [[-xdi, yBt + 30, zDv0 + 9]], "dvL"), at(DOWEL, "drT", [1, 0, 0], [[-xdi, bodyH - 30, zDv0 + 9]], "dvL"), at(DOWEL, "drB", [1, 0, 0], [[-xdi, yBt + 10, zDv0 + 9]], "dvL"), at(DOWEL, "drT", [1, 0, 0], [[-xdi, bodyH - 10, zDv0 + 9]], "dvL")], tools: ["hammer"], pose: "+x" });
  r.step({ title: "Lock the rails", detail: "One cam lock in each rail, at the left divider.", fix: [at(CAM, "drB", [0, 0, 1], [[-xdi + 26, yBt + 30, zDv0 + t]]), at(CAM, "drT", [0, 0, 1], [[-xdi + 26, bodyH - 30, zDv0 + t]])], tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Put the right divider on", detail: "Lower it onto the bolts and lock the other two cams.", add: ["dvR"], fix: [at(CAM, "drB", [0, 0, 1], [[xdi - 26, yBt + 30, zDv0 + t]]), at(CAM, "drT", [0, 0, 1], [[xdi - 26, bodyH - 30, zDv0 + t]])], tools: ["screwdriver"], pose: "+x" });

  // the side frames
  const fBolts = (g: number, id: string) => at(CAM_BOLT, id, [g, 0, 0], [...[-120, 0, 120].map((z): Vec3 => [g * xFi, yB + t / 2, z]), [g * xFi, yRail + 10, zRail], [g * xFi, yRail + 10, zRailB]]);
  r.step({ title: "Screw the hinge plates onto the side frames", detail: "Two on the inside of each front leg.", wait: ["fL", "fR"], fix: [at(PLATE, "fL", [-1, 0, 0], hingeY.map((y): Vec3 => [-xFi, y, 190])), at(PLATE, "fR", [1, 0, 0], hingeY.map((y): Vec3 => [xFi, y, 190]))], tools: ["screwdriver"], pose: "+z", from: { fL: [-900, 0, 0], fR: away } });
  r.step({ title: "Screw the cam bolts into the side frames", detail: "Five in each, by hand until they stop.", fix: [fBolts(-1, "fL"), fBolts(1, "fR")], tools: ["screwdriver"], pose: "+z" });

  // bottom and front rail
  const bEnds = (g: number): CustomFix[] => [at(DOWEL, "bot", [-g, 0, 0], [-60, 60].map((z): Vec3 => [g * xFi, yB + t / 2, z]), g < 0 ? "fL" : "fR"), at(DOWEL, "rf", [-g, 0, 0], [[g * xFi, yRail - 15, zRail]], g < 0 ? "fL" : "fR")];
  const railX = [-560, -190, 190, 560];
  r.step({ title: "Screw the cam bolts into the bottom", detail: "Four along the front edge, by hand.", add: ["bot"], fix: [at(CAM_BOLT, "bot", [0, 0, -1], railX.map((x): Vec3 => [x, yB + t / 2, zBf]), "rf")], tools: ["screwdriver"], pose: "+z" });
  r.step({ title: "Tap in the dowels", detail: "Ten: four along the front edge of the bottom, two in each end of it and one in each end of the front rail.", fix: [at(DOWEL, "bot", [0, 0, -1], railX.map((x): Vec3 => [x + 40, yB + t / 2, zBf]), "rf"), ...bEnds(-1), ...bEnds(1)], tools: ["hammer"], pose: "+z" });
  r.step({ title: "Fit the front rail", detail: "Push it onto the front edge of the bottom and lock the four cam locks.", add: ["rf"], fix: [at(CAM, "rf", [0, -1, 0], railX.map((x): Vec3 => [x, yBt, zRail]))], tools: ["screwdriver"], pose: "+z", from: { rf: [0, 0, 250] } });
  r.step({ title: "Push the right side frame on", detail: "It stands on its back edge. Push the bottom onto its dowels and bolts.", add: ["fR"], pose: "+z" });
  r.step({ title: "Lock the cams on the right", detail: "Three in the bottom and one in the front rail.", fix: [at(CAM, "bot", [0, -1, 0], [-120, 0, 120].map((z): Vec3 => [xFi - 26, yBt, z])), at(CAM, "rf", [0, 0, -1], [[xFi - 26, yRail + 10, zf]])], tools: ["screwdriver"], pose: "+z" });
  r.step({ title: "Slide the back rail in", detail: "A dowel in each end, push it into the right side and lock its cam.", add: ["rb"], fix: [at(DOWEL, "rb", [-1, 0, 0], [[xFi, yRail - 15, zRailB]], "fR"), at(DOWEL, "rb", [1, 0, 0], [[-xFi, yRail - 15, zRailB]], "fL"), at(CAM, "rb", [0, 0, 1], [[xFi - 26, yRail + 10, zb]])], tools: ["hammer", "screwdriver"], pose: "+z", from: { rb: [-300, 0, 0] } });
  const dvBot = (x: number) => [dc - 120, dc + 120].map((z): Vec3 => [x, yBt, z]);
  r.step({ title: "Set the drawer section on the bottom", detail: "Two dowels in the bottom end of each divider, then lower it onto the bottom, between the rails.", fix: [at(DOWEL, "dvL", [0, 1, 0], dvBot(-xd), "bot"), at(DOWEL, "dvR", [0, 1, 0], dvBot(xd), "bot")], tools: ["hammer"], pose: "+z" });
  r.step({ title: "Screw the dividers to the bottom", detail: "Four long screws up through the bottom, two into each divider.", fix: [at(L_SCREW, "bot", [0, 1, 0], [-xd, xd].flatMap((x) => [dc - 60, dc + 60].map((z): Vec3 => [x, yB, z])))], tools: ["allen"], pose: "+z" });
  r.step({ title: "Put the left side frame on", detail: "Onto the dowels and bolts of the bottom and both rails.", add: ["fL"], pose: "+z" });
  r.step({ title: "Lock the cams on the left", detail: "Five of them, arrow towards the bolt.", fix: [at(CAM, "bot", [0, -1, 0], [-120, 0, 120].map((z): Vec3 => [-xFi + 26, yBt, z])), at(CAM, "rf", [0, 0, -1], [[-xFi + 26, yRail + 10, zf]]), at(CAM, "rb", [0, 0, 1], [[-xFi + 26, yRail + 10, zb]])], tools: ["screwdriver"], pose: "+z" });
  r.step({ title: "Screw on the middle foot", detail: "One long screw down through the bottom into it, then stand the sideboard up.", add: ["ftM"], fix: [at(L_SCREW, "bot", [0, -1, 0], [[0, yBt, -175]])], tools: ["allen"], pose: "+z", from: { ftM: [0, -250, 0] } });

  // the top
  const uprights: [string, number][] = [["fL", -xF], ["dvL", -xd], ["dvR", xd], ["fR", xF]];
  const topDowelZ = (_id: string) => [-150, -10, 130];
  const topBoltZ = (id: string) => (id[0] === "f" ? [-80, 60, 150] : [-80, 60, 170]);
  const camFace: Record<string, [number, number]> = { fL: [-xFr, -1], dvL: [-xdo, 1], dvR: [xdo, -1], fR: [xFr, 1] };
  const topCams = uprights.map(([id]) => at(CAM, id, [camFace[id][1], 0, 0], topBoltZ(id).map((z): Vec3 => [camFace[id][0], bodyH - 26, z])));
  r.step({ title: "Tap the dowels into the tops", detail: "Three in each side frame and three in each divider.", fix: uprights.map(([id, x]) => at(DOWEL, id, [0, -1, 0], topDowelZ(id).map((z): Vec3 => [x, bodyH, z]), "top")), tools: ["hammer"], pose: "+y" });
  r.step({ title: "Screw the cam bolts into the top", detail: "Lay it upside down on a rug: twelve, six of each kind where the drawing shows.", wait: ["top"], fix: [at(CAM_BOLT, "top", [0, 1, 0], uprights.flatMap(([id, x]) => topBoltZ(id).map((z): Vec3 => [x, bodyH, z])), undefined)], tools: ["screwdriver"], pose: "+y", from: { top: [0, 500, 0] } });
  r.step({ title: "Lower the top on", detail: "Two people. Then lock the twelve cams from inside.", add: ["top"], people: 2, fix: topCams, tools: ["screwdriver"], pose: "+y", from: { top: [0, 300, 0] } });
  r.step({ title: "Screw the drawer section to the top", detail: "Four long screws up through the top rail of the drawer section.", fix: [at(L_SCREW, "drT", [0, 1, 0], [-150, -50, 50, 150].map((x): Vec3 => [x, bodyH - 60, zDv0 + 9]))], tools: ["allen"], pose: "+y" });

  // the back and the front feet, lying on its front
  r.step({ title: "Slide in the back panel", detail: "Lay it on its front. Mark the middle of each divider on the back first, then slide the panel down the grooves.", add: ["bk"], pose: "-z", from: { bk: [0, 600, 0] } });
  r.step({ title: "Screw the back on", detail: "Eight screws along your marks, into the dividers and the drawer section rails.", fix: [at(SCREW_S, "bk", [0, 0, 1], [...[-xd, xd].flatMap((x) => [320, 650].map((y): Vec3 => [x, y, -200])), ...[-120, 120].flatMap((x) => [yBt + 30, bodyH - 30].map((y): Vec3 => [x, y, -200]))])], tools: ["screwdriver"], pose: "-z" });
  r.step({ title: "Fit the two front feet", detail: "Two dowels in the top of each, push them on under the dividers and drive one screw down through the bottom into each. Then stand it up.", add: ["ftL", "ftR"], fix: [at(DOWEL, "ftL", [0, -1, 0], [[-xd, yB, 165], [-xd, yB, 185]].map((p): Vec3 => [p[0] - 10, p[1], p[2]]), "bot"), at(DOWEL, "ftR", [0, -1, 0], [[xd + 10, yB, 165], [xd + 10, yB, 185]], "bot"), at({ kind: "screw", len: 60, dia: 6 }, "bot", [0, -1, 0], [[-xd + 10, yBt, 175], [xd - 10, yBt, 175]])], tools: ["hammer", "allen"], pose: "-z", from: { ftL: [0, -250, 0], ftR: [0, -250, 0] } });

  // wall, shelves, doors
  const wallX = [-xd - 120, xd + 120];
  r.step({
    title: "Fix it to the wall",
    detail: "Screw the two brackets under the back of the top, with a washer on each screw. Push it to the wall and fix the brackets with screws made for your wall (not included).",
    fix: [
      at({ kind: "bracket", len: 60, dia: 40, name: "Wall bracket" }, "top", [0, 1, 0], wallX.map((x): Vec3 => [x, bodyH, -215])),
      at({ kind: "washer", len: 1.5, dia: 16 }, "top", [0, 1, 0], wallX.flatMap((x): Vec3[] => [[x, bodyH - 2, -205], [x + 12, bodyH - 30, zb - 2]])),
      at(SCREW_S, "top", [0, 1, 0], wallX.map((x): Vec3 => [x, bodyH - 3, -205])),
      at(WALL_PLUG, undefined, [0, 0, -1], wallX.map((x): Vec3 => [x + 12, bodyH - 30, zb - 22])),
      at(WALL_SCREW, undefined, [0, 0, -1], wallX.map((x): Vec3 => [x + 12, bodyH - 30, zb + 6])),
    ],
    wall: true,
    pose: "+y",
    tools: ["drill", "pencil", "screwdriver"],
  });
  r.step({ title: "Push in the shelf pins and lay in the shelves", detail: "Four pins for each shelf, all at the same height.", add: ["shL", "shR"], fix: [at(PIN, undefined, [-1, 0, 0], [-xFi, xdo].flatMap((x) => [-160, 140].map((z): Vec3 => [x, 500 - t / 2 - 3, z]))), at(PIN, undefined, [1, 0, 0], [-xdo, xFi].flatMap((x) => [-160, 140].map((z): Vec3 => [x, 500 - t / 2 - 3, z])))] });
  r.step({ title: "Screw the hinges onto the doors", detail: "Lay the doors face down. Two hinges in the cups of each, the two kinds as the drawing shows.", wait: ["dL", "dR"], fix: [at({ kind: "hinge", len: 100, dia: 35 }, "dL", [0, 0, 1], hingeY.map((y): Vec3 => [-xFi + 25, y, zf - 20])), at({ kind: "hinge", len: 100, dia: 35 }, "dR", [0, 0, 1], hingeY.map((y): Vec3 => [xFi - 25, y, zf - 20]))], tools: ["screwdriver"], from: { dL: [0, 0, 500], dR: [0, 0, 500] } });
  r.step({ title: "Click the doors on", detail: "Hook each hinge over its plate and press until it clicks.", add: ["dL", "dR"], from: { dL: [0, 0, 250], dR: [0, 0, 250] } });
  r.step({ title: "Screw on the door knobs and fit the stops", detail: "One knob on each door, near the drawers. The two stops go in the front edge of the bottom, where the doors close.", fix: [at(D_KNOB, "dL", [0, 0, -1], [[-xdo - 50, 504, zf]]), at(D_KNOB, "dR", [0, 0, -1], [[xdo + 50, 504, zf]]), at(D_KNOB_SCREW, "dL", [0, 0, 1], [[-xdo - 50, 504, zf - 23]]), at(D_KNOB_SCREW, "dR", [0, 0, 1], [[xdo + 50, 504, zf - 23]]), at({ kind: "glide", len: 8, dia: 8, name: "Door stop" }, "bot", [0, -1, 0], [[-doorX, yBt, zBf - 6], [doorX, yBt, zBf - 6]])], tools: ["screwdriver"] });
  buildCustom(b, { ...spec(b), custom: r.get() });

  drawersIn(b, made, { dowels: true }, "Slide the drawers in", "Set each drawer on its runners and push it in until it stops.");
}

/* ---------- shoe cabinets ---------- */

/*
 * Shoe cabinets with 2 and with 4 compartments (IKEA sells them outside Europe and the US; the manuals are read from
 * IKEA's own). Each side is a ready-built frame of two legs and a panel. With the left side on a rug the front rails
 * and the two back boards stand in it on dowels and cam bolts (the 4 compartment one has a divider in the middle that
 * the rails of both columns meet), the right side goes on, then the top on dowels and cam locks, screwed from below.
 * Two glides under the back legs, two screws into the wall. Each compartment is a front with a plastic shoe rack
 * clicked together and screwed on; it hangs on two pivots and is held by two stop brackets. The 2 compartment one has
 * a drawer at the top, built on its front.
 */
function shoeCabinet(b: PlanBuilder, s: ProductSpec): void {
  const four = /4-compartments/.test(s.slug ?? "");
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const topT = 20, bodyH = H - topT, P = 45, legH = four ? 120 : 140;
  const zf = D / 2 - 10, zb = -D / 2;
  const xs = W / 2 - 10 - P / 2, xi = xs - P / 2;
  const cols = four ? [-1, 1] : [0];
  const xd = 9; // the divider's faces, on the 4 compartment one
  const cw = four ? xi - xd : 2 * xi;
  const cx = (c: number) => (c === 0 ? 0 : c * (xd + xi) / 2);
  const botR = 50, midR = 30, topR = 30;
  const drawerH = four ? 0 : 150;
  const y0 = legH + botR, y1 = bodyH - topR - (four ? 0 : drawerH + midR);
  const rowH = (y1 - y0 - midR) / 2;
  const rows = [y0, y0 + rowH + midR]; // bottom of each compartment opening
  const r = new Recipe();
  const zr = zf - 10, zBk = zb + 8;
  const sideFrame = (g: number): CustomPart["pieces"] => [
    { shape: "box", size: [P, bodyH, P], pos: [0, bodyH / 2, zf - P / 2], material: "wood" },
    { shape: "box", size: [P, bodyH, P], pos: [0, bodyH / 2, zb + P / 2], material: "wood" },
    { shape: "box", size: [16, bodyH - legH, zf - zb - 2 * P], pos: [g * 4, (legH + bodyH) / 2, (zf + zb) / 2], material: "board" },
  ];
  r.part("sL", "Side", [P, bodyH, zf - zb], [-xs, 0, 0], { pieces: sideFrame(1) });
  r.part("sR", "Side", [P, bodyH, zf - zb], [xs, 0, 0], { pieces: sideFrame(-1) });
  type Rail = { id: string; c: number; y: number; h: number };
  const rails: Rail[] = cols.flatMap((c) => {
    const k = c < 0 ? "L" : c > 0 ? "R" : "";
    const list: Rail[] = [
      { id: `rb${k}`, c, y: legH + botR / 2, h: botR },
      { id: `rm${k}`, c, y: y0 + rowH + midR / 2, h: midR },
      { id: `rt${k}`, c, y: bodyH - topR / 2, h: topR },
    ];
    if (!four) list.push({ id: "rd", c, y: y1 + midR / 2, h: midR });
    return list;
  });
  for (const q of rails) r.part(q.id, "Front rail", [cw, q.h, 20], [cx(q.c), q.y, zr], { material: "wood" });
  r.part("bkB", "Back board", [2 * xi, 120, 16], [0, legH + 60, zBk]);
  r.part("bkT", "Back board", [2 * xi, 120, 16], [0, bodyH - 60, zBk]);
  if (four) r.part("dv", "Divider", [2 * xd, bodyH - legH, zr - 10 - (zBk + 8)], [0, (legH + bodyH) / 2, (zr - 10 + zBk + 8) / 2]);
  r.part("top", "Top", [W, topT, D], [0, bodyH + topT / 2, 0], { material: "wood" });
  const comps = cols.flatMap((c) => rows.map((y, i) => ({ c, y, id: `${c < 0 ? "L" : c > 0 ? "R" : "M"}${i}` })));
  for (const q of comps) {
    r.part(`cf${q.id}`, "Compartment front", [cw - 4, rowH - 4, 18], [cx(q.c), q.y + rowH / 2, zf - 9], {
      pieces: [
        { shape: "box", size: [cw - 4, rowH - 4, 18], pos: [0, 0, 0], material: "board" },
        { shape: "box", size: [cw - 90, rowH - 90, 3], pos: [0, 0, 8], material: "board" },
      ],
    });
    r.part(`cr${q.id}`, "Shoe rack", [cw - 30, rowH - 50, 130], [cx(q.c), q.y + rowH / 2, zf - 18 - 65], {
      material: "fiber",
      pieces: [
        { shape: "box", size: [cw - 40, rowH - 70, 3], pos: [0, 0, 0], rot: [-0.45, 0, 0], material: "fiber" },
        { shape: "box", size: [4, rowH - 50, 130], pos: [-(cw - 34) / 2, 0, 0], material: "fiber" },
        { shape: "box", size: [4, rowH - 50, 130], pos: [(cw - 34) / 2, 0, 0], material: "fiber" },
      ],
    });
  }

  const LONG: Fit = { kind: "screw", len: 60, dia: 6 };
  const LONG2: Fit = { kind: "screw", len: 80, dia: 6 };
  const SMALL: Fit = { kind: "screw", len: 12, dia: 4 };
  const PIVOT: Fit = { kind: "stud", len: 15, dia: 12, name: "Pivot" };
  const STOP: Fit = { kind: "clip", len: 40, dia: 20, name: "Stop bracket" };
  const side = (g: number) => (g < 0 ? "sL" : "sR");
  // the faces each column's compartments hang between: [x, the way into the part, part]
  const faces = (c: number): [number, number, string][] => (c === 0 ? [[-xi, -1, "sL"], [xi, 1, "sR"]] : c < 0 ? [[-xi, -1, "sL"], [-xd, 1, "dv"]] : [[xd, -1, "dv"], [xi, 1, "sR"]]);
  const pivots = (pick: (id: string) => boolean): CustomFix[] =>
    cols.flatMap((c) => faces(c).filter(([, , id]) => pick(id)).flatMap(([x, g, id]) => [
      at(PIVOT, id, [g, 0, 0], rows.map((y): Vec3 => [x, y + 40, zf - 70])),
      at(STOP, id, [g, 0, 0], rows.map((y): Vec3 => [x, y + rowH - 60, zf - 110])),
      at(SMALL, id, [g, 0, 0], rows.flatMap((y): Vec3[] => [[x, y + 70, zf - 70], [x, y + rowH - 60, zf - 140], [x, y + rowH - 60, zf - 80]])),
    ]));

  // inside each side frame (shown on the frame, it comes as one piece in the drawing)
  const internal = (g: number): CustomFix[] => {
    const x = g * xs, id = side(g);
    const yy = [legH + 80, bodyH - 80];
    const out = [
      at(CAM_BOLT, id, [0, 0, 1], yy.map((y): Vec3 => [x, y, zf - P])),
      at(DOWEL, id, [0, 0, -1], yy.map((y): Vec3 => [x, y, zb + P])),
      at(CAM, id, [-g, 0, 0], yy.map((y): Vec3 => [x - g * 8, y, zf - P - 26])),
    ];
    if (!four) out.push(at(LONG, id, [0, 0, -1], [legH + 200, (legH + bodyH) / 2, bodyH - 200, bodyH - 60].map((y): Vec3 => [x, y, zf])), at(LONG, id, [0, 0, 1], [legH + 200, (legH + bodyH) / 2, bodyH - 200].map((y): Vec3 => [x, y, zb])));
    return out;
  };
  r.step({ title: "Put the side frames together", detail: four ? "Cam bolts, dowels and cam locks join each panel to its legs. Lay the left one on a rug." : "Cam bolts, dowels and cam locks join each panel to its legs, then the long screws through the legs. Lay the left one on a rug.", add: ["sL"], wait: ["sR"], fix: [...internal(-1), ...internal(1)], tools: four ? ["screwdriver", "hammer"] : ["screwdriver", "hammer", "allen"], pose: "+x", warnings: ["floor"], from: { sR: [700, 0, 0] } });
  r.step({ title: "Fit the pivots and stop brackets", detail: "On the inside of each side: a pivot low at the front of each compartment, tapped in and screwed, and a stop bracket near the top.", fix: pivots((id) => id !== "dv"), tools: ["screwdriver", "hammer"], pose: "+x" });
  const runY = y1 + midR + 20;
  if (!four) r.step({ title: "Screw on the drawer runners", detail: "One on each side, at the top, with the small screws from the bag.", fix: [at({ kind: "runner", len: Math.round((zf - zb - 60) / 10) * 10, dia: 30 }, "sL", [-1, 0, 0], [[-xi, runY, (zf + zb) / 2]]), at({ kind: "runner", len: Math.round((zf - zb - 60) / 10) * 10, dia: 30 }, "sR", [1, 0, 0], [[xi, runY, (zf + zb) / 2]]), at(D_RUNNER_SCREW, "sL", [-1, 0, 0], [zb + 70, zf - 70].map((z): Vec3 => [-xi, runY, z])), at(D_RUNNER_SCREW, "sR", [1, 0, 0], [zb + 70, zf - 70].map((z): Vec3 => [xi, runY, z]))], tools: ["screwdriver"], pose: "+x" });

  // joints between the sides (and divider) and the rails and back boards
  const sideRails = (g: number) => [...rails.filter((q) => q.c === 0 || q.c === g), { id: "bkB", c: 0, y: legH + 60, h: 120 }, { id: "bkT", c: 0, y: bodyH - 60, h: 120 }];
  const zOf = (id: string) => (id.startsWith("bk") ? zBk : zr);
  const dowelsAt = (id: string) => (id.startsWith("bk") && !four ? 2 : 1);
  const sideBolts = (g: number) => at(CAM_BOLT, side(g), [g, 0, 0], sideRails(g).map((q): Vec3 => [g * xi, q.y + (q.h > 60 ? -30 : 0), zOf(q.id)]));
  const sideDowels = (g: number) => sideRails(g).map((q) => at(DOWEL, q.id, [-g, 0, 0], (dowelsAt(q.id) === 2 ? [q.y + 10, q.y + 40] : [q.y]).map((y): Vec3 => [g * xi, y, zOf(q.id) + (q.id.startsWith("bk") ? 0 : 0)]).map((p): Vec3 => (q.h > 60 ? p : [p[0], p[1], p[2] - 6])), side(g)));
  const sideCams = (g: number) => sideRails(g).map((q) => at(CAM, q.id, q.id.startsWith("bk") ? [0, 0, 1] : [0, -1, 0], [[g * (xi - 26), q.id.startsWith("bk") ? q.y - 30 : q.y + q.h / 2, q.id.startsWith("bk") ? zBk + 8 : zr]]));
  r.step({ title: "Screw the cam bolts into the sides", detail: `${sideRails(1).length} in each side, by hand until they stop.`, fix: [sideBolts(-1), sideBolts(1)], tools: ["screwdriver"], pose: "+x" });
  const leftIds = sideRails(-1).map((q) => q.id);
  r.step({ title: four ? "Stand the left rails and the back boards in" : "Stand the rails and the back boards in", detail: "Tap the dowels into the rail ends and push them into the left side.", add: leftIds, fix: sideDowels(-1), tools: ["hammer"], pose: "+x" });
  r.step({ title: "Lock the cam locks", detail: "Arrow towards the bolt, then a clockwise turn.", fix: sideCams(-1), tools: ["screwdriver"], pose: "+x" });
  if (four) {
    const mid = (c: number) => rails.filter((q) => q.c === c);
    r.step({ title: "Fit the pivots and stops on the divider", detail: "Both faces, as on the sides.", wait: ["dv"], fix: pivots((id) => id === "dv"), tools: ["screwdriver", "hammer"], pose: "+x", from: { dv: [0, 0, 700] } });
    r.step({
      title: "Put the divider on",
      detail: "Two cam bolts into it for the middle rails, dowels in the other rail ends, then push it onto the left rails and lock.",
      add: ["dv"],
      fix: [
        at({ kind: "camScrew", len: 30, dia: 7, name: "Cam bolt, short" }, "dv", [-1, 0, 0], [[-xd, mid(-1)[1].y, zr]]),
        at({ kind: "camScrew", len: 30, dia: 7, name: "Cam bolt, short" }, "dv", [1, 0, 0], [[xd, mid(1)[1].y, zr]]),
        at(DOWEL, "rtL", [-1, 0, 0], [[-xd, mid(-1)[2].y, zr - 6]], "dv"),
        at(DOWEL, "rmL", [-1, 0, 0], [[-xd, mid(-1)[1].y - 10, zr - 6]], "dv"),
        at({ kind: "cam", len: 13, dia: 12, name: "Cam lock, small" }, "rmL", [0, -1, 0], [[-xd - 26, mid(-1)[1].y + midR / 2, zr]]),
      ],
      tools: ["hammer", "screwdriver"],
      pose: "+x",
    });
    r.step({
      title: "Stand the right rails in",
      detail: "Onto the divider: dowels at the top, the bolt in the middle, then lock it.",
      add: mid(1).map((q) => q.id),
      fix: [at(DOWEL, "rtR", [1, 0, 0], [[xd, mid(1)[2].y, zr - 6]], "dv"), at(DOWEL, "rmR", [1, 0, 0], [[xd, mid(1)[1].y - 10, zr - 6]], "dv"), at({ kind: "cam", len: 13, dia: 12, name: "Cam lock, small" }, "rmR", [0, -1, 0], [[xd + 26, mid(1)[1].y + midR / 2, zr]])],
      tools: ["hammer", "screwdriver"],
      pose: "+x",
    });
  }
  r.step({ title: "Lower the right side on", detail: "Dowels in the free rail ends, then press it on evenly.", add: ["sR"], fix: sideDowels(1), tools: ["hammer"], pose: "+x" });
  r.step({ title: "Lock the cam locks on this side", fix: sideCams(1), tools: ["screwdriver"], pose: "+x" });
  if (four)
    r.step({ title: "Screw the divider to the back boards", detail: "Long screws through the back boards into the divider, and one through the divider into each bottom rail.", fix: [at(LONG2, "bkT", [0, 0, 1], [[0, bodyH - 60, zb]]), at({ kind: "screw", len: 70, dia: 6 }, "bkB", [0, 0, 1], [[0, legH + 60, zb]]), at(LONG2, "dv", [-1, 0, 0], [[xd, legH + 8, zr]]), at(LONG2, "dv", [1, 0, 0], [[-xd, legH + botR - 8, zr]])], tools: ["allen"], pose: "+x" });

  // the top
  const topZ = [(zf + zb) / 2 - 40, (zf + zb) / 2 + 40];
  r.step({ title: "Tap the dowels into the sides", detail: "Two in the top of each side.", fix: [-1, 1].map((g) => at(DOWEL, side(g), [0, -1, 0], topZ.map((z): Vec3 => [g * xs, bodyH, z]), "top")), tools: ["hammer"], pose: "+x" });
  r.step({ title: "Put the top on", detail: "Two cam bolts into the top by hand, push it onto the dowels and lock the two cams.", add: ["top"], fix: [at(CAM_BOLT, "top", [0, 1, 0], [-1, 1].map((g): Vec3 => [g * xs, bodyH, (zf + zb) / 2])), at(CAM, undefined, [0, 0, 1], [-1, 1].map((g): Vec3 => [g * xs, bodyH - 26, (zf + zb) / 2 - 30]))], tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Screw the top down", detail: four ? "Four long screws up through the top rails." : "Two long screws up through the back board.", fix: four ? [at({ kind: "screw", len: 55, dia: 5 }, undefined, [0, 1, 0], cols.flatMap((c) => [-cw / 4, cw / 4].map((dx): Vec3 => [cx(c) + dx, bodyH - topR, zr])))] : [at({ kind: "screw", len: 140, dia: 6 }, "bkT", [0, 1, 0], [-xi / 2, xi / 2].map((x): Vec3 => [x, bodyH - 120, zBk]))], tools: ["allen"], pose: "+x" });
  r.step({ title: "Tap in the glides", detail: "Under the two back legs.", fix: [at({ kind: "glide", len: 6, dia: 20 }, undefined, [0, 1, 0], [-1, 1].map((g): Vec3 => [g * xs, 0, zb + P / 2]))], tools: ["hammer"], pose: "+x" });
  r.step({
    title: "Fix it to the wall",
    detail: "Stand it up against the wall. Two screws through the top back board, with plugs made for your wall (not included).",
    fix: [at(WALL_PLUG, undefined, [0, 0, -1], [-1, 1].map((g): Vec3 => [g * (xi - 80), bodyH - 60, zb - 20])), at(WALL_SCREW, undefined, [0, 0, -1], [-1, 1].map((g): Vec3 => [g * (xi - 80), bodyH - 60, zBk + 8]))],
    wall: true,
    pose: "+y",
    tools: ["drill", "pencil", "screwdriver"],
  });
  const ids = comps.map((q) => q.id);
  const rackScrews = four ? 4 : 6;
  r.step({
    title: comps.length > 2 ? "Put the compartments together" : "Put the two compartments together",
    detail: "Click the ends onto the shoe rack, lay it in the front and screw it on. No power drill: the plastic cracks.",
    wait: [...ids.map((i) => `cf${i}`), ...ids.map((i) => `cr${i}`)],
    fix: comps.map((q) => at({ kind: "screw", len: 16, dia: 4 }, `cf${q.id}`, [0, 0, 1], spread(-cw / 2 + 40, cw / 2 - 40, rackScrews / 2).flatMap((dx) => [q.y + 50, q.y + rowH - 50].map((y): Vec3 => [cx(q.c) + dx, y, zf - 21])))),
    tools: ["screwdriver"],
    from: Object.fromEntries(ids.flatMap((i) => [[`cf${i}`, [0, 0, 600] as Vec3], [`cr${i}`, [0, 0, 600] as Vec3]])),
  });
  r.step({ title: "Hang the compartments", detail: "Tilt each one in, hook it over its pivots and swing it up past the stop brackets.", add: ids.flatMap((i) => [`cf${i}`, `cr${i}`]), from: Object.fromEntries(ids.flatMap((i) => [[`cf${i}`, [0, 0, 300] as Vec3], [`cr${i}`, [0, 0, 300] as Vec3]])) });
  const knobX = four ? [0] : [-cw * 0.25, cw * 0.25];
  r.step({ title: "Screw on the knobs", detail: four ? "One on each compartment, the screw from behind." : "Two on each compartment, the screws from behind.", fix: comps.flatMap((q) => [at(D_KNOB, `cf${q.id}`, [0, 0, -1], knobX.map((dx): Vec3 => [cx(q.c) + dx, q.y + rowH - 60, zf])), at(D_KNOB_SCREW, `cf${q.id}`, [0, 0, 1], knobX.map((dx): Vec3 => [cx(q.c) + dx, q.y + rowH - 60, zf - 41]))]), tools: ["screwdriver"] });
  // the drawer of the 2 compartment one comes last
  const made = four ? [] : makeDrawers(b, [{ x: 0, y0: y1 + midR, w: 2 * xi, h: drawerH, zf, zBack: zBk + 30, knobs: 2 }]);
  buildCustom(b, { ...s, custom: r.get() });
  if (made.length) {
    frontDrawers(b, made, { dowels: false, runnerScrews: true });
    drawersIn(b, made, { dowels: false }, "Slide the drawer in", "Set it on the runners and push it in until it clicks.");
  }
}

/* ---------- bathroom vanity with drawers 122 ---------- */

/*
 * Bathroom vanity with drawers 122 x 82: three ladders (left, middle, right), each two posts and two side rails on
 * dowels with long screws, a panel in the grooves, the hanging brackets and the runners screwed on lying down. The
 * middle one is built the same way with cam locks and sits aside. With the left side on a rug the five rails of the left
 * column stand in it; the middle ladder goes on over long dowels and double cam bolts, the five rails of the right
 * column stand on those bolts, then the right side. Three adjustable feet under the front posts, six wall plates (screws
 * not included), then four drawers built on their backs click onto the runners. The basin is sold on its own.
 */
function vanity122(b: PlanBuilder, s: ProductSpec): void {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const r = new Recipe();
  const P = 45;
  const xo = W / 2, xp = xo - P / 2, xi = xo - P;
  const zf = D / 2, zb = -D / 2;
  const zpf = zf - P / 2, zpb = zb + P / 2, zm = (zpf + zpb) / 2;
  const legH = 110, botRail = 50, topRail = 70, midRail = 45;
  const sideD = zpf - zpb - P;
  const ladders = ["L", "M", "R"];
  const gx = (L: string) => (L === "L" ? -1 : L === "R" ? 1 : 0);
  const panelX = (L: string) => (L === "M" ? 0 : gx(L) * (xo - 14));
  for (const L of ladders) {
    const x = gx(L) * xp;
    r.part(`pf${L}`, "Post", [P, H, P], [x, H / 2, zpf], { material: "wood" });
    r.part(`pb${L}`, "Post", [P, H, P], [x, H / 2, zpb], { material: "wood" });
    r.part(`st${L}`, "Side rail", [P - 10, 70, sideD], [x + gx(L) * 5, H - 35, zm], { material: "wood" });
    r.part(`sb${L}`, "Side rail", [P - 10, 70, sideD], [x + gx(L) * 5, legH + 35, zm], { material: "wood" });
    r.part(`sp${L}`, L === "M" ? "Middle panel" : "Side panel", [L === "M" ? 16 : 12, H - legH - 140, sideD + 16], [panelX(L), legH + 70 + (H - legH - 140) / 2, zm]);
  }
  const xmi = P / 2; // the middle posts' faces
  const cw = xi - xmi, ccx = (xi + xmi) / 2;
  const avail = H - topRail - midRail - botRail - legH;
  const h1 = Math.round(avail * 0.42), h2 = avail - h1;
  const zr = zf - 10;
  const railDefs = [
    { k: "rt", name: "Front rail", h: topRail, y: H - topRail / 2, z: zr, t: 20, n: 1, post: "pf", o: 15 },
    { k: "rm", name: "Front rail", h: midRail, y: H - topRail - h1 - midRail / 2, z: zr, t: 20, n: 1, post: "pf", o: 12 },
    { k: "rb", name: "Front rail", h: botRail, y: legH + botRail / 2, z: zr, t: 20, n: 1, post: "pf", o: 12 },
    { k: "bt", name: "Back rail", h: 90, y: H - 45, z: zb + 9, t: 18, n: 1, post: "pb", o: 20 },
    { k: "bb", name: "Back board", h: 160, y: legH + 80, z: zb + 8, t: 16, n: 2, post: "pb", o: 45 },
  ];
  for (const c of [-1, 1]) for (const q of railDefs) r.part(`${q.k}${c < 0 ? "L" : "R"}`, q.name, [cw, q.h, q.t], [c * ccx, q.y, q.z], { material: q.k === "bb" ? "board" : "wood" });

  const ladder = (L: string) => [`pf${L}`, `pb${L}`, `st${L}`, `sb${L}`, `sp${L}`];
  const sx = (L: string) => gx(L) * xp + gx(L) * 5;
  const railDowels = (L: string) => [
    at(D_DOWEL, `st${L}`, [0, 0, -1], [[sx(L), H - 35, zpf - P / 2]], `pf${L}`),
    at(D_DOWEL, `st${L}`, [0, 0, 1], [[sx(L), H - 35, zpb + P / 2]], `pb${L}`),
    at(D_DOWEL, `sb${L}`, [0, 0, -1], [[sx(L), legH + 35, zpf - P / 2]], `pf${L}`),
    at(D_DOWEL, `sb${L}`, [0, 0, 1], [[sx(L), legH + 35, zpb + P / 2]], `pb${L}`),
  ];
  const TOP_SCREW: Fit = { kind: "screw", len: 60, dia: 6 };
  const longScrews = (L: string) => [at(TOP_SCREW, `pf${L}`, [0, 0, -1], [[sx(L), H - 35, zpf + P / 2]], `st${L}`), at(TOP_SCREW, `pf${L}`, [0, 0, -1], [[sx(L), legH + 35, zpf + P / 2]], `sb${L}`)];
  const yDr = [H - topRail - h1, legH + botRail];
  const runLen = Math.round((sideD - 20) / 10) * 10;
  const hangY = [H - 130, legH + 200];
  const RUN: Fit = { kind: "runner", len: runLen, dia: 30 };
  // faces each runner and bracket screws onto: [x, the way in]
  const facesOf = (L: string): [number, number][] => (L === "M" ? [[-8, 1], [8, -1]] : [[gx(L) * (xo - 20), gx(L)]]);
  const bracketFaces = (L: string): [number, number][] => (L === "M" ? [[-xmi, 1]] : [[gx(L) * xi, gx(L)]]);
  const hangers = (L: string) => bracketFaces(L).flatMap(([x, g]) => [
    at({ kind: "angle", len: 70, dia: 50, name: "Hanging bracket" }, `pb${L}`, [g, 0, 0], hangY.map((y): Vec3 => [x, y, zpb])),
    at(D_RUNNER_SCREW, `pb${L}`, [g, 0, 0], hangY.flatMap((y): Vec3[] => [[x, y - 24, zpb], [x, y + 24, zpb]])),
  ]);
  const runners = (L: string) => facesOf(L).flatMap(([x, g]) => [
    at(RUN, `sp${L}`, [g, 0, 0], yDr.map((y): Vec3 => [x, y + 12, zm])),
    at(D_RUNNER_SCREW, `sp${L}`, [g, 0, 0], yDr.flatMap((y): Vec3[] => [[x, y + 12, zm + runLen / 2 - 40], [x, y + 12, zm - runLen / 2 + 40]])),
  ]);
  const ends = (q: (typeof railDefs)[number]) => (q.n === 2 ? [q.y - q.o, q.y + q.o] : [q.y - q.o]);
  const camBolts = (L: string) => railDefs.map((q) => at(CAM_BOLT, `${q.post}${L}`, [gx(L), 0, 0], ends(q).map((y): Vec3 => [gx(L) * xi, y, q.z]), `${q.k}${L}`));
  const dowelsIn = (L: string) => railDefs.map((q) => at(D_DOWEL, `${q.k}${L}`, [-gx(L), 0, 0], [[gx(L) * xi, q.n === 2 ? q.y : q.y + q.o, q.z]], `${q.post}${L}`));
  // cam locks: at the outside end of a rail (g = -1 left, 1 right) or at its middle end (x = the middle post face)
  const camsAt = (c: string, xEnd: number, inward: number) =>
    railDefs.map((q) => at(CAM, `${q.k}${c}`, q.n === 2 || q.k === "bt" ? [0, 0, -1] : [0, -1, 0], ends(q).map((y): Vec3 => [xEnd + inward * 26, q.n === 2 || q.k === "bt" ? y : q.y + q.h / 2, q.n === 2 ? q.z + 8 : q.k === "bt" ? q.z + 9 : q.z])));
  const ROD: Fit = { kind: "connector", len: 80, dia: 8, name: "Double cam bolt" };
  const LONG_D: Fit = { kind: "dowel", len: 70, dia: 8 };

  r.step({
    title: "Join the side rails to the posts",
    detail: "Do both sides on a rug. Tap the dowels into the rails, push them into the front post, slide the panel into the grooves, then push the back post on and drive the two long screws.",
    add: ladder("L"),
    fix: [...railDowels("L"), ...longScrews("L")],
    from: { pfL: [0, 0, 260], stL: [0, 0, -260], sbL: [0, 0, -260], spL: [0, 0, -320], pbL: [0, 0, -380] },
    tools: ["hammer", "allen"],
    pose: "+x",
    repeat: 2,
    warnings: ["floor"],
  });
  r.step({ title: "Screw the hanging brackets to the back posts", detail: "Two on each side, on the inside.", fix: hangers("L"), tools: ["screwdriver"], pose: "+x", repeat: 2 });
  r.step({ title: "Screw the runners onto the sides", detail: "Two on each side, the ones marked for that side, two screws in each.", fix: runners("L"), tools: ["screwdriver"], pose: "+x", repeat: 2 });
  r.step({ title: "Screw in the cam bolts", detail: "Six in each side, into the inside faces of the posts, by hand.", fix: camBolts("L"), tools: ["screwdriver"], pose: "+x", repeat: 2 });
  // the middle ladder, built beside the left side
  const midAway: Vec3 = [800, 0, 0];
  const midBolts = [at(CAM_BOLT, "pfM", [0, 0, 1], [[0, H - 50, zpf - P / 2], [0, legH + 50, zpf - P / 2]], "stM"), at(CAM_BOLT, "pbM", [0, 0, -1], [[0, H - 50, zpb + P / 2], [0, legH + 50, zpb + P / 2]], "stM"), at(CAM_BOLT, "pfM", [0, 0, 1], [[0, (H + legH) / 2, zpf - P / 2]]), at(CAM_BOLT, "pbM", [0, 0, -1], [[0, (H + legH) / 2, zpb + P / 2]])];
  r.step({ title: "Build the middle ladder", detail: "On the rug beside it: cam bolts into the posts, dowels into the rails, push them together and slide the panel in.", wait: ladder("M"), fix: [...midBolts, ...railDowels("M").map((f) => ({ ...f, at: f.at!.map((p): Vec3 => [0, p[1] + 20, p[2]]) }))], tools: ["screwdriver", "hammer"], pose: "+x", from: Object.fromEntries(ladder("M").map((id) => [id, midAway])) });
  r.step({ title: "Lock the middle ladder", detail: "Six cam locks, then the runners on both faces, the brackets and the two long screws.", fix: [at(CAM, "stM", [1, 0, 0], [[0, H - 50, zpf - P - 26], [0, H - 50, zpb + P + 26], [0, legH + 50, zpf - P - 26], [0, legH + 50, zpb + P + 26]].map((p): Vec3 => [-((P - 10) / 2), p[1], p[2]])), at(CAM, "spM", [1, 0, 0], [[-8, (H + legH) / 2, zpf - P - 26], [-8, (H + legH) / 2, zpb + P + 26]]), ...runners("M"), ...hangers("M"), ...longScrews("M").map((f) => ({ ...f, at: f.at!.map((p): Vec3 => [0, p[1], p[2]]) }))], tools: ["screwdriver", "allen"], pose: "+x" });
  r.step({ title: "Stand the left rails in", detail: "It stays on the rug. A dowel in each rail end, then push them into the left side: three at the front, the rail and the board at the back.", add: railDefs.map((q) => `${q.k}L`), fix: dowelsIn("L"), tools: ["hammer"], pose: "+x" });
  r.step({ title: "Lock the cam locks", detail: "Six of them. Arrow towards the bolt, then a clockwise turn.", fix: camsAt("L", -xi, 1), tools: ["screwdriver"], pose: "+x" });
  r.step({
    title: "Lower the middle ladder on",
    detail: "A long dowel and a double cam bolt in the top end of each rail, lock the bolts, then press the middle ladder down over them.",
    add: ladder("M"),
    fix: [
      ...railDefs.map((q) => at(LONG_D, `${q.k}L`, [-1, 0, 0], [[-xmi, q.n === 2 ? q.y : q.y + q.o, q.z]], `pb${"M"}`.replace("pb", q.post))),
      at(ROD, undefined, [-1, 0, 0], railDefs.flatMap((q) => ends(q).map((y): Vec3 => [0, y, q.z]))),
      ...camsAt("L", -xmi, -1),
    ],
    tools: ["hammer", "screwdriver"],
    pose: "+x",
  });
  r.step({ title: "Stand the right rails in", detail: "Onto the bolts sticking out of the middle ladder.", add: railDefs.map((q) => `${q.k}R`), fix: camsAt("R", xmi, 1), tools: ["screwdriver"], pose: "+x", from: Object.fromEntries(railDefs.map((q) => [`${q.k}R`, [400, 0, 0] as Vec3])) });
  r.step({
    title: "Lower the right side on",
    detail: "It has its rails, brackets, runners and bolts like the left one. Dowels in the free rail ends, then press it on evenly.",
    add: ladder("R"),
    fix: [...railDowels("R"), ...longScrews("R"), ...hangers("R"), ...runners("R"), ...camBolts("R"), ...dowelsIn("R")],
    tools: ["hammer"],
    pose: "+x",
  });
  r.step({ title: "Lock the cam locks on this side", detail: "Six again, arrow towards the bolt.", fix: camsAt("R", xi, -1), tools: ["screwdriver"], pose: "+x" });
  r.step({ title: "Screw in the feet", detail: "The three adjustable feet go into the bottom of the front posts.", fix: ladders.map((L) => at({ kind: "foot", len: 30, dia: 30 }, `pf${L}`, [0, 1, 0], [[gx(L) * xp, 0, zpf]])), pose: "+x", kind: "legs" });
  const plateAt = ladders.flatMap((L) => bracketFaces(L).flatMap(([x, g]) => hangY.map((y): Vec3 => [x - g * 20, y, zb - 2])));
  r.step({
    title: "Hang it on the wall",
    detail: "Two people stand it up. Mark the brackets on the wall, screw the six wall plates on level (screws and plugs for your wall, not included), hang it on and set the feet down to the floor.",
    fix: [at({ kind: "bracket", len: 40, dia: 30, name: "Wall plate" }, undefined, [0, 0, -1], plateAt), at(WALL_PLUG, undefined, [0, 0, -1], plateAt.map((p): Vec3 => [p[0], p[1], p[2] - 20])), at(WALL_SCREW, undefined, [0, 0, -1], plateAt.map((p): Vec3 => [p[0], p[1] + 10, p[2] + 6]))],
    wall: true,
    people: 2,
    pose: "+y",
    tools: ["drill", "screwdriver", "level", "pencil"],
    warnings: ["two", "wall", "tip"],
  });
  buildCustom(b, { ...s, custom: r.get() });

  const list: BoardBox[] = [];
  for (const c of [-1, 1]) list.push({ x: c * ccx, y0: yDr[0], w: cw, h: h1, zf, zBack: zb + 40 });
  for (const c of [-1, 1]) list.push({ x: c * ccx, y0: yDr[1], w: cw, h: h2, zf, zBack: zb + 30 });
  boardDrawers(b, list);
}

/* ---------- drawers built on their backs (vanity), as hemnes.ts builds the wash-stand ones ---------- */

interface BoardBox {
  x: number;
  y0: number;
  w: number;
  h: number;
  zf: number;
  zBack: number;
}
const B_SCREW: HwDef = { kind: "screw", len: 13, dia: 3.5 };

/**
 * The vanity drawers: cam bolts into the back, the sides stand on it on dowels and are locked, the bottom slides in,
 * the front goes on with dowels and cam locks, two L plates hold the bottom, then the knob. The small ones are shown
 * once, then the big ones, and all four click onto the runners.
 */
function boardDrawers(b: PlanBuilder, list: BoardBox[]) {
  const bt = 20, bs = 16;
  const made = list.map((box) => {
    const fw = box.w - 4, fh = box.h - 4;
    const dd = Math.round((box.zf - box.zBack) / 10) * 10;
    const xs = box.w / 2 - 14 - bs / 2;
    const sh = Math.max(80, fh - 40);
    const ys = box.y0 + 20;
    const zc = box.zf - dd / 2;
    const front = b.place(b.part("Drawer front", [fw, fh, bt]), [box.x, box.y0 + 2 + fh / 2, box.zf - bt / 2]);
    const sdT = b.part("Drawer side", [bs, sh, dd - bt - bs]);
    const sides = [-1, 1].map((g) => b.place(sdT, [box.x + g * xs, ys + sh / 2, zc]));
    const back = b.place(b.part("Drawer back", [2 * xs + bs, sh, bs]), [box.x, ys + sh / 2, box.zf - dd + bs / 2]);
    const bottom = b.place(b.part("Drawer bottom", [2 * xs - bs, 12, dd - bt - bs]), [box.x, ys + 6, zc]);
    return { box, front, sides, back, bottom, xs, sh, ys, dd, zc };
  });
  type M = (typeof made)[number];
  const fitsOf = (d: M) => {
    const { box, xs, sh, ys, dd } = d;
    const zB = box.zf - dd + bs;
    const zF = box.zf - bt;
    const per = (fn: (g: -1 | 1, k: string) => FitOpts[]) => [...fn(-1, d.sides[0]), ...fn(1, d.sides[1])];
    return {
      bolts: per((g, k) => [ys + 25, ys + sh - 25].map((y): FitOpts => ({ on: d.back, at: [box.x + g * xs, y, zB], dir: [0, 0, -1], mate: k, mateHole: 4 }))),
      dowels: per((g, k) => [{ on: k, at: [box.x + g * xs, ys + sh * 0.5, zB], dir: [0, 0, 1], mate: d.back }, { on: k, at: [box.x + g * xs, ys + sh * 0.8, zB], dir: [0, 0, 1], mate: d.back }] as FitOpts[]).concat(
        per((g, k) => [ys + sh * 0.3, ys + sh * 0.7].map((y): FitOpts => ({ on: k, at: [box.x + g * xs, y, zF], dir: [0, 0, -1], mate: d.front }))),
      ),
      cams: per((g, k) => [ys + 25, ys + sh - 25].map((y): FitOpts => ({ on: k, at: [box.x + g * (xs - bs / 2), y, zB + 28], dir: [g, 0, 0] }))),
      frontBolts: per((g, k) => [{ on: d.front, at: [box.x + g * xs, ys + sh / 2, zF], dir: [0, 0, 1], mate: k, mateHole: 4 }]),
      frontCams: per((g, k) => [{ on: k, at: [box.x + g * (xs - bs / 2), ys + sh / 2, zF - 28], dir: [g, 0, 0] }]),
      plates: [{ on: d.bottom, at: [box.x, ys + 12, zB + 10], dir: [0, -1, 0], hole: false }, { on: d.bottom, at: [box.x, ys + 12, zF - 10], dir: [0, -1, 0], hole: false }] as FitOpts[],
      plateScrews: [{ on: d.bottom, at: [box.x, ys + 12, zB + 18], dir: [0, -1, 0] }, { on: d.back, at: [box.x, ys + 20, zB], dir: [0, 0, -1] }, { on: d.bottom, at: [box.x, ys + 12, zF - 18], dir: [0, -1, 0] }, { on: d.front, at: [box.x, ys + 20, zF], dir: [0, 0, 1] }] as FitOpts[],
      knobs: [{ on: d.front, at: [box.x, box.y0 + box.h / 2, box.zf], dir: [0, 0, -1], hole: false }] as FitOpts[],
      knobScrews: [{ on: d.front, at: [box.x, box.y0 + box.h / 2, zF - 2], dir: [0, 0, 1] }] as FitOpts[],
    };
  };
  const PLATE: HwDef = { kind: "angle", len: 30, dia: 20 };
  const groups = [made.slice(0, 2), made.slice(2)];
  for (const [gi, group] of groups.entries()) {
    const d0 = group[0];
    const f0 = fitsOf(d0);
    const c0: Vec3 = [d0.box.x, d0.ys + d0.sh / 2, d0.zc];
    const scene = `drawer${gi}`;
    const stage = (k: string, from?: Vec3) => {
      const it = b.partItem(k);
      b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
    };
    const size = gi ? "big" : "small";
    const dstep = (title: string, detail: string, body: () => void, x: { tools?: ToolId[]; kind?: StepKind; pose?: Pose } = {}) =>
      bstep(b, { title, detail, tools: x.tools, scene, pose: x.pose ?? "+z", repeat: group.length, kind: x.kind ?? "drawer" }, body);
    dstep(`Screw the cam bolts into a ${size} drawer back`, "Lay it flat on a rug, inside face up. By hand until they stop.", () => {
      stage(d0.back, [0, 0, -160]);
      b.then(0.15);
      b.fits(D_BOLT, f0.bolts, 0.08);
    }, { tools: ["screwdriver"], kind: "cams" });
    dstep("Stand the sides on the back", "Tap the dowels into the sides first, then push them onto the dowels and bolts.", () => {
      b.fits(D_DOWEL, f0.dowels.filter((x) => x.mate === d0.back), 0.08);
      b.then(0.15);
      for (const k of d0.sides) stage(k, [0, 0, 260]);
    }, { tools: ["hammer"], kind: "dowels" });
    dstep("Lock the cam locks", "Arrow towards the bolt, then a clockwise turn.", () => b.fits(D_CAM, f0.cams, 0.1), { tools: ["screwdriver"], kind: "cams" });
    dstep("Slide in the drawer bottom", "It runs down the grooves in the sides until it meets the back.", () => stage(d0.bottom, [0, 0, 380]));
    dstep("Put the front on", "Cam bolts into the front and dowels into the sides, then press it on and lock both cam locks.", () => {
      b.fits(D_BOLT, f0.frontBolts, 0.1);
      b.fits(D_DOWEL, f0.dowels.filter((x) => x.mate === d0.front), 0.08);
      b.then(0.15);
      stage(d0.front, [0, 0, 260]);
      b.then(0.1);
      b.fits(D_CAM, f0.frontCams, 0.12);
    }, { tools: ["hammer", "screwdriver"], kind: "join" });
    dstep("Screw the L plates under the bottom", "Turn it over. They hold the bottom to the front and the back.", () => {
      b.fits(PLATE, f0.plates, 0.12);
      b.then(0.05);
      b.fits(B_SCREW, f0.plateScrews, 0.1);
    }, { tools: ["screwdriver"], kind: "screws", pose: "-y" });
    dstep("Screw on the knob", "The screw goes in from inside the drawer.", () => {
      b.fits(D_KNOB, f0.knobs, 0.2);
      b.then(0.05);
      b.fits(D_KNOB_SCREW, f0.knobScrews, 0.15);
    }, { tools: ["screwdriver"], kind: "screws", pose: "+y" });
  }
  bstep(b, { title: "Click the drawers onto the runners", detail: "Pull the runners out, set each drawer on them and push it back until both clips click.", kind: "drawer" }, () => {
    for (const [i, d] of made.entries()) {
      b.stagger(0);
      for (const k of [d.back, ...d.sides, d.bottom, d.front]) b.add(k, [0, 0, 520]);
      if (i % 2 === 1) {
        const f = fitsOf(d);
        const all: [HwDef, FitOpts[]][] = [[D_BOLT, [...f.bolts, ...f.frontBolts]], [D_DOWEL, f.dowels], [D_CAM, [...f.cams, ...f.frontCams]], [PLATE, f.plates], [B_SCREW, f.plateScrews], [D_KNOB, f.knobs], [D_KNOB_SCREW, f.knobScrews]];
        for (const [def, l] of all) for (const x of l) b.preset(def, x);
      }
      b.wait(0.22);
    }
  });
}

/** HEMNES guides drawn in this file; returns false for any product it doesn't build. Wired in from hemnes.ts. */
export function hemnesStorage(b: PlanBuilder, s: ProductSpec): boolean {
  switch (s.slug) {
    case "hemnes-mirror-cabinet-2-doors-120-x-98":
      buildCustom(b, { ...s, custom: mirror120() });
      return true;
    case "hemnes-sideboard-157-x-88":
      sideboard(b);
      return true;
    case "hemnes-shoe-cabinet-2-compartments":
    case "hemnes-shoe-cabinet-4-compartments":
      shoeCabinet(b, s);
      return true;
    case "hemnes-bathroom-vanity-drawers-122-x-82":
      vanity122(b, s);
      return true;
  }
  return false;
}
const spec = (b: PlanBuilder) => b.spec;
