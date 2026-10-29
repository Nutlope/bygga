import type { Family } from "./family";
import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rotate } from "../math";

/*
 * TARVA (solid pine), read from IKEA's manuals.
 *
 * Bed frames (single and double manuals): wooden pins go into the four legs, the headboard and the footboard are
 * built flat on the floor (dowels into the slats and boards, the legs pushed on and bolted with long bolts into
 * barrel nuts), then glides go under the legs. Two people stand the footboard up, push the side rails onto its pins
 * and bolt them, then the headboard. Steel slat rails screw inside the side rails, a telescopic beam hooks across
 * them (the double has a centre beam on two brackets and two cross beams instead) and slat holders go on the ends.
 * The double's headboard has a centre stile, joined to the top rail with a cam lock and to the bottom board with a
 * bolt, before the slats go on either side of it.
 */

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, c: number, n: number) => range(n).map((i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));
const sg = (i: number) => (i === 0 ? -1 : 1);
const SIDES = [0, 1];

/** Shows a part lying flat in a scene: turned by `rot` about `pivot`, then moved by `off`. */
function lay(b: PlanBuilder, key: string, rot: Vec3, pivot: Vec3, off: Vec3, from?: Vec3) {
  const it = b.partItem(key);
  const p = rotate([it.final.pos[0] - pivot[0], it.final.pos[1] - pivot[1], it.final.pos[2] - pivot[2]], rot);
  b.stage(key, [p[0] + off[0], p[1] + off[1], p[2] + off[2]], rot, from);
}

/* ---------------- bed frames ---------------- */

const PIN: HwDef = { kind: "dowel", len: 40, dia: 10, name: "Wooden pin" };
const BED_BOLT: HwDef = { kind: "bolt", len: 100, dia: 6 };
const BARREL: HwDef = { kind: "nut", len: 14, dia: 10, name: "Barrel nut" };
const BED_GLIDE: HwDef = { kind: "glide", len: 4, dia: 24, name: "Glide" };
const RAIL_SCREW: HwDef = { kind: "screw", len: 15, dia: 6 };
const BEAM_SCREW: HwDef = { kind: "screw", len: 10, dia: 5 };
const HOLDER: HwDef = { kind: "clip", len: 20, dia: 30, name: "Slat holder" };
const HOLDER_SCREW: HwDef = { kind: "screw", len: 12, dia: 6 };
const STILE_CAM_BOLT: HwDef = { kind: "camScrew", len: 44, dia: 7 };
const STILE_BOLT: HwDef = { kind: "bolt", len: 35, dia: 6 };
const SLEEVE_NUT: HwDef = { kind: "nut", len: 14, dia: 10, name: "Sleeve nut" };
const BEAM_BRACKET: HwDef = { kind: "angle", len: 60, dia: 50, name: "Beam bracket" };
const SLEEVE: HwDef = { kind: "connector", len: 110, dia: 60, name: "Beam sleeve" };

function buildBed(b: PlanBuilder, s: ProductSpec, dbl: boolean) {
  const W = s.size.w * 10, L = s.size.d * 10;
  const H = (s.bed?.headH ?? s.size.h) * 10, FH = (s.bed?.footH ?? 40) * 10;
  const P = 56, BT = 22; // legs (square), boards
  const y0 = 200, y1 = 360, yc = (y0 + y1) / 2, RH = y1 - y0; // side rails, head and foot boards
  const xp = W / 2 - P / 2, zh = -L / 2 + P / 2, zf = L / 2 - P / 2;
  const inW = W - 2 * P;
  const TR = 56, TD = 40; // headboard top rail
  const SH = 70; // headboard slats
  const zS = zh + BT / 2, zB = zh - BT / 2; // slats in front, the bottom board behind them

  const hpT = b.part("Head leg", [P, H, P], { material: "wood" });
  const fpT = b.part("Foot leg", [P, FH, P], { material: "wood" });
  const hp = SIDES.map((i) => b.place(hpT, [sg(i) * xp, H / 2, zh]));
  const fp = SIDES.map((i) => b.place(fpT, [sg(i) * xp, FH / 2, zf]));
  const top = b.place(b.part("Top rail", [inW, TR, TD], { material: "wood" }), [0, H - TR / 2, zh]);
  const hb = b.place(b.part("Headboard bottom board", [inW, RH, BT], { material: "wood" }), [0, yc, zB]);
  const gap = (H - TR - y1 - 4 * SH) / 5;
  const slatY = range(4).map((i) => y1 + gap * (i + 1) + SH * i + SH / 2);
  const stileY0 = y1 - 100, stileY1 = H - TR;
  const stile = dbl ? b.place(b.part("Centre stile", [P, stileY1 - stileY0, BT], { material: "wood" }), [0, (stileY0 + stileY1) / 2, zS]) : "";
  const halfW = (inW - P) / 2;
  const slatT = b.part("Headboard slat", [dbl ? halfW : inW, SH, BT], { material: "wood" });
  // the double's slats run from a leg to the stile, on both sides
  const slats = dbl ? SIDES.flatMap((i) => slatY.map((y) => b.place(slatT, [sg(i) * (P / 2 + halfW / 2), y, zS]))) : slatY.map((y) => b.place(slatT, [0, y, zS]));
  const fb = b.place(b.part("Footboard", [inW, RH, BT], { material: "wood" }), [0, yc, zf]);
  const rails = SIDES.map((i) => b.place(b.part("Side rail", [BT, RH, L - 2 * P], { material: "wood" }), [sg(i) * xp, yc, 0]));

  const SR = 25, ySR = 300 - SR / 2; // steel slat rails, top at 300
  const xs = xp - BT / 2 - SR / 2;
  const srL = L - 2 * P - 20;
  const srT = b.part("Slat rail", [SR, SR, srL], { material: "metal" });
  const sr = SIDES.map((i) => b.place(srT, [sg(i) * xs, ySR, 0]));
  const xin = xs - SR / 2; // inside of the slat rails
  // single: one telescopic beam across the middle; double: a centre beam head to foot and two cross beams
  const zA = zh, zZ = zf - BT / 2; // inside faces of the headboard bottom board and the footboard
  const beamL = zZ - zA, zc = (zA + zZ) / 2;
  const cbT = dbl ? b.part("Centre beam half", [50, 40, beamL / 2], { material: "metal" }) : "";
  const cb = dbl ? [-1, 1].map((g) => b.place(cbT, [0, 280, zc + (g * beamL) / 4])) : [];
  const crossT = b.part("Cross beam", [dbl ? xin - 25 : 2 * xin, 30, 40], { material: "metal" });
  const cross = dbl ? [-1, 1].map((g) => b.place(crossT, [(g * (xin + 25)) / 2, 285, 0])) : [b.place(crossT, [0, 285, 0])];
  const yTop = 300;
  const slatL = L - 2 * P - 40, slatW = 2 * xin - 10;
  const nSl = 17;
  const slatPieces: PartPiece[] = range(nSl).map((i) => ({ shape: "box", size: [slatW, 8, 60], pos: [0, 0, -slatL / 2 + 30 + (i * (slatL - 60)) / (nSl - 1)], material: "wood" }));
  const { type: baseT, mid: baseMid } = b.compound("Slatted bed base", slatPieces, { material: "wood", extra: true });
  const base = b.place(baseT, [baseMid[0], yTop + 4 + baseMid[1], baseMid[2]]);

  // the ends are built lying on the floor, inside faces up; the headboard behind, the footboard in front
  const UP_H: Vec3 = [-Math.PI / 2, 0, 0], UP_F: Vec3 = [Math.PI / 2, 0, 0];
  const headPivot: Vec3 = [0, 0, zh], footPivot: Vec3 = [0, 0, zf];
  const headOff: Vec3 = [0, P / 2, -150], footOff: Vec3 = [0, P / 2, 250];
  const layHead = (k: string, from?: Vec3) => lay(b, k, UP_H, headPivot, headOff, from);
  const layFoot = (k: string, from?: Vec3) => lay(b, k, UP_F, footPivot, footOff, from);
  const out = (i: number): Vec3 => [sg(i) * 260, 0, 0];

  // pins in the legs, two where each side rail meets them
  const pinY = [y0 + 15, y1 - 15];
  const boltY = [y0 + 40, y1 - 40];
  const pins: FitOpts[] = [];
  for (const i of SIDES) for (const y of pinY) {
    pins.push({ on: hp[i], at: [sg(i) * xp, y, zh + P / 2], dir: [0, 0, -1], mate: rails[i] });
    pins.push({ on: fp[i], at: [sg(i) * xp, y, zf - P / 2], dir: [0, 0, 1], mate: rails[i] });
  }
  b.step(
    {
      title: "Tap the wooden pins into the legs",
      detail: "Two in each leg, in the holes facing the bed. Leave 20 mm of each pin sticking out.",
      tools: ["hammer"],
      scene: "ends",
      kind: "dowels",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.15);
      for (const i of SIDES) layHead(hp[i], [0, 160, 0]);
      for (const i of SIDES) layFoot(fp[i], [0, 160, 0]);
      b.then(0.15);
      b.fits(PIN, pins, 0.07);
    },
  );

  const hx = inW / 2;
  const endDowels = (k: string, ys: number[], z: number, mate: (i: number) => string): FitOpts[] =>
    SIDES.flatMap((i) => ys.map((y): FitOpts => ({ on: k, at: [sg(i) * hx, y, z], dir: [-sg(i), 0, 0], mate: mate(i) })));
  const slatDowels = (k: string, y: number, x: number, g: number, mate: string): FitOpts[] => [-18, 18].map((dy) => ({ on: k, at: [x, y + dy, zS], dir: [-g, 0, 0], mate }));

  if (dbl) {
    b.step(
      {
        title: "Screw a cam bolt into the top rail",
        detail: "Into the hole in the middle of its long edge, by hand until it stops.",
        tools: ["screwdriver"],
        scene: "ends",
        kind: "cams",
      },
      () => {
        layHead(top, [0, 160, 0]);
        b.then(0.15);
        b.fit(STILE_CAM_BOLT, { on: top, at: [-12, H - TR, zh], dir: [0, 1, 0], mate: stile, mateHole: 4 });
      },
    );
    b.step(
      { title: "Tap a dowel in next to it", detail: "In the other hole, beside the cam bolt.", tools: ["hammer"], scene: "ends", kind: "dowels" },
      () => b.fit(HW.dowel, { on: top, at: [12, H - TR, zh], dir: [0, 1, 0], mate: stile }),
    );
    b.step(
      {
        title: "Lock the centre stile onto the top rail",
        detail: "Push it onto the cam bolt and dowel, then turn the cam lock in the stile clockwise.",
        tools: ["screwdriver"],
        scene: "ends",
        kind: "cams",
      },
      () => {
        layHead(stile, [0, 0, 300]);
        b.then(0.15);
        b.fit(HW.cam, { on: stile, at: [-12, H - TR - 32, zS + BT / 2], dir: [0, 0, -1] });
      },
    );
    b.step(
      {
        title: "Bolt the bottom board to the stile",
        detail: "The holes in its ends point at the legs. The bolt goes through the stile and the sleeve nut in from the back; tighten them with both Allen keys.",
        tools: ["allen"],
        scene: "ends",
        kind: "bolts",
      },
      () => {
        layHead(hb, [0, 0, 300]);
        b.then(0.15);
        b.fit(STILE_BOLT, { on: stile, at: [0, y1 - 50, zS + BT / 2], dir: [0, 0, -1], mate: hb });
        b.then(0.1);
        b.fit(SLEEVE_NUT, { on: hb, at: [0, y1 - 50, zB - BT / 2], dir: [0, 0, 1], hole: false });
      },
    );
    const inner = SIDES.flatMap((i) => slatY.flatMap((y, j) => slatDowels(slats[i * 4 + j], y, sg(i) * (P / 2), sg(i), stile)));
    b.step(
      {
        title: "Tap dowels into the slats and push them onto the stile",
        detail: "Two dowels in one end of each slat. Four slats go on each side of the stile.",
        tools: ["hammer"],
        scene: "ends",
        kind: "dowels",
      },
      () => {
        b.stagger(0.12);
        for (const [n, k] of slats.entries()) layHead(k, [sg(n < 4 ? 0 : 1) * 300, 0, 0]);
        b.then(0.15);
        b.fits(HW.dowel, inner.map((o) => ({ ...o, dir: [-o.dir[0], 0, 0] as Vec3 })), 0.05);
      },
    );
  }

  // the head legs: dowels into every board's ends, then the legs pushed on
  const headDowels = [
    ...(dbl
      ? SIDES.flatMap((i) => slatY.flatMap((y, j) => slatDowels(slats[i * 4 + j], y, sg(i) * hx, sg(i), hp[i])))
      : slats.flatMap((k, j) => SIDES.flatMap((i) => slatDowels(k, slatY[j], sg(i) * hx, sg(i), hp[i])))),
    ...endDowels(top, [H - TR / 2], zh, (i) => hp[i]),
    ...endDowels(hb, [yc - 45, yc + 45], zB, (i) => hp[i]),
  ];
  b.step(
    {
      title: dbl ? "Tap dowels into the outer ends and push the head legs on" : "Tap dowels into the headboard and push the head legs on",
      detail: dbl
        ? "Two in each slat end and the bottom board, one in each end of the top rail. Then press a leg onto each end."
        : "Two in each end of the slats and the bottom board, one in each end of the top rail. Lay them between the legs, holes facing out, and press the legs on.",
      tools: ["hammer"],
      scene: "ends",
      kind: "dowels",
    },
    () => {
      if (!dbl) {
        b.stagger(0.12);
        for (const k of [top, ...slats, hb]) layHead(k, [0, 160, 0]);
        b.then(0.15);
      }
      b.fits(HW.dowel, headDowels, 0.04);
      b.then(0.15);
      b.stagger(0.25);
      for (const i of SIDES) layHead(hp[i], out(i));
    },
  );

  // long bolts through the outside of the legs into barrel nuts in the boards
  const nutsIn = (k: string, y: number, z: number, d: number): FitOpts[] => SIDES.map((i) => ({ on: k, at: [sg(i) * (hx - 35), y, z], dir: [0, 0, d], hole: 5 }));
  const boltsThrough = (legs: string[], k: string, y: number, z: number): FitOpts[] => SIDES.map((i) => ({ on: legs[i], at: [sg(i) * W / 2, y, z], dir: [-sg(i), 0, 0], mate: k }));
  b.step(
    {
      title: "Bolt the legs to the top rail and the bottom board",
      detail: "Drop the barrel nuts in first and turn their slots to line up with the bolt holes. Then turn the bolts in with the Allen key.",
      tools: ["allen", "flathead"],
      scene: "ends",
      kind: "bolts",
    },
    () => {
      b.fits(BARREL, [...nutsIn(top, H - TR / 2, zh + TD / 2, -1), ...nutsIn(hb, yc, zB + BT / 2, -1)], 0.1);
      b.then(0.1);
      b.fits(BED_BOLT, [...boltsThrough(hp, top, H - TR / 2, zh), ...boltsThrough(hp, hb, yc, zB)], 0.12);
    },
  );
  b.step(
    {
      title: "Tap dowels into the footboard and push the foot legs on",
      detail: "Two in each end. The pins in the legs face the same way as the barrel nut holes.",
      tools: ["hammer"],
      scene: "ends",
      kind: "dowels",
    },
    () => {
      layFoot(fb, [0, 160, 0]);
      b.then(0.15);
      b.fits(HW.dowel, endDowels(fb, [yc - 45, yc + 45], zf, (i) => fp[i]), 0.08);
      b.then(0.15);
      b.stagger(0.25);
      for (const i of SIDES) layFoot(fp[i], out(i));
    },
  );
  b.step(
    {
      title: "Bolt the foot legs to the footboard",
      detail: "A barrel nut in each end, slot lined up, then a long bolt through each leg.",
      tools: ["allen", "flathead"],
      scene: "ends",
      kind: "bolts",
    },
    () => {
      b.fits(BARREL, nutsIn(fb, yc, zf - BT / 2, 1), 0.12);
      b.then(0.1);
      b.fits(BED_BOLT, boltsThrough(fp, fb, yc, zf), 0.15);
    },
  );
  b.step(
    {
      title: "Tap a glide under each leg",
      detail: "Into the hole in the end of each leg, gently, with the hammer.",
      tools: ["hammer"],
      scene: "ends",
      kind: "general",
    },
    () => b.fits(BED_GLIDE, [...hp, ...fp].map((k, n) => ({ on: k, at: [sg(n % 2) * xp, 0, n < 2 ? zh : zf], dir: [0, 1, 0], hole: false })), 0.12),
  );
  if (dbl)
    b.step(
      {
        title: "Screw a beam bracket to each end",
        detail: "In the middle of the inside of the headboard bottom board and the footboard, open side up.",
        tools: ["screwdriver"],
        scene: "ends",
        kind: "screws",
      },
      () => {
        const at: [string, number, number][] = [[hb, zB + BT / 2, 1], [fb, zf - BT / 2, -1]];
        b.fits(BEAM_BRACKET, at.map(([k, z, d]) => ({ on: k, at: [0, 270, z], dir: [0, 0, -d], hole: false })), 0.2);
        b.then(0.1);
        b.fits(RAIL_SCREW, at.flatMap(([k, z, d]) => [-30, 30].map((x): FitOpts => ({ on: k, at: [x, 240, z], dir: [0, 0, -d] }))), 0.1);
      },
    );

  // standing up: the footboard first, the rails onto its pins, then the headboard
  const railBolts = (legs: string[], z: number, d: number): FitOpts[] => SIDES.flatMap((i) => boltY.map((y): FitOpts => ({ on: legs[i], at: [sg(i) * xp, y, z], dir: [0, 0, d], mate: rails[i] })));
  const railNuts = (z: number): FitOpts[] => SIDES.flatMap((i) => boltY.map((y): FitOpts => ({ on: rails[i], at: [sg(i) * (xp - BT / 2), y, z], dir: [sg(i), 0, 0], hole: 5 })));
  const foot = [fb, ...fp];
  const head = [top, hb, ...slats, ...(dbl ? [stile] : []), ...hp];
  b.step(
    {
      title: "Stand the footboard up and push the side rails onto it",
      detail: "One of you holds the footboard while the other pushes each rail onto the pins. The holes for the slat rails face in.",
      people: 2,
      kind: "join",
      warnings: ["two"],
    },
    () => {
      b.stagger(0);
      for (const k of foot) b.add(k, [0, 0, 420]);
      b.then(0.2);
      b.stagger(0.3);
      for (const i of SIDES) b.add(rails[i], [sg(i) * 160, 0, -260]);
    },
  );
  b.step(
    {
      title: "Bolt the rails to the foot legs",
      detail: "Drop a barrel nut into each rail and line up its slot, then two bolts through each leg.",
      tools: ["allen", "flathead"],
      kind: "bolts",
    },
    () => {
      b.fits(BARREL, railNuts(L / 2 - P - 35), 0.1);
      b.then(0.1);
      b.fits(BED_BOLT, railBolts(fp, L / 2, -1), 0.1);
    },
  );
  b.step(
    {
      title: "Push the headboard onto the side rails",
      detail: "Lift it together and push it straight on so both pins go into each rail.",
      people: 2,
      kind: "join",
      warnings: ["two"],
    },
    () => {
      b.stagger(0);
      for (const k of head) b.add(k, [0, 0, -420]);
    },
  );
  b.step(
    {
      title: "Bolt the rails to the head legs",
      detail: "Barrel nuts in, slots lined up, then tighten all the bolts in the frame.",
      tools: ["allen", "flathead"],
      kind: "bolts",
    },
    () => {
      b.fits(BARREL, railNuts(-L / 2 + P + 35), 0.1);
      b.then(0.1);
      b.fits(BED_BOLT, railBolts(hp, -L / 2, 1), 0.1);
    },
  );
  b.step(
    {
      title: "Screw the slat rails inside the side rails",
      detail: "Flat side up, eight screws in each. Turn them in by hand.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.stagger(0.3);
      for (const i of SIDES) b.add(sr[i], [-sg(i) * 200, 0, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      for (const i of SIDES) for (const z of spread(-srL / 2 + 60, srL / 2 - 60, 8)) list.push({ on: sr[i], at: [sg(i) * xin, ySR, z], dir: [sg(i), 0, 0], mate: rails[i] });
      b.fits(RAIL_SCREW, list, 0.05);
    },
  );

  if (!dbl) {
    b.step(
      {
        title: "Pull the centre beam out and hook it on",
        detail: "Stretch it until its hooks reach both slat rails, in the middle of the bed. One screw through each hook.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.add(cross[0], [0, 220, 0]);
        b.then(0.15);
        b.fits(BEAM_SCREW, SIDES.map((i) => ({ on: cross[0], at: [sg(i) * (xin - 12), yTop, 0], dir: [0, -1, 0], mate: sr[i] })), 0.15);
      },
    );
    b.step(
      {
        title: "Lock the length of the beam",
        detail: "One screw where the two halves overlap.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => b.fit(BEAM_SCREW, { on: cross[0], at: [40, yTop, 0], dir: [0, -1, 0] }),
    );
  } else {
    b.step(
      {
        title: "Join the two halves of the centre beam",
        detail: "Slide the sleeve onto one half, then push the other half into it.",
        scene: "beam",
        kind: "join",
      },
      () => {
        b.stage(cb[0], [0, 20, -beamL / 4], [0, 0, 0], [0, 120, 0]);
        b.then(0.1);
        b.fit(SLEEVE, { on: cb[0], at: [0, 300, zc], dir: [0, 0, -1], hole: false, travel: 120 });
        b.then(0.15);
        b.stage(cb[1], [0, 20, beamL / 4], [0, 0, 0], [0, 0, 400]);
      },
    );
    b.step(
      {
        title: "Lay the centre beam on its brackets",
        detail: "Drop the head end into its bracket first, then lower the foot end into the other one.",
        kind: "join",
      },
      () => {
        b.stagger(0);
        for (const k of cb) b.add(k, [0, 260, 0]);
      },
    );
    b.step(
      {
        title: "Hook a cross beam onto one slat rail",
        detail: "Pull it out to length and screw its hook to the slat rail.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.add(cross[0], [0, 200, 0]);
        b.then(0.15);
        b.fit(BEAM_SCREW, { on: cross[0], at: [-(xin - 12), yTop, 0], dir: [0, -1, 0], mate: sr[0] });
      },
    );
    b.step(
      {
        title: "Push its other end into the sleeve",
        detail: "It slots into the pocket on the side of the sleeve. Keep the centre beam straight.",
        kind: "join",
        check: "square",
      },
      () => {},
    );
    b.step(
      {
        title: "Fit the other cross beam the same way",
        detail: "Into the other pocket of the sleeve, then one screw through its hook into the slat rail.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => {
        b.add(cross[1], [0, 200, 0]);
        b.then(0.15);
        b.fit(BEAM_SCREW, { on: cross[1], at: [xin - 12, yTop, 0], dir: [0, -1, 0], mate: sr[1] });
      },
    );
    b.step(
      {
        title: "Lock the length of both cross beams",
        detail: "One screw where the two halves of each beam overlap.",
        tools: ["screwdriver"],
        kind: "screws",
      },
      () => b.fits(BEAM_SCREW, [0, 1].map((i) => ({ on: cross[i], at: [sg(i) * (xin / 2), yTop, 0], dir: [0, -1, 0] as Vec3 })), 0.2),
    );
  }

  // slat holders at both ends of the slat rails (and of the centre beam)
  const hz = [-srL / 2 + 30, srL / 2 - 30];
  const holders: FitOpts[] = [];
  for (const z of hz) for (const i of SIDES) holders.push({ on: sr[i], at: [sg(i) * xs, yTop, z], dir: [0, -1, 0], hole: false });
  if (dbl) for (const z of hz) for (const g of [-1, 1]) holders.push({ on: cb[z < 0 ? 0 : 1], at: [g * 18, yTop, z], dir: [0, -1, 0], hole: false });
  b.step(
    {
      title: "Screw the slat holders on",
      detail: dbl ? "One at each end of both slat rails and on both sides of the centre beam." : "One at each end of both slat rails.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      b.fits(HOLDER, holders, 0.1);
      b.then(0.1);
      b.fits(HOLDER_SCREW, holders.map((o) => ({ ...o, at: [o.at[0], o.at[1] + 4, o.at[2]] as Vec3, hole: undefined })), 0.08);
    },
  );
  b.step(
    {
      title: "Roll out the slatted base",
      detail: "It comes in its own package. Curved side up, with the end slats tucked under the holders.",
      kind: "slats",
    },
    () => b.add(base, [0, 200, -400]),
  );
  return true;
}

/* ---------------- dressers and the nightstand ---------------- */

/*
 * Dressers (3 and 6 drawers): the cabinet runners screw onto the sides lying on a rug, then cam bolts. One side lies
 * on the floor and the back boards (two, one above the other) stand in it on dowels and cam locks; the 3-drawer adds
 * two dividers on dowels (the 5-drawer three back boards and two dividers, the dividers first), the 6-drawer a middle frame (two posts and three bars carrying runners on both faces) that
 * the two halves lock onto. Upside down, the bottom goes on with dowels and cam locks (the 6-drawer first bolts a
 * middle leg under it), a frame of four rails on corner brackets is screwed under it and the legs are bolted into
 * the brackets with threaded rods, washers and nuts. Standing again, the top with its wall brackets goes on, the
 * lowest runners go in and it is fixed to the wall. Each drawer is built on its front: cam bolts, dowels and sides,
 * the bottom slid in, the back tapped on with ribbed plastic dowels, runners upside down, then the knobs.
 * The nightstand is built the same way with a shelf and two bottom rails between its sides, no bottom panel (a
 * hardboard panel is nailed in underneath at the end), and its frame screwed straight onto the bottom rails.
 */

const RUNNER_SCREW: HwDef = { kind: "screw", len: 11, dia: 4.5 };
const DOWEL_S: HwDef = { kind: "dowel", len: 25, dia: 6 };
const RIBBED: HwDef = { kind: "dowel", len: 40, dia: 7, name: "Ribbed plastic dowel" };
const KNOB_SCREW: HwDef = { kind: "screw", len: 50, dia: 4 };
const BRACKET_SCREW: HwDef = { kind: "screw", len: 16, dia: 4 };
const FRAME_SCREW: HwDef = { kind: "screw", len: 70, dia: 4.5 };
const CORNER: HwDef = { kind: "connector", len: 100, dia: 44, name: "Corner bracket" }; // a steel strip across the inside corner
const ROD: HwDef = { kind: "stud", len: 70, dia: 8, name: "Threaded rod" };
const LEG_NUT: HwDef = { kind: "nut", len: 20, dia: 10, name: "Barrel nut" };
const LEG_WASHER: HwDef = { kind: "washer", len: 2, dia: 20 };
const HEX_NUT: HwDef = { kind: "nut", len: 6, dia: 8 };
const PAD: HwDef = { kind: "glide", len: 4, dia: 36, name: "Floor pad" };
const WALL_BRACKET: HwDef = { kind: "bracket", len: 90, dia: 30 };
const WASHER_S: HwDef = { kind: "washer", len: 1.5, dia: 12 };
const WALL_SCREW: HwDef = { kind: "screw", len: 50, dia: 5 };
const WALL_PLUG: HwDef = { kind: "plug", len: 40, dia: 8 };
const LONG_BOLT: HwDef = { kind: "bolt", len: 60, dia: 6 };
const runnerDef = (len: number): HwDef => ({ kind: "runner", len, dia: 20 });

const FLIP: Vec3 = [Math.PI, 0, 0];
const LEFT_UP: Vec3 = [0, 0, Math.PI / 2]; // a left side lying with its inside face up
const RIGHT_UP: Vec3 = [0, 0, -Math.PI / 2];

/** One drawer: its box sits on runners with its underside at y, behind a front whose outer face is at zf. */
interface Box {
  cx: number;
  y: number;
  bw: number; // outside width of the box
  sh: number; // height of the sides
  dd: number; // depth behind the front
  fw: number;
  fh: number;
  fy: number;
  zf: number;
  knobs: number;
  row?: number;
  small?: boolean; // a shallow drawer: one cam bolt, dowel and cam lock in each side, not two
}
interface Drawer extends Box {
  front: string;
  sides: string[];
  bottom: string;
  back: string;
}

const FT = 18, DS = 12; // drawer front and side thickness

function makeDrawers(b: PlanBuilder, boxes: Box[]): Drawer[] {
  // one set of part types per drawer size
  const types = new Map<string, { frT: string; sdT: string; btT: string; bkT: string }>();
  const typesOf = (b0: Box) => {
    const key = [b0.fw, b0.fh, b0.sh, b0.bw, b0.dd].map(Math.round).join("x");
    let t = types.get(key);
    if (!t) {
      t = {
        frT: b.part("Drawer front", [b0.fw, b0.fh, FT], { material: "wood" }),
        sdT: b.part("Drawer side", [DS, b0.sh, b0.dd - DS], { material: "wood" }),
        btT: b.part("Drawer bottom", [b0.bw - DS, 3, b0.dd - DS - 10], { material: "fiber" }),
        bkT: b.part("Drawer back", [b0.bw, b0.sh - 14, DS], { material: "wood" }),
      };
      types.set(key, t);
    }
    return t;
  };
  return boxes.map((x) => {
    const { frT, sdT, btT, bkT } = typesOf(x);
    const z0 = x.zf - FT; // inside face of the front
    return {
      ...x,
      front: b.place(frT, [x.cx, x.fy, x.zf - FT / 2]),
      sides: [-1, 1].map((g) => b.place(sdT, [x.cx + g * (x.bw / 2 - DS / 2), x.y + x.sh / 2, z0 - (x.dd - DS) / 2])),
      bottom: b.place(btT, [x.cx, x.y + 10, z0 - (x.dd - DS - 10) / 2]),
      back: b.place(bkT, [x.cx, x.y + 14 + (x.sh - 14) / 2, z0 - x.dd + DS / 2]),
    };
  });
}

function drawerFits(d: Drawer, runLen: number) {
  const z0 = d.zf - FT, zBack = z0 - d.dd;
  const sx = (g: number) => d.cx + g * (d.bw / 2 - DS / 2);
  const per = (fn: (g: number, side: string) => FitOpts[]) => [-1, 1].flatMap((g, i) => fn(g, d.sides[i]));
  const kx = d.knobs === 1 ? [d.cx] : [d.cx - d.fw / 4, d.cx + d.fw / 4];
  return {
    bolts: per((g, sd) => (d.small ? [d.y + d.sh * 0.3] : [d.y + 25, d.y + d.sh - 25]).map((y): FitOpts => ({ on: d.front, at: [sx(g), y, z0], dir: [0, 0, 1], mate: sd, mateHole: 4 }))),
    dowels: per((g, sd) => (d.small ? [d.y + d.sh * 0.7] : [d.y + d.sh * 0.4, d.y + d.sh * 0.62]).map((y): FitOpts => ({ on: sd, at: [sx(g), y, z0], dir: [0, 0, -1], mate: d.front }))),
    cams: per((g, sd) => (d.small ? [d.y + d.sh * 0.3] : [d.y + 25, d.y + d.sh - 25]).map((y): FitOpts => ({ on: sd, at: [sx(g) - g * (DS / 2), y, z0 - 28], dir: [g, 0, 0] }))),
    pins: per((g, sd) => [0.3, 0.75].map((k): FitOpts => ({ on: d.back, at: [sx(g), d.y + 14 + (d.sh - 14) * k, zBack], dir: [0, 0, 1], mate: sd }))),
    runners: per((g, sd) => [{ on: sd, at: [sx(g), d.y, z0 - 10 - runLen / 2], dir: [0, 1, 0], hole: false }]),
    runnerScrews: per((g, sd) => [z0 - 40, z0 - runLen + 20].map((z): FitOpts => ({ on: sd, at: [sx(g) + g * (DS / 2), d.y + 8, z], dir: [-g, 0, 0] }))),
    knobs: kx.map((x): FitOpts => ({ on: d.front, at: [x, d.fy, d.zf], dir: [0, 0, -1], hole: false })),
    knobScrews: kx.map((x): FitOpts => ({ on: d.front, at: [x, d.fy, z0], dir: [0, 0, 1] })),
  };
}

/** The drawers, each built on its front in its own scene, then all slid in. */
function drawerSteps(b: PlanBuilder, ds: Drawer[], runLen: number) {
  const runner = runnerDef(runLen);
  // the one built on screen is a full-size drawer; a shallow one gets the same steps with fewer fittings
  const d0 = ds.find((d) => !d.small) ?? ds[0];
  const small = ds.some((d) => d.small) ? " The shallow drawer takes one in each side." : "";
  const c0: Vec3 = [d0.cx, d0.y + d0.sh / 2, d0.zf - d0.dd / 2];
  const stage = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, [it.final.pos[0] - c0[0], it.final.pos[1] - c0[1], it.final.pos[2] - c0[2]], it.final.rot, from);
  };
  const f0 = drawerFits(d0, runLen);
  const rep = ds.length > 1 ? ds.length : undefined;
  type DTool = "screwdriver" | "hammer";
  const dstep = (title: string, detail: string, body: () => void, o: { tools?: DTool[]; kind?: "dowels" | "cams" | "drawer" | "screws" | "runners"; pose?: "-z" | "-y" | "+y" } = {}) =>
    b.step({ title, detail, tools: o.tools, scene: "drawer", pose: o.pose ?? "-z", repeat: rep, kind: o.kind ?? "drawer" }, body);
  dstep(
    "Screw the cam bolts into a drawer front",
    "Lay the front face down on a rug." + small,
    () => {
      stage(d0.front, [0, 0, -160]);
      b.then(0.15);
      b.fits(HW.camScrew, f0.bolts, 0.1);
    },
    { tools: ["screwdriver"], kind: "cams" },
  );
  dstep(
    "Tap dowels into the sides and stand them on the front",
    "Two small dowels in the front end of each side. The grooves face in, at the bottom.",
    () => {
      b.fits(DOWEL_S, f0.dowels, 0.08);
      b.then(0.15);
      b.stagger(0.25);
      for (const sd of d0.sides) stage(sd, [0, 0, -300]);
    },
    { tools: ["hammer"], kind: "dowels" },
  );
  dstep("Lock the sides with cam locks", "Arrow towards the bolt, then turn each one clockwise.", () => b.fits(HW.cam, f0.cams, 0.12), { tools: ["screwdriver"], kind: "cams" });
  dstep("Slide in the drawer bottom", "It runs down the grooves in the sides until it reaches the front.", () => stage(d0.bottom, [0, 0, -420]));
  dstep("Put the drawer back on", "It sits over the ends of the sides, covering the edge of the bottom.", () => stage(d0.back, [0, 0, -260]));
  dstep("Tap the ribbed dowels through the back", "Two into each side, with the hammer, until their heads are flush.", () => b.fits(RIBBED, f0.pins, 0.12), { tools: ["hammer"], kind: "dowels" });
  dstep(
    "Turn it upside down and fit the runners",
    "Left and right runners are marked. Press each onto the bottom edge of its side, then two screws.",
    () => {
      b.fits(runner, f0.runners, 0.25);
      b.then(0.1);
      b.fits(RUNNER_SCREW, f0.runnerScrews, 0.08);
    },
    { tools: ["screwdriver"], kind: "runners", pose: "-y" },
  );
  dstep(
    d0.knobs === 1 ? "Screw the knob on" : "Screw the knobs on",
    d0.knobs === 1 ? "Stand the drawer up. The long screw goes through the front from the inside." : "Stand the drawer up. A long screw through the front from the inside holds each one.",
    () => {
      b.fits(HW.knob, f0.knobs, 0.2);
      b.then(0.1);
      b.fits(KNOB_SCREW, f0.knobScrews, 0.15);
    },
    { tools: ["screwdriver"], kind: "screws", pose: "+y" },
  );
  b.step(
    {
      title: ds.length > 1 ? `Slide in all ${ds.length} drawers` : "Slide in the drawer",
      detail: "Rest its runners on the ones in the frame and push it in until it closes.",
      kind: "drawer",
      warnings: ds.length > 1 ? ["tip"] : [],
    },
    () => {
      for (const [i, d] of ds.entries()) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 520]);
        if (d !== d0) {
          const f = drawerFits(d, runLen);
          const all: [HwDef, FitOpts[]][] = [
            [HW.camScrew, f.bolts],
            [DOWEL_S, f.dowels],
            [HW.cam, f.cams],
            [RIBBED, f.pins],
            [runner, f.runners],
            [RUNNER_SCREW, f.runnerScrews],
            [HW.knob, f.knobs],
            [KNOB_SCREW, f.knobScrews],
          ];
          for (const [def, list] of all) for (const o of list) b.preset(def, o);
        }
        b.wait(0.22);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
}

/** Cabinet runners on the inside of a side (or a face of the middle frame), each with two screws. */
function cabinetRunners(b: PlanBuilder, runLen: number, list: { on: string; x: number; g: number; y: number; zf: number }[]) {
  b.fits(runnerDef(runLen), list.map((r) => ({ on: r.on, at: [r.x, r.y, r.zf - 10 - runLen / 2] as Vec3, dir: [r.g, 0, 0] as Vec3, hole: false })), 0.2);
  b.then(0.1);
  b.fits(RUNNER_SCREW, list.flatMap((r) => [r.zf - 40, r.zf - runLen + 20].map((z): FitOpts => ({ on: r.on, at: [r.x, r.y, z], dir: [r.g, 0, 0] }))), 0.06);
}

/** The frame under the carcass: four rails on corner brackets, the legs bolted into the brackets. */
interface Frame {
  rails: { front: string; back: string; sides: string[] };
  legs: string[];
  yb: number; // underside of the carcass
  zm: number;
  corners: { x: number; z: number; gx: number; gz: number }[]; // inside corners of the frame
}

// e: how far the frame sits in from the carcass edges; ex and eb override it at the sides and the back
function makeFrame(b: PlanBuilder, o: { Wc: number; zb: number; zf: number; yb: number; e: number; ex?: number; eb?: number }): Frame {
  const { Wc, zb, zf, yb, e } = o;
  const ex = o.ex ?? e, eb = o.eb ?? e;
  const RH = 60, RT = 20, LG = 45;
  const zm = (zb + zf) / 2;
  const longT = b.part("Long frame rail", [Wc - 2 * ex, RH, RT], { material: "wood" });
  const shortT = b.part("Short frame rail", [RT, RH, zf - zb - e - eb - 2 * RT], { material: "wood" });
  const yr = yb - RH / 2;
  const front = b.place(longT, [0, yr, zf - e - RT / 2]);
  const back = b.place(longT, [0, yr, zb + eb + RT / 2]);
  const sides = SIDES.map((i) => b.place(shortT, [sg(i) * (Wc / 2 - ex - RT / 2), yr, (zf - e + zb + eb) / 2]));
  const legT = b.part("Leg", [LG, yb, LG], { material: "wood" });
  const xi = Wc / 2 - ex - RT, zfi = zf - e - RT, zbi = zb + eb + RT;
  const corners = [
    { x: -xi, z: zfi, gx: -1, gz: 1 },
    { x: xi, z: zfi, gx: 1, gz: 1 },
    { x: -xi, z: zbi, gx: -1, gz: -1 },
    { x: xi, z: zbi, gx: 1, gz: -1 },
  ];
  const legs = corners.map((c) => b.place(legT, [c.x - (c.gx * LG) / 2, yb / 2, c.z - (c.gz * LG) / 2]));
  return { rails: { front, back, sides }, legs, yb, zm, corners };
}

function frameSteps(b: PlanBuilder, f: Frame, o: { screws: number; mate: string[]; extraPad?: string; centre?: Vec3 }) {
  const { rails, legs, yb, zm, corners } = f;
  const pivot: Vec3 = [0, yb - 30, zm];
  const layF = (k: string, from?: Vec3) => lay(b, k, FLIP, pivot, [0, 30, 0], from);
  const yBr = yb - 30;
  const D45 = Math.SQRT1_2;
  const brackets = corners.map((c): FitOpts => ({ on: c.gx < 0 ? rails.sides[0] : rails.sides[1], at: [c.x - c.gx * 52, yBr, c.z - c.gz * 52], dir: [c.gx * D45, 0, c.gz * D45], hole: false }));
  const toShort = corners.flatMap((c) => [-14, 14].map((dy): FitOpts => ({ on: c.gx < 0 ? rails.sides[0] : rails.sides[1], at: [c.x, yBr + dy, c.z - c.gz * 75], dir: [c.gx, 0, 0] })));
  const toLong = (front: boolean) => corners.filter((c) => (c.gz > 0) === front).flatMap((c) => [-14, 14].map((dy): FitOpts => ({ on: front ? rails.front : rails.back, at: [c.x - c.gx * 75, yBr + dy, c.z], dir: [0, 0, c.gz] })));
  b.step(
    {
      title: "Screw the corner brackets onto the short rails",
      detail: "One at each end of both short rails, two screws each. The rails lie on their top edges.",
      tools: ["screwdriver"],
      scene: "frame",
      kind: "screws",
    },
    () => {
      b.stagger(0.2);
      for (const k of rails.sides) layF(k, [0, 120, 0]);
      b.then(0.15);
      b.fits(CORNER, brackets, 0.15);
      b.then(0.1);
      b.fits(BRACKET_SCREW, toShort, 0.06);
    },
  );
  b.step(
    {
      title: "Screw a long rail to the brackets",
      detail: "Two screws through each bracket. Check the holes along its edge face the same way as in the short rails.",
      tools: ["screwdriver"],
      scene: "frame",
      kind: "screws",
    },
    () => {
      layF(rails.front, [0, 0, 260]);
      b.then(0.15);
      b.fits(BRACKET_SCREW, toLong(true), 0.08);
    },
  );
  b.step(
    {
      title: "Turn it round and screw on the other long rail",
      detail: "Two screws through each of the other two brackets.",
      tools: ["screwdriver"],
      scene: "frame",
      kind: "screws",
    },
    () => {
      layF(rails.back, [0, 0, -260]);
      b.then(0.15);
      b.fits(BRACKET_SCREW, toLong(false), 0.08);
    },
  );
  // screws up through the rails into the carcass, spread along each rail
  const frameScrews: FitOpts[] = [];
  const nLong = Math.round((o.screws - 4) / 2);
  const xs = corners[1].x, zs = [corners[2].z, corners[0].z];
  for (const [k, z] of [[rails.front, corners[0].z + 10], [rails.back, corners[2].z - 10]] as [string, number][])
    for (const x of spread(-xs + 60, xs - 60, nLong)) frameScrews.push({ on: k, at: [x, yb - 60, z], dir: [0, 1, 0], mate: o.mate[0] });
  for (const i of SIDES) for (const z of spread(zs[0] + 60, zs[1] - 60, 2)) frameScrews.push({ on: rails.sides[i], at: [sg(i) * (xs + 10), yb - 60, z], dir: [0, 1, 0], mate: o.mate[Math.min(i, o.mate.length - 1)] });
  b.step(
    {
      title: "Screw the frame under the chest",
      detail: "Lay it on so its edges sit evenly in from the edges above, then drive the long screws up through the rails.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.stagger(0);
      for (const k of [rails.front, rails.back, ...rails.sides]) b.add(k, [0, -280, 0]);
      b.then(0.2);
      b.fits(FRAME_SCREW, frameScrews, 0.05);
    },
  );
  // threaded rods into barrel nuts in the legs, through the brackets, washer and nut
  const rodAt = (c: Frame["corners"][number]): Vec3 => [c.x - c.gx * 45, yBr, c.z - c.gz * 45];
  b.step(
    {
      title: "Fit the barrel nuts and threaded rods in the legs",
      detail: "Drop a barrel nut into the top of each leg, slot lined up, then screw a rod into the hole in the inside corner until it stops.",
      tools: ["flathead"],
      scene: "legs",
      kind: "legs",
    },
    () => {
      b.stagger(0.15);
      legs.forEach((k, i) => b.stage(k, [(i - 1.5) * 140, yb / 2, 0], [0, 0, 0], [0, 140, 0]));
      b.then(0.15);
      b.fits(LEG_NUT, legs.map((k, i) => ({ on: k, at: [corners[i].x - corners[i].gx * 22, yb, corners[i].z - corners[i].gz * 22] as Vec3, dir: [0, -1, 0] as Vec3, hole: 5 })), 0.12);
      b.then(0.1);
      b.fits(ROD, legs.map((k, i) => ({ on: k, at: rodAt(corners[i]), dir: [corners[i].gx * D45, 0, corners[i].gz * D45] as Vec3, travel: 60 })), 0.15);
    },
  );
  b.step(
    {
      title: "Bolt the legs into the corners",
      detail: "Push each rod through its bracket, put on a washer and a nut and tighten it with the spanner.",
      tools: ["wrench"],
      pose: "-y",
      kind: "legs",
    },
    () => {
      b.stagger(0.2);
      for (const k of legs) b.add(k, [0, -300, 0]);
      b.then(0.15);
      const inward = (c: Frame["corners"][number], d: number): Vec3 => [c.x - c.gx * d, yBr, c.z - c.gz * d];
      b.fits(LEG_WASHER, corners.map((c) => ({ on: legs[corners.indexOf(c)], at: inward(c, 56), dir: [c.gx * D45, 0, c.gz * D45] as Vec3, hole: false })), 0.1);
      b.then(0.05);
      b.fits(HEX_NUT, corners.map((c) => ({ on: legs[corners.indexOf(c)], at: inward(c, 60), dir: [c.gx * D45, 0, c.gz * D45] as Vec3, hole: false })), 0.1);
    },
  );
  const padOn = [...legs, ...(o.extraPad ? [o.extraPad] : [])];
  b.step(
    {
      title: o.extraPad ? "Tap a floor pad onto every leg" : "Tap a floor pad onto each leg",
      detail: o.extraPad ? "All four corner legs and the middle one." : "Into the hole in the end of each leg.",
      tools: ["hammer"],
      pose: "-y",
      kind: "general",
    },
    () =>
      b.fits(
        PAD,
        padOn.map((k) => {
          const p = b.partItem(k).final.pos;
          return { on: k, at: [p[0], 0, p[2]] as Vec3, dir: [0, 1, 0] as Vec3, hole: false };
        }),
        0.12,
      ),
  );
}

function wallSteps(b: PlanBuilder, bx: number[], y: number, zb: number) {
  b.step(
    { title: "Mark the wall through the brackets", detail: "Push it against the wall where it will stand and mark through the slot in each bracket.", tools: ["pencil"], kind: "anchor", wall: true, warnings: ["wall", "tip"] },
    () => {},
  );
  b.step(
    {
      title: "Drill the holes and push in the plugs",
      detail: "Move it away first. The plugs suit solid walls; for other walls use fixings made for them.",
      tools: ["drill", "hammer"],
      kind: "anchor",
      wall: true,
      warnings: ["wall"],
    },
    () => b.fits(WALL_PLUG, bx.map((x) => ({ at: [x, y, zb - 1] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.2),
  );
  b.step(
    { title: "Screw it to the wall", detail: "Push it back, put a washer on each screw and screw it through the bracket into the plug.", tools: ["screwdriver"], kind: "anchor", wall: true, warnings: ["tip"] },
    () => {
      b.fits(WASHER_S, bx.map((x) => ({ at: [x, y, zb + 6] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.15);
      b.then(0.05);
      b.fits(WALL_SCREW, bx.map((x) => ({ at: [x, y, zb + 8] as Vec3, dir: [0, 0, -1] as Vec3 })), 0.2);
    },
  );
}

function buildChest(b: PlanBuilder, s: ProductSpec, cols: 1 | 2) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 18, TT = 20, BB = 20, BK = 16, oh = 10, DV = 18;
  const Wc = W - 2 * oh, xs = Wc / 2 - T / 2, xi = Wc / 2 - T;
  const zb = -D / 2, zf = D / 2 - 12, Dc = zf - zb, zm = (zb + zf) / 2;
  const yb = 160, y0 = yb + BB, y1 = H - TT, Hs = y1 - y0;
  const two = cols === 2;
  // the 5-drawer has three back boards and two dividers in the middle; the 3-drawer two of each
  const five = !two && s.drawers?.rows === 5;
  const rows = five ? 5 : 3;
  // the 5-drawer's top drawer is a shallow one
  const wts = range(rows).map((r) => (five && r === rows - 1 ? 0.62 : 1));
  const unit = Hs / wts.reduce((a, c) => a + c, 0);
  const rowAt = (r: number) => y0 + unit * wts.slice(0, r).reduce((a, c) => a + c, 0);
  const nb = five ? 3 : 2;
  const divK = two ? [] : five ? [2, 3] : [1, 2];
  const PW = 44, PD = 44; // posts of the 6-drawer's middle frame

  const sideT = b.part("Side panel", [T, Hs, Dc], { material: "wood" });
  const sides = SIDES.map((i) => b.place(sideT, [sg(i) * xs, y0 + Hs / 2, zm]));
  const top = b.place(b.part("Top", [W, TT, D], { material: "wood" }), [0, H - TT / 2, 0]);
  const bottom = b.place(b.part("Bottom", [Wc, BB, Dc], { material: "wood" }), [0, yb + BB / 2, zm]);
  const backY = range(nb).map((j) => y0 + (Hs * (2 * j + 1)) / (2 * nb));
  const halfW = xi - PW / 2;
  const backT = b.part("Back board", [two ? halfW : 2 * xi, Hs / nb, BK], { material: "wood" });
  // backs[h][k]: half h (only one on the 3-drawer), board k from the bottom
  const backs = (two ? SIDES : [0]).map((h) => backY.map((y) => b.place(backT, [two ? sg(h) * (PW / 2 + halfW / 2) : 0, y, zb + BK / 2])));
  const dvZ = (zb + BK + zf - FT) / 2;
  const divs = divK.map((k) => b.place(b.part("Divider", [2 * xi, DV, zf - FT - zb - BK], { material: "wood" }), [0, rowAt(k), dvZ]));
  const postT = two ? b.part("Middle post", [PW, Hs, PD], { material: "wood" }) : "";
  const posts = two ? [b.place(postT, [0, y0 + Hs / 2, zb + PD / 2]), b.place(postT, [0, y0 + Hs / 2, zf - PD / 2])] : [];
  const barT = two ? b.part("Runner bar", [PW, 40, Dc - 2 * PD], { material: "wood" }) : "";
  const bars = two ? range(rows).map((r) => b.place(barT, [0, rowAt(r) + 20, zm])) : [];
  const ladder = [...posts, ...bars];
  const mid = two ? b.place(b.part("Middle leg", [45, yb, 45], { material: "wood" }), [0, yb / 2, zm]) : "";
  const frame = makeFrame(b, { Wc, zb, zf, yb, e: 20 });

  // drawers: inset between the sides (and the middle post), one row each
  const opens: [number, number][] = two ? [[-xi, -PW / 2], [PW / 2, xi]] : [[-xi, xi]];
  const boxes: Box[] = [];
  for (const r of range(rows).reverse())
    for (const [a, c] of opens) {
      const lo = rowAt(r) + (divK.includes(r) ? DV / 2 : 0), hi = rowAt(r + 1) - (divK.includes(r + 1) ? DV / 2 : 0);
      const rh = rowAt(r + 1) - rowAt(r);
      boxes.push({ cx: (a + c) / 2, y: lo + 16, bw: c - a - 26, sh: hi - lo - 50, dd: Dc - BK - FT - 30, fw: c - a - 4, fh: rh - 4, fy: rowAt(r) + rh / 2, zf, knobs: 2, row: r, small: wts[r] < 1 });
    }
  const ds = makeDrawers(b, boxes);
  const runLen = Math.round((boxes[0].dd - 30) / 10) * 10;
  const rowOf = (d: Drawer) => d.row ?? 0;
  // cabinet runners beside every drawer: on the sides, and on both faces of the middle bars
  const runnersFor = (pred: (d: Drawer) => boolean, onSides: boolean, onBars: boolean) =>
    ds.filter(pred).flatMap((d) => {
      const out: { on: string; x: number; g: number; y: number; zf: number }[] = [];
      const z = d.zf - FT;
      for (const g of [-1, 1]) {
        const x = d.cx + g * (d.bw / 2 + 13);
        const outer = Math.abs(x) > Math.abs(d.cx);
        if (outer && onSides) out.push({ on: sides[x < 0 ? 0 : 1], x: Math.sign(x) * xi, g: Math.sign(x), y: d.y - 6, zf: z });
        if (!outer && onBars) out.push({ on: bars[rowOf(d)], x: d.cx < 0 ? -PW / 2 : PW / 2, g: d.cx < 0 ? 1 : -1, y: d.y - 6, zf: z });
      }
      return out;
    });

  const layL = (k: string, off: Vec3, from?: Vec3) => lay(b, k, LEFT_UP, [-xs, y0 + Hs / 2, zm], off, from);
  const layR = (k: string, off: Vec3, from?: Vec3) => lay(b, k, RIGHT_UP, [xs, y0 + Hs / 2, zm], off, from);
  const offL: Vec3 = [0, T / 2, -(Dc / 2 + 40)], offR: Vec3 = [0, T / 2, Dc / 2 + 40];

  b.step(
    {
      title: "Screw the runners onto both sides",
      detail: "Lay the sides on a rug, inside faces up. The left and right runners are marked; two screws in each.",
      tools: ["screwdriver"],
      scene: "sides",
      kind: "runners",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.2);
      layL(sides[0], offL, [0, 160, 0]);
      layR(sides[1], offR, [0, 160, 0]);
      b.then(0.15);
      cabinetRunners(b, runLen, runnersFor((d) => rowOf(d) > 0, true, false));
    },
  );
  // cam bolts in the sides for the back boards, cam locks in the boards
  const outerBacks = two ? [backs[0], backs[1]] : [backs[0], backs[0]];
  const sideBolts = (i: number): FitOpts[] => [
    ...outerBacks[i].map((k, j): FitOpts => ({ on: sides[i], at: [sg(i) * xi, backY[j], zb + BK / 2], dir: [sg(i), 0, 0], mate: k, mateHole: 4 })),
    ...(five ? [divBolt(i)] : []),
  ];
  const sideCams = (i: number): FitOpts[] => outerBacks[i].map((k, j) => ({ on: k, at: [sg(i) * (xi - 30), backY[j], zb + BK], dir: [0, 0, -1] }));
  // the 5-drawer's upper divider is also held by a cam bolt in each side
  const yDiv = rowAt(divK[divK.length - 1] ?? 0);
  function divBolt(i: number): FitOpts {
    return { on: sides[i], at: [sg(i) * xi, yDiv, dvZ + 60], dir: [sg(i), 0, 0], mate: divs[divs.length - 1], mateHole: 4 };
  }
  const divCam = (i: number): FitOpts => ({ on: divs[divs.length - 1], at: [sg(i) * (xi - 30), yDiv + DV / 2, dvZ + 60], dir: [0, -1, 0] });
  b.step(
    {
      title: "Screw the cam bolts into the sides",
      detail: five ? "Four in each side: three by the back edge and one for the upper divider. By hand until they stop." : "Two in each side, in the holes by the back edge. By hand until they stop.",
      tools: ["screwdriver"],
      scene: "sides",
      kind: "cams",
    },
    () => b.fits(HW.camScrew, [...sideBolts(0), ...sideBolts(1)], 0.1),
  );
  // dowels in both ends of every back board: into a side, or (6-drawer) into the back post
  const backEnds = (h: number): { x: number; g: number; mate: string }[] =>
    two
      ? [{ x: sg(h) * xi, g: -sg(h), mate: sides[h] }, { x: sg(h) * (PW / 2), g: sg(h), mate: posts[0] }]
      : [{ x: -xi, g: 1, mate: sides[0] }, { x: xi, g: -1, mate: sides[1] }];
  const backDowels = (h: number): FitOpts[] =>
    backs[h].flatMap((k, j) => backEnds(h).flatMap((e) => [-60, 60].map((dy): FitOpts => ({ on: k, at: [e.x, backY[j] + dy, zb + BK / 2], dir: [e.g, 0, 0], mate: e.mate }))));
  const layBoards = (ks: string[]) => ks.forEach((k, j) => b.stage(k, [0, BK / 2, (j - (ks.length - 1) / 2) * (Hs / 2 + 60)], [-Math.PI / 2, 0, 0], [0, 140, 0]));

  if (two) {
    // the middle frame, lying flat: runners on one face, turned over for the other, then cam bolts in the back post
    const ladderPivot: Vec3 = [0, y0 + Hs / 2, zm];
    const layLad = (rot: Vec3, from?: Vec3) => {
      b.stagger(0.1);
      for (const k of ladder) lay(b, k, rot, ladderPivot, [0, PW / 2, 0], from);
    };
    b.step(
      {
        title: "Screw runners onto one face of the middle frame",
        detail: "Lay it flat on the rug. One runner along each of the three bars, two screws each.",
        tools: ["screwdriver"],
        scene: "ladder",
        kind: "runners",
      },
      () => {
        layLad(RIGHT_UP, [0, 160, 0]);
        b.then(0.15);
        cabinetRunners(b, runLen, runnersFor((d) => d.cx < 0, false, true));
      },
    );
    b.step(
      {
        title: "Turn it over and do the other face",
        detail: "Three more runners, the other way round.",
        tools: ["screwdriver"],
        scene: "ladder",
        kind: "runners",
      },
      () => {
        layLad(LEFT_UP);
        b.then(0.25);
        cabinetRunners(b, runLen, runnersFor((d) => d.cx > 0, false, true));
      },
    );
    b.step(
      {
        title: "Screw the cam bolts into the back post",
        detail: "Two in each face of the post that has the bars at the back.",
        tools: ["screwdriver"],
        scene: "ladder",
        kind: "cams",
      },
      () => b.fits(HW.camScrew, SIDES.flatMap((h) => backs[h].map((k, j): FitOpts => ({ on: posts[0], at: [sg(h) * (PW / 2), backY[j], zb + BK / 2], dir: [-sg(h), 0, 0], mate: k, mateHole: 4 }))), 0.1),
    );
  }

  const divDowels = divs.flatMap((k, j) => SIDES.flatMap((i) => [-70, 70].map((dz): FitOpts => ({ on: k, at: [sg(i) * xi, rowAt(divK[j]), dvZ + dz], dir: [-sg(i), 0, 0], mate: sides[i] }))));
  if (five) {
    // the manual puts the dividers in first, then the three back boards behind them
    b.step(
      { title: "Tap dowels into the back boards and dividers", detail: "Two in each end of all five boards.", tools: ["hammer"], scene: "boards", kind: "dowels" },
      () => {
        layBoards([...backs[0], ...divs]);
        b.then(0.15);
        b.fits(HW.dowel, [...backDowels(0), ...divDowels], 0.04);
      },
    );
    b.step(
      {
        title: "Lay one side down and stand the dividers in it",
        detail: "Inside face up, runners at the top. Push both dividers down onto their dowels, the one with the cam lock hole nearer the top.",
        pose: "+x",
        kind: "join",
        warnings: ["floor"],
      },
      () => {
        b.add(sides[0], [-260, 0, 0]);
        b.then(0.15);
        b.stagger(0.3);
        for (const k of divs) b.add(k, [300, 0, 0]);
      },
    );
    b.step({ title: "Lock the upper divider with a cam lock", detail: "Arrow towards the bolt, then a clockwise turn.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fit(HW.cam, divCam(0)));
    b.step(
      { title: "Stand the three back boards in it", detail: "One at a time along the back edge, pushed down onto the dowels and cam bolts.", pose: "+x", kind: "join" },
      () => {
        b.stagger(0.3);
        for (const k of backs[0]) b.add(k, [300, 0, 0]);
      },
    );
    b.step({ title: "Lock the back boards with cam locks", detail: "Three, turned clockwise.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(HW.cam, sideCams(0), 0.15));
    b.step(
      { title: "Lower the other side on top", detail: "Runners facing in. Guide every dowel and cam bolt into its hole, then press it down evenly.", pose: "+x", kind: "join", people: 2 },
      () => b.add(sides[1], [420, 0, 0]),
    );
    b.step(
      { title: "Lock this side with cam locks", detail: "Three in the back boards and one in the divider.", tools: ["screwdriver"], pose: "+x", kind: "cams" },
      () => b.fits(HW.cam, [...sideCams(1), divCam(1)], 0.15),
    );
  } else {
  b.step(
      {
        title: two ? "Tap dowels into the back boards for the left half" : "Tap dowels into the back boards",
        detail: "Two in each end of both boards.",
        tools: ["hammer"],
        scene: "boards",
        kind: "dowels",
      },
      () => {
        layBoards(backs[0]);
        b.then(0.15);
        b.fits(HW.dowel, backDowels(0), 0.05);
      },
    );
    b.step(
      {
        title: two ? "Lay the left side down and stand its back boards in it" : "Lay one side down and stand the back boards in it",
        detail: "Inside face up, runners at the top. One board at a time along the back edge, pushed down onto the dowels and cam bolts.",
        pose: "+x",
        kind: "join",
        warnings: ["floor"],
      },
      () => {
        b.add(sides[0], [-260, 0, 0]);
        b.then(0.15);
        b.stagger(0.3);
        for (const k of backs[0]) b.add(k, [300, 0, 0]);
      },
    );
    b.step(
      { title: "Lock the back boards with cam locks", detail: "Arrow towards the bolt, then turn each one clockwise.", tools: ["screwdriver"], pose: "+x", kind: "cams" },
      () => b.fits(HW.cam, sideCams(0), 0.15),
    );
  }

  if (five) {
    // done above
  } else if (!two) {
    b.step(
      { title: "Tap dowels into the dividers", detail: "Two in each end of both.", tools: ["hammer"], scene: "boards", kind: "dowels" },
      () => {
        layBoards(divs);
        b.then(0.15);
        b.fits(HW.dowel, divDowels, 0.05);
      },
    );
    b.step(
      { title: "Stand the dividers in the side", detail: "Push them down onto their dowels, in front of the back boards.", pose: "+x", kind: "join" },
      () => {
        b.stagger(0.3);
        for (const k of divs) b.add(k, [300, 0, 0]);
      },
    );
    b.step(
      { title: "Lower the other side on top", detail: "Runners facing in. Guide every dowel and cam bolt into its hole, then press it down evenly.", pose: "+x", kind: "join", people: 2 },
      () => b.add(sides[1], [420, 0, 0]),
    );
    b.step(
      { title: "Lock the back boards to this side", detail: "Two more cam locks, turned clockwise.", tools: ["screwdriver"], pose: "+x", kind: "cams" },
      () => b.fits(HW.cam, sideCams(1), 0.15),
    );
  } else {
    const ladderCams = (h: number): FitOpts[] => backs[h].map((k, j) => ({ on: k, at: [sg(h) * (PW / 2 + 30), backY[j], zb + BK], dir: [0, 0, -1] }));
    b.step(
      {
        title: "Stand it up and push the middle frame onto the boards",
        detail: "The back post goes onto the free ends of the back boards, runners facing the drawers.",
        kind: "join",
      },
      () => {
        b.stagger(0);
        for (const k of ladder) b.add(k, [320, 0, 0]);
      },
    );
    b.step({ title: "Lock it with cam locks", detail: "Two, in the back boards next to the post.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(HW.cam, ladderCams(0), 0.15));
    b.step(
      { title: "Tap dowels into the back boards for the right half", detail: "Two in each end of both boards.", tools: ["hammer"], scene: "boards", kind: "dowels" },
      () => {
        layBoards(backs[1]);
        b.then(0.15);
        b.fits(HW.dowel, backDowels(1), 0.05);
      },
    );
    b.step(
      {
        title: "Stand the right half's back boards in the other side",
        detail: "Lay the right side down, inside face up, and push the boards onto its dowels and cam bolts.",
        scene: "right",
        kind: "join",
        warnings: ["floor"],
      },
      () => {
        layR(sides[1], [0, T / 2, 0], [0, 160, 0]);
        b.then(0.15);
        b.stagger(0.3);
        for (const k of backs[1]) layR(k, [0, T / 2, 0], [0, 300, 0]);
      },
    );
    b.step({ title: "Lock them with cam locks", detail: "Two, turned clockwise.", tools: ["screwdriver"], scene: "right", kind: "cams" }, () => b.fits(HW.cam, sideCams(1), 0.15));
    b.step(
      { title: "Push the right half onto the middle frame", detail: "Stand it up and slide it onto the back post together.", people: 2, kind: "join", warnings: ["two"] },
      () => {
        b.stagger(0);
        for (const k of [sides[1], ...backs[1]]) b.add(k, [420, 0, 0]);
      },
    );
    b.step({ title: "Lock it with cam locks", detail: "Two, in the back boards next to the post.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(HW.cam, ladderCams(1), 0.15));
  }

  // the top and its wall brackets, upside down on the rug
  const bx = [-W / 4, W / 4];
  const tz = [zb + 60, zm, zf - 60];
  const topBolts: FitOpts[] = [
    ...SIDES.flatMap((i) => tz.map((z): FitOpts => ({ on: top, at: [sg(i) * xs, y1, z], dir: [0, 1, 0], mate: sides[i], mateHole: 4 }))),
    ...posts.map((k): FitOpts => ({ on: top, at: [0, y1, b.partItem(k).final.pos[2]], dir: [0, 1, 0], mate: k, mateHole: 4 })),
  ];
  const topCams: FitOpts[] = [
    ...SIDES.flatMap((i) => tz.map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, y1 - 25, z], dir: [sg(i), 0, 0] }))),
    ...posts.map((k): FitOpts => ({ on: k, at: [PW / 2, y1 - 25, b.partItem(k).final.pos[2]], dir: [-1, 0, 0] })),
  ];
  const topDowels: FitOpts[] = [
    ...SIDES.flatMap((i) => [zm - 80, zm + 80].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xs, y1, z], dir: [0, -1, 0], mate: top }))),
    ...posts.map((k): FitOpts => ({ on: k, at: [8, y1, b.partItem(k).final.pos[2]], dir: [0, -1, 0], mate: top })),
  ];
  const layTop = (from?: Vec3) => lay(b, top, FLIP, [0, H - TT / 2, 0], [0, TT / 2, 0], from);
  const wy = y1 - 30;
  const topSteps = () => {
    b.step(
      {
        title: "Screw the wall brackets under the top",
        detail: "Lay the top upside down on the rug. A washer under each screw, near the back edge.",
        tools: ["screwdriver"],
        scene: "top",
        kind: "screws",
        warnings: ["face"],
      },
      () => {
        layTop([0, 160, 0]);
        b.then(0.15);
        b.fits(WALL_BRACKET, bx.map((x) => ({ on: top, at: [x, y1, zb + 14] as Vec3, dir: [0, 1, 0] as Vec3, hole: false })), 0.2);
        b.then(0.1);
        b.fits(WASHER_S, bx.map((x) => ({ on: top, at: [x, y1 - 3, zb + 40] as Vec3, dir: [0, 1, 0] as Vec3, hole: false })), 0.15);
        b.then(0.05);
        b.fits(BRACKET_SCREW, bx.map((x) => ({ on: top, at: [x, y1 - 3, zb + 40] as Vec3, dir: [0, 1, 0] as Vec3 })), 0.15);
      },
    );
    b.step(
      { title: "Screw the cam bolts into the top", detail: "In the holes along both ends" + (two ? " and the middle." : "."), tools: ["screwdriver"], scene: "top", kind: "cams" },
      () => b.fits(HW.camScrew, topBolts, 0.08),
    );
  };

  // the bottom, with cam bolts (and the 6-drawer's middle leg)
  const bottomBolts = SIDES.flatMap((i) => tz.map((z): FitOpts => ({ on: bottom, at: [sg(i) * xs, y0, z], dir: [0, -1, 0], mate: sides[i], mateHole: 4 })));
  const bottomCams = SIDES.flatMap((i) => tz.map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, y0 + 25, z], dir: [sg(i), 0, 0] })));
  const bottomDowels: FitOpts[] = [
    ...SIDES.flatMap((i) => [zm - 80, zm + 80].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xs, y0, z], dir: [0, 1, 0], mate: bottom }))),
    ...posts.map((k): FitOpts => ({ on: k, at: [8, y0, b.partItem(k).final.pos[2]], dir: [0, 1, 0], mate: bottom })),
  ];
  const bottomPivot: Vec3 = [0, yb, zm];
  const layBottom = (k: string, from?: Vec3) => lay(b, k, FLIP, bottomPivot, [0, BB, 0], from);
  const bottomSteps = () => {
    b.step(
      { title: "Screw the cam bolts into the bottom", detail: "Three along each end, on the face without the screw holes.", tools: ["screwdriver"], scene: "bottom", kind: "cams" },
      () => {
        layBottom(bottom, [0, 160, 0]);
        b.then(0.15);
        b.fits(HW.camScrew, bottomBolts, 0.08);
      },
    );
    if (two) {
      b.step(
        { title: "Tap a dowel into the middle leg", detail: "Into the hole in its top end.", tools: ["hammer"], scene: "bottom", kind: "dowels" },
        () => {
          b.stage(mid, [Wc / 2 + 120, yb / 2, 0], [0, 0, 0], [0, 140, 0]);
          b.then(0.15);
          b.fit(HW.dowel, { on: mid, at: [-10, yb, zm], dir: [0, -1, 0], mate: bottom });
        },
      );
      b.step(
        {
          title: "Bolt the middle leg to the bottom",
          detail: "Stand it on the dowel in the middle of the bottom and turn the bolt in from the other side with the Allen key.",
          tools: ["allen"],
          scene: "bottom",
          kind: "bolts",
        },
        () => {
          layBottom(mid, [0, 200, 0]);
          b.then(0.15);
          b.fit(LONG_BOLT, { on: bottom, at: [10, y0, zm], dir: [0, -1, 0], mate: mid });
        },
      );
    }
    b.step(
      {
        title: "Turn it upside down and put the bottom on",
        detail: "Tap two dowels into the end of each side" + (two ? " and one into each post" : "") + ", then lower the bottom onto them.",
        tools: ["hammer"],
        pose: "-y",
        kind: "join",
        people: two ? 2 : 1,
      },
      () => {
        b.fits(HW.dowel, bottomDowels, 0.08);
        b.then(0.2);
        b.stagger(0);
        b.add(bottom, [0, -300, 0]);
        if (two) b.add(mid, [0, -300, 0]);
      },
    );
    b.step({ title: "Lock the bottom with cam locks", detail: "Three in each side, near the bottom.", tools: ["screwdriver"], pose: "-y", kind: "cams" }, () => b.fits(HW.cam, bottomCams, 0.1));
    if (two)
      b.step(
        { title: "Bolt the bottom to the middle posts", detail: "One long bolt through the bottom into each post, with the Allen key.", tools: ["allen"], pose: "-y", kind: "bolts" },
        () => b.fits(LONG_BOLT, posts.map((k): FitOpts => ({ on: bottom, at: [0, yb, b.partItem(k).final.pos[2]], dir: [0, 1, 0], mate: k })), 0.2),
      );
  };

  if (!two) {
    bottomSteps();
    frameSteps(b, frame, { screws: 12, mate: [bottom] });
    topSteps();
  } else {
    topSteps();
  }
  const putTop = () => {
    b.step(
      {
        title: two ? "Tap dowels into the sides and posts and put the top on" : "Stand it up and put the top on",
        detail: two ? "Two in the top of each side and one in each post, then lower the top onto them." : "Two dowels in the top of each side, then lower the top onto them and the cam bolts.",
        tools: ["hammer"],
        pose: "+y",
        kind: "join",
        people: two ? 2 : 1,
      },
      () => {
        b.fits(HW.dowel, topDowels, 0.08);
        b.then(0.2);
        b.add(top, [0, 300, 0]);
      },
    );
    b.step({ title: "Lock the top with cam locks", detail: two ? "Three in each side and one in each post." : "Three in each side, just under the top.", tools: ["screwdriver"], kind: "cams" }, () => b.fits(HW.cam, topCams, 0.1));
  };
  putTop();
  if (two) {
    bottomSteps();
    frameSteps(b, frame, { screws: 14, mate: [bottom], extraPad: mid });
  }
  b.step(
    {
      title: "Screw in the lowest runners",
      detail: two ? "Stand it up. One runner low down inside each side, two screws each." : "One runner low down inside each side, two screws each.",
      tools: ["screwdriver"],
      pose: "+y",
      kind: "runners",
    },
    () => cabinetRunners(b, runLen, runnersFor((d) => rowOf(d) === 0, true, false)),
  );
  wallSteps(b, bx, wy, zb);
  drawerSteps(b, ds, runLen);
  return true;
}

function buildNightstand(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const T = 18, TT = 20, oh = 10, SHF = 18, RAIL = 70;
  const Wc = W - 2 * oh, xs = Wc / 2 - T / 2, xi = Wc / 2 - T;
  const zb = -D / 2, zf = D / 2 - 12, Dc = zf - zb, zm = (zb + zf) / 2;
  const yb = 180, y1 = H - TT, Hs = y1 - yb;
  const ySh = y1 - 170 - SHF / 2; // shelf centre, under the open space
  const sideT = b.part("Side panel", [T, Hs, Dc], { material: "wood" });
  const sides = SIDES.map((i) => b.place(sideT, [sg(i) * xs, yb + Hs / 2, zm]));
  const top = b.place(b.part("Top", [W, TT, D], { material: "wood" }), [0, H - TT / 2, 0]);
  const shelf = b.place(b.part("Shelf", [2 * xi, SHF, Dc], { material: "wood" }), [0, ySh, zm]);
  const railT = b.part("Bottom rail", [2 * xi, RAIL, T], { material: "wood" });
  const zRf = zf - FT - T / 2, zRb = zb + T / 2;
  const rails = [b.place(railT, [0, yb + RAIL / 2, zRf]), b.place(railT, [0, yb + RAIL / 2, zRb])];
  const panel = b.place(b.part("Bottom panel", [2 * xi, 3, zRf - zRb - T], { material: "fiber" }), [0, yb + 1.5, (zRf + zRb) / 2]);
  // the short rails stand on the sides' bottom edges and the back rail under the back bottom rail
  const frame = makeFrame(b, { Wc, zb, zf, yb, e: 15, ex: 0, eb: 0 });
  const lo = yb + RAIL, hi = ySh - SHF / 2;
  const ds = makeDrawers(b, [{ cx: 0, y: lo + 16, bw: 2 * xi - 26, sh: hi - lo - 50, dd: Dc - FT - 40, fw: 2 * xi - 4, fh: hi - yb - 4, fy: (yb + hi) / 2, zf, knobs: 1 }]);
  const runLen = Math.round((ds[0].dd - 30) / 10) * 10;

  const layL = (k: string, off: Vec3, from?: Vec3) => lay(b, k, LEFT_UP, [-xs, yb + Hs / 2, zm], off, from);
  const layR = (k: string, off: Vec3, from?: Vec3) => lay(b, k, RIGHT_UP, [xs, yb + Hs / 2, zm], off, from);
  const d0 = ds[0];
  b.step(
    {
      title: "Screw a runner onto each side",
      detail: "Lay the sides on a rug, inside faces up. Left and right runners are marked; two screws in each.",
      tools: ["screwdriver"],
      scene: "sides",
      kind: "runners",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.2);
      layL(sides[0], [0, T / 2, -(Dc / 2 + 40)], [0, 160, 0]);
      layR(sides[1], [0, T / 2, Dc / 2 + 40], [0, 160, 0]);
      b.then(0.15);
      cabinetRunners(b, runLen, SIDES.map((i) => ({ on: sides[i], x: sg(i) * xi, g: sg(i), y: d0.y - 6, zf: zf - FT })));
    },
  );
  // a cam bolt in each side for the shelf and both rails
  const joints: [string, number, number][] = [[shelf, ySh, zm], [rails[0], yb + RAIL / 2, zRf], [rails[1], yb + RAIL / 2, zRb]];
  const bolts = (i: number) => joints.map(([k, y, z]): FitOpts => ({ on: sides[i], at: [sg(i) * xi, y, z + (k === shelf ? 130 : 0)], dir: [sg(i), 0, 0], mate: k, mateHole: 4 }));
  const cams = (i: number, ks: string[]) => joints.filter(([k]) => ks.includes(k)).map(([k, y, z]): FitOpts => ({ on: k, at: [sg(i) * (xi - 28), k === shelf ? y + SHF / 2 : y, k === shelf ? z + 130 : z + (k === rails[0] ? -T / 2 : T / 2)], dir: k === shelf ? [0, -1, 0] : [0, 0, k === rails[0] ? 1 : -1] }));
  b.step(
    { title: "Screw the cam bolts into the sides", detail: "Three in each side, by hand until they stop.", tools: ["screwdriver"], scene: "sides", kind: "cams" },
    () => b.fits(HW.camScrew, [...bolts(0), ...bolts(1)], 0.08),
  );
  const shelfDowels = (i: number) => [zm - 140, zm - 40, zm + 50].map((z): FitOpts => ({ on: shelf, at: [sg(i) * xi, ySh, z], dir: [-sg(i), 0, 0], mate: sides[i] }));
  b.step(
    {
      title: "Lay one side down and stand the shelf in it",
      detail: "Inside face up. Tap three dowels into the end of the shelf, then push it onto them and the cam bolt.",
      tools: ["hammer"],
      pose: "+x",
      kind: "join",
      warnings: ["floor"],
    },
    () => {
      b.add(sides[0], [-260, 0, 0]);
      b.then(0.15);
      b.fits(HW.dowel, shelfDowels(0), 0.08);
      b.then(0.15);
      b.add(shelf, [300, 0, 0]);
    },
  );
  b.step({ title: "Lock the shelf with a cam lock", detail: "Arrow towards the bolt, then a clockwise turn.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(HW.cam, cams(0, [shelf]), 0.15));
  const railDowels = (i: number) => rails.map((k, j): FitOpts => ({ on: k, at: [sg(i) * xi, yb + RAIL / 2 + 18, j === 0 ? zRf : zRb], dir: [-sg(i), 0, 0], mate: sides[i] }));
  b.step(
    {
      title: "Stand the two bottom rails in it",
      detail: "A dowel in the end of each, then push them onto the dowel and cam bolt at the front and back of the bottom edge.",
      tools: ["hammer"],
      pose: "+x",
      kind: "join",
    },
    () => {
      b.fits(HW.dowel, railDowels(0), 0.1);
      b.then(0.15);
      b.stagger(0.3);
      for (const k of rails) b.add(k, [300, 0, 0]);
    },
  );
  b.step({ title: "Lock the rails with cam locks", detail: "One in each rail.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(HW.cam, cams(0, rails), 0.15));
  b.step(
    {
      title: "Tap in the dowels and lower the other side on",
      detail: "Three in the shelf and one in each rail. Guide them and the cam bolts into the holes, then press it down.",
      tools: ["hammer"],
      pose: "+x",
      kind: "join",
    },
    () => {
      b.fits(HW.dowel, [...shelfDowels(1), ...railDowels(1)], 0.08);
      b.then(0.2);
      b.add(sides[1], [420, 0, 0]);
    },
  );
  b.step({ title: "Lock this side with cam locks", detail: "Three, turned clockwise.", tools: ["screwdriver"], pose: "+x", kind: "cams" }, () => b.fits(HW.cam, cams(1, [shelf, ...rails]), 0.12));
  const tz = [zb + 50, zm, zf - 50];
  b.step(
    { title: "Screw the cam bolts into the top", detail: "Lay it upside down on the rug. Three along each end.", tools: ["screwdriver"], scene: "top", kind: "cams", warnings: ["face"] },
    () => {
      lay(b, top, FLIP, [0, H - TT / 2, 0], [0, TT / 2, 0], [0, 160, 0]);
      b.then(0.15);
      b.fits(HW.camScrew, SIDES.flatMap((i) => tz.map((z): FitOpts => ({ on: top, at: [sg(i) * xs, y1, z], dir: [0, 1, 0], mate: sides[i], mateHole: 4 }))), 0.08);
    },
  );
  b.step(
    { title: "Stand it up and put the top on", detail: "Two dowels in the top of each side, then lower the top onto them.", tools: ["hammer"], pose: "+y", kind: "join" },
    () => {
      b.fits(HW.dowel, SIDES.flatMap((i) => [zm - 70, zm + 70].map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xs, y1, z], dir: [0, -1, 0], mate: top }))), 0.08);
      b.then(0.2);
      b.add(top, [0, 300, 0]);
    },
  );
  b.step(
    { title: "Lock the top with cam locks", detail: "Three in each side, just under the top.", tools: ["screwdriver"], kind: "cams" },
    () => b.fits(HW.cam, SIDES.flatMap((i) => tz.map((z): FitOpts => ({ on: sides[i], at: [sg(i) * xi, y1 - 25, z], dir: [sg(i), 0, 0] }))), 0.1),
  );
  // the frame goes straight onto the bottom rails, upside down
  const { rails: fr, corners } = frame;
  const xsF = corners[1].x;
  b.step(
    {
      title: "Turn it upside down and screw on the front and back rails",
      detail: "Three long screws through each frame rail into the bottom rail under it.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.stagger(0.3);
      b.add(fr.front, [0, -260, 0]);
      b.add(fr.back, [0, -260, 0]);
      b.then(0.15);
      const list: FitOpts[] = [];
      for (const [k, z, m] of [[fr.front, b.partItem(fr.front).final.pos[2], rails[0]], [fr.back, b.partItem(fr.back).final.pos[2], rails[1]]] as [string, number, string][])
        for (const x of spread(-xsF + 50, xsF - 50, 3)) list.push({ on: k, at: [x, yb - 60, z], dir: [0, 1, 0], mate: m });
      b.fits(FRAME_SCREW, list, 0.08);
    },
  );
  b.step(
    { title: "Fit the short rails between them", detail: "Two dowels in each, then press them onto the bottom edges of the sides, between the long rails.", tools: ["hammer"], pose: "-y", kind: "dowels" },
    () => {
      const list: FitOpts[] = [];
      const sz = b.partItem(fr.sides[0]).final.pos[2], half = (corners[0].z - corners[2].z) / 2;
      for (const i of SIDES) for (const g of [-1, 1]) list.push({ on: fr.sides[i], at: [sg(i) * (Wc / 2 - T / 2), yb, sz + g * (half - 50)], dir: [0, -1, 0], mate: sides[i] });
      b.fits(HW.dowel, list, 0.1);
      b.then(0.15);
      b.stagger(0.3);
      for (const i of SIDES) b.add(fr.sides[i], [0, -240, 0]);
    },
  );
  const D45 = Math.SQRT1_2;
  b.step(
    { title: "Drop a corner bracket into each corner", detail: "They sit in the grooves of the rails.", pose: "-y", kind: "general" },
    () => b.fits(CORNER, corners.map((c): FitOpts => ({ on: fr.sides[c.gx < 0 ? 0 : 1], at: [c.x - c.gx * 52, yb - 30, c.z - c.gz * 52], dir: [c.gx * D45, 0, c.gz * D45], hole: false })), 0.15),
  );
  b.step(
    { title: "Screw the brackets in", detail: "Four screws in each, two into each rail.", tools: ["screwdriver"], pose: "-y", kind: "screws" },
    () =>
      b.fits(
        BRACKET_SCREW,
        corners.flatMap((c) => [
          ...[-14, 14].map((dy): FitOpts => ({ on: fr.sides[c.gx < 0 ? 0 : 1], at: [c.x, yb - 30 + dy, c.z - c.gz * 75], dir: [c.gx, 0, 0] })),
          ...[-14, 14].map((dy): FitOpts => ({ on: c.gz > 0 ? fr.front : fr.back, at: [c.x - c.gx * 75, yb - 30 + dy, c.z], dir: [0, 0, c.gz] })),
        ]),
        0.05,
      ),
  );
  // the legs: the same rods, washers and nuts as the chests, but no pads
  const legs = frame.legs;
  b.step(
    {
      title: "Fit the barrel nuts and threaded rods in the legs",
      detail: "Drop a barrel nut into the top of each leg, slot lined up, then screw a rod into the hole in the inside corner.",
      tools: ["flathead"],
      scene: "legs",
      kind: "legs",
    },
    () => {
      b.stagger(0.15);
      legs.forEach((k, i) => b.stage(k, [(i - 1.5) * 140, yb / 2, 0], [0, 0, 0], [0, 140, 0]));
      b.then(0.15);
      b.fits(LEG_NUT, legs.map((k, i) => ({ on: k, at: [corners[i].x - corners[i].gx * 22, yb, corners[i].z - corners[i].gz * 22] as Vec3, dir: [0, -1, 0] as Vec3, hole: 5 })), 0.12);
      b.then(0.1);
      b.fits(ROD, legs.map((k, i) => ({ on: k, at: [corners[i].x - corners[i].gx * 45, yb - 30, corners[i].z - corners[i].gz * 45] as Vec3, dir: [corners[i].gx * D45, 0, corners[i].gz * D45] as Vec3, travel: 60 })), 0.15);
    },
  );
  b.step(
    { title: "Bolt the legs into the corners", detail: "Rod through the bracket, a washer and a nut, tightened with the spanner.", tools: ["wrench"], pose: "-y", kind: "legs" },
    () => {
      b.stagger(0.2);
      for (const k of legs) b.add(k, [0, -300, 0]);
      b.then(0.15);
      const inward = (c: Frame["corners"][number], d: number): Vec3 => [c.x - c.gx * d, yb - 30, c.z - c.gz * d];
      b.fits(LEG_WASHER, corners.map((c, i) => ({ on: legs[i], at: inward(c, 56), dir: [c.gx * D45, 0, c.gz * D45] as Vec3, hole: false })), 0.1);
      b.then(0.05);
      b.fits(HEX_NUT, corners.map((c, i) => ({ on: legs[i], at: inward(c, 60), dir: [c.gx * D45, 0, c.gz * D45] as Vec3, hole: false })), 0.1);
    },
  );
  b.step(
    { title: "Turn the two long screws into the bottom rails", detail: "One into the inside of each rail, from inside the frame, until the head is flush.", tools: ["screwdriver"], pose: "-y", kind: "screws" },
    () => b.fits(KNOB_SCREW, rails.map((k, j): FitOpts => ({ on: k, at: [0, yb, j === 0 ? zRf : zRb], dir: [0, 1, 0] })), 0.2),
  );
  const nail = (x: number, z: number, on: string): FitOpts => ({ on, at: [x, yb, z], dir: [0, 1, 0], hole: false });
  const pz0 = zRb + T / 2, pz1 = zRf - T / 2;
  b.step(
    {
      title: "Lay in the hardboard panel and nail two corners",
      detail: "Push it into one corner of the opening and put a nail in each of the two corners there.",
      tools: ["hammer"],
      pose: "-y",
      kind: "nails",
    },
    () => {
      b.add(panel, [0, -200, 0]);
      b.then(0.2);
      b.fits(HW.nail, [nail(-xi + 20, pz0 + 6, rails[1]), nail(xi - 20, pz0 + 6, rails[1])], 0.3);
    },
  );
  b.step(
    { title: "Line it up and nail the opposite edge", detail: "Check the panel sits flat and square, then one nail in the middle of the other edge.", tools: ["hammer"], pose: "-y", kind: "nails", check: "square" },
    () => b.fit(HW.nail, nail(0, pz1 - 6, rails[0])),
  );
  b.step(
    { title: "Nail it all round", detail: "Evenly spaced, all the way round the edge.", tools: ["hammer"], pose: "-y", kind: "nails" },
    () => {
      const list: FitOpts[] = [];
      for (const x of spread(-xi + 40, xi - 40, 8)) list.push(nail(x, pz0 + 6, rails[1]), nail(x, pz1 - 6, rails[0]));
      for (const i of SIDES) for (const z of spread(pz0 + 40, pz1 - 40, 6)) list.push(nail(sg(i) * (xi - 6), z, sides[i]));
      b.fits(HW.nail, list.slice(0, 27), 0.04);
    },
  );
  b.step({ title: "Stand it up", detail: "Turn it over onto its legs.", pose: "+y", kind: "standup" }, () => {});
  drawerSteps(b, ds, runLen);
  return true;
}

/* ---------------- the family ---------------- */

type Kind = "single" | "double" | "chest3" | "chest5" | "chest6" | "night";

// the old chest of 6 drawers and the old nightstand have no manual here: they keep their old guides
function kindOf(s: ProductSpec): Kind | null {
  const v = s.variant.toLowerCase();
  if (s.archetype === "bed" && /^bed frame/.test(v)) return (s.bed?.mattressW ?? s.size.w - 16) >= 120 ? "double" : "single";
  if (/^3-drawer dresser/.test(v)) return "chest3";
  if (/^(5-drawer dresser|chest of 5 drawers)/.test(v)) return "chest5";
  if (/^6-drawer dresser/.test(v)) return "chest6";
  if (/^nightstand,/.test(v) && s.size.w >= 45) return "night";
  return null;
}

const family: Family = {
  names: ["TARVA"],
  build(b, s) {
    const k = kindOf(s);
    if (k === "single" || k === "double") return buildBed(b, s, k === "double");
    if (k === "chest3" || k === "chest6") return buildChest(b, s, k === "chest3" ? 1 : 2);
    if (k === "chest5") return buildChest(b, { ...s, drawers: { ...s.drawers!, rows: 5, cols: 1 } }, 1);
    if (k === "night") return buildNightstand(b, s);
    return false;
  },
};
export default family;
