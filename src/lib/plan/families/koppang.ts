import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, HwKind, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, PlanBuilder } from "../builder";
import { buildCustom } from "../custom";
import { ankDrawer, ankDrawerSteps, ankDrawersIn } from "./ankarudden";

/*
 * KOPPANG, read from IKEA's manual for the chest of 3 drawers (the line is no longer sold; the chest of 6 drawers
 * is drawn the same way with a middle frame, as two chests of 3 side by side).
 *
 * Each side is a frame: an upper and a lower rail and a panel, with a post pushed onto each end on dowels and cam
 * bolts. Lying on its left side, the front rails and the two back panels stand in the side frame on the floor and
 * are locked, and the other frame is laid on top. Glides go under the posts, it's stood up, the top goes on dowels
 * and cam bolts with the wall brackets under it, three long screws pull the top rail up into it, and it's fixed to
 * the wall. The drawers stand their sides on the back, take a bottom and a wire stiffener, get the front on
 * connecting dowels, runners and two knobs.
 */

const pt = (x: number, y: number, z: number): Vec3 => [x, y, z];
const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const S = [-1, 1];
const DOWEL = { len: 30, dia: 8 };
const CAM = { name: "Cam lock" };
const PT = 40; // posts
const TT = 18; // top

function chest(b: PlanBuilder, s: ProductSpec, cols: 1 | 2) {
  const W = cols === 2 ? 1720 : 900, H = 830, D = 550, rows = 3;
  const ph = H - TT;
  const zP = D / 2 - PT / 2; // post centres, front (+z) and back (-z)
  const lz = D - 2 * PT;
  const yLo = 120, yUp = ph - 35; // centres of the side rails
  const frames = cols === 2 ? [-1, 0, 1] : [-1, 1];
  const fxOf = (f: number) => f * (W / 2 - PT / 2);
  const fid = (f: number) => (f < 0 ? "L" : f > 0 ? "R" : "M");
  const bayW = (W - frames.length * PT) / cols; // between the posts of one bay
  const bayX = (c: number) => (cols === 2 ? (c ? 1 : -1) * (PT / 2 + bayW / 2) : 0);
  const railY = [yLo, ...Array.from({ length: rows - 1 }, (_, k) => yLo + ((ph - 15 - yLo) * (k + 1)) / rows), ph - 15];
  const bpY0 = yLo - 35, bpH = (ph - bpY0) / 2;
  const bpC = (k: number) => bpY0 + bpH * (k + 0.5);
  const parts: CustomPart[] = [];
  for (const f of frames) {
    const x = fxOf(f), k = fid(f);
    parts.push(
      { id: `${k}RU`, name: "Upper side rail", size: [24, 70, lz], pos: [x, yUp, 0], material: "wood" },
      { id: `${k}RL`, name: "Lower side rail", size: [24, 70, lz], pos: [x, yLo, 0], material: "wood" },
      { id: `${k}SP`, name: "Side panel", size: [12, yUp - yLo - 70, lz], pos: [x, (yUp + yLo) / 2, 0] },
      { id: `${k}PF`, name: "Post", size: [PT, ph, PT], pos: [x, ph / 2, zP], material: "wood" },
      { id: `${k}PB`, name: "Post", size: [PT, ph, PT], pos: [x, ph / 2, -zP], material: "wood" },
    );
  }
  for (let c = 0; c < cols; c++) {
    railY.forEach((y, r) => parts.push({ id: `F${c}${r}`, name: r === rows ? "Top front rail" : "Front rail", size: [bayW, 30, 20], pos: [bayX(c), y, zP], material: "wood" }));
    [0, 1].forEach((k) => parts.push({ id: `K${c}${k}`, name: "Back panel", size: [bayW, bpH, 12], pos: [bayX(c), bpC(k), -zP] }));
  }
  parts.push({ id: "TP", name: "Top", size: [W, TT, D + 10], pos: [0, H - TT / 2, 0] });
  const frameIds = (f: number) => ["RU", "RL", "SP", "PF", "PB"].map((p) => fid(f) + p);
  const postId = (f: number, sz: number) => `${fid(f)}P${sz > 0 ? "F" : "B"}`;

  // each post: two cam bolts into the side rails' ends and two dowels into the panel's end
  const postBolts = (f: number) => S.map((sz) => fx("camScrew", [yUp, yLo].map((y) => pt(fxOf(f), y, sz * (D / 2 - PT))), [0, 0, sz], { on: postId(f, sz) }));
  const postDowels = (f: number) => S.map((sz) => fx("dowel", [320, 560].map((y) => pt(fxOf(f), y, sz * (D / 2 - PT))), [0, 0, sz], { on: postId(f, sz), ...DOWEL }));
  const railCams = (f: number) => [
    fx("cam", S.map((sz) => pt(fxOf(f), yUp - 35, sz * (D / 2 - PT - 30))), [0, 1, 0], { on: `${fid(f)}RU`, ...CAM }),
    fx("cam", S.map((sz) => pt(fxOf(f), yLo - 35, sz * (D / 2 - PT - 30))), [0, 1, 0], { on: `${fid(f)}RL`, ...CAM }),
  ];
  // a bay's front rails and back panels: a cam bolt in each end of the lower rails and the lower back panel,
  // dowels in every end; the top rail and the upper back panel take a cam bolt from the post instead
  const ends = (c: number) => S.map((g) => ({ g, x: bayX(c) + (g * bayW) / 2 }));
  const bayBolts = (c: number) => [
    ...railY.slice(0, rows).map((y, r) => ends(c).map(({ g, x }) => fx("camScrew", [pt(x, y, zP)], [-g, 0, 0], { on: `F${c}${r}` }))).flat(),
    ...ends(c).map(({ g, x }) => fx("camScrew", [pt(x, bpC(0), -zP)], [-g, 0, 0], { on: `K${c}0` })),
  ];
  const bayDowels = (c: number) => [
    ...railY.map((y, r) => ends(c).map(({ g, x }) => fx("dowel", r === 0 ? [pt(x, y - 10, zP - 5), pt(x, y + 10, zP - 5)] : [pt(x, y, zP - 6)], [-g, 0, 0], { on: `F${c}${r}`, ...DOWEL }))).flat(),
    ...[0, 1].flatMap((k) => ends(c).map(({ g, x }) => fx("dowel", [-120, 120].map((dy) => pt(x, bpC(k) + dy, -zP)), [-g, 0, 0], { on: `K${c}${k}`, ...DOWEL }))),
  ];
  // the post's own cam bolts for the top rail and the upper back panel, and the locks for all of them
  const postSideBolts = (c: number, g: number) => {
    const f = cols === 2 ? (c === 0 ? (g < 0 ? -1 : 0) : g < 0 ? 0 : 1) : g;
    const x = bayX(c) + (g * bayW) / 2;
    return [fx("camScrew", [pt(x, ph - 15, zP)], [g, 0, 0], { on: postId(f, 1) }), fx("camScrew", [pt(x, bpC(1), -zP)], [g, 0, 0], { on: postId(f, -1) })];
  };
  const bayCams = (c: number, g: number) => {
    const f = cols === 2 ? (c === 0 ? (g < 0 ? -1 : 0) : g < 0 ? 0 : 1) : g;
    const x = fxOf(f) - g * 6;
    const xi = bayX(c) + (g * bayW) / 2 - g * 34;
    return [
      fx("cam", railY.slice(0, rows).map((y) => pt(x, y, zP - PT / 2)), [0, 0, 1], { on: postId(f, 1), ...CAM }),
      fx("cam", [pt(x, bpC(0), -zP + PT / 2)], [0, 0, -1], { on: postId(f, -1), ...CAM }),
      fx("cam", [pt(xi, ph, zP)], [0, -1, 0], { on: `F${c}${rows}`, ...CAM }),
      fx("cam", [pt(xi, bpC(1) + bpH / 2, -zP)], [0, -1, 0], { on: `K${c}1`, ...CAM }),
    ];
  };
  const runnerY = (r: number) => railY[r] + 65;
  const runners = (f: number, side: number): CustomFix[] =>
    Array.from({ length: rows }, (_, r) => [
      fx("runner", [pt(fxOf(f) + side * 6, runnerY(r), 0)], [-side, 0, 0], { len: 400, dia: 30, name: "Drawer runner", on: `${fid(f)}SP` }),
      fx("screw", [-150, 150].map((z) => pt(fxOf(f) + side * 6, runnerY(r), z)), [-side, 0, 0], { len: 12, dia: 4, on: `${fid(f)}SP` }),
    ]).flat();

  const left = frames[0], right = frames[frames.length - 1];
  const steps: CustomStep[] = [
    {
      title: "Lay out the posts and the side parts",
      detail: cols === 2 ? "On a rug: six posts, three sets of side rails and panels." : "On a rug: four posts, the side rails and the side panels.",
      add: frameIds(left).slice(0, 3),
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw the cam bolts into the posts",
      detail: "Two in each post, at the rail holes, and one more at the top front and the back of each post that faces a bay.",
      fix: [...frames.flatMap(postBolts), ...Array.from({ length: cols }, (_, c) => S.flatMap((g) => postSideBolts(c, g))).flat()],
      wait: frames.flatMap((f) => [postId(f, 1), postId(f, -1)]),
      tools: ["screwdriver"],
    },
    { title: "Tap the dowels into the posts", detail: "Two in each post, for the side panel.", fix: frames.flatMap(postDowels), tools: ["hammer"] },
    {
      title: "Push the posts onto the side",
      detail: "One onto each end of the rails and the panel. Make the other side frame" + (cols === 2 ? "s" : "") + " the same way.",
      add: [postId(left, 1), postId(left, -1)],
      wait: frames.slice(1).flatMap(frameIds),
    },
    { title: "Lock the posts", detail: "Four cam locks in the rails, arrow towards the bolt.", fix: railCams(left), tools: ["screwdriver"] },
    {
      title: "Screw the drawer runners onto the side panels",
      detail: "Three on each panel, two screws each, on the inside. The marks show which side they're for.",
      fix: frames.flatMap((f) => (f === -1 ? runners(f, 1) : f === 1 ? runners(f, -1) : [...runners(f, 1), ...runners(f, -1)])),
      tools: ["screwdriver"],
    },
  ];
  for (let c = 0; c < cols; c++) {
    const next = cols === 2 && c === 0 ? 0 : right;
    const rails = railY.map((_, r) => `F${c}${r}`);
    steps.push(
      { title: "Screw the cam bolts into the rails and back panels", detail: "One in each end of the lower front rails and the lower back panel.", fix: bayBolts(c), wait: [...rails, `K${c}0`, `K${c}1`], tools: ["screwdriver"] },
      { title: "Tap the dowels into the rails and back panels", detail: "In every end: two in the bottom rail, one in each of the others, two in each back panel end.", fix: bayDowels(c), tools: ["hammer"] },
      { title: "Stand the front rails in the side", detail: "Bottom rail first, the top rail last, onto the dowels and cam bolts.", add: rails },
      { title: "Stand the back panels in", detail: "Onto their dowels, one above the other.", add: [`K${c}0`, `K${c}1`] },
      { title: "Lock the rails and the back panels", detail: "Cam locks in the posts and in the top rail and the upper back panel.", fix: bayCams(c, -1), tools: ["screwdriver"] },
      {
        title: next === right ? "Lay the other side on" : "Lay the middle frame on",
        detail: "Together: down onto all the dowels and cam bolts at once.",
        add: frameIds(next),
        fix: railCams(next),
        people: 2,
      },
      { title: "Lock it", detail: "Cam locks in the posts and in the top rail and the upper back panel.", fix: bayCams(c, 1), tools: ["screwdriver"] },
    );
  }
  steps.push(
    { title: "Press the glides under the posts", detail: "One under each post.", fix: [fx("glide", frames.flatMap((f) => S.map((sz) => pt(fxOf(f), 0, sz * zP))), [0, 1, 0], { len: 6, dia: 30, name: "Glide" })], tools: ["hammer"] },
    {
      title: "Stand it up and tap in the dowels for the top",
      detail: "In the tops of the posts.",
      fix: frames.flatMap((f) => S.map((sz) => fx("dowel", [pt(fxOf(f) + (f ? -f * 8 : 0), ph, sz * (zP - 10))], [0, -1, 0], { on: postId(f, sz), ...DOWEL }))),
      pose: "+y",
      people: 2,
      tools: ["hammer"],
    },
    { title: "Screw the cam bolts under the top", detail: "Lay the top upside down. One over each corner post.", fix: [fx("camScrew", S.flatMap((g) => S.map((sz) => pt(g * (W / 2 - PT / 2), ph, sz * (zP - 8)))), [0, 1, 0], { on: "TP" })], wait: ["TP"], tools: ["screwdriver"] },
    {
      title: "Screw the wall brackets under the top",
      detail: "At the back, one near each end, two screws each.",
      fix: [
        fx("angle", [-1, 1].map((g) => pt(g * (W / 2 - 200), ph, -D / 2 + 25)), [0, 1, 0], { name: "Wall bracket", len: 50, dia: 30, on: "TP", twist: Math.PI }),
        fx("screw", [-1, 1].flatMap((g) => [-15, 15].map((d) => pt(g * (W / 2 - 200) + d, ph, -D / 2 + 45))), [0, 1, 0], { len: 12, dia: 4, on: "TP" }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Put the top on", detail: "Onto the dowels and cam bolts in the posts.", add: ["TP"], people: cols === 2 ? 2 : 1 },
    { title: "Lock the top", detail: "Four cam locks in the corner posts.", fix: S.flatMap((g) => S.map((sz) => fx("cam", [pt(g * (W / 2 - PT), ph - 34, sz * zP)], [g, 0, 0], { on: postId(g, sz), ...CAM }))), tools: ["screwdriver"] },
    {
      title: "Screw the top rail up into the top",
      detail: "Long screws up through the top front rail. Stop when the heads are flush.",
      fix: [fx("screw", Array.from({ length: cols }, (_, c) => [-1, 0, 1].map((k) => pt(bayX(c) + (k * bayW) / 3, ph - 30, zP))).flat(), [0, 1, 0], { len: 50, dia: 5, name: "Long screw" })],
      tools: ["allen"],
    },
    {
      title: "Fit the drawer interlock",
      detail: "Screw the catch arm inside the right side so only one drawer can open at a time.",
      fix: [fx("clip", [pt(fxOf(right) - 6, ph - 120, 0)], [1, 0, 0], { name: "Interlock arm", len: 40, dia: 30, on: `${fid(right)}SP` }), fx("screw", [-20, 20].map((z) => pt(fxOf(right) - 6, ph - 120, z)), [1, 0, 0], { len: 12, dia: 4, on: `${fid(right)}SP` })],
      tools: ["screwdriver"],
    },
    { title: "Push it against the wall", detail: "Mark through the brackets, pull it away and drill.", tools: ["pencil", "drill"], warnings: ["wall"] },
    {
      title: "Fix it to the wall",
      detail: "Plugs into the wall, then a screw with a washer through each bracket. The plugs suit solid walls; use fixings made for your wall.",
      fix: [
        fx("plug", [-1, 1].map((g) => pt(g * (W / 2 - 200), ph - 25, -D / 2 - 35)), [0, 0, -1], { included: true }),
        fx("washer", [-1, 1].map((g) => pt(g * (W / 2 - 200), ph - 25, -D / 2 - 7)), [0, 0, -1], { included: true }),
        fx("screw", [-1, 1].map((g) => pt(g * (W / 2 - 200), ph - 25, -D / 2 - 5)), [0, 0, -1], { len: 50, dia: 5, included: true }),
      ],
      tools: ["screwdriver"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  );
  buildCustom(b, { ...s, custom: { parts, steps } });

  const types = new Map<string, string>();
  const groups = Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (_, r) => ankDrawer(b, { cx: bayX(c), yb: railY[r] + 15, ow: bayW, oh: railY[r + 1] - railY[r] - 30, zFace: D / 2, dd: D - 2 * PT - 30, strip: false, wire: true, runnerScrews: 2, types })),
  );
  const all = groups.flat();
  ankDrawerSteps(b, all, { scene: "drawer" });
  const KNOB = { kind: "knob" as const, len: 30, dia: 34 };
  const KNOB_SCREW = { kind: "screw" as const, len: 25, dia: 4 };
  const knobs = (d: (typeof all)[number]) => [-1, 1].map((g): FitOpts => ({ on: d.front, at: [d.cx + g * d.fw * 0.25, d.fy, D / 2 + 8], dir: [0, 0, -1], hole: false }));
  const knobScrews = (d: (typeof all)[number]) => [-1, 1].map((g): FitOpts => ({ on: d.front, at: [d.cx + g * d.fw * 0.25, d.fy, D / 2 - 16], dir: [0, 0, 1] }));
  b.step({ title: "Screw on the knobs", detail: "Two on every drawer front, the screws from inside.", kind: "screws", tools: ["screwdriver"], scene: "drawer" }, () => {
    b.fits(KNOB, all.flatMap(knobs), 0.06);
    b.then(0.05);
    b.fits(KNOB_SCREW, all.flatMap(knobScrews), 0.05);
  });
  ankDrawersIn(b, groups, "Push the drawers in", "Onto their runners, all the way in, one at a time.");
}

const family: Family = {
  names: ["KOPPANG"],
  build(b, s) {
    const slug = s.slug ?? "";
    if (slug === "koppang-chest-3-drawers") return chest(b, s, 1), true;
    if (slug === "koppang-chest-6-drawers") return chest(b, s, 2), true;
    return false;
  },
};
export default family;
