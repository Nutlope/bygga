import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, PartMaterial, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { HwDef, PlanBuilder } from "../builder";
import { boxOf } from "../custom";
import { rotate } from "../math";

/**
 * BONDHOLMEN, read from IKEA's manuals: outdoor furniture in solid acacia, joined with long Allen bolts into barrel
 * nuts. The armchair and the 2-seat sofa share one build: the edge strip on the seat, the back screwed to it, then it
 * lies on one side for a side frame and is turned over for the other. The chair with armrests and the bench start
 * from one side and add the back, the seat and the other side. The tables are built upside down: the round one from
 * four leg frames doweled into a cross, the long one from an apron screwed under the top with folding leg frames and
 * braces. The reclining chair is built folded flat, lying on its back, then stood up and opened out.
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

/** A box on the left (sx -1) or right (sx 1) side, given its distances a..b from the middle. */
const side = (sx: number, a: number, b: number, y0: number, y1: number, z0: number, z1: number): Pc => (sx > 0 ? box(a, b, y0, y1, z0, z1) : box(-b, -a, y0, y1, z0, z1));

/** A box from one end point to another in a plane of constant z, turned about z to join them. */
function strut(a: Vec3, b: Vec3, w: number, t: number): Pc {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return { size: [Math.hypot(dx, dy), w, t], pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rot: [0, 0, Math.atan2(dy, dx)] };
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

const at = (kind: Kind, pts: Vec3[], dir: Vec3, on?: string, mate?: string, o: { len?: number; dia?: number; name?: string } = {}): CustomFix => ({ kind, count: pts.length, at: pts, dir, on, mate, ...o });
const spread = (a: number, b: number, n: number) => (n === 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));

/**
 * A frame leaning back by `tilt` from a bottom line at (y0, z0): x across, v up along the lean, w out of its face.
 * Gives boxes in that plane and the strips of the diamonds.
 */
function leaning(tilt: number, y0: number, z0: number) {
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const p = (x: number, v: number, w: number): Vec3 => [x, y0 + c * v + s * w, z0 - s * v + c * w];
  const piece = (x0: number, x1: number, v0: number, v1: number, w0: number, w1: number, material?: PartMaterial): Pc => ({
    size: [x1 - x0, v1 - v0, w1 - w0],
    pos: p((x0 + x1) / 2, (v0 + v1) / 2, (w0 + w1) / 2),
    rot: [-tilt, 0, 0],
    material,
  });
  const strip = (ax: number, av: number, bx: number, bv: number, wd: number, w0: number, w1: number): Pc => ({
    size: [Math.hypot(bx - ax, bv - av), wd, w1 - w0],
    pos: p((ax + bx) / 2, (av + bv) / 2, (w0 + w1) / 2),
    rot: [-tilt, 0, Math.atan2(bv - av, bx - ax)],
  });
  /** A diamond of four strips filling the bay x0..x1, v0..v1. */
  const diamond = (x0: number, x1: number, v0: number, v1: number, w0: number, w1: number): Pc[] => {
    const xm = (x0 + x1) / 2, vm = (v0 + v1) / 2, i = 14;
    const L: [number, number] = [x0 + i, vm], T: [number, number] = [xm, v1 - i], R: [number, number] = [x1 - i, vm], B: [number, number] = [xm, v0 + i];
    return [[L, T], [T, R], [R, B], [B, L]].map(([a, b]) => strip(a[0], a[1], b[0], b[1], 18, w0, w1));
  };
  /** n bays of diamonds between x0 and x1, split by posts of width pw. */
  const bays = (x0: number, x1: number, v0: number, v1: number, n: number, w0: number, w1: number, pw = 40): Pc[] => {
    const bw = (x1 - x0 - (n - 1) * pw) / n;
    const out: Pc[] = [];
    for (let i = 0; i < n; i++) {
      const a = x0 + i * (bw + pw);
      out.push(...diamond(a, a + bw, v0, v1, w0, w1));
      if (i < n - 1) out.push(piece(a + bw, a + bw + pw, v0, v1, w0, w1));
    }
    return out;
  };
  return { p, piece, strip, diamond, bays, len: (y: number) => (y - y0) / c };
}

// the fittings, by what they look like in the manuals
const LONG = { len: 120, dia: 6 }; // the long bolt threaded all the way
const BOLT = { len: 90, dia: 6 }; // the bolt with a plain shank
const SHORT = { len: 50, dia: 6 };
const BARREL = { len: 25, dia: 10, name: "Barrel nut" };
const SMALL_BARREL = { len: 14, dia: 10, name: "Small barrel nut" };
const SPACER = { len: 8, dia: 22, name: "Spacer washer" };
const WASHER = { len: 2, dia: 18 };
const DOWEL = { len: 40, dia: 8 };
const PIN = { len: 60, dia: 8, name: "Metal pin" };

/* ---------- armchair and 2-seat sofa ---------- */

/**
 * The seat gets its edge strip, the back is screwed to the seat's back rail, then the two lie on their left ends.
 * Each side frame (legs, armrest and side rail in one piece) is laid on top and bolted three times: low through the
 * back leg into the back (with a thick spacer washer), through the end of the armrest into the back, and through
 * the front leg into the seat.
 */
function easy(s: ProductSpec, sofa: boolean): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const hw = W / 2, xi = hw - 75; // the side frames' inner faces
  const HB = 730, armY = 600, tilt = 0.2;
  const zf = D / 2 - 55, zs0 = -D / 2 + 140; // the seat, front to back
  const legF: [number, number] = [D / 2 - 95, D / 2 - 40], legB: [number, number] = [-D / 2 + 40, -D / 2 + 95];
  const frame = (id: string, sx: -1 | 1) =>
    group(id, "Side frame", [
      side(sx, xi + 10, hw - 10, 0, armY - 28, legF[0], legF[1]),
      side(sx, xi + 10, hw - 10, 0, armY - 28, legB[0], legB[1]),
      side(sx, xi, hw, armY - 28, armY, -D / 2 + 25, D / 2),
      side(sx, xi + 18, hw - 18, 235, 300, legB[1], legF[0]),
    ]);
  const ns = Math.round((2 * xi - 60) / 62);
  const seat = group("S", "Seat", [
    box(-xi, -xi + 30, 250, 300, zs0, zf),
    box(xi - 30, xi, 250, 300, zs0, zf),
    box(-xi + 30, xi - 30, 220, 300, zf - 30, zf),
    box(-xi + 30, xi - 30, 250, 300, zs0, zs0 + 30),
    ...slats(-xi + 30, xi - 30, zs0 + 30, zf - 30, 282, 300, ns, "z", 12),
  ]);
  const edge = group("E", "Back edge", [box(-xi + 30, xi - 30, 300, 340, zs0, zs0 + 22)]);
  const lb = leaning(tilt, 240, zs0 - 15);
  const L = lb.len(HB), vm = lb.len(520);
  const back = group("K", "Back", [
    lb.piece(-xi, -xi + 44, 0, L, -15, 15),
    lb.piece(xi - 44, xi, 0, L, -15, 15),
    lb.piece(-xi + 44, xi - 44, 0, 60, -15, 15),
    lb.piece(-xi + 44, xi - 44, vm, vm + 40, -15, 15),
    lb.piece(-xi + 44, xi - 44, L - 50, L, -15, 15),
    ...lb.bays(-xi + 44, xi - 44, vm + 40, L - 50, sofa ? 2 : 1, -10, 10),
  ]);
  const cushioned = !/-139-x-81-x-73/.test(s.slug ?? "");
  const parts: CustomPart[] = [seat, edge, back, frame("SR", 1), frame("SL", -1)];
  const n = sofa ? 2 : 1;
  if (cushioned) {
    const cw = (2 * xi) / n;
    for (let i = 0; i < n; i++) parts.push(group(`C${i}`, "Seat cushion", [box(-xi + i * cw + 3, -xi + (i + 1) * cw - 3, 300, 440, zs0 + 22, zf + 10)], { material: "soft" }));
    for (let i = 0; i < n; i++) parts.push(group(`B${i}`, "Back cushion", [lb.piece(-xi + i * cw + 3, -xi + (i + 1) * cw - 3, lb.len(445), lb.len(H), 16, 130)], { material: "soft" }));
  }
  const zStile = (y: number) => zs0 - 15 - (y - 240) * Math.tan(tilt);
  const yA = 430, yB = armY - 14, zC = (legF[0] + legF[1]) / 2;
  const bolts = (sx: -1 | 1) => {
    const id = sx < 0 ? "SL" : "SR";
    return {
      low: [
        at("nut", [[sx * (xi - 22), yA, zStile(yA) - 20]], [0, 0, 1], "K", undefined, BARREL),
        at("washer", [[sx * xi, yA, zStile(yA)]], [-sx, 0, 0], id, undefined, SPACER),
        at("bolt", [[sx * hw, yA, zStile(yA)]], [-sx, 0, 0], id, undefined, LONG),
      ],
      arm: [
        at("nut", [[sx * (xi - 22), yB, zStile(yB) - 20]], [0, 0, 1], "K", undefined, BARREL),
        at("washer", [[sx * hw, yB, zStile(yB)]], [-sx, 0, 0], id, undefined, WASHER),
        at("bolt", [[sx * hw, yB, zStile(yB)]], [-sx, 0, 0], id, undefined, LONG),
      ],
      front: [at("nut", [[sx * (xi - 15), 250, zC]], [0, 1, 0], "S", undefined, BARREL), at("bolt", [[sx * hw, 272, zC]], [-sx, 0, 0], id, undefined, BOLT)],
    };
  };
  const sideSteps = (sx: -1 | 1, first: boolean): CustomStep[] => {
    const b = bolts(sx);
    const name = sx > 0 ? "right" : "left";
    return [
      {
        title: first ? `Lay the ${name} side frame on and bolt its back leg` : `Turn it over and bolt on the ${name} side frame`,
        detail: "A barrel nut into the back, slot facing the hole. The long bolt goes in through the thick spacer washer, by hand for now.",
        add: [sx > 0 ? "SR" : "SL"],
        fix: b.low,
        tools: ["allen", "flathead"],
        ...(first ? {} : { pose: "-x" as const, people: 2 as const, warnings: ["two" as const] }),
      },
      { title: "Bolt the armrest to the back", detail: "Another barrel nut, then a long bolt with the thin washer through the end of the armrest.", fix: b.arm, tools: ["allen", "flathead"] },
      { title: "Bolt the front leg to the seat", detail: "Barrel nut first, then the bolt with the plain shank through the front leg.", fix: b.front, tools: ["allen", "flathead"] },
      { title: "Tighten the three bolts", detail: "Hold each barrel nut straight with a screwdriver. The bolt heads should sit flush with the wood.", tools: ["allen", "flathead"] },
    ];
  };
  const steps: CustomStep[] = [
    {
      title: "Screw the edge strip onto the seat",
      detail: `Lay the seat slats up on a rug. The strip goes along the back rail, ${sofa ? "four" : "two"} screws down through it.`,
      add: ["S", "E"],
      fix: [at("screw", spread(-xi + 120, xi - 120, sofa ? 4 : 2).map((x) => [x, 340, zs0 + 11] as Vec3), [0, -1, 0], "E", undefined, { len: 40, dia: 4 })],
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    {
      title: "Screw the back to the seat",
      detail: `Stand the seat and the back on their left ends, the back behind the seat. ${sofa ? "Eight" : "Four"} short screws through the back's bottom rail.`,
      add: ["K"],
      fix: [at("screw", spread(-xi + 70, xi - 70, sofa ? 8 : 4).map((x) => [x, 272, zs0 - 30] as Vec3), [0, 0, 1], "K", undefined, { len: 16, dia: 4 })],
      tools: ["screwdriver"],
      pose: "+x",
      people: 2,
      warnings: ["two"],
    },
    ...sideSteps(1, true),
    ...sideSteps(-1, false),
    cushioned
      ? { title: "Stand it up and lay the cushions on", detail: "Lift it onto its feet together. The seat cushions sit against the edge strip, the back cushions lean on the back.", add: [...Array.from({ length: n }, (_, i) => `C${i}`), ...Array.from({ length: n }, (_, i) => `B${i}`)], pose: "+y", people: 2, kind: "cushions" }
      : { title: "Stand it on its feet", detail: "Lift it, don't drag it, and check it doesn't rock.", pose: "+y", people: 2, check: "square" },
  ];
  return { parts, steps };
}

/* ---------- chair with armrests ---------- */

/**
 * Built lying on its left side: the left back leg on the floor, the diamond back and the seat bolted to it, the right
 * back leg on top, then an armrest frame (front leg and armrest in one piece) on each side.
 */
function chair(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const hw = W / 2, tilt = 0.17;
  const px0 = hw - 95, px1 = hw - 55; // back legs
  const zp = -D / 2 + 90, ySeat = 420, armY = 668;
  const lean = leaning(tilt, ySeat, zp);
  const zAt = (y: number) => zp - (y - ySeat) * Math.tan(tilt);
  const backLeg = (id: string, sx: -1 | 1) =>
    group(id, "Back leg", [side(sx, px0, px1, 0, ySeat, zp - 20, zp + 20), { ...lean.piece(0, px1 - px0, 0, lean.len(H), -20, 20), pos: [sx * (px0 + px1) / 2, lean.p(0, lean.len(H) / 2, 0)[1], lean.p(0, lean.len(H) / 2, 0)[2]] }]);
  const zf0 = D / 2 - 60, zf1 = D / 2 - 15;
  const armFrame = (id: string, sx: -1 | 1) =>
    group(id, "Armrest frame", [side(sx, hw - 50, hw - 5, 0, armY - 28, zf0, zf1), side(sx, px1, hw, armY - 28, armY, zAt(armY - 14) - 25, D / 2 + 5)]);
  const v1 = lean.len(590), v2 = lean.len(H - 12);
  const back = group("K", "Back", [
    lean.piece(-px0, -px0 + 20, v1, v2, -15, 15),
    lean.piece(px0 - 20, px0, v1, v2, -15, 15),
    lean.piece(-px0 + 20, px0 - 20, v1, v1 + 40, -15, 15),
    lean.piece(-px0 + 20, px0 - 20, v2 - 45, v2, -15, 15),
    ...lean.diamond(-px0 + 20, px0 - 20, v1 + 40, v2 - 45, -10, 10),
  ]);
  const seat = group("S", "Seat", [
    box(-(hw - 50), hw - 50, ySeat - 55, ySeat, zf0 + 5, zf0 + 35),
    box(-px0, px0, ySeat - 50, ySeat, zp - 15, zp + 15),
    ...slats(-px0 + 6, px0 - 6, zp + 15, zf0 + 5, ySeat - 20, ySeat, Math.round((2 * px0) / 60), "z", 10),
  ]);
  const parts = [backLeg("PL", -1), back, seat, backLeg("PR", 1), armFrame("AR", 1), armFrame("AL", -1)];
  const vb = (v1 + v2) / 2, yb = lean.p(0, vb, 0)[1];
  const backBolt = (sx: -1 | 1) => [
    at("nut", [[sx * (px0 - 10), yb, zAt(yb) - 15]], [0, 0, 1], "K", undefined, BARREL),
    at("bolt", [[sx * px1, yb, zAt(yb)]], [-sx, 0, 0], sx < 0 ? "PL" : "PR", undefined, SHORT),
  ];
  const seatBolt = (sx: -1 | 1) => [
    at("nut", [[sx * (px0 - 25), ySeat - 50, zp]], [0, 1, 0], "S", undefined, BARREL),
    at("bolt", [[sx * px1, ySeat - 25, zp]], [-sx, 0, 0], sx < 0 ? "PL" : "PR", undefined, BOLT),
  ];
  const yArm = armY - 14;
  const armBolts = (sx: -1 | 1) => {
    const id = sx < 0 ? "AL" : "AR";
    const zc = (zf0 + zf1) / 2;
    return [
      at("nut", [[sx * (hw - 75), ySeat - 55, zc]], [0, 1, 0], "S", undefined, BARREL),
      at("bolt", [[sx * (hw - 5), ySeat - 28, zc]], [-sx, 0, 0], id, undefined, BOLT),
      at("nut", [[sx * (px0 + 20), yArm, zAt(yArm) - 20]], [0, 0, 1], sx < 0 ? "PL" : "PR", undefined, BARREL),
      at("washer", [[sx * px1, yArm, zAt(yArm)]], [-sx, 0, 0], id, undefined, SPACER),
      at("bolt", [[sx * hw, yArm, zAt(yArm)]], [-sx, 0, 0], id, undefined, BOLT),
    ];
  };
  const steps: CustomStep[] = [
    {
      title: "Bolt the back to the left back leg",
      detail: "Lay the leg flat on a rug. A barrel nut into the side of the back, then the short bolt through the leg.",
      add: ["PL", "K"],
      fix: backBolt(-1),
      tools: ["allen", "flathead"],
      pose: "+x",
      warnings: ["floor"],
    },
    { title: "Bolt the seat to the leg", detail: "The seat stands on its side, slats facing the back. Barrel nut in its back rail, then a long bolt through the leg.", add: ["S"], fix: seatBolt(-1), tools: ["allen", "flathead"] },
    { title: "Lay the right back leg on top", detail: "A barrel nut into the back and the short bolt through the leg, by hand.", add: ["PR"], fix: backBolt(1), tools: ["allen", "flathead"] },
    { title: "Bolt the right leg to the seat", detail: "Barrel nut, then a long bolt into the seat's back rail.", fix: seatBolt(1), tools: ["allen", "flathead"] },
    {
      title: "Bolt on the right armrest",
      detail: "One long bolt through the front leg into the seat. The other goes through the end of the armrest, with the thick spacer washer between it and the back leg.",
      add: ["AR"],
      fix: armBolts(1),
      tools: ["allen", "flathead"],
    },
    { title: "Turn it over and bolt on the left armrest", detail: "The same two bolts, barrel nuts and spacer washer.", add: ["AL"], fix: armBolts(-1), tools: ["allen", "flathead"], pose: "-x" },
    { title: "Stand it up and tighten the bolts", detail: "On its feet, check it stands square, then tighten the four seat bolts with the Allen key.", tools: ["allen"], pose: "+y", check: "square" },
  ];
  return { parts, steps };
}

/* ---------- bench with backrest ---------- */

/**
 * Each side frame gets its armrest first. Then the bench is built lying on its back: the diamond back doweled and
 * bolted to the left frame, the seat doweled and bolted to it, the right frame over both ends, stood up to tighten.
 */
function bench(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const hw = W / 2, xi = hw - 60, xo = hw - 15; // the side frames
  const tilt = 0.17, zp = -D / 2 + 97, ySeat = 420, armY = 650;
  const zf0 = D / 2 - 60, zf1 = D / 2 - 15;
  const lean = leaning(tilt, ySeat, zp);
  const zAt = (y: number) => zp - (y - ySeat) * Math.tan(tilt);
  const frame = (id: string, sx: -1 | 1) =>
    group(id, "Side frame", [
      side(sx, xi, xo, 0, ySeat, zp - 22, zp + 22),
      { ...lean.piece(0, xo - xi, 0, lean.len(H), -22, 22), pos: [sx * (xi + xo) / 2, lean.p(0, lean.len(H) / 2, 0)[1], lean.p(0, lean.len(H) / 2, 0)[2]] },
      side(sx, xi, xo, 0, armY - 30, zf0, zf1),
      side(sx, xi + 5, xo - 5, 340, 390, zp + 22, zf0),
      side(sx, xi + 5, xo - 5, 120, 160, zp + 22, zf0),
    ]);
  const arm = (id: string, sx: -1 | 1) => group(id, "Armrest", [side(sx, xi - 10, hw, armY - 30, armY, zAt(armY - 15) + 23, D / 2 + 10)]);
  const v1 = lean.len(560), v2 = lean.len(H - 15);
  const back = group("K", "Back", [
    lean.piece(-xi, xi, v1, v1 + 45, -15, 15),
    lean.piece(-xi, xi, v2 - 50, v2, -15, 15),
    lean.piece(-xi, -xi + 30, v1 + 45, v2 - 50, -15, 15),
    lean.piece(xi - 30, xi, v1 + 45, v2 - 50, -15, 15),
    ...lean.bays(-xi + 30, xi - 30, v1 + 45, v2 - 50, 3, -10, 10),
  ]);
  const seat = group("S", "Seat", [
    box(-xi, xi, ySeat - 60, ySeat - 10, zf0 + 5, zf0 + 35),
    box(-xi, xi, ySeat - 60, ySeat - 10, zp - 15, zp + 15),
    ...slats(-xi + 6, xi - 6, zp + 15, zf0 + 5, ySeat - 20, ySeat, Math.round((2 * xi) / 60), "z", 10),
  ]);
  const parts = [frame("FL", -1), arm("AL", -1), back, seat, frame("FR", 1), arm("AR", 1)];
  const armBolts = (sx: -1 | 1) => {
    const f = sx < 0 ? "FL" : "FR", a = sx < 0 ? "AL" : "AR";
    const ya = armY - 15;
    return [
      at("bolt", [[sx * (xi + xo) / 2, armY, (zf0 + zf1) / 2]], [0, -1, 0], a, undefined, { len: 60, dia: 6 }),
      at("bolt", [-12, 12].map((dx) => [sx * (xi + xo) / 2 + dx, ya, zAt(ya) - 22] as Vec3), [0, 0, 1], f, undefined, { len: 60, dia: 6 }),
    ];
  };
  const yb1 = lean.p(0, v1 + 22, 0)[1], yb2 = lean.p(0, v2 - 25, 0)[1];
  const backBolts = (sx: -1 | 1) => [
    at("nut", [yb1, yb2].map((y) => [sx * (xi - 25), y, zAt(y) - 15] as Vec3), [0, 0, 1], "K", undefined, BARREL),
    at("bolt", [yb1, yb2].map((y) => [sx * xo, y, zAt(y)] as Vec3), [-sx, 0, 0], sx < 0 ? "FL" : "FR", undefined, BOLT),
  ];
  const seatBolts = (sx: -1 | 1) => [
    at("nut", [zp, zf0 + 20].map((z) => [sx * (xi - 25), ySeat - 60, z] as Vec3), [0, 1, 0], "S", undefined, BARREL),
    at("bolt", [zp, zf0 + 20].map((z) => [sx * xo, ySeat - 35, z] as Vec3), [-sx, 0, 0], sx < 0 ? "FL" : "FR", undefined, BOLT),
  ];
  const steps: CustomStep[] = [
    {
      title: "Push an armrest onto each side frame",
      detail: "Lay the frames flat on a rug. Each armrest goes over the top of the front leg and against the back post. The second frame waits until the end.",
      add: ["FL", "AL"],
      warnings: ["floor"],
    },
    { title: "Bolt the armrests on", detail: "Three short bolts in each frame, with the Allen key. Use the short bolts here, not the long ones.", fix: armBolts(-1), tools: ["allen"] },
    { title: "Tap a dowel into each end of the back", detail: "One in each end, into the hole beside the bolt hole.", fix: [at("dowel", [-1, 1].map((sx) => [sx * xi, yb1 + 60, zAt(yb1 + 60)] as Vec3), [-1, 0, 0], "K", undefined, DOWEL)], tools: ["hammer"] },
    {
      title: "Bolt the back to the left side frame",
      detail: "Lay the frame on its back edge with the back panel beside it. Two barrel nuts into the back, then two long bolts through the post.",
      add: ["K"],
      fix: backBolts(-1),
      tools: ["allen", "flathead"],
      pose: "+z",
    },
    { title: "Tap the dowels into the seat", detail: "Two into each end of both rails, eight in all.", fix: [-1, 1].flatMap((sx) => [at("dowel", [zp, zf0 + 20].flatMap((z) => [ySeat - 45, ySeat - 25].map((y) => [sx * xi, y, z] as Vec3)), [sx, 0, 0], "S", undefined, DOWEL)]), tools: ["hammer"] },
    { title: "Push the seat into the side frame", detail: "Slats facing the back panel, its dowels into the holes in the frame.", add: ["S"] },
    { title: "Bolt the seat to the side frame", detail: "Two barrel nuts into the seat rails, two long bolts through the frame.", fix: seatBolts(-1), tools: ["allen", "flathead"] },
    {
      title: "Fit the other side frame",
      detail: "Bolt its armrest on with three short bolts as before. Then push it over the ends of the back and seat: four barrel nuts, four long bolts.",
      add: ["FR", "AR"],
      fix: [...armBolts(1), ...backBolts(1), ...seatBolts(1)],
      tools: ["allen", "flathead"],
      people: 2,
      warnings: ["two"],
    },
    { title: "Stand it up and tighten the bolts", detail: "On its feet, check it stands square, then tighten all eight long bolts.", tools: ["allen"], pose: "+y", people: 2, check: "square" },
  ];
  return { parts, steps };
}

/* ---------- round table ---------- */

/** Four leg frames doweled into two corners, the corners into a cross and bolted top and bottom, set on the top. */
function roundTable(s: ProductSpec): CustomParams {
  const R = (s.size.w * 10) / 2, H = s.size.h * 10;
  const tt = 25, yT = H - tt, t = 20; // half the frames' thickness
  const aTop = yT - 60, fTop = 60;
  type Q = { id: string; ax: "x" | "z"; sg: -1 | 1 };
  const qs: Q[] = [
    { id: "Q1", ax: "x", sg: 1 },
    { id: "Q2", ax: "z", sg: 1 },
    { id: "Q3", ax: "x", sg: -1 },
    { id: "Q4", ax: "z", sg: -1 },
  ];
  const rb = (q: Q, r0: number, r1: number, y0: number, y1: number, c = t): Pc => {
    const a = q.sg > 0 ? r0 : -r1, b = q.sg > 0 ? r1 : -r0;
    return q.ax === "x" ? box(a, b, y0, y1, -c, c) : box(-c, c, y0, y1, a, b);
  };
  const r0 = (q: Q) => (q.ax === "x" ? 0 : t);
  const leg = (q: Q) =>
    group(q.id, "Leg frame", [
      rb(q, r0(q), R - 70, aTop, yT),
      rb(q, r0(q), R - 20, 0, fTop),
      rb(q, 25, 70, fTop, aTop),
      rb(q, 300, 345, fTop, aTop),
    ]);
  const sw = 60, gap = 8;
  const nS = Math.floor(R / (sw + gap));
  const half = (sz: -1 | 1) => {
    const pcs: Pc[] = [];
    for (let i = 0; i < nS; i++) {
      const a = 4 + i * (sw + gap), b = a + sw;
      if (b >= R - 10) continue;
      const L = Math.sqrt(R * R - b * b);
      pcs.push(box(-L, L, yT, H, sz < 0 ? -b : a, sz < 0 ? -a : b));
    }
    return group(sz < 0 ? "TB" : "TF", "Table top half", pcs);
  };
  const parts: CustomPart[] = [...qs.map(leg), half(-1), half(1)];
  // all sixteen drawn in the first frame: its inner end meets the opposite frame, its sides the two crossing ones
  // spaced so no two fittings share a hole: the dowels near the band edges, the cross bolts between them
  const ys = [aTop + 12, yT - 12, 12, fTop - 12];
  const dowels: CustomFix[] = [
    at("dowel", ys.flatMap((y) => [-12, 12].map((z) => [0, y, z] as Vec3)), [-1, 0, 0], "Q1", undefined, DOWEL),
    ...([-1, 1] as const).map((sz) => at("dowel", ys.map((y) => [30, y, sz * t] as Vec3), [0, 0, sz], "Q1", undefined, DOWEL)),
  ];
  const cross = (y: number, ny: number, nut: typeof BARREL, ndir: Vec3) =>
    ([-1, 1] as const).flatMap((sz) => [
      at("nut", [-10, 10].map((x) => [x, ny, sz * 50] as Vec3), ndir, sz > 0 ? "Q2" : "Q4", undefined, nut),
      ...([-1, 1] as const).map((sx) => at("bolt", [[sx * 12, y, -sz * t]], [0, 0, sz], sx > 0 ? "Q1" : "Q3", undefined, BOLT)),
    ]);
  const steps: CustomStep[] = [
    { title: "Tap the dowels into the leg frames", detail: "Four into the inner end of each of the four frames, sixteen in all.", add: ["Q1"], fix: dowels, tools: ["hammer"], warnings: ["floor"] },
    { title: "Join two leg frames at a right angle", detail: "Push one frame's dowels into the side of the other to make a corner. Make the second corner the same way.", add: ["Q2"], from: { Q2: [0, 0, 300] } },
    { title: "Push the two corners together", detail: "Into a cross, the dowels meeting in the middle.", add: ["Q3", "Q4"], from: { Q3: [-400, 0, 0], Q4: [-400, 0, 0] } },
    { title: "Bolt the cross together at the top", detail: "Four barrel nuts down into the arms, slot facing the hole, then four long bolts across the middle.", fix: cross(yT - 30, yT, BARREL, [0, -1, 0]), tools: ["allen", "flathead"] },
    { title: "Turn it upside down and bolt the feet", detail: "The small barrel nuts go into the feet this time, then four more long bolts.", fix: cross(30, 0, SMALL_BARREL, [0, 1, 0]), tools: ["allen", "flathead"], pose: "-y" },
    {
      title: "Join the top halves with the pins",
      detail: "Lay both halves face down on a rug. Six pins into the edge of one, then push the other half on.",
      add: ["TB", "TF"],
      fix: [at("stud", spread(-R * 0.75, R * 0.75, 6).map((x) => [x, yT + tt / 2, 0] as Vec3), [0, 0, 1], "TB", "TF", PIN)],
      from: { TF: [0, 0, 300] },
      warnings: ["floor"],
    },
    { title: "Set the base upside down on the top", detail: "Centre it on the top, the join of the two halves running under one pair of arms." },
    { title: "Screw the arms to the top", detail: "One screw through the end of each arm, four in all.", fix: [at("screw", qs.map((q) => (q.ax === "x" ? [q.sg * (R - 120), aTop, 0] : [0, aTop, q.sg * (R - 120)]) as Vec3), [0, 1, 0], undefined, undefined, { len: 70, dia: 6 })], tools: ["allen"] },
    { title: "Turn the table over together", detail: "Lift it onto its feet and check it stands level.", pose: "+y", people: 2 },
  ];
  return { parts, steps };
}

/* ---------- long table ---------- */

/** Built upside down: two top halves pinned, an apron screwed to them, folding leg frames in the ends, braces to a block. */
function longTable(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25, yT = H - tt, rh = 90, rt = 28, fw = 60;
  const xr = W / 2 - 120, zr = D / 2 - 82; // apron's outer faces
  const xl = W / 2 - 180, zl = zr - rt - 22; // leg centres
  const half = (sx: -1 | 1) => {
    const x0 = sx < 0 ? -W / 2 : 0, x1 = sx < 0 ? 0 : W / 2;
    const ix0 = x0 + fw, ix1 = x1 - fw;
    const n = Math.round((D - 2 * fw) / 62);
    return group(sx < 0 ? "TL" : "TR", "Table top half", [
      box(x0, x1, yT, H, -D / 2, -D / 2 + fw),
      box(x0, x1, yT, H, D / 2 - fw, D / 2),
      box(x0, x0 + fw, yT, H, -D / 2 + fw, D / 2 - fw),
      box(x1 - fw, x1, yT, H, -D / 2 + fw, D / 2 - fw),
      ...slats(ix0 + 4, ix1 - 4, -D / 2 + fw, D / 2 - fw, yT + 4, H, n, "x", 8),
      box(sx < 0 ? -420 : 60, sx < 0 ? -60 : 420, yT - 20, yT, -40, 40),
    ]);
  };
  const rail = (id: string, sz: -1 | 1) => group(id, "Side rail", [box(-xr, xr, yT - rh, yT, sz > 0 ? zr - rt : -zr, sz > 0 ? zr : -zr + rt)]);
  const endRail = (id: string, sx: -1 | 1) => group(id, "End rail", [side(sx, xr - rt, xr, yT - rh, yT, -zr + rt, zr - rt)]);
  const legs = (id: string, sx: -1 | 1) =>
    group(id, "Leg frame", [
      box(sx * xl - 22, sx * xl + 22, 0, yT - 15, -zl - 22, -zl + 22),
      box(sx * xl - 22, sx * xl + 22, 0, yT - 15, zl - 22, zl + 22),
      box(sx * xl - 15, sx * xl + 15, 420, 470, -zl + 22, zl - 22),
    ]);
  const block = (id: string, sx: -1 | 1) => group(id, "Brace block", [side(sx, 60, 260, yT - 20 - 50, yT - 20, -30, 30)]);
  const brace = (id: string, sx: -1 | 1) => group(id, "Brace", [strut([sx * 200, yT - 70 - 20, 0], [sx * (xl - 15 - 20), 445, 0], 40, 30)]);
  const parts: CustomPart[] = [half(-1), half(1), rail("C1", -1), endRail("E1", -1), endRail("E2", 1), rail("C2", 1), legs("G1", -1), legs("G2", 1), block("B1", -1), block("B2", 1), brace("R1", -1), brace("R2", 1)];
  const pinZ = spread(-D / 2 + 140, D / 2 - 140, 4);
  const corner = (sz: -1 | 1) => {
    const id = sz < 0 ? "C1" : "C2";
    return [
      at("nut", [-1, 1].map((sx) => [sx * (xr - rt / 2), yT - rh, sz * (zr - rt - 40)] as Vec3), [0, 1, 0], undefined, undefined, BARREL),
      at("bolt", [-1, 1].map((sx) => [sx * (xr - rt / 2), yT - rh / 2, sz * zr] as Vec3), [0, 0, -sz], id, undefined, BOLT),
    ];
  };
  const railScrews = (sz: -1 | 1, xs: number[]) => at("screw", xs.map((x) => [x, yT - rh, sz * (zr - rt / 2)] as Vec3), [0, 1, 0], sz < 0 ? "C1" : "C2", undefined, { len: 100, dia: 5 });
  const pivots = (sz: -1 | 1) => at("washer", [-1, 1].map((sx) => [sx * xl, yT - 40, sz * (zr - rt)] as Vec3), [0, 0, sz], undefined, undefined, { len: 2, dia: 24 });
  const steps: CustomStep[] = [
    {
      title: "Lay the top halves face down",
      detail: "On a rug, side by side. Push two pins into the middle of one half's inner edge.",
      add: ["TL"],
      fix: [at("stud", [-60, 60].map((z) => [0, yT + tt / 2, z] as Vec3), [1, 0, 0], "TL", "TR", PIN)],
      pose: "-y",
      people: 2,
      warnings: ["two", "floor"],
    },
    {
      title: "Push the halves together",
      detail: "Four more pins, each with a spacer, then slide the second half onto all six until the edges meet.",
      add: ["TR"],
      fix: [at("stud", pinZ.map((z) => [0, yT + tt / 2, z] as Vec3), [1, 0, 0], "TL", "TR", PIN), at("washer", pinZ.map((z) => [0, yT + tt / 2, z] as Vec3), [1, 0, 0], "TL", undefined, { len: 6, dia: 16, name: "Spacer" })],
      from: { TR: [300, 0, 0] },
    },
    {
      title: "Join the end rails to a side rail",
      detail: "Tap two dowels into one end of each end rail and push them into the side rail.",
      add: ["C1", "E1", "E2"],
      fix: ([-1, 1] as const).map((sx) => at("dowel", [yT - 25, yT - rh + 25].map((y) => [sx * (xr - rt / 2), y, -zr + rt] as Vec3), [0, 0, -1], sx < 0 ? "E1" : "E2", undefined, DOWEL)),
      tools: ["hammer"],
    },
    { title: "Bolt the corners", detail: "A barrel nut into each end rail, slot facing the hole, then a long bolt through the side rail.", fix: corner(-1), tools: ["allen", "flathead"] },
    { title: "Screw the end rails to the top", detail: "Lay the frame on the upside-down top. Two long screws down through each end rail.", fix: ([-1, 1] as const).map((sx) => at("screw", [-200, 200].map((z) => [sx * (xr - rt / 2), yT - rh, z] as Vec3), [0, 1, 0], sx < 0 ? "E1" : "E2", undefined, { len: 100, dia: 5 })), tools: ["allen"] },
    { title: "Screw the side rail to the top", detail: "Four long screws along it.", fix: [railScrews(-1, [-800, -300, 300, 800])], tools: ["allen"] },
    { title: "Set the leg frames in at the ends", detail: "Each one's pivot goes into the hole in the side rail, with a washer between them.", add: ["G1", "G2"], fix: [pivots(-1)] },
    {
      title: "Fit the other side rail",
      detail: "Two dowels into each end rail, a washer on each pivot, then push the rail on so the pivots go into it.",
      add: ["C2"],
      fix: [...([-1, 1] as const).map((sx) => at("dowel", [yT - 25, yT - rh + 25].map((y) => [sx * (xr - rt / 2), y, zr - rt] as Vec3), [0, 0, 1], sx < 0 ? "E1" : "E2", undefined, DOWEL)), pivots(1)],
      tools: ["hammer"],
    },
    { title: "Screw the second side rail to the top", detail: "Six long screws along it.", fix: [railScrews(1, [-900, -540, -180, 180, 540, 900])], tools: ["allen"] },
    { title: "Tighten the screws at the ends", detail: "The four in the end rails, until the heads sit flush.", tools: ["allen"] },
    { title: "Bolt the second rail's corners", detail: "Barrel nuts into the end rails, long bolts through the side rail.", fix: corner(1), tools: ["allen", "flathead"] },
    { title: "Tighten the corner bolts", detail: "All four, firmly, now that the apron sits square.", tools: ["allen"], check: "square" },
    {
      title: "Screw the brace blocks to the middle",
      detail: "A dowel and two short bolts for each block, either side of the parasol hole.",
      add: ["B1", "B2"],
      fix: [
        at("dowel", [-1, 1].map((sx) => [sx * 160, yT - 20, 0] as Vec3), [0, -1, 0], undefined, undefined, DOWEL),
        at("bolt", [-1, 1].flatMap((sx) => [sx * 90, sx * 230].map((x) => [x, yT - 70, 0] as Vec3)), [0, 1, 0], undefined, undefined, { len: 40, dia: 6 }),
      ],
      tools: ["allen"],
    },
    {
      title: "Bolt the braces to the leg frames",
      detail: "Slide each brace into its block. A small barrel nut in its lower end, then a long bolt through the leg frame's crossbar.",
      add: ["R1", "R2"],
      fix: [
        at("nut", [-1, 1].map((sx) => [sx * (xl - 60), 470, 0] as Vec3), [0, -1, 0], undefined, undefined, SMALL_BARREL),
        ...([-1, 1] as const).map((sx) => at("bolt", [[sx * (xl + 15), 445, 0]], [-sx, 0, 0], sx < 0 ? "G1" : "G2", undefined, BOLT)),
      ],
      tools: ["allen", "flathead"],
    },
    {
      title: "Lock the braces with the wing bolts",
      detail: "A tube spacer over each hole, then turn the wing bolt down by hand. Loosen them to fold the legs.",
      fix: [
        at("washer", [-1, 1].map((sx) => [sx * 210, yT - 70, 0] as Vec3), [0, 1, 0], undefined, undefined, { len: 30, dia: 20, name: "Tube spacer" }),
        at("bolt", [-1, 1].map((sx) => [sx * 210, yT - 100, 0] as Vec3), [0, 1, 0], undefined, undefined, { len: 50, dia: 8, name: "Wing bolt" }),
      ],
    },
    { title: "Tighten the leg bolts and turn it over together", detail: "Tighten the four pivot bolts, then lift the table onto its legs.", tools: ["allen"], pose: "+y", people: 2 },
  ];
  return { parts, steps };
}

/* ---------- reclining chair ---------- */

const R_BOLT: HwDef = { kind: "bolt", len: 95, dia: 6 }; // through a leg or an armrest, into a nut
const R_LONG: HwDef = { kind: "bolt", ...LONG }; // into a barrel nut in a stretcher
const R_BARREL: HwDef = { kind: "nut", ...BARREL };
const R_NUT: HwDef = { kind: "nut", len: 6, dia: 10 };
const R_WASHER: HwDef = { kind: "washer", len: 1.5, dia: 16 };
const R_PIN_WASHER: HwDef = { kind: "washer", len: 2, dia: 20 };
const R_BIG_WASHER: HwDef = { kind: "washer", len: 3, dia: 26, name: "Large washer" };
const R_THICK: HwDef = { kind: "washer", len: 14, dia: 30, name: "Thick spacer" };
const R_TUBE: HwDef = { kind: "washer", len: 30, dia: 12, name: "Tube spacer" };
const R_SCREW: HwDef = { kind: "screw", len: 20, dia: 5 };
const R_DOWEL: HwDef = { kind: "dowel", ...DOWEL };
const R_BRACKET: HwDef = { kind: "bracket", len: 60, dia: 40, name: "Seat bracket" };

/** Where a point given in a part's own frame lands when that frame's origin sits at q, turned by a about x. */
const pivoted = (q: Vec3, a: number, v: Vec3): Vec3 => {
  const r = rotate(v, [a, 0, 0]);
  return [q[0] + r[0], q[1] + r[1], q[2] + r[2]];
};

/**
 * The reclining chair, from its manual: it is built folded flat, lying on its back. The brackets go on the foot of
 * the back, the seat lies on the back and is screwed into them, then each leg pair (two legs riveted at the top) is
 * bolted to the seat with the stretchers doweled and bolted between them. Stood up, it opens out with the back
 * folded down on the seat; the armrests clip onto the tops of the legs and the back is raised and bolted to them.
 * Every part turns about x between the folded and the open chair, so each is drawn in its own frame about the pivot.
 */
function recliner(b: PlanBuilder, s: ProductSpec) {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const hw = W / 2, sw = hw - 55, Ds = 460, ySeat = 430, tilt = 0.3;
  const ya = 620; // underside of the armrests
  const yA = ya - 14, zA = -0.077 * D, zF = 0.436 * D, zB = -0.385 * D; // the legs' top, front and back feet
  const xf = hw - 11, xb = hw - 33; // the front legs outside, the back legs inside them
  const onLeg = (foot: number, y: number) => zA + ((foot - zA) * (yA - y)) / yA;
  const yr = ySeat - 15;
  const P: Vec3 = [0, yr, onLeg(zB, yr)]; // the seat's back corners, where the brackets join seat, back and legs
  const yS = yr - 15;
  const S: Vec3 = [0, yS, onLeg(zF, yS)]; // the bolt through the front leg into the seat rail
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
  // the back, about the same pivot: v up its posts, the front face at w = -20
  const L = (H - yr) / Math.cos(tilt) - 10;
  const bx = sw - 40, v1 = 0.13 * L, v2 = 0.6 * L;
  const strip = (ax: number, av: number, bxx: number, bv: number): Pc => ({ size: [Math.hypot(bxx - ax, bv - av), 18, 18], pos: [(ax + bxx) / 2, (av + bv) / 2, -35], rot: [0, 0, Math.atan2(bv - av, bxx - ax)] });
  const dv0 = v2 + 45, dv1 = L - 50, dm = (dv0 + dv1) / 2, dx = bx - 70;
  const gap = (2 * bx - 5 * 40) / 6;
  const backT = b.compound("Back", pieces([
    box(-sw, -bx, -20, L, -50, -20),
    box(bx, sw, -20, L, -50, -20),
    box(-bx, bx, v1, v1 + 45, -48, -22),
    box(-bx, bx, v2, v2 + 45, -48, -22),
    box(-bx, bx, L - 50, L, -48, -22),
    ...Array.from({ length: 5 }, (_, i) => box(-bx + gap + i * (40 + gap), -bx + gap + i * (40 + gap) + 40, v1 + 45, v2, -44, -26)),
    ...[-1, 1].map((sx) => box(sx * dx - 15, sx * dx + 15, dv0, dv1, -44, -26)),
    strip(-dx + 15, dm, 0, dv1 - 8),
    strip(0, dv1 - 8, dx - 15, dm),
    strip(dx - 15, dm, 0, dv0 + 8),
    strip(0, dv0 + 8, -dx + 15, dm),
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
  const foldBack = () => b.stage(back, pivoted(Pk, 0, backT.mid), [0, 0, 0]);
  const foldSeat = () => b.stage(seat, pivoted(Pk, -Math.PI / 2, seatT.mid), [-Math.PI / 2, 0, 0], [0, 0, 300]);
  const yBf = lf.L - lb.L; // the back legs' feet, their tops level with the front legs'
  const foldLegs = (i: number) => {
    const sx = sides[i];
    b.stage(legF[i], [sx * xf, lf.L / 2, Pk[2] + 15], [0, 0, 0], [sx * 250, 0, 120]);
    b.stage(legB[i], [sx * xb, yBf + lb.L / 2, Pk[2] + 60], [0, 0, 0], [sx * 250, 0, 160]);
  };
  const strAt = (beside: boolean) => {
    b.stage(strF, beside ? [0, -140, z0 + 13] : [0, dStr, Pk[2] + 15], [0, 0, 0], beside ? [0, -200, 0] : undefined);
    b.stage(strB, beside ? [0, -220, z0 + 13] : [0, yBf + dStr, Pk[2] + 60], [0, 0, 0], beside ? [0, -200, 0] : undefined);
  };

  const sideBolts = (i: number) => {
    const sx = sides[i];
    b.fit(R_THICK, { on: legF[i], at: [sx * hf, yS, S[2]], dir: [-sx, 0, 0] });
    b.fit(R_BOLT, { on: legF[i], at: [sx * hw, yS, S[2]], dir: [-sx, 0, 0], mate: seat });
    b.fit(R_WASHER, { on: seat, at: [sx * rx, yS, S[2]], dir: [sx, 0, 0] });
    b.fit(R_NUT, { on: seat, at: [sx * (rx - 2), yS, S[2]], dir: [sx, 0, 0] });
    b.fit(R_BIG_WASHER, { on: back, at: [sx * (hb - 1), yr, P[2]], dir: [-sx, 0, 0] });
  };
  const strBolts = (i: number) => {
    const sx = sides[i];
    for (const [k, c, a, h] of [[strF, cF, lf.a, hf], [strB, cB, lb.a, hb]] as const)
      b.fit(R_BARREL, { on: k, at: pivoted(c, a, [sx * (h - 35), 25, 0]), dir: rotate([0, -1, 0], [a, 0, 0]) });
    b.fit(R_LONG, { on: legF[i], at: [sx * hw, cF[1], cF[2]], dir: [-sx, 0, 0], mate: strF });
    b.fit(R_LONG, { on: legB[i], at: [sx * hf, cB[1], cB[2]], dir: [-sx, 0, 0], mate: strB });
  };
  const lying = { pose: "+z" as const };

  b.step({ title: "Put a washer on each bracket", detail: "Lay the back front up on a rug. The thin washer goes over the bracket's pin, not the thick spacers.", kind: "general", warnings: ["floor"], ...lying }, () => {
    foldBack();
    for (const sx of sides) b.fit(R_PIN_WASHER, { on: back, at: [sx * (sw + 1), yr, P[2]], dir: [-sx, 0, 0] });
  });
  b.step({ title: "Push the brackets onto the foot of the back", detail: "The pin with the washer goes into the hole at the bottom of each side post.", kind: "general", ...lying }, () => {
    for (const sx of sides) b.fit(R_BRACKET, { on: back, at: [sx * (sw + 4), yr, P[2]], dir: [-sx, 0, 0] });
  });
  b.step({ title: "Lay the seat on the back", detail: "Upside down, its back edge towards the brackets. Slide it down until the ends of its side rails sit in them.", kind: "general", ...lying }, foldSeat);
  b.step({ title: "Screw the brackets to the seat", detail: "Two screws through each bracket into the end of the side rail.", kind: "screws", tools: ["screwdriver"], ...lying }, () => {
    for (const sx of sides) for (const dz of [8, 24]) b.fit(R_SCREW, { on: seat, at: [sx * (sw - 15), yr - 45, P[2] + dz], dir: [0, 1, 0] });
  });
  b.step({
    title: "Bolt on the right leg pair",
    detail: "The two legs come riveted together at the top. The bracket's pin goes into the inner leg with the large washer. The bolt goes through the outer leg, the thick spacer and the seat rail, with a washer and nut inside.",
    kind: "bolts",
    tools: ["allen", "wrench"],
    ...lying,
  }, () => {
    foldLegs(0);
    sideBolts(0);
  });
  b.step({ title: "Tap the dowels into the stretchers", detail: "Two into each end of both stretchers, eight in all.", kind: "dowels", ...lying }, () => {
    strAt(true);
    for (const [k, c, a, h] of [[strF, cF, lf.a, hf], [strB, cB, lb.a, hb]] as const)
      for (const ex of [-1, 1]) for (const dy of [-12, 12]) b.fit(R_DOWEL, { on: k, at: pivoted(c, a, [ex * h, dy, 0]), dir: [ex, 0, 0] });
  });
  b.step({ title: "Push the stretchers into the right legs", detail: "The long one between the outer legs, the short one between the inner legs, both near the feet.", kind: "join", ...lying }, () => strAt(false));
  b.step({ title: "Bolt the stretchers to the right legs", detail: "A barrel nut into the hole in each stretcher, slot facing the leg, then a long bolt in through the leg.", kind: "bolts", tools: ["allen", "flathead"], ...lying }, () => strBolts(0));
  b.step({
    title: "Bolt on the left leg pair",
    detail: "Over the stretchers' dowels, then the same as the right: large washer on the bracket pin, the bolt with the thick spacer, a washer and nut inside.",
    kind: "bolts",
    tools: ["allen", "wrench"],
    ...lying,
  }, () => {
    foldLegs(1);
    sideBolts(1);
  });
  b.step({ title: "Bolt the stretchers to the left legs", detail: "Two more barrel nuts and long bolts.", kind: "bolts", tools: ["allen", "flathead"], ...lying }, () => strBolts(1));
  b.step({ title: "Stand the chair up and open it out", detail: "Lift it by the seat and let the legs swing apart until it stands. The back folds down onto the seat for now.", kind: "standup", pose: "+y" }, () => {
    for (const k of [...legF, ...legB, strF, strB, seat]) b.add(k);
    b.stage(back, pivoted(P, Math.PI / 2, backT.mid), [Math.PI / 2, 0, 0]);
  });
  b.step({ title: "Set the armrests on the legs", detail: "The track underneath each one goes over the two pins on top of a leg pair, the hole at the back.", kind: "general" }, () => {
    for (const k of arms) b.add(k, [0, 200, 0]);
  });
  b.step({ title: "Slide the armrests back until they click", detail: "Push each one towards the back until both pins catch in its track.", kind: "general" }, () => {});
  b.step({
    title: "Raise the back and bolt it to the armrests",
    detail: "Lift the back up between the armrests. A bolt through each armrest's tube spacer and the side post, a washer either side of the post, and a nut done up with the spanner.",
    kind: "bolts",
    tools: ["allen", "wrench"],
  }, () => {
    b.add(back);
    sides.forEach((sx, i) => {
      b.fit(R_TUBE, { on: arms[i], at: [sx * (hw - 8), yb, zStile], dir: [-sx, 0, 0] });
      b.fit(R_BOLT, { on: arms[i], at: [sx * hw, yb, zStile], dir: [-sx, 0, 0], mate: back });
      b.fit(R_WASHER, { on: back, at: [sx * sw, yb, zStile], dir: [-sx, 0, 0] });
      b.fit(R_WASHER, { on: back, at: [sx * bx, yb, zStile], dir: [sx, 0, 0] });
      b.fit(R_NUT, { on: back, at: [sx * (bx - 2), yb, zStile], dir: [sx, 0, 0] });
    });
  });
  b.step({ title: "Set the back where you like it", detail: "Lift the front of the armrests to move the back to one of its six positions. To fold the chair, raise the back all the way and lift the seat.", kind: "general" }, () => {});
}

const family: Family = {
  names: ["BONDHOLMEN"],
  build(b, s) {
    if (!/^bondholmen-reclining-chair/.test(s.slug ?? "")) return false;
    recliner(b, s);
    return true;
  },
  recipe(s) {
    const slug = s.slug ?? "";
    if (/^bondholmen-armchair-outdoor/.test(slug)) return easy(s, false);
    if (/^bondholmen-2-seat-sofa-outdoor/.test(slug)) return easy(s, true);
    if (/^bondholmen-chair-armrests/.test(slug)) return chair(s);
    if (/^bondholmen-bench-backrest/.test(slug)) return bench(s);
    if (/^bondholmen-table-outdoor-108/.test(slug)) return roundTable(s);
    if (/^bondholmen-table-outdoor-235/.test(slug)) return longTable(s);
    return null;
  },
};
export default family;
