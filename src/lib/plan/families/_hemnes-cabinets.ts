import type { CustomFix, CustomParams, CustomPart, CustomStep, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef } from "../builder";
import { rotate } from "../math";
import { buildCustom } from "../custom";

/*
 * HEMNES cabinets read from IKEA's manuals: the 49 wide bookcase, the 6-drawer chest (sold in the US as a dresser,
 * 108 x 131) and the glass-door cabinet with 3 drawers. The glass-door cabinet without drawers and the 120 wide
 * wardrobe aren't sold any more under those names, so they keep their old guides.
 *
 * Bookcase 49 x 197: the same build as the 90 wide one. Both ready-made side frames lie on a rug for their cam bolts,
 * side rails and adjustable feet; the left one stays down while the plinths, top rails and fixed shelf stand in it,
 * the right one goes on top, then the top is screwed on, two back panels (upper and lower) slide into the grooves and
 * are clipped, it is fixed to the wall with two L brackets and gets its shelves.
 *
 * Chest of 6 drawers: the post-and-panel chest (posts, side panels, spacer boards carrying the runners), with two small
 * drawers on top either side of a short divider. Two L brackets under the top fix it to the wall.
 *
 * Glass-door cabinet with 3 drawers: the drawers are built first, then two side frames take their bottom rails, feet,
 * runner bars, cam bolts, hinge plates and runners on a rug. The fixed shelf and six rails stand in the left side, the
 * right side goes on top, the top is screwed on, the two back panels slide in and are clipped, it is fixed to the
 * wall, and the doors, shelves and drawers go in.
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
const ADJ_FOOT: HwDef = { kind: "foot", len: 30, dia: 32 };
const RUNNER_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const DRAWER_RUNNER_SCREW: HwDef = { kind: "screw", len: 10, dia: 4 };
const TOP_SCREW: HwDef = { kind: "screw", len: 60, dia: 6 };
const BAR_SCREW: HwDef = { kind: "screw", len: 35, dia: 6 };
const DIVIDER_SCREW: HwDef = { kind: "screw", len: 70, dia: 6 };
const NAIL: HwDef = HW.nail;
const RING_NAIL: HwDef = { kind: "nail", len: 34, dia: 2.5 };
const SUPPORT_SCREW: HwDef = { kind: "screw", len: 13, dia: 3.5 };
const SMALL_SCREW: HwDef = { kind: "screw", len: 12, dia: 3.5 };
const KNOB_SCREW: HwDef = { kind: "screw", len: 32, dia: 4 };
const KNOB: HwDef = HW.knob;
const WASHER: HwDef = HW.washer;
const BRACKET: HwDef = { kind: "angle", len: 80, dia: 40 };
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

/* ---------- drawers, built on their fronts ---------- */

interface DrawerBox {
  x: number; // centre
  y0: number; // bottom of the opening
  w: number; // opening width
  h: number; // opening height
  zf: number; // front face of the front
  zBack: number; // how far back the box may go
  knobs: 1 | 2;
  dowels?: 1 | 2; // per side, into the front
  bolts?: 1 | 2; // cam bolts per side
  nails?: number; // ring nails per side into the back
}
interface Drawer {
  box: DrawerBox;
  front: string;
  sides: [string, string];
  bottom: string;
  back: string;
  support?: string;
  ys: number;
  sh: number;
  xs: number;
  dd: number;
}

/**
 * Each distinct size is shown being built once (with "do this for each"). Returns the step that slides every drawer
 * in, so a manual that builds the drawers first can slide them in at the end.
 */
function drawers(b: PlanBuilder, list: DrawerBox[], o: { support?: boolean } = {}): () => void {
  if (!list.length) return () => {};
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
    if (o.support && box.w > 700) d.support = b.place(b.part("Bottom support rail", [24, 10, dd - 20], { material: "metal" }), [box.x, ys + 3.5, zd]);
    return d;
  });

  const fitsOf = (d: Drawer) => {
    const { box, xs, ys, sh, dd } = d;
    const zIn = box.zf - ft; // back face of the front
    const per = <T>(fn: (g: -1 | 1, side: string) => T[]) => [...fn(-1, d.sides[0]), ...fn(1, d.sides[1])];
    const zBk = zIn - dd + st / 2;
    const nn = box.nails ?? (box.h > 260 ? 3 : 2);
    const nails = nn === 3 ? [0.2, 0.5, 0.8] : spread(0.3, 0.7, nn);
    const dowelYs = box.dowels === 1 ? [ys + sh * 0.5] : [ys + sh * 0.35, ys + sh * 0.65];
    const boltYs = box.bolts === 1 ? [ys + sh * 0.5 + 18] : [ys + 20, ys + sh - 20];
    const kx = box.knobs === 2 ? [box.x - box.w * 0.27, box.x + box.w * 0.27] : [box.x];
    const ky = box.y0 + box.h / 2;
    const runLen = dd - 20;
    return {
      dowels: per((g, sd) => dowelYs.map((y): FitOpts => ({ on: sd, at: [box.x + g * xs, y, zIn], dir: [0, 0, -1], mate: d.front }))),
      bolts: per((g, sd) => boltYs.map((y): FitOpts => ({ on: d.front, at: [box.x + g * xs, y, zIn], dir: [0, 0, 1], mate: sd, mateHole: 4 }))),
      cams: per((g, sd) => boltYs.map((y): FitOpts => ({ on: sd, at: [box.x + g * (xs - st / 2), y, zIn - 28], dir: [g, 0, 0] }))),
      nails: per((g, sd) => nails.map((k): FitOpts => ({ on: sd, at: [box.x + g * (xs + st / 2), ys + 16 + (sh - 16) * k, zBk], dir: [-g, 0, 0], mate: d.back }))),
      support: d.support
        ? [zIn - 30, zIn - dd + 30].map((z): FitOpts => ({ on: d.support!, at: [box.x, ys - 1.5, z], dir: [0, 1, 0], mate: d.bottom }))
        : [],
      runners: per((g, sd) => [{ on: sd, at: [box.x + g * xs, ys, zIn - 10 - runLen / 2], dir: [0, 1, 0], hole: false } as FitOpts]),
      runnerScrews: per((g, sd) => [zIn - 40, zIn - runLen + 20].map((z): FitOpts => ({ on: sd, at: [box.x + g * xs, ys - 2, z], dir: [0, 1, 0] }))),
      knobScrews: kx.map((x): FitOpts => ({ on: d.front, at: [x, ky, zIn - 4], dir: [0, 0, 1], mate: d.front })),
      knobs: kx.map((x): FitOpts => ({ on: d.front, at: [x, ky, box.zf], dir: [0, 0, -1], hole: false })),
      runLen,
    };
  };

  const kinds = new Map<string, Drawer[]>();
  for (const d of made) {
    const k = `${Math.round(d.box.w)}x${Math.round(d.box.h)}`;
    kinds.set(k, [...(kinds.get(k) ?? []), d]);
  }
  const shown = [...kinds.values()].map((g) => g[0]);
  const n = made.length;
  const rep = n > 1 ? n : undefined;
  const c0 = (d: Drawer): Vec3 => [d.box.x, d.ys + d.sh / 2, d.box.zf - ft - d.dd / 2];
  const keysOf = (d: Drawer) => [d.front, ...d.sides, d.bottom, d.back, ...(d.support ? [d.support] : [])];
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
  const oneDowel = shown.some((d) => d.box.dowels === 1);

  dstep(
    "Tap the dowels into the drawer sides",
    oneDowel ? "Into the front end of each side: one on the small drawers, two on the others. The grooves for the bottom face in and down." : "Two in the front end of each side. The grooves for the bottom face in and down.",
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
    shown.some((d) => d.box.bolts === 1) ? "Lay the front face down on a rug. Two in the small front, four in the others, by hand until they stop." : "Lay the front face down on a rug. Screw the bolts in by hand until they stop.",
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
  const deep = shown.filter((d) => (d.box.nails ?? (d.box.h > 260 ? 3 : 2)) === 3).length;
  dstep(
    "Tap on the drawer back",
    deep && deep < shown.length ? "It sits on the drawer bottom. Ring nails through each side into it: three each side on the deep drawer, two on the others." : "It sits on the drawer bottom. Tap the ring nails through the sides into it.",
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
  dstep(
    "Fit the runners on the drawer",
    "Left and right runners are marked. Press each onto the bottom edge of its side, then two screws.",
    () => {
      each((_, i) => b.fits(runnerDef(fs[i].runLen), fs[i].runners, 0.25));
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

  return () =>
    step(
      b,
      {
        title: n > 2 ? `Slide in all ${n} drawers` : n === 2 ? "Slide in both drawers" : "Slide in the drawer",
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
              [runnerDef(f.runLen), f.runners],
              [DRAWER_RUNNER_SCREW, f.runnerScrews],
              [KNOB, f.knobs],
              [KNOB_SCREW, f.knobScrews],
            ];
            for (const [def, l] of all) for (const x of l) b.preset(def, x);
          }
          b.wait(0.22);
        }
      },
    );
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

/* ---------- bookcase 49 x 197 ---------- */

function bookcase49(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const r = new Recipe();
  const topT = 22, P = 45, ov = 10;
  const postH = H - topT;
  const xo = W / 2 - ov, xp = xo - P / 2, xi = xo - P;
  const zf = D / 2 - ov, zb = -D / 2 + 3;
  const zpf = zf - P / 2, zpb = zb + P / 2, zm = (zpf + zpb) / 2;
  const legH = 70, plinth = 80, topRail = 60, midY = Math.round(H * 0.5), midRail = 60;
  const sideD = zpf - zpb - P;
  for (const g of [-1, 1]) {
    const L = g < 0 ? "L" : "R";
    r.part(`pf${L}`, "Corner post", [P, postH, P], [g * xp, postH / 2, zpf], { material: "wood" });
    r.part(`pb${L}`, "Corner post", [P, postH, P], [g * xp, postH / 2, zpb], { material: "wood" });
    const lowH = midY - midRail / 2 - (legH + plinth);
    const upH = postH - (midY + midRail / 2);
    r.part(`lo${L}`, "Lower side panel", [16, lowH, sideD + 16], [g * (xo - 16), legH + plinth + lowH / 2, zm]);
    r.part(`up${L}`, "Upper side panel", [16, upH, sideD + 16], [g * (xo - 16), midY + midRail / 2 + upH / 2, zm]);
    r.part(`sr${L}`, "Side rail", [P - 10, midRail, sideD], [g * (xo - P / 2 - 5), midY, zm], { material: "wood" });
    r.part(`br${L}`, "Side rail", [P - 10, plinth, sideD], [g * (xo - P / 2 - 5), legH + plinth / 2, zm], { material: "wood" });
  }
  const zr = zf - 10, zbr = zb + 10;
  r.part("fp", "Plinth", [2 * xi, plinth, 20], [0, legH + plinth / 2, zr], { material: "wood" });
  r.part("bp", "Back plinth", [2 * xi, plinth, 20], [0, legH + plinth / 2, zbr], { material: "wood" });
  r.part("ft", "Top rail", [2 * xi, topRail, 20], [0, postH - topRail / 2, zr], { material: "wood" });
  r.part("bt", "Top rail", [2 * xi, topRail, 20], [0, postH - topRail / 2, zbr], { material: "wood" });
  // in front of the back panels, which run behind it from the plinth to the top rail
  r.part("fx", "Fixed shelf", [2 * xi, 20, zf - zb - 26], [0, midY, (zf + zb + 26) / 2]);
  r.part("top", "Top", [W, topT, D], [0, H - topT / 2, 0], { material: "wood" });
  // two back panels, one below the fixed shelf and one above it
  const bkLo = legH + plinth, bkHi = postH - topRail;
  r.part("bk1", "Back panel", [2 * xi, bkHi - midY, 4], [0, (midY + bkHi) / 2, zb + 24], { material: "wood" });
  r.part("bk2", "Back panel", [2 * xi, midY - bkLo, 4], [0, (bkLo + midY) / 2, zb + 24], { material: "wood" });
  r.part("bs", "Bottom shelf", [2 * xi, 18, zf - zb - 50], [0, legH + plinth + 9, (zf + zb) / 2 + 6]);
  const lowSpan = midY - 10 - (legH + plinth + 18), upSpan = postH - topRail - (midY + 10);
  const shelfYs = [legH + plinth + 18 + lowSpan / 3, legH + plinth + 18 + (2 * lowSpan) / 3, midY + 10 + upSpan / 3, midY + 10 + (2 * upSpan) / 3].map(Math.round);
  shelfYs.forEach((y, i) => r.part(`sh${i}`, "Shelf", [2 * xi - 4, 18, zf - zb - 50], [0, y, (zf + zb) / 2 + 6]));

  const side = (L: string) => [`pf${L}`, `pb${L}`, `lo${L}`, `up${L}`];
  const g = (L: string) => (L === "L" ? -1 : 1);
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
  // one long screw holds the middle side rail, two the bottom one
  const railScrews = (L: string) => [
    at("screw", `pf${L}`, [0, 0, -1], [[sx(L), midY, zpf + P / 2]], `sr${L}`, sized(TOP_SCREW)),
    at("screw", `pf${L}`, [0, 0, -1], [[sx(L), legH + plinth / 2, zpf + P / 2]], `br${L}`, sized(TOP_SCREW)),
    at("screw", `pb${L}`, [0, 0, 1], [[sx(L), legH + plinth / 2, zpb - P / 2]], `br${L}`, sized(TOP_SCREW)),
  ];
  const feet = (L: string) => [at("foot", `pf${L}`, [0, 1, 0], [[g(L) * xp, 0, zpf]]), at("foot", `pb${L}`, [0, 1, 0], [[g(L) * xp, 0, zpb]])];

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
  r.step({ title: "Tap dowels into the side rails", detail: "Three in each: one in each end and one in the top edge for the fixed shelf.", repeat: 2, fix: railEnds("L"), tools: ["hammer"], pose: "+x" });
  r.step({
    title: "Screw the side rails between the posts",
    detail: "One in the middle of each side, one at the bottom. One long screw holds the middle rail and two the bottom one, with the Allen key.",
    add: ["srL", "brL"],
    repeat: 2,
    fix: railScrews("L"),
    tools: ["allen"],
    pose: "+x",
  });
  r.step({ title: "Screw the adjustable feet into the posts", detail: "Into the bottom end of each post, by hand. You level them once it stands.", repeat: 2, fix: feet("L"), pose: "+x" });
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
      at("camScrew", "srL", [1, 0, 0], [[-xi, midY, zm - 60], [-xi, midY, zm + 60]], undefined, { len: 34 }),
      at("camScrew", "srR", [-1, 0, 0], [[xi, midY, zm - 60], [xi, midY, zm + 60]], undefined, { len: 34 }),
      at("cam", "fx", [0, -1, 0], [[-xi + 26, midY + 10, zm - 60], [-xi + 26, midY + 10, zm + 60]], undefined, { dia: 15 }),
    ],
    tools: ["screwdriver"],
    pose: "+x",
  });
  r.step({
    title: "Lower the right side on",
    detail: "It has its bolts, rails and feet on like the left one. Tap a dowel into each free rail end, then two people press it down evenly.",
    add: [...side("R"), "srR", "brR"],
    from: Object.fromEntries([...side("R"), "srR", "brR"].map((k) => [k, [360, 0, 0] as Vec3])),
    fix: [...postBolts("R"), ...railDowels("R", ["fp", "bp", "ft", "bt"]), ...railEnds("R"), ...railScrews("R"), ...feet("R")],
    tools: ["hammer"],
    people: 2,
    pose: "+x",
  });
  r.step({
    title: "Lock the cam locks on this side",
    detail: "Four in the rails and two in the fixed shelf.",
    fix: [...railCams("R", ["fp", "bp", "ft", "bt"]), at("cam", "fx", [0, -1, 0], [[xi - 26, midY + 10, zm - 60], [xi - 26, midY + 10, zm + 60]], undefined, { dia: 15 })],
    tools: ["screwdriver"],
    pose: "+x",
  });
  r.step({
    title: "Turn it onto its back and fit the top",
    detail: "Two people. Tap two dowels into the top rails, push the top on, then five long screws up through the rails.",
    add: ["top"],
    fix: [
      at("dowel", "ft", [0, -1, 0], [[-xi / 2, postH, zr]], "top", sized(DOWEL)),
      at("dowel", "bt", [0, -1, 0], [[xi / 2, postH, zbr]], "top", sized(DOWEL)),
      at("screw", "ft", [0, 1, 0], spread(-xi + 50, xi - 50, 3).map((x): Vec3 => [x, postH - topRail, zr]), "top", sized(TOP_SCREW)),
      at("screw", "bt", [0, 1, 0], spread(-xi + 80, xi - 80, 2).map((x): Vec3 => [x, postH - topRail, zbr]), "top", sized(TOP_SCREW)),
    ],
    tools: ["hammer", "allen"],
    people: 2,
    pose: "+z",
  });
  r.step({
    title: "Slide in the back panels",
    detail: "Turn it onto its front. Two people: one panel slides down the grooves into the upper part, the other into the lower part, meeting behind the fixed shelf.",
    add: ["bk1", "bk2"],
    people: 2,
    pose: "-z",
    from: { bk1: [0, 0, -300], bk2: [0, 0, -300] },
  });
  r.step({
    title: "Clip the back panels in place",
    detail: "Six clips: two to the fixed shelf, two to the top rail and two to the plinth. A screw in each.",
    fix: [
      at("clip", "fx", [0, 1, 0], spread(-xi + 80, xi - 80, 2).map((x): Vec3 => [x, midY - 10, zb + 34]), undefined, { len: 12, dia: 20 }),
      at("clip", "bt", [0, 0, -1], spread(-xi + 80, xi - 80, 2).map((x): Vec3 => [x, postH - topRail + 12, zb + 20]), undefined, { len: 12, dia: 20 }),
      at("clip", "bp", [0, 0, -1], spread(-xi + 80, xi - 80, 2).map((x): Vec3 => [x, legH + plinth - 12, zb + 20]), undefined, { len: 12, dia: 20 }),
      at("screw", "fx", [0, 1, 0], spread(-xi + 80, xi - 80, 2).map((x): Vec3 => [x, midY - 10, zb + 34]), undefined, sized(SMALL_SCREW)),
      at("screw", "bt", [0, 0, -1], spread(-xi + 80, xi - 80, 2).map((x): Vec3 => [x, postH - topRail + 12, zb + 20]), undefined, sized(SMALL_SCREW)),
      at("screw", "bp", [0, 0, -1], spread(-xi + 80, xi - 80, 2).map((x): Vec3 => [x, legH + plinth - 12, zb + 20]), undefined, sized(SMALL_SCREW)),
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
      at("screw", "bt", [0, -1, 0], [[-xi / 2, H + 2, zb + 30], [xi / 2, H + 2, zb + 30]], undefined, sized(SMALL_SCREW)),
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
    fix: [
      at("pin", "pfL", [-1, 0, 0], [[-xi, legH + plinth - 4, zpf - 30]], undefined, { len: 10, dia: 8 }),
      at("pin", "pbL", [-1, 0, 0], [[-xi, legH + plinth - 4, zpb + 30]], undefined, { len: 10, dia: 8 }),
      at("pin", "pfR", [1, 0, 0], [[xi, legH + plinth - 4, zpf - 30]], undefined, { len: 10, dia: 8 }),
      at("pin", "pbR", [1, 0, 0], [[xi, legH + plinth - 4, zpb + 30]], undefined, { len: 10, dia: 8 }),
    ],
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

/** The two L brackets under the top: drilled, plugged and screwed to the wall once it stands. */
function wallBrackets(b: PlanBuilder, o: { xs: number[]; y: number; z: number }) {
  step(b, { title: "Mark the wall", detail: "Push it against the wall where it will stand and mark through the slot of each bracket.", tools: ["pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] });
  step(
    b,
    { title: "Screw the brackets to the wall", detail: "Move it away, drill and push in the plugs, push it back and screw through each bracket with a washer. The plugs suit solid walls; use fixings made for yours if it's different.", tools: ["drill", "screwdriver"], kind: "anchor", wall: true, warnings: ["wall", "tip"] },
    () => {
      b.fits({ kind: "plug", len: 40, dia: 8, notIncluded: false }, o.xs.map((x): FitOpts => ({ at: [x, o.y - 20, o.z - 1], dir: [0, 0, -1] })), 0.12);
      b.then(0.1);
      b.fits(WASHER, o.xs.map((x): FitOpts => ({ at: [x, o.y - 20, o.z + 3], dir: [0, 0, -1], hole: false })), 0.1);
      b.fits({ kind: "screw", len: 50, dia: 5 }, o.xs.map((x): FitOpts => ({ at: [x, o.y - 20, o.z + 4], dir: [0, 0, -1] })), 0.12);
    },
  );
}

/* ---------- chest of 6 drawers ---------- */

/*
 * The 108 x 131 chest: two small drawers at the top either side of a short divider, a deep drawer below them and
 * three more. Each side is two posts with a panel between them (dowels, cam bolts, cam locks), a spacer board on the
 * inside carrying five runners. The left side lies on a rug, the rails stand in it on dowels and cam bolts, the divider
 * goes in, the right side goes on top. The top takes two L brackets and its cam bolts upside down, goes on with dowels,
 * screws and cam locks, and the two hardboard backs are riveted together and nailed on with the chest on its front.
 */
function chest6(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const P = 45, legH = 110, topT = 20, ovS = 22, ovF = 14;
  const topRail = 40, botRail = 50, midRail = 20, backRail = 80;
  const avail = H - topT - legH - topRail - botRail - 4 * midRail;
  const small = 140, deep = 290, mid = Math.round((avail - small - deep) / 3);
  const openings = [small, deep, mid, mid, avail - small - deep - 2 * mid];
  const postH = H - topT;
  const xo = W / 2 - ovS, xi = xo - P, xp = xo - P / 2;
  const zf = D / 2 - ovF, zb = -D / 2 + 3;
  const zpf = zf - P / 2, zpb = zb + P / 2;
  const sg = (i: number) => (i === 0 ? -1 : 1);

  const postT = b.part("Corner post", [P, postH, P], { material: "wood" });
  const panelT = 16, panelX = xo - 16;
  const panelH = postH - legH;
  const panelD = zpf - zpb - P + 20;
  const sidePanelT = b.part("Side panel", [panelT, panelH, panelD]);
  const spT = Math.max(2, panelX - panelT / 2 - xi);
  const spacerT = b.part("Spacer board", [spT, panelH - 20, panelD - 24]);
  const panelY = legH + panelH / 2;
  const posts = [0, 1].map((i) => [b.place(postT, [sg(i) * xp, postH / 2, zpf]), b.place(postT, [sg(i) * xp, postH / 2, zpb])]);
  const panels = [0, 1].map((i) => b.place(sidePanelT, [sg(i) * panelX, panelY, (zpf + zpb) / 2]));
  const spacers = [0, 1].map((i) => b.place(spacerT, [sg(i) * (xi + spT / 2), panelY, (zpf + zpb) / 2]));
  const sideKeys = (i: number) => [...posts[i], panels[i], spacers[i]];

  const railD = 40;
  const zr = zf - railD / 2;
  const tops = postH;
  const railYs: { y: number; h: number }[] = [{ y: tops - topRail / 2, h: topRail }];
  let y = tops - topRail;
  const ops: { y0: number; h: number }[] = [];
  openings.forEach((h, i) => {
    ops.push({ y0: y - h, h });
    y -= h;
    const rh = i === openings.length - 1 ? botRail : midRail;
    railYs.push({ y: y - rh / 2, h: rh });
    y -= rh;
  });
  const rails = railYs.map((r, i) => b.place(b.part(i === 0 ? "Top rail" : i === railYs.length - 1 ? "Bottom rail" : "Front rail", [2 * xi, r.h, railD], { material: "wood" }), [0, r.y, zr]));
  const backRailY = tops - backRail / 2;
  const backRailK = b.place(b.part("Back rail", [2 * xi, backRail, 20], { material: "wood" }), [0, backRailY, zb + 10]);
  const top = b.place(b.part("Top", [W, topT, D]), [0, H - topT / 2, 0]);
  const sheetW = xo + 6;
  const backH = postH - legH - 4;
  const backT = b.part("Back panel", [sheetW, backH, 3], { material: "fiber" });
  const backs = [b.place(backT, [-xo + sheetW / 2, legH + backH / 2, zb - 1.5]), b.place(backT, [xo - sheetW / 2, legH + backH / 2, zb - 1.5])];
  // the short divider between the two small drawers; it reaches forward under the top rail, where the long screws hold it
  const divZ0 = zb + 24, divZ1 = zf - 20;
  const divider = b.place(b.part("Divider", [18, ops[0].h, divZ1 - divZ0]), [0, ops[0].y0 + ops[0].h / 2, (divZ0 + divZ1) / 2]);

  const runLen = Math.round((zf - zb - 60) / 10) * 10;
  const runner = runnerDef(runLen);
  const runners = (i: number): FitOpts[] => ops.map((o) => ({ on: spacers[i], at: [sg(i) * xi, o.y0 + 8, zf - 20 - runLen / 2], dir: [sg(i), 0, 0], hole: false }));
  const runnerScrews = (i: number): FitOpts[] => ops.flatMap((o) => [zf - 50, zf - runLen + 10].map((z): FitOpts => ({ on: spacers[i], at: [sg(i) * xi, o.y0 + 8, z], dir: [sg(i), 0, 0] })));

  const panelYs = spread(legH + 60, postH - 60, 3);
  const postBolts = (i: number): FitOpts[] =>
    posts[i].flatMap((p, j) => panelYs.map((yy): FitOpts => ({ on: p, at: [sg(i) * panelX, yy, j === 0 ? zpf - P / 2 : zpb + P / 2], dir: [0, 0, j === 0 ? 1 : -1], mate: panels[i], mateHole: 4 })));
  const panelDowels = (i: number): FitOpts[] =>
    posts[i].flatMap((p, j) => [legH + panelH * 0.3, legH + panelH * 0.7].map((yy): FitOpts => ({ on: p, at: [sg(i) * panelX, yy, j === 0 ? zpf - P / 2 : zpb + P / 2], dir: [0, 0, j === 0 ? 1 : -1], mate: panels[i] })));
  const panelCams = (i: number): FitOpts[] =>
    [zpf - P / 2 - 30, zpb + P / 2 + 30].flatMap((z) => panelYs.map((yy): FitOpts => ({ on: panels[i], at: [sg(i) * (panelX - panelT / 2), yy, z], dir: [sg(i), 0, 0] })));
  const feet = (i: number): FitOpts[] => posts[i].map((p, j) => ({ on: p, at: [sg(i) * xp, 0, j === 0 ? zpf : zpb], dir: [0, 1, 0], hole: false }));
  const spacerDowels = (i: number): FitOpts[] =>
    [legH + 150, postH - 150].flatMap((yy) => [zpf - P / 2 - 60, zpb + P / 2 + 60].map((z): FitOpts => ({ on: spacers[i], at: [sg(i) * (panelX - panelT / 2), yy, z], dir: [-sg(i), 0, 0], mate: panels[i] })));

  // rails into the sides: a cam bolt and a dowel in the post at each end, a cam lock in the rail
  type J = { k: string; yy: number; z: number; dz: number; inFront: boolean; h: number };
  const joints: J[] = [
    ...rails.map((k, i): J => ({ k, yy: railYs[i].y, z: zr, dz: 10, inFront: true, h: railYs[i].h })),
    { k: backRailK, yy: backRailY, z: zb + 10, dz: backRail / 4, inFront: false, h: backRail },
  ];
  const railBolts = (i: number): FitOpts[] => joints.map((j) => ({ on: posts[i][j.inFront ? 0 : 1], at: [sg(i) * xi, j.yy - (j.inFront ? 0 : j.dz), j.inFront ? j.z - j.dz : j.z], dir: [sg(i), 0, 0], mate: j.k, mateHole: 4 }));
  const railDowels = (i: number): FitOpts[] => joints.map((j) => ({ on: j.k, at: [sg(i) * xi, j.yy + (j.inFront ? 0 : j.dz), j.inFront ? j.z + j.dz : j.z], dir: [-sg(i), 0, 0], mate: posts[i][j.inFront ? 0 : 1] }));
  const railCams = (i: number, js: J[]): FitOpts[] =>
    js.map((j): FitOpts => (j.inFront ? { on: j.k, at: [sg(i) * (xi - 28), j.yy + j.h / 2, j.z - j.dz], dir: [0, -1, 0] } : { on: j.k, at: [sg(i) * (xi - 28), j.yy - j.dz, j.z + 10], dir: [0, 0, -1] }));

  // the top: four cam bolts a side, three dowels a side and one in the divider, screws up through the top rail and back rail
  const zm = (zpf + zpb) / 2;
  const topBoltJ = (i: number) => [
    { k: posts[i][0], x: xp, z: zpf - 10, xc: xi },
    { k: panels[i], x: panelX, z: zm - 70, xc: panelX - panelT / 2 },
    { k: panels[i], x: panelX, z: zm + 70, xc: panelX - panelT / 2 },
    { k: posts[i][1], x: xp, z: zpb + 10, xc: xi },
  ];
  const topDowelJ = (i: number) => [
    { k: posts[i][0], x: xp, z: zpf + 10 },
    { k: panels[i], x: panelX, z: zm },
    { k: posts[i][1], x: xp, z: zpb - 10 },
  ];
  const topBolts: FitOpts[] = [0, 1].flatMap((i) => topBoltJ(i).map((j): FitOpts => ({ on: top, at: [sg(i) * j.x, tops, j.z], dir: [0, 1, 0], mate: j.k, mateHole: 4 })));
  const topDowels: FitOpts[] = [0, 1].flatMap((i) => topDowelJ(i).map((j): FitOpts => ({ on: j.k, at: [sg(i) * j.x, tops, j.z], dir: [0, -1, 0], mate: top })));
  const topCams: FitOpts[] = [0, 1].flatMap((i) => topBoltJ(i).map((j): FitOpts => ({ on: j.k, at: [sg(i) * j.xc, tops - 26, j.z], dir: [sg(i), 0, 0] })));
  const topScrews: FitOpts[] = [
    ...spread(-xi * 0.6, xi * 0.6, 2).map((x): FitOpts => ({ on: rails[0], at: [x, tops - topRail, zr], dir: [0, 1, 0], mate: top })),
    ...spread(-xi * 0.6, xi * 0.6, 2).map((x): FitOpts => ({ on: backRailK, at: [x, tops - backRail, zb + 10], dir: [0, 1, 0], mate: top })),
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
  step(b, { title: "Screw the cam bolts into the four corner posts", detail: "Lay them on a rug, marked ends together. Three in each post, by hand until they stop.", tools: ["screwdriver"], scene: "side", kind: "cams", warnings: ["floor"] }, () => {
    b.stagger(0.12);
    for (const i of [0, 1]) {
      stageGroup(b, [posts[i][0]], pivot(i), layRot(i), lay(i));
      stageGroup(b, [posts[i][1]], pivot(i), layRot(i), off(i, -400));
    }
    b.then(0.15);
    b.fits(CAM_BOLT, [...postBolts(0), ...postBolts(1)], 0.05);
  });
  step(b, { title: "Join each side panel to its two posts", detail: "Tap the dowels into the posts. Push the panel onto the front post, then push the back post onto the panel.", tools: ["hammer"], scene: "side", kind: "dowels" }, () => {
    b.fits(DOWEL, [...panelDowels(0), ...panelDowels(1)], 0.06);
    b.then(0.15);
    for (const i of [0, 1]) stageGroup(b, [panels[i]], pivot(i), layRot(i), lay(i), rotate([0, 0, -200], layRot(i)));
    b.then(0.1);
    for (const i of [0, 1]) stageGroup(b, [posts[i][1]], pivot(i), layRot(i), lay(i), [0, 0, 0]);
  });
  step(b, { title: "Lock the cam locks in the side panels", detail: "Arrow towards the bolt, then turn clockwise until each one pulls tight.", tools: ["screwdriver"], scene: "side", kind: "cams" }, () =>
    b.fits(CAM, [...panelCams(0), ...panelCams(1)], 0.06),
  );
  step(b, { title: "Press the spacer boards onto the side panels", detail: "Push the long dowels into one face of each board, then press it onto the panel between the posts.", scene: "side", kind: "dowels" }, () => {
    for (const i of [0, 1]) stageGroup(b, [spacers[i]], pivot(i), layRot(i), lay(i));
    b.then(0.1);
    b.fits(SMALL_DOWEL, [...spacerDowels(0), ...spacerDowels(1)], 0.08);
  });
  for (const i of [1, 0])
    step(
      b,
      { title: i === 0 ? "Screw the runners onto the left side" : "Screw the runners onto the right side", detail: "Five on each side, marked L and R. Wheel end at the front, two screws in each.", tools: ["screwdriver"], scene: "side", kind: "runners" },
      () => {
        b.fits(runner, runners(i), 0.2);
        b.then(0.1);
        b.fits(RUNNER_SCREW, runnerScrews(i), 0.06);
      },
    );
  step(b, { title: "Push the feet into the ends of the posts", detail: "Into the bottom end of each post. Press them in until they sit flat.", scene: "side" }, () => b.fits(FOOT, [...feet(0), ...feet(1)], 0.15));
  step(b, { title: "Screw in the cam bolts for the rails", detail: "Seven into the inside faces of the posts on each side, by hand until they stop.", tools: ["screwdriver"], scene: "side", kind: "cams" }, () =>
    b.fits(CAM_BOLT, [...railBolts(0), ...railBolts(1)], 0.06),
  );
  // every rail takes a dowel in each end, flat on the rug
  const allRails = [backRailK, ...rails];
  step(b, { title: "Tap the dowels into the rails", detail: "One in each end of all seven rails.", tools: ["hammer"], scene: "rails", kind: "dowels" }, () => {
    b.stagger(0.08);
    allRails.forEach((k, i) => {
      const it = b.partItem(k);
      b.stage(k, [0, 40, (i - (allRails.length - 1) / 2) * 90], [-Math.PI / 2, 0, 0], [0, 160, 0]);
      void it;
    });
    b.then(0.15);
    b.fits(DOWEL, [...railDowels(0), ...railDowels(1)], 0.04);
  });

  /* --- the frame, lying on its left side --- */
  const front = joints.filter((j) => j.inFront), backJ = joints.filter((j) => !j.inFront);
  step(b, { title: "Lay the left side down and stand the back rail in it", detail: "Inside face up. It goes at the top of the back post, on its dowel and bolt.", tools: ["hammer"], pose: "+x", kind: "join", warnings: ["floor"] }, () => {
    b.stagger(0.12);
    for (const k of sideKeys(0)) b.add(k, [300, 0, 0]);
    b.then(0.15);
    for (const j of backJ) b.add(j.k, [300, 0, 0]);
  });
  step(b, { title: "Stand the front rails in", detail: "Top rail at the top, the wide one at the bottom, the four narrow ones between. Push each onto its dowel hole and bolt.", pose: "+x", kind: "join" }, () => {
    b.stagger(0.15);
    for (const j of front) b.add(j.k, [300, 0, 0]);
  });
  step(b, { title: "Lock the front rails with cam locks", detail: "One in each rail, next to the side.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(CAM, railCams(0, front), 0.1));
  const dz0 = ops[0].y0, dz1 = ops[0].y0 + ops[0].h;
  step(b, { title: "Stand the divider in", detail: "Between the top rail and the rail below it, runners already on. Tap a dowel into its top edge first, then lock it with one cam lock.", tools: ["hammer", "screwdriver"], pose: "+x", kind: "join" }, () => {
    b.fit(DOWEL, { on: divider, at: [0, dz1, zb + 120], dir: [0, -1, 0] });
    b.then(0.1);
    b.add(divider, [300, 0, 0]);
    for (const g of [-1, 1]) {
      b.preset(runner, { on: divider, at: [g * 9, dz0 + 8, zf - 20 - runLen / 2], dir: [-g, 0, 0], hole: false });
    }
    b.then(0.1);
    b.fit(CAM, { on: divider, at: [9, dz0 + 40, zb + 60], dir: [-1, 0, 0] });
  });
  step(b, { title: "Lower the right side onto the rails", detail: "Two people make this easier: press it down evenly onto the dowels.", pose: "+x", kind: "join", people: 2 }, () => {
    b.stagger(0.05);
    for (const k of sideKeys(1)) b.add(k, [420, 0, 0]);
  });
  step(b, { title: "Lock the cam locks on this side", detail: "Seven, one in each rail. Arrow towards the bolt, then a clockwise turn.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(CAM, railCams(1, joints), 0.1));
  step(b, { title: "Stand it up and screw the divider in", detail: "One long screw down through the top rail and one up through the rail below, with the Allen key.", tools: ["allen"], pose: "+y", kind: "screws", people: 2 }, () => {
    b.fit(DIVIDER_SCREW, { on: rails[0], at: [0, tops, zf - 30], dir: [0, -1, 0], mate: divider });
    b.fit(TOP_SCREW, { on: rails[1], at: [0, dz0 - midRail, zf - 30], dir: [0, 1, 0], mate: divider });
  });

  /* --- the top --- */
  const brX = [-xi * 0.55, xi * 0.55];
  step(b, { title: "Tap the dowels into the tops of the sides", detail: "Three on each side: in both posts and the panel.", tools: ["hammer"], kind: "dowels" }, () => b.fits(DOWEL, topDowels, 0.08));
  step(b, { title: "Screw the wall brackets under the top", detail: "Lay the top upside down on a rug. Two brackets at the back edge, a screw and washer in each.", tools: ["screwdriver"], scene: "top", kind: "screws", warnings: ["face"] }, () => {
    b.stage(top, [0, topT / 2, 0], [0, 0, Math.PI], [0, 160, 0]);
    b.then(0.15);
    b.fits(BRACKET, brX.map((x): FitOpts => ({ on: top, at: [x, tops, zb + 2], dir: [0, 1, 0], hole: false })), 0.15);
    b.then(0.05);
    b.fits(WASHER, brX.map((x): FitOpts => ({ on: top, at: [x, tops - 4, zb + 25], dir: [0, 1, 0], hole: false })), 0.1);
    b.fits(SMALL_SCREW, brX.map((x): FitOpts => ({ on: top, at: [x, tops - 5, zb + 25], dir: [0, 1, 0] })), 0.1);
  });
  step(b, { title: "Screw the cam bolts into the top", detail: "Eight, by hand until they stop.", tools: ["screwdriver"], scene: "top", kind: "cams" }, () => b.fits(CAM_BOLT, topBolts, 0.06));
  step(b, { title: "Put the top on", detail: "Lower it onto the dowels and bolts. Two people make this easier.", pose: "+y", kind: "join", people: 2 }, () => b.add(top, [0, 300, 0]));
  step(b, { title: "Screw the top down through the rails", detail: "Four long screws up through the top rail and the back rail, with the Allen key.", tools: ["allen"], kind: "screws" }, () => b.fits(TOP_SCREW, topScrews, 0.15));
  step(b, { title: "Lock the top with cam locks", detail: "Four on each side, just under the top.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(CAM, topCams, 0.1));

  /* --- the back --- */
  const zn = zb - 3;
  const nailOn = (k: string, x: number, yy: number): FitOpts => ({ on: k, at: [x, yy, zn], dir: [0, 0, 1], hole: false });
  const corner = (i: number) => nailOn(posts[i][1], sg(i) * xp, postH - 60);
  const round: FitOpts[] = [
    ...[0, 1].flatMap((i) => spread(legH + 60, postH - 200, 5).map((yy) => nailOn(posts[i][1], sg(i) * xp, yy))),
    ...spread(-xi + 60, xi - 60, 6).map((x) => nailOn(backRailK, x, backRailY)),
    ...spread(-xi + 60, xi - 60, 5).map((x) => nailOn(backs[x < 0 ? 0 : 1], x, legH + 6)),
  ];
  step(b, { title: "Lay it on its front", detail: "On the flattened box, so the front edges don't get scratched.", pose: "-z", kind: "flip", people: 2, warnings: ["floor", "two"] });
  step(b, { title: "Lay the back panels on", detail: "Push the first into one side, then slide the second under its edge so they overlap in the middle.", pose: "-z", kind: "general" }, () => {
    b.add(backs[0], [0, 0, -340]);
    b.then(0.15);
    b.add(backs[1], [300, 0, -60]);
  });
  const rivY = spread(legH + 120, postH - 160, 4);
  step(b, { title: "Rivet the back panels together", detail: "Four plastic rivets through the overlap: push in the sleeve, then press the pin into it.", pose: "-z", kind: "general" }, () => {
    b.fits({ kind: "clip", len: 8, dia: 12, name: "Rivet sleeve" }, rivY.map((yy): FitOpts => ({ on: backs[0], at: [0, yy, zb - 3], dir: [0, 0, 1], hole: false })), 0.1);
    b.then(0.1);
    b.fits({ kind: "clip", len: 10, dia: 10, name: "Rivet pin" }, rivY.map((yy): FitOpts => ({ on: backs[0], at: [0, yy, zb - 4], dir: [0, 0, 1], hole: false })), 0.1);
  });
  step(b, { title: "Nail the two top corners", detail: "Line the panels up with the top corners and nail each one there, so the frame is square.", tools: ["hammer"], pose: "-z", kind: "nails", check: "square" }, () => b.fits(NAIL, [corner(0), corner(1)], 0.2));
  step(b, { title: "Nail the back panels all round", detail: "Into the posts, the back rail and along the bottom, keeping the nails straight.", tools: ["hammer"], pose: "-z", kind: "nails" }, () => b.fits(NAIL, round, 0.05));
  step(b, { title: "Stand it up", detail: "Turn it upright where it will go, against the wall.", pose: "+y", kind: "standup", people: 2, warnings: ["two"] });
  wallBrackets(b, { xs: brX, y: H, z: zb - 20 });

  drawers(
    b,
    ops.flatMap((o, k) =>
      k === 0
        ? [-1, 1].map((g): DrawerBox => ({ x: (g * (2 * xi / 2 + 9)) / 2, y0: o.y0, w: xi - 9, h: o.h, zf, zBack: zb + 24, knobs: 2, dowels: 1 }))
        : [{ x: 0, y0: o.y0, w: 2 * xi, h: o.h, zf, zBack: zb + 24, knobs: 2 } as DrawerBox],
    ),
    { support: true },
  )();
}

/* ---------- glass-door cabinet with 3 drawers ---------- */

function glassCabinet(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const topT = 22, P = 45, ov = 10;
  const postH = H - topT;
  const xo = W / 2 - ov, xp = xo - P / 2, xi = xo - P;
  const zf = D / 2 - ov, zb = -D / 2 + 3;
  const zpf = zf - P / 2, zpb = zb + P / 2, zm = (zpf + zpb) / 2;
  const zr = zf - 10, zbr = zb + 10;
  const sideD = zpf - zpb - P;
  const legH = 150, plinth = 110, topRail = 60, frontRail = 20;
  const pTop = legH + plinth;
  // the drawers from the bottom up, then the fixed shelf and the doors above it
  const opsUp = [210, 190, 130];
  const ops: { y0: number; h: number }[] = [];
  const fr: number[] = [];
  let y = pTop;
  opsUp.forEach((h, i) => {
    ops.push({ y0: y, h });
    y += h;
    if (i < opsUp.length - 1) {
      fr.push(y + frontRail / 2);
      y += frontRail;
    }
  });
  const fxY = y + 10; // fixed shelf centre, 20 thick
  const srH = 60;
  const doorY0 = fxY + 12, doorY1 = postH - topRail - 2;

  /* drawers first, as the manual does: small at the top, the deepest at the bottom */
  const zBack = zb + 40;
  const slideIn = drawers(
    b,
    [...ops].reverse().map((o, i): DrawerBox => ({ x: 0, y0: o.y0, w: 2 * xi, h: o.h, zf, zBack, knobs: 2, bolts: i === 0 ? 1 : 2, nails: i === 2 ? 3 : 2 })),
  );

  /* the frame parts */
  const sides = [-1, 1].map((g) => {
    const lo = { y0: pTop, y1: fxY - srH / 2 };
    const up = { y0: fxY + srH / 2, y1: postH };
    const { type, mid } = b.compound(
      "Side frame",
      [
        { shape: "box", size: [P, postH, P], pos: [g * xp, postH / 2, zpf], material: "wood" },
        { shape: "box", size: [P, postH, P], pos: [g * xp, postH / 2, zpb], material: "wood" },
        { shape: "box", size: [16, lo.y1 - lo.y0, sideD + 16], pos: [g * (xo - 16), (lo.y0 + lo.y1) / 2, zm], material: "board" },
        { shape: "box", size: [16, up.y1 - up.y0, sideD + 16], pos: [g * (xo - 16), (up.y0 + up.y1) / 2, zm], material: "board" },
        { shape: "box", size: [P - 10, srH, sideD], pos: [g * (xo - P / 2 - 5), fxY, zm], material: "wood" },
      ],
      { material: "wood" },
    );
    return b.place(type, mid);
  });
  const brT = b.part("Bottom side rail", [P - 10, plinth, sideD], { material: "wood" });
  const brs = [-1, 1].map((g) => b.place(brT, [g * (xo - P / 2 - 5), legH + plinth / 2, zm]));
  const barT = b.part("Runner bar", [21, 40, sideD], { material: "wood" });
  const barY = (o: { y0: number }) => o.y0 + 25;
  const bars = [-1, 1].map((g) => ops.map((o) => b.place(barT, [g * (xi + 10.5), barY(o), zm])));
  const railT = b.part("Rail", [2 * xi, plinth, 20], { material: "wood" });
  const fp = b.place(railT, [0, legH + plinth / 2, zr]);
  const bp = b.place(railT, [0, legH + plinth / 2, zbr]);
  const topRailT = b.part("Top rail", [2 * xi, topRail, 20], { material: "wood" });
  const ft = b.place(topRailT, [0, postH - topRail / 2, zr]);
  const bt = b.place(topRailT, [0, postH - topRail / 2, zbr]);
  const frT = b.part("Front rail", [2 * xi, frontRail, 40], { material: "wood" });
  const frs = fr.map((yy) => b.place(frT, [0, yy, zf - 20]));
  const fx = b.place(b.part("Fixed shelf", [2 * xi, 20, zf - zb - 26]), [0, fxY, (zf + zb + 26) / 2]);
  const top = b.place(b.part("Top", [W, topT, D], { material: "wood" }), [0, H - topT / 2, 0]);
  const bkLoT = b.part("Back panel", [2 * xi, fxY - pTop, 4], { material: "wood" });
  const bkUpT = b.part("Back panel", [2 * xi, postH - topRail - fxY, 4], { material: "wood" });
  const bkLo = b.place(bkLoT, [0, (pTop + fxY) / 2, zb + 24]);
  const bkUp = b.place(bkUpT, [0, (fxY + postH - topRail) / 2, zb + 24]);
  const shelfYs = spread(doorY0 + 260, doorY1 - 260, 3).map(Math.round);
  const shelfT = b.part("Shelf", [2 * xi - 4, 18, zf - zb - 50]);
  const shelves = shelfYs.map((yy) => b.place(shelfT, [0, yy, (zf + zb) / 2 + 6]));
  const dw = xi - 3, dh = doorY1 - doorY0, dt = 20, st = 60;
  const door = b.compound(
    "Glass door",
    [
      { shape: "box", size: [st, dh, dt], pos: [-(dw - st) / 2, 0, 0], material: "wood" },
      { shape: "box", size: [st, dh, dt], pos: [(dw - st) / 2, 0, 0], material: "wood" },
      { shape: "box", size: [dw - 2 * st, st, dt], pos: [0, (dh - st) / 2, 0], material: "wood" },
      { shape: "box", size: [dw - 2 * st, st + 20, dt], pos: [0, -(dh - st - 20) / 2, 0], material: "wood" },
      { shape: "box", size: [dw - 2 * st, dh - 2 * st - 20, 4], pos: [0, 10, -2], material: "glass" },
    ],
    { material: "wood" },
  );
  const doors = [-1, 1].map((g) => b.place(door.type, [g * (dw / 2 + 1.5), (doorY0 + doorY1) / 2, zf - dt / 2]));
  const hingeYs = [doorY0 + 140, doorY1 - 140];

  /* fittings */
  const sx = (g: number) => g * (xo - P / 2 - 5);
  const brScrews = (i: number): FitOpts[] => {
    const g = i ? 1 : -1;
    return [
      { on: sides[i], at: [sx(g), legH + plinth / 2, zpf + P / 2], dir: [0, 0, -1], mate: brs[i] },
      { on: sides[i], at: [sx(g), legH + plinth / 2, zpb - P / 2], dir: [0, 0, 1], mate: brs[i] },
    ];
  };
  const feet = (i: number): FitOpts[] => [zpf, zpb].map((z): FitOpts => ({ on: sides[i], at: [(i ? 1 : -1) * xp, 0, z], dir: [0, 1, 0], hole: false }));
  const barDowels = (i: number): FitOpts[] => ops.map((o, k) => ({ on: bars[i][k], at: [(i ? 1 : -1) * (xo - 24), barY(o), zm + 80], dir: [i ? 1 : -1, 0, 0], mate: sides[i] }));
  const barScrews = (i: number): FitOpts[] => ops.map((o, k) => ({ on: bars[i][k], at: [(i ? 1 : -1) * xi, barY(o), zm - 60], dir: [i ? 1 : -1, 0, 0], mate: sides[i] }));
  type J = { k: string; yy: number; z: number; front: boolean; h: number };
  const railJ: J[] = [
    ...frs.map((k, i): J => ({ k, yy: fr[i], z: zf - 20, front: true, h: frontRail })),
    { k: fp, yy: legH + plinth / 2, z: zr, front: true, h: plinth },
    { k: ft, yy: postH - topRail / 2, z: zr, front: true, h: topRail },
    { k: bp, yy: legH + plinth / 2, z: zbr, front: false, h: plinth },
    { k: bt, yy: postH - topRail / 2, z: zbr, front: false, h: topRail },
  ];
  const isTopRail = (j: J) => j.k === ft || j.k === bt;
  const boltY = (j: J) => (j.h > 40 ? j.yy + (isTopRail(j) ? -12 : -15) : j.yy);
  const dowelY = (j: J) => (j.h > 40 ? j.yy + (isTopRail(j) ? 12 : 15) : j.yy);
  const dz = (j: J) => (j.h > 40 ? 0 : 10);
  const railBolts = (i: number): FitOpts[] => {
    const g = i ? 1 : -1;
    return [
      ...railJ.map((j): FitOpts => ({ on: sides[i], at: [g * xi, boltY(j), j.z - dz(j)], dir: [g, 0, 0], mate: j.k, mateHole: 4 })),
      ...[zm - 60, zm + 60].map((z): FitOpts => ({ on: sides[i], at: [g * xi, fxY, z], dir: [g, 0, 0], mate: fx, mateHole: 4 })),
    ];
  };
  const railDowels = (i: number, js: J[]): FitOpts[] => js.map((j) => ({ on: j.k, at: [(i ? 1 : -1) * xi, dowelY(j), j.z + dz(j)], dir: [i ? -1 : 1, 0, 0], mate: sides[i] }));
  const railCams = (i: number, js: J[]): FitOpts[] =>
    js.map((j): FitOpts => {
      const g = i ? 1 : -1;
      if (j.h <= 40) return { on: j.k, at: [g * (xi - 26), j.yy - j.h / 2, j.z - dz(j)], dir: [0, 1, 0] };
      const up = isTopRail(j);
      return { on: j.k, at: [g * (xi - 26), up ? j.yy - j.h / 2 : j.yy + j.h / 2, j.z], dir: [0, up ? 1 : -1, 0] };
    });
  const shelfCams = (i: number): FitOpts[] => [zm - 60, zm + 60].map((z): FitOpts => ({ on: fx, at: [(i ? 1 : -1) * (xi - 26), fxY + 10, z], dir: [0, -1, 0] }));
  const hingePlate: HwDef = { kind: "plate", len: 40, dia: 20, name: "Hinge plate" };
  const plates = (i: number): FitOpts[] => hingeYs.map((yy): FitOpts => ({ on: sides[i], at: [(i ? 1 : -1) * xi, yy, zf - 40], dir: [i ? 1 : -1, 0, 0], hole: false }));
  const runLen = Math.round((zf - zb - 60) / 10) * 10;
  const runner = runnerDef(runLen);
  const runners = (i: number): FitOpts[] => ops.map((o, k) => ({ on: bars[i][k], at: [(i ? 1 : -1) * xi, o.y0 + 8, zf - 20 - runLen / 2], dir: [i ? 1 : -1, 0, 0], hole: false }));
  const runnerScrews = (i: number): FitOpts[] => ops.flatMap((o, k) => [zf - 60, zf - runLen + 20].map((z): FitOpts => ({ on: bars[i][k], at: [(i ? 1 : -1) * xi, o.y0 + 8, z], dir: [i ? 1 : -1, 0, 0] })));

  /* --- the two side frames, on a rug --- */
  const pivot = (i: number): Vec3 => [(i ? 1 : -1) * xp, postH / 2, 0];
  const lay = (i: number): Vec3 => [(i ? 1 : -1) * (D / 2 + 80), P / 2, 0];
  const layRot = (i: number): Vec3 => [0, Math.PI / 2, i === 0 ? Math.PI / 2 : -Math.PI / 2];
  const sideStep = (o: StepOpts, body: () => void) => step(b, { scene: "side", ...o }, body);
  sideStep({ title: "Screw the bottom rails onto the side frames", detail: "Lay both side frames on a rug, inside up. Two long screws through the posts into each rail, with the Allen key.", tools: ["allen"], kind: "screws", warnings: ["floor"] }, () => {
    b.stagger(0.12);
    for (const i of [0, 1]) stageGroup(b, [sides[i]], pivot(i), layRot(i), lay(i));
    b.then(0.1);
    for (const i of [0, 1]) stageGroup(b, [brs[i]], pivot(i), layRot(i), lay(i), rotate([300, 0, 0], layRot(i)));
    b.then(0.1);
    b.fits(TOP_SCREW, [...brScrews(0), ...brScrews(1)], 0.1);
  });
  sideStep({ title: "Screw the adjustable feet into the posts", detail: "Into the bottom end of each post, by hand. You level them once it stands.", kind: "legs" }, () => b.fits(ADJ_FOOT, [...feet(0), ...feet(1)], 0.12));
  sideStep({ title: "Tap the dowels into the runner bars", detail: "One in each of the six bars.", tools: ["hammer"], kind: "dowels" }, () => {
    b.stagger(0.06);
    // they lie on the rug beside the frames until they're screwed on
    for (const i of [0, 1]) {
      const l = lay(i), o = rotate([0, 0, -460], layRot(i));
      stageGroup(b, bars[i], pivot(i), layRot(i), [l[0] + o[0], l[1] + o[1] - 24, l[2] + o[2]]);
    }
    b.then(0.1);
    b.fits(DOWEL, [...barDowels(0), ...barDowels(1)], 0.06);
  });
  sideStep({ title: "Screw the runner bars onto the side frames", detail: "Three on each side, on the lower panel. Push each onto its dowel, then a long screw.", tools: ["allen"], kind: "screws" }, () => {
    b.stagger(0.12);
    for (const i of [0, 1]) stageGroup(b, bars[i], pivot(i), layRot(i), lay(i), rotate([(i ? 1 : -1) * 200, 0, 0], layRot(i)));
    b.then(0.1);
    b.fits(BAR_SCREW, [...barScrews(0), ...barScrews(1)], 0.08);
  });
  sideStep({ title: "Screw in the cam bolts", detail: "Eight in each side frame: six for the rails and two for the fixed shelf. By hand until they stop.", tools: ["screwdriver"], kind: "cams" }, () =>
    b.fits(CAM_BOLT, [...railBolts(0), ...railBolts(1)], 0.04),
  );
  sideStep({ title: "Press in the hinge plates", detail: "Two on each front post, above the fixed shelf. Push them in and turn the screws to spread them.", tools: ["screwdriver"], kind: "hinges" }, () =>
    b.fits(hingePlate, [...plates(0), ...plates(1)], 0.12),
  );
  sideStep({ title: "Screw the frame runners onto the bars", detail: "Three on each side, marked L and R. Wheel end at the front, two screws in each.", tools: ["screwdriver"], kind: "runners" }, () => {
    b.fits(runner, [...runners(0), ...runners(1)], 0.15);
    b.then(0.1);
    b.fits(RUNNER_SCREW, [...runnerScrews(0), ...runnerScrews(1)], 0.05);
  });

  /* --- the frame, lying on its left side --- */
  const leftKeys = [sides[0], brs[0], ...bars[0]];
  step(b, { title: "Lay the left side down and stand the fixed shelf in it", detail: "Inside face up. The shelf drops onto the two bolts in the side rail; lock it with two cam locks.", tools: ["screwdriver"], pose: "+x", kind: "join", warnings: ["floor"] }, () => {
    b.stagger(0.1);
    for (const k of leftKeys) b.add(k, [300, 0, 0]);
    b.then(0.15);
    b.add(fx, [300, 0, 0]);
    b.then(0.1);
    b.fits(CAM, shelfCams(0), 0.12);
  });
  const groups: [J[], string, string][] = [
    [railJ.filter((j) => frs.includes(j.k)), "Stand the two front rails in", "The narrow rails go between the drawers. A dowel in the end of each, then push it onto its hole and bolt, and lock it."],
    [railJ.filter((j) => j.front && !frs.includes(j.k)), "Stand the front top rail and plinth in", "Top rail at the top end, plinth at the foot end, on a dowel and bolt each. Lock them."],
    [railJ.filter((j) => !j.front), "Stand the back top rail and plinth in", "The same at the back. Lock them with two more cam locks."],
  ];
  for (const [js, title, detail] of groups)
    step(b, { title, detail, tools: ["hammer", "screwdriver"], pose: "+x", kind: "join" }, () => {
      b.fits(DOWEL, railDowels(0, js), 0.1);
      b.then(0.1);
      b.stagger(0.15);
      for (const j of js) b.add(j.k, [300, 0, 0]);
      b.then(0.1);
      b.fits(CAM, railCams(0, js), 0.12);
    });
  step(b, { title: "Tap dowels into the free rail ends", detail: "One in the top end of each of the six rails.", tools: ["hammer"], pose: "+x", kind: "dowels" }, () => b.fits(DOWEL, railDowels(1, railJ), 0.08));
  step(b, { title: "Lower the right side on", detail: "Two people: it has its rail, feet, bars and runners on like the left one. Press it down evenly onto the dowels and bolts.", pose: "+x", kind: "join", people: 2 }, () => {
    b.stagger(0.05);
    for (const k of [sides[1], brs[1], ...bars[1]]) b.add(k, [420, 0, 0]);
  });
  step(b, { title: "Lock the cam locks on this side", detail: "Six in the rails and two in the fixed shelf.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(CAM, [...railCams(1, railJ), ...shelfCams(1)], 0.08));

  /* --- on its back: door stops, top --- */
  const stopX = [-60, 60];
  step(b, { title: "Screw the door stops under the top rail", detail: "Turn it onto its back. One in the middle for each door, two screws each, the rubber pads on their tips.", tools: ["screwdriver"], pose: "+z", kind: "screws", people: 2 }, () => {
    b.fits({ kind: "clip", len: 30, dia: 20, name: "Door stop" }, stopX.map((x): FitOpts => ({ on: ft, at: [x, postH - topRail, zr - 6], dir: [0, 1, 0], hole: false })), 0.15);
    b.then(0.05);
    b.fits(RUNNER_SCREW, stopX.flatMap((x) => [x - 8, x + 8].map((xx): FitOpts => ({ on: ft, at: [xx, postH - topRail - 1, zr - 2], dir: [0, 1, 0] }))), 0.06);
  });
  step(b, { title: "Push the top on", detail: "Tap two dowels into the top rails, then push the top onto them.", tools: ["hammer"], pose: "+z", kind: "join" }, () => {
    b.fits(DOWEL, [
      { on: ft, at: [-xi / 2, postH, zr], dir: [0, -1, 0], mate: top },
      { on: bt, at: [xi / 2, postH, zbr], dir: [0, -1, 0], mate: top },
    ], 0.1);
    b.then(0.15);
    b.add(top, [0, 300, 0]);
  });
  step(b, { title: "Screw the top on through the rails", detail: "Seven long screws up through the top rails, four at the front and three at the back.", tools: ["allen"], pose: "+z", kind: "screws" }, () =>
    b.fits(TOP_SCREW, [
      ...spread(-xi + 60, xi - 60, 4).map((x): FitOpts => ({ on: ft, at: [x, postH - topRail, zr], dir: [0, 1, 0], mate: top })),
      ...spread(-xi + 100, xi - 100, 3).map((x): FitOpts => ({ on: bt, at: [x, postH - topRail, zbr], dir: [0, 1, 0], mate: top })),
    ], 0.12),
  );

  /* --- on its front: the back panels --- */
  step(b, { title: "Slide in the lower back panel", detail: "Turn it onto its front. Two people: the panel slides down the grooves in the posts and rests against the fixed shelf.", pose: "-z", kind: "general", people: 2 }, () => b.add(bkLo, [0, 0, -300]));
  step(b, { title: "Slide in the upper back panel", detail: "The same above the fixed shelf, up to the top rail.", pose: "-z", kind: "general", people: 2 }, () => b.add(bkUp, [0, 0, -300]));
  const clipX = spread(-xi + 100, xi - 100, 3);
  const clipAt: { on: string; y: number; z: number; dir: Vec3 }[] = [
    { on: fx, y: fxY - 10, z: zb + 34, dir: [0, 1, 0] },
    { on: bt, y: postH - topRail + 12, z: zb + 20, dir: [0, 0, -1] },
    { on: bp, y: pTop - 12, z: zb + 20, dir: [0, 0, -1] },
  ];
  step(b, { title: "Clip the back panels in place", detail: "Nine clips: three to the fixed shelf, three to the top rail and three to the plinth. A screw in each.", tools: ["screwdriver"], pose: "-z", kind: "screws" }, () => {
    b.fits({ kind: "clip", len: 12, dia: 20 }, clipAt.flatMap((c) => clipX.map((x): FitOpts => ({ on: c.on, at: [x, c.y, c.z], dir: c.dir, hole: false }))), 0.06);
    b.then(0.05);
    b.fits(SMALL_SCREW, clipAt.flatMap((c) => clipX.map((x): FitOpts => ({ on: c.on, at: [x, c.y, c.z], dir: c.dir }))), 0.05);
  });
  step(b, { title: "Stand it up and level the feet", detail: "Two people. Turn the adjustable feet until it stands steady and leans slightly to the wall.", pose: "+y", kind: "standup", people: 2, warnings: ["two"] });
  const brX = [-xi / 2, xi / 2];
  step(b, { title: "Fix it to the wall", detail: "Two L brackets on top, a screw and washer each into the top. Wall screws aren't included: pick ones made for your wall, with a washer.", tools: ["screwdriver", "drill"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    b.fits(BRACKET, brX.map((x): FitOpts => ({ on: top, at: [x, H, zb + 20], dir: [0, -1, 0], hole: false })), 0.15);
    b.then(0.05);
    b.fits(WASHER, brX.map((x): FitOpts => ({ on: top, at: [x, H + 3, zb + 30], dir: [0, -1, 0], hole: false })), 0.1);
    b.fits(SMALL_SCREW, brX.map((x): FitOpts => ({ on: top, at: [x, H + 4, zb + 30], dir: [0, -1, 0] })), 0.1);
    b.then(0.1);
    b.fits(WASHER, brX.map((x): FitOpts => ({ at: [x, H + 40, zb - 2], dir: [0, 0, -1], hole: false })), 0.1);
  });
  step(b, { title: "Screw in the bottom door stop", detail: "Into the hole in the middle of the fixed shelf, near the front.", tools: ["screwdriver"], kind: "screws" }, () =>
    b.fit({ kind: "screw", len: 20, dia: 8, name: "Door stop" }, { on: fx, at: [0, fxY + 10 + 16, zf - 30], dir: [0, -1, 0] }),
  );

  /* --- doors --- */
  const hingeX = (i: number) => (i ? 1 : -1) * (xi - 25);
  step(b, { title: "Screw the hinges onto the doors", detail: "Lay the doors face down on a rug. Two hinges on each, at the outer edge, two screws each.", tools: ["screwdriver"], scene: "doors", kind: "hinges", warnings: ["floor"] }, () => {
    b.stagger(0.2);
    doors.forEach((d, i) => b.stage(d, [(i - 0.5) * (dw + 80), dt / 2, 0], [Math.PI / 2, 0, 0], [0, 160, 0]));
    b.then(0.1);
    b.fits(HW.hinge, doors.flatMap((d, i) => hingeYs.map((yy): FitOpts => ({ on: d, at: [hingeX(i), yy, zf - dt], dir: [0, 0, 1], twist: i ? Math.PI : 0 }))), 0.12);
  });
  step(b, { title: "Click the doors on", detail: "Fold the hinge arms open, hook each onto its plate from the bottom and press until it clicks.", kind: "doors" }, () => {
    b.stagger(0.3);
    doors.forEach((d, i) => b.add(d, [(i ? 1 : -1) * 120, 0, 260]));
  });
  const knobY = Math.round(doorY0 + dh * 0.45);
  step(b, { title: "Screw on the door knobs", detail: "One on each door, near the middle edge. The bolt goes in from inside.", tools: ["screwdriver"], kind: "screws" }, () => {
    b.fits(KNOB, doors.map((d, i): FitOpts => ({ on: d, at: [(i ? 1 : -1) * 40, knobY, zf], dir: [0, 0, -1], hole: false })), 0.2);
    b.then(0.05);
    b.fits(KNOB_SCREW, doors.map((d, i): FitOpts => ({ on: d, at: [(i ? 1 : -1) * 40, knobY, zf - dt - 4], dir: [0, 0, 1], mate: d })), 0.15);
  });
  step(b, { title: "Push in the shelf pins", detail: "For each shelf, plugs in the two front posts and supports in the two back posts, at the heights you want.", kind: "shelves" }, () => {
    b.fits({ kind: "pin", len: 10, dia: 8 }, [0, 1].flatMap((i) => shelfYs.map((yy): FitOpts => ({ on: sides[i], at: [(i ? 1 : -1) * xi, yy - 13, zpf - 30], dir: [i ? 1 : -1, 0, 0] }))), 0.06);
    b.fits({ kind: "pin", len: 16, dia: 5 }, [0, 1].flatMap((i) => shelfYs.map((yy): FitOpts => ({ on: sides[i], at: [(i ? 1 : -1) * xi, yy - 13, zpb + 30], dir: [i ? 1 : -1, 0, 0] }))), 0.06);
  });
  step(b, { title: "Lay in the shelves", detail: "Tilt each one in through the open doors, then lower it onto its four supports.", kind: "shelves" }, () => {
    b.stagger(0.3);
    for (const k of shelves) b.add(k, [0, 0, 300]);
  });
  slideIn();
}

/** HEMNES guides drawn in this file; returns false for any product it doesn't build. Wired in from hemnes.ts. */
export function hemnesCabinets(b: PlanBuilder, s: ProductSpec): boolean {
  switch (s.slug) {
    case "hemnes-bookcase-49-x-197":
      buildCustom(b, { ...s, custom: bookcase49(s) });
      return true;
    case "hemnes-chest-6-drawers":
      chest6(b, s);
      return true;
    case "hemnes-glass-door-cabinet-3-drawers-90-x-197":
      glassCabinet(b, s);
      return true;
    default:
      return false;
  }
}
