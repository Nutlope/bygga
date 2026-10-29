import type { Family } from "./family";
import type { CustomFix, CustomParams, CustomPart, CustomStep, HwKind, PartPiece, ProductSpec, Vec3 } from "../../types";
import type { PlanBuilder } from "../builder";
import { buildCustom } from "../custom";

/**
 * VIHALS, read from IKEA's manuals.
 *
 * Tables: a steel underframe built on the top, upside down on a rug. The two long rails are screwed to the top with
 * the Allen key, a corner bracket clicks into each end, the short rails hook onto the brackets and get one screw
 * each, then every leg is bolted to its bracket with a washer and a spring washer, hand tight, and tightened with the
 * spanner. The bar table adds a footrest (two end bars bolted through the legs and a long bar between them). The
 * round table's top comes in two halves, joined on dowels first.
 */

type Fix = CustomFix;
const pt = (x: number, y: number, z: number): Vec3 => [Math.round(x), Math.round(y), Math.round(z)];
const at = (kind: HwKind, pts: Vec3[], dir: Vec3, o: { on?: string; mate?: string; len?: number; dia?: number } = {}): Fix => ({ kind, count: pts.length, at: pts, dir, ...o });
const spread = (a: number, c: number, n: number) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + c) / 2 : a + ((c - a) * i) / (n - 1)));

/* ---------------- tables ---------------- */

type TableKind = "plain" | "round" | "bar";

function tableKind(s: ProductSpec): TableKind | null {
  const v = s.variant.toLowerCase();
  if (s.archetype !== "table") return null;
  if (/extendable|gateleg/.test(v)) return null; // their own recipes
  if (/^bar table/.test(v)) return "bar";
  if (s.table?.round) return "round";
  if (/^table/.test(v)) return "plain";
  return null;
}

function tableRecipe(s: ProductSpec, kind: TableKind): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25; // top
  const rh = 60, rt = 20; // rails: steel channels
  const lg = 40; // square steel legs
  const FW = kind === "round" ? 720 : W - 20, FD = kind === "round" ? 720 : D - 20; // outside of the rail frame
  const yr = H - tt - rh / 2; // rail centres
  const lx = FW / 2 - rt - lg / 2, lz = FD / 2 - rt - lg / 2; // leg centres
  // screws holding each long rail to the top: 2 on the small frame, 4 on the 125 cm, 5 on the 180 cm
  const nLong = FW < 900 ? 2 : FW < 1500 ? 4 : 5;

  const parts: CustomPart[] = [];
  if (kind === "round") {
    parts.push({ id: "top", name: "Table top", size: [W, tt, D], pos: [0, H - tt / 2, 0], material: "board", pieces: [{ shape: "cyl", size: [W, tt, D], pos: [0, 0, 0] }] });
  } else {
    parts.push({ id: "top", name: "Table top", size: [W, tt, D], pos: [0, H - tt / 2, 0], material: "board" });
  }
  for (const [i, sz] of [-1, 1].entries()) parts.push({ id: `L${i}`, name: "Long rail", size: [FW, rh, rt], pos: [0, yr, sz * (FD / 2 - rt / 2)], material: "metal" });
  for (const [i, sx] of [-1, 1].entries()) parts.push({ id: `S${i}`, name: "Short rail", size: [rt, rh, FD - 2 * rt], pos: [sx * (FW / 2 - rt / 2), yr, 0], material: "metal" });
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  corners.forEach(([sx, sz], i) => parts.push({ id: `G${i}`, name: "Leg", size: [lg, H - tt, lg], pos: [sx * lx, (H - tt) / 2, sz * lz], material: "metal" }));

  // the corner bracket sits in the inside corner of the frame, on the leg's inner edge; its bolt goes out into the leg
  const yb = H - tt - rh / 2;
  const brk = corners.map(([sx, sz]) => pt(sx * (lx - lg / 2), yb, sz * (lz - lg / 2)));
  const dirs = corners.map(([sx, sz]): Vec3 => [sx * 0.71, 0, sz * 0.71]);
  // the hex bolts go through the bracket into each leg, with a washer and a spring washer under the head
  const back = (g: number, d: number) => pt(brk[g][0] - dirs[g][0] * d, yb, brk[g][2] - dirs[g][2] * d);
  // (washers lie flat either way round, so opposite corners share one)
  const legBolts: Fix[] = [
    ...[0, 1, 2, 3].map((g) => at("bolt", [brk[g]], dirs[g], { on: `G${g}`, len: 40, dia: 8 })),
    ...[0, 1].flatMap((g) => [at("washer", [back(g, 24), back(g + 2, 24)], dirs[g], { dia: 16 }), at("washer", [back(g, 44), back(g + 2, 44)], dirs[g], { dia: 13, len: 3 })]),
  ];
  const railScrews = (id: string, xs: number[], z: number): Fix => at("bolt", xs.map((x) => pt(x, H - tt - rh, z)), [0, 1, 0], { on: id, mate: "top", len: 60, dia: 6 });
  const longXs = spread(-FW / 2 + 120, FW / 2 - 120, nLong);

  const steps: CustomStep[] = [];
  if (kind === "round") {
    steps.push({
      title: "Join the two halves of the top",
      detail: "Lay both halves upside down on a rug, tap the dowels into one half and push the other half onto them.",
      add: ["top"],
      fix: [at("dowel", spread(-300, 300, 4).map((x) => pt(0, H - tt / 2, x)), [1, 0, 0], { on: "top" })],
      pose: "-y",
      warnings: ["floor"],
    });
  }
  steps.push({
    title: "Screw the long rails to the underside",
    detail: kind === "round" ? "Centre them on the top. Turn the screws in with the Allen key through the holes in the rails." : "The top lies upside down on a rug. Turn the screws in with the Allen key through the holes in the rails.",
    add: kind === "round" ? ["L0", "L1"] : ["top", "L0", "L1"],
    fix: [railScrews("L0", longXs, -(FD / 2 - rt / 2)), railScrews("L1", longXs, FD / 2 - rt / 2)],
    pose: "-y",
    warnings: kind === "round" ? undefined : ["floor"],
  });
  steps.push({
    title: "Click a corner bracket into each rail end",
    detail: "Push each one into the slot at the end of the rail until it snaps in.",
    fix: [at("clamp", brk, [0, -1, 0], { len: 50, dia: 40 })],
  });
  steps.push({
    title: "Hook the short rails onto the brackets",
    detail: "Slide each end over its bracket and press down until it clicks.",
    add: ["S0", "S1"],
  });
  steps.push({
    title: "Screw each short rail to the top",
    detail: "One screw in the middle of each rail.",
    fix: [at("bolt", [pt(-(FW / 2 - rt / 2), H - tt - rh, 0), pt(FW / 2 - rt / 2, H - tt - rh, 0)], [0, 1, 0], { mate: "top", len: 60, dia: 6 })],
  });
  steps.push({
    title: "Bolt the legs into the corners",
    detail: "Put the washer, then the spring washer, on each bolt. Turn them in by hand for now.",
    add: ["G0", "G1", "G2", "G3"],
    fix: legBolts,
    tools: ["wrench"],
  });

  if (kind === "bar") {
    const yf = 280, fb = 30; // footrest bars
    const ex = lx; // end bars run front to back between the legs
    parts.push({ id: "F0", name: "End footrest bar", size: [fb, fb, 2 * lz - lg], pos: [-ex, yf, 0], material: "metal" });
    parts.push({ id: "F1", name: "End footrest bar", size: [fb, fb, 2 * lz - lg], pos: [ex, yf, 0], material: "metal" });
    parts.push({ id: "F2", name: "Long footrest bar", size: [2 * ex - fb, fb, fb], pos: [0, yf, 0], material: "metal" });
    steps.push({
      title: "Hold the end bars between the legs",
      detail: "One across each end, with the hole for the long bar facing in.",
      add: ["F0", "F1"],
    });
    steps.push({
      title: "Bolt the end bars through the legs",
      detail: "Use the long bolts here, one through each leg.",
      fix: [-1, 1].flatMap((sx, i) => [-1, 1].map((sz) => at("bolt", [pt(sx * ex, yf, sz * (lz + lg / 2))], [0, 0, -sz], { on: `G${i === 0 ? (sz < 0 ? 0 : 3) : sz < 0 ? 1 : 2}`, mate: `F${i}`, len: 90, dia: 6 }))),
    });
    steps.push({
      title: "Lay the long bar between them",
      detail: "Its ends drop into the end bars.",
      add: ["F2"],
    });
    steps.push({
      title: "Bolt the long bar to the end bars",
      detail: "One short bolt through each end bar.",
      fix: [at("bolt", [pt(-ex - fb / 2, yf, 0)], [1, 0, 0], { on: "F0", mate: "F2", len: 40, dia: 6 }), at("bolt", [pt(ex + fb / 2, yf, 0)], [-1, 0, 0], { on: "F1", mate: "F2", len: 40, dia: 6 })],
    });
  }
  steps.push({
    title: "Tighten the leg bolts with the spanner",
    detail: "Check the spring washer is pressed flat under each bolt head.",
    tools: ["wrench"],
    kind: "bolts",
  });
  steps.push({
    title: "Turn the table over",
    detail: "Lift it by the top with a helper, not by the legs.",
    pose: "+y",
    people: 2,
  });
  return { parts, steps };
}

/*
 * The extendable tables are built the same way on one half of the top, with the slide rails: plastic sliders clip
 * into the long rails, the rails are screwed on, the first pair of legs is bolted on at one end, then the extension
 * rails slide into the long rails and carry the other end, its cross rail and its two legs. Turned over by two
 * people, the leaf gets its locating plates and goes in between the halves.
 */
function extendableRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 25, rh = 60, rt = 20, lg = 40;
  const big = W > 1000;
  const FW = W - 20, FD = D - 20;
  const yr = H - tt - rh / 2;
  const lx = FW / 2 - rt - lg / 2, lz = FD / 2 - rt - lg / 2;
  const leafW = big ? 600 : 360;
  const parts: CustomPart[] = [
    { id: "topA", name: "Table top half", size: [W / 2, tt, D], pos: [-W / 4, H - tt / 2, 0], material: "board" },
    { id: "topB", name: "Table top half", size: [W / 2, tt, D], pos: [W / 4, H - tt / 2, 0], material: "board" },
    { id: "L0", name: "Long rail", size: [FW / 2, rh, rt], pos: [-FW / 4, yr, -(FD / 2 - rt / 2)], material: "metal" },
    { id: "L1", name: "Long rail", size: [FW / 2, rh, rt], pos: [-FW / 4, yr, FD / 2 - rt / 2], material: "metal" },
    { id: "X0", name: "Extension rail", size: [FW / 2, rh - 16, rt], pos: [FW / 4, yr + 8, -(FD / 2 - rt / 2)], material: "metal" },
    { id: "X1", name: "Extension rail", size: [FW / 2, rh - 16, rt], pos: [FW / 4, yr + 8, FD / 2 - rt / 2], material: "metal" },
    { id: "SA", name: "Short rail", size: [rt, rh, FD - 2 * rt], pos: [-(FW / 2 - rt / 2), yr, 0], material: "metal" },
    { id: "SB", name: "Short rail", size: [rt, rh, FD - 2 * rt], pos: [FW / 2 - rt / 2, yr, 0], material: "metal" },
    { id: "leaf", name: "Leaf", size: [leafW, tt, D - 60], pos: [0, H - tt - rh + tt / 2 + 4, 0], material: "board" },
  ];
  const corners: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  corners.forEach(([sx, sz], i) => parts.push({ id: `G${i}`, name: "Leg", size: [lg, H - tt, lg], pos: [sx * lx, (H - tt) / 2, sz * lz], material: "metal" }));
  const yb = H - tt - rh / 2;
  const brk = corners.map(([sx, sz]) => pt(sx * (lx - lg / 2), yb, sz * (lz - lg / 2)));
  const dirs = corners.map(([sx, sz]): Vec3 => [sx * 0.71, 0, sz * 0.71]);
  const back = (g: number, d: number) => pt(brk[g][0] - dirs[g][0] * d, yb, brk[g][2] - dirs[g][2] * d);
  const legEnd = (a: number, b: number): Fix[] => [
    at("bolt", [brk[a]], dirs[a], { on: `G${a}`, len: 40, dia: 8 }),
    at("bolt", [brk[b]], dirs[b], { on: `G${b}`, len: 40, dia: 8 }),
    at("washer", [back(a, 24)], dirs[a], { dia: 16 }),
    at("washer", [back(b, 24)], dirs[b], { dia: 16 }),
    at("washer", [back(a, 44)], dirs[a], { dia: 13, len: 3 }),
    at("washer", [back(b, 44)], dirs[b], { dia: 13, len: 3 }),
  ];
  const nScrew = big ? 4 : 3;
  const railScrews = (id: string, z: number) => at("bolt", spread(-FW / 2 + 80, -60, nScrew).map((x) => pt(x, H - tt - rh, z)), [0, 1, 0], { on: id, len: 60, dia: 6 });
  const steps: CustomStep[] = [
    { title: "Clip the sliders into the long rails", detail: "Two in each rail. Push each one in and turn it until it locks.", add: ["L0", "L1"], fix: [at("clip", [-FW / 2 + 150, -100].flatMap((x) => [pt(x, yr, -(FD / 2 - rt)), pt(x, yr, FD / 2 - rt)]), [0, 0, 1], { dia: 20, len: 30 })], pose: "-y" },
    { title: "Lay the rails on one half of the top", detail: "Both halves lie upside down on a rug. The rails go on the half with the holes for them.", add: ["topA", "topB"], warnings: ["floor"] },
    { title: "Screw the long rails to the top", detail: "Turn the screws in with the Allen key through the holes in the rails.", fix: [railScrews("L0", -(FD / 2 - rt / 2)), railScrews("L1", FD / 2 - rt / 2)] },
    { title: "Screw in the end stop", detail: "One screw near the middle, so the rails can't slide off.", fix: [at("bolt", [pt(-40, H - tt - 10, 0)], [0, 1, 0], { on: "topA", len: 20, dia: 6 })] },
    { title: "Click the corner brackets into the rail ends", detail: "Two at this end.", fix: [at("clamp", [brk[0], brk[1]], [0, -1, 0], { len: 50, dia: 40 })], add: ["SA"] },
    { title: "Bolt on the first two legs", detail: "Washer, then spring washer, on each bolt. Hand tight for now.", add: ["G0", "G1"], fix: legEnd(0, 1), tools: ["wrench"] },
    { title: "Tighten them with the spanner", detail: "Check the spring washers are pressed flat.", tools: ["wrench"], kind: "bolts" },
    { title: "Slide the extension rails into the long rails", detail: "Rounded ends first. They should run smoothly on the sliders.", add: ["X0", "X1"], from: { X0: [500, 0, 0], X1: [500, 0, 0] } },
    {
      title: "Screw the extension rails to the other half",
      detail: "Clip the cross rail in at this end and screw it to the top.",
      fix: [at("bolt", [-1, 1].flatMap((sz) => [pt(FW / 2 - 200, H - tt - rh + 16, sz * (FD / 2 - rt / 2)), pt(FW / 2 - 60, H - tt - rh + 16, sz * (FD / 2 - rt / 2))]), [0, 1, 0], { len: 12, dia: 5 })],
      add: ["SB"],
    },
    { title: "Click the corner brackets into the other end", fix: [at("clamp", [brk[2], brk[3]], [0, -1, 0], { len: 50, dia: 40 })] },
    { title: "Bolt on the other two legs", detail: "Hand tight, then tighten both with the spanner.", add: ["G2", "G3"], fix: legEnd(2, 3), tools: ["wrench"] },
    { title: "Turn the table over together", detail: "Lift it by the top, not by the legs.", pose: "+y", people: 2 },
    {
      title: "Screw the locating plates onto the leaf",
      detail: "Two on each long edge, on the underside. Two screws each.",
      fix: [at("plate", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => pt(sx * (leafW / 2 - 60), H - tt - rh + 4, sz * (D / 2 - 120)))), [0, 1, 0], { on: "leaf", len: 40, dia: 30 }), at("screw", [-1, 1].flatMap((sx) => [-1, 1].flatMap((sz) => [-25, 25].map((d) => pt(sx * (leafW / 2 - 60) + d, H - tt - rh + 4, sz * (D / 2 - 120))))), [0, 1, 0], { on: "leaf", len: 14, dia: 4 })],
      add: ["leaf"],
    },
    { title: "Pull the ends apart and lay the leaf in", detail: "Unfold it onto the rails, push the halves together until the plates lock. Store it under the top when you close the table." },
  ];
  return { parts, steps };
}

/*
 * The gateleg table is built upside down on its three-piece top: guide bolts and bumpers in, the two leaves hinged
 * to the middle top, the frame of two end frames and long rails bolted to it, the three shelves bolted in, then the
 * two gates (each a leg with two rails) hinged to the frame and felt pads under the feet. Two people turn it over.
 */
function gatelegRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10;
  const tt = 22, mid = 390, leaf = (W - mid) / 2, lg = 30;
  const fx = 170, fz = D / 2 - 70, hL = H - tt;
  const parts: CustomPart[] = [
    { id: "topM", name: "Middle top", size: [mid, tt, D], pos: [0, H - tt / 2, 0], material: "board" },
    { id: "leafL", name: "Leaf", size: [leaf, tt, D], pos: [-(mid + leaf) / 2, H - tt / 2, 0], material: "board" },
    { id: "leafR", name: "Leaf", size: [leaf, tt, D], pos: [(mid + leaf) / 2, H - tt / 2, 0], material: "board" },
  ];
  const endFrame = (sx: number, i: number): CustomPart => ({
    id: `E${i}`,
    name: "End frame",
    size: [lg, hL, 2 * fz + lg],
    pos: [sx * fx, hL / 2, 0],
    material: "metal",
    pieces: [
      { shape: "box", size: [lg, hL, lg], pos: [0, 0, -fz] },
      { shape: "box", size: [lg, hL, lg], pos: [0, 0, fz] },
      { shape: "box", size: [lg, 40, 2 * fz - lg], pos: [0, hL / 2 - 20, 0] },
      { shape: "box", size: [lg, 40, 2 * fz - lg], pos: [0, -hL / 2 + 100, 0] },
    ],
  });
  parts.push(endFrame(-1, 0), endFrame(1, 1));
  for (const [i, sz] of [-1, 1].entries()) parts.push({ id: `R${i}`, name: "Long rail", size: [2 * fx - lg, 40, lg], pos: [0, hL - 20, sz * fz], material: "metal" });
  // the shelves reach the middle of the legs, so their bolts go through the legs into the shelf edges
  const shY = [150, Math.round(hL / 2), hL - 200];
  shY.forEach((y, i) => parts.push({ id: `S${i}`, name: "Shelf", size: [2 * fx, 18, 2 * fz - lg], pos: [0, y, 0], material: "board" }));
  const gx = mid / 2 + leaf * 0.55;
  const gate = (sx: number, i: number): CustomPart => {
    const len = gx - fx - lg / 2;
    return {
      id: `Gt${i}`,
      name: "Gate",
      size: [len + lg, hL, lg],
      pos: [sx * (fx + lg / 2 + len / 2), hL / 2, fz],
      material: "metal",
      pieces: [
        { shape: "box", size: [lg, hL, lg], pos: [sx * (len / 2), 0, 0] },
        { shape: "box", size: [len, 30, lg], pos: [0, hL / 2 - 60, 0] },
        { shape: "box", size: [len, 30, lg], pos: [0, -hL / 2 + 260, 0] },
      ],
    };
  };
  parts.push(gate(-1, 0), gate(1, 1));
  const hingesTop = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => pt(sx * mid / 2, H - tt, sz * (D / 2 - 150))));
  // a gate's two rails sit level with these heights; a hinge on each rail end, swinging on the end frame's leg
  const gateY = [hL - 60, 260];
  const hingesGate = [-1, 1].flatMap((sx) => gateY.map((y) => pt(sx * (fx + lg / 2), y, fz + lg / 2)));
  const steps: CustomStep[] = [
    { title: "Screw the guide bolts into the middle top", detail: "Lay the three top pieces upside down on a rug. A washer goes under each bolt.", add: ["topM", "leafL", "leafR"], fix: [at("bolt", [pt(-mid / 2 + 60, H - tt, fz), pt(mid / 2 - 60, H - tt, fz)], [0, 1, 0], { len: 20, dia: 8 }), at("washer", [pt(-mid / 2 + 60, H - tt - 3, fz), pt(mid / 2 - 60, H - tt - 3, fz)], [0, 1, 0], { dia: 16 })], pose: "-y", warnings: ["floor"] },
    { title: "Screw the bumpers onto the leaves", detail: "Two on each leaf, near the outer edge.", fix: [at("glide", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => pt(sx * (W / 2 - 150), H - tt, sz * (D / 2 - 120)))), [0, 1, 0], { dia: 20, len: 12 }), at("screw", [-1, 1].flatMap((sx) => [-1, 1].map((sz) => pt(sx * (W / 2 - 150), H - tt - 6, sz * (D / 2 - 120)))), [0, 1, 0], { len: 16, dia: 4 })] },
    { title: "Hinge the leaves to the middle top", detail: "Two hinges on each joint, eight screws each. Line the pieces up edge to edge first.", fix: [at("hinge", hingesTop, [0, 1, 0], { len: 60, dia: 40 }), at("screw", hingesTop.flatMap((h) => [-24, -8, 8, 24].flatMap((dz) => [-14, 14].map((dx) => pt(h[0] + dx, h[1], h[2] + dz)))), [0, 1, 0], { len: 14, dia: 4 })] },
    { title: "Bolt the end frames to the long rails", detail: "Two bolts at each joint, with the Allen key.", add: ["E0", "E1", "R0", "R1"], fix: [-1, 1].map((sx) => at("bolt", [-1, 1].map((sz) => pt(sx * (fx + lg / 2), hL - 20, sz * fz)), [-sx, 0, 0], { on: `E${sx < 0 ? 0 : 1}`, len: 50, dia: 6 })) },
    { title: "Lay the frame on the middle top", detail: "Centred on it, the open side of the rails up." },
    { title: "Bolt the frame to the top", detail: "Ten long bolts through the rails into the top.", fix: [at("bolt", [...[-1, 1].flatMap((sz) => spread(-fx + 40, fx - 40, 3).map((x) => pt(x, hL - 40, sz * fz))), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => pt(sx * fx, hL - 40, sz * (fz - 150))))], [0, 1, 0], { len: 55, dia: 6 })] },
    { title: "Bolt in the shelves", detail: "Four bolts through the legs into each shelf, one at each corner.", add: ["S0", "S1", "S2"], fix: [-1, 1].map((sz) => at("bolt", shY.flatMap((y) => [-1, 1].map((sx) => pt(sx * (fx - 8), y, sz * (fz + lg / 2)))), [0, 0, -sz], { len: 40, dia: 6 })) },
    { title: "Bolt each gate together", detail: "The two rails onto the gate leg, one bolt each, and a hinge plate on the free ends.", add: ["Gt0", "Gt1"], fix: [-1, 1].map((sx, i) => at("bolt", gateY.map((y) => pt(sx * (gx + lg / 2), y, fz)), [-sx, 0, 0], { on: `Gt${i}`, len: 40, dia: 6 })) },
    {
      title: "Hinge the gates to the frame",
      detail: "Two hinges for each gate: two screws into the rail end, four into the leg of the end frame.",
      fix: [
        at("hinge", hingesGate, [0, 0, -1], { len: 50, dia: 35 }),
        at("screw", hingesGate.flatMap((h) => [25, 50].map((dx) => pt(h[0] + Math.sign(h[0]) * dx, h[1] + 15, fz))), [0, -1, 0], { len: 12, dia: 4 }),
        at("screw", hingesGate.flatMap((h) => [-48, -24, 24, 48].map((dy) => pt(h[0] - Math.sign(h[0]) * 20, h[1] + dy, h[2]))), [0, 0, -1], { len: 12, dia: 4 }),
      ],
    },
    { title: "Stick the felt pads under the feet", detail: "One under every leg, the gates' too.", fix: [at("glide", [...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => pt(sx * fx, 0, sz * fz))), ...[-1, 1].map((sx) => pt(sx * gx, 0, fz))].slice(0, 4), [0, 1, 0], { dia: 24, len: 3 })] },
    { title: "Fold the gates in and turn it over together", detail: "Lift it by the frame with a helper.", pose: "+y", people: 2 },
    { title: "Swing a gate out and lift a leaf onto it", detail: "Do the same on the other side to open the table fully.", repeat: 2 },
  ];
  return { parts, steps };
}

/* ---------------- the click-together carcass ---------------- */

/*
 * Shelving units: every panel has click fittings already in its edges. The carcass is built lying on its front on
 * a rug: the top, sides, divider and fixed shelves click together, the feet are pushed into the bottom and it clicks
 * on, four locking screws go into the back corners and the first back panel slides into its grooves and is held
 * with plastic rivets and clips. Stood up by two people, the second back panel slides in from the side and is
 * riveted and clipped the same way. Then the wall fixing, the shelf supports and the loose shelves.
 */

interface Carcass {
  W: number;
  H: number;
  D: number;
  t: number;
  f: number; // feet under the bottom
  xd: number; // divider centre
  fixed: { id: string; x0: number; x1: number; y: number }[];
  parts: CustomPart[];
  seam: number; // where the two back panels meet
}

const T = 18, FEET = 12, BK = 3;

function carcass(s: ProductSpec, narrow: number, fixedY: { wide?: number; narrow?: number }): Carcass {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10, t = T, f = FEET;
  const inH = H - f - 2 * t; // between bottom and top
  const yMid = f + t + inH / 2;
  const zP = BK / 2, dP = D - BK; // the panels stop at the back panels, which sit in a rebate
  const xd = W / 2 - t - narrow - t / 2;
  const parts: CustomPart[] = [
    { id: "top", name: "Top panel", size: [W, t, dP], pos: [0, H - t / 2, zP], material: "board" },
    { id: "bot", name: "Bottom panel", size: [W, t, dP], pos: [0, f + t / 2, zP], material: "board" },
    { id: "sideL", name: "Side panel", size: [t, inH, dP], pos: [-W / 2 + t / 2, yMid, zP], material: "board" },
    { id: "sideR", name: "Side panel", size: [t, inH, dP], pos: [W / 2 - t / 2, yMid, zP], material: "board" },
    { id: "div", name: "Divider", size: [t, inH, dP], pos: [xd, yMid, zP], material: "board" },
  ];
  const fixed: Carcass["fixed"] = [];
  const xa = -W / 2 + t, xb = xd - t / 2, xc = xd + t / 2, xe = W / 2 - t;
  if (fixedY.wide) fixed.push({ id: "fixW", x0: xa, x1: xb, y: fixedY.wide });
  if (fixedY.narrow) fixed.push({ id: "fixN", x0: xc, x1: xe, y: fixedY.narrow });
  for (const fx of fixed) parts.push({ id: fx.id, name: "Fixed shelf", size: [fx.x1 - fx.x0, t, dP], pos: [(fx.x0 + fx.x1) / 2, fx.y, zP], material: "board" });
  const seam = -W / 2 + Math.round(W * 0.42);
  const bh = H - f - 8;
  parts.push({ id: "back0", name: "Back panel", size: [seam - (-W / 2 + 4), bh, BK], pos: [(seam + (-W / 2 + 4)) / 2, f + 4 + bh / 2, -D / 2 + BK / 2], material: "fiber" });
  parts.push({ id: "back1", name: "Folding back panel", size: [W / 2 - 4 - seam, bh, BK], pos: [(W / 2 - 4 + seam) / 2, f + 4 + bh / 2, -D / 2 + BK / 2], material: "fiber" });
  return { W, H, D, t, f, xd, fixed, parts, seam };
}

/** Plastic rivets through a back panel: along its top and bottom edges, then into the fixed shelves and divider behind it. */
function rivets(c: Carcass, piece: 0 | 1, n: number): Vec3[] {
  const { W, H, t, f, D } = c;
  const x0 = piece === 0 ? -W / 2 + 4 : c.seam, x1 = piece === 0 ? c.seam : W / 2 - 4;
  const z = -D / 2;
  const extra: Vec3[] = [];
  for (const fx of c.fixed) {
    const a = Math.max(fx.x0, x0) + 50, b = Math.min(fx.x1, x1) - 50;
    if (b > a) for (const x of b - a > 250 ? [a, b] : [(a + b) / 2]) extra.push(pt(x, fx.y, z));
  }
  if (c.xd > x0 && c.xd < x1) for (const y of spread(f + 200, H - 200, 2)) extra.push(pt(c.xd, y, z));
  const ex = extra.slice(0, Math.max(0, n - 6));
  const k = Math.ceil((n - ex.length) / 2);
  const xs = spread(x0 + 60, x1 - 60, k);
  return [...xs.map((x) => pt(x, H - t / 2, z)), ...xs.map((x) => pt(x, f + t / 2, z)), ...ex].slice(0, n);
}

/** Two-part clips across the seam between the back panels. */
const seamClips = (c: Carcass, n: number) => spread(c.f + 120, c.H - 120, n).map((y) => pt(c.seam, y, -c.D / 2));

/** Each back clip is two pieces: the clip, then the catch pushed into it. */
const clipPair = (pts: Vec3[], on: string): Fix[] => [
  at("clip", pts, [0, 0, 1], { on, dia: 20, len: 10 }),
  at("clip", pts.map((p) => pt(p[0] + 26, p[1], p[2])), [0, 0, 1], { on, dia: 16, len: 18 }),
];

/** Shelf supports for loose shelves: four under each one, into the panels either side of it. */
function supports(shelves: { x0: number; x1: number; y: number }[], D: number) {
  const zs = [-D / 2 + 50, D / 2 - 50];
  const left = shelves.flatMap((sh) => zs.map((z) => pt(sh.x0, sh.y - T / 2 - 4, z)));
  const right = shelves.flatMap((sh) => zs.map((z) => pt(sh.x1, sh.y - T / 2 - 4, z)));
  return [at("pin", left, [-1, 0, 0], { dia: 5, len: 16 }), at("pin", right, [1, 0, 0], { dia: 5, len: 16 })];
}

/** The steps that close the carcass, from the feet to the wall: the same in every VIHALS cabinet. */
function closeSteps(c: Carcass, rv: [number, number], clips: number): CustomStep[] {
  const { W, H, D, t, f, xd } = c;
  const feetX = [-W / 2 + 40, xd, W / 2 - 40];
  const feet = feetX.flatMap((x) => [pt(x, f, -D / 2 + 50), pt(x, f, D / 2 - 50)]);
  const corners = [-1, 1].flatMap((sx) => [pt(sx * (W / 2 - t / 2), H - t / 2, -D / 2 + BK), pt(sx * (W / 2 - t / 2), f + t / 2, -D / 2 + BK)]);
  return [
    {
      title: "Push the feet into the bottom panel",
      detail: "Six of them, one at each corner and two under the divider.",
      fix: [at("glide", feet, [0, 1, 0], { on: "bot", dia: 30, len: 10 })],
    },
    {
      title: "Click the bottom panel on",
      detail: "Feet facing out. Press it down over each panel until all the fittings click.",
      add: ["bot"],
    },
    {
      title: "Screw in the four locking screws",
      detail: "One in each back corner, through the top and bottom into the sides.",
      fix: [at("bolt", corners, [0, 0, 1], { len: 30, dia: 6 })],
    },
    {
      title: "Slide in the first back panel",
      detail: "Push it along the grooves until it stops at the side, smooth face out.",
      add: ["back0"],
    },
    {
      title: "Fix it with the plastic rivets",
      detail: "Push a rivet into each hole, then press a pin into each rivet so it spreads.",
      fix: [at("clip", rivets(c, 0, rv[0]), [0, 0, 1], { on: "back0", dia: 8, len: 16 }), at("clip", rivets(c, 0, rv[0]).map((p) => pt(p[0], p[1], p[2] - 6)), [0, 0, 1], { on: "back0", dia: 6, len: 22 })],
    },
    {
      title: "Clip its free edge",
      detail: "Slide each clip into its hole along the edge, then push the catch in.",
      fix: clipPair(seamClips(c, clips), "back0"),
    },
    {
      title: "Stand it up together",
      detail: "Lift it by the sides, not the back.",
      pose: "+y",
      people: 2,
    },
    {
      title: "Slide in the second back panel",
      detail: "Open it out flat and push it into the grooves from the open side, up to the first panel.",
      add: ["back1"],
      from: { back1: [W * 0.6, 0, 0] },
    },
    {
      title: "Rivet the second back panel",
      detail: "The same way as the first: rivets in, then the pins.",
      fix: [at("clip", rivets(c, 1, rv[1]), [0, 0, 1], { on: "back1", dia: 8, len: 16 }), at("clip", rivets(c, 1, rv[1]).map((p) => pt(p[0], p[1], p[2] - 6)), [0, 0, 1], { on: "back1", dia: 6, len: 22 })],
    },
    {
      title: "Clip the panels together at the seam",
      detail: "The catches lock both edges so the back stays flat.",
      fix: clipPair(seamClips(c, clips).map((p) => pt(p[0], p[1] + 40, p[2])), "back1"),
    },
    {
      title: "Fix it to the wall",
      detail: "Screw the two wall fittings to the top at the back, then into the wall with screws and plugs that suit it.",
      fix: [at("bracket", [-1, 1].map((sx) => pt(sx * (W / 2 - t - 60), H - t, -D / 2 + 40)), [0, 1, 0], { on: "top" })],
      warnings: ["tip"],
    },
  ];
}

function shelvingRecipe(s: ProductSpec): CustomParams | null {
  const m = /shelving unit with (\d+) shelves/i.exec(s.variant + " " + (s.slug ?? "").replace(/-/g, " "));
  const n = m ? Number(m[1]) : /(\d+)-shelves/.exec(s.slug ?? "")?.[1] ? Number(/(\d+)-shelves/.exec(s.slug ?? "")![1]) : 0;
  if (![4, 6, 10].includes(n) || Math.abs(s.size.w - 95) > 2) return null;
  const H = s.size.h * 10;
  // shelves per column, fixed ones included: the wide column on the left, the narrow one on the right
  const per = n === 4 ? [2, 2] : n === 6 ? [3, 3] : [4, 6];
  const fixedIx = n === 4 ? [-1, -1] : n === 6 ? [1, 1] : [1, 2];
  const inB = FEET + T, inT = H - T;
  const ys = (k: number) => Array.from({ length: k }, (_, i) => Math.round(inB + ((inT - inB) * (i + 1)) / (k + 1)));
  const yW = ys(per[0]), yN = ys(per[1]);
  const c = carcass(s, 310, { wide: fixedIx[0] >= 0 ? yW[fixedIx[0]] : undefined, narrow: fixedIx[1] >= 0 ? yN[fixedIx[1]] : undefined });
  const { W, D, xd } = c;
  const xa = -W / 2 + T, xb = xd - T / 2, xc = xd + T / 2, xe = W / 2 - T;
  const loose = [...yW.filter((_, i) => i !== fixedIx[0]).map((y) => ({ x0: xa, x1: xb, y })), ...yN.filter((_, i) => i !== fixedIx[1]).map((y) => ({ x0: xc, x1: xe, y }))];
  const parts = [...c.parts];
  loose.forEach((sh, i) => parts.push({ id: `sh${i}`, name: sh.x0 === xa ? "Wide shelf" : "Narrow shelf", size: [sh.x1 - sh.x0 - 2, T, D - 30], pos: [(sh.x0 + sh.x1) / 2, sh.y, 15], material: "board" }));

  const steps: CustomStep[] = [];
  if (n === 4) {
    steps.push({
      title: "Click the divider into the top",
      detail: "Lay the top on its front edge on a rug. The divider goes in the holes nearer one end; press until both fittings click.",
      add: ["top", "div"],
      pose: "-z",
      warnings: ["floor"],
    });
    steps.push({ title: "Click on the side by the divider", detail: "Line up the fittings and press the side down onto the top until it clicks.", add: ["sideR"] });
    steps.push({ title: "Click on the other side", detail: "Same as the first one.", add: ["sideL"] });
  } else {
    steps.push({
      title: "Click a side onto the top",
      detail: "Lay them on their front edges on a rug. Check the holes in the side face in, with the right spacing at the top end.",
      add: ["top", "sideL"],
      pose: "-z",
      people: 2,
      warnings: ["floor"],
    });
    steps.push({ title: "Click in the divider with the wide fixed shelf", detail: "Hold the divider in the top and hook the fixed shelf between it and the side.", add: ["div", "fixW"] });
    steps.push({ title: "Hook the narrow fixed shelf onto the divider", detail: "Check its fittings point the right way before you press it on.", add: ["fixN"] });
    steps.push({ title: "Click on the other side", detail: "Lower it onto the top and the narrow shelf together, then press until every fitting clicks.", add: ["sideR"], people: 2 });
  }
  const rv: [number, number] = n === 4 ? [6, 6] : n === 6 ? [8, 8] : [10, 8];
  steps.push(...closeSteps(c, rv, n === 10 ? 5 : 3));
  steps.push({ title: "Push in the shelf supports", detail: "Four for each loose shelf, at the same height on both sides.", fix: supports(loose, D) });
  steps.push({ title: "Lay the shelves on the supports", detail: "Tilt each one in and lower it until it sits flat.", add: loose.map((_, i) => `sh${i}`) });
  return { parts, steps };
}

/* ---------------- cabinets with doors and drawers ---------------- */

/*
 * The same click carcass with fronts. Where there are drawers the cabinet half of each runner is screwed to the
 * panels first, flat on a rug. Units built lying on their front (storage unit, wardrobe, sliding-door cabinets) go
 * together like the shelving units; the low ones (TV bench, sideboard, chests) are built standing on their bottom
 * panel and the top clicks on last. Then the wall fixing, shelves, doors on hinges or sliding doors in their
 * tracks, and the drawers: cam bolts into the front, the sides on and locked, the bottom slid in, the back screwed
 * on, the drawer runners and the grip, and in it goes.
 */

interface CabCfg {
  flow: "front" | "upright";
  cols: number[]; // inner widths from left to right; the last one takes what is left
  fixed?: { col: number; y: number }[];
  feet: number;
  backs: 1 | 2;
  rivets: number[]; // per back panel
  clips: number;
  shelves?: { col: number; ys: number[] }[];
  doors?: { col: number; y0: number; y1: number; n: 1 | 2; hinges: number; mirror?: boolean }[];
  drawers?: { col: number; y0: number; y1: number }[];
  sliding?: { glass: boolean };
  rail?: number; // clothes rail height
  wall: number;
}

const FR = 18; // fronts

function cabRecipe(s: ProductSpec, cfg: CabCfg): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10, t = T, f = FEET;
  const inH = H - f - 2 * t, yMid = f + t + inH / 2, zP = BK / 2, dP = D - BK;
  const inW = W - 2 * t - (cfg.cols.length - 1) * t;
  const widths = cfg.cols.map((w, i) => (i === cfg.cols.length - 1 ? inW - cfg.cols.slice(0, -1).reduce((a, b) => a + b, 0) : w));
  const xs: [number, number][] = [];
  let x = -W / 2 + t;
  for (const w of widths) {
    xs.push([x, x + w]);
    x += w + t;
  }
  const divX = xs.slice(0, -1).map((c) => c[1] + t / 2);
  const parts: CustomPart[] = [
    { id: "top", name: "Top panel", size: [W, t, dP], pos: [0, H - t / 2, zP], material: "board" },
    { id: "bot", name: "Bottom panel", size: [W, t, dP], pos: [0, f + t / 2, zP], material: "board" },
    { id: "sideL", name: "Side panel", size: [t, inH, dP], pos: [-W / 2 + t / 2, yMid, zP], material: "board" },
    { id: "sideR", name: "Side panel", size: [t, inH, dP], pos: [W / 2 - t / 2, yMid, zP], material: "board" },
    ...divX.map((dx, i): CustomPart => ({ id: `div${i}`, name: "Divider", size: [t, inH, dP], pos: [dx, yMid, zP], material: "board" })),
  ];
  const fixed = (cfg.fixed ?? []).map((fx, i) => ({ id: `fix${i}`, x0: xs[fx.col][0], x1: xs[fx.col][1], y: fx.y }));
  // behind a door a fixed shelf stops short of the front, so the door closes over it
  const behind = (fx: { x0: number; x1: number; y: number }) => (cfg.doors ?? []).some((d) => fx.y > d.y0 && fx.y < d.y1 && xs[d.col][0] <= fx.x0 + 1 && xs[d.col][1] >= fx.x1 - 1);
  for (const fx of fixed) {
    const dd = behind(fx) ? dP - FR - 2 : dP;
    parts.push({ id: fx.id, name: "Fixed shelf", size: [fx.x1 - fx.x0, t, dd], pos: [(fx.x0 + fx.x1) / 2, fx.y, zP - (dP - dd) / 2], material: "board" });
  }
  const seam = cfg.backs === 2 ? -W / 2 + Math.round(W * 0.42) : W / 2 - 4;
  const bh = H - f - 8;
  parts.push({ id: "back0", name: "Back panel", size: [seam + W / 2 - 4, bh, BK], pos: [(seam - W / 2 + 4) / 2, f + 4 + bh / 2, -D / 2 + BK / 2], material: "fiber" });
  if (cfg.backs === 2) parts.push({ id: "back1", name: "Folding back panel", size: [W / 2 - 4 - seam, bh, BK], pos: [(W / 2 - 4 + seam) / 2, f + 4 + bh / 2, -D / 2 + BK / 2], material: "fiber" });

  const verticals = ["sideL", ...divX.map((_, i) => `div${i}`), "sideR"];
  const steps: CustomStep[] = [];
  const drawers = cfg.drawers ?? [];

  // the cabinet half of each drawer runner, screwed to the panels either side of its column
  if (drawers.length) {
    const yr = (d: (typeof drawers)[number]) => d.y0 + 30;
    const zr = D / 2 - FR - 20 - (dP - FR - 60) / 2;
    const rl = Math.round((dP - FR - 60) / 10) * 10;
    const left = drawers.map((d) => pt(xs[d.col][0], yr(d), zr)), right = drawers.map((d) => pt(xs[d.col][1], yr(d), zr));
    steps.push({
      title: "Screw the runners to the panels",
      detail: "Lay the side panels and dividers flat on a rug. Each runner is marked for its side; three screws hold each one.",
      add: [...new Set(drawers.flatMap((d) => [verticals[d.col], verticals[d.col + 1]]))],
      fix: [
        at("runner", left, [-1, 0, 0], { len: rl, dia: 20 }),
        at("runner", right, [1, 0, 0], { len: rl, dia: 20 }),
        // through the runner into the panel behind it
        at("screw", left.flatMap((p) => [-1, 0.5, 1].map((k) => pt(p[0] + 2, p[1], p[2] + k * (rl / 2 - 40)))), [-1, 0, 0], { len: 13, dia: 4 }),
        at("screw", right.flatMap((p) => [-1, 0.5, 1].map((k) => pt(p[0] - 2, p[1], p[2] + k * (rl / 2 - 40)))), [1, 0, 0], { len: 13, dia: 4 }),
      ],
      warnings: ["floor"],
    });
  }

  const feetX = [-W / 2 + 40, ...divX, W / 2 - 40];
  const feetPts = (feetX.length * 2 > cfg.feet ? [-W / 2 + 40, W / 2 - 40, ...divX].slice(0, cfg.feet / 2) : feetX).flatMap((fx) => [pt(fx, f, -D / 2 + 50), pt(fx, f, D / 2 - 50)]).slice(0, cfg.feet);
  const feetStep: CustomStep = { title: "Push the feet into the bottom panel", detail: `${cfg.feet} of them, along the front and back edges.`, fix: [at("glide", feetPts, [0, 1, 0], { on: "bot", dia: 30, len: 10 })] };
  const corners = [-1, 1].flatMap((sx) => [pt(sx * (W / 2 - t / 2), H - t / 2, -D / 2 + BK), pt(sx * (W / 2 - t / 2), f + t / 2, -D / 2 + BK)]);
  const lockStep: CustomStep = { title: "Screw in the four locking screws", detail: "One in each back corner, through the top and bottom into the sides.", fix: [at("bolt", corners, [0, 0, 1], { len: 30, dia: 6 })] };
  const divIds = divX.map((_, i) => `div${i}`);
  const fixIds = fixed.map((fx) => fx.id);
  const backRivets = (piece: number, n: number) => {
    const x0 = piece === 0 ? -W / 2 + 4 : seam, x1 = piece === 0 ? seam : W / 2 - 4;
    const extra: Vec3[] = [];
    for (const fx of fixed) {
      const a = Math.max(fx.x0, x0) + 50, b = Math.min(fx.x1, x1) - 50;
      if (b > a) extra.push(pt((a + b) / 2, fx.y, -D / 2));
    }
    for (const dx of divX) if (dx > x0 && dx < x1) extra.push(pt(dx, yMid, -D / 2));
    const ex = extra.slice(0, Math.max(0, n - 2));
    const k = Math.max(1, Math.ceil((n - ex.length) / 2));
    const xx = spread(x0 + 60, x1 - 60, k);
    return [...xx.map((q) => pt(q, H - t / 2, -D / 2)), ...xx.map((q) => pt(q, f + t / 2, -D / 2)), ...ex].slice(0, n);
  };
  const rivetStep = (piece: number, title: string): CustomStep => {
    const pts = backRivets(piece, cfg.rivets[piece] ?? 6);
    return { title, detail: "Push a rivet into each hole, then press a pin into each rivet so it spreads.", fix: [at("clip", pts, [0, 0, 1], { on: `back${piece}`, dia: 8, len: 16 }), at("clip", pts.map((q) => pt(q[0], q[1], q[2] - 6)), [0, 0, 1], { on: `back${piece}`, dia: 6, len: 22 })] };
  };
  const seamPts = spread(f + 120, H - 120, cfg.clips).map((y) => pt(seam, y, -D / 2));
  const wallStep: CustomStep = {
    title: "Fix it to the wall",
    detail: "Screw the wall fitting to the top at the back, then into the wall with screws and plugs that suit your wall.",
    fix: [at("bracket", (cfg.wall === 1 ? [0] : [-1, 1]).map((sx) => pt(sx * (W / 2 - t - 60), H - t, -D / 2 + 40)), [0, 1, 0], { on: "top" })],
    warnings: ["tip"],
  };

  if (cfg.flow === "front") {
    steps.push({ title: "Click a side onto the top", detail: "Lay them on their front edges on a rug. Press until the fittings click.", add: ["top", "sideL"], pose: "-z", people: 2, warnings: ["floor"] });
    if (divIds.length) steps.push({ title: fixIds.length ? "Click in the dividers and fixed shelves" : "Click in the divider", detail: "Each one hooks onto the fittings of the panel next to it.", add: [...divIds, ...fixIds] });
    else if (fixIds.length) steps.push({ title: "Click in the fixed shelf", detail: "Hook it onto the side and press until it clicks.", add: fixIds });
    steps.push({ title: "Click on the other side", detail: "Lower it onto every panel at once, then press until all the fittings click.", add: ["sideR"], people: 2 });
    steps.push(feetStep, { title: "Click the bottom panel on", detail: "Feet facing out. Press it down over each panel until all the fittings click.", add: ["bot"] }, lockStep);
    steps.push({ title: "Slide in the first back panel", detail: "Push it along the grooves until it stops, smooth face out.", add: ["back0"] }, rivetStep(0, "Fix it with the plastic rivets"));
    if (cfg.backs === 2) steps.push({ title: "Clip its free edge", detail: "Slide each clip into its hole along the edge.", fix: clipPair(seamPts, "back0") });
    steps.push({ title: "Stand it up together", detail: "Lift it by the sides, not the back.", pose: "+y", people: 2 });
    if (cfg.backs === 2) {
      steps.push({ title: "Slide in the second back panel", detail: "Open it out flat and push it into the grooves from the open side.", add: ["back1"], from: { back1: [W * 0.6, 0, 0] } });
      steps.push(rivetStep(1, "Rivet the second back panel"), { title: "Clip the panels together at the seam", detail: "The catches lock both edges so the back stays flat.", fix: clipPair(seamPts.map((q) => pt(q[0], q[1] + 40, q[2])), "back1") });
    }
  } else {
    steps.push({ ...feetStep, add: ["bot"], detail: `${feetStep.detail} Then turn it feet down on a rug.`, warnings: ["floor"] });
    if (drawers.length) {
      // the sides and dividers already stand there with their runners on
      steps.push({ title: divIds.length > 1 ? "Click the sides and dividers onto the bottom" : divIds.length ? "Click the sides and divider onto the bottom" : "Click the sides onto the bottom", detail: "Runners facing in. Push the fittings into the holes and press down until they click.", add: verticals });
    } else {
      steps.push({ title: "Click a side onto the bottom", detail: "Push the fittings into the holes and press down until they click.", add: ["sideL"] });
      if (divIds.length) steps.push({ title: "Click in the divider", detail: "It stands in the bottom the same way.", add: divIds });
      steps.push({ title: "Click on the other side", add: ["sideR"], detail: "Same as the first." });
    }
    if (fixIds.length) steps.push({ title: fixIds.length > 1 ? "Click in the fixed shelves" : "Click in the fixed shelf", detail: "Hook each one onto the panels either side and press until it clicks.", add: fixIds });
    steps.push({ title: "Click the top on", detail: "Lower it over every panel together and press along it until all the fittings click.", add: ["top"], people: 2 });
    steps.push(lockStep);
    steps.push({ title: "Slide in the back panel", detail: "From the top, along the grooves in the sides, smooth face out.", add: ["back0"], from: { back0: [0, H * 0.7, 0] } }, rivetStep(0, "Fix the back with the plastic rivets"));
    if (cfg.backs === 2) steps.push({ title: "Slide in the second back panel", detail: "Up against the first one.", add: ["back1"], from: { back1: [0, H * 0.7, 0] } }, rivetStep(1, "Rivet the second back panel"), { title: "Clip the panels together", detail: "The clips lock the two edges.", fix: clipPair(seamPts, "back1") });
  }
  steps.push(wallStep);

  // loose shelves on supports
  const loose = (cfg.shelves ?? []).flatMap((sh) => sh.ys.map((y) => ({ x0: xs[sh.col][0], x1: xs[sh.col][1], y })));
  loose.forEach((sh, i) => parts.push({ id: `sh${i}`, name: "Shelf", size: [sh.x1 - sh.x0 - 2, t, D - 40 - (cfg.sliding ? 50 : 0)], pos: [(sh.x0 + sh.x1) / 2, sh.y, cfg.sliding ? -10 : 0], material: cfg.sliding?.glass ? "board" : "board" }));
  if (cfg.rail) {
    const c = xs[0];
    parts.push({ id: "rail", name: "Clothes rail", size: [c[1] - c[0] - 4, 22, 22], pos: [(c[0] + c[1]) / 2, cfg.rail, -40], shape: "cyl", material: "metal" });
  }
  if (loose.length) {
    steps.push({ title: "Push in the shelf supports", detail: "Four for each shelf, at the same height on both sides.", fix: supports(loose, D) });
    steps.push({ title: loose.length > 1 ? "Lay the shelves on the supports" : "Lay the shelf on the supports", detail: "Tilt each one in and lower it until it sits flat.", add: loose.map((_, i) => `sh${i}`) });
  }
  if (cfg.rail) {
    const c = xs[0];
    steps.push({ title: "Screw up the clothes rail", detail: "Clip the rail into its holders and screw a holder to each side.", add: ["rail"], fix: [at("clip", [pt(c[0], cfg.rail, -40)], [-1, 0, 0], { dia: 30, len: 20 }), at("clip", [pt(c[1], cfg.rail, -40)], [1, 0, 0], { dia: 30, len: 20 }), at("screw", [-1, 1].map((k) => pt(c[0] + 2, cfg.rail!, -40 + k * 25)), [-1, 0, 0], { len: 12, dia: 4 }), at("screw", [-1, 1].map((k) => pt(c[1] - 2, cfg.rail!, -40 + k * 25)), [1, 0, 0], { len: 12, dia: 4 })] });
  }

  // sliding doors run in tracks pressed into the top and bottom
  if (cfg.sliding) {
    const yT = H - t, yB = f + t, dh = yT - yB - 16, dw = Math.round((W - 2 * t) / 2 + 20);
    parts.push({ id: "trB", name: "Bottom track", size: [W - 2 * t, 8, 50], pos: [0, yB + 4, D / 2 - 30], material: "metal" });
    parts.push({ id: "trT", name: "Top track", size: [W - 2 * t, 8, 50], pos: [0, yT - 4, D / 2 - 30], material: "metal" });
    const dz = [D / 2 - 43, D / 2 - 17];
    // a glass door is drawn as its white frame, so the shelves show through
    const fw = 40;
    const frame: PartPiece[] = [
      { shape: "box", size: [fw, dh, 18], pos: [-dw / 2 + fw / 2, 0, 0] },
      { shape: "box", size: [fw, dh, 18], pos: [dw / 2 - fw / 2, 0, 0] },
      { shape: "box", size: [dw - 2 * fw, fw, 18], pos: [0, dh / 2 - fw / 2, 0] },
      { shape: "box", size: [dw - 2 * fw, fw, 18], pos: [0, -dh / 2 + fw / 2, 0] },
    ];
    [-1, 1].forEach((sx, i) => parts.push({ id: `sd${i}`, name: cfg.sliding!.glass ? "Glass door" : "Sliding door", size: [dw, dh, 18], pos: [sx * (dw / 2 - 10), yB + 8 + dh / 2, dz[i]], material: "board", pieces: cfg.sliding!.glass ? frame : undefined }));
    const rollers = [-1, 1].flatMap((sx) => [-1, 1].map((k) => pt(sx * (dw / 2 - 10) + k * (dw / 2 - 60), yB + 8, dz[sx < 0 ? 0 : 1])));
    const guides = rollers.map((r) => pt(r[0], yT - 8, r[2]));
    steps.push({ title: "Press in the bottom track", detail: "Start at one end and press it into the groove, a section at a time.", add: ["trB"] });
    steps.push({ title: "Press in the top track", detail: "The same way, into the groove under the top.", add: ["trT"] });
    const onDoor = (i: number, pts: Vec3[]) => pts.filter((p) => (p[0] < 0) === (i === 0));
    steps.push({
      title: "Screw the rollers and guides onto the doors",
      detail: "Lay the doors on a rug. Rollers at the bottom edge, guides at the top.",
      wait: ["sd0", "sd1"],
      fix: [0, 1].flatMap((i) => [
        at("roller", onDoor(i, rollers), [0, 1, 0], { on: `sd${i}` }),
        at("clip", onDoor(i, guides), [0, -1, 0], { on: `sd${i}`, dia: 26, len: 18 }),
        at("screw", onDoor(i, rollers).flatMap((r) => [pt(r[0] - 25, r[1], r[2]), pt(r[0] + 25, r[1], r[2])]), [0, 1, 0], { on: `sd${i}`, len: 12, dia: 4 }),
        at("screw", onDoor(i, guides).flatMap((r) => [pt(r[0] - 25, r[1], r[2]), pt(r[0] + 25, r[1], r[2])]), [0, -1, 0], { on: `sd${i}`, len: 12, dia: 4 }),
      ]),
    });
    steps.push({ title: "Hang the back door, then the front one", detail: "Tilt the top into the top track, then lower the rollers into the bottom track until they lock.", add: ["sd0", "sd1"], from: { sd0: [0, 0, 400], sd1: [0, 0, 400] } });
    steps.push({ title: "Clip on the door stops and bumpers", detail: "They stop the doors at each end and keep them quiet.", fix: [at("clip", [pt(-W / 2 + t, H / 2, D / 2 - 30), pt(W / 2 - t, H / 2, D / 2 - 30)], [0, 0, -1], { dia: 18, len: 12 })] });
  }

  // hinged doors
  for (const [k, dr] of (cfg.doors ?? []).entries()) {
    const [c0, c1] = xs[dr.col];
    const dw = (c1 - c0 - 4 - (dr.n - 1) * 3) / dr.n, dh = dr.y1 - dr.y0 - 4;
    const ids: string[] = [];
    for (let i = 0; i < dr.n; i++) {
      const id = `door${k}_${i}`;
      ids.push(id);
      parts.push({ id, name: dr.mirror && i === 0 ? "Mirror door" : "Door", size: [dw, dh, FR], pos: [c0 + 2 + dw / 2 + i * (dw + 3), dr.y0 + 2 + dh / 2, D / 2 - FR / 2], material: "board" });
    }
  }
  const allDoors = (cfg.doors ?? []).flatMap((dr, k) => Array.from({ length: dr.n }, (_, i) => ({ id: `door${k}_${i}`, dr, i })));
  if (allDoors.length) {
    const hinge = (d: (typeof allDoors)[number]) => {
      const [c0, c1] = xs[d.dr.col];
      const left = d.dr.n === 1 ? true : d.i === 0;
      const xh = left ? c0 + 4 : c1 - 4;
      const ys = spread(d.dr.y0 + 90, d.dr.y1 - 90, d.dr.hinges);
      return ys.map((y) => pt(xh + (left ? 30 : -30), y, D / 2 - FR));
    };
    const hp = allDoors.flatMap(hinge);
    const doorFrom = Object.fromEntries(allDoors.map((d) => [d.id, [0, 0, 380] as Vec3]));
    steps.push({ title: allDoors.length > 1 ? "Screw the hinges onto the doors" : "Screw the hinges onto the door", detail: "Lay each door face down on a rug. Two screws hold each hinge.", add: allDoors.map((d) => d.id), from: doorFrom, fix: [at("hinge", hp, [0, 0, 1], { len: 50, dia: 35 }), at("screw", hp.flatMap((q) => [pt(q[0], q[1] - 20, q[2]), pt(q[0], q[1] + 20, q[2])]), [0, 0, 1], { len: 15, dia: 4 })], warnings: ["floor"] });
    steps.push({ title: allDoors.length > 1 ? "Hang the doors" : "Hang the door", detail: "Hook each hinge onto its plate inside the cabinet and press until it clicks. Adjust the screws until the gaps are even.", people: allDoors.some((d) => d.dr.y1 - d.dr.y0 > 1200) ? 2 : 1, tools: ["screwdriver"], kind: "hinges" });
  }

  // drawers, all built the same way at once
  if (drawers.length) {
    const dIds = drawers.map((d, i) => {
      const [c0, c1] = xs[d.col];
      const fw = c1 - c0 - 4, fh = d.y1 - d.y0 - 4;
      const bw = c1 - c0 - 26, bh = Math.min(fh - 40, 170), dd = dP - FR - 40;
      const zb = D / 2 - FR - dd / 2, yb = d.y0 + 20;
      const xc = (c0 + c1) / 2;
      const id = `dr${i}`;
      parts.push({ id: `${id}f`, name: "Drawer front", size: [fw, fh, FR], pos: [xc, d.y0 + 2 + fh / 2, D / 2 - FR / 2], material: "board" });
      parts.push({ id: `${id}sL`, name: "Drawer side", size: [12, bh, dd], pos: [xc - bw / 2 + 6, yb + bh / 2, zb], material: "board" });
      parts.push({ id: `${id}sR`, name: "Drawer side", size: [12, bh, dd], pos: [xc + bw / 2 - 6, yb + bh / 2, zb], material: "board" });
      parts.push({ id: `${id}b`, name: "Drawer bottom", size: [bw - 24, 3, dd - 12], pos: [xc, yb + 10, zb + 6], material: "fiber" });
      parts.push({ id: `${id}k`, name: "Drawer back", size: [bw - 24, bh - 20, 12], pos: [xc, yb + 10 + (bh - 20) / 2 + 2, zb - dd / 2 + 6], material: "board" });
      return { id, xc, bw, bh, dd, zb, yb, fh, d };
    });
    const from = (suffix: string[]) => Object.fromEntries(dIds.flatMap((d) => suffix.map((x) => [`${d.id}${x}`, [0, 0, 420] as Vec3])));
    const many = dIds.length > 1;
    const zIn = D / 2 - FR;
    steps.push({
      title: many ? "Screw the cam bolts into the drawer fronts" : "Screw the cam bolts into the drawer front",
      detail: "Lay each front face down on a rug. Four cam bolts go into the back of each front.",
      add: dIds.map((d) => `${d.id}f`),
      from: from(["f"]),
      fix: [at("camScrew", dIds.flatMap((d) => [-1, 1].flatMap((sx) => [d.yb + 30, d.yb + d.bh - 30].map((y) => pt(d.xc + sx * (d.bw / 2 - 6), y, zIn)))), [0, 0, 1])],
    });
    steps.push({ title: many ? "Push the sides onto the fronts" : "Push the sides onto the front", detail: "Over the cam bolts, grooves facing in.", add: dIds.flatMap((d) => [`${d.id}sL`, `${d.id}sR`]), from: from(["sL", "sR"]) });
    steps.push({ title: "Turn the cam locks", detail: "Four in each drawer, arrows toward the front.", fix: [at("cam", dIds.flatMap((d) => [-1, 1].flatMap((sx) => [d.yb + 30, d.yb + d.bh - 30].map((y) => pt(d.xc + sx * (d.bw / 2 - 12), y, zIn - 30))) ), [-1, 0, 0], { dia: 15 })], tools: ["screwdriver"] });
    steps.push({ title: many ? "Slide the bottoms into the grooves" : "Slide the bottom into the grooves", detail: "Smooth side up, all the way to the front.", add: dIds.map((d) => `${d.id}b`), from: from(["b"]) });
    steps.push({
      title: many ? "Fit the backs and screw them on" : "Fit the back and screw it on",
      detail: "Tap the wire stop into the back first. Two screws through each side into the back.",
      add: dIds.map((d) => `${d.id}k`),
      from: from(["k"]),
      fix: [at("clip", dIds.map((d) => pt(d.xc, d.yb + d.bh - 8, d.zb - d.dd / 2 + 12)), [0, 0, -1], { dia: 30, len: 8 }), at("screw", dIds.flatMap((d) => [-1, 1].flatMap((sx) => [d.yb + 40, d.yb + d.bh - 30].map((y) => pt(d.xc + sx * (d.bw / 2), y, d.zb - d.dd / 2 + 6)))), [0, 0, 1], { len: 30, dia: 4 })],
    });
    const runL = dIds.map((d) => pt(d.xc - d.bw / 2, d.d.y0 + 30, d.zb)), runR = dIds.map((d) => pt(d.xc + d.bw / 2, d.d.y0 + 30, d.zb));
    steps.push({
      title: "Screw the drawer runners on",
      detail: "Turn each drawer upside down. The runner marked for each side goes under its bottom edge, two screws each.",
      fix: [at("runner", runL, [1, 0, 0], { len: Math.round((dP - FR - 60) / 10) * 10, dia: 18 }), at("runner", runR, [-1, 0, 0], { len: Math.round((dP - FR - 60) / 10) * 10, dia: 18 }), at("screw", [...runL.map((q) => pt(q[0] + 6, q[1] - 10, q[2])), ...runR.map((q) => pt(q[0] - 6, q[1] - 10, q[2]))].flatMap((q) => [pt(q[0], q[1], q[2] - 60), pt(q[0], q[1], q[2] + 60)]), [0, 1, 0], { len: 10, dia: 4 })],
    });
    steps.push({ title: many ? "Screw a grip under each front" : "Screw the grip under the front", detail: "The metal grip goes under the top edge of the front.", fix: [at("handle", dIds.map((d) => pt(d.xc, d.d.y1 - 2, D / 2 - FR / 2)), [0, -1, 0], { len: 128, dia: 12 })] });
    steps.push({ title: many ? "Slide the drawers in" : "Slide the drawer in", detail: "Lift the front a little and push until the runners click together." });
  }
  return { parts, steps };
}

/** Where each VIHALS cabinet's columns, shelves and fronts go, from the photo and its manual. */
function cabinetCfg(s: ProductSpec): CabCfg | null {
  const W = s.size.w * 10, H = s.size.h * 10;
  const v = s.variant.toLowerCase();
  const bot = FEET + T, top = H - T, inH = top - bot;
  const inW = (n: number) => W - (n + 1) * T;
  const even = (a: number, b: number, n: number) => Array.from({ length: n }, (_, i) => Math.round(a + ((b - a) * (i + 1)) / (n + 1)));
  if (/^tv bench/.test(v)) {
    const cw = inW(3) / 3;
    const ySplit = top - 150; // a shallow drawer over a deep one
    return { flow: "upright", cols: [cw, cw, cw], feet: 8, backs: 2, rivets: [2, 10], clips: 4, shelves: [{ col: 0, ys: [bot + inH / 2] }, { col: 1, ys: [bot + inH / 2] }], drawers: [{ col: 2, y0: ySplit, y1: top }, { col: 2, y0: bot, y1: ySplit }], wall: 2 };
  }
  if (/^sideboard/.test(v)) {
    const cw = inW(2) / 2, yF = top - 150;
    return {
      flow: "upright",
      cols: [cw, cw],
      fixed: [{ col: 0, y: yF - T / 2 }, { col: 1, y: yF - T / 2 }],
      feet: 6,
      backs: 1,
      rivets: [16],
      clips: 0,
      shelves: [{ col: 0, ys: [bot + (yF - T - bot) / 2] }, { col: 1, ys: [bot + (yF - T - bot) / 2] }],
      doors: [{ col: 0, y0: bot, y1: yF - T, n: 2, hinges: 2 }, { col: 1, y0: bot, y1: yF - T, n: 2, hinges: 2 }],
      drawers: [{ col: 0, y0: yF, y1: top }, { col: 1, y0: yF, y1: top }],
      wall: 2,
    };
  }
  if (/^storage unit/.test(v)) {
    const yF = bot + Math.round(inH * 0.36);
    const yN = bot + Math.round(inH * 0.55);
    return {
      flow: "front",
      cols: [640, 0],
      fixed: [{ col: 0, y: yF + T / 2 }, { col: 1, y: yN }],
      feet: 6,
      backs: 2,
      rivets: [8, 8],
      clips: 3,
      shelves: [{ col: 0, ys: [Math.round((yF + T + top) / 2)] }, { col: 1, ys: [...even(bot, yN - T / 2, 1), ...even(yN + T / 2, top, 2)] }],
      doors: [{ col: 0, y0: yF + T, y1: top, n: 2, hinges: 2 }],
      drawers: [{ col: 0, y0: bot + Math.round((yF - bot) / 2), y1: yF }, { col: 0, y0: bot, y1: bot + Math.round((yF - bot) / 2) }],
      wall: 2,
    };
  }
  if (/^wardrobe/.test(v)) {
    const yS = top - 300;
    return { flow: "front", cols: [inW(1)], fixed: [{ col: 0, y: yS }], feet: 4, backs: 2, rivets: [8, 8], clips: 4, rail: yS - T / 2 - 60, doors: [{ col: 0, y0: bot, y1: top, n: 2, hinges: 4, mirror: true }], wall: 2 };
  }
  if (/sliding/.test(v)) {
    const cw = inW(2) / 2;
    return { flow: "front", cols: [cw, cw], feet: 6, backs: 2, rivets: [6, 6], clips: 3, shelves: [{ col: 0, ys: even(bot, top, 2) }, { col: 1, ys: even(bot, top, 2) }], sliding: { glass: /glass/.test(v) }, wall: 2 };
  }
  const ch = /^chest of (\d) drawers/.exec(v);
  // the chests with manuals: 4 drawers 90 high, 6 drawers 120 high, 6 drawers in two columns 75 high
  if (ch && [900, 1200, 750].some((h) => Math.abs(h - H) < 30)) {
    const n = Number(ch[1]);
    const cols = W > 1000 ? 2 : 1;
    const rows = n / cols;
    const cw = inW(cols) / cols;
    const ys = Array.from({ length: rows + 1 }, (_, i) => Math.round(bot + (inH * i) / rows));
    const drawers = Array.from({ length: cols }, (_, c) => Array.from({ length: rows }, (_, r) => ({ col: c, y0: ys[rows - 1 - r], y1: ys[rows - r] }))).flat();
    return { flow: "upright", cols: Array(cols).fill(cw), feet: cols === 2 ? 6 : 4, backs: 1, rivets: [cols === 2 ? 12 : 8], clips: 0, drawers, wall: 1 };
  }
  return null;
}

/* ---------------- bedside table ---------------- */

/*
 * The bedside table clicks together like the cabinets: the top onto a side, the other side, the bottom, then the
 * back. Two locking pins are tapped into the top, it goes upside down for the four castors (four screws each), and
 * the loose shelf sits on four supports.
 */
function bedsideRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10, t = T;
  const cH = 58; // castors
  const sideH = H - cH - t;
  const parts: CustomPart[] = [
    { id: "top", name: "Top panel", size: [W, t, D], pos: [0, H - t / 2, 0], material: "board" },
    { id: "sideL", name: "Side panel", size: [t, sideH, D - BK], pos: [-W / 2 + t / 2, cH + sideH / 2, BK / 2], material: "board" },
    { id: "sideR", name: "Side panel", size: [t, sideH, D - BK], pos: [W / 2 - t / 2, cH + sideH / 2, BK / 2], material: "board" },
    { id: "bot", name: "Bottom panel", size: [W - 2 * t, t, D - BK], pos: [0, cH + t / 2, BK / 2], material: "board" },
    { id: "back", name: "Back panel", size: [W - 2 * t, sideH - t, BK], pos: [0, cH + t + (sideH - t) / 2, -D / 2 + BK / 2], material: "board" },
  ];
  const ys = Math.round(H - t - 150);
  parts.push({ id: "shelf", name: "Shelf", size: [W - 2 * t - 2, t, D - 30], pos: [0, ys, 12], material: "board" });
  const cx = W / 2 - 40, cz = D / 2 - 40;
  const wheels = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => pt(a * cx, cH, b * cz));
  const steps: CustomStep[] = [
    { title: "Click the top onto a side", detail: "Push the two fittings into the holes and press down until they click.", add: ["top", "sideL"], pose: "-y", warnings: ["floor"] },
    { title: "Click on the other side", detail: "Same as the first. Lay it on a rug, top down.", add: ["sideR"] },
    { title: "Click the bottom panel in", detail: "Press it down between the sides until all the fittings click.", add: ["bot"] },
    { title: "Click the back panel on", detail: "It closes the back between the sides.", add: ["back"] },
    {
      title: "Tap the locking pins into the top",
      detail: "Stand it up. Two pins go through the top into the back panel.",
      fix: [at("nail", [pt(-W / 2 + 70, H, -D / 2 + 10), pt(W / 2 - 70, H, -D / 2 + 10)], [0, -1, 0], { on: "top", len: 40, dia: 6 })],
      pose: "+y",
    },
    {
      title: "Screw on the castors",
      detail: "Turn it upside down. Four screws hold each castor plate to the bottom.",
      fix: [at("castor", wheels, [0, 1, 0], { on: "bot" }), at("screw", wheels.flatMap((w) => [-1, 1].flatMap((a) => [-1, 1].map((b) => pt(w[0] + a * 18, cH, w[2] + b * 18)))), [0, 1, 0], { on: "bot", len: 16, dia: 4 })],
      pose: "-y",
    },
    { title: "Push in the shelf supports", detail: "Turn it back over. Two in each side, at the same height.", fix: supports([{ x0: -W / 2 + t, x1: W / 2 - t, y: ys }], D), pose: "+y" },
    { title: "Lay the shelf on the supports", add: ["shelf"] },
  ];
  return { parts, steps };
}

/* ---------------- dining chair ---------------- */

/*
 * The chair frame is steel tube pegged together: the two rear tubes onto the seat frame, the front leg frame on,
 * four bolts with toothed nuts by hand, then the backrest clicks down over the posts, the bolts are tightened with
 * the spanner and the seat clicks onto the frame.
 */
function chairRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, H = s.size.h * 10, D = s.size.d * 10;
  const sh = 450, tube = 20;
  const xL = W / 2 - 40, zB = -D / 2 + 60, zF = D / 2 - 60;
  const zR = zB + 20, yF = sh - 30;
  const parts: CustomPart[] = [
    {
      id: "frame",
      name: "Seat frame",
      size: [2 * xL + tube, tube, zF - zR],
      pos: [0, yF, (zF + zR) / 2],
      material: "metal",
      pieces: [
        { shape: "cyl", size: [tube, zF - zR, tube], pos: [-xL, 0, 0], rot: [Math.PI / 2, 0, 0] },
        { shape: "cyl", size: [tube, zF - zR, tube], pos: [xL, 0, 0], rot: [Math.PI / 2, 0, 0] },
        { shape: "cyl", size: [tube, 2 * xL, tube], pos: [0, 0, -(zF - zR) / 2], rot: [0, 0, Math.PI / 2] },
      ],
    },
    ...[-1, 1].map((sx, i): CustomPart => ({ id: `rear${i}`, name: "Rear leg", size: [tube, H - 60, tube], pos: [sx * xL, (H - 60) / 2, zR - tube], shape: "cyl", material: "metal", rot: [-0.06, 0, 0] })),
    {
      id: "front",
      name: "Front leg frame",
      size: [2 * xL + tube, yF - tube / 2, tube],
      pos: [0, (yF - tube / 2) / 2, zF + tube],
      material: "metal",
      pieces: [
        { shape: "cyl", size: [tube, yF - tube / 2, tube], pos: [-xL, 0, 0] },
        { shape: "cyl", size: [tube, yF - tube / 2, tube], pos: [xL, 0, 0] },
        { shape: "cyl", size: [tube, 2 * xL, tube], pos: [0, (yF - tube / 2) / 2 - 10, 0], rot: [0, 0, Math.PI / 2] },
      ],
    },
    { id: "back", name: "Backrest", size: [W - 40, 260, 40], pos: [0, H - 150, zR - 40], material: "soft", rot: [-0.12, 0, 0] },
    { id: "seat", name: "Seat", size: [W - 20, 60, D - 90], pos: [0, sh + 10, 25], material: "soft" },
  ];
  const bolts = [pt(-xL - tube / 2, yF, zR), pt(xL + tube / 2, yF, zR)];
  const fb = [pt(-xL - tube / 2, yF, zF), pt(xL + tube / 2, yF, zF)];
  const steps: CustomStep[] = [
    { title: "Push a rear leg onto the seat frame", detail: "Lay the frame upside down. The hole in the leg lines up with the hole in the frame.", add: ["frame", "rear0"], pose: "-y", warnings: ["floor"] },
    { title: "Push on the other rear leg", detail: "Check the bend in both legs points the same way.", add: ["rear1"] },
    { title: "Push the front leg frame on", detail: "Both pegs go into the ends of the seat frame.", add: ["front"] },
    {
      title: "Put in the bolts and nuts by hand",
      detail: "One through each joint, with the toothed nut on the inside. Only hand tight for now.",
      fix: [
        at("bolt", [bolts[0], fb[0]], [1, 0, 0], { len: 30, dia: 6 }),
        at("bolt", [bolts[1], fb[1]], [-1, 0, 0], { len: 30, dia: 6 }),
        at("nut", [pt(-xL + tube / 2, yF, zR), pt(-xL + tube / 2, yF, zF)], [-1, 0, 0], { dia: 6 }),
        at("nut", [pt(xL - tube / 2, yF, zR), pt(xL - tube / 2, yF, zF)], [1, 0, 0], { dia: 6 }),
      ],
    },
    { title: "Click the backrest down over the posts", detail: "Turn the chair upright and press the backrest down until it clicks.", add: ["back"], pose: "+y", from: { back: [0, 260, 0] } },
    { title: "Tighten the bolts with the spanner", detail: "Hold each nut still while you turn the bolt.", tools: ["wrench"], kind: "bolts" },
    { title: "Clip the seat onto the frame", detail: "Hook the back clips on first, then press the front down until it clicks.", add: ["seat"] },
  ];
  return { parts, steps };
}

/* ---------------- folding chair ---------------- */

/*
 * The folding chair comes assembled and has no manual: it is unfolded and locked, nothing more. Its frame is two
 * long tubes from the back feet up into the backrest, a front frame from the front feet up under the seat, and the
 * seat hinged between them.
 */
function foldingChairRecipe(s: ProductSpec): CustomParams {
  const W = Math.round(s.size.w * 10) || 430, H = Math.round(s.size.h * 10) || 800, D = Math.round(s.size.d * 10) || 470;
  const yS = 450, tube = 20, xs = W / 2 - tube;
  const tubeBetween = (a: [number, number], c: [number, number], x: number): PartPiece => {
    const dy = c[0] - a[0], dz = c[1] - a[1];
    return { shape: "cyl", size: [tube, Math.round(Math.hypot(dy, dz)), tube], pos: [x, (a[0] + c[0]) / 2 - H / 2, (a[1] + c[1]) / 2], rot: [Math.atan2(dz, dy), 0, 0] };
  };
  const back: [number, number][] = [[0, -D / 2 + 30], [H - 20, -D / 2 + 90]];
  const front: [number, number][] = [[0, D / 2 - 20], [yS - 30, -D / 2 + 110]];
  const pieces: PartPiece[] = [
    ...[-1, 1].map((sx) => tubeBetween(back[0], back[1], sx * xs)),
    ...[-1, 1].map((sx) => tubeBetween(front[0], front[1], sx * (xs - tube))),
    { shape: "cyl", size: [tube, 2 * (xs - tube), tube], pos: [0, 20 - H / 2, D / 2 - 30], rot: [0, 0, Math.PI / 2] },
  ];
  const parts: CustomPart[] = [
    { id: "frame", name: "Chair frame", size: [W, H, D], pos: [0, H / 2, 0], material: "metal", pieces },
    { id: "back", name: "Backrest", size: [W - 10, 150, 22], pos: [0, H - 90, -D / 2 + 84], material: "board" },
    { id: "seat", name: "Seat", size: [W - 40, 22, D - 80], pos: [0, yS, 30], material: "board" },
  ];
  const steps: CustomStep[] = [
    { title: "Take the folded chair out of the box", detail: "It comes assembled, with nothing to screw together. Stand it on its feet, still folded.", add: ["frame", "back"], from: { frame: [0, 300, 0], back: [0, 300, 0] } },
    { title: "Unfold it and press the seat down", detail: "Pull the back and the front legs apart, then push the seat down until it lies flat and the frame locks.", add: ["seat"], from: { seat: [0, 260, -200] } },
    { title: "Check it stands steady", detail: "All four feet should touch the floor. To fold it, lift the front edge of the seat." },
  ];
  return { parts, steps };
}

/* ---------------- bed frames ---------------- */

/*
 * The bed: plastic glides into the bottom edges of the head and foot boards and cam bolts into their inner faces;
 * dowels and cam locks into the side rails. Two people join a rail to the headboard, then the other rail and the
 * footboard; barrel nuts go into the rails and long bolts through the boards into them. The slat rails screw on
 * inside, two cross straps under them (the double also has a centre beam on two brackets), slat stops, and the
 * roll-out slats. Each set of two storage boxes is a long and a short box on dowels and cam locks, on castors.
 */

function bedRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, L = s.size.d * 10, HH = s.size.h * 10, t = T;
  const dbl = (s.bed?.mattressW ?? 90) >= 120;
  const FH = 360, rY0 = 180, rH = FH - rY0; // footboard height, side rails
  const xr = W / 2 - t / 2, zh = -L / 2 + t / 2, zf = L / 2 - t / 2;
  const railL = L - 2 * t, yRail = rY0 + rH / 2;
  const ySr = 290, srS = 30; // slat rails: steel angles inside the side rails
  const xs = W / 2 - t - srS / 2;
  const parts: CustomPart[] = [
    { id: "head", name: "Headboard", size: [W, HH, t], pos: [0, HH / 2, zh], material: "board" },
    { id: "foot", name: "Footboard", size: [W, FH, t], pos: [0, FH / 2, zf], material: "board" },
    { id: "railL", name: "Side rail", size: [t, rH, railL], pos: [-xr, yRail, 0], material: "board" },
    { id: "railR", name: "Side rail", size: [t, rH, railL], pos: [xr, yRail, 0], material: "board" },
    { id: "srL", name: "Slat rail", size: [srS, srS, railL], pos: [-xs, ySr, 0], material: "metal" },
    { id: "srR", name: "Slat rail", size: [srS, srS, railL], pos: [xs, ySr, 0], material: "metal" },
  ];
  // two cross straps from corner to corner under the slat rails
  const dx = 2 * xs, dz = railL - 80, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
  parts.push({ id: "strap0", name: "Cross strap", size: [24, 3, len], pos: [0, ySr - srS / 2 - 2, 0], material: "metal", rot: [0, ang, 0] });
  parts.push({ id: "strap1", name: "Cross strap", size: [24, 3, len], pos: [0, ySr - srS / 2 - 5, 0], material: "metal", rot: [0, -ang, 0] });
  // the centre beam sits between the straps and the slats
  if (dbl) parts.push({ id: "beam", name: "Centre beam", size: [40, 30, railL], pos: [0, ySr, 0], material: "metal" });
  const yS = ySr + srS / 2 + 8;
  parts.push({ id: "slats", name: "Slatted bed base", size: [2 * (xs + srS / 2) - 10, 16, railL - 20], pos: [0, yS, 0], material: "wood" });

  const sx = [-1, 1];
  const yHi = yRail + rH / 4, yLo = yRail - rH / 4;
  const glides = [pt(-W / 2 + 40, 0, zh), pt(W / 2 - 40, 0, zh), pt(-W / 2 + 40, 0, zf), pt(W / 2 - 40, 0, zf), ...(dbl ? [pt(0, 0, zh), pt(0, 0, zf)] : [])];
  const camBolts = sx.flatMap((a) => [pt(a * xr, yHi, zh + t / 2), pt(a * xr, yHi, zf - t / 2)]);
  const dowels = sx.flatMap((a) => [pt(a * xr, yRail - 10, -L / 2 + t), pt(a * xr, yLo - 30, -L / 2 + t), pt(a * xr, yRail - 10, L / 2 - t), pt(a * xr, yLo - 30, L / 2 - t)]);
  const cams = (a: number) => [pt(a * (xr - t / 2), yHi, -L / 2 + t + 34), pt(a * (xr - t / 2), yHi, L / 2 - t - 34)];
  const nuts = (a: number) => [pt(a * (xr - t / 2), yLo, -L / 2 + t + 50), pt(a * (xr - t / 2), yLo, L / 2 - t - 50)];
  const srScrews = (a: number) => spread(-railL / 2 + 80, railL / 2 - 80, 8).map((z) => pt(a * (xs - srS / 2), ySr, z));
  // each strap end is screwed up through the strap into its slat rail; strap0 runs from back left to front right
  const yS0 = ySr - srS / 2 - 3.5, yS1 = ySr - srS / 2 - 6.5;

  const steps: CustomStep[] = [
    { title: "Push the glides into the head and foot boards", detail: "Lay both boards flat on a rug. The glides go into the holes in their bottom edges.", add: ["head", "foot"], fix: [at("glide", glides, [0, 1, 0], { dia: 30, len: 10 })], warnings: ["floor"] },
    { title: "Screw the cam bolts into both boards", detail: "Into the inside faces, by hand until they stop.", fix: [at("camScrew", camBolts.filter((p) => p[2] < 0), [0, 0, -1], { on: "head" }), at("camScrew", camBolts.filter((p) => p[2] > 0), [0, 0, 1], { on: "foot" })] },
    {
      title: "Tap the dowels into the side rails",
      detail: "Two into each end of both rails.",
      fix: sx.flatMap((a) => [at("dowel", dowels.filter((p) => p[2] < 0 && p[0] * a > 0), [0, 0, 1], { on: a < 0 ? "railL" : "railR", mate: "head" }), at("dowel", dowels.filter((p) => p[2] > 0 && p[0] * a > 0), [0, 0, -1], { on: a < 0 ? "railL" : "railR", mate: "foot" })]),
    },
    { title: "Push the cam locks into the side rails", detail: "Arrows pointing to the ends of the rails.", fix: [at("cam", cams(-1), [-1, 0, 0], { on: "railL", dia: 25 }), at("cam", cams(1), [1, 0, 0], { on: "railR", dia: 25 })] },
    { title: "Lock the side rails to the headboard", detail: "One holds the headboard upright while the other pushes each rail onto its cam bolts. Turn the cam locks to pull them tight.", people: 2, tools: ["screwdriver"], warnings: ["two"], kind: "cams" },
    { title: "Lock the footboard onto the rails", detail: "Push it over the dowels and cam bolts at the other end, then turn the cam locks.", people: 2, tools: ["screwdriver"], kind: "cams" },
    { title: "Push the barrel nuts into the rails", detail: "Turn each one so its hole faces the end of the rail.", fix: [at("nut", nuts(-1), [-1, 0, 0], { dia: 10 }), at("nut", nuts(1), [1, 0, 0], { dia: 10 })], tools: ["flathead"] },
    {
      title: "Bolt the boards to the rails",
      detail: "The long bolts go through the head and foot boards into the barrel nuts. Tighten them with the Allen key.",
      fix: [
        at("bolt", sx.map((a) => pt(a * xr, yLo, -L / 2)), [0, 0, 1], { on: "head", len: 100, dia: 7 }),
        at("bolt", sx.map((a) => pt(a * xr, yLo, L / 2)), [0, 0, -1], { on: "foot", len: 100, dia: 7 }),
      ],
    },
    { title: "Screw the slat rails inside the side rails", detail: "Turn the screws in by hand, not with a drill. The flat edge faces up.", add: ["srL", "srR"], fix: [at("screw", srScrews(-1), [-1, 0, 0], { len: 15, dia: 5 }), at("screw", srScrews(1), [1, 0, 0], { len: 15, dia: 5 })] },
  ];
  if (dbl) {
    const brk = [pt(0, ySr - 30, -L / 2 + t), pt(0, ySr - 30, L / 2 - t)];
    steps.push({ title: "Screw a beam bracket to each board", detail: "In the middle of the headboard and the footboard, open side up.", fix: [at("angle", [brk[0]], [0, 0, -1], { on: "head", len: 60, dia: 50 }), at("angle", [brk[1]], [0, 0, 1], { on: "foot", len: 60, dia: 50 }), at("screw", [pt(-25, brk[0][1], brk[0][2] + 1), pt(25, brk[0][1], brk[0][2] + 1)], [0, 0, -1], { on: "head", len: 15, dia: 5 }), at("screw", [pt(-25, brk[1][1], brk[1][2] - 1), pt(25, brk[1][1], brk[1][2] - 1)], [0, 0, 1], { on: "foot", len: 15, dia: 5 })] });
  }
  steps.push({
    title: "Screw the cross straps under the slat rails",
    detail: "From corner to corner, so they cross in the middle. They keep the frame square.",
    add: ["strap0", "strap1"],
    fix: [
      at("screw", [pt(-xs, yS0, -dz / 2), pt(xs, yS0, dz / 2)], [0, 1, 0], { on: "strap0", len: 10, dia: 4 }),
      at("screw", [pt(xs, yS1, -dz / 2), pt(-xs, yS1, dz / 2), pt(0, yS1, 0)], [0, 1, 0], { on: "strap1", len: 10, dia: 4 }),
    ],
    check: "square",
  });
  if (dbl) steps.push({ title: "Lay the centre beam on the brackets", detail: "Join its two halves first, then drop the ends into the brackets.", add: ["beam"] });
  steps.push({
    title: "Screw on the slat stops",
    detail: "One at each end of both slat rails.",
    fix: [at("clip", sx.flatMap((a) => [pt(a * xs, ySr + srS / 2, -railL / 2 + 30), pt(a * xs, ySr + srS / 2, railL / 2 - 30)]), [0, -1, 0], { dia: 24, len: 20 }), at("screw", sx.flatMap((a) => [pt(a * xs, ySr + srS / 2, -railL / 2 + 55), pt(a * xs, ySr + srS / 2, railL / 2 - 55)]), [0, -1, 0], { len: 10, dia: 6 })],
  });
  steps.push({ title: "Roll out the slats", detail: "Curved side up. Push each end slat under its stop.", add: ["slats"] });
  return { parts, steps };
}

/** Storage boxes on castors, a long one and a short one per set, built where they go and pushed under the frame. */
function boxParts(sets: { x: number; side: 1 | -1 }[], z0: number, z1: number, boxH: number, boxD: number, o: { ratio?: number; swap?: boolean } = {}): { parts: CustomPart[]; steps: CustomStep[] } {
  const t = 16, cH = 30;
  const parts: CustomPart[] = [];
  const steps: CustomStep[] = [];
  const gap = 20;
  const Lt = z1 - z0 - gap, Llong = Math.round(Lt * (o.ratio ?? 0.62)), Lshort = Lt - Llong;
  sets.forEach((st, k) => {
    const boxes = [{ z: z0 + Llong / 2, l: Llong, div: 1 }, { z: z1 - Lshort / 2, l: Lshort, div: 0 }];
    const x = st.x, xo = x + st.side * (boxD / 2 - t / 2), xi = x - st.side * (boxD / 2 - t / 2);
    const ids: string[][] = [];
    boxes.forEach((bx, j) => {
      const id = `bx${k}_${j}`;
      const yb = cH + t / 2, ys = cH + t + (boxH - t) / 2;
      const list: CustomPart[] = [
        { id: `${id}b`, name: "Box bottom", size: [boxD, t, bx.l] as Vec3, pos: [x, yb, bx.z] as Vec3 },
        { id: `${id}f`, name: "Box front", size: [t, boxH + cH - 4, bx.l] as Vec3, pos: [xo, (boxH + cH - 4) / 2 + 4, bx.z] as Vec3 },
        { id: `${id}k`, name: "Box back", size: [t, boxH - t, bx.l - 2 * t] as Vec3, pos: [xi, ys, bx.z] as Vec3 },
        { id: `${id}e0`, name: "Box end", size: [boxD - 2 * t, boxH - t, t] as Vec3, pos: [x, ys, bx.z - bx.l / 2 + t / 2] as Vec3 },
        { id: `${id}e1`, name: "Box end", size: [boxD - 2 * t, boxH - t, t] as Vec3, pos: [x, ys, bx.z + bx.l / 2 - t / 2] as Vec3 },
      ];
      if (bx.div) list.push({ id: `${id}d`, name: "Box divider", size: [boxD - 2 * t, boxH - t, t], pos: [x, ys, bx.z] });
      for (const p of list) parts.push({ ...p, material: "board" });
      ids.push(list.map((p) => p.id));
    });
    const all = ids.flat();
    const bottoms = ids.map((l) => l[0]);
    const uprights = all.filter((id) => !bottoms.includes(id));
    const castors = boxes.flatMap((bx) => {
      const n = bx.div ? 5 : 4;
      return spread(bx.z - bx.l / 2 + 60, bx.z + bx.l / 2 - 60, n === 5 ? 3 : 2).flatMap((z, i) => (n === 5 && i === 1 ? [pt(x, cH, z)] : [pt(x - boxD / 2 + 70, cH, z), pt(x + boxD / 2 - 70, cH, z)]));
    });
    const from = Object.fromEntries(all.map((id) => [id, [st.side * (boxD + 300), 0, 0] as Vec3]));
    const two = sets.length > 1 && k === 0;
    steps.push(
      { title: two ? "Build the first set of storage boxes" : "Lay out the storage box bottoms", detail: "A long box and a short one. Lay the bottoms on a rug, holes up.", add: bottoms, from },
      {
        title: "Tap in the dowels and screw in the cam bolts",
        detail: "Into the holes along the edges of the bottoms and the ends of the panels. Two lengths of cam bolt: check the drawing.",
        fix: [
          { kind: "dowel", count: 26, to: [bottoms[0]] },
          { kind: "dowel", count: 26, to: [bottoms[1]] },
          { kind: "camScrew", count: 11, to: [bottoms[0]] },
          { kind: "camScrew", count: 11, len: 44, to: [bottoms[1]] },
        ],
      },
      { title: "Stand the front, back, ends and divider on the bottoms", detail: "Each one pushes down over its dowels and cam bolts.", add: uprights, from: Object.fromEntries(uprights.map((id) => [id, [0, 250, 0] as Vec3])) },
      { title: "Turn the cam locks to pull the boxes tight", detail: "One for every cam bolt.", fix: [{ kind: "cam", count: 22 }], tools: ["screwdriver"] },
      { title: "Screw on the castors", detail: "Turn each box over. Two screws hold each castor.", fix: [at("castor", castors, [0, 1, 0]), at("screw", castors.flatMap((c) => [pt(c[0] - 25, cH, c[2]), pt(c[0] + 25, cH, c[2])]), [0, 1, 0], { len: 14, dia: 4 })] },
    );
    if (two) steps.push({ title: "Build the second set the same way", detail: "Then push all the boxes under the bed, fronts out." });
    else steps.push({ title: "Push the boxes in under the frame", detail: "Fronts out. They roll in on their castors." });
  });
  if (!o.swap) return { parts, steps };
  // a day-bed's boxes run along its length (x) and come out of the front (z)
  const sw = (v: Vec3): Vec3 => [v[2], v[1], v[0]];
  return {
    parts: parts.map((p) => ({ ...p, size: sw(p.size), pos: sw(p.pos) })),
    steps: steps.map((st) => ({
      ...st,
      from: st.from && Object.fromEntries(Object.entries(st.from).map(([k, v]) => [k, sw(v)])),
      fix: st.fix?.map((f) => ({ ...f, at: f.at?.map(sw), dir: f.dir && sw(f.dir) })),
    })),
  };
}

function bedWithBoxes(s: ProductSpec): CustomParams {
  const r = bedRecipe(s);
  const n = /(\d) storage boxes/i.exec(s.variant)?.[1];
  if (!n) return r;
  const W = s.size.w * 10, L = s.size.d * 10;
  const boxD = 560;
  const sets: { x: number; side: 1 | -1 }[] = n === "4" ? [{ x: W / 2 - boxD / 2 + 10, side: 1 }, { x: -W / 2 + boxD / 2 - 10, side: -1 }] : [{ x: W / 2 - boxD / 2 + 10, side: 1 }];
  const b = boxParts(sets, -L / 2 + T + 20, L / 2 - T - 20, 140, boxD);
  // the second set of a bed with four boxes repeats the first: one set of steps, done twice
  const steps = n === "4" ? mergeSets(b.steps) : b.steps;
  return { parts: [...r.parts, ...b.parts], steps: [...r.steps, ...steps] };
}

/** Two sets built the same way: keep the first set's steps, add the second set's parts with them, and say so. */
function mergeSets(steps: CustomStep[]): CustomStep[] {
  const half = (steps.length - 1) / 2;
  const a = steps.slice(0, half), b = steps.slice(half + 1);
  return a.map((st, i): CustomStep => ({
    ...st,
    title: i === 0 ? "Lay out the storage box bottoms" : st.title,
    detail: i === 0 ? "Two sets: a long box and a short one in each. Lay the bottoms on a rug, holes up." : st.detail,
    add: [...(st.add ?? []), ...(b[i].add ?? [])],
    from: { ...st.from, ...b[i].from },
    fix: st.fix && [...st.fix, ...(b[i].fix ?? [])],
  })).concat([{ title: "Push the boxes in under the frame", detail: "Fronts out, both sides. They roll in on their castors." }]);
}

/* ---------------- day-beds ---------------- */

/*
 * The day-bed: dowels and cam locks into the back panel and the front rail, feet and cam bolts into the two end
 * panels; two people join the back panel and the front rail to one end, then the other end goes on. Cover caps on
 * the ends, the slat rails screwed inside, slat stops, two cross straps and the roll-out slats. Storage boxes are the
 * bed's box set, pushed in under the front; the trundle bed is its own frame on castors, built upside down.
 */
function dayBedRecipe(s: ProductSpec): CustomParams {
  const W = s.size.w * 10, D = s.size.d * 10, H = s.size.h * 10, t = T;
  const v = s.variant.toLowerCase();
  const xe = W / 2 - t / 2, zb = -D / 2 + t / 2, zf = D / 2 - t / 2;
  const inW = W - 2 * t;
  const fY0 = 200, fH = 160; // the front rail, high enough for the boxes or the trundle under it
  const ySr = 290, srS = 30, zs = D / 2 - t - srS / 2;
  const parts: CustomPart[] = [
    { id: "back", name: "Back panel", size: [inW, H - 60, t], pos: [0, 60 + (H - 60) / 2, zb], material: "board" },
    { id: "front", name: "Front rail", size: [inW, fH, t], pos: [0, fY0 + fH / 2, zf], material: "board" },
    { id: "endL", name: "End panel", size: [t, H, D], pos: [-xe, H / 2, 0], material: "board" },
    { id: "endR", name: "End panel", size: [t, H, D], pos: [xe, H / 2, 0], material: "board" },
    { id: "srB", name: "Slat rail", size: [inW, srS, srS], pos: [0, ySr, -zs], material: "metal" },
    { id: "srF", name: "Slat rail", size: [inW, srS, srS], pos: [0, ySr, zs], material: "metal" },
  ];
  const dx = inW - 80, dz = 2 * zs, len = Math.hypot(dx, dz), ang = Math.atan2(dz, dx);
  parts.push({ id: "strap0", name: "Cross strap", size: [len, 3, 24], pos: [0, ySr - srS / 2 - 2, 0], material: "metal", rot: [0, ang, 0] });
  parts.push({ id: "strap1", name: "Cross strap", size: [len, 3, 24], pos: [0, ySr - srS / 2 - 5, 0], material: "metal", rot: [0, -ang, 0] });
  const yS = ySr + srS / 2 + 8;
  parts.push({ id: "slats", name: "Slatted bed base", size: [inW - 20, 16, 2 * (zs + srS / 2) - 10], pos: [0, yS, 0], material: "wood" });

  const xa = [-1, 1];
  const yHi = fY0 + fH * 0.75, yLo = fY0 + fH * 0.25, yBk = [H * 0.3, H * 0.7];
  // dowels and cam bolts: two at each end of the front rail, two at each end of the back panel
  const jointY = (id: "back" | "front") => (id === "front" ? [yHi, yLo] : yBk);
  const jointZ = (id: "back" | "front") => (id === "front" ? zf : zb);
  const dowels = (id: "back" | "front", a: number) => jointY(id).map((y) => pt(a * (W / 2 - t), y + 30, jointZ(id)));
  const camBolts = (id: "back" | "front", a: number) => jointY(id).map((y) => pt(a * (W / 2 - t), y - 30, jointZ(id)));
  const cams = (id: "back" | "front", a: number) => jointY(id).map((y) => pt(a * (W / 2 - t - 34), y - 30, jointZ(id) + (id === "front" ? -t / 2 : t / 2)));
  const feet = xa.flatMap((a) => [pt(a * xe, 0, -D / 2 + 60), pt(a * xe, 0, D / 2 - 60)]);
  const srScrews = (z: number, dir: number) => spread(-inW / 2 + 80, inW / 2 - 80, 8).map((x) => pt(x, ySr, z + dir * (srS / 2)));
  // up through each strap end into its slat rail: strap0 runs from front left to back right, strap1 the other way
  const yS0 = ySr - srS / 2 - 3.5, yS1 = ySr - srS / 2 - 6.5;

  const steps: CustomStep[] = [
    {
      title: "Tap the dowels into the back panel and front rail",
      detail: "Two into each end of both. Lay them flat on a rug.",
      fix: (["back", "front"] as const).flatMap((id) => [at("dowel", dowels(id, -1), [1, 0, 0], { on: id, mate: "endL" }), at("dowel", dowels(id, 1), [-1, 0, 0], { on: id, mate: "endR" })]),
      warnings: ["floor"],
    },
    {
      title: "Push in the cam locks",
      detail: "Near each end, arrows pointing to the end.",
      fix: [at("cam", xa.flatMap((a) => cams("back", a)), [0, 0, -1], { on: "back", dia: 25 }), at("cam", xa.flatMap((a) => cams("front", a)), [0, 0, 1], { on: "front", dia: 25 })],
    },
    { title: "Push the feet into the end panels", detail: "Two in the bottom edge of each.", add: ["endL", "endR"], fix: [at("glide", feet, [0, 1, 0], { dia: 30, len: 10 })] },
    {
      title: "Screw the cam bolts into the end panels",
      detail: "Into the inside faces, by hand until they stop.",
      fix: [at("camScrew", [...camBolts("back", -1), ...camBolts("front", -1)], [-1, 0, 0], { on: "endL" }), at("camScrew", [...camBolts("back", 1), ...camBolts("front", 1)], [1, 0, 0], { on: "endR" })],
    },
    { title: "Lock the back panel to one end", detail: "One holds the end panel upright while the other pushes the back panel on. Turn the cam locks in the order shown, a little at a time.", people: 2, tools: ["screwdriver"], warnings: ["two"], kind: "cams" },
    { title: "Lock the front rail to the same end", detail: "Its cam locks face the inside of the bed.", people: 2, tools: ["screwdriver"], kind: "cams" },
    { title: "Lock on the other end panel", detail: "Push it over both ends at once, then turn its cam locks.", people: 2, tools: ["screwdriver"], kind: "cams" },
    { title: "Press the cover caps on", detail: "Two on the outside of each end panel.", fix: [at("cap", xa.flatMap((a) => yBk.map((y) => pt(a * W / 2, y, -D / 2 + 60))).slice(0, 2), [1, 0, 0], { dia: 20 }), at("cap", xa.flatMap((a) => yBk.map((y) => pt(a * W / 2, y, -D / 2 + 60))).slice(2), [-1, 0, 0], { dia: 20 })] },
    { title: "Screw the slat rails inside the frame", detail: "By hand, not with a drill. The flat edge faces up.", add: ["srB", "srF"], fix: [at("screw", srScrews(-zs, -1), [0, 0, -1], { len: 15, dia: 5 }), at("screw", srScrews(zs, 1), [0, 0, 1], { len: 15, dia: 5 })] },
    {
      title: "Screw on the slat stops",
      detail: "One at each end of both slat rails.",
      fix: [
        at("clip", [-1, 1].flatMap((sz) => [pt(-inW / 2 + 30, ySr + srS / 2, sz * zs), pt(inW / 2 - 30, ySr + srS / 2, sz * zs)]), [0, -1, 0], { dia: 24, len: 20 }),
        at("screw", [-1, 1].flatMap((sz) => [pt(-inW / 2 + 55, ySr + srS / 2, sz * zs), pt(inW / 2 - 55, ySr + srS / 2, sz * zs)]), [0, -1, 0], { len: 10, dia: 6 }),
      ],
    },
    { title: "Screw the cross straps under the slat rails", detail: "From corner to corner, so they cross in the middle.", add: ["strap0", "strap1"], fix: [at("screw", [pt(-dx / 2, yS1, -dz / 2), pt(dx / 2, yS1, dz / 2)], [0, 1, 0], { on: "strap1", len: 10, dia: 4 }), at("screw", [pt(dx / 2, yS0, -dz / 2)], [0, 1, 0], { on: "strap0", len: 10, dia: 4 })], check: "square" },
    { title: "Screw the last ends of the straps", detail: "Check the frame is square first: the diagonals should match.", fix: [at("screw", [pt(-dx / 2, yS0, dz / 2)], [0, 1, 0], { on: "strap0", len: 10, dia: 4 }), at("screw", [pt(0, yS1, 0)], [0, 1, 0], { on: "strap1", len: 10, dia: 4 })] },
    { title: "Roll out the slats", detail: "Curved side up. Push each end slat under its stop.", add: ["slats"] },
  ];

  if (/storage/.test(v)) {
    const boxD = 560;
    const b = boxParts([{ x: D / 2 - boxD / 2 + 10, side: 1 }], -W / 2 + t + 20, W / 2 - t - 20, 150, boxD, { ratio: 0.5, swap: true });
    parts.push(...b.parts);
    steps.push(...b.steps);
  }
  if (/trundle/.test(v)) {
    const tr = trundle(W, D);
    parts.push(...tr.parts);
    steps.push(...tr.steps);
  }
  const mats = /2 mattresses/.test(v) ? 2 : /1 mattress/.test(v) ? 1 : 0;
  if (mats) {
    parts.push({ id: "mat0", name: "Mattress", size: [2000, 150, 800], pos: [0, yS + 8 + 75, 0], material: "soft" });
    if (mats === 2) parts.push({ id: "mat1", name: "Mattress", size: [1900, 100, 760], pos: [0, 240, D / 2 + 340], material: "soft" });
    steps.push({ title: mats === 2 ? "Lay the mattresses on the slats" : "Lay the mattress on the slats", detail: "Unroll it and give it a day to take its full shape.", add: mats === 2 ? ["mat0", "mat1"] : ["mat0"] });
  }
  return { parts, steps };
}

/** The trundle bed: two long panels and four cross bars on castors, built upside down, with its own slats. */
function trundle(W: number, D: number): { parts: CustomPart[]; steps: CustomStep[] } {
  const L = 1980, Wd = 800, t = T, cH = 60;
  const z0 = D / 2 + Wd / 2 - 60; // pulled half out, in front of the day-bed
  const zf = z0 + Wd / 2 - t / 2, zk = z0 - Wd / 2 + t / 2;
  const ySr = 150, srS = 30;
  const xb = [-L / 2 + 60, -L / 6, L / 6, L / 2 - 60];
  const parts: CustomPart[] = [
    { id: "tF", name: "Trundle front", size: [L, 175, t], pos: [0, 15 + 87.5, zf], material: "board" },
    { id: "tK", name: "Trundle back", size: [L, 120, t], pos: [0, cH + 60, zk], material: "board" },
    ...xb.map((x, i): CustomPart => ({ id: `tX${i}`, name: "Cross bar", size: [40, 60, Wd - 2 * t], pos: [x, cH + 30, z0], material: "wood" })),
    { id: "tSf", name: "Slat rail", size: [L - 80, srS, srS], pos: [0, ySr, zf - t / 2 - srS / 2], material: "metal" },
    { id: "tSk", name: "Slat rail", size: [L - 80, srS, srS], pos: [0, ySr, zk + t / 2 + srS / 2], material: "metal" },
    { id: "tSl", name: "Trundle slats", size: [L - 100, 16, Wd - 2 * t - 10], pos: [0, ySr + srS / 2 + 8, z0], material: "wood" },
  ];
  const castors = xb.flatMap((x) => [pt(x, cH, z0 - Wd / 2 + 120), pt(x, cH, z0 + Wd / 2 - 120)]);
  const railScrews = (z: number, d: number) => spread(-L / 2 + 120, L / 2 - 120, 8).map((x) => pt(x, ySr, z + d * (srS / 2)));
  const ends = (z: number) => xb.map((x) => pt(x, cH + 30, z));
  // at each bar end a dowel high, a cam bolt low and the long bolt beside them, far enough apart to show
  const dw = (p: Vec3) => pt(p[0] - 12, p[1] + 20, p[2]);
  const cb = (p: Vec3) => pt(p[0] - 12, p[1] - 20, p[2]);
  const lb = (p: Vec3) => pt(p[0] + 12, p[1], p[2]);
  const steps: CustomStep[] = [
    { title: "Tap the dowels into the cross bars", detail: "The trundle is built upside down on a rug. Lay out the four bars; one dowel goes into each end.", add: xb.map((_, i) => `tX${i}`), fix: [at("dowel", ends(zk + t / 2).map(dw), [0, 0, 1], { mate: "tK" }), at("dowel", ends(zf - t / 2).map(dw), [0, 0, -1], { mate: "tF" })], warnings: ["floor"] },
    { title: "Screw two castors onto each cross bar", detail: "The castors with brakes go on the two outer bars.", fix: [at("castor", castors, [0, 1, 0]), at("screw", castors.flatMap((c) => [pt(c[0], cH, c[2] - 25), pt(c[0], cH, c[2] + 25)]), [0, 1, 0], { len: 16, dia: 4 })] },
    { title: "Screw a slat rail to the trundle back", detail: "Eight screws, flat edge toward the top of the bed.", add: ["tK", "tSk"], fix: [at("screw", railScrews(zk + t / 2 + srS / 2, 1), [0, 0, -1], { len: 15, dia: 5 })] },
    { title: "Stand the cross bars in the back", detail: "Push them onto the cam bolts and turn the cam locks.", fix: [at("camScrew", ends(zk + t / 2).map(cb), [0, 0, -1], { on: "tK" }), { kind: "cam", count: 4, to: ["tK"] }], tools: ["screwdriver"] },
    { title: "Screw the other slat rail to the trundle front", detail: "Eight screws, the same way as the first.", add: ["tSf"], fix: [at("screw", railScrews(zf - t / 2 - srS / 2, -1), [0, 0, 1], { len: 15, dia: 5 })] },
    { title: "Lower the front onto the cross bars", detail: "Over the dowels and cam bolts, then turn its cam locks.", add: ["tF"], fix: [at("camScrew", ends(zf - t / 2).map(cb), [0, 0, 1], { on: "tF" }), { kind: "cam", count: 4, to: ["tF"] }], tools: ["screwdriver"] },
    {
      title: "Bolt the front to the cross bars",
      detail: "A barrel nut into each bar, then a long bolt through the front into it.",
      fix: [at("nut", xb.map((x) => pt(x + 12, cH + 60, zf - t / 2 - 70)), [0, -1, 0], { dia: 10 }), at("bolt", ends(zf + t / 2).map(lb), [0, 0, -1], { on: "tF", len: 80, dia: 7 })],
    },
    { title: "Turn the trundle over and roll out its slats", detail: "Curved side up, the end slats under the stops.", add: ["tSl"] },
    { title: "Screw the pull handles onto the front", detail: "One near each end, two screws each.", fix: [at("handle", [pt(-L / 2 + 250, 140, zf + t / 2), pt(L / 2 - 250, 140, zf + t / 2)], [0, 0, -1], { len: 80, dia: 30 })] },
  ];
  return { parts, steps };
}

/* ---------------- the family ---------------- */

function recipe(s: ProductSpec): CustomParams | null {
  const tk = tableKind(s);
  if (tk) return tableRecipe(s, tk);
  if (s.archetype === "table" && /^extendable table/i.test(s.variant)) return extendableRecipe(s);
  if (s.archetype === "table" && /^gateleg table/i.test(s.variant)) return gatelegRecipe(s);
  if (s.archetype === "shelf" && /shelving unit/i.test(s.variant)) return shelvingRecipe(s);
  if (/^bedside table/i.test(s.variant)) return bedsideRecipe(s);
  if (s.archetype === "bed" && /^bed frame/i.test(s.variant)) return bedWithBoxes(s);
  if (s.archetype === "bed" && /^day-bed/i.test(s.variant)) return dayBedRecipe(s);
  if (/^chair$/i.test(s.variant)) return chairRecipe(s);
  if (/^folding chair/i.test(s.variant) || /vihals-folding-chair/.test(s.slug ?? "")) return foldingChairRecipe(s);
  if (s.archetype === "cabinet" || s.archetype === "drawers" || /^storage unit/i.test(s.variant)) {
    const cfg = cabinetCfg(s);
    if (cfg) return cabRecipe(s, cfg);
  }
  return null;
}

const family: Family = {
  names: ["VIHALS"],
  build(b: PlanBuilder, s: ProductSpec) {
    const r = recipe(s);
    if (!r) return false;
    buildCustom(b, { ...s, custom: r });
    return true;
  },
};
export default family;
