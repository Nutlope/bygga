import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, ProductSpec, Vec3 } from "../../types";

/**
 * KILBERGET chests, read from their three manuals. Each side is a unit of its own: dowels in the side panel's
 * edges, cam bolts in the two legs, the legs pushed on and locked, long connector bolts driven in with the crank,
 * the runners screwed on, cam bolts for the cross pieces and a glide in each leg. The 3- and 5-drawer chests are
 * then built lying on one side unit: the front rails, the drawer dividers and the solid back boards stand up from
 * it on dowels and cam locks, the back is bolted to the dividers, the second side unit goes on top and is locked,
 * and once it is standing the top goes on with cam bolts. The 6-drawer chest has a middle panel with runners on
 * both faces, four long rails and two short middle legs; it is built lying on its front, the top is cam-locked on,
 * a hardboard back is held with six rivets, and drawer stops go in once it stands. Every drawer is built on its
 * front (cam bolts, sides, bottom, a stiffening wire, the back on plastic dowels), gets its runners and knobs, and
 * the chest is held to the wall with an anti-tip fitting.
 */

type Kind = 3 | 5 | 6;
const LEG = 40;
const OV = 15; // the top overhangs the legs
const TT = 20;
const PT = 16;
const Y0 = 110; // IKEA: free height under the chest
const D = 410;

const fx = (kind: HwKind, at: Vec3[], dir: Vec3, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: at.length, at, dir, ...o });
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const spread = (a: number, b: number, n: number) => range(n).map((i) => (n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1)));

interface Piece {
  id: string;
  y: number; // centre
  z: number;
  h: number; // extent along y
  d: number; // extent along z
}

function recipe(s: ProductSpec, kind: Kind): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10;
  const xL = W / 2 - OV - LEG / 2, zL = D / 2 - OV - LEG / 2;
  const yT = H - TT;
  const xi = xL - PT / 2; // inner face of a side panel
  const Wc = 2 * xL - LEG; // between the legs
  const zF = zL + LEG / 2; // front face of the legs
  const six = kind === 6;
  const parts: CustomPart[] = [];
  const P = (id: string, name: string, size: Vec3, pos: Vec3, o: Partial<CustomPart> = {}) => parts.push({ id, name, size, pos, material: "board", ...o });

  // side units
  const legsOf = (i: number) => [`L${i}0`, `L${i}1`];
  for (const [i, sx] of [-1, 1].entries()) {
    P(`S${i}`, "Side panel", [PT, yT - Y0, 2 * zL - LEG], [sx * xL, (Y0 + yT) / 2, 0]);
    for (const [j, sz] of [-1, 1].entries()) P(`L${i}${j}`, "Leg", [LEG, yT, LEG], [sx * xL, yT / 2, sz * zL]);
  }
  // front rails, and the pieces across between the side units
  const pieces: Piece[] = [];
  const across = (id: string, name: string, p: Omit<Piece, "id">, o: Partial<CustomPart> = {}) => {
    pieces.push({ id, ...p });
    P(id, name, [Wc, p.h, p.d], [0, p.y, p.z], o);
  };
  across("TF", "Top front rail", { y: yT - 25, z: zF - 9, h: 50, d: 18 });
  across("BF", "Bottom front rail", { y: Y0 + 20, z: zL, h: 40, d: LEG });
  // drawer rows, from the bottom up
  const yA = Y0 + 40, yB = yT - 50;
  const weights = kind === 5 ? [1, 1, 1, 0.72, 0.72] : [1, 1, 1];
  const tw = weights.reduce((a, b) => a + b, 0);
  const rows: { y0: number; h: number }[] = [];
  let acc = yA;
  for (const w of weights) {
    const h = ((yB - yA) * w) / tw;
    rows.push({ y0: acc, h });
    acc += h;
  }
  const divRows = kind === 3 ? [1, 2] : kind === 5 ? [1, 3] : [];
  const zBackIn = -zL + PT / 2; // front face of the back boards
  const dz = zF - 18 - zBackIn;
  divRows.forEach((r, k) => across(`DV${k}`, "Drawer divider", { y: rows[r].y0, z: zBackIn + dz / 2, h: PT, d: dz }));
  const backIds: string[] = [];
  let topBack: string | null = null;
  if (six) {
    across("TK", "Top back rail", { y: yT - 25, z: -zL, h: 50, d: LEG });
    across("BK", "Bottom back rail", { y: Y0 + 20, z: -zL, h: 40, d: LEG });
    P("MP", "Middle panel", [PT, yT - 50 - (Y0 + 40), 2 * zL - LEG], [0, (Y0 + 40 + yT - 50) / 2, 0]);
    for (const [j, sz] of [-1, 1].entries()) P(`LM${j}`, "Middle leg", [LEG, Y0, LEG], [0, Y0 / 2, sz * zL]);
    P("HB", "Back panel", [W - 2 * OV, yT - Y0, 3], [0, (Y0 + yT) / 2, -zL - LEG / 2 + 1.5], { material: "fiber" });
  } else {
    const nb = kind === 3 ? 2 : 3;
    const tb = kind === 3 ? 90 : 0;
    const hb = (yT - tb - Y0) / nb;
    for (const k of range(nb)) {
      const id = `BB${k}`;
      backIds.push(id);
      across(id, "Back board", { y: Y0 + hb * (k + 0.5), z: -zL, h: hb, d: PT });
    }
    if (tb) {
      topBack = "TB";
      P("TB", "Top back board", [Wc, tb, PT], [0, yT - tb / 2, -zL]);
    }
  }
  P("TP", "Top", [W, TT, D], [0, H - TT / 2, 0]);

  // drawers
  const cols = six ? [[-(xL - LEG / 2) + 2, -PT / 2 - 2], [PT / 2 + 2, xL - LEG / 2 - 2]] : [[-(xL - LEG / 2) + 2, xL - LEG / 2 - 2]];
  const boxIn = six ? [[-xi + 13, -PT / 2 - 13], [PT / 2 + 13, xi - 13]] : [[-xi + 13, xi - 13]];
  const ddp = zF - 18 - zBackIn - (six ? 0 : 15);
  interface Drawer {
    k: number;
    shallow: boolean;
    x0: number;
    x1: number;
    bx0: number;
    bx1: number;
    y0: number;
    h: number;
  }
  const drawers: Drawer[] = [];
  // the top drawer first, as the manual builds it
  for (let r = rows.length - 1; r >= 0; r--)
    cols.forEach(([x0, x1], c) => drawers.push({ k: drawers.length, shallow: kind === 5 && r >= 3, x0, x1, bx0: boxIn[c][0], bx1: boxIn[c][1], y0: rows[r].y0, h: rows[r].h }));
  const zfc = zF - 9;
  const zb1 = zF - 18; // back face of a front
  for (const d of drawers) {
    const xc = (d.x0 + d.x1) / 2, bw = d.bx1 - d.bx0, bxc = (d.bx0 + d.bx1) / 2;
    const hb = d.h - 50, yb = d.y0 + 18;
    P(`DF${d.k}`, "Drawer front", [d.x1 - d.x0, d.h - 4, 18], [xc, d.y0 + d.h / 2, zfc]);
    for (const [j, e] of [-1, 1].entries()) P(`DS${d.k}${j}`, "Drawer side", [12, hb, ddp], [bxc + e * (bw / 2 - 6), yb + hb / 2, zb1 - ddp / 2]);
    P(`DB${d.k}`, "Drawer back", [bw - 24, hb, 12], [bxc, yb + hb / 2, zb1 - ddp + 6]);
    P(`DT${d.k}`, "Drawer bottom", [bw - 24, 4, ddp - 12], [bxc, yb + 6, zb1 - (ddp - 12) / 2], { material: "fiber" });
  }

  /* ---------- fittings ---------- */
  const per = { dowel: kind === 5 ? 7 : 5, bolt: six ? 2 : kind === 5 ? 4 : 3, screw: six ? 0 : kind === 5 ? 3 : 2 };
  const sideFits = (i: number) => {
    const sx = i ? 1 : -1;
    const fr = Math.ceil(per.dowel / 2), bk = per.dowel - fr;
    const dowels = [...spread(Y0 + 60, yT - 60, fr).map((y): Vec3 => [sx * xL, y, zL - LEG / 2]), ...spread(Y0 + 100, yT - 100, bk).map((y): Vec3 => [sx * xL, y, -(zL - LEG / 2)])];
    const nb = per.bolt;
    const boltYs = nb === 1 ? [yT - 90] : spread(Y0 + 40, yT - 90, nb); // clear of the dowels and the top rail's cam bolt
    const bolts = boltYs.map((y, k): Vec3 => [sx * xL, y, (k % 2 ? -1 : 1) * (zL - LEG / 2)]);
    const cams = bolts.map((p): Vec3 => [sx * xi, p[1], p[2] - Math.sign(p[2]) * 30]);
    const screws = range(per.screw).map((k): Vec3 => [sx * xL, k === 2 ? (Y0 + yT) / 2 : k % 2 ? Y0 + 40 : yT - 60, (k % 2 ? -1 : 1) * (zL + LEG / 2)]);
    return { dowels, bolts, cams, screws };
  };
  const runnerRows = rows.map((r) => r.y0 + 40);
  const runnerFits = (x: number, inward: number, ts = [-0.4, 0.1, 0.4]) => ({
    runners: runnerRows.map((y): Vec3 => [x, y, zb1 - (ddp - 20) / 2]),
    // through the runner into the panel, beside the runner's middle
    screws: runnerRows.flatMap((y) => ts.map((t): Vec3 => [x + inward * 2, y, zb1 - (ddp - 20) / 2 + t * (ddp - 20)])),
    dir: [inward, 0, 0] as Vec3,
  });
  const runnerLen = Math.round((ddp - 20) / 10) * 10;
  // each piece across: a cam bolt from each side panel, dowels into the second side
  const pieceBolts = (i: number, list = pieces) => list.map((p): Vec3 => [(i ? 1 : -1) * xi, p.y, p.z]);
  const pieceCams = (i: number, list: Piece[]) => list.map((p): Vec3 => [(i ? 1 : -1) * (xi - 30), p.y, p.z + (p.d > 30 ? p.d / 2 : 9)]);
  const pieceDowels = (list: Piece[], n: number) =>
    list.flatMap((p) => (p.h > p.d ? spread(p.y - p.h / 3, p.y + p.h / 3, n) : [p.y]).flatMap((y) => (p.h > p.d || n === 1 ? [[xi, y, p.z] as Vec3] : spread(p.z - p.d / 3, p.z + p.d / 3, n).map((z): Vec3 => [xi, y, z]))));
  const byId = (ids: string[]) => pieces.filter((p) => ids.includes(p.id));
  const rails = byId(["TF", "BF"]);
  const divs = byId(divRows.map((_, k) => `DV${k}`));
  const backs = byId(backIds);

  const knobsPer = six ? 1 : 2;
  const knobPts = (d: Drawer): Vec3[] => {
    const xc = (d.x0 + d.x1) / 2, w = d.x1 - d.x0;
    return (knobsPer === 1 ? [xc] : [xc - w / 4, xc + w / 4]).map((x): Vec3 => [x, d.y0 + d.h / 2, zF]);
  };
  const dfits = (d: Drawer) => {
    const bw = d.bx1 - d.bx0, bxc = (d.bx0 + d.bx1) / 2, hb = d.h - 50, yb = d.y0 + 18;
    const n = d.shallow ? 1 : 2;
    const ys = n === 1 ? [yb + hb / 2] : [yb + 25, yb + hb - 25];
    const sideX = [-1, 1].map((e) => bxc + e * (bw / 2 - 6));
    return {
      bolts: sideX.flatMap((x) => ys.map((y): Vec3 => [x, y, zb1])),
      dowels: sideX.map((x): Vec3 => [x, yb + 8, zb1]),
      camsF: sideX.flatMap((x) => ys.map((y): Vec3 => [x - Math.sign(x - bxc) * 6, y, zb1 - 30])),
      plugs: sideX.flatMap((x) => ys.map((y): Vec3 => [x + Math.sign(x - bxc) * 6, y, zb1 - ddp + 6])),
      camsB: sideX.flatMap((x) => ys.map((y): Vec3 => [x - Math.sign(x - bxc) * 6, y, zb1 - ddp + 40])),
      wire: [[bxc, yb + 10, zb1 - ddp + 14]] as Vec3[],
      // low on the outside of each side, going in
      runnerL: [-0.35, 0, 0.35].map((t): Vec3 => [sideX[0] - 6, yb + 8, zb1 - ddp / 2 + t * ddp]),
      runnerR: [-0.35, 0, 0.35].map((t): Vec3 => [sideX[1] + 6, yb + 8, zb1 - ddp / 2 + t * ddp]),
      knobs: knobPts(d),
    };
  };
  const drawerParts = (d: Drawer) => [`DF${d.k}`, `DS${d.k}0`, `DS${d.k}1`, `DB${d.k}`, `DT${d.k}`];

  const steps: CustomStep[] = [];
  const S0 = sideFits(0), S1 = sideFits(1);
  const R0 = runnerFits(-xi, 1), R1 = runnerFits(xi, -1);
  const runner = (r: ReturnType<typeof runnerFits>): CustomFix[] => [
    fx("runner", r.runners, r.dir, { len: runnerLen, dia: 20 }),
    fx("screw", r.screws, [-r.dir[0], 0, 0], { len: 12, dia: 4 }),
  ];
  const glides = (ids: string[]) => ids.map((id) => {
    const p = parts.find((q) => q.id === id)!.pos;
    return fx("glide", [[p[0], 0, p[2]]], [0, 1, 0], { on: id, dia: 30 });
  });
  const sideTitle = "the side units";
  steps.push(
    {
      title: "Tap the dowels into the side panels",
      detail: `Lay both side panels on a rug, inside face up. ${per.dowel} dowels in the front and back edges of each.`,
      fix: [fx("dowel", S0.dowels, [0, 0, 1], { on: "S0" }), fx("dowel", S1.dowels, [0, 0, 1], { on: "S1" })],
      tools: ["hammer"],
      pose: "+x",
      warnings: ["floor"],
    },
    {
      title: "Screw the cam bolts into the legs",
      detail: "Into the holes on the inside of each leg. Turn them in until they stop.",
      fix: [0, 1].flatMap((i) => (i ? S1 : S0).bolts.map((p) => fx("camScrew", [[p[0], p[1], p[2] + Math.sign(p[2]) * 20]], [0, 0, -Math.sign(p[2])], { on: legsOf(i)[p[2] > 0 ? 1 : 0] }))).slice(0, 10),
      tools: ["screwdriver"],
    },
    { title: `Push the legs onto ${sideTitle}`, detail: "A front and a back leg on each panel, the holes lined up. Mind which way round the legs go.", add: [...legsOf(0), "S0", ...legsOf(1), "S1"] },
    { title: "Lock the legs with cam locks", detail: "Arrow towards the bolt, then turn clockwise until it pulls tight.", fix: [fx("cam", S0.cams, [1, 0, 0], { on: "S0" }), fx("cam", S1.cams, [-1, 0, 0], { on: "S1" }), ...(six ? [fx("cam", [-1, 1].flatMap((sx) => byId(["TF", "BF", "TK"]).map((p): Vec3 => [sx * (Wc / 2 + 24), p.y - p.h / 2 + 6, p.z])), [0, 0, 1])] : [])], tools: ["screwdriver"] },
  );
  if (per.screw)
    steps.push({
      title: "Drive the connector bolts in with the crank",
      detail: "Through each leg into the edge of the side panel.",
      fix: [0, 1].flatMap((i) => [1, -1].map((sz) => fx("bolt", (i ? S1 : S0).screws.filter((p) => Math.sign(p[2]) === sz), [0, 0, -sz], { len: 70, dia: 7, name: "Connector bolt" }))),
      tools: ["allen"],
    });
  steps.push({
    title: "Screw the runners onto the side panels",
    detail: "One for each drawer on each side, three screws each. The wheel end goes at the front.",
    fix: [...runner(R0), ...runner(R1)],
    tools: ["screwdriver"],
  });
  if (six)
    steps.push({ title: "Screw the cam bolts into the rails", detail: "Into the ends of the long rails that meet the legs.", fix: [-1, 1].flatMap((sx) => byId(["TF", "BF", "TK"]).map((p) => fx("camScrew", [[sx * (Wc / 2), p.y - p.h / 2 + 6, p.z]], [-sx, 0, 0], { on: p.id }))), tools: ["screwdriver"] });
  const crossBolts = six ? 2 : pieces.length;
  steps.push(
    {
      title: "Screw in the cam bolts for the cross pieces",
      detail: `${crossBolts} on the inside of each side panel.`,
      fix: [fx("camScrew", pieceBolts(0).slice(0, crossBolts), [1, 0, 0], { on: "S0" }), fx("camScrew", pieceBolts(1).slice(0, crossBolts), [-1, 0, 0], { on: "S1" })],
      tools: ["screwdriver"],
    },
    { title: "Press a glide into each leg", detail: "Into the bottom end.", fix: glides(["L00", "L01", "L10", "L11"]) },
  );

  if (!six) {
    const firstPieces = kind === 3 ? rails : backs;
    const secondPieces = kind === 3 ? divs : rails;
    const thirdPieces = kind === 3 ? backs : divs;
    const name = (ps: Piece[]) => (ps === rails ? "the front rails" : ps === divs ? "the drawer dividers" : "the back boards");
    const addStep = (ps: Piece[], n: number, title: string, detail: string): CustomStep => ({
      title,
      detail,
      add: ps.map((p) => p.id),
      fix: [fx("dowel", pieceDowels(ps, n), [1, 0, 0], { len: 30, dia: 8 })],
      people: 1,
    });
    const camStep = (ps: Piece[]): CustomStep => ({ title: `Lock ${name(ps)} with cam locks`, detail: "One at the bottom end of each, into the side unit underneath.", fix: [fx("cam", pieceCams(0, ps), [0, 0, -1])], tools: ["screwdriver"] });
    if (kind === 5)
      steps.push({
        title: "Join the back boards edge to edge",
        detail: "On the rug. Dowels in their long edges, then push them together into one back.",
        fix: [fx("dowel", backs.slice(0, -1).flatMap((p) => spread(-Wc / 3, Wc / 3, 4).map((x): Vec3 => [x, p.y + p.h / 2, p.z])), [0, 1, 0], { len: 30, dia: 8 })],
        pose: "+x",
      });
    steps.push(
      addStep(firstPieces, kind === 3 ? 2 : 2, `Stand ${name(firstPieces)} up on one side unit`, "Lay one side unit on the rug, inside up. Dowels in the top ends, then push each piece onto its cam bolt."),
      camStep(firstPieces),
      addStep(secondPieces, kind === 3 ? 2 : 2, `Stand ${name(secondPieces)} up`, kind === 3 ? "Between the rails and the back, one under each drawer." : "At the front, the wide one at the bottom."),
      camStep(secondPieces),
      addStep(thirdPieces, kind === 3 ? 4 : 2, `Stand ${name(thirdPieces)} up`, kind === 3 ? "At the back edge, pressed down onto the side unit." : "Between the rails and the back, one under each drawer pair."),
      camStep(thirdPieces),
      {
        title: "Bolt the back to the dividers",
        detail: "Two long connector bolts through the back into each divider, with the crank.",
        fix: [fx("bolt", divs.flatMap((p) => [-Wc / 4, Wc / 4].map((x): Vec3 => [x, p.y, -zL - PT / 2])), [0, 0, 1], { len: 70, dia: 7, name: "Connector bolt" })],
        tools: ["allen"],
      },
      ...(kind === 5 ? [{ title: "Tap four dowels into the top of the back", detail: "Into its top edge, for the top.", fix: [fx("dowel", spread(-Wc / 3, Wc / 3, 4).map((x): Vec3 => [x, yT, -zL]), [0, -1, 0], { len: 30, dia: 8, on: "BB2" })], tools: ["hammer"] } as CustomStep] : []),
      {
        title: "Lay the other side unit on top",
        detail: "Together, the dowels and cam bolts lined up with their holes. Press it down evenly.",
        people: 2,
        warnings: ["two"],
      },
      {
        title: "Lock the second side unit",
        detail: `${pieces.length} cam locks, one in each cross piece.`,
        fix: [fx("cam", pieceCams(1, pieces), [0, 0, -1])],
        tools: ["screwdriver"],
      },
      {
        title: "Stand it up",
        detail: topBack ? "Turn it onto its legs. Dowels into the top edge of the back, then push the top back board on." : "Turn it onto its legs.",
        pose: "+y",
        people: 2,
        warnings: ["two"],
        ...(topBack ? { add: [topBack], fix: [fx("dowel", spread(-Wc / 3, Wc / 3, 4).map((x): Vec3 => [x, yT - 90, -zL]), [0, 1, 0], { len: 30, dia: 8 })] } : {}),
      },
    );
  } else {
    const mpR0 = runnerFits(-PT / 2, -1), mpR1 = runnerFits(PT / 2, 1, [-0.3, 0.2, 0.3]); // clear of the screws on the other face
    steps.push(
      { title: "Tap the dowels into the middle panel", detail: "Two in each end, for the rails.", fix: [fx("dowel", [-1, 1].flatMap((sz) => [Y0 + 70, yT - 70].map((y): Vec3 => [0, y, sz * (zL - LEG / 2)])), [0, 0, 1], { on: "MP" })], tools: ["hammer"] },
      { title: "Screw the runners onto the middle panel", detail: "Both faces, one for each drawer, three screws each.", fix: [...runner(mpR0), ...runner(mpR1)], tools: ["screwdriver"] },
      {
        title: "Push the middle panel onto the front rails",
        detail: "Lay the two front rails on the rug, dowels in their ends, and push the middle panel onto them. The chest is built lying on its front.",
        add: ["TF", "BF", "MP"],
        fix: [-1, 1].flatMap((sx) => byId(["TF", "BF"]).map((p) => fx("dowel", [[sx * (Wc / 2), p.y + p.h / 2 - 6, p.z]], [-sx, 0, 0], { on: p.id, len: 30, dia: 8 }))),
        pose: "-z",
        warnings: ["floor"],
      },
      {
        title: "Push the back rails onto the middle panel",
        detail: "Dowels in their ends too.",
        add: ["TK", "BK"],
        fix: [-1, 1].flatMap((sx) => byId(["TK", "BK"]).map((p) => fx("dowel", [[sx * (Wc / 2), p.y + p.h / 2 - 6, p.z]], [-sx, 0, 0], { on: p.id, len: 30, dia: 8 }))),
      },
      {
        title: "Screw the middle legs in",
        detail: "Turn each leg by hand onto its hanger bolt under the bottom rails, until it sits tight.",
        add: ["LM0", "LM1"],
        fix: [fx("legScrew", [-1, 1].map((sz): Vec3 => [0, Y0, sz * zL]), [0, 1, 0], { name: "Hanger bolt", len: 60, dia: 8 })],
      },
      { title: "Lock the middle panel", detail: "Two cam locks.", fix: [fx("cam", [[PT / 2 + 30, yT - 25, zF - 18], [PT / 2 + 30, Y0 + 20, -zL + LEG / 2]], [0, 0, -1])], tools: ["screwdriver"] },
      { title: "Push a side unit onto the rails", detail: "Line the cam bolts up with the holes in the rail ends, and press it on.", people: 2, warnings: ["two"] },
      { title: "Push the other side unit on", detail: "The same way at the other end." },
      { title: "Lock both side units", detail: "Two cam locks, into the back rails.", fix: [fx("cam", [-1, 1].map((sx): Vec3 => [sx * (xi - 30), yT - 25, -zL + LEG / 2]), [0, 0, 1])], tools: ["screwdriver"] },
      { title: "Screw the cam bolts into the top", detail: "Six, into its underside.", fix: [fx("camScrew", [-1, 0, 1].flatMap((t) => [-1, 1].map((sz): Vec3 => [t * (xi - 40), yT, sz * (zL - 10)])), [0, 1, 0], { on: "TP" })], tools: ["screwdriver"] },
      { title: "Push the top on", detail: "Onto the ends of the legs and the middle panel, the cam bolts in their holes.", add: ["TP"] },
      { title: "Lock the top with six cam locks", fix: [fx("cam", [-1, 0, 1].flatMap((t) => [-1, 1].map((sz): Vec3 => [t * (xi - 40) + (t ? 0 : 30), yT - 25, sz * (zL - 10)])), [0, 0, -1])], tools: ["screwdriver"] },
      { title: "Slide the back panel in", detail: "Into the grooves in the back legs, white side in, from the bottom end.", add: ["HB"] },
      {
        title: "Fix the back with six rivets",
        detail: "Push a rivet plug through each hole into the rails, then press its pin in.",
        fix: [fx("clip", [-1, 0, 1].flatMap((t) => [yT - 25, Y0 + 20].map((y): Vec3 => [t * (Wc / 2 - 60), y, -zL - LEG / 2])), [0, 0, 1], { name: "Rivet" })],
      },
      { title: "Press glides into the middle legs", fix: glides(["LM0", "LM1"]) },
      {
        title: "Stand it up and fit the drawer stops",
        detail: "Together, onto its legs. Eight stops, clicked onto the front rails behind each drawer.",
        pose: "+y",
        people: 2,
        warnings: ["two"],
        fix: [fx("clip", cols.flatMap(([x0, x1]) => [yT - 50, Y0 + 40].flatMap((y) => [x0 + 80, x1 - 80].map((x): Vec3 => [x, y, zF - 30]))), [0, 0, -1], { name: "Drawer stop" })],
      },
    );
  }
  if (!six)
    steps.push(
      { title: "Screw the cam bolts into the top", detail: "Four, into its underside.", fix: [fx("camScrew", [-1, 1].flatMap((sx) => [-1, 1].map((sz): Vec3 => [sx * (xi - 60), yT, sz * (zL - 10)])), [0, 1, 0], { on: "TP" })], tools: ["screwdriver"] },
      { title: "Lay the top on", detail: "Rest it on the legs, the cam bolts in the holes in the rails, flush at the back.", add: ["TP"] },
      {
        title: "Lock the top with four cam locks",
        detail: "Two in the top front rail, two in the back.",
        fix: [fx("cam", [-1, 1].map((sx): Vec3 => [sx * (xi - 60), yT - 25, zF - 18]), [0, 0, 1]), fx("cam", [-1, 1].map((sx): Vec3 => [sx * (xi - 60), yT - 45, -zL + PT / 2]), [0, 0, -1])],
        tools: ["screwdriver"],
      },
    );

  // the wall: a bracket on the back of the top, a plate on the wall that it hooks into
  const kits = six ? [-W / 4, W / 4] : [0];
  const yW = yT - 40;
  steps.push(
    {
      title: "Fix it to the wall",
      detail: "Screw the bracket to the back under the top. Mark the wall through it, drill, tap the plugs in and screw the plate to the wall, then push the chest back until the bracket clicks into the plate. The plugs suit solid walls: for others, use fixings made for your wall.",
      fix: [
        fx("bracket", kits.map((x): Vec3 => [x, yW, -zL - LEG / 2]), [0, 0, 1], { name: "Anti-tip bracket" }),
        fx("screw", kits.map((x): Vec3 => [x, yW + 15, -zL - LEG / 2]), [0, 0, 1], { len: 16, dia: 4 }),
        fx("plate", kits.map((x): Vec3 => [x, yW, -zL - LEG / 2 - 30]), [0, 0, -1], { name: "Wall plate" }),
        fx("plug", kits.flatMap((x) => [x - 20, x + 20].map((xx): Vec3 => [xx, yW, -zL - LEG / 2 - 40])), [0, 0, -1], { included: true, len: 50, dia: 8 }),
        fx("washer", kits.flatMap((x) => [x - 20, x + 20].map((xx): Vec3 => [xx, yW, -zL - LEG / 2 - 32])), [0, 0, -1]),
        fx("screw", kits.flatMap((x) => [x - 20, x + 20].map((xx): Vec3 => [xx, yW, -zL - LEG / 2 - 31])), [0, 0, -1], { len: 50, dia: 5, included: true }),
      ],
      tools: ["screwdriver", "drill", "pencil", "hammer"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  );

  // drawers: the first one step by step, then the rest
  const d0 = drawers[0];
  const f0 = dfits(d0);
  const rest = drawers.slice(1);
  const fr = rest.map(dfits);
  const cat = <K extends keyof ReturnType<typeof dfits>>(k: K) => fr.flatMap((f) => f[k]);
  steps.push(
    { title: "Screw the cam bolts into a drawer front", detail: "Lay it face down on the rug. Into the holes along its ends.", fix: [fx("camScrew", f0.bolts, [0, 0, 1], { on: `DF${d0.k}` })], tools: ["screwdriver"] },
    { title: "Tap two dowels in", detail: "One near the bottom of each end.", fix: [fx("dowel", f0.dowels, [0, 0, 1], { on: `DF${d0.k}`, len: 30, dia: 8 })], tools: ["hammer"] },
    { title: "Push the sides onto the front", detail: "Grooves facing in and down.", add: [`DF${d0.k}`, `DS${d0.k}0`, `DS${d0.k}1`], from: { [`DS${d0.k}0`]: [0, 0, -260], [`DS${d0.k}1`]: [0, 0, -260] } },
    { title: "Lock the sides with cam locks", fix: [fx("cam", f0.camsF, [0, 1, 0])], tools: ["screwdriver"] },
    { title: "Slide the bottom in", detail: "Along the grooves, smooth side up.", add: [`DT${d0.k}`] },
    { title: "Knock the stiffening wire in", detail: "Into the slot in the bottom edge of the back, hooked end first. Tap it with the hammer until it sits flush.", fix: [fx("nail", f0.wire, [0, 1, 0], { name: "Stiffening wire", len: 40, dia: 3, on: `DB${d0.k}` })], tools: ["hammer"] },
    {
      title: "Push the back on",
      detail: "Plastic dowels through the sides into the back, then cam locks to hold it.",
      add: [`DB${d0.k}`],
      fix: [fx("pin", f0.plugs, [1, 0, 0], { name: "Plastic dowel", len: 30, dia: 8 }), fx("cam", f0.camsB, [0, 1, 0])],
      tools: ["screwdriver"],
    },
    { title: "Screw the runners onto the drawer", detail: "Three screws each side, the wheel end at the back.", fix: [fx("screw", f0.runnerL, [1, 0, 0], { len: 12, dia: 4 }), fx("screw", f0.runnerR, [-1, 0, 0], { len: 12, dia: 4 })], tools: ["screwdriver"] },
    {
      title: knobsPer === 1 ? "Screw the knob on" : "Screw the knobs on",
      detail: "The screw goes through the front from inside. Snug is enough.",
      fix: [fx("knob", f0.knobs, [0, 0, -1], { on: `DF${d0.k}` }), fx("screw", f0.knobs.map((p): Vec3 => [p[0], p[1], zb1 - 5]), [0, 0, 1], { len: 30, dia: 4 })],
      tools: ["screwdriver"],
    },
    {
      title: `Build the other ${rest.length} drawers the same way`,
      detail: "Bolts and dowels in the front, sides and cams, the bottom, the wire, the back, runners and knobs.",
      add: rest.flatMap(drawerParts),
      // each front and its sides meet along the bolts and dowels, front to back
      from: Object.fromEntries(rest.flatMap((d) => [[`DF${d.k}`, [0, 0, 300] as Vec3], [`DS${d.k}0`, [0, 0, -300] as Vec3], [`DS${d.k}1`, [0, 0, -300] as Vec3]])),
      fix: [
        fx("camScrew", cat("bolts"), [0, 0, 1]),
        fx("dowel", cat("dowels"), [0, 0, 1], { len: 30, dia: 8 }),
        fx("cam", [...cat("camsF"), ...cat("camsB")], [0, 1, 0]),
        fx("nail", cat("wire"), [0, 1, 0], { name: "Stiffening wire", len: 40, dia: 3 }),
        fx("pin", cat("plugs"), [1, 0, 0], { name: "Plastic dowel", len: 30, dia: 8 }),
        fx("screw", cat("runnerL"), [1, 0, 0], { len: 12, dia: 4 }),
        fx("screw", cat("runnerR"), [-1, 0, 0], { len: 12, dia: 4 }),
        fx("knob", cat("knobs"), [0, 0, -1]),
        fx("screw", cat("knobs").map((p): Vec3 => [p[0], p[1], zb1 - 5]), [0, 0, 1], { len: 30, dia: 4 }),
      ],
      tools: ["screwdriver", "hammer"],
    },
    { title: "Slide the drawers in", detail: "Rest each drawer on the runners and push it in until it closes. Open only one at a time.", warnings: ["tip"] },
  );
  return { parts, steps };
}

function kindOf(s: ProductSpec): Kind | null {
  const m = (s.slug ?? "").match(/^kilberget-chest-(3|5|6)-drawers/);
  return m ? (+m[1] as Kind) : null;
}

const family: Family = {
  names: ["KILBERGET"],
  recipe(s) {
    const k = kindOf(s);
    return k ? recipe(s, k) : null;
  },
};
export default family;
