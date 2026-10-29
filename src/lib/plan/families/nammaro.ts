import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { HwDef, PlanBuilder } from "../builder";
import { boxOf } from "../custom";
import { rotate } from "../math";

/**
 * NÄMMARÖ, read from IKEA's manuals: outdoor furniture in solid acacia, every seat, top and shelf made of slats on
 * battens that come ready joined. Tables are built upside down on a rug: the slatted top (two halves pinned together
 * on the long and round tables), rails or leg frames bolted on with barrel nuts, braces last, then turned over.
 * Chairs, benches and the modular sofa start from their side frames. The reclining chair is built folded flat, lying
 * on its back, then stood up and opened out. The folding chairs and the folding stool come ready assembled and have
 * no manual: their guides only unfold them.
 */

type Kind = CustomFix["kind"];
interface Pc {
  size: Vec3;
  pos: Vec3; // absolute, in the finished product
  rot?: Vec3;
  shape?: "box" | "cyl";
  material?: PartMaterial;
}

const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material?: PartMaterial): Pc => ({
  size: [x1 - x0, y1 - y0, z1 - z0],
  pos: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
  material,
});

/** A box from one end point to another (a brace, a leaning back post), turned about z or x to join them. */
function strut(a: Vec3, b: Vec3, w: number, t: number, axis: "z" | "x"): Pc {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const pos: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  if (axis === "z") return { size: [Math.hypot(dx, dy), w, t], pos, rot: [0, 0, Math.atan2(dy, dx)] };
  return { size: [t, w, Math.hypot(dz, dy)], pos, rot: [-Math.atan2(dy, dz), 0, 0] };
}

/** Slats laid side by side across an area, each running along x or z, with even gaps. */
function slats(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, n: number, along: "x" | "z", gap = 8): Pc[] {
  const span = along === "z" ? x1 - x0 : z1 - z0;
  const sw = (span - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => {
    const a = (along === "z" ? x0 : z0) + i * (sw + gap);
    return along === "z" ? box(a, a + sw, y0, y1, z0, z1) : box(x0, x1, y0, y1, a, a + sw);
  });
}

/** One part made of several boxes, given where each sits in the product: its bounding box becomes the part's. */
function group(id: string, name: string, pcs: Pc[], o: Partial<CustomPart> = {}): CustomPart {
  const bs = pcs.map((p) => boxOf(p));
  const lo: Vec3 = [0, 1, 2].map((k) => Math.min(...bs.map((b) => b.min[k]))) as Vec3;
  const hi: Vec3 = [0, 1, 2].map((k) => Math.max(...bs.map((b) => b.max[k]))) as Vec3;
  const pos: Vec3 = [0, 1, 2].map((k) => Math.round(((lo[k] + hi[k]) / 2) * 10) / 10) as Vec3;
  const size: Vec3 = [0, 1, 2].map((k) => Math.round((hi[k] - lo[k]) * 10) / 10) as Vec3;
  const pieces: PartPiece[] | undefined =
    pcs.length > 1
      ? pcs.map((p) => ({ shape: p.shape ?? "box", size: p.size, pos: [p.pos[0] - pos[0], p.pos[1] - pos[1], p.pos[2] - pos[2]], rot: p.rot, material: p.material }))
      : undefined;
  if (!pieces && pcs[0].rot) return { id, name, size: pcs[0].size, pos: pcs[0].pos, rot: pcs[0].rot, shape: pcs[0].shape, material: "wood", ...o };
  return { id, name, size: pieces ? size : pcs[0].size, pos: pieces ? pos : pcs[0].pos, shape: pieces ? undefined : pcs[0].shape, pieces, material: "wood", ...o };
}

const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: { len?: number; dia?: number } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });

// the fittings, by what they look like in the manuals
const SCREW = { len: 50, dia: 6 }; // Allen-head wood screw
const BOLT = { len: 90, dia: 6 }; // through a leg into a barrel nut
const SHORT = { len: 40, dia: 6 };
const LONG = { len: 110, dia: 8 };
const BARREL = { len: 30, dia: 10 };
const PIN = { len: 60, dia: 8 };
const SPACER = { len: 6, dia: 18 };
const ROD = { len: 80, dia: 8 };

/* ---------- tables ---------- */

/** The long tables (140 and 200): two slatted halves pinned together, two rails, a leg frame at each end, two braces. */
function longTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = Math.max(740, s.size.h * 10);
  const tt = 25, yT = H - tt; // underside of the top
  const lx = W / 2 - 90, lz = D / 2 - 70, lw = 45; // leg centres
  const rh = 80, rt = 28;
  const half = (sx: -1 | 1): CustomPart => {
    const x0 = sx < 0 ? -W / 2 : 0, x1 = sx < 0 ? 0 : W / 2;
    const fw = 50;
    const n = Math.round((W / 2 - fw) / 56);
    const pcs: Pc[] = [
      box(x0, x1, yT, H, -D / 2, -D / 2 + fw),
      box(x0, x1, yT, H, D / 2 - fw, D / 2),
      sx < 0 ? box(x0, x0 + fw, yT, H, -D / 2 + fw, D / 2 - fw) : box(x1 - fw, x1, yT, H, -D / 2 + fw, D / 2 - fw),
      ...slats(sx < 0 ? x0 + fw + 6 : x0 + 3, sx < 0 ? x1 - 3 : x1 - fw - 6, -D / 2 + fw, D / 2 - fw, yT + 4, H, n, "z"),
      box(sx < 0 ? x0 + fw : x0 + 20, sx < 0 ? x1 - 20 : x1 - fw, yT - 22, yT, -30, 30),
    ];
    return group(sx < 0 ? "TL" : "TR", "Table top half", pcs);
  };
  const rail = (sz: -1 | 1) => group(sz < 0 ? "C1" : "C2", "Rail", [box(-lx + lw / 2, lx - lw / 2, yT - rh, yT, sz * lz - rt / 2, sz * lz + rt / 2)]);
  const frame = (sx: -1 | 1) =>
    group(sx < 0 ? "L1" : "L2", "Leg frame", [
      box(sx * lx - lw / 2, sx * lx + lw / 2, 0, yT, -lz - lw / 2, -lz + lw / 2),
      box(sx * lx - lw / 2, sx * lx + lw / 2, 0, yT, lz - lw / 2, lz + lw / 2),
      box(sx * lx - rt / 2, sx * lx + rt / 2, yT - rh, yT, -lz + lw / 2, lz - lw / 2),
      box(sx * lx - rt / 2, sx * lx + rt / 2, 70, 130, -lz + lw / 2, lz - lw / 2),
    ]);
  const bx0 = lx - rt / 2, bx1 = 70; // braces: from the frame's foot rail up to the batten under the middle
  const brace = (sx: -1 | 1) => group(sx < 0 ? "B1" : "B2", "Brace", [strut([sx * bx0, 100, 0], [sx * bx1, yT - 22 - 25, 0], 50, 36, "z")]);
  const parts = [half(-1), half(1), rail(-1), rail(1), frame(-1), frame(1), brace(-1), brace(1)];

  const zs = [-1, 1] as const;
  const pinZ = [-D / 2 + 110, -D / 2 + 250, D / 2 - 250, D / 2 - 110];
  const railScrews = (sz: -1 | 1, sx: -1 | 1) => at("screw", [0.15, 0.5, 0.85].map((t) => [sx * (lx - 60) * t + sx * 30 * (1 - t), yT - rh, sz * lz] as Vec3), [0, 1, 0], sz < 0 ? "C1" : "C2", sx < 0 ? "TL" : "TR", SCREW);
  const endDowels = (sx: -1 | 1) => zs.flatMap((sz) => [yT - 20, yT - 60].map((y) => [sx * (lx - lw / 2), y, sz * lz] as Vec3));
  const frameSteps = (sx: -1 | 1, first: boolean): CustomStep[] => {
    const id = sx < 0 ? "L1" : "L2";
    return [
      { title: first ? "Push a leg frame onto the rail ends" : "Push the other leg frame on", detail: "Onto the dowels, with its feet pointing up.", add: [id] },
      {
        title: "Bolt the leg frame to the rails",
        detail: "Drop a barrel nut into the hole in each rail, slot facing the leg. Then turn a bolt in through the leg until it catches the nut.",
        fix: [
          at("nut", zs.map((sz) => [sx * (lx - lw / 2 - 40), yT - rh, sz * lz] as Vec3), [0, 1, 0], undefined, undefined, BARREL),
          at("bolt", zs.map((sz) => [sx * (lx + lw / 2), yT - rh / 2, sz * lz] as Vec3), [-sx, 0, 0], id, undefined, BOLT),
        ],
        tools: ["allen", "flathead"],
      },
      { title: "Screw the leg frame to the top", detail: "Three screws up through its top rail.", fix: [at("screw", [-D / 4, 0, D / 4].map((z) => [sx * lx, yT - rh, z] as Vec3), [0, 1, 0], id, sx < 0 ? "TL" : "TR", SCREW)], tools: ["allen"] },
    ];
  };
  const big = W >= 1800;
  const steps: CustomStep[] = [
    {
      title: "Fit the pins into one half of the top",
      detail: "Lay both halves face down on a rug. Push four metal pins into the edge of one, each with a spacer on it.",
      add: ["TL"],
      fix: [at("stud", pinZ.map((z) => [0, yT + tt / 2, z] as Vec3), [-1, 0, 0], "TL", "TR", PIN), at("washer", pinZ.map((z) => [0, yT + tt / 2, z] as Vec3), [-1, 0, 0], "TL", undefined, SPACER)],
      pose: "-y",
      warnings: big ? ["floor", "two"] : ["floor"],
      people: big ? 2 : 1,
    },
    { title: "Push the halves together", detail: "Slide the other half onto the pins until the edges meet all along.", add: ["TR"], from: { TR: [300, 0, 0] } },
    {
      title: "Tap the small dowels into the top",
      detail: "Four, into the holes near the long edges where the rails go.",
      fix: [at("dowel", zs.flatMap((sz) => [-1, 1].map((sx) => [sx * (lx - 160), yT, sz * lz] as Vec3)), [0, 1, 0], undefined, undefined, { len: 30, dia: 8 })],
      tools: ["hammer"],
    },
    { title: "Lay the rails onto the dowels", detail: "One along each long edge, the marked end the same way on both.", add: ["C1", "C2"] },
    { title: "Screw the rails to the top", detail: "Six screws through each rail. Turn them in, but not fully tight yet.", fix: [railScrews(-1, -1), railScrews(-1, 1), railScrews(1, -1), railScrews(1, 1)], tools: ["allen"] },
    { title: "Tap the long dowels into the rail ends", detail: "Two into each end of both rails.", fix: ([-1, 1] as const).flatMap((sx) => zs.map((sz) => at("dowel", endDowels(sx).filter((p) => p[2] === sz * lz), [-sx, 0, 0], sz < 0 ? "C1" : "C2", sx < 0 ? "L1" : "L2", { len: 40, dia: 8 }))), tools: ["hammer"] },
    ...frameSteps(-1, true),
    ...frameSteps(1, false),
    {
      title: "Put the braces in",
      detail: "Their feet rest against the leg frames, the top ends meet under the middle. A bolt down through each top end into the batten.",
      add: ["B1", "B2"],
      fix: [at("bolt", [-1, 1].map((sx) => [sx * (bx1 + 30), yT - 22, 0] as Vec3), [0, 1, 0], undefined, undefined, SHORT)],
      tools: ["allen"],
    },
    {
      title: "Bolt the braces to the leg frames",
      detail: "A barrel nut into the side of each brace foot, then a bolt in through the frame's foot rail.",
      fix: [
        at("nut", [-1, 1].map((sx) => [sx * (bx0 - 40), 100, 18] as Vec3), [0, 0, -1], undefined, undefined, BARREL),
        at("bolt", [[-(lx + rt / 2), 100, 0]], [1, 0, 0], "L1", "B1", SHORT),
        at("bolt", [[lx + rt / 2, 100, 0]], [-1, 0, 0], "L2", "B2", SHORT),
      ],
      tools: ["allen", "flathead"],
    },
    ...([-1, 1] as const).map(
      (sx, i): CustomStep => ({
        title: i ? "Bolt the other brace on the same way" : "Bolt one brace to the batten",
        detail: "The long bolt goes through the brace with a round spacer on each side, then a washer and the nut. Hold the nut with the spanner.",
        fix: [
          at("bolt", [[sx * (bx1 + 40), yT - 60, 30]], [0, 0, -1], sx < 0 ? "B1" : "B2", undefined, LONG),
          at("connector", [[sx * (bx1 + 40), yT - 60, 28], [sx * (bx1 + 40), yT - 60, -28]], [0, 0, -1], undefined, undefined, { len: 14, dia: 30 }),
          at("washer", [[sx * (bx1 + 40), yT - 60, -40]], [0, 0, 1], undefined, undefined, { len: 2, dia: 16 }),
          at("nut", [[sx * (bx1 + 40), yT - 60, -44]], [0, 0, 1], undefined, undefined, { len: 8, dia: 8 }),
        ],
        tools: ["allen", "wrench"],
      }),
    ),
    { title: big ? "Turn the table over together" : "Turn the table over", detail: "Lift it by the frames onto its feet, then tighten every screw once it stands level.", pose: "+y", people: big ? 2 : 1, warnings: big ? ["two"] : [] },
  ];
  return { parts, steps };
}

/** The small square table: four legs on threaded rods, nutted up into the corner brackets of the ready-made top. */
function smallTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25, yT = H - tt, fw = 45, ah = 70, lw = 45;
  const n = Math.round((W - 2 * fw) / 56);
  const top = group("T", "Table top", [
    box(-W / 2, W / 2, yT, H, -D / 2, -D / 2 + fw),
    box(-W / 2, W / 2, yT, H, D / 2 - fw, D / 2),
    box(-W / 2, -W / 2 + fw, yT, H, -D / 2 + fw, D / 2 - fw),
    box(W / 2 - fw, W / 2, yT, H, -D / 2 + fw, D / 2 - fw),
    ...slats(-W / 2 + fw + 4, W / 2 - fw - 4, -D / 2 + fw, D / 2 - fw, yT + 4, H, n, "z"),
    // the apron under the edge, ready fixed
    box(-W / 2 + 25, W / 2 - 25, yT - ah, yT, -D / 2 + 25, -D / 2 + 47),
    box(-W / 2 + 25, W / 2 - 25, yT - ah, yT, D / 2 - 47, D / 2 - 25),
    box(-W / 2 + 25, -W / 2 + 47, yT - ah, yT, -D / 2 + 47, D / 2 - 47),
    box(W / 2 - 47, W / 2 - 25, yT - ah, yT, -D / 2 + 47, D / 2 - 47),
  ]);
  const lx = W / 2 - 47 - lw / 2, lz = D / 2 - 47 - lw / 2;
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  const legs = corners.map(([sx, sz], i) => group(`L${i}`, "Leg", [box(sx * lx - lw / 2, sx * lx + lw / 2, 0, yT, sz * lz - lw / 2, sz * lz + lw / 2)]));
  const steps: CustomStep[] = [
    {
      title: "Fit a threaded rod into each leg",
      detail: "Push a barrel nut into the hole in the side of the leg, slot up. Turn the rod in from the top end until it stops.",
      fix: [
        ...corners.map(([sx, sz], i) => at("nut", [[sx * (lx + lw / 2), yT - 40, sz * lz]], [-sx, 0, 0], `L${i}`, undefined, BARREL)),
        ...corners.map(([sx, sz], i) => at("legScrew", [[sx * lx, yT, sz * lz]], [0, -1, 0], `L${i}`, "T", ROD)),
      ],
      tools: ["flathead"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Lay the top face down and set the legs in its corners", detail: "Each rod goes up through the hole in the corner bracket.", add: ["T", ...legs.map((l) => l.id)] },
    {
      title: "Tighten the legs with the spanner",
      detail: "A washer and a nut on each rod, inside the corner. Tighten them until the leg sits firm against the apron.",
      fix: [
        at("washer", corners.map(([sx, sz]) => [sx * (lx - 40), yT - 30, sz * (lz - 40)] as Vec3), [0, -1, 0], "T", undefined, { len: 2, dia: 16 }),
        at("nut", corners.map(([sx, sz]) => [sx * (lx - 40), yT - 32, sz * (lz - 40)] as Vec3), [0, -1, 0], "T", undefined, { len: 8, dia: 8 }),
      ],
      tools: ["wrench"],
    },
    { title: "Turn the table over", detail: "Stand it on its feet and check it doesn't rock.", pose: "+y" },
  ];
  return { parts: [top, ...legs], steps };
}

/** The round table: two halves pinned together, two battens across the join, then four leg frames in a square, bolted to each other. */
function roundTable(s: ProductSpec): CustomParams {
  const R = (s.size.w * 10) / 2, H = s.size.h * 10;
  const tt = 25, yT = H - tt, bt = 22, rh = 60, rt = 30, pw = 45;
  const e = 110, rl = 450, fl = 470; // frames' offset from the middle, half their rail, how far the feet reach
  const sw = 50, gap = 8;
  // the slats run parallel to the join, each cut to the circle
  const n = Math.floor(R / (sw + gap));
  const half = (sz: -1 | 1) => {
    const pcs: Pc[] = [];
    for (let i = 0; i < n; i++) {
      const a = 4 + i * (sw + gap), b = a + sw;
      if (b >= R - 10) continue;
      const L = Math.sqrt(R * R - b * b);
      pcs.push(box(-L, L, yT, H, sz < 0 ? -b : a, sz < 0 ? -a : b));
    }
    return group(sz < 0 ? "TB" : "TF", "Table top half", pcs);
  };
  const bz = Math.sqrt(R * R - 275 * 275) - 60;
  const batten = (sx: -1 | 1) => group(sx < 0 ? "N1" : "N2", "Batten", [box(sx * 250 - 25, sx * 250 + 25, yT - bt, yT, -bz, bz)]);
  // frames A and B run along x under the battens, C and D along z one rail lower; each post stands beside a post of the crossing frame
  const yA = yT - bt, yC = yA - rh;
  const frameX = (id: string, sz: -1 | 1) =>
    group(id, "Leg frame", [
      box(-rl, rl, yA - rh, yA, sz * e - rt / 2, sz * e + rt / 2),
      ...[-1, 1].flatMap((sx) => [
        box(sx * (e + pw) - pw / 2, sx * (e + pw) + pw / 2, 40, yA - rh, sz * e - pw / 2, sz * e + pw / 2),
        sx < 0 ? box(-fl, -(e + pw / 2), 0, 40, sz * e - 20, sz * e + 20) : box(e + pw / 2, fl, 0, 40, sz * e - 20, sz * e + 20),
      ]),
    ]);
  const frameZ = (id: string, sx: -1 | 1) =>
    group(id, "Leg frame", [
      box(sx * e - rt / 2, sx * e + rt / 2, yC - rh, yC, -rl, rl),
      ...[-1, 1].flatMap((sz) => [
        box(sx * e - pw / 2, sx * e + pw / 2, 40, yC - rh, sz * e - pw / 2, sz * e + pw / 2),
        sz < 0 ? box(sx * e - 20, sx * e + 20, 0, 40, -fl, -(e - pw / 2)) : box(sx * e - 20, sx * e + 20, 0, 40, e - pw / 2, fl),
      ]),
    ]);
  const parts = [half(-1), half(1), batten(-1), batten(1), frameX("A", -1), frameX("B", 1), frameZ("C", 1), frameZ("D", -1)];
  const pinX = [-450, -270, -90, 90, 270, 450];
  const up = (pts: Vec3[], on: string, mate?: string) => at("bolt", pts, [0, 1, 0], on, mate, SHORT);
  const join = (zId: string, xId: string, sx: -1 | 1, sz: -1 | 1): CustomFix[] => [
    at("nut", [yA - 200, 200].map((y) => [sx * e, y, sz * (e + pw / 2)] as Vec3), [0, 0, -sz], zId, undefined, BARREL),
    at("bolt", [yA - 200, 200].map((y) => [sx * (e + pw * 1.5), y, sz * e] as Vec3), [-sx, 0, 0], xId, zId, LONG),
  ];
  const steps: CustomStep[] = [
    {
      title: "Pin the two halves of the top together",
      detail: "Face down on a rug. Six metal pins with a spacer each go into the straight edge of one half, then push the other half on.",
      add: ["TB", "TF"],
      fix: [at("stud", pinX.map((x) => [x, yT + tt / 2, 0] as Vec3), [0, 0, -1], "TB", "TF", PIN), at("washer", pinX.map((x) => [x, yT + tt / 2, 0] as Vec3), [0, 0, -1], "TB", undefined, SPACER)],
      from: { TF: [0, 0, 300] },
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Screw the two battens across the join",
      detail: "They hold the halves together. Two screws in each, not fully tight yet.",
      add: ["N1", "N2"],
      fix: ([-1, 1] as const).map((sx) => at("screw", [-bz + 80, bz - 80].map((z) => [sx * 250, yT - bt, z] as Vec3), [0, 1, 0], sx < 0 ? "N1" : "N2", undefined, { len: 20, dia: 6 })),
      tools: ["allen"],
    },
    { title: "Bolt the first leg frame onto the battens", detail: "Its rail lies across both battens. One bolt at each crossing.", add: ["A"], fix: [up([-250, 250].map((x) => [x, yA - rh, -e] as Vec3), "A")], tools: ["allen"] },
    { title: "Bolt the second leg frame on beside it", detail: "Parallel to the first, the same way round.", add: ["B"], fix: [up([-250, 250].map((x) => [x, yA - rh, e] as Vec3), "B")], tools: ["allen"] },
    { title: "Lay the third frame across the first two", detail: "Its rail sits under theirs, its posts against theirs. A bolt up into each rail.", add: ["C"], fix: [up([-e, e].map((z) => [e, yC - rh, z] as Vec3), "C")], tools: ["allen"] },
    { title: "Bolt its post to the first frame", detail: "Two barrel nuts into the post, slots facing the bolts, then two long bolts in through the other post.", fix: join("C", "A", 1, -1), tools: ["allen", "flathead"] },
    { title: "Bolt the other post the same way", detail: "Two barrel nuts and two long bolts, into the second frame.", fix: join("C", "B", 1, 1), tools: ["allen", "flathead"] },
    { title: "Lay the last frame across", detail: "Parallel to the third one, a bolt up into each rail.", add: ["D"], fix: [up([-e, e].map((z) => [-e, yC - rh, z] as Vec3), "D")], tools: ["allen"] },
    { title: "Bolt its post to the first frame", detail: "Barrel nuts first, then the long bolts.", fix: join("D", "A", -1, -1), tools: ["allen", "flathead"] },
    { title: "Bolt its other post", detail: "That closes the square in the middle.", fix: join("D", "B", -1, 1), tools: ["allen", "flathead"] },
    { title: "Tighten all the bolts", detail: "All sixteen in the frames, then the battens' screws. Go round twice.", tools: ["allen"], check: "square" },
    { title: "Turn the table over together", detail: "Lift it onto its feet by the frames, not by the edge of the top.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts, steps };
}

/* ---------- benches, stools and the bar table ---------- */

/** A leg frame standing across the depth: two legs, a rail under the top and one low down. */
function legFrame(id: string, x: number, lz: number, lw: number, yTop: number, rh: number, rt: number, yLow: [number, number], name = "Leg frame") {
  return group(id, name, [
    box(x - lw / 2, x + lw / 2, 0, yTop, -lz - lw / 2, -lz + lw / 2),
    box(x - lw / 2, x + lw / 2, 0, yTop, lz - lw / 2, lz + lw / 2),
    box(x - rt / 2, x + rt / 2, yTop - rh, yTop, -lz + lw / 2, lz - lw / 2),
    box(x - rt / 2, x + rt / 2, yLow[0], yLow[1], -lz + lw / 2, lz - lw / 2),
  ]);
}

/** A slatted top or seat with a border all round, the slats running front to back. */
function slatTop(id: string, name: string, W: number, D: number, y0: number, y1: number, fw = 45): CustomPart {
  const n = Math.round((W - 2 * fw) / 56);
  return group(id, name, [
    box(-W / 2, W / 2, y0, y1, -D / 2, -D / 2 + fw),
    box(-W / 2, W / 2, y0, y1, D / 2 - fw, D / 2),
    box(-W / 2, -W / 2 + fw, y0, y1, -D / 2 + fw, D / 2 - fw),
    box(W / 2 - fw, W / 2, y0, y1, -D / 2 + fw, D / 2 - fw),
    ...slats(-W / 2 + fw + 4, W / 2 - fw - 4, -D / 2 + fw, D / 2 - fw, y0 + 4, y1, n, "z"),
  ]);
}

/** The backless bench: like the long table, with one seat and a pair of braces bolted to a block in the middle. */
function bench(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25, yS = H - tt, lw = 45, rh = 70, rt = 28;
  const lx = W / 2 - 70, lz = D / 2 - 45;
  const zs = [-1, 1] as const;
  const parts: CustomPart[] = [
    slatTop("S", "Seat", W, D, yS, H),
    ...zs.map((sz) => group(sz < 0 ? "C1" : "C2", "Rail", [box(-lx + lw / 2, lx - lw / 2, yS - rh, yS, sz * lz - rt / 2, sz * lz + rt / 2)])),
    legFrame("L1", -lx, lz, lw, yS, rh, rt, [60, 110]),
    legFrame("L2", lx, lz, lw, yS, rh, rt, [60, 110]),
    group("K", "Middle block", [box(-40, 40, yS - 60, yS, -25, 25)]),
    ...([-1, 1] as const).map((sx) => group(sx < 0 ? "B1" : "B2", "Brace", [strut([sx * (lx - rt / 2), 85, 0], [sx * 40, yS - 40, 0], 45, 30, "z")])),
  ];
  const railScrews = zs.map((sz) => at("screw", [-0.75, -0.25, 0.25, 0.75].map((t) => [t * (lx - 40), yS - rh, sz * lz] as Vec3), [0, 1, 0], sz < 0 ? "C1" : "C2", "S", SCREW));
  const endDowels = ([-1, 1] as const).flatMap((sx) => zs.map((sz) => at("dowel", [yS - 20, yS - 50].map((y) => [sx * (lx - lw / 2), y, sz * lz] as Vec3), [-sx, 0, 0], sz < 0 ? "C1" : "C2", undefined, { len: 40, dia: 8 })));
  const steps: CustomStep[] = [
    { title: "Tap the small dowels into the seat", detail: "Lay it face down on a rug. Four dowels go into the holes along the long edges.", add: ["S"], fix: [at("dowel", zs.flatMap((sz) => [-1, 1].map((sx) => [sx * (lx - 150), yS, sz * lz] as Vec3)), [0, 1, 0], "S", undefined, { len: 30, dia: 8 })], tools: ["hammer"], pose: "-y", warnings: ["floor"] },
    { title: "Lay the rails onto the dowels", detail: "One along each long edge, the marked side the same way.", add: ["C1", "C2"] },
    { title: "Screw the rails to the seat", detail: "Four screws through each rail.", fix: railScrews, tools: ["allen"] },
    { title: "Tap the long dowels into the rail ends", detail: "Two into each end.", fix: endDowels, tools: ["hammer"] },
    { title: "Push the leg frames onto the rail ends", detail: "One at each end, feet pointing up.", add: ["L1", "L2"], from: { L1: [-300, 0, 0], L2: [300, 0, 0] } },
    {
      title: "Bolt the two braces to the middle block",
      detail: "The long bolt goes through one brace, the block and the other brace, then a washer and the nut. Leave it a little loose.",
      add: ["K", "B1", "B2"],
      fix: [at("bolt", [[0, yS - 35, 40]], [0, 0, -1], "K", undefined, LONG), at("washer", [[0, yS - 35, -40]], [0, 0, 1], "K", undefined, { len: 2, dia: 16 }), at("nut", [[0, yS - 35, -44]], [0, 0, 1], "K", undefined, { len: 8, dia: 8 })],
      tools: ["allen", "wrench"],
    },
    { title: "Screw the block to the seat", detail: "Set the braces in with their feet against the leg frames. Two screws through the block.", fix: [at("screw", [-20, 20].map((x) => [x, yS - 60, 0] as Vec3), [0, 1, 0], "K", "S", SCREW)], tools: ["allen"] },
    {
      title: "Screw the brace feet to the leg frames",
      detail: "A barrel nut into the side of each foot, then a screw in through the frame's low rail.",
      fix: [at("nut", [-1, 1].map((sx) => [sx * (lx - 60), 85, 15] as Vec3), [0, 0, -1], undefined, undefined, BARREL), at("screw", [[-(lx + rt / 2), 85, 0]], [1, 0, 0], "L1", "B1", SCREW), at("screw", [[lx + rt / 2, 85, 0]], [-1, 0, 0], "L2", "B2", SCREW)],
      tools: ["allen", "flathead"],
    },
    { title: "Tighten the middle bolt", detail: "Hold the nut with the spanner and turn the bolt with the Allen key.", tools: ["allen", "wrench"] },
    { title: "Screw the leg frames to the seat", detail: "Two screws up through each frame's top rail.", fix: ([-1, 1] as const).map((sx) => at("screw", zs.map((sz) => [sx * lx, yS - rh, (sz * lz) / 2] as Vec3), [0, 1, 0], sx < 0 ? "L1" : "L2", "S", SCREW)), tools: ["allen"] },
    {
      title: "Bolt the leg frames to the rails",
      detail: "A barrel nut into each rail, slot towards the leg, then a bolt in through the leg.",
      fix: [at("nut", ([-1, 1] as const).flatMap((sx) => zs.map((sz) => [sx * (lx - lw / 2 - 40), yS - rh, sz * lz] as Vec3)), [0, 1, 0], undefined, undefined, BARREL), ...([-1, 1] as const).map((sx) => at("bolt", zs.map((sz) => [sx * (lx + lw / 2), yS - rh / 2, sz * lz] as Vec3), [-sx, 0, 0], sx < 0 ? "L1" : "L2", undefined, BOLT))],
      tools: ["allen", "flathead"],
    },
    { title: "Turn the bench over", detail: "Stand it on its feet and check every bolt is tight.", pose: "+y" },
  ];
  return { parts, steps };
}

/** The bar stool: a seat on two rails, a leg frame each side, a footrest and a stretcher between them. */
function barStool(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25, yS = H - tt, lw = 40, rh = 60, rt = 24;
  const lx = W / 2 - lw / 2, lz = D / 2 - lw / 2;
  const zs = [-1, 1] as const;
  const parts: CustomPart[] = [
    slatTop("S", "Seat", W, D, yS, H, 40),
    ...zs.map((sz) => group(sz < 0 ? "C1" : "C2", "Rail", [box(-lx + lw / 2, lx - lw / 2, yS - rh, yS, sz * (lz) - rt / 2, sz * lz + rt / 2)])),
    legFrame("L1", -lx, lz, lw, yS, rh, rt, [230, 280]),
    legFrame("L2", lx, lz, lw, yS, rh, rt, [230, 280]),
    { id: "F", name: "Footrest", size: [W - 2 * lw, 22, 22], pos: [0, 255, lz], shape: "cyl", material: "metal" },
    group("X", "Stretcher", [box(-lx + lw / 2, lx - lw / 2, 230, 280, -lz - rt / 2, -lz + rt / 2)]),
  ];
  const nut = (pts: Vec3[]) => at("nut", pts, [0, 1, 0], undefined, undefined, BARREL);
  const bolt = (sx: -1 | 1, pts: Vec3[]) => at("bolt", pts, [-sx, 0, 0], sx < 0 ? "L1" : "L2", undefined, BOLT);
  const top = (sx: -1 | 1) => zs.map((sz) => [sx * lx, yS - rh / 2, sz * lz] as Vec3);
  const steps: CustomStep[] = [
    { title: "Tap the small dowels into the seat", detail: "Lay it face down on a rug. Four dowels into the holes along two edges.", add: ["S"], fix: [at("dowel", zs.flatMap((sz) => [-1, 1].map((sx) => [sx * 90, yS, sz * lz] as Vec3)), [0, 1, 0], "S", undefined, { len: 30, dia: 8 })], tools: ["hammer"], pose: "-y", warnings: ["floor"] },
    { title: "Lay the two rails onto the dowels", detail: "Marked side the same way on both.", add: ["C1", "C2"] },
    { title: "Screw the rails to the seat", detail: "Two screws through each rail.", fix: [at("screw", zs.flatMap((sz) => [-60, 60].map((x) => [x, yS - rh, sz * lz] as Vec3)), [0, 1, 0], undefined, "S", SCREW)], tools: ["allen"] },
    { title: "Tap the long dowels into the rail ends", detail: "Two into one end of each rail.", fix: zs.map((sz) => at("dowel", [yS - 15, yS - 45].map((y) => [-(lx - lw / 2), y, sz * lz] as Vec3), [1, 0, 0], sz < 0 ? "C1" : "C2", undefined, { len: 40, dia: 8 })), tools: ["hammer"] },
    { title: "Push a leg frame onto the rail ends", detail: "Feet pointing up.", add: ["L1"], from: { L1: [-300, 0, 0] } },
    { title: "Bolt the leg frame to the rails", detail: "A barrel nut into each rail, then a bolt in through the leg.", fix: [nut(zs.map((sz) => [-(lx - 60), yS - rh, sz * lz] as Vec3)), bolt(-1, top(-1).map((p) => [p[0] - lw / 2, p[1], p[2]] as Vec3))], tools: ["allen", "flathead"] },
    { title: "Push the footrest into the leg frame", detail: "Its end hooks into the slot in the front leg.", add: ["F"] },
    { title: "Bolt the footrest on", detail: "One barrel nut and one bolt.", fix: [nut([[-(lx - 60), 244, lz]]), bolt(-1, [[-W / 2, 255, lz]])], tools: ["allen", "flathead"] },
    { title: "Push the stretcher into the back leg", detail: "At the same height as the footrest.", add: ["X"] },
    { title: "Bolt the stretcher on", detail: "One barrel nut and one bolt.", fix: [nut([[-(lx - 60), 230, -lz]]), bolt(-1, [[-W / 2, 255, -lz]])], tools: ["allen", "flathead"] },
    { title: "Push the other leg frame on", detail: "Tap two dowels into the other rail ends first, then press the frame onto them and the footrest.", add: ["L2"], fix: zs.map((sz) => at("dowel", [yS - 15, yS - 45].map((y) => [lx - lw / 2, y, sz * lz] as Vec3), [-1, 0, 0], sz < 0 ? "C1" : "C2", "L2", { len: 40, dia: 8 })), tools: ["hammer"] },
    {
      title: "Bolt the second frame on",
      detail: "Four barrel nuts and bolts: the two rails, the footrest and the stretcher. Then turn the stool over.",
      fix: [nut([...zs.map((sz) => [lx - 60, yS - rh, sz * lz] as Vec3), [lx - 60, 244, lz], [lx - 60, 230, -lz]]), bolt(1, [...top(1).map((p) => [p[0] + lw / 2, p[1], p[2]] as Vec3), [W / 2, 255, lz], [W / 2, 255, -lz]])],
      tools: ["allen", "flathead"],
    },
    { title: "Stand the stool up", detail: "Check it stands without rocking.", pose: "+y" },
  ];
  return { parts, steps };
}

/** The bar table: legs nutted onto the ready-made top, side stretchers and a long one between them. */
function barTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25, yT = H - tt, fw = 45, ah = 70, lw = 45;
  const n = Math.round((W - 2 * fw) / 56);
  const top = group("T", "Table top", [
    box(-W / 2, W / 2, yT, H, -D / 2, -D / 2 + fw),
    box(-W / 2, W / 2, yT, H, D / 2 - fw, D / 2),
    box(-W / 2, -W / 2 + fw, yT, H, -D / 2 + fw, D / 2 - fw),
    box(W / 2 - fw, W / 2, yT, H, -D / 2 + fw, D / 2 - fw),
    ...slats(-W / 2 + fw + 4, W / 2 - fw - 4, -D / 2 + fw, D / 2 - fw, yT + 4, H, n, "z"),
    box(-W / 2 + 25 + lw, W / 2 - 25 - lw, yT - ah, yT, -D / 2 + 25, -D / 2 + 47),
    box(-W / 2 + 25 + lw, W / 2 - 25 - lw, yT - ah, yT, D / 2 - 47, D / 2 - 25),
  ]);
  const lx = W / 2 - 25 - lw / 2, lz = D / 2 - 25 - lw / 2;
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  const legs = corners.map(([sx, sz], i) => group(`L${i}`, "Leg", [box(sx * lx - lw / 2, sx * lx + lw / 2, 0, yT, sz * lz - lw / 2, sz * lz + lw / 2)]));
  const yl: [number, number] = [230, 280];
  const sides = ([-1, 1] as const).map((sx) => group(sx < 0 ? "S1" : "S2", "Side stretcher", [box(sx * lx - 14, sx * lx + 14, yl[0], yl[1], -lz + lw / 2, lz - lw / 2)]));
  const long = group("X", "Long stretcher", [box(-lx + 14, lx - 14, yl[0], yl[1], -14, 14)]);
  const ym = (yl[0] + yl[1]) / 2;
  const nuts = (idx: number[]) => at("washer", idx.map((i) => [corners[i][0] * (lx - 40), yT - 30, corners[i][1] * (lz - 40)] as Vec3), [0, -1, 0], "T", undefined, { len: 2, dia: 16 });
  const nuts2 = (idx: number[]) => at("nut", idx.map((i) => [corners[i][0] * (lx - 40), yT - 32, corners[i][1] * (lz - 40)] as Vec3), [0, -1, 0], "T", undefined, { len: 8, dia: 8 });
  const sideBolts = (sx: -1 | 1): CustomFix[] => [
    at("nut", [-1, 1].map((sz) => [sx * lx, yl[0], sz * (lz - lw / 2 - 40)] as Vec3), [0, 1, 0], sx < 0 ? "S1" : "S2", undefined, BARREL),
    ...([-1, 1] as const).map((sz) => at("bolt", [[sx * lx, ym, sz * (lz + lw / 2)]], [0, 0, -sz], `L${corners.findIndex(([a, b]) => a === sx && b === sz)}`, sx < 0 ? "S1" : "S2", BOLT)),
  ];
  const steps: CustomStep[] = [
    {
      title: "Fit a threaded rod into each leg",
      detail: "Lay the legs on a rug. A barrel nut into the hole near the top, slot up, then turn a rod in until it stops.",
      fix: corners.flatMap(([sx, sz], i) => [at("nut", [[sx * (lx + lw / 2), yT - 40, sz * lz]], [-sx, 0, 0], `L${i}`, undefined, BARREL), at("legScrew", [[sx * lx, yT, sz * lz]], [0, -1, 0], `L${i}`, "T", ROD)]),
      tools: ["flathead"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Lay the top face down and set the legs in its corners", detail: "Each rod goes through the hole in a corner bracket.", add: ["T", ...legs.map((l) => l.id)] },
    { title: "Nut two legs at one end", detail: "A washer and a nut on each rod, done up with the spanner.", fix: [nuts([0, 1]), nuts2([0, 1])], tools: ["wrench"] },
    { title: "Push a side stretcher between them", detail: "Low down, its ends into the slots in the legs.", add: ["S1"] },
    { title: "Bolt the side stretcher to its legs", detail: "A barrel nut into the stretcher at each end, then a bolt in through each leg.", fix: sideBolts(-1), tools: ["allen", "flathead"] },
    { title: "Tap two dowels into the long stretcher", detail: "Into its far end.", fix: [at("dowel", [ym - 12, ym + 12].map((y) => [lx - 14, y, 0] as Vec3), [-1, 0, 0], "X", "S2", { len: 40, dia: 8 })], tools: ["hammer"] },
    { title: "Push the long stretcher into the side stretcher", detail: "Then a barrel nut and a bolt through the side stretcher into its end.", add: ["X"], fix: [at("nut", [[-lx + 60, yl[0], 0]], [0, 1, 0], "X", undefined, BARREL), at("bolt", [[-lx - 14, ym, 0]], [1, 0, 0], "S1", "X", BOLT)], tools: ["allen", "flathead"] },
    { title: "Fit the other side stretcher", detail: "Onto the dowels in the long stretcher and into the slots of the last two legs.", add: ["S2"] },
    { title: "Nut the last two legs", detail: "Washers and nuts, done up with the spanner.", fix: [nuts([2, 3]), nuts2([2, 3])], tools: ["wrench"] },
    {
      title: "Bolt the second side stretcher on",
      detail: "Barrel nuts first, then the bolts through the legs and one into the end of the long stretcher.",
      fix: [...sideBolts(1), at("nut", [[lx - 60, yl[0], 0]], [0, 1, 0], "X", undefined, BARREL), at("bolt", [[lx + 14, ym, 0]], [-1, 0, 0], "S2", "X", BOLT)],
      tools: ["allen", "flathead"],
    },
    { title: "Turn the table over together", detail: "Tighten all the nuts and bolts once it stands on its feet.", pose: "+y", people: 2, warnings: ["two"] },
  ];
  return { parts: [top, ...legs, ...sides, long], steps };
}

/* ---------- chairs and the bench with a backrest ---------- */

interface Armed {
  seatY: number;
  armY: number;
  tilt: number; // the backrest's lean, radians
  seatScrews: number;
  backDowels: number; // dowels where the backrest meets the seat (the bench's two halves)
  sideScrew: boolean; // a screw and barrel nut more on each side frame
}

/**
 * The armchair, the lounge chair and the bench with a backrest share one build: the seat gets its back rail, the
 * backrest is bolted to it and the front rail goes in, then it lies on one side for the first side frame and is
 * turned over for the other, and stood up to tighten everything.
 */
function armed(s: ProductSpec, o: Armed): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const { seatY, armY, tilt } = o;
  const lw = 45, hw = W / 2;
  const base = seatY - 85;
  const zbl = -D / 2 + 0.8 * (H - base) * Math.tan(tilt); // the back legs, in front of the backrest's lean
  const zs0 = zbl + 8, zf = D / 2 - 30;
  const zFR = zf - 14, zBR = zs0 + 14;
  const side = (id: string, sx: -1 | 1) =>
    group(id, "Side frame", [
      box(sx * hw - (sx > 0 ? lw : 0), sx * hw + (sx < 0 ? lw : 0), 0, armY - 30, zbl, zbl + lw),
      box(sx * hw - (sx > 0 ? lw : 0), sx * hw + (sx < 0 ? lw : 0), 0, armY - 30, D / 2 - lw, D / 2),
      box(sx * hw - (sx > 0 ? 55 : 0), sx * hw + (sx < 0 ? 55 : 0), armY - 30, armY, zbl, D / 2 + 10),
      box(sx * hw - (sx > 0 ? 36 : 8), sx * hw + (sx < 0 ? 36 : -8), 60, 110, zbl + lw, D / 2 - lw),
    ]);
  const inner = hw - lw;
  const nSeat = Math.round((zf - zs0) / 58);
  const battenX = o.backDowels ? [-inner + 20, 0, inner - 20] : [-inner + 20, inner - 20];
  const seat = group("S", "Seat", [
    ...slats(-inner, inner, zs0, zf, seatY - 20, seatY, nSeat, "x", 10),
    ...battenX.map((x) => box(x - 20, x + 20, seatY - 50, seatY - 20, zs0 + 28, zf - 28)),
  ]);
  const rail = (id: string, name: string, z: number) => group(id, name, [box(-inner, inner, seatY - 85, seatY - 25, z - 14, z + 14)]);
  // the backrest: stiles leaning back from behind the back rail, slats across their front
  const u: Vec3 = [0, Math.cos(tilt), -Math.sin(tilt)], nrm: Vec3 = [0, Math.sin(tilt), Math.cos(tilt)];
  const L = (H - base) / Math.cos(tilt);
  const b0: Vec3 = [0, base, zbl - 7];
  const along = (t: number, off: number): Vec3 => [0, b0[1] + u[1] * t + nrm[1] * off, b0[2] + u[2] * t + nrm[2] * off];
  const stileX = o.backDowels ? [-inner + 20, 0, inner - 20] : [-inner + 20, inner - 20];
  const t0 = (seatY + 40 - base) / Math.cos(tilt);
  const nb = Math.max(4, Math.round((L - t0) / 75));
  const sh = (L - t0 - 20 - (nb - 1) * 18) / nb;
  const backPcs: Pc[] = [
    ...stileX.map((x): Pc => {
      const c = along(L / 2, 0);
      return { size: [40, L, 30], pos: [x, c[1], c[2]], rot: [-tilt, 0, 0] };
    }),
    ...Array.from({ length: nb }, (_, i): Pc => {
      const c = along(t0 + i * (sh + 18) + sh / 2, 24);
      return { size: [2 * inner, sh, 18], pos: [0, c[1], c[2]], rot: [-tilt, 0, 0] };
    }),
  ];
  const parts: CustomPart[] = [seat, rail("BR", "Back rail", zBR), group("K", "Backrest", backPcs), rail("FR", "Front rail", zFR), side("SL", -1), side("SR", 1)];
  const ys = seatY - 55;
  const sideFix = (sx: -1 | 1): CustomFix[] => {
    const id = sx < 0 ? "SL" : "SR";
    return [
      at("bolt", [[sx * hw, seatY - 38, zbl + 22]], [-sx, 0, 0], id, "BR", SHORT),
      at("washer", [[sx * hw, seatY - 38, zbl + 22]], [-sx, 0, 0], id, undefined, { len: 2, dia: 18 }),
      ...(o.sideScrew ? [at("screw", [[sx * hw, seatY - 38, zFR]], [-sx, 0, 0], id, "FR", SCREW)] : []),
    ];
  };
  const sideBolts = (sx: -1 | 1): CustomFix[] => {
    const id = sx < 0 ? "SL" : "SR";
    const nz = o.sideScrew ? [zBR, zFR, zFR] : [zBR, zFR];
    return [
      at("nut", nz.map((z, i) => [sx * (inner - 40), seatY - 85, z + (i === 2 ? 0 : 0)] as Vec3), [0, 1, 0], undefined, undefined, BARREL),
      at("bolt", [zBR, zFR].map((z) => [sx * hw, seatY - 72, z] as Vec3), [-sx, 0, 0], id, undefined, BOLT),
    ];
  };
  const people = W > 900 ? 2 : 1;
  const steps: CustomStep[] = [
    {
      title: "Screw the back rail under the seat",
      detail: `Lay the seat face down on a rug. ${o.seatScrews} screws through the rail into its battens.`,
      add: ["S", "BR"],
      fix: [at("screw", Array.from({ length: o.seatScrews }, (_, i) => [-inner + 20 + ((2 * inner - 40) * i) / Math.max(1, o.seatScrews - 1), seatY - 85, zBR] as Vec3), [0, 1, 0], "BR", "S", SCREW)],
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    {
      title: "Bolt the backrest to the back rail",
      detail: "Stand the seat on its end. A barrel nut into each end of the rail from below, then a bolt in through each foot of the backrest." + (o.backDowels ? " Tap the two dowels into the rail first." : ""),
      add: ["K"],
      fix: [
        ...(o.backDowels ? [at("dowel", [-hw / 3, hw / 3].map((x) => [x, ys, zs0] as Vec3), [0, 0, 1], "BR", "K", { len: 30, dia: 8 })] : []),
        at("nut", [-1, 1].map((sx) => [sx * (inner - 20), seatY - 85, zBR] as Vec3), [0, 1, 0], "BR", undefined, BARREL),
        at("bolt", [-1, 1].map((sx) => [sx * (inner - 20), ys, zbl - 22] as Vec3), [0, 0, 1], "K", "BR", SHORT),
      ],
      tools: ["allen", "flathead"],
      pose: "-x",
      people: people as 1 | 2,
      warnings: people > 1 ? ["two"] : [],
    },
    { title: "Fit the front rail", detail: "Tap a dowel into each end, then set it under the front edge of the seat.", add: ["FR"], fix: ([-1, 1] as const).map((sx) => at("dowel", [[sx * inner, ys, zFR]], [-sx, 0, 0], "FR", sx < 0 ? "SL" : "SR", { len: 30, dia: 8 })), tools: ["hammer"] },
    { title: "Lay a side frame on top", detail: "Its holes line up with the rail ends. One bolt with a washer goes in by hand to hold it.", add: ["SL"], fix: sideFix(-1), tools: ["allen"] },
    { title: "Bolt the side frame on", detail: "A barrel nut into each rail from below, slot towards the frame, then a long bolt through each leg.", fix: sideBolts(-1), tools: ["allen", "flathead"] },
    { title: "Turn it over and fit the other side frame", detail: "The same way: one bolt with a washer to hold it first.", add: ["SR"], fix: sideFix(1), pose: "+x", tools: ["allen"], people: people as 1 | 2 },
    { title: "Bolt the second side frame on", detail: "Barrel nuts first, then the long bolts.", fix: sideBolts(1), tools: ["allen", "flathead"] },
    { title: "Stand it up and tighten every bolt", detail: "On its feet, check it stands square, then tighten all the bolts with the Allen key.", pose: "+y", tools: ["allen"], check: "square" },
  ];
  return { parts, steps };
}

/* ---------- the sun lounger and the kitchen unit ---------- */

/** The sun lounger: built upside down by two people, legs nutted into the frame's corner brackets, wheels at the head. */
function lounger(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const yF = 330, rail = 100, lw = 50, a = 0.7;
  const zh = -D / 2 + 60, zt = D / 2 - 60, lx = W / 2 - 55; // legs
  const hinge = -D / 2 + 720, bl = 680;
  const nFix = Math.round((D / 2 - 30 - hinge) / 62);
  const nBack = Math.round(bl / 62);
  const frame = group("F", "Lounger frame", [
    box(-W / 2, -W / 2 + 30, yF - rail, yF, -D / 2, D / 2),
    box(W / 2 - 30, W / 2, yF - rail, yF, -D / 2, D / 2),
    box(-W / 2 + 30, W / 2 - 30, yF - rail, yF - 20, -D / 2, -D / 2 + 30),
    box(-W / 2 + 30, W / 2 - 30, yF - rail, yF - 20, D / 2 - 30, D / 2),
    ...slats(-W / 2 + 30, W / 2 - 30, hinge, D / 2 - 30, yF - 20, yF, nFix, "x", 10),
  ]);
  // the back is hinged to the frame and lies flat while you build; it is drawn raised on its stay
  const back = group("K", "Backrest", [
    ...Array.from({ length: nBack }, (_, i): Pc => {
      const t = 26 + i * 62;
      return { size: [W - 70, 20, 52], pos: [0, yF - 10 + Math.sin(a) * t, hinge - Math.cos(a) * t], rot: [a, 0, 0] };
    }),
    { size: [W - 90, 30, 30], pos: [0, yF + Math.sin(a) * bl * 0.45 - 140, hinge - Math.cos(a) * bl * 0.62], rot: [-0.5, 0, 0] },
  ]);
  const corners: [number, number][] = [[-1, zh], [1, zh], [-1, zt], [1, zt]];
  const legs = corners.map(([sx, z], i) => group(`L${i}`, "Leg", [box(sx * lx - lw / 2, sx * lx + lw / 2, i < 2 ? 30 : 0, yF - rail, z - lw / 2, z + lw / 2)]));
  const stretch = (id: string, z: number) => group(id, "Stretcher", [box(-lx + lw / 2, lx - lw / 2, 90, 140, z - 14, z + 14)]);
  const wheels = [-1, 1].map((sx, i): CustomPart => ({ id: `W${i}`, name: "Wheel", size: [40, 150, 150], pos: [sx * (lx + lw / 2 + 24), 75, zh], shape: "cyl", material: "soft" }));
  const ids = legs.map((l) => l.id);
  const nutUp = (idx: number[]): CustomFix[] => [
    at("washer", idx.map((i) => [corners[i][0] * (lx - 40), yF - rail, corners[i][1] + (i < 2 ? 40 : -40)] as Vec3), [0, -1, 0], "F", undefined, { len: 2, dia: 16 }),
    at("washer", idx.map((i) => [corners[i][0] * (lx - 40), yF - rail - 2, corners[i][1] + (i < 2 ? 40 : -40)] as Vec3), [0, -1, 0], "F", undefined, { len: 3, dia: 13 }),
    at("nut", idx.map((i) => [corners[i][0] * (lx - 40), yF - rail - 5, corners[i][1] + (i < 2 ? 40 : -40)] as Vec3), [0, -1, 0], "F", undefined, { len: 8, dia: 8 }),
  ];
  const steps: CustomStep[] = [
    {
      title: "Fit a threaded rod into each leg",
      detail: "Lay the legs on a rug. A barrel nut into the side hole, then turn a rod into the top end until it stops.",
      fix: corners.flatMap(([sx, z], i) => [at("nut", [[sx * (lx + lw / 2), yF - rail - 40, z]], [-sx, 0, 0], `L${i}`, undefined, BARREL), at("legScrew", [[sx * lx, yF - rail, z]], [0, -1, 0], `L${i}`, "F", ROD)]),
      tools: ["flathead"],
      pose: "-y",
      people: 2,
      warnings: ["two", "floor"],
    },
    { title: "Lay the frame face down and set the legs in", detail: "Both of you lift it onto the rug, the back folded flat. Each rod goes through a corner bracket. Keep your fingers clear of the back's hinge.", add: ["F", ...ids], warnings: ["hand"] },
    { title: "Push the head stretcher between the head legs", detail: "Its ends drop into the slots in the legs.", add: ["XH"], from: { XH: [0, -260, 0] } },
    { title: "Drop the barrel nuts into the head legs", detail: "One in each leg, low down, slot facing out to the side for the wheel's axle.", fix: [at("nut", [-1, 1].map((sx) => [sx * lx, 75, zh + lw / 2] as Vec3), [0, 0, -1], undefined, undefined, BARREL)], tools: ["flathead"] },
    {
      title: "Bolt on the wheels",
      detail: "On each axle: a washer, the wheel on its sleeve, another washer and the spacer, then into the leg. Hold the axle with the spanner.",
      add: ["W0", "W1"],
      fix: [
        // the axles go in from outside, one each way
        at("bolt", [[-(lx + lw / 2 + 50), 75, zh]], [1, 0, 0], "W0", "L0", { len: 110, dia: 8 }),
        at("bolt", [[lx + lw / 2 + 50, 75, zh]], [-1, 0, 0], "W1", "L1", { len: 110, dia: 8 }),
        at("washer", [-1, 1].map((sx) => [sx * (lx + lw / 2 + 46), 75, zh] as Vec3), [1, 0, 0], undefined, undefined, { len: 2, dia: 16 }),
        at("washer", [-1, 1].map((sx) => [sx * (lx + lw / 2 + 2), 75, zh] as Vec3), [1, 0, 0], undefined, undefined, { len: 8, dia: 18 }),
      ],
      tools: ["allen", "wrench"],
    },
    { title: "Nut the two head legs tight", detail: "A washer, a spring washer and a nut on each rod, done up with the spanner.", fix: nutUp([0, 1]), tools: ["wrench"] },
    { title: "Tap two dowels into the foot stretcher", detail: "One into each end.", fix: [-1, 1].map((sx) => at("dowel", [[sx * (lx - lw / 2), 115, zt]], [-sx, 0, 0], "XF", undefined, { len: 30, dia: 8 })), tools: ["hammer"] },
    { title: "Push the foot stretcher between the foot legs", detail: "Onto its dowels, into the holes in the legs.", add: ["XF"] },
    { title: "Drop the barrel nuts into the foot stretcher", detail: "One near each end, slot towards the leg.", fix: [at("nut", [-1, 1].map((sx) => [sx * (lx - 70), 90, zt] as Vec3), [0, 1, 0], "XF", undefined, BARREL)], tools: ["flathead"] },
    { title: "Bolt the foot legs to the stretcher", detail: "A bolt in through each leg until it catches the barrel nut.", fix: ([-1, 1] as const).map((sx) => at("bolt", [[sx * (lx + lw / 2), 115, zt]], [-sx, 0, 0], `L${sx < 0 ? 2 : 3}`, "XF", BOLT)), tools: ["allen"] },
    { title: "Nut the two foot legs tight", detail: "Washer, spring washer and nut on each rod, with the spanner.", fix: nutUp([2, 3]), tools: ["wrench"] },
    { title: "Turn the lounger over together", detail: "Lift it by the frame, not the back, and keep your fingers away from the hinge as it swings.", pose: "+y", people: 2, warnings: ["two", "hand"] },
    { title: "Raise the back to the angle you like", detail: "Lift it by its top edge and drop the stay into one of the notches. Fold it flat the same way.", add: ["K"], from: { K: [0, -200, -300] }, warnings: ["hand"] },
  ];
  return { parts: [frame, back, ...legs, stretch("XH", zh), stretch("XF", zt), ...wheels], steps };
}

/** The open kitchen unit: built upside down from the steel-topped frame, then turned up for the back with its hooks, and fixed to the wall. */
function kitchen(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10;
  const yT = 900, Hb = 1400, fw = 50, lw = 45; // its back stands to 140 cm, whatever the listing says
  const lx = W / 2 - lw / 2, lz = D / 2 - lw / 2;
  const top = group("T", "Worktop frame", [
    box(-W / 2, W / 2, yT - 40, yT, -D / 2, -D / 2 + fw),
    box(-W / 2, W / 2, yT - 40, yT, D / 2 - fw, D / 2),
    box(-W / 2, -W / 2 + fw, yT - 40, yT, -D / 2 + fw, D / 2 - fw),
    box(W / 2 - fw, W / 2, yT - 40, yT, -D / 2 + fw, D / 2 - fw),
    { ...box(-W / 2 + fw, W / 2 - fw, yT - 8, yT - 2, -D / 2 + fw, D / 2 - fw), material: "metal" },
  ]);
  const mid = group("M", "Middle rail", [box(-W / 2 + fw, W / 2 - fw, yT - 40, yT - 8, -20, 20)]);
  const corners = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const));
  const legs = corners.map(([sx, sz], i) => group(`L${i}`, "Leg", [box(sx * lx - lw / 2, sx * lx + lw / 2, 25, yT - 40, sz * lz - lw / 2, sz * lz + lw / 2)]));
  const rails = ([-1, 1] as const).map((sx) => group(sx < 0 ? "R1" : "R2", "Shelf rail", [box(sx * lx - 15, sx * lx + 15, 170, 230, -lz + lw / 2, lz - lw / 2)]));
  const shelf = group("P", "Shelf", slats(-lx + 15, lx - 15, -lz + lw / 2, lz - lw / 2, 210, 230, Math.round((W - 2 * lw) / 60), "z", 10));
  const back = group("B", "Back", [
    ...[-1, 1].map((sx) => box(sx * lx - lw / 2, sx * lx + lw / 2, yT, Hb, -D / 2, -D / 2 + lw)),
    box(-lx + lw / 2, lx - lw / 2, yT, yT + 60, -D / 2 + 5, -D / 2 + 35),
    ...backSlatsAt(yT + 90, Hb - 10, 5).map(([y0, y1]) => box(-lx + lw / 2, lx - lw / 2, y0, y1, -D / 2 + 10, -D / 2 + 30)),
  ]);
  const ym = 200;
  const steps: CustomStep[] = [
    {
      title: "Screw the two small brackets into the frame",
      detail: "Lay the worktop frame face down on a rug. One screw through each bracket, inside the back corners.",
      add: ["T"],
      fix: [at("angle", [-1, 1].map((sx) => [sx * (W / 2 - fw - 40), yT - 30, -D / 2 + fw] as Vec3), [0, 0, -1], "T", undefined, { len: 30, dia: 24 }), at("screw", [-1, 1].map((sx) => [sx * (W / 2 - fw - 40), yT - 30, -D / 2 + fw + 2] as Vec3), [0, 0, -1], "T", undefined, { len: 16, dia: 4 })],
      tools: ["screwdriver"],
      pose: "-y",
      warnings: ["floor"],
    },
    { title: "Screw the middle rail into the frame", detail: "Peel the protective strip off it first. It goes across under the steel, one screw at each end.", add: ["M"], fix: ([-1, 1] as const).map((sx) => at("screw", [[sx * (W / 2 - fw), yT - 25, 0]], [-sx, 0, 0], "T", "M", { len: 30, dia: 4 })), tools: ["screwdriver"] },
    { title: "Screw the feet into the legs", detail: "By hand, all the way in. You level the unit with them at the end.", fix: corners.map(([sx, sz], i) => at("foot", [[sx * lx, 25, sz * lz]], [0, 1, 0], `L${i}`, undefined, { len: 25, dia: 32 })) },
    {
      title: "Fit a barrel nut and a threaded rod into each leg",
      detail: "Barrel nut into the side hole, slot up, then turn the rod into the top end until it stops.",
      fix: corners.flatMap(([sx, sz], i) => [at("nut", [[sx * (lx + lw / 2), yT - 80, sz * lz]], [-sx, 0, 0], `L${i}`, undefined, BARREL), at("legScrew", [[sx * lx, yT - 40, sz * lz]], [0, -1, 0], `L${i}`, "T", ROD)]),
      tools: ["flathead"],
    },
    {
      title: "Set the legs in the corners and nut them",
      detail: "Each rod goes through a corner bracket. A washer and a nut on each, done up with the spanner.",
      add: legs.map((l) => l.id),
      fix: [
        at("washer", corners.map(([sx, sz]) => [sx * (lx - 40), yT - 40, sz * (lz - 40)] as Vec3), [0, -1, 0], "T", undefined, { len: 2, dia: 16 }),
        at("nut", corners.map(([sx, sz]) => [sx * (lx - 40), yT - 42, sz * (lz - 40)] as Vec3), [0, -1, 0], "T", undefined, { len: 8, dia: 8 }),
      ],
      tools: ["wrench"],
    },
    { title: "Tap the dowels into the shelf rails", detail: "Two into each end of both rails.", fix: ([-1, 1] as const).flatMap((sx) => ([-1, 1] as const).map((sz) => at("dowel", [185, 215].map((y) => [sx * lx, y, sz * (lz - lw / 2)] as Vec3), [0, 0, -sz], sx < 0 ? "R1" : "R2", undefined, { len: 40, dia: 8 }))), tools: ["hammer"] },
    { title: "Fit the shelf rails between the legs", detail: "Ease the legs apart a little and push each rail onto its dowels, low down at the sides.", add: ["R1", "R2"] },
    { title: "Slide the shelf in together", detail: "One of you holds the legs apart while the other slides the slatted shelf into the grooves in the rails.", add: ["P"], from: { P: [0, 0, 500] }, people: 2, warnings: ["two"] },
    {
      title: "Bolt the rails to the legs",
      detail: "A barrel nut into each rail end, then a long bolt in through each leg.",
      fix: [
        at("nut", corners.map(([sx, sz]) => [sx * lx, 170, sz * (lz - lw / 2 - 40)] as Vec3), [0, 1, 0], undefined, undefined, BARREL),
        ...([-1, 1] as const).map((sz) => at("bolt", [-1, 1].map((sx) => [sx * lx, ym, sz * (D / 2)] as Vec3), [0, 0, -sz], undefined, undefined, { len: 100, dia: 6 })),
      ],
      tools: ["allen", "flathead"],
    },
    { title: "Turn it over and tighten the legs", detail: "Stand it on its feet, then give the four nuts under the top a last turn with the spanner.", pose: "+y", tools: ["wrench"], people: 2, warnings: ["two"] },
    { title: "Bolt the back onto the worktop", detail: "Stand it on the back edge of the frame. Three bolts down through its bottom rail.", add: ["B"], fix: [at("bolt", [-W / 4, 0, W / 4].map((x) => [x, yT + 60, -D / 2 + 20] as Vec3), [0, -1, 0], "B", "T", { len: 90, dia: 6 })], tools: ["allen"] },
    { title: "Hang the three hooks on the back", detail: "Over the top slat, wherever you want them.", fix: [at("hook", [-W / 4, 0, W / 4].map((x) => [x, Hb - 10, -D / 2 + 34] as Vec3), [0, -1, 0], "B", undefined, { len: 55, dia: 22 })] },
    { title: "Level it with the feet", detail: "Put a spirit level on the worktop and turn the feet until it sits level and doesn't rock.", tools: ["level"] },
    {
      title: "Fix it to the wall",
      detail: "Screw the two long brackets to the back legs, then screw them to the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        at("bracket", [-1, 1].map((sx) => [sx * lx, yT - 120, -D / 2] as Vec3), [0, 0, 1], undefined, undefined, { len: 120, dia: 30 }),
        at("screw", [-1, 1].map((sx) => [sx * lx, yT - 140, -D / 2 - 2] as Vec3), [0, 0, 1], undefined, undefined, { len: 30, dia: 4 }),
        at("washer", [-1, 1].map((sx) => [sx * lx, yT - 100, -D / 2 - 2] as Vec3), [0, 0, -1], undefined, undefined, { len: 2, dia: 14 }),
        at("plug", [-1, 1].map((sx) => [sx * lx, yT - 100, -D / 2 - 6] as Vec3), [0, 0, -1], undefined, undefined, { len: 35, dia: 8 }),
        at("screw", [-1, 1].map((sx) => [sx * lx, yT - 100, -D / 2 - 4] as Vec3), [0, 0, -1], undefined, undefined, { len: 50, dia: 5 }),
      ],
      tools: ["screwdriver", "drill", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts: [top, mid, ...legs, ...rails, shelf, back], steps };
}

/** n slats side by side between two points, with even 10 mm gaps. */
function rowOf(a: number, b: number, n: number, gap = 10): [number, number][] {
  const sw = (b - a - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => [a + i * (sw + gap), a + i * (sw + gap) + sw]);
}

/** The shelving unit: a slatted cabinet with two doors and an open shelf on top, built upside down and fixed to the wall. */
function shelving(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const lw = 45, px = W / 2 - lw / 2, pz = D / 2 - lw / 2, ix = W / 2 - lw, iz = D / 2 - lw;
  const yc = Math.round(H * 0.55); // top of the cabinet
  const yb = 120; // top of the bottom shelf
  // slats standing upright, side by side along z
  const upright = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, n: number): Pc[] => {
    const gap = 12, sw = (z1 - z0 - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => box(x0, x1, y0, y1, z0 + i * (sw + gap), z0 + i * (sw + gap) + sw));
  };
  const side = (id: string, sx: -1 | 1) =>
    group(id, "Side panel", [
      ...[-1, 1].map((sz) => box(sx * px - lw / 2, sx * px + lw / 2, 25, H - 25, sz * pz - lw / 2, sz * pz + lw / 2)),
      box(sx * px - 14, sx * px + 14, 60, yb - 20, -iz, iz),
      box(sx * px - 14, sx * px + 14, yc - 60, yc - 20, -iz, iz),
      ...upright(sx * px - 9, sx * px + 9, -iz + 4, iz - 4, yb - 20, yc - 60, Math.round((2 * iz) / 52)),
    ]);
  const shelfOf = (id: string, name: string, y: number, z1: number) => group(id, name, slats(-ix, ix, -iz, z1, y - 20, y, Math.round((z1 + iz) / 58), "x", 10));
  const doorW = ix - 3;
  const door = (id: string, sx: -1 | 1) => {
    const x0 = sx < 0 ? -ix + 2 : 3, x1 = sx < 0 ? -3 : ix - 2;
    return group(id, "Door", [
      box(x0, x1, yb + 2, yb + 40, D / 2 - 22, D / 2),
      box(x0, x1, yc - 100, yc - 62, D / 2 - 22, D / 2),
      ...rowOf(x0, x1, Math.max(3, Math.round(doorW / 55))).map(([a, b]) => box(a, b, yb + 2, yc - 62, D / 2 - 18, D / 2 - 4)),
    ]);
  };
  const parts: CustomPart[] = [
    side("SL", -1),
    side("SR", 1),
    shelfOf("BS", "Bottom shelf", yb, iz),
    group("BP", "Back panel", rowOf(-ix, ix, Math.round((2 * ix) / 55)).map(([a, b]) => box(a, b, yb, yc - 40, -D / 2 + 6, -D / 2 + 24))),
    shelfOf("MS", "Cabinet top", yc, iz - 30),
    group("FR", "Front rail", [box(-ix, ix, yc - 60, yc, iz - 30, iz)]),
    slatTop("TS", "Top shelf", W, D, H - 25, H),
    ...([-1, 1] as const).map((sz) => group(sz < 0 ? "R1" : "R2", "Top rail", [box(-ix, ix, H - 85, H - 25, sz * pz - 14, sz * pz + 14)])),
    door("D1", -1),
    door("D2", 1),
  ];
  // screws into a slatted shelf go into a slat, not the gap beside it
  const slatMids = (z0: number, z1: number) => slats(0, 1, z0, z1, 0, 1, Math.round((z1 - z0) / 58), "x", 10).map((p) => p.pos[2]);
  const slatsB = slatMids(-iz, iz), slatsM = slatMids(-iz, iz - 30);
  const snap = (z: number, mids: number[]) => mids.reduce((a, m) => (Math.abs(m - z) < Math.abs(a - z) ? m : a), mids[0]);
  const angles = (y: number) => ([-1, 1] as const).flatMap((sx) => [-iz / 2, iz / 2].map((z) => [sx * ix, y, z] as Vec3));
  const ends = ([-1, 1] as const).map((sx) => at("dowel", [-iz / 2, iz / 2].map((z) => [sx * ix, yb - 10, z] as Vec3), [-sx, 0, 0], "BS", sx < 0 ? "SL" : "SR", { len: 40, dia: 8 }));
  const steps: CustomStep[] = [
    { title: "Screw the feet into the side panels", detail: "Lay both side panels on a rug. One foot into the bottom of each post, by hand.", add: ["SL", "SR"], fix: [at("foot", ([-1, 1] as const).flatMap((sx) => [-1, 1].map((sz) => [sx * px, 25, sz * pz] as Vec3)), [0, 1, 0], undefined, undefined, { len: 25, dia: 32 })], warnings: ["floor"] },
    { title: "Screw the angle brackets onto the side panels", detail: "Two on the inside of each panel's top rail and two on its bottom rail.", fix: [at("angle", [...angles(yb - 40), ...angles(yc - 40)], [-1, 0, 0], undefined, undefined, { len: 30, dia: 30 }), at("screw", [...angles(yb - 50), ...angles(yc - 50)], [-1, 0, 0], undefined, undefined, { len: 12, dia: 4 })], tools: ["screwdriver"] },
    { title: "Tap the dowels into the bottom shelf", detail: "Two into each end.", fix: ends, tools: ["hammer"] },
    { title: "Join the side panels with the bottom shelf", detail: "Upside down on the rug: push one side panel onto each end of the shelf.", add: ["BS"], pose: "-y" },
    { title: "Screw the top shelf to its two rails", detail: "Eight screws, four along each rail.", add: ["TS", "R1", "R2"], fix: [at("screw", ([-1, 1] as const).flatMap((sz) => [-0.6, -0.2, 0.2, 0.6].map((t) => [t * ix, H - 85, sz * pz] as Vec3)), [0, 1, 0], undefined, "TS", { len: 30, dia: 4 })], tools: ["screwdriver"] },
    { title: "Fit the back panel between the sides", detail: "Slats upright, then a bolt through each side panel into it at the top and the bottom.", add: ["BP"], fix: ([-1, 1] as const).map((sx) => at("bolt", [yb + 40, yc - 80].map((y) => [sx * W / 2, y, -pz] as Vec3), [-sx, 0, 0], sx < 0 ? "SL" : "SR", "BP", SHORT)), tools: ["allen"] },
    { title: "Slide in the cabinet top", detail: "It runs in from the front on the upper rails of the side panels.", add: ["MS"], from: { MS: [0, 0, 400] } },
    {
      title: "Slide in the front rail with the catches",
      detail: "Screw the two magnetic catches under it first, two screws each, then push it in along the front.",
      add: ["FR"],
      fix: [at("clip", [-ix / 2, ix / 2].map((x) => [x, yc - 60, iz - 15] as Vec3), [0, 1, 0], "FR", undefined, { len: 30, dia: 15 }), at("screw", [-ix / 2 - 25, -ix / 2 + 25, ix / 2 - 25, ix / 2 + 25].map((x) => [x, yc - 62, iz - 15] as Vec3), [0, 1, 0], "FR", undefined, { len: 12, dia: 3.5 })],
      tools: ["screwdriver"],
    },
    {
      title: "Screw the brackets to the shelves",
      detail: "One screw through each of the eight brackets.",
      fix: [
        at("screw", angles(yb - 20).map((p) => [p[0] - Math.sign(p[0]) * 30, p[1], snap(p[2], slatsB)] as Vec3), [0, 1, 0], "BS", undefined, { len: 12, dia: 4 }),
        at("screw", angles(yc - 20).map((p) => [p[0] - Math.sign(p[0]) * 30, p[1], snap(p[2], slatsM)] as Vec3), [0, 1, 0], "MS", undefined, { len: 12, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Tighten the back panel bolts", detail: "All four, now that the shelves hold it square.", tools: ["allen"], check: "square" },
    { title: "Fit the small brackets at the back", detail: "One in each corner where the back panel meets a shelf, screwed to the back panel.", fix: [at("angle", [-1, 1].flatMap((sx) => [yb + 20, yc - 60].map((y) => [sx * (ix - 60), y, -D / 2 + 24] as Vec3)), [0, 0, -1], "BP", undefined, { len: 24, dia: 20 }), at("screw", [-1, 1].flatMap((sx) => [yb + 30, yc - 70].map((y) => [sx * (ix - 60), y, -D / 2 + 26] as Vec3)), [0, 0, -1], "BP", undefined, { len: 12, dia: 4 })], tools: ["screwdriver"] },
    {
      title: "Screw the small brackets to the shelves",
      detail: "One more screw in each.",
      fix: [
        at("screw", [-1, 1].map((sx) => [sx * (ix - 60), yb, snap(-D / 2 + 40, slatsB)] as Vec3), [0, -1, 0], "BS", undefined, { len: 12, dia: 4 }),
        at("screw", [-1, 1].map((sx) => [sx * (ix - 60), yc - 20, snap(-D / 2 + 40, slatsM)] as Vec3), [0, 1, 0], "MS", undefined, { len: 12, dia: 4 }),
      ],
      tools: ["screwdriver"],
    },
    {
      title: "Turn it over and bolt the top shelf on",
      detail: "Stand it on its feet. Dowels into the top rails' ends, a barrel nut into each rail, then a long bolt in through each post.",
      fix: [
        ...([-1, 1] as const).map((sx) => at("dowel", [-1, 1].map((sz) => [sx * ix, H - 70, sz * pz] as Vec3), [-sx, 0, 0], undefined, undefined, { len: 30, dia: 8 })),
        at("nut", ([-1, 1] as const).flatMap((sx) => [-1, 1].map((sz) => [sx * (ix - 40), H - 85, sz * pz] as Vec3)), [0, 1, 0], undefined, undefined, BARREL),
        ...([-1, 1] as const).map((sx) => at("bolt", [-1, 1].map((sz) => [sx * W / 2, H - 55, sz * pz] as Vec3), [-sx, 0, 0], sx < 0 ? "SL" : "SR", undefined, { len: 90, dia: 6 })),
      ],
      pose: "+y",
      tools: ["allen", "flathead"],
    },
    {
      title: "Hang the doors",
      detail: "Screw the striker plates with their washers inside the doors, then screw each door's hinges to the front post.",
      add: ["D1", "D2"],
      from: { D1: [0, 0, 300], D2: [0, 0, 300] },
      fix: [
        at("hinge", ([-1, 1] as const).flatMap((sx) => [yb + 60, yc - 120].map((y) => [sx * (ix + 2), y, D / 2 - 12] as Vec3)), [0, 0, -1], undefined, undefined, { len: 50, dia: 30 }),
        at("screw", ([-1, 1] as const).flatMap((sx) => [yb + 60, yc - 120].map((y) => [sx * (ix + 2), y + 15, D / 2] as Vec3)), [0, 0, -1], undefined, undefined, { len: 16, dia: 4 }),
        at("screw", [-1, 1].map((sx) => [sx * 40, yc - 80, D / 2 - 22] as Vec3), [0, 0, 1], undefined, undefined, { len: 12, dia: 3.5 }),
        at("washer", [-1, 1].map((sx) => [sx * 40, yc - 80, D / 2 - 22] as Vec3), [0, 0, 1], undefined, undefined, { len: 1.5, dia: 10 }),
      ],
      tools: ["screwdriver"],
    },
    { title: "Level it with the feet", detail: "Turn the feet until it stands level and the doors meet evenly.", tools: ["level"] },
    {
      title: "Fix it to the wall",
      detail: "Screw the two wall fittings under the top shelf at the back, then to the wall. Wall screws and plugs aren't included: pick ones made for your wall.",
      fix: [
        at("bracket", [-1, 1].map((sx) => [sx * (ix - 80), H - 25, -D / 2 + 30] as Vec3), [0, 1, 0], "TS", undefined, { len: 50, dia: 30 }),
        at("plug", [-1, 1].map((sx) => [sx * (ix - 80), H - 60, -D / 2] as Vec3), [0, 0, -1], undefined, undefined, { len: 35, dia: 8 }),
        at("screw", [-1, 1].map((sx) => [sx * (ix - 80), H - 60, -D / 2 + 2] as Vec3), [0, 0, -1], undefined, undefined, { len: 50, dia: 5 }),
      ],
      tools: ["screwdriver", "drill", "pencil"],
      wall: true,
      warnings: ["wall", "tip"],
    },
  ];
  return { parts, steps };
}

/* ---------- the modular sofa ---------- */

interface Sofa {
  seats: number; // sections with a backrest
  stool: boolean; // a section without one, on the left
  arms: 0 | 1 | 2; // backrests stood at the ends as armrests (one: on the right)
  cushions: boolean;
  deep: boolean; // the deeper section, its seat in two halves on three rails
}

const YS = 300, RT = 205, LW = 45;

/** The back slats' heights, bottom to top, with even gaps. */
function backSlats(n: number, Hb: number): [number, number][] {
  const sh = (Hb - YS - 40 - (n - 1) * 22) / n;
  return Array.from({ length: n }, (_, i) => [YS + 30 + i * (sh + 22), YS + 30 + i * (sh + 22) + sh]);
}

/** n slats with even gaps between two heights. */
function backSlatsAt(y0: number, y1: number, n: number, gap = 22): [number, number][] {
  const sh = (y1 - y0 - (n - 1) * gap) / n;
  return Array.from({ length: n }, (_, i) => [y0 + i * (sh + gap), y0 + i * (sh + gap) + sh]);
}

/** One seat section, upside down on a rug as its manual builds it, then any more the same way. */
function section(id: string, ox: number, Ws: number, D: number, deep: boolean, first: boolean, sx0: -1 | 1 = 1, k = 0) {
  const zf0 = -D / 2 + LW, zf1 = D / 2, zm = (zf0 + zf1) / 2;
  const hw = Ws / 2;
  const X = (x: number) => ox + x;
  const parts: CustomPart[] = [];
  const nS = Math.round((zf1 - zf0) / 62);
  const seatPcs = (z0: number, z1: number, n: number): Pc[] => [
    box(X(-hw), X(-hw + 45), YS - 25, YS, z0, z1),
    box(X(hw - 45), X(hw), YS - 25, YS, z0, z1),
    ...slats(X(-hw + 45), X(hw - 45), z0 + 3, z1 - 3, YS - 20, YS, n, "x", 10),
  ];
  if (deep) {
    parts.push(group(`${id}S1`, "Seat half", seatPcs(zf0, zm, Math.round(nS / 2))), group(`${id}S2`, "Seat half", seatPcs(zm, zf1, Math.round(nS / 2))));
  } else parts.push(group(`${id}S`, "Seat", seatPcs(zf0, zf1, nS)));
  const rail = (rid: string, z0: number, z1: number, inset: number) => parts.push(group(rid, "Rail", [box(X(-hw + inset), X(hw - inset), RT, YS - 25, z0, z1)]));
  rail(`${id}F`, zf1 - 28, zf1, LW);
  rail(`${id}B`, zf0, zf0 + 28, LW);
  if (deep) rail(`${id}M`, zm - 14, zm + 14, 28);
  const side = (sid: string, sx: -1 | 1) =>
    parts.push(
      group(sid, "Side frame", [
        box(X(sx * hw - (sx > 0 ? LW : 0)), X(sx * hw + (sx < 0 ? LW : 0)), 0, YS - 25, zf0, zf0 + LW),
        box(X(sx * hw - (sx > 0 ? LW : 0)), X(sx * hw + (sx < 0 ? LW : 0)), 0, YS - 25, zf1 - LW, zf1),
        box(X(sx * hw - (sx > 0 ? 28 : 0)), X(sx * hw + (sx < 0 ? 28 : 0)), RT, YS - 25, zf0 + LW, zf1 - LW),
        box(X(sx * hw - (sx > 0 ? 28 : 0)), X(sx * hw + (sx < 0 ? 28 : 0)), 60, 110, zf0 + LW, zf1 - LW),
      ]),
    );
  side(`${id}L`, -1);
  side(`${id}R`, 1);
  for (const [sid, z] of [[`${id}X1`, zf1 - 22], [`${id}X2`, zf0 + 22]] as const) parts.push(group(sid, "Stretcher", [box(X(-hw + LW), X(hw - LW), 60, 110, z - 14, z + 14)]));

  const rz = deep ? [zf1 - 14, zm, zf0 + 14] : [zf1 - 14, zf0 + 14];
  const seatIds = deep ? [`${id}S1`, `${id}S2`] : [`${id}S`];
  const pins = deep ? [at("stud", [-hw / 2, hw / 2].map((x) => [X(x), YS - 12, zm] as Vec3), [0, 0, 1], `${id}S1`, `${id}S2`, PIN), at("washer", [-hw / 2, hw / 2].map((x) => [X(x), YS - 12, zm] as Vec3), [0, 0, 1], `${id}S1`, undefined, SPACER)] : [];
  const shortDowels = at("dowel", rz.flatMap((z) => [-1, 1].map((sx) => [X(sx * (hw - 130)), YS - 25, z] as Vec3)), [0, 1, 0], undefined, undefined, { len: 30, dia: 8 });
  const railScrews = at("screw", rz.flatMap((z, i) => (i === 1 && deep ? [-0.6, -0.2, 0.2, 0.6] : [-0.6, 0, 0.6]).map((t) => [X(t * hw), RT, z] as Vec3)), [0, 1, 0], undefined, undefined, SCREW);
  const ends = (sx: -1 | 1) => rz.flatMap((z, i) => [RT + 18, YS - 45].map((y) => [X(sx * (hw - (deep && i === 1 ? 28 : LW))), y, z] as Vec3));
  const longDowels = ([-1, 1] as const).map((sx) => at("dowel", ends(sx), [-sx, 0, 0], undefined, undefined, { len: 40, dia: 8 }));
  const sideScrews = (sx: -1 | 1) => at("screw", (deep ? [-0.6, -0.2, 0.2, 0.6] : [-0.5, 0, 0.5]).map((t) => [X(sx * (hw - 14)), RT, zm + (t * (zf1 - zf0 - 2 * LW)) / 2] as Vec3), [0, 1, 0], sx < 0 ? `${id}L` : `${id}R`, undefined, SCREW);
  const nutsAt = (sx: -1 | 1, zs: number[], y: number) => at("nut", zs.map((z) => [X(sx * (hw - 85)), y, z] as Vec3), [0, 1, 0], undefined, undefined, BARREL);
  const boltsAt = (sx: -1 | 1, zs: number[], y: number) => at("bolt", zs.map((z) => [X(sx * hw), y, z] as Vec3), [-sx, 0, 0], sx < 0 ? `${id}L` : `${id}R`, undefined, BOLT);
  const lowZ = [zf1 - 22, zf0 + 22];
  // every other section's bolts sit a little higher, so their heads don't land on its neighbour's at the join
  const topY = (RT + YS - 25) / 2 + (k % 2) * 23, lowY = 78 + (k % 2) * 23;
  const tops = (sx: -1 | 1): CustomFix[] => [nutsAt(sx, rz, RT), boltsAt(sx, rz, topY)];
  const lows = (sx: -1 | 1): CustomFix[] => [nutsAt(sx, lowZ, 60), boltsAt(sx, lowZ, lowY)];
  const nb = deep ? 10 : 8;

  const steps: CustomStep[] = first
    ? [
        ...(deep
          ? [
              { title: "Pin the two seat halves together", detail: "Face down on a rug. Two metal pins with a spacer each go into the edge of one half, then push the other half on.", add: seatIds, fix: pins, pose: "-y" as const, warnings: ["floor" as const] },
              { title: "Tap the small dowels into the seat", detail: "Six, into the holes along the three lines where the rails go.", fix: [shortDowels], tools: ["hammer" as const] },
            ]
          : [{ title: "Tap the small dowels into the seat", detail: "Lay it face down on a rug. Four dowels into the holes where the rails go.", add: seatIds, fix: [shortDowels], tools: ["hammer" as const], pose: "-y" as const, warnings: ["floor" as const] }]),
        { title: deep ? "Lay the three rails onto the dowels" : "Lay the two rails onto the dowels", detail: "The marked side of each rail faces the same way.", add: [`${id}F`, `${id}B`, ...(deep ? [`${id}M`] : [])] },
        { title: "Screw the rails to the seat", detail: `${deep ? "Ten" : "Six"} screws, turned in with the Allen key.`, fix: [railScrews], tools: ["allen"] },
        { title: "Tap the long dowels into the rail ends", detail: "Two into each end.", fix: longDowels, tools: ["hammer"] },
        { title: "Push a side frame onto the rail ends", detail: "Legs pointing up, onto the dowels.", add: [`${id}L`], from: { [`${id}L`]: [-300, 0, 0] } },
        { title: "Screw the side frame to the seat", detail: `${deep ? "Four" : "Three"} screws up through its top rail.`, fix: [sideScrews(-1)], tools: ["allen"] },
        { title: "Bolt the side frame to the rails", detail: "A barrel nut into each rail, slot towards the leg, then a bolt in through the frame. Not fully tight yet.", fix: tops(-1), tools: ["allen", "flathead"] },
        { title: "Push the two stretchers into the side frame", detail: "Low down, between the legs at the front and the back.", add: [`${id}X1`, `${id}X2`] },
        { title: "Bolt the stretchers on", detail: "A barrel nut into each, then a bolt through the leg.", fix: lows(-1), tools: ["allen", "flathead"] },
        { title: "Push the other side frame on", detail: "Onto the rail and stretcher ends.", add: [`${id}R`], from: { [`${id}R`]: [300, 0, 0] } },
        { title: "Screw it to the seat", detail: "Up through its top rail, the same as the first.", fix: [sideScrews(1)], tools: ["allen"] },
        { title: "Bolt it to the rails and stretchers", detail: "Barrel nuts first, then the bolts.", fix: [...tops(1), ...lows(1)], tools: ["allen", "flathead"] },
        { title: "Turn the section over and tighten the bolts", detail: `Stand it on its legs, then tighten all ${nb} bolts.`, pose: "+y", tools: ["allen"], check: "square" },
      ]
    : [
        {
          title: "Build the next seat section the same way",
          detail: "Face down on the rug: dowels, rails and screws, the side frames and stretchers bolted on, then turned over and tightened.",
          add: [...seatIds, `${id}F`, `${id}B`, ...(deep ? [`${id}M`] : []), `${id}L`, `${id}X1`, `${id}X2`, `${id}R`],
          fix: [...pins, shortDowels, { ...railScrews, at: [...railScrews.at!, ...sideScrews(-1).at!, ...sideScrews(1).at!], count: 0 }, ...longDowels, { ...nutsAt(-1, rz, RT), at: [...([-1, 1] as const).flatMap((sx) => [...nutsAt(sx, rz, RT).at!, ...nutsAt(sx, lowZ, 60).at!])] }, ...([-1, 1] as const).map((sx) => ({ ...boltsAt(sx, rz, 0), at: [...boltsAt(sx, rz, topY).at!, ...boltsAt(sx, lowZ, lowY).at!] }))],
          tools: ["allen", "hammer", "flathead"],
          // it arrives built, in one piece, beside the section before it
          from: Object.fromEntries([...seatIds, `${id}F`, `${id}B`, ...(deep ? [`${id}M`] : []), `${id}L`, `${id}X1`, `${id}X2`, `${id}R`].map((k) => [k, [sx0 * Math.max(350, Ws * 0.7), 0, 0] as Vec3])),
        },
      ];
  for (const st of steps) for (const f of st.fix ?? []) f.count = f.at!.length;
  return { parts, steps, zf0, zf1 };
}

/** A backrest: two posts bolted to the slatted back, lowered onto hooks on the seat and screwed to the back legs. */
function backrest(id: string, ox: number, Ws: number, D: number, Hb: number, deep: boolean, first: boolean) {
  const hw = Ws / 2, X = (x: number) => ox + x, zb = -D / 2;
  const n = Math.max(4, Math.round((Hb - YS - 60) / 70));
  const parts: CustomPart[] = [
    group(`${id}P`, "Backrest", [
      // two battens behind the slats, where the posts bolt on
      ...[-1, 1].map((sx) => box(X(sx * (hw - LW) - (sx > 0 ? 50 : 0)), X(sx * (hw - LW) + (sx < 0 ? 50 : 0)), YS + 30, Hb - 10, zb + 4, zb + 24)),
      ...backSlats(n, Hb).map(([y0, y1]) => box(X(-hw + LW), X(hw - LW), y0, y1, zb + 24, zb + LW)),
    ]),
    ...([-1, 1] as const).map((sx) => group(`${id}${sx < 0 ? "A" : "Z"}`, "Back post", [box(X(sx * hw - (sx > 0 ? LW : 0)), X(sx * hw + (sx < 0 ? LW : 0)), 20, Hb, zb, zb + LW)])),
  ];
  const hx = deep ? [-0.6, -0.2, 0.2, 0.6] : [-0.5, 0.5];
  const hooks = at("hook", hx.map((t) => [X(t * hw), YS, zb + LW] as Vec3), [0, -1, 0], undefined, undefined, { len: 40, dia: 30 });
  const hookScrews = at("screw", hx.map((t) => [X(t * hw), YS + 2, zb + LW + 18] as Vec3), [0, -1, 0], undefined, undefined, { len: 16, dia: 4 });
  const postBolts = ([-1, 1] as const).map((sx) => at("bolt", [YS + 80, Hb - 80].map((y) => [X(sx * hw), y, zb + 14] as Vec3), [-sx, 0, 0], `${id}${sx < 0 ? "A" : "Z"}`, `${id}P`, { len: 50, dia: 6 }));
  const legScrews = at("screw", [-1, 1].map((sx) => [X(sx * (hw - LW / 2)), 160, zb] as Vec3), [0, 0, 1], undefined, undefined, { len: 70, dia: 5 });
  const ids = [`${id}P`, `${id}A`, `${id}Z`];
  const steps: CustomStep[] = first
    ? [
        { title: "Bolt a post to each side of the backrest", detail: "Lay the backrest face down on the rug. Two bolts through each post, by hand first, then tighten them with the Allen key.", add: ids, fix: postBolts, tools: ["allen"], from: { [`${id}P`]: [0, 0, -300] } },
        { title: deep ? "Hook four brackets onto the back of the seat" : "Hook two brackets onto the back of the seat", detail: "They hang over the back edge, open side up.", fix: [hooks] },
        { title: "Lower the backrest onto the hooks", detail: "Its bottom slat drops into the brackets and the posts stand behind the back legs. Then a long screw through each post into the leg.", fix: [legScrews], tools: ["screwdriver"] },
        { title: "Screw the brackets down", detail: "One small screw through each bracket into the seat.", fix: [hookScrews], tools: ["screwdriver"] },
      ]
    : [{ title: "Fit the next backrest the same way", detail: "Posts bolted on, brackets on the seat, then lowered on and screwed.", add: ids, fix: [...postBolts, hooks, legScrews, hookScrews], tools: ["allen", "screwdriver"], from: { [`${id}P`]: [0, 0, -300] } }];
  return { parts, steps };
}

/** A backrest stood at the end of the sofa as an armrest, its slats along the side. */
function armrest(id: string, x: number, sx: -1 | 1, zf0: number, zf1: number, Hb: number) {
  const xo = sx > 0 ? x : x - LW; // its outer posts, beside the end section's legs
  const n = Math.max(4, Math.round((Hb - YS - 60) / 70));
  const slatX0 = sx > 0 ? xo + 4 : xo + LW - 24;
  const panel = group(`${id}P`, "Backrest", backSlats(n, Hb).map(([y0, y1]) => box(slatX0, slatX0 + 20, y0, y1, zf0 + LW, zf1 - LW)));
  const posts = [zf0, zf1 - LW].map((z0, i) => group(`${id}${i ? "Z" : "A"}`, "Back post", [box(xo, xo + LW, 20, Hb, z0, z0 + LW)]));
  const steps: CustomStep[] = [
    {
      title: sx > 0 ? "Fit a backrest at the end as an armrest" : "Fit the other armrest the same way",
      detail: "Built like the backs, then hooked onto the side of the seat with its posts beside the legs, and screwed on.",
      add: [panel.id, posts[0].id, posts[1].id],
      fix: [
        // into the ends of the lowest and the highest slat
        ...[0, 1].map((i) => at("bolt", [backSlats(n, Hb)[0], backSlats(n, Hb)[n - 1]].map(([y0, y1]) => [slatX0 + 10, (y0 + y1) / 2, i ? zf1 : zf0] as Vec3), [0, 0, i ? -1 : 1], `${id}${i ? "Z" : "A"}`, `${id}P`, { len: 50, dia: 6 })),
        at("hook", [-0.5, 0.5].map((t) => [x, YS, (zf0 + zf1) / 2 + t * (zf1 - zf0) * 0.5] as Vec3), [0, -1, 0], undefined, undefined, { len: 40, dia: 30 }),
        at("screw", [zf0 + LW / 2, zf1 - LW / 2].map((z) => [sx > 0 ? xo + LW : xo, 160, z] as Vec3), [-sx, 0, 0], undefined, undefined, { len: 70, dia: 5 }),
        at("screw", [-0.5, 0.5].map((t) => [x - sx * 18, YS + 2, (zf0 + zf1) / 2 + t * (zf1 - zf0) * 0.5] as Vec3), [0, -1, 0], undefined, undefined, { len: 16, dia: 4 }),
      ],
      tools: ["allen", "screwdriver"],
      from: { [panel.id]: [sx * 300, 0, 0] },
    },
  ];
  return { parts: [panel, ...posts], steps };
}

function sofa(s: ProductSpec, o: Sofa): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const n = o.seats + (o.stool ? 1 : 0);
  const Ws = (W - o.arms * LW) / n;
  const x0 = -W / 2 + (o.arms === 2 ? LW : 0);
  const Hb = o.cushions ? Math.min(H - 120, 720) : H;
  const parts: CustomPart[] = [];
  const steps: CustomStep[] = [];
  const mods = Array.from({ length: n }, (_, i) => ({ id: `m${i}`, ox: x0 + Ws * (i + 0.5), back: !(o.stool && i === 0) }));
  // the sections with a backrest come first in the manual's pictures; the footstool is one without
  const order = [...mods.filter((m) => m.back), ...mods.filter((m) => !m.back)];
  let zf0 = 0, zf1 = 0;
  order.forEach((m, i) => {
    const r = section(m.id, m.ox, Ws, D, o.deep, i === 0, m.ox >= order[0].ox ? 1 : -1, i);
    parts.push(...r.parts);
    steps.push(...r.steps);
    zf0 = r.zf0;
    zf1 = r.zf1;
    if (!m.back && o.seats) steps[steps.length - 1].title = "Build the footstool the same way";
  });
  order.filter((m) => m.back).forEach((m, i) => {
    const r = backrest(`${m.id}b`, m.ox, Ws, D, Hb, o.deep, i === 0);
    parts.push(...r.parts);
    steps.push(...r.steps);
  });
  if (o.arms) {
    const right = armrest("ar", W / 2 - LW, 1, zf0, zf1, Hb);
    parts.push(...right.parts);
    steps.push(...right.steps);
  }
  if (o.arms === 2) {
    const left = armrest("al", -W / 2 + LW, -1, zf0, zf1, Hb);
    parts.push(...left.parts);
    steps.push(...left.steps);
  }
  if (n > 1) {
    // a U connector under the seat at the front and the back of each join, round the two side rails
    const joins = mods.slice(1).map((m) => m.ox - Ws / 2);
    const zs = [zf0 + 120, zf1 - 120];
    steps.push({
      title: n > 2 ? "Join the sections with the connectors" : "Join the two sections with the connectors",
      detail: "Push the sections tight together. Each U connector goes up under the two side rails where they meet, with a screw into each rail.",
      fix: [
        at("clamp", joins.flatMap((x) => zs.map((z) => [x, RT, z] as Vec3)), [0, 1, 0], undefined, undefined, { len: 60, dia: 40 }),
        // one screw from each side of the join, sideways into its rail
        ...([-1, 1] as const).map((sx) => at("screw", joins.flatMap((x) => zs.map((z) => [x + sx * 28, RT + 35, z] as Vec3)), [-sx, 0, 0], undefined, undefined, { len: 16, dia: 4 })),
      ],
      tools: ["screwdriver"],
      people: 2,
      warnings: ["two"],
    });
  }
  if (o.cushions) {
    const cush: string[] = [];
    mods.forEach((m) => {
      parts.push({ id: `${m.id}c`, name: "Seat cushion", size: [Ws - 20, 120, zf1 - zf0 - 50], pos: [m.ox, YS + 60, (zf0 + zf1) / 2 + 20], material: "soft" });
      cush.push(`${m.id}c`);
      if (m.back) {
        parts.push({ id: `${m.id}k`, name: "Back cushion", size: [Ws - 40, H - YS - 130, 130], pos: [m.ox, (YS + 120 + H) / 2 + 5, zf0 + 65], material: "soft" });
        cush.push(`${m.id}k`);
      }
    });
    steps.push({ title: "Put the cushions on", detail: "Seat cushions first, then lean the back cushions against the backrests. The zips face the back.", add: cush });
  }
  return { parts, steps };
}

/* ---------- the reclining chair ---------- */

const R_SHORT: HwDef = { kind: "bolt", len: 85, dia: 6 }; // through a leg into the seat rail
const R_BOLT: HwDef = { kind: "bolt", len: 110, dia: 6 }; // through a leg into a barrel nut
const R_LONG: HwDef = { kind: "bolt", len: 150, dia: 6 }; // through an armrest and the back
const R_BARREL: HwDef = { kind: "nut", len: 20, dia: 10, name: "Barrel nut" };
const R_NUT: HwDef = { kind: "nut", len: 6, dia: 10 };
const R_WASHER: HwDef = { kind: "washer", len: 1.5, dia: 16 };
const R_PIN_WASHER: HwDef = { kind: "washer", len: 2, dia: 22 };
const R_THICK: HwDef = { kind: "washer", len: 14, dia: 30, name: "Thick spacer" };
const R_TUBE: HwDef = { kind: "washer", len: 30, dia: 12, name: "Tube spacer" };
const R_SCREW: HwDef = { kind: "screw", len: 20, dia: 5 };
const R_DOWEL: HwDef = { kind: "dowel", len: 40, dia: 8 };
const R_BRACKET: HwDef = { kind: "bracket", len: 60, dia: 40, name: "Seat bracket" };

/** Where a point given in a part's own frame lands when that frame's origin sits at q, turned by a about x. */
const pivoted = (q: Vec3, a: number, v: Vec3): Vec3 => {
  const r = rotate(v, [a, 0, 0]);
  return [q[0] + r[0], q[1] + r[1], q[2] + r[2]];
};

/**
 * Built folded flat, lying on its back: brackets screwed to the seat's back corners, then each leg pair (two legs
 * riveted at the top) bolted to the seat rail, its slotted leg over the bracket's pin, with the stretchers doweled
 * and bolted between them. Stood up, it opens out with the back folded down on the seat; the armrests clip onto the
 * tops of the legs, get their bolts, and the back is raised onto them. Every part turns about x between the folded
 * and the open chair, so each is drawn in its own frame about the pivot.
 */
function recliner(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const hw = W / 2, sw = hw - 55, Ds = 460, ySeat = 420, tilt = 0.3;
  const ya = 615; // underside of the armrests
  const yA = ya - 14, zA = -0.077 * D, zF = 0.436 * D, zB = -0.385 * D; // the legs' top, front and back feet
  const xf = hw - 11, xb = hw - 33; // the front legs outside, the slotted back legs inside them
  const onLeg = (foot: number, y: number) => zA + ((foot - zA) * (yA - y)) / yA;
  const yr = ySeat - 15;
  const P: Vec3 = [0, yr, onLeg(zB, yr)]; // the seat's back corners: the brackets, the back's pivot, the slots
  const yS = yr - 15;
  const S: Vec3 = [0, yS, onLeg(zF, yS)]; // the short bolt through the front leg into the seat rail
  const pieces = (list: Pc[]): PartPiece[] => list.map((p) => ({ shape: "box", size: p.size, pos: p.pos, rot: p.rot }));
  const wood = { material: "wood" as const };

  // the seat, about its pivot: top 15 above it, front towards +z
  const rx = sw - 30;
  const seatT = b.compound("Seat", pieces([
    box(-sw, -rx, -45, 15, -5, Ds - 5),
    box(rx, sw, -45, 15, -5, Ds - 5),
    box(-rx, rx, -25, 15, Ds - 45, Ds - 5),
    box(-rx, rx, -45, -5, -5, 30),
    ...slats(-rx, rx, 38, Ds - 53, -5, 15, 7, "x"),
  ]), wood);
  // the back, about the same pivot: v up its posts, the front face at w = -20, slats across the whole height
  const L = (H - yr) / Math.cos(tilt) - 10;
  const bx = sw - 40;
  const nb = Math.round((L - 70) / 70);
  const backT = b.compound("Back", pieces([
    box(-sw, -bx, -20, L, -50, -20),
    box(bx, sw, -20, L, -50, -20),
    ...backSlatsAt(60, L - 5, nb, 20).map(([v0, v1]) => box(-bx, bx, v0, v1, -46, -24)),
  ]), wood);

  const F: Vec3 = [0, 0, zF], Bk: Vec3 = [0, 0, zB], A: Vec3 = [0, yA, zA];
  const legOf = (foot: Vec3) => ({ L: Math.hypot(A[1] - foot[1], A[2] - foot[2]), a: Math.atan2(A[2] - foot[2], A[1] - foot[1]), mid: [0, (A[1] + foot[1]) / 2, (A[2] + foot[2]) / 2] as Vec3 });
  const lf = legOf(F), lb = legOf(Bk);
  const legFT = b.part("Front leg", [22, lf.L, 45], wood);
  const legBT = b.part("Back leg", [22, lb.L, 45], wood);
  const sides = [1, -1] as const; // the right side goes on first
  const legF = sides.map((sx) => b.place(legFT, [sx * xf, lf.mid[1], lf.mid[2]], [lf.a, 0, 0]));
  const legB = sides.map((sx) => b.place(legBT, [sx * xb, lb.mid[1], lb.mid[2]], [lb.a, 0, 0]));
  const dStr = 140, hf = hw - 22, hb = hw - 44; // how far up the legs, and half the length, of the stretchers
  const cF = pivoted(F, lf.a, [0, dStr, 0]), cB = pivoted(Bk, lb.a, [0, dStr, 0]);
  const strF = b.place(b.part("Front stretcher", [2 * hf, 50, 26], wood), cF, [lf.a, 0, 0]);
  const strB = b.place(b.part("Back stretcher", [2 * hb, 50, 26], wood), cB, [lb.a, 0, 0]);
  // the armrests' back ends bolt to the back's posts
  const yb = ya + 14;
  const vb = (yb - yr + 35 * Math.sin(tilt)) / Math.cos(tilt);
  const zStile = P[2] - vb * Math.sin(tilt) - 35 * Math.cos(tilt);
  const zR = zStile - 50, zFr = zF + 15;
  const armT = b.part("Armrest", [45, 28, zFr - zR], wood);
  const arms = sides.map((sx) => b.place(armT, [sx * (hw - 22.5), yb, (zR + zFr) / 2]));
  const back = b.place(backT.type, pivoted(P, -tilt, backT.mid), [-tilt, 0, 0]);
  const seat = b.place(seatT.type, pivoted(P, 0, seatT.mid));

  // folded flat: the back's rear face on the floor, the seat turned up against its front, the legs closed beside them
  const z0 = Math.min(P[2] - L * Math.sin(tilt) - 50 * Math.cos(tilt), zR); // the chair's back, the floor when it lies on it
  const dS = Math.hypot(S[1] - F[1], S[2] - F[2]);
  const Pk: Vec3 = [0, dS - (S[2] - P[2]), z0 + 50]; // the pivot when folded: the front legs' bolt lines up with the seat's
  const yBf = lf.L - lb.L; // the back legs' feet, their tops level with the front legs'
  const legsAt = (i: number, beside: boolean) => {
    const sx = sides[i], off = beside ? 300 : 0;
    b.stage(legF[i], [sx * (xf + off), lf.L / 2, beside ? z0 + 22.5 : Pk[2] + 15], [0, 0, 0], beside ? [sx * 200, 0, 0] : undefined);
    b.stage(legB[i], [sx * (xb + off), yBf + lb.L / 2, beside ? z0 + 22.5 : Pk[2] + 60], [0, 0, 0], beside ? [sx * 200, 0, 0] : undefined);
  };
  const strAt = (beside: boolean) => {
    b.stage(strF, beside ? [0, -140, z0 + 13] : [0, dStr, Pk[2] + 15], [0, 0, 0], beside ? [0, -200, 0] : undefined);
    b.stage(strB, beside ? [0, -220, z0 + 13] : [0, yBf + dStr, Pk[2] + 60], [0, 0, 0], beside ? [0, -200, 0] : undefined);
  };
  const legBolt = (i: number) => {
    const sx = sides[i];
    b.fit(R_THICK, { on: legF[i], at: [sx * hf, yS, S[2]], dir: [-sx, 0, 0] });
    b.fit(R_SHORT, { on: legF[i], at: [sx * hw, yS, S[2]], dir: [-sx, 0, 0], mate: seat });
  };
  const legNut = (i: number) => {
    const sx = sides[i];
    b.fit(R_WASHER, { on: seat, at: [sx * rx, yS, S[2]], dir: [sx, 0, 0] });
    b.fit(R_NUT, { on: seat, at: [sx * (rx - 2), yS, S[2]], dir: [sx, 0, 0] });
  };
  const strBolts = (i: number) => {
    const sx = sides[i];
    for (const [k, c, a, h] of [[strF, cF, lf.a, hf], [strB, cB, lb.a, hb]] as const)
      b.fit(R_BARREL, { on: k, at: pivoted(c, a, [sx * (h - 35), 25, 0]), dir: rotate([0, -1, 0], [a, 0, 0]) });
    b.fit(R_BOLT, { on: legF[i], at: [sx * hw, cF[1], cF[2]], dir: [-sx, 0, 0], mate: strF });
    b.fit(R_BOLT, { on: legB[i], at: [sx * hf, cB[1], cB[2]], dir: [-sx, 0, 0], mate: strB });
  };
  const lying = { pose: "+z" as const };

  b.step({ title: "Screw the brackets onto the seat", detail: "Lay the back front up on a rug with the seat folded upside down on it. Two screws through each bracket into the end of a side rail, pin facing out.", kind: "screws", tools: ["screwdriver"], warnings: ["floor"], ...lying }, () => {
    b.stage(back, pivoted(Pk, 0, backT.mid), [0, 0, 0]);
    b.stage(seat, pivoted(Pk, -Math.PI / 2, seatT.mid), [-Math.PI / 2, 0, 0], [0, 0, 300]);
    for (const sx of sides) {
      b.fit(R_BRACKET, { on: seat, at: [sx * (sw + 4), yr, P[2]], dir: [-sx, 0, 0] });
      for (const dz of [8, 24]) b.fit(R_SCREW, { on: seat, at: [sx * (sw - 15), yr - 45, P[2] + dz], dir: [0, 1, 0] });
    }
  });
  b.step({ title: "Put a washer on each bracket's pin", detail: "The middle-sized washer, not the small one or the thick spacer.", kind: "general", ...lying }, () => {
    for (const sx of sides) b.fit(R_PIN_WASHER, { on: seat, at: [sx * (hb - 1), yr, P[2]], dir: [-sx, 0, 0] });
  });
  b.step({
    title: "Push the short bolt through a leg pair",
    detail: "The two legs come riveted together at the top: use the pair whose slotted leg lies underneath. The bolt goes through the plain leg, the thick spacer on the inside.",
    kind: "bolts",
    tools: ["allen"],
    ...lying,
  }, () => {
    legsAt(0, true);
    legBolt(0);
  });
  b.step({ title: "Bolt the leg pair to the seat", detail: "The bracket's pin goes into the slot in the inner leg and the bolt into the seat rail. A washer and nut inside, done up with the spanner.", kind: "bolts", tools: ["allen", "wrench"], ...lying }, () => {
    legsAt(0, false);
    legNut(0);
  });
  b.step({ title: "Tap the dowels into the stretchers", detail: "Two into each end of both stretchers, eight in all.", kind: "dowels", ...lying }, () => {
    strAt(true);
    for (const [k, c, a, h] of [[strF, cF, lf.a, hf], [strB, cB, lb.a, hb]] as const)
      for (const ex of [-1, 1]) for (const dy of [-12, 12]) b.fit(R_DOWEL, { on: k, at: pivoted(c, a, [ex * h, dy, 0]), dir: [ex, 0, 0] });
  });
  b.step({
    title: "Push the stretchers in and bolt them",
    detail: "The long one between the outer legs, the short one between the inner legs. A barrel nut into each, slot facing the leg, then a bolt in through the leg.",
    kind: "bolts",
    tools: ["allen", "flathead"],
    ...lying,
  }, () => {
    strAt(false);
    strBolts(0);
  });
  b.step({ title: "Push the short bolt through the other leg pair", detail: "Through the plain leg again, with the thick spacer on the inside.", kind: "bolts", tools: ["allen"], ...lying }, () => {
    legsAt(1, true);
    legBolt(1);
  });
  b.step({ title: "Bolt it to the seat", detail: "Over the stretchers' dowels, the bracket's pin in the slot. A washer and nut on the bolt inside.", kind: "bolts", tools: ["allen", "wrench"], ...lying }, () => {
    legsAt(1, false);
    legNut(1);
  });
  b.step({ title: "Bolt the stretchers to the second legs", detail: "Two more barrel nuts and bolts.", kind: "bolts", tools: ["allen", "flathead"], ...lying }, () => strBolts(1));
  b.step({ title: "Stand the chair up and open it out", detail: "Lift it by the seat and let the legs swing apart until it stands. The back folds down onto the seat for now.", kind: "standup", pose: "+y" }, () => {
    for (const k of [...legF, ...legB, strF, strB, seat]) b.add(k);
    b.stage(back, pivoted(P, Math.PI / 2, backT.mid), [Math.PI / 2, 0, 0]);
  });
  b.step({ title: "Clip the armrests onto the legs", detail: "The track underneath each one hooks over the top of a leg pair. The hole in the end goes to the back, facing in.", kind: "general" }, () => {
    for (const k of arms) b.add(k, [0, 200, 0]);
  });
  b.step({ title: "Push a tube and a long bolt into each armrest", detail: "The tube goes into the hole in the back end, then the long bolt through it from the outside.", kind: "bolts" }, () => {
    sides.forEach((sx, i) => {
      b.fit(R_TUBE, { on: arms[i], at: [sx * (hw - 8), yb, zStile], dir: [-sx, 0, 0] });
      b.fit(R_LONG, { on: arms[i], at: [sx * hw, yb, zStile], dir: [-sx, 0, 0], mate: back });
    });
  });
  b.step({
    title: "Raise the back and bolt it on",
    detail: "Lift the back up between the armrests so the bolts go through its posts. A washer either side of each post and a nut, done up with the spanner.",
    kind: "bolts",
    tools: ["allen", "wrench"],
  }, () => {
    b.add(back);
    sides.forEach((sx) => {
      b.fit(R_WASHER, { on: back, at: [sx * sw, yb, zStile], dir: [-sx, 0, 0] });
      b.fit(R_WASHER, { on: back, at: [sx * bx, yb, zStile], dir: [sx, 0, 0] });
      b.fit(R_NUT, { on: back, at: [sx * (bx - 2), yb, zStile], dir: [sx, 0, 0] });
    });
  });
}

/* ---------- the folding chair and stool, sold assembled ---------- */

/** The folding chair comes assembled (its page has no manual): unfold it, press the seat down, and the cushion goes on. */
function foldingChair(s: ProductSpec, cushion: boolean): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const yS = 450, xb = W / 2 - 20, xf = xb - 30;
  const frame = group("F", "Chair frame", [
    ...[-1, 1].map((sx) => ({ ...strut([sx * xb, 0, -D / 2 + 60], [sx * xb, H, -D / 2 + 20], 40, 22, "x"), size: [40, 22, Math.hypot(H, 40)] as Vec3 })),
    ...[-1, 1].map((sx) => strut([sx * xf, 0, D / 2 - 30], [sx * xf, yS - 20, -D / 2 + 90], 22, 40, "x")),
    box(-xb + 20, xb - 20, H - 150, H - 70, -D / 2 + 22, -D / 2 + 42),
    box(-xb + 20, xb - 20, H - 260, H - 190, -D / 2 + 26, -D / 2 + 46),
    box(-xf + 11, xf - 11, 90, 130, D / 2 - 60, D / 2 - 40),
    box(-xb + 20, xb - 20, 90, 130, -D / 2 + 50, -D / 2 + 70),
  ]);
  const seat = group("S", "Seat", slats(-xf + 11, xf - 11, -D / 2 + 70, D / 2 - 20, yS - 22, yS, 7, "x", 8));
  const parts: CustomPart[] = [frame, seat];
  if (cushion) parts.push({ id: "C", name: "Seat cushion", size: [W - 80, 40, D - 100], pos: [0, yS + 20, 15], material: "soft" });
  const steps: CustomStep[] = [
    { title: "Take the folded chair out of the box", detail: "It comes assembled, with nothing to screw together. Stand it on its feet, still folded.", add: ["F"], from: { F: [0, 300, 0] } },
    { title: "Unfold it and press the seat down", detail: "Pull the back and the front legs apart, then push the seat down until it lies flat on its rails.", add: ["S"], from: { S: [0, 260, -200] } },
    ...(cushion ? [{ title: "Tie the cushion on", detail: "Lay it on the seat and tie its straps round the back legs.", add: ["C"] }] : []),
    { title: "Check it stands steady", detail: "All four feet should touch the floor. To fold it, lift the front edge of the seat. Keep it dry and indoors over winter." },
  ];
  return { parts, steps };
}

/** The folding stool comes assembled too: two leg frames crossed on a pin, the slatted seat hinged on top. */
function foldingStool(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const yS = H - 22, x0 = W / 2 - 22, x1 = x0 - 26;
  const legs = (id: string, x: number, flip: -1 | 1) =>
    group(id, "Leg frame", [
      ...[-1, 1].map((sx) => strut([sx * x, 0, flip * (D / 2 - 30)], [sx * x, yS - 10, -flip * (D / 2 - 40)], 40, 24, "x")),
      box(-x + 12, x - 12, 30, 70, flip * (D / 2 - 40) - 12, flip * (D / 2 - 40) + 12),
    ]);
  const seat = group("S", "Seat", [box(-W / 2, -W / 2 + 22, yS - 40, yS, -D / 2, D / 2), box(W / 2 - 22, W / 2, yS - 40, yS, -D / 2, D / 2), ...slats(-W / 2 + 22, W / 2 - 22, -D / 2, D / 2, yS, H, 6, "z", 8)]);
  const parts: CustomPart[] = [legs("A", x0, 1), legs("B", x1, -1), seat];
  const steps: CustomStep[] = [
    { title: "Take the folded stool out of the box", detail: "It comes assembled, with nothing to screw together. Hold it by the seat, legs down.", add: ["A", "B", "S"], from: { A: [0, 300, 0], B: [0, 300, 0], S: [0, 300, 0] } },
    { title: "Open the legs", detail: "Let the two leg frames swing apart until the seat lies flat and they stand on the floor. To fold it, lift the seat by one edge." },
  ];
  return { parts, steps };
}

const family: Family = {
  names: ["NÄMMARÖ"],
  build(b, s) {
    if (!/^nammaro-reclining-chair/.test(s.slug ?? "")) return false;
    recliner(b, s);
    return true;
  },
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^nammaro-chair-outdoor$/.test(slug)) return foldingChair(s, false);
    if (/^nammaro-chair$/.test(slug)) return foldingChair(s, true);
    if (/^nammaro-stool-outdoor/.test(slug)) return foldingStool(s);
    if (/^nammaro-table-outdoor-(140|200)/.test(slug)) return longTable(s);
    if (/^nammaro-table-outdoor-75/.test(slug)) return smallTable(s);
    if (/^nammaro-table-outdoor-130/.test(slug)) return roundTable(s);
    if (/^nammaro-bench-outdoor/.test(slug)) return bench(s);
    if (/^nammaro-bar-stool/.test(slug)) return barStool(s);
    if (/^nammaro-bar-table/.test(slug)) return barTable(s);
    if (/^nammaro-chair-armrests/.test(slug)) return armed(s, { seatY: 420, armY: 640, tilt: 0.21, seatScrews: 2, backDowels: 0, sideScrew: false });
    if (/^nammaro-lounge-chair/.test(slug)) return armed(s, { seatY: 300, armY: 560, tilt: 0.33, seatScrews: 2, backDowels: 0, sideScrew: true });
    if (/^nammaro-bench-backrest/.test(slug)) return armed(s, { seatY: 420, armY: 640, tilt: 0.21, seatScrews: 4, backDowels: 2, sideScrew: true });
    if (/^nammaro-sun-lounger/.test(slug)) return lounger(s);
    if (/^nammaro-open-kitchen-unit/.test(slug)) return kitchen(s);
    if (/^nammaro-shelving-unit/.test(slug)) return shelving(s);
    if (/^nammaro-modular-easy-chair/.test(slug)) return sofa(s, { seats: 1, stool: false, arms: 0, cushions: true, deep: false });
    if (/^nammaro-2-seat-sofa-126/.test(slug)) return sofa(s, { seats: 2, stool: false, arms: 0, cushions: true, deep: false });
    if (/^nammaro-2-seat-sofa-147/.test(slug)) return sofa(s, { seats: 2, stool: false, arms: 2, cushions: false, deep: false });
    if (/^nammaro-3-seat-sofa-264/.test(slug)) return sofa(s, { seats: 3, stool: true, arms: 1, cushions: true, deep: true });
    return null;
  },
};
export default family;
