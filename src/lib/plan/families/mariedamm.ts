import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartItem, PartPiece, PartState, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * MARIEDAMM, read from the round 105 table's and the oval 180x100 table's manuals. The base is four bent steel legs
 * that cross under the middle. Each leg gets its end plugs first, then, with the top lying upside down on a rug,
 * the legs are screwed onto it one at a time through the short bent end, only loosely. A connector goes over the
 * crossing and holds the four legs together: on the round table a box that drops over two bolts screwed part way
 * into each leg (eight, tightened through it), on the oval one a bracket screwed to the legs with twelve screws.
 * Every screw into the top is tightened last, and the table is turned over by two people.
 */

const at = (kind: CustomFix["kind"], pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: Partial<CustomFix> = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];

interface Leg {
  id: string;
  theta: number; // plan direction from the middle to its top mount
  u: Vec3; // that direction as a vector
  n: Vec3; // sideways, in plan
  off: number; // sideways offset of its centre line, so the four pass round the connector
  r1: number; // middle to the outer end of the bent end, under the top
  r2: number; // middle to the foot, on the other side
  flange: number;
  A: Vec3; // where the bent end meets the slope
  B: Vec3; // the foot
}

function recipe(s: ProductSpec): (CustomParams & { legs: CustomPart[]; first: number }) | null {
  if (!/mariedamm/i.test(s.slug ?? s.name) || !/table/i.test(s.variant)) return null;
  const round = Math.abs(s.size.w - s.size.d) < 5;
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const T = 25; // the top
  const lw = 40, lh = round ? 50 : 60; // leg tube: across, and in the leg's own plane
  const box = round ? 90 : 110; // the connector over the crossing
  const off = box / 2 + lw / 2;
  const yTop = H - T;
  const yF = yTop - lh / 2; // centre line of the bent end

  // the round table's legs point at the four corners; the oval's lean towards its long ends
  const a = round ? Math.PI / 4 : Math.PI / 6;
  const thetas = [a, Math.PI - a, Math.PI + a, -a];
  const radius = (t: number) => 1 / Math.hypot(Math.cos(t) / (W / 2), Math.sin(t) / (D / 2)); // near enough on the oval
  const legs: Leg[] = thetas.map((theta, i) => {
    const u: Vec3 = [Math.cos(theta), 0, -Math.sin(theta)];
    const n: Vec3 = [Math.sin(theta), 0, Math.cos(theta)];
    const R = round ? W / 2 : radius(theta);
    const r1 = Math.round(R * (round ? 0.6 : 0.52)), r2 = Math.round(R * (round ? 0.86 : 0.84));
    const flange = round ? 170 : 200;
    const o = scale(n, off);
    return {
      id: `L${i}`,
      theta,
      u,
      n,
      off,
      r1,
      r2,
      flange,
      A: add(o, add(scale(u, r1 - flange), [0, yF, 0])),
      B: add(o, add(scale(u, -r2), [0, 0, 0])),
    };
  });
  // the foot is cut level: lift its centre so the low corner just meets the floor
  for (const l of legs) {
    const run = l.r1 - l.flange + l.r2;
    const phi = Math.atan2(yF, run);
    l.B = [l.B[0], (lh / 2) / Math.cos(phi), l.B[2]];
  }

  const parts: CustomPart[] = [];
  const topPieces: PartPiece[] | undefined = round ? undefined : ovalTop(W, D, T);
  parts.push(
    round
      ? { id: "TOP", name: "Table top", size: [W, T, D], pos: [0, H - T / 2, 0], shape: "cyl", material: "board" }
      : { id: "TOP", name: "Table top", size: [W, T, D], pos: [0, H - T / 2, 0], pieces: topPieces, material: "board" },
  );
  for (const l of legs) {
    // drawn in the leg's own plane (x along it, towards the top mount), then turned to its direction
    const run = l.r1 - l.flange + l.r2;
    const rise = yF - l.B[1];
    const len = Math.hypot(run, rise);
    const phi = Math.atan2(rise, run);
    const x0 = -l.r2, x1 = l.r1;
    const y0 = 0, y1 = yTop;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const pieces: PartPiece[] = [
      { shape: "box", size: [l.flange + lh / 2, lh, lw], pos: [l.r1 - (l.flange + lh / 2) / 2 - cx, yF - cy, 0], material: "metal" },
      { shape: "box", size: [len, lh, lw], pos: [(l.r1 - l.flange - l.r2) / 2 - cx, (yF + l.B[1]) / 2 - cy, 0], rot: [0, 0, phi], material: "metal" },
    ];
    for (const q of pieces) {
      q.size = q.size.map((v) => Math.round(v)) as Vec3;
      q.pos = q.pos.map((v) => Math.round(v)) as Vec3;
      if (q.rot) q.rot = q.rot.map((v) => Math.round(v * 1e4) / 1e4) as Vec3;
    }
    const c = add(scale(l.n, l.off), add(scale(l.u, cx), [0, cy, 0]));
    parts.push({ id: l.id, name: "Leg", size: [Math.round(x1 - x0), y1 - y0, lw], pos: c, rot: [0, l.theta, 0], pieces, material: "metal" });
  }
  // the connector over the crossing, at the height where the legs pass the middle
  const l0 = legs[0];
  const yc = l0.B[1] + ((yF - l0.B[1]) * l0.r2) / (l0.r1 - l0.flange + l0.r2);
  const ch = round ? 90 : 70;
  parts.push({ id: "C", name: round ? "Connector box" : "Centre bracket", size: [box, ch, box], pos: [0, yc, 0], material: "metal" });

  // fittings
  const mount = (l: Leg) => {
    // four screws through the bent end into the top, two each side of the middle line; the round table's short
    // screws start from inside the tube (through the access holes underneath), the oval's long ones from below it
    const y0 = round ? yTop - 20 : yTop - lh;
    const pts: Vec3[] = [];
    for (const t of [l.r1 - 35, l.r1 - l.flange + 40]) for (const sd of [-1, 1]) pts.push(add(add(scale(l.u, t), scale(l.n, l.off + sd * 12)), [0, y0, 0]));
    return pts;
  };
  const sideOf = (l: Leg, k: number[]): Vec3[] => k.map((dy) => add(scale(l.n, l.off - lw / 2), [0, yc + dy, 0]));
  const ends = (l: Leg) => ({ top: add(add(scale(l.u, l.r1), scale(l.n, l.off)), [0, yF, 0]), foot: l.B });
  const legStep = (l: Leg, i: number): CustomStep => {
    const pts = mount(l);
    const screws: CustomFix[] = round
      ? [at("washer", pts, [0, 1, 0], l.id, undefined, { len: 1.5, dia: 16 }), at("bolt", pts, [0, 1, 0], l.id, "TOP", { len: 40, dia: 6, name: "Screw" })]
      : [at("bolt", pts, [0, 1, 0], l.id, "TOP", { len: 70, dia: 6 })];
    return {
      title: i === 0 ? "Screw the first leg onto the top" : i === 3 ? "Screw on the last leg" : "Screw on the next leg",
      detail:
        i === 0
          ? "Lay the top upside down on a rug. Bent end flat over its holes, the long end up in the air. Four screws, only snug for now."
          : "It crosses the others in the middle. Four screws, still loose so the legs can settle.",
      add: i === 0 ? ["TOP", l.id] : [l.id],
      fix: screws,
      pose: "-y",
      people: round ? 2 : 1,
      warnings: round ? ["two", "loose"] : ["loose"],
      tools: ["allen"],
      from: i === 0 ? { TOP: [0, -200, 0], [l.id]: [0, -320, 0] } : { [l.id]: [0, -320, 0] },
    };
  };

  const along = (l: Leg) => scale(add(l.A, scale(l.B, -1)), 1 / Math.hypot(...add(l.A, scale(l.B, -1))));
  const topCaps = (name: string) => legs.map((l) => at("cap", [ends(l).top], scale(l.u, -1), l.id, undefined, { len: 20, dia: 40, name }));
  const footCaps = (name: string) => legs.map((l) => at("cap", [ends(l).foot], along(l), l.id, undefined, { len: 20, dia: 40, name }));
  const steps: CustomStep[] = round
    ? [
        { title: "Push a cap into each bent end", detail: "Lay the legs on a rug. Press the flat cap into the open end of the short bent part.", fix: topCaps("Bent end cap"), warnings: ["floor"] },
        { title: "Push a plug into each long end", detail: "The ribbed plug, pressed in until its edge is flush. This end stands on the floor.", fix: footCaps("Leg plug") },
      ]
    : [{ title: "Push a plug into both ends of each leg", detail: "Lay the legs on a rug. Eight plugs, two per leg, pressed in until they sit flush.", fix: [...topCaps("End plug"), ...footCaps("End plug")], warnings: ["floor"] }];
  if (round)
    steps.push({
      title: "Screw two bolts part way into each leg",
      detail: "Into the holes in the middle of the leg, by hand and only a few turns: the heads must stand out.",
      fix: legs.map((l) => at("bolt", sideOf(l, [-20, 20]), scale(l.n, 1), l.id, undefined, { len: 12, dia: 6, name: "Connector bolt" })),
      tools: ["allen"],
      warnings: ["loose"],
    });
  legs.forEach((l, i) => steps.push(legStep(l, i)));
  if (round) {
    steps.push({
      title: "Drop the connector box over the crossing",
      detail: "Its slots go down over the bolt heads. Then tighten all eight bolts through the box with the Allen key.",
      add: ["C"],
      kind: "bolts",
      tools: ["allen"],
      from: { C: [0, -300, 0] },
    });
  } else {
    const pts = legs.flatMap((l) => sideOf(l, [-18, 0, 18]).map((p, k) => add(p, scale(l.u, (k - 1) * 22))));
    steps.push(
      { title: "Set the bracket over the crossing", detail: "The side with the most holes faces the top. Each face lies against a leg.", add: ["C"], from: { C: [0, -300, 0] } },
      {
        title: "Screw the bracket to the legs by hand",
        detail: "Twelve screws, three into each leg. Start them all before you tighten any.",
        fix: legs.map((l, i) => at("screw", pts.slice(i * 3, i * 3 + 3), scale(l.n, 1), "C", l.id, { len: 16, dia: 6 })),
        warnings: ["hand"],
      },
      { title: "Tighten the bracket screws", detail: "All twelve, firmly, with the Allen key.", tools: ["allen"], kind: "screws" },
    );
  }
  steps.push(
    { title: "Tighten every screw in the top", detail: "Sixteen, four in each bent end, now that the legs have settled.", tools: ["allen"], kind: "bolts" },
    { title: "Turn the table over together", detail: "Lift it by the top, not the legs, and stand it on its feet.", pose: "+y", people: 2, warnings: ["two"] },
  );
  return { parts, steps, legs: parts.filter((p) => p.id.startsWith("L")), first: round ? 3 : 1 };
}

/**
 * The legs get their plugs (and the round table's bolts) before the top comes out: they lie side by side on the
 * floor until each is screwed on, and beside the upside-down top once it is down.
 */
function build(b: PlanBuilder, s: ProductSpec) {
  const r = recipe(s);
  if (!r) return false;
  buildCustom(b, { ...s, custom: { parts: r.parts, steps: r.steps } });
  const W = s.size.w * 10, H = s.size.h * 10;
  r.legs.forEach((l, i) => {
    const it = b.items.find((x): x is PartItem => x.kind === "part" && x.final.pos.every((v, k) => Math.abs(v - l.pos[k]) < 0.5));
    if (!it) return;
    const z = (i - 1.5) * 140;
    const lying: PartState = { step: 0, scene: "main", pos: [0, 20, z], rot: [-Math.PI / 2, 0, 0], from: [0, 200, 0], delay: 0 };
    const aside: PartState = { step: r.first, scene: "main", pos: [W / 2 + l.size[0] / 2 + 150, H + 20, z], rot: [Math.PI / 2, 0, 0], delay: 0 };
    it.states.unshift(lying, ...(i > 0 ? [aside] : []));
  });
  return true;
}

/** An oval top: a middle panel with a half disc at each end. */
function ovalTop(W: number, D: number, T: number): PartPiece[] {
  const mid = W - D;
  return [
    { shape: "box", size: [mid + 2, T, D], pos: [0, 0, 0] },
    { shape: "halfcyl", size: [D, T, D / 2], pos: [mid / 2 + D / 4, 0, 0], rot: [0, Math.PI / 2, 0] },
    { shape: "halfcyl", size: [D, T, D / 2], pos: [-mid / 2 - D / 4, 0, 0], rot: [0, -Math.PI / 2, 0] },
  ];
}

const family: Family = { names: ["MARIEDAMM"], build };
export default family;
