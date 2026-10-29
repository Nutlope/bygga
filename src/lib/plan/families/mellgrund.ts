import type { Family } from "./family";
import type { CustomFix, CustomPart, CustomStep, PartPiece, ProductSpec, Vec3 } from "../../types";

/*
 * MELLGRUND (powder-coated steel), read from its two manuals: the twin, and the full (sold as our "queen").
 * The four legs push into the bottoms of the low head frame and the footboard. Two rail studs screwed into each
 * post take the hooked ends of the side rails: first at the head, then the footboard. The scrolled top of the
 * headboard drops onto the head posts and is screwed on (two screws in each post, three up from underneath).
 * A flat brace across each corner is screwed to the rail, then squared and screwed to the end, and the studs are
 * tightened. Felt strips go along the rails, four clips hold the slatted base (sold separately). The full adds an
 * extendable centre beam dropped between the ends, with three strips and four clips of its own.
 * IKEA's sizes: twin 104 x 198, head 129, foot 88; full 142 x 198, head 146, foot 93; 25 cm under the rails.
 */

const D = 32; // post tubes
const BAR = 12; // the bars in the ends
const Y0 = 230; // legs end here, the end frames' posts start
const RY0 = 250, RH = 60; // side rails: bottom and height
const LIP = 3;

type P2 = [number, number];

/** A round bar from a to b in the x-y plane of an end frame. */
function seg(a: P2, b: P2, dia = BAR): PartPiece {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return { shape: "cyl", size: [dia, Math.hypot(dx, dy) + dia * 0.4, dia], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0], rot: [0, 0, Math.atan2(-dx, dy)] };
}

/** An elliptic arc as short bars. */
function arc(c: P2, rx: number, ry: number, t0: number, t1: number, n: number, dia = BAR): PartPiece[] {
  const pts: P2[] = Array.from({ length: n + 1 }, (_, i) => {
    const t = t0 + ((t1 - t0) * i) / n;
    return [c[0] + rx * Math.cos(t), c[1] + ry * Math.sin(t)];
  });
  return pts.slice(1).map((p, i) => seg(pts[i], p, dia));
}

/** A part made of pieces given in the product's frame (x, y in the end's plane, at depth z). */
function welded(id: string, name: string, z: number, pieces: PartPiece[]): CustomPart {
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const p of pieces) {
    const r = p.rot?.[2] ?? 0;
    const half = p.size[1] / 2;
    const ext = p.shape === "cyl" ? [Math.abs(Math.sin(r)) * half + p.size[0] / 2, Math.abs(Math.cos(r)) * half + p.size[0] / 2] : [p.size[0] / 2, half];
    for (const k of [0, 1]) {
      lo[k] = Math.min(lo[k], p.pos[k] - ext[k]);
      hi[k] = Math.max(hi[k], p.pos[k] + ext[k]);
    }
  }
  const c: Vec3 = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, z];
  return {
    id,
    name,
    size: [hi[0] - lo[0], hi[1] - lo[1], D],
    pos: c,
    material: "metal",
    pieces: pieces.map((p) => ({ ...p, pos: [p.pos[0] - c[0], p.pos[1] - c[1], p.pos[2]] as Vec3 })),
  };
}

const spread = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => a + ((b - a) * (i + 1)) / (n + 1));

function slatRoll(w: number, len: number): PartPiece[] {
  const n = Math.max(12, Math.round(len / 110));
  const pitch = (len - 60) / (n - 1);
  return [
    ...Array.from({ length: n }, (_, i): PartPiece => ({ shape: "box", size: [w, 9, 55], pos: [0, 2, -len / 2 + 30 + i * pitch] })),
    ...[-1, 1].map((sx): PartPiece => ({ shape: "box", size: [24, 4, len], pos: [sx * (w / 2 - 90), -4, 0], material: "fiber" })),
  ];
}

const STUD = { kind: "stud" as const, name: "Rail stud", len: 35, dia: 10 };
const SCREW = { kind: "screw" as const, len: 12, dia: 6 };

function recipe(s: ProductSpec) {
  const slug = s.slug ?? "";
  if (!/^mellgrund-bed-frame/.test(slug)) return null;
  const full = /queen|full|152|135/.test(slug);
  const W = full ? 1420 : 1040, L = 1980;
  const HH = full ? 1460 : 1290, FH = full ? 930 : 880;
  const HL = full ? 800 : 700; // top of the low head frame
  const nHead = full ? 7 : 3, nFoot = full ? 6 : 3;
  const xp = W / 2 - D / 2, zh = -L / 2 + D / 2, zf = L / 2 - D / 2;
  const yb = RY0 + 20; // the ends' bottom bar
  const parts: CustomPart[] = [];

  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
    parts.push({ id: `LG${sx}${sz}`, name: "Leg", size: [D, Y0, D], pos: [sx * xp, Y0 / 2, sz < 0 ? zh : zf], shape: "cyl", material: "metal" });

  // the low head frame: two posts, a bottom and a top bar, straight bars between
  const head: PartPiece[] = [
    ...[-1, 1].map((sx) => seg([sx * xp, Y0], [sx * xp, HL], D)),
    seg([-xp, yb], [xp, yb], 20),
    seg([-xp, HL - 20], [xp, HL - 20], 20),
    ...spread(-xp, xp, nHead).map((x) => seg([x, yb], [x, HL - 20])),
  ];
  parts.push(welded("HF", "Head frame", zh, head));

  // the footboard: posts curving into an arch, straight bars up to it
  const fTop = FH - 140;
  const footArch = (x: number) => fTop + 140 * Math.sqrt(Math.max(0, 1 - (x / xp) ** 2));
  const foot: PartPiece[] = [
    ...[-1, 1].map((sx) => seg([sx * xp, Y0], [sx * xp, fTop], D)),
    seg([-xp, yb], [xp, yb], 20),
    ...arc([0, fTop], xp, FH - fTop - BAR, 0, Math.PI, 14, 20),
    ...spread(-xp, xp, nFoot).map((x) => seg([x, yb], [x, footArch(x) - 12])),
  ];
  parts.push(welded("FB", "Footboard", zf, foot));

  // the scrolled top of the headboard, posts sliding down over the head frame's
  const hTop = HH - 220;
  const topY = HL + 10;
  const scrolls: PartPiece[] = [
    ...[-1, 1].map((sx) => seg([sx * xp, topY], [sx * xp, hTop], D)),
    ...arc([0, hTop], xp, HH - hTop - BAR, 0, Math.PI, 16, 20),
    seg([-xp, topY + 10], [xp, topY + 10], 16),
    seg([0, topY + 10], [0, HH - 220]),
    // a fan of loops either side of the centre bar
    ...[-1, 1].flatMap((sx) => [
      ...arc([sx * xp * 0.22, (topY + HH) / 2], xp * 0.2, (HH - topY) * 0.38, 0, 2 * Math.PI, 14),
      ...arc([sx * xp * 0.62, topY + (HH - topY) * 0.45], xp * 0.18, (HH - topY) * 0.3, 0, 2 * Math.PI, 12),
      seg([sx * xp * 0.35, topY + 10], [sx * xp * 0.35, topY + (hTop - topY) * 0.1]),
    ]),
    ...arc([0, HH - 300], xp * 0.16, 110, 0, Math.PI, 6),
  ];
  parts.push(welded("HT", "Headboard top", zh, scrolls));

  // side rails: a steel angle hooked onto the posts, the lip turned in for the slatted base
  const z0 = zh + D / 2, z1 = zf - D / 2, Lr = z1 - z0;
  const xr = xp; // the rail's upright sits on the post line
  for (const sx of [-1, 1])
    parts.push({
      id: `SR${sx}`,
      name: "Side rail",
      size: [36, RH, Lr],
      pos: [sx * (xr - 16.5), RY0 + RH / 2, 0],
      material: "metal",
      rot: sx < 0 ? [0, Math.PI, 0] : undefined,
      pieces: [
        { shape: "box", size: [3, RH, Lr], pos: [16.5, 0, 0] },
        { shape: "box", size: [33, LIP, Lr], pos: [-1.5, -RH / 2 + LIP / 2, 0] },
      ],
    });

  // a flat brace across each corner, under the lips
  const reach = full ? 340 : 300;
  const braces = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ id: `BR${sx}${sz}`, sx, sz })));
  const braceY = RY0 + 10;
  for (const b of braces) {
    const ax = b.sx * (xr - 3), az = b.sz < 0 ? z0 + reach : z1 - reach; // on the rail
    const bx = b.sx * (xr - reach), bz = b.sz < 0 ? zh : zf; // on the end, under its bottom bar
    const len = Math.hypot(ax - bx, az - bz);
    parts.push({ id: b.id, name: "Corner brace", size: [len, 4, 30], pos: [(ax + bx) / 2, braceY, (az + bz) / 2], material: "metal", rot: [0, Math.atan2(-(az - bz), ax - bx), 0] });
  }
  const braceEnds = (onRail: boolean) =>
    braces.map((b): Vec3 => (onRail ? [b.sx * (xr - 20), braceY, b.sz < 0 ? z0 + reach - 12 : z1 - reach + 12] : [b.sx * (xr - reach + 12), braceY - 2, b.sz < 0 ? zh + 5 : zf - 5]));

  // felt strips along the lips, and the beam's
  const yLip = RY0 + LIP;
  const strips = (n: number, x: number, idp: string, w: number) =>
    Array.from({ length: n }, (_, i): CustomPart => {
      const len = (Lr - 40) / n - 20;
      return { id: `${idp}${i}`, name: "Felt strip", size: [w, 2, len], pos: [x, yLip + 1, z0 + 20 + (i + 0.5) * ((Lr - 40) / n)], material: "soft" };
    });
  const railStrips = [-1, 1].flatMap((sx) => strips(3, sx * (xr - 18), `ST${sx}_`, 25));
  parts.push(...railStrips);

  const beamTop = yLip;
  if (full) {
    parts.push({ id: "CB", name: "Centre beam", size: [50, 40, Lr], pos: [0, beamTop - 20, 0], material: "metal" });
    parts.push(...strips(3, 0, "SC", 40));
  }

  const inner = 2 * (xr - 3);
  const bases = full
    ? [-1, 1].map((sx) => ({ id: `SL${sx}`, x: (sx * inner) / 4 + sx * 6, w: inner / 2 - 40 }))
    : [{ id: "SL", x: 0, w: inner - 20 }];
  for (const r of bases) parts.push({ id: r.id, name: "Slatted bed base", size: [r.w, 14, Lr - 20], pos: [r.x, yLip + 2 + 7, 0], material: "wood", pieces: slatRoll(r.w, Lr - 20), extra: true });

  const studs = (sz: number): CustomFix[] =>
    [-1, 1].map((sx) => ({ ...STUD, count: 2, at: [RY0 + 15, RY0 + RH - 15].map((y): Vec3 => [sx * xp, y, sz < 0 ? z0 : z1]), dir: [0, 0, sz < 0 ? -1 : 1] as Vec3, on: sz < 0 ? "HF" : "FB" }));
  const clipDef = { kind: "clip" as const, name: "Base clip", len: 30, dia: 30 };

  const steps: CustomStep[] = [
    {
      title: "Push the legs into the head frame and the footboard",
      detail: "Lay both ends flat on a rug. The holes in each leg line up with the holes in the tube, so turn it until they match.",
      add: ["HF", "FB", "LG-1-1", "LG1-1", "LG-11", "LG11"],
      warnings: ["floor"],
      from: { "LG-1-1": [0, -200, 0], "LG1-1": [0, -200, 0], "LG-11": [0, -200, 0], "LG11": [0, -200, 0] },
    },
    {
      title: "Hang the side rails on the head frame",
      detail: "Screw two rail studs into each post with the crank key until the shoulder sits flat. Hook each rail's end over them and press down.",
      add: ["SR-1", "SR1"],
      fix: studs(-1),
      tools: ["wrench"],
    },
    {
      title: "Hang the footboard on the rails",
      detail: "Two rail studs in each post, the same way. Keep holding the rail ends until both hooks drop over the studs.",
      fix: studs(1),
      tools: ["wrench"],
    },
    {
      title: "Lower the headboard top onto the posts",
      detail: "Its tubes slide down over the head frame's posts. Line up the holes before you let go.",
      add: ["HT"],
      from: { HT: [0, 400, 0] },
    },
    {
      title: "Screw the top to the posts",
      detail: "Two screws in each post, from the outside. Leave them a little loose for now.",
      fix: [-1, 1].map((sx): CustomFix => ({ ...SCREW, count: 2, at: [HL - 25, HL + 25].map((y): Vec3 => [sx * (W / 2), y, zh]), dir: [-sx, 0, 0], on: "HT" })),
      tools: ["allen"],
    },
    {
      title: "Screw the top down from underneath",
      detail: "Three screws up through the head frame's top bar into the scroll panel. Then tighten the four in the posts.",
      fix: [{ ...SCREW, count: 3, at: [-xp * 0.35, 0, xp * 0.35].map((x): Vec3 => [x, HL - 30, zh]), dir: [0, 1, 0], on: "HF", mate: "HT" }],
      tools: ["allen"],
    },
    {
      title: "Screw the corner braces to the rails",
      detail: "One at each corner, its end on the rail's tab. One screw each, not tight yet.",
      add: braces.map((b) => b.id),
      fix: [{ ...SCREW, count: 4, at: braceEnds(true), dir: [0, -1, 0] }],
      tools: ["allen"],
    },
    {
      title: "Square the frame and screw the braces to the ends",
      detail: "Push the frame until both diagonals match, then screw the other end of each brace on and tighten all eight.",
      fix: [{ ...SCREW, count: 4, at: braceEnds(false), dir: [0, 1, 0] }], // up through the brace into the end's bottom bar
      tools: ["allen"],
      check: "square",
    },
    {
      title: "Tighten the rail studs",
      detail: "Go round all eight with the crank key so the rails pull tight against the posts.",
      tools: ["wrench"],
    },
  ];
  if (full)
    steps.push({
      title: "Pull out the centre beam and drop it in",
      detail: "Slide the beam out to length, keeping your fingers clear of the joint. Its ends drop into the slots in the head and foot bars.",
      add: ["CB"],
      from: { CB: [0, 300, 0] },
    });
  steps.push({
    title: "Stick the felt strips along the rails",
    detail: "Three on each rail's ledge, end to end. Peel the backing off as you go.",
    add: railStrips.map((p) => p.id),
  });
  if (full) steps.push({ title: "Stick three strips on the centre beam", detail: "Along its top, the same way.", add: ["SC0", "SC1", "SC2"] });
  steps.push({
    title: "Clip the base clips onto the rails",
    detail: "One near each corner. If a strip covers the slot, cut it away there first.",
    fix: [{ ...clipDef, count: 4, at: [-1, 1].flatMap((sx) => [z0 + 70, z1 - 70].map((z): Vec3 => [sx * (xr - 18), yLip + 2, z])), dir: [0, -1, 0] }],
  });
  if (full)
    steps.push({
      title: "Screw the clips onto the centre beam",
      detail: "Two at each end of the beam, one screw up into each from underneath.",
      fix: [
        { ...clipDef, name: "Centre clip", count: 4, at: [z0 + 70, z1 - 70].flatMap((z) => [-1, 1].map((d): Vec3 => [d * 15, beamTop + 2, z])), dir: [0, -1, 0], on: "CB" },
        { kind: "screw", count: 4, len: 10, dia: 4, at: [z0 + 70, z1 - 70].flatMap((z) => [-1, 1].map((d): Vec3 => [d * 15, beamTop - 40, z])), dir: [0, 1, 0], on: "CB" },
      ],
      tools: ["screwdriver"],
    });
  steps.push({
    title: full ? "Lay in the slatted bases" : "Lay in the slatted base",
    detail: full ? "One each side of the centre beam, sold separately. Fold the clips over their ends." : "Sold separately. Lay it on the ledges and fold the clips over its ends.",
    add: bases.map((b) => b.id),
    from: Object.fromEntries(bases.map((b) => [b.id, [0, 300, 0] as Vec3])),
  });
  return { parts, steps };
}

const family: Family = {
  names: ["MELLGRUND"],
  recipe,
};
export default family;
