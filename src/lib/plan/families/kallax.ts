import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartPiece, Pose, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * KALLAX, read from its manuals. Every frame is built lying on its back on a rug: two outer panels are bolted into
 * an L, the inside goes in one row at a time on wooden dowels (two at each joint, dowels on one end of each piece),
 * then the last side and the bottom are bolted on with long Allen bolts. Only the 1x4 differs: its three shelves hang
 * on cam pins and cam locks between the two long sides. Units sold lying down (147 wide) use the tall unit's manual,
 * stood on its long side. Underframes and inserts with a door follow their own manuals, after the frame.
 */

type Pattern = "small" | "big" | "cams";
const BOLT: HwDef = { kind: "bolt", len: 80, dia: 7 };
const DOWEL: HwDef = HW.dowel;
const PAD: HwDef = { kind: "glide", len: 4, dia: 22 };
const COVER: HwDef = { kind: "cap", len: 40, dia: 50 };
const CONNECTOR: HwDef = { kind: "connector", len: 18, dia: 40 };
const FRAME_BRACKET: HwDef = { kind: "angle", len: 70, dia: 40 };

interface Grid {
  W: number; // product, mm
  H: number; // product height of the shelf (without an underframe)
  D: number;
  U: number; // underframe height under it
  T: number;
  ti: number;
  cols: number;
  rows: number;
  lying: boolean; // a tall unit's manual, stood on its long side
  ct: number; // columns and rows as the manual builds it (tall)
  rt: number;
  Wt: number;
  Ht: number;
  pattern: Pattern;
}

function gridOf(s: ProductSpec): Grid | null {
  const p = s.shelf;
  if (s.archetype !== "shelf" || p?.style !== "grid" || !p.cols || !p.rows) return null;
  const cols = p.cols, rows = p.rows;
  const U = p.underframe ? Math.round(p.underframe * 10) : 0;
  const W = s.size.w * 10, H = s.size.h * 10 - U, D = s.size.d * 10;
  const T = p.outer ?? 40, ti = p.inner ?? 16;
  const lying = W > H + 50 && !(cols === 2 && rows === 1);
  const ct = lying ? rows : cols, rt = lying ? cols : rows;
  const Wt = lying ? H : W, Ht = lying ? W : H;
  const pattern: Pattern = ct === 1 && rt > 1 ? "cams" : ct >= 4 || rt === 1 ? "big" : "small";
  return { W, H, D, U, T, ti, cols, rows, lying, ct, rt, Wt, Ht, pattern };
}

/** Words for the panels as they end up, since a unit stood on its long side turns the manual's top into a side. */
function wordsOf(g: Grid) {
  return g.lying
    ? { A: "a side panel", B: "the bottom", C: "the top", Dd: "the other side panel", S: "divider", Ss: "dividers", V: "shelf", Vs: "shelves" }
    : { A: "the top", B: "a side", C: "the other side", Dd: "the bottom", S: g.ct >= 3 ? "long shelf" : "shelf", Ss: g.ct >= 3 ? "long shelves" : "shelves", V: "divider", Vs: "dividers" };
}

function frameRecipe(s: ProductSpec, g: Grid): { recipe: CustomParams; topId: string } {
  const { D, U, T, ti, ct, rt, Wt, Ht, lying } = g;
  const cellW = (Wt - 2 * T - (ct - 1) * ti) / ct;
  const cellH = (Ht - 2 * T - (rt - 1) * ti) / rt;
  // the manual's frame (tall, x across, y up) to the product's
  const P = (v: Vec3): Vec3 => (lying ? [v[1] - Ht / 2, v[0] + Wt / 2 + U, v[2]] : [v[0], v[1] + U, v[2]]);
  const Sz = (v: Vec3): Vec3 => (lying ? [v[1], v[0], v[2]] : v);
  const Dir = (v: Vec3): Vec3 => (lying ? [v[1], v[0], v[2]] : v);
  const pose = (p: Pose): Pose => (lying && p === "+x" ? "+y" : p);
  const w = wordsOf(g);

  const parts: CustomPart[] = [];
  const part = (id: string, name: string, size: Vec3, pos: Vec3) => parts.push({ id, name, size: Sz(size), pos: P(pos), material: "board" });
  const nameTB = lying ? "Side panel" : "Top and bottom";
  const nameSide = lying ? "Top and bottom" : "Side panel";
  part("A", nameTB, [Wt, T, D], [0, Ht - T / 2, 0]);
  part("D", nameTB, [Wt, T, D], [0, T / 2, 0]);
  part("B", nameSide, [T, Ht - 2 * T, D], [-Wt / 2 + T / 2, Ht / 2, 0]);
  part("C", nameSide, [T, Ht - 2 * T, D], [Wt / 2 - T / 2, Ht / 2, 0]);
  const rowTop = (j: number) => Ht - T - (j - 1) * (cellH + ti); // j from 1, counted from the manual's top
  const shelfY = (k: number) => rowTop(k) - cellH - ti / 2;
  const divX = (c: number) => -Wt / 2 + T + c * cellW + (c - 1) * ti + ti / 2;
  const sName = lying ? "Divider" : ct >= 3 ? "Long shelf" : "Shelf";
  const vName = lying ? "Shelf" : "Divider";
  for (let k = 1; k < rt; k++) part(`S${k}`, sName, [Wt - 2 * T, ti, D], [0, shelfY(k), 0]);
  for (let j = 1; j <= rt; j++) for (let c = 1; c < ct; c++) part(`V${j}_${c}`, vName, [ti, cellH, D], [divX(c), rowTop(j) - cellH / 2, 0]);

  const zs = D / 2 - 75;
  const xB = -Wt / 2 + T / 2, xC = Wt / 2 - T / 2;
  const fix = (kind: CustomFix["kind"], on: string, mate: string | undefined, dir: Vec3, pts: Vec3[], o: { len?: number; dia?: number } = {}): CustomFix => ({
    kind,
    count: pts.length,
    at: pts.map(P),
    dir: Dir(dir),
    on,
    mate,
    ...o,
  });
  const pair = (x: number, y: number): Vec3[] => [[x, y, -zs], [x, y, zs]];
  // the 3x3's manual puts two dowels side by side at the front and the back of each joint
  const dpair = (x: number, y: number): Vec3[] => (g.cols === 3 && g.rows === 3 ? [-zs, -zs + 32, zs - 32, zs].map((z) => [x, y, z] as Vec3) : pair(x, y));
  const boltsTop = (side: "B" | "C") => fix("bolt", "A", side, [0, -1, 0], pair(side === "B" ? xB : xC, Ht), { len: BOLT.len, dia: BOLT.dia });
  const boltsBottom = (side: "B" | "C") => fix("bolt", "D", side, [0, 1, 0], pair(side === "B" ? xB : xC, 0), { len: BOLT.len, dia: BOLT.dia });
  const vIds = (j: number) => Array.from({ length: ct - 1 }, (_, i) => `V${j}_${i + 1}`);
  const above = (j: number) => (j === 1 ? "A" : `S${j - 1}`);
  const below = (j: number) => (j === rt ? "D" : `S${j}`);
  const vTops = (j: number) => vIds(j).map((id, i) => fix("dowel", id, above(j), [0, -1, 0], dpair(divX(i + 1), rowTop(j))));
  const vBottoms = (j: number) => vIds(j).map((id, i) => fix("dowel", id, below(j), [0, 1, 0], dpair(divX(i + 1), rowTop(j) - cellH)));
  const shelfFace = (k: number) => fix("dowel", `S${k}`, undefined, [0, 1, 0], vIds(k + 1).flatMap((_, i) => dpair(divX(i + 1), shelfY(k) - ti / 2)));
  const shelfEnd = (k: number, side: "B" | "C") =>
    fix("dowel", `S${k}`, side, [side === "B" ? 1 : -1, 0, 0], dpair(side === "B" ? -Wt / 2 + T : Wt / 2 - T, shelfY(k)));

  const steps: CustomStep[] = [];
  const two = g.cols === 3 && g.rows === 3 ? "four" : "two";
  const Two = two[0].toUpperCase() + two.slice(1);
  const many = (n: number, one: string, more: string) => (n === 1 ? one : more);
  steps.push({
    title: `Bolt ${w.A} to ${w.B}`,
    detail: "Stand both on their long edges on a rug, with the holes facing in. Turn the bolts in with the Allen key, not too tight yet.",
    add: ["A", "B"],
    fix: [boltsTop("B")],
    tools: ["allen"],
    pose: "+z",
    warnings: ["floor"],
  });

  if (g.pattern === "cams") {
    // 1x4: cam pins in both sides, the shelves between them, cam locks, then the top and bottom bolted on
    const pins = (side: "B" | "C") =>
      Array.from({ length: rt - 1 }, (_, i) => fix("camScrew", side, `S${i + 1}`, [side === "B" ? -1 : 1, 0, 0], pair(side === "B" ? -Wt / 2 + T : Wt / 2 - T, shelfY(i + 1)), { len: 34 }));
    steps.length = 0;
    steps.push({
      title: "Screw the cam pins into one long side",
      detail: "Lay it flat on a rug with the holes up. Screw the pins in by hand until they stop.",
      fix: pins("B"),
      pose: pose("+x"),
      warnings: ["floor"],
    });
    steps.push({ title: `Stand the ${w.Ss} on the cam pins`, detail: "Holes for the cam locks face the same way on all of them.", add: Array.from({ length: rt - 1 }, (_, i) => `S${i + 1}`) });
    steps.push({ title: "Lay the other long side on top", detail: "Screw its cam pins in first, then lower it so every pin finds its hole.", add: ["C"], fix: pins("C") });
    const locks = Array.from({ length: rt - 1 }, (_, i) =>
      fix("cam", `S${i + 1}`, undefined, [0, -1, 0], [-1, 1].flatMap((sx) => pair(sx * (Wt / 2 - T - 28), shelfY(i + 1) + ti / 2)), { dia: 15 }),
    );
    steps.push({ title: "Turn the cam locks", detail: "Arrow towards the pin, then turn each one clockwise until it pulls the shelf tight.", fix: locks, tools: ["screwdriver"] });
    steps.push({ title: `Fit ${w.A} and ${w.Dd}`, detail: "Lay it on its back and push them onto the ends.", add: ["A", "D"], pose: "+z" });
    steps.push({ title: "Bolt them on", detail: "Two bolts in each corner. Tighten them all once everything sits square.", fix: [boltsTop("B"), boltsTop("C"), boltsBottom("B"), boltsBottom("C")], tools: ["allen"], check: "square" });
  } else {
    steps.push({
      title: many(ct - 1, `Tap dowels into a ${w.V} and push it onto ${w.A}`, `Tap dowels into ${ct - 1} ${w.Vs} and push them onto ${w.A}`),
      detail: `${Two} dowels go into one end of each, and that end goes into the panel. The other end stays plain.`,
      add: vIds(1),
      fix: vTops(1),
      tools: ["hammer"],
    });
    for (let k = 1; k < rt; k++) {
      const both = g.pattern === "big";
      steps.push({
        title: `Slide in ${k === 1 ? "a" : "the next"} ${w.S}`,
        detail: both
          ? `Tap ${two} dowels into each end first. It goes in along the row, its end into the side.`
          : `Tap ${two} dowels into the end that goes into the side, then push it against the row.`,
        add: [`S${k}`],
        fix: both ? [shelfEnd(k, "B"), shelfEnd(k, "C")] : [shelfEnd(k, "B")],
        tools: ["hammer"],
      });
      if (ct > 1) {
        steps.push({ title: `Tap dowels into the ${w.S} for the next row`, detail: `Into the holes on its open face, ${two} for each piece.`, fix: [shelfFace(k)], tools: ["hammer"] });
        steps.push({ title: many(ct - 1, `Push in the next ${w.V}`, `Push in the next row of ${w.Vs}`), detail: "Plain end first against the row before, onto the dowels.", add: vIds(k + 1) });
      }
    }
    if (g.pattern === "big") {
      steps.push({ title: `Fit ${w.C}`, detail: rt > 1 ? `Turn it up onto the ends of the ${w.Ss}, then bolt it to the first panel.` : "Stand it on its edge against the first panel and bolt it on.", add: ["C"], fix: [boltsTop("C")], tools: ["allen"] });
      if (ct > 1) steps.push({ title: many(ct - 1, `Tap dowels into the free end of the ${w.V}`, `Tap dowels into the last row of ${w.Vs}`), detail: `Into the open ends, ${two} in each.`, fix: vBottoms(rt), tools: ["hammer"] });
      steps.push({
        title: `Bolt on ${w.Dd}`,
        detail: "Turn it up onto the dowels, then two bolts at each end. Tighten all the bolts now.",
        add: ["D"],
        fix: [boltsBottom("B"), boltsBottom("C")],
        tools: ["allen"],
        check: "square",
      });
    } else {
      steps.push({
        title: "Tap dowels into the open ends",
        detail: `${Two} into each ${w.S} end and ${two} into each piece in the last row.`,
        fix: [...Array.from({ length: rt - 1 }, (_, i) => shelfEnd(i + 1, "C")), ...vBottoms(rt)],
        tools: ["hammer"],
      });
      steps.push({ title: `Slide on ${w.C}`, detail: "Line it up and press it onto all the dowels at once.", add: ["C"] });
      steps.push({
        title: `Bolt on ${w.Dd}`,
        detail: "Turn it up onto the dowels and bolt it on. Then bolt the other side to the first panel, and tighten everything.",
        add: ["D"],
        fix: [boltsBottom("B"), boltsBottom("C"), boltsTop("C")],
        tools: ["allen"],
        check: "square",
      });
    }
  }

  const wallHung = g.rows === 1 && g.cols <= 2;
  if (!wallHung && !g.U) {
    // felt pads under the bottom: four on a tall unit, eight along a unit on its side, a row under each upright on the big squares
    const pads: Vec3[] = [];
    const zp = D / 2 - 40;
    const xs = lying
      ? [0, 1, 2, 3].map((i) => -g.W / 2 + 40 + ((g.W - 80) * i) / 3)
      : g.ct >= 4 || (g.ct === 3 && g.rt === 3) // the 3x3's manual has a pad under each upright too
        ? [-g.W / 2 + T / 2, ...Array.from({ length: g.ct - 1 }, (_, i) => divX(i + 1)), g.W / 2 - T / 2]
        : [-g.W / 2 + 40, g.W / 2 - 40];
    for (const z of [-zp, zp]) for (const x of xs) pads.push([x, 0, z]);
    const bottomId = lying ? "B" : "D";
    steps.push({ title: "Stick the felt pads under it", detail: "Peel them off the sheet and press them on near the edges of the bottom.", fix: [{ kind: "glide", count: pads.length, at: pads, dir: [0, 1, 0], on: bottomId, len: PAD.len, dia: PAD.dia }] });
  }
  if (!wallHung) {
    const big = g.W >= 1100 || g.H >= 1100;
    steps.push({
      title: g.U ? (big ? "Turn it upside down together" : "Turn it upside down") : big ? "Stand it up together" : "Stand it up",
      detail: g.U ? "On the rug, so the bottom faces up for the underframe." : "Lift it upright, don't pull it up by one corner.",
      pose: g.U ? "-y" : "+y",
      people: big ? 2 : 1,
      warnings: big ? ["two"] : [],
    });
  }
  return { recipe: { parts, steps }, topId: lying ? "C" : "A" };
}

function keyAt(b: PlanBuilder, pos: Vec3) {
  const it = b.items.find((x) => x.kind === "part" && x.final.pos.every((v, i) => Math.abs(v - pos[i]) < 0.5));
  return it?.key;
}

/** Brackets inside the top corner cubes, screwed up into the top, then onto screws in the wall (not included). */
function wallStep(b: PlanBuilder, g: Grid, topPos: Vec3) {
  const top = keyAt(b, topPos);
  if (!top) return;
  const wallHung = g.rows === 1 && g.cols <= 2;
  const n = g.lying && g.ct === 1 ? 3 : 2;
  const yTop = g.U + g.H - g.T;
  const xIn = g.W / 2 - g.T - 60;
  const xs = n === 3 ? [-xIn, 0, xIn] : [-xIn, xIn];
  const backZ = -g.D / 2;
  b.step(
    {
      title: wallHung ? "Hang it on the wall together" : "Fix it to the wall",
      detail: wallHung
        ? "Screw the brackets under the top, then hold it level against the wall to mark the screws. Wall screws aren't included: pick ones made for your wall."
        : "Screw the brackets under the top at the back, hook them onto screws in the wall and snap the covers on. Wall screws aren't included: pick ones made for your wall.",
      tools: ["screwdriver", "drill", "pencil", "level"],
      kind: "anchor",
      wall: true,
      people: wallHung ? 2 : 1,
      warnings: wallHung ? ["wall", "two"] : ["wall", "tip"],
    },
    () => {
      b.stagger(0.2);
      for (const x of xs) b.fit(HW.bracket, { on: top, at: [x, yTop, backZ + 16], dir: [0, 1, 0], travel: 60 });
      b.then(0.1);
      const sc: FitOpts[] = [];
      for (const x of xs) for (const dx of [-12, 12]) sc.push({ on: top, at: [x + dx, yTop, backZ + 26], dir: [0, 1, 0], hole: false });
      b.fits(HW.screwS, sc, 0.1);
      b.then(0.1);
      for (const x of xs) b.fit(HW.plug, { at: [x, yTop - 30, backZ], dir: [0, 0, -1] });
      b.then(0.05);
      for (const x of xs) b.fit(HW.wallScrew, { at: [x, yTop - 30, backZ + 2], dir: [0, 0, -1] });
      b.then(0.1);
      for (const x of xs) b.fit(COVER, { on: top, at: [x, yTop - 30, backZ + 40], dir: [0, 0, -1], hole: false });
    },
  );
}

/** The underframe's own manual: four rails hooked onto four legs and screwed, feet in, connectors under the shelf, lowered on. */
function underframeSteps(b: PlanBuilder, g: Grid) {
  const { W, D, U } = g;
  const lw = 45, rh = 60, rt = 18;
  const xl = W / 2 - lw / 2, zl = D / 2 - lw / 2;
  const legT = b.part("Leg", [lw, U, lw], { material: "wood" });
  const longT = b.part("Long rail", [W - 2 * lw, rh, rt], { material: "wood" });
  const shortT = b.part("Short rail", [rt, rh, D - 2 * lw], { material: "wood" });
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ k: b.place(legT, [sx * xl, U / 2, sz * zl]), x: sx * xl, z: sz * zl })));
  const rails = [
    ...[-1, 1].map((sz) => ({ k: b.place(longT, [0, U - rh / 2, sz * (D / 2 - rt / 2)]), x: 0, z: sz * (D / 2 - rt / 2), long: true })),
    ...[-1, 1].map((sx) => ({ k: b.place(shortT, [sx * (W / 2 - rt / 2), U - rh / 2, 0]), x: sx * (W / 2 - rt / 2), z: 0, long: false })),
  ];
  const all = [...legs.map((l) => l.k), ...rails.map((r) => r.k)];
  // staged upside down on its own, as the manual builds it
  const flip = (k: string): void => {
    const f = b.partItem(k).final;
    b.stage(k, [f.pos[0], U - f.pos[1], f.pos[2]], [0, 0, Math.PI], [0, 160, 0]);
  };
  b.step(
    { title: "Hook the rails onto the legs", detail: "Upside down on the floor. Each rail end drops into the slot at the top of a leg.", scene: "frame", kind: "join", warnings: ["floor"] },
    () => {
      b.stagger(0.12);
      for (const k of legs.map((l) => l.k)) flip(k);
      b.then(0.1);
      for (const k of rails.map((r) => r.k)) flip(k);
    },
  );
  b.step({ title: "Screw the rails to the legs", detail: "One screw at each corner.", scene: "frame", tools: ["screwdriver"], kind: "screws" }, () => {
    const list: FitOpts[] = legs.map((l) => ({ on: l.k, at: [l.x - Math.sign(l.x) * (lw / 2), U - rh / 2, l.z] as Vec3, dir: [Math.sign(l.x), 0, 0] as Vec3 }));
    b.fits({ kind: "screw", len: 16, dia: 4 }, list, 0.12);
  });
  b.step({ title: "Screw the feet into the legs", detail: "By hand, all the way in. You can turn them out later to level it.", scene: "frame", kind: "legs" }, () => {
    b.fits(
      HW.foot,
      legs.map((l) => ({ on: l.k, at: [l.x, 0, l.z] as Vec3, dir: [0, 1, 0] as Vec3 })),
      0.12,
    );
  });
  const xc = W / 2 - g.T / 2, zc = D / 2 - 75;
  b.step(
    {
      title: g.lying ? "Fit the brackets to the bottom corners" : "Fit the connectors to the bottom corners",
      detail: g.lying
        ? "Undo the four bolts at the bottom corners, put each through a bracket with its connector, and turn it back in."
        : "Undo the four bolts at the bottom corners, put each through a connector, and turn it back in.",
      tools: ["allen", "screwdriver"],
      pose: "-y",
      kind: "bolts",
    },
    () => {
      const pts: Vec3[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * xc, U, sz * zc] as Vec3));
      if (g.lying) b.fits(FRAME_BRACKET, pts.map((at) => ({ at, dir: [0, 1, 0] as Vec3 })), 0.12);
      b.then(0.1);
      b.fits(CONNECTOR, pts.map((at) => ({ at: [at[0], at[1] - 2, at[2]] as Vec3, dir: [0, 1, 0] as Vec3 })), 0.12);
    },
  );
  const big = W >= 1100 || g.H + U >= 1100;
  b.step(
    {
      title: big ? "Lower it onto the underframe together" : "Lower it onto the underframe",
      detail: "Turn it upright and set it straight down, so each connector drops into a leg.",
      people: big ? 2 : 1,
      pose: "+y",
      kind: "standup",
      warnings: big ? ["two"] : [],
    },
    () => {
      b.stagger(0);
      for (const k of all) b.add(k, [0, -260, 0]);
    },
  );
}

/** Inserts with a door, from their own manual: the folded insert into its cube, hinge plates, door on its hinges, knob. */
function insertRecipe(g: Grid, n: number): CustomParams {
  const { W, H, D, U, T, ti, cols, rows } = g;
  const cw = (W - 2 * T - (cols - 1) * ti) / cols, ch = (H - 2 * T - (rows - 1) * ti) / rows;
  const cx = (c: number) => -W / 2 + T + c * (cw + ti) + cw / 2;
  const cy = (r: number) => U + H - T - r * (ch + ti) - ch / 2; // r from the top
  // the middle rows fill first, as in IKEA's photos
  const order = Array.from({ length: rows }, (_, r) => r).sort((a, b) => Math.abs(a - (rows - 1) / 2) - Math.abs(b - (rows - 1) / 2) || a - b);
  const cells = order.flatMap((r) => Array.from({ length: cols }, (_, c) => [c, r] as const)).slice(0, n);
  const wt = 8, dt = 16;
  const bd = D - dt - 2;
  const zb = -D / 2 + bd / 2;
  const pieces: PartPiece[] = [
    { shape: "box", size: [wt, ch, bd], pos: [-cw / 2 + wt / 2, 0, 0] },
    { shape: "box", size: [wt, ch, bd], pos: [cw / 2 - wt / 2, 0, 0] },
    { shape: "box", size: [cw - 2 * wt, wt, bd], pos: [0, ch / 2 - wt / 2, 0] },
    { shape: "box", size: [cw - 2 * wt, wt, bd], pos: [0, -ch / 2 + wt / 2, 0] },
    { shape: "box", size: [cw - 2 * wt, ch - 2 * wt, 3], pos: [0, 0, -bd / 2 + 1.5] },
  ];
  const parts: CustomPart[] = [];
  cells.forEach(([c, r], i) => {
    parts.push({ id: `I${i}`, name: "Insert", size: [cw, ch, bd], pos: [cx(c), cy(r), zb], pieces, material: "board" });
    parts.push({ id: `F${i}`, name: "Door", size: [cw - 4, ch - 4, dt], pos: [cx(c), cy(r), D / 2 - dt / 2], material: "board" });
  });
  const inner = (c: number) => cx(c) - cw / 2 + wt;
  const hingeYs = (r: number) => [cy(r) + ch / 2 - 70, cy(r) - ch / 2 + 70];
  const zFront = D / 2 - dt;
  const rep = n > 1 ? n : undefined;
  const fixes = (kind: CustomFix["kind"], dir: Vec3, pts: (c: number, r: number, i: number) => Vec3[], on: (i: number) => string, o: Partial<CustomFix> = {}): CustomFix[] =>
    cells.map(([c, r], i) => ({ kind, count: 0, at: pts(c, r, i), dir, on: on(i), ...o }));
  const steps: CustomStep[] = [
    {
      title: n > 1 ? "Fold the inserts and push them into their cubes" : "Fold the insert and push it into its cube",
      detail: "Fold the panels round on their joins until they click, then slide it in until it meets the back edge.",
      add: cells.map((_, i) => `I${i}`),
      from: Object.fromEntries(cells.map((_, i) => [`I${i}`, [0, 0, 460] as Vec3])),
      repeat: rep,
    },
    {
      title: "Screw in the hinge plates",
      detail: "Two plates on the left wall of each insert, two screws in each.",
      fix: fixes("screw", [-1, 0, 0], (c, r) => hingeYs(r).flatMap((y) => [[inner(c), y + 16, zFront - 40], [inner(c), y - 16, zFront - 40]] as Vec3[]), (i) => `I${i}`, { len: 12, dia: 4 }),
      tools: ["screwdriver"],
      repeat: rep,
    },
    {
      title: "Screw the insert to the cube",
      detail: "Two screws through the bottom of the insert into the shelf under it.",
      fix: fixes("screw", [0, -1, 0], (c, r) => [-1, 1].map((sx) => [cx(c) + (sx * cw) / 4, cy(r) - ch / 2 + wt, zb + bd / 3] as Vec3), (i) => `I${i}`, { len: 16, dia: 4 }),
      tools: ["screwdriver"],
      repeat: rep,
    },
    {
      title: n > 1 ? "Screw the hinges on and hang the doors" : "Screw the hinge on and hang the door",
      detail: "Two hinges near the left edge of each door. Clip them onto the plates, then turn the screws until the gaps look even.",
      add: cells.map((_, i) => `F${i}`),
      from: Object.fromEntries(cells.map((_, i) => [`F${i}`, [0, 0, 360] as Vec3])),
      fix: fixes("hinge", [0, 0, 1], (c, r) => hingeYs(r).map((y) => [cx(c) - cw / 2 + 24, y, zFront] as Vec3), (i) => `F${i}`),
      tools: ["screwdriver"],
      repeat: rep,
    },
    {
      title: n > 1 ? "Fit the knobs and the door stops" : "Fit the knob and the door stops",
      detail: "The knob screws on from the back of the door. The two little stops go inside, behind its right edge.",
      fix: [
        ...fixes("knob", [0, 0, -1], (c, r) => [[cx(c) + cw / 2 - 40, cy(r), D / 2] as Vec3], (i) => `F${i}`),
        ...fixes("glide", [0, 0, 1], (c, r) => [cy(r) + ch / 2 - 40, cy(r) - ch / 2 + 40].map((y) => [cx(c) + cw / 2 - 30, y, zFront] as Vec3), (i) => `F${i}`, { len: 3, dia: 12 }),
      ],
      tools: ["screwdriver"],
      repeat: rep,
    },
  ];
  // the custom builder takes ten fittings a step: share the rest over extra copies of the same step
  const out: CustomStep[] = [];
  for (const st of steps) {
    const f = st.fix ?? [];
    if (f.length <= 10) out.push(st);
    else for (let i = 0; i < f.length; i += 10) out.push({ ...st, fix: f.slice(i, i + 10), add: i ? [] : st.add });
  }
  for (const st of out) for (const f of st.fix ?? []) f.count = f.at?.length ?? f.count;
  return { parts, steps: out };
}

/**
 * The desk, from its own manual: a two-cube column (two sides, a middle shelf on cam locks, a bottom screwed on with
 * long screws), a three-board cable rail between the column and a leg panel, all built lying on its back, then stood
 * up and the top dowelled and cammed on. The column can go left or right; this is the right-hand build, as photographed.
 */
function deskRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const tt = 30, lt = 30, t = 16, cw = 362; // top, leg panel, column boards, column width
  const yTop = H - tt;
  const x0 = W / 2 - cw, x1 = W / 2; // the column's outer faces
  const xl = -W / 2 + lt; // the leg panel's inner face
  const yS = (t + yTop) / 2;
  // the rail at the back under the top: a base, a web standing on its front edge, and a narrow top board
  const yR = yTop - 50, rb = 120, rw = 25, rt = 60;
  const zB = -D / 2;
  const yRT = yR - t / 2, yRW = yR - t - 49, yRB = yR - t - 98 - t / 2;
  const zw = zB + rb - rw / 2;
  const railX = (xl + x0) / 2, railL = x0 - xl;
  const parts: CustomPart[] = [
    { id: "CL", name: "Side panel", size: [t, yTop - t, D], pos: [x0 + t / 2, t + (yTop - t) / 2, 0] },
    { id: "CR", name: "Side panel", size: [t, yTop - t, D], pos: [x1 - t / 2, t + (yTop - t) / 2, 0] },
    { id: "CS", name: "Shelf", size: [cw - 2 * t, t, D], pos: [(x0 + x1) / 2, yS, 0] },
    { id: "CB", name: "Bottom panel", size: [cw, t, D], pos: [(x0 + x1) / 2, t / 2, 0] },
    { id: "RW", name: "Rail web", size: [railL, 98, rw], pos: [railX, yRW, zw] },
    { id: "RB", name: "Rail base", size: [railL, t, rb], pos: [railX, yRB, zB + rb / 2] },
    { id: "RT", name: "Rail top", size: [railL, t, rt], pos: [railX, yRT, zB + rb - rt / 2] },
    { id: "L", name: "Leg panel", size: [lt, yTop, D], pos: [-W / 2 + lt / 2, yTop / 2, 0] },
    { id: "T", name: "Desk top", size: [W, tt, D], pos: [0, H - tt / 2, 0] },
  ];
  for (const p of parts) p.material = "board";
  const zz = D / 2 - 50;
  const pts = (xs: number[], ys: number[], zs: number[]) => xs.flatMap((x) => ys.flatMap((y) => zs.map((z) => [x, y, z] as Vec3)));
  const fx = (kind: CustomFix["kind"], on: string, dir: Vec3, at: Vec3[], o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, on, dir, at, ...o });
  // the rail's ends: one cam bolt into the top board, three into the web, at each end
  const railYs = [yRW - 30, yRW, yRW + 30];
  const railBolts = (x: number): Vec3[] => [[x, yRT, zB + rb - rt / 2], ...railYs.map((y) => [x, y, zw] as Vec3)];
  const bigCam = { dia: 20, len: 16, name: "Large cam lock" };
  const fly: Vec3 = [-640, 0, 0];
  const steps: CustomStep[] = [
    {
      title: "Screw cam bolts into the column sides",
      detail: "Two in each side, in the holes halfway up the inner face. Pick the side the column goes on first: the holes work both ways.",
      fix: [fx("camScrew", "CL", [-1, 0, 0], pts([x0 + t], [yS], [-zz + 40, zz - 40]), { mate: "CS" }), fx("camScrew", "CR", [1, 0, 0], pts([x1 - t], [yS], [-zz + 40, zz - 40]), { mate: "CS" })],
      tools: ["screwdriver"],
      pose: "+z",
      warnings: ["floor"],
    },
    { title: "Fit the middle shelf between the sides", detail: "Stand the sides on their long edges and push the shelf onto the cam bolts.", add: ["CL", "CS", "CR"] },
    {
      title: "Lock the shelf with cam locks",
      detail: "Use the small cam locks, not the ones with a sleeve. Turn each one clockwise until it pulls tight.",
      fix: [fx("cam", "CS", [0, -1, 0], pts([x0 + t + 30, x1 - t - 30], [yS + t / 2], [-zz + 40, zz - 40]))],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the bottom on",
      detail: "Four long screws through the bottom into the ends of the sides, with the Allen key.",
      add: ["CB"],
      fix: [fx("bolt", "CB", [0, 1, 0], pts([x0 + t / 2, x1 - t / 2], [0], [-zz, zz]), { len: 80, dia: 7 })],
      tools: ["allen"],
    },
    {
      title: "Screw cam bolts in for the rail",
      detail: "Four in a row near the top, on the outside of the side that faces the knee space.",
      fix: [fx("camScrew", "CL", [1, 0, 0], railBolts(x0), { mate: "RW" })],
      tools: ["screwdriver"],
    },
    {
      title: "Tap dowels into the rail web",
      detail: "Two along each long edge, with a hammer.",
      fix: [
        fx("dowel", "RW", [0, 1, 0], pts([railX - railL / 3, railX + railL / 3], [yRW - 49], [zw]), { mate: "RB" }),
        fx("dowel", "RW", [0, -1, 0], pts([railX - railL / 3, railX + railL / 3], [yRW + 49], [zw]), { mate: "RT" }),
      ],
      tools: ["hammer"],
      wait: ["RW", "RB"],
      from: { RW: fly, RB: fly },
    },
    { title: "Press the web onto the rail base", detail: "Its dowels go into the holes along the front edge of the base. Press it down until it sits flat." },
    {
      title: "Tap dowels into the ends of the rail top",
      detail: "One in each end.",
      fix: [fx("dowel", "RT", [1, 0, 0], [[x0, yRT, zB + rb - rt / 2 + 18], [xl, yRT, zB + rb - rt / 2 + 18]])],
      tools: ["hammer"],
      wait: ["RT"],
      from: { RT: fly },
    },
    { title: "Press the rail top onto the web", detail: "Line its holes up with the dowels sticking out of the web and press it down." },
    {
      title: "Slide the rail onto the column",
      detail: "Its end goes over the cam bolts and the dowel. Keep the base underneath.",
      add: ["RB", "RW", "RT"],
      from: { RB: fly, RW: fly, RT: fly },
    },
    {
      title: "Screw cam bolts into the leg panel",
      detail: "Four in a row near the top of its inner face, matching the column.",
      fix: [fx("camScrew", "L", [-1, 0, 0], railBolts(xl), { mate: "RW" })],
      tools: ["screwdriver"],
      wait: ["L"],
      from: { L: [-360, 0, 0] },
    },
    { title: "Push the leg panel onto the rail", add: ["L"], from: { L: [-360, 0, 0] } },
    {
      title: "Lock the rail top with cam locks",
      detail: "One at each end, in the top board.",
      fix: [fx("cam", "RT", [0, -1, 0], [[x0 - 30, yR, zB + rb - rt / 2], [xl + 30, yR, zB + rb - rt / 2]])],
      tools: ["screwdriver"],
    },
    {
      title: "Stick the felt pads on",
      detail: "Four under the column's bottom and two under the leg panel.",
      fix: [
        fx("glide", "CB", [0, 1, 0], pts([x0 + 40, x1 - 40], [0], [-zz, zz]), { len: 4, dia: 22 }),
        fx("glide", "L", [0, 1, 0], pts([-W / 2 + lt / 2], [0], [-zz, zz]), { len: 4, dia: 22 }),
      ],
    },
    {
      title: "Stand it up and lock the rail's ends",
      detail: "Three cam locks at each end, in the front of the web.",
      fix: [fx("cam", "RW", [0, 0, -1], [...railYs.map((y) => [x0 - 30, y, zw + rw / 2] as Vec3), ...railYs.map((y) => [xl + 30, y, zw + rw / 2] as Vec3)])],
      tools: ["screwdriver"],
      pose: "+y",
      people: 2,
    },
    {
      title: "Tap dowels into the top edges",
      detail: "Two in the leg panel and two in each side of the column.",
      fix: [fx("dowel", "L", [0, -1, 0], pts([-W / 2 + lt / 2], [yTop], [-zz, zz]), { mate: "T" }), ...["CL", "CR"].map((id, i) => fx("dowel", id, [0, -1, 0], pts([i ? x1 - t / 2 : x0 + t / 2], [yTop], [-zz, zz]), { mate: "T" }))],
      tools: ["hammer"],
    },
    {
      title: "Screw cam bolts into the desk top",
      detail: "Six, in the holes on its underside. Lay it face down on the rug.",
      fix: [fx("camScrew", "T", [0, 1, 0], pts([-W / 2 + lt / 2, x0 + t / 2, x1 - t / 2], [yTop], [-zz + 90, zz - 90]))],
      tools: ["screwdriver"],
      wait: ["T"],
    },
    { title: "Lower the top onto it", detail: "Turn it over and let the dowels and cam bolts find their holes.", add: ["T"], from: { T: [0, 360, 0] } },
    {
      title: "Lock the top with the large cam locks",
      detail: "The ones with a sleeve, two in each panel just under the top. Turn each one clockwise.",
      fix: [
        fx("cam", "L", [1, 0, 0], pts([xl], [yTop - 25], [-zz + 90, zz - 90]), bigCam),
        fx("cam", "CL", [1, 0, 0], pts([x0], [yTop - 25], [-zz + 90, zz - 90]), bigCam),
        fx("cam", "CR", [1, 0, 0], pts([x1 - t], [yTop - 25], [-zz + 90, zz - 90]), bigCam),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Press caps into the holes you didn't use",
      detail: "Eight small caps, in the rail holes for the other way round: four on the column, four on the leg.",
      fix: [
        fx("cap", "CL", [1, 0, 0], [yRT, ...railYs].map((y) => [x0, y, -zw] as Vec3), { dia: 8, len: 2 }),
        fx("cap", "L", [-1, 0, 0], [yRT, ...railYs].map((y) => [xl, y, -zw] as Vec3), { dia: 8, len: 2 }),
      ],
    },
    {
      title: "Cover the two front cam locks",
      detail: "One cap on the leg panel and one on the column, by the knee space.",
      fix: [fx("cap", "L", [-1, 0, 0], [[xl, yTop - 25, zz - 90]], { dia: 20, len: 2, name: "Cam lock cover" }), fx("cap", "CL", [1, 0, 0], [[x0, yTop - 25, zz - 90]], { dia: 20, len: 2, name: "Cam lock cover" })],
    },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["KALLAX"],
  build(b, s) {
    if (/^kallax-desk/.test(s.slug ?? "")) {
      buildCustom(b, { ...s, custom: deskRecipe(s) });
      return true;
    }
    const g = gridOf(s);
    if (!g) return false;
    const { recipe, topId } = frameRecipe(s, g);
    buildCustom(b, { ...s, custom: recipe });
    if (g.U) underframeSteps(b, g);
    wallStep(b, g, recipe.parts.find((p) => p.id === topId)!.pos);
    const n = Math.round(s.shelf?.inserts ?? 0);
    if (n > 0) buildCustom(b, { ...s, custom: insertRecipe(g, Math.min(n, g.cols * g.rows)) });
    return true;
  },
};
export default family;
