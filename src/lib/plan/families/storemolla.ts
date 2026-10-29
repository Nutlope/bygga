import type { Family } from "./family";
import type { PartPiece, Pose, ProductSpec, StepKind, ToolId, Vec3, WarnId } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { rotate } from "../math";

/**
 * STOREMOLLA chests, read from IKEA's 3-drawer and 5-drawer manuals (solid pine).
 *
 * The two side frames come made up (legs, rails and side panel). They are laid inside face up on a rug: wall
 * bracket (3-drawer: on a side frame; 5-drawer: under the top), feet, the runners screwed on, and cam bolts. The
 * chest is then built lying on its left side: the front rails (dowels in their ends) stand in the left frame and
 * are cam-locked, the two back halves slide down between the legs, cam locks go in the top ends and the right
 * frame is lowered on and locked. The 3-drawer's top front rail is screwed on separately. Standing up: the top
 * back rail on dowels, dowels and cam locks in the frame tops, cam bolts in the top, the top on and locked, feet
 * levelled and the chest fixed to the wall. Each drawer is built face down: cam bolts in the front, sides on
 * dowels and cams, the bottom slid in, a back stop tapped on, the back on wedge pins and cam locks, the knob, then
 * it goes onto the runners.
 * The 8-drawer chest has its own manual: runners go on the side frames, the middle frame and two short panels on a
 * rug, then it is built upside down on its top: the short panels, the middle frame and both side frames stand on
 * the top on dowels and cam locks, the three front rails go across (screwed to the middle frame), the bottom panel
 * with its middle leg is screwed on, the two back boards slide down and are riveted, and five feet go in before it is
 * turned over. Four folding brackets under the top fix it to the wall with spacer blocks.
 * The nightstand is built lying on its left side: the rail, back, shelf and bottom stand in the left frame on dowels
 * and cam locks, the right frame goes on, feet in, then standing up the top is locked on, a strap ties it to the
 * wall, and the door hangs on two hinges on the right frame. Both build their drawers like the chests.
 */

type StepOpts = { title: string; detail?: string; tools?: ToolId[]; pose?: Pose; scene?: string; kind?: StepKind; warnings?: WarnId[]; people?: 1 | 2; wall?: boolean };
const step = (b: PlanBuilder, o: StepOpts, body: () => void = () => {}) => b.step({ kind: "general", ...o, warnings: o.warnings ?? (o.people === 2 ? ["two"] : []) }, body);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const sg = (i: number) => (i === 0 ? -1 : 1);

const CAM_BOLT: HwDef = { kind: "camScrew", len: 34, dia: 7 };
const CAM: HwDef = { kind: "cam", len: 13, dia: 15 };
const BACK_CAM: HwDef = { kind: "cam", len: 12, dia: 18, name: "Back cam lock" };
const DOWEL: HwDef = { kind: "dowel", len: 30, dia: 8 };
const RUN_SCREW: HwDef = { kind: "screw", len: 12, dia: 4 };
const FOOT: HwDef = { kind: "foot", len: 30, dia: 30 };
const STOP: HwDef = { kind: "clip", len: 10, dia: 20, name: "Drawer stop" };
const BRACKET: HwDef = { kind: "angle", len: 70, dia: 30, name: "Wall bracket" };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const WASHER: HwDef = { kind: "washer", len: 2, dia: 14 };
const LONG_SCREW: HwDef = { kind: "screw", len: 70, dia: 6, name: "Long screw" };
const WEDGE: HwDef = { kind: "camScrew", len: 30, dia: 8, name: "Wedge cam pin" };
const BACK_CLIP: HwDef = { kind: "clip", len: 80, dia: 20, name: "Back stop" };
const KNOB: HwDef = { kind: "knob", len: 30, dia: 34 };
const KNOB_SCREW: HwDef = { kind: "screw", len: 30, dia: 4, name: "Knob screw" };
const WALL_BLOCK: HwDef = { kind: "connector", len: 60, dia: 20, name: "Wall fitting" };
const PLUG: HwDef = { kind: "plug", len: 35, dia: 8, notIncluded: true };
const WALL_SCREW: HwDef = { kind: "screw", len: 50, dia: 5, notIncluded: true };

const L = 45; // legs
const FREE = 130; // free under the chest
const RT = 40; // front and back rails

/** Show parts somewhere else, as they sit in the product, turned by `rot` about `pivot` and moved to `at`. */
function lay(b: PlanBuilder, keys: string[], pivot: Vec3, at: Vec3, rot: Vec3, from: Vec3 = [0, 160, 0]) {
  for (const k of keys) {
    const it = b.partItem(k);
    const p = rotate([it.final.pos[0] - pivot[0], it.final.pos[1] - pivot[1], it.final.pos[2] - pivot[2]], rot);
    b.stage(k, [p[0] + at[0], p[1] + at[1], p[2] + at[2]], rot, from);
  }
}

function chest(b: PlanBuilder, s: ProductSpec, n: number) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const wide = n <= 3; // the 3-drawer: bracket on a side frame, stops in the left side, a screwed top front rail
  const TT = 25;
  const legH = H - TT;
  const CW = W - 30, CD = D - 30;
  const zc = -10;
  const lx = CW / 2 - L / 2;
  const zF = zc + CD / 2 - L / 2, zB = zc - CD / 2 + L / 2;
  const IW = CW - 2 * L; // between the frames
  const zone0 = FREE + RT, zone1 = legH - RT;
  const open = (zone1 - zone0 - (n - 1) * RT) / n;
  const chestRunY = (i: number) => zone0 + i * (open + RT) + 20;
  const xi = CW / 2 - L; // inside face of a side frame

  // side frames, with the legs, rails and panel all in one piece
  const sideLen = CD - 2 * L;
  const sideMid: Vec3 = [0, legH / 2, zc];
  const sidePieces: PartPiece[] = [
    ...[zF, zB].map((z): PartPiece => ({ shape: "box", size: [L, legH, L], pos: [0, 0, z - zc] })),
    { shape: "box", size: [L, 60, sideLen], pos: [0, legH / 2 - 30, 0] },
    { shape: "box", size: [L, 60, sideLen], pos: [0, FREE + 30 - legH / 2, 0] },
    { shape: "box", size: [16, legH - FREE - 120, sideLen], pos: [0, (FREE + 60 + legH - 60) / 2 - legH / 2, 0] },
    // a rung behind each runner, flush with the inside face, that the runner screws go into
    ...range(n).map((i): PartPiece => ({ shape: "box", size: [L, 40, sideLen], pos: [0, chestRunY(i) - legH / 2, 0] })),
  ];
  const sideT = b.part("Side frame", [L, legH, CD], { material: "wood" });
  b.parts[b.parts.length - 1].pieces = sidePieces;
  const sides = [-1, 1].map((g) => b.place(sideT, [g * lx, sideMid[1], sideMid[2]]));

  // front rails: the bottom one and one between each pair of drawers, then the top one
  const railYs = [FREE + RT / 2, ...range(n - 1).map((k) => zone0 + (k + 1) * open + k * RT + RT / 2)];
  const railT = b.part("Front rail", [IW, RT, RT], { material: "wood" });
  const rails = railYs.map((y) => b.place(railT, [0, y, zF]));
  const topRail = b.place(railT, [0, legH - RT / 2, zF]);
  const camRails = wide ? rails : [...rails, topRail];
  const backRail = b.place(b.part("Top back rail", [IW, RT, RT], { material: "wood" }), [0, legH - RT / 2, zB]);
  const halfT = b.part("Back half", [IW / 2, legH - FREE - RT, 14], { material: "wood" });
  const halves = [-1, 1].map((g) => b.place(halfT, [(g * IW) / 4, (FREE + legH - RT) / 2, zB]));
  const top = b.place(b.part("Top", [W, TT, D], { material: "wood" }), [0, H - TT / 2, 0]);

  // drawers on runners, fronts flush with the rails
  const dSide = xi - 13; // outside of the drawer sides
  const dLen = Math.min(400, CD - 2 * L + 20);
  const dz1 = zF + RT / 2 - 20, dz0 = dz1 - dLen;
  const drawers = range(n).map((i) => {
    const y0 = zone0 + i * (open + RT);
    const yc = y0 + open / 2, h = open - 50;
    const sy = y0 + 8 + h / 2;
    return {
      yc,
      y0,
      front: b.place(b.part("Drawer front", [IW - 6, open - 6, 20], { material: "wood" }), [0, yc, zF + RT / 2 - 10]),
      sides: [-1, 1].map((g) => b.place(b.part("Drawer side", [14, h, dLen], { material: "wood" }), [g * (dSide - 7), sy, (dz0 + dz1) / 2])),
      back: b.place(b.part("Drawer back", [2 * dSide - 28, h - 20, 14], { material: "wood" }), [0, sy + 10, dz0 + 7]),
      bottom: b.place(b.part("Drawer bottom", [2 * dSide - 20, 4, dLen - 14], { material: "fiber" }), [0, y0 + 16, (dz0 + dz1) / 2 + 3]),
    };
  });
  const dKeys = (d: (typeof drawers)[number]) => [d.front, ...d.sides, d.back, d.bottom];

  /* ---------- side frames, inside face up on the rug ---------- */
  const flatL: Vec3 = [0, 0, Math.PI / 2], flatR: Vec3 = [0, 0, -Math.PI / 2];
  const layFrames = () => {
    lay(b, [sides[0]], [-lx, legH / 2, zc], [-(legH / 2 + 150), L / 2, 0], flatL);
    lay(b, [sides[1]], [lx, legH / 2, zc], [legH / 2 + 150, L / 2, 0], flatR);
  };
  const scene = "frames";
  const onFace = (i: number, y: number, z: number): FitOpts => ({ on: sides[i], at: [sg(i) * xi, y, z], dir: [sg(i), 0, 0] });
  const runY = (d: (typeof drawers)[number]) => d.y0 + 20;
  const bracketAt: Vec3 = [xi, legH - 30, zB + L];
  if (wide)
    step(b, { title: "Screw the wall bracket onto the right side frame", detail: "Lay both side frames on a rug, inside face up. The bracket goes at the top of the back leg, one screw and a washer.", tools: ["screwdriver"], scene, kind: "screws", warnings: ["floor"] }, () => {
      layFrames();
      b.then(0.15);
      b.fit(BRACKET, { on: sides[1], at: bracketAt, dir: [1, 0, 0], hole: false });
      b.then(0.1);
      b.fit(WASHER, { on: sides[1], at: [bracketAt[0] - 3, bracketAt[1], bracketAt[2]], dir: [1, 0, 0], hole: false });
      b.fit(BRACKET_SCREW, { on: sides[1], at: [bracketAt[0] - 4, bracketAt[1], bracketAt[2]], dir: [1, 0, 0] });
    });
  if (wide)
    step(b, { title: "Press the drawer stops into the left side", detail: "One at the back of each drawer opening, pushed in until it sits flat.", scene, kind: "general" }, () =>
      b.fits(STOP, drawers.map((d) => ({ ...onFace(0, d.yc, zB + L + 30), hole: false as const })), 0.15),
    );
  step(b, { title: "Screw the feet into the legs", detail: wide ? "One under each leg, turned in by hand most of the way. You level them at the end." : "Lay both side frames on a rug, inside face up, and turn a foot into the bottom of each leg by hand.", scene, kind: "legs", warnings: wide ? [] : ["floor"] }, () => {
    if (!wide) {
      layFrames();
      b.then(0.15);
    }
    b.fits(FOOT, [0, 1].flatMap((i) => [zF, zB].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * lx, 0, z], dir: [0, 1, 0], hole: false }))), 0.15);
  });
  const runners = (i: number) => {
    b.fits({ kind: "runner", len: Math.round(dLen / 10) * 10, dia: 20, name: "Drawer runner" }, drawers.map((d): FitOpts => ({ ...onFace(i, runY(d), (dz0 + dz1) / 2), hole: false })), 0.15);
    b.then(0.1);
    b.fits(RUN_SCREW, drawers.flatMap((d) => [dz0 + 40, dz1 - 40].map((z) => onFace(i, runY(d), z))), 0.05);
  };
  step(b, { title: "Screw the runners onto the left side frame", detail: "The runners marked L, one at each drawer opening, wheel end to the front. Two screws each.", tools: ["screwdriver"], scene, kind: "runners" }, () => runners(0));
  step(b, { title: "Screw the runners onto the right side frame", detail: "The ones marked R. Push the catch at the back of each one up until it clicks.", tools: ["screwdriver"], scene, kind: "runners" }, () => runners(1));
  const boltYs = [...camRails.map((k) => b.partItem(k).final.pos[1])];
  const halfYs = [FREE + 120, legH - RT - 120];
  step(b, { title: "Screw in the cam bolts", detail: `${camRails.length + 2} in each frame's inside face: one at each front rail, two for the back.`, tools: ["screwdriver"], scene, kind: "cams" }, () =>
    b.fits(CAM_BOLT, [0, 1].flatMap((i) => [...boltYs.map((y) => onFace(i, y, zF)), ...halfYs.map((y) => onFace(i, y, zB))]), 0.05),
  );

  /* ---------- on its left side ---------- */
  step(b, { title: "Tap the dowels into the front rails", detail: "One in each end, beside the hole for the cam bolt.", tools: ["hammer"], scene: "rails", kind: "dowels" }, () => {
    camRails.forEach((k, j) => b.stage(k, [0, RT / 2, j * 120], [0, 0, 0], [0, 160, 0]));
    b.then(0.15);
    b.fits(DOWEL, camRails.flatMap((k) => [-1, 1].map((g): FitOpts => {
      const p = b.partItem(k).final.pos;
      return { on: k, at: [g * (IW / 2), p[1], p[2] - 10], dir: [g, 0, 0] };
    })), 0.03);
  });
  step(b, { title: "Stand the front rails in the left side frame", detail: "Lay the frame inside face up and push each rail's dowels into its holes, cam bolt into the hole in the rail end. Turn the cam locks to grip them.", tools: ["flathead"], pose: "+x", kind: "cams", warnings: ["floor"] }, () => {
    b.add(sides[0], [-300, 0, 0]);
    b.then(0.15);
    for (const k of camRails) b.add(k, [300, 0, 0]);
    b.then(0.1);
    b.fits(CAM, camRails.map((k): FitOpts => {
      const p = b.partItem(k).final.pos;
      return { on: k, at: [-IW / 2 + 30, p[1], zF + RT / 2], dir: [0, 0, -1] };
    }), 0.1);
  });
  step(b, { title: "Tap the dowels into the back halves", detail: "Two along each long edge: the outer edge goes into the frame, the inner one into the other half.", tools: ["hammer"], scene: "back", kind: "dowels" }, () => {
    halves.forEach((k, i) => b.stage(k, [sg(i) * (IW / 4 + 60), 7, 0], [Math.PI / 2, 0, 0], [0, 160, 0]));
    b.then(0.15);
    b.fits(DOWEL, halves.flatMap((k, i) => [sg(i) * IW / 2, 0].flatMap((x) => halfYs.map((y): FitOpts => ({ on: k, at: [x === 0 ? 0 : x, y + (x === 0 ? 60 : 0), zB], dir: [x === 0 ? -sg(i) : sg(i), 0, 0] })))), 0.05);
  });
  step(b, { title: "Slide the back halves down into the frame", detail: "Between the back legs, the smooth side out, one after the other with their dowels joined. Lock them with two cam locks.", tools: ["flathead"], pose: "+x", kind: "cams" }, () => {
    b.stagger(0.3);
    for (const k of halves) b.add(k, [300, 0, 0]);
    b.then(0.1);
    b.fits(CAM, halfYs.map((y): FitOpts => ({ on: halves[0], at: [-IW / 2 + 30, y, zB + 7], dir: [0, 0, -1] })), 0.1);
  });
  const topCams = [...camRails.map((k): FitOpts => {
    const p = b.partItem(k).final.pos;
    return { on: k, at: [IW / 2 - 30, p[1], zF + RT / 2], dir: [0, 0, -1] };
  }), ...halfYs.map((y): FitOpts => ({ on: halves[1], at: [IW / 2 - 30, y, zB + 7], dir: [0, 0, -1] }))];
  step(b, { title: "Push cam locks into the upper ends", detail: `${topCams.length} of them, arrows pointing at the holes, so the other frame's cam bolts can go in.`, pose: "+x", kind: "cams" }, () => b.fits(CAM, topCams, 0.06));
  step(b, { title: "Lower the right side frame on", detail: "Inside face down, cam bolts into the rails and back. Turn all the cam locks clockwise to pull it tight.", tools: ["flathead"], pose: "+x", people: 2, kind: "cams" }, () => b.add(sides[1], [300, 0, 0]));
  if (wide)
    step(b, { title: "Screw on the top front rail", detail: "Across the top of the front, one long screw through each frame into its ends, with the Allen key.", tools: ["allen"], pose: "+x", kind: "screws" }, () => {
      b.add(topRail, [0, 0, 300]);
      b.then(0.1);
      b.fits(LONG_SCREW, [0, 1].map((i): FitOpts => ({ on: sides[i], at: [sg(i) * CW / 2, legH - RT / 2, zF], dir: [-sg(i), 0, 0], mate: topRail })), 0.2);
    });

  /* ---------- standing up ---------- */
  step(b, { title: "Stand it up and fit the top back rail", detail: "Four dowels in the rail's edges; it sits on the back halves between the back legs.", tools: ["hammer"], pose: "+y", people: 2, kind: "dowels" }, () => {
    b.add(backRail, [0, 200, 0]);
    b.then(0.1);
    b.fits(DOWEL, [-1, 1].flatMap((g) => [legH - RT, legH].map((y): FitOpts => ({ on: backRail, at: [(g * IW) / 4, y, zB], dir: [0, y === legH ? 1 : -1, 0] }))), 0.08);
  });
  const sideTops = (i: number, k: number) => range(k).map((j): Vec3 => [sg(i) * lx, legH, zc - CD / 2 + L + ((CD - 2 * L) * (j + 0.5)) / k]);
  step(b, { title: "Tap the dowels into the frame tops", detail: "Four along the top of each side frame.", tools: ["hammer"], kind: "dowels" }, () =>
    b.fits(DOWEL, [0, 1].flatMap((i) => sideTops(i, 4).map((at): FitOpts => ({ on: sides[i], at, dir: [0, 1, 0], mate: top }))), 0.05),
  );
  step(b, { title: "Push cam locks into the frame tops", detail: "Three in each, arrows pointing at the edge.", kind: "cams" }, () =>
    b.fits(CAM, [0, 1].flatMap((i) => sideTops(i, 3).map((p): FitOpts => ({ on: sides[i], at: [p[0] - sg(i) * (L / 2), p[1] - 30, p[2]], dir: [sg(i), 0, 0] }))), 0.06),
  );
  const topBolts = [0, 1].flatMap((i) => sideTops(i, 3).map((p): FitOpts => ({ on: top, at: [p[0], legH, p[2]], dir: [0, 1, 0] })));
  step(b, { title: wide ? "Screw the cam bolts into the top" : "Fix the wall bracket and cam bolts under the top", detail: wide ? "Turn the top face down on the rug: six cam bolts into the holes underneath." : "Turn the top face down on the rug. The wall bracket goes at the back with one screw and a washer, then six cam bolts.", tools: ["screwdriver"], scene: "top", kind: "cams" }, () => {
    b.stage(top, [0, TT / 2, 0], [Math.PI, 0, 0], [0, 160, 0]);
    b.then(0.15);
    if (!wide) {
      b.fit(BRACKET, { on: top, at: [0, legH, zB - L / 2 + 5], dir: [0, 1, 0], hole: false });
      b.fit(WASHER, { on: top, at: [0, legH - 3, zB - L / 2 + 5], dir: [0, 1, 0], hole: false });
      b.fit(BRACKET_SCREW, { on: top, at: [0, legH - 4, zB - L / 2 + 5], dir: [0, 1, 0] });
      b.then(0.1);
    }
    b.fits(CAM_BOLT, topBolts, 0.06);
  });
  step(b, { title: "Lay the top on and lock it", detail: "Cam bolts down into the frame tops, dowels in their holes. Turn the six cam locks clockwise from inside.", tools: ["flathead"], people: 2, kind: "cams" }, () => b.add(top, [0, 300, 0]));
  step(b, { title: "Level the feet", detail: "Stand it where it will go and turn each foot until the top is level and the chest doesn't rock.", tools: ["level"], kind: "legs" });
  const wb: Vec3 = wide ? [bracketAt[0] + 10, bracketAt[1], -D / 2 - 15] : [0, legH - 10, -D / 2 - 15];
  step(b, { title: "Fix the chest to the wall", detail: "Mark the wall through the bracket and fit the wall fitting with two screws and plugs that suit your wall (sold separately). Push the chest back and screw the bracket to it.", tools: ["pencil", "drill", "screwdriver"], kind: "anchor", warnings: ["wall", "tip"] }, () => {
    b.fits(PLUG, [-20, 20].map((dx): FitOpts => ({ at: [wb[0] + dx, wb[1] + 40, wb[2]], dir: [0, 0, -1] })), 0.15);
    b.then(0.05);
    b.fit(WALL_BLOCK, { at: [wb[0], wb[1] + 40, wb[2] + 5], dir: [0, 0, -1], hole: false });
    b.fits(WALL_SCREW, [-20, 20].map((dx): FitOpts => ({ at: [wb[0] + dx, wb[1] + 40, wb[2] + 10], dir: [0, 0, -1] })), 0.15);
    b.then(0.1);
    b.fit(WASHER, { at: [wb[0], wb[1], wb[2] + 30], dir: [0, 0, -1], hole: false });
    b.fit({ kind: "screw", len: 20, dia: 4 }, { at: [wb[0], wb[1], wb[2] + 32], dir: [0, 0, -1] });
  });

  /* ---------- drawers, face down on the rug ---------- */
  const dscene = "drawers";
  const perRow = Math.min(3, n);
  const face: Vec3 = [Math.PI / 2, 0, 0];
  const dAt = (i: number): Vec3 => [((i % perRow) - (perRow - 1) / 2) * (IW + 120), 10, Math.floor(i / perRow) * (dLen + 200)];
  const showD = (keys: (d: (typeof drawers)[number]) => string[]) => drawers.forEach((d, i) => lay(b, keys(d), [0, d.yc, zF + RT / 2], dAt(i), face));
  const all = (f: (d: (typeof drawers)[number]) => FitOpts[]) => drawers.flatMap(f);
  const many = n > 1 ? `Build all ${n} the same way. ` : "";
  step(b, { title: "Screw the cam bolts into the drawer fronts", detail: `${many}Lay each front face down on the rug: four cam bolts in the inside face.`, tools: ["screwdriver"], scene: dscene, kind: "cams", warnings: ["floor"] }, () => {
    showD((d) => [d.front]);
    b.then(0.15);
    b.fits(CAM_BOLT, all((d) => [-1, 1].flatMap((g) => [d.y0 + 30, d.y0 + open - 70].map((y): FitOpts => ({ on: d.front, at: [g * (dSide - 7), y, dz1], dir: [0, 0, 1] })))), 0.03);
  });
  step(b, { title: "Tap the dowels into the drawer sides", detail: "Two in the front end of each side.", tools: ["hammer"], scene: dscene, kind: "dowels" }, () =>
    b.fits(DOWEL, all((d) => [0, 1].flatMap((i) => [d.y0 + 50, d.y0 + open - 90].map((y): FitOpts => ({ on: d.sides[i], at: [sg(i) * (dSide - 7), y, dz1], dir: [0, 0, 1], mate: d.front })))), 0.03),
  );
  step(b, { title: "Stand the sides on the fronts and lock them", detail: "Groove facing in, near the bottom. Four cam locks, turned clockwise.", tools: ["flathead"], scene: dscene, kind: "cams" }, () => {
    showD((d) => d.sides);
    b.then(0.15);
    b.fits(CAM, all((d) => [0, 1].flatMap((i) => [d.y0 + 30, d.y0 + open - 70].map((y): FitOpts => ({ on: d.sides[i], at: [sg(i) * (dSide - 14), y, dz1 - 30], dir: [sg(i), 0, 0] })))), 0.03);
  });
  step(b, { title: "Slide in the drawer bottoms", detail: "Striped side up, along the grooves until it meets the front.", scene: dscene, kind: "join" }, () => showD((d) => [d.bottom]));
  step(b, { title: "Tap a back stop onto each bottom", detail: "The wire clip goes over the back edge of the bottom, tapped in with a hammer.", tools: ["hammer"], scene: dscene, kind: "general" }, () =>
    b.fits(BACK_CLIP, drawers.map((d): FitOpts => ({ on: d.bottom, at: [0, d.y0 + 14, dz0 + 20], dir: [0, -1, 0], hole: false })), 0.1),
  );
  step(b, { title: "Fit the drawer backs", detail: "Lower each back between the sides over the bottom. Push the wedge pins through the sides and turn a cam lock in the back on each.", tools: ["flathead"], scene: dscene, kind: "cams" }, () => {
    showD((d) => [d.back]);
    b.then(0.15);
    b.fits(WEDGE, all((d) => [0, 1].flatMap((i) => [d.y0 + 40, d.y0 + open - 80].map((y): FitOpts => ({ on: d.sides[i], at: [sg(i) * dSide, y, dz0 + 7], dir: [-sg(i), 0, 0], mate: d.back })))), 0.03);
    b.then(0.1);
    b.fits(BACK_CAM, all((d) => [-1, 1].flatMap((g) => [d.y0 + 40, d.y0 + open - 80].map((y): FitOpts => ({ on: d.back, at: [g * (dSide - 60), y, dz0 + 14], dir: [0, 0, -1] })))), 0.03);
  });
  step(b, { title: "Screw a knob onto each front", detail: "The screw goes in from inside the drawer.", tools: ["screwdriver"], scene: dscene, kind: "screws" }, () => {
    b.fits(KNOB, drawers.map((d): FitOpts => ({ on: d.front, at: [0, d.yc, zF + RT / 2], dir: [0, 0, -1], hole: false })), 0.1);
    b.then(0.05);
    b.fits(KNOB_SCREW, drawers.map((d): FitOpts => ({ on: d.front, at: [0, d.yc, zF + RT / 2 - 20], dir: [0, 0, 1] })), 0.1);
  });
  step(b, { title: "Put the drawers on the runners", detail: "Pull each pair of runners out, set the drawer on them and push it in until both front catches click. Only one drawer opens at a time.", kind: "drawer" }, () => {
    b.stagger(0.25);
    for (const d of drawers) for (const k of dKeys(d)) b.add(k, [0, 0, 450]);
  });
  return true;
}

/* ---------- the 8-drawer chest and the nightstand ---------- */

const RIVET: HwDef = { kind: "clip", len: 12, dia: 8, name: "Plastic rivet" };
const WALL_PLUG: HwDef = { kind: "plug", len: 35, dia: 8 }; // in the box with these two
const WALL_SCREW8: HwDef = { kind: "screw", len: 50, dia: 5 };
const FOLD_BRACKET: HwDef = { kind: "angle", len: 60, dia: 30, name: "Folding wall bracket" };
const SPACER: HwDef = { kind: "spacer", len: 20, dia: 20, name: "Spacer block" };
const STRAP: HwDef = { kind: "strap", len: 110, dia: 20 };
const STRAP_SCREW: HwDef = { kind: "screw", len: 14, dia: 4 };
const CATCH: HwDef = { kind: "clip", len: 30, dia: 20, name: "Door catch" };
const BUMPER: HwDef = { kind: "glide", len: 3, dia: 10, name: "Door bumper" };
const PLATE: HwDef = { kind: "plate", len: 40, dia: 20, name: "Mounting plate" };
const HINGE: HwDef = { kind: "hinge", len: 50, dia: 35 };
const HINGE_SCREW: HwDef = { kind: "screw", len: 13, dia: 4 };

/** A made-up side frame: two legs, a rail at the top and one at `low`, and the panel between them. */
function sideFrame(b: PlanBuilder, legH: number, CD: number, zc: number, low: number, rungs: number[]) {
  const zF = zc + CD / 2 - L / 2, zB = zc - CD / 2 + L / 2;
  const len = CD - 2 * L;
  const t = b.part("Side frame", [L, legH, CD], { material: "wood" });
  b.parts[b.parts.length - 1].pieces = [
    ...[zF, zB].map((z): PartPiece => ({ shape: "box", size: [L, legH, L], pos: [0, 0, z - zc] })),
    { shape: "box", size: [L, 60, len], pos: [0, legH / 2 - 30, 0] },
    { shape: "box", size: [L, 60, len], pos: [0, low + 30 - legH / 2, 0] },
    { shape: "box", size: [16, legH - low - 120, len], pos: [0, (low + 60 + legH - 60) / 2 - legH / 2, 0] },
    // a rung behind each runner, flush with the inside face, that the runner screws go into
    ...rungs.map((y): PartPiece => ({ shape: "box", size: [L, 40, len], pos: [0, y - legH / 2, 0] })),
  ];
  return t;
}

interface Drawer {
  x: number;
  y0: number; // bottom of its opening
  h: number; // height of its opening
  w: number; // width between the runner faces
  yc: number;
  big: boolean;
  dSide: number; // outside of the drawer sides, from x
  sh: number; // height of the sides
  dz0: number;
  dz1: number;
  front: string;
  sides: string[];
  back: string;
  bottom: string;
}

function makeDrawers(b: PlanBuilder, list: { x: number; y0: number; h: number; w: number; big?: boolean }[], zFace: number, dLen: number): Drawer[] {
  const types = new Map<string, string>();
  const type = (name: string, size: Vec3, material: "wood" | "fiber") => {
    const k = name + size.join("x");
    if (!types.has(k)) types.set(k, b.part(name, size, { material }));
    return types.get(k)!;
  };
  return list.map((o) => {
    const dSide = o.w / 2 - 13, sh = o.h - 50, sy = o.y0 + 8 + sh / 2;
    const dz1 = zFace - 20, dz0 = dz1 - dLen, zm = (dz0 + dz1) / 2;
    return {
      ...o,
      big: !!o.big,
      yc: o.y0 + o.h / 2,
      dSide,
      sh,
      dz0,
      dz1,
      front: b.place(type("Drawer front", [o.w - 6, o.h - 6, 20], "wood"), [o.x, o.y0 + o.h / 2, zFace - 10]),
      sides: [-1, 1].map((g) => b.place(type("Drawer side", [14, sh, dLen], "wood"), [o.x + g * (dSide - 7), sy, zm])),
      back: b.place(type("Drawer back", [2 * dSide - 28, sh - 20, 14], "wood"), [o.x, sy + 10, dz0 + 7]),
      bottom: b.place(type("Drawer bottom", [2 * dSide - 20, 4, dLen - 14], "fiber"), [o.x, o.y0 + 16, zm + 3]),
    };
  });
}

/** The drawers as both manuals build them: sides dowelled, the front face down with cam bolts, sides on, bottom, back on wedge pins, knob. */
function drawerSteps(b: PlanBuilder, ds: Drawer[], zFace: number, dowels: 1 | 2) {
  const scene = "drawers";
  const face: Vec3 = [Math.PI / 2, 0, 0];
  const rows = [ds.filter((d) => !d.big), ds.filter((d) => d.big)].filter((r) => r.length);
  const spot = new Map<Drawer, Vec3>();
  rows.forEach((r, ri) => {
    const sp = Math.max(...r.map((d) => d.w)) + 120;
    r.forEach((d, k) => spot.set(d, [(k - (r.length - 1) / 2) * sp, 10, ri * 450]));
  });
  const showD = (keys: (d: Drawer) => string[]) => ds.forEach((d) => lay(b, keys(d), [d.x, d.yc, zFace], spot.get(d)!, face));
  const all = (f: (d: Drawer) => FitOpts[]) => ds.flatMap(f);
  const ys = (d: Drawer, fs: number[]) => fs.map((f) => d.y0 + 8 + d.sh * f);
  const sideX = (d: Drawer, g: number) => d.x + g * (d.dSide - 7);
  const many = ds.length > 1 ? `Build all ${ds.length} the same way. ` : "";
  const dowelYs = dowels === 2 ? [0.1, 0.9] : [0.5];

  step(b, { title: "Tap the dowels into the drawer sides", detail: `${many}${dowels === 2 ? "Two" : "One"} in the front end of each side.`, tools: ["hammer"], scene: "drawer sides", kind: "dowels", warnings: ["floor"] }, () => {
    const per = Math.min(4, ds.length);
    ds.forEach((d, i) =>
      d.sides.forEach((k, g) => {
        const at: Vec3 = [((i % per) - (per - 1) / 2) * 900, 7, Math.floor(i / per) * 520 + (g - 0.5) * (d.sh + 60)];
        b.stage(k, at, [0, Math.PI / 2, Math.PI / 2], [0, 160, 0]);
      }),
    );
    b.then(0.15);
    b.fits(DOWEL, all((d) => [0, 1].flatMap((i) => ys(d, dowelYs).map((y): FitOpts => ({ on: d.sides[i], at: [sideX(d, sg(i)), y, d.dz1], dir: [0, 0, -1], mate: d.front })))), 0.03);
  });
  step(b, { title: "Screw the cam bolts into the drawer fronts", detail: "Lay each front face down on the rug: four cam bolts in the inside face.", tools: ["screwdriver"], scene, kind: "cams" }, () => {
    showD((d) => [d.front]);
    b.then(0.15);
    b.fits(CAM_BOLT, all((d) => [-1, 1].flatMap((g) => ys(d, [0.3, 0.7]).map((y): FitOpts => ({ on: d.front, at: [sideX(d, g), y, d.dz1], dir: [0, 0, 1] })))), 0.03);
  });
  step(b, { title: "Stand the sides on the fronts and lock them", detail: "Dowels in their holes, grooves facing in and near the bottom. Turn the four cam locks clockwise.", tools: ["flathead"], scene, kind: "cams" }, () => {
    showD((d) => d.sides);
    b.then(0.15);
    b.fits(CAM, all((d) => [0, 1].flatMap((i) => ys(d, [0.3, 0.7]).map((y): FitOpts => ({ on: d.sides[i], at: [d.x + sg(i) * (d.dSide - 14), y, d.dz1 - 30], dir: [sg(i), 0, 0] })))), 0.03);
  });
  step(b, { title: "Slide in the drawer bottoms", detail: "Striped side up, along the grooves until it meets the front.", scene, kind: "join" }, () => showD((d) => [d.bottom]));
  const stops = ds.filter((d) => d.big);
  if (stops.length)
    step(b, { title: "Tap a back stop onto each big bottom", detail: "Only the four wide drawers get one: the wire clip goes over the back edge of the bottom.", tools: ["hammer"], scene, kind: "general" }, () =>
      b.fits(BACK_CLIP, stops.map((d): FitOpts => ({ on: d.bottom, at: [d.x, d.y0 + 14, d.dz0 + 20], dir: [0, -1, 0], hole: false })), 0.1),
    );
  step(b, { title: "Slide the backs down between the sides", detail: "Into the grooves, over the bottom.", scene, kind: "join" }, () => showD((d) => [d.back]));
  step(b, { title: "Push the wedge pins in", detail: "Four per drawer, through the sides into the back, by hand.", scene, kind: "cams" }, () =>
    b.fits(WEDGE, all((d) => [0, 1].flatMap((i) => ys(d, [0.35, 0.75]).map((y): FitOpts => ({ on: d.sides[i], at: [d.x + sg(i) * d.dSide, y, d.dz0 + 7], dir: [-sg(i), 0, 0], mate: d.back })))), 0.03),
  );
  step(b, { title: "Lock the backs", detail: "Four cam locks in the top edge of each back, the right ones for the back, turned clockwise.", tools: ["flathead"], scene, kind: "cams" }, () =>
    b.fits(BACK_CAM, all((d) => [-1, 1].flatMap((g) => ys(d, [0.35, 0.75]).map((y): FitOpts => ({ on: d.back, at: [d.x + g * (d.dSide - 50), y, d.dz0 + 14], dir: [0, 0, -1] })))), 0.03),
  );
  step(b, { title: ds.length > 1 ? "Screw a knob onto each front" : "Screw the knob onto the front", detail: "The screw goes in from inside the drawer.", tools: ["screwdriver"], scene, kind: "screws" }, () => {
    b.fits(KNOB, ds.map((d): FitOpts => ({ on: d.front, at: [d.x, d.yc, zFace], dir: [0, 0, -1], hole: false })), 0.1);
    b.then(0.05);
    b.fits(KNOB_SCREW, ds.map((d): FitOpts => ({ on: d.front, at: [d.x, d.yc, zFace - 20], dir: [0, 0, 1] })), 0.1);
  });
  step(b, { title: "Pull the runners out", detail: "Pull each pair all the way out, ready for its drawer.", kind: "runners" });
  step(b, { title: ds.length > 1 ? "Put the drawers on the runners" : "Put the drawer on the runners", detail: ds.length > 1 ? "Top row first. Set each drawer on its runners and push it in until both catches click. Only open one drawer at a time." : "Set it on the runners and push it in until both catches click.", kind: "drawer" }, () => {
    b.stagger(0.25);
    for (const d of [...ds].sort((a, c) => c.y0 - a.y0)) for (const k of [d.front, ...d.sides, d.back, d.bottom]) b.add(k, [0, 0, 450]);
  });
}

/** The 8-drawer chest: built upside down on its top, with a middle frame and two short panels between the side frames. */
function dresser8(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 25, BT = 20;
  const legH = H - TT;
  const CW = W - 30, CD = D - 30, zc = -10;
  const lx = CW / 2 - L / 2;
  const zF = zc + CD / 2 - L / 2, zB = zc - CD / 2 + L / 2;
  const xi = CW / 2 - L, IW = 2 * xi;
  const MT = 30, ST = 20; // middle frame and short panels
  const zFace = zF + RT / 2;
  const low = FREE + BT; // the frames stand on the bottom panel's level

  // rows: the bottom front rail, then a rail between each row of drawers
  const open = (legH - (FREE + RT) - 2 * RT) / 3;
  const rowY0 = [0, 1, 2].map((k) => FREE + RT + k * (open + RT)); // bottom row first
  const sideT = sideFrame(b, legH, CD, zc, low, rowY0.map((y) => y + 20));
  const sides = [-1, 1].map((g) => b.place(sideT, [g * lx, legH / 2, zc]));
  const top = b.place(b.part("Top", [W, TT, D], { material: "wood" }), [0, H - TT / 2, 0]);
  const railYs = [FREE + RT / 2, rowY0[1] - RT / 2, rowY0[2] - RT / 2];
  const railT = b.part("Front rail", [IW, RT, RT], { material: "wood" });
  const rails = railYs.map((y) => b.place(railT, [0, y, zF]));
  // the middle frame: a panel behind the rails, with its front edge notched around them
  const mz0 = zB + 7, mz1 = zF - RT / 2, fz1 = zFace - 22;
  const segs: [number, number][] = [[FREE + RT, railYs[1] - RT / 2], [railYs[1] + RT / 2, railYs[2] - RT / 2], [railYs[2] + RT / 2, legH]];
  const mid = b.compound("Middle frame", [
    { shape: "box", size: [MT, legH - low, mz1 - mz0], pos: [0, (low + legH) / 2, (mz0 + mz1) / 2] },
    ...segs.map(([a, c]): PartPiece => ({ shape: "box", size: [MT, c - a, fz1 - mz1], pos: [0, (a + c) / 2, (mz1 + fz1) / 2] })),
  ], { material: "wood" });
  const middle = b.place(mid.type, mid.mid);
  const big = (IW - MT) / 2;
  const shortX = MT / 2 + big / 2;
  const shortT = b.part("Short panel", [ST, legH - rowY0[2], fz1 - mz0], { material: "wood" });
  const shorts = [-1, 1].map((g) => b.place(shortT, [g * shortX, (rowY0[2] + legH) / 2, (mz0 + fz1) / 2]));
  const bottom = b.place(b.part("Bottom panel", [CW, BT, CD - 2 * L], { material: "wood" }), [0, FREE + BT / 2, zc]);
  const leg = b.place(b.part("Middle leg", [L, FREE, L], { material: "wood" }), [0, FREE / 2, zc]);
  const backH = (legH - FREE) / 2;
  const backT = b.part("Back board", [IW, backH, 14], { material: "wood" });
  const backs = [0, 1].map((k) => b.place(backT, [0, FREE + backH / 2 + k * backH, zB]));
  const small = (big - ST) / 2;
  const ds = makeDrawers(b, [
    ...[-1, 1].flatMap((g) => [g * (MT / 2 + small / 2), g * (shortX + ST / 2 + small / 2)]).sort((a, c) => a - c).map((x) => ({ x, y0: rowY0[2], h: open, w: small })),
    ...[1, 0].flatMap((r) => [-1, 1].map((g) => ({ x: g * (MT / 2 + big / 2), y0: rowY0[r], h: open, w: big, big: true }))),
  ], zFace, Math.min(400, CD - 2 * L + 20));

  /* ---------- runners on the frames, on a rug ---------- */
  const scene = "frames";
  const show = (k: string, at: Vec3, rot: Vec3) => lay(b, [k], b.partItem(k).final.pos, at, rot);
  const wallAt = (x: number) => (Math.abs(x) > xi - 5 ? sides[x < 0 ? 0 : 1] : Math.abs(x) < MT ? middle : shorts[x < 0 ? 0 : 1]);
  const runnerFits = (d: Drawer, g: number): FitOpts[] => {
    const x = d.x + g * (d.w / 2);
    const on = wallAt(x);
    const at = (z: number): FitOpts => ({ on, at: [x, d.y0 + 20, z], dir: [g, 0, 0] });
    return [at((d.dz0 + d.dz1) / 2), at(d.dz0 + 40), at(d.dz1 - 40)];
  };
  const RUNNER: HwDef = { kind: "runner", len: Math.round((ds[0].dz1 - ds[0].dz0) / 10) * 10, dia: 20, name: "Drawer runner" };
  const runners = (list: [Drawer, number][]) => {
    b.fits(RUNNER, list.map(([d, g]) => ({ ...runnerFits(d, g)[0], hole: false })), 0.15);
    b.then(0.1);
    b.fits(RUN_SCREW, list.flatMap(([d, g]) => runnerFits(d, g).slice(1)), 0.05);
  };
  const onWall = (k: string, g: number) => ds.filter((d) => wallAt(d.x + g * (d.w / 2)) === k).map((d): [Drawer, number] => [d, g]);
  step(b, { title: "Screw the runners onto the side frames", detail: "Lay both side frames on a rug, inside face up. Three runners on each, wheel end at the front, two screws each. Push the catch at the back of each one until it clicks.", tools: ["screwdriver"], scene, kind: "runners", warnings: ["floor"] }, () => {
    show(sides[0], [-(legH / 2 + 150), L / 2, 0], [0, 0, Math.PI / 2]);
    show(sides[1], [legH / 2 + 150, L / 2, 0], [0, 0, -Math.PI / 2]);
    b.then(0.15);
    runners([...onWall(sides[0], -1), ...onWall(sides[1], 1)]);
  });
  const shortAt = (i: number): Vec3 => [sg(i) * 620, ST / 2, CD + 250];
  step(b, { title: "Screw a runner onto each short panel", detail: "The runners marked L, two screws each, on the side shown.", tools: ["screwdriver"], scene, kind: "runners" }, () => {
    shorts.forEach((k, i) => show(k, shortAt(i), [0, 0, Math.PI / 2]));
    b.then(0.15);
    runners(shorts.flatMap((k) => onWall(k, -1)));
  });
  step(b, { title: "Turn them over and fit the other runners", detail: "The runners marked R on the other face, two screws each.", tools: ["screwdriver"], scene, kind: "runners" }, () => {
    shorts.forEach((k, i) => show(k, shortAt(i), [0, 0, -Math.PI / 2]));
    b.then(0.15);
    runners(shorts.flatMap((k) => onWall(k, 1)));
  });
  const midAt: Vec3 = [0, MT / 2, CD + 250];
  step(b, { title: "Screw three runners onto the middle frame", detail: "The L runners on one face, two screws each, and push their catches until they click.", tools: ["screwdriver"], scene, kind: "runners" }, () => {
    show(middle, midAt, [0, 0, Math.PI / 2]);
    b.then(0.15);
    runners(onWall(middle, -1));
  });
  step(b, { title: "Turn it over and fit three more", detail: "The R runners on the other face, the same way.", tools: ["screwdriver"], scene, kind: "runners" }, () => {
    show(middle, midAt, [0, 0, -Math.PI / 2]);
    b.then(0.15);
    runners(onWall(middle, 1));
  });
  // where each frame meets the top: dowels, cam bolts (in the top) and cam locks (in the frame faces)
  const joints: { k: string; x: number; face: number; g: number; dz: number[]; bz: number[] }[] = [
    ...[0, 1].map((i) => ({ k: sides[i], x: sg(i) * lx, face: sg(i) * xi, g: sg(i), dz: [-110, 50, 110], bz: [-160, 0, 160] })),
    { k: middle, x: 0, face: MT / 2, g: -1, dz: [-180, -60, 40, 150], bz: [-120, 100] },
    ...[0, 1].map((i) => ({ k: shorts[i], x: sg(i) * shortX, face: sg(i) * shortX + ST / 2, g: -1, dz: [-160, 40], bz: [-90, 120] })),
  ];
  step(b, { title: "Tap the dowels into the frame ends", detail: "Into the ends that meet the top: three in each side frame, four in the middle frame, two in each short panel.", tools: ["hammer"], scene, kind: "dowels" }, () =>
    b.fits(DOWEL, joints.flatMap((j) => j.dz.map((z): FitOpts => ({ on: j.k, at: [j.x, legH, zc + z], dir: [0, -1, 0], mate: top }))), 0.04),
  );

  /* ---------- upside down on the top ---------- */
  const up = { pose: "-y" as const };
  const wallXs = [-760, -90, 0, 470];
  step(b, { title: "Push the cam bolts into the top", detail: "Lay the top face down on a rug. Twelve cam bolts, pushed into their holes by hand, not screwed.", ...up, kind: "cams", warnings: ["floor"] }, () => {
    b.add(top, [0, -200, 0]);
    for (const x of wallXs) b.preset(FOLD_BRACKET, { on: top, at: [x, legH, -D / 2 + 25], dir: [0, 1, 0], hole: false });
    b.then(0.15);
    b.fits(CAM_BOLT, joints.flatMap((j) => j.bz.map((z): FitOpts => ({ on: top, at: [j.x, legH, zc + z], dir: [0, 1, 0] }))), 0.04);
  });
  const camsOf = (j: (typeof joints)[number]): FitOpts[] => j.bz.map((z) => ({ on: j.k, at: [j.face, legH - 30, zc + z], dir: [j.g, 0, 0] }));
  step(b, { title: "Stand the short panels on the top", detail: "Dowels and cam bolts into their holes. Turn the four cam locks clockwise.", tools: ["flathead"], ...up, kind: "cams" }, () => {
    for (const k of shorts) b.add(k, [0, -300, 0]);
    b.then(0.1);
    b.fits(CAM, joints.slice(3).flatMap(camsOf), 0.1);
  });
  step(b, { title: "Stand the middle frame on the top", detail: "In the middle, between the short panels. Turn its two cam locks clockwise.", tools: ["flathead"], ...up, kind: "cams" }, () => {
    b.add(middle, [0, -300, 0]);
    b.then(0.1);
    b.fits(CAM, camsOf(joints[2]), 0.1);
  });
  step(b, { title: "Stand the left side frame on the top", detail: "Legs pointing up. Turn its three cam locks clockwise.", tools: ["flathead"], ...up, kind: "cams" }, () => {
    b.add(sides[0], [0, -300, 0]);
    b.then(0.1);
    b.fits(CAM, camsOf(joints[0]), 0.1);
  });
  step(b, { title: "Stand the right side frame on the top", detail: "Push its three cam locks in, but don't turn them yet: the frame has to tilt out for the rails.", ...up, kind: "cams" }, () => {
    b.add(sides[1], [0, -300, 0]);
    b.then(0.1);
    b.fits(CAM, camsOf(joints[1]), 0.1);
  });
  // the three front rails
  const rscene = "rails";
  step(b, { title: "Tap the dowels into the front rails", detail: "One in each end.", tools: ["hammer"], scene: rscene, kind: "dowels" }, () => {
    rails.forEach((k, j) => show(k, [0, RT / 2, j * 150], [0, 0, 0]));
    b.then(0.15);
    b.fits(DOWEL, rails.flatMap((k, j) => [0, 1].map((i): FitOpts => ({ on: k, at: [sg(i) * IW / 2, railYs[j], zF - 10], dir: [-sg(i), 0, 0], mate: sides[i] }))), 0.05);
  });
  step(b, { title: "Push cam locks into the rails", detail: "One near each end, arrow pointing at the end.", scene: rscene, kind: "cams" }, () =>
    b.fits(CAM, rails.flatMap((k, j) => [0, 1].map((i): FitOpts => ({ on: k, at: [sg(i) * (IW / 2 - 35), railYs[j] - RT / 2, zF], dir: [0, 1, 0] }))), 0.05),
  );
  step(b, { title: "Push the cam bolts into the rail ends", detail: "By hand, the expanding end first, until they stop.", scene: rscene, kind: "cams" }, () =>
    b.fits(CAM_BOLT, rails.flatMap((k, j) => [0, 1].map((i): FitOpts => ({ on: k, at: [sg(i) * IW / 2, railYs[j], zF + 10], dir: [-sg(i), 0, 0], mate: sides[i] }))), 0.05),
  );
  step(b, { title: "Fit the rails between the side frames", detail: "Into the left frame first. Tilt the right frame out a little to get them in, each rail sitting in its notch in the middle frame.", ...up, kind: "join" }, () => {
    b.stagger(0.25);
    for (const k of rails) b.add(k, [0, 0, 300]);
  });
  step(b, { title: "Screw the rails to the middle frame", detail: "One long screw through each rail, with the Allen key.", tools: ["allen"], ...up, kind: "screws" }, () =>
    b.fits(LONG_SCREW, rails.map((k, j): FitOpts => ({ on: k, at: [0, railYs[j] - RT / 2, zF - 10], dir: [0, 1, 0], mate: middle })), 0.15),
  );
  step(b, { title: "Turn the cam locks in the rails", detail: "Three at each end, clockwise, pushing the rails tight against the frames.", tools: ["flathead"], ...up, kind: "cams" });
  step(b, { title: "Turn the cam locks in the right frame", detail: "Now the rails are in, lock the three that hold it to the top.", tools: ["flathead"], ...up, kind: "cams" });
  step(b, { title: "Screw the middle leg onto the bottom panel", detail: "In the middle of the panel, two long screws through it into the leg.", tools: ["allen"], scene: "bottom", kind: "screws" }, () => {
    lay(b, [bottom, leg], [0, 0, zc], [0, 0, 0], [0, 0, 0]);
    b.then(0.15);
    b.fits(LONG_SCREW, [-12, 12].map((dz): FitOpts => ({ on: bottom, at: [0, FREE + BT, zc + dz], dir: [0, -1, 0], mate: leg })), 0.15);
  });
  const bScrews: FitOpts[] = [
    ...[0, 1].flatMap((i) => [-120, 100].map((z): FitOpts => ({ on: bottom, at: [sg(i) * lx, FREE, zc + z], dir: [0, 1, 0], mate: sides[i] }))),
    ...[-150, 120].map((z): FitOpts => ({ on: bottom, at: [0, FREE, zc + z], dir: [0, 1, 0], mate: middle })),
  ];
  step(b, { title: "Screw the bottom panel onto the frames", detail: "Leg pointing up. Six long screws: two into each side frame and two into the middle frame.", tools: ["allen"], ...up, kind: "screws" }, () => {
    b.add(bottom, [0, -300, 0]);
    b.add(leg, [0, -300, 0]);
    b.then(0.1);
    b.fits(LONG_SCREW, bScrews, 0.1);
  });
  const rivets: FitOpts[] = [
    ...[0, 1].flatMap((i) => [0.15, 0.4, 0.65, 0.9].map((f): FitOpts => ({ on: backs[f < 0.5 ? 0 : 1], at: [sg(i) * (xi - 12), FREE + f * (legH - FREE), zB - 7], dir: [0, 0, 1], mate: sides[i] }))),
    ...[0.12, 0.3, 0.42, 0.58, 0.7, 0.88].map((f): FitOpts => ({ on: backs[f < 0.5 ? 0 : 1], at: [0, FREE + f * (legH - FREE), zB - 7], dir: [0, 0, 1], mate: middle })),
    ...[-600, -200, 200, 600].map((x): FitOpts => ({ on: backs[0], at: [x, FREE + 12, zB - 7], dir: [0, 0, 1] })),
  ];
  step(b, { title: "Slide the back boards in and rivet them", detail: "Down the grooves from the leg end, one board after the other. Then eighteen plastic rivets: push in each sleeve, then press its pin in.", ...up, kind: "join" }, () => {
    b.stagger(0.3);
    for (const k of [...backs].reverse()) b.add(k, [0, -500, 0]);
    b.then(0.1);
    b.fits(RIVET, rivets, 0.05);
  });
  step(b, { title: "Screw the feet into the legs", detail: "One in each corner leg and one in the middle leg, by hand.", ...up, kind: "legs" }, () =>
    b.fits(FOOT, [...[0, 1].flatMap((i) => [zF, zB].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * lx, 0, z], dir: [0, 1, 0], hole: false }))), { on: leg, at: [0, 0, zc], dir: [0, 1, 0], hole: false }], 0.12),
  );
  step(b, { title: "Turn it over and level the feet", detail: "Two of you lift it upright; don't drag it on its legs. Turn the five feet until it stands level and doesn't rock.", tools: ["level"], people: 2, kind: "standup" });

  /* ---------- the wall ---------- */
  const wz = -D / 2 - 15, wy = legH - 20;
  step(b, { title: "Fold out the wall brackets and mark the wall", detail: "Four brackets under the back of the top. Fold them out, push the chest against the wall and mark through each slot.", tools: ["pencil"], kind: "anchor", warnings: ["wall", "tip"] });
  step(b, { title: "Drill and plug the wall", detail: "Move the chest away, drill at the four marks and tap in the plugs. They suit most walls; for solid wood use the screws alone.", tools: ["drill", "hammer"], kind: "anchor", wall: true }, () =>
    b.fits(WALL_PLUG, wallXs.map((x): FitOpts => ({ at: [x, wy, wz], dir: [0, 0, -1] })), 0.15),
  );
  step(b, { title: "Clip spacer blocks onto the brackets", detail: "Snap on as many as it takes to fill the gap between each bracket and the wall.", kind: "anchor", wall: true }, () =>
    b.fits(SPACER, wallXs.map((x): FitOpts => ({ on: top, at: [x, wy, -D / 2], dir: [0, 0, -1], hole: false })), 0.15),
  );
  step(b, { title: "Screw the brackets to the wall", detail: "Push the chest back, a screw through each bracket into its plug, then press the bracket's latch shut.", tools: ["screwdriver"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () =>
    b.fits(WALL_SCREW8, wallXs.map((x): FitOpts => ({ at: [x, wy, wz + 10], dir: [0, 0, -1] })), 0.15),
  );

  drawerSteps(b, ds, zFace, 2);
  return true;
}

/** The nightstand: built lying on its left side, then a top, a wall strap, a door on two hinges and one drawer. */
function nightstand(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const TT = 25, BT = 20, NFREE = 230;
  const legH = H - TT;
  const CW = W - 30, CD = D - 30, zc = -10;
  const lx = CW / 2 - L / 2;
  const zF = zc + CD / 2 - L / 2, zB = zc - CD / 2 + L / 2;
  const xi = CW / 2 - L, IW = 2 * xi;
  const zFace = zF + L / 2 - 5;
  const RH = 30; // the rail between the drawer and the door
  const shelfTop = legH - 142;
  const railY = shelfTop - RH / 2;

  const sideT = sideFrame(b, legH, CD, zc, NFREE, [shelfTop + 20]);
  const sides = [-1, 1].map((g) => b.place(sideT, [g * lx, legH / 2, zc]));
  const rail = b.place(b.part("Front rail", [IW, RH, RH], { material: "wood" }), [0, railY, zFace - RH / 2]);
  const backZ0 = zB + 7;
  const back = b.place(b.part("Back panel", [IW, legH - NFREE, 14], { material: "wood" }), [0, (NFREE + legH) / 2, zB]);
  const shelfD = zFace - RH - backZ0;
  const shelf = b.place(b.part("Shelf", [IW, BT, shelfD], { material: "wood" }), [0, shelfTop - BT / 2, backZ0 + shelfD / 2]);
  const botD = zFace - backZ0;
  const bottom = b.place(b.part("Bottom panel", [IW, BT, botD], { material: "wood" }), [0, NFREE + BT / 2, backZ0 + botD / 2]);
  const top = b.place(b.part("Top", [W, TT, D], { material: "wood" }), [0, H - TT / 2, 0]);
  const doorY0 = NFREE + BT + 3, doorY1 = shelfTop - RH - 3;
  const door = b.place(b.part("Door", [IW - 6, doorY1 - doorY0, 20], { material: "wood" }), [0, (doorY0 + doorY1) / 2, zFace - 10]);
  const ds = makeDrawers(b, [{ x: 0, y0: shelfTop, h: legH - shelfTop, w: IW }], zFace, 400);
  const d = ds[0];

  /* ---------- side frames, inside face up on the rug ---------- */
  const scene = "frames";
  step(b, { title: "Screw the runners onto the side frames", detail: "Lay both side frames on a rug, inside face up: the L runner on the left frame, the R one on the right, two of the short screws each.", tools: ["screwdriver"], scene, kind: "runners", warnings: ["floor"] }, () => {
    lay(b, [sides[0]], [-lx, legH / 2, zc], [-(legH / 2 + 150), L / 2, 0], [0, 0, Math.PI / 2]);
    lay(b, [sides[1]], [lx, legH / 2, zc], [legH / 2 + 150, L / 2, 0], [0, 0, -Math.PI / 2]);
    b.then(0.15);
    const at = (i: number, z: number): FitOpts => ({ on: sides[i], at: [sg(i) * xi, d.y0 + 20, z], dir: [sg(i), 0, 0] });
    b.fits({ kind: "runner", len: 400, dia: 20, name: "Drawer runner" }, [0, 1].map((i) => ({ ...at(i, (d.dz0 + d.dz1) / 2), hole: false as const })), 0.15);
    b.then(0.1);
    b.fits(RUN_SCREW, [0, 1].flatMap((i) => [d.dz0 + 40, d.dz1 - 40].map((z) => at(i, z))), 0.05);
  });
  // each frame takes a cam bolt for the rail and the back and two for the bottom
  const bolts = (i: number): FitOpts[] => [
    { on: sides[i], at: [sg(i) * xi, railY, zFace - RH / 2], dir: [sg(i), 0, 0] },
    { on: sides[i], at: [sg(i) * xi, 480, zB], dir: [sg(i), 0, 0] },
    ...[-100, 140].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, NFREE + BT / 2, z], dir: [sg(i), 0, 0] })),
  ];
  step(b, { title: "Push the cam bolts into the frames", detail: "Four in each frame's inside face, by hand, not screwed.", scene, kind: "cams" }, () => b.fits(CAM_BOLT, [0, 1].flatMap(bolts), 0.06));
  const dowelsIn = (k: string, y: number, zs: number[]): FitOpts[] => [0, 1].flatMap((i) => zs.map((z): FitOpts => ({ on: k, at: [sg(i) * xi, y, z], dir: [-sg(i), 0, 0], mate: sides[i] })));
  const cam = (k: string, i: number, at: Vec3, dir: Vec3): FitOpts => ({ on: k, at: [sg(i) * at[0], at[1], at[2]], dir });
  const camsAt = (i: number): FitOpts[] => [
    cam(rail, i, [xi - 30, railY - RH / 2, zFace - RH / 2], [0, 1, 0]),
    cam(back, i, [xi - 30, 480, zB + 7], [0, 0, -1]),
    ...[-100, 140].map((z) => cam(bottom, i, [xi - 30, NFREE + BT, z], [0, -1, 0])),
  ];
  const side = { pose: "+x" as const };
  const pscene = "panels";
  const aside = (k: string, at: Vec3) => lay(b, [k], b.partItem(k).final.pos, at, [0, 0, 0]);

  /* ---------- on its left side ---------- */
  step(b, { title: "Tap the dowels into the front rail", detail: "One in each end.", tools: ["hammer"], scene: pscene, kind: "dowels" }, () => {
    aside(rail, [0, RH / 2, 0]);
    b.then(0.15);
    b.fits(DOWEL, dowelsIn(rail, railY, [zFace - RH / 2 - 8]), 0.1);
  });
  step(b, { title: "Stand the rail in the left side frame and lock it", detail: "Lay the frame inside face up, push the rail onto its dowel and cam bolt and turn the cam lock clockwise.", tools: ["flathead"], ...side, kind: "cams", warnings: ["floor"] }, () => {
    b.add(sides[0], [-300, 0, 0]);
    b.then(0.15);
    b.add(rail, [300, 0, 0]);
    b.then(0.1);
    b.fit(CAM, camsAt(0)[0]);
  });
  step(b, { title: "Tap the dowels into the back panel", detail: "Two in each side edge.", tools: ["hammer"], scene: pscene, kind: "dowels" }, () => {
    lay(b, [back], b.partItem(back).final.pos, [0, 7, 0], [Math.PI / 2, 0, 0]);
    b.then(0.15);
    b.fits(DOWEL, dowelsIn(back, 330, [zB]).concat(dowelsIn(back, 640, [zB])), 0.08);
  });
  step(b, { title: "Stand the back panel in and lock it", detail: "At the back of the frame, smooth side out. Turn its cam lock clockwise.", tools: ["flathead"], ...side, kind: "cams" }, () => {
    b.add(back, [300, 0, 0]);
    b.then(0.1);
    b.fit(CAM, camsAt(0)[1]);
  });
  step(b, { title: "Tap the dowels into the shelf", detail: "Two in each end.", tools: ["hammer"], scene: pscene, kind: "dowels" }, () => {
    aside(shelf, [0, BT / 2, 0]);
    b.then(0.15);
    b.fits(DOWEL, dowelsIn(shelf, shelfTop - BT / 2, [-130, 110]), 0.08);
  });
  step(b, { title: "Push the shelf into the frame", detail: "Behind the rail, onto its dowels. It is held once the other frame goes on.", ...side, kind: "dowels" }, () => b.add(shelf, [300, 0, 0]));
  step(b, { title: "Tap the dowels into the bottom panel", detail: "Two in each end.", tools: ["hammer"], scene: pscene, kind: "dowels" }, () => {
    aside(bottom, [0, BT / 2, 0]);
    b.then(0.15);
    b.fits(DOWEL, dowelsIn(bottom, NFREE + BT / 2, [-170, 60]), 0.08);
  });
  step(b, { title: "Stand the bottom panel in and lock it", detail: "Rounded edge to the front. Turn its two cam locks clockwise.", tools: ["flathead"], ...side, kind: "cams" }, () => {
    b.add(bottom, [300, 0, 0]);
    b.then(0.1);
    b.fits(CAM, camsAt(0).slice(2), 0.1);
  });
  step(b, { title: "Lower the right side frame on and lock it", detail: "Inside face down, its dowels and cam bolts into the holes. Four cam locks in the other ends, turned clockwise.", tools: ["flathead"], ...side, kind: "cams" }, () => {
    b.add(sides[1], [300, 0, 0]);
    b.then(0.1);
    b.fits(CAM, camsAt(1), 0.1);
  });
  step(b, { title: "Screw in the feet and stand it up", detail: "One into the bottom of each leg by hand, then turn it upright.", ...side, kind: "legs" }, () =>
    b.fits(FOOT, [0, 1].flatMap((i) => [zF, zB].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * lx, 0, z], dir: [0, 1, 0], hole: false }))), 0.12),
  );

  /* ---------- standing up ---------- */
  const tops = [-120, 100], tbolts = [-50, 150];
  step(b, { title: "Tap the dowels into the frame tops", detail: "Two along the top of each side frame.", tools: ["hammer"], kind: "dowels" }, () =>
    b.fits(DOWEL, [0, 1].flatMap((i) => tops.map((z): FitOpts => ({ on: sides[i], at: [sg(i) * lx, legH, z], dir: [0, -1, 0], mate: top }))), 0.08),
  );
  step(b, { title: "Push cam locks into the frame tops", detail: "Two in each, arrows pointing at the top edge. Don't turn them yet.", kind: "cams" }, () =>
    b.fits(CAM, [0, 1].flatMap((i) => tbolts.map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, legH - 30, z], dir: [sg(i), 0, 0] }))), 0.08),
  );
  step(b, { title: "Push the cam bolts into the top", detail: "Lay the top face down on the rug: four cam bolts, by hand.", scene: "top", kind: "cams" }, () => {
    b.stage(top, [0, TT / 2, 0], [Math.PI, 0, 0], [0, 160, 0]);
    b.then(0.15);
    b.fits(CAM_BOLT, [0, 1].flatMap((i) => tbolts.map((z): FitOpts => ({ on: top, at: [sg(i) * lx, legH, z], dir: [0, 1, 0] }))), 0.08);
  });
  step(b, { title: "Lay the top on and lock it", detail: "Bolts down into the frame tops. Turn the four cam locks clockwise from inside.", tools: ["flathead"], kind: "cams" }, () => b.add(top, [0, 300, 0]));
  step(b, { title: "Level the feet", detail: "Stand it where it will go and turn each foot until the top is level.", tools: ["level"], kind: "legs" });

  /* ---------- the wall strap ---------- */
  const wz = -D / 2 - 15, sy = legH - 45;
  step(b, { title: "Mark the wall", detail: "Push it against the wall and draw along the top edge. Move it away and mark a point 4.5 cm below the line, behind the middle.", tools: ["pencil", "tape"], kind: "anchor", warnings: ["wall", "tip"] });
  step(b, { title: "Screw the strap to the wall", detail: "Drill, tap in the plug, then screw the strap on with a washer. For solid wood use the screw without the plug.", tools: ["drill", "hammer", "screwdriver"], kind: "anchor", wall: true }, () => {
    b.fit(WALL_PLUG, { at: [0, sy, wz], dir: [0, 0, -1] });
    b.then(0.05);
    b.fit(STRAP, { at: [0, sy, wz + 5], dir: [0, 0, -1], hole: false });
    b.fit(WASHER, { at: [0, sy, wz + 8], dir: [0, 0, -1], hole: false });
    b.fit(WALL_SCREW8, { at: [0, sy, wz + 10], dir: [0, 0, -1] });
  });
  step(b, { title: "Fix the strap inside the back", detail: "Push the nightstand back, feed the strap through the slot in the back and screw it on from inside with the other washer.", tools: ["screwdriver"], kind: "anchor", wall: true, warnings: ["wall", "tip"] }, () => {
    b.fit(WASHER, { on: back, at: [0, sy - 15, zB + 7], dir: [0, 0, -1], hole: false });
    b.fit(STRAP_SCREW, { on: back, at: [0, sy - 15, zB + 8], dir: [0, 0, -1] });
  });

  /* ---------- the door, hinged on the right ---------- */
  const hy = [doorY0 + 50, doorY1 - 50];
  step(b, { title: "Screw the catch under the rail", detail: "On the side away from the hinges, one screw.", tools: ["screwdriver"], kind: "screws" }, () => {
    b.fit(CATCH, { on: rail, at: [-xi + 30, railY - RH / 2, zFace - 15], dir: [0, 1, 0], hole: false });
    b.fit(STRAP_SCREW, { on: rail, at: [-xi + 30, railY - RH / 2, zFace - 22], dir: [0, 1, 0] });
  });
  step(b, { title: "Press the bumper into the catch", detail: "It stops the door at the front edge.", kind: "general" }, () => b.fit(BUMPER, { on: rail, at: [-xi + 30, railY - RH / 2 - 8, zFace - 8], dir: [0, 0, -1], hole: false }));
  step(b, { title: "Screw the mounting plates onto the right frame", detail: "Inside the front leg, two screws each.", tools: ["screwdriver"], kind: "hinges" }, () => {
    b.fits(PLATE, hy.map((y): FitOpts => ({ on: sides[1], at: [xi, y, zF - 16], dir: [1, 0, 0], hole: false })), 0.15);
    b.then(0.1);
    b.fits(HINGE_SCREW, hy.flatMap((y) => [-16, 16].map((dy): FitOpts => ({ on: sides[1], at: [xi, y + dy, zF - 16], dir: [1, 0, 0] }))), 0.06);
  });
  step(b, { title: "Screw the hinges onto the door", detail: "Lay the door face down: each hinge cup in its hole, two screws each.", tools: ["screwdriver"], scene: "door", kind: "hinges" }, () => {
    lay(b, [door], b.partItem(door).final.pos, [0, 10, 0], [Math.PI / 2, 0, 0]);
    b.then(0.15);
    b.fits(HINGE, hy.map((y): FitOpts => ({ on: door, at: [xi - 25, y, zFace - 20], dir: [0, 0, 1], twist: Math.PI })), 0.15);
    b.then(0.1);
    b.fits(HINGE_SCREW, hy.flatMap((y) => [-18, 18].map((dy): FitOpts => ({ on: door, at: [xi - 45, y + dy, zFace - 20], dir: [0, 0, 1] }))), 0.06);
  });
  step(b, { title: "Clip the door onto the plates", detail: "Hook each hinge onto its plate and press until it clicks, then tighten the screws. Adjust it with the hinge screws until the gaps are even.", tools: ["screwdriver"], kind: "doors" }, () => b.add(door, [300, 0, 300]));
  step(b, { title: "Screw the knob onto the door", detail: "On the side away from the hinges, the screw from inside.", tools: ["screwdriver"], kind: "screws" }, () => {
    b.fit(KNOB, { on: door, at: [-xi + 45, (doorY0 + doorY1) / 2, zFace], dir: [0, 0, -1], hole: false });
    b.fit(KNOB_SCREW, { on: door, at: [-xi + 45, (doorY0 + doorY1) / 2, zFace - 20], dir: [0, 0, 1] });
  });

  drawerSteps(b, ds, zFace, 1);
  return true;
}

const family: Family = {
  names: ["STOREMOLLA"],
  build(b, s) {
    if (s.archetype !== "drawers") return false;
    if (/^storemolla-8-drawer/.test(s.slug ?? "")) return dresser8(b, s);
    if (/^storemolla-nightstand/.test(s.slug ?? "")) return nightstand(b, s);
    const rows = s.drawers?.rows ?? 0;
    if ((s.drawers?.cols ?? 1) !== 1 || !/drawer dresser|chest of/i.test(s.variant) || (rows !== 3 && rows !== 5)) return false;
    return chest(b, s, rows);
  },
};
export default family;
