import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * TROFAST, read from IKEA's manuals. Every frame is built on a rug from sides, dividers and top and bottom
 * "frames" (a panel with a rail along its front and back edge), on wooden dowels, and held with long Allen-key
 * screws through the sides. The pine frames have the box runners milled into their sides and the panels slide into
 * grooved rails; the white ones have plastic runners clicked in with a plastic screw each, and separate rails.
 *   Single frames are built lying on one side, screwed through the top side, then flipped and screwed through the
 *   other. Wide pine frames start from the bottom and one side standing, then lie on their back for the dividers.
 *   The stepped frames lie on their back throughout; the wide white one is built upside down.
 *   Tall frames get one or two wall brackets under the top; wide pine ones get box stops in the middle column.
 *   The desks are two small pine frames from their own manual, joined by a middle top on two metal rails and a
 *   low stretcher on two corner brackets. Wall storage is built standing and hung on two adjustable fittings.
 */

type Kind = CustomFix["kind"];
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
/** n points from a to b, kept in from the ends by a share of the length. */
const spread = (a: number, b: number, n: number, inset = 0.2): number[] =>
  n === 1 ? [(a + b) / 2] : range(n).map((i) => a + (b - a) * inset + ((b - a) * (1 - 2 * inset) * i) / (n - 1));

const T = 18; // sides and dividers
const RH = 50; // rail height
const RT = 22; // pine rail, front to back
const WT = 18; // white rail, front to back
const PT = 14; // pine panel in its grooves
const BOLT = { len: 60, dia: 6 };
const RUNNER_SCREW = { len: 10, dia: 6 };

/** A recipe being written: parts where they end up and the steps that add them. */
function recipeKit() {
  const parts: CustomPart[] = [];
  const steps: CustomStep[] = [];
  const boxes = new Map<string, { min: Vec3; max: Vec3 }>();
  const part = (id: string, name: string, size: Vec3, pos: Vec3, o: { mat?: PartMaterial; pieces?: PartPiece[]; rot?: Vec3; shape?: "box" | "cyl" } = {}) => {
    parts.push({ id, name, size, pos, material: o.mat ?? "wood", pieces: o.pieces, rot: o.rot, shape: o.shape });
    boxes.set(id, { min: [pos[0] - size[0] / 2, pos[1] - size[1] / 2, pos[2] - size[2] / 2], max: [pos[0] + size[0] / 2, pos[1] + size[1] / 2, pos[2] + size[2] / 2] });
  };
  const bx = (id: string) => {
    const b = boxes.get(id);
    if (!b) throw new Error(`TROFAST: no part ${id}`);
    return b;
  };
  const mid = (id: string, k: number) => (bx(id).min[k] + bx(id).max[k]) / 2;
  const fx = (kind: Kind, on: string | undefined, at: Vec3[], dir: Vec3, mate?: string, o: { len?: number; dia?: number } = {}): CustomFix => ({ kind, count: at.length, at, dir, on, mate, ...o });

  /**
   * Points across the end of a rail or panel, at plane x: along its height for a rail, along its depth for a panel.
   * Dowels and the screw beside them never share a spot (the guide keeps fittings 22 mm apart): a lone dowel in a
   * rail sits low with the screw in the middle, and a panel's screw sits off centre between its dowels.
   */
  const endPts = (id: string, x: number, n: number, screw = false): Vec3[] => {
    const b = bx(id);
    const ey = b.max[1] - b.min[1], ez = b.max[2] - b.min[2];
    const yc = mid(id, 1), zc = mid(id, 2);
    if (ey >= ez) {
      if (screw) return n === 1 ? [[x, yc, zc]] : spread(b.min[1], b.max[1], n, 0.2).map((y) => [x, y, zc] as Vec3);
      return n === 1 ? [[x, yc - 14, zc]] : spread(b.min[1], b.max[1], n, 0.2).map((y) => [x, y, zc] as Vec3);
    }
    if (screw) return n === 1 ? [[x, yc, zc + 0.24 * ez]] : spread(b.min[2], b.max[2], n, 0.3).map((z) => [x, yc, z] as Vec3);
    return spread(b.min[2], b.max[2], n, 0.15).map((z) => [x, yc, z] as Vec3);
  };
  /** Dowels in the end of a horizontal piece, the end that meets an upright on side s (-1 its left end, 1 its right). */
  const endDowels = (id: string, s: -1 | 1, n: number, mate?: string) => fx("dowel", id, endPts(id, s < 0 ? bx(id).min[0] : bx(id).max[0], n), [-s, 0, 0], mate);
  /** Allen screws through an upright into the end of a horizontal piece. */
  const through = (upright: string, id: string, n: number) => {
    const left = mid(upright, 0) < mid(id, 0);
    return fx("bolt", upright, endPts(id, left ? bx(upright).min[0] : bx(upright).max[0], n, true), [left ? 1 : -1, 0, 0], id, BOLT);
  };
  /** Dowels in the end of an upright, the end (e = -1 bottom, 1 top) that meets a panel. */
  const uprightDowels = (id: string, e: -1 | 1, n: number, mate?: string) =>
    fx("dowel", id, spread(bx(id).min[2], bx(id).max[2], n, 0.2).map((z) => [mid(id, 0), e < 0 ? bx(id).min[1] : bx(id).max[1], z] as Vec3), [0, -e, 0], mate);
  /** Allen screws through a panel into the end of an upright standing on it (or hanging under it). */
  const throughPanel = (panel: string, upright: string, n: number) => {
    const below = mid(panel, 1) < mid(upright, 1);
    const b = bx(upright), ez = b.max[2] - b.min[2];
    const zs = n === 1 ? [mid(upright, 2) + 0.24 * ez] : spread(b.min[2], b.max[2], n, 0.35);
    return fx("bolt", panel, zs.map((z) => [mid(upright, 0), below ? bx(panel).min[1] : bx(panel).max[1], z] as Vec3), [0, below ? 1 : -1, 0], upright, BOLT);
  };
  return { parts, steps, part, bx, mid, fx, endDowels, through, uprightDowels, throughPanel };
}
type Kit = ReturnType<typeof recipeKit>;

/** Runner strips milled into a pine side, drawn on its inner face (+x of the part; the right-hand ones are turned round). */
function pineSide(H: number, D: number, yLo: number, yHi: number, faces: 1 | 2): PartPiece[] {
  const n = Math.max(2, Math.round((yHi - yLo) / 120));
  const ys = range(n).map((i) => yLo + ((i + 0.5) * (yHi - yLo)) / n - H / 2);
  const strips = (s: number) => ys.map((y) => ({ shape: "box" as const, size: [8, 16, D - 50] as Vec3, pos: [s * (T / 2 + 4), y, 0] as Vec3 }));
  return [{ shape: "box", size: [T, H, D], pos: [0, 0, 0] }, ...strips(1), ...(faces === 2 ? strips(-1) : [])];
}

/** Plastic runners on the inner face of a white side or divider: their ids and the plastic screws that hold them, one fix per face. */
function whiteRunners(k: Kit, upright: string, faces: (-1 | 1)[], n: number, yLo: number, yHi: number, D: number, prefix: string) {
  const ids: string[] = [];
  const screws: CustomFix[] = [];
  const x0 = k.mid(upright, 0);
  const ys = range(n).map((i) => yLo + ((i + 0.5) * (yHi - yLo)) / n);
  for (const f of faces) {
    const x = x0 + f * (T / 2 + 6);
    ys.forEach((y, i) => {
      const id = `${prefix}${f < 0 ? "l" : "r"}${i}`;
      k.part(id, "Runner", [12, 14, D - 60], [x, y, 0], { mat: "board" });
      ids.push(id);
    });
    screws.push(k.fx("screw", upright, ys.map((y) => [x + f * 6, y, 0] as Vec3), [-f, 0, 0], undefined, RUNNER_SCREW));
  }
  return { ids, screws };
}

/** One fix per kind and part, for a "build the other one the same way" step (a dowel looks the same either way round). */
function merged(fixes: CustomFix[]): CustomFix[] {
  const out = new Map<string, CustomFix>();
  for (const f of fixes) {
    const key = `${f.kind}|${f.on}|${f.kind === "dowel" ? "" : f.dir?.join(",")}`;
    const o = out.get(key);
    if (o) {
      o.at = [...(o.at ?? []), ...(f.at ?? [])];
      o.count = o.at.length;
      o.mate = undefined;
    } else out.set(key, { ...f, at: [...(f.at ?? [])] });
  }
  return [...out.values()];
}

/** The guide takes ten fixes a step: a step with more goes on in a second one, the first adding the parts. */
function splitSteps(steps: CustomStep[]): CustomStep[] {
  return steps.flatMap((st) => {
    const f = st.fix ?? [];
    if (f.length <= 10) return [st];
    return range(Math.ceil(f.length / 10)).map((i) => ({ ...st, fix: f.slice(i * 10, i * 10 + 10), add: i ? [] : st.add, title: i ? `${st.title} (the rest)` : st.title, repeat: i ? undefined : st.repeat }));
  });
}
const pushSplit = (k: Kit, st: CustomStep) => k.steps.push(st);

/** Wall brackets under the top at the back: each screwed up into the top with a washer, then to the wall. */
function wallStep(k: Kit, top: string, xs: number[], two: boolean): CustomStep {
  const b = k.bx(top);
  const y = b.min[1], z = b.min[2] + 20;
  const pts = xs.map((x) => [x, y, z] as Vec3);
  const sc = xs.map((x) => [x + 25, y, z] as Vec3);
  const wall = xs.map((x) => [x, y - 25, b.min[2] - 2] as Vec3);
  const hole = wall.map((q) => [q[0], q[1], q[2] - 25] as Vec3);
  return {
    title: "Fix it to the wall",
    detail: "Screw the bracket up under the top with a washer, then screw it to the wall through its slot. Wall screws and plugs aren't included: pick ones made for your wall.",
    fix: [
      k.fx("bracket", top, pts, [0, 1, 0]),
      k.fx("screw", top, sc, [0, 1, 0], undefined, { len: 16, dia: 4 }),
      k.fx("washer", top, sc, [0, 1, 0]),
      k.fx("plug", undefined, hole, [0, 0, -1]),
      k.fx("screw", undefined, wall, [0, 0, -1], undefined, { len: 50, dia: 5 }),
      k.fx("washer", undefined, wall, [0, 0, -1]),
    ],
    tools: ["screwdriver", "drill", "pencil"],
    wall: true,
    people: two ? 2 : 1,
    warnings: ["wall", "tip", ...(two ? (["two"] as const) : [])],
  };
}

/* ---------- small pine frame (32x44x52, 44x91; the desks' frames) ---------- */

function pineSingle(k: Kit, W: number, H: number, D: number, o: { ox?: number; p?: string; block?: boolean; steps?: boolean } = {}) {
  const ox = o.ox ?? 0, p = o.p ?? "";
  const id = (s: string) => p + s;
  const yLo = RH, yHi = H - RH;
  const pieces = pineSide(H, D, yLo, o.block ? yHi - 40 : yHi, 1);
  k.part(id("L"), "Side panel", [T, H, D], [ox - W / 2 + T / 2, H / 2, 0], { pieces });
  k.part(id("R"), "Side panel", [T, H, D], [ox + W / 2 - T / 2, H / 2, 0], { pieces, rot: [0, Math.PI, 0] });
  const iw = W - 2 * T;
  for (const [n, y] of [["T", H], ["B", RH]] as const) {
    k.part(id(`${n}P`), "Panel", [iw, PT, D - 2 * RT], [ox, y - PT / 2, 0]);
    k.part(id(`${n}F`), "Rail", [iw, RH, RT], [ox, y - RH / 2, D / 2 - RT / 2]);
    k.part(id(`${n}K`), "Rail", [iw, RH, RT], [ox, y - RH / 2, -D / 2 + RT / 2]);
  }
  if (o.block)
    for (const [s, sx] of [["L", 1], ["R", -1]] as const) {
      const x = ox + -sx * (W / 2 - T) + sx * 7;
      k.part(id(`K${s}`), "Runner block", [14, 18, D - 60], [x, yHi - 20, 0]);
    }
  const rails = ["TF", "TK", "BF", "BK"].map(id);
  const members = [...rails, id("TP"), id("BP")];
  const blockScrews = (s: "L" | "R") => {
    const b = id(`K${s}`), sx = s === "L" ? 1 : -1;
    return k.fx("screw", b, spread(-D / 2 + 30, D / 2 - 30, 3, 0.1).map((z) => [k.mid(b, 0) + sx * 7, yHi - 20, z] as Vec3), [-sx, 0, 0], id(s), { len: 16, dia: 4 });
  };
  const sideScrews = (s: "L" | "R") => ["TP", "TF", "TK", "BP", "BF", "BK"].map((m) => k.through(id(s), id(m), 1));
  const dowelsAll = (n: number) => rails.flatMap((r) => [k.endDowels(r, -1, n, id("L")), k.endDowels(r, 1, n, id("R"))]);
  if (o.steps === false) return { members, sideScrews, dowelsAll, blockScrews };

  if (o.block) {
    k.steps.push({
      title: "Screw a runner block onto each side",
      detail: "Lay the sides on a rug with the runners up. The block goes along the top end, three screws each.",
      add: [id("L"), id("KL")],
      fix: [blockScrews("L")],
      tools: ["screwdriver"],
      pose: "+x",
      warnings: ["floor"],
      repeat: 2,
    });
    k.steps.push({ title: "Tap dowels into both ends of the rails", detail: "Two in each end, sixteen in all.", add: rails, fix: dowelsAll(2), tools: ["hammer"] });
  } else {
    k.steps.push({ title: "Tap dowels into both ends of the rails", detail: "Two in each end.", add: rails, fix: dowelsAll(2), tools: ["hammer"], pose: "+x", warnings: ["floor"] });
  }
  k.steps.push({
    title: o.block ? "Slide the panels into the rails and stand them on a side" : "Slide the panels into the rails",
    detail: o.block
      ? "The groove in each rail takes the panel's edge, rails facing out. Push them together until the ends line up."
      : "The groove in each rail takes the panel's edge. Tap two dowels into each end of the panels too.",
    add: [id("TP"), id("BP")],
    fix: o.block ? [] : ["TP", "BP"].flatMap((m) => [k.endDowels(id(m), -1, 2, id("L")), k.endDowels(id(m), 1, 2, id("R"))]),
    tools: o.block ? [] : ["hammer"],
  });
  if (!o.block) k.steps.push({ title: "Stand the top and bottom on a side", detail: "Lay one side on the rug, runners up, and push both frames onto its dowel holes.", add: [id("L")] });
  k.steps.push({
    title: "Lay the other side on top",
    detail: o.block ? "Runners and block facing down. Press it on so every dowel finds its hole." : "Runners facing down. Press it on so every dowel finds its hole.",
    add: o.block ? [id("R"), id("KR")] : [id("R")],
    fix: o.block ? [blockScrews("R")] : [],
    tools: o.block ? ["screwdriver"] : [],
  });
  k.steps.push({ title: "Screw the side on", detail: "Six screws through the side into the rails and panels. Turn them in with the Allen key.", fix: sideScrews("R"), tools: ["allen"] });
  k.steps.push({ title: "Turn it over and screw the other side", detail: "Six more screws the same way.", fix: sideScrews("L"), tools: ["allen"], pose: "-x" });
  return { members, sideScrews, dowelsAll, blockScrews };
}

/* ---------- white single frames (34x44x56, 46x30x94, 46x30x145) ---------- */

function whiteSingle(k: Kit, W: number, H: number, D: number) {
  const tall = H > 1200, low = H < 700;
  k.part("L", "Side panel", [T, H, D], [-W / 2 + T / 2, H / 2, 0], { mat: "board" });
  k.part("R", "Side panel", [T, H, D], [W / 2 - T / 2, H / 2, 0], { mat: "board" });
  const iw = W - 2 * T;
  k.part("TP", "Top and bottom", [iw, 18, D], [0, H - 9, 0], { mat: "board" });
  k.part("BP", "Top and bottom", [iw, 18, D], [0, RH + 9, 0], { mat: "board" });
  for (const [n, y] of [["T", H - 18 - RH / 2], ["B", RH / 2]] as const) {
    k.part(`${n}F`, "Rail", [iw, RH, WT], [0, y, D / 2 - WT / 2], { mat: "board" });
    k.part(`${n}K`, "Rail", [iw, RH, WT], [0, y, -D / 2 + WT / 2], { mat: "board" });
  }
  const nR = low ? 4 : tall ? 10 : 6;
  const yLo = RH + 18, yHi = H - 18 - RH;
  const rl = whiteRunners(k, "L", [1], nR, yLo, yHi, D, "UL");
  const rr = whiteRunners(k, "R", [-1], nR, yLo, yHi, D, "UR");
  const rails = ["TF", "TK", "BF", "BK"];
  const sixScrews = (s: "L" | "R") => ["TP", "TF", "TK", "BP", "BF", "BK"].map((m) => k.through(s, m, 1));
  const runnerStep = (side: "L" | "R", r: { ids: string[]; screws: CustomFix[] }, first: boolean): CustomStep => ({
    title: first ? "Click the runners onto a side" : "Click the runners onto the other side",
    detail: "Lay the side on a rug. Press each runner into its holes, then turn its plastic screw in until it sits flat.",
    add: [side, ...r.ids],
    fix: r.screws,
    tools: ["screwdriver"],
    pose: "+x",
    warnings: ["floor"],
  });
  if (low) {
    // 34x44x56: runners first, then panels and rails stand on the lying side
    pushSplit(k, { ...runnerStep("L", rl, true), detail: "Lay both sides on a rug. Press each runner into its holes and turn its plastic screw in. Do the other side the same way.", repeat: 2 });
    k.steps.push({
      title: "Tap dowels into the top and bottom and stand them on the side",
      detail: "Three in each end. The side lies on the rug, runners up.",
      add: ["TP", "BP"],
      fix: [k.endDowels("TP", -1, 3, "L"), k.endDowels("BP", -1, 3, "L"), k.endDowels("TP", 1, 3, "R"), k.endDowels("BP", 1, 3, "R")],
      tools: ["hammer"],
    });
    k.steps.push({
      title: "Tap dowels into the rails and stand them in",
      detail: "Two in each end of the top rails, one in each end of the bottom ones. They go along the front and back edges.",
      add: rails,
      fix: [...["TF", "TK"].flatMap((r) => [k.endDowels(r, -1, 2, "L"), k.endDowels(r, 1, 2, "R")]), ...["BF", "BK"].flatMap((r) => [k.endDowels(r, -1, 1, "L"), k.endDowels(r, 1, 1, "R")])],
      tools: ["hammer"],
    });
    pushSplit(k, { title: "Lay the other side on top", detail: "Runners facing down, onto all the dowels at once.", add: ["R", ...rr.ids], fix: rr.screws, tools: ["screwdriver"] });
  } else {
    if (tall) {
      pushSplit(k, { ...runnerStep("L", rl, true), repeat: 2, detail: "Lay both sides on a rug. Press each runner into its holes and turn its plastic screw in, ten on each side." });
      k.steps.push({ title: "Stand the top and bottom on a side", detail: "Three dowels in each, into the side lying on the rug.", add: ["TP", "BP"], fix: [k.endDowels("TP", -1, 3, "L"), k.endDowels("BP", -1, 3, "L")], tools: ["hammer"] });
    } else {
      k.steps.push({
        title: "Stand the top and bottom on a side",
        detail: "Lay a side on a rug. Three dowels in each panel, pushed into the side.",
        add: ["L", "TP", "BP"],
        fix: [k.endDowels("TP", -1, 3, "L"), k.endDowels("BP", -1, 3, "L")],
        tools: ["hammer"],
        pose: "+x",
        warnings: ["floor"],
      });
    }
    k.steps.push({ title: "Stand the rails in", detail: "One dowel in the end of each, along the front and back edges.", add: rails, fix: rails.map((r) => k.endDowels(r, -1, 1, "L")), tools: ["hammer"] });
    k.steps.push({
      title: "Lay the other side on top",
      detail: "Tap ten dowels into the free ends first, then press the side down onto them, runners facing in.",
      add: tall ? ["R", ...rr.ids] : ["R"],
      fix: [k.endDowels("TP", 1, 3, "R"), k.endDowels("BP", 1, 3, "R"), ...rails.map((r) => k.endDowels(r, 1, 1, "R")), ...(tall ? rr.screws : [])],
      tools: ["hammer"],
    });
  }
  k.steps.push({ title: "Screw the side on", detail: "Six screws through the side into the panels and rails, with the Allen key.", fix: sixScrews("R"), tools: ["allen"] });
  k.steps.push({ title: "Turn it over and screw the other side", detail: "Six more screws the same way.", fix: sixScrews("L"), tools: ["allen"], pose: "-x" });
  if (!low && !tall) {
    pushSplit(k, {
      title: "Stand it up and click in the runners",
      detail: "Press each runner into its holes, then turn its plastic screw in until it sits flat.",
      add: [...rl.ids, ...rr.ids],
      fix: [...rl.screws, ...rr.screws],
      tools: ["screwdriver"],
      pose: "+y",
    });
  } else k.steps.push({ title: "Stand it up", detail: "Lift it upright onto its bottom.", pose: "+y", people: tall ? 2 : 1, warnings: tall ? ["two"] : [] });
  if (!low) k.steps.push(wallStep(k, "TP", [-W / 2 + T + 60, W / 2 - T - 60], tall));
}

/* ---------- wide frames: three columns ---------- */

interface Cols {
  W: number;
  D: number;
  xs: number[]; // centres of the four uprights, left side to right side
  cx: number[]; // centres of the three columns
  cw: number;
}
function colsOf(W: number, D: number): Cols {
  const cw = (W - 4 * T) / 3;
  const xs = range(4).map((i) => -W / 2 + T / 2 + i * (cw + T));
  return { W, D, xs, cx: range(3).map((i) => xs[i] + T / 2 + cw / 2), cw };
}

/** Pine 94x52 and 93x44x91: bottom and one side standing, then on its back for the dividers, the top and the last side. */
function pineTriple(k: Kit, W: number, H: number, D: number, roomDivider: boolean) {
  const c = colsOf(W, D);
  const iw = W - 2 * T;
  const yLo = RH, yHi = H - RH;
  k.part("L", "Side panel", [T, H, D], [c.xs[0], H / 2, 0], { pieces: pineSide(H, D, yLo, yHi, 1) });
  k.part("R", "Side panel", [T, H, D], [c.xs[3], H / 2, 0], { pieces: pineSide(H, D, yLo, yHi, 1), rot: [0, Math.PI, 0] });
  const dh = yHi - yLo + RH - PT; // between the panels
  for (const i of [1, 2]) k.part(`V${i}`, "Divider", [T, dh, D - 2 * RT], [c.xs[i], RH + dh / 2, 0], { pieces: pineSide(dh, D - 2 * RT, RH - PT, dh - RH + PT, 2) });
  k.part("BP", "Panel", [iw, PT, D - 2 * RT], [0, RH - PT / 2, 0]);
  k.part("TP", "Panel", [iw, PT, D - 2 * RT], [0, H - PT / 2, 0]);
  for (const [n, y] of [["B", RH / 2], ["T", H - RH / 2]] as const) {
    k.part(`${n}F`, "Rail", [iw, RH, RT], [0, y, D / 2 - RT / 2]);
    k.part(`${n}K`, "Rail", [iw, RH, RT], [0, y, -D / 2 + RT / 2]);
  }
  k.steps.push({ title: "Tap dowels into the bottom rails", detail: "One in each end of both rails.", add: ["BF", "BK"], fix: ["BF", "BK"].flatMap((r) => [k.endDowels(r, -1, 1, "L"), k.endDowels(r, 1, 1, "R")]), tools: ["hammer"], warnings: ["floor"] });
  k.steps.push({
    title: "Slide the bottom panel into the rails",
    detail: "Tap four dowels into each end of the panel first. The rails' grooves take its front and back edges.",
    add: ["BP"],
    fix: [k.endDowels("BP", -1, 4, "L"), k.endDowels("BP", 1, 4, "R")],
    tools: ["hammer"],
  });
  k.steps.push({ title: "Screw on a side", detail: "Stand it against one end, runners in, and turn three screws through it into the rails and panel.", add: ["L"], fix: [k.through("L", "BP", 1), k.through("L", "BF", 1), k.through("L", "BK", 1)], tools: ["allen"] });
  k.steps.push({
    title: "Lay it on its back and fit the dividers",
    detail: "Two dowels in each end of the dividers. Push them onto the bottom, then screw through the bottom into them, two each.",
    add: ["V1", "V2"],
    fix: [k.uprightDowels("V1", -1, 2, "BP"), k.uprightDowels("V2", -1, 2, "BP"), k.uprightDowels("V1", 1, 2, "TP"), k.uprightDowels("V2", 1, 2, "TP"), k.throughPanel("BP", "V1", 2), k.throughPanel("BP", "V2", 2)],
    tools: ["hammer", "allen"],
    pose: "+z",
  });
  k.steps.push({ title: "Slide on the top panel", detail: "Four dowels in each end. Angle it into the side first, then lower it onto the dividers' dowels.", add: ["TP"], from: { TP: [220, 220, 0] }, fix: [k.endDowels("TP", -1, 4, "L"), k.endDowels("TP", 1, 4, "R")], tools: ["hammer"] });
  k.steps.push({ title: "Fit the top rails", detail: "One dowel in each end, then slide them onto the top panel's edges.", add: ["TF", "TK"], fix: ["TF", "TK"].flatMap((r) => [k.endDowels(r, -1, 1, "L"), k.endDowels(r, 1, 1, "R")]), tools: ["hammer"] });
  k.steps.push({ title: "Screw the top to the side", detail: "Three screws through the side into the top panel and its rails.", fix: [k.through("L", "TP", 1), k.through("L", "TF", 1), k.through("L", "TK", 1)], tools: ["allen"] });
  k.steps.push({
    title: "Screw on the other side",
    detail: "Press it onto the dowels, then six screws through it: three into the top, three into the bottom.",
    add: ["R"],
    fix: ["TP", "TF", "TK", "BP", "BF", "BK"].map((m) => k.through("R", m, 1)),
    tools: ["allen"],
  });
  const stops = boxStops(k, c, ["BP", "TP"], 4, H);
  k.steps.push({ title: H > 800 ? "Stand it up together" : "Stand it up", pose: "+y", people: H > 800 ? 2 : 1, warnings: H > 800 ? ["two"] : [] });
  k.steps.push(stops);
  if (roomDivider) k.steps.push(wallStep(k, "TP", [c.xs[0] + T / 2 + 60, c.xs[3] - T / 2 - 60], true));
}

/** Little angle stops at the back of the middle column, two screws each, so the boxes can't go through. */
function boxStops(k: Kit, c: Cols, panels: string[], n: number, H: number): CustomStep {
  const per = n / panels.length;
  const fixes: CustomFix[] = [];
  for (const p of panels) {
    const b = k.bx(p);
    const top = k.mid(p, 1) > H / 2;
    const y = top ? b.min[1] : b.max[1];
    const xs = spread(c.cx[1] - c.cw / 2, c.cx[1] + c.cw / 2, per, 0.25);
    const z = -c.D / 2 + 40;
    const pts = xs.map((x) => [x, y, z] as Vec3);
    fixes.push(k.fx("angle", p, pts, [0, top ? 1 : -1, 0]));
    fixes.push(k.fx("screw", p, pts.flatMap((q) => [[q[0] - 16, q[1], q[2] + 16], [q[0] + 16, q[1], q[2] + 16]] as Vec3[]), [0, top ? 1 : -1, 0], undefined, { len: 12, dia: 4 }));
  }
  return { title: "Screw in the box stops", detail: "At the back of the middle column, two screws each. They stop a box pushed in from the front.", fix: fixes, tools: ["screwdriver"] };
}

/** Stepped frames: three columns of falling height, built lying on their back. */
function stepHeights(H: number) {
  return [H, Math.round(H * 0.685), Math.round(H * 0.375)];
}

function pineStepped(k: Kit, W: number, H: number, D: number) {
  const c = colsOf(W, D);
  const hs = stepHeights(H);
  const yLo = RH;
  // uprights: left side and first divider as tall as the first column, the second divider as the middle one, the right side as the low one
  const uh = [hs[0], hs[0], hs[1], hs[2]];
  const ids = ["L", "V1", "V2", "R"];
  ids.forEach((id, i) => {
    const side = i === 0 || i === 3;
    const y0 = side ? 0 : RH;
    const h = uh[i] - y0 - (side ? 0 : PT);
    const pieces = pineSide(h, side ? D : D - 2 * RT, (side ? RH : RH - PT) , h - (side ? RH : RH - PT), side ? 1 : 2);
    k.part(id, side ? "Side panel" : "Divider", [T, h, side ? D : D - 2 * RT], [c.xs[i], y0 + h / 2, 0], { pieces, rot: i === 3 ? [0, Math.PI, 0] : undefined });
  });
  // the tops of the three columns, and the bottom across all of them
  range(3).forEach((i) => {
    const y = hs[i];
    k.part(`T${i}P`, "Column top panel", [c.cw, PT, D - 2 * RT], [c.cx[i], y - PT / 2, 0]);
    k.part(`T${i}F`, "Short rail", [c.cw, RH, RT], [c.cx[i], y - RH / 2, D / 2 - RT / 2]);
    k.part(`T${i}K`, "Short rail", [c.cw, RH, RT], [c.cx[i], y - RH / 2, -D / 2 + RT / 2]);
  });
  const iw = W - 2 * T;
  k.part("BP", "Bottom panel", [iw, PT, D - 2 * RT], [0, RH - PT / 2, 0]);
  k.part("BF", "Long rail", [iw, RH, RT], [0, RH / 2, D / 2 - RT / 2]);
  k.part("BK", "Long rail", [iw, RH, RT], [0, RH / 2, -D / 2 + RT / 2]);
  void yLo;
  const top = (i: number) => [`T${i}P`, `T${i}F`, `T${i}K`];
  const topDowels = (i: number) => top(i).flatMap((m) => [k.endDowels(m, -1, 2, ids[i]), k.endDowels(m, 1, 2, ids[i + 1])]);
  k.steps.push({
    title: "Slide the column tops into their rails",
    detail: "Three short panels, each between two short rails. The grooves take the panel's front and back edges.",
    add: range(3).flatMap(top),
    pose: "+z",
    warnings: ["floor"],
  });
  k.steps.push({ title: "Tap dowels into the ends of the column tops", detail: "Two into each end of every rail and panel, twelve per top.", fix: [0, 1, 2].flatMap(topDowels), tools: ["hammer"] });
  k.steps.push({
    title: "Join the tall side and the first divider with a top",
    detail: "Lay them on their back edges and push the first top between them. Three screws through each.",
    add: ["L", "V1"],
    fix: [...top(0).map((m) => k.through("L", m, 1)), ...top(0).map((m) => k.through("V1", m, 1))],
    tools: ["allen"],
  });
  k.steps.push({ title: "Add the second divider and the middle top", detail: "Three screws through the divider into the top.", add: ["V2"], fix: top(1).map((m) => k.through("V2", m, 1)), tools: ["allen"] });
  k.steps.push({ title: "Add the low side and the last top", detail: "Three screws through the side into the top.", add: ["R"], fix: top(2).map((m) => k.through("R", m, 1)), tools: ["allen"] });
  k.steps.push({ title: "Tap dowels into the bottom of the dividers", detail: "Two in the bottom end of each.", fix: [k.uprightDowels("V1", -1, 2, "BP"), k.uprightDowels("V2", -1, 2, "BP")], tools: ["hammer"] });
  k.steps.push({ title: "Screw on the bottom panel", detail: "Press it onto the dowels, then two screws into each divider.", add: ["BP"], fix: [k.throughPanel("BP", "V1", 2), k.throughPanel("BP", "V2", 2)], tools: ["allen"] });
  k.steps.push({ title: "Slide the long rails onto the bottom", detail: "Grooves over the panel's front and back edges.", add: ["BF", "BK"] });
  k.steps.push({
    title: "Tap dowels into the ends of the bottom",
    detail: "Two into each end of the rails and the panel. Ease each side out a little to get them in, then push it back.",
    fix: ["BP", "BF", "BK"].flatMap((m) => [k.endDowels(m, -1, 2, "L"), k.endDowels(m, 1, 2, "R")]),
    tools: ["hammer"],
  });
  k.steps.push({ title: "Screw the sides to the bottom", detail: "Six screws through each side: four into the panel, one into each rail.", fix: [k.through("L", "BP", 4), k.through("L", "BF", 1), k.through("L", "BK", 1), k.through("R", "BP", 4), k.through("R", "BF", 1), k.through("R", "BK", 1)], tools: ["allen"] });
  const stopPts = (i: number) => [[c.cx[i], RH, -D / 2 + 40]] as Vec3[];
  const sp = [...stopPts(1), ...stopPts(2)];
  k.steps.push({ title: "Stand it up together", detail: "Lift it onto its bottom, one at each end.", pose: "+y", people: 2, warnings: ["two"] });
  k.steps.push({
    title: "Screw in the box stops",
    detail: "One at the back of the middle and low columns, two screws each.",
    fix: [k.fx("angle", "BP", sp, [0, -1, 0]), k.fx("screw", "BP", sp.flatMap((q) => [[q[0] - 16, q[1], q[2] + 16], [q[0] + 16, q[1], q[2] + 16]] as Vec3[]), [0, -1, 0], undefined, { len: 12, dia: 4 })],
    tools: ["screwdriver"],
  });
  k.steps.push(wallStep(k, "T0P", [c.cx[0]], false));
}

/** White 99x44x56: upside down on a rug, dividers with the middle rails onto the top, the bottom, then the sides. */
function whiteTriple(k: Kit, W: number, H: number, D: number) {
  const c = colsOf(W, D);
  const iw = W - 2 * T;
  k.part("L", "Side panel", [T, H, D], [c.xs[0], H / 2, 0], { mat: "board" });
  k.part("R", "Side panel", [T, H, D], [c.xs[3], H / 2, 0], { mat: "board" });
  k.part("TP", "Top and bottom", [iw, 18, D], [0, H - 9, 0], { mat: "board" });
  k.part("BP", "Top and bottom", [iw, 18, D], [0, RH + 9, 0], { mat: "board" });
  const dh = H - 36 - RH;
  for (const i of [1, 2]) k.part(`V${i}`, "Divider", [T, dh, D], [c.xs[i], RH + 18 + dh / 2, 0], { mat: "board" });
  // apron under the top, in three pieces front and back; plinth rails under the bottom, full width
  const ya = H - 18 - RH / 2;
  range(3).forEach((i) => {
    k.part(`A${i}F`, "Short rail", [c.cw, RH, WT], [c.cx[i], ya, D / 2 - WT / 2], { mat: "board" });
    k.part(`A${i}K`, "Short rail", [c.cw, RH, WT], [c.cx[i], ya, -D / 2 + WT / 2], { mat: "board" });
  });
  k.part("PF", "Long rail", [iw, RH, WT], [0, RH / 2, D / 2 - WT / 2], { mat: "board" });
  k.part("PK", "Long rail", [iw, RH, WT], [0, RH / 2, -D / 2 + WT / 2], { mat: "board" });
  const yLo = RH + 18, yHi = H - 18 - RH;
  const runners = [
    whiteRunners(k, "L", [1], 3, yLo, yHi, D, "UL"),
    whiteRunners(k, "V1", [-1, 1], 3, yLo, yHi, D, "U1"),
    whiteRunners(k, "V2", [-1, 1], 3, yLo, yHi, D, "U2"),
    whiteRunners(k, "R", [-1], 3, yLo, yHi, D, "UR"),
  ];
  const BIG = { len: 40, dia: 10 };
  const midRails = ["A1F", "A1K"];
  k.steps.push({
    title: "Join the dividers with the two middle rails",
    detail: "Upside down on a rug. Two big dowels in each rail end, then push the dividers on.",
    add: [...midRails, "V1", "V2"],
    from: { A1F: [0, 0, 0], A1K: [0, 0, 0] },
    fix: midRails.flatMap((r) => [{ ...k.endDowels(r, -1, 2, "V1"), ...BIG }, { ...k.endDowels(r, 1, 2, "V2"), ...BIG }]),
    tools: ["hammer"],
    pose: "-y",
    warnings: ["floor"],
  });
  k.steps.push({ title: "Stand them on the top", detail: "Two dowels in the top end of each divider, into the top lying on the rug.", add: ["TP"], fix: [k.uprightDowels("V1", 1, 2, "TP"), k.uprightDowels("V2", 1, 2, "TP")], tools: ["hammer"] });
  k.steps.push({ title: "Slide in the outer rails", detail: "Two at each end, front and back, along the top's edges.", add: ["A0F", "A0K", "A2F", "A2K"] });
  k.steps.push({ title: "Lay the bottom on", detail: "Two dowels in the free end of each divider, then press the bottom down.", add: ["BP"], fix: [k.uprightDowels("V1", -1, 2, "BP"), k.uprightDowels("V2", -1, 2, "BP")], tools: ["hammer"] });
  k.steps.push({ title: "Screw the bottom to the dividers", detail: "Four screws, two into each divider.", fix: [k.throughPanel("BP", "V1", 2), k.throughPanel("BP", "V2", 2)], tools: ["allen"] });
  k.steps.push({
    title: "Fit the long rails on the bottom",
    detail: "Two dowels under each, along the front and back edges.",
    add: ["PF", "PK"],
    fix: ["PF", "PK"].map((r) => k.fx("dowel", r, spread(-iw / 2, iw / 2, 2, 0.25).map((x) => [x, RH, k.mid(r, 2)] as Vec3), [0, -1, 0], "BP")),
    tools: ["hammer"],
  });
  const ends = ["TP", "BP", "A0F", "A0K", "PF", "PK"];
  const endsR = ["TP", "BP", "A2F", "A2K", "PF", "PK"];
  const dw = (ms: string[], s: -1 | 1, side: string) => ms.map((m) => k.endDowels(m, s, 2, side));
  k.steps.push({ title: "Push on a side", detail: "Twelve dowels into the ends at one side, then press the side on.", add: ["L"], fix: dw(ends, -1, "L"), tools: ["hammer"] });
  k.steps.push({ title: "Screw the side on", detail: "Six screws through it, with the Allen key.", fix: ends.map((m) => k.through("L", m, 1)), tools: ["allen"] });
  k.steps.push({ title: "Push on the other side", detail: "Twelve dowels the same way.", add: ["R"], fix: dw(endsR, 1, "R"), tools: ["hammer"] });
  k.steps.push({ title: "Screw the other side on", detail: "Six more screws.", fix: endsR.map((m) => k.through("R", m, 1)), tools: ["allen"] });
  const ids = runners.flatMap((r) => r.ids), sc = runners.flatMap((r) => r.screws);
  pushSplit(k, { title: "Turn it over and click in the runners", detail: "Press each one into its holes and turn its plastic screw in until it sits flat.", add: ids, fix: sc, tools: ["screwdriver"], pose: "+y" });
}

/** White stepped 99x94: lying on its back, column by column from the tall side, then the bottom and the low side. */
function whiteStepped(k: Kit, W: number, H: number, D: number) {
  const c = colsOf(W, D);
  const hs = stepHeights(H);
  const ids = ["L", "V1", "V2", "R"];
  const uh = [hs[0], hs[0], hs[1], hs[2]];
  ids.forEach((id, i) => {
    const side = i === 0 || i === 3;
    const y0 = side ? 0 : RH + 18;
    const h = uh[i] - y0 - (side ? 0 : 18);
    k.part(id, side ? "Side panel" : "Divider", [T, h, D], [c.xs[i], y0 + h / 2, 0], { mat: "board" });
  });
  range(3).forEach((i) => {
    k.part(`T${i}P`, "Column top", [c.cw, 18, D], [c.cx[i], hs[i] - 9, 0], { mat: "board" });
    k.part(`T${i}F`, "Short rail", [c.cw, RH, WT], [c.cx[i], hs[i] - 18 - RH / 2, D / 2 - WT / 2], { mat: "board" });
    k.part(`T${i}K`, "Short rail", [c.cw, RH, WT], [c.cx[i], hs[i] - 18 - RH / 2, -D / 2 + WT / 2], { mat: "board" });
  });
  const iw = W - 2 * T;
  k.part("BP", "Bottom", [iw, 18, D], [0, RH + 9, 0], { mat: "board" });
  k.part("BF", "Long rail", [iw, RH, WT], [0, RH / 2, D / 2 - WT / 2], { mat: "board" });
  k.part("BK", "Long rail", [iw, RH, WT], [0, RH / 2, -D / 2 + WT / 2], { mat: "board" });
  const nR = [6, 4, 2];
  const yLo = RH + 18;
  const runners = [
    whiteRunners(k, "L", [1], nR[0], yLo, hs[0] - 18 - RH, D, "UL"),
    whiteRunners(k, "V1", [-1], nR[0], yLo, hs[0] - 18 - RH, D, "U1a"),
    whiteRunners(k, "V1", [1], nR[1], yLo, hs[1] - 18 - RH, D, "U1b"),
    whiteRunners(k, "V2", [-1], nR[1], yLo, hs[1] - 18 - RH, D, "U2a"),
    whiteRunners(k, "V2", [1], nR[2], yLo, hs[2] - 18 - RH, D, "U2b"),
    whiteRunners(k, "R", [-1], nR[2], yLo, hs[2] - 18 - RH, D, "UR"),
  ];
  const railDowels = (i: number) => [`T${i}F`, `T${i}K`].flatMap((r) => [k.endDowels(r, -1, 1, ids[i]), k.endDowels(r, 1, 1, ids[i + 1])]);
  const topDowels = (i: number) => [k.endDowels(`T${i}P`, -1, 4, ids[i]), k.endDowels(`T${i}P`, 1, 4, ids[i + 1])];
  k.steps.push({
    title: "Screw the first top to the tall side",
    detail: "Lay the side on its back edge on a rug. Tap four dowels into each end of the top, push it on and turn one screw through the side.",
    add: ["L", "T0P"],
    fix: [...topDowels(0), k.through("L", "T0P", 1)],
    from: { L: [0, 0, 0], T0P: [300, 0, 0] },
    tools: ["hammer", "allen"],
    pose: "+z",
    warnings: ["floor"],
  });
  k.steps.push({ title: "Slide in its two rails", detail: "One dowel in each end, front and back under the top.", add: ["T0F", "T0K"], fix: railDowels(0), tools: ["hammer"] });
  k.steps.push({ title: "Screw on the first divider", detail: "Five screws through it into the top and its rails.", add: ["V1"], fix: [k.through("V1", "T0P", 3), k.through("V1", "T0F", 1), k.through("V1", "T0K", 1)], tools: ["allen"] });
  k.steps.push({ title: "Screw the middle top to the divider", detail: "Four dowels in each end, then one screw through the divider.", add: ["T1P"], fix: [...topDowels(1), k.through("V1", "T1P", 1)], tools: ["hammer", "allen"] });
  k.steps.push({ title: "Fit its rails", detail: "A dowel in each end, then one screw through the divider into each.", add: ["T1F", "T1K"], fix: [...railDowels(1), k.through("V1", "T1F", 1), k.through("V1", "T1K", 1)], tools: ["hammer", "allen"] });
  k.steps.push({ title: "Screw on the second divider", detail: "Three screws through it into the middle top and its rails.", add: ["V2"], fix: [k.through("V2", "T1P", 1), k.through("V2", "T1F", 1), k.through("V2", "T1K", 1)], tools: ["allen"] });
  k.steps.push({ title: "Screw the low top to the divider", detail: "Four dowels in each end, then one screw.", add: ["T2P"], fix: [...topDowels(2), k.through("V2", "T2P", 1)], tools: ["hammer", "allen"] });
  k.steps.push({ title: "Fit its rails", detail: "A dowel in each end, then one screw through the divider into each.", add: ["T2F", "T2K"], fix: [...railDowels(2), k.through("V2", "T2F", 1), k.through("V2", "T2K", 1)], tools: ["hammer", "allen"] });
  k.steps.push({ title: "Tap dowels into the bottom of the dividers", detail: "Two in each.", fix: [k.uprightDowels("V1", -1, 2, "BP"), k.uprightDowels("V2", -1, 2, "BP")], tools: ["hammer"] });
  k.steps.push({ title: "Lay the bottom on", detail: "Tap two dowels into each end, then swing it onto the dividers' dowels.", add: ["BP"], from: { BP: [220, 220, 0] }, fix: [k.endDowels("BP", -1, 2, "L"), k.endDowels("BP", 1, 2, "R")], tools: ["hammer"] });
  k.steps.push({ title: "Screw the bottom to the dividers", detail: "Two screws into each.", fix: [k.throughPanel("BP", "V1", 2), k.throughPanel("BP", "V2", 2)], tools: ["allen"] });
  k.steps.push({ title: "Swing the long rails on", detail: "Four dowels in each first: one in each end and two along the top edge. They go front and back, under the bottom.", add: ["BF", "BK"], from: { BF: [220, -220, 0], BK: [220, -220, 0] }, fix: ["BF", "BK"].flatMap((r) => [k.endDowels(r, -1, 1, "L"), k.endDowels(r, 1, 1, "R"), k.fx("dowel", r, [c.xs[1], c.xs[2]].map((x) => [x, RH, k.mid(r, 2)] as Vec3), [0, -1, 0], "BP")]), tools: ["hammer"] });
  k.steps.push({
    title: "Screw on the low side",
    detail: "Nine screws through it into the low top, its rails, the bottom and the long rails.",
    add: ["R"],
    fix: [k.through("R", "T2P", 1), k.through("R", "T2F", 1), k.through("R", "T2K", 1), k.through("R", "BP", 4), k.through("R", "BF", 1), k.through("R", "BK", 1)],
    tools: ["allen"],
  });
  const all = runners.flatMap((r) => r.ids), sc = runners.flatMap((r) => r.screws);
  pushSplit(k, { title: "Stand it up and click in the runners", detail: "Press each into its holes and turn its plastic screw in.", add: all, fix: sc, tools: ["screwdriver"], pose: "+y", people: 2, warnings: ["two"] });
  k.steps.push(wallStep(k, "T0P", [c.cx[0]], false));
}

/* ---------- wall storage ---------- */

function wallStorage(k: Kit, W: number, H: number, D: number, white: boolean) {
  const c = colsOf(W, D);
  const iw = W - 2 * T;
  const mat: PartMaterial = white ? "board" : "wood";
  const PH = 16;
  k.part("L", "Side panel", [T, H, D], [c.xs[0], H / 2, 0], { mat, pieces: white ? undefined : pineSide(H, D, PH, H - PH, 1) });
  k.part("R", "Side panel", [T, H, D], [c.xs[3], H / 2, 0], { mat, pieces: white ? undefined : pineSide(H, D, PH, H - PH, 1), rot: white ? undefined : [0, Math.PI, 0] });
  k.part("TP", "Top and bottom", [iw, PH, D], [0, H - PH / 2, 0], { mat });
  k.part("BP", "Top and bottom", [iw, PH, D], [0, PH / 2, 0], { mat });
  const dh = H - 2 * PH;
  for (const i of [1, 2]) k.part(`V${i}`, "Divider", [T, dh, D], [c.xs[i], H / 2, 0], { mat, pieces: white ? undefined : pineSide(dh, D, 0, dh, 2) });
  // the hanging fittings inside the top back corners of the sides
  for (const [id, s] of [["HL", 1], ["HR", -1]] as const) {
    const x = (s > 0 ? c.xs[0] : c.xs[3]) + s * (T / 2 + 3);
    k.part(id, "Hanging fitting", [6, 50, 50], [x, H - PH - 30, -D / 2 + 25], { mat: "metal" });
  }
  const fitScrews = (id: string, side: string, s: number) => k.fx("screw", id, [[k.mid(id, 0) + s * 3, H - PH - 15, -D / 2 + 15], [k.mid(id, 0) + s * 3, H - PH - 45, -D / 2 + 35]], [-s, 0, 0], side, { len: 12, dia: 4 });
  const runners = white
    ? [
        whiteRunners(k, "L", [1], 2, PH, H - PH, D, "UL"),
        whiteRunners(k, "V1", [1], 2, PH, H - PH, D, "U1"),
        whiteRunners(k, "V1", [-1], 2, PH, H - PH, D, "U1"),
        whiteRunners(k, "V2", [1], 2, PH, H - PH, D, "U2"),
        whiteRunners(k, "V2", [-1], 2, PH, H - PH, D, "U2"),
        whiteRunners(k, "R", [-1], 2, PH, H - PH, D, "UR"),
      ]
    : [];
  if (white) {
    // one face of every panel first, then the dividers are turned over for their other face
    const first = [runners[0], runners[1], runners[3], runners[5]];
    const second = [runners[2], runners[4]];
    k.steps.push({ title: "Click the runners onto the sides and dividers", detail: "Lay the panels on a rug. Press each runner in and turn its plastic screw in.", add: ["L", "R", "V1", "V2", ...first.flatMap((r) => r.ids)], fix: first.flatMap((r) => r.screws), tools: ["screwdriver"], warnings: ["floor"] });
    k.steps.push({ title: "Turn the dividers over and do their other face", detail: "Four more runners.", add: second.flatMap((r) => r.ids), fix: second.flatMap((r) => r.screws), tools: ["screwdriver"] });
  }
  const fittings: CustomStep = {
    title: "Screw the hanging fittings to the sides",
    detail: "Inside each side, at the top back corner, two screws each.",
    add: white ? ["HL", "HR"] : ["L", "R", "HL", "HR"],
    fix: [fitScrews("HL", "L", 1), fitScrews("HR", "R", -1)],
    tools: ["screwdriver"],
    ...(white ? {} : { warnings: ["floor" as const] }),
  };
  if (white) k.steps.push(fittings);
  k.steps.push({
    title: "Stand the dividers on the bottom",
    detail: white ? "Two dowels in the bottom end of each divider." : "One dowel in the bottom end of each divider.",
    add: ["BP", "V1", "V2"],
    fix: [k.uprightDowels("V1", -1, white ? 2 : 1, "BP"), k.uprightDowels("V2", -1, white ? 2 : 1, "BP")],
    tools: ["hammer"],
  });
  k.steps.push({ title: "Screw the bottom to the dividers", detail: "Two screws into each, from underneath.", fix: [k.throughPanel("BP", "V1", 2), k.throughPanel("BP", "V2", 2)], tools: ["allen"] });
  k.steps.push({ title: "Fit the top", detail: "Two dowels in the top end of each divider, then press the top on.", add: ["TP"], fix: [k.uprightDowels("V1", 1, 2, "TP"), k.uprightDowels("V2", 1, 2, "TP")], tools: ["hammer"] });
  k.steps.push({ title: "Screw the top to the dividers", detail: white ? "Two screws into each." : "One screw into each.", fix: white ? [k.throughPanel("TP", "V1", 2), k.throughPanel("TP", "V2", 2)] : ["V1", "V2"].map((v) => k.fx("bolt", "TP", [[k.mid(v, 0), H, 0]], [0, -1, 0], v, BOLT)), tools: ["allen"] });
  const ends = ["TP", "BP"];
  if (!white) k.steps.push(fittings);
  k.steps.push({
    title: "Push on the sides",
    detail: white ? "Two dowels in each end of the top and bottom first." : "One dowel in each end of the top and bottom, the big ones at the top.",
    fix: ends.flatMap((m) => [k.endDowels(m, -1, white ? 2 : 1, "L"), k.endDowels(m, 1, white ? 2 : 1, "R")]).map((f) => (!white && f.on === "TP" ? { ...f, len: 40, dia: 10 } : f)),
    tools: ["hammer"],
  });
  k.steps.push({ title: "Screw the sides on", detail: "Eight screws, two into each end of the top and bottom.", fix: ends.flatMap((m) => [k.through("L", m, 2), k.through("R", m, 2)]), tools: ["allen"] });
  const xs = [c.xs[0] + T, c.xs[3] - T];
  const wall = xs.map((x) => [x, H - PH - 30, -D / 2 - 2] as Vec3);
  const hole = wall.map((q) => [q[0], q[1], q[2] - 25] as Vec3);
  k.steps.push({
    title: "Hold it up and mark the wall",
    detail: "One of you holds it level against the wall while the other marks through the two fittings.",
    tools: ["pencil", "level"],
    people: 2,
    warnings: ["two", "wall"],
  });
  k.steps.push({
    title: "Screw two screws into the wall",
    detail: "Leave the heads standing out a little. Screws and plugs aren't included: pick ones made for your wall.",
    fix: [k.fx("plug", undefined, hole, [0, 0, -1]), k.fx("screw", undefined, wall, [0, 0, -1], undefined, { len: 50, dia: 5 })],
    tools: ["drill", "screwdriver"],
    wall: true,
  });
  k.steps.push({
    title: "Hang it on the screws together",
    detail: "Hook the fittings over the screw heads, turn their adjusting screws until it hangs level and tight to the wall, then snap the covers on.",
    fix: [k.fx("cap", "HL", [[k.mid("HL", 0) + 3, H - PH - 30, -D / 2 + 25]], [-1, 0, 0]), k.fx("cap", "HR", [[k.mid("HR", 0) - 3, H - PH - 30, -D / 2 + 25]], [1, 0, 0])],
    tools: ["screwdriver"],
    people: 2,
    warnings: ["two", "wall"],
    wall: true,
  });
}

/* ---------- desk: two small frames, a middle top on metal rails and a stretcher ---------- */

function deskRecipe(k: Kit, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const fw = 320;
  const ox = W / 2 - fw / 2;
  const a = pineSingle(k, fw, H, D, { ox: -ox, p: "a", block: true, steps: false });
  const b = pineSingle(k, fw, H, D, { ox, p: "b", block: true, steps: false });
  const gap = W - 2 * fw;
  // the middle top: one board between the frames' tops
  k.part("MP", "Desk top", [gap, PT, D], [0, H - PT / 2, 0]);
  // two flat metal rails under its front and back edges, their ends turned down against the frames' inner sides,
  // held by the inner sides' top screws that go back in through them
  const zr = [D / 2 - 15, -D / 2 + 15], zt = [D / 2 - RT / 2, -D / 2 + RT / 2];
  zr.forEach((z, i) => k.part(`M${i}`, "Metal rail", [gap, 4, 30], [0, H - PT - 2, z], { mat: "metal", pieces: [
    { shape: "box", size: [gap, 4, 30], pos: [0, 0, 0] },
    { shape: "box", size: [3, 40, 30], pos: [-gap / 2 + 1.5, -20, 0] },
    { shape: "box", size: [3, 40, 30], pos: [gap / 2 - 1.5, -20, 0] },
  ] }));
  // the low stretcher at the back on two corner brackets
  const ys = 60, zs = -D / 2 + 40;
  k.part("ST", "Stretcher", [gap, 50, 18], [0, ys, zs]);
  const aIn = "aR", bIn = "bL"; // the inner sides
  const xa = k.bx(aIn).max[0], xb = k.bx(bIn).min[0];
  // the inner sides' screws into the top rails and the back bottom rail come out again for the desk: leave them for later
  const kept = (f: CustomFix[], p: string) => f.filter((x) => ![`${p}TF`, `${p}TK`, `${p}BK`].includes(x.mate ?? ""));
  const frame = (f: typeof a, p: "a" | "b", inner: "L" | "R") => {
    const outer = inner === "L" ? "R" : "L";
    const first = p === "a";
    const id = (x: string) => p + x;
    k.steps.push({ title: first ? "Screw a runner block onto each frame side" : "Start the second frame the same way", detail: first ? "Two frames make the desk; build the first one now. Lay both its sides on a rug, runners up, and screw a block along each top end." : "A runner block on each of its sides, three screws each.", add: [id("L"), id("KL")], fix: [f.blockScrews("L")], tools: ["screwdriver"], pose: "+x", warnings: ["floor"], repeat: 2 });
    k.steps.push({ title: "Tap dowels into both ends of the rails", detail: "Two in each end, sixteen in all.", add: [id("TF"), id("TK"), id("BF"), id("BK")], fix: f.dowelsAll(2), tools: ["hammer"] });
    k.steps.push({ title: "Slide the panels into the rails and stand them on a side", detail: "The groove in each rail takes the panel's edge, rails facing out.", add: [id("TP"), id("BP")] });
    k.steps.push({ title: "Lay the other side on top", detail: "Runners and block facing down, onto all the dowels.", add: [id("R"), id("KR")], fix: [f.blockScrews("R")], tools: ["screwdriver"] });
    const screwsR = f.sideScrews("R"), screwsL = f.sideScrews("L");
    k.steps.push({ title: "Screw the side on", detail: inner === "R" ? "Three screws through it with the Allen key. Leave out the two top corners and the back bottom corner: those screws hold the desk parts later." : "Six screws through it with the Allen key.", fix: inner === "R" ? kept(screwsR, p) : screwsR, tools: ["allen"] });
    k.steps.push({ title: "Turn it over and screw the other side", detail: inner === "L" ? "Three screws this time. Leave out the two top corners and the back bottom corner: those screws hold the desk parts later." : "Six more screws the same way.", fix: inner === "L" ? kept(screwsL, p) : screwsL, tools: ["allen"], pose: "-x" });
    void outer;
  };
  frame(a, "a", "R");
  frame(b, "b", "L");
  const railEnd = (i: number, side: -1 | 1) => k.fx("bolt", `M${i}`, [[side < 0 ? xa + 3 : xb - 3, H - 25, zt[i]]], [side < 0 ? -1 : 1, 0, 0], `${side < 0 ? "a" : "b"}T${i ? "K" : "F"}`, BOLT);
  const yb = ys;
  k.steps.push({
    title: "Fit the metal rails to the first frame",
    detail: "Stand both frames on the rug, inner sides facing, a desk top's width apart. The saved screws go through the rails' turned-down ends into the top corners.",
    add: ["M0", "M1"],
    fix: [railEnd(0, -1), railEnd(1, -1)],
    tools: ["allen"],
    pose: "+y",
    warnings: ["floor"],
  });
  k.steps.push({ title: "Screw the rails to the other frame", detail: "One screw through each rail end into its top corners. Turn them by hand, not with a drill.", fix: [railEnd(0, 1), railEnd(1, 1)], tools: ["allen"] });
  k.steps.push({
    title: "Screw on the corner brackets",
    detail: "One low down at the back of each inner side, on the last saved screw, into the back bottom rail.",
    fix: [k.fx("angle", aIn, [[xa, 40, -D / 2 + 30]], [-1, 0, 0]), k.fx("angle", bIn, [[xb, 40, -D / 2 + 30]], [1, 0, 0]), k.fx("bolt", aIn, [[xa + 3, RH / 2, -D / 2 + RT / 2]], [-1, 0, 0], "aBK", BOLT), k.fx("bolt", bIn, [[xb - 3, RH / 2, -D / 2 + RT / 2]], [1, 0, 0], "bBK", BOLT)],
    tools: ["allen"],
  });
  k.steps.push({
    title: "Lay the desk top on the rails",
    detail: "Lay it on the rails between the frame tops and screw up through the front rail into it.",
    add: ["MP"],
    fix: [k.fx("screw", "M0", [[-gap / 4, H - PT - 4, zr[0]], [gap / 4, H - PT - 4, zr[0]]], [0, 1, 0], "MP", { len: 14, dia: 6 })],
    tools: ["screwdriver"],
  });
  k.steps.push({ title: "Screw the top to the rails", detail: "Four more screws, by hand.", fix: [k.fx("screw", "M1", [-gap / 3, -gap / 9, gap / 9, gap / 3].map((x) => [x, H - PT - 4, zr[1]] as Vec3), [0, 1, 0], "MP", { len: 14, dia: 6 })], tools: ["screwdriver"] });
  k.steps.push({
    title: "Screw in the stretcher",
    detail: "The stretcher sits on the two brackets at the back, two screws at each end.",
    add: ["ST"],
    fix: [k.fx("screw", "ST", [[-gap / 2 + 12, yb + 25, zs], [-gap / 2 + 40, yb + 25, zs], [gap / 2 - 12, yb + 25, zs], [gap / 2 - 40, yb + 25, zs]], [0, -1, 0], undefined, { len: 14, dia: 6 })],
    tools: ["screwdriver"],
  });
  const v = s.variant.toLowerCase();
  if (/box|tray/.test(v)) boxesStep(k, [-ox, ox], fw, H, D, /tray/.test(v), /mesh/.test(v));
  else if (/shel/.test(v)) shelvesStep(k, [-ox, ox], fw, H, D);
}

/** The boxes, trays or shelves sold with a desk slide onto the runners last. */
function boxesStep(k: Kit, oxs: number[], fw: number, H: number, D: number, trays: boolean, mesh: boolean) {
  const iw = fw - 2 * T - 6;
  const inner = H - 2 * RH;
  const plan = trays ? [100, 100, inner - 220] : [Math.floor(inner / 3) - 12, Math.floor(inner / 3) - 12, Math.floor(inner / 3) - 12];
  const ids: string[] = [];
  oxs.forEach((ox, f) => {
    let y = H - RH - 6;
    plan.forEach((h, i) => {
      const id = `X${f}${i}`;
      const deep = h > 150;
      const name = deep ? "Storage box" : "Tray";
      k.part(id, name, [iw, h, D - 50], [ox, y - h / 2, 10], { mat: mesh && deep ? "metal" : "board", pieces: [
        { shape: "box", size: [iw, 6, D - 50], pos: [0, -h / 2 + 3, 0] },
        { shape: "box", size: [6, h, D - 50], pos: [-iw / 2 + 3, 0, 0] },
        { shape: "box", size: [6, h, D - 50], pos: [iw / 2 - 3, 0, 0] },
        { shape: "box", size: [iw, h, 6], pos: [0, 0, -(D - 50) / 2 + 3] },
        { shape: "box", size: [iw, h * 0.8, 6], pos: [0, -h * 0.1, (D - 50) / 2 - 3] },
      ] });
      ids.push(id);
      y -= h + 12;
    });
  });
  k.steps.push({ title: trays ? "Slide in the trays and boxes" : "Slide in the boxes", detail: "Their rims run on the runners in the sides. Push each one in until it stops.", add: ids, from: Object.fromEntries(ids.map((id) => [id, [0, 0, 420] as Vec3])) });
}

function shelvesStep(k: Kit, oxs: number[], fw: number, H: number, D: number) {
  const iw = fw - 2 * T - 4;
  const ids: string[] = [];
  oxs.forEach((ox, f) =>
    [0.36, 0.66].forEach((t, i) => {
      const id = `S${f}${i}`;
      k.part(id, "Shelf", [iw, 12, D - 40], [ox, H * t, 10]);
      ids.push(id);
    }),
  );
  k.steps.push({ title: "Slide in the shelves", detail: "Two in each frame, on any pair of runners.", add: ids, from: Object.fromEntries(ids.map((id) => [id, [0, 0, 420] as Vec3])) });
}

/* ---------- which manual a guide follows ---------- */

function recipeOf(s: ProductSpec): CustomParams | null {
  const slug = s.slug ?? "";
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const k = recipeKit();
  const white = /white/.test(slug) || /^trofast-(frame-(34|46|99)|storage-frame-99|wall-storage-99)/.test(slug);
  if (/^trofast-desk-/.test(slug)) deskRecipe(k, s);
  else if (/^trofast-wall-storage-/.test(slug)) wallStorage(k, W, H, D, white);
  else if (/^trofast-storage-frame-99-x-94/.test(slug)) whiteStepped(k, W, H, D);
  else if (/^trofast-frame-94-x-44-x-91/.test(slug)) pineStepped(k, W, H, D);
  else if (/^trofast-frame-99-x-44-x-56/.test(slug)) whiteTriple(k, W, H, D);
  else if (/^trofast-frame-93-x-(52|44-x-91)/.test(slug)) pineTriple(k, W, H, D, /44-x-91/.test(slug));
  else if (/^trofast-frame-(34-x-44-x-56|46-x-30-x-94|46-x-30-x-145)/.test(slug)) whiteSingle(k, W, H, D);
  else if (/^trofast-frame-(32-x-44-x-52|44-x-91)/.test(slug)) {
    pineSingle(k, W, H, D, { block: /32-x-44/.test(slug) });
    const tall = H > 800;
    k.steps.push({ title: tall ? "Stand it up together" : "Stand it up", detail: "Lift it upright onto its bottom.", pose: "+y", people: tall ? 2 : 1, warnings: tall ? ["two"] : [] });
    if (tall) k.steps.push(wallStep(k, "TP", [-W / 2 + T + 60, W / 2 - T - 60], false));
  } else return null;
  return { parts: k.parts, steps: splitSteps(k.steps) };
}

const family: Family = {
  names: ["TROFAST"],
  recipe: recipeOf,
};
export default family;
